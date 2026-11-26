/**
 * PhaseRouteBinder — 壳层导航的唯一写入口（ADR-0032 §6-3 / UI-42）。
 *
 * 把「屏幕相位 + 菜单覆盖层」翻译成框架 {@link Navigator} 的 push / pop：
 * 栈底恒有且只有一个基础页（`menu` 或 `play`），菜单侧覆盖层压在它上面 ——
 * `[WXG-T-503]` 选关改判回**弹窗**：`levels` 与 `signin` / `settings` 同属透明弹窗（叠在菜单上）。
 * 壳不再持 `_screen` / `_overlay` 标志位：`screen` / `overlay` 都从栈上**投影**出来
 * （DEC-3：栈即导航状态）。
 *
 * 热路径零分配：转场只推 / 弹引用；投影只读栈顶。三条内容路由（menu / play / levels）
 * 由构造期闭包给出 `draw`（UI-50：`UiRoot` 是唯一绘制入口），弹窗路由是模块级单例。
 *
 * ⚠ 边界 ①：`[WXG-T-503]` 起 `levels` 也是**弹窗**（自持 `draw` ⇒ `drawers.modal`），由 `UiRoot.draw`
 * 包容器边界 ⇒ 底下 menu 路由照常画底页（半透遮罩有东西可透），弹窗整体压在其上。
 * `[WXG-T-440]` 边界 ② 已收口：对局腿的相位面板（`paused` / `level-clear` / `game-over` /
 * `finish`）**注册成 modal 路由**（{@link PhaseModal}），渲染与命中都从本表出。
 * 相位状态本身仍由 `BeadsGame` 持有（唯一真源）—— 本类只做 `syncPhase()` 的**幂等对账**，
 * ⛔ 不接管 phase，故不存在「Navigator 有路由 / `BeadsGame` 有 phase」的双真源。
 */
import { Navigator } from '../../framework/index';
import type { RenderModelBuilder } from '../../framework/index';
import type { BeadsPhase, GameMode } from '../game/state';
import type { MetaOverlay } from '../view/meta-view';
import type { PlayPanelName } from '../view/view-model';
import { UI_SCRIM } from '../view/ui-theme';
import type { UiRoute } from './ui-root';

/** 基础页（EP15-S4 增 `replay` 回放页；它不是 `BeadsGame` 相位）。 */
export type ShellScreen = 'play' | 'menu' | 'replay';

/** 菜单侧覆盖层（与 `MetaOverlay` 的呈现侧取值一一对应）。 */
export type MenuOverlay = 'levels' | 'signin' | 'settings' | 'skins' | 'profile' | 'level-detail';

/** `[WXG-T-470/471/472]` 批 1：菜单侧覆盖层合法路由名（含 levels 页 + 弹窗；`[WXG-T-501]` 图鉴 / 本地榜下线）。 */
const MENU_OVERLAY_NAMES: ReadonlySet<MetaOverlay> = new Set<MetaOverlay>([
    'none', 'levels', 'signin', 'settings', 'skins', 'profile', 'level-detail',
]);

/**
 * `[WXG-T-440]` 对局相位面板路由名。既是栈上 modal 的路由 id，也是**渲染容器 id**
 * （`UiRoot.draw` 按 `route.name` 包容器）。
 *
 * ⚠ 值域的单一真源在 `view/view-model.ts::PlayPanelName`（绘制腿在那里），本处只是别名 ——
 * `ui/` → `view/` 是既有正向依赖，⛔ 不让 `view/` 反向 import `ui/`（会成循环）。
 */
export type PhaseModal = PlayPanelName;

/** 相位 → 面板路由（`boot` / `playing` 无面板）。`game-over` 按模式分岔（冲刺结算 / 失败面板）。 */
function phaseModal(phase: BeadsPhase, mode: GameMode): PhaseModal | null {
    switch (phase) {
        case 'paused':
            return 'pause';
        case 'level-clear':
            return 'clear';
        case 'game-over':
            return mode === 'sprint' ? 'sprint-settle' : 'fail';
        case 'finish':
            return 'finish';
        default:
            return null;
    }
}

/** 相位面板路由名集合（`syncPhase` 判栈顶用；模块级一份，⛔ 每帧不新建）。 */
const PHASE_MODAL_NAMES: ReadonlySet<string> = new Set<PhaseModal>([
    'pause',
    'clear',
    'fail',
    'sprint-settle',
    'finish',
]);

/**
 * 基础页与弹窗的绘制入口（壳注入：菜单腿一次 `buildMetaView`、对局腿一次
 * `renderPlayPage(play, b)`（WXG-T-420 T9：绑定已上移到 `ui/play-binding.ts`）、
 * 弹窗腿一次 `buildMetaModal` —— 本批只把**入口**收到路由上，不拆视图内部）。
 */
export interface PhasePageDrawers {
    menu(builder: RenderModelBuilder): void;
    play(builder: RenderModelBuilder): void;
    /** EP15-S4：回放页（基础页；回放期不叠加任何 `BeadsGame` 相位面板）。 */
    replay(builder: RenderModelBuilder): void;
    /** `[UI-60 P1 / ADR-0033 DEC-1]` 弹窗自持绘制（⛔ 不再由页面视图分支代画）。 */
    modal(builder: RenderModelBuilder, name: MenuOverlay): void;
    /** `[WXG-T-440]` 相位面板自持绘制（内容 = 该相位面板 + FG 彩带 + 榜单）。 */
    panel(builder: RenderModelBuilder, name: PhaseModal): void;
    /** `[WXG-T-440]` 相位面板命中（壳把它接到 `PanelRouter.route`，动作本体仍在 `BeadsGame`）。 */
    panelTap(name: PhaseModal, x: number, y: number): boolean;
}

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
    private readonly _replayRoute: UiRoute;
    /** 弹窗路由表（`MenuOverlay` 全覆盖 ⇒ `openModal` 无三元链、新增一档只加一行）。 */
    private readonly _modals: Record<MenuOverlay, UiRoute>;
    /** `[WXG-T-440]` 相位面板路由表（`PhaseModal` 全覆盖）。 */
    private readonly _phaseModals: Record<PhaseModal, UiRoute>;

    constructor(
        /** 与 {@link UiRoot} 共用的路由栈（同一个 Navigator，不做第二份真源）。 */
        private readonly _nav: Navigator,
        drawers: PhasePageDrawers,
        screen: ShellScreen = 'menu',
    ) {
        this._menuRoute = { name: 'menu', kind: 'page', draw: (b) => drawers.menu(b) };
        this._playRoute = { name: 'play', kind: 'page', draw: (b) => drawers.play(b) };
        this._replayRoute = { name: 'replay', kind: 'page', draw: (b) => drawers.replay(b) };
        // `[UI-60 P1 / ADR-0033 DEC-1]` 弹窗自持绘制（构造期一次建表，⛔ 每帧不新建）。
        // `[WXG-T-1029]` meta 弹窗显式声明蒙版浓度 ⇒ UiRoot 以平级前置容器注入（蒙版在弹窗
        // 位图之下）；相位面板（pause/clear/…）自带伸缩蒙版 ⇒ 不声明、UiRoot 不注入。
        this._modals = {
            // `[WXG-T-503]` 选关 = 弹窗（格 120；底页菜单照常画 ⇒ 遮罩可透）。
            levels: { name: 'levels', kind: 'modal', scrimAlpha: UI_SCRIM.alpha, draw: (b) => drawers.modal(b, 'levels') },
            signin: { name: 'signin', kind: 'modal', scrimAlpha: UI_SCRIM.alpha, draw: (b) => drawers.modal(b, 'signin') },
            // `[WXG-T-935]` 设置页沿用自家 0.3 遮罩档（只换底板，不换遮罩档）。
            settings: { name: 'settings', kind: 'modal', scrimAlpha: UI_SCRIM.settingsAlpha, draw: (b) => drawers.modal(b, 'settings') },
            /** `[WXG-T-363]` 装扮馆弹窗（入口 = 设置弹窗行5 左格 `open-skins`）。 */
            skins: { name: 'skins', kind: 'modal', scrimAlpha: UI_SCRIM.alpha, draw: (b) => drawers.modal(b, 'skins') },
            // `[WXG-T-472]` 批 1：名片弹窗（`[WXG-T-501]` 图鉴 / 本地榜下线）。
            profile: { name: 'profile', kind: 'modal', scrimAlpha: UI_SCRIM.alpha, draw: (b) => drawers.modal(b, 'profile') },
            // `[WXG-T-601]` 关卡详情弹窗（选关卡卡 → 详情 → 开始；叠 levels 之上）。
            'level-detail': { name: 'level-detail', kind: 'modal', scrimAlpha: UI_SCRIM.alpha, draw: (b) => drawers.modal(b, 'level-detail') },
        };
        // `[WXG-T-440]` 相位面板路由（构造期一次建表；`draw` 与 `presenter` 同源，⛔ 两处真源）。
        const phaseRoute = (name: PhaseModal): UiRoute => ({
            name,
            kind: 'modal',
            draw: (b) => drawers.panel(b, name),
            presenter: (x, y) => drawers.panelTap(name, x, y),
        });
        // `[WXG-T-1097]` **有位图腿的相位面板**（fail 木牌九宫格 / clear 结算板）须由 UiRoot
        // 注入平级前置蒙版容器（`{name}:scrim`）：容器 Graphics 内联蒙版会罩暗容器 BlitLayerUI
        // 的位图（用户真机报「蒙版在上层」）⇒ 路由声明 scrimAlpha/scrimRgb（rgb 同参 canvas 族，
        // 视觉零变）+ 视图撤内联蒙版（防双份）。全矢量面板（pause/sprint-settle/finish）
        // 同通道按绘制序自洽 ⇒ 不声明。
        const bitmapPhaseRoute = (name: PhaseModal): UiRoute => ({
            ...phaseRoute(name),
            scrimAlpha: UI_SCRIM.alpha,
            scrimRgb: UI_SCRIM.canvas,
        });
        this._phaseModals = {
            pause: phaseRoute('pause'),
            clear: bitmapPhaseRoute('clear'),
            fail: bitmapPhaseRoute('fail'),
            'sprint-settle': phaseRoute('sprint-settle'),
            finish: phaseRoute('finish'),
        };
        this.resetTo(screen);
    }

    /** 当前屏幕 = 栈底基础页。 */
    get screen(): ShellScreen {
        const name = this._nav.routes[0]?.name;
        if (name === 'play') return 'play';
        if (name === 'replay') return 'replay';
        return 'menu';
    }

    /** 栈顶覆盖层；基础页在顶（或空栈）⇒ `none`。 */
    get overlay(): MetaOverlay {
        const routes = this._nav.routes;
        if (routes.length < 2) return 'none';
        const name = routes[routes.length - 1]!.name;
        return MENU_OVERLAY_NAMES.has(name as MetaOverlay) ? (name as MetaOverlay) : 'none';
    }

    /** `levels` 页的大关上下文（`_wallSlotsFor` 的唯一来源）。 */
    get levelsArc(): number {
        return this._levelsArc;
    }

    /** 整栈换成单个基础页（回主菜单 / 进玩法 / 回放页 / 启动兜底都用它）。 */
    resetTo(screen: ShellScreen): void {
        this._nav.reset([
            screen === 'play' ? this._playRoute : screen === 'replay' ? this._replayRoute : this._menuRoute,
        ]);
    }

    /** 主菜单 → 选关弹窗（modal），同时记下大关上下文。 */
    openLevels(arc: number): void {
        this._levelsArc = arc;
        this._nav.push(this._modals.levels);
    }

    /** 菜单 → 弹窗（透明，底下仍画主菜单）。 */
    openModal(name: MenuOverlay): void {
        this._nav.push(this._modals[name]);
    }

    /** 关栈顶覆盖层；基础页不弹（`back` 与淡出终点共用）。 */
    close(): void {
        if (this._nav.depth > 1) this._nav.pop();
    }

    /**
     * `[WXG-T-440 / ADR-0033 边界②]` **相位 → 栈顶面板路由的幂等对账**。
     *
     * 相位状态仍归 `BeadsGame`（唯一真源），本方法只把「当前相位」投影成栈上那**一个** modal
     * 路由：栈顶已是目标面板 ⇒ 零动作（不重推、不抖动）；不是 ⇒ 先撤旧面板再压新的。
     * 栈顶是菜单弹窗 / 基础页时**不动它们**（`cur === null && want === null` ⇒ 直接返回）。
     *
     * 调用点：壳在「每帧 draw 前」与「对局 tap 前」各调一次（tap 时相位已稳定 ⇒ 命中链与画面同源）。
     */
    syncPhase(phase: BeadsPhase, mode: GameMode): void {
        const want = phaseModal(phase, mode);
        const top = this._nav.routes[this._nav.depth - 1];
        const cur = top && PHASE_MODAL_NAMES.has(top.name) ? (top.name as PhaseModal) : null;
        if (cur === want) return;
        if (cur !== null) this._nav.pop();
        if (want !== null) this._nav.push(this._phaseModals[want]);
    }
}
