/**
 * MetaState — the out-of-run economy (WXG-T-164 批0). Pure, engine-free logic:
 * stamina regen, 7-day signin cycle, coin wallet, heart purchase. Owns the meta
 * sidecar save (`meta-save-schema.ts`) and nothing else.
 *
 * Frozen source: systems-index v1.28 §3.14 (宽容包 B + 钱包 A 包). Semantics
 * 裁定 (WXG-T-164)：
 *  - 扣心时机 = 新局开局 / 重试（PAUSED 恢复与菜单在途续进不重复扣）——扣心本身由
 *    shell 在路由到玩法时调用 {@link spendStamina}，本模块只管余额与恢复；
 *  - 签到 = 循环制（`claims % 7`），断签不清零，`signinLastDate` 防同日二领；
 *  - 签到心溢出即弃（{@link addStamina} 钳上限）；买心不允许溢出（满心不可买）。
 *
 * **L5 discipline**: every getter is read-only (fields + injected clock, no
 * writes). {@link refresh} is the one mutator and is called from the shell's
 * `update()` (the sim step), never from `buildRenderModel`.
 *
 * The wall clock is **injected** (`clock`): `GameServices.platform` exposes only
 * `PlatformInfo` (no wallClock), so the host hands the shell `() => Date.now()`
 * and tests hand a fake clock — framework stays untouched (零改动).
 */

import { SaveManager, type Storage } from '../../framework/index';
import {
    HEART_PRICE_LADDER,
    SIGNIN_REWARDS,
    STAMINA_MAX,
    STAMINA_REGEN_MIN_MS,
} from '../config/tuning';
import {
    META_SAVE_KEY,
    META_SAVE_VERSION,
    defaultBeadsMeta,
    normalizeBeadsMeta,
    type BeadsMeta,
} from './meta-save-schema';

/** Loose emit hook — the shell wires it to the framework EventBus. */
export type MetaEmit = (type: string, payload: unknown) => void;

export interface MetaStateOptions {
    readonly storage: Storage;
    /** wallClock ms source (host-injected; `() => Date.now()` in production). */
    readonly clock: () => number;
    /** Optional event sink (`stamina:changed` / `wallet:changed` / `signin:claimed`). */
    readonly emit?: MetaEmit;
    /** Overridable so tests get isolated storage. */
    readonly metaKey?: string;
}

/** One signin cell's payout (§3.14: day 3/5 各 1 心；币数额不冻结). */
export interface SigninReward {
    readonly coins: number;
    readonly hearts: number;
}

/** Local calendar-day key (`YYYY-M-D`) — 防同日二领用本地日，非 UTC。 */
export function dateKey(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export class MetaState {
    private readonly _save: SaveManager<BeadsMeta>;
    private readonly _clock: () => number;
    private readonly _emit: MetaEmit;

    // In-memory mirrors of the persisted doc (fast reads; written through on change).
    private _cur: number;
    private _anchor: number;
    private _coins: number;
    private _claims: number;
    private _lastDate: string;
    private _heartBuys: number;
    private _heartDate: string;

    constructor(options: MetaStateOptions) {
        this._clock = options.clock;
        this._emit = options.emit ?? ((): void => { });
        this._save = new SaveManager<BeadsMeta>(options.storage, {
            key: options.metaKey ?? META_SAVE_KEY,
            version: META_SAVE_VERSION,
            defaults: defaultBeadsMeta,
            // v1：无迁移（SaveManager 以 defaults 补缺字段）。
        });
        const loaded = this._save.load();
        const norm = normalizeBeadsMeta(loaded.data);
        this._save.patch(norm.meta);
        if (norm.changed || loaded.wasReset) this._save.save();

        const d = this._save.data;
        this._cur = d.staminaCur;
        this._anchor = d.staminaAnchorMs;
        this._coins = d.coins;
        this._claims = d.signinClaims;
        this._lastDate = d.signinLastDate;
        this._heartBuys = d.heartBuysToday;
        this._heartDate = d.heartBuysDate;
        // 首次装载（anchor=0）以当前时刻起步，避免把「出厂到现在」误算成离线恢复。
        if (this._anchor === 0) this._anchor = this._clock();
    }

    // ───────────────────────────────────────────────────────────── read-only

    get stamina(): number {
        return this._cur;
    }

    get staminaMax(): number {
        return STAMINA_MAX;
    }

    get coins(): number {
        return this._coins;
    }

    /** 当日签到格索引（循环制 `claims % 7`）。 */
    get signinDay(): number {
        return this._claims % SIGNIN_REWARDS.length;
    }

    /** 今日是否尚未签到。 */
    get canClaim(): boolean {
        return dateKey(this._clock()) !== this._lastDate;
    }

    /** 今日可领（或已领的当前格）奖励——供签到页展示。 */
    get signinReward(): SigninReward {
        return SIGNIN_REWARDS[this.signinDay]!;
    }

    /** 下一颗心的阶梯价（按当日已购次数；不写档，只读计算）。 */
    get heartPrice(): number {
        const buys = this._heartDate === dateKey(this._clock()) ? this._heartBuys : 0;
        return HEART_PRICE_LADDER[Math.min(buys, HEART_PRICE_LADDER.length - 1)]!;
    }

    get canBuyHeart(): boolean {
        return this._cur < STAMINA_MAX && this._coins >= this.heartPrice;
    }

    // ───────────────────────────────────────────────────────────── mutation

    /**
     * Advance offline/idle stamina regen from the wall clock (§3.14:
     * `gained = floor(Δt / REGEN)`，钳上限）。Idempotent + allocation-free; safe to
     * call every frame from the shell's `update()`. Only a real integer gain writes.
     */
    refresh(): void {
        const now = this._clock();
        if (this._cur >= STAMINA_MAX) {
            // 满体力：锚点跟随 now（不累积），不写档（clamp 已保证下次装载不会溢出）。
            this._anchor = now;
            return;
        }
        const elapsed = now - this._anchor;
        if (elapsed < STAMINA_REGEN_MIN_MS) return;
        const gained = Math.floor(elapsed / STAMINA_REGEN_MIN_MS);
        this._anchor += gained * STAMINA_REGEN_MIN_MS;
        const next = Math.min(STAMINA_MAX, this._cur + gained);
        if (next === this._cur) return;
        this._cur = next;
        if (this._cur >= STAMINA_MAX) this._anchor = now;
        this._persistStamina();
    }

    /** 扣心（新局开局/重试由 shell 调用）。足额则扣、写档、发事件；不足返回 false。 */
    spendStamina(cost: number): boolean {
        this.refresh();
        if (cost <= 0) return true;
        if (this._cur < cost) return false;
        this._cur -= cost;
        this._persistStamina();
        return true;
    }

    /** 加心（签到/激励回满之外的赠送），钳上限——溢出即弃（§3.14）。 */
    addStamina(amount: number): void {
        if (amount <= 0) return;
        this._cur = Math.min(STAMINA_MAX, this._cur + amount);
        this._anchor = this._clock();
        this._persistStamina();
    }

    /** 激励视频「回满」位（§3.14 第二 live 位）。 */
    refillStamina(): void {
        this._cur = STAMINA_MAX;
        this._anchor = this._clock();
        this._persistStamina();
    }

    addCoins(amount: number): void {
        if (amount <= 0) return;
        this._coins += amount;
        this._persistWallet();
    }

    spendCoins(amount: number): boolean {
        if (amount <= 0) return true;
        if (this._coins < amount) return false;
        this._coins -= amount;
        this._persistWallet();
        return true;
    }

    /**
     * 领取今日签到（循环制）。已领 → null；否则发币（+ 第 3/5 天各 1 心，溢出即弃），
     * 推进 `claims`、记 `signinLastDate`，发 `signin:claimed`。返回当格奖励。
     */
    claimSignin(): SigninReward | null {
        const today = dateKey(this._clock());
        if (this._lastDate === today) return null;
        const day = this.signinDay;
        const reward = SIGNIN_REWARDS[day]!;
        this._claims += 1;
        this._lastDate = today;
        this._save.patch({ signinClaims: this._claims, signinLastDate: this._lastDate });
        this.addCoins(reward.coins); // 写档 + wallet:changed
        if (reward.hearts > 0) this.addStamina(reward.hearts); // 写档 + stamina:changed
        this._save.save();
        this._emit('signin:claimed', { day, coins: reward.coins, hearts: reward.hearts });
        return reward;
    }

    /** 买心（钱包 A 包阶梯价）。满心或余额不足 → false；否则扣币加心、推进当日计数。 */
    buyHeart(): boolean {
        const now = this._clock();
        const today = dateKey(now);
        if (this._heartDate !== today) {
            this._heartBuys = 0;
            this._heartDate = today;
        }
        this.refresh();
        if (this._cur >= STAMINA_MAX) return false;
        const price = HEART_PRICE_LADDER[Math.min(this._heartBuys, HEART_PRICE_LADDER.length - 1)]!;
        if (this._coins < price) return false;
        this._coins -= price;
        this._heartBuys += 1;
        this._cur += 1; // 上面已保证 < MAX ⇒ 不溢出
        this._save.patch({
            coins: this._coins,
            heartBuysToday: this._heartBuys,
            heartBuysDate: this._heartDate,
            staminaCur: this._cur,
            staminaAnchorMs: this._anchor,
        });
        this._save.save();
        this._emit('wallet:changed', { coins: this._coins });
        this._emit('stamina:changed', { cur: this._cur, max: STAMINA_MAX });
        return true;
    }

    /** Persist any pending write (shell dispose). */
    dispose(): void {
        this._save.flush();
    }

    // ───────────────────────────────────────────────────────────── internals

    private _persistStamina(): void {
        this._save.patch({ staminaCur: this._cur, staminaAnchorMs: this._anchor });
        this._save.save();
        this._emit('stamina:changed', { cur: this._cur, max: STAMINA_MAX });
    }

    private _persistWallet(): void {
        this._save.patch({ coins: this._coins });
        this._save.save();
        this._emit('wallet:changed', { coins: this._coins });
    }
}
