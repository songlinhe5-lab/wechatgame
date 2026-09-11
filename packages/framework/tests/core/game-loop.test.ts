import { describe, expect, it, vi } from 'vitest';
import { FixedStepLoop } from '../../src/core/loop/game-loop.js';

function makeLoop(options?: { fixedDt?: number; maxSubSteps?: number; maxFrameTime?: number }) {
  const updates: number[] = [];
  const renders: number[] = [];
  const loop = new FixedStepLoop(
    {
      fixedUpdate: (dt) => updates.push(dt),
      render: (alpha) => renders.push(alpha),
    },
    options,
  );
  return { loop, updates, renders };
}

describe('FixedStepLoop', () => {
  it('rejects a non-positive fixed step', () => {
    expect(() => new FixedStepLoop({ fixedUpdate: () => {}, render: () => {} }, { fixedDt: 0 })).toThrow(
      /fixedDt/,
    );
  });

  it('runs one fixed step per 1/60 s of accumulated time', () => {
    const { loop, updates } = makeLoop();
    const steps = loop.advance(1 / 60);
    expect(steps).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toBeCloseTo(1 / 60, 10);
    expect(loop.ticks).toBe(1);
    expect(loop.time).toBeCloseTo(1 / 60, 10);
  });

  it('accumulates sub-step remainders across frames', () => {
    const { loop, updates } = makeLoop();
    expect(loop.advance(0.01)).toBe(0);
    expect(loop.advance(0.01)).toBe(1); // 0.02 total > 1/60
    expect(updates).toHaveLength(1);
    expect(loop.pendingTime).toBeCloseTo(0.02 - 1 / 60, 10);
  });

  it('runs multiple sub-steps for a big frame', () => {
    const { loop } = makeLoop();
    const steps = loop.advance(3 / 60);
    expect(steps).toBe(3);
  });

  it('always renders exactly once per frame with an alpha in [0,1)', () => {
    const { loop, renders } = makeLoop();
    loop.advance(0.005);
    loop.advance(1 / 60);
    expect(renders).toHaveLength(2);
    for (const a of renders) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it('caps catch-up work at maxSubSteps to avoid a spiral of death', () => {
    const { loop, updates } = makeLoop({ maxSubSteps: 3 });
    const steps = loop.advance(10); // clamped to maxFrameTime anyway
    expect(steps).toBe(3);
    expect(updates).toHaveLength(3);
  });

  it('clamps pathological frame deltas and counts them', () => {
    const { loop } = makeLoop({ maxFrameTime: 0.1, maxSubSteps: 100 });
    loop.advance(5);
    expect(loop.clampedFrames).toBe(1);
    expect(loop.time).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  it('ignores negative and non-finite deltas', () => {
    const { loop, updates } = makeLoop();
    expect(loop.advance(-1)).toBe(0);
    expect(loop.advance(Number.NaN)).toBe(0);
    expect(loop.advance(Number.POSITIVE_INFINITY)).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it('reset() clears the backlog (used after returning from background)', () => {
    const { loop } = makeLoop();
    loop.advance(0.01);
    expect(loop.pendingTime).toBeGreaterThan(0);
    loop.reset();
    expect(loop.pendingTime).toBe(0);
  });

  it('is deterministic: identical frame sequences produce identical outputs', () => {
    const a = makeLoop();
    const b = makeLoop();
    const frames = [0.016, 0.033, 0.008, 0.05, 0.016];
    for (const dt of frames) {
      a.loop.advance(dt);
      b.loop.advance(dt);
    }
    expect(a.updates).toEqual(b.updates);
    expect(a.loop.ticks).toBe(b.loop.ticks);
  });

  it('exposes alpha reflecting the pending remainder', () => {
    const { loop } = makeLoop();
    loop.advance(1 / 120);
    expect(loop.alpha).toBeCloseTo(0.5, 6);
  });

  it('does not let render throw swallow the frame', () => {
    const render = vi.fn(() => {
      throw new Error('renderer exploded');
    });
    const loop = new FixedStepLoop({ fixedUpdate: () => {}, render });
    expect(() => loop.advance(1 / 60)).toThrow(/renderer exploded/);
    expect(render).toHaveBeenCalledTimes(1);
  });
});
