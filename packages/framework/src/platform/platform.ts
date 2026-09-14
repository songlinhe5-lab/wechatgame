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

import type { Storage } from '../core/save/storage.js';
import type { AudioBackend } from '../core/audio/audio.js';
import type { AssetProvider, PlatformInfo } from '../core/game/game.js';
import { NullAssetProvider } from '../core/game/game.js';
import type { RewardedAdProvider } from '../core/ads/rewarded-ad.js';
import { NoopRewardedAdProvider } from './rewarded-ad.js';

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
  createAudioBackend(): AudioBackend;
  createAssetProvider(): AssetProvider;
  /** Rewarded video. Node/web = Mock; weapp = Noop until a real pull is approved. */
  createRewardedAdProvider(): RewardedAdProvider;
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

  abstract now(): number;
  abstract createStorage(): Storage;
  abstract createAudioBackend(): AudioBackend;
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
    return () => {};
  }

  onShow(_callback: () => void): () => void {
    return () => {};
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
