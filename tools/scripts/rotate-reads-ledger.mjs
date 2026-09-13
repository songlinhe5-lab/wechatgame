#!/usr/bin/env node
/**
 * rotate-reads-ledger.mjs — 读账本**分窗轮转**器（WXG-T-037，对策 R1）。
 *
 * 背景：`ctx/reads-ledger.jsonl` 只增不减（2026-09-13 上下文膨胀审计），随会话累积
 * 无限增长。本脚本把窗口外的原始条目**移出账本**，其统计价值以「历史聚合」冻结进
 * `ctx/savings-history.json`（原始节省率样本数组 + 计数类聚合，见 lib/savings-history.mjs）。
 * E1/E3 的判定口径为**累计（当前窗口 + 历史）**——轮转只搬移样本、不改累计集合，
 * 故 E3 基线回归不会因窗口滑动而假绿/假红。
 *
 * ── 窗口语径（用户任务书 + 本实现裁决）────────────────────────────────────────
 * • **窗口预算 N 按会话计数**（含子代理会话，与 F-03 的 sessionsInLedger 同口径），
 *   默认 20 —— 与当前量级对齐（审计时点：457 行 / 20 会话 / 2 根会话树）。
 * • **轮转原子单位 = 根会话树**（session id 首段之前缀，同 analyze 的 rootOf）：整树
 *   同进同出——满足「窗口边界会话不截断」，且保持会话谱系（F-01）完整。预算按树内
 *   会话数贪心占用：最新树优先保留；一棵树放不下剩余预算时**整树轮转**；最新树自身
 *   超预算时至少保留该树（窗口恒非空）。
 * • **会话新近度**：账本为字节稳定、无时间戳设计（lib/reads-ledger.mjs），唯一可靠的
 *   时间信号是**转录文件 mtime**——由采集器写进侧车 `bySession[s].lastMtime`（WXG-T-037
 *   起）。树的新近度 = 树内各会话 lastMtime 的最大值；侧车缺失/无该字段的会话按 0 处理
 *   （视为最旧、先轮转——旧 schema 侧车即此情形），同值时按根 id 字典序稳定排序。
 *
 * ── 冻结与幂等 ────────────────────────────────────────────────────────────────
 * • 轮转出的会话**冻结在轮转时刻**：根 id 进 `archivedRootSessions` 注册表。此后
 *   `ctx:reads` 重采（转录仍在盘上）会把这些行重新带回账本，再次运行本脚本会把它们
 *   **丢弃而不重复聚合**（样本已在历史里）——重复运行不丢数据、不重复聚合。
 * • 窗口内会话数 ≤ N 时本脚本为**安全空转**（不改任何文件），故可在每次 `ctx:reads`
 *   之后无条件运行。
 * • 确有会话被轮转时，必须提供 `--reason` 与 `--task-id`（留痕进 history.rotations）。
 *
 * ── 触发时机（裁决，文档化于 docs/agent/context-instrumentation-survey.md）──────
 * **手动命令**，不自动挂进 ctx:usage / pre-commit：分析器保持纯读（字节稳定输出、
 * 桩自测不隐式改文件）；约定「每次 `pnpm run ctx:reads` 之后、`ctx:usage` 之前按需
 * 运行 `pnpm run ctx:rotate`」——空转零成本，溢出才落盘。
 *
 * USAGE
 *   node tools/scripts/rotate-reads-ledger.mjs                      # 默认窗口 20 会话
 *   node tools/scripts/rotate-reads-ledger.mjs --window-sessions=12
 *   node tools/scripts/rotate-reads-ledger.mjs --reason="…" --task-id="WXG-T-…"
 *   node tools/scripts/rotate-reads-ledger.mjs --dry-run            # 只打印计划，不落盘
 *
 * 退出码：0 成功（含空转）；1 数据/参数错误。
 * 轮转即改 `ctx/reads-ledger.jsonl` 与 `ctx/savings-history.json`，须随代码一并入库。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compareReadEvents, serializeReadEvent, toPosix, validateReadEvent } from './lib/reads-ledger.mjs';
import {
  HISTORY_REL,
  aggregateFromEvents,
  emptyHistory,
  mergeAggregate,
  readHistory,
} from './lib/savings-history.mjs';

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  printHelp();
  process.exit(0);
}
const args = parseArgs(argv);
const ROOT = normalize((args.root ?? gitRoot()).replace(/\/+$/, ''));
const LEDGER = args.ledger ?? join(ROOT, 'ctx', 'reads-ledger.jsonl');
const META = args.meta ?? LEDGER.replace(/\.jsonl$/, '.meta.json');
const HISTORY = args.history ?? join(ROOT, HISTORY_REL);
const DRY = argv.includes('--dry-run');

const windowSessions = Number(args['window-sessions'] ?? 20);
if (!Number.isInteger(windowSessions) || windowSessions < 1) {
  console.error(`❌ --window-sessions 需为 ≥1 的整数（收到：${args['window-sessions'] ?? '（缺省）'}）`);
  process.exit(1);
}

// ── 读入账本 ───────────────────────────────────────────────────────────────────
let ledgerText;
try {
  ledgerText = readFileSync(LEDGER, 'utf8');
} catch {
  console.error(`❌ 未找到账本 ${toPosix(LEDGER)} —— 先运行 pnpm run ctx:reads`);
  process.exit(1);
}
const rows = [];
let invalidRows = 0;
for (const line of ledgerText.split('\n')) {
  const s = line.trim();
  if (!s) continue;
  let e;
  try {
    e = JSON.parse(s);
  } catch {
    invalidRows += 1;
    continue;
  }
  if (validateReadEvent(e).length) {
    invalidRows += 1;
    continue;
  }
  rows.push(e);
}
if (invalidRows > 0) {
  console.error(`⚠️ 账本含 ${invalidRows} 行 schema 无效/畸形——轮转时丢弃（fail loud 计数，不静默）`);
}

// ── 读入历史（缺失 → 空结构）与侧车（缺失 → 全体 mtime=0，视为最旧）─────────────
const histRead = readHistory(HISTORY);
if (histRead.error) {
  console.error(`❌ ${toPosix(HISTORY)} 结构非法：`);
  for (const p of histRead.error) console.error(`  - ${p}`);
  console.error('   人工修复或删除该文件后重试（删除即放弃既有历史样本，慎用）。');
  process.exit(1);
}
const history = histRead.data ?? emptyHistoryFor(windowSessions);
const archivedRoots = new Set(history.archivedRootSessions ?? []);

let metaBySession = {};
try {
  metaBySession = JSON.parse(readFileSync(META, 'utf8'))?.bySession ?? {};
} catch {
  console.error(`⚠️ 未找到/无法解析侧车 ${toPosix(META)}——所有会话按最旧处理（mtime=0）`);
}

// ── 分树、定新近度、贪心保留 ───────────────────────────────────────────────────
const rootOf = (s) => s.split('/')[0];
const trees = new Map(); // root → {sessions:Set, rows:[]}
for (const e of rows) {
  const root = rootOf(e.session);
  if (!trees.has(root)) trees.set(root, { sessions: new Set(), rows: [] });
  const t = trees.get(root);
  t.sessions.add(e.session);
  t.rows.push(e);
}
const recencyOf = (root) => {
  let m = 0;
  for (const s of trees.get(root).sessions) m = Math.max(m, Number(metaBySession[s]?.lastMtime ?? 0) || 0);
  return m;
};
const orderedRoots = [...trees.keys()].sort((a, b) => recencyOf(b) - recencyOf(a) || (a < b ? -1 : a > b ? 1 : 0));

const keptRoots = [];
const rotateRoots = [];
let acc = 0;
for (const root of orderedRoots) {
  const n = trees.get(root).sessions.size;
  const isArchived = archivedRoots.has(root);
  // 已冻结根：无论新近度一律移出账本（样本已在历史中，不重复聚合）。
  if (isArchived || (acc > 0 && acc + n > windowSessions)) {
    rotateRoots.push(root);
    continue;
  }
  keptRoots.push(root);
  acc += n;
}

const frozenDrops = rotateRoots.filter((r) => archivedRoots.has(r));
const newlyRotatedRoots = rotateRoots.filter((r) => !archivedRoots.has(r));
const newlyRotatedRows = newlyRotatedRoots.flatMap((r) => trees.get(r).rows);
const keptRows = keptRoots.flatMap((r) => trees.get(r).rows).sort(compareReadEvents);
const frozenDropCount = frozenDrops.reduce((n, r) => n + trees.get(r).rows.length, 0);

// ── 报告计划 ───────────────────────────────────────────────────────────────────
const pct = (x) => `${(x * 100).toFixed(1)}%`;
console.log('读账本分窗轮转（ctx:rotate）— 窗口按会话计数，轮转原子单位 = 根会话树（WXG-T-037 R1）');
console.log(`  账本：${toPosix(LEDGER)}（${rows.length} 行${invalidRows ? `，schema 无效丢弃 ${invalidRows}` : ''}）｜历史：${toPosix(HISTORY)}`);
console.log(`  窗口预算：${windowSessions} 会话｜现存根会话树 ${trees.size} 棵 / 会话 ${new Set(rows.map((r) => r.session)).size} 个`);
for (const root of orderedRoots) {
  const t = trees.get(root);
  const mark = newlyRotatedRoots.includes(root) ? '→ 轮转（冻结入历史）' : frozenDrops.includes(root) ? '→ 移出（已冻结，不重复聚合）' : '✓ 保留';
  console.log(`    ${mark}｜树 ${root.slice(0, 8)}…｜会话 ${t.sessions.size}｜行 ${t.rows.length}｜mtime=${recencyOf(root) || '（无侧车记录）'}`);
}
console.log(
  `  计划：保留 ${keptRoots.length} 树 / ${acc} 会话 / ${keptRows.length} 行｜` +
    `轮转 ${newlyRotatedRoots.length} 树 / ${newlyRotatedRows.length} 行｜已冻结重采行移出 ${frozenDropCount} 行`,
);

if (newlyRotatedRows.length === 0 && frozenDropCount === 0) {
  console.log('✅ 窗口内会话未超预算且无已冻结重采行——空转，不落盘（幂等）。');
  process.exit(0);
}

if (newlyRotatedRows.length > 0) {
  const reason = args.reason;
  const taskId = args['task-id'];
  if (!reason || !taskId) {
    console.error('❌ 本次将真实轮转会话——须同时提供 --reason="…" 与 --task-id="WXG-T-…"（留痕进 savings-history.json rotations）');
    process.exit(1);
  }
  history.rotations = [
    ...(history.rotations ?? []),
    { reason, taskId, events: newlyRotatedRows.length, archivedRootSessions: [...newlyRotatedRoots].sort() },
  ];
}

// ── 聚合增量并冻结 ─────────────────────────────────────────────────────────────
if (newlyRotatedRows.length > 0) {
  const fileTextOf = new Map();
  const textOf = (p) => {
    if (!fileTextOf.has(p)) {
      let t = null;
      try {
        t = readFileSync(join(ROOT, p), 'utf8');
      } catch {
        t = null;
      }
      fileTextOf.set(p, t);
    }
    return fileTextOf.get(p);
  };
  const delta = aggregateFromEvents(newlyRotatedRows, textOf);
  history.aggregate = mergeAggregate(history.aggregate, delta);
  for (const root of newlyRotatedRoots) {
    archivedRoots.add(root);
    for (const s of trees.get(root).sessions) {
      const ide = trees.get(root).rows[0]?.ide ?? null;
      history.archivedSessions[s] = {
        ide,
        events: trees.get(root).rows.filter((e) => e.session === s).length,
      };
    }
  }
  history.archivedRootSessions = [...archivedRoots].sort();
  console.log(
    `  冻结聚合增量：读事件 ${delta.totalReads}｜节省样本 ${delta.savingsSamples}（partial ${delta.partialSavings.length}）｜` +
      `抖动 ${delta.jitterGroups} 组 / 超限 ${delta.jitterExcess} 次 / 组键 ${delta.jitterGroupKeys}｜大文件整读 ${delta.bigFullReads}`,
  );
  console.log(
    `  累计历史：读事件 ${history.aggregate.totalReads}｜会话 ${history.aggregate.sessions}｜` +
      `partial 样本 ${history.aggregate.partialSavings.length}`,
  );
}

if (DRY) {
  console.log('（--dry-run：以上为计划，未落盘）');
  process.exit(0);
}

// ── 落盘（账本稳定排序 → 字节稳定；history 固定键序，均无时间戳）────────────────
history.windowSessions = windowSessions;
history.est = true;
mkdirSync(dirname(LEDGER), { recursive: true });
mkdirSync(dirname(HISTORY), { recursive: true });
writeFileSync(LEDGER, `${keptRows.map(serializeReadEvent).join('\n')}${keptRows.length ? '\n' : ''}`, 'utf8');
writeFileSync(HISTORY, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
console.log(`✅ 轮转完成：账本 ${rows.length} → ${keptRows.length} 行；历史 → ${toPosix(HISTORY)}`);
console.log('   提醒：E1/E3 判定口径 = 累计（窗口 + 历史）；请随后运行 pnpm run ctx:usage && pnpm run ctx:check 复核。');

// ─────────────────────────────────────────────────────────────────── helpers ──

function emptyHistoryFor(windowSessions) {
  // 局部 require 风格：直接内联空结构（与 lib emptyHistory 一致，避免多一次 import 别名）。
  return {
    version: 1,
    windowSessions,
    est: true,
    note: '读账本分窗轮转的历史聚合（WXG-T-037 R1）。',
    archivedRootSessions: [],
    archivedSessions: {},
    aggregate: {
      totalReads: 0,
      sessions: 0,
      savingsSamples: 0,
      sumActual: 0,
      sumFull: 0,
      allSavings: [],
      partialSavings: [],
      jitterGroupKeys: 0,
      jitterGroups: 0,
      jitterExcess: 0,
      bigFullReads: 0,
    },
    rotations: [],
  };
}

function gitRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : process.cwd();
}

function parseArgs(list) {
  const out = {};
  for (const a of list) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) continue;
    const [, k, v] = m;
    out[k] = v === undefined ? true : v;
  }
  return out;
}

function printHelp() {
  console.log(`读账本分窗轮转器（WXG-T-037 R1）

用法：
  node tools/scripts/rotate-reads-ledger.mjs [选项]

选项：
  --window-sessions=<N>   窗口预算（按会话计数，含子代理；默认 20）
  --ledger=<path>         账本（默认 ctx/reads-ledger.jsonl）
  --meta=<path>           采集侧车（默认账本同名 .meta.json；提供 bySession[s].lastMtime 新近度）
  --history=<path>        历史聚合（默认 ctx/savings-history.json）
  --reason="…"            真实轮转时必填（留痕）
  --task-id="WXG-T-…"     真实轮转时必填（留痕）
  --dry-run               只打印计划，不落盘

口径：
  • 窗口预算按**会话**计数；轮转原子单位 = **根会话树**（整树同进同出，不截断会话）。
  • 新近度 = 侧车 bySession[s].lastMtime（转录 mtime，采集器写入）；缺失 → 最旧。
  • 轮转出的会话冻结进 savings-history.json（原始节省率样本数组 + 计数聚合），
    其根 id 进 archivedRootSessions 注册表：重复运行 / 重采后再次运行不重复聚合（幂等）。
  • E1/E3 判定口径 = 累计（当前窗口 + 历史），见 analyze-context-usage.mjs metrics.cumulative。

触发时机（裁决）：**手动命令**。约定每次 pnpm run ctx:reads 之后、ctx:usage 之前按需运行；
窗口未超预算时空转零成本。token 一律为**估算**值。`);
}
