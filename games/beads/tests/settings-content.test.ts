/**
 * UI-30 · SettingsContent / SettingsModal 内容块（ADR-0032 §4）。
 *
 * 验收原文：「金样本对拍；全部动作可达」。
 *  - 金样本：`ui-golden.test.ts` 设置态逐字对拍；
 *  - 本文件钉住：单列 cell 列表几何（11 行 × 138 高 / 行距 12）、可视窗与滚动换算、
 *    **每个动作在滚到位后都能命中自己**、文案、按下位移、位图 / 程序化降级，
 *    以及「设置文案单源 = 菜单 settings overlay」（静态门）。
 *
 * 2026-11-14 同步 Figma 设置页：两列 6 行 → 单列 11 行 cell 列表（可滚）；返回钮已删。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderModelBuilder } from '@wxgame/framework';
import { hitTestMeta, metaLayout } from '../src/view/meta-view.js';
import { levelDetailPlate } from '../src/view/meta-layout.js';
import { setMenuBitmapResolver } from '../src/view/meta-widgets.js';
import { MENU_TEXTURES } from '../src/config/tuning.js';
import {
    drawSettingsContent,
    isSettingsAction,
    isToggleAction,
    settingsContentButtons,
    settingsContentHeight,
    settingsContentLabel,
    settingsContentViewport,
    settingsCellParts,
    settingsScrollMax,
    settingsToggleHitBox,
    type SettingsAction,
    type SettingsContentData,
} from '../src/view/settings-content.js';
import { DEFAULT_PALETTE, type BeadsPalette } from '../src/view/palette.js';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PALETTE = DEFAULT_PALETTE;

const DATA: SettingsContentData = {
    bgmMuted: false,
    sfxMuted: false,
    reduceMotion: false,
    largeText: false,
    vibrate: true,
    debugInfo: false,
    debugGuides: false,
    beadStyle: 'facet4',
    beadSize: 'full',
    skinId: 'default',
};

type Call = { kind: string; args: unknown[] };

/** 录下全部绘制指令（rect / text / line / circle / blit）。 */
function recorder(): { b: RenderModelBuilder; calls: Call[] } {
    const calls: Call[] = [];
    const rec =
        (kind: string) =>
        (...args: unknown[]) => {
            calls.push({ kind, args });
        };
    const b = {
        rect: rec('rect'),
        text: rec('text'),
        line: rec('line'),
        circle: rec('circle'),
        blit: rec('blit'),
        setBackground: () => undefined,
    } as unknown as RenderModelBuilder;
    return { b, calls };
}

/** 文字指令的内容（args[2]）。 */
function textsOf(calls: Call[]): string[] {
    return calls.filter((c) => c.kind === 'text').map((c) => c.args[2] as string);
}

/**
 * 滚到能看见该行的滚动量，返回「同一行在屏上的点」（绘制 = box + scroll，命中 = 点 − scroll）。
 * 有开关的行只有开关热区可点（`[WXG-T-943]`），无开关的循环行用整行中心。
 */
function visiblePoint(id: SettingsAction): { x: number; y: number; scroll: number } {
    const plate = levelDetailPlate();
    const box = settingsContentButtons(plate).find((b) => b.id === id)!.box;
    const hit = isToggleAction(id) ? settingsToggleHitBox(box) : box;
    const vp = settingsContentViewport(plate);
    const cy = hit.y + hit.h / 2;
    const want = vp.y + vp.h / 2 - cy;
    const scroll = Math.max(0, Math.min(settingsScrollMax(plate), want));
    return { x: hit.x + hit.w / 2, y: cy + scroll, scroll };
}

describe('UI-30 · SettingsContent', () => {
    afterEach(() => setMenuBitmapResolver(undefined));

    it('单列 cell 版式：10 行 × 509×138，行距 12，首行贴可视窗上缘（皮肤行已退场）', () => {
        const buttons = settingsContentButtons(levelDetailPlate());
        expect(buttons).toHaveLength(10);
        expect(buttons.map((b) => b.id)).toEqual([
            'toggle-bgm',
            'toggle-sfx',
            'toggle-reduce-motion',
            'toggle-vibrate',
            'toggle-large-text',
            'toggle-debug-info',
            'cycle-bead-style',
            'cycle-bead-size',
            'toggle-ghost-symbol',
            'toggle-debug-guides',
        ]);
        // 木牌 581×1044 @ (89,124)：x = 89+36 = 125，w = 581−72 = 509；首行上缘 = 板顶 − 206 = 962。
        expect(buttons[0]!.box).toEqual({ x: 125, y: 824, w: 509, h: 138 });
        // 行距 = 138 + 12 = 150。
        expect(buttons[1]!.box.y).toBe(674);
        expect(buttons[9]!.box.y).toBe(824 - 9 * 150);
        for (const b of buttons) expect(b.box.x).toBe(125);
        // 总高 = 10×138 + 9×12 = 1488。
        expect(settingsContentHeight()).toBe(1488);
    });

    it('[WXG-T-935] 可视窗 / 滚动量：内容 1488 > 窗高 744 ⇒ 可滚 744；开关行只有开关热区命中', () => {
        const plate = levelDetailPlate();
        expect(settingsContentViewport(plate)).toEqual({ x: 125, y: 218, w: 509, h: 744 });
        expect(settingsScrollMax(plate)).toBe(744);

        // 未滚：窗内第 5 行（大字号）；开关热区中心 x = 125+371+57.5 = 553.5。
        const p = visiblePoint('toggle-large-text');
        expect(hitTestMeta('settings', p.x, p.y, undefined, p.scroll)?.id).toBe('toggle-large-text');
        // 行中心（名称区）不响应：有开关的整行不可点。
        expect(hitTestMeta('settings', 150, p.y)).toBeNull();
        // 滚到下一行（Debug 开关）：同一屏幕点落到下一行。
        const p2 = visiblePoint('toggle-debug-guides');
        expect(hitTestMeta('settings', p2.x, p2.y, undefined, p2.scroll)?.id).toBe('toggle-debug-guides');
        // 窗外（下缘 218 以下）= 不命中内容（避开右下「导入」固定钮）。
        expect(hitTestMeta('settings', 150, 200)).toBeNull();
    });

    it('全部动作可达：滚到能看见的位置后，每个按钮按自己的热区命中自己', () => {
        const buttons = metaLayout('settings').buttons.filter((b) => isSettingsAction(b.id));
        expect(buttons).toHaveLength(10);
        const plate = levelDetailPlate();
        for (const b of buttons) {
            const p = visiblePoint(b.id as SettingsAction);
            const hit = hitTestMeta('settings', p.x, p.y, undefined, p.scroll);
            expect(hit?.id, `${b.id} @ scroll ${p.scroll}`).toBe(b.id);
        }
        expect(settingsScrollMax(plate)).toBeGreaterThan(0);
    });

    it('文案单源：档位文案 = 开关两态 + 选择器读注册名（settingsContentLabel 未变）', () => {
        expect(settingsContentLabel('toggle-bgm', DATA)).toBe('音乐  开');
        expect(settingsContentLabel('toggle-bgm', { ...DATA, bgmMuted: true })).toBe('音乐  关');
        expect(settingsContentLabel('toggle-vibrate', DATA)).toBe('震动  开');
        expect(settingsContentLabel('toggle-ghost-symbol', DATA)).toBe('幽灵符号  关');
        expect(settingsContentLabel('toggle-ghost-symbol', { ...DATA, ghostSymbol: true })).toBe('幽灵符号  开');
        expect(settingsContentLabel('cycle-bead-style', DATA)).toContain('珠子风格');
        expect(settingsContentLabel('cycle-bead-size', DATA)).toContain('豆子尺寸');
        expect(settingsContentLabel('cycle-skin', DATA)).toContain('皮肤');
        expect(settingsContentLabel('toggle-debug-guides', DATA)).toBe('Debug  关');
    });

    it('cell 文案：名称 / 提示与 Figma 模版一致（震动 = 启用说明；循环项 = 当前值）', () => {
        expect(settingsCellParts('toggle-vibrate', DATA)).toMatchObject({
            name: '震动',
            hint: '启用后，接收提醒时设备会震动',
            toggle: true,
            icon: 'settingsIconVibrate',
        });
        expect(settingsCellParts('toggle-bgm', DATA)).toMatchObject({ name: '音乐', toggle: true });
        expect(settingsCellParts('toggle-large-text', DATA)).toMatchObject({ name: '大字号', hint: '当前：关' });
        expect(settingsCellParts('cycle-bead-size', DATA)).toMatchObject({ name: '豆子尺寸', toggle: null });
        // `[WXG-T-943]` 用户令：Debug / 幽灵符号 / 性能信息无第二行；减弱动效第二行改作用说明。
        expect(settingsCellParts('toggle-debug-info', DATA).hint).toBe('');
        expect(settingsCellParts('toggle-ghost-symbol', DATA).hint).toBe('');
        expect(settingsCellParts('toggle-debug-guides', DATA).hint).toBe('');
        expect(settingsCellParts('toggle-reduce-motion', DATA).hint).toBe('启用后，减少界面动效');
    });

    it('绘制：10 个 cell 各一个名称 + 非空提示；有开关的行按下不亮整行', () => {
        const buttons = settingsContentButtons(levelDetailPlate());
        const idle = recorder();
        drawSettingsContent(idle.b, DATA, PALETTE, buttons);
        const idleTexts = textsOf(idle.calls);
        for (const name of ['音乐', '音效', '减弱动效', '震动', '大字号', '性能信息', '珠子风格', '豆子尺寸', '幽灵符号', 'Debug']) {
            expect(idleTexts, name).toContain(name);
        }
        // 10 名称 + 7 非空提示（Debug / 幽灵符号 / 性能信息无第二行）。
        expect(idleTexts).toHaveLength(17);
        expect(idleTexts).not.toContain('皮肤');

        const pressed = recorder();
        drawSettingsContent(pressed.b, { ...DATA, pressed: { id: 'toggle-bgm' } }, PALETTE, buttons);
        const cellRect = (calls: Call[], x: number) => calls.find((c) => c.kind === 'rect' && c.args[0] === x && c.args[2] === 509)!;
        // 有开关的行：整行不亮按下态（y 不变），只有开关叠压暗。
        expect(cellRect(pressed.calls, 125).args[1] as number).toBe(cellRect(idle.calls, 125).args[1] as number);
        // 无开关的循环行仍整行按下：cycle-bead-style 的背板 y 下沉（pressOffset）。
        const cyclePressed = recorder();
        drawSettingsContent(cyclePressed.b, { ...DATA, pressed: { id: 'cycle-bead-style' } }, PALETTE, buttons);
        const cycleY = buttons.find((b) => b.id === 'cycle-bead-style')!.box.y;
        expect(
            cyclePressed.calls.some((c) => c.kind === 'rect' && c.args[0] === 125 && c.args[2] === 509 && (c.args[1] as number) < cycleY),
        ).toBe(true);
    });

    it('[ADR-0037] 半露行照画：只跳过完全在窗外的行，裁切交给调用方的 clip', () => {
        const plate = levelDetailPlate();
        const buttons = settingsContentButtons(plate);
        const vp = settingsContentViewport(plate);
        // scroll=75：首行半露在窗顶、第 6 行半露在窗底 ⇒ 前 6 行都落笔（含半露行），
        // 文字 = 5×2（带提示）+ 1（性能信息无第二行）= 11；更下面的行完全在窗外 ⇒ 不画。
        const mid = recorder();
        drawSettingsContent(mid.b, DATA, PALETTE, buttons, 75, vp);
        expect(textsOf(mid.calls)).toHaveLength(11);
        expect(textsOf(mid.calls)).toContain('音乐');
        expect(textsOf(mid.calls)).not.toContain('珠子风格');
    });

    it('动作全集 ≡ 弹窗排布（皮肤行退场；装扮馆入口只住顶栏 ⇒ ⛔ 不再是设置动作）', () => {
        // `[WXG-T-943]` 用户令「设置里面皮肤选项不需要」⇒ cycle-skin 不再进设置排布（受理器仍保留）。
        expect(isSettingsAction('cycle-skin')).toBe(false);
        expect(isSettingsAction('toggle-ghost-symbol')).toBe(true);
        // `open-skins` = 顶栏无字圆钮（MetaAction 而非 SettingsAction）⇒ 不进本集合。
        expect(isSettingsAction('open-skins')).toBe(false);
        expect(isSettingsAction('resume')).toBe(false);
    });

    it('[WXG-T-936] 右上 ✕ 与牌外四条关闭带：同槽 88² 热区；牌内空白不误关', () => {
        const buttons = metaLayout('settings').buttons;
        const close = buttons.find((b) => b.id === 'close-settings')!;
        // 与详情 / 选关同槽（`LEVEL_DETAIL_GEO.close`：中心 622 / 距屏底 213）+ 88² 最小触控档。
        expect(close.box).toEqual({ x: 622 - 44, y: 1334 - 213 - 44, w: 88, h: 88 });
        expect(buttons.filter((b) => b.id === 'dismiss-settings')).toHaveLength(4);
        expect(hitTestMeta('settings', 622, 1121)?.id).toBe('close-settings');
        expect(hitTestMeta('settings', 375, 1200)?.id).toBe('dismiss-settings'); // 牌下方
        expect(hitTestMeta('settings', 10, 700)?.id).toBe('dismiss-settings'); // 牌左侧
        // 牌内、可视窗外（窗下缘 218 以下）的空白 = 零命中（不误关、不误点）。
        expect(hitTestMeta('settings', 650, 700), '牌内空白（内容窗右侧余量）= 零命中').toBeNull();
    });

    it('[WXG-T-936] cell 底板 normal 态 = 木面（用户令：选关「关闭」钮同款）；按下态换面', () => {
        const WOOD = { ...PALETTE, woodFace: 'WOOD_FACE', woodFacePressed: 'WOOD_PRESSED' } as BeadsPalette;
        const cellFills = (pressedId?: string) => {
            const { b, calls } = recorder();
            drawSettingsContent(
                b,
                pressedId === undefined ? DATA : { ...DATA, pressed: { id: pressedId } },
                WOOD,
                settingsContentButtons(levelDetailPlate()),
            );
            return calls
                .filter((c) => c.kind === 'rect' && c.args[2] === 509)
                .map((c) => (c.args[4] as { fill?: unknown }).fill);
        };
        const idle = cellFills();
        expect(idle).toHaveLength(10);
        for (const fill of idle) expect(fill).toBe('WOOD_FACE');
        // 有开关的行按下不换整行木面（只有开关压暗）；循环行按下才换面。
        expect(cellFills('toggle-bgm')[0]).toBe('WOOD_FACE');
        expect(cellFills('cycle-bead-style')[6]).toBe('WOOD_PRESSED');
    });

    it('[WXG-T-938] 位图腿：cell 底板 = 厚木 9-slice；图标 / 开关位图就绪才画；缺图回退程序化', () => {
        const blitTexes = (calls: Call[]) => calls.filter((c) => c.kind === 'blit').map((c) => c.args[0] as string);
        const run = (pressedId?: string) => {
            const { b, calls } = recorder();
            drawSettingsContent(
                b,
                pressedId === undefined ? DATA : { ...DATA, pressed: { id: pressedId } },
                PALETTE,
                settingsContentButtons(levelDetailPlate()),
            );
            return calls;
        };

        // 仅底板就绪：10 枚 cell 底板 blit，图标 / 开关不画（无位图 ⇒ 程序化）。
        setMenuBitmapResolver((id) => id === MENU_TEXTURES.btnSettings);
        const bgOnly = run();
        expect(blitTexes(bgOnly)).toEqual(Array(10).fill(MENU_TEXTURES.btnSettings));
        const bgOpts = bgOnly.find((c) => c.kind === 'blit')!.args[5] as { fx?: unknown };
        expect(bgOpts.fx).toEqual({ nineSliceCapX: 70 });
        // 有开关的行按下只压暗开关本身（0.16），整行木面不变。
        expect(run('toggle-bgm').some((c) => c.kind === 'rect' && (c.args[4] as { fill?: unknown }).fill === 'rgba(61,46,30,0.16)')).toBe(true);

        // 全部位图就绪：底板 10 + 图标 4（音乐 / 音效 / 动效 / 震动）+ 开关 8（有 toggle 的 8 行）。
        setMenuBitmapResolver(() => true);
        const all = blitTexes(run());
        expect(all.filter((t) => t === MENU_TEXTURES.btnSettings)).toHaveLength(10);
        expect(all.filter((t) => t === MENU_TEXTURES.settingsIconMusic)).toHaveLength(1);
        expect(all.filter((t) => t === MENU_TEXTURES.settingsIconVibrate)).toHaveLength(1);
        expect(all.filter((t) => t === MENU_TEXTURES.settingsToggleOn || t === MENU_TEXTURES.settingsToggleOff)).toHaveLength(8);

        // 缺图腿（默认 resolver 全 false）⇒ 0 枚位图，程序化木面 + 文字照常。
        setMenuBitmapResolver(undefined);
        const fallback = run();
        expect(blitTexes(fallback)).toHaveLength(0);
        expect(textsOf(fallback)).toHaveLength(17);
    });

    it('文案单源：暂停面板已去设置化，view-model 不再引用 settingsContentLabel', () => {
        const vm = readFileSync(resolve(SRC_ROOT, 'src/view/view-model.ts'), 'utf8');
        expect(vm).not.toContain('settingsContentLabel');
        expect(vm).not.toContain('drawPauseSettingButton');
    });
});
