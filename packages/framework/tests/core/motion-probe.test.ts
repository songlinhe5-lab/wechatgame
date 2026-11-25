/**
 * WXG-T-1077 · `armMotionProbe` 的回归（宿主接线片）。
 *
 * 取样器本体（`MotionRecorder` / `judgeMotionJudder`）已在
 * `tests/core/performance-motion.test.ts` 锁死；这里只锁**接线片**的四条行为：
 *   ① 挂上后每帧被记；② `readPos` 决定位移列；③ 到 `autoReportFrames` 自动打一行
 *   （真机侧靠它——远程日志里 grep `[MOTION]` 就能取判据，不需要人蹲控制台）；
 *   ④ `stop()` 后 App 的钩子归 null（不留着白跑热路径）。
 */
import { describe, expect, it } from 'vitest';
import { App } from '../../src/compose/app.js';
import { NodePlatform } from '../../src/platform/node.js';
import { armMotionProbe } from '../../src/core/performance/performance.js';
import type { Game, GameServices } from '../../src/core/index.js';
import { RenderModelBuilder } from '../../src/core/index.js';

/** 最小可画游戏：`size` 变 = 内容变（脏帧门会放行），不变 = 干净帧（被跳过）。 */
class ProbeGame implements Game {
  readonly id = 'probe';
  services: GameServices | null = null;
  size = 10;
  init(): void {}
  update(): void {}
  buildRenderModel(builder: RenderModelBuilder): void {
    builder.setBackground('#000000');
    builder.rect(0, 0, this.size, this.size, { fill: '#fff' });
  }
  onPause(): void {}
  onResume(): void {}
  dispose(): void {}
}

function makeApp() {
  const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
  const game = new ProbeGame();
  const app = new App({ game, platform, designWidth: 750, designHeight: 1334, seed: 'probe' });
  app.onRender = (): void => {};
  return { app, game };
}

describe('armMotionProbe', () => {
  it('挂上后每个渲染帧都被记，dtMs/steps 与真实循环一致', () => {
    const { app } = makeApp();
    const probe = armMotionProbe(app);
    for (let i = 0; i < 30; i += 1) app.tick(1 / 60);
    expect(probe.frames().length).toBe(30);
    expect(probe.frames()[5]!.dtMs).toBeCloseTo(1000 / 60, 3);
    expect(probe.frames()[5]!.steps).toBe(1);
  });

  it('readPos 提供位置列；不提供则位移恒为 0（宿主拿不到相机时仍可判节奏）', () => {
    const { app } = makeApp();
    let x = 0;
    const withPos = armMotionProbe(app, { readPos: () => (x += 4) });
    for (let i = 0; i < 5; i += 1) app.tick(1 / 60);
    expect(withPos.frames().slice(1).every((f) => f.dPos === 4)).toBe(true);

    const { app: app2 } = makeApp();
    const noPos = armMotionProbe(app2);
    for (let i = 0; i < 5; i += 1) app2.tick(1 / 60);
    expect(noPos.frames().every((f) => f.dPos === 0)).toBe(true);
  });

  it('到 autoReportFrames 自动打一行（真机日志可直接 grep [MOTION]），且只打一次', () => {
    const { app } = makeApp();
    const lines: string[] = [];
    const probe = armMotionProbe(app, { autoReportFrames: 24, log: (l) => lines.push(l) });
    for (let i = 0; i < 40; i += 1) app.tick(1 / 60);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('verdict=');
    expect(probe.reported).toBe(true);
  });

  it('stop() 摘钩：App.motionProbe 归 null，之后再 tick 不再增长', () => {
    const { app } = makeApp();
    const probe = armMotionProbe(app);
    for (let i = 0; i < 10; i += 1) app.tick(1 / 60);
    probe.stop();
    expect(app.motionProbe).toBeNull();
    for (let i = 0; i < 10; i += 1) app.tick(1 / 60);
    expect(probe.frames().length).toBe(10);
  });

  it('未挂探针时 App 不产生任何取样调用（默认零成本）', () => {
    const { app } = makeApp();
    expect(app.motionProbe).toBeNull();
    for (let i = 0; i < 10; i += 1) app.tick(1 / 60);
    expect(app.motionProbe).toBeNull();
  });
});
