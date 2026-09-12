#!/usr/bin/env node
/**
 * kb-touch.mjs — 知识库条目「显式访问」补录（WXG-T-029）。
 *
 * 用途：`kb:collect` 只覆盖写转录的 IDE（Cursor / WorkBuddy）；Qoder / CodeBuddy
 * 或**纯手工**引用条目的场景，用本命令补录一次次访问。
 *
 * 语义：对每个 ID —— `accessCount += 1`、`lastAccess = --date`（默认今天），
 * `accessSources` 追加一个去重的来源标签：给了 `--task` 记 `touch:<task>`，
 * 否则记 `touch:<date>`；并**同步 append 一条 `seen`**（格式 `<主体>#<date>`，
 * 主体 = 上述来源标签，属**显式动作主体** `touch:…`）——使 `accessCount === seen.length`
 * 对条目**严格成立**（kb:check ⑥，无豁免），且**不影响** `kb:collect` 的同会话去重
 * （`seenHasSession` 只比对采集主体，跳过 `touch:` / `reactivate:` 前缀）。
 *
 * USAGE
 *   node tools/scripts/kb-touch.mjs K-001 K-003
 *   node tools/scripts/kb-touch.mjs K-001 --date=2026-09-12
 *   node tools/scripts/kb-touch.mjs K-003 --task=WXG-T-026
 *   # 经 pnpm：pnpm run kb:touch -- K-001 K-003
 *
 * 退出码：0 全部成功；1 有未知 / 非活跃 ID；2 未给 ID（用法错误）。
 */

import {
  LEDGER_PATH,
  normalizeLedgerEntry,
  parseArgs,
  readLedger,
  seenToken,
  todayISO,
  writeLedger,
} from './lib/knowledge-ledger.mjs';

const { positional, opts } = parseArgs(process.argv.slice(2));
const ids = positional.length > 0 ? positional : String(opts.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (ids.length === 0) {
  console.error('用法：node tools/scripts/kb-touch.mjs K-001 K-003 [--date=YYYY-MM-DD] [--task=WXG-T-0xx]');
  console.error('      经 pnpm：pnpm run kb:touch -- K-001 K-003');
  process.exit(2);
}
const date = typeof opts.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : todayISO();
const task = typeof opts.task === 'string' ? opts.task : null;
const tag = task ? `touch:${task}` : `touch:${date}`;

const ledger = readLedger();
if (!ledger) {
  console.error('❌ 未找到 knowledge/ledger.json —— 先跑 `pnpm run kb:sync` 初始化。');
  process.exit(1);
}
const byId = new Map((ledger.entries ?? []).map((e) => [e.id, e]));

let failed = false;
const done = [];
for (const id of ids) {
  const le = byId.get(id);
  if (!le) {
    console.error(`❌ 未知条目 ID：${id}`);
    failed = true;
    continue;
  }
  if (le.state !== 'active') {
    console.error(`❌ 条目 ${id} 非活跃（state=${le.state}）—— 归档条目请先 kb:reactivate。`);
    failed = true;
    continue;
  }
  const cur = normalizeLedgerEntry(le);
  cur.accessCount = (cur.accessCount ?? 0) + 1;
  cur.lastAccess = date;
  if (!cur.accessSources.includes(tag)) cur.accessSources.push(tag);
  // 显式动作留痕（`touch:…` 主体）：+1 accessCount 必 +1 seen，使 ⑥ 对条目严格成立。
  cur.seen.push(seenToken(tag, date));
  byId.set(id, cur);
  done.push(`${id} → accessCount=${cur.accessCount}，lastAccess=${cur.lastAccess}，来源标签 +${tag}，seen +1`);
}

if (done.length > 0) {
  ledger.entries = [...byId.values()];
  writeLedger(ledger);
}

console.log('知识库显式访问补录（kb:touch）');
for (const line of done) console.log(`  ✅ ${line}`);
if (failed) {
  console.error('  部分 ID 未处理（见上）；ledger 已写入成功项。');
  process.exit(1);
}
console.log(`  ledger：${LEDGER_PATH}`);
