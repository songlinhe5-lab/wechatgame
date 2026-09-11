import { describe, expect, it } from 'vitest';
import { Vec2 } from '../../src/core/math/vec2.js';

describe('Vec2', () => {
  it('constructs, copies and clones', () => {
    const v = new Vec2(1, 2);
    expect([v.x, v.y]).toEqual([1, 2]);
    const c = Vec2.of(3, 4);
    v.copyFrom(c);
    expect([v.x, v.y]).toEqual([3, 4]);
    const clone = v.clone();
    clone.x = 99;
    expect(v.x).toBe(3); // clone must not alias
  });

  it('mutates in place with add/sub/scale', () => {
    const v = new Vec2(1, 1);
    expect(v.addMut({ x: 2, y: 3 })).toBe(v);
    expect([v.x, v.y]).toEqual([3, 4]);
    v.subMut({ x: 1, y: 1 });
    expect([v.x, v.y]).toEqual([2, 3]);
    v.scaleMut(2);
    expect([v.x, v.y]).toEqual([4, 6]);
  });

  it('computes length, dot, cross and distance', () => {
    const a = new Vec2(3, 4);
    expect(a.length()).toBe(5);
    expect(a.lengthSq()).toBe(25);
    expect(a.dot({ x: 1, y: 0 })).toBe(3);
    expect(a.cross({ x: 1, y: 0 })).toBe(-4);
    expect(a.distanceTo({ x: 0, y: 0 })).toBe(5);
    expect(a.distanceSqTo({ x: 0, y: 0 })).toBe(25);
  });

  it('normalises and leaves zero vectors untouched', () => {
    const a = new Vec2(3, 4).normalizeMut();
    expect(a.length()).toBeCloseTo(1, 10);
    const zero = new Vec2(0, 0).normalizeMut();
    expect([zero.x, zero.y]).toEqual([0, 0]);
  });

  it('rotates by 90 degrees', () => {
    const v = new Vec2(1, 0).rotateMut(Math.PI / 2);
    expect(v.x).toBeCloseTo(0, 10);
    expect(v.y).toBeCloseTo(1, 10);
  });

  it('reports angle', () => {
    expect(new Vec2(1, 0).angle()).toBeCloseTo(0, 10);
    expect(new Vec2(0, 1).angle()).toBeCloseTo(Math.PI / 2, 10);
  });

  it('supports zero-allocation static helpers writing into `out`', () => {
    const out = new Vec2();
    Vec2.add({ x: 1, y: 2 }, { x: 3, y: 4 }, out);
    expect([out.x, out.y]).toEqual([4, 6]);
    Vec2.sub({ x: 5, y: 5 }, { x: 1, y: 2 }, out);
    expect([out.x, out.y]).toEqual([4, 3]);
    Vec2.scale({ x: 2, y: 3 }, 3, out);
    expect([out.x, out.y]).toEqual([6, 9]);
    Vec2.lerp({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5, out);
    expect([out.x, out.y]).toEqual([5, 10]);
  });

  it('static distance helpers match instance versions', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3, y: 4 };
    expect(Vec2.distance(a, b)).toBe(5);
    expect(Vec2.distanceSq(a, b)).toBe(25);
    expect(Vec2.dot(a, b)).toBe(0);
  });

  it('equals honours epsilon', () => {
    expect(new Vec2(1, 1).equals({ x: 1.0000001, y: 1 })).toBe(true);
    expect(new Vec2(1, 1).equals({ x: 1.1, y: 1 })).toBe(false);
  });

  it('formats via toString', () => {
    expect(new Vec2(1.234, -5.678).toString()).toBe('(1.23, -5.68)');
  });
});
