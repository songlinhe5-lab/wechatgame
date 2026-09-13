/**
 * Node platform — used by unit tests, CI and the headless verification scripts.
 *
 * The clock is *manual* by default: `requestFrame` records the callback and
 * `pump(dtMs)` drives it. That makes any timing-dependent code deterministic in
 * tests instead of flaky.
 */

import { MemoryStorage, type Storage } from '../core/save/storage';
import { NullAudioBackend, type AudioBackend } from '../core/audio/audio';
import type { PlatformInfo } from '../core/game/game';
import { BasePlatform, type FrameHandle, type LogLevel, type ScreenSize } from './platform';

export class NodePlatform extends BasePlatform {
  readonly info: PlatformInfo = {
    name: 'node',
    isMiniGame: false,
    safeAreaTop: 0,
    safeAreaBottom: 0,
  };

  private _pending: ((dtMs: number) => void) | null = null;
  private _lastFrameTime = 0;
  private _virtualTime = 0;

  constructor(
    private readonly _screen: ScreenSize = { width: 1280, height: 720, pixelRatio: 1 },
  ) {
    super();
  }

  now(): number {
    return this._virtualTime;
  }

  /** Advance the manual clock and run the pending frame callback. */
  pump(dtMs: number): boolean {
    this._virtualTime += dtMs;
    const cb = this._pending;
    this._pending = null;
    if (!cb) return false;
    cb(dtMs);
    return true;
  }

  /** True when a frame callback is waiting to run. */
  get hasPendingFrame(): boolean {
    return this._pending !== null;
  }

  createStorage(): Storage {
    return new MemoryStorage();
  }

  createAudioBackend(): AudioBackend {
    return new NullAudioBackend();
  }

  getScreenSize(): ScreenSize {
    return this._screen;
  }

  requestFrame(callback: (dtMs: number) => void): FrameHandle {
    this._pending = callback;
    if (this._lastFrameTime === 0) this._lastFrameTime = this._virtualTime;
    return {
      cancel: () => {
        if (this._pending === callback) this._pending = null;
      },
    };
  }

  /** Silent in tests — the CI output stays readable. */
  override log(_level: LogLevel, _message: string, ..._args: unknown[]): void {}
}
