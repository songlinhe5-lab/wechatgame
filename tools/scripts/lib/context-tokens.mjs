/**
 * context-tokens.mjs — shared, dependency-free token estimator for the graded
 * context index (WXG-T-024). Used by both `build-context-index.mjs` and
 * `check-context-budget.mjs` so the two never drift apart.
 *
 * ── FORMULA (deterministic, approximate — NOT a real BPE tokenizer) ─────────
 *   CJK / kana / hangul / CJK & full-width punctuation : ~1 token per char
 *   ASCII (code point < 0x80, incl. newlines/spaces)   : ~1 token per 4 chars
 *   everything else (other scripts / symbols)          : ~1 token per 2 chars
 *
 *   tokens = ceil( cjk*1 + ascii/4 + other/2 )
 *
 * ── WHY THIS SHAPE ─────────────────────────────────────────────────────────
 *   Chinese-heavy Markdown lands near a real tokenizer (±~30%); the constant
 *   is deliberately coarse. It is a *ranking / guardrail* number, never a
 *   billing figure — do not treat a limit of N as precise below a ~10% margin.
 */

const CJK_RANGES = [
  [0x3000, 0x303f], // CJK symbols & punctuation
  [0x3040, 0x30ff], // hiragana + katakana
  [0x3400, 0x4dbf], // CJK ext A
  [0x4e00, 0x9fff], // CJK unified ideographs
  [0xac00, 0xd7af], // hangul syllables
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xff00, 0xffef], // full-width forms & half-width katakana
];

function isCJK(cp) {
  for (const [lo, hi] of CJK_RANGES) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

/**
 * Coarse, deterministic token estimate. See the formula & caveat above.
 * @param {string} text
 * @returns {number} estimated tokens (non-negative integer)
 */
export function estimateTokens(text) {
  const s = String(text ?? '');
  let cjk = 0;
  let ascii = 0;
  let other = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) ascii += 1;
    else if (isCJK(cp)) cjk += 1;
    else other += 1;
  }
  return Math.ceil(cjk * 1 + ascii / 4 + other / 2);
}
