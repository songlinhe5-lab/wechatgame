#!/usr/bin/env node
/**
 * check-tasks.mjs — 台账「标题制 + 详情分片」的机械门（WXG-T-064）。
 *
 * 背景：`production/TASKS.md` 曾 **81% 体积是任务行详情**（16 行 ≈ 5334 tok、中位行 389），
 * 而 `tasks:archive` 只清**已完成**行 ⇒ 每个新任务仍带入 400–600 tok ⇒ 反复撞 `ctx:check`
 * B 项单文件 8000。拆分后主表只留标题（≈ 2.2k tok），正文落 `production/TASKS-DETAIL.md`
 * 一任务一节；本脚本把「标题制」与「配对纪律」变成**机械强制**，不靠自觉。
 *
 * 检查（任一不过 → exit 1）：
 *   A. 主表任务行的**名称单元格 ≤ 60 字符**（标题，不是段落）
 *   B. 主表任务行**连续**（表内不得有空行打断 Markdown 表格——历史上真实发生过）
 *   C. **配对**：主表每行 ⇔ 详情文件同名小节（`## WXG-T-0NN`）
 *   D. 详情**不得**残留已归档 id 的小节（`--prune` 修复）
 *
 * 用法：
 *   node tools/scripts/check-tasks.mjs             # 校验（verify 内调用）
 *   node tools/scripts/check-tasks.mjs --prune     # 删除已归档 id 的详情小节
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LEDGER = path.join(ROOT, 'production/TASKS.md');
const DETAIL = path.join(ROOT, 'production/TASKS-DETAIL.md');
const ARCHIVE = path.join(ROOT, 'production/archive/TASKS-archive.md');

/** 名称单元格的字符上限（标题，不是段落）。 */
const TITLE_MAX = 60;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const idNum = (id) => Number.parseInt(id.replace('WXG-T-', ''), 10);

function splitCells(line) {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return body.split(/(?<!\\)\|/).map((c) => c.trim());
}

const failures = [];
const notes = [];

// ── 主表 ─────────────────────────────────────────────────────────────────────
const ledgerLines = read(LEDGER).split('\n');
const rows = [];
for (let i = 0; i < ledgerLines.length; i++) {
  const line = ledgerLines[i];
  if (!/^\|\s*WXG-T-\d+\s*\|/.test(line)) continue;
  const cells = splitCells(line);
  const id = cells[0];
  const title = cells[1] ?? '';
  rows.push({ id, title, line: i + 1 });
  if (cells.length !== 5) {
    failures.push(`A: ${id} 列数 ${cells.length} ≠ 5（表头为 id/名称/负责/状态/产出）`);
  }
  const plain = title.replace(/\*\*/g, '');
  if (plain.length > TITLE_MAX) {
    failures.push(
      `A: ${id} 名称 ${plain.length} 字符 > ${TITLE_MAX} —— 主表是**标题制**，正文请写进 ` +
        `production/TASKS-DETAIL.md 的 ## ${id} 小节`,
    );
  }
}

// 行连续性（表内空行会把 Markdown 表格截断）
for (let k = 1; k < rows.length; k++) {
  if (rows[k].line - rows[k - 1].line !== 1) {
    failures.push(
      `B: 主表第 ${rows[k - 1].line} 行与第 ${rows[k].line} 行之间有空洞` +
        `（表内不得有空行/夹注，会把表格截断）`,
    );
  }
}

// ── 详情 ─────────────────────────────────────────────────────────────────────
const detailText = read(DETAIL);
const detailIds = new Set(
  [...detailText.matchAll(/^##\s+(WXG-T-\d+)\s*$/gm)].map((m) => m[1]),
);
const archiveText = read(ARCHIVE);
const archivedIds = new Set(
  [...archiveText.matchAll(/^\|\s*(WXG-T-\d+)\s*\|/gm)].map((m) => m[1]),
);

for (const { id } of rows) {
  if (!detailIds.has(id)) {
    failures.push(`C: 主表有 ${id}，但 ${path.relative(ROOT, DETAIL)} 里没有 ## ${id} 小节`);
  }
}

const rowIds = new Set(rows.map((r) => r.id));
const staleSections = [...detailIds].filter((id) => !rowIds.has(id));
for (const id of staleSections) {
  if (archivedIds.has(id)) {
    failures.push(`D: ${id} 已归档，详情小节应一并移走 —— 跑「pnpm run check:tasks -- --prune」`);
  } else {
    failures.push(`C: 详情有 ## ${id} 小节，但主表无此行（孤儿详情）`);
  }
}

// ── --prune ──────────────────────────────────────────────────────────────────
if (process.argv.includes('--prune')) {
  const pruned = staleSections.filter((id) => archivedIds.has(id));
  if (pruned.length === 0) {
    console.log('check:tasks --prune — 无需清理（没有「已归档但详情仍在」的条目）');
    process.exit(0);
  }
  const kept = detailText
    .split(/^---$/m)
    .map((block, index) => {
      const m = /^##\s+(WXG-T-\d+)\s*$/m.exec(block);
      if (index === 0 || !m) return block; // 文件头与前言保留
      return pruned.includes(m[1]) ? null : block;
    })
    .filter((block) => block !== null)
    .join('---');
  writeFileSync(DETAIL, kept.trimEnd() + '\n', 'utf8');
  console.log(`check:tasks --prune — 已移出 ${pruned.length} 节：${pruned.join('、')}`);
  process.exit(0);
}

// ── 结论 ─────────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`❌ check:tasks FAILED（${failures.length}）`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `✅ check:tasks OK —— 主表 ${rows.length} 行（名称均 ≤ ${TITLE_MAX} 字符且连续）、` +
    `详情 ${detailIds.size} 节，配对完整`,
);
for (const n of notes) console.log(`  note: ${n}`);
