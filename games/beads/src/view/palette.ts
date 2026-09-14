/**
 * Beads colour palette.
 *
 * Single source of truth for every colour the game draws. The bead palette
 * itself is owned by `games/beads/art/art-bible.md §3.2` (10 colours, each
 * bound to a symbol + lightness step — the triple encoding). Gameplay and the
 * view model only ever reference names/indices, never literals.
 */

/** The 10-colour bead palette, index 1..10 → array slot 0..9 (art-bible §3.2). */
export const BEAD_PALETTE: readonly string[] = Object.freeze([
  '#FDF6E9', // 1 奶白 ○ 亮
  '#FFD23F', // 2 柠黄 ★ 亮
  '#F59B23', // 3 活力橙 ● 中
  '#3FBF6B', // 4 草绿 ■ 中
  '#E84C3D', // 5 玫红 ♥ 中暗
  '#8E6FD9', // 6 丁香紫 ◐ 中暗
  '#3D7BF5', // 7 湖蓝 ▽ 暗
  '#A5652C', // 8 赭棕 ▲ 暗
  '#6B3E1E', // 9 深棕 ◆ 最暗
  '#33333D', // 10 炭黑 ✚ 最暗
]);

/** HEX for a 1-based palette index (out-of-range → charcoal fallback). */
export function beadColor(colorIdx: number): string {
  return BEAD_PALETTE[colorIdx - 1] ?? BEAD_PALETTE[9]!;
}

export interface BeadsPalette {
  /** Page background. */
  readonly background: string;
  /** Tray panel fill. */
  readonly panel: string;
  /** Empty-slot inner fill + border. */
  readonly slot: string;
  readonly slotBorder: string;
  /** Locked-cell hatch colour (art-bible §3.4: #B9B4CC). */
  readonly locked: string;
  readonly text: string;
  readonly textDim: string;
  readonly textAccent: string;
  /** Timer danger colour (§3.5 urgent channel). */
  readonly danger: string;
  /** Ad-badge placeholder (ADR-0006: badge only, no wx API). */
  readonly adBadge: string;
  /** Banner backdrop plate. */
  readonly bannerBackdrop: string;
  readonly bannerText: string;
}

export const DEFAULT_PALETTE: BeadsPalette = {
  background: '#F6F1E7',
  panel: '#FFFFFF',
  slot: '#EDE7DA',
  slotBorder: '#D8D0C0',
  locked: '#B9B4CC',
  text: '#33333D',
  textDim: '#8B8578',
  textAccent: '#F59B23',
  danger: '#E84C3D',
  adBadge: '#FFCB3D',
  bannerBackdrop: '#33333D',
  bannerText: '#FDF6E9',
};

/**
 * Blend a `#rrggbb` colour toward black or white.
 * @param amount -1 → black, 0 → unchanged, +1 → white.
 */
export function mix(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const blend = (c: number) => Math.round(c + (target - c) * t);
  return toHex(blend(r), blend(g), blend(b));
}

/** Apply an opacity to a hex colour by returning an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Linear interpolation between two HEX colours — the `mix(A, B, t)` of
 * `assets-spec.md` §0 (`t` is the weight of `B`: 0 → A, 1 → B).
 *
 * Distinct from {@link mix}, which only walks a single colour toward black/white.
 * Pass the *backdrop* as `A` to composite a translucent ink over it.
 */
export function mixWith(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  const k = Math.max(0, Math.min(1, t));
  const lerp = (p: number, q: number) => Math.round(p + (q - p) * k);
  return toHex(lerp(x.r, y.r), lerp(x.g, y.g), lerp(x.b, y.b));
}

/**
 * Perceived brightness of a `#rrggbb` colour, 0..1 (Rec. 601 luma).
 *
 * This is the 「亮度」 of `assets-spec.md` §1.1 L5 — that rule is
 * `亮度 > 0.6 → 深色墨`, so this definition is pinned by that threshold (do not
 * swap it for {@link relativeLuminance} without re-deriving the symbol inks).
 */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** WCAG relative luminance (0..1) — the basis of {@link contrastRatio}. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1..21) between two **opaque** `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ─────────────────────────── bead parameter card colours (assets-spec §1.1) ──
//
// These are the only `#rrggbb` literals the bead card needs. They live here (not
// in `view/bead-render.ts`) so that `view/` holds no colour literals at all
// (control-manifest §3 self-check: hex literals appear only in `palette.ts`).

/** L0 drop shadow (`#1E2033`). */
export const BEAD_SHADOW_HEX = '#1E2033';
export const BEAD_SHADOW_ALPHA = 0.15;
/** L0 shadow while `selected` (§1.2: α 0.15 → 0.25). */
export const BEAD_SHADOW_ALPHA_SELECTED = 0.25;
/** L4 highlight bar (`#FFFFFF`, α 0.38). */
export const BEAD_HIGHLIGHT_HEX = '#FFFFFF';
export const BEAD_HIGHLIGHT_ALPHA = 0.38;
/** L2 / L3 bevel tints of the bead base colour (§1.1: `mix(base, …)` amounts). */
export const BEAD_BEVEL_DARK_MIX = -0.22;
export const BEAD_BEVEL_LIGHT_MIX = 0.18;

// ──────────────────────────────────────────────── symbol ink (assets-spec L5) ──
/** Ink used on a bright bead: `mix(base, #000, 0.55)` → the mix amount. */
export const SYMBOL_INK_DARK_MIX = -0.55;
/** Ink used on a dark bead: `#FFFFFF @ 0.90`. */
export const SYMBOL_INK_LIGHT = '#FFFFFF';
export const SYMBOL_INK_LIGHT_ALPHA = 0.9;
/** §1.1 L5 threshold on {@link luminance}: above it, ink goes dark. */
export const SYMBOL_INK_LUMA_THRESHOLD = 0.6;
/**
 * Hard floor from `accessibility.md` B2 (「符号对珠面 ≥ 3:1」). Binding where it
 * disagrees with the L5 threshold — see `symbolInk()` for the one colour affected.
 */
export const SYMBOL_CONTRAST_MIN = 3;

// ───────────────────────────────────── powerup icon inks (assets-spec §1.4)
/**
 * The three powerup glyphs carry **fixed** inks in §1.4 — they are assets, not
 * theme tokens, so they are not read off `BeadsPalette`. They live in this file
 * because `view/palette.ts` is the only `view/` module allowed to hold hex
 * literals (control-manifest §3 self-check).
 */
/** 魔法棒 stick (`item_area_clear`). */
export const POWERUP_INK_WAND = '#8E6FD9';
/** 星 / 刷毛 (`item_area_clear` star, `item_tray_clear` bristles). */
export const POWERUP_INK_STAR = '#FFD23F';
/** 扫帚柄 (`item_tray_clear`). */
export const POWERUP_INK_STRAW = '#A5652C';
/** 磁铁本体 (`item_random_clear`). */
export const POWERUP_INK_MAGNET = '#E84C3D';
/** 磁极端帽 (`item_random_clear`, §1.4「白/浅蓝端帽」). */
export const POWERUP_INK_CAP = '#D8D5E6';
/** 角标 `ad_badge` 里的白色 ▶（§1.4「白色 ▶（边 10px）」）。 */
export const POWERUP_BADGE_GLYPH = '#FFFFFF';
/** 卡片投影 α（§1.4「投影 α0.10」）——墨色复用 {@link BEAD_SHADOW_HEX}。 */
export const POWERUP_SHADOW_ALPHA = 0.1;

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
