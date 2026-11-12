/**
 * `[WXG-T-522]` 橱窗：内景烘进窗框 + 单一作品 + 独立翻页钮。
 *
 * 判据真源：`games/beads/src/config/tuning/menu.ts` 的 `MENU_V2.art` / `MENU_CASE_INTERIOR_BAKED`
 * 与 `drawMenuAnchored` 的注释（v2 背板已烘内景 ⇒ 单一作品腿：无层板/无中央沙漏/无纸卡容器）。
 * ⚠ `[WXG-T-585]` 2026-11-07 切生产后，v1 的 540 / 340 两条尺寸腿已随 v1 版面退场。
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
    MENU_ARC_ART_CONTENT,
    MENU_ARC_ART_SRC,
    MENU_LOCKED_ICON,
    MENU_TEXTURES,
    MENU_V2,
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

/**
 * `[WXG-T-601]` 作品位判据：大图 256² 四周透明留白（底部 45px）⇒ 必须按**内容**等比放大到
 * 铺满「玻璃裁切顶 ↔ 圆台面」这段可用高度，且内容底缘压在台面 ⇒ 图案在橱窗内居中，
 * 同时仍坐在圆台上（⛔ 直接上移会重新悬空）。
 * 旧判据「blit 尺寸恒 = `MENU_V2.art` 325×314」随「连透明边一起铺框」退场（K-053 划线留档）。
 */
const expectArtOnShelf = (cmds: readonly DrawCommand[]): void => {
    const art = blitsOf(cmds, BOSS_ART);
    expect(art.length).toBe(1);
    const shelfY = MENU_V2.art.y + MENU_V2.art.h; // 844 = 圆台台面
    const avail = shelfY - MENU_V2.clip.y;        // 374 = clip 顶 ↔ 台面
    const k = avail / MENU_ARC_ART_CONTENT.h;
    const size = MENU_ARC_ART_SRC * k;
    const bottomInset = MENU_ARC_ART_SRC - MENU_ARC_ART_CONTENT.y - MENU_ARC_ART_CONTENT.h;
    const a = art[0]!;
    expect(a.w).toBe(size);
    expect(a.h).toBe(size);
    const contentBottomYUp = a.y + bottomInset * k;
    // 内容底缘（y-up）= 展品框底 → 坐在圆台上；旧腿会高出 bottomInset*k ≈ 94px
    expect(contentBottomYUp).toBeCloseTo(DESIGN_H - shelfY, 6);
    // 内容顶缘 = 玻璃裁切顶 ⇒ 铺满可用高度（不高不低）
    expect(contentBottomYUp + MENU_ARC_ART_CONTENT.h * k).toBeCloseTo(DESIGN_H - MENU_V2.clip.y, 6);
    // 水平中心 = 展品框中心 374.5（= 橱窗中心 375 差既有半像素，非本批引入）
    expect(a.x + (MENU_ARC_ART_CONTENT.x + MENU_ARC_ART_CONTENT.w / 2) * k)
        .toBeCloseTo(MENU_V2.art.x + MENU_V2.art.w / 2, 6);
    expect(a.x + MENU_ARC_ART_CONTENT.x * k).toBeGreaterThanOrEqual(MENU_V2.clip.x);
    expect(a.x + (MENU_ARC_ART_CONTENT.x + MENU_ARC_ART_CONTENT.w) * k)
        .toBeLessThanOrEqual(MENU_V2.clip.x + MENU_V2.clip.w);
    // 垂直中心 = 「clip 顶 ↔ 台面」中点 657（背板玻璃内框实测中心 652.5，差 4.5px）
    expect(DESIGN_H - (contentBottomYUp + MENU_ARC_ART_CONTENT.h * k / 2))
        .toBeCloseTo((MENU_V2.clip.y + shelfY) / 2, 6);
};

describe('WXG-T-522 橱窗单一作品', () => {
    // `[WXG-T-585]` 2026-11-07 切生产：v2 作品位 = **绝对框** `MENU_V2.art` 325×314，
    // 与「窗框位图就绪与否」解耦（⛔ 不再降级回 v1 的 `MENU_BOSS_ART_D` 540 / `MENU_SHOWCASE_ART` 340 两条腿）。
    it('最差宿主（窗框/背板全缺）：作品仍按 `MENU_V2.art` 落位，图案底缘坐台面', () => {
        hostWith(BOSS_ART);
        expectArtOnShelf(frame(data()));
    });

    it('背板就绪：作品落位同源不变，内景已烘 ⇒ 不再画层板/光锥', () => {
        hostWith(MENU_TEXTURES.backdrop, BOSS_ART);
        expectArtOnShelf(frame(data()));
    });

    it('`[WXG-T-566]` 通关页：状态标记全退场，作品全彩（不传 fx）', () => {
        hostWith(MENU_TEXTURES.backdrop, BOSS_ART, MENU_TEXTURES.lock);
        const cmds = frame(data());
        const art = blitsOf(cmds, BOSS_ART)[0] as { fx?: Record<string, number> };
        expect(art.fx, '通关 = 全彩').toBeUndefined();
        // `[WXG-T-578]` 旧飘带/沙漏两件已出包，只剩锁形负断言。
        expect(blitsOf(cmds, MENU_TEXTURES.lock).length, '右上小锁退场').toBe(0);
    });

    it('`[WXG-T-916]` 未开启态：锁图占位——不画大关图（磨砂/灰度腿退场），橱窗只留锁形', () => {
        hostWith(MENU_TEXTURES.backdrop, BOSS_ART, MENU_TEXTURES.lock);
        const cmds = frame(data({ carouselState: 'locked' as const }));
        expect(blitsOf(cmds, BOSS_ART).length, '未开启不画大关图').toBe(0);
        // `[WXG-T-578]` 锁形改按纹理宽高比出高（192×260 竖长件）⇒ 断言高 = 宽 / aspect。
        const lockBlits = blitsOf(cmds, MENU_TEXTURES.lock);
        expect(lockBlits.length, '锁图 = 橱窗唯一主体').toBe(1);
        const lb = lockBlits[0] as { w: number; h: number; fx?: unknown };
        expect(lb.h).toBeCloseTo(lb.w / MENU_LOCKED_ICON.aspect, 6);
        expect(lb.fx, '锁图不做磨砂/灰度').toBeUndefined();
    });

    // `[WXG-T-587]` v1 的圆底 `btnArrow` / 矢量向标 `iconArrow*` 已**删键出包** ⇒ 本判据只剩正向部分：
    // 有整枚件就画整枚件，且落位 = `MENU_V2.prev/next` 读数。
    it('翻页钮 = 整枚位图（`prevBtn`/`nextBtn`），落位按 `MENU_V2.prev/next`', () => {
        hostWith(MENU_TEXTURES.backdrop, BOSS_ART, MENU_TEXTURES.prevBtn, MENU_TEXTURES.nextBtn);
        const cmds = frame(data());
        const left = blitsOf(cmds, MENU_TEXTURES.prevBtn);
        const right = blitsOf(cmds, MENU_TEXTURES.nextBtn);
        expect(left.length, '左钮 = 整枚位图').toBe(1);
        expect(right.length, '右钮 = 整枚位图').toBe(1);
        expect([left[0]!.w, left[0]!.h]).toEqual([MENU_V2.prev.w, MENU_V2.prev.h]);
        expect([right[0]!.w, right[0]!.h]).toEqual([MENU_V2.next.w, MENU_V2.next.h]);
    });
});
