/**
 * `[WXG-T-1108]` 性能覆层的「帧耗时」必须是**壁钟渲染帧间隔**，不能是固定步长。
 *
 * 背景：`update(dt)` 的入参恒为 `1/60`（`FixedStepLoop.fixedUpdate`），旧口径把它当帧耗时
 * ⇒ `frameMs` 恒 16.7、覆层 fps 恒 60。真机拖动的掉帧读数因此长期不可见（用户 2026-11-27
 * 报「拖动时感觉刷新率不够」，K-225 要求先取帧间隔这列读数）。现口径的取样点是
 * `BeadsShell.buildRenderModel`（每渲染 tick 一次，脏帧门拦不到它）。
 */
import { describe, expect, it } from 'vitest';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    NullAssetProvider,
    NullAudioBackend,
    RenderModelBuilder,
    Viewport,
    createRng,
    type DrawCostReading,
    type EventMap,
    type GameServices,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell } from '../src/game/beads-shell.js';

function rig(
    initialScreen?: 'play',
    drawCost?: DrawCostReading,
    reads?: { n: number },
): { shell: ReturnType<typeof createBeadsShell>; advance(ms: number): void } {
    let now = 1_000;
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const services: GameServices = {
        events: new EventBus<EventMap>(),
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage: platform.createStorage(),
        rng: createRng('perf-frame-clock'),
        viewport: new Viewport(750, 1334),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
        // `[WXG-T-1110]` 真机侧由 App 接线；测试注入同一形状的只读投影。
        ...(drawCost
            ? {
                readDrawCost: () => {
                    if (reads) reads.n += 1;
                    return drawCost;
                },
            }
            : {}),
    };
    const shell = createBeadsShell({
        clock: () => now,
        metaKey: 'wxgame.beads.test.perf-clock.meta',
        play: { saveKey: 'wxgame.beads.test.perf-clock.play' },
        ...(initialScreen ? { initialScreen } : {}),
    });
    shell.init(services);
    return { shell, advance: (ms) => { now += ms; } };
}

const OUT = { enabled: false, frameMs: 0, drawMs: 0, paintCalls: 0, commands: 0, breakdown: { vectorMs: 0, blitMs: 0, textMs: 0, scopeMs: 0, vectorCalls: 0, blitCalls: 0, textCalls: 0 }, phase: '', level: '', detail: '' };

describe('性能覆层帧耗时 = 渲染帧壁钟（WXG-T-1108）', () => {
    it('每渲染帧 33 ms ⇒ frameMs ≈ 33（旧口径恒 16.7）', () => {
        const r = rig();
        r.shell.play.setDebugInfo(true);
        const builder = new RenderModelBuilder(750, 1334);
        const draw = (): void => {
            builder.begin();
            r.shell.buildRenderModel(builder);
            builder.end();
        };
        r.advance(16); // 首帧只建基准，不采样
        draw();
        for (let i = 0; i < 20; i++) {
            r.advance(33);
            draw();
        }
        const st = r.shell.play.debugState(OUT);
        expect(st.frameMs).toBeCloseTo(33, 6);
        expect(Math.round(1000 / st.frameMs)).toBe(30);
    });

    it('固定步 update 不再写入帧耗时（debugInfo 开也不写）', () => {
        const r = rig('play');
        r.shell.play.setDebugInfo(true);
        for (let i = 0; i < 10; i++) r.shell.update(1 / 60);
        expect(r.shell.play.debugState(OUT).frameMs).toBe(0);
    });

    it('开关关闭时取样零写入；> 250 ms（后台/挂起）不采样', () => {
        const r = rig();
        const builder = new RenderModelBuilder(750, 1334);
        const draw = (): void => {
            builder.begin();
            r.shell.buildRenderModel(builder);
            builder.end();
        };
        r.advance(16);
        draw();
        r.advance(33);
        draw();
        expect(r.shell.play.debugState(OUT).frameMs).toBe(0); // 关：零写入

        r.shell.play.setDebugInfo(true);
        r.advance(1_000); // 回前台那种大档
        draw();
        r.advance(1_000);
        draw();
        expect(r.shell.play.debugState(OUT).frameMs).toBe(0); // 只吃 >250ms 的档 ⇒ 仍无样本
    });
});

describe('性能覆层绘制成本投影（WXG-T-1110）', () => {
    it('宿主有 readDrawCost ⇒ drawMs / paintCalls 原样进调试投影', () => {
        const r = rig(undefined, {
            drawMs: 21.4, paintCalls: 3010, commands: 2382,
            breakdown: { vectorMs: 3.1, blitMs: 18.9, textMs: 0.4, scopeMs: 0.4, vectorCalls: 12, blitCalls: 156, textCalls: 8 },
        });
        r.shell.play.setDebugInfo(true);
        const st = r.shell.play.debugState(OUT);
        expect(st.enabled).toBe(true);
        expect(st.drawMs).toBe(21.4);
        expect(st.paintCalls).toBe(3010);
        expect(st.breakdown.blitMs).toBe(18.9);
        expect(st.breakdown.blitCalls).toBe(156);
    });

    it('宿主没接线（harness / 老宿主）⇒ 两个字段为 0，覆层不出那一行', () => {
        const r = rig();
        const st = r.shell.play.debugState(OUT);
        expect(st.drawMs).toBe(0);
        expect(st.paintCalls).toBe(0);
    });

    it('⚠ 覆层关闭时一次都不读 readDrawCost（否则 release 路径会被打开计时分支）', () => {
        const reads = { n: 0 };
        const r = rig(undefined, { drawMs: 9, paintCalls: 9, commands: 9, breakdown: { vectorMs: 0, blitMs: 0, textMs: 0, scopeMs: 0, vectorCalls: 0, blitCalls: 0, textCalls: 0 } }, reads);
        const off = r.shell.play.debugState(OUT);
        expect(off.enabled).toBe(false);
        expect(reads.n).toBe(0);
        r.shell.play.setDebugInfo(true);
        expect(r.shell.play.debugState(OUT).drawMs).toBe(9);
        expect(reads.n).toBe(1);
    });
});
