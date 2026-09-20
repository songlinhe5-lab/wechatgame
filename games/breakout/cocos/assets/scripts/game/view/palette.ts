/**
 * Breakout colour palette.
 *
 * Single source of truth for every colour the game draws. The art pipeline
 * (games/breakout/art) owns the values; gameplay and the view model only ever
 * reference names, never literals.
 */

export interface BreakoutPalette {
  /** Arena background fill. */
  readonly background: string;
  /** Vertical gradient hint drawn as a translucent band behind the grid. */
  readonly backplate: string;

  readonly paddle: string;
  readonly paddleEdge: string;
  readonly paddleHighlight: string;

  readonly ball: string;
  readonly ballGlow: string;

  readonly text: string;
  readonly textDim: string;
  readonly textAccent: string;

  readonly bannerText: string;
  readonly bannerBackdrop: string;

  readonly barTrack: string;
  readonly barFill: string;

  /** Life pips in the HUD. */
  readonly life: string;
  readonly lifeEmpty: string;

  /** Colour used when a brick has taken partial damage. */
  readonly brickDamagedTint: string;

  /** Powerup capsule glyph colours (assets-spec §1.4; shape is the primary cue). */
  readonly powerupExpand: string;
  readonly powerupMulti: string;
  readonly powerupLife: string;
}

/**
 * Default palette — a cool "neon arcade" set that reads well on OLED phones and
 * survives WeChat's colour profile shifts. Brick colours themselves come from
 * the level legend (see config/levels.ts).
 */
export const DEFAULT_PALETTE: BreakoutPalette = {
  background: '#0b1021',
  backplate: '#141a33',

  paddle: '#4cc9f0',
  paddleEdge: '#1b6f8a',
  paddleHighlight: '#d8f6ff',

  ball: '#ffffff',
  ballGlow: '#8be9fd',

  text: '#e8f1ff',
  textDim: '#8b98b8',
  textAccent: '#ffd166',

  bannerText: '#ffffff',
  bannerBackdrop: '#000000',

  barTrack: '#1e2544',
  barFill: '#4cc9f0',

  life: '#ff5d8f',
  lifeEmpty: '#2a3155',

  brickDamagedTint: '#000000',

  powerupExpand: '#5ee08a',
  powerupMulti: '#4cc9f0',
  powerupLife: '#ff5e7a',
};

/**
 * Blend a `#rrggbb` colour toward black or white.
 * @param amount -1 → black, 0 → unchanged, +1 → white.
 */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  return toHex(mix(r), mix(g), mix(b));
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
