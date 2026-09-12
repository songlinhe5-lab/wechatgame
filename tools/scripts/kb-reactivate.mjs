#!/usr/bin/env node
/**
 * kb-reactivate.mjs — 从归档重新激活知识库条目（WXG-T-029）。
 *
 * 动作（每个 ID）：
 *   1. 从 `knowledge/archive/<…>-archived.md` 删除该条目（并剥离归档元信息行）；
 *   2. 原文搬回**原文件**（保持类别分区：置于该 `## 类别` 分区末尾）；
 *   3. ledger → `state: active` + `reactivatedDate`；**保留原 accessCount 并 +1**，
 *      `accessSources` 追加 `reactivate:<日期>`，`seen` 追加 `reactivate:<日期>#<日期>`
 *      （**显式动作主体**留痕，使 `accessCount === seen.length` 严格成立；不影响
 *      `kb:collect` 的同会话去重）；
 *   4. **重算 `contentHash`**（按回到活跃文件后的正文，剔除归档元信息行）；
 *   5. ledger `events` **追加一条** `{kind:"reactivated"}`（append-only；`taskId` 取 `--task`）。
 * 之后刷新 `knowledge/archive/INDEX.md` 与 `knowledge/INDEX.md` 活跃块。
 *
 * USAGE
 *   node tools/scripts/kb-reactivate.mjs --ids=K-004 --reason="新增条目命中归档，重新激活并合并"
 *   node tools/scripts/kb-reactivate.mjs --ids=K-004 --reason="…" --task=WXG-T-029   # 归因（写入 event）
 *   # 经 pnpm：pnpm run kb:reactivate -- --ids=K-004 --reason="…"
 *
 * 退出码：0 成功；1 未知 / 非归档 ID；2 缺 --ids 或 --task 形态非法（用法错误）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  ACTIVE_FILES,
  ARCHIVE_DIR,
  ARCHIVE_INDEX_PATH,
  INDEX_PATH,
  TASK_ID_RE,
  contentHashOf,
  insertIntoCategory,
  makeEvent,
  normalizeEvents,
  normalizeLedgerEntry,
  parseArgs,
  parseIdNum,
  parseKnowledgeFile,
  readArchiveFile,
  readLedger,
  renderActiveBlock,
  renderArchiveIndex,
  rewriteActiveBlock,
  seenToken,
  sortEntries,
  stripArchivedMeta,
  todayISO,
  writeLedger,
} from './lib/knowledge-ledger.mjs';

const { opts } = parseArgs(process.argv.slice(2));
const idsRaw = typeof opts.ids === 'string' ? opts.ids : null;
const reason = typeof opts.reason === 'string' ? opts.reason.trim() : '';
const date = typeof opts.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : todayISO();
const task = typeof opts.task === 'string' && opts.task.trim() !== '' ? opts.task.trim() : null;

if (!idsRaw) {
  console.error('用法：node tools/scripts/kb-reactivate.mjs --ids=K-004 [--reason="…"] [--date=YYYY-MM-DD] [--task=WXG-T-0xx]');
  process.exit(2);
}
if (task !== null && !TASK_ID_RE.test(task)) {
  console.error(`❌ --task 形态非法（${task}）：应形如 WXG-T-029。`);
  process.exit(2);
}
const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
if (ids.length === 0) {
  console.error('❌ --ids 未给出有效 ID。');
  process.exit(2);
}

const ledger = readLedger();
if (!ledger) {
  console.error('❌ 未找到 knowledge/ledger.json —— 先跑 `pnpm run kb:sync`。');
  process.exit(1);
}
const byId = new Map((ledger.entries ?? []).map((e) => [e.id, e]));

// 校验
for (const id of ids) {
  const le = byId.get(id);
  if (!le) {
    console.error(`❌ 未知条目 ID：${id}`);
    process.exit(1);
  }
  if (le.state !== 'archived') {
    console.error(`❌ 条目 ${id} 非归档（state=${le.state}），无需重新激活。`);
    process.exit(1);
  }
}

mkdirSync(ARCHIVE_DIR, { recursive: true });

// 依源文件分组
const groups = new Map(); // file → { cfg, ids: [] }
for (const id of ids) {
  const le = byId.get(id);
  const cfg = ACTIVE_FILES.find((f) => f.file === le.file);
  if (!cfg) {
    console.error(`❌ 条目 ${id} 的源文件未知：${le.file}`);
    process.exit(1);
  }
  if (!groups.has(cfg.file)) groups.set(cfg.file, { cfg, ids: [] });
  groups.get(cfg.file).ids.push(id);
}

const reactivatedNow = [];

for (const { cfg, ids: gids } of groups.values()) {
  const archiveText = readArchiveFile(cfg.archiveAbs, cfg.label);
  const parsed = parseKnowledgeFile(archiveText, cfg.archive);
  const byEntryId = new Map(parsed.entries.filter((e) => e.id).map((e) => [e.id, e]));

  // 从后往前删归档条目
  const ordered = [...gids].sort((a, b) => (byEntryId.get(b)?.startLine ?? 0) - (byEntryId.get(a)?.startLine ?? 0));
  let archLines = [...parsed.lines];
  let activeText = existsSync(cfg.abs) ? readFileSync(cfg.abs, 'utf8') : `# ${cfg.label}.md\n`;
  let activeLines = activeText.split('\n');

  for (const id of ordered) {
    const entry = byEntryId.get(id);
    if (!entry) {
      console.error(`❌ 条目 ${id} 在归档文件 ${cfg.archive} 中不存在（ledger 与 markdown 不一致）——先跑 kb:check。`);
      process.exit(1);
    }
    // 剥离归档元信息，恢复原文（标题 + 正文）
    const restored = [entry.raw, ...stripArchivedMeta(entry)];
    const le = byId.get(id);
    activeLines = insertIntoCategory(activeLines, le.category, restored);
    activeText = activeLines.join('\n');

    // 从归档文件删除
    const at = entry.startLine - 1;
    const out = [...archLines.slice(0, at), ...archLines.slice(entry.endLine)];
    if (at - 1 >= 0 && at < out.length && out[at - 1] === '' && out[at] === '') out.splice(at, 1);
    archLines = out;

    const cur = normalizeLedgerEntry(le);
    cur.state = 'active';
    cur.reactivatedDate = date;
    // 重算 contentHash：按「回到活跃文件后的正文」= 标题行 + 剥离归档元信息后的正文行。
    cur.contentHash = contentHashOf(restored);
    cur.accessCount = (cur.accessCount ?? 0) + 1;
    cur.lastAccess = date;
    const tag = `reactivate:${date}`;
    if (!cur.accessSources.includes(tag)) cur.accessSources.push(tag);
    // 显式动作留痕（`reactivate:…` 主体）：+1 accessCount 必 +1 seen，使 ⑥ 严格成立。
    cur.seen.push(seenToken(tag, date));
    byId.set(id, cur);
    reactivatedNow.push(id);
  }

  writeFileSync(cfg.abs, activeText, 'utf8');
  writeFileSync(cfg.archiveAbs, archLines.join('\n'), 'utf8');
}

ledger.entries = sortEntries([...byId.values()]);
// events 为 append-only 追加日志：激活成功 → 追加一条 reactivated（同批 ID 合并为一条）。
ledger.events = [
  ...normalizeEvents(ledger.events),
  makeEvent({
    date,
    taskId: task,
    kind: 'reactivated',
    ids: [...reactivatedNow].sort((a, b) => parseIdNum(a) - parseIdNum(b)),
    note: reason || null,
  }),
];
writeLedger(ledger);

const indexText = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : '# knowledge/ — 工作室知识库\n';
writeFileSync(INDEX_PATH, rewriteActiveBlock(indexText, renderActiveBlock(ledger.entries)), 'utf8');
writeFileSync(ARCHIVE_INDEX_PATH, renderArchiveIndex(ledger.entries), 'utf8');

console.log('知识库重新激活（kb:reactivate）');
for (const id of reactivatedNow) {
  const e = byId.get(id);
  console.log(`  ✅ ${id}「${e.title}」→ 回到 ${e.file}（reactivatedDate=${e.reactivatedDate}，accessCount=${e.accessCount}）`);
}
if (reason) console.log(`  原因：${reason}`);
console.log(
  `  events：已追加 1 条 reactivated（${reactivatedNow.length} 条 ID，taskId=${task ?? 'null'}）；` +
    'contentHash 已按回到活跃文件后的正文重算',
);
console.log('  已刷新：knowledge/INDEX.md 活跃块、knowledge/archive/INDEX.md、knowledge/ledger.json');
console.log('  提示：`pnpm run kb:check` 复核；`pnpm run ctx:build` 刷新索引面。');
