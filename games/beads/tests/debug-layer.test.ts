/**
 * UI-24 调试层单测：性能覆层的开关 / 三行布局 / 空行折叠，标定线三条。
 *
 * 金样本只抓 `debugInfo = false`（零指令），这里补开关打开后的指令形态。
 */
import { describe, expect, it } from 'vitest';
import type { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsPalette } from '../src/view/palette.js';
import { drawPerfOverlay, drawSafeGuideLines } from '../src/view/debug-layer.js';

const P = { text: '#text' } as unknown as BeadsPalette;

interface Call {
    readonly kind: 'rect' | 'line' | 'text';
    readonly args: readonly unknown[];
}

function recorder(): { calls: Call[]; builder: RenderModelBuilder } {
    const calls: Call[] = [];
    const push = (kind: Call['kind']) => (...args: unknown[]) => calls.push({ kind, args });
    const builder = {
        height: 1334,
        rect: push('rect'),
        line: push('line'),
        text: push('text'),
    } as unknown as RenderModelBuilder;
    return { calls, builder };
}

function texts(calls: readonly Call[]): string[] {
    return calls.filter((c) => c.kind === 'text').map((c) => String(c.args[2]));
}

describe('drawPerfOverlay', () => {
    it('开关关：零指令', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, false, 16.7, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2');
        expect(calls).toEqual([]);
    });

    it('开：窄面板贴屏顶 + fps / 相位 / 细节三行', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, true, 16.7, 'PLAYING', 'L3', 'pitch 54.0 · LOD 2');
        expect(calls.map((c) => c.kind)).toEqual(['rect', 'text', 'text', 'text']);
        expect(calls[0].args.slice(0, 4)).toEqual([12, 1334 - 148, 316, 136]);
        const fill = (calls[0].args[4] as { fill: string }).fill;
        expect(fill).toContain('0.7');
        expect(texts(calls)).toEqual(['fps 60 · 16.7 ms', 'PLAYING · L3', 'pitch 54.0 · LOD 2']);
    });

    it('菜单腿（phase=menu、无细节）：两行，不画空行', () => {
        const { calls, builder } = recorder();
        drawPerfOverlay(builder, P, true, 0, 'menu', '', '');
        expect(texts(calls)).toEqual(['fps 0 · 0.0 ms', 'menu']);
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
