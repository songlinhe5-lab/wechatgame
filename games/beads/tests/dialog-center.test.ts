/**
 * 对话框垂直居中收口（WXG-T-323）—— 用户裁定：对话框中心 = **手机中心**。
 *
 * 根因：`dynamicHeight` 档把设计高逐机算到 1334~1630，但六处对话框仍按静态 `DESIGN_H`
 * 居中 ⇒ 高屏机整块偏下 `(H−1334)/2`。收口点 = `tuning.setLiveDesignHeight` /
 * `dialogShiftY`（由 `BeadsShell.init` 与菜单链锚同点写入，绘制面与命中面共用同一算式）。
 *
 * 本文件只钉**高屏档**（畅享 90 Pro Max 1128×2444 ⇒ 设计高 1625）；基准档 1334 位移恒 0，
 * 零漂移由金样本十态夹具 + 既有套件守 ⇒ ⛔ 不在本文件重复断言 1334 数值。
 */

import { describe, it, expect } from 'vitest';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    NullAssetProvider,
    NullAudioBackend,
    RenderModelBuilder,
    Viewport,
    createRng,
    type DrawCommand,
    type EventMap,
    type GameServices,
    type RectCommand,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { defaultBeadsSave } from '../src/game/save-schema.js';
import {
    DESIGN_H,
    DESIGN_W,
    UI_CONTAINER,
    WALL_ROWS,
    dialogShiftY,
    liveDesignHeight,
} from '../src/config/tuning.js';
import { pausePanelLayout } from '../src/systems/pause-panel.js';
import { clearPanelLayout } from '../src/systems/clear-panel.js';
import { failPanelLayout } from '../src/systems/fail-panel.js';
import { sprintSettleLayout } from '../src/systems/sprint-settle.js';
import { metaLayout } from '../src/view/meta-view.js';
import type { PanelRect } from '../src/systems/pause-panel.js';

const PLAY_KEY = 'test.dialog-center.play';
const META_KEY = 'test.dialog-center.meta';

/** L-A 畅享 90 Pro Max 实读屏幅（dp）⇒ 宽恒定版式下动态档设计高 1625。 */
const SCREEN_W_DP = 1128;
const SCREEN_H_DP = 2444;
const TALL_H = Math.round((DESIGN_W * SCREEN_H_DP) / SCREEN_W_DP);

function center(plate: PanelRect): number {
    return (plate.yMin + plate.yMax) / 2;
}

/** 居中判据：面板中心与实际屏中心（H/2）相距 ≤ 0.5 设计 px（奇数多出量的整数化余量）。 */
function expectScreenCenter(label: string, got: number): void {
    expect(Math.abs(got - TALL_H / 2), label).toBeLessThanOrEqual(0.5);
}

function rig(): BeadsShell {
    const platform = new NodePlatform({ width: SCREEN_W_DP, height: SCREEN_H_DP, pixelRatio: 3 });
    const storage = platform.createStorage();
    storage.set(PLAY_KEY, JSON.stringify(defaultBeadsSave()));
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), staminaCur: 99 }));
    const viewport = new Viewport(DESIGN_W, DESIGN_H, /* dynamicHeight */ true);
    viewport.resize(SCREEN_W_DP, SCREEN_H_DP);
    const services: GameServices = {
        events: new EventBus<EventMap>(),
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('dialog-center'),
        viewport,
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({
        clock: () => 1_000,
        metaKey: META_KEY,
        play: { saveKey: PLAY_KEY },
    });
    shell.init(services);
    return shell;
}

describe('WXG-T-323 — 对话框中心对齐手机中心（逐机实际设计高）', () => {
    it('shell.init 写入实际设计高 ⇒ 位移 = 顶部多出量之半', () => {
        rig();
        expect(liveDesignHeight()).toBe(TALL_H);
        // 多出量 291 ⇒ 居中位移 146（面板中心从基准 667 移到 813 ≈ 真中心 812.5）
        expect(dialogShiftY()).toBe(146);
    });

    it('局内四处对话框（暂停 / 结算 / 失败 / 冲刺结算）中心 = 手机中心', () => {
        rig();
        for (const [name, plate] of [
            ['暂停 normal', pausePanelLayout('normal').panel],
            ['暂停 sprint', pausePanelLayout('sprint').panel],
            ['结算', clearPanelLayout({ lastLevel: false }).panel],
            ['结算（末关）', clearPanelLayout({ lastLevel: true }).panel],
            ['失败（可复活）', failPanelLayout(true).panel],
            ['失败（仅重试）', failPanelLayout(false).panel],
            ['冲刺结算', sprintSettleLayout().panel],
        ] as const) {
            expectScreenCenter(name, center(plate));
        }
    });

    it('菜单设置弹窗底板（绘制面）中心 = 手机中心', () => {
        const shell = rig();
        const entry = metaLayout('none', WALL_ROWS, shell.menuAnchors).buttons.find(
            (b) => b.id === 'open-settings',
        )!;
        const c = entry.box;
        expect(shell.tapMeta(c.x + c.w / 2, c.y + c.h / 2)).toBe(true);
        expect(shell.overlay).toBe('settings');

        const builder = new RenderModelBuilder(DESIGN_W, liveDesignHeight());
        builder.begin();
        shell.buildRenderModel(builder);
        // 弹层里唯一 `radiusPanel` 的 rect = 纸面板底板（按钮走 radiusWood / radiusBtnSmall）。
        const plate = builder
            .end()
            .commands.find(
                (cmd: DrawCommand): cmd is RectCommand =>
                    cmd.kind === 'rect' && cmd.radius === UI_CONTAINER.radiusPanel,
            );
        expect(plate, '未找到设置弹窗底板 rect').toBeDefined();
        expectScreenCenter('设置弹窗（绘制面）', plate!.y + plate!.h / 2);
    });
});
