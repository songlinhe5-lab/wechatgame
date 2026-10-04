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
 *
 * **[T-244 修正]** 用户报「没有错峰落子/没有下压/顺序不由近及远」⟹ **首版挂错路径**：
 * 只挂了 board 锚直填（`_tryDirectFillFromBoard`），而游戏主流程是**托盘锚** `_placeSelected`
 * （其组批量循环每颗调 `_armPlaceFx` G1 单槽 ⟹ 逐颗互相覆盖 = 无错峰无下压）。
 * 修正 = 组批量走 `_groupLandFx` 队列、单颗保 G1 ⟹ 腿 ③ 钉托盘路径。
 */

import { describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import { GROUP_LAND_SPREAD_MS, GROUP_LAND_PER_BEAD_MS, SOLVER_STAGGER_MS } from '../src/config/tuning.js';
import { groupLandOffsetMs } from '../src/view/scene-vfx.js';

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
        expect(e0, '第一颗 tMs ∈ (0, PER_BEAD)').toBeLessThan(GROUP_LAND_PER_BEAD_MS);
        // 第二颗（step 1）未轮到（tMs = e0 − STAGGER ≤ 0 ⇒ view 不画）
        expect(e0 - SOLVER_STAGGER_MS * 1, '第二颗未轮到（错峰）').toBeLessThanOrEqual(0);

        h.advance(GROUP_LAND_PER_BEAD_MS + SOLVER_STAGGER_MS * 2); // 越过总时长
        s = h.game.snapshot;
        expect(s.groupLandCount, '⛔ 播完即清（零常驻）').toBe(0);
        expect(s.groupLandElapsedMs).toBe(0);
    });
});

describe('托盘锚组归位走同队列（WXG-T-244 修正批）', () => {
    it('③ 托盘选珠点空格 ⟹ 组批量登记 BFS 序（⛔ 首版漏的正是这条主流程路径）', () => {
        const h = mk('wxgame.beads.test.t244-tray-path');
        // 造两个 t2 空格（相邻 ⟹ BFS 第二跳可达）
        makeEmpty(h, 1, 1, 3);
        makeEmpty(h, 2, 1, 3);
        // 托盘给两颗色 2 珠并选中组
        const slot0 = h.game.giveTrayBead(2);
        const slot1 = h.game.giveTrayBead(2);
        expect(slot0).toBeGreaterThanOrEqual(0);
        expect(slot1).toBeGreaterThanOrEqual(0);
        expect(h.game.selectTraySlot(slot0), '托盘锚建立').toBe(true);

        expect(h.game.tapGridCell(1, 1), '托盘组归位被消费').toBe(true);

        const s = h.game.snapshot;
        expect(s.cells[7]?.state, '(1,1) 当帧 filled（数据同帧口径）').toBe('filled');
        expect(s.groupLandCount, '⛔ 组批量走队列（此前 G1 单槽互相覆盖 = 无错峰）').toBe(2);
        expect(s.groupLandRows[0]).toBe(1);
        expect(s.groupLandCols[0]).toBe(1);
        expect(s.groupLandRows[1]).toBe(2);
        expect(s.groupLandCols[1]).toBe(1);
    });

    it('④ 下压包络真的进了命令流（珠 scale < 1 的帧存在）', () => {
        const h = mk('wxgame.beads.test.t244-press');
        makeEmpty(h, 1, 1, 3);
        makeEmpty(h, 2, 1, 3);
        h.game.giveTrayBead(2);
        h.game.giveTrayBead(2);
        h.game.selectTraySlot(h.game.snapshot.traySlots.findIndex((t) => t.state === 'holding'));
        h.game.tapGridCell(1, 1);
        h.advance(FRAME); // 推进到第一颗 pop 窗口内
        const s = h.game.snapshot;
        expect(s.groupLandCount).toBe(2);
        // pop 窗口内：progress ∈ (0,1) ⇒ fillPopEnvelope 产出 scale < 1（压下段）
        const p = s.groupLandElapsedMs / (SOLVER_STAGGER_MS * 1 + GROUP_LAND_PER_BEAD_MS);
        expect(p, '第一颗处于 pop 窗口').toBeGreaterThan(0);
        expect(p).toBeLessThan(1);
    });
});

describe('落珠顺序错峰 + 200ms 硬上限（WXG-T-244 七批）', () => {
    it('⑤ step = 落珠序号 ⟹ 逐颗递增（由近及远由 planGroupFill 填充序保证）', () => {
        const h = mk('wxgame.beads.test.t244-rings');
        // 造一条「直线三连」t2 空格：(1,1) 被点 / (2,1) 环 1 / (3,1) 环 2
        makeEmpty(h, 1, 1, 3);
        makeEmpty(h, 2, 1, 3);
        makeEmpty(h, 3, 1, 3);
        h.game.giveTrayBead(2);
        h.game.giveTrayBead(2);
        h.game.selectTraySlot(h.game.snapshot.traySlots.findIndex((t) => t.state === 'holding'));
        h.game.tapGridCell(1, 1);

        const s = h.game.snapshot;
        // 组大小 = 托盘组内珠数（2）⟹ 只填 2 颗；(3,1) 不会进本批
        expect(s.groupLandCount).toBe(2);
        expect(s.groupLandSteps[0], '被点格 = 序号 0（零延迟）').toBe(0);
        expect(s.groupLandSteps[1], '第二颗 = 序号 1（每颗递增 ⟹ 错峰）').toBe(1);
    });

    it('⑥ 偏移在 80ms 预算内等差分配 ⟹ 总时长恒 200ms（与颗数无关）', () => {
        // 末颗序号 3：偏移 0 / 26.7 / 53.3 / 80
        const maxOrder = 3;
        const offs = [0, 1, 2, 3].map((order) => groupLandOffsetMs(order, maxOrder));
        expect(offs[0]).toBe(0);
        expect(offs[3], '末颗吃满错峰预算').toBeCloseTo(GROUP_LAND_SPREAD_MS, 6);
        // 间隔**恒定**（预算按环比例分配 ⟹ 等差；不是递增）
        const gaps = offs.slice(1).map((v, k) => v - offs[k]!);
        expect(gaps[1]).toBeCloseTo(gaps[0]!, 6);
        expect(gaps[2]).toBeCloseTo(gaps[1]!, 6);
        // ⛔ 硬上限：总时长 = 传播预算 + 落位窗 = 200ms，**与环数无关**
        expect(GROUP_LAND_SPREAD_MS + GROUP_LAND_PER_BEAD_MS, '总时长 ≤ 0.2 秒').toBeLessThanOrEqual(200);
        // 颗数多 ⟹ 每颗间隔更短（「间隔缩短」）：预算固定 ⟹ 单颗间隔 = 80/(n−1)
        expect(groupLandOffsetMs(1, 6) - groupLandOffsetMs(0, 6), '6 颗的间隔 < 3 颗的间隔').toBeLessThan(
            groupLandOffsetMs(1, 3) - groupLandOffsetMs(0, 3),
        );
        expect(groupLandOffsetMs(1, 0), '单颗（maxOrder=0）⟹ 零延迟').toBe(0);
    });
});

describe('所有落珠都播（T-244 修正三批 · 取消组批量限制）', () => {
    it('⑦ 单颗放置也走队列（环 0 ⟹ 零延迟起播，与原 G1 同帧等价）', () => {
        const h = mk('wxgame.beads.test.t244-single');
        makeEmpty(h, 1, 1, 3);
        h.game.giveTrayBead(2); // ⛔ 只给 1 颗 ⟹ groupSize === 1
        h.game.selectTraySlot(h.game.snapshot.traySlots.findIndex((t) => t.state === 'holding'));
        expect(h.game.tapGridCell(1, 1), '单颗放置被消费').toBe(true);

        const s = h.game.snapshot;
        expect(s.groupLandCount, '⛔ 单颗也走队列（此前走 G1 单槽 = 无涟漪语义）').toBe(1);
        expect(s.groupLandSteps[0], '单颗 = 环 0 ⟹ 偏移 0 ⟹ 立即起播').toBe(0);
        expect(s.groupLandElapsedMs, '起播帧 elapsed ≈ 0（无额外延迟）').toBeLessThan(SOLVER_STAGGER_MS);
    });
});

describe('帧级错峰时序（T-244 四批「乙」· 防回归）', () => {
    it('⑧ 三颗（序号 0/1/2）：逐颗等差错峰，且总时长 ≤ 200ms', () => {
        const h = mk('wxgame.beads.test.t244-frame');
        makeEmpty(h, 1, 1, 3);
        makeEmpty(h, 2, 1, 3);
        makeEmpty(h, 3, 1, 3);
        for (let k = 0; k < 3; k += 1) h.game.giveTrayBead(2);
        h.advance(FRAME);
        h.game.selectTraySlot(h.game.snapshot.traySlots.findIndex((t) => t.state === 'holding'));
        h.game.tapGridCell(1, 1);

        // 复刻 view 侧判定（`view-model.ts`）—— ⛔ 不 import view，钉**契约**而非实现
        const s0 = h.game.snapshot;
        const maxRing = s0.groupLandSteps[s0.groupLandCount - 1]!;
        const tAt = (step: number): number =>
            h.game.snapshot.groupLandElapsedMs - groupLandOffsetMs(step, maxRing);
        expect(s0.groupLandCount, '三颗都登记').toBe(3);
        expect(maxRing, '直线 ⟹ 最大环 = 2').toBe(2);

        // 起播帧：环 0 已进窗口、环 1/2 未轮到（⟹ 隐藏）
        h.advance(FRAME);
        expect(tAt(0), '环0 已进窗口').toBeGreaterThan(0);
        expect(tAt(1), '环1 未轮到 ⟹ 隐藏').toBeLessThanOrEqual(0);
        expect(tAt(2), '环2 未轮到 ⟹ 隐藏').toBeLessThanOrEqual(0);

        // 过 SPREAD/2（= 65ms = 第 2 颗的偏移）：序号 1 进窗口
        h.advance(GROUP_LAND_SPREAD_MS / 2 / 1000 + FRAME);
        expect(tAt(1), '第2颗已进窗口').toBeGreaterThan(0);
        expect(tAt(2), '第3颗仍未轮到 ⟹ 隐藏').toBeLessThanOrEqual(0);

        // ⛔ 硬上限：越过 200ms 后队列必清（总时长 = SPREAD + PER_BEAD = 200ms）
        h.advance(0.25);
        expect(h.game.snapshot.groupLandCount, '⛔ 200ms 后必清（零常驻）').toBe(0);
    });
});
