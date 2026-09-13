#!/usr/bin/env bash
# distill-memory-selftest.sh — memory:distill 的本地「桩」自测（WXG-T-041，对策 R2）。
#
# 目的：在不触碰真实 `memory/` 的前提下，验证日志 30 天蒸馏轮转器全行为。
# 做法：在临时目录构造**桩 memory 目录**（脚本判定读文件名 YYYY-MM-DD，无需 git），
#       用 node 生成「40 天前 / 29 天前 / 今天」的日志文件名，核对：
#         ① dry-run（默认）只列候选、不落盘（日志 / MEMORY.md 字节不变、archive 目录不创建）
#         ② --write：满 30 天日志移入 memory/archive/（原文逐字节保留）+ MEMORY.md 追加待蒸馏占位
#         ③ 安全边界：29 天 / 今天的日志逐字节不动；非 YYYY-MM-DD 命名文件不动；日期非法（2026-13-40）不动
#         ④ 幂等：--write 重跑 → 0 候选空转不落盘（MEMORY.md / 归档字节不变）
#         ⑤ 0 候选仓库 --write：archive 目录不创建、MEMORY.md 不变
#         ⑥ 防重复归档：memory/ 与 memory/archive/ 同名并存 → 跳过告警、不覆盖、不写 MEMORY.md
#         ⑦ MEMORY.md 缺失 --write：fail loud exit 1、日志原件保留
#
# 用法：tools/scripts/distill-memory-selftest.sh
# 产物：仅 stdout 报告；临时目录退出时清理，不污染仓库。

set -uo pipefail
# 刻意不用 set -e —— 需要捕获被测脚本的各种退出码。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISTILL_CMD="$SCRIPT_DIR/distill-memory.mjs"
PASS=0
FAIL=0

WORK="$(mktemp -d "${TMPDIR:-/tmp}/wxg-memory-distill-selftest.XXXXXX")"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

ok()  { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
assert_eq() { if [ "$1" = "$2" ]; then ok "$3（=$1）"; else bad "$3：期望 [$2]，实际 [$1]"; fi; }
assert_contains() { case "$1" in *"$2"*) ok "$3";; *) bad "$3：输出中找不到 [$2]";; esac; }
assert_not_contains() { case "$1" in *"$2"*) bad "$3：输出中不应出现 [$2]";; *) ok "$3";; esac; }
sha() { shasum -a 256 "$1" | awk '{print $1}'; }
byte_same() { cmp -s "$1" "$2"; }

# 桩文件名：$1 = 天数偏移 → YYYY-MM-DD.md（与被测脚本同样按 UTC 日界整天计算）。
dname() { node -e "console.log(new Date(Date.now() - $1 * 864e5).toISOString().slice(0,10) + '.md')"; }

new_repo() {
  local repo="$1"
  mkdir -p "$repo/memory"
}

OLD_NAME="$(dname 40)"   # 满 30 天 → 候选
MID_NAME="$(dname 29)"   # 29 天 → 保留（并覆盖「恰好不到 30 天」边界一侧）
TODAY_NAME="$(dname 0)"  # 今天 → 保留（并发会话可能正在写）
OLD_BODY='# 2026-08-04（桩老日志）

## 老会话记录
- 逐字节保留校验对象：✓ 中文 / emoji 🎮 / 空行与 tab	混排。
- 内容本身任意——脚本不读非候选文件。'
OLD_BODY="$OLD_BODY"$'\n\t 行尾带 tab 的行	'

echo "=================================================================="
echo "WXG-T-041 memory:distill 本地桩自测"
echo "被测: $DISTILL_CMD"
echo "工作目录: $WORK"
echo "=================================================================="

# ── 造主桩仓库：40 天前老日志（候选）+ 29 天 / 今天日志（保留）+ 非日期命名 + 日期非法 ──
REPO="$WORK/repo"
new_repo "$REPO"
MEM="$REPO/memory"
cat >"$MEM/MEMORY.md" <<'EOF'
# 长期笔记（桩）

## 项目约定
- 既有条目（不得被改动）。
EOF
# 把 MEMORY.md 的 mtime 回拨到 45 天前（早于 40 天前的老日志）→ 覆盖「先蒸馏再归档」弱证据分支。
touch -t "$(node -e 'const d=new Date(Date.now()-45*864e5);const p=(n)=>String(n).padStart(2,"0");console.log(d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+"0000")')" "$MEM/MEMORY.md"
printf '%s\n' "$OLD_BODY" >"$MEM/$OLD_NAME"
printf '29 天前的日志，不得被归档。\n' >"$MEM/$MID_NAME"
printf '今天的日志，并发会话可能正在追加。\n' >"$MEM/$TODAY_NAME"
printf '非日期命名文件。\n' >"$MEM/notes.md"
printf '日期非法。\n' >"$MEM/2026-13-40.md"
cp "$MEM/MEMORY.md" "$WORK/memory-md-backup.md"
cp "$MEM/$OLD_NAME" "$WORK/old-body-backup.md"
cp "$MEM/$MID_NAME" "$WORK/mid-backup.md"
cp "$MEM/$TODAY_NAME" "$WORK/today-backup.md"
cp "$MEM/notes.md" "$WORK/notes-backup.md"

# ── [1] dry-run（默认）：只列候选，不落盘 ──────────────────────────────────────
echo "—— [1] dry-run（默认）不落盘"
OUT="$(node "$DISTILL_CMD" --root="$REPO" 2>&1)"; RC=$?
assert_eq "$RC" "0" "[1] dry-run 退出码 0"
assert_contains "$OUT" "→ 候选｜$OLD_NAME" "[1] 40 天前日志入候选"
assert_contains "$OUT" "未落盘" "[1] 明示未落盘"
assert_contains "$OUT" "先蒸馏再归档" "[1] 候选附蒸馏弱证据提示"
assert_not_contains "$OUT" "→ 候选｜$MID_NAME" "[1] 29 天日志不入候选"
assert_not_contains "$OUT" "→ 候选｜$TODAY_NAME" "[1] 今天日志不入候选"
assert_contains "$OUT" "⏸ 保留｜$MID_NAME" "[1] 29 天日志列为保留"
assert_contains "$OUT" "非 YYYY-MM-DD 命名" "[1] notes.md 判为命名不符不动"
assert_contains "$OUT" "日期非法" "[1] 2026-13-40.md 判为日期非法不动"
assert_eq "$(sha "$MEM/$OLD_NAME")" "$(sha "$WORK/old-body-backup.md")" "[1] 老日志字节不变"
assert_eq "$(sha "$MEM/MEMORY.md")" "$(sha "$WORK/memory-md-backup.md")" "[1] MEMORY.md 字节不变"
if [ ! -e "$MEM/archive" ]; then ok "[1] archive 目录未创建"; else bad "[1] archive 目录不应被创建"; fi

# ── [2] --write：老日志归档（逐字节）、其余不动、MEMORY.md 追加占位 ─────────────
echo "—— [2] --write 真实归档"
OUT="$(node "$DISTILL_CMD" --root="$REPO" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[2] --write 退出码 0"
assert_contains "$OUT" "回读校验一致" "[2] 归档副本逐字节回读校验通过"
if [ -f "$MEM/archive/$OLD_NAME" ]; then ok "[2] 归档文件已创建"; else bad "[2] 归档文件缺失"; fi
byte_same "$MEM/archive/$OLD_NAME" "$WORK/old-body-backup.md" && ok "[2] 归档原文逐字节保留" || bad "[2] 归档内容与原件不等"
if [ ! -e "$MEM/$OLD_NAME" ]; then ok "[2] 原位文件已移走"; else bad "[2] 原位文件仍在"; fi
byte_same "$MEM/$MID_NAME" "$WORK/mid-backup.md" && ok "[2] 29 天日志逐字节不动" || bad "[2] 29 天日志被改动"
byte_same "$MEM/$TODAY_NAME" "$WORK/today-backup.md" && ok "[2] 今天日志逐字节不动" || bad "[2] 今天日志被改动"
byte_same "$MEM/notes.md" "$WORK/notes-backup.md" && ok "[2] 非日期命名文件不动" || bad "[2] notes.md 被改动"
MEMTXT="$(cat "$MEM/MEMORY.md")"
assert_contains "$MEMTXT" "归档待蒸馏提醒" "[2] MEMORY.md 追加待蒸馏占位段"
assert_contains "$MEMTXT" "memory/archive/$OLD_NAME" "[2] 占位提醒指向归档路径"
assert_contains "$MEMTXT" "既有条目（不得被改动）。" "[2] MEMORY.md 原有内容保留"

# ── [3] 幂等：--write 重跑 0 候选空转 ──────────────────────────────────────────
echo "—— [3] 幂等重跑"
A="$(sha "$MEM/MEMORY.md")"; B="$(sha "$MEM/archive/$OLD_NAME")"
OUT="$(node "$DISTILL_CMD" --root="$REPO" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[3] 重跑退出码 0"
assert_contains "$OUT" "无可归档" "[3] 重跑提示无可归档"
assert_contains "$OUT" "不落盘" "[3] 明示空转不落盘"
assert_eq "$(sha "$MEM/MEMORY.md")" "$A" "[3] 重跑 MEMORY.md 字节不变"
assert_eq "$(sha "$MEM/archive/$OLD_NAME")" "$B" "[3] 重跑归档字节不变"

# ── [4] 0 候选仓库 --write：不创建 archive、不写 MEMORY.md ─────────────────────
echo "—— [4] 0 候选（对应真实仓库首轮：日志均 <30 天）"
REPO2="$WORK/repo2"
new_repo "$REPO2"
M2="$REPO2/memory"
printf '# 长期笔记（桩 2）\n' >"$M2/MEMORY.md"
cp "$M2/MEMORY.md" "$WORK/repo2-md-backup.md"
printf '新鲜日志。\n' >"$M2/$TODAY_NAME"
OUT="$(node "$DISTILL_CMD" --root="$REPO2" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[4] 0 候选 --write 退出码 0"
assert_contains "$OUT" "无可归档" "[4] 提示无可归档"
if [ ! -e "$M2/archive" ]; then ok "[4] archive 目录未被创建"; else bad "[4] archive 目录不应存在"; fi
assert_eq "$(sha "$M2/MEMORY.md")" "$(sha "$WORK/repo2-md-backup.md")" "[4] MEMORY.md 字节不变"
if [ -f "$M2/$TODAY_NAME" ]; then ok "[4] 新鲜日志未动"; else bad "[4] 新鲜日志被误动"; fi

# ── [5] 防重复归档：memory/ 与 archive/ 同名并存 → 跳过不覆盖、不写 MEMORY.md ──
echo "—— [5] 归档重名防护"
REPO3="$WORK/repo3"
new_repo "$REPO3"
M3="$REPO3/memory"
printf '# 长期笔记（桩 3）\n' >"$M3/MEMORY.md"
mkdir -p "$M3/archive"
printf '归档侧内容（不得被覆盖）。\n' >"$M3/archive/$OLD_NAME"
printf '原位老日志。\n' >"$M3/$OLD_NAME"
cp "$M3/$OLD_NAME" "$WORK/repo3-old-backup.md"
cp "$M3/archive/$OLD_NAME" "$WORK/repo3-arch-backup.md"
A="$(sha "$M3/MEMORY.md")"
OUT="$(node "$DISTILL_CMD" --root="$REPO3" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[5] 重名场景退出码 0"
assert_contains "$OUT" "同名文件——跳过" "[5] 告警归档重名"
byte_same "$M3/$OLD_NAME" "$WORK/repo3-old-backup.md" && ok "[5] 原位老日志未动" || bad "[5] 原位老日志被改动"
byte_same "$M3/archive/$OLD_NAME" "$WORK/repo3-arch-backup.md" && ok "[5] 归档侧未被覆盖" || bad "[5] 归档侧被覆盖"
assert_eq "$(sha "$M3/MEMORY.md")" "$A" "[5] MEMORY.md 未追加（无新增归档）"

# ── [6] MEMORY.md 缺失 --write：fail loud、原件保留 ────────────────────────────
echo "—— [6] MEMORY.md 缺失 fail loud"
REPO4="$WORK/repo4"
new_repo "$REPO4"
M4="$REPO4/memory"
printf '老日志。\n' >"$M4/$OLD_NAME"
cp "$M4/$OLD_NAME" "$WORK/repo4-old-backup.md"
OUT="$(node "$DISTILL_CMD" --root="$REPO4" --write 2>&1)"; RC=$?
assert_eq "$RC" "1" "[6] MEMORY.md 缺失退出码 1"
assert_contains "$OUT" "不存在" "[6] 明示 MEMORY.md 缺失"
byte_same "$M4/$OLD_NAME" "$WORK/repo4-old-backup.md" && ok "[6] 日志原件保留" || bad "[6] 日志原件被动"

echo "=================================================================="
echo "结果：PASS=$PASS FAIL=$FAIL"
echo "=================================================================="
[ "$FAIL" -eq 0 ] || exit 1
