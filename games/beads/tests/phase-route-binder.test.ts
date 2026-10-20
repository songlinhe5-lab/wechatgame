/**
 * UI-42 · PhaseRouteBinder（ADR-0032 §6-3 / DEC-3「栈即导航状态」）。
 *
 * 验收口径 = 任务表原文「`_screen` / `_overlay` 删除后全仓测试绿」：壳已无这两个标志位，
 * 本文件钉住三件事——
 *  ① 投影正确：`screen` = 栈底基础页，`overlay` = 栈顶覆盖层（基础页在顶 ⇒ `none`）；
 *  ② 转场只经 Navigator：进页 / 开弹窗 / 关栈顶 / 整栈重置，基础页永不被弹掉；
 *  ③ 与 `UiRoot` 共用同一 Navigator：空 `draw` 路由不改变「只叠调试层」的旧行为。
 */
import { describe, it, expect } from 'vitest';
import { Navigator, type RenderModelBuilder } from '@wxgame/framework';
import { PhaseRouteBinder } from '../src/ui/phase-route-binder.js';
import { UiRoot } from '../src/ui/ui-root.js';
import type { BeadsPalette } from '../src/view/palette.js';

function binder(screen: 'play' | 'menu' = 'menu'): { nav: Navigator; b: PhaseRouteBinder } {
    const nav = new Navigator();
    return { nav, b: new PhaseRouteBinder(nav, screen) };
}

describe('UI-42 · PhaseRouteBinder', () => {
    it('初始 = 单个基础页；基础页在顶时 overlay 为 none', () => {
        const menu = binder();
        expect(menu.b.screen).toBe('menu');
        expect(menu.b.overlay).toBe('none');
        expect(menu.nav.depth).toBe(1);

        const play = binder('play');
        expect(play.b.screen).toBe('play');
        expect(play.b.overlay).toBe('none');
    });

    it('选关页是页路由：压栈后 overlay=levels 且携带大关上下文；关栈顶回菜单', () => {
        const { nav, b } = binder();
        b.openLevels(2);
        expect(b.overlay).toBe('levels');
        expect(b.levelsArc).toBe(2);
        expect(nav.depth).toBe(2);
        expect(nav.top?.kind).toBe('page');

        b.close();
        expect(b.overlay).toBe('none');
        expect(b.screen).toBe('menu');
        expect(b.levelsArc, '离页后保留旧值（重进时覆写）').toBe(2);
    });

    it('签到 / 设置是弹窗路由（透明，底下仍是菜单）', () => {
        const { nav, b } = binder();
        b.openModal('signin');
        expect(b.overlay).toBe('signin');
        expect(nav.top?.kind).toBe('modal');
        b.close();

        b.openModal('settings');
        expect(b.overlay).toBe('settings');
        expect(b.screen, '弹窗不换屏').toBe('menu');
        b.close();
        expect(b.overlay).toBe('none');
    });

    it('基础页上 close 不弹空栈', () => {
        const { nav, b } = binder();
        b.close();
        b.close();
        expect(nav.depth).toBe(1);
        expect(b.screen).toBe('menu');
    });

    it('resetTo 清掉覆盖层（回菜单 / 进玩法 / 启动兜底同一入口）', () => {
        const { nav, b } = binder();
        b.openLevels(1);
        b.resetTo('play');
        expect(b.screen).toBe('play');
        expect(b.overlay).toBe('none');
        expect(nav.depth).toBe(1);

        b.openModal('settings');
        b.resetTo('menu');
        expect(b.screen).toBe('menu');
        expect(b.overlay).toBe('none');
    });

    it('与 UiRoot 共用同一 Navigator：路由 draw 为空 ⇒ 开关打开时仍只叠调试层', () => {
        const root = new UiRoot({
            debugState: () => ({ enabled: false, frameMs: 0, phase: 'menu', level: '', detail: '' }),
        });
        const b = new PhaseRouteBinder(root.nav);
        b.openModal('settings');
        const calls: string[] = [];
        const builder = {
            height: 1334,
            rect: () => calls.push('rect'),
            text: () => calls.push('text'),
        } as unknown as RenderModelBuilder;
        root.draw(builder, {} as BeadsPalette);
        expect(calls).toEqual([]);
    });
});
