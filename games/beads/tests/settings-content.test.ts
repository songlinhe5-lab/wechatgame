/**
 * UI-30 · SettingsContent / SettingsModal 内容块（ADR-0032 §4）。
 *
 * 验收原文：「金样本对拍；全部动作可达」。
 *  - 金样本：`ui-golden.test.ts` 设置态逐字对拍（本批重构零差异）；
 *  - 本文件钉住：11 钮 6×2 几何、**每个按钮中心都能命中自己**、档位文案、
 *    按下位移，以及「设置文案单源 = 菜单 settings overlay」（静态门）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderModelBuilder } from '@wxgame/framework';
import { hitTestMeta, metaLayout } from '../src/view/meta-view.js';
import { levelDetailPlate } from '../src/view/meta-layout.js';
import {
    drawSettingsContent,
    isSettingsAction,
    settingsContentButtons,
    settingsContentHeight,
    settingsContentLabel,
    settingsContentViewport,
    settingsScrollMax,
    type SettingsAction,
    type SettingsContentData,
} from '../src/view/settings-content.js';
import type { BeadsPalette } from '../src/view/palette.js';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PALETTE = { text: '#222222' } as unknown as BeadsPalette;

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

function callsOf(fn: (b: RenderModelBuilder) => void): { kind: string; args: number[]; text?: string }[] {
    const calls: { kind: string; args: number[]; text?: string }[] = [];
    const b = {
        rect: (...args: number[]) => calls.push({ kind: 'rect', args }),
        text: (...args: unknown[]) =>
            calls.push({ kind: 'text', args: args.slice(0, 2) as number[], text: args[2] as string }),
        line: (...args: number[]) => calls.push({ kind: 'line', args }),
        setBackground: () => undefined,
        blit: () => undefined,
    } as unknown as RenderModelBuilder;
    fn(b);
    return calls;
}

describe('UI-30 · SettingsContent', () => {
    it('菜单版式：11 钮 = 6 行 × 2 列（末行 Debug 单钮左对齐）', () => {
        const buttons = settingsContentButtons(levelDetailPlate());
        expect(buttons).toHaveLength(11);
        expect(buttons.map((b) => b.id)).toEqual([
            'toggle-bgm',
            'toggle-sfx',
            'toggle-reduce-motion',
            'toggle-large-text',
            'toggle-vibrate',
            'toggle-debug-info',
            'cycle-bead-style',
            'cycle-bead-size',
            'toggle-ghost-symbol',
            'cycle-skin',
            'toggle-debug-guides',
        ]);
        // `[WXG-T-935]` 木牌 581×1044 @ (89,124)：x = 89+40、首行上缘 = 板顶 −220
        // ⇒ 首钮 y = 124+1044−220−88 = 860；列宽 = (581−80−24)/2 = 238.5。
        expect(buttons[0]!.box).toEqual({ x: 129, y: 860, w: 238.5, h: 88 });
        expect(buttons[1]!.box.x).toBe(391.5);
        // 末钮（Debug）：row 5 ⇒ y = 860 − 5×(88+12) = 360，单钮左对齐。
        expect(buttons[10]!.box).toEqual({ x: 129, y: 360, w: 238.5, h: 88 });
    });

    it('[WXG-T-935] 可视窗 / 滚动量：6 行实高 588 < 窗高 662 ⇒ 当前不滚；命中随滚量换算', () => {
        const plate = levelDetailPlate();
        expect(settingsContentViewport(plate)).toEqual({ x: 129, y: 286, w: 501, h: 662 });
        expect(settingsContentHeight()).toBe(588);
        expect(settingsScrollMax(plate)).toBe(0);

        // 同一屏幕点：未滚 = 第 3 行（y 660..748，`toggle-vibrate`）；滚 100 后内容上移
        // ⇒ 该点换算回内容坐标 804 = 第 2 行（y 760..848，`toggle-reduce-motion`）。
        const x = 129 + 50;
        expect(hitTestMeta('settings', x, 704)?.id).toBe('toggle-vibrate');
        expect(hitTestMeta('settings', x, 704, undefined, 100)?.id).toBe('toggle-reduce-motion');
        // 窗外（可视窗下缘 286 以下）= 不命中内容；返回钮在 x∈[314,554] ⇒ x=179 落空。
        expect(hitTestMeta('settings', 179, 250)).toBeNull();
    });

    it('全部动作可达：每个按钮中心命中自己', () => {
        const layout = metaLayout('settings');
        for (const b of layout.buttons) {
            const hit = hitTestMeta('settings', b.box.x + b.box.w / 2, b.box.y + b.box.h / 2);
            expect(hit?.id).toBe(b.id);
        }
        // 设置动作全集都在命中表里（11 钮）。
        const ids = layout.buttons.map((b) => b.id);
        for (const id of [
            'toggle-bgm',
            'toggle-sfx',
            'toggle-reduce-motion',
            'toggle-large-text',
            'toggle-vibrate',
            'toggle-debug-info',
            'cycle-bead-style',
            'cycle-bead-size',
            'toggle-ghost-symbol',
            'cycle-skin',
            'toggle-debug-guides',
        ] as SettingsAction[]) {
            expect(ids).toContain(id);
        }
    });

    it('档位文案：开关两态 + 选择器读注册名', () => {
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

    it('绘制只画设置动作；按下态整体下沉', () => {
        const buttons = settingsContentButtons(levelDetailPlate());
        const chrome = [...buttons, { id: 'back', box: { x: 420, y: 307, w: 240, h: 88 } }];
        const idle = callsOf((b) => drawSettingsContent(b, DATA, PALETTE, chrome));
        const pressed = callsOf((b) =>
            drawSettingsContent(b, { ...DATA, pressed: { id: 'toggle-bgm' } }, PALETTE, chrome),
        );
        // 每个内容钮 = 1 rect + 1 text；返回钮不归内容块 ⇒ 共 11 组。
        expect(idle.filter((c) => c.kind === 'text')).toHaveLength(11);
        expect(idle.filter((c) => c.kind === 'rect')).toHaveLength(11);
        // 首钮按下：rect y 变小（y-up 坐标下沉）。
        const idleY = idle.find((c) => c.kind === 'rect')!.args[1]!;
        const pressedY = pressed.find((c) => c.kind === 'rect')!.args[1]!;
        expect(pressedY).toBeLessThan(idleY);
    });

    it('动作全集 ≡ 弹窗排布（WXG-T-365 回归钉：装扮馆入口已上提顶栏 ⇒ ⛔ 不再是设置动作）', () => {
        expect(isSettingsAction('cycle-skin')).toBe(true);
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
        expect(hitTestMeta('settings', 650, 700), '牌内空白（内容窗右侧余量）= 零命中').toBeNull();
    });

    it('[WXG-T-936] 内容钮 normal 态 = 木钮（用户令：选关「关闭」钮同款）', () => {
        const WOOD = {
            woodFace: 'WOOD_FACE',
            woodFacePressed: 'WOOD_PRESSED',
            woodSheen: 'SHEEN',
            woodEdge: 'WOOD_EDGE',
            woodText: 'WOOD_TEXT',
        } as unknown as BeadsPalette;
        const fills: unknown[] = [];
        const b = {
            rect: (...args: unknown[]) => fills.push((args[4] as { fill?: unknown } | undefined)?.fill),
            text: () => undefined,
            line: () => undefined,
            setBackground: () => undefined,
            blit: () => undefined,
        } as unknown as RenderModelBuilder;
        drawSettingsContent(b, DATA, WOOD, settingsContentButtons(levelDetailPlate()));
        expect(fills).toHaveLength(11);
        for (const fill of fills) expect(fill).toBe('WOOD_FACE');
        // 按下态换面（woodFacePressed）。
        const pressedFills: unknown[] = [];
        const bp = {
            rect: (...args: unknown[]) => pressedFills.push((args[4] as { fill?: unknown } | undefined)?.fill),
            text: () => undefined,
            line: () => undefined,
            setBackground: () => undefined,
            blit: () => undefined,
        } as unknown as RenderModelBuilder;
        drawSettingsContent(bp, { ...DATA, pressed: { id: 'toggle-bgm' } }, WOOD, settingsContentButtons(levelDetailPlate()));
        expect(pressedFills[0]).toBe('WOOD_PRESSED');
    });

    it('文案单源：暂停面板已去设置化，view-model 不再引用 settingsContentLabel', () => {
        const vm = readFileSync(resolve(SRC_ROOT, 'src/view/view-model.ts'), 'utf8');
        expect(vm).not.toContain('settingsContentLabel');
        expect(vm).not.toContain('drawPauseSettingButton');
    });
});
