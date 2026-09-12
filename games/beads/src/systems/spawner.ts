/**
 * Spawner — the S4 feed rhythm: accumulate dt, spawn 1 bead into a *random
 * free slot* with 3:1 weighted colour drawing (tray-spawner §2.2).
 *
 * Pure mechanics, no events: `tick()` returns what happened and BeadsGame
 * broadcasts `tray:spawned` / `tray:full`. All randomness goes through the
 * injected framework RNG (control-manifest L4 — never `Math.random`).
 *
 * Full-tray semantics (A2): skip the feed, no queueing, no catch-up; `full`
 * is de-duplicated while the tray stays full and re-arms after recovery.
 */

import {
  BEAD_COLOR_MAX,
  DECOY_WEIGHT,
  NEEDED_WEIGHT,
} from '../config/tuning.js';
import type { Tray } from '../entities/tray.js';
import type { Rng } from '@wxgame/framework';

export interface SpawnOutcome {
  /** The bead that was spawned this tick, if any. */
  readonly spawned: { slot: number; colorIdx: number } | null;
  /** True when a feed attempt found no free slot (deduped while still full). */
  readonly full: boolean;
}

const NO_SPAWN: SpawnOutcome = { spawned: null, full: false };

/** Scratch for weighted candidates — reused, never retained (hot-path rule). */
const _weights: { colorIdx: number; weight: number }[] = [];
const _freeSlots: number[] = [];

export class Spawner {
  private _interval: number;
  private _acc = 0;
  private _fullReported = false;
  /** Decoy colour indices for the current level/stage (≤ DECOY_COLORS_MAX). */
  private _decoys: readonly number[] = [];

  constructor(interval: number) {
    this._interval = interval;
  }

  get interval(): number {
    return this._interval;
  }

  set interval(value: number) {
    this._interval = value;
    this._acc = 0; // interval changes (stage switches) restart the rhythm
  }

  setDecoys(decoys: readonly number[]): void {
    this._decoys = decoys;
  }

  /** Reset the accumulator (level load / stage switch / retry). */
  reset(): void {
    this._acc = 0;
    this._fullReported = false;
  }

  /**
   * Advance by `dt` and feed at most one bead per elapsed interval.
   * `_acc` carries across ticks, so 60 s at a 4.0 s interval yields exactly
   * 15 feeds (S4 §8-1) regardless of frame rate.
   */
  tick(dt: number, tray: Tray, rng: Rng): SpawnOutcome {
    this._acc += dt;
    while (this._acc >= this._interval) {
      this._acc -= this._interval;
      const outcome = this._feedOnce(tray, rng);
      if (outcome.spawned) return outcome;
      if (outcome.full) return outcome;
    }
    return NO_SPAWN;
  }

  private _feedOnce(tray: Tray, rng: Rng): SpawnOutcome {
    // Recovery check: the full-alarm re-arms once any slot frees up again.
    if (tray.freeCount > 0) this._fullReported = false;
    if (tray.freeCount === 0) {
      if (!this._fullReported) {
        this._fullReported = true;
        return { spawned: null, full: true };
      }
      return NO_SPAWN;
    }

    const colorIdx = this._drawColor(tray, rng);
    const slot = this._pickFreeSlot(tray, rng);
    if (slot < 0 || colorIdx <= 0) return NO_SPAWN;
    if (!tray.spawnInto(slot, colorIdx)) return NO_SPAWN;
    return { spawned: { slot, colorIdx }, full: false };
  }

  /**
   * Weighted draw (§3.2): still-needed colours at `NEEDED_WEIGHT` each,
   * decoys at `DECOY_WEIGHT` each. When nothing is needed (board effectively
   * complete) the draw degrades to decoys only — defensive, never a crash.
   */
  private _drawColor(tray: Tray, rng: Rng): number {
    _weights.length = 0;
    let total = 0;
    for (let c = 1; c <= BEAD_COLOR_MAX; c++) {
      const needed = tray.neededCount(c);
      if (needed > 0) {
        _weights.push({ colorIdx: c, weight: NEEDED_WEIGHT });
        total += NEEDED_WEIGHT;
      }
    }
    for (const d of this._decoys) {
      if (d >= 1 && d <= BEAD_COLOR_MAX) {
        _weights.push({ colorIdx: d, weight: DECOY_WEIGHT });
        total += DECOY_WEIGHT;
      }
    }
    if (_weights.length === 0 || total <= 0) return 0;

    const roll = rng.next() * total;
    let acc = 0;
    for (const w of _weights) {
      acc += w.weight;
      if (roll < acc) return w.colorIdx;
    }
    return _weights[_weights.length - 1]!.colorIdx;
  }

  /** Uniformly random free slot (S4 §8-2). */
  private _pickFreeSlot(tray: Tray, rng: Rng): number {
    _freeSlots.length = 0;
    for (let i = 0; i < tray.capacity; i++) {
      const slot = tray.slot(i);
      if (slot && slot.state === 'free') _freeSlots.push(i);
    }
    const n = _freeSlots.length;
    if (n === 0) return -1;
    const idx = Math.min(n - 1, Math.floor(rng.next() * n));
    return _freeSlots[idx]!;
  }
}
