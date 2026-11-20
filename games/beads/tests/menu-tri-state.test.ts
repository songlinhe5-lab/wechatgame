/**
 * `[2026-11-20 · WXG-T-1006]` 主菜单走马灯展品：**固定样式展示腿**（色板基色填充）+
 * 按大关进度自下而上置灰 + 珠圈框 / 锁图占位。
 *
 * 口径沿革：
 *  - `[WXG-T-566]` 大关位图三态（推关竖向揭彩 / 通关全彩 / 锁图）→ `[WXG-T-916]` 锁图占位；
 *  - `[WXG-T-1006]` 纹理位图腿整体退场；首版珠面腿因「珠子看不清」再改判为用户令：
 *    「用基色填充代替」+「图案按照进度等比例上下设置灰色」（K-053 留档）。
 *
 * 判档口径 = `_arcState`（锁图 / 珠圈）+ `_arcProgress`（0..1，自下而上彩色占比）。
 */

import { describe, expect, it, afterEach } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaView, setMenuBitmapResolver, type MetaViewData } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE, beadFadedInksFor, beadInksFor } from '../src/view/palette.js';
import { levelThumbFullCells } from '../src/view/menu-signage.js';
import { LEVELS } from '../src/config/levels.js';
import { DESIGN_H, DESIGN_W, MENU_TEXTURES } from '../src/config/tuning.js';

/** 大关① boss = L9（30×30）；大关② boss = L11（32×32）。 */
const BOSS_A = LEVELS[8]!;
const BOSS_B = LEVELS[10]!;

/** 基色填充判据（全彩 / 置灰各一枚色集，⛔ 手抄 hex；两关色板可能不完全重合 ⇒ 取并集）。 */
const COLOR_HEXES = new Set([...beadInksFor(BOSS_A).hexes, ...beadInksFor(BOSS_B).hexes]);
const GRAY_HEXES = new Set([...beadFadedInksFor(BOSS_A).hexes, ...beadFadedInksFor(BOSS_B).hexes]);

const cellsOf = (lv: typeof BOSS_A): number => levelThumbFullCells(lv).length / 3;
/** 按进度自下而上的彩色格数（格心 ≤ 底缘 + 总高 × progress）。 */
const coloredCellsOf = (lv: typeof BOSS_A, progress: number): number => {
    const cells = levelThumbFullCells(lv);
    const rows = lv.pattern.length;
    const line = rows - rows * progress - 0.5;
    let n = 0;
    for (let i = 0; i < cells.length; i += 3) if (cells[i]! >= line) n += 1;
    return n;
};

const data = (extra: Partial<MetaViewData> = {}): MetaViewData => ({
    stamina: 5, staminaMax: 5, coins: 0, overlay: 'none', signinDay: 0, canClaim: false,
    bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true,
    debugInfo: false, debugGuides: false, beadStyle: 'facet-4', beadSize: 'full', skinId: 'tokens',
    levelCount: LEVELS.length, currentLevelIndex: 0, maxUnlockedLevel: 1,
    starsByLevel: [], wallSlots: [], wallLevels: [],
    carouselLevel: LEVELS[0], carouselState: 'pushing',
    carouselArtLevel: BOSS_A,
    carouselProgress: 0,
    ...extra,
});

const frame = (d: MetaViewData): readonly DrawCommand[] => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaView(b, d, DEFAULT_PALETTE);
    return b.end().commands;
};

const fillCount = (cmds: readonly DrawCommand[], hexes: ReadonlySet<string>): number =>
    cmds.filter((c) => c.kind === 'rect' && hexes.has((c as { fill?: string }).fill ?? '')).length;

const blitIds = (cmds: readonly DrawCommand[]): string[] =>
    cmds.filter((c) => c.kind === 'blit').map((c) => (c as { textureId: string }).textureId);

const caseLight = (cmds: readonly DrawCommand[]): number[] =>
    cmds.filter((c) => c.kind === 'circle' && c.fill === DEFAULT_PALETTE.woodText)
        .map((c) => (c as { alpha?: number }).alpha ?? 1);

afterEach(() => setMenuBitmapResolver());

describe('`[WXG-T-1006]` 基色展示腿 + 进度置灰', () => {
    it('推关进度 0 ⇒ 整幅置灰（不露全彩）', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({ carouselState: 'pushing', carouselProgress: 0 }));
        expect(fillCount(cmds, GRAY_HEXES), '整幅灰格').toBe(cellsOf(BOSS_A));
        expect(fillCount(cmds, COLOR_HEXES), '不露全彩').toBe(0);
        expect(blitIds(cmds), '推关不画锁形').not.toContain(MENU_TEXTURES.lock);
    });

    it('推关进度 0.5 ⇒ 自下而上恰好一半格全彩，其余置灰', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({ carouselState: 'pushing', carouselProgress: 0.5 }));
        expect(fillCount(cmds, COLOR_HEXES), '彩色格 = 底部 15 行').toBe(coloredCellsOf(BOSS_A, 0.5));
        expect(fillCount(cmds, GRAY_HEXES), '其余 = 灰格').toBe(cellsOf(BOSS_A) - coloredCellsOf(BOSS_A, 0.5));
    });

    it('通关（进度 1）⇒ 全彩基色，无灰格、无珠圈框', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({ carouselState: 'cleared', carouselProgress: 1 }));
        expect(fillCount(cmds, COLOR_HEXES), '全彩').toBe(cellsOf(BOSS_A));
        expect(fillCount(cmds, GRAY_HEXES), '无灰格').toBe(0);
        expect(blitIds(cmds), '通关不画锁形').not.toContain(MENU_TEXTURES.lock);
        expect(blitIds(cmds), '未满星不画珠圈框').not.toContain(MENU_TEXTURES.arcRing);
    });

    // `[WXG-T-579]` 满星 = 第四条状态：全彩 + 珠圈装裱框。
    it('全满星 ⇒ 全彩 + 珠圈框', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({ carouselState: 'fullstar', carouselProgress: 1 }));
        expect(fillCount(cmds, COLOR_HEXES), '满星也是全彩').toBe(cellsOf(BOSS_A));
        expect(blitIds(cmds), '满星画珠圈框').toContain(MENU_TEXTURES.arcRing);
        expect(blitIds(cmds), '满星不画锁形').not.toContain(MENU_TEXTURES.lock);
    });

    // `[WXG-T-916]` 未开启 = 锁图占位：不画展品，锁形成为橱窗唯一主体。
    it('`[WXG-T-916]` 未开启：不画展品，橱窗只留锁形', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({ carouselState: 'locked', carouselProgress: 0 }));
        expect(fillCount(cmds, COLOR_HEXES) + fillCount(cmds, GRAY_HEXES), '未开启不画展品').toBe(0);
        const locks = cmds.filter((c) => c.kind === 'blit' && c.textureId === MENU_TEXTURES.lock);
        expect(locks, '锁图 = 橱窗唯一主体').toHaveLength(1);
        expect((locks[0] as { fx?: unknown }).fx, '锁图不做磨砂/灰度').toBeUndefined();
        expect(blitIds(cmds), '未开启不画珠圈框').not.toContain(MENU_TEXTURES.arcRing);
    });

    it('对页按自己的展品与进度置灰（⛔ 不借用主车）', () => {
        setMenuBitmapResolver(() => true);
        const cmds = frame(data({
            carouselState: 'cleared', carouselProgress: 1,
            carouselPeer: LEVELS[1], carouselPeerState: 'pushing',
            carouselPeerArtLevel: BOSS_B, carouselPeerProgress: 0.25,
            carouselT: 0.5, carouselDx: -100, carouselPeerSign: 1,
        }));
        // 两关共用同一色板 ⇒ 色值不可分；按彩色 / 灰色格数分别核对两页之和。
        expect(fillCount(cmds, COLOR_HEXES), '主车全彩 + 对页底部 1/4 彩色')
            .toBe(cellsOf(BOSS_A) + coloredCellsOf(BOSS_B, 0.25));
        expect(fillCount(cmds, GRAY_HEXES), '对页其余 3/4 置灰')
            .toBe(cellsOf(BOSS_B) - coloredCellsOf(BOSS_B, 0.25));
    });

    // `[WXG-T-585]` 2026-11-07 切生产：v2 背板已烘「射灯 + 玻璃」，程序化光锥整批退场
    // （`drawCaseLight` 只在 v1 腿调用）⇒ ⛔ 不可再叠光锥（灯下再压亮斑）。
    it('柜灯由背板烘焙 ⇒ 程序化光锥零枚（三态皆然）', () => {
        setMenuBitmapResolver(() => true);
        for (const state of ['pushing', 'cleared', 'fullstar'] as const) {
            expect(caseLight(frame(data({ carouselState: state, carouselProgress: 1 }))), `${state} 零光锥`).toEqual([]);
        }
    });
});
