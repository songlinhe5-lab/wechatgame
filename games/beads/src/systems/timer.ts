/**
 * GameTimer — the S5 countdown, the single time authority (ADR-0007: owned by
 * the game side; the framework loop stays untouched).
 *
 * Internal accumulation is per-dt (continuous); the display refreshes at
 * `TIMER_TICK` granularity. Pausing is NOT implemented here — S1's state
 * machine is the single freeze arbiter and simply stops calling `tick()`
 * while PAUSED (ADR-0007 decision B).
 */

import { TIMER_TICK, TIMER_URGENT_T } from '../config/tuning.js';

export interface TimerTickResult {
  /** Display-granularity remaining (s) when a `timer:tick` should fire, else null. */
  readonly displayTick: number | null;
  /** Remaining (s) when the level *drops through* TIMER_URGENT_T, else null. */
  readonly urgent: number | null;
  /** True once remaining reached 0 this tick (the only failure condition). */
  readonly expired: boolean;
}

export class GameTimer {
  private _total: number;
  private _remaining: number;
  private _displayAcc = 0;
  private _urgentFired = false;

  constructor(total: number) {
    this._total = total;
    this._remaining = total;
  }

  get total(): number {
    return this._total;
  }

  get remaining(): number {
    return this._remaining;
  }

  /** remaining / total — the star-rating input (§3.7). Clamped to [0, 1]. */
  get ratio(): number {
    if (this._total <= 0) return 0;
    return Math.max(0, Math.min(1, this._remaining / this._total));
  }

  /** mm:ss display string of the ceiled remaining seconds. */
  get display(): string {
    const secs = Math.max(0, Math.ceil(this._remaining - 1e-9));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Advance by `dt`. Fires at most one display tick per elapsed second and an
   * `urgent` signal on each downward crossing of TIMER_URGENT_T (re-armed when
   * time is added back above the threshold — e.g. a stage bonus).
   */
  tick(dt: number): TimerTickResult {
    const before = this._remaining;
    this._remaining = Math.max(0, this._remaining - dt);

    let displayTick: number | null = null;
    this._displayAcc += dt;
    while (this._displayAcc >= TIMER_TICK) {
      this._displayAcc -= TIMER_TICK;
      displayTick = Math.max(0, Math.ceil(this._remaining - 1e-9));
    }

    let urgent: number | null = null;
    if (before > TIMER_URGENT_T && this._remaining <= TIMER_URGENT_T && !this._urgentFired) {
      this._urgentFired = true;
      urgent = Math.max(0, Math.ceil(this._remaining - 1e-9));
    }
    if (this._remaining > TIMER_URGENT_T) this._urgentFired = false;

    return { displayTick, urgent, expired: this._remaining <= 0 };
  }

  /**
   * Stage bonus (C5): add seconds, clamped to the run's own cap. Re-arms the
   * urgent signal when the total climbs back above the threshold.
   */
  addTime(seconds: number, cap: number): number {
    this._remaining = Math.min(this._remaining + seconds, Math.max(cap, this._remaining));
    if (this._remaining > TIMER_URGENT_T) this._urgentFired = false;
    return this._remaining;
  }

  /** Full reset (S5 §2.4 item 1: countdown back to full, urgent disarmed). */
  reset(total: number): void {
    this._total = total;
    this._remaining = total;
    this._displayAcc = 0;
    this._urgentFired = false;
  }
}
