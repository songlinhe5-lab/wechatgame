import { beforeEach, describe, expect, it } from 'vitest';
import { gridLayoutFor } from '../src/config/tuning.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import type { BeadsGame } from '../src/game/beads-game.js';

/**
 * 【WXG-T-157 用户裁定（2026-09-17）· 规则 2】board 锚直填：
 *  - 盘面选中错位珠（组 = 8 向两步切比雪夫 ≤2 同色，见 `misplaced-group.test.ts`）后，
 *    点「对应颜色（= 组色）的空格」且与锚切比雪夫 ≤2 ⇒ 组内珠**直接归位**（不经托盘）；
 *  - **组保持逐颗续填**：被填珠移出组、锚珠被填 ⇒ 锚静默转移到剩余组首（快照坐标跟随）；
 *  - 超距（对应色但 >2）⇒ 轻提示拒绝（零事件零状态写）；
 *  - 底色不匹配的空格 ⇒ 不消费（走既有「无对应路径」口径）；
 *  - 归位达成零错位 ⇒ cleared-priority（同帧 `level:cleared`）。
 *
 * 构造：noAssemble 空盘 + 显式 `fill`（同 `misplaced-group.test.ts` 判例，显式控色）；
 * cleared 例用「满盘就位 + retrieve 两空格 + 摆两颗同色错位」的满盘减二局面。
 */

/** 网格格心（§3.8，`gridLayoutFor` 单一真源；tapDesign 直吃设计坐标）。 */
function gridPoint(game: BeadsGame, row: number, col: number): { x: number; y: number } {
  const layout = gridLayoutFor(game.grid.cols, game.grid.rows);
  return { x: layout.colCenterX(col), y: layout.rowCenterY(row) };
}

describe('WXG-T-157 规则 2 · board 锚直填', () => {
  let h: Harness;
  beforeEach(() => {
    h = createBeadsHarness({ seed: 'direct-fill-seed', noAssemble: true, levels: [simpleTestLevel()] });
    h.game.goToLevel(0);
    // 布局（simpleTestLevel 底色 pattern='123123' 周期 3）：
    //   错位组（色 2，底均 ≠2）：锚 (2,2)（底 3）+ 组员 (1,0)（底 1，距锚切比 2）。
    //   对应色空格（底 2）：(2,1) 距锚 1 ✓；(0,1) 距新锚 (1,0) 1 ✓。
    //   超距对应色空格：(5,1) 底 2、距锚切比 3 ⇒ 拒。
    //   不匹配空格：(2,0) 底 1 ≠ 组色 ⇒ 不消费。
    h.game.grid.fill(2, 2, 2);
    h.game.grid.fill(1, 0, 2);
  });

  it('直填：点距 ≤2 的对应色空格 ⇒ bead:placed（无 slot）、格就位、组保持', () => {
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(2);
    // 点 (2,1)（底 2 空格）：组内 (2,2) 与 (1,0) 距离同为 1 ⇒ 平局行主序取 (1,0)。
    const p = gridPoint(h.game, 2, 1);
    expect(h.game.tapDesign(p.x, p.y)).toBe(true);
    expect(h.last('bead:placed')).toEqual({ row: 2, col: 1, colorIdx: 2 });
    expect(h.game.grid.cell(2, 1)!.state).toBe('filled');
    expect(h.game.grid.cell(2, 1)!.beadColorIdx).toBe(2); // 就位
    expect(h.game.grid.cell(1, 0)!.state).toBe('empty'); // 被填珠离格
    // 组保持：cells 移除被填珠 ⇒ 锚 (2,2) 保留（组剩 1 颗，可继续续填）。
    expect(h.count('board:selected')).toBe(1);
    expect(h.game.snapshot.boardSelectedRow).toBe(2);
    expect(h.game.snapshot.boardSelectedCol).toBe(2);
  });

  it('逐颗续填：第二颗填入另一对应色空格后组空锚清', () => {
    h.game.selectBoardBead(2, 2);
    const p1 = gridPoint(h.game, 2, 1);
    h.game.tapDesign(p1.x, p1.y); // 第一颗（锚珠）
    // 点 (0,1)（底 2 空格，距新锚 (1,0) 切比 1）⇒ 第二颗直填。
    const p2 = gridPoint(h.game, 0, 1);
    expect(h.game.tapDesign(p2.x, p2.y)).toBe(true);
    expect(h.last('bead:placed')).toEqual({ row: 0, col: 1, colorIdx: 2 });
    expect(h.game.grid.cell(1, 0)!.state).toBe('empty');
    expect(h.game.grid.cell(0, 1)!.beadColorIdx).toBe(2);
    // 组空 ⇒ 锚清。
    expect(h.game.snapshot.boardSelectedRow).toBe(-1);
    expect(h.game.snapshot.boardSelectedCol).toBe(-1);
    expect(h.game.selection).toBe('none');
  });

  it('超距：对应色空格但切比雪夫 >2 ⇒ 轻提示拒绝（零事件零状态写）', () => {
    // 另建布局：锚 (0,0)（底 1，色 2）+ 组员 (1,0)；对应色空格 (4,1)（底 2）距锚切比 4 ⇒ 超。
    expect(h.game.grid.fill(0, 0, 2)).toBe(true);
    expect(h.game.selectBoardBead(0, 0)).toBe(true);
    const before = h.emitted.length;
    const p = gridPoint(h.game, 4, 1);
    expect(h.game.tapDesign(p.x, p.y)).toBe(false);
    expect(h.emitted.length).toBe(before); // 零新事件（board:selected 等不重发）
    expect(h.game.snapshot.tapHintText).not.toBe('');
    expect(h.game.grid.cell(4, 1)!.state).toBe('empty'); // 零状态写
    expect(h.game.grid.cell(0, 0)!.state).toBe('filled'); // 锚珠保持
  });

  it('底色不匹配的空格 ⇒ 不消费（走既有无对应路径轻提示）', () => {
    h.game.selectBoardBead(2, 2);
    const before = h.emitted.length;
    const p = gridPoint(h.game, 2, 0); // (2,0) 底 1 ≠ 组色 2
    expect(h.game.tapDesign(p.x, p.y)).toBe(false);
    expect(h.emitted.length).toBe(before);
    expect(h.game.grid.cell(2, 0)!.state).toBe('empty');
  });

  it('直填归位最后一颗错位珠 ⇒ 零错位；托盘补空格后 cleared-priority', () => {
    // 【语义注】直填是**搬移**（源格空出）⇒ 直填本身不减空格数；cleared 由
    // 「直填归位全部错位珠 + 托盘填最后空格」的混合路径达成（真实关卡 = 交换对
    // 场景下直填就近归位、剩余走托盘，两路并存）。
    const g2 = createBeadsHarness({ seed: 'direct-fill-clear', noAssemble: true, levels: [simpleTestLevel()] });
    const game = g2.game;
    game.goToLevel(0);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        if ((r === 0 && c === 0) || (r === 0 && c === 1)) continue; // 预留：错位位 (0,0) + 对应色空格 (0,1)（底 2）
        const base = Number(simpleTestLevel().pattern[r]![c]!);
        expect(game.grid.fill(r, c, base)).toBe(true); // 全盘就位
      }
    }
    expect(game.grid.fill(0, 0, 2)).toBe(true); // (0,0) 底 1 ⇒ 色 2 错位（单珠组）
    expect(game.selectBoardBead(0, 0)).toBe(true);
    expect(g2.last<{ count: number }>('board:selected')?.count).toBe(1);
    // 直填：锚珠 2 → (0,1)（底 2，距 1）⇒ (0,0) 空出、零错位。
    const p = gridPoint(game, 0, 1);
    expect(game.tapDesign(p.x, p.y)).toBe(true);
    expect(game.grid.isMisplaced(0, 0)).toBe(false);
    // 托盘补最后空格（底 1）⇒ complete ⇒ 同帧 cleared。
    const slot = game.giveTrayBead(1);
    expect(game.selectTraySlot(slot)).toBe(true);
    const p00 = gridPoint(game, 0, 0);
    expect(game.tapDesign(p00.x, p00.y)).toBe(true);
    expect(g2.count('level:cleared')).toBe(1);
    expect(game.snapshot.phase).toBe('level-clear');
  });
});
