/**
 * Bead parameter card — the six layers of `assets-spec.md` §1.1, plus the two
 * non-`filled` state variants of §1.2.
 *
 * One bead = L0 投影 → L1 主体 → L2 暗倒角 → L3 亮倒角 → L4 高光条 → L5 符号, drawn
 * in that order. Everything here is a **pure function of its arguments**: it reads
 * no game state and returns nothing (control-manifest §8) — which is what makes
 * the card testable by command inspection alone (`tests/bead-render.test.ts`).
 *
 * Geometry is expressed as **ratios of the bead edge**, derived from the 64px
 * reference frame §1.1 works in (r = 0.22×BEAD, shadow dy = 3/64×BEAD, …). That
 * keeps one card implementation correct at every size the game uses:
 * `BEAD_CELL = 50` on the board, `TRAY_SLOT − 4 = 44` in the tray.
 */

import type { RenderModelBuilder } from '../../framework/index';
import { BEAD_CELL, TRAY_SLOT } from '../config/tuning';
import {
  BEAD_BEVEL_DARK_MIX,
  BEAD_BEVEL_LIGHT_MIX,
  BEAD_HIGHLIGHT_ALPHA,
  BEAD_HIGHLIGHT_HEX,
  BEAD_SHADOW_ALPHA,
  BEAD_SHADOW_ALPHA_SELECTED,
  BEAD_SHADOW_HEX,
  EMPTY_GHOST_ALPHA,
  EMPTY_TINT_MIX,
  beadColor,
  mix,
  mixWith,
  withAlpha,
  type BeadsPalette,
} from './palette';
import { beadSymbol, emitSymbol, symbolInk } from './symbols';

/**
 * §1.1 layer geometry, as fractions of the bead edge. Source values are the
 * spec's 64px example (`r = round(BEAD × 0.22)`, insets 1.5 / 1, widths 3 / 2,
 * highlight at 0.10 / 0.62 with size 0.80 × 0.26 and radius 0.13).
 */
export const BEAD_CARD = {
  /** Corner radius (`round(BEAD × 0.22)`). */
  radius: 0.22,
  /** L0 shadow vertical offset (spec: `y − 3` in the 64 frame). */
  shadowDy: 3 / 64,
  /** L2 inset from the bottom/right inner edge (spec: 1.5). */
  bevelInsetDark: 1.5 / 64,
  /** L3 inset from the top/left inner edge (spec: 1). */
  bevelInsetLight: 1 / 64,
  /** L2 stroke width (spec: 3). */
  bevelWidthDark: 3 / 64,
  /** L3 stroke width (spec: 2). */
  bevelWidthLight: 2 / 64,
  /** L4 highlight bar: x / y / w / h / radius, all fractions of the edge. */
  highlightX: 0.1,
  highlightY: 0.62,
  highlightW: 0.8,
  highlightH: 0.26,
  highlightRadius: 0.13,
  /** §1.1 最小特征约束: no stroke below 2 design px. */
  minStroke: 2,
} as const;

/** Tray bead edge — §1.3 `tray_slot` 同 BEAD（内缩 4）. */
export const TRAY_BEAD_SIZE = TRAY_SLOT - 4;

export interface FilledBeadOptions {
  /** Bead edge length; defaults to `BEAD_CELL` (board size). */
  readonly size?: number;
  /** Extra upward offset in design units (tray `selected` lift, §1.2: 4px). */
  readonly lift?: number;
  /** L0 shadow opacity override; `selected` passes the darker α (§1.2). */
  readonly shadowAlpha?: number;
}

/**
 * Draw a complete `filled` bead (§1.1) centred on `(cx, cy)`.
 *
 * L5 takes the symbol for `colorIdx` and the ink that `symbolInk()` picks for
 * `beadColor(colorIdx)` — i.e. the colour and the symbol can never drift apart,
 * because both are derived from the same index.
 */
export function drawFilledBead(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  colorIdx: number,
  options: FilledBeadOptions = {},
): void {
  const size = options.size ?? BEAD_CELL;
  const base = beadColor(colorIdx);
  const y = cy + (options.lift ?? 0);
  const left = cx - size / 2;
  const bottom = y - size / 2;
  const radius = Math.round(size * BEAD_CARD.radius);
  const stroke = (ratio: number) => Math.max(BEAD_CARD.minStroke, size * ratio);

  // L0 投影 — offset down by 3/64 of the edge, no stroke.
  builder.rect(left, bottom - size * BEAD_CARD.shadowDy, size, size, {
    fill: withAlpha(BEAD_SHADOW_HEX, options.shadowAlpha ?? BEAD_SHADOW_ALPHA),
    radius,
  });

  // L1 主体.
  builder.rect(left, bottom, size, size, { fill: base, radius });

  // L2 暗倒角 — bottom + right inner edges, tinted toward black.
  const insetDark = size * BEAD_CARD.bevelInsetDark;
  const dark = mix(base, BEAD_BEVEL_DARK_MIX);
  const darkWidth = stroke(BEAD_CARD.bevelWidthDark);
  builder.line(left + insetDark, bottom + insetDark, left + size - insetDark, bottom + insetDark, dark, darkWidth);
  builder.line(
    left + size - insetDark,
    bottom + insetDark,
    left + size - insetDark,
    bottom + size - insetDark,
    dark,
    darkWidth,
  );

  // L3 亮倒角 — top + left inner edges, tinted toward white.
  const insetLight = size * BEAD_CARD.bevelInsetLight;
  const light = mix(base, BEAD_BEVEL_LIGHT_MIX);
  const lightWidth = stroke(BEAD_CARD.bevelWidthLight);
  builder.line(
    left + insetLight,
    bottom + size - insetLight,
    left + size - insetLight,
    bottom + size - insetLight,
    light,
    lightWidth,
  );
  builder.line(
    left + insetLight,
    bottom + insetLight,
    left + insetLight,
    bottom + size - insetLight,
    light,
    lightWidth,
  );

  // L4 高光条 — one rounded bar in the upper third (left-top light).
  builder.rect(
    left + size * BEAD_CARD.highlightX,
    bottom + size * BEAD_CARD.highlightY,
    size * BEAD_CARD.highlightW,
    size * BEAD_CARD.highlightH,
    {
      fill: withAlpha(BEAD_HIGHLIGHT_HEX, BEAD_HIGHLIGHT_ALPHA),
      radius: size * BEAD_CARD.highlightRadius,
    },
  );

  // L5 符号 — the non-colour channel (colour-blind affordance).
  emitSymbol(builder, beadSymbol(colorIdx), cx, y, size, symbolInk(base).color);
}

/**
 * §1.2 E4 幽灵符号相对 L5 满符号的缩小比例（「同矢量 path 但缩小 80%」）。
 * L5 满符号占 ≈BEAD×0.406，×此比例→ glyph 占 ≈BEAD×0.32（与 §3.8 描述一致）。
 * 几何比例（非 §3  gameplay 常量），与 {@link BEAD_CARD} 同族。
 */
const GHOST_SYMBOL_SCALE = 0.8;

/**
 * Draw an `empty` socket (§1.2). E2 描边（凹陷边界）常驻；传入 `colorIdx` 时另加
 * **E1 目标色底** + **E4 幽灵符号**（两个 §3.8 冻结常量）——使未填态即可读出该格要
 * 填的颜色（「同色入格」第一道解锁）。
 *
 * 与 `filled` 的形态区分（「must not read as a bead」）仍靠无 L0 投影 / 无 L2–L4
 * 倒角高光 / 符号极淡（α 0.20）保证。不传 `colorIdx`（= 托盘空槽，无目标色）则保
 * 持中性槽底、无幽灵符号。
 */
export function drawEmptySocket(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  palette: BeadsPalette,
  size: number = BEAD_CELL,
  colorIdx?: number,
): void {
  const left = cx - size / 2;
  const bottom = cy - size / 2;
  const radius = Math.round(size * BEAD_CARD.radius);
  // E1 目标色底：有目标色时按 §3.8 权重混入中性槽底；无目标色（托盘空槽）保持中性。
  const fill =
    colorIdx === undefined ? palette.slot : mixWith(palette.slot, beadColor(colorIdx), EMPTY_TINT_MIX);
  // E2 描边 — 保持凹陷边界。
  builder.rect(left, bottom, size, size, {
    fill,
    stroke: palette.slotBorder,
    lineWidth: 1,
    radius,
  });
  // E4 幽灵符号 — 与 L5 同矢量 path、缩至 ≈BEAD×0.32、α EMPTY_GHOST_ALPHA（色盲冗余通道）。
  if (colorIdx !== undefined) {
    emitSymbol(
      builder,
      beadSymbol(colorIdx),
      cx,
      cy,
      size * GHOST_SYMBOL_SCALE,
      withAlpha(beadColor(colorIdx), EMPTY_GHOST_ALPHA),
    );
  }
}

/**
 * Draw a `locked` bead (§1.2): flat locked fill + 45° hatch, **no highlight and no
 * symbol** — the pattern's decoration must not compete with real beads.
 *
 * Note: §1.2 specifies the body as `mix(base, 灰紫 B9B4CC, 0.60)`, but a locked cell
 * carries `colorIdx = 0` (`entities/grid.ts` — `x`/`.` have no colour), so no
 * `base` exists to mix. `palette.locked` is used instead; the mismatch is
 * registered in the ledger rather than papered over with an invented base colour.
 */
export function drawLockedBead(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  palette: BeadsPalette,
  size: number = BEAD_CELL,
): void {
  const left = cx - size / 2;
  const bottom = cy - size / 2;
  const inset = size * 0.16;
  builder.rect(left, bottom, size, size, {
    fill: palette.locked,
    radius: Math.round(size * BEAD_CARD.radius),
  });
  const hatch = withAlpha(palette.background, 0.9);
  builder.line(left + inset, bottom + inset, left + size - inset, bottom + size - inset, hatch, 2);
  builder.line(left + size - inset, bottom + inset, left + inset, bottom + size - inset, hatch, 2);
}

/** L0 shadow opacity for a selected bead (§1.2 selected row). */
export const SELECTED_SHADOW_ALPHA = BEAD_SHADOW_ALPHA_SELECTED;

/**
 * §1.2 状态外描边环（`hint` 蓝 / `wrong` danger 复用）：圆角矩形、**只描边不填充**
 * → 中心透明，露出下层（目标色底 / 已填珠）。`alpha` 承载呼吸/闪灼相位。
 */
export function drawStateRing(
  builder: RenderModelBuilder,
  cx: number,
  cy: number,
  size: number,
  stroke: string,
  alpha = 1,
  lineWidth = 2,
): void {
  const radius = Math.round(size * BEAD_CARD.radius);
  builder.rect(cx - size / 2, cy - size / 2, size, size, {
    stroke,
    lineWidth,
    radius,
    alpha,
  });
}
