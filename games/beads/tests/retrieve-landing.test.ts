import { beforeEach, describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import { TRAY_BASE_SLOTS } from '../src/config/tuning.js';
import type { Tray } from '../src/entities/tray.js';

/**
 * 【WXG-T-204 用户裁定（2026-09-23），推翻 WXG-T-168「点槽定落位」，恢复 WXG-T-158
 * 裁定①自动归类】取回落槽口径：
 *  - **落位 = `insertGrouped` 自动归类**：新色从最左可用空格追加、已有色插到同色块尾
 *    并把后面的珠右移 ⇒ 托盘恒「紧凑无洞（珠占 [0..holdingCount-1]）+ 同色连续成块」。
 *  - 玩家点击的空槽**仅作 4b 取回触发**，不再决定落位。
 *  - **部分收纳**：可收数 = `min(组大小, tray.freeCount)`，所收 = 组珠消费序前缀；
 *    余珠留格、锚改指剩余首颗可续点（内部状态，不发事件）。
 *  - 满槽（`freeCount = 0`）⇒ 拒绝：零事件、零状态写。
 *
 * 场景构造沿用 `misplaced-group.test.ts`：noAssemble 空盘 + goToLevel + `grid.fill`
 * 显式摆错位珠（组选筛色 ⇒ 组内同色 1，simpleTestLevel 该列底色 ≠ 1）。
 * 断言以**不变式**为主（紧凑无洞 + 同色成块），不钉死具体槽号（点槽已不影响落位）。
 */

/** 在 (r,c) 摆一颗色 1 的错位珠。 */
function putMisplaced1(h: Harness, r: number, c: number): void {
  expect(h.game.grid.fill(r, c, 1)).toBe(true);
}

/** 锚定 (2,2) 造 3 颗同色连通错位珠。 */
function putGroup3(h: Harness): void {
  putMisplaced1(h, 1, 2);
  putMisplaced1(h, 2, 2);
  putMisplaced1(h, 3, 2);
  expect(h.game.selectBoardBead(2, 2)).toBe(true);
}

/** 紧凑无洞不变式：非 free 珠恒占 [0..holdingCount-1]，其后全 free。 */
function assertCompact(tray: Tray): void {
  const held = tray.holdingCount;
  for (let i = 0; i < held; i++) expect(tray.slot(i)!.state).not.toBe('free');
  for (let i = held; i < tray.capacity; i++) expect(tray.slot(i)!.state).toBe('free');
}

/** 同色成块不变式：每个颜色只出现一段（不被他色分隔 ⇒ 无 A-B-A）。 */
function assertGrouped(tray: Tray): void {
  const seen = new Set<number>();
  let prev = -1;
  for (let i = 0; i < tray.holdingCount; i++) {
    const c = tray.slot(i)!.colorIdx;
    if (c !== prev) {
      expect(seen.has(c)).toBe(false); // 该色已在前段出现 ⇒ 被分隔，违归类
      seen.add(c);
      prev = c;
    }
  }
}

describe('WXG-T-204 取回落槽 · 自动归类（推翻 WXG-T-168 点槽定落位）', () => {
  let h: Harness;
  beforeEach(() => {
    h = createBeadsHarness({
      seed: 'retrieve-landing-seed',
      noAssemble: true,
      levels: [simpleTestLevel()],
    });
    h.game.goToLevel(0);
  });

  it('空盘整组收进 ⇒ 3 颗落 0/1/2（同色成块、紧凑），组内格全 empty、锚清', () => {
    putGroup3(h);
    expect(h.game.retrieveSelectedGroup()).toBe(true);
    const stored = h.all<{ slot: number }>('tray:stored');
    expect(stored).toHaveLength(3);
    expect(new Set(stored.map((s) => s.slot)).size).toBe(3); // 槽互异
    for (let i = 0; i <= 2; i++) {
      expect(h.game.tray.slot(i)!.state).not.toBe('free');
      expect(h.game.tray.slot(i)!.colorIdx).toBe(1);
    }
    expect(h.game.grid.cell(1, 2)!.state).toBe('empty');
    expect(h.game.grid.cell(2, 2)!.state).toBe('empty');
    expect(h.game.grid.cell(3, 2)!.state).toBe('empty');
    expect(h.game.selection).toBe('none');
    assertCompact(h.game.tray);
    assertGrouped(h.game.tray);
  });

  it('新色从最左可用空格起填：异色占 0 ⇒ 同色组落 1/2/3 连续', () => {
    expect(h.game.giveTrayBead(2)).toBe(0); // 色 2 占槽 0
    putGroup3(h);
    expect(h.game.retrieveSelectedGroup()).toBe(true);
    expect(h.game.tray.slot(0)!.colorIdx).toBe(2); // 既有珠不动
    for (let i = 1; i <= 3; i++) expect(h.game.tray.slot(i)!.colorIdx).toBe(1);
    expect(h.game.tray.slot(4)!.state).toBe('free'); // 未越界蔓延
    assertCompact(h.game.tray);
    assertGrouped(h.game.tray);
  });

  it('已有同色 ⇒ 归类合并到该色块尾，把他色右移（同色放一起）', () => {
    // 先摆 [1, 2]（色 1 块尾 = 0、色 2 在 1），再收 3 颗色 1 ⇒ 应合并为 [1,1,1,1, 2]。
    expect(h.game.giveTrayBead(1)).toBe(0);
    expect(h.game.giveTrayBead(2)).toBe(1);
    putGroup3(h);
    expect(h.game.retrieveSelectedGroup()).toBe(true);
    for (let i = 0; i <= 3; i++) expect(h.game.tray.slot(i)!.colorIdx).toBe(1);
    expect(h.game.tray.slot(4)!.colorIdx).toBe(2); // 色 2 被右移，仍在其块后
    assertCompact(h.game.tray);
    assertGrouped(h.game.tray);
  });

  it('free 不足 ⇒ 部分收纳前 freeCount 颗，落位仍紧凑成块，余珠留格锚保持', () => {
    // 留 2 个空槽（基础槽数 - 2）；组 3 颗 ⇒ 只收 2 颗。
    for (let i = 0; i < TRAY_BASE_SLOTS - 2; i++) {
      expect(h.game.giveTrayBead((i % 3) + 1)).toBeGreaterThanOrEqual(0);
    }
    expect(h.game.tray.freeCount).toBe(2);
    putGroup3(h);
    const before = h.all('tray:stored').length;
    expect(h.game.retrieveSelectedGroup()).toBe(true);
    expect(h.all('tray:stored')).toHaveLength(before + 2);
    expect(h.game.tray.freeCount).toBe(0); // 2 空槽填满
    // 组 3 颗恰余 1 颗在格上、仍可错位。
    const remaining = [
      [1, 2],
      [2, 2],
      [3, 2],
    ].filter(([r, c]) => h.game.grid.cell(r, c)!.state === 'filled');
    expect(remaining).toHaveLength(1);
    expect(h.game.grid.isMisplaced(remaining[0]![0], remaining[0]![1])).toBe(true);
    expect(h.game.selection).toBe('board'); // 锚改指剩余珠，可续点
    assertCompact(h.game.tray);
    assertGrouped(h.game.tray);
  });

  it('满槽（freeCount = 0）⇒ 拒绝：零事件、零状态写、锚保持', () => {
    for (let i = 0; i < TRAY_BASE_SLOTS; i++) {
      expect(h.game.giveTrayBead((i % 3) + 1)).toBeGreaterThanOrEqual(0);
    }
    putGroup3(h);
    const before = h.all('tray:stored').length;
    expect(h.game.retrieveSelectedGroup()).toBe(false);
    expect(h.all('tray:stored')).toHaveLength(before);
    expect(h.game.grid.cell(2, 2)!.state).toBe('filled');
    expect(h.game.grid.isMisplaced(2, 2)).toBe(true);
    expect(h.game.selection).toBe('board');
  });
});
