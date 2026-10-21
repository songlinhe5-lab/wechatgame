/**
 * UI-30 · SettingsContent / SettingsModal 内容块（ADR-0032 §4）。
 *
 * 验收原文：「金样本对拍；全部动作可达」。
 *  - 金样本：`ui-golden.test.ts` 设置态逐字对拍（本批重构零差异）；
 *  - 本文件钉住：10 钮 5×2 几何、**每个按钮中心都能命中自己**、档位文案、
 *    按下位移，以及「暂停面板与设置弹窗文案单源」（静态门）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderModelBuilder } from '@wxgame/framework';
import { hitTestMeta, metaLayout } from '../src/view/meta-view.js';
import {
    drawSettingsContent,
    settingsContentButtons,
    settingsContentLabel,
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
    it('菜单版式：10 钮 = 5 行 × 2 列，几何沿用旧口径', () => {
        const buttons = settingsContentButtons({ x: 240, y: 307, w: 600, h: 720 });
        expect(buttons).toHaveLength(10);
        expect(buttons.map((b) => b.id)).toEqual([
            'toggle-bgm',
            'toggle-sfx',
            'toggle-reduce-motion',
            'toggle-large-text',
            'toggle-vibrate',
            'toggle-debug-info',
            'cycle-bead-style',
            'cycle-bead-size',
            'cycle-skin',
            'toggle-debug-guides',
        ]);
        // 首钮：x = 240+40、topY = 307+720−170（WXG-T-339）；第二钮右移 colW(248)+gap(24)。
        expect(buttons[0]!.box).toEqual({ x: 280, y: 857, w: 248, h: 88 });
        expect(buttons[1]!.box.x).toBe(552);
        // 末钮：row 4 ⇒ y = 857 − 4×(88+12) = 457。
        expect(buttons[9]!.box).toEqual({ x: 552, y: 457, w: 248, h: 88 });
    });

    it('全部动作可达：每个按钮中心命中自己', () => {
        const layout = metaLayout('settings');
        for (const b of layout.buttons) {
            const hit = hitTestMeta('settings', b.box.x + b.box.w / 2, b.box.y + b.box.h / 2);
            expect(hit?.id).toBe(b.id);
        }
        // 设置动作全集都在命中表里（10 钮）。
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
        expect(settingsContentLabel('cycle-bead-style', DATA)).toContain('珠子风格');
        expect(settingsContentLabel('cycle-bead-size', DATA)).toContain('豆子尺寸');
        expect(settingsContentLabel('cycle-skin', DATA)).toContain('皮肤');
        expect(settingsContentLabel('toggle-debug-guides', DATA)).toBe('Debug  关');
    });

    it('绘制只画设置动作；按下态整体下沉', () => {
        const buttons = settingsContentButtons({ x: 240, y: 307, w: 600, h: 720 });
        const chrome = [...buttons, { id: 'back', box: { x: 420, y: 357, w: 240, h: 88 } }];
        const idle = callsOf((b) => drawSettingsContent(b, DATA, PALETTE, chrome));
        const pressed = callsOf((b) =>
            drawSettingsContent(b, { ...DATA, pressed: { id: 'toggle-bgm' } }, PALETTE, chrome),
        );
        // 每个内容钮 = 1 rect + 1 text；返回钮不归内容块 ⇒ 共 10 组。
        expect(idle.filter((c) => c.kind === 'text')).toHaveLength(10);
        expect(idle.filter((c) => c.kind === 'rect')).toHaveLength(10);
        // 首钮按下：rect y 变小（y-up 坐标下沉）。
        const idleY = idle.find((c) => c.kind === 'rect')!.args[1]!;
        const pressedY = pressed.find((c) => c.kind === 'rect')!.args[1]!;
        expect(pressedY).toBeLessThan(idleY);
    });

    it('文案单源：暂停面板改读 settingsContentLabel，不再自带设置项字面', () => {
        const vm = readFileSync(resolve(SRC_ROOT, 'src/view/view-model.ts'), 'utf8');
        expect(vm).toContain('settingsContentLabel(button.id, snap)');
        expect(vm).not.toContain('珠子风格  ${');
        expect(vm).not.toContain('豆子尺寸  ${');
        expect(vm).not.toContain('皮肤  ${');
    });
});
