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
