/**
 * Modal open/close state machine (ADR-0032 DEC-3).
 *
 * `closed → opening → open → closing → closed`, exposing a 0..1 progress driven
 * by `dt`. Duration is passed in by the caller (panels stop owning their own
 * `PANEL_IN_MS` timers). Reversing mid-flight continues from the current
 * progress, so a close during open (or vice versa) never jumps.
 *
 * Scalar-only: no allocation, safe to `update()` every frame.
 */

export type ModalPhase = 'closed' | 'opening' | 'open' | 'closing';

export class ModalLifecycle {
  private _phase: ModalPhase = 'closed';
  private _progress = 0;
  private _durationMs = 0;

  get phase(): ModalPhase {
    return this._phase;
  }

  /** 0 = fully hidden, 1 = fully shown. Meaningful during `opening` / `closing`. */
  get progress(): number {
    return this._progress;
  }

  /** `durationMs <= 0` completes immediately. Re-entrant calls are no-ops. */
  open(durationMs: number): void {
    if (this._phase === 'open' || this._phase === 'opening') return;
    this._durationMs = durationMs > 0 ? durationMs : 0;
    if (this._durationMs === 0) {
      this._phase = 'open';
      this._progress = 1;
      return;
    }
    this._phase = 'opening';
  }

  /** Same contract as {@link open}; reversing an opening modal plays backwards. */
  close(durationMs: number): void {
    if (this._phase === 'closed' || this._phase === 'closing') return;
    this._durationMs = durationMs > 0 ? durationMs : 0;
    if (this._durationMs === 0) {
      this._phase = 'closed';
      this._progress = 0;
      return;
    }
    this._phase = 'closing';
  }

  /** Hard-hide: back to `closed` at progress 0 regardless of phase (dispose/reset). */
  reset(): void {
    this._phase = 'closed';
    this._progress = 0;
    this._durationMs = 0;
  }

  update(dtMs: number): void {
    if (this._phase !== 'opening' && this._phase !== 'closing') return;
    const step = (dtMs > 0 ? dtMs : 0) / this._durationMs;
    if (this._phase === 'opening') {
      this._progress += step;
      if (this._progress >= 1) {
        this._progress = 1;
        this._phase = 'open';
      }
    } else {
      this._progress -= step;
      if (this._progress <= 0) {
        this._progress = 0;
        this._phase = 'closed';
      }
    }
  }
}
