/**
 * Bead parameter card — the six layers of `assets-spec.md` §1.1, plus the two
 * non-`filled` state variants of §1.2.
 *
 * One bead = L0a 接触阴影 → L0b 投影 → L1 主体 → L2 暗倒角 → L3 亮倒角 → L3b rim 光
 * → L4a/b/c 软高光（三层递减 α）→ L5 符号, drawn in that order (v1.3 十层卡 · F4 质感升级).
 * Everything here is a **pure function of its arguments**: it reads
 * no game state and returns nothing (control-manifest §8) — which is what makes
 * the card testable by command inspection alone (`tests/bead-render.test.ts`).
 *
 * Geometry is expressed as **ratios of the bead edge**, derived from the 64px
 * reference frame §1.1 works in (r = 0.22×BEAD, shadow dy = 3/64×BEAD, …). That
 * keeps one card implementation correct at every size the game uses:
 * `BEAD_CELL = 50` on the board, `TRAY_SLOT − 4 = 44` in the tray.
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import { BEAD_CELL, BEAD_DRAW_INSET, SOCKET_CARD, TRAY_SLOT } from '../config/tuning.js';
import {
  BEAD_BEVEL_DARK_MIX,
  BEAD_BEVEL_LIGHT_MIX,
  BEAD_CONTACT_SHADOW_ALPHA,
  BEAD_HIGHLIGHT_HEX,
  BEAD_RIM_MIX,
  BEAD_SHADOW_ALPHA,
  BEAD_SHADOW_ALPHA_SELECTED,
  BEAD_SHADOW_HEX,
  BEAD_SOFT_HIGHLIGHT_ALPHAS,
  beadColor,
  beadEndpoints,
  mix,
  SOCKET_EDGE_DARK_MIX,
  SOCKET_LIT_MIX,
  SOCKET_PIT_DARKEN,
  withAlpha,
  type BeadsPalette,
} from './palette.js';
import { beadSymbol, emitSymbol, symbolInk } from './symbols.js';

/**
 * §1.1 layer geometry, as fractions of the bead edge. Source values are the
 * spec's 64px example (`r = round(BEAD × 0.22)`, insets 1.5 / 1, widths 3 / 2,
 * highlight at 0.10 / 0.62 with size 0.80 × 0.26 and radius 0.13).
 */
export const BEAD_CARD = {
  /** Corner radius (`round(BEAD × 0.22)`). */
  radius: 0.22,
  /** L0a 接触阴影（v1.3 · F4）：贴底窄条，x/y/w/h 为边长比例，radius = 主圆角 × 0.5。 */
  contactX: 0.06,
  contactY: -0.02,
  contactW: 0.88,
  contactH: 0.1,
  contactRadiusScale: 0.5,
  /** L0b shadow vertical offset (spec: `y − 3` in the 64 frame). */
  shadowDy: 3 / 64,
  /** L2 inset from the bottom/right inner edge (v1.3: 2/64, was 1.5). */
  bevelInsetDark: 2 / 64,
  /** L3 inset from the top/left inner edge (v1.3: 1.5/64, was 1). */
  bevelInsetLight: 1.5 / 64,
  /** L2 stroke width (v1.3: 5/64, was 3). */
  bevelWidthDark: 5 / 64,
  /** L3 stroke width (v1.3: 4/64, was 2). */
  bevelWidthLight: 4 / 64,
  /** L3b rim 光（v1.3 新增）：上内缘单线，内缩 1/64、线宽 2/64。 */
  rimInset: 1 / 64,
  rimWidth: 2 / 64,
  /**
   * L4a/b/c 软高光三层（v1.3 · F4，取代硬边单高光条）：外扩递减、中心递增叠层模拟柔光。
   * x/y/w/h/radius 均为边长比例，α 见 {@link BEAD_SOFT_HIGHLIGHT_ALPHAS}。
   */
  softHighlight: Object.freeze([
    { x: 0.06, y: 0.52, w: 0.82, h: 0.38, radius: 0.19 },
    { x: 0.1, y: 0.6, w: 0.72, h: 0.26, radius: 0.13 },
    { x: 0.16, y: 0.68, w: 0.56, h: 0.14, radius: 0.07 },
  ] as const),
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
  /**
   * L11 目标色垫的底色（v1.5-r5 垫色显缝，WXG-T-142）：该格 pattern 要求色。
   * 传入 ⇒ 珠下先画垫（端点表 edge），珠体四边内缩 BEAD_DRAW_INSET 露出垫缝。
   */
  readonly padColorIdx?: number;
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
  const outer = options.size ?? BEAD_CELL;
  const base = beadColor(colorIdx);
  const y = cy + (options.lift ?? 0);

  // L11 目标色垫（v1.5-r5）—— 画于珠十层之下（渲染序 L11 → L0a…L5）；
  // 平面、零投影零高光（「不读作珠」§1.9.4）。
  if (options.padColorIdx !== undefined) {
    const pad = beadEndpoints(options.padColorIdx);
    builder.rect(cx - outer / 2, y - outer / 2, outer, outer, {
      fill: pad.edge,
      radius: Math.round(outer * BEAD_CARD.radius),
    });
  }

  // 珠体四边内缩（垫色显缝）；无垫（托盘珠）保持满幅。
  const inset = options.padColorIdx !== undefined ? BEAD_DRAW_INSET : 0;
  const size = outer - inset * 2;
  const left = cx - size / 2;
  const bottom = y - size / 2;
  const radius = Math.round(size * BEAD_CARD.radius);
  const stroke = (ratio: number) => Math.max(BEAD_CARD.minStroke, size * ratio);

  // L0a 接触阴影 — 贴底窄条，让珠"坐"在面上（v1.3 · F4）；固定 α，不随 selected 变化。
  builder.rect(
    left + size * BEAD_CARD.contactX,
    bottom + size * BEAD_CARD.contactY,
    size * BEAD_CARD.contactW,
    size * BEAD_CARD.contactH,
    {
      fill: withAlpha(BEAD_SHADOW_HEX, BEAD_CONTACT_SHADOW_ALPHA),
      radius: Math.round(radius * BEAD_CARD.contactRadiusScale),
    },
  );

  // L0b 投影 — offset down by 3/64 of the edge, no stroke.
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

  // L3b rim 光 — top inner edge single line, brighter than L3 (v1.3 · F4).
  const insetRim = size * BEAD_CARD.rimInset;
  const rim = mix(base, BEAD_RIM_MIX);
  builder.line(
    left + insetRim,
    bottom + size - insetRim,
    left + size - insetRim,
    bottom + size - insetRim,
    rim,
    stroke(BEAD_CARD.rimWidth),
  );

  // L4a/b/c 软高光 — three stacked rounded bars，外扩递减 α / 中心递增 α 模拟柔光（v1.3 · F4，
  // 取代 v1.2 硬边单高光条）。三层均在 L5 符号之下绘制 → 不影响符号对比（accessibility A5）。
  for (let i = 0; i < BEAD_CARD.softHighlight.length; i++) {
    const g = BEAD_CARD.softHighlight[i]!;
    builder.rect(left + size * g.x, bottom + size * g.y, size * g.w, size * g.h, {
      fill: withAlpha(BEAD_HIGHLIGHT_HEX, BEAD_SOFT_HIGHLIGHT_ALPHAS[i]!),
      radius: size * g.radius,
    });
  }

  // L5 符号 — the non-colour channel (colour-blind affordance).
  emitSymbol(builder, beadSymbol(colorIdx), cx, y, size, symbolInk(base).color);
}

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
  const base = colorIdx === undefined ? palette.slot : beadColor(colorIdx);
  const endpoints = colorIdx === undefined ? neutralEndpoints(palette) : beadEndpoints(colorIdx);

  // S2 坑底（先画大底，S1 框压在其上）：内缩 6% 的 `pit` 填充。
  const inset = size * SOCKET_CARD.pitInset;
  builder.rect(left, bottom, size, size, { fill: base, radius });
  builder.rect(left + inset, bottom + inset, size - inset * 2, size - inset * 2, {
    fill: endpoints.pit,
    radius: Math.max(2, Math.round((size - inset * 2) * BEAD_CARD.radius * 0.8)),
  });

  // S1 暗缘框（外框线，压住 S2 边界）。
  builder.rect(left, bottom, size, size, {
    stroke: endpoints.edge,
    lineWidth: Math.max(BEAD_CARD.minStroke, size * SOCKET_CARD.edgeWidth),
    radius,
  });

  // S3 上内缘内阴影线（暗，凹感上半）。
  const shadeWidth = Math.max(BEAD_CARD.minStroke, size * SOCKET_CARD.shadeWidth);
  builder.line(
    left + inset,
    bottom + inset,
    left + size - inset,
    bottom + inset,
    endpoints.edge,
    shadeWidth,
  );

  // S4 下内缘受光亮线（亮，凹感下半）。
  builder.line(
    left + inset,
    bottom + size - inset,
    left + size - inset,
    bottom + size - inset,
    endpoints.lit,
    Math.max(BEAD_CARD.minStroke, size * SOCKET_CARD.litWidth),
  );
}

/**
 * 托盘空槽（无目标色）的中性端点：由中性 `slot` 色推导（非珠色预烘焙表）。
 */
function neutralEndpoints(palette: BeadsPalette): { edge: string; pit: string; lit: string } {
  return {
    edge: mix(palette.slot, -SOCKET_EDGE_DARK_MIX),
    pit: mix(palette.slot, -(SOCKET_EDGE_DARK_MIX + SOCKET_PIT_DARKEN)),
    lit: mix(palette.slot, SOCKET_LIT_MIX),
  };
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
