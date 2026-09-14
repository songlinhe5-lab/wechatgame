/**
 * Generic object pool.
 *
 * Brick-breaker spawns particles, floating score texts and "hit flash" nodes
 * dozens of times per second. Allocating them would create exactly the kind of
 * GC hitch that shows up as stutter on low-end Android inside WeChat.
 *
 * Rules (see control-manifest.md):
 *  - acquire in `onEnter`, release in `onExit`/despawn,
 *  - never hold a reference to a pooled object after releasing it,
 *  - `reset` must clear ALL mutable fields, including callbacks.
 */

export interface ObjectPoolOptions<T> {
  /** Optional per-instance reset hook run on release (and warm-up). */
  readonly reset?: (item: T) => void;
  /** Pre-create this many instances eagerly. */
  readonly initial?: number;
  /** Cap on retained idle instances; excess releases are dropped. */
  readonly maxIdle?: number;
  /** Cap on total instances ever created (protects against runaway growth). */
  readonly maxSize?: number;
}

export class ObjectPool<T> {
  private readonly _factory: () => T;
  private readonly _reset: ((item: T) => void) | undefined;
  private readonly _idle: T[] = [];
  private readonly _inUse = new Set<T>();
  private readonly _maxIdle: number;
  private readonly _maxSize: number;
  private _created = 0;
  private _acquired = 0;
  private _released = 0;
  private _dropped = 0;

  constructor(factory: () => T, options: ObjectPoolOptions<T> = {}) {
    this._factory = factory;
    this._reset = options.reset;
    this._maxIdle = options.maxIdle ?? Number.POSITIVE_INFINITY;
    this._maxSize = options.maxSize ?? Number.POSITIVE_INFINITY;

    const initial = options.initial ?? 0;
    for (let i = 0; i < initial; i++) {
      const item = this._create();
      this._reset?.(item);
      this._idle.push(item);
    }
  }

  /** Number of idle (reusable) instances. */
  get idleCount(): number {
    return this._idle.length;
  }

  /** Number of instances currently handed out. */
  get activeCount(): number {
    return this._inUse.size;
  }

  /** Total instances ever created (monotonic). */
  get createdCount(): number {
    return this._created;
  }

  get stats(): { created: number; active: number; idle: number; acquired: number; released: number; dropped: number } {
    return {
      created: this._created,
      active: this._inUse.size,
      idle: this._idle.length,
      acquired: this._acquired,
      released: this._released,
      dropped: this._dropped,
    };
  }

  /** Get an instance, reusing an idle one when available. */
  acquire(): T {
    let item = this._idle.pop();
    if (item === undefined) {
      if (this._created >= this._maxSize) {
        throw new Error(
          `ObjectPool: maxSize (${this._maxSize}) reached and no idle instances available`,
        );
      }
      item = this._create();
    }
    this._inUse.add(item);
    this._acquired++;
    return item;
  }

  /**
   * Return an instance. Double-releases and foreign objects are ignored (and
   * counted in `stats.dropped`) rather than corrupting the pool.
   */
  release(item: T): boolean {
    if (!this._inUse.has(item)) {
      this._dropped++;
      return false;
    }
    this._inUse.delete(item);
    this._released++;
    this._reset?.(item);
    if (this._idle.length < this._maxIdle) this._idle.push(item);
    else this._dropped++;
    return true;
  }

  /** Release everything currently checked out. */
  releaseAll(): void {
    // Snapshot with `Array.from`; a spread is not allowed here — the Cocos ES5
    // build lowers a spread of a Set into a concat form that does not expand it
    // (ADR-0012).
    for (const item of Array.from(this._inUse)) this.release(item);
  }

  /** Drop all instances (idle + active references). Use on scene teardown. */
  clear(): void {
    this._idle.length = 0;
    this._inUse.clear();
  }

  private _create(): T {
    this._created++;
    return this._factory();
  }
}
