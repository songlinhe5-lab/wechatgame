import { beforeEach, describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import { TRAY_BASE_SLOTS } from '../src/config/tuning.js';

/**
 * 【WXG-T-168 用户裁定（2026-09-18），**推翻 WXG-T-158 裁定①**】取回落槽口径：
 *  - ① **点槽定落位**：玩家点击的空槽 = 落位起点，整组**连续相邻**排布
 *    （`Tray.insertRun`）；旧「自动归类插同色堆尾 / 点槽仅作触发信号」作废。
 *  - ② **部分收纳 + 就近优先**：起点起的连续空槽数 < 组大小 ⇒ 只收 `count` 颗，
 *    取 `cells` 前 `count` 颗 —— `cells` 由 `collectMisplacedGroup` 按 8 向 BFS
 *    距锚层级产出 ⇒ 前 N 颗天然 = **离点击位置（锚珠）最近者优先**；余珠留格，
 *    锚改指剩余首颗**可续点**（内部状态，不发事件）。
 *  - ③ 起点零连续空槽（含满槽）⇒ 拒绝：零事件、零状态写。
 *
 * 场景构造沿用 `misplaced-group.test.ts`：noAssemble 空盘 + goToLevel + `fill`
 * 显式控色摆错位珠（组选筛色 ⇒ 组内必须同色）。
 */

/** 在 (r,c) 摆一颗色 1 的错位珠（simpleTestLevel 该列底色 ≠ 1，见既有判例）。 */
function putMisplaced1(h: Harness, r: number, c: number): void {
  expect(h.game.grid.fill(r, c, 1)).toBe(true);
}

/** 锚定 (2,2) 造 3 颗同色连通错位珠；BFS 距锚序 = [(2,2) 锚, (1,2), (3,2)]。 */
function putGroup3(h: Harness): void {
  putMisplaced1(h, 1, 2);
  putMisplaced1(h, 2, 2);
  putMisplaced1(h, 3, 2);
  expect(h.game.selectBoardBead(2, 2)).toBe(true);
}

describe('WXG-T-168 取回落槽 · 点槽定落位（推翻 WXG-T-158 裁定①）', () => {
  let h: Harness;
  beforeEach(() => {
    h = createBeadsHarness({
      seed: 'retrieve-landing-seed',
      noAssemble: true,
      levels: [simpleTestLevel()],
    });
    h.game.goToLevel(0);
  });

  it('点哪个空槽就从哪起连续排布：点槽 5 ⇒ 落 5/6/7，槽 0..4 仍 free（非归类）', () => {
    putGroup3(h);
    expect(h.game.retrieveSelectedGroup(5)).toBe(true);
    for (let i = 5; i <= 7; i++) {
      expect(h.game.tray.slot(i)!.state).toBe('holding');
      expect(h.game.tray.slot(i)!.colorIdx).toBe(1);
    }
    for (let i = 0; i < 5; i++) {
      expect(h.game.tray.slot(i)!.state).toBe('free'); // 归类口径会把珠插到 0..2
    }
    expect(h.game.grid.cell(2, 2)!.state).toBe('empty');
    expect(h.game.grid.cell(1, 2)!.state).toBe('empty');
    expect(h.game.grid.cell(3, 2)!.state).toBe('empty');
    expect(h.game.selection).toBe('none'); // 整组离格 ⇒ 锚清
  });

  it('连续空槽 1 < 组 3 ⇒ 只收最近 1 颗（锚珠），余 2 颗留格、锚保持', () => {
    putGroup3(h);
    expect(h.game.retrieveSelectedGroup(TRAY_BASE_SLOTS - 1)).toBe(true); // 点末槽 ⇒ room 1
    const stored = h.all<{ slot: number }>('tray:stored');
    expect(stored).toHaveLength(1);
    expect(stored[0]!.slot).toBe(TRAY_BASE_SLOTS - 1);
    expect(h.game.grid.cell(2, 2)!.state).toBe('empty'); // 距锚 0（最近）⇒ 被收
    expect(h.game.grid.cell(1, 2)!.state).toBe('filled'); // 距锚 1 ⇒ 留格
    expect(h.game.grid.cell(3, 2)!.state).toBe('filled');
    expect(h.game.selection).toBe('board'); // 锚改指剩余珠，可续点
  });

  it('部分收纳后可续点：逐槽续收，收完锚才清', () => {
    putGroup3(h);
    expect(h.game.retrieveSelectedGroup(TRAY_BASE_SLOTS - 1)).toBe(true); // 收 (2,2)
    expect(h.game.retrieveSelectedGroup(TRAY_BASE_SLOTS - 2)).toBe(true); // 收 (1,2)
    expect(h.game.grid.cell(1, 2)!.state).toBe('empty');
    expect(h.game.selection).toBe('board'); // 仍剩 (3,2)
    expect(h.game.retrieveSelectedGroup(TRAY_BASE_SLOTS - 3)).toBe(true); // 收 (3,2)
    expect(h.all<{ slot: number }>('tray:stored')).toHaveLength(3);
    expect(h.game.selection).toBe('none');
  });

  it('起点右侧被占 ⇒ 只填到第一个非 free 槽为止（insertRun 遇阻即止）', () => {
    // 槽 0 有珠、槽 1..3 free ⇒ 点槽 1 的连续空槽 = 1..3（3 个），够整组 3 颗。
    expect(h.game.giveTrayBead(2)).toBe(0);
    putGroup3(h);
    expect(h.game.retrieveSelectedGroup(1)).toBe(true);
    expect(h.game.tray.slot(1)!.colorIdx).toBe(1);
    expect(h.game.tray.slot(2)!.colorIdx).toBe(1);
    expect(h.game.tray.slot(3)!.colorIdx).toBe(1);
    expect(h.game.tray.slot(4)!.state).toBe('free'); // 未越界蔓延
    expect(h.game.tray.slot(0)!.colorIdx).toBe(2); // 既有珠不动
  });

  it('满槽（零空槽）⇒ 拒绝：零事件、零状态写、锚保持', () => {
    for (let i = 0; i < TRAY_BASE_SLOTS; i++) {
      expect(h.game.giveTrayBead((i % 3) + 1)).toBeGreaterThanOrEqual(0);
    }
    putGroup3(h);
    const before = h.all('tray:stored').length;
    expect(h.game.retrieveSelectedGroup()).toBe(false);
    expect(h.all('tray:stored')).toHaveLength(before);
    expect(h.game.grid.cell(2, 2)!.state).toBe('filled');
    expect(h.game.grid.isMisplaced(2, 2)).toBe(true);
  });
});
