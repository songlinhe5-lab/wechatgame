/**
 * Breakout physics.
 *
 * Pure functions over plain data + the framework's `Aabb` primitives, so every
 * bounce rule is unit-testable without a renderer, an engine or a real frame
 * clock.
 *
 * Two design decisions worth calling out:
 *
 * 1. **Sub-stepping instead of swept collision.** The ball can travel ~10 units
 *    per 1/60 s step; bricks are 40 units tall with 6-unit gaps, so a
 *    single-step move could tunnel through a brick face. We subdivide the move
 *    so no single increment exceeds `radius / subStepDivisor`.
 * 2. **One brick resolved per sub-step, deepest first.** Resolving several
 *    overlapping bricks in one step makes the exit normal ambiguous and produces
 *    the classic "ball stuck in the wall" bug. Resolving the deepest overlap and
 *    pushing the ball clear is stable and cheap.
 */

import { circleVsAabb, type Aabb, type CollisionAxis } from '../../framework/index';
import type { BreakoutTuning } from '../config/tuning';
import type { Ball } from '../entities/ball';
import type { Paddle } from '../entities/paddle';

/** Arena bounds in design space. */
export interface Arena {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Wall-hit bitmask returned by {@link resolveArenaWalls}. */
export const WallHit = {
  None: 0,
  Left: 1,
  Right: 2,
  Top: 4,
  /** Ball crossed the bottom edge — the caller decides what "lost" means. */
  Bottom: 8,
} as const;

/** The subset of brick state physics needs. Satisfied by `CompiledBrick`. */
export interface BrickLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Base score, used by the caller to award points on destruction. */
  readonly score: number;
  /** Render colour, forwarded to hit-flash events. */
  readonly color: string;
  readonly damage: number;
  readonly indestructible: boolean;
  /**
   * Legend key this brick was compiled from, when known. Optional so a test can
   * build a bare brick; game code uses it to look up type-specific behaviour
   * such as the bomb blast.
   */
  readonly type?: string;
  hp: number;
  destroyed: boolean;
}

/** Accumulated per-step outcome. Reused between steps — never retained. */
export interface StepResult {
  wallHits: number;
  paddleHits: number;
  /** Bricks that took damage this step (may repeat? no — one per sub-step). */
  readonly bricksHit: BrickLike[];
  /** Bricks whose hp reached 0 this step and are now destroyed. */
  readonly bricksDestroyed: BrickLike[];
  /** True once the ball leaves through the bottom. */
  lost: boolean;
  /** True when the ball hit the paddle this step. */
  paddleBounced: boolean;
}

/** Create the reusable scratch result object. */
export function createStepResult(): StepResult {
  return {
    wallHits: WallHit.None,
    paddleHits: 0,
    bricksHit: [],
    bricksDestroyed: [],
    lost: false,
    paddleBounced: false,
  };
}

/** Reset a {@link StepResult} before a new step. */
export function resetStepResult(result: StepResult): void {
  result.wallHits = WallHit.None;
  result.paddleHits = 0;
  result.bricksHit.length = 0;
  result.bricksDestroyed.length = 0;
  result.lost = false;
  result.paddleBounced = false;
}

/** Scratch AABB reused when testing the ball against a brick. */
const scratchBox: Aabb = { x: 0, y: 0, w: 0, h: 0 };

/** Scratch hit record reused by every circle/box test. */
const scratchHit = { hit: false, axis: 'none' as CollisionAxis, depth: 0, contactX: 0, contactY: 0 };

/**
 * Reflect the ball off the arena walls, correcting its position so it never
 * ends up embedded. Does not handle the paddle or bricks.
 */
export function resolveArenaWalls(ball: Ball, arena: Arena, restitution = 1): number {
  let hits: number = WallHit.None;

  if (ball.x - ball.radius < arena.left) {
    ball.x = arena.left + ball.radius;
    if (ball.vx < 0) ball.vx = -ball.vx * restitution;
    hits |= WallHit.Left;
  } else if (ball.x + ball.radius > arena.right) {
    ball.x = arena.right - ball.radius;
    if (ball.vx > 0) ball.vx = -ball.vx * restitution;
    hits |= WallHit.Right;
  }

  if (ball.y + ball.radius > arena.top) {
    ball.y = arena.top - ball.radius;
    if (ball.vy > 0) ball.vy = -ball.vy * restitution;
    hits |= WallHit.Top;
  } else if (ball.y - ball.radius <= arena.bottom) {
    // Do not reflect — the caller turns this into a lost ball.
    hits |= WallHit.Bottom;
  }

  return hits;
}

/**
 * Push the ball out of `box` and reflect the velocity along the entry axis.
 * @returns the axis resolved, or `'none'` when there was no overlap.
 */
export function reflectOffBox(ball: Ball, box: Aabb, restitution = 1): CollisionAxis {
  const hit = circleVsAabb(ball.x, ball.y, ball.radius, box, scratchHit);
  if (!hit.hit) return 'none';

  if (hit.axis === 'x') {
    const fromLeft = ball.x < box.x;
    ball.x = fromLeft ? box.x - box.w / 2 - ball.radius : box.x + box.w / 2 + ball.radius;
    if ((fromLeft && ball.vx > 0) || (!fromLeft && ball.vx < 0)) ball.vx = -ball.vx * restitution;
  } else if (hit.axis === 'y') {
    const fromBelow = ball.y < box.y;
    ball.y = fromBelow ? box.y - box.h / 2 - ball.radius : box.y + box.h / 2 + ball.radius;
    if ((fromBelow && ball.vy > 0) || (!fromBelow && ball.vy < 0)) ball.vy = -ball.vy * restitution;
  }

  return hit.axis;
}

/**
 * Classic paddle deflection: the contact offset steers the ball, and the
 * resulting velocity is renormalised so total speed is preserved.
 *
 * `offset ∈ [-1, 1]` maps to a lateral velocity of `offset * english * speed`;
 * normalising the resulting vector yields a launch angle of at most
 * `atan(english)` (≈29° at the default 0.55), which keeps rally angles sane.
 */
export function applyPaddleBounce(ball: Ball, paddle: Paddle, tuning: BreakoutTuning): void {
  const halfWidth = paddle.width / 2;
  const offset = halfWidth <= 0 ? 0 : clampUnit((ball.x - paddle.x) / halfWidth);
  const speed = Math.max(ball.speed, tuning.ball.speed);

  ball.vx = offset * speed * tuning.ball.english;
  ball.vy = speed; // point straight up first; normalisation angles it.
  ball.setSpeed(speed);
  ball.enforceMinVertical(tuning.ball.minVerticalFactor);

  // Always send the ball back up after a paddle hit.
  ball.vy = Math.abs(ball.vy);
  ball.launched = true;
}

/** Number of physics sub-steps needed so no increment exceeds the safe move. */
export function computeSubSteps(
  speed: number,
  dt: number,
  radius: number,
  tuning: BreakoutTuning,
): number {
  const maxMove = Math.max(1e-6, radius / tuning.physics.subStepDivisor);
  const distance = speed * dt;
  const needed = Math.ceil(distance / maxMove);
  return clampInt(needed, 1, tuning.physics.maxSubSteps);
}

/**
 * Advance the ball by `dt`, resolving walls, the paddle and bricks.
 *
 * `result` is cleared first and filled with everything that happened, so the
 * caller can translate physics into score/audio/particles without this function
 * knowing about any of it.
 */
export function stepBall(
  ball: Ball,
  dt: number,
  arena: Arena,
  paddle: Paddle,
  bricks: readonly BrickLike[],
  tuning: BreakoutTuning,
  result: StepResult,
): StepResult {
  resetStepResult(result);
  if (!ball.launched || dt <= 0) return result;

  const subSteps = computeSubSteps(ball.speed, dt, ball.radius, tuning);
  const subDt = dt / subSteps;
  const paddleBox = paddle.bounds;

  for (let i = 0; i < subSteps; i++) {
    ball.x += ball.vx * subDt;
    ball.y += ball.vy * subDt;

    const walls = resolveArenaWalls(ball, arena, tuning.ball.wallRestitution);
    result.wallHits |= walls;
    if ((walls & WallHit.Bottom) !== 0) {
      result.lost = true;
      return result;
    }

    // Bricks take priority over the paddle: a brick can never be behind it, so
    // resolving the brick first avoids a double reflection on the same step.
    const brick = findDeepestBrickHit(ball, bricks);
    if (brick) {
      const axis = reflectOffBox(ball, brickBox(brick), tuning.ball.brickRestitution);
      if (axis !== 'none') {
        ball.enforceMinVertical(tuning.ball.minVerticalFactor);
        result.bricksHit.push(brick);
        if (!brick.indestructible) {
          brick.hp -= brick.damage;
          if (brick.hp <= 0) {
            brick.hp = 0;
            brick.destroyed = true;
            result.bricksDestroyed.push(brick);
          }
        }
      }
      continue;
    }

    if (ball.vy < 0 && circleVsAabb(ball.x, ball.y, ball.radius, paddleBox, scratchHit).hit) {
      // Push the ball above the paddle, then apply the steering bounce.
      ball.y = paddleBox.y + paddleBox.h / 2 + ball.radius;
      result.paddleHits++;
      result.paddleBounced = true;
      applyPaddleBounce(ball, paddle, tuning);
      continue;
    }
  }

  ball.clampSpeed(tuning.ball.maxSpeed);
  ball.enforceMinVertical(tuning.ball.minVerticalFactor);
  return result;
}

/** Pick the brick the ball has penetrated most deeply (stable resolution). */
function findDeepestBrickHit(ball: Ball, bricks: readonly BrickLike[]): BrickLike | null {
  let best: BrickLike | null = null;
  let bestDepth = 0;
  for (let i = 0; i < bricks.length; i++) {
    const brick = bricks[i]!;
    if (brick.destroyed) continue;
    const box = brickBox(brick);
    const hit = circleVsAabb(ball.x, ball.y, ball.radius, box, scratchHit);
    if (!hit.hit) continue;
    if (hit.depth > bestDepth) {
      bestDepth = hit.depth;
      best = brick;
    }
  }
  return best;
}

/** Fill the scratch AABB from a brick. The result is reused — do not retain. */
function brickBox(brick: BrickLike): Aabb {
  scratchBox.x = brick.x;
  scratchBox.y = brick.y;
  scratchBox.w = brick.width;
  scratchBox.h = brick.height;
  return scratchBox;
}

function clampUnit(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

function clampInt(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
