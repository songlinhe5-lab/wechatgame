#!/usr/bin/env node
/**
 * kb-sync.mjs — 知识库 ledger 同步器 + 变更统计（WXG-T-029）。
 *
 * 职责（幂等；不含生成时间戳，产物字节稳定）：
 *   1. 解析 `knowledge/lessons/<标签>.md` **分片集**（`ACTIVE_FILES` 动态枚举；目录缺失 ⇒
 *      回退旧布局单文件 `knowledge/lessons.md`）+ `knowledge/patterns.md` → 结构字段；
 *   2. **给无行内 ID 的条目补号**（`nextId` 递增、不回收；只改标题行，不动正文与顺序）；
 *   3. 兼顾已有 ledger：**保留**访问字段（lastAccess / accessCount / accessSources / seen /
 *      archivedDate / archiveReason / reactivatedDate），只刷新结构字段；
 *      **accessSources 另按 R4（WXG-T-038）截断保留最近 ACCESS_SOURCES_MAX 个**——
 *      截断发生在 lib 层 `normalizeLedgerEntry`（所有写盘路径的必经点），本命令即
 *      **存量回填入口**（幂等：重跑时超限条目为 0，不再打印、不再写盘）；
 *   4. **计算并写入 `contentHash`**（条目正文规范化后的 sha256，用于判定「修改」）；
 *   5. 现算本轮 **added / updated**，各合并为一条 `events` 记录（append-only，有变化才追加）；
 *   6. 重写 `knowledge/INDEX.md` 活跃块（只重写标记之间，块外协议文字不动）；
 *   7. 生成 `knowledge/archive/INDEX.md`（归档清单）与 `knowledge/CHANGELOG.md`（人读变更日志）。
 *
 * ── 「沉淀统计」口径（用户 2026-09-12 裁定，写死）─────────────────────────────
 *   • 新增（added）  ：ledger 中**无**该 ID 的既有条目（首次运行 ledger 缺失 → 全部为 added）。
 *   • 修改（updated）：ledger 有该 ID，且既有 `contentHash` 与**当前正文**不符。
 *   • 基线补齐       ：ledger 有该 ID 但**缺** `contentHash`（旧库迁移）→ 一次性补齐，
 *                      **不计入新增/修改、不生成 event**（它们早已入库，避免伪造「本次新增」）。
 *   • 激活 / 归档     ：sync **不自行推断**，只**汇总** `events` 中**运行日**已记录的
 *                      `reactivated` / `archived`（由 kb:reactivate / kb:archive 写入）。
 *   • **有变化才写**：无任何变化时不追加 event、不打印统计区块、四份产物字节不变（幂等）。
 *
 * USAGE
 *   node tools/scripts/kb-sync.mjs
 *   node tools/scripts/kb-sync.mjs --task=WXG-T-029        # 归因到任务号（写入 added/updated event）
 *   node tools/scripts/kb-sync.mjs --note="…"              # 附加备注（写入 event.note）
 *   node tools/scripts/kb-sync.mjs --today=2026-09-12      # 覆盖「运行日」（自测 / 回放用）
 *
 * 退出码：0 成功；1 关键文件缺失 / ledger 不可解析；2 `--task` 形态非法（用法错误）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  ACCESS_SOURCES_MAX,
  ACTIVE_FILES,
  ARCHIVE_INDEX_PATH,
  CHANGELOG_PATH,
  DEFAULT_THRESHOLDS,
  INDEX_PATH,
  LEDGER_PATH,
  LEDGER_VERSION,
  TASK_ID_RE,
  entryContentHash,
  formatId,
  inscribeId,
  makeEvent,
  normalizeEvents,
  normalizeLedgerEntry,
  parseArgs,
  parseIdNum,
  parseKnowledgeFile,
  readLedger,
  renderActiveBlock,
  renderArchiveIndex,
  renderChangelog,
  rewriteActiveBlock,
  serializeLedger,
  sortEntries,
  todayISO,
} from './lib/knowledge-ledger.mjs';

// ── CLI ───────────────────────────────────────────────────────────────────────
const { opts } = parseArgs(process.argv.slice(2));
const task = typeof opts.task === 'string' && opts.task.trim() !== '' ? opts.task.trim() : null;
if (task !== null && !TASK_ID_RE.test(task)) {
  console.error(`❌ --task 形态非法（${task}）：应形如 WXG-T-029。`);
  process.exit(2);
}
const note = typeof opts.note === 'string' && opts.note.trim() !== '' ? opts.note.trim() : null;
const runDate = todayISO(typeof opts.today === 'string' ? opts.today : undefined);

// ── 0) 读 ledger（缺失 → 全新；存在但不可解析 → 报错不写）────────────────────
const ledgerExists = existsSync(LEDGER_PATH);
const rawLedger = readLedger();
if (rawLedger === null && ledgerExists) {
  console.error('❌ knowledge/ledger.json 存在但无法解析为 JSON —— 未写入任何文件，请人工修复后重跑。');
  process.exit(1);
}
const ledger =
  rawLedger ?? {
    version: LEDGER_VERSION,
    nextId: 1,
    thresholds: { ...DEFAULT_THRESHOLDS },
    entries: [],
    events: [],
  };
let nextId = Number.isFinite(ledger.nextId) ? ledger.nextId : 1;

// ── 0b) R4 存量收敛统计（WXG-T-038）：在归一化**之前**从原始 ledger 统计 ────────
// normalizeLedgerEntry 读入即截断，超限明细只在原始数据里可见；字节数为按序列化格式
//（8 空格缩进 + 引号×2 + 逗号 + 换行 ≈ 每标签 len+12）的估算值。
const r4Stats = (() => {
  let entries = 0;
  let tags = 0;
  let bytes = 0;
  for (const e of rawLedger?.entries ?? []) {
    const a = Array.isArray(e?.accessSources) ? e.accessSources : [];
    if (a.length > ACCESS_SOURCES_MAX) {
      const removed = a.length - ACCESS_SOURCES_MAX; // 移除的是**头部最旧**标签（保尾部最新）
      entries += 1;
      tags += removed;
      for (const t of a.slice(0, removed)) bytes += String(t).length + 12;
    }
  }
  return { entries, tags, bytes };
})();

const byId = new Map((ledger.entries ?? []).map((e) => [e.id, normalizeLedgerEntry(e)]));

// ── 1a) nextId **下界** = 既有 ID 最大值 + 1（活跃 md + 归档 md + ledger 台账）─────
// 缺陷背景（真库副本演练暴露）：ledger.json 缺失（新克隆 / 被清理）而 md 条目**已带**行内
//   ID 时，若 nextId 从 1 起算，新条目会被分配到已占用的 K-001 → ① ID 重复、原条目被
//   覆盖，且「新增」被误判为「修改」，统计与 CHANGELOG 全部失真。
//   归档条目 ID 同样**不回收**，故归档文件一并计入下界。
const maxExistingId = (() => {
  let max = 0;
  const bump = (id) => {
    const n = parseIdNum(id);
    if (Number.isFinite(n) && n > max) max = n;
  };
  for (const id of byId.keys()) bump(id);
  for (const f of ACTIVE_FILES) {
    for (const abs of [f.abs, f.archiveAbs]) {
      if (!existsSync(abs)) continue;
      for (const e of parseKnowledgeFile(readFileSync(abs, 'utf8'), f.file).entries) {
        if (e.id) bump(e.id);
      }
    }
  }
  return max;
})();
if (maxExistingId + 1 > nextId) nextId = maxExistingId + 1;

// ── 1) 解析活跃文件 + 补号 ──────────────────────────────────────────────────
const pushOnce = (arr, id) => {
  if (!arr.includes(id)) arr.push(id);
};
let assigned = 0;
const parsedFiles = [];
for (const f of ACTIVE_FILES) {
  if (!existsSync(f.abs)) {
    console.error(`❌ 缺少活跃条目文件：${f.file}`);
    process.exit(1);
  }
  const original = readFileSync(f.abs, 'utf8');
  let parsed = parseKnowledgeFile(original, f.file);
  const lines = [...parsed.lines];
  let changed = false;
  for (const e of parsed.entries) {
    if (!e.id) {
      const id = formatId(nextId);
      nextId += 1;
      lines[e.startLine - 1] = inscribeId(lines[e.startLine - 1], id);
      changed = true;
      assigned += 1;
    }
  }
  if (changed) {
    const next = lines.join('\n');
    writeFileSync(f.abs, next, 'utf8');
    parsed = parseKnowledgeFile(next, f.file);
  }
  parsedFiles.push(parsed);
}

// ── 2) upsert ledger（结构刷新 + contentHash 判定；访问字段保留）────────────
const addedIds = []; // 无既有记录 → 新增
const updatedIds = []; // 既有 contentHash 与当前正文不符 → 修改
const backfilledIds = []; // 既有条目但缺 contentHash（旧库迁移）→ 补齐基线，不计入新增/修改
for (const parsed of parsedFiles) {
  for (const e of parsed.entries) {
    const hash = entryContentHash(e);
    const prev = byId.get(e.id);
    if (!prev) {
      byId.set(
        e.id,
        normalizeLedgerEntry({
          id: e.id,
          state: 'active',
          file: parsed.file,
          category: e.category,
          title: e.title,
          contentHash: hash,
          sourceTask: e.sourceTask,
          // 无访问记录时：lastAccess 初值取 addedDate（「入库后未观察到访问」的诚实表达），
          // addedDate 亦无法解析（patterns 无日期）→ null，由 kb:audit 归入「无法判定」。
          addedDate: e.addedDate,
          lastAccess: e.addedDate,
          accessCount: 0,
          accessSources: [],
          seen: [],
          archivedDate: null,
          archiveReason: null,
          reactivatedDate: null,
        }),
      );
      pushOnce(addedIds, e.id);
      continue;
    }
    const cur = normalizeLedgerEntry(prev);
    cur.state = 'active';
    cur.file = parsed.file;
    cur.category = e.category ?? cur.category;
    cur.title = e.title;
    cur.sourceTask = e.sourceTask ?? cur.sourceTask ?? null;
    cur.addedDate = e.addedDate ?? cur.addedDate ?? null;
    const prevHash = typeof prev.contentHash === 'string' && prev.contentHash ? prev.contentHash : null;
    if (!prevHash) pushOnce(backfilledIds, e.id);
    else if (prevHash !== hash) pushOnce(updatedIds, e.id);
    cur.contentHash = hash;
    byId.set(e.id, normalizeLedgerEntry(cur));
  }
}

// 保留 ledger 中已有的 archived 条目；active 孤儿（md 里没有）也保留 → 由 kb:check 报错。
const entries = sortEntries([...byId.values()]);
ledger.version = LEDGER_VERSION;
ledger.nextId = nextId;
ledger.thresholds = {
  archiveIdleDays: defaultIfInvalid(ledger.thresholds?.archiveIdleDays, DEFAULT_THRESHOLDS.archiveIdleDays),
  archiveMaxAccess: defaultIfInvalid(ledger.thresholds?.archiveMaxAccess, DEFAULT_THRESHOLDS.archiveMaxAccess),
  reactivateSimilarity: defaultIfInvalid(ledger.thresholds?.reactivateSimilarity, DEFAULT_THRESHOLDS.reactivateSimilarity),
};
ledger.entries = entries;

// ── 3) events：本轮 added / updated 各合并为一条（有变化才追加）──────────────
const sortedIds = (arr) => [...new Set(arr)].sort((a, b) => parseIdNum(a) - parseIdNum(b));
const newEvents = [];
if (addedIds.length > 0) {
  newEvents.push(makeEvent({ date: runDate, taskId: task, kind: 'added', ids: sortedIds(addedIds), note }));
}
if (updatedIds.length > 0) {
  newEvents.push(makeEvent({ date: runDate, taskId: task, kind: 'updated', ids: sortedIds(updatedIds), note }));
}
ledger.events = [...normalizeEvents(ledger.events), ...newEvents];

// ── 4) 写盘（仅在有变化时写；保证幂等下 byte-stable）────────────────────────
const written = [];
const writtenLedger = writeIfChanged(LEDGER_PATH, serializeLedger(ledger));
if (writtenLedger) written.push('knowledge/ledger.json');

const indexText = existsSync(INDEX_PATH)
  ? readFileSync(INDEX_PATH, 'utf8')
  : '# knowledge/ — 工作室知识库\n';
const actives = entries.filter((e) => e.state === 'active');
if (writeIfChanged(INDEX_PATH, rewriteActiveBlock(indexText, renderActiveBlock(actives)))) {
  written.push('knowledge/INDEX.md（活跃块）');
}
mkdirSync(dirname(ARCHIVE_INDEX_PATH), { recursive: true });
if (writeIfChanged(ARCHIVE_INDEX_PATH, renderArchiveIndex(entries))) {
  written.push('knowledge/archive/INDEX.md');
}
if (writeIfChanged(CHANGELOG_PATH, renderChangelog(ledger.events, entries))) {
  written.push('knowledge/CHANGELOG.md');
}

// ── 5) 报告 ──────────────────────────────────────────────────────────────────
const archived = entries.filter((e) => e.state === 'archived');
console.log('知识库 ledger 同步（kb:sync）');
console.log(`  活跃条目：${actives.length}（本次新补号 ${assigned}）`);
console.log(`  归档条目：${archived.length}`);
console.log(`  nextId：${nextId}（下一新条目将分配 ${formatId(nextId)}）`);
for (const p of parsedFiles) {
  console.log(
    `  ${p.file}：条目 ${p.entries.length}（${p.entries[0]?.id ?? '—'} … ${p.entries[p.entries.length - 1]?.id ?? '—'}）`,
  );
}
console.log(
  written.length > 0 ? `  写入：${written.join('｜')}` : '  写入：无（工作树与产物一致，未改写任何文件）',
);
if (r4Stats.entries > 0) {
  console.log(
    `  R4 accessSources 收敛：截断 ${r4Stats.entries} 条｜去除 ${r4Stats.tags} 个最旧来源标签｜瘦身约 ${r4Stats.bytes} 字节（保留最近 ${ACCESS_SOURCES_MAX} 个；accessCount/seen/lastAccess 语义不变）`,
  );
}
console.log('  提示：改动 knowledge/*.md 后请重跑 `pnpm run ctx:build` 刷新索引面。');

// ── 6) 沉淀统计区块（无任何变化 → 不打印）────────────────────────────────────
const idsOfKindOnRunDate = (kind) => {
  const out = [];
  for (const ev of ledger.events) {
    if (ev.kind !== kind || ev.date !== runDate) continue;
    for (const id of ev.ids) if (!out.includes(id)) out.push(id);
  }
  return sortedIds(out);
};
const archivedEventIds = idsOfKindOnRunDate('archived');
const reactivatedEventIds = idsOfKindOnRunDate('reactivated');
const anyChange =
  addedIds.length + updatedIds.length + backfilledIds.length + archivedEventIds.length + reactivatedEventIds.length > 0;
if (anyChange) {
  console.log('');
  console.log('本次沉淀统计（kb:sync）');
  console.log(statRow('新增', addedIds));
  console.log(statRow('修改', updatedIds));
  console.log(
    statRow('激活', reactivatedEventIds, '本命令不产生激活，仅汇总本次运行日 events 中的 reactivated'),
  );
  console.log(statRow('归档', archivedEventIds, '同上口径：仅汇总本次运行日 events 中的 archived'));
  if (backfilledIds.length > 0) {
    console.log(
      ` · （旧库迁移：为 ${backfilledIds.length} 条既有条目一次性补齐 contentHash 基线，不计入「新增/修改」）`,
    );
  }
}

function statRow(label, ids, suffix) {
  const head = ` · ${label} ${ids.length} 条`;
  const body = ids.length > 0 ? `：${ids.map((id) => entryLabel(id)).join('；')}` : '';
  const tail = suffix ? `（${suffix}）` : '';
  return `${head}${body}${tail}`;
}

function entryLabel(id) {
  const e = byId.get(id);
  if (!e) return id;
  const cat = e.category ? ` [${e.category}]` : '';
  return `${id}${cat} ${e.title ?? ''}`.trim();
}

/** 内容一致则**不写盘**（幂等：ledger / INDEX / archive INDEX / CHANGELOG 字节稳定）。 */
function writeIfChanged(abs, text) {
  let prev = null;
  try {
    prev = readFileSync(abs, 'utf8');
  } catch {
    prev = null;
  }
  if (prev === text) return false;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text, 'utf8');
  return true;
}

function defaultIfInvalid(v, dflt) {
  return Number.isFinite(v) ? v : dflt;
}
