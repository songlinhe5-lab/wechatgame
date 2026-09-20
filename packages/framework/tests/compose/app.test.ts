import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/compose/app.js';
import { NullAssetProvider, MapAssetProvider } from '../../src/core/game/game.js';
import type { Game, GameServices, RenderModel } from '../../src/core/index.js';
import { RenderModelBuilder } from '../../src/core/index.js';
import { NodePlatform } from '../../src/platform/node.js';

class FakeGame implements Game {
  readonly id = 'fake';
  services: GameServices | null = null;
  updates = 0;
  lastDt = 0;
  renderCount = 0;
  paused = 0;
  resumed = 0;
  disposed = 0;

  init(services: GameServices): void {
    this.services = services;
  }
  update(dt: number): void {
    this.updates++;
    this.lastDt = dt;
  }
  buildRenderModel(builder: RenderModelBuilder): void {
    this.renderCount++;
    builder.setBackground('#000000');
    builder.rect(0, 0, 10, 10, { fill: '#fff' });
  }
  onPause(): void {
    this.paused++;
  }
  onResume(): void {
    this.resumed++;
  }
  dispose(): void {
    this.disposed++;
  }
}

function makeApp(overrides: Partial<ConstructorParameters<typeof App>[0]> = {}) {
  const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
  const game = new FakeGame();
  const app = new App({ game, platform, designWidth: 750, designHeight: 1334, seed: 'test', ...overrides });
  return { app, game, platform };
}

describe('App', () => {
  it('builds services from the platform', () => {
    const { app } = makeApp();
    expect(app.services.platform.name).toBe('node');
    expect(app.services.assets).toBeInstanceOf(NullAssetProvider);
    expect(app.services.viewport.designWidth).toBe(750);
    expect(app.services.rewardedAd.isReady()).toBe(false);
  });

  it('accepts injected assets', () => {
    const assets = new MapAssetProvider();
    const { app } = makeApp({ assets });
    expect(app.services.assets).toBe(assets);
  });

  it('initialises the game and fits the viewport on start()', () => {
    const { app, game } = makeApp();
    app.start();
    expect(game.services).toBe(app.services);
    expect(app.viewport.fit.scale).toBe(1);
    expect(app.running).toBe(true);
    app.stop();
  });

  it('is idempotent on start() and stop()', () => {
    const { app, game } = makeApp();
    app.start();
    app.start();
    expect(game.updates).toBe(0);
    app.stop();
    app.stop();
    expect(app.running).toBe(false);
  });

  it('runs fixed updates and renders a model via tick()', () => {
    const { app, game } = makeApp();
    let model: RenderModel | null = null;
    app.onRender = (m) => {
      model = m;
    };
    app.start();
    app.tick(1 / 60);
    expect(game.updates).toBe(1);
    expect(game.lastDt).toBeCloseTo(1 / 60, 10);
    expect(model).not.toBeNull();
    expect(model!.commands).toHaveLength(1);
    expect(model!.background).toBe('#000000');
    app.stop();
  });

  it('does not update when the frame is shorter than one fixed step', () => {
    const { app, game } = makeApp();
    app.start();
    app.tick(0.001);
    expect(game.updates).toBe(0);
    app.stop();
  });

  it('flushes queued audio every tick', () => {
    const { app } = makeApp();
    app.start();
    app.services.audio.play('hit');
    expect(app.services.audio.pendingCount).toBe(1);
    app.tick(1 / 60);
    expect(app.services.audio.pendingCount).toBe(0);
    app.stop();
  });

  it('forwards hide/show to game pause/resume via the platform', () => {
    const platform = new NodePlatform();
    const hideCbs: (() => void)[] = [];
    const showCbs: (() => void)[] = [];
    platform.onHide = (cb) => {
      hideCbs.push(cb);
      return () => {};
    };
    platform.onShow = (cb) => {
      showCbs.push(cb);
      return () => {};
    };
    const game = new FakeGame();
    const app = new App({ game, platform });
    app.start();
    hideCbs.forEach((cb) => cb());
    showCbs.forEach((cb) => cb());
    expect(game.paused).toBe(1);
    expect(game.resumed).toBe(1);
    app.stop();
  });

  it('stops delivering frames after stop()', () => {
    const { app, game } = makeApp();
    app.start();
    app.tick(1 / 60);
    const before = game.updates;
    app.stop();
    app.tick(1 / 60); // manual tick still works but no scheduled frames run
    expect(game.updates).toBe(before + 1);
    expect(app.running).toBe(false);
  });

  it('dispose() stops the loop, disposes the game and clears listeners', () => {
    const { app, game } = makeApp();
    const destroyAd = vi.spyOn(app.services.rewardedAd, 'destroy');
    app.events.on('x', () => {});
    app.start();
    app.dispose();
    expect(game.disposed).toBe(1);
    expect(destroyAd).toHaveBeenCalledTimes(1);
    expect(app.events.listenerCount()).toBe(0);
  });

  it('resize() re-fits the viewport', () => {
    const { app } = makeApp();
    app.start();
    app.resize(1920, 1080);
    expect(app.viewport.fit.screenWidth).toBe(1920);
    app.stop();
  });

  it('drives scheduled frames through the platform clock', () => {
    const { app, platform } = makeApp();
    app.start();
    // 34 ms of virtual time → two 1/60 s fixed steps.
    platform.pump(34);
    app.stop();
    expect(app.loop.ticks).toBeGreaterThan(0);
  });

  it('renders exactly once per fixed step batch', () => {
    const { app, game } = makeApp();
    const render = vi.fn();
    app.onRender = render;
    app.start();
    app.tick(3 / 60);
    expect(render).toHaveBeenCalledTimes(1);
    expect(game.renderCount).toBe(1);
    app.stop();
  });
});
