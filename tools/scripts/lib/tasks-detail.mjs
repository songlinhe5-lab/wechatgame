/**
 * tasks-detail.mjs — `production/TASKS-DETAIL.md` 的解析 / 序列化（WXG-T-064 / WXG-T-065）。
 *
 * **单一真源**：`check-tasks.mjs`（配对门 + `--prune`）与 `archive-tasks.mjs`（成对搬运）
 * 都走这里。两边各写一套切分逻辑必然漂移，而漂移的后果是**丢任务正文**（静默、不可接受）。
 *
 * ── 文件形状（WXG-T-064 迁移确定的形状）────────────────────────────────────────
 *
 *   # WXG 任务台账 · 详情（标题制正文侧）
 *   > 前言块（为什么拆 / 怎么读 / 配对纪律）
 *   ---
 *   ## WXG-T-048
 *   - **名称**：…
 *   ---
 *   ## WXG-T-049
 *   …
 *
 * 约定：
 * • **preamble** = 首个 `## WXG-T-` 之前的一切（含紧随其后的 `---` 分隔线，序列化时统一重建）；
 * • **section** = 从 `## WXG-T-0NN` 到「下一个分隔线 / 下一个标题 / 文件末」（不含分隔线）；
 * • 正文里若出现 `---` 行：只可能落在节**内部**，本模块只在**节尾**剥离分隔线，故不受影响；
 * • `serializeDetail(parseDetail(x))` 对规范化文件**幂等**（归档器与 prune 都靠这个性质不做无谓改写）。
 */

/**
 * 详情归档文件首次创建时的头（`archive-tasks.mjs` 写入，`check-tasks.mjs --prune` 也用）。
 * 覆盖范围必须写清楚：标题制拆分（WXG-T-064）之前的归档行**没有**独立小节。
 */
export const DETAIL_ARCHIVE_HEADER = [
  '# WXG 任务台账 · 详情归档（tasks:archive 维护，勿手工编辑）',
  '',
  '> 由 `pnpm run tasks:archive`（tools/scripts/archive-tasks.mjs）从 `production/TASKS-DETAIL.md`',
  '> **成对搬入**：主表行进 `TASKS-archive.md` 的同一批，其详情小节进本文件（WXG-T-065）。',
  '> 本文件**不进 ctx 索引面**（`production/archive/` 命中 `lib/context-index.mjs` SKIP_DIRS，WXG-T-029 先例）。',
  '>',
  '> ⚠️ **覆盖范围**：只覆盖标题制拆分（WXG-T-064）之后的归档。更早归档的行（WXG-T-001…047）',
  '> 没有独立小节——那时主表还是详情制，**正文随行留在 `TASKS-archive.md` 里，没有丢失**。',
  '>',
  '> 取用：按 `## WXG-T-0NN` 定位，或直接 grep 任务号。',
].join('\n');

/** 节标题：`## WXG-T-0NN`（仅认这一种形状，避免误切正文里的 `##`）。 */
const HEADING_RE = /^##\s+(WXG-T-\d+)\s*$/;
/** 节分隔线。 */
const RULE_RE = /^---\s*$/;

/**
 * 解析详情文件。
 * @param {string} text
 * @returns {{ preamble: string, sections: Array<{ id: string, block: string }> }}
 */
export function parseDetail(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const heads = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = HEADING_RE.exec(lines[i]);
    if (m) heads.push({ id: m[1], line: i });
  }
  if (heads.length === 0) {
    return { preamble: lines.join('\n').trimEnd(), sections: [] };
  }

  // preamble：首个标题之前，回退掉尾部的空行与分隔线（序列化时重建）。
  let pEnd = heads[0].line;
  while (pEnd > 0 && lines[pEnd - 1].trim() === '') pEnd -= 1;
  if (pEnd > 0 && RULE_RE.test(lines[pEnd - 1])) pEnd -= 1;
  const preamble = lines.slice(0, pEnd).join('\n').trimEnd();

  const sections = [];
  for (let k = 0; k < heads.length; k += 1) {
    const start = heads[k].line;
    const limit = k + 1 < heads.length ? heads[k + 1].line : lines.length;
    let e = limit;
    while (e > start && lines[e - 1].trim() === '') e -= 1;
    if (e > start && RULE_RE.test(lines[e - 1])) e -= 1;
    while (e > start && lines[e - 1].trim() === '') e -= 1;
    sections.push({ id: heads[k].id, block: lines.slice(start, e).join('\n').trimEnd() });
  }
  return { preamble, sections };
}

/**
 * 序列化回文件文本（`preamble` 与各节之间统一用 `\n\n---\n\n` 连接，末尾一个换行）。
 * @param {{ preamble: string, sections: Array<{ id: string, block: string }> }} parsed
 */
export function serializeDetail({ preamble, sections }) {
  const parts = [String(preamble).trimEnd()];
  for (const s of sections) parts.push(String(s.block).trimEnd());
  return `${parts.join('\n\n---\n\n')}\n`;
}

/** 节 id 列表（按文件内出现顺序）。 */
export function detailSectionIds(parsed) {
  return parsed.sections.map((s) => s.id);
}

/**
 * 从详情里**摘出**指定 id 的节（顺序保持文件内原序）。
 * @returns {{ kept: object, taken: Array<{ id: string, block: string }> }}
 */
export function takeDetailSections(parsed, ids) {
  const want = new Set(ids);
  const taken = [];
  const keptSections = [];
  for (const s of parsed.sections) {
    if (want.has(s.id)) taken.push(s);
    else keptSections.push(s);
  }
  return { kept: { preamble: parsed.preamble, sections: keptSections }, taken };
}

/** 批量追加节（用于归档文件：新节接在末尾，保持原 block 逐字节不变）。 */
export function appendDetailSections(parsed, sections) {
  return { preamble: parsed.preamble, sections: [...parsed.sections, ...sections] };
}
