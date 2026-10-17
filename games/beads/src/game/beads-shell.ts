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
 * （经注入 play 的 `canStartRun` 闸门）。0 心重试被拒 → play 触发体力回满激励位
 * （§3.11 第二 live 位），发奖经 `onStaminaRefill` → {@link MetaState.refillStamina} 后重放。
 * 冲刺消耗不冻结（§3.14），故 sprint 重开不设门。
 */

import type { Game, GameServices, RenderModelBuilder } from '@wxgame/framework';
import {
    FACET4_STYLE_ID,
    BEAD_SIZE_DEFAULT,
    STAMINA_START_COST,
    WALL_CAPACITY,
    MENU_CAROUSEL,
    MENU_CLIP,
    menuAnchors,
    type MenuAnchors,
} from '../config/tuning.js';
import { carouselDamp, carouselPage } from '../config/menu-carousel.js';
import { ARC_OPEN_MAX } from '../config/arcs.js';
import { BeadsGame, type BeadsGameOptions } from './beads-game.js';
import { LEVELS } from '../config/levels.js';
import type { BeadsLevelRaw } from '../config/levels-data.js';
// 2026-10-10 #2：墙序改配置文件顺序（恒等），本文件不再按 DI 排序 ⇒ 移除 difficultyOf 依赖
// （DI 真源仍住 difficulty.ts，供门禁⑥/分带用）。
import { MetaState } from './meta-state.js';
import {
    buildMetaView,
    hitTestMeta,
    type MetaAction,
    type MetaBossState,
    type MetaButton,
    type MetaOverlay,
    type MetaViewData,
} from '../view/meta-view.js';
import { DEFAULT_SKIN_ID } from '../config/skins/registry.js';
import type { BeadsPalette } from '../view/palette.js';
import type { PausePanelAction } from '../systems/pause-panel.js';
import { importLatest, type HttpGet } from './level-import.js';

export type ShellScreen = 'play' | 'menu';

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
    private _screen: ShellScreen;
    private _overlay: MetaOverlay = 'none';
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
    /** Scratch pointer for screen→design (never retained), same as BeadsGame. */
    private readonly _pointer = { x: 0, y: 0 };
    /** Reused view-data object — buildRenderModel must not allocate (热路径零分配). */
    private readonly _viewData = {
        stamina: 0,
        staminaMax: 0,
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
        levelCount: 0,
        currentLevelIndex: 0,
        maxUnlockedLevel: 1,
        starsByLevel: [] as readonly number[],
        // 陈列序映射（每帧只读引用；表由 _wallSlotsFor() 一次性缓存）。
        wallSlots: [] as readonly number[],
        // 槽位 → 关卡引用（T-2B 缩略聚合的 pattern 入口；与 wallSlots 同批缓存，每帧只读）。
        wallLevels: [] as readonly (BeadsLevelRaw | undefined)[],
        // 走马灯小卡（menu-architecture §1.3）：boss = 已通关集合里进度最远那关（配置序末位）；一关未通 ⇒ undefined。
        carouselLevel: undefined as BeadsLevelRaw | undefined,
        carouselState: undefined as MetaBossState | undefined,
        carouselDx: 0,
        carouselT: 0,
        carouselPeer: undefined as BeadsLevelRaw | undefined,
        carouselPeerState: undefined as MetaBossState | undefined,
        carouselPeerSign: undefined as (-1 | 1) | undefined,
        carouselComingSoon: false,
        carouselPeerComingSoon: false,
        studioEnabled: false,
        /** 按下态：`hitTestMeta` 返回的缓存钮引用（每帧由 `_readMenuInput` 覆盖，零分配）。 */
        pressed: null as MetaButton | null,
    };
    /** ◀▶ 翻页位（`[WXG-T-280]` 落地单 §3；进界由 `_fillCarousel` 钳在陈列序内）。 */
    private _carouselOffset = 0;
    private _carouselDx = 0;
    private _carouselT = 0;
    private _shown = 0;
    private _pushingSlot = -1;
    private _glass = false;
    private _dragging = false;
    private _pressX = 0;
    private _pressY = 0;
    private _lastX = 0;
    private _lastT = 0;
    private _vx = 0;
    private _animOn = false;
    private _animFrom = 0;
    private _animTo = 0;
    private _animStart = 0;
    private _animDir: -1 | 0 | 1 = 0;
    /** 已通槽逆序 scratch（复用数组 ⇒ 每帧零分配；`[0]` = 进度最远）。 */
    private readonly _carouselOrder: number[] = [];

    constructor(options: BeadsShellOptions) {
        this._clock = options.clock;
        this._metaKey = options.metaKey;
        this._studio = options.studio;
        this._screen = options.initialScreen ?? 'menu';
        this._wallBaseLevels = options.play?.levels ?? LEVELS;
        this.play = new BeadsGame({
            // EP12-S8：shell 级 palette 选项真正下传 play（此前只作用于菜单侧的独立副本，
            // 与 play 各持一份；收编单源后默认肤 tokens = DEFAULT_PALETTE，缺省行为不变）。
            ...(options.palette !== undefined ? { palette: options.palette } : {}),
            ...(options.play ?? {}),
            // 暂停面板「回主菜单」次钮 → 切到菜单（真机反馈裁定：弃本局棋盘——下次「开始游戏」= 全新开当前关）。
            onMenuRequest: () => this.showMenu(),
            // 新局开局体力闸门（§3.14）：retry/restart 前扣 1 心；0 心返回 false（play 转广告回满）。
            canStartRun: () => (this.meta ? this.meta.spendStamina(STAMINA_START_COST) : true),
            // 体力回满激励位发奖（§3.11 第二 live 位）：回满至 STAMINA_MAX，随后 play 重放 run-start。
            onStaminaRefill: () => this.meta?.refillStamina(),
        });
    }

    /** Clip → 合成配方，转交给宿主（沿 play 的音色库，ADR-0013）。 */
    get audioVoices(): BeadsGame['audioVoices'] {
        return this.play.audioVoices;
    }

    get screen(): ShellScreen {
        return this._screen;
    }

    get overlay(): MetaOverlay {
        return this._overlay;
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
        this._viewData.anchors = menuAnchors({
            safeTopDp: plat.isMiniGame ? plat.safeAreaTop : 0,
            capsuleBottomDp: plat.capsuleBottomDp,
            safeBottomDp: plat.isMiniGame ? plat.safeAreaBottom : 0,
            windowWidthDp: services.viewport.fit.screenWidth,
            designHeight: services.viewport.designHeight,
        });
        this.play.init(services);
        const bus = services.events as unknown as { emit: (t: string, p: unknown) => void };
        this.meta = new MetaState({
            storage: services.storage,
            clock: this._clock,
            emit: (type, payload) => bus.emit(type, payload),
            metaKey: this._metaKey,
        });
        // 启动路由（ux-spec v1.7 §6.3：直进玩法；0 心老玩家落菜单——体力系统生效，非违约）。
        if (this._screen === 'play') {
            if (this.meta.stamina < STAMINA_START_COST) {
                this._screen = 'menu';
            } else {
                this.meta.spendStamina(STAMINA_START_COST); // 首局开局扣心（§3.14）
            }
        }
    }

    update(dt: number): void {
        if (this._screen === 'play') {
            this.play.update(dt);
            return;
        }
        // 菜单：推进体力恢复（离线 f(Δt)）+ 读点击。play 冻结（不 update ⇒ 倒计时不走）。
        this.meta?.refresh();
        this._readMenuInput();
        this._stepCarousel();
    }

    buildRenderModel(builder: RenderModelBuilder): void {
        if (this._screen === 'play') {
            this.play.buildRenderModel(builder);
            return;
        }
        // EP12-S8：菜单侧消费 `play.palette`（换肤后菜单下一帧同步生效）⇒ 换肤「双面」
        // 的游戏内侧在两屏一致；`this.palette`（构造期选项）保留为兼容字段不再消费。
        buildMetaView(builder, this._metaViewData(), this.play.palette);
    }

    onPause(): void {
        if (this._screen === 'play') this.play.onPause();
    }

    onResume(): void {
        if (this._screen === 'play') this.play.onResume();
    }

    dispose(): void {
        this.play.dispose();
        this.meta?.dispose();
    }

    // ───────────────────────────────────────────────────────────── routing

    /** 暂停次钮「回主菜单」：切菜单、清 overlay（本局棋盘不保留——重进时由 {@link startGame} 复位）。 */
    showMenu(): void {
        this._screen = 'menu';
        this._overlay = 'none';
        this._emitOverlay(true);
    }

    /**
     * 主菜单主钮「开始游戏」：**开当前关**，扣 1 心。真机反馈裁定（WXG-T-165）
     * ——「回主菜单」弃本局棋盘、关卡解锁进度留。
     * @returns true 当且仅当已进入玩法（0 心 ⇒ false，留在菜单走回满广告）。
     */
    startGame(): boolean {
        return this._startLevel(this.play.levelIndex);
    }

    /** 进玩法统一下入口：扣心→切屏→`goToLevel(index)` 装配该局。0 心不切屏。 */
    private _startLevel(index: number): boolean {
        if (!this.meta || !this.meta.spendStamina(STAMINA_START_COST)) return false;
        this._screen = 'play';
        this._overlay = 'none';
        this._emitOverlay(false);
        this.play.goToLevel(index); // 棋盘复位到该关初始（关卡指针/解锁进度不变）
        return true;
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
        const btn = hitTestMeta(this._overlay, x, y, this._viewData.anchors);
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
                this._overlay = 'levels';
                this._emitOverlay(true);
                return true;
            // `[WXG-T-280]` 橱窗 ◀▶：只在锚定档热区表里存在 ⇒ 静态档零影响；语义 = 已通序翻页（集合归本 shell）。
            case 'carousel-prev':
                this._nudge(-1);
                return true;
            case 'carousel-next':
                this._nudge(1);
                return true;
            case 'pick-level': {
                const slot = btn.slot;
                // 陈列序 = 配置文件顺序（恒等，槽位 = 关索引）；映射仍经 `_wallSlotsFor()`（保留 slot 间接层，视图契约不变）。
                // 未解锁（`levelIdx+1 > maxUnlockedLevel`）与越界槽（映射表短于槽）一律零事件。
                const levelIdx = slot === undefined ? undefined : this._wallSlotsFor()[slot];
                if (levelIdx === undefined || levelIdx + 1 > this.play.maxUnlockedLevel) return false;
                this._startLevel(levelIdx);
                return true;
            }
            case 'studio-import':
                this._importFromStudio();
                return true;
            case 'open-signin':
                this._overlay = 'signin';
                this._emitOverlay(true);
                return true;
            case 'open-settings':
                this._overlay = 'settings';
                this._emitOverlay(true);
                return true;
            case 'back':
                this._overlay = 'none';
                this._emitOverlay(false);
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
                this._screen = 'play';
                this._overlay = 'none';
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
        if (!snap.isDown) {
            if (this._glass) this._releaseGlass();
            this._viewData.pressed = null;
            return;
        }
        services.viewport.screenToDesign(this._pointer, snap.x, snap.y);
        const now = this._clock();
        if (snap.justDown) {
            const btn = hitTestMeta(this._overlay, this._pointer.x, this._pointer.y, this._viewData.anchors);
            if (btn?.id === 'open-levels' && this._overlay === 'none') {
                // 点在玻璃上先记下来，松手再决定是点按还是翻页。
                this._animOn = false;
                this._glass = true;
                this._dragging = false;
                this._pressX = this._pointer.x - this._carouselDx;
                this._pressY = this._pointer.y;
                this._lastX = this._pointer.x;
                this._lastT = now;
                this._vx = 0;
            } else {
                if (btn) this._applyMetaAction(btn);
            }
        } else if (this._glass) {
            const raw = this._pointer.x - this._pressX;
            const dt = now - this._lastT;
            if (dt > 0) this._vx = (this._pointer.x - this._lastX) / dt;
            this._lastX = this._pointer.x;
            this._lastT = now;
            if (!this._dragging) {
                const adx = raw < 0 ? -raw : raw;
                const ady = this._pointer.y - this._pressY;
                const ay = ady < 0 ? -ady : ady;
                if (adx > MENU_CAROUSEL.tapPx || ay > MENU_CAROUSEL.tapPx) this._dragging = true;
            }
            if (this._dragging) {
                this._fillCarousel();
                this._setSlide(carouselDamp(raw, this._carouselOffset, this._shown));
            }
        }
        // 拖玻璃时不点亮滑过的别的钮。
        this._viewData.pressed = this._dragging
            ? null
            : hitTestMeta(this._overlay, this._pointer.x, this._pointer.y, this._viewData.anchors);
    }

    /** 松手：位移没过点按线 ⇒ 进选关；否则按阈值 / 快甩决定翻页或回弹。 */
    private _releaseGlass(): void {
        this._fillCarousel();
        const page = this._dragging ? carouselPage(this._carouselDx, this._vx, this._carouselOffset, this._shown) : 0;
        this._glass = false;
        if (!this._dragging) {
            this._dragging = false;
            this._overlay = 'levels';
            this._emitOverlay(true);
            return;
        }
        this._dragging = false;
        this._startAnim(page);
    }

    /** ◀▶ 与滑动松手共用。`page` 0 = 回到当前项。 */
    private _nudge(page: -1 | 1): void {
        if (this._animOn || this._dragging) return;
        this._fillCarousel();
        if (this._carouselOffset + page < 0 || this._carouselOffset + page >= this._shown) return;
        this._carouselDx = 0;
        this._startAnim(page);
    }

    private _startAnim(page: -1 | 0 | 1): void {
        this._animFrom = this._carouselDx;
        this._animTo = page === 0 ? 0 : page === 1 ? -MENU_CLIP.w : MENU_CLIP.w;
        this._animDir = page;
        this._animStart = this._clock();
        this._animOn = this._animFrom !== this._animTo;
        if (!this._animOn) this._setSlide(0);
    }

    private _setSlide(dx: number): void {
        this._carouselDx = dx;
        const w = MENU_CLIP.w;
        this._carouselT = w > 0 ? Math.min(1, Math.abs(dx) / w) : 0;
    }

    private _stepCarousel(): void {
        if (this._dragging) return;
        if (!this._animOn) {
            if (this._carouselDx !== 0 || this._carouselT !== 0) this._setSlide(0);
            return;
        }
        const u = (this._clock() - this._animStart) / MENU_CAROUSEL.snapMs;
        if (!(u < 1)) {
            this._carouselOffset += this._animDir;
            this._animOn = false;
            this._animDir = 0;
            this._setSlide(0);
            return;
        }
        const inv = 1 - u;
        const e = 1 - inv * inv * inv;
        this._setSlide(this._animFrom + (this._animTo - this._animFrom) * e);
    }

    /** 陈列序写进复用数组。返回值走字段，不分配。 */
    private _fillCarousel(): void {
        const slots = this._wallSlotsFor();
        const stars = this.play.starsByLevelRaw;
        const order = this._carouselOrder;
        order.length = 0;
        let pushingSlot = -1;
        for (let s = slots.length - 1; s >= 0; s--) {
            const idx = slots[s]!;
            if ((stars[idx] ?? 0) > 0) order.push(s);
            else pushingSlot = s;
        }
        if (pushingSlot !== -1) order.unshift(pushingSlot);
        this._pushingSlot = pushingSlot;
        // 前 ARC_OPEN_MAX 页是已开放大关；再加一页空橱窗（敬请期待）。
        this._shown = ARC_OPEN_MAX + 1;
        if (this._carouselOffset >= this._shown) this._carouselOffset = Math.max(0, this._shown - 1);
        if (this._carouselOffset < 0) this._carouselOffset = 0;
    }

    /** 相邻项在左（-1，内容右移）还是在右（+1）。没有则 0。 */
    private _peerSign(): -1 | 0 | 1 {
        if (this._animOn && this._animDir !== 0) return this._animDir;
        if (this._carouselDx > 0) return -1;
        if (this._carouselDx < 0) return 1;
        return 0;
    }

    /**
     * 作品墙陈列序（EP12-S6 Deliverable 2/6）：返回**缓存引用**，命中缓存时零分配、零排序。
     * 失效键 = `play.levelCount`（唯一能让关表变长的公开可见面 = `importLevel` 追加）。
     * ⚠ 同批产出 `slot → 关卡引用`（`_wallLevels`）⇒ 两表永远同步，不存在第二份失效键。
     */
    private _wallSlotsFor(): readonly number[] {
        const n = this.play.levelCount;
        if (n !== this._wallSlotsForCount) {
            this._wallSlots = this._rebuildWallSlots(n);
            this._wallLevels = this._rebuildWallLevels(this._wallSlots);
            this._wallSlotsForCount = n;
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
     * `slot → levelIndex` = **恒等**（配置文件顺序：`slot s` → 关卡索引 `s` = 关号 `s+1`）。
     * 2026-10-10 用户裁定 #2：退役 EP12-S6「按 DI 升序重排」⇒ 陈列序 = 解锁序 = id 序。
     * 难度递增改由**生成期门禁⑦**约束（新关按序追加、boss `kind:"boss"` 殿后），运行时不再排序。
     * 表长 = `min(n, WALL_CAPACITY)`：超出容量的关本 Story **不实现**（S6 Out），短于容量的空槽
     * 由视图读成 `undefined` ⇒ 画虚线空槽、零事件。保留 `slot` 间接层（视图 `MetaButton` 契约不变）。
     */
    private _rebuildWallSlots(n: number): readonly number[] {
        const slots: number[] = [];
        const shown = Math.min(n, WALL_CAPACITY);
        for (let s = 0; s < shown; s++) slots.push(s);
        return slots;
    }

    private _metaViewData(): MetaViewData {
        const v = this._viewData;
        const m = this.meta;
        v.stamina = m ? m.stamina : 0;
        v.staminaMax = m ? m.staminaMax : 0;
        v.coins = m ? m.coins : 0;
        v.overlay = this._overlay;
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
        // 走马灯 Boss 图（`[WXG-T-281]` 用户裁定：只展示 Boss 图、未通关置灰、点图进选关）：
        // 陈列集 = 「下一未通关」（进度最远，置灰）+ 已通集反序 ⇒ 默认 0 项即进度最远那关；
        //   ⛔ 每帧零 `difficultyOf`，单趟 ≤capacity 整数循环、零分配。星级即「已通关」判据（`starsByLevel[idx] > 0`）。
        // ponytail: 进度/boss 均在已陈列的 `wallSlots`（≤WALL_CAPACITY）内取；溢出未实现（S6 Out）⇒ 关表 >capacity 时需改全表扫描。
        const levels = v.wallLevels;
        this._fillCarousel();
        const order = this._carouselOrder;
        const pushingSlot = this._pushingSlot;
        const off = this._carouselOffset;
        const soon = off === ARC_OPEN_MAX;
        v.carouselComingSoon = soon;
        if (soon || off !== 0 || order.length === 0) {
            v.carouselLevel = undefined;
            v.carouselState = undefined;
        } else {
            const slot = order[0]!;
            const boss = levels[slot];
            v.carouselLevel = boss;
            v.carouselState = boss === undefined ? undefined : (slot === pushingSlot ? 'pushing' : 'cleared');
        }
        v.carouselDx = this._carouselDx;
        v.carouselT = this._carouselT;
        const sign = this._peerSign();
        const pi = off + sign;
        const peerSoon = sign !== 0 && pi === ARC_OPEN_MAX;
        v.carouselPeerComingSoon = peerSoon;
        v.carouselPeerSign = sign === 0 ? undefined : sign;
        if (sign === 0 || pi !== 0 || order.length === 0) {
            v.carouselPeer = undefined;
            v.carouselPeerState = undefined;
        } else {
            const peerSlot = order[0]!;
            const peer = levels[peerSlot];
            v.carouselPeer = peer;
            v.carouselPeerState = peer === undefined ? undefined : (peerSlot === pushingSlot ? 'pushing' : 'cleared');
        }
        v.studioEnabled = this._studio !== undefined;
        return v;
    }

    private _emitOverlay(open: boolean): void {
        const services = this._services;
        if (!services) return;
        const bus = services.events as unknown as { emit: (t: string, p: unknown) => void };
        bus.emit('meta:overlay', { open, name: open ? this._overlay : 'none' });
    }
}

/**
 * Harness/host factory. `clock` defaults to `Date.now`; production hosts may
 * pass a platform wall clock. Mirrors `createBeadsGame` for drop-in use.
 */
export function createBeadsShell(options: Omit<BeadsShellOptions, 'clock'> & { clock?: () => number } = {}): BeadsShell {
    return new BeadsShell({ ...options, clock: options.clock ?? ((): number => Date.now()) });
}
