/**
 * Rewarded-video contract — engine-free (ADR-0006 / WXG-T-058).
 *
 * Implementations live in `platform/` (Mock, Noop). WeChat wrapping is not in
 * this slice and must never leak `wx` into core.
 */

export const REWARDED_PLACEMENT = {
  failContinue: 'fail-continue',
  powerupRegion: 'powerup-region',
  powerupClearAll: 'powerup-clearAll',
  powerupRandom: 'powerup-random',
  trayExpand: 'tray-expand',
} as const;

export type RewardedAdPlacement =
  (typeof REWARDED_PLACEMENT)[keyof typeof REWARDED_PLACEMENT] | string;

export type RewardedAdCloseReason = 'completed' | 'skipped';

export interface RewardedAdCloseEvent {
  readonly reason: RewardedAdCloseReason;
}

export interface RewardedAdProvider {
  /** Prepare a placement. Safe to call more than once. */
  load(placement: RewardedAdPlacement): void;
  /** True after a successful load and while not currently showing. */
  isReady(): boolean;
  /**
   * Present the ad. Rejects (onError, never onRewarded) when not ready, already
   * showing, or destroyed. At most one `onRewarded` per successful `show`.
   */
  show(): void;
  onRewarded(cb: () => void): () => void;
  onClose(cb: (event: RewardedAdCloseEvent) => void): () => void;
  onError(cb: (error: Error) => void): () => void;
  destroy(): void;
}
