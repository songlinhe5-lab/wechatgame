/**
 * WeChat mini-game platform.
 *
 * The `wx` global is injected by the mini-game runtime and is absent in Node,
 * so every access is guarded. This file therefore typechecks and imports
 * cleanly everywhere; it only *does* anything inside WeChat.
 *
 * KNOWN GAPS (see docs/engine-reference/cocos/VERSION.md):
 *  - `getSystemInfoSync` is deprecated in favour of `getWindowInfo` /
 *    `getDeviceInfo` on newer base-library versions; we call it defensively and
 *    fall back when missing.
 *  - Safe-area insets come from `getWindowInfo().safeArea`; the exact field
 *    names must be verified against the target base library in WeChat DevTools.
 */

import { MemoryStorage, type Storage } from '../core/save/storage';
import {
  NullAudioBackend,
  type AudioBackend,
  type AudioBackendOptions,
} from '../core/audio/audio';
import type { PlatformInfo } from '../core/game/game';
import { BasePlatform, type FrameHandle, type ScreenSize } from './platform';
import { NoopRewardedAdProvider } from './rewarded-ad';
import { SynthAudioBackend, type SynthContext, type SynthInnerAudio } from './audio-synth';

/**
 * Shape shared by `getWindowInfo` (new) and `getSystemInfoSync` (deprecated).
 * Only the fields we consume are declared.
 */
interface WxWindowInfo {
  windowWidth?: number;
  windowHeight?: number;
  pixelRatio?: number;
  screenHeight?: number;
  safeArea?: { top?: number; bottom?: number; height?: number };
}

/** Minimal structural view of the `wx` API surface we actually use. */
interface WxApi {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: string): void;
  removeStorageSync(key: string): void;
  getStorageInfoSync(): { keys?: string[] };
  getSystemInfoSync?(): WxWindowInfo;
  getWindowInfo?(): WxWindowInfo;
  onHide?(cb: () => void): void;
  offHide?(cb: () => void): void;
  onShow?(cb: () => void): void;
  offShow?(cb: () => void): void;
  /** 小游戏侧首次手势解锁用（audio-spec §4.4）。 */
  onTouchStart?(cb: (ev?: unknown) => void): void;
  offTouchStart?(cb: (ev?: unknown) => void): void;
  /** Android 上可用的 WebAudio；iOS 基库版本门槛待真机核实（A05-27 `[R]`）。 */
  createWebAudioContext?(): unknown;
  /**
   * 长音频（`AudioVoice.assetFile`，BGM 路线）。形状只取我们用到那 6 个成员，
   * 与 `SynthInnerAudio` 一一对应 ⇒ 适配层无需包装。
   */
  createInnerAudioContext?(): {
    src: string;
    loop: boolean;
    volume: number;
    play(): void;
    pause(): void;
    stop(): void;
    destroy(): void;
  };
  createInnerAudioContext?(): unknown;
}

function getWx(): WxApi | undefined {
  return (globalThis as unknown as { wx?: WxApi }).wx;
}

/** True when running inside the WeChat mini-game runtime. */
export function isWeapp(): boolean {
  const wx = getWx();
  return !!wx && typeof wx.getStorageSync === 'function';
}

/** Storage backed by `wx.*StorageSync`. Never throws on quota errors. */
export class WeappStorage implements Storage {
  constructor(private readonly _wx: WxApi) { }

  get(key: string): string | null {
    try {
      const value = this._wx.getStorageSync(key);
      return typeof value === 'string' && value.length > 0 ? value : null;
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    this._wx.setStorageSync(key, value);
  }

  remove(key: string): void {
    try {
      this._wx.removeStorageSync(key);
    } catch {
      /* ignore */
    }
  }

  keys(): string[] {
    try {
      return this._wx.getStorageInfoSync().keys ?? [];
    } catch {
      return [];
    }
  }

  clear(): void {
    for (const key of this.keys()) this.remove(key);
  }
}

export class WeappPlatform extends BasePlatform {
  readonly info: PlatformInfo;
  private readonly _wx: WxApi | undefined;

  constructor(wx: WxApi | undefined = getWx()) {
    super();
    this._wx = wx;
    const safeTop = this._readSafeArea().top;
    const safeBottom = this._readSafeArea().bottom;
    this.info = {
      name: 'weapp',
      isMiniGame: true,
      safeAreaTop: safeTop,
      safeAreaBottom: safeBottom,
    };
  }

  private _readSafeArea(): { top: number; bottom: number } {
    const wx = this._wx;
    if (!wx) return { top: 0, bottom: 0 };
    const info = wx.getWindowInfo?.() ?? wx.getSystemInfoSync?.() ?? {};
    const safe = info.safeArea;
    const screenHeight = info.screenHeight ?? info.windowHeight ?? 0;
    if (!safe) return { top: 0, bottom: 0 };
    const top = safe.top ?? 0;
    const bottom = Math.max(0, screenHeight - (safe.bottom ?? screenHeight));
    return { top, bottom };
  }

  now(): number {
    // Mini-game runtime exposes `performance.now`; `Date.now` is the fallback.
    const perf = (globalThis as unknown as { performance?: { now(): number } }).performance;
    return perf ? perf.now() : Date.now();
  }

  createStorage(): Storage {
    return this._wx ? new WeappStorage(this._wx) : new MemoryStorage();
  }

  /**
   * weapp 音频后端（WXG-T-096 / audio-spec §6.2 需求单第 7 项）。
   *
   * 只走 WebAudio 一条路：本仓选型是**程序化合成 ⇒ 零音频文件**（§3.12），而
   * `InnerAudioContext` 只能播文件（`src`），合成出的 PCM 无法交给它 ⇒ 回退方案
   * 与本单前提矛盾，**不实现**（audio-spec §6.3 的采样回退属另一批，需先解除
   * `§3.9` 主包余量冲突）。无 `createWebAudioContext` 时回 `NullAudioBackend` 并
   * 一次性 log，**不伪造「接了 InnerAudioContext 就能出声」的结论**。
   */
  createAudioBackend(options?: AudioBackendOptions): AudioBackend {
    const wx = this._wx;
    const voices = options?.voices;
    const createCtx = wx?.createWebAudioContext;
    if (!wx || !voices || typeof createCtx !== 'function') {
      this.log(
        'warn',
        '[audio] 无 wx.createWebAudioContext 或无 voice 表 ⇒ 静音（合成音非文件，'
        + 'InnerAudioContext 回退需先改选型；A05-27 `[R]` 待真机）',
      );
      return new NullAudioBackend();
    }
    const backend = new SynthAudioBackend(
      () => createCtx.call(wx) as SynthContext,
      voices,
      { warn: (message) => this.log('warn', `[audio] ${message}`) },
      // 文件路线（BGM）：原生播放器 ⇒ JS 堆不驻 7 MB PCM。缺 API 时返回 null，后端自动回退合成。
      (src) => {
        const ctx = wx.createInnerAudioContext?.();
        if (!ctx) return null;
        let prepared = false;
        const handle: SynthInnerAudio = {
          src,
          loop: false,
          volume: 1,
          play: () => {
            if (!prepared) {
              ctx.src = handle.src;
              prepared = true;
            }
            ctx.loop = handle.loop;
            ctx.volume = handle.volume;
            ctx.play();
          },
          pause: () => ctx.pause(),
          stop: () => ctx.stop(),
          destroy: () => ctx.destroy(),
        };
        return handle;
      },
    );
    // 首次手势解锁；退后台停曲、回前台补起（期望态在 backend 里，不丢 BGM）。
    const unlock = () => {
      backend.unlock();
      wx.offTouchStart?.(unlock);
    };
    wx.onTouchStart?.(unlock);
    wx.onHide?.(() => backend.suspend());
    wx.onShow?.(() => backend.resume());
    return backend;
  }

  /** No wx ad API until the user approves a real pull (WXG-T-058). */
  override createRewardedAdProvider() {
    return new NoopRewardedAdProvider();
  }

  getScreenSize(): ScreenSize {
    const wx = this._wx;
    if (!wx) return { width: 1280, height: 720, pixelRatio: 1 };
    const info = wx.getWindowInfo?.() ?? wx.getSystemInfoSync?.() ?? {};
    return {
      width: info.windowWidth ?? 1280,
      height: info.windowHeight ?? 720,
      pixelRatio: info.pixelRatio ?? 1,
    };
  }

  requestFrame(callback: (dtMs: number) => void): FrameHandle {
    const g = globalThis as unknown as {
      requestAnimationFrame?: (cb: (t: number) => void) => number;
      cancelAnimationFrame?: (handle: number) => void;
    };
    if (!g.requestAnimationFrame) {
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
    this._wx?.onHide?.(callback);
    return () => this._wx?.offHide?.(callback);
  }

  override onShow(callback: () => void): () => void {
    this._wx?.onShow?.(callback);
    return () => this._wx?.offShow?.(callback);
  }
}
