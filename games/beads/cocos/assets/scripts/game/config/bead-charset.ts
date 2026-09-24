/**
 * BEAD_CHARSET — the **single** decode table for pattern row characters.
 *
 * ⚠️ Why this module exists: `systems-index.md §3.2` **v1.55** widened the
 * charset from `.x1-9A` (10 colours) to `.x1-9A-Z` (35 colours = the encoding
 * ceiling of the one-character-per-cell row string form, ADR-0004). Before that
 * the very same mapping was hand-written **four times** — `config/levels.ts`,
 * `entities/grid.ts`, `game/misplaced-assembler.ts` and
 * `tools/scripts/level-derange.mjs` — and the copies had already diverged
 * (derange carried a 12-character table, i.e. a silent colour drop above 12).
 * Proposal 判据 **X1** asks for one table-driven source, so every consumer now
 * imports here instead of re-deriving character ranges.
 *
 * Case sensitivity is part of the contract (§3.2 v1.55): `x` = locked cell,
 * `X` = colour index 33 (`Y` = 34, `Z` = 35). Any `toUpperCase()` /
 * case-insensitive regex would be a contract break — `String.prototype.indexOf`
 * is exact-match by construction.
 *
 * Layers: config data table (L2/L3 clean: no `cc`, no DOM, no `wx`, no
 * `Math.random`). `indexOf` allocates nothing, so this stays legal on hot paths.
 *
 * The tool side (`tools/scripts/lib/bead-charset.mjs`) cannot import TypeScript,
 * so it carries a mirrored literal; `tests/bead-charset.test.ts` locks the two
 * tables character by character.
 */

import { BEAD_CHARSET, BEAD_COLOR_MAX } from './tuning';

/** The empty slot character (outside the pattern shape; not fillable). */
export const EMPTY_CHAR = '.';
/** The locked character (not fillable, not counted for completion). */
export const LOCKED_CHAR = 'x';

/** Colour-index alphabet, in order: `1`…`9` then `A`…`Z` (uppercase only). */
const COLOR_ALPHABET = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * The colour part of the charset, truncated to `BEAD_COLOR_MAX`.
 *
 * This is the only place where a character ↔ index mapping is expressed. When
 * `BEAD_COLOR_MAX` reaches 35 the alphabet is exhausted (`1-9` + `A-Z`), so the
 * "index above the ceiling" branch of the BOOT validator stops being
 * constructible — see `tests/bead-charset.test.ts` for the sentinel that
 * re-arms that judgement if §3.2 ever lowers the ceiling again.
 */
export const BEAD_COLOR_CHARS: string = COLOR_ALPHABET.slice(0, BEAD_COLOR_MAX);

/**
 * `.` / `x` → `null`; a colour character → its **1-based** palette index;
 * anything else → `undefined` (= invalid, and the only value the BOOT
 * validator reports as `illegal char`).
 */
export function colorIndexOfChar(ch: string): number | null | undefined {
    if (ch === EMPTY_CHAR || ch === LOCKED_CHAR) return null;
    const pos = BEAD_COLOR_CHARS.indexOf(ch);
    return pos < 0 ? undefined : pos + 1;
}

/** Colour index → charset character. Throws outside `[1, BEAD_COLOR_MAX]`. */
export function charOfColor(colorIdx: number): string {
    const ch = BEAD_COLOR_CHARS[colorIdx - 1];
    if (ch === undefined) {
        throw new Error(
            `charOfColor: colorIdx ${colorIdx} outside BEAD_CHARSET ${BEAD_CHARSET} (BEAD_COLOR_MAX ${BEAD_COLOR_MAX})`,
        );
    }
    return ch;
}

/**
 * Charset membership — deliberately derived from the *same* table
 * {@link colorIndexOfChar} decodes with, so "legal but undecodable" cannot
 * happen (that split is what proposal §5-A5 warns about).
 */
export function isBeadCharsetChar(ch: string): boolean {
    return ch === EMPTY_CHAR || ch === LOCKED_CHAR || BEAD_COLOR_CHARS.indexOf(ch) >= 0;
}
