import { describe, expect, it } from 'vitest';
import * as performance from '../../src/core/performance/performance.js';

interface Probe {
  start(now: number): void;
  stop(): void;
  reset(): void;
  sample(now: number): void;
  report(): string;
}

function makeProbe(): Probe {
  const Probe = (performance as unknown as { TouchMoveProbe?: new () => Probe }).TouchMoveProbe;
  expect(Probe, '缺少 Cocos touchmove 入口计数器 TouchMoveProbe').toBeTypeOf('function');
  return new Probe!();
}

describe('TouchMoveProbe · Cocos _onTouchMove 入口采样', () => {
  it('默认关闭：不 start 时 sample 不计数', () => {
    const probe = makeProbe();
    probe.sample(0);
    probe.sample(8);
    expect(probe.report()).toBe('count=0 elapsedMs=0.0 hz=0.0 maxGapMs=0.0');
  });

  it('逐个入口计数，不去重、不按固定步或渲染帧合并', () => {
    const probe = makeProbe();
    probe.start(0);
    probe.sample(0);
    probe.sample(4);
    probe.sample(4);
    probe.sample(8);
    probe.sample(12);
    probe.stop();
    expect(probe.report()).toBe('count=5 elapsedMs=12.0 hz=333.3 maxGapMs=4.0');
  });

  it('Hz 从首个实际样本起算，不把 start 后等待算进采样窗口', () => {
    const probe = makeProbe();
    probe.start(100);
    probe.sample(150);
    probe.sample(250);
    probe.stop();
    expect(probe.report()).toBe('count=2 elapsedMs=100.0 hz=10.0 maxGapMs=100.0');
  });

  it('120Hz 样本读数为 120Hz；stop 后不再累计，reset 清空旧窗口', () => {
    const probe = makeProbe();
    probe.start(0);
    for (let i = 0; i <= 24; i += 1) probe.sample(i * 1000 / 120);
    probe.stop();
    expect(probe.report()).toBe('count=25 elapsedMs=200.0 hz=120.0 maxGapMs=8.3');
    probe.sample(208);
    expect(probe.report()).toBe('count=25 elapsedMs=200.0 hz=120.0 maxGapMs=8.3');
    probe.reset();
    expect(probe.report()).toBe('count=0 elapsedMs=0.0 hz=0.0 maxGapMs=0.0');
    probe.start(300);
    probe.sample(300);
    probe.sample(316);
    probe.stop();
    expect(probe.report()).toBe('count=2 elapsedMs=16.0 hz=62.5 maxGapMs=16.0');
  });
});
