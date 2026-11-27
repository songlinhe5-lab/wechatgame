/**
 * UI-24 调试层单测：性能覆层的开关 / 三行布局 / 空行折叠，标定线三条。
 *
 * 金样本只抓 `debugInfo = false`（零指令），这里补开关打开后的指令形态。
 */
import { describe, expect, it } from 'vitest';
import type { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsPalette } from '../src/view/palette.js';
import { DEBUG_OUTLINE_TILE_HEX } from '../src/view/palette.js';
import { UI_DEBUG_HIT_FILL } from '../src/view/ui-theme.js';
import { drawHitBox, drawPerfOverlay, drawSafeGuideLines, drawTapTrace } from '../src/view/debug-layer.js';

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
        expect(calls.map((c) => c.kind)).toEqual(['rect', 'text', 'text', 'text']);
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 186, 316, 174]);
        const fill = (calls[0].args[4] as { fill: string }).fill;
        expect(fill).toContain('0.7');
        // 深底必须用深底专用米白：`palette.text` 与遮罩 RGB 同为 (42,46,67) ⇒ 肉眼看零字。
        const textFills = calls.filter((c) => c.kind === 'text');
        for (const c of textFills) expect((c.args[3] as { fill: string }).fill).toBe('#banner');
        expect(texts(calls)).toEqual(['fps 60 · 16.7 ms', 'PLAYING · L3', 'pitch 54.0 · LOD 2']);
    });

    it('`[WXG-T-1110]` 有绘制成本时追加第四行（绘 ms + 下笔次数），三行版式不动', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, true, 34.5, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2', 21.4, 3010);
        expect(calls.map((c) => c.kind)).toEqual(['rect', 'text', 'text', 'text', 'text']);
        expect(texts(calls)).toEqual([
            'fps 29 · 34.5 ms',
            'PLAYING · L3',
            'pitch 54.0 · LOD 2',
            '绘 21.4ms · 3010笔/0令',
        ]);
        // 四行等距 38：新增行不得挤压原三行的 y（版式只向下长、不上移）。
        const ys = calls.filter((c) => c.kind === 'text').map((c) => Number(c.args[1]));
        expect(ys).toEqual([1334 - 38, 1334 - 76, 1334 - 114, 1334 - 152]);
    });

    it('`[WXG-T-1111]` 宿主回投分段 ⇒ 追加第五行，面板向下长到 212', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 3.1, blitMs: 18.9, textMs: 0.4, scopeMs: 0.4, vectorCalls: 12, blitCalls: 156, textCalls: 8 };
        drawPerfOverlay(builder, P, true, 37.0, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2', 22.8, 195, 2382, bd);
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 224, 316, 212]);
        expect(texts(calls)).toEqual([
            'fps 27 · 37.0 ms',
            'PLAYING · L3',
            'pitch 54.0 · LOD 2',
            '绘 22.8ms · 195笔/2382令',
            '矢 3.1 位 18.9 文 0.4 余 0.4ms',
        ]);
        const ys = calls.filter((c) => c.kind === 'text').map((c) => Number(c.args[1]));
        expect(ys).toEqual([1334 - 38, 1334 - 76, 1334 - 114, 1334 - 152, 1334 - 190]);
    });

    it('分段全 0（宿主未接线）⇒ 不画空分段行，面板仍是四行尺寸', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 0, blitMs: 0, textMs: 0, scopeMs: 0, vectorCalls: 0, blitCalls: 0, textCalls: 0 };
        drawPerfOverlay(builder, P, true, 37.0, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2', 22.8, 195, 2382, bd);
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 186, 316, 174]);
        expect(texts(calls)).toHaveLength(4);
    });

    it('菜单腿（phase=menu、无细节）：两行，不画空行', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, true, 0, 'menu', '', '');
        expect(texts(calls)).toEqual(['fps 0 · 0.0 ms', 'menu']);
    });

    it('菜单腿有绘制成本：不占空槽（fps 行下面直接是绘制成本行）', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, true, 16.7, 'menu', '', '', 8.2, 640);
        expect(texts(calls)).toEqual(['fps 60 · 16.7 ms', 'menu', '绘 8.2ms · 640笔/0令']);
        const ys = calls.filter((c) => c.kind === 'text').map((c) => Number(c.args[1]));
        expect(ys).toEqual([1334 - 38, 1334 - 76, 1334 - 114]);
    });

    it('`[WXG-T-1113]` tick / 引探针非 0 ⇒ 追加第六行，面板向下长到 250', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 2.0, blitMs: 2.0, textMs: 5.0, scopeMs: 1.0, vectorCalls: 12, blitCalls: 156, textCalls: 8 };
        drawPerfOverlay(builder, P, true, 48.9, 'playing', 'L9', 'pitch 27.8 · LOD 7', 11.9, 195, 1116, bd, 30.0, 8.4);
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 262, 316, 250]);
        expect(texts(calls)).toEqual([
            'fps 20 · 48.9 ms',
            'playing · L9',
            'pitch 27.8 · LOD 7',
            '绘 11.9ms · 195笔/1116令',
            '矢 2.0 位 2.0 文 5.0 余 1.0ms',
            'tick 30.0 引 8.4ms',
        ]);
        const ys = calls.filter((c) => c.kind === 'text').map((c) => Number(c.args[1]));
        expect(ys).toEqual([1334 - 38, 1334 - 76, 1334 - 114, 1334 - 152, 1334 - 190, 1334 - 228]);
    });

    it('`[WXG-T-1113]` 探针全 0（未接线）⇒ 不画空探针行，面板仍是五行尺寸', () => {
        const { calls, builder } = recorder();
        const bd = { vectorMs: 3.1, blitMs: 18.9, textMs: 0.4, scopeMs: 0.4, vectorCalls: 12, blitCalls: 156, textCalls: 8 };
        drawPerfOverlay(builder, P, true, 37.0, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2', 22.8, 195, 2382, bd, 0, 0);
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 224, 316, 212]);
        expect(texts(calls)).toHaveLength(5);
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
