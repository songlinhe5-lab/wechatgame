#!/usr/bin/env node
/**
 * level-derange.mjs — 逐格三阶初盘构造（关卡内容管线 P2b，spec §0.2）。
 *
 * 三阶：
 *   甲（全错位）= 循环左移 derange，前提 maxFreq ≤ ⌊N/2⌋；
 *   乙（swaps 退化）= ≤8 对异色可填格两两互换（k 尽量大）；
 *   丙（不可错位）= 无任何非恒等位移（tier='丙'，调用方整板 422 拒收）。
 *
 * ponytail: ~~beads-gen.mjs 有同算法（PAL_N 闭包版），刻意不共用（改动风险 > 收益）~~
 * **已还债**（§3.2 v1.55 / 正本 §5-A8）：两份表曾是「一个改、一个漏」的高危面
 * （本件持 12 枚表、Plate 出 12 色以上静默丢色）。现两个脚本共用
 * `./lib/bead-charset.mjs` 的一份表；算法本体仍各自保留（那是另一回事）。
 *
 * 无 IO，无 Math.random（L4）。
 */

import {
  BEAD_COLOR_CHARS,
  EMPTY_CHAR as VOID,
  LOCKED_CHAR as LOCKED,
  baseColorOfChar,
  charOfColor,
} from './lib/bead-charset.mjs';

/**
 * rowstring[] → {flat, cols, rows}。
 * `.`/`x` → 0（不可填）；`1-9`+`A-Z` → 1–35（表见 `lib/bead-charset.mjs`）。
 */
export function rowstringsToSolved(pattern) {
  const rows = pattern.length;
  const cols = pattern[0]?.length ?? 0;
  const flat = new Array(rows * cols).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // 旧版在此内联了第五份解码（`'1'..'9'` 区间 + `ch === 'A'` 特例），
      // 抬上限后「`B`–`Z` 静默归 0」就藏在这三行里 ⇒ 改调共享表。
      flat[r * cols + c] = baseColorOfChar(pattern[r][c]);
    }
  }
  return { flat, cols, rows };
}

/**
 * misplacedFlat[] 编码回 rowstring[]。
 * pattern 决定哪些格是 `x`/`.`（保留原位不变）；
 * 颜色按 misplaced 中出现的色号升序重映射到字符表下标（与 rowstringsToSolved 对偶）。
 */
export function solvedToRowstrings(misplacedFlat, pattern, cols, rows) {
  // 收集 misplaced 里出现的色号（升序），建立 colorToChar 映射
  const usedSet = new Set();
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const v = misplacedFlat[i * cols + j];
      if (v > 0) usedSet.add(v);
    }
  const used = Array.from(usedSet).sort((a, b) => a - b);
  const colorToChar = new Map(used.map((v, i) => [v, charOfColor(i + 1)]));

  const out = [];
  for (let r = 0; r < rows; r++) {
    let s = '';
    for (let c = 0; c < cols; c++) {
      const pch = pattern[r][c];
      if (pch === LOCKED) { s += LOCKED; continue; }
      if (pch === VOID) { s += VOID; continue; }
      const v = misplacedFlat[r * cols + c];
      s += v > 0 ? (colorToChar.get(v) ?? BEAD_COLOR_CHARS[0]) : VOID;
    }
    out.push(s);
  }
  return out;
}

/**
 * 甲：多重集全错位（按色排序后整体循环左移 maxFreq 位）。
 * 前提：maxFreq ≤ ⌊N/2⌋（Hall 定理）⇒ 每格新色 ≠ 原色（无固定点）。
 * @param {number[]} flat 色号数组（0=不可填，不参与 derange）
 * @returns {{ ok: boolean; misplaced?: number[]; reason?: string }}
 */
export function derangeCell(flat) {
  const cells = [];
  for (let i = 0; i < flat.length; i++) if (flat[i] > 0) cells.push(i);
  const N = cells.length;
  if (N < 2) return { ok: false, reason: '可填格 < 2' };

  // 各色计数（不依赖 PAL_N，用 Map 动态统计）
  const cnt = new Map();
  for (const i of cells) cnt.set(flat[i], (cnt.get(flat[i]) ?? 0) + 1);
  let maxFreq = 0;
  for (const n of cnt.values()) if (n > maxFreq) maxFreq = n;
  if (maxFreq > Math.floor(N / 2))
    return { ok: false, reason: `主导色 ${maxFreq} > N/2=${Math.floor(N / 2)}，无法全错位` };

  // 按色号升序（次级按原索引，确定性）
  const sorted = cells.slice().sort((a, b) => flat[a] - flat[b] || a - b);
  const seqColor = sorted.map((i) => flat[i]);
  const k = maxFreq;
  const misplaced = new Array(flat.length).fill(0);
  for (let j = 0; j < sorted.length; j++) misplaced[sorted[j]] = seqColor[(j + k) % N];

  // 自检：无固定点
  for (const i of cells) {
    if (misplaced[i] === flat[i])
      return { ok: false, reason: `断言失败：格 ${i} 错位后就位` };
  }
  return { ok: true, misplaced };
}

/**
 * 乙：找 ≤8 对异色可填格两两互换，返回 cell-local swaps。
 * k = min(8, 可配异色对数)，尽量大。
 * @param {number[]} flat 色号数组（0=不可填）
 * @param {number} cols 格宽
 * @param {number} _rows 格高（未直接用，保留签名对称性）
 * @returns {{ swaps: [number,number,number,number][]; count: number }}
 */
export function buildSwaps(flat, cols, _rows) {
  // 按色号分组（cell index = r*cols+c）
  const byColor = new Map();
  for (let i = 0; i < flat.length; i++) {
    if (flat[i] <= 0) continue;
    if (!byColor.has(flat[i])) byColor.set(flat[i], []);
    byColor.get(flat[i]).push(i);
  }
  const colors = Array.from(byColor.keys()).sort((a, b) => a - b);
  if (colors.length < 2) return { swaps: [], count: 0 };

  // 轮流从各色取格配对（保证异色，k 尽量大）
  const pools = colors.map((c) => byColor.get(c));
  const poolIdx = new Array(pools.length).fill(0); // 每色当前指针
  const swaps = [];

  for (let round = 0; round < 8; round++) {
    // 从第一个还有剩余格的色中取 a
    let a = -1, aCi = -1;
    for (let ci = 0; ci < pools.length; ci++) {
      if (poolIdx[ci] < pools[ci].length) { a = pools[ci][poolIdx[ci]]; aCi = ci; break; }
    }
    if (a < 0) break;
    // 从不同色中取 b
    let b = -1, bCi = -1;
    for (let ci = 0; ci < pools.length; ci++) {
      if (ci === aCi) continue;
      if (poolIdx[ci] < pools[ci].length) { b = pools[ci][poolIdx[ci]]; bCi = ci; break; }
    }
    if (b < 0) break;
    poolIdx[aCi]++;
    poolIdx[bCi]++;
    swaps.push([Math.floor(a / cols), a % cols, Math.floor(b / cols), b % cols]);
  }
  return { swaps, count: swaps.length };
}

/**
 * 三阶 wrapper：给一格 pattern rowstring[]，返回 tier + 初盘字段。
 * @param {string[]} pattern Cell-Level 的 pattern rowstrings
 * @returns {{ tier: '甲'|'乙'|'丙'; misplaced?: string[]; swaps?: [number,number,number,number][]; reason?: string }}
 */
export function buildCellInitial(pattern) {
  const { flat, cols, rows } = rowstringsToSolved(pattern);

  // 甲：全错位
  const dr = derangeCell(flat);
  if (dr.ok) {
    const misplaced = solvedToRowstrings(dr.misplaced, pattern, cols, rows);
    return { tier: '甲', misplaced };
  }

  // 乙：swaps 退化
  const { swaps, count } = buildSwaps(flat, cols, rows);
  if (count > 0) return { tier: '乙', swaps };

  // 丙：不可错位
  return { tier: '丙', reason: dr.reason ?? '无任何非恒等位移' };
}
