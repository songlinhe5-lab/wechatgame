#!/usr/bin/env node
/**
 * kb-archive.mjs — 归档知识库条目（**人工确认后**执行；WXG-T-029）。
 *
 * 动作（每个 ID）：
 *   1. 从活跃文件（lessons.md / patterns.md）删除该条目；
 *   2. 原文**完整**搬到 `knowledge/archive/<lessons|patterns>-archived.md` 末尾，
 *      标题行下加一行归档元信息 `> 归档于 YYYY-MM-DD（原因：…）`；
 *   3. ledger → `state: archived` + `archivedDate` + `archiveReason`（保留全部访问字段与 `contentHash`）；
 *   4. ledger `events` **追加一条** `{kind:"archived"}`（append-only；`taskId` 取 `--task`，缺省 null）。
 * 之后刷新 `knowledge/archive/INDEX.md` 与 `knowledge/INDEX.md` 活跃块。
 *
 * USAGE
 *   node tools/scripts/kb-archive.mjs --ids=K-004,K-011 --reason="长期未访问，归档"
 *   node tools/scripts/kb-archive.mjs --ids=K-004 --reason="…" --task=WXG-T-029   # 归因（写入 event）
 *   # 经 pnpm：pnpm run kb:archive -- --ids=K-004,K-011 --reason="…"
 *
 * 退出码：0 成功；1 未知 / 非活跃 ID；2 缺 --ids / --reason 或 --task 形态非法（用法错误）。
 * **--reason 必填**：缺则报错退出（归档必须留痕可追溯）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  ACTIVE_FILES,
  ARCHIVE_DIR,
  ARCHIVE_INDEX_PATH,
  INDEX_PATH,
  TASK_ID_RE,
  appendArchivedEntry,
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
  sortEntries,
  todayISO,
  writeLedger,
} from './lib/knowledge-ledger.mjs';

const { opts } = parseArgs(process.argv.slice(2));
const idsRaw = typeof opts.ids === 'string' ? opts.ids : null;
const reason = typeof opts.reason === 'string' ? opts.reason.trim() : '';
const date = typeof opts.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : todayISO();
const task = typeof opts.task === 'string' && opts.task.trim() !== '' ? opts.task.trim() : null;

if (!idsRaw) {
  console.error('用法：node tools/scripts/kb-archive.mjs --ids=K-004,K-011 --reason="…" [--date=YYYY-MM-DD] [--task=WXG-T-0xx]');
  process.exit(2);
}
if (task !== null && !TASK_ID_RE.test(task)) {
  console.error(`❌ --task 形态非法（${task}）：应形如 WXG-T-029。`);
  process.exit(2);
}
if (!reason) {
  console.error('❌ --reason 必填：归档必须留痕（原因将写入条目元信息与 ledger.archiveReason）。');
  console.error('   示例：--reason="90 天未访问且仅 1 次，规则已被 ADR-00xx 取代"');
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

// 依源文件分组（同批同文件条目一次性改写，避免重复读改）
const groups = new Map(); // file → { cfg, parsed, ids: [] }
for (const id of ids) {
  const le = byId.get(id);
  if (!le) {
    console.error(`❌ 未知条目 ID：${id}`);
    process.exit(1);
  }
  if (le.state !== 'active') {
    console.error(`❌ 条目 ${id} 非活跃（state=${le.state}），无法归档。`);
    process.exit(1);
  }
  const cfg = ACTIVE_FILES.find((f) => f.file === le.file);
  if (!cfg) {
    console.error(`❌ 条目 ${id} 的源文件未知：${le.file}`);
    process.exit(1);
  }
  if (!groups.has(cfg.file)) groups.set(cfg.file, { cfg, parsed: null, ids: [] });
  groups.get(cfg.file).ids.push(id);
}

mkdirSync(ARCHIVE_DIR, { recursive: true });
const archivedNow = [];

for (const { cfg, ids: gids } of groups.values()) {
  const parsed = parseKnowledgeFile(readFileSync(cfg.abs, 'utf8'), cfg.file);
  const byEntryId = new Map(parsed.entries.filter((e) => e.id).map((e) => [e.id, e]));
  // 只为「确实存在」的条目归档；行区间来自同一份 parse
  const targets = [];
  for (const id of gids) {
    const entry = byEntryId.get(id);
    if (!entry) {
      console.error(`❌ 条目 ${id} 在 ${cfg.file} 中不存在（ledger 与 markdown 不一致）——先跑 kb:check。`);
      process.exit(1);
    }
    targets.push(entry);
  }
  // 从后往前删，行号不漂移
  const ordered = [...targets].sort((a, b) => b.startLine - a.startLine);
  let lines = [...parsed.lines];
  let archiveText = readArchiveFile(cfg.archiveAbs, cfg.label);
  for (const entry of ordered) {
    archiveText = appendArchivedEntry(archiveText, entry, { date, reason });
    const out = [...lines.slice(0, entry.startLine - 1), ...lines.slice(entry.endLine)];
    // 接缝收敛多余空行
    const at = entry.startLine - 1;
    if (at - 1 >= 0 && at < out.length && out[at - 1] === '' && out[at] === '') out.splice(at, 1);
    lines = out;

    const le = byId.get(entry.id);
    const cur = normalizeLedgerEntry(le);
    cur.state = 'archived';
    cur.archivedDate = date;
    cur.archiveReason = reason;
    byId.set(entry.id, cur);
    archivedNow.push(entry.id);
  }
  writeFileSync(cfg.abs, lines.join('\n'), 'utf8');
  writeFileSync(cfg.archiveAbs, archiveText.endsWith('\n') ? archiveText : `${archiveText}\n`, 'utf8');
}

ledger.entries = sortEntries([...byId.values()]);
// events 为 append-only 追加日志：归档成功 → 追加一条 archived（同批 ID 合并为一条）。
ledger.events = [
  ...normalizeEvents(ledger.events),
  makeEvent({
    date,
    taskId: task,
    kind: 'archived',
    ids: [...archivedNow].sort((a, b) => parseIdNum(a) - parseIdNum(b)),
    note: reason,
  }),
];
writeLedger(ledger);

// 刷新 INDEX.md 活跃块 + archive/INDEX.md
const indexText = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : '# knowledge/ — 工作室知识库\n';
writeFileSync(INDEX_PATH, rewriteActiveBlock(indexText, renderActiveBlock(ledger.entries)), 'utf8');
writeFileSync(ARCHIVE_INDEX_PATH, renderArchiveIndex(ledger.entries), 'utf8');

console.log('知识库归档（kb:archive）');
for (const id of archivedNow) {
  const e = byId.get(id);
  // 归档目的地**只能按条目 `file` 反查 ACTIVE_FILES**（WXG-T-111）：初版写死
  // `file === 'knowledge/lessons.md' ? lessons : patterns` 三元 ⇒ lessons 分片条目一旦归档，
  // 会被报成落到 `patterns-archived.md`（日志说谎，且后续查证据的人会找错面）。
  const dest = ACTIVE_FILES.find((f) => f.file === e.file)?.archive ?? '（未知源文件）';
  console.log(`  ✅ ${id}「${e.title}」→ ${dest}（归档于 ${date}）`);
}
console.log(`  原因：${reason}`);
console.log(
  `  events：已追加 1 条 archived（${archivedNow.length} 条 ID，taskId=${task ?? 'null'}）——` +
  '下次 `pnpm run kb:sync` 会把它汇总进「沉淀统计 / CHANGELOG」',
);
console.log('  已刷新：knowledge/INDEX.md 活跃块、knowledge/archive/INDEX.md、knowledge/ledger.json');
console.log('  提示：`pnpm run kb:check` 复核；`pnpm run ctx:build` 刷新索引面（归档目录已排除）。');
