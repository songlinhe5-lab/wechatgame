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

    // WXG-T-170 · F1：同一固定步内 down+up 到达（真机 <16ms 快点、探针 tapChain 同形）
    // ⇒ 位移恒 0 = 即时 tap，应**当场提交**且 `_tapActive` 不悬挂。
    it('同固定步 down+up：棋盘区即时 tap 当场提交（F1 回归例）', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.bit-subframe' });
        expect(h.game.phase).toBe('playing');
        const cell = firstEmptyCell(h.game)!;
        armTrayBead(h, cell.row, cell.col);
        const p = cellDesign(h, cell.row, cell.col);
        const s = screenOf(h, p.x, p.y);
        const before = h.count('bead:placed');

        // 一帧内同时投递 down + up（InputManager 快照读出 justDown=true && justUp=true、isDown=false）。
        frame(h, [
            { id: 1, x: s.x, y: s.y, phase: 'down' },
            { id: 1, x: s.x, y: s.y, phase: 'up' },
        ]);
        expect(h.count('bead:placed')).toBe(before + 1); // 当场提交（旧行为：本帧吞掉、_tapActive 悬挂）

        // 后续空帧不得**再次**提交（`_tapActive` 须已复位；悬挂会让下一 tap 双落）。
        frame(h, []);
        frame(h, []);
        expect(h.count('bead:placed')).toBe(before + 1);
    });

    // WXG-T-171 · F2：位移度量形态 = **切比雪夫 L∞ = max(|dx|,|dy|)**（GDD v2.5 §2.1 字面口径）。
    // 设计偏移 (5,5)：L∞=5 < 8 应判 tap（提交）；L1=10 ≥ 8 旧实现会误判 drag（不提交）。
    // 本例锁住形态口径，防止回归到曼哈顿。阈值数值本身 `[待确认]`（属 §3 变更单），本例不钉定值。
    it('位移度量 = 切比雪夫 L∞（F2 回归例：(5,5) 应判 tap）', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.bit-metric' });
        expect(h.game.phase).toBe('playing');
        const cell = firstEmptyCell(h.game)!;
        armTrayBead(h, cell.row, cell.col);
        const p0 = cellDesign(h, cell.row, cell.col);
        // 5 < 阈值 8 < 10 ⇒ L∞/L1 分歧区；同时 (5,5) 仍在格心半径内（格子≈ 46 px），不会因跨格而失败。
        const p1 = { x: p0.x + 5, y: p0.y + 5 };
        const before = h.count('bead:placed');

        const s0 = screenOf(h, p0.x, p0.y);
        const s1 = screenOf(h, p1.x, p1.y);
        frame(h, [{ id: 1, x: s0.x, y: s0.y, phase: 'down' }]);
        frame(h, [{ id: 1, x: s1.x, y: s1.y, phase: 'move' }]);
        frame(h, [{ id: 1, x: s1.x, y: s1.y, phase: 'up' }]);

        expect(h.count('bead:placed')).toBe(before + 1); // 切比雪夫下判 tap ⇒ 抬起提交（旧曼哈顿下为 drag ⇒ 不提交）
    });
});
