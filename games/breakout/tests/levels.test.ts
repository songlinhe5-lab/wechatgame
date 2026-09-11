import { describe, expect, it } from 'vitest';
import { compileLevels, validateLevel } from '@wxgame/framework';
import {
  BREAKOUT_LEVEL_IDS,
  BRICK_CHARS,
  BRICK_TYPES,
  LEVELS,
  LEVEL_DATA,
  LEVEL_CHARSET,
  levelById,
  levelDataById,
  droppablePowerups,
  powerupWeights,
} from '../src/config/levels.js';
import { DEFAULT_TUNING } from '../src/config/tuning.js';

/** Recompute a level's destructible HP straight from the data (`. ` = nothing). */
function destructibleHp(rows: readonly string[]): number {
  let hp = 0;
  for (const row of rows) {
    for (const ch of row) {
      if (ch === '.') continue;
      const spec = BRICK_TYPES[ch as keyof typeof BRICK_TYPES];
      if (!spec || spec.indestructible) continue;
      hp += spec.hp;
    }
  }
  return hp;
}

describe('shipped levels', () => {
  it('ships exactly five levels, ids 1..5, in order', () => {
    expect(LEVELS).toHaveLength(5);
    expect(LEVELS.map((l) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4', 'l5']);
    expect(LEVEL_DATA.map((d) => d.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('every level passes framework validation', () => {
    for (const level of LEVELS) {
      expect(validateLevel(level), `level ${level.id}`).toEqual([]);
    }
  });

  it('every level compiles against the tuning grid', () => {
    const compiled = compileLevels(LEVELS, DEFAULT_TUNING.grid);
    expect(compiled).toHaveLength(LEVELS.length);
    for (const level of compiled) {
      expect(level.bricks.length).toBeGreaterThan(0);
      expect(level.brickCount).toBeGreaterThan(0);
      expect(level.cols).toBe(10);
      expect(level.rows).toBeLessThanOrEqual(DEFAULT_TUNING.maxRows);
    }
  });

  it('has unique, stable ids', () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BREAKOUT_LEVEL_IDS).toEqual(ids);
  });

  it('uses equal-width rows drawn from the level charset', () => {
    for (const level of LEVELS) {
      const width = level.layout[0]!.length;
      expect(width, level.id).toBe(DEFAULT_TUNING.cols);
      for (const row of level.layout) {
        expect(row.length, level.id).toBe(width);
        for (const ch of row) {
          expect(LEVEL_CHARSET, `${level.id}: "${ch}"`).toContain(ch);
        }
      }
    }
  });

  /**
   * The per-level destructible-HP totals are a hard, externally verified
   * contract (`levels-spec §3` + `production/qa/validate-levels.mjs`).
   */
  it('matches the frozen per-level HP totals', () => {
    const totals = LEVELS.map((l) => destructibleHp(l.layout));
    expect(totals).toEqual([30, 50, 44, 56, 58]);
  });

  it('ramps difficulty: the last board is beefier than the first', () => {
    const totals = LEVELS.map((l) => destructibleHp(l.layout));
    expect(totals[totals.length - 1]!).toBeGreaterThan(totals[0]!);
  });

  it('ramps ball speed monotonically, always under the ceiling', () => {
    const speeds = LEVELS.map((l) => l.ballSpeed);
    expect(speeds).toEqual([480, 500, 520, 540, 560]);
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]!).toBeGreaterThanOrEqual(speeds[i - 1]!);
    }
    for (const speed of speeds) {
      expect(speed!).toBeLessThanOrEqual(DEFAULT_TUNING.ball.maxSpeed);
    }
  });

  it('uses the same paddle width on every board', () => {
    for (const level of LEVELS) {
      expect(level.paddleWidth).toBe(DEFAULT_TUNING.paddle.width);
    }
  });

  it('introduces each brick type in order of complexity', () => {
    const first = (char: string) =>
      LEVELS.findIndex((l) => l.layout.some((r) => r.includes(char)));
    expect(first(BRICK_CHARS.normal)).toBe(0);
    expect(first(BRICK_CHARS.tough)).toBe(1);
    expect(first(BRICK_CHARS.steel)).toBe(2);
    expect(first(BRICK_CHARS.bomb)).toBe(3);
    expect(first(BRICK_CHARS.gold)).toBe(4);
  });

  it('keeps steel bricks under the 20% share limit', () => {
    for (const level of LEVEL_DATA) {
      const all = level.rows.join('').split('');
      const steel = all.filter((c) => c === BRICK_CHARS.steel).length;
      const bricks = all.filter((c) => c !== '.').length;
      expect(steel / bricks, level.name).toBeLessThanOrEqual(0.2);
    }
  });

  it('every level has at least one destructible brick', () => {
    for (const level of LEVELS) {
      const destructible = level.layout
        .join('')
        .split('')
        .filter((c) => c !== '.' && !level.legend[c]?.indestructible).length;
      expect(destructible, level.id).toBeGreaterThan(0);
    }
  });

  it('positions bricks inside the arena horizontally', () => {
    const compiled = compileLevels(LEVELS, DEFAULT_TUNING.grid);
    for (const level of compiled) {
      for (const brick of level.bricks) {
        expect(brick.x - brick.width / 2).toBeGreaterThanOrEqual(DEFAULT_TUNING.arena.left - 0.001);
        expect(brick.x + brick.width / 2).toBeLessThanOrEqual(DEFAULT_TUNING.arena.right + 0.001);
      }
    }
  });

  it('stacks rows downward from the top of the grid', () => {
    const compiled = compileLevels(LEVELS, DEFAULT_TUNING.grid)[0]!;
    const rowY = new Map<number, number>();
    for (const b of compiled.bricks) rowY.set(b.row, b.y);
    expect(rowY.get(0)!).toBeGreaterThan(rowY.get(1)!);
    expect(rowY.get(1)!).toBeGreaterThan(rowY.get(2)!);
  });

  it('levelById resolves shipped ids and rejects unknown ones', () => {
    expect(levelById('l1')?.name).toBe('热身');
    expect(levelById('l5')?.name).toBe('霓虹终章');
    expect(levelById('nope')).toBeUndefined();
  });

  it('levelDataById exposes drop rate, pool and hint', () => {
    expect(levelDataById('l1')?.powerupDropRate).toBeCloseTo(0.1, 6);
    expect(levelDataById('l1')?.hint).toBeTruthy();
    expect(levelDataById('l3')?.powerupDropRate).toBeCloseTo(0.12, 6);
    expect(levelDataById('nope')).toBeUndefined();
  });

  it('per-level overrides stay within bounds', () => {
    for (const level of LEVELS) {
      expect(level.ballSpeed!).toBeGreaterThan(0);
      expect(level.paddleWidth!).toBeGreaterThan(0);
      expect(level.paddleWidth!).toBeLessThanOrEqual(DEFAULT_TUNING.paddle.width);
    }
  });
});

describe('brick types', () => {
  it('carries the five codes with the frozen hp/score table', () => {
    expect(Object.keys(BRICK_TYPES).sort()).toEqual(['B', 'G', 'N', 'S', 'T']);
    expect(BRICK_TYPES.N.hp).toBe(1);
    expect(BRICK_TYPES.N.score).toBe(100);
    expect(BRICK_TYPES.T.hp).toBe(2);
    expect(BRICK_TYPES.T.score).toBe(250);
    expect(BRICK_TYPES.S.indestructible).toBe(true);
    expect(BRICK_TYPES.S.score).toBe(0);
    expect(BRICK_TYPES.B.hp).toBe(1);
    expect(BRICK_TYPES.B.score).toBe(150);
    expect(BRICK_TYPES.G.hp).toBe(1);
    expect(BRICK_TYPES.G.score).toBe(500);
  });

  it('gives steel a positive-but-infinite hp so it validates', () => {
    // The framework requires hp > 0; Infinity expresses "never breaks".
    expect(BRICK_TYPES.S.hp).toBe(Number.POSITIVE_INFINITY);
    expect(BRICK_TYPES.S.hp).toBeGreaterThan(0);
  });

  it('gives every brick a colour from the art bible', () => {
    for (const spec of Object.values(BRICK_TYPES)) {
      expect(spec.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('powerup pool (§3.6)', () => {
  it('only drops implemented powerups', () => {
    for (const level of LEVEL_DATA) {
      const droppable = droppablePowerups(level);
      for (const id of droppable) {
        expect(['expand', 'multi', 'life']).toContain(id);
      }
    }
  });

  it('silently ignores defined-but-unimplemented ids', () => {
    // L3 declares `slow`, L5 declares `sticky`; both are defined but not shipped.
    expect(LEVEL_DATA[2]!.powerupPool).toContain('slow');
    expect(droppablePowerups(LEVEL_DATA[2]!)).not.toContain('slow');
    expect(LEVEL_DATA[4]!.powerupPool).toContain('sticky');
    expect(droppablePowerups(LEVEL_DATA[4]!)).not.toContain('sticky');
    expect(LEVEL_DATA[4]!.powerupPool).toContain('life');
  });

  it('re-normalises weights across the surviving candidates', () => {
    const weights = powerupWeights(LEVEL_DATA[0]!);
    const total = weights.reduce((sum, w) => sum + w.weight, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(weights.map((w) => w.id).sort()).toEqual(['expand', 'life', 'multi']);
  });
});
