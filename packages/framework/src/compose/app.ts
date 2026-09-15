/**
 * App — the composition root: wires platform, services, loop and game together.
 *
 * LAYER NOTE: this file lives in `src/compose`, not `src/core`, precisely
 * because it is the ONE place allowed to know about the platform layer. `core`
 * must stay importable with zero host dependencies (see ADR-0002), so the thing
 * that picks a concrete platform has to sit above it.
 *
 * Typical hosting code:
 * ```ts
 * const app = new App({ game: new BreakoutGame(), designWidth: 750, designHeight: 1334 });
 * app.onRender = (model) => renderer.draw(model);
 * app.start();
 * ```
 */

import { EventBus, type EventMap } from '../core/events/event-bus.js';
import { InputManager } from '../core/input/input-manager.js';
import { AudioScheduler } from '../core/audio/audio.js';
import { createRng, type Rng } from '../core/math/rng.js';
import { Viewport } from '../core/render/viewport.js';
import { RenderModelBuilder, type RenderModel } from '../core/render/render-model.js';
import { FixedStepLoop } from '../core/loop/game-loop.js';
import type { AssetProvider, Game, GameServices } from '../core/game/game.js';
import { detectPlatform, type Platform } from '../platform/index.js';

export interface AppOptions {
  readonly game: Game;
  /** Defaults to auto-detected platform (WeChat → Web → Node). */
  readonly platform?: Platform;
  readonly designWidth?: number;
  readonly designHeight?: number;
  readonly fixedDt?: number;
  readonly maxSubSteps?: number;
  /** Seed for the framework RNG. Use a fixed seed in tests/replays. */
  readonly seed?: string | number;
  /** Injected assets (textures/atlases) resolved by the render adapter. */
  readonly assets?: AssetProvider;
}

export class App {
  readonly game: Game;
  readonly platform: Platform;
  readonly viewport: Viewport;
  readonly loop: FixedStepLoop;
  readonly services: GameServices;
  readonly events: EventBus<EventMap>;
  readonly input: InputManager;

  /**
   * Draw callback supplied by the host adapter. Receives the frame's render
   * model plus the interpolation alpha. The model is REUSED between frames —
   * the adapter must not retain it.
   */
  onRender: ((model: RenderModel, alpha: number) => void) | null = null;

  private readonly _builder: RenderModelBuilder;
  private _frameHandle: { cancel(): void } | null = null;
  private _running = false;
  private _lastFrameMs = 0;
  private _unsubs: (() => void)[] = [];

  constructor(options: AppOptions) {
    this.game = options.game;
    this.platform = options.platform ?? detectPlatform();
    this.viewport = new Viewport(options.designWidth ?? 750, options.designHeight ?? 1334);
    this._builder = new RenderModelBuilder(this.viewport.designWidth, this.viewport.designHeight);

    this.events = new EventBus<EventMap>();
    this.input = new InputManager();
    const rng: Rng = createRng(options.seed ?? Date.now());

    this.services = {
      events: this.events,
      input: this.input,
      audio: new AudioScheduler(
        this.platform.createAudioBackend(
          options.game.audioVoices ? { voices: options.game.audioVoices } : undefined,
        ),
      ),
      storage: this.platform.createStorage(),
      rng,
      viewport: this.viewport,
      assets: options.assets ?? this.platform.createAssetProvider(),
      platform: this.platform.info,
      rewardedAd: this.platform.createRewardedAdProvider(),
    };

    this.loop = new FixedStepLoop(
      {
        fixedUpdate: (dt) => this._fixedUpdate(dt),
        render: (alpha) => this._render(alpha),
      },
      {
        ...(options.fixedDt !== undefined ? { fixedDt: options.fixedDt } : {}),
        ...(options.maxSubSteps !== undefined ? { maxSubSteps: options.maxSubSteps } : {}),
      },
    );
  }

  get running(): boolean {
    return this._running;
  }

  /** Initialise the game and begin the frame loop. */
  start(): void {
    if (this._running) return;
    const screen = this.platform.getScreenSize();
    this.viewport.resize(screen.width, screen.height);

    this.game.init(this.services);

    this._unsubs.push(this.platform.onHide(() => this.game.onPause?.()));
    this._unsubs.push(this.platform.onShow(() => {
      this.loop.reset();
      this.game.onResume?.();
    }));

    this._running = true;
    this._lastFrameMs = this.platform.now();
    this._schedule();
  }

  /** Stop the frame loop. Safe to call repeatedly. */
  stop(): void {
    this._running = false;
    this._frameHandle?.cancel();
    this._frameHandle = null;
    for (const unsub of this._unsubs) unsub();
    this._unsubs = [];
  }

  /** Tear down the game as well (scene teardown / hot reload). */
  dispose(): void {
    this.stop();
    this.services.rewardedAd.destroy();
    this.game.dispose?.();
    this.events.removeAll();
  }

  /**
   * Drive one frame manually. Used by tests and by hosts whose engine owns the
   * tick (e.g. a Cocos `Component.update`).
   * @param frameDtSeconds wall-clock seconds since the previous frame.
   * @returns number of fixed simulation steps executed.
   */
  tick(frameDtSeconds: number): number {
    const steps = this.loop.advance(frameDtSeconds);
    this.services.audio.flush(frameDtSeconds);
    this.input.endFrame(frameDtSeconds);
    return steps;
  }

  /** Re-fit the viewport after a screen-size change (WeChat `onResize`). */
  resize(width: number, height: number): void {
    this.viewport.resize(width, height);
  }

  private _schedule(): void {
    if (!this._running) return;
    this._frameHandle = this.platform.requestFrame((dtMs) => {
      if (!this._running) return;
      const now = this.platform.now();
      // Prefer the measured delta; fall back to the platform-reported one.
      const dtSeconds = Math.max(0, (now - this._lastFrameMs) / 1000) || dtMs / 1000;
      this._lastFrameMs = now;
      this.tick(dtSeconds);
      this._schedule();
    });
  }

  private _fixedUpdate(dt: number): void {
    this.input.beginFrame();
    this.game.update(dt);
  }

  private _render(alpha: number): void {
    this._builder.begin();
    this.game.buildRenderModel(this._builder);
    const model = this._builder.end();
    this.onRender?.(model, alpha);
  }
}
