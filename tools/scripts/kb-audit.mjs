#!/usr/bin/env node
/**
 * kb-audit.mjs — 知识库归档候选 + 重新激活命中审计（WXG-T-029）。
 *
 * **只出候选、不自动归档**：任何归档动作都必须经 `kb:archive --ids=… --reason=…`
 * 人工确认（对齐 AGENTS.md「不擅自删除高影响产物」）。
 *
 * 两项审计：
 *   ① 归档候选：`state=active` 且 `今天 - lastAccess ≥ archiveIdleDays(90)`
 *      且 `accessCount ≤ archiveMaxAccess(1)`；
 *      另要求 `addedDate` 距今 ≥ 90 天（新条目不列）；lastAccess 缺失（无法判定）不列。
 *   ② 归档相似命中：活跃条目 vs 已归档条目做「标题+关键词」Jaccard 相似度
 *      ≥ reactivateSimilarity(0.34) → 提示「疑似重复，建议重新激活并合并」。
 *
 * USAGE
 *   node tools/scripts/kb-audit.mjs
 *   node tools/scripts/kb-audit.mjs --today=2026-09-12   # 覆盖「今天」（自测 / 回放）
 *
 * 退出码：0（审计恒 0；候选只为人工复核，不阻断）。
 */

import {
  daysBetween,
  entryFingerprint,
  jaccard,
  normalizeThresholds,
  parseArgs,
  readLedger,
  sortEntries,
  todayISO,
} from './lib/knowledge-ledger.mjs';

const { opts } = parseArgs(process.argv.slice(2));
const today = todayISO(opts.today);

const ledger = readLedger();
if (!ledger) {
  console.error('❌ 未找到 knowledge/ledger.json —— 先跑 `pnpm run kb:sync` 初始化。');
  process.exit(1);
}
const th = normalizeThresholds(ledger.thresholds);
const entries = sortEntries(ledger.entries ?? []);
const actives = entries.filter((e) => e.state === 'active');
const archived = entries.filter((e) => e.state === 'archived');

console.log('知识库生命周期审计（kb:audit）');
console.log(`  今天：${today}｜阈值：未访问 ≥${th.archiveIdleDays} 天 且 次数 ≤${th.archiveMaxAccess} 方可候选；相似度 ≥${th.reactivateSimilarity}`);
console.log(`  活跃 ${actives.length} 条｜归档 ${archived.length} 条`);
console.log('');

// ── ① 归档候选 ──────────────────────────────────────────────────────────────
const candidates = [];
const undecidable = [];
for (const e of actives) {
  if (!e.lastAccess) {
    undecidable.push(e);
    continue;
  }
  const idle = daysBetween(e.lastAccess, today);
  const addedAge = e.addedDate ? daysBetween(e.addedDate, today) : null;
  const isNew = addedAge != null && addedAge < th.archiveIdleDays;
  if (idle >= th.archiveIdleDays && (e.accessCount ?? 0) <= th.archiveMaxAccess && !isNew) {
    candidates.push({ e, idle });
  }
}

console.log(`① 归档候选（state=active，未访问 ≥${th.archiveIdleDays} 天，次数 ≤${th.archiveMaxAccess}）：`);
if (candidates.length === 0) {
  console.log('   无候选。');
} else {
  for (const { e, idle } of candidates) {
    console.log(`   - ${e.id}「${e.title}」（${e.category}）｜未访问 ${idle} 天｜accessCount=${e.accessCount}｜lastAccess=${e.lastAccess}`);
  }
  console.log('   人工确认后执行（示例）：');
  console.log(`     pnpm run kb:archive -- --ids=${candidates.map((c) => c.e.id).join(',')} --reason="长期未访问，归档"`);
}
if (undecidable.length > 0) {
  console.log(`   ⚠️ 无法判定（缺 lastAccess，多为 patterns 无来源日期）：${undecidable.map((e) => e.id).join('、')}`);
}
console.log('');

// ── ② 归档相似命中（疑似重复 → 建议重新激活并合并）────────────────────────────
console.log(`② 归档相似命中（活跃 vs 归档，Jaccard ≥ ${th.reactivateSimilarity}）：`);
const hits = [];
for (const a of actives) {
  const fa = entryFingerprint(a);
  for (const z of archived) {
    const s = jaccard(fa, entryFingerprint(z));
    if (s >= th.reactivateSimilarity) hits.push({ a, z, s });
  }
}
if (hits.length === 0) {
  console.log('   无相似命中。');
} else {
  for (const { a, z, s } of hits.sort((x, y) => y.s - x.s)) {
    console.log(`   - 疑似重复：活跃 ${a.id}「${a.title}」↔ 归档 ${z.id}「${z.title}」（相似度 ${s.toFixed(2)}）`);
  }
  console.log('   建议：`pnpm run kb:reactivate -- --ids=<归档ID> --reason="新增条目命中归档，重新激活并合并"`，再人工合并去重。');
}
console.log('');
console.log('  提醒：账本不覆盖 Qoder / CodeBuddy，且 lastAccess 为观察日粒度 → 候选须人工复核后再归档。');
