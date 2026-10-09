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

/**
 * Centre of a menu/overlay button, in design space (matches `tapMeta`).
 * EP12-S6：作品格以**墙槽位**定位（`slot`，0-based）——槽位 ≠ 关索引（陈列序 = DI 升序），
 * 旧参名 `levelIndex` 正是 `beads-shell.ts:258` 回归的温床，就此改名。
 */
function centerOf(overlay: MetaOverlay, id: MetaAction, slot?: number): { x: number; y: number } {
    const b = metaLayout(overlay).buttons.find(
        (btn) => btn.id === id && (slot === undefined || btn.slot === slot),
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

    it('settings overlay 两列布局：debug-info 钮与震动同排左右，点击经 play 通道切换', () => {
        // 用户 2026-09-25 直派（ux-spec v1.19）：6 toggle = 3 行 × 2 列；DEBUG 钮
        // 与暂停面板同串值（toggle-debug-info），动作走 shell default → applySettingsAction。
        const r = rig({ initialScreen: 'menu' });
        const open = centerOf('none', 'open-settings');
        r.shell.tapMeta(open.x, open.y);
        expect(r.shell.overlay).toBe('settings');
        const vib = metaLayout('settings').buttons.find((b) => b.id === 'toggle-vibrate')!;
        const dbg = metaLayout('settings').buttons.find((b) => b.id === 'toggle-debug-info')!;
        expect(dbg.box.y).toBe(vib.box.y); // 同排
        expect(dbg.box.x).toBeGreaterThan(vib.box.x + vib.box.w); // 分居左右
        expect(r.shell.play.debugInfo).toBe(false);
        r.shell.tapMeta(dbg.box.x + dbg.box.w / 2, dbg.box.y + dbg.box.h / 2);
        expect(r.shell.play.debugInfo).toBe(true); // 持久化面见 pause-settings §8-13
        r.shell.tapMeta(dbg.box.x + dbg.box.w / 2, dbg.box.y + dbg.box.h / 2);
        expect(r.shell.play.debugInfo).toBe(false);
    });
});

// menu-architecture §1.3 第五轮：主菜单主区由作品墙 → **走马灯小卡**；墙下移 `levels` overlay。
// ⇒ 卡 = 菜单唯一选关入口（`open-levels`），选关行为改在 overlay 内钉；`levels` overlay 几何同源由
// `meta-menu-wall.test.ts` 兜。
describe('BeadsShell — 走马灯卡入口 + levels overlay 选关（menu-architecture §1.3 第五轮）', () => {
    it('主菜单 = 走马灯卡为唯一选关入口（点卡 → 开 `levels`，不扣心、不进玩法）', () => {
        const r = rig({ initialScreen: 'menu' });
        const ids = metaLayout('none').buttons.map((b) => b.id);
        expect(ids, '卡 = 入口').toContain('open-levels');
        expect(ids, '墙已下移 overlay ⇒ 菜单无 pick-level').not.toContain('pick-level');
        expect([...new Set(ids)].sort()).toEqual(['open-levels', 'open-settings', 'open-signin', 'start']);
        const before = r.shell.meta!.stamina;
        const c = centerOf('none', 'open-levels');
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.overlay).toBe('levels');
        expect(r.shell.screen).toBe('menu'); // 只是开 overlay
        expect(r.shell.meta!.stamina).toBe(before); // 点入口不扣心
    });

    it('overlay 内点已解锁格 → 进**映射后的关**（非槽位号）且扣 1 心', () => {
        const r = rig({ initialScreen: 'menu' });
        const before = r.shell.meta!.stamina;
        const open = centerOf('none', 'open-levels');
        r.shell.tapMeta(open.x, open.y);
        expect(r.shell.overlay).toBe('levels');
        // 陈列序 = DI 升序 ⇒ 槽 0 = 最易关 = L1 = 索引 0（maxUnlocked=1 时唯一已解锁）。
        const c = centerOf('levels', 'pick-level', 0);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.play.levelIndex).toBe(0);
        expect(r.shell.meta!.stamina).toBe(before - STAMINA_START_COST);
    });

    it('overlay 内未解锁格 → 不消费（`tapMeta` 返回 false、留选关页、不扣心 = 零新增事件）', () => {
        const r = rig({ initialScreen: 'menu' });
        const before = r.shell.meta!.stamina;
        const open = centerOf('none', 'open-levels');
        r.shell.tapMeta(open.x, open.y);
        const eventsAfterOpen = r.overlayEvents.length; // 开页已发 1 条 meta:overlay
        // 槽 1 = 次易关（L8 ⇒ 索引 7），maxUnlocked=1 ⇒ 未解锁。
        const c = centerOf('levels', 'pick-level', 1);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(false);
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.overlay).toBe('levels');
        expect(r.shell.meta!.stamina).toBe(before);
        expect(r.shell.play.levelIndex).toBe(0); // 未跳转
        expect(r.overlayEvents.length, '零事件：未解锁格不再发 `meta:*`').toBe(eventsAfterOpen);
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
