#!/usr/bin/env bash
# context-usage-selftest.sh — ctx:reads / ctx:usage 的本地「桩」自测（WXG-T-026）。
#
# 目的：在**不依赖本机真实 IDE 转录**的前提下，验证读入账本采集与使用分布分析。
# 做法：在临时目录里构造**假仓库 + 假 Cursor / WorkBuddy 转录**，注入
#       WXG_CURSOR_HOME / WXG_WORKBUDDY_HOME（默认值不受影响，CI / 日常不触碰真转录），
#       核对：
#         ① 读事件识别（全文读 / 区间读）+ 去重（重复区间键）
#         ② 仓库外路径丢弃（dropped）+ 计数
#         ③ fail loud：畸形行 / 仓库外 / 未知工具名 / 缺路径读 的计数与识别率
#         ④ --strict：未识别率超阈 → 非 0；干净样本 → 0；零样本 → 非 0
#         ⑤ 账本字节稳定（连续两次采集 shasum 一致）+ 固定键序 + 无仓库外路径
#         ⑥ ctx:usage：章节归属正确 + 输出字节稳定 + --strict 零样本非 0
#         ⑦ ctx:usage：distribution 新增 metrics 聚合块（WXG-T-026 ③④，供 build §4 / ctx:check E 项消费）
#         ⑧ ctx:check E 项收口语义（WXG-T-026，桩仓库内跑 check-context-budget.mjs）：
#            E1 未达标（行为类报告项）→ exit 0 且输出含 WARN / 未达标 / 数值；E3 劣于基线 → exit 1（硬门）；E1 达标 → exit 0 无 WARN。
#         ⑨ 复验补（WXG-T-026 F-01/F-02/F-03/F-04）：
#            • ctx:usage 输出比率字段（jitter.rate / bigFullReads.rate）+ reads-summary 含「样本代表性边界」「会话口径」段；
#            • ctx:check E2 展示**比率 + 原始计数**；E3 走**比率口径硬门**（劣于基线 >5pt → exit 1）；
#            • baseline v2 结构（version/est/sampleWindow）字段缺失 → 配置错误 exit 1。
#
# 用法：tools/scripts/context-usage-selftest.sh
# 产物：仅 stdout 报告；临时目录在退出时清理，不污染仓库 / 本机转录。

set -uo pipefail
# 刻意不用 set -e —— 需要捕获被测脚本的各种退出码。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLLECT="$SCRIPT_DIR/collect-context-reads.mjs"
ANALYZE="$SCRIPT_DIR/analyze-context-usage.mjs"
CHECK="$SCRIPT_DIR/check-context-budget.mjs"
PASS=0
FAIL=0

WORK="$(mktemp -d "${TMPDIR:-/tmp}/wxg-reads-selftest.XXXXXX")"
FAKEROOT="$WORK/fakeroot"
# slug 与真实一致：仓库绝对路径去掉前导 / 后把 / 换成 -
SLUG="$(printf '%s' "$FAKEROOT" | sed 's#^/##; s#/#-#g')"
CURSOR_HOME="$WORK/cursorhome"
WB_HOME="$WORK/wbhome"
CLEAN_HOME="$WORK/cleanhome"
EMPTY_HOME="$WORK/emptyhome"
LEDGER="$WORK/ledger.jsonl"
OUT_JSON="$WORK/usage-distribution.json"
OUT_MD="$WORK/reads-summary.md"
INDEX="$WORK/index.json"

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

ok()  { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
assert_eq() { if [ "$1" = "$2" ]; then ok "$3（=$1）"; else bad "$3：期望 [$2]，实际 [$1]"; fi; }
assert_contains() { case "$1" in *"$2"*) ok "$3";; *) bad "$3：输出中找不到 [$2]";; esac; }
assert_not_contains() { case "$1" in *"$2"*) bad "$3：输出中不应出现 [$2]";; *) ok "$3";; esac; }

# 从采集/分析 stdout 抽取某行「全角冒号后的首个整数」。
num() { grep -F "$1" "$2" | head -1 | sed -E 's/.*：([0-9]+).*/\1/'; }

echo "=================================================================="
echo "WXG-T-026 ctx:reads / ctx:usage 本地桩自测"
echo "采集: $COLLECT"
echo "分析: $ANALYZE"
echo "工作目录: $WORK"
echo "=================================================================="

# ── 造「假仓库」────────────────────────────────────────────────────────────
mkdir -p "$FAKEROOT/docs" "$FAKEROOT/src"
# docs/a.md = 40 行；src/b.ts = 12 行
awk 'BEGIN{for(i=1;i<=40;i++) printf "line %d of a\n", i}' >"$FAKEROOT/docs/a.md"
awk 'BEGIN{for(i=1;i<=12;i++) printf "export const b%d = %d;\n", i, i}' >"$FAKEROOT/src/b.ts"

# ── 造「假转录」（用 node 生成 JSONL，避免 shell 转义地狱）──────────────────
node - "$FAKEROOT" "$CURSOR_HOME" "$WB_HOME" "$SLUG" <<'NODE_EOF'
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [root, cursorHome, wbHome, slug] = process.argv.slice(2);
const w = (p, lines) => { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8'); };

// Cursor：{role,message} 行 + turn_ended 事件行
const cur = join(cursorHome, 'projects', slug, 'agent-transcripts', 'sess-1', 'sess-1.jsonl');
w(cur, [
  { role: 'user', message: { content: [{ type: 'text', text: 'hi' }] } },                              // other
  { role: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { path: join(root, 'docs/a.md') } }] } },                 // 全文读
  { role: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { path: join(root, 'docs/a.md'), offset: 5, limit: 10 } }] } }, // 区间读
  { role: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { path: join(root, 'docs/a.md'), offset: 5, limit: 10 } }] } }, // 重复 → 去重
  { role: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { path: '/etc/hosts' } }] } },                              // 仓库外 → 丢弃
  { role: 'assistant', message: { content: [{ type: 'tool_use', name: 'Frobnicate', input: { x: 1 } }] } },                                      // 未知工具 → other
  { role: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] } },                                                  // 缺路径 → badRead
  { type: 'turn_ended', status: 'success' },                                                                                                      // other
]);
// 追加一行畸形（非 JSON）
import { appendFileSync } from 'node:fs';
appendFileSync(cur, 'this is not json {{{ not-a-record\n', 'utf8');

// WorkBuddy：function_call / function_call_result / message
const wb = join(wbHome, 'projects', slug, 'wb-1.jsonl');
w(wb, [
  { type: 'function_call', name: 'Read', arguments: JSON.stringify({ file_path: join(root, 'src/b.ts') }), cwd: root, callId: 'c1' },                 // 全文读
  { type: 'function_call_result', name: 'Read', callId: 'c1', output: { type: 'text', text: '…' } },                                                  // other（结果行）
  { type: 'function_call', name: 'Read', arguments: JSON.stringify({ file_path: join(root, 'src/b.ts'), offset: 3, limit: 4 }), cwd: root, callId: 'c2' }, // 区间读
  { type: 'function_call', name: 'Bash', arguments: JSON.stringify({ command: 'ls' }), cwd: root, callId: 'c3' },                                     // other
  { type: 'message', role: 'assistant', content: [{ type: 'text', text: 'ok' }] },                                                                     // other
  { type: 'function_call', name: 'Read', arguments: '{not-json', cwd: root, callId: 'c4' },                                                            // 参数坏 → badRead
]);
NODE_EOF
echo "已生成桩仓库与桩转录（slug=${SLUG}）"

# ── [1] 采集（source=all，自动发现 slug）────────────────────────────────────
echo
echo "[1] ctx:reads（--source=all，自动发现 slug）"
env WXG_CURSOR_HOME="$CURSOR_HOME" WXG_WORKBUDDY_HOME="$WB_HOME" \
  node "$COLLECT" --root="$FAKEROOT" --out="$LEDGER" >"$WORK/collect.txt" 2>&1
rc=$?
assert_eq "$rc" "0" "采集退出码 0"
assert_eq "$(num '扫描转录文件数' "$WORK/collect.txt")" "2" "扫描文件数（cursor 1 + workbuddy 1）"
assert_eq "$(num '识别读事件数' "$WORK/collect.txt")" "6" "识别读事件数（4 cursor + 2 workbuddy）"
assert_eq "$(num '去重后账本行数' "$WORK/collect.txt")" "4" "去重后账本行数（重复区间键合并）"
assert_eq "$(num '未识别记录数' "$WORK/collect.txt")" "3" "① 未识别记录数 = 畸形 1 + 缺路径读 2"
assert_eq "$(num '丢弃的仓库外路径数' "$WORK/collect.txt")" "1" "② 仓库外路径丢弃数"
assert_eq "$(num 'stale' "$WORK/collect.txt")" "0" "stale 数（文件均在）"
assert_contains "$(cat "$WORK/collect.txt")" "识别率：80.00%" "识别率展示（3/15 未识别 → 80%）"

# ── [2] 账本内容与形态 ──────────────────────────────────────────────────────
echo
echo "[2] 账本形态：固定键序 / 无正文 / 全仓库内相对路径"
KEYS="$(head -1 "$LEDGER" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(Object.keys(JSON.parse(s)).join(",")))')"
assert_eq "$KEYS" "ide,session,path,offset,limit,fullFile,lines,bytes,estTokens" "行键序固定（白名单）"
if grep -Eq '"(content|text|body|message|prompt|output)"' "$LEDGER"; then
  bad "③ 账本疑似含正文/非白名单字段"
else
  ok "③ 账本仅含元数据字段（无 content/text/body 等）"
fi
if grep -E '"path":"(/|~)|"path":"\.\.' "$LEDGER" >/dev/null; then
  bad "③ 账本含仓库外/绝对路径"
else
  ok "③ 账本 path 全为仓库内相对路径"
fi

# ── [3] 账本字节稳定（连续两次采集）─────────────────────────────────────────
echo
echo "[3] 字节稳定：连续两次采集 shasum 一致"
env WXG_CURSOR_HOME="$CURSOR_HOME" WXG_WORKBUDDY_HOME="$WB_HOME" \
  node "$COLLECT" --root="$FAKEROOT" --out="$WORK/ledger2.jsonl" >/dev/null 2>&1
H1="$(shasum -a 256 "$LEDGER" | awk '{print $1}')"
H2="$(shasum -a 256 "$WORK/ledger2.jsonl" | awk '{print $1}')"
assert_eq "$H2" "$H1" "两次采集账本字节一致"

# ── [4] fail loud：--strict 语义 ────────────────────────────────────────────
echo
echo "[4] --strict 语义：脏样本失败 / 干净样本通过 / 零样本失败"
env WXG_CURSOR_HOME="$CURSOR_HOME" WXG_WORKBUDDY_HOME="$WB_HOME" \
  node "$COLLECT" --root="$FAKEROOT" --out="$WORK/l3.jsonl" --strict >/dev/null 2>&1
assert_eq "$?" "1" "脏样本（未识别率 20% > 5%）→ --strict exit 1"

# 干净样本：只含可识别行
mkdir -p "$CLEAN_HOME/projects/$SLUG/agent-transcripts/clean"
node - "$FAKEROOT" "$CLEAN_HOME" "$SLUG" <<'NODE_EOF'
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [root, home, slug] = process.argv.slice(2);
const p = join(home, 'projects', slug, 'agent-transcripts', 'clean', 'clean.jsonl');
mkdirSync(join(p, '..'), { recursive: true });
const lines = [
  { role: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { path: join(root, 'docs/a.md') } }] } },
  { role: 'user', message: { content: [] } },
];
writeFileSync(p, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
NODE_EOF
env WXG_CURSOR_HOME="$CLEAN_HOME" WXG_WORKBUDDY_HOME="$WB_HOME" \
  node "$COLLECT" --source=cursor --root="$FAKEROOT" --out="$WORK/l4.jsonl" --strict >"$WORK/clean.txt" 2>&1
assert_eq "$?" "0" "干净样本（未识别率 0%）→ --strict exit 0"

# 零样本（空转录）
mkdir -p "$EMPTY_HOME/projects/$SLUG/agent-transcripts"
env WXG_CURSOR_HOME="$EMPTY_HOME" WXG_WORKBUDDY_HOME="$EMPTY_HOME" \
  node "$COLLECT" --source=cursor --root="$FAKEROOT" --out="$WORK/l5.jsonl" --strict >/dev/null 2>&1
assert_eq "$?" "1" "零样本（0 读事件）→ --strict exit 1（fail loud）"

# ── [5] ctx:usage：章节归属 + 字节稳定 + --strict ───────────────────────────
echo
echo "[5] ctx:usage：章节归属（求交）/ 输出字节稳定 / --strict"
node - "$FAKEROOT" "$INDEX" <<'NODE_EOF'
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [root, out] = process.argv.slice(2);
const tok = (p) => {
  const s = readFileSync(p, 'utf8');
  let cjk = 0, ascii = 0;
  for (const ch of s) { const cp = ch.codePointAt(0); if (cp < 0x80) ascii++; else cjk++; }
  return Math.ceil(cjk + ascii / 4);
};
const idx = {
  version: 1,
  files: [
    { path: 'docs/a.md', tokens: tok(root + '/docs/a.md'), lines: 40, sections: [
      { anchor: '§A 上半', startLine: 1, endLine: 20, tokens: 100 },
      { anchor: '§B 下半', startLine: 21, endLine: 40, tokens: 120 },
    ] },
    { path: 'src/b.ts', tokens: tok(root + '/src/b.ts'), lines: 12, sections: [
      { anchor: '§C 全部', startLine: 1, endLine: 12, tokens: 80 },
    ] },
  ],
};
writeFileSync(out, JSON.stringify(idx, null, 2) + '\n', 'utf8');
NODE_EOF

node "$ANALYZE" --root="$FAKEROOT" --ledger="$LEDGER" --index="$INDEX" \
  --out-json="$OUT_JSON" --out-md="$OUT_MD" >"$WORK/analyze.txt" 2>&1
assert_eq "$?" "0" "分析退出码 0"
node - "$OUT_JSON" "$WORK/analysis-lines.txt" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
const [p, out] = process.argv.slice(2);
const d = JSON.parse(readFileSync(p, 'utf8'));
const checks = [
  ['version=1', d.version === 1],
  ['samples.sessions=2', d.samples.sessions === 2],
  ['samples.reads=4', d.samples.reads === 4],
  ['samples.dropped=1', d.samples.dropped === 1],
  ['samples.unrecognized=3', d.samples.unrecognized === 3],
  // metrics 聚合块（WXG-T-026 ③④）：build §4 与 ctx:check E 项消费的「纯查表」数据。
  ['metrics.est=true', d.metrics?.est === true],
  ['metrics.reads=4', d.metrics?.reads === 4],
  ['metrics.fullFileReads=2', d.metrics?.fullFileReads === 2],
  ['metrics.nonFullReads=2', d.metrics?.nonFullReads === 2],
  ['metrics.partialSamples=2', d.metrics?.partialSamples === 2],
  ['metrics.savings.medianPartial 为数字', typeof d.metrics?.savings?.medianPartial === 'number'],
  ['metrics.savings.p10Partial 为数字', typeof d.metrics?.savings?.p10Partial === 'number'],
  ['metrics.jitter.groups=0', d.metrics?.jitter?.groups === 0],
  ['metrics.bigFullReads.count=0', d.metrics?.bigFullReads?.count === 0],
  // 比率字段（WXG-T-026 复验 F-02）
  ['metrics.jitter.rate 为数字', typeof d.metrics?.jitter?.rate === 'number'],
  ['metrics.jitter.groupKeys 为数字', typeof d.metrics?.jitter?.groupKeys === 'number'],
  ['metrics.bigFullReads.rate 为数字', typeof d.metrics?.bigFullReads?.rate === 'number'],
  ['metrics.bigFullReads.totalReads 为数字', typeof d.metrics?.bigFullReads?.totalReads === 'number'],
  ['samples.sessionsWithReadEvents 为数字（F-03）', typeof d.samples?.sessionsWithReadEvents === 'number'],
];
const byPath = Object.fromEntries(d.files.map((f) => [f.path, Object.fromEntries(f.sections.map((s) => [s.anchor, s.reads]))]));
checks.push(['docs/a.md§A reads=2', byPath['docs/a.md']?.['§A 上半'] === 2]);
checks.push(['docs/a.md§B reads=1（全文读归属）', byPath['docs/a.md']?.['§B 下半'] === 1]);
checks.push(['src/b.ts§C reads=2', byPath['src/b.ts']?.['§C 全部'] === 2]);
writeFileSync(out, checks.map(([l, c]) => `${c ? 'PASS' : 'FAIL'}\t${l}`).join('\n') + '\n', 'utf8');
NODE_EOF
while IFS=$'\t' read -r st label; do
  if [ "$st" = "PASS" ]; then ok "归属：$label"; else bad "归属：$label"; fi
done <"$WORK/analysis-lines.txt"

# F-01 / F-03：人读报告含「样本代表性边界」段（2 根会话 / 活动会话声明 / 不可外推）与会话口径脚注
assert_contains "$(cat "$OUT_MD")" "样本代表性边界" "⑥ reads-summary 含「样本代表性边界」段（F-01）"
assert_contains "$(cat "$OUT_MD")" "不可外推" "⑥ reads-summary 含「不可外推」声明（F-01）"
assert_contains "$(cat "$OUT_MD")" "会话口径二义" "⑥ reads-summary 含会话口径脚注（F-03）"
assert_contains "$(cat "$OUT_MD")" "根会话" "⑥ reads-summary 含根会话/子代理拆分（F-01）"

node "$ANALYZE" --root="$FAKEROOT" --ledger="$LEDGER" --index="$INDEX" \
  --out-json="$WORK/usage2.json" --out-md="$WORK/summary2.md" >/dev/null 2>&1
A1="$(shasum -a 256 "$OUT_JSON" | awk '{print $1}')"
A2="$(shasum -a 256 "$WORK/usage2.json" | awk '{print $1}')"
assert_eq "$A2" "$A1" "⑥ usage-distribution.json 两次字节一致"

node "$ANALYZE" --root="$FAKEROOT" --ledger="$WORK/l5.jsonl" --index="$INDEX" \
  --out-json="$WORK/u3.json" --out-md="$WORK/m3.md" --strict >/dev/null 2>&1
assert_eq "$?" "1" "⑥ --strict 零样本 → exit 1"

# ── [6] ctx:check E 项收口语义（WXG-T-026）：行为类报告项不阻断 / E3 基线硬门 ──
# 做法：造一个「假仓库根」（脚本的 ROOT 由 lib/context-index.mjs 基于自身 URL 计算，
#       把脚本 + lib 拷进 <fakeroot>/tools/scripts/ 即让 ROOT = fakeroot），
#       注入桩 index / distribution / baseline，分别验证三种退出码语义。
echo
echo "[6] ctx:check：E1 未达标不阻断 / E3 比率+节省率劣化硬门 / baseline v2 字段（version/est/sampleWindow）强制"
CR="$WORK/checkroot"
mkdir -p "$CR/tools/scripts/lib" "$CR/my-rules" "$CR/ctx"
cp "$CHECK" "$CR/tools/scripts/"
cp "$SCRIPT_DIR/lib/context-index.mjs" "$CR/tools/scripts/lib/"
cp "$SCRIPT_DIR/lib/context-tokens.mjs" "$CR/tools/scripts/lib/"
CHECK_STUB="$CR/tools/scripts/check-context-budget.mjs"

# 桩仓库 .md + ctx/index.json（sha256 与磁盘一致，保证 C 门新鲜）+ ROUTES 桩
node - "$CR" <<'NODE_EOF'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const root = process.argv[2];
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const write = (rel, text) => {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, text, 'utf8');
};
write('AGENTS.md', '# AGENTS stub\n\n常驻文件桩。\n');
write('my-rules/INDEX.md', '# rules stub\n');
write('my-rules/agents-md.md', '# agents-md stub\n');
write('ctx/ROUTES.md', '# ROUTES stub（无锚点引用）\n');
const index = {
  version: 1,
  files: ['AGENTS.md', 'my-rules/INDEX.md', 'my-rules/agents-md.md', 'ctx/ROUTES.md'].map((path) => ({
    path,
    tokens: 50,
    sha256: sha(readFileSync(join(root, path), 'utf8')),
    sections: [],
  })),
};
writeFileSync(join(root, 'ctx/index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
NODE_EOF

# 桩 distribution：局部读 P10=20.0% < 40.0%（E1 未达标）、中位数 75.0% ≥ 70.0%（达标）
node - "$CR" <<'NODE_EOF'
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const dist = {
  version: 1,
  samples: { sessions: 2, reads: 40, dropped: 0, unrecognized: 0, sessionsWithReadEvents: 2 },
  metrics: {
    est: true, reads: 40, sessions: 2,
    fullFileReads: 10, nonFullReads: 30, partialSamples: 30,
    savings: { samples: 40, overall: 0.5, median: 0.5, p10: 0.5, medianPartial: 0.75, p10Partial: 0.2 },
    jitter: { smallReadLines: 10, threshold: 3, groups: 2, excess: 5, groupKeys: 20, rate: 0.1 },
    bigFullReads: { thresholdTokens: 3000, count: 3, totalReads: 40, rate: 0.075 },
  },
  files: [],
};
writeFileSync(join(root, 'ctx/usage-distribution.json'), JSON.stringify(dist, null, 2) + '\n', 'utf8');
NODE_EOF

set_baseline_p10() {
  node - "$CR" "$1" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [root, p10] = process.argv.slice(2);
const p = join(root, 'ctx/savings-baseline.json');
const j = JSON.parse(readFileSync(p, 'utf8'));
j.metrics.p10Partial = Number(p10);
writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
NODE_EOF
}
# 通用：改基线某 metrics 字段（F-02 比率场景用）
set_baseline_metric() {
  node - "$CR" "$1" "$2" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [root, key, val] = process.argv.slice(2);
const p = join(root, 'ctx/savings-baseline.json');
const j = JSON.parse(readFileSync(p, 'utf8'));
j.metrics[key] = Number(val);
writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
NODE_EOF
}
# 初始 baseline：与当前 distribution 一致（E3 不劣化）
node - "$CR" <<'NODE_EOF'
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const bl = {
  version: 2, taskId: 'WXG-T-026', reason: 'selftest stub', est: true,
  sampleWindow: { since: null, until: null, note: 'selftest stub' },
  tolerance: { savings: '>2.0pt → FAIL', rate: '>5.0pt → FAIL', counts: '仅展示' },
  metrics: {
    medianPartial: 0.75, p10Partial: 0.2,
    jitterRate: 0.1, bigFullReadRate: 0.075,
    jitterGroups: 2, jitterExcess: 5, bigFullReads: 3,
  },
};
writeFileSync(join(process.argv[2], 'ctx/savings-baseline.json'), JSON.stringify(bl, null, 2) + '\n', 'utf8');
NODE_EOF

# 场景 A：E1 未达标（P10 20.0% < 40.0%）→ exit 0（行为类报告项不阻断）+ WARN 文案
node "$CHECK_STUB" >"$WORK/checkA.txt" 2>&1
assert_eq "$?" "0" "⑧A E1 未达标 → exit 0（行为类报告项不阻断 CI）"
OUTA="$(cat "$WORK/checkA.txt")"
assert_contains "$OUTA" "WARN" "⑧A 输出含 WARN 文案"
assert_contains "$OUTA" "未达标" "⑧A 输出含「未达标」字样（不被读成 PASS）"
assert_contains "$OUTA" "20.0%" "⑧A 保留未达标数值 20.0%（未抹掉）"
assert_contains "$OUTA" "40.0%" "⑧A 保留阈值 40.0%（未改动）"
assert_contains "$OUTA" "不阻断 CI" "⑧A 汇总行声明不阻断 CI"
assert_contains "$OUTA" "抖动率" "⑧A E2 展示「抖动率」（比率口径 F-02）"
assert_contains "$OUTA" "大文件整文件读率" "⑧A E2 展示「大文件整文件读率」（比率口径 F-02）"
assert_contains "$OUTA" "10.0%" "⑧A E2 展示抖动率数值 10.0%（桩）"
assert_contains "$OUTA" "2 组 / 20 组" "⑧A E2 同时展示原始计数（2 组 / 20 组）"

# 场景 B：基线劣化（baseline P10=90.0% ≫ 当前 20.0%）→ exit 1（E3 硬门）
set_baseline_p10 0.9
node "$CHECK_STUB" >"$WORK/checkB.txt" 2>&1
assert_eq "$?" "1" "⑧B E3 劣于基线 → exit 1（基线回归硬门）"
assert_contains "$(cat "$WORK/checkB.txt")" "劣于基线" "⑧B 输出含「劣于基线」诊断"

# 场景 C：E1 达标（P10 50.0% ≥ 40.0%）且基线一致 → exit 0 且无「未达标」
node - "$CR" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const p = join(process.argv[2], 'ctx/usage-distribution.json');
const j = JSON.parse(readFileSync(p, 'utf8'));
j.metrics.savings.p10Partial = 0.5;
writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
NODE_EOF
set_baseline_p10 0.5
node "$CHECK_STUB" >"$WORK/checkC.txt" 2>&1
assert_eq "$?" "0" "⑧C E1 达标 → exit 0"
assert_not_contains "$(cat "$WORK/checkC.txt")" "未达标" "⑧C 达标时输出不含「未达标」（WARN 不误报）"

# 场景 D：**比率口径硬门（F-02）**——基线抖动率压到 0.01（当前 0.1，超容忍 5pt）→ exit 1；恢复 → exit 0
set_baseline_metric jitterRate 0.01
node "$CHECK_STUB" >"$WORK/checkD.txt" 2>&1
assert_eq "$?" "1" "⑧D 抖动率劣于基线 → exit 1（比率口径硬门 F-02）"
assert_contains "$(cat "$WORK/checkD.txt")" "劣于基线" "⑧D 输出含「劣于基线」诊断"
set_baseline_metric jitterRate 0.1
node "$CHECK_STUB" >"$WORK/checkD2.txt" 2>&1
assert_eq "$?" "0" "⑧D 恢复基线比率 → exit 0"

# 场景 E：**v2 基线字段强制（F-04）**——删 est → 配置错误 exit 1；补回 → exit 0
node - "$CR" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const p = join(process.argv[2], 'ctx/savings-baseline.json');
const j = JSON.parse(readFileSync(p, 'utf8'));
delete j.est;
writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
NODE_EOF
node "$CHECK_STUB" >"$WORK/checkE.txt" 2>&1
assert_eq "$?" "1" "⑧E v2 基线缺 est → exit 1（F-04 字段强制）"
assert_contains "$(cat "$WORK/checkE.txt")" "est" "⑧E 诊断点名缺 est"
node - "$CR" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const p = join(process.argv[2], 'ctx/savings-baseline.json');
const j = JSON.parse(readFileSync(p, 'utf8'));
j.est = true;
writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
NODE_EOF
node "$CHECK_STUB" >"$WORK/checkE2.txt" 2>&1
assert_eq "$?" "0" "⑧E 补回 est → exit 0"

# ── 汇总 ────────────────────────────────────────────────────────────────────
echo
echo "=================================================================="
echo "结果：PASS=$PASS  FAIL=$FAIL"
echo "=================================================================="
[ "$FAIL" -eq 0 ]
