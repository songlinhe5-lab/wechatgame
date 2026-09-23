/**
 * Audio scheduler.
 *
 * Gameplay requests sounds by *clip id*; the platform adapter decides how to
 * play them. The core adds two things native APIs lack and every mini-game
 * needs:
 *
 *  1. **Dedup / rate limiting** — a 60-hit-per-second brick stream must not fire
 *     60 identical `hit` sounds or we exhaust WeChat's `InnerAudioContext` pool.
 *  2. **Frame-batched dispatch** — requests are collected during update and
 *     flushed once per frame, so systems never block on audio.
 */

export interface AudioPlayOptions {
  readonly volume?: number;
  readonly loop?: boolean;
  /** Rate-limit window in seconds; identical clips inside it are dropped. */
  readonly minInterval?: number;
}

/**
 * Mix group a clip belongs to. Names come from `systems-index §3.12`（Music /
 * SFX / UI 三总线）. The *gains* are deliberately absent: §3.12 freezes them as
 * `[TODO]` until the backend is audible and loudness is calibrated on device, so
 * a backend must treat every bus gain as 1 and say so rather than invent dB.
 */
export type AudioBus = 'music' | 'sfx' | 'ui';

/**
 * One tone inside a voice: a frequency, when it starts (ms from the clip's
 * onset) and how long it sounds. `glideTo` sweeps linearly — that is what makes
 * a 「嗒」 drop or a 「叮」 rise without extra nodes.
 */
export interface AudioNote {
  readonly freq: number;
  readonly startMs?: number;
  readonly durMs?: number;
  readonly glideTo?: number;
  readonly gain?: number;
}

/**
 * Recipe for a programmatically synthesised clip — the data half of the
 * 「零音频文件进产物」 ruling（§3.12 选型 / 判据 A05-25）.
 *
 * WHO OWNS WHICH NUMBER: the *structure*（波形类别 / 包络分段 / 是否噪声）is
 * design（`audio-spec §4.3`）; every concrete Hz / ms / gain lives in the game's
 * own voice table and is a **工程占位** until the `[B]`/`[R]` 道次 定档 — §4.3
 * marks them `[TODO]`, so no number here may be quoted back as spec. Durations
 * are the one exception: they are capped by ux-spec §5 via `audio-events §1`.
 *
 * The core only *declares* this shape; rendering it is platform work
 * (`platform/audio-synth.ts`), which keeps L2（core 不碰 DOM / `AudioContext`）.
 */
export interface AudioVoice {
  readonly bus?: AudioBus;
  /** Upper bound from `audio-events §1`（硬约束，不自行延长）。 */
  readonly durationMs: number;
  /** Relative level 0..1 *within the clip*（≠ 总线增益，后者 `[TODO]`）. */
  readonly gain?: number;
  readonly wave?: 'sine' | 'triangle' | 'square' | 'sawtooth';
  readonly attackMs?: number;
  readonly releaseMs?: number;
  /** Single-shot tone list; omit for a plain tone at `freq`. */
  readonly notes?: readonly AudioNote[];
  readonly freq?: number;
  readonly glideTo?: number;
  /** Filter applied to the whole clip; `type` chosen per §4.3 结构列. */
  readonly filter?: 'lowpass' | 'highpass' | 'bandpass';
  readonly filterFreq?: number;
  /** Noise-source clip（「沙」/「唰」）— buffer 复用，见 synth 头注. */
  readonly noise?: boolean;
  /**
   * 素材路线（v1.52 改判）：`data:audio/mpeg;base64,…` 形式的**预制音频**。
   * 后端在解锁时解码一次进 `_assetBuffers`；命中即优先于合成，
   * 解码失败或 runtime 无 `decodeAudioData` ⇒ **回退到上面的 notes 合成**（不静音、不算回归）。
   * 只在 unlock 期解码，热路径零分配。
   */
  readonly asset?: string;
  /**
   * **文件路线**（长音频专用；设了它就走平台原生播放器，优先于 `asset` 与 notes）。
   * 动机是内存而不是包体：40 s BGM 若走 `decodeAudioData`，解码后 PCM 常驻 JS 堆
   * ≈ 40 × 44100 × 4 B ≈ **7 MB**；交给 `InnerAudioContext` / `Audio` 则 JS 侧 ≈ 0。
   * 短音效不要用这条 —— 19 条并发会撞原生实例池，且 base64 那 45 KB 不值得起文件。
   * 路径按平台解析（weapp = 包内/分包相对路径；web = 站点相对路径）。
   */
  readonly assetFile?: string;
  /**
   * Loop period in ms. Set on BGM clips: the backend then renders **one** buffer
   * of this length and loops it（无缝循环点，A05-22）instead of one-shots, so a
   * repeated `play(id,{loop:true})` must not restart its position.
   */
  readonly loopMs?: number;
}

/** Clip id → recipe. Games own their ids; the framework ships no voice library. */
export type AudioVoices = Readonly<Record<string, AudioVoice>>;

/** Options handed to `Platform.createAudioBackend` by the composition root. */
export interface AudioBackendOptions {
  readonly voices?: AudioVoices;
}

/** Lowest-level sink implemented by platform adapters. */
export interface AudioBackend {
  play(clipId: string, opts: Required<Pick<AudioPlayOptions, 'volume' | 'loop'>>): void;
  stop(clipId: string): void;
  stopAll(): void;
}

/** No-op backend used in tests and when audio is muted/unavailable. */
export class NullAudioBackend implements AudioBackend {
  readonly played: string[] = [];
  play(clipId: string): void {
    this.played.push(clipId);
  }
  stop(): void {}
  stopAll(): void {}
}

interface PendingRequest {
  clipId: string;
  volume: number;
  loop: boolean;
  minInterval: number;
}

export class AudioScheduler {
  private readonly _pending: PendingRequest[] = [];
  private readonly _lastPlayed = new Map<string, number>();
  private _time = 0;
  private _masterVolume = 1;
  private _muted = false;
  /** Hard cap on distinct sounds dispatched in a single frame. */
  private _maxPerFrame: number;

  constructor(
    private readonly _backend: AudioBackend = new NullAudioBackend(),
    options: { maxPerFrame?: number } = {},
  ) {
    this._maxPerFrame = options.maxPerFrame ?? 6;
  }

  get masterVolume(): number {
    return this._masterVolume;
  }

  setMasterVolume(v: number): void {
    this._masterVolume = v < 0 ? 0 : v > 1 ? 1 : v;
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (muted) {
      this._pending.length = 0;
      this._backend.stopAll();
    }
  }

  /**
   * Queue a sound for this frame. Duplicate clips within their `minInterval`
   * window are dropped.
   */
  play(clipId: string, opts: AudioPlayOptions = {}): void {
    if (this._muted) return;
    const minInterval = opts.minInterval ?? 0;
    if (minInterval > 0) {
      const last = this._lastPlayed.get(clipId);
      if (last !== undefined && this._time - last < minInterval) return;
    }
    this._pending.push({
      clipId,
      volume: opts.volume ?? 1,
      loop: opts.loop ?? false,
      minInterval,
    });
  }

  /** Dispatch queued sounds. Call once per frame, after gameplay update. */
  flush(dt: number): void {
    this._time += dt;
    if (this._pending.length === 0) return;

    const dispatched = new Set<string>();
    let count = 0;
    for (const req of this._pending) {
      if (count >= this._maxPerFrame) break;
      if (dispatched.has(req.clipId)) continue;
      dispatched.add(req.clipId);
      count++;
      this._lastPlayed.set(req.clipId, this._time);
      this._backend.play(req.clipId, {
        volume: req.volume * this._masterVolume,
        loop: req.loop,
      });
    }
    this._pending.length = 0;
  }

  stop(clipId: string): void {
    this._backend.stop(clipId);
  }

  stopAll(): void {
    this._backend.stopAll();
  }

  /** Number of queued-but-not-yet-flushed requests (diagnostics/tests). */
  get pendingCount(): number {
    return this._pending.length;
  }
}
