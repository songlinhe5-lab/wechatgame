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
    /**
     * `[WXG-T-1113]` 墙钟（宿主注入 `platform.now`）。有人读过绘制成本
     * （`app.drawCostWanted`）时，每次 tick 对 `app.tick` 全程卡表并回投 `tickMs`；
     * 不注入或没人读 ⇒ 一次表都不读，release 热路径零开销。
     */
    private readonly _clock?: () => number,
  ) {
    this._tick = (dt: number) => {
      // Cocos already handles backgrounding; App.tick clamps pathological deltas.
      if (this._clock && this._app.drawCostWanted) {
        const t0 = this._clock();
        // `[WXG-T-1114]` 空档采样必须在 t0 读取后、tick 之前（口径 = 上帧渲染终点 → 本帧 tick 起点）。
        this._app.sampleIdleAt(t0);
        this._app.tick(dt);
        this._app.reportTickCost(this._clock() - t0);
      } else {
        this._app.tick(dt);
      }
      this._onFrame?.();
    };
  }

  /** Number of frames the bridge has forwarded (diagnostics). */
  start(): void {
    if (this._started) return;
    this._started = true;
    // WXG-T-122 / BD-40: the Cocos scheduler below is the ONLY frame driver.
    // `App.start()` would ALSO self-drive via `platform.requestFrame`, so every
    // wall-clock frame advanced the fixed loop twice (measured sim/wall-clock
    // ≈ 2.0, four probe rounds). `startHostDriven()` performs the same full
    // initialisation (viewport re-fit from `platform.getScreenSize()`,
    // `game.init`, onHide/onShow hookup) but leaves driving to `schedule()`.
    // If the App is already self-driving, this throws instead of silently
    // double-driving.
    this._app.startHostDriven();
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
