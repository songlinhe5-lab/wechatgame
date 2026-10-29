/**
 * UI-42 · PhaseRouteBinder（ADR-0032 §6-3 / DEC-3「栈即导航状态」）。
 *
 * 验收口径 = 任务表原文「`_screen` / `_overlay` 删除后全仓测试绿」：壳已无这两个标志位，
 * 本文件钉住三件事——
 *  ① 投影正确：`screen` = 栈底基础页，`overlay` = 栈顶覆盖层（基础页在顶 ⇒ `none`）；
 *  ② 转场只经 Navigator：进页 / 开弹窗 / 关栈顶 / 整栈重置，基础页永不被弹掉；
 *  ③ 与 `UiRoot` 共用同一 Navigator：基础页路由的 `draw` 就是壳注入的视图入口（UI-50），
 *     弹窗路由自持绘制（`[UI-60 P1 / ADR-0033 DEC-1]`：不再由基础页 View 代画），
 *     且 `UiRoot.draw` 只对 `modal` 路由包容器边界。
 */
import { describe, it, expect } from 'vitest';
import { Navigator, type RenderModelBuilder } from '@wxgame/framework';
import { PhaseRouteBinder } from '../src/ui/phase-route-binder.js';
import { UiRoot } from '../src/ui/ui-root.js';
import type { BeadsPalette } from '../src/view/palette.js';

function binder(screen: 'play' | 'menu' = 'menu'): { nav: Navigator; b: PhaseRouteBinder; calls: string[] } {
    const nav = new Navigator();
    const calls: string[] = [];
    const b = new PhaseRouteBinder(nav, {
        menu: () => calls.push('menu'),
        play: () => calls.push('play'),
        modal: (_builder, name) => calls.push(name),
        panel: (_builder, name) => calls.push(name),
        panelTap: (name) => {
            calls.push(`tap:${name}`);
            return true;
        },
    }, screen);
    return { nav, b, calls };
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

    it('选关是弹窗路由（`[WXG-T-503]`）：压栈后 overlay=levels 且携带大关上下文；关栈顶回菜单', () => {
        const { nav, b } = binder();
        b.openLevels(2);
        expect(b.overlay).toBe('levels');
        expect(b.levelsArc).toBe(2);
        expect(nav.depth).toBe(2);
        expect(nav.top?.kind).toBe('modal');

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

    it('与 UiRoot 共用同一 Navigator：页面 + 弹窗各自绘制，弹窗包容器边界（UI-50 / ADR-0033）', () => {
        const root = new UiRoot({
            debugState: () => ({ enabled: false, frameMs: 0, phase: 'menu', level: '', detail: '' }),
        });
        const calls: string[] = [];
        const b = new PhaseRouteBinder(root.nav, {
            menu: () => calls.push('menu'),
            play: () => calls.push('play'),
            modal: (_builder, name) => calls.push(`modal:${name}`),
            panel: (_builder, name) => calls.push(`panel:${name}`),
            panelTap: (name) => {
                calls.push(`tap:${name}`);
                return true;
            },
        });
        const builder = {
            height: 1334,
            rect: () => calls.push('rect'),
            text: () => calls.push('text'),
            beginContainer: (id: string) => calls.push(`begin:${id}`),
            endContainer: () => calls.push('end'),
        } as unknown as RenderModelBuilder;
        b.openModal('settings');
        root.draw(builder, {} as BeadsPalette);
        // 弹窗自持绘制且自带容器（页面路由不包容器 ⇒ 恒在容器树之下）。
        expect(calls).toEqual(['menu', 'begin:settings', 'modal:settings', 'end']);

        calls.length = 0;
        b.resetTo('play');
        root.draw(builder, {} as BeadsPalette);
        expect(calls, '页面路由不包容器').toEqual(['play']);
    });
});

const NO_DEBUG = {
    debugState: () => ({ enabled: false, frameMs: 0, phase: 'menu', level: '', detail: '' }),
};

/**
 * `[WXG-T-440 / ADR-0033 边界②]` 相位面板搬栈：`syncPhase` 是**幂等对账**（相位真源仍在
 * `BeadsGame`），栈只是它的投影；命中链从栈顶向下、modal 在场即屏障。
 */
describe('WXG-T-440 · 相位面板搬栈', () => {
    it('syncPhase 幂等：同相位连调不动栈；切相位只换栈顶那一个 modal', () => {
        const { nav, b } = binder('play');
        b.syncPhase('paused', 'normal');
        expect(nav.depth).toBe(2);
        expect(nav.top?.name).toBe('pause');
        b.syncPhase('paused', 'normal'); // 幂等：不重推
        expect(nav.depth).toBe(2);
        b.syncPhase('level-clear', 'normal');
        expect(nav.depth, '先撤旧面板再压新的（恒只一层）').toBe(2);
        expect(nav.top?.name).toBe('clear');
        b.syncPhase('playing', 'normal');
        expect(nav.depth, 'playing 无面板 ⇒ 弹回基础页').toBe(1);
        expect(nav.top?.name).toBe('play');
    });

    it('game-over 按模式分岔：普通 ⇒ fail，冲刺 ⇒ sprint-settle', () => {
        const { nav, b } = binder('play');
        b.syncPhase('game-over', 'normal');
        expect(nav.top?.name).toBe('fail');
        b.syncPhase('game-over', 'sprint');
        expect(nav.top?.name).toBe('sprint-settle');
        expect(nav.depth, '切换模式也只一层').toBe(2);
    });

    it('栈顶是菜单弹窗时 syncPhase 不动它（两类覆盖层互不接管）', () => {
        const { nav, b } = binder();
        b.openModal('settings');
        b.syncPhase('playing', 'normal');
        expect(nav.top?.name).toBe('settings');
        b.close();
        b.syncPhase('paused', 'normal');
        expect(nav.top?.name).toBe('pause');
    });

    it('命中链：modal 在场时空点也算消费（屏障），无 modal 时不包命中', () => {
        const root = new UiRoot(NO_DEBUG);
        const hits: string[] = [];
        root.push({ name: 'menu', kind: 'page', draw: () => { } });
        root.push({
            name: 'pause',
            kind: 'modal',
            draw: () => { },
            presenter: (x, y) => {
                hits.push(`${x},${y}`);
                return false; // 未命中面板钮
            },
        });
        expect(root.hitTest(10, 20), 'modal 在场 ⇒ 面板外点击也消费').toBe(true);
        expect(hits).toEqual(['10,20']);
        root.pop();
        expect(root.hitTest(10, 20), '无 modal ⇒ 不接管').toBe(false);
    });
});
