import { describe, expect, it, vi } from 'vitest';
import { Navigator, type Route, type RouteKind } from '../../src/core/ui/navigator.js';

function route(
    name: string,
    kind: RouteKind,
    hooks: Partial<Route> = {},
): Route & { updates: number } {
    const r = {
        name,
        kind,
        updates: 0,
        update() {
            r.updates++;
        },
        ...hooks,
    };
    return r as Route & { updates: number };
}

describe('Navigator', () => {
    it('pushes, pops and replaces routes', () => {
        const nav = new Navigator();
        const menu = route('menu', 'page');
        const settings = route('settings', 'modal');
        nav.push(menu);
        nav.push(settings);
        expect(nav.depth).toBe(2);
        expect(nav.top).toBe(settings);
        expect(nav.pop()).toBe(settings);
        expect(nav.top).toBe(menu);
        nav.replace(route('level-select', 'page'));
        expect(nav.depth).toBe(1);
        expect(nav.top?.name).toBe('level-select');
    });

    it('runs lifecycle hooks through the underlying SceneStack', () => {
        const nav = new Navigator();
        const onExit = vi.fn();
        const onResume = vi.fn();
        nav.push(route('menu', 'page', { onExit, onResume }));
        nav.push(route('settings', 'modal'));
        nav.pop();
        expect(onResume).toHaveBeenCalledTimes(1);
        nav.pop();
        expect(onExit).toHaveBeenCalledTimes(1);
    });

    it('reset() drops old routes (onExit) and enters the new ones', () => {
        const nav = new Navigator();
        const oldExit = vi.fn();
        const newEnter = vi.fn();
        nav.push(route('old', 'page', { onExit: oldExit }));
        nav.reset([route('menu', 'page'), route('play', 'page', { onEnter: newEnter })]);
        expect(oldExit).toHaveBeenCalledTimes(1);
        expect(newEnter).toHaveBeenCalledTimes(1);
        expect(nav.routes.map((r) => r.name)).toEqual(['menu', 'play']);
    });

    it('visibleRoutes() starts at the nearest page', () => {
        const nav = new Navigator();
        nav.push(route('menu', 'page'));
        nav.push(route('old-page', 'page'));
        nav.push(route('pause', 'modal'));
        nav.push(route('settings', 'modal'));
        const out: Route[] = [];
        expect(nav.visibleRoutes(out).map((r) => r.name)).toEqual(['old-page', 'pause', 'settings']);
    });

    it('visibleRoutes() reuses the caller-owned array', () => {
        const nav = new Navigator();
        nav.push(route('menu', 'page'));
        const out: Route[] = [route('stale', 'page')];
        const same = nav.visibleRoutes(out);
        expect(same).toBe(out);
        expect(out).toHaveLength(1);
        expect(out[0].name).toBe('menu');
    });

    it('blocksBelow is true only when a modal is on top', () => {
        const nav = new Navigator();
        expect(nav.blocksBelow).toBe(false);
        nav.push(route('menu', 'page'));
        expect(nav.blocksBelow).toBe(false);
        nav.push(route('settings', 'modal'));
        expect(nav.blocksBelow).toBe(true);
        nav.pop();
        expect(nav.blocksBelow).toBe(false);
    });

    it('update() only ticks the top route', () => {
        const nav = new Navigator();
        const page = route('menu', 'page');
        const modal = route('settings', 'modal');
        nav.push(page);
        nav.push(modal);
        nav.update(1 / 60);
        expect(modal.updates).toBe(1);
        expect(page.updates).toBe(0);
    });
});
