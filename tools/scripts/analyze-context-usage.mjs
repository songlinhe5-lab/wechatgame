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
import { createFileCache, toPosix, validateReadEvent } from './lib/reads-ledger.mjs';

/** 「小读」行数阈值——判据来源 ctx/ROUTES.md §0「同一会话对同一文件反复小读超过 3 次」。 */
const SMALL_READ_LINES = 150;
/** 「大文件」估算 token 阈值（与 ROUTES.md / ctx:check 的 3000 口径一致）。 */
const BIG_FILE_TOKENS = 3000;
/** 反模式①的容忍上限：同会话同文件小读超过此数即计抖动。 */
const JITTER_THRESHOLD = 3;

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
const fullTokensOf = new Map(); // path → number|null
function fullTokens(path) {
  if (fullTokensOf.has(path)) return fullTokensOf.get(path);
  let t = null;
  try {
    t = estimateTokens(readFileSync(join(ROOT, path), 'utf8'));
  } catch {
    t = null;
  }
  fullTokensOf.set(path, t);
  return t;
}

const sessions = new Set();
const sessionIde = new Map(); // session → ide（用于「会话树」归属）
const ideReads = {};
const sessionReads = {};
const sectionAgg = new Map(); // path → { anchor → {reads, estTokens, startLine} }
const jitter = new Map(); // session\u0000path → smallReads
const bigFullReads = [];
const ratios = []; // {ratio, label}
const ratiosPartial = [];
let sumActual = 0;
let sumFull = 0;
let fullFileReads = 0;
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

  // ② 真实读入 vs 全文（估算）
  if (e.estTokens != null && ftok != null && ftok > 0) {
    const ratio = Math.min(1, e.estTokens / ftok);
    sumActual += e.estTokens;
    sumFull += ftok;
    savingsRows += 1;
    const rec = { ratio, label: labelFor(e, indexByPath), path: e.path, actual: e.estTokens, full: ftok };
    ratios.push(rec);
    if (!e.fullFile) ratiosPartial.push(rec);
  }

  // ③ / 归属
  const idxFile = indexByPath.get(e.path);
  const start = e.fullFile ? 1 : Math.max(1, e.offset ?? 1);
  const end = e.fullFile ? (e.lines ?? start) + start - 1 : start + Math.max(1, e.lines ?? 1) - 1;
  if (e.fullFile) fullFileReads += 1;
  else nonFullReads += 1;

  if (!idxFile) {
    unattributed += 1;
  } else {
    const sections = idxFile.sections ?? [];
    if (!e.fullFile) {
      if (sections.find((s) => s.startLine === start && s.endLine === end)) exactHits += 1;
      // 「精确落在某章节行区间」取**包含**语义：读取区间完整落在单一 sections 区间内。
      if (sections.find((s) => s.startLine <= start && end <= s.endLine)) containedHits += 1;
    }
    for (const s of sections) {
      const overlaps = e.fullFile || (Math.max(start, s.startLine) <= Math.min(end, s.endLine));
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

  // ④① 抖动
  if (!e.fullFile && e.lines != null && e.lines <= SMALL_READ_LINES) {
    const k = `${e.session}\u0000${e.path}`;
    jitter.set(k, (jitter.get(k) ?? 0) + 1);
  }
  // ④② 大文件整文件读
  if (e.fullFile && ftok != null && ftok >= BIG_FILE_TOKENS) {
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
const median = percentile(savingsValues, 0.5);
const p10 = percentile(savingsValues, 0.1);
const medianPartial = percentile(savingsPartial, 0.5);
// p10Partial：仅局部读的 P10 节省率（E1 硬门之一，WXG-T-026 ④）；既有字段不受影响。
const p10Partial = percentile(savingsPartial, 0.1);
const overallRatio = sumFull > 0 ? sumActual / sumFull : 1;
const overallSavings = 1 - overallRatio;

const worst = [...ratios].sort((a, b) => b.ratio - a.ratio || a.path.localeCompare(b.path)).slice(0, 10);

// ⑤ 最常用章节 Top N
const topSections = [];
for (const [path, bucket] of sectionAgg) {
  for (const rec of bucket.values()) topSections.push({ ...rec, path });
}
topSections.sort((a, b) => b.reads - a.reads || b.estTokens - a.estTokens || a.path.localeCompare(b.path));
const top = topSections.slice(0, 15);

// ── 输出 1：usage-distribution.json（字节稳定）────────────────────────────
const filesOut = [];
for (const [path, bucket] of [...sectionAgg.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const idxFile = indexByPath.get(path);
  const sections = [...bucket.values()]
    .sort((a, b) => a.startLine - b.startLine || a.anchor.localeCompare(b.anchor))
    .map((s) => ({ anchor: s.anchor, reads: s.reads, estTokens: s.estTokens }));
  filesOut.push({ path, tokens: idxFile?.tokens ?? 0, sections });
}
// 会话口径二义（F-03，WXG-T-026 复验补）：
//   • sessionsWithReadEvents —— 采集期「有任意读事件」的会话（含读全被丢弃者；来自采集侧车 byIde）。
//   • sessions（本块）        —— 账本保留行覆盖的会话（「有账本行的会话」）。
// 两者定义不同，差值 = 读事件全为仓库外路径被丢弃的会话数。
const metaSessionsTotal = meta.byIde
  ? Object.values(meta.byIde).reduce((n, v) => n + (v?.sessions ?? 0), 0)
  : null;

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
    nonFullReads,
    partialSamples: ratiosPartial.length,
    savings: {
      samples: savingsRows,
      sumActual,
      sumFull,
      overall: r6(overallSavings),
      median: r6(median),
      p10: r6(p10),
      medianPartial: r6(medianPartial),
      p10Partial: r6(p10Partial),
    },
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
console.log(`  ② 真实分布加权节省率（估算）：整体 ${pct(overallSavings)}｜中位数 ${pct(median)}｜P10 ${pct(p10)}（样本 ${savingsRows}）；仅局部读中位数 ${pct(medianPartial)}（样本 ${ratiosPartial.length}）`);
console.log(`  ③ 锚点直达：整文件读占比 ${pct(rows.length ? fullFileReads / rows.length : 0)}（${fullFileReads}/${rows.length}）｜落在单一章节内 ${pct(nonFullReads ? containedHits / nonFullReads : 0)}（${containedHits}/${nonFullReads}）｜严格等于章节区间 ${exactHits}｜未归属 ${unattributed}`);
console.log(`  ④ 反模式（比率口径，F-02）：抖动 ${jitterGroups} 组 / ${jitterGroupKeys} 组 = ${pct(jitterRate)}（超限 ${jitterExcess} 次）｜大文件（≥${BIG_FILE_TOKENS}）整文件读 ${bigFullReads.length} / ${rows.length} = ${pct(bigFullReadRate)}`);
console.log(`  ⑤ 最常用章节 Top：见 ${toPosix(OUT_MD)}`);
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
  L.push(`| 仅**局部读**单次节省率 中位数 | ${(medianPartial * 100).toFixed(1)}%（样本 ${ratiosPartial.length}） |`);
  L.push('');
  L.push('> 中位数/P10 为 0% 说明样本里**整文件读**占比高（见 §③）——这正是本装置要继续压降的对象。');
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
  const fullRate = rows.length ? fullFileReads / rows.length : 0;
  const containedRate = nonFullReads ? containedHits / nonFullReads : 0;
  L.push('| 指标 | 值 |');
  L.push('|---|---:|');
  L.push(`| 总读数 | ${rows.length} |`);
  L.push(`| 整文件读取 | ${fullFileReads}（占 ${(fullRate * 100).toFixed(1)}%） |`);
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

function labelFor(e, idxByPath) {
  if (e.fullFile) return '整文件';
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

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

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
