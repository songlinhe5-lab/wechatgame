/**
 * Beads symbol channel — the 10 vector symbols of `assets-spec.md` §1.1.
 *
 * The symbols are the **only non-colour channel** of the bead triple encoding
 * (colour + symbol + lightness), and therefore the thing that makes the game
 * colour-blind safe (`art/accessibility.md` A1/A3, 灰度可辨). They are emitted
 * as vector paths — never text glyphs — so they do not depend on an installed
 * font (§1.1: 「程序化 path，不依赖字体」).
 *
 * Geometry is authored in the **64px reference frame** used by §1.1 and scaled
 * by `size / 64` at emit time. The spec fixes ratios only ("以 64 演算仅展示比例，
 * 落码按公式等比换算"), so `BEAD_CELL = 50` reproduces the same proportions.
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import {
  SYMBOL_CONTRAST_MIN,
  SYMBOL_INK_DARK_MIX,
  SYMBOL_INK_LIGHT,
  SYMBOL_INK_LIGHT_ALPHA,
  SYMBOL_INK_LUMA_THRESHOLD,
  contrastRatio,
  luminance,
  mix,
  mixWith,
  withAlpha,
} from './palette.js';

/**
 * The 10 bead symbols in palette order: `BEAD_SYMBOLS[i]` ↔ `beadColor(i + 1)`
 * (奶白 ○ · 柠黄 ★ · 活力橙 ● · 草绿 ■ · 玫红 ♥ · 丁香紫 ◐ · 湖蓝 ▽ · 赭棕 ▲ ·
 * 深棕 ◆ · 炭黑 ✚).
 */
export const BEAD_SYMBOLS = Object.freeze([
  'ring',
  'star',
  'dot',
  'square',
  'heart',
  'half',
  'tri-down',
  'tri-up',
  'diamond',
  'cross',
] as const);

export type BeadSymbol = (typeof BEAD_SYMBOLS)[number];

/** Reference frame of §1.1: every linear constant below is in these units. */
export const SYMBOL_REF_SIZE = 64;

/**
 * Resulting symbol bounding box as a fraction of the bead edge. §1.1 states
 * 「尺寸 BEAD×0.40」; the shapes below span 26 units of the 64 frame, i.e.
 * 26/64 ≈ 0.406, which `tests/symbols.test.ts` asserts against this constant.
 */
export const SYMBOL_SIZE_RATIO = 0.4;

/** Minimum stroke width in design px (§1.1 最小特征约束：符号线宽 ≥ 2px). */
export const SYMBOL_MIN_STROKE = 2;

/**
 * Symbol for a 1-based palette index. Out-of-range mirrors `beadColor()`'s
 * fallback (index 10, 炭黑 ✚) so an invalid colour never renders symbol-less.
 */
export function beadSymbol(colorIdx: number): BeadSymbol {
  const i = Number.isFinite(colorIdx) ? Math.floor(colorIdx) : 0;
  return i >= 1 && i <= BEAD_SYMBOLS.length
    ? BEAD_SYMBOLS[i - 1]!
    : BEAD_SYMBOLS[BEAD_SYMBOLS.length - 1]!;
}

export interface SymbolInk {
  /** CGFloat-ready colour string, already carrying the §1.1 α where applicable. */
  readonly color: string;
  /** WCAG contrast of `color` composited over the bead base (opaque base). */
  readonly contrast: number;
}

/**
 * Symbol ink for a bead base colour (§1.1 L5).
 *
 * The spec's rule is a preference — `亮度 > 0.6 → mix(base, #000, 0.55)`, else
 * `#FFF @ 0.90` — and it is applied first. `accessibility.md` B2 then imposes a
 * **hard floor** (「符号对珠面 ≥ 3:1」), so a bead whose preferred ink lands under
 * 3:1 flips to the other ink. Exactly one colour is affected: 草绿 3FBF6B
 * (preferred white ink measures ≈2.4:1; the dark ink reaches ≈3.7:1). The
 * deviation is registered in the ledger rather than silently applied.
 */
export function symbolInk(base: string): SymbolInk {
  const preferDark = luminance(base) > SYMBOL_INK_LUMA_THRESHOLD;
  const preferred = measureInk(base, preferDark);
  if (preferred.contrast >= SYMBOL_CONTRAST_MIN) return preferred;

  const flipped = measureInk(base, !preferDark);
  return flipped.contrast > preferred.contrast ? flipped : preferred;
}

/** Ink for `base` on one side of the L5 rule, with its measured contrast. */
function measureInk(base: string, useDark: boolean): SymbolInk {
  if (useDark) {
    const dark = mix(base, SYMBOL_INK_DARK_MIX);
    return { color: dark, contrast: contrastRatio(dark, base) };
  }
  return {
    color: withAlpha(SYMBOL_INK_LIGHT, SYMBOL_INK_LIGHT_ALPHA),
    // Measured opaque, because the α0.90 ink sits *over* the base (composited);
    // measuring the raw white would overstate the ratio by up to ~4%.
    contrast: contrastRatio(mixWith(base, SYMBOL_INK_LIGHT, SYMBOL_INK_LIGHT_ALPHA), base),
  };
}

/** Points of a regular `count`-gon, `startDeg` measured counter-clockwise from +x. */
function regularPoints(
  cx: number,
  cy: number,
  r: number,
  count: number,
  startDeg: number,
): number[] {
  const points: number[] = [];
  for (let i = 0; i < count; i++) {
    const angle = ((startDeg + (360 / count) * i) * Math.PI) / 180;
    points.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  return points;
}

/**
 * Emit one symbol centred at `(cx, cy)`.
 *
 * @param size Bead edge length in design units — the symbol occupies 40% of it,
 *   i.e. §1.1's `BEAD × 0.40`. Pass the *bead* size, not the symbol size.
 * @param ink Opaque hex, or an `rgba()` string — both are accepted by RenderModel.
 */
export function emitSymbol(
  builder: RenderModelBuilder,
  symbol: BeadSymbol,
  cx: number,
  cy: number,
  size: number,
  ink: string,
): void {
  // Reference frame → design units. Reference = 64 (the §1.1 example BEAD).
  const s = size / SYMBOL_REF_SIZE;
  const u = (v: number) => v * s;
  const stroke = (reference: number) => Math.max(SYMBOL_MIN_STROKE, u(reference));
  /** §1.1 symbol circumradius (reference units). */
  const R = 13;

  switch (symbol) {
    case 'ring':
      // ○ 圆环 — r=13, stroke 3, not filled.
      builder.circle(cx, cy, u(R), { stroke: ink, lineWidth: stroke(3) });
      return;

    case 'star': {
      // ★ 五角星 — 10 vertices alternating the circumradius and its 0.382 inner step.
      const points: number[] = [];
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? u(R) : u(R) * 0.382;
        const angle = ((90 + i * 36) * Math.PI) / 180;
        points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      }
      builder.polygon(points, { fill: ink });
      return;
    }

    case 'dot':
      // ● 实心圆 — r=11.
      builder.circle(cx, cy, u(11), { fill: ink });
      return;

    case 'square':
      // ■ 实心方 — 20×20, radius 4.
      builder.rect(cx - u(10), cy - u(10), u(20), u(20), { fill: ink, radius: u(4) });
      return;

    case 'heart':
      // ♥ 心形 — two r=6 discs at x ±6, plus the lower triangle.
      builder.circle(cx - u(6), cy + u(3), u(6), { fill: ink });
      builder.circle(cx + u(6), cy + u(3), u(6), { fill: ink });
      builder.polygon([cx - u(11), cy + u(3), cx + u(11), cy + u(3), cx, cy - u(R)], { fill: ink });
      return;

    case 'half': {
      // ◐ 半圆 — left half-disc (90° → 270°) plus the diameter line.
      const STEPS = 16;
      const points: number[] = [];
      for (let i = 0; i <= STEPS; i++) {
        const angle = Math.PI / 2 + (Math.PI * i) / STEPS;
        points.push(cx + Math.cos(angle) * u(R), cy + Math.sin(angle) * u(R));
      }
      builder.polygon(points, { fill: ink });
      builder.line(cx, cy - u(R), cx, cy + u(R), ink, stroke(2));
      return;
    }

    case 'tri-down':
      // ▽ 下三角 — equilateral, side 24 (circumradius = 24/√3), apex down.
      builder.polygon(regularPoints(cx, cy, u(24 / Math.sqrt(3)), 3, 270), { fill: ink });
      return;

    case 'tri-up':
      // ▲ 上三角 — same, apex up.
      builder.polygon(regularPoints(cx, cy, u(24 / Math.sqrt(3)), 3, 90), { fill: ink });
      return;

    case 'diamond':
      // ◆ 菱形 — diagonals 26 (vertical) × 16 (horizontal).
      builder.polygon(
        [cx, cy + u(R), cx + u(8), cy, cx, cy - u(R), cx - u(8), cy],
        { fill: ink },
      );
      return;

    case 'cross':
      // ✚ 十字 — two 22×6 bars, orthogonal.
      builder.rect(cx - u(11), cy - u(3), u(22), u(6), { fill: ink });
      builder.rect(cx - u(3), cy - u(11), u(6), u(22), { fill: ink });
      return;

    default:
      return;
  }
}
