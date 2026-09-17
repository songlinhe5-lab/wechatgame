/**
 * Epic T-133 · E1 — v2.0「错位归位」grid state machine + retrieve/place
 * adjudication (bead-grid v2.0 §2.2/§2.3/§8; systems-index v1.22 §3.13/§4;
 * tray-spawner v2.0 §2.4; core-loop v2.0 §2.2).
 *
 * Scenarios are HAND-CONSTRUCTED through the public grid/tray/game APIs —
 * no level JSON, no swaps BOOT validation (that is E5).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { TRAY_BASE_SLOTS } from '../src/config/tuning.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import { judgePlacement } from '../src/systems/placement.js';
import type { BeadsGame } from '../src/game/beads-game.js';

/** Fill every fillable cell with its 底色 → a fully-placed (就位) board. */
function fillBoardInPlace(game: BeadsGame): void {
  const grid = game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cell(r, c)!;
      if (!cell.void && cell.state === 'empty') grid.fill(r, c);
    }
  }
}

/**
 * Mirror one v2.0 BOOT `swaps` pair via the assembly primitive (`setBead` —
 * swaps happen BEFORE the play state machine takes over, so they bypass the
 * retrieve/place edges by design). Both cells end misplaced.
 */
function swapBeads(game: BeadsGame, r1: number, c1: number, r2: number, c2: number): void {
  const grid = game.grid;
  const a = grid.cell(r1, c1)!.beadColorIdx;
  const b = grid.cell(r2, c2)!.beadColorIdx;
  expect(grid.setBead(r1, c1, b)).toBe(true);
  expect(grid.setBead(r2, c2, a)).toBe(true);
}

/** A 6×5 fully fillable board (simpleTestLevel pattern) → 30 beads. */
function makeFullBoardHarness(saveKey: string): Harness {
  return createBeadsHarness({
      noAssemble: true,
    levels: [simpleTestLevel()],
    saveKey,
  });
}

describe('E1 · grid state machine (bead-grid v2.0 §2.2)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('empty → filled(就位): default bead = 底色, terminal, zero misplaced', () => {
    const { game } = makeFullBoardHarness('wxgame.beads.test.e1a');
    const grid = game.grid;
    expect(grid.fill(0, 0)).toBe(true);
    const cell = grid.cell(0, 0)!;
    expect(cell.state).toBe('filled');
    expect(cell.beadColorIdx).toBe(cell.colorIdx);
    expect(grid.isMisplaced(0, 0)).toBe(false);
    expect(grid.misplacedCount).toBe(0);
    // 就位珠是终态：取回被拒（§8-6「filled(就位) 仍不可转移」）。
    expect(grid.retrieve(0, 0)).toBe(0);
    expect(grid.cell(0, 0)!.state).toBe('filled');
  });

  it('empty → filled(错位): bead ≠ 底色 counts as misplaced; retrieve reverts to empty', () => {
    const { game } = makeFullBoardHarness('wxgame.beads.test.e1b');
    const grid = game.grid;
    const wrong = grid.requiredColor(1, 1) === 1 ? 2 : 1;
    expect(grid.fill(1, 1, wrong)).toBe(true);
    expect(grid.isMisplaced(1, 1)).toBe(true);
    expect(grid.misplacedCount).toBe(1);

    // filled(错位) ⇄ empty 双向（§8-6）：取回 → empty，且可再被归位。
    const bead = grid.retrieve(1, 1);
    expect(bead).toBe(wrong);
    expect(grid.cell(1, 1)!.state).toBe('empty');
    expect(grid.cell(1, 1)!.beadColorIdx).toBe(0);
    expect(grid.filledCount).toBe(0);
    expect(grid.misplacedCount).toBe(0);
    expect(grid.fill(1, 1)).toBe(true); // 归位到原格 → 终态就位
    expect(grid.isMisplaced(1, 1)).toBe(false);
  });

  it('locked cells are constant: fill refuses, retrieve refuses (§2.2 locked 恒定)', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 94, pattern: ['1231x3', '123123', '123123', '123123', '123123'] })],
      saveKey: 'wxgame.beads.test.e1c',
    });
    const grid = harness.game.grid;
    expect(grid.cell(0, 4)!.state).toBe('locked');
    expect(grid.fill(0, 4)).toBe(false);
    expect(grid.fill(0, 4, 3)).toBe(false);
    expect(grid.retrieve(0, 4)).toBe(0);
    expect(grid.cell(0, 4)!.state).toBe('locked');
  });
});

describe('E1 · retrieve adjudication (bead-grid v2.0 §2.3 路径 A / §8-2)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('misplaced bead + free slot → stored: cell empty, slot holding, tray:stored payload', () => {
    const harness = makeFullBoardHarness('wxgame.beads.test.e1d');
    const game = harness.game;
    const grid = game.grid;
    fillBoardInPlace(game);
    swapBeads(game, 0, 0, 1, 1);
    const beadAt00 = grid.cell(0, 0)!.beadColorIdx;
    expect(grid.misplacedCount).toBe(2);
    const before = harness.count('tray:stored');

    expect(game.retrieveBead(0, 0, 3)).toBe(true);

    // S3 侧：格转 empty；S4 侧：玩家选择的 3 号槽 holding。
    expect(grid.cell(0, 0)!.state).toBe('empty');
    expect(grid.filledCount).toBe(29);
    expect(grid.misplacedCount).toBe(1);
    const slot = game.tray.slot(3)!;
    expect(slot.state).toBe('holding');
    expect(slot.colorIdx).toBe(beadAt00);

    // tray:stored 恰 1 次，payload {slot, colorIdx, fromRow, fromCol}（§4 事件表）。
    const stored = harness.all<{ slot: number; colorIdx: number; fromRow: number; fromCol: number }>(
      'tray:stored',
    );
    expect(stored.length - before).toBe(1);
    expect(stored[stored.length - 1]).toEqual({
      slot: 3,
      colorIdx: beadAt00,
      fromRow: 0,
      fromCol: 0,
    });
  });

  it('就位珠 / locked / empty / out-of-bounds retrieve → refused, ZERO events', () => {
    const harness = makeFullBoardHarness('wxgame.beads.test.e1e');
    const game = harness.game;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fillBoardInPlace(game);

    const eventsBefore = harness.emitted.length;
    expect(game.retrieveBead(0, 0, 0)).toBe(false); // 就位珠（终态）
    expect(game.retrieveBead(0, 4, 0)).toBe(false); // 可填格但就位 → not-misplaced
    expect(game.retrieveBead(99, 99, 0)).toBe(false); // 越界
    expect(harness.emitted.length).toBe(eventsBefore);
    expect(harness.count('tray:stored')).toBe(0);
    expect(game.grid.filledCount).toBe(30);
    warn.mockRestore();
  });

  it('满槽禁取珠（§3.13）：refused, zero events, zero state write', () => {
    const harness = makeFullBoardHarness('wxgame.beads.test.e1f');
    const game = harness.game;
    const grid = game.grid;
    fillBoardInPlace(game);
    swapBeads(game, 0, 0, 1, 1);

    // 填满托盘全部 12 槽（TRAY_BASE_SLOTS）。
    for (let i = 0; i < TRAY_BASE_SLOTS; i++) expect(game.giveTrayBead(1)).toBeGreaterThanOrEqual(0);
    expect(game.tray.freeCount).toBe(0);

    const eventsBefore = harness.emitted.length;
    const slotStates = [0, 3, 11].map((i) => ({ ...game.tray.slot(i)! }));
    expect(game.retrieveBead(0, 0, 5)).toBe(false);

    expect(harness.emitted.length).toBe(eventsBefore); // 零事件
    expect(harness.count('tray:stored')).toBe(0);
    expect(game.tray.freeCount).toBe(0); // 零状态写
    expect(grid.cell(0, 0)!.state).toBe('filled'); // 格零状态写
    expect(grid.isMisplaced(0, 0)).toBe(true);
    expect([0, 3, 11].map((i) => ({ ...game.tray.slot(i)! }))).toEqual(slotStates);
  });

  it('取回后重新归位到原格（§8-6 双向性终态）+ 取回不触发通关判定', () => {
    const harness = makeFullBoardHarness('wxgame.beads.test.e1g');
    const game = harness.game;
    fillBoardInPlace(game);
    swapBeads(game, 2, 2, 3, 3);
    expect(game.grid.misplacedCount).toBe(2);

    // 取回 (2,2) 的珠——只减不增，不可能全满。
    expect(game.retrieveBead(2, 2, 0)).toBe(true);
    expect(game.phase).toBe('playing'); // 取回不触发完成判定
    expect(harness.count('level:cleared')).toBe(0);

    // (3,3) 仍被它的错位珠占着 → 先取回腾格，再让托盘两颗珠各归其位。
    expect(game.retrieveBead(3, 3, 1)).toBe(true);
    expect(game.grid.misplacedCount).toBe(0);
    expect(game.grid.filledCount).toBe(28);

    // 槽 0 的珠归位到它真正的目标格 (3,3)；槽 1 的珠归位回原格 (2,2)。
    expect(game.selectTraySlot(0)).toBe(true);
    expect(game.tapGridCell(3, 3)).toBe(true);
    expect(game.grid.cell(3, 3)!.state).toBe('filled');
    expect(game.grid.isMisplaced(3, 3)).toBe(false);
    expect(game.tray.slot(0)!.state).toBe('free');
    expect(game.grid.misplacedCount).toBe(0); // 两颗错位珠都已在托盘

    expect(game.selectTraySlot(1)).toBe(true);
    expect(game.tapGridCell(2, 2)).toBe(true);
    expect(game.grid.cell(2, 2)!.state).toBe('filled');
    expect(game.grid.isMisplaced(2, 2)).toBe(false);
    expect(game.grid.misplacedCount).toBe(0);
    expect(game.grid.isComplete()).toBe(true);
  });
});

describe('E1 · isComplete = 全满 且 零错位 (bead-grid v2.0 §2.3 路径 B 第 4 步)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('负例：满盘含 1 颗错位珠 ⇒ isComplete false、不通关（§8-5 判据形态）', () => {
    const harness = makeFullBoardHarness('wxgame.beads.test.e1h');
    const game = harness.game;
    const grid = game.grid;
    fillBoardInPlace(game);
    swapBeads(game, 0, 0, 1, 1);

    // 满盘（filledCount === fillableTotal）但错位 ⇒ 未通关。
    expect(grid.filledCount).toBe(grid.fillableTotal);
    expect(grid.misplacedCount).toBe(2);
    expect(grid.isComplete()).toBe(false);
    expect(game.phase).toBe('playing');

    // 逐颗归位：取回两颗错位珠，经托盘各归其位 → 最后一颗归位触发通关。
    // 交换后 (0,0) 持 (1,1) 底色珠、(1,1) 持 (0,0) 底色珠。
    expect(game.retrieveBead(0, 0, 0)).toBe(true);
    expect(game.retrieveBead(1, 1, 1)).toBe(true);
    expect(game.grid.misplacedCount).toBe(0);
    expect(game.grid.filledCount).toBe(28);

    expect(game.selectTraySlot(0)).toBe(true);
    expect(game.tapGridCell(1, 1)).toBe(true);
    expect(harness.count('level:cleared')).toBe(0); // 还差一颗
    expect(game.selectTraySlot(1)).toBe(true);
    expect(game.tapGridCell(0, 0)).toBe(true);

    expect(grid.filledCount).toBe(30);
    expect(grid.misplacedCount).toBe(0);
    expect(grid.isComplete()).toBe(true);
    expect(game.phase).toBe('level-clear');
    expect(harness.count('level:cleared')).toBe(1);
  });
});

describe('E1 · placement slot 可选（systems-index v1.22 §4 payload 变更，E4 前置）', () => {
  afterEach(() => vi.restoreAllMocks());

  it('judgePlacement 无 slot（解环器路径形态）→ placed 且 verdict.slot undefined', () => {
    const { game } = makeFullBoardHarness('wxgame.beads.test.e1i');
    const grid = game.grid;
    const color = grid.requiredColor(0, 0);
    const verdict = judgePlacement(grid, 0, 0, color);
    if (verdict.outcome !== 'placed') throw new Error(`expected placed, got ${verdict.outcome}`);
    expect(verdict.slot).toBeUndefined();
    expect(grid.cell(0, 0)!.state).toBe('filled');
    expect(grid.cell(0, 0)!.beadColorIdx).toBe(color);
  });

  it('托盘路径 bead:placed 仍恒带 slot（本单口径）', () => {
    const harness = makeFullBoardHarness('wxgame.beads.test.e1j');
    const game = harness.game;
    const color = game.grid.requiredColor(0, 0);
    const slot = game.giveTrayBead(color);
    game.selectTraySlot(slot);
    expect(game.tapGridCell(0, 0)).toBe(true);
    const placed = harness.all<{ slot?: number }>('bead:placed');
    expect(placed).toHaveLength(1);
    expect(placed[0]!.slot).toBe(slot);
  });
});
