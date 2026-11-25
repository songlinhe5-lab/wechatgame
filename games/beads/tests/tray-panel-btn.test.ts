import { describe, expect, it } from 'vitest';
import {
    EXPAND_BTN_H,
    EXPAND_BTN_HIT_H,
    TRAY_BAND,
    TRAY_GAP,
    TRAY_PANEL_PAD,
    TRAY_PANEL_BTN_OVERLAP,
    TRAY_SLOT,
    expandButtonLayout,
    trayLayout,
    trayPreviewFits,
} from '../src/config/tuning.js';

// `[WXG-T-1073]` 用户 2026-11-25 令：「扩展按钮应该压住一部分底槽，当从 1 行解锁到 2 行时候，
// 扩展按钮不会压到第二行」。旧几何：面板贴上沿 `TRAY_BAND.yMax`、高度只够槽区 ⇒ 1 行档面板底
// 378 vs 按钮顶 284 留 **94px 空隙**（按钮读作浮在托盘外）；2 行档仍留 40px。
const btnTop = TRAY_BAND.yMin + (EXPAND_BTN_HIT_H - EXPAND_BTN_H) / 2 + EXPAND_BTN_H;

describe('[WXG-T-1073] 托盘面板 ⇄ 扩展按钮邻接', () => {
    it('少行档：面板下沿被按钮压住固定重叠量（⛔ 不再悬空 94 / 40px）', () => {
        for (const rows of [1, 2]) {
            const lay = trayLayout(rows);
            expect(lay.panelBottom, `${rows} 行：面板底须落到按钮顶之下（= 按钮压住面板）`)
                .toBeLessThanOrEqual(btnTop);
            expect(btnTop - lay.panelBottom, `${rows} 行：重叠量 = ${TRAY_PANEL_BTN_OVERLAP}dp`)
                .toBeCloseTo(TRAY_PANEL_BTN_OVERLAP, 1);
        }
    });

    it('[WXG-T-1082] 面板高度只按槽行数（自然高度），靠整体下移贴道具区（⛔ 不再拉高成白板）', () => {
        // 用户 2026-11-25 实帧报「默认底槽太高了，只要满足两行的高度即可……整体槽要贴着下面道具区域」。
        for (const rows of [1, 2, 4]) {
            const lay = trayLayout(rows);
            const natural = rows * (TRAY_SLOT + TRAY_GAP) - TRAY_GAP + TRAY_PANEL_PAD * 2;
            expect(lay.panelH, `${rows} 行：面板高 = 槽行数所需的自然高度`).toBeCloseTo(natural, 1);
        }
        // 少行档：底缘被按钮轻微压住 ⇒ 面板+按钮整体贴住道具区
        for (const rows of [1, 2]) {
            expect(trayLayout(rows).panelBottom, `${rows} 行：下移贴住按钮`)
                .toBeCloseTo(btnTop - TRAY_PANEL_BTN_OVERLAP, 1);
        }
        // 4 行档：自然高度占满整带 ⇒ 底缘即带底（依旧贴道具区），不再额外下移
        const four = trayLayout(4);
        expect(four.panelBottom + four.panelH, '4 行：面板顶贴带顶').toBeCloseTo(TRAY_BAND.yMax, 1);
    });

    it('少行档：末行槽底仍在按钮顶之上（按钮只压面板裙边，⛔ 不压槽）', () => {
        for (const rows of [1, 2]) {
            const lay = trayLayout(rows);
            expect(lay.slotCenterY(rows - 1) - TRAY_SLOT / 2, `${rows} 行：末行槽底须高于按钮顶`)
                .toBeGreaterThan(btnTop);
        }
    });

    it('预览行判据改挂末行槽底后，各档结论与原设计一致（不放松也不收紧）', () => {
        // 原判据 = `trayLayout(rows+1).panelBottom >= btnTop`；面板裙边下延后该式恒假 ⇒ 改挂槽底。
        expect(trayPreviewFits(1), '1 行档留预览（原 true）').toBe(true);
        expect(trayPreviewFits(2), '2 行档不留预览（原 false）').toBe(false);
        expect(trayPreviewFits(3), '3 行档不留预览（原 false）').toBe(false);
    });

    it('按钮视觉框与热区同源（回归：本单不动按钮几何）', () => {
        const btn = expandButtonLayout();
        expect(btn.bottom + btn.h).toBeCloseTo(btnTop, 1);
        expect(btn.hitBottom).toBe(TRAY_BAND.yMin);
    });
});
