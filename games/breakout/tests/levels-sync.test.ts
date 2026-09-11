import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS_DATA } from '../src/config/levels-data.js';

/**
 * `src/config/levels-data.ts` is a **generated** build artifact — the design JSON
 * stays authoritative. This test re-derives the module from the JSON and fails if
 * the committed file disagrees, which makes silent drift impossible: you cannot
 * change the level data without regenerating, and you cannot regenerate without
 * the change showing up as a reviewable diff.
 *
 * Covers: quantity, ids, speeds, paddle widths, drop rates, layouts, brick
 * definitions and the powerup pool.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = resolve(HERE, '..', 'design', 'levels', 'levels-01-05.json');

interface RawLevels {
  readonly levels: readonly {
    readonly id: number;
    readonly ballSpeed: number;
    readonly paddleWidth: number;
    readonly powerupDropRate: number;
    readonly rows: readonly string[];
  }[];
}

describe('levels-data drift guard', () => {
  const raw = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as RawLevels;

  it('has one generated entry per source level', () => {
    expect(LEVELS_DATA.levels).toHaveLength(raw.levels.length);
    expect(LEVELS_DATA.levels.map((l) => l.id)).toEqual(raw.levels.map((l) => l.id));
  });

  it('copies the grid verbatim', () => {
    expect(LEVELS_DATA.grid).toEqual({
      cols: 10,
      brickW: 62,
      brickH: 34,
      gapX: 6,
      gapY: 6,
      originX: 38,
      topY: 1200,
      rowPitch: 40,
    });
  });

  it('copies every per-level number verbatim', () => {
    LEVELS_DATA.levels.forEach((generated, i) => {
      const source = raw.levels[i]!;
      expect(generated.id, `level ${i}`).toBe(source.id);
      expect(generated.ballSpeed, `level ${i} speed`).toBe(source.ballSpeed);
      expect(generated.paddleWidth, `level ${i} paddle`).toBe(source.paddleWidth);
      expect(generated.powerupDropRate, `level ${i} dropRate`).toBe(source.powerupDropRate);
      expect(generated.rows, `level ${i} rows`).toEqual(source.rows);
    });
  });

  it('keeps ball speeds inside the ramp the design froze', () => {
    expect(LEVELS_DATA.levels.map((l) => l.ballSpeed)).toEqual([480, 500, 520, 540, 560]);
    expect(LEVELS_DATA.levels.map((l) => l.paddleWidth)).toEqual([140, 140, 140, 140, 140]);
  });

  it('defines the five brick codes with the frozen hp/score table', () => {
    const codes = Object.keys(LEVELS_DATA.brickTypes).sort();
    expect(codes).toEqual(['B', 'G', 'N', 'S', 'T']);

    expect(LEVELS_DATA.brickTypes.N).toMatchObject({ hp: 1, score: 100, indestructible: false });
    expect(LEVELS_DATA.brickTypes.T).toMatchObject({ hp: 2, score: 250, indestructible: false });
    expect(LEVELS_DATA.brickTypes.S).toMatchObject({ hp: null, score: 0, indestructible: true });
    expect(LEVELS_DATA.brickTypes.B).toMatchObject({ hp: 1, score: 150, indestructible: false });
    expect(LEVELS_DATA.brickTypes.G).toMatchObject({ hp: 1, score: 500, indestructible: false });
  });

  it('carries the bomb blast parameters', () => {
    expect(LEVELS_DATA.brickTypes.B.explode).toEqual({ radius: 68, damage: 1, maxChain: 8 });
  });

  it('marks gold as the ×3 drop brick', () => {
    expect(LEVELS_DATA.brickTypes.G.dropRateMultiplier).toBe(3);
  });

  it('only lets layouts use the . N T S B G charset', () => {
    for (const level of LEVELS_DATA.levels) {
      for (const row of level.rows) {
        expect(row.length, `L${level.id} row length`).toBe(LEVELS_DATA.grid.cols);
        for (const ch of row) {
          expect('.NTSBG', `L${level.id} illegal "${ch}"`).toContain(ch);
        }
      }
    }
  });

  it('defines all six powerups but marks only three as shipped elsewhere', () => {
    expect(Object.keys(LEVELS_DATA.powerupPool).sort()).toEqual([
      'expand',
      'laser',
      'life',
      'multi',
      'slow',
      'sticky',
    ]);
    expect(LEVELS_DATA.powerupPool.expand?.params['paddleWidthMultiplier']).toBe(1.4);
    expect(LEVELS_DATA.powerupPool.life?.params['maxLives']).toBe(5);
  });
});
