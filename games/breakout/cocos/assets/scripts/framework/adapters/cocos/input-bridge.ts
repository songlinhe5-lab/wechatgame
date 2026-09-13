/**
 * Cocos input bridge (pure).
 *
 * Cocos delivers `EventTouch` / `EventMouse` objects whose coordinate space and
 * accessor names are editor-version specific. Rather than guess, this bridge
 * accepts *already-normalised* `RawPointerInput` values; the untestable part
 * (reading the Cocos event) is confined to `bindings.ts` and listed in
 * docs/engine-reference/cocos/VERSION.md.
 *
 * Keeping the phase/timestamp logic here means it is fully unit-testable.
 */

import type { InputManager, PointerPhase, PointerSample } from '../../core/input/input-manager.js';

export interface RawPointerInput {
  /** Touch id (>=1) or 0 for the mouse. */
  readonly id: number;
  /** Screen-space X in CSS pixels (top-left origin). */
  readonly x: number;
  /** Screen-space Y in CSS pixels (top-left origin). */
  readonly y: number;
}

export interface CocosInputBridgeOptions {
  readonly now: () => number;
  /**
   * Optional coordinate remap. Use to convert Cocos UI-space (bottom-left
   * origin, design units) into the framework's top-left screen pixels.
   */
  readonly mapPoint?: (x: number, y: number) => { x: number; y: number };
}

export class CocosInputBridge {
  constructor(
    private readonly _input: InputManager,
    private readonly _options: CocosInputBridgeOptions,
  ) {}

  onTouchStart(raw: RawPointerInput): void {
    this._push(raw, 'down');
  }

  onTouchMove(raw: RawPointerInput): void {
    this._push(raw, 'move');
  }

  onTouchEnd(raw: RawPointerInput): void {
    this._push(raw, 'up');
  }

  onTouchCancel(raw: RawPointerInput): void {
    this._push(raw, 'cancel');
  }

  /** Convenience for the four `Node.EventType` touch handlers. */
  handle(phase: PointerPhase, raw: RawPointerInput): void {
    this._push(raw, phase);
  }

  private _push(raw: RawPointerInput, phase: PointerPhase): void {
    const mapped = this._options.mapPoint ? this._options.mapPoint(raw.x, raw.y) : raw;
    const sample: PointerSample = {
      id: raw.id,
      x: mapped.x,
      y: mapped.y,
      phase,
      time: this._options.now(),
    };
    this._input.push(sample);
  }
}
