/**
 * Browser platform — powers the dev harness (`dev/harness`).
 *
 * Uses `localStorage`, `requestAnimationFrame`, `performance.now()` and the Web
 * Audio API when available. All DOM access is guarded so this file can be
 * imported (and typechecked) in Node.
 */

import { MemoryStorage, type Storage } from '../core/save/storage.js';
import { computeFps } from '../core/performance/performance.js';
import { NullAudioBackend, type AudioBackend, type AudioBackendOptions } from '../core/audio/audio.js';
import type { PlatformInfo } from '../core/game/game.js';
import { BasePlatform, type FrameHandle, type HapticKind, type ScreenSize } from './platform.js';
import { MockRewardedAdProvider } from './rewarded-ad.js';
import { SynthAudioBackend, type SynthContext, type SynthInnerAudio } from './audio-synth.js';

/**
 * 真的 `localStorage` 长得和框架的 `Storage` 接口**不一样**（`getItem/setItem/removeItem/key/length`
 * vs `get/set/remove/keys/clear`）。本文件以前把全局变量直接声明成框架 `Storage` 交出去，
 * 类型同名 ⇒ 编译期看不出来；运行期 `JsonStorage` 又把「`set` 不是函数」那记 TypeError 吞成
 * 返回 `false`（控制清单：读写失败永不抛异常）⇒ 网页端读档永远当新档、写档静默消失。
 * 判例 F4 / WXG-T-434；微信侧一直是对的（`weapp.ts` 有 `WeappStorage` 包 `wx.*StorageSync`）。
 */
interface DomLikeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
  clear(): void;
}

interface GlobalWithDom {
  performance?: { now(): number };
  localStorage?: DomLikeStorage;
  requestAnimationFrame?: (cb: (t: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
  innerWidth?: number;
  innerHeight?: number;
  devicePixelRatio?: number;
  addEventListener?: (type: string, cb: (ev?: unknown) => void, opts?: unknown) => void;
  removeEventListener?: (type: string, cb: (ev?: unknown) => void, opts?: unknown) => void;
  document?: { visibilityState?: string };
  AudioContext?: new () => unknown;
  webkitAudioContext?: new () => unknown;
  /** 长音频文件路线用（`AudioVoice.assetFile`）；非浏览器环境可缺。 */
  Audio?: new () => HTMLAudioElement;
}

function dom(): GlobalWithDom {
  return globalThis as unknown as GlobalWithDom;
}

/** DOM `Storage` → 框架 `Storage` 的适配层（与 `WeappStorage` 同族）。 */
class DomStorage implements Storage {
  constructor(private readonly _ls: DomLikeStorage) { }

  get(key: string): string | null {
    return this._ls.getItem(key);
  }

  set(key: string, value: string): void {
    // ⛔ 不在这里包 try/catch：配额与隐私模式的失败要顺着原有的通道上报——
    // `JsonStorage.setString` 捕获后返回 `false`，调用方据此决定降级，玩法不崩。
    this._ls.setItem(key, value);
  }

  remove(key: string): void {
    this._ls.removeItem(key);
  }

  keys(): string[] {
    // 按索引取，不用展开：与 `MemoryStorage.keys()` 同判例（Cocos ES5 会把非数组可迭代对象
    // 的展开降级成 concat 形式，真机上只拿到一个键，ADR-0012）。
    const out: string[] = [];
    for (let i = 0; i < this._ls.length; i++) {
      const key = this._ls.key(i);
      if (key !== null) out.push(key);
    }
    return out;
  }

  clear(): void {
    this._ls.clear();
  }
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
      // 浏览器宿主无微信胶囊 ⇒ `null`（「无接口值」），不是 0 / 零矩形。
      capsuleBottomDp: null,
      capsuleRectDp: null,
    };
    const raw = g.localStorage;
    this._storage = options.storage ?? (raw ? new DomStorage(raw) : new MemoryStorage());
  }

  now(): number {
    const perf = dom().performance;
    return perf ? perf.now() : Date.now();
  }

  createStorage(): Storage {
    return this._storage;
  }

  /**
   * 程序化合成后端（WXG-T-096 / audio-spec §6.2）：零外部音频文件 ⇒ 主包音频 0 KB。
   *
   * 两种情况下保持静音契约（诚实，不伪造有声）：
   *  - runtime 无 `AudioContext`（Node 单测 / 无 Web Audio 的环境）；
   *  - 游戏未传 `voices`（框架不认识玩法 clip id，无配方 ⇒ 不发明音色）。
   */
  createAudioBackend(options?: AudioBackendOptions): AudioBackend {
    const g = dom();
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    const voices = options?.voices;
    if (!Ctor || !voices) return new NullAudioBackend();

    const backend = new SynthAudioBackend(
      () => new Ctor() as SynthContext,
      voices,
      { warn: (message) => this.log('warn', `[audio] ${message}`) },
      // 文件路线（BGM）：浏览器用 <audio> 元素，语义与 weapp InnerAudioContext 对齐。
      // `play()` 的 Promise 拒绝（autoplay 策略等）一律吞掉 ⇒ 后端仍有合成回退，不静音。
      (src) => {
        const Audio = g.Audio;
        if (!Audio) return null;
        const el = new Audio();
        let prepared = false;
        const handle: SynthInnerAudio = {
          src,
          loop: false,
          volume: 1,
          play: () => {
            // 只在首次设 src：重复赋值会让元素重新取整曲（实测一次 suspend→resume 多拉 721 KB）
            if (!prepared) {
              el.src = handle.src;
              prepared = true;
            }
            el.loop = handle.loop;
            el.volume = handle.volume;
            try {
              el.play()?.catch(() => { }); // autoplay 策略拒绝 ⇒ 后端仍会走合成回退
            } catch {
              /* 交由上层回退 */
            }
          },
          onError: (cb) => {
            el.addEventListener('error', () => cb(`media error code=${el.error?.code ?? '?'} src=${el.currentSrc}`));
          },
          pause: () => el.pause(),
          stop: () => {
            el.pause();
            el.currentTime = 0;
          },
          destroy: () => {
            el.pause();
            el.removeAttribute('src');
            el.load();
          },
        };
        return handle;
      },
    );
    this._armAudioUnlock(backend);
    return backend;
  }

  /**
   * autoplay 解锁（audio-spec §4.4）：context 只在首次真实手势后创建。
   * 一次性监听，触发即摘；同时接可见性切换，退后台停曲、回前台补起。
   */
  private _armAudioUnlock(backend: SynthAudioBackend): void {
    const g = dom();
    if (!g.addEventListener) return;
    const events = ['pointerdown', 'touchstart', 'keydown'] as const;
    const unlock = () => {
      backend.unlock();
      for (const type of events) g.removeEventListener?.(type, unlock);
    };
    for (const type of events) g.addEventListener(type, unlock, { passive: true });
    g.addEventListener('visibilitychange', () => {
      if (g.document?.visibilityState === 'hidden') backend.suspend();
      else backend.resume();
    });
  }

  /** Browser harness: a tap on 续时 completes immediately (no WeChat SDK). */
  override createRewardedAdProvider() {
    return new MockRewardedAdProvider('complete');
  }

  /**
   * Browser tacticle feedback via `navigator.vibrate` (Web Vibration API).
   * 支持有限（Chrome/Android 上可用；iOS Safari 全禁）。无 API ⇒ 静默 noop。
   * kind 粗略映射：light ≈ 15ms、medium ≈ 25ms、heavy ≈ 40ms；其余 25ms。
   */
  haptic(kind: HapticKind): void {
    const g = dom() as unknown as { navigator?: { vibrate?: (ms: number) => boolean } };
    const nav = g.navigator;
    if (!nav || typeof nav.vibrate !== 'function') return;
    const ms = kind === 'light' ? 15 : kind === 'heavy' ? 40 : 25;
    try { nav.vibrate(ms); } catch { /* ignore */ }
  }

  httpGet(url: string): Promise<unknown> {
    const g = globalThis as unknown as { fetch?: (u: string | URL, init?: unknown) => Promise<{ json(): Promise<unknown> }> };
    if (typeof g.fetch !== 'function') {
      return Promise.reject(new Error('[platform] fetch unavailable (web without global fetch)'));
    }
    return g.fetch(url).then((r) => r.json());
  }

  setPreferredFps(_fps: 30 | 60): void {
    // Web has no setPreferredFramesPerSecond — silently noop.
  }

  getPerformance(): import('../core/performance/performance.js').PerformanceSnapshot {
    const fps = computeFps(this._frameDeltas);
    return {
      fps: fps > 0 ? fps : null,
      heapBytesUsed: null,
      heapBytesTotal: null,
      clampedFrames: this._loopClampedFrames,
      ticks: this._loopTicks,
      loopTimeSeconds: this._loopTimeSeconds,
      targetFps: this._targetFps,
      frameBudgetMiss: fps > 0 && fps < this._targetFps * 0.9,
    };
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
      this._recordFrame(dt / 1000); // WXG-T-414
      callback(dt);
    });
    return { cancel: () => g.cancelAnimationFrame?.(id) };
  }

  override onHide(callback: () => void): () => void {
    const g = dom();
    if (!g.addEventListener) return () => { };
    g.addEventListener('visibilitychange', callback);
    return () => { };
  }

  override onShow(callback: () => void): () => void {
    const g = dom();
    if (!g.addEventListener) return () => { };
    g.addEventListener('focus', callback);
    return () => { };
  }
}
