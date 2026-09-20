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

/**
 * Tier (0 = none … 3 = ×5) for a streak value — same thresholds as
 * {@link multiplierForStreak}. Used by crash-snapshot restore so the tier can be
 * **re-derived from `streak`** instead of trusted from a redundant stored field
 * (in-level snapshot proposal §2: 冲突以 streak 为准).
 */
export function tierForStreak(streak: number): number {
  if (!Number.isInteger(streak) || streak < 0) return 0;
  let tier = 0;
  for (let i = 0; i < COMBO_STREAK_TIERS.length; i++) {
    if (streak >= COMBO_STREAK_TIERS[i]!) tier = i + 1;
  }
  return tier;
}

export class SprintTracker {
  private _streak = 0;
  private _multiplier = 1;
  private _tier = 0;
  private _score = 0;
  private _stageIndex = 0;
  /** Highest stage index reached this run (0-based; 0 means "stage 0 in progress"). */
  private _bestStage = 0;
  /**
   * Highest streak reached this run（`ux-spec §3.5` 左列「▸×5 最高连击 14」的数据源）。
   * `streak` 会在断连时归零，故**必须单独记最大值**；它不进 `sprint:ended` payload
   * ——该事件的字段集合受 `systems-index §6` 变更流程约束，而这是结算面板的**展示**量。
   */
  private _bestStreak = 0;
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

  /** Highest streak reached this run（断连不清零，`reset()` 才归零）。 */
  get bestStreak(): number {
    return this._bestStreak;
  }

  get windowRemaining(): number {
    return this._window;
  }

  /** Correct placement: grow streak, maybe tier up, score the bead. */
  onPlaced(): PlacementScore {
    this._window = COMBO_WINDOW_S;
    this._streak = Math.max(0, this._streak + 1);
    this._bestStreak = Math.max(this._bestStreak, this._streak);

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
    this._bestStreak = 0;
    this._window = 0;
  }

  private _break(): void {
    this._streak = 0;
    this._multiplier = 1;
    this._tier = 0;
    this._window = 0;
  }

  /**
   * Restore a run in progress from an in-level crash snapshot (WXG-T-059 D-03).
   *
   * 本方法是提案 §7 未列、但**必需**的增量：`SprintTracker` 此前只有 `reset()`
   * 与玩法推进方法，没有任何 setter，因而无法把「杀进程那一刻的连击/分数/梯位」
   * 放回去。口径按提案 §2：
   *   · `streak` 是**唯一权威**——`multiplier` / `tier` 一律由它**重算**（不信任快照里的
   *     冗余值，冲突以 streak 为准）；
   *   · `score` / `stageIndex` / `bestStage` / `window`（连击窗口剩余秒）直取快照值并夹取；
   *   · `bestStage` 至少不小于 `stageIndex`（不变量：已到达的最远梯位 ≥ 当前梯位）。
   */
  restore(state: {
    readonly streak: number;
    readonly score: number;
    readonly stageIndex: number;
    readonly bestStage: number;
    readonly bestStreak: number;
    readonly windowRemaining: number;
  }): void {
    const streak = Number.isInteger(state.streak) && state.streak > 0 ? state.streak : 0;
    this._streak = streak;
    this._multiplier = multiplierForStreak(streak);
    this._tier = tierForStreak(streak);
    this._score = Number.isFinite(state.score) && state.score > 0 ? state.score : 0;
    const stageIndex =
      Number.isInteger(state.stageIndex) && state.stageIndex > 0 ? state.stageIndex : 0;
    this._stageIndex = stageIndex;
    const bestStage = Number.isInteger(state.bestStage) && state.bestStage > 0 ? state.bestStage : 0;
    this._bestStage = Math.max(bestStage, stageIndex);
    // 同 bestStage 口径：不变量是「历史最高 ≥ 当前」，故取 max 而非信任快照值。
    const bestStreak =
      Number.isInteger(state.bestStreak) && state.bestStreak > 0 ? state.bestStreak : 0;
    this._bestStreak = Math.max(bestStreak, streak);
    this._window =
      Number.isFinite(state.windowRemaining) && state.windowRemaining > 0
        ? Math.min(state.windowRemaining, COMBO_WINDOW_S)
        : 0;
  }
}
