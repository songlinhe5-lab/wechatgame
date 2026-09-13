#!/usr/bin/env node
/**
 * check-context-budget.mjs — guard the graded context index against drift,
 * resident-file bloat (WXG-T-024) and against real-usage regression (WXG-T-026).
 *
 *   A 常驻预算  AGENTS.md ≤ 3200 tokens；my-rules/*.md 单文件 ≤ 500 tokens
 *               （阈值口径见 lib/context-index.mjs 的 LIMITS 注释）
 *   B 单文件上限 任意 .md > 8000 tokens 视为超限（除非 ctx/budget-exempt.json 白名单）
 *   C 索引新鲜度 复用 build-context-index.mjs --check 的能力（共享函数，不 shell 外调）；
 *               **契约（WXG-T-026，2026-09-12）：索引描述「已提交内容（HEAD）」** ——
 *               dirty 文件按 HEAD blob 校验（`git show HEAD:<path>`），未跟踪新文件不算
 *               「未收录」。故干净检出恒绿，本地 dirty 树亦通过（本地行号可能漂移）。
 *               **--staged（WXG-T-032 ③，非默认模式）**：C 项改为只校验**暂存区**中的 .md ——
 *               暂存内容（`git show :<path>`）的 sha256 与 ctx/index.json 比对；不一致 / 暂存了
 *               索引中不存在的新 .md / 暂存删除已收录文件 → FAIL（把「改 md 未重建索引」的拦截
 *               前移到本地提交前）。未暂存的 dirty 文件**不参与**（避免误伤并发会话在制文件）；
 *               A/B/D/E 照常跑（数据源不变）。与 --working-tree 互斥。
 *   D ROUTES 锚点 解析 ctx/ROUTES.md 的 `路径#锚点` 引用，校验路径在索引中且锚点可命中
 *               （非锚点式整文件引用须在该行尾标注 `<!-- no-anchor -->` 显式豁免）
 *   E 节省率/护栏/基线（WXG-T-026 ④，纯查表计算，消费 ctx/usage-distribution.json）：
 *               E1 仅锚点式局部读的单次节省率 中位数 ≥70%、P10 ≥40%（含全文读的整体中位数仅展示）；
 *               E2 护栏（**比率**：抖动率 = 抖动组 ÷ 不同 (ide,session,path) 小读组；大文件整文件读率 =
 *                  次数 ÷ 总读次数；原始计数仍如实展示；常驻预算引用 A 项）；
 *               E3 与 ctx/savings-baseline.json 回归比对（**v2 比率口径**，容忍带见 LIMITS 注释；
 *                  旧版计数口径基线 version<2 走兼容分支）。
 *
 *   ── 裁定留痕（WXG-T-026，2026-09-12）───────────────────────────────────────
 *               依据：E1/E2 是**行为类指标**，其取值取决于**历史会话分布**（读哪些文件、
 *               读多碎），不是本次改动的因果产物——不应作为无关 PR 的合并硬门。
 *               据此三者分层：
 *                 • E1（节省率）+ E2（护栏）→ **报告项**：未达标如实输出 ❌/数字 + WARN，
 *                   但**不阻断** CI（exit 0）。阈值常量本身**不变**，仍是报告比对口径。
 *                 • E3（基线回归）→ **硬门**：指标劣于 ctx/savings-baseline.json 容忍带 → FAIL + exit 1。
 *                 • A/B/C/D 结构门 → **硬门**（不变）。
 *               样本不足 / 基线缺失 → WARN + exit 0（未判定、不假绿）。
 *
 * Exit 0 = 结构门 A–D 全通过 且 E3 未劣化（E1/E2 可为 WARN）；
 *          exit 1 = 结构门失败 或 E3 劣于基线（Chinese diagnostics + fix hints）。
 * Token figures are **estimates** (see tools/scripts/lib/context-tokens.mjs).
 *
 * 用法：node tools/scripts/check-context-budget.mjs
 *       node tools/scripts/check-context-budget.mjs --working-tree   # 逃生阀：按本地未提交内容校验
 *       node tools/scripts/check-context-budget.mjs --staged         # 非默认模式：仅按暂存区内容校验 C 项（pre-commit 用，WXG-T-032 ③）
 *       node tools/scripts/check-context-budget.mjs --update-baseline --reason="…" --task-id="WXG-T-…"
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BASELINE_PATH,
  EXEMPT_PATH,
  LIMITS,
  ROOT,
  ROUTES_PATH,
  freshnessIssues,
  readDistribution,
  readIndex,
  readStagedBlob,
  sha256,
  stagedSet,
} from './lib/context-index.mjs';

const failures = [];
const notes = [];

const pct = (x) => `${(x * 100).toFixed(1)}%`;

// ── CLI ────────────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
const UPDATE_BASELINE = ARGV.includes('--update-baseline');
/** 逃生阀（WXG-T-026）：C 门按工作树内容（含未提交改动）校验；输出标注「非默认模式」。 */
const WORKING_TREE = ARGV.includes('--working-tree');
/** 暂存区模式（WXG-T-032 ③）：C 门只校验暂存区中的 .md；pre-commit 挂载，与 --working-tree 互斥。 */
const STAGED = ARGV.includes('--staged');
if (STAGED && WORKING_TREE) {
  console.error('❌ --staged 与 --working-tree 互斥：前者只看暂存区，后者看整个工作树。');
  process.exit(2);
}
function argValue(name) {
  const hit = ARGV.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  if (hit.includes('=')) return hit.slice(hit.indexOf('=') + 1);
  const i = ARGV.indexOf(hit);
  return ARGV[i + 1] && !ARGV[i + 1].startsWith('--') ? ARGV[i + 1] : '';
}

/** E 项整体判定状态（PASS < WARN < FAIL）。 */
let eStatus = 'PASS';
function setE(s) {
  if (s === 'FAIL') eStatus = 'FAIL';
  else if (s === 'WARN' && eStatus !== 'FAIL') eStatus = 'WARN';
}

/**
 * 行为类指标（E1 节省率 / E2 护栏）未达标的**报告项**清单。
 * 裁定（WXG-T-026，2026-09-12）：这些指标取决于历史会话分布，降级为报告项——
 * 只如实进入 WARN 文案（含 ❌ 与数字），**不 push 到 failures**、不阻断 CI；
 * 结构性门（A–D + E3 基线回归）仍走 failures → FAIL + exit 1。
 */
const behavioralMisses = [];

/** 解析 savings-baseline.json：{missing} | {error: []} | {data}。 */
function readBaseline() {
  let raw;
  try {
    raw = readFileSync(BASELINE_PATH, 'utf8');
  } catch {
    return { missing: true };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { error: [`E3: ctx/savings-baseline.json 不是合法 JSON — ${e.message}`] };
  }
  const errors = [];
  if (!String(parsed?.reason ?? '').trim()) errors.push('E3: savings-baseline.json 缺 reason（视为配置错误）');
  if (!String(parsed?.taskId ?? '').trim()) errors.push('E3: savings-baseline.json 缺 taskId（视为配置错误）');
  const version = Number(parsed?.version);
  if (!Number.isFinite(version)) errors.push('E3: savings-baseline.json 缺 version（视为配置错误）');
  // 旧版（version<2）＝计数口径；新版（v2）＝比率口径（WXG-T-026 复验 F-02）。两者兼容读取。
  const legacy = !(version >= 2);
  const m = parsed?.metrics;
  if (!m || typeof m !== 'object') {
    errors.push('E3: savings-baseline.json 缺 metrics 对象（视为配置错误）');
  } else {
    for (const k of ['medianPartial', 'p10Partial']) {
      if (typeof m[k] !== 'number') errors.push(`E3: savings-baseline.json metrics.${k} 缺失或非数字`);
    }
    if (legacy) {
      for (const k of ['jitterGroups', 'jitterExcess', 'bigFullReads']) {
        if (typeof m[k] !== 'number') errors.push(`E3: savings-baseline.json（旧版）metrics.${k} 缺失或非数字`);
      }
    } else {
      // v2 比率口径（F-02）：判定依据为 jitterRate / bigFullReadRate；原始计数仅展示。
      for (const k of ['jitterRate', 'bigFullReadRate']) {
        if (typeof m[k] !== 'number') {
          errors.push(`E3: savings-baseline.json metrics.${k} 缺失或非数字（v2 比率口径，F-02）`);
        }
      }
      if (parsed?.est !== true) errors.push('E3: savings-baseline.json 缺 est:true（全链路估算标注，F-04）');
      if (!Object.prototype.hasOwnProperty.call(parsed ?? {}, 'sampleWindow')) {
        errors.push('E3: savings-baseline.json 缺 sampleWindow 字段（可为 null，但字段须在；F-02）');
      }
    }
  }
  if (errors.length) return { error: errors };
  return { data: parsed, legacy };
}

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
    return { stale: [], unindexed: [], headChecked: [], git: false, workingTree: WORKING_TREE };
  }
  // 共用契约（WXG-T-026）：dirty 文件按 HEAD blob 校验；未跟踪新文件不算「未收录」。
  const fresh = freshnessIssues(index, { workingTree: WORKING_TREE });
  for (const s of fresh.stale) failures.push(`C: 索引过期 — ${s.path}（${s.reason}）`);
  for (const p of fresh.unindexed) failures.push(`C: 未收录的新 .md — ${p}`);
  return fresh;
}

/**
 * ── C(staged). 索引新鲜度 · 暂存区模式（WXG-T-032 ③，非默认模式）──────────────
 * 只校验暂存区中的 .md（A/B/D/E 数据源不变）；未暂存的 dirty 文件不参与——
 * 避免把并发会话的在制文件算进来误伤。失败语义：
 *   • 暂存内容 sha256 ≠ 索引记录 → 「暂存内容与索引不一致」
 *   • 暂存了索引中不存在的新 .md → 「新文件未入索引」
 *   • 暂存删除了索引仍收录的文件 → 一并 FAIL（提交后索引必过期）
 * 非 git 环境：显式降级为 note（不假绿），不误报。
 */
function checkStagedFreshness() {
  const index = readIndex();
  if (!index) {
    failures.push('C: 未找到 ctx/index.json —— 先生成：pnpm run ctx:build');
    return { stagedFiles: [], git: false };
  }
  const st = stagedSet();
  if (!st.ok) {
    notes.push('C(--staged): 未能读取 git 暂存区（非 git 仓库 / git 不可用）→ 本次未做暂存校验（不判定、不假绿）');
    return { stagedFiles: [], git: false };
  }
  const byPath = new Map(index.files.map((f) => [f.path, f]));
  const checked = [];
  for (const [path, code] of [...st.staged.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!path.endsWith('.md')) continue;
    checked.push(path);
    const rec = byPath.get(path);
    if (code === 'D') {
      if (rec) {
        failures.push(
          `C(--staged): 暂存了删除，但索引仍收录该文件 — ${path} —— ` +
            '提交前请重跑 `pnpm run ctx:build` 并 `git add ctx/index.json`',
        );
      }
      continue;
    }
    if (!rec) {
      failures.push(
        `C(--staged): 新文件未入索引 — ${path} —— ` +
          '提交前请重跑 `pnpm run ctx:build` 并重新 `git add`（该 .md 与 ctx/index.json）',
      );
      continue;
    }
    const blob = readStagedBlob(path);
    if (blob == null) {
      failures.push(`C(--staged): 无法读取暂存内容 — ${path}（stage 0 无此条目）`);
      continue;
    }
    if (sha256(blob) !== rec.sha256) {
      failures.push(
        `C(--staged): 暂存内容与索引不一致 — ${path} —— ` +
          '提交前请重跑 `pnpm run ctx:build` 并重新 `git add`（该 .md 与 ctx/index.json）',
      );
    }
  }
  return { stagedFiles: checked, git: true };
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

/** ── E. 节省率 + 护栏 + 基线回归（WXG-T-026 ④，消费 ctx/usage-distribution.json）── */
function checkE() {
  const report = {
    insufficient: false,
    reason: '',
    samples: null,
    e1: [],
    e2: [],
    e3: [],
    behavioralMisses, // E1 未达标报告项（模块级，驱动 WARN 文案与报告标题）
    e2Counts: null, // E2 护栏计数（供汇总行的行为类指标描述）
  };

  const dist = readDistribution();
  const reads = dist?.samples?.reads ?? 0;

  if (!dist) {
    report.insufficient = true;
    report.reason = '缺少 ctx/usage-distribution.json（先 pnpm run ctx:reads && pnpm run ctx:usage）';
    setE('WARN');
    return report;
  }
  if (reads < LIMITS.usageMinSamples) {
    report.insufficient = true;
    report.reason = `样本不足（${reads} 次读取 < 阈值 ${LIMITS.usageMinSamples}）`;
    setE('WARN');
    return report;
  }
  const m = dist.metrics;
  if (!m || !m.savings) {
    report.insufficient = true;
    report.reason = '分布文件缺 metrics.savings 聚合块（重跑 pnpm run ctx:usage）';
    setE('WARN');
    return report;
  }

  const s = m.savings;
  report.samples = { total: reads, partial: m.partialSamples ?? 0, sessions: dist.samples?.sessions ?? 0 };

  // E1 报告项（仅锚点式局部读）——裁定（WXG-T-026，2026-09-12）：行为类指标未达标
  // 只如实报告（❌ + 数字）并计 WARN，**不 push failures、不阻断**。
  // 阈值常量（0.70 / 0.40）原样保留，仍是报告比对口径，未改动。
  const medOk = s.medianPartial >= LIMITS.savingsMedianPartial;
  const p10Ok = s.p10Partial >= LIMITS.savingsP10Partial;
  if (!medOk) {
    behavioralMisses.push(`E1 局部读节省率中位数 ${pct(s.medianPartial)} < ${pct(LIMITS.savingsMedianPartial)}`);
    setE('WARN');
  }
  if (!p10Ok) {
    behavioralMisses.push(`E1 P10 ${pct(s.p10Partial)} < ${pct(LIMITS.savingsP10Partial)}`);
    setE('WARN');
  }
  report.e1 = [
    { label: '局部读 单次节省率 中位数', value: pct(s.medianPartial), limit: `≥ ${pct(LIMITS.savingsMedianPartial)}`, ok: medOk, kind: 'report' },
    { label: '局部读 单次节省率 P10', value: pct(s.p10Partial), limit: `≥ ${pct(LIMITS.savingsP10Partial)}`, ok: p10Ok, kind: 'report' },
    // 诚实性：同时展示「含全文读的整体中位数」，避免只报局部读数字造成美化。
    { label: '（展示）含全文读 整体中位数', value: pct(s.median), limit: '仅展示', ok: null, kind: 'info' },
    { label: '（展示）分布加权整体节省率', value: pct(s.overall), limit: '仅展示', ok: null, kind: 'info' },
  ];

  // E2 护栏（报告项，不阻断；退化另由 E3 基线判定；③ 常驻预算引用 A 项）。
  // 判定口径为**比率**（F-02）；原始计数（组数 / 次数）仍如实展示，仅供人看与追溯。
  report.e2 = [
    {
      label: `抖动率（抖动组 ÷ 不同 (ide,session,path) 小读组）`,
      value: `${pct(m.jitter?.rate ?? 0)}（${m.jitter?.groups ?? 0} 组 / ${m.jitter?.groupKeys ?? 0} 组；超限 ${m.jitter?.excess ?? 0} 次）`,
    },
    {
      label: `大文件整文件读率（次数 ÷ 总读次数）`,
      value: `${pct(m.bigFullReads?.rate ?? 0)}（${m.bigFullReads?.count ?? 0} / ${m.bigFullReads?.totalReads ?? reads} 次）`,
    },
    { label: '③ 常驻预算（引用 A 项，不重复计算）', value: '见上方 A 常驻预算表' },
  ];
  report.e2Counts = {
    jitterGroups: m.jitter?.groups ?? 0,
    jitterExcess: m.jitter?.excess ?? 0,
    bigFullReads: m.bigFullReads?.count ?? 0,
    jitterRate: m.jitter?.rate ?? 0,
    bigFullReadRate: m.bigFullReads?.rate ?? 0,
  };

  // E3 基线回归 —— **硬门**（WXG-T-026，2026-09-12 裁定：指标劣于基线容忍带 → FAIL + exit 1，不变）
  const bl = readBaseline();
  if (bl.missing) {
    report.e3 = [
      { label: '基线文件', value: '缺失', tol: '—', worse: false, missing: true },
      { label: '生成方式', value: 'pnpm run ctx:check -- --update-baseline --reason="…" --task-id="WXG-T-…"', tol: '—', worse: false, missing: true },
    ];
    notes.push('E3: 基线缺失 → WARN（未判定、不假绿）；生成用 --update-baseline（带 reason/taskId）');
    setE('WARN');
    return report;
  }
  if (bl.error) {
    for (const e of bl.error) failures.push(e);
    setE('FAIL');
    report.e3 = bl.error.map((e) => ({ configError: true, value: e }));
    return report;
  }

  const bm = bl.data.metrics;
  const cmp = [];
  for (const [key, label] of [['medianPartial', '局部读节省率中位数'], ['p10Partial', '局部读节省率 P10']]) {
    const cur = s[key];
    const base = bm[key];
    const worse = base - cur > LIMITS.baselineSavingsTol;
    const better = cur - base > LIMITS.baselineSavingsTol;
    cmp.push({ label, cur: pct(cur), base: pct(base), tol: `≥ ${pct(base)} − ${pct(LIMITS.baselineSavingsTol)}`, worse, better });
    if (worse) {
      failures.push(
        `E: ${label} 劣于基线（${pct(cur)} < ${pct(base)}，超出容忍 ${pct(LIMITS.baselineSavingsTol)}）—— 真实退化请修复，否则 --update-baseline 更新并写明 reason/taskId`,
      );
    }
  }
  if (bl.legacy) {
    // 旧版（version<2）计数口径：兼容读取，仅在未升级基线时使用（新基线一律走比率）。
    for (const [key, label, cur] of [
      ['jitterGroups', '抖动组数', m.jitter?.groups ?? 0],
      ['jitterExcess', '抖动超限次数', m.jitter?.excess ?? 0],
      ['bigFullReads', '大文件整文件读次数', m.bigFullReads?.count ?? 0],
    ]) {
      const base = bm[key];
      const tol = Math.max(LIMITS.baselineCountAbsTol, Math.round(base * LIMITS.baselineCountRelTol));
      const worse = cur - base > tol;
      const better = base - cur > tol;
      cmp.push({ label, cur, base, tol: `≤ ${base} + ${tol}`, worse, better });
      if (worse) {
        failures.push(`E: ${label} 劣于基线（${cur} > ${base} + ${tol}）—— 真实退化请修复，否则 --update-baseline 更新并写明 reason/taskId`);
      }
    }
    notes.push(
      'E3: 基线为旧版计数口径（version<2）——已兼容读取；建议 ' +
        '`pnpm run ctx:check -- --update-baseline --reason="…" --task-id="WXG-T-…"` 升级为比率口径（F-02）',
    );
  } else {
    // 新版（v2）**比率口径**（F-02）：劣于基线超过 baselineRateTol 即 FAIL；原始计数仅展示。
    for (const [key, label, cur, show] of [
      ['jitterRate', '抖动率', m.jitter?.rate ?? 0, `${m.jitter?.groups ?? 0} / ${m.jitter?.groupKeys ?? 0} 组`],
      ['bigFullReadRate', '大文件整文件读率', m.bigFullReads?.rate ?? 0, `${m.bigFullReads?.count ?? 0} / ${m.bigFullReads?.totalReads ?? reads} 次`],
    ]) {
      const base = bm[key];
      const worse = cur - base > LIMITS.baselineRateTol;
      const better = base - cur > LIMITS.baselineRateTol;
      cmp.push({ label, cur: `${pct(cur)}（${show}）`, base: pct(base), tol: `≤ ${pct(base)} + ${pct(LIMITS.baselineRateTol)}`, worse, better });
      if (worse) {
        failures.push(
          `E: ${label} 劣于基线（${pct(cur)} > ${pct(base)} + ${pct(LIMITS.baselineRateTol)}）—— ` +
            '真实退化请修复，否则 --update-baseline 更新并写明 reason/taskId',
        );
      }
    }
  }
  if (cmp.some((c) => c.worse)) setE('FAIL');
  if (cmp.every((c) => !c.worse) && cmp.some((c) => c.better)) {
    notes.push('E3: 指标优于基线 —— 可用 --update-baseline（带 reason/taskId）更新基线');
  }
  report.e3 = cmp;
  return report;
}

/** --update-baseline：按当前真实指标重写 ctx/savings-baseline.json（须 reason + taskId）。 */
function updateBaseline() {
  const reason = argValue('reason');
  const taskId = argValue('task-id');
  if (!reason || !taskId) {
    console.error('❌ --update-baseline 需同时提供 --reason="…" 与 --task-id="WXG-T-…"');
    process.exit(2);
  }
  const dist = readDistribution();
  const reads = dist?.samples?.reads ?? 0;
  const hasRates = typeof dist?.metrics?.jitter?.rate === 'number' && typeof dist?.metrics?.bigFullReads?.rate === 'number';
  if (!dist || reads < LIMITS.usageMinSamples || !dist.metrics?.savings || !hasRates) {
    console.error(
      `❌ 样本不足（${reads} 次读取 < ${LIMITS.usageMinSamples}）或缺 metrics（含比率字段 jitter.rate / bigFullReads.rate）` +
        ' —— 拒绝写基线；先跑 ctx:reads / ctx:usage',
    );
    process.exit(1);
  }
  const m = dist.metrics;
  // v2 结构升级（WXG-T-026 复验 F-02/F-04）：版本号 + est + sampleWindow（字段须在） + 比率判定字段 + 原始计数（仅展示）。
  const out = {
    version: 2,
    taskId,
    reason,
    est: true,
    sampleWindow: {
      since: null,
      until: null,
      note: '账本为字节稳定、无时间戳设计（见 lib/reads-ledger.mjs）→ 无法记录窗口起止；以「采集当时的账本快照」为窗口。',
    },
    tolerance: {
      savings: '节省率（中位数 / P10）劣于基线 > 2.0pt → FAIL',
      rate: `抖动率 / 大文件整文件读率劣于基线 > ${(LIMITS.baselineRateTol * 100).toFixed(1)}pt → FAIL（比率口径，WXG-T-026 复验 F-02）`,
      counts: '抖动组数 / 超限次数 / 大文件整文件读次数：仅如实展示，不作判定',
    },
    metrics: {
      medianPartial: m.savings.medianPartial,
      p10Partial: m.savings.p10Partial,
      // 比率口径（**判定依据**）
      jitterRate: m.jitter.rate,
      bigFullReadRate: m.bigFullReads.rate,
      // 原始计数（仅供人看 / 追溯）
      jitterGroups: m.jitter.groups,
      jitterExcess: m.jitter.excess,
      bigFullReads: m.bigFullReads.count,
    },
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`✅ 已写基线 ctx/savings-baseline.json（version 2 · 比率口径；样本 ${reads} 次读取；taskId ${taskId}）`);
  console.log(
    `   medianPartial=${pct(out.metrics.medianPartial)}｜p10Partial=${pct(out.metrics.p10Partial)}｜` +
      `抖动率=${pct(out.metrics.jitterRate)}（${out.metrics.jitterGroups} 组 / 超限 ${out.metrics.jitterExcess} 次）｜` +
      `大文件整文件读率=${pct(out.metrics.bigFullReadRate)}（${out.metrics.bigFullReads} 次）`,
  );
  process.exit(0);
}

if (UPDATE_BASELINE) updateBaseline();

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
const freshness = index
  ? STAGED
    ? checkStagedFreshness()
    : checkFreshness()
  : { stale: [], unindexed: [], headChecked: [], git: false, workingTree: WORKING_TREE };
const eReport = checkE();

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

if (STAGED) {
  console.log('C 索引新鲜度（--staged 非默认模式）— 只校验**暂存区**中的 .md：暂存内容 sha256 vs ctx/index.json');
  if (index && freshness.stagedFiles.length === 0) {
    console.log('✅ 暂存区无 .md —— 零暂存校验（≈0 开销）');
  } else if (index) {
    console.log(`ℹ️ 本次校验 ${freshness.stagedFiles.length} 个暂存 .md：${freshness.stagedFiles.join('、')}`);
  }
  if (freshness.stagedFiles.length === 0 && failures.every((f) => !f.startsWith('C'))) {
    // 暂存区无 .md 且 C 门无其他失败 → 无需额外诊断行
  } else if (failures.some((f) => f.startsWith('C'))) {
    console.log(line(false, '暂存内容与 ctx/index.json 不一致（见下方诊断）'));
  }
} else {
  console.log('C 索引新鲜度 — ctx/index.json 描述**已提交内容（HEAD）**；dirty 文件按 HEAD blob 校验');
  if (index && freshness.stale.length === 0 && freshness.unindexed.length === 0) {
    console.log(`✅ 索引新鲜（${index.files.length} 个 .md）`);
  } else {
    console.log(line(false, `索引已过期：${freshness.stale.length} 个变更，${freshness.unindexed.length} 个新文件`));
  }
}
if (STAGED) {
  console.log('   ⚠️ 非默认模式（--staged）：只看暂存区；未暂存的 dirty 文件不参与校验。');
} else if (freshness.workingTree) {
  console.log('   ⚠️ 非默认模式（--working-tree）：按**工作树**内容校验（含未提交改动）。');
} else if (freshness.git === false) {
  console.log('   ⚠️ 未能读取 git（非 git 仓库 / git 不可用）→ 回退为纯工作树语义（等价干净检出）。');
} else if (freshness.headChecked && freshness.headChecked.length > 0) {
  console.log(
    `   ℹ️ ${freshness.headChecked.length} 个 dirty 文件按 HEAD 内容校验（本地行号可能与索引漂移，提交后重跑 ctx:build 即对齐）。`,
  );
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

// 报告标题：行为类指标（E1）未达标时显式标注 WARN + 未达标（防被误读为通过）。
const e1Miss = eReport.behavioralMisses.length > 0;
console.log(
  'E 节省率 / 护栏 / 基线回归（WXG-T-026 ④；消费 ctx/usage-distribution.json，纯查表计算）' +
    (e1Miss && !eReport.insufficient ? '｜WARN：行为类指标未达标（报告项，不阻断 CI）' : ''),
);
if (eReport.insufficient) {
  console.log(`⚠️  WARN（样本不足，未判定）— ${eReport.reason}`);
} else {
  console.log(`E1 节省率（报告项，不阻断；阈值仅报告口径）— 仅锚点式局部读：中位数 ≥ ${pct(LIMITS.savingsMedianPartial)}、P10 ≥ ${pct(LIMITS.savingsP10Partial)}（含全文读的整体中位数仅展示）`);
  console.log('| 口径 | 值 | 阈值 | |');
  console.log('|---|---|---:|:--:|');
  for (const r of eReport.e1) {
    const mark = r.kind === 'info' ? 'ℹ️' : r.ok ? '✅' : '❌';
    console.log(`| ${r.label} | ${r.value} | ${r.limit} | ${mark} |`);
  }
  if (eReport.samples) {
    console.log(`样本：局部读 ${eReport.samples.partial} 次 / 总读 ${eReport.samples.total} 次 / 会话 ${eReport.samples.sessions}`);
  }
  console.log('');
  console.log('E2 护栏（报告项，不阻断）— 行为类指标，异常请登记说明；退化另由 E3 基线判定；③ 常驻预算见 A 项，不重复计算');
  console.log('| 指标 | 当前 |');
  console.log('|---|---|');
  for (const r of eReport.e2) console.log(`| ${r.label} | ${r.value} |`);
  console.log('');
  console.log(
    'E3 基线回归（硬门）— ctx/savings-baseline.json（容忍带：节省率 −' +
      `${(LIMITS.baselineSavingsTol * 100).toFixed(1)}pt；比率类（抖动率 / 大文件整文件读率）+` +
      `${(LIMITS.baselineRateTol * 100).toFixed(1)}pt；原始计数仅展示；劣于 → FAIL + exit 1）`,
  );
  if (eReport.e3.some((r) => r.configError)) {
    for (const r of eReport.e3) console.log(`  ❌ ${r.value}`);
  } else if (eReport.e3.some((r) => r.missing)) {
    for (const r of eReport.e3) console.log(`  ⚠️  ${r.label}：${r.value}`);
  } else {
    console.log('| 指标 | 当前 | 基线 | 容忍带 | |');
    console.log('|---|---:|---:|---:|:--:|');
    for (const r of eReport.e3) {
      console.log(`| ${r.label} | ${r.cur} | ${r.base} | ${r.tol} | ${r.worse ? '❌' : '✅'} |`);
    }
  }
}
console.log('');

for (const n of notes) console.log(`  note: ${n}`);
if (notes.length) console.log('');

if (failures.length === 0 && eStatus === 'PASS') {
  console.log('ctx:check OK — 结构门 A/B/C/D 与 E3 基线回归全部通过（E1/E2 行为类指标亦达标）');
  process.exit(0);
}
if (failures.length === 0 && eStatus === 'WARN') {
  // 结构门 A–D 全绿、E3 未劣化；WARN 仅来自「行为类报告项（E1/E2）」或「样本/基线未判定」。
  const e3AllOk =
    !eReport.insufficient &&
    eReport.e3.length > 0 &&
    eReport.e3.every((r) => !r.worse && !r.missing && !r.configError);
  let summary;
  if (eReport.behavioralMisses.length > 0) {
    // 明示「WARN」+「未达标」，并保留数值，禁止被读成 PASS。
    const e2 = eReport.e2Counts;
    const parts = [
      ...eReport.behavioralMisses,
      e2
        ? `E2 抖动率 ${pct(e2.jitterRate ?? 0)}（${e2.jitterGroups} 组） / 大文件整文件读率 ${pct(e2.bigFullReadRate ?? 0)}（${e2.bigFullReads} 次）`
        : null,
    ].filter(Boolean);
    summary =
      `ctx:check WARN — 结构门 A/B/C/D ✅、基线回归 E3 ${e3AllOk ? '✅' : '未判定'}；` +
      `行为类指标未达标（${parts.join('；')}）——已如实报告，不阻断 CI`;
  } else {
    summary = `ctx:check WARN — 结构门 A/B/C/D ✅；E 项未判定（${eReport.reason || '样本不足 / 基线缺失'}）——已如实报告，不阻断 CI`;
  }
  console.log(summary);
  process.exit(0);
}
console.error(`ctx:check FAILED（${failures.length}）`);
for (const f of failures) console.error(`  - ${f}`);
console.error('');
console.error(
  '修复提示：索引描述**已提交内容（HEAD）**——改动任何被索引的 .md 并提交后重跑 `pnpm run ctx:build`；\n' +
    '         若只想按本地未提交内容校验，用 `pnpm run ctx:check -- --working-tree`（非默认模式）；\n' +
    '         --staged 模式下请先 `pnpm run ctx:build` 再把变更的 .md 与 ctx/index.json 一起 `git add`。\n' +
    '         E 项劣于基线若为真实退化请修复，否则 `pnpm run ctx:check -- --update-baseline --reason="…" --task-id="WXG-T-…"` 更新。',
);
process.exit(1);
