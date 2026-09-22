// WXG-T-182 · G-3 取证 —— 共用夹具 / 探针 / 机器人（temp/ 临时件，非生产码）。
//
// 铁律：本文件**不复制任何判定逻辑**。所有裁决都通过 `BeadsGame` 的公开命令
// （`goToLevel` / `selectBoardBead` / `retrieveSelectedGroup` / `selectTraySlot` /
// `tapGridCell` / `usePowerup`）落到生产实现（`systems/retrieve.ts`、
// `systems/placement.ts`、`entities/tray.ts`、`entities/grid.ts`）。
// 唯一直接 import 的生产函数是 `collectMisplacedGroup`（**只读**度量组大小；它是
// 玩法组选的同一段真码，不是复刻）。

// 归档重锚（2026-09-21）：本文件原住 `temp/`，说明符为 `../games/beads/…`；归档到
// `games/beads/design/forensics/g3/` 后按新位重锚为 `../../../…`（**仅路径，逻辑零改**）。
import { createBeadsHarness, simpleTestLevel, type Harness } from '../../../tests/helpers.js';
import { collectMisplacedGroup, type BeadGrid } from '../../../src/entities/grid.js';
import { fitCamera } from '../../../src/systems/board-camera.js';
import {
  DESIGN_W,
  TRAY_COLS,
  gridLayoutFor,
  trayLayout,
  TRAY_BASE_SLOTS,
  type BoardCamera,
} from '../../../src/config/tuning.js';
import type { BeadsGame } from '../../../src/game/beads-game.js';

const CHAR = '123456789A';

// ───────────────────────────────────────────────────────── 盘面构造（母版侧）

/** 盘面 = 12×12 密集（无 void / 无 locked）：`base` = 底色（1..8），行主序。 */
export interface DenseBoard {
  readonly rows: number;
  readonly cols: number;
  readonly base: number[];
  readonly beads: number[];
  readonly maxFreq: number;
}

export function hist(colors: readonly number[], kinds = 8): number[] {
  const h = new Array(kinds).fill(0);
  for (const c of colors) if (c >= 1) h[c - 1]++;
  return h;
}

/**
 * 新模型装配法（同 `temp/beads-gen.mjs` spike）：可填格**按色排序**（同色内行主序），
 * 整列**循环左移 maxFreq** ⇒ 每格拿到的珠色 = 排序列里往后 `maxFreq` 位的那颗。
 * `maxFreq ≤ ⌊N/2⌋`（= `MISPLACED_COLOR_CAP` 0.5 约束）时**无固定点** ⇒ 全错位。
 * 不满足时返回 null（生成器应回退重排，本取证只判定不发明）。
 */
export function derangeShift(base: readonly number[]): number[] | null {
  const n = base.length;
  const h = hist(base);
  const maxFreq = Math.max(...h);
  if (maxFreq > Math.floor(n / 2)) return null; // 违反 MISPLACED_COLOR_CAP
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push(i);
  order.sort((a, b) => base[a]! - base[b]! || a - b);
  const seq = order.map((i) => base[i]!);
  const beads = new Array(n).fill(0);
  for (let j = 0; j < n; j++) beads[order[j]!] = seq[(j + maxFreq) % n]!;
  for (let i = 0; i < n; i++) if (beads[i] === base[i]) return null; // 自检：不得有就位珠
  return beads;
}

export function makeBoard(rows: number, cols: number, base: number[]): DenseBoard | null {
  const beads = derangeShift(base);
  if (!beads) return null;
  const h = hist(base);
  return { rows, cols, base, beads, maxFreq: Math.max(...h) };
}

// ─────────────────────────────────────────────────── 母版布局（研究用生成器）

export type LayoutKind =
  | 'stripes' // 竖条带：同色 12×w 连通 ⇒ 巨块
  | 'blocks' // k×k 方块拼贴 ⇒ 中块
  | 'dither' // 逐格散点（确定性伪随机洗牌）⇒ 小块
  | 'rows' // 横条带
  | 'snake'; // 单一连通蛇形路径（可控块尺寸 B）

/** 确定性洗牌（L4 口径：不用 Math.random；Fisher-Yates + 线性同余种子）。 */
function detShuffle(arr: number[], seed: number): void {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

/**
 * 造 12×12 密集底色矩阵。`colors` = 色数；`blob` = 目标同色连通块尺寸（`snake` 用）。
 * @returns 底色数组（行主序，1..colors），每色至少 1 格。
 */
export function layoutBase(
  rows: number,
  cols: number,
  colors: number,
  kind: LayoutKind,
  seed = 7,
  blob = 9,
): number[] {
  const n = rows * cols;
  const base = new Array(n).fill(1);
  if (kind === 'stripes') {
    const w = Math.ceil(cols / colors);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) base[r * cols + c] = (Math.floor(c / w) % colors) + 1;
  } else if (kind === 'rows') {
    const h = Math.ceil(rows / colors);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) base[r * cols + c] = (Math.floor(r / h) % colors) + 1;
  } else if (kind === 'blocks') {
    const k = Math.max(2, Math.round(Math.sqrt((n / colors) * 0.5)));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const bx = Math.floor(c / k);
        const by = Math.floor(r / k);
        base[r * cols + c] = ((by * Math.ceil(cols / k) + bx) % colors) + 1;
      }
  } else if (kind === 'dither') {
    const idx: number[] = [];
    for (let i = 0; i < n; i++) idx.push(i);
    detShuffle(idx, seed);
    for (let i = 0; i < n; i++) base[idx[i]!] = (i % colors) + 1;
  } else {
    // 'snake'：行主序前缀 blob 格 = 色 1（矩形网格的行主序前缀恒 4 向连通），
    // 其余格按色 2..colors 的竖条带铺（保证不与色 1 同色 ⇒ 块尺寸可控）。
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        base[r * cols + c] = 2 + (Math.floor(c / Math.max(1, Math.ceil(cols / (colors - 1)))) % (colors - 1));
      }
    for (let i = 0; i < Math.min(blob, n); i++) base[i] = 1;
  }
  return base;
}

// ───────────────────────────────────────────────────────────── 挂载到真引擎

export interface Mounted {
  readonly h: Harness;
  readonly game: BeadsGame;
  readonly board: DenseBoard;
}

/**
 * 建 12×12 关卡 → `noAssemble` 空盘 → 逐格 `grid.fill(base, bead)` 摆全错位满盘。
 * ⚠️ 这是**夹具装配**（现行生产 BOOT 只能按 `swaps` ≤ 8 对装配，见结论 §B5）；
 * 装配后的棋盘与玩法判定完全走生产对象。
 */
export function mount(board: DenseBoard, seed = 'g3'): Mounted {
  const pattern: string[] = [];
  for (let r = 0; r < board.rows; r++) {
    let s = '';
    for (let c = 0; c < board.cols; c++) s += CHAR[board.base[r * board.cols + c]! - 1]!;
    pattern.push(s);
  }
  const level = simpleTestLevel({
    id: 900,
    name: 'G3 取证盘',
    rows: board.rows,
    cols: board.cols,
    time: 420,
    pattern,
  });
  const h = createBeadsHarness({ seed, noAssemble: true, levels: [level] });
  h.game.goToLevel(0);
  const grid = h.game.grid;
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const ok = grid.fill(r, c, board.beads[r * board.cols + c]!);
      if (!ok) throw new Error(`夹具装配失败 (${r},${c})`);
    }
  }
  return { h, game: h.game, board };
}

// ───────────────────────────────────────────────────────────── 只读盘面视图

export interface Cell {
  readonly row: number;
  readonly col: number;
}

export function emptyCells(grid: BeadGrid): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++) if (grid.cell(r, c)!.state === 'empty') out.push({ row: r, col: c });
  return out;
}

export function misplacedCells(grid: BeadGrid): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++) if (grid.isMisplaced(r, c)) out.push({ row: r, col: c });
  return out;
}

/** 同色错位连通块尺寸分布（**用生产 `collectMisplacedGroup` 度量**，行主序去重）。 */
export function blobSizes(grid: BeadGrid): number[] {
  const claimed = new Set<number>();
  const sizes: number[] = [];
  for (const cell of misplacedCells(grid)) {
    const key = cell.row * grid.cols + cell.col;
    if (claimed.has(key)) continue;
    const group = collectMisplacedGroup(grid, cell.row, cell.col);
    for (const g of group) claimed.add(g.row * grid.cols + g.col);
    sizes.push(group.length);
  }
  return sizes.sort((a, b) => b - a);
}

export function trayView(game: BeadsGame): string {
  const t = game.tray;
  const parts: string[] = [];
  for (let i = 0; i < t.capacity; i++) {
    const s = t.slot(i)!;
    parts.push(s.state === 'free' ? '·' : String(s.colorIdx));
  }
  return parts.join('');
}

// ───────────────────────────────────────────────── 动作族探针（全部真引擎）

export type Found = { kind: string; detail: string } | null;

/**
 * 强制选中槽 `slot` 所在组。⚠️ `Tray.select` 对**已选色**再点 = 整组取消
 * （v2.2 裁定②），故先比对当前选中色；同色已选直接返回。
 */
function ensureTraySelection(game: BeadsGame, slot: number): boolean {
  const s = game.tray.slot(slot);
  if (!s || s.state === 'free') return false;
  if (game.tray.selectedSlot >= 0 && game.tray.selectedColor === s.colorIdx) return true;
  game.selectTraySlot(slot);
  if (game.tray.selectedSlot < 0 || game.tray.selectedColor !== s.colorIdx) game.selectTraySlot(slot);
  return game.tray.selectedSlot >= 0 && game.tray.selectedColor === s.colorIdx;
}

/** 族 A：托盘珠 → 空格归位（`_placeSelected` → `judgePlacement`）。找到即返回（真写盘）。 */
export function probeTrayPlace(game: BeadsGame): Found {
  const t = game.tray;
  for (let slot = 0; slot < t.capacity; slot++) {
    const s = t.slot(slot)!;
    if (s.state === 'free') continue;
    if (!ensureTraySelection(game, slot)) continue;
    for (const e of emptyCells(game.grid)) {
      const before = game.grid.misplacedCount;
      if (game.tapGridCell(e.row, e.col)) {
        return {
          kind: 'tray-place',
          detail: `色${s.colorIdx} 槽${slot} → (${e.row},${e.col})  [misplaced ${before}→${game.grid.misplacedCount}]`,
        };
      }
    }
  }
  return null;
}

/** 族 B：整组取回（`retrieveSelectedGroup`，受 §3.13 满槽禁取门）。 */
export function probeRetrieve(game: BeadsGame): Found {
  const start = game.tray.firstFree();
  if (start < 0) return null; // 无任何空槽 ⇒ 组化拒绝
  for (const cell of misplacedCells(game.grid)) {
    const size = collectMisplacedGroup(game.grid, cell.row, cell.col).length;
    if (!game.selectBoardBead(cell.row, cell.col)) continue;
    const before = game.grid.misplacedCount;
    if (game.retrieveSelectedGroup(start)) {
      return {
        kind: 'retrieve',
        detail: `组(${cell.row},${cell.col}) size=${size} → 槽${start}..  [misplaced ${before}→${game.grid.misplacedCount}]`,
      };
    }
  }
  return null;
}

/** 族 C：board 锚 → 对应色空格**直填**（WXG-T-162；不吃托盘容量）。 */
export function probeDirectFill(game: BeadsGame): Found {
  for (const cell of misplacedCells(game.grid)) {
    const color = game.grid.cell(cell.row, cell.col)!.beadColorIdx;
    if (!game.selectBoardBead(cell.row, cell.col)) continue;
    for (const e of emptyCells(game.grid)) {
      const before = game.grid.misplacedCount;
      if (game.tapGridCell(e.row, e.col)) {
        return {
          kind: 'direct-fill',
          detail: `珠${color}@(${cell.row},${cell.col}) → 洞(${e.row},${e.col}) 底${game.grid.requiredColor(e.row, e.col) === color ? color : '?'}  [misplaced ${before}→${game.grid.misplacedCount}]`,
        };
      }
    }
  }
  return null;
}

/** 族 D：道具（`POWERUP_FREE_USES` × 3 型；solver 相 B 需推进时钟）。 */
export function probePowerup(h: Harness, type: 'solver' | 'solverPlus' | 'solverRandom'): Found {
  const game = h.game;
  if (game.powerups.freeUses(type) <= 0) return null;
  const before = game.grid.misplacedCount;
  if (!game.usePowerup(type)) return null;
  h.advance(1.2); // G2′ 相 A 200ms + 相 B 逐颗 80ms ⇒ 落子完成
  if (game.grid.misplacedCount >= before) return null;
  return {
    kind: 'powerup:' + type,
    detail: `misplaced ${before}→${game.grid.misplacedCount} 托盘=${trayView(game)}`,
  };
}

export interface MoveAvailability {
  readonly A_trayPlace: Found;
  readonly B_retrieve: Found;
  readonly C_directFill: Found;
  readonly D_powerup: Found;
  readonly restrictedDeadlock: boolean; // A∪B 全空（命题口径：无直填、无道具）
  readonly strictDeadlock: boolean; // A∪B∪C∪D 全空（现行规则口径）
}

/**
 * 四族可用性探针，固定顺序 A → B → C → D（越靠前越是玩家常识动作），**找到即短路**。
 * ⚠️ 每个探针「找到即真做」（会改盘），因此在活局面上调用 = 替玩家走一步。
 * 短路语义保证：只有在 A、B 均无解（= 命题口径死锁）时，C、D 的答案才有意义。
 */
export function probeAll(h: Harness): MoveAvailability {
  const game = h.game;
  const A = probeTrayPlace(game);
  const B = A ? null : probeRetrieve(game);
  const C = A || B ? null : probeDirectFill(game);
  const D = A || B || C ? null : probePowerup(h, 'solver') ?? probePowerup(h, 'solverPlus') ?? probePowerup(h, 'solverRandom');
  return {
    A_trayPlace: A,
    B_retrieve: B,
    C_directFill: C,
    D_powerup: D,
    restrictedDeadlock: !A && !B,
    strictDeadlock: !A && !B && !C && !D,
  };
}

/** 只读版可用性（不改盘）：仅回答「有没有」，用于批量统计。 */
export function availabilityReadonly(game: BeadsGame): {
  trayPlace: number;
  retrieve: number;
  directFill: number;
} {
  const t = game.tray;
  const holes = emptyCells(game.grid);
  const emptyBase = new Set<number>();
  for (const e of holes) emptyBase.add(game.grid.requiredColor(e.row, e.col));
  const trayColors = new Set<number>();
  for (let i = 0; i < t.capacity; i++) {
    const s = t.slot(i)!;
    if (s.state !== 'free') trayColors.add(s.colorIdx);
  }
  let trayPlace = 0;
  for (const c of trayColors) if (emptyBase.has(c)) trayPlace++;
  const retrieve = t.freeCount > 0 ? misplacedCells(game.grid).length : 0;
  let directFill = 0;
  for (const cell of misplacedCells(game.grid)) {
    if (emptyBase.has(game.grid.cell(cell.row, cell.col)!.beadColorIdx)) directFill++;
  }
  return { trayPlace, retrieve, directFill };
}

/** 托盘上持有的颜色集合（去重）。 */
export function trayColors(game: BeadsGame): number[] {
  const out: number[] = [];
  for (let i = 0; i < game.tray.capacity; i++) {
    const s = game.tray.slot(i)!;
    if (s.state !== 'free' && !out.includes(s.colorIdx)) out.push(s.colorIdx);
  }
  return out;
}

// ───────────────────────────────────────────────────────────── 机器人（真链）

export interface BotOptions {
  /** false = 玩家不用 WXG-T-162 board 锚直填（**行为约束，非代码开关**）。 */
  allowDirectFill: boolean;
  /** 取回偏好：'max' = 贪心取最大组；'min' = 只取小组（逐环周转）。 */
  retrieve: 'max' | 'min';
  /** `retrieve: 'min'` 时允许的单次取回上限（组大小 > 此值 ⇒ 不收）。 */
  maxRetrieve?: number;
  /** 是否允许用道具（三型各 1 次）。 */
  usePowerups?: boolean;
  maxMoves?: number;
}

export interface BotResult {
  cleared: boolean;
  moves: number;
  peakTray: number;
  stuck: string;
  directFills: number;
  retrieves: number;
  places: number;
  powerups: number;
}

/**
 * 通用机器人：**每一步都只经真链命令**（`selectTraySlot`/`tapGridCell`/
 * `selectBoardBead`/`retrieveSelectedGroup`/`usePowerup`），不自己判胜负。
 * 动作优先级：A 归位 → （C 直填）→ B 取回；A/B/C 皆不可 ⇒ 卡死。
 * 单调性保证可终止：归位/直填使 `misplaced` −1，取回使空槽 −1，两者皆不回退。
 */
export function runBot(h: Harness, opt: BotOptions): BotResult {
  const game = h.game;
  const maxMoves = opt.maxMoves ?? 4000;
  let peak = 0;
  let direct = 0;
  let ret = 0;
  let place = 0;
  let pow = 0;
  let moves = 0;
  let stuck = '';
  for (; moves < maxMoves; moves++) {
    peak = Math.max(peak, game.tray.holdingCount);
    if (game.grid.isComplete()) break;
    const holes = emptyCells(game.grid);
    const holeBase = new Map<number, Cell[]>();
    for (const e of holes) {
      const c = game.grid.requiredColor(e.row, e.col);
      const arr = holeBase.get(c);
      if (arr) arr.push(e);
      else holeBase.set(c, [e]);
    }
    // ── A：托盘珠 → 同色底洞
    let acted = false;
    for (const col of trayColors(game)) {
      const targets = holeBase.get(col);
      if (!targets || targets.length === 0) continue;
      let slot = -1;
      for (let i = 0; i < game.tray.capacity; i++) {
        const s = game.tray.slot(i)!;
        if (s.state !== 'free' && s.colorIdx === col) { slot = i; break; }
      }
      if (slot < 0) continue;
      if (!ensureTraySelection(game, slot)) continue;
      for (const t of targets) {
        if (game.tapGridCell(t.row, t.col)) { place++; acted = true; break; }
      }
      if (acted) break;
    }
    // ── C：board 锚直填（优先能造出「托盘色洞」的滑步）
    if (!acted && opt.allowDirectFill) {
      const need = new Set(trayColors(game));
      let pick: { from: Cell; to: Cell; useful: boolean } | null = null;
      for (const cell of misplacedCells(game.grid)) {
        const bc = game.grid.cell(cell.row, cell.col)!.beadColorIdx;
        const tos = holeBase.get(bc);
        if (!tos || tos.length === 0) continue;
        const srcBase = game.grid.requiredColor(cell.row, cell.col);
        const useful = need.has(srcBase);
        if (!pick || (useful && !pick.useful)) pick = { from: cell, to: tos[0]!, useful };
        if (pick.useful) break;
      }
      if (pick) {
        // 换选即转移（selectBoardBead 内部会静默清除 tray 锚），无需额外清锚。
        if (game.selectBoardBead(pick.from.row, pick.from.col) && game.tapGridCell(pick.to.row, pick.to.col)) {
          direct++;
          acted = true;
        }
      }
    }
    // ── B：整组取回（受满槽禁取门）
    if (!acted) {
      const start = game.tray.firstFree();
      if (start >= 0) {
        const blobs = blobAnchors(game.grid);
        const list = opt.retrieve === 'max' ? blobs : blobs.slice().sort((a, b) => a.size - b.size);
        for (const b of list) {
          if (opt.retrieve === 'min' && opt.maxRetrieve !== undefined && b.size > opt.maxRetrieve) continue;
          if (!game.selectBoardBead(b.cell.row, b.cell.col)) continue;
          if (game.retrieveSelectedGroup(start)) { ret++; acted = true; break; }
        }
      }
    }
    // ── D：道具
    if (!acted && opt.usePowerups) {
      for (const t of ['solver', 'solverPlus', 'solverRandom'] as const) {
        const before = game.grid.misplacedCount + game.tray.holdingCount;
        if (probePowerup(h, t)) {
          pow++;
          stuck = `powerup:${t} ${before}→${game.grid.misplacedCount + game.tray.holdingCount}`;
          acted = true;
          break;
        }
      }
    }
    if (!acted) { stuck = `no-move tray=${trayView(game)} holes=${holes.length} misplaced=${game.grid.misplacedCount}`; break; }
  }
  peak = Math.max(peak, game.tray.holdingCount);
  return {
    cleared: game.grid.isComplete(),
    moves,
    peakTray: peak,
    stuck,
    directFills: direct,
    retrieves: ret,
    places: place,
    powerups: pow,
  };
}

/** 每个同色错位连通块的一个代表格 + 尺寸（用生产 `collectMisplacedGroup` 度量）。 */
export function blobAnchors(grid: BeadGrid): { cell: Cell; size: number }[] {
  const claimed = new Set<number>();
  const out: { cell: Cell; size: number }[] = [];
  for (const cell of misplacedCells(grid)) {
    const key = cell.row * grid.cols + cell.col;
    if (claimed.has(key)) continue;
    const group = collectMisplacedGroup(grid, cell.row, cell.col);
    for (const g of group) claimed.add(g.row * grid.cols + g.col);
    out.push({ cell, size: group.length });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────── 真实链坐标

/** 与 `_setupLevel` 同法派生棋盘相机 ⇒ `tapDesign` 命中点与引擎同源（ADR-0015 丁-3）。 */
export function cellPoint(game: BeadsGame, row: number, col: number): { x: number; y: number } {
  const cam: BoardCamera = { zoom: 1, offsetX: 0, offsetY: 0 };
  fitCamera(cam, game.grid.cols, game.grid.rows);
  const lay = gridLayoutFor(game.grid.cols, game.grid.rows, cam);
  return { x: lay.colCenterX(col), y: lay.rowCenterY(row) };
}

export function slotPoint(game: BeadsGame, slot: number): { x: number; y: number } {
  const rows = Math.ceil(game.tray.capacity / TRAY_COLS);
  const lay = trayLayout(rows, game.tuning?.width ?? DESIGN_W);
  return { x: lay.slotCenterX(slot % TRAY_COLS), y: lay.slotCenterY(Math.floor(slot / TRAY_COLS)) };
}

export { TRAY_BASE_SLOTS };
