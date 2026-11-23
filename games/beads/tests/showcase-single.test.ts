/**
 * `[WXG-T-522]` 橱窗：内景烘进窗框 + 单一作品 + 独立翻页钮。
 *
 * 判据真源：`games/beads/src/config/tuning/menu.ts` 的 `MENU_V2.art` / `MENU_V2.clip`
 * 与 `drawMenuAnchored` 的注释（v2 背板已烘内景 ⇒ 单一作品腿：无层板/无中央沙漏/无纸卡容器）。
 * `[2026-11-20 · WXG-T-1006]` 用户令：纹理腿退场后珠面「看不清」，改**固定样式展示腿**
 * （`drawShowcaseFace`：色板基色填充 + 按进度自下而上置灰）。
 */

import { describe, it, expect, afterEach } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaView, type MetaViewData } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE, beadDimInksFor, beadInksFor } from '../src/view/palette.js';
import { levelThumbFullCells } from '../src/view/menu-signage.js';
import { setMenuBitmapResolver } from '../src/view/meta-widgets.js';
import { LEVELS } from '../src/config/levels.js';
import { DESIGN_H, DESIGN_W, MENU_LOCKED_ICON, MENU_SHOWCASE_CELL_SEAM, MENU_TEXTURES, MENU_V2 } from '../src/config/tuning.js';

/** Arc 0 的 boss 关 = L9（30×30 曼陀罗）。 */
const BOSS = LEVELS[8]!;
/** 固定样式展示腿 = 色板**基色**填充（全彩 / 置灰各一枚色集，⛔ 手抄 hex）。 */
const COLOR_HEXES = new Set(beadInksFor(BOSS).hexes);
const GRAY_HEXES = new Set(beadDimInksFor(BOSS).hexes);
const countIn = (rects: readonly Rect[], hexes: ReadonlySet<string>): number =>
    rects.filter((r) => hexes.has(r.fill ?? '')).length;
/** 展品框（y-up）：`MENU_V2.art` 是 top-based。 */
const ART = { x: MENU_V2.art.x, y: DESIGN_H - (MENU_V2.art.y + MENU_V2.art.h), w: MENU_V2.art.w };
/** 玻璃裁切顶（y-up）。 */
const CLIP_TOP = DESIGN_H - MENU_V2.clip.y;
const AVAIL = CLIP_TOP - ART.y;
/** `[WXG-T-1006 五改]` 展示腿按实际绘制区 `avail` 见方落位（⛔ 名义框 `ART.w`）。 */
const PITCH = AVAIL / BOSS.cols;
/** `[WXG-T-1031]` 显示侧裁最外一圈后的有墨包围盒（与 `drawShowcaseFace` 同口径）。 */
const INK = (() => {
    const cells = levelThumbFullCells(BOSS);
    let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
    for (let i = 0; i < cells.length; i += 3) {
        const r = cells[i]!, c = cells[i + 1]!;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
    }
    return { minR: minR + 1, maxR: maxR - 1, minC: minC + 1, maxC: maxC - 1 };
})();
/** 裁圈后实际绘制的格表（`drawShowcaseFace` 只画圈内格）。 */
const SHOWN_CELLS = (() => {
    const cells = levelThumbFullCells(BOSS);
    const out: number[] = [];
    for (let i = 0; i < cells.length; i += 3) {
        const r = cells[i]!, c = cells[i + 1]!;
        if (r >= INK.minR && r <= INK.maxR && c >= INK.minC && c <= INK.maxC) out.push(cells[i]!, cells[i + 1]!, cells[i + 2]!);
    }
    return out;
})();
const CONTENT_W = (INK.maxC - INK.minC + 1) * PITCH;
/** `[八改]` 水平轴 = 玻璃裁切窗中心（150..607 → 378.5），与名义 art 框中心 374.5 差 4px。 */
const CLIP_CENTER = MENU_V2.clip.x + MENU_V2.clip.w / 2;
const CONTENT_LEFT = CLIP_CENTER - CONTENT_W / 2;
/** 整阵底 = 台面 − 底部空行（空行不画珠）⇒ 有墨底边恰好贴台面。 */
const MATRIX_BOTTOM = ART.y - (BOSS.pattern.length - 1 - INK.maxR) * PITCH;

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
    // 通关 = 全彩（`_arcProgress` = 1）。
    carouselProgress: 1,
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
 * `[2026-11-20 · WXG-T-1006]` 固定样式展示腿落位：按 `avail` 见方（pitch = avail / cols），
 * 有墨包围盒水平居中、底边贴台面；图案包围盒必须落在展品实际绘制区内且不越过玻璃裁切顶。
 * 纹理腿的 256² 透明边判据已退场（K-053 划线）。
 */
const expectBeadOnShelf = (cmds: readonly DrawCommand[]): void => {
    const rects = beadRects(cmds);
    expect(rects.length, '基色格已画').toBeGreaterThan(100);
    const minX = Math.min(...rects.map((r) => r.x));
    const maxX = Math.max(...rects.map((r) => r.x + r.w));
    const minY = Math.min(...rects.map((r) => r.y));
    const maxY = Math.max(...rects.map((r) => r.y + r.h));
    expect(minX).toBeGreaterThanOrEqual(CONTENT_LEFT - 1);
    expect(maxX).toBeLessThanOrEqual(CONTENT_LEFT + CONTENT_W + 1);
    // `[WXG-T-1006 五改]` 有墨底边贴台面：最底行块底 = 台面 + 1px 轻缝（⛔ 不再是空行高一珠）。
    expect(minY).toBeCloseTo(ART.y + MENU_SHOWCASE_CELL_SEAM, 6);
    expect(maxY).toBeLessThanOrEqual(MATRIX_BOTTOM + BOSS.pattern.length * PITCH + 1);
    // 水平中心 = 裁切窗中心（378.5，八改后珠阵与玻璃内腔同轴）。
    expect((minX + maxX) / 2).toBeCloseTo(CLIP_CENTER, 0);
};

/** 指定行（自顶 0-based）及以下的**圈内**有墨格数 ⇒ 按进度着色的期望格数（T-1031 裁圈口径）。 */
const cellsFromRow = (row: number): number => {
    let n = 0;
    for (let i = 0; i < SHOWN_CELLS.length; i += 3) if (SHOWN_CELLS[i]! >= row) n += 1;
    return n;
};

afterEach(() => {
    setMenuBitmapResolver(undefined);
});

describe('WXG-T-522 橱窗单一作品', () => {
    it('`[八改]` 走马灯裁切窗对齐玻璃内腔（150..607），珠阵以窗中心为轴', () => {
        expect(MENU_V2.clip.x).toBe(150);
        expect(MENU_V2.clip.x + MENU_V2.clip.w).toBe(607);
        expect(CLIP_CENTER).toBeCloseTo(ART.x + ART.w / 2 + 4, 6);
    });

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

    it('`[WXG-T-1006]` 通关页（进度 1）：基色全彩，锁形退场', () => {
        hostWith(MENU_TEXTURES.backdrop, MENU_TEXTURES.lock);
        const cmds = frame(data({ carouselState: 'cleared' as const }));
        const rects = beadRects(cmds);
        expect(countIn(rects, COLOR_HEXES), '通关 = 全彩（圈内格）').toBe(SHOWN_CELLS.length / 3);
        expect(countIn(rects, GRAY_HEXES), '通关不画灰格').toBe(0);
        expect(blitsOf(cmds, MENU_TEXTURES.lock).length, '通关不画锁').toBe(0);
    });

    it('`[WXG-T-1006]` 进度 0：整幅置灰（未通关部分 = 灰）', () => {
        hostWith(MENU_TEXTURES.backdrop);
        const cmds = frame(data({ carouselState: 'pushing' as const, carouselProgress: 0 }));
        const rects = beadRects(cmds);
        expect(countIn(rects, GRAY_HEXES), '进度 0 = 整幅灰（圈内格）').toBe(SHOWN_CELLS.length / 3);
        expect(countIn(rects, COLOR_HEXES), '进度 0 不露全彩').toBe(0);
    });

    // 用户 2026-11-20 二改追问：「每个珠面都有自己的基础颜色」⇒ 未达进度**压灰不漂白**。
    it('`[WXG-T-1006]` 压灰色集逐珠保留自有色相（⛔ 不统一浅灰）', () => {
        const base = beadInksFor(BOSS).hexes;
        const dim = beadDimInksFor(BOSS).hexes;
        const chroma = (hex: string): number => {
            const n = parseInt(hex.slice(1), 16);
            const r = (n >> 16) & 0xff;
            const g = (n >> 8) & 0xff;
            const b = n & 0xff;
            return Math.max(r, g, b) - Math.min(r, g, b);
        };
        // 有彩色（基色 chroma > 20）压灰后至少保留 30% 色相（⛔ 漂白成同一近白灰）；
        // 近中性基色（如炭黑）不参与色相比率断言。
        for (let i = 0; i < base.length; i += 1) {
            const c0 = chroma(base[i]!);
            if (c0 <= 20) continue;
            expect(chroma(dim[i]!) / c0, `第 ${i + 1} 色压灰后仍须保留自有色相`).toBeGreaterThan(0.3);
        }
        expect(new Set(dim).size, '压灰色集不得退化成单色').toBeGreaterThan(1);
    });

    it('`[WXG-T-1006]` 进度 0.5：自下而上恰好一半行全彩，其余置灰', () => {
        hostWith(MENU_TEXTURES.backdrop);
        const cmds = frame(data({ carouselState: 'pushing' as const, carouselProgress: 0.5 }));
        const rects = beadRects(cmds);
        const colored = countIn(rects, COLOR_HEXES);
        const total = SHOWN_CELLS.length / 3;
        // 30 行 × 0.5 ⇒ 底部 15 行（r ≥ 15）上色（格心判定）。
        expect(colored, '彩色格数 = 底部 15 行有墨格').toBe(cellsFromRow(15));
        expect(countIn(rects, GRAY_HEXES), '其余有墨格置灰').toBe(total - colored);
        // 彩色格全部落在下半幅（y ≤ 整阵底 + 15 行高）。
        const revealTop = MATRIX_BOTTOM + 15 * PITCH;
        for (const r of rects.filter((x) => COLOR_HEXES.has(x.fill ?? ''))) {
            expect(r.y + r.h).toBeLessThanOrEqual(revealTop + 0.001);
        }
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
        // 锚点 = `clip` 顶 ↔ 台面 的中点（⛔ 不坐台面；与 `drawShowcaseArt` 的 `avail` 同式）；
        // `[八改]` x 轴 = 玻璃裁切窗中心（150..607 → 378.5），⛔ 名义 art 框中心。
        expect(lock.x + lock.w / 2).toBeCloseTo(MENU_V2.clip.x + MENU_V2.clip.w / 2, 6);
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

    // `[WXG-T-1031]` 用户问「白色外框是否是图案边界」⇒ 是（1 号珠边界带，置灰成近白）；
    // 令「边界缩小一圈，外框底部正好落在托板上」⇒ 展示侧裁最外一圈、锚定沿用。
    it('`[WXG-T-1031]` 展示侧裁最外一圈：外圈珠不画，底边仍贴台面', () => {
        hostWith(MENU_TEXTURES.backdrop);
        const cmds = frame(data());
        const rects = beadRects(cmds);
        // L9 全墨 612 格 > 圈内格数 ⇒ 最外圈机械不画；落位判据（含底边贴台面）随裁圈口径复核。
        expect(levelThumbFullCells(BOSS).length / 3).toBeGreaterThan(SHOWN_CELLS.length / 3);
        expect(rects.length, '只画圈内格').toBe(SHOWN_CELLS.length / 3);
        expectBeadOnShelf(cmds);
    });
});
