/**
 * PhaseRouteBinder — 壳层导航的唯一写入口（ADR-0032 §6-3 / UI-42）。
 *
 * 把「屏幕相位 + 菜单覆盖层」翻译成框架 {@link Navigator} 的 push / pop：
 * 栈底恒有且只有一个基础页（`menu` 或 `play`），菜单侧覆盖层压在它上面 ——
 * `levels` 是**页**（不透明，盖住菜单），`signin` / `settings` 是**弹窗**（透明）。
 * 壳不再持 `_screen` / `_overlay` 标志位：`screen` / `overlay` 都从栈上**投影**出来
 * （DEC-3：栈即导航状态）。
 *
 * 热路径零分配：路由是五个模块级单例，转场只推 / 弹引用；投影只读栈顶。
 *
 * ⚠ 边界：对局腿的相位弹窗（`paused` / `level-clear` / `game-over` / `finish`）仍由
 * `BeadsGame.phase` + `PanelRouter` 直接分派 —— 它们是**点击路由**（命中哪颗面板钮），
 * 不是导航标志位；搬上本栈要先让面板 View 注册成路由（UI-50 拆旧入口）。本批不动，
 * 免得同一状态两处真源。
 */
import { Navigator } from '@wxgame/framework';
import type { MetaOverlay } from '../view/meta-view.js';
import type { UiRoute } from './ui-root.js';

export type ShellScreen = 'play' | 'menu';

/** 菜单侧覆盖层（与 `MetaOverlay` 的呈现侧取值一一对应）。 */
export type MenuOverlay = 'signin' | 'settings';

/**
 * 内容仍由旧链（`buildMetaView` / `buildBeadsView`）画 ⇒ 路由的 `draw` 是空实现。
 * 这样 `UI_ROOT_ENABLED` 打开时本栈照旧只叠调试层，与空栈时期的画面一致（UI-50 接线）。
 */
const noop = (): void => {};

const PAGE_MENU: UiRoute = { name: 'menu', kind: 'page', draw: noop };
const PAGE_PLAY: UiRoute = { name: 'play', kind: 'page', draw: noop };
const PAGE_LEVELS: UiRoute = { name: 'levels', kind: 'page', draw: noop };
const MODAL_SIGNIN: UiRoute = { name: 'signin', kind: 'modal', draw: noop };
const MODAL_SETTINGS: UiRoute = { name: 'settings', kind: 'modal', draw: noop };

export class PhaseRouteBinder {
    /**
     * `levels` 页的**大关上下文**（EP13-S2）：打开时记下当前走马灯页号 ⇒ 墙集合 = 该大关
     * `levelRefs` 展开（⛔ 不再全量墙）。离页后保留旧值（与迁出前的 `_overlayArc` 同语义：
     * 只在页生命期内被读，重进时覆写）。
     */
    private _levelsArc = 0;

    constructor(
        /** 与 {@link UiRoot} 共用的路由栈（同一个 Navigator，不做第二份真源）。 */
        private readonly _nav: Navigator,
        screen: ShellScreen = 'menu',
    ) {
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
        return name === 'levels' || name === 'signin' || name === 'settings' ? name : 'none';
    }

    /** `levels` 页的大关上下文（`_wallSlotsFor` 的唯一来源）。 */
    get levelsArc(): number {
        return this._levelsArc;
    }

    /** 整栈换成单个基础页（回主菜单 / 进玩法 / 启动兜底都用它）。 */
    resetTo(screen: ShellScreen): void {
        this._nav.reset([screen === 'play' ? PAGE_PLAY : PAGE_MENU]);
    }

    /** 主菜单 → 选关页（页路由），同时记下大关上下文。 */
    openLevels(arc: number): void {
        this._levelsArc = arc;
        this._nav.push(PAGE_LEVELS);
    }

    /** 菜单 → 弹窗（透明，底下仍画主菜单）。 */
    openModal(name: MenuOverlay): void {
        this._nav.push(name === 'signin' ? MODAL_SIGNIN : MODAL_SETTINGS);
    }

    /** 关栈顶覆盖层；基础页不弹（`back` 与淡出终点共用）。 */
    close(): void {
        if (this._nav.depth > 1) this._nav.pop();
    }
}
