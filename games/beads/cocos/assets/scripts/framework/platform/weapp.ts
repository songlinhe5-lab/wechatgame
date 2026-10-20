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
  type AudioVoices,
} from '../core/audio/audio';
import type { CapsuleRect, PlatformInfo } from '../core/game/game';
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
  /**
   * 微信右上胶囊（「··· / ◎」）矩形，单位 = 逻辑 px（dp）、原点 = 屏左上。
   * 基础库 2.1.0+；本仓消费完整矩形（顶栏要整块排除，底缘仍是硬约束）。
   */
  getMenuButtonBoundingClientRect?(): { top?: number; bottom?: number; left?: number; right?: number };
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
    onError?(cb: (res: { errMsg?: string; errCode?: number }) => void): void;
  };
  createInnerAudioContext?(): unknown;
  /**
   * 分包预载（BGM 走分包时用：`assetFile` 落在 `subpackages/<name>/…` 下才需要）。
   * 无此 API / 未声明分包 ⇒ 不调用。失败不致命：`audio-synth` 的 `onError` 会回退合成路线
   * （“继续回退合成，绝不静默没声”，见 `_startFileLoop`）。
   */
  loadSubpackage?(opts: { name: string; success?: (res?: unknown) => void; fail?: (res?: unknown) => void }): unknown;
}

/**
 * 从 voice 表里挑出需要预载的分包名（去重）：只有 `assetFile` 形如
 * `subpackages/<name>/…` 的才计。默认（`audio/…`）⇒ 空集 ⇒ 零行为变化。
 */
export function subpackageNamesOf(voices?: AudioVoices): string[] {
  if (!voices) return [];
  const out = new Set<string>();
  for (const v of Object.values(voices)) {
    const m = /^subpackages\/([^/]+)\//.exec(v.assetFile ?? '');
    if (m) out.add(m[1]);
  }
  return Array.from(out);   // ⛔ 不用 [...out]：Set 展开在 ES5 档塌成 [Set]（ES-01 / ADR-0012）
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
    const safe = this._readSafeArea();
    const capsule = this._readCapsuleRect();
    this.info = {
      name: 'weapp',
      isMiniGame: true,
      safeAreaTop: safe.top,
      safeAreaBottom: safe.bottom,
      capsuleBottomDp: capsule?.bottom ?? null,
      capsuleRectDp: capsule,
    };
  }

  /**
   * 胶囊完整矩形（dp，自屏左上）。无 wx / 基库缺该 API / 任一值不合法 ⇒ **`null`**
   *（不是零矩形），由调用方走各自的兜底带（判例 K-124：静态带只当 fallback，不参与取大）。
   */
  private _readCapsuleRect(): CapsuleRect | null {
    const rect = this._wx?.getMenuButtonBoundingClientRect?.();
    if (!rect) return null;
    const { left, top, right, bottom } = rect;
    const finite = (v: number | undefined): v is number =>
      typeof v === 'number' && Number.isFinite(v);
    if (!finite(left) || !finite(top) || !finite(right) || !finite(bottom)) return null;
    if (left < 0 || top < 0 || right <= left || bottom <= top) return null;
    return { left, top, right, bottom };
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
          onError: (cb) => {
            ctx.onError?.((res) => cb(`errCode=${res?.errCode ?? '?'} ${res?.errMsg ?? 'unknown'}`));
          },
          pause: () => ctx.pause(),
          stop: () => ctx.stop(),
          destroy: () => ctx.destroy(),
        };
        return handle;
      },
    );
    // 分包前置（fire-and-forget）：BGM 要等首次手势 unlock 才起，通常已到位；没到位则
    // 由 InnerAudioContext.onError 走既有「回退合成」腿。路径不变 ⇒ `subpackageNamesOf` 为空 ⇒ 零行为变化。
    for (const name of subpackageNamesOf(voices)) {
      try {
        wx.loadSubpackage?.({
          name,
          fail: (res) => this.log('warn', `[audio] 分包 \`${name}\` 预载失败 ⇒ BGM 将回退合成路线：${String((res as { errMsg?: string })?.errMsg ?? res ?? '')}`),
        });
      } catch (e) {
        this.log('warn', `[audio] 分包 \`${name}\` loadSubpackage 抛错 ⇒ BGM 将回退合成路线：${String(e)}`);
      }
    }
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
