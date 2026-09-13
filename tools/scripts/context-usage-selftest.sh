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
#         ⑩ 索引新鲜度契约（WXG-T-026 修复）：在**独立 git 桩仓库**内验证 —— dirty（有未提交
#            改动）文件按 **HEAD blob** 索引/校验（sha256 == `git show HEAD:<path>`，≠ 工作树内容）；
#            未跟踪新 .md **不入索引**且不误报「未收录」；`--working-tree` 逃生阀标注「非默认模式」。
#         ⑪ 暂存区校验（WXG-T-032 ③）：`--staged` 三态 —— 暂存内容与索引一致 → exit 0；
#            不一致 → exit 1；暂存索引外新 .md → exit 1；无暂存 .md → 零暂存校验 exit 0。
#         ⑫ pre-commit 自动重建（WXG-T-032 ⑤）：`--staged-blobs` 契约 —— 暂存内容被哈希入索引
#            （暂存 ≠ 工作树时取暂存 blob）、暂存新文件入索引、未暂存 dirty 文件仍按 HEAD；
#            真实 pre-commit 场景 —— 改 md → git add → commit 成功且提交树含重建后的
#            index/BUDGET（提交后复算重建字节一致）、并发在制文件不受影响；兜底 —— 重建后
#            再改暂存内容 / 手工改坏产物 → `--staged` 终校验 FAIL；再次提交由 hook 自愈成功。
#         ⑬ 分窗轮转（WXG-T-037 R1）：ctx:rotate —— 树原子轮转（窗口边界会话不截断）、
#            历史聚合与手工计算一致（原始节省率样本数组）、幂等（重复运行不重复聚合）、
#            已冻结会话重采行丢弃、窗口溢出须 reason/taskId 留痕；ctx:usage 输出
#            metrics.cumulative（窗口⊕历史）且分位数与手工合并一致；ctx:check E1/E3
#            以累计口径判定（基线一致 exit 0 / 劣化 exit 1 / 窗口小样本不误报不足）。
#
#         ⑭ ROUTES 常驻上限（WXG-T-039 R5）：A 项 `ctx/ROUTES.md` ≤ routesMd（7500）硬门 ——
#            低于上限 exit 0（A 项表 + BUDGET.md §1 同源同读数展示）；超限 exit 1 + 瘦身修复
#            指引（桩文件卡在 7500~8000 之间，使失败唯一归因 ROUTES 门而非 B 项通用门）；
#            常驻总量观察哨：各文件均低于各自上限但合计超 residentTotalSoft（13500）→ 仍
#            exit 0，仅 ⚠️ 提示不阻断（硬阻断只挂各单文件门）。
#
# 用法：tools/scripts/context-usage-selftest.sh
# 产物：仅 stdout 报告；临时目录在退出时清理，不污染仓库 / 本机转录。

set -uo pipefail
# 刻意不用 set -e —— 需要捕获被测脚本的各种退出码。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLLECT="$SCRIPT_DIR/collect-context-reads.mjs"
ANALYZE="$SCRIPT_DIR/analyze-context-usage.mjs"
CHECK="$SCRIPT_DIR/check-context-budget.mjs"
BUILD="$SCRIPT_DIR/build-context-index.mjs"
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
cp "$BUILD" "$CR/tools/scripts/"
CHECK_STUB="$CR/tools/scripts/check-context-budget.mjs"
BUILD_STUB="$CR/tools/scripts/build-context-index.mjs"

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
// ctx/hot-files.md（WXG-T-036 q-1）是 A 门常驻预算项：缺失 → A 项 FAIL（修复本自测
// 此前在 HEAD 上就存在的 4 个既有 FAIL——[6] 桩漏建该文件）。
write('ctx/hot-files.md', '# hot-files stub\n');
const index = {
  version: 1,
  files: ['AGENTS.md', 'my-rules/INDEX.md', 'my-rules/agents-md.md', 'ctx/ROUTES.md', 'ctx/hot-files.md'].map((path) => ({
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

# ── [7] 索引新鲜度契约（WXG-T-026 修复）：dirty 文件按 HEAD 内容索引 / 校验 ──────
# 做法：把 $CR（[6] 的假仓库根）初始化为**独立 git 仓库**（不触碰真实仓库），提交既有桩，
#       再制造真实 dirty 场景，验证：dirty→HEAD、未跟踪新文件不入索引、--working-tree 逃生阀。
echo
echo "[7] ctx:build / ctx:check 契约（git 桩仓库）：dirty→HEAD / 未跟踪新文件不入索引 / --working-tree"
git -C "$CR" init -q
git -C "$CR" add -A
git -C "$CR" -c user.email=selftest@example.com -c user.name=selftest commit -q -m "selftest stub baseline"
assert_eq "$(git -C "$CR" status --porcelain | wc -l | tr -d ' ')" "0" "⑦ 桩仓库已初始化且工作树干净"

# 7.0 干净检出：默认 build → 默认 check 必须 exit 0（修复前 dirty 索引会判过期 exit 1）
node "$BUILD_STUB" >"$WORK/b7_0.txt" 2>&1
assert_eq "$?" "0" "⑦ 干净检出 build 退出码 0"
git -C "$CR" add -A
git -C "$CR" -c user.email=selftest@example.com -c user.name=selftest commit -q -m "selftest stub index+budget"
node "$CHECK_STUB" >"$WORK/c7_0.txt" 2>&1
assert_eq "$?" "0" "⑦ 干净检出 ctx:check exit 0"

# 7.1 dirty（已跟踪 .md 有未提交改动）→ 默认 build 按 HEAD blob 索引；check 仍 exit 0
cp "$CR/AGENTS.md" "$WORK/agents.orig"
printf '\n新增一行，模拟并发会话未提交改动（WXG-T-026 自测）。\n' >>"$CR/AGENTS.md"
node "$BUILD_STUB" >"$WORK/b7_1.txt" 2>&1
assert_eq "$?" "0" "⑦ dirty 场景 build 退出码 0"
assert_contains "$(cat "$WORK/b7_1.txt")" "HEAD 内容" "⑦ build 输出列出「dirty 文件按 HEAD 内容索引」"
node - "$CR" "$WORK/t7_1.txt" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [root, out] = process.argv.slice(2);
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const idx = JSON.parse(readFileSync(root + '/ctx/index.json', 'utf8'));
const rec = idx.files.find((f) => f.path === 'AGENTS.md');
const head = execFileSync('git', ['show', 'HEAD:AGENTS.md'], { cwd: root, encoding: 'utf8' });
const wt = readFileSync(root + '/AGENTS.md', 'utf8');
const checks = [
  ['索引 sha256 == HEAD blob（dirty→HEAD）', rec?.sha256 === sha(head)],
  ['索引 sha256 != 工作树 dirty 内容（未误用未提交内容）', rec?.sha256 !== sha(wt)],
];
writeFileSync(out, checks.map(([l, c]) => `${c ? 'PASS' : 'FAIL'}\t${l}`).join('\n') + '\n');
NODE_EOF
while IFS=$'\t' read -r st label; do
  if [ "$st" = "PASS" ]; then ok "⑦ $label"; else bad "⑦ $label"; fi
done <"$WORK/t7_1.txt"
node "$CHECK_STUB" >"$WORK/c7_1.txt" 2>&1
assert_eq "$?" "0" "⑦ dirty 工作树下 ctx:check exit 0（不再因未提交改动判过期）"
assert_contains "$(cat "$WORK/c7_1.txt")" "dirty 文件按 HEAD 内容校验" "⑦ check 输出标注「dirty 文件按 HEAD 内容校验」"

# 7.2 逃生阀 --working-tree：强制按工作树内容，输出标注「非默认模式」
node "$BUILD_STUB" --working-tree >"$WORK/b7_2.txt" 2>&1
assert_eq "$?" "0" "⑦ --working-tree build 退出码 0"
assert_contains "$(cat "$WORK/b7_2.txt")" "非默认模式" "⑦ --working-tree build 标注「非默认模式」"
node "$CHECK_STUB" --working-tree >"$WORK/c7_2.txt" 2>&1
assert_eq "$?" "0" "⑦ --working-tree check（按工作树）exit 0"
assert_contains "$(cat "$WORK/c7_2.txt")" "非默认模式" "⑦ --working-tree check 标注「非默认模式」"

# 7.3 未跟踪新 .md：不入索引（不误报「未收录」）；恢复 AGENTS.md 后默认重建
cp "$WORK/agents.orig" "$CR/AGENTS.md"
mkdir -p "$CR/docs"
printf '# 未跟踪新文件（WXG-T-026 自测）\n\n正文。\n' >"$CR/docs/new-untracked.md"
node "$BUILD_STUB" >"$WORK/b7_3.txt" 2>&1
assert_eq "$?" "0" "⑦ 含未跟踪新 .md 时 build 退出码 0"
assert_contains "$(cat "$WORK/b7_3.txt")" "未入索引" "⑦ build 明示「未提交新文件未入索引」"
node - "$CR" "$WORK/t7_3.txt" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
const [root, out] = process.argv.slice(2);
const idx = JSON.parse(readFileSync(root + '/ctx/index.json', 'utf8'));
const has = idx.files.some((f) => f.path === 'docs/new-untracked.md');
writeFileSync(out, `${has ? 'FAIL' : 'PASS'}\t未跟踪新文件不在索引中\n`);
NODE_EOF
while IFS=$'\t' read -r st label; do
  if [ "$st" = "PASS" ]; then ok "⑦ $label"; else bad "⑦ $label"; fi
done <"$WORK/t7_3.txt"
node "$CHECK_STUB" >"$WORK/c7_3.txt" 2>&1
assert_eq "$?" "0" "⑦ 有未跟踪新 .md 时 ctx:check 仍 exit 0（不误报未收录）"

# ── [8] 暂存区校验（WXG-T-032 ③）：--staged 三态 + 无暂存 .md 零暂存校验 ─────────
# 做法：沿用 [7] 的独立 git 桩仓库 $CR（HEAD 已含与磁盘一致的 ctx/index.json），制造真实暂存场景。
echo
echo "[8] ctx:check --staged：一致 exit 0 / 不一致 exit 1 / 新文件未入索引 exit 1 / 无暂存 .md 零校验"

# 8.0 无暂存 .md → C 项零暂存校验，exit 0（pre-commit 零开销路径的语义等价物）
git -C "$CR" reset -q
node "$CHECK_STUB" --staged >"$WORK/c8_0.txt" 2>&1
assert_eq "$?" "0" "⑪ 无暂存 .md → --staged exit 0（零暂存校验）"
assert_contains "$(cat "$WORK/c8_0.txt")" "--staged" "⑪ 输出标注 --staged 非默认模式"
assert_contains "$(cat "$WORK/c8_0.txt")" "零暂存校验" "⑪ 输出含「零暂存校验」"

# 8.1 三态之一「一致」：改 AGENTS.md → 按 --working-tree 重建索引 → .md 与索引一起暂存 → exit 0
printf '\n暂存一致性场景（WXG-T-032 自测）。\n' >>"$CR/AGENTS.md"
node "$BUILD_STUB" --working-tree >/dev/null 2>&1
git -C "$CR" add AGENTS.md ctx/index.json
node "$CHECK_STUB" --staged >"$WORK/c8_1.txt" 2>&1
assert_eq "$?" "0" "⑪A 暂存内容与索引一致 → exit 0（重建后一起 git add 的正确姿势）"

# 8.2 三态之二「不一致」：再改 AGENTS.md 并暂存但不重建索引 → exit 1 + 修复指引
printf '再次修改，模拟「改了 md 忘了重建索引」（WXG-T-032 自测）。\n' >>"$CR/AGENTS.md"
git -C "$CR" add AGENTS.md
node "$CHECK_STUB" --staged >"$WORK/c8_2.txt" 2>&1
assert_eq "$?" "1" "⑪B 暂存内容与索引不一致 → exit 1"
assert_contains "$(cat "$WORK/c8_2.txt")" "暂存内容与索引不一致" "⑪B 输出含「暂存内容与索引不一致」"
assert_contains "$(cat "$WORK/c8_2.txt")" "pnpm run ctx:build" "⑪B 输出含重建索引修复指引"

# 8.3 三态之三「新文件未入索引」：暂存一个索引中不存在的新 .md → exit 1
printf '# 新暂存文件（WXG-T-032 自测）\n\n正文。\n' >"$CR/docs/staged-new.md"
git -C "$CR" add docs/staged-new.md
node "$CHECK_STUB" --staged >"$WORK/c8_3.txt" 2>&1
assert_eq "$?" "1" "⑪C 暂存了索引中不存在的新 .md → exit 1"
assert_contains "$(cat "$WORK/c8_3.txt")" "新文件未入索引" "⑪C 输出含「新文件未入索引」"

# ── [9] pre-commit 自动重建（WXG-T-032 ⑤）：staged-blobs 契约 / 真实 commit / 兜底 ─
# 做法：沿用 [7]/[8] 的独立 git 桩仓库 $CR。真实 .githooks/pre-commit **原样复制**进桩仓库运行；
#       用 PATH 桩 `pnpm`（只对 hook ① 的 `pnpm run check:links` 放行）跳过 links 门——
#       links 门由专项脚本覆盖，本段只验 ② ctx 自动重建链路；hook 的 ② 全链路真实执行。
echo
echo "[9] pre-commit 自动重建（WXG-T-032 ⑤）：--staged-blobs 契约 + commit 成功含产物 + 兜底拦截"

# 回到干净基线（清掉 [8] 遗留的暂存与未跟踪文件）。
# 7.0 首建的 ctx/BUDGET.md 处于「自引用行落后一步」的瞬态；收敛式 build 会得到与 HEAD
# 不同的字节 → 重建后归一入库，保证 [9] 的基线 = 产物不动点（后续复算断言才确定性成立）。
git -C "$CR" reset -q --hard HEAD
rm -rf "$CR/docs"
node "$BUILD_STUB" >/dev/null 2>&1
git -C "$CR" add -A
git -C "$CR" -c user.email=selftest@example.com -c user.name=selftest \
  commit -q -m "selftest: [9] baseline (converged ctx products)" >/dev/null 2>&1 || true
node "$BUILD_STUB" >/dev/null 2>&1
assert_eq "$(git -C "$CR" status --porcelain | wc -l | tr -d ' ')" "0" "⑫ [9] 桩仓库回到产物不动点基线（重建幂等）"

# PATH 桩 pnpm + 真实 hook 原样复制 + core.hooksPath 指向桩仓库
mkdir -p "$WORK/bin" "$CR/.githooks"
printf '#!/usr/bin/env sh\n# selftest PATH 桩：pre-commit ① links 门放行（专项脚本覆盖）；② ctx 链路保持真实执行\nexit 0\n' >"$WORK/bin/pnpm"
chmod +x "$WORK/bin/pnpm"
cp "$SCRIPT_DIR/../../.githooks/pre-commit" "$CR/.githooks/pre-commit"
git -C "$CR" config core.hooksPath .githooks

# 9.1 契约：暂存内容被哈希入索引（暂存 ≠ 工作树时取暂存 blob）/ 未暂存 dirty 仍按 HEAD
printf '\nstaged-blobs 契约测试（WXG-T-032 ⑤ 自测）。\n' >>"$CR/AGENTS.md"
git -C "$CR" add AGENTS.md
printf 'staged 之后的未暂存追加行。\n' >>"$CR/AGENTS.md"                     # 暂存内容 ≠ 工作树
printf '\n并发会话未暂存改动（9.1 不暂存）。\n' >>"$CR/my-rules/INDEX.md"     # 未暂存 dirty
node "$BUILD_STUB" --staged-blobs >"$WORK/b9_1.txt" 2>&1
assert_eq "$?" "0" "⑫A --staged-blobs build 退出码 0"
assert_contains "$(cat "$WORK/b9_1.txt")" "暂存 blob" "⑫A build 输出标注 --staged-blobs 非默认模式"
node - "$CR" "$WORK/t9_1.txt" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [root, out] = process.argv.slice(2);
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const g = (a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const idx = JSON.parse(readFileSync(root + '/ctx/index.json', 'utf8'));
const recOf = (p) => idx.files.find((f) => f.path === p);
const stagedAg = g(['show', ':AGENTS.md']);
const wtAg = readFileSync(root + '/AGENTS.md', 'utf8');
const headRules = g(['show', 'HEAD:my-rules/INDEX.md']);
const wtRules = readFileSync(root + '/my-rules/INDEX.md', 'utf8');
const checks = [
  ['AGENTS.md 索引 sha == 暂存 blob（暂存内容被哈希入索引）', recOf('AGENTS.md')?.sha256 === sha(stagedAg)],
  ['AGENTS.md 索引 sha != 工作树内容（未误用未暂存改动）', recOf('AGENTS.md')?.sha256 !== sha(wtAg)],
  ['my-rules/INDEX.md 索引 sha == HEAD blob（未暂存 dirty 仍按 HEAD 契约）', recOf('my-rules/INDEX.md')?.sha256 === sha(headRules)],
  ['my-rules/INDEX.md 索引 sha != 工作树 dirty 内容', recOf('my-rules/INDEX.md')?.sha256 !== sha(wtRules)],
];
writeFileSync(out, checks.map(([l, c]) => `${c ? 'PASS' : 'FAIL'}\t${l}`).join('\n') + '\n', 'utf8');
NODE_EOF
while IFS=$'\t' read -r st label; do
  if [ "$st" = "PASS" ]; then ok "⑫ $label"; else bad "⑫ $label"; fi
done <"$WORK/t9_1.txt"

# 暂存新文件入索引
mkdir -p "$CR/docs"
printf '# 暂存新文件（WXG-T-032 ⑤ 自测）\n\n正文。\n' >"$CR/docs/staged-new.md"
git -C "$CR" add docs/staged-new.md
node "$BUILD_STUB" --staged-blobs >/dev/null 2>&1
node - "$CR" "$WORK/t9_1b.txt" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [root, out] = process.argv.slice(2);
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const g = (a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const staged = g(['show', ':docs/staged-new.md']);
const idx = JSON.parse(readFileSync(root + '/ctx/index.json', 'utf8'));
const rec = idx.files.find((f) => f.path === 'docs/staged-new.md');
const checks = [
  ['暂存新文件入索引', rec != null],
  ['暂存新文件索引 sha == 暂存 blob', rec?.sha256 === sha(staged)],
];
writeFileSync(out, checks.map(([l, c]) => `${c ? 'PASS' : 'FAIL'}\t${l}`).join('\n') + '\n', 'utf8');
NODE_EOF
while IFS=$'\t' read -r st label; do
  if [ "$st" = "PASS" ]; then ok "⑫ $label"; else bad "⑫ $label"; fi
done <"$WORK/t9_1b.txt"

# 9.2 pre-commit 场景：改 md → git add → commit 成功，提交树含重建后的 index/BUDGET
printf '\npre-commit 自动重建场景（WXG-T-032 ⑤ 自测）。\n' >>"$CR/AGENTS.md"
printf '\n并发会话未暂存改动（9.2 不暂存，应保持 dirty 且按 HEAD 锚定）。\n' >>"$CR/my-rules/INDEX.md"
git -C "$CR" add AGENTS.md
PATH="$WORK/bin:$PATH" git -C "$CR" \
  -c user.email=selftest@example.com -c user.name=selftest \
  commit -q -m "selftest: pre-commit auto rebuild (WXG-T-032)" >"$WORK/c9_2.txt" 2>&1
assert_eq "$?" "0" "⑫B 改 md → git add → commit 成功（hook 自动重建，无需先 ctx:build / 无 --no-verify）"
node - "$CR" "$WORK/t9_2.txt" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [root, out] = process.argv.slice(2);
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const g = (a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const headIdxRaw = g(['show', 'HEAD:ctx/index.json']);
const headBudget = g(['show', 'HEAD:ctx/BUDGET.md']);
const idx = JSON.parse(headIdxRaw);
const recOf = (p) => idx.files.find((f) => f.path === p);
const headAg = g(['show', 'HEAD:AGENTS.md']);
const headRules = g(['show', 'HEAD:my-rules/INDEX.md']);
const status = g(['status', '--porcelain']);
const checks = [
  ['提交树含重建后的 ctx/index.json（合法索引 JSON，非空文件集）', (idx.files?.length ?? 0) > 0],
  ['提交树含重建后的 ctx/BUDGET.md', headBudget.includes('上下文预算报表')],
  ['提交内 index 的 AGENTS.md sha == 提交内 AGENTS.md 内容（暂存 blob 如实入库）', recOf('AGENTS.md')?.sha256 === sha(headAg)],
  ['提交内 index 的 my-rules/INDEX.md sha == HEAD blob（并发在制文件不受 staged 重建影响）', recOf('my-rules/INDEX.md')?.sha256 === sha(headRules)],
  ['并发在制文件提交后仍为 dirty（未被 hook 吞掉）', status.split('\n').some((l) => l.endsWith('my-rules/INDEX.md'))],
];
writeFileSync(out, checks.map(([l, c]) => `${c ? 'PASS' : 'FAIL'}\t${l}`).join('\n') + '\n', 'utf8');
NODE_EOF
while IFS=$'\t' read -r st label; do
  if [ "$st" = "PASS" ]; then ok "⑫ $label"; else bad "⑫ $label"; fi
done <"$WORK/t9_2.txt"
# 提交后复算重建：默认 build 产物与提交树中的 index/BUDGET 字节一致（HEAD 锚定契约保持，CI 视角恒绿）
node "$BUILD_STUB" >/dev/null 2>&1
assert_eq "$(shasum -a 256 "$CR/ctx/index.json" | awk '{print $1}')" \
  "$(git -C "$CR" show HEAD:ctx/index.json | shasum -a 256 | awk '{print $1}')" \
  "⑫B 提交树 ctx/index.json 与 HEAD 复算重建字节一致"
assert_eq "$(shasum -a 256 "$CR/ctx/BUDGET.md" | awk '{print $1}')" \
  "$(git -C "$CR" show HEAD:ctx/BUDGET.md | shasum -a 256 | awk '{print $1}')" \
  "⑫B 提交树 ctx/BUDGET.md 与 HEAD 复算重建字节一致"

# 9.3 兜底：重建后再改暂存内容（竞态/人为破坏）→ --staged 终校验 FAIL；再次提交由 hook 自愈
git -C "$CR" reset -q --hard HEAD
rm -f "$CR/docs/staged-new.md"
node "$BUILD_STUB" >/dev/null 2>&1
printf '\n兜底场景改动（WXG-T-032 ⑤ 自测）。\n' >>"$CR/AGENTS.md"
git -C "$CR" add AGENTS.md
node "$BUILD_STUB" --staged-blobs >/dev/null 2>&1        # 复刻 hook 第一步：重建
git -C "$CR" add ctx/index.json ctx/BUDGET.md            # 复刻 hook 第二步：重新暂存
printf '重建之后暂存内容又被改动（竞态/人为破坏）。\n' >>"$CR/AGENTS.md"
git -C "$CR" add AGENTS.md
node "$CHECK_STUB" --staged >"$WORK/c9_3.txt" 2>&1
assert_eq "$?" "1" "⑫C 重建后再改暂存 .md（模拟竞态/破坏）→ --staged 兜底终校验 exit 1"
assert_contains "$(cat "$WORK/c9_3.txt")" "暂存内容与索引不一致" "⑫C 输出含「暂存内容与索引不一致」"
# 「手工改坏产物后暂存」变体：坏 index.json 暂存 + 有暂存 .md → 兜底终校验同样拦截
printf '{"broken": true' >"$CR/ctx/index.json"
git -C "$CR" add ctx/index.json
node "$CHECK_STUB" --staged >"$WORK/c9_3b.txt" 2>&1
assert_eq "$?" "1" "⑫C 手工改坏 ctx/index.json 并暂存 → --staged exit 1（不假绿）"
# 自愈：破坏状态下重新提交 → hook 主路径自动重建 → 兜底恒绿 → commit 成功
PATH="$WORK/bin:$PATH" git -C "$CR" \
  -c user.email=selftest@example.com -c user.name=selftest \
  commit -q -m "selftest: self-heal after tamper (WXG-T-032)" >"$WORK/c9_3c.txt" 2>&1
assert_eq "$?" "0" "⑫C 破坏状态下重新提交 → hook 自动重建自愈 → commit 成功"

# ── [10] 分窗轮转（WXG-T-037 R1）：ctx:rotate + metrics.cumulative + 累计口径硬门 ──
# 做法：在 $FAKEROOT 里造大文件与跨 2 根会话树的桩账本 + 带 lastMtime 的侧车，按窗口
#       轮转后逐项与手工计算比对；再在 $CR 验证 ctx:check 的累计口径 E1/E3 判定语义。
echo
echo "[10] ctx:rotate：树原子轮转 / 聚合手工核对 / 幂等 / 冻结重采 / 累计口径 E1+E3"
ROT_LEDGER="$WORK/rot-ledger.jsonl"
ROT_META="$WORK/rot-meta.json"
ROT_HIST="$FAKEROOT/ctx/savings-history.json"
ROTATE="$SCRIPT_DIR/rotate-reads-ledger.mjs"

# 10.1 造桩：docs/big.md（≥3000 估算 tok）+ 跨两棵根会话树的账本 + 侧车 lastMtime
awk 'BEGIN{for(i=1;i<=400;i++) printf "line %d of big file padding padding padding\n", i}' >"$FAKEROOT/docs/big.md"
node - "$FAKEROOT" "$ROT_LEDGER" "$ROT_META" "$WORK/rot-expected.json" "$SCRIPT_DIR" <<'NODE_EOF'
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const [root, ledgerOut, metaOut, expectedOut, scriptDir] = process.argv.slice(2);
const { estimateTokens } = await import('file://' + join(scriptDir, 'lib', 'context-tokens.mjs'));
const { r6 } = await import('file://' + join(scriptDir, 'lib', 'savings-history.mjs'));
const tokOf = (rel) => estimateTokens(readFileSync(join(root, rel), 'utf8'));
const ftokA = tokOf('docs/a.md');
const ftokB = tokOf('src/b.ts');
const ftokBig = tokOf('docs/big.md');
const ev = (o) => JSON.stringify({ ide: 'cursor', session: o.session, path: o.path, offset: o.offset ?? null, limit: o.limit ?? null, fullFile: o.fullFile ?? false, lines: o.lines, bytes: o.bytes ?? o.lines * 10, estTokens: o.est });
// 旧树 rrr-old（mtime 1000，最旧 → 被轮转）：s1 抖动组（5 次同文件小读）+ big 整读；s2 局部读
const rows = [];
for (let i = 1; i <= 5; i++) rows.push(ev({ session: 'rrr-old/s1', path: 'docs/a.md', offset: i, limit: 3, lines: 3, est: 10 }));
rows.push(ev({ session: 'rrr-old/s1', path: 'docs/big.md', fullFile: true, lines: 400, bytes: 400 * 40, est: ftokBig }));
rows.push(ev({ session: 'rrr-old/s2', path: 'src/b.ts', offset: 1, limit: 4, lines: 4, est: 5 }));
// 新树 rrr-new（mtime 8000–9000 → 保留在窗口内）：s3 两次局部读 + s4 一次局部读
rows.push(ev({ session: 'rrr-new/s3', path: 'src/b.ts', offset: 2, limit: 2, lines: 2, est: 4 }));
rows.push(ev({ session: 'rrr-new/s3', path: 'src/b.ts', offset: 5, limit: 2, lines: 2, est: 6 }));
rows.push(ev({ session: 'rrr-new/s4', path: 'docs/a.md', offset: 10, limit: 2, lines: 2, est: 8 }));
writeFileSync(ledgerOut, rows.join('\n') + '\n', 'utf8');
writeFileSync(metaOut, JSON.stringify({ version: 1, bySession: {
  'rrr-old/s1': { lastMtime: 1000 }, 'rrr-old/s2': { lastMtime: 1000 },
  'rrr-new/s3': { lastMtime: 9000 }, 'rrr-new/s4': { lastMtime: 8000 },
} }, null, 2) + '\n', 'utf8');
// 手工期望（仅 rrr-old 树被轮转的聚合）：
const oldPartial = [1 - 10 / ftokA, 1 - 10 / ftokA, 1 - 10 / ftokA, 1 - 10 / ftokA, 1 - 10 / ftokA, 1 - 5 / ftokB].map(r6).sort((a, b) => a - b);
const expected = {
  ftokA, ftokB, ftokBig,
  totalReads: 7, sessions: 2, savingsSamples: 7,
  sumActual: 5 * 10 + ftokBig + 5,
  sumFull: 5 * ftokA + ftokBig + ftokB,
  partialSavings: oldPartial,
  allSavings: [...oldPartial, 0].sort((a, b) => a - b),
  jitterGroupKeys: 1, jitterGroups: 1, jitterExcess: 2,
  bigFullReads: 1,
  // 第二轮（rrr-new 树也被轮转）后的累计 partial 样本：
  partialAfterSecond: [...oldPartial, 1 - 4 / ftokB, 1 - 6 / ftokB, 1 - 8 / ftokA].map(r6).sort((a, b) => a - b),
};
writeFileSync(expectedOut, JSON.stringify(expected, null, 2) + '\n', 'utf8');
NODE_EOF

# 10.2 轮转（窗口 3 会话：rrr-new 占 2，rrr-old 放不下 → 整树轮转，须 reason/taskId）
node "$ROTATE" --root="$FAKEROOT" --ledger="$ROT_LEDGER" --meta="$ROT_META" --history="$ROT_HIST" \
  --window-sessions=3 --reason="selftest 轮转 rrr-old" --task-id="WXG-T-037" >"$WORK/rot1.txt" 2>&1
assert_eq "$?" "0" "⑬A 轮转退出码 0"
assert_eq "$(grep -c '' "$ROT_LEDGER")" "3" "⑬A 轮转后账本 457→3 行（仅保留窗口内 rrr-new 树）"
if grep -q 'rrr-old' "$ROT_LEDGER"; then bad "⑬A 窗口外根会话 rrr-old 未移出账本"; else ok "⑬A 窗口外根会话 rrr-old 全部移出（树原子，无截断）"; fi
assert_eq "$(grep -c 'rrr-new' "$ROT_LEDGER")" "3" "⑬A 窗口内 rrr-new 树 3 行完整保留（会话不截断）"
assert_contains "$(cat "$WORK/rot1.txt")" "冻结入历史" "⑬A 输出标注树原子轮转（冻结入历史）"
assert_contains "$(cat "$WORK/rot1.txt")" "冻结聚合增量" "⑬A 输出含冻结聚合"

# 10.3 历史聚合与手工计算逐项一致（原始节省率样本数组 + 计数）
node - "$ROT_HIST" "$WORK/rot-expected.json" "$WORK/rot-check.txt" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
const [histP, expP, out] = process.argv.slice(2);
const h = JSON.parse(readFileSync(histP, 'utf8')).aggregate;
const e = JSON.parse(readFileSync(expP, 'utf8'));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const checks = [
  ['totalReads=7', h.totalReads === e.totalReads],
  ['sessions=2', h.sessions === e.sessions],
  ['savingsSamples=7', h.savingsSamples === e.savingsSamples],
  ['sumActual 一致', h.sumActual === e.sumActual],
  ['sumFull 一致', h.sumFull === e.sumFull],
  ['partialSavings 数组逐位一致（原始样本，可合并出分位数）', eq(h.partialSavings, e.partialSavings)],
  ['allSavings 数组逐位一致', eq(h.allSavings, e.allSavings)],
  ['jitter 组键/组/超限 = 2/1/2（s2 的小读也是独立 (session,path) 组键，未超限不计抖动）', h.jitterGroupKeys === 2 && h.jitterGroups === 1 && h.jitterExcess === 2],
  ['bigFullReads=1', h.bigFullReads === e.bigFullReads],
];
writeFileSync(out, checks.map(([l, c]) => `${c ? 'PASS' : 'FAIL'}\t${l}`).join('\n') + '\n', 'utf8');
NODE_EOF
while IFS=$'\t' read -r st label; do
  if [ "$st" = "PASS" ]; then ok "⑬B $label"; else bad "⑬B $label"; fi
done <"$WORK/rot-check.txt"
assert_contains "$(cat "$ROT_HIST")" "rrr-old" "⑬B archivedRootSessions 登记冻结根"

# 10.4 幂等：重复运行不丢数据、不重复聚合（账本与历史字节不变）
H1="$(shasum -a 256 "$ROT_LEDGER" | awk '{print $1}')$(shasum -a 256 "$ROT_HIST" | awk '{print $1}')"
node "$ROTATE" --root="$FAKEROOT" --ledger="$ROT_LEDGER" --meta="$ROT_META" --history="$ROT_HIST" --window-sessions=3 >/dev/null 2>&1
assert_eq "$?" "0" "⑬C 重复运行退出码 0"
H2="$(shasum -a 256 "$ROT_LEDGER" | awk '{print $1}')$(shasum -a 256 "$ROT_HIST" | awk '{print $1}')"
assert_eq "$H2" "$H1" "⑬C 幂等：重复运行账本与历史字节不变"

# 10.5 冻结语义：已冻结根会话被重采带回账本 → 再轮转时丢弃且不重复聚合
printf '%s\n' '{"ide":"cursor","session":"rrr-old/s2","path":"src/b.ts","offset":1,"limit":4,"fullFile":false,"lines":4,"bytes":40,"estTokens":5}' >>"$ROT_LEDGER"
node "$ROTATE" --root="$FAKEROOT" --ledger="$ROT_LEDGER" --meta="$ROT_META" --history="$ROT_HIST" --window-sessions=3 >/dev/null 2>&1
assert_eq "$?" "0" "⑬D 冻结重采行轮转退出码 0"
assert_eq "$(grep -c 'rrr-old' "$ROT_LEDGER")" "0" "⑬D 已冻结会话的行被移出账本"
assert_eq "$(grep -c '' "$ROT_LEDGER")" "3" "⑬D 账本回到 3 行（冻结行丢弃，不回流）"
H3="$(shasum -a 256 "$ROT_HIST" | awk '{print $1}')"
H4="$(shasum -a 256 "$WORK/rot-hist-snapshot.json" 2>/dev/null | awk '{print $1}')" || true
node -e 'console.log("1")' >/dev/null  # no-op keep shell happy
# 历史在 10.5 期间不应变化：与 10.4 末快照比对（10.4 后即 H1 中历史部分，重取当前即可——
# 这里直接验证 totalReads 仍为 7）
assert_eq "$(node -p "JSON.parse(require('fs').readFileSync('$ROT_HIST','utf8')).aggregate.totalReads")" "7" "⑬D 重复聚合被拒绝（totalReads 仍 7，不重复计入）"

# 10.6 窗口溢出须留痕：新树入窗把 rrr-new 挤出（窗口 2）→ 无 reason 拒绝；有 reason 成功
node - "$ROT_LEDGER" "$ROT_META" <<'NODE_EOF'
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
const [ledgerOut, metaOut] = process.argv.slice(2);
const row = JSON.stringify({ ide: 'cursor', session: 'rrr-newest/s5', path: 'docs/a.md', offset: null, limit: null, fullFile: true, lines: 40, bytes: 480, estTokens: 160 });
appendFileSync(ledgerOut, row + '\n', 'utf8');
const meta = JSON.parse(readFileSync(metaOut, 'utf8'));
meta.bySession['rrr-newest/s5'] = { lastMtime: 99999 };
writeFileSync(metaOut, JSON.stringify(meta, null, 2) + '\n', 'utf8');
NODE_EOF
node "$ROTATE" --root="$FAKEROOT" --ledger="$ROT_LEDGER" --meta="$ROT_META" --history="$ROT_HIST" --window-sessions=2 >"$WORK/rot-noreason.txt" 2>&1
assert_eq "$?" "1" "⑬E 真实轮转缺 reason/task-id → exit 1（留痕强制）"
node "$ROTATE" --root="$FAKEROOT" --ledger="$ROT_LEDGER" --meta="$ROT_META" --history="$ROT_HIST" \
  --window-sessions=2 --reason="selftest 轮转 rrr-new" --task-id="WXG-T-037" >"$WORK/rot2.txt" 2>&1
assert_eq "$?" "0" "⑬E 带 reason/task-id → 轮转成功"
assert_eq "$(grep -c '' "$ROT_LEDGER")" "1" "⑬E 窗口 2 会话：仅最新树 rrr-newest 保留（1 行）"
assert_eq "$(node -p "const h=JSON.parse(require('fs').readFileSync('$ROT_HIST','utf8'));h.aggregate.totalReads")" "10" "⑬E 历史累计 7+3=10（两轮轮转聚合合并）"
assert_eq "$(node -p "JSON.parse(require('fs').readFileSync('$ROT_HIST','utf8')).rotations.length")" "2" "⑬E rotations 留痕 2 条（reason/taskId 可追溯）"

# 10.7 窗口边界：会话数恰好填满窗口 → 整树保留、不轮转（空转）
printf '%s\n%s\n%s\n' \
  '{"ide":"cursor","session":"b2-new/s1","path":"docs/a.md","offset":1,"limit":2,"fullFile":false,"lines":2,"bytes":20,"estTokens":8}' \
  '{"ide":"cursor","session":"a2-old/s1","path":"docs/a.md","offset":2,"limit":2,"fullFile":false,"lines":2,"bytes":20,"estTokens":8}' \
  '{"ide":"cursor","session":"a2-old/s2","path":"src/b.ts","offset":3,"limit":2,"fullFile":false,"lines":2,"bytes":20,"estTokens":8}' \
  >"$WORK/rot-boundary.jsonl"
printf '%s' '{"version":1,"bySession":{"b2-new/s1":{"lastMtime":99999},"a2-old/s1":{"lastMtime":1000},"a2-old/s2":{"lastMtime":1000}}}' >"$WORK/rot-boundary-meta.json"
B1="$(shasum -a 256 "$WORK/rot-boundary.jsonl" | awk '{print $1}')"
node "$ROTATE" --root="$FAKEROOT" --ledger="$WORK/rot-boundary.jsonl" --meta="$WORK/rot-boundary-meta.json" \
  --history="$WORK/rot-boundary-hist.json" --window-sessions=3 >"$WORK/rot-boundary.txt" 2>&1
assert_eq "$?" "0" "⑬F 边界场景退出码 0"
assert_contains "$(cat "$WORK/rot-boundary.txt")" "空转" "⑬F 会话数恰好填满窗口（1+2=3）→ 空转，不轮转"
B2="$(shasum -a 256 "$WORK/rot-boundary.jsonl" | awk '{print $1}')"
assert_eq "$B2" "$B1" "⑬F 边界空转不落盘（账本字节不变，窗口边界会话不截断）"

# 10.8 ctx:usage 累计口径：metrics.cumulative = 窗口 ⊕ 历史，分位数与手工合并一致
node - "$ROT_LEDGER" "$ROT_META" <<'NODE_EOF'
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
const [ledgerOut, metaOut] = process.argv.slice(2);
// 窗口内留一个新根会话（1 次局部读），供「窗口小、历史大」的累计口径验证
const row = JSON.stringify({ ide: 'cursor', session: 'rrr-newest/s6', path: 'docs/a.md', offset: 20, limit: 2, fullFile: false, lines: 2, bytes: 20, estTokens: 12 });
appendFileSync(ledgerOut, row + '\n', 'utf8');
const meta = JSON.parse(readFileSync(metaOut, 'utf8'));
meta.bySession['rrr-newest/s6'] = { lastMtime: 100000 };
writeFileSync(metaOut, JSON.stringify(meta, null, 2) + '\n', 'utf8');
NODE_EOF
node "$ANALYZE" --root="$FAKEROOT" --ledger="$ROT_LEDGER" --index="$INDEX" \
  --out-json="$WORK/u-rot.json" --out-md="$WORK/m-rot.md" >"$WORK/analyze-rot.txt" 2>&1
assert_eq "$?" "0" "⑬G 轮转后 ctx:usage 退出码 0"
node - "$WORK/u-rot.json" "$WORK/rot-expected.json" "$WORK/rot-uc.txt" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
const [distP, expP, out] = process.argv.slice(2);
const d = JSON.parse(readFileSync(distP, 'utf8'));
const e = JSON.parse(readFileSync(expP, 'utf8'));
const c = d.metrics?.cumulative;
const pct = (sorted, p) => {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};
const merged = [...e.partialAfterSecond, 1 - 12 / e.ftokA].map(Number).sort((a, b) => a - b);
const checks = [
  ['metrics.cumulative 存在且 scope 标注累计', c?.scope === 'cumulative(window+history)'],
  ['cumulative.reads = 窗口 2 + 历史 10 = 12', c?.reads === 12],
  ['historyEvents=10 / historySessions 如实', c?.historyEvents === 10],
  ['累计 partial 样本 = 历史 9 + 窗口 1 = 10', c?.savings?.partialSamples === 10],
  ['累计 E1 中位数与手工合并一致', c?.savings?.medianPartial === Number(pct(merged, 0.5).toFixed(6))],
  ['累计 E1 P10 与手工合并一致', c?.savings?.p10Partial === Number(pct(merged, 0.1).toFixed(6))],
];
writeFileSync(out, checks.map(([l, c2]) => `${c2 ? 'PASS' : 'FAIL'}\t${l}`).join('\n') + '\n', 'utf8');
NODE_EOF
while IFS=$'\t' read -r st label; do
  if [ "$st" = "PASS" ]; then ok "⑬G $label"; else bad "⑬G $label"; fi
done <"$WORK/rot-uc.txt"

# 10.9 ctx:check 累计口径语义：E1/E3 判定与样本充足性走累计；硬门仍生效
node - "$CR" <<'NODE_EOF'
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const dist = {
  version: 1,
  samples: { sessions: 1, reads: 5, dropped: 0, unrecognized: 0, sessionsWithReadEvents: 1 },
  metrics: {
    est: true, reads: 5, sessions: 1, fullFileReads: 1, nonFullReads: 4, partialSamples: 4,
    savings: { samples: 5, overall: 0.5, median: 0.5, p10: 0.5, medianPartial: 0.6, p10Partial: 0.3 },
    jitter: { smallReadLines: 10, threshold: 3, groups: 0, excess: 0, groupKeys: 4, rate: 0 },
    bigFullReads: { thresholdTokens: 3000, count: 1, totalReads: 5, rate: 0.2 },
    cumulative: {
      scope: 'cumulative(window+history)', reads: 100, sessions: 5, historyEvents: 95, historySessions: 4,
      savings: { samples: 100, partialSamples: 60, sumActual: 1000, sumFull: 2000, overall: 0.5, median: 0.5, p10: 0.5, medianPartial: 0.7, p10Partial: 0.45 },
      jitter: { groups: 2, groupKeys: 20, excess: 5, rate: 0.1 },
      bigFullReads: { count: 3, totalReads: 40, rate: 0.075 },
    },
  },
  files: [],
};
writeFileSync(join(root, 'ctx/usage-distribution.json'), JSON.stringify(dist, null, 2) + '\n', 'utf8');
const bl = {
  version: 2, taskId: 'WXG-T-037', reason: 'selftest 累计口径基线', est: true,
  scope: 'cumulative(window+history)',
  sampleWindow: { since: null, until: null, note: 'selftest stub' },
  tolerance: { savings: '>2.0pt', rate: '>5.0pt', counts: '仅展示' },
  metrics: { medianPartial: 0.7, p10Partial: 0.45, jitterRate: 0.1, bigFullReadRate: 0.075, jitterGroups: 2, jitterExcess: 5, bigFullReads: 3 },
};
writeFileSync(join(root, 'ctx/savings-baseline.json'), JSON.stringify(bl, null, 2) + '\n', 'utf8');
NODE_EOF
node "$CHECK_STUB" >"$WORK/check-rotA.txt" 2>&1
assert_eq "$?" "0" "⑬H 累计口径与基线一致 → exit 0（窗口口径样本仅 5，未被误判不足）"
OUTRA="$(cat "$WORK/check-rotA.txt")"
assert_not_contains "$OUTRA" "样本不足" "⑬H 样本充足性按累计口径（100 ≥ 30），不误报样本不足"
assert_contains "$OUTRA" "累计口径" "⑬H E1/E3 判定行标注累计口径"
assert_contains "$OUTRA" "窗口口径 局部读" "⑬H 窗口口径数字如实并列展示"
set_baseline_metric p10Partial 0.9
node "$CHECK_STUB" >"$WORK/check-rotB.txt" 2>&1
assert_eq "$?" "1" "⑬H 累计口径 P10 劣于基线 → exit 1（E3 硬门在累计口径下依然成立）"
assert_contains "$(cat "$WORK/check-rotB.txt")" "劣于基线" "⑬H 输出含「劣于基线」诊断"
set_baseline_metric p10Partial 0.45

# ── [11] ROUTES 常驻体积硬门 + 常驻总量观察哨（WXG-T-039 R5）─────────────────────
# 做法：沿用 $CR 桩仓库（[10] 末已恢复 E1/E3 一致基线）。
#   ⑭A 低于上限（桩 ROUTES.md 为几行小文件）→ exit 0；A 项标题标注上限 7500（LIMITS.routesMd
#      单一真源）、A 项表含 ROUTES 行、常驻总量行出现；BUDGET.md §1 表（ctx:build 生成）
#      含同一 ROUTES 行（读数/上限/状态与门禁同源，无两处硬编码）。
#   ⑭B 超限：写入 ≈7740 估算 tok 的 ROUTES.md（故意卡在 7500 与 B 项 8000 之间，使失败
#      唯一归因 ROUTES 门）→ 提交 → HEAD 重建 → exit 1，诊断含「常驻体积 / 上限 7500 /
#      瘦身」修复指引；BUDGET.md 同步展示 ❌。
#   ⑭C 观察哨：只抬 index.json 各文件 token 读数（sha 不动 → C 门仍绿）到「均低于各自上限
#      但合计 14100 > 软阈 13500」→ 仍 exit 0，输出 ⚠️ + 「不阻断」；恢复后回到 exit 0。
echo
echo "[11] ctx:check A 项：ROUTES ≤ routesMd 硬门 / BUDGET.md 同源 / 常驻总量观察哨"

# 11.1 低于上限：exit 0 + A 项表 / BUDGET.md 同源
node "$CHECK_STUB" >"$WORK/c11_0.txt" 2>&1
assert_eq "$?" "0" "⑭A ROUTES 低于上限（桩为几行小文件）→ exit 0"
OUTA11="$(cat "$WORK/c11_0.txt")"
assert_contains "$OUTA11" "ctx/ROUTES.md ≤ 7500" "⑭A A 项标题标注 ROUTES 上限 7500（LIMITS.routesMd 单一真源）"
ROUTES_ROW_A="$(printf '%s\n' "$OUTA11" | grep -F '| ctx/ROUTES.md |' | head -1)"
case "$ROUTES_ROW_A" in
  *'| 7500 | ✅ |'*) ok "⑭A A 项表含 ROUTES 行（上限 7500 / ✅，读数为桩真实估算）";;
  *) bad "⑭A A 项表 ROUTES 行异常：[$ROUTES_ROW_A]";;
esac
assert_contains "$OUTA11" "常驻总量" "⑭A 输出含常驻总量观察哨行"
node "$BUILD_STUB" >/dev/null 2>&1
BUDGET_ROW="$(grep -F '| `ctx/ROUTES.md` |' "$CR/ctx/BUDGET.md" | head -1)"
case "$BUDGET_ROW" in
  *'| 7500 |'*'✅'*) ok "⑭A BUDGET.md §1 表 ROUTES 行与门禁同源（上限 7500 / ✅，读数同源）";;
  *) bad "⑭A BUDGET.md §1 表 ROUTES 行与门禁不同源：[$BUDGET_ROW]";;
esac
assert_contains "$(cat "$CR/ctx/BUDGET.md")" "常驻总量" "⑭A BUDGET.md 含常驻总量观察哨行"

# 11.2 超限 → exit 1 + 修复指引（桩 645 行 × 48 ASCII 字符 = 30960/4 ≈ 7740 tok ∈ (7500, 8000)）
awk 'BEGIN{for(i=1;i<=645;i++) printf "padding padding padding padding padding padding\n"}' >"$CR/ctx/ROUTES.md"
git -C "$CR" add ctx/ROUTES.md
git -C "$CR" -c user.email=selftest@example.com -c user.name=selftest \
  commit -q --no-verify -m "selftest: [11] ROUTES over-limit stub (WXG-T-039)" >/dev/null 2>&1
node "$BUILD_STUB" >/dev/null 2>&1
node "$CHECK_STUB" >"$WORK/c11_1.txt" 2>&1
assert_eq "$?" "1" "⑭B ROUTES 超限（≈7740 tok > 7500）→ exit 1（A 项硬门）"
OUTB11="$(cat "$WORK/c11_1.txt")"
assert_contains "$OUTB11" "ctx/ROUTES.md 常驻体积" "⑭B 诊断点名 ctx/ROUTES.md 常驻体积"
assert_contains "$OUTB11" "7500" "⑭B 诊断含上限 7500"
assert_contains "$OUTB11" "瘦身" "⑭B 诊断含「瘦身」修复指引（非调阈）"
assert_contains "$OUTB11" "| ctx/ROUTES.md | 7740 | 7500 | ❌ |" "⑭B A 项表 ROUTES 行标 ❌"
BUDGET_ROW_OVER="$(grep -F '| `ctx/ROUTES.md` |' "$CR/ctx/BUDGET.md" | head -1)"
case "$BUDGET_ROW_OVER" in
  *'| 7740 |'*'| 7500 |'*'❌'*) ok "⑭B BUDGET.md §1 表同步展示 ❌（与门禁同源）";;
  *) bad "⑭B BUDGET.md §1 表未同步展示超限：[$BUDGET_ROW_OVER]";;
esac
# 回滚超限桩提交与其连带重建的产物（BUILD_STUB 在提交后又改写过 index/BUDGET，
# reset --hard 一并归位到 [9] 末的产物不动点），给 ⑭C 一个干净基线。
# 注意：reset --hard 会把 [9] 遗留的 tracked-but-deleted 桩 docs/staged-new.md 复原到磁盘
# （它在 self-heal 提交树里、却不在其重建索引里）→ C 门「未收录」；rm 复现 [10] 末的
# 磁盘状态（tracked-deleted，C 门不扫描磁盘上不存在的文件）。
git -C "$CR" reset -q --hard HEAD~1
rm -f "$CR/docs/staged-new.md"

# 11.3 常驻总量观察哨：合计 14100 > 软阈 13500，但各文件均低于各自上限 → exit 0 仅 ⚠️
node - "$CR" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const p = join(root, 'ctx/index.json');
const idx = JSON.parse(readFileSync(p, 'utf8'));
// 只改 tokens 读数、不动 sha256 → C 门仍绿；A 门判定读同一字段。
const bump = {
  'AGENTS.md': 1900,           // ≤ 2000
  'my-rules/INDEX.md': 450,    // ≤ 500
  'my-rules/agents-md.md': 450,
  'ctx/hot-files.md': 3900,    // ≤ 4000
  'ctx/ROUTES.md': 7400,       // ≤ 7500
};
for (const f of idx.files) if (bump[f.path] != null) f.tokens = bump[f.path];
writeFileSync(p, JSON.stringify(idx, null, 2) + '\n', 'utf8');
NODE_EOF
node "$CHECK_STUB" >"$WORK/c11_2.txt" 2>&1
assert_eq "$?" "0" "⑭C 各文件均低于各自上限、仅总量超软阈 → 仍 exit 0（观察哨不阻断）"
OUTC11="$(cat "$WORK/c11_2.txt")"
assert_contains "$OUTC11" "14100 tokens（观察哨软阈值 ≤ 13500）⚠️" "⑭C 常驻总量行如实展示 14100 > 13500 并标 ⚠️"
assert_contains "$OUTC11" "不阻断" "⑭C 观察哨提示声明不阻断（硬阻断只挂单文件门）"
git -C "$CR" checkout -q -- ctx/index.json
node "$CHECK_STUB" >/dev/null 2>&1
assert_eq "$?" "0" "⑭C 恢复 index.json 后回到 exit 0"

# ── 汇总 ────────────────────────────────────────────────────────────────────
echo
echo "=================================================================="
echo "结果：PASS=$PASS  FAIL=$FAIL"
echo "=================================================================="
[ "$FAIL" -eq 0 ]
