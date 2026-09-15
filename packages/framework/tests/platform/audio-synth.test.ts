/**
 * SynthAudioBackend 单元测试（WXG-T-096 / audio-spec §6.2 需求单）。
 *
 * 用**假 Web Audio**（记录型节点）跑，不依赖任何真 `AudioContext` ⇒ Node 可验，
 * 也顺带机验「引擎只用到最小 API 子集」这条 weapp 对偶实现的前提。
 *
 * 诚实边界：本文件能证明的是**结构与契约**（何时建 context、幂等、未登记 id 静默、
 * 复用面），**不能**证明「真的出声 / 时长 / 响度」——那是 `[B]`/`[R]`/`[P]` 道次
 * （A05-03/22/26/27），不得在此记为已验收。
 */

import { describe, expect, it } from 'vitest';

import type { AudioVoices } from '../../src/core/audio/audio.js';
import {
  SynthAudioBackend,
  type SynthBuffer,
  type SynthBufferSource,
  type SynthContext,
  type SynthFilter,
  type SynthGain,
  type SynthNode,
  type SynthOsc,
  type SynthParam,
} from '../../src/platform/audio-synth.js';

interface Recorder {
  readonly gains: FakeGain[];
  readonly oscs: FakeOsc[];
  readonly sources: FakeBufferSource[];
  readonly filters: FakeFilter[];
  readonly buffers: FakeBuffer[];
}

function fakeParam(): SynthParam {
  return { value: 0, setValueAtTime() { }, linearRampToValueAtTime() { } };
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

class FakeOsc extends FakeNode implements SynthOsc {
  type = 'sine';
  frequency: SynthParam = fakeParam();
  detune: SynthParam = fakeParam();
  starts: number[] = [];
  stops: number[] = [];
  start(when = 0): void {
    this.starts.push(when);
  }
  stop(when = 0): void {
    this.stops.push(when);
  }
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
  starts: number[] = [];
  stops: number[] = [];
  start(when = 0): void {
    this.starts.push(when);
  }
  stop(when = 0): void {
    this.stops.push(when);
  }
}

function fakeAudio(): { ctx: SynthContext; rec: Recorder } {
  const rec: Recorder = { gains: [], oscs: [], sources: [], filters: [], buffers: [] };
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
    createOscillator(): SynthOsc {
      const node = new FakeOsc();
      rec.oscs.push(node);
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
    expect(rec.oscs).toHaveLength(0);
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
    expect(rec.oscs).toHaveLength(0); // 丢掉的 sfx 不该补发
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
    expect(h.rec.oscs).toHaveLength(0);
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

  it('notes 序列逐音起振（2 音 = 2 个源）', () => {
    const h = makeBackend();
    h.backend.play('sfx_two_notes', { volume: 1, loop: false });
    expect(h.rec.oscs).toHaveLength(2);
    expect(h.rec.oscs[0]!.starts[0]).toBe(0);
    expect(h.rec.oscs[1]!.starts[0]).toBe(0.1);
  });

  it('噪声 clip 复用同一块噪声 buffer（§6.2 第 6 项的复用面）', () => {
    const h = makeBackend();
    h.backend.play('sfx_noisy', { volume: 1, loop: false });
    h.backend.play('sfx_noisy', { volume: 1, loop: false });
    expect(h.rec.buffers.filter((b) => b.length === Math.floor(44100 * 0.25))).toHaveLength(1);
    const filled = (h.rec.buffers[0] as unknown as FakeBuffer).data;
    let nonzero = 0;
    for (let i = 0; i < filled.length; i++) if (filled[i] !== 0) nonzero++;
    expect(nonzero).toBeGreaterThan(0); // 确实写进了样本（确定性 RNG，L4）
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
    for (const osc of h.rec.oscs) expect(osc.stops.length).toBeGreaterThan(0);
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
    expect(h.rec.oscs).toHaveLength(2);
  });
});
