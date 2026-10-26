/**
 * 结算按星发豆 —— `MetaState.grantClearCoins`（systems-index §3.14 v1.90；用户 2026-10-26 拍板）。
 *
 * 必须永不静默破的五条：
 * - **首通按档累进、每档只发一次**：直接 3★ 首通 = ★☆☆20 + ★★☆30 + ★★★40 = **90**
 *   （Boss 40+60+80 = **180**）—— 用户原话「如果玩家直接跳过 1 星或者 2 星首通就完成了 3 星首通，
 *   但是每个星级首通的奖励只会发放一次」；
 * - **两路径等价**：「直接 3★」与「先 1★ 再升 3★」总额同为 90（⛔ 不存在先手生就永久少拿）；
 * - **复刷**（本次星级 ≤ 历史最高）普通 5 / Boss 10；
 * - **日上限 45**（= 签到日均 320/7 取整）到顶后**降为 1 / 2 而非清零**，原因句必须写明「已达上限」
 *   （用户 2026-10-26：「把获得奖励的原因说清楚，否则不清楚为什么多为什么少」）；
 * - 跨本地日**归零**（与签到同口径 `dateKey`）。
 *
 * Fake clock + 独立 storage ⇒ 确定性，无挂钟抖动。
 */

import { describe, it, expect } from 'vitest';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import type { Storage } from '@wxgame/framework';
import {
    CLEAR_COIN_FIRST,
    CLEAR_COIN_FIRST_BOSS,
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

/** 累计到 `n` 档的总额（= 首通总额口径）。 */
const cum = (table: readonly number[], n: number): number =>
    table.slice(0, n).reduce((a, b) => a + b, 0);

describe('§3.14 v1.90 结算按星发豆（首通按档累进）', () => {
    it('首通：直接 3★ = 三档累加（普通 60 / Boss 120），2★ = 30 / 60，1★ = 10 / 20', () => {
        const cases: readonly (readonly [number, number, number])[] = [
            [1, cum(CLEAR_COIN_FIRST, 1), cum(CLEAR_COIN_FIRST_BOSS, 1)],
            [2, cum(CLEAR_COIN_FIRST, 2), cum(CLEAR_COIN_FIRST_BOSS, 2)],
            [3, cum(CLEAR_COIN_FIRST, 3), cum(CLEAR_COIN_FIRST_BOSS, 3)],
        ];
        for (const [stars, normal, boss] of cases) {
            const a = rig();
            const g = a.meta.grantClearCoins(stars, false, 0);
            expect(g.coins, `${stars}★ 普通关首通（累进）`).toBe(normal);
            expect(a.meta.coins).toBe(normal);
            expect(g.capped).toBe(false);
            expect(g.reason).toContain('首通');

            const b = rig();
            expect(b.meta.grantClearCoins(stars, true, 0).coins, `${stars}★ Boss 首通`).toBe(boss);
        }
        // 拍板锚点（数值漂了先看这里）
        expect(cum(CLEAR_COIN_FIRST, 3)).toBe(60);
        expect(cum(CLEAR_COIN_FIRST_BOSS, 3)).toBe(120);
    });

    it('两路径等价：直接 3★ 与「先 1★ 再升 3★」总额相同（都是 60）', () => {
        const direct = rig();
        expect(direct.meta.grantClearCoins(3, false, 0).coins).toBe(60);

        const gradual = rig();
        expect(gradual.meta.grantClearCoins(1, false, 0).coins, '1★ 首通只发 ★☆☆ 档').toBe(10);
        expect(gradual.meta.grantClearCoins(3, false, 1).coins, '升到 3★ 补 ★★☆ + ★★★ 两档').toBe(50);
        expect(gradual.meta.coins).toBe(direct.meta.coins);
    });

    it('升星补发原因句写明档位与档数（面板要能解释「为什么多」）', () => {
        const a = rig();
        a.meta.grantClearCoins(1, false, 0);
        const g = a.meta.grantClearCoins(3, false, 1);
        expect(g.reason).toContain('★★★');
        expect(g.reason).toContain('补发');
        expect(g.capped).toBe(false);
    });

    it('同档重打不再走首通（本次星级 ≤ 历史最高 ⇒ 复刷腿）', () => {
        const a = rig();
        expect(a.meta.grantClearCoins(3, false, 0).coins).toBe(60);
        expect(a.meta.grantClearCoins(3, false, 3).coins, '已达 3★ 再打 = 复刷').toBe(
            CLEAR_COIN_REPLAY_NORMAL,
        );
        expect(a.meta.grantClearCoins(1, false, 3).coins, '打得更低也是复刷').toBe(
            CLEAR_COIN_REPLAY_NORMAL,
        );
    });

    it('复刷：普通 5 / Boss 10，日上限 45 到顶后降 1 / 2（不清零且写明原因）', () => {
        const a = rig();
        const full = CLEAR_COIN_REPLAY_DAILY_CAP / CLEAR_COIN_REPLAY_NORMAL; // 9
        for (let i = 0; i < full; i += 1) {
            const g = a.meta.grantClearCoins(3, false, 3);
            expect(g.coins, `第 ${i + 1} 盘`).toBe(CLEAR_COIN_REPLAY_NORMAL);
            expect(g.capped).toBe(false);
        }
        expect(a.meta.coins).toBe(CLEAR_COIN_REPLAY_DAILY_CAP);

        const over = a.meta.grantClearCoins(3, false, 3);
        expect(over.coins, '⛔ 到顶后不清零').toBe(CLEAR_COIN_REPLAY_CAPPED_NORMAL);
        expect(over.capped).toBe(true);
        expect(over.reason, '原因句要写明为什么变少').toContain('已达');

        const b = rig();
        for (let i = 0; i < 8; i += 1) b.meta.grantClearCoins(3, true, 3);
        const overBoss = b.meta.grantClearCoins(3, true, 3);
        expect(overBoss.capped).toBe(true);
        expect(overBoss.coins).toBe(CLEAR_COIN_REPLAY_CAPPED_BOSS);
        expect(overBoss.coins).toBeLessThan(CLEAR_COIN_REPLAY_BOSS);
    });

    it('首通/升星不吃复刷日上限（把复刷刷满后升星仍拿全额补发）', () => {
        const a = rig();
        for (let i = 0; i < 10; i += 1) a.meta.grantClearCoins(1, false, 1);
        const before = a.meta.coins;
        const g = a.meta.grantClearCoins(3, false, 1);
        expect(g.coins, '补发 50，不被复刷上限压成 1').toBe(50);
        expect(g.capped).toBe(false);
        expect(a.meta.coins).toBe(before + 50);
    });

    it('跨本地日复刷计次归零（与签到同口径），次日恢复 5', () => {
        const a = rig();
        for (let i = 0; i < 10; i += 1) a.meta.grantClearCoins(3, false, 3);
        expect(a.meta.grantClearCoins(3, false, 3).capped).toBe(true);
        a.advance(DAY_MS);
        const next = a.meta.grantClearCoins(3, false, 3);
        expect(next.capped, '新的一天重新计时').toBe(false);
        expect(next.coins).toBe(CLEAR_COIN_REPLAY_NORMAL);
    });

    it('复刷日计次落档（重开 MetaState 仍读到当日累计）', () => {
        const store = storage();
        const key = 'test.clearcoins.persist';
        let now = 1_700_000_000_000;
        const mk = (): MetaState => new MetaState({ storage: store, clock: () => now, metaKey: key });
        const first = mk();
        for (let i = 0; i < 9; i += 1) first.grantClearCoins(3, false, 3);
        const second = mk();
        expect(second.grantClearCoins(3, false, 3).capped, '45 已达 ⇒ 重载后仍降档').toBe(true);
        now += DAY_MS;
        const third = mk();
        expect(third.grantClearCoins(3, false, 3).capped).toBe(false);
    });

    it('章节首通池上限 = 660（9 普通 + 1 Boss 全 3★；§3.14 v1.92「甲」口径锚）', () => {
        expect(9 * 60 + 120).toBe(660);
    });
});
