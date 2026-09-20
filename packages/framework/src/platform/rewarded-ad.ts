/**
 * Host-side rewarded-video implementations (ADR-0006 + WXG-T-058).
 *
 * Mock = Node tests / browser harness. Noop = weapp until a real pull is
 * approved. Neither implementation calls the WeChat rewarded-video API.
 */

import type {
  RewardedAdCloseEvent,
  RewardedAdPlacement,
  RewardedAdProvider,
} from '../core/ads/rewarded-ad.js';

export type { RewardedAdCloseEvent, RewardedAdPlacement, RewardedAdProvider } from '../core/ads/rewarded-ad.js';
export { REWARDED_PLACEMENT } from '../core/ads/rewarded-ad.js';

export type MockAdOutcome = 'complete' | 'skip' | 'error';

/**
 * Scriptable provider. `autoSettle` null waits for `settle()`. `'complete'`
 * fires rewarded+close synchronously inside `show()` so the web harness can
 * continue a run without a WeChat SDK.
 */
export class MockRewardedAdProvider implements RewardedAdProvider {
  private readonly _rewarded: Array<() => void> = [];
  private readonly _closed: Array<(event: RewardedAdCloseEvent) => void> = [];
  private readonly _errors: Array<(error: Error) => void> = [];
  private _ready = false;
  private _showing = false;
  private _destroyed = false;
  private _placement: string | null = null;

  constructor(private readonly _autoSettle: MockAdOutcome | null = null) {}

  get showing(): boolean {
    return this._showing;
  }

  get placement(): string | null {
    return this._placement;
  }

  load(placement: RewardedAdPlacement): void {
    if (this._destroyed) return;
    this._placement = placement;
    this._ready = true;
  }

  isReady(): boolean {
    return this._ready && !this._showing && !this._destroyed;
  }

  show(): void {
    if (this._destroyed || !this._ready || this._showing) {
      this._emitError(new Error('RewardedAd: show rejected'));
      return;
    }
    this._showing = true;
    if (this._autoSettle) this.settle(this._autoSettle);
  }

  /**
   * Resolve the in-flight `show`. No-op when nothing is showing.
   * complete → onRewarded then onClose(completed); skip → onClose only;
   * error → onError only.
   */
  settle(outcome: MockAdOutcome): void {
    if (!this._showing || this._destroyed) return;
    this._showing = false;
    if (outcome === 'complete') {
      this._ready = false;
      for (const cb of this._rewarded) cb();
      for (const cb of this._closed) cb({ reason: 'completed' });
      return;
    }
    if (outcome === 'skip') {
      this._ready = true;
      for (const cb of this._closed) cb({ reason: 'skipped' });
      return;
    }
    this._ready = false;
    this._emitError(new Error('RewardedAd: failed'));
  }

  onRewarded(cb: () => void): () => void {
    this._rewarded.push(cb);
    return () => this._remove(this._rewarded, cb);
  }

  onClose(cb: (event: RewardedAdCloseEvent) => void): () => void {
    this._closed.push(cb);
    return () => this._remove(this._closed, cb);
  }

  onError(cb: (error: Error) => void): () => void {
    this._errors.push(cb);
    return () => this._remove(this._errors, cb);
  }

  destroy(): void {
    this._destroyed = true;
    this._showing = false;
    this._ready = false;
    this._rewarded.length = 0;
    this._closed.length = 0;
    this._errors.length = 0;
  }

  private _emitError(error: Error): void {
    for (const cb of this._errors) cb(error);
  }

  private _remove<T>(list: T[], item: T): void {
    const index = list.indexOf(item);
    if (index >= 0) list.splice(index, 1);
  }
}

/**
 * Production weapp stand-in until the user approves a real pull.
 * `show` always errors; does not wrap the WeChat rewarded-video API.
 */
export class NoopRewardedAdProvider implements RewardedAdProvider {
  private readonly _errors: Array<(error: Error) => void> = [];
  private _destroyed = false;

  load(_placement: RewardedAdPlacement): void {}

  isReady(): boolean {
    return false;
  }

  show(): void {
    if (this._destroyed) return;
    const error = new Error('RewardedAd: not available');
    for (const cb of this._errors) cb(error);
  }

  onRewarded(_cb: () => void): () => void {
    return () => {};
  }

  onClose(_cb: (event: RewardedAdCloseEvent) => void): () => void {
    return () => {};
  }

  onError(cb: (error: Error) => void): () => void {
    this._errors.push(cb);
    return () => {
      const index = this._errors.indexOf(cb);
      if (index >= 0) this._errors.splice(index, 1);
    };
  }

  destroy(): void {
    this._destroyed = true;
    this._errors.length = 0;
  }
}
