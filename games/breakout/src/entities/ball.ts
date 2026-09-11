/**
 * Ball entity.
 *
 * Holds position + velocity and the angle-hygiene rules that keep brick-breaker
 * playable: the ball must never end up travelling almost horizontally (it would
 * ping-pong forever between the side walls) and its speed must stay inside the
 * level's budget.
 */

import { clamp, type Vec2Like } from '@wxgame/framework';

export class Ball implements Vec2Like {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** False while waiting on the paddle. */
  launched = false;

  constructor(x = 0, y = 0, radius = 16) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.vx = 0;
    this.vy = 0;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  get movingDown(): boolean {
    return this.vy < 0;
  }

  /** Place the ball at rest on top of the paddle. */
  restOn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.launched = false;
  }

  /**
   * Launch upward at `angleDeg` from vertical, biased by `side` (-1 left, +1
   * right) and scaled to `speed`.
   */
  launch(speed: number, angleDeg: number, side: 1 | -1 = 1): void {
    const radians = (angleDeg * Math.PI) / 180;
    this.vx = Math.sin(radians) * speed * side;
    this.vy = Math.cos(radians) * speed;
    this.launched = true;
  }

  /** Scale the velocity so its magnitude is exactly `speed`. */
  setSpeed(speed: number): void {
    const current = this.speed;
    if (current <= 0) {
      // Degenerate: give it a straight-up direction rather than NaN.
      this.vx = 0;
      this.vy = speed;
      return;
    }
    const k = speed / current;
    this.vx *= k;
    this.vy *= k;
  }

  /**
   * Guarantee the vertical (Y) component keeps at least `minVerticalFactor` of
   * the total speed in absolute terms. Called after every bounce / paddle hit.
   */
  enforceMinVertical(minVerticalFactor: number): void {
    const speed = this.speed;
    if (speed <= 0) return;
    const minVertical = speed * minVerticalFactor;
    const absVy = Math.abs(this.vy);
    if (absVy >= minVertical) return;

    const direction = this.vy < 0 ? -1 : 1;
    this.vy = direction * minVertical;

    // Re-balance the horizontal component so the total speed is preserved.
    const remainingSq = speed * speed - this.vy * this.vy;
    const absVx = Math.sqrt(Math.max(0, remainingSq));
    const vxDirection = this.vx < 0 ? -1 : 1;
    this.vx = vxDirection * absVx;
  }

  /** Reflect horizontally (side wall or brick side hit). */
  reflectX(): void {
    this.vx = -this.vx;
  }

  /** Reflect vertically (top wall, brick face, or paddle). */
  reflectY(): void {
    this.vy = -this.vy;
  }

  /** Nudge the ball out of a horizontal trap by a small random-free jitter. */
  applyTrapEscape(minVerticalFactor: number): void {
    this.enforceMinVertical(minVerticalFactor);
    if (Math.abs(this.vx) < 1e-3) {
      this.vx = this.speed * 0.2 * (this.x >= 0 ? 1 : -1);
    }
  }

  /** Clamp the speed into a hard budget. */
  clampSpeed(maxSpeed: number): void {
    const s = this.speed;
    if (s > maxSpeed) this.setSpeed(maxSpeed);
  }

  /** Percentage of the speed that is vertical, in [0,1]. */
  get verticalFactor(): number {
    const s = this.speed;
    return s <= 0 ? 0 : clamp(Math.abs(this.vy) / s, 0, 1);
  }
}
