import { describe, expect, it, vi } from 'vitest';
import { CocosLoopBridge, type SchedulerLike } from '../../src/adapters/cocos/loop-bridge.js';
import { App } from '../../src/compose/app.js';
import type { Game, GameServices } from '../../src/core/game/game.js';
import type { RenderModelBuilder } from '../../src/core/render/render-model.js';
import { NodePlatform } from '../../src/platform/node.js';

class Counter implements Game {
  readonly id = 'counter';
  updates = 0;
  init(_services: GameServices): void {
    void _services;
  }
  update(): void {
    this.updates++;
  }
  buildRenderModel(_b: RenderModelBuilder): void {
    void _b;
  }
}

function fakeScheduler(): SchedulerLike & { tick: (dt: number) => void; scheduled: boolean } {
  const s = {
    scheduled: false,
    _cb: null as ((dt: number) => void) | null,
    schedule(cb: (dt: number) => void) {
      s._cb = cb;
      s.scheduled = true;
    },
    unschedule(cb: (dt: number) => void) {
      if (s._cb === cb) s._cb = null;
      s.scheduled = false;
    },
    tick(dt: number) {
      s._cb?.(dt);
    },
  };
  return s;
}

function setup() {
  const platform = new NodePlatform();
  const game = new Counter();
  const app = new App({ game, platform, seed: 'loop' });
  const scheduler = fakeScheduler();
  const onFrame = vi.fn();
  const bridge = new CocosLoopBridge(app, scheduler, onFrame);
  return { app, game, scheduler, bridge, onFrame };
}

describe('CocosLoopBridge', () => {
  it('starts the app and schedules a per-frame callback', () => {
    const { bridge, scheduler, app } = setup();
    bridge.start();
    expect(bridge.started).toBe(true);
    expect(app.running).toBe(true);
    expect(scheduler.scheduled).toBe(true);
  });

  it('forwards scheduled deltas into the app and calls the frame hook', () => {
    const { bridge, scheduler, game, onFrame } = setup();
    bridge.start();
    scheduler.tick(1 / 60);
    scheduler.tick(1 / 60);
    expect(game.updates).toBe(2);
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it('is idempotent on start()', () => {
    const { bridge, scheduler } = setup();
    bridge.start();
    bridge.start();
    expect(scheduler.scheduled).toBe(true);
  });

  it('stop() unschedules the callback and stops the app', () => {
    const { bridge, scheduler, app, game } = setup();
    bridge.start();
    bridge.stop();
    expect(bridge.started).toBe(false);
    expect(scheduler.scheduled).toBe(false);
    expect(app.running).toBe(false);
    scheduler.tick(1 / 60);
    expect(game.updates).toBe(0);
  });

  it('stop() on a never-started bridge is a no-op', () => {
    const { bridge, scheduler } = setup();
    expect(() => bridge.stop()).not.toThrow();
    expect(scheduler.scheduled).toBe(false);
  });

  // WXG-T-122 / BD-40: the bridge owns the tick — starting it against an App
  // that is already self-driving used to double-drive (~2× sim speed). Now it
  // must hard-fail instead of silently attaching the second driver.
  it('hard-fails instead of double-driving a self-driving app (BD-40)', () => {
    const platform = new NodePlatform();
    const game = new Counter();
    const app = new App({ game, platform, seed: 'loop' });
    app.start(); // self-drive via requestFrame
    const scheduler = fakeScheduler();
    const bridge = new CocosLoopBridge(app, scheduler);
    expect(() => bridge.start()).toThrow(/already self-driving/);
    expect(scheduler.scheduled).toBe(false); // second driver rejected
  });

  // `[WXG-T-1113]` tick 段卡表：有人读过绘制成本才读 clock，release 热路径零读表。
  it('injected clock + drawCostWanted ⇒ times app.tick and reports tickMs', () => {
    const platform = new NodePlatform();
    const game = new Counter();
    const app = new App({ game, platform, seed: 'loop' });
    const scheduler = fakeScheduler();
    let t = 0;
    const clock = vi.fn((): number => (t += 5)); // 每次读表 +5ms ⇒ tick 段 = 5ms
    const bridge = new CocosLoopBridge(app, scheduler, undefined, clock);
    app.services.readDrawCost!(); // 打开统计门（drawCostWanted = true）
    bridge.start();
    scheduler.tick(1 / 60);
    expect(clock).toHaveBeenCalledTimes(2); // t0 + t1，不多读
    expect(app.services.readDrawCost!().tickMs).toBe(5);
    bridge.stop();
    expect(app.running).toBe(false);
  });

  it('nobody read draw cost ⇒ clock is never touched, tickMs stays 0', () => {
    const platform = new NodePlatform();
    const game = new Counter();
    const app = new App({ game, platform, seed: 'loop' });
    const scheduler = fakeScheduler();
    const clock = vi.fn((): number => 0);
    const bridge = new CocosLoopBridge(app, scheduler, undefined, clock);
    bridge.start();
    scheduler.tick(1 / 60);
    expect(clock).not.toHaveBeenCalled();
    expect(app.services.readDrawCost!().tickMs).toBe(0);
    bridge.stop();
  });
});
