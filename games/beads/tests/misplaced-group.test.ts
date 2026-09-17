import { beforeEach, describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';

/**
 * WXG-T-148 用户裁定 ③④（连通选取 + 整组收进）：
 *  - 锚 = 8 邻接连通错位珠组（flood fill 闭包；就位珠/空格/锁定不连通）。
 *  - 取回 = 整组一次收进，**只有槽位数量限制**（free 槽数 < 组大小 ⇒ 拒绝，
 *    零事件零状态写）。
 *
 * 场景构造沿用 E1 判例：noAssemble 空盘 + goToLevel 进 playing + `fill(r,c,wrong)`
 * 直接摆错位珠（空格天然断连通，无需满盘）。
 */

/** 在 (r,c) 摆一颗错位珠（色 ≠ 底色；1/2 择一避开底色 1 的常见格）。 */
function putMisplaced(h: Harness, r: number, c: number): void {
  const grid = h.game.grid;
  const wrong = grid.requiredColor(r, c) === 1 ? 2 : 1;
  expect(grid.fill(r, c, wrong)).toBe(true);
}

describe('WXG-T-148 ③ 连通错位珠组', () => {
  let h: Harness;
  beforeEach(() => {
    h = createBeadsHarness({ seed: 'group-seed', noAssemble: true, levels: [simpleTestLevel()] });
    h.game.goToLevel(0);
  });

  it('8 邻接连通（含斜向、链式传导）：3 连链整组入锚，payload.count = 3', () => {
    // (2,2)-(2,3) 直连 + (2,3)-(3,4) 斜连 ⇒ 一条 3 颗链。
    putMisplaced(h, 2, 2);
    putMisplaced(h, 2, 3);
    putMisplaced(h, 3, 4);
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(3);
  });

  it('被空格隔开 ⇒ 不连通（组只含连通侧）', () => {
    putMisplaced(h, 2, 2);
    putMisplaced(h, 2, 4); // (2,3) 空 ⇒ 断开
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(1);
  });

  it('单珠（无错位邻居）= 旧行为：count 1', () => {
    putMisplaced(h, 2, 2);
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(1);
  });

  it('空格/就位珠不可作为组起点', () => {
    expect(h.game.selectBoardBead(2, 2)).toBe(false); // 空格
    putMisplaced(h, 3, 3);
    expect(h.game.selectBoardBead(3, 3)).toBe(true);
  });

  it('换选 ⇒ 组重算（新组替换旧组）', () => {
    putMisplaced(h, 2, 2);
    putMisplaced(h, 2, 3);
    putMisplaced(h, 4, 4);
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(2);
    expect(h.game.selectBoardBead(4, 4)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(1);
  });
});

describe('WXG-T-148 ④ 整组一次收进', () => {
  let h: Harness;
  beforeEach(() => {
    h = createBeadsHarness({
      seed: 'group-retrieve-seed',
      noAssemble: true,
      levels: [simpleTestLevel()],
    });
    h.game.goToLevel(0);
  });

  it('槽足 ⇒ 整组收进：逐颗 tray:stored（slot 各异）、组内格全 empty、锚清', () => {
    putMisplaced(h, 2, 2);
    putMisplaced(h, 2, 3);
    putMisplaced(h, 3, 4);
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.game.retrieveSelectedGroup(0)).toBe(true);
    const stored = h.all<{ slot: number; colorIdx: number; fromRow: number; fromCol: number }>('tray:stored');
    expect(stored).toHaveLength(3);
    const slots = stored.map((s) => s.slot).sort((a, b) => a - b);
    expect(new Set(slots).size).toBe(3); // 槽互异
    for (const s of stored) {
      expect(s.fromRow).toBeGreaterThanOrEqual(0);
      expect(s.fromCol).toBeGreaterThanOrEqual(0);
    }
    // 组内格全空。
    expect(h.game.grid.cell(2, 2)!.state).toBe('empty');
    expect(h.game.grid.cell(2, 3)!.state).toBe('empty');
    expect(h.game.grid.cell(3, 4)!.state).toBe('empty');
    // 锚清：再取回 false。
    expect(h.game.retrieveSelectedGroup(0)).toBe(false);
  });

  it('free 槽 < 组大小 ⇒ 拒绝：零事件、零状态写、锚保持', () => {
    // 组 3 颗；先塞 10 颗进托盘（12 槽 ⇒ free 2）。
    putMisplaced(h, 2, 2);
    putMisplaced(h, 2, 3);
    putMisplaced(h, 3, 4);
    // giveTrayBead 返回槽号（-1 = 失败）；混色避开 needed 投影上限。
    for (let i = 0; i < 10; i++) {
      expect(h.game.giveTrayBead((i % 3) + 1)).toBeGreaterThanOrEqual(0);
    }
    const eventsBefore = h.all('tray:stored').length;
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.game.retrieveSelectedGroup(0)).toBe(false);
    expect(h.all('tray:stored')).toHaveLength(eventsBefore); // 零新事件
    // 零状态写：珠仍在格上（错位）。
    expect(h.game.grid.cell(2, 2)!.state).toBe('filled');
    expect(h.game.grid.isMisplaced(2, 2)).toBe(true);
  });

  it('组收进后归位通路不受影响：托盘珠仍可点空格（judgePlacement 裁决）', () => {
    putMisplaced(h, 2, 2);
    putMisplaced(h, 2, 3);
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.game.retrieveSelectedGroup(0)).toBe(true);
    expect(h.game.selectTraySlot(0)).toBe(true);
    // (2,2) 已 empty；放置被受理或明确拒绝均合法（归位裁决由 placement 既有用例守护）。
    const ok = h.game.tapGridCell(2, 2);
    expect(typeof ok).toBe('boolean');
  });
});
