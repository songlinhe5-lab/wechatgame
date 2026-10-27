/**
 * UI-25 · UiRoot 组合根（ADR-0032 §6；UI-50 起为唯一绘制入口）。
 *
 * 钉住三件行为：
 *  ① 空栈时与旧链 `drawPerfOverlay` 指令逐字相同（接管调试层零漂移）；
 *  ② 可见路由自下而上，调试层最后；
 *  ③ 调试关时路由照画、零覆层指令。
 */
import { describe, it, expect } from 'vitest';
import type { RenderModelBuilder } from '@wxgame/framework';
import { UiRoot, type UiRoute } from '../src/ui/ui-root.js';
import { drawPerfOverlay } from '../src/view/debug-layer.js';
import type { BeadsPalette } from '../src/view/palette.js';
import type { UiDebugState } from '../src/ui/ui-host.js';

const PALETTE = { text: '#222222' } as unknown as BeadsPalette;

interface Call {
    kind: 'rect' | 'line' | 'text' | 'container' | 'containerEnd';
    args: number[];
    text?: string;
}

function fakeBuilder(): { builder: RenderModelBuilder; calls: Call[] } {
    const calls: Call[] = [];
    const builder = {
        height: 1334,
        rect: (...args: number[]) => calls.push({ kind: 'rect', args }),
        line: (...args: number[]) => calls.push({ kind: 'line', args }),
        text: (...args: unknown[]) =>
            calls.push({ kind: 'text', args: args.slice(0, 2) as number[], text: args[2] as string }),
        // `[UI-60 P1 / ADR-0033 DEC-1]` 容器边界只对 modal 路由发。
        beginContainer: (id: string) => calls.push({ kind: 'container', args: [], text: id }),
        endContainer: () => calls.push({ kind: 'containerEnd', args: [] }),
    } as unknown as RenderModelBuilder;
    return { builder, calls };
}

function host(debug: UiDebugState): { debugState(): UiDebugState } {
    return { debugState: () => debug };
}

function route(name: string, kind: 'page' | 'modal'): UiRoute {
    return {
        name,
        kind,
        draw: (b) => b.line(0, 0, 0, 0, '#000000', 1),
    };
}

describe('UI-25 · UiRoot', () => {
    it('空栈时与旧链 drawPerfOverlay 指令逐字相同', () => {
        const d: UiDebugState = {
            enabled: true,
            frameMs: 16.666,
            phase: 'PLAYING',
            level: 'L3',
            detail: 'pitch 54.0 · LOD 2',
        };
        const old = fakeBuilder();
        drawPerfOverlay(old.builder, PALETTE, d.enabled, d.frameMs, d.phase, d.level, d.detail);
        const viaRoot = fakeBuilder();
        new UiRoot(host(d)).draw(viaRoot.builder, PALETTE);
        expect(viaRoot.calls).toEqual(old.calls);
    });

    it('可见路由自下而上，弹窗自带容器，调试层最后', () => {
        const d: UiDebugState = {
            enabled: true,
            frameMs: 16.666,
            phase: 'PLAYING',
            level: 'L3',
            detail: 'pitch 54.0 · LOD 2',
        };
        const root = new UiRoot(host(d));
        root.push(route('menu', 'page'));
        root.push(route('settings', 'modal'));
        const { builder, calls } = fakeBuilder();
        root.draw(builder, PALETTE);
        expect(calls.map((c) => c.kind)).toEqual([
            'line', // menu（页面：不包容器 ⇒ 恒在容器树之下）
            'container', // settings 容器开
            'line', // settings 内容
            'containerEnd',
            'rect', // 调试层
            'text',
            'text',
            'text',
        ]);
        expect(calls.find((c) => c.kind === 'container')?.text).toBe('settings');
        expect(calls.filter((c) => c.kind === 'text').map((c) => c.text)).toEqual([
            'fps 60 · 16.7 ms',
            'PLAYING · L3',
            'pitch 54.0 · LOD 2',
        ]);
    });

    it('调试关时路由照画、零覆层指令', () => {
        const root = new UiRoot(host({ enabled: false, frameMs: 0, phase: 'menu', level: '', detail: '' }));
        root.push(route('menu', 'page'));
        const { builder, calls } = fakeBuilder();
        root.draw(builder, PALETTE);
        expect(calls.map((c) => c.kind)).toEqual(['line']);
    });
});
