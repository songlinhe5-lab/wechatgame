/**
 * 对话框垂直居中收口（WXG-T-323）—— 用户裁定：对话框中心 = **手机中心**。
 *
 * 根因：`dynamicHeight` 档把设计高逐机算到 1334~1630，但六处对话框仍按静态 `DESIGN_H`
 * 居中 ⇒ 高屏机整块偏下 `(H−1334)/2`。收口点 = `tuning.setLiveDesignHeight` /
 * `dialogShiftY`（由 `BeadsShell.init` 与菜单链锚同点写入，绘制面与命中面共用同一算式）。
 *
 * 本文件只钉**高屏档**（畅享 90 Pro Max 1128×2444 ⇒ 设计高 1625）；基准档 1334 位移恒 0，
 * 零漂移由金样本十态夹具 + 既有套件守 ⇒ ⛔ 不在本文件重复断言 1334 数值。
 *
 * 末尾另挂一节【WXG-T-324/325】菜单弹窗透出底页的帧构成腿（用户真机报「主界面设置页面，没有
 * 半透」→ 同机再报「层级错乱」）——当前 `skip`，解开前置 = ADR-0033 容器层落地。
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
    type TextCommand,
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
import { UI_SCRIM, scrimFill } from '../src/view/ui-theme.js';
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

/** 取一帧全量指令流（高屏档 builder 与 viewport 同源 = 实际设计高）。 */
function frameOf(shell: BeadsShell): readonly DrawCommand[] {
    const builder = new RenderModelBuilder(DESIGN_W, liveDesignHeight());
    builder.begin();
    shell.buildRenderModel(builder);
    return builder.end().commands;
}

function openSettings(shell: BeadsShell): void {
    const entry = metaLayout('none', WALL_ROWS, shell.menuAnchors).buttons.find(
        (b) => b.id === 'open-settings',
    )!;
    const c = entry.box;
    expect(shell.tapMeta(c.x + c.w / 2, c.y + c.h / 2)).toBe(true);
    expect(shell.overlay).toBe('settings');
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
        openSettings(shell);
        // 弹层里唯一 `radiusPanel` 的 rect = 纸面板底板（按钮走 radiusWood / radiusBtnSmall）。
        const plate = frameOf(shell).find(
            (cmd: DrawCommand): cmd is RectCommand =>
                cmd.kind === 'rect' && cmd.radius === UI_CONTAINER.radiusPanel,
        );
        expect(plate, '未找到设置弹窗底板 rect').toBeDefined();
        expectScreenCenter('设置弹窗（绘制面）', plate!.y + plate!.h / 2);
    });
});

describe('WXG-T-324/325 — 菜单弹窗透出底页（待 ADR-0033 容器层）', () => {
    // ⚠ 本例在 Node / canvas2d 端能跑绿，但**不足以证明真机层级正确**：Cocos 把指令流分成写死五段
    // （Background → BlitLayer → Graphics → BlitLayerUI → Labels），遮罩（Graphics）压不住底页的
    // `BlitLayerUI` 位图腿与 `Labels` 文字 ⇒ 先画底页的做法在真机端已回退（WXG-T-325）。
    // 解开本 skip 的前置 = 容器层落地（ADR-0033 / UI-60）：弹窗作为独立容器，容器内层有序。
    it.skip('设置弹窗：遮罩之前必须已画出主菜单图元（待容器层）', () => {
        const shell = rig();
        openSettings(shell);
        const cmds = frameOf(shell);
        const scrim = scrimFill(UI_SCRIM.overlay, UI_SCRIM.settingsAlpha);
        const at = cmds.findIndex((cmd) => cmd.kind === 'rect' && cmd.fill === scrim);
        expect(at, '半透遮罩 rect 在册').toBeGreaterThan(-1);
        // 主菜单独有图元（棋盘预览 / 橱窗多边形）必须在遮罩**之前**：弹窗自身不画任何 polygon/circle
        //（修正前 `settings` 整帧 = { rect:13, text:12 }，遮罩下无可透之物 ⇒ 用户报「没有半透」）。
        const underlay = cmds
            .slice(0, at)
            .filter((cmd) => cmd.kind === 'polygon' || cmd.kind === 'circle').length;
        expect(underlay, '遮罩下必须已画出底层主菜单').toBeGreaterThan(100);
    });
});

/**
 * [WXG-T-339] 设置弹窗「标题压首行」回归守——修前标题中心 957 落进首行钮带 [877,965]（叠 28，
 * 用户真机报「设置标题与第一行按钮重叠」）。本腿读**真实整帧命令流**：标题字面下缘（40px 字 ⇒
 * 中心 −20）对首行（全场最高一排 `h = TOUCH_MIN = 88` 的钮）顶缘，净空 < 10 即红（修前 = −8，现 = 12）。
 */
describe('WXG-T-339 — 设置弹窗标题与首行净空', () => {
    it('标题下缘与首行钮顶净空 ≥ 10', () => {
        const shell = rig();
        openSettings(shell);
        const cmds = frameOf(shell);
        // 弹层里唯一「设置」字面 = overlay 标题（按钮标签均带前缀文案，无同名）。
        const title = cmds.find(
            (cmd: DrawCommand): cmd is TextCommand => cmd.kind === 'text' && cmd.text === '设置',
        );
        expect(title, '未找到「设置」标题 text 命令').toBeDefined();
        // 全部 h=88 的 rect = 设置 10 钮 + 返回（底板 720 / 遮罩 1625 不在列）；最高一排 = 首行。
        const bars = cmds.filter(
            (cmd: DrawCommand): cmd is RectCommand => cmd.kind === 'rect' && cmd.h === 88,
        );
        expect(bars.length, '88 高按钮 rect 在册').toBeGreaterThan(0);
        const firstRowTop = Math.max(...bars.map((cmd) => cmd.y + cmd.h));
        expect(title!.y - 20 - firstRowTop).toBeGreaterThanOrEqual(10);
    });
});
