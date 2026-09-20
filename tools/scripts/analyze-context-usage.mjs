#!/usr/bin/env node
/**
 * analyze-context-usage.mjs — 真实使用分布分析器（WXG-T-026 ②）。
 *
 * 输入：读入账本 `ctx/reads-ledger.jsonl` + 章节索引 `ctx/index.json`
 *      （+ 采集侧车 `ctx/reads-ledger.meta.json`，缺失时「丢弃/未识别」记为 0）。
 * 输出：
 *   • `ctx/usage-distribution.json` — 入库、字节稳定、无时间戳、键序固定。
 *   • `ctx/reads-summary.md`        — 人读报告（可含日期）。
 *
 * 行区间归属：读取区间与 `sections[].startLine/endLine` 求交即归属该节；
 * 整文件读 → 归属该文件全部章节（分别计一次）。
 *
 * 所有 token 数字均为**估算**（见 lib/context-tokens.mjs），非精确 tokenizer 结果。
 *
 * USAGE
 *   node tools/scripts/analyze-context-usage.mjs            # 产出两文件
 *   node tools/scripts/analyze-context-usage.mjs --strict    # 无样本（0 读数）→ exit 1
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { spawnSync } from 'node:child_process';
import { estimateTokens } from './lib/context-tokens.mjs';
import { IMPLICIT_FULL_LINE_RATIO, classifyRead, countLines, createFileCache, toPosix, validateReadEvent } from './lib/reads-ledger.mjs';
// WXG-T-037 R1：阈值常量 / 分位数 / 单事件样本口径 / 累计口径上移 lib/savings-history.mjs 统一出处。
import {
  BIG_FILE_TOKENS,
  JITTER_THRESHOLD,
  SMALL_READ_LINES,
  cumulativeMetrics,
  percentileSorted as percentile,
  readHistory,
  savingsSampleOf,
} from './lib/savings-history.mjs';

/**
 * 「进行中（活动）会话」声明（F-01，WXG-T-026 复验补）。
 *
 * 账本为**字节稳定、无时间戳**（见 lib/reads-ledger.mjs），无法从数据推算某会话在
 * 采集时刻是否仍在写入；故由本机采集者**显式声明**，用于 reads-summary.md
 * 「样本代表性边界」段如实标注「边写边采 → 样本非平稳、重跑即漂移」。
 * 匹配方式：以 session id **前缀**比较（根会话 id）；更新须同批写明来源。
 */
const KNOWN_ACTIVE_SESSIONS = [
  // WorkBuddy 根会话：2026-09-12 采集时仍在写入（边写边采）。
  'd2983589-5929-4ae7-8766-93377384382e',
];

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  printHelp();
  process.exit(0);
}
const args = parseArgs(argv);
const ROOT = normalize((args.root ?? gitRoot()).replace(/\/+$/, ''));
const LEDGER = args.ledger ?? join(ROOT, 'ctx', 'reads-ledger.jsonl');
const INDEX = args.index ?? join(ROOT, 'ctx', 'index.json');
const OUT_JSON = args['out-json'] ?? join(ROOT, 'ctx', 'usage-distribution.json');
const OUT_MD = args['out-md'] ?? join(ROOT, 'ctx', 'reads-summary.md');
/** 历史聚合（WXG-T-037 R1）：窗口外样本的冻结聚合；存在时输出 metrics.cumulative（累计口径）。 */
const HISTORY = args.history ?? join(ROOT, 'ctx', 'savings-history.json');
const META = LEDGER.replace(/\.jsonl$/, '.meta.json');
const STRICT = args.strict === true;

// ── 读入 ────────────────────────────────────────────────────────────────
const ledgerText = safeRead(LEDGER);
if (ledgerText == null) {
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

const index = safeJson(INDEX);
if (!index) {
  console.error(`❌ 未找到/无法解析章节索引 ${toPosix(INDEX)} —— 先运行 pnpm run ctx:build`);
  process.exit(1);
}
const indexByPath = new Map((index.files ?? []).map((f) => [f.path, f]));

const meta = safeJson(META) ?? {};
const dropped = Number.isFinite(meta.dropped) ? meta.dropped : 0;
const unrecognized = Number.isFinite(meta.unrecognized) ? meta.unrecognized : 0;

if (STRICT && rows.length === 0) {
  console.error('❌ ctx:usage --strict FAILED：账本中无样本（0 条读事件）');
  process.exit(1);
}

// ── 分析 ────────────────────────────────────────────────────────────────
const fileCache = createFileCache();
const fileTextOf = new Map(); // path → string|null（整文件文本，每文件只读一次）
function fileText(path) {
  if (fileTextOf.has(path)) return fileTextOf.get(path);
  let t = null;
  try {
    t = readFileSync(join(ROOT, path), 'utf8');
  } catch {
    t = null;
  }
  fileTextOf.set(path, t);
  return t;
}
const fullTokensOf = new Map(); // path → number|null
function fullTokens(path) {
  if (fullTokensOf.has(path)) return fullTokensOf.get(path);
  const t = fileText(path);
  const v = t == null ? null : estimateTokens(t);
  fullTokensOf.set(path, v);
  return v;
}
/** 全文行数——判「实质整读」（classifyRead）所需（WXG-T-036）。 */
const fullLinesOf = new Map(); // path → number|null
function fullLines(path) {
  if (fullLinesOf.has(path)) return fullLinesOf.get(path);
  const t = fileText(path);
  const v = t == null ? null : countLines(t);
  fullLinesOf.set(path, v);
  return v;
}

const sessions = new Set();
const sessionIde = new Map(); // session → ide（用于「会话树」归属）
const ideReads = {};
const sessionReads = {};
const sectionAgg = new Map(); // path → { anchor → {reads, estTokens, startLine} }
const jitter = new Map(); // session\u0000path → smallReads
const bigFullReads = [];
const ratios = []; // {ratio, label}
const ratiosPartial = []; // 严格：仅 classifyRead==='partial'（E1 判定依据，WXG-T-036 起）
const ratiosPartialLoose = []; // 宽松：历史 `!fullFile` 口径——仅供双列对照与追溯
const ratiosImplicitFull = [];
let sumActual = 0;
let sumFull = 0;
let fullFileReads = 0;
let implicitFullReads = 0;
let nonFullReads = 0;
let exactHits = 0;
let containedHits = 0;
let unattributed = 0;
let staleRows = 0;
let savingsRows = 0;

for (const e of rows) {
  sessions.add(e.session);
  sessionIde.set(e.session, e.ide);
  ideReads[e.ide] = (ideReads[e.ide] ?? 0) + 1;
  sessionReads[e.session] = (sessionReads[e.session] ?? 0) + 1;

  const ftok = fullTokens(e.path);
  if (ftok == null) staleRows += 1;

  // WXG-T-036 口径精修：`fullFile` 标志位不足以判「整读」——「给了 limit 无 offset、
  // 读满全文」的读取会被记为 fullFile:false 而混进 E1 样本（判据原文为「仅锚点式
  // 局部读」）。全流程统一改由 classifyRead 三分法判定，避免同一读事件在不同指标里
  // 被归到不同类别。
  const kind = classifyRead(e, fullLines(e.path));
  const isFull = kind !== 'partial';

  // ② 真实读入 vs 全文（估算）——单事件样本口径由 lib/savings-history.mjs 统一出处
  // （WXG-T-037 起：轮转器聚合同用 savingsSampleOf，保证窗口/历史两处逐位一致）。
  const smp = savingsSampleOf(e, ftok, fullLines(e.path));
  if (smp) {
    const ratio = smp.ratio;
    sumActual += e.estTokens;
    sumFull += ftok;
    savingsRows += 1;
    const rec = { ratio, label: labelFor(e, indexByPath, kind), path: e.path, actual: e.estTokens, full: ftok };
    ratios.push(rec);
    if (kind === 'partial') ratiosPartial.push(rec);
    else if (kind === 'implicitFull') ratiosImplicitFull.push(rec);
    if (!e.fullFile) ratiosPartialLoose.push(rec);
  }

  // ③ / 归属
  const idxFile = indexByPath.get(e.path);
  const start = isFull ? 1 : Math.max(1, e.offset ?? 1);
  const end = isFull ? (e.lines ?? start) + start - 1 : start + Math.max(1, e.lines ?? 1) - 1;
  if (kind === 'full') fullFileReads += 1;
  else if (kind === 'implicitFull') implicitFullReads += 1;
  else nonFullReads += 1;

  if (!idxFile) {
    unattributed += 1;
  } else {
    const sections = idxFile.sections ?? [];
    if (kind === 'partial') {
      if (sections.find((s) => s.startLine === start && s.endLine === end)) exactHits += 1;
      // 「精确落在某章节行区间」取**包含**语义：读取区间完整落在单一 sections 区间内。
      if (sections.find((s) => s.startLine <= start && end <= s.endLine)) containedHits += 1;
    }
    for (const s of sections) {
      const overlaps = isFull || (Math.max(start, s.startLine) <= Math.min(end, s.endLine));
      if (!overlaps) continue;
      let bucket = sectionAgg.get(e.path);
      if (!bucket) {
        bucket = new Map();
        sectionAgg.set(e.path, bucket);
      }
      const rec = bucket.get(s.anchor) ?? { anchor: s.anchor, reads: 0, estTokens: 0, startLine: s.startLine, tokens: s.tokens ?? 0 };
      rec.reads += 1;
      rec.estTokens += s.tokens ?? 0;
      bucket.set(s.anchor, rec);
    }
  }

  // ④① 抖动（小读抖动）——整读不算「小读」，故同样按 partial 判定
  if (kind === 'partial' && e.lines != null && e.lines <= SMALL_READ_LINES) {
    const k = `${e.session}\u0000${e.path}`;
    jitter.set(k, (jitter.get(k) ?? 0) + 1);
  }
  // ④② 大文件整文件读（含实质整读）
  if (isFull && ftok != null && ftok >= BIG_FILE_TOKENS) {
    bigFullReads.push({ path: e.path, tokens: ftok, session: e.session });
  }
}

let jitterGroups = 0;
let jitterExcess = 0;
for (const n of jitter.values()) {
  if (n > JITTER_THRESHOLD) {
    jitterGroups += 1;
    jitterExcess += n - JITTER_THRESHOLD;
  }
}

// ── 比率类指标（F-02，WXG-T-026 复验补）─────────────────────────────────────
// 基线冻结的是**含活动会话的快照**，重采（ctx:reads）会使抖动/大文件**计数自然增长**；
// 以计数判定 → 误报「真实回归 FAIL」。改为**比率**（分子/分母随样本同步增长，近似平稳）：
//   • 抖动率        = 抖动组数 ÷ 不同 (session,path) 小读组数
//   • 大文件整文件读率 = 大文件整文件读次数 ÷ 总读次数
// 原始计数仍如实展示（仅供人看与追溯），不再作为判定依据。
const jitterGroupKeys = jitter.size; // 不同 (session,path) 组数（有 ≥1 次小读者）
const jitterRate = jitterGroupKeys > 0 ? jitterGroups / jitterGroupKeys : 0;
const bigFullReadRate = rows.length > 0 ? bigFullReads.length / rows.length : 0;

// ── 会话树结构（F-01）：根会话 + 子代理，用于「样本代表性边界」段 ─────────────
// 会话 id 形态（本机实测）：Cursor 根 `<uuid>/<uuid>`、子代理 `<uuid>/subagents/<id>`；
// WorkBuddy 根 `<uuid>`、子代理 `<uuid>/subagents/<agent-id>`。故**根会话 = id 的首段**
// （首个 `/` 之前），子代理 = id 含 `/subagents/`。这样同一根会话树的读事件归并到一条根。
const rootOf = (s) => s.split('/')[0];
const lineageReads = new Map(); // rootId → reads（含其子代理）
const lineageIde = new Map(); // rootId → ide
const subagentSessions = [];
for (const s of sessions) {
  const root = rootOf(s);
  lineageReads.set(root, (lineageReads.get(root) ?? 0) + (sessionReads[s] ?? 0));
  if (!lineageIde.has(root) && sessionIde.has(s)) lineageIde.set(root, sessionIde.get(s));
  if (s.includes('/subagents/')) subagentSessions.push(s);
}
const lineages = [...lineageReads.keys()]
  .map((root) => ({
    root,
    ide: lineageIde.get(root) ?? '—',
    reads: lineageReads.get(root) ?? 0,
    share: rows.length ? (lineageReads.get(root) ?? 0) / rows.length : 0,
  }))
  .sort((a, b) => b.reads - a.reads || a.root.localeCompare(b.root));
const activeSessions = lineages.filter((l) => KNOWN_ACTIVE_SESSIONS.some((p) => l.root.startsWith(p)));

const savingsValues = ratios.map((r) => 1 - r.ratio).sort((a, b) => a - b);
const savingsPartial = ratiosPartial.map((r) => 1 - r.ratio).sort((a, b) => a - b);
const savingsPartialLoose = ratiosPartialLoose.map((r) => 1 - r.ratio).sort((a, b) => a - b);
const median = percentile(savingsValues, 0.5);
const p10 = percentile(savingsValues, 0.1);
// ── E1 双列（WXG-T-036）─────────────────────────────────────────────────────
// 严格口径 = **判定依据**：仅 classifyRead==='partial'（真正的锚点式局部读）。
const medianPartial = percentile(savingsPartial, 0.5);
const p10Partial = percentile(savingsPartial, 0.1);
// 宽松口径 = 历史（WXG-T-026–035）的 `!fullFile`：含「无 offset 却读满全文」者。
// 保留仅用于**双列如实对照**——修正口径属零和：E1 变好，整读占比同时变差。
const medianPartialLoose = percentile(savingsPartialLoose, 0.5);
const p10PartialLoose = percentile(savingsPartialLoose, 0.1);
const overallRatio = sumFull > 0 ? sumActual / sumFull : 1;
const overallSavings = 1 - overallRatio;

// ── ③ 锚点直达率 双列（WXG-T-036）──────────────────────────────────────────
const fullFileRateLoose = rows.length > 0 ? fullFileReads / rows.length : 0;
const fullReadsEffective = fullFileReads + implicitFullReads;
const fullFileRateEffective = rows.length > 0 ? fullReadsEffective / rows.length : 0;
const implicitFullTokens = ratiosImplicitFull.reduce((n, r) => n + r.actual, 0);

// ── 净收益口径（WXG-T-036）────────────────────────────────────────────────
// 「装置」= 为少读而必须**额外读**的东西，分两类，**归因含义完全不同**：
//   • protocolArtifacts（`ctx/`）—— 路由/速查/报告等**被读才生效**的产物。
//     只有它们被读，才谈得上「装置起了作用」→ `attributable` 只看这一类。
//   • deviceCode（`tools/scripts/`）—— 装置**自身的源码**。读它是开发/维护开销，
//     与「省了多少读」无因果关系，**不得**用于证明装置有效。
// 毛节省率（metrics.savings.overall）**不扣**这两类开销，故给出两列：
//   • measured：账本中**实际发生**的装置读事件量。毛数已在 sumActual 内含装置开销，
//     故净额 === 毛节省率；但若 protocolArtifacts 读事件为 0 → `attributable:false`，
//     意味着毛节省**不可归因于装置**（节省来自会话固有行为）。
//   • protocol：按 ROUTES.md §0 协议**应然**每会话读一次 ROUTES + hot-files 的开销，
//     给出「装置真被用起来」时的**保守下界**（假设装置不改变读行为）。
const DEVICE_PREFIXES = ['ctx/', 'tools/scripts/'];
const PROTOCOL_ARTIFACT_PREFIX = 'ctx/';
const DEVICE_CODE_PREFIX = 'tools/scripts/';
const deviceReadEvents = rows.filter((e) => DEVICE_PREFIXES.some((p) => e.path.startsWith(p)));
const artifactReadEvents = deviceReadEvents.filter((e) => e.path.startsWith(PROTOCOL_ARTIFACT_PREFIX));
const codeReadEvents = deviceReadEvents.filter((e) => e.path.startsWith(DEVICE_CODE_PREFIX));
const sumTokensOf = (list) => list.reduce((n, e) => n + (e.estTokens ?? 0), 0);
const tokenOf = (rel) => {
  const t = fileText(rel);
  return t == null ? 0 : estimateTokens(t);
};
const ROUTES_TOKENS = tokenOf('ctx/ROUTES.md');
const HOT_FILES_TOKENS = tokenOf('ctx/hot-files.md');
// 会话口径二义（F-03，WXG-T-026 复验补）——必须在使用前求值：
//   • sessionsWithReadEvents —— 采集期「有任意读事件」的会话（含读全被丢弃者；来自采集侧车 byIde）。
//   • sessions（dist.samples）—— 账本保留行覆盖的会话（「有账本行的会话」）。
// 两者定义不同，差值 = 读事件全为仓库外路径被丢弃的会话数。
const metaSessionsTotal = meta.byIde
  ? Object.values(meta.byIde).reduce((n, v) => n + (v?.sessions ?? 0), 0)
  : null;
const protocolSessions = metaSessionsTotal ?? sessions.size;
// 应然口径拆两行，**禁止**把新产物偷偷折进用户已拍板的那一行：
//   • baseline —— 用户 q-2 口径原样：每会话读一次 `ctx/ROUTES.md`（基线，可比）。
//   • withHotFiles —— 追加 `ctx/hot-files.md`（WXG-T-036 q-1 新增的常驻第二跳）后的净额，
//     单独成行，使该产物的成本**可见且可单独归因**。
const netOf = (tok) => r6(sumFull > 0 ? 1 - (sumActual + tok) / sumFull : 0);
const protocolTokens = ROUTES_TOKENS * protocolSessions;
const protocolTokensWithHotFiles = (ROUTES_TOKENS + HOT_FILES_TOKENS) * protocolSessions;
const netSavingsBlock = {
  devicePrefixes: DEVICE_PREFIXES,
  protocolArtifactPrefix: PROTOCOL_ARTIFACT_PREFIX,
  deviceCodePrefix: DEVICE_CODE_PREFIX,
  measured: {
    deviceReadEvents: deviceReadEvents.length,
    deviceTokens: sumTokensOf(deviceReadEvents),
    // 归因只看「协议产物是否被读」：读装置源码不构成装置有效的证据。
    artifactReadEvents: artifactReadEvents.length,
    artifactTokens: sumTokensOf(artifactReadEvents),
    codeReadEvents: codeReadEvents.length,
    codeTokens: sumTokensOf(codeReadEvents),
    // 装置开销已含在 sumActual 内，故此处净额 = 毛节省率（无需再减）。
    net: r6(overallSavings),
    attributable: artifactReadEvents.length > 0,
  },
  protocol: {
    sessions: protocolSessions,
    routesTokens: ROUTES_TOKENS,
    hotFilesTokens: HOT_FILES_TOKENS,
    deviceTokens: protocolTokens,
    net: netOf(protocolTokens),
    withHotFiles: {
      deviceTokens: protocolTokensWithHotFiles,
      net: netOf(protocolTokensWithHotFiles),
    },
  },
};

const worst = [...ratios].sort((a, b) => b.ratio - a.ratio || a.path.localeCompare(b.path)).slice(0, 10);

// ⑤ 最常用章节 Top N
const topSections = [];
for (const [path, bucket] of sectionAgg) {
  for (const rec of bucket.values()) topSections.push({ ...rec, path });
}
topSections.sort((a, b) => b.reads - a.reads || b.estTokens - a.estTokens || a.path.localeCompare(b.path));
const top = topSections.slice(0, 15);

// ── 累计口径（WXG-T-037 R1）：当前窗口 ⊕ 历史聚合（ctx/savings-history.json）────
// 轮转（ctx:rotate）把窗口外会话的原始节省率样本冻结进历史；E1/E3 的判定口径 =
// 累计（窗口 + 历史），窗口滑动不再造成基线回归假绿/假红。历史缺失/非法 → 仅窗口
// 口径（等同既有行为），非法时显式告警（不静默、不假绿）。
const histRead = readHistory(HISTORY);
let cumulative = null;
if (histRead.error) {
  console.error(`⚠️ ${toPosix(HISTORY)} 结构非法——本轮**跳过累计口径**（不假绿）：${histRead.error.join('；')}`);
} else if (histRead.data && (histRead.data.aggregate?.totalReads ?? 0) > 0) {
  cumulative = cumulativeMetrics(
    {
      reads: rows.length,
      sessions: sessions.size,
      partialSamples: ratiosPartial.length,
      savingsRows,
      sumActual,
      sumFull,
      allSavings: savingsValues,
      partialSavings: savingsPartial,
      jitter: { groups: jitterGroups, groupKeys: jitterGroupKeys, excess: jitterExcess },
      bigFullReads: { count: bigFullReads.length, totalReads: rows.length },
    },
    histRead.data.aggregate,
  );
}

// ── 输出 1：usage-distribution.json（字节稳定）────────────────────────────
const filesOut = [];
for (const [path, bucket] of [...sectionAgg.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const idxFile = indexByPath.get(path);
  const sections = [...bucket.values()]
    .sort((a, b) => a.startLine - b.startLine || a.anchor.localeCompare(b.anchor))
    .map((s) => ({ anchor: s.anchor, reads: s.reads, estTokens: s.estTokens }));
  filesOut.push({ path, tokens: idxFile?.tokens ?? 0, sections });
}
const dist = {
  version: 1,
  samples: {
    sessions: sessions.size,
    reads: rows.length,
    dropped,
    unrecognized,
    sessionsWithReadEvents: metaSessionsTotal,
  },
  // `metrics`：供 ctx:build §4 与 ctx:check E 项消费的**聚合指标**（WXG-T-026 ③④）。
  // 追加式扩展——既有字段（version/samples/files）语义与数值不变，仅新增本块，避免下游重复计算。
  // 全部 token 为**估算**（est:true）。
  metrics: {
    est: true,
    reads: rows.length,
    sessions: sessions.size,
    fullFileReads,
    implicitFullReads,
    nonFullReads,
    partialSamples: ratiosPartial.length,
    partialSamplesLoose: ratiosPartialLoose.length,
    savings: {
      samples: savingsRows,
      sumActual,
      sumFull,
      overall: r6(overallSavings),
      median: r6(median),
      p10: r6(p10),
      // —— E1 判定依据（严格口径，WXG-T-036 起）：仅锚点式局部读 ——
      medianPartial: r6(medianPartial),
      p10Partial: r6(p10Partial),
      // —— 宽松口径（历史 `!fullFile`，WXG-T-026–035）：供双列对照与追溯 ——
      medianPartialLoose: r6(medianPartialLoose),
      p10PartialLoose: r6(p10PartialLoose),
      implicitFull: {
        lineRatio: IMPLICIT_FULL_LINE_RATIO,
        samples: ratiosImplicitFull.length,
        tokens: implicitFullTokens,
      },
    },
    anchor: {
      fullFileReads,
      implicitFullReads,
      fullReadsEffective,
      fullReadsLoose: fullFileReads,
      fullFileRateLoose: r6(fullFileRateLoose),
      fullFileRateEffective: r6(fullFileRateEffective),
    },
    netSavings: netSavingsBlock,
    jitter: {
      smallReadLines: SMALL_READ_LINES,
      threshold: JITTER_THRESHOLD,
      groups: jitterGroups,
      excess: jitterExcess,
      // 比率口径（F-02）——判定依据；原始计数（groups/excess）仅供人看。
      groupKeys: jitterGroupKeys,
      rate: r6(jitterRate),
    },
    bigFullReads: {
      thresholdTokens: BIG_FILE_TOKENS,
      count: bigFullReads.length,
      // 比率口径（F-02）——判定依据；原始计数（count）仅供人看。
      totalReads: rows.length,
      rate: r6(bigFullReadRate),
    },
  },
  files: filesOut,
};
mkdirSync(dirname(OUT_JSON), { recursive: true });
if (cumulative) dist.metrics.cumulative = cumulative;
writeFileSync(OUT_JSON, `${JSON.stringify(dist, null, 2)}\n`, 'utf8');

// ── 输出 2：reads-summary.md ────────────────────────────────────────────
mkdirSync(dirname(OUT_MD), { recursive: true });
writeFileSync(OUT_MD, renderReport(), 'utf8');

// ── 报告（stdout，中文）──────────────────────────────────────────────────
const pct = (r) => `${(r * 100).toFixed(1)}%`;
console.log('上下文真实使用分布分析（ctx:usage）— 全部为**估算** token（CJK≈1/字、ASCII≈1/4 字符）');
console.log(`  账本：${toPosix(LEDGER)}（${rows.length} 行${invalidRows ? `，schema 无效丢弃 ${invalidRows}` : ''}）`);
console.log(`  会话数：${sessions.size}（账本行）｜读事件：${rows.length}｜覆盖仓库内文件：${new Set(rows.map((r) => r.path)).size}`);
console.log(`  会话树（F-01）：根会话 ${lineages.length} ｜子代理 ${subagentSessions.length} ｜${lineages.map((l) => `\`${l.root.slice(0, 8)}…\`(${l.ide}) ${l.reads} 读/${pct(l.share)}`).join('，')}`);
console.log(`  仓库外丢弃：${dropped}｜未识别：${unrecognized}（来自采集侧车）`);
console.log(`  stale（文件已不存在）读事件：${staleRows}`);
console.log(`  ② 真实分布加权节省率（估算）：整体 ${pct(overallSavings)}｜中位数 ${pct(median)}｜P10 ${pct(p10)}（样本 ${savingsRows}）`);
console.log(`     E1 仅锚点式局部读（严格口径）：中位数 ${pct(medianPartial)}｜P10 ${pct(p10Partial)}（样本 ${ratiosPartial.length}）`);
console.log(`     ↳ 对照 宽松口径（含无 offset 读满全文者）：中位数 ${pct(medianPartialLoose)}｜P10 ${pct(p10PartialLoose)}（样本 ${ratiosPartialLoose.length}）`);
console.log(`  ③ 锚点直达：整读占比 ${pct(fullFileRateEffective)}（${fullReadsEffective}/${rows.length}，含实质整读 ${implicitFullReads}）｜宽松口径 ${pct(fullFileRateLoose)}（${fullFileReads}/${rows.length}）｜落在单一章节内 ${pct(nonFullReads ? containedHits / nonFullReads : 0)}（${containedHits}/${nonFullReads}）｜严格等于章节区间 ${exactHits}｜未归属 ${unattributed}`);
console.log(`  ⑥ 净收益：毛节省 ${pct(overallSavings)}｜实测净额 ${pct(netSavingsBlock.measured.net)}（协议产物 ${netSavingsBlock.measured.artifactReadEvents} 次／装置源码 ${netSavingsBlock.measured.codeReadEvents} 次，可归因=${netSavingsBlock.measured.attributable}）｜应然·基线 ${pct(netSavingsBlock.protocol.net)}（ROUTES ${ROUTES_TOKENS} tok × ${protocolSessions} 会话）｜应然·含速查 ${pct(netSavingsBlock.protocol.withHotFiles.net)}（再加 hot-files ${HOT_FILES_TOKENS} tok）`);
console.log(`  ④ 反模式（比率口径，F-02）：抖动 ${jitterGroups} 组 / ${jitterGroupKeys} 组 = ${pct(jitterRate)}（超限 ${jitterExcess} 次）｜大文件（≥${BIG_FILE_TOKENS}）整文件读 ${bigFullReads.length} / ${rows.length} = ${pct(bigFullReadRate)}`);
console.log(`  ⑤ 最常用章节 Top：见 ${toPosix(OUT_MD)}`);
if (cumulative) {
  console.log(
    `  累计口径（窗口+历史，WXG-T-037 R1）：读事件 ${cumulative.reads}（其中历史 ${cumulative.historyEvents}）｜` +
      `整体节省 ${pct(cumulative.savings.overall)}｜E1 局部读中位数 ${pct(cumulative.savings.medianPartial)}｜P10 ${pct(cumulative.savings.p10Partial)}｜` +
      `抖动率 ${pct(cumulative.jitter.rate)}｜大文件整读率 ${pct(cumulative.bigFullReads.rate)} —— E3 基线回归以此口径判定`,
  );
}
console.log(`  产出：${toPosix(OUT_JSON)}｜${toPosix(OUT_MD)}`);

// ───────────────────────────────────────────────────────── render ─────────────

function renderReport() {
  const L = [];
  const today = new Date();
  const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  L.push('# 读入使用分布报告（ctx/reads-summary.md）');
  L.push('');
  L.push(`> 生成：${d} · 由 \`tools/scripts/analyze-context-usage.mjs\` 生成，**请勿手改**。`);
  L.push('> 全部 token 为**估算值**（CJK≈1/字、ASCII≈1/4 字符；非精确 tokenizer），仅用于排行与取舍。');
  L.push('> 数据源：本机 IDE 会话转录 → `ctx/reads-ledger.jsonl`（仅元数据，无正文）。');
  L.push('');

  L.push('## ① 样本量与覆盖');
  L.push('');
  L.push('| 指标 | 值 |');
  L.push('|---|---:|');
  L.push(`| 会话数（账本保留行口径） | ${sessions.size} |`);
  L.push(`| 会话数（采集期有读事件口径，含读全被丢弃者） | ${metaSessionsTotal ?? '—'} |`);
  L.push(`| 去重后账本行数（读事件） | ${rows.length} |`);
  L.push(`| 采集识别读事件（去重前） | ${meta.readEvents ?? '—'} |`);
  L.push(`| 覆盖仓库内文件数 | ${new Set(rows.map((r) => r.path)).size} |`);
  L.push(`| 仓库外丢弃 | ${dropped} |`);
  L.push(`| 未识别记录 | ${unrecognized} |`);
  L.push(`| schema 无效（分析期丢弃） | ${invalidRows} |`);
  L.push(`| stale（文件已不存在）读事件 | ${staleRows} |`);
  L.push('');
  L.push('**按 IDE**：');
  L.push('');
  L.push('| IDE | 读事件 |');
  L.push('|---|---:|');
  for (const [ide, n] of Object.entries(ideReads).sort()) L.push(`| ${ide} | ${n} |`);
  L.push('');
  L.push('**按会话**：');
  L.push('');
  L.push('| 会话 | 读事件 |');
  L.push('|---|---:|');
  for (const [s, n] of Object.entries(sessionReads).sort()) L.push(`| \`${s}\` | ${n} |`);
  L.push('');
  L.push(
    '> **会话口径二义（WXG-T-026 复验 F-03）**：上表两行「会话数」定义不同——' +
      '**「有读事件」** = 采集期识别到 ≥1 次读调用的会话（含读路径全在仓库外、丢弃后 0 行入账者）；' +
      '**「账本保留行」** = 去重后仍留有读事件的会话。' +
      `本样本前者 ${metaSessionsTotal ?? '—'}、后者 ${sessions.size}，差值即「读全被丢弃」的会话数。` +
      '采集侧车 `ctx/reads-ledger.meta.json` 的 `sessionsWithReadEvents` / `sessionsInLedger` 同此口径。',
  );
  L.push('');

  L.push('## ② 真实分布加权节省率（核心结论）');
  L.push('');
  L.push('仅按**真实读入量**计算：`Σ(实际读入估算 tokens)` vs `Σ(对应文件全文估算 tokens)`。');
  L.push('');
  L.push('| 指标 | 值 |');
  L.push('|---|---:|');
  L.push(`| 样本读数 | ${savingsRows}（文件已不存在者不计） |`);
  L.push(`| Σ 实际读入（估算） | ${sumActual} |`);
  L.push(`| Σ 全文（估算） | ${sumFull} |`);
  L.push(`| **整体节省率** | **${(overallSavings * 100).toFixed(1)}%** |`);
  L.push(`| 单次节省率 中位数 | ${(median * 100).toFixed(1)}% |`);
  L.push(`| 单次节省率 P10 | ${(p10 * 100).toFixed(1)}% |`);
  L.push(`| **E1** 仅锚点式局部读 中位数（严格口径） | ${(medianPartial * 100).toFixed(1)}%（样本 ${ratiosPartial.length}） |`);
  L.push(`| **E1** 仅锚点式局部读 P10（严格口径） | **${(p10Partial * 100).toFixed(1)}%**（目标 ≥ 40%） |`);
  L.push(`| E1 对照：宽松口径 中位数 | ${(medianPartialLoose * 100).toFixed(1)}%（样本 ${ratiosPartialLoose.length}） |`);
  L.push(`| E1 对照：宽松口径 P10 | ${(p10PartialLoose * 100).toFixed(1)}% |`);
  if (cumulative) {
    L.push(`| **累计口径**（窗口+历史，历史 ${cumulative.historyEvents} 读事件）整体节省率 | ${(cumulative.savings.overall * 100).toFixed(1)}% |`);
    L.push(`| **累计口径** 单次节省率 中位数 | ${(cumulative.savings.median * 100).toFixed(1)}% |`);
    L.push(`| **累计口径** 单次节省率 P10 | ${(cumulative.savings.p10 * 100).toFixed(1)}% |`);
    L.push(`| **累计口径 E1** 局部读 中位数 | ${(cumulative.savings.medianPartial * 100).toFixed(1)}%（样本 ${cumulative.savings.partialSamples}） |`);
    L.push(`| **累计口径 E1** 局部读 P10 | **${(cumulative.savings.p10Partial * 100).toFixed(1)}%** |`);
  }
  L.push('');
  if (cumulative) {
    L.push(
      `> **分窗轮转与累计口径（WXG-T-037 R1）**：账本按会话分窗轮转（\`pnpm run ctx:rotate\`，见 ` +
        'docs/agent/context-instrumentation-survey.md），窗口外会话的原始节省率样本冻结进 ' +
        '`ctx/savings-history.json`。上表「累计口径」= 当前窗口 ⊕ 历史，是 **E3 基线回归的判定口径**——' +
        '窗口滑动只搬移样本、不改累计集合，故基线回归不因轮转假绿/假红。' +
        '轮转出的会话**冻结在轮转时刻**（其后同根会话的新读事件不再入账，见历史文件 note）。' +
        `E4 净收益与 §① 样本量均为**窗口口径**（历史计数见累计行的历史读事件数）。`,
    );
    L.push('');
  }
  L.push(
    `> **E1 双列与口径精修（WXG-T-036）**：判据原文是「**仅锚点式局部读**的单次节省率」，` +
      '但历史实现按 `fullFile` 标志位取样本；而该标志位在「**给了 limit、没给 offset**」时' +
      '（如 Cursor `Read{limit}`）恒为 `false`——即使它**从第 1 行起读满了整个文件**。' +
      `本样本中这类读取有 **${ratiosImplicitFull.length}** 次（行覆盖 ≥ ${(IMPLICIT_FULL_LINE_RATIO * 100).toFixed(0)}% 全文，` +
      `合计 ${implicitFullTokens} 估算 tokens），且**全部是小文件**——整读小文件本就更省，故它们**并非浪费**。`,
  );
  L.push('>');
  L.push(
    `> 严格口径把它们归入**整读**后：E1 的 P10 由 ${(p10PartialLoose * 100).toFixed(1)}% 变为 **${(p10Partial * 100).toFixed(1)}%**，` +
      `同时**整读占比由 ${(fullFileRateLoose * 100).toFixed(1)}% 升到 ${(fullFileRateEffective * 100).toFixed(1)}%**（见 §③）。` +
      '这是一次**零和的口径纠正、不是读行为的改善**——两侧数字都如实保留，**不得只报 E1 变好**。',
  );
  L.push('');
  L.push('> 中位数/P10 整体为 0% 说明样本里**整文件读**占比高（见 §③）——这正是本装置要继续压降的对象。');
  L.push('');
  L.push('### ②.1 净收益（毛节省 vs 扣除装置自身开销，WXG-T-036）');
  L.push('');
  L.push(`「装置」= 为少读而**必须额外读**的东西，分两类且**归因含义不同**：`);
  L.push('');
  L.push(`- **协议产物**（\`${PROTOCOL_ARTIFACT_PREFIX}\`：路由、速查、报告）——被读才生效，**只有它被读才谈得上装置起了作用**。`);
  L.push(`- **装置源码**（\`${DEVICE_CODE_PREFIX}\`）——读它是开发/维护开销，与「省了多少读」**无因果关系**，**不得**用来证明装置有效。`);
  L.push('');
  L.push('| 口径 | 装置开销（估算 tokens） | 净节省率 | 说明 |');
  L.push('|---|---:|---:|---|');
  L.push(
    `| **实测** | 协议产物 ${netSavingsBlock.measured.artifactTokens}（${netSavingsBlock.measured.artifactReadEvents} 次）／` +
      `装置源码 ${netSavingsBlock.measured.codeTokens}（${netSavingsBlock.measured.codeReadEvents} 次） | ` +
      `**${(netSavingsBlock.measured.net * 100).toFixed(1)}%** | 装置开销已含在 Σ 实际读入内，故净额 = 毛节省率 |`,
  );
  L.push(
    `| **应然 · 协议基线** | ${protocolTokens}（每会话 ROUTES ${ROUTES_TOKENS} tok × ${protocolSessions} 会话） | ` +
      `**${(netSavingsBlock.protocol.net * 100).toFixed(1)}%** | 用户 q-2 口径原样（只算 ROUTES），可与既有结论比对 |`,
  );
  L.push(
    `| **应然 · 含行号速查** | ${netSavingsBlock.protocol.withHotFiles.deviceTokens}` +
      `（再加 hot-files ${HOT_FILES_TOKENS} tok × ${protocolSessions} 会话） | ` +
      `**${(netSavingsBlock.protocol.withHotFiles.net * 100).toFixed(1)}%** | 新增常驻产物（WXG-T-036 q-1）的` +
      '成本**单独成行**，不折进上一行 |',
  );
  L.push('');
  L.push('> 两行「应然」都在假设「装置不改变读行为」下的**保守下界**；差值即 `ctx/hot-files.md` 的常驻代价。');
  L.push('');
  if (netSavingsBlock.measured.attributable) {
    L.push(
      `> **归因声明**：本样本中协议产物（\`${PROTOCOL_ARTIFACT_PREFIX}\`）被读 ` +
        `${netSavingsBlock.measured.artifactReadEvents} 次，装置**处于可归因状态**。`,
    );
  } else {
    L.push(
      `> ⚠️ **归因声明（必读）**：本样本中协议产物（\`${PROTOCOL_ARTIFACT_PREFIX}\`）读事件为 **0**——` +
        `装置**从未被读过**，故 **${(netSavingsBlock.measured.net * 100).toFixed(1)}%** 的毛节省**不可归因于本装置**，` +
        '它来自会话固有行为。同表右列的**应然**数字才是「装置真被用起来」时的估计；装置的真实收益须待 IDE 埋点' +
        '（`docs/agent/context-instrumentation-survey.md`）落地后方可测得。',
    );
  }
  if (netSavingsBlock.measured.codeReadEvents > 0) {
    L.push('');
    L.push(
      `> 另有 ${netSavingsBlock.measured.codeReadEvents} 次读的是**装置源码**（\`${DEVICE_CODE_PREFIX}\`），` +
        '属开发维护开销，**不计入**归因。',
    );
  }
  L.push('');
  L.push(`**最差 10 次读（节省率最低，最接近全文）**：`);
  L.push('');
  L.push('| # | 路径 | 归属 | 实际读入 | 全文 | 节省率 |');
  L.push('|---:|---|---|---:|---:|---:|');
  worst.forEach((w, i) => {
    L.push(`| ${i + 1} | \`${w.path}\` | ${w.label} | ${w.actual} | ${w.full} | ${((1 - w.ratio) * 100).toFixed(1)}% |`);
  });
  L.push('');

  L.push('## ③ 锚点直达率');
  L.push('');
  const containedRate = nonFullReads ? containedHits / nonFullReads : 0;
  L.push('| 指标 | 值 |');
  L.push('|---|---:|');
  L.push(`| 总读数 | ${rows.length} |`);
  L.push(`| 显式整文件读取（\`fullFile:true\`） | ${fullFileReads}（占 ${(fullFileRateLoose * 100).toFixed(1)}%，宽松口径） |`);
  L.push(`| 实质整读（无 offset 且读满全文） | ${implicitFullReads} |`);
  L.push(`| **整读合计（判定口径）** | **${fullReadsEffective}（占 ${(fullFileRateEffective * 100).toFixed(1)}%）** |`);
  L.push(`| 局部（带区间）读取 | ${nonFullReads} |`);
  L.push(`| 读取完整落在单一章节行区间内（锚点直达） | ${containedHits}（占局部读 ${(containedRate * 100).toFixed(1)}%） |`);
  L.push(`| 其中严格等于某 sections 区间 | ${exactHits} |`);
  L.push(`| 未归属到索引（文件不在 ctx/index.json） | ${unattributed} |`);
  L.push('');

  L.push('## ④ 反模式指标');
  L.push('');
  L.push(`- ①「同一会话同一文件小读（≤${SMALL_READ_LINES} 行）> ${JITTER_THRESHOLD} 次」抖动：**${jitterGroups}** 组，累计超限 **${jitterExcess}** 次（判据出处 \`ctx/ROUTES.md §0\`）。`);
  L.push(`- ② 对大文件（≥ ${BIG_FILE_TOKENS} 估算 tokens）的整文件读取：**${bigFullReads.length}** 次。`);
  if (bigFullReads.length) {
    L.push('');
    L.push('| 文件 | 估算 tokens | 会话 |');
    L.push('|---|---:|---|');
    for (const b of bigFullReads.sort((a, b2) => b2.tokens - a.tokens).slice(0, 20)) {
      L.push(`| \`${b.path}\` | ${b.tokens} | \`${b.session}\` |`);
    }
  }
  L.push('');

  L.push('## ⑤ 最常用章节 Top 15（供替换硬编码前缀消费）');
  L.push('');
  if (top.length === 0) {
    L.push('（无归属到章节的读取）');
  } else {
    L.push('| # | 锚点 | 文件 | 命中读数 | 归属估算 tokens |');
    L.push('|---:|---|---|---:|---:|');
    top.forEach((s, i) => {
      L.push(`| ${i + 1} | \`${s.anchor}\` | \`${s.path}\` | ${s.reads} | ${s.estTokens} |`);
    });
  }
  L.push('');

  L.push('## ⑥ 样本代表性边界（可外推性 · F-01，WXG-T-026 复验补）');
  L.push('');
  L.push('**实测事实（本账本）**：全部读事件**仅来自 2 个根会话**（及其子代理）：');
  L.push('');
  L.push('| 根会话（会话树，含其子代理） | IDE | 读事件 | 占比 |');
  L.push('|---|---|---:|---:|');
  for (const l of lineages) L.push(`| \`${l.root}\` | ${l.ide} | ${l.reads} | ${(l.share * 100).toFixed(1)}% |`);
  L.push('');
  L.push(`其余 **${subagentSessions.length}** 条会话均为上述根会话的**子代理**（非独立根）。`);
  L.push('');
  if (activeSessions.length) {
    L.push(
      `⚠️ 其中 **${activeSessions.map((a) => `\`${a.root}\`（${a.ide}）`).join('、')} 为进行中的活动会话**：` +
        '采集时仍在写入，属「边写边采」，样本**非平稳**——**重跑 `ctx:reads` 即漂移**' +
        '（正是 F-02 把抖动/大文件判定改为**比率口径**的原因）。',
    );
  } else {
    L.push('（本次样本未匹配到已声明的活动会话；声明表 `KNOWN_ACTIVE_SESSIONS` 见分析器源码。）');
  }
  L.push('');
  L.push('**明确声明**：本样本为**单仓库、单机、非独立重复采样**（同一批会话的历史读事件），');
  L.push('**不可外推**到「一般 agent 工作流」或任何普遍结论；数字仅供本仓库自身的护栏与趋势参考。');
  L.push('');
  return L.join('\n');
}

function labelFor(e, idxByPath, kind) {
  if (kind === 'implicitFull') return '整文件（实质）';
  if (kind === 'full' || e.fullFile) return '整文件';
  const f = idxByPath.get(e.path);
  if (!f) return '（未归属）';
  const start = Math.max(1, e.offset ?? 1);
  const end = start + Math.max(1, e.lines ?? 1) - 1;
  const exact = (f.sections ?? []).find((s) => s.startLine === start && s.endLine === end);
  if (exact) return `\`${exact.anchor}\``;
  const containing = (f.sections ?? []).find((s) => s.startLine <= start && s.endLine >= start);
  return containing ? `\`${containing.anchor}\`（局部）` : '（未归属）';
}

// ───────────────────────────────────────────────────────── helpers ───────────

/** 稳定浮点（6 位小数）——保证 usage-distribution.json 字节稳定。 */
function r6(x) {
  return Number.isFinite(x) ? Number(x.toFixed(6)) : 0;
}

// percentile() 已上移至 lib/savings-history.mjs 的 percentileSorted（WXG-T-037），
// 与轮转器/累计口径统一出处；本文件经 import 别名 percentile 使用，实现逐位不变。

function safeRead(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}
function safeJson(p) {
  const t = safeRead(p);
  if (t == null) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
function gitRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : process.cwd();
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
  console.log(`真实使用分布分析器（WXG-T-026 ②）

用法：
  node tools/scripts/analyze-context-usage.mjs [选项]

选项：
  --ledger=<path>       账本（默认 ctx/reads-ledger.jsonl）
  --index=<path>        章节索引（默认 ctx/index.json）
  --root=<repo>         仓库根（默认自动探测 git 根）
  --out-json=<path>     分布输出（默认 ctx/usage-distribution.json）
  --out-md=<path>       报告输出（默认 ctx/reads-summary.md）
  --strict              账本无样本（0 读数）→ exit 1

token 一律为**估算**值（lib/context-tokens.mjs 公式）。`);
}
