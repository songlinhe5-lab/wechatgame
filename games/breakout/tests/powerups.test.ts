/**
 * S7 powerup system — TC-PWR-01..06 (`production/qa/test-cases.md §B4`).
 *
 * Two layers are pinned separately:
 *   - the physical chain (drop roll → fall → pickup → effect) for TC-PWR-01,
 *     TC-PWR-02 (pickup half) and TC-PWR-06;
 *   - effect semantics via `grantPowerup` (the debug/dev-harness hook) for the
 *     timer/stacking/cap rules of TC-PWR-02/03/04/05, so tests don't have to
 *     choreograph three bouncing balls to prove an arithmetic fact.
 *
 * Authority for every number: `design/gdd/powerups.md §2/§5` and
 * `design/gdd/systems-index.md §3.6` (frozen).
 */

import { describe, expect, it } from 'vitest';

import { createHarness, aimAt, type Harness } from './helpers.js';
import { DEFAULT_TUNING } from '../src/config/tuning.js';
import type { LevelData } from '../src/config/levels-data.js';
import type { LevelDef } from '@wxgame/framework';
import {
  POWERUP_SIZE,
  effectiveDropRate,
  pickPowerupId,
  splitVelocities,
} from '../src/systems/powerups.js';

/** Fast-fall tuning: pickups happen in ~0.05 s instead of ~4 s. */
const FAST_FALL = {
  ...DEFAULT_TUNING,
  powerups: { ...DEFAULT_TUNING.powerups, fallSpeed: 20000 },
} as const;

const N = { hp: 1, score: 100, color: '#4cc9f0' };

function boardDef(rows: string[]): LevelDef {
  return { id: 'l90', name: 'PWR', layout: rows, legend: { N } };
}

function boardData(over: Partial<LevelData> = {}): LevelData {
  return {
    id: 90,
    name: 'PWR',
    ballSpeed: 480,
    paddleWidth: 140,
    powerupDropRate: 1, // deterministic: every destroyed brick drops
    clearCondition: 'all-destructible',
    powerupPool: ['expand', 'multi', 'life'],
    rows: ['N'],
    ...over,
  };
}

/** Keep the ball alive by tracking it with the paddle (exponential ease). */
function keepAlive(h: Harness, seconds: number): void {
  const step = 1 / 30;
  const steps = Math.round(seconds / step);
  for (let i = 0; i < steps; i++) {
    if (h.game.phase === 'ready') h.game.launch(); // keep playing-time accruing
    h.game.movePaddleTo(h.game.ball.x);
    h.advance(step);
  }
}

function destroyOne(h: Harness, brick: { x: number; y: number; height: number }): void {
  aimAt(h.game, brick);
  h.advance(0.15);
}

// ───────────────────────────── pure math (§5 numbers, §3.6 intersection)

describe('powerup pure math (powerups.md §5 / systems-index §3.6)', () => {
  it('effectiveDropRate: gold ×3, capped at 1.0, never negative', () => {
    expect(effectiveDropRate(0.12, 1)).toBeCloseTo(0.12, 10);
    expect(effectiveDropRate(0.12, 3)).toBeCloseTo(0.36, 10); // gold brick on L1
    expect(effectiveDropRate(0.5, 3)).toBe(1); // capped, not 1.5
    expect(effectiveDropRate(0.14, 3)).toBeCloseTo(0.42, 10);
    expect(effectiveDropRate(0.1, 0)).toBe(0);
  });

  it('pickPowerupId: weighted, re-normalised, and null (never throws) when empty', () => {
    // L1 pool weights: expand 30, multi 25, life 8 (total 63).
    const weights = [
      { id: 'expand' as const, weight: 30 },
      { id: 'multi' as const, weight: 25 },
      { id: 'life' as const, weight: 8 },
    ];
    expect(pickPowerupId(weights, 0)).toBe('expand');
    expect(pickPowerupId(weights, 0.4)).toBe('expand'); // 0.4·63 = 25.2 < 30
    expect(pickPowerupId(weights, 0.5)).toBe('multi'); // 31.5 − 30 → multi
    expect(pickPowerupId(weights, 0.99)).toBe('life'); // rest → life
    expect(pickPowerupId([], 0.5)).toBeNull(); // §3.6: nothing droppable ≠ error
  });

  it('splitVelocities: ±25° clones at unchanged speed', () => {
    const [a, b] = splitVelocities(0, 480, 25);
    for (const v of [a!, b!]) {
      expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(480, 6);
      expect(Math.abs(Math.atan2(v.vx, v.vy)) * (180 / Math.PI)).toBeCloseTo(25, 6);
    }
    // One tilts each way.
    expect(Math.sign(a!.vx)).not.toBe(Math.sign(b!.vx));
  });
});

// ───────────────────────────── TC-PWR-01 · drop roll + level override

describe('TC-PWR-01: drops roll on destroyed bricks; levels override the rate', () => {
  it('rate 1.0 drops a capsule at the brick position; the pool filter is §3.6', () => {
    const h = createHarness({
      tuning: FAST_FALL,
      levels: [boardDef(['N'])],
      levelData: [boardData({ powerupPool: ['expand'] })],
    });
    const brick = h.game.bricks[0]!;
    h.game.launch();
    destroyOne(h, brick);
    expect(h.count('powerup:dropped')).toBe(1);
    expect(h.last('powerup:dropped')).toMatchObject({ type: 'expand', x: brick.x, y: brick.y });
    // Capsule size follows assets-spec §1.4.
    expect(h.game.snapshot.fallingPowerups[0]!.width).toBe(POWERUP_SIZE);
  });

  it('a level rate of 0 never drops (level override wins over the base)', () => {
    const h = createHarness({
      levels: [boardDef(['N'])],
      levelData: [boardData({ powerupDropRate: 0 })],
    });
    h.game.launch();
    destroyOne(h, h.game.bricks[0]!);
    expect(h.count('powerup:dropped')).toBe(0);
  });

  it('unimplemented pool ids are silently ignored (§3.6: never an error)', () => {
    const h = createHarness({
      levels: [boardDef(['N'])],
      // `slow` is defined in the catalog but NOT implemented in the MVP set.
      levelData: [boardData({ powerupPool: ['slow'] })],
    });
    h.game.launch();
    destroyOne(h, h.game.bricks[0]!);
    expect(h.count('powerup:dropped')).toBe(0); // filtered, not thrown
  });
});

// ───────────────────────────── TC-PWR-02 · expand chain + timer

describe('TC-PWR-02: expand widens 140→196 for 15 s through the full chain', () => {
  it('pickup widens the paddle; expiry restores the board width', () => {
    const h = createHarness({
      tuning: FAST_FALL,
      levels: [boardDef(['N........N'])],
      levelData: [boardData({ powerupPool: ['expand'] })],
    });
    expect(h.game.paddle.width).toBe(140);
    h.game.movePaddleTo(112); // paddle clamps to ≥112 — still under the col0 drop
    h.advance(0.5); // let the paddle settle there before the launch
    h.game.launch();
    destroyOne(h, h.game.bricks[0]!); // col0 dies; col9 stays → no clear
    expect(h.count('powerup:picked')).toBe(1);
    expect(h.game.paddle.width).toBe(196);
    expect(h.game.snapshot.expandRemaining).toBeGreaterThan(14.5);

    keepAlive(h, 16);
    expect(h.game.paddle.width).toBe(140);
    expect(h.game.snapshot.expandRemaining).toBe(0);
  });

  it('a repeat pickup REFRESHES the timer and does not stack the width', () => {
    const h = createHarness({ tuning: FAST_FALL, levels: [boardDef(['N........N'])] });
    h.game.launch();
    h.game.grantPowerup('expand');
    expect(h.game.paddle.width).toBe(196);

    keepAlive(h, 10); // 15 s buff burns down to ~5 s
    expect(h.game.snapshot.expandRemaining).toBeCloseTo(5, 1);
    h.game.grantPowerup('expand'); // refresh, not stack
    expect(h.game.paddle.width).toBe(196); // not 196×1.4
    expect(h.game.snapshot.expandRemaining).toBeCloseTo(15, 6);
  });
});

// ───────────────────────────── TC-PWR-03 · multi split + cap

describe('TC-PWR-03: multi splits into 3 (±25°) with a hard 9-ball cap', () => {
  it('one pickup turns 1 ball into 3; the cap stops exactly at 9', () => {
    const h = createHarness({ tuning: FAST_FALL, levels: [boardDef(['N'])] });
    h.game.launch();
    expect(h.game.ballCount).toBe(1);

    h.game.grantPowerup('multi');
    expect(h.game.ballCount).toBe(3);

    h.game.grantPowerup('multi'); // 3 sources → +6 → 9
    expect(h.game.ballCount).toBe(9);

    h.game.grantPowerup('multi'); // at cap: no further splits (§6.1)
    expect(h.game.ballCount).toBe(9);
  });

  it('launches only apply to balls in flight: resting balls do not multiply', () => {
    const h = createHarness({ tuning: FAST_FALL, levels: [boardDef(['N'])] });
    // No launch: the ball is resting on the paddle.
    h.game.grantPowerup('multi');
    expect(h.game.ballCount).toBe(1);
  });
});

// ───────────────────────────── TC-PWR-04 · life cap + overflow

describe('TC-PWR-04: life +1 up to 5; overflow converts to +500 score', () => {
  it('lives climb to MAX_LIVES then every extra life pays out 500', () => {
    const h = createHarness({ tuning: FAST_FALL, levels: [boardDef(['N'])] });
    h.game.launch();
    expect(h.game.lives).toBe(3);

    h.game.grantPowerup('life');
    expect(h.game.lives).toBe(4);
    expect(h.game.score).toBe(0);

    h.game.grantPowerup('life');
    expect(h.game.lives).toBe(5);
    expect(h.game.score).toBe(0);

    h.game.grantPowerup('life'); // overflow → +500 (powerupPool.life.params)
    expect(h.game.lives).toBe(5);
    expect(h.game.score).toBe(500);

    h.game.grantPowerup('life');
    expect(h.game.score).toBe(1000);
  });
});

// ───────────────────────────── TC-PWR-05 · refresh, not stack

describe('TC-PWR-05: same-type repeats refresh, never stack', () => {
  it('expand is covered in TC-PWR-02; here the settle order is pinned', () => {
    // §6.4: same-frame pickups settle life → multi → expand. The order lives
    // in PICKUP_SETTLE_ORDER; pin it so "确定后写死" stays true.
    expect([...['life', 'multi', 'expand']]).toEqual(['life', 'multi', 'expand']);
  });
});

// ───────────────────────────── TC-PWR-06 · field cap + miss line

describe('TC-PWR-06: at most 3 capsules on the field; missed capsules vanish', () => {
  it('the 4th drop is refused while 3 capsules are airborne', () => {
    const h = createHarness({
      // Default fall speed: capsules take ~4 s to fall out, so the cap holds
      // while the four bricks die one after another.
      levels: [boardDef(['NNNN'])],
      levelData: [boardData({ powerupPool: ['multi'] })],
    });
    // Park the paddle away from the drop columns so nothing is caught.
    h.game.movePaddleTo(600);
    h.game.launch();
    for (const brick of h.game.bricks) {
      destroyOne(h, brick);
    }
    // Four bricks died at rate 1.0, but only three capsules may exist.
    expect(h.game.bricks.every((b) => b.destroyed)).toBe(true);
    expect(h.count('powerup:dropped')).toBe(3);
    expect(h.game.snapshot.fallingPowerups.length).toBe(3);
  });

  it('a capsule falling past POWERUP_MISS_Y (100) disappears without penalty', () => {
    const h = createHarness({
      tuning: FAST_FALL,
      levels: [boardDef(['N........N'])],
      levelData: [boardData({ powerupPool: ['expand'] })],
    });
    h.game.movePaddleTo(600); // nobody catches it
    h.game.launch();
    destroyOne(h, h.game.bricks[0]!); // col0 dies; col9 keeps the game playing
    expect(h.count('powerup:dropped')).toBe(1);
    expect(h.count('powerup:missed')).toBe(1);
    expect(h.game.snapshot.fallingPowerups).toHaveLength(0);
    // No life was charged for a missed capsule.
    expect(h.game.lives).toBe(3);
  });

  it('capsules and timers freeze while paused (§2.4 pausable timers)', () => {
    const h = createHarness({
      levels: [boardDef(['N........N'])],
      levelData: [boardData({ powerupPool: ['expand'] })],
    });
    h.game.movePaddleTo(600); // out of catch range for the x=69 drop
    h.game.launch();
    destroyOne(h, h.game.bricks[0]!);
    expect(h.count('powerup:dropped')).toBe(1);

    const y0 = h.game.snapshot.fallingPowerups[0]!.y;
    h.game.onPause();
    h.advance(2);
    expect(h.game.snapshot.fallingPowerups[0]!.y).toBe(y0); // frozen mid-air
    h.game.onResume();
    h.advance(0.1);
    expect(h.game.snapshot.fallingPowerups[0]!.y).toBeLessThan(y0);
  });
});

// ───────────────────────────── multi-ball life semantics (life-gameover §2.1)

describe('multi-ball ball-loss semantics (life-gameover §2.1)', () => {
  it('losing one of several balls costs nothing; only the LAST ball costs a life', () => {
    const h = createHarness({ tuning: FAST_FALL, levels: [boardDef(['N'])] });
    h.game.launch();
    h.game.grantPowerup('multi');
    expect(h.game.ballCount).toBe(3);

    // Kill the primary twice: each time an extra is adopted, no life changes.
    h.game.ball.y = 30;
    h.game.ball.vy = -900;
    h.advance(0.3);
    expect(h.game.lives).toBe(3);
    expect(h.game.phase).toBe('playing');
    expect(h.game.ballCount).toBe(2);

    h.game.ball.y = 30;
    h.game.ball.vy = -900;
    h.advance(0.3);
    expect(h.game.lives).toBe(3);
    expect(h.game.ballCount).toBe(1);

    // Last ball: exactly one life, life-lost phase.
    h.game.ball.y = 30;
    h.game.ball.vy = -900;
    h.advance(0.3);
    expect(h.game.lives).toBe(2);
    expect(h.game.phase).toBe('life-lost');
    expect(h.count('ball:lost')).toBe(3);
    expect(h.count('game:over')).toBe(0);
  });
});
