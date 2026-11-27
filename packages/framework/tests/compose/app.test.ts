import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/compose/app.js';
import { NullAssetProvider, MapAssetProvider } from '../../src/core/game/game.js';
import type { Game, GameServices, RenderModel } from '../../src/core/index.js';
import { NoopOpenDataProvider, RenderModelBuilder } from '../../src/core/index.js';
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
  /** 脏帧门控用例的旋钮：改这个值就等于改画面内容。 */
  size = 10;
  /** 只改墨不改几何——验证 paint 通道入哈希。 */
  fillAlpha = 1;
  /** 带 `blit` 的帧：`fx` 逐键入哈希 ⇒ 同样受门控（`WXG-T-250`）。 */
  emitBlit = false;
  /** 只改 `fx` 载荷不改几何——验证效果袋入哈希。 */
  blitFx = 1;

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
    builder.rect(0, 0, this.size, this.size, { fill: '#fff', alpha: this.fillAlpha });
    if (this.emitBlit) builder.blit('tex', 0, 0, this.size, this.size, { fx: { a: this.blitFx } });
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

  it('exposes the open-data provider built by the platform (S-2)', () => {
    const { app } = makeApp();
    expect(app.services.openData).toBeInstanceOf(NoopOpenDataProvider);
  });

  it('leaves openData undefined on hosts without an open data domain', () => {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    Object.defineProperty(platform, 'createOpenDataProvider', { value: undefined });
    const app = new App({
      game: new FakeGame(),
      platform,
      designWidth: 750,
      designHeight: 1334,
      seed: 'test',
    });
    expect(app.services.openData).toBeUndefined();
  });

  it('destroys the open-data provider on dispose (S-2)', () => {
    const { app } = makeApp();
    const spy = vi.spyOn(app.services.openData!, 'destroy');
    app.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
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
      return () => { };
    };
    platform.onShow = (cb) => {
      showCbs.push(cb);
      return () => { };
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
    app.events.on('x', () => { });
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

  // ── 脏帧门控（WXG-T-248 / ADR-0030 §5.0.2）────────────────────────────────
  // 判据的本体是「屏上已是正确答案 ⇒ 不必重画」，所以每条都同时钉住
  // buildRenderModel 的调用数（照旧每帧跑）与 onRender 的调用数（可跳）。

  it('脏帧门控：内容逐位相同的帧不重画，但照常建模型', () => {
    const { app, game } = makeApp();
    const render = vi.fn();
    app.onRender = render;
    app.start();
    for (let i = 0; i < 5; i += 1) app.tick(1 / 60);
    expect(game.renderCount).toBe(5);
    expect(render).toHaveBeenCalledTimes(1);
    app.stop();
  });

  it('脏帧门控：内容一变就重画，再变再画', () => {
    const { app, game } = makeApp();
    const render = vi.fn();
    app.onRender = render;
    app.start();
    app.tick(1 / 60);
    app.tick(1 / 60); // 静置 ⇒ 跳过
    expect(render).toHaveBeenCalledTimes(1);
    game.size = 11;
    app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(2);
    app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(2);
    app.stop();
  });

  it('脏帧门控：只改墨不改几何也算脏（alpha 量化到 1/64）', () => {
    const { app, game } = makeApp();
    const render = vi.fn();
    app.onRender = render;
    app.start();
    app.tick(1 / 60);
    game.fillAlpha = 0.9;
    app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(2);
    // 亚阈值（< 1/64 ≈ 0.0156）的 alpha 变化按设计不重画。
    game.fillAlpha = 0.901;
    app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(2);
    app.stop();
  });

  // 上限换档（WXG-T-250 / ADR-0030 §5.0.3）：旧契约是「含 blit 帧掺帧序号 ⇒ 恒判脏」，
  // 现 `fx` 逐键入门 ⇒ blit 帧与几何帧同待遇，但**换效果必须重画**（否则错色残留）。
  it('脏帧门控：blit 帧同样受门控，fx 变则必重画', () => {
    const { app, game } = makeApp();
    game.emitBlit = true;
    const render = vi.fn();
    app.onRender = render;
    app.start();
    for (let i = 0; i < 4; i += 1) app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(1);
    game.blitFx = 2;
    app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(2);
    app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(2);
    app.stop();
  });

  it('脏帧门控：resize 后必重画（宿主表面已换）', () => {
    const { app } = makeApp();
    const render = vi.fn();
    app.onRender = render;
    app.start();
    app.tick(1 / 60);
    app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(1);
    app.resize(1290, 2796);
    app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(2);
    app.stop();
  });

  it('脏帧门控：kill switch 关掉即恢复逐帧重画，再打开不继承旧哈希', () => {
    const { app } = makeApp();
    const render = vi.fn();
    app.onRender = render;
    app.start();
    app.dirtyGate = false;
    for (let i = 0; i < 3; i += 1) app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(3);
    app.dirtyGate = true;
    app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(4);
    app.tick(1 / 60);
    expect(render).toHaveBeenCalledTimes(4);
    app.stop();
  });

  // [WXG-T-1075] 「帧耗时稳但拖动卡顿」的取样腿：钩子必须交出**时间轴**三列，
  // 且 `drew` 要如实反映脏帧门——否则读数会把「没重绘」误当成「画得慢」。
  it('motionProbe 交出 (dtMs, steps, drew)，脏帧门跳过的帧 drew=false 而 steps 照记', () => {
    const { app, game } = makeApp();
    const seen: Array<readonly [number, number, boolean]> = [];
    app.onRender = (): void => {};
    app.motionProbe = (dtMs, steps, drew): void => { seen.push([dtMs, steps, drew]); };

    app.tick(1 / 60);              // 首帧：内容变了 ⇒ 真画
    app.tick(1 / 60);              // 同内容 ⇒ 脏帧门跳过（画面没动）
    game.size = 20;
    app.tick(1 / 60);              // 内容又变 ⇒ 真画
    app.tick(1000 / 120 / 1000);   // 高刷屏的短帧：仿真没推进，但仍走了 render 口

    expect(seen.map((f) => f[2])).toEqual([true, false, true, false]);
    expect(seen[3]![1]).toBe(0);                     // 8.33ms 帧 ⇒ 0 个固定步
    expect(seen[0]![1]).toBe(1);                     // 16.67ms 帧 ⇒ 1 步
    expect(seen[0]![0]).toBeCloseTo(1000 / 60, 3);    // dtMs 用毫秒口径
    expect(seen.length).toBe(4);
  });

  it('motionProbe 默认 null ⇒ 不接线时热路径不多一次调用', () => {
    const { app } = makeApp();
    app.onRender = (): void => {};
    expect(app.motionProbe).toBeNull();
    expect(() => app.tick(1 / 60)).not.toThrow();
  });
});

// ── 绘制成本投影（WXG-T-1110）────────────────────────────────────────────────
// 口径：`drawMs` = `onRender` 内的墙钟 EMA（几何重建在宿主渲染器里跑，游戏侧量不到），
// `paintCalls` = 本帧真下笔次数（fill + stroke；文字 / 位图 / 容器命令不计）。

/** 只发「一填一描边 + 不该计数的三种命令」，用来钉 paintCalls 的口径。 */
class PaintGame extends FakeGame {
  override buildRenderModel(builder: RenderModelBuilder): void {
    this.renderCount++;
    builder.setBackground('#000000');
    builder.rect(0, 0, this.size, this.size, { fill: '#fff', stroke: '#000', lineWidth: 2 });
    builder.text(0, 0, 'label', { fill: '#fff' });
    builder.blit('tex', 0, 0, 10, 10);
    builder.beginContainer('c');
    builder.endContainer();
  }
}

/** 每次读表都往前跳 4 ms ⇒ `onRender` 的墙钟差可预期。 */
class SteppingPlatform extends NodePlatform {
  private _t = 0;
  override now(): number {
    this._t += 4;
    return this._t;
  }
}

describe('App 绘制成本投影（WXG-T-1110）', () => {
  it('readDrawCost：首读只开统计（本帧还是 0），次帧起逐帧给出真下笔次数', () => {
    const app = new App({
      game: new PaintGame(),
      platform: new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }),
      designWidth: 750,
      designHeight: 1334,
      seed: 'test',
    });
    app.dirtyGate = false; // 每帧都真画，免得被脏帧门挡住
    app.onRender = (): void => {};
    app.start();
    app.tick(1 / 60);

    const read = app.services.readDrawCost!;
    // 首读发生在「本帧已画完」之后 ⇒ 本帧没统计过，三项全 0（⛔ 不是「没画面」）。
    expect(read()).toMatchObject({ drawMs: 0, paintCalls: 0, commands: 0 });

    app.tick(1 / 60);
    const cost = read();
    // rect 的 fill + stroke = 2；text / blit / 容器命令一律不计。
    expect(cost.paintCalls).toBe(2);
    // commands 含全部命令（rect / text / blit 三条 + 容器起止两条；background 不占命令）。
    expect(cost.commands).toBe(5);
    app.stop();
  });

  it('drawMs 吃 onRender 的墙钟差，脏帧门跳过的帧不混进 EMA', () => {
    const app = new App({
      game: new FakeGame(),
      platform: new SteppingPlatform({ width: 750, height: 1334, pixelRatio: 2 }),
      designWidth: 750,
      designHeight: 1334,
      seed: 'test',
    });
    app.onRender = (): void => {};
    app.start();
    const read = app.services.readDrawCost!;
    read(); // 打开统计（不影响 drawMs 的计时口）

    app.tick(1 / 60); // 首帧：真画，墙钟差 4 ms
    expect(read().drawMs).toBe(4);

    app.tick(1 / 60); // 同内容 ⇒ 脏帧门跳过，没有 onRender ⇒ 不采样
    expect(read().drawMs).toBe(4);

    app.stop();
  });

  it('readDrawCost 每次返回同一对象（热路径零分配）', () => {
    const app = new App({
      game: new PaintGame(),
      platform: new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }),
      designWidth: 750,
      designHeight: 1334,
      seed: 'test',
    });
    app.dirtyGate = false;
    app.onRender = (): void => {};
    app.start();
    app.tick(1 / 60);
    const read = app.services.readDrawCost!;
    expect(read()).toBe(read());
    app.stop();
  });
});
