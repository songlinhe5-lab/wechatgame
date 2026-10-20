/**
 * UiRoot — UI 组合根（ADR-0032 §6，UI-25）。
 *
 * 职责只有三件：持有 {@link Navigator}、自下而上画可见路由、最后画调试层。
 * 内容仍由旧链（`buildBeadsView` / `buildMetaView`）画 —— 本批是**并行挂接**：
 *
 *   - `UI_ROOT_ENABLED = false`（默认）⇒ shell 走原路径，逐字不变；
 *   - `true` ⇒ 调试层改由本根接管（可见路由 + DebugLayer），旧链继续画内容，
 *     供 P3 起逐界面把 View 注册成路由。
 *
 * 热路径零分配：可见集写进调用方持有数组；调试数据由宿主复用同一对象。
 */
import { Navigator, type Route } from '../../framework/index';
import type { RenderModelBuilder } from '../../framework/index';
import { drawPerfOverlay } from '../view/debug-layer';
import type { BeadsPalette } from '../view/palette';
import type { UiHost } from './ui-host';

/**
 * 并行挂接开关。关闭 = 旧链（默认）；打开 = 调试层经本根。
 * P3 起每迁一个界面把它注册成路由，P5 拆旧链后本开关随之退役。
 */
export const UI_ROOT_ENABLED: boolean = false;

/** 可绘制路由：`draw` 只读 ViewModel，与 `Scene` 生命周期正交。 */
export interface UiRoute extends Route {
  draw(builder: RenderModelBuilder): void;
}

export class UiRoot {
  readonly nav = new Navigator();
  /** 可见集复用数组（`visibleRoutes` 写入，不新建）。 */
  private readonly _visible: UiRoute[] = [];

  constructor(private readonly _host: UiHost) {}

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
