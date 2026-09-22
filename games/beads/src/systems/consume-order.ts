/**
 * 组珠消费序（剥皮序）—— bead-grid §2.2 / §2.3 路径 A（v2.5 · WXG-T-186 用户裁定）。
 *
 * 旧口径（v2.4 · WXG-T-183）= 「距**选豆点**切比雪夫升序，平局行主序」，是**几何**距离；
 * 而组的定义（`collectMisplacedGroup`）是 8 向**连通**块。几何近 ≠ 连通近，两条必然后果：
 * ① 组一拐弯 / 中间有缺口，就会跳过缺口先吃对岸珠（玩家读到「隔空取物」）；
 * ② 同圈层一律行主序裁决 ⇒ 最左上的珠最先被吃，与「从手边一片揭起、最远的留到最后」相反。
 *
 * 本函数把「最近」改成**沿组连通的图上距离**（BFS 层号），并叠三条序约束（优先级写死）：
 *
 * | 级 | 规则 | 性质 |
 * |---|---|---|
 * | 1 | 候选必须与「已揭起区」8 向邻接 | **硬** ⇒ 全程不隔空取物（构造性保证） |
 * | 2 | 优先取「删掉后剩余仍一整片」者（= 非割点） | 软 ⇒ 尽量不吃散；全池皆桥时让步 |
 * | 3 | 同层内「仍有未吃下层邻居」的引路珠押后 | 软 ⇒ 末端珠先吃、引路珠最后吃 |
 * | 4 | 层号 ↑ ⇒ 行主序 ↑ | 确定性平局 |
 *
 * 1 与 2 不可兼得（「往外揭」迟早要吃桥接珠），故让步方向固定为 2 让步。
 * 消费序**只在拾取时算一次**（一次点击只取前缀），直填与取回落槽共用 ⇒ 两路口径一致
 * 由「同一个函数产出同一份序」保证，不靠两处写成一样。
 *
 * 复杂度 O(n²)：每步一次迭代式 Tarjan 求割点 = O(n)，共 n 步；候选前沿用有序数组增量
 * 维护（不每步重建）。实测（Node，12×12 = 144 颗整片 0.7ms、18×18 = 324 颗 3.3ms）⇒
 * 输入路径调用（一次拾取一次），非每帧热路径 ⇒ 允许一次性预分配 TypedArray
 * （`planGroupFill` / `collectMisplacedGroup` 同判例）。
 */

import type { BeadGrid } from '../entities/grid.js';

export interface GroupCell {
  readonly row: number;
  readonly col: number;
}

/** 8 邻域固定序（上→下、左→右），与 `collectMisplacedGroup` / `planGroupFill` 同口径。 */
const DELTAS: readonly (readonly [number, number])[] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

/**
 * 算出整组的消费序（含选豆点自身，恒在首位）。
 *
 * @param grid 只取 `rows` / `cols` 作边界（成员集合由 `cells` 给定，不复核格状态）
 * @param anchorRow/anchorCol 选豆点 = 拾取那一下的坐标（v2.4 裁定：建立后恒定）
 * @param cells 组成员（`collectMisplacedGroup` 的返回值，按构造 8 向连通）
 * @returns 消费序；长度 = `cells.length`，元素为 `cells` 的同坐标对象
 */
export function planConsumeOrder(
  grid: BeadGrid,
  anchorRow: number,
  anchorCol: number,
  cells: readonly GroupCell[],
): GroupCell[] {
  const rows = grid.rows;
  const cols = grid.cols;
  const size = rows * cols;
  const anchor = anchorRow * cols + anchorCol;
  const byIdx = new Map<number, GroupCell>();
  const alive = new Uint8Array(size);
  for (const c of cells) {
    const i = c.row * cols + c.col;
    byIdx.set(i, c);
    alive[i] = 1;
  }
  alive[anchor] = 1; // 防御面：锚必属组（`collectMisplacedGroup` 含锚）
  byIdx.set(anchor, byIdx.get(anchor) ?? { row: anchorRow, col: anchorCol });

  // ── 层号 = 从选豆点沿组成员 8 邻域的 BFS 距离（图上距离，替代旧几何切比雪夫）
  const layer = new Int32Array(size).fill(-1);
  const bfsQ = new Int32Array(size);
  let head = 0;
  let tail = 0;
  layer[anchor] = 0;
  bfsQ[tail++] = anchor;
  while (head < tail) {
    const v = bfsQ[head++]!;
    const vr = (v / cols) | 0;
    const vc = v % cols;
    for (const [dr, dc] of DELTAS) {
      const r = vr + dr;
      const c = vc + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const m = r * cols + c;
      if (!alive[m] || layer[m] !== -1) continue;
      layer[m] = layer[v]! + 1;
      bfsQ[tail++] = m;
    }
  }
  const far = cells.length; // 不可达者（理论不发生）排到最后
  for (let i = 0; i < size; i++) if (alive[i] && layer[i] === -1) layer[i] = far;

  // ── 有序候选前沿（按 层号↑ ⇒ 下标↑ 升序）：进过一次即常驻，不再每步重建
  const front = new Int32Array(size);
  const inFront = new Uint8Array(size);
  let fl = 0;
  const precedes = (a: number, b: number): boolean =>
    layer[a]! !== layer[b]! ? layer[a]! < layer[b]! : a < b;
  const insert = (v: number): void => {
    if (inFront[v]) return;
    inFront[v] = 1;
    let lo = 0;
    let hi = fl;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (precedes(front[mid]!, v)) lo = mid + 1;
      else hi = mid;
    }
    front.copyWithin(lo + 1, lo, fl);
    front[lo] = v;
    fl++;
  };
  const remove = (v: number): void => {
    let i = 0;
    while (i < fl && front[i] !== v) i++;
    if (i < fl) {
      front.copyWithin(i, i + 1, fl);
      fl--;
    }
    inFront[v] = 0;
  };

  // ── Tarjan 工作区（整次调用共用，零逐步分配）
  const disc = new Int32Array(size);
  const low = new Int32Array(size);
  const par = new Int32Array(size);
  const cursor = new Int32Array(size);
  const stack = new Int32Array(size);
  const cut = new Uint8Array(size);

  /**
   * 一次遍历标出「当前存活集」G[S] 的全部割点（写 `cut`），返回 S 是否仍一整片。
   * 网格图 |E| ≤ 4|V| ⇒ O(n)。`cut[v] = 1` ⇔ 吃掉 v 会把剩余拆成两块。
   */
  const cutAll = (): boolean => {
    let timer = 0;
    let comps = 0;
    for (const i of byIdx.keys()) {
      if (!alive[i] || disc[i]) continue;
      comps++;
      let sp = 0;
      let rootChildren = 0;
      disc[i] = ++timer;
      low[i] = timer;
      par[i] = -1;
      cursor[i] = 0;
      stack[sp++] = i;
      while (sp > 0) {
        const v = stack[sp - 1]!;
        const vr = (v / cols) | 0;
        const vc = v % cols;
        let descended = false;
        while (cursor[v]! < 8) {
          const [dr, dc] = DELTAS[cursor[v]!]!;
          cursor[v]!++;
          const r = vr + dr;
          const c = vc + dc;
          if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
          const m = r * cols + c;
          if (!alive[m]) continue;
          if (!disc[m]) {
            par[m] = v;
            if (v === i) rootChildren++;
            disc[m] = ++timer;
            low[m] = timer;
            cursor[m] = 0;
            cut[m] = 0;
            stack[sp++] = m;
            descended = true;
            break;
          } else if (m !== par[v]) {
            if (disc[m]! < low[v]!) low[v] = disc[m];
          }
        }
        if (descended) continue;
        sp--;
        if (sp > 0) {
          const p = stack[sp - 1]!;
          if (low[v]! < low[p]!) low[p] = low[v];
          if (p !== i && low[v]! >= disc[p]!) cut[p] = 1;
        } else if (rootChildren > 1) {
          cut[i] = 1;
        }
      }
    }
    return comps === 1;
  };

  /** 该珠是否还牵着「更深层」的未吃珠（= 引路珠；优先级 3 押后者）。 */
  const feedsDeeper = (v: number): boolean => {
    const vr = (v / cols) | 0;
    const vc = v % cols;
    for (const [dr, dc] of DELTAS) {
      const r = vr + dr;
      const c = vc + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const m = r * cols + c;
      if (alive[m] && layer[m] === layer[v]! + 1) return true;
    }
    return false;
  };

  const out: GroupCell[] = [];
  let remaining = 0;
  for (let i = 0; i < size; i++) if (alive[i]) remaining++;
  if (remaining === 0) return out;

  // 选豆点恒为序首（消费从手边揭起）；此后「剩余是否仍一整片」一旦破掉就不再试——
  // 组已碎成多岛时「不吃散」无从谈起，退回优先级 4 的纯就近序。
  let whole = true;
  const take = (v: number): void => {
    remove(v);
    alive[v] = 0;
    remaining--;
    out.push(byIdx.get(v)!);
    const vr = (v / cols) | 0;
    const vc = v % cols;
    for (const [dr, dc] of DELTAS) {
      const r = vr + dr;
      const c = vc + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const m = r * cols + c;
      if (alive[m]) insert(m);
    }
  };
  take(anchor);

  while (remaining > 0) {
    let pick = -1;
    if (fl === 0) {
      // 前沿空 = 剩余已不在已揭起区边上（防御面）⇒ 按行主序跳过去，此后不再判
      for (let i = 0; i < size && pick < 0; i++) if (alive[i]) pick = i;
      whole = false;
    } else if (!whole) {
      pick = front[0]!;
    } else {
      for (let i = 0; i < size; i++) {
        disc[i] = 0;
        cut[i] = 0;
      }
      if (!cutAll()) {
        pick = front[0]!;
        whole = false;
      } else {
        let firstSafe = -1;
        for (let i = 0; i < fl; i++) {
          const v = front[i]!;
          if (cut[v]) continue; // 优先级 2：吃了会散 ⇒ 押后
          if (firstSafe < 0) firstSafe = v;
          if (!feedsDeeper(v)) { pick = v; break; } // 优先级 3：引路珠再押后
        }
        if (pick < 0) pick = firstSafe >= 0 ? firstSafe : front[0]!;
        if (firstSafe < 0) whole = false; // 全池皆桥 ⇒ 宁可吃散，此后不再判
      }
    }
    take(pick);
  }
  return out;
}
