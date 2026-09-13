/**
 * Paddle entity.
 *
 * The paddle does *not* read input directly — the game converts the pointer's
 * design-space X into `targetX` and the paddle eases toward it. That keeps the
 * entity free of platform concerns and trivially testable.
 */

import { clamp, type Aabb } from '../../framework/index.js';
import type { BreakoutTuning } from '../config/tuning.js';
import { paddleLimits } from '../config/tuning.js';

export class Paddle {
  /** Centre X. */
  x: number;
  /** Centre Y (fixed for the whole run unless a level overrides it). */
  readonly y: number;
  width: number;
  readonly height: number;

  /** Where the player is asking the paddle to be, before clamping. */
  targetX: number;
  /** Horizontal velocity actually applied last frame (used for spin effects). */
  vx = 0;

  /** Scratch AABB reused by collision code — never exposed. */
  private readonly _bounds: Aabb = { x: 0, y: 0, w: 0, h: 0 };

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.targetX = x;
  }

  get left(): number {
    return this.x - this.width / 2;
  }

  get right(): number {
    return this.x + this.width / 2;
  }

  get top(): number {
    return this.y + this.height / 2;
  }

  get bottom(): number {
    return this.y - this.height / 2;
  }

  /** Collision box in design space. The returned object is reused each call. */
  get bounds(): Aabb {
    const b = this._bounds;
    b.x = this.x;
    b.y = this.y;
    b.w = this.width;
    b.h = this.height;
    return b;
  }

  /** Queue a new target position, clamped to the reachable band. */
  setTarget(x: number, tuning: BreakoutTuning): void {
    const limits = paddleLimits(tuning, this.width);
    this.targetX = clamp(x, limits.min, limits.max);
  }

  /**
   * Ease toward the target using exponential smoothing.
   *
   * §3.4 pins `PADDLE_FOLLOW_TAU` (0.06 s) as the time constant, so the paddle
   * is frame-rate independent and never overshoots. Sub-pixel distances snap so
   * the paddle settles exactly on the target instead of asymptoting forever.
   */
  update(dt: number, tuning: BreakoutTuning): void {
    const previous = this.x;
    const tau = tuning.paddle.followTau;
    const k = tau > 0 ? 1 - Math.exp(-Math.max(0, dt) / tau) : 1;
    const next = previous + (this.targetX - previous) * k;
    this.x = Math.abs(this.targetX - next) < 0.5 ? this.targetX : next;
    this.vx = dt > 0 ? (this.x - previous) / dt : 0;
  }

  /** Re-centre at `x` with no easing (used on reset / new life). */
  resetTo(x: number, tuning: BreakoutTuning): void {
    const limits = paddleLimits(tuning, this.width);
    this.x = clamp(x, limits.min, limits.max);
    this.targetX = this.x;
    this.vx = 0;
  }

  /** Apply a per-level paddle width override. */
  setWidth(width: number, tuning: BreakoutTuning): void {
    this.width = width;
    this.resetTo(this.x, tuning);
  }
}
