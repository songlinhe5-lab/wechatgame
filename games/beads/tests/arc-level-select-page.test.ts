/**
 * 选关**弹窗**版面（`[WXG-T-503]` 改判；用户 2026-10-29 选「甲·回弹窗」）。
 *
 * 验收真源 = `design/ux/level-select-page-layout.md` v0.7 §2：
 * 600×720 纸面板内 3×3 格（120 / 22）、返回 240×88 @ 板底 +50、
 * 章名与星进度**同行**、判星对照行在网格上方。
 *
 * 本文件只钉**弹窗版面**；格状态与点击语义归 `arc-level-select` / `arc-wall-locked`。
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaModal, buildMetaView, hitTestMeta, metaLayout, type MetaViewData } from '../src/view/meta-view.js';
import { levelsPanelMetrics } from '../src/view/meta-layout.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { COPY_TOKENS } from '../src/config/copy-tokens.js';
import { scrimFill, UI_FONT, UI_SCRIM, starCriteriaText } from '../src/view/ui-theme.js';
import { LEVELS } from '../src/config/levels.js';
import {
    BEAD_GAP,
    DESIGN_H,
    DESIGN_W,
    THUMB_AREA,
    THUMB_MATRIX_N,
    THUMB_STAR_BAND,
    THUMB_TOP_INSET,
    TOUCH_MIN,
    WALL_CAPACITY,
    WALL_CELL,
    WALL_COLS,
    WALL_GAP,
    WALL_ROWS,
} from '../src/config/tuning.js';

/** 3 × 120 + 2 × 22 = 404（常量表达式，避免测试里写第二份 404）。 */
const GRID_W_EXPECT = WALL_COLS * WALL_CELL + (WALL_COLS - 1) * WALL_GAP;

const dataFor = (extra: Partial<MetaViewData> = {}): MetaViewData => {
    const slots: number[] = [];
    const levels: (typeof LEVELS)[number][] = [];
    for (let i = 0; i < WALL_CAPACITY; i++) { slots.push(i); levels.push(LEVELS[i]!); }
    return {
        stamina: 5, staminaMax: 5, coins: 0, overlay: 'levels', signinDay: 0, canClaim: false,
        bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true,
        debugInfo: false, debugGuides: false, beadStyle: 'facet-4', beadSize: 'full', skinId: 'tokens',
        levelCount: LEVELS.length,
        currentLevelIndex: 0,
        maxUnlockedLevel: LEVELS.length,
        starsByLevel: [],
        wallSlots: slots,
        wallLevels: levels,
        carouselLevel: LEVELS[0],
        carouselState: 'pushing',
        ...extra,
    };
};

/** 弹窗帧（= `UiRoot` 只画 modal 的那条腿）。 */
const modalFrame = (data: MetaViewData): readonly DrawCommand[] => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaModal(b, data, DEFAULT_PALETTE);
    return b.end().commands;
};

/** 页面帧（基础页 = 主菜单；弹窗打开时底下就是它）。 */
const pageFrame = (data: MetaViewData): readonly DrawCommand[] => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaView(b, data, DEFAULT_PALETTE);
    return b.end().commands;
};

const cells = () => metaLayout('levels', WALL_ROWS).buttons.filter((b) => b.id === 'pick-level');

describe('WXG-T-503 · 弹窗版面单源（`levelsPanelMetrics`）', () => {
    it('板 600×720 @(75,307)；网格 3×3 格 120 / 间距 22；返回 240×88 @ 板底 +50', () => {
        const m = levelsPanelMetrics(WALL_ROWS);
        expect(m.plate).toEqual({ x: 75, y: 307, w: 600, h: 720 });
        expect(WALL_CELL).toBe(120);
        expect(WALL_GAP).toBe(22);
        expect(m.gridW).toBe(GRID_W_EXPECT);
        expect(m.gridLeft).toBe(173);
        expect(m.gridTop).toBe(861);
        expect(m.backY).toBe(357);
        expect(m.backW).toBe(240);
        expect(m.backH).toBe(TOUCH_MIN);
    });

    it('热区：九格列左缘 173/315/457、行下缘 741/599/457；返回居中', () => {
        const cs = cells();
        expect(cs).toHaveLength(WALL_CAPACITY);
        expect(cs[0]!.box).toEqual({ x: 173, y: 741, w: WALL_CELL, h: WALL_CELL });
        expect(cs.map((c) => c.box.x)).toEqual([173, 315, 457, 173, 315, 457, 173, 315, 457]);
        expect([cs[0]!.box.y, cs[3]!.box.y, cs[6]!.box.y]).toEqual([741, 599, 457]);
        const back = metaLayout('levels', WALL_ROWS).buttons.find((b) => b.id === 'back')!;
        expect(back.box).toEqual({ x: 255, y: 357, w: 240, h: 88 });
        expect(hitTestMeta('levels', 375, 401)?.id, '返回可命中').toBe('back');
        expect(hitTestMeta('levels', 10, 10), '板外 = 零热区').toBeNull();
    });

    it('缩略 84 = 120 − 8 − 28（与作品墙同一套）', () => {
        expect(THUMB_AREA).toBe(84);
        expect(THUMB_AREA).toBe(WALL_CELL - THUMB_TOP_INSET - THUMB_STAR_BAND);
    });
});

describe('WXG-T-503 · 弹窗性质（遮罩 + 纸面板 + 标题）', () => {
    it('弹窗帧含半透明遮罩与 600×720 纸面板；底页帧无两者', () => {
        const modal = modalFrame(dataFor());
        const scrim = scrimFill(UI_SCRIM.overlay, UI_SCRIM.alpha);
        expect(modal.some((c) => c.kind === 'rect' && c.fill === scrim), '遮罩').toBe(true);
        expect(modal.some((c) => c.kind === 'rect' && c.w === 600 && c.h === 720), '纸面板').toBe(true);

        const page = pageFrame(dataFor());
        expect(page.some((c) => c.kind === 'rect' && c.fill === scrim), '底页不画遮罩').toBe(false);
        expect(page.some((c) => c.kind === 'rect' && c.w === 600 && c.h === 720), '底页不画面板').toBe(false);
    });

    it('标题 = 文案表「选关」，居中于板顶下 50（y=977）', () => {
        const title = modalFrame(dataFor()).find(
            (c) => c.kind === 'text' && (c as { text?: string }).text === COPY_TOKENS.btn_levels_label,
        ) as { x: number; y: number } | undefined;
        expect(title).toBeDefined();
        expect(title!.x).toBe(DESIGN_W / 2);
        expect(title!.y).toBe(977);
    });
});

describe('WXG-T-503 · 信息两行（章名+星进度同行 / 判星对照行）', () => {
    const textsOf = (extra: Partial<MetaViewData>) =>
        modalFrame(dataFor(extra)).filter((c) => c.kind === 'text') as unknown as
            { text: string; x: number; y: number; font?: string; fill?: string; align?: string }[];

    it('章名 925（居中）/ 星进度 925（右侧 · 右对齐）', () => {
        const ts = textsOf({ chapterTitle: '曼陀罗', arcStarGot: 18, arcStarNeed: 21 });
        const chapter = ts.find((c) => c.text === '曼陀罗')!;
        const bar = ts.find((c) => c.text === '★ 18/21')!;
        expect(chapter.y).toBe(925);
        expect(chapter.font).toBe(UI_FONT.button);
        expect(bar.y).toBe(925);
        expect(bar.x).toBe(635);
        expect(bar.align).toBe('right');
        expect(bar.font).toBe(UI_FONT.sub);
    });

    it('判星对照行 885；取不到当前关 ⇒ 不建节点', () => {
        const CRITERIA = starCriteriaText(LEVELS[0]!.time);
        const on = textsOf({});
        const row = on.find((c) => c.text === CRITERIA)!;
        expect(row.y).toBe(885);
        expect(row.font).toBe(UI_FONT.sub);
        expect(row.fill).toBe(DEFAULT_PALETTE.textDim);
        const off = textsOf({ currentLevelIndex: 999 });
        expect(off.some((c) => c.text === CRITERIA), '越界关索引 ⇒ 整行不画').toBe(false);
    });

    it('E2 大字号：两行随放大到 35（29 档 → bodyLarge）', () => {
        const ts = textsOf({ largeText: true, arcStarGot: 1, arcStarNeed: 9 });
        expect(ts.find((c) => c.text === '★ 1/9')!.font).toBe(UI_FONT.bodyLarge);
        expect(ts.find((c) => c.text.startsWith('3★ 用时'))!.font).toBe(UI_FONT.bodyLarge);
    });
});

describe('WXG-T-503 · 格内与转场', () => {
    it('格内图元不越格；缩略块落在 84 区内', () => {
        const cmds = modalFrame(dataFor({ maxUnlockedLevel: 1 }));
        const first = cells()[0]!.box;
        const bandTop = first.y + WALL_CELL - THUMB_TOP_INSET;
        const blocks = cmds.filter(
            (c) => c.kind === 'rect' && 'x' in c &&
                c.x > first.x + 1 && c.x + c.w < first.x + first.w - 1 &&
                c.y > first.y + 1 && c.y + c.h <= bandTop + 1,
        ) as { w: number; h: number }[];
        expect(blocks.length).toBeGreaterThan(0);
        for (const b of blocks) {
            expect(b.w).toBeLessThanOrEqual(THUMB_AREA / THUMB_MATRIX_N - BEAD_GAP + 0.01);
        }
    });

    it('pageFade 转场：面板命令乘 0.75；静息帧无 alpha 字段', () => {
        const faded = modalFrame(dataFor({ pageFade: 0.75 }));
        const plate = faded.find((c) => c.kind === 'rect' && c.w === 600 && c.h === 720) as { alpha?: number };
        expect(plate.alpha).toBeCloseTo(0.75, 5);
        const rest = modalFrame(dataFor());
        const plate2 = rest.find((c) => c.kind === 'rect' && c.w === 600 && c.h === 720) as { alpha?: number };
        expect(plate2.alpha).toBeUndefined();
    });
});
