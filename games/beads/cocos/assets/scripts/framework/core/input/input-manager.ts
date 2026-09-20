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
  /**
   * Second-pointer (pinch) state — WXG-T-169 / ADR-0015 甲′. Only two pointers
   * are tracked; a third finger is ignored. Owner fields above keep identical
   * single-pointer semantics, so breakout-style games are unaffected.
   * Deliberately no `justDown2`/`justUp2`: gameplay derives gesture edges from
   * `isDown2` across frames.
   */
  readonly isDown2: boolean;
  /** Second pointer position / per-frame delta, in screen pixels. */
  readonly x2: number;
  readonly y2: number;
  readonly dx2: number;
  readonly dy2: number;
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
  isDown2: false,
  x2: 0,
  y2: 0,
  dx2: 0,
  dy2: 0,
});

/**
 * Collects pointer samples and produces per-frame snapshots.
 *
 * Usage inside the game loop (one *fixed step* == one input frame):
 * ```ts
 * input.beginFrame();          // frame marker (no state churn; see WXG-T-167)
 * input.push(sample);          // zero or more native events since last step
 * const snap = input.snapshot; // read during game.update()
 * input.endFrame(dt);          // advance timers + clear one-shot flags + settle prev state
 * ```
 *
 * Samples may be pushed **between** steps (event-driven Cocos host) or right
 * after `beginFrame` (synchronous hosts) — both yield the same per-step deltas,
 * because `prev` is advanced at the end of each fixed step, not the start.
 *
 * The framework `App` runs `beginFrame → game.update → endFrame` **per fixed
 * substep** (see `compose/app.ts::_fixedUpdate`), not once per rendered tick: a
 * dropped frame makes `loop.advance()` run several substeps, and each substep
 * must see a one-shot down/up **exactly once** (input-control §8-3/§8-10).
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
  // Second-pointer (pinch) slot — flat scalars, no array/object, mirroring
  // ADR-0014's "scalar not object" hot-path rule (WXG-T-169 / ADR-0015 甲′).
  private _id2: number | null = null;
  private _isDown2 = false;
  private _x2 = 0;
  private _y2 = 0;
  private _prevX2 = 0;
  private _prevY2 = 0;

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
        // Slot 0 = owner (single-pointer semantics unchanged from before).
        if (this._ownerId === null) {
          this._ownerId = sample.id;
          this._isDown = true;
          this._downThisFrame = true;
          this._downAt = sample.time;
          this._holdTime = 0;
          this._x = sample.x;
          this._y = sample.y;
        } else if (sample.id !== this._ownerId && this._id2 === null) {
          // Slot 1 = second distinct pointer (pinch). No justDown (owner-only).
          this._id2 = sample.id;
          this._isDown2 = true;
          this._x2 = sample.x;
          this._y2 = sample.y;
          this._prevX2 = sample.x;
          this._prevY2 = sample.y;
        }
        break;
      case 'move':
        if (sample.id === this._ownerId) {
          this._x = sample.x;
          this._y = sample.y;
        } else if (sample.id === this._id2) {
          this._x2 = sample.x;
          this._y2 = sample.y;
        }
        break;
      case 'up':
      case 'cancel':
        if (sample.id === this._ownerId) {
          this._x = sample.x;
          this._y = sample.y;
          this._isDown = false;
          this._upThisFrame = true;
          // Do NOT promote the second pointer to owner (ADR-0015 §3.2-3): that
          // would misread the tail of a pinch as a single-finger drag (甩图).
          // Slot 1 keeps its own id/down until it lifts on its own.
          this._ownerId = null;
        } else if (sample.id === this._id2) {
          this._x2 = sample.x;
          this._y2 = sample.y;
          this._isDown2 = false;
          this._id2 = null;
        }
        break;
    }
  }

  /**
   * Frame boundary marker. It intentionally does **nothing** since WXG-T-167:
   * prev-state used to be advanced *here*, i.e. before `game.update()` read the
   * snapshot. That is wrong for event-driven hosts (Cocos / WeChat), where the
   * native `touch-move` arrives **between** fixed steps — after the previous
   * `endFrame` and before this `beginFrame`. By then `_x` already holds the new
   * position, so `_prevX = _x` collapsed the delta to `0` and gameplay saw
   * `dx === dy === 0` for every drag frame (device symptom: pinch zooms, the
   * board never pans — reported on real devices 2026-09-19; regression hook =
   * `tests/core/input-manager.test.ts` “move arrives between fixed steps”).
   * Advancing now happens in {@link endFrame}, once per fixed step, so event
   * driven and synchronous hosts share one semantics.
   *
   * One-shot flags are still cleared by `endFrame` (never here), for the reason
   * documented there (fix of 2026-09-13: clearing here wiped `justDown`).
   */
  beginFrame(): void {
    /* no-op: prev state is settled in endFrame */
  }

  /** Build the immutable snapshot for gameplay to read. */
  get snapshot(): InputSnapshot {
    const justDown = this._downThisFrame;
    const justUp = this._upThisFrame || (!this._isDown && this._prevDown);
    const dx = this._x - this._prevX;
    const dy = this._y - this._prevY;
    const dx2 = this._x2 - this._prevX2;
    const dy2 = this._y2 - this._prevY2;
    this._snapshot = Object.freeze({
      isDown: this._isDown,
      justDown,
      justUp,
      x: this._x,
      y: this._y,
      dx,
      dy,
      holdTime: this._isDown ? this._holdTime : 0,
      isDown2: this._isDown2,
      x2: this._x2,
      y2: this._y2,
      dx2,
      dy2,
    });
    return this._snapshot;
  }

  /**
   * Advance hold timers and clear the one-shot flags.
   *
   * Call at the end of **each fixed step** (right after `game.update()`), not
   * once per rendered tick: the `App` may run several fixed substeps in a single
   * tick after a dropped frame, and clearing only at the tick boundary would let
   * every substep re-read the same tap (`input-control` §8-3/§8-10).
   */
  endFrame(dt: number): void {
    if (this._isDown) this._holdTime += dt;
    this._downThisFrame = false;
    this._upThisFrame = false;
    // 帧末结算：本帧被读过的位置成为下一帧的基准（一固定步 = 一输入帧）。
    this._prevDown = this._isDown;
    this._prevX = this._x;
    this._prevY = this._y;
    this._prevX2 = this._x2;
    this._prevY2 = this._y2;
  }

  /** Drop all state (e.g. when a scene loses focus on WeChat hide). */
  reset(): void {
    this._isDown = false;
    this._prevDown = false;
    this._downThisFrame = false;
    this._upThisFrame = false;
    this._ownerId = null;
    this._holdTime = 0;
    this._id2 = null;
    this._isDown2 = false;
    this._x2 = 0;
    this._y2 = 0;
    this._prevX2 = 0;
    this._prevY2 = 0;
    this._snapshot = EMPTY;
  }

  /** Milliseconds timestamp of the current press, or 0 when not pressed. */
  get downTimestamp(): number {
    return this._isDown ? this._downAt : 0;
  }
}
