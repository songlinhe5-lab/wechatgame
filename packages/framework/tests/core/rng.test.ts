import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../../src/core/math/rng.js';

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng('breakout');
    const b = createRng('breakout');
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    expect(createRng('a').next()).not.toBe(createRng('b').next());
  });

  it('hashes numeric and string seeds to uint32', () => {
    expect(hashSeed('x')).toBe(hashSeed('x'));
    expect(hashSeed('x')).not.toBe(hashSeed('y'));
    expect(hashSeed(12.7)).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hashSeed(-5))).toBe(true);
  });

  it('next() stays in [0, 1)', () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('float/int stay within bounds and int is inclusive', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const f = rng.float(-2, 2);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(2);
      const n = rng.int(1, 6);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('int() tolerates swapped bounds', () => {
    const rng = createRng(1);
    const n = rng.int(10, 5);
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(10);
  });

  it('bool respects probability extremes', () => {
    const rng = createRng(3);
    expect(rng.bool(1)).toBe(true);
    expect(rng.bool(0)).toBe(false);
  });

  it('pick throws on empty arrays and returns members otherwise', () => {
    const rng = createRng(9);
    expect(() => rng.pick([])).toThrow(/empty/);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 20; i++) expect(items).toContain(rng.pick(items));
  });

  it('shuffle permutes in place and preserves membership', () => {
    const rng = createRng(11);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = rng.shuffle(items);
    expect(out).toBe(items); // in place
    expect([...out].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('forks into independent but reproducible children', () => {
    const parent1 = createRng('root');
    const parent2 = createRng('root');
    const c1 = parent1.fork('wave');
    const c2 = parent2.fork('wave');
    expect(c1.next()).toBe(c2.next());
    // A fork differs from its parent's own stream.
    expect(createRng('root').fork('wave').next()).not.toBe(createRng('root').next());
  });

  it('exposes an advancing, serialisable state', () => {
    const rng = createRng(5);
    const before = rng.state;
    rng.next();
    expect(rng.state).not.toBe(before);
    expect(Number.isInteger(rng.state)).toBe(true);
    expect(rng.state).toBeGreaterThanOrEqual(0);
  });
});
