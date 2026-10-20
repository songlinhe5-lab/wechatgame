/**
 * UI-31 · PauseModal（ADR-0032 §4 / §12）。
 *
 * 验收原文：「暂停相关现有测试全绿」—— `pause-settings.test.ts`（14 例）与金样本
 * 十一例是主证据；本文件补钉本批新收口的两件：
 *  ① 开合动画改由框架 `ModalLifecycle` 驱动，getter 口径与旧实现逐条对齐
 *     （入场合可点、关合零响应、reset 硬收）；
 *  ② 暂停档设置钮绘制单源（chip 选中木底 / 关态纸底描边 / 按下换面，选择器走纸钮）。
 */
import { describe, it, expect } from 'vitest';
import type { RenderModelBuilder } from '@wxgame/framework';
import { PausePanel } from '../src/systems/pause-panel.js';
import { drawPauseSettingButton, type SettingsContentData } from '../src/view/settings-content.js';
import type { BeadsPalette } from '../src/view/palette.js';
import { PANEL_IN_MS, PANEL_OUT_MS, UI_CONTAINER } from '../src/config/tuning.js';
import { UI_FONT } from '../src/view/ui-theme.js';

const PALETTE = {
    panel: '#111111',
    panelBorder: '#222222',
    text: '#333333',
    textDim: '#444444',
    woodFace: '#555555',
    woodFacePressed: '#666666',
    woodText: '#777777',
    cardPressed: '#888888',
} as unknown as BeadsPalette;

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

interface Call {
    kind: 'rect' | 'text' | 'line';
    args: unknown[];
}

function callsOf(fn: (b: RenderModelBuilder) => void): Call[] {
    const calls: Call[] = [];
    const b = {
        rect: (...args: unknown[]) => calls.push({ kind: 'rect', args }),
        text: (...args: unknown[]) => calls.push({ kind: 'text', args }),
        line: (...args: unknown[]) => calls.push({ kind: 'line', args }),
        setBackground: () => undefined,
        blit: () => undefined,
    } as unknown as RenderModelBuilder;
    fn(b);
    return calls;
}

function rectOptions(call: Call): Record<string, unknown> {
    return call.args[4] as Record<string, unknown>;
}

describe('UI-31 · PauseModal', () => {
    it('开合动画由 ModalLifecycle 驱动：入场合可点，关合即零响应', () => {
        const panel = new PausePanel();
        expect(panel.visible).toBe(false);
        expect(panel.progress).toBe(0);

        panel.open();
        expect(panel.visible).toBe(true);
        expect(panel.interactive).toBe(true); // 旧口径：入场帧起即可点
        expect(panel.progress).toBe(0);
        panel.update(PANEL_IN_MS / 2);
        expect(panel.progress).toBeCloseTo(0.5);
        panel.update(PANEL_IN_MS);
        expect(panel.progress).toBe(1);

        panel.close();
        expect(panel.interactive).toBe(false); // 关合期零响应（§8-1）
        expect(panel.durationMs).toBe(PANEL_OUT_MS);
        panel.update(PANEL_OUT_MS);
        expect(panel.visible).toBe(false);
        expect(panel.progress).toBe(0);
    });

    it('reset 立即收起（关合中途也生效）', () => {
        const panel = new PausePanel();
        panel.open();
        panel.update(PANEL_IN_MS);
        panel.close();
        panel.update(1);
        expect(panel.visible).toBe(true);
        panel.reset();
        expect(panel.visible).toBe(false);
        expect(panel.progress).toBe(0);
    });

    it('开关 chip：开 = 木底白字，关 = 纸底描边，按下换 pressed 面', () => {
        const on = callsOf((b) =>
            drawPauseSettingButton(b, DATA, PALETTE, 'toggle-bgm', 10, 20, 160, 88, false),
        );
        expect(rectOptions(on[0]!).fill).toBe(PALETTE.woodFace);
        expect(rectOptions(on[0]!).radius).toBe(UI_CONTAINER.radiusChip);
        expect((on[1]!.args[3] as { fill: string }).fill).toBe(PALETTE.woodText);

        const off = callsOf((b) =>
            drawPauseSettingButton(b, { ...DATA, bgmMuted: true }, PALETTE, 'toggle-bgm', 10, 20, 160, 88, false),
        );
        expect(rectOptions(off[0]!).fill).toBe(PALETTE.panel);
        expect(rectOptions(off[0]!).stroke).toBe(PALETTE.panelBorder);

        const pressed = callsOf((b) =>
            drawPauseSettingButton(b, { ...DATA, bgmMuted: true }, PALETTE, 'toggle-bgm', 10, 20, 160, 88, true),
        );
        expect(rectOptions(pressed[0]!).fill).toBe(PALETTE.cardPressed);
        expect((pressed[0]!.args[1] as number)).toBeLessThan(20); // y-up 下沉
    });

    it('选择器走纸钮档，文案与小字档同源', () => {
        const calls = callsOf((b) =>
            drawPauseSettingButton(b, DATA, PALETTE, 'cycle-bead-style', 10, 20, 160, 88, false),
        );
        expect(rectOptions(calls[0]!).fill).toBe(PALETTE.panel);
        expect(rectOptions(calls[0]!).stroke).toBe(PALETTE.panelBorder);
        expect(rectOptions(calls[0]!).radius).toBe(UI_CONTAINER.radiusCard);
        expect(calls[1]!.args[2] as string).toContain('珠子风格');
        expect((calls[1]!.args[3] as { font: string }).font).toBe(UI_FONT.panelToggle);
    });
});
