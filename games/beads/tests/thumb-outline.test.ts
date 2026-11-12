/**
 * `[WXG-T-925 / T-926 / T-927]` 珠面「贴纸裁切」外轮廓（art 二裁：`palette.shadowInk` 暖可可黑、
 * 单层实线；T-927 用户三调后 `W=clamp(round(pitch×0.10),1,4)`、折角 `R=clamp(round(pitch×0.30),2,9)`）。
 *
 * 口径（用户 2026-11-12）：「线条需要连续、紧贴珠面边缘；各种珠面展示都需要加，
 * 跟珠面等比例缩放」⇒ 轮廓 = **每颗边界珠**的「珠面外扩 W」圆角方块（同色并集），
 * 内缘贴底块 / 锁定珠外缘，⛔ 不再按格边留缝；T-927 起对局盘面同用（占位取快照 `void`）。
 */
import { describe, expect, it } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsLevelRaw } from '../src/config/levels-data.js';
import type { BeadsSnapshot } from '../src/game/state.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { drawBeadFace } from '../src/view/menu-signage.js';
import { drawBoardOutline, drawThumbOutline, thumbOutlineRadius, thumbOutlineWidth } from '../src/view/bead-outline.js';

const stub = (pattern: readonly string[], cols: number): BeadsLevelRaw =>
    ({ pattern, cols } as unknown as BeadsLevelRaw);

const outline = (level: BeadsLevelRaw, left = 100, top = 500, pitch = 20) => {
    const b = new RenderModelBuilder(750, 1334);
    b.begin();
    drawThumbOutline(b, level, left, top, pitch, 16, DEFAULT_PALETTE.shadowInk);
    return b.end().commands as readonly {
        kind: string; fill?: string; offset?: number; count?: number;
    }[];
};

describe('WXG-T-925/926 珠面贴纸轮廓', () => {
    it('公式：线宽收窄到 1–4、折角圆角放大到 2–9（T-927 用户三调）', () => {
        expect(thumbOutlineWidth(28.33)).toBe(3);
        expect(thumbOutlineWidth(11.33)).toBe(1);
        expect(thumbOutlineWidth(100)).toBe(4);
        expect(thumbOutlineRadius(28.33)).toBe(8);
        expect(thumbOutlineRadius(11.33)).toBe(3);
        expect(thumbOutlineRadius(100)).toBe(9);
    });

    it('单格剪影：1 颗边界珠 = 1 枚圆角方块（20 点），颜色 = shadowInk', () => {
        const cmds = outline(stub(['X'], 1));
        expect(cmds).toHaveLength(1);
        expect(cmds[0]!.kind).toBe('polygon');
        expect(cmds[0]!.count).toBe(20);
        expect(cmds[0]!.fill).toBe(DEFAULT_PALETTE.shadowInk);
    });

    it('整块 2×2：四颗都是边界珠 ⇒ 4 枚同色轮廓（并集无叠 α）', () => {
        const cmds = outline(stub(['XX', 'XX'], 2));
        expect(cmds).toHaveLength(4);
        expect(cmds.every((c) => c.fill === DEFAULT_PALETTE.shadowInk)).toBe(true);
    });

    it('L 形：3 颗边界珠各出一枚（折叠由圆角自然过渡）', () => {
        const cmds = outline(stub(['XX', 'X.'], 2));
        expect(cmds).toHaveLength(3);
    });

    it('贴边不越界：轮廓只落在「剪影 ± 线宽」包络内（不脱离珠面）', () => {
        const pitch = 20;
        const W = thumbOutlineWidth(pitch);
        const left = 100;
        const top = 500;
        const b = new RenderModelBuilder(750, 1334);
        b.begin();
        drawThumbOutline(b, stub(['XX', 'X.'], 2), left, top, pitch, 16, DEFAULT_PALETTE.shadowInk);
        const model = b.end();
        for (const c of model.commands) {
            if (c.kind !== 'polygon') continue;
            const pts = model.vertices.subarray(c.offset, c.offset + c.count * 2);
            for (let i = 0; i < pts.length; i += 2) {
                expect(pts[i]!).toBeGreaterThanOrEqual(left - W - 1);
                expect(pts[i]!).toBeLessThanOrEqual(left + 2 * pitch + W + 1);
                expect(pts[i + 1]!).toBeGreaterThanOrEqual(top - 2 * pitch - W - 1);
                expect(pts[i + 1]!).toBeLessThanOrEqual(top + W + 1);
            }
        }
    });

    it('各种珠面展示统一启用：drawBeadFace 首条命令即轮廓（先轮廓、后珠面）', () => {
        const b = new RenderModelBuilder(750, 1334);
        b.begin();
        drawBeadFace(b, LEVELS[0]!, 200, 400, 360, 340, DEFAULT_PALETTE, undefined, undefined, undefined, 'bottom');
        const cmds = b.end().commands as readonly { kind: string; fill?: string }[];
        expect(cmds[0]!.kind).toBe('polygon');
        expect(cmds[0]!.fill).toBe(DEFAULT_PALETTE.shadowInk);
        expect(cmds.some((c) => c.kind === 'polygon' && c.fill === DEFAULT_PALETTE.shadowInk)).toBe(true);
    });

    it('对局盘面（T-927）：快照 `void` 作占位，仅边界格出形状', () => {
        const snap = {
            cells: [
                { state: 'filled', colorIdx: 1, beadColorIdx: 1, void: false },
                { state: 'empty', colorIdx: 2, beadColorIdx: 0, void: false },
                { state: 'locked', colorIdx: 0, beadColorIdx: 0, void: false },
                { state: 'empty', colorIdx: 0, beadColorIdx: 0, void: true },
            ],
            gridRows: 2,
            gridCols: 2,
            gridLeft: 100,
            gridTop: 500,
            gridCell: 30,
            gridPitch: 32,
            levelId: 'stub',
            levelIndex: 0,
            stageIndex: 0,
        } as unknown as BeadsSnapshot;
        const b = new RenderModelBuilder(750, 1334);
        b.begin();
        drawBoardOutline(b, snap, DEFAULT_PALETTE.shadowInk);
        const cmds = b.end().commands as readonly { kind: string; fill?: string; count?: number }[];
        expect(cmds).toHaveLength(3);
        expect(cmds.every((c) => c.kind === 'polygon' && c.fill === DEFAULT_PALETTE.shadowInk)).toBe(true);
        expect(cmds[0]!.count).toBe(20);
    });
});
