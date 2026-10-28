#!/usr/bin/env bash
# archive-tasks-selftest.sh — tasks:archive 的本地「桩」自测（WXG-T-040，对策 R3）。
#
# 目的：在不触碰真实 `production/TASKS.md` 的前提下，验证完成行 30 天归档器全行为。
# 做法：在临时目录构造**桩 git 仓库 + 桩台账**，用 GIT_AUTHOR_DATE / GIT_COMMITTER_DATE
#       注入「40 天前 / 5 天前」提交时间（脚本判定读 committer-time），核对：
#         ① dry-run（默认）只打印计划、不落盘（台账与归档文件字节不变 / 归档不创建）
#         ② --write：≥30 天的 ✅ 行被移入归档（原行逐字节保留 + 批次留痕行）
#         ③ 安全边界：新完成行（5 天）不动；🔄 / ⏸ 行不动；未提交 ✅ 行（无日期证据）不动
#         ④ 头注号校准：当前已分配至 / 下一可用号 = 主表∪归档全局最大号（+1）
#            —— 归档把老号移出主表后，主表只剩小号时头注**不回退**（防并行会话重号）
#         ⑤ 勘误行：旧纪律「不要只信本注」→ 新纪律「领号认本注，本注由 tasks:archive 校准」
#         ⑥ 行数守恒：主表减少数 = 归档新增数（脚本内校验通过才会落盘）
#         ⑦ 幂等：--write 重跑 → 0 行空转不落盘（台账/归档字节不变）
#         ⑧ 0 行可归档：提示无可归档、不写盘、归档文件不创建
#         ⑨ fail loud：头注缺「当前已分配至…下一可用号」句式 → exit 1 不落盘
#         ⑩ 重复号防护：主表被手工塞回已在归档的行 → 跳过告警、不重复入档
#         ⑪ 成对搬运（WXG-T-065）：详情文件存在时，主表行与其详情小节**同批**搬走
#            （行→TASKS-archive.md、节→TASKS-DETAIL-archive.md），正文逐字节不变、
#            在办行小节不动、批次留痕写明成对、重跑幂等
#         ⑫ 宁漏勿错：主表有行但详情无对应小节 → **跳过该行**（搬了会丢正文）并告警
#         ⑬ 同号守卫（WXG-T-078）：主表内出现同号 → 扫「主表∪归档」告警横幅；写盘时
#            同批内同号**只归档首份**、其余保留主表（不自动合并），归档不放大成重复行
#         ⑭ 源面（WXG-T-400，判例 K-089 追记）：`check:tasks` 的 note H 只指路、
#            不写死可执行阈值——建议串里的硬编码数字会随台账规模过期，而门禁本身不报错过期
#         ⑮ 索引权威面（WXG-T-401，判例 K-045）：`check:tasks --staged` 读索引而非工作树——
#            pre-commit 据此拦住「台账一侧入索引、另一侧留在工作树」的撕裂，同时对邻居未提交改动免疫
#         ⑯ BACKLOG 第四面（WXG-T-407）：未排期提案表占号、可无详情节，但行格式与主表同构（J 项）
#         ⑰ I 项在 --staged 降级为披露（WXG-T-407）：仓库级欠账不拦本单，硬拦留在工作树模式
#         ⑱ 完成日期证据（WXG-T-409）：**行内状态列日期优先、blame 兜底**——旧口径只信 blame
#            ⇒ 整表重写会把全表年龄复位成今天，观察哨永不可达（407 §8 遗留 1）
#         ⑲ K 项（WXG-T-409）：`check:tasks --commit-msg=<file>` 只拿**本笔**消息的号碰索引面——
#            I 项在 --staged 只能披露（他人欠账），本笔署号可硬拦；登记行未 `git add` 也拦
#
# 用法：tools/scripts/archive-tasks-selftest.sh
# 产物：仅 stdout 报告；临时目录退出时清理，不污染仓库。

set -uo pipefail
# 刻意不用 set -e —— 需要捕获被测脚本的各种退出码。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE_CMD="$SCRIPT_DIR/archive-tasks.mjs"
PASS=0
FAIL=0

WORK="$(mktemp -d "${TMPDIR:-/tmp}/wxg-tasks-archive-selftest.XXXXXX")"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

ok()  { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
assert_eq() { if [ "$1" = "$2" ]; then ok "$3（=$1）"; else bad "$3：期望 [$2]，实际 [$1]"; fi; }
assert_contains() { case "$1" in *"$2"*) ok "$3";; *) bad "$3：输出中找不到 [$2]";; esac; }
assert_not_contains() { case "$1" in *"$2"*) bad "$3：输出中不应出现 [$2]";; *) ok "$3";; esac; }
sha() { shasum -a 256 "$1" | awk '{print $1}'; }

# 桩 git 仓库：按「台账快照 + 提交日期」建提交（committer-time 是被测判定来源）。
# $1 = 仓库目录；$2 = ISO 日期；stdin = 台账内容。
stub_commit() {
  local repo="$1" date="$2"
  git -C "$repo" add -A >/dev/null 2>&1
  GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" \
    git -C "$repo" -c user.name=stub -c user.email=stub@stub -c commit.gpgsign=false \
    commit -q -m "stub" >/dev/null 2>&1
}

new_repo() {
  local repo="$1"
  mkdir -p "$repo/production"
  git -C "$repo" init -q -b develop
}

echo "=================================================================="
echo "WXG-T-040 tasks:archive 本地桩自测"
echo "被测: $ARCHIVE_CMD"
echo "工作目录: $WORK"
echo "=================================================================="

# ── 造主桩仓库：① 40 天前只有 T-001（老完成行）；② 5 天前追加 T-002（新完成行）/ ──
# ── T-003（🔄 进行中）/ T-004（⏸ 待排）；③ 工作树留一条未提交 T-005（无日期证据）──
REPO="$WORK/repo"
new_repo "$REPO"
TASKS="$REPO/production/TASKS.md"
HEADER_1='# WXG 任务台账（桩）'
HEADER_2='> 单号递增不回收。当前已分配至 **WXG-T-001**（✅ 已完成），下一可用号 **WXG-T-002**。'
HEADER_3='> 勘误（旧）：领号只认表内最大号，不要只信本注。'
ROW_T001='| WXG-T-001 | 老完成行 | 甲 | ✅ 完成 | 旧产出（含「完成时间 ≥30 天」判定对象） |'
cat >"$TASKS" <<EOF
$HEADER_1

$HEADER_2
$HEADER_3

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
$ROW_T001

> 注 1：桩注脚（不得被改动）。

## 待排（backlog）

| 事项 | 来源 | 说明 |
|---|---|---|
| backlog 行 | 桩 | 一律不动 |
EOF
OLD_DATE="$(node -e 'console.log(new Date(Date.now() - 40 * 864e5).toISOString())')"
stub_commit "$REPO" "$OLD_DATE"

cat >>"$TASKS" <<EOF
| WXG-T-002 | 新完成行 | 乙 | ✅ 完成 | 新产出（5 天，不得归档） |
| WXG-T-003 | 进行中 | 丙 | 🔄 进行中 | - |
| WXG-T-004 | 暂停行 | 丁 | ⏸ 待排 | - |
EOF
RECENT_DATE="$(node -e 'console.log(new Date(Date.now() - 5 * 864e5).toISOString())')"
stub_commit "$REPO" "$RECENT_DATE"

echo '| WXG-T-005 | 未提交完成行 | 戊 | ✅ 完成 | 无日期证据（不得归档） |' >>"$TASKS"

# ── [1] dry-run（默认）：只打印计划，不落盘 ────────────────────────────────────
echo "—— [1] dry-run（默认）不落盘"
BEFORE_TASKS="$(sha "$TASKS")"
OUT="$(node "$ARCHIVE_CMD" --root="$REPO" 2>&1)"; RC=$?
assert_eq "$RC" "0" "[1] dry-run 退出码 0"
assert_contains "$OUT" "→ 归档｜行" "[1] 计划中列出候选行"
assert_contains "$OUT" "WXG-T-001" "[1] 候选为老完成行 T-001"
assert_contains "$OUT" "未落盘" "[1] 明示未落盘"
assert_not_contains "$OUT" "WXG-T-002" "[1] 新完成行 T-002 不入候选"
assert_not_contains "$OUT" "WXG-T-003" "[1] 🔄 行 T-003 不入候选"
assert_not_contains "$OUT" "WXG-T-004" "[1] ⏸ 行 T-004 不入候选"
assert_contains "$OUT" "WXG-T-005｜状态 ✅ 但无日期证据" "[1] 未提交行 T-005 判为无日期证据（⏭ 不入候选）"
assert_eq "$(sha "$TASKS")" "$BEFORE_TASKS" "[1] 台账字节不变"
if [ ! -e "$REPO/production/archive/TASKS-archive.md" ]; then ok "[1] 归档文件未创建"; else bad "[1] 归档文件不应被创建"; fi

# ── [2] --write：老完成行归档、其余不动、头注校准、勘误改写、守恒 ─────────────
echo "—— [2] --write 真实归档"
OUT="$(node "$ARCHIVE_CMD" --root="$REPO" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[2] --write 退出码 0"
assert_contains "$OUT" "守恒校验通过" "[2] 行数守恒校验通过"
ARCHIVE_FILE="$REPO/production/archive/TASKS-archive.md"
if [ -f "$ARCHIVE_FILE" ]; then ok "[2] 归档文件已创建"; else bad "[2] 归档文件缺失"; fi
grep -qF "$ROW_T001" "$TASKS" && bad "[2] T-001 仍留在主表" || ok "[2] T-001 已移出主表"
grep -qF "$ROW_T001" "$ARCHIVE_FILE" && ok "[2] T-001 原行逐字节入归档" || bad "[2] 归档中找不到 T-001 原行"
assert_contains "$(cat "$ARCHIVE_FILE")" "归档批次" "[2] 归档含批次留痕行"
grep -qF '| WXG-T-002 |' "$TASKS" && ok "[2] 新完成行 T-002 保留在主表" || bad "[2] T-002 被误归档"
grep -qF '| WXG-T-003 |' "$TASKS" && ok "[2] 🔄 行 T-003 保留在主表" || bad "[2] T-003 被误归档"
grep -qF '| WXG-T-004 |' "$TASKS" && ok "[2] ⏸ 行 T-004 保留在主表" || bad "[2] T-004 被误归档"
grep -qF '| WXG-T-005 |' "$TASKS" && ok "[2] 未提交行 T-005 保留在主表" || bad "[2] T-005 被误归档"
assert_contains "$(grep -F '当前已分配至' "$TASKS")" "当前已分配至 **WXG-T-005**，下一可用号 **WXG-T-006**" \
  "[2] 头注校准为全局最大号（含归档 T-001∪主表 T-005）→ 下一可用号 006（不回退）"
assert_contains "$(grep -F '勘误' "$TASKS")" "领号认本注" "[2] 勘误行改为「领号认本注」"
assert_not_contains "$(grep -F '勘误' "$TASKS")" "不要只信本注" "[2] 旧纪律文字已移除"
assert_contains "$(cat "$TASKS")" "桩注脚（不得被改动）" "[2] 注脚逐字节保留"
assert_contains "$(cat "$TASKS")" "| backlog 行 | 桩 | 一律不动 |" "[2] backlog 表不动"

# ── [3] 幂等：--write 重跑 0 行空转 ────────────────────────────────────────────
echo "—— [3] 幂等重跑"
A="$(sha "$TASKS")"; B="$(sha "$ARCHIVE_FILE")"
OUT="$(node "$ARCHIVE_CMD" --root="$REPO" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[3] 重跑退出码 0"
assert_contains "$OUT" "无可归档" "[3] 重跑提示无可归档"
assert_eq "$(sha "$TASKS")" "$A" "[3] 重跑台账字节不变"
assert_eq "$(sha "$ARCHIVE_FILE")" "$B" "[3] 重跑归档字节不变"

# ── [4] 0 行可归档：空转不写盘 ─────────────────────────────────────────────────
echo "—— [4] 0 行可归档（对应真实台账首轮：建档仅 1 天）"
REPO2="$WORK/repo2"
new_repo "$REPO2"
T2="$REPO2/production/TASKS.md"
cat >"$T2" <<EOF
# WXG 任务台账（桩 2）

> 当前已分配至 **WXG-T-001**（✅ 已完成），下一可用号 **WXG-T-002**。
> 勘误：领号认本注，本注由 tasks:archive 校准。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | 新完成行 | 甲 | ✅ 完成 | 刚完成 |
EOF
stub_commit "$REPO2" "$(node -e 'console.log(new Date().toISOString())')"
OUT="$(node "$ARCHIVE_CMD" --root="$REPO2" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[4] 0 行 --write 退出码 0"
assert_contains "$OUT" "无可归档" "[4] 提示无可归档"
assert_contains "$OUT" "不落盘" "[4] 明示不落盘"
assert_contains "$OUT" "头注号与全局最大号一致" "[4] 头注号校验通过仅提示"
if [ ! -e "$REPO2/production/archive" ]; then ok "[4] 归档目录未被创建"; else bad "[4] 归档目录不应存在"; fi
grep -qF '| WXG-T-001 |' "$T2" && ok "[4] 台账行未动" || bad "[4] 台账行被误改"

# ── [5] fail loud：头注句式缺失 → exit 1 不落盘 ────────────────────────────────
echo "—— [5] 头注句式缺失 fail loud"
REPO3="$WORK/repo3"
new_repo "$REPO3"
T3="$REPO3/production/TASKS.md"
cat >"$T3" <<EOF
# WXG 任务台账（桩 3）

> 头注被损坏，没有标准句式。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | 老完成行 | 甲 | ✅ 完成 | 旧产出 |
EOF
stub_commit "$REPO3" "$OLD_DATE"
BEFORE3="$(sha "$T3")"
OUT="$(node "$ARCHIVE_CMD" --root="$REPO3" --write 2>&1)"; RC=$?
assert_eq "$RC" "1" "[5] 头注缺失退出码 1"
assert_contains "$OUT" "无法校准" "[5] 明示无法校准"
assert_eq "$(sha "$T3")" "$BEFORE3" "[5] 台账字节不变（不落盘）"

# ── [6] 重复号防护：主表被手工塞回已归档行 → 跳过不重复入档 ────────────────────
echo "—— [6] 重复号防护"
cp "$ARCHIVE_FILE" "$WORK/archive-backup.md"
grep -F "$ROW_T001" "$WORK/archive-backup.md" >>"$TASKS"
# 塞回的行必须按旧日期提交——未提交行无日期证据，本就不会成为候选（那是 [1]/[2] 已验证的分支）。
stub_commit "$REPO" "$OLD_DATE"
OUT="$(node "$ARCHIVE_CMD" --root="$REPO" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[6] 重复号退出码 0"
assert_contains "$OUT" "已存在于归档" "[6] 告警重复号"
assert_eq "$(grep -cF "$ROW_T001" "$ARCHIVE_FILE")" "1" "[6] 归档中 T-001 仅 1 份（不重复入档）"

# ── [7] 成对搬运：主表行归档 ⇒ 详情小节同批搬走（WXG-T-065）────────────────────
echo "—— [7] 成对搬运（行 + 详情节）"
REPO4="$WORK/repo4"
new_repo "$REPO4"
T4="$REPO4/production/TASKS.md"
D4="$REPO4/production/TASKS-DETAIL.md"
DA4="$REPO4/production/archive/TASKS-DETAIL-archive.md"
cat >"$T4" <<EOF
# WXG 任务台账（桩 4）

> 当前已分配至 **WXG-T-002**（🔄 进行中），下一可用号 **WXG-T-003**。
> 勘误：领号认本注，本注由 tasks:archive 校准。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | 老完成行 | 甲 | ✅ 完成 | 见详情 |
| WXG-T-002 | 在办行 | 乙 | 🔄 进行中 | 见详情 |
EOF
cat >"$D4" <<EOF
# WXG 任务台账 · 详情（桩 4）

---

## WXG-T-001

- **名称**：老完成行的长正文（必须逐字节随行搬走）

---

## WXG-T-002

- **名称**：在办行的正文（不得被搬走）
EOF
stub_commit "$REPO4" "$OLD_DATE"
B4T="$(sha "$T4")"; B4D="$(sha "$D4")"

# [7a] dry-run：不落盘、明示成对
OUT="$(node "$ARCHIVE_CMD" --root="$REPO4" 2>&1)"; RC=$?
assert_eq "$RC" "0" "[7a] dry-run 退出码 0"
assert_contains "$OUT" "成对搬运" "[7a] 计划明示成对搬运"
assert_contains "$OUT" "详情节 1 节" "[7a] dry-run 报出节数"
assert_eq "$(sha "$T4")" "$B4T" "[7a] dry-run 台账字节不变"
assert_eq "$(sha "$D4")" "$B4D" "[7a] dry-run 详情字节不变"

# [7b] --write：行与节同批搬走
OUT="$(node "$ARCHIVE_CMD" --root="$REPO4" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[7b] --write 退出码 0"
assert_contains "$OUT" "守恒校验通过" "[7b] 行守恒通过"
assert_contains "$OUT" "详情节成对搬运" "[7b] 报告明示成对搬运"
grep -qF '| WXG-T-001 |' "$T4" && bad "[7b] T-001 行仍在主表" || ok "[7b] 行已移出主表"
grep -qF '## WXG-T-001' "$D4" && bad "[7b] T-001 小节仍在详情文件" || ok "[7b] 小节已移出详情文件"
if [ -f "$DA4" ]; then ok "[7b] 详情归档已创建"; else bad "[7b] 详情归档缺失"; fi
grep -qF '## WXG-T-001' "$DA4" && ok "[7b] 小节入详情归档" || bad "[7b] 详情归档找不到该节"
grep -qF '必须逐字节随行搬走' "$DA4" && ok "[7b] 正文逐字节搬走（未改写）" || bad "[7b] 正文被改写"
grep -qF '## WXG-T-002' "$D4" && ok "[7b] 在办行小节保留" || bad "[7b] 在办行小节被误搬"
grep -qF '在办行的正文（不得被搬走）' "$D4" && ok "[7b] 在办行正文保留" || bad "[7b] 在办行正文丢失"
assert_contains "$(head -3 "$DA4")" "详情归档" "[7b] 详情归档含说明头"
assert_contains "$(cat "$REPO4/production/archive/TASKS-archive.md")" "详情节同批搬入" "[7b] 行归档批次留痕写明成对"

# [7c] 幂等：重跑 0 行空转，四个文件字节不变
A7T="$(sha "$T4")"; A7D="$(sha "$D4")"; A7A="$(sha "$DA4")"
OUT="$(node "$ARCHIVE_CMD" --root="$REPO4" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[7c] 重跑退出码 0"
assert_eq "$(sha "$T4")" "$A7T" "[7c] 台账字节不变"
assert_eq "$(sha "$D4")" "$A7D" "[7c] 详情字节不变"
assert_eq "$(sha "$DA4")" "$A7A" "[7c] 详情归档字节不变"

# [7d] 宁漏勿错：主表有行但详情无小节 → 跳过（搬了会丢正文）
REPO5="$WORK/repo5"
new_repo "$REPO5"
T5="$REPO5/production/TASKS.md"
cat >"$T5" <<EOF
# WXG 任务台账（桩 5）

> 当前已分配至 **WXG-T-001**（✅ 已完成），下一可用号 **WXG-T-002**。
> 勘误：领号认本注，本注由 tasks:archive 校准。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | 老完成行但详情缺小节 | 甲 | ✅ 完成 | 见详情 |
EOF
printf '# WXG 任务台账 · 详情（桩 5，无小节）\n' >"$REPO5/production/TASKS-DETAIL.md"
stub_commit "$REPO5" "$OLD_DATE"
B5="$(sha "$T5")"
OUT="$(node "$ARCHIVE_CMD" --root="$REPO5" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[7d] 缺小节退出码 0"
assert_contains "$OUT" "主表有行但" "[7d] 告警：主表有行但详情无小节"
grep -qF '| WXG-T-001 |' "$T5" && ok "[7d] 行保留在主表（未误搬）" || bad "[7d] 行被搬走（会丢正文）"
assert_eq "$(sha "$T5")" "$B5" "[7d] 台账字节不变"
if [ ! -e "$REPO5/production/archive/TASKS-archive.md" ]; then ok "[7d] 归档文件未创建"; else bad "[7d] 不应创建归档"; fi

# ── [8] 同号守卫（WXG-T-078）：主表内同号 → 告警 + 只归档首份、不自动合并 ────────
echo "—— [8] 同号守卫"
REPO6="$WORK/repo6"
new_repo "$REPO6"
T6="$REPO6/production/TASKS.md"
cat >"$T6" <<EOF
# WXG 任务台账（桩 6：同号）

> 当前已分配至 **WXG-T-001**（✅ 已完成），下一可用号 **WXG-T-002**。
> 勘误：领号认本注，本注由 tasks:archive 校准。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | 甲会话行 | 甲 | ✅ 完成 | 撞号-甲 |
| WXG-T-001 | 乙会话行 | 乙 | ✅ 完成 | 撞号-乙 |
EOF
stub_commit "$REPO6" "$OLD_DATE"
B6="$(sha "$T6")"
# [8a] dry-run：横幅告警、不落盘
OUT="$(node "$ARCHIVE_CMD" --root="$REPO6" 2>&1)"; RC=$?
assert_eq "$RC" "0" "[8a] 同号 dry-run 退出码 0"
assert_contains "$OUT" "同号守卫" "[8a] 输出含同号守卫横幅"
assert_contains "$OUT" "WXG-T-001 出现 2 次（主表 + 主表）" "[8a] 报出主表同号 ×2"
assert_eq "$(sha "$T6")" "$B6" "[8a] dry-run 台账字节不变"
# [8b] --write：只归档首份，主表保留一份同号（不自动合并），归档不放大
OUT="$(node "$ARCHIVE_CMD" --root="$REPO6" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[8b] 同号 --write 退出码 0"
assert_contains "$OUT" "本批内同号重复行" "[8b] 明示批次内同号只搬首份"
A6="$REPO6/production/archive/TASKS-archive.md"
assert_eq "$(grep -c '| WXG-T-001 |' "$A6")" "1" "[8b] 归档中 T-001 仅 1 份（未放大成重复）"
assert_eq "$(grep -c '| WXG-T-001 |' "$T6")" "1" "[8b] 主表保留 1 份同号行（不自动合并）"

# ── [9] 源面：check:tasks 的 note H 不得把阈值写死成可直接执行的数字（WXG-T-400）────
# 为什么要这条：note H 是「门禁发给执行者的建议串」。门仍绿、提示仍出，失真的不是断言而是建议
# 本身——旧串硬编码 `--detail-until-under=7000 --write`，而详情驱动分支不看年龄、按号序一路删到
# 底，阈值低于「全部可归档行搬出后的下限」时 7000/40000/80000 三档同读数 ⇒ 照抄会把当天刚入库的
# 行一起搬进冷存。故：负向锁「数字阈值不再以可执行形态出现」，正向锁「建议仍在且要求先 dry-run」
# ——只留负向会被「把整条建议删掉」骗过（K-036：既证守卫能红，也证它不靠空转绿）。
echo "—— [9] note H 建议串去硬编码阈值"
CHECK_CMD="$SCRIPT_DIR/check-tasks.mjs"
HBLOCK="$(sed -n '/^const ROW_SENTINEL/,/^}/p' "$CHECK_CMD")"
assert_contains "$HBLOCK" "notes.push" "[9a] 能定位到 H 的推送块（锚未失效）"
if echo "$HBLOCK" | grep -qE -- '--(detail-)?until-under=[0-9]'; then
  bad "[9b] H 块内又出现写死的数字阈值——正是 K-089 追记的过期形状"
else
  ok "[9b] H 块内无可执行数字阈值"
fi
assert_contains "$HBLOCK" '不带 `--write`' "[9c] 建议仍要求先跑 dry-run（防空转删建议）"

# 为什么要这条：A–I 判据长期只跑在 verify，钩子不接 ⇒ 撕裂态能直接进 HEAD（真事：
# WXG-T-396 的详情节被并发会话随其提交扫走，主表行留在工作树未入）。而门若读工作树，
# 共享工作树下会因**不属本单**的改动误拦——故 --staged 必选索引面。四条腿各挡一种失效：
#   10a 基线绿（防「夹具坏了也绿」的空转）；10b 撕裂必红（新门的存在理由）；
#   10c 补齐必绿（防门恒红、把修复路径堵死）；10d 「工作树红 / 索引绿」双读数，
#   证它真的换了权威面（只写 10a–10c 的话，把工作树误当索引读也测不出）。
echo "—— [10] check:tasks --staged 读索引（pre-commit 新门）"
REPO_S="$WORK/repo-staged"
new_repo "$REPO_S"
cat >"$REPO_S/production/TASKS.md" <<'EOS'
# 任务台账（桩）

> 当前已分配至 **WXG-T-001**，下一可用号 **WXG-T-002**。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | 甲行 | 甲 | ✅ 完成 | 见详情 |
EOS
cat >"$REPO_S/production/TASKS-DETAIL.md" <<'EOS'
# 详情台账（桩）

## WXG-T-001

正文甲
EOS
stub_commit "$REPO_S" "$(node -e 'console.log(new Date().toISOString())')"
run_staged() { ( cd "$REPO_S" && node "$CHECK_CMD" --staged >/dev/null 2>&1 ); echo $?; }
run_worktree() { ( cd "$REPO_S" && node "$CHECK_CMD" >/dev/null 2>&1 ); echo $?; }
assert_eq "$(run_staged)" "0" "[10a] 干净索引基线绿"

printf '\n## WXG-T-002\n\n正文乙\n' >>"$REPO_S/production/TASKS-DETAIL.md"
git -C "$REPO_S" add production/TASKS-DETAIL.md
assert_eq "$(run_staged)" "1" "[10b] 索引里「详情有节、主表无行」⇒ 红（入库前拦住）"

node -e 'const fs=require("fs"),p=process.argv[1];let s=fs.readFileSync(p,"utf8");
s=s.replace("| WXG-T-001 | 甲行 | 甲 | ✅ 完成 | 见详情 |","$&\n| WXG-T-002 | 乙行 | 乙 | ✅ 完成 | 见详情 |").replace("**WXG-T-001**，下一可用号 **WXG-T-002**","**WXG-T-002**，下一可用号 **WXG-T-003**");
fs.writeFileSync(p,s)' "$REPO_S/production/TASKS.md"
git -C "$REPO_S" add production/TASKS.md
assert_eq "$(run_staged)" "0" "[10c] 补齐另一侧（含头注）⇒ 绿，修复路径未被堵死"

printf '| WXG-T-003 | 坏行 | a | b | c | d |\n' >>"$REPO_S/production/TASKS.md"
assert_eq "$(run_worktree)" "1" "[10d-1] 工作树被改坏 ⇒ 工作树模式红（对照）"
assert_eq "$(run_staged)" "0" "[10d-2] 同一坏行未入索引 ⇒ --staged 不拦邻居 WIP（权威面真的换了）"

# 为什么要这条：拆 BACKLOG（WXG-T-407）后台账多了一面，而三件事只能测才能确信：
#   行搬过去后其详情节不能被判孤儿（否则拆表当日就红）；真孤儿仍必须红（别把门拆哑）；
#   J 项（BACKLOG 行也得 5 列）得能红。三条腿各挡一种失效。
echo "—— [11] BACKLOG 第四面：占号、可无节、行格式同主表"
REPO_B="$WORK/repo-backlog"
new_repo "$REPO_B"
cat >"$REPO_B/production/TASKS.md" <<'EOS'
# 任务台账（桩）

> 当前已分配至 **WXG-T-002**，下一可用号 **WXG-T-003**。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | 在办行 | 甲 | 🚧 进行中 | 见详情 |
EOS
cat >"$REPO_B/production/TASKS-DETAIL.md" <<'EOS'
# 详情台账（桩）

## WXG-T-001

正文甲

## WXG-T-002

正文乙
EOS
cat >"$REPO_B/production/BACKLOG.md" <<'EOS'
# 未排期提案（桩）

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-002 | 提案行 | 乙 | 📋 提案 / 未排期 | 见详情 |
EOS
stub_commit "$REPO_B" "$(node -e 'console.log(new Date().toISOString())')"
run_b() { ( cd "$REPO_B" && node "$CHECK_CMD" >/dev/null 2>&1 ); echo $?; }
assert_eq "$(run_b)" "0" "[11a] 主表无 002 行、BACKLOG 有 ⇒ 其详情节不算孤儿"

grep -v '^| WXG-T-002 |' "$REPO_B/production/BACKLOG.md" >"$REPO_B/production/BACKLOG.md.n" \
  && mv "$REPO_B/production/BACKLOG.md.n" "$REPO_B/production/BACKLOG.md"
assert_eq "$(run_b)" "1" "[11b] 两面都无行 ⇒ 孤儿详情仍必红（门未拆哑）"

printf '| WXG-T-002 | 提案行 | 乙 | 📋 未排期 | x | 见详情 |\n' >>"$REPO_B/production/BACKLOG.md"
assert_eq "$(run_b)" "1" "[11c] BACKLOG 行 6 列 ⇒ J 项红（格式同主表）"

# 为什么要这条：`--staged` 是 pre-commit 的门，校的是「本笔索引自洽」；而 I 项校的是
# 「提交史 vs 台账」= **仓库级**欠账。共享工作树里对方常「代码已提交、台账行还留在工作树」
# ⇒ 索引面必缺该号，本单就被**别人的欠账**拦住（WXG-T-407 实测：本批被 402/403 拦下）。
# 三条腿：12a 工作树模式必红（硬拦没被拆掉）；12b --staged 必绿（他人欠账不拦本单）；
# 12c --staged 仍把该欠账打印出来（降级 ≠ 消失，防「把 I 项整块删掉」骗绿）。
echo "—— [12] I 项在 --staged 降级为披露（仓库级欠账 ≠ 本笔自洽）"
REPO_I="$WORK/repo-commitscan"
new_repo "$REPO_I"
cat >"$REPO_I/production/TASKS.md" <<'EOS'
# 任务台账（桩）

> 当前已分配至 **WXG-T-001**，下一可用号 **WXG-T-002**。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | 甲行 | 甲 | ✅ 完成 | 见详情 |
EOS
cat >"$REPO_I/production/TASKS-DETAIL.md" <<'EOS'
# 详情台账（桩）

## WXG-T-001

正文甲
EOS
stub_commit "$REPO_I" "$(node -e 'console.log(new Date().toISOString())')"
git -C "$REPO_I" -c user.name=stub -c user.email=stub@stub -c commit.gpgsign=false \
  commit -q --allow-empty -m 'feat(x): 他人代码已入库、台账行未登 (WXG-T-777)'
run_i() { ( cd "$REPO_I" && node "$CHECK_CMD" >/dev/null 2>&1 ); echo $?; }
run_i_staged() { ( cd "$REPO_I" && node "$CHECK_CMD" --staged >/dev/null 2>&1 ); echo $?; }
assert_eq "$(run_i)" "1" "[12a] 工作树模式：未在册号仍硬拦（verify 口径未放宽）"
assert_eq "$(run_i_staged)" "0" "[12b] --staged：他人欠账不拦本单"
assert_contains "$( cd "$REPO_I" && node "$CHECK_CMD" --staged 2>&1 )" "WXG-T-777" \
  "[12c] --staged 仍打印该欠账（降级不消失）"

# 为什么要这一组：归档年龄原来**只**读 `git blame` committer-time ⇒ 任何整表重写（拆 BACKLOG、
# 头注校准、批量回填）都把全表「年龄」复位成今天，观察哨 20 在现语义下永不可达（实测 --days=14
# 零候选）。WXG-T-409 改成「行内完成日期优先，blame 兜底」。
# 三条腿都有判别力，靠**两次提交**把行级 blame 时间拉开：commit1 = 40 天前（写 002/003），
# commit2 = 今天（追加 001）。变异取证（判例 K-089）：把 completionTimeOf 改回「只读 blame」
# ⇒ 13a 与 13b 同时红；若只测 13a 一条，则「把 blame 判据整块删掉」也能骗绿。
# 日期均动态算（写死绝对日期会逐年失效）。
E_OLD="$(node -e 'console.log(new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10))')"
E_NEW="$(node -e 'console.log(new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10))')"
D_OLD_ISO="$(node -e 'console.log(new Date(Date.now() - 40 * 864e5).toISOString())')"
D_NOW_ISO="$(node -e 'console.log(new Date().toISOString())')"
echo "—— [13] 完成日期证据：行内状态列优先、blame 兜底（WXG-T-409）"
REPO_E="$WORK/repo-datesource"
new_repo "$REPO_E"
cat >"$REPO_E/production/TASKS.md" <<EOS
# 任务台账（桩）

> 当前已分配至 **WXG-T-003**，下一可用号 **WXG-T-004**。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-002 | 行内新日期但 40 天前就提交 | 乙 | ✅ **完成（${E_NEW}）** | 见详情 |
| WXG-T-003 | 无行内日期且 40 天前提交 | 丙 | ✅ 完成 | 见详情 |
EOS
stub_commit "$REPO_E" "$D_OLD_ISO"
printf '| WXG-T-001 | 行内老日期但刚刚才提交 | 甲 | ✅ **完成（%s）** | 见详情 |\n' "$E_OLD" \
  >>"$REPO_E/production/TASKS.md"
stub_commit "$REPO_E" "$D_NOW_ISO"
OUT_E="$(node "$ARCHIVE_CMD" --root="$REPO_E" --days=30 2>&1)"
# 断言必须带「候选行」形状（`WXG-T-<号>｜完成日期 …`）⛔ 只搜裸号：
# 输出里的「全局最大号：WXG-T-003」会把没入选的号也拼中（实测假绿）。
assert_contains "$OUT_E" "WXG-T-1｜完成日期 ${E_OLD}" "[13a] 行内 40 天前 + blame 刚刚 ⇒ 入选（旧判据在此必不入选）"
assert_not_contains "$OUT_E" "WXG-T-2｜" "[13b] 行内 5 天 + blame 40 天 ⇒ 不入选（行内日期赢，重排不错搬）"
assert_contains "$OUT_E" "WXG-T-3｜完成日期" "[13c] 行内无日期 ⇒ 回退 blame（40 天）仍入选（兜底没被拆掉）"

# 为什么要这一组：I 项（提交窗口 vs 台账）在 --staged 只能降级为披露，因为窗口里有**他人**
# 欠账（WXG-T-407 实测：本批被 402/403 拦住）。而「本笔消息自己署的号」可以硬拦——K 项。
# 四条腿：a 在册号放行；b 未在册号必红；c 无号消息放行（那是 commitlint 的事）；
# d **登记行写了但没 git add** 仍必红——这条才是 K 相对 I 的真增益（读索引面不读工作树）。
echo "—— [14] K 项：--commit-msg 只校本笔署号（WXG-T-409）"
REPO_K="$WORK/repo-msgcheck"
new_repo "$REPO_K"
# 头注预先写到 002（而索引面只有 001 行）是**有意的**：F 项「头注号 ≥ 全局最大号」
# 对头注领先是合法的，于是工作树里多出的 002 行不会围住 F —— 否则把 K 项改成读工作树
# 也会被 F 项副产物拦下（实测），14d 就没有判别力了。
cat >"$REPO_K/production/TASKS.md" <<EOS
# 任务台账（桩）

> 当前已分配至 **WXG-T-002**，下一可用号 **WXG-T-003**。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | 甲行 | 甲 | ✅ 完成 | 见详情 |
EOS
cat >"$REPO_K/production/TASKS-DETAIL.md" <<EOS
# 详情台账（桩）

## WXG-T-001

正文甲
EOS
stub_commit "$REPO_K" "$D_NOW_ISO"
run_k() { ( cd "$REPO_K" && node "$CHECK_CMD" --commit-msg="$1" >/dev/null 2>&1 ); echo $?; }
printf 'feat(x): 已在册的改动 (WXG-T-001)\n' >"$WORK/msg-ok.txt"
printf 'feat(x): 台账没这个号 (WXG-T-777)\n' >"$WORK/msg-ghost.txt"
printf 'chore: 不署号的杂项改动\n' >"$WORK/msg-nonumber.txt"
assert_eq "$(run_k "$WORK/msg-ok.txt")" "0" "[14a] 本笔署已在册号 ⇒ 绿"
assert_eq "$(run_k "$WORK/msg-ghost.txt")" "1" "[14b] 本笔署未在册号 ⇒ 硬拦（不像 I 那样只披露）"
assert_eq "$(run_k "$WORK/msg-nonumber.txt")" "0" "[14c] 无号消息 ⇒ 放行（归 commitlint）"
# 14d 的号必须**接得上连续性**且行/节成对（否则被 A・C 项副产物拦下，本腿就没判别力了）：
# 实测——用不连续的 778 时，把 K 项改成读工作树也不会红（A 项替它拦了）⇒ 假判别。
printf '| WXG-T-002 | 写了但未 git add | 丁 | 🔄 在办 | 见详情 |\n' >>"$REPO_K/production/TASKS.md"
printf '\n## WXG-T-002\n\n正文乙\n' >>"$REPO_K/production/TASKS-DETAIL.md"
printf 'feat(x): 登记面没入索引 (WXG-T-002)\n' >"$WORK/msg-unstaged.txt"
assert_eq "$(run_k "$WORK/msg-unstaged.txt")" "1" "[14d] 登记行/节只在工作树、未 git add ⇒ 仍拦（读的是索引面）"
assert_contains "$( cd "$REPO_K" && node "$CHECK_CMD" --commit-msg="$WORK/msg-ghost.txt" 2>&1 )" "K: 本笔提交信息署" \
  "[14e] 拦下时得把 K 项诊断打印出来（⛔ 静默退出）"

# 为什么要这一组：同一个号被两批领用（K-046 同型）时，主表行与详情节各自都合法，
# 而 takeDetailSections 只按 ID 匹配 ⇒ 两份同号节会被一并搬走，节数 ≠ 行数 ⇒ 守恒 fail loud
# 整批不落盘（实测 87 行 vs 89 节）。撞号归属需人判（⛔ 不代填），归档器必须能绕开它。
# 四条腿覆盖**两个过滤点**：15b = 年龄档循环（candidates），15c = eligibleRows()（体积/详情档共用）
# ⇒ 只删一处必有一条红，不会「改了一处就骗绿」。
echo "—— [15] --skip-ids：撞号 / 待裁定行绕开（WXG-T-482）"
REPO_S="$WORK/repo-skipids"
new_repo "$REPO_S"
cat >"$REPO_S/production/TASKS.md" <<EOS
# 任务台账（桩）

> 当前已分配至 **WXG-T-003**，下一可用号 **WXG-T-004**。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
| WXG-T-001 | 甲行 | 甲 | ✅ **完成（${E_OLD}）** | 见详情 |
| WXG-T-002 | 乙行（撞号待裁） | 乙 | ✅ **完成（${E_OLD}）** | 见详情 |
| WXG-T-003 | 丙行 | 丙 | ✅ **完成（${E_OLD}）** | 见详情 |
EOS
cat >"$REPO_S/production/TASKS-DETAIL.md" <<EOS
# 详情台账（桩）

## WXG-T-001

正文甲

## WXG-T-002

正文乙

## WXG-T-003

正文丙
EOS
stub_commit "$REPO_S" "$D_OLD_ISO"
OUT_S0="$(node "$ARCHIVE_CMD" --root="$REPO_S" --days=30 2>&1)"
# 基线：断言候选行形状（`WXG-T-2｜完成日期`），⛔ 不搜裸号（「全局最大号：WXG-T-003」会拼中）
assert_contains "$OUT_S0" "WXG-T-2｜完成日期" "[15a] 无 --skip-ids ⇒ 002 入选（基线，后三条腿靠它证判别力）"
OUT_S1="$(node "$ARCHIVE_CMD" --root="$REPO_S" --days=30 --skip-ids=002 2>&1)"
assert_not_contains "$OUT_S1" "WXG-T-2｜" "[15b] 年龄档：002 被排除（candidates 循环那一处过滤）"
assert_contains "$OUT_S1" "WXG-T-1｜完成日期" "[15b-2] 排除只作用于名单内 —— 001 仍入选"
assert_contains "$OUT_S1" "命中 --skip-ids" "[15b-3] 跳过要留痕（⛔ 静默少搬一行）"
OUT_S2="$(node "$ARCHIVE_CMD" --root="$REPO_S" --until-under=1 --skip-ids=002 2>&1)"
assert_not_contains "$OUT_S2" "WXG-T-2｜" "[15c] 体积档：002 同样被排除（eligibleRows 那一处过滤）"
assert_eq "$( node "$ARCHIVE_CMD" --root="$REPO_S" --skip-ids=abc >/dev/null 2>&1; echo $? )" "1" \
  "[15d] 非法 --skip-ids ⇒ exit 1（fail loud，不静默当空集）"

echo "=================================================================="
echo "结果：PASS=$PASS FAIL=$FAIL"
echo "=================================================================="
[ "$FAIL" -eq 0 ] || exit 1
