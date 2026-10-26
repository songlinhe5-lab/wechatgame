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

import { MemoryStorage, type Storage } from '../core/save/storage.js';
import {
  NullAudioBackend,
  type AudioBackend,
  type AudioBackendOptions,
  type AudioVoices,
} from '../core/audio/audio.js';
import type { CapsuleRect, PlatformInfo } from '../core/game/game.js';
import {
  BasePlatform,
  type FrameHandle,
  type HapticKind,
  type ScreenSize,
  type ShareOptions,
} from './platform.js';
import {
  NoopRewardedAdProvider,
  type MockAdOutcome,
} from './rewarded-ad.js';
import type {
  RewardedAdCloseEvent,
  RewardedAdPlacement,
  RewardedAdProvider,
} from '../core/ads/rewarded-ad.js';
import { SynthAudioBackend, type SynthContext, type SynthInnerAudio } from './audio-synth.js';

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
  /**
   * 激励视频广告（WXG-T-402）。返回的实例形状只取我们用到那部分——
   * load/show Promise、onLoad/onError/onClose 回调。
   * 基础库 2.0.4+；开发机若无此 API ⇒ Provider 降级为 Noop。
   */
  createRewardedVideoAd?(): WxRewardedVideoAd;
  /** 基础库 2.2.0+。type ∈ ['light'|'medium'|'heavy']，默认 'medium'。 */
  vibrateShort?(opts?: { type?: 'light' | 'medium' | 'heavy' }): void;
  /** 基础库 2.2.0+。 */
  vibrateLong?(): void;
  /** 触发分享面板（小游戏专用）。基础库 2.9.4+。 */
  shareAppMessage?(opts: {
    title?: string;
    imageUrl?: string;
    query?: string;
  }): void;
  /** 被动分享默认卡片（用户点右上角「···」→ 转发）。基础库 2.9.4+。 */
  onShareAppMessage?(cb: () => { title?: string; imageUrl?: string; query?: string }): void;
  /** 右上角菜单里显示「转发」按钮。基础库 2.11.3+。 */
  showShareMenu?(opts?: { withShareTicket?: boolean; menus?: string[] }): void;
  /** 低内存告警（小游戏基础库 2.11.0+）。 */
  onMemoryWarning?(cb: () => void): void;
  /**
   * 小游戏热更管理器（WXG-T-407）。启动期检查新版本 → 下载 → ready 回调 →
   * `applyUpdate()` 重启生效。基础库 2.8.0+。Node/harness 无此 API。
   */
  getUpdateManager?(): WxUpdateManager;
}

/** 微信 UpdateManager 的最小形状（只取我们实际消费的成员）。 */
interface WxUpdateManager {
  onCheckForUpdate?(cb: (res: { hasUpdate: boolean }) => void): void;
  onUpdateReady?(cb: () => void): void;
  onUpdateFailed?(cb: (res?: { errMsg?: string }) => void): void;
  applyUpdate?(): void;
}

/** 微信 createRewardedVideoAd 返回对象的最小形状（只取我们实际消费的成员）。 */
interface WxRewardedVideoAd {
  load(opts?: { adUnitId?: string }): Promise<unknown>;
  show(): Promise<unknown>;
  onLoad(cb: () => void): void;
  offLoad(cb: () => void): void;
  onError(cb: (res: { errMsg?: string; errCode?: number }) => void): void;
  offError(cb: (res: { errMsg?: string; errCode?: number }) => void): void;
  /**
   * 关闭回调的参数：isEnded=true 表示完整看完（该发奖），
   * isEnded=false 表示中途关闭（跳过）。
   */
  onClose(cb: (res: { isEnded: boolean }) => void): void;
  offClose(cb: (res: { isEnded: boolean }) => void): void;
  destroy(): void;
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

/**
 * WeChat mini-game rewarded-video Provider (WXG-T-402).
 *
 * 桥接 `wx.createRewardedVideoAd()` 与框架的 `RewardedAdProvider` 契约：
 *  - 微信 onClose({isEnded: true}) → onRewarded + onClose('completed')
 *  - 微信 onClose({isEnded: false}) → 只 onClose('skipped')
 *  - 微信 load/show Promise reject → onError
 *
 * 外部须在构造时传入 `wx.createRewardedVideoAd`（本类不自己调 `getWx()`），
 * 使 WeappPlatform 能在无此 API 的宿主上 gracefully 降级为 Noop。
 *
 * 注意：生产部署必须传 `adUnitId`（小游戏管理后台创建的广告位 ID）；
 * 缺省时微信侧会 load 失败，错误将经 onError 桥接出去，不静默。
 */
export class WxgRewardedAdProvider implements RewardedAdProvider {
  private readonly _rewarded: Array<() => void> = [];
  private readonly _closed: Array<(event: RewardedAdCloseEvent) => void> = [];
  private readonly _errors: Array<(error: Error) => void> = [];
  private _ready = false;
  private _showing = false;
  private _destroyed = false;

  private readonly _instance: WxRewardedVideoAd;

  constructor(
    createAd: () => WxRewardedVideoAd,
    private readonly _adUnitId?: string,
  ) {
    this._instance = createAd();
    // 微信 onLoad/onError 仅作诊断通道：我们的 ready 状态在 load Promise resolve 时置 true。
    this._instance.onLoad?.(() => { /* onLoad 已由 load() Promise 覆盖 */ });
    this._instance.onError?.((res) => {
      const err = new Error(`WxRewardedAd: ${res.errMsg ?? 'unknown error'} (code ${res.errCode ?? '?'})`);
      this._emitError(err);
    });
    this._instance.onClose?.(({ isEnded }) => {
      if (this._destroyed) return;
      this._showing = false;
      this._ready = false; // 微信广告看完一次后需重新 load（微信自动处理，但我们保守重置）
      if (isEnded) {
        for (const cb of this._rewarded) cb();
        for (const cb of this._closed) cb({ reason: 'completed' });
      } else {
        for (const cb of this._closed) cb({ reason: 'skipped' });
      }
    });
  }

  load(placement: RewardedAdPlacement): void {
    if (this._destroyed) return;
    void placement; // 微信 API 用 adUnitId 而非 placement 字符串，占位记录供未来扩展
    this._instance.load(this._adUnitId ? { adUnitId: this._adUnitId } : undefined)
      .then(() => {
        if (!this._destroyed) this._ready = true;
      })
      .catch((e: unknown) => {
        this._ready = false;
        this._emitError(new Error(
          `WxRewardedAd load failed: ${e instanceof Error ? e.message : String(e)}`,
        ));
      });
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
    this._instance.show()
      .catch((e: unknown) => {
        this._showing = false;
        this._ready = false;
        this._emitError(new Error(
          `WxRewardedAd show failed: ${e instanceof Error ? e.message : String(e)}`,
        ));
      });
    // onClose 会把 _showing 置 false；这里 show() Promise resolve 时广告已在展示但我们不做额外状态变更
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
    try { this._instance.destroy?.(); } catch { /* ignore */ }
  }

  private _emitError(error: Error): void {
    for (const cb of this._errors) cb(error);
  }

  private _remove<T>(list: T[], item: T): void {
    const index = list.indexOf(item);
    if (index >= 0) list.splice(index, 1);
  }
}

// MockAdOutcome 保留以备后续扩展（外部 mock 测试需要）—— 不删除，让 tree-shaker 决定。
export type { MockAdOutcome };

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
  private readonly _adUnitId?: string;
  private readonly _updateReadyCbs: Array<() => void> = [];
  private readonly _memoryWarningCbs: Array<() => void> = [];

  constructor(
    wx: WxApi | undefined = getWx(),
    options: { adUnitId?: string } = {},
  ) {
    super();
    this._wx = wx;
    this._adUnitId = options.adUnitId;
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
    // 被动分享注册（WXG-T-405）：
    if (wx) {
      const showMenu = wx.showShareMenu;
      if (typeof showMenu === 'function') {
        try { showMenu({ withShareTicket: true, menus: ['shareAppMessage'] }); } catch { /* ignore */ }
      }
      const onShare = wx.onShareAppMessage;
      if (typeof onShare === 'function') {
        try { onShare(() => ({})); } catch { /* ignore */ }
      }
      // 热更注册（WXG-T-407）：
      const um = wx.getUpdateManager?.();
      if (um) {
        if (typeof um.onCheckForUpdate === 'function') {
          um.onCheckForUpdate((res) => {
            this.log('info', `[update] check: hasUpdate=${res.hasUpdate}`);
          });
        }
        if (typeof um.onUpdateReady === 'function') {
          um.onUpdateReady(() => {
            this.log('info', '[update] ready — firing callbacks');
            for (const cb of [...this._updateReadyCbs]) cb();
          });
        }
        if (typeof um.onUpdateFailed === 'function') {
          um.onUpdateFailed((res) => {
            this.log('warn', `[update] failed: ${res?.errMsg ?? 'unknown'}`);
          });
        }
      }
      // 内存告警注册（WXG-T-409）：低内存时 fire 订阅者回调 → 游戏层收缩 LRU / 关特效。
      const onMemWarn = wx.onMemoryWarning;
      if (typeof onMemWarn === 'function') {
        const handler = () => {
          this.log('warn', `[memory] warning — firing ${this._memoryWarningCbs.length} subscriber(s)`);
          for (const cb of [...this._memoryWarningCbs]) cb();
        };
        onMemWarn(handler);
      }
    }
  }

  onUpdateReady(callback: () => void): () => void {
    this._updateReadyCbs.push(callback);
    return () => {
      const idx = this._updateReadyCbs.indexOf(callback);
      if (idx >= 0) this._updateReadyCbs.splice(idx, 1);
    };
  }

  applyUpdate(): void {
    const um = this._wx?.getUpdateManager?.();
    if (um && typeof um.applyUpdate === 'function') {
      try { um.applyUpdate(); } catch (e) {
        this.log('warn', `[update] applyUpdate threw: ${e}`);
      }
    }
  }

  onMemoryWarning(callback: () => void): () => void {
    this._memoryWarningCbs.push(callback);
    return () => {
      const idx = this._memoryWarningCbs.indexOf(callback);
      if (idx >= 0) this._memoryWarningCbs.splice(idx, 1);
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

  /**
   * 激励视频 Provider（WXG-T-402）。有 `wx.createRewardedVideoAd` 就返回真包装，
   * 否则降级 Noop（保持与旧行为零差异，真机开发者/Node 单测零破坏）。
   */
  override createRewardedAdProvider(): RewardedAdProvider {
    const create = this._wx?.createRewardedVideoAd;
    if (typeof create !== 'function') {
      return new NoopRewardedAdProvider();
    }
    try {
      return new WxgRewardedAdProvider(
        () => create.call(this._wx),
        this._adUnitId,
      );
    } catch (e) {
      this.log('warn', `[ad] createRewardedVideoAd 抛错：${e}`);
      return new NoopRewardedAdProvider();
    }
  }

  /**
   * Tactile feedback (`wx.vibrateShort` / `wx.vibrateLong`).
   *
   * 微信 API 形状：
   * - `vibrateShort({ type: 'light'|'medium'|'heavy' })` — 基础库 2.2.0+
   * - `vibrateLong()` — 基础库 2.2.0+
   *
   * kind 映射：light/medium/heavy → vibrateShort(type)；其余 → vibrateLong。
   * 无 wx / 无 API → 静默 noop（不 warn，Node/harness 常态）。
   */
  haptic(kind: HapticKind): void {
    const wx = this._wx;
    if (!wx) return;
    if (kind === 'light' || kind === 'medium' || kind === 'heavy') {
      const fn = wx.vibrateShort;
      if (typeof fn === 'function') {
        try { fn({ type: kind }); } catch { /* ignore */ }
      }
    } else {
      const fn = wx.vibrateLong;
      if (typeof fn === 'function') {
        try { fn(); } catch { /* ignore */ }
      }
    }
  }

  /**
   * 触发微信分享面板（WXG-T-405）。
   *
   * 优先用 `wx.shareAppMessage({ title, imageUrl, query })`（小游戏专用，
   * 基础库 2.9.4+），无此 API 时静默 noop。与被动分享（onShareAppMessage）
   * 互补：主动是"点按钮"，被动是"点右上角转发"。
   */
  share(opts: ShareOptions = {}): void {
    const wx = this._wx;
    if (!wx) return;
    const fn = wx.shareAppMessage;
    if (typeof fn !== 'function') return;
    const args: { title?: string; imageUrl?: string; query?: string } = {};
    if (opts.title) args.title = opts.title;
    if (opts.imageUrl) args.imageUrl = opts.imageUrl;
    if (opts.query) args.query = opts.query;
    try { fn(args); } catch { /* ignore */ }
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
