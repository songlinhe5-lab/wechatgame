#!/usr/bin/env node
/**
 * kb-collect.mjs — 自动采集知识库条目访问（WXG-T-029）。
 *
 * 数据源：`ctx/reads-ledger.jsonl`（由 `pnpm run ctx:reads` 采集的本机 IDE 读事件账本）。
 * 只取 `path` 以 `knowledge/` 开头的读事件，按 `offset`/`limit` 与条目行区间**求交归属**，
 * 更新条目 `accessCount` / `lastAccess` / `accessSources`。
 *
 * ── 三条关键口径（写死）────────────────────────────────────────────────────
 * 1. **同会话去重（跨运行持久）**：同一 `(session, 条目)` 只计 1 次 —— 防同会话反复读
 *    同一条目刷计数。该判定由条目 `seen` 字段**持久化**（元素 `"<主体>#<观察日>"`：
 *    采集主体 = 会话标识；另有 `touch:` / `reactivate:` **显式动作主体**，见 `seenHasSession`
 *    会跳过它们、不参与本去重），故**跨运行 / 跨天都只计一次**：本命令**幂等**（详见下方）。
 * 2. **无时间戳账本**：`ctx/reads-ledger.jsonl` 的读事件**不含时间戳**，故 `lastAccess`
 *    记为**运行日**（观察日粒度），`accessSources` 相应记 `ledger:<运行日>`。
 * 3. **只认活跃条目**：归档条目（state=archived）与被跳过文件（INDEX.md / archive/**）
 *    的读取不计入。
 *
 * ── 幂等（WXG-T-029 收口，正确性修复）──────────────────────────────────────
 * 旧实现只做**单轮内**去重，跨运行会把账本里既有的 (会话, 条目) 再计一遍 →
 * `accessCount` 随重跑膨胀。而 `accessCount` 是归档判定的输入（膨胀 → 该归档的条目
 * 永不入候选），故属**正确性缺陷**。现由条目 `seen` 持久记录已计入的 (会话, 条目) 对：
 * 命中即跳过。**同一账本连跑两次不改变任何计数**；第二次 attributed=0 → 不写盘 →
 * ledger **字节稳定**。旧 ledger 无 `seen` → 按空数组读入（不报错、不重置既有数据）。
 *
 * ── 已知边界（诚实记录）────────────────────────────────────────────────────
 * • 账本只覆盖**写转录的 IDE**（Cursor / WorkBuddy）；Qoder / CodeBuddy 的读取不可见
 *   → 「未访问」可能实为「未被观察」，故归档必须人工确认（kb:audit 只出候选）。
 * • `seen` 同时记录**采集主体**（本命令，`<session>`）与**显式动作主体**（`kb:touch` /
 *   `kb:reactivate`，`touch:` / `reactivate:` 前缀）。本命令去重**只看采集主体**
 *   （`seenHasSession` 跳过显式动作主体），故显式动作留痕不会令真实采集被漏计；且每类
 *   +1 都恰留一条 seen → `accessCount === seen.length` 对**所有条目**严格成立（kb:check ⑥）。
 *
 * USAGE
 *   node tools/scripts/kb-collect.mjs
 *   node tools/scripts/kb-collect.mjs --dry-run            # 只报告，不写 ledger
 *   node tools/scripts/kb-collect.mjs --ledger=<path>      # 覆盖读事件账本路径
 *   node tools/scripts/kb-collect.mjs --today=2026-09-12   # 覆盖运行日（自测用）
 *
 * 退出码：0 成功；1 缺 ledger / 账本不可读。
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACTIVE_FILES,
  LEDGER_PATH,
  ROOT,
  normalizeLedgerEntry,
  parseArgs,
  parseKnowledgeFile,
  readLedger,
  seenHasSession,
  seenToken,
  todayISO,
  writeLedger,
} from './lib/knowledge-ledger.mjs';

const { opts } = parseArgs(process.argv.slice(2));
const today = todayISO(opts.today);
const dryRun = opts['dry-run'] === true;
const readsPath = typeof opts.ledger === 'string' ? opts.ledger : join(ROOT, 'ctx', 'reads-ledger.jsonl');

const ledger = readLedger();
if (!ledger) {
  console.error('❌ 未找到 knowledge/ledger.json —— 先跑 `pnpm run kb:sync` 初始化。');
  process.exit(1);
}
if (!existsSync(readsPath)) {
  console.error(`❌ 未找到读事件账本：${readsPath}\n   先跑 \`pnpm run ctx:reads\` 采集（或 --ledger=<path> 指定）。`);
  process.exit(1);
}

const byId = new Map((ledger.entries ?? []).map((e) => [e.id, e]));

// 活跃文件 → 条目行区间（只认带 ID 的活跃条目）
const byFile = new Map();
for (const f of ACTIVE_FILES) {
  if (!existsSync(f.abs)) continue;
  const parsed = parseKnowledgeFile(readFileSync(f.abs, 'utf8'), f.file);
  byFile.set(f.file, parsed.entries.filter((e) => e.id));
}

// 扫描读事件
const rawLines = readFileSync(readsPath, 'utf8').split('\n');
let malformed = 0;
let knowledgeReads = 0;
let outOfActive = 0; // knowledge/ 开头但非活跃条目文件（INDEX.md / archive/**）
let attributed = 0;
const touched = new Map(); // id → 本轮新增计数
let alreadySeen = 0; // 命中 seen（本会话本轮或往轮已计）而跳过的 (会话,条目) 对

for (const line of rawLines) {
  const s = line.trim();
  if (!s) continue;
  let ev;
  try {
    ev = JSON.parse(s);
  } catch {
    malformed += 1;
    continue;
  }
  const p = ev?.path;
  if (typeof p !== 'string' || !p.startsWith('knowledge/')) continue;
  knowledgeReads += 1;
  const entries = byFile.get(p);
  if (!entries) {
    outOfActive += 1;
    continue;
  }
  const start = Number.isFinite(ev.offset) && ev.offset != null ? ev.offset : 1;
  const end = Number.isFinite(ev.limit) && ev.limit != null ? start + ev.limit - 1 : Infinity;
  for (const e of entries) {
    if (!(start <= e.endLine && end >= e.startLine)) continue;
    const le = byId.get(e.id);
    if (!le || le.state !== 'active') continue; // 只认活跃条目
    const cur = normalizeLedgerEntry(le); // 旧数据无 seen → 归一为 []
    // 同一 (会话, 条目) 只计一次：seen 持久记录，跨运行 / 跨天命中即跳过（不 +1、不刷新 lastAccess）。
    if (seenHasSession(cur.seen, ev.session)) {
      alreadySeen += 1;
      continue;
    }
    cur.seen.push(seenToken(ev.session, today));
    cur.accessCount = (cur.accessCount ?? 0) + 1;
    cur.lastAccess = today;
    const tag = `ledger:${today}`;
    if (!cur.accessSources.includes(tag)) cur.accessSources.push(tag);
    byId.set(e.id, cur);
    attributed += 1;
    touched.set(e.id, (touched.get(e.id) ?? 0) + 1);
  }
}

if (!dryRun && attributed > 0) {
  ledger.entries = [...byId.values()];
  writeLedger(ledger);
}

// ── 报告 ────────────────────────────────────────────────────────────────────
console.log('知识库访问采集（kb:collect）— 数据源：ctx/reads-ledger.jsonl');
console.log(`  读事件账本：${readsPath}`);
console.log(`  账本行数：${rawLines.filter((l) => l.trim()).length}（畸形 ${malformed}）`);
console.log(`  识别到 knowledge/*.md 读事件：${knowledgeReads}`);
console.log(`  其中归属活跃条目文件：${knowledgeReads - outOfActive}（非活跃条目文件 ${outOfActive}，如 INDEX.md / archive/**）`);
console.log(`  归属并计数（同会话去重后）：${attributed}`);
console.log(`  其中由 seen 判为「已计入」而跳过：${alreadySeen}（跨运行幂等的依据）`);
if (touched.size === 0) {
  console.log('  结论：无**新**（会话,条目）对 → 未更新任何条目 accessCount（如实报 0；重复运行即此态）。');
} else {
  console.log('  逐条目新增（accessCount / seen / lastAccess）：');
  for (const [id, n] of [...touched.entries()].sort()) {
    const e = byId.get(id);
    console.log(`    ${id}：+${n} → accessCount=${e.accessCount}（seen=${e.seen.length}），lastAccess=${e.lastAccess}`);
  }
}
console.log(
  dryRun ? '  （--dry-run：未写入 ledger）' : '  ledger 已更新：knowledge/ledger.json',
);
console.log('  提示：lastAccess 为**观察日粒度**（账本无时间戳）；账本不覆盖 Qoder/CodeBuddy → 归档前须人工复核。');
