/**
 * S3 bead-grid §8 criteria (gdd/bead-grid.md §8, quoted verbatim in test names).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createBeadsHarness, simpleTestLevel, placeColor } from './helpers.js';

describe('S3 bead-grid', () => {
  afterEach(() => vi.restoreAllMocks());

  // §8.1 装载合法关卡后，empty 格数 + locked 格数 === cols×rows，且 ≥1 格为 empty。
  it('§8-1 loading a level: empty + locked === cols×rows with at least one empty', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s3a',
    });
    const grid = harness.game.grid;
    expect(grid.cols).toBe(6);
    expect(grid.rows).toBe(5);
    let empty = 0;
    let locked = 0;
    for (let i = 0; i < grid.rows; i++) {
      for (let j = 0; j < grid.cols; j++) {
        const state = grid.cell(i, j)!.state;
        if (state === 'empty') empty++;
        if (state === 'locked') locked++;
      }
    }
    expect(empty + locked).toBe(6 * 5);
    expect(empty).toBeGreaterThanOrEqual(1);
  });

  // §8.2 匹配落子：目标格变 filled 且 colorIdx 与图案一致；bead:placed 恰广播 1 次，
  // payload 含 row/col/colorIdx/slot。
  it('§8-2 matching placement fills the cell and broadcasts bead:placed exactly once', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s3b',
    });
    const game = harness.game;
    const row = 1;
    const col = 2;
    const color = game.grid.requiredColor(row, col);

    expect(placeColor(game, color, row, col)).toBe(true);
    expect(game.grid.cell(row, col)!.state).toBe('filled');
    expect(game.grid.cell(row, col)!.colorIdx).toBe(color);

    const placed = harness.all<{ row: number; col: number; colorIdx: number; slot: number }>(
      'bead:placed',
    );
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ row, col, colorIdx: color });
    expect(typeof placed[0]!.slot).toBe('number');

    // The source slot is freed (bead left the tray).
    const slot = placed[0]!.slot;
    expect(game.tray.slot(slot)!.state).toBe('free');
  });

  // §8.3 不匹配落子：目标格保持 empty；bead:rejected 恰广播 1 次；对应托盘珠未被移除。
  it('§8-3 mismatched placement keeps the cell empty, rejects once, bead stays in tray', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s3c',
    });
    const game = harness.game;
    const row = 0;
    const col = 0;
    const required = game.grid.requiredColor(row, col);
    const wrong = required === 1 ? 2 : 1;

    const slot = game.giveTrayBead(wrong);
    expect(slot).toBeGreaterThanOrEqual(0);
    game.selectTraySlot(slot);
    expect(game.tapGridCell(row, col)).toBe(false);

    expect(game.grid.cell(row, col)!.state).toBe('empty');
    expect(harness.count('bead:rejected')).toBe(1);
    // The bead is still held in its slot (A4: no penalty; it may keep the
    // selection mark — it just never left the tray).
    expect(game.tray.slot(slot)!.state).not.toBe('free');
    expect(game.tray.slot(slot)!.colorIdx).toBe(wrong);
  });

  // §8.4 对 locked 格与 filled 格落子：零事件、零反馈（用事件监听计数器断言 =0）。
  it('§8-4 placements on locked/filled cells produce zero events of any kind', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [
        simpleTestLevel({
          id: 93,
          pattern: ['1231x3', '123123', '123123', '123123', '123123'],
        }),
      ],
      saveKey: 'wxgame.beads.test.s3d',
    });
    const game = harness.game;
    const color = game.grid.requiredColor(0, 0);
    const lastHoldingSlot = (): number => {
      for (let i = game.tray.capacity - 1; i >= 0; i--) {
        if (game.tray.slot(i)!.state !== 'free') return i;
      }
      return -1;
    };

    // Locked cell (0,4): bead stays, nothing is broadcast.
    game.giveTrayBead(color);
    game.selectTraySlot(lastHoldingSlot());
    expect(game.tapGridCell(0, 4)).toBe(false);

    // Filled cell: fill (0,0) first, then tap it again. v2.2 组选下保持单珠组
    // （每组仅 1 颗 ⇒ 不触发批量填充），旧「先囤两颗再分别落子」序列会被整组选中
    // + 8 向蔓延改写，与本判据（locked/filled 零事件）无关。
    expect(game.tapGridCell(0, 0)).toBe(true); // 同一选中组的合法落子，组清空锚回 none
    game.giveTrayBead(color);
    game.selectTraySlot(lastHoldingSlot());
    expect(game.tapGridCell(0, 0)).toBe(false);

    // Zero S3 placement feedback: no placed beyond the one legitimate fill,
    // no rejected at all (locked/filled are silent — core-loop §6).
    expect(harness.count('bead:rejected')).toBe(0);
    expect(harness.count('bead:placed')).toBe(1);
  });

  // §8.5 将图案仅剩的 1 个可填格填满 → S1 收到 cleared 前置信号 ≤ 1 帧内；
  // filled 数 === 可填格总数。
  it('§8-5 filling the last fillable cell signals clear within one frame', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ decoys: [] })],
      saveKey: 'wxgame.beads.test.s3e',
    });
    const game = harness.game;
    const total = game.grid.fillableTotal;

    // Fill everything but one cell.
    outer: for (let row = 0; row < game.grid.rows; row++) {
      for (let col = 0; col < game.grid.cols; col++) {
        if (game.grid.filledCount >= total - 1) break outer;
        const color = game.grid.requiredColor(row, col);
        expect(placeColor(game, color, row, col)).toBe(true);
      }
    }
    expect(game.grid.filledCount).toBe(total - 1);
    expect(harness.count('level:cleared')).toBe(0);

    // The final placement + one frame → cleared.
    const lastRow = 4;
    const lastCol = 5;
    expect(placeColor(game, game.grid.requiredColor(lastRow, lastCol), lastRow, lastCol)).toBe(
      true,
    );
    harness.advance(1 / 60);
    expect(game.grid.filledCount).toBe(total);
    expect(game.phase).toBe('level-clear');
    expect(harness.count('level:cleared')).toBe(1);
  });

  // §8.7 同帧双落子同格：仅第 1 条生效，第 2 条走忽略分支，bead:placed 总数 =1。
  it('§8-7 same-frame double placement on one cell: only the first lands, placed count = 1', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s3g',
    });
    const game = harness.game;
    const row = 2;
    const col = 3;
    const color = game.grid.requiredColor(row, col);

    // Two requests in the same frame (before any update runs).
    expect(game.tapGridCell(row, col) || placeColor(game, color, row, col)).toBe(true);
    const secondViaCommand = (() => {
      const slot = game.giveTrayBead(color);
      game.selectTraySlot(slot);
      return game.tapGridCell(row, col);
    })();
    expect(secondViaCommand).toBe(false);

    expect(harness.count('bead:placed')).toBe(1);
    expect(game.grid.cell(row, col)!.state).toBe('filled');
  });

  // §8.9 colorIdx = 0 或 99 的落子请求：按 bead:rejected 处理且记警告，不崩溃。
  it('§8-9 colorIdx 0 or 99 is rejected with a warning and never crashes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s3i',
    });
    const game = harness.game;

    for (const bad of [0, 99]) {
      const slot = game.giveTrayBead(bad);
      expect(slot).toBeGreaterThanOrEqual(0); // tray accepts; S3 defends
      game.selectTraySlot(slot);
      expect(game.tapGridCell(0, 0)).toBe(false);
      game.tray.takeBead(slot);
    }

    expect(harness.count('bead:rejected')).toBe(2);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(game.phase).toBe('playing');
  });
});
