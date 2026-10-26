/**
 * `game/meta-state.ts` — 局外经济（systems-index v1.28 §3.14）纯逻辑。
 *
 * The paths that must never silently break: stamina regen (offline clamp), the
 * 7-day signin cycle (断签不清零 / 防同日二领 / 心溢出即弃), and the heart price
 * ladder. Fake clock + isolated storage ⇒ deterministic, no wall-time flakiness.
 */

import { describe, it, expect } from 'vitest';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { type Storage } from '@wxgame/framework';
import {
    HEART_AD_DAILY_LIMIT,
    HEART_AD_GAIN,
    HEART_PRICE_LADDER,
    SIGNIN_REWARDS,
    SKIN_PRICES_COINS,
    STAMINA_MAX,
    STAMINA_REGEN_MIN_MS,
} from '../src/config/tuning.js';
import { DEFAULT_SKIN_ID } from '../src/config/skins/registry.js';
import { MetaState } from '../src/game/meta-state.js';

const DAY_MS = 25 * 60 * 60 * 1000; // > 24h ⇒ 必跨本地日（签到跨天用）

const storage = (): Storage =>
    new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createStorage();

interface Rig {
    meta: MetaState;
    events: { type: string; payload: unknown }[];
    /** advance the fake wall clock */
    advance(ms: number): void;
    now(): number;
}

function rig(startMs = 1_700_000_000_000, key = 'test.meta'): Rig {
    let now = startMs;
    const events: { type: string; payload: unknown }[] = [];
    const meta = new MetaState({
        storage: storage(),
        clock: () => now,
        emit: (type, payload) => events.push({ type, payload }),
        metaKey: key,
    });
    return {
        meta,
        events,
        advance: (ms) => {
            now += ms;
        },
        now: () => now,
    };
}

// fresh Rig per test but sharing one storage so reload tests can opt in.
function rigOn(store: Storage, startMs = 1_700_000_000_000, key = 'test.meta'): Rig {
    let now = startMs;
    const events: { type: string; payload: unknown }[] = [];
    const meta = new MetaState({
        storage: store,
        clock: () => now,
        emit: (type, payload) => events.push({ type, payload }),
        metaKey: key,
    });
    return {
        meta,
        events,
        advance: (ms) => {
            now += ms;
        },
        now: () => now,
    };
}

describe('MetaState — stamina (§3.14 宽容包 B)', () => {
    it('starts a fresh player at full stamina, zero coins', () => {
        const r = rig();
        expect(r.meta.stamina).toBe(STAMINA_MAX);
        expect(r.meta.coins).toBe(0);
        expect(r.meta.canClaim).toBe(true);
    });

    it('spends a heart on start and refuses when insufficient', () => {
        const r = rig();
        expect(r.meta.spendStamina(1)).toBe(true);
        expect(r.meta.stamina).toBe(STAMINA_MAX - 1);
        // Drain to zero, then a further spend fails.
        for (let i = 1; i < STAMINA_MAX; i++) expect(r.meta.spendStamina(1)).toBe(true);
        expect(r.meta.stamina).toBe(0);
        expect(r.meta.spendStamina(1)).toBe(false);
        expect(r.events.some((e) => e.type === 'stamina:changed')).toBe(true);
    });

    it('regenerates one heart per REGEN window and clamps at MAX offline', () => {
        const r = rig();
        // Drain 3 hearts.
        expect(r.meta.spendStamina(3)).toBe(true);
        expect(r.meta.stamina).toBe(STAMINA_MAX - 3);

        // Just under one window → no regen.
        r.advance(STAMINA_REGEN_MIN_MS - 1);
        r.meta.refresh();
        expect(r.meta.stamina).toBe(STAMINA_MAX - 3);

        // Cross one window → +1.
        r.advance(1);
        r.meta.refresh();
        expect(r.meta.stamina).toBe(STAMINA_MAX - 2);

        // A long offline gap → clamps at MAX, never over.
        r.advance(STAMINA_REGEN_MIN_MS * 50);
        r.meta.refresh();
        expect(r.meta.stamina).toBe(STAMINA_MAX);
    });

    it('addStamina discards overflow (溢出即弃)', () => {
        const r = rig();
        r.meta.spendStamina(2);
        r.meta.addStamina(5); // only 2 fit
        expect(r.meta.stamina).toBe(STAMINA_MAX);
    });
});

describe('MetaState — signin (§3.14 循环制 MF5)', () => {
    it('claims once per local day, advancing the 7-cell cycle', () => {
        const r = rig();
        const c0 = r.meta.coins;

        const r0 = r.meta.claimSignin();
        expect(r0).toEqual({ coins: SIGNIN_REWARDS[0]!.coins, hearts: SIGNIN_REWARDS[0]!.hearts });
        expect(r.meta.coins).toBe(c0 + SIGNIN_REWARDS[0]!.coins);
        expect(r.meta.signinDay).toBe(1);

        // Same day → refused (防同日二领).
        expect(r.meta.claimSignin()).toBeNull();
        expect(r.meta.canClaim).toBe(false);

        // Next local day → day cell 1.
        r.advance(DAY_MS);
        expect(r.meta.canClaim).toBe(true);
        expect(r.meta.claimSignin()).not.toBeNull();
        expect(r.meta.signinDay).toBe(2);
    });

    it('grants a heart on the day-3 cell and never overflows', () => {
        const r = rig();
        // Reach the 3rd cell (index 2 = 1 heart per §3.14).
        r.meta.claimSignin(); // day0
        r.advance(DAY_MS);
        r.meta.claimSignin(); // day1
        r.advance(DAY_MS);
        // Drain one heart so the day-2 grant is observable (else it would overflow).
        r.meta.spendStamina(1);
        const before = r.meta.stamina;
        const reward = r.meta.claimSignin(); // day2 (index 2)
        expect(reward!.hearts).toBe(1);
        expect(r.meta.stamina).toBe(Math.min(STAMINA_MAX, before + 1));
        expect(r.events.some((e) => e.type === 'signin:claimed')).toBe(true);
    });

    it('does not reset the cycle after a missed day (断签不清零)', () => {
        const r = rig();
        r.meta.claimSignin(); // claims=1 → day1
        r.advance(DAY_MS * 3); // skip 2 days
        expect(r.meta.signinDay).toBe(1); // claims unchanged, so cell unchanged
        r.meta.claimSignin(); // claims=2 → day2
        expect(r.meta.signinDay).toBe(2);
    });
});

describe('MetaState — wallet A 包 (买心阶梯)', () => {
    it('walks the price ladder within a day and clamps at the last rung', () => {
        const r = rig();
        r.meta.addCoins(1000);
        r.meta.spendStamina(3); // make room (buyHeart refuses at MAX)

        expect(r.meta.heartPrice).toBe(HEART_PRICE_LADDER[0]);
        expect(r.meta.buyHeart()).toBe(true);
        expect(r.meta.heartPrice).toBe(HEART_PRICE_LADDER[1]);
        expect(r.meta.buyHeart()).toBe(true);
        expect(r.meta.heartPrice).toBe(HEART_PRICE_LADDER[2]);
        expect(r.meta.buyHeart()).toBe(true);
        // Past the last rung the price stays put.
        expect(r.meta.heartPrice).toBe(HEART_PRICE_LADDER[HEART_PRICE_LADDER.length - 1]);
    });

    it('resets the ladder the next local day', () => {
        const r = rig();
        r.meta.addCoins(1000);
        r.meta.spendStamina(2);
        r.meta.buyHeart();
        expect(r.meta.heartPrice).toBe(HEART_PRICE_LADDER[1]);
        r.advance(DAY_MS);
        expect(r.meta.heartPrice).toBe(HEART_PRICE_LADDER[0]);
    });

    it('refuses to buy at full stamina or without coins', () => {
        const full = rig();
        full.meta.addCoins(1000);
        expect(full.meta.canBuyHeart).toBe(false); // at MAX
        expect(full.meta.buyHeart()).toBe(false);

        const poor = rig();
        poor.meta.spendStamina(1);
        expect(poor.meta.canBuyHeart).toBe(false); // 0 coins
        expect(poor.meta.buyHeart()).toBe(false);
    });

    it('spendCoins refuses to go negative', () => {
        const r = rig();
        r.meta.addCoins(30);
        expect(r.meta.spendCoins(50)).toBe(false);
        expect(r.meta.coins).toBe(30);
        expect(r.meta.spendCoins(20)).toBe(true);
        expect(r.meta.coins).toBe(10);
    });
});

describe('MetaState — persistence', () => {
    it('§8-23 · v1 档升 v2：迁移补三布尔、老玩家经济**零丢失**（⛔ 漏注册即整档回落）', () => {
        const store = storage();
        // 直接落一份 v1 老档（§3.6 v1.95 之前的形状：无三布尔、version 1）。
        const v1Doc = {
            version: 1,
            staminaCur: 3,
            staminaAnchorMs: 12345,
            coins: 777,
            signinClaims: 9,
            signinLastDate: '2026-10-25',
            heartBuysToday: 1,
            heartBuysDate: '2026-10-25',
            heartAdToday: 2,
            heartAdDate: '2026-10-25',
            replayCoinsToday: 11,
            replayCoinsDate: '2026-10-25',
            ownedSkinIds: [DEFAULT_SKIN_ID, 'cool-violet'],
        };
        store.set('test.meta.migrate', JSON.stringify(v1Doc));

        const r = rigOn(store, 1_700_000_000_000, 'test.meta.migrate');
        // 内存侧：老玩家经济零丢失（漏迁移 ⇒ SaveManager 回落 defaults，红灯：满心 / 0 豆）。
        expect(r.meta.stamina).toBe(3);
        expect(r.meta.coins).toBe(777);
        // 落盘侧：触发一次写档（迁移后 normalize 无差 ⇒ 构造帧不回写，幂等无害），
        // 读回验证 v2 档形状（MetaState 不暴露 version，从持久化档验）。
        r.meta.refillStamina(); // deprecated 但恰是无副作用的写档腿（patch + save）
        const persisted = JSON.parse(store.get('test.meta.migrate')!) as Record<string, unknown>;
        expect(persisted['version']).toBe(2);
        expect(persisted['coins']).toBe(777);
        expect(persisted['ownedSkinIds']).toEqual([DEFAULT_SKIN_ID, 'cool-violet']);
        // 三布尔补齐 = false（免费额度未用，偏向玩家）。
        expect(persisted['powerupFreeUsedWindow']).toBe(false);
        expect(persisted['powerupFreeUsedRandom']).toBe(false);
        expect(persisted['powerupFreeUsedTray']).toBe(false);
    });

    it('reloads economy from the same sidecar storage', () => {
        const store = storage();
        const a = rigOn(store);
        a.meta.addCoins(120);
        a.meta.spendStamina(2);
        a.meta.claimSignin();
        a.meta.dispose();

        const coins = a.meta.coins;
        const stamina = a.meta.stamina;
        const claims = a.meta.signinDay;

        // Same clock start ⇒ same local day ⇒ still cannot re-claim.
        const b = rigOn(store);
        expect(b.meta.coins).toBe(coins);
        expect(b.meta.stamina).toBe(stamina);
        expect(b.meta.signinDay).toBe(claims);
        expect(b.meta.canClaim).toBe(false);
    });

    it('degrades a corrupt sidecar to defaults instead of throwing', () => {
        const store = storage();
        store.set('test.meta', '{ not json');
        const r = rigOn(store);
        expect(r.meta.stamina).toBe(STAMINA_MAX);
        expect(r.meta.coins).toBe(0);
    });
});

/**
 * §3.14 v1.80（WXG-T-351）：体力回满 → **广告加心（固定量 + 日限）**。
 * 判据 = 提案 `bean-currency-economy §7.2`（+3 恰好 / 钳上限 / 满心不计次 / 日限 / 跨日复位 / 锚点不重置）。
 */
describe('§3.14 v1.80 · 广告加心（固定量 + 日限）', () => {
    it('一次恰 +HEART_AD_GAIN；且**锚点不重置**（不吃掉已累积的恢复进度）', () => {
        const r = rig();
        expect(r.meta.spendStamina(STAMINA_MAX), '清空到 0 心').toBe(true);
        expect(r.meta.grantAdHearts()).toBe(true);
        expect(r.meta.stamina, '恰为 +HEART_AD_GAIN（不是回满）').toBe(HEART_AD_GAIN);

        // 先进半档（4 分钟）再加心：若实现重锚，这 4 分钟会被清零。
        r.advance(4 * 60 * 1000);
        expect(r.meta.grantAdHearts()).toBe(true);
        r.advance(4 * 60 * 1000);
        r.meta.refresh();
        expect(r.meta.stamina, '锚点保留 ⇒ 半档 + 半档 = 满一档 +1').toBe(HEART_AD_GAIN * 2 + 1);
    });

    it('满心 ⇒ 不加、不计次（日限名额不被白看浪费）', () => {
        const r = rig();
        expect(r.meta.stamina).toBe(STAMINA_MAX);
        expect(r.meta.grantAdHearts()).toBe(false);
        expect(r.meta.stamina).toBe(STAMINA_MAX);
        expect(r.meta.heartAdsLeft).toBe(HEART_AD_DAILY_LIMIT);
        expect(r.meta.canWatchHeartAd, '满心 ⇒ 闸门关闭（不拉广告）').toBe(false);
    });

    it('日限 HEART_AD_DAILY_LIMIT 次后拒绝；跨日复位', () => {
        const r = rig();
        let ok = 0;
        for (let i = 0; i < HEART_AD_DAILY_LIMIT + 2; i++) {
            r.meta.spendStamina(r.meta.stamina); // 每次清空，避免撞上限
            if (r.meta.grantAdHearts()) ok += 1;
        }
        expect(ok, '日限内每次都给').toBe(HEART_AD_DAILY_LIMIT);
        expect(r.meta.heartAdsLeft).toBe(0);
        expect(r.meta.stamina, '超额那次零加心').toBe(0);

        r.advance(DAY_MS);
        r.meta.refresh(); // 25h 离线恢复先把体力补到上限（getter 只管余额、不触发恢复）
        expect(r.meta.heartAdsLeft, '跨日（本地日键变化）计数归零').toBe(HEART_AD_DAILY_LIMIT);
        r.meta.spendStamina(r.meta.stamina);
        expect(r.meta.grantAdHearts()).toBe(true);
    });

    it('钳 STAMINA_MAX：7 心 +3 ⇒ 8（溢出即弃，签到同口径）', () => {
        const r = rig();
        expect(r.meta.spendStamina(1), '8 → 7 心').toBe(true);
        expect(r.meta.stamina).toBe(7);
        expect(r.meta.grantAdHearts()).toBe(true);
        expect(r.meta.stamina).toBe(STAMINA_MAX);
    });
});

describe('§3.14 v1.80 · spendCoins（豆子出口之一的扣款腿；皮肤买断另走 buySkin）', () => {
    it('足额则扣、不足则零变化', () => {
        const r = rig();
        r.meta.addCoins(50);
        expect(r.meta.spendCoins(20)).toBe(true);
        expect(r.meta.coins).toBe(30);
        expect(r.meta.spendCoins(45), '不足 ⇒ false').toBe(false);
        expect(r.meta.coins, '失败不扣').toBe(30);
        expect(r.meta.spendCoins(30)).toBe(true);
        expect(r.meta.coins).toBe(0);
    });
});

/**
 * §3.7 v1.83（WXG-T-360）：外观 = 金币买断。
 * 判据正本 = 提案 `star-economy-and-retention.md` §11-3（买断不是派生量）/ §11-4（grandfather），
 * 价格真源 = `tuning.ts::SKIN_PRICES_COINS`（`[提案·Q3 待拍板]`，⛔ 未入 §3 冻结）。
 */
describe('§3.7 v1.83 · 皮肤买断（buySkin / ownedSkinIds / grandfather）', () => {
    const BUYABLE = 'cool-violet';
    const PRICE = SKIN_PRICES_COINS[BUYABLE];

    it('出厂只拥有默认肤；可买档未购 ⇒ ownsSkin=false；价目未在册 = null（⛔ 不是 0 价白送）', () => {
        const r = rig();
        expect(r.meta.ownsSkin(DEFAULT_SKIN_ID)).toBe(true);
        expect(r.meta.ownsSkin(BUYABLE)).toBe(false);
        expect(r.meta.skinPrice(BUYABLE)).toBe(PRICE);
        expect(r.meta.skinPrice('no-such-skin')).toBeNull();
    });

    it('差 1 币买不到且零扣款零入档；恰好够了则扣一次 + 入档 + 恰发 1 次 wallet:changed', () => {
        const r = rig();
        r.meta.addCoins(PRICE - 1);
        expect(r.meta.buySkin(BUYABLE)).toBe(false);
        expect(r.meta.coins, '不足 ⇒ 不扣').toBe(PRICE - 1);
        expect(r.meta.ownsSkin(BUYABLE)).toBe(false);

        r.meta.addCoins(1);
        const beforeBuy = r.events.filter((e) => e.type === 'wallet:changed').length;
        expect(r.meta.buySkin(BUYABLE)).toBe(true);
        expect(r.meta.coins).toBe(0);
        expect(r.meta.ownsSkin(BUYABLE)).toBe(true);
        expect(r.events.filter((e) => e.type === 'wallet:changed').length).toBe(beforeBuy + 1);
    });

    it('幂等（§11-3）：已拥有再点 = true 且零扣款；未在册 id 拒买且零扣款零入档', () => {
        const r = rig();
        r.meta.addCoins(PRICE * 3);
        expect(r.meta.buySkin(BUYABLE)).toBe(true);
        const after = r.meta.coins;
        for (let i = 0; i < 3; i++) expect(r.meta.buySkin(BUYABLE)).toBe(true);
        expect(r.meta.coins, '重复点击不得再扣款').toBe(after);

        r.meta.addCoins(999);
        expect(r.meta.buySkin('no-such-skin'), '价目未在册 ⇒ 拒买').toBe(false);
        expect(r.meta.ownsSkin('no-such-skin')).toBe(false);
        expect(r.meta.coins, '拒买不得扣款').toBe(after + 999);
    });

    it('grandfather（§11-4）：v1 老档无 ownedSkinIds + 当前肤=可买档 ⇒ 载入即已拥有、零补扣、重载不丢', () => {
        const store = storage();
        store.set('gm.meta', JSON.stringify({
            version: 1, staminaCur: 3, staminaAnchorMs: 0, coins: 0,
            signinClaims: 0, signinLastDate: '', heartBuysToday: 0, heartBuysDate: '',
            heartAdToday: 0, heartAdDate: '',
        }));
        const r = rigOn(store, 1_700_000_000_000, 'gm.meta');
        expect(r.meta.ownsSkin(DEFAULT_SKIN_ID), '默认肤恒在（⛔ 不回收）').toBe(true);
        r.meta.ensureSkinOwnership(BUYABLE);
        expect(r.meta.ownsSkin(BUYABLE)).toBe(true);
        expect(r.meta.coins, '⛔ 不补扣').toBe(0);

        const eventsBefore = r.events.length;
        r.meta.ensureSkinOwnership(BUYABLE);
        expect(r.events.length, '幂等 ⇒ 第二次零写档零事件').toBe(eventsBefore);

        const b = rigOn(store, 1_700_000_000_000, 'gm.meta');
        expect(b.meta.ownsSkin(BUYABLE), '落档事实：重载仍在集合内（切走再切回不丢）').toBe(true);
        expect(b.meta.coins).toBe(0);
    });

    it('买断是落档事实：同一 storage 重载后仍拥有，且默认肤仍在', () => {
        const store = storage();
        const a = rigOn(store);
        a.meta.addCoins(PRICE);
        expect(a.meta.buySkin(BUYABLE)).toBe(true);
        a.meta.dispose();

        const b = rigOn(store);
        expect(b.meta.ownsSkin(BUYABLE)).toBe(true);
        expect(b.meta.ownsSkin(DEFAULT_SKIN_ID)).toBe(true);
        expect(b.meta.coins).toBe(0);
    });

    it('静态门：价目表每个 key 必须在皮肤注册表内（防「写了价但根本没这个肤」）', async () => {
        const { registeredSkinIds } = await import('../src/config/skins/registry.js');
        const ids = new Set(registeredSkinIds());
        for (const id of Object.keys(SKIN_PRICES_COINS)) {
            expect(ids.has(id), `SKIN_PRICES_COINS 的 '${id}' 不在注册表`).toBe(true);
            expect(id !== DEFAULT_SKIN_ID, '默认肤不得进价目表（初始拥有、⛔ 不回收）').toBe(true);
        }
    });
});
