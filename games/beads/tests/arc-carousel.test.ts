/**
 * EP13-S4 · 走马灯按大关翻页 + 橱窗三态由大关集合派生（C-2 ③⑤⑥；Q16/Q17 = 甲）。
 *
 * 判据真源（逐字引用，⛔ 不新增数值）：
 *  - `arc-level-select-spec.md §4-R13`：空橱窗页 tap 图位 = **零事件**（该页无大关实体、无 `levelRefs` 可列）；
 *  - `§4-R11`：◀▶ 只存在于菜单锚定档热区表，本页（levels）无翻页输入 ⇒ 换大关必 `back`；
 *  - `§3` 多大关版呈现（WXG-T-341 v1.21 前为「单大关版 `ARC_OPEN_MAX = 1`」）：页数恒 = `ARC_OPEN_MAX + 1`
 *    ⇒ 前 `ARC_OPEN_MAX` 页 = 实体大关页，末页 = 空橱窗（⇒ 本文件按表驱动翻页，⛔ 不写死页数）。
 *  - `§8.2 TODO-6`（已裁 = 甲）：三态**由大关集合归约**（任一关推关中 pushing / 全通关 cleared /
 *    一关未开 locked），只换数据源；
 *  - `§5` 翻页行：吸附 `MENU_CAROUSEL.snapMs` 180、`reduceMotion` 交叉淡变（视图既有腿，零新数值）。
 *
 * 反例臂（S4 前先红）：
 *  ① 空橱窗页点图会进 `levels` overlay（S2 的已知过渡态，R13 收口于此）；
 *  ② 走马灯代表图/状态取自「关」陈列序（`_fillCarousel` 语义混装）⇒ 视图自由 `carouselArtLevel`
 *     注入时仍画常量图 ⇒ 按大关取图未成立。
 *
 * `[2026-11-20]` 用户令改裁：橱窗展品 = **大关收尾关（boss）的珠面缩略**（`drawBeadFace`），
 * 大关纹理位图腿退场 ⇒ 本文件「代表图」判据改珠面 B0 底块填色（全彩 / 置灰）。
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
// 星账夹具助手（轴从 `LEVELS` 派生，⛔ 手抄 token；K-152）。
import { starsLedger } from './helpers.js';
import { DESIGN_H, DESIGN_W, MENU_TEXTURES, STAR_MAX, WALL_ROWS } from '../src/config/tuning.js';
import { buildMetaView, metaLayout, setMenuBitmapResolver, type MetaViewData } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE, beadGrayInksFor, beadInksFor, endpointOf } from '../src/view/palette.js';
import { levelThumbFullCells } from '../src/view/menu-signage.js';

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
            // WXG-T-344（ADR-0034 DEC-1）：档内星账 = 身份→星（从关表派生轴），
            // ⛔ 位置型 `starsByLevel`（那只是一次性入口的输入侧）。
            starsByUid: starsLedger(opts.stars ?? [], LEVELS),
        }),
    );
    storage.set(META_KEY, JSON.stringify({ ...defaultBeadsMeta(), staminaCur: 8 }));
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

/** 大关① / ② 的 boss 关（`levelRefs` 末关）= 橱窗珠面缩略素材。 */
const BOSS_A = LEVELS[8]!;
const BOSS_B = LEVELS[10]!;
/** 珠面 B0 底块填色（`drawTargetTile` 矢量臂 = 端点 `edge`）⇒ 全彩 / 置灰判据。 */
function tileFill(lv: typeof BOSS_A, gray: boolean): string {
    const inks = gray ? beadGrayInksFor(lv) : beadInksFor(lv);
    return endpointOf(inks, levelThumbFullCells(lv)[2]!).edge;
}
const COLOR_A = tileFill(BOSS_A, false);
const GRAY_A = tileFill(BOSS_A, true);
const COLOR_B = tileFill(BOSS_B, false);
const GRAY_B = tileFill(BOSS_B, true);

function hasFill(cmds: readonly DrawCommand[], fill: string): boolean {
    return cmds.some((c) => c.kind === 'rect' && (c as { fill?: string }).fill === fill);
}

/** 首格颜色的格数（两关共用同一色板 ⇒ 区分「画的是哪一关」只能按格数：L9 = 53 / L11 = 512）。 */
function firstColorCount(lv: typeof BOSS_A): number {
    const cells = levelThumbFullCells(lv);
    const idx = cells[2]!;
    let n = 0;
    for (let i = 2; i < cells.length; i += 3) if (cells[i] === idx) n += 1;
    return n;
}
function tileCount(cmds: readonly DrawCommand[], fill: string): number {
    return cmds.filter((c) => c.kind === 'rect' && (c as { fill?: string }).fill === fill).length;
}

/** 主菜单锚定档热区（与绘制同源；⛔ 不手抄坐标）。 */
function tapButton(shell: BeadsShell, id: string): boolean {
    const btn = metaLayout('none', WALL_ROWS, shell.menuAnchors).buttons.find((b) => b.id === id)!;
    return shell.tapMeta(btn.box.x + btn.box.w / 2, btn.box.y + btn.box.h / 2);
}

/** 合成视图数据（只测视图对 `carouselArtLevel` 的消费，⛔ 不代表生产链路）。 */
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
    it('页数 = ARC_OPEN_MAX 个实体页 + 1 末页空橱窗；翻到头不越界、可翻回', () => {
        setMenuBitmapResolver(() => true);
        const r = rig();
        const first = frameOf(r.shell);
        expect(textsOf(first), '首帧 = 实体大关页').not.toContain(ARC_COMING_SOON);
        // `[2026-11-20]` 展品 = 该大关 boss 关珠面缩略（本 rig 推关中 ⇒ 置灰档）。
        expect(hasFill(first, GRAY_A), '展品 = 大关① boss 珠面（推关置灰）').toBe(true);
        expect(hasFill(first, COLOR_A), '推关不露全彩').toBe(false);
        expect(textsOf(first), '木牌 = 该章 title').toContain(ARCS[0].title);

        // 逐页翻到末页：前 ARC_OPEN_MAX 页 = 实体章（代表图 + 章名逐页换），末页 = 唯一空橱窗。
        for (let i = 1; i <= ARC_OPEN_MAX; i += 1) {
            expect(tapButton(r.shell, 'carousel-next')).toBe(true);
            r.advance(500);
            const f = frameOf(r.shell);
            if (i < ARC_OPEN_MAX) {
                expect(textsOf(f), `第 ${i + 1} 页 = 实体大关页（非空橱窗）`).not.toContain(ARC_COMING_SOON);
                // `[WXG-T-916]` 未开放大关 = 锁图占位：不画珠面展品、橱窗只留锁形
                // （本 rig 只解锁第 1 关 ⇒ 第 2..N 页均未开放；木牌仍印该章 title / 关名）。
                expect(hasFill(f, GRAY_B) || hasFill(f, COLOR_B), '未开放 = 锁图占位（不画珠面）').toBe(false);
                expect(blitIdsOf(f), '锁形占位').toContain(MENU_TEXTURES.lock);
                expect(textsOf(f), '木牌 = 该章 title').toContain(ARCS[i]!.title);
            } else {
                expect(textsOf(f), `末页（第 ${ARC_OPEN_MAX + 1} 页）= 空橱窗，全章 open 也仍在`).toContain(ARC_COMING_SOON);
            }
        }

        // 已到末页：再点 next 不产生第二张空页（offset 不越界）。
        tapButton(r.shell, 'carousel-next');
        r.advance(500);
        expect(textsOf(frameOf(r.shell))).toContain(ARC_COMING_SOON);

        tapButton(r.shell, 'carousel-prev');
        r.advance(500);
        const back = frameOf(r.shell);
        expect(textsOf(back), '空页可翻回实体页').not.toContain(ARC_COMING_SOON);
        // `[WXG-T-916]` 末章未开放 ⇒ 翻回的是实体页、橱窗 = 锁图占位（不再是代表图）。
        expect(blitIdsOf(back), '回到的实体页 = 最后一章（未开放 ⇒ 锁图）').toContain(MENU_TEXTURES.lock);
    });

    it('视图按传入的 `carouselArtLevel` 渲染（非表外硬取首行）', () => {
        setMenuBitmapResolver(() => true);
        const probe = frameOfData(synthetic({ carouselArtLevel: BOSS_B }));
        // 两关共用同一色板 ⇒ 按首格颜色的格数区分（若回落首行只会是 L9 的 53）。
        expect(tileCount(probe, GRAY_B), 'carouselArtLevel 必须被消费（L11 首色 512 格）')
            .toBe(firstColorCount(BOSS_B));
        // 不得靠 `carouselLevel` 冒充展品：给了陈列关、没给 art 字段 ⇒ 只留虚线空槽。
        const none = frameOfData(synthetic());
        expect(tileCount(none, GRAY_B), '无 art 字段不画珠面').toBe(0);
    });
});

describe('EP13-S4 橱窗三态 = 大关集合归约（TODO-6 / Q16 = 甲）', () => {
    it('任一关可进未通 ⇒ pushing（boss 珠面整体置灰）', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frameOf(rig({ maxUnlocked: 1 }).shell);
        const ids = blitIdsOf(cmds);
        // `[2026-11-20]` 三态只由珠面灰度 + 珠圈框 / 锁形表达，状态标记全部退场。
        expect(hasFill(cmds, GRAY_A), '推关 = 置灰珠面').toBe(true);
        expect(hasFill(cmds, COLOR_A), '推关不露全彩').toBe(false);
        expect(ids).not.toContain(MENU_TEXTURES.lock);
    });

    it('全通关但未满星 ⇒ cleared（全彩珠面，无珠圈框）', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frameOf(rig({ maxUnlocked: LEVELS.length, stars: LEVELS.map(() => 1) }).shell);
        const ids = blitIdsOf(cmds);
        expect(hasFill(cmds, COLOR_A), '通关 = 全彩珠面').toBe(true);
        expect(hasFill(cmds, GRAY_A), '通关不画灰珠').toBe(false);
        expect(ids).not.toContain(MENU_TEXTURES.lock);
        expect(ids, '未满星不画珠圈框').not.toContain(MENU_TEXTURES.arcRing);
    });

    // `[WXG-T-579]` 全满星 = 第四条状态：全彩 + 珠圈装裱框。
    it('全满星 ⇒ fullstar（全彩 + 珠圈框居中）', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frameOf(rig({ maxUnlocked: LEVELS.length, stars: LEVELS.map(() => STAR_MAX) }).shell);
        const ids = blitIdsOf(cmds);
        expect(hasFill(cmds, COLOR_A), '满星也是全彩').toBe(true);
        expect(ids, '满星画珠圈框').toContain(MENU_TEXTURES.arcRing);
        expect(ids, '满星不画锁形').not.toContain(MENU_TEXTURES.lock);
    });

    it('locked 在本版不可达（首关恒解锁）⇒ 只登记，不伪造观测', () => {
        // 存档的下标镜像合法域 = [0, n-1]（save-schema.ts::normalizeBeadsSave）⇒「一关未开」
        // 在本池不可构造；归约分支保留给后续大关（其首关可晚于当前解锁进度）。
        expect(defaultBeadsSave().maxUnlockedKey, '出厂无身份指针 ⇒ 归一兜底到首关').toBe('');
    });
});

describe('EP13-S4 R13 · 空橱窗页点图零事件', () => {
    it('空橱窗页 tap 图位：不消费、不切 overlay、零 meta:overlay', () => {
        setMenuBitmapResolver(() => true);
        const r = rig();
        // 末页 = `ARC_OPEN_MAX` 之后那一页 ⇒ 逐页翻到末页（单大关版旧文只翻一次）。
        for (let i = 0; i < ARC_OPEN_MAX; i += 1) {
            tapButton(r.shell, 'carousel-next');
            r.advance(500);
        }
        expect(textsOf(frameOf(r.shell)), '已到空橱窗页').toContain(ARC_COMING_SOON);

        expect(tapButton(r.shell, 'open-levels'), '空页无大关实体 ⇒ 不消费').toBe(false);
        expect(r.shell.overlay).toBe('none');
        expect(r.overlayEvents.length, '零事件（含不发 meta:overlay）').toBe(0);
    });
});
