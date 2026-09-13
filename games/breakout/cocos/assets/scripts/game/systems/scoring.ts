/**
 * Scoring + combo rules.
 *
 * Kept separate from the world so the economy can be re-balanced (or unit
 * tested) without touching physics. All numbers come from `BreakoutTuning`.
 *
 * Combo definition: *consecutive bricks destroyed without the ball touching the
 * paddle*. Touching the paddle or losing the ball resets it. This rewards the
 * "dig a tunnel and stay in it" skill expression that makes brick-breakers fun,
 * rather than rewarding raw speed.
 */

import type { BreakoutTuning } from '../config/tuning';

export interface ComboView {
  readonly combo: number;
  readonly bestCombo: number;
  readonly multiplier: number;
}

export class Scorer {
  score = 0;
  /** Consecutive bricks destroyed since the last paddle touch. */
  combo = 0;
  bestCombo = 0;
  /** Total bricks destroyed this run (drives analytics + end-of-run summary). */
  bricksDestroyed = 0;

  constructor(private readonly _tuning: BreakoutTuning) {}

  /** Current score multiplier derived from the combo count. */
  get multiplier(): number {
    return multiplierFor(this.combo, this._tuning);
  }

  get view(): ComboView {
    return { combo: this.combo, bestCombo: this.bestCombo, multiplier: this.multiplier };
  }

  /**
   * Register a destroyed brick.
   * @param baseScore the brick's authored score value.
   * @returns the points actually awarded (base × multiplier, rounded).
   */
  onBrickDestroyed(baseScore: number): number {
    this.combo++;
    this.bricksDestroyed++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    const points = Math.round(baseScore * this.multiplier);
    this.score += points;
    return points;
  }

  /** The ball touched the paddle: the chain is broken. */
  onPaddleHit(): void {
    this.combo = 0;
  }

  /** The ball fell out of play. */
  onBallLost(): void {
    this.combo = 0;
  }

  /** Award an arbitrary bonus (level clear, life bonus). Returns new total. */
  addBonus(points: number): number {
    if (points > 0) this.score += Math.round(points);
    return this.score;
  }

  /** Bonus for remaining lives when the run ends. */
  endOfRunBonus(remainingLives: number): number {
    return this.addBonus(remainingLives * this._tuning.rules.lifeBonus);
  }

  /** Full reset for a new run. */
  reset(): void {
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.bricksDestroyed = 0;
  }

  /** Reset only the chain (keeps score) — used between levels. */
  resetCombo(): void {
    this.combo = 0;
  }
}

/**
 * Combo → multiplier curve: `1 + floor(combo / comboStep) * step`, capped.
 *
 * With the defaults (comboStep 4, step 0.5, cap 4):
 *   combo 0–3 → ×1.0, 4–7 → ×1.5, 8–11 → ×2.0, 12–15 → ×2.5, 16–19 → ×3.0,
 *   20–23 → ×3.5, 24+ → ×4.0
 */
export function multiplierFor(combo: number, tuning: BreakoutTuning): number {
  const { comboStep, comboMultiplierStep, maxComboMultiplier } = tuning.rules;
  if (comboStep <= 0) return 1;
  const steps = Math.floor(combo / comboStep);
  const value = 1 + steps * comboMultiplierStep;
  return Math.min(value, maxComboMultiplier);
}

/** Points for clearing a level, scaled by the level index and remaining lives. */
export function levelClearBonus(
  tuning: BreakoutTuning,
  levelIndex: number,
  remainingLives: number,
): number {
  const base = 500 + levelIndex * 250;
  return base + remainingLives * tuning.rules.lifeBonus;
}
