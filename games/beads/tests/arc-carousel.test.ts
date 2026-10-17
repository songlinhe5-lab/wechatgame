/**
 * EP13-S4 · 走马灯按大关翻页 + 橱窗三态由大关集合派生（C-2 ③⑤⑥；Q16/Q17 = 甲）。
 *
 * 判据真源（逐字引用，⛔ 不新增数值）：
 *  - `arc-level-select-spec.md §4-R13`：空橱窗页 tap 图位 = **零事件**（该页无大关实体、无 `levelRefs` 可列）；
 *  - `§4-R11`：◀▶ 只存在于菜单锚定档热区表，本页（levels）无翻页输入 ⇒ 换大关必 `back`；
 *  - `§3` 单大关版呈现：`ARC_OPEN_MAX = 1` ⇒ **1 个实体大关页 + 1 个空橱窗页**；
 *  - `§8.2 TODO-6`（已裁 = 甲）：三态**由大关集合归约**（任一关推关中 pushing / 全通关 cleared /
 *    一关未开 locked），只换数据源；
 *  - `§5` 翻页行：吸附 `MENU_CAROUSEL.snapMs` 180、`reduceMotion` 交叉淡变（视图既有腿，零新数值）。
 *
 * 反例臂（S4 前先红）：
 *  ① 空橱窗页点图会进 `levels` overlay（S2 的已知过渡态，R13 收口于此）；
 *  ② 走马灯代表图/状态取自「关」陈列序（`_fillCarousel` 语义混装）⇒ 视图自由 `carouselTextureId`
 *     注入时仍画常量图 ⇒ 按大关取图未成立。
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
    AudioScheduler,
    EventBus,
    InputManager,
    NullAssetProvider,
    NullAudioBackend,
    RenderModelBuilder,
    Viewport,
    createRng,
    type DrawCommand,
    type EventMap,
    type GameServices,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsShell, type BeadsShell } from '../src/game/beads-shell.js';
import { defaultBeadsMeta } from '../src/game/meta-save-schema.js';
import { defaultBeadsSave } from '../src/game/save-schema.js';
import { ARC_COMING_SOON, ARC_OPEN_MAX, ARCS } from '../src/config/arcs.js';
import { LEVELS } from '../src/config/levels.js';
import { DESIGN_H, DESIGN_W, MENU_TEXTURES, WALL_ROWS } from '../src/config/tuning.js';
import { buildMetaView, metaLayout, setMenuBitmapResolver, type MetaViewData } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';

const START = 1_700_000_000_000;
const META_KEY = 'test.ep13s4.meta';
const PLAY_KEY = 'test.ep13s4.play';

interface Rig {
    readonly shell: BeadsShell;
    readonly overlayEvents: unknown[];
    /** 推时钟 + 一帧 shell.update（翻页动画由 update 推进）。 */
    readonly advance: (ms: number) => void;
}

function rig(opts: { maxUnlocked?: number; stars?: number[] } = {}): Rig {
    let now = START;
    const platform = new NodePlatform({ width: DESIGN_W, height: DESIGN_H, pixelRatio: 2 });
    const storage = platform.createStorage();
    storage.set(
        PLAY_KEY,
        JSON.stringify({
            ...defaultBeadsSave(),
            maxUnlockedLevel: opts.maxUnlocked ?? 1,
            starsByLevel: opts.stars ?? [],
        }),
    );
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), staminaCur: 99 }));
    const events = new EventBus<EventMap>();
    const overlayEvents: unknown[] = [];
    (events as unknown as { on: (t: string, cb: (p: unknown) => void) => void }).on('meta:overlay', (p) =>
        overlayEvents.push(p),
    );
    const services: GameServices = {
        events,
        input: new InputManager(),
        audio: new AudioScheduler(new NullAudioBackend()),
        storage,
        rng: createRng('ep13s4-seed'),
        viewport: new Viewport(DESIGN_W, DESIGN_H),
        assets: new NullAssetProvider(),
        platform: platform.info,
        rewardedAd: platform.createRewardedAdProvider(),
    };
    const shell = createBeadsShell({ clock: () => now, metaKey: META_KEY, play: { saveKey: PLAY_KEY } });
    shell.init(services);
    return {
        shell,
        overlayEvents,
        advance: (ms: number): void => {
            now += ms;
            shell.update(0.016);
        },
    };
}

function frameOf(shell: BeadsShell): readonly DrawCommand[] {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    shell.buildRenderModel(builder);
    return builder.end().commands;
}

function textsOf(cmds: readonly DrawCommand[]): string[] {
    return cmds.filter((c) => c.kind === 'text').map((c) => (c as { text: string }).text);
}

function blitIdsOf(cmds: readonly DrawCommand[]): string[] {
    return cmds.filter((c) => c.kind === 'blit').map((c) => (c as { textureId: string }).textureId);
}

/** 主菜单锚定档热区（与绘制同源；⛔ 不手抄坐标）。 */
function tapButton(shell: BeadsShell, id: string): boolean {
    const btn = metaLayout('none', WALL_ROWS, shell.menuAnchors).buttons.find((b) => b.id === id)!;
    return shell.tapMeta(btn.box.x + btn.box.w / 2, btn.box.y + btn.box.h / 2);
}

/** 合成视图数据（只测视图对 `carouselTextureId` 的消费，⛔ 不代表生产链路）。 */
function synthetic(extra: Partial<MetaViewData> = {}): MetaViewData {
    return {
        stamina: 5, staminaMax: 5, coins: 0, overlay: 'none', signinDay: 0, canClaim: false,
        bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true,
        debugInfo: false, debugGuides: false, beadStyle: 'facet-4', beadSize: 'full', skinId: 'tokens',
        levelCount: LEVELS.length, currentLevelIndex: 0, maxUnlockedLevel: 1,
        starsByLevel: [], wallSlots: [], wallLevels: [],
        carouselLevel: LEVELS[LEVELS.length - 1], carouselState: 'pushing',
        ...extra,
    };
}

function frameOfData(data: MetaViewData): readonly DrawCommand[] {
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    buildMetaView(builder, data, DEFAULT_PALETTE);
    return builder.end().commands;
}

afterEach(() => setMenuBitmapResolver());

describe('EP13-S4 走马灯 = 大关集合（页数与代表图）', () => {
    it('单大关版 = 1 实体页 + 1 空橱窗；翻到头不越界、可翻回', () => {
        setMenuBitmapResolver(() => true);
        const r = rig();
        expect(ARC_OPEN_MAX, '本池开放大关数').toBe(1);
        const first = frameOf(r.shell);
        expect(textsOf(first), '首帧 = 实体大关页').not.toContain(ARC_COMING_SOON);
        expect(blitIdsOf(first), '代表图按大关表取').toContain(ARCS[0].textureId);

        expect(tapButton(r.shell, 'carousel-next')).toBe(true);
        r.advance(500);
        expect(textsOf(frameOf(r.shell)), '第 2 页 = 空橱窗').toContain(ARC_COMING_SOON);

        // 已到末页：再点 next 不产生第二张空页（offset 不越界）。
        tapButton(r.shell, 'carousel-next');
        r.advance(500);
        expect(textsOf(frameOf(r.shell))).toContain(ARC_COMING_SOON);

        tapButton(r.shell, 'carousel-prev');
        r.advance(500);
        const back = frameOf(r.shell);
        expect(textsOf(back), '空页可翻回实体页').not.toContain(ARC_COMING_SOON);
        expect(blitIdsOf(back)).toContain(ARCS[0].textureId);
    });

    it('视图按传入的大关图渲染（非表外硬取首行）', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frameOfData(synthetic({ carouselTextureId: 'bitmap__arc_probe' }));
        expect(blitIdsOf(cmds), 'carouselTextureId 必须被消费').toContain('bitmap__arc_probe');
    });
});

describe('EP13-S4 橱窗三态 = 大关集合归约（TODO-6 / Q16 = 甲）', () => {
    it('任一关可进未通 ⇒ pushing', () => {
        setMenuBitmapResolver(() => true);
        const ids = blitIdsOf(frameOf(rig({ maxUnlocked: 1 }).shell));
        expect(ids).toContain(MENU_TEXTURES.badgeProgress);
        expect(ids).not.toContain(MENU_TEXTURES.sealCleared);
    });

    it('全通关 ⇒ cleared（整页盖通关章）', () => {
        setMenuBitmapResolver(() => true);
        const ids = blitIdsOf(frameOf(rig({ maxUnlocked: LEVELS.length, stars: LEVELS.map(() => 3) }).shell));
        expect(ids).toContain(MENU_TEXTURES.sealCleared);
        expect(ids).not.toContain(MENU_TEXTURES.badgeProgress);
    });

    it('locked 在本版不可达（首关恒解锁）⇒ 只登记，不伪造观测', () => {
        // 存档 `maxUnlockedLevel` 合法域 = [1, n]（save-schema.ts::levelIndex）⇒「一关未开」
        // 在本池不可构造；归约分支保留给后续大关（其首关可晚于当前解锁进度）。
        expect(defaultBeadsSave().maxUnlockedLevel).toBe(1);
    });
});

describe('EP13-S4 R13 · 空橱窗页点图零事件', () => {
    it('空橱窗页 tap 图位：不消费、不切 overlay、零 meta:overlay', () => {
        setMenuBitmapResolver(() => true);
        const r = rig();
        tapButton(r.shell, 'carousel-next');
        r.advance(500);
        expect(textsOf(frameOf(r.shell)), '已到空橱窗页').toContain(ARC_COMING_SOON);

        expect(tapButton(r.shell, 'open-levels'), '空页无大关实体 ⇒ 不消费').toBe(false);
        expect(r.shell.overlay).toBe('none');
        expect(r.overlayEvents.length, '零事件（含不发 meta:overlay）').toBe(0);
    });
});
