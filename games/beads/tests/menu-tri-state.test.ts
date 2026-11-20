/**
 * `[2026-11-20]` 主菜单走马灯三态：boss 关**珠面缩略**的灰度档 + 珠圈框 / 锁图占位。
 *
 * 口径沿革：
 *  - `[WXG-T-566]` 曾是「大关位图」三态：推关 = 竖向揭彩（`grayWipe`）、通关 = 全彩、
 *    `[WXG-T-916]` 未开启 = 锁图占位。2026-11-20 用户令「主界面的 boss 关图案已经取消
 *    纹理展示，而是用 boss 关珠面缩略图展示」⇒ 位图腿（含揭彩 / 磨砂档）整条退场（K-053 留档）。
 *  - 现口径：推关 = `beadGrayInksFor` **整体置灰**；通关 / 满星 = `beadInksFor` 全彩；
 *    满星另画珠圈装裱框（`[WXG-T-579]`）；未开启 = 锁图占位（不画珠面）。
 *
 * 判档口径 = `_arcState`（首关已解锁未通关仍属推关，此时星数可为 0）⇒ 灰度档与木牌读数互不推导。
 */

import { describe, expect, it, afterEach } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaView, setMenuBitmapResolver, type MetaViewData } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE, beadGrayInksFor, beadInksFor, endpointOf } from '../src/view/palette.js';
import { levelThumbFullCells } from '../src/view/menu-signage.js';
import { LEVELS } from '../src/config/levels.js';
import { DESIGN_H, DESIGN_W, MENU_TEXTURES } from '../src/config/tuning.js';

/** 大关① boss = L9；大关② boss = L11（`ARCS[*].levelRefs` 末关）。 */
const BOSS_A = LEVELS[8]!;
const BOSS_B = LEVELS[10]!;

/** 珠面 B0 底块填色（`drawTargetTile` 矢量臂 = 端点 `edge`）⇒ 全彩 / 置灰判据。 */
function tileFill(lv: typeof BOSS_A, gray: boolean): string {
    const inks = gray ? beadGrayInksFor(lv) : beadInksFor(lv);
    return endpointOf(inks, levelThumbFullCells(lv)[2]!).edge;
}
const COLOR_A = tileFill(BOSS_A, false);
const GRAY_A = tileFill(BOSS_A, true);
const GRAY_B = tileFill(BOSS_B, true);

const data = (extra: Partial<MetaViewData> = {}): MetaViewData => ({
    stamina: 5, staminaMax: 5, coins: 0, overlay: 'none', signinDay: 0, canClaim: false,
    bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true,
    debugInfo: false, debugGuides: false, beadStyle: 'facet-4', beadSize: 'full', skinId: 'tokens',
    levelCount: LEVELS.length, currentLevelIndex: 0, maxUnlockedLevel: 1,
    starsByLevel: [], wallSlots: [], wallLevels: [],
    carouselLevel: LEVELS[0], carouselState: 'pushing',
    carouselArtLevel: BOSS_A,
    ...extra,
});

const frame = (d: MetaViewData): readonly DrawCommand[] => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaView(b, d, DEFAULT_PALETTE);
    return b.end().commands;
};

const hasFill = (cmds: readonly DrawCommand[], fill: string): boolean =>
    cmds.some((c) => c.kind === 'rect' && (c as { fill?: string }).fill === fill);
/** 首格颜色的格数：两关共用同一色板 ⇒ 区分「画的是哪一关」只能按格数（L9 = 53 / L11 = 512）。 */
const firstColorCount = (lv: typeof BOSS_A): number => {
    const cells = levelThumbFullCells(lv);
    const idx = cells[2]!;
    let n = 0;
    for (let i = 2; i < cells.length; i += 3) if (cells[i] === idx) n += 1;
    return n;
};
const tileCount = (cmds: readonly DrawCommand[], fill: string): number =>
    cmds.filter((c) => c.kind === 'rect' && (c as { fill?: string }).fill === fill).length;

const blitIds = (cmds: readonly DrawCommand[]): string[] =>
    cmds.filter((c) => c.kind === 'blit').map((c) => (c as { textureId: string }).textureId);

const caseLight = (cmds: readonly DrawCommand[]): number[] =>
    cmds.filter((c) => c.kind === 'circle' && c.fill === DEFAULT_PALETTE.woodText)
        .map((c) => (c as { alpha?: number }).alpha ?? 1);

afterEach(() => setMenuBitmapResolver());

describe('`[2026-11-20]` 珠面三态', () => {
    it('推关 ⇒ 整盘置灰（不露全彩）', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({ carouselState: 'pushing' }));
        expect(hasFill(cmds, GRAY_A), '推关 = 置灰珠面').toBe(true);
        expect(hasFill(cmds, COLOR_A), '推关不露全彩').toBe(false);
        expect(blitIds(cmds), '推关不画锁形').not.toContain(MENU_TEXTURES.lock);
    });

    it('通关 ⇒ 全彩珠面（无珠圈框）', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({ carouselState: 'cleared' }));
        expect(hasFill(cmds, COLOR_A), '通关 = 全彩珠面').toBe(true);
        expect(hasFill(cmds, GRAY_A), '通关不画灰珠').toBe(false);
        expect(blitIds(cmds), '通关不画锁形').not.toContain(MENU_TEXTURES.lock);
        expect(blitIds(cmds), '未满星不画珠圈框').not.toContain(MENU_TEXTURES.arcRing);
    });

    // `[WXG-T-579]` 满星 = 第四条状态：全彩 + 珠圈装裱框。
    it('全满星 ⇒ 全彩 + 珠圈框', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({ carouselState: 'fullstar' }));
        expect(hasFill(cmds, COLOR_A), '满星也是全彩').toBe(true);
        expect(blitIds(cmds), '满星画珠圈框').toContain(MENU_TEXTURES.arcRing);
        expect(blitIds(cmds), '满星不画锁形').not.toContain(MENU_TEXTURES.lock);
    });

    // `[WXG-T-916]` 未开启 = 锁图占位（用户 2026-11-12 裁，参考选关锁格）：
    // 珠面不画，锁形成为橱窗唯一主体；旧「磨砂 + 半透明灰」腿已退场。
    it('`[WXG-T-916]` 未开启：不画珠面，橱窗只留锁形', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({ carouselState: 'locked' }));
        expect(hasFill(cmds, COLOR_A) || hasFill(cmds, GRAY_A), '未开启不画珠面').toBe(false);
        const locks = cmds.filter((c) => c.kind === 'blit' && c.textureId === MENU_TEXTURES.lock);
        expect(locks, '锁图 = 橱窗唯一主体').toHaveLength(1);
        expect((locks[0] as { fx?: unknown }).fx, '锁图不做磨砂/灰度').toBeUndefined();
        expect(blitIds(cmds), '未开启不画珠圈框').not.toContain(MENU_TEXTURES.arcRing);
    });

    it('对页按自己的展品与状态置灰（⛔ 不借用主车）', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({
            carouselState: 'cleared',
            carouselPeer: LEVELS[1], carouselPeerState: 'pushing',
            carouselPeerArtLevel: BOSS_B,
            carouselT: 0.5, carouselDx: -100, carouselPeerSign: 1,
        }));
        // 主车 = 大关① boss 全彩；对页 = 大关② boss 自己的灰档。
        // 两关共用同一色板 ⇒ 按目标色格数区分关本体（⛔ 只靠颜色存在性会误判）。
        expect(tileCount(cmds, COLOR_A), '主车 = 大关① boss 全彩（首色 53 格）').toBe(firstColorCount(BOSS_A));
        expect(tileCount(cmds, GRAY_B), '对页 = 大关② boss 自身灰档（首色 512 格）').toBe(firstColorCount(BOSS_B));
    });

    // `[WXG-T-585]` 2026-11-07 切生产：v2 背板已烘「射灯 + 玻璃」，程序化光锥整批退场
    // （`drawCaseLight` 只在 v1 腿调用）⇒ ⛔ 不可再叠光锥（灯下再压亮斑）。
    it('柜灯由背板烘焙 ⇒ 程序化光锥零枚（三态皆然）', () => {
        setMenuBitmapResolver(() => true);
        for (const state of ['pushing', 'cleared', 'fullstar'] as const) {
            expect(caseLight(frame(data({ carouselState: state }))), `${state} 零光锥`).toEqual([]);
        }
    });
});
