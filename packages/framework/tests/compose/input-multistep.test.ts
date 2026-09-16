/**
 * 多子步帧下的输入投递契约（**WXG-T-113**）。
 *
 * 为什么需要这个文件（缺陷：丢帧重复投递）：
 *   `App.tick(frameDt)` 调 `loop.advance(frameDt)`，而 `advance` 在丢帧 / 帧 dt > `fixedDt`
 *   时会跑 **N 个固定子步**，**每个子步**都 `input.beginFrame() + game.update(dt)`
 *   （`compose/app.ts:_fixedUpdate`）。而一次性标志（`_downThisFrame` / `_upThisFrame`）按
 *   `memory/2026-09-13.md:146`（修复 4）由 `endFrame` 独占生命周期 —— 于是**同一 tick 内只有一次
 *   `endFrame`** ⇒ 同一 tick 的每个子步都读到同一次按下/抬起 ⇒ 一次物理 tap **触发 N 次**
 *   `_handleTap`，违反 `input-control §8-3`（一次触摸仅触发一条指令）与 §8-10（每帧指令上限）。
 *
 * ⚠️ 为什么既有测试测不到（K-038「旁路恒绿」同族病）：
 *   Node 侧所有真链辅助（各游戏 tests 目录下的 helpers 之 advance、QA 探针）都按
 *   **beginFrame → game.update → endFrame 每步对称**驱动（即每个固定步就是一次 endFrame），
 *   与正常 60fps 单子步同形 ⇒ 多子步路径**从未被锁**。本文件用 `App.tick(多子步 dt)` 显式打开
 *   这条被绕过的路径。
 *
 * 本文件是**红→绿闸门**：改码前「多子步 once 投递」两条正面断言必须红；改码后必须绿。
 * 「帧间到达仍可见」是 2026-09-13 刻意建立的属性，作**回归哨兵**恒绿，修复不得踩回原坑。
 */

import { describe, expect, it } from 'vitest';
import { App } from '../../src/compose/app.js';
import { NodePlatform } from '../../src/platform/node.js';
import type { Game, GameServices } from '../../src/core/index.js';

/** 与 `App` 默认固定步长同值（1/60 s）。 */
const STEP = 1 / 60;

/**
 * 观测型假游戏：在每个 `game.update()` 内读一次权威 `input.snapshot`，统计
 * `justDown` / `justUp` 被读到的固定步数。不消费旁路（不经 `_handleTap`），
 * 直接测框架层的投递次数 —— 与玩法无关。
 */
class InputObserver implements Game {
  readonly id = 'input-observer';
  services: GameServices | null = null;
  updates = 0;
  justDownUpdates = 0;
  justUpUpdates = 0;

  init(services: GameServices): void {
    this.services = services;
  }

  update(): void {
    this.updates++;
    const snapshot = this.services!.input.snapshot;
    if (snapshot.justDown) this.justDownUpdates++;
    if (snapshot.justUp) this.justUpUpdates++;
  }

  buildRenderModel(): void {
    // 无渲染需求。
  }
}

function makeApp(): { app: App; game: InputObserver } {
  const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
  const game = new InputObserver();
  const app = new App({
    game,
    platform,
    designWidth: 750,
    designHeight: 1334,
    seed: 'input-multistep',
  });
  app.start();
  return { app, game };
}

function down(app: App, x = 10, y = 20): void {
  app.input.push({ id: 0, x, y, phase: 'down', time: 0 });
}

function up(app: App, x = 10, y = 20): void {
  app.input.push({ id: 0, x, y, phase: 'up', time: 0 });
}

describe('App · 多子步帧输入投递（WXG-T-113；input-control §8-3 / §8-10）', () => {
  it('多子步帧：一次 down 只在恰一个固定步投递（改码前红）', () => {
    const { app, game } = makeApp();
    down(app);
    const steps = app.tick(3 * STEP);
    expect(steps).toBeGreaterThanOrEqual(2); // 确为多子步帧
    expect(game.updates).toBe(steps);
    // 一次物理按下 ⇒ 恰一个固定步读到 justDown（改码前 = steps > 1）。
    expect(game.justDownUpdates).toBe(1);
    app.stop();
  });

  it('多子步帧：一次 up 只在恰一个固定步投递（改码前红）', () => {
    const { app, game } = makeApp();
    down(app);
    app.tick(STEP); // 单子步放下指针
    expect(game.justDownUpdates).toBe(1);

    up(app);
    const steps = app.tick(3 * STEP);
    expect(steps).toBeGreaterThanOrEqual(2);
    // 一次物理抬起 ⇒ 恰一个固定步读到 justUp（改码前 = steps > 1）。
    expect(game.justUpUpdates).toBe(1);
    app.stop();
  });

  it('多子步帧：一次 down 不会在后续多个子步重复投递（负面闸门）', () => {
    const { app, game } = makeApp();
    down(app);
    app.tick(5 * STEP); // 5 子步
    expect(game.updates).toBeGreaterThanOrEqual(2);
    expect(game.justDownUpdates).toBe(1);
    app.stop();
  });
});

describe('App · 帧间到达仍可见（2026-09-13 修复 4 属性 · 回归哨兵，恒绿）', () => {
  it('事件在「上一帧之后、下一帧之前」到达 ⇒ 下一固定步仍读到 justDown', () => {
    const { app, game } = makeApp();
    app.tick(STEP);
    expect(game.justDownUpdates).toBe(0);

    down(app); // 模拟 Cocos 事件驱动宿主：事件在帧间到达
    app.tick(STEP);

    expect(game.justDownUpdates).toBe(1);
    app.stop();
  });

  it('事件在 0 子步帧到达 ⇒ 不被丢弃，下一有子步的帧投递（改码前红）', () => {
    const { app, game } = makeApp();
    down(app);
    const zero = app.tick(0.001); // 帧 dt < fixedDt ⇒ 无固定步
    expect(zero).toBe(0);

    app.tick(STEP); // 下一个真正推进的帧
    // 事件必须在被投递前保持可见（改码前：0 子步帧的 endFrame 把它清掉 ⇒ 0）。
    expect(game.justDownUpdates).toBe(1);
    app.stop();
  });
});

describe('App · 单子步帧（60fps 常态）不回归', () => {
  it('单子步帧：一次 down 仍恰投递一次', () => {
    const { app, game } = makeApp();
    down(app);
    const steps = app.tick(STEP);
    expect(steps).toBe(1);
    expect(game.justDownUpdates).toBe(1);
    app.stop();
  });
});
