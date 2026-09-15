#!/usr/bin/env bash
# split-knowledge-lessons-selftest.sh — lessons 按标签分片的本地「桩」自测（WXG-T-111）。
#
# 覆盖（每项都是「不测就可能假绿」的行为，非装饰性断言）：
#   [1] dry-run：只出映射，不建目录、不写文件、源文件字节不变
#   [2] --write：分片内条目**逐字节**与源一致（第二套实现回拼比对，不自比）；片内按 ID 升序
#   [3] 指针页存在且**不含任何条目正文**（否则 K-0NN 两处并存，活跃块 ↔ md 双向一致必裂）
#   [4] 未知标签 → exit 1 且点名条目（**fail loud**，不静默丢弃；丢一条沉淀就是丢证据）
#   [5] 缺 [K-0NN] → exit 1（提示先 kb:sync 补号），且零产物（不留下半套布局）
#   [6] ACTIVE_FILES：目录存在 → 动态枚举（已知片按冻结序、未知片按名序 appended）；
#       目录不存在 → 回退旧布局单文件（判例 K-030：产物清单与消费方必须同源）
#   [7] 跨分片补号单调：分片后新增未编号条目 → 号 = 全局最大 +1，且落位文件 = 条目所在片
#   [8] 归档共用单份：两个分片各归档一条 → 同一 `lessons-archived.md`，
#   [9] 二跑守卫：已分片后再跑 → exit 0 且零字节改动；`--force --source=` 仍可重切；
#       脚本注释里引用的 lib 符号名必须在 lib 真实导出（防 K-035 型「文档写了、码里没有」）
#       且日志目的地按 `file` 反查得出（回归本轮修掉的硬编码三元）
#
# 用法：tools/scripts/split-knowledge-lessons-selftest.sh
#   入口：pnpm run knowledge:split:selftest
# 产物：仅 stdout 报告；临时目录退出时清理，不污染仓库、**不碰真实 knowledge/**。

set -uo pipefail
# 刻意不用 set -e —— 需要捕获被测脚本的各种退出码。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/wxg-split-kb-selftest.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

PASS=0
FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
assert_eq() { if [ "$1" = "$2" ]; then ok "$3（=$1）"; else bad "$3：期望 [$2]，实际 [$1]"; fi; }
assert_contains() { case "$1" in *"$2"*) ok "$3";; *) bad "$3：输出中找不到 [$2]";; esac; }
assert_not_contains() { case "$1" in *"$2"*) bad "$3：输出中不应出现 [$2]";; *) ok "$3";; esac; }
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }

# 夹具条目数：工具链 3（K-001/002/004）+ 流程 1（K-003）；K-004 **故意**挂在 `## 跨 IDE` 节下
# —— 用来证明分片认的是**行内标签**而不是 `##` 小节（真实库里 5 条工具链就挂在「跨 IDE」节下）。
TOTAL=4

mk_repo() { # $1 = 假仓库根
  local R="$1"
  mkdir -p "$R/tools/scripts/lib" "$R/knowledge" "$R/ctx" "$R/memory"
  cp "$SCRIPT_DIR"/kb-*.mjs "$R/tools/scripts/"
  cp "$SCRIPT_DIR"/split-knowledge-lessons.mjs "$R/tools/scripts/"
  cp "$SCRIPT_DIR"/lib/*.mjs "$R/tools/scripts/lib/"
  cp "$SCRIPT_DIR"/build-context-index.mjs "$R/tools/scripts/"
  cat >"$R/knowledge/lessons.md" <<'MD'
# lessons.md — 教训库（桩）

## 工具链

- **[工具链][K-001] 桩教训一**（来源 WXG-T-901，2026-01-01）
  现象：p1。
  根因：r1。
  规避：a1。

- **[工具链][K-002] 桩教训二**（来源 WXG-T-901，2026-01-01）
  现象：p2。
  规避：a2。

## 流程

- **[流程][K-003] 桩教训三**（来源 WXG-T-902，2026-01-02）
  现象：p3。
  规避：a3。

## 跨 IDE

- **[工具链][K-004] 挂在跨 IDE 节下的工具链条目**（来源 WXG-T-903，2026-01-03）
  现象：p4 — 行内标签与 `##` 小节不一致时，分片必须认行内标签。
  规避：a4。
MD
  cat >"$R/knowledge/patterns.md" <<'MD'
# patterns.md — 模式库（桩）

- **[K-010] 桩模式一**
  说明：m1。
MD
  cat >"$R/knowledge/INDEX.md" <<'MD'
# knowledge/ — 工作室知识库（桩）

<!-- kb:active:start（由 pnpm run kb:sync 生成，勿手改）-->
<!-- kb:active:end -->
MD
}

SPLIT="tools/scripts/split-knowledge-lessons.mjs"

echo "=================================================================="
echo "WXG-T-111 knowledge/lessons 按标签分片 · 本地桩自测"
echo "被测: $SCRIPT_DIR/split-knowledge-lessons.mjs"
echo "工作目录: $WORK"
echo "=================================================================="

# ── [1] dry-run ────────────────────────────────────────────────────────────────
R="$WORK/r1"; mk_repo "$R"; cp "$R/knowledge/lessons.md" "$WORK/lessons.orig"
OUT="$(cd "$R" && node "$SPLIT" 2>&1)"; RC=$?
echo "—— [1] dry-run 不落盘"
assert_eq "$RC" "0" "[1] dry-run 退出码 0"
assert_contains "$OUT" "knowledge/lessons/toolchain.md" "[1] 计划列出 toolchain 片"
assert_contains "$OUT" "自证：$TOTAL 条目正文逐字节一致" "[1] 报告含逐字节自证结论"
assert_contains "$OUT" "dry-run" "[1] 明示未写盘"
if [ -e "$R/knowledge/lessons" ]; then bad "[1] 不应创建 lessons/ 目录"; else ok "[1] lessons/ 目录未创建"; fi
assert_eq "$(sha "$R/knowledge/lessons.md")" "$(sha "$WORK/lessons.orig")" "[1] 源文件字节不变"

# ── [2] --write 逐字节搬运（回拼用第二套实现，不自比：判例 K-047）────────────────
R="$WORK/r2"; mk_repo "$R"; cp "$R/knowledge/lessons.md" "$R/knowledge/lessons.md.bak"
OUT="$(cd "$R" && node "$SPLIT" --write 2>&1)"; RC=$?
echo "—— [2] --write 逐字节搬运"
assert_eq "$RC" "0" "[2] 退出码 0"
assert_contains "$OUT" "完成：2 片 / $TOTAL 条目搬运" "[2] 汇总行：2 片 / 4 条目"
T="$R/knowledge/lessons/toolchain.md"
if [ -f "$T" ]; then ok "[2] toolchain 片已生成"; else bad "[2] toolchain 片缺失"; fi
assert_contains "$(sed -n '1,10p' "$T")" "## 工具链" "[2] 片内保留 ## 工具链 小标题（reactivate 靠它定位）"
assert_eq "$(grep -c 'K-00[124]' "$T")" "3" "[2] 工具链 3 条（含挂在跨 IDE 节下的 K-004 ⇒ 认行内标签）"
assert_contains "$(cat "$T")" "  现象：p4 — 行内标签与 \`##\` 小节不一致时，分片必须认行内标签。" "[2] 条目正文子行原样入片"
assert_contains "$(cat "$R/knowledge/lessons/process.md")" "- **[流程][K-003] 桩教训三**" "[2] 流程条目入 process 片"
# ID 升序：toolchain 片里 K-004 必须在 K-001/002 之后（源文件顺序亦如此，但流程片验证排序逻辑）
assert_eq "$(grep -o 'K-00[0-9]' "$T" | head -1)" "K-001" "[2] 片内首条 = 最小号"
assert_eq "$(grep -o 'K-00[0-9]' "$T" | tail -1)" "K-004" "[2] 片内末条 = 最大号"
RB="$(cd "$R" && node -e '
import("./tools/scripts/lib/knowledge-ledger.mjs").then(async (M) => {
  const fs = await import("node:fs");
  const src = M.parseKnowledgeFile(fs.readFileSync("knowledge/lessons.md.bak", "utf8"), "src");
  const want = new Map(src.entries.map((e) => [e.id, [e.raw, ...e.bodyLines].join("\n")]));
  const got = new Map();
  for (const f of M.ACTIVE_FILES) {
    if (!f.file.startsWith("knowledge/lessons/") || !fs.existsSync(f.abs)) continue;
    for (const e of M.parseKnowledgeFile(fs.readFileSync(f.abs, "utf8"), f.file).entries) got.set(e.id, [e.raw, ...e.bodyLines].join("\n"));
  }
  let bad = 0;
  for (const [id, b] of want) if (got.get(id) !== b) { bad++; console.log("DIFF " + id); }
  for (const id of got.keys()) if (!want.has(id)) { bad++; console.log("EXTRA " + id); }
  console.log("want=" + want.size + " got=" + got.size + " bad=" + bad);
});
' 2>&1)"
assert_contains "$RB" "want=$TOTAL got=$TOTAL bad=0" "[2b] 回拼与源逐字节一致（差异 0）"

# ── [3] 指针页不放正文 ─────────────────────────────────────────────────────────
echo "—— [3] 指针页"
P="$R/knowledge/lessons.md"
assert_eq "$(grep -c '^- \*\*\[' "$P")" "0" "[3] 指针页条目数 = 0（正文只在片里，避免双份真源）"
assert_contains "$(cat "$P")" "knowledge/lessons/toolchain.md" "[3] 指针页含标签 → 分片表"
assert_contains "$(cat "$P")" "K-0NN" "[3] 指针页写明引用口径"
assert_contains "$(cat "$P")" "不设豁免" "[3] 指针页写明分片同受 B 门且不加豁免"

# ── [4] 未知标签 fail loud ─────────────────────────────────────────────────────
R="$WORK/r4"; mk_repo "$R"
printf '\n- **[安全][K-099] 未知标签条目**（来源 WXG-T-909，2026-01-09）\n  现象：p99。\n' >>"$R/knowledge/lessons.md"
OUT="$(cd "$R" && node "$SPLIT" 2>&1)"; RC=$?
echo "—— [4] 未知标签"
assert_eq "$RC" "1" "[4] 未知标签 → exit 1"
assert_contains "$OUT" "K-099" "[4] 诊断点名条目 ID"
if [ -e "$R/knowledge/lessons" ]; then bad "[4] 失败时不应产出分片目录"; else ok "[4] 失败时零产物"; fi

# ── [5] 缺 ID fail loud ────────────────────────────────────────────────────────
R="$WORK/r5"; mk_repo "$R"; cp "$R/knowledge/lessons.md" "$WORK/r5.orig"
printf '\n- **[流程] 缺号条目**（来源 WXG-T-910，2026-01-10）\n  现象：p10。\n' >>"$R/knowledge/lessons.md"
OUT="$(cd "$R" && node "$SPLIT" 2>&1)"; RC=$?
echo "—— [5] 缺 [K-0NN]"
assert_eq "$RC" "1" "[5] 缺 ID → exit 1"
assert_contains "$OUT" "kb:sync" "[5] 诊断给出解除动作（先补号）"
if [ -e "$R/knowledge/lessons" ]; then bad "[5] 失败时不应产出分片目录"; else ok "[5] 失败时零产物（不留下半套布局）"; fi

# ── [6] ACTIVE_FILES 两分支 ────────────────────────────────────────────────────
echo "—— [6] ACTIVE_FILES 动态枚举 / 回退"
L5="$(cd "$WORK/r5" && node -e 'import("./tools/scripts/lib/knowledge-ledger.mjs").then(m=>console.log(m.ACTIVE_FILES.map(f=>f.file).join(",")))')"
assert_contains "$L5" "knowledge/lessons.md" "[6] 无 lessons/ 目录 → 回退旧布局单文件（不砸错亦不假绿）"
R="$WORK/r6"; mk_repo "$R"; (cd "$R" && node "$SPLIT" --write >/dev/null 2>&1)
L6="$(cd "$R" && node -e 'import("./tools/scripts/lib/knowledge-ledger.mjs").then(m=>console.log(m.ACTIVE_FILES.map(f=>f.file+"|"+f.shard+"|"+f.archive).join(" ")))')"
assert_contains "$L6" "knowledge/lessons/toolchain.md|toolchain|knowledge/archive/lessons-archived.md" "[6] 分片被动态枚举，归档指向共用单份"
assert_not_contains "$L6" "knowledge/lessons.md|" "[6] 指针页不入 ACTIVE_FILES（0 条目，入表只造噪音）"
printf '# 新片\n\n## 安全\n\n- **[安全][K-050] 新标签片条目**（来源 WXG-T-911，2026-01-11）\n  现象：p50。\n' >"$R/knowledge/lessons/security.md"
L6B="$(cd "$R" && node -e 'import("./tools/scripts/lib/knowledge-ledger.mjs").then(m=>console.log(m.ACTIVE_FILES.map(f=>f.shard).join(",")))')"
assert_contains "$L6B" "process,security,patterns" "[6] 新标签自建片无需改码即被采集，且不插坏已知片顺序"

# ── [7] 跨分片补号单调 ─────────────────────────────────────────────────────────
echo "—— [7] 分片后补号"
R="$WORK/r7"; mk_repo "$R"; (cd "$R" && node "$SPLIT" --write >/dev/null 2>&1)
printf '\n- **[工具链] 分片后新增未编号条目**（来源 WXG-T-912，2026-01-12）\n  现象：p12。\n' >>"$R/knowledge/lessons/toolchain.md"
(cd "$R" && node tools/scripts/kb-sync.mjs --task=WXG-T-912 >/dev/null 2>&1)
NEWID="$(cd "$R" && node -e 'const j=require("./knowledge/ledger.json");const e=j.entries.find(x=>String(x.title).indexOf("分片后新增")>=0);console.log(e?e.id+" @ "+e.file:"none")')"
assert_eq "$NEWID" "K-011 @ knowledge/lessons/toolchain.md" "[7] 新号 = 全局最大 +1（patterns 已占 K-010），落位 = 条目所在片"
assert_eq "$(cd "$R" && node tools/scripts/kb-check.mjs >/dev/null 2>&1; echo $?)" "0" "[7] 分片态下 kb:check exit 0"

# ── [8] 归档共用单份 + 日志目的地反查 ─────────────────────────────────────────
echo "—— [8] 跨分片归档同进同退"
R="$WORK/r8"; mk_repo "$R"; (cd "$R" && node "$SPLIT" --write >/dev/null 2>&1)
(cd "$R" && node tools/scripts/kb-sync.mjs --task=WXG-T-913 >/dev/null 2>&1)
OUT="$(cd "$R" && node tools/scripts/kb-archive.mjs --ids=K-001,K-003 --reason="桩：跨两片归档" --task=WXG-T-913 2>&1)"; RC=$?
assert_eq "$RC" "0" "[8] 两片各一条同批归档 exit 0"
assert_not_contains "$OUT" "patterns-archived.md" "[8] lessons 条目不得被报成落到 patterns 归档（回归硬编码三元）"
A="$R/knowledge/archive/lessons-archived.md"
if [ -f "$A" ]; then ok "[8] 共用归档文件已生成"; else bad "[8] 缺 knowledge/archive/lessons-archived.md"; fi
assert_eq "$(grep -c '^- \*\*' "$A" 2>/dev/null || echo 0)" "2" "[8] 两条落在同一份归档（不是各长一份）"
assert_eq "$(cd "$R" && node tools/scripts/kb-check.mjs >/dev/null 2>&1; echo $?)" "0" "[8] 归档后 kb:check 仍 exit 0"


# ── [9] 二跑守卫 + 注释符号真实性 ──────────────────────────────────────────────
R="$WORK/r9"; mk_repo "$R"; cp "$R/knowledge/lessons.md" "$R/knowledge/lessons.orig.md"
(cd "$R" && node "$SPLIT" --write >/dev/null 2>&1)
SHA_BEFORE="$(cd "$R" && cat knowledge/lessons/*.md | shasum -a 256 | cut -d' ' -f1)"
OUT="$(cd "$R" && node "$SPLIT" 2>&1)"; RC=$?
echo "—— [9] 一次性工具的二跑语义"
assert_eq "$RC" "0" "[9] 已分片 → 二跑 exit 0（不是假故障）"
assert_contains "$OUT" "一次性迁移" "[9] 明示「不重复执行」而非报错"
assert_not_contains "$OUT" "先跑 pnpm run kb:sync" "[9] 不得把指针页的排版行误报成缺号条目"
SHA_AFTER="$(cd "$R" && cat knowledge/lessons/*.md | shasum -a 256 | cut -d' ' -f1)"
assert_eq "$SHA_AFTER" "$SHA_BEFORE" "[9] 二跑零字节改动"
OUT="$(cd "$R" && node "$SPLIT" --force --source=knowledge/lessons.orig.md --write 2>&1)"; RC=$?
assert_eq "$RC" "0" "[9] --force 未被守卫堵死（旧布局可重切）"
assert_contains "$OUT" "完成：2 片" "[9] --force 真跑了搬运（不是恒 0 的空守卫）"
LIBSYM="$(cd "$R" && node -e 'import("./tools/scripts/lib/knowledge-ledger.mjs").then((m) => { const src = require("node:fs").readFileSync("tools/scripts/split-knowledge-lessons.mjs", "utf8"); const names = [...src.matchAll(/knowledge-ledger\.mjs::([A-Za-z_][A-Za-z0-9_]*)/g)].map((x) => x[1]); const miss = names.filter((n) => !(n in m)); console.log("refs=" + names.length + " miss=" + miss.length + (miss.length ? "(" + miss.join(",") + ")" : "")); });' 2>&1)"
echo "$LIBSYM"
assert_not_contains "$LIBSYM" "refs=0 " "[9] 注释里确有 lib::符号 引用（扫描非空转）"
assert_eq "$(echo "$LIBSYM" | cut -d' ' -f2)" "miss=0" "[9] 注释引用的 lib 导出符号全部真实存在（K-035 型漂移）"

echo "=================================================================="
echo "结果：PASS=$PASS  FAIL=$FAIL"
echo "=================================================================="
[ "$FAIL" -eq 0 ] || exit 1
