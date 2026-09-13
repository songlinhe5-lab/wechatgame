/**
 * Input abstraction.
 *
 * Engine code (Cocos, DOM) converts native events into {@link PointerSample}s
 * and feeds them to {@link InputManager}. Gameplay reads a per-frame
 * {@link InputSnapshot} — a plain, frozen description of what the player is
 * doing — and never touches engine event objects. This is what lets the same
 * paddle logic run under Cocos touches, DOM mouse and synthetic test input.
 *
 * Coordinates are always *screen* coordinates in CSS pixels; the `Viewport`
 * converts them to design space.
 */

export type PointerPhase = 'down' | 'move' | 'up' | 'cancel';

export interface PointerSample {
  /** Numeric pointer id; mouse is 0, touches are >= 1. */
  readonly id: number;
  /** Raw screen-space position in CSS pixels. */
  readonly x: number;
  readonly y: number;
  readonly phase: PointerPhase;
  /** Timestamp in milliseconds (monotonic). */
  readonly time: number;
}

/** Per-frame, read-only view of pointer state. */
export interface InputSnapshot {
  /** A pointer is currently held down. */
  readonly isDown: boolean;
  /** A pointer went down during this frame. */
  readonly justDown: boolean;
  /** A pointer was released during this frame. */
  readonly justUp: boolean;
  /** Current position, in screen pixels. */
  readonly x: number;
  readonly y: number;
  /** Delta since the previous frame, in screen pixels. */
  readonly dx: number;
  readonly dy: number;
  /** Seconds the current press has been held (0 when not down). */
  readonly holdTime: number;
}

const EMPTY: InputSnapshot = Object.freeze({
  isDown: false,
  justDown: false,
  justUp: false,
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
  holdTime: 0,
});

/**
 * Collects pointer samples and produces per-frame snapshots.
 *
 * Usage inside the game loop:
 * ```ts
 * input.beginFrame();          // move last frame's state into `previous`
 * input.push(sample);          // zero or more native events this frame
 * const snap = input.snapshot; // read during game.update()
 * input.endFrame();            // clear one-shot flags
 * ```
 */
export class InputManager {
  private _isDown = false;
  private _prevDown = false;
  private _downThisFrame = false;
  private _upThisFrame = false;
  private _x = 0;
  private _y = 0;
  private _prevX = 0;
  private _prevY = 0;
  private _downAt = 0;
  private _holdTime = 0;
  private _snapshot: InputSnapshot = EMPTY;
  /** The pointer id that owns the current gesture (first pointer down wins). */
  private _ownerId: number | null = null;

  get isDown(): boolean {
    return this._isDown;
  }

  get position(): { x: number; y: number } {
    return { x: this._x, y: this._y };
  }

  /** Feed one native pointer event. */
  push(sample: PointerSample): void {
    switch (sample.phase) {
      case 'down':
        // Ignore secondary touches: breakout-style games use one pointer.
        if (this._ownerId === null) {
          this._ownerId = sample.id;
          this._isDown = true;
          this._downThisFrame = true;
          this._downAt = sample.time;
          this._holdTime = 0;
          this._x = sample.x;
          this._y = sample.y;
        }
        break;
      case 'move':
        if (sample.id === this._ownerId) {
          this._x = sample.x;
          this._y = sample.y;
        }
        break;
      case 'up':
      case 'cancel':
        if (sample.id === this._ownerId) {
          this._x = sample.x;
          this._y = sample.y;
          this._isDown = false;
          this._upThisFrame = true;
          this._ownerId = null;
        }
        break;
    }
  }

  /** Snapshot current state before applying this frame's samples. */
  beginFrame(): void {
    this._prevDown = this._isDown;
    this._prevX = this._x;
    this._prevY = this._y;
    // NOTE: intentionally does NOT clear `_downThisFrame` / `_upThisFrame`.
    // On event-driven hosts (Cocos) native input arrives *between* frames —
    // after the previous `endFrame` and before the next `beginFrame` — so
    // clearing here would wipe `justDown` before gameplay ever reads it
    // (tap-to-launch never fired in the Cocos preview; fixed 2026-09-13).
    // `endFrame` owns the one-shot flag lifecycle; synchronous hosts that push
    // after `beginFrame` are unaffected.
  }

  /** Build the immutable snapshot for gameplay to read. */
  get snapshot(): InputSnapshot {
    const justDown = this._downThisFrame;
    const justUp = this._upThisFrame || (!this._isDown && this._prevDown);
    const dx = this._x - this._prevX;
    const dy = this._y - this._prevY;
    this._snapshot = Object.freeze({
      isDown: this._isDown,
      justDown,
      justUp,
      x: this._x,
      y: this._y,
      dx,
      dy,
      holdTime: this._isDown ? this._holdTime : 0,
    });
    return this._snapshot;
  }

  /** Advance hold timers and clear one-shot flags. Call at the end of the tick. */
  endFrame(dt: number): void {
    if (this._isDown) this._holdTime += dt;
    this._downThisFrame = false;
    this._upThisFrame = false;
  }

  /** Drop all state (e.g. when a scene loses focus on WeChat hide). */
  reset(): void {
    this._isDown = false;
    this._prevDown = false;
    this._downThisFrame = false;
    this._upThisFrame = false;
    this._ownerId = null;
    this._holdTime = 0;
    this._snapshot = EMPTY;
  }

  /** Milliseconds timestamp of the current press, or 0 when not pressed. */
  get downTimestamp(): number {
    return this._isDown ? this._downAt : 0;
  }
}
