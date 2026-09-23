/**
 * Browser platform — powers the dev harness (`dev/harness`).
 *
 * Uses `localStorage`, `requestAnimationFrame`, `performance.now()` and the Web
 * Audio API when available. All DOM access is guarded so this file can be
 * imported (and typechecked) in Node.
 */

import { MemoryStorage, type Storage } from '../core/save/storage';
import { NullAudioBackend, type AudioBackend, type AudioBackendOptions } from '../core/audio/audio';
import type { PlatformInfo } from '../core/game/game';
import { BasePlatform, type FrameHandle, type ScreenSize } from './platform';
import { MockRewardedAdProvider } from './rewarded-ad';
import { SynthAudioBackend, type SynthContext, type SynthInnerAudio } from './audio-synth';

interface GlobalWithDom {
  performance?: { now(): number };
  localStorage?: Storage;
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
              el.play()?.catch(() => {}); // autoplay 策略拒绝 ⇒ 后端仍会走合成回退
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
