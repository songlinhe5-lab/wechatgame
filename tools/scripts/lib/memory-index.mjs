/**
 * memory-index.mjs — `memory/INDEX.md` 的**摘要层渲染**（WXG-T-068）。
 *
 * ── 为什么要有它（用户 2026-09-14 的分级加载要求）──────────────────────────────
 * `memory/` 里 4 篇日记合计 ≈ **3.2 万 tok**（单篇 5.6k–10.1k），任何会话都读不起 ⇒
 * 结果是「知识库内容很多，但没人敢读」＝事实上的不可用。`knowledge/` 早就是正确形状
 * （`INDEX.md` 3.2k = 摘要层 + `lessons.md`/`patterns.md` = 详情层），`memory/` 缺这一层。
 *
 * 本模块产出 `memory/INDEX.md` 的**标记块**（`<!-- memory:index:start -->` … `end -->`）：
 * 手写协议在外、生成表在内 —— 与 `knowledge/INDEX.md` 的 `kb:active` 块同规格。
 *
 * ── 单一真源 ──────────────────────────────────────────────────────────────────
 * 块内容**完全由 `ctx/index.json` 派生**（节锚点 / 行区间 / 体量 / 摘要都已在里面），
 * 不另写一套摘要器：两套必然漂移，而漂移的后果是**索引指错行**（比没有索引更坏）。
 * 故本文件只做渲染，由 `ctx:build` 在写完索引后调用 ⇒ 与索引天然同源，无需人工维护。
 *
 * ⚠️ **口径诚实声明**（同时写进产物里）：摘要 = `firstSentence()` 的**节首句摘取**，
 * **不是**人工撰写的提要。用它判断「要不要读这一节」足够，别拿它当结论。
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './context-index.mjs';

/** 产物相对路径（相对仓库根；调用方各自与自己的 ROOT 拼接，避免重复的根推导）。 */
export const MEMORY_INDEX_REL = 'memory/INDEX.md';
/** 产物绝对路径（复用 `context-index.mjs` 的 ROOT 推导，不另写一套）。 */
export const MEMORY_INDEX_PATH = join(ROOT, 'memory', 'INDEX.md');
/** 生成块边界（手写协议在外、生成表在内；与 `knowledge/INDEX.md` 的 kb:active 同规格）。 */
export const MEMORY_INDEX_START = '<!-- memory:index:start（由 pnpm run ctx:build 生成，勿手改）-->';
export const MEMORY_INDEX_END = '<!-- memory:index:end -->';
/**
 * 蒸馏到期天数 —— 与 `tools/scripts/distill-memory.mjs` 的默认值（`args.days ?? 30`）同口径。
 * 该默认值内联在其 argv 解析里（无导出），故此处复述；`ctx:check` 有一致性断言防漂移。
 */
export const MEMORY_DIGEST_DAYS = 30;

/** 今日（UTC 日界）——与 `memory:distill` 的年龄口径一致（其裁决：年龄 = UTC 日界差）。 */
export function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 直接产出 `memory/INDEX.md` 的**完整文本**：读现有文件（或首次用 {@link memoryIndexPreamble}）
 * 后 upsert 生成块。`ctx:build` 与 `ctx:check` 共用它 ⇒ 二者对「什么算新鲜」永远同口径。
 */
export function renderMemoryIndexText(index, today = utcToday()) {
  const existing = existsSync(MEMORY_INDEX_PATH)
    ? readFileSync(MEMORY_INDEX_PATH, 'utf8')
    : memoryIndexPreamble();
  return upsertMemoryIndex(existing, renderMemoryIndexBlock(index, today));
}

/** 只认「日记」：`memory/YYYY-MM-DD.md`（`MEMORY.md` / `INDEX.md` / `archive/` 都不算）。 */
export function isMemoryDaily(path) {
  return /^memory\/\d{4}-\d{2}-\d{2}\.md$/.test(path);
}

/** 索引里的日记条目，按日期**降序**（最新在前——最常被查的是最近的）。 */
export function memoryDailies(index) {
  return index.files
    .filter((f) => isMemoryDaily(f.path))
    .slice()
    .sort((a, b) => b.path.localeCompare(a.path));
}

/** `memory/2026-09-14.md` → `2026-09-14`。 */
export function memoryDailyDate(path) {
  return path.slice('memory/'.length, -'.md'.length);
}

/** 加 `days` 天（输入/输出 `YYYY-MM-DD`，UTC 日界，与 distill 的年龄口径一致）。 */
function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 两日相差天数（`to - from`，UTC 日界）。 */
function daysBetween(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** 千位分隔（与 `systems/sprint-settle.ts` 的 formatScore 同观感）。 */
function num(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 摘要截断宽度：索引的用途是「判断要不要读这一节」，够看gist 即可（全文一次读取可达）。 */
const SUMMARY_MAX = 80;

/** 表内一行的摘要：转义竖线、压平空白、超宽截断并标 `…`。 */
function clip(summary) {
  const flat = String(summary ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim();
  if (!flat) return '—';
  return flat.length <= SUMMARY_MAX ? flat : `${flat.slice(0, SUMMARY_MAX - 1)}…`;
}

/**
 * 渲染生成块。
 *
 * @param {{files: Array<{path: string, tokens: number, lines: number, sections: Array<{anchor: string, level: number, startLine: number, endLine: number, tokens: number, summary: string}>}>}} index
 * @param {string} today `YYYY-MM-DD`（由调用方传，便于测试固定时点）
 */
export function renderMemoryIndexBlock(index, today) {
  const L = [];
  L.push(MEMORY_INDEX_START);
  const dailies = memoryDailies(index);
  if (dailies.length === 0) {
    L.push('（`memory/` 下暂无日记文件）');
    L.push(MEMORY_INDEX_END);
    return L.join('\n');
  }
  const total = dailies.reduce((n, f) => n + f.tokens, 0);
  L.push(
    `> 摘要层覆盖 **${dailies.length} 篇日记 / 合计 ${num(total)} tok**` +
      `（整读本块 ≈ 数十行；整读日记 = 万级 tok ⇒ 别整读）。`,
  );
  L.push('');

  for (const f of dailies) {
    const date = memoryDailyDate(f.path);
    const due = addDays(date, MEMORY_DIGEST_DAYS);
    const left = daysBetween(today, due);
    const dueText =
      left > 0 ? `**蒸馏到期 ${due}**（剩 ${left} 天）` : `**蒸馏已到期（${due}，已过期 ${-left} 天）**`;
    // 只列 `##` 级主题：level 1 是**整篇汇总**行（摘要恒空、无导航价值），level ≥ 3 的子节
    // 在 `ctx/index.json` 里（同源数据）——本块求「能一眼扫完」。
    const rows = f.sections.filter((s) => s.level === 2);
    L.push(`### \`${f.path}\` — ${num(f.tokens)} tok｜${rows.length} 节｜${dueText}`);
    L.push('');
    L.push('| 节 | 行（含首尾） | tok | 摘要（节首句摘取，**非**人工撰写） |');
    L.push('|---|---|---|---|');
    for (const s of rows) {
      const anchor = s.anchor.replace(/\|/g, '\\|');
      L.push(
        `| ${anchor} | ${s.startLine}–${s.endLine} | ${num(s.tokens)} | ${clip(s.summary)} |`,
      );
    }
    L.push('');
  }

  L.push('> **怎么用它读一节**：`read_file(path, offset = 行首, limit = 行尾 − 行首 + 1)`。');
  L.push(MEMORY_INDEX_END);
  return L.join('\n');
}

/** 首次创建时的**手写协议**骨架（之后只重写标记块，本骨架可由人继续演进）。 */
export function memoryIndexPreamble() {
  return [
    '# memory/ — 日志分级索引（WXG-T-068）',
    '',
    '> `memory/` 是跨会话的**运行时记忆**：`MEMORY.md` 是蒸馏后的长期笔记（常驻摘要层），',
    '> `YYYY-MM-DD.md` 是当日原始日志（详情层）。本文件是**日志的摘要层入口** ——',
    '> 目标是「先读摘要，命中后再读那一节」，而不是整读日记（单篇 5.6k–10.1k tok ✗）。',
    '',
    '## 1. 读取协议',
    '',
    '- **开工/需要回忆时**：先读本文件（含下方生成表），按摘要判断哪几节相关；',
    '- **命中后**：用表里的行区间只读那一节 —— 不要整读日记文件；',
    '- **更细粒度**：`##` 以下的 `###` 子节在 `ctx/index.json` 里（同源数据，本表只列到 `##`）。',
    '',
    '## 2. 文件分工',
    '',
    '| 文件 | 内容 | 读法 |',
    '|---|---|---|',
    '| `MEMORY.md` | 蒸馏后的**长期笔记**（约定 / 脚本 / 已知限制） | 常驻摘要层，直接读 |',
    '| `YYYY-MM-DD.md` | 当日原始日志（详情层，逐字节不动） | **按本表行区间读节**，勿整读 |',
    '| `INDEX.md` | 本文件：摘要层入口（生成块由 `ctx:build` 维护） | 先读这里 |',
    '| `archive/` | 满 30 天蒸馏后的归档（`memory:distill --write`） | 不进索引面；`git` 永久可查 |',
    '',
    '## 3. 生命周期（与 `docs/agent/memory-distill.md` 同一套）',
    '',
    '- 日志满 **30 天** ⇒ `pnpm run memory:distill`（dry-run）⇒ **先把长期有效内容蒸馏进 `MEMORY.md`**',
    '  ⇒ `pnpm run memory:distill --write` 归档。**蒸馏责任在人 / 会话**，脚本只做机械轮转。',
    '- 生成表里每篇标注「蒸馏到期」＝ 文件名日期 + 30 天：**到期不得靠 B 门豁免硬扛**（T-041 裁决）。',
    '- 全文归档后其摘要行会随索引自动消失（`memory/archive/` 命中 `SKIP_DIRS`）。',
    '',
    '## 4. 摘要表（自动生成）',
    '',
  ].join('\n');
}

/**
 * 把生成块 upsert 进现有文本：有标记块则**只替换块**，没有则追加到末尾。
 * 文件不存在时由调用方用 {@link memoryIndexPreamble} 起头。
 */
export function upsertMemoryIndex(existing, block) {
  const start = existing.indexOf(MEMORY_INDEX_START);
  const end = existing.indexOf(MEMORY_INDEX_END);
  if (start >= 0 && end > start) {
    return existing.slice(0, start) + block + existing.slice(end + MEMORY_INDEX_END.length);
  }
  const head = existing.replace(/\s*$/, '');
  return `${head}\n\n${block}\n`;
}
