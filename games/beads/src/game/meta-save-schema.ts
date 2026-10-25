/**
 * Persisted Beads **meta** document — the out-of-run economy sidecar
 * (WXG-T-164 批0；真源 systems-index v1.28 §3.14).
 *
 * Deliberately a **separate key** from the run save (`wxgame.beads.save.v1`):
 * the frozen S8 progression schema stays untouched (零扰动，用户 2026-09-18
 * 拍板①「meta 存档独立 sidecar 键」). Fields are **flat** on purpose — the
 * framework `SaveManager` merges `{ ...defaults(), ...doc }` *shallowly*, so a
 * flat doc gets per-field default-fill for free.
 *
 * Design rules carried over from `save-schema.ts` 判例:
 * 1. **Degrade, never throw** — corrupt/out-of-range values are clamped per field.
 * 2. Only *persistent economy* is stored — never mid-run state.
 */

import type { SaveDocument } from '@wxgame/framework';
import { STAMINA_MAX } from '../config/tuning.js';
import { DEFAULT_SKIN_ID } from '../config/skins/registry.js';

export interface BeadsMeta extends SaveDocument {
    version: 1;
    /** 当前体力（心），钳 `[0, STAMINA_MAX]`。 */
    staminaCur: number;
    /**
     * 体力恢复锚点（wallClock ms）：当前「未满一档」的计时起点。离线恢复
     * `gained = floor((now − anchor) / STAMINA_REGEN_MIN_MS)`，登录后钳上限（§3.14）。
     * `0` = 尚未初始化（首次 refresh 时由 clock 落定）。
     */
    staminaAnchorMs: number;
    /** 签到币余额（≥0 整数）。获取仅签到 / 周榜结算 / 通关首通；消耗 = 买心 / 头像框。 */
    coins: number;
    /** 累计签到次数（循环制 MF5：当日格 = `signinClaims % 7`，断签不清零）。 */
    signinClaims: number;
    /** 最近一次签到日期键（`YYYY-M-D` 本地），防同日二领；`''` = 从未签到。 */
    signinLastDate: string;
    /** 当日已购心次数（阶梯价索引；跨天由 `heartBuysDate` 归零）。 */
    heartBuysToday: number;
    /** `heartBuysToday` 所属日期键；与今日不同则计数归零。 */
    heartBuysDate: string;
    /** 当日已看「广告加心」次数（§3.14 v1.80 日限 `HEART_AD_DAILY_LIMIT`）。 */
    heartAdToday: number;
    /** `heartAdToday` 所属日期键；与今日不同则计数归零。 */
    heartAdDate: string;
    /**
     * 当日**复刷发豆**累计（§3.14 v1.81 日上限 `CLEAR_COIN_REPLAY_DAILY_CAP`）。
     * 只累加复刷腿（⛔ 不含首通与签到）；跨天由 `replayCoinsDate` 归零。
     */
    replayCoinsToday: number;
    /** `replayCoinsToday` 所属日期键（`YYYY-M-D` 本地，与签到同口径 dateKey）。 */
    replayCoinsDate: string;
    /**
     * 已买断（或初始拥有）的皮肤 id（§3.7 v1.83 「外观 = 金币买断」；价目 = `SKIN_PRICES_COINS`）。
     *
     * **落档事实而非派生量**（提案 §4.3）：只在「购买成功」与「载入 grandfather」两处增长，
     * ⛔ 不随星数/金币/关表长度漂（旧模型下「解锁」是星数派生量，扩关会被动退回未拥有；买断制天然免疫）。
     * 初值 = `[DEFAULT_SKIN_ID]`，且 normalize **强制默认肤恒在**（⛔ 不回收）。
     */
    ownedSkinIds: string[];
}

/** Meta sidecar storage key（与 run 存档分键）。 */
export const META_SAVE_KEY = 'wxgame.beads.meta.v1';
export const META_SAVE_VERSION = 1;

/** 新玩家出厂：体力满、零币、未签到、未购心。 */
export function defaultBeadsMeta(): BeadsMeta {
    return {
        version: META_SAVE_VERSION,
        staminaCur: STAMINA_MAX,
        staminaAnchorMs: 0,
        coins: 0,
        signinClaims: 0,
        signinLastDate: '',
        heartBuysToday: 0,
        heartBuysDate: '',
        heartAdToday: 0,
        heartAdDate: '',
        replayCoinsToday: 0,
        replayCoinsDate: '',
        ownedSkinIds: [DEFAULT_SKIN_ID],
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 非负有限整数，否则 `fallback`（与 save-schema `num` 同判例，另取整）。 */
function int(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : fallback;
}

function str(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}

/**
 * 已拥有皮肤集合：只收非空字符串、去重，并**强制含默认肤**（⛔ 不回收）。
 * 仅在载入时跑（非热路径），⛔ 不得放进 `update` / `buildRenderModel`。
 */
function ownedIds(value: unknown): string[] {
    const list = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string' && v !== '')
        : [];
    const set = new Set(list);
    set.add(DEFAULT_SKIN_ID);
    return Array.from(set);
}

/** 逐位比较（只在载入对账时用）：形状不同、长度不同或任一位不等 ⇒ 需要回写。 */
function sameIds(raw: unknown, next: readonly string[]): boolean {
    return (
        Array.isArray(raw) &&
        raw.length === next.length &&
        next.every((v, i) => (raw as unknown[])[i] === v)
    );
}

export interface MetaNormalizeResult {
    readonly meta: BeadsMeta;
    /** True when anything was repaired — the caller should write back. */
    readonly changed: boolean;
}

/**
 * Repair a loaded meta document into a valid one (degrade, never throw).
 * `staminaAnchorMs` 允许任意有限数（含 0 = 未初始化），负/NaN 降级为 0。
 */
export function normalizeBeadsMeta(raw: unknown): MetaNormalizeResult {
    const fallback = defaultBeadsMeta();
    if (!isRecord(raw)) return { meta: fallback, changed: true };

    const anchor =
        typeof raw['staminaAnchorMs'] === 'number' && Number.isFinite(raw['staminaAnchorMs'] as number)
            ? (raw['staminaAnchorMs'] as number)
            : 0;

    const meta: BeadsMeta = {
        version: META_SAVE_VERSION,
        staminaCur: Math.max(0, Math.min(STAMINA_MAX, int(raw['staminaCur'], STAMINA_MAX))),
        staminaAnchorMs: anchor,
        coins: int(raw['coins'], 0),
        signinClaims: int(raw['signinClaims'], 0),
        signinLastDate: str(raw['signinLastDate'], ''),
        heartBuysToday: int(raw['heartBuysToday'], 0),
        heartBuysDate: str(raw['heartBuysDate'], ''),
        heartAdToday: int(raw['heartAdToday'], 0),
        heartAdDate: str(raw['heartAdDate'], ''),
        replayCoinsToday: int(raw['replayCoinsToday'], 0),
        replayCoinsDate: str(raw['replayCoinsDate'], ''),
        ownedSkinIds: ownedIds(raw['ownedSkinIds']),
    };

    const changed =
        raw['staminaCur'] !== meta.staminaCur ||
        raw['staminaAnchorMs'] !== meta.staminaAnchorMs ||
        raw['coins'] !== meta.coins ||
        raw['signinClaims'] !== meta.signinClaims ||
        raw['signinLastDate'] !== meta.signinLastDate ||
        raw['heartBuysToday'] !== meta.heartBuysToday ||
        raw['heartBuysDate'] !== meta.heartBuysDate ||
        raw['heartAdToday'] !== meta.heartAdToday ||
        raw['heartAdDate'] !== meta.heartAdDate ||
        raw['replayCoinsToday'] !== meta.replayCoinsToday ||
        raw['replayCoinsDate'] !== meta.replayCoinsDate ||
        !sameIds(raw['ownedSkinIds'], meta.ownedSkinIds);

    return { meta, changed };
}
