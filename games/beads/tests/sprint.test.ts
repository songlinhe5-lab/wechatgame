/**
 * S7 score-combo §8 criteria (gdd/score-combo.md §8, quoted verbatim in test
 * names). All 11 criteria live here; §8-9's visual half (DevTools frame check
 * for ≤3 Hz flicker / no positional shake) is documented, the mechanical half
 * (tier ↔ multiplier mapping) is asserted.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import {
  createBeadsHarness,
  simpleTestLevel,
  placeColor,
  placeAnyMatching,
  burnToRemaining,
} from './helpers.js';
import { normalSettleScore, stageParamsFor, STAGE_BONUS_TIME } from '../src/config/tuning.js';
import { pausePanelLayout } from '../src/systems/pause-panel.js';
import type { BeadsGame } from '../src/game/beads-game.js';

/** Continue is the only PAUSED exit (WXG-T-055 D-04: onResume stays paused). */
function tapContinue(game: BeadsGame, mode: 'normal' | 'sprint' = 'sprint'): void {
  const button = pausePanelLayout(mode).buttons.find((b) => b.id === 'resume');
  if (!button) throw new Error('sprint: no resume button');
  game.tapDesign(
    (button.rect.xMin + button.rect.xMax) / 2,
    (button.rect.yMin + button.rect.yMax) / 2,
  );
}

type Harness = ReturnType<typeof createBeadsHarness>;

/** The first `skip`-th fillable cell (skips `.` voids and filled cells). */
function nthFillable(game: BeadsGame, skip: number): { row: number; col: number } | null {
  let seen = 0;
  for (let row = 0; row < game.grid.rows; row++) {
    for (let col = 0; col < game.grid.cols; col++) {
      if (!game.grid.isFillable(row, col)) continue;
      if (seen++ === skip) return { row, col };
    }
  }
  return null;
}

/** Place `n` correct beads via the direct feed (no time passes). */
function fillN(harness: Harness, n: number): number {
  const game = harness.game;
  let placed = 0;
  let guard = 0;
  while (placed < n) {
    const cell = nthFillable(game, 0); // always the first EMPTY cell
    if (!cell) break;
    if (placeColor(game, game.grid.requiredColor(cell.row, cell.col), cell.row, cell.col)) {
      placed++;
    }
    if (++guard > 5000) throw new Error('fillN: ran away');
  }
  return placed;
}

/** Play the CURRENT stage to completion via the direct feed (no time passes). */
function fillStage(harness: Harness): void {
  const game = harness.game;
  const stageAtStart = game.stageIndex;
  let guard = 0;
  while (
    !game.grid.isComplete() &&
    game.phase === 'playing' &&
    game.stageIndex === stageAtStart // stop when the stage advances
  ) {
    const cell = nthFillable(game, 0);
    if (!cell) break;
    if (!placeColor(game, game.grid.requiredColor(cell.row, cell.col), cell.row, cell.col)) break;
    if (++guard > 5000) throw new Error('fillStage: ran away');
  }
}

/** Reproduce the scoring rule independently (mirrors score-combo §2.4). */
function expectedMultiplier(streak: number): number {
  if (streak >= 7) return 5;
  if (streak >= 4) return 3;
  if (streak >= 2) return 2;
  return 1;
}

describe('S7 score-combo', () => {
  afterEach(() => vi.restoreAllMocks());

  // §8.1 普通模式局内全程零分数 HUD 元素；过关后 level:cleared payload 的 stars 与
  // §3.7 阈值表逐一吻合（ratio=0.32/0.319/0.12/0.119 四点采样）。
  it('§8-1 normal mode has zero score HUD; stars match §3.7 thresholds at 4 sample ratios', () => {
    // Zero score HUD: render both modes and inspect text commands.
    const normal = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s7hud1',
    });
    const builder = new RenderModelBuilder(750, 1334);
    builder.begin();
    normal.game.buildRenderModel(builder);
    const normalTexts = builder
      .end()
      .commands.filter((c) => c.kind === 'text')
      .map((c) => (c as { text: string }).text);
    expect(normalTexts.some((t) => t.includes('SCORE'))).toBe(false);

    const sprint = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7hud2' });
    sprint.game.startSprint();
    const builder2 = new RenderModelBuilder(750, 1334);
    builder2.begin();
    sprint.game.buildRenderModel(builder2);
    const sprintTexts = builder2
      .end()
      .commands.filter((c) => c.kind === 'text')
      .map((c) => (c as { text: string }).text);
    expect(sprintTexts.some((t) => t.includes('SCORE'))).toBe(true);

    // Star threshold sampling: clear with remaining just above each boundary.
    const samples: { remaining: number; stars: number }[] = [
      { remaining: 96, stars: 3 }, // ratio = 0.32 → 3★
      { remaining: 95.7, stars: 2 }, // ratio = 0.319 → 2★
      { remaining: 36, stars: 2 }, // ratio = 0.12 → 2★
      { remaining: 35.7, stars: 1 }, // ratio = 0.119 → 1★
    ];
    for (const sample of samples) {
      const harness = createBeadsHarness({
        levels: [simpleTestLevel({ decoys: [] })],
        saveKey: `wxgame.beads.test.s7star${sample.remaining}`,
      });
      const game = harness.game;
      const total = game.grid.fillableTotal;
      // Fill all but the LAST fillable cell (direct feed, no time passes).
      while (game.grid.filledCount < total - 1) {
        const cell = nthFillable(game, 0)!;
        expect(
          placeColor(game, game.grid.requiredColor(cell.row, cell.col), cell.row, cell.col),
        ).toBe(true);
      }
      burnToRemaining(harness, sample.remaining + 0.017);
      expect(placeAnyMatching(game)).toBe(true);
      const payload = harness.last<{ ratio: number; stars: number }>('level:cleared')!;
      expect(payload.stars).toBe(sample.stars);
    }
  });

  // §8.2 普通模式结算分 = 附录 C7 公式逐项可复算（四因子组合各 1 例）。
  it('§8-2 normal settle score reproduces the C7 formula for 4 factor combinations', () => {
    expect(normalSettleScore(3, 0.4, 0, false)).toBe(3000 + 400 + 200); // 3600
    expect(normalSettleScore(2, 0.25, 2, true)).toBe(2000 + 250 - 100); // 2150
    expect(normalSettleScore(1, 0.1, 0, true)).toBe(1000 + 100); // 1100
    expect(normalSettleScore(3, 0.5, 1, false)).toBe(3000 + 500 - 50 + 200); // 3650
    // Rounding of the ratio term.
    expect(normalSettleScore(1, 0.1234, 0, true)).toBe(1000 + 123);
  });

  // §8.3 sprint 单局时长 = SPRINT_TIME_DEFAULT（未覆盖时），误差 ≤ ±0.5s。
  it('§8-3 sprint run lasts SPRINT_TIME_DEFAULT (120 s ± 0.5 s)', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7dur' });
    harness.game.startSprint();
    expect(harness.game.phase).toBe('playing');
    expect(harness.game.remaining).toBe(120);
    harness.advance(119.5);
    expect(harness.game.phase).toBe('playing'); // 119.5 s in — still alive
    harness.advance(1); // 120.5 s in — must have expired within ±0.5 s
    expect(harness.game.phase).toBe('game-over');
  });

  // §8.4 streak 达 C3 各阈值瞬间倍率切换为 ×2/×3/×5，combo:up 恰各 1 次；
  // 超过最高档 streak 继续增长但倍率封顶 ×5。
  it('§8-4 tiers [2,4,7] flip ×2/×3/×5 with exactly one combo:up each; cap ×5 above 7', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7tier' });
    const game = harness.game;
    game.startSprint();

    const ups: { streak: number; multiplier: number; tier: number }[] = [];
    harness.events.on('combo:up', (p) => ups.push(p as never));
    expect(fillN(harness, 9)).toBe(9);

    expect(ups).toHaveLength(3);
    expect(ups[0]).toEqual({ streak: 2, multiplier: 2, tier: 1 });
    expect(ups[1]).toEqual({ streak: 4, multiplier: 3, tier: 2 });
    expect(ups[2]).toEqual({ streak: 7, multiplier: 5, tier: 3 });
    // Above the top tier: streak keeps growing, multiplier pinned at ×5.
    expect(game.sprintTracker.streak).toBe(9);
    expect(game.sprintTracker.multiplier).toBe(5);
  });

  // §8.5 断连三分支各 1 例：放错（rejected 后 streak=0、combo:break{reason:'wrong'}）、
  // 窗口超时（> COMBO_WINDOW_S 无落子，reason='timeout'）、无第三分支误触发。
  it('§8-5 break branches: wrong on reject, timeout on window expiry, no third branch', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7brk' });
    const game = harness.game;
    game.startSprint();

    // Branch 1 — wrong: two correct, then a mismatch.
    const c0 = nthFillable(game, 0)!;
    const c1 = nthFillable(game, 1)!;
    const c2 = nthFillable(game, 2)!;
    expect(placeColor(game, game.grid.requiredColor(c0.row, c0.col), c0.row, c0.col)).toBe(true);
    expect(placeColor(game, game.grid.requiredColor(c1.row, c1.col), c1.row, c1.col)).toBe(true);
    expect(game.sprintTracker.streak).toBe(2);
    const required2 = game.grid.requiredColor(c2.row, c2.col);
    const wrongColor = required2 === 1 ? 2 : 1;
    expect(placeColor(game, wrongColor, c2.row, c2.col)).toBe(false);
    expect(harness.last<{ reason: string }>('combo:break')!.reason).toBe('wrong');
    expect(game.sprintTracker.streak).toBe(0);
    expect(game.sprintTracker.multiplier).toBe(1);

    // Branch 2 — timeout: one correct, then let the 5 s window lapse.
    const c3 = nthFillable(game, 0)!;
    expect(placeColor(game, game.grid.requiredColor(c3.row, c3.col), c3.row, c3.col)).toBe(true);
    expect(game.sprintTracker.streak).toBe(1);
    harness.advance(4.9); // inside the window
    expect(game.sprintTracker.streak).toBe(1);
    harness.advance(0.2); // window elapsed
    expect(harness.last<{ reason: string }>('combo:break')!.reason).toBe('timeout');
    expect(game.sprintTracker.streak).toBe(0);

    // No third branch: every break ever emitted is wrong|timeout.
    for (const payload of harness.all<{ reason: string }>('combo:break')) {
      expect(['wrong', 'timeout']).toContain(payload.reason);
    }
  });

  // §8.6 stage 填满 → sprint:stage{index+1} 恰 1 次、新图案 ≤1 帧装载、连击跨 stage 延续
  // （streak 值不变）。
  it('§8-6 stage fill → exactly one sprint:stage, ≤1-frame load, streak survives the switch', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7stage' });
    const game = harness.game;
    game.startSprint();
    // One stage banner at run start (stage 0 params injection).
    expect(harness.count('sprint:stage')).toBe(1);

    const stage0Cells = game.grid.fillableTotal; // L1 pool pattern → 22
    fillN(harness, stage0Cells - 2);
    expect(game.sprintTracker.streak).toBe(stage0Cells - 2);
    expect(harness.count('sprint:stage')).toBe(1);

    // Complete the stage (direct feed, no time passes → window never breaks).
    fillStage(harness);
    expect(game.grid.isComplete() || harness.count('sprint:stage') === 2).toBe(true);

    const stageEvents = harness.all<{ stageIndex: number; nextParams: object }>('sprint:stage');
    expect(stageEvents).toHaveLength(2);
    expect(stageEvents[1]!.stageIndex).toBe(1);
    expect(stageEvents[1]!.nextParams).toEqual(stageParamsFor(1));

    // The new pattern is already live in the SAME tick (≤1 frame).
    expect(game.stageIndex).toBe(1);
    // Streak carried across the switch untouched (C8).
    expect(game.sprintTracker.streak).toBe(stage0Cells);
    expect(game.sprintTracker.multiplier).toBe(5);
  });

  // §8.7 stage 完成加时后 remaining = 原值 + STAGE_BONUS_TIME（钳单局上限）；
  // 加时与归零同帧按 C8 裁决。
  it('§8-7 stage bonus adds +15 s clamped to the run cap; C8 same-frame expiry defers to stage', () => {
    // Clamp: burn to 110 → complete the stage → 125 clamps to 120.
    const clamped = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7cap' });
    clamped.game.startSprint();
    burnToRemaining(clamped, 110.02);
    expect(clamped.game.remaining).toBeLessThanOrEqual(110.02);
    fillStage(clamped);
    expect(clamped.game.remaining).toBe(120); // clamped to the run cap
    expect(clamped.game.phase).toBe('playing');

    // Exact arithmetic: 21 placed, burn to 20 s without placing, then the
    // final placement lands the +15 s at ≈35 (no clamp).
    const exact = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7exact' });
    exact.game.startSprint();
    fillN(exact, exact.game.grid.fillableTotal - 1);
    burnToRemaining(exact, 20.02);
    expect(exact.game.remaining).toBeGreaterThan(20);
    // One colour still needed + no decoys → every tray bead matches.
    expect(placeAnyMatching(exact.game)).toBe(true);
    expect(exact.game.remaining).toBeGreaterThanOrEqual(20 + STAGE_BONUS_TIME);
    expect(exact.game.remaining).toBeLessThanOrEqual(20 + STAGE_BONUS_TIME + 0.03);

    // C8: expiry and stage completion in the same frame → stage first.
    const sameFrame = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7c8' });
    sameFrame.game.startSprint();
    fillN(sameFrame, sameFrame.game.grid.fillableTotal - 1);
    burnToRemaining(sameFrame, 0.02); // ≈0 but positive, no failure yet
    expect(sameFrame.game.remaining).toBeGreaterThan(0);
    expect(placeAnyMatching(sameFrame.game)).toBe(true); // completes the stage
    // Bonus applied BEFORE the frame's timer judgement → still alive.
    expect(sameFrame.game.phase).toBe('playing');
    expect(sameFrame.game.remaining).toBeGreaterThan(STAGE_BONUS_TIME - 0.1);
    expect(sameFrame.count('level:failed')).toBe(0);
    expect(sameFrame.count('sprint:stage')).toBe(2);
  });

  // §8.8 sprint 单局得分 = Σ(SCORE_PER_BEAD×倍率) + Σ stage 奖励，注入 20 次落子序列
  // 逐分可复算。
  it('§8-8 a scripted 20-placement sequence reproduces the score step by step', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7seq' });
    const game = harness.game;
    game.startSprint();

    // Script: c = correct placement, w = deliberate mismatch.
    const script = 'ccwccccccccwcccccccc'.split('');
    expect(script).toHaveLength(20);
    let streak = 0;
    let expectedScore = 0;

    for (const step of script) {
      const cell = nthFillable(game, 0);
      expect(cell).not.toBeNull();
      const required = game.grid.requiredColor(cell!.row, cell!.col);
      if (step === 'c') {
        expect(placeColor(game, required, cell!.row, cell!.col)).toBe(true);
        streak += 1;
        expectedScore += 10 * expectedMultiplier(streak);
      } else {
        const wrong = required === 1 ? 2 : 1;
        expect(placeColor(game, wrong, cell!.row, cell!.col)).toBe(false);
        streak = 0;
      }
      // Step-by-step reproduction: after every placement the score matches.
      expect(game.sprintTracker.score).toBe(expectedScore);
    }
    // 18 correct < 22 cells → no stage completed → no bonus term.
    expect(harness.count('sprint:stage')).toBe(1);
  });

  // §8.9 特效档位与倍率档一一对应（×2 粒子/×3 伪震屏/×5 全屏爆发），全程无 >3Hz 闪烁、
  // 无真位移震屏（DevTools 帧检）。
  it('§8-9 tier payloads map 1:1 onto the ×2/×3/×5 effect levels', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7fx' });
    const game = harness.game;
    game.startSprint();
    fillN(harness, 7);
    const ups = harness.all<{ tier: number; multiplier: number }>('combo:up');
    // Lv1 ↔ ×2, Lv2 ↔ ×3, Lv3 ↔ ×5 — the exact effect-tier table (ux-spec §5).
    expect(ups).toHaveLength(3);
    expect(ups.map((u) => [u.tier, u.multiplier])).toEqual([
      [1, 2],
      [2, 3],
      [3, 5],
    ]);
    // The view applies no positional shake by construction: two identical
    // snapshots produce identical command counts (deterministic, offset-free).
    const b1 = new RenderModelBuilder(750, 1334);
    b1.begin();
    game.buildRenderModel(b1);
    const a = b1.end();
    const b2 = new RenderModelBuilder(750, 1334);
    b2.begin();
    game.buildRenderModel(b2);
    const b = b2.end();
    expect(a.commands.length).toBe(b.commands.length);
  });

  // §8.10 PAUSED 期间连击窗口计时冻结（恢复后窗口从暂停值续算）；普通/冲刺模式互窜注入
  // （sprint 中发 level:cleared）→ 防御忽略 + 警告。
  it('§8-10 PAUSED freezes the combo window; cross-mode level:cleared injection is ignored + warned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s7pause' });
    const game = harness.game;
    game.startSprint();

    // One correct placement → window = 5.0 s.
    const cell = nthFillable(game, 0)!;
    expect(placeColor(game, game.grid.requiredColor(cell.row, cell.col), cell.row, cell.col)).toBe(
      true,
    );
    harness.advance(4.0); // window ≈ 1.0 s left
    expect(game.sprintTracker.streak).toBe(1);

    game.onPause();
    harness.advance(300); // ages while paused — nothing may break
    expect(harness.count('combo:break')).toBe(0);
    tapContinue(game, 'sprint');
    // Window resumes from its paused value (≈1.0 s), NOT from a fresh 5 s.
    harness.advance(0.9);
    expect(harness.count('combo:break')).toBe(0);
    harness.advance(0.2); // past the resumed window → timeout break
    expect(harness.count('combo:break')).toBe(1);
    expect(harness.last<{ reason: string }>('combo:break')!.reason).toBe('timeout');

    // Cross-mode injection: level:cleared during sprint → ignored + warned.
    harness.events.emit('level:cleared', { levelId: 'l1', remaining: 1, ratio: 0.5, stars: 3 });
    expect(game.phase).toBe('playing'); // machine untouched
    expect(warn).toHaveBeenCalled();
  });

  // §8.11 破纪录：sprint 结算分 > S8 最佳 → NEW BEST 显示且 S8 写入新值；≤ 最佳 → 不写不显示。
  it('§8-11 beating the sprint best writes the save and flags NEW BEST; ≤ best does not', () => {
    // Run A: build a score, then expire.
    const storage = createBeadsHarness({ saveKey: 'wxgame.beads.test.s8rec' }).storage;
    const runA = createBeadsHarness({ saveKey: 'wxgame.beads.test.s8rec', storage });
    runA.game.startSprint();
    fillN(runA, 9);
    const scoreA = runA.game.sprintTracker.score;
    expect(scoreA).toBe(290); // 10+20+20+30+30+30+50+50+50 = 290
    runA.advance(121);
    expect(runA.game.phase).toBe('game-over');
    expect(runA.game.isNewBest).toBe(true);
    const endedA = runA.last<{ score: number; bestStage: number; settleScore: number }>(
      'sprint:ended',
    )!;
    expect(endedA.score).toBe(scoreA);
    expect(runA.game.sprintBestScore).toBe(scoreA);

    // Run B: a worse run on the same storage — no record write, no NEW BEST.
    const runB = createBeadsHarness({ saveKey: 'wxgame.beads.test.s8rec', storage });
    runB.game.startSprint();
    fillN(runB, 1);
    const scoreB = runB.game.sprintTracker.score;
    expect(scoreB).toBeLessThan(scoreA);
    runB.advance(121);
    expect(runB.game.isNewBest).toBe(false);
    expect(runB.game.sprintBestScore).toBe(scoreA); // unchanged

    // Run C: a better run — the save moves.
    const runC = createBeadsHarness({ saveKey: 'wxgame.beads.test.s8rec', storage });
    runC.game.startSprint();
    fillN(runC, 12);
    const scoreC = runC.game.sprintTracker.score;
    expect(scoreC).toBeGreaterThan(scoreA);
    runC.advance(121);
    expect(runC.game.isNewBest).toBe(true);
    expect(runC.game.sprintBestScore).toBe(scoreC);
  });
});
