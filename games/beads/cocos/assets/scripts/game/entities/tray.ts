/**
 * Tray — the S4 slot array: the single authority for bead possession.
 *
 * Each slot is `free | holding(colorIdx) | selected`; at most one slot is
 * selected (re-selection moves it, never stacks — tray-spawner §2.1). The tray
 * also carries the "still-needed colours" projection: initialised from the
 * grid at level/stage load, decremented for each `bead:placed` (architecture
 * §2 note ① — a data projection, not an event; S3 and S4 never call each
 * other).
 */

import { TRAY_BASE_SLOTS, TRAY_EXPAND_SLOTS } from '../config/tuning';

export type SlotState = 'free' | 'holding' | 'selected';

export interface TraySlot {
  state: SlotState;
  /** Held colour (1-based palette index); 0 when free. */
  colorIdx: number;
}

export type SelectResult = 'selected' | 'already-selected' | 'invalid';

export class Tray {
  private readonly _slots: TraySlot[];
  private _expanded = false;
  /** Still-needed colour counts; index 1..10 (0 unused). */
  private readonly _needed: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  constructor(baseSlots: number = TRAY_BASE_SLOTS) {
    this._slots = [];
    for (let i = 0; i < baseSlots; i++) this._slots.push({ state: 'free', colorIdx: 0 });
  }

  get capacity(): number {
    return this._slots.length;
  }

  get expanded(): boolean {
    return this._expanded;
  }

  slot(index: number): TraySlot | undefined {
    return this._slots[index];
  }

  /** Unlock the dashed expansion row (per-level only; reset() reverts, A1). */
  expand(): boolean {
    if (this._expanded) return false;
    this._expanded = true;
    for (let i = 0; i < TRAY_EXPAND_SLOTS; i++) {
      this._slots.push({ state: 'free', colorIdx: 0 });
    }
    return true;
  }

  /** Whole-tray reset (S5 §2.4 item 3+4: clear beads + expansion back to base). */
  reset(): void {
    this._slots.length = TRAY_BASE_SLOTS;
    for (const slot of this._slots) {
      slot.state = 'free';
      slot.colorIdx = 0;
    }
    this._expanded = false;
    this._needed.fill(0);
  }

  // ───────────────────────────────────────────── needed-colour projection

  /** Initialise the projection from a freshly built grid (level or stage load). */
  initNeeded(counts: readonly number[]): void {
    this._needed.fill(0);
    for (let i = 0; i < counts.length && i < this._needed.length; i++) {
      this._needed[i] = counts[i] ?? 0;
    }
  }

  /** Consume one placed bead from the projection (via the `bead:placed` event). */
  consumeNeeded(colorIdx: number): void {
    if (colorIdx >= 1 && colorIdx < this._needed.length && this._needed[colorIdx] > 0) {
      this._needed[colorIdx]--;
    }
  }

  /** Read-only view: colour → still-needed count. */
  neededCount(colorIdx: number): number {
    return colorIdx >= 1 && colorIdx < this._needed.length ? this._needed[colorIdx]! : 0;
  }

  /** True when at least one colour is still needed (defensive spawn guard). */
  hasNeededColors(): boolean {
    for (let i = 1; i < this._needed.length; i++) {
      if (this._needed[i]! > 0) return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────── slot operations

  get selectedSlot(): number {
    for (let i = 0; i < this._slots.length; i++) {
      if (this._slots[i]!.state === 'selected') return i;
    }
    return -1;
  }

  get selectedColor(): number {
    const idx = this.selectedSlot;
    return idx >= 0 ? this._slots[idx]!.colorIdx : 0;
  }

  get holdingCount(): number {
    let n = 0;
    for (const slot of this._slots) {
      if (slot.state !== 'free') n++;
    }
    return n;
  }

  get freeCount(): number {
    return this._slots.length - this.holdingCount;
  }

  /**
   * Select / re-select a holding slot. Idempotent on the same slot (core-loop
   * §6: double-tap = re-select, no repeated event). @returns the outcome so
   * the caller knows whether to broadcast `tray:selected`.
   */
  select(slotIndex: number): SelectResult {
    const slot = this._slots[slotIndex];
    if (!slot || slot.state === 'free') return 'invalid';
    if (slot.state === 'selected') return 'already-selected';
    const prev = this.selectedSlot;
    if (prev >= 0) this._slots[prev]!.state = 'holding';
    slot.state = 'selected';
    return 'selected';
  }

  /** Put a spawned bead into a free slot. Returns false when occupied/void. */
  spawnInto(slotIndex: number, colorIdx: number): boolean {
    const slot = this._slots[slotIndex];
    if (!slot || slot.state !== 'free') return false;
    slot.state = 'holding';
    slot.colorIdx = colorIdx;
    return true;
  }

  /**
   * First free slot index ≥ `from`, or -1. (The *random* choice lives in the
   * spawner — this is only a linear scan helper.)
   */
  firstFree(from = 0): number {
    for (let i = from; i < this._slots.length; i++) {
      if (this._slots[i]!.state === 'free') return i;
    }
    return -1;
  }

  /**
   * A bead left the tray (placement accepted / powerup cleared). Selected state
   * clears together with the bead (tray-spawner §2.4).
   */
  takeBead(slotIndex: number): boolean {
    const slot = this._slots[slotIndex];
    if (!slot || slot.state === 'free') return false;
    slot.state = 'free';
    slot.colorIdx = 0;
    return true;
  }

  /** Clear specific slots (S6 `powerup:used` exit; name-compatible reserve). */
  clearSlots(slotIndices: readonly number[]): number[] {
    const cleared: number[] = [];
    for (const i of slotIndices) {
      if (this.takeBead(i)) cleared.push(i);
    }
    return cleared;
  }
}
