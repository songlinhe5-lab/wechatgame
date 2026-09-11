/**
 * Axis-aligned box + circle collision primitives.
 *
 * Breakout (and most 2D mini-games) only ever need AABB↔AABB and circle↔AABB
 * tests. Implementing them here — once, in the engine-agnostic core — means the
 * Cocos adapter and the Canvas2D dev harness share exactly the same maths, and
 * the behaviour is unit-testable without any engine.
 */

export interface Aabb {
  /** Centre X. */
  x: number;
  /** Centre Y. */
  y: number;
  /** Full width (not half-extent). */
  w: number;
  /** Full height (not half-extent). */
  h: number;
}

export function aabb(
  x: number,
  y: number,
  w: number,
  h: number,
  out: Aabb = { x: 0, y: 0, w: 0, h: 0 },
): Aabb {
  out.x = x;
  out.y = y;
  out.w = w;
  out.h = h;
  return out;
}

export function aabbLeft(b: Aabb): number {
  return b.x - b.w / 2;
}
export function aabbRight(b: Aabb): number {
  return b.x + b.w / 2;
}
export function aabbTop(b: Aabb): number {
  return b.y + b.h / 2;
}
export function aabbBottom(b: Aabb): number {
  return b.y - b.h / 2;
}

export function aabbContainsPoint(b: Aabb, px: number, py: number): boolean {
  return (
    px >= b.x - b.w / 2 && px <= b.x + b.w / 2 && py >= b.y - b.h / 2 && py <= b.y + b.h / 2
  );
}

/** Standard overlap test for two centre-defined boxes. */
export function aabbOverlaps(a: Aabb, b: Aabb): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h
  );
}

/** Which face of `box` the circle overlaps least — the collision normal axis. */
export type CollisionAxis = 'x' | 'y' | 'none';

export interface CircleHit {
  /** True when the shapes overlap. */
  hit: boolean;
  /**
   * Axis along which the circle entered: `'x'` means resolve horizontally,
   * `'y'` means resolve vertically. `'none'` when there is no hit.
   */
  axis: CollisionAxis;
  /** Penetration depth along {@link axis}. */
  depth: number;
  /** Contact point (on the box surface) — useful for sparks/particles. */
  contactX: number;
  contactY: number;
}

const _hit: CircleHit = { hit: false, axis: 'none', depth: 0, contactX: 0, contactY: 0 };

/**
 * Circle ↔ AABB test.
 *
 * Uses the classic "closest point on box" approach to detect the hit, then
 * decides the resolution axis by comparing penetration depths, which gives
 * stable results for the shallow-angle hits that dominate brick-breaker play.
 *
 * @param reuse pass a scratch object to avoid allocation in hot loops.
 */
export function circleVsAabb(
  cx: number,
  cy: number,
  r: number,
  b: Aabb,
  reuse: CircleHit = _hit,
): CircleHit {
  const left = aabbLeft(b);
  const right = aabbRight(b);
  const bottom = aabbBottom(b);
  const top = aabbTop(b);

  const closestX = cx < left ? left : cx > right ? right : cx;
  const closestY = cy < bottom ? bottom : cy > top ? top : cy;

  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > r * r) {
    reuse.hit = false;
    reuse.axis = 'none';
    reuse.depth = 0;
    return reuse;
  }

  // Circle centre inside the box: push out along the nearest face.
  if (dx === 0 && dy === 0) {
    const penX = r + (b.w / 2 - Math.abs(cx - b.x));
    const penY = r + (b.h / 2 - Math.abs(cy - b.y));
    if (penX < penY) {
      const dir = cx < b.x ? -1 : 1;
      reuse.hit = true;
      reuse.axis = 'x';
      reuse.depth = penX;
      reuse.contactX = cx + dir * penX;
      reuse.contactY = cy;
    } else {
      const dir = cy < b.y ? -1 : 1;
      reuse.hit = true;
      reuse.axis = 'y';
      reuse.depth = penY;
      reuse.contactX = cx;
      reuse.contactY = cy + dir * penY;
    }
    return reuse;
  }

  const dist = Math.sqrt(distSq);
  reuse.hit = true;
  reuse.depth = r - dist;
  reuse.contactX = closestX;
  reuse.contactY = closestY;
  // Prefer the axis with the dominant offset from the box centre.
  const overX = Math.abs(cx - b.x) - b.w / 2;
  const overY = Math.abs(cy - b.y) - b.h / 2;
  if (overX > overY) {
    reuse.axis = 'x';
  } else if (overY > overX) {
    reuse.axis = 'y';
  } else {
    reuse.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  }
  return reuse;
}

/** Returns a freshly allocated hit record (convenience for non-hot callers). */
export function circleVsAabbAlloc(
  cx: number,
  cy: number,
  r: number,
  b: Aabb,
): CircleHit {
  return circleVsAabb(cx, cy, r, b, { hit: false, axis: 'none', depth: 0, contactX: 0, contactY: 0 });
}
