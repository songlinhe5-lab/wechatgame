/**
 * 选关**弹窗**版面（`[WXG-T-605]`：用户 2026-11-09 令「沿用关卡详情的面板，只是中间区域改成选关页面」）。
 *
 * 验收真源 = `design/ux/level-select-page-layout.md` v0.8 §2：
 * 关卡详情同款木牌 581×1044 @(89,124)、标题「选关」同槽同投影、右上 38² 凹槽 ✕、
 * 中间橱窗内 3×3 格墙（128 / 16）、橱窗下带放判星对照行；**无底部返回钮**。
 *
 * 本文件只钉**弹窗版面**；格状态与点击语义归 `arc-level-select` / `arc-wall-locked`。
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { buildMetaModal, buildMetaView, hitTestMeta, metaLayout, type MetaViewData } from '../src/view/meta-view.js';
import { levelDetailPlate } from '../src/view/meta-layout.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { COPY_TOKENS } from '../src/config/copy-tokens.js';
import { scrimFill, UI_FONT, UI_SCRIM } from '../src/view/ui-theme.js';
import { LEVELS } from '../src/config/levels.js';
import {
    BEAD_GAP,
    DESIGN_H,
    DESIGN_W,
    LEVEL_DETAIL_GEO,
    LEVEL_SELECT_GEO,
    THUMB_AREA,
    THUMB_MATRIX_N,
    THUMB_STAR_BAND,
    THUMB_TOP_INSET,
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

describe('WXG-T-605 · 木牌版面单源（`LEVEL_SELECT_GEO`）', () => {
    it('木牌沿用详情 581×1044 @(89,124)；格 158×181 / 列 158 / 行 194；无返回钮、关闭热区 88 落在 (622,1121)', () => {
        const plate = levelDetailPlate();
        expect(plate).toEqual({ x: 89, y: 124, w: 581, h: 1044 });
        expect(LEVEL_DETAIL_GEO.plate).toEqual({ x: 89, yDown: 166, w: 581, h: 1044 });
        // `[WXG-T-607]` 旧 128 / 16 方形格随 Figma `159:3` 稿退场（K-053 划线留档）。
        expect(LEVEL_SELECT_GEO.grid.cellW).toBe(158);
        expect(LEVEL_SELECT_GEO.grid.cellH).toBe(181);
        expect(LEVEL_SELECT_GEO.grid.pitchX).toBe(158);
        expect(LEVEL_SELECT_GEO.grid.pitchY).toBe(194);

        const btns = metaLayout('levels', WALL_ROWS).buttons;
        expect(btns.some((b) => b.id === 'back'), '底部返回钮退场').toBe(false);
        const close = btns.find((b) => b.id === 'close-levels')!;
        // `[WXG-T-610]` 右上 38² 凹槽 ✕ / 88² 热区随稿退场（K-053 旧值留档），
        // 改稿面底部木质「关闭」按钮（301×105 @225,1028），绘制与命中共源。
        const cb = LEVEL_SELECT_GEO.closeBtn;
        const plateY = DESIGN_H - LEVEL_DETAIL_GEO.plate.yDown - LEVEL_DETAIL_GEO.plate.h;
        expect(close.box).toEqual({
            x: plate.x + (cb.x - LEVEL_DETAIL_GEO.plate.x),
            y: plate.y + (DESIGN_H - cb.yDown - cb.h - plateY),
            w: cb.w,
            h: cb.h,
        });
    });

    it('热区：九格列左缘 138/296/454、行下缘 739/545/351；✕ 可命中；牌外 = 关闭带', () => {
        const cs = cells();
        expect(cs).toHaveLength(WALL_CAPACITY);
        const L = LEVEL_SELECT_GEO.grid.left;
        const pitch = LEVEL_SELECT_GEO.grid.pitchX;
        const g = LEVEL_SELECT_GEO.grid;
        expect(cs[0]!.box).toEqual({ x: L, y: g.topUp - g.cellH, w: g.cellW, h: g.cellH });
        expect(cs.map((c) => c.box.x)).toEqual([L, L + pitch, L + 2 * pitch, L, L + pitch, L + 2 * pitch, L, L + pitch, L + 2 * pitch]);
        expect([cs[0]!.box.y, cs[3]!.box.y, cs[6]!.box.y]).toEqual([739, 545, 351]);
        // `[WXG-T-610]` 命中点改到稿面底部关闭钮中心（旧右上 ✕ (622,1121) 留档）。
        expect(hitTestMeta('levels', 375, 253)?.id, '关闭钮可命中').toBe('close-levels');
        expect(hitTestMeta('levels', 10, 10)?.id, '牌外 = 关闭带').toBe('dismiss-levels');
        // 旧空白点 (375,401) 已落进第 9 格；(375,200) 又贴关闭钮下沿 ⇒ 取 (375,170)。
        expect(hitTestMeta('levels', 375, 170), '牌内空白 = 零命中').toBeNull();
        // `[WXG-T-612]` 右上 ✕ 恢复（用户令）：与详情页同槽（`LEVEL_DETAIL_GEO.close`，
        // 中心 y_up 1121）⇒ 旧命中点回归；`close-levels` = 底部木质钮 + 右上 ✕ 两处出口。
        expect(hitTestMeta('levels', 622, 1121)?.id, '右上 ✕ 可命中').toBe('close-levels');
        expect(cells().filter((b) => b.id === 'pick-level').length, '九格热区不受影响').toBe(WALL_CAPACITY);
        const closeExits = metaLayout('levels', WALL_ROWS).buttons.filter((b) => b.id === 'close-levels');
        expect(closeExits, '底部木质钮 + 右上 ✕ 两处出口').toHaveLength(2);
    });

    it('缩略 84 不随格放大（与作品墙同一套）', () => {
        expect(THUMB_AREA).toBe(84);
        expect(THUMB_AREA).toBe(120 - THUMB_TOP_INSET - THUMB_STAR_BAND);
    });
});

describe('WXG-T-605 · 弹窗性质（遮罩 + 木牌 + 同款标题）', () => {
    it('弹窗帧含半透明遮罩与 581×1044 木牌；底页帧无两者', () => {
        const modal = modalFrame(dataFor());
        const scrim = scrimFill(UI_SCRIM.overlay, UI_SCRIM.alpha);
        expect(modal.some((c) => c.kind === 'rect' && c.fill === scrim), '遮罩').toBe(true);
        expect(modal.some((c) => c.kind === 'rect' && c.w === 581 && c.h === 1044), '木牌回退腿').toBe(true);

        const page = pageFrame(dataFor());
        expect(page.some((c) => c.kind === 'rect' && c.fill === scrim), '底页不画遮罩').toBe(false);
        expect(page.some((c) => c.kind === 'rect' && c.w === 581 && c.h === 1044), '底页不画木牌').toBe(false);
    });

    it('标题 = 文案表「选关」，与详情同槽（380,1056）且带投影', () => {
        const title = modalFrame(dataFor()).find(
            (c) => c.kind === 'text' && (c as { text?: string }).text === COPY_TOKENS.btn_levels_label,
        ) as { x: number; y: number; font?: string; shadow?: unknown } | undefined;
        expect(title).toBeDefined();
        expect(title!.x).toBe(380);
        expect(title!.y).toBe(DESIGN_H - 278);
        expect(title!.font).toBe(UI_FONT.detailTitle);
        expect(title!.shadow, '标题投影').toBeDefined();
    });
});

describe('WXG-T-605 · 信息两行（章名+星进度同行 / 判星对照行）', () => {
    const textsOf = (extra: Partial<MetaViewData>) =>
        modalFrame(dataFor(extra)).filter((c) => c.kind === 'text') as unknown as
        { text: string; x: number; y: number; font?: string; fill?: string; align?: string }[];

    it('关卡名字控件：木牌中轴居中 / 深蓝（`T-611` 用户令）；星进度 967（右对齐 x=630）', () => {
        const ts = textsOf({ chapterTitle: '曼陀罗', arcStarGot: 18, arcStarNeed: 21 });
        const chapter = ts.find((c) => c.text === '曼陀罗')!;
        const bar = ts.find((c) => c.text === '★ 18/21')!;
        // `[WXG-T-611]` 用户令「居中显示」⇒ 木牌中轴（title.cx=380，同标题）；
        // 稿 `159:10` 84 宽槽 @278 左锚退场（K-053）；y/h/ink 仍按稿。
        const n = LEVEL_SELECT_GEO.name;
        expect(chapter.x).toBe(levelDetailPlate().x + (LEVEL_SELECT_GEO.title.cx - LEVEL_DETAIL_GEO.plate.x));
        expect(chapter.y).toBe(DESIGN_H - (n.yDown + n.h / 2));
        expect(chapter.fill).toBe(n.ink);
        expect(chapter.align).toBe('center');
        expect(chapter.font).toBe(UI_FONT.sub);
        expect(bar.y).toBe(DESIGN_H - 367);
        expect(bar.x).toBe(630);
        expect(bar.align).toBe('right');
        expect(bar.font).toBe(UI_FONT.sub);
    });

    it('中带不展示判星/用时信息（用户 2026-11-09 令）', () => {
        const ts = textsOf({});
        expect(ts.some((c) => c.text.startsWith('3★ 用时')), '判星对照行退场').toBe(false);
        expect(ts.some((c) => c.text.includes('用时')), '中带零用时文案').toBe(false);
    });

    it('E2 大字号：星进度随放大到 35（29 档 → bodyLarge）', () => {
        const ts = textsOf({ largeText: true, arcStarGot: 1, arcStarNeed: 9 });
        expect(ts.find((c) => c.text === '★ 1/9')!.font).toBe(UI_FONT.bodyLarge);
    });
});

describe('WXG-T-605 · 格内与转场', () => {
    it('格内图元不越格；缩略块落在 84 区内', () => {
        const cmds = modalFrame(dataFor({ maxUnlockedLevel: 1 }));
        const first = cells()[0]!.box;
        const bandTop = first.y + first.h - THUMB_TOP_INSET;
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

    it('pageFade 转场：木牌命令乘 0.75；静息帧无 alpha 字段', () => {
        const faded = modalFrame(dataFor({ pageFade: 0.75 }));
        const plate = faded.find((c) => c.kind === 'rect' && c.w === 581 && c.h === 1044) as { alpha?: number };
        expect(plate.alpha).toBeCloseTo(0.75, 5);
        const rest = modalFrame(dataFor());
        const plate2 = rest.find((c) => c.kind === 'rect' && c.w === 581 && c.h === 1044) as { alpha?: number };
        expect(plate2.alpha).toBeUndefined();
    });
});
