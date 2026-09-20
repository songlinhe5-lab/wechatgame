/**
 * retry/restart 逐次扣心（WXG-T-164，systems-index §3.14）+ 0 心看广告回满再重试
 * （§3.11 第二 live 位，用户 2026-09-18 拍板 B）。
 *
 * The gate lives in `BeadsGame._gateRunStart` (shared by retryLevel/restartRun);
 * this file wires it to a REAL `MetaState` so the spend → refuse → refill-ad →
 * retry chain is exercised end to end, not mocked. Mock ad settled explicitly
 * (same pattern as `revive.test.ts`).
 */

import { describe, it, expect } from 'vitest';
import { MockRewardedAdProvider } from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { MetaState } from '../src/game/meta-state.js';
import {
    STAMINA_MAX,
    STAMINA_REFILL_PLACEMENT,
    STAMINA_START_COST,
} from '../src/config/tuning.js';
import { failPanelLayout, type FailPanelAction } from '../src/systems/fail-panel.js';
import { sprintSettleLayout } from '../src/systems/sprint-settle.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import type { BeadsGame } from '../src/game/beads-game.js';

const START = 1_700_000_000_000;

interface Rig {
    readonly harness: Harness;
    readonly meta: MetaState;
    readonly ad: MockRewardedAdProvider;
    readonly game: BeadsGame;
}

function rig(saveKey: string): Rig {
    let now = START;
    const metaStore = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createStorage();
    const meta = new MetaState({ storage: metaStore, clock: () => now, metaKey: `${saveKey}.meta` });
    const harness = createBeadsHarness({
        noAssemble: true,
        levels: [simpleTestLevel()],
        saveKey,
        // The exact closures BeadsShell injects (§3.14 扣心 / §3.11 回满).
        canStartRun: () => meta.spendStamina(STAMINA_START_COST),
        onStaminaRefill: () => meta.refillStamina(),
    });
    return {
        harness,
        meta,
        game: harness.game,
        ad: harness.services.rewardedAd as MockRewardedAdProvider,
    };
}

function tapFail(game: BeadsGame, id: FailPanelAction, reviveAvailable: boolean): boolean {
    const button = failPanelLayout(reviveAvailable).buttons.find((b) => b.id === id)!;
    return game.tapDesign(
        (button.rect.xMin + button.rect.xMax) / 2,
        (button.rect.yMin + button.rect.yMax) / 2,
    );
}

function expire(harness: Harness): void {
    while (harness.game.phase === 'playing') harness.advance(0.5);
    expect(harness.game.phase).toBe('game-over');
}

describe('retry 逐次扣心 (§3.14 新局开局消耗)', () => {
    it('spends one heart on an ordinary retry when stamina is available', () => {
        const r = rig('test.runstart.spend');
        expect(r.meta.stamina).toBe(STAMINA_MAX);
        expire(r.harness);
        expect(tapFail(r.game, 'retry', true)).toBe(true);
        expect(r.game.phase).toBe('playing');
        expect(r.meta.stamina).toBe(STAMINA_MAX - STAMINA_START_COST);
    });

    it('at 0 hearts, retry loads the stamina-refill ad and stays GAME_OVER', () => {
        const r = rig('test.runstart.blocked');
        r.meta.spendStamina(STAMINA_MAX); // drain to 0
        expect(r.meta.stamina).toBe(0);
        expire(r.harness);
        expect(tapFail(r.game, 'retry', true)).toBe(true); // tap consumed, retry gated
        expect(r.game.phase).toBe('game-over'); // ad in flight, not retried yet
        expect(r.game.watchingAd).toBe(true);
        expect(r.ad.placement).toBe(STAMINA_REFILL_PLACEMENT);
        expect(r.meta.stamina).toBe(0); // nothing spent while blocked
    });

    it('completing the refill ad回满 to MAX then retries, spending one heart', () => {
        const r = rig('test.runstart.refill');
        r.meta.spendStamina(STAMINA_MAX);
        expire(r.harness);
        tapFail(r.game, 'retry', true);
        r.ad.settle('complete');
        // refill → STAMINA_MAX, then the replayed retry spends START_COST.
        expect(r.meta.stamina).toBe(STAMINA_MAX - STAMINA_START_COST);
        expect(r.game.phase).toBe('playing');
        expect(r.game.watchingAd).toBe(false);
    });

    it('a skipped refill ad leaves the player on GAME_OVER at 0 hearts (可再点/等恢复)', () => {
        const r = rig('test.runstart.skip');
        r.meta.spendStamina(STAMINA_MAX);
        expire(r.harness);
        tapFail(r.game, 'retry', true);
        r.ad.settle('skip');
        expect(r.game.phase).toBe('game-over');
        expect(r.game.watchingAd).toBe(false);
        expect(r.meta.stamina).toBe(0);
    });
});

describe('sprint retry 不设门 (§3.14 冲刺消耗不冻结)', () => {
    it('retries a sprint run at 0 hearts without spending or showing an ad', () => {
        const r = rig('test.runstart.sprint');
        r.meta.spendStamina(STAMINA_MAX); // 0 hearts
        r.game.startSprint();
        while (r.game.phase === 'playing') r.harness.advance(1);
        expect(r.game.phase).toBe('game-over');
        const again = sprintSettleLayout().buttons.find((b) => b.id === 'again')!.rect;
        expect(
            r.game.tapDesign((again.xMin + again.xMax) / 2, (again.yMin + again.yMax) / 2),
        ).toBe(true);
        expect(r.game.phase).toBe('playing');
        expect(r.game.mode).toBe('sprint');
        expect(r.meta.stamina).toBe(0); // ungated
        expect(r.ad.placement).not.toBe(STAMINA_REFILL_PLACEMENT);
    });
});
