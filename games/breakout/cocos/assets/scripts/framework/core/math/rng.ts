/**
 * Deterministic pseudo-random number generation.
 *
 * Gameplay must be *reproducible*: given the same seed and the same sequence
 * of inputs, a session must produce byte-identical state. That property is what
 * makes gameplay unit tests (and future replay/anti-cheat validation) possible.
 *
 * Do NOT use `Math.random()` anywhere under `src/core` or `games/<game>/src`.
 * Use an `Rng` from `createRng(seed)` instead. See control-manifest.md.
 */

export interface Rng {
  /** Raw uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** True with probability `p` (default 0.5). */
  bool(p?: number): boolean;
  /** Uniform pick from a non-empty array. Throws on empty input. */
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates shuffle, in place. Returns the same array for chaining. */
  shuffle<T>(items: T[]): T[];
  /** Derive an independent, deterministically-seeded child generator. */
  fork(salt?: string | number): Rng;
  /** Serialisable state so saves can persist the exact stream position. */
  readonly state: number;
}

/** 32-bit string hash (FNV-1a). Stable across runs and platforms. */
export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') {
    // Fold into uint32 without losing entropy from negative/float inputs.
    return Math.floor(Math.abs(seed)) >>> 0;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Create a deterministic generator (mulberry32).
 *
 * mulberry32 is chosen for the framework because it is tiny, allocation-free,
 * has a period of 2^32 and passes the usual smoke tests for game randomness
 * (loot rolls, particle jitter). It is *not* cryptographically secure and must
 * never be used for security decisions.
 */
export function createRng(seed: string | number): Rng {
  let s = hashSeed(seed) || 0x9e3779b9;

  const factory = (initial: number): Rng => {
    let state = initial >>> 0;
    const rng: Rng = {
      next(): number {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      float(min: number, max: number): number {
        return min + rng.next() * (max - min);
      },
      int(min: number, max: number): number {
        if (max < min) [min, max] = [max, min];
        return Math.floor(rng.float(min, max + 1));
      },
      bool(p = 0.5): boolean {
        return rng.next() < p;
      },
      pick<T>(items: readonly T[]): T {
        if (items.length === 0) throw new Error('Rng.pick: empty array');
        return items[rng.int(0, items.length - 1)]!;
      },
      shuffle<T>(items: T[]): T[] {
        for (let i = items.length - 1; i > 0; i--) {
          const j = rng.int(0, i);
          const tmp = items[i]!;
          items[i] = items[j]!;
          items[j] = tmp;
        }
        return items;
      },
      fork(salt: string | number = ''): Rng {
        return factory((state ^ hashSeed(String(salt))) >>> 0);
      },
      get state(): number {
        return state;
      },
    };
    return rng;
  };

  return factory(s);
}
