/**
 * `[WXG-T-522]` 橱窗：内景烘进窗框 + 单一作品 + 独立翻页钮。
 *
 * 判据真源：`games/beads/src/config/tuning/menu.ts` 的 `MENU_V2.art` / `MENU_V2.clip`
 * 与 `drawMenuAnchored` 的注释（v2 背板已烘内景 ⇒ 单一作品腿：无层板/无中央沙漏/无纸卡容器）。
 * `[2026-11-20]` 用户令：主界面 boss 关图案取消纹理展示，改画 **boss 关珠面缩略**
 * （`drawBeadFace`，bottom 锚定台面；纹理腿退场）。
 */

import { describe, it, expect, afterEach } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaView, type MetaViewData } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE, beadGrayInksFor, beadInksFor, endpointOf } from '../src/view/palette.js';
import { levelThumbFullCells } from '../src/view/menu-signage.js';
import { setMenuBitmapResolver } from '../src/view/meta-widgets.js';
import { LEVELS } from '../src/config/levels.js';
import { DESIGN_H, DESIGN_W, MENU_LOCKED_ICON, MENU_TEXTURES, MENU_V2 } from '../src/config/tuning.js';

/** Arc 0 的 boss 关 = L9（30×30 曼陀罗）。 */
const BOSS = LEVELS[8]!;
/** 珠面 B0 底块填色 = 端点 `edge`（取盘面第一个有墨格，⛔ 手抄 hex）。 */
const firstCell = levelThumbFullCells(BOSS);
const CELL_IDX = firstCell[2]!;
const CELL_COLOR = endpointOf(beadInksFor(BOSS), CELL_IDX).edge;
const CELL_GRAY = endpointOf(beadGrayInksFor(BOSS), CELL_IDX).edge;
/** 展品框（y-up）：`MENU_V2.art` 是 top-based。 */
const ART = { x: MENU_V2.art.x, y: DESIGN_H - (MENU_V2.art.y + MENU_V2.art.h), w: MENU_V2.art.w };
/** 玻璃裁切顶（y-up）。 */
const CLIP_TOP = DESIGN_H - MENU_V2.clip.y;
const AVAIL = CLIP_TOP - ART.y;
const PITCH = Math.min(ART.w / BOSS.cols, AVAIL / BOSS.pattern.length);

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
    carouselArtLevel: BOSS,
    carouselState: 'cleared' as const,
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

type Rect = Extract<DrawCommand, { kind: 'rect' }>;

/** 橱窗裁切区内的珠面小格（排除背景/按钮等大块）。 */
const beadRects = (cmds: readonly DrawCommand[]): Rect[] => cmds.filter(
    (c): c is Rect => c.kind === 'rect'
        && typeof c.fill === 'string'
        && /^#[0-9a-f]{6}$/i.test(c.fill)
        && c.w < 60 && c.h < 60
        && c.x + c.w > MENU_V2.clip.x && c.x < MENU_V2.clip.x + MENU_V2.clip.w
        && c.y >= ART.y - 1 && c.y + c.h <= CLIP_TOP + 1,
);

/**
 * `[2026-11-20]` 珠面缩略落位：30×30 宽盘 ⇒ pitch = art.w / cols，水平居中、底缘坐台面；
 * 图案包围盒必须落在展品框宽内且不越过玻璃裁切顶。纹理腿的 256² 透明边判据已退场（K-053 划线）。
 */
const expectBeadOnShelf = (cmds: readonly DrawCommand[]): void => {
    const rects = beadRects(cmds);
    expect(rects.length, '珠面膜 / 底块已画').toBeGreaterThan(100);
    const left = ART.x + (ART.w - BOSS.cols * PITCH) / 2;
    const minX = Math.min(...rects.map((r) => r.x));
    const maxX = Math.max(...rects.map((r) => r.x + r.w));
    const minY = Math.min(...rects.map((r) => r.y));
    const maxY = Math.max(...rects.map((r) => r.y + r.h));
    expect(minX).toBeGreaterThanOrEqual(left - 0.6);
    expect(maxX).toBeLessThanOrEqual(left + BOSS.cols * PITCH + 0.6);
    expect(minY).toBeGreaterThanOrEqual(ART.y - 0.6);
    expect(maxY).toBeLessThanOrEqual(ART.y + BOSS.pattern.length * PITCH + 0.6);
    // 水平中心 = 展品框中心（374.5）；纹理腿的 `MENU_ARC_ART_CONTENT` 偏移判据不再适用。
    expect((minX + maxX) / 2).toBeCloseTo(ART.x + ART.w / 2, 0);
};

afterEach(() => {
    setMenuBitmapResolver(undefined);
});

describe('WXG-T-522 橱窗单一作品', () => {
    it('最差宿主（窗框/背板全缺）：boss 珠面缩略仍按 `MENU_V2.art` 落位，底缘坐台面', () => {
        hostWith();
        const cmds = frame(data());
        expect(blitsOf(cmds, 'bitmap__boss_l9'), '纹理腿退场').toHaveLength(0);
        expectBeadOnShelf(cmds);
    });

    it('背板就绪：珠面落位同源，内景已烘 ⇒ 不再画层板/光锥', () => {
        hostWith(MENU_TEXTURES.backdrop);
        expectBeadOnShelf(frame(data()));
    });

    it('`[2026-11-20]` 通关页：boss 珠面全彩，锁形退场', () => {
        hostWith(MENU_TEXTURES.backdrop, MENU_TEXTURES.lock);
        const cmds = frame(data({ carouselState: 'cleared' as const }));
        expect(beadRects(cmds).some((r) => r.fill === CELL_COLOR), '通关 = 全彩珠面').toBe(true);
        expect(blitsOf(cmds, MENU_TEXTURES.lock).length, '通关不画锁').toBe(0);
    });

    it('`[2026-11-20]` 推关页：boss 珠面整体置灰（不画渐变揭彩）', () => {
        hostWith(MENU_TEXTURES.backdrop);
        const cmds = frame(data({ carouselState: 'pushing' as const }));
        expect(beadRects(cmds).some((r) => r.fill === CELL_GRAY), '推关 = 置灰珠面').toBe(true);
        expect(beadRects(cmds).some((r) => r.fill === CELL_COLOR), '推关不露全彩').toBe(false);
    });

    it('`[WXG-T-916]` 未开启态：锁图占位——不画珠面展品，橱窗只留锁形', () => {
        hostWith(MENU_TEXTURES.backdrop, MENU_TEXTURES.lock);
        const cmds = frame(data({ carouselState: 'locked' as const }));
        expect(beadRects(cmds).length, '未开启不画珠面').toBe(0);
        // `[WXG-T-578]` 锁形改按纹理宽高比出高（192×260 竖长件）⇒ 断言高 = 宽 / aspect。
        const lockBlits = blitsOf(cmds, MENU_TEXTURES.lock);
        expect(lockBlits.length, '锁图 = 橱窗唯一主体').toBe(1);
        const lb = lockBlits[0] as { w: number; h: number; fx?: unknown };
        expect(lb.h).toBeCloseTo(lb.w / MENU_LOCKED_ICON.aspect, 6);
        expect(lb.fx, '锁图不做磨砂/灰度').toBeUndefined();
    });

    it('`[WXG-T-917]` 锁图占位 art 定版：宽 = 作品框宽 × 0.45，锚点 = 玻璃可视区中心', () => {
        hostWith(MENU_TEXTURES.backdrop, MENU_TEXTURES.lock);
        const lock = blitsOf(frame(data({ carouselState: 'locked' as const })), MENU_TEXTURES.lock)[0] as
            { x: number; y: number; w: number; h: number };
        const w = MENU_V2.art.w * MENU_LOCKED_ICON.scale;
        expect(lock.w).toBeCloseTo(w, 6);
        expect(lock.h).toBeCloseTo(w / MENU_LOCKED_ICON.aspect, 6);
        // 锚点 = `clip` 顶 ↔ 台面 的中点（⛔ 不坐台面；与 `drawShowcaseArt` 的 `avail` 同式）。
        expect(lock.x + lock.w / 2).toBeCloseTo(MENU_V2.art.x + MENU_V2.art.w / 2, 6);
        expect(lock.y + lock.h / 2).toBeCloseTo(ART.y + AVAIL / 2, 6);
    });

    // `[WXG-T-587]` v1 的圆底 `btnArrow` / 矢量向标 `iconArrow*` 已**删键出包** ⇒ 本判据只剩正向部分：
    // 有整枚件就画整枚件，且落位 = `MENU_V2.prev/next` 读数。
    it('翻页钮 = 整枚位图（`prevBtn`/`nextBtn`），落位按 `MENU_V2.prev/next`', () => {
        hostWith(MENU_TEXTURES.backdrop, MENU_TEXTURES.prevBtn, MENU_TEXTURES.nextBtn);
        const cmds = frame(data());
        const left = blitsOf(cmds, MENU_TEXTURES.prevBtn);
        const right = blitsOf(cmds, MENU_TEXTURES.nextBtn);
        expect(left.length, '左钮 = 整枚位图').toBe(1);
        expect(right.length, '右钮 = 整枚位图').toBe(1);
        expect([left[0]!.w, left[0]!.h]).toEqual([MENU_V2.prev.w, MENU_V2.prev.h]);
        expect([right[0]!.w, right[0]!.h]).toEqual([MENU_V2.next.w, MENU_V2.next.h]);
    });
});
