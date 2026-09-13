/**
 * Powerup math — the pure, testable half of S7 (`design/gdd/powerups.md`).
 *
 * The stateful half (spawning, falling, pickup, effects, timers) lives in
 * `BreakoutGame`; everything numeric or probabilistic lives here so QA criteria
 * TC-PWR-01..06 can be pinned without driving the whole game.
 *
 * MVP set (frozen): `IMPLEMENTED_POWERUPS = ['expand','multi','life']`
 * (`systems-index §3.6`). `slow`/`sticky`/`laser` stay data-only: they are
 * silently filtered out of a level's pool and never spawn.
 */

import type { Rng } from '../../framework/index.js';
import type { PowerupId } from '../config/levels-data.js';

/** A powerup capsule falling toward the paddle (64×64 per assets-spec §1.4). */
export interface FallingPowerup {
  readonly id: PowerupId;
  /** Centre x/y in design space (y decreases as it falls). */
  x: number;
  y: number;
  readonly width: number;
  readonly height: number;
}

/** Icon size in design px (art/assets-spec.md §1.4). */
export const POWERUP_SIZE = 64;

/**
 * Effective drop chance for one destroyed brick.
 * Gold bricks carry `dropRateMultiplier` (×3), and the result is capped at 1.0
 * so a level with a high base rate cannot make the roll vacuous.
 */
export function effectiveDropRate(baseRate: number, dropRateMultiplier = 1): number {
  return Math.min(1, Math.max(0, baseRate * dropRateMultiplier));
}

/**
 * Weighted pick from `weights` (already re-normalised by `powerupWeights`).
 * `roll` must be in [0, 1). Returns `null` for an empty candidate set — that is
 * the "nothing droppable" case, not an error (§3.6: never throw).
 */
export function pickPowerupId(
  weights: readonly { id: PowerupId; weight: number }[],
  roll: number,
): PowerupId | null {
  let total = 0;
  for (const w of weights) total += w.weight;
  if (total <= 0) return null;
  let threshold = roll * total;
  for (const w of weights) {
    threshold -= w.weight;
    if (threshold < 0) return w.id;
  }
  return weights[weights.length - 1]!.id; // float safety
}

/** Convenience: roll a drop using the game RNG. */
export function rollDrop(rng: Rng, rate: number): boolean {
  return rng.next() < rate;
}

/**
 * Velocities for a multi-ball split: the source ball keeps its velocity, and
 * two clones are produced at ±`angleDeg` around it (powerups.md §2.2 multi:
 * "每颗在场球分裂为 3 颗（方向 ±25°）").
 *
 * @returns the two clone velocities in degrees-rotated form, same speed.
 */
export function splitVelocities(
  vx: number,
  vy: number,
  angleDeg: number,
): { vx: number; vy: number }[] {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    { vx: vx * cos - vy * sin, vy: vx * sin + vy * cos }, // +angle
    { vx: vx * cos + vy * sin, vy: -vx * sin + vy * cos }, // -angle
  ];
}

/** AABB overlap between a falling powerup and the paddle (pickup test, §2.3). */
export function overlapsPaddle(
  powerup: FallingPowerup,
  paddle: { x: number; y: number; width: number; height: number },
): boolean {
  const dx = Math.abs(powerup.x - paddle.x);
  const dy = Math.abs(powerup.y - paddle.y);
  return dx < (powerup.width + paddle.width) / 2 && dy < (powerup.height + paddle.height) / 2;
}

/**
 * Fixed settlement order when several powerups are caught in the same frame
 * (powerups.md §6.4: "逐个结算，life 先于 expand——顺序无强约束，但需确定后
 * 写死并测试"). This array IS the written-down order.
 */
export const PICKUP_SETTLE_ORDER: readonly PowerupId[] = ['life', 'multi', 'expand'];
