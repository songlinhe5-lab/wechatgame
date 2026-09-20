/**
 * Breakout tuning — every gameplay number lives here, none in the systems.
 *
 * ⚠️ AUTHORITY: every constant below is a mirror of
 * `design/gdd/systems-index.md §3` (the frozen single source of truth). If a
 * value here disagrees with §3, **§3 wins** and this file is the bug. Do not
 * invent values here; add them to §3 first.
 *
 * Units are *design-space* units (see the framework `Viewport`). The design
 * resolution is 750 × 1334 (portrait), matching the Cocos Canvas. Design-space
 * origin is the **bottom-left**, y grows upward (Cocos convention).
 *
 * Changing a value here must never require touching a system file: that is the
 * data-driven rule from docs/architecture/control-manifest.md.
 */

import type { GridLayout } from '../../framework/index';

// ───────────────────────────────────────────────── §3.1 canvas & safe area
/** Design resolution width (px). */
export const DESIGN_W = 750;
/** Design resolution height (px), portrait. */
export const DESIGN_H = 1334;
/** Top safe-area height: y ∈ [1214, 1334]. No critical tappable content here. */
export const SAFE_TOP_H = 120;

// ───────────────────────────────────────────────── §3.2 playfield
/** Left wall *inner face* x. The ball centre bounces at `WALL_LEFT_X + BALL_R`. */
export const WALL_LEFT_X = 30;
/** Right wall *inner face* x. */
export const WALL_RIGHT_X = 720;
/** Ceiling *inner face* y. The ball centre bounces at `CEILING_Y - BALL_R`. */
export const CEILING_Y = 1240;
/** Paddle centre y (fixed; the paddle never moves vertically). */
export const PADDLE_Y = 200;
/** A ball whose *lower edge* passes below this y is lost. */
export const DEATH_Y = 100;

// ───────────────────────────────────────────────── §3.3 brick grid
/** Grid column count. */
export const BRICK_COLS = 10;
/** Maximum rows the grid can hold before it collides with the HUD. */
export const BRICK_MAX_ROWS = 6;
/** Brick width (px). */
export const BRICK_W = 62;
/** Brick height (px). */
export const BRICK_H = 34;
/** Horizontal gap between bricks. */
export const BRICK_GAP_X = 6;
/** Vertical gap between bricks. */
export const BRICK_GAP_Y = 6;
/** Column pitch = `BRICK_W + BRICK_GAP_X` = 68. */
export const BRICK_COL_PITCH = BRICK_W + BRICK_GAP_X;
/** Row pitch = `BRICK_H + BRICK_GAP_Y` = 40. */
export const BRICK_ROW_PITCH = BRICK_H + BRICK_GAP_Y;
/** Column 0 brick *left edge* x. */
export const BRICK_START_X = 38;
/** Row 0 brick *top edge* y. */
export const BRICK_TOP_Y = 1200;

// ───────────────────────────────────────────────── §3.4 paddle & ball
/** Base paddle width. */
export const PADDLE_W = 140;
/** Paddle width while the `expand` powerup is active (= PADDLE_W × 1.4). */
export const PADDLE_W_EXPANDED = 196;
/** Paddle height (capsule; corner radius = half height). */
export const PADDLE_H = 24;
/** Paddle easing time constant (exponential smoothing toward the target). */
export const PADDLE_FOLLOW_TAU = 0.06;
/** Ball radius. */
export const BALL_R = 12;
/** Global base ball speed; individual levels override via `ballSpeed`. */
export const BALL_SPEED_BASE = 480;
/** Hard ball-speed ceiling (assertion limit, not a ramp). */
export const BALL_SPEED_MAX = 720;
/** Max paddle deflection angle from vertical, in degrees. */
export const BALL_MAX_BOUNCE_ANGLE = 60;
/** Minimum share of total speed kept on the vertical axis (anti "flat flying"). */
export const BALL_MIN_VERTICAL_RATIO = 0.25;

// ───────────────────────────────────────────────── §3.5 general rules
/** Lives at the start of a run. */
export const START_LIVES = 3;
/** Hard life ceiling — the `life` powerup cannot exceed it. */
export const MAX_LIVES = 5;
/** Consecutive bricks per +1 multiplier step. */
export const COMBO_STEP = 3;
/** Multiplier ceiling (×5). */
export const COMBO_MULT_MAX = 5;
/** Base chance that a destroyed brick drops a powerup (levels may override). */
export const POWERUP_DROP_BASE = 0.12;
/** Powerup fall speed. */
export const POWERUP_FALL_SPEED = 260;
/** A powerup below this y disappears (same line as `DEATH_Y`). */
export const POWERUP_MISS_Y = 100;
/** Maximum simultaneous powerups on the field. */
export const POWERUP_MAX_ON_FIELD = 3;
/** Maximum simultaneous balls (multi-ball protection). */
export const BALL_MAX_COUNT = 9;

/**
 * §3.6 — the MVP-implemented powerup set.
 *
 * A level's `powerupPool` is intersected with this list; ids that are defined
 * but not implemented are **silently ignored** and the weights re-normalise
 * across the remaining candidates. Never throw on an unimplemented id.
 */
export const IMPLEMENTED_POWERUPS = ['expand', 'multi', 'life'] as const;

export interface BreakoutTuning {
  /** Design resolution + safe area. */
  readonly width: number;
  readonly height: number;
  readonly safeTopH: number;

  /** Grid dimensions that the framework `GridLayout` cannot express. */
  readonly cols: number;
  readonly maxRows: number;

  /**
   * Playable arena. `left/right/top` are the *wall inner faces*; `bottom` is the
   * death line (see `DEATH_Y`).
   */
  readonly arena: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };

  /**
   * Grid → pixel mapping for the framework level compiler.
   *
   * The compiler derives the brick centre as
   * `originX + col*cellWidth + cellWidth/2`, and the drawn size as
   * `cellWidth - gapX`. So `originX` is the *cell* left edge, which sits
   * `gapX / 2` to the left of the brick's own left edge (`BRICK_START_X`).
   */
  readonly grid: GridLayout;

  readonly paddle: {
    readonly width: number;
    /** Width while `expand` is active. */
    readonly expandedWidth: number;
    readonly height: number;
    /** Centre Y — fixed for the whole run. */
    readonly y: number;
    /** Exponential-smoothing time constant, in seconds. */
    readonly followTau: number;
    /** Distance kept from the arena walls. */
    readonly margin: number;
  };

  readonly ball: {
    readonly radius: number;
    /** Base speed at level 1; levels override via their own `ballSpeed`. */
    readonly speed: number;
    /** Hard ceiling so late levels stay playable. */
    readonly maxSpeed: number;
    /** Max deflection from vertical after a paddle hit, in degrees. */
    readonly maxBounceAngleDeg: number;
    /** Where the ball sits before launch, relative to the paddle. */
    readonly restOffsetY: number;
    /** Launch angle from vertical, in degrees. */
    readonly launchAngleDeg: number;
    /**
     * How strongly the paddle's contact offset steers the ball.
     * 0 = always straight up, 1 = angle follows the contact point fully.
     */
    readonly english: number;
    /**
     * The ball's vertical direction must keep at least this fraction of its
     * speed, otherwise a bounce can trap it in a near-horizontal loop.
     */
    readonly minVerticalFactor: number;
    /** Fraction of speed retained after a brick bounce. */
    readonly brickRestitution: number;
    /** Fraction of speed retained after a wall bounce. */
    readonly wallRestitution: number;
  };

  readonly rules: {
    readonly lives: number;
    /** Hard ceiling for the `life` powerup. */
    readonly maxLives: number;
    /** Consecutive bricks destroyed needed per +1 multiplier step. */
    readonly comboStep: number;
    /** Score multiplier added per combo step. */
    readonly comboMultiplierStep: number;
    /** Upper bound on the combo multiplier. */
    readonly maxComboMultiplier: number;
    /** Bonus awarded per remaining life when the run ends. */
    readonly lifeBonus: number;
  };

  readonly powerups: {
    /** Base drop chance when a brick is destroyed (levels may override). */
    readonly dropBase: number;
    readonly fallSpeed: number;
    /** Below this y a falling powerup is discarded. */
    readonly missY: number;
    /** Maximum simultaneous powerups on the field. */
    readonly maxOnField: number;
    /** Maximum simultaneous balls. */
    readonly maxBalls: number;
    /** The MVP set — see `IMPLEMENTED_POWERUPS`. */
    readonly implemented: readonly string[];
  };

  readonly timings: {
    /** Seconds the "level cleared" banner shows before auto-advancing. */
    readonly levelClearDelay: number;
    /** Seconds the "ball lost" state holds before resetting the ball. */
    readonly lifeLostDelay: number;
    /** Minimum seconds between two level-clear bonuses (anti double-fire). */
    readonly minPhaseDuration: number;
  };

  /** Physics sub-stepping: never move the ball more than radius / this per step. */
  readonly physics: {
    readonly subStepDivisor: number;
    readonly maxSubSteps: number;
  };
}

export const DEFAULT_TUNING: BreakoutTuning = {
  width: DESIGN_W,
  height: DESIGN_H,
  safeTopH: SAFE_TOP_H,

  cols: BRICK_COLS,
  maxRows: BRICK_MAX_ROWS,

  arena: {
    left: WALL_LEFT_X,
    right: WALL_RIGHT_X,
    top: CEILING_Y,
    bottom: DEATH_Y,
  },

  // originX = BRICK_START_X - gapX/2 = 38 - 3 = 35
  // originY = BRICK_TOP_Y + gapY/2 = 1200 + 3 = 1203
  grid: {
    originX: BRICK_START_X - BRICK_GAP_X / 2,
    originY: BRICK_TOP_Y + BRICK_GAP_Y / 2,
    cellWidth: BRICK_COL_PITCH,
    cellHeight: BRICK_ROW_PITCH,
    gapX: BRICK_GAP_X,
    gapY: BRICK_GAP_Y,
  },

  paddle: {
    width: PADDLE_W,
    expandedWidth: PADDLE_W_EXPANDED,
    height: PADDLE_H,
    y: PADDLE_Y,
    followTau: PADDLE_FOLLOW_TAU,
    margin: 12,
  },

  ball: {
    radius: BALL_R,
    speed: BALL_SPEED_BASE,
    maxSpeed: BALL_SPEED_MAX,
    maxBounceAngleDeg: BALL_MAX_BOUNCE_ANGLE,
    restOffsetY: 78,
    launchAngleDeg: 24,
    english: 0.55,
    minVerticalFactor: BALL_MIN_VERTICAL_RATIO,
    brickRestitution: 1,
    wallRestitution: 1,
  },

  rules: {
    lives: START_LIVES,
    maxLives: MAX_LIVES,
    comboStep: COMBO_STEP,
    comboMultiplierStep: 1,
    maxComboMultiplier: COMBO_MULT_MAX,
    // Not pinned by §3 — kept from the original balance, easy to re-tune later.
    lifeBonus: 250,
  },

  powerups: {
    dropBase: POWERUP_DROP_BASE,
    fallSpeed: POWERUP_FALL_SPEED,
    missY: POWERUP_MISS_Y,
    maxOnField: POWERUP_MAX_ON_FIELD,
    maxBalls: BALL_MAX_COUNT,
    implemented: IMPLEMENTED_POWERUPS,
  },

  timings: {
    levelClearDelay: 1.4,
    lifeLostDelay: 1.0,
    minPhaseDuration: 0.15,
  },

  physics: {
    subStepDivisor: 2,
    maxSubSteps: 512,
  },
};

/**
 * Fallback ball speed, clamped to the ceiling.
 *
 * Levels carry their own authoritative `ballSpeed` (§3.3 / levels-spec §2.4);
 * this only covers a level that omits one, so it deliberately does **not**
 * extrapolate per level index.
 */
export function ballSpeedForLevel(tuning: BreakoutTuning): number {
  return Math.min(tuning.ball.speed, tuning.ball.maxSpeed);
}

/**
 * Derived paddle bounds inside the arena.
 *
 * @param width the paddle's *actual* width; pass an explicit value when the
 *              current board overrides `tuning.paddle.width`, otherwise the
 *              clamp would let a wider paddle poke through the wall.
 */
export function paddleLimits(
  tuning: BreakoutTuning,
  width: number = tuning.paddle.width,
): { min: number; max: number } {
  const half = width / 2;
  return {
    min: tuning.arena.left + half + tuning.paddle.margin,
    max: tuning.arena.right - half - tuning.paddle.margin,
  };
}
