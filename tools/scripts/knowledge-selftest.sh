#!/usr/bin/env bash
# knowledge-selftest.sh — 知识库生命周期（ledger / 归档 / 重新激活 / 索引面）本地桩自测（WXG-T-029）。
#
# 目的：在**不触碰真实知识库**的前提下，端到端验证 kb:* 脚本组 + ctx 索引面排除。
# 做法：在临时目录里造**假仓库 + 假知识库 + 假读事件账本**，把 kb-*.mjs 与 lib/ 拷进
#       <fakeroot>/tools/scripts/（脚本 ROOT 由自身 URL 推导 → 指向 fakeroot），核对：
#         ① 补号：无 ID 的存量条目按文件内顺序补 K-001…（跨两文件连续），**正文与顺序不变**
#         ② kb:check exit 0（活跃/归档/INDEX/SKIP_DIRS/thresholds 全一致）
#         ③ kb:collect：区间归属（offset/limit 与条目区间求交）+ **同会话去重**（S1 反复读只计 1）
#            + **seen 持久去重 → 幂等**（同账本连跑两次计数不变、ledger 字节不变）
#            + **--dry-run**（预演新逻辑、不写盘）
#         ④ kb:touch：两种模式（--task 记 touch:<task>；无 --task 记 touch:<date>）；
#            且**同步写 seen**（显式动作主体 `touch:…#<日>`）→ accessCount === seen.length
#         ④b 关键回归：kb:touch 之后跑 kb:collect —— touch 写入的 seen **不影响**采集判重
#            （新会话读同条目仍被正确计入，不因 touch 的 seen 被误判为「已计过」而漏计）
#         ⑤ 归档搬移：--reason 必填负例；正例搬到 archive/*、原文件删除、ledger 置 archived
#         ⑥ 重新激活：搬回原文件并保持类别分区；accessCount 保留 +1；**同步写 seen**；archive 文件删除
#         ⑦ 相似度命中：活跃 vs 归档 Jaccard ≥ 0.34 → audit 报「疑似重复」
#         ⑧ kb:check 负例：孤儿 ledger 条目 / 重复 ID / INDEX 活跃块不一致 → exit 1
#         ⑨ 索引面排除：archive/** 不入 ctx/index.json；kb:check ③ 断言 SKIP_DIRS 含 archive
#         ⑩ 旧 ledger 兼容：无 seen 字段 → kb:collect 不报错、不重置既有访问数据
#         ⑪ kb:check ⑥：accessCount ↔ seen **对所有条目严格**一致（豁免分支已删）：
#            普通条目 count≠seen → FAIL；**含 touch 来源**的条目 count≠seen **同样 FAIL**
#         ⑫ 沉淀统计（WXG-T-029 追加范围）：sync 现算「新增/修改」并打印统计区块 + 追加 events；
#            **无变化重跑 → 不追加 event、统计为空、ledger 字节不变**（幂等）；
#            改正文未 sync → kb:check ⑧ FAIL，sync 后 contentHash 更新且恢复 0
#         ⑬ 归档 / 激活各一次 → events 追加 archived / reactivated；kb:sync（同日）汇总显示两类
#         ⑭ CHANGELOG.md：由 sync 生成，含本次四类变更（added/updated/reactivated/archived）
#         ⑮ kb:check ⑦ 负例：伪造不存在的 ID / 非法 kind → FAIL；⑧ 负例见 ⑫（改正文不跑 sync）
#         ⑯ 索引面收录：ctx:build 后 knowledge/CHANGELOG.md 在 ctx/index.json 内
#         ⑰ 撞号回归：删掉 ledger.json 后 sync —— 新条目**不复用**既有行内 ID
#            （nextId 下界 = 既有最大 ID + 1；否则「新增」会被误判成「修改」且 ① ID 重复）
#
# 用法：tools/scripts/knowledge-selftest.sh
# 产物：仅 stdout 报告；临时目录退出时清理，不污染仓库 / 真实知识库。

set -uo pipefail
# 刻意不用 set -e —— 需要捕获被测脚本的各种退出码。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/wxg-kb-selftest.XXXXXX")"
REPO="$WORK/repo"
PASS=0
FAIL=0

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

ok()  { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
assert_eq() { if [ "$1" = "$2" ]; then ok "$3（=$1）"; else bad "$3：期望 [$2]，实际 [$1]"; fi; }
assert_contains() { case "$1" in *"$2"*) ok "$3";; *) bad "$3：输出中找不到 [$2]";; esac; }
assert_not_contains() { case "$1" in *"$2"*) bad "$3：输出中不应出现 [$2]";; *) ok "$3";; esac; }
assert_file_has() { if grep -qF -- "$2" "$1"; then ok "$3"; else bad "$3：$1 中找不到 [$2]"; fi; }
assert_file_not() { if grep -qF -- "$2" "$1"; then bad "$3：$1 中不应出现 [$2]"; else ok "$3"; fi; }

# 运行被测脚本，回显退出码（输出进 $WORK/last.txt）
run() { "$@" >"$WORK/last.txt" 2>&1; echo $?; }

# 读 ledger 某条目的字段
ld() {
  node -e 'const j=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));const e=j.entries.find(x=>x.id===process.argv[2]);process.stdout.write(e?String(e[process.argv[3]]):"<none>")' \
    "$REPO/knowledge/ledger.json" "$1" "$2"
}
# 读 ledger 某条目 accessSources（逗号连接）
ldsrc() {
  node -e 'const j=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));const e=j.entries.find(x=>x.id===process.argv[2]);process.stdout.write(e?[].concat(e.accessSources||[]).join(","):"<none>")' \
    "$REPO/knowledge/ledger.json" "$1"
}
# 读 ledger 某条目 seen 数组长度
ldseen() {
  node -e 'const j=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));const e=j.entries.find(x=>x.id===process.argv[2]);process.stdout.write(String(Array.isArray(e&&e.seen)?e.seen.length:0))' \
    "$REPO/knowledge/ledger.json" "$1"
}
num() { grep -F -- "$1" "$2" | head -1 | sed -E 's/.*：([0-9]+).*/\1/'; }
# 读 ledger events 数组长度
ldevn() {
  node -e 'const j=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(Array.isArray(j.events)?j.events.length:0))' \
    "$REPO/knowledge/ledger.json"
}
# 读某 kind 的 event 条数
ldevkind() {
  node -e 'const j=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));const k=process.argv[2];process.stdout.write(String((Array.isArray(j.events)?j.events:[]).filter(e=>e&&e.kind===k).length))' \
    "$REPO/knowledge/ledger.json" "$1"
}
# 读最近一条某 kind 的 event 的 ids（逗号连接）
ldevids() {
  node -e 'const j=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));const k=process.argv[2];const es=(Array.isArray(j.events)?j.events:[]).filter(e=>e&&e.kind===k);const e=es[es.length-1];process.stdout.write(e?[].concat(e.ids||[]).join(","):"<none>")' \
    "$REPO/knowledge/ledger.json" "$1"
}
# contentHash 长度（0 = 缺失 / 空）
ldhashlen() {
  node -e 'const j=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));const e=j.entries.find(x=>x.id===process.argv[2]);process.stdout.write(String(e&&typeof e.contentHash==="string"?e.contentHash.length:0))' \
    "$REPO/knowledge/ledger.json" "$1"
}

echo "=================================================================="
echo "WXG-T-029 知识库生命周期（kb:*）本地桩自测"
echo "脚本目录: $SCRIPT_DIR"
echo "工作目录: $WORK"
echo "=================================================================="

# ── 造「假仓库 + 假知识库」───────────────────────────────────────────────────
mkdir -p "$REPO/tools/scripts/lib" "$REPO/knowledge" "$REPO/ctx"
cp "$SCRIPT_DIR"/kb-*.mjs "$REPO/tools/scripts/"
cp "$LIB_DIR"/*.mjs "$REPO/tools/scripts/lib/"
cp "$SCRIPT_DIR/build-context-index.mjs" "$REPO/tools/scripts/"

node - "$REPO" <<'NODE_EOF'
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const w = (rel, text) => { const p = join(root, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, text, 'utf8'); };

w('knowledge/lessons.md',
`# lessons.md — 教训库（桩）

## 工具链

- **[工具链] 桩教训一：foo bar baz**（来源 WXG-T-901，2026-01-01）
  现象：p1。
  根因：r1。
  规避：a1。

## 流程

- **[流程] 桩教训二：qux quux**（来源 WXG-T-902，2026-01-02）
  现象：p2。
  根因：r2。
`);

w('knowledge/patterns.md',
`# patterns.md — 模式库（桩）

## 数值与真源

- **桩模式一：alpha beta**
  正文一。

## 流程

- **桩模式二：gamma**
  正文二。
`);

w('knowledge/INDEX.md',
`# knowledge/ — 桩知识库

## 1. 说明

桩。

## 5. 活跃条目（自动生成）

<!-- kb:active:start（由 pnpm run kb:sync 生成，勿手改）-->
<!-- kb:active:end -->
`);
NODE_EOF
echo "已生成桩仓库：$REPO"

KB_SYNC="$REPO/tools/scripts/kb-sync.mjs"
KB_COLLECT="$REPO/tools/scripts/kb-collect.mjs"
KB_TOUCH="$REPO/tools/scripts/kb-touch.mjs"
KB_AUDIT="$REPO/tools/scripts/kb-audit.mjs"
KB_ARCHIVE="$REPO/tools/scripts/kb-archive.mjs"
KB_REACTIVATE="$REPO/tools/scripts/kb-reactivate.mjs"
KB_CHECK="$REPO/tools/scripts/kb-check.mjs"
CTX_BUILD="$REPO/tools/scripts/build-context-index.mjs"

# ── [1] 补号：ID 分配 + 正文/顺序不变 ───────────────────────────────────────
echo
echo "[1] kb:sync 补号（lessons → patterns 连续编号；正文与顺序不变）"
cp "$REPO/knowledge/lessons.md" "$WORK/lessons.orig"
cp "$REPO/knowledge/patterns.md" "$WORK/patterns.orig"
rc=$(run node "$KB_SYNC")
assert_eq "$rc" "0" "kb:sync 退出码 0"
assert_eq "$(ld K-001 id)" "K-001" "K-001 已分配"
assert_eq "$(ld K-004 state)" "active" "K-004 为 active"
assert_eq "$(ld K-004 category)" "流程" "K-004 类别取自 patterns 的 H2 分区"
assert_eq "$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).nextId)' "$REPO/knowledge/ledger.json")" "5" "nextId=5（4 条已占用）"
# 首次运行（ledger 不存在）：4 条**全部视为 added**（合并为 1 条 event）；并写入 contentHash
assert_eq "$(ldevn)" "1" "首次运行 events=1（4 条合并为一条 added）"
assert_eq "$(ldevkind added)" "1" "events 首条 kind=added"
assert_eq "$(ldevids added)" "K-001,K-002,K-003,K-004" "added event 的 ids 覆盖全部 4 条（按 ID 升序）"
assert_eq "$(ldhashlen K-001)" "64" "K-001 已写入 contentHash（sha256 hex，64 字符）"
assert_eq "$(ldhashlen K-004)" "64" "K-004 已写入 contentHash（sha256 hex，64 字符）"
assert_file_has "$REPO/knowledge/lessons.md" "- **[工具链][K-001] 桩教训一" "lessons 标题行：类别后紧跟 [K-001]"
assert_file_has "$REPO/knowledge/patterns.md" "- **[K-003] 桩模式一：alpha beta**" "patterns 标题行：** 后 [K-003]（无行内类别）"
# 正文与顺序不变（非标题行逐字节一致）
if diff <(grep -v '^- \*\*' "$WORK/lessons.orig") <(grep -v '^- \*\*' "$REPO/knowledge/lessons.md") >/dev/null; then
  ok "lessons 正文（非标题行）逐字节不变"
else
  bad "lessons 正文被改动"
fi
if diff <(grep -v '^- \*\*' "$WORK/patterns.orig") <(grep -v '^- \*\*' "$REPO/knowledge/patterns.md") >/dev/null; then
  ok "patterns 正文（非标题行）逐字节不变"
else
  bad "patterns 正文被改动"
fi
# 标题顺序不变（仅插入 ID）：把补号后的标题行「去 ID」后应与原文件逐行一致
if diff <(grep '^- \*\*' "$WORK/lessons.orig") \
        <(grep '^- \*\*' "$REPO/knowledge/lessons.md" | sed -E 's/\]\[K-[0-9]+\]/]/; s/\*\*\[K-[0-9]+\]/\*\*/') >/dev/null; then
  ok "lessons 标题顺序与原有文本不变（仅插入 ID）"
else
  bad "lessons 标题文本/顺序被改动"
fi

# ── [2] kb:check 通过 ───────────────────────────────────────────────────────
echo
echo "[2] kb:check（全一致 → exit 0）"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "kb:check exit 0"
assert_contains "$(cat "$WORK/last.txt")" "PASSED" "kb:check 输出 PASSED"
cp "$REPO/knowledge/ledger.json" "$WORK/ledger.clean.json"

# ── [3] kb:collect：区间归属 + 同会话去重 ───────────────────────────────────
echo
echo "[3] kb:collect：offset/limit 区间归属 + 同会话去重（S1 反复读只计 1）"
node - "$REPO" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const L = readFileSync(join(root, 'knowledge/lessons.md'), 'utf8').split('\n');
const k1 = L.findIndex((l) => l.includes('[K-001]')) + 1; // 1-based
const k2 = L.findIndex((l) => l.includes('[K-002]')) + 1;
const ev = (o) => JSON.stringify(o);
const lines = [
  // S1 读 K-001 标题行（区间命中）
  ev({ ide: 'cursor', session: 'S1', path: 'knowledge/lessons.md', offset: k1, limit: 1, fullFile: false, lines: 1, bytes: 10, estTokens: 5 }),
  // S1 重复读同一区间 → 同 (session,条目) 去重
  ev({ ide: 'cursor', session: 'S1', path: 'knowledge/lessons.md', offset: k1, limit: 1, fullFile: false, lines: 1, bytes: 10, estTokens: 5 }),
  // S2 读同一区间 → 不同会话，计数
  ev({ ide: 'workbuddy', session: 'S2', path: 'knowledge/lessons.md', offset: k1, limit: 1, fullFile: false, lines: 1, bytes: 10, estTokens: 5 }),
  // S1 读 K-002 标题行
  ev({ ide: 'cursor', session: 'S1', path: 'knowledge/lessons.md', offset: k2, limit: 1, fullFile: false, lines: 1, bytes: 10, estTokens: 5 }),
  // 非活跃条目文件（INDEX.md）→ 跳过
  ev({ ide: 'cursor', session: 'S3', path: 'knowledge/INDEX.md', offset: null, limit: null, fullFile: true, lines: 1, bytes: 1, estTokens: 1 }),
  // S1 整文件读 → K-001/K-002 均已在 S1 计入 → 去重 +0
  ev({ ide: 'workbuddy', session: 'S1', path: 'knowledge/lessons.md', offset: null, limit: null, fullFile: true, lines: 20, bytes: 500, estTokens: 200 }),
  // 仓库外路径 → 完全忽略
  ev({ ide: 'workbuddy', session: 'S9', path: '/etc/hosts', offset: null, limit: null, fullFile: true, lines: 1, bytes: 1, estTokens: 1 }),
];
writeFileSync(join(root, 'ctx/reads-ledger.jsonl'), lines.join('\n') + '\n', 'utf8');
NODE_EOF
rc=$(run node "$KB_COLLECT")
assert_eq "$rc" "0" "kb:collect 退出码 0"
assert_eq "$(num '识别到 knowledge/*.md 读事件' "$WORK/last.txt")" "6" "识别 knowledge/*.md 读事件 6（除仓库外那 1 条）"
assert_eq "$(num '归属并计数（同会话去重后）' "$WORK/last.txt")" "3" "归属计数 3（K-001:S1、K-001:S2、K-002:S1）"
assert_eq "$(ld K-001 accessCount)" "2" "K-001 accessCount=2（S1 去重后 + S2）"
assert_eq "$(ld K-002 accessCount)" "1" "K-002 accessCount=1"
assert_eq "$(ld K-003 accessCount)" "0" "K-003 未被读 → 0"
case "$(ldsrc K-001)" in *"ledger:"*) ok "K-001 accessSources 含 ledger:<运行日>";; *) bad "K-001 缺 ledger 来源标签";; esac
# seen 持久去重日志：长度应与采集计数一致
assert_eq "$(ldseen K-001)" "2" "K-001 seen 长度=2（S1、S2）"
assert_eq "$(ldseen K-002)" "1" "K-002 seen 长度=1（S1）"
assert_eq "$(ldseen K-003)" "0" "K-003 未被读 → seen=0"

# ── [3b] kb:collect 幂等：同账本连跑第二次 → 计数与 seen 不变、不写盘（字节稳定）──
echo
echo "[3b] kb:collect 幂等：连跑第二次归属=0、计数/ seen 不变、ledger 字节不变"
cp "$REPO/knowledge/ledger.json" "$WORK/ledger.after1.json"
rc=$(run node "$KB_COLLECT")
assert_eq "$rc" "0" "kb:collect 第二次退出码 0"
assert_eq "$(num '归属并计数（同会话去重后）' "$WORK/last.txt")" "0" "第二次归属计数=0（全部命中 seen）"
assert_eq "$(ld K-001 accessCount)" "2" "幂等后 K-001 accessCount 仍=2（未膨胀）"
assert_eq "$(ld K-002 accessCount)" "1" "幂等后 K-002 accessCount 仍=1（未膨胀）"
assert_eq "$(ldseen K-001)" "2" "幂等后 K-001 seen 仍=2"
assert_eq "$(ldseen K-002)" "1" "幂等后 K-002 seen 仍=1"
if cmp -s "$WORK/ledger.after1.json" "$REPO/knowledge/ledger.json"; then
  ok "幂等：ledger 字节不变（attributed=0 → 未重复写盘）"
else
  bad "幂等：ledger 被改动（应字节不变）"
fi

# ── [3c] kb:collect --dry-run：预演新逻辑但不写盘 ───────────────────────────
echo
echo "[3c] kb:collect --dry-run：预演新 (会话,条目) 计入但**不写盘**"
cp "$REPO/knowledge/ledger.json" "$WORK/ledger.beforedry.json"
node - "$REPO" <<'NODE_EOF'
import { readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const L = readFileSync(join(root, 'knowledge/lessons.md'), 'utf8').split('\n');
const k2 = L.findIndex((l) => l.includes('[K-002]')) + 1; // 1-based
// 追加一个**新会话** S5 读 K-002 标题行（旧会话都不含 S5 → 应被计入）
appendFileSync(join(root, 'ctx/reads-ledger.jsonl'),
  JSON.stringify({ ide: 'workbuddy', session: 'S5', path: 'knowledge/lessons.md', offset: k2, limit: 1, fullFile: false, lines: 1, bytes: 10, estTokens: 5 }) + '\n',
  'utf8');
NODE_EOF
rc=$(run node "$KB_COLLECT" --dry-run)
assert_eq "$rc" "0" "kb:collect --dry-run 退出码 0"
assert_contains "$(cat "$WORK/last.txt")" "--dry-run" "--dry-run 输出标注未写盘"
assert_eq "$(num '归属并计数（同会话去重后）' "$WORK/last.txt")" "1" "--dry-run 预演：S5 读 K-002 计 1"
if cmp -s "$WORK/ledger.beforedry.json" "$REPO/knowledge/ledger.json"; then
  ok "--dry-run 未写盘（ledger 字节不变）"
else
  bad "--dry-run 竟写入 ledger"
fi
# 真跑一次：S5 计入 → K-002 accessCount +1、seen +1
rc=$(run node "$KB_COLLECT")
assert_eq "$rc" "0" "真跑（S5）退出码 0"
assert_eq "$(ld K-002 accessCount)" "2" "真跑后 K-002 accessCount=2（S5 计入）"
assert_eq "$(ldseen K-002)" "2" "真跑后 K-002 seen=2（S1、S5）"

# ── [4] kb:touch：两种模式 + 同步写 seen（显式动作留痕）────────────────────
echo
echo "[4] kb:touch：--task 记 touch:<task>；无 --task 记 touch:<date>；并 +1 seen"
rc=$(run node "$KB_TOUCH" K-001 --date=2026-02-01 --task=WXG-T-099)
assert_eq "$rc" "0" "kb:touch（带 --task）退出码 0"
assert_eq "$(ld K-001 accessCount)" "3" "K-001 accessCount=3"
assert_eq "$(ldseen K-001)" "3" "K-001 seen=3（含 1 条 touch 显式动作主体）"
assert_eq "$(ld K-001 lastAccess)" "2026-02-01" "K-001 lastAccess=--date"
case "$(ldsrc K-001)" in *"touch:WXG-T-099"*) ok "K-001 accessSources 含 touch:WXG-T-099";; *) bad "K-001 缺 touch:<task> 标签";; esac
# seen 元素格式：显式动作主体保留观测日 `touch:<task>#<YYYY-MM-DD>`
case "$(node -e 'const j=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));const e=j.entries.find(x=>x.id==="K-001");process.stdout.write((e.seen||[]).join("\n"))' "$REPO/knowledge/ledger.json")" in
  *"touch:WXG-T-099#2026-02-01"*) ok "K-001 seen 含 touch:WXG-T-099#2026-02-01（主体#观测日）";;
  *) bad "K-001 seen 缺 touch 显式动作条目（期望格式 主体#观测日）";;
esac
rc=$(run node "$KB_TOUCH" K-002 --date=2026-02-02)
assert_eq "$rc" "0" "kb:touch（无 --task）退出码 0"
assert_eq "$(ld K-002 accessCount)" "3" "K-002 accessCount=3"
assert_eq "$(ldseen K-002)" "3" "K-002 seen=3（含 1 条 touch 显式动作主体）"
assert_eq "$(ld K-002 lastAccess)" "2026-02-02" "K-002 lastAccess=--date"
case "$(ldsrc K-002)" in *"touch:2026-02-02"*) ok "K-002 accessSources 含 touch:<date>";; *) bad "K-002 缺 touch:<date> 标签";; esac
# touch 后 ⑥ 仍成立（accessCount === seen.length）
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "kb:touch 后 kb:check exit 0（⑥ 对所有条目严格成立）"

# ── [4b] 关键回归：touch 写入的 seen **不影响** kb:collect 判重 ──────────────
echo
echo "[4b] 关键回归：kb:touch 后跑 kb:collect —— 采集判重按会话主体仍正确（不因 touch 的 seen 漏计）"
# K-001 现 accessCount=3、seen=3（含 1 条 touch:WXG-T-099#2026-02-01）
# 追加一个**新会话 S6** 读 K-001 → 应被正常计入（touch 的 seen 不得使它被跳过）
node - "$REPO" <<'NODE_EOF'
import { readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const L = readFileSync(join(root, 'knowledge/lessons.md'), 'utf8').split('\n');
const k1 = L.findIndex((l) => l.includes('[K-001]')) + 1; // 1-based
appendFileSync(join(root, 'ctx/reads-ledger.jsonl'),
  JSON.stringify({ ide: 'cursor', session: 'S6', path: 'knowledge/lessons.md', offset: k1, limit: 1, fullFile: false, lines: 1, bytes: 10, estTokens: 5 }) + '\n',
  'utf8');
NODE_EOF
rc=$(run node "$KB_COLLECT")
assert_eq "$rc" "0" "kb:collect（touch 之后）退出码 0"
assert_eq "$(num '归属并计数（同会话去重后）' "$WORK/last.txt")" "1" "S6 新会话读 K-001 被计入 1（未被 touch 的 seen 误判为「已计过」）"
assert_eq "$(ld K-001 accessCount)" "4" "K-001 accessCount=4（touch 的 3 + S6 采集 1）"
assert_eq "$(ldseen K-001)" "4" "K-001 seen=4（与 accessCount 严格相等）"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "回归后 kb:check exit 0（⑥ 仍成立）"

# ── [5] 归档：--reason 必填负例 + 正例 ──────────────────────────────────────
echo
echo "[5] kb:archive：--reason 必填（负例）+ 归档搬移（正例）"
rc=$(run node "$KB_ARCHIVE" --ids=K-003)
assert_eq "$rc" "2" "缺 --reason → exit 2（负例）"
assert_contains "$(cat "$WORK/last.txt")" "--reason 必填" "负例诊断点名 --reason 必填"
assert_file_has "$REPO/knowledge/patterns.md" "[K-003]" "负例后 K-003 仍在活跃文件"
rc=$(run node "$KB_ARCHIVE" --ids=K-003 --date=2026-03-01 --reason="桩测试：长期未访问")
assert_eq "$rc" "0" "kb:archive（带 --reason）退出码 0"
assert_file_not "$REPO/knowledge/patterns.md" "[K-003]" "K-003 已从活跃文件删除"
assert_file_has "$REPO/knowledge/archive/patterns-archived.md" "[K-003] 桩模式一：alpha beta" "K-003 搬到 patterns-archived.md"
assert_file_has "$REPO/knowledge/archive/patterns-archived.md" "> 归档于 2026-03-01（原因：桩测试：长期未访问）" "归档元信息行正确"
assert_eq "$(ld K-003 state)" "archived" "ledger：K-003 state=archived"
assert_eq "$(ld K-003 archiveReason)" "桩测试：长期未访问" "ledger：archiveReason 已记"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "归档后 kb:check exit 0"
assert_not_contains "$(sed -n '/kb:active:start/,/kb:active:end/p' "$REPO/knowledge/INDEX.md")" "K-003" "K-003 不再出现在 INDEX 活跃块"
assert_file_has "$REPO/knowledge/archive/INDEX.md" "K-003" "archive/INDEX.md 含 K-003"

# ── [6] 重新激活：搬回原文件 + 访问数据保留 +1 + 同步写 seen ────────────────
echo
echo "[6] kb:reactivate：搬回原文件（类别分区）+ accessCount 保留 +1 + 同步写 seen"
rc=$(run node "$KB_REACTIVATE" --ids=K-003 --date=2026-03-02 --reason="重新激活")
assert_eq "$rc" "0" "kb:reactivate 退出码 0"
assert_file_has "$REPO/knowledge/patterns.md" "[K-003] 桩模式一：alpha beta" "K-003 已回到 patterns.md"
assert_file_not "$REPO/knowledge/archive/patterns-archived.md" "[K-003]" "K-003 已从归档文件删除"
assert_eq "$(ld K-003 state)" "active" "ledger：K-003 state=active"
assert_eq "$(ld K-003 accessCount)" "1" "accessCount 保留(0)+1 = 1"
assert_eq "$(ldseen K-003)" "1" "seen=1（reactivate 显式动作同步写 seen，accessCount===seen.length）"
case "$(ldsrc K-003)" in *"reactivate:2026-03-02"*) ok "accessSources 含 reactivate:<日期>";; *) bad "缺 reactivate 来源标签";; esac
# 保持类别分区：K-003 位于 patterns.md「## 流程」之前（数值与真源分区末尾）
node -e '
const fs=require("node:fs");
const lines=fs.readFileSync(process.argv[1],"utf8").split("\n");
const i3=lines.findIndex(l=>l.includes("[K-003]"));
const fl=lines.findIndex(l=>l.startsWith("## 流程"));
process.exit(i3>-1 && fl>-1 && i3<fl ? 0 : 1);
' "$REPO/knowledge/patterns.md" && ok "K-003 位于「数值与真源」分区末尾（保持类别分区）" || bad "K-003 未回到原类别分区"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "重新激活后 kb:check exit 0"

# ── [7] 相似度命中：活跃 vs 归档 Jaccard ≥ 0.34 ─────────────────────────────
echo
echo "[7] kb:audit 相似命中：新增条目命中归档 → 「疑似重复」"
rc=$(run node "$KB_ARCHIVE" --ids=K-003 --date=2026-03-03 --reason="再次归档以便测相似命中")
assert_eq "$rc" "0" "先归档 K-003"
# 追加一条与 K-003 同标题的新活跃条目
node - "$REPO" <<'NODE_EOF'
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
appendFileSync(join(process.argv[2], 'knowledge/patterns.md'), '\n- **桩模式一：alpha beta**：新增条目命中归档，待合并。\n  正文新增。\n', 'utf8');
NODE_EOF
rc=$(run node "$KB_SYNC")
assert_eq "$rc" "0" "kb:sync 为新条目补号"
assert_eq "$(ld K-005 state)" "active" "新条目分到 K-005（nextId 递增不回收）"
rc=$(run node "$KB_AUDIT" --today=2026-03-03)
assert_eq "$rc" "0" "kb:audit 退出码 0"
assert_contains "$(cat "$WORK/last.txt")" "疑似重复" "audit 报「疑似重复」"
assert_contains "$(cat "$WORK/last.txt")" "K-003" "相似命中点名归档条目 K-003"

# ── [8] kb:check 负例：孤儿 / 重复 ID / INDEX 不一致 ────────────────────────
echo
echo "[8] kb:check 负例（exit 1 + 中文诊断）"
cp "$REPO/knowledge/ledger.json" "$WORK/ledger.pre8.json"
cp "$REPO/knowledge/INDEX.md" "$WORK/index.pre8.md"

# 8a 孤儿 ledger 条目（active 但 md 中不存在）
node -e 'const fs=require("node:fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));j.entries.push({id:"K-099",state:"active",file:"knowledge/lessons.md",category:"工具链",title:"孤儿",sourceTask:null,addedDate:null,lastAccess:null,accessCount:0,accessSources:[],archivedDate:null,archiveReason:null,reactivatedDate:null});fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$REPO/knowledge/ledger.json"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "1" "① 孤儿条目 → exit 1"
assert_contains "$(cat "$WORK/last.txt")" "孤儿" "① 诊断含「孤儿」"
cp "$WORK/ledger.pre8.json" "$REPO/knowledge/ledger.json"

# 8b 重复 ID
node -e 'const fs=require("node:fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));j.entries.push(JSON.parse(JSON.stringify(j.entries[0])));fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$REPO/knowledge/ledger.json"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "1" "② 重复 ID → exit 1"
assert_contains "$(cat "$WORK/last.txt")" "ID 重复" "② 诊断含「ID 重复」"
cp "$WORK/ledger.pre8.json" "$REPO/knowledge/ledger.json"

# 8c INDEX 活跃块与 ledger 不一致（删掉 K-001 行）
node -e 'const fs=require("node:fs");const p=process.argv[1];const t=fs.readFileSync(p,"utf8").split("\n").filter(l=>!/^\| K-001 \|/.test(l)).join("\n");fs.writeFileSync(p,t)' "$REPO/knowledge/INDEX.md"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "1" "③ INDEX 活跃块不一致 → exit 1"
assert_contains "$(cat "$WORK/last.txt")" "INDEX" "③ 诊断点名 INDEX"
cp "$WORK/index.pre8.md" "$REPO/knowledge/INDEX.md"

rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "恢复后 kb:check 重新 exit 0"

# ── [9] 索引面排除：archive/** 不入 ctx 索引 ────────────────────────────────
echo
echo "[9] 索引面排除：archive/** 不进 ctx/index.json + kb:check ③ 断言 SKIP_DIRS 含 archive"
node - "$REPO" <<'NODE_EOF'
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
mkdirSync(join(root, 'knowledge/archive'), { recursive: true });
writeFileSync(join(root, 'knowledge/archive/probe.md'), '# probe（归档目录探针）\n\n正文。\n', 'utf8');
NODE_EOF
rc=$(run node "$CTX_BUILD")
assert_eq "$rc" "0" "ctx:build 退出码 0"
node -e '
const fs=require("node:fs");
const idx=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const bad=idx.files.filter(f=>f.path.startsWith("knowledge/archive/"));
if(bad.length){console.error(bad.map(f=>f.path).join("\n"));process.exit(1);} 
process.exit(0);
' "$REPO/ctx/index.json" && ok "ctx/index.json 不含 knowledge/archive/** 任何文件" || bad "归档目录泄漏进索引面"

# 9b kb:check ③ 负例：把 archive 从 SKIP_DIRS 移除 → 断言失败
cp "$LIB_DIR/context-index.mjs" "$WORK/context-index.orig"
grep -v "^  'archive',$" "$WORK/context-index.orig" > "$REPO/tools/scripts/lib/context-index.mjs"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "1" "③ SKIP_DIRS 缺 archive → kb:check exit 1"
assert_contains "$(cat "$WORK/last.txt")" "SKIP_DIRS" "③ 诊断点名 SKIP_DIRS"
cp "$WORK/context-index.orig" "$REPO/tools/scripts/lib/context-index.mjs"

# ── [10] 旧 ledger 兼容：无 seen 字段 → 不报错、不重置既有访问数据 ──────────
echo
echo "[10] 旧 ledger 兼容：删去所有 seen 字段 → kb:collect 不报错且不重置既有访问数据"
cp "$REPO/knowledge/ledger.json" "$WORK/ledger.pre10.json"
preK1=$(ld K-001 accessCount)
preK2=$(ld K-002 accessCount)
# 造一份「无 seen 字段」的旧 ledger（副本）
node -e 'const fs=require("node:fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));for(const e of j.entries) delete e.seen;fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$REPO/knowledge/ledger.json"
# 旧账本 + 仅一条新会话 S7 读 K-001 的读事件
node - "$REPO" <<'NODE_EOF'
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const L = readFileSync(join(root, 'knowledge/lessons.md'), 'utf8').split('\n');
const k1 = L.findIndex((l) => l.includes('[K-001]')) + 1;
writeFileSync(join(root, 'ctx/reads-ledger.jsonl'),
  JSON.stringify({ ide: 'cursor', session: 'S7', path: 'knowledge/lessons.md', offset: k1, limit: 1, fullFile: false, lines: 1, bytes: 10, estTokens: 5 }) + '\n',
  'utf8');
NODE_EOF
rc=$(run node "$KB_COLLECT")
assert_eq "$rc" "0" "旧 ledger（无 seen）下 kb:collect 退出码 0（不因缺字段报错）"
assert_eq "$(ld K-001 accessCount)" "$((preK1 + 1))" "既有 accessCount 保留并仅 +1（未重置）"
assert_eq "$(ldseen K-001)" "1" "缺 seen 按空数组读入 → 新计入 S7 后 seen 长度=1"
assert_eq "$(ld K-002 accessCount)" "$preK2" "无关条目 K-002 的 accessCount 未被改动"
# 说明：旧数据（accessCount>0 且无 seen）迁入新版后，首次采集会产生「accessCount 与 seen
#   不等」的中间态——这**正是 ⑥ 要显式暴露**的（不静默吞掉访问数据），而非豁免掉。
#   本仓真库旧条目 accessCount 均为 0（无此冲突），故此段只验证「不报错 / 不重置既有数据」，
#   随后恢复一致 ledger 供 ⑥ 继续验证。
cp "$WORK/ledger.pre10.json" "$REPO/knowledge/ledger.json"

# ── [11] kb:check ⑥：accessCount ↔ seen **对所有条目严格**一致（豁免已删）───
echo
echo "[11] kb:check ⑥：accessCount↔seen 严格一致（豁免分支已删；含 touch 来源的条目不再网开一面）"
cp "$REPO/knowledge/ledger.json" "$WORK/ledger.pre11.json"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "⑥ 正例：当前 ledger 全一致 → exit 0"
# 负例 A：普通条目（K-004，无采集外增量）count≠seen → FAIL
node -e 'const fs=require("node:fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));const e=j.entries.find(x=>x.id==="K-004");e.accessCount=5;e.seen=[];fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$REPO/knowledge/ledger.json"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "1" "⑥ 负例A：count≠seen → exit 1"
assert_contains "$(cat "$WORK/last.txt")" "seen" "⑥ 诊断点名 seen"
assert_contains "$(cat "$WORK/last.txt")" "K-004" "⑥ 诊断点名条目 K-004"
cp "$WORK/ledger.pre11.json" "$REPO/knowledge/ledger.json"
# 负例 B（关键）：**含 touch 来源**的条目（K-001）制造 count≠seen → 不再被豁免 → FAIL
node -e 'const fs=require("node:fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));const e=j.entries.find(x=>x.id==="K-001");e.accessCount=99;e.seen=[];fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$REPO/knowledge/ledger.json"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "1" "⑥ 负例B：含 touch 来源的条目 count≠seen **不再豁免** → exit 1（豁免已移除）"
assert_contains "$(cat "$WORK/last.txt")" "K-001" "⑥ 负例B 诊断点名 K-001（证明豁免已移除）"
assert_contains "$(cat "$WORK/last.txt")" "seen" "⑥ 负例B 诊断点名 seen"
cp "$WORK/ledger.pre11.json" "$REPO/knowledge/ledger.json"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "恢复后 kb:check 重新 exit 0"

# ── [12] 沉淀统计：幂等 / 新增 / 修改（contentHash）/ events 追加 ────────────
echo
echo "[12] kb:sync 沉淀统计：① 幂等（无变化不打印、不追加 event、字节不变）② 新增 ③ 修改 + contentHash"

# 12a 幂等：md 与 ledger 一致时重跑 sync → 统计为空、events 不变、ledger 字节不变
cp "$REPO/knowledge/ledger.json" "$WORK/ledger.pre12.json"
evn_pre=$(ldevn)
rc=$(run node "$KB_SYNC")
assert_eq "$rc" "0" "无变化 kb:sync 退出码 0"
assert_not_contains "$(cat "$WORK/last.txt")" "本次沉淀统计" "无变化 → 不打印沉淀统计区块"
assert_eq "$(ldevn)" "$evn_pre" "无变化 → events 数量不变（未追加 event）"
if cmp -s "$WORK/ledger.pre12.json" "$REPO/knowledge/ledger.json"; then
  ok "无变化 → ledger 字节不变（幂等）"
else
  bad "无变化却改写了 ledger"
fi

# 12b 新增 1 条 → 统计「新增 1」且追加一条 added event
added_pre=$(ldevkind added)
node - "$REPO" <<'NODE_EOF'
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
appendFileSync(join(process.argv[2], 'knowledge/lessons.md'),
  '\n- **[流程] 桩新增：delta epsilon**（来源 WXG-T-903，2026-03-10）\n  现象：p9。\n', 'utf8');
NODE_EOF
rc=$(run node "$KB_SYNC" --task=WXG-T-903 --note="桩：新增一条")
assert_eq "$rc" "0" "新增条目后 kb:sync 退出码 0"
assert_contains "$(cat "$WORK/last.txt")" "本次沉淀统计" "有变化 → 打印沉淀统计区块"
assert_contains "$(cat "$WORK/last.txt")" "新增 1 条" "统计报「新增 1 条」"
assert_contains "$(cat "$WORK/last.txt")" "修改 0 条" "统计报「修改 0 条」"
assert_eq "$(ldevkind added)" "$((added_pre + 1))" "events 追加 1 条 added"
assert_eq "$(ldevids added)" "K-006" "新条目分配到 K-006 且写入 added event"
assert_eq "$(ld K-006 state)" "active" "K-006 为 active"
assert_eq "$(ldhashlen K-006)" "64" "K-006 已写入 contentHash（sha256）"

# 12c 修改 K-001 正文 → ⑧ 负例（未 sync → FAIL）→ sync 后 contentHash 更新、统计「修改 1」
hash_pre=$(ld K-001 contentHash)
node - "$REPO" <<'NODE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const p = join(process.argv[2], 'knowledge/lessons.md');
const lines = readFileSync(p, 'utf8').split('\n');
const i = lines.findIndex((l) => l.includes('[K-001]'));
lines.splice(i + 1, 0, '  补充：桩修改（WXG-T-903）。');
writeFileSync(p, lines.join('\n'), 'utf8');
NODE_EOF
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "1" "⑧ 负例：改了正文但未 sync → kb:check exit 1"
assert_contains "$(cat "$WORK/last.txt")" "contentHash" "⑧ 诊断点名 contentHash（有未 sync 的修改）"
rc=$(run node "$KB_SYNC" --task=WXG-T-903 --note="桩：修改一条")
assert_eq "$rc" "0" "改正文后 kb:sync 退出码 0"
assert_contains "$(cat "$WORK/last.txt")" "修改 1 条" "统计报「修改 1 条」"
assert_contains "$(cat "$WORK/last.txt")" "新增 0 条" "统计报「新增 0 条」（未重复计新增）"
hash_post=$(ld K-001 contentHash)
if [ "$hash_pre" != "$hash_post" ] && [ "$(ldhashlen K-001)" = "64" ]; then
  ok "K-001 contentHash 已按新正文更新（sha256，与旧值不同）"
else
  bad "K-001 contentHash 未更新（旧=$hash_pre 新=$hash_post）"
fi
assert_eq "$(ldevkind updated)" "1" "events 追加 1 条 updated"
assert_eq "$(ldevids updated)" "K-001" "updated event 记录 K-001"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "sync 后 kb:check 重新 exit 0（⑧ 一致）"

# ── [13] 归档 / 激活各一次 → events 追加 + sync（同日）汇总显示 ──────────────
echo
echo "[13] kb:archive / kb:reactivate 写 events；kb:sync（同日）汇总「归档 1 / 激活 1」"
arch_pre=$(ldevkind archived)
reac_pre=$(ldevkind reactivated)
rc=$(run node "$KB_ARCHIVE" --ids=K-004 --date=2026-04-01 --task=WXG-T-904 --reason="桩：归档演示")
assert_eq "$rc" "0" "kb:archive（带 --task）退出码 0"
assert_eq "$(ldevkind archived)" "$((arch_pre + 1))" "events 追加 1 条 archived"
assert_contains "$(cat "$WORK/last.txt")" "已追加 1 条 archived" "kb:archive 输出标注 event 追加"
rc=$(run node "$KB_REACTIVATE" --ids=K-003 --date=2026-04-01 --task=WXG-T-904 --reason="桩：激活演示")
assert_eq "$rc" "0" "kb:reactivate（带 --task）退出码 0"
assert_eq "$(ldevkind reactivated)" "$((reac_pre + 1))" "events 追加 1 条 reactivated"
rc=$(run node "$KB_SYNC" --today=2026-04-01 --task=WXG-T-904)
assert_eq "$rc" "0" "kb:sync（运行日=归档/激活日）退出码 0"
assert_contains "$(cat "$WORK/last.txt")" "归档 1 条" "kb:sync 汇总显示「归档 1 条」"
assert_contains "$(cat "$WORK/last.txt")" "激活 1 条" "kb:sync 汇总显示「激活 1 条」"
assert_eq "$(ld K-003 state)" "active" "激活后 K-003 回到 active"
assert_eq "$(ld K-004 state)" "archived" "归档后 K-004 为 archived"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "归档 + 激活后 kb:check exit 0（八重）"
# 非运行日重跑 → 不再重复显示 2026-04-01 的归档/激活（避免永久复读）
rc=$(run node "$KB_SYNC" --today=2026-04-02)
assert_eq "$rc" "0" "换运行日 kb:sync 退出码 0"
assert_not_contains "$(cat "$WORK/last.txt")" "本次沉淀统计" "非事件运行日 → 统计为空（四类均为 0）"

# ── [14] CHANGELOG.md：由 sync 生成、含本次四类变更 ─────────────────────────
echo
echo "[14] knowledge/CHANGELOG.md 由 kb:sync 生成，含 added / updated / reactivated / archived 四类"
CH="$REPO/knowledge/CHANGELOG.md"
assert_file_has "$CH" '本文件由 `pnpm run kb:sync` 生成' "CHANGELOG 头部标注生成方式（勿手改）"
assert_file_has "$CH" "**新增**（added）" "CHANGELOG 含「新增」类"
assert_file_has "$CH" "**修改**（updated）" "CHANGELOG 含「修改」类"
assert_file_has "$CH" "**激活**（reactivated）" "CHANGELOG 含「激活」类"
assert_file_has "$CH" "**归档**（archived）" "CHANGELOG 含「归档」类"
assert_file_has "$CH" "K-006「桩新增：delta epsilon」" "CHANGELOG 记新增条目 K-006 的标题"
assert_file_has "$CH" "K-001「桩教训一：foo bar baz」" "CHANGELOG 记修改条目 K-001 的标题"
assert_file_has "$CH" "K-003「桩模式一：alpha beta」" "CHANGELOG 记激活条目 K-003 的标题"
assert_file_has "$CH" "K-004「桩模式二：gamma」" "CHANGELOG 记归档条目 K-004 的标题"
assert_file_has "$CH" "## 2026-04-01" "CHANGELOG 按日期分组（含 2026-04-01）"
assert_file_has "$CH" "### WXG-T-904" "CHANGELOG 同日按 Task ID 分组（WXG-T-904）"
assert_file_has "$CH" "桩：归档演示" "CHANGELOG 逐条带 note（归档原因）"
# 无生成时间戳 → 无变化重跑 sync 时 CHANGELOG 字节稳定（幂等延伸）
cp "$CH" "$WORK/changelog.pre14"
rc=$(run node "$KB_SYNC" --today=2026-04-03)
assert_eq "$rc" "0" "换运行日 kb:sync 退出码 0"
if cmp -s "$WORK/changelog.pre14" "$CH"; then
  ok "无变化重跑 → CHANGELOG.md 字节不变（无生成时间戳）"
else
  bad "CHANGELOG 被无谓改写"
fi

# ── [15] kb:check ⑦ 负例：伪造不存在的 ID / 非法 kind ───────────────────────
echo
echo "[15] kb:check ⑦ 负例（events 校验）：伪造不存在 ID / 非法 kind → exit 1"
cp "$REPO/knowledge/ledger.json" "$WORK/ledger.pre15.json"
# ⑦a 伪造 ledger 中不存在的 ID
node -e 'const fs=require("node:fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));j.events.push({date:"2026-04-02",taskId:null,kind:"added",ids:["K-777"],note:null});fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$REPO/knowledge/ledger.json"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "1" "⑦a 伪造不存在 ID → exit 1"
assert_contains "$(cat "$WORK/last.txt")" "K-777" "⑦a 诊断点名伪造 ID K-777"
assert_contains "$(cat "$WORK/last.txt")" "⑦" "⑦a 诊断归属第 ⑦ 重校验"
cp "$WORK/ledger.pre15.json" "$REPO/knowledge/ledger.json"
# ⑦b 非法 kind
node -e 'const fs=require("node:fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));j.events.push({date:"2026-04-02",taskId:null,kind:"frobnicated",ids:["K-001"],note:null});fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$REPO/knowledge/ledger.json"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "1" "⑦b 非法 kind → exit 1"
assert_contains "$(cat "$WORK/last.txt")" "非法 kind" "⑦b 诊断点名非法 kind"
cp "$WORK/ledger.pre15.json" "$REPO/knowledge/ledger.json"
# ⑦c 非法 taskId（既非 WXG-T-\\d+ 也非 null）
node -e 'const fs=require("node:fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));j.events.push({date:"2026-04-02",taskId:"TASK-1",kind:"added",ids:["K-001"],note:null});fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$REPO/knowledge/ledger.json"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "1" "⑦c 非法 taskId → exit 1"
assert_contains "$(cat "$WORK/last.txt")" "taskId" "⑦c 诊断点名 taskId"
cp "$WORK/ledger.pre15.json" "$REPO/knowledge/ledger.json"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "恢复后 kb:check 重新 exit 0"

# ── [16] 索引面收录：ctx:build 后 knowledge/CHANGELOG.md 在 ctx/index.json 内 ─
echo
echo "[16] ctx:build 后 knowledge/CHANGELOG.md 在索引面内（normal tier）"
rc=$(run node "$CTX_BUILD")
assert_eq "$rc" "0" "ctx:build 退出码 0"
node -e '
const fs=require("node:fs");
const idx=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const f=idx.files.find(x=>x.path==="knowledge/CHANGELOG.md");
if(!f){console.error("知识库变更日志未入索引面");process.exit(1);}
if(!(f.tokens>0)){console.error("CHANGELOG 条目 tokens 异常");process.exit(1);}
process.exit(0);
' "$REPO/ctx/index.json" && ok "knowledge/CHANGELOG.md 在 ctx/index.json 内（tokens>0）" || bad "CHANGELOG 未进索引面"

# ── [17] 撞号回归：ledger 缺失 + md 已带行内 ID → 新条目不复用既有 ID ─────────
echo
echo "[17] 回归：删掉 ledger.json 后 sync —— 新条目不撞既有 ID（nextId 下界 = 既有最大 ID + 1）"
cp "$REPO/knowledge/ledger.json" "$WORK/ledger.pre17.json"
cp "$REPO/knowledge/lessons.md" "$WORK/lessons.pre17.md"
cp "$REPO/knowledge/patterns.md" "$WORK/patterns.pre17.md"
cp "$REPO/knowledge/INDEX.md" "$WORK/index.pre17.md"
cp "$REPO/knowledge/CHANGELOG.md" "$WORK/changelog.pre17.md"
cp "$REPO/knowledge/archive/INDEX.md" "$WORK/archive-index.pre17.md"
node - "$REPO" <<'NODE_EOF'
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
// 既有最大 ID = K-006（见 12b）→ 新条目应分到 K-007，**绝不能**复用 K-001
appendFileSync(join(process.argv[2], 'knowledge/lessons.md'),
  '\n- **[流程] 桩回归：撞号测试**（来源 WXG-T-905，2026-04-05）\n  现象：p17。\n', 'utf8');
NODE_EOF
rm -f "$REPO/knowledge/ledger.json"
rc=$(run node "$KB_SYNC" --today=2026-04-05 --task=WXG-T-905)
assert_eq "$rc" "0" "ledger 缺失下 kb:sync 退出码 0"
assert_eq "$(ld K-007 state)" "active" "新条目分配到 K-007（未复用既有 K-001…K-006）"
assert_eq "$(ld K-001 title)" "桩教训一：foo bar baz" "既有 K-001 未被新条目覆盖（标题仍为原文）"
assert_eq "$(grep -c '\[K-001\]' "$REPO/knowledge/lessons.md")" "1" "lessons.md 中 [K-001] 仅出现 1 次（无撞号）"
assert_contains "$(cat "$WORK/last.txt")" "K-007" "沉淀统计点名新条目 K-007（新增而非被误判成修改）"
# 恢复现场（ledger + md + INDEX + CHANGELOG + archive INDEX）
cp "$WORK/ledger.pre17.json" "$REPO/knowledge/ledger.json"
cp "$WORK/lessons.pre17.md" "$REPO/knowledge/lessons.md"
cp "$WORK/patterns.pre17.md" "$REPO/knowledge/patterns.md"
cp "$WORK/index.pre17.md" "$REPO/knowledge/INDEX.md"
cp "$WORK/changelog.pre17.md" "$REPO/knowledge/CHANGELOG.md"
cp "$WORK/archive-index.pre17.md" "$REPO/knowledge/archive/INDEX.md"
rc=$(run node "$KB_CHECK")
assert_eq "$rc" "0" "恢复现场后 kb:check 重新 exit 0"

# ── 汇总 ────────────────────────────────────────────────────────────────────
echo
echo "=================================================================="
echo "结果：PASS=$PASS  FAIL=$FAIL"
echo "=================================================================="
[ "$FAIL" -eq 0 ]
