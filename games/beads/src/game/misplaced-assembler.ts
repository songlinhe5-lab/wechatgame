/**
 * 错位装配器 + `swaps` BOOT 校验器（Epic T-133 · E5 / WXG-T-139）。
 *
 * 真源：
 *   · `systems-index.md` **v1.23** §3.13 —— `MISPLACED_PAIRS_MIN/MAX = [1,8]`、
 *     交换构造法 `swaps: [[r1,c1,r2,c2], ...]`（可解性由可逆置换构造保证）、
 *     `cycleProfile`（v1.23 增补第二难度旋钮：偏 2-环短对 / 偏长环）。
 *   · `levels-spec.md` v1.2 §2.1 —— 错位布置 = pattern 全满 → 按 `swaps` 顺序
 *     对可填格珠两两交换；错位珠计数恒等式 `misplaced === 2 × swaps.length`。
 *   · §3.5 —— `LEVEL_TIME_OVERRIDE = clamp(k × 45s, 120, 420)`（时间按 k 定价）。
 *
 * ── 恒等式的诚实修订（**规格缺项，已回传主理人**）────────────────────────────
 * `levels-spec` §2.1 写「`misplaced === 2 × swaps.length` 在任意 swaps 下成立
 * （链式交换逐对累加）」——这句**不成立**。反例：3-环（A,B,C 三格链式交换
 * (A,B),(B,C)）产生 **3** 颗错位珠，而 swaps.length = 2 ⇒ 2×2 = 4 ≠ 3。
 *
 * 一般式（本模块断言的形态）：设置换分解为 `c` 个环、环长分别为 mᵢ，则
 *   `swaps.length = Σ(mᵢ − 1)`，`misplaced = Σ mᵢ`（要求每环内底色互异）
 *   ⇒ **`misplaced = swaps.length + c`**。
 * 全 2-环时 c = swaps.length ⇒ 退化为 §2.1 的 `2 × swaps.length`。
 *
 * 因此本模块同时断言两式：**一般式恒断言**；`2 × swaps.length` 在「全 2-环」
 * 局面下与一般式等价，故同样成立。**8 关数据一律按全 2-环（cell-disjoint 对）
 * 构造**（同时满足 §2.1 与 §3 表「错位珠总数 = 2k」），长环能力保留给
 * `cycleProfile` + playtest 调参（v1.23 明写 cycleProfile 不冻结）。
 *
 * 依赖方向：`levels.ts` → 本模块（**本模块不 import `levels.ts`**，避免
 * 校验器与关卡表相互 import 的环）。字符集解析不在本模块重写：§3.2 v1.55
 * 前这里是全仓四份独立解码表之一（与 `levels.ts` 同规则、但需人工同步），
 * 现统一改为 import `config/bead-charset.ts`（它只依赖 `config/tuning.ts`，
 * 不构成环；判据 X1）。
 */

import {
  CYCLE_LEN_LONG,
  CYCLE_LEN_MIXED,
  CYCLE_LEN_SHORT,
  MISPLACED_PAIRS_MAX,
  MISPLACED_PAIRS_MIN,
} from '../config/tuning.js';
import { colorIndexOfChar, isBeadCharsetChar } from '../config/bead-charset.js';
import type { BeadGrid } from '../entities/grid.js';
import type { Rng } from '@wxgame/framework';

/** 一对交换坐标 `[r1, c1, r2, c2]`（行/列均 0 起，pattern 行 0 = 顶行）。 */
export type Swap = readonly [number, number, number, number];

/**
 * 环长分布（v1.23 第二难度旋钮；levels JSON 建议值，**不冻结**）：
 *   · `short` —— 全 2-环（短对换，前期关）；
 *   · `mixed` —— 长短混合（奇数环 3-环、偶数环 2-环）；
 *   · `long`  —— 偏长环（目标环长 `CYCLE_LEN_LONG`，后期关）。
 */
export type CycleProfile = 'short' | 'mixed' | 'long';

/** 合法 profile 全集（校验器白名单）。 */
export const CYCLE_PROFILES: readonly CycleProfile[] = ['short', 'mixed', 'long'];

/** 类型收窄（levels JSON 是 `unknown` 入参，不能信）。 */
export function isCycleProfile(value: unknown): value is CycleProfile {
  return value === 'short' || value === 'mixed' || value === 'long';
}

/** profile → 目标环长（≥2；实际还会被「剩余对数 / 可用色数」钳）。 */
export function targetCycleLength(profile: CycleProfile): number {
  if (profile === 'short') return CYCLE_LEN_SHORT;
  if (profile === 'mixed') return CYCLE_LEN_MIXED;
  return CYCLE_LEN_LONG;
}

// ─────────────────────────────────────────────────────────── pattern 解析 ────

/** 与 `config/levels.ts` 同规则（0 = 不可填/无底色）。同源 `bead-charset`，不再造本地表（X1）。 */
function baseColorOfChar(ch: string): number {
  const idx = colorIndexOfChar(ch);
  return typeof idx === 'number' ? idx : 0;
}

/** 可填格（底色 > 0 的格；`.` / `x` 不算）。 */
export interface FillableCell {
  readonly row: number;
  readonly col: number;
  /** 底色 = 该格的目标色。 */
  readonly colorIdx: number;
}

/** 行主序收集可填格。 */
export function fillableCells(pattern: readonly string[]): FillableCell[] {
  const out: FillableCell[] = [];
  for (let r = 0; r < pattern.length; r++) {
    const row = pattern[r]!;
    for (let c = 0; c < row.length; c++) {
      const colorIdx = baseColorOfChar(row[c]!);
      if (colorIdx > 0) out.push({ row: r, col: c, colorIdx });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────── 生成（注入 rng）─

/** 生成结果：交换对 + 环分解 + 错位珠数（= Σ 环长）。 */
export interface MisplacedPlan {
  readonly swaps: Swap[];
  /** 每个环 = 平铺格索引（`row * cols + col`）数组，长度 ≥ 2，行主序升序。 */
  readonly cycles: readonly number[][];
  /** 错位珠数（构造保证 = Σ 环长）。 */
  readonly misplacedCount: number;
}

/**
 * 按 `k` 与 `cycleProfile` 生成交换对。
 *
 * 确定性：随机性**只来自注入 `rng`**（L4，禁 `Math.random`）；同 seed + 同
 * (pattern, k, profile) ⇒ 同一份 `swaps`。生成期一次性分配，**不在 update /
 * step / buildRenderModel 热路径上**。
 *
 * 构造：每个环取 `len` 个**底色互异**的格（`len ≥ 2`），链式交换
 * `(c0,c1),(c1,c2),…` ⇒ 一个 `len` 元轮换（每格均错位）。环消耗 `len − 1` 对；
 * 对数用满 k 即止。可用格/色不足时**提前停**（返回的对数 < k，调用方应
 * 用 `validateSwaps` 复核——数据面 8 关的对数由 JSON 显式给出，不受此影响）。
 */
export function generatePlan(
  pattern: readonly string[],
  pairs: number,
  profile: CycleProfile,
  rng: Rng,
): MisplacedPlan {
  const cols = pattern[0]?.length ?? 0;
  const cells = fillableCells(pattern);

  const k = Math.max(MISPLACED_PAIRS_MIN, Math.min(Math.floor(pairs), MISPLACED_PAIRS_MAX));

  // 底色桶（色 → 该色格索引栈），保证「环内底色互异」这一恒等式前提。
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < cells.length; i++) {
    const colorIdx = cells[i]!.colorIdx;
    let bucket = buckets.get(colorIdx);
    if (bucket === undefined) {
      bucket = [];
      buckets.set(colorIdx, bucket);
    }
    bucket.push(i);
  }
  const colorOrder = Array.from(buckets.keys());

  const swaps: Swap[] = [];
  const cycles: number[][] = [];
  let left = k;
  let cycleIndex = 0;
  while (left > 0) {
    const wanted =
      profile === 'mixed' && cycleIndex % 2 === 1 ? CYCLE_LEN_SHORT : targetCycleLength(profile);
    const len = Math.min(wanted, left + 1, colorOrder.length);
    if (len < 2) break;

    rng.shuffle(colorOrder);
    const cycle: number[] = [];
    for (const colorIdx of colorOrder) {
      if (cycle.length >= len) break;
      const bucket = buckets.get(colorIdx)!;
      if (bucket.length === 0) continue;
      cycle.push(bucket.pop()!);
    }
    if (cycle.length < 2) break; // 可填格 / 可用色耗尽

    cycle.sort((a, b) => a - b); // 行主序输出：可读、可快照、可复现
    cycles.push(cycle);
    for (let i = 0; i + 1 < cycle.length; i++) {
      const a = cycle[i]!;
      const b = cycle[i + 1]!;
      swaps.push([Math.floor(a / cols), a % cols, Math.floor(b / cols), b % cols]);
    }
    left -= cycle.length - 1;
    cycleIndex++;
  }

  let misplacedCount = 0;
  for (const cycle of cycles) misplacedCount += cycle.length;
  return { swaps, cycles, misplacedCount };
}

/** `generatePlan` 的薄封装：只要交换对。 */
export function generateSwaps(
  pattern: readonly string[],
  pairs: number,
  profile: CycleProfile,
  rng: Rng,
): Swap[] {
  return generatePlan(pattern, pairs, profile, rng).swaps;
}

// ─────────────────────────────────────────────────────────── 装配（纯函数）──

/** 装配结果：每格的初始珠色（行主序；0 = 无珠 / 不可填）。 */
export interface AssembledBoard {
  readonly rows: number;
  readonly cols: number;
  readonly beads: number[];
  /** 与 `countMisplaced` 一致：filled 且珠色 ≠ 底色的格数。 */
  readonly misplacedCount: number;
}

/**
 * pattern（= 正确解 / 底色）→ 按 `swaps` 数组序执行两两交换 ⇒ 初始错位局面。
 *
 * 可解性由构造保证：交换是可逆置换。越界 / 非可填格的交换项**跳过**（不写
 * 状态），随后由 `validateSwaps` 的恒等式断言抓出。
 */
export function assembleBoard(
  pattern: readonly string[],
  swaps: readonly Swap[],
): AssembledBoard {
  const rows = pattern.length;
  const cols = pattern[0]?.length ?? 0;
  const beads: number[] = [];
  for (let r = 0; r < rows; r++) {
    const row = pattern[r]!;
    for (let c = 0; c < cols; c++) beads.push(baseColorOfChar(row[c]!));
  }

  for (const swap of swaps) {
    const i1 = swap[0] * cols + swap[1];
    const i2 = swap[2] * cols + swap[3];
    if (i1 < 0 || i1 >= beads.length || i2 < 0 || i2 >= beads.length) continue;
    if (beads[i1]! <= 0 || beads[i2]! <= 0) continue; // 非可填格（. / x）
    const tmp = beads[i1]!;
    beads[i1] = beads[i2]!;
    beads[i2] = tmp;
  }

  return { rows, cols, beads, misplacedCount: countMisplaced(pattern, beads) };
}

/** `misplaced(cell) = filled 且 珠色 ≠ 底色`（§3.13）。 */
export function countMisplaced(pattern: readonly string[], beads: readonly number[]): number {
  const cols = pattern[0]?.length ?? 0;
  let n = 0;
  for (let r = 0; r < pattern.length; r++) {
    const row = pattern[r]!;
    for (let c = 0; c < row.length; c++) {
      const need = baseColorOfChar(row[c]!);
      if (need <= 0) continue;
      const bead = beads[r * cols + c] ?? 0;
      if (bead > 0 && bead !== need) n++;
    }
  }
  return n;
}

/**
 * 把装配结果写进 `BeadGrid`（BOOT 期一次性；**不在热路径**）。
 * 走 `grid.fill(r, c, bead)`——装配发生在玩法状态机接管之前，因此合法地绕过
 * retrieve/place 边（bead-grid §2.1）。@returns 装配后的错位珠数。
 *
 * 两种初盘真源（互斥，`misplaced` 优先）：
 *   · `misplaced` 存在 ⇒ 直读整盘初始珠色（全错位初盘，零 RNG，成片错豆）；
 *   · 否则 ⇒ 按 `swaps` 对 pattern 两两交换装配（旧语义）。
 */
export function applyMisplacedToGrid(
  grid: BeadGrid,
  pattern: readonly string[],
  swaps: readonly Swap[],
  misplaced?: readonly string[],
): number {
  const board =
    misplaced !== undefined && misplaced !== null
      ? assembleFromMisplaced(pattern, misplaced)
      : assembleBoard(pattern, swaps);
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const bead = board.beads[r * grid.cols + c] ?? 0;
      if (bead > 0) grid.fill(r, c, bead);
    }
  }
  return grid.misplacedCount;
}

// ─────────────────────────────────────────────────── 全错位初盘（misplaced）──

// 合法字符判定直接用 `isBeadCharsetChar`（上方 import）：§3.2 v1.55 前本处是一个
// 硬编 `.x1-9A` 的本地副本（全仓第四份解码表），保留包装只会再造一个漂移面。

/**
 * 全错位初盘 rowstring → 每格初始珠色（0 = 无珠 / 不可填）。**假定已通过
 * `validateMisplacedGrid`**（形状/轮廓/守恒）；越界格按 `.` 兜底为 0。
 */
export function assembleFromMisplaced(
  pattern: readonly string[],
  misplaced: readonly string[],
): AssembledBoard {
  const rows = pattern.length;
  const cols = pattern[0]?.length ?? 0;
  const beads: number[] = [];
  for (let r = 0; r < rows; r++) {
    const row = misplaced[r] ?? '';
    for (let c = 0; c < cols; c++) beads.push(baseColorOfChar(row[c] ?? '.'));
  }
  return { rows, cols, beads, misplacedCount: countMisplaced(pattern, beads) };
}

/**
 * BOOT 校验 `misplaced` 初盘（levels-spec §2.2 / systems-index §3.13 语义注）。
 * 只校「同色同数、仅位置错开」这一可解性前提，**不强制 100% 全错**（允许部分就位）。
 * @returns 错误串（沿用 `L{id} ...` 形态）；空数组 = 合法。
 */
export function validateMisplacedGrid(
  tag: string,
  pattern: readonly string[],
  misplaced: unknown,
): string[] {
  const errors: string[] = [];
  const rows = pattern.length;
  const cols = pattern[0]?.length ?? 0;

  if (!Array.isArray(misplaced)) {
    errors.push(`${tag}: misplaced 缺失或非数组`);
    return errors;
  }
  if (misplaced.length !== rows) {
    errors.push(`${tag}: misplaced 行数 ${misplaced.length} ≠ pattern 行数 ${rows}`);
    return errors;
  }

  // 形状 + 字符集 + 可填轮廓逐格匹配 + 每色守恒。
  const patCount = new Map<number, number>();
  const misCount = new Map<number, number>();
  let misplacedCells = 0;
  for (let r = 0; r < rows; r++) {
    const prow = pattern[r]!;
    const mrow = misplaced[r] as unknown;
    if (typeof mrow !== 'string') {
      errors.push(`${tag} row${r}: misplaced 行须为字符串`);
      continue;
    }
    if (mrow.length !== cols) {
      errors.push(`${tag} row${r}: misplaced 宽度 ${mrow.length} ≠ cols ${cols}`);
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const pch = prow[c]!;
      const mch = mrow[c]!;
      if (!isBeadCharsetChar(mch)) {
        errors.push(`${tag} row${r} col${c}: misplaced 非法字符 "${mch}"`);
        continue;
      }
      const pc = baseColorOfChar(pch); // 0 = 不可填（. / x）
      const mc = baseColorOfChar(mch);
      if ((pc > 0) !== (mc > 0)) {
        errors.push(
          `${tag} row${r} col${c}: 可填轮廓与 pattern 不匹配（pattern=${pc > 0 ? '可填' : '空'} misplaced=${mc > 0 ? '可填' : '空'}）`,
        );
        continue;
      }
      if (pc > 0) {
        patCount.set(pc, (patCount.get(pc) ?? 0) + 1);
        misCount.set(mc, (misCount.get(mc) ?? 0) + 1);
        if (mc !== pc) misplacedCells++;
      }
    }
  }

  // 每色珠数守恒（可解性前提）：初盘与目标盘同色同数。
  // ⚠️ 不用 `[...map.keys()]`——Cocos ES5 会把非数组可迭代对象的展开编译成不展开的
  // concat 形式（ADR-0012 / check-es5-spread）；改 Array.from 显式物化。
  const colors = new Set<number>(
    Array.from(patCount.keys()).concat(Array.from(misCount.keys())),
  );
  for (const color of colors) {
    const a = patCount.get(color) ?? 0;
    const b = misCount.get(color) ?? 0;
    if (a !== b) {
      errors.push(`${tag}: 色 ${color} 珠数不守恒（pattern ${a} ≠ misplaced ${b}）——初盘不可解`);
    }
  }

  // 至少 1 颗错位（否则初盘 = 已解，无玩法）。
  if (errors.length === 0 && misplacedCells < 1) {
    errors.push(`${tag}: misplaced 无任何错位格（初盘已全就位 = 无玩法）`);
  }

  return errors;
}

// ─────────────────────────────────────────────────────────── 环分解 ─────────

/**
 * 交换图的连通分量分解（并查集）。
 *
 * 语义提醒：分量 = 环，**仅当**该分量是「链」（对数 = 格数 − 1 且最大度 ≤ 2）。
 * 分叉（星）/ 闭环会破坏珠色守恒（同一颗珠被复制到两格），由 `validateSwaps`
 * 拒收——所以这里只是分量，环属性由校验器裁定。
 */
export function decomposeCycles(swaps: readonly Swap[], cols: number): number[][] {
  const parent = new Map<number, number>();
  const degree = new Map<number, number>();

  const add = (x: number): void => {
    if (!parent.has(x)) {
      parent.set(x, x);
      degree.set(x, 0);
    }
  };
  const find = (x: number): number => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (cur !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  for (const swap of swaps) {
    const a = swap[0] * cols + swap[1];
    const b = swap[2] * cols + swap[3];
    // ⚠️ 形状非法的 swap（少元素/含非数）会算出 NaN —— NaN 作 Map 键后
    // `find()` 的 `parent.get(root) !== root` 因 NaN !== NaN 恒真 ⇒ 死循环
    // （WXG-T-139 实测，被「坐标越界」用例引爆）。非法项在此跳过，错误由
    // validateSwaps 的静态规则层报出。
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) continue;
    add(a);
    add(b);
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  const groups = new Map<number, number[]>();
  for (const x of parent.keys()) {
    const root = find(x);
    let group = groups.get(root);
    if (group === undefined) {
      group = [];
      groups.set(root, group);
    }
    group.push(x);
  }

  const cycles: number[][] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a - b);
    cycles.push(group);
  }
  cycles.sort((a, b) => a[0]! - b[0]!);
  return cycles;
}

// ─────────────────────────────────────────────────────────── BOOT 校验器 ────

/** `validateSwaps` 的返回：错误串（沿用 `L{id} row{i} col{j}:` 形态）。 */
export function validateSwaps(
  tag: string,
  pattern: readonly string[],
  swaps: unknown,
  cycleProfile?: unknown,
): string[] {
  const errors: string[] = [];
  const rows = pattern.length;
  const cols = pattern[0]?.length ?? 0;

  if (!Array.isArray(swaps)) {
    errors.push(`${tag}: swaps 缺失或非数组（levels-spec v1.2 必需字段）`);
    return errors;
  }

  // ① 对数 ∈ [MISPLACED_PAIRS_MIN, MISPLACED_PAIRS_MAX]（§3.13）
  const k = swaps.length;
  if (k < MISPLACED_PAIRS_MIN || k > MISPLACED_PAIRS_MAX) {
    errors.push(`${tag}: swaps 对数 ${k} 不在 [${MISPLACED_PAIRS_MIN}, ${MISPLACED_PAIRS_MAX}]`);
  }

  // ② 逐对静态规则：四元整数 / 坐标可填 / 两格不同；同时模拟装配取「交换时珠色」。
  const base = assembleBoard(pattern, []).beads; // 正确解（= 底色）
  const current = base.slice();
  let legalSwaps = 0;

  for (let i = 0; i < swaps.length; i++) {
    const pair: unknown = swaps[i];
    if (!Array.isArray(pair) || pair.length !== 4) {
      errors.push(`${tag} swaps[${i}]: 需为 [r1,c1,r2,c2] 四元数组`);
      continue;
    }
    const nums: number[] = [];
    let shapeOk = true;
    for (const v of pair) {
      if (typeof v !== 'number' || !Number.isInteger(v)) shapeOk = false;
      nums.push(typeof v === 'number' ? v : 0);
    }
    if (!shapeOk) {
      errors.push(`${tag} swaps[${i}]: 坐标须为整数`);
      continue;
    }
    const r1 = nums[0]!;
    const c1 = nums[1]!;
    const r2 = nums[2]!;
    const c2 = nums[3]!;

    if (r1 < 0 || r1 >= rows || c1 < 0 || c1 >= cols || r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) {
      errors.push(`${tag} swaps[${i}] row${r1} col${c1}: 坐标越界（棋盘 ${rows}×${cols}）`);
      continue;
    }
    const i1 = r1 * cols + c1;
    const i2 = r2 * cols + c2;
    if (base[i1]! <= 0) {
      errors.push(`${tag} swaps[${i}] row${r1} col${c1}: 非可填格（. 或 x）`);
      continue;
    }
    if (base[i2]! <= 0) {
      errors.push(`${tag} swaps[${i}] row${r2} col${c2}: 非可填格（. 或 x）`);
      continue;
    }
    if (i1 === i2) {
      errors.push(`${tag} swaps[${i}] row${r1} col${c1}: 两格相同`);
      continue;
    }
    if (current[i1]! === current[i2]!) {
      errors.push(
        `${tag} swaps[${i}] row${r1} col${c1}: 与 row${r2} col${c2} 珠色相同（交换无效）`,
      );
      continue;
    }

    const tmp = current[i1]!;
    current[i1] = current[i2]!;
    current[i2] = tmp;
    legalSwaps += 1;
  }

  // ③ 错位珠恒等式（**一般式**，levels-spec §2.1）：misplaced 总数 ===
  //    swaps 对数 + 环数（2-环特例退化为 2×swaps）。交换是可逆置换（真交换，
  //    非复制）⇒ 任意 swaps 序列珠色守恒；「歪打正着就位」（如同底色轮换）
  //    会让恒等式失配 ⇒ 在此统一拒收。旧稿的「链形/分叉」「环内底色重复」
  //    两条自造判据由此取代（其「分叉=复制珠」模型与真交换语义矛盾）。
  const components = decomposeCycles(swaps as Swap[], cols);
  {
    const actual = countMisplaced(pattern, current);
    const expected = swaps.length + components.length;
    if (actual !== expected) {
      errors.push(
        `${tag}: 错位珠数 ${actual} ≠ swaps 对数 ${swaps.length} + 环数 ${components.length}（=${expected}）——存在交换后歪打正着就位的珠`,
      );
    }
  }

  // ⑤ cycleProfile：白名单 + 与实际环长分布一致（数据自洽性）。
  if (cycleProfile !== undefined) {
    if (!isCycleProfile(cycleProfile)) {
      errors.push(`${tag}: cycleProfile 非法（${String(cycleProfile)}），应为 short|mixed|long`);
    } else {
      let maxLen = 0;
      for (const component of components) if (component.length > maxLen) maxLen = component.length;
      if (cycleProfile === 'short' && maxLen > CYCLE_LEN_SHORT) {
        errors.push(`${tag}: cycleProfile=short 与实际最长环 ${maxLen} 矛盾`);
      }
      if (cycleProfile === 'mixed' && (maxLen < CYCLE_LEN_MIXED || maxLen > CYCLE_LEN_MIXED + 1)) {
        errors.push(`${tag}: cycleProfile=mixed 与实际最长环 ${maxLen} 矛盾（应为 3 或 4）`);
      }
      if (cycleProfile === 'long' && maxLen < CYCLE_LEN_MIXED + 1) {
        errors.push(`${tag}: cycleProfile=long 与实际最长环 ${maxLen} 矛盾（应 ≥ 4）`);
      }
    }
  }

  return errors;
}
