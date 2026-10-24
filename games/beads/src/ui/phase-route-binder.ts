/**
 * PhaseRouteBinder — 壳层导航的唯一写入口（ADR-0032 §6-3 / UI-42）。
 *
 * 把「屏幕相位 + 菜单覆盖层」翻译成框架 {@link Navigator} 的 push / pop：
 * 栈底恒有且只有一个基础页（`menu` 或 `play`），菜单侧覆盖层压在它上面 ——
 * `levels` 是**页**（不透明，盖住菜单），`signin` / `settings` 是**弹窗**（透明）。
 * 壳不再持 `_screen` / `_overlay` 标志位：`screen` / `overlay` 都从栈上**投影**出来
 * （DEC-3：栈即导航状态）。
 *
 * 热路径零分配：转场只推 / 弹引用；投影只读栈顶。三条内容路由（menu / play / levels）
 * 由构造期闭包给出 `draw`（UI-50：`UiRoot` 是唯一绘制入口），弹窗路由是模块级单例。
 *
 * ⚠ 边界 ①：`levels` 是**页**（盖住菜单）⇒ 它的 `draw` 复用菜单腿入口（视图按 overlay 走页分支）；
 * `signin` / `settings` / `skins` 是**透明弹窗**，底下 menu 路由仍可见并画出弹窗本帧（菜单遮罩态不画
 * 底页，属既有视觉；逐层拆分要先过 UX 裁定），故弹窗路由 `draw` 为空。
 * ⚠ 边界 ②：对局腿的相位弹窗（`paused` / `level-clear` / `game-over` / `finish`）仍由
 * `BeadsGame.phase` + `PanelRouter` 直接分派 —— 它们是**点击路由**（命中哪颗面板钮），
 * 不是导航标志位；搬上本栈要先让面板 View 注册成路由。本批不动，免得同一状态两处真源。
 */
import { Navigator } from '@wxgame/framework';
import type { RenderModelBuilder } from '@wxgame/framework';
import type { MetaOverlay } from '../view/meta-view.js';
import type { UiRoute } from './ui-root.js';

export type ShellScreen = 'play' | 'menu';

/** 菜单侧覆盖层（与 `MetaOverlay` 的呈现侧取值一一对应）。 */
export type MenuOverlay = 'signin' | 'settings' | 'skins';

/**
 * 基础页的绘制入口（壳注入：菜单腿一次 `buildMetaView`、对局腿一次
 * `play.buildRenderModel` —— 本批只把**入口**收到路由上，不拆视图内部）。
 */
export interface PhasePageDrawers {
    menu(builder: RenderModelBuilder): void;
    play(builder: RenderModelBuilder): void;
}

/** 弹窗内容由底下的 menu 路由画出（见头注边界 ①）⇒ 空 `draw`。 */
const noop = (): void => { };

const MODAL_SIGNIN: UiRoute = { name: 'signin', kind: 'modal', draw: noop };
const MODAL_SETTINGS: UiRoute = { name: 'settings', kind: 'modal', draw: noop };
/** `[WXG-T-363]` 装扮馆弹窗（入口 = 设置弹窗行5 左格 `open-skins`）。 */
const MODAL_SKINS: UiRoute = { name: 'skins', kind: 'modal', draw: noop };
/** 弹窗路由表（`MenuOverlay` 全覆盖 ⇒ `openModal` 无三元链、新增一档只加一行）。 */
const MODALS: Record<MenuOverlay, UiRoute> = { signin: MODAL_SIGNIN, settings: MODAL_SETTINGS, skins: MODAL_SKINS };

export class PhaseRouteBinder {
    /**
     * `levels` 页的**大关上下文**（EP13-S2）：打开时记下当前走马灯页号 ⇒ 墙集合 = 该大关
     * `levelRefs` 展开（⛔ 不再全量墙）。离页后保留旧值（与迁出前的 `_overlayArc` 同语义：
     * 只在页生命期内被读，重进时覆写）。
     */
    private _levelsArc = 0;
    /** 基础页路由（每个壳一份：`draw` 闭包绑到该壳的视图入口）。 */
    private readonly _menuRoute: UiRoute;
    private readonly _playRoute: UiRoute;
    private readonly _levelsRoute: UiRoute;

    constructor(
        /** 与 {@link UiRoot} 共用的路由栈（同一个 Navigator，不做第二份真源）。 */
        private readonly _nav: Navigator,
        drawers: PhasePageDrawers,
        screen: ShellScreen = 'menu',
    ) {
        this._menuRoute = { name: 'menu', kind: 'page', draw: (b) => drawers.menu(b) };
        this._playRoute = { name: 'play', kind: 'page', draw: (b) => drawers.play(b) };
        // 页路由挡住菜单 ⇒ 必须自己画；复用菜单腿入口（`data.overlay === 'levels'` 选页分支）。
        this._levelsRoute = { name: 'levels', kind: 'page', draw: (b) => drawers.menu(b) };
        this.resetTo(screen);
    }

    /** 当前屏幕 = 栈底基础页。 */
    get screen(): ShellScreen {
        return this._nav.routes[0]?.name === 'play' ? 'play' : 'menu';
    }

    /** 栈顶覆盖层；基础页在顶（或空栈）⇒ `none`。 */
    get overlay(): MetaOverlay {
        const routes = this._nav.routes;
        if (routes.length < 2) return 'none';
        const name = routes[routes.length - 1]!.name;
        return name === 'levels' || name === 'signin' || name === 'settings' || name === 'skins' ? name : 'none';
    }

    /** `levels` 页的大关上下文（`_wallSlotsFor` 的唯一来源）。 */
    get levelsArc(): number {
        return this._levelsArc;
    }

    /** 整栈换成单个基础页（回主菜单 / 进玩法 / 启动兜底都用它）。 */
    resetTo(screen: ShellScreen): void {
        this._nav.reset([screen === 'play' ? this._playRoute : this._menuRoute]);
    }

    /** 主菜单 → 选关页（页路由），同时记下大关上下文。 */
    openLevels(arc: number): void {
        this._levelsArc = arc;
        this._nav.push(this._levelsRoute);
    }

    /** 菜单 → 弹窗（透明，底下仍画主菜单）。 */
    openModal(name: MenuOverlay): void {
        this._nav.push(MODALS[name]);
    }

    /** 关栈顶覆盖层；基础页不弹（`back` 与淡出终点共用）。 */
    close(): void {
        if (this._nav.depth > 1) this._nav.pop();
    }
}
