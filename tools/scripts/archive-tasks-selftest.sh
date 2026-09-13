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

echo "=================================================================="
echo "结果：PASS=$PASS FAIL=$FAIL"
echo "=================================================================="
[ "$FAIL" -eq 0 ] || exit 1
