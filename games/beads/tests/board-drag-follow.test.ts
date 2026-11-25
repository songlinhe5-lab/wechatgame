/**
 * WXG-T-1078 · 盘面拖动的**呈现跟手**回归。
 *
 * 症状：拖动看起来一顿一顿，而性能面板帧耗时稳定（取证见 `production/TASKS-DETAIL.md`
 * `## WXG-T-1076` §③）。根因：位移只在 1/60 的固定步里推进，宿主帧率与步进不锁相时
 * （120Hz 屏每两帧才一步；或帧间隔抖动把累加器推成 0/2 步循环），画面就变成
 * 「一帧不动、下一帧走两倍」。
 *
 * 本例锁修法的核心不变式：**手指在动，画面就得在动** —— 即使该渲染帧一个固定步都没跑。
 * 零步帧的模拟方式 = 只向 `InputManager` 投递一条 pointer move，⛔ 不调 `update`
 * （与真机「touchmove 到达在两个固定步之间」同形，见 `input-manager.ts` 头注）。
 */
import { describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel, firstEmptyCell, type Harness } from './helpers.js';
import { gridLayoutFor, BOARD_TAP_MOVE_THRESHOLD } from '../src/config/tuning.js';

const STEP = 1 / 60;

/** 一帧完整固定步（与 `App._fixedUpdate` 同形）。 */
function frame(h: Harness, samples: Array<{ id: number; x: number; y: number; phase: 'down' | 'move' | 'up' }>): void {
    h.input.beginFrame();
    for (const s of samples) h.input.push({ ...s, time: 0 });
    h.game.update(STEP);
    h.input.endFrame(STEP);
}

function screenOf(h: Harness, designX: number, designY: number): { x: number; y: number } {
    const s = { x: 0, y: 0 };
    h.services.viewport.designToScreen(s, designX, designY);
    return s;
}

/**
 * 读**渲染器实际使用**的盘面左边界：走 `game.snapshot`（宿主每渲染帧读它），
 * 再取 `gridLeft`。[WXG-T-1078] 残差就落在这个可写字段上，⛔ 读 `_layout.left`（readonly）。
 */
function drawLeft(h: Harness): number {
    return h.game.snapshot.gridLeft;
}

/** 按下棋盘格 → 越阈值移动 → 已进单指平移态，相机消费到 `far`。 */
function armDrag(h: Harness): { far: { x: number; y: number } } {
    const cell = firstEmptyCell(h.game)!;
    const lay = gridLayoutFor(h.game.grid.cols, h.game.grid.rows);
    const d = screenOf(h, lay.colCenterX(cell.col), lay.rowCenterY(cell.row));
    frame(h, [{ id: 1, x: d.x, y: d.y, phase: 'down' }]);
    const far = { x: d.x - (BOARD_TAP_MOVE_THRESHOLD * 4 + 24), y: d.y };
    frame(h, [{ id: 1, x: far.x, y: far.y, phase: 'move' }]);
    return { far };
}

describe('盘面拖动呈现跟手（零固定步帧也必须跟随手指）', () => {
    it('进入平移后仅投一条 move（不跑固定步）⇒ 绘制布局随之移动', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.follow-zero-step' });
        expect(h.game.phase).toBe('playing');
        const { far } = armDrag(h);

        const before = drawLeft(h);
        // 关键帧：手指又走 30 屏 px，但这一帧没有任何固定步（120Hz 的第二帧形态）。
        h.input.push({ id: 1, x: far.x - 30, y: far.y, phase: 'move', time: 0 });
        const after = drawLeft(h);

        expect(before - after).toBeGreaterThan(1);
    });

    it('无新事件时不产生额外位移（⛔ 自造惯性/抖动）', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.follow-idle' });
        armDrag(h);
        const a = drawLeft(h);
        const b = drawLeft(h);
        expect(b).toBeCloseTo(a, 9);
    });

    it('抬手后绘制布局回到相机权威态（残影不留 in 画面）', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.follow-release' });
        const { far } = armDrag(h);
        // 手指再走一段，然后**不消费**直接抬手 ⇒ 残差必须在抬手时归零。
        h.input.push({ id: 1, x: far.x - 30, y: far.y, phase: 'move', time: 0 });
        void h.game.snapshot;
        frame(h, [{ id: 1, x: far.x - 30, y: far.y, phase: 'up' }]);

        const drawn = drawLeft(h);
        // 抬手后权威 gridLeft = gridLayoutFor(camera).left（projectSnapshot 后无残差）
        const authoritative = gridLayoutFor(
            h.game.grid.cols, h.game.grid.rows,
            (h.game as unknown as { _board: { camera: { zoom: number; offsetX: number; offsetY: number } } })._board.camera,
        ).left;
        expect(drawn).toBeCloseTo(authoritative, 6);
    });
});
