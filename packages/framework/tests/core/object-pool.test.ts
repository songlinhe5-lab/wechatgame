import { describe, expect, it } from 'vitest';
import { ObjectPool } from '../../src/core/pool/object-pool.js';

interface Bullet {
  x: number;
  y: number;
  alive: boolean;
}

const factory = (): Bullet => ({ x: 0, y: 0, alive: false });
const reset = (b: Bullet): void => {
  b.x = 0;
  b.y = 0;
  b.alive = false;
};

describe('ObjectPool', () => {
  it('creates lazily and tracks counts', () => {
    const pool = new ObjectPool(factory, { reset });
    expect(pool.createdCount).toBe(0);
    const a = pool.acquire();
    expect(pool.createdCount).toBe(1);
    expect(pool.activeCount).toBe(1);
    expect(a).toEqual({ x: 0, y: 0, alive: false });
  });

  it('warm-ups with `initial`', () => {
    const pool = new ObjectPool(factory, { initial: 5 });
    expect(pool.createdCount).toBe(5);
    expect(pool.idleCount).toBe(5);
  });

  it('reuses released instances without allocating', () => {
    const pool = new ObjectPool(factory, { reset });
    const a = pool.acquire();
    a.x = 42;
    pool.release(a);
    const b = pool.acquire();
    expect(b).toBe(a);
    expect(pool.createdCount).toBe(1);
    expect(b.x).toBe(0); // reset ran
  });

  it('ignores double releases and foreign objects', () => {
    const pool = new ObjectPool(factory, { reset });
    const a = pool.acquire();
    expect(pool.release(a)).toBe(true);
    expect(pool.release(a)).toBe(false);
    expect(pool.release(factory())).toBe(false);
    expect(pool.stats.dropped).toBe(2);
  });

  it('enforces maxIdle by dropping surplus instances', () => {
    const pool = new ObjectPool(factory, { maxIdle: 1, reset });
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a);
    pool.release(b);
    expect(pool.idleCount).toBe(1);
    expect(pool.stats.dropped).toBe(1);
  });

  it('throws when maxSize is exhausted', () => {
    const pool = new ObjectPool(factory, { maxSize: 1 });
    pool.acquire();
    expect(() => pool.acquire()).toThrow(/maxSize/);
  });

  it('releaseAll returns every active instance', () => {
    const pool = new ObjectPool(factory, { reset });
    pool.acquire();
    pool.acquire();
    pool.acquire();
    expect(pool.activeCount).toBe(3);
    pool.releaseAll();
    expect(pool.activeCount).toBe(0);
    expect(pool.idleCount).toBe(3);
  });

  it('clear() drops idle and active references', () => {
    const pool = new ObjectPool(factory, { reset });
    pool.acquire();
    pool.clear();
    expect(pool.idleCount).toBe(0);
    expect(pool.activeCount).toBe(0);
  });

  it('reports cumulative stats', () => {
    const pool = new ObjectPool(factory, { reset });
    const a = pool.acquire();
    pool.acquire();
    pool.release(a);
    const stats = pool.stats;
    expect(stats.created).toBe(2);
    expect(stats.acquired).toBe(2);
    expect(stats.released).toBe(1);
    expect(stats.active).toBe(1);
    expect(stats.idle).toBe(1);
  });
});
