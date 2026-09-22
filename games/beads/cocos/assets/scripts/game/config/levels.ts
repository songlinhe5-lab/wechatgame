/**
 * Beads level config — charset mapping, the level table and the BOOT validator.
 *
 * ⚠️ AUTHORITY: content comes from `design/levels/levels-01-08.json` via the
 * generated `./levels-data.ts` (ADR-0004 row-string form). Nothing here may
 * re-declare times, spawn intervals or layouts — those are owned by the data,
 * which in turn is frozen by `design/gdd/systems-index.md §3`.
 *
 * Validation errors use the levels-spec §8 format: `L{id} row{i} col{j}: ...`.
 */

import {
  BEAD_CHARSET,
  BEAD_COLOR_MAX,
  DECOY_COLORS_MAX,
  GRID_MAX_COLS,
  GRID_MAX_ROWS,
  GRID_MIN_COLS,
  GRID_MIN_ROWS,
  LEVEL_TIME_MAX,
  LEVEL_TIME_MIN,
  stageParamsFor,
  type StageParams,
} from './tuning';
import { validateSwaps, validateMisplacedGrid } from '../game/misplaced-assembler';
import { LEVELS_DATA, type BeadsLevelRaw } from './levels-data';
import { PALETTES } from './palettes-data';

export type { BeadsLevelRaw };

/** The empty (fillable) character. */
export const EMPTY_CHAR = '.';
/** The locked character (not fillable, not counted for completion). */
export const LOCKED_CHAR = 'x';

/** `.`/`x` → null; `1-9` → 1..9; `A` → 10. Anything else → undefined (invalid). */
export function colorIndexOfChar(ch: string): number | null | undefined {
  if (ch === EMPTY_CHAR || ch === LOCKED_CHAR) return null;
  if (ch >= '1' && ch <= '9') return ch.charCodeAt(0) - 48; // '1' → 1 … '9' → 9
  if (ch === 'A') return 10;
  return undefined;
}

/** Inverse mapping used when generating sprint stage patterns. */export function charOfColor(colorIdx: number): string {
  if (colorIdx >= 1 && colorIdx <= 9) return String(colorIdx);
  if (colorIdx === 10) return 'A';
  throw new Error(`charOfColor: colorIdx ${colorIdx} outside BEAD_CHARSET`);
}

/**
 * Charset membership. `BEAD_CHARSET = ".x1-9A"` uses a *regex-style* range
 * notation (1-9 = digits one through nine), so a literal `includes()` on the
 * notation string is wrong — expand the range explicitly.
 */
export function isBeadCharsetChar(ch: string): boolean {
  return ch === EMPTY_CHAR || ch === LOCKED_CHAR || (ch >= '1' && ch <= '9') || ch === 'A';
}

/** Decoy colour characters → palette indices (invalid chars are dropped by the validator first). */
export function decoyColorIndices(level: BeadsLevelRaw): number[] {
  const out: number[] = [];
  for (const ch of level.decoys) {
    const idx = colorIndexOfChar(ch);
    if (typeof idx === 'number') out.push(idx);
  }
  return out;
}

/**
 * The distinct pattern colour indices of a level (ascending).
 *
 * Must convert the Set with `Array.from`; spread syntax is not allowed here: the
 * Cocos ES5 build lowers a spread of a non-array iterable into a concat form that
 * does not expand it, so this returned exactly one colour on device,
 * `validateBeadsLevel` rejected all 8 levels and BOOT never finished
 * (G10 / ADR-0012; guarded by tools/scripts/check-es5-spread.mjs).
 * Note: comments ship inside the bundle, so this one deliberately avoids the
 * literal source forms — they would pollute artifact grep forensics.
 */
export function patternColors(pattern: readonly string[]): number[] {
  const seen = new Set<number>();
  for (const row of pattern) {
    for (const ch of row) {
      const idx = colorIndexOfChar(ch);
      if (typeof idx === 'number') seen.add(idx);
    }
  }
  return Array.from(seen).sort((a, b) => a - b);
}

/** Distinct pattern colours of a single level record. */
export function levelColors(level: BeadsLevelRaw): number[] {
  return patternColors(level.pattern);
}

/**
 * BOOT-level static validation (architecture-beads §6 checklist).
 * Structural rules only — playability/difficulty belongs to the QA script.
 * @returns an array of human-readable errors; empty means valid.
 */
export function validateBeadsLevel(level: BeadsLevelRaw): string[] {
  const errors: string[] = [];
  const tag = `L${level.id}`;

  if (!Array.isArray(level.pattern) || level.pattern.length === 0) {
    errors.push(`${tag}: pattern must be a non-empty array of row strings`);
    return errors;
  }

  const rows = level.pattern.length;
  const cols = level.pattern[0]!.length;

  // Dimensions vs declared metadata (rows is a redundant self-check field).
  if (level.cols !== cols) {
    errors.push(`${tag}: declared cols ${level.cols} ≠ pattern width ${cols}`);
  }
  if (level.rows !== rows) {
    errors.push(`${tag}: declared rows ${level.rows} ≠ pattern height ${rows}`);
  }
  if (cols < GRID_MIN_COLS || cols > GRID_MAX_COLS) {
    errors.push(`${tag}: cols ${cols} outside [${GRID_MIN_COLS}, ${GRID_MAX_COLS}]`);
  }
  if (rows < GRID_MIN_ROWS || rows > GRID_MAX_ROWS) {
    errors.push(`${tag}: rows ${rows} outside [${GRID_MIN_ROWS}, ${GRID_MAX_ROWS}]`);
  }

  // Charset + row width (levels-spec §7.1: anything outside BEAD_CHARSET is an error).
  let fillable = 0;
  for (let i = 0; i < rows; i++) {
    const row = level.pattern[i]!;
    if (row.length !== cols) {
      errors.push(`${tag} row${i}: width ${row.length} ≠ cols ${cols}`);
    }
    for (let j = 0; j < row.length; j++) {
      const ch = row[j]!;
      if (!isBeadCharsetChar(ch)) {
        errors.push(`${tag} row${i} col${j}: illegal char "${ch}" (charset ${BEAD_CHARSET})`);
        continue;
      }
      const idx = colorIndexOfChar(ch);
      if (typeof idx === 'number' && idx > BEAD_COLOR_MAX) {
        errors.push(
          `${tag} row${i} col${j}: palette index ${idx} > BEAD_COLOR_MAX(${BEAD_COLOR_MAX})`,
        );
      }
      if (idx !== null) fillable++; // both empty slots and colored cells are fillable
    }
  }

  // ≥1 fillable cell (core-loop §6: all-locked/pre-filled levels are rejected).
  if (fillable === 0) {
    errors.push(`${tag}: needs at least one fillable cell`);
  }

  // Colour count ∈ [3, BEAD_COLOR_MAX] (levels-spec §2).
  const colors = patternColors(level.pattern);
  if (colors.length < 3) {
    errors.push(`${tag}: pattern colour count ${colors.length} < 3`);
  }
  if (colors.length > BEAD_COLOR_MAX) {
    errors.push(`${tag}: pattern colour count ${colors.length} > BEAD_COLOR_MAX(${BEAD_COLOR_MAX})`);
  }

  // v1.40 品牌色板引用（可选，成对字段）：slug 必须在注册表内、色号逐项可解析、
  // 长度 ≥ pattern 最大色索引且 ≤ BEAD_COLOR_MAX。直接引 palettes-data（同层），
  // 不走 view/palette（避免 config → view 反向依赖）。
  const hasSlug = typeof level.palette === 'string';
  const hasCodes = Array.isArray(level.paletteCodes);
  if (hasSlug || hasCodes) {
    if (!hasSlug || !hasCodes) {
      errors.push(`${tag}: palette 与 paletteCodes 必须成对出现`);
    } else {
      const entry = PALETTES[level.palette!];
      if (!entry) {
        errors.push(`${tag}: 未知色板 slug "${level.palette}"（注册表无此品牌，检查 art/<slug>.json 与 palettes:sync）`);
      } else {
        const codes = level.paletteCodes!;
        const maxIdx = colors.length ? colors[colors.length - 1]! : 0;
        if (codes.length > BEAD_COLOR_MAX) {
          errors.push(`${tag}: paletteCodes ${codes.length} > BEAD_COLOR_MAX(${BEAD_COLOR_MAX})`);
        }
        if (codes.length < maxIdx) {
          errors.push(`${tag}: paletteCodes ${codes.length} < pattern 最大色索引 ${maxIdx}`);
        }
        for (const code of codes) {
          if (typeof code !== 'string' || entry.codes.indexOf(code) < 0) {
            errors.push(`${tag}: 色号 "${String(code)}" 不在色板 ${level.palette} 内`);
          }
        }
      }
    }
  }

  // time ∈ [LEVEL_TIME_MIN, LEVEL_TIME_MAX]（§3.5 v1.23 下沿随 `clamp(k × 45s, 120, 420)`
  // 由 180 放宽到 120；k ≤ 2 的关按定价就是 120 s，旧下沿会把它们全部拒收。
  // 上沿现为 **2500**（§3.5 v1.47 开发期验证档，旧值 420；上线前按 playtest 回调）——
  // 本校验与规模闸共用同一常量，改档零接线。）
  //
  // `Number.isFinite` (not `typeof === 'number'`): NaN **is** a number, and every
  // comparison against it is false, so a NaN would slip through both bounds. The
  // consequence is not cosmetic — a NaN countdown never reaches zero, so the only
  // documented failure condition (timer-gameover §3.5) could never fire.
  if (!Number.isFinite(level.time) || level.time < LEVEL_TIME_MIN || level.time > LEVEL_TIME_MAX) {
    errors.push(`${tag}: time ${level.time} outside [${LEVEL_TIME_MIN}, ${LEVEL_TIME_MAX}]`);
  }

  // ── 错位构造：`misplaced` 全错位初盘（v1.3）优先，否则 `swaps`（levels-spec
  // v1.2 §2.1 + systems-index v1.23 §3.13）。两者互斥：misplaced 存在即忽略 swaps
  // （数据侧 swaps 置空数组占位，不再套 MISPLACED_PAIRS 区间）。
  if (level.misplaced !== undefined && level.misplaced !== null) {
    for (const error of validateMisplacedGrid(tag, level.pattern, level.misplaced)) {
      errors.push(error);
    }
  } else {
    for (const error of validateSwaps(tag, level.pattern, level.swaps, level.cycleProfile)) {
      errors.push(error);
    }
  }

  // Decoys: ≤ DECOY_COLORS_MAX, valid chars, and disjoint from pattern colours.
  if (level.decoys.length > DECOY_COLORS_MAX) {
    errors.push(`${tag}: decoys ${level.decoys.length} > DECOY_COLORS_MAX(${DECOY_COLORS_MAX})`);
  }
  const patternSet = new Set(colors);
  for (const ch of level.decoys) {
    const idx = colorIndexOfChar(ch);
    if (idx === undefined) {
      errors.push(`${tag}: decoy "${ch}" is not in charset ${BEAD_CHARSET}`);
    } else if (typeof idx === 'number' && patternSet.has(idx)) {
      errors.push(`${tag}: decoy "${ch}" overlaps pattern colour ${idx}`);
    }
  }

  return errors;
}

/** Stable framework-facing level id, e.g. `l1` (breakout 判例). */
export function levelIdOf(level: BeadsLevelRaw): string {
  return `l${level.id}`;
}

/** The shipped level table, straight from the design data. */
export const LEVELS: readonly BeadsLevelRaw[] = Object.freeze(LEVELS_DATA.levels);

/** Look up a shipped level by index (0-based). */
export function levelAt(index: number): BeadsLevelRaw | undefined {
  return LEVELS[index];
}

// ───────────────────────────────────────────────────── sprint stage patterns

/**
 * The sprint pattern pool: the 8 shipped patterns cycled (levels-spec §9 /
 * score-combo §2.3 — no separate library, originals only).
 */
export const STAGE_PATTERN_POOL: readonly string[][] = Object.freeze(
  LEVELS.map((l) => [...l.pattern]),
);

/**
 * Build the pattern for sprint stage `n` (0-based).
 *
 * Mechanism (score-combo §2.3 + levels-spec §9): the pattern *shape* cycles
 * through the 8-pool (`pool[n % 8]`); the C6 colour budget is enforced by a
 * deterministic remap — when the pool pattern uses MORE distinct colours than
 * `stageParamsFor(n).colors`, the surplus colours merge onto the last mapped
 * index; fewer colours are kept as-is (never inventing colours).
 *
 * Documented deviation: C6's `cells` target is reported in `sprint:stage
 * nextParams` (as registered in systems-index §4), but the stage board itself
 * keeps the pool pattern's own shape — the pool is shape-frozen by design, so
 * per-stage cell counts follow the pool, not the formula. Flagged to the
 * design owner via the team lead; §3.10 remains untouched.
 */
export function buildStagePattern(stageIndex: number): { pattern: string[]; colors: number } {
  const n = Number.isFinite(stageIndex) && stageIndex > 0 ? Math.floor(stageIndex) : 0;
  const base = STAGE_PATTERN_POOL[n % STAGE_PATTERN_POOL.length]!;
  const params: StageParams = stageParamsFor(n);
  const colors = patternColors(base);
  const budget = Math.min(params.colors, colors.length);

  // Deterministic remap, only when the pool pattern EXCEEDS the C6 colour
  // budget: sorted distinct colours → 1..budget (surplus merges onto budget).
  // A pattern within budget keeps its own indices — never distort the art.
  const map = new Map<number, number>();
  if (colors.length > budget) {
    colors.forEach((c, i) => {
      map.set(c, Math.min(i + 1, budget));
    });
  }

  const pattern = base.map((row) =>
    // `row` is a **string**, so a spread would collapse the same way (ADR-0012).
    // Contrast with STAGE_PATTERN_POOL above, where the spread operand really is
    // an array and is therefore correct as-is.
    Array.from(row)
      .map((ch) => {
        const idx = colorIndexOfChar(ch);
        return typeof idx === 'number' ? charOfColor(map.get(idx) ?? idx) : ch;
      })
      .join(''),
  );
  return { pattern, colors: patternColors(pattern).length };
}
