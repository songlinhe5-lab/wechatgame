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

import { EventBus, type EventMap } from '../core/events/event-bus';
import { InputManager } from '../core/input/input-manager';
import { AudioScheduler } from '../core/audio/audio';
import { createRng, type Rng } from '../core/math/rng';
import { Viewport } from '../core/render/viewport';
import { RenderModelBuilder, type RenderModel } from '../core/render/render-model';
import { FixedStepLoop } from '../core/loop/game-loop';
import type { AssetProvider, Game, GameServices } from '../core/game/game';
import { detectPlatform, type Platform } from '../platform/index';

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
  /**
   * Driver ownership, sticky for the App's lifetime (WXG-T-122 / BD-40).
   * Set once by {@link startHostDriven}; after that plain {@link start} is
   * refused — silently flipping the driver is exactly how the Cocos host ran
   * at ~2× wall-clock speed for its whole life.
   */
  private _hostDriven = false;
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

  /** True when the host owns the frame loop (see {@link startHostDriven}). */
  get hostDriven(): boolean {
    return this._hostDriven;
  }

  /** Initialise the game and begin the frame loop. */
  start(): void {
    if (this._running) return;
    if (this._hostDriven) {
      // Driver ownership is sticky: this App was started via startHostDriven()
      // and the host (e.g. Cocos Component.schedule) owns the tick. Restarting
      // self-drive on top of a live host driver is the BD-40 double-drive
      // shape — fail loudly instead of silently running at ~2× speed.
      throw new Error(
        'App: this instance is host-driven (started via startHostDriven()); ' +
        'call startHostDriven() again after stop() instead of start(). ' +
        '(WXG-T-122 / BD-40: silent driver flip = double-drive = ~2× sim speed)',
      );
    }
    this._init();
    this._schedule();
  }

  /**
   * Initialise the game WITHOUT owning the frame loop. The host drives frames
   * by calling {@link tick} itself (e.g. a Cocos `Component.update` /
   * `Component.schedule`, see `adapters/cocos/loop-bridge.ts`).
   *
   * Performs the exact same initialisation as {@link start} — viewport re-fit
   * from `platform.getScreenSize()` (ADR-0011), `game.init`, `onHide`/`onShow`
   * hookup — and then does NOT call `_schedule()`. The host is the ONLY driver.
   *
   * Mutual exclusion (WXG-T-122 / BD-40): calling this on an App that is
   * already self-driving throws instead of silently double-driving; likewise
   * `_schedule()` refuses to run once host-driven. Driver ownership is sticky
   * for the App's lifetime — after `stop()`, restart with `startHostDriven()`.
   */
  startHostDriven(): void {
    if (this._running) {
      if (this._hostDriven) return; // idempotent
      // The self-drive frame loop is live (a pending requestFrame callback).
      // Registering a host scheduler on top is precisely the BD-40 defect —
      // hard-fail so the second driver can never attach quietly.
      throw new Error(
        'App.startHostDriven(): App is already self-driving via start(). ' +
        'Two live drivers advance the fixed loop twice per frame (~2× speed). ' +
        'Use either start() OR startHostDriven(), never both. (WXG-T-122 / BD-40)',
      );
    }
    this._hostDriven = true;
    this._init();
  }

  /** Shared initialisation for both start paths (no driving decisions here). */
  private _init(): void {
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
   * tick (e.g. a Cocos `Component.update`) — the latter must start the App via
   * {@link startHostDriven} so `start()` does not ALSO self-drive (WXG-T-122 /
   * BD-40). In self-drive mode a manual `tick` stays permitted (tests and the
   * browser harness drive extra frames on purpose); the mutual-exclusion guards
   * live at the start paths, not here.
   * @param frameDtSeconds wall-clock seconds since the previous frame.
   * @returns number of fixed simulation steps executed.
   */
  tick(frameDtSeconds: number): number {
    const steps = this.loop.advance(frameDtSeconds);
    this.services.audio.flush(frameDtSeconds);
    return steps;
  }

  /** Re-fit the viewport after a screen-size change (WeChat `onResize`). */
  resize(width: number, height: number): void {
    this.viewport.resize(width, height);
  }

  private _schedule(): void {
    if (!this._running) return;
    if (this._hostDriven) {
      // Defensive guard: every current caller path is already gated, but if a
      // future code path ever tries to self-drive a host-driven App this must
      // fail loudly — a silent second driver is the BD-40 defect itself.
      throw new Error(
        'App._schedule(): refused — this App is host-driven; the host owns the tick. ' +
        '(WXG-T-122 / BD-40)',
      );
    }
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
    // `endFrame` is per-SUBSTEP, not per-tick: one fixed step == one input frame.
    // `loop.advance()` may run N substeps in a single tick (dropped frame /
    // frameDt > fixedDt), and each substep's `game.update` must observe the
    // one-shot flags exactly once. Clearing here (rather than once per tick in
    // `tick()`) guarantees a single physical tap delivers a single justDown /
    // justUp — input-control §8-3 (one touch → one command) and §8-10 (per-frame
    // command cap). It also preserves the 2026-09-13 property that an event
    // arriving BETWEEN frames (event-driven Cocos host) stays visible: the flags
    // survive `beginFrame` and are cleared only after gameplay has read them; a
    // zero-substep tick no longer drops the flag.
    this.input.endFrame(dt);
  }

  private _render(alpha: number): void {
    this._builder.begin();
    this.game.buildRenderModel(this._builder);
    const model = this._builder.end();
    this.onRender?.(model, alpha);
  }
}
