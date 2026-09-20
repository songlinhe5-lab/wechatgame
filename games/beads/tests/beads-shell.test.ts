/**
 * `game/beads-shell.ts` — the shell wiring (WXG-T-164 批0). The economy math is
 * covered by `meta-state.test.ts`; this file only exercises what the SHELL adds:
 * boot routing (首启直进玩法 / 0 心落菜单), menu→play spend vs. resume-no-spend,
 * overlay open/back + `meta:overlay` events, settings-toggle reuse of the play
 * setter, and meta/play save-sidecar isolation.
 *
 * Real framework services (Node platform), fake wall clock, isolated storage.
 */

import { describe, it, expect } from 'vitest';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    NullAssetProvider,
    NullAudioBackend,
    Viewport,
    createRng,
    type EventMap,
    type GameServices,
    type Storage,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { metaLayout, type MetaAction, type MetaOverlay } from '../src/view/meta-view.js';
import { STAMINA_MAX, STAMINA_START_COST } from '../src/config/tuning.js';

const START = 1_700_000_000_000;
const META_KEY = 'test.shell.meta';
const PLAY_KEY = 'test.shell.play';

interface Rig {
    readonly shell: BeadsShell;
    readonly storage: Storage;
    readonly overlayEvents: { open: boolean; name: string }[];
}

/** Centre of a menu/overlay button, in design space (matches `tapMeta`). */
function centerOf(overlay: MetaOverlay, id: MetaAction, levelIndex?: number): { x: number; y: number } {
    const b = metaLayout(overlay).buttons.find(
        (btn) => btn.id === id && (levelIndex === undefined || btn.levelIndex === levelIndex),
    )!;
    return { x: b.box.x + b.box.w / 2, y: b.box.y + b.box.h / 2 };
}

function rig(opts: { initialScreen?: 'play' | 'menu'; seedMeta?: Partial<ReturnType<typeof defaultBeadsMeta>> } = {}): Rig {
    let now = START;
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const storage = platform.createStorage();
    const events = new EventBus<EventMap>();
    const input = new InputManager();
    const services: GameServices = {
        events,
        input,
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('shell-test-seed'),
        viewport: new Viewport(750, 1334),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };

    if (opts.seedMeta) {
        storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), ...opts.seedMeta }));
    }

    const overlayEvents: { open: boolean; name: string }[] = [];
    // meta:* events are not in the frozen framework EventMap (framework untouched);
    // subscribe through the same loose cast the shell uses to emit them.
    (events as unknown as { on: (t: string, cb: (p: unknown) => void) => void }).on(
        'meta:overlay',
        (p) => overlayEvents.push(p as { open: boolean; name: string }),
    );

    const shell = createBeadsShell({
        clock: () => now,
        metaKey: META_KEY,
        play: { saveKey: PLAY_KEY },
        ...(opts.initialScreen ? { initialScreen: opts.initialScreen } : {}),
    });
    shell.init(services);
    return { shell, storage, overlayEvents };
}

describe('BeadsShell — boot routing (ux-spec §6.3；#1 · WXG-T-180 反转：首屏停主菜单)', () => {
    it('boots into the menu by default and does NOT spend a heart', () => {
        const r = rig();
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.meta!.stamina).toBe(STAMINA_MAX);
    });

    it('honors initialScreen=play (harness/tests) and spends one heart', () => {
        const r = rig({ initialScreen: 'play' });
        expect(r.shell.screen).toBe('play');
        expect(r.shell.meta!.stamina).toBe(STAMINA_MAX - STAMINA_START_COST);
    });

    it('initialScreen=play with 0 hearts falls back to the menu (体力系统生效)', () => {
        const r = rig({ initialScreen: 'play', seedMeta: { staminaCur: 0 } });
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.meta!.stamina).toBe(0);
    });
});

describe('BeadsShell — menu → play (§3.14 扣心时机)', () => {
    it('startGame from a fresh menu spends one heart', () => {
        const r = rig({ initialScreen: 'menu' });
        expect(r.shell.startGame()).toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.meta!.stamina).toBe(STAMINA_MAX - STAMINA_START_COST);
    });

    it('startGame refuses at 0 hearts and stays in the menu', () => {
        const r = rig({ initialScreen: 'menu', seedMeta: { staminaCur: 0 } });
        expect(r.shell.startGame()).toBe(false);
        expect(r.shell.screen).toBe('menu');
    });

    it('回主菜单弃本局棋盘 → 再开始 = 全新开当前关、再扣 1 心（不保留进度，WXG-T-165）', () => {
        const r = rig(); // 默认落菜单（未扣心）；本例走「进玩法→暂停→回菜单→再开始」链路
        const before = r.shell.meta!.stamina;
        r.shell.play.onPause();
        expect(r.shell.play.phase).toBe('paused');
        r.shell.showMenu(); // 暂停次钮「回主菜单」
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.startGame()).toBe(true);
        expect(r.shell.play.phase).toBe('playing');
        expect(r.shell.meta!.stamina).toBe(before - STAMINA_START_COST); // 弃本局 ⇒ 重进按新局扣心
    });
});

describe('BeadsShell — overlay stack + meta:overlay events', () => {
    it('opens the settings overlay from a menu tap and emits meta:overlay', () => {
        const r = rig({ initialScreen: 'menu' });
        const c = centerOf('none', 'open-settings');
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.overlay).toBe('settings');
        expect(r.overlayEvents.some((e) => e.open && e.name === 'settings')).toBe(true);
    });

    it('closes the overlay on back', () => {
        const r = rig({ initialScreen: 'menu' });
        const open = centerOf('none', 'open-signin');
        r.shell.tapMeta(open.x, open.y);
        expect(r.shell.overlay).toBe('signin');
        const back = centerOf('signin', 'back');
        r.shell.tapMeta(back.x, back.y);
        expect(r.shell.overlay).toBe('none');
        expect(r.overlayEvents.some((e) => !e.open)).toBe(true);
    });

    it('ignores a tap that hits nothing', () => {
        const r = rig({ initialScreen: 'menu' });
        expect(r.shell.tapMeta(2, 2)).toBe(false);
    });
});

describe('BeadsShell — 选关（#1 · WXG-T-180）', () => {
    it('opens the levels overlay from a menu tap', () => {
        const r = rig({ initialScreen: 'menu' });
        const c = centerOf('none', 'open-levels');
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.overlay).toBe('levels');
    });

    it('picks an unlocked level → enters play at that level and spends one heart', () => {
        const r = rig({ initialScreen: 'menu' });
        const o = centerOf('none', 'open-levels');
        r.shell.tapMeta(o.x, o.y);
        const before = r.shell.meta!.stamina;
        const c = centerOf('levels', 'pick-level', 0); // 索引 0 = 已解锁（maxUnlocked=1）
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.levelIndex).toBe(0);
        expect(r.shell.meta!.stamina).toBe(before - STAMINA_START_COST);
    });

    it('picks a locked level → 不消费（留菜单、不扣心）', () => {
        const r = rig({ initialScreen: 'menu' });
        const o = centerOf('none', 'open-levels');
        r.shell.tapMeta(o.x, o.y);
        const before = r.shell.meta!.stamina;
        const c = centerOf('levels', 'pick-level', 5); // 锁定（maxUnlocked=1）
        r.shell.tapMeta(c.x, c.y);
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.meta!.stamina).toBe(before);
    });
});

describe('BeadsShell — settings reuse (复用 S9 play setter)', () => {
    it('toggling vibrate in the menu overlay flips the play setting', () => {
        const r = rig({ initialScreen: 'menu' });
        const before = r.shell.play.vibrateOn;
        const open = centerOf('none', 'open-settings');
        r.shell.tapMeta(open.x, open.y);
        const v = centerOf('settings', 'toggle-vibrate');
        r.shell.tapMeta(v.x, v.y);
        expect(r.shell.play.vibrateOn).toBe(!before);
    });
});

describe('BeadsShell — save sidecar isolation', () => {
    it('writes meta economy to its own key, leaving the play save untouched', () => {
        const r = rig({ initialScreen: 'menu' });
        const playBefore = r.storage.get(PLAY_KEY);
        r.shell.meta!.addCoins(50);
        r.shell.meta!.claimSignin();
        expect(JSON.parse(r.storage.get(META_KEY)!).coins).toBeGreaterThan(0);
        expect(r.storage.get(PLAY_KEY)).toBe(playBefore);
    });
});
