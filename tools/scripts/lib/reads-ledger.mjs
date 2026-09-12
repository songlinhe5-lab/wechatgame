/**
 * reads-ledger.mjs — shared engine for the **context read ledger** (WXG-T-026).
 *
 * 分层上下文节省效果验证装置的①采集 / ②分析共用层：定义读事件 schema、
 * 路径归一化、稳定序列化、行/字节/估算 token 计算，以及两家 IDE 转录行的
 * 归类（classifyLine）。纯 Node ESM、零依赖，风格对齐 lib/context-index.mjs。
 *
 * ── 三条口径（用户拍板，不可违反）─────────────────────────────────────────
 * 1. **估算**：tokens 一律走 lib/context-tokens.mjs 的既定公式（CJK≈1/字、
 *    ASCII≈1/4 字符），所有产出必须标注「估算」，不得声称精确 tokenizer 结果。
 * 2. **只记元数据**：账本字段白名单见 READ_EVENT_FIELDS，**绝不落文件正文**；
 *    仓库外路径默认丢弃（normalizePath 返回 ok:false → 计入 dropped）。
 * 3. **fail loud**：无法识别的转录行必须计数（unrecognized），不静默跳过。
 *
 * ── 已核实的转录形态（抽样自本机，非凭猜测硬编码）────────────────────────
 * • Cursor  `agent-transcripts/**\/*.jsonl`
 *     每行 `{role, message}`；assistant 的 `message.content[]` 内含
 *     `{"type":"tool_use","name":"Read","input":{"path":…,"offset"?,"limit"?}}`
 *     （无 offset/limit = 全文读）。另有 `{"type":"turn_ended","status"}` 事件行。
 * • WorkBuddy  `<slug>/**\/*.jsonl`
 *     `{"type":"function_call","name":"Read","arguments":"{…file_path…}","cwd":…}`
 *     其中 `arguments` 是 **JSON 字符串**，键为 `file_path`（非 `path`）；
 *     `cwd` = 项目根（相对路径据此解析）。同文件还有 function_call_result 等行。
 */

import { readFileSync } from 'node:fs';
import { basename, isAbsolute, join, normalize, posix } from 'node:path';
import { estimateTokens } from './context-tokens.mjs';

export const LEDGER_VERSION = 1;

/** 账本每行字段白名单——序列化顺序即此顺序，未知字段一律丢弃。 */
export const READ_EVENT_FIELDS = [
  'ide',
  'session',
  'path',
  'offset',
  'limit',
  'fullFile',
  'lines',
  'bytes',
  'estTokens',
];

/** 各家读工具名（保守集合，仅在抽样中确实出现者）。 */
export const READ_TOOL_NAMES = new Set(['Read', 'read', 'read_file', 'ReadFile']);

/** 已纳入的 IDE 标识（Qoder / CodeBuddy 不在本单范围，见 collector --help）。 */
export const IDES = ['cursor', 'workbuddy'];

// ───────────────────────────────────────────────────────── path helpers ────────

export function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}

/** 仓库绝对路径 → 项目 slug（`/a/b/wechatgame` → `a-b-wechatgame`）。 */
export function deriveSlug(absPath) {
  const norm = toPosix(absPath).replace(/\/+$/, '');
  const stripped = norm.startsWith('/') ? norm.slice(1) : norm;
  return stripped.replace(/\//g, '-');
}

/**
 * 路径归一化：绝对/相对 → 仓库相对路径；仓库外 / 根目录本身 / `~` → 丢弃。
 * @returns {{ok: true, rel: string} | {ok: false, reason: string}}
 */
export function normalizePath(rawPath, { root, cwd } = {}) {
  if (typeof rawPath !== 'string' || rawPath.trim() === '') return { ok: false, reason: 'empty' };
  const p0 = rawPath.trim();
  // `~` 展开依赖 HOME，无法可靠判断是否在仓库内 → 一律视为仓库外。
  if (p0.startsWith('~')) return { ok: false, reason: 'outside-repo' };

  const p = toPosix(p0);
  // 防御性归一化：折叠 `//`、剥离尾斜杠，避免与 path.join 归一化后的路径前缀不匹配。
  const rootPosix = normalize(toPosix(root)).replace(/\/+$/, '');
  let abs;
  if (isAbsolute(p)) {
    abs = normalize(p);
  } else {
    const base = cwd ? toPosix(cwd) : rootPosix;
    abs = normalize(posix.join(base, p));
  }
  if (abs === rootPosix) return { ok: false, reason: 'is-root-dir' };
  const prefix = `${rootPosix}/`;
  if (!abs.startsWith(prefix)) return { ok: false, reason: 'outside-repo' };
  const rel = abs.slice(prefix.length);
  if (rel === '' || rel.startsWith('..')) return { ok: false, reason: 'outside-repo' };
  return { ok: true, rel };
}

// ─────────────────────────────────────────── file stats (lines/bytes/tokens) ──

/** 按仓库相对路径缓存整文件文本（null = 文件不存在 → stale）。 */
export function createFileCache() {
  return new Map();
}

function readCached(rel, root, cache) {
  if (!cache) {
    try {
      return { text: readFileSync(join(root, rel), 'utf8') };
    } catch {
      return { text: null };
    }
  }
  if (cache.has(rel)) return cache.get(rel);
  let entry;
  try {
    entry = { text: readFileSync(join(root, rel), 'utf8') };
  } catch {
    entry = { text: null };
  }
  cache.set(rel, entry);
  return entry;
}

function countLines(s) {
  if (s === '') return 0;
  const t = s.endsWith('\n') ? s.slice(0, -1) : s;
  return t === '' ? 0 : t.split('\n').length;
}

function numOrNull(x) {
  if (x === null || x === undefined) return null;
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * 计算一次读取实际覆盖的行数 / 字节数 / 估算 token（**估算**）。
 * offset 为 1-based 行号，limit 为行数（对齐 Cursor / WorkBuddy Read 语义）；
 * 二者皆缺省 = 全文读。文件不存在 → 全部记 null 并标 stale（**不编造数值**）。
 * @returns {{stale: boolean, lines: number|null, bytes: number|null, estTokens: number|null}}
 */
export function rangeStats(relPath, { offset, limit, root, cache } = {}) {
  const entry = readCached(relPath, root, cache);
  if (entry.text == null) return { stale: true, lines: null, bytes: null, estTokens: null };
  const text = entry.text;
  const full = offset == null && limit == null;
  let slice;
  if (full) {
    slice = text;
  } else {
    const all = text.split('\n');
    const start = Math.max(1, Number.isFinite(offset) ? offset : 1);
    const from = start - 1;
    const lim = Number.isFinite(limit) ? limit : null;
    slice = (lim == null ? all.slice(from) : all.slice(from, from + lim)).join('\n');
  }
  return {
    stale: false,
    lines: countLines(slice),
    bytes: Buffer.byteLength(slice, 'utf8'),
    estTokens: estimateTokens(slice),
  };
}

// ─────────────────────────────────────────────────────── event construction ───

/** 构造一条读事件（字段白名单，固定键序）。 */
export function makeReadEvent({ ide, session, path, offset = null, limit = null, stats }) {
  const fullFile = offset == null && limit == null;
  return {
    ide,
    session,
    path,
    offset: fullFile ? null : offset,
    limit: fullFile ? null : limit,
    fullFile,
    lines: stats.lines,
    bytes: stats.bytes,
    estTokens: stats.estTokens,
  };
}

/** 稳定序列化：固定键序、无时间戳字段、未知字段丢弃。 */
export function serializeReadEvent(e) {
  const ordered = {};
  for (const k of READ_EVENT_FIELDS) ordered[k] = Object.prototype.hasOwnProperty.call(e, k) ? e[k] : null;
  return JSON.stringify(ordered);
}

/** 去重键：`(ide, session, path, offset, limit)`；缺省 offset/limit = 全文读。 */
export function dedupeKey(e) {
  return [e.ide, e.session, e.path, e.offset ?? '', e.limit ?? ''].join('\u0000');
}

/** 校验一条账本行是否符合 schema（分析器复用）。 @returns {string[]} 问题列表 */
export function validateReadEvent(e) {
  const problems = [];
  if (!e || typeof e !== 'object' || Array.isArray(e)) return ['不是对象'];
  for (const k of ['ide', 'session', 'path', 'fullFile']) {
    if (!Object.prototype.hasOwnProperty.call(e, k)) problems.push(`缺字段 ${k}`);
  }
  if (typeof e.ide !== 'string') problems.push('ide 非字符串');
  if (typeof e.session !== 'string') problems.push('session 非字符串');
  if (typeof e.path !== 'string' || !e.path) problems.push('path 非非空字符串');
  if (typeof e.fullFile !== 'boolean') problems.push('fullFile 非布尔');
  for (const k of ['offset', 'limit', 'lines', 'bytes', 'estTokens']) {
    const v = e[k];
    if (v !== null && typeof v !== 'number') problems.push(`${k} 应为 number|null`);
  }
  return problems;
}

/** 比较两条读事件（稳定排序用）：ide, session, path, offset, limit。 */
export function compareReadEvents(a, b) {
  const keys = ['ide', 'session', 'path'];
  for (const k of keys) {
    if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  }
  for (const k of ['offset', 'limit']) {
    const av = a[k] ?? -1;
    const bv = b[k] ?? -1;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  return 0;
}

// ───────────────────────────────────────── transcrip line classification ──────

/**
 * 归类一条转录行。
 * @returns {{kind: 'read'|'other'|'malformed'|'unrecognized',
 *            reads: {rawPath: string, offset: number|null, limit: number|null}[],
 *            badReads: number}}
 *   read         识别到读调用（reads 为可用的读；badReads 为形态像读但取不出路径的条数）
 *   other        可识别的非读记录（消息 / 其它工具 / 事件行）
 *   malformed    JSON 解析失败
 *   unrecognized 无法识别的记录（既非已知信封，也非工具调用）
 */
export function classifyLine(ide, line) {
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    return { kind: 'malformed', reads: [], badReads: 0 };
  }
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
    return { kind: 'unrecognized', reads: [], badReads: 0 };
  }
  if (ide === 'cursor') return classifyCursor(rec);
  if (ide === 'workbuddy') return classifyWorkBuddy(rec);
  return { kind: 'unrecognized', reads: [], badReads: 0 };
}

function classifyCursor(rec) {
  const msg = rec.message;
  if (msg && typeof msg === 'object' && Array.isArray(msg.content)) {
    const reads = [];
    let badReads = 0;
    for (const item of msg.content) {
      if (!item || typeof item !== 'object') continue;
      if (item.type !== 'tool_use') continue;
      if (!READ_TOOL_NAMES.has(item.name)) continue;
      const input = item.input && typeof item.input === 'object' ? item.input : null;
      const rawPath = input ? input.path : undefined;
      if (typeof rawPath !== 'string' || !rawPath.trim()) {
        badReads += 1;
        continue;
      }
      reads.push({ rawPath, offset: numOrNull(input.offset), limit: numOrNull(input.limit) });
    }
    if (reads.length > 0 || badReads > 0) return { kind: 'read', reads, badReads };
    return { kind: 'other', reads: [], badReads: 0 };
  }
  if (typeof rec.role === 'string' || typeof rec.type === 'string') {
    return { kind: 'other', reads: [], badReads: 0 };
  }
  return { kind: 'unrecognized', reads: [], badReads: 0 };
}

function classifyWorkBuddy(rec) {
  if (rec.type === 'function_call') {
    if (!READ_TOOL_NAMES.has(rec.name)) return { kind: 'other', reads: [], badReads: 0 };
    let args = rec.arguments;
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch {
        return { kind: 'read', reads: [], badReads: 1 };
      }
    }
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return { kind: 'read', reads: [], badReads: 1 };
    }
    const rawPath = args.file_path ?? args.path;
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return { kind: 'read', reads: [], badReads: 1 };
    }
    return {
      kind: 'read',
      reads: [{ rawPath, offset: numOrNull(args.offset), limit: numOrNull(args.limit) }],
      badReads: 0,
    };
  }
  if (typeof rec.type === 'string') return { kind: 'other', reads: [], badReads: 0 };
  if (rec.message && typeof rec.message === 'object') return { kind: 'other', reads: [], badReads: 0 };
  if (typeof rec.role === 'string') return { kind: 'other', reads: [], badReads: 0 };
  return { kind: 'unrecognized', reads: [], badReads: 0 };
}

// ──────────────────────────────────────────────────────────────── misc ────────

/** 文件级「项目 slug」发现：优先精确 slug，退化为 basename 后缀匹配。 */
export function discoverSlug(availableNames, root) {
  const expected = deriveSlug(root);
  if (availableNames.includes(expected)) return expected;
  const base = basename(toPosix(root));
  const suffix = `-${base}`;
  const hit = availableNames.filter((n) => n === base || n.endsWith(suffix));
  return hit.length === 1 ? hit[0] : null;
}
