/**
 * G4 regression — the 13 P0 "load-bearing wall" criteria.
 *
 * Source of truth for the case list: `production/qa/test-cases.md` §C1
 * (WXG-T-012). Every test is labelled with its QA case id and cites the GDD
 * section that freezes the expectation. The numbers below are **not** invented:
 * 4624 = 68² (EXPLODE_R), 6224 = 68² + 40² (diagonal), COMBO_STEP=3,
 * COMBO_MULT_MAX=5, START_LIVES=3 — all mirror `design/gdd/systems-index.md §3`.
 *
 * House rule for this file: it may **expose** implementation defects but never
 * patch around them. A failing test here is a bug report, not a refactor hint.
 */

import { describe, expect, it } from 'vitest';

import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { aimAt, createHarness } from './helpers.js';
import {
  blastReach,
  createExplosionResult,
  resolveExplosion,
  squaredDistance,
  withinBlast,
  type ExplodableBrick,
} from '../src/systems/explosion.js';
import { multiplierFor, Scorer } from '../src/systems/scoring.js';
import { COMBO_MULT_MAX, COMBO_STEP, DEFAULT_TUNING as T } from '../src/config/tuning.js';
import { SAVE_KEY } from '../src/game/save-schema.js';
import type { LevelDef } from '@wxgame/framework';

// ────────────────────────────────────────────────────── shared fixtures

const PITCH_X = T.grid.cellWidth; // 68 = BRICK_W 62 + gap 6
const PITCH_Y = T.grid.cellHeight; // 40 = BRICK_H 34 + gap 6

/** One steel brick next to one normal brick — the steel-semantics board. */
const STEEL_LEVEL: LevelDef = {
  id: 'qa-steel',
  name: 'Steel',
  layout: ['NS'],
  legend: {
    N: { hp: 1, score: 100, color: '#4cc9f0' },
    S: { hp: Infinity, score: 0, color: '#8d99ae', indestructible: true },
  },
};

/** Fresh mock brick for the explosion unit tests. */
function brick(x: number, y: number, hp = 1, opts: Partial<ExplodableBrick> = {}): ExplodableBrick {
  return {
    x,
    y,
    width: 62,
    height: 34,
    score: 100,
    color: '#fff',
    damage: 1,
    indestructible: false,
    destroyed: false,
    hp,
    type: 'N',
    ...opts,
  };
}

// ───────────────────────────────────────────── A1..A3 · bomb blast boundary

describe('G4 · bomb blast boundary (EXPLODE_R = 68, bricks.md §2.6 B)', () => {
  it('TC-BOMB-01: d² = 4624 on the boundary IS hit (integer <=, not <)', () => {
    // Horizontal neighbour sits exactly one column pitch away: 68 px.
    expect(PITCH_X).toBe(68);
    const d2 = squaredDistance(0, 0, PITCH_X, 0);
    expect(d2).toBe(4624);
    expect(d2).toBe(68 * 68);
    // `<=` is load-bearing: the boundary case decides cross vs. T shape.
    expect(withinBlast(0, 0, PITCH_X, 0, 68)).toBe(true);
    // And the resolver agrees: the neighbour is destroyed by the blast.
    const seed = brick(0, 0, 1, { type: 'B' });
    seed.destroyed = true; // shattered by the ball before the blast resolves
    const neighbour = brick(PITCH_X, 0, 1);
    const result = resolveExplosion(seed, [seed, neighbour], { radius: 68, damage: 1, maxChain: 1 }, createExplosionResult());
    expect(result.destroyed).toContain(neighbour);
  });

  it('TC-BOMB-02: diagonal d² = 6224 is NOT hit (visual and damage agree)', () => {
    const d2 = squaredDistance(0, 0, PITCH_X, PITCH_Y);
    expect(d2).toBe(6224);
    expect(d2).toBeGreaterThan(68 * 68);
    expect(withinBlast(0, 0, PITCH_X, PITCH_Y, 68)).toBe(false);
    const seed = brick(0, 0, 1, { type: 'B' });
    seed.destroyed = true;
    const diagonal = brick(PITCH_X, PITCH_Y, 1);
    const result = resolveExplosion(seed, [seed, diagonal], { radius: 68, damage: 1, maxChain: 1 }, createExplosionResult());
    expect(result.destroyed).not.toContain(diagonal);
    expect(diagonal.destroyed).toBe(false);
    expect(diagonal.hp).toBe(1);
  });

  it('TC-BOMB-04: net result is a 5-brick cross (seed + 2 horizontal + 2 vertical)', () => {
    const seed = brick(0, 0, 1, { type: 'B' });
    seed.destroyed = true; // ball kill — the blast must not re-damage it
    const left = brick(-PITCH_X, 0);
    const right = brick(PITCH_X, 0);
    const up = brick(0, PITCH_Y);
    const down = brick(0, -PITCH_Y);
    const diagonal = brick(PITCH_X, PITCH_Y, 2); // must survive, 6224 > 4624
    const steel = brick(2 * PITCH_X, 0, 1, { type: 'S', indestructible: true }); // immune
    const all = [seed, left, right, up, down, diagonal, steel];

    // Independent probe first — it must agree with the resolver BEFORE the
    // cascade mutates the neighbours' destroyed flags.
    expect(blastReach(seed, all, 68)).toHaveLength(4);

    const result = resolveExplosion(seed, all, { radius: 68, damage: 1, maxChain: 1 }, createExplosionResult());

    // Blast destroyed exactly the four orthogonal neighbours (seed already gone).
    expect(result.destroyed).toHaveLength(4);
    for (const b of [left, right, up, down]) {
      expect(b.destroyed).toBe(true);
      expect(result.destroyed).toContain(b);
    }
    // Survivors intact.
    expect(diagonal.destroyed).toBe(false);
    expect(diagonal.hp).toBe(2);
    expect(steel.destroyed).toBe(false);
    expect(steel.hp).toBe(1);
    // The seed was never re-damaged by its own blast.
    expect(result.damaged).not.toContain(seed);
  });
});

// ──────────────────────────────────────────────────── A2 · steel semantics

describe('G4 · steel brick semantics (bricks.md §2.6 S)', () => {
  it('TC-STEEL-02: steel only signals a hit — never damaged, never destroyed', () => {
    const h = createHarness({ levels: [STEEL_LEVEL] });
    const steel = h.game.bricks.find((b) => b.indestructible)!;
    const steelHpBefore = steel.hp;
    h.game.launch();
    aimAt(h.game, steel);
    h.advance(0.3);

    // The ball struck the steel brick…
    expect(h.count('steel:hit')).toBeGreaterThanOrEqual(1);
    // …but steel never enters the damage/destroy pipelines.
    expect(h.count('brick:damaged')).toBe(0);
    expect(h.count('brick:destroyed')).toBe(0);
    expect(steel.destroyed).toBe(false);
    expect(steel.hp).toBe(steelHpBefore); // hp untouched (data may model it as ∞)
    expect(h.game.score).toBe(0); // steel scores nothing
    // And the ball bounced away rather than passing through.
    expect(h.game.ball.vy).toBeLessThan(0);
  });

  it('TC-STEEL-03: clearing every destructible brick clears the level while steel still stands', () => {
    const h = createHarness({ levels: [STEEL_LEVEL] });
    // Only the N counts toward the clear condition.
    expect(h.game.remainingBricks).toBe(1);
    expect(h.game.totalBricks).toBe(1);
    const steel = h.game.bricks.find((b) => b.indestructible)!;
    const normal = h.game.bricks.find((b) => !b.indestructible)!;

    h.game.launch();
    aimAt(h.game, normal);
    h.advance(0.3);

    expect(normal.destroyed).toBe(true);
    expect(steel.destroyed).toBe(false);
    expect(h.game.phase).toBe('level-clear'); // steel did not block the clear
  });
});

// ─────────────────────────────────────────────────── A5 · save degradation

describe('G4 · save degradation (save-progress.md §6.3/§6.8)', () => {
  it('TC-SAVE-03: out-of-range currentLevel degrades to level 1 and is written back', () => {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const storage = platform.createStorage();
    storage.set(
      SAVE_KEY,
      JSON.stringify({ version: 1, currentLevel: 99, maxUnlockedLevel: 99, stats: { runs: 3 } }),
    );

    const h = createHarness({ storage, saveKey: SAVE_KEY });

    // No crash, boot lands on board 1 (runs > 0, so it resumes `currentLevel` → 1).
    expect(h.game.levelIndex).toBe(0);
    expect(h.game.phase).toBe('ready');
    // The repair was written back (§6.8: repair exactly once, not every launch).
    const written = JSON.parse(storage.get(SAVE_KEY)!);
    expect(written.currentLevel).toBe(1);
    expect(written.maxUnlockedLevel).toBe(1);
  });

  it('TC-SAVE-01: a future version document resets to a fresh save', () => {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const storage = platform.createStorage();
    storage.set(
      SAVE_KEY,
      JSON.stringify({
        version: 2,
        currentLevel: 3,
        maxUnlockedLevel: 3,
        bestScore: 1234,
        stats: { runs: 5 },
      }),
    );

    const h = createHarness({ storage, saveKey: SAVE_KEY });

    expect(h.game.save!.version).toBe(1);
    expect(h.game.save!.currentLevel).toBe(1);
    expect(h.game.save!.maxUnlockedLevel).toBe(1);
    expect(h.game.save!.bestScore).toBe(0);
    expect(h.game.levelIndex).toBe(0);
    // Fresh document persisted so the reset is durable.
    const written = JSON.parse(storage.get(SAVE_KEY)!);
    expect(written.version).toBe(1);
    expect(written.bestScore).toBe(0);
  });
});

// ──────────────────────────────────────────────────── A6 · combo & lives

describe('G4 · combo ladder & game over (score-combo §2.2 / life-gameover §8)', () => {
  it('TC-COMBO-01: multiplier = min(5, 1 + floor(combo / 3)) exactly', () => {
    expect(COMBO_STEP).toBe(3);
    expect(COMBO_MULT_MAX).toBe(5);
    for (const combo of [0, 1, 2, 3, 4, 5, 6, 9, 12, 13, 15, 99]) {
      expect(multiplierFor(combo, T)).toBe(Math.min(5, 1 + Math.floor(combo / 3)));
    }
    // Spot-check the ladder itself: ×1, ×1, ×1, ×2 … cap ×5.
    expect(multiplierFor(2, T)).toBe(1);
    expect(multiplierFor(3, T)).toBe(2);
    expect(multiplierFor(6, T)).toBe(3);
    expect(multiplierFor(9, T)).toBe(4);
    expect(multiplierFor(12, T)).toBe(5);
    expect(multiplierFor(15, T)).toBe(5);
  });

  it('TC-COMBO-01b: the scorer follows the ladder and a paddle touch breaks the chain', () => {
    const scorer = new Scorer(T);
    // Three quick destroys: 10 ×1, 10 ×1, 10 ×2 (combo 3 crosses the step).
    expect(scorer.onBrickDestroyed(10)).toBe(10);
    expect(scorer.onBrickDestroyed(10)).toBe(10);
    expect(scorer.onBrickDestroyed(10)).toBe(20);
    expect(scorer.score).toBe(40);
    expect(scorer.multiplier).toBe(2);

    scorer.onPaddleHit();
    expect(scorer.combo).toBe(0);
    expect(scorer.multiplier).toBe(1);
  });

  it('TC-LIFE-03: exactly three lost balls trigger game-over — not sooner, not later', () => {
    const h = createHarness();
    const loseOne = () => {
      h.game.launch();
      h.game.ball.x = 100;
      h.game.ball.y = 30;
      h.game.ball.vx = 0;
      h.game.ball.vy = -900;
      h.advance(0.3);
    };

    loseOne();
    expect(h.game.phase).toBe('life-lost');
    expect(h.game.lives).toBe(2);
    h.advance(1.2); // banner expires → back to ready

    loseOne();
    expect(h.game.phase).toBe('life-lost');
    expect(h.game.lives).toBe(1);
    h.advance(1.2);

    loseOne();
    expect(h.game.lives).toBe(0);
    expect(h.game.phase).toBe('game-over');
    // Exactly one game-over emission — no double-fire on repeated updates.
    expect(h.count('ball:lost')).toBe(3);
    expect(h.count('game:over')).toBe(1);
    h.advance(1);
    expect(h.count('game:over')).toBe(1);
  });
});

// ─────────────────────────────────────────────── A8 · pause timer correctness

describe('G4 · pause freezes gameplay (pause-settings.md §2.1/§8)', () => {
  it('TC-PAUSE-01: ball, score and event stream are fully frozen while paused', () => {
    const h = createHarness();
    h.game.launch();
    h.advance(0.5);

    const x = h.game.ball.x;
    const y = h.game.ball.y;
    const score = h.game.score;
    const wallHits = h.count('wall:hit');

    h.game.onPause();
    expect(h.game.phase).toBe('paused');
    h.advance(2);
    // Nothing moved: identical coordinates, no new events, no score drift.
    expect(h.game.ball.x).toBe(x);
    expect(h.game.ball.y).toBe(y);
    expect(h.game.score).toBe(score);
    expect(h.count('wall:hit')).toBe(wallHits);
    expect(h.count('brick:destroyed')).toBe(0);

    // And play resumes from the exact frozen spot.
    h.game.onResume();
    expect(h.game.phase).toBe('playing');
    h.advance(0.2);
    expect(h.game.ball.y).not.toBe(y);
  });
});

describe('G4 · pause/resume preserves phase timers (pause-settings.md §6.2)', () => {
  it('TC-PAUSE-03: resuming a banner phase continues its countdown instead of restarting', () => {
    const h = createHarness();
    h.game.launch();
    h.game.ball.x = 100;
    h.game.ball.y = 30;
    h.game.ball.vx = 0;
    h.game.ball.vy = -900;
    h.advance(0.3); // ball lost → life-lost
    h.advance(0.4); // burn 0.4 s of the 1.0 s banner

    expect(h.game.phase).toBe('life-lost');
    const t0 = h.game.snapshot.phaseElapsed;
    expect(t0).toBeGreaterThan(0.3); // sanity: we really are mid-banner

    h.game.onPause();
    h.advance(5); // even time inside pause must not age the banner
    h.game.onResume();

    expect(h.game.phase).toBe('life-lost');
    // The stashed timer comes back exactly — this is the Q8 regression guard.
    expect(h.game.snapshot.phaseElapsed).toBeCloseTo(t0, 10);
    // Remaining time + one step clears it; a RESTARTED timer would still show
    // the banner at this point (it would need a full 1.0 s more).
    h.advance(1.05 - t0 + 0.05);
    expect(h.game.phase).toBe('ready');
  });

  it('TC-PAUSE-03b: READY waits for a tap — no auto-launch timer exists in the implementation', () => {
    // Divergence record: pause-settings §2.1/§6.2 references a READY auto-launch
    // countdown, but the shipped READY phase is tap-to-launch with no timer
    // (ux-spec §6.3 flow). This test pins the *implemented* semantics so any
    // future auto-launch work fails loudly here and updates the GDD first.
    const h = createHarness();
    h.advance(10);
    expect(h.game.phase).toBe('ready');
    expect(h.game.snapshot.awaitingLaunch).toBe(true);
    expect(h.count('ball:launched')).toBe(0);
  });
});

// ───────────────────────────────────────────── A7 · reduce-motion (a11y)

/**
 * The two A11Y criteria from `test-cases.md §A7`. Skipped as placeholders in
 * WXG-T-012 because `reduceMotion` did not exist; shipped in WXG-T-013
 * (`src/systems/motion.ts` + `settings.reduceMotion`), so both are now live.
 */
describe('G4 · reduce-motion switch (assets-spec.md §6.1/§6.2)', () => {
  /** Harness whose save document has `reduceMotion: true` preloaded. */
  function reducedHarness(levels: readonly LevelDef[]) {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const storage = platform.createStorage();
    storage.set(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        currentLevel: 1,
        maxUnlockedLevel: 1,
        settings: { reduceMotion: true },
        stats: { runs: 1 },
      }),
    );
    return createHarness({ storage, saveKey: SAVE_KEY, levels });
  }

  it('TC-A11Y-01: with reduce-motion on, the 9 shutdown-list effects never play', () => {
    const h = reducedHarness([
      {
        id: 'qa-a11y',
        name: 'A11Y',
        layout: ['NB'],
        legend: {
          N: { hp: 1, score: 100, color: '#4cc9f0' },
          B: { hp: 1, score: 150, color: '#ff6b3d' },
        },
      },
    ]);
    const m = h.game.snapshot.motion;
    expect(h.game.reduceMotion).toBe(true);

    // §6.1 — all nine items verified against the live effect table.
    expect(m.shakeAmplitudePx).toBe(0); // 1. screen shake
    expect(m.brickBurstParticles).toBe(0); // 2. brick-burst particles
    expect(m.steelSparkParticles).toBe(0); // 3. steel spark
    expect(m.confettiParticles).toBe(0); // 4. level-clear confetti
    expect(m.ballTrailLayers).toBe(0); // 5. ball trail
    expect(m.bombShockwave).toBe(false); // 6. bomb shockwave ring
    expect(m.panelScale).toBe(false); // 7. panel scale (pure fade instead)
    expect(m.ambientPulse).toBe(false); // 8. breathing/pulse loops
    expect(m.comboPulse).toBe(false); // 9. combo-multiplier pulse

    // Live proof on the loudest source: the bomb blast produces zero shake.
    h.game.launch();
    const bomb = h.game.bricks.find((b) => b.type === 'B')!;
    aimAt(h.game, bomb);
    h.advance(0.3);
    expect(h.game.snapshot.shakeAmplitude).toBe(0);
    expect(h.game.snapshot.ballTrail).toHaveLength(0);
  });

  it('TC-A11Y-02: with reduce-motion on, the 7 keep-list effects still play', () => {
    const h = reducedHarness([
      {
        id: 'qa-a11y',
        name: 'A11Y',
        layout: ['NT'],
        legend: {
          N: { hp: 1, score: 100, color: '#4cc9f0' },
          T: { hp: 2, score: 250, color: '#a96bff' },
        },
      },
    ]);
    const m = h.game.snapshot.motion;
    expect(h.game.reduceMotion).toBe(true);

    // §6.2 — all seven items stay on with the switch on.
    expect(m.hitFlash).toBe(true);
    expect(m.brickFadeOut).toBe(true);
    expect(m.scorePopup).toBe(true);
    expect(m.damagedState).toBe(true);
    expect(m.hudStatusUpdates).toBe(true);
    expect(m.uiFade).toBe(true);
    expect(m.ballMotion).toBe(true);

    // Live proof: hit feedback and damaged-state readability survive.
    h.game.launch();
    const tough = h.game.bricks.find((b) => b.type === 'T')!;
    aimAt(h.game, tough);
    h.advance(0.3);
    expect(tough.destroyed).toBe(false); // T takes 2 hits…
    expect(tough.hp).toBe(1); // …so this hit leaves a damaged state
    expect(h.count('brick:damaged')).toBeGreaterThanOrEqual(1);
    expect(h.game.ball.launched).toBe(true); // ball motion unchanged
  });
});
