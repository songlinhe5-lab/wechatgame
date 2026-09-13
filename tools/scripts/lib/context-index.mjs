/**
 * context-index.mjs — shared engine for the graded context index (WXG-T-024).
 *
 * One module builds the section-level index over every committed `.md`, and one
 * verifies that a checked-in `ctx/index.json` still matches the working tree.
 * `build-context-index.mjs` and `check-context-budget.mjs` both import from here
 * so the build and the guard can never disagree.
 *
 * DESIGN NOTES
 * ------------
 * • Section primary key is the **title path** (e.g. `§3.7 星级与结算`), not the
 *   line range — titles survive insertions above; line numbers do not.
 * • Output must be **byte-stable**: no timestamps, files sorted by path,
 *   sections sorted by line, fixed key order, 2-space indent, trailing newline.
 * • A section's line range **includes its descendants** (H2 spans its H3s), so
 *   an agent can read a whole `§3` or just `§3.7`.
 * • **Freshness contract anchors to committed content (WXG-T-026, 2026-09-12).**
 *   Dirty (uncommitted / untracked) files are hashed from their **HEAD blob**, so
 *   the index always describes what CI checks out. See the block below.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateTokens } from './context-tokens.mjs';

/** Repository root (…/wechatgame). */
export const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

export const INDEX_PATH = join(ROOT, 'ctx', 'index.json');
export const BUDGET_MD_PATH = join(ROOT, 'ctx', 'BUDGET.md');
export const EXEMPT_PATH = join(ROOT, 'ctx', 'budget-exempt.json');
export const ROUTES_PATH = join(ROOT, 'ctx', 'ROUTES.md');
/** 真实使用分布（由 analyze-context-usage.mjs 生成，build/check 消费）。 */
export const DIST_PATH = join(ROOT, 'ctx', 'usage-distribution.json');
/** E3 回归基线（手写配置，仿 budget-exempt.json；须含 reason + taskId）。 */
export const BASELINE_PATH = join(ROOT, 'ctx', 'savings-baseline.json');

export const INDEX_VERSION = 1;

/**
 * Directory names skipped anywhere in the tree.
 *
 * `archive`（WXG-T-029）：知识库归档目录 `knowledge/archive/` **不进索引面**——
 * 归档条目已从活跃读取协议移除，不应再出现在 `ctx/index.json` / `ctx/ROUTES.md` 的可用
 * 章节集合里；置于 SKIP_DIRS 还顺带覆盖未来的 `memory/archive/`。`kb:check` ③ 断言本集合
 * 含 `archive`（导出供其校验，避免两处各写一份）。
 */
export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'build',
  'dist',
  'coverage',
  'library',
  'temp',
  'local',
  'profiles',
  'native',
  '.smoke',
  'archive',
]);

/** Files that ride in the always-on resident layer. */
const ALWAYS_FILES = new Set(['AGENTS.md', 'my-rules/INDEX.md', 'my-rules/agents-md.md']);

/** P0 high-frequency files — read often, big enough to be worth a section route. */
const HOT_FILES = new Set([
  'games/beads/design/gdd/systems-index.md',
  'docs/architecture/architecture-beads.md',
  'docs/architecture/control-manifest.md',
  'production/qa/beads/test-cases.md',
  'production/TASKS.md',
  'memory/MEMORY.md',
]);

/* ── 索引新鲜度契约：锚定「已提交内容（HEAD）」（WXG-T-026，2026-09-12）──────────
 *
 * 缺陷：本地跑 `ctx:build` 时，工作树里可能存在**并发会话未提交**的 .md。旧实现一律按
 *      工作树（未提交）内容算 sha256 入库 → CI 检出 HEAD 内容时哈希不符 → C 索引新鲜度
 *      FAIL（commit edbded7）。根因是**生成器把「部分提交的工作树」当成了真相**，
 *      在并发会话下必现。
 *
 * 契约：`ctx/index.json` 描述的是**已提交内容（HEAD）**。
 *   • 干净文件（已跟踪且无改动）→ 取**工作树**内容（= HEAD 内容，二者等价）；
 *   • dirty 文件（已跟踪但有改动）→ 取 **HEAD blob**（`git show HEAD:<path>`）参与哈希与
 *     token / 行数计算；
 *   • dirty 且 HEAD 不存在的**新文件** → **不入索引**（计入 `newFilesSkipped`）。
 * 效果：CI（干净检出）恒绿；本地 dirty 工作树同样通过校验，但**该文件的索引行号可能与
 *      本地工作树漂移**（索引描述 HEAD，不描述你的未提交改动）。
 *
 * 逃生阀：`--working-tree` 强制**全部**按工作树内容（生成器 / 门禁均支持），用于
 *        「我就是要按本地未提交内容看行号」的场景；此时输出显式标注「非默认模式」。
 */

/**
 * 由本工具自身生成、必须始终按**工作树**内容索引的文件。
 * 理由：这些文件在 build 期间被本进程写出；若套用 dirty→HEAD 规则，会把「刚写出的新
 * 内容」误判为「应按 HEAD 索引」，从而破坏 `--check` 一致性与字节稳定性。
 */
const WORKTREE_AUTHORITATIVE = new Set(['ctx/BUDGET.md']);

/** 只读运行 git（调用方负责兜底异常）；cwd 固定为仓库根。 */
function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/**
 * 计算 git 工作区 dirty 文件集合（相对仓库根、POSIX 路径）。
 * dirty = 与 HEAD 有差异（已跟踪且改动/删除/新增）或**未跟踪**（`git status` 的 `??`）。
 * @param {{workingTree?: boolean}} [opts] workingTree=true → 视作「无 dirty」（逃生阀）。
 * @returns {{ok: boolean, git: boolean, workingTree: boolean,
 *            dirty: Set<string>, untracked: Set<string>}}
 *   ok=false（非 git 仓库 / git 不可用）→ 调用方回退为纯工作树语义（等价干净检出）。
 */
export function dirtySet({ workingTree = false } = {}) {
  if (workingTree) {
    return { ok: true, git: true, workingTree: true, dirty: new Set(), untracked: new Set() };
  }
  let out;
  try {
    // --no-renames：把重命名拆成 D+A 两条记录，避免 `-z` 下额外的源路径记录解析。
    out = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames']);
  } catch {
    return { ok: false, git: false, workingTree: false, dirty: new Set(), untracked: new Set() };
  }
  const dirty = new Set();
  const untracked = new Set();
  for (const rec of out.split('\0')) {
    if (!rec) continue;
    const code = rec.slice(0, 2);
    const path = rec.slice(3);
    if (!path) continue;
    dirty.add(path);
    if (code === '??') untracked.add(path);
  }
  return { ok: true, git: true, workingTree: false, dirty, untracked };
}

/** 读取工作树文件内容；缺失 / 读取失败 → null。 */
function readWorktree(relPath) {
  try {
    return readFileSync(join(ROOT, relPath), 'utf8');
  } catch {
    return null;
  }
}

/** 读取 HEAD 中该路径的 blob 内容；HEAD 无此文件（或非 git）→ null。 */
function readHeadBlob(relPath) {
  try {
    return git(['show', `HEAD:${relPath}`]);
  } catch {
    return null;
  }
}

/**
 * 读取**暂存区**（index vs HEAD）的文件状态集合（WXG-T-032 ③，pre-commit 前置校验用）。
 * 只读运行 git；非 git 仓库 / git 不可用 → ok=false（调用方显式降级，不假绿）。
 * @returns {{ok: boolean, git: boolean, staged: Map<string, string>}}
 *   Map<路径, 首字母状态（A/M/D…）>；`--no-renames` 下重命名拆为 D+A 两条。
 */
export function stagedSet() {
  let out;
  try {
    out = git(['diff', '--cached', '--name-status', '-z', '--no-renames']);
  } catch {
    return { ok: false, git: false, staged: new Map() };
  }
  const staged = new Map();
  // `-z` 下 `--name-status` 的状态码与路径是**相邻两条** NUL 记录（如 `M`、`AGENTS.md`）。
  const recs = out.split('\0');
  for (let i = 0; i < recs.length; i += 1) {
    const rec = recs[i];
    if (!rec) continue;
    if (/^[ACDMRTUXB]{1,2}$/.test(rec)) {
      const path = recs[i + 1];
      i += 1;
      if (path) staged.set(path, rec.slice(0, 1));
      continue;
    }
    // 兜底：部分 git 版本为 `XY\tpath` 单条记录。
    const m = /^([ACDMRTUXB]{1,2})\t(.+)$/.exec(rec);
    if (m) staged.set(m[2], m[1].slice(0, 1));
  }
  return { ok: true, git: true, staged };
}

/** 读取暂存区（stage 0）中该路径的 blob 内容；暂存区无此文件（或非 git）→ null。 */
export function readStagedBlob(relPath) {
  try {
    return git(['show', `:${relPath}`]);
  } catch {
    return null;
  }
}

/**
 * 按 WXG-T-026 契约解析某被索引文件的**内容来源**。
 * @returns {{source: 'worktree' | 'head' | 'skip', text: string | null}}
 *   worktree = 取工作树内容；head = 取 HEAD blob；skip = 不入索引（HEAD 无此新文件 / 缺失）。
 */
export function resolveContent(relPath, gate) {
  const fromWorktree = () => {
    const text = readWorktree(relPath);
    return text == null ? { source: 'skip', text: null } : { source: 'worktree', text };
  };
  // 无 gate / 非 git / 逃生阀 / 本工具生成物 → 一律工作树。
  if (!gate || !gate.ok || gate.workingTree || WORKTREE_AUTHORITATIVE.has(relPath)) {
    return fromWorktree();
  }
  if (!gate.dirty.has(relPath)) return fromWorktree();
  // dirty：未跟踪（HEAD 无）→ 按契约不入索引。
  if (gate.untracked.has(relPath)) return { source: 'skip', text: null };
  const blob = readHeadBlob(relPath);
  if (blob == null) return { source: 'skip', text: null };
  return { source: 'head', text: blob };
}

/**
 * Budget thresholds (tokens, estimated).
 *
 * ⚠️ agentsMd 口径与裁定依据
 * ---------------------------------------------------
 * WXG-T-024（主理人裁决）：3000 → 3200。原 3000 疑似按「bytes / 4」口径校准，与本题的
 * 估算公式（`context-tokens.mjs`：CJK ≈ 1 token/字、ASCII ≈ 1/4 字符）**口径不一致**，
 * 导致同一份中文常驻文件在两种口径间出现「假性超限」。
 * WXG-T-032（2026-09-13，主理人裁定）：3200 → **2000**。依据：
 *   ① AGENTS.md 属 `always` 常驻层，**每会话整文件付费**，应只保留铁律 / 触发条件 / 路由指针；
 *   ② T-032 把 §5/§6/§8/§9 与 §2 细节逐字迁出至 `docs/agent/{repo-layout,commands,routing}.md`
 *      与 `ctx/ROUTES.md` / `knowledge/INDEX.md`，AGENTS.md 目标全文 ≤1700 估算 tokens；
 *   ③ 2000 在目标值之上留 ~18% 余量（对照旧口径 3200/2980 ≈ 7% 余量的比例尺）。
 * 改动须同步 `ctx/BUDGET.md`（由 ctx:build 生成）。
 */
export const LIMITS = {
  agentsMd: 2000,
  ruleFile: 500,
  fileMax: 8000,

  /*
   * ── E 项阈值（WXG-T-026 ④）：分层上下文节省装置的「效果」护栏 ────────────────
   *
   * 口径：token 一律为**估算**（`context-tokens.mjs` 公式：CJK≈1/字、ASCII≈1/4 字符）；
   *       样本 = 本机 IDE 读事件账本 `ctx/reads-ledger.jsonl` → 分布 `ctx/usage-distribution.json`。
   *
   * ⚠️ 裁定留痕（WXG-T-026，2026-09-12，主理人裁定；用于小步收口 E 项阻断语义）
   * ----------------------------------------------------------------
   * 依据：E1（节省率）/E2（护栏）是**行为类指标**，其取值取决于**历史会话分布**
   *       （读哪些文件、读多碎），不是本次改动的因果产物 —— **不应作为无关 PR 的合并硬门**。
   * 处置（分层）：
   *   • E1 + E2 → **报告项**：未达标如实输出 ❌/数字 + WARN，但**不阻断** CI（exit 0）。
   *   • E3（基线回归，见 baselineSavingsTol / baselineCount*Tol）→ **硬门**：劣于容忍带 → FAIL + exit 1。
   *   • A/B/C/D 结构门 → **硬门**（不变）。
   * 注意：以下 E1 阈值常量（0.70 / 0.40）**一个都没改**，仍是报告比对口径，仅把「不达标」的
   *       处置由 FAIL 改为 WARN 报告；判定汇聚处见 `check-context-budget.mjs` 头部与 checkE()。
   */
  // 样本不足阈值：账本读取事件少于此数 → E 项判 WARN（未判定、不假绿），exit 0。
  // 依据：低于 30 次读取时中位数/P10 抖动过大，任何判定都不可复现。
  usageMinSamples: 30,
  // E1 报告项（仅 `fullFile === false` 且能归属章节的锚点式局部读）：单次节省率 中位数 / P10。
  // ⚠️ 裁定（WXG-T-026，2026-09-12）：降级为报告项 —— 未达标只输出 ❌/数字 + WARN，**不阻断** CI；
  //    数值本身**不变**（0.70 / 0.40），仅作报告比对口径。
  savingsMedianPartial: 0.7,
  savingsP10Partial: 0.4,
  // E3 容忍带（**硬门**）：节省率类指标劣于基线超过该「绝对百分点」即 FAIL。依据：率差 ≤2pt 视为采样噪声，
  // 超过 2pt 说明分布实质变差（读得更满/更碎）。
  baselineSavingsTol: 0.02,
  /*
   * E3 容忍带（**硬门**）：**比率类**指标（抖动率 / 大文件整文件读率）劣于基线超过该「绝对百分点」即 FAIL。
   *
   * 口径升级理由（WXG-T-026 复验 F-02）：
   *   基线冻结的是**含活动会话的快照**（`ctx/reads-ledger.jsonl` 至少含 1 个「边写边采」的根会话），
   *   重采（`pnpm run ctx:reads`）会使抖动组数 / 大文件整文件读**计数自然增长**；若沿用计数容忍带
   *   `max(2, 基线×20%)`，样本一漂移就越界 → 误报「真实退化 FAIL」。故判定依据改为**比率**
   *   （分子分母随样本同步增长，近似平稳）：
   *     • 抖动率        = 抖动组数 ÷ 不同 (ide,session,path) 小读组数
   *     • 大文件整文件读率 = 大文件整文件读次数 ÷ 总读次数
   *   **原始计数仍如实展示**（仅供人看/追溯），不再作为判定依据。5pt 依据：比率取值 0–1、样本 ~500，
   *   二项近似标准误 ≈0.02，5pt ≈ 2.5σ，可容采样噪声而不放过实质退化。
   */
  baselineRateTol: 0.05,
  // ── 以下计数容忍带为 **legacy**（仅当基线为旧版 version<2、无比率字段时回退使用，见 checkE）——
  //    新基线一律走 baselineRateTol。
  baselineCountAbsTol: 2,
  baselineCountRelTol: 0.2,
};

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function toPosix(p) {
  return p.split(sep).join('/');
}

/** Recursively list every `.md` (dot-dirs and SKIP_DIRS excluded), path-sorted. */
export function listMarkdown() {
  const out = [];
  (function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) out.push(toPosix(relative(ROOT, full)));
    }
  })(ROOT);
  return out.sort();
}

function tierFor(relPath) {
  if (ALWAYS_FILES.has(relPath)) return 'always';
  if (HOT_FILES.has(relPath)) return 'hot';
  return 'normal';
}

/** Normalise a heading into its anchor: `3.7 星级与结算` → `§3.7 星级与结算`. */
function makeAnchor(rawTitle) {
  let t = rawTitle.trim().replace(/\s*\{#[^}]+\}\s*$/, '').trim();
  if (t.startsWith('§')) return t;
  const m = /^(\d+(?:\.\d+)*)\.?\s+(.*)$/.exec(t);
  if (m) return `§${m[1]} ${m[2]}`.trim();
  return `§${t}`.trim();
}

/** Collect H1–H3 headings, ignoring any that live inside a fenced code block. */
function parseHeadings(lines) {
  const headings = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (m) headings.push({ level: m[1].length, raw: m[2], line: i + 1 });
  }
  return headings;
}

const isTableRow = (t) => /^\|.*\|\s*$/.test(t);
const isTableSep = (t) => /^\|?[\s:|-]*-{2,}[\s:|-]*\|?\s*$/.test(t);

function cleanInline(text) {
  return text
    .replace(/^[>|*+\-•\s]+/, '')
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First meaningful line after a heading, markdown-flattened, ≤60 chars. */
function firstSentence(lines, startIdx, endIdx) {
  let i = startIdx;
  while (i < endIdx) {
    const raw = lines[i].trim();
    if (!raw) { i += 1; continue; }
    if (/^#{1,3}\s/.test(raw)) break;
    if (/^(```|~~~)/.test(raw)) break;
    if (isTableSep(raw)) { i += 1; continue; }
    // Table header row followed by a separator → use the first data row instead.
    if (isTableRow(raw) && i + 1 < endIdx && isTableSep(lines[i + 1].trim())) {
      const data = cleanInline(lines[i + 2] ?? '');
      return data.length > 60 ? data.slice(0, 60) : data;
    }
    const cleaned = cleanInline(raw);
    if (!cleaned) { i += 1; continue; }
    return cleaned.length > 60 ? cleaned.slice(0, 60) : cleaned;
  }
  return '';
}

/** Keywords from the title + first sentence: backticks, § refs, ids, CJK words. */
function extractKeywords(rawTitle, summary) {
  const out = [];
  const push = (s) => {
    const v = String(s).trim();
    if (v && v.length <= 32 && !out.includes(v)) out.push(v);
  };
  for (const m of rawTitle.matchAll(/`([^`]+)`/g)) push(m[1]);
  for (const m of summary.matchAll(/`([^`]+)`/g)) push(m[1]);
  const both = `${rawTitle} ${summary}`;
  for (const m of both.matchAll(/§\d+(?:\.\d+)*[A-Za-z]?/g)) push(m[0]);
  for (const m of both.matchAll(/[A-Za-z][A-Za-z0-9_]{2,}/g)) push(m[0]);
  for (const m of rawTitle.matchAll(/[\u4e00-\u9fff]{2,6}/g)) push(m[0]);
  return out.slice(0, 6);
}

/** Build the section list for one file's text. */
function buildSections(text) {
  const lines = text.split('\n');
  const headings = parseHeadings(lines);
  const sections = [];
  const seen = new Map();
  for (let i = 0; i < headings.length; i += 1) {
    const h = headings[i];
    let endLine = lines.length;
    for (let j = i + 1; j < headings.length; j += 1) {
      if (headings[j].level <= h.level) { endLine = headings[j].line - 1; break; }
    }
    let anchor = makeAnchor(h.raw);
    if (seen.has(anchor)) {
      const n = seen.get(anchor) + 1;
      seen.set(anchor, n);
      anchor = `${anchor} (${n})`;
    } else {
      seen.set(anchor, 1);
    }
    const body = lines.slice(h.line, endLine).join('\n');
    const summary = firstSentence(lines, h.line, endLine);
    sections.push({
      anchor,
      level: h.level,
      startLine: h.line,
      endLine,
      tokens: estimateTokens(body),
      summary,
      keywords: extractKeywords(h.raw, summary),
    });
  }
  return sections;
}

/** Build one file record from a file's text (pure; reusable + testable). */
function makeFileRecord(relPath, text) {
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
  return {
    path: relPath,
    tokens: estimateTokens(text),
    lines: trimmed.split('\n').length,
    sha256: sha256(text),
    tier: tierFor(relPath),
    sections: buildSections(text),
  };
}

/**
 * Build one file record, choosing its content per the WXG-T-026 contract.
 * @returns {object | null} null when the file is skipped (untracked new file / missing).
 */
export function buildFileRecord(relPath, gate = null) {
  const r = resolveContent(relPath, gate);
  if (r.text == null) return null;
  return makeFileRecord(relPath, r.text);
}

/**
 * Build the whole index object (deterministic + byte-stable).
 * @param {{workingTree?: boolean}} [opts] workingTree=true → 逃生阀：全部按工作树内容。
 * @returns {{index: object, meta: {git: boolean, workingTree: boolean,
 *            headIndexed: string[], newFilesSkipped: string[]}}}
 *   `index` 是可序列化产物（**不含** meta，保证字节稳定）；`meta` 仅供调用方打印提示。
 */
export function buildIndex({ workingTree = false } = {}) {
  const gate = dirtySet({ workingTree });
  const headIndexed = [];
  const newFilesSkipped = [];
  const files = [];
  for (const rel of listMarkdown()) {
    const r = resolveContent(rel, gate);
    if (r.text == null) {
      newFilesSkipped.push(rel);
      continue;
    }
    if (r.source === 'head') headIndexed.push(rel);
    files.push(makeFileRecord(rel, r.text));
  }
  return {
    index: {
      version: INDEX_VERSION,
      generatedBy: 'tools/scripts/build-context-index.mjs',
      files,
    },
    meta: { git: gate.git, workingTree: gate.workingTree, headIndexed, newFilesSkipped },
  };
}

/** Stable JSON serialisation — 2-space indent, trailing newline, no timestamps. */
export function serializeIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

/** Read the committed index, or null when it is absent / unparseable. */
export function readIndex() {
  try {
    return JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Compare the committed index against the repo, using the SAME content contract as
 * `buildIndex` (WXG-T-026): dirty files are checked against their HEAD blob, so a
 * clean CI checkout and a dirty local tree agree. Untracked new `.md` are omitted
 * by contract → not reported as "unindexed".
 * @param {{workingTree?: boolean}} [opts] workingTree=true → 逃生阀：全部按工作树内容。
 * @returns {{stale: {path: string, reason: string}[], unindexed: string[],
 *            headChecked: string[], git: boolean, workingTree: boolean}}
 */
export function freshnessIssues(index, { workingTree = false } = {}) {
  const gate = dirtySet({ workingTree });
  const stale = [];
  const indexed = new Set();
  const headChecked = [];
  for (const f of index?.files ?? []) {
    indexed.add(f.path);
    const r = resolveContent(f.path, gate);
    if (r.text == null) {
      stale.push({ path: f.path, reason: r.source === 'skip' ? '文件缺失（HEAD 与工作树均无）' : '文件缺失' });
      continue;
    }
    if (r.source === 'head') headChecked.push(f.path);
    if (sha256(r.text) !== f.sha256) {
      stale.push({
        path: f.path,
        reason: r.source === 'head' ? '内容已变更（HEAD blob 与索引不符）' : '内容已变更（sha256 不符）',
      });
    }
  }
  const unindexed = [];
  for (const p of listMarkdown()) {
    if (indexed.has(p)) continue;
    // 未跟踪新文件（或缺失）按契约不入索引 → 不算「未收录」。
    if (resolveContent(p, gate).text == null) continue;
    unindexed.push(p);
  }
  return { stale, unindexed, headChecked, git: gate.git, workingTree: gate.workingTree };
}

/** Convenience for the guard: does the on-disk file exist? */
export function fileTokens(relPath) {
  const text = readFileSync(join(ROOT, relPath), 'utf8');
  return estimateTokens(text);
}

export function exists(relPath) {
  try {
    statSync(join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

/** 读取真实使用分布（`ctx/usage-distribution.json`）；缺失 / 解析失败 → null。 */
export function readDistribution() {
  try {
    return JSON.parse(readFileSync(DIST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 解析 `ctx/ROUTES.md` 中的 `路径#锚点` 引用，返回顺次去重的锚点集。
 * 用途：当真实分布样本不足时，`ctx/BUDGET.md §4` 回退展示该「ROUTES 锚点集」，
 * 并在报表显式标注「样本不足」，绝不静默沿用旧硬编码常量。
 * @param {number} limit 最多返回多少条
 * @returns {{path: string, anchor: string}[]}
 */
export function routesAnchorRefs(limit = 15) {
  let text;
  try {
    text = readFileSync(ROUTES_PATH, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  const seen = new Set();
  const re = /((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md)#([^|\n]*)/g;
  for (const line of text.split('\n')) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const path = m[1];
      const anchor = m[2].trim();
      if (!anchor) continue;
      const key = `${path}#${anchor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ path, anchor });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
