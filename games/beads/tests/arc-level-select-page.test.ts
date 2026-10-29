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
import { scrimFill, UI_FONT, UI_SCRIM, starCriteriaText } from '../src/view/ui-theme.js';
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

/**
 * `[WXG-T-501]` 图鉴 / 本地榜两入口下线（用户 2026-10-29）：图鉴 = 无专属设计的每小关缩略图墙，
 * 本地榜 = 与首页好友榜重叠 ⇒ 选关底排只剩**居中返回**；⛔ 不得再注册两侧入口热区。
 */
describe('WXG-T-501 · 选关页底排只留返回', () => {
    it('返回居中，且图鉴 / 本地榜热区已退场', () => {
        const btns = metaLayout('levels', WALL_ROWS).buttons;
        const back = btns.find((b) => b.id === 'back')!;
        expect(back.box.w).toBe(LEVELS_BACK_W);
        expect(back.box.x).toBe((DESIGN_W - back.box.w) / 2);
        expect(back.box.y).toBe(LEVELS_BACK_BOTTOM);
        expect(back.box.h).toBe(TOUCH_MIN);
        const ids: string[] = btns.map((b) => b.id);
        expect(ids).not.toContain('open-album');
        expect(ids).not.toContain('open-local-rank');
    });

    it('返回可命中', () => {
        const b = metaLayout('levels', WALL_ROWS).buttons.find((x) => x.id === 'back')!;
        const hit = hitTestMeta('levels', b.box.x + b.box.w / 2, b.box.y + b.box.h / 2);
        expect(hit?.id).toBe('back');
    });
});
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
            { text: string; x: number; y: number; font?: string; fill?: string }[];
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

    // R2 判据修正（WXG-T-356）：本例原以「整带零文本」代理「无章名节点」，而空带自 WXG-T-346
    // 的累计星进度件与本批（版面单 v0.6 §2 判星对照行）起**合法地**还住别的行 ⇒ 位置 ≠ 身份。
    // 改按**章名位**（带中心 y）取节点；「⛔ 不回落关序/slug」的语义逐字保留。
    const onTitleRow = (c: { y: number }) =>
        c.y === (LEVELS_GRID_TOP + LEVELS_NAV_TOP - LEVELS_NAV_H) / 2;

    it('R2 无 title：章名位零节点（兜底不猜测；⛔ 不回落关序/slug）', () => {
        const bare = textsOf({});
        expect(bare.filter(onTitleRow), '无 chapterTitle ⇒ 章名位不建节点').toHaveLength(0);
        expect(textsOf({ chapterTitle: '曼陀罗' }).filter(onTitleRow), '对照：有值恰一枚').toHaveLength(1);
    });

    it('累计星进度件：有门槛 ⇒ 章名下方一行且在带内；无 ⇒ 不画（WXG-T-346）', () => {
        expect(textsOf({ chapterTitle: '曼陀罗' }).some((c) => c.text.startsWith('★ ')), '无字段不画').toBe(false);
        const on = textsOf({ chapterTitle: '曼陀罗', arcStarGot: 18, arcStarNeed: 21 });
        const title = on.find((c) => c.text === '曼陀罗')!;
        const bar = on.find((c) => c.text === '★ 18/21')!;
        expect(bar, '进度件落空带').toBeDefined();
        expect(inBand(bar), '仍在带内（不进热区、不出带）').toBe(true);
        expect(bar.y, '在章名之下（y 向上 ⇒ 更小）').toBeLessThan(title.y);
    });

    // 视觉裁决守卫（art 规格 `menu-layout-implementation-spec.md §10` v3.10 · WXG-T-346 art 批）。
    // 页侧与木牌侧相反 ⇒ **随** E2 放大（空带高 300、行距 44 ⇒ 35 仍留 6.5px 余量，已实拍）。
    it('进度件视觉 = 28 档 + textDim，E2 开 ⇒ 35（页侧随放大）', () => {
        const bar = (largeText: boolean) => textsOf(
            { chapterTitle: '曼陀罗', arcStarGot: 18, arcStarNeed: 21, largeText },
        ).find((c) => c.text === '★ 18/21')!;
        expect(bar(false).font, '字号 = font_label 28（UI_FONT.sub）').toBe(UI_FONT.sub);
        expect(bar(false).font, '⛔ 回到 cell 22 档（22px 需 4.5:1，实测 textDim 仅 3.90:1）').not.toBe(UI_FONT.cell);
        expect(bar(true).font, 'E2 开关 ×1.25 = 35（tokens.md §5）').toBe(UI_FONT.bodyLarge);
        expect(bar(false).fill, '色 = text_secondary（比章名 text 低一档保住层级）').toBe(DEFAULT_PALETTE.textDim);
    });

    // `[WXG-T-356]` 判星对照行（正本 = `level-select-page-layout.md` v0.6 §2）。
    // 为什么不在格内：星带分栏要合规就得 ≥ 28px（accessibility E1 floor），而 28px 下
    // `★★★` ≈ 84 + `≤03:30` ≈ 94 = 178 > 格宽 170 ⇒ 上移到空带，与进度件同档同色同底（暖纸底）。
    const CRITERIA = starCriteriaText(LEVELS[0]!.time);

    it('判星对照行 = 与结算面板共读 `starCriteriaText`，落带内、在进度件之下', () => {
        expect(CRITERIA, '串形状（文案与门槛口径只有一套；字面值归 `clear-panel.test.ts`）')
            .toMatch(/^3★ 用时 ≤ \d{2}:\d{2} ｜ 2★ 用时 ≤ \d{2}:\d{2}$/);
        const on = textsOf({ chapterTitle: '曼陀罗', arcStarGot: 18, arcStarNeed: 21 });
        const row = on.find((c) => c.text === CRITERIA);
        expect(row, '门槛行未渲染').toBeDefined();
        expect(inBand(row!), '仍在空带 [822,1122] 内').toBe(true);
        expect(row!.y, '行位 = 带中心下移一个 `LEVELS_NAV_H`（派生常量、零新数值）')
            .toBe((LEVELS_GRID_TOP + LEVELS_NAV_TOP - LEVELS_NAV_H) / 2 - LEVELS_NAV_H);
        const bar = on.find((c) => c.text === '★ 18/21')!;
        expect(row!.y < bar.y, '在进度件之下（y 向上 ⇒ 更小）').toBe(true);
    });

    it('判星对照行视觉 = 28 档随 E2 → 35 + textDim（⛔ 回落 `cell` 22，accessibility E1 floor）', () => {
        const off = textsOf({}).find((c) => c.text === CRITERIA)!;
        expect(off.font).toBe(UI_FONT.sub);
        expect(off.font, '⛔ 回到 cell 22（v0.5 星带分栏那一版的错；22px 在本页暖纸底上不过普通文本档）').not.toBe(UI_FONT.cell);
        expect(textsOf({ largeText: true }).find((c) => c.text === CRITERIA)!.font, 'E2 开 ⇒ 35（随大字模式放大）').toBe(UI_FONT.bodyLarge);
        expect(off.fill).toBe(DEFAULT_PALETTE.textDim);
    });

    it('判星对照行：取不到当前关引用 ⇒ 不建节点（兜底不猜测，⛔ `--:--` 占位）', () => {
        const off = textsOf({ currentLevelIndex: 999 });
        expect(off.some((c) => c.text === CRITERIA), '越界关索引 ⇒ 整行不画').toBe(false);
        expect(off.some((c) => /--:--|nan/i.test(c.text)), '⛔ 占位串').toBe(false);
    });
});
