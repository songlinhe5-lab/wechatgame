/**
 * EP13-S3 · 菜单侧 0 心点可进格 = 不进关不扣心 + 拉起**既有**广告加心激励位（C-4，Q13=乙）。
 *
 * 验收真源 = `arc-level-select-spec.md` §4-R7 行（逐字）+ 该表「0 心点格」列；零新数值、
 * 激励位内容零改动。通道 = 乙（用户 2026-10-17 裁）：shell 直取 `services.rewardedAd`。
 *
 * **串道反例（DoD 硬项）**：发奖回调是**广播**（`platform/rewarded-ad.ts:85-88`），play 的
 * 续时腿只看「机器仍在 game-over」⇒ 若不设弃局标，「上局失败 → 回菜单 → 0 心看广告」会被
 * 拉回旧失败盘白得加时（`beads-game.ts:3041-3069`）。本文件最后一臂先红。
 */

import { describe, it, expect } from 'vitest';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    MockRewardedAdProvider,
    NullAssetProvider,
    NullAudioBackend,
    Viewport,
    createRng,
    type EventMap,
    type GameServices,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { defaultBeadsSave } from '../src/game/save-schema.js';
import { LEVELS } from '../src/config/levels.js';
import { HEART_AD_GAIN, STAMINA_REFILL_PLACEMENT, WALL_ROWS } from '../src/config/tuning.js';
import { metaLayout } from '../src/view/meta-view.js';
import { simpleTestLevel } from './helpers.js';

const PLAY_KEY = 'test.arc-refill.play';
const META_KEY = 'test.arc-refill.meta';

interface Rig {
    readonly shell: BeadsShell;
    readonly ad: MockRewardedAdProvider;
    readonly overlayEvents: { open: boolean; name: string }[];
    readonly now: { t: number };
}

function rig(
    opts: { stamina?: number; maxUnlocked?: number; initialScreen?: 'play' | 'menu'; levels?: typeof LEVELS } = {},
): Rig {
    const now = { t: 1_000_000 };
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const storage = platform.createStorage();
    storage.set(
        PLAY_KEY,
        JSON.stringify({
            ...defaultBeadsSave(),
            ...(opts.maxUnlocked !== undefined ? { maxUnlockedLevel: opts.maxUnlocked } : {}),
        }),
    );
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), staminaCur: opts.stamina ?? 0 }));
    const events = new EventBus<EventMap>();
    const overlayEvents: { open: boolean; name: string }[] = [];
    (events as unknown as { on: (t: string, cb: (p: unknown) => void) => void }).on('meta:overlay', (p) =>
        overlayEvents.push(p as { open: boolean; name: string }),
    );
    const services: GameServices = {
        events,
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('ep13s3-seed'),
        viewport: new Viewport(750, 1334),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({
        clock: () => now.t,
        metaKey: META_KEY,
        play: { saveKey: PLAY_KEY, ...(opts.levels ? { levels: opts.levels } : {}) },
        ...(opts.initialScreen ? { initialScreen: opts.initialScreen } : {}),
    });
    shell.init(services);
    return { shell, ad: services.rewardedAd as MockRewardedAdProvider, overlayEvents, now };
}

const centerOf = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

function openLevels(shell: BeadsShell): void {
    const card = metaLayout('none', WALL_ROWS, shell.menuAnchors).buttons.find((b) => b.id === 'open-levels')!;
    const c = centerOf(card.box);
    expect(shell.tapMeta(c.x, c.y)).toBe(true);
    expect(shell.overlay).toBe('levels');
}

function wallCell(slot: number) {
    return metaLayout('levels', WALL_ROWS).buttons.filter((b) => b.id === 'pick-level')[slot]!;
}

function tapCell(r: Rig, slot: number): boolean {
    const c = centerOf(wallCell(slot).box);
    return r.shell.tapMeta(c.x, c.y);
}

describe('EP13-S3 · R7 主臂（0 心点可进格）', () => {
    it('不进关、不扣心、拉起既有加心位；发奖 +=HEART_AD_GAIN 后留本页，再点即进', () => {
        const r = rig({ stamina: 0, maxUnlocked: 9 });
        openLevels(r.shell);
        const eventsBefore = r.overlayEvents.length;
        expect(tapCell(r, 2), '0 心 ⇒ 由加心位承接（tap 被消费，但不导航）').toBe(true);
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.overlay, '玩家留本页').toBe('levels');
        expect(r.shell.meta!.stamina, '不扣心（本就 0）').toBe(0);
        expect(r.shell.play.levelIndex, '不得进关装配（关卡指针未动）').toBe(0);
        expect(r.overlayEvents.length, '零新增 overlay 事件').toBe(eventsBefore);
        expect(r.ad.showing, '拉起既有广告加心激励位').toBe(true);
        expect(r.ad.placement, '走既有 stamina-refill 位（零新 placement）').toBe(STAMINA_REFILL_PLACEMENT);

        r.ad.settle('complete');
        // §3.14 v1.80（WXG-T-351）：奖励由「回满 STAMINA_MAX」改「固定 +HEART_AD_GAIN」。
        expect(r.shell.meta!.stamina, '发奖 = 固定 +HEART_AD_GAIN（非回满）').toBe(HEART_AD_GAIN);
        expect(r.shell.screen, '发奖不得自动进关（再点才进）').toBe('menu');
        expect(r.shell.overlay).toBe('levels');

        expect(tapCell(r, 2), '加心后再点成功').toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.phase).toBe('playing');
        expect(r.shell.play.levelIndex, '落到所点之关').toBe(2);
        expect(r.shell.meta!.stamina).toBe(HEART_AD_GAIN - 1);
    });

    it('跳过（skip）→ 不加心、留本页；再次点格可重新拉起加心位', () => {
        const r = rig({ stamina: 0, maxUnlocked: 9 });
        openLevels(r.shell);
        expect(tapCell(r, 0)).toBe(true);
        r.ad.settle('skip');
        expect(r.shell.meta!.stamina).toBe(0);
        expect(r.shell.screen).toBe('menu');
        expect(r.ad.showing).toBe(false);
        expect(tapCell(r, 0), '仍在 0 心 ⇒ 再次交给加心位').toBe(true);
        expect(r.ad.showing, '在途标记已清 ⇒ 加心位可再拉起').toBe(true);
    });

    it('0 心点未解锁格 → 闸门先行：零事件、零扣心、**不拉广告**', () => {
        const r = rig({ stamina: 0, maxUnlocked: 1 });
        openLevels(r.shell);
        expect(tapCell(r, 1), '未解锁格不消费').toBe(false);
        expect(r.ad.showing, '闸门逐字优先 ⇒ 不进加心位流程').toBe(false);
        expect(r.shell.meta!.stamina).toBe(0);
    });

    it('主钮「开始游戏」0 心 = 同一加心位（统一下入口的自然结果）', () => {
        const r = rig({ stamina: 0, maxUnlocked: 9 });
        const start = metaLayout('none', WALL_ROWS, r.shell.menuAnchors).buttons.find((b) => b.id === 'start')!;
        const c = centerOf(start.box);
        expect(r.shell.tapMeta(c.x, c.y), '0 心 ⇒ 加心位承接（不导航）').toBe(true);
        expect(r.shell.screen).toBe('menu');
        expect(r.ad.showing).toBe(true);
        r.ad.settle('complete');
        expect(r.shell.meta!.stamina).toBe(HEART_AD_GAIN);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.screen).toBe('play');
    });
});

describe('EP13-S3 · 串道反例（DoD 硬项）', () => {
    it('上局 GAME_OVER → 回主菜单 → 0 心看广告：旧盘不复活、零加时、不切 PLAYING', () => {
        // 1 心开局 ⇒ 首局开局扣尽 ⇒ 0 心。
        const r = rig({
            stamina: 1,
            maxUnlocked: 1,
            initialScreen: 'play',
            levels: [simpleTestLevel()] as unknown as typeof LEVELS,
        });
        for (let i = 0; i < 40 && r.shell.play.phase === 'playing'; i++) r.shell.update(10);
        expect(r.shell.play.phase, '上局已失败').toBe('game-over');
        const remainingBefore = r.shell.play.remaining;
        const reviveBefore = r.shell.play.reviveBonusSec;
        expect(r.shell.meta!.stamina).toBe(0);

        r.shell.showMenu();
        expect(r.shell.screen).toBe('menu');
        openLevels(r.shell);
        expect(tapCell(r, 0), '0 心 ⇒ 留本页（加心位承接）').toBe(true);
        expect(r.shell.screen).toBe('menu');
        expect(r.ad.showing).toBe(true);
        expect(r.ad.placement).toBe(STAMINA_REFILL_PLACEMENT);

        r.ad.settle('complete');
        // 广播发奖：play 的续时腿也在场 ⇒ 必须被「弃局标」挡住。
        expect(r.shell.play.phase, '⛔ 不得被拉回 PLAYING（旧失败盘不复活）').toBe('game-over');
        expect(r.shell.play.reviveBonusSec, '⛔ 零加时（⇒ 零 sfx_revive_ok，A05-19 同源）').toBe(reviveBefore);
        expect(r.shell.play.remaining, '⛔ 计时未被加时').toBe(remainingBefore);
        expect(r.shell.screen, '玩家仍留菜单').toBe('menu');
        expect(r.shell.overlay).toBe('levels');
        expect(r.shell.meta!.stamina, '菜单侧加心照常到账').toBe(HEART_AD_GAIN);

        // 再点 ⇒ 全新开该关（弃局标随装配清除）。
        expect(tapCell(r, 0)).toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.phase).toBe('playing');
        expect(r.shell.play.remaining).toBeGreaterThan(remainingBefore);
    });
});
