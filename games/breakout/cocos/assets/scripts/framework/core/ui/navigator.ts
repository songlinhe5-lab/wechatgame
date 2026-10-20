/**
 * Route stack for UI navigation (ADR-0032 DEC-3).
 *
 * Wraps the generic {@link SceneStack} and adds one word of vocabulary: every
 * entry is either a `page` (opaque — it covers everything below) or a `modal`
 * (transparent — the page underneath is still drawn).
 *
 * Rendering walks {@link Navigator.visibleRoutes} bottom → top. Input goes to
 * {@link Navigator.top} only. There is no `screen ===` / `overlay ===` flag:
 * the stack *is* the navigation state.
 */
import { SceneStack, type Scene } from '../scene/scene-stack';

export type RouteKind = 'page' | 'modal';

export interface Route extends Scene {
    readonly kind: RouteKind;
}

export class Navigator {
    private readonly _stack = new SceneStack();

    get depth(): number {
        return this._stack.depth;
    }

    get top(): Route | undefined {
        return this._stack.top as Route | undefined;
    }

    /** Bottom → top, read-only. */
    get routes(): readonly Route[] {
        return this._stack.scenes as readonly Route[];
    }

    /** A modal on top blocks the page below from receiving input. */
    get blocksBelow(): boolean {
        return this.top?.kind === 'modal';
    }

    push(route: Route): void {
        this._stack.push(route);
    }

    pop(): Route | undefined {
        return this._stack.pop() as Route | undefined;
    }

    replace(route: Route): void {
        this._stack.replace(route);
    }

    /** Pop everything, then push `routes` bottom → top. */
    reset(routes: readonly Route[]): void {
        this._stack.clear();
        for (const route of routes) this._stack.push(route);
    }

    update(dt: number): void {
        this._stack.update(dt);
    }

    /**
     * Visible set = every route from the nearest `page` (inclusive) up to the
     * top, written into caller-owned `out` bottom → top (hot path: no alloc).
     */
    visibleRoutes(out: Route[]): Route[] {
        out.length = 0;
        const all = this._stack.scenes;
        let start = 0;
        for (let i = all.length - 1; i >= 0; i--) {
            if ((all[i] as Route).kind === 'page') {
                start = i;
                break;
            }
        }
        for (let i = start; i < all.length; i++) out.push(all[i] as Route);
        return out;
    }
}
