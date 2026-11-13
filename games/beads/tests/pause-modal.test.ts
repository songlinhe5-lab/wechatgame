/**
 * UI-31 · PauseModal（ADR-0032 §4 / §12）。
 *
 * 验收：
 *  ① 开合动画由框架 `ModalLifecycle` 驱动，getter 口径与旧实现逐条对齐；
 *  ② v1.8（WXG-T-934）暂停面板收敛为三钮（继续 / 重玩本关 / 回主菜单），零设置项。
 */
import { describe, it, expect } from 'vitest';
import { PausePanel, pausePanelLayout } from '../src/systems/pause-panel.js';
import { PANEL_IN_MS, PANEL_OUT_MS, PAUSE_PANEL_H } from '../src/config/tuning.js';

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

    it('v1.8 三钮布局：只有继续 / 重玩本关 / 回主菜单，零设置项', () => {
        for (const mode of ['normal', 'sprint'] as const) {
            const layout = pausePanelLayout(mode);
            expect(layout.panel.yMax - layout.panel.yMin).toBe(PAUSE_PANEL_H);
            expect(layout.buttons.map((b) => b.id)).toEqual(['resume', 'restart', 'go-menu']);
        }
    });
});
