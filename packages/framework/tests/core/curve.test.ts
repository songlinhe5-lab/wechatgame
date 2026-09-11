import { describe, expect, it } from 'vitest';
import { Curve, Easings, ease, requireEase } from '../../src/core/math/curve.js';

describe('Curve / easing', () => {
  it('exposes standard easing endpoints', () => {
    for (const [name, fn] of Object.entries(Easings)) {
      if (name === 'step') continue;
      expect(fn(0), `${name}(0)`).toBeCloseTo(0, 6);
      expect(fn(1), `${name}(1)`).toBeCloseTo(1, 6);
    }
  });

  it('ease() falls back to linear for unknown names', () => {
    expect(ease('nope', 0.5)).toBe(0.5);
    expect(ease('linear', 0.25)).toBe(0.25);
  });

  it('requireEase throws for unknown names', () => {
    expect(() => requireEase('nope')).toThrow(/Unknown easing/);
    expect(requireEase('easeOutQuad')).toBeTypeOf('function');
  });

  it('rejects an empty key list', () => {
    expect(() => new Curve([])).toThrow(/at least one key/);
  });

  it('clamps outside the key range and interpolates inside', () => {
    const curve = new Curve([
      { t: 0, v: 0 },
      { t: 1, v: 10 },
    ]);
    expect(curve.sample(-1)).toBe(0);
    expect(curve.sample(0.5)).toBeCloseTo(5, 6);
    expect(curve.sample(2)).toBe(10);
  });

  it('sorts keys and honours per-segment easing', () => {
    const curve = new Curve([
      { t: 0.5, v: 5 },
      { t: 0, v: 0, ease: 'easeInQuad' },
      { t: 1, v: 10 },
    ]);
    // easeInQuad(0.5) = 0.25 → 0 + 5*0.25
    expect(curve.sample(0.25)).toBeCloseTo(1.25, 6);
  });

  it('samples a constant curve', () => {
    const c = Curve.constant(3);
    expect(c.sample(0)).toBe(3);
    expect(c.sample(1)).toBe(3);
  });

  it('sampleRange maps an arbitrary domain onto [0,1]', () => {
    const curve = new Curve([
      { t: 0, v: 0 },
      { t: 1, v: 100 },
    ]);
    expect(curve.sampleRange(50, 0, 100)).toBeCloseTo(50, 6);
    expect(curve.sampleRange(0, 10, 10)).toBe(0); // degenerate domain
  });
});
