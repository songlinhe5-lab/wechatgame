#!/usr/bin/env bash
# split-memory-detail-selftest.sh — memory 长节外移器的本地「桩」自测（WXG-T-106）。
#
# 目的：在不触碰真实 `memory/` 的前提下，验证「> 阈值的 `##` 节 → memory/details/」全行为：
#   [1] dry-run（默认）只列计划、不落盘（详情目录不创建、日记字节不变）
#   [2] --write：详情件正文**逐字节含原节全文**（含 ## 标题行）；日记只余「标题 + 指针」骨架；
#       未选中的小节**逐字节不动**；标题行保留 ⇒ 锚点不失效
#   [3] 幂等：重跑 → 无候选（骨架正文已低于阈值）
#   [4] 目标详情件已存在 → fail loud exit 1、日记与既有详情件均不改（不覆盖）
#   [5] **跨脚本契约**：产物用门禁侧同一解析器（makeFileRecord）+ memory-index 的
#       parseMemoryDetailLink / memoryDetailLinks 复核 ⇒ 隶属标记必须解析到现存 `##` 节；
#       并把标记里的日期改掉造一个孤儿，确认被判孤儿（否则「硬拦」是纸面硬拦）
#   [6] **幂等判据不得误伤**（真 bug 回归）：一节只是在正文里**提及** `memory/details/`
#       （讨论本机制本身）时仍须被选中外移；而它外移后的**真骨架**行才应被认出而跳过
#
# 用法：tools/scripts/split-memory-detail-selftest.sh
# 产物：仅 stdout 报告；临时目录退出时清理，不污染仓库。

set -uo pipefail
# 刻意不用 set -e —— 需要捕获被测脚本的各种退出码。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"   # 仓库根（本脚本在 tools/scripts/ 下 ⇒ 上溯两级）
SPLIT_CMD="$SCRIPT_DIR/split-memory-detail.mjs"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/wxg-split-memory-selftest.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

PASS=0
FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
assert_eq() { if [ "$1" = "$2" ]; then ok "$3（=$1）"; else bad "$3：期望 [$2]，实际 [$1]"; fi; }
assert_contains() { case "$1" in *"$2"*) ok "$3";; *) bad "$3：输出中找不到 [$2]";; esac; }
assert_not_contains() { case "$1" in *"$2"*) bad "$3：输出中不应出现 [$2]";; *) ok "$3";; esac; }
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
byte_same() { cmp -s "$1" "$2"; }

DATE="2026-01-05"
DIARY="memory/$DATE.md"
BIG_BODY='桩长节正文首句（用于摘要）

- 逐字节校验对象：✓ 中文 / emoji 🎮 / tab	混排。
- 这一节必须超过阈值，故写足够多的内容行——重复若干遍以稳定越过 600 tok 判定线。
'
mk_big() {
  {
    printf '## WXG-T-999：长节（须外移）\n\n'
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do printf '%s' "$BIG_BODY"; done
  }
}

echo "=================================================================="
echo "WXG-T-106 split-memory-detail 本地桩自测"
echo "被测: $SPLIT_CMD"
echo "工作目录: $WORK"
echo "=================================================================="

REPO="$WORK/repo"
mkdir -p "$REPO/memory"
{
  printf '# 2026-01-05（桩日记）\n\n'
  mk_big
  printf '\n## 短节（不得外移）\n\n- 一句话。\n'
} >"$REPO/$DIARY"
cp "$REPO/$DIARY" "$WORK/diary-backup.md"
# 短节的原文片段（用于 [2] 断言「未选中节逐字节不动」）
printf -- '- 一句话。\n' >"$WORK/short-fragment.txt"

# ── [1] dry-run：只列计划，不落盘 ───────────────────────────────────────────────
echo "—— [1] dry-run 不落盘"
OUT="$(node "$SPLIT_CMD" --date="$DATE" --root="$REPO" 2>&1)"; RC=$?
assert_eq "$RC" "0" "[1] dry-run 退出码 0"
assert_contains "$OUT" "2026-01-05-s01-t999.md" "[1] 计划列出详情件名（含任务号 slug）"
assert_not_contains "$OUT" "短节（不得外移）" "[1] 未达阈值的小节不入报告"
assert_not_contains "$OUT" "s02" "[1] 短节不入候选（无 s02）"
if [ ! -e "$REPO/memory/details" ]; then ok "[1] details 目录未创建"; else bad "[1] details 目录不应被创建"; fi
assert_eq "$(sha "$REPO/$DIARY")" "$(sha "$WORK/diary-backup.md")" "[1] 日记字节不变"

# ── [2] --write：逐字节外移 + 骨架替换 ─────────────────────────────────────────
echo "── [2] --write 落盘"
OUT="$(node "$SPLIT_CMD" --date="$DATE" --root="$REPO" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[2] --write 退出码 0"
DET="$REPO/memory/details/2026-01-05-s01-t999.md"
if [ -f "$DET" ]; then ok "[2] 详情件已创建"; else bad "[2] 详情件缺失"; fi
# 详情件 H1 隶属标记 + 原节全文（含 ## 标题行）逐字节包含
assert_contains "$(cat "$DET")" "# 隶属 · $DATE · §WXG-T-999：长节（须外移）" "[2] H1 隶属标记格式正确"
awk '/^## WXG-T-999/{f=1} f' "$WORK/diary-backup.md" >"$WORK/orig-section.txt"
grep -qxF "$(head -3 "$WORK/orig-section.txt" | tail -1)" "$DET" && ok "[2] 原节正文逐字节出现在详情件" || bad "[2] 详情件缺原文"
grep -qxF '## WXG-T-999：长节（须外移）' "$DET" && ok "[2] 详情件含原 ## 标题行" || bad "[2] 详情件缺标题行"
DIARYTXT="$(cat "$REPO/$DIARY")"
assert_contains "$DIARYTXT" "正文已外移" "[2] 日记骨架含指针"
assert_contains "$DIARYTXT" "## WXG-T-999：长节（须外移）" "[2] 日记保留节标题（锚点不失效）"
assert_contains "$DIARYTXT" "## 短节（不得外移）" "[2] 未选中节标题仍在"
byte_same <(grep -A2 '## 短节' "$REPO/$DIARY" | tail -1) "$WORK/short-fragment.txt" \
  && ok "[2] 未选中节内容逐字节不动" || bad "[2] 未选中节被改动"
if grep -q '逐字节校验对象' "$REPO/$DIARY"; then bad "[2] 日记仍含已外移正文（骨架不干净）"; else ok "[2] 长节正文已从日记移出"; fi

# ── [3] 幂等：重跑无候选 ───────────────────────────────────────────────────────
echo "—— [3] 幂等重跑"
A="$(sha "$REPO/$DIARY")"
OUT="$(node "$SPLIT_CMD" --date="$DATE" --root="$REPO" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[3] 重跑退出码 0"
assert_contains "$OUT" "无需外移" "[3] 重跑判为无候选"
assert_eq "$(sha "$REPO/$DIARY")" "$A" "[3] 重跑日记字节不变"

# ── [4] 目标详情件已存在 → fail loud、不覆盖 ───────────────────────────────────
echo "—— [4] 详情件重名 fail loud"
REPO2="$WORK/repo2"
mkdir -p "$REPO2/memory/details"
cp "$REPO/$DIARY" "$REPO2/$DIARY"
# 复制一份「已外移后的日记」再把它改回含长正文，同时预置同名详情件 → 触发冲突
mkdir -p "$REPO2/memory"
{ printf '# 2026-01-05（桩日记 2）\n\n'; mk_big; printf '\n## 短节\n\n- 一句话。\n'; } >"$REPO2/$DIARY"
printf '归档侧既有件（不得被覆盖）。\n' >"$REPO2/memory/details/2026-01-05-s01-t999.md"
cp "$REPO2/memory/details/2026-01-05-s01-t999.md" "$WORK/existing-backup.md"
A="$(sha "$REPO2/$DIARY")"
OUT="$(node "$SPLIT_CMD" --date="$DATE" --root="$REPO2" --write 2>&1)"; RC=$?
assert_eq "$RC" "1" "[4] 重名场景退出码 1（fail loud）"
assert_contains "$OUT" "不落盘" "[4] 明示不落盘"
byte_same "$REPO2/memory/details/2026-01-05-s01-t999.md" "$WORK/existing-backup.md" && ok "[4] 既有详情件未被覆盖" || bad "[4] 既有详情件被覆盖"
assert_eq "$(sha "$REPO2/$DIARY")" "$A" "[4] 日记未被改动"

# ── [5] 跨脚本契约：门禁侧解析必须认这条隶属标记 ───────────────────────────────
echo "—— [5] 隶属标记 ↔ 生成器/门禁同口径"
CONTRACT_OUT="$(cd "$ROOT" && node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { makeFileRecord } from './tools/scripts/lib/context-index.mjs';
import { memoryDetailLinks, parseMemoryDetailLink } from './tools/scripts/lib/memory-index.mjs';
const repo = process.argv[1];
const diary = readFileSync(repo + '/memory/2026-01-05.md', 'utf8');
const det = readFileSync(repo + '/memory/details/2026-01-05-s01-t999.md', 'utf8');
const dRec = makeFileRecord('memory/2026-01-05.md', diary);
const tRec = makeFileRecord('memory/details/2026-01-05-s01-t999.md', det);
const link = parseMemoryDetailLink(tRec.sections);
console.log(JSON.stringify({ link }, null, 0));
const idx = { files: [dRec, tRec] };
const { orphans, byDaily } = memoryDetailLinks(idx);
console.log(JSON.stringify({ orphans: orphans.length, hit: byDaily.size }, null, 0));
// 反向：把标记里的日期改错 → 必判孤儿（否则硬拦是纸面硬拦）
const bad = det.replace('# 隶属 · 2026-01-05 ·', '# 隶属 · 1999-12-31 ·');
const bRec = makeFileRecord('memory/details/2026-01-05-s02-t999.md', bad);
console.log(JSON.stringify({ badOrphan: memoryDetailLinks({ files: [dRec, bRec] }).orphans.length }, null, 0));
" "$REPO" 2>&1)"; RC=$?
assert_eq "$RC" "0" "[5] 契约脚本退出码 0"
assert_contains "$CONTRACT_OUT" '"date":"2026-01-05"' "[5] 标记被门禁侧解析出日期"
assert_contains "$CONTRACT_OUT" '"anchor":"§WXG-T-999：长节（须外移）"' "[5] 解析出的 anchor 与日记节 anchor 同串"
assert_contains "$CONTRACT_OUT" '"orphans":0,"hit":1' "[5] memoryDetailLinks 命中现存节、无孤儿"
assert_contains "$CONTRACT_OUT" '"badOrphan":1' "[5] 日期改错 ⇒ 必判孤儿（硬拦有效）"

# ── [6] 幂等判据不得误伤：正文「提及」 details 路径 ≠ 已外移 ─────────────────
echo "—— [6] 幂等判据不误伤正文提及"
REPO3="$WORK/repo3"
mkdir -p "$REPO3/memory"
{
  printf '# 2026-01-05（桩日记 3）\n\n'
  printf '## 讨论详情层本身的长节\n\n'
  for _ in $(seq 1 24); do
    printf '本节讨论 memory/details/ 这一层的口径与判例（**只是提及路径，并非骨架指针**）。\n'
  done
} >"$REPO3/$DIARY"
OUT="$(node "$SPLIT_CMD" --date="$DATE" --root="$REPO3" 2>&1)"; RC=$?
assert_eq "$RC" "0" "[6] dry-run 退出码 0"
assert_contains "$OUT" "2026-01-05-s01.md" "[6] 正文提及 details 路径的长节仍被选中"
assert_not_contains "$OUT" "⏭ 跳过" "[6] 不误判为已外移（旧实现在此静默跳过 ⇒ 长节永远拆不动）"
OUT="$(node "$SPLIT_CMD" --date="$DATE" --root="$REPO3" --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[6] --write 退出码 0"
if [ -f "$REPO3/memory/details/2026-01-05-s01.md" ]; then ok "[6] 详情件已创建"; else bad "[6] 详情件缺失"; fi
# 正向半边：把阈值降到骨架也会超阈（否则先被「体积不达标」筛掉，测不到指针判据）
# ⇒ 必靠 **SKELETON_RE 认出真骨架**而跳过，且不新建详情件。
OUT="$(node "$SPLIT_CMD" --date="$DATE" --root="$REPO3" --min-tokens=10 2>&1)"; RC=$?
assert_eq "$RC" "0" "[6] 降阈重跑退出码 0"
assert_contains "$OUT" "已含骨架指针" "[6] **真骨架行**被认出而跳过（指针判据正向有效）"
assert_eq "$(ls "$REPO3/memory/details" | wc -l | tr -d ' ')" "1" "[6] 降阈重跑未新增详情件（既有 1 件不变）"

echo "=================================================================="
echo "结果：PASS=$PASS FAIL=$FAIL"
echo "=================================================================="
[ "$FAIL" -eq 0 ] || exit 1
