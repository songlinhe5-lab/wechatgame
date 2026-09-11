/**
 * Scalar math helpers.
 *
 * These are the workhorses of the framework's hot paths (gameplay update,
 * collision resolution, UI layout). They are branch-light, allocation-free and
 * side-effect free so they can be inlined by the JIT and safely called per
 * frame (see docs/architecture/control-manifest.md → "zero-allocation hot
 * paths").
 */

/** Clamp `v` into the closed interval [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/** Clamp `v` into [0, 1]. */
export function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** Linear interpolation. `t` is not clamped. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Position of `v` inside [a, b] expressed as 0..1.
 * Returns `fallback` when `a === b` (defaults to 0) to avoid NaN.
 */
export function inverseLerp(a: number, b: number, v: number, fallback = 0): number {
  if (a === b) return fallback;
  return (v - a) / (b - a);
}

/** Clamped inverse lerp — the safe companion to {@link lerp}. */
export function inverseLerpClamped(a: number, b: number, v: number, fallback = 0): number {
  return clamp01(inverseLerp(a, b, v, fallback));
}

/** Re-map `v` from one range to another. Result is clamped to the output range. */
export function remap(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, inverseLerpClamped(inMin, inMax, v));
}

/** Move `current` toward `target` by at most `delta` (never overshoots). */
export function approach(current: number, target: number, delta: number): number {
  const d = target - current;
  if (Math.abs(d) <= delta) return target;
  return current + Math.sign(d) * delta;
}

/** Frame-rate independent exponential smoothing. `halfLife` is in seconds. */
export function damp(current: number, target: number, halfLife: number, dt: number): number {
  if (halfLife <= 0) return target;
  const t = 1 - Math.pow(2, -dt / halfLife);
  return current + (target - current) * t;
}

/** Smooth Hermite interpolation between two edges. */
export function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = clamp01(inverseLerp(edge0, edge1, v));
  return t * t * (3 - 2 * t);
}

/** -1, 0 or 1. */
export function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Wrap `v` into [min, max). Returns `min` if the range is degenerate. */
export function wrap(v: number, min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return min;
  return min + (((v - min) % range) + range) % range;
}

/** Half-open float comparison tolerant to FP error. */
export function approxEqual(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(a - b) <= epsilon;
}

/** Round to `decimals` places — used when preparing values for snapshot tests. */
export function round(v: number, decimals = 0): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}
