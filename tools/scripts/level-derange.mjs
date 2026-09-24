#!/usr/bin/env node
/**
 * level-derange.mjs — 逐格阶式初盘构造（关卡内容管线 P2b，spec §0.2）。
 *
 * 三阶（+ §3.2 批2 插入的 甲′）：
 *   甲（全错位）= 循环左移 derange，前提 maxFreq ≤ ⌊N/2⌋；
 *   甲′（最大化错位 `max`）= 同一构造、同一极值，但**不要求** Hall 条件：
 *       本宫 `m_g > ⌊N_g/2⌋` 时接受 `F = max(0, 2m_g − N_g)` 颗强制就位（= 守恒下最优，
 *       不是退让；正本 levels-spec §2.3）⇒ 不再先退成 swaps。
 *   乙（swaps 退化）= ≤8 对异色可填格两两互换（k 尽量大）；
 *   丙（不可错位）= 无任何非恒等位移（tier='丙'，调用方整板 422 拒收）。
 *
 * ⚠️ 域 = **本宫**：`N`/`m` 一律是该宫的数（sliceBoard 纯几何裁剪、不接 misplaced，
 *   每宫各自守恒、各自取极值）；**不得跨宫搬珠**（§2.3-4）。
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
 * 甲 / 甲′：多重集错位（按色排序后整体循环左移 `m` = 主导色频位）。
 *
 * 固定点数恰为 `F = max(0, 2m − N)`、被错位格数 `M = N − F = min(N, 2(N−m))`
 * （与 `beads-gen.mjs::derange` 同一口径；X2 实测复核见本件测试）。差别只在**是否 bail**：
 *   · `mode='full'`（默认）：`m > ⌊N/2⌋` ⇒ `ok:false`（all-or-nothing，旧行为不改）；
 *   · `mode='max'`：不 bail，给出守恒下的极值盘（除 `N<2` / `m=N` 两种退化盘）。
 * @param {number[]} flat 色号数组（0=不可填，不参与 derange）
 * @param {'full'|'max'} mode
 * @returns {{ ok: boolean; misplaced?: number[]; N?: number; m?: number; M?: number;
 *             F?: number; M_max?: number; reason?: string }}
 */
export function derangeCell(flat, mode = 'full') {
  const cells = [];
  for (let i = 0; i < flat.length; i++) if (flat[i] > 0) cells.push(i);
  const N = cells.length;

  // 各色计数（不依赖 PAL_N，用 Map 动态统计）
  const cnt = new Map();
  for (const i of cells) cnt.set(flat[i], (cnt.get(flat[i]) ?? 0) + 1);
  let maxFreq = 0;
  for (const n of cnt.values()) if (n > maxFreq) maxFreq = n;
  const m = maxFreq;
  const M_max = Math.min(N, 2 * (N - m));
  const F = Math.max(0, 2 * m - N);
  const fail = (reason) => ({ ok: false, N, m, M: 0, F, M_max, reason }); // F/M_max 为理论值；M=0 = 本次未产出

  if (N < 2) return fail(`可填格 < 2 ⇒ M_max=${M_max}（N=${N}）`);
  if (m === N) return fail(`整盘单色（m=N=${N}）⇒ M_max=${M_max}，无任何异色可交换`);
  if (mode !== 'max' && m > Math.floor(N / 2))
    return fail(`主导色 ${m} > N/2=${Math.floor(N / 2)}，无法全错位（max 档可得 M_max=${M_max}、F=${F}）`);

  // 按色号升序（次级按原索引，确定性）
  const sorted = cells.slice().sort((a, b) => flat[a] - flat[b] || a - b);
  const seqColor = sorted.map((i) => flat[i]);
  const k = m;
  const misplaced = new Array(flat.length).fill(0);
  for (let j = 0; j < sorted.length; j++) misplaced[sorted[j]] = seqColor[(j + k) % N];

  // 自检：固定点数**恰等于**理论值 F（full 时 F=0 ⇒ 与旧「无固定点」断言等价）
  let fixed = 0;
  for (const i of cells) if (misplaced[i] === flat[i]) fixed++;
  if (fixed !== F)
    return fail(`断言失败：固定点 ${fixed} ≠ 理论值 F=${F}（N=${N}, m=${m}）`);
  return { ok: true, misplaced, N, m, M: N - fixed, F, M_max };
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
 * 四阶 wrapper（甲 → 甲′ → 乙 → 丙）：给一格 pattern rowstring[]，返回 tier + 初盘字段。
 * @param {string[]} pattern Cell-Level 的 pattern rowstrings
 * @returns {{ tier: '甲'|'甲max'|'乙'|'丙'; misplaced?: string[];
 *             swaps?: [number,number,number,number][]; M?: number; N?: number; F?: number; reason?: string }}
 */
export function buildCellInitial(pattern) {
  const { flat, cols, rows } = rowstringsToSolved(pattern);

  // 甲：全错位（m ≤ ⌊N/2⌋ 时 F=0、M=N，与 甲′ 等价 ⇒ 优先取它，档位名不变）
  const dr = derangeCell(flat);
  if (dr.ok) {
    const misplaced = solvedToRowstrings(dr.misplaced, pattern, cols, rows);
    return { tier: '甲', misplaced, M: dr.M, N: dr.N, F: dr.F };
  }

  // 甲′（§3.2 批2）：最大化错位 —— 本宫失衡不再直接退成 swaps，先取守恒下极值。
  // ⚠️ 不放宽任何硬约束：只在同一色多重集内重排（不改色）、可填轮廓逐格匹配；
  //   `M ≥ 1` 是入档前提（BOOT「错位 ≥1」闸），否则落乙/丙。
  const mx = derangeCell(flat, 'max');
  if (mx.ok && mx.M >= 1) {
    const misplaced = solvedToRowstrings(mx.misplaced, pattern, cols, rows);
    return { tier: '甲max', misplaced, M: mx.M, N: mx.N, F: mx.F };
  }

  // 乙：swaps 退化。
  // ⚠️ **本批不删乙**（任务单边界），但甲′ 插在中间后它在**本 wrapper 路径上已不可达**：
  //   甲 失败只可能是 `N<2` / `m=N`（单色）/ 断言错，前两者使 甲′ 同败且 `buildSwaps` 也配不出对
  //   （⇒ 丙），而 `m>N/2` 且多色时 甲′ 必成。`buildSwaps` 仍是导出 API（直接调用照旧可用）。
  //   是否清理 = 正本 T3（要先改 QA 判据），未决已上报主理人。
  const { swaps, count } = buildSwaps(flat, cols, rows);
  if (count > 0) return { tier: '乙', swaps };

  // 丙：不可错位
  return { tier: '丙', reason: mx.reason ?? dr.reason ?? '无任何非恒等位移' };
}
