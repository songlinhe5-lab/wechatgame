/**
 * BeadsShell — the framework `Game` that the host actually drives (WXG-T-164
 * 批0，用户 2026-09-18 拍板①「B 壳双对象」). It composes two objects:
 *
 *   - `play` = {@link BeadsGame}  — the frozen in-run simulation, **unchanged**
 *     contract; the shell only wires its `onMenuRequest` hook and forwards frames.
 *   - `meta` = {@link MetaState}  — the out-of-run economy (stamina / signin /
 *     wallet), created at `init` from the injected storage + wall clock.
 *
 * Routing (ux-spec v1.7 §2 / §6.3):
 *   - **启动直进玩法**（首屏即玩红线不变）：`initialScreen` 默认 `'play'`；
 *   - 菜单入口 = 暂停面板次钮「回主菜单」→ `play` 的 `onMenuRequest` → {@link showMenu}；
 *   - 主菜单主钮「开始游戏」：**恒为全新开当前关**并扣 1 心（systems-index §3.14）。
 *     旧口径「有在途（`play.phase==='paused'`）→ 恢复、不扣心」**已随 WXG-T-165 反转作废**
 *     （v1.29：回主菜单 = 弃本局棋盘，关卡解锁进度保留）。
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
import { STAMINA_START_COST } from '../config/tuning.js';
import { BeadsGame, type BeadsGameOptions } from './beads-game.js';
import { MetaState } from './meta-state.js';
import {
    buildMetaView,
    hitTestMeta,
    type MetaAction,
    type MetaOverlay,
    type MetaViewData,
} from '../view/meta-view.js';
import { DEFAULT_PALETTE, type BeadsPalette } from '../view/palette.js';
import type { PausePanelAction } from '../systems/pause-panel.js';

export type ShellScreen = 'play' | 'menu';

export interface BeadsShellOptions {
    /** wallClock ms source (host-injected; `() => Date.now()` in production). */
    readonly clock: () => number;
    /** Forwarded to the inner {@link BeadsGame} (tuning/levels/saveKey/…). */
    readonly play?: BeadsGameOptions;
    readonly palette?: BeadsPalette;
    /** Overridable meta sidecar key so tests get isolated storage. */
    readonly metaKey?: string;
    /** Boot screen. Default `'play'`（首启直进玩法；harness `?meta=menu` 传 `'menu'`）。 */
    readonly initialScreen?: ShellScreen;
}

export class BeadsShell implements Game {
    readonly id = 'beads';
    /** The frozen in-run game — public so the harness/tests reach its command API. */
    readonly play: BeadsGame;
    readonly palette: BeadsPalette;
    /** Created at {@link init} (needs services.storage). Undefined before then. */
    meta?: MetaState;

    private _services?: GameServices;
    private readonly _clock: () => number;
    private readonly _metaKey?: string;
    private _screen: ShellScreen;
    private _overlay: MetaOverlay = 'none';
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
        sfxMuted: false,
        reduceMotion: false,
        largeText: false,
        vibrate: true,
    };

    constructor(options: BeadsShellOptions) {
        this._clock = options.clock;
        this._metaKey = options.metaKey;
        this.palette = options.palette ?? DEFAULT_PALETTE;
        this._screen = options.initialScreen ?? 'play';
        this.play = new BeadsGame({
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
        buildMetaView(builder, this._metaViewData(), this.palette);
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
     * 主菜单主钮「开始游戏」：**每次 = 全新开当前关**，扣 1 心。真机反馈裁定（WXG-T-165）
     * ——「回主菜单」弃本局棋盘、关卡解锁进度留，原「在途 PAUSED 续进不扣心」语义已反转。
     * @returns true 当且仅当已进入玩法（0 心 ⇒ false，留在菜单走回满广告）。
     */
    startGame(): boolean {
        if (!this.meta || !this.meta.spendStamina(STAMINA_START_COST)) return false;
        this._screen = 'play';
        this._emitOverlay(false);
        this.play.goToLevel(this.play.levelIndex); // 棋盘复位到当前关初始（关卡指针/解锁进度不变）
        return true;
    }

    /**
     * Drive a menu tap in design space (tests/harness without faking pointer
     * events — mirrors `BeadsGame.tapDesign`). @returns true when consumed.
     */
    tapMeta(x: number, y: number): boolean {
        const action = hitTestMeta(this._overlay, x, y);
        if (!action) return false;
        this._applyMetaAction(action);
        return true;
    }

    private _applyMetaAction(action: MetaAction): void {
        switch (action) {
            case 'start':
                this.startGame();
                return;
            case 'open-signin':
                this._overlay = 'signin';
                this._emitOverlay(true);
                return;
            case 'open-settings':
                this._overlay = 'settings';
                this._emitOverlay(true);
                return;
            case 'back':
                this._overlay = 'none';
                this._emitOverlay(false);
                return;
            case 'claim':
                this.meta?.claimSignin();
                return;
            default:
                // toggle-* 与 PausePanelAction 同串值：复用 play 的设置 setter（两入口一致）。
                this.play.applySettingsAction(action as PausePanelAction);
                return;
        }
    }

    private _readMenuInput(): void {
        const services = this._services;
        if (!services) return;
        const snap = services.input.snapshot;
        if (!snap.justDown) return;
        services.viewport.screenToDesign(this._pointer, snap.x, snap.y);
        const action = hitTestMeta(this._overlay, this._pointer.x, this._pointer.y);
        if (action) this._applyMetaAction(action);
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
