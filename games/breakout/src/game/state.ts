/**
 * Breakout phases, transition table and the render snapshot contract.
 *
 * The snapshot is the ONLY thing the view layer sees. It is a plain, flat,
 * read-only description rebuilt from authoritative state each frame — the UI
 * can never mutate gameplay through it (see ADR-0002 and
 * docs/architecture/control-manifest.md).
 */

import type { CompiledBrick } from '@wxgame/framework';
import type { BreakoutTuning } from '../config/tuning.js';
import type { MotionEffects } from '../systems/motion.js';
import { MOTION_FULL } from '../systems/motion.js';

export type BreakoutPhase =
  | 'ready'
  | 'playing'
  | 'life-lost'
  | 'level-clear'
  | 'game-over'
  | 'victory'
  | 'paused';

/**
 * Declared legal edges. Anything not listed here is impossible by construction,
 * so a stray double-tap or an out-of-order timer can never corrupt the flow.
 */
export const PHASE_TRANSITIONS: Readonly<Record<BreakoutPhase, readonly BreakoutPhase[]>> = {
  ready: ['playing', 'paused'],
  playing: ['life-lost', 'level-clear', 'game-over', 'paused'],
  'life-lost': ['ready', 'game-over', 'paused'],
  'level-clear': ['ready', 'victory', 'paused'],
  'game-over': ['ready', 'paused'],
  victory: ['ready', 'paused'],
  paused: ['ready', 'playing', 'life-lost', 'level-clear', 'game-over', 'victory'],
};

/** True when the phase is a transient banner (auto-advances on a timer). */
export function isTimedPhase(phase: BreakoutPhase): boolean {
  return phase === 'life-lost' || phase === 'level-clear';
}

/** True when the phase waits for a tap to continue. */
export function isTapToContinuePhase(phase: BreakoutPhase): boolean {
  return phase === 'game-over' || phase === 'victory' || phase === 'ready';
}

/** Read-only, per-frame view of the world handed to the renderer. */
export interface BreakoutSnapshot {
  phase: BreakoutPhase;
  /** Seconds spent in the current phase. */
  phaseElapsed: number;
  levelIndex: number;
  levelName: string;
  levelCount: number;
  score: number;
  bestScore: number;
  combo: number;
  bestCombo: number;
  multiplier: number;
  lives: number;
  /** Destructible bricks still standing. */
  remainingBricks: number;
  /** Destructible bricks at level start (for a progress bar). */
  totalBricks: number;

  paddleX: number;
  paddleY: number;
  paddleWidth: number;
  paddleHeight: number;

  ballX: number;
  ballY: number;
  ballRadius: number;
  ballResting: boolean;

  /** Accessibility D1 switch (assets-spec §6). Mirrors `settings.reduceMotion`. */
  reduceMotion: boolean;
  /** Per-effect motion levels derived from `reduceMotion` (§6.1/§6.2 table). */
  motion: MotionEffects;
  /** Live screen-shake amplitude in px (decays to 0; 0 when motion reduced). */
  shakeAmplitude: number;
  /** Recent ball positions for the trail, oldest first (empty when reduced). */
  ballTrail: readonly { readonly x: number; readonly y: number }[];

  bricks: readonly CompiledBrick[];

  /** Banner text for the current phase ('' when none). */
  banner: string;
  /** Secondary line under the banner ('' when none). */
  subBanner: string;
  /** True while the HUD should invite a tap to launch. */
  awaitingLaunch: boolean;
  /** True once the ball has been launched at least once this level. */
  launched: boolean;

  tuning: BreakoutTuning;
}

/** Build the mutable snapshot object (created once, updated in place). */
export function createSnapshot(tuning: BreakoutTuning): BreakoutSnapshot {
  return {
    phase: 'ready',
    phaseElapsed: 0,
    levelIndex: 0,
    levelName: '',
    levelCount: 0,
    score: 0,
    bestScore: 0,
    combo: 0,
    bestCombo: 0,
    multiplier: 1,
    lives: tuning.rules.lives,
    remainingBricks: 0,
    totalBricks: 0,
    paddleX: 0,
    paddleY: tuning.paddle.y,
    paddleWidth: tuning.paddle.width,
    paddleHeight: tuning.paddle.height,
    ballX: 0,
    ballY: 0,
    ballRadius: tuning.ball.radius,
    ballResting: true,
    reduceMotion: false,
    motion: MOTION_FULL,
    shakeAmplitude: 0,
    ballTrail: [],
    bricks: [],
    banner: '',
    subBanner: '',
    awaitingLaunch: true,
    launched: false,
    tuning,
  };
}

/** Human-readable banner copy per phase (kept out of the renderer). */
export function bannerFor(phase: BreakoutPhase, isLastLevel: boolean): { banner: string; sub: string } {
  switch (phase) {
    case 'ready':
      // No banner: the renderer draws a "tap to launch" affordance instead so
      // the hint sits above the paddle rather than in the middle of the board.
      return { banner: '', sub: '' };
    case 'life-lost':
      return { banner: 'BALL LOST', sub: 'Get ready…' };
    case 'level-clear':
      return {
        banner: 'LEVEL CLEAR',
        sub: isLastLevel ? 'Final board cleared!' : 'Next board incoming…',
      };
    case 'game-over':
      return { banner: 'GAME OVER', sub: 'Tap to retry this board' };
    case 'victory':
      return { banner: 'YOU WIN', sub: 'Tap to play again' };
    case 'paused':
      return { banner: 'PAUSED', sub: 'Tap to resume' };
    default:
      return { banner: '', sub: '' };
  }
}

/** Launcher affordance copy shown while the board waits for a tap. */
export const LAUNCH_HINT = 'TAP TO LAUNCH';
