#!/usr/bin/env node
/**
 * kb-check.mjs — 知识库 ledger / markdown / 索引面一致性校验（WXG-T-029）。
 *
 * 八重校验（失败 → 中文诊断 + 修复指引，exit 1）：
 *   ① 活跃条目 ID 唯一且格式合法（`K-\d{3}`；活跃 + 归档全局唯一）；
 *   ② ledger ↔ markdown **双向一致**（活跃↔lessons/patterns，归档↔archive/*；
 *      无孤儿 ledger 条目、无缺 ledger 的 markdown 条目）；
 *   ③ `archive` 已在 ctx 索引 `SKIP_DIRS` 中（断言；保证归档不进索引面）；
 *   ④ `knowledge/INDEX.md` 活跃表块与 ledger 一致（行数 / ID / 关键列）；
 *   ⑤ `thresholds` 存在且三值合法；
 *   ⑥ **`accessCount` ↔ `seen` 严格一致**：**所有条目**均须 `accessCount === seen.length`
 *      ——每次访问计数（采集 `kb:collect` / 显式动作 `kb:touch` / `kb:reactivate`）都恰留
 *      一条 `seen`，故 +1 与 seen 追加一一对应。**对所有条目一律严格判定，无特例放行**
 *      （放行会吞掉真实的数据不一致，是漏洞温床）。
 *   ⑦ **`events` 合法性**：每条 event 的 `kind` ∈ {added,updated,reactivated,archived}、
 *      `date` 形如 `YYYY-MM-DD`、`ids` 中每个 ID **在 ledger 中存在**（活跃或归档皆可）、
 *      `taskId` 为 `WXG-T-\d+` 或 `null`。
 *   ⑧ **`contentHash` 一致**：每个条目的 `contentHash` 必须与其**当前正文**
 *      （活跃↔lessons/patterns，归档↔archive/*）匹配 → 不匹配 / 缺失 = 有未 sync 的改动
 *      → FAIL + 提示 `pnpm run kb:sync`。
 *
 * USAGE
 *   node tools/scripts/kb-check.mjs
 *
 * 退出码：0 全通过；1 任一失败。
 */

import { existsSync, readFileSync } from 'node:fs';
import { SKIP_DIRS } from './lib/context-index.mjs';
import {
  ACTIVE_FILES,
  ACTIVE_END,
  ACTIVE_START,
  ARCHIVE_INDEX_PATH,
  DATE_RE,
  DEFAULT_THRESHOLDS,
  EVENT_FIELDS,
  EVENT_KINDS,
  ID_RE,
  INDEX_PATH,
  TASK_ID_RE,
  entryContentHash,
  normalizeThresholds,
  parseKnowledgeFile,
  readLedger,
  sortEntries,
} from './lib/knowledge-ledger.mjs';

const problems = [];
const fixes = new Set();

function fail(msg, fix) {
  problems.push(msg);
  if (fix) fixes.add(fix);
}

const ledger = readLedger();
if (!ledger) {
  console.error('❌ kb:check FAILED —— 未找到 / 无法解析 knowledge/ledger.json');
  console.error('   修复：pnpm run kb:sync');
  process.exit(1);
}

const entries = ledger.entries ?? [];
const actives = sortEntries(entries.filter((e) => e.state === 'active'));
const archived = sortEntries(entries.filter((e) => e.state === 'archived'));

// ── ① ID 唯一 + 格式合法 ────────────────────────────────────────────────────
const idCount = new Map();
for (const e of entries) {
  const id = String(e.id);
  if (!ID_RE.test(id)) fail(`① 非法 ID「${id}」（应为 K-\\d{3}）`, 'pnpm run kb:sync');
  idCount.set(id, (idCount.get(id) ?? 0) + 1);
}
for (const [id, n] of idCount) {
  if (n > 1) fail(`① ID 重复：${id}（出现 ${n} 次）`, 'pnpm run kb:sync 后人工核对');
}

// ── ② ledger ↔ markdown 双向一致 ───────────────────────────────────────────
function parseFileText(abs, rel) {
  if (!existsSync(abs)) return null;
  return parseKnowledgeFile(readFileSync(abs, 'utf8'), rel);
}
function collectIds(parsed) {
  return new Set((parsed?.entries ?? []).filter((e) => e.id).map((e) => e.id));
}

/** id → 当前正文条目（活跃或归档；供 ⑧ 重算 contentHash）。 */
const mdEntryById = new Map();
const remember = (parsed) => {
  for (const e of parsed.entries) if (e.id) mdEntryById.set(e.id, e);
};

const activeMdIds = new Set();
for (const f of ACTIVE_FILES) {
  const parsed = parseFileText(f.abs, f.file);
  if (!parsed) {
    fail(`② 活跃文件缺失：${f.file}`, 'pnpm run kb:sync');
    continue;
  }
  remember(parsed);
  for (const id of collectIds(parsed)) activeMdIds.add(id);
}
const archiveMdIds = new Set();
for (const f of ACTIVE_FILES) {
  const parsed = parseFileText(f.archiveAbs, f.archive);
  if (!parsed) continue; // 归档文件可缺失（无归档时）
  remember(parsed);
  for (const id of collectIds(parsed)) archiveMdIds.add(id);
}
const ledgerActiveIds = new Set(actives.map((e) => e.id));
const ledgerArchivedIds = new Set(archived.map((e) => e.id));

for (const id of ledgerActiveIds) {
  if (!activeMdIds.has(id)) {
    const e = actives.find((x) => x.id === id);
    fail(`② 孤儿 ledger 条目：${id}「${e?.title}」为 active，但 ${e?.file} 中不存在`, 'pnpm run kb:sync / kb:check 后人工核对');
  }
}
for (const id of activeMdIds) {
  if (!ledgerActiveIds.has(id)) fail(`② 缺 ledger 条目：markdown 中的 ${id} 不在 ledger（或非 active）`, 'pnpm run kb:sync');
}
for (const id of ledgerArchivedIds) {
  if (!archiveMdIds.has(id)) {
    const e = archived.find((x) => x.id === id);
    fail(`② 孤儿归档条目：${id}「${e?.title}」为 archived，但 archive/* 中不存在`, 'pnpm run kb:check 后人工核对');
  }
}
for (const id of archiveMdIds) {
  if (!ledgerArchivedIds.has(id)) fail(`② 缺 ledger 归档条目：archive 中的 ${id} 不在 ledger（或非 archived）`, 'pnpm run kb:sync');
}

// ── ③ archive ∈ ctx SKIP_DIRS ──────────────────────────────────────────────
if (!SKIP_DIRS.has('archive')) {
  fail('③ ctx 索引 SKIP_DIRS 未包含 archive（归档目录会进索引面）', 'tools/scripts/lib/context-index.mjs 的 SKIP_DIRS 加入 archive');
}

// ── ④ INDEX.md 活跃块与 ledger 一致 ────────────────────────────────────────
const indexText = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : null;
if (indexText == null) {
  fail(`④ 缺少 ${'knowledge/INDEX.md'}`, 'pnpm run kb:sync');
} else {
  const s = indexText.indexOf(ACTIVE_START);
  const e = indexText.indexOf(ACTIVE_END);
  if (s === -1 || e === -1 || e < s) {
    fail('④ INDEX.md 缺活跃表块标记（kb:active:start/end）', 'pnpm run kb:sync');
  } else {
    const block = indexText.slice(s + ACTIVE_START.length, e);
    const rows = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|'))
      .filter((l) => !/^\|\s*ID\s*\|/.test(l) && !/^\|[-|\s]+\|$/.test(l));
    const indexIds = rows.map((r) => r.split('|')[1]?.trim()).filter(Boolean);
    const setIndex = new Set(indexIds);
    if (indexIds.length !== actives.length) {
      fail(`④ INDEX.md 活跃块行数（${indexIds.length}）≠ ledger 活跃条目数（${actives.length}）`, 'pnpm run kb:sync');
    }
    for (const e2 of actives) {
      if (!setIndex.has(e2.id)) fail(`④ INDEX.md 活跃块缺条目 ${e2.id}`, 'pnpm run kb:sync');
    }
    for (const id of setIndex) {
      if (!ledgerActiveIds.has(id)) fail(`④ INDEX.md 活跃块含非活跃 / 未知条目 ${id}`, 'pnpm run kb:sync');
    }
  }
}
if (!existsSync(ARCHIVE_INDEX_PATH)) {
  fail('④ 缺少 knowledge/archive/INDEX.md（归档清单）', 'pnpm run kb:sync');
}

// ── ⑤ thresholds ───────────────────────────────────────────────────────────
const th = ledger.thresholds;
if (!th || typeof th !== 'object') {
  fail('⑤ ledger 缺 thresholds', 'pnpm run kb:sync');
} else {
  const norm = normalizeThresholds(th);
  for (const k of ['archiveIdleDays', 'archiveMaxAccess', 'reactivateSimilarity']) {
    if (!Number.isFinite(th[k])) fail(`⑤ thresholds.${k} 缺失 / 非数值（应为 ${norm[k]}）`, 'pnpm run kb:sync');
  }
  if (!(Number.isFinite(th.archiveIdleDays) && th.archiveIdleDays > 0)) {
    fail(`⑤ thresholds.archiveIdleDays 非法（${th.archiveIdleDays}），期望 > 0`, `设为 ${DEFAULT_THRESHOLDS.archiveIdleDays}`);
  }
  if (!(Number.isFinite(th.reactivateSimilarity) && th.reactivateSimilarity >= 0 && th.reactivateSimilarity <= 1)) {
    fail(`⑤ thresholds.reactivateSimilarity 非法（${th.reactivateSimilarity}），期望 [0,1]`, `设为 ${DEFAULT_THRESHOLDS.reactivateSimilarity}`);
  }
}

// ── ⑥ accessCount ↔ seen 严格一致（所有条目，一律判定）─────────────────────
// seen 记录**每一次访问计数**的留痕：kb:collect（采集主体 `<session>`）、kb:touch /
// kb:reactivate（显式动作主体 `touch:` / `reactivate:`）都会 +1 并恰好追加一条 seen，
// 故**所有条目**都必须满足 `accessCount === seen.length`——不再对「采集外增量」网开一面
// （放行会吞掉真实的数据不一致，是漏洞温床）。
for (const e of entries) {
  const count = e.accessCount ?? 0;
  const seenLen = Array.isArray(e.seen) ? e.seen.length : 0;
  if (count === seenLen) continue;
  fail(
    `⑥ 条目 ${e.id}：accessCount=${count} 与 seen 长度=${seenLen} 不一致（每次访问计数——采集 / touch / reactivate——都应恰留一条 seen）`,
    '若为误改，先 `pnpm run kb:collect --dry-run` 复核；必要时按 seen 条目数校正 accessCount',
  );
}

// ── ⑦ events 合法性（append-only 变更日志）──────────────────────────────────
const allLedgerIds = new Set(entries.map((e) => String(e.id)));
if (!Array.isArray(ledger.events)) {
  fail('⑦ ledger 缺 events 数组（应为 append-only 数组）', 'pnpm run kb:sync');
} else {
  ledger.events.forEach((ev, i) => {
    const at = `⑦ events[${i}]`;
    const keys = Object.keys(ev ?? {});
    for (const k of EVENT_FIELDS) {
      if (!keys.includes(k)) fail(`${at} 缺字段 ${k}（键序应为 ${EVENT_FIELDS.join('/')}）`, 'pnpm run kb:sync');
    }
    if (!EVENT_KINDS.includes(ev?.kind)) {
      fail(`${at} 非法 kind「${ev?.kind}」（应为 ${EVENT_KINDS.join(' / ')}）`, 'pnpm run kb:sync');
    }
    if (typeof ev?.date !== 'string' || !DATE_RE.test(ev.date)) {
      fail(`${at} date 非法（${JSON.stringify(ev?.date)}），应为 YYYY-MM-DD`, 'pnpm run kb:sync');
    }
    if (!(ev?.taskId == null || (typeof ev.taskId === 'string' && TASK_ID_RE.test(ev.taskId)))) {
      fail(`${at} taskId 非法（${JSON.stringify(ev?.taskId)}），应为 WXG-T-\\d+ 或 null`, 'pnpm run kb:sync');
    }
    if (!Array.isArray(ev?.ids) || ev.ids.length === 0) {
      fail(`${at} ids 非法（应为非空 ID 数组）`, 'pnpm run kb:sync');
    } else {
      for (const id of ev.ids) {
        if (!allLedgerIds.has(String(id))) {
          fail(`${at} 引用了 ledger 中不存在的 ID：${id}`, 'pnpm run kb:sync / 人工核对该 event 的 ids');
        }
      }
    }
  });
}

// ── ⑧ contentHash 一致（正文未 sync 的改动）─────────────────────────────────
// 判定：条目 contentHash 必须等于「当前正文（活跃↔lessons/patterns，归档↔archive/*）」
// 规范化后的 sha256。缺失 = 未跑过 sync 的新增/迁移；不符 = 改了正文但没同步。
for (const e of entries) {
  const cur = mdEntryById.get(e.id);
  if (!cur) continue; // ② 已报「孤儿 / 缺条目」，此处不重复
  const expected = entryContentHash(cur);
  const stored = typeof e.contentHash === 'string' ? e.contentHash : '';
  if (!stored) {
    fail(`⑧ 条目 ${e.id} 缺 contentHash（有未 sync 的新增 / 迁移）`, 'pnpm run kb:sync');
  } else if (stored !== expected) {
    fail(
      `⑧ 条目 ${e.id} 正文已变但 contentHash 未更新（有未 sync 的修改）：台账 ${stored.slice(0, 12)}… ≠ 当前正文 ${expected.slice(0, 12)}…`,
      'pnpm run kb:sync',
    );
  }
}

// ── 汇总 ───────────────────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(
    `✅ kb:check PASSED —— **八重校验**：活跃 ${actives.length} / 归档 ${archived.length}；` +
      `① ID 唯一且合法 ② ledger↔markdown 双向一致 ③ SKIP_DIRS 含 archive ④ INDEX 活跃块同步 ` +
      `⑤ thresholds 合法 ⑥ accessCount↔seen 严格一致 ⑦ events 合法 ⑧ contentHash 一致`,
  );
  process.exit(0);
}
console.error(`❌ kb:check FAILED（八重校验）—— ${problems.length} 项问题：`);
for (const p of problems) console.error(`   - ${p}`);
if (fixes.size > 0) {
  console.error('   修复指引：');
  for (const f of fixes) console.error(`     · ${f}`);
}
process.exit(1);
