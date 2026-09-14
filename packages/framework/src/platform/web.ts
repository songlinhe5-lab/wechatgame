/**
 * Browser platform — powers the dev harness (`dev/harness`).
 *
 * Uses `localStorage`, `requestAnimationFrame`, `performance.now()` and the Web
 * Audio API when available. All DOM access is guarded so this file can be
 * imported (and typechecked) in Node.
 */

import { MemoryStorage, type Storage } from '../core/save/storage.js';
import { NullAudioBackend, type AudioBackend } from '../core/audio/audio.js';
import type { PlatformInfo } from '../core/game/game.js';
import { BasePlatform, type FrameHandle, type ScreenSize } from './platform.js';
import { MockRewardedAdProvider } from './rewarded-ad.js';

interface GlobalWithDom {
  performance?: { now(): number };
  localStorage?: Storage;
  requestAnimationFrame?: (cb: (t: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
  innerWidth?: number;
  innerHeight?: number;
  devicePixelRatio?: number;
  addEventListener?: (type: string, cb: () => void) => void;
  AudioContext?: new () => unknown;
}

function dom(): GlobalWithDom {
  return globalThis as unknown as GlobalWithDom;
}

export class WebPlatform extends BasePlatform {
  readonly info: PlatformInfo;

  private readonly _storage: Storage;

  constructor(options: { storage?: Storage } = {}) {
    super();
    const g = dom();
    this.info = {
      name: 'web',
      isMiniGame: false,
      safeAreaTop: 0,
      safeAreaBottom: 0,
    };
    this._storage = options.storage ?? g.localStorage ?? new MemoryStorage();
  }

  now(): number {
    const perf = dom().performance;
    return perf ? perf.now() : Date.now();
  }

  createStorage(): Storage {
    return this._storage;
  }

  createAudioBackend(): AudioBackend {
    // Web Audio wiring lands with the first audio-bearing game; until then a
    // null backend keeps gameplay silent but fully functional.
    return new NullAudioBackend();
  }

  /** Browser harness: a tap on 续时 completes immediately (no WeChat SDK). */
  override createRewardedAdProvider() {
    return new MockRewardedAdProvider('complete');
  }

  getScreenSize(): ScreenSize {
    const g = dom();
    return {
      width: g.innerWidth ?? 1280,
      height: g.innerHeight ?? 720,
      pixelRatio: g.devicePixelRatio ?? 1,
    };
  }

  requestFrame(callback: (dtMs: number) => void): FrameHandle {
    const g = dom();
    if (!g.requestAnimationFrame) {
      // Headless fallback (e.g. jsdom without rAF): use a timer.
      const id = setTimeout(() => callback(16.6), 16) as unknown as number;
      return { cancel: () => clearTimeout(id as unknown as ReturnType<typeof setTimeout>) };
    }
    let last = this.now();
    const id = g.requestAnimationFrame((t: number) => {
      const now = t || this.now();
      const dt = now - last;
      last = now;
      callback(dt);
    });
    return { cancel: () => g.cancelAnimationFrame?.(id) };
  }

  override onHide(callback: () => void): () => void {
    const g = dom();
    if (!g.addEventListener) return () => {};
    g.addEventListener('visibilitychange', callback);
    return () => {};
  }

  override onShow(callback: () => void): () => void {
    const g = dom();
    if (!g.addEventListener) return () => {};
    g.addEventListener('focus', callback);
    return () => {};
  }
}
