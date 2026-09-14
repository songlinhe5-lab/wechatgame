/**
 * Beads phases, transition table and the render snapshot contract.
 *
 * Six states straight from core-loop §2.1; the sprint mode is a *mode flag on
 * the Game*, so the machine itself has zero sprint branches (score-combo §2.1).
 *
 * The snapshot is the ONLY thing the view layer sees — flat, read-only,
 * rebuilt in place from authoritative state each frame (control-manifest §8).
 */

import type { SlotState } from '../entities/tray.js';
import type { CellState } from '../entities/grid.js';
import type { BeadsTuning } from '../config/tuning.js';

export type BeadsPhase = 'boot' | 'playing' | 'paused' | 'level-clear' | 'game-over' | 'finish';
export type GameMode = 'normal' | 'sprint';

/**
 * Declared legal edges. Anything not listed is impossible by construction:
 * cleared/failed/pause all leave PLAYING; only PLAYING resumes from PAUSED;
 * retry / revive (game-over) and next-level (level-clear) re-enter PLAYING.
 */
export const PHASE_TRANSITIONS: Readonly<Record<BeadsPhase, readonly BeadsPhase[]>> = {
  boot: ['playing'],
  playing: ['paused', 'level-clear', 'game-over'],
  paused: ['playing'],
  'level-clear': ['playing', 'finish'],
  'game-over': ['playing'],
  finish: ['playing'],
};

/** Mutable per-cell view struct — reused, never retained (hot-path rule). */
export interface SnapshotCell {
  state: CellState;
  colorIdx: number;
  /** `.` cells: outside the pattern shape — render as background. */
  void: boolean;
}

/** Mutable per-slot view struct — reused, never retained. */
export interface SnapshotSlot {
  state: SlotState;
  colorIdx: number;
}

/** Read-only, per-frame view of the world handed to the renderer. */
export interface BeadsSnapshot {
  phase: BeadsPhase;
  phaseElapsed: number;
  mode: GameMode;

  levelIndex: number;
  levelId: string;
  levelName: string;
  levelCount: number;

  /** Countdown, display seconds (ceiled). */
  remaining: number;
  timeTotal: number;
  urgent: boolean;

  /** Grid dimensions; `cells` is a flat row-major array (row 0 = top row). */
  gridCols: number;
  gridRows: number;
  cells: SnapshotCell[];

  /** Tray slots (flat; capacity 12 or 24 when expanded). */
  traySlots: SnapshotSlot[];
  trayExpanded: boolean;
  traySelected: number;

  /** S9 pause panel: visible = anything drawn (incl. the exit fade). */
  panelVisible: boolean;
  /** Panel animation progress, 0→1 entering, 1→0 leaving. */
  panelProgress: number;
  /** True only while the panel accepts taps (not during the exit fade). */
  panelInteractive: boolean;
  /** S9 audio toggles for immediate visual echo (no restart needed). */
  bgmMuted: boolean;
  sfxMuted: boolean;

  /** Sprint HUD — normal mode leaves these at zero and the view hides them. */
  score: number;
  multiplier: number;
  streak: number;
  stageIndex: number;
  sprintBestScore: number;
  isNewBest: boolean;

  /** Stage geometry for hit-testing-agnostic rendering (§3.3 derivation). */
  gridLeft: number;
  gridTop: number;

  /** Banner text for the current phase ('' when none). */
  banner: string;
  subBanner: string;

  /** BOOT validation failure — the game refuses to enter PLAYING (core-loop §2.1). */
  bootError: string;

  /** Ordinary GAME_OVER: the fail overlay may still offer a revive. */
  reviveAvailable: boolean;
  /** True after a successful fail-page revive this attempt. */
  revived: boolean;
  /** True while a fail-page ad `show()` is in flight. */
  watchingAd: boolean;
  /** One-shot copy under the fail panel (e.g. Noop 「即将开放」). */
  failHint: string;

  tuning: BeadsTuning;
}

/** Build the mutable snapshot object (created once, updated in place). */
export function createSnapshot(tuning: BeadsTuning): BeadsSnapshot {
  return {
    phase: 'boot',
    phaseElapsed: 0,
    mode: 'normal',
    levelIndex: 0,
    levelId: '',
    levelName: '',
    levelCount: 0,
    remaining: 0,
    timeTotal: 0,
    urgent: false,
    gridCols: 0,
    gridRows: 0,
    cells: [],
    traySlots: [],
    trayExpanded: false,
    traySelected: -1,
    panelVisible: false,
    panelProgress: 0,
    panelInteractive: false,
    bgmMuted: false,
    sfxMuted: false,
    score: 0,
    multiplier: 1,
    streak: 0,
    stageIndex: 0,
    sprintBestScore: 0,
    isNewBest: false,
    gridLeft: 0,
    gridTop: 0,
    banner: '',
    subBanner: '',
    bootError: '',
    reviveAvailable: false,
    revived: false,
    watchingAd: false,
    failHint: '',
    tuning,
  };
}

/** Human-readable banner copy per phase (kept out of the renderer). */
export function bannerFor(phase: BeadsPhase, isLastLevel: boolean): { banner: string; sub: string } {
  switch (phase) {
    case 'boot':
      return { banner: '', sub: '' };
    case 'playing':
      return { banner: '', sub: '' };
    case 'paused':
      return { banner: '已暂停', sub: '' };
    case 'level-clear':
      return { banner: '过关！', sub: isLastLevel ? '全部完成！' : '下一关来了…' };
    case 'game-over':
      return { banner: '时间到', sub: '' };
    case 'finish':
      return { banner: '全部通关！', sub: '' };
    default:
      return { banner: '', sub: '' };
  }
}
