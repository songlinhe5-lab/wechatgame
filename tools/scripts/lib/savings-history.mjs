/**
 * savings-history.mjs — 读账本**分窗轮转 + 历史聚合**共用层（WXG-T-037，R1）。
 *
 * 背景（2026-09-13 上下文膨胀审计）：`ctx/reads-ledger.jsonl` 只增不减——随会话累积
 * 无限增长，拖慢分析且使分布统计被远古会话主导。对策 R1：账本按会话分窗保留最近
 * N 个会话，窗口外条目移出账本，其**统计价值**以「历史聚合」形式并入本库管理的
 * `ctx/savings-history.json`。
 *
 * ── 关键设计：为什么历史聚合必须保留**原始样本数组** ─────────────────────────
 * E1（节省率中位数/P10）与 E3（基线回归）都依赖**分布**，纯摘要统计量（均值/计数）
 * 无法合并出分位数。故历史聚合对节省率类指标保留**每事件一个 float** 的原始样本数组
 * （`allSavings` / `partialSavings`，各保留 6 位小数），轮转时与当前窗口样本数组合并，
 * 即可重算任意分位数。E1/E3 的**判定口径**随之升级为「累计（当前窗口 + 历史）」，
 * 窗口滑动不再造成 E3 假绿/假红（累计集合在轮转下不变，见 rotate 脚本头注）。
 *
 * ── 冻结语义 ─────────────────────────────────────────────────────────────────
 * 轮转出的会话被**冻结在轮转时刻**：样本值按当时文件内容计算并固化；其根会话 id 进
 * `archivedRootSessions` 注册表，后续采集/轮转遇到同根会话的行一律丢弃（不重复聚合）。
 * 冻结后文件内容再变化引起的口径漂移如实接受（与分析器「stale/重算即漂移」同一量级）。
 *
 * 与 `lib/reads-ledger.mjs` 同风格：纯 Node ESM、零依赖、字节稳定（无时间戳、键序固定）。
 */

import { readFileSync } from 'node:fs';
import { classifyRead, countLines } from './reads-ledger.mjs';
import { estimateTokens } from './context-tokens.mjs';

/** 历史聚合文件 schema 版本。 */
export const HISTORY_VERSION = 1;

/** 历史聚合文件默认路径（相对仓库根）。 */
export const HISTORY_REL = 'ctx/savings-history.json';

// ── 阈值常量（与 analyze-context-usage.mjs 的 ④ 反模式/大文件口径一致，单一出处）──
/** 「小读」行数阈值——判据来源 ctx/ROUTES.md §0「同一会话对同一文件反复小读超过 3 次」。 */
export const SMALL_READ_LINES = 150;
/** 反模式①的容忍上限：同会话同文件小读超过此数即计抖动。 */
export const JITTER_THRESHOLD = 3;
/** 「大文件」估算 token 阈值（与 ROUTES.md / ctx:check 的 3000 口径一致）。 */
export const BIG_FILE_TOKENS = 3000;

/** 历史聚合的固定键序（序列化即此顺序；新增字段只准追加在尾部）。 */
const AGGREGATE_KEYS = [
  'totalReads',
  'sessions',
  'savingsSamples',
  'sumActual',
  'sumFull',
  'allSavings',
  'partialSavings',
  'jitterGroupKeys',
  'jitterGroups',
  'jitterExcess',
  'bigFullReads',
];

/** 空聚合（固定键序）。 */
export function emptyAggregate() {
  return {
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
  };
}

/** 空历史文件结构（固定键序）。 */
export function emptyHistory(windowSessions) {
  return {
    version: HISTORY_VERSION,
    windowSessions,
    est: true,
    note:
      '读账本分窗轮转的历史聚合（WXG-T-037 R1）：窗口外原始条目已移出 ctx/reads-ledger.jsonl，' +
      '其节省率**原始样本数组**（allSavings/partialSavings，每事件一个 float）与计数类聚合冻结于此；' +
      'archivedRootSessions 为冻结根会话注册表（后续采集/轮转对同根会话的行一律丢弃，不重复聚合）。' +
      'E1/E3 判定口径 = 累计（当前窗口 + 本历史），见 analyze-context-usage.mjs 的 metrics.cumulative。',
    archivedRootSessions: [],
    archivedSessions: {},
    aggregate: emptyAggregate(),
    rotations: [],
  };
}

/**
 * 读取历史聚合文件。
 * @returns {{missing: true} | {error: string[]} | {data: object}}
 */
export function readHistory(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return { missing: true };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { error: [`savings-history.json 不是合法 JSON — ${e.message}`] };
  }
  const problems = validateHistory(parsed);
  if (problems.length) return { error: problems };
  return { data: parsed };
}

/** 校验历史文件结构；返回问题列表（空 = 合法）。 */
export function validateHistory(h) {
  const problems = [];
  if (!h || typeof h !== 'object' || Array.isArray(h)) return ['savings-history.json 不是对象'];
  if (h.version !== HISTORY_VERSION) problems.push(`savings-history.json version 应为 ${HISTORY_VERSION}`);
  if (!Array.isArray(h.archivedRootSessions)) problems.push('savings-history.json 缺 archivedRootSessions 数组');
  if (!h.archivedSessions || typeof h.archivedSessions !== 'object' || Array.isArray(h.archivedSessions)) {
    problems.push('savings-history.json 缺 archivedSessions 对象');
  }
  const a = h.aggregate;
  if (!a || typeof a !== 'object') {
    problems.push('savings-history.json 缺 aggregate 对象');
    return problems;
  }
  for (const k of ['totalReads', 'sessions', 'savingsSamples', 'sumActual', 'sumFull', 'jitterGroupKeys', 'jitterGroups', 'jitterExcess', 'bigFullReads']) {
    if (typeof a[k] !== 'number' || !Number.isFinite(a[k])) problems.push(`aggregate.${k} 应为有限数字`);
  }
  for (const k of ['allSavings', 'partialSavings']) {
    if (!Array.isArray(a[k])) {
      problems.push(`aggregate.${k} 应为数组`);
    } else if (a[k].some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)) {
      problems.push(`aggregate.${k} 含非法样本（应为 [0,1] 内的有限数字）`);
    }
  }
  if (Array.isArray(h.rotations) && h.rotations.some((r) => !r || typeof r !== 'object' || !String(r.taskId ?? '').trim())) {
    problems.push('rotations[] 每条须含 taskId');
  }
  return problems;
}

/**
 * 单事件 → 节省率样本（分析器与轮转器共用，保证两处口径逐位一致）。
 * @param {object} e 账本读事件
 * @param {number|null} ftok 该文件全文估算 token（null = 文件不存在）
 * @param {number|null} fullLines 该文件全文行数
 * @returns {{ratio: number, kind: 'full'|'implicitFull'|'partial', savings: number} | null}
 *          无样本（缺 estTokens / 文件不存在 / 全文为空）→ null
 */
export function savingsSampleOf(e, ftok, fullLines) {
  if (e.estTokens == null || ftok == null || ftok <= 0) return null;
  const ratio = Math.min(1, e.estTokens / ftok);
  const kind = classifyRead(e, fullLines);
  return { ratio, kind, savings: 1 - ratio };
}

/**
 * 由一批账本行计算历史聚合增量（轮转器使用；口径与 analyze-context-usage.mjs 逐条对齐）。
 * @param {object[]} rows 校验通过的账本读事件
 * @param {(relPath: string) => string|null} fileTextOf 仓库相对路径 → 文件全文（null = 不存在）
 * @returns {object} 聚合增量（固定键序；浮点保留 6 位；数组升序）
 */
export function aggregateFromEvents(rows, fileTextOf) {
  const agg = emptyAggregate();
  const sessionSet = new Set();
  const jitter = new Map(); // session\0path → smallReads
  const ftokOf = new Map();
  const fullLinesOf = new Map();
  const statsOf = (p) => {
    if (!ftokOf.has(p)) {
      const t = fileTextOf(p);
      ftokOf.set(p, t == null ? null : estimateTokens(t));
      fullLinesOf.set(p, t == null ? null : countLines(t));
    }
    return { ftok: ftokOf.get(p), lines: fullLinesOf.get(p) };
  };
  for (const e of rows) {
    agg.totalReads += 1;
    sessionSet.add(e.session);
    const { ftok, lines } = statsOf(e.path);
    const smp = savingsSampleOf(e, ftok, lines);
    if (smp) {
      agg.savingsSamples += 1;
      agg.sumActual += e.estTokens;
      agg.sumFull += ftok;
      agg.allSavings.push(r6(smp.savings));
      if (smp.kind === 'partial') agg.partialSavings.push(r6(smp.savings));
    }
    if (smp?.kind === 'partial' && e.lines != null && e.lines <= SMALL_READ_LINES) {
      const k = `${e.session}\u0000${e.path}`;
      jitter.set(k, (jitter.get(k) ?? 0) + 1);
    }
    if (smp && smp.kind !== 'partial' && ftok >= BIG_FILE_TOKENS) agg.bigFullReads += 1;
  }
  for (const n of jitter.values()) {
    agg.jitterGroupKeys += 1;
    if (n > JITTER_THRESHOLD) {
      agg.jitterGroups += 1;
      agg.jitterExcess += n - JITTER_THRESHOLD;
    }
  }
  agg.sessions = sessionSet.size;
  agg.sumActual = Math.round(agg.sumActual);
  agg.sumFull = Math.round(agg.sumFull);
  agg.allSavings.sort((a, b) => a - b);
  agg.partialSavings.sort((a, b) => a - b);
  return orderedAggregate(agg);
}

/**
 * 合并两份聚合（轮转器把增量并入既有历史；数组相接后升序、计数求和）。
 * 返回新对象，不改动入参（幂等性由调用方「仅在确有新轮转时才写盘」保证）。
 */
export function mergeAggregate(base, delta) {
  const out = emptyAggregate();
  for (const k of ['totalReads', 'sessions', 'savingsSamples', 'sumActual', 'sumFull', 'jitterGroupKeys', 'jitterGroups', 'jitterExcess', 'bigFullReads']) {
    out[k] = (base?.[k] ?? 0) + (delta?.[k] ?? 0);
  }
  for (const k of ['allSavings', 'partialSavings']) {
    out[k] = [...(base?.[k] ?? []), ...(delta?.[k] ?? [])].sort((a, b) => a - b);
  }
  return orderedAggregate(out);
}

/**
 * 累计口径指标 = 当前窗口指标 ⊕ 历史聚合（分析器生成 metrics.cumulative 用）。
 * @param {object} win 当前窗口：{reads, sessions, partialSamples, savingsRows, sumActual,
 *                     sumFull, allSavings, partialSavings, jitter:{groups,groupKeys,excess},
 *                     bigFullReads:{count,totalReads}}
 * @param {object} agg 历史聚合（savings-history.json 的 aggregate）
 * @returns {object} cumulative 块（固定键序、r6 浮点、字节稳定）
 */
export function cumulativeMetrics(win, agg) {
  const all = [...(win.allSavings ?? []), ...(agg.allSavings ?? [])].sort((a, b) => a - b);
  const partial = [...(win.partialSavings ?? []), ...(agg.partialSavings ?? [])].sort((a, b) => a - b);
  const sumActual = (win.sumActual ?? 0) + (agg.sumActual ?? 0);
  const sumFull = (win.sumFull ?? 0) + (agg.sumFull ?? 0);
  const overall = sumFull > 0 ? 1 - sumActual / sumFull : 0;
  const jitterGroups = (win.jitter?.groups ?? 0) + (agg.jitterGroups ?? 0);
  const jitterKeys = (win.jitter?.groupKeys ?? 0) + (agg.jitterGroupKeys ?? 0);
  const bigCount = (win.bigFullReads?.count ?? 0) + (agg.bigFullReads ?? 0);
  const bigTotal = (win.bigFullReads?.totalReads ?? 0) + (agg.totalReads ?? 0);
  return {
    scope: 'cumulative(window+history)',
    reads: (win.reads ?? 0) + (agg.totalReads ?? 0),
    sessions: (win.sessions ?? 0) + (agg.sessions ?? 0),
    historyEvents: agg.totalReads ?? 0,
    historySessions: agg.sessions ?? 0,
    savings: {
      samples: (win.savingsRows ?? 0) + (agg.savingsSamples ?? 0),
      partialSamples: (win.partialSamples ?? 0) + (agg.partialSavings?.length ?? 0),
      sumActual,
      sumFull,
      overall: r6(overall),
      median: r6(percentileSorted(all, 0.5)),
      p10: r6(percentileSorted(all, 0.1)),
      medianPartial: r6(percentileSorted(partial, 0.5)),
      p10Partial: r6(percentileSorted(partial, 0.1)),
    },
    jitter: {
      groups: jitterGroups,
      groupKeys: jitterKeys,
      excess: (win.jitter?.excess ?? 0) + (agg.jitterExcess ?? 0),
      rate: jitterKeys > 0 ? r6(jitterGroups / jitterKeys) : 0,
    },
    bigFullReads: {
      count: bigCount,
      totalReads: bigTotal,
      rate: bigTotal > 0 ? r6(bigCount / bigTotal) : 0,
    },
  };
}

/** 稳定浮点（6 位小数）。 */
export function r6(x) {
  return Number.isFinite(x) ? Number(x.toFixed(6)) : 0;
}

/**
 * 百分位数（线性插值，输入须升序）。
 * 与 analyze-context-usage.mjs 原实现逐位一致；由本库统一出处，分析器改为复用。
 */
export function percentileSorted(sorted, p) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** 按 AGGREGATE_KEYS 固定键序重排（序列化确定性）。 */
function orderedAggregate(agg) {
  const out = {};
  for (const k of AGGREGATE_KEYS) {
    const v = agg[k];
    out[k] = Array.isArray(v) ? v : (v ?? 0);
  }
  return out;
}
