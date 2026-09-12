/**
 * Sprint — the S7 combo/streak/stage-ladder/score engine (score-combo.md).
 *
 * Frozen constants come from `config/tuning.ts` (§3.10 C1–C8). This module is
 * pure mechanics: it returns *outcomes* and BeadsGame turns them into the
 * registered events (`combo:up`, `combo:break`, `sprint:stage`, `sprint:ended`).
 *
 * Frozen semantics encoded here:
 *   - streak tiers [2,4,7] → ×2/×3/×5, cap ×5 (C3); the tier-up applies the
 *     instant the threshold is crossed, so the bead that *reaches* a threshold
 *     is scored with the new multiplier (§8-8's reproducible sequence);
 *   - break branches: `wrong` (bead:rejected) and `timeout` (window elapsed);
 *     a stage switch is NOT a break — streak survives across stages (C8);
 *   - window timing freezes under PAUSED because BeadsGame only calls
 *     `windowTick()` while PLAYING (same single-arbiter rule as the timer);
 *   - the normal mode never enters this system (mode flag lives on the Game).
 */

import {
  COMBO_STREAK_TIERS,
  COMBO_TIER_MULTIPLIERS,
  COMBO_WINDOW_S,
  SCORE_PER_BEAD,
  stageClearBonus,
  stageParamsFor,
  type StageParams,
} from '../config/tuning.js';

export type ComboBreakReason = 'wrong' | 'timeout';

/** Result of one correct placement. */
export interface PlacementScore {
  /** Score actually awarded for this bead (SCORE_PER_BEAD × multiplier). */
  readonly points: number;
  /** Streak after this placement. */
  readonly streak: number;
  /** Multiplier after this placement. */
  readonly multiplier: number;
  /** New tier (1-based) when this placement crossed a threshold, else null. */
  readonly tierUp: number | null;
}

/** Result of one stage completion. */
export interface StageAdvance {
  /** Score bonus for the stage that was just completed (C5). */
  readonly bonus: number;
  /** The new (0-based) stage index. */
  readonly stageIndex: number;
  /** The new stage's frozen C6 parameters. */
  readonly nextParams: StageParams;
}

/** Multiplier for a streak value (defensive: negatives/non-integers clamp to 0 → ×1). */
export function multiplierForStreak(streak: number): number {
  if (!Number.isInteger(streak) || streak < 0) return 1;
  let tier = 0;
  for (let i = 0; i < COMBO_STREAK_TIERS.length; i++) {
    if (streak >= COMBO_STREAK_TIERS[i]!) tier = i + 1;
  }
  return tier === 0 ? 1 : COMBO_TIER_MULTIPLIERS[tier - 1]!;
}

export class SprintTracker {
  private _streak = 0;
  private _multiplier = 1;
  private _tier = 0;
  private _score = 0;
  private _stageIndex = 0;
  /** Highest stage index reached this run (0-based; 0 means "stage 0 in progress"). */
  private _bestStage = 0;
  /** Seconds left in the combo window; 0 when no streak is live. */
  private _window = 0;

  get streak(): number {
    return this._streak;
  }

  get multiplier(): number {
    return this._multiplier;
  }

  /** Current tier, 0 (none) … 3 (Lv3 = ×5). */
  get tier(): number {
    return this._tier;
  }

  get score(): number {
    return this._score;
  }

  get stageIndex(): number {
    return this._stageIndex;
  }

  get bestStage(): number {
    return this._bestStage;
  }

  get windowRemaining(): number {
    return this._window;
  }

  /** Correct placement: grow streak, maybe tier up, score the bead. */
  onPlaced(): PlacementScore {
    this._window = COMBO_WINDOW_S;
    this._streak = Math.max(0, this._streak + 1);

    let tierUp: number | null = null;
    for (let i = 0; i < COMBO_STREAK_TIERS.length; i++) {
      if (this._streak === COMBO_STREAK_TIERS[i]!) {
        this._tier = i + 1;
        this._multiplier = COMBO_TIER_MULTIPLIERS[i]!;
        tierUp = i + 1;
      }
    }

    const points = SCORE_PER_BEAD * this._multiplier;
    this._score += points;
    return { points, streak: this._streak, multiplier: this._multiplier, tierUp };
  }

  /** Wrong placement: immediate break, reason `wrong` (streak cleared, ×1). */
  onRejected(): ComboBreakReason {
    this._break();
    return 'wrong';
  }

  /**
   * Advance the window. Fires a `timeout` break when the window expires with
   * a live streak. Only called while PLAYING (PAUSED freezes it).
   */
  windowTick(dt: number): ComboBreakReason | null {
    if (this._streak <= 0) return null;
    this._window = Math.max(0, this._window - dt);
    if (this._window <= 0) {
      this._break();
      return 'timeout';
    }
    return null;
  }

  /**
   * Stage completion (C8): award the bonus, advance the ladder — and do NOT
   * touch streak/multiplier/window (stage switches never break the combo).
   */
  onStageComplete(): StageAdvance {
    const bonus = stageClearBonus(this._stageIndex);
    this._score += bonus;
    this._stageIndex++;
    this._bestStage = Math.max(this._bestStage, this._stageIndex);
    return { bonus, stageIndex: this._stageIndex, nextParams: stageParamsFor(this._stageIndex) };
  }

  /** New sprint run. */
  reset(): void {
    this._streak = 0;
    this._multiplier = 1;
    this._tier = 0;
    this._score = 0;
    this._stageIndex = 0;
    this._bestStage = 0;
    this._window = 0;
  }

  private _break(): void {
    this._streak = 0;
    this._multiplier = 1;
    this._tier = 0;
    this._window = 0;
  }
}
