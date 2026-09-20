/**
 * Minimal 2D vector.
 *
 * The class is *mutable* on purpose: gameplay hot paths (`Ball`, `AABB`
 * resolution) update vectors tens of times per frame and must not allocate.
 * Static `out`-parameter helpers (`Vec2.add(a, b, out)`) let callers reuse a
 * scratch vector instead of allocating a new one.
 *
 * All coordinates are in *design-space* units (see `render/viewport.ts`).
 */
export interface Vec2Like {
  readonly x: number;
  readonly y: number;
}

export class Vec2 implements Vec2Like {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /** Static named constructor, mirroring `new Vec2(x, y)`. */
  static of(x = 0, y = 0): Vec2 {
    return new Vec2(x, y);
  }

  /** Unit vector from `(x0,y0)` to `(x1,y1)`. */
  static fromTo(x0: number, y0: number, x1: number, y1: number): Vec2 {
    return new Vec2(x1 - x0, y1 - y0);
  }

  /** Copy from a plain object without allocating. Returns `this`. */
  copyFrom(v: Vec2Like): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  /** `this += v` */
  addMut(v: Vec2Like): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /** `this -= v` */
  subMut(v: Vec2Like): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /** `this *= s` */
  scaleMut(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  /** In-place normalisation. A zero vector stays zero. */
  normalizeMut(): this {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  dot(v: Vec2Like): number {
    return this.x * v.x + this.y * v.y;
  }

  /** Signed 2D cross product (z component of the 3D cross). */
  cross(v: Vec2Like): number {
    return this.x * v.y - this.y * v.x;
  }

  distanceTo(v: Vec2Like): number {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  distanceSqTo(v: Vec2Like): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  /** Angle in radians, measured from +X toward +Y. */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /** Rotate in place by `radians`. */
  rotateMut(radians: number): this {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const { x, y } = this;
    this.x = x * c - y * s;
    this.y = x * s + y * c;
    return this;
  }

  equals(v: Vec2Like, epsilon = 1e-6): boolean {
    return Math.abs(this.x - v.x) <= epsilon && Math.abs(this.y - v.y) <= epsilon;
  }

  /** Zero-allocation `a + b` into `out`. */
  static add(a: Vec2Like, b: Vec2Like, out: Vec2): Vec2 {
    out.x = a.x + b.x;
    out.y = a.y + b.y;
    return out;
  }

  /** Zero-allocation `a - b` into `out`. */
  static sub(a: Vec2Like, b: Vec2Like, out: Vec2): Vec2 {
    out.x = a.x - b.x;
    out.y = a.y - b.y;
    return out;
  }

  /** Zero-allocation `a * s` into `out`. */
  static scale(a: Vec2Like, s: number, out: Vec2): Vec2 {
    out.x = a.x * s;
    out.y = a.y * s;
    return out;
  }

  static distance(a: Vec2Like, b: Vec2Like): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  static distanceSq(a: Vec2Like, b: Vec2Like): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  static dot(a: Vec2Like, b: Vec2Like): number {
    return a.x * b.x + a.y * b.y;
  }

  static lerp(a: Vec2Like, b: Vec2Like, t: number, out: Vec2): Vec2 {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    return out;
  }

  toString(): string {
    return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }
}
