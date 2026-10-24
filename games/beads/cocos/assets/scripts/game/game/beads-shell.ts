/**
 * BeadsShell — the framework `Game` that the host actually drives (WXG-T-164
 * 批0，用户 2026-09-18 拍板①「B 壳双对象」). It composes two objects:
 *
 *   - `play` = {@link BeadsGame}  — the frozen in-run simulation, **unchanged**
 *     contract; the shell only wires its `onMenuRequest` hook and forwards frames.
 *   - `meta` = {@link MetaState}  — the out-of-run economy (stamina / signin /
 *     wallet), created at `init` from the injected storage + wall clock.
 *
 * Routing (ux-spec v1.7 §2 / §6.3；#1 · WXG-T-180 反转；EP12-S6 · WXG-T-269-S6 T-2A):
 *   - **首屏停主菜单**（原「启动直进玩法」红线已反转）：`initialScreen` 默认 `'menu'`；
 *     主菜单即「木框橱窗**作品墙**」（`menu-architecture.md §5.1/§5.4` 三条硬口径）：
 *     ① 主钮 = **当前关**；② 墙格 = **指定关**；③ **无第三入口**（`open-levels` 钮已从
 *     菜单布局摘除 = Q5①「入口隐藏、代码保留」⇒ `levels` overlay 仍在册，只是无菜单腿）。
 *   - 菜单入口 = 暂停面板次钮「回主菜单」→ `play` 的 `onMenuRequest` → {@link showMenu}；
 *   - 主菜单主钮「开始游戏」/ 选关点格：**开对应关**并扣 1 心（systems-index §3.14）。
 *     旧口径「有在途（`play.phase==='paused'`）→ 恢复、不扣心」**已随 WXG-T-165 反转作废**
 *     （v1.29：回主菜单 = 弃本局棋盘，关卡解锁进度保留）。
 *
 * 陈列序（2026-10-10 用户裁定 #2 · **退役 EP12-S6 DI 升序陈列**）：墙槽 `i` = 关卡索引 `i`（**配置文件
 * 顺序** = manifest `order` 升序 = 关号序），**不再按 DI 重排** ⇒ 陈列序 = 解锁序 = id 序，消除
 * 「首屏第一格（DI 最易但 id 靠后）被锁」的反直觉。难度递增改由**生成期门禁⑦**约束（新关按序追加、boss 殿后）。
 * {@link _rebuildWallSlots} 产出 **`slot → levelIndex` 恒等映射**（截断到 `WALL_CAPACITY`），绘制与命中
 * 两条腿仍只经映射取关索引；视图侧 `MetaButton` 只携带 `slot`。表是**一次性缓存**（失效键 = `play.levelCount`），
 * 每帧 `buildRenderModel` 只读引用 ⇒ 热路径零 sort / 零分配（`control-manifest §2`）。
 *
 * The wall clock is injected (`options.clock`) because `GameServices.platform`
 * exposes only `PlatformInfo` (no wallClock) — the framework stays untouched.
 *
 * 扣心语义（systems-index §3.14）：扣心时机 = 新局开局 / 重试。本 shell 在三处扣心——
 * 启动入玩法（{@link init}）、菜单→玩法（{@link startGame}）、以及玩法内 retry/restart
 * （经注入 play 的 `canStartRun` 闸门）。0 心重试被拒 → play 触发广告加心激励位
 * （§3.11 第二 live 位），发奖经 `onStaminaRefill` → {@link MetaState.grantAdHearts}
 * （§3.14 v1.80：固定 +`HEART_AD_GAIN`、日限 `HEART_AD_DAILY_LIMIT`）后重放。
 * 冲刺消耗不冻结（§3.14），故 sprint 重开不设门。
 */

import type { Game, GameServices, RenderModelBuilder } from '../../framework/index';
import {
    FACET4_STYLE_ID,
    BEAD_SIZE_DEFAULT,
    STAMINA_START_COST,
    STAMINA_REFILL_PLACEMENT,
    WALL_CAPACITY,
    PANEL_IN_MS,
    PANEL_OUT_MS,
    menuAnchors,
    powerupBuyPrice,
    setLiveDesignHeight,
    type MenuAnchors,
    type PowerupType,
} from '../config/tuning';
import { ARC_OPEN_MAX, ARCS } from '../config/arcs';
import { arcEntryTicket, emptyArcTicketResult, type ArcTicketResult } from '../systems/arc-ticket';
import { BeadsGame, type BeadsGameOptions } from './beads-game';
import { LEVELS } from '../config/levels';
import type { BeadsLevelRaw } from '../config/levels-data';
// 2026-10-10 #2：墙序改配置文件顺序（恒等），本文件不再按 DI 排序 ⇒ 移除 difficultyOf 依赖
// （DI 真源仍住 difficulty.ts，供门禁⑥/分带用）。
import { MetaState } from './meta-state';
import {
    buildMetaView,
    hitTestMeta,
    type MetaAction,
    type MetaBossState,
    type MetaButton,
    type MetaOverlay,
    type MetaViewData,
} from '../view/meta-view';
import { DEFAULT_SKIN_ID, registeredSkins } from '../config/skins/registry';
// `[WXG-T-363]` 装扮馆：拥有态注入腿（视图标签）+ 卡区画法单源同文件，判例 = `setMenuBitmapResolver`。
import { setSkinOwnedResolver } from '../view/skins-content';
import { MainMenuPresenter } from '../ui/main-menu-presenter';
import type { BeadsPalette } from '../view/palette';
import type { PausePanelAction } from '../systems/pause-panel';
import { importLatest, type HttpGet } from './level-import';
import { UiRoot } from '../ui/ui-root';
import type { UiDebugState } from '../ui/ui-host';
import { PhaseRouteBinder, type ShellScreen } from '../ui/phase-route-binder';

/** UI-42：屏幕相位 / 覆盖层改由 {@link PhaseRouteBinder} 的 Navigator 栈投影（本文件不持标志位）。 */
export type { ShellScreen };

/** beads-studio 在线导入配置（WXG-T-179 调试用；不传 ⇒ 菜单不画入口）。 */
export interface StudioImportOptions {
    /** 服务基址，如 `http://192.168.1.20:8787`（微信正式环境需 https + 合法域名；开发/体验版可勾不校验）。 */
    readonly baseUrl: string;
    /** 平台 HTTP 通道（微信 = `wx.request` 包装；harness/Node = fetch）；缺省用全局 fetch。 */
    readonly get?: HttpGet;
}

export interface BeadsShellOptions {
    /** wallClock ms source (host-injected; `() => Date.now()` in production). */
    readonly clock: () => number;
    /** Forwarded to the inner {@link BeadsGame} (tuning/levels/saveKey/…). */
    readonly play?: BeadsGameOptions;
    readonly palette?: BeadsPalette;
    /** Overridable meta sidecar key so tests get isolated storage. */
    readonly metaKey?: string;
    /** Boot screen. Default `'menu'`（#1 首屏停主菜单；harness/tests 可传 `'play'` 直进玩法）。 */
    readonly initialScreen?: ShellScreen;
    /** 在线导入（beads-studio）；仅调试 / 开发期传。 */
    readonly studio?: StudioImportOptions;
}

export class BeadsShell implements Game {
    readonly id = 'beads';
    /** The frozen in-run game — public so the harness/tests reach its command API. */
    readonly play: BeadsGame;
    /**
     * UI 令牌实例（EP12-S8 起为 **getter**：直读 `play.palette` ⇒ 换肤后两屏同帧一致；
     * 此前是构造期独立常量，菜单与玩法侧可能各持一份——换肤会暴露该漂移，故收编单源）。
     */
    get palette(): BeadsPalette {
        return this.play.palette;
    }
    /** Created at {@link init} (needs services.storage). Undefined before then. */
    meta?: MetaState;

    private _services?: GameServices;
    private readonly _clock: () => number;
    private readonly _metaKey?: string;
    /**
     * `[WXG-T-314]` 选关页转场（ADR-0032 D5 / arc-level-select-spec §5 的 200 / 150）：
     * `_pageFxDir`：1 = 淡入（菜单→页，页已可交互）、-1 = 淡出（页→菜单，路径仍归页）、0 = 静息；
     * `_pageFxT` = 0..1 的 dt 累积进度（⛔ 不用墙钟 ⇒ 固定步进可测、金样本恒等）。
     */
    private _pageFxDir: -1 | 0 | 1 = 0;
    private _pageFxT = 0;
    private readonly _studio?: StudioImportOptions;
    /** 拉取在途门标（防连点重复导入）。 */
    private _studioBusy = false;
    /**
     * 陈列序基准表引用：与 {@link BeadsGame} 构造式 `options.levels ?? LEVELS` **逐字同表达式**
     * ⇒ shell 与 play 读同一张关表（宿主传自定义关表时也不漂移），且**只在构造期取一次**。
     * ⛔ 不向 play 要关表（`_levels` 是 play 私有面，本批不扩其契约）。
     */
    private readonly _wallBaseLevels: readonly BeadsLevelRaw[];
    /** `slot → levelIndex` 缓存（一次性构建，⛔ 不在每帧路径 sort/map/filter）。 */
    private _wallSlots: readonly number[] = [];
    /**
     * `slot → 关卡本体` 缓存（与 {@link _wallSlots} **同批同序同长**重建）。
     * EP12-S6 · T-2B：作品格珠拼缩略需要 `pattern` 才能聚合（`menu-wall-signage-spec §3.1`）；
     * 视图侧⛔ 不得直读全局 `LEVELS`（宿主可下传自定义关表 ⇒ 陈列序对、画错图）。
     */
    private _wallLevels: readonly (BeadsLevelRaw | undefined)[] = [];
    /** 缓存失效键：关表长度（`importLevel` 追加 ⇒ 计数变 ⇒ 重建）。 */
    private _wallSlotsForCount = -1;
    /** 同上，缓存失效键之二 = 当前大关页（切大关 ⇔ 换清单）。 */
    private _wallSlotsForArc = -1;
    /**
     * `[WXG-T-345]` S-4 门票闸门的复用出参 + 「上一章清单」缓存（0-based 关下标）。
     * 计算点只有：墙表重建 / 开选关页 / 章首格点击 / 过关时的跨章回调 —— **⛔ 每帧**。
     */
    private readonly _arcTicket: ArcTicketResult = emptyArcTicketResult();
    private readonly _arcPrevSlots: number[] = [];
    private _arcPrevArc = -1;
    private _arcPrevCount = -1;
    /** 「该章存在上一章」（首章 ⇒ false ⇒ 门票恒开、进度件不创建）。 */
    private _arcPrevPresent = false;
    /** Scratch pointer for screen→design (never retained), same as BeadsGame. */
    private readonly _pointer = { x: 0, y: 0 };
    /** Reused view-data object — buildRenderModel must not allocate (热路径零分配). */
    private readonly _viewData = {
        stamina: 0,
        staminaMax: 0,
        heartAdsLeft: 0,
        coins: 0,
        overlay: 'none' as MetaOverlay,
        signinDay: 0,
        /**
         * `[WXG-T-280]` 逐机菜单锚（落地单 §2）：**init 算定一次 ⇒ 全程不改**（顶栏避让已并入链内 `bt`）；
         * 绘制腿（`buildMetaView`）与命中腿（`_dispatchMetaTap`）**共读同一引用**（几何缓存键）。
         * 未 `init`（单测直构 shell）⇒ `undefined` ⇒ 视图走模块级兜底锚定档（锚定档唯一，⛔ 无第二套几何）。
         */
        anchors: undefined as MenuAnchors | undefined,
        canClaim: false,
        bgmMuted: false,
        debugInfo: false,
        debugGuides: false,
        sfxMuted: false,
        reduceMotion: false,
        largeText: false,
        vibrate: true,
        // EP11-S5 行4 两钮（初值 = 默认档，真实值每帧从 play getter 覆盖）。
        beadStyle: FACET4_STYLE_ID,
        beadSize: BEAD_SIZE_DEFAULT,
        // EP12-S8 行4 第三钮（初值 = 默认肤，真实值每帧从 play getter 覆盖）。
        skinId: DEFAULT_SKIN_ID,
        /** `[WXG-T-314]` 选关页转场不透明度（缺省 = 无转场；每帧由 `_metaViewData` 覆写）。 */
        pageFade: undefined as number | undefined,
        /** `[WXG-T-340]` 选关页空带大关名（每帧由 `_metaViewData` 按 `ARCS[页].title` 覆写）。 */
        chapterTitle: undefined as string | undefined,
        levelCount: 0,
        currentLevelIndex: 0,
        maxUnlockedLevel: 1,
        starsByLevel: [] as readonly number[],
        // 陈列序映射（每帧只读引用；表由 _wallSlotsFor() 一次性缓存）。
        wallSlots: [] as readonly number[],
        // 槽位 → 关卡引用（T-2B 缩略聚合的 pattern 入口；与 wallSlots 同批缓存，每帧只读）。
        wallLevels: [] as readonly (BeadsLevelRaw | undefined)[],
        // `[WXG-T-345]` S-4 只读告知件（由 `_refreshArcGate` 在非帧事件里写；⛔ 每帧算）。
        // 默认 = 首章口径（无阻断 ⇒ 章开、不建进度件）；⛔ 造 `0/0`。
        arcTicketOpen: true,
        // C 拍定「不创建」= `undefined`（⛔ 存 0/0）：门槛有值才表示该页有进度件。
        arcStarGot: undefined as number | undefined,
        arcStarNeed: undefined as number | undefined,
        // 走马灯 = 大关页（EP13-S4）：代表关 = 该大关收尾关（boss），图 = `ARCS[页].textureId`。
        carouselLevel: undefined as BeadsLevelRaw | undefined,
        carouselState: undefined as MetaBossState | undefined,
        carouselTextureId: undefined as string | undefined,
        carouselPeerTextureId: undefined as string | undefined,
        carouselDx: 0,
        carouselT: 0,
        carouselPeer: undefined as BeadsLevelRaw | undefined,
        carouselPeerState: undefined as MetaBossState | undefined,
        carouselPeerSign: undefined as (-1 | 1) | undefined,
        carouselComingSoon: false,
        carouselPeerComingSoon: false,
        // [BD-62] 边界可见性（每帧由 `_metaViewData` 覆盖）。
        carouselFirst: false,
        carouselLast: false,
        studioEnabled: false,
        /** 按下态：`hitTestMeta` 返回的缓存钮引用（每帧由 `_readMenuInput` 覆盖，零分配）。 */
        pressed: null as MetaButton | null,
    };
    /** UI-40：走马灯页位 / 位移 / 吸附 / 玻璃手势全在 Presenter（本壳零走马灯字段）。 */
    private readonly _menu = new MainMenuPresenter();
    /** 进度件当前口径所属大关页（`-1` = 尚未算过）；只在页位变号时重算（WXG-T-346）。 */
    private _gateArc = -1;
    /**
     * **抬起提交门**（WXG-T-295 · `input-control §2.1` v2.13）：菜单 / overlay 上的按钮按下**只登记**
     * 命中的缓存钮（`metaLayout` 产出的同一对象引用），抬起帧重测热区、**id + slot 同者**才派发
     * ⇒ 拖出按钮 / 拖到别的钮上 / 从外面拖进来一律零响应。`null` = 无登记。
     * 比较走 id + slot 而非引用全等 ⇒ 就算布局表在按住期间重建（关表变长）也不会把钮吞掉。
     * 玻璃（走马灯卡）不登本门：它自己就是「按下→拖动→抬起」的手势体（`MainMenuPresenter`）。
     */
    private _menuPress: MetaButton | null = null;
    /** 菜单侧广告加心位在途标（EP13-S3）：防连点重复 show；`onClose`/`onError` 清。 */
    private _refillPending = false;
    /** 广告订阅退订器（`init` 登记、`dispose` 释放）。 */
    private readonly _adOffs: Array<() => void> = [];
    /** UI-25：UiRoot 的调试投影复用对象（与 `BeadsGame.debugState` 同口径）。 */
    private readonly _uiDebug: UiDebugState = { enabled: false, frameMs: 0, phase: '', level: '', detail: '' };
    /** UI-25：组合根（开关关闭时不参与绘制/推进）。 */
    private readonly _uiRoot: UiRoot;
    /** UI-42：导航唯一真源 —— 屏幕 / 覆盖层 / 选关页大关上下文都由这个栈投影。 */
    private readonly _phase: PhaseRouteBinder;

    constructor(options: BeadsShellOptions) {
        this._clock = options.clock;
        this._metaKey = options.metaKey;
        this._studio = options.studio;
        this._wallBaseLevels = options.play?.levels ?? LEVELS;
        // `[WXG-T-363]` 拥有态单源（惰性读 `this.meta`，`init()` 前 / 无 meta 的宿主 ⇒ 不设门）：
        // 卡面标签与穿/循两道门读**同一条腿** ⇒ ⛔ 出现「显示解锁价、点击却白穿」的不一致。
        const ownsSkin = (skinId: string): boolean => this.meta?.ownsSkin(skinId) ?? true;
        setSkinOwnedResolver(ownsSkin);
        this.play = new BeadsGame({
            // EP12-S8：shell 级 palette 选项真正下传 play（此前只作用于菜单侧的独立副本，
            // 与 play 各持一份；收编单源后默认肤 tokens = DEFAULT_PALETTE，缺省行为不变）。
            ...(options.palette !== undefined ? { palette: options.palette } : {}),
            ...(options.play ?? {}),
            // 暂停面板「回主菜单」次钮 → 切到菜单（真机反馈裁定：弃本局棋盘——下次「开始游戏」= 全新开当前关）。
            onMenuRequest: () => this.showMenu(),
            // 新局开局体力闸门（§3.14）：retry/restart 前扣 1 心；0 心返回 false（play 转广告加心位）。
            canStartRun: () => (this.meta ? this.meta.spendStamina(STAMINA_START_COST) : true),
            // 广告加心发奖（§3.11 第二 live 位；§3.14 v1.80 由「回满」改固定 HEART_AD_GAIN）。
            onStaminaRefill: () => this.meta?.grantAdHearts(),
            // §3.14 v1.80 日限/满心闸门：不可加心时不拉广告。
            canWatchStaminaAd: () => this.meta?.canWatchHeartAd ?? false,
            // §3.6 v1.80 唯一豆子出口：道具超限购买的扣款腿（限额由 play 侧 PowerupSystem 判）。
            onPowerupPurchase: (type) => this._buyPowerup(type),
            // `[WXG-T-345]` S-4：跨章推进闸门（门票只在章界那一刻参与解锁位推进；I7 棘轮）。
            canAdvanceAcrossArc: (fromIndex, toIndex) => this._canAdvanceAcrossArc(fromIndex, toIndex),
            // `[WXG-T-363]` 买断门：暂停面板换肤循环与装扮馆 `wearSkin` 共用此腿（§3.7 v1.83）。
            ownsSkin,
        });
        // UI-25：宿主只提供调试投影（L5）；意图面随 P3 Presenter 落地。
        this._uiRoot = new UiRoot({
            debugState: () => {
                this.play.debugState(this._uiDebug, this._phase.screen !== 'play');
                return this._uiDebug;
            },
        });
        // UI-50：路由栈与 UiRoot 共用同一 Navigator，栈即绘制源 —— 基础页路由的 `draw`
        // 闭包绑到本壳的两个视图入口（菜单腿消费 `play.palette`，换肤后两屏同帧一致）。
        this._phase = new PhaseRouteBinder(this._uiRoot.nav, {
            menu: (b) => buildMetaView(b, this._metaViewData(), this.play.palette),
            play: (b) => this.play.buildRenderModel(b),
        }, options.initialScreen ?? 'menu');
    }

    /** Clip → 合成配方，转交给宿主（沿 play 的音色库，ADR-0013）。 */
    get audioVoices(): BeadsGame['audioVoices'] {
        return this.play.audioVoices;
    }

    get screen(): ShellScreen {
        return this._phase.screen;
    }

    get overlay(): MetaOverlay {
        return this._phase.overlay;
    }

    /** `[WXG-T-281]` init 算定的实锚（与 `tapMeta` 热区同源）⇒ 测试/覆盖层读同一几何，⛔ 另算默认档。 */
    get menuAnchors(): MenuAnchors | undefined {
        return this._viewData.anchors;
    }

    // ───────────────────────────────────────────────────────────── Game contract

    init(services: GameServices): void {
        this._services = services;
        // `[WXG-T-280]` 菜单链锚：接口值算定一次（顶栏避让 `bt` 已在链内）。⚠ 小游戏宿主下传接口实值；
        // 非小游戏宿主（浏览器 harness / node）无硬件刘海/Home 条 ⇒ **真值 0**（[WXG-T-281] 排障：旧档传 null
        // 走 120/68 悲观兜底，1334 屏即落退化态 ⇒ 橱窗压 CTA / slogan 骑资源条）。null 兜底档仅留「未知宿主」直调。
        const plat = services.platform;
        // `[WXG-T-323]` 对话框居中基准与菜单链锚同源一次算定（裁定 = 面板中心对齐手机中心）；
        // 必须早于 `play.init` ⇒ 任何面板几何首次构造前就位。
        setLiveDesignHeight(services.viewport.designHeight);
        this._viewData.anchors = menuAnchors({
            safeTopDp: plat.isMiniGame ? plat.safeAreaTop : 0,
            capsuleBottomDp: plat.capsuleBottomDp,
            safeBottomDp: plat.isMiniGame ? plat.safeAreaBottom : 0,
            windowWidthDp: services.viewport.fit.screenWidth,
            designHeight: services.viewport.designHeight,
        });
        this.play.init(services);
        // 菜单侧广告加心发奖（EP13-S3）：**广播**订阅，只认自己的在途标 ⇒ 不误接续时/加心腿。
        const ad = services.rewardedAd;
        this._adOffs.push(
            ad.onRewarded(() => {
                if (!this._refillPending) return;
                this._refillPending = false;
                this.meta?.grantAdHearts(); // §3.14 v1.80：固定 +HEART_AD_GAIN（溢出即弃）
            }),
            ad.onClose(() => {
                this._refillPending = false;
            }),
            ad.onError(() => {
                this._refillPending = false;
            }),
        );
        const bus = services.events as unknown as { emit: (t: string, p: unknown) => void };
        this.meta = new MetaState({
            storage: services.storage,
            clock: this._clock,
            emit: (type, payload) => bus.emit(type, payload),
            metaKey: this._metaKey,
        });
        // §3.7 v1.83 grandfather（提案 §4.3）：改判前「皮肤免费循环」时代选中的肤计入已拥有，
        // ⛔ 不补扣、⛔ 不降级。幂等且只在此一处调（`play.skinId` 已由存档层降级保证已注册）。
        this.meta.ensureSkinOwnership(this.play.skinId);
        // 启动路由（ux-spec v1.7 §6.3：直进玩法；0 心老玩家落菜单——体力系统生效，非违约）。
        if (this._phase.screen === 'play') {
            if (this.meta.stamina < STAMINA_START_COST) {
                this._phase.resetTo('menu');
            } else {
                this.meta.spendStamina(STAMINA_START_COST); // 首局开局扣心（§3.14）
            }
        }
    }

    update(dt: number): void {
        // UI-50：路由栈是唯一导航真源，每帧推进栈顶。
        this._uiRoot.update(dt);
        if (this._phase.screen === 'play') {
            this._menuPress = null; // 进玩法后不得残留菜单按压（否则回菜单时会补发一次 phantom tap）
            this.play.update(dt); // 对局腿的采样在 `sampleFrame` 内（game.update 开头）
            return;
        }
        // UI-24：菜单腿不跑 play.update ⇒ 采样单独喂（debugInfo 关时内部零开销）。
        this.play.sampleFrame(dt);
        // 菜单：推进体力恢复（离线 f(Δt)）+ 读点击。play 冻结（不 update ⇒ 倒计时不走）。
        this.meta?.refresh();
        this._stepPageFx(dt);
        this._readMenuInput();
        this._menu.step(this._clock());
        this._refreshArcGateOnMenuPage();
    }

    buildRenderModel(builder: RenderModelBuilder): void {
        // UI-50：唯一绘制入口 —— 可见路由自下而上画内容，最后叠调试层。
        // 基础页路由的 `draw` 闭包绑到既有视图（菜单腿 `buildMetaView` / 对局腿
        // `play.buildRenderModel`）⇒ 层序与拆分前逐字一致。
        this._uiRoot.draw(builder, this.play.palette);
    }

    onPause(): void {
        if (this._phase.screen === 'play') this.play.onPause();
    }

    onResume(): void {
        if (this._phase.screen === 'play') this.play.onResume();
    }

    dispose(): void {
        for (const off of this._adOffs) off();
        this.play.dispose();
        this.meta?.dispose();
    }

    // ───────────────────────────────────────────────────────────── routing

    /** 暂停次钮「回主菜单」：切菜单、清 overlay（本局弃置——`play.abandonRun()`) 。 */
    showMenu(): void {
        this.play.abandonRun();
        this._phase.resetTo('menu');
        this._cancelPageFx();
        this._emitOverlay(true);
    }

    /**
     * 主菜单主钮「开始游戏」：**开当前关**，扣 1 心。真机反馈裁定（WXG-T-165）
     * ——「回主菜单」弃本局棋盘、关卡解锁进度留。
     * @returns true 当且仅当已进入玩法（0 心 ⇒ false，留在菜单走广告加心激励位）。
     */
    startGame(): boolean {
        return this._startLevel(this.play.levelIndex);
    }

    /**
     * 进玩法统一下入口：扣心→切屏→`goToLevel(index)` 装配该局。0 心不切屏：
     * 留本页 + 拉起**既有**广告加心激励位（EP13-S3 · `tls §4-R7`，零新数值）。
     *
     * `acrossArc = true`（S-4）= 门票授权的跨章首格入口：**扣心之后**才把既有两根进度指针
     * 推到该关（{@link BeadsGame.unlockAcrossArc}）——「已进入过」的事实就落在推进位上（I7），
     * ⛔ 新增布尔、⛔ 在 0 心被拒的腿上写档。
     */
    private _startLevel(index: number, acrossArc = false): boolean {
        if (!this.meta) return false;
        if (!this.meta.spendStamina(STAMINA_START_COST)) {
            this._requestStaminaRefill();
            return false;
        }
        if (acrossArc) this.play.unlockAcrossArc(index);
        this._phase.resetTo('play');
        this._cancelPageFx();
        this._emitOverlay(false);
        this.play.goToLevel(index); // 棋盘复位到该关初始（关卡指针/解锁进度不变）
        return true;
    }

    /**
     * 菜单侧 0 心广告加心位（§3.11 第二 live 位；§3.14 v1.80 由「回满」改固定加心）。
     * 无广告服务/无 meta/已有在飞/日限用尽 ⇒ 零副作用（被拒即停在本页，可再点）。
     */
    private _requestStaminaRefill(): void {
        const ad = this._services?.rewardedAd;
        if (!ad || !this.meta || this._refillPending) return;
        if (!this.meta.canWatchHeartAd) return; // 满心 / 日限用尽 ⇒ 不拉广告
        this._refillPending = true;
        ad.load(STAMINA_REFILL_PLACEMENT);
        ad.show();
    }

    /** 道具超限购买扣款（§3.6 v1.80）：豆子够则扣并放行，否则 false（play 侧只落轻提示）。 */
    private _buyPowerup(type: PowerupType): boolean {
        const meta = this.meta;
        if (!meta) return false;
        return meta.spendCoins(powerupBuyPrice(type));
    }

    /**
     * Drive a menu tap in design space (tests/harness without faking pointer
     * events — mirrors `BeadsGame.tapDesign`). @returns true when consumed.
     * ⚠ **未解锁作品格 / 越界槽 = `false`**（零热区零事件口径的机械可证面：不被任何控件消费，
     * 与真输入通道 `_readMenuInput` 走同一个 {@link _dispatchMetaTap}）。
     */
    tapMeta(x: number, y: number): boolean {
        return this._dispatchMetaTap(x, y);
    }

    /** 命中 + 派发的唯一腿（菜单 / overlay 共用）；返回是否被控件消费。 */
    private _dispatchMetaTap(x: number, y: number): boolean {
        const btn = hitTestMeta(this._phase.overlay, x, y, this._viewData.anchors);
        if (!btn) return false;
        return this._applyMetaAction(btn);
    }

    /** @returns false = 该点未消费任何状态变更（留菜单、不扣心、不发事件）。 */
    private _applyMetaAction(btn: MetaButton): boolean {
        const action: MetaAction = btn.id;
        switch (action) {
            case 'start':
                this.startGame();
                return true;
            case 'open-levels':
                // menu-architecture §1.3 第五轮：主菜单走马灯卡 = 菜单唯一选关入口（点卡 → 开 `levels` overlay）。
                // ⇒ 本分支从「代码保留腿」（Q5①）转正为**实际入口**；墙下移到该 overlay（选关能力不丢）。
                // EP13-S4 · R13：末页空橱窗无大关实体 ⇒ 零事件（不切 overlay、不发事件）。
                if (this._menu.offset >= ARC_OPEN_MAX) return false;
                // EP13-S2：记下当前大关页 ⇒ 选关页只列本大关清单（tls §4 注 A：闸门本身不动）。
                this._phase.openLevels(this._menu.offset);
                this._refreshArcGate(this._phase.levelsArc); // S-4：门票 / n/N 只在此刻算（⛔ 每帧）
                this._emitOverlay(true);
                this._beginPageFx(1);
                return true;
            // `[WXG-T-280]` 橱窗 ◀▶：只在锚定档热区表里存在 ⇒ 静态档零影响；语义 = 已通序翻页（集合归本 shell）。
            case 'carousel-prev':
                this._menu.nudge(-1, this._clock());
                return true;
            case 'carousel-next':
                this._menu.nudge(1, this._clock());
                return true;
            case 'pick-level': {
                const slot = btn.slot;
                // 陈列序 = 配置文件顺序（恒等，槽位 = 关索引）；映射仍经 `_wallSlotsFor()`（保留 slot 间接层，视图契约不变）。
                const levelIdx = slot === undefined ? undefined : this._wallSlotsFor()[slot];
                if (levelIdx === undefined) return false;
                // `[WXG-T-345]` S-4：章内线性（§3.7 v1.78「过一开一」）**⛔ 变** —— 线性已开 ⇒
                // 直接放行，**不再复核门票**。棘轮的全部凭据 = 既有推进位已越过该关（I7），
                // ⛔ 新增「已进入」布尔；门票也只在章界那一刻参与（`_persistProgress` 的钳制腿）。
                if (levelIdx + 1 <= this.play.maxUnlockedLevel) {
                    this._startLevel(levelIdx);
                    return true;
                }
                // 线性未开 = 只可能是**本章首格 + 章界未过**（解锁位被 `_persistProgress` 钳在章末）。
                // 门票是唯一额外放行依据：章未开 ⇒ 零事件 / 零扣心 / 不消费；章首之外 ⛔ 用门票越权。
                if (slot !== 0 || !this._arcTicketSatisfied(this._phase.levelsArc).satisfied) return false;
                this._startLevel(levelIdx, true);
                return true;
            }
            case 'studio-import':
                this._importFromStudio();
                return true;
            case 'open-signin':
                this._cancelPageFx();
                this._phase.openModal('signin');
                this._emitOverlay(true);
                return true;
            case 'open-settings':
                this._cancelPageFx();
                this._phase.openModal('settings');
                this._emitOverlay(true);
                return true;
            // `[WXG-T-363]` 装扮馆入口（设置弹窗行5 左格，钮面与原换肤循环钮同串）。
            case 'open-skins':
                this._cancelPageFx();
                this._phase.openModal('skins');
                this._emitOverlay(true);
                return true;
            // `[WXG-T-363]` 装扮馆点卡 = 买断闭环：已拥有 ⇒ 直接穿上；未拥有 ⇒ **先买后穿**；
            // `coins` 不足 ⇒ `buySkin` 返回 false ⇒ 零扣款零入档零穿肤零事件（⛔ 部分成交）。
            case 'skin-tap': {
                const skin = registeredSkins()[btn.slot ?? -1];
                if (!skin) return false;
                const m = this.meta;
                if (m && !m.ownsSkin(skin.id) && !m.buySkin(skin.id)) return false;
                this.play.wearSkin(skin.id);
                return true;
            }
            case 'back':
                // UI-42 前置（WXG-T-314）：**仅选关页**走淡出 150ms（弹窗仍即时关，口径不变）。
                // 淡出期间 overlay 仍归页（命中路径不变）⇒ 终点才置 `none` 并发关闭事件。
                if (this._phase.overlay === 'levels') {
                    this._beginPageFx(-1);
                } else {
                    this._phase.close();
                    this._emitOverlay(false);
                }
                return true;
            case 'claim':
                this.meta?.claimSignin();
                return true;
            default:
                // toggle-* 与 PausePanelAction 同串值：复用 play 的设置 setter（两入口一致）。
                // EP11-S5 行4 的 cycle-bead-style / cycle-bead-size 同样走本 default 分支
                // （⛔ 不新造动作名、不在 shell 里重定向）。
                this.play.applySettingsAction(action as PausePanelAction);
                return true;
        }
    }

    /**
     * `[WXG-T-314]` 开一段选关页转场：`dir` 1 = 淡入（200ms）、-1 = 淡出（150ms）。
     * 时长直接引用 `ux-spec §5` 的既有常量（`PANEL_IN_MS` / `PANEL_OUT_MS`）⇒ 零新毫秒值。
     * 已在转场中：淡出不自套（重按 back 零副作用）；淡入重入则从 0 重来（菜单重开）。
     */
    private _beginPageFx(dir: 1 | -1): void {
        // D1（reduceMotion）：页面转场整段关停 —— 淡入直接静息；淡出同帧离页（WXG-T-321 裁定，
        // 仅页面转场；弹窗 `面板入 / 出` 200/150 不变）。
        if (this.play.reduceMotion) {
            this._cancelPageFx();
            if (dir === -1) {
                this._phase.close();
                this._emitOverlay(false);
            }
            return;
        }
        if (dir === -1 && this._pageFxDir === -1) return;
        this._pageFxDir = dir;
        this._pageFxT = 0;
    }

    /** 取消在途转场（进玩法 / 开弹窗 / 回菜单等改道）⇒ 下一帧走静息路径。 */
    private _cancelPageFx(): void {
        this._pageFxDir = 0;
        this._pageFxT = 0;
    }

    /**
     * 推进转场（`dt` 固定步进，⛔ 不用墙钟）：淡出终点才置 `overlay = none` 并发关闭事件。
     * 淡入终点不改任何状态（页在入口处就已可交互）。
     */
    private _stepPageFx(dt: number): void {
        const dir = this._pageFxDir;
        if (dir === 0) return;
        const durMs = dir === 1 ? PANEL_IN_MS : PANEL_OUT_MS;
        this._pageFxT += dt * (1000 / durMs);
        if (this._pageFxT < 1) return;
        this._pageFxT = 0;
        this._pageFxDir = 0;
        if (dir === -1) {
            this._phase.close(); // 淡出终点才离页（期间命中仍归页，WXG-T-314）
            this._emitOverlay(false);
        }
    }

    /**
     * 一键导入（WXG-T-179 调试）：拉取服务最新一条结果 → 校验转形 → 追加进关表并直接入局。
     * 不走扣心闸门（调试通道，不污染 §3.14 体力语义）；结果经 `meta:studio-import` 事件回报告知 UI。
     */
    private _importFromStudio(): void {
        const studio = this._studio;
        if (!studio || this._studioBusy) return;
        this._studioBusy = true;
        const bus = this._services?.events as unknown as { emit?: (t: string, p: unknown) => void } | undefined;
        const done = (ok: boolean, detail: string): void => {
            this._studioBusy = false;
            // 失败不得只进事件（无 UI 监听 ⇒ 静默）；console 是调试通道的最低反馈（WXG-T-179）。
            console.info(`[studio] ${ok ? '导入成功' : '导入失败'}：${detail}`);
            bus?.emit?.('meta:studio-import', { ok, detail });
        };
        const get: HttpGet =
            studio.get ??
            ((url: string): Promise<unknown> =>
                (globalThis as unknown as { fetch: (u: string) => Promise<{ json(): Promise<unknown> }> }).fetch(url).then((r) => r.json()));
        importLatest(studio.baseUrl, get).then(
            (outcome) => {
                if (!outcome.ok || !outcome.level) return done(false, outcome.errors[0] ?? '导入失败');
                const errs = this.play.importLevel(outcome.level);
                if (errs.length) return done(false, errs[0] ?? '校验失败');
                this._phase.resetTo('play');
                this._cancelPageFx();
                this._emitOverlay(false);
                done(true, outcome.level.name);
            },
            (e: unknown) => done(false, String((e as { message?: string })?.message ?? e)),
        );
    }

    private _readMenuInput(): void {
        const services = this._services;
        if (!services) return;
        const snap = services.input.snapshot;
        services.viewport.screenToDesign(this._pointer, snap.x, snap.y);
        if (snap.justDown) {
            const btn = hitTestMeta(this._phase.overlay, this._pointer.x, this._pointer.y, this._viewData.anchors);
            if (btn?.id === 'open-levels' && this._phase.overlay === 'none') {
                // 点在玻璃上先记下来，松手再决定是点按还是翻页。
                this._menu.press(this._pointer.x, this._pointer.y, this._clock());
            } else {
                this._menuPress = btn; // 抬起提交门：按下不派发，只登记（未命中任何钮 = null）
            }
        } else if (this._menu.glass && snap.isDown) {
            this._menu.move(this._pointer.x, this._pointer.y, this._clock());
        }
        if (!snap.isDown) {
            // 抬起帧：先结玻璃手势，再结按钮提交门（旧写法在此提前 return ⇒ 一固定步内的
            // down+up（WXG-T-170 真机亚帧快点击）被整段吞掉，本序顺带补上）。
            if (this._menu.glass) this._releaseGlass();
            this._commitMenuPress();
            this._viewData.pressed = null;
            return;
        }
        // 拖玻璃时不点亮滑过的别的钮。
        this._viewData.pressed = this._menu.dragging
            ? null
            : hitTestMeta(this._phase.overlay, this._pointer.x, this._pointer.y, this._viewData.anchors);
    }

    /**
     * 抬起提交门的抬起腿（WXG-T-295）：抬起点仍命中**同一颗钮**（id + slot）才按旧腿派发；
     * 拖出热区 / 换钮 ⇒ 静默取消（零事件、零扣心、不发 `meta:overlay`）。无论提交或取消都清登记。
     */
    private _commitMenuPress(): void {
        const press = this._menuPress;
        this._menuPress = null;
        if (!press) return;
        const hit = hitTestMeta(this._phase.overlay, this._pointer.x, this._pointer.y, this._viewData.anchors);
        if (!hit || hit.id !== press.id || hit.slot !== press.slot) return;
        this._applyMetaAction(hit);
    }

    /** 松手：点按 ⇒ 进选关；拖动 ⇒ 翻页 / 回弹已在 Presenter 内启动。 */
    private _releaseGlass(): void {
        if (this._menu.release(this._clock()) !== 'open') return;
        this._phase.openLevels(this._menu.offset); // EP13-S2：同 `open-levels`（两入口同上下文）
        this._refreshArcGate(this._phase.levelsArc); // S-4：同 `open-levels`（两入口同口径）
        this._emitOverlay(true);
        this._beginPageFx(1);
    }

    /**
     * 作品墙陈列序（EP12-S6 Deliverable 2/6）：返回**缓存引用**，命中缓存时零分配、零排序。
     * 失效键 = `play.levelCount` ∪ **当前大关页**（EP13-S2：关表变长、或 `levels` 页切大关 ⇒ 清单变）。
     * ⚠ 同批产出 `slot → 关卡引用`（`_wallLevels`）⇒ 两表永远同步，不存在第二份失效键。
     */
    private _wallSlotsFor(): readonly number[] {
        const n = this.play.levelCount;
        const arc = this._phase.levelsArc;
        if (n !== this._wallSlotsForCount || arc !== this._wallSlotsForArc) {
            this._wallSlots = this._rebuildWallSlots(arc, n);
            this._wallLevels = this._rebuildWallLevels(this._wallSlots);
            this._wallSlotsForCount = n;
            this._wallSlotsForArc = arc;
            // S-4：换页 / 关表变长 ⇒ 门票与 n/N 同批重算（非每帧：只在重建分支）。
            this._refreshArcGate(this._phase.levelsArc);
        }
        return this._wallSlots;
    }

    /** `slot → 关卡引用`（先走 {@link _wallSlotsFor} 的同批重建，再取缓存引用 ⇒ 每帧零分配）。 */
    private _wallLevelsFor(): readonly (BeadsLevelRaw | undefined)[] {
        this._wallSlotsFor();
        return this._wallLevels;
    }

    /**
     * 按已定陈列序取关卡本体。基准表外的项（beads-studio 导入的追加关）在本 shell 可见面内
     * **无 raw** ⇒ `undefined` ⇒ 视图该格回落编号占位（与本文件注的「DI 不可得 ⇒ 墙尾后置」同限制）。
     */
    private _rebuildWallLevels(slots: readonly number[]): readonly (BeadsLevelRaw | undefined)[] {
        const base = this._wallBaseLevels;
        const out: (BeadsLevelRaw | undefined)[] = [];
        for (let s = 0; s < slots.length; s++) out.push(base[slots[s]!]);
        return out;
    }

    /**
     * `slot → levelIndex` = **本大关清单展开**（EP13-S2，`tls §4` 注 A：只换集合来源）：
     * 大关行的 `levelRefs`（1-based 连续区间）逐区间展开为 0-based 关索引，按区间书写序排列；
     * 截断到 `WALL_CAPACITY`（本版 9 ≤ 12 ⇒ 不触发溢出；清单短于容量 ⇒ 空槽由视图读成
     * `undefined` ⇒ 画空槽、零事件）。大关页无实体（空橱窗页）或清单为空 ⇒ 空表（R12 空态）。
     * 保留 `slot` 间接层（视图 `MetaButton` 契约不变，仍拿不到关索引）。
     * ponytail: 每次重建走区间循环 ≤ `WALL_CAPACITY` 次，非评分热点；若日后清单行多到百级再谈预展开。
     */
    private _rebuildWallSlots(arc: number, n: number): readonly number[] {
        const slots: number[] = [];
        const refs = ARCS[arc]?.levelRefs;
        if (!refs) return slots;
        for (let r = 0; r < refs.length; r++) {
            const [from, to] = refs[r]!;
            for (let lv = from; lv <= to && slots.length < WALL_CAPACITY && lv <= n; lv++) slots.push(lv - 1);
        }
        return slots;
    }

    /** 大关收尾关（`levelRefs` 末区间 `to`，1-based）→ 关卡本体；越界/空表 ⇒ `undefined`。 */
    private _arcBossLevel(arcIdx: number): BeadsLevelRaw | undefined {
        const refs = ARCS[arcIdx]?.levelRefs;
        if (!refs) return undefined;
        const last = refs[refs.length - 1]!;
        return this._wallBaseLevels[last[1] - 1];
    }

    /**
     * 大关三态归约（`tls §8.2 TODO-6` 已裁 = 甲，只换数据源）：
     * 任一关可进未通 ⇒ `pushing`；全通关 ⇒ `cleared`；一关未开 ⇒ `locked`；空清单 ⇒ `undefined`（R12）。
     * 单趟整数循环、零分配（本池 9 关 ⇒ 每帧至多两页 × 9）。
     */
    private _arcState(arcIdx: number): MetaBossState | undefined {
        const refs = ARCS[arcIdx]?.levelRefs;
        if (!refs) return undefined;
        const stars = this.play.starsByLevelRaw;
        const maxUnlocked = this.play.maxUnlockedLevel;
        const n = this.play.levelCount;
        let anyLevel = false;
        let anyUnlocked = false;
        let allCleared = true;
        for (let r = 0; r < refs.length; r++) {
            const range = refs[r]!;
            for (let lv = range[0]; lv <= range[1] && lv <= n; lv++) {
                anyLevel = true;
                if (lv <= maxUnlocked) anyUnlocked = true;
                if ((stars[lv - 1] ?? 0) <= 0) allCleared = false;
            }
        }
        if (!anyLevel) return undefined;
        if (!anyUnlocked) return 'locked';
        return allCleared ? 'cleared' : 'pushing';
    }

    /**
     * `[WXG-T-345]` S-4 **章门票闸门 + 只读告知件的唯一计算点**（ADR-0034 §6 S-4 行；
     * `meta-ui §2.7` 两层分家；`ux v1.10 §4.1（3-补）`）。
     *
     * 调用点 = 墙表重建 / 开选关页（两入口）/ 走马灯页位落定（{@link _refreshArcGateOnMenuPage}，
     * 只在 `_menu.step` 推完吸附后比较一次）—— **⛔ 每帧重算**。
     * 结果写进 `_viewData` 的三个 primitive（视图只渲染、⛔ 二次推导，L5）。
     *
     * 口径（主理人 C/D 拍定）：
     * - `arcTicketOpen` = **入口闸门** = 门票成立 ∨ 既有推进位已越过章首（I7 棘轮；首章无前置⇒恒真）。
     *   ⛔ 复用橱窗三态 `MetaBossState`（那是显示层按 ≥1★ 算的，两层不混判）。
     * - `n/N` 取**阻断该页入口的上一章**（⛔ 被锁页自身：它恒 n=0）；N=0 / 门票已达成 /
     *   入口已得 ⇒ `undefined`（**不创建**进度件，⛔ `0/0`）。
     * - 进度件数值 = **累计星 / 门槛**（`starSum` / `gate`，R7 v0.5），⛔ 满星关数。
     */
    private _refreshArcGate(arc: number): void {
        const ticket = this._arcTicketSatisfied(arc);
        // 棘轮：推进位已越过该章首关 ⇒ 入口是**已得**的（内容再变也不回收，I7 / §8-20）。
        // 空橱窗页（无 ARCS 行）⇒ `?? 1` ⇒ 不锁（该页无实体，R13 零事件）。
        const firstLevel = ARCS[arc]?.levelRefs[0]?.[0] ?? 1;
        const open = ticket.satisfied || this.play.maxUnlockedLevel >= firstLevel;
        const show = !open && ticket.total > 0;
        this._viewData.arcTicketOpen = open;
        this._viewData.arcStarGot = show ? ticket.starSum : undefined;
        this._viewData.arcStarNeed = show ? ticket.gate : undefined;
        this._gateArc = arc;
    }

    /**
     * `[WXG-T-346 取证补漏]` 走马灯页位落定 ⇒ 进度件跟着**当前页**走。
     * 没有这一腿，翻页只动 `_menu.offset`（`levelsArc` 只在开选关页时才变）⇒ 木牌第二行
     * 要么不出现、要么残留上一页的数字。比较只读一个 int（零分配），归约仍只在变号时发生。
     */
    private _refreshArcGateOnMenuPage(): void {
        if (this._phase.overlay !== 'none') return;
        if (this._menu.offset === this._gateArc) return;
        this._refreshArcGate(this._menu.offset);
    }

    /**
     * 归约「第 `arc` 章的门票」= **上一章清单** × 展平星账（首章 ⇒ 无前置 ⇒ 放行），
     * 委托纯函数 {@link arcEntryTicket}（DEC-8 判据源隔离）；结果写进复用出参，零分配。
     */
    private _arcTicketSatisfied(arc: number): ArcTicketResult {
        const hasPrev = this._prepareArcPrev(arc);
        return arcEntryTicket(this.play.starsByLevelRaw, hasPrev ? this._arcPrevSlots : undefined, this._arcTicket);
    }

    /**
     * 确保 {@link _arcPrevSlots} = 第 `arc` 章的**上一章**清单（0-based，`levelRefs` 展开）；
     * 返回「存在上一章」。缓存键 = (arc, 关表长)（导入追加关 ⇒ 重建；非热路径）。
     * ⚠ 只看区间（章清单的**位置事实**），不读章 id（M-16）。
     */
    private _prepareArcPrev(arc: number): boolean {
        const levelCount = this.play.levelCount;
        if (arc === this._arcPrevArc && levelCount === this._arcPrevCount) return this._arcPrevPresent;
        this._arcPrevArc = arc;
        this._arcPrevCount = levelCount;
        this._arcPrevSlots.length = 0;
        const refs = arc > 0 ? ARCS[arc - 1]?.levelRefs : undefined;
        if (refs) {
            for (let r = 0; r < refs.length; r += 1) {
                const range = refs[r]!;
                for (let lv = range[0]; lv <= range[1] && lv <= levelCount; lv += 1) this._arcPrevSlots.push(lv - 1);
            }
        }
        this._arcPrevPresent = refs !== undefined;
        return this._arcPrevPresent;
    }

    /** 关索引 → 所属大关下标（`levelRefs` 1-based 区间）；无归属 ⇒ `-1`（数据异常，⛔ 猜）。 */
    private _arcIndexOfLevel(index: number): number {
        const lv = index + 1;
        for (let a = 0; a < ARCS.length; a += 1) {
            const refs = ARCS[a]?.levelRefs;
            if (!refs) continue;
            for (let r = 0; r < refs.length; r += 1) {
                const range = refs[r]!;
                if (lv >= range[0] && lv <= range[1]) return a;
            }
        }
        return -1;
    }

    /**
     * 跨章推进闸门（传给 `BeadsGame.canAdvanceAcrossArc`）：门票**只在章界那一刻**参与解锁位推进。
     * - 同章 / 无归属（dev 导入关）/ 非相邻跨章 ⇒ 放行（闸门只守相邻章界，⛔ 兜数据异常）；
     * - 相邻跨章（`to` = 下一章首关）⇒ 目标章门票（= 上一章全通关且累计星达标）。
     */
    private _canAdvanceAcrossArc(fromIndex: number, toIndex: number): boolean {
        const fromArc = this._arcIndexOfLevel(fromIndex);
        const toArc = this._arcIndexOfLevel(toIndex);
        if (fromArc < 0 || toArc < 0 || fromArc === toArc) return true;
        if (toArc !== fromArc + 1) return true;
        return this._arcTicketSatisfied(toArc).satisfied;
    }

    private _metaViewData(): MetaViewData {
        const v = this._viewData;
        const m = this.meta;
        v.stamina = m ? m.stamina : 0;
        v.staminaMax = m ? m.staminaMax : 0;
        // §3.14 v1.80 日限可见：菜单资源条「心」端在未满心时显示今日剩余广告加心次数。
        v.heartAdsLeft = m ? m.heartAdsLeft : 0;
        v.coins = m ? m.coins : 0;
        v.overlay = this._phase.overlay;
        // UI-42 前置（WXG-T-314）：选关页不透明度（淡入 ease-out、淡出 ease-in；静息 = undefined）。
        v.pageFade = this._pageFxDir === 0
            ? undefined
            : this._pageFxDir === 1
                ? 1 - (1 - this._pageFxT) * (1 - this._pageFxT)
                : 1 - this._pageFxT * this._pageFxT;
        // `[WXG-T-340]` 选关页空带大关名（§11.4：与墙同源 = `levelsArc` 的大关 title；⛔ 不借 boss 关派生 title）。
        v.chapterTitle = ARCS[this._phase.levelsArc]?.title;
        v.signinDay = m ? m.signinDay : 0;
        v.canClaim = m ? m.canClaim : false;
        v.bgmMuted = this.play.bgmMuted;
        v.sfxMuted = this.play.sfxMuted;
        v.reduceMotion = this.play.reduceMotion;
        v.largeText = this.play.largeText;
        v.vibrate = this.play.vibrateOn;
        v.debugInfo = this.play.debugInfo;
        v.debugGuides = this.play.debugGuides;
        // EP11-S5 行4 两钮回显（与暂停面板共读同一对 getter ⇒ 两入口恒一致）。
        v.beadStyle = this.play.beadStyle;
        v.beadSize = this.play.beadSize;
        // EP12-S8 皮肤钮回显（同一 getter 单源）。
        v.skinId = this.play.skinId;
        // 选关屏数据（均只读引用，零分配）。
        v.levelCount = this.play.levelCount;
        v.currentLevelIndex = this.play.levelIndex;
        v.maxUnlockedLevel = this.play.maxUnlockedLevel;
        v.starsByLevel = this.play.starsByLevelRaw;
        // 陈列序映射：只读引用缓存表（每帧零分配）。
        v.wallSlots = this._wallSlotsFor();
        // 槽位 → 关卡引用（同一缓存批，T-2B 缩略聚合的只读入口）。
        v.wallLevels = this._wallLevelsFor();
        // 走马灯 = **大关页**（EP13-S4，C-2 ③⑤；Q16 = 甲）：代表图 = 该大关收尾关（boss）的橱窗图
        // （`ARCS[页].textureId`），三态 = `ARCS[页].levelRefs` 归约（判据见 {@link _arcState}）。
        // 末页 `ARC_OPEN_MAX` = 空橱窗（无大关实体 ⇒ 点图零事件，R13）。
        const off = this._menu.offset;
        const soon = off >= ARC_OPEN_MAX;
        v.carouselComingSoon = soon;
        // `[BD-62]` 边界可见性：与 `nudge` 的 clamp 同语义（首张无上一可翻、末张无下一可翻）。
        // ⇒ 视图不再画越界那一侧的箭头（旧行为 = 两端一直画，点了无反应）。
        v.carouselFirst = off <= 0;
        v.carouselLast = off >= this._menu.pages - 1;
        v.carouselLevel = soon ? undefined : this._arcBossLevel(off);
        v.carouselState = soon ? undefined : this._arcState(off);
        v.carouselTextureId = soon ? undefined : ARCS[off]?.textureId;
        v.carouselDx = this._menu.dx;
        v.carouselT = this._menu.t;
        const sign = this._menu.peerSign();
        const pi = off + sign;
        const peerSoon = sign !== 0 && pi === ARC_OPEN_MAX;
        const peerPage = sign !== 0 && pi >= 0 && pi < ARC_OPEN_MAX ? pi : -1;
        v.carouselPeerComingSoon = peerSoon;
        v.carouselPeerSign = sign === 0 ? undefined : sign;
        if (peerPage < 0) {
            v.carouselPeer = undefined;
            v.carouselPeerState = undefined;
            v.carouselPeerTextureId = undefined;
        } else {
            v.carouselPeer = this._arcBossLevel(peerPage);
            v.carouselPeerState = this._arcState(peerPage);
            v.carouselPeerTextureId = ARCS[peerPage]?.textureId;
        }
        v.studioEnabled = this._studio !== undefined;
        return v;
    }

    private _emitOverlay(open: boolean): void {
        const services = this._services;
        if (!services) return;
        const bus = services.events as unknown as { emit: (t: string, p: unknown) => void };
        bus.emit('meta:overlay', { open, name: open ? this._phase.overlay : 'none' });
    }
}

/**
 * Harness/host factory. `clock` defaults to `Date.now`; production hosts may
 * pass a platform wall clock. Mirrors `createBeadsGame` for drop-in use.
 */
export function createBeadsShell(options: Omit<BeadsShellOptions, 'clock'> & { clock?: () => number } = {}): BeadsShell {
    return new BeadsShell({ ...options, clock: options.clock ?? ((): number => Date.now()) });
}
