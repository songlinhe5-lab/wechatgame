/**
 * UI-24 调试层单测：性能覆层的开关 / 三行布局 / 空行折叠，标定线三条。
 *
 * 金样本只抓 `debugInfo = false`（零指令），这里补开关打开后的指令形态。
 */
import { describe, expect, it } from 'vitest';
import type { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsPalette } from '../src/view/palette.js';
import { DEBUG_OUTLINE_TILE_HEX } from '../src/view/palette.js';
import { DBG_CHIP_ON_TEXT_HEX } from '../src/config/debug-flags.js';
import { UI_DEBUG_HIT_FILL } from '../src/view/ui-theme.js';
import { drawHitBox, drawPerfOverlay, drawSafeGuideLines, drawTapTrace } from '../src/view/debug-layer.js';
import { dbgChipAt, perfPanelHit } from '../src/config/perf-panel.js';
import { DBG_CAP_30, DBG_HIDE_BEADS, DBG_HIDE_TRAY } from '../src/config/debug-flags.js';

const P = { text: '#text', bannerText: '#banner' } as unknown as BeadsPalette;

interface Call {
    readonly kind: 'rect' | 'line' | 'text' | 'circle';
    readonly args: readonly unknown[];
}

function recorder(): { calls: Call[]; builder: RenderModelBuilder } {
    const calls: Call[] = [];
    const push = (kind: Call['kind']) => (...args: unknown[]) => calls.push({ kind, args });
    const builder = {
        height: 1334,
        rect: push('rect'),
        line: push('line'),
        circle: push('circle'),
        text: push('text'),
    } as unknown as RenderModelBuilder;
    return { calls, builder };
}

function texts(calls: readonly Call[]): string[] {
    return calls.filter((c) => c.kind === 'text').map((c) => String(c.args[2]));
}

/**
 * `[WXG-T-1119]` 展开态最下一行是 4 个归因 chip（珠 / 盘 / HUD / 30）⇒ 版式断言先把它拆出去，
 * 只看文字行；chip 自身另用 `chipTexts` / `chipRects` 断言。
 */
const CHIP_LABELS = ['珠', '盘', 'HUD', '30', '托', '卡', '顶'] as const;

function lineTexts(calls: readonly Call[]): string[] {
    return texts(calls).filter((t) => !(CHIP_LABELS as readonly string[]).includes(t));
}

function chipTexts(calls: readonly Call[]): string[] {
    return texts(calls).filter((t) => (CHIP_LABELS as readonly string[]).includes(t));
}

describe('drawHitBox（`[WXG-T-444]` 响应区边界）', () => {
    it('只发一条 rect：几何逐字透传 + 线宽 2 + 半透明填充', () => {
        const { calls, builder } = recorder();
        drawHitBox(builder, 24, 300, 140, 88);
        expect(calls).toHaveLength(1);
        expect(calls[0].kind).toBe('rect');
        // `[WXG-T-449]` 填一层 14% 品红：只描边时看不出热区比视觉框多出的那一截。
        expect(calls[0].args).toEqual([
            24, 300, 140, 88,
            { stroke: DEBUG_OUTLINE_TILE_HEX, lineWidth: 2, fill: UI_DEBUG_HIT_FILL },
        ]);
    });

    it('`[WXG-T-449]` 填充必须半透明（α ≤ 0.3）——实色会遮住按钮本身', () => {
        const { calls, builder } = recorder();
        drawHitBox(builder, 0, 0, 10, 10);
        const fill = String((calls[0].args[4] as { fill: string }).fill);
        const alpha = Number(/rgba?\([^)]*?,\s*([\d.]+)\s*\)$/.exec(fill)?.[1]);
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThanOrEqual(0.3);
    });
});

describe('drawTapTrace（`[WXG-T-445]` 触点探针）', () => {
    it('十字两条线 + 圆环 + 命中的钮 id（同色同笔宽）', () => {
        const { calls, builder } = recorder();
        drawTapTrace(builder, 94, 146, 'open-rank', DEBUG_OUTLINE_TILE_HEX, '20px sans-serif');
        expect(calls.map((c) => c.kind)).toEqual(['line', 'line', 'circle', 'text']);
        expect(calls[0].args).toEqual([68, 146, 120, 146, DEBUG_OUTLINE_TILE_HEX, 3]);
        expect(calls[1].args).toEqual([94, 120, 94, 172, DEBUG_OUTLINE_TILE_HEX, 3]);
        expect(calls[3].args[2]).toBe('open-rank');
    });
});

describe('drawPerfOverlay', () => {
    it('开关关：零指令', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, false, 16.7, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2');
        expect(calls).toEqual([]);
    });

    it('开：窄面板贴屏顶 + fps / 相位 / 细节三行（未接线时不出绘制成本行）', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, true, 16.7, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2');
        // 7 行版（3 文字行 + 两行归因 chip 让位）⇒ 面板 [1334-262, 1334-12]、高 250。
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 262, 316, 250]);
        const fill = (calls[0].args[4] as { fill: string }).fill;
        expect(fill).toContain('0.7');
        // 深底必须用深底专用米白：`palette.text` 与遮罩 RGB 同为 (42,46,67) ⇒ 肉眼看零字。
        const textFills = calls.filter((c) => c.kind === 'text').slice(0, 3);
        for (const c of textFills) expect((c.args[3] as { fill: string }).fill).toBe('#banner');
        expect(lineTexts(calls)).toEqual(['fps 60 · 16.7 ms', 'PLAYING · L3', 'pitch 54.0 · LOD 2']);
    });

    it('`[WXG-T-1110]` 有绘制成本时追加第四行（绘 ms + 下笔次数），三行版式不动', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, true, 34.5, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2', 21.4, 3010);
        expect(lineTexts(calls)).toEqual([
            'fps 29 · 34.5 ms',
            'PLAYING · L3',
            'pitch 54.0 · LOD 2',
            '绘 21.4ms · 3010笔/0令',
        ]);
        // 四行等距 38：新增行不得挤压原三行的 y（版式只向下长、不上移）。
        const ys = calls.filter((c) => c.kind === 'text' && !(CHIP_LABELS as readonly string[]).includes(String(c.args[2])))
            .map((c) => Number(c.args[1]));
        expect(ys).toEqual([1334 - 38, 1334 - 76, 1334 - 114, 1334 - 152]);
    });

    it('`[WXG-T-1111]` 宿主回投分段 ⇒ 追加第五行，面板向下长到 288', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 3.1, blitMs: 18.9, textMs: 0.4, scopeMs: 0.4, vectorCalls: 12, blitCalls: 156, textCalls: 8 };
        drawPerfOverlay(builder, P, true, 37.0, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2', 22.8, 195, 2382, bd);
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 300, 316, 288]);
        expect(lineTexts(calls)).toEqual([
            'fps 27 · 37.0 ms',
            'PLAYING · L3',
            'pitch 54.0 · LOD 2',
            '绘 22.8ms · 195笔/2382令',
            '矢 3.1 位 18.9 文 0.4 余 0.4ms',
        ]);
        const ys = calls.filter((c) => c.kind === 'text' && !(CHIP_LABELS as readonly string[]).includes(String(c.args[2])))
            .map((c) => Number(c.args[1]));
        expect(ys).toEqual([1334 - 38, 1334 - 76, 1334 - 114, 1334 - 152, 1334 - 190]);
    });

    it('分段全 0（宿主未接线）⇒ 不画空分段行，面板仍是四行尺寸', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 0, blitMs: 0, textMs: 0, scopeMs: 0, vectorCalls: 0, blitCalls: 0, textCalls: 0 };
        drawPerfOverlay(builder, P, true, 37.0, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2', 22.8, 195, 2382, bd);
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 262, 316, 250]);
        expect(lineTexts(calls)).toHaveLength(4);
    });

    it('菜单腿（phase=menu、无细节）：两行，不画空行', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, true, 0, 'menu', '', '');
        expect(lineTexts(calls)).toEqual(['fps 0 · 0.0 ms', 'menu']);
    });

    it('菜单腿有绘制成本：不占空槽（fps 行下面直接是绘制成本行）', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, true, 16.7, 'menu', '', '', 8.2, 640);
        expect(lineTexts(calls)).toEqual(['fps 60 · 16.7 ms', 'menu', '绘 8.2ms · 640笔/0令']);
        const ys = calls.filter((c) => c.kind === 'text' && !(CHIP_LABELS as readonly string[]).includes(String(c.args[2])))
            .map((c) => Number(c.args[1]));
        expect(ys).toEqual([1334 - 38, 1334 - 76, 1334 - 114]);
    });

    it('`[WXG-T-1113]` tick / 引探针非 0 ⇒ 追加第六行，面板向下长到 326', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 2.0, blitMs: 2.0, textMs: 5.0, scopeMs: 1.0, vectorCalls: 12, blitCalls: 156, textCalls: 8 };
        drawPerfOverlay(builder, P, true, 48.9, 'playing', 'L9', 'pitch 27.8 · LOD 7', 11.9, 195, 1116, bd, 30.0, 8.4, 27.0);
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 338, 316, 326]);
        expect(lineTexts(calls)).toEqual([
            'fps 20 · 48.9 ms',
            'playing · L9',
            'pitch 27.8 · LOD 7',
            '绘 11.9ms · 195笔/1116令',
            '矢 2.0 位 2.0 文 5.0 余 1.0ms',
            'tick 30.0 引 8.4 空 27.0ms',
        ]);
        const ys = calls.filter((c) => c.kind === 'text' && !(CHIP_LABELS as readonly string[]).includes(String(c.args[2])))
            .map((c) => Number(c.args[1]));
        expect(ys).toEqual([1334 - 38, 1334 - 76, 1334 - 114, 1334 - 152, 1334 - 190, 1334 - 228]);
    });

    it('`[WXG-T-1113]` 探针全 0（未接线）⇒ 不画空探针行，面板仍是五行尺寸', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 3.1, blitMs: 18.9, textMs: 0.4, scopeMs: 0.4, vectorCalls: 12, blitCalls: 156, textCalls: 8 };
        drawPerfOverlay(builder, P, true, 37.0, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2', 22.8, 195, 2382, bd, 0, 0);
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 300, 316, 288]);
        expect(lineTexts(calls)).toHaveLength(5);
    });

    it('`[WXG-T-1114]` 空档未量到（0）⇒ 探针行不画「空」，不误导成零空档', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 2.0, blitMs: 2.0, textMs: 7.0, scopeMs: 0.0, vectorCalls: 12, blitCalls: 156, textCalls: 8 };
        drawPerfOverlay(builder, P, true, 45.3, 'playing', 'L9', 'pitch 27.8 · LOD 7', 10.9, 195, 1117, bd, 13.7, 4.6, 0);
        const last = lineTexts(calls).at(-1);
        expect(last).toBe('tick 13.7 引 4.6ms');
        expect(last).not.toContain('空');
    });

    it('`[WXG-T-1116]` 收起：只画一行紧凑面板，分段 / 探针数据在场也不展开', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 2.0, blitMs: 2.0, textMs: 5.0, scopeMs: 1.0, vectorCalls: 12, blitCalls: 156, textCalls: 8 };
        drawPerfOverlay(builder, P, true, 48.9, 'playing', 'L9', 'pitch 27.8 · LOD 7', 11.9, 195, 1116, bd, 30.0, 8.4, 27.0, false);
        expect(calls.map((c) => c.kind)).toEqual(['rect', 'text']);
        // 一行面板：上缘 1334-34、高 22（与 `perfPanelHit` 同式）。
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 34, 316, 22]);
        const t = texts(calls)[0]!;
        expect(t).toContain('fps 20 · 48.9 ms');
        expect(t).toContain('点按展开');
        // 单行垂直居中：面板中线 top-23。
        expect(calls[1]!.args[1]).toBe(1334 - 23);
    });

    it('`[WXG-T-1116]` perfPanelHit：收起 / 展开矩形与绘制同源，面板外不命中', () => {
        // 收起（1 行）：面板 [1300, 1322]，y=1334-60 在面板外。
        expect(perfPanelHit(100, 1334 - 23, 1334, true, true, false)).toBe(true);
        expect(perfPanelHit(100, 1334 - 60, 1334, true, true, false)).toBe(false);
        // 展开（`[WXG-T-1121]` = 9 行：5 文字 + 2 chip 行 + 细分 + 探针）：同一 y 落进面板；下缘恒 1334-12。
        expect(perfPanelHit(100, 1334 - 60, 1334, true, true, true)).toBe(true);
        expect(perfPanelHit(100, 1334 - 338 + 1, 1334, true, true, true)).toBe(true);
        expect(perfPanelHit(100, 1334 - 338 - 1, 1334, true, true, true)).toBe(false);
        // 面板横向 [12, 328]：左右越界不命中。
        expect(perfPanelHit(11, 1334 - 23, 1334, true, true, false)).toBe(false);
        expect(perfPanelHit(329, 1334 - 23, 1334, true, true, false)).toBe(false);
    });

    it('`[WXG-T-1119/1121]` chip 两行 7 枚逐项可选、命中与绘制同源', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 2.0, blitMs: 2.0, textMs: 5.0, scopeMs: 1.0, vectorCalls: 12, blitCalls: 156, textCalls: 8 };
        // 打开「珠」「30」「托」三位 ⇒ 这三枚实色底 + 深字，其余半透明底 + 米白字。
        drawPerfOverlay(builder, P, true, 48.9, 'playing', 'L9', 'pitch 27.8 · LOD 7', 11.9, 195, 1116, bd, 30.0, 8.4, 27.0, true,
            DBG_HIDE_BEADS | DBG_CAP_30 | DBG_HIDE_TRAY);
        expect(chipTexts(calls)).toEqual(['珠', '盘', 'HUD', '30', '托', '卡', '顶']);
        const chipRects = calls.filter((c) => c.kind === 'rect' && Number(c.args[3]) === 26);
        expect(chipRects).toHaveLength(7);
        const fills = chipRects.map((c) => (c.args[4] as { fill: string }).fill);
        expect(fills[0]).toBe('#banner'); // 珠 = 开
        expect(fills[1]).toContain('0.16'); // 盘 = 关
        expect(fills[2]).toContain('0.16'); // HUD = 关
        expect(fills[3]).toBe('#banner'); // 30 = 开
        expect(fills[4]).toBe('#banner'); // 托 = 开
        const chipTextFills = calls.filter((c) => c.kind === 'text').slice(-7)
            .map((c) => (c.args[3] as { fill: string }).fill);
        expect(chipTextFills[0]).toBe(DBG_CHIP_ON_TEXT_HEX);
        expect(chipTextFills[1]).toBe('#banner');
        // 两行几何：第 0 行 4 枚（窄）、第 1 行 3 枚（宽），行间不重叠。
        expect(Number(chipRects[0]!.args[2])).toBeLessThan(Number(chipRects[4]!.args[2])!);
        expect(Number(chipRects[4]!.args[1])).toBeGreaterThan(
            Number(chipRects[0]!.args[1]) + Number(chipRects[0]!.args[3]),
        );
        // 每枚 chip 的中心必须命中自己（顺序 = 珠 / 盘 / HUD / 30 / 托 / 卡 / 顶）。
        for (let i = 0; i < 7; i++) {
            const r = chipRects[i]!.args;
            const cx = Number(r[0]) + Number(r[2]) / 2;
            const cy = Number(r[1]) + Number(r[3]) / 2;
            expect(dbgChipAt(cx, cy, 1334, true, true)).toBe(i);
        }
        // 行间空隙与文字行带都不算 chip。
        const first = chipRects[0]!.args;
        expect(dbgChipAt(Number(first[0]) + 1, Number(first[1]) - 1, 1334, true, true)).toBe(-1);
        expect(dbgChipAt(Number(first[0]) + 1, Number(first[1]) + 27, 1334, true, true)).toBe(-1);
    });

    it('`[WXG-T-1119]` 收起态不画 chip（没有控制面就无命中）', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, true, 48.9, 'playing', 'L9', 'pitch 27.8 · LOD 7', 0, 0, 0, null, 0, 0, 0, false, 0b1111111);
        expect(chipTexts(calls)).toEqual([]);
        expect(calls.map((c) => c.kind)).toEqual(['rect', 'text']);
    });
});

describe('drawSafeGuideLines', () => {
    it('三条横线 + 三条标注（顶部 / 胶囊底 / Home）', () => {
        const { calls, builder } = recorder();
        drawSafeGuideLines(builder, 1334, 100, 214, 68);
        expect(calls.filter((c) => c.kind === 'line')).toHaveLength(3);
        expect(texts(calls)).toEqual(['safe 100', 'cap 214', 'home 68']);
        expect(calls[0].args).toEqual([0, 1234, 750, 1234, calls[0].args[4], 3]);
    });
});
