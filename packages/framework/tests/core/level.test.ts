import { describe, expect, it } from 'vitest';
import {
  compileLevel,
  compileLevels,
  validateLevel,
  type GridLayout,
  type LevelDef,
} from '../../src/core/config/level.js';

const grid: GridLayout = {
  originX: 0,
  originY: 600,
  cellWidth: 100,
  cellHeight: 50,
  gapX: 4,
  gapY: 4,
};

function level(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'l1',
    name: 'Warm-up',
    layout: ['.#.', '###'],
    legend: { '#': { hp: 1, score: 10, color: '#4cc9f0' } },
    ...overrides,
  };
}

describe('validateLevel', () => {
  it('accepts a well-formed level', () => {
    expect(validateLevel(level())).toEqual([]);
  });

  it('rejects missing id / layout / legend', () => {
    expect(validateLevel(level({ id: '' })).join()).toMatch(/id/);
    expect(validateLevel(level({ layout: [] })).join()).toMatch(/layout/);
    expect(validateLevel(level({ legend: {} as never, layout: ['..'] })).join()).toMatch(
      /at least one destructible/,
    );
  });

  it('rejects unequal row widths', () => {
    const errors = validateLevel(level({ layout: ['###', '##'] }));
    expect(errors.join()).toMatch(/row 1 has width 2, expected 3/);
  });

  it('rejects characters missing from the legend', () => {
    const errors = validateLevel(level({ layout: ['#%'] }));
    expect(errors.join()).toMatch(/missing from legend/);
  });

  it('rejects invalid legend entries', () => {
    const errors = validateLevel(
      level({
        layout: ['#'],
        legend: {
          '#': { hp: 0, score: 10, color: '#fff' },
        },
      }),
    );
    expect(errors.join()).toMatch(/hp must be > 0/);
  });

  it('rejects reserved legend keys and multi-char keys', () => {
    const errors = validateLevel(
      level({
        layout: ['#'],
        legend: {
          '#': { hp: 1, score: 1, color: '#fff' },
          '.': { hp: 1, score: 1, color: '#fff' },
          ab: { hp: 1, score: 1, color: '#fff' },
        },
      }),
    );
    expect(errors.join()).toMatch(/reserved/);
    expect(errors.join()).toMatch(/must be 1 char/);
  });

  it('requires at least one destructible brick', () => {
    const errors = validateLevel(
      level({
        layout: ['#'],
        legend: { '#': { hp: 1, score: 1, color: '#fff', indestructible: true } },
      }),
    );
    expect(errors.join()).toMatch(/at least one destructible/);
  });
});

describe('compileLevel', () => {
  it('positions bricks on a top-down grid', () => {
    const compiled = compileLevel(level({ layout: ['#', '#'] }), grid);
    expect(compiled.cols).toBe(1);
    expect(compiled.rows).toBe(2);
    expect(compiled.brickCount).toBe(2);
    // Row 0 sits at the top: originY - row*cellHeight - cellHeight/2
    expect(compiled.bricks[0]!.y).toBe(600 - 25);
    expect(compiled.bricks[1]!.y).toBe(600 - 50 - 25);
    // X is centred in the column.
    expect(compiled.bricks[0]!.x).toBe(50);
  });

  it('subtracts the gap from the drawn size', () => {
    const compiled = compileLevel(level({ layout: ['#'] }), grid);
    expect(compiled.bricks[0]!.width).toBe(96);
    expect(compiled.bricks[0]!.height).toBe(46);
  });

  it('skips empty cells and counts only destructible bricks', () => {
    const compiled = compileLevel(
      level({
        layout: ['#.#', '.#.'],
        legend: {
          '#': { hp: 1, score: 5, color: '#fff' },
          '=': { hp: 99, score: 0, color: '#000', indestructible: true },
        },
      }),
      grid,
    );
    expect(compiled.bricks).toHaveLength(3);
    expect(compiled.brickCount).toBe(3);
  });

  it('treats indestructible bricks as non-counting but present', () => {
    const compiled = compileLevel(
      level({
        layout: ['=#'],
        legend: {
          '#': { hp: 1, score: 5, color: '#fff' },
          '=': { hp: 1, score: 0, color: '#000', indestructible: true },
        },
      }),
      grid,
    );
    expect(compiled.bricks).toHaveLength(2);
    expect(compiled.brickCount).toBe(1);
    expect(compiled.bricks.find((b) => b.indestructible)!.indestructible).toBe(true);
  });

  it('carries hp/score/colour and the optional damage override', () => {
    const compiled = compileLevel(
      level({
        layout: ['#'],
        legend: { '#': { hp: 3, score: 25, color: '#ff0000', damage: 2 } },
      }),
      grid,
    );
    const brick = compiled.bricks[0]!;
    expect(brick.hp).toBe(3);
    expect(brick.maxHp).toBe(3);
    expect(brick.score).toBe(25);
    expect(brick.color).toBe('#ff0000');
    expect(brick.damage).toBe(2);
    expect(brick.destroyed).toBe(false);
  });

  it('carries per-level overrides through', () => {
    const compiled = compileLevel(level({ ballSpeed: 420, paddleWidth: 140, parTime: 45 }), grid);
    expect(compiled.def.ballSpeed).toBe(420);
    expect(compiled.def.paddleWidth).toBe(140);
    expect(compiled.def.parTime).toBe(45);
  });

  it('throws with an actionable message on invalid data', () => {
    expect(() => compileLevel(level({ layout: ['#', '##'] }), grid)).toThrow(/row 1 has width/);
  });
});

describe('compileLevels', () => {
  it('compiles a batch', () => {
    const out = compileLevels([level({ id: 'a' }), level({ id: 'b' })], grid);
    expect(out.map((c) => c.def.id)).toEqual(['a', 'b']);
  });

  it('aggregates every error at once', () => {
    expect(() =>
      compileLevels([level({ id: 'a', layout: ['#', '##'] }), level({ id: 'b', layout: ['#%'] })], grid),
    ).toThrow(/Invalid level data:[\s\S]*row 1 has width[\s\S]*missing from legend/);
  });
});
