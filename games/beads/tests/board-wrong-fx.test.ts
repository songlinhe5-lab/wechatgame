/**
 * WXG-T-241 — 盘面已有选中珠时点**错色空格** ⇒ 错珠动画（⛔ 不是「先选一颗珠子」文案）。
 *
 * 病灶（用户 2026-10-04 报「提示先选一颗，但盘面上已经有选择的珠子了」）：
 * `_routeGridEmpty` 的「先选一颗珠子」只在**真的没选中**时成立；而
 * `_tryDirectFillFromBoard` 在「**board 锚存活** + 点的是**错色空格**」时**也返回 `null`**
 * （`target.colorIdx !== anchor.color` ⇒ 不消费）⇒ 玩家**明明已选中**却被告知「先选一颗」。
 *
 * 修法：按「调用返回后 `_boardSelected` 是否**仍存活**」分流 ——
 *   存活 ⇒ 播错珠动画（GAP-04 `wrong` 态，同 `_placeSelected` 的 `mismatch` 通道）；
 *   已清（组员全死 ⇒ 该函数自行清锚）或从无 ⇒ 文案成立。
 *
 * 判据口径：事件用 snapshot 的 `wrongRow/wrongCol/wrongProgress`（表现层）+ `tapHintText`
 * （⛔ 文案必须为空）双断言 —— 「动画起了」与「文案没起」缺一即违「不给矛盾提示」。
 *
 * ⚠ 盘面初始**满盘**（`applyMisplacedToGrid` 装配）⇒ 无空格；空格靠 `grid.retrieve` 制造
 *   （取回一颗错位珠）。取回**锚珠本身** ⇒ 组员全死 ⇒ 锚被清 ⇒ 正是第 ③ 腿的造法。
 */

import { describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import { TAP_HINT_NO_SELECTION_TEXT } from '../src/config/tuning.js';

const FRAME = 1 / 60;

/** 造一个**错色空格**（`target ≠ 3`）：`setBead` 把该格造成错位，再 `retrieve` 取回。
 *  ⚠ 必须两步：`grid.retrieve` 的唯一出边是「**错位**珠 → empty」，就位珠直接拒绝
 *    （`grid.ts:134` 的 `beadColorIdx === colorIdx` 守卫）⇒ 直接 retrieve 就位珠返回 0。 */
function makeWrongColorEmpty(h: Harness, row: number, col: number, asBead: number): void {
    h.game.grid.setBead(row, col, asBead); // 造成错位（bead ≠ target）
    h.advance(FRAME); // ⚠ 直改 grid 后推一帧让 snapshot 同步（denied-press 判例）
    expect(h.game.grid.retrieve(row, col), '错色空格造好（取回一颗错位珠）').toBe(asBead);
    h.advance(FRAME);
}

/**
 * 测试盘 6×5，`swaps` 交换 (0,1)'2' 与 (0,2)'3' 的初始珠色 ⇒ 两颗错位珠：
 * `(0,1) target=2 bead=3`（⇒ board 锚色 = **3**）与 `(0,2) target=3 bead=2`。
 * 其余格 bead = target（就位，不入组）⇒ color=3 的错位组 = **单珠 {(0,1)}**。
 */
function mk(saveKey: string): Harness {
    return createBeadsHarness({
        levels: [simpleTestLevel({
            pattern: ['x23123', '123123', '123123', '12312.', '231231'],
            swaps: [[0, 1, 0, 2]],
        })],
        saveKey,
    });
}

describe('盘面已选中时点错色空格 ⇒ 错珠动画（WXG-T-241）', () => {
    it('① 锚存活 + 错色空格 ⇒ wrong 起播且 ⛔ 不给「先选一颗」文案', () => {
        const h = mk('wxgame.beads.test.t241-wrong');
        expect(h.game.selectBoardBead(0, 1), 'board 锚建立（锚色 = 3）').toBe(true);
        h.advance(FRAME);
        makeWrongColorEmpty(h, 0, 3, 2); // target=1（≠ 锚色 3）⇒ 错色空格
        expect(h.game.snapshot.cells[3]?.state).toBe('empty');

        h.game.tapGridCell(0, 3);

        const s = h.game.snapshot;
        expect(s.wrongRow, '① 错珠动画必须起播（被点格）').toBe(0);
        expect(s.wrongCol).toBe(3);
        // ⚠ 起播**那一帧** elapsed = 0 ⇒ 进度为 0 是正常的；推一帧再断言「在推进」，
        //   否则这条只能证明「标志被置」，证不了动画真的在播。
        h.advance(FRAME);
        expect(h.game.snapshot.wrongProgress, '① 推一帧后进度 > 0（动画在推进）').toBeGreaterThan(0);
        // ⛔ 核心：⛔ 不得再给「先选一颗珠子」—— 玩家明明已选中
        expect(s.tapHintText, '⛔ 不得给矛盾文案').toBe('');
    });

    it('② 从无选中 + fillable 空格 ⇒ 文案「先选一颗珠子」**保留**（旧行为不回归）', () => {
        const h = mk('wxgame.beads.test.t241-nohint-regress');
        makeWrongColorEmpty(h, 0, 3, 2); // 空格 target=1；⛔ 不建任何锚
        h.game.tapGridCell(0, 3);

        const s = h.game.snapshot;
        expect(s.tapHintText, '② 无选中 ⇒ 文案成立').toBe(TAP_HINT_NO_SELECTION_TEXT);
        expect(s.wrongRow, '② 无选中时不得播错珠动画').toBe(-1);
    });

    it('③ ⛔ 锚组员全死（取回锚珠）+ 点空格 ⇒ 回落**文案**而非错珠动画', () => {
        const h = mk('wxgame.beads.test.t241-anchor-dead');
        expect(h.game.selectBoardBead(0, 1)).toBe(true);
        h.game.grid.retrieve(0, 1); // 取回**锚珠本身**（错位珠 ⇒ 允许）⇒ 组员全死 ⇒ 锚被清
        h.advance(FRAME);
        makeWrongColorEmpty(h, 0, 3, 2); // 再制造一个错色空格（target=1）

        h.game.tapGridCell(0, 3);

        const s = h.game.snapshot;
        // ⚠ 判据必须用「调用 `_tryDirectFillFromBoard` **之后**」的锚状态：
        //   锚已死 ⇒ 玩家实际处于「无选中」⇒ 文案才是对的。
        //   ⛔ 若用「进来前」的锚 ⇒ 会对不存在的选中态播错珠动画。
        expect(s.tapHintText, '③ 锚已死 ⇒ 回落文案').toBe(TAP_HINT_NO_SELECTION_TEXT);
        expect(s.wrongRow, '⛔ 锚已死不得播错珠动画').toBe(-1);
    });
});
