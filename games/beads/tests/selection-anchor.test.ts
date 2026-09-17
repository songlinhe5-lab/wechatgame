/**
 * Epic T-133 · E2 — 统一选择锚 + 输入路由分支化（input-control v2.0 §2.1/§2.3/
 * §2.4/§8-11/§8-12；systems-index v1.22 §4 `board:selected`）。
 *
 * 真链口径：托盘/网格交互一律走 `tapDesign()`（真路由 `_handleTap`，热区坐标取
 * `gridLayoutFor` / `trayLayout` 单一真源）——旁路命令（selectTraySlot /
 * selectBoardBead / tapGridCell）只作装配与对照，不冒充路由。
 * 局面全部手工构造（E1 判例：无关卡 JSON、无 swaps BOOT 校验）。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  TAP_HINT_NO_SELECTION_TEXT,
  gridLayoutFor,
  powerupCardRects,
  trayLayout,
  TRAY_COLS,
} from '../src/config/tuning.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import type { BeadsGame } from '../src/game/beads-game.js';

// ────────────────────────────────────────────────────────── 局面装配助手

/** 6×5 全可填板（simpleTestLevel 图案）。 */
function mkHarness(saveKey: string): Harness {
  return createBeadsHarness({
      noAssemble: true, levels: [simpleTestLevel()], saveKey });
}

/** 满盘就位 → 再经装配原语 `setBead` 交换两格珠色（两格皆错位，E1 判例同型）。 */
function fillBoardInPlace(game: BeadsGame): void {
  const grid = game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cell(r, c)!;
      if (!cell.void && cell.state === 'empty') grid.fill(r, c);
    }
  }
}

function swapBeads(game: BeadsGame, r1: number, c1: number, r2: number, c2: number): void {
  const grid = game.grid;
  const a = grid.cell(r1, c1)!.beadColorIdx;
  const b = grid.cell(r2, c2)!.beadColorIdx;
  expect(grid.setBead(r1, c1, b)).toBe(true);
  expect(grid.setBead(r2, c2, a)).toBe(true);
}

// ──────────────────────────────────────────────── 热区坐标（几何单一真源）

/** 网格格心（§3.8，`gridLayoutFor` 单一真源）。 */
function gridPoint(game: BeadsGame, row: number, col: number): { x: number; y: number } {
  const layout = gridLayoutFor(game.grid.cols, game.grid.rows);
  return { x: layout.colCenterX(col), y: layout.rowCenterY(row) };
}

/** 托盘槽心（§3.4，`trayLayout` 单一真源）。 */
function trayPoint(game: BeadsGame, slot: number): { x: number; y: number } {
  const rows = Math.ceil(game.tray.capacity / TRAY_COLS);
  const lay = trayLayout(rows, game.tuning.width);
  return {
    x: lay.slotCenterX(slot % TRAY_COLS),
    y: lay.slotCenterY(Math.floor(slot / TRAY_COLS)),
  };
}

/** 道具卡 0（region）中心（§3.8，`powerupCardRects` 与命中同源）。 */
function powerupPoint(): { x: number; y: number } {
  const r = powerupCardRects()[0]!;
  return { x: r.x + r.w / 2, y: r.bottom + r.h / 2 };
}

// ──────────────────────────────────────────────────────────────── 判据 8-12

describe('E2 · 锚互斥与换选转移（input-control §2.1 / §8-12）', () => {
  afterEach(() => vi.restoreAllMocks());

  it('tray → board：点错位珠清除托盘选中（静默零事件）并发 board:selected', () => {
    const h = mkHarness('wxgame.beads.test.e2-mutex-a');
    const game = h.game;
    fillBoardInPlace(game);
    swapBeads(game, 0, 0, 1, 1); // (0,0) 珠色 = (1,1) 底色 = 2
    game.giveTrayBead(1);
    expect(game.selectTraySlot(0)).toBe(true);
    expect(game.selection).toBe('tray');

    expect(game.tapDesign(gridPoint(game, 0, 0).x, gridPoint(game, 0, 0).y)).toBe(false);

    // 锚转移：board 建立、tray 静默清除（槽位态 selected → holding，无 tray:selected）。
    expect(game.selection).toBe('board');
    expect(game.tray.slot(0)!.state).toBe('holding');
    expect(h.count('tray:selected')).toBe(1); // 换选不重发托盘事件
    expect(h.count('board:selected')).toBe(1);
    expect(h.last('board:selected')).toEqual({ row: 0, col: 0, colorIdx: 2, count: 2 });
    // 快照通道（E6 画高亮）：tray 侧 -1、board 侧命中格。
    expect(game.snapshot.traySelected).toBe(-1);
    expect(game.snapshot.boardSelectedRow).toBe(0);
    expect(game.snapshot.boardSelectedCol).toBe(0);
  });

  it('board → tray：点托盘珠清除错位珠选中（换选即转移，反向对称）', () => {
    const h = mkHarness('wxgame.beads.test.e2-mutex-b');
    const game = h.game;
    fillBoardInPlace(game);
    swapBeads(game, 0, 0, 1, 1);
    game.giveTrayBead(1);
    expect(game.tapDesign(gridPoint(game, 0, 0).x, gridPoint(game, 0, 0).y)).toBe(false);
    expect(game.selection).toBe('board');

    expect(game.tapDesign(trayPoint(game, 0).x, trayPoint(game, 0).y)).toBe(false);

    expect(game.selection).toBe('tray');
    expect(game.boardSelected).toBeNull();
    expect(game.snapshot.boardSelectedRow).toBe(-1);
    expect(game.snapshot.boardSelectedCol).toBe(-1);
    expect(game.tray.slot(0)!.state).toBe('selected');
    expect(h.count('board:selected')).toBe(1); // 换选不重发 board 事件
    expect(h.count('tray:selected')).toBe(1);
  });

  it('带级次序不受锚态影响：锚 = board 点道具卡仍命中路由 2、锚态不变（§8-12）', () => {
    const h = mkHarness('wxgame.beads.test.e2-mutex-c');
    const game = h.game;
    fillBoardInPlace(game);
    swapBeads(game, 0, 0, 1, 1);
    game.giveTrayBead(1);
    game.giveTrayBead(2);
    expect(game.selectBoardBead(0, 0)).toBe(true);
    expect(game.selection).toBe('board');

    const card = powerupPoint();
    game.tapDesign(card.x, card.y);

    expect(h.count('powerup:used')).toBe(1); // S6 收请求并生效（region 清槽）
    expect(game.selection).toBe('board'); // 锚态不变
    expect(game.boardSelected).toEqual({ row: 0, col: 0 });
  });

  it('同颗错位珠双击幂等（零新事件）；换选另一颗则锚转移 + 第二次 board:selected', () => {
    const h = mkHarness('wxgame.beads.test.e2-mutex-d');
    const game = h.game;
    fillBoardInPlace(game);
    swapBeads(game, 0, 0, 1, 1);
    const p00 = gridPoint(game, 0, 0);
    const p11 = gridPoint(game, 1, 1);

    game.tapDesign(p00.x, p00.y);
    game.tapDesign(p00.x, p00.y); // 双击同颗：幂等
    expect(h.count('board:selected')).toBe(1);

    game.tapDesign(p11.x, p11.y); // 换选另一颗
    expect(h.count('board:selected')).toBe(2);
    expect(h.last('board:selected')).toEqual({ row: 1, col: 1, colorIdx: 1, count: 2 });
    expect(game.boardSelected).toEqual({ row: 1, col: 1 });
  });
});

// ──────────────────────────────────────────────────────────── 路由 4 分支

describe('E2 · 路由 4 托盘带分支（input-control §2.1 4a/4b / §8-11）', () => {
  afterEach(() => vi.restoreAllMocks());

  it('4a：holding 槽 → tray:selected、锚置 tray（既有行为保持）', () => {
    const h = mkHarness('wxgame.beads.test.e2-r4a');
    const game = h.game;
    game.giveTrayBead(1);
    expect(game.tapDesign(trayPoint(game, 0).x, trayPoint(game, 0).y)).toBe(false);
    expect(game.selection).toBe('tray');
    expect(h.count('tray:selected')).toBe(1);
  });

  it('4b 取回全链：锚 = board 点空槽 → tray:stored 恰 1 次、board 锚随之清除', () => {
    const h = mkHarness('wxgame.beads.test.e2-r4b-retrieve');
    const game = h.game;
    fillBoardInPlace(game);
    swapBeads(game, 0, 0, 1, 1);
    game.giveTrayBead(1);
    game.giveTrayBead(2); // 槽 0/1 holding，槽 2 free
    const beadAt00 = game.grid.cell(0, 0)!.beadColorIdx;

    // 真链：点错位珠（5a）→ 点托盘空槽（4b）。
    const p00 = gridPoint(game, 0, 0);
    game.tapDesign(p00.x, p00.y);
    expect(game.selection).toBe('board');
    const pt = trayPoint(game, 2);
    game.tapDesign(pt.x, pt.y);

    // WXG-T-148 ④：锚 = 连通组（swap 两颗斜邻错位珠）⇒ 整组收进 = 2 次 stored
    //（原判据「恰 1 次」随单锚 → 组锚语义改写）。
    expect(h.count('tray:stored')).toBe(2);
    expect(h.last('tray:stored')).toEqual({
      slot: 3,
      colorIdx: 1, // swap 后 (1,1) 珠色 = 原 (0,0) 底色珠
      fromRow: 1,
      fromCol: 1,
    });
    // S3/S4 双写 + 锚清理：组内格全转 empty、槽 holding、board 锚失效。
    expect(game.grid.cell(0, 0)!.state).toBe('empty');
    expect(game.grid.cell(1, 1)!.state).toBe('empty');
    expect(game.tray.slot(2)!.state).toBe('holding');
    expect(game.tray.slot(2)!.colorIdx).toBe(beadAt00);
    expect(game.selection).toBe('none');
    expect(game.snapshot.boardSelectedRow).toBe(-1);
  });

  it('4b 空槽且无锚 → 零事件零状态（轻提示几何属 E6，本单按零事件忽略）', () => {
    const h = mkHarness('wxgame.beads.test.e2-r4b-noanchor');
    const game = h.game;
    game.giveTrayBead(1); // 槽 0 holding，槽 1 free
    const before = h.emitted.length;
    const pt = trayPoint(game, 1);
    game.tapDesign(pt.x, pt.y);
    expect(h.emitted.length).toBe(before);
    expect(game.tray.slot(1)!.state).toBe('free');
    expect(game.selection).toBe('none');
  });

  it('4b 空槽且锚 = tray → 零事件零状态、托盘锚保持（合法落点在网格）', () => {
    const h = mkHarness('wxgame.beads.test.e2-r4b-trayanchor');
    const game = h.game;
    game.giveTrayBead(1);
    game.giveTrayBead(2);
    expect(game.selectTraySlot(0)).toBe(true);
    const before = h.emitted.length;
    const pt = trayPoint(game, 2);
    game.tapDesign(pt.x, pt.y);
    expect(h.emitted.length).toBe(before);
    expect(game.tray.slot(2)!.state).toBe('free');
    expect(game.selection).toBe('tray');
  });

  it('满槽禁取珠（§8-11）：锚 = board 托盘全满点任意槽 → 零事件、锚保持；腾槽后同路径 tray:stored', () => {
    const h = mkHarness('wxgame.beads.test.e2-r4b-full');
    const game = h.game;
    // 空板上造两颗错位珠（fill 带 beadColor），托盘 12 槽填满。
    expect(game.grid.fill(0, 0, 2)).toBe(true); // (0,0) 底色 1，珠色 2 ⇒ 错位
    expect(game.grid.fill(1, 1, 1)).toBe(true); // (1,1) 底色 2，珠色 1 ⇒ 错位
    for (let i = 0; i < 12; i++) expect(game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);
    expect(game.tray.freeCount).toBe(0);

    // 真链选错位珠 → 点满托盘的 holding 槽 ⇒ 拒绝：零事件、槽态零写、锚保持。
    const p00 = gridPoint(game, 0, 0);
    game.tapDesign(p00.x, p00.y);
    expect(h.count('board:selected')).toBe(1);
    const slotStates = [0, 5, 11].map((i) => ({ ...game.tray.slot(i)! }));
    const before = h.emitted.length;
    const pt0 = trayPoint(game, 0);
    game.tapDesign(pt0.x, pt0.y);
    expect(h.emitted.length).toBe(before);
    expect(h.count('tray:stored')).toBe(0);
    expect([0, 5, 11].map((i) => ({ ...game.tray.slot(i)! }))).toEqual(slotStates);
    expect(game.selection).toBe('board');
    expect(game.grid.cell(0, 0)!.state).toBe('filled'); // 错位珠保持

    // WXG-T-148 ④：**槽位数量限制** —— 腾 1 槽 < 组大小 2 ⇒ 同路径仍拒（原判据
    // 「腾 1 槽即成功」随单珠 → 整组语义改写）。
    expect(game.selectTraySlot(0)).toBe(true);
    expect(game.tapGridCell(0, 3)).toBe(true);
    expect(game.tray.slot(0)!.state).toBe('free');
    game.tapDesign(p00.x, p00.y); // 重新建立 board 锚（上面 selectTraySlot 已清）
    expect(game.selection).toBe('board');
    game.tapDesign(pt0.x, pt0.y);
    expect(h.count('tray:stored')).toBe(0); // 仍不足 2 槽 ⇒ 拒

    // 再腾 1 槽（共 2 free = 组大小）⇒ 整组收进成功（2 次 stored）。
    expect(game.selectTraySlot(1)).toBe(true);
    expect(game.tapGridCell(1, 3)).toBe(true); // (1,3) 底色 2 空格，槽 1 珠色 2
    game.tapDesign(p00.x, p00.y);
    game.tapDesign(pt0.x, pt0.y);
    expect(h.count('tray:stored')).toBe(2);
    expect(game.grid.cell(0, 0)!.state).toBe('empty');
  });
});

// ──────────────────────────────────────────────────────────── 路由 5 分支

describe('E2 · 路由 5 网格带分支（input-control §2.1 5a/5b/5c）', () => {
  afterEach(() => vi.restoreAllMocks());

  it('归位全链·匹配：锚 = tray 点匹配空格 → bead:placed、格就位、槽转 free、锚清', () => {
    const h = mkHarness('wxgame.beads.test.e2-r5-place');
    const game = h.game;
    const slot = game.giveTrayBead(1); // (0,0) 底色 1
    const pt = trayPoint(game, slot);
    game.tapDesign(pt.x, pt.y);
    expect(game.selection).toBe('tray');

    const pg = gridPoint(game, 0, 0);
    expect(game.tapDesign(pg.x, pg.y)).toBe(false);

    expect(h.count('bead:placed')).toBe(1);
    expect(h.last('bead:placed')).toEqual({ row: 0, col: 0, colorIdx: 1, slot });
    expect(game.grid.cell(0, 0)!.state).toBe('filled');
    expect(game.grid.isMisplaced(0, 0)).toBe(false);
    expect(game.tray.slot(slot)!.state).toBe('free');
    expect(game.selection).toBe('none');
  });

  it('归位全链·不匹配：锚 = tray 点不匹配空格 → bead:rejected、珠留托盘、锚保持', () => {
    const h = mkHarness('wxgame.beads.test.e2-r5-reject');
    const game = h.game;
    game.giveTrayBead(2); // (0,0) 底色 1 ⇒ 不匹配
    game.selectTraySlot(0);
    const pg = gridPoint(game, 0, 0);
    expect(game.tapDesign(pg.x, pg.y)).toBe(false);

    expect(h.count('bead:rejected')).toBe(1);
    expect(h.last('bead:rejected')).toEqual({ row: 0, col: 0, colorIdx: 2 });
    expect(game.tray.slot(0)!.state).toBe('selected'); // 珠留托盘（rejected 不 consume，选中态保留）
    expect(game.selection).toBe('tray');
  });

  it('5b 无锚点空格 → 不发归位请求（零事件）+ 轻提示仅给可落空格（§8-7）', () => {
    const h = mkHarness('wxgame.beads.test.e2-r5-noanchor');
    const game = h.game;
    const before = h.emitted.length;
    const pg = gridPoint(game, 2, 2);
    game.tapDesign(pg.x, pg.y);
    expect(h.emitted.length).toBe(before); // S3 请求计数 = 0
    expect(game.snapshot.tapHintText).toBe(TAP_HINT_NO_SELECTION_TEXT);
    expect(game.snapshot.tapHintRow).toBe(2);
    expect(game.snapshot.tapHintCol).toBe(2);
    expect(game.selection).toBe('none');
  });

  it('5b 锚 = board 点空格 → 无效落点：零事件、锚保持（合法落点在托盘空槽）', () => {
    const h = mkHarness('wxgame.beads.test.e2-r5-boardanchor');
    const game = h.game;
    expect(game.grid.fill(0, 0, 2)).toBe(true); // 造一颗错位珠
    game.tapDesign(gridPoint(game, 0, 0).x, gridPoint(game, 0, 0).y);
    expect(game.selection).toBe('board');

    const before = h.emitted.length;
    const pg = gridPoint(game, 2, 2);
    game.tapDesign(pg.x, pg.y);
    expect(h.emitted.length).toBe(before); // 不发归位请求
    expect(h.count('bead:placed')).toBe(0);
    expect(h.count('bead:rejected')).toBe(0);
    expect(game.selection).toBe('board');
    expect(game.grid.cell(2, 2)!.state).toBe('empty');
  });

  it('5c 已就位珠点击：事件计数 = 0、零状态写、锚不变（§8-5 零事件红线）', () => {
    const h = mkHarness('wxgame.beads.test.e2-r5-inplace');
    const game = h.game;
    expect(game.grid.fill(0, 0)).toBe(true); // 就位珠（珠色 = 底色）
    game.giveTrayBead(1);
    game.selectTraySlot(0); // 有托盘锚也不得被就位珠吸走
    expect(game.selection).toBe('tray');

    const before = h.emitted.length;
    const pg = gridPoint(game, 0, 0);
    game.tapDesign(pg.x, pg.y);
    expect(h.emitted.length).toBe(before); // 零事件（含无 board:selected）
    expect(game.grid.cell(0, 0)!.state).toBe('filled');
    expect(game.grid.isMisplaced(0, 0)).toBe(false);
    expect(game.selection).toBe('tray'); // 锚零变化
    expect(game.snapshot.boardSelectedRow).toBe(-1);
  });

  it('5c 锁定格点击：事件计数 = 0（§2.4，锁定格恒定）', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 95, pattern: ['1231x3', '123123', '123123', '123123', '123123'] })],
      saveKey: 'wxgame.beads.test.e2-r5-locked',
    });
    const game = h.game;
    const before = h.emitted.length;
    const pg = gridPoint(game, 0, 4);
    game.tapDesign(pg.x, pg.y);
    expect(h.emitted.length).toBe(before);
    expect(game.grid.cell(0, 4)!.state).toBe('locked');
  });
});

// ────────────────────────────────────────────── 轻提示迁移 + 旁路兼容 + 生命周期

describe('E2 · 轻提示迁移与锚生命周期', () => {
  afterEach(() => vi.restoreAllMocks());

  it('旁路 tapGridCell（无选中）保留 BD-16 轻提示语义：fillable 才提示、返回 false', () => {
    const h = mkHarness('wxgame.beads.test.e2-hint-bypass');
    const game = h.game;
    const before = h.emitted.length;
    expect(game.tapGridCell(2, 2)).toBe(false);
    expect(h.emitted.length).toBe(before);
    expect(game.snapshot.tapHintText).toBe(TAP_HINT_NO_SELECTION_TEXT);
    expect(game.snapshot.tapHintRow).toBe(2);
    // 仅 fillable 格提示（旧判据保持）：locked 格点击后 hint 锚不迁移。
    expect(game.grid.cell(0, 0)!.state).toBe('empty'); // (0,0) 本案是可填格，另造锁定格
    const locked = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 96, pattern: ['1231x3', '123123', '123123', '123123', '123123'] })],
      saveKey: 'wxgame.beads.test.e2-hint-bypass-locked',
    });
    expect(locked.game.tapGridCell(0, 4)).toBe(false);
    expect(locked.game.snapshot.tapHintText).toBe(''); // 未给提示
  });

  it('换关清锚：board 锚在 _setupLevel 后失效（selection 回 none）', () => {
    const h = mkHarness('wxgame.beads.test.e2-anchor-reset');
    const game = h.game;
    expect(game.grid.fill(0, 0, 2)).toBe(true);
    expect(game.selectBoardBead(0, 0)).toBe(true);
    expect(game.selection).toBe('board');
    game.goToLevel(0);
    expect(game.selection).toBe('none');
    expect(game.boardSelected).toBeNull();
    expect(game.snapshot.boardSelectedRow).toBe(-1);
  });

  it('selectBoardBead 拒绝非错位珠：就位珠 / 空格 / 越界一律 false 且零事件', () => {
    const h = mkHarness('wxgame.beads.test.e2-selectboard-guard');
    const game = h.game;
    expect(game.grid.fill(0, 0)).toBe(true); // 就位
    const before = h.emitted.length;
    expect(game.selectBoardBead(0, 0)).toBe(false);
    expect(game.selectBoardBead(2, 2)).toBe(false); // 空格
    expect(game.selectBoardBead(99, 99)).toBe(false);
    expect(h.emitted.length).toBe(before);
    expect(game.selection).toBe('none');
  });
});
