import { describe, expect, it } from 'vitest';
import {
  blastReach,
  createExplosionResult,
  resolveExplosion,
  squaredDistance,
  withinBlast,
  type ExplodableBrick,
} from '../src/systems/explosion.js';
import { BRICK_BEHAVIOR } from '../src/config/levels.js';

/** Radius from the frozen data (`brickTypes.B.explode.radius`). */
const R = BRICK_BEHAVIOR.B.explode!.radius;
const OPTS = BRICK_BEHAVIOR.B.explode!;

/** Grid pitches from `§3.3`: 68 horizontally, 40 vertically. */
const COL_PITCH = 68;
const ROW_PITCH = 40;

function brick(overrides: Partial<ExplodableBrick> & { type: string }): ExplodableBrick {
  return {
    x: 0,
    y: 0,
    width: 62,
    height: 34,
    score: 100,
    color: '#ffffff',
    damage: 1,
    indestructible: false,
    hp: 1,
    destroyed: false,
    ...overrides,
  };
}

/** Build a bomb at the origin plus the 8 surrounding grid cells. */
function cross(): { seed: ExplodableBrick; neighbours: Record<string, ExplodableBrick>; all: ExplodableBrick[] } {
  const seed = brick({ type: 'B', x: 0, y: 0 });
  const neighbours: Record<string, ExplodableBrick> = {
    left: brick({ type: 'N', x: -COL_PITCH, y: 0 }),
    right: brick({ type: 'N', x: COL_PITCH, y: 0 }),
    up: brick({ type: 'N', x: 0, y: ROW_PITCH }),
    down: brick({ type: 'N', x: 0, y: -ROW_PITCH }),
    upLeft: brick({ type: 'N', x: -COL_PITCH, y: ROW_PITCH }),
    upRight: brick({ type: 'N', x: COL_PITCH, y: ROW_PITCH }),
    downLeft: brick({ type: 'N', x: -COL_PITCH, y: -ROW_PITCH }),
    downRight: brick({ type: 'N', x: COL_PITCH, y: -ROW_PITCH }),
  };
  return { seed, neighbours, all: [seed, ...Object.values(neighbours)] };
}

describe('blast radius constant', () => {
  it('is 68 px, which is exactly the horizontal column pitch', () => {
    expect(R).toBe(68);
    expect(R).toBe(COL_PITCH);
  });
});

describe('withinBlast', () => {
  /**
   * The single most important boundary in the game: `r` equals the column pitch,
   * so `<=` (cross) vs `<` (T-shape) decides the blast shape. We compare integer
   * squared distances, never `Math.hypot`.
   */
  it('includes the boundary at d² === r²', () => {
    expect(squaredDistance(0, 0, R, 0)).toBe(4624);
    expect(withinBlast(0, 0, R, 0, R)).toBe(true);
  });

  it('excludes d² just past the boundary', () => {
    expect(squaredDistance(0, 0, R, 1)).toBe(4625);
    expect(withinBlast(0, 0, R, 1, R)).toBe(false);
  });

  it('hits the vertical neighbour (row pitch 40)', () => {
    expect(squaredDistance(0, 0, 0, ROW_PITCH)).toBe(1600);
    expect(withinBlast(0, 0, 0, ROW_PITCH, R)).toBe(true);
  });

  it('misses the diagonal neighbour (68² + 40² = 6224)', () => {
    expect(squaredDistance(0, 0, COL_PITCH, ROW_PITCH)).toBe(6224);
    expect(withinBlast(0, 0, COL_PITCH, ROW_PITCH, R)).toBe(false);
  });

  it('is symmetric', () => {
    expect(withinBlast(0, 0, 10, 10, R)).toBe(withinBlast(10, 10, 0, 0, R));
  });
});

describe('resolveExplosion', () => {
  it('blasts a 5-cell cross: the 4 orthogonal neighbours only', () => {
    const { seed, neighbours, all } = cross();
    const result = resolveExplosion(seed, all, OPTS, createExplosionResult());

    const hit = new Set(result.damaged);
    expect(hit.has(neighbours['left']!)).toBe(true);
    expect(hit.has(neighbours['right']!)).toBe(true);
    expect(hit.has(neighbours['up']!)).toBe(true);
    expect(hit.has(neighbours['down']!)).toBe(true);

    // All four diagonals are 6224 away — outside the blast.
    expect(hit.has(neighbours['upLeft']!)).toBe(false);
    expect(hit.has(neighbours['upRight']!)).toBe(false);
    expect(hit.has(neighbours['downLeft']!)).toBe(false);
    expect(hit.has(neighbours['downRight']!)).toBe(false);

    expect(result.destroyed).toHaveLength(4);
    expect(result.chainDepth).toBe(1);
  });

  it('never damages the seed itself', () => {
    const { seed, all } = cross();
    const result = resolveExplosion(seed, all, OPTS, createExplosionResult());
    expect(seed.destroyed).toBe(false);
    expect(seed.hp).toBe(1);
    expect(result.damaged).not.toContain(seed);
  });

  it('is immune to steel bricks', () => {
    const seed = brick({ type: 'B', x: 0, y: 0 });
    const steel = brick({ type: 'S', x: COL_PITCH, y: 0, hp: Number.POSITIVE_INFINITY, indestructible: true });
    const result = resolveExplosion(seed, [seed, steel], OPTS, createExplosionResult());

    expect(steel.destroyed).toBe(false);
    expect(steel.hp).toBe(Number.POSITIVE_INFINITY);
    expect(result.damaged).not.toContain(steel);
    expect(result.destroyed).not.toContain(steel);
  });

  it('chips a tough brick without destroying it in one blast', () => {
    const seed = brick({ type: 'B', x: 0, y: 0 });
    const tough = brick({ type: 'T', x: COL_PITCH, y: 0, hp: 2 });
    const result = resolveExplosion(seed, [seed, tough], OPTS, createExplosionResult());

    expect(tough.hp).toBe(1);
    expect(tough.destroyed).toBe(false);
    expect(result.damaged).toContain(tough);
    expect(result.destroyed).toHaveLength(0);
  });

  it('chains through adjacent bombs and reports the depth', () => {
    // seed at 0 — bomb at 68 — plain brick at 136 (only reachable via the chain).
    const seed = brick({ type: 'B', x: 0, y: 0 });
    const second = brick({ type: 'B', x: COL_PITCH, y: 0 });
    const far = brick({ type: 'N', x: COL_PITCH * 2, y: 0 });
    const result = resolveExplosion(seed, [seed, second, far], OPTS, createExplosionResult());

    expect(second.destroyed).toBe(true);
    expect(far.destroyed).toBe(true); // reached only because `second` exploded
    expect(result.chainDepth).toBe(2);
  });

  it('stops the chain at maxChain generations', () => {
    // A line of bombs 68 apart: seed, b2, b3, b4 …
    const bricks = [0, 1, 2, 3, 4].map((i) => brick({ type: 'B', x: i * COL_PITCH, y: 0 }));
    const result = resolveExplosion(bricks[0]!, bricks, { ...OPTS, maxChain: 2 }, createExplosionResult());

    expect(result.chainDepth).toBe(2);
    // Generation 1 destroys b2; generation 2 destroys b3. b4 and beyond survive.
    expect(bricks[1]!.destroyed).toBe(true);
    expect(bricks[2]!.destroyed).toBe(true);
    expect(bricks[3]!.destroyed).toBe(false);
  });

  it('damages each brick at most once per cascade', () => {
    // Two bombs both within range of the same tough brick: it must lose 1 HP,
    // not 2, so the outcome cannot depend on iteration order.
    const seed = brick({ type: 'B', x: 0, y: 0 });
    const tough = brick({ type: 'T', x: 0, y: ROW_PITCH, hp: 2 });
    const result = resolveExplosion(seed, [seed, tough], OPTS, createExplosionResult());

    expect(tough.hp).toBe(1);
    expect(result.damaged.filter((b) => b === tough)).toHaveLength(1);
  });

  it('skips bricks that are already destroyed', () => {
    const seed = brick({ type: 'B', x: 0, y: 0 });
    const gone = brick({ type: 'N', x: COL_PITCH, y: 0, destroyed: true, hp: 0 });
    const result = resolveExplosion(seed, [seed, gone], OPTS, createExplosionResult());
    expect(result.destroyed).toHaveLength(0);
    expect(result.damaged).toHaveLength(0);
  });

  it('does nothing with a degenerate radius or damage', () => {
    const { seed, all } = cross();
    const result = resolveExplosion(seed, all, { radius: 0, damage: 1, maxChain: 8 }, createExplosionResult());
    expect(result.damaged).toHaveLength(0);
    expect(result.chainDepth).toBe(0);
  });

  it('resets the scratch result between calls', () => {
    const { seed, all } = cross();
    const scratch = createExplosionResult();
    resolveExplosion(seed, all, OPTS, scratch);
    expect(scratch.destroyed.length).toBeGreaterThan(0);

    // A second cascade that hits nothing must leave the scratch object empty.
    const lonely = brick({ type: 'B', x: 0, y: 5000 });
    resolveExplosion(lonely, [lonely], OPTS, scratch);
    expect(scratch.destroyed).toHaveLength(0);
    expect(scratch.damaged).toHaveLength(0);
    expect(scratch.chainDepth).toBe(1);
  });
});

describe('blastReach', () => {
  it('lists exactly the bricks a blast can touch, ignoring steel and the seed', () => {
    const { seed, neighbours, all } = cross();
    const reach = blastReach(seed, all, R);
    expect(reach).toHaveLength(4);
    for (const n of Object.values(neighbours)) {
      const diagonal = n.x !== 0 && n.y !== 0;
      expect(reach.includes(n), `diagonal=${diagonal}`).toBe(!diagonal);
    }
  });
});
