/**
 * Host-feedback intent types (pure domain, no platform knowledge).
 *
 * These describe **what** a game wants (e.g. a "success" haptic, a share
 * card with a title) — adapters in `platform/` map them to **how** each
 * host produces them (`wx.vibrateShort`, `navigator.vibrate`, `wx.shareAppMessage`…).
 *
 * Rule: core → platform is the only allowed direction; platform → core
 * types (like `HapticKind`, `ShareOptions`) live here so that game code
 * and GameServices stay in the inner layer.
 */

/** Tactile-feedback kind. Maps to the narrowest shape each host can produce. */
export type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

/** Content a game wants to share. Host adapters fill what they can; missing
 * fields fall back to platform defaults (weapp shows the game icon/title). */
export interface ShareOptions {
  /** Share card title. 30-char limit on WeChat; adapters truncate gracefully. */
  readonly title?: string;
  /** Local path or URL to a share-card preview image. WeChat accepts both. */
  readonly imageUrl?: string;
  /** Query string appended to the target URL (landing page / share token). */
  readonly query?: string;
}
