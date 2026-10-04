/**
 * Epic T-133 · E2 — 统一选择锚 + 输入路由分支化（input-control v2.0 §2.1/§2.3/
 * §2.4/§8-11/§8-12；systems-index v1.22 §4 `board:selected`）。
 *
 * 路由口径（**非真输入链**，WXG-T-169 收口批口径校正 · QA §A4c.4-F7）：托盘/网格交互一律走
 * `tapDesign()`（直调 `_handleTap`、绕开 `_readInput` ⇒ 按 **K-038** 属**旁路**；热区坐标取
 * `gridLayoutFor` / `trayLayout` 单一真源）⇒ 本组不受 `input-control v2.5` 抬起提交时基影响，
 * 也**不覆盖**它（时基真链用例见 `board-input-timing.test.ts`）。旁路命令（selectTraySlot /
 * selectBoardBead / tapGridCell）只作装配与对照。
 * 局面全部手工构造（E1 判例：无关卡 JSON、无 swaps BOOT 校验）。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { TRAY_BASE_SLOTS } from '../src/config/tuning.js';
import {
  GROUP_LAND_DROP_PX,
  TAP_HINT_NO_SELECTION_TEXT,
  gridLayoutFor,
  powerupCardRects,
  trayLayout,
  TRAY_COLS,
  TRAY_SLOT,
} from '../src/config/tuning.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import type { BeadsGame } from '../src/game/beads-game.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS, beadColorOf, endpointOf, withAlpha } from '../src/view/palette.js';
import { LIFT_SHADOW_ALPHA } from '../src/config/tuning.js';
import { RenderModelBuilder, type DrawCommand } from '../../../packages/framework/src/core/render/render-model.js';
import { buildBeadsView } from '../src/view/view-model.js';
import type { BeadsSnapshot } from '../src/game/state.js';

// ────────────────────────────────────────────────────────── 局面装配助手

/** 6×5 全可填板（simpleTestLevel 图案）。 */
function renderSnap(snap: BeadsSnapshot): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  buildBeadsView(builder, snap, DEFAULT_PALETTE, DEMO_BEAD_INKS);
  return builder.end().commands;
}

function traySlotArtCount(c: readonly DrawCommand[], lay: ReturnType<typeof trayLayout>, idx: number): number {
    const cx = lay.slotCenterX(idx % TRAY_COLS);
    const cy = lay.slotCenterY(Math.floor(idx / TRAY_COLS));
    const r = TRAY_SLOT * 0.75;
    return c.filter((k) => {
        const x = (k as { x?: number; cx?: number }).x ?? (k as { cx?: number }).cx;
        const y = (k as { y?: number; cy?: number }).y ?? (k as { cy?: number }).cy;
        if (x === undefined || y === undefined) return false;
        return Math.hypot(x - cx, y - cy) <= r;
    }).length;
}

function mkHarness(saveKey: string): Harness {
  return createBeadsHarness({
    noAssemble: true, levels: [simpleTestLevel()], saveKey
  });
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
    // 【WXG-T-157】组选筛色 ⇒ 构造改「同色错位对」：色 3（底(0,0)=1、底(1,1)=2 均 ≠3）。
    game.grid.setBead(0, 0, 3);
    game.grid.setBead(1, 1, 3);
    game.giveTrayBead(1);
    expect(game.selectTraySlot(0)).toBe(true);
    expect(game.selection).toBe('tray');

    expect(game.tapDesign(gridPoint(game, 0, 0).x, gridPoint(game, 0, 0).y)).toBe(false);

    // 锚转移：board 建立、tray 静默清除（槽位态 selected → holding，无 tray:selected）。
    expect(game.selection).toBe('board');
    expect(game.tray.slot(0)!.state).toBe('holding');
    expect(h.count('tray:selected')).toBe(1); // 换选不重发托盘事件
    expect(h.count('board:selected')).toBe(1);
    expect(h.last('board:selected')).toEqual({ row: 0, col: 0, colorIdx: 3, count: 2 });
    // 快照通道（E6 画高亮）：tray 侧 -1、board 侧命中格。
    expect(game.snapshot.traySelected).toBe(-1);
    expect(game.snapshot.boardSelectedRow).toBe(0);
    expect(game.snapshot.boardSelectedCol).toBe(0);
  });

  it('board → tray：点托盘珠清除错位珠选中（换选即转移，反向对称）', () => {
    const h = mkHarness('wxgame.beads.test.e2-mutex-b');
    const game = h.game;
    fillBoardInPlace(game);
    game.grid.setBead(0, 0, 3);
    game.grid.setBead(1, 1, 3);
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
    game.grid.setBead(0, 0, 3);
    game.grid.setBead(1, 1, 3);
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
    game.grid.setBead(0, 0, 3);
    game.grid.setBead(1, 1, 3);
    const p00 = gridPoint(game, 0, 0);
    const p11 = gridPoint(game, 1, 1);

    game.tapDesign(p00.x, p00.y);
    game.tapDesign(p00.x, p00.y); // 双击同颗：幂等
    expect(h.count('board:selected')).toBe(1);

    game.tapDesign(p11.x, p11.y); // 换选另一颗
    expect(h.count('board:selected')).toBe(2);
    expect(h.last('board:selected')).toEqual({ row: 1, col: 1, colorIdx: 3, count: 2 });
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
    game.grid.setBead(0, 0, 3);
    game.grid.setBead(1, 1, 3);
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
      colorIdx: 3, // 同色对：两颗珠色均 3
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

  it('满槽换选（§8-11 v2.9 收窄，WXG-T-187）：锚 = board 托盘全满点 holding 槽 → 整组换选锚转移；腾槽后 4b 取回照旧', () => {
    const h = mkHarness('wxgame.beads.test.e2-r4b-full');
    const game = h.game;
    // 空板上造两颗**同色**错位珠（WXG-T-157 组选筛色：色 3，底 1/2 均 ≠3），托盘全满。
    expect(game.grid.fill(0, 0, 3)).toBe(true); // (0,0) 底色 1，珠色 3 ⇒ 错位
    expect(game.grid.fill(1, 1, 3)).toBe(true); // (1,1) 底色 2，珠色 3 ⇒ 错位
    for (let i = 0; i < TRAY_BASE_SLOTS; i++) expect(game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);
    expect(game.tray.freeCount).toBe(0);

    // 真链选错位珠 → 点满托盘的 holding 槽 ⇒ 4a 换选：tray:selected 恰 1、
    // 锚转移 tray（board 锚清）、同色全组 selected、零 tray:stored。
    // （WXG-T-187：旧 §8-11「满槽吞任意槽」门制造 board 锚死锁，已删。）
    const p00 = gridPoint(game, 0, 0);
    game.tapDesign(p00.x, p00.y);
    expect(h.count('board:selected')).toBe(1);
    const pt0 = trayPoint(game, 0);
    game.tapDesign(pt0.x, pt0.y);
    expect(h.count('tray:selected')).toBe(1);
    expect(h.count('tray:stored')).toBe(0); // 满槽禁的只是「取回」，不是换选
    expect(game.selection).toBe('tray'); // 锚转移
    expect(game.grid.cell(0, 0)!.state).toBe('filled'); // 棋盘零状态写
    for (let i = 0; i < TRAY_BASE_SLOTS; i++) {
      expect(game.tray.slot(i)!.state).toBe('selected'); // 同色全组入选
    }
    
    // 重建 board 锚（锚互斥：5a 清托盘选中），腾 1 槽 ⇒ 部分收纳 1 颗
    //（WXG-T-168 裁定②：腾 1 槽 < 组大小 2 ⇒ 只收距锚最近者，余珠留格、锚保持）。
    game.tapDesign(p00.x, p00.y);
    expect(h.count('board:selected')).toBe(2);
    expect(game.selection).toBe('board');
    expect(game.tray.slot(0)!.state).toBe('holding'); // 换选清托盘全组选中
    expect(game.tray.takeBead(TRAY_BASE_SLOTS - 1)).toBe(true);
    const ptLast = trayPoint(game, TRAY_BASE_SLOTS - 1); // 现 free → 4b 取回触发
    game.tapDesign(ptLast.x, ptLast.y);
    expect(h.count('tray:stored')).toBe(1); // 只收 1 颗（旧口径为 0）
    expect(game.grid.cell(0, 0)!.state).toBe('empty'); // 锚珠（最近）被收
    expect(game.grid.cell(1, 1)!.state).toBe('filled'); // 次近留格
    expect(game.tray.slot(TRAY_BASE_SLOTS - 1)!.colorIdx).toBe(3); // 落在被点槽
    expect(game.selection).toBe('board'); // 锚改指剩余珠 ⇒ 仍为 board

    // 再腾 1 槽 ⇒ 剩余 1 颗收进（累计 2 次 stored）。
    // v2.3（WXG-T-168）：落槽 = **玩家点槽定落位**（覆盖 v2.2 自动归类）。
    // ⚠ `takeBead` 会**左移补位**（§8-6b 紧凑不变式）⇒ 腾槽后 free 的仍是末槽，
    // 故第二次点击仍落在 TRAY_BASE_SLOTS-1。
    expect(game.tray.takeBead(TRAY_BASE_SLOTS - 2)).toBe(true);
    expect(game.tray.slot(TRAY_BASE_SLOTS - 1)!.state).toBe('free'); // 左移补位自证
    const ptPrev = trayPoint(game, TRAY_BASE_SLOTS - 1);
    game.tapDesign(ptPrev.x, ptPrev.y);
    expect(h.count('tray:stored')).toBe(2);
    expect(game.grid.cell(0, 0)!.state).toBe('empty');
    expect(game.grid.cell(1, 1)!.state).toBe('empty');
    expect(game.tray.slot(TRAY_BASE_SLOTS - 2)!.colorIdx).toBe(3); // v2.3：实际落位 = 被点槽
    expect(game.tray.slot(TRAY_BASE_SLOTS - 1)!.colorIdx).toBe(3);
    expect(game.selection).toBe('none'); // 整组离格 ⇒ 锚清
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


// ── [WXG-T-237 v6.0 · 用户 2026-10-04 裁定「托盘还是还原之前颜色」] ──────────
//
// v5.0 曾把托盘底改成「格底（关卡主色 `edge`）」，用户看图后裁**还原**。
// ⇒ 本批把 `mainColorIdx`（关卡主色字段）**一并删除**（随回滚无人消费 ⇒ 不留死代码），
//    并用两条守卫把「托盘保持中性」钉死：
//  ① 托盘面板 fill ≡ `palette.panel`（中性，不随关卡变）。
//  ② **反向守卫**：面板 fill **不得等于任何关卡色的 `edge`** —— 若有人再把托盘底接回
//     主色/目标色，此腿当场红（v5.0 的回归方向被封死）。
describe('托盘保持中性底（WXG-T-237 v6.0）', () => {
    it('① 面板底 = palette.panel（中性，不随关卡色变）', () => {
        const h = mkHarness('wxgame.beads.test.tray-base-v60');
        const cmds = renderSnap(h.game.snapshot);
        const panel = cmds.filter(
            (c) => c.kind === 'rect' && (c as { radius: number }).radius === 18,
        ) as { fill?: string }[];
        expect(panel.length, '托盘面板 rect 在场').toBeGreaterThan(0);
        expect(panel.every((c) => c.fill === DEFAULT_PALETTE.panel), '面板 ≡ 中性 panel').toBe(true);
    });

    it('② ⛔ 反向守卫：面板底不得等于任何关卡色的 edge（封死 v5.0 回归方向）', () => {
        const h = mkHarness('wxgame.beads.test.tray-base-v60-guard');
        const cmds = renderSnap(h.game.snapshot);
        const panel = cmds.filter(
            (c) => c.kind === 'rect' && (c as { radius: number }).radius === 18,
        ) as { fill?: string }[];
        // 关卡色板所有 `edge`（格底色）—— 托盘底**必须**与之逐条不等
        const edgeSet = new Set<string>();
        for (const c of h.game.snapshot.cells) {
            if (c.colorIdx > 0) edgeSet.add(endpointOf(DEMO_BEAD_INKS, c.colorIdx).edge);
        }
        expect(edgeSet.size, '测试关卡有目标色').toBeGreaterThan(0);
        for (const p of panel) {
            expect(edgeSet.has(p.fill ?? ''), '托盘底不得接回格底/主色').toBe(false);
        }
    });
});

// ── [WXG-T-240 · 2026-10-04 用户报「点击珠子选择时候，下面的槽没有显示」] ──────────
//
// 病因：`drawTray` 里 `if (slot.state === 'free')` 才画槽 ⇒ **有珠的槽从不画坑**。
// 静息时珠正好盖住坑，看不出来；但**选中时珠抬起 `TRAY_SELECTED_LIFT_PX`** ⇒ 坑底位置
// 暴露成一片空白 ⇒ 读作「珠悬在半空」。
//
// 修法：**有珠的槽一律在珠之前补画槽**（口径与空槽路径逐字同源）——
//   首版只补「选中态」，用户续报「**非抬起状态**也没有槽绘制」⇒ 范围扩到**所有有珠的槽**。
// ⛔ 层序是本质：画在 `drawFilledBead` **之后**会被珠面完全盖住 = 等于没画。
describe('托盘选中态画坑（WXG-T-240）', () => {
    it('有珠的槽在**静息与选中两态**都不得为空白（WXG-T-240 两轮：① 选中空槽 · ② 静息也画）', () => {
        const h = mkHarness('wxgame.beads.test.t240-tray-slot');
        h.game.giveTrayBead(1);
        const lay = trayLayout(1);
        // ① 静息（未选中）：珠面 26 / 格面 30 ⇒ 本该露出 4dp 坑沿
        const before = traySlotArtCount(renderSnap(h.game.snapshot), lay, 0);
        expect(before, '⛔ 静息态槽区不得为空白（否则珠读作浮在面板上）').toBeGreaterThan(0);
        // ② 选中（珠抬起）：坑位暴露，仍须有图元
        h.game.selectTraySlot(0);
        const after = traySlotArtCount(renderSnap(h.game.snapshot), lay, 0);
        expect(after, '⛔ 选中态槽区不得为空白（否则读作悬空）').toBeGreaterThan(0);
    });
});

// ── [T-244 十四批 · 2026-10-04 用户报「托盘的珠子有问题」] ─────────────────────
//
// 实测（tint 臂 = 生产臂）：托盘珠孔心 (172,172,175) 浅灰 vs 盘面珠孔心 (142,37,34) 深色。
// 病因：tint 臂的珠孔**真透**（mask ⌀12 alpha ⇒ 孔色 = 下层槽面 tint 基色 × 0.70），
//   而有珠的槽曾把 `colorIdx` 传成 `undefined` ⇒ 基色落 `palette.slot`（#F7F6FB 近白）。
//   盘面传的是**格目标色** ⇒ 同一颗珠两个域两种话。矢量臂无此病灶（`facet-4` 自画实色
//   孔底 `pit(targetColorIdx ?? colorIdx)`）⇒ 本缺陷**只在生产臂可见**。
// 修法：托盘无目标色 ⇒ 按矢量臂契约的同一回落，**传珠自己的 `colorIdx`**。
// ⛔ 空槽（`state === 'free'`）恒中性 ⇒ v6.0「托盘保持中性收纳区」裁定不受本批影响。
describe('托盘有珠的槽必须带珠色（T-244 十四批 · 孔底透出）', () => {
    it('有珠槽的 socket 亮底 ≡ 该珠 `colorIdx` 的 base（⛔ 不得仍是中性 `palette.slot`）', () => {
        const h = mkHarness('wxgame.beads.test.t244-tray-socket-ink');
        h.game.giveTrayBead(3);
        h.advance(0.4);                                   // 进珠包络越窗（⚠ 单位 = **秒**）
        const snap = h.game.snapshot;
        const slot = snap.traySlots[0]!;
        expect(slot.state, '前置：第 0 槽应有珠').toBe('holding');

        const lay = trayLayout(1);
        const cx = lay.slotCenterX(0);
        const cy = lay.slotCenterY(0);
        // socket 自带亮底 = 唯一一枚**槽径 30**、居槽心的 rect（珠面 26 / 面板 radius 18 大得多 ⇒ 不撞）
        const base = (renderSnap(snap) as readonly { kind: string; x?: number; y?: number; w?: number; fill?: string }[]).filter(
            (k) => k.kind === 'rect' && k.w === TRAY_SLOT
                && Math.abs((k.x ?? 0) + TRAY_SLOT / 2 - cx) < 0.01
                && Math.abs((k.y ?? 0) + TRAY_SLOT / 2 - cy) < 0.01,
        );
        expect(base.length, '有珠的槽须画出自带亮底（socket base）').toBe(1);
        expect(base[0]!.fill, '孔底基色 ≡ 珠色（tint 臂透出的就是它）').toBe(beadColorOf(DEMO_BEAD_INKS, slot.colorIdx));
        expect(base[0]!.fill, '⛔ 不得回退成中性 slot 底（旧口径 ⇒ 托盘珠孔发白）').not.toBe(DEFAULT_PALETTE.slot);
    });
});

// ── [T-244 十二批 · 2026-10-04 用户报「盘面阴影 OK，但托盘的珠子阴影还是不行」] ──
//
// 病因：`drawLiftBeadShadow` 有 **9 个同类型位置参数**，托盘调用把 `TRAY_SLOT`(30) 填进了
//   第 4 槽位（`colorIdx`）⇒ `endpointOf` 越出色板 ⇒ 影墨**静默落进 `FALLBACK_ENDPOINTS` 炭黑**
//   （`warnIndexOutOfRange` 只响一次，且 harness 控制台不归因到本层）⇒ 同一个影函数在盘面
//   是「珠色影」、在托盘是「一块黑」。
//   **实测两墨**（本例变异核得：把托盘改回旧写法 ⇒ 本腿红）：错 = `rgba(10,10,12,0.52)`
//   （炭黑 `#33333D` 的 `shadeOuter`）/ 对 = `rgba(51,49,47,0.52)`（珠色的 `shadeOuter`）
//   ⇒ 托盘那块比盘面**暗一档且去色**，正是「不行」的读感。已把两处收拢到
//   `view-model::drawLiftShadowOn`。
//
// ⛔ 本例锁的是**调用侧**：`bead-render.test.ts` ①③ 直接调函数、自己传 colorIdx，
//   对「槽位填错」零判别力（K-035/K-060 同族的验证盲区）。
describe('抬起影墨与进珠「出现」两处同口径（T-244 十二/十三批）', () => {
    /** 一帧里的多边形墨列表（影 = 抬起帧相对静息帧**新出现**的那一条）。 */
    const polyFills = (cmds: readonly DrawCommand[]): string[] =>
        cmds.filter((c) => c.kind === 'polygon').map((c) => (c as { fill?: string }).fill ?? '');

    it('托盘选中抬起帧新增的多边形墨 ≡ 该珠 colorIdx 的 `shadeOuter` 带 α（⛔ 不得是越界兜底炭黑）', () => {
        const h = mkHarness('wxgame.beads.test.t244-tray-lift-shadow');
        h.game.giveTrayBead(1);
        h.advance(0.4);                       // 进珠包络越窗（⚠ `advance` 单位是**秒**）
        const snap = h.game.snapshot;
        const slot = snap.traySlots[0]!;
        expect(slot.state, '前置：托盘第 0 槽应有珠（holding = 有珠待取）').toBe('holding');

        const rest = polyFills(renderSnap(snap));                       // 静息：有珠无影
        h.game.selectTraySlot(0);
        h.advance(0.4);                                                  // 越过 SELECT_LIFT_MS = 200ms
        const lifted = polyFills(renderSnap(h.game.snapshot));
        const added = lifted.filter((f) => !rest.includes(f));

        const ink = withAlpha(endpointOf(DEMO_BEAD_INKS, slot.colorIdx).shadeOuter, LIFT_SHADOW_ALPHA);
        expect(added, '抬起帧必须新出一条影多边形').toContain(ink);
        // 反证腿：越界兜底墨（即本批事故值 `colorIdx = TRAY_SLOT`）不得在场。
        const fallbackInk = withAlpha(endpointOf(DEMO_BEAD_INKS, TRAY_SLOT).shadeOuter, LIFT_SHADOW_ALPHA);
        expect(fallbackInk, '前置：`TRAY_SLOT` 越出色板 ⇒ 该墨即兜底炭黑').not.toBe(ink);
        expect(added, '⛔ 影墨不得走越界兜底炭黑（托盘曾填错槽位的事故值）').not.toContain(fallbackInk);
    });

    it('盘面选中抬起影墨 ≡ **珠色**（⛔ 不得是格目标色 ⇒ 错位珠「灰珠投红影」）', () => {
        const h = mkHarness('wxgame.beads.test.t244-board-lift-ink');
        const game = h.game;
        fillBoardInPlace(game);
        // 同色错位对（WXG-T-157 组选筛色口径）：两颗珠同为色 3，两格目标色互异且均 ≠3
        // ⇒ 新码下影墨集 = {色3 墨}，旧码下 = {两格目标色墨} ⇒ 两条腿都能红（非假绿）。
        game.grid.setBead(0, 0, 3);
        game.grid.setBead(1, 1, 3);
        h.advance(0.2);

        const rest = game.snapshot;
        expect(rest.cells[0]!.beadColorIdx, '前置：(0,0) 须为错位珠').not.toBe(rest.cells[0]!.colorIdx);
        const restFills = polyFills(renderSnap(rest));

        expect(game.selectBoardBead(0, 0), 'board 锚建立').toBe(true);
        h.advance(0.4);                                                 // 越过 SELECT_LIFT_MS = 200ms
        const snap = game.snapshot;
        const added = polyFills(renderSnap(snap)).filter((f) => !restFills.includes(f));

        const cell = snap.cells[0]!;
        const inkOf = (idx: number) => withAlpha(endpointOf(DEMO_BEAD_INKS, idx).shadeOuter, LIFT_SHADOW_ALPHA);
        expect(added, '抬起帧影墨须跟珠体同族').toContain(inkOf(cell.beadColorIdx));
        expect(added, '⛔ 影不得取格**目标色**（本批之前的旧口径）').not.toContain(inkOf(cell.colorIdx));
    });

    it('托盘进珠：相位未到的珠**不画**（⛔ 不得悬在槽上方等待落下，同盘面 `glHidden`）', () => {
        const h = mkHarness('wxgame.beads.test.t244-tray-hidden');
        const game = h.game;
        // 本盘默认无错位珠（`noAssemble`）⇒ 同上一例口径手工造两颗同色错位珠。
        fillBoardInPlace(game);
        game.grid.setBead(0, 0, 3);
        game.grid.setBead(1, 1, 3);
        h.advance(0.2);
        expect(game.grid.isMisplaced(0, 0) && game.grid.isMisplaced(1, 1), '前置：两格皆错位珠').toBe(true);
        // 同帧两次取回 ⟹ 多槽队列 steps = [0,1]（九批），且 `elapsedMs` 仍为 0
        expect(game.retrieveBead(0, 0), '第一颗取回').toBe(true);
        expect(game.retrieveBead(1, 1), '第二颗取回').toBe(true);
        const snap = game.snapshot;
        expect(snap.trayLandCount, '前置：托盘队列须有 2 颗').toBe(2);
        expect(snap.trayLandSteps[1], '前置：第二颗错峰序号 > 0').toBeGreaterThan(0);

        const cmds = renderSnap(snap);
        /** 该槽「悬空位」（槽心 + 22dp）上是否有图元（r=6 ⇒ 只抓得到以珠心为圆心的层）。 */
        const artAtHover = (slot: number): number => {
            const p = trayPoint(game, slot);
            return cmds.filter((k) => {
                const x = (k as { x?: number; cx?: number }).x ?? (k as { cx?: number }).cx;
                const y = (k as { y?: number; cy?: number }).y ?? (k as { cy?: number }).cy;
                return x !== undefined && y !== undefined
                    && Math.hypot(x - p.x, y - (p.y + GROUP_LAND_DROP_PX)) <= 6;
            }).length;
        };
        expect(artAtHover(snap.trayLandSlots[1]!), '⛔ 未轮到的珠不得悬在槽上方').toBe(0);
        // 对照腿：轮到的那颗（step 0）此刻确实从 22dp 处落下 ⇒ 同高度必须有珠。
        expect(artAtHover(snap.trayLandSlots[0]!), '对照：step 0 那颗在落体起点').toBeGreaterThan(0);
    });
});
