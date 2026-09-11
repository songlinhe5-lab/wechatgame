import { describe, expect, it } from 'vitest';
import {
  aabb,
  aabbBottom,
  aabbContainsPoint,
  aabbLeft,
  aabbOverlaps,
  aabbRight,
  aabbTop,
  circleVsAabb,
  circleVsAabbAlloc,
} from '../../src/core/math/geometry.js';

describe('AABB helpers', () => {
  const box = aabb(10, 20, 8, 4); // centre (10,20), 8x4

  it('derives edges from centre + size', () => {
    expect(aabbLeft(box)).toBe(6);
    expect(aabbRight(box)).toBe(14);
    expect(aabbTop(box)).toBe(22);
    expect(aabbBottom(box)).toBe(18);
  });

  it('tests point containment inclusively', () => {
    expect(aabbContainsPoint(box, 10, 20)).toBe(true);
    expect(aabbContainsPoint(box, 6, 18)).toBe(true);
    expect(aabbContainsPoint(box, 5.9, 20)).toBe(false);
  });

  it('detects overlap (touching edges do not overlap)', () => {
    expect(aabbOverlaps(box, aabb(18, 20, 8, 4))).toBe(false); // spans [14,22], touches at 14
    expect(aabbOverlaps(box, aabb(17.9, 20, 8, 4))).toBe(true);
    expect(aabbOverlaps(box, aabb(10, 24, 8, 4))).toBe(false); // spans y [22,26], touches at 22
    expect(aabbOverlaps(box, aabb(10, 23.9, 8, 4))).toBe(true);
  });
});

describe('circleVsAabb', () => {
  const box = aabb(0, 0, 10, 10); // spans [-5,5] x [-5,5]

  it('misses when far away', () => {
    const hit = circleVsAabbAlloc(20, 20, 2, box);
    expect(hit.hit).toBe(false);
    expect(hit.axis).toBe('none');
    expect(hit.depth).toBe(0);
  });

  it('hits a face and reports the normal axis', () => {
    // Circle just above the top face, moving down.
    const hit = circleVsAabbAlloc(0, 6, 2, box);
    expect(hit.hit).toBe(true);
    expect(hit.axis).toBe('y');
    expect(hit.depth).toBeCloseTo(1, 6); // 6 - 5 = 1 into the radius 2 → depth 1
    expect(hit.contactY).toBe(5);
    expect(hit.contactX).toBe(0);
  });

  it('hits a side face on the X axis', () => {
    const hit = circleVsAabbAlloc(6, 0, 2, box);
    expect(hit.hit).toBe(true);
    expect(hit.axis).toBe('x');
    expect(hit.depth).toBeCloseTo(1, 6);
  });

  it('hits a corner with a corner normal', () => {
    const hit = circleVsAabbAlloc(6, 6, 2, box);
    expect(hit.hit).toBe(true);
    // Equal overshoot on both axes → corner case resolves on either axis.
    expect(['x', 'y']).toContain(hit.axis);
    expect(hit.contactX).toBe(5);
    expect(hit.contactY).toBe(5);
  });

  it('resolves a fully contained centre along the nearest face', () => {
    const wide = circleVsAabbAlloc(0, 0, 1, box); // dead centre, shallow both ways
    expect(wide.hit).toBe(true);
    expect(wide.axis).toBe('y');
    const offX = circleVsAabbAlloc(4, 0, 1, box);
    expect(offX.axis).toBe('x');
  });

  it('reuses a scratch record without allocating', () => {
    const scratch = { hit: false, axis: 'none' as const, depth: 0, contactX: 0, contactY: 0 };
    const a = circleVsAabb(0, 6, 2, box, scratch);
    expect(a).toBe(scratch);
    expect(a.hit).toBe(true);
    const b = circleVsAabb(100, 100, 2, box, scratch);
    expect(b).toBe(scratch);
    expect(b.hit).toBe(false);
    expect(b.depth).toBe(0);
  });
});
