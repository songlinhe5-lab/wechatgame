/**
 * ⛔ DEAD PATH — v2.0 定时供料关停（WXG-T-136，用户 2026-09-16 裁定案 A）。
 *
 * 错位珠是珠子唯一供给、托盘为纯解谜缓冲（tray-spawner v2.0 §2.2 全节作废、
 * systems-index v1.22 §3.4「死路径保留」）⇒ **主循环不再调用 `tick()`**（供料段
 * 恒空，beads-game `_stepPlaying`）。本类整体保留为死路径：供料复活（需走
 * tray-spawner §6 变更 + 主理人确认）时零成本重启，届时 §8-1/2/3/9 判据原文随
 * v2.0 复活条款自动重新生效。行为语义零改动——单测继续按单元级死路径锁定本类。
 *
 * ────────────────────────────────────────────────────────────（以下为原文档注释）
 *
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
} from '../config/tuning';
import type { Tray } from '../entities/tray';
import type { Rng } from '../../framework/index';

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
  /**
   * GAP-02 first-supply flag (WXG-T-086): `reset()` (a fresh level/stage) arms it,
   * and the first `tick()` in PLAYING feeds one bead immediately so the tray is
   * never empty for a whole interval (ux-spec §6 “1.5s 珠已在托盘”). Not serialised
   * for crash recovery — a restored mid-level tray already holds beads, so the
   * recovery path never calls `reset()` and therefore never re-arms this.
   */
  private _firstFeed = false;
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

  /**
   * Serialization accessors for the crash snapshot (D-03, WXG-T-059).
   *
   * ⚠️ 恢复顺序：**先 `interval`，再 `acc`** —— `interval` 的 setter 会把累加器清零
   * （阶段切换语义），反过来设会把刚恢复的进度抹掉。
   */
  get acc(): number {
    return this._acc;
  }

  set acc(value: number) {
    if (Number.isFinite(value) && value >= 0) this._acc = value;
  }

  get fullReported(): boolean {
    return this._fullReported;
  }

  set fullReported(value: boolean) {
    this._fullReported = value === true;
  }

  /** Reset the accumulator (level load / stage switch / retry). */
  reset(): void {
    this._acc = 0;
    this._fullReported = false;
    this._firstFeed = true; // GAP-02: arm the immediate first bead for the fresh level
  }

  /**
   * Advance by `dt` and feed at most one bead per elapsed interval.
   * `_acc` carries across ticks, so 60 s at a 4.0 s interval yields exactly
   * 15 feeds (S4 §8-1) regardless of frame rate.
   */
  tick(dt: number, tray: Tray, rng: Rng): SpawnOutcome {
    // GAP-02: on the first tick after a level/stage load, feed one bead at once
    // (≤ 1 frame) instead of waiting a full interval. The rhythm is untouched after.
    if (this._firstFeed) {
      const first = this._feedOnce(tray, rng);
      if (first.spawned) {
        this._firstFeed = false;
        return first;
      }
      if (first.full) return first; // tray momentarily full — keep the flag, retry next tick
    }
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
   * Weighted draw (§3.2) under the A′ supply invariant `held ≤ demand`
   * (tray-spawner §2.4 / WXG-T-086): a colour is a candidate only while the tray
   * holds strictly fewer of it than the board still needs. This is what removes
   * the tail soft-lock (GAP-06) — the feed can no longer stack undroppable
   * overflow that clogs the tray. Decoys have `demand = 0`, so under v1.17
   * (`DECOY_COLORS_MAX = 0`) they are never supplied and the decoy branch is inert.
   */
  private _drawColor(tray: Tray, rng: Rng): number {
    _weights.length = 0;
    let total = 0;
    for (let c = 1; c <= BEAD_COLOR_MAX; c++) {
      const needed = tray.neededCount(c);
      // A′: only feed colour c while held(c) < demand(c).
      if (needed > 0 && tray.heldCount(c) < needed) {
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
