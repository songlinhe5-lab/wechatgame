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
 */

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

export const INDEX_VERSION = 1;

/** Directory names skipped anywhere in the tree. */
const SKIP_DIRS = new Set([
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

/**
 * Budget thresholds (tokens, estimated).
 *
 * ⚠️ agentsMd 口径与裁定依据（WXG-T-024，主理人裁决）
 * ---------------------------------------------------
 * 3000 → **3200**。原 3000 疑似按「bytes / 4」口径校准，与本题的估算公式
 * （`context-tokens.mjs`：CJK ≈ 1 token/字、ASCII ≈ 1/4 字符）**口径不一致**，
 * 导致同一份中文常驻文件在两种口径间出现「假性超限」。3200 在 AGENTS.md 现状
 * （≈2980，CJK 口径）之上留 ~7% 余量。改动须同步 `ctx/BUDGET.md`（由 ctx:build 生成）。
 */
export const LIMITS = {
  agentsMd: 3200,
  ruleFile: 500,
  fileMax: 8000,
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

/** Build one file record from its absolute path. */
export function buildFileRecord(relPath) {
  const text = readFileSync(join(ROOT, relPath), 'utf8');
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

/** Build the whole index object (deterministic). */
export function buildIndex() {
  const files = listMarkdown().map(buildFileRecord);
  return {
    version: INDEX_VERSION,
    generatedBy: 'tools/scripts/build-context-index.mjs',
    files,
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
 * Compare the working tree against a committed index.
 * @returns {{stale: {path: string, reason: string}[], unindexed: string[]}}
 */
export function freshnessIssues(index) {
  const stale = [];
  const indexed = new Set();
  for (const f of index?.files ?? []) {
    indexed.add(f.path);
    let text;
    try {
      text = readFileSync(join(ROOT, f.path), 'utf8');
    } catch {
      stale.push({ path: f.path, reason: '文件缺失' });
      continue;
    }
    if (sha256(text) !== f.sha256) stale.push({ path: f.path, reason: '内容已变更（sha256 不符）' });
  }
  const unindexed = listMarkdown().filter((p) => !indexed.has(p));
  return { stale, unindexed };
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
