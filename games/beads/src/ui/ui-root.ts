/**
 * UiRoot — UI 组合根（ADR-0032 §6，UI-25 / UI-50）。
 *
 * 职责只有三件：持有 {@link Navigator}、自下而上画可见路由、最后画调试层。
 * UI-50 起本根是**唯一绘制入口**（壳的 `buildRenderModel` 只调这里）：基础页路由的
 * `draw` 绑到既有视图函数（`buildMetaView` / `play-binding::renderPlayPage`），覆盖层内容
 * 仍由基础页的 View 分支画（见 `phase-route-binder.ts` 头注边界 ①）。
 *
 * 热路径零分配：可见集写进调用方持有数组；调试数据由宿主复用同一对象。
 */
import { Navigator, type Route } from '@wxgame/framework';
import type { RenderModelBuilder } from '@wxgame/framework';
import { drawPerfOverlay } from '../view/debug-layer.js';
import type { BeadsPalette } from '../view/palette.js';
import type { UiHost } from './ui-host.js';

/** 可绘制路由：`draw` 只读 ViewModel，与 `Scene` 生命周期正交。 */
export interface UiRoute extends Route {
    draw(builder: RenderModelBuilder): void;
}

export class UiRoot {
    readonly nav = new Navigator();
    /** 可见集复用数组（`visibleRoutes` 写入，不新建）。 */
    private readonly _visible: UiRoute[] = [];

    constructor(private readonly _host: UiHost) { }

    push(route: UiRoute): void {
        this.nav.push(route);
    }

    pop(): UiRoute | undefined {
        return this.nav.pop() as UiRoute | undefined;
    }

    /** 推进路由生命周期（`SceneStack.update` 只跑栈顶）。 */
    update(dt: number): void {
        this.nav.update(dt);
    }

    /** 自下而上画可见路由，最后画调试层（盖住所有路由）。 */
    draw(builder: RenderModelBuilder, palette: BeadsPalette): void {
        const routes = this.nav.visibleRoutes(this._visible) as UiRoute[];
        for (let i = 0; i < routes.length; i++) routes[i].draw(builder);
        const d = this._host.debugState();
        drawPerfOverlay(builder, palette, d.enabled, d.frameMs, d.phase, d.level, d.detail);
    }
}
