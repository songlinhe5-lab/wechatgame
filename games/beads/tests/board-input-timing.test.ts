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
import { gridLayoutFor, PUZZLE_BAND, TRAY_BAND, BOARD_TAP_MOVE_THRESHOLD } from '../src/config/tuning.js';

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

    // ── WXG-T-169 收口批 · QA `test-cases.md §A4c.2` 落点补齐 ───────────────────
    // 本轮前状态：以下四条「判据已冻结 + `[Node]` 可证」但**无落点**⇒ 始终标 `待执行`。
    // TC-SUB-05（跨带误触）本轮**仍无落点**：占位阈值 8 < 带间隙 30 ⇒ 当前形状构不出
    // 「位移<阈值却跨带」（QA §A4c.4-F5），强行构造只能靠改占位值自证 ⇒ 只补下面这条护栏锁。

    it('TC-CAM-09 相机旁路：PAUSED 态拖拽/双指不改相机、不产玩法指令', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.bit-bypass' });
        const cell = firstEmptyCell(h.game)!;
        armTrayBead(h, cell.row, cell.col);
        h.game.onPause();
        expect(h.game.phase).toBe('paused');

        const p = cellDesign(h, cell.row, cell.col);
        const s0 = screenOf(h, p.x, p.y);
        const s1 = screenOf(h, p.x - 150, p.y - 150);
        const pitch0 = h.game.snapshot.gridPitch;
        const left0 = h.game.snapshot.gridLeft;
        const top0 = h.game.snapshot.gridTop;
        const placed0 = h.count('bead:placed');
        const selected0 = h.count('tray:selected');

        // 拖拽 + 次指落下 + 张开捏合 + 抬起，全部在非 PLAYING 相位投递。
        frame(h, [{ id: 1, x: s0.x, y: s0.y, phase: 'down' }]);
        frame(h, [
            { id: 1, x: s1.x, y: s1.y, phase: 'move' },
            { id: 2, x: s1.x + 40, y: s1.y + 40, phase: 'down' },
        ]);
        frame(h, [
            { id: 1, x: s1.x - 60, y: s1.y - 60, phase: 'move' },
            { id: 2, x: s1.x + 90, y: s1.y + 90, phase: 'move' },
        ]);
        frame(h, [
            { id: 1, x: s1.x - 60, y: s1.y - 60, phase: 'up' },
            { id: 2, x: s1.x + 90, y: s1.y + 90, phase: 'up' },
        ]);

        // 相机逐分量不变（旁路⇒ `gridLayoutFor` 不重算）。
        expect(h.game.snapshot.gridPitch).toBe(pitch0);
        expect(h.game.snapshot.gridLeft).toBe(left0);
        expect(h.game.snapshot.gridTop).toBe(top0);
        // 不产玩法指令；且抬起也不回落到 tap 提交（旁路不是「延后提交」）。
        expect(h.count('bead:placed')).toBe(placed0);
        expect(h.count('tray:selected')).toBe(selected0);
    });

    it('TC-SUB-03 拖→捏态切换不提交：次指落下后主指抬起不产 tap', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.bit-pinch-suppress' });
        expect(h.game.phase).toBe('playing');
        const cell = firstEmptyCell(h.game)!;
        armTrayBead(h, cell.row, cell.col);
        const p = cellDesign(h, cell.row, cell.col);
        const s0 = screenOf(h, p.x, p.y);
        // 位移 3 < 阈值 ⇒ 未转 drag（若无 `_pinched` 压制，下帧抬起就会提交）。
        const s1 = screenOf(h, p.x + 3, p.y + 3);
        const before = h.count('bead:placed');
        const selected0 = h.count('tray:selected');

        frame(h, [{ id: 1, x: s0.x, y: s0.y, phase: 'down' }]);
        frame(h, [{ id: 1, x: s1.x, y: s1.y, phase: 'move' }]);
        frame(h, [
            { id: 1, x: s1.x, y: s1.y, phase: 'move' },
            { id: 2, x: s1.x + 50, y: s1.y + 50, phase: 'down' }, // 次指落下 ⇒ `_pinched` 置位
        ]);
        frame(h, [{ id: 1, x: s1.x, y: s1.y, phase: 'up' }]); // 主指抬起 ⇒ **不得**提交 tap

        expect(h.count('bead:placed')).toBe(before);
        expect(h.count('tray:selected')).toBe(selected0);
    });

    it('TC-SUB-04 指令洪泛：多组成对 down/up ⇒ 每固定步 ≤1 条玩法指令、无漏无重', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.bit-flood' });
        expect(h.game.phase).toBe('playing');
        let placed = 0;
        let pairs = 0;
        for (let i = 0; i < 20; i++) {
            const cell = firstEmptyCell(h.game);
            if (!cell) break;
            armTrayBead(h, cell.row, cell.col);
            const s = screenOf(h, cellDesign(h, cell.row, cell.col).x, cellDesign(h, cell.row, cell.col).y);

            frame(h, [{ id: 1, x: s.x, y: s.y, phase: 'down' }]);
            const afterDown = h.count('bead:placed');
            expect(afterDown - placed).toBe(0); // down 帧恒 0 条（抬起才提交）

            frame(h, [{ id: 1, x: s.x, y: s.y, phase: 'up' }]);
            const afterUp = h.count('bead:placed');
            expect(afterUp - afterDown).toBe(1); // up 帧恰 1 条：不漏也不双落

            placed = afterUp;
            pairs += 1;
        }
        expect(pairs).toBeGreaterThanOrEqual(10); // 洪泛规模下标：≥10 组（20 帧成对投递），受测试关盘面容量限制
        expect(placed).toBe(pairs);
    });

    it('TC-SUB-07 drag 途中跨格：逐帧零选中零落子（§8-3 后移子句）', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.bit-drag-cross' });
        expect(h.game.phase).toBe('playing');
        const cell = firstEmptyCell(h.game)!;
        armTrayBead(h, cell.row, cell.col);
        const p0 = cellDesign(h, cell.row, cell.col);
        const placed0 = h.count('bead:placed');
        const selected0 = h.count('tray:selected');

        frame(h, [{ id: 1, x: screenOf(h, p0.x, p0.y).x, y: screenOf(h, p0.x, p0.y).y, phase: 'down' }]);
        // 逐帧扫过整盘（跨越多行多列格心）：每帧都不得改选择锚或落子。
        for (let k = 1; k <= 8; k++) {
            const s = screenOf(h, p0.x + k * 25, p0.y - k * 25);
            frame(h, [{ id: 1, x: s.x, y: s.y, phase: 'move' }]);
            expect(h.count('bead:placed')).toBe(placed0);
            expect(h.count('tray:selected')).toBe(selected0);
        }
        // **抬起点回到已备珠的格心**（该处落子合法）：若 drag 判定失效（阈值过大），
        // 本帧就会提交 ⇒ 本例红；口径成立时抬起被压，全程零指令。跨格逐帧另证「零选中」。
        const sEnd = screenOf(h, p0.x, p0.y);
        frame(h, [{ id: 1, x: sEnd.x, y: sEnd.y, phase: 'up' }]);
        expect(h.count('bead:placed')).toBe(placed0);
        expect(h.count('tray:selected')).toBe(selected0);
    });

    // WXG-T-167 预检副产品：探针/真机 Console 的调试读回口必须与真源同一份算法，
    // 否则「zoom≠1 命中正确」就变成探针自证（K-042）。本例锁住两件事：
    //   ① debugCellCenter 与 `gridLayoutFor`（布局真源）逐位相同；
    //   ② debugHitCell 对该格心回判为同格，且越界入参返回 null（不猜）。
    it('调试读回口与布局真源同构（debugCellCenter / debugHitCell）', () => {
        const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.bit-debug-api' });
        const { cols, rows } = h.game.grid;
        const truth = gridLayoutFor(cols, rows);

        for (const [row, col] of [[0, 0], [rows - 1, cols - 1], [2, 3]] as const) {
            const c = h.game.debugCellCenter(row, col)!;
            expect(c.x).toBe(truth.colCenterX(col));
            expect(c.y).toBe(truth.rowCenterY(row));
            expect(h.game.debugHitCell(c.x, c.y)).toEqual({ row, col });
        }
        expect(h.game.debugCellCenter(-1, 0)).toBeNull();
        expect(h.game.debugCellCenter(0, cols)).toBeNull();
    });

    it('F5 几何护栏锁：位移阈值必小于盘面带间隙（否则跨带误触可构造）', () => {
        // QA §A4c.4-F5：占位阈值 8 < 间隙 30 ⇒ TC-SUB-05「位移<阈值却跨带」不可构造。
        // 本例不证行为，只锁**选型护栏**：§3 变更单若把阈值定到 ≥ 间隙，立即红。
        const bandGap = PUZZLE_BAND.yMin - TRAY_BAND.yMax;
        expect(bandGap).toBeGreaterThan(0);
        expect(BOARD_TAP_MOVE_THRESHOLD).toBeLessThan(bandGap);
    });
});
