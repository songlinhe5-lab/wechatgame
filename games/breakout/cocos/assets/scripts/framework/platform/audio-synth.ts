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
 *  Web Audio 的 `BufferSource` 是**一次性**节点（stop 后不可重启），所以「每次发声
 *  零分配」在该 runtime 下做不到。可复用的全部只建一次：三条 bus gain、每 clip 的
 *  filter、每 clip 的一次性渲染 buffer（WXG-T-162 后噪声也烘进去，不再单存 250 ms
 *  噪声块）、BGM 循环 buffer。一次性 clip 同 id 只渲染一次即缓存，剩下的短命节点
 *  = 每次发声一个 BufferSource + 一条包络 gain，数量由 `maxPerFrame`（冻结 = 6，
 *  §3.12 `AUDIO_MAX_PER_FRAME`）限界。真机 CPU 结论待 `[R]`（A05-27）。
 *
 * ── 自动播放解锁（audio-spec §4.4）─────────────────────────────────────
 *  context **不在构造时创建**。首次真实手势（`unlock()`，由平台侧监听器触发）才
 *  建；在那之前：一次性音效直接丢弃（autoplay policy 下本就无声，不是缺陷），
 *  loop 请求记入 `_wantedLoops`（**期望态**，与「正在播」的 `_loops` 分开），
 *  解锁瞬间补起 ⇒ BOOT 期的 `bgm_main` 不会丢。退后台 `suspend()` 只停「正在播」，
 *  期望态不动，回前台 `resume()` 据此补起（需求单第 7 项的 web 侧对偶）。
 *
 * ── 一次性音效一律**离线渲染成 buffer**（WXG-T-162 / 真机 BD-51）───────────
 *  旧实现用 OscillatorNode + `start(currentTime + offset)` + gain 的
 *  setValueAtTime / linearRampToValueAtTime 包络。微信 iOS 端
 *  `wx.createWebAudioContext().currentTime` 恒为 0、自动化时间轴不推进 ⇒
 *  所有依赖定时启动 / 斜坡的节点永远停在起始增益（≈ 0）——真机实测正是
 *  「BGM（离线 buffer + 静态增益 + 无参 start()）有声、全部一次性 SFX 静音」
 *  的分叉。现引擎**只允许**该存活配方：一次性 clip 预渲染成每 clip 缓存的
 *  PCM buffer（波形 / 滑音 / 多音 / 噪声 / 包络全部 CPU 侧算完），播放时
 *  BufferSource + 静态 gain + `start()` 无参。不得再引入任何
 *  AudioParam 时间自动化或 `start(when > 0)`。
 */

import { createRng } from '../core/math/rng';
import type {
  AudioBackend,
  AudioBus,
  AudioNote,
  AudioVoice,
  AudioVoices,
} from '../core/audio/audio';

/** ── 最小 Web Audio 结构面（同时兼容 `wx.createWebAudioContext()` 的子集）──── */

export interface SynthParam {
  value: number;
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
  createBiquadFilter?(): SynthFilter;
  createBufferSource?(): SynthBufferSource;
  createBuffer?(channels: number, length: number, sampleRate: number): SynthBuffer;
  /**
   * 素材路线用（v1.52）。签名同时兼容两种 runtime：
   * 现代 Promise 式 `decodeAudioData(buf) → Promise<AudioBuffer>` 与
   * 旧回调式 `decodeAudioData(buf, success, error)`（微信 WebAudioContext 属后者一族）。
   */
  decodeAudioData?(
    data: Uint8Array,
    success?: (buffer: SynthBuffer) => void,
    error?: () => void,
  ): unknown;
  resume?(): unknown;
}

/**
 * 平台原生播放器最小面（长音频走这条，见 `AudioVoice.assetFile`）。
 * 只要求这 6 个成员：weapp `InnerAudioContext` 与 web `HTMLAudioElement` 都能一次适配，
 * 多出来的能力一概不要 —— 适配层越薄，两个平台的差异越少。
 */
export interface SynthInnerAudio {
  src: string;
  loop: boolean;
  volume: number;
  play(): void;
  stop(): void;
  /** 必须释放：weapp 的 InnerAudioContext 是原生实例，不 destroy 会漏。 */
  destroy(): void;
}

/** 引擎向宿主回报异常的出口（平台侧接到 `platform.log`，测试侧接收集器）。 */
export interface SynthHost {
  warn?(message: string): void;
}

/** 一次性源的跟踪环容量：`maxPerFrame`(6) 下发面，留足余量且**只分配一次**。 */
const ACTIVE_RING = 48;
/** 电平地板（0 会让依赖对数的实现出问题，也听不出差别）。 */
const EPS = 0.0001;

interface ActiveShot {
  readonly node: SynthBufferSource;
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

/** 单位相位 → 波形样本（离线渲染用，四波形对齐 WebAudio 同名振荡器的近似形状）。 */
/** 自带 base64 解码（不依赖 Buffer/atob —— weapp runtime 两者都不保证有）。 */
function base64Bytes(dataUri: string): Uint8Array | null {
  const b64 = dataUri.slice(dataUri.indexOf(',') + 1).replace(/\s+/g, '');
  if (!b64) return null;
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Int16Array(256).fill(-1);
  for (let i = 0; i < A.length; i++) lookup[A.charCodeAt(i)] = i;
  const out = new Uint8Array(Math.floor((b64.length * 3) / 4));
  let o = 0, acc = 0, bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const c = b64.charCodeAt(i);
    const v = c < 256 ? lookup[c] : -1;
    if (v < 0) continue; // '=' 与任何非法字符都跳过
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return o > 0 ? out.subarray(0, o) : null;
}

function sampleWave(wave: string, phase: number): number {
  const p = phase - Math.floor(phase);
  if (wave === 'square') return p < 0.5 ? 1 : -1;
  if (wave === 'sawtooth') return 2 * p - 1;
  if (wave === 'triangle') return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
  return Math.sin(2 * Math.PI * p);
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
  /** clipId → 渲染好的一次性缓冲（BD-51 存活配方，同 clip 复用）。 */
  private readonly _shotBuffers = new Map<string, SynthBuffer>();
  /** clipId → 渲染好的循环缓冲（无缝 loop，§3.2）。 */
  private readonly _loopBuffers = new Map<string, SynthBuffer>();
  /** clipId → 已解码的**素材** buffer（v1.52 改判：预制音频优先于运行时合成）。 */
  private readonly _assetBuffers = new Map<string, SynthBuffer>();
  private _assetsStarted = false;
  /** clipId → 正在播的原生播放器实例（文件路线，§4.1 v1.52 分流）。 */
  private readonly _inner = new Map<string, SynthInnerAudio>();
  private readonly _warned = new Set<string>();
  private readonly _clipVolume = new Map<string, number>();

  constructor(
    private readonly _openContext: () => SynthContext | null,
    private readonly _voices: AudioVoices,
    private readonly _host: SynthHost = {},
    /** 长音频工厂；不传 ⇒ `assetFile` 一律回退合成路线（不静音）。 */
    private readonly _openInnerAudio?: (src: string) => SynthInnerAudio | null,
  ) { }

  /** 已创建并解锁的 context（诊断/测试用；构造期不得有声音资源）。 */
  get contextReady(): boolean {
    return this._ctx !== null;
  }

  /** 正在循环的 clip id 列表（测试与 `[B]` 道次取证用）。 */
  activeLoops(): string[] {
    // 两条通路互斥（文件起成功就不会进 `_loops`），故不需去重；
    // 也不用 `[...map.keys()]` —— ES5 展开门（check:es5spread）禁止。
    const out: string[] = [];
    this._inner.forEach((_v, id) => out.push(id));
    this._loops.forEach((_v, id) => out.push(id));
    return out;
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
    this._decodeAssets(ctx);
    this._startWantedLoops();
  }

  /**
   * 解锁后解码素材（一次性、异步完成）。**解码失败不致命**：`_shotBuffer`/`_renderLoop`
   * 取不到素材就回退 notes 合成 ⇒ 游戏始终有声，且不产生「有文件却静音」的新缺陷。
   */
  private _decodeAssets(ctx: SynthContext): void {
    if (this._assetsStarted) return;
    this._assetsStarted = true;
    if (typeof ctx.decodeAudioData !== 'function') {
      this._warnOnce('runtime 无 decodeAudioData ⇒ 素材全部回退运行时合成（weapp 侧能力属 `[R]` 待验）');
      return;
    }
    for (const [clipId, voice] of Object.entries(this._voices)) {
      const asset = voice?.asset;
      if (!asset) continue;
      const bytes = base64Bytes(asset);
      if (!bytes) {
        this._warnOnce(`素材 base64 解析失败（clip=${clipId}）⇒ 回退合成`);
        continue;
      }
      const done = (buffer: SynthBuffer): void => {
        this._assetBuffers.set(clipId, buffer);
        // loop 期望态可能已在解码完成前试过 ⇒ 补起一次（_startWantedLoops 幂等）
        this._startWantedLoops();
      };
      try {
        const r = ctx.decodeAudioData!(bytes, done, () => {
          this._warnOnce(`decodeAudioData 拒绝该素材（可能是格式/位深不受支持）⇒ clip 回退合成`);
        });
        // Promise 式 runtime：回调不会被调用，走 then
        if (r && typeof (r as Promise<SynthBuffer>).then === 'function') {
          (r as Promise<SynthBuffer>).then(done, () => {
            this._warnOnce('decodeAudioData promise 失败 ⇒ 回退合成');
          });
        }
      } catch {
        this._warnOnce(`decodeAudioData 抛错（clip=${clipId}）⇒ 回退合成`);
      }
    }
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
    // 两条循环通路都要停：合成 loop 在 `_loops`，文件 loop 在 `_inner`。
    // 漏 `_inner` 的后果是「退后台 BGM 继续响」——判据 audio-synth.test「stop/destroy 原生实例」拦下过。
    for (const clipId of Array.from(this._inner.keys())) this.stop(clipId, { keepWanted: true });
    for (const clipId of Array.from(this._loops.keys())) this.stop(clipId, { keepWanted: true });
  }

  private _startWantedLoops(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    for (const [clipId, base] of Array.from(this._wantedLoops)) {
      if (this._loops.has(clipId) || this._inner.has(clipId)) continue;
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
    const inner = this._inner.get(clipId);
    if (inner) {
      const voice = this._voices[clipId];
      inner.volume = Math.max(0, (this._wantedLoops.get(clipId) ?? 1) * v * (voice?.gain ?? 1));
    }
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
    const inner = this._inner.get(clipId);
    if (inner) {
      this._inner.delete(clipId);
      try {
        inner.stop();
      } catch {
        /* 已停的实例再 stop 会抛；静音语义仍成立 */
      }
      try {
        inner.destroy();
      } catch {
        /* 同上 */
      }
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
    for (const clipId of Array.from(this._inner.keys())) this.stop(clipId);
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

  private _track(node: SynthBufferSource, clipId: string, endAt: number): void {
    this._active[this._activeSlot] = { node, clipId, endAt };
    this._activeSlot = (this._activeSlot + 1) % ACTIVE_RING;
  }

  /**
   * 一次性 clip 播放（BD-51 存活配方）：预渲染 buffer + BufferSource + 静态增益 +
   * **无参** `start()`。不碰任何 AudioParam 时间自动化，也不 `start(when > 0)` ——
   * 微信 iOS 的 `currentTime` 恒为 0，这两条路都通向永久静音。
   */
  private _startOneShot(clipId: string, voice: AudioVoice, volume: number, ctx: SynthContext): void {
    const buffer = this._shotBuffer(clipId, voice, ctx);
    if (!buffer) return;
    const src = ctx.createBufferSource?.();
    if (!src) {
      this._warnOnce('runtime 缺 createBufferSource ⇒ 一次性音效静音（离线渲染路线受阻，需 `[R]` 复核）');
      return;
    }
    src.buffer = buffer;
    src.loop = false;
    const env = ctx.createGain();
    env.gain.value = Math.max(EPS, volume); // 包络已烘进 buffer，这里只乘电平
    src.connect(env);
    env.connect(this._outputFor(voice, ctx));
    src.start();
    this._track(src, clipId, ctx.currentTime + buffer.length / buffer.sampleRate);
  }

  /** clipId → 一次性渲染缓存：同 clip 只 CPU 算一次（复用面，⑥）。 */
  private _shotBuffer(clipId: string, voice: AudioVoice, ctx: SynthContext): SynthBuffer | null {
    const asset = this._assetBuffers.get(clipId);
    if (asset) return asset; // v1.52：素材优先；未解码/解码失败则继续走合成
    const cached = this._shotBuffers.get(clipId);
    if (cached) return cached;
    const make = ctx.createBuffer;
    if (!make) {
      this._warnOnce('runtime 缺 createBuffer ⇒ 无法预渲染一次性音效（离线渲染路线受阻，需 `[R]` 复核）');
      return null;
    }
    const notes: readonly AudioNote[] = voice.notes && voice.notes.length
      ? voice.notes
      : [{ freq: voice.freq ?? 440, glideTo: voice.glideTo, durMs: voice.durationMs }];
    let totalMs = 0;
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]!;
      const span = (note.startMs ?? 0) + (note.durMs ?? voice.durationMs);
      if (span > totalMs) totalMs = span;
    }
    const sampleRate = ctx.sampleRate;
    const frames = Math.max(1, Math.floor((sampleRate * totalMs) / 1000));
    const buffer = make.call(ctx, 1, frames, sampleRate);
    const data = buffer.getChannelData(0);
    const attackFrames = Math.max(1, Math.floor((sampleRate * (voice.attackMs ?? 6)) / 1000));
    // L4：噪声是**素材**而非玩法随机，仍走 `createRng(seed)` 保同 clip 确定性渲染。
    const rng = voice.noise ? createRng(`wxg-audio-noise:${clipId}`) : null;
    for (let n = 0; n < notes.length; n++) {
      const note = notes[n]!;
      const startFrame = Math.floor((sampleRate * (note.startMs ?? 0)) / 1000);
      const durFrames = Math.max(1, Math.floor((sampleRate * (note.durMs ?? voice.durationMs)) / 1000));
      const endFrame = Math.min(frames, startFrame + durFrames);
      const peak = (note.gain ?? 1) * (voice.gain ?? 1);
      const atk = Math.min(attackFrames, durFrames);
      const decay = Math.max(1, durFrames - atk);
      const f0 = note.freq;
      const f1 = note.glideTo ?? note.freq;
      let phase = 0;
      for (let i = startFrame; i < endFrame; i++) {
        const rel = i - startFrame;
        // 滑音：频率线性插值，与旧 linearRampToValueAtTime 同形。
        phase += (f0 + ((f1 - f0) * rel) / durFrames) / sampleRate;
        const sample = rng ? rng.next() * 2 - 1 : sampleWave(voice.wave ?? 'sine', phase);
        // 包络：attack 爬升 → 余段线性落到 0（旧实现 peak→EPS 斜坡的烘千版）。
        const env = rel < atk ? rel / atk : Math.max(0, 1 - (rel - atk) / decay);
        data[i] = (data[i] ?? 0) + sample * peak * env;
      }
    }
    this._shotBuffers.set(clipId, buffer);
    return buffer;
  }

  /** 无缝循环：把 `loopMs` 乐句**离线渲染成一块 buffer**，用 `source.loop` 循环。 */
  private _startLoop(clipId: string, voice: AudioVoice, base: number, ctx: SynthContext): void {
    // 长音频分流：有 assetFile 且原生播放器可用 ⇒ JS 侧不驻 PCM（见 AudioVoice.assetFile）
    if (voice.assetFile && this._startFileLoop(clipId, voice, base)) return;
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

  /**
   * 文件路线起循环。**返回 false = 不可用**，调用方继续走合成（这条兜底不能省：
   * 原生播放器缺失/建不起来时，宁可回到"能响但音质是合成的"，也不要"彻底没 BGM"）。
   */
  private _startFileLoop(clipId: string, voice: AudioVoice, base: number): boolean {
    if (this._inner.has(clipId)) return true; // 幂等：已在播就不重启位置（A05-22）
    const make = this._openInnerAudio;
    const src = voice.assetFile;
    if (!make || !src) return false;
    let inner: SynthInnerAudio | null = null;
    try {
      inner = make(src);
    } catch (e) {
      this._warnOnce(`assetFile 创建失败（clip=${clipId} src=${src}）⇒ 回退合成路线`);
      return false;
    }
    if (!inner) return false;
    inner.src = src;
    inner.loop = true;
    inner.volume = Math.max(0, base * (this._clipVolume.get(clipId) ?? 1) * (voice.gain ?? 1));
    try {
      inner.play();
    } catch {
      try {
        inner.destroy();
      } catch {
        /* 平台差异：已销毁再 destroy 会抛 */
      }
      this._warnOnce(`assetFile play() 抛错（clip=${clipId}）⇒ 回退合成路线`);
      return false;
    }
    this._inner.set(clipId, inner);
    return true;
  }

  private _renderLoop(clipId: string, voice: AudioVoice, ctx: SynthContext): SynthBuffer | null {
    const asset = this._assetBuffers.get(clipId);
    if (asset) return asset;
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
