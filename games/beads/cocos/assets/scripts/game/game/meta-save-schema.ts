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

import type { SaveDocument } from '../../framework/index';
import { STAMINA_MAX } from '../config/tuning';
import { DEFAULT_SKIN_ID } from '../config/skins/registry';

export interface BeadsMeta extends SaveDocument {
    version: 2;
    /** 当前体力（心），钳 `[0, STAMINA_MAX]`。 */
    staminaCur: number;
    /**
     * 体力恢复锚点（wallClock ms）：当前「未满一档」的计时起点。离线恢复
     * `gained = floor((now − anchor) / STAMINA_REGEN_MIN_MS)`，登录后钳上限（§3.14）。
     * `0` = 尚未初始化（首次 refresh 时由 clock 落定）。
     */
    staminaAnchorMs: number;
    /** 签到币余额（≥0 整数）。获取仅签到 / 通关首通（v1.91 删周榜结算：现无排行榜）；消耗 = 皮肤买断 / 道具超限 / 头像框（后两者见 §3.14）。 */
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
    /**
     * 三件道具的免费额度是否已永久耗尽（§3.6 v1.95：**账号级永久每型 1 次**，
     * WXG-T-419；内部类型名与显示名解耦，显示名 = 熨贴片 / 抖豆筛 / 扫豆刷）。
     *
     * `true` = 该型的账号级免费次数已用掉（**永不恢复**：新关 / 失败重试 / 暂停
     * 重玩 / 换关均不回满）。新手引导的演示**不消耗**该额度（用户 2026-10-26
     * 明示例外，防重复由 `onboarded` 侧承载，不在此存）。
     *
     * ⚠ §3.6 v1.95 冻结要求 **`META_SAVE_VERSION` 1 → 2 且 `migrations[1]` 同批
     * 注册**（漏注册 = 版本升高而迁移缺失 ⇒ `save-manager` 整档回落，把老玩家的
     * 体力 / 豆子 / 签到 / 皮肤清零——本节最高危一条，判据 = `powerups-v2 §8-23`；
     * `powerups.test.ts` 镜像断言守卫版本号）。老档缺失 / 非布尔一律降级 `false`
     * = 偏向玩家（视为未用）。~~沿 v1.83 `ownedSkinIds` 不升版判例~~（⛔ 冻结表
     * 已改判为升版 + 迁移，按 `AGENTS §4` 以 §3 为准）。
     */
    powerupFreeUsedWindow: boolean;
    powerupFreeUsedRandom: boolean;
    powerupFreeUsedTray: boolean;
}

/** Meta sidecar storage key（与 run 存档分键）。 */
export const META_SAVE_KEY = 'wxgame.beads.meta.v1';
export const META_SAVE_VERSION = 2;

/**
 * Meta 档迁移链（§3.6 v1.95 冻结：**漏注册 = 整档回落**，最高危）。
 * 单一真源、每级返回 n+1（与 run 档 `BEADS_MIGRATIONS` 同判例形状）。
 * v1→v2：新增三布尔（缺省 `false` = 免费额度未用，偏向玩家；显式补齐 = 自文档，
 * 与 merge-defaults 兜底等价）。
 */
export const META_MIGRATIONS: Readonly<Record<number, (old: Record<string, unknown>) => Record<string, unknown>>> = {
    1: (old) => ({
        ...old,
        powerupFreeUsedWindow: false,
        powerupFreeUsedRandom: false,
        powerupFreeUsedTray: false,
        version: 2,
    }),
};

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
        powerupFreeUsedWindow: false,
        powerupFreeUsedRandom: false,
        powerupFreeUsedTray: false,
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

/** 布尔兜底（非布尔一律 `false` = 「免费额度未用」的安全侧）。 */
function flag(value: unknown): boolean {
    return typeof value === 'boolean' ? value : false;
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
        powerupFreeUsedWindow: flag(raw['powerupFreeUsedWindow']),
        powerupFreeUsedRandom: flag(raw['powerupFreeUsedRandom']),
        powerupFreeUsedTray: flag(raw['powerupFreeUsedTray']),
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
        !sameIds(raw['ownedSkinIds'], meta.ownedSkinIds) ||
        raw['powerupFreeUsedWindow'] !== meta.powerupFreeUsedWindow ||
        raw['powerupFreeUsedRandom'] !== meta.powerupFreeUsedRandom ||
        raw['powerupFreeUsedTray'] !== meta.powerupFreeUsedTray;

    return { meta, changed };
}
