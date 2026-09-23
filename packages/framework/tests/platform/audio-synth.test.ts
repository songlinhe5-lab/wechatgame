/**
 * SynthAudioBackend 单元测试（WXG-T-096 / audio-spec §6.2 需求单）。
 *
 * 用**假 Web Audio**（记录型节点）跑，不依赖任何真 `AudioContext` ⇒ Node 可验，
 * 也顺带机验「引擎只用到最小 API 子集」这条 weapp 对偶实现的前提。
 *
 * 诚实边界：本文件能证明的是**结构与契约**（何时建 context、幂等、未登记 id 静默、
 * 复用面、BD-51 存活配方：一次性 clip 走预渲染 buffer + 无参 start + 静态增益），
 * **不能**证明「真的出声 / 时长 / 响度」——那是 `[B]`/`[R]`/`[P]` 道次
 * （A05-03/22/26/27），不得在此记为已验收。
 */

import { describe, expect, it } from 'vitest';

import type { AudioVoices } from '../../src/core/audio/audio.js';
import {
  SynthAudioBackend,
  type SynthBuffer,
  type SynthBufferSource,
  type SynthContext,
  type SynthInnerAudio,
  type SynthFilter,
  type SynthGain,
  type SynthNode,
  type SynthParam,
} from '../../src/platform/audio-synth.js';

interface Recorder {
  readonly gains: FakeGain[];
  readonly sources: FakeBufferSource[];
  readonly filters: FakeFilter[];
  readonly buffers: FakeBuffer[];
}

function fakeParam(): SynthParam {
  return { value: 0 };
}

class FakeNode implements SynthNode {
  connected: SynthNode[] = [];
  disconnects = 0;
  connect(target: SynthNode): unknown {
    this.connected.push(target);
    return target;
  }
  disconnect(): void {
    this.disconnects++;
  }
}

class FakeGain extends FakeNode {
  gain: SynthParam = fakeParam();
}

class FakeFilter extends FakeNode implements SynthFilter {
  type = 'lowpass';
  frequency: SynthParam = fakeParam();
}

class FakeBuffer implements SynthBuffer {
  readonly data: Float32Array;
  constructor(
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = new Float32Array(length);
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}

class FakeBufferSource extends FakeNode implements SynthBufferSource {
  buffer: SynthBuffer | null = null;
  loop = false;
  playbackRate: SynthParam = fakeParam();
  /** 记的是**实参**：BD-51 判据要求 start() 无参（undefined），定时启动 = 静音风险。 */
  starts: (number | undefined)[] = [];
  stops: number[] = [];
  start(when?: number): void {
    this.starts.push(when);
  }
  stop(when = 0): void {
    this.stops.push(when);
  }
}

function fakeAudio(): { ctx: SynthContext; rec: Recorder } {
  const rec: Recorder = { gains: [], sources: [], filters: [], buffers: [] };
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: new FakeNode(),
    createGain(): SynthGain {
      const node = new FakeGain();
      rec.gains.push(node);
      return node;
    },
    createBiquadFilter(): SynthFilter {
      const node = new FakeFilter();
      rec.filters.push(node);
      return node;
    },
    createBufferSource(): SynthBufferSource {
      const node = new FakeBufferSource();
      rec.sources.push(node);
      return node;
    },
    createBuffer(channels: number, length: number, sampleRate: number): SynthBuffer {
      void channels;
      const buffer = new FakeBuffer(length, sampleRate);
      rec.buffers.push(buffer);
      return buffer;
    },
    resume(): unknown {
      ctx.state = 'running';
      return undefined;
    },
  } as unknown as SynthContext & { state: string };
  return { ctx, rec };
}

const VOICES: AudioVoices = {
  sfx_test: { durationMs: 120, freq: 200, bus: 'sfx' },
  sfx_two_notes: {
    durationMs: 200,
    bus: 'sfx',
    notes: [
      { freq: 500, durMs: 100 },
      { freq: 700, startMs: 100, durMs: 100 },
    ],
  },
  sfx_noisy: { durationMs: 200, noise: true, bus: 'ui' },
  bgm_test: { durationMs: 4000, loopMs: 4000, bus: 'music', notes: [{ freq: 300, durMs: 4000 }] },
};

function makeBackend(opts: { unlocked?: boolean } = {}): {
  backend: SynthAudioBackend;
  rec: Recorder;
  ctx: SynthContext;
  warnings: string[];
} {
  const { ctx, rec } = fakeAudio();
  const warnings: string[] = [];
  const backend = new SynthAudioBackend(
    () => ctx,
    VOICES,
    { warn: (message) => warnings.push(message) },
  );
  if (opts.unlocked !== false) backend.unlock();
  return { backend, rec, ctx, warnings };
}

describe('SynthAudioBackend · context 生命周期（§4.4）', () => {
  it('构造期不创建 AudioContext（BOOT 不占首屏）', () => {
    const { ctx, rec } = fakeAudio();
    let opens = 0;
    const backend = new SynthAudioBackend(
      () => {
        opens++;
        return ctx;
      },
      VOICES,
    );
    expect(backend.contextReady).toBe(false);
    backend.play('sfx_test', { volume: 1, loop: false });
    expect(opens).toBe(0);
    expect(rec.sources).toHaveLength(0);
  });

  it('解锁前的一次性请求被丢弃；解锁前的 loop 请求在解锁瞬间补起', () => {
    const { ctx, rec } = fakeAudio();
    let opens = 0;
    const backend = new SynthAudioBackend(
      () => {
        opens++;
        return ctx;
      },
      VOICES,
    );
    backend.play('sfx_test', { volume: 1, loop: false });
    backend.play('bgm_test', { volume: 1, loop: true });
    expect(opens).toBe(0);
    backend.unlock();
    expect(opens).toBe(1);
    expect(backend.activeLoops()).toEqual(['bgm_test']);
    expect(rec.sources.filter((s) => !s.loop)).toHaveLength(0); // 丢掉的 sfx 不该补发
    expect(rec.sources.filter((s) => s.loop).length).toBe(1);
  });

  it('unlock() 幂等：重复调用不再开第二个 context，也不重启 loop', () => {
    const h = makeBackend();
    const sources = h.rec.sources.length;
    h.backend.unlock();
    h.backend.unlock();
    expect(h.rec.sources).toHaveLength(sources);
  });
});

describe('SynthAudioBackend · voice 表与静默契约（ADR-0013）', () => {
  it('未登记 id ⇒ 不发声 + 一次性 warn（不代为发明音色）', () => {
    const h = makeBackend();
    h.backend.play('sfx_unknown', { volume: 1, loop: false });
    h.backend.play('sfx_unknown', { volume: 1, loop: false });
    expect(h.rec.sources).toHaveLength(0);
    expect(h.warnings.filter((w) => w.includes('sfx_unknown'))).toHaveLength(1);
  });

  it('按 bus 分增益组：music/sfx/ui 各一条，重复发声不新建', () => {
    const h = makeBackend();
    h.backend.play('sfx_test', { volume: 1, loop: false });
    h.backend.play('sfx_noisy', { volume: 1, loop: false });
    h.backend.play('bgm_test', { volume: 1, loop: true });
    // 三条 bus gain + 每 note 一条包络 gain；bus 面只 3 条。
    const busGains = h.rec.gains.filter((g) => g.connected.includes(h.ctx.destination as never));
    expect(busGains).toHaveLength(3);
  });

  it('多音 clip 离线渲染进**同一块** buffer，只起一个源（WXG-T-162）', () => {
    const h = makeBackend();
    h.backend.play('sfx_two_notes', { volume: 1, loop: false });
    const shots = h.rec.sources.filter((s) => !s.loop);
    expect(shots).toHaveLength(1);
    const buffer = shots[0]!.buffer as FakeBuffer;
    expect(buffer.length).toBe(Math.floor(44100 * 0.2)); // 总长 = 两音首尾覆盖
    // 两段都有样本：包络/序列已在 CPU 侧烘完，不再依赖定时起振。
    const half = Math.floor(buffer.length / 2);
    let first = 0;
    let second = 0;
    for (let i = 0; i < half; i++) if (buffer.data[i] !== 0) first++;
    for (let i = half; i < buffer.length; i++) if (buffer.data[i] !== 0) second++;
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(0);
  });

  it('一次性 clip 渲染缓存复用：同 id 二次播放不再 createBuffer，但另起新源', () => {
    const h = makeBackend();
    h.backend.play('sfx_test', { volume: 1, loop: false });
    h.backend.play('sfx_test', { volume: 1, loop: false });
    const shotBuffers = h.rec.buffers.filter((b) => b.length === Math.floor(44100 * 0.12));
    expect(shotBuffers).toHaveLength(1);
    expect(h.rec.sources.filter((s) => !s.loop)).toHaveLength(2);
  });

  it('噪声 clip 烘进 per-clip buffer（确定性 RNG，L4）且同 id 复用', () => {
    const h = makeBackend();
    h.backend.play('sfx_noisy', { volume: 1, loop: false });
    h.backend.play('sfx_noisy', { volume: 1, loop: false });
    expect(h.rec.buffers.filter((b) => b.length === Math.floor(44100 * 0.2))).toHaveLength(1);
    const filled = (h.rec.buffers[0] as unknown as FakeBuffer).data;
    let nonzero = 0;
    for (let i = 0; i < filled.length; i++) if (filled[i] !== 0) nonzero++;
    expect(nonzero).toBeGreaterThan(0); // 确实写进了样本（确定性 RNG，L4）
  });
});

describe('SynthAudioBackend · BD-51 存活配方（真机静音根因的机验面）', () => {
  it('一次性源全部无参 start()：不碰 currentTime 定时启动通道', () => {
    const h = makeBackend();
    h.backend.play('sfx_test', { volume: 1, loop: false });
    h.backend.play('sfx_two_notes', { volume: 1, loop: false });
    h.backend.play('sfx_noisy', { volume: 1, loop: false });
    const shots = h.rec.sources.filter((s) => !s.loop);
    expect(shots).toHaveLength(3);
    for (const src of shots) {
      expect(src.starts).toHaveLength(1);
      expect(src.starts[0]).toBeUndefined();
    }
  });

  it('播放链上的增益节点只吃静态 .value（SynthParam 已无时间自动化入口）', () => {
    const h = makeBackend();
    h.backend.play('sfx_test', { volume: 0.5, loop: false });
    const src = h.rec.sources.find((s) => !s.loop)!;
    const env = src.connected[0] as FakeGain;
    expect(env.gain.value).toBeCloseTo(0.5, 6);
    // 类型面即铁律面：SynthParam 只有 value，编译期就写不进自动化调用。
    expect(Object.keys(env.gain)).toEqual(['value']);
  });
});

describe('SynthAudioBackend · loop 幂等与停复（A05-21/22）', () => {
  it('重复 play(loop) 不重启位置：只有一个循环源', () => {
    const h = makeBackend();
    h.backend.play('bgm_test', { volume: 1, loop: true });
    h.backend.play('bgm_test', { volume: 1, loop: true });
    h.backend.play('bgm_test', { volume: 1, loop: true });
    const loops = h.rec.sources.filter((s) => s.loop);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.starts).toHaveLength(1);
    expect(h.backend.activeLoops()).toEqual(['bgm_test']);
  });

  it('stop() 后期望态清除：再解锁不会自己响回来', () => {
    const h = makeBackend();
    h.backend.play('bgm_test', { volume: 1, loop: true });
    h.backend.stop('bgm_test');
    expect(h.backend.activeLoops()).toEqual([]);
    h.backend.resume();
    expect(h.backend.activeLoops()).toEqual([]);
  });

  it('suspend() 停曲但**保留期望态**，resume() 补起（退后台不丢 BGM）', () => {
    const h = makeBackend();
    h.backend.play('bgm_test', { volume: 1, loop: true });
    h.backend.suspend();
    expect(h.backend.activeLoops()).toEqual([]);
    h.backend.resume();
    expect(h.backend.activeLoops()).toEqual(['bgm_test']);
  });

  it('stopAll() 清循环与一次性源', () => {
    const h = makeBackend();
    h.backend.play('bgm_test', { volume: 1, loop: true });
    h.backend.play('sfx_test', { volume: 1, loop: false });
    h.backend.stopAll();
    expect(h.backend.activeLoops()).toEqual([]);
    for (const src of h.rec.sources) expect(src.stops.length).toBeGreaterThan(0);
  });

  it('循环缓冲只渲染一次（第二次起复用缓存）', () => {
    const h = makeBackend();
    h.backend.play('bgm_test', { volume: 1, loop: true });
    h.backend.stop('bgm_test');
    h.backend.play('bgm_test', { volume: 1, loop: true });
    const loopFrames = Math.floor(44100 * 4);
    expect(h.rec.buffers.filter((b) => b.length === loopFrames)).toHaveLength(1);
  });
});

describe('SynthAudioBackend · 零外部文件承诺（A05-25 的运行时面）', () => {
  it('usesExternalFiles() === false（合成路线不引 src URL）', () => {
    expect(SynthAudioBackend.usesExternalFiles()).toBe(false);
    const h = makeBackend();
    h.backend.play('sfx_test', { volume: 0.5, loop: false });
    for (const src of h.rec.sources) expect(src.buffer === null || src.buffer instanceof FakeBuffer).toBe(true);
  });

  it('setVolume() 夹到 [0,1]，且对**正在播的循环曲**当场改电平、不重启位置（需求单第 4 项）', () => {
    const h = makeBackend();
    h.backend.play('bgm_test', { volume: 1, loop: true });
    // 循环曲的 env 是唯一「不直连 destination」的那条 gain（bus 才直连）。
    const env = h.rec.gains.find((g) => !g.connected.includes(h.ctx.destination as never));
    expect(env, 'loop 包络 gain 未建').toBeDefined();
    expect(env!.gain.value).toBeCloseTo(1, 6);
    h.backend.setVolume('bgm_test', 5); // 越上界 ⇒ 夹到 1
    expect(env!.gain.value).toBeCloseTo(1, 6);
    h.backend.setVolume('bgm_test', -3); // 越下界 ⇒ 夹到 0（落在指数地板 EPS）
    expect(env!.gain.value).toBeLessThan(0.001);
    h.backend.setVolume('bgm_test', 0.4);
    expect(env!.gain.value).toBeCloseTo(0.4, 6);
    const loops = h.rec.sources.filter((s) => s.loop);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.starts).toHaveLength(1); // 改电平不得变成重起一圈
  });

  it('setVolume() 后的一次性 clip 仍可正常下发（不抛、不静默吞掉）', () => {
    const h = makeBackend();
    h.backend.setVolume('sfx_test', 5);
    expect(() => h.backend.play('sfx_test', { volume: 1, loop: false })).not.toThrow();
    h.backend.setVolume('sfx_test', -3);
    expect(() => h.backend.play('sfx_test', { volume: 1, loop: false })).not.toThrow();
    expect(h.rec.sources.filter((s) => !s.loop)).toHaveLength(2);
  });
});

// ───────────────────────── 素材路线（v1.52 改判：预制音频优先于合成，失败必回退）
// 判据边界同本文件头注：这里只证**结构与回退**，不证「真的放得出声」——那是 `[B]`/`[R]`。

/** 'hello' 的 base64；用于机验自实现解码器（weapp 不保证有 atob / Buffer）。 */
const HELLO_B64 = 'aGVsbG8=';
const ASSET_VOICES: AudioVoices = {
  sfx_asset: { durationMs: 120, freq: 200, bus: 'sfx', asset: `data:audio/mpeg;base64,${HELLO_B64}` },
  sfx_plain: { durationMs: 120, freq: 200, bus: 'sfx' },
};

function fakeDecodeCtx(mode: 'callback' | 'promise' | 'error') {
  const { ctx, rec } = fakeAudio();
  const decoded = new FakeBuffer(7, 44100);
  const seen: Uint8Array[] = [];
  const c = ctx as unknown as SynthContext & {
    decodeAudioData?: (
      d: ArrayBuffer,
      ok?: (b: SynthBuffer) => void,
      bad?: (e?: unknown) => void,
    ) => unknown;
  };
  c.decodeAudioData = (d, ok, bad) => {
    seen.push(new Uint8Array(d));
    if (mode === 'callback') {
      ok?.(decoded);
      return undefined;
    }
    if (mode === 'error') {
      bad?.(new Error('fake reject'));
      return undefined;
    }
    return Promise.resolve(decoded);
  };
  return { ctx: c, rec, decoded, seen };
}

describe('素材路线 v1.52：asset 优先、解码失败必回退合成', () => {
  it('runtime 无 decodeAudioData ⇒ 忽略素材，仍走 notes 合成（不静音）', () => {
    const { ctx, rec } = fakeAudio();
    const b = new SynthAudioBackend(() => ctx, ASSET_VOICES);
    b.unlock();
    b.play('sfx_asset', { volume: 1, loop: false });
    expect(rec.sources).toHaveLength(1);
    expect(rec.sources[0]!.buffer).toBe(rec.buffers[rec.buffers.length - 1] ?? null); // 合成产物
  });

  it('回调式 decodeAudioData ⇒ 播的是解码返回的那块 buffer，且不再走 createBuffer 渲染', () => {
    const { ctx, rec, decoded, seen } = fakeDecodeCtx('callback');
    const b = new SynthAudioBackend(() => ctx, ASSET_VOICES);
    b.unlock();
    b.play('sfx_asset', { volume: 1, loop: false });
    expect(rec.sources[0]!.buffer).toBe(decoded);
    expect(rec.buffers).toHaveLength(0); // 没有再渲一遍合成
    // 自实现 base64 解码正确性：'aGVsbG8=' → h e l l o
    expect(Array.from(seen[0]!.subarray(0, 5))).toEqual([104, 101, 108, 108, 111]);
  });

  it('Promise 式 decodeAudioData ⇒ 同样命中素材', async () => {
    const { ctx, rec, decoded } = fakeDecodeCtx('promise');
    const b = new SynthAudioBackend(() => ctx, ASSET_VOICES);
    b.unlock();
    await Promise.resolve();
    b.play('sfx_asset', { volume: 1, loop: false });
    expect(rec.sources[0]!.buffer).toBe(decoded);
  });

  it('解码报错 ⇒ 该 clip 回退合成，不静音（避免「有文件却放不出」新缺陷）', () => {
    const { ctx, rec, decoded } = fakeDecodeCtx('error');
    const b = new SynthAudioBackend(() => ctx, ASSET_VOICES);
    b.unlock();
    b.play('sfx_asset', { volume: 1, loop: false });
    expect(rec.sources).toHaveLength(1);
    expect(rec.sources[0]!.buffer).not.toBe(decoded);
    expect(rec.buffers.length).toBeGreaterThan(0);
  });

  it('无 asset 的 clip 完全不受影响（逐字走原合成路径）', () => {
    const { ctx, rec, decoded } = fakeDecodeCtx('callback');
    const b = new SynthAudioBackend(() => ctx, ASSET_VOICES);
    b.unlock();
    b.play('sfx_plain', { volume: 1, loop: false });
    expect(rec.sources[0]!.buffer).not.toBe(decoded);
    expect(rec.buffers.length).toBeGreaterThan(0);
  });

  it('解码完成后补起期望中的 loop ⇒ BGM 不因解码晚于 play 而永久静默', async () => {
    const { ctx, rec, decoded } = fakeDecodeCtx('callback');
    const loopVoices: AudioVoices = {
      bgm_x: { durationMs: 1000, loopMs: 1000, bus: 'music', notes: [{ freq: 220, durMs: 1000 }], asset: `data:audio/mpeg;base64,${HELLO_B64}` },
    };
    const b = new SynthAudioBackend(() => ctx, loopVoices);
    b.play('bgm_x', { volume: 1, loop: true }); // 先于 unlock ⇒ 只进期望态
    expect(rec.sources).toHaveLength(0);
    b.unlock(); // 解码（同步回调）后应补起
    expect(rec.sources.some((s) => s.buffer === decoded)).toBe(true);
    expect(b.activeLoops()).toContain('bgm_x');
  });
});

// ───────────────────────── 文件路线 v1.52（长音频走原生播放器，动机是 JS 堆不驻 PCM）
// 分流规则：`assetFile` 命中 ⇒ 不起 WebAudio 缓冲；原生不可用 ⇒ **回退合成**（BGM 不能因为
// 文件通路失败而整首没声）。这里只证结构与释放，`[R]` 真机上 InnerAudioContext 的实际播放
// 与 loop 接缝质量不在本文件可证范围。

class FakeInner implements SynthInnerAudio {
  src = '';
  loop = false;
  volume = 1;
  plays = 0;
  stops = 0;
  pauses = 0;
  destroys = 0;
  constructor(private readonly _fail = false) {}
  play(): void {
    if (this._fail) throw new Error('play blocked');
    this.plays++;
  }
  pause(): void {
    this.pauses++;
  }
  stop(): void {
    this.stops++;
  }
  destroy(): void {
    this.destroys++;
  }
}


const FILE_VOICES: AudioVoices = {
  bgm_file: { durationMs: 40_000, loopMs: 40_000, bus: 'music', gain: 0.3, notes: [{ freq: 220, durMs: 1000 }], assetFile: 'audio/bgm_main.mp3' },
};

describe('文件路线 v1.52：assetFile 走原生播放器，不可用必回退合成', () => {
  it('命中 assetFile ⇒ 用原生实例播放，且完全不建 WebAudio 缓冲（JS 堆不驻 PCM）', () => {
    const { ctx, rec } = fakeAudio();
    const inner = new FakeInner();
    const b = new SynthAudioBackend(() => ctx, FILE_VOICES, {}, () => inner);
    b.unlock();
    b.play('bgm_file', { volume: 1, loop: true });
    expect(inner.plays).toBe(1);
    expect(inner.src).toBe('audio/bgm_main.mp3');
    expect(inner.loop).toBe(true);
    expect(inner.volume).toBeCloseTo(0.3, 6); // base 1 × voice.gain 0.3
    expect(rec.buffers).toHaveLength(0); // ⚠ 关键：没有 40 s × 44.1 kHz 的 PCM
    expect(b.activeLoops()).toEqual(['bgm_file']);
  });

  it('重复 play(loop) 幂等 ⇒ 不重启播放位置（A05-22）', () => {
    const { ctx } = fakeAudio();
    const inner = new FakeInner();
    const b = new SynthAudioBackend(() => ctx, FILE_VOICES, {}, () => inner);
    b.unlock();
    b.play('bgm_file', { volume: 1, loop: true });
    b.play('bgm_file', { volume: 1, loop: true });
    expect(inner.plays).toBe(1);
  });

  it('无原生工厂 ⇒ 回退合成 loop（缓冲照旧渲染，BGM 仍响）', () => {
    const { ctx, rec } = fakeAudio();
    const b = new SynthAudioBackend(() => ctx, FILE_VOICES);
    b.unlock();
    b.play('bgm_file', { volume: 1, loop: true });
    expect(rec.buffers.length).toBeGreaterThan(0);
    expect(rec.sources.some((s) => s.loop)).toBe(true);
  });

  it('工厂返回 null / play() 抛错 ⇒ 都回退合成，不留半死实例', () => {
    const { ctx, rec } = fakeAudio();
    const b1 = new SynthAudioBackend(() => ctx, FILE_VOICES, {}, () => null);
    b1.unlock();
    b1.play('bgm_file', { volume: 1, loop: true });
    expect(rec.buffers.length).toBeGreaterThan(0);

    const { ctx: ctx2, rec: rec2 } = fakeAudio();
    const bad = new FakeInner(true);
    const b2 = new SynthAudioBackend(() => ctx2, FILE_VOICES, {}, () => bad);
    b2.unlock();
    b2.play('bgm_file', { volume: 1, loop: true });
    expect(bad.destroys).toBe(1); // 抛错后必须释放，否则原生实例泄漏
    expect(rec2.buffers.length).toBeGreaterThan(0);
  });

  it('suspend 必须让文件路线的 BGM 闭嘴（退后台仍在响 = 事故）', () => {
    const { ctx } = fakeAudio();
    const made: FakeInner[] = [];
    const b = new SynthAudioBackend(() => ctx, FILE_VOICES, {}, () => {
      const i = new FakeInner();
      made.push(i);
      return i;
    });
    b.unlock();
    b.play('bgm_file', { volume: 1, loop: true });
    b.suspend();
    expect(made[0]!.pauses).toBe(1); // 有 pause ⇒ 走暂停，不销毁
    expect(made[0]!.destroys).toBe(0);
    expect(b.activeLoops()).toEqual(['bgm_file']); // 期望态仍在（A05-27 半边）
  });

  it('回前台复用同一实例续播 ⇒ 不重建、不重下整曲（stop+destroy 路线实测每次多拉 721 KB）', () => {
    const { ctx } = fakeAudio();
    const made: FakeInner[] = [];
    const b = new SynthAudioBackend(() => ctx, FILE_VOICES, {}, () => {
      const i = new FakeInner();
      made.push(i);
      return i;
    });
    b.unlock();
    b.play('bgm_file', { volume: 1, loop: true });
    b.suspend();
    b.resume();
    expect(made).toHaveLength(1); // 关键：没有新建实例
    expect(made[0]!.plays).toBe(2); // 原地 play() 续播
    expect(made[0]!.destroys).toBe(0);
    b.stopAll();
    expect(made[0]!.destroys).toBe(1); // 真停曲才释放
  });

  it('平台无 pause ⇒ 回退 stop+destroy（不留活口），回前台再新建', () => {
    const { ctx } = fakeAudio();
    // 朴素对象假件：FakeInner 的 pause 是**原型方法**，delete 删不掉（会伪装成"有 pause"，
    // 上一版本判据就是这么假绿的）⇒ 要模拟老平台只能真的不给这个成员。
    class NoPause {
      src = '';
      loop = false;
      volume = 1;
      plays = 0;
      stops = 0;
      destroys = 0;
      play(): void {
        this.plays++;
      }
      stop(): void {
        this.stops++;
      }
      destroy(): void {
        this.destroys++;
      }
    }
    const made: NoPause[] = [];
    const b = new SynthAudioBackend(() => ctx, FILE_VOICES, {}, () => {
      const i = new NoPause();
      made.push(i);
      return i;
    });
    b.unlock();
    b.play('bgm_file', { volume: 1, loop: true });
    b.suspend();
    expect(made[0]!.stops).toBe(1);
    expect(made[0]!.destroys).toBe(1);
    b.resume();
    expect(made).toHaveLength(2);
    expect(b.activeLoops()).toEqual(['bgm_file']);
  });

  it('setVolume（ducking）落到原生 volume，不重启播放', () => {
    const { ctx } = fakeAudio();
    const inner = new FakeInner();
    const b = new SynthAudioBackend(() => ctx, FILE_VOICES, {}, () => inner);
    b.unlock();
    b.play('bgm_file', { volume: 0.5, loop: true });
    const before = inner.plays;
    b.setVolume('bgm_file', 0.5);
    expect(inner.volume).toBeCloseTo(0.5 * 0.5 * 0.3, 6); // base × perClip × voice.gain
    expect(inner.plays).toBe(before);
  });

  it('一次性音（loop=false）不受文件路线影响 ⇒ 仍走预渲染 buffer', () => {
    const { ctx, rec } = fakeAudio();
    const inner = new FakeInner();
    const b = new SynthAudioBackend(() => ctx, FILE_VOICES, {}, () => inner);
    b.unlock();
    b.play('bgm_file', { volume: 1, loop: false });
    expect(inner.plays).toBe(0);
    expect(rec.buffers.length).toBeGreaterThan(0);
  });
});
