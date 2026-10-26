/**
 * Platform abstraction.
 *
 * Everything that differs between *browser*, *WeChat mini-game* and *Node
 * (tests)* lives behind this interface: clocks, storage, frame callbacks,
 * audio backend, screen metrics and lifecycle events. The core and the game
 * logic depend only on this interface, so 95% of the codebase is testable in
 * Node with no DOM and no `wx` global.
 *
 * See docs/architecture/architecture.md → "platform layer".
 */

import type { HapticKind, ShareOptions } from '../core/haptics';
import type { PerformanceSnapshot } from '../core/performance/performance';
import type { Storage } from '../core/save/storage';
import type { AudioBackend, AudioBackendOptions } from '../core/audio/audio';
import type { AssetProvider, PlatformInfo } from '../core/game/game';
import { NullAssetProvider } from '../core/game/game';
import type { RewardedAdProvider } from '../core/ads/rewarded-ad';
import { NoopRewardedAdProvider } from './rewarded-ad';

/**
 * Re-export core intent types so consumers importing from the platform
 * barrel still see them (preserves `import type { HapticKind } from '@wxgame/framework'`).
 */
export type { HapticKind, ShareOptions };

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}

export interface FrameHandle {
  cancel(): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Platform {
  readonly info: PlatformInfo;
  /** Monotonic clock in milliseconds. */
  now(): number;
  /** Wall-clock time in milliseconds (for logging/saves, not simulation). */
  wallClock(): number;
  createStorage(): Storage;
  /**
   * Audio sink for this platform. `options.voices` is the game's clip → recipe
   * table, forwarded by the App (`compose/app.ts`) — adapters must stay silent
   * for ids they have no voice for rather than inventing a timbre.
   * Node returns `NullAudioBackend` so unit tests never touch a real clock.
   */
  createAudioBackend(options?: AudioBackendOptions): AudioBackend;
  createAssetProvider(): AssetProvider;
  /** Rewarded video. Node/web = Mock; weapp = Noop until a real pull is approved. */
  createRewardedAdProvider(): RewardedAdProvider;
  /**
   * Tactile feedback. Node/harness = noop; weapp = `wx.vibrateShort`/`wx.vibrateLong`;
   * web = `navigator.vibrate` when available.
   */
  haptic?(kind: HapticKind): void;
  /**
   * Trigger a share (host-dependent). weapp = `wx.shareAppMessage`;
   * hosts without a native share sheet leave this undefined.
   */
  share?(opts?: ShareOptions): void;
  /**
   * Subscribe to "new version ready" event (weapp update manager fired when
   * a fresh package finishes downloading). Hosts without OTA leave this
   * undefined; returns an unsubscribe function.
   */
  onUpdateReady?(callback: () => void): () => void;
  /** Trigger an OTA restart. Undefined on hosts without OTA. */
  applyUpdate?(): void;
  /**
   * Subscribe to "low-memory warning" event (weapp fires when the JS heap
   * approaches the host's memory cap). Hosts without OTA/memory management
   * leave this undefined; returns an unsubscribe function.
   */
  onMemoryWarning?(callback: () => void): () => void;
  /**
   * Platform-agnostic HTTP GET. weapp wraps `wx.request` → Promise;
   * web/node use `fetch`. Returns parsed JSON (unknown shape — caller guards).
   * Undefined on hosts with no network access.
   */
  httpGet?(url: string): Promise<unknown>;
  /**
   * Set preferred render frame rate (weapp only). Values: 60 (default) or 30
   * (battery/low-end mode). Silently ignored on hosts that don't support it.
   * This is a one-shot initialization — the framework calls it on startup;
   * game code shouldn't need to flip it mid-session.
   */
  setPreferredFps?(fps: 30 | 60): void;
  /**
   * Pull a runtime performance snapshot (WXG-T-414). Optional because not
   * every host exposes memory introspection — callers guard with `?.()`.
   * WeChat gives real heap numbers; web/node can compute FPS from frame
   * deltas but know nothing of JS heap.
   *
   * Loop counters are pushed into the platform by the App layer after each
   * `FixedStepLoop.advance()` — the platform doesn't own the loop.
   */
  getPerformance?(): PerformanceSnapshot;
  /** (internal) Called by App after each loop advance — pushes loop counters. */
  _feedLoopStats?(ticks: number, timeSeconds: number, clampedFrames: number): void;
  getScreenSize(): ScreenSize;
  /** Schedule the next frame. The callback receives the delta in ms. */
  requestFrame(callback: (dtMs: number) => void): FrameHandle;
  /** App went to background. Returns an unsubscribe function. */
  onHide(callback: () => void): () => void;
  /** App returned to foreground. Returns an unsubscribe function. */
  onShow(callback: () => void): () => void;
  log(level: LogLevel, message: string, ...args: unknown[]): void;
}

/** Shared plumbing for concrete platforms. */
export abstract class BasePlatform implements Platform {
  abstract readonly info: PlatformInfo;
  private readonly _assetProvider = new NullAssetProvider();

  /** Sliding window of recent frame deltas (seconds) — shared for FPS rolling avg. */
  protected readonly _frameDeltas: number[] = [];
  protected readonly _fpsWindowMax = 60;
  protected _targetFps: 30 | 60 = 60;

  /** Called by requestFrame impls each render frame — feeds FPS rolling window. */
  protected _recordFrame(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    this._frameDeltas.push(deltaSeconds);
    if (this._frameDeltas.length > this._fpsWindowMax) {
      this._frameDeltas.shift();
    }
  }

  /** Cached loop counters — pushed by App after each advance(). */
  protected _loopTicks = 0;
  protected _loopTimeSeconds = 0;
  protected _loopClampedFrames = 0;

  _feedLoopStats(ticks: number, timeSeconds: number, clampedFrames: number): void {
    this._loopTicks = ticks;
    this._loopTimeSeconds = timeSeconds;
    this._loopClampedFrames = clampedFrames;
  }

  abstract now(): number;
  abstract createStorage(): Storage;
  abstract createAudioBackend(options?: AudioBackendOptions): AudioBackend;
  abstract getScreenSize(): ScreenSize;
  abstract requestFrame(callback: (dtMs: number) => void): FrameHandle;

  wallClock(): number {
    return Date.now();
  }

  /** Override to supply textures/atlases. Default is empty. */
  createAssetProvider(): AssetProvider {
    return this._assetProvider;
  }

  /** Default: never awards. Concrete hosts override with Mock or a weapp wrapper. */
  createRewardedAdProvider(): RewardedAdProvider {
    return new NoopRewardedAdProvider();
  }

  onHide(_callback: () => void): () => void {
    return () => { };
  }

  onShow(_callback: () => void): () => void {
    return () => { };
  }

  log(level: LogLevel, message: string, ...args: unknown[]): void {
    const prefix = `[${this.info.name}]`;
    switch (level) {
      case 'error':
        console.error(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      case 'debug':
        // Keep debug quiet in production; adapters can override.
        break;
      default:
        console.log(prefix, message, ...args);
    }
  }
}
