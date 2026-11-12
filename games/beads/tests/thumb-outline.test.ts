/**
 * `[WXG-T-925]` 珠面「贴纸裁切」外轮廓（art 裁定：`palette.panel` 单层实线、
 * `W=clamp(round(pitch×0.18),2,6)`、凹角折角 `R=clamp(round(pitch×0.22),2,6)`）。
 *
 * 判据只钉子工程可证面：形状数量 / 颜色同源 / 只落剪影外侧（不越界）/
 * 详情页腿带轮廓、其余缩略腿零变化。
 */
import { describe, expect, it } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsLevelRaw } from '../src/config/levels-data.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { drawBeadFace } from '../src/view/menu-signage.js';
import { drawThumbOutline, thumbOutlineRadius, thumbOutlineWidth } from '../src/view/bead-outline.js';

const stub = (pattern: readonly string[], cols: number): BeadsLevelRaw =>
    ({ pattern, cols } as unknown as BeadsLevelRaw);

const outline = (level: BeadsLevelRaw, left = 100, top = 500, pitch = 20) => {
    const b = new RenderModelBuilder(750, 1334);
    b.begin();
    drawThumbOutline(b, level, left, top, pitch, DEFAULT_PALETTE.panel);
    return b.end().commands as readonly {
        kind: string; fill?: string; x?: number; y?: number; w?: number; h?: number;
    }[];
};

describe('WXG-T-925 珠面贴纸轮廓', () => {
    it('公式：线宽 / 折角圆角按 art 裁定取值并钳在 2–6', () => {
        expect(thumbOutlineWidth(28.33)).toBe(5);
        expect(thumbOutlineWidth(11.33)).toBe(2);
        expect(thumbOutlineWidth(100)).toBe(6);
        expect(thumbOutlineRadius(28.33)).toBe(6);
        expect(thumbOutlineRadius(11.33)).toBe(2);
        expect(thumbOutlineRadius(100)).toBe(6);
    });

    it('单格剪影：4 个凸角圆盘 + 4 条直边，无凹角环', () => {
        const cmds = outline(stub(['X'], 1));
        const polys = cmds.filter((c) => c.kind === 'polygon');
        const rects = cmds.filter((c) => c.kind === 'rect');
        expect(polys).toHaveLength(4);
        expect(rects).toHaveLength(4);
        expect(cmds.every((c) => c.fill === DEFAULT_PALETTE.panel)).toBe(true);
    });

    it('L 形剪影：凹角折叠出一段圆环多边形（折角可见圆角 > 0），直边让出折角段', () => {
        const pitch = 20;
        const cmds = outline(stub(['XX', 'X.'], 2), 100, 500, pitch);
        const polys = cmds.filter((c) => c.kind === 'polygon');
        // 5 凸角 + 1 凹角
        expect(polys).toHaveLength(6);
        // 凹角环 = 内弧 7 点 + 外弧 7 点 = 14 点（凸角扇形 = 1 圆心 + 7 弧点 = 8 点）
        const pts = polys.map((p) => (p as unknown as { count: number }).count);
        expect(pts.filter((n) => n === 14)).toHaveLength(1);
        expect(pts.filter((n) => n === 8)).toHaveLength(5);
    });

    it('只落剪影外侧：所有形状不越过「剪影 ± 线宽」的包络（不侵入珠面）', () => {
        const pitch = 20;
        const W = thumbOutlineWidth(pitch);
        const left = 100;
        const top = 500;
        const cmds = outline(stub(['XX', 'X.'], 2), left, top, pitch);
        for (const c of cmds) {
            if (c.kind === 'rect') {
                expect(c.x!).toBeGreaterThanOrEqual(left - W - 0.01);
                expect(c.x! + c.w!).toBeLessThanOrEqual(left + 2 * pitch + W + 0.01);
                expect(c.y!).toBeGreaterThanOrEqual(top - 2 * pitch - W - 0.01);
                expect(c.y! + c.h!).toBeLessThanOrEqual(top + W + 0.01);
            }
        }
    });

    it('详情页腿启用、其余缩略腿零变化：轮廓命令只在 outline=true 时出现且画在珠面之前', () => {
        const build = (withOutline: boolean) => {
            const b = new RenderModelBuilder(750, 1334);
            b.begin();
            drawBeadFace(b, LEVELS[0]!, 200, 400, 360, 340, DEFAULT_PALETTE, undefined, undefined, undefined, 'bottom', withOutline);
            return b.end().commands as readonly { fill?: string }[];
        };
        const plain = build(false);
        const withOutline = build(true);
        expect(withOutline.length).toBeGreaterThan(plain.length);
        expect(plain[0]!.fill).not.toBe(DEFAULT_PALETTE.panel);
        expect(withOutline[0]!.fill).toBe(DEFAULT_PALETTE.panel);
    });
});
