/**
 * `[WXG-T-925 / T-926 / T-927 / T-929 / T-930]` 珠面「贴纸裁切」外轮廓（art 二裁：`palette.shadowInk` 暖可可黑、
 * 单层实线；T-930 起 **1:1（`BEAD_PITCH=32`）锚定 `W=3`、`R=9`，其余尺寸严格 × `pitch/32` 等比、不钳位**）。
 *
 * 口径（用户 2026-11-12）：「线条需要连续、紧贴珠面边缘；各种珠面展示都需要加，
 * 跟珠面等比例缩放」⇒ 轮廓 = **骑在剪影边线上的一条带**（半宽 `W/2` 内外各半），
 * 逐边界珠只画露空边 + 凸角 1/4 环带，⛔ 不再填满整颗边界珠（T-929 用户反馈：
 * 填色盖到珠面上会把一圈珠子涂黑）；T-927 起对局盘面同用（占位取快照 `void`）。
 */
import { describe, expect, it } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsLevelRaw } from '../src/config/levels-data.js';
import type { BeadsSnapshot } from '../src/game/state.js';
import { LEVELS } from '../src/config/levels.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { drawBeadFace } from '../src/view/menu-signage.js';
import { boardOutlineWidth, drawBoardOutline, drawThumbOutline, thumbOutlineRadius, thumbOutlineWidth } from '../src/view/bead-outline.js';

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
    it('公式：1:1（pitch = BEAD_PITCH 32）W=4 / R=W=4，其余尺寸严格线性等比、不钳位（T-930 / T-933）', () => {
        expect(thumbOutlineWidth(32)).toBeCloseTo(4, 6);
        expect(thumbOutlineRadius(32)).toBeCloseTo(4, 6); // T-933: R ≡ W
        expect(thumbOutlineWidth(64)).toBeCloseTo(8, 6); // 2× 缩放 ⇒ 线宽同步 2×
        expect(thumbOutlineWidth(16)).toBeCloseTo(2, 6); // 0.5× 缩放 ⇒ 线宽同步 0.5×
        expect(thumbOutlineRadius(64)).toBeCloseTo(8, 6);
        expect(thumbOutlineRadius(16)).toBeCloseTo(2, 6);
        expect(thumbOutlineWidth(28.33)).toBeCloseTo((4 * 28.33) / 32, 6);
        expect(thumbOutlineRadius(28.33)).toBeCloseTo((4 * 28.33) / 32, 6); // R 恒等于 W
    });

    it('盘面与缩略共享同一条纯等比通道（[用户 2026-11-12] 令「描边跟珠面一起等比例缩放」；T-932 基准 4）', () => {
        // ⛔ 不再做 Math.max 下限钳位（T-931 下限破坏了等比，2026-11-12 用户推翻）
        expect(boardOutlineWidth(32)).toBeCloseTo(4, 6);   // 1:1 基准（T-932 3→4）
        expect(boardOutlineWidth(16)).toBeCloseTo(2, 6);   // 0.5× 同步缩
        expect(boardOutlineWidth(64)).toBeCloseTo(8, 6);   // 2× 同步放大
        expect(thumbOutlineWidth(16)).toBeCloseTo(2, 6);
        expect(boardOutlineWidth(16)).toBeCloseTo(thumbOutlineWidth(16), 6); // 两函数恒等
    });

    it('直边相接：相邻占用格的上边带接缝无缝（end 函数让各段延伸到本格面缘 f2）', () => {
        // 用 3 个 adjacent filled 格，取**中间格**（两侧都被占用）的上边带：
        // 左右格占用 ⇒ expW=false, expE=false ⇒ end(false,false) = f2
        // 总宽 = f2 + f2 = tileFace = pitch + 2×TILE_BLEED = 33
        const b = new RenderModelBuilder(750, 1334);
        b.begin();
        drawBoardOutline(
            b,
            {
                cells: [
                    { state: 'filled', colorIdx: 1, beadColorIdx: 1, void: false },
                    { state: 'filled', colorIdx: 1, beadColorIdx: 1, void: false },
                    { state: 'filled', colorIdx: 1, beadColorIdx: 1, void: false },
                ],
                gridRows: 1,
                gridCols: 3,
                gridLeft: 100,
                gridTop: 500,
                gridCell: 30,
                gridPitch: 32,
                levelId: 'seam',
                levelIndex: 0,
                stageIndex: 0,
            } as unknown as BeadsSnapshot,
            DEFAULT_PALETTE.shadowInk,
        );
        const model = b.end();
        // 命令序：每格先上带下带再侧带再凸角环带（逐格扫描 row0 col0→col1→col2）
        // 中间格(0,1)两侧被占用 ⇒ 只有上下两条带（无侧带、无凸角）
        // 前格(0,0)占 [0]上, [1]下, [2]左带, [3]cvNW环, [4]cvSW环
        // 中间格(0,1)占 [5]上, [6]下
        // 所以中间格上边带 = commands[5]
        const cMid = model.commands[5] as unknown as { offset: number; count: number };
        let minX = Infinity;
        let maxX = -Infinity;
        for (let i = 0; i < cMid.count; i++) {
            const x = model.vertices[cMid.offset + i * 2]!;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
        }
        expect(maxX - minX).toBeCloseTo(33, 6); // face = pitch + 2×TILE_BLEED
    });

    it('单格剪影：4 条露空边带（4 点）+ 4 枚凸角环带（10 点），颜色 = shadowInk', () => {
        const cmds = outline(stub(['X'], 1));
        expect(cmds).toHaveLength(8);
        expect(cmds[0]!.kind).toBe('polygon');
        expect(cmds[0]!.count).toBe(4);
        expect(cmds[4]!.count).toBe(10);
        expect(cmds[0]!.fill).toBe(DEFAULT_PALETTE.shadowInk);
    });

    it('整块 2×2：外圈 8 条边带 + 4 凸角环带（内部无露边）', () => {
        const cmds = outline(stub(['XX', 'XX'], 2));
        expect(cmds).toHaveLength(12);
        expect(cmds.every((c) => c.fill === DEFAULT_PALETTE.shadowInk)).toBe(true);
    });

    it('L 形：8 条露空边带 + 5 枚凸角环带（凹角不圆）', () => {
        const cmds = outline(stub(['XX', 'X.'], 2));
        expect(cmds).toHaveLength(13);
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

    it('各种珠面展示统一启用：drawBeadFace 末条命令即轮廓（T-928 盖在珠面上面）', () => {
        const b = new RenderModelBuilder(750, 1334);
        b.begin();
        drawBeadFace(b, LEVELS[0]!, 200, 400, 360, 340, DEFAULT_PALETTE, undefined, undefined, undefined, 'bottom');
        const cmds = b.end().commands as readonly { kind: string; fill?: string }[];
        const last = cmds[cmds.length - 1]!;
        expect(last.kind).toBe('polygon');
        expect(last.fill).toBe(DEFAULT_PALETTE.shadowInk);
        expect(cmds.some((c) => c.kind === 'polygon' && c.fill === DEFAULT_PALETTE.shadowInk)).toBe(true);
    });

    it('对局盘面（T-927 / T-929）：快照 `void` 作占位，只出露空边 + 凸角环带', () => {
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
        // L 形 3 格：露空边 8 条（带 = 4 点四边形）+ 凸角 5 枚（L 形外轮廓 5 凸 1 凹；1/4 环带 = 10 点）。
        expect(cmds).toHaveLength(13);
        expect(cmds.every((c) => c.kind === 'polygon' && c.fill === DEFAULT_PALETTE.shadowInk)).toBe(true);
        expect(cmds[0]!.count).toBe(4);
        expect(cmds[2]!.count).toBe(10);
    });
});
