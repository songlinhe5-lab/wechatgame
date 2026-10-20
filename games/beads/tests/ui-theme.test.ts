/**
 * **UI-20：`ui-theme` 收拢面**（WXG-T-299）
 * ─────────────────────────────────────────────────────────────────────────────
 * 整帧漂移由 `ui-golden.test.ts` 守（十态 sha）；本文件只钉**两种遮罩 × 双档 α** 的
 * 逐字输出与按下位移分支 —— 改坏常量时失败信息能直指是哪一档，不必先解整帧差分。
 */
import { describe, expect, it } from 'vitest';
import {
    PANEL_SCRIM_ALPHA,
    SETTINGS_SCRIM_ALPHA,
    UI_PRESS_SINK,
} from '../src/config/tuning.js';
import { UI_FONT, UI_SCRIM, pressOffset, scrimFill } from '../src/view/ui-theme.js';

describe('ui-theme', () => {
    it('遮罩两族 × 双档：逐字保持收拢前输出', () => {
        // 画布侧 = PANEL_SCRIM_RGB（42,46,67）；overlay 侧 = 历史硬编黑（0,0,0）。
        expect(scrimFill(UI_SCRIM.canvas, UI_SCRIM.alpha)).toBe('rgba(42,46,67,0.5)');
        expect(scrimFill(UI_SCRIM.canvas, UI_SCRIM.settingsAlpha)).toBe('rgba(42,46,67,0.3)');
        expect(scrimFill(UI_SCRIM.overlay, UI_SCRIM.alpha)).toBe('rgba(0,0,0,0.5)');
        expect(scrimFill(UI_SCRIM.overlay, UI_SCRIM.settingsAlpha)).toBe('rgba(0,0,0,0.3)');
    });

    it('双档名保留：α 仍指向 tuning 在册值', () => {
        expect(UI_SCRIM.alpha).toBe(PANEL_SCRIM_ALPHA);
        expect(UI_SCRIM.settingsAlpha).toBe(SETTINGS_SCRIM_ALPHA);
    });

    it('按下位移：按下 = -sink；reduceMotion / 未按下 = 0', () => {
        expect(pressOffset(true, false)).toBe(-UI_PRESS_SINK);
        expect(pressOffset(true, true)).toBe(0);
        expect(pressOffset(false, false)).toBe(0);
    });

    it('按钮字体两族字重不互换（菜单 30 / 对局面板 30 bold）', () => {
        expect(UI_FONT.button).toBe('30px sans-serif');
        expect(UI_FONT.panelButton).toBe('bold 30px sans-serif');
    });
});
