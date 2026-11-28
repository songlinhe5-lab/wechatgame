/**
 * `[WXG-T-1109]` 拖动窗口取样：真机上「拖一下就拿到 K-225 三列读数」，不依赖日志通道。
 *
 * 用户 2026-11-27 报「拖动时候珠面移动还是不跟手」+「感觉刷新率不够」，随后又补「各种动画都不是
 * 很流畅，性能数据是不是有问题」——后者正是 `[WXG-T-1108]` 修掉的那个假 60fps。本例锁两件事：
 * ① 采集窗**只在单指平移期间**开（其余帧不混进读数）；② 抬手即冻结一行结论，且用框架同一张
 * 判定表（`judgeMotionJudder`），⛔ 视图层不自带第二套阈值。
 *
 * 断言走**画出来的字**（`RenderModel` 的 text 命令）而不是内部字段 —— 用户看到的就是那一行。
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
    type GameServices,
    type MotionJudder,
    type RenderModel,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, motionLine } from '../src/game/beads-shell.js';

const STEP = 1 / 60;
const FRAME_MS = 16.7;

function rig(): {
    shell: ReturnType<typeof createBeadsShell>;
    services: GameServices;
    input: InputManager;
    frame(sample?: { id: number; x: number; y: number; phase: 'down' | 'move' | 'up' }): RenderModel;
} {
    let now = 1_000;
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const input = new InputManager();
    const services: GameServices = {
        events: new EventBus(),
        input,
        audio: new AudioScheduler(new NullAudioBackend()),
        storage: platform.createStorage(),
        rng: createRng('drag-window'),
        viewport: new Viewport(750, 1334),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({
        clock: () => now,
        metaKey: 'wxgame.beads.test.dragwin.meta',
        play: { saveKey: 'wxgame.beads.test.dragwin.play' },
        initialScreen: 'play',
    });
    shell.init(services);
    const builder = new RenderModelBuilder(750, 1334);
    return {
        shell,
        services,
        input,
        // 一帧 = 投一条指针事件 → 固定步 → 渲染帧（与 `App._fixedUpdate` + `_render` 同形）。
        frame: (sample) => {
            input.beginFrame();
            if (sample) input.push({ ...sample, time: 0 });
            shell.update(STEP);
            input.endFrame(STEP);
            now += FRAME_MS;
            builder.begin();
            shell.buildRenderModel(builder);
            return builder.end();
        },
    };
}

/** 本帧画出来的所有文字（性能覆层的几行都在里面）。 */
function drawnText(model: RenderModel): string {
    let out = '';
    for (const c of model.commands) if (c.kind === 'text') out += `${c.text}\n`;
    return out;
}

describe('拖动窗口取样（WXG-T-1109）', () => {
    it('平移期间报帧数，抬手后冻结成一行结论，10 s 后让回常规细节行', () => {
        const r = rig();
        r.shell.play.setDebugInfo(true);
        // `[WXG-T-1116]` 面板默认收起：先点面板展开（本例断言的 pitch / 拖动读数行都在展开态里）。
        expect(r.shell.play.tapDebugPanel(160, 1334 - 23)).toBe(true);
        const center = r.shell.play.debugCellCenter(
            Math.floor(r.shell.play.grid.rows / 2),
            Math.floor(r.shell.play.grid.cols / 2),
        )!;
        const screen = { x: 0, y: 0 };
        r.services.viewport.designToScreen(screen, center.x, center.y);

        expect(drawnText(r.frame({ id: 1, x: screen.x, y: screen.y, phase: 'down' }))).toContain('pitch');
        // 越阈（阈值 8 设计 px，这里走 60 css px 确保进入平移态）
        expect(drawnText(r.frame({ id: 1, x: screen.x - 60, y: screen.y, phase: 'move' }))).toContain(
            '拖动采集中',
        );
        expect(r.shell.play.dragging).toBe(true);

        let last = '';
        for (let i = 0; i < 30; i++) {
            last = drawnText(r.frame({ id: 1, x: screen.x - 60 - i * 2, y: screen.y, phase: 'move' }));
        }
        expect(last).toContain('拖动采集中 31 帧');

        // 抬手：本帧落结论（判据 = 框架判定表；60fps + 每帧 1 步 + 峰 17ms ⇒ 平滑）
        const line = drawnText(r.frame({ id: 1, x: screen.x - 120, y: screen.y, phase: 'up' }));
        expect(line).toContain('拖 平滑 60fps 零步0% 峰17');

        // 显示窗到期 ⇒ 让回 pitch / LOD / beads 常规行
        let after = '';
        for (let i = 0; i < 600; i++) after = drawnText(r.frame());
        expect(after).toContain('pitch');
        expect(after).not.toContain('拖 平滑');
    });

    it('调试开关关闭时整条腿不跑（不画任何读数行）', () => {
        const r = rig();
        const center = r.shell.play.debugCellCenter(1, 1)!;
        const screen = { x: 0, y: 0 };
        r.services.viewport.designToScreen(screen, center.x, center.y);
        r.frame({ id: 1, x: screen.x, y: screen.y, phase: 'down' });
        r.frame({ id: 1, x: screen.x - 60, y: screen.y, phase: 'move' });
        const up = drawnText(r.frame({ id: 1, x: screen.x - 120, y: screen.y, phase: 'up' }));
        // 覆层关 ⇒ 面板一条字都不发（棋盘/托盘的正常文字仍在，所以只钉读数行缺席）
        expect(up).not.toContain('拖动采集中');
        expect(up).not.toContain('拖 ');
    });
});

describe('motionLine（判定词与四个读数同源）', () => {
    const base: MotionJudder = {
        verdict: 'smooth',
        n: 60,
        dtMedianMs: 16.7,
        dtMaxMs: 16.8,
        dtCv: 0.01,
        zeroStepShare: 0,
        multiStepFrames: 0,
        drewShare: 1,
        presentGapMaxMs: 16.8,
        moveIrregularity: 1,
    };

    it('平滑 / 60fps / 零步 0% / 峰 17', () => {
        expect(motionLine(base)).toBe('拖 平滑 60fps 零步0% 峰17');
    });

    it('其余四种结论各自有词，且零步占比取整', () => {
        expect(motionLine({ ...base, verdict: 'insufficient' })).toContain('待采');
        expect(motionLine({ ...base, verdict: 'refresh-halved' })).toContain('半帧率');
        expect(
            motionLine({ ...base, verdict: 'accumulator-jitter', zeroStepShare: 0.375 }),
        ).toContain('累加抖 60fps 零步38%');
        expect(motionLine({ ...base, verdict: 'stall', dtMaxMs: 250 })).toContain('掉帧');
    });

    it('空样本不产出 NaN（中位 0 ms ⇒ 0fps）', () => {
        expect(motionLine({ ...base, n: 0, dtMedianMs: 0, dtMaxMs: 0 })).toBe(
            '拖 平滑 0fps 零步0% 峰0',
        );
    });
});
