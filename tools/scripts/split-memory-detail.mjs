#!/usr/bin/env node
/**
 * split-memory-detail.mjs — memory 日记「长节 → 二级详情文件」外移器（WXG-T-106）。
 *
 * 要解决的雷：日记是**追加式**的，一轮一节、每节动辄上千 tok ⇒ 单日期文件必然反复撞
 * `ctx:check` B 门（8000 tok）。实测判例：`memory/2026-09-15.md` 在 WXG-T-097/BD-10 轮
 * 冲到 8693 tok 被 pre-commit 真拦；`09-12` 10141 / `09-14` 12586 靠两条豁免硬扛，而
 * T-041 裁决原文是「到期不得靠 B 门豁免硬扛」。压摘要＝丢细节，加豁免＝违例——都不干。
 *
 * 做法（机械、可复核）：把 **>阈值** 的 `##` 节**逐字节**搬到
 * `memory/details/<YYYY-MM-DD>-s<NN>[-<tXXX>].md`，日记原位只余「节标题 + 指针」骨架。
 * 详情文件自身进 ctx 索引面 ⇒ 受同一道 B 门约束（**机制自带防再膨胀**）。
 *
 * ── 三条硬口径 ─────────────────────────────────────────────────────────────────
 * ① **逐字节搬运**：详情件正文 = 原节**整段原文**（含 `##` 标题行），中间不加工；
 *    写盘后 `includes(原文)` 回读校验，不等则 fail loud、原件保留、不落盘。
 *    日记保留同一 `##` 标题行 ⇒ 锚点与 `ctx/ROUTES.md` 的 `路径#锚点` 引用**不失效**。
 * ② **隶属标记＝详情件 H1**（唯一真源，`memory/INDEX.md` 的「详情」列由它派生）：
 *      `# 隶属 · <YYYY-MM-DD> · §<日记节 anchor>`
 *    anchor 由 `lib/context-index.mjs::makeAnchor` 同口径计算（本脚本复用其节解析），
 *    格式不符 / 指不到现存节 ⇒ `ctx:check` C-③ 硬拦。
 * ③ **幂等**：外移后的节正文只剩骨架（远低于阈值）⇒ 重跑自然不再选中；目标详情件已存在
 *    则 **fail loud（exit 1）且整体不落盘**（宁停勿覆盖：重名意味着手工件与机械件同源冲突）。
 *
 * 安全边界：默认 **dry-run**，`--write` 才落盘；只动 `--date=` 指定的那一篇日记（其余
 * 连内容都不读）⇒ 并发会话正在追加的当天日志不会被误动（须由该会话自己跑）。
 *
 * USAGE
 *   node tools/scripts/split-memory-detail.mjs --date=2026-09-15              # dry-run
 *   node tools/scripts/split-memory-detail.mjs --date=2026-09-15 --write
 *   node tools/scripts/split-memory-detail.mjs --date=2026-09-14 --min-tokens=600 --write
 *
 * 退出码：0 成功（含 dry-run / 无候选）；1 参数错误 / 回读校验失败（fail loud）。
 * 桩自测：tools/scripts/split-memory-detail-selftest.sh
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateTokens } from './lib/context-tokens.mjs';
import { makeFileRecord } from './lib/context-index.mjs';

// 不用 `import.meta.dirname`（需 Node ≥20.11，而 engines 声明是 ≥20）——与仓内其余脚本同口径。
// 本文件在 `tools/scripts/`（非 `lib/`），故上溯两级。
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
    console.log(`memory 长节外移器（WXG-T-106）

用法：node tools/scripts/split-memory-detail.mjs --date=YYYY-MM-DD [--write] [--min-tokens=600] [--root=<path>]

口径：
  • 只把该天日记里 **正文 > min-tokens 的 \`##\` 节**外移到 memory/details/<日期>-s<NN>[-<tXXX>].md；
  • 详情件正文＝原节整段**逐字节**原文（含 ## 标题行），H1 为隶属标记；日记原位只余标题 + 指针；
  • 默认 dry-run；--write 才落盘；目标详情件已存在 ⇒ fail loud（exit 1）且整体不落盘；
  • 落盘后必做回读校验（详情件含原文 + 日记重建一致），不等则 exit 1 且不改任何文件。`);
    process.exit(0);
}
const args = Object.fromEntries(
    argv.map((a) => {
        const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
        return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
    }),
);
const DRY = !args.write;
const DATE = typeof args.date === 'string' ? args.date : null;
const MIN = Number(args['min-tokens'] ?? 600);
const ROOT_DIR = typeof args.root === 'string' ? args.root : ROOT;
if (!DATE || !/^\d{4}-\d{2}-\d{2}$/.test(DATE) || !Number.isFinite(Date.parse(`${DATE}T00:00:00Z`))) {
    console.error(`❌ --date 必填且须为可解析的 YYYY-MM-DD（收到：${DATE ?? '（缺省）'}）`);
    process.exit(1);
}
if (!Number.isFinite(MIN) || MIN <= 0) {
    console.error(`❌ --min-tokens 需为正数（收到：${args['min-tokens']}）`);
    process.exit(1);
}

const diaryRel = `memory/${DATE}.md`;
const diaryPath = join(ROOT_DIR, diaryRel);
const detailsDir = join(ROOT_DIR, 'memory/details');
if (!existsSync(diaryPath) || !statSync(diaryPath).isFile()) {
    console.error(`❌ 未找到 ${diaryRel}`);
    process.exit(1);
}

const original = readFileSync(diaryPath, 'utf8');
const lines = original.split('\n');

/* ── 节解析：**直接复用门禁侧的纯函数** `makeFileRecord`（WXG-T-106）─────────────
 * 不在本脚本里重抄一份 heading/anchor 逻辑：两份一旦走散，生成的隶属标记就会在
 * `ctx:check` C-③ 侧对不上 anchor 而变成静默孤儿。共用同一函数 ⇒ 不可能漂移；
 * 「单节 > N tok」的阈值也与 `memory/INDEX.md` 表里的 tok 列同一口径（含同一估算器）。 */
const { sections } = makeFileRecord(diaryRel, original);

/* ── 幂等判据：只认**本脚本自己发出的骨架行**，不认正文里对 `memory/details/` 的提及 ──
 * 曾用 `body.includes('memory/details/')` ⇒ 误判：一节只是在**讨论**详情层（如本机制
 * 立项当天那一节）就会被当成「已外移」而静默跳过 ⇒ 真正的长节永远拆不动。
 * 因此只匹配骨架行的固定开头（与下面 `skeletonLine()` 同一字形，改一处必改另一处）。 */
const SKELETON_RE = /^> \*\*正文已外移\*\*（WXG-T-\d+，逐字节）→ `memory\/details\/\S+\.md`/m;
const skeletonLine = (p) =>
    `> **正文已外移**（WXG-T-106，逐字节）→ \`memory/details/${p.name}\`` +
    `（${p.tokens} tok｜原 L${p.startLine}–${p.endLine}｜隶属标记见该件 H1）。`;

/* ── 候选：## 级、正文 > 阈值、且**尚未**外移（骨架里没有详情指针）─────────────── */
const d2 = sections.filter((s) => s.level === 2);
const planned = [];
for (const s of d2) {
    const body = lines.slice(s.startLine - 1, s.endLine).join('\n'); // 含 ## 标题行，逐字节
    const tokens = s.tokens; // = 索引表那一列（正文，不含标题行）
    if (tokens <= MIN) continue;
    if (SKELETON_RE.test(body)) {
        console.log(`  ⏭ 跳过｜${s.anchor}｜已含骨架指针（幂等，不重复外移）`);
        continue;
    }
    const headingLine = lines[s.startLine - 1]; // 原行逐字节（骨架保留同一行 ⇒ 锚点与 ROUTES 引用不失效）
    const task = /WXG-T-(\d{3})/.exec(headingLine);
    const ordinal = String(d2.indexOf(s) + 1).padStart(2, '0');
    const name = `${DATE}-s${ordinal}${task ? `-t${task[1]}` : ''}.md`;
    planned.push({ ...s, tokens, body, name, headingLine });
}

console.log(`memory 长节外移（split-memory-detail，WXG-T-106）${DRY ? '—— dry-run（加 --write 落盘）' : '—— --write 落盘'}`);
console.log(`  日记：${diaryRel}（现 ${estimateTokens(original)} tok）｜阈值：单节正文 > ${MIN} tok`);
if (planned.length === 0) {
    console.log(`✅ 无 > ${MIN} tok 的 \`##\` 节——无需外移。`);
    process.exit(0);
}
for (const p of planned) {
    console.log(`  → ${p.name}｜${p.tokens} tok｜原 L${p.startLine}–${p.endLine}｜${p.anchor.slice(0, 60)}`);
}
const remaining =
    estimateTokens(original) - planned.reduce((n, p) => n + p.tokens, 0) + planned.length * 60;
console.log(`  外移后日记估算 ≈ ${remaining} tok（阈值 8000；估算含骨架指针开销，非精确）`);
if (DRY) {
    console.log('（dry-run：未落盘）');
    process.exit(0);
}

/* ── --write：先全量校验，再落盘（中途失败不留半套）──────────────────────────── */
for (const p of planned) {
    const dst = join(detailsDir, p.name);
    if (existsSync(dst)) {
        console.error(`❌ 目标详情件已存在：memory/details/${p.name} ——**不落盘**（不覆盖，宁漏勿错）。`);
        process.exit(1);
    }
    p.dst = dst;
    p.detailText =
        `# 隶属 · ${DATE} · ${p.anchor}\n\n` +
        `> 本节正文自 \`${diaryRel}\` **逐字节**外移（WXG-T-106）；日记原位只余节标题 + 指向本件的指针。\n` +
        `> 隶属：\`${DATE}\` ${p.anchor}（原 L${p.startLine}–${p.endLine}）。下方即原节全文（含 \`##\` 标题行）。\n\n` +
        `${p.body}\n`;
    if (!p.detailText.includes(p.body)) {
        console.error(`❌ 构造期校验失败：${p.name} 未逐字节包含原节——不落盘（fail loud）。`);
        process.exit(1);
    }
}
// 日记重建：按行区间替换（从后往前，避免行号位移）。
const newLines = lines.slice();
for (const p of [...planned].sort((a, b) => b.startLine - a.startLine)) {
    const skeleton = [
        p.headingLine, // **原行逐字节**（不用重建的 `## ` + raw，以免尾随空白被归一）
        '',
        skeletonLine(p),
    ];
    newLines.splice(p.startLine - 1, p.endLine - p.startLine + 1, ...skeleton);
}
const rebuilt = newLines.join('\n');
// 重建自检：**每一节**的标题行都必仍在（只查首节 = 只保了半件；丢任一标题 ⇒ 锚点失效）。
for (const p of planned) {
    if (!rebuilt.includes(p.headingLine)) {
        console.error(`❌ 重建自检失败：骨架标题丢失（${p.anchor}）——不落盘（fail loud）。`);
        process.exit(1);
    }
}
mkdirSync(detailsDir, { recursive: true });
for (const p of planned) {
    writeFileSync(p.dst, p.detailText);
    if (readFileSync(p.dst, 'utf8') !== p.detailText) {
        console.error(`❌ 回读校验失败：${p.name} ——请人工核查（原件 ${diaryRel} 未改）。`);
        process.exit(1);
    }
}
writeFileSync(diaryPath, rebuilt);
if (readFileSync(diaryPath, 'utf8') !== rebuilt) {
    console.error(`❌ 回读校验失败：${diaryRel} ——详情件已写但日记未更新，请重跑（幂等）。`);
    process.exit(1);
}
for (const p of planned) console.log(`  ✅ 外移｜${p.anchor.slice(0, 50)} → memory/details/${p.name}`);
console.log(
    `✅ 完成：${planned.length} 节 → ${planned.length} 个详情件；日记现 ${estimateTokens(rebuilt)} tok` +
    '（**下一步必跑** `pnpm run ctx:build` 或提交时由 pre-commit 自动重建，再 `pnpm run ctx:check`）。',
);
