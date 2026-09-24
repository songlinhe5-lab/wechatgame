import { describe, expect, it } from 'vitest';
import { BeadGrid } from '../src/entities/grid.js';
import { planConsumeOrder, type GroupCell } from '../src/systems/consume-order.js';
import { gridLayoutFor } from '../src/config/tuning.js';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';
import type { BeadsGame } from '../src/game/beads-game.js';

/**
 * 【WXG-T-186 用户裁定（2026-09-22）· 消费序改「沿组连通的剥皮序」】
 *
 * 推翻 v2.4（WXG-T-183）的「距选豆点切比雪夫升序 + 平局行主序」——那是**几何**距离，
 * 而组是 8 向**连通**块，两条必然后果：① 跳过缺口先吃对岸珠（隔空取物）；
 * ② 同圈层按行主序 ⇒ 最左上的珠最先被吃（与玩家「一片揭起、最远的留到最后」相反）。
 *
 * 新序四条优先级（bead-grid §2.2 v2.5）：
 *   1 候选必须与已揭起区 8 邻接（硬 ⇒ 全程不隔空取物）
 *   2 优先取「删掉后剩余仍一整片」者（= 非割点；全是桥时让步）
 *   3 同层内「仍有未吃下层邻居」的引路珠押后（末端珠先吃）
 *   4 图上距离（BFS 层号）↑ ⇒ 行主序 ↑
 * 直填与取回落槽**共用同一序**（两路口径一致由构造保证）。
 */

const gridOf = (rows: number, cols: number): BeadGrid =>
    new BeadGrid(Array.from({ length: rows }, () => '123456789'.slice(0, cols)));
const at = (row: number, col: number): GroupCell => ({ row, col });
const fmt = (cells: readonly GroupCell[]): string =>
    cells.map((c) => `(${c.row},${c.col})`).join(' ');

/** 8 向连通判定（判据用，与实现的连通口径同构但独立书写）。 */
function connected8(cells: readonly GroupCell[]): boolean {
    if (cells.length <= 1) return true;
    const key = (c: GroupCell): number => c.row * 100 + c.col;
    const set = new Set(cells.map(key));
    const seen = new Set<number>([key(cells[0]!)]);
    const q = [cells[0]!];
    for (let h = 0; h < q.length; h++) {
        const cur = q[h]!;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const k = (cur.row + dr) * 100 + cur.col + dc;
            if (!set.has(k) || seen.has(k)) continue;
            seen.add(k);
            q.push(at(Math.floor(k / 100), k % 100));
        }
    }
    return seen.size === set.size;
}

/** 不变式 1：序中每颗（除首颗）必与已消耗某颗 8 邻接 —— 全程不隔空取物。 */
function neverJumps(order: readonly GroupCell[]): boolean {
    for (let i = 1; i < order.length; i++) {
        const touched = order.slice(0, i).some(
            (p) => Math.abs(p.row - order[i]!.row) <= 1 && Math.abs(p.col - order[i]!.col) <= 1,
        );
        if (!touched) return false;
    }
    return true;
}

/** 不变式 2：消耗任意 k 颗后剩余仍一整片（形状无桥时可达）。 */
function remainderAlwaysWhole(cells: readonly GroupCell[], order: readonly GroupCell[]): boolean {
    for (let k = 1; k < cells.length; k++) {
        const gone = new Set(fmt(order.slice(0, k)));
        if (!connected8(cells.filter((c) => !gone.has(fmt([c]))))) return false;
    }
    return true;
}

describe('WXG-T-186 · 组珠消费序（剥皮序）', () => {
    it('U 形（带缺口）：不跳缺口，沿底边绕过去吃对岸', () => {
        // A.#        旧切比雪夫序第 3 颗 = (0,2)（跳过缺口 (0,1) 吃对岸）
        // #.#        新序沿 (0,0)→(1,0)→(2,0)→(2,1)→(2,2)→(1,2)→(0,2) 一片揭起
        // ###
        const cells = [at(0, 0), at(1, 0), at(2, 0), at(2, 1), at(2, 2), at(1, 2), at(0, 2)];
        const order = planConsumeOrder(gridOf(3, 3), 0, 0, cells);
        expect(fmt(order)).toBe('(0,0) (1,0) (2,0) (2,1) (2,2) (1,2) (0,2)');
        expect(neverJumps(order)).toBe(true);
        expect(remainderAlwaysWhole(cells, order)).toBe(true);
    });

    it('3×3 实心块：任意消耗数下剩余仍一整片，中心引路珠最后吃', () => {
        const cells = [
            at(0, 0), at(0, 1), at(0, 2),
            at(1, 0), at(1, 1), at(1, 2),
            at(2, 0), at(2, 1), at(2, 2),
        ];
        const order = planConsumeOrder(gridOf(3, 3), 0, 0, cells);
        expect(neverJumps(order)).toBe(true);
        expect(remainderAlwaysWhole(cells, order)).toBe(true);
        expect(order[order.length - 1]).toEqual(at(1, 1)); // 中心 = 唯一同时牵着四支的引路珠
    });

    it('同层内：仍有未吃下层邻居的引路珠押后，末端珠先吃', () => {
        // ..####      选豆点 A = (5,3)。旧口径（层号平局 → 行主序）会先吃引路珠 (4,4)，
        // ..#A##      把左端/下排拆成两段；新序先吃末端珠，整片自选豆点向两侧剥落。
        const cells = [
            at(4, 2), at(4, 3), at(4, 4), at(4, 5),
            at(5, 2), at(5, 3), at(5, 4), at(5, 5),
        ];
        const order = planConsumeOrder(gridOf(6, 6), 5, 3, cells);
        expect(fmt(order)).toBe(
            '(5,3) (4,2) (5,2) (4,3) (4,4) (4,5) (5,5) (5,4)',
        );
        expect(remainderAlwaysWhole(cells, order)).toBe(true);
    });

    it('单珠组 / 双珠组：序即成员本身，不抛错', () => {
        expect(planConsumeOrder(gridOf(3, 3), 1, 1, [at(1, 1)])).toEqual([at(1, 1)]);
        const two = planConsumeOrder(gridOf(3, 3), 1, 1, [at(0, 0), at(1, 1)]);
        expect(two[0]).toEqual(at(1, 1)); // 选豆点恒为首颗（消费从手边揭起）
        expect(two).toHaveLength(2);
    });

    it('确定性：同一输入两次调用输出逐颗相同（无随机、无 Map 序依赖）', () => {
        const cells = [at(0, 0), at(0, 1), at(1, 1), at(1, 2), at(2, 2), at(2, 0)];
        const g = gridOf(3, 3);
        expect(fmt(planConsumeOrder(g, 0, 0, cells))).toBe(fmt(planConsumeOrder(g, 0, 0, cells)));
    });
});

/** 网格格心（§3.8 单一真源；tapDesign 直吃设计坐标）。 */
function gridPoint(game: BeadsGame, row: number, col: number): { x: number; y: number } {
    const layout = gridLayoutFor(game.grid.cols, game.grid.rows);
    return { x: layout.colCenterX(col), y: layout.rowCenterY(row) };
}

describe('WXG-T-186 · 直填与取回共用同一消费序', () => {
    /**
     * U 形局面（底色 1/3 混排 ⇒ 色 2 珠全错位；三个底色 2 空格互不相邻 ⇒ 每次点击只填 1 格）：
     *   1 2 1 3 3 2
     *   1 3 3 1 3 1
     *   1 3 1 3 2 3
     *   3 1 3 1 1 3
     *   1 3 1 3 1 3
     * 组 = (0,0)(1,0)(2,0)(2,1)(2,2)(1,2)(0,2)，选豆点 (0,0)，缺口 = (0,1)。
     * 旧几何序第 3 颗 = (0,2)（跳过缺口吃对岸）；剥皮序第 3 颗 = (2,0)（沿片走）。
     */
    const PATTERN = ['121332', '133131', '131323', '313113', '131313'];
    const GROUP: readonly (readonly [number, number])[] = [
        [0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2],
    ];
    const TARGETS: readonly (readonly [number, number])[] = [[0, 1], [2, 4], [0, 5]];

    const make = (): BeadsGame => {
        const hh = createBeadsHarness({
            seed: 'peel-seed',
            noAssemble: true,
            levels: [simpleTestLevel({ pattern: PATTERN })],
        });
        hh.game.goToLevel(0);
        for (const [r, c] of GROUP) expect(hh.game.grid.fill(r, c, 2)).toBe(true);
        return hh.game;
    };
    const tapCell = (game: BeadsGame, row: number, col: number): void => {
        const p = gridPoint(game, row, col);
        expect(game.tapDesign(p.x, p.y)).toBe(true);
    };

    it('直填沿片揭起：第 3 颗吃 (2,0) 而非跳缺口的 (0,2)', () => {
        const game = make();
        expect(game.selectBoardBead(0, 0)).toBe(true);
        for (const [r, c] of TARGETS) tapCell(game, r, c);
        expect(game.grid.cell(2, 0)!.state).toBe('empty'); // 沿片走到了底边
        expect(game.grid.cell(0, 2)!.state).toBe('filled'); // 对岸末端珠留到最后
        // 剩余四颗仍一整片（旧序吃掉 (0,2) 会把 (1,2) 削成孤岛）
        const rest = GROUP.filter(([r, c]) => game.grid.cell(r, c)!.state === 'filled').map(([r, c]) => at(r, c));
        expect(connected8(rest)).toBe(true);
    });

    it('取回落槽消耗的前 3 颗 = 直填消耗的前 3 颗（两路同一序）', () => {
        const game = make();
        // 托盘只留 3 个连续空槽 ⇒ 收 3 颗（容量口径不变，WXG-T-168 裁定②）
        for (let i = 0; i < game.tray.capacity - 3; i++) expect(game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);
        expect(game.tray.freeCount).toBe(3);
        expect(game.selectBoardBead(0, 0)).toBe(true);
        expect(game.retrieveSelectedGroup()).toBe(true);
        const gone = GROUP.filter(([r, c]) => game.grid.cell(r, c)!.state === 'empty');
        expect(gone).toEqual([[0, 0], [1, 0], [2, 0]]);
        const rest = GROUP.filter(([r, c]) => game.grid.cell(r, c)!.state === 'filled').map(([r, c]) => at(r, c));
        expect(connected8(rest)).toBe(true);
    });
});
