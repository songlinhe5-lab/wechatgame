/**
 * Open-data-domain protocol — host ⇄ subdomain message shapes (ADR-0035 S-1).
 *
 * The WeChat open data context is a **separate JS runtime** (`wx.getOpenDataContext`
 * / `postMessage` / `onMessage`). It cannot import this package, so the shapes are
 * duplicated there by codegen (never by hand — see ADR-0035 §5.2 S-4).
 *
 * Engine-free: no `cc`, no DOM, no `wx`, no `platform/*` imports (L2).
 */

/** Handshake version. The subdomain ships independently, so mismatches must be detectable. */
export const OPEN_DATA_VERSION = 1;

/**
 * Which leaderboard a message targets (ADR-0035 §3.2).
 * - `settle-total` — the only board on the rank page (Σ best per level).
 * - `settle`       — per-level context board opened from the settlement panel.
 * - `sprint`       — reserved for phase 2 (WXG-T-422); defined but never enabled here.
 */
export type RankBoard = 'settle' | 'settle-total' | 'sprint';

/** Colours/sizes travel with `init` because the subdomain cannot import `palette.ts`. */
export interface OpenDataTheme {
  readonly bg: string;
  readonly rowBg: string;
  readonly rowBgSelf: string;
  readonly text: string;
  readonly accent: string;
  readonly avatarSize: number;
  readonly rowH: number;
  readonly fontPx: number;
}

/** Host → subdomain. One-way push, not RPC. */
export type HostToOpenData =
  | { readonly type: 'init'; readonly version: number; readonly theme: OpenDataTheme; readonly board: RankBoard }
  | {
      readonly type: 'rank:query';
      readonly board: RankBoard;
      readonly key: string;
      readonly order: 'asc' | 'desc';
      readonly limit: number;
    }
  | { readonly type: 'rank:refresh'; readonly board: RankBoard }
  | { readonly type: 'render:resize'; readonly width: number; readonly height: number; readonly dpr: number }
  | { readonly type: 'render:visible'; readonly visible: boolean };

export const RANK_ERROR_CODES = ['no-auth', 'empty', 'api-missing', 'fail'] as const;

export type RankErrorCode = (typeof RANK_ERROR_CODES)[number];

/** Subdomain → host. Status only — never friend rows (minimal privacy surface). */
export type OpenDataToHost =
  | { readonly type: 'ready'; readonly version: number }
  | { readonly type: 'rank:ready'; readonly board: RankBoard; readonly count: number }
  | { readonly type: 'rank:error'; readonly board: RankBoard; readonly code: RankErrorCode };

function isRankBoard(value: unknown): value is RankBoard {
  return value === 'settle' || value === 'settle-total' || value === 'sprint';
}

function isRankErrorCode(value: unknown): value is RankErrorCode {
  return typeof value === 'string' && (RANK_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Boundary check for subdomain replies: that runtime is untrusted, so every field
 * is re-validated. Malformed input returns `false`; this never throws.
 */
export function isOpenDataToHost(value: unknown): value is OpenDataToHost {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case 'ready':
      return typeof message.version === 'number' && Number.isFinite(message.version);
    case 'rank:ready':
      return (
        isRankBoard(message.board) &&
        typeof message.count === 'number' &&
        Number.isFinite(message.count) &&
        message.count >= 0
      );
    case 'rank:error':
      return isRankBoard(message.board) && isRankErrorCode(message.code);
    default:
      return false;
  }
}

/** The host only accepts the current version; otherwise the panel falls back gracefully. */
export function isCompatibleOpenDataVersion(version: unknown): boolean {
  return version === OPEN_DATA_VERSION;
}
