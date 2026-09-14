/**
 * `config/levels.ts` — 字符集映射、BOOT 校验器（architecture-beads §6）与冲刺关卡构造。
 *
 * Why this file exists: the BOOT validator is the *only* thing standing between a
 * malformed level and `PLAYING` (core-loop §2.1: 「不允许带病进入 PLAYING」), and it
 * had no test. `levels:check` covers data↔JSON sync; it does not cover the rules.
 */

import { describe, it, expect } from 'vitest';
import {
  BEAD_COLOR_MAX,
  DECOY_COLORS_MAX,
  DEMO_LEVEL_COUNT,
  GRID_MAX_COLS,
  GRID_MAX_ROWS,
  GRID_MIN_COLS,
  GRID_MIN_ROWS,
  LEVEL_TIME_MAX,
  LEVEL_TIME_MIN,
  SPAWN_INTERVAL_MAX,
  SPAWN_INTERVAL_MIN,
  stageParamsFor,
} from '../src/config/tuning.js';
import {
  LEVELS,
  buildStagePattern,
  charOfColor,
  colorIndexOfChar,
  decoyColorIndices,
  isBeadCharsetChar,
  levelAt,
  levelColors,
  levelIdOf,
  patternColors,
  validateBeadsLevel,
} from '../src/config/levels.js';
import { simpleTestLevel } from './helpers.js';

const hasError = (errors: readonly string[], fragment: string): boolean =>
  errors.some((e) => e.includes(fragment));

describe('beads charset mapping', () => {
  it('maps "." / "x" to null, digits and A to palette indices', () => {
    expect(colorIndexOfChar('.')).toBeNull();
    expect(colorIndexOfChar('x')).toBeNull();
    expect(colorIndexOfChar('1')).toBe(1);
    expect(colorIndexOfChar('9')).toBe(9);
    expect(colorIndexOfChar('A')).toBe(10);
    // Anything outside the charset is `undefined` (= invalid), not `null`.
    expect(colorIndexOfChar('0')).toBeUndefined();
    expect(colorIndexOfChar('B')).toBeUndefined();
    expect(colorIndexOfChar(' ')).toBeUndefined();
  });

  it('agrees with isBeadCharsetChar on every character it accepts', () => {
    const samples = ['.', 'x', '1', '5', '9', 'A', '0', 'B', 'z', ' '];
    for (const ch of samples) {
      expect(isBeadCharsetChar(ch), ch).toBe(colorIndexOfChar(ch) !== undefined);
    }
  });

  it('round-trips charOfColor and refuses indices outside the charset', () => {
    for (let idx = 1; idx <= 10; idx++) {
      expect(colorIndexOfChar(charOfColor(idx))).toBe(idx);
    }
    expect(() => charOfColor(0)).toThrow();
    expect(() => charOfColor(11)).toThrow();
  });

  it('collects distinct pattern colours ascending, ignoring empty/locked cells', () => {
    expect(patternColors(['1.2', 'x31'])).toEqual([1, 2, 3]);
    expect(levelColors(simpleTestLevel())).toEqual([1, 2, 3]);
    expect(decoyColorIndices(simpleTestLevel({ decoys: ['5', 'x', 'A'] }))).toEqual([5, 10]);
  });
});

describe('beads BOOT validator (architecture-beads §6)', () => {
  it('accepts a well-formed level and every shipped level', () => {
    expect(validateBeadsLevel(simpleTestLevel())).toEqual([]);
    expect(LEVELS).toHaveLength(DEMO_LEVEL_COUNT);
    for (const level of LEVELS) {
      expect(validateBeadsLevel(level), `level ${level.id}`).toEqual([]);
    }
  });

  it('rejects a pattern that is not a non-empty array', () => {
    expect(hasError(validateBeadsLevel(simpleTestLevel({ pattern: [] })), 'non-empty array')).toBe(true);
  });

  it('rejects declared metadata that disagrees with the pattern shape', () => {
    expect(hasError(validateBeadsLevel(simpleTestLevel({ cols: 5 })), 'declared cols 5')).toBe(true);
    expect(hasError(validateBeadsLevel(simpleTestLevel({ rows: 4 })), 'declared rows 4')).toBe(true);
  });

  it('rejects out-of-range dimensions and ragged rows', () => {
    const narrow = simpleTestLevel({ cols: 5, rows: 5, pattern: Array(5).fill('12312') as string[] });
    expect(hasError(validateBeadsLevel(narrow), `cols 5 outside [${GRID_MIN_COLS}, ${GRID_MAX_COLS}]`)).toBe(true);

    const short = simpleTestLevel({ rows: 4, pattern: ['123123', '123123', '123123', '123123'] });
    expect(hasError(validateBeadsLevel(short), `rows 4 outside [${GRID_MIN_ROWS}, ${GRID_MAX_ROWS}]`)).toBe(true);

    const ragged = simpleTestLevel({ pattern: ['123123', '1231', '123123', '123123', '123123'] });
    expect(hasError(validateBeadsLevel(ragged), 'row1: width 4')).toBe(true);
  });

  it('rejects characters outside the charset and indices over the colour ceiling', () => {
    const illegal = simpleTestLevel({ pattern: ['12312z', '123123', '123123', '123123', '123123'] });
    expect(hasError(validateBeadsLevel(illegal), 'illegal char "z"')).toBe(true);

    // 'A' = index 10 > BEAD_COLOR_MAX(8) — legal charset, over the ceiling.
    const overCeiling = simpleTestLevel({ pattern: ['12312A', '123123', '123123', '123123', '123123'] });
    expect(hasError(validateBeadsLevel(overCeiling), `> BEAD_COLOR_MAX(${BEAD_COLOR_MAX})`)).toBe(true);
  });

  it('rejects a board with nothing fillable (all locked / all void)', () => {
    const locked = simpleTestLevel({ pattern: ['xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx'] });
    expect(hasError(validateBeadsLevel(locked), 'at least one fillable cell')).toBe(true);
  });

  it('rejects a colour count below 3 and above the ceiling', () => {
    const two = simpleTestLevel({ pattern: ['121212', '121212', '121212', '121212', '121212'] });
    expect(hasError(validateBeadsLevel(two), 'colour count 2 < 3')).toBe(true);

    const ten = simpleTestLevel({
      pattern: ['12345678', '9A234567', '89123456', '78912345', '67891234'],
      cols: 8,
    });
    expect(hasError(validateBeadsLevel(ten), `> BEAD_COLOR_MAX(${BEAD_COLOR_MAX})`)).toBe(true);
  });

  it('rejects time and spawn interval outside their §3.5 / §3.4 bands', () => {
    expect(
      hasError(validateBeadsLevel(simpleTestLevel({ time: LEVEL_TIME_MIN - 1 })), `time ${LEVEL_TIME_MIN - 1}`),
    ).toBe(true);
    expect(
      hasError(validateBeadsLevel(simpleTestLevel({ time: LEVEL_TIME_MAX + 1 })), `time ${LEVEL_TIME_MAX + 1}`),
    ).toBe(true);
    // NaN 是 number，且与任何数比较都为 false —— 若用 `typeof === 'number'` 判定就会漏网，
    // 结果是倒计时恒为 NaN、归零失败永不触发（关卡既赢不了也输不了）。
    expect(hasError(validateBeadsLevel(simpleTestLevel({ time: Number.NaN })), 'time NaN')).toBe(true);
    expect(
      hasError(validateBeadsLevel(simpleTestLevel({ spawnInterval: Number.NaN })), 'spawnInterval NaN'),
    ).toBe(true);
    expect(
      hasError(
        validateBeadsLevel(simpleTestLevel({ spawnInterval: SPAWN_INTERVAL_MIN - 0.1 })),
        `spawnInterval ${SPAWN_INTERVAL_MIN - 0.1}`,
      ),
    ).toBe(true);
    expect(
      hasError(
        validateBeadsLevel(simpleTestLevel({ spawnInterval: SPAWN_INTERVAL_MAX + 0.1 })),
        'spawnInterval',
      ),
    ).toBe(true);
  });

  it('rejects too many decoys, illegal decoys and decoys colliding with the pattern', () => {
    expect(
      hasError(validateBeadsLevel(simpleTestLevel({ decoys: ['4', '5', '6'] })), `> DECOY_COLORS_MAX(${DECOY_COLORS_MAX})`),
    ).toBe(true);
    expect(hasError(validateBeadsLevel(simpleTestLevel({ decoys: ['z'] })), 'decoy "z" is not in charset')).toBe(true);
    expect(hasError(validateBeadsLevel(simpleTestLevel({ decoys: ['2'] })), 'overlaps pattern colour 2')).toBe(true);
  });

  // §3.2 v1.17（U8=D）：`DECOY_COLORS_MAX=0` 后不再有「合法杂色」——
  // 空 decoys 合法，任何非空 decoys 均越界（供料侧不再参与图案的杂色）。
  it('v1.17 DECOY_COLORS_MAX=0: accepts empty decoys, rejects any decoy colour', () => {
    expect(validateBeadsLevel(simpleTestLevel({ decoys: [] }))).toEqual([]);
    // 即便字符集合法、与图案不相交（'5' 非 simpleTestLevel 图案色 1/2/3），单一 decoy 也越 max=0。
    expect(
      hasError(validateBeadsLevel(simpleTestLevel({ decoys: ['5'] })), `> DECOY_COLORS_MAX(${DECOY_COLORS_MAX})`),
    ).toBe(true);
  });

  it('exposes the framework-level id and index lookup used by the app', () => {
    expect(levelIdOf(simpleTestLevel({ id: 7 }))).toBe('l7');
    expect(levelAt(0)).toBe(LEVELS[0]);
    expect(levelAt(LEVELS.length)).toBeUndefined();
  });
});

describe('buildStagePattern (score-combo §2.3 + levels-spec §9)', () => {
  it('is deterministic and cycles the shipped pattern pool by shape', () => {
    for (const stage of [0, 1, 7, 8, 15]) {
      const a = buildStagePattern(stage);
      const b = buildStagePattern(stage);
      expect(a).toEqual(b);
      const pool = LEVELS[stage % LEVELS.length]!;
      expect(a.pattern).toHaveLength(pool.pattern.length);
      for (let i = 0; i < a.pattern.length; i++) {
        expect(a.pattern[i]).toHaveLength(pool.pattern[i]!.length);
      }
    }
  });

  it('never exceeds the C6 colour budget for the stage', () => {
    for (let stage = 0; stage < 24; stage++) {
      const built = buildStagePattern(stage);
      expect(built.colors).toBeLessThanOrEqual(stageParamsFor(stage).colors);
      expect(built.colors).toBe(patternColors(built.pattern).length);
    }
  });

  it('treats negative and non-finite stages as the first rung', () => {
    expect(buildStagePattern(-2)).toEqual(buildStagePattern(0));
    expect(buildStagePattern(Number.NaN)).toEqual(buildStagePattern(0));
  });
});
