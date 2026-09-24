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
import { LEVELS_DATA } from '../src/config/levels-data.js';
import { PALETTES } from '../src/config/palettes-data.js';
import { draftToLevel } from '../src/game/level-import.js';

const hasError = (errors: readonly string[], fragment: string): boolean =>
  errors.some((e) => e.includes(fragment));

/** 11 色（索引 1–9 + `A`=10 + `B`=11）且最大索引 11 > demo 色板 ⇒ B1 适用域内样本。 */
const ELEVEN_COLOUR_PATTERN = ['123456', '789AB1', '234567', '89AB12', '345678'];

describe('beads charset mapping', () => {
  it('maps "." / "x" to null, digits and A–Z to palette indices (§3.2 v1.55)', () => {
    expect(colorIndexOfChar('.')).toBeNull();
    expect(colorIndexOfChar('x')).toBeNull();
    expect(colorIndexOfChar('1')).toBe(1);
    expect(colorIndexOfChar('9')).toBe(9);
    expect(colorIndexOfChar('A')).toBe(10);
    // §3.2 v1.55：charset 由 `.x1-9A` 扩到 `.x1-9A-Z` ⇒ `B`…`Z` 不再是「非法」。
    expect(colorIndexOfChar('B')).toBe(11);
    expect(colorIndexOfChar('Z')).toBe(35);
    // Anything outside the charset is `undefined` (= invalid), not `null`.
    expect(colorIndexOfChar('0')).toBeUndefined();
    expect(colorIndexOfChar('a')).toBeUndefined(); // 大小写敏感（`x`=锁定符、`X`=索引 33）
    expect(colorIndexOfChar(' ')).toBeUndefined();
  });

  it('agrees with isBeadCharsetChar on every character it accepts', () => {
    const samples = ['.', 'x', '1', '5', '9', 'A', 'B', 'Z', '0', 'a', 'z', ' '];
    for (const ch of samples) {
      expect(isBeadCharsetChar(ch), ch).toBe(colorIndexOfChar(ch) !== undefined);
    }
  });

  it('round-trips charOfColor and refuses indices outside the charset', () => {
    for (let idx = 1; idx <= BEAD_COLOR_MAX; idx++) {
      expect(colorIndexOfChar(charOfColor(idx)), `idx ${idx}`).toBe(idx);
    }
    expect(charOfColor(1)).toBe('1');
    expect(charOfColor(10)).toBe('A'); // 旧上限位仍是合法色
    expect(charOfColor(BEAD_COLOR_MAX)).toBe('Z');
    expect(() => charOfColor(0)).toThrow();
    // ⚠ 本行只在 §3.2 未顶满编码容量时才是「越界可构造」硬判据；现值 35 =
    // 字符集容量 ⇒ 判据的完整口径见 `bead-charset.test.ts` X4（含自我复位哨兵）。
    expect(() => charOfColor(BEAD_COLOR_MAX + 1)).toThrow();
  });

  it('collects distinct pattern colours ascending, ignoring empty/locked cells', () => {
    expect(patternColors(['1.2', 'x31'])).toEqual([1, 2, 3]);
    expect(levelColors(simpleTestLevel())).toEqual([1, 2, 3]);
    expect(decoyColorIndices(simpleTestLevel({ decoys: ['5', 'x', 'A'] }))).toEqual([5, 10]);
    // §3.2 v1.55：扩展字符同样参与升序汇总（旧表下 `C`=12 根本解不出来）。
    expect(patternColors(['1C2', 'B31'])).toEqual([1, 2, 3, 11, 12]);
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

    // §3.2 v1.36→v1.55：`BEAD_COLOR_MAX` 8→10→35，而 charset 也同步扩到 `A-Z`（=编码容量）
    // ⇒「字符越上限」分支仍不可构造（旧 `A`=10 恰等上限 → 今 `Z`=35 恰等上限），
    // 本例保留反向断言：charset 内的最深两色 9/A 合法且仍 ≤ demo 色板（不触发 B1）。
    // （`B`…`Z` 的解码合法性 = `bead-charset.test.ts` X1；越 demo 面的 = 下方 B1 组。）
    const withReserved = simpleTestLevel({ pattern: ['123129', '12312A', '123123', '123123', '123123'] });
    expect(hasError(validateBeadsLevel(withReserved), 'BEAD_COLOR_MAX')).toBe(false);
    expect(levelColors(withReserved)).toEqual([1, 2, 3, 9, 10]);
    expect(validateBeadsLevel(withReserved)).toEqual([]);
  });

  it('rejects a board with nothing fillable (all locked / all void)', () => {
    const locked = simpleTestLevel({ pattern: ['xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx'] });
    expect(hasError(validateBeadsLevel(locked), 'at least one fillable cell')).toBe(true);
  });

  it('rejects a colour count below 3 and above the ceiling', () => {
    const two = simpleTestLevel({ pattern: ['121212', '121212', '121212', '121212', '121212'] });
    expect(hasError(validateBeadsLevel(two), 'colour count 2 < 3')).toBe(true);

    // §3.2 v1.36：10 色 = 旧上限，仍合法（且 ≤ demo 色板 ⇒ 不触发 B1）。
    const ten = simpleTestLevel({
      pattern: ['12345678', '9A234567', '89123456', '78912345', '67891234'],
      cols: 8,
    });
    expect(validateBeadsLevel(ten)).toEqual([]);

    // §3.2 v1.55：上限 10→35 ⇒ 旧判「>10 拒收」作废；11 色本身合法，
    // 但越出 demo 色板 ⇒ 必携品牌引用（见下方 B1 组）。
    const elevenNoRef = simpleTestLevel({ pattern: ELEVEN_COLOUR_PATTERN, cols: 6 });
    expect(hasError(validateBeadsLevel(elevenNoRef), 'BEAD_COLOR_MAX')).toBe(false);
  });

  // ⛔ 供料残余（E3 移交 / E5 清理）：`spawnInterval` 字段已随供料关停在
  // levels JSON version 2 删除，其区间校验与这 3 条判据一并作废
  // （levels-spec v1.2：「version:2 清理时删除」）。
  it('rejects time outside its §3.5 band (v1.23: [120, 420])', () => {
    expect(
      hasError(validateBeadsLevel(simpleTestLevel({ time: LEVEL_TIME_MIN - 1 })), `time ${LEVEL_TIME_MIN - 1}`),
    ).toBe(true);
    expect(
      hasError(validateBeadsLevel(simpleTestLevel({ time: LEVEL_TIME_MAX + 1 })), `time ${LEVEL_TIME_MAX + 1}`),
    ).toBe(true);
    // NaN 是 number，且与任何数比较都为 false —— 若用 `typeof === 'number'` 判定就会漏网，
    // 结果是倒计时恒为 NaN、归零失败永不触发（关卡既赢不了也输不了）。
    expect(hasError(validateBeadsLevel(simpleTestLevel({ time: Number.NaN })), 'time NaN')).toBe(true);
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

/**
 * B1 护栏（§3.2 v1.55 连带，正本 §2.6-ⓐ / §5-B1）：「`pattern` 越出 demo 色板却
 * 整对品牌引用字段缺席」必须在 BOOT 拒收。
 *
 * 为何旧上限拦不住：`BEAD_COLOR_MAX = 10` 时「>10 色」本身就被拒 ⇒ 顺带遮住了
 * 这个组合。抬到 35 后不再有任意一层拦它，而渲染侧的回落链是**静默**的（`view/palette.ts`
 * `resolveInkHexes` 返 demo 十色、`beadColorOf` 越界返炭黑）⇒ 一关可以完整跑起来、
 * 只是盘面一片炭黑。「不限制」不得等于「不限制到全黑」。
 *
 * 本组不硬编 demo 色板长度：边界样本全部由 `LEVELS_DATA.palette.length` 与
 * `charOfColor()` 现构造 ⇒ demo 色板日后改动时判据自动跟随。
 */
describe('B1 · >demo 色板必携品牌引用（§3.2 v1.55 护栏）', () => {
  const demoLen = LEVELS_DATA.palette?.length ?? 0;

  /** 造一个「用满 `n` 色且最大索引 = `n`」的 6×5 盘（行内轮转，保证 ≥3 色、同色不连续）。 */
  const patternWithColors = (n: number): string[] => {
    const alphabet: string[] = [];
    for (let i = 1; i <= n; i++) alphabet.push(charOfColor(i));
    const out: string[] = [];
    for (let r = 0; r < 5; r++) {
      let row = '';
      for (let c = 0; c < 6; c++) row += alphabet[(r * 6 + c) % n]!;
      out.push(row);
    }
    return out;
  };

  /** 注册表里首个能撑起 `n` 个不同色号的品牌（不发明色号，真源 = art/*.json）。 */
  const brandWithCodes = (n: number): { slug: string; codes: string[] } => {
    for (const slug of Object.keys(PALETTES)) {
      const codes = PALETTES[slug]!.codes;
      if (codes.length >= n) return { slug, codes: codes.slice(0, n) as string[] };
    }
    throw new Error(`PALETTES 注册表无 ≥${n} 色品牌 ⇒ B1「携引用即放行」侧无法取样`);
  };

  it('前提：demo 回落色板在场（本组边界样本皆以它为基准）', () => {
    expect(demoLen).toBeGreaterThanOrEqual(3);
  });

  it('越 demo 色板且无品牌引用 ⇒ 拒收（错误含最大索引与 demo 长度）', () => {
    const over = simpleTestLevel({ pattern: patternWithColors(demoLen + 1) });
    const errors = validateBeadsLevel(over);
    expect(hasError(errors, `pattern 最大色索引 ${demoLen + 1} > demo 色板 ${demoLen} 色`)).toBe(true);
    expect(hasError(errors, '必携 palette + paletteCodes')).toBe(true);
  });

  it('同一盘补上成对品牌引用 ⇒ 放行（红→绿，不拦合法多色关）', () => {
    const over = simpleTestLevel({ pattern: patternWithColors(demoLen + 1) });
    expect(validateBeadsLevel(over).length).toBeGreaterThan(0); // 上例的「红」
    const brand = brandWithCodes(demoLen + 1);
    const fixed = simpleTestLevel({
      pattern: over.pattern,
      palette: brand.slug,
      paletteCodes: brand.codes,
    });
    expect(validateBeadsLevel(fixed)).toEqual([]);
  });

  it('边界：最大索引恰 = demo 色板长度 ⇒ 仍可不携引用（现 8 关形态，零扰动）', () => {
    expect(validateBeadsLevel(simpleTestLevel({ pattern: patternWithColors(demoLen) }))).toEqual([]);
  });

  it('携了引用但色号不够长 / 不够成对 / slug 未知 ⇒ 仍按原规则拒收', () => {
    const pattern = patternWithColors(demoLen + 1);
    const brand = brandWithCodes(demoLen + 1);
    expect(
      hasError(
        validateBeadsLevel(simpleTestLevel({ pattern, palette: brand.slug, paletteCodes: brand.codes.slice(0, 3) })),
        `paletteCodes 3 < pattern 最大色索引 ${demoLen + 1}`,
      ),
    ).toBe(true);
    expect(
      hasError(validateBeadsLevel(simpleTestLevel({ pattern, paletteCodes: brand.codes })), '必须成对出现'),
    ).toBe(true);
    expect(
      hasError(validateBeadsLevel(simpleTestLevel({ pattern, palette: 'no-such-brand', paletteCodes: brand.codes })), '未知色板 slug'),
    ).toBe(true);
  });

  // 入关期同校（正本 §5-B3）：游戏内「一键导入」走的是同一个 `validateBeadsLevel`，
  // 不得出现「dev 关表绿、产物红」（也不得反过来：转换层自己放宽）。
  it('level-import 转换层同校：>demo 色板的草案一样被拒，≤demo 的照旧导入', () => {
    const draftOver = {
      cols: 6,
      rows: 5,
      time: 300,
      pattern: patternWithColors(demoLen + 1),
      swaps: [[0, 0, 0, 1] as const],
    };
    const rejected = draftToLevel(draftOver, 9001, '导入越界关');
    expect(rejected.ok).toBe(false);
    expect(hasError(rejected.errors, '必携 palette + paletteCodes')).toBe(true);

    const draftOk = {
      cols: 6,
      rows: 5,
      time: 300,
      pattern: patternWithColors(demoLen),
      swaps: [[0, 0, 0, 1] as const],
    };
    const accepted = draftToLevel(draftOk, 9002, '导入 demo 色板内关');
    expect(accepted.errors).toEqual([]);
    expect(accepted.ok).toBe(true);
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
