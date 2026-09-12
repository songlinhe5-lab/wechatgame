#!/usr/bin/env bash
# ci-pr-review-selftest.sh — ci-pr-review.sh 的本地端到端「桩」自测（WXG-T-025）。
#
# 目的：在**不依赖真实 CURSOR_API_KEY / Cursor CLI** 的前提下，证明 ARG_MAX 修复成立。
# 做法：用桩可执行文件冒充 agent（经 AGENT_BIN 注入，默认仍是 agent，CI 不受影响），
#       在一个**临时 git 仓库**里构造各种 diff，跑真实的 ci-pr-review.sh，核对：
#         ① 大 diff 下 argv 体积恒定（对照：修复前脚本会以 Argument list too long 崩溃）
#         ② 桩能按 prompt 给的路径读到 diff 文件，且大小正确
#         ③ 排除后超 300KB 触发截断，且 DIFF TRUNCATED 标记存在
#         ④ 排除清单生效（ctx/index.json / **/levels-data.ts 不进 diff 内容）
#         ⑤ 门禁四种 VERDICT 语义：PASS→0、CONCERNS→0、FAIL→1、无 verdict→1、agent 非 0→非 0
#
# 用法：tools/scripts/ci-pr-review-selftest.sh
# 产物：仅 stdout 报告；临时目录在退出时清理，不污染仓库 / CI。

set -uo pipefail
# 注意：本脚本刻意**不**用 set -e —— 需要捕获被测脚本的各种退出码。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REVIEW_SCRIPT="$SCRIPT_DIR/ci-pr-review.sh"
MAIN_REPO="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR/../..")"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/wxg-review-selftest.XXXXXX")"
STUB="$WORK/stub-agent"
BIN_DIR="$WORK/bin"
REPO="$WORK/repo"
DIFFCOPY="$WORK/diff-copy.patch"
PASS=0
FAIL=0

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

ok()  { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
assert_eq() { if [ "$1" = "$2" ]; then ok "$3（=$1）"; else bad "$3：期望 [$2]，实际 [$1]"; fi; }
assert_contains() { case "$1" in *"$2"*) ok "$3";; *) bad "$3：输出中找不到 [$2]";; esac; }

# ── 桩 agent ────────────────────────────────────────────────────────────────
cat >"$STUB" <<'STUB_EOF'
#!/usr/bin/env bash
# 桩 agent：把 argv 体积、diff 文件状态写入 STUB_LOG，并产出含合法 VERDICT 的评审文本。
set -u
log="${STUB_LOG:?STUB_LOG not set}"
prompt=""
argv_bytes=0
for a in "$@"; do
  prompt="$a"                                   # 取最后一个参数（脚本传给 CLI 的 prompt）
  argv_bytes=$(( argv_bytes + ${#a} ))
done
diff_path="$(printf '%s' "$prompt" | grep -oE '/[^[:space:]]*\.review/diff\.patch' | head -1)"
diff_exists=no
diff_size=0
truncated_marker=no
if [ -n "$diff_path" ] && [ -f "$diff_path" ]; then
  diff_exists=yes
  diff_size=$(wc -c <"$diff_path" | tr -d ' ')
  grep -q 'DIFF TRUNCATED' "$diff_path" && truncated_marker=yes
  if [ -n "${STUB_DIFF_COPY:-}" ]; then cp "$diff_path" "$STUB_DIFF_COPY"; fi
fi
{
  echo "argv_bytes=$argv_bytes"
  echo "argc=$#"
  echo "prompt_bytes=${#prompt}"
  echo "diff_exists=$diff_exists"
  echo "diff_size=$diff_size"
  echo "truncated_marker=$truncated_marker"
} >>"$log"
echo "## Stub review"
echo "argv_bytes=$argv_bytes diff_exists=$diff_exists diff_size=$diff_size"
if [ "${STUB_VERDICT:-CONCERNS}" != "NONE" ]; then
  echo "VERDICT: ${STUB_VERDICT:-CONCERNS}"
fi
exit "${STUB_EXIT:-0}"
STUB_EOF
chmod +x "$STUB"
# 供「修复前」对照使用：把桩放到 PATH 上作为 `agent`（旧脚本不接受 AGENT_BIN）。
mkdir -p "$BIN_DIR"
cp "$STUB" "$BIN_DIR/agent"
chmod +x "$BIN_DIR/agent"

# ── 临时仓库 ────────────────────────────────────────────────────────────────
mkdir -p "$REPO"
git -C "$REPO" init -q
git -C "$REPO" config user.email t@t
git -C "$REPO" config user.name t
git -C "$REPO" config commit.gpgsign false
echo "hello" >"$REPO/a.txt"
git -C "$REPO" add -A && git -C "$REPO" commit -qm "base files"
BASE="$(git -C "$REPO" rev-parse HEAD)"

# 运行被测脚本；$1=base  $2=STUB_VERDICT  $3=STUB_EXIT  $4(STUB_DIFF_COPY 可选)
run_review() {
  : >"$WORK/stub.log"
  ( cd "$REPO" \
      && AGENT_BIN="$STUB" \
         CURSOR_API_KEY=dummy-key \
         CURSOR_REVIEW_MODEL=auto \
         STUB_LOG="$WORK/stub.log" \
         STUB_VERDICT="$2" \
         STUB_EXIT="${3:-0}" \
         STUB_DIFF_COPY="${4:-}" \
         bash "$REVIEW_SCRIPT" "$1" ) >"$WORK/stdout.txt" 2>&1
  return $?
}
logval() { grep -E "^$1=" "$WORK/stub.log" | head -1 | cut -d= -f2; }

echo "=================================================================="
echo "WXG-T-025 ci-pr-review.sh 本地桩自测"
echo "脚本: $REVIEW_SCRIPT"
echo "工作目录: $WORK"
echo "内核 ARG_MAX: $(getconf ARG_MAX 2>/dev/null || echo 'n/a') bytes"
echo "=================================================================="

# ── [1] 小 diff：建立 argv 基线 ─────────────────────────────────────────────
echo
echo "[1] 小 diff（仅 a.txt 追加一行）"
echo "line2" >>"$REPO/a.txt"
git -C "$REPO" add -A && git -C "$REPO" commit -qm "small change"
run_review "$BASE" CONCERNS 0; rc1=$?
argv_small="$(logval argv_bytes)"
assert_eq "$rc1" "0" "CONCERNS → exit 0（门禁放行）"
assert_eq "$(logval diff_exists)" "yes" "桩按 prompt 中的路径读到 diff 文件"
echo "     小 diff 基线 argv_bytes=${argv_small}，diff_size=$(logval diff_size)"

# ── [2] 对照：修复前实现（把 diff 内联进 argv）会崩 ────────────────────────
echo
echo "[2] 对照：修复前实现把 diff 内联进 argv → ARG_MAX 超限崩溃"
head -c 10485760 /dev/zero | tr '\0' 'A' >"$REPO/big.txt"
git -C "$REPO" add -A && git -C "$REPO" commit -qm "add 10MB non-excluded file"

# (a) 从历史取回「未含本次重写」的旧脚本：跳过含新标记 'Excluded paths' 的提交
LEGACY_REF=""
while IFS= read -r _h; do
  if ! git -C "$MAIN_REPO" show "$_h:tools/scripts/ci-pr-review.sh" 2>/dev/null | grep -q 'Excluded paths'; then
    LEGACY_REF="$_h"
    break
  fi
done < <(git -C "$MAIN_REPO" log --format=%H -- tools/scripts/ci-pr-review.sh 2>/dev/null)

if [ -n "$LEGACY_REF" ]; then
  LEGACY_SCRIPT="$WORK/legacy-review.sh"
  git -C "$MAIN_REPO" show "$LEGACY_REF:tools/scripts/ci-pr-review.sh" >"$LEGACY_SCRIPT" 2>/dev/null
  echo "     旧版来源提交：$LEGACY_REF"
  : >"$WORK/stub.log"
  ( cd "$REPO" && PATH="$BIN_DIR:$PATH" CURSOR_API_KEY=dummy-key \
        STUB_LOG="$WORK/stub.log" STUB_VERDICT=CONCERNS \
        REVIEW_OUT="$REPO/review.md" bash "$LEGACY_SCRIPT" "$BASE" ) >"$WORK/orig-stdout.txt" 2>&1
  orig_rc=$?
  orig_msg="$(grep -i 'Argument list too long' "$WORK/orig-stdout.txt" | head -1)"
  if [ "$orig_rc" -ne 0 ] && [ -n "$orig_msg" ]; then
    ok "修复前复现失败：exit=${orig_rc}，$(echo "$orig_msg" | sed 's#.*: ##' | tr -d '\r')"
  elif [ "$orig_rc" -ne 0 ]; then
    ok "修复前在大 diff 下非 0 退出：exit=${orig_rc}"
  else
    bad "修复前脚本竟未失败（exit=0）—— 环境差异，请人工核实"
  fi
else
  echo "  ⚠️ 历史中找不到旧版脚本，仅用下方直接证据"
fi

# (b) 与历史无关的直接证据：把 10MB 作为**单个 argv** 传给桩 → execve E2BIG
BIGARG="$(head -c 10485760 /dev/zero | tr '\0' 'A')"
"$STUB" -p "$BIGARG" >/dev/null 2>"$WORK/e2big.txt"
e2big_rc=$?
if [ "$e2big_rc" -ne 0 ] && grep -qi 'Argument list too long' "$WORK/e2big.txt"; then
  ok "直接证据：单参数 10MB → exit=${e2big_rc}，'Argument list too long'（旧实现的必然后果）"
elif [ "$e2big_rc" -ne 0 ]; then
  ok "直接证据：单参数 10MB → exit=${e2big_rc}（$(head -1 "$WORK/e2big.txt")）"
else
  bad "单参数 10MB 竟未失败（exit=0）—— 环境差异"
fi

# ── [3] 大 diff：argv 恒等 + 300KB 截断 + 标记 ──────────────────────────────
echo
echo "[3] 大 diff（含 10MB 非排除文件）→ argv 恒等 + 300KB 截断"
run_review "$BASE" CONCERNS 0 "$DIFFCOPY"; rc2=$?
argv_big="$(logval argv_bytes)"
diff_size_big="$(logval diff_size)"
assert_eq "$rc2" "0" "大 diff 仍能跑到 VERDICT（门禁不因体积崩溃）"
assert_eq "$argv_big" "$argv_small" "① argv 体积与 diff 体积无关（大 diff == 小 diff）"
assert_eq "$(logval diff_exists)" "yes" "② 桩能读到 diff 文件"
if [ "${diff_size_big:-0}" -ge 307200 ] && [ "${diff_size_big:-0}" -le 307400 ]; then
  ok "③ 截断生效：diff 文件 ${diff_size_big} bytes（=300KB + 标记）"
else
  bad "③ 截断异常：diff 文件 ${diff_size_big} bytes（期望 ≈307200~307400）"
fi
assert_eq "$(logval truncated_marker)" "yes" "③ 末尾存在 DIFF TRUNCATED 标记"
echo "     大 diff argv_bytes=${argv_big}（= 小 diff，证明与体积无关）"

# ── [4] 排除清单生效 ────────────────────────────────────────────────────────
echo
echo "[4] 排除清单：ctx/index.json（~600KB 生成物）与 levels-data.ts 不进 diff"
mkdir -p "$REPO/ctx" "$REPO/games/x/src/config"
head -c 600000 /dev/zero | tr '\0' 'C' >"$REPO/ctx/index.json"
printf 'export const LEVELS = [];\n' >"$REPO/games/x/src/config/levels-data.ts"
echo "yet another normal change" >>"$REPO/a.txt"
git -C "$REPO" add -A && git -C "$REPO" commit -qm "excluded artifacts + normal change"
run_review "$BASE" CONCERNS 0 "$DIFFCOPY"; rc3=$?
assert_eq "$rc3" "0" "含生成物的 PR 正常跑到 VERDICT"
assert_contains "$(cat "$WORK/stdout.txt")" "ctx/index.json" "④ stdout 列出被排除的 ctx/index.json（命中计数透明化）"
assert_contains "$(cat "$WORK/stdout.txt")" "levels-data.ts" "④ stdout 列出被排除的 levels-data.ts"
if grep -q 'diff --git a/ctx/index.json' "$DIFFCOPY" 2>/dev/null; then
  bad "④ 排除失败：ctx/index.json 仍出现在 diff 内容中"
else
  ok "④ 排除生效：diff 内容不含 ctx/index.json"
fi
if grep -q 'levels-data.ts' "$DIFFCOPY" 2>/dev/null; then
  bad "④ 排除失败：levels-data.ts 仍出现在 diff 内容中"
else
  ok "④ 排除生效：diff 内容不含 levels-data.ts"
fi

# ── [5] 门禁四种 VERDICT 语义（与修复前一致）───────────────────────────────
echo
echo "[5] 门禁语义：PASS / FAIL / 无 verdict / agent 非 0"
run_review "$BASE" PASS 0;      assert_eq "$?" "0" "VERDICT: PASS → exit 0"
run_review "$BASE" CONCERNS 0;  assert_eq "$?" "0" "VERDICT: CONCERNS → exit 0"
run_review "$BASE" FAIL 0;      assert_eq "$?" "1" "VERDICT: FAIL → exit 1"
run_review "$BASE" NONE 0;      assert_eq "$?" "1" "无合法 VERDICT → exit 1（fail-closed）"
run_review "$BASE" CONCERNS 3;  assert_eq "$?" "3" "agent 非 0 退出（3）→ 脚本非 0（透传）"

# ── [6] review.md 头部透明化 + 临时目录清理 ─────────────────────────────────
echo
echo "[6] review.md 头部透明化 + 临时目录清理"
run_review "$BASE" CONCERNS 0 >/dev/null
if [ -f "$REPO/review.md" ]; then
  ok "review.md 已产出"
  assert_contains "$(cat "$REPO/review.md")" "已排除路径" "review.md 头部含排除清单说明"
else
  bad "review.md 未产出"
fi
if [ -e "$REPO/.review" ]; then
  bad "trap 未清理 .review/ 临时目录"
else
  ok "trap 已清理 .review/ 临时目录（无残留）"
fi

# ── 汇总 ────────────────────────────────────────────────────────────────────
echo
echo "=================================================================="
echo "结果：PASS=$PASS  FAIL=$FAIL"
echo "=================================================================="
[ "$FAIL" -eq 0 ]
