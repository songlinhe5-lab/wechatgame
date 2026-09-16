/**
 * Host-driven mode behaviour tests (WXG-T-122 / BD-40 宿主双驱动修复).
 *
 * BD-40: Cocos hosts used to run at ~2× wall-clock speed because
 * `App.start()` self-drove via `platform.requestFrame` while
 * `CocosLoopBridge` ALSO drove `App.tick()` through `Component.schedule`.
 * These tests pin the host-driven contract:
 *   ① startHostDriven() performs full init but never self-drives
 *      (no requestFrame call — nothing pending on the platform);
 *   ② an external driver ticking once per wall-clock frame yields ~1×
 *      sim/wall-clock (fixed steps ≈ expected);
 *   ③ wiring both drivers at once hard-fails instead of double-driving.
 *
 * Uses the manual NodePlatform fake (same style as tests/adapters) —
 * `hasPendingFrame` / `pump` observe `requestFrame` without real timers.
 * 1/64 s is used as the fixed step because it is exactly representable in
 * binary: 64 ticks accumulate to exactly 1.0 s with zero rounding drift, so
 * the step count is an exact expectation, not a tolerance game.
 */

import { describe, expect, it } from 'vitest';
import { App } from '../../src/compose/app.js';
import { NodePlatform } from '../../src/platform/node.js';
import type { Game, GameServices } from '../../src/core/game/game.js';
import type { RenderModelBuilder } from '../../src/core/render/render-model.js';

class CounterGame implements Game {
  readonly id = 'counter';
  services: GameServices | null = null;
  inited = 0;
  updates = 0;

  init(services: GameServices): void {
    this.services = services;
    this.inited++;
  }
  update(): void {
    this.updates++;
  }
  buildRenderModel(_b: RenderModelBuilder): void {
    void _b;
  }
}

function makeApp(screen = { width: 1280, height: 720, pixelRatio: 1 }) {
  const platform = new NodePlatform(screen);
  const game = new CounterGame();
  const app = new App({
    game,
    platform,
    designWidth: 750,
    designHeight: 1334,
    fixedDt: 1 / 64,
    seed: 'host-driven',
  });
  return { app, game, platform };
}

describe('App host-driven mode (WXG-T-122 / BD-40)', () => {
  it('① startHostDriven() fully initialises but never calls requestFrame', () => {
    const { app, game, platform } = makeApp();
    app.startHostDriven();

    // Full init semantics, identical to start():
    expect(game.inited).toBe(1);
    expect(game.services).toBe(app.services);
    expect(app.running).toBe(true);
    // Viewport re-fit from platform.getScreenSize() happened (1280×720 screen):
    expect(app.viewport.fit.screenWidth).toBe(1280);
    expect(app.viewport.fit.screenHeight).toBe(720);

    // NO self-drive: no frame callback is pending on the platform, and pumping
    // wall-clock time delivers zero updates — the host is the only driver.
    expect(app.hostDriven).toBe(true);
    expect(platform.hasPendingFrame).toBe(false);
    platform.pump(1000);
    expect(game.updates).toBe(0);
  });

  it('② external host ticking once per wall-clock frame yields ~1× sim speed', () => {
    const { app, game } = makeApp();
    app.startHostDriven();

    // One wall-clock second at 64 fps → exactly 64 fixed steps (1×).
    for (let i = 0; i < 64; i++) app.tick(1 / 64);
    expect(game.updates).toBe(64);
    expect(app.loop.ticks).toBe(64);
    expect(app.loop.time).toBeCloseTo(1, 12);
    expect(app.loop.clampedFrames).toBe(0);
  });

  it('③a startHostDriven() on an already self-driving App hard-fails (no silent double-drive)', () => {
    const { app, platform } = makeApp();
    app.start(); // self-drive: a frame callback is now pending
    expect(platform.hasPendingFrame).toBe(true);
    expect(() => app.startHostDriven()).toThrow(/already self-driving/);
    // The host scheduler must NOT have been granted a second driver slot:
    expect(app.hostDriven).toBe(false);
    // And the self-drive loop keeps running untouched (exactly one driver):
    expect(platform.hasPendingFrame).toBe(true);
  });

  it('③b start() is refused on a host-driven App (driver ownership is sticky)', () => {
    const { app, game } = makeApp();
    app.startHostDriven();
    app.stop();
    // Restarting self-drive on a host-driven App would silently flip the
    // driver — refused:
    expect(() => app.start()).toThrow(/host-driven/);
    // The sanctioned restart path stays available and re-initialises:
    app.startHostDriven();
    expect(app.running).toBe(true);
    expect(game.inited).toBe(2);
  });

  it('③c startHostDriven() is idempotent while running (no double init, no double driver)', () => {
    const { app, game } = makeApp();
    app.startHostDriven();
    app.startHostDriven();
    expect(game.inited).toBe(1);
    expect(game.updates).toBe(0);
  });

  it('stop() is safe in host-driven mode (no frame handle to cancel)', () => {
    const { app } = makeApp();
    app.startHostDriven();
    app.tick(1 / 64);
    expect(() => app.stop()).not.toThrow();
    expect(app.running).toBe(false);
    // Driver gone: further host ticks still work mechanically (documented
    // tick() semantics) but the app is stopped — parity with self-drive stop().
    app.stop();
  });

  it('default start() still self-drives (back-compat: harness / Node tests)', () => {
    const { app, platform } = makeApp();
    app.start();
    expect(app.hostDriven).toBe(false);
    expect(platform.hasPendingFrame).toBe(true);
    // Pump 64 wall-clock frames of 15.625 ms (= 1/64 s, exact in binary):
    // one fixed step per frame → 64 steps for 1 wall-clock second (1×).
    // (maxSubSteps caps a single huge pump at 5, so pump per-frame.)
    for (let i = 0; i < 64; i++) platform.pump(15.625);
    expect(app.loop.ticks).toBe(64);
    app.stop();
    expect(platform.hasPendingFrame).toBe(false);
  });
});
