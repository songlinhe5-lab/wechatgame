import { beforeEach, describe, expect, it } from 'vitest';
import { gridLayoutFor } from '../src/config/tuning.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import type { BeadsGame } from '../src/game/beads-game.js';

/**
 * 【WXG-T-162 用户裁定（2026-09-18）· 直填任意距离】board 锚直填（覆盖 WXG-T-157 规则 2 的 ≤2 门）：
 *  - 盘面选中错位珠（组 = 8 向连通同色错位珠完整连通块，见 `misplaced-group.test.ts`）后，
 *    点「对应颜色（= 组色）的空格」（**不限距**）⇒ 组内珠**直接归位**（不经托盘）；
 *  - **组保持逐颗续填**：被填珠移出组、锚珠被填 ⇒ 锚静默转移到剩余组首（快照坐标跟随）；
 *  - 底色不匹配的空格 ⇒ 不消费（走既有「无对应路径」口径）；
 *  - 归位达成零错位 ⇒ cleared-priority（同帧 `level:cleared`）。
 *
 * 构造：noAssemble 空盘 + 显式 `fill`（同 `misplaced-group.test.ts` 判例，显式控色）；
 * cleared 例用「满盘就位 + 预留两空格 + 摆一颗错位」的满盘减二局面。
 */

/** 网格格心（§3.8，`gridLayoutFor` 单一真源；tapDesign 直吃设计坐标）。 */
function gridPoint(game: BeadsGame, row: number, col: number): { x: number; y: number } {
  const layout = gridLayoutFor(game.grid.cols, game.grid.rows);
  return { x: layout.colCenterX(col), y: layout.rowCenterY(row) };
}

describe('WXG-T-162 · board 锚直填（任意距离）', () => {
  let h: Harness;
  beforeEach(() => {
    h = createBeadsHarness({ seed: 'direct-fill-seed', noAssemble: true, levels: [simpleTestLevel()] });
    h.game.goToLevel(0);
    // 底色 pattern='123123' 周期 3 ⇒ 列 0/3 底 1、列 1/4 底 2、列 2/5 底 3。
    //   错位组（色 2，8 向斜连）：锚 (1,2)（底 3）+ 组员 (2,3)（底 1）。
    //   对应色空格（底 2）：(1,1) 距锚 1；(4,4) 距锚切比 3（>2 ⇒ 放开判据点）。
    //   不匹配空格：(2,0) 底 1 ≠ 组色 ⇒ 不消费。
    h.game.grid.fill(1, 2, 2);
    h.game.grid.fill(2, 3, 2);
  });

  it('组批量填：点一个同色空格 ⇒ 连片填满 + 消耗等量组珠 + 组空锚清', () => {
    expect(h.game.selectBoardBead(1, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(2);
    // (1,1) 底 2 空；planGroupFill 从 (1,1) 追加最近连通同色空 (0,1) ⇒ 两颗组珠一次填两格。
    const p = gridPoint(h.game, 1, 1);
    expect(h.game.tapDesign(p.x, p.y)).toBe(true);
    expect(h.game.grid.cell(1, 1)!.state).toBe('filled');
    expect(h.game.grid.cell(1, 1)!.beadColorIdx).toBe(2); // 就位
    expect(h.game.grid.cell(0, 1)!.state).toBe('filled'); // 连片格
    expect(h.game.grid.cell(0, 1)!.beadColorIdx).toBe(2);
    expect(h.game.grid.cell(1, 2)!.state).toBe('empty'); // 两颗组员均离格
    expect(h.game.grid.cell(2, 3)!.state).toBe('empty');
    expect(h.count('bead:placed')).toBe(2); // 每格各发一次
    expect(h.count('board:selected')).toBe(1); // 选中只发一次，填完不重发
    expect(h.game.snapshot.boardSelectedRow).toBe(-1); // 组空 ⇒ 锚清
    expect(h.game.selection).toBe('none');
  });

  it('放开距离 + 连片：远端同色空格一次点击亦整片归位（不限距）', () => {
    h.game.selectBoardBead(1, 2);
    const p = gridPoint(h.game, 4, 4); // (4,4) 底 2，距锚切比 3 >2（旧超距拒已废）
    expect(h.game.tapDesign(p.x, p.y)).toBe(true);
    expect(h.game.snapshot.tapHintText ?? '').toBe(''); // 不弹提示
    expect(h.game.grid.cell(4, 4)!.beadColorIdx).toBe(2); // 被点格
    expect(h.game.grid.cell(3, 4)!.beadColorIdx).toBe(2); // 连片追加格
    expect(h.game.grid.cell(1, 2)!.state).toBe('empty'); // 两颗组员均消耗
    expect(h.game.grid.cell(2, 3)!.state).toBe('empty');
    expect(h.game.snapshot.boardSelectedRow).toBe(-1); // 组空锚清
  });

  it('消费序基准 = 选豆点（拾取锚恒定）：远目标消耗的也是离拾取点最近的组员（用户裁定 2026-09-20）', () => {
    // 组 = 列 0 竖链 5 颗（底色均 1 ⇒ 色 2 错位）；拾取点 = 锚 (0,0)。
    // 目标唯一（(3,1) 先填就位堵 BFS）= (4,1)（底 2）：离拾取点最远、离列尾组员最近。
    // 旧「逐目标就近取珠」会消耗 (4,0)；新消费序（距拾取点切比雪夫升序）消耗 (0,0)。
    for (let r = 0; r < 5; r++) expect(h.game.grid.fill(r, 0, 2)).toBe(true);
    expect(h.game.grid.fill(3, 1, 2)).toBe(true); // 底 2 + 色 2 = 就位，堵死 BFS 蔓延
    expect(h.game.selectBoardBead(0, 0)).toBe(true);
    const p = gridPoint(h.game, 4, 1);
    expect(h.game.tapDesign(p.x, p.y)).toBe(true);
    expect(h.game.grid.cell(4, 1)!.beadColorIdx).toBe(2); // 目标已填
    expect(h.game.grid.cell(0, 0)!.state).toBe('empty'); // 消耗的是拾取点本珠（非 (4,0)）
    expect(h.game.grid.cell(4, 0)!.state).toBe('filled'); // 列尾组员保留
    // 头珠转移 = 剩余组首（消费序 ⇒ 离拾取点最近者 (1,0)）；选豆点不再可查（内部态）。
    expect(h.game.snapshot.boardSelectedRow).toBe(1);
    expect(h.game.snapshot.boardSelectedCol).toBe(0);
    expect(h.count('board:selected')).toBe(1); // 不重发
  });

  it('单珠组：beadCount-1=0 ⇒ 只填被点格、不级联', () => {
    const g = createBeadsHarness({ seed: 'single-bead', noAssemble: true, levels: [simpleTestLevel()] });
    g.game.goToLevel(0);
    g.game.grid.fill(0, 0, 2); // (0,0) 底 1 ⇒ 色 2 错位（单珠组）
    expect(g.game.selectBoardBead(0, 0)).toBe(true);
    const p = gridPoint(g.game, 0, 1); // (0,1) 底 2 空
    expect(g.game.tapDesign(p.x, p.y)).toBe(true);
    expect(g.game.grid.cell(0, 1)!.beadColorIdx).toBe(2);
    expect(g.game.grid.cell(0, 0)!.state).toBe('empty');
    expect(g.count('bead:placed')).toBe(1); // 单珠组只填一格
    expect(g.game.snapshot.boardSelectedRow).toBe(-1);
  });

  it('底色不匹配的空格 ⇒ 不消费（走既有无对应路径轻提示）', () => {
    h.game.selectBoardBead(1, 2);
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
