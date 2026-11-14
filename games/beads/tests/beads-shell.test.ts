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
    RenderModelBuilder,
    type EventMap,
    type GameServices,
    type Storage,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { metaLayout, type MetaAction, type MetaOverlay } from '../src/view/meta-view.js';
import { anchoredGeo, levelDetailPlate, overlayPlate } from '../src/view/meta-layout.js';
import {
    settingsContentButtons,
    settingsContentViewport,
    settingsScrollMax,
} from '../src/view/settings-content.js';
import { SKIN_CARD_GRID } from '../src/view/skins-content.js';
import { DEFAULT_SKIN_ID, registeredSkins } from '../src/config/skins/registry.js';
import {
    DESIGN_H,
    DESIGN_W,
    SKINS_CARD_H,
    SKIN_PRICES_COINS,
    STAMINA_MAX,
    STAMINA_START_COST,
    WALL_ROWS,
} from '../src/config/tuning.js';
import { DEBUG_OUTLINE_TILE_HEX } from '../src/view/palette.js';

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

/**
 * 设置列表单列 cell：第 0–4 行滚动量 0 即可见，第 5–10 行需先上滚（`setSettingsScroll`）。
 * 返回「同一行在屏上的点」与所需滚动量（绘制 = box + scroll，命中 = 点 − scroll）。
 */
function settingsRowPoint(id: MetaAction): { x: number; y: number; scroll: number } {
    const plate = levelDetailPlate();
    const box = settingsContentButtons(plate).find((b) => b.id === id)!.box;
    const vp = settingsContentViewport(plate);
    const cy = box.y + box.h / 2;
    const scroll = Math.max(0, Math.min(settingsScrollMax(plate), vp.y + vp.h / 2 - cy));
    return { x: box.x + box.w / 2, y: cy + scroll, scroll };
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

    // `[WXG-T-454]` 全屏页切换 = 整栈替换（用户 2026-10-27 主张，已是现状——Navigator.reset
    // 换整栈、visibleRoutes 只画栈顶 page 及以上）：带压栈内容（设置弹窗）进 play ⇒
    // 旧页与覆盖层全部去除，不残留任何菜单侧压栈件（对话框才压栈，全屏页不压栈）。
    it('startGame replaces the whole stack: modal under it is dropped (全屏页非二级页)', () => {
        const r = rig({ initialScreen: 'menu' });
        const hit = anchoredGeo(r.shell.menuAnchors!).settingsHit;
        expect(r.shell.tapMeta(hit.x + hit.w / 2, hit.y + hit.h / 2)).toBe(true);
        expect(r.shell.overlay).toBe('settings');
        expect(r.shell.startGame()).toBe(true);
        expect(r.shell.screen).toBe('play');
        expect(r.shell.overlay).toBe('none');
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

    it('`[WXG-T-452]` 暂停中回主菜单 ⇒ 相位离开面板态（syncPhase 不得把暂停面板复压回菜单栈顶）', () => {
        const r = rig({ initialScreen: 'play' });
        r.shell.play.onPause();
        expect(r.shell.play.phase).toBe('paused');
        r.shell.showMenu();
        expect(r.shell.screen).toBe('menu');
        // 弃局腿必须先收面板链：phase 停在 'paused' 的话，下一帧 `syncPhase('paused')`
        // 会把暂停面板重新 push 回菜单栈顶 ⇒ 主菜单残留暂停弹窗（真机实拍 2026-10-27）。
        expect(r.shell.play.phase).toBe('playing');
        expect(r.shell.play.phase === 'paused' || r.shell.play.phase === 'level-clear' ||
            r.shell.play.phase === 'game-over' || r.shell.play.phase === 'finish').toBe(false);
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

    it('closes the overlay via ✕ (close-settings)', () => {
        const r = rig({ initialScreen: 'menu' });
        // 2026-10-13 §5.1b 第三批：菜单侧签到入口随底部纸钮退役（信箱实装前不可达）⇒
        // 关闭腿改用**设置 overlay** 覆盖（overlay 代码本身按裁定保留不删）。
        // 2026-11-14 同步 Figma：设置页去掉「返回」钮，唯一关闭 = 右上 ✕。
        const open = centerOf('none', 'open-settings');
        r.shell.tapMeta(open.x, open.y);
        expect(r.shell.overlay).toBe('settings');
        const back = centerOf('settings', 'close-settings');
        r.shell.tapMeta(back.x, back.y);
        expect(r.shell.overlay).toBe('none');
        expect(r.overlayEvents.some((e) => !e.open)).toBe(true);
    });

    it('ignores a tap that hits nothing', () => {
        const r = rig({ initialScreen: 'menu' });
        expect(r.shell.tapMeta(2, 2)).toBe(false);
    });

    it('settings overlay 单列 cell 列表：debug-info 钮在震动正下方，点击经 play 通道切换', () => {
        // 2026-11-14 同步 Figma 设置 cell 模版：单列 = 11 行（⛔ 不再两列）；DEBUG 钮
        // 与暂停面板同串值（toggle-debug-info），动作走 shell default → applySettingsAction。
        const r = rig({ initialScreen: 'menu' });
        const open = centerOf('none', 'open-settings');
        r.shell.tapMeta(open.x, open.y);
        expect(r.shell.overlay).toBe('settings');
        const vib = metaLayout('settings').buttons.find((b) => b.id === 'toggle-vibrate')!;
        const dbg = metaLayout('settings').buttons.find((b) => b.id === 'toggle-debug-info')!;
        expect(dbg.box.x).toBe(vib.box.x); // 同列
        expect(dbg.box.y).toBeLessThan(vib.box.y); // 行序：震动在前、Debug 在后（MENU_ORDER）
        expect(r.shell.play.debugInfo).toBe(false);
        const dp = settingsRowPoint('toggle-debug-info');
        r.shell.setSettingsScroll(dp.scroll);
        r.shell.tapMeta(dp.x, dp.y);
        expect(r.shell.play.debugInfo).toBe(true); // 持久化面见 pause-settings §8-13
        r.shell.tapMeta(dp.x, dp.y);
        expect(r.shell.play.debugInfo).toBe(false);
    });

    /**
     * `[WXG-T-444]` 用户令「把按钮的响应区域在 debug 模式下也绘制出来边界」。
     * 判据取**指令形态**（`stroke === DEBUG_OUTLINE_TILE_HEX` 且无 `fill` 的矩形），
     * 不看截图：这样「画了但画错位置」与「压根没画」在单测里可分辨。
     */
    it('`[WXG-T-444]` Debug 开 ⇒ 菜单钮逐颗画响应区边界（关 ⇒ 零指令）', () => {
        const r = rig({ initialScreen: 'menu' });
        const hitBoxes = (): { x: number; y: number; w: number; h: number }[] => {
            const b = new RenderModelBuilder(750, 1334);
            b.begin();
            r.shell.buildRenderModel(b);
            return b.end().commands.filter(
                (c) => c.kind === 'rect' && (c as { stroke?: string }).stroke === DEBUG_OUTLINE_TILE_HEX,
            ) as { x: number; y: number; w: number; h: number }[];
        };

        expect(hitBoxes(), 'Debug 关：一条都不发（金样本零漂移的前提）').toHaveLength(0);

        r.shell.tapMeta(centerOf('none', 'open-settings').x, centerOf('none', 'open-settings').y);
        const dbgp = settingsRowPoint('toggle-debug-guides');
        r.shell.setSettingsScroll(dbgp.scroll);
        r.shell.tapMeta(dbgp.x, dbgp.y);
        r.shell.tapMeta(centerOf('settings', 'close-settings').x, centerOf('settings', 'close-settings').y);
        expect(r.shell.overlay).toBe('none');

        // ⚠ 口径 = **命中腿自己那套几何**（`hitTestMeta` 传的是逐机 anchors），
        // ⛔ 不是 `metaLayout('none')` 的缺省档 —— 两者在非零安全区的设备上不是同一套。
        const hitLayout = metaLayout('none', WALL_ROWS, r.shell.menuAnchors);
        const menuButtons = hitLayout.buttons;
        const boxes = hitBoxes();
        expect(boxes, '主菜单每颗钮一条框').toHaveLength(menuButtons.length);
        // 逐颗对齐热区表：框必须**就是**判定用的 `box`（⛔ 不接受「画个大概」）。
        const byId = new Map(menuButtons.map((b) => [`${b.box.x},${b.box.y},${b.box.w},${b.box.h}`, b.id]));
        for (const box of boxes) {
            expect(byId.has(`${box.x},${box.y},${box.w},${box.h}`), `框 ${JSON.stringify(box)} 对上热区表`).toBe(true);
        }

        // 好友榜面板打开 ⇒ 面板自己的钮也要画（否则「点不上」时两套钮只有一套有框）。
        const rankBtn = menuButtons.find((b) => b.id === 'open-rank')!;
        r.shell.tapMeta(rankBtn.box.x + rankBtn.box.w / 2, rankBtn.box.y + rankBtn.box.h / 2);
        expect(r.shell.play.rankOpen).toBe(true);
        expect(hitBoxes(), '面板钮也入框').toHaveLength(menuButtons.length + 1);
    });

    it('设置 Debug 打开后，菜单与设置页都画出安全区标定线', () => {
        const r = rig({ initialScreen: 'menu' });
        const open = centerOf('none', 'open-settings');
        r.shell.tapMeta(open.x, open.y);
        const btn = metaLayout('settings').buttons.find((b) => b.id === 'toggle-debug-guides')!;
        const ghost = metaLayout('settings').buttons.find((b) => b.id === 'toggle-ghost-symbol')!;
        // 单列：Debug 在末行（第 11 行）、幽灵符号在其上一行，同列。
        expect(btn.box.y).toBeLessThan(ghost.box.y);
        expect(btn.box.x).toBe(ghost.box.x);
        expect(r.shell.play.debugGuides).toBe(false);
        const bp = settingsRowPoint('toggle-debug-guides');
        r.shell.setSettingsScroll(bp.scroll);
        r.shell.tapMeta(bp.x, bp.y);
        expect(r.shell.play.debugGuides).toBe(true);

        const textsOf = (): string[] => {
            const b = new RenderModelBuilder(750, 1334);
            b.begin();
            r.shell.buildRenderModel(b);
            return b.end().commands
                .filter((c) => c.kind === 'text')
                .map((c) => (c as { text: string }).text);
        };
        const openTexts = textsOf();
        expect(openTexts.some((t) => t.startsWith('safe '))).toBe(true);
        expect(openTexts.some((t) => t.startsWith('cap '))).toBe(true);
        expect(openTexts.some((t) => t.startsWith('home '))).toBe(true);

        r.shell.tapMeta(centerOf('settings', 'close-settings').x, centerOf('settings', 'close-settings').y);
        expect(r.shell.overlay).toBe('none');
        const menuTexts = textsOf();
        expect(menuTexts.some((t) => t.startsWith('safe '))).toBe(true);
        expect(menuTexts.some((t) => t.startsWith('home '))).toBe(true);
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
        // [WXG-T-280] 锚定档：卡两侧 ◀▶ 翻页两颗（carousel-prev/next）进热区集。
        // 2026-10-22 用户裁：签到入口回归（信封实装）；**WXG-T-365：原公告预留位升格为装扮馆入口
        // `open-skins`（提案 P4-甲）**⇒ 顶栏三颗全部在册，集合七枚（WXG-T-432 好友榜进册后八枚）。
        // `[WXG-T-432]` 主菜单「好友榜」纸钮（`open-rank`）进册 ⇒ 集合八枚。
        expect([...new Set(ids)].sort()).toEqual(['carousel-next', 'carousel-prev', 'open-levels', 'open-rank', 'open-settings', 'open-signin', 'open-skins', 'start']);
        expect(ids, '装扮馆入口已上提顶栏中档').toContain('open-skins');
        expect(ids, '签到入口回归（信封实装；旧 Q5① 退役口径作废）').toContain('open-signin');
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
        // 陈列序 = 配置文件恒等序（#2 反转）；maxUnlocked=1 ⇒ 唯一已解锁 = L1（id 1）= 槽 0。
        const c = centerOf('levels', 'pick-level', 0);
        // `[WXG-T-601]` 二段式：点格只开关卡详情（不扣心），详情「开始」才进关。
        expect(r.shell.tapMeta(c.x, c.y)).toBe(true);
        expect(r.shell.overlay).toBe('level-detail');
        expect(r.shell.meta!.stamina, '开详情不扣心').toBe(before);
        const start = centerOf('level-detail', 'start-detail');
        expect(r.shell.tapMeta(start.x, start.y)).toBe(true);
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
        // 槽 1 = L2（索引 1，恒等配置序），maxUnlocked=1 ⇒ 未解锁。
        const c = centerOf('levels', 'pick-level', 1);
        expect(r.shell.tapMeta(c.x, c.y)).toBe(false);
        expect(r.shell.screen).toBe('menu');
        expect(r.shell.overlay).toBe('levels');
        expect(r.shell.meta!.stamina).toBe(before);
        expect(r.shell.play.levelIndex).toBe(0); // 未跳转
        expect(r.overlayEvents.length, '零事件：未解锁格不再发 `meta:*`').toBe(eventsAfterOpen);
    });
});

describe('BeadsShell — 选关高亮 / 走马灯陈列关（WXG-T-912/913：首个 0 星关口径）', () => {
    /** 跑一帧绘制并取 shell 投影（`currentLevelIndex` 等字段由 `_metaViewData` 每帧覆写）。 */
    const viewOf = (shell: BeadsShell) => {
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        shell.buildRenderModel(builder);
        builder.end();
        return (shell as unknown as {
            _viewData: {
                currentLevelIndex: number;
                carouselLevel?: { id: number };
                carouselTitle?: string;
                carouselSeqLabel?: string;
                carouselPeer?: { id: number };
                carouselPeerSeqLabel?: string;
            };
        })._viewData;
    };

    it('前两关已有星、第三关未打 ⇒ 高亮第三关；⛔ 不跟 play.levelIndex', () => {
        const r = rig({ initialScreen: 'menu' });
        // 状态复刻（用户截图）：L1/L2 已通关（3 星 / 2 星）、L3 未打；最后载入关 = 回放 L1。
        r.shell.play.unlockAcrossArc(2);
        const stars = r.shell.play.starsByLevelRaw as number[];
        stars[0] = 3;
        stars[1] = 2;
        r.shell.play.goToLevel(0);
        expect(r.shell.play.maxUnlockedLevel).toBe(3);
        expect(r.shell.play.levelIndex).toBe(0);
        expect(viewOf(r.shell).currentLevelIndex, '应高亮第三关（0-based 2）').toBe(2);
    });

    it('解锁范围内全有星 ⇒ 回落最高解锁关（全通态不灭高亮）', () => {
        const r = rig({ initialScreen: 'menu' });
        r.shell.play.unlockAcrossArc(1); // 解锁 2 关
        const stars = r.shell.play.starsByLevelRaw as number[];
        stars[0] = 3;
        stars[1] = 1;
        expect(viewOf(r.shell).currentLevelIndex, '全有星 ⇒ 回落前沿 = 第 2 关（0-based 1）').toBe(1);
    });

    it('`[WXG-T-913]` 主界面走马灯陈列关同口径：展示推到的 0 星关（L3），木牌关名仍取大关名', () => {
        const r = rig({ initialScreen: 'menu' });
        r.shell.play.unlockAcrossArc(2);
        const stars = r.shell.play.starsByLevelRaw as number[];
        stars[0] = 3;
        stars[1] = 2;
        const v = viewOf(r.shell);
        expect(v.carouselLevel?.id, '陈列关 = 曼陀罗第 3 关').toBe(3);
        expect(v.carouselTitle, '木牌关名 = 大关名').toBe('曼陀罗');
        expect(v.carouselSeqLabel, '有在推的关 ⇒ 第二行仍走关序').toBeUndefined();
    });

    it('`[WXG-T-914]` 本章全通（无在推的关）⇒ 木牌第二行「已通关」', () => {
        const r = rig({ initialScreen: 'menu' });
        r.shell.play.unlockAcrossArc(8); // 解锁 9 关
        const stars = r.shell.play.starsByLevelRaw as number[];
        for (let i = 0; i < 9; i += 1) stars[i] = 1;
        const v = viewOf(r.shell);
        expect(v.carouselLevel?.id, '陈列回落 boss').toBe(9);
        expect(v.carouselSeqLabel, '全通 ⇒ 状态词' ).toBe('已通关');
    });

    it('`[WXG-T-914]` 未解锁章（走马灯停在该页）⇒ 木牌第二行「未开启」', () => {
        const r = rig({ initialScreen: 'menu' });
        // 停到未解锁的第 2 章页（peer 只在拖动中出现，故直接 seek 主车）。
        (r.shell as unknown as { _menu: { seek(n: number): void } })._menu.seek(1);
        const v = viewOf(r.shell);
        expect(v.carouselSeqLabel, '未解锁章 ⇒ 状态词').toBe('未开启');
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

// ══════════════════════════════════ WXG-T-363 装扮馆（ux-spec v1.25 §3.8）

describe('BeadsShell — 装扮馆 skins 弹窗：入口 · 卡区 · 买断闭环 · 拥有态门', () => {
    const SECOND = registeredSkins()[1]!; // 未买断腿靠它（价目已在册）
    const SECOND_PRICE = SKIN_PRICES_COINS[SECOND.id]!;

    /** 入口只有一条腿：顶栏中档（**WXG-T-365** · 提案 P4-甲；原公告预留位升格）。 */
    function openSkins(r: Rig): void {
        const entry = centerOf('none', 'open-skins');
        expect(r.shell.tapMeta(entry.x, entry.y)).toBe(true);
        expect(r.shell.overlay).toBe('skins');
    }

    const cards = () => metaLayout('skins').buttons.filter((b) => b.id === 'skin-tap');

    function textsOf(r: Rig): string[] {
        const b = new RenderModelBuilder(750, 1334);
        b.begin();
        r.shell.buildRenderModel(b);
        return b
            .end()
            .commands.filter((c) => c.kind === 'text')
            .map((c) => (c as { text: string }).text);
    }

    it('入口 = 左侧第二枚（WXG-T-486 自顶栏 x560 改挂）· 返回回主菜单（单层）· 发 meta:overlay', () => {
        const r = rig({ initialScreen: 'menu' });
        // 钉**具体数**（假绿守卫判例 K-089 同族）：四颗左缘 x = `MENU_TOPBAR_X`{14,14,648,648}，
        // 热区 88 ⇒ 中心 x = {58,58,692,692}；同一行 y（两颗之间不得漏注册 / 不得互叠）。
        const top = (['open-settings', 'open-skins', 'open-signin'] as const).map((id) => centerOf('none', id));
        // `WXG-T-486`（用户 2026-10-28 裁「右侧按钮可以放到左侧第二个布局」）：skins 自 `x560`
        // 改挂**左侧第二枚** ⇒ 前两枚同列（中心 x 58），skins 比 settings 低一行 =
        // `MENU_TOPBAR_ROW2_DY`（88）；mail 仍在右上第一行（692）。
        // ⚠ 原断言「三颗同一行、pitch 88」（`[68,604,692]` + y 全等）随该裁定作废 —— 保留本注释
        // 以便后人知道 `[68,604,692]` 是历史值而非笔误。
        // `WXG-T-487` 再裁「左上右上各两枚」⇒ 左列 `settings`+`rank`（x14 ⇒ 中心 58）、
        // 右列 `mail`+`skins`（x648 ⇒ 中心 692）。此处三枚 = settings / skins / mail ⇒ `[58,692,692]`。
        // `[WXG-T-498]` 左列 24 → 14 做左右对称（两侧热区距屏边 14、视觉圆距屏边 18）。
        expect(top.map((c) => Math.round(c.x))).toEqual([58, 692, 692]);
        expect(Math.round(top[0].y - top[1].y)).toBe(88);
        expect(Math.round(top[2].y)).toBe(Math.round(top[0].y));
        // 画法腿：中颗现在画的是**正常态圆**（⛔ 旧禁用态 α0.5 空圆残影）⇒ 命令流里该列 x 只有
        // 1 枚圆且不带 alpha（`MENU_TOPBAR_RESERVED_ALPHA` 已随预留位退场）。
        const mb = new RenderModelBuilder(750, 1334);
        mb.begin();
        r.shell.buildRenderModel(mb);
        // `WXG-T-486` 后 skins 与 settings 同列（中心 x 58，y 相差一行）⇒ 该列应有 2 枚圆，
        // 且**都不得带 alpha**（原意 = 不得留旧禁用态 α0.5 空圆残影，`MENU_TOPBAR_RESERVED_ALPHA`
        // 已随预留位退场）。历史值 `x-604`（= 旧中档 560+44）随改挂作废。
        const col = mb.end()
            .commands
            .filter((c) => c.kind === 'circle')
            .map((c) => c as unknown as { x: number; alpha?: number })
            .filter((c) => Math.abs(c.x - 58) < 0.5);
        expect(col.length).toBeGreaterThanOrEqual(2);
        expect(col.every((c) => c.alpha === undefined)).toBe(true);
        openSkins(r);
        expect(r.overlayEvents.some((e) => e.open && e.name === 'skins')).toBe(true);
        const back = centerOf('skins', 'back');
        r.shell.tapMeta(back.x, back.y);
        expect(r.shell.overlay).toBe('none'); // 顶栏入口 = 单层 ⇒ 返回直接回主菜单
    });

    it('卡区：槽序 = 注册序 · 列几何走 SKIN_CARD_GRID（⛔ 第二套列宽）', () => {
        const cs = cards();
        expect(cs.map((b) => b.slot)).toEqual(registeredSkins().map((_, i) => i));
        // `[WXG-T-935]` 设置已换 581 宽木牌 ⇒ 两页底板宽度不同、列宽按各自 plate 套同一公式；
        // 2026-11-14：卡区列几何改走 `SKIN_CARD_GRID`（设置页已单列，不再共享列宽）。
        const expectedColW =
            (overlayPlate().w - SKIN_CARD_GRID.sideInset * 2 - SKIN_CARD_GRID.colGap * (SKIN_CARD_GRID.cols - 1))
            / SKIN_CARD_GRID.cols;
        expect(cs[0]!.box.w).toBe(expectedColW);
        expect(overlayPlate().w).toBe(600);
        expect(cs[0]!.box.h).toBe(SKINS_CARD_H);
        // 钉**具体数**（⛔ 只比常量名）：`tuning::SKINS_CARD_H/TOP_INSET` 漏定义时 `undefined === undefined`
        // 会假绿，而 NaN 盒子的唯一症状是「热区永远打不中」（WXG-T-363 实测踩过）。
        // 卡带 = y∈[645,945]：上缘 = 底板顶 1027 − `SKINS_CARD_TOP_INSET` 82 ⇒ 距标题下缘 957 净空 12。
        expect(cs[0]!.box.y).toBe(645);
        expect(cs[0]!.box.y + cs[0]!.box.h).toBe(945);
        expect(cs[1]!.box.x).toBeGreaterThan(cs[0]!.box.x + cs[0]!.box.w); // 左右同排分居
        expect(cs[1]!.box.y).toBe(cs[0]!.box.y); // 当前只容一行
    });

    it('未买断卡的态文案走文案通道：「穿戴中」/「解锁 {价}」并存 · 零红点', () => {
        const r = rig({ initialScreen: 'menu', seedMeta: { coins: 0 } });
        openSkins(r);
        const texts = textsOf(r);
        expect(texts).toContain('装扮馆');
        expect(texts).toContain('穿戴中'); // 默认肤 = 已拥有 + 当前穿戴
        expect(texts).toContain(`解锁 ${SECOND_PRICE}`);
        expect(texts).not.toContain('点击穿戴');
    });

    it('点未拥有卡 = 先买后穿（同腿闭环）；余额不足 ⇒ 零扣款零入档零穿戴', () => {
        const rich = rig({ initialScreen: 'menu', seedMeta: { coins: SECOND_PRICE + 50 } });
        openSkins(rich);
        const p = centerOf('skins', 'skin-tap', 1);
        expect(rich.shell.tapMeta(p.x, p.y)).toBe(true);
        expect(rich.shell.play.skinId).toBe(SECOND.id);
        expect(rich.shell.meta!.coins).toBe(50);
        expect(rich.shell.meta!.ownsSkin(SECOND.id)).toBe(true);
        expect(textsOf(rich)).toContain('穿戴中'); // 买断后同位改写态

        const poor = rig({ initialScreen: 'menu', seedMeta: { coins: SECOND_PRICE - 1 } });
        openSkins(poor);
        const metaBefore = poor.storage.get(META_KEY);
        expect(poor.shell.tapMeta(p.x, p.y)).toBe(false);
        expect(poor.shell.play.skinId).toBe(DEFAULT_SKIN_ID);
        expect(poor.shell.meta!.coins).toBe(SECOND_PRICE - 1);
        expect(poor.shell.meta!.ownsSkin(SECOND.id)).toBe(false);
        expect(poor.storage.get(META_KEY)).toBe(metaBefore); // 零扣款 ⇒ 零写档
    });

    it('点已拥有且在穿的卡 = 恒等零写档', () => {
        const r = rig({ initialScreen: 'menu' });
        openSkins(r);
        const playBefore = r.storage.get(PLAY_KEY);
        const p = centerOf('skins', 'skin-tap', 0);
        expect(r.shell.tapMeta(p.x, p.y)).toBe(true);
        expect(r.shell.play.skinId).toBe(DEFAULT_SKIN_ID);
        expect(r.storage.get(PLAY_KEY)).toBe(playBefore);
    });

    it('拥有态门：暂停面板换肤循环跳未买断肤（⛔ 白嫖腿）· 已拥有两枚才循环', () => {
        const poor = rig({ initialScreen: 'play', seedMeta: { coins: 0 } });
        poor.shell.play.applySettingsAction('cycle-skin');
        expect(poor.shell.play.skinId).toBe(DEFAULT_SKIN_ID); // 仅一枚已拥有 ⇒ 零副作用

        // 阳性对照（K-060）：观测窗非空 ⇒ 同上注入两枚已拥有 ⇒ 循环到第二肤。
        const rich = rig({
            initialScreen: 'play',
            seedMeta: { ownedSkinIds: [DEFAULT_SKIN_ID, SECOND.id] },
        });
        rich.shell.play.applySettingsAction('cycle-skin');
        expect(rich.shell.play.skinId).toBe(SECOND.id);
    });
});
