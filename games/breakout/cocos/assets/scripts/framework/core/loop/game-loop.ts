/**
 * Fixed-timestep game loop.
 *
 * Physics and gameplay run at a *fixed* dt (default 1/60 s). This is
 * non-negotiable for a deterministic game: variable-dt integration makes a ball
 * bounce differently on a 120 Hz iPad than on a 60 Hz Android, which breaks both
 * fairness and unit tests. Rendering gets an interpolation `alpha` so motion
 * still looks smooth when the display rate differs from the tick rate.
 *
 * The loop is a pure accumulator — it has no timers and no engine dependency —
 * so a test can drive 10 simulated seconds in a single `advance(10)` call.
 */

export interface LoopCallbacks {
  /** Advance simulation by exactly `dt` seconds. */
  fixedUpdate(dt: number): void;
  /**
   * Draw the frame. `alpha` ∈ [0,1] is how far the current render time sits
   * between the previous and next fixed step (for interpolation).
   */
  render(alpha: number): void;
}

export interface FixedStepLoopOptions {
  /** Seconds per fixed step. Default 1/60. */
  readonly fixedDt?: number;
  /**
   * Maximum number of fixed steps executed for one `advance()` call. Prevents
   * the "spiral of death" after a long stall (WeChat backgrounding, GC pause)
   * by capping catch-up work; surplus time is discarded.
   */
  readonly maxSubSteps?: number;
  /**
   * Maximum wall-clock frame delta accepted, in seconds. Anything larger is
   * clamped before accumulation (default 0.25 s).
   */
  readonly maxFrameTime?: number;
}

export class FixedStepLoop {
  readonly fixedDt: number;
  readonly maxSubSteps: number;
  readonly maxFrameTime: number;

  private _accumulator = 0;
  private _time = 0;
  private _ticks = 0;
  private _clampedFrames = 0;

  constructor(private readonly _callbacks: LoopCallbacks, options: FixedStepLoopOptions = {}) {
    this.fixedDt = options.fixedDt ?? 1 / 60;
    this.maxSubSteps = options.maxSubSteps ?? 5;
    this.maxFrameTime = options.maxFrameTime ?? 0.25;
    if (this.fixedDt <= 0) throw new Error('FixedStepLoop: fixedDt must be > 0');
  }

  /** Total simulated time in seconds (excludes discarded catch-up time). */
  get time(): number {
    return this._time;
  }

  /** Number of fixed steps executed since construction. */
  get ticks(): number {
    return this._ticks;
  }

  /** Frames whose delta was clamped (stall detection / telemetry). */
  get clampedFrames(): number {
    return this._clampedFrames;
  }

  /** Seconds accumulated but not yet consumed by a fixed step. */
  get pendingTime(): number {
    return this._accumulator;
  }

  /** Interpolation factor for the most recent frame. */
  get alpha(): number {
    return this._accumulator / this.fixedDt;
  }

  /**
   * Advance the simulation by `frameDt` wall-clock seconds.
   * @returns the number of fixed steps executed.
   */
  advance(frameDt: number): number {
    let dt = frameDt;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (dt > this.maxFrameTime) {
      dt = this.maxFrameTime;
      this._clampedFrames++;
    }
    this._accumulator += dt;

    let steps = 0;
    while (this._accumulator >= this.fixedDt && steps < this.maxSubSteps) {
      this._callbacks.fixedUpdate(this.fixedDt);
      this._accumulator -= this.fixedDt;
      this._time += this.fixedDt;
      this._ticks++;
      steps++;
    }

    // If we hit the sub-step cap we are hopelessly behind; drop the backlog
    // rather than stutter forever.
    if (steps === this.maxSubSteps && this._accumulator >= this.fixedDt) {
      this._accumulator %= this.fixedDt;
    }

    this._callbacks.render(this.alpha);
    return steps;
  }

  /** Clear accumulated time (e.g. after the player returns from background). */
  reset(): void {
    this._accumulator = 0;
  }
}
