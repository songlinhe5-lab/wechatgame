/**
 * 结算按星发豆 —— `MetaState.grantClearCoins`（systems-index §3.14 v1.81；用户 2026-10-26 拍板）。
 *
 * 必须永不静默破的四条：
 * - **首通**按本次星级一次性（普通 20/30/40、Boss 40/60/80），且 ⛔ 不吃复刷日上限；
 * - **复刷**普通 5 / Boss 10；
 * - **日上限 45**（= 签到日均 320/7 取整）到顶后**降为 1 / 2 而非清零**，且原因句必须写明「已达上限」
 *   （否则玩家看不出为什么这一盘变少 —— 这是用户 2026-10-26 的硬要求）；
 * - 跨本地日**归零**（与签到同口径 `dateKey`）。
 *
 * Fake clock + 独立 storage ⇒ 确定性，无挂钟抖动。
 */

import { describe, it, expect } from 'vitest';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import type { Storage } from '@wxgame/framework';
import {
    CLEAR_COIN_REPLAY_BOSS,
    CLEAR_COIN_REPLAY_CAPPED_BOSS,
    CLEAR_COIN_REPLAY_CAPPED_NORMAL,
    CLEAR_COIN_REPLAY_DAILY_CAP,
    CLEAR_COIN_REPLAY_NORMAL,
} from '../src/config/tuning.js';
import { MetaState } from '../src/game/meta-state.js';

const DAY_MS = 25 * 60 * 60 * 1000; // > 24h ⇒ 必跨本地日

const storage = (): Storage =>
    new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createStorage();

let seq = 0;

interface Rig {
    meta: MetaState;
    advance(ms: number): void;
}

function rig(startMs = 1_700_000_000_000): Rig {
    let now = startMs;
    seq += 1;
    const meta = new MetaState({
        storage: storage(),
        clock: () => now,
        metaKey: `test.clearcoins.${seq}`,
    });
    return {
        meta,
        advance: (ms) => {
            now += ms;
        },
    };
}

describe('§3.14 v1.81 结算按星发豆', () => {
    it('首通：普通关 20/30/40，Boss 关 40/60/80（按本次星级）', () => {
        const cases: readonly (readonly [number, number, number])[] = [
            [1, 20, 40],
            [2, 30, 60],
            [3, 40, 80],
        ];
        for (const [stars, normal, boss] of cases) {
            const a = rig();
            const g = a.meta.grantClearCoins(stars, false, true);
            expect(g.coins, `${stars}★ 普通关首通`).toBe(normal);
            expect(a.meta.coins).toBe(normal);
            expect(g.capped).toBe(false);
            expect(g.reason).toContain('首通');

            const b = rig();
            expect(b.meta.grantClearCoins(stars, true, true).coins, `${stars}★ Boss 首通`).toBe(boss);
        }
    });

    it('复刷：普通 5 / Boss 10（同一关反复打的稳定单价）', () => {
        const a = rig();
        expect(a.meta.grantClearCoins(3, false, false).coins).toBe(CLEAR_COIN_REPLAY_NORMAL);
        expect(a.meta.grantClearCoins(1, false, false).coins).toBe(CLEAR_COIN_REPLAY_NORMAL);
        const b = rig();
        expect(b.meta.grantClearCoins(1, true, false).coins).toBe(CLEAR_COIN_REPLAY_BOSS);
    });

    it(`普通关复刷 ${CLEAR_COIN_REPLAY_DAILY_CAP / CLEAR_COIN_REPLAY_NORMAL} 盘到顶，之后降 ${CLEAR_COIN_REPLAY_CAPPED_NORMAL}（不清零）`, () => {
        const a = rig();
        const full = CLEAR_COIN_REPLAY_DAILY_CAP / CLEAR_COIN_REPLAY_NORMAL; // 9
        for (let i = 0; i < full; i += 1) {
            const g = a.meta.grantClearCoins(3, false, false);
            expect(g.coins, `第 ${i + 1} 盘`).toBe(CLEAR_COIN_REPLAY_NORMAL);
            expect(g.capped).toBe(false);
        }
        expect(a.meta.coins).toBe(CLEAR_COIN_REPLAY_DAILY_CAP);

        const over = a.meta.grantClearCoins(3, false, false);
        expect(over.coins, '⛔ 到顶后不清零').toBe(CLEAR_COIN_REPLAY_CAPPED_NORMAL);
        expect(over.capped, '必须标记降档').toBe(true);
        expect(over.reason, '原因句要写明为什么变少').toContain('已达');
        // 再打一盘仍是安慰奖（不是只降一次）
        expect(a.meta.grantClearCoins(3, false, false).coins).toBe(CLEAR_COIN_REPLAY_CAPPED_NORMAL);
    });

    it('Boss 关复刷同受 45 日上限，超限降 2', () => {
        const a = rig();
        let sum = 0;
        let sawCapped = false;
        for (let i = 0; i < 8; i += 1) {
            const g = a.meta.grantClearCoins(3, true, false);
            if (g.capped) {
                expect(g.coins).toBe(CLEAR_COIN_REPLAY_CAPPED_BOSS);
                sawCapped = true;
            } else {
                expect(g.coins).toBe(CLEAR_COIN_REPLAY_BOSS);
                sum += g.coins;
            }
        }
        expect(sawCapped, '打 8 盘（80 豆）必然跨过 45 上限').toBe(true);
        expect(sum).toBeGreaterThanOrEqual(CLEAR_COIN_REPLAY_DAILY_CAP);
    });

    it('首通不吃复刷日上限（先把复刷刷满，首通仍拿全额）', () => {
        const a = rig();
        for (let i = 0; i < 10; i += 1) a.meta.grantClearCoins(3, false, false);
        const before = a.meta.coins;
        const g = a.meta.grantClearCoins(3, false, true);
        expect(g.coins, '首通 3★ 全额 40，不被复刷上限压成 1').toBe(40);
        expect(g.capped).toBe(false);
        expect(a.meta.coins).toBe(before + 40);
    });

    it('跨本地日归零（与签到同口径），次日恢复 5', () => {
        const a = rig();
        for (let i = 0; i < 10; i += 1) a.meta.grantClearCoins(3, false, false);
        expect(a.meta.grantClearCoins(3, false, false).capped).toBe(true);
        a.advance(DAY_MS);
        const next = a.meta.grantClearCoins(3, false, false);
        expect(next.capped, '新的一天重新计时').toBe(false);
        expect(next.coins).toBe(CLEAR_COIN_REPLAY_NORMAL);
    });

    it('复刷日计次落档（重开 MetaState 仍读到当日累计）', () => {
        const store = storage();
        const key = 'test.clearcoins.persist';
        let now = 1_700_000_000_000;
        const mk = (): MetaState => new MetaState({ storage: store, clock: () => now, metaKey: key });
        const first = mk();
        for (let i = 0; i < 9; i += 1) first.grantClearCoins(3, false, false);
        const second = mk();
        expect(second.grantClearCoins(3, false, false).capped, '45 已达 ⇒ 重载后仍降档').toBe(true);
        now += DAY_MS;
        const third = mk();
        expect(third.grantClearCoins(3, false, false).capped).toBe(false);
    });
});
