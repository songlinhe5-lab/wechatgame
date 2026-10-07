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
 * 陈列序（EP12-S6 Deliverable 2，**回归修复**）：旧口径「墙槽 `i` 直接当关索引」把「第几格」
 * 误当成「第几关」⇒ 与 `level-difficulty.md §5.2` 九关墙序（DI 升序）恒不符。现由
 * {@link _rebuildWallSlots} 产出 **`slot → levelIndex` 映射表**（按 `difficultyOf()` 的 `di` 升序、
 * tie 按关号 `id` 升序），绘制与命中两条腿都**只经映射**取关索引；视图侧 `MetaButton` 也因此
 * 只携带 `slot`（⛔ 无从「按槽当关」）。表是**一次性缓存**（失效键 = `play.levelCount`），
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

import type { Game, GameServices, RenderModelBuilder } from '../../framework/index';
import { FACET4_STYLE_ID, BEAD_SIZE_DEFAULT, STAMINA_START_COST, WALL_CAPACITY } from '../config/tuning';
import { BeadsGame, type BeadsGameOptions } from './beads-game';
import { LEVELS } from '../config/levels';
import type { BeadsLevelRaw } from '../config/levels-data';
// EP12-S6 陈列序真源：DI 唯一实现 = `difficultyOf()`（S5 · WXG-T-266），⛔ 不在本文件复算公式。
import { difficultyOf } from './difficulty';
import { MetaState } from './meta-state';
import {
    buildMetaView,
    hitTestMeta,
    type MetaAction,
    type MetaButton,
    type MetaOverlay,
    type MetaViewData,
} from '../view/meta-view';
import { DEFAULT_SKIN_ID } from '../config/skins/registry';
import type { BeadsPalette } from '../view/palette';
import type { PausePanelAction } from '../systems/pause-panel';
import { importLatest, type HttpGet } from './level-import';

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
        canClaim: false,
        bgmMuted: false,
        debugInfo: false,
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
        studioEnabled: false,
    };

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

    // ───────────────────────────────────────────────────────────── Game contract

    init(services: GameServices): void {
        this._services = services;
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
        const btn = hitTestMeta(this._overlay, x, y);
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
                // §5.4 口径 3 / Q5①：菜单布局已无本钮 ⇒ 此分支仅为 `levels` overlay **代码保留**腿
                // （宿主 / 测试可直接驱动该 overlay；⛔ 不删、也不为它新造入口）。
                this._overlay = 'levels';
                this._emitOverlay(true);
                return true;
            case 'pick-level': {
                const slot = btn.slot;
                // 陈列序 = DI 升序 ⇒ **槽位 ≠ 关索引**（旧 `beads-shell.ts:258` 回归根因）。
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
        if (!snap.justDown) return;
        services.viewport.screenToDesign(this._pointer, snap.x, snap.y);
        this._dispatchMetaTap(this._pointer.x, this._pointer.y);
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
     * `slot → levelIndex`：DI **升序**、tie 按关号 `id` 升序（⇒ `level-difficulty §5.2` 九关墙序
     * `L1→L8→L4→L3→L7→L2→L6→L5→L9`）。只在关表变更时跑一次（⛔ 非每帧）。
     * 表长 = `min(n, WALL_CAPACITY)`：超出容量的关本 Story **不实现**（S6 Out），短于容量的空槽
     * 由视图读成 `undefined` ⇒ 画虚线空槽、零事件。
     *
     * ⚠ 关表长于基准表（beads-studio 导入的追加项）时，DI 不可得（其 raw 不在本 shell 可见面内）
     * ⇒ 按索引升序**后置**于墙尾（行为可预测、不抛错）；该限制已登记于 T-2A 回传 CONCERNS。
     */
    private _rebuildWallSlots(n: number): readonly number[] {
        const base = this._wallBaseLevels;
        const entries: { readonly idx: number; readonly id: number; readonly di: number }[] = [];
        for (let i = 0; i < base.length; i++) {
            const lv = base[i]!;
            entries.push({ idx: i, id: lv.id, di: difficultyOf(lv).di });
        }
        for (let i = base.length; i < n; i++) {
            entries.push({ idx: i, id: Number.MAX_SAFE_INTEGER, di: Number.POSITIVE_INFINITY });
        }
        entries.sort((a, b) => a.di - b.di || a.id - b.id || a.idx - b.idx);
        const slots: number[] = [];
        const shown = Math.min(n, WALL_CAPACITY, entries.length);
        for (let s = 0; s < shown; s++) slots.push(entries[s]!.idx);
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
