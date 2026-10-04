/**
 * [T-244 二十二批 · 用户令] **珠色守恒哨兵**判据。
 *
 * 口径两条：
 *  ① **命令级**（相对）：一次托盘入/出珠命令收口时，「盘上 filled 珠 + 托盘 holding 珠」的
 *    每色计数必须与命令入口**逐色相同** —— 珠只能移动（盘→托 / 托→盘 / 盘→盘），不能变色生灭。
 *  ② **体检级**（绝对，公开 `checkBeadConservation`）：整张盘（盘 + 托）每色实数 == 图案每色目标
 *    （`giveTrayBead` 夹具凭空量并入基准，故不误报）。
 *
 * 为什么要这条哨兵：用户 2026-10-04 抓到一张「盘面空格色 ≠ 托盘存珠色」的死盘（某色 −3 / 另一色 +3），
 * 当时**运行时无任何信号**，只能靠离线采图 + fuzz 定位（根因 = harness 调试注入，该钩子已裁）。
 * 本哨兵把这类失衡变成**当场一条 console.error**。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBeadsHarness } from './helpers.js';
import { LEVELS_DATA } from '../src/config/levels-data.js';
import type { BeadsGame } from '../src/game/beads-game.js';

/** 行主序首颗错位珠（本关初盘大片错位，恒有）。 */
function firstMisplaced(game: BeadsGame): { row: number; col: number; color: number } {
    const g = game.grid;
    for (let r = 0; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++) {
            if (g.isMisplaced(r, c)) return { row: r, col: c, color: g.cell(r, c)!.beadColorIdx };
        }
    }
    throw new Error('no misplaced bead');
}

/** 初盘满盘 ⇒ 「对色空格」得自己腾：`target` = 底色等于 `bead` 珠色的另一颗错位珠。 */
function findPair(game: BeadsGame): {
    color: number;
    bead: { row: number; col: number };
    target: { row: number; col: number };
} {
    const g = game.grid;
    for (let r = 0; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++) {
            if (!g.isMisplaced(r, c)) continue;
            const color = g.cell(r, c)!.beadColorIdx;
            for (let r2 = 0; r2 < g.rows; r2++) {
                for (let c2 = 0; c2 < g.cols; c2++) {
                    if (r2 === r && c2 === c) continue;
                    if (!g.isMisplaced(r2, c2)) continue;
                    if (g.cell(r2, c2)!.colorIdx === color) return { color, bead: { row: r, col: c }, target: { row: r2, col: c2 } };
                }
            }
        }
    }
    throw new Error('no retrievable pair');
}

/** 托盘里首颗 `color` 的 holding 槽。 */
function holdingSlot(game: BeadsGame, color: number): number {
    const t = game.tray;
    for (let s = 0; s < t.capacity; s++) {
        const slot = t.slot(s);
        if (slot && slot.state !== 'free' && slot.colorIdx === color) return s;
    }
    throw new Error(`no tray slot holding color ${color}`);
}

describe('珠色守恒哨兵（T-244 二十二批）', () => {
    let err: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        err = vi.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('合法「取回 → 落子」链不误报', () => {
        const h = createBeadsHarness();
        h.game.goToLevel(0);
        const p = findPair(h.game);
        expect(h.game.retrieveBead(p.target.row, p.target.col)).toBe(true); // 先腾出对色空格
        expect(h.game.retrieveBead(p.bead.row, p.bead.col)).toBe(true); // 入
        h.game.selectTraySlot(holdingSlot(h.game, p.color));
        expect(h.game.tapGridCell(p.target.row, p.target.col)).toBe(true); // 出
        expect(err).not.toHaveBeenCalled();
    });

    it('变异核得：托盘落子多抹一颗珠 ⇒ 命令级哨兵报红', () => {
        const h = createBeadsHarness();
        h.game.goToLevel(0);
        const p = findPair(h.game);
        expect(h.game.retrieveBead(p.target.row, p.target.col)).toBe(true);
        expect(h.game.retrieveBead(p.bead.row, p.bead.col)).toBe(true);
        h.game.selectTraySlot(holdingSlot(h.game, p.color));

        // 注入故障（= 用户怀疑的「混色时把邻珠一起抹掉」）：取本颗时**连带抹掉块首那颗**（紧凑不变式 ⇒ 槽 0 恒为 holding）
        const tray = h.game.tray;
        const real = tray.takeBead.bind(tray);
        let injected = false;
        vi.spyOn(tray, 'takeBead').mockImplementation((slot: number) => {
            const ok = real(slot);
            if (ok && !injected) {
                injected = true;
                real(0);
            }
            return ok;
        });

        expect(h.game.tapGridCell(p.target.row, p.target.col)).toBe(true);
        expect(err).toHaveBeenCalledTimes(1);
        const msg = String(err.mock.calls[0]![0]);
        expect(msg).toContain('珠色守恒破坏');
        expect(msg).toContain('托盘落子 place');
    });

    it('绝对体检能报「历史污染」的盘（复刻已裁的 harness 注入手法）', () => {
        const h = createBeadsHarness();
        h.game.goToLevel(0);
        expect(err).not.toHaveBeenCalled(); // 装配即体检 ⇒ 干净盘零红
        const m = firstMisplaced(h.game);
        const g = h.game.grid;
        g.setBead(m.row, m.col, m.color === 1 ? 2 : 1); // 原珠就地销毁（改色）
        g.retrieve(m.row, m.col); // 取走即丢弃（不入托盘）
        expect(h.game.checkBeadConservation('取证')).toBe(false);
        expect(err).toHaveBeenCalledTimes(1);
        expect(String(err.mock.calls[0]![0])).toContain('珠色守恒破坏 · 取证');
    });

    it('giveTrayBead 夹具凭空量并入基准 ⇒ 体检不误报', () => {
        const h = createBeadsHarness();
        h.game.goToLevel(0);
        expect(h.game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);
        expect(h.game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);
        expect(h.game.checkBeadConservation('夹具注入后')).toBe(true);
        expect(err).not.toHaveBeenCalled();
    });

    it('关表每关初盘装配都过得了体检（数据面守恒的运行时保证）', () => {
        const h = createBeadsHarness();
        for (let i = 0; i < LEVELS_DATA.levels.length; i++) h.game.goToLevel(i);
        expect(err).not.toHaveBeenCalled();
    });
});
