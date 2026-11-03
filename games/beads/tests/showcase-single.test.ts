/**
 * `[WXG-T-522]` 橱窗：内景烘进窗框 + 单一作品 + 独立翻页钮。
 *
 * 判据真源：`games/beads/src/config/tuning/menu.ts` 的 `MENU_CASE_INTERIOR_BAKED` / `MENU_SHOWCASE_ART`
 * 与 `drawMenuAnchored` 的注释（窗框就绪 ⇒ 单一作品腿：无层板/无中央沙漏；缺图 ⇒ 旧双腿逐字不变）。
 */

import { describe, it, expect, afterEach } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaView, type MetaViewData } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { setMenuBitmapResolver } from '../src/view/meta-widgets.js';
import { LEVELS } from '../src/config/levels.js';
import {
    DESIGN_H,
    DESIGN_W,
    MENU_BOSS_ART_D,
    MENU_FROST,
    MENU_SHOWCASE_ART,
    MENU_TEXTURES,
} from '../src/config/tuning.js';

const BOSS_ART = 'bitmap__boss_l9';

const data = (extra: Partial<MetaViewData> = {}): MetaViewData => Object.freeze({
    stamina: 5, staminaMax: 5, coins: 0,
    overlay: 'none' as const,
    signinDay: 0, canClaim: false,
    bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false,
    vibrate: true, debugInfo: false, debugGuides: false,
    beadStyle: 'facet-4', beadSize: 'full' as const, skinId: 'tokens',
    levelCount: LEVELS.length,
    currentLevelIndex: 0,
    maxUnlockedLevel: LEVELS.length,
    starsByLevel: [],
    wallSlots: [],
    wallLevels: [],
    carouselLevel: LEVELS[0],
    carouselState: 'cleared' as const,
    carouselTextureId: BOSS_ART,
    ...extra,
}) as MetaViewData;

const hostWith = (...ids: readonly string[]): void => {
    const allow = new Set(ids);
    setMenuBitmapResolver((id) => allow.has(id));
};

const frame = (d: MetaViewData): readonly DrawCommand[] => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaView(b, d, DEFAULT_PALETTE);
    return b.end().commands;
};

const blitsOf = (cmds: readonly DrawCommand[], id: string): readonly { x: number; y: number; w: number; h: number }[] =>
    cmds.filter((c) => c.kind === 'blit' && (c as { textureId: string }).textureId === id) as never;

afterEach(() => {
    setMenuBitmapResolver(undefined);
});

describe('WXG-T-522 橱窗单一作品', () => {
    it('缺窗框位图：走旧腿（作品按 MENU_BOSS_ART_D=540 绘制，层板/光锥由代码画）', () => {
        hostWith(BOSS_ART);
        const art = blitsOf(frame(data()), BOSS_ART);
        expect(art.length).toBe(1);
        expect(art[0]!.w).toBe(MENU_BOSS_ART_D);
    });

    it('窗框就绪（内景已烘）：作品改按 MENU_SHOWCASE_ART=340 绘制', () => {
        hostWith(MENU_TEXTURES.caseFrame, BOSS_ART);
        const art = blitsOf(frame(data()), BOSS_ART);
        expect(art.length).toBe(1);
        expect(art[0]!.w).toBe(MENU_SHOWCASE_ART.d);
        expect(art[0]!.h).toBe(MENU_SHOWCASE_ART.d);
    });

    it('`[WXG-T-566]` 通关页：状态标记全退场，作品全彩（不传 fx）', () => {
        hostWith(MENU_TEXTURES.caseFrame, BOSS_ART, MENU_TEXTURES.sealCleared,
            MENU_TEXTURES.badgeProgress, MENU_TEXTURES.badgeLocked);
        const cmds = frame(data());
        const art = blitsOf(cmds, BOSS_ART)[0] as { fx?: Record<string, number> };
        expect(art.fx, '通关 = 全彩').toBeUndefined();
        expect(blitsOf(cmds, MENU_TEXTURES.sealCleared).length, '通关飘带退场').toBe(0);
        expect(blitsOf(cmds, MENU_TEXTURES.badgeProgress).length, '中央沙漏退场').toBe(0);
        expect(blitsOf(cmds, MENU_TEXTURES.badgeLocked).length, '右上小锁退场').toBe(0);
    });

    it('`[WXG-T-566 / WXG-T-567]` 锁定态：磨砂玻璃+半透明灰叠加管线（fx={frost,gray}），锁形独立 Sprite，不画旧沙漏', () => {
        hostWith(MENU_TEXTURES.caseFrame, BOSS_ART, MENU_TEXTURES.badgeLocked, MENU_TEXTURES.badgeProgress);
        const cmds = frame(data({ carouselState: 'locked' as const }));
        const art = blitsOf(cmds, BOSS_ART)[0] as { fx?: Record<string, number> };
        expect(art.fx, '锁定 = 磨砂玻璃 + 半透明灰叠加管线').toEqual({ frost: MENU_FROST.radius, gray: MENU_FROST.gray });
        // WXG-T-567 新增：locked 态画独立锁形 Sprite（与 frost+gray 合成纹理解耦）
        expect(blitsOf(cmds, MENU_TEXTURES.badgeLocked).length, '独立锁形 Sprite').toBe(1);
        expect(blitsOf(cmds, MENU_TEXTURES.badgeProgress).length, '旧沙漏退场').toBe(0);
    });

    it('翻页钮无整枚位图（已删 ui_btn_arrow_left/right）：回退旧圆钮底 + 矢量箭头图标', () => {
        hostWith(MENU_TEXTURES.caseFrame, BOSS_ART, MENU_TEXTURES.btnArrow, MENU_TEXTURES.iconArrowLeft, MENU_TEXTURES.iconArrowRight);
        const cmds = frame(data());
        expect(blitsOf(cmds, MENU_TEXTURES.btnArrow).length, '圆钮底两枚').toBe(2);
        expect(blitsOf(cmds, MENU_TEXTURES.iconArrowLeft).length, '左向标').toBe(1);
        expect(blitsOf(cmds, MENU_TEXTURES.iconArrowRight).length, '右向标').toBe(1);
    });
});
