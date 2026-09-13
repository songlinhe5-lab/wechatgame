/**
 * Cocos frame-loop bridge (pure).
 *
 * Cocos drives updates through a `Component.schedule` callback whose first
 * argument is the frame delta in seconds. This bridge forwards those deltas to
 * the framework {@link App}, and optionally invokes a per-frame hook (the host
 * uses it to trigger the Cocos render pass).
 *
 * The scheduler is injected structurally so this file has no `cc` dependency
 * and can be unit-tested with a fake scheduler.
 */

import type { App } from '../../compose/app.js';

/** Structural view of the `Component` scheduling API. */
export interface SchedulerLike {
  schedule(callback: (dt: number) => void, interval?: number): void;
  unschedule(callback: (dt: number) => void): void;
}

export class CocosLoopBridge {
  private readonly _tick: (dt: number) => void;
  private _started = false;

  constructor(
    private readonly _app: App,
    private readonly _scheduler: SchedulerLike,
    private readonly _onFrame?: () => void,
  ) {
    this._tick = (dt: number) => {
      // Cocos already handles backgrounding; App.tick clamps pathological deltas.
      this._app.tick(dt);
      this._onFrame?.();
    };
  }

  /** Number of frames the bridge has forwarded (diagnostics). */
  start(): void {
    if (this._started) return;
    this._started = true;
    this._app.start();
    this._scheduler.schedule(this._tick, 0);
  }

  stop(): void {
    if (!this._started) return;
    this._started = false;
    this._scheduler.unschedule(this._tick);
    this._app.stop();
  }

  get started(): boolean {
    return this._started;
  }
}
