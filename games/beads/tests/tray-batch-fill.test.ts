/**
 * WXG-T-158 · 托盘同色归类 + 组批量填充判据
 * （bead-grid v2.1 §2.3 路径 B / §8-11；tray-spawner v2.2 §2.1 归类不变式 /
 * §8-6b；用户 2026-09-18 四项裁定：①自动归类 ②同色全组互斥 ③部分填充 ④8 向不限步）。
 *
 * 分层：Tray 单元（归类/取消紧凑）→ planGroupFill 纯函数（BFS 口径）→
 * game 级全链（点击→组选→批量落子→事件计数）。场景全部走公开 API +
 * `giveTrayBead`（死路径夹具），不伪造内部状态。
 */

import { describe, it, expect } from 'vitest';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';
import { Tray } from '../src/entities/tray.js';
import { BeadGrid } from '../src/entities/grid.js';
import { planGroupFill } from '../src/systems/placement.js';

/** §8-6b 归类不变式的单元侧直查：非 free 珠恒占 [0..holdingCount-1] 且同色连续。 */
function assertGroupedInvariant(tray: Tray): void {
  const n = tray.holdingCount;
  for (let i = 0; i < n; i++) {
    expect(tray.slot(i)!.state).not.toBe('free'); // 块间不得有洞
  }
  if (n > 0) expect(tray.slot(n)!.state).toBe('free');
  // 每色至多一个连续块：色相同 ⇒ 中间不得隔他色。
  for (let i = 0; i < n; i++) {
    const c = tray.slot(i)!.colorIdx;
    let j = i + 1;
    while (j < n && tray.slot(j)!.colorIdx === c) j++;
    for (let k = j; k < n; k++) expect(tray.slot(k)!.colorIdx).not.toBe(c);
  }
}

describe('WXG-T-158 · Tray 同色归类不变式（tray-spawner §2.1 / §8-6b 单元）', () => {
  it('insertGrouped：同色块尾插入（3,1,3 ⇒ [3,3,1]），返回槽 = 实际落位', () => {
    const tray = new Tray();
    expect(tray.insertGrouped(3)).toBe(0); // 无色块 ⇒ 追加序列尾
    expect(tray.insertGrouped(1)).toBe(1);
    expect(tray.insertGrouped(3)).toBe(1); // 色 3 块尾 ⇒ 插在 idx1，色 1 右移
    expect([0, 1, 2].map((i) => tray.slot(i)!.colorIdx)).toEqual([3, 3, 1]);
    expect(tray.slot(1)!.state).toBe('holding');
    assertGroupedInvariant(tray);
  });

  it('takeBead 取中间块尾珠 ⇒ 后侧珠左移补位，归类紧凑不变式不破（§8-6b「任意次归位后」）', () => {
    const tray = new Tray();
    tray.insertGrouped(1);
    tray.insertGrouped(1);
    tray.insertGrouped(2); // [1,1,2]
    // 批量归位口径：从选中组尾倒序取珠（色 1 组 = 槽 0..1，非托盘尾）。
    expect(tray.takeBead(1)).toBe(true);
    expect(tray.takeBead(0)).toBe(true);
    assertGroupedInvariant(tray); // 现 [2,free,…]：色 2 必须补到槽 0
    expect(tray.holdingCount).toBe(1);
    expect(tray.slot(0)!.colorIdx).toBe(2);
    expect(tray.slot(0)!.state).toBe('holding');
  });
});

describe('WXG-T-158 · planGroupFill（bead-grid §8-11 8 向 BFS 口径·单元）', () => {
  // 约定：调用时被点格已由 judgePlacement 填入（作为源，不入选）。

  it('8 向：对角连通入选；同层按 DELTAS 行主序报告', () => {
    const grid = new BeadGrid(['221', '212', '122']);
    expect(grid.fill(1, 1)).toBe(true); // 底色 1 ⇒ 就位源格
    const out = planGroupFill(grid, 1, 1, 1, 10);
    // (0,2)/(2,0) 均色 1 空格、经对角与源连通；其余邻格底色 2 不入选。
    expect(out).toEqual([
      { row: 0, col: 2 },
      { row: 2, col: 0 },
    ]);
  });

  it('蔓延不限步（多层 BFS）+ 锁定/异色不穿越 + 上限 = 珠数截断', () => {
    const grid = new BeadGrid(['1112', '1xx2', '1112']);
    expect(grid.fill(0, 1)).toBe(true); // 被点格（底色 1）
    const full = planGroupFill(grid, 0, 1, 1, 10);
    // 层 1 = (0,0),(0,2),(1,0)（行主序）；(1,1)/(1,2) 锁定不穿越；col3 底色 2 排除。
    // 层 2 = (2,0),(2,1)；层 3 = (2,2)。
    expect(full).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ]);
    // 珠数截断：按 BFS 距层就近取前 n。
    expect(planGroupFill(grid, 0, 1, 1, 2).length).toBe(2);
    expect(grid.fill(0, 0)).toBe(true);
    expect(grid.fill(0, 2)).toBe(true);
    // 剩余格重规划 ⇒ (1,0) 最先（就近序稳定）。
    expect(planGroupFill(grid, 0, 1, 1, 1)).toEqual([{ row: 1, col: 0 }]);
  });

  it('连通区无同色空格（异色包围）⇒ 返回空、不动棋盘', () => {
    const grid = new BeadGrid(['222', '212', '222']);
    expect(grid.fill(1, 1)).toBe(true);
    expect(planGroupFill(grid, 1, 1, 1, 3)).toEqual([]);
  });
});

// ───────────────────────────────────────────── game 级全链（裁定②③④联合）

/**
 * 定制 6×5 关：色 1 只有两块 —— 顶行 {(0,0),(0,1)} 连通区（size 2）与
 * 孤立单格 {(0,4)}（四邻均非 1）；色 2/3 铺满其余，满足 BOOT 三色下限。
 */
function groupLevel() {
  return simpleTestLevel({
    id: 91,
    pattern: ['112312', '223223', '332332', '233223', '322332'],
  });
}

describe('WXG-T-158 · 组批量填充全链（bead-grid §2.3 路径 B v2.1 · game 级）', () => {
  it('§8-11 珠 < 连通区 ⇒ 部分填充：被点格先填、BFS 就近续填、每格一份 placed 携倒序来源槽', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.t158-partial',
    });
    const game = harness.game;
    // col0 底色恒 1 ⇒ 5 格纵向连通区；给 3 颗 ⇒ 填 3 剩 2。
    expect(game.giveTrayBead(1)).toBe(0);
    expect(game.giveTrayBead(1)).toBe(1);
    expect(game.giveTrayBead(1)).toBe(2);
    expect(game.selectTraySlot(0)).toBe(true);
    expect(game.tray.selectedCount).toBe(3);

    expect(game.tapGridCell(0, 0)).toBe(true);
    const placed = harness.all<{ row: number; col: number; colorIdx: number; slot: number }>(
      'bead:placed',
    );
    expect(placed).toHaveLength(3); // 一次归位多发 = 设计使然（§8-11）
    expect(placed.map((p) => [p.row, p.col])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]); // 被点格恒先、BFS 距层就近
    expect(placed.map((p) => p.slot)).toEqual([2, 1, 0]); // 组尾倒序取珠
    for (const p of placed) expect(p.colorIdx).toBe(1);
    expect(game.grid.cell(3, 0)!.state).toBe('empty'); // 未触达保持 empty（裁定③非缺陷）
    expect(game.grid.cell(4, 0)!.state).toBe('empty');
    expect(game.selection).toBe('none'); // 组清空 ⇒ 锚回 none
  });

  it('§8-11/裁定③ 珠 > 连通区 ⇒ 只填连通区、剩余珠保持 selected；异区再点续填', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [groupLevel()],
      saveKey: 'wxgame.beads.test.t158-leftover',
    });
    const game = harness.game;
    for (let i = 0; i < 3; i++) expect(game.giveTrayBead(1)).toBe(i);
    expect(game.selectTraySlot(0)).toBe(true);

    expect(game.tapGridCell(0, 0)).toBe(true);
    expect(harness.count('bead:placed')).toBe(2); // 连通区 size 2 < 珠数 3
    expect(game.grid.cell(0, 1)!.state).toBe('filled');
    expect(game.grid.cell(0, 4)!.state).toBe('empty'); // 区外同色空格不填（§8-11）
    expect(game.tray.slot(0)!.state).toBe('selected'); // 剩余珠保持选中
    expect(game.tray.slot(0)!.colorIdx).toBe(1);
    expect(game.tray.selectedCount).toBe(1);
    expect(game.selection).toBe('tray'); // 锚不变可续点

    expect(game.tapGridCell(0, 4)).toBe(true); // 同组续点另一连通区
    expect(harness.count('bead:placed')).toBe(3);
    expect(game.tray.holdingCount).toBe(0);
    expect(game.selection).toBe('none');
  });

  it('§8-11 不匹配点击（底色 ≠ 组色）⇒ 仍单格 rejected、零填充、整组保持选中', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.t158-mismatch',
    });
    const game = harness.game;
    for (let i = 0; i < 3; i++) game.giveTrayBead(1);
    expect(game.selectTraySlot(0)).toBe(true);
    const before = harness.emitted.length;

    expect(game.tapGridCell(0, 1)).toBe(false); // (0,1) 底色 2
    expect(harness.count('bead:placed')).toBe(0);
    expect(harness.last('bead:rejected')).toEqual({ row: 0, col: 1, colorIdx: 1 });
    expect(harness.emitted.length).toBe(before + 1); // 除 rejected 外零事件
    expect(game.tray.selectedCount).toBe(3); // 整组原样留托盘
    expect(game.tray.holdingCount).toBe(3);
  });

  it('§8-6b 整组离盘后他色珠保持紧凑（批量取珠不破坏归类不变式）', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.t158-compact',
    });
    const game = harness.game;
    for (let i = 0; i < 3; i++) expect(game.giveTrayBead(1)).toBe(i);
    expect(game.giveTrayBead(2)).toBe(3); // 托盘 [1,1,1,2]
    expect(game.selectTraySlot(0)).toBe(true);

    expect(game.tapGridCell(0, 0)).toBe(true); // 色 1 组整批离盘（3 格）
    expect(harness.count('bead:placed')).toBe(3);
    expect(game.tray.holdingCount).toBe(1);
    expect(game.tray.slot(0)!.colorIdx).toBe(2); // 色 2 补位到槽 0
    expect(game.tray.slot(0)!.state).toBe('holding');
    assertGroupedInvariant(game.tray);
  });
});
