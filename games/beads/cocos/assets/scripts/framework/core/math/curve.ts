/**
 * Easing functions and keyframe curves.
 *
 * Curves are data: designers author keyframes in level/tuning data, the runtime
 * samples them. Nothing here allocates during `sample()`.
 */

/** Normalised easing function: maps t∈[0,1] to an eased t∈[0,1]. */
export type EasingFn = (t: number) => number;

const PI = Math.PI;

export const Easings: Readonly<Record<string, EasingFn>> = Object.freeze({
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeInSine: (t) => 1 - Math.cos((t * PI) / 2),
  easeOutSine: (t) => Math.sin((t * PI) / 2),
  easeInOutSine: (t) => -(Math.cos(PI * t) - 1) / 2,
  easeOutBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  easeOutElastic: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * PI) / 3)) + 1,
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  /** Constant-zero; handy as a null object in data. */
  step: () => 0,
  /** Instant jump to 1 once t>0 — used for `step end` keyframes. */
  jump: (t) => (t > 0 ? 1 : 0),
});

/** Look up an easing by name, falling back to `linear` for unknown names. */
export function ease(name: string, t: number): number {
  const fn = Easings[name] ?? Easings['linear']!;
  return fn(t);
}

/** Look up an easing by name, throwing on unknown names (data-validation path). */
export function requireEase(name: string): EasingFn {
  const fn = Easings[name];
  if (!fn) throw new Error(`Unknown easing "${name}"`);
  return fn;
}

export interface CurveKey {
  /** Normalised time in [0, 1]; keys are sorted on construction. */
  readonly t: number;
  readonly v: number;
  /** Easing applied on the segment that *starts* at this key. Default `linear`. */
  readonly ease?: string;
}

/**
 * Piecewise curve sampler over normalised time.
 *
 * ```ts
 * const pop = new Curve([{ t: 0, v: 0 }, { t: 0.3, v: 1.4, ease: 'easeOutBack' }, { t: 1, v: 1 }]);
 * pop.sample(0.3); // 1.4
 * ```
 */
export class Curve {
  readonly keys: readonly CurveKey[];

  constructor(keys: readonly CurveKey[]) {
    if (keys.length === 0) throw new Error('Curve requires at least one key');
    this.keys = [...keys].sort((a, b) => a.t - b.t);
  }

  /** A flat curve returning `v` everywhere. */
  static constant(v: number): Curve {
    return new Curve([{ t: 0, v }]);
  }

  /**
   * Sample at normalised time `t`. `t` is clamped to [0, 1] and the value is
   * linearly interpolated inside the surrounding segment, with that segment's
   * easing applied.
   */
  sample(t: number): number {
    const keys = this.keys;
    const first = keys[0]!;
    const last = keys[keys.length - 1]!;
    if (t <= first.t) return first.v;
    if (t >= last.t) return last.v;

    // Linear scan: key counts are small (typically < 8) and this keeps the
    // sampler allocation-free and branch-predictable.
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1]!.t <= t) i++;

    const a = keys[i]!;
    const b = keys[i + 1]!;
    const span = b.t - a.t;
    if (span <= 0) return b.v;
    const localT = (t - a.t) / span;
    const eased = a.ease ? ease(a.ease, localT) : localT;
    return a.v + (b.v - a.v) * eased;
  }

  /** Sample a curve defined over an arbitrary domain, not just [0,1]. */
  sampleRange(input: number, inMin: number, inMax: number): number {
    const t = inMax === inMin ? 0 : (input - inMin) / (inMax - inMin);
    return this.sample(t);
  }
}
