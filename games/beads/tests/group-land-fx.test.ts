/**
 * WXG-T-244 — 组批量归位的**纯表现**落座队列。
 *
 * 用户裁定（2026-10-04）：「一组珠子转移到新的槽里，要从当前点击的槽开始，按照 BFS 扩展
 * 出去，按照 ease-in-out 时间间隔出现，并且有落下去的抖动效果。」
 *
 * 口径（⛔ 两条不变式）：
 *  ① **数据同帧写盘不变**（T-186 裁定：retrieve+fill 同帧两写，无中间态外泄）——
 *     本队列是**纯表现**：只驱动「珠画不画 / 抖不抖」，规则读取（grid 状态）不受影响。
 *  ② 登记序 = `targets` 序 = **被点格 + `planGroupFill` BFS 由近及远** ⇒ `steps` 恒为
 *     `0..n-1` 且首格 = 被点格（「从当前点击的槽开始扩展」的锚定）。
 *
 * 相位口径与 G2′ 同族（`solverBeadProgress`）：`tMs = elapsed − STAGGER×step`；
 * `≤0` 未轮到（view 侧不画珠 = 「出现」）；`0..PER_BEAD` 送 fill-pop 包络（压下回弹 = 落下抖动）。
 *
 * ⚠ 造盘（与 `board-wrong-fx.test.ts` 同判例）：初始**满盘** ⇒ 空格靠 `setBead`+`retrieve`
 * 两步制造；`selectBoardBead` 建 board 锚。
 */

import { describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import { SOLVER_PER_BEAD_MS, SOLVER_STAGGER_MS } from '../src/config/tuning.js';

const FRAME = 1 / 60;

/** 造错色空格（`retrieve` 只收错位珠 ⇒ `setBead` 先造成错位，两步）。 */
function makeEmpty(h: Harness, row: number, col: number, asBead: number): void {
    h.game.grid.setBead(row, col, asBead);
    h.advance(FRAME);
    expect(h.game.grid.retrieve(row, col), `空格 (${row},${col}) 造好`).toBe(asBead);
    h.advance(FRAME);
}

/**
 * 测试盘：swaps 把色 2 珠换到两个**相邻**的 t≠2 格 —— `(0,2)`（t3）与 `(0,3)`（t1）
 * ⟹ 色 2 错位组 = `{(0,2),(0,3)}`（⚠ 组员的连通判据是「沿同色错位珠 ≤2 步」，
 *    首版造盘把两颗放在切比雪夫距 2 但**中间格非同色错位珠**的位置 ⟹ 不连通 ⟹ 组只剩锚，
 *    `alive.length−1 = 0` ⟹ BFS extra 上限 0 ⟹ 第二颗目标格永远不被填 —— 实测踩到）。
 * 目标空格（t2）：`(1,1)`（被点格）与 `(2,1)`（与其相邻 ⟹ BFS 第二跳；`(3,1)` 第三跳不收，
 *    alive−1 = 1 上限）。
 * `selectBoardBead(0,2)` 建锚（锚色 = 2）⇒ 点 `(1,1)` ⇒ 组归位 2 颗。
 */
function mk(saveKey: string): Harness {
    return createBeadsHarness({
        levels: [simpleTestLevel({
            pattern: ['x23123', '123123', '123123', '12312.', '231231'],
            swaps: [[0, 2, 1, 1], [0, 3, 3, 1]],
        })],
        saveKey,
    });
}

describe('组归位逐颗 BFS 错峰落座（WXG-T-244）', () => {
    it('① 登记序 = BFS 序（首格 = 被点格）· steps 恒 0..n-1 · 数据同帧写盘', () => {
        const h = mk('wxgame.beads.test.t244-bfs');
        expect(h.game.selectBoardBead(0, 2), 'board 锚建立（锚色 = 2）').toBe(true);
        h.advance(FRAME);
        makeEmpty(h, 1, 1, 3);
        makeEmpty(h, 2, 1, 3);

        expect(h.game.tapGridCell(1, 1), '组归位被消费').toBe(true);

        const s = h.game.snapshot;
        // ⛔ 数据同帧写盘：表现队列只管动画，grid 状态当帧完整
        expect(s.cells[7]?.state, '被点格 (1,1) 当帧已 filled（T-186 同帧口径不变）').toBe('filled');
        expect(s.cells[13]?.state, '(2,1) 当帧已 filled').toBe('filled');

        expect(s.groupLandCount, '两颗都登记').toBe(2);
        expect(s.groupLandSteps[0]).toBe(0);
        expect(s.groupLandSteps[1]).toBe(1);
        // 首格 = 被点格（「从当前点击的槽开始」）
        expect(s.groupLandRows[0]).toBe(1);
        expect(s.groupLandCols[0]).toBe(1);
        // 第二格 = BFS 由近及远（(2,1) 与被点格相邻）
        expect(s.groupLandRows[1]).toBe(2);
        expect(s.groupLandCols[1]).toBe(1);
    });

    it('② 相位窗口：elapsed 推进 · 总时长后队列清空 · 错峰间隔 = STAGGER×step', () => {
        const h = mk('wxgame.beads.test.t244-phase');
        expect(h.game.selectBoardBead(0, 2)).toBe(true);
        h.advance(FRAME);
        makeEmpty(h, 1, 1, 3);
        makeEmpty(h, 2, 1, 3);
        h.game.tapGridCell(1, 1);

        let s = h.game.snapshot;
        const e0 = s.groupLandElapsedMs;
        expect(e0, '起播帧 elapsed≈0').toBeLessThan(SOLVER_STAGGER_MS);
        // 第一颗（step 0）相位已在窗口内
        expect(e0, '第一颗 tMs ∈ (0, PER_BEAD)').toBeLessThan(SOLVER_PER_BEAD_MS);
        // 第二颗（step 1）未轮到（tMs = e0 − STAGGER ≤ 0 ⇒ view 不画）
        expect(e0 - SOLVER_STAGGER_MS * 1, '第二颗未轮到（错峰）').toBeLessThanOrEqual(0);

        h.advance(SOLVER_PER_BEAD_MS + SOLVER_STAGGER_MS * 2); // 越过总时长
        s = h.game.snapshot;
        expect(s.groupLandCount, '⛔ 播完即清（零常驻）').toBe(0);
        expect(s.groupLandElapsedMs).toBe(0);
    });
});
