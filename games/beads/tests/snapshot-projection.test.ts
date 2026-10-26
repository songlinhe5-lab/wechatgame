/**
 * 快照投影对拍（WXG-T-420 T6）。
 *
 * 判据 = `docs/architecture/beads-arch-review-2026-10-26.md` §6 T6 行 +
 * `production/TASKS-DETAIL.md` WXG-T-420 §3.6：`_syncSnapshot` 抽到
 * `game/beads-game/snapshot-projection.ts`，**复用原快照对象原地写回**、
 * **逐字段对拍一致**、**每帧不新增集合/对象分配**。
 *
 * 反假绿纪律（K-042 / K-152）：本文件不把投影逐行复制成第二份真源来对拍，而是
 * 立**独立不变量**——
 *   ① 键全集 = `createSnapshot` 造的**契约对象**形状（`state.ts` 是字段唯一真源，
 *      投影只写值不增删键；误写 `s.typoField=…` 会多出键 ⇒ 红）；
 *   ② 每块投影值 = 对应**权威状态源**的表达式（grid / tray / settings / timer /
 *      powerups / mode …），getter 迁错成员或漏写某块 ⇒ 值不匹配 ⇒ 红；
 *   ③ 原地复用：跨帧读快照，稳定缓冲（cells / traySlots / powerupFreeUses /
 *      solver 数组）**同一实例** ⇒ 证「零重分配」；快照对象本身亦同实例。
 * 端到端逐字段值仍由既有 20+ 读 `game.snapshot` 的用例（view-model / ui-golden /
 * play-page / revive / combo-vfx / solver-vfx / stars-total-hud …）集体守，本单只补
 * 它们没作为**整体**断言的投影契约与接线证明（K-106：新模块被主类实际走到）。
 */

import { describe, expect, it } from 'vitest';

import { createSnapshot, type BeadsSnapshot } from '../src/game/state.js';
import { DEFAULT_TUNING, powerupBuyPrice } from '../src/config/tuning.js';
import { projectSnapshot } from '../src/game/beads-game/snapshot-projection.js';
import { createBeadsHarness, placeColor, simpleTestLevel, type Harness } from './helpers.js';

/** 空盘（noAssemble）起一局 6×5 测试关，逐用例自行构造所需局面。 */
function booted(): Harness {
    return createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel({ id: 90 })] });
}

describe('WXG-T-420 T6 · 快照投影契约（逐字段对拍一致 / 原地写回 / 零重分配）', () => {
    it('模块被主类接线：projectSnapshot 就位并被实际走到（K-106）', () => {
        expect(typeof projectSnapshot).toBe('function');
        // 读一次快照即经 `_syncSnapshot → projectSnapshot`；值随权威状态更新 ⇒ 非死代码。
        const h = booted();
        const before = h.game.snapshot.remaining;
        h.advance(3);
        expect(h.game.snapshot.remaining).not.toBe(before);
    });

    it('① 键全集 = createSnapshot 契约对象（投影不增不减键）', () => {
        const h = booted();
        placeColor(h.game, h.game.grid.requiredColor(0, 0), 0, 0);
        const projected = Object.keys(h.game.snapshot).sort();
        const contract = Object.keys(createSnapshot(DEFAULT_TUNING) as unknown as BeadsSnapshot).sort();
        expect(projected).toEqual(contract);
    });

    it('② 逐格内容对拍 · s.cells 与权威 BeadGrid 逐字段一致', () => {
        const h = booted();
        const g = h.game;
        expect(placeColor(g, g.grid.requiredColor(0, 0), 0, 0)).toBe(true);
        const s = g.snapshot;
        expect(s.gridCols).toBe(6);
        expect(s.gridRows).toBe(5);
        for (let row = 0; row < s.gridRows; row++) {
            for (let col = 0; col < s.gridCols; col++) {
                const cell = g.grid.cell(row, col)!;
                expect(s.cells[row * s.gridCols + col]).toEqual({
                    state: cell.state,
                    colorIdx: cell.colorIdx,
                    beadColorIdx: cell.beadColorIdx,
                    void: cell.void,
                });
            }
        }
        // 放下的那颗确已落子（非恒等空盘 ⇒ 证投影随源变化）。
        expect(s.cells[0]!.state).not.toBe('empty');
    });

    it('② 托盘槽对拍 · s.traySlots 逐槽反映 Tray 且容量匹配', () => {
        const h = booted();
        const g = h.game;
        placeColor(g, g.grid.requiredColor(0, 0), 0, 0);
        const s = g.snapshot;
        expect(s.traySlots.length).toBe(g.tray.capacity);
        for (let i = 0; i < s.traySlots.length; i++) {
            const slot = g.tray.slot(i)!;
            expect(s.traySlots[i]).toEqual({ state: slot.state, colorIdx: slot.colorIdx });
        }
        expect(s.traySelected).toBe(g.tray.selectedSlot);
    });

    it('② 模式位对拍 · 普通模式冲刺 HUD 归零（源 = mode 判定）', () => {
        const s = booted().game.snapshot;
        expect(s.mode).toBe('normal');
        expect(s.score).toBe(0);
        expect(s.multiplier).toBe(1);
        expect(s.streak).toBe(0);
    });

    it('② 设置回显对拍 · snapshot 读 settings.values（beadStyle/skinId/vibrate）', () => {
        const g = booted().game;
        const s = g.snapshot;
        expect(s.beadStyle).toBe(g.beadStyle);
        expect(s.skinId).toBe(g.skinId);
        expect(s.vibrate).toBe(g.vibrateOn);
        expect(s.bgmMuted).toBe(g.bgmMuted);
        expect(s.reduceMotion).toBe(g.reduceMotion);
    });

    it('② 道具/购买对拍 · powerupHint 与 buyConfirmPrice 随源', () => {
        const g = booted().game;
        const s = g.snapshot;
        expect(s.powerupHint).toBe(g.powerupHint);
        expect(s.buyConfirmPrice).toBe(g.pendingPowerupBuy ? powerupBuyPrice(g.pendingPowerupBuy) : 0);
        expect(s.powerupFreeUses.windowRestore).toBe(g.powerups.freeUses('windowRestore'));
        expect(s.powerupFreeUses.randomRestore).toBe(g.powerups.freeUses('randomRestore'));
        expect(s.powerupFreeUses.trayRestore).toBe(g.powerups.freeUses('trayRestore'));
    });

    it('② 时间/相位对拍 · remaining = ceil(源 − 1e-9)、phase 随状态机', () => {
        const h = booted();
        h.advance(2);
        const g = h.game;
        const s = g.snapshot;
        expect(s.phase).toBe(g.phase);
        expect(s.remaining).toBe(Math.max(0, Math.ceil(g.remaining - 1e-9)));
    });

    it('② 首屏引导短路对拍 · ONBOARDING_ENABLED=false ⇒ 提示位恒 −1', () => {
        const s = booted().game.snapshot;
        expect(s.onboarding).toBe(false);
        expect(s.hintRow).toBe(-1);
        expect(s.hintCol).toBe(-1);
        expect(s.guideSlot).toBe(-1);
    });

    it('② 解环器未激活对拍 · 进度/计数归零、数组填 −1 零残留', () => {
        const s = booted().game.snapshot;
        expect(s.solverProgress).toBe(0);
        expect(s.solverCellCount).toBe(0);
        expect(s.solverLandCount).toBe(0);
        for (const v of s.solverCellRows) expect(v).toBe(-1);
        for (const v of s.solverCellCols) expect(v).toBe(-1);
    });

    it('③ 原地写回 · 跨帧读快照为同一对象、稳定缓冲不重分配（零新增分配）', () => {
        const h = booted();
        const g = h.game;
        const s1 = g.snapshot;
        const cellsRef = s1.cells;
        const trayRef = s1.traySlots;
        const freeUsesRef = s1.powerupFreeUses;
        const solverRowsRef = s1.solverCellRows;
        h.advance(2); // 两帧：维度/容量未变
        const s2 = g.snapshot;
        expect(s2).toBe(s1); // 复用同一快照对象（非新建）
        expect(s2.cells).toBe(cellsRef); // 盘格缓冲原地写回
        expect(s2.traySlots).toBe(trayRef);
        expect(s2.powerupFreeUses).toBe(freeUsesRef); // 嵌套对象原地写回不重建
        expect(s2.solverCellRows).toBe(solverRowsRef);
    });
});
