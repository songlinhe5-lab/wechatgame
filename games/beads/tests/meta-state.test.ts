/**
 * `game/meta-state.ts` — 局外经济（systems-index v1.28 §3.14）纯逻辑。
 *
 * The paths that must never silently break: stamina regen (offline clamp), the
 * 7-day signin cycle (断签不清零 / 防同日二领 / 心溢出即弃), and the heart price
 * ladder. Fake clock + isolated storage ⇒ deterministic, no wall-time flakiness.
 */

import { describe, it, expect } from 'vitest';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import type { Storage } from '@wxgame/framework';
import {
    HEART_PRICE_LADDER,
    SIGNIN_REWARDS,
    STAMINA_MAX,
    STAMINA_REGEN_MIN_MS,
} from '../src/config/tuning.js';
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
