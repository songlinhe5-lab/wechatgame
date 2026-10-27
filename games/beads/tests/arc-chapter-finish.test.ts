/**
 * P0-1 第一章收尾：章末关（L9）通过 ⇒ 进本章 FINISH，不再自动推进到第二章 L10。
 *
 * 判据来源：`games/beads/design/gdd/core-loop.md` §8-8（本次改为「章末关通过 → 本章结算」）。
 * 章界真源 = `games/beads/src/config/arcs.ts` 的 `ARCS[].levelRefs`（派生 `isBossLevelId`），
 * ⛔ 不写死关数、⛔ 不删 L10（K-161 / K-151）。
 */

import { describe, expect, it } from 'vitest';
import { clearPanelLayout } from '../src/systems/clear-panel.js';
import { finishPanelLayout } from '../src/systems/finish-panel.js';
import {
  advancePastClearWave,
  createBeadsHarness,
  firstEmptyCell,
  placeColor,
  simpleTestLevel,
} from './helpers.js';

/** 第一章 1–9 + 第二章 10（id 轴与 `ARCS.levelRefs` 同轴 ⇒ 9 / 10 是章末 boss）。 */
const CHAPTER_LEVELS = Array.from({ length: 10 }, (_, i) => simpleTestLevel({ id: i + 1 }));

type Rect = { xMin: number; xMax: number; yMin: number; yMax: number };

function centre(rect: Rect): { x: number; y: number } {
  return { x: (rect.xMin + rect.xMax) / 2, y: (rect.yMin + rect.yMax) / 2 };
}

/** `noAssemble` 夹具：把整盘填到只剩最后一格，再落下最后一格 ⇒ LEVEL_CLEAR。 */
function clearCurrentLevel(game: ReturnType<typeof createBeadsHarness>['game']): void {
  while (game.grid.filledCount < game.grid.fillableTotal - 1 && game.phase === 'playing') {
    const cell = firstEmptyCell(game)!;
    expect(placeColor(game, game.grid.requiredColor(cell.row, cell.col), cell.row, cell.col)).toBe(true);
  }
  const last = firstEmptyCell(game)!;
  expect(placeColor(game, game.grid.requiredColor(last.row, last.col), last.row, last.col)).toBe(true);
  expect(game.phase).toBe('level-clear');
}

describe('P0-1 第一章收尾（core-loop §8-8）', () => {
  it('L9 结算主钮 ⇒ FINISH，总览只列本章 9 关，且不进 L10', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: CHAPTER_LEVELS,
      saveKey: 'wxgame.beads.test.arc-finish-l9',
    });

    h.game.goToLevel(8); // L9
    clearCurrentLevel(h.game);
    advancePastClearWave(h);
    expect(h.game.snapshot.clearLastLevel).toBe(true);

    const next = centre(clearPanelLayout({ lastLevel: true }).buttons.find((b) => b.id === 'next')!.rect);
    h.game.tapDesign(next.x, next.y);
    h.advance(1 / 60);

    expect(h.game.phase).toBe('finish');
    expect(h.game.levelIndex).toBe(8); // ⛔ 不得推进到 L10（index 9）
    expect(h.game.snapshot.finishStars.length).toBe(9); // 总览 = 本章，不含第二章
  });

  it('本章 FINISH 的「重玩」⇒ 回到 L1 继续普通模式', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: CHAPTER_LEVELS,
      saveKey: 'wxgame.beads.test.arc-finish-replay',
    });

    h.game.goToLevel(8);
    clearCurrentLevel(h.game);
    advancePastClearWave(h);
    const next = centre(clearPanelLayout({ lastLevel: true }).buttons.find((b) => b.id === 'next')!.rect);
    h.game.tapDesign(next.x, next.y);
    h.advance(1 / 60);
    expect(h.game.phase).toBe('finish');

    const replay = centre(finishPanelLayout(9).buttons.find((b) => b.id === 'replay')!.rect);
    h.game.tapDesign(replay.x, replay.y);
    h.advance(1 / 60);

    expect(h.game.phase).toBe('playing');
    expect(h.game.mode).toBe('normal');
    expect(h.game.levelIndex).toBe(0);
  });

  it('回归：非 boss 关表仍按「全局末关 ⇒ FINISH」收尾', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 91 }), simpleTestLevel({ id: 92 }), simpleTestLevel({ id: 93 })],
      saveKey: 'wxgame.beads.test.arc-finish-legacy',
    });

    h.game.goToLevel(2);
    clearCurrentLevel(h.game);
    advancePastClearWave(h);
    const next = centre(clearPanelLayout({ lastLevel: true }).buttons.find((b) => b.id === 'next')!.rect);
    h.game.tapDesign(next.x, next.y);
    h.advance(1 / 60);

    expect(h.game.phase).toBe('finish');
    expect(h.game.snapshot.finishStars.length).toBe(3);
  });
});
