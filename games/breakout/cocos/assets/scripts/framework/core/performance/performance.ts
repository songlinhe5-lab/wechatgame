/**
 * Runtime performance snapshot (WXG-T-414).
 *
 * All values are optional — not every host can produce every metric. WeChat
 * gives us `wx.getPerformance()` (foundation 2.11.0+), while web/node hosts
 * can only approximate FPS from their own loop and know nothing of JS heap.
 *
 * The snapshot is a **pull** model: the game shell calls
 * `services.getPerformance?.()` at its own cadence (e.g. every 10 s or on
 * pause) rather than the platform pushing events. This matches the
 * telemetry use case — we want a periodic "how's the run?" sample, not a
 * flood of per-frame updates.
 */

export interface PerformanceSnapshot {
  /**
   * Frames per second over the last sample window (weapp/web) or null if
   * the host cannot measure. Derived from wall-clock frame deltas.
   */
  readonly fps: number | null;
  /**
   * JS heap used in bytes (weapp `performance.memory.usedJSHeapSize`).
   * null on hosts with no memory introspection.
   */
  readonly heapBytesUsed: number | null;
  /** JS heap size in bytes (weapp only). */
  readonly heapBytesTotal: number | null;
  /**
   * Number of fixed-step loop frames whose wall-clock delta was clamped
   * during this session (spiral-of-death protection). High values correlate
   * with GC pauses or backgrounding. Derived from `FixedStepLoop.clampedFrames`.
   */
  readonly clampedFrames: number;
  /** Total fixed-step ticks executed during this session. */
  readonly ticks: number;
  /** Wall-clock seconds the loop has been running. */
  readonly loopTimeSeconds: number;
  /** Host-reported preferred frame rate (weapp via `setPreferredFramesPerSecond`). */
  readonly targetFps: number;
  /** True when the host dropped below target FPS for the last sample window. */
  readonly frameBudgetMiss: boolean;
}

/**
 * Compute FPS from a circular buffer of recent frame deltas.
 * exported for tests — hosts keep their own buffers; we just provide math.
 */
export function computeFps(deltasSeconds: readonly number[]): number {
  if (deltasSeconds.length === 0) return 0;
  const sum = deltasSeconds.reduce((a, b) => a + b, 0);
  if (sum <= 0 || !Number.isFinite(sum)) return 0;
  return deltasSeconds.length / sum;
}
