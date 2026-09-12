#!/usr/bin/env node
/**
 * collect-context-reads.mjs — 读入账本采集器（WXG-T-026 ①）。
 *
 * 从本机 IDE 会话转录解析「读文件」事件（路径 + 行区间），落成可入库、可离线
 * 复算的 JSONL 账本 `ctx/reads-ledger.jsonl`。**只读**转录，不修改任何 IDE
 * 配置或数据；**只记元数据**（path/offset/limit/行数/字节/估算 token），绝不落正文；
 * 仓库外路径默认丢弃并计数。emits 一份无时间戳的统计侧车 `ctx/reads-ledger.meta.json`
 * 供分析器复用「丢弃 / 未识别」等采集期计数（口径透明，见 --help）。
 *
 * USAGE
 *   node tools/scripts/collect-context-reads.mjs                       # 采集 Cursor+WorkBuddy
 *   node tools/scripts/collect-context-reads.mjs --source=cursor       # 只采某一家
 *   node tools/scripts/collect-context-reads.mjs --slug=<name>         # 覆盖自动发现的 slug
 *   node tools/scripts/collect-context-reads.mjs --since=2026-09-01    # 文件级粗过滤（按 mtime）
 *   node tools/scripts/collect-context-reads.mjs --strict              # 未识别率 >5% 或 0 事件 → exit 1
 *   node tools/scripts/collect-context-reads.mjs --sidecar-only        # 不重采：仅重算侧车字段（F-03）
 *
 * 退出码：0 成功；1 --strict 触发（fail loud）。
 * 所有 token 数字均为**估算**（见 lib/context-tokens.mjs），非精确 tokenizer 结果。
 */

import { createReadStream, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { createInterface } from 'node:readline';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import {
  IDES,
  LEDGER_VERSION,
  classifyLine,
  compareReadEvents,
  createFileCache,
  dedupeKey,
  discoverSlug,
  makeReadEvent,
  normalizePath,
  rangeStats,
  serializeReadEvent,
  toPosix,
} from './lib/reads-ledger.mjs';

/** ── CLI 解析 ──────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  printHelp();
  process.exit(0);
}
const args = parseArgs(argv);

const SOURCE = args.source ?? 'all';
// 归一化仓库根（折叠 `//`、去掉尾斜杠）——否则与 path.join 归一化后的读取路径前缀不匹配。
const ROOT = normalize((args.root ?? gitRoot()).replace(/\/+$/, ''));
const OUT = args.out ?? join(ROOT, 'ctx', 'reads-ledger.jsonl');
const META_OUT = OUT.replace(/\.jsonl$/, '.meta.json');
const STRICT = args.strict === true;
const SINCE = args.since ? Date.parse(`${args.since}T00:00:00`) : null;
const CURSOR_HOME = process.env.WXG_CURSOR_HOME ?? join(homedir(), '.cursor');
const WORKBUDDY_HOME = process.env.WXG_WORKBUDDY_HOME ?? join(homedir(), '.workbuddy');
const SIDECAR_ONLY = argv.includes('--sidecar-only');

/**
 * 会话口径说明（F-03，WXG-T-026 复验补）——写进侧车供分析器与人复核。
 * 「有读事件」vs「账本保留行」是两个不同口径，差值 = 读路径全在仓库外被丢弃的会话数。
 */
const SESSION_COUNT_NOTE =
  '会话口径二义（WXG-T-026 复验 F-03）：sessionsWithReadEvents = 采集期识别到 ≥1 次读调用的会话' +
  '（含读路径全在仓库外、丢弃后 0 行入账者）；sessionsInLedger = 去重后账本仍留有读事件的会话。' +
  '两者定义不同，差值 = 读全被丢弃的会话数。';

if (!IDES.includes(SOURCE) && SOURCE !== 'all') {
  console.error(`❌ --source 只能是 ${IDES.join(' | ')} | all（收到：${SOURCE}）`);
  process.exit(2);
}
if (SINCE !== null && Number.isNaN(SINCE)) {
  console.error(`❌ --since 需为 YYYY-MM-DD（收到：${args.since}）`);
  process.exit(2);
}

// --sidecar-only：**不重采**（避免活动会话边写边采导致样本漂移，F-02），只从「现有账本 +
// 现有侧车」重算侧车字段（会话口径等）。供既有账本在不改动的前提下补齐新 schema 字段。
if (SIDECAR_ONLY) runSidecarOnly();

/** ── 统计口径 ──────────────────────────────────────────────────────────── */
const stats = {
  files: 0,
  skippedBySince: 0,
  records: 0,
  malformed: 0,
  unrecognizedRecords: 0,
  badReads: 0,
  readEvents: 0,
  dropped: 0,
  stale: 0,
  byIde: {},
  bySession: {},
};
const ideSessions = new Map(); // ide → Set<session>
const droppedReasons = new Map();
const events = new Map(); // dedupeKey → event
const fileCache = createFileCache();

/** ── 采集 ──────────────────────────────────────────────────────────────── */
const targets = [];
if (SOURCE === 'cursor' || SOURCE === 'all') {
  const slug = resolveSlug(join(CURSOR_HOME, 'projects'));
  if (slug) targets.push({ ide: 'cursor', slug, dir: join(CURSOR_HOME, 'projects', slug, 'agent-transcripts') });
  else console.error('⚠️ 未找到 Cursor 项目 slug（wechatgame），跳过 Cursor');
}
if (SOURCE === 'workbuddy' || SOURCE === 'all') {
  const slug = resolveSlug(join(WORKBUDDY_HOME, 'projects'));
  if (slug) targets.push({ ide: 'workbuddy', slug, dir: join(WORKBUDDY_HOME, 'projects', slug) });
  else console.error('⚠️ 未找到 WorkBuddy 项目 slug（wechatgame），跳过 WorkBuddy');
}

if (targets.length === 0) {
  console.error('❌ 没有可采集的数据源（检查本机转录或 --source / --slug）');
  process.exit(1);
}

for (const t of targets) {
  for (const file of walkJsonl(t.dir)) {
    if (SINCE !== null) {
      let mt = 0;
      try {
        mt = statSync(file).mtimeMs;
      } catch {
        mt = 0;
      }
      if (mt < SINCE) {
        stats.skippedBySince += 1;
        continue;
      }
    }
    stats.files += 1;
    await ingestFile(file, t);
  }
}

/** ── 落盘（稳定排序 → 字节稳定）───────────────────────────────────────── */
const rows = [...events.values()].sort(compareReadEvents);
const body = rows.length ? `${rows.map(serializeReadEvent).join('\n')}\n` : '';
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, body, 'utf8');

const totalForRate = stats.records;
const unrecognized = stats.malformed + stats.unrecognizedRecords + stats.badReads;
const recognitionRate = totalForRate > 0 ? 1 - unrecognized / totalForRate : 1;
const meta = {
  version: LEDGER_VERSION,
  source: SOURCE,
  root: toPosix(ROOT),
  files: stats.files,
  records: stats.records,
  readEvents: stats.readEvents,
  uniqueReads: rows.length,
  malformed: stats.malformed,
  unrecognizedRecords: stats.unrecognizedRecords,
  badReads: stats.badReads,
  unrecognized,
  recognitionRate: Number(recognitionRate.toFixed(6)),
  dropped: stats.dropped,
  stale: stats.stale,
  byIde: summarizeByIde(),
  bySession: sortedObj(stats.bySession),
  // 会话口径（F-03，WXG-T-026 复验补）：两个定义显式并列 + 说明，消除「21 vs 20」二义。
  sessionsWithReadEvents: sumByIdeSessions(summarizeByIde()),
  sessionsInLedger: new Set(rows.map((r) => r.session)).size,
  sessionCountNote: SESSION_COUNT_NOTE,
};
writeFileSync(META_OUT, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

/** ── 报告（stdout，中文）────────────────────────────────────────────────── */
const pct = (r) => `${(r * 100).toFixed(2)}%`;
console.log('读入账本采集（ctx:reads）— 全部为**估算** token（CJK≈1/字、ASCII≈1/4 字符）');
console.log(`  数据源：${SOURCE}｜仓库根：${toPosix(ROOT)}`);
console.log(`  扫描转录文件数：${stats.files}${stats.skippedBySince ? `（--since 跳过 ${stats.skippedBySince}）` : ''}`);
console.log(`  记录总数：${stats.records}`);
console.log(`  识别读事件数：${stats.readEvents}`);
console.log(`  去重后账本行数：${rows.length}（去重键 ide/session/path/offset/limit）`);
console.log(`  未识别记录数：${unrecognized}（畸形行 ${stats.malformed} + 未识别信封 ${stats.unrecognizedRecords} + 读调用缺路径 ${stats.badReads}）`);
console.log(`  识别率：${pct(recognitionRate)}`);
console.log(`  丢弃的仓库外路径数：${stats.dropped}`);
console.log(`  stale（仓库内文件已不存在）：${stats.stale}`);
console.log(`  账本：${toPosix(OUT)}`);
console.log(`  侧车：${toPosix(META_OUT)}`);
console.log('');
console.log('  按 IDE 分布：');
for (const [ide, v] of Object.entries(meta.byIde)) {
  console.log(`    ${ide}: 会话 ${v.sessions}｜读事件 ${v.reads}｜去重 ${v.unique}`);
}
console.log('  按会话分布：');
for (const [s, v] of Object.entries(meta.bySession)) {
  console.log(`    ${s}: 读事件 ${v.reads}｜去重 ${v.unique}`);
}
if (droppedReasons.size) {
  console.log('');
  console.log('  丢弃原因明细（仓库外路径）：');
  for (const [reason, n] of [...droppedReasons.entries()].sort()) console.log(`    ${reason}: ${n}`);
}

if (STRICT) {
  const failReasons = [];
  if (stats.readEvents === 0) failReasons.push('识别读事件为 0');
  if (recognitionRate < 0.95) failReasons.push(`未识别率 ${pct(1 - recognitionRate)} > 5%`);
  if (failReasons.length) {
    console.error('');
    console.error(`❌ ctx:reads --strict FAILED：${failReasons.join('；')}`);
    process.exit(1);
  }
  console.log('');
  console.log('✅ ctx:reads --strict OK（有样本且未识别率 ≤ 5%）');
}

// ─────────────────────────────────────────────────────────── ingestion ─────────

async function ingestFile(file, target) {
  const session = toPosix(file).slice(toPosix(target.dir).length).replace(/^\/+/, '').replace(/\.jsonl$/, '');
  const rl = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || !line.trim()) continue;
    stats.records += 1;
    const res = classifyLine(target.ide, line);
    if (res.kind === 'malformed') {
      stats.malformed += 1;
      continue;
    }
    if (res.kind === 'unrecognized') {
      stats.unrecognizedRecords += 1;
      continue;
    }
    if (res.kind !== 'read') continue;
    stats.badReads += res.badReads;
    if (!ideSessions.has(target.ide)) ideSessions.set(target.ide, new Set());
    ideSessions.get(target.ide).add(session);
    for (const r of res.reads) {
      stats.readEvents += 1;
      bump(stats.bySession, session, 'reads');
      bump(stats.byIde, target.ide, 'reads');
      const norm = normalizePath(r.rawPath, { root: ROOT, cwd: ROOT });
      if (!norm.ok) {
        stats.dropped += 1;
        droppedReasons.set(norm.reason, (droppedReasons.get(norm.reason) ?? 0) + 1);
        continue;
      }
      const st = rangeStats(norm.rel, { offset: r.offset, limit: r.limit, root: ROOT, cache: fileCache });
      if (st.stale) stats.stale += 1;
      const ev = makeReadEvent({ ide: target.ide, session, path: norm.rel, offset: r.offset, limit: r.limit, stats: st });
      const key = dedupeKey(ev);
      if (events.has(key)) continue;
      events.set(key, ev);
      bump(stats.byIde, target.ide, 'unique');
      bump(stats.bySession, session, 'unique');
    }
  }
}

// ───────────────────────────────────────────────────────────── helpers ─────────

function bump(obj, key, field) {
  if (!obj[key]) obj[key] = { reads: 0, unique: 0 };
  obj[key][field] = (obj[key][field] ?? 0) + 1;
}

function summarizeByIde() {
  const out = {};
  for (const ide of Object.keys(stats.byIde).sort()) {
    out[ide] = {
      sessions: ideSessions.get(ide)?.size ?? 0,
      reads: stats.byIde[ide].reads ?? 0,
      unique: stats.byIde[ide].unique ?? 0,
    };
  }
  return out;
}

function sortedObj(obj) {
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

/** 采集期「有读事件」的会话总数 = Σ byIde[*].sessions。 */
function sumByIdeSessions(byIde) {
  return Object.values(byIde ?? {}).reduce((n, v) => n + (v?.sessions ?? 0), 0);
}

function readJsonSafe(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * --sidecar-only：从「现有账本 + 现有侧车」重算侧车字段（会话口径等），
 * **不扫描转录、不改动账本**。用途：既有账本已冻结（如含活动会话、重采即漂移）时，
 * 在不破坏样本的前提下补齐新 schema 字段。
 */
function runSidecarOnly() {
  let ledgerText;
  try {
    ledgerText = readFileSync(OUT, 'utf8');
  } catch {
    console.error(`❌ --sidecar-only 需要现有账本 ${toPosix(OUT)} —— 先正常跑一次 ctx:reads`);
    process.exit(1);
  }
  const sessionSet = new Set();
  let rowCount = 0;
  for (const line of ledgerText.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    rowCount += 1;
    try {
      sessionSet.add(JSON.parse(s).session);
    } catch {
      /* 畸形行不参与口径统计 */
    }
  }
  const base = readJsonSafe(META_OUT);
  if (!base) {
    console.error(`❌ --sidecar-only 需要现有侧车 ${toPosix(META_OUT)}（缺采集期计数，无法凭空重建）`);
    process.exit(1);
  }
  base.uniqueReads = rowCount;
  base.sessionsWithReadEvents = sumByIdeSessions(base.byIde);
  base.sessionsInLedger = sessionSet.size;
  base.sessionCountNote = SESSION_COUNT_NOTE;
  mkdirSync(dirname(META_OUT), { recursive: true });
  writeFileSync(META_OUT, `${JSON.stringify(base, null, 2)}\n`, 'utf8');
  console.log('侧车重算（--sidecar-only，未改动账本、未扫描转录）');
  console.log(`  账本：${toPosix(OUT)}（${rowCount} 行）`);
  console.log(`  会话口径（F-03）：有读事件 ${base.sessionsWithReadEvents}｜账本保留行 ${base.sessionsInLedger}`);
  console.log(`  侧车：${toPosix(META_OUT)}`);
  process.exit(0);
}

function walkJsonl(dir) {
  const out = [];
  (function step(d) {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) step(full);
      else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
    }
  })(dir);
  return out.sort();
}

function resolveSlug(projectsDir) {
  if (args.slug) return args.slug;
  let names = [];
  try {
    names = readdirSync(projectsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return null;
  }
  return discoverSlug(names, ROOT);
}

function gitRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  return process.cwd();
}

function parseArgs(list) {
  const out = { strict: false };
  for (const a of list) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'strict') out.strict = true;
    else out[k] = v;
  }
  return out;
}

function printHelp() {
  console.log(`读入账本采集器（WXG-T-026 ①）

用法：
  node tools/scripts/collect-context-reads.mjs [选项]

选项：
  --source=cursor|workbuddy|all   数据源（默认 all）
  --root=<repo>                   仓库根（默认自动探测 git 根）
  --slug=<name>                   项目 slug（默认按仓库路径自动发现 wechatgame）
  --since=<YYYY-MM-DD>            仅采 mtime 不早于该日的转录（文件级粗过滤）
  --out=<path>                    账本输出（默认 ctx/reads-ledger.jsonl）
  --strict                        未识别率 >5% 或读事件为 0 → exit 1（fail loud）
  --sidecar-only                  不扫描转录：仅从现有账本 + 现有侧车重算侧车字段（不改账本）

数据源（只读本机转录，不改任何 IDE 配置）：
  • Cursor     <~/.cursor>/projects/<slug>/agent-transcripts/**/*.jsonl
  • WorkBuddy  <~/.workbuddy>/projects/<slug>/**/*.jsonl
  可用环境变量 WXG_CURSOR_HOME / WXG_WORKBUDDY_HOME 覆盖根目录（供桩测试）。

未纳入本单的 IDE：
  • Qoder      转录无工具级（path/offset）细节，无法归属到章节 → 不采集。
  • CodeBuddy  无 agent 转录文件可解析 → 不采集。

产出：可入库账本 ctx/reads-ledger.jsonl（仅元数据，无正文、无时间戳）+
     无时间戳统计侧车 ctx/reads-ledger.meta.json。token 一律为**估算**值。`);
}
