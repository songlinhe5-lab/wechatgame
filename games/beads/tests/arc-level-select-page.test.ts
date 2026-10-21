/**
 * UI-34 · 选关**整页**（版式 P）——版面与「整页」性质（WXG-T-311）。
 *
 * 验收真源 = `design/ux/level-select-page-layout.md` v0.2 §2（格 170 / 间距 30 /
 * 网格 x∈[90,660]、y∈[252,822] / back 240×88 @ y∈[116,204] / 标题带 [1122,1210]）
 * + ADR-0032 D5（整页路由：无遮罩、无纸面板，页底 = `palette.background`）。
 *
 * 本文件只钉**版面/整页性质**；格状态与点击语义仍归 `arc-level-select` / `arc-wall-locked`。
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaView, hitTestMeta, metaLayout, type MetaViewData } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { COPY_TOKENS } from '../src/config/copy-tokens.js';
import { scrimFill, UI_SCRIM } from '../src/view/ui-theme.js';
import { LEVELS } from '../src/config/levels.js';
import {
    DESIGN_H,
    DESIGN_W,
    LEVELS_BACK_BOTTOM,
    LEVELS_BACK_W,
    LEVELS_CELL,
    LEVELS_GAP,
    LEVELS_GRID_LEFT,
    LEVELS_GRID_TOP,
    LEVELS_NAV_H,
    LEVELS_NAV_TOP,
    LEVELS_THUMB_AREA,
    THUMB_STAR_BAND,
    THUMB_TOP_INSET,
    TOUCH_MIN,
    WALL_CAPACITY,
    WALL_ROWS,
} from '../src/config/tuning.js';

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

const cells = () => metaLayout('levels', WALL_ROWS).buttons.filter((b) => b.id === 'pick-level');
const inBox = (c: DrawCommand, b: { x: number; y: number; w: number; h: number }): boolean =>
    'x' in c && c.x >= b.x - 1 && c.x <= b.x + b.w + 1 &&
    'y' in c && c.y >= b.y - 1 && c.y <= b.y + b.h + 1;

describe('UI-34 版式 P —— 版面数值 = 确认单 v0.2 §2', () => {
    it('格 170 / 间距 30：网格 x∈[90,660]、y∈[252,822]，行区间 [652,822]/[452,622]/[252,422]', () => {
        const cs = cells();
        expect(cs).toHaveLength(WALL_CAPACITY);
        expect(cs[0]!.box).toEqual({ x: LEVELS_GRID_LEFT, y: LEVELS_GRID_TOP - LEVELS_CELL, w: LEVELS_CELL, h: LEVELS_CELL });
        // 三列左缘 90 / 290 / 490；最右缘 660。
        expect(cs.map((c) => c.box.x)).toEqual([90, 290, 490, 90, 290, 490, 90, 290, 490]);
        expect(cs[2]!.box.x + cs[2]!.box.w).toBe(660);
        // 三行下缘 652 / 452 / 252 ⇒ 整墙 y∈[252,822]。
        expect([cs[0]!.box.y, cs[3]!.box.y, cs[6]!.box.y]).toEqual([652, 452, 252]);
        expect(LEVELS_CELL).toBe(170);
        expect(LEVELS_GAP).toBe(30);
    });

    it('缩略区 = 170 − 8 − 28 = 134（三边留白 18 / 8 / 28；增量全给缩略，星带与顶内缩不放大）', () => {
        expect(LEVELS_THUMB_AREA).toBe(134);
        expect(LEVELS_THUMB_AREA).toBe(LEVELS_CELL - THUMB_TOP_INSET - THUMB_STAR_BAND);
    });

    it('back = 240×88 @ x∈[255,495]、y∈[116,204]（导航栏只放标题）', () => {
        const back = metaLayout('levels', WALL_ROWS).buttons.find((b) => b.id === 'back')!;
        expect(back.box).toEqual({ x: (DESIGN_W - LEVELS_BACK_W) / 2, y: LEVELS_BACK_BOTTOM, w: LEVELS_BACK_W, h: TOUCH_MIN });
        expect(back.box).toEqual({ x: 255, y: 116, w: 240, h: 88 });
        expect(hitTestMeta('levels', 375, 160)?.id, 'back 可命中').toBe('back');
        expect(hitTestMeta('levels', 10, 10), '页内空白 = 零热区').toBeNull();
    });
});

describe('UI-34 整页 —— 无遮罩、无纸面板、标题住导航栏带', () => {
    it('页底 = palette.background；帧内无弹窗遮罩、无 600×720 纸面板', () => {
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        buildMetaView(builder, dataFor(), DEFAULT_PALETTE);
        const model = builder.end();
        const cmds = model.commands;
        expect(model.background).toBe(DEFAULT_PALETTE.background);
        const scrim = scrimFill(UI_SCRIM.overlay, UI_SCRIM.alpha);
        expect(cmds.some((c) => c.kind === 'rect' && c.fill === scrim), '⛔ 无弹窗遮罩').toBe(false);
        expect(cmds.some((c) => c.kind === 'rect' && c.w === 600 && c.h === 720), '⛔ 无纸面板').toBe(false);
    });

    it('标题 = 文案表「选关」，居中于导航栏带（兜底 [1122,1210] ⇒ 中心 1166）', () => {
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        buildMetaView(builder, dataFor(), DEFAULT_PALETTE);
        const title = builder.end().commands.find(
            (c) => c.kind === 'text' && (c as { text?: string }).text === COPY_TOKENS.btn_levels_label,
        ) as { x: number; y: number } | undefined;
        expect(title, '标题仍读文案表').toBeDefined();
        expect(title!.x).toBe(DESIGN_W / 2);
        expect(title!.y).toBe(LEVELS_NAV_TOP - LEVELS_NAV_H / 2);
        expect([LEVELS_NAV_TOP - LEVELS_NAV_H, LEVELS_NAV_TOP]).toEqual([1122, 1210]);
    });

    it('格内图元不越格（大格 170 下缩略/星/锁均在格框内）', () => {
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        buildMetaView(builder, dataFor({ maxUnlockedLevel: 1 }), DEFAULT_PALETTE);
        const cmds = builder.end().commands;
        for (const cell of cells()) {
            const own = cmds.filter((c) => inBox(c, cell.box));
            expect(own.length, `槽 ${cell.slot} 应有格内图元`).toBeGreaterThan(0);
        }
    });
});

describe('UI-34 空带大关名（[WXG-T-340] · levels-spec §11.4）', () => {
    const textsOf = (extra: Partial<MetaViewData>) => {
        const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
        builder.begin();
        buildMetaView(builder, dataFor(extra), DEFAULT_PALETTE);
        return builder.end().commands.filter((c) => c.kind === 'text') as unknown as
            { text: string; x: number; y: number }[];
    };
    // 空带 [822,1122] = [LEVELS_GRID_TOP, navTop−NAV_H] 内的文本节点计数。
    const inBand = (c: { y: number }) => c.y >= LEVELS_GRID_TOP && c.y <= LEVELS_NAV_TOP - LEVELS_NAV_H;

    it('R1 有 title：原样落带中心；标题带仍是「选关」（两处不得同文互换，A3）', () => {
        const named = textsOf({ chapterTitle: '曼陀罗' });
        const title = named.find((c) => c.text === '曼陀罗');
        expect(title).toBeDefined();
        expect(title!.x).toBe(DESIGN_W / 2);
        expect(title!.y).toBe((LEVELS_GRID_TOP + LEVELS_NAV_TOP - LEVELS_NAV_H) / 2);
        expect(named.some(
            (c) => c.text === COPY_TOKENS.btn_levels_label && c.y === LEVELS_NAV_TOP - LEVELS_NAV_H / 2,
        )).toBe(true);
    });

    it('R2 无 title：空带内零文本节点（兜底不猜测；⛔ 不回落关序/slug）', () => {
        const bare = textsOf({});
        expect(bare.filter(inBand), '无 chapterTitle ⇒ 不创建空带节点').toHaveLength(0);
        expect(textsOf({ chapterTitle: '曼陀罗' }).filter(inBand), '对照：有值恰一枚').toHaveLength(1);
    });
});
