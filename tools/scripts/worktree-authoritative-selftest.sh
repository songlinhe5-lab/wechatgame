#!/usr/bin/env bash
# worktree-authoritative-selftest.sh — 装置自指收敛性桩自测（WXG-T-112）。
#
# 被测不变式：凡 `ctx:build` 写盘的 .md，都必须列进 `lib/context-index.mjs::WORKTREE_AUTHORITATIVE`，
# 否则「重建 → add → 校」的 pre-commit 单遍不收敛（判例 BD-38：`memory/INDEX.md` 漏登记时
# 三种起手第一遍全红）。该坑**不在本地 build 暴露**，只惩罚每个提交的人 ⇒ 必须有可跑的证据。
#
#   [1] 静态对账：三个生成物常量全在工作树权威集合内（与 ctx:check 的门同一判据）
#   [2] 取源行为：三个生成物在 null / committed-dirty / staged-blobs 三类 gate 下一律 'worktree'
#   [3] **判别力对照**（否则 [2] 恒真）：同一 gate 下普通 dirty .md → 'head'、普通已暂存 .md → 'staged'
#   [4] 端到端**绿**：隔离 worktree 里改日记 → 只 add 自有改动 → 跑真 pre-commit → 一遍 exit 0
#   [5] 端到端**红**（红绿复现）：同一流程但把 'memory/INDEX.md' 从集合删掉 → 必须 exit 1
#       且诊断点名 memory/INDEX.md ⇒ 证明 [4] 的绿是本修法挣来的，不是环境巧合
#   [6] 对账门不空转：缺项源码下 `ctx:check` 必须以 C 项报红
#
# 用法：bash tools/scripts/worktree-authoritative-selftest.sh
# 产物：仅 stdout；临时目录与临时 worktree 退出时清理（不动本工作树、不动 develop）。

set -uo pipefail
# 刻意不用 set -e —— 需要捕获被测脚本与钩子的各种退出码。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/wxg-wa-selftest.XXXXXX")"
WT="$WORK/wt"
RED_LIB="$WORK/context-index-missing.mjs"

PASS=0
FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
assert_eq() { if [ "$1" = "$2" ]; then ok "$3（=$1）"; else bad "$3：期望 [$2]，实际 [$1]"; fi; }
assert_contains() { case "$1" in *"$2"*) ok "$3";; *) bad "$3：输出中找不到 [$2]";; esac; }

cleanup() {
  git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1
  rm -rf "$WORK" >/dev/null 2>&1
  git -C "$ROOT" worktree prune >/dev/null 2>&1
}
trap cleanup EXIT

echo "worktree-authoritative-selftest（WXG-T-112）"

# ── [1][2][3] lib 层：静态对账 + 取源行为 + 判别力对照 ─────────────────────────
( cd "$ROOT" && node --input-type=module -e '
import { WORKTREE_AUTHORITATIVE, BUDGET_MD_PATH, HOT_FILES_MD_PATH, resolveContent }
  from "./tools/scripts/lib/context-index.mjs";
import { MEMORY_INDEX_PATH } from "./tools/scripts/lib/memory-index.mjs";
import { relative, sep } from "node:path";

const rel = (p) => relative(process.cwd(), p).split(sep).join("/");
const GEN = [rel(BUDGET_MD_PATH), rel(HOT_FILES_MD_PATH), rel(MEMORY_INDEX_PATH)];
const CONTROL = "memory/MEMORY.md";
const g = (over = {}) => ({
  ok: true, workingTree: false, dirty: new Set(), untracked: new Set(),
  staged: new Set(), stagedBlobs: false, ...over,
});
const out = [];
for (const p of GEN) out.push(`SET|${p}|${WORKTREE_AUTHORITATIVE.has(p) ? "in" : "OUT"}`);
for (const p of GEN) {
  const cases = {
    nullgate: resolveContent(p, null),
    dirtyHead: resolveContent(p, g({ dirty: new Set([p]) })),
    stagedBlobs: resolveContent(p, g({ staged: new Set([p]), stagedBlobs: true, dirty: new Set([p]) })),
  };
  for (const [k, r] of Object.entries(cases)) out.push(`GEN|${p}|${k}|${r.source}`);
}
out.push(`CTL|dirty|${resolveContent(CONTROL, g({ dirty: new Set([CONTROL]) })).source}`);
out.push(`CTL|staged|${resolveContent(CONTROL, g({ staged: new Set([CONTROL]), stagedBlobs: true, dirty: new Set([CONTROL]) })).source}`);
console.log(out.join("\n"));
' > "$WORK/node.log" 2>&1 )
NODE_RC=$?
if [ $NODE_RC -ne 0 ]; then
  bad "lib 层探针执行失败（exit ${NODE_RC}）"; tail -5 "$WORK/node.log"
else
  NODE_OUT="$(cat "$WORK/node.log")"
  assert_eq "$(printf '%s' "$NODE_OUT" | grep -c '|in$')" "3" "[1] 三个生成物均在工作树权威集合内"
  assert_eq "$(printf '%s' "$NODE_OUT" | grep -c '|worktree$')" "9" "[2] 生成物 × 3 类 gate 全部取 worktree"
  assert_eq "$(printf '%s' "$NODE_OUT" | grep '^CTL|dirty|' | cut -d'|' -f3)" "head" "[3] 对照：dirty 普通文件仍取 HEAD blob"
  assert_eq "$(printf '%s' "$NODE_OUT" | grep '^CTL|staged|' | cut -d'|' -f3)" "staged" "[3] 对照：已暂存普通文件仍取暂存 blob"
fi

# ── [4][5][6] 端到端：隔离 worktree 里跑真 pre-commit（绿 ↔ 红）───────────────
git -C "$ROOT" worktree add --detach "$WT" HEAD >/dev/null 2>&1
if [ ! -d "$WT" ]; then
  bad "[4] 无法创建隔离 worktree ⇒ 端到端组未执行（不假绿）"
else
  # 被测的是**真 pre-commit**，它按项目约定走 `pnpm run check:*`。新建的 worktree 里没有
  # node_modules：pnpm 9 容忍，pnpm 10（CI 用 10.28.2，见 ci.yml 的 Install 注释）会以
  # 「did you mean to install?」拒绝执行 ⇒ 本组在 CI 上必红（本地却绿）。用软链把主工作树
  # 已装的依赖接进去（node_modules 已被 .gitignore 忽略，不污染 worktree）。
  if [ -d "$ROOT/node_modules" ]; then
    ln -sfn "$ROOT/node_modules" "$WT/node_modules"
  fi
  # 缺项版 lib（用于红测）：把登记行删掉，其余不动
  grep -v "^  'memory/INDEX\.md',$" "$ROOT/tools/scripts/lib/context-index.mjs" > "$RED_LIB"
  if ! grep -q "WORKTREE_AUTHORITATIVE = new Set(\[" "$RED_LIB"; then
    bad "缺项版 lib 构造失败（源文件形态与预期不符）"
  fi

  # 每遍都从当前工作树取被测源码：HEAD 里可能还没有本单的改动
  run_hook_once() {  # $1 = 探针行（空则不改日记）  $2 = 要覆盖的 context-index.mjs 源
    git -C "$WT" reset --hard HEAD >/dev/null 2>&1
    git -C "$WT" clean -fdq -- . >/dev/null 2>&1
    cp "$ROOT/tools/scripts/lib/memory-index.mjs" "$WT/tools/scripts/lib/memory-index.mjs"
    cp "$ROOT/tools/scripts/build-context-index.mjs" "$WT/tools/scripts/build-context-index.mjs"
    cp "$ROOT/tools/scripts/check-context-budget.mjs" "$WT/tools/scripts/check-context-budget.mjs"
    cp "${2:-$ROOT/tools/scripts/lib/context-index.mjs}" "$WT/tools/scripts/lib/context-index.mjs"
    if [ -n "$1" ]; then
      printf '\n%s\n' "$1" >> "$WT/memory/2026-09-15.md"
      git -C "$WT" add memory/2026-09-15.md
    fi
    ( cd "$WT" && sh .githooks/pre-commit ) 2>&1
  }

  GREEN_LOG="$(run_hook_once "> selftest probe (WXG-T-112)" "")"; GREEN_RC=$?
  if [ $GREEN_RC -eq 0 ]; then ok "[4] 修法在位时 pre-commit 第一遍即绿（单遍收敛）"
  else bad "[4] 第一遍被拦（exit ${GREEN_RC}）：$(printf '%s' "$GREEN_LOG" | grep '❌' | head -2)"; fi

  RED_LOG="$(run_hook_once "> selftest red probe (WXG-T-112)" "$RED_LIB")"; RED_RC=$?
  assert_eq "$RED_RC" "1" "[5] 撤掉登记后同一流程被拦（红绿复现，非恒绿）"
  assert_contains "$RED_LOG" "memory/INDEX.md" "[5] 红测诊断点名 memory/INDEX.md"

  ( cd "$WT" && node tools/scripts/check-context-budget.mjs > "$WORK/gate.log" 2>&1 )
  GATE_RC=$?
  assert_eq "$GATE_RC" "1" "[6] 缺项时 ctx:check 对账门报红（守卫不空转）"
  assert_contains "$(cat "$WORK/gate.log")" "WORKTREE_AUTHORITATIVE" "[6] 红测输出给出修法指引"
fi

echo "────────────────────────────────────────"
echo "PASS=${PASS} FAIL=${FAIL}"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
