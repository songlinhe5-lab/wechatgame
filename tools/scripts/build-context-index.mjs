#!/usr/bin/env node
/**
 * build-context-index.mjs — build the graded (section-level) context index.
 *
 * WHY THIS EXISTS
 * ---------------
 * Loading a whole 5000-token GDD into a conversation is wasteful when the task
 * only needs one section. This script scans every committed `.md` and emits
 * `ctx/index.json`: per file, a token estimate + sha256 + a list of sections
 * keyed by **title path** (`§3.7 星级与结算`) with line ranges, summaries and
 * keywords. Agents then read `ctx/ROUTES.md` → jump to an anchor → `read_file`
 * only that line range, instead of loading files whole.
 *
 * It also writes a human-readable report, `ctx/BUDGET.md`.
 *
 * §4「真实最常用章节 + 分布加权节省率」消费 `ctx/usage-distribution.json`（由
 * `pnpm run ctx:usage` 从本机读事件账本生成，**WXG-T-026**）；样本不足时回退
 * `ctx/ROUTES.md` 锚点集并在报表标注「样本不足」，不再做任何硬编码前缀匹配。
 *
 * USAGE
 *   node tools/scripts/build-context-index.mjs          # write index + report
 *   node tools/scripts/build-context-index.mjs --check  # verify freshness, exit 1 on drift
 *
 * `--check` recomputes each file's sha256 and compares it to the committed
 * index; any mismatch (or a brand-new `.md`) is reported and exits 1 so CI can
 * catch a stale index. The index itself is **byte-stable** — no timestamps — so
 * two consecutive builds produce identical bytes.
 *
 * Token figures are **estimates** (see tools/scripts/lib/context-tokens.mjs).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  BUDGET_MD_PATH,
  INDEX_PATH,
  LIMITS,
  buildIndex,
  freshnessIssues,
  readDistribution,
  readIndex,
  routesAnchorRefs,
  serializeIndex,
} from './lib/context-index.mjs';

const CHECK = process.argv.includes('--check');

/** §4 最少样本数：低于此值则以「ROUTES 锚点集」回退并在报表标注「样本不足」。 */
const USAGE_MIN_SAMPLES = LIMITS.usageMinSamples;

const pct = (x) => `${(x * 100).toFixed(1)}%`;

/**
 * §4：真实最常用章节 + 真实分布加权节省率（消费 `ctx/usage-distribution.json`）。
 * 样本不足（文件缺失或读数 < USAGE_MIN_SAMPLES）时回退 ROUTES 锚点集并显式标注，
 * **不静默沿用旧常量、不伪造数字**。所有 token 标注「估算」。
 */
function renderSavingsSection() {
  const L = [];
  L.push('## 4. 真实最常用章节与分布加权节省率（估算）');
  L.push('');
  const dist = readDistribution();
  const reads = dist?.samples?.reads ?? 0;

  if (!dist || reads < USAGE_MIN_SAMPLES) {
    L.push(
      `> ⚠️ **样本不足（${reads} 次读取，回退 ROUTES 锚点）**——真实读数低于阈值 ${USAGE_MIN_SAMPLES}，` +
        '下表为 `ctx/ROUTES.md` 的锚点集，**不代表真实使用分布**。',
    );
    L.push('> 生成真实分布：`pnpm run ctx:reads`（采本机会话）→ `pnpm run ctx:usage`。');
    L.push('');
    const refs = routesAnchorRefs(15);
    if (refs.length === 0) {
      L.push('（ROUTES 锚点集为空）');
    } else {
      L.push('| # | 锚点 | 文件 |');
      L.push('|---:|---|---|');
      refs.forEach((r, i) => L.push(`| ${i + 1} | \`${r.anchor}\` | \`${r.path}\` |`));
    }
    L.push('');
    return L;
  }

  // 真实最常用章节：按真实 reads 排序（不再做前缀匹配）。
  const secs = [];
  for (const f of dist.files ?? []) {
    for (const s of f.sections ?? []) secs.push({ ...s, path: f.path });
  }
  secs.sort((a, b) => b.reads - a.reads || b.estTokens - a.estTokens || a.path.localeCompare(b.path));

  L.push(
    `> 数据源：\`ctx/usage-distribution.json\`（真实读事件账本），样本 **${reads}** 次读取 / ` +
      `${dist.samples?.sessions ?? '—'} 会话；token 一律为**估算**。`,
  );
  L.push('');
  L.push('| # | 锚点 | 文件 | 命中读数 | 归属估算 tokens |');
  L.push('|---:|---|---|---:|---:|');
  secs.slice(0, 15).forEach((s, i) => {
    L.push(`| ${i + 1} | \`${s.anchor}\` | \`${s.path}\` | ${s.reads} | ${s.estTokens} |`);
  });
  L.push('');

  const m = dist.metrics?.savings;
  if (m) {
    L.push(
      `**真实分布加权节省率**（估算）：Σ 实际读入 **${m.sumActual}** ÷ Σ 全文 **${m.sumFull}** = ` +
        `**${pct(m.overall)}**（样本 ${m.samples} 次读取）`,
    );
    L.push('');
    L.push(
      `> 单次节省率：含整文件读的整体中位数 ${pct(m.median)}、仅局部读中位数 ${pct(m.medianPartial)}、` +
        `仅局部读 P10 ${pct(m.p10Partial)}——护栏与阈值见 \`pnpm run ctx:check\` E 项。`,
    );
  } else {
    L.push(`> 样本 ${reads} 次读取（分布文件未携带聚合指标；重跑 \`pnpm run ctx:usage\` 补齐）。`);
  }
  L.push('');
  return L;
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function renderBudget(index) {
  const files = index.files;
  const resident = files.filter((f) => f.tier === 'always');
  const top = [...files].sort((a, b) => b.tokens - a.tokens || a.path.localeCompare(b.path));

  const overLimit = top.filter((f) => f.tokens > LIMITS.fileMax);

  const L = [];
  L.push('# 上下文预算报表（ctx/BUDGET.md）');
  L.push('');
  L.push(`> 生成：${today()} · 由 \`tools/scripts/build-context-index.mjs\` 自动生成，**请勿手改**。`);
  L.push('> token 为**估算值**（CJK≈1/字、ASCII≈1/4 字符；非精确 tokenizer），仅用于排行与阈值护栏。');
  L.push('> 面向 agent 的阅读入口是 `ctx/ROUTES.md`；本表用于**人**复核预算与超限。');
  L.push('');

  L.push('## 1. 常驻层体积（always-on）');
  L.push('');
  L.push('| 文件 | 估算 tokens | 行数 | 上限 | 状态 |');
  L.push('|---|---:|---:|---:|:--:|');
  for (const f of resident) {
    const limit = f.path === 'AGENTS.md' ? LIMITS.agentsMd : LIMITS.ruleFile;
    L.push(`| \`${f.path}\` | ${f.tokens} | ${f.lines} | ${limit} | ${f.tokens <= limit ? '✅' : '❌'} |`);
  }
  L.push('');
  L.push(
    `> AGENTS.md 常驻阈值 **${LIMITS.agentsMd}**（CJK 口径校准，WXG-T-024）：原 3000 疑似 bytes/4 口径，` +
      '与本表 token 估算公式（CJK≈1/字、ASCII≈1/4 字符）不一致；3200 在现状之上留 ≈7% 余量。',
  );
  L.push('');

  L.push('## 2. Top 20 大文件（估算 tokens）');
  L.push('');
  L.push('| # | 文件 | tokens | 行数 | tier |');
  L.push('|---:|---|---:|---:|:--:|');
  top.slice(0, 20).forEach((f, i) => {
    L.push(`| ${i + 1} | \`${f.path}\` | ${f.tokens} | ${f.lines} | ${f.tier} |`);
  });
  L.push('');

  L.push(`## 3. 超限清单（> ${LIMITS.fileMax} tokens = 单文件上限）`);
  L.push('');
  if (overLimit.length === 0) {
    L.push('无超限文件。');
  } else {
    L.push('| 文件 | tokens | 处置 |');
    L.push('|---|---:|:--:|');
    for (const f of overLimit) {
      L.push(`| \`${f.path}\` | ${f.tokens} | 见 \`ctx/budget-exempt.json\`（无豁免则 ❌ 需报告主理人） |`);
    }
  }
  L.push('');

  L.push(...renderSavingsSection());
  return L.join('\n');
}

function runCheck() {
  const index = readIndex();
  if (!index) {
    console.error(
      '❌ 未找到 ctx/index.json（或无法解析）。\n' +
        '   先生成索引：pnpm run ctx:build',
    );
    process.exit(1);
  }
  const { stale, unindexed } = freshnessIssues(index);
  if (stale.length === 0 && unindexed.length === 0) {
    console.log(`✅ 上下文索引新鲜 — ${index.files.length} 个 .md 与 ctx/index.json 一致`);
    process.exit(0);
  }
  console.error('❌ 上下文索引已过期，请重跑：pnpm run ctx:build');
  if (stale.length > 0) {
    console.error(`   过期/缺失文件（${stale.length}）：`);
    for (const s of stale) console.error(`     - ${s.path} — ${s.reason}`);
  }
  if (unindexed.length > 0) {
    console.error(`   未收录的新文件（${unindexed.length}）：`);
    for (const p of unindexed) console.error(`     - ${p}`);
  }
  process.exit(1);
}

function runBuild() {
  mkdirSync(dirname(INDEX_PATH), { recursive: true });

  // 1) write the report first (from a provisional index), then 2) re-index so the
  // freshly written `ctx/BUDGET.md` is itself covered by the index. BUDGET only
  // reports on the always/hot/top-20 tiers, so it never references its own token
  // count — the two passes converge and the output is byte-stable.
  writeFileSync(BUDGET_MD_PATH, renderBudget(buildIndex()), 'utf8');
  const index = buildIndex();
  writeFileSync(INDEX_PATH, serializeIndex(index), 'utf8');

  const byTier = { always: 0, hot: 0, normal: 0 };
  for (const f of index.files) byTier[f.tier] += 1;
  const sections = index.files.reduce((n, f) => n + f.sections.length, 0);
  console.log(
    `✅ ctx/index.json 已写入 — 文件 ${index.files.length}（always ${byTier.always} / hot ${byTier.hot} / normal ${byTier.normal}），章节 ${sections}`,
  );
  console.log('✅ ctx/BUDGET.md 已写入');
}

if (CHECK) runCheck();
else runBuild();
