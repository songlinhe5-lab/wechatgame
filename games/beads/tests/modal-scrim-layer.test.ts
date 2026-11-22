/**
 * `[WXG-T-1029]` 弹窗蒙版独立容器层序（先红后绿）。
 *
 * 背景：T-1028 把容器四通道改成 `blit → graphics`（位图做底、矢量做前景）后，弹窗蒙版
 * rect（走容器 `Graphics`）被抬到背板位图（`BlitLayerUI`）**之上** ⇒ 木牌 / 橱窗 / 九格
 * 整片被蒙版罩暗（2026-11-22 用户真机实测「对话框蒙版层级有问题，需要放到背板后面」）。
 *
 * 修法（内核零改动，纯视图层）：`buildMetaModal` 在弹窗命令之前先开 `{overlay}:scrim`
 * 容器发蒙版——内核规则「容器序 = 出现序」⇒ scrim 容器整棵排在弹窗容器之下，蒙版
 * 压得住底页（容器树在全局 `UiContainers` 末位）、又压不住弹窗位图。
 * ⛔ 页面绘制（`drawModalPlate` / `panelPage`）不得再自发蒙版 rect（双份蒙版 = 弹窗被罩暗）。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { defaultBeadsSave } from '../src/game/save-schema.js';
import { DESIGN_H, DESIGN_W, WALL_ROWS } from '../src/config/tuning.js';
import { metaLayout } from '../src/view/meta-view.js';
import { UI_SCRIM, scrimFill } from '../src/view/ui-theme.js';

const PLAY_KEY = 'test.modal-scrim.play';
const META_KEY = 'test.modal-scrim.meta';
const SRC = (rel: string): string =>
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', rel), 'utf8');

function frameOf(shell: BeadsShell): readonly DrawCommand[] {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    shell.buildRenderModel(builder);
    return builder.end().commands;
}

function rig(): BeadsShell {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const storage = platform.createStorage();
    storage.set(PLAY_KEY, JSON.stringify(defaultBeadsSave()));
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), staminaCur: 8 }));
    const viewport = new Viewport(DESIGN_W, DESIGN_H);
    viewport.resize(750, 1334);
    const services: GameServices = {
        events: new EventBus<EventMap>(),
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('modal-scrim'),
        viewport,
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({ clock: () => 1_000, metaKey: META_KEY, play: { saveKey: PLAY_KEY } });
    shell.init(services);
    return shell;
}

function openModal(shell: BeadsShell, buttonId: string, expected: string): void {
    const entry = metaLayout('none', WALL_ROWS, shell.menuAnchors).buttons.find((b) => b.id === buttonId)!;
    const c = entry.box;
    expect(shell.tapMeta(c.x + c.w / 2, c.y + c.h / 2)).toBe(true);
    expect(shell.overlay).toBe(expected);
}

/** 命令的「所属容器」：往前找最近的 container 命令 id。 */
function ownerOf(cmds: readonly DrawCommand[], at: number): string | null {
    for (let i = at; i >= 0; i -= 1) {
        const cmd = cmds[i]!;
        if (cmd.kind === 'container') return cmd.id;
    }
    return null;
}

describe('WXG-T-1029 — 弹窗蒙版独立容器（蒙版在背板之下）', () => {
    it('设置弹窗：蒙版 rect 归属 `settings:scrim`，整棵先于弹窗容器', () => {
        const shell = rig();
        openModal(shell, 'open-settings', 'settings');
        const cmds = frameOf(shell);
        const scrim = scrimFill(UI_SCRIM.overlay, UI_SCRIM.settingsAlpha);
        const at = cmds.findIndex((c) => c.kind === 'rect' && c.fill === scrim);
        expect(at, '蒙版 rect 在册').toBeGreaterThan(-1);
        expect(ownerOf(cmds, at), '蒙版必须发在 scrim 容器').toBe('settings:scrim');
        // ⚠ 命令流上外层 container('settings') 先发（UiRoot 包边界），但引擎**懒建**（落笔才建层）：
        // 蒙版 rect 先落笔 ⇒ scrim 容器先建层 ⇒ 节点序 scrim 整棵在弹窗容器之前（= 蒙版在背板之下）。
        // 命令流可锁的结构 = 蒙版 rect 紧随 scrim 容器开启（紧邻 ⇒ 中间无弹窗落笔混入）。
        expect(cmds[at - 1], '蒙版紧随 scrim 容器开启').toMatchObject({ kind: 'container', id: 'settings:scrim' });
    });

    it('选关弹窗：蒙版 rect 归属 `levels:scrim`（通用 0.5 浓度）', () => {
        const shell = rig();
        openModal(shell, 'open-levels', 'levels');
        const cmds = frameOf(shell);
        const scrim = scrimFill(UI_SCRIM.overlay, UI_SCRIM.alpha);
        const at = cmds.findIndex((c) => c.kind === 'rect' && c.fill === scrim);
        expect(at, '蒙版 rect 在册').toBeGreaterThan(-1);
        expect(ownerOf(cmds, at), '蒙版必须发在 scrim 容器').toBe('levels:scrim');
    });

    it('页面绘制不再自发蒙版：drawModalPlate / panelPage 无全屏 scrimFill rect（防双份罩暗）', () => {
        const widgets = SRC('view/meta-widgets.ts');
        expect(widgets.match(/scrimFill\(UI_SCRIM\.overlay/g) ?? []).toEqual([]);
        const metaView = SRC('view/meta-view.ts');
        // panelPage 的蒙版已上楼到 buildMetaModal；panelPage 体内不得再有 overlay 蒙版
        const panelBody = metaView.slice(metaView.indexOf('function panelPage'), metaView.indexOf('function panelPage') + 1600);
        expect(panelBody.match(/scrimFill\(UI_SCRIM\.overlay/g) ?? []).toEqual([]);
    });
});
