import { describe, expect, it } from 'vitest';
import {
  approxEqual,
  approach,
  clamp,
  clamp01,
  damp,
  inverseLerp,
  inverseLerpClamped,
  lerp,
  remap,
  round,
  sign,
  smoothstep,
  wrap,
} from '../../src/core/math/scalar.js';

describe('scalar', () => {
  it('clamps into range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.5)).toBe(1);
  });

  it('lerps and inverse-lerps', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 0, 0.25)).toBe(7.5);
    expect(inverseLerp(0, 10, 5)).toBe(0.5);
    expect(inverseLerpClamped(0, 10, 20)).toBe(1);
  });

  it('returns fallback from inverseLerp on a degenerate range', () => {
    expect(inverseLerp(3, 3, 9)).toBe(0);
    expect(inverseLerp(3, 3, 9, 0.75)).toBe(0.75);
    expect(Number.isNaN(inverseLerp(3, 3, 9))).toBe(false);
  });

  it('remaps between ranges', () => {
    expect(remap(5, 0, 10, 0, 100)).toBe(50);
    expect(remap(15, 0, 10, 0, 100)).toBe(100); // clamped
  });

  it('approaches a target without overshooting', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(10, 0, 3)).toBe(7);
  });

  it('damps toward a target and snaps when halfLife <= 0', () => {
    expect(damp(0, 10, 1, 1)).toBeCloseTo(5, 5);
    expect(damp(0, 10, 0, 1)).toBe(10);
    // A shorter half-life moves further in the same dt.
    expect(damp(0, 10, 0.5, 1)).toBeGreaterThan(damp(0, 10, 1, 1));
  });

  it('computes smoothstep with clamped input', () => {
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('sign and wrap behave on edge cases', () => {
    expect(sign(-3)).toBe(-1);
    expect(sign(0)).toBe(0);
    expect(sign(3)).toBe(1);
    expect(wrap(370, 0, 360)).toBe(10);
    expect(wrap(-10, 0, 360)).toBe(350);
    expect(wrap(5, 0, 0)).toBe(0);
  });

  it('compares and rounds', () => {
    expect(approxEqual(1, 1 + 1e-9)).toBe(true);
    expect(approxEqual(1, 1.1)).toBe(false);
    expect(round(3.14159, 2)).toBe(3.14);
    expect(round(3.5)).toBe(4);
  });
});
