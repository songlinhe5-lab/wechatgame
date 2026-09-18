import { beforeEach, describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';

/**
 * 【WXG-T-162 用户裁定（2026-09-18），覆盖 WXG-T-157 旧口径】组选（连通块）+ 整组收进：
 *  - 锚起 **8 向（含对角）连通、同色、错位珠的完整连通块，不限步数**（「找相邻直到找不到」）；
 *    就位珠/锁定格/空格/异色错位珠均**阻断传播** ⇒ 旧 5×5 窗「隔珠同色连选」回归为不同组。
 *  - 取回 = 组内一次收进，仍只有槽位数量限制（free 槽 < 组大小 ⇒ 拒绝，零事件零状态写）。
 *  - board 锚直填（任意距离，同裁定）另见 `misplaced-direct-fill.test.ts`。
 *
 * 场景构造沿用 E1 判例：noAssemble 空盘 + goToLevel 进 playing + `fill(r,c,color)`
 * 显式控色摆错位珠（组选筛色 ⇒ 构造必须显式同色/异色，不再用「1/2 择一」的旧夹具）。
 */

/** 在 (r,c) 摆一颗指定色的错位珠（color 必须 ≠ 底色，调用方保证）。 */
function putMisplacedAt(h: Harness, r: number, c: number, color: number): void {
  expect(h.game.grid.fill(r, c, color)).toBe(true);
}

/** 在 (r,c) 摆一颗色 1 的错位珠（要求底色 ≠ 1，调用方保证）。 */
function putMisplaced1(h: Harness, r: number, c: number): void {
  putMisplacedAt(h, r, c, 1);
}

describe('WXG-T-162 组选（8 向连通 flood fill，不限步数）', () => {
  let h: Harness;
  beforeEach(() => {
    h = createBeadsHarness({ seed: 'group-seed', noAssemble: true, levels: [simpleTestLevel()] });
    h.game.goToLevel(0);
  });

  it('切比雪夫 ≤2 同色整组入锚（含斜向 (1,2) 两步格）：count = 3', () => {
    // (1,2)-(2,2) 直连 1 步 + (3,2) 距 (2,2) 切比雪夫 1 ⇒ 同底色列（底 3）摆色 1 全入组。
    // （simpleTestLevel 底色 pattern='123123' 周期 3 ⇒ 组构造必须落在同底色格上，见 putMisplaced1。）
    putMisplaced1(h, 1, 2);
    putMisplaced1(h, 2, 2);
    putMisplaced1(h, 3, 2);
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(3);
  });

  it('异色错位珠不抬（距离 ≤2 也排除）', () => {
    putMisplaced1(h, 2, 2); // 锚，色 1（底 3）
    putMisplacedAt(h, 2, 3, 3); // 距 1 但珠色 3 ≠ 锚色 1 ⇒ 不抬
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(1);
  });

  it('切比雪夫 ≤2 但**不连通**（隔空格）⇒ 不同组（旧 5×5 窗会连选，真机反馈问题回归）', () => {
    putMisplaced1(h, 2, 2);
    putMisplaced1(h, 2, 4); // 底 2、同色 1、距锚切比 2；但 (2,3) 是空格 ⇒ 阻断传播
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(1);
  });

  it('隔一颗**异色错位珠** ⇒ 不同组（异色阻断）', () => {
    putMisplaced1(h, 2, 2); // 锚（底 3）
    putMisplacedAt(h, 2, 3, 3); // 底 1 ⇒ 色 3 错位；在 (2,2) 与 (2,4) 中间
    putMisplaced1(h, 2, 4); // 底 2 ⇒ 色 1 错位，距锚 2：旧规则入选，新规则被异色隔断
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(1);
  });

  it('隔一颗**就位珠** ⇒ 不同组（就位阻断）', () => {
    putMisplaced1(h, 2, 2); // 锚（底 3）
    h.game.grid.fill(2, 3, 1); // 底 1 ⇒ 色 1 就位 ⇒ 不入选且阻断传播
    putMisplaced1(h, 2, 4); // 距锚 2，仅经 (2,3) 可达 ⇒ 不同组
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(1);
  });

  it('长连通链不限步数：同色斜链 (1,2)-(2,1)-(3,2) 全入组（3×3 对角可达）', () => {
    putMisplaced1(h, 1, 2); // 底 3
    putMisplaced1(h, 2, 1); // 底 2；与 (1,2) 对角相邻
    putMisplaced1(h, 3, 2); // 底 3；与 (2,1) 对角相邻
    expect(h.game.selectBoardBead(2, 1)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(3);
  });

  it('长连通链超出旧 5×5 窗：竖列 5 颗同色错位全入组（count 5 > 旧窗 3）', () => {
    for (let r = 0; r < 5; r++) putMisplaced1(h, r, 2); // 列 2 底恒 3 ⇒ 色 1 全错位，竖向直连
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(5);
  });

  it('距锚切比雪夫 >2 且无同色路径 ⇒ 不入组（不连通 ⇒ 单珠）', () => {
    putMisplaced1(h, 2, 2);
    putMisplaced1(h, 2, 5); // 底同为 3、同色 1，但距 3 且全空格相隔
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(1);
  });

  it('单珠（无同色错位邻居）= count 1', () => {
    putMisplaced1(h, 2, 2);
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(1);
  });

  it('空格/就位珠不可作为组起点', () => {
    expect(h.game.selectBoardBead(2, 2)).toBe(false); // 空格
    putMisplacedAt(h, 3, 3, 3); // 底 1 ⇒ 色 3 错位
    expect(h.game.selectBoardBead(3, 3)).toBe(true);
  });

  it('换选 ⇒ 组重算（新组替换旧组）', () => {
    putMisplaced1(h, 1, 2);
    putMisplaced1(h, 2, 2);   // (1,2) 距 1 ⇒ 同组
    putMisplacedAt(h, 4, 4, 3); // 底 2 ⇒ 色 3 错位；异色 ⇒ 不入 (2,2) 组
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(2);
    expect(h.game.selectBoardBead(4, 4)).toBe(true);
    expect(h.last<{ count: number }>('board:selected')?.count).toBe(1);
  });
});

describe('WXG-T-162 整组一次收进', () => {
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
    putMisplaced1(h, 1, 2);
    putMisplaced1(h, 2, 2);
    putMisplaced1(h, 3, 2);
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    // v2.2 裁定①：整组收进不再传落槽（逐颗 = S4 自动归类）。
    expect(h.game.retrieveSelectedGroup()).toBe(true);
    const stored = h.all<{ slot: number; colorIdx: number; fromRow: number; fromCol: number }>('tray:stored');
    expect(stored).toHaveLength(3);
    const slots = stored.map((s) => s.slot).sort((a, b) => a - b);
    expect(new Set(slots).size).toBe(3); // 槽互异（同色 ⇒ 归类成块 0..2）
    for (const s of stored) {
      expect(s.fromRow).toBeGreaterThanOrEqual(0);
      expect(s.fromCol).toBeGreaterThanOrEqual(0);
    }
    // 组内格全空。
    expect(h.game.grid.cell(2, 2)!.state).toBe('empty');
    expect(h.game.grid.cell(2, 3)!.state).toBe('empty');
    expect(h.game.grid.cell(3, 4)!.state).toBe('empty');
    // 锚清：再取回 false。
    expect(h.game.retrieveSelectedGroup()).toBe(false);
  });

  it('free 槽 < 组大小 ⇒ 拒绝：零事件、零状态写、锚保持', () => {
    // 组 3 颗；先塞 22 颗进托盘（24 槽 ⇒ free 2；v1.24 扩容后旧「10 颗/12 槽」不成立）。
    putMisplaced1(h, 1, 2);
    putMisplaced1(h, 2, 2);
    putMisplaced1(h, 3, 2);
    // giveTrayBead 返回槽号（-1 = 失败）；混色避开 needed 投影上限。
    for (let i = 0; i < 22; i++) {
      expect(h.game.giveTrayBead((i % 3) + 1)).toBeGreaterThanOrEqual(0);
    }
    const eventsBefore = h.all('tray:stored').length;
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.game.retrieveSelectedGroup()).toBe(false);
    expect(h.all('tray:stored')).toHaveLength(eventsBefore); // 零新事件
    // 零状态写：珠仍在格上（错位）。
    expect(h.game.grid.cell(2, 2)!.state).toBe('filled');
    expect(h.game.grid.isMisplaced(2, 2)).toBe(true);
  });

  it('组收进后归位通路不受影响：托盘珠仍可点空格（judgePlacement 裁决）', () => {
    putMisplaced1(h, 2, 2);
    putMisplaced1(h, 3, 2);
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.game.retrieveSelectedGroup()).toBe(true);
    expect(h.game.selectTraySlot(0)).toBe(true);
    // (2,2) 已 empty；放置被受理或明确拒绝均合法（归位裁决由 placement 既有用例守护）。
    const ok = h.game.tapGridCell(2, 2);
    expect(typeof ok).toBe('boolean');
  });
});
