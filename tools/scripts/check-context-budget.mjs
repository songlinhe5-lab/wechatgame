#!/usr/bin/env node
/**
 * check-context-budget.mjs — guard the graded context index against drift and
 * against resident-file bloat (WXG-T-024). Four checks, all of which must pass:
 *
 *   A 常驻预算  AGENTS.md ≤ 3200 tokens；my-rules/*.md 单文件 ≤ 500 tokens
 *               （阈值口径见 lib/context-index.mjs 的 LIMITS 注释）
 *   B 单文件上限 任意 .md > 8000 tokens 视为超限（除非 ctx/budget-exempt.json 白名单）
 *   C 索引新鲜度 复用 build-context-index.mjs --check 的能力（共享函数，不 shell 外调）
 *   D ROUTES 锚点 解析 ctx/ROUTES.md 的 `路径#锚点` 引用，校验路径在索引中且锚点可命中
 *               （非锚点式整文件引用须在该行尾标注 `<!-- no-anchor -->` 显式豁免）
 *
 * Exit 0 = all pass; exit 1 = at least one failure (Chinese diagnostics + fix hints).
 * Token figures are **estimates** (see tools/scripts/lib/context-tokens.mjs).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXEMPT_PATH,
  LIMITS,
  ROOT,
  ROUTES_PATH,
  freshnessIssues,
  readIndex,
} from './lib/context-index.mjs';

const failures = [];
const notes = [];

/** ── A. resident budget ─────────────────────────────────────────────────── */
function checkResident(index) {
  const rows = [];
  const byPath = new Map(index.files.map((f) => [f.path, f]));

  const agents = byPath.get('AGENTS.md');
  if (!agents) {
    failures.push('A: 索引中缺少 AGENTS.md');
  } else {
    const ok = agents.tokens <= LIMITS.agentsMd;
    rows.push({ file: 'AGENTS.md', tokens: agents.tokens, limit: LIMITS.agentsMd, ok });
    if (!ok) {
      failures.push(
        `A: AGENTS.md 常驻体积 ${agents.tokens} tokens > 上限 ${LIMITS.agentsMd} —— 精简 AGENTS.md（细节移入 my-skills/ 或 docs/）`,
      );
    }
  }

  let ruleFiles = [];
  try {
    ruleFiles = readdirSync(join(ROOT, 'my-rules')).filter((n) => n.endsWith('.md'));
  } catch {
    failures.push('A: my-rules/ 目录缺失');
  }
  for (const name of ruleFiles.sort()) {
    const rel = `my-rules/${name}`;
    const rec = byPath.get(rel);
    if (!rec) {
      failures.push(`A: 索引中缺少 ${rel}`);
      continue;
    }
    const ok = rec.tokens <= LIMITS.ruleFile;
    rows.push({ file: rel, tokens: rec.tokens, limit: LIMITS.ruleFile, ok });
    if (!ok) {
      failures.push(`A: ${rel} 常驻体积 ${rec.tokens} tokens > 上限 ${LIMITS.ruleFile} —— 只放短指针，正文移正本`);
    }
  }
  return rows;
}

/** ── B. per-file ceiling + exemption whitelist ──────────────────────────── */
function loadExempt() {
  let raw;
  try {
    raw = readFileSync(EXEMPT_PATH, 'utf8');
  } catch {
    return { entries: new Map(), configErrors: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { entries: new Map(), configErrors: [`B: ctx/budget-exempt.json 不是合法 JSON — ${e.message}`] };
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.exempt ?? [];
  const entries = new Map();
  const configErrors = [];
  for (const item of list) {
    const path = item?.path;
    const reason = String(item?.reason ?? '').trim();
    const taskId = String(item?.taskId ?? '').trim();
    if (!path) {
      configErrors.push('B: budget-exempt.json 条目缺少 path');
      continue;
    }
    if (!reason || !taskId) {
      configErrors.push(`B: 豁免条目 \`${path}\` 必须有 reason 与 taskId —— 视为配置错误`);
      continue;
    }
    entries.set(path, { reason, taskId });
  }
  return { entries, configErrors };
}

function checkFileMax(index) {
  const { entries, configErrors } = loadExempt();
  for (const e of configErrors) failures.push(e);

  const rows = [];
  const over = index.files.filter((f) => f.tokens > LIMITS.fileMax);
  for (const f of over) {
    const exempt = entries.get(f.path);
    rows.push({ file: f.path, tokens: f.tokens, exempt: exempt ?? null });
    if (!exempt) {
      failures.push(
        `B: \`${f.path}\` ${f.tokens} tokens > 单文件上限 ${LIMITS.fileMax} —— ` +
          '要么拆分为多文件，要么在 ctx/budget-exempt.json 登记（须带 reason 与 taskId）',
      );
    } else {
      notes.push(`B: \`${f.path}\` 超限但已豁免（${exempt.taskId}）：${exempt.reason}`);
    }
  }
  // warn about exemptions that are no longer needed
  for (const [path, meta] of entries) {
    if (!over.some((f) => f.path === path)) {
      notes.push(`B: 豁免条目 \`${path}\`（${meta.taskId}）已不再超限 —— 可移除`);
    }
  }
  return rows;
}

/** ── C. index freshness (shared with build --check) ─────────────────────── */
function checkFreshness() {
  const index = readIndex();
  if (!index) {
    failures.push('C: 未找到 ctx/index.json —— 先生成：pnpm run ctx:build');
    return { stale: [], unindexed: [] };
  }
  const { stale, unindexed } = freshnessIssues(index);
  for (const s of stale) failures.push(`C: 索引过期 — ${s.path}（${s.reason}）`);
  for (const p of unindexed) failures.push(`C: 未收录的新 .md — ${p}`);
  return { stale, unindexed };
}

/** ── D. ROUTES.md anchor references ─────────────────────────────────────── */
// 约定（见 ROUTES.md 头部）：锚点引用写作 `路径#小节标题`；整文件（非锚点）引用
// 需在该行行尾标注 `<!-- no-anchor -->` 显式豁免锚点校验。
const NO_ANCHOR_MARKER = /<!--\s*no-anchor\s*-->/;
// `路径#锚点` 引用；锚点一直取到单元格/行边界（不含 `|`、换行）。
const ANCHOR_REF = /((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md)#([^|\n]*)/g;
// 路由表「精确锚点」列：以 `.md` 路径开头，锚点段可选（缺失即整文件引用）。
const REF_CELL = /^\s*((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md)(?:#(.*))?/;

function checkRoutes(index) {
  const rows = [];
  let text;
  try {
    text = readFileSync(ROUTES_PATH, 'utf8');
  } catch {
    failures.push('D: 未找到 ctx/ROUTES.md');
    return rows;
  }
  const byPath = new Map(index.files.map((f) => [f.path, f]));
  const anchorsOf = (p) => new Set((byPath.get(p)?.sections ?? []).map((s) => s.anchor));
  const seen = new Set();
  const lines = text.split('\n');
  let inFence = false;

  const validateAnchor = (path, anchor, lineNo) => {
    const key = `${path}\u0000${anchor}`;
    if (seen.has(key)) return;
    seen.add(key);
    const f = byPath.get(path);
    if (!f) {
      rows.push({ line: lineNo, path, anchor, ok: false });
      failures.push(`D: ROUTES.md:${lineNo} 引用的文件不在索引中 — \`${path}\``);
      return;
    }
    const hit = anchorsOf(path).has(anchor);
    rows.push({ line: lineNo, path, anchor, ok: hit });
    if (!hit) {
      failures.push(
        `D: ROUTES.md:${lineNo} 锚点失效 — \`${path}#${anchor}\`：该文件 sections 中无此小节 ` +
          '（先重跑 `pnpm run ctx:build`，再同步 ROUTES.md 的标题）',
      );
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const lineNo = i + 1;

    // (1) 校验本行所有 `路径#锚点` 引用（无论出现在正文还是表格）
    ANCHOR_REF.lastIndex = 0;
    let m;
    while ((m = ANCHOR_REF.exec(line)) !== null) {
      validateAnchor(m[1], m[2].trim(), lineNo);
    }

    // (2) 路由表「精确锚点」列：整文件（非锚点）引用须显式豁免
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.split('|');
    if (cells.length < 4) continue;
    const cm = REF_CELL.exec(cells[2] ?? '');
    if (!cm || cm[2] !== undefined) continue; // 非引用列 / 已按锚点校验
    const path = cm[1];
    if (!byPath.has(path)) {
      failures.push(`D: ROUTES.md:${lineNo} 引用的文件不在索引中 — \`${path}\``);
      continue;
    }
    if (NO_ANCHOR_MARKER.test(line)) {
      notes.push(`D: ROUTES.md:${lineNo} 整文件引用 \`${path}\`（已豁免锚点校验）`);
    } else {
      failures.push(
        `D: ROUTES.md:${lineNo} 非锚点式引用 \`${path}\` 未标注豁免 — ` +
          '整文件引用请在该行行尾加 `<!-- no-anchor -->`，或改为 `路径#锚点` 形式',
      );
    }
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────── run ─────────
const index = readIndex();
let residentRows = [];
let overRows = [];
let routeRows = [];
if (!index) {
  failures.push('无法读取 ctx/index.json —— 先运行 pnpm run ctx:build');
} else {
  residentRows = checkResident(index);
  overRows = checkFileMax(index);
  routeRows = checkRoutes(index);
}
const freshness = index ? checkFreshness() : { stale: [], unindexed: [] };

// ─────────────────────────────────────────────────────────────── report ──────
const line = (ok, text) => `${ok ? '✅' : '❌'} ${text}`;

console.log('上下文预算守卫（ctx:check）');
console.log('');
console.log(`A 常驻预算 — AGENTS.md ≤ ${LIMITS.agentsMd}；my-rules/*.md 单文件 ≤ ${LIMITS.ruleFile}`);
if (residentRows.length) {
  console.log('| 文件 | tokens | 上限 | |');
  console.log('|---|---:|---:|:--:|');
  for (const r of residentRows) console.log(`| ${r.file} | ${r.tokens} | ${r.limit} | ${r.ok ? '✅' : '❌'} |`);
} else {
  console.log('（未取得数据）');
}
console.log('');

console.log(`B 单文件上限 — 任意 .md ≤ ${LIMITS.fileMax} tokens（可豁免）`);
if (overRows.length === 0) {
  console.log('✅ 无超限文件');
} else {
  console.log('| 文件 | tokens | 豁免 |');
  console.log('|---|---:|:--:|');
  for (const r of overRows) {
    console.log(`| ${r.file} | ${r.tokens} | ${r.exempt ? `✅ ${r.exempt.taskId}` : '❌'} |`);
  }
}
console.log('');

console.log('C 索引新鲜度 — ctx/index.json 与工作树一致');
if (index && freshness.stale.length === 0 && freshness.unindexed.length === 0) {
  console.log(`✅ 索引新鲜（${index.files.length} 个 .md）`);
} else {
  console.log(line(false, `索引已过期：${freshness.stale.length} 个变更，${freshness.unindexed.length} 个新文件`));
}
console.log('');

console.log('D ROUTES 锚点 — ctx/ROUTES.md 的 `路径#锚点` 引用可命中（`<!-- no-anchor -->` 豁免整文件引用）');
if (routeRows.length === 0) {
  console.log('（未解析到锚点引用）');
} else {
  const broken = routeRows.filter((r) => !r.ok);
  if (broken.length === 0) {
    console.log(`✅ ${routeRows.length} 个锚点引用全部命中`);
  } else {
    console.log(line(false, `${broken.length} / ${routeRows.length} 个锚点引用失效（见下方诊断）`));
  }
}
console.log('');

for (const n of notes) console.log(`  note: ${n}`);
if (notes.length) console.log('');

if (failures.length === 0) {
  console.log('ctx:check OK — 常驻预算 / 单文件上限 / 索引新鲜度 / ROUTES 锚点 全部通过');
  process.exit(0);
}
console.error(`ctx:check FAILED（${failures.length}）`);
for (const f of failures) console.error(`  - ${f}`);
console.error('');
console.error('修复提示：改动任何被索引的 .md 后重跑 `pnpm run ctx:build` 让索引与工作树一致。');
process.exit(1);
