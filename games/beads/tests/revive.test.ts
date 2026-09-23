/**
 * Ordinary-mode fail-page revive (systems-index §3.11 / WXG-T-058).
 *
 * The Mock never calls `wx.createRewardedVideoAd`. Tests settle it explicitly.
 */

import { describe, it, expect } from 'vitest';
import {
  MockRewardedAdProvider,
  NoopRewardedAdProvider,
  RenderModelBuilder,
  type DrawCommand,
} from '@wxgame/framework';
import {
  CAPSULE_AVOID,
  DESIGN_H,
  DESIGN_W,
  FAIL_BUTTON_H,
  FAIL_PRIMARY_W,
  REVIVE_BONUS_SEC,
  REVIVE_MAX_PER_LEVEL,
  TOUCH_MIN,
  computeClearStars,
} from '../src/config/tuning.js';
import {
  failPanelLabel,
  failPanelLayout,
  type FailPanelAction,
} from '../src/systems/fail-panel.js';
import { rectsOverlap } from '../src/systems/pause-panel.js';
import { sprintSettleLayout } from '../src/systems/sprint-settle.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import {
  createBeadsHarness,
  placeColor,
  simpleTestLevel,
  type Harness,
} from './helpers.js';
import type { BeadsGame } from '../src/game/beads-game.js';

function mockAd(harness: Harness): MockRewardedAdProvider {
  return harness.services.rewardedAd as MockRewardedAdProvider;
}

function tapFail(game: BeadsGame, id: FailPanelAction, reviveAvailable: boolean): boolean {
  const button = failPanelLayout(reviveAvailable).buttons.find((b) => b.id === id);
  if (!button) throw new Error(`fail-panel: no button "${id}"`);
  return game.tapDesign(
    (button.rect.xMin + button.rect.xMax) / 2,
    (button.rect.yMin + button.rect.yMax) / 2,
  );
}

function expire(harness: Harness): void {
  while (harness.game.phase === 'playing') harness.advance(0.5);
  expect(harness.game.phase).toBe('game-over');
}

function filledCount(game: BeadsGame): number {
  let n = 0;
  for (let row = 0; row < game.grid.rows; row++) {
    for (let col = 0; col < game.grid.cols; col++) {
      if (game.grid.cell(row, col)?.state === 'filled') n++;
    }
  }
  return n;
}

function traySignature(game: BeadsGame): string {
  const parts: string[] = [];
  for (let i = 0; i < game.tray.capacity; i++) {
    const slot = game.tray.slot(i)!;
    parts.push(slot.state === 'free' ? '-' : String(slot.colorIdx));
  }
  return parts.join(',');
}

function fillBoard(game: BeadsGame): void {
  for (let row = 0; row < game.grid.rows; row++) {
    for (let col = 0; col < game.grid.cols; col++) {
      if (!game.grid.isFillable(row, col)) continue;
      placeColor(game, game.grid.requiredColor(row, col), row, col);
    }
  }
}

function render(harness: Harness): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
  builder.begin();
  buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
  return builder.end().commands;
}

describe('fail-panel layout (ux-spec §3.5)', () => {
  it('keeps 480×88 buttons inside the plate and clear of the capsule', () => {
    for (const available of [true, false]) {
      const layout = failPanelLayout(available);
      expect(rectsOverlap(layout.panel, CAPSULE_AVOID)).toBe(false);
      expect(layout.buttons.some((b) => b.id === 'revive')).toBe(available);
      for (const button of layout.buttons) {
        expect(button.rect.xMax - button.rect.xMin).toBe(FAIL_PRIMARY_W);
        expect(button.rect.yMax - button.rect.yMin).toBe(FAIL_BUTTON_H);
        expect(button.rect.yMax - button.rect.yMin).toBeGreaterThanOrEqual(TOUCH_MIN);
        expect(button.rect.xMin).toBeGreaterThanOrEqual(layout.panel.xMin);
        expect(button.rect.xMax).toBeLessThanOrEqual(layout.panel.xMax);
        expect(button.rect.yMin).toBeGreaterThanOrEqual(layout.panel.yMin);
        expect(button.rect.yMax).toBeLessThanOrEqual(layout.panel.yMax);
        expect(rectsOverlap(button.rect, CAPSULE_AVOID)).toBe(false);
      }
    }
    expect(failPanelLabel('revive')).toContain(String(REVIVE_BONUS_SEC));
    expect(failPanelLabel('revive')).not.toMatch(/看视频/);
    expect(REVIVE_MAX_PER_LEVEL).toBe(1);
  });
});

describe('ordinary fail-page revive', () => {
  it('complete adds 60s, keeps grid/tray, returns to PLAYING; GAME_OVER does not tick', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.revive.complete',
    });
    placeColor(harness.game, 1, 0, 0);
    harness.game.giveTrayBead(2);
    expire(harness);
    expect(harness.game.remaining).toBe(0);
    expect(harness.count('level:failed')).toBe(1);
    const filled = filledCount(harness.game);
    const tray = traySignature(harness.game);
    expect(filled).toBeGreaterThan(0);

    const spawnedAtFail = harness.count('tray:spawned');
    const ticksAtFail = harness.count('timer:tick');
    harness.advance(8);
    expect(harness.game.phase).toBe('game-over');
    expect(harness.game.remaining).toBe(0);
    expect(harness.count('tray:spawned')).toBe(spawnedAtFail);
    expect(harness.count('timer:tick')).toBe(ticksAtFail);

    expect(tapFail(harness.game, 'revive', true)).toBe(true);
    expect(harness.game.watchingAd).toBe(true);
    expect(harness.game.phase).toBe('game-over');
    expect(mockAd(harness).placement).toBe('fail-continue');

    mockAd(harness).settle('complete');
    expect(harness.game.phase).toBe('playing');
    expect(harness.game.remaining).toBe(REVIVE_BONUS_SEC);
    expect(harness.game.reviveBonusSec).toBe(REVIVE_BONUS_SEC);
    expect(harness.game.revived).toBe(true);
    expect(filledCount(harness.game)).toBe(filled);
    expect(traySignature(harness.game)).toBe(tray);
    expect(harness.game.snapshot.reviveAvailable).toBe(false);
  });

  it('skip and error stay GAME_OVER with zero extra time', () => {
    const skip = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.revive.skip',
    });
    expire(skip);
    tapFail(skip.game, 'revive', true);
    mockAd(skip).settle('skip');
    expect(skip.game.phase).toBe('game-over');
    expect(skip.game.remaining).toBe(0);
    expect(skip.game.revived).toBe(false);
    expect(skip.game.watchingAd).toBe(false);

    expect(tapFail(skip.game, 'revive', true)).toBe(true);
    mockAd(skip).settle('error');
    expect(skip.game.phase).toBe('game-over');
    expect(skip.game.remaining).toBe(0);
    expect(skip.game.revived).toBe(false);
    expect(skip.game.watchingAd).toBe(false);
  });

  it('a second successful revive is refused; retry resets bookkeeping', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.revive.cap',
    });
    expire(harness);
    tapFail(harness.game, 'revive', true);
    mockAd(harness).settle('complete');
    expect(harness.game.revived).toBe(true);

    while (harness.game.phase === 'playing') harness.advance(0.5);
    expect(harness.game.phase).toBe('game-over');
    expect(harness.game.snapshot.reviveAvailable).toBe(false);
    expect(harness.game.requestRevive()).toBe(false);
    expect(failPanelLayout(false).buttons.some((b) => b.id === 'revive')).toBe(false);

    tapFail(harness.game, 'retry', false);
    expect(harness.game.phase).toBe('playing');
    expect(harness.game.revived).toBe(false);
    expect(harness.game.reviveBonusSec).toBe(0);
    expect(harness.game.remaining).toBe(300);
  });

  it('a tap outside the fail buttons does not retry; gear stays ignored', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.revive.scrim',
    });
    expire(harness);
    expect(harness.game.tapDesign(20, 20)).toBe(false);
    expect(harness.game.phase).toBe('game-over');
    expect(harness.game.tapDesign(60, 1274)).toBe(false);
    expect(harness.game.phase).toBe('game-over');
  });

  it('Noop show never adds time and leaves a 即将开放 hint', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.revive.noop',
      rewardedAd: new NoopRewardedAdProvider(),
    });
    expire(harness);
    expect(harness.game.requestRevive()).toBe(false);
    expect(harness.game.phase).toBe('game-over');
    expect(harness.game.remaining).toBe(0);
    expect(harness.game.revived).toBe(false);
    expect(harness.game.snapshot.failHint).toBe('即将开放');
  });

  it('sprint GAME_OVER has no revive and answers the settle panel buttons only', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      sprintTime: 90,
      saveKey: 'wxgame.beads.test.revive.sprint',
    });
    harness.game.startSprint();
    while (harness.game.phase === 'playing') harness.advance(1);
    expect(harness.game.phase).toBe('game-over');
    expect(harness.game.requestRevive()).toBe(false); // 冲刺无续时（§3.5）

    // WXG-T-067 起的契约：面板外**零响应**（此前任意点击都重开本局 ✗，与 §2.3/§3.5 冲突）。
    expect(harness.game.tapDesign(20, 20)).toBe(false);
    expect(harness.game.phase).toBe('game-over');

    const again = sprintSettleLayout().buttons.find((b) => b.id === 'again')!.rect;
    expect(
      harness.game.tapDesign((again.xMin + again.xMax) / 2, (again.yMin + again.yMax) / 2),
    ).toBe(true);
    expect(harness.game.phase).toBe('playing');
    expect(harness.game.mode).toBe('sprint');
  });

  it('a revived clear keeps its tier star (§3.7 v1.50：不封顶、也不再从 ratio 里扣奖励)', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.revive.stars',
    });
    expire(harness);
    tapFail(harness.game, 'revive', true);
    mockAd(harness).settle('complete');
    expect(harness.game.expandTray()).toBe(true);
    fillBoard(harness.game);
    expect(harness.game.phase).toBe('level-clear');
    const payload = harness.last<{ remaining: number; ratio: number; stars: number }>('level:cleared')!;
    // 旧断言：stars = 1 且 ratio = 0（`starRemaining = remaining − 180s` 把奖励扣掉 + 续时封顶 2★）。
    // §3.7 v1.50：星级 = 本局档位（首盘 = 1★），续时既不封顶也不从 ratio 里扣 ⇒ ratio > 0。
    expect(payload.stars).toBe(1);
    expect(payload.ratio).toBeGreaterThan(0);
    expect(payload.remaining).toBeGreaterThan(0);
    expect(harness.game.lastStars).toBe(1);
  });

  it('draws the fail overlay copy instead of the generic banner', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.revive.view',
    });
    expire(harness);
    const texts = render(harness)
      .filter((cmd): cmd is Extract<DrawCommand, { kind: 'text' }> => cmd.kind === 'text')
      .map((cmd) => cmd.text);
    expect(texts).toContain('时间到');
    expect(texts.some((t) => t.includes(`+${REVIVE_BONUS_SEC}秒`))).toBe(true);
    expect(texts).toContain('重试本关');
  });
});

describe('computeClearStars (§3.7 v1.50 选档即定星)', () => {
  it('星级 = 本局档位；续时不再封顶 2★（用户 2026-09-23 裁定取消）', () => {
    // 旧断言：同一条 `(200, 300, 60, true).stars === 2`（续时封顶）——已随双重计罚一并废除。
    // 本值仍归一 ratio（只供 C7 结算分），不再影响 stars。
    expect(computeClearStars(200, 300, 3)).toEqual({ ratio: 200 / 300, stars: 3 });
    expect(computeClearStars(3, 300, 1)).toEqual({ ratio: 0.01, stars: 1 });
    expect(computeClearStars(60, 300, 2).stars).toBe(2);
  });
});
