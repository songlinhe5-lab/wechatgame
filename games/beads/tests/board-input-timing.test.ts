/**
 * WXG-T-169 / ADR-0015 C-3(a)「棋盘区抬起才提交」正面判据（真输入链，非 tapDesign 旁路）。
 *
 * 现有真链测试都打面板（区外·按下即提交）或走 tapDesign（绕过 _readInput），
 * 没有一条证明「棋盘区 tap 在 down 帧不落子、up 帧才落」。本文件补这个缺口：
 *   ① tap：down 帧零 bead:placed → up 帧 +1；
 *   ② drag：down → 越阈值 move → up，全程不落子（相机平移态，不产玩法指令）。
 */
import { describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel, firstEmptyCell, type Harness } from './helpers.js';
import { gridLayoutFor } from '../src/config/tuning.js';

const STEP = 1 / 60;

function cellDesign(h: Harness, row: number, col: number): { x: number; y: number } {
    const layout = gridLayoutFor(h.game.grid.cols, h.game.grid.rows);
    return { x: layout.colCenterX(col), y: layout.rowCenterY(row) };
}

function screenOf(h: Harness, designX: number, designY: number): { x: number; y: number } {
    const s = { x: 0, y: 0 };
    h.services.viewport.designToScreen(s, designX, designY);
    return s;
}

/** 一帧：beginFrame → 投递本帧全部样本 → game.update → endFrame（与 App._fixedUpdate 同形）。 */
function frame(h: Harness, samples: Array<{ id: number; x: number; y: number; phase: 'down' | 'move' | 'up' }>): void {
    h.input.beginFrame();
    for (const s of samples) h.input.push({ ...s, time: 0 });
    h.game.update(STEP);
    h.input.endFrame(STEP);
}

function armTrayBead(h: Harness, row: number, col: number): void {
    const slot = h.game.giveTrayBead(h.game.grid.requiredColor(row, col));
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(h.game.selectTraySlot(slot)).toBe(true);
}

describe('棋盘区抬起才提交（WXG-T-169 / ADR-0015 C-3(a)）', () => {
    it('棋盘 tap：down 帧不落子，up 帧才提交', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.bit-tap' });
        expect(h.game.phase).toBe('playing');
        const cell = firstEmptyCell(h.game)!;
        armTrayBead(h, cell.row, cell.col);
        const p = cellDesign(h, cell.row, cell.col);
        const before = h.count('bead:placed');

        // down 帧：落在棋盘格心 → 登记，不提交。
        const d = screenOf(h, p.x, p.y);
        frame(h, [{ id: 1, x: d.x, y: d.y, phase: 'down' }]);
        expect(h.count('bead:placed')).toBe(before); // 未落子（旧行为此帧就会落）

        // 原地抬起 → tap → 抬起帧提交。
        frame(h, [{ id: 1, x: d.x, y: d.y, phase: 'up' }]);
        expect(h.count('bead:placed')).toBe(before + 1);
    });

    it('棋盘 drag：越阈值的单指拖拽不落子', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.bit-drag' });
        expect(h.game.phase).toBe('playing');
        const cell = firstEmptyCell(h.game)!;
        armTrayBead(h, cell.row, cell.col);
        const p0 = cellDesign(h, cell.row, cell.col);
        // 拖出足够大的设计位移（远超占位阈值 8）→ 判为 drag。
        const p1 = { x: p0.x - 120, y: p0.y - 120 };
        const before = h.count('bead:placed');

        const s0 = screenOf(h, p0.x, p0.y);
        frame(h, [{ id: 1, x: s0.x, y: s0.y, phase: 'down' }]);
        const s1 = screenOf(h, p1.x, p1.y);
        frame(h, [{ id: 1, x: s1.x, y: s1.y, phase: 'move' }]);
        frame(h, [{ id: 1, x: s1.x, y: s1.y, phase: 'up' }]);

        expect(h.count('bead:placed')).toBe(before); // 全程不落子（drag 属相机态）
    });
});
