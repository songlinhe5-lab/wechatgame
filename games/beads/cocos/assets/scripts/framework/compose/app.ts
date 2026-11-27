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
import { RenderModelBuilder, type DrawCommand, type RenderModel } from '../core/render/render-model';
import { FixedStepLoop } from '../core/loop/game-loop';
import type { AssetProvider, Game, GameServices } from '../core/game/game';
import type { DrawCostBreakdown } from '../core/performance/performance';

/** `[WXG-T-1111]` 分段回投槽的可写形状（对外一律以只读 `DrawCostBreakdown` 暴露）。 */
interface MutableDrawBreakdown {
  vectorMs: number;
  blitMs: number;
  textMs: number;
  scopeMs: number;
  vectorCalls: number;
  blitCalls: number;
  textCalls: number;
}
import { detectPlatform, type Platform } from '../platform/index';

export interface AppOptions {
  readonly game: Game;
  /** Defaults to auto-detected platform (WeChat → Web → Node). */
  readonly platform?: Platform;
  readonly designWidth?: number;
  readonly designHeight?: number;
  /**
   * `[WXG-T-280]` 宽恒定版式：设计高随屏幅动态重算（见 `Viewport`）。
   * 开启后每帧 `builder` 与设计高同步；缺省 `false` = 旧行为逐字节不变。
   */
  readonly dynamicHeight?: boolean;
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
   *
   * ⚠️ `[WXG-T-248]` **Not called on clean frames**: when the frame's content
   * hash equals the previous drawn frame's, the redraw is skipped entirely (see
   * {@link dirtyGate}). A host must therefore never use `onRender` as a per-frame
   * tick hook, and must not depend on `alpha` changing every frame.
   */
  onRender: ((model: RenderModel, alpha: number) => void) | null = null;

  /**
   * `[WXG-T-248 / ADR-0030 §5.0.2]` 脏帧门控: skip the redraw when a frame draws
   * exactly what is already on screen. Measured motivation — the beads vector arm
   * burned 3.0–3.9 ms CPU per frame replaying identical geometry in 146/150 idle
   * frames.
   *
   * Kept as a runtime kill switch on purpose: a stale-screen defect on a device
   * must be diagnosable without rebuilding, and the carrier bench A/Bs both
   * states with the same instrument. `false` restores the pre-248 behaviour
   * (draw every frame).
   */
  dirtyGate = true;

  /**
   * `[WXG-T-1075]` **运动节奏取样钩子**（诊断「帧耗时稳定但拖动一顿一顿」）。
   *
   * 每渲染帧回调一次，交出三样东西：帧间隔 `dtMs`、本帧跑掉的固定步数 `steps`
   * （0 = 仿真没推进）、以及本帧是否真下发了重绘 `drew`（脏帧门会跳过干净帧）。
   * 语义与判定表在 `core/performance/performance.ts` 的 `MotionRecorder` 那一侧；
   * 本处只负责**把时间轴交出去**，不在热路径分配任何东西。默认 `null` ⇒ 不接线零成本。
   */
  motionProbe: ((dtMs: number, steps: number, drew: boolean) => void) | null = null;

  /** 本 tick 是否真画了一帧（`_render` 里置位，`tick` 读出后交给 `motionProbe`）。 */
  private _drewThisTick = false;

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
  /**
   * Last frame handed to {@link onRender}, as a content hash. `NaN` = "nothing
   * known on screen", which never compares equal ⇒ forces a redraw. That is the
   * state after a start, a resize, or a foreground return (WeChat may have
   * discarded the surface while we were hidden).
   */
  private _lastSig = Number.NaN;
  private _unsubs: (() => void)[] = [];
  /**
   * `[WXG-T-1110]` 上一渲染帧的绘制成本投影（`GameServices.readDrawCost` 的返回体）。
   *
   * 计时点只能是这里：几何重建发生在宿主 `onRender` 内部（Cocos 侧同步跑完
   * `fill()/stroke()`），游戏层量不到。对象**恒为同一个**（热路径零分配）。
   */
  /**
   * `[WXG-T-1111]` 宿主分段成本回投槽：字段逐个覆写，对象恒为同一个（零分配）。
   */
  private readonly _breakdown: MutableDrawBreakdown = {
    vectorMs: 0, blitMs: 0, textMs: 0, scopeMs: 0,
    vectorCalls: 0, blitCalls: 0, textCalls: 0,
  };
  private readonly _drawCost: {
    drawMs: number; paintCalls: number; commands: number;
    tickMs: number; engineDrawMs: number; idleMs: number;
    breakdown: MutableDrawBreakdown;
  } = {
    drawMs: 0,
    paintCalls: 0,
    commands: 0,
    tickMs: 0,
    engineDrawMs: 0,
    idleMs: 0,
    breakdown: this._breakdown,
  };
  /** 已累计的绘制样本数（0 ⇒ 还没量过；用来区分「首样本」与「EMA 尚未收敛」）。 */
  private _drawSamples = 0;
  /** `[WXG-T-1113]` tick 段 / 引擎渲染段的样本数（0 ⇒ 首样本直写，不走 EMA）。 */
  private _tickSamples = 0;
  private _engineDrawSamples = 0;
  /** `[WXG-T-1114]` 上帧引擎渲染终点（`platform.now()`；`0` = 尚未回投过 ⇒ 不采空档）。 */
  private _lastEngineDrawEnd = 0;
  private _idleSamples = 0;
  /**
   * 有人读过绘制成本后置 true ⇒ 才逐帧统计 `paintCalls`（要扫一遍命令流）。
   * 没人读（release 常态）就一帧都不扫，热路径零额外开销。
   */
  private _drawCostWanted = false;

  constructor(options: AppOptions) {
    this.game = options.game;
    this.platform = options.platform ?? detectPlatform();
    this.viewport = new Viewport(options.designWidth ?? 750, options.designHeight ?? 1334, options.dynamicHeight === true);
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
      // WXG-T-470：激励入口可用态透传（PlatformInfo 未声明语义的平台 ⇒ undefined ⇒ 消费端 ?? true）。
      rewardedAdAvailable: this.platform.info.rewardedAdConfigured,
      openData: this.platform.createOpenDataProvider?.(),
      haptic: this.platform.haptic?.bind(this.platform),
      share: this.platform.share?.bind(this.platform),
      onUpdateReady: this.platform.onUpdateReady?.bind(this.platform),
      applyUpdate: this.platform.applyUpdate?.bind(this.platform),
      onMemoryWarning: this.platform.onMemoryWarning?.bind(this.platform),
      httpGet: this.platform.httpGet?.bind(this.platform),
      setPreferredFps: this.platform.setPreferredFps?.bind(this.platform),
      getPerformance: this.platform.getPerformance?.bind(this.platform),
      // `[WXG-T-1110]` 绘制成本投影：返回**同一个**对象（只读视图），首读即打开逐帧统计。
      readDrawCost: () => {
        this._drawCostWanted = true;
        return this._drawCost;
      },
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

  /**
   * `[WXG-T-1111]` 宿主渲染器是否该打开分段计时（= 有人读过 `readDrawCost`）。
   * `bindings.ts` 据此决定要不要每次 `draw` 逐命令卡表 —— release 路径零开销。
   */
  get drawCostWanted(): boolean {
    return this._drawCostWanted;
  }

  /**
   * `[WXG-T-1111]` 宿主渲染器在 `draw` 末尾回投本帧分段成本（⛔ 不分配，逐字段覆写）。
   * 未接线的宿主不调 ⇒ 细分行恒 0，覆层自动隐藏。
   */
  reportDrawBreakdown(b: DrawCostBreakdown): void {
    const t = this._breakdown;
    t.vectorMs = b.vectorMs;
    t.blitMs = b.blitMs;
    t.textMs = b.textMs;
    t.scopeMs = b.scopeMs;
    t.vectorCalls = b.vectorCalls;
    t.blitCalls = b.blitCalls;
    t.textCalls = b.textCalls;
  }

  /**
   * `[WXG-T-1113]` loop-bridge 在 `app.tick` 全程卡表后回投（EMA α = 0.1，首样本直写）。
   * 调用方（loop-bridge）已按 `drawCostWanted` 门控；未接线的宿主不调 ⇒ 恒 0。
   */
  reportTickCost(ms: number): void {
    const c = this._drawCost;
    if (this._tickSamples === 0) c.tickMs = ms;
    else c.tickMs = c.tickMs * 0.9 + ms * 0.1;
    this._tickSamples += 1;
  }

  /**
   * `[WXG-T-1113]` bindings 在 `EVENT_BEFORE_DRAW` → `EVENT_AFTER_DRAW` 卡表后回投
   * （EMA 同口径）。覆盖引擎渲染段（batcher / mesh 上传 / present），与 `tickMs` 不重叠。
   */
  reportEngineDrawMs(ms: number): void {
    const c = this._drawCost;
    if (this._engineDrawSamples === 0) c.engineDrawMs = ms;
    else c.engineDrawMs = c.engineDrawMs * 0.9 + ms * 0.1;
    this._engineDrawSamples += 1;
  }

  /**
   * `[WXG-T-1114]` bindings 在 `EVENT_AFTER_DRAW` 处理末尾登记引擎渲染的终点墙钟
   * （绝对时间戳，同源 `platform.now`）。下一帧 tick 起点据此算空档。
   */
  noteEngineDrawEnd(nowMs: number): void {
    this._lastEngineDrawEnd = nowMs;
  }

  /**
   * `[WXG-T-1114]` loop-bridge 在 tick 起点调用：空档 = 本次 tick 起点 − 上帧
   * AFTER_DRAW 终点（EMA α = 0.1）。尚无终点基线 / 时钟倒退时跳过本帧采样。
   */
  sampleIdleAt(nowMs: number): void {
    const idle = nowMs - this._lastEngineDrawEnd;
    if (this._lastEngineDrawEnd <= 0 || idle < 0) return;
    const c = this._drawCost;
    if (this._idleSamples === 0) c.idleMs = idle;
    else c.idleMs = c.idleMs * 0.9 + idle * 0.1;
    this._idleSamples += 1;
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
    // `[WXG-T-322]` 动态高档：首帧的 builder 设计高必须与 viewport 同源。
    // 只 resize viewport 时 builder 仍停在构造基准 1334 ⇒ 读 `builder.height` 的
    // 全屏图元（暂停 / 结算遮罩）在高屏机顶部漏出未遮盖的一条。
    this._builder.resize(this.viewport.designWidth, this.viewport.designHeight);

    this.game.init(this.services);

    this._unsubs.push(this.platform.onHide(() => this.game.onPause?.()));
    this._unsubs.push(this.platform.onShow(() => {
      this.loop.reset();
      this._lastSig = Number.NaN;
      this.game.onResume?.();
    }));

    this._running = true;
    this._lastFrameMs = this.platform.now();
    this._lastSig = Number.NaN;
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
    this.services.openData?.destroy();
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
    this._drewThisTick = false;
    const steps = this.loop.advance(frameDtSeconds);
    // 取样钩子在 advance 之后读：`_render` 已由循环调完，`drew` 才是本帧的真值。
    this.motionProbe?.(frameDtSeconds * 1000, steps, this._drewThisTick);
    this.services.audio.flush(frameDtSeconds);
    // WXG-T-414: push loop counters into platform for perf snapshots.
    (this.platform as { _feedLoopStats?: (t: number, ts: number, c: number) => void })
      ._feedLoopStats?.(this.loop.ticks, this.loop.time, this.loop.clampedFrames);
    return steps;
  }

  /** Re-fit the viewport after a screen-size change (WeChat `onResize`). */
  resize(width: number, height: number): void {
    this.viewport.resize(width, height);
    // 动态高档：builder 的设计高必须跟上（`end()` 写进 model 的高供游戏侧读）。
    this._builder.resize(this.viewport.designWidth, this.viewport.designHeight);
    // The design rect is unchanged, so the content hash is unchanged too — but
    // the host has just re-sized its surface and whatever was on it is gone.
    this._lastSig = Number.NaN;
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
    if (this.dirtyGate) {
      // Signature must be read after `end()` and before the next `begin()`.
      const sig = this._builder.signature();
      if (sig === this._lastSig) return;
      this._lastSig = sig;
    } else {
      // Turning the gate back on must not inherit a hash from a frame that was
      // drawn under a different regime.
      this._lastSig = Number.NaN;
    }
    if (this.onRender) {
      // `[WXG-T-1110]` 绘制成本：卡表只包 `onRender`（建模那段由游戏自己量）。
      // ⚠ 脏帧门跳过的帧**不采样** —— 那些帧根本没画，混进 EMA 会把成本摊薄。
      // ⚠ 没人读过（release 常态）就一次表都不读：两次 `now()` 也是热路径成本。
      if (this._drawCostWanted) {
        const t0 = this.platform.now();
        this.onRender(model, alpha);
        const spent = this.platform.now() - t0;
        const cost = this._drawCost;
        if (this._drawSamples === 0) cost.drawMs = spent;
        else cost.drawMs = cost.drawMs * 0.9 + spent * 0.1;
        this._drawSamples += 1;
        cost.commands = model.commands.length;
        cost.paintCalls = countPaintCalls(model.commands);
      } else {
        this.onRender(model, alpha);
      }
      this._drewThisTick = true; // 脏帧门放行且真有宿主 ⇒ 这一帧改变了画面
    }
  }
}

/**
 * `[WXG-T-1110]` 一帧的**真下笔**次数 = 像素图元的 `fill` + `stroke` 次数。
 *
 * 逐命令扫一遍、零分配（只累加）。文字走 `cc.Label`、位图走 blit 载体、容器/裁切
 * 命令不产像素 —— 三者都不计，否则读数会虚高（实测口径：13×12 盘 2382 条命令里
 * 1860 fill + 1140 stroke，而 `text` 的 10 条 `fill` 不产生 `Graphics.fill`）。
 */
function countPaintCalls(commands: readonly DrawCommand[]): number {
  let n = 0;
  for (let i = 0; i < commands.length; i += 1) {
    const cmd = commands[i]!;
    switch (cmd.kind) {
      case 'rect':
      case 'circle':
      case 'polygon':
        if (cmd.fill) n += 1;
        if (cmd.stroke) n += 1;
        break;
      case 'line':
        n += 1; // `line` 的 `stroke` 是必填字段
        break;
      default:
        break;
    }
  }
  return n;
}
