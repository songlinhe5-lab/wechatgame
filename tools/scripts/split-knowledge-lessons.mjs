#!/usr/bin/env node
/**
 * split-knowledge-lessons.mjs — 把 `knowledge/lessons.md` 按**行内标签**逐字节分片
 * 到 `knowledge/lessons/<shard>.md`（WXG-T-111，2026-09-15 用户裁定「本轮就地做」）。
 *
 * 为什么需要脚本而不手工切：分片必须**逐字节搬运**（判例 K-030 / K-043——手工拼
 * 长文件必出错且看不出来），且必须能**自证**：切完之后把分片条目正文回拼与源文件
 * 比对，不一致就 exit 1，不留「大概没问题」。
 *
 * 口径（冻结，正本见 `production/TASKS-DETAIL.md §WXG-T-111`）：
 *   • 一标签一文件；**未知标签 ⇒ fail loud**（不静默丢弃、不猜归属）。
 *   • 条目 = 标题行 + 其后缩进/引用子行（与 lib `parseKnowledgeFile` 同口径，
 *     **不自建第二套解析**，判例 K-042）。
 *   • 分片内按 **ID 升序**；`## <标签>` 小标题随片保留（`kb:reactivate` 的
 *     `insertIntoCategory` 靠它定位）。
 *   • `knowledge/lessons.md` 降为**指针页**（旧引用「lessons.md K-0NN」仍可解出）。
 *
 * 用法：
 *   node tools/scripts/split-knowledge-lessons.mjs            # dry-run（默认，不写盘）
 *   node tools/scripts/split-knowledge-lessons.mjs --write     # 落盘
 *   node tools/scripts/split-knowledge-lessons.mjs --source=<path> --plan-only
 *     （--source 供桩自测在临时目录造夹具；--plan-only 只出映射不写指针页）
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, parseKnowledgeFile } from './lib/knowledge-ledger.mjs';

// ────────────────────────────────────────────────────────── CLI ────────────────

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const PLAN_ONLY = argv.includes('--plan-only');
const optVal = (name) => {
    const a = argv.find((x) => x.startsWith(`--${name}=`));
    return a ? a.slice(`--${name}=`.length) : null;
};
const relOr = (p) => (p?.startsWith('/') ? p : join(ROOT, p ?? ''));
const SOURCE_REL = optVal('source') ?? 'knowledge/lessons.md';
const OUT_DIR_REL = optVal('out-dir') ?? 'knowledge/lessons';
const sourceAbs = relOr(SOURCE_REL);
const outDirAbs = relOr(OUT_DIR_REL);

// ─────────────────────────────────────────────── 标签 → 分片（冻结映射）─────────

/**
 * 行内标签 → 分片文件名。**顺序即 `ACTIVE_FILES` 列表序**（补号顺序，见 lib 注释），
 * 改动本表必须同步 `lib/knowledge-ledger.mjs::LESSONS_SHARD_ORDER`。
 */
export const TAG_TO_SHARD = new Map([
    ['工具链', 'toolchain'],
    ['流程', 'process'],
    ['判据', 'criteria'],
    ['测试', 'testing'],
    ['跨IDE', 'cross-ide'],
    ['环境', 'environment'],
    ['接入', 'onboarding'],
]);

/** 条目块（含标题行）的逐字节文本。 */
const blockText = (e) => [e.raw, ...(e.bodyLines ?? [])].join('\n');

const parseIdNum = (id) => Number(String(id).replace(/^K-/, ''));

const fail = (msg) => {
    console.error(`❌ ${msg}`);
    process.exit(1);
};

// ────────────────────────────────────────────────── 切分 ────────────────────────

if (!existsSync(sourceAbs)) fail(`源文件不存在：${SOURCE_REL}`);

// 一次性迁移工具必须有「已完成」判定，否则第二跑会以假故障吓人：此时源文件已是本脚本
// 自己改写的**指针页**，其中的 `- **…**` 排版行会被 parseKnowledgeFile 当成语义条目 ⇒
// 报「缺 [K-0NN]：先跑 kb:sync 补号」（判例 K-047⑤：重复执行判据要锁自己写出的产物字形，
// 这里 = 片目录）。真要从旧布局重切请显式 `--force` 并配 `--source=`。
if (!argv.includes('--force') && existsSync(outDirAbs)) {
    const done = readdirSync(outDirAbs).filter((n) => n.endsWith('.md'));
    if (done.length) {
        console.log(`✅ ${OUT_DIR_REL}/ 已存在 ${done.length} 片：${done.map((n) => n.replace(/\.md$/, "")).join(" / ")}`);
        console.log("   本工具 = 一次性迁移，不重复执行（布局口径正本见 production/TASKS-DETAIL.md §WXG-T-111）。");
        console.log("   确需重切：加 --force，并用 --source= 指向未分片的旧 lessons.md（如 git show HEAD^:knowledge/lessons.md）。");
        process.exit(0);
    }
}
const srcText = readFileSync(sourceAbs, 'utf8');
const src = parseKnowledgeFile(srcText, SOURCE_REL);
if (!src.entries.length) fail(`${SOURCE_REL} 解析出 0 条目 —— 分片无意义（先查解析口径）`);

const unknown = [];
const groups = new Map(); // shard -> { tag, entries[] }
for (const e of src.entries) {
    if (!e.id) fail(`条目缺 [K-0NN] ID（${e.raw.slice(0, 60)}…）：先跑 pnpm run kb:sync 补号`);
    const tag = e.inlineCategory;
    const shard = TAG_TO_SHARD.get(tag);
    if (!shard) {
        unknown.push(`${e.id} 标签=${JSON.stringify(tag)}`);
        continue;
    }
    if (!groups.has(shard)) groups.set(shard, { tag, entries: [] });
    groups.get(shard).entries.push(e);
}
if (unknown.length) fail(`未知 / 缺失标签 ⇒ 拒绝分片（不静默丢弃）：\n   ${unknown.join('\n   ')}`);

/** 分片头注：不放条目数（会随新增过期），只放来源与口径。 */
const shardHeader = (tag, shard) => [
    `# lessons · \`${shard}\` 分片（标签 \`${tag}\`）`,
    '',
    `> 由 \`knowledge/lessons.md\`（WXG-T-111 按行内标签分片）逐字节搬运而来；本片条目**按 ID 升序**。`,
    `> 引用只写 **K-0NN**；口径正本（B 门不豁免 / 新标签 = 新片）见 \`knowledge/INDEX.md\` §1–§4。`,
    '',
];

const plan = []; // { shard, file, text, entries }
for (const [shard, g] of groups) {
    const entries = [...g.entries].sort((a, b) => parseIdNum(a.id) - parseIdNum(b.id));
    const text = [...shardHeader(g.tag, shard), `## ${g.tag}`, '', ...entries.flatMap((e) => [blockText(e), ''])].join(
        '\n',
    );
    plan.push({ shard, tag: g.tag, file: join(OUT_DIR_REL, `${shard}.md`), text, entries });
}
plan.sort((a, b) => [...TAG_TO_SHARD.values()].indexOf(a.shard) - [...TAG_TO_SHARD.values()].indexOf(b.shard));

// ────────────────────────────────────────────────── 自证 ────────────────────────

const srcById = new Map(src.entries.map((e) => [e.id, blockText(e)]));
const seenIds = new Set();
const diffs = [];
for (const p of plan) {
    const reparsed = parseKnowledgeFile(p.text, p.file);
    if (reparsed.entries.length !== p.entries.length) {
        diffs.push(`${p.file}: 写后重解析条目数 ${reparsed.entries.length} ≠ 搬运 ${p.entries.length}`);
    }
    for (const e of reparsed.entries) {
        if (!srcById.has(e.id)) {
            diffs.push(`${p.file}: ${e.id} 在源文件中不存在（凭空条目）`);
            continue;
        }
        if (seenIds.has(e.id)) diffs.push(`${p.file}: ${e.id} 重复落位`);
        seenIds.add(e.id);
        if (blockText(e) !== srcById.get(e.id)) {
            diffs.push(`${p.file}: ${e.id} 正文与源文件**非逐字节一致**`);
        }
        if (e.inlineCategory !== p.tag) {
            diffs.push(`${p.file}: ${e.id} 行内标签 ${JSON.stringify(e.inlineCategory)} ≠ 本片 \`${p.tag}\``);
        }
    }
}
for (const id of srcById.keys()) if (!seenIds.has(id)) diffs.push(`源条目 ${id} 未落进任何分片（丢失）`);
if (diffs.length) {
    console.error(`❌ 逐字节自证失败（${diffs.length} 项）：\n   ${diffs.join('\n   ')}`);
    process.exit(1);
}

// ───────────────────────────────────────────────── 指针页 ───────────────────────

const pointerText = [
    '# lessons · 沉淀正本（已按标签分片）',
    '',
    '> **本文件不再存放条目正文**（WXG-T-111）。原单体已**逐字节**拆入 `knowledge/lessons/`；',
    '> 分片同受 ctx B 门（8000 tok）约束，**不设豁免**。',
    '',
    '| 行内标签 | 分片文件 |',
    '|---|---|',
    ...[...TAG_TO_SHARD.entries()].map(([tag, shard]) => `| \`${tag}\` | \`knowledge/lessons/${shard}.md\` |`),
    '',
    '- **引用口径**：一律写 **K-0NN**（可附任务号），**不写文件路径**；ID → 分片由',
    '  `knowledge/INDEX.md` 活跃表的「分片」列机械解析。',
    '- **编号**：K-0NN 命名空间**全局单一**（真源 = `ledger.json::nextId`）；分片只改正文落位，',
    '  不改编号语义、不回收旧号。补号顺序 = 上表行序（`ACTIVE_FILES` 列表序）→ `patterns.md`。',
    '- **归档**：各分片**共用单份**归档面 `knowledge/archive/lessons-archived.md`。',
    '- **再膨胀处置**：某分片越阈 ⇒ 该标签内部按子标签再切，**不得**新增豁免（判例 WXG-T-041）。',
    '',
].join('\n');

// ───────────────────────────────────────────────── 输出 / 落盘 ──────────────────

console.log(`源：${SOURCE_REL}（${srcText.length} 字节 / ${src.entries.length} 条目）→ ${OUT_DIR_REL}/`);
for (const p of plan) {
    console.log(`  ${p.file.padEnd(40)} ${p.tag.padEnd(6)} ${String(p.entries.length).padStart(2)} 条  ${p.text.length} 字节  [${p.entries.map((e) => e.id.replace(/^K-0+/, '')).join(',')}]`);
}
console.log(`自证：${seenIds.size} 条目正文逐字节一致 ✅${diffs.length ? ' ❌' : ''}`);
if (!PLAN_ONLY) console.log(`指针页：${SOURCE_REL} → ${pointerText.length} 字节`);

if (!WRITE) {
    console.log('\n[dry-run] 未写盘。确认无误后加 --write。');
    process.exit(0);
}

mkdirSync(outDirAbs, { recursive: true });
for (const p of plan) {
    const abs = relOr(p.file);
    writeFileSync(abs, p.text, 'utf8');
    const back = readFileSync(abs, 'utf8');
    if (back !== p.text) fail(`回读不一致：${p.file}`);
    console.log(`✓ 写入 ${p.file}`);
}
if (!PLAN_ONLY) {
    writeFileSync(sourceAbs, pointerText, 'utf8');
    if (readFileSync(sourceAbs, 'utf8') !== pointerText) fail('指针页回读不一致');
    console.log(`✓ 指针页 ${SOURCE_REL}`);
}
console.log(`\n完成：${plan.length} 片 / ${seenIds.size} 条目搬运，正文逐字节一致（自证通过）。`);
