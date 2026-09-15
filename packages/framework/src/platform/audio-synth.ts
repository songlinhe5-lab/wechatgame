/**
 * audio-synth.ts — 程序化音频合成引擎（WXG-T-096 / BD-05b，audio-spec §6.2 需求单）。
 *
 * 存在的理由：本仓库承诺 **主包内零音频文件**（`systems-index §3.12` 选型 + 判据
 * A05-25「产物内音频资产文件数 = 0、音频占用 = 0 KB」）⇒ 声音只能在运行时合成。
 * 本文件是那份「怎么合成」的**引擎**，而「每个 clip 长什么样」由游戏侧的 voice 表
 * 提供（`Game.audioVoices`，ADR-0013）——框架不认识 `sfx_place` 这类玩法 id。
 *
 * 住在这里而不是 `core/audio/audio.ts`：引擎必须触碰 `AudioContext`，而 L2 禁止
 * `core/**` 依赖 DOM / `wx`（`control-manifest.md`）。core 只留数据类型。
 *
 * ── 七项需求单的落点（audio-spec §6.2，正文摘要）─────────────────────────
 *  ① 实现 `AudioBackend` 三方法 + context 生命周期 → 本类 + `_ensureContext()`
 *  ② `play()` 对 loop clip **幂等**（A05-22）→ `_loops` 表：同一 id 已在播即直接返回，
 *     不重启缓冲位置
 *  ③ 按 bus 分增益组 → `_busNode()` 建 Music/SFX/UI 三条 gain 链；**增益一律 1**，
 *     因为 §3.12 把 `AUDIO_BUS_GAIN_*` 冻成 `[TODO]`（伪 dB 比静音更糟）
 *  ④ 可选 `setVolume(clipId, v)` → 本文件提供（ducking 的前置），core 暂不调用
 *  ⑤ priority/steal → **未做**（P2）。audio-events §3.1 已核算同帧最坏情形 ≤4 <
 *     `AUDIO_MAX_PER_FRAME=6` ⇒ MVP 用「入队序 + 限流」即无损，无需抢占
 *  ⑥ 节点复用满足热路径零分配 → 见下方「分配面」一节，**含一处诚实让步**
 *  ⑦ weapp 对偶实现 + iOS 解锁/退后台恢复 → `platform/weapp.ts`（本引擎按最小
 *     API 子集编程，两边共用）
 *
 * ── 分配面（⑥ 的诚实边界）──────────────────────────────────────────────
 *  Web Audio 的 `OscillatorNode` / `BufferSource` 是**一次性**节点（stop 后不可
 *  重启），所以「每次发声零分配」在该 runtime 下做不到。可复用的全部只建一次：
 *  三条 bus gain、每 clip 的 filter、噪声 buffer（250 ms）、BGM 循环 buffer。
 *  剩下的源节点数量由 `maxPerFrame`（冻结 = 6，§3.12 `AUDIO_MAX_PER_FRAME`）× 每
 *  clip 音数（≤4）限界 ⇒ 最坏 ~24 个短命节点/帧，且只在 `flush()` 里发生。
 *  登记为剩余项：真机 CPU 结论待 `[R]`（A05-27）。
 *
 * ── 自动播放解锁（audio-spec §4.4）─────────────────────────────────────
 *  context **不在构造时创建**。首次真实手势（`unlock()`，由平台侧监听器触发）才
 *  建；在那之前：一次性音效直接丢弃（autoplay policy 下本就无声，不是缺陷），
 *  loop 请求记入 `_wantedLoops`（**期望态**，与「正在播」的 `_loops` 分开），
 *  解锁瞬间补起 ⇒ BOOT 期的 `bgm_main` 不会丢。退后台 `suspend()` 只停「正在播」，
 *  期望态不动，回前台 `resume()` 据此补起（需求单第 7 项的 web 侧对偶）。
 */

import { createRng } from '../core/math/rng.js';
import type {
  AudioBackend,
  AudioBus,
  AudioNote,
  AudioVoice,
  AudioVoices,
} from '../core/audio/audio.js';

/** ── 最小 Web Audio 结构面（同时兼容 `wx.createWebAudioContext()` 的子集）──── */

export interface SynthParam {
  value: number;
  setValueAtTime?(value: number, time: number): void;
  linearRampToValueAtTime?(value: number, time: number): void;
}

export interface SynthNode {
  connect(target: SynthNode): unknown;
  disconnect?(): void;
}

export interface SynthGain extends SynthNode {
  gain: SynthParam;
}

export interface SynthFilter extends SynthNode {
  type: string;
  frequency: SynthParam;
}

export interface SynthOsc extends SynthNode {
  type: string;
  frequency: SynthParam;
  detune?: SynthParam;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface SynthBuffer {
  readonly length: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface SynthBufferSource extends SynthNode {
  buffer: SynthBuffer | null;
  loop: boolean;
  playbackRate?: SynthParam;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface SynthContext extends SynthNode {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state?: string;
  readonly destination: SynthNode;
  createGain(): SynthGain;
  createOscillator(): SynthOsc;
  createBiquadFilter?(): SynthFilter;
  createBufferSource?(): SynthBufferSource;
  createBuffer?(channels: number, length: number, sampleRate: number): SynthBuffer;
  resume?(): unknown;
}

/** 引擎向宿主回报异常的出口（平台侧接到 `platform.log`，测试侧接收集器）。 */
export interface SynthHost {
  warn?(message: string): void;
}

/** 噪声 buffer 长度（s）：够铺满最长的噪声类 clip（`sfx_stage` 250+250 ms）。 */
const NOISE_SECONDS = 0.25;
/** 一次性源的跟踪环容量：`maxPerFrame`(6) × 平均音数，留足余量且**只分配一次**。 */
const ACTIVE_RING = 48;
/** 指数逼近的地板值（0 会让 exponentialRamp 抛错，也听不出差别）。 */
const EPS = 0.0001;

interface ActiveShot {
  readonly node: SynthOsc | SynthBufferSource;
  readonly clipId: string;
  readonly endAt: number;
}

/** 正在播的循环曲：留着 env 与基准电平，`setVolume` 才能**当场**生效（需求单第 4 项）。 */
interface ActiveLoop {
  readonly src: SynthBufferSource;
  readonly env: SynthGain;
  /** 调用方请求的电平（**未**乘 clipGain）；clipGain 由 `_clipVolume` 单独可改。 */
  readonly base: number;
  readonly voice: AudioVoice;
}

function setParam(param: SynthParam, value: number, at: number): void {
  if (param.setValueAtTime) param.setValueAtTime(value, at);
  else param.value = value;
}

function rampParam(param: SynthParam, value: number, at: number): void {
  if (param.linearRampToValueAtTime) param.linearRampToValueAtTime(value, at);
  else param.value = value;
}

export class SynthAudioBackend implements AudioBackend {
  private _ctx: SynthContext | null = null;
  private _unlocked = false;
  private readonly _buses = new Map<AudioBus, SynthGain>();
  private readonly _filters = new Map<string, SynthFilter>();
  /** clipId → 正在播的 loop 源（幂等契约 A05-22 的判据面）。 */
  private readonly _loops = new Map<string, ActiveLoop>();
  /** clipId → 期望电平（调用方基准值）：**正在播**与否都成立（解锁补起、退后台恢复的判据面）。 */
  private readonly _wantedLoops = new Map<string, number>();
  private readonly _active: (ActiveShot | null)[] = new Array(ACTIVE_RING).fill(null);
  private _activeSlot = 0;
  private _noiseBuffer: SynthBuffer | null = null;
  /** clipId → 渲染好的循环缓冲（无缝 loop，§3.2）。 */
  private readonly _loopBuffers = new Map<string, SynthBuffer>();
  private readonly _warned = new Set<string>();
  private readonly _clipVolume = new Map<string, number>();

  constructor(
    private readonly _openContext: () => SynthContext | null,
    private readonly _voices: AudioVoices,
    private readonly _host: SynthHost = {},
  ) { }

  /** 已创建并解锁的 context（诊断/测试用；构造期不得有声音资源）。 */
  get contextReady(): boolean {
    return this._ctx !== null;
  }

  /** 正在循环的 clip id 列表（测试与 `[B]` 道次取证用）。 */
  activeLoops(): string[] {
    return Array.from(this._loops.keys());
  }

  /**
   * 首次用户手势（`pointerdown` / `touchstart`）。幂等。
   * 解锁前：一次性请求被丢弃、loop 请求进 `_wantedLoops` 排队（§4.4）。
   */
  unlock(): void {
    this._unlocked = true;
    const ctx = this._ensureContext();
    if (!ctx) return;
    if (ctx.resume && ctx.state === 'suspended') {
      try {
        ctx.resume();
      } catch {
        /* 有些 runtime 不允许重复 resume；忽略即可 */
      }
    }
    this._startWantedLoops();
  }

  /** 回前台：补起期望中的 loop（不打断已解锁状态）。 */
  resume(): void {
    this._startWantedLoops();
  }

  /**
   * 退后台 / 切走（A05-27 的 `[R]` 半边；weapp `onHide`、web `visibilitychange` 接这里）。
   * 只停实际发声，**不清期望态** —— 否则回前台会「BGM 再也不响」。
   */
  suspend(): void {
    for (const clipId of Array.from(this._loops.keys())) this.stop(clipId, { keepWanted: true });
  }

  private _startWantedLoops(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    for (const [clipId, base] of Array.from(this._wantedLoops)) {
      if (this._loops.has(clipId)) continue;
      const voice = this._voices[clipId];
      if (voice) this._startLoop(clipId, voice, base, ctx);
    }
  }

  /**
   * 需求单第 4 项：per-clip 电平（ducking 前置）。core 目前不调用，留给后续。
   * 正在播的循环曲**当场**改 env 增益（不重启位置）；一次性音在下发时取值。
   */
  setVolume(clipId: string, volume: number): void {
    const v = volume < 0 ? 0 : volume > 1 ? 1 : volume;
    this._clipVolume.set(clipId, v);
    const active = this._loops.get(clipId);
    if (active) active.env.gain.value = Math.max(EPS, active.base * v * (active.voice.gain ?? 1));
  }

  play(clipId: string, opts: { volume: number; loop: boolean }): void {
    const voice = this._voices[clipId];
    if (!voice) {
      // 未登记 ⇒ **不发明音色**（框架里没有声音库，见 ADR-0013 的取舍）。
      this._warnOnce(`clip "${clipId}" 无 voice 登记 ⇒ 静默跳过（新增音效请先改 audio-events §1 与游戏侧 voice 表）`);
      return;
    }
    const ctx = this._unlocked ? this._ensureContext() : null;
    const volume = opts.volume * (this._clipVolume.get(clipId) ?? 1);
    if (opts.loop && voice.loopMs && voice.loopMs > 0) {
      // 期望态先记账（存**基准值**）：即便此刻没有 context，解锁/回前台时也要补起，
      // 且补起时读的是**当时**的 `setVolume` 结果。
      this._wantedLoops.set(clipId, opts.volume);
      if (ctx) this._startLoop(clipId, voice, opts.volume, ctx);
      return;
    }
    if (ctx) this._startOneShot(clipId, voice, volume, ctx);
  }

  /** `keepWanted`：退后台停曲用 —— 停实际发声但保留「应该还在播」的事实。 */
  stop(clipId: string, opts: { keepWanted?: boolean } = {}): void {
    if (!opts.keepWanted) this._wantedLoops.delete(clipId);
    const loop = this._loops.get(clipId);
    if (loop) {
      this._loops.delete(clipId);
      try {
        loop.src.stop();
      } catch {
        /* 已结束的源 stop() 会抛；静音语义仍成立 */
      }
      loop.src.disconnect?.();
      loop.env.disconnect?.();
    }
    const ctx = this._ctx;
    const now = ctx ? ctx.currentTime : 0;
    for (let i = 0; i < this._active.length; i++) {
      const shot = this._active[i];
      if (!shot || shot.clipId !== clipId) continue;
      this._active[i] = null;
      try {
        shot.node.stop(now);
      } catch {
        /* 同上 */
      }
    }
  }

  stopAll(): void {
    for (const clipId of Array.from(this._loops.keys())) this.stop(clipId);
    for (let i = 0; i < this._active.length; i++) {
      const shot = this._active[i];
      if (!shot) continue;
      this._active[i] = null;
      try {
        shot.node.stop(this._ctx ? this._ctx.currentTime : 0);
      } catch {
        /* 同上 */
      }
    }
  }

  /** 供平台侧做产物/运行时自检（零文件承诺的机读面）。 */
  static usesExternalFiles(): boolean {
    return false;
  }

  // ── internals ──────────────────────────────────────────────────────────

  private _ensureContext(): SynthContext | null {
    if (this._ctx) return this._ctx;
    try {
      this._ctx = this._openContext();
    } catch (err) {
      this._warnOnce(`AudioContext 创建失败 ⇒ 本次会话静音：${String(err)}`);
      this._ctx = null;
    }
    return this._ctx;
  }

  private _warnOnce(message: string): void {
    if (this._warned.has(message)) return;
    this._warned.add(message);
    this._host.warn?.(message);
  }

  /** ③ 三总线：结构照 §3.12 建，**增益 1.0**（`AUDIO_BUS_GAIN_*` = `[TODO]`）。 */
  private _busNode(bus: AudioBus, ctx: SynthContext): SynthNode {
    let node = this._buses.get(bus);
    if (!node) {
      node = ctx.createGain();
      node.gain.value = 1;
      node.connect(ctx.destination);
      this._buses.set(bus, node);
    }
    return node;
  }

  private _outputFor(voice: AudioVoice, ctx: SynthContext): SynthNode {
    const bus: AudioBus = voice.bus ?? 'sfx';
    const busNode = this._busNode(bus, ctx);
    if (!voice.filter || !ctx.createBiquadFilter) return busNode;
    let filter = this._filters.get(voice.filter + String(voice.filterFreq ?? 0));
    if (!filter) {
      filter = ctx.createBiquadFilter!();
      filter.type = voice.filter;
      filter.frequency.value = voice.filterFreq ?? 20000;
      filter.connect(busNode);
      this._filters.set(voice.filter + String(voice.filterFreq ?? 0), filter);
    }
    return filter;
  }

  private _track(node: SynthOsc | SynthBufferSource, clipId: string, endAt: number): void {
    this._active[this._activeSlot] = { node, clipId, endAt };
    this._activeSlot = (this._activeSlot + 1) % ACTIVE_RING;
  }

  private _startOneShot(clipId: string, voice: AudioVoice, volume: number, ctx: SynthContext): void {
    const at = ctx.currentTime;
    const out = this._outputFor(voice, ctx);
    const notes: readonly AudioNote[] = voice.notes && voice.notes.length
      ? voice.notes
      : [{ freq: voice.freq ?? 440, glideTo: voice.glideTo, durMs: voice.durationMs }];
    const attackS = (voice.attackMs ?? 6) / 1000;
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]!;
      const start = at + (note.startMs ?? 0) / 1000;
      const dur = (note.durMs ?? voice.durationMs) / 1000;
      const peak = Math.max(EPS, volume * (voice.gain ?? 1) * (note.gain ?? 1));
      if (voice.noise) {
        const src = ctx.createBufferSource?.();
        if (!src) {
          this._warnOnce('runtime 缺 createBufferSource ⇒ 噪声类 clip 静音（`[R]` 待实测）');
          return;
        }
        const noise = this._noise(ctx);
        if (!noise) return;
        src.buffer = noise;
        src.loop = true;
        const env = ctx.createGain();
        env.gain.value = 0;
        setParam(env.gain, peak, start);
        rampParam(env.gain, EPS, start + dur);
        src.connect(env);
        env.connect(out);
        src.start(start);
        src.stop(start + dur + attackS);
        this._track(src, clipId, start + dur);
        continue;
      }
      const osc = ctx.createOscillator();
      osc.type = voice.wave ?? 'sine';
      setParam(osc.frequency, note.freq, start);
      if (note.glideTo) rampParam(osc.frequency, note.glideTo, start + dur);
      const env = ctx.createGain();
      env.gain.value = 0;
      setParam(env.gain, EPS, start);
      rampParam(env.gain, peak, start + attackS);
      rampParam(env.gain, EPS, start + dur);
      osc.connect(env);
      env.connect(out);
      osc.start(start);
      osc.stop(start + dur + attackS);
      this._track(osc, clipId, start + dur);
    }
  }

  private _noise(ctx: SynthContext): SynthBuffer | null {
    if (this._noiseBuffer) return this._noiseBuffer;
    const make = ctx.createBuffer;
    if (!make) {
      this._warnOnce('runtime 缺 createBuffer ⇒ 无法生成噪声（程序化合成路线受阻，需 `[R]` 复核）');
      return null;
    }
    const frames = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
    const buffer = make.call(ctx, 1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // L4：噪声是**素材**而非玩法随机，仍走 `createRng(seed)` 保证可复现。
    const rng = createRng('wxg-audio-noise');
    for (let i = 0; i < frames; i++) data[i] = rng.next() * 2 - 1;
    this._noiseBuffer = buffer;
    return buffer;
  }

  /** 无缝循环：把 `loopMs` 乐句**离线渲染成一块 buffer**，用 `source.loop` 循环。 */
  private _startLoop(clipId: string, voice: AudioVoice, base: number, ctx: SynthContext): void {
    if (this._loops.has(clipId)) return; // ② 幂等：不重启位置
    const src = ctx.createBufferSource?.();
    const buffer = src ? this._renderLoop(clipId, voice, ctx) : null;
    if (!src || !buffer) {
      this._warnOnce(`loop clip "${clipId}" 无法渲染循环缓冲 ⇒ 本曲静音（A05-22 待 runtime 复核）`);
      return;
    }
    src.buffer = buffer;
    src.loop = true;
    const env = ctx.createGain();
    env.gain.value = Math.max(EPS, base * (this._clipVolume.get(clipId) ?? 1) * (voice.gain ?? 1));
    src.connect(env);
    env.connect(this._outputFor(voice, ctx));
    src.start();
    this._loops.set(clipId, { src, env, base, voice });
  }

  private _renderLoop(clipId: string, voice: AudioVoice, ctx: SynthContext): SynthBuffer | null {
    const cached = this._loopBuffers.get(clipId);
    if (cached) return cached;
    const make = ctx.createBuffer;
    if (!make) return null;
    const loopMs = voice.loopMs ?? 0;
    const frames = Math.max(1, Math.floor((ctx.sampleRate * loopMs) / 1000));
    const buffer = make.call(ctx, 1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const notes = voice.notes ?? [];
    for (let n = 0; n < notes.length; n++) {
      const note = notes[n]!;
      const freq = note.freq;
      const startFrame = Math.floor((ctx.sampleRate * (note.startMs ?? 0)) / 1000);
      const durFrame = Math.max(1, Math.floor((ctx.sampleRate * (note.durMs ?? loopMs)) / 1000));
      const peak = (note.gain ?? 1) * (voice.gain ?? 1);
      const attack = Math.max(1, Math.floor((ctx.sampleRate * (voice.attackMs ?? 40)) / 1000));
      const release = Math.max(1, Math.floor((ctx.sampleRate * (voice.releaseMs ?? 120)) / 1000));
      const limit = Math.min(frames, startFrame + durFrame);
      for (let i = startFrame; i < limit; i++) {
        const t = (i - startFrame) / ctx.sampleRate;
        const envIn = Math.min(1, (i - startFrame) / attack);
        const envOut = Math.min(1, (limit - i) / release);
        data[i] = (data[i] ?? 0) + Math.sin(2 * Math.PI * freq * t) * peak * envIn * envOut;
      }
    }
    this._loopBuffers.set(clipId, buffer);
    return buffer;
  }
}
