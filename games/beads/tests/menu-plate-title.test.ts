/**
 * 主菜单 v3.7（用户 2026-10-16）：木牌关卡标题 + 未开启态淡灰墨。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import { LEVELS } from '../src/config/levels.js';
import { DESIGN_H, DESIGN_W } from '../src/config/tuning.js';
import { buildMetaView, setMenuBitmapResolver, type MetaBossState, type MetaViewData } from '../src/view/meta-view.js';
import { DEFAULT_PALETTE, beadFadedInksFor, beadGrayInksFor } from '../src/view/palette.js';
import { UI_FONT } from '../src/view/ui-theme.js';
import type { BeadsLevelRaw } from '../src/config/levels-data.js';

const lum = (hex: string) => parseInt(hex.slice(1, 3), 16);

const dataFor = (lv: BeadsLevelRaw, state: MetaBossState): MetaViewData => ({
    stamina: 5, staminaMax: 5, coins: 0, overlay: 'none', signinDay: 0, canClaim: false,
    bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true,
    debugInfo: false, debugGuides: false, beadStyle: 'facet-4', beadSize: 'full', skinId: 'tokens',
    levelCount: LEVELS.length, currentLevelIndex: 0, maxUnlockedLevel: 1,
    starsByLevel: [], wallSlots: [], wallLevels: [], carouselLevel: lv, carouselState: state,
});

const texts = (data: MetaViewData) => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaView(b, data, DEFAULT_PALETTE);
    return b.end().commands.filter((c) => c.kind === 'text').map((c) => (c as { text: string }).text);
};

const textCmds = (data: MetaViewData) => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaView(b, data, DEFAULT_PALETTE);
    return b.end().commands.filter((c) => c.kind === 'text') as unknown as
        { text: string; y: number; font?: string; fill?: string }[];
};

/** `[WXG-T-596]` 全命令（含 rect）——药丸底不是文本，`textCmds` 看不见。 */
const allCmds = (data: MetaViewData) => {
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildMetaView(b, data, DEFAULT_PALETTE);
    return b.end().commands;
};

afterEach(() => setMenuBitmapResolver());

describe('木牌标题', () => {
    const lv = LEVELS[0]!;

    // `[WXG-T-598]` 2026-11-07 用户令「应该是关序『第 N 关』」⇒ 补落 `WXG-T-524 §5-A 乙` 的欠账：
    // 第二行由进度件改为**关序**，于是「有展示名」也必须两行（旧口径是只画关名、隐关序）。
    it('无展示名 ⇒ 单行关序；有展示名 ⇒ 两行（关名 + 关序）', () => {
        setMenuBitmapResolver(() => true);
        expect(texts(dataFor(lv, 'pushing'))).toContain(`第 ${lv.id} 关`);
        const named = texts(dataFor({ ...lv, title: '曼陀罗' }, 'pushing'));
        expect(named, '有展示名也要把关序补在第二行').toContain(`第 ${lv.id} 关`);
        expect(named).toContain('曼陀罗');
    });

    // `[WXG-T-585]` 2026-11-07 切生产：v2 背板已烘**空白木牌本体** ⇒ 标题不再依赖 `ui_menu_plate`
    // 位图（v1 那条「无底面不写字」的守卫随 v1 版面退场；配置缺失时按切生产口径「露空」而不降级）。
    it('牌体烘进背板 ⇒ 标题不依赖 `ui_menu_plate` 位图（切生产后恒画）', () => {
        expect(texts(dataFor(lv, 'pushing'))).toContain(`第 ${lv.id} 关`);
    });
});

describe('木牌第二行 = 关序（`[WXG-T-598]` 起进度件自木牌退场）', () => {
    const named = { ...LEVELS[0]!, title: '曼陀罗' };
    const seq = `第 ${named.id} 关`;

    // `[WXG-T-524 §5-A 乙]` 早裁「木牌第二行 = 关序『第 N 关』」；`[WXG-T-598]` 用户令
    // 「应该是关序『第 N 关』」后落码，★ n/门槛（WXG-T-346）与大关 N/M（WXG-T-566）退出木牌。
    // 本例守「实参传了也不画」——旧版是这两件占第二行。
    it('有门槛字段 ⇒ 木牌不画 ★ 进度；两行 = 关名 + 关序，关名不动（v2 绝对槽）', () => {
        setMenuBitmapResolver(() => true);
        const solo = textCmds(dataFor(named, 'pushing')).find((c) => c.text === '曼陀罗')!;
        const both = textCmds({ ...dataFor(named, 'pushing'), arcStarGot: 18, arcStarNeed: 21 });
        expect(both.some((c) => c.text.startsWith('★ ')), '★ 进度不再上牌（选关页仍有）').toBe(false);
        const title = both.find((c) => c.text === '曼陀罗')!;
        const sub = both.find((c) => c.text === seq)!;
        expect(sub, '第二行 = 关序').toBeDefined();
        // `[WXG-T-585]` 切生产：v2 两行 = `MENU_V2.plateTitle` / `plateSub` 两个**绝对槽** ⇒
        // 出第二行时关名不挪位（v1「关名上移让位」那条链式位移已随 v1 版面退场）。
        expect(title.y, '关名守 line1 槽').toBe(solo.y);
        expect(sub.y, '关序在关名之下（y 向上 ⇒ 更小）').toBeLessThan(title.y);
    });

    it('无展示名 ⇒ 单行关序，且实参带门槛也不画进度件', () => {
        setMenuBitmapResolver(() => true);
        const t = texts({ ...dataFor(LEVELS[0]!, 'pushing'), arcStarGot: 18, arcStarNeed: 21 });
        expect(t).toContain(`第 ${LEVELS[0]!.id} 关`);
        expect(t.some((s) => s.startsWith('★ '))).toBe(false);
    });

    // 视觉裁决守卫（art 规格 `menu-layout-implementation-spec.md §10` v3.10 · WXG-T-346 art 批）：
    // 本件不在金样本里（两态均落门票已开放首章）⇒ 只能靠本例防回退到 22px 档。
    // 22px 属「普通文本」档需 4.5:1，而实测对牌底 `wood_face` 3.60:1 / `text_secondary` 2.95:1 ⇒ 都不达标。
    //
    // `[WXG-T-596]` 2026-11-07 用户令「按设计稿改橱窗名牌的字体字样」：第二行由「`wood_face` 直接压
    // 牌面」改为稿面的「**深棕胶囊 + 浅暖粗体**」。旧法对牌面亮木实测 `(233,164,92)` 只有
    // **2.74:1 ❌**（破门）。
    //
    // `[WXG-T-597]` 用户裁「A 档（守 E1）+ 新增 3 枚令牌」：两行改**稿实测值**
    // （`plate_title_ink` / `plate_sub_ink` / `plate_pill`），关名 30 → **40 粗**，次行仍 28，
    // 胶囊 26 → **33**（守 E1 只能加厚胶囊换回稿的「字身÷胶囊」比例）。现对比：
    // 关名 5.38:1 ✓ / 次行 4.61:1 ✓。`[WXG-T-598]` 换件不改版式 ⇒ 断言载体由 `★ 18/21` 改关序。
    //
    // `[WXG-T-599]` 用户 2026-11-07 判「相比设计稿，现在字号有点大」⇒ 按胶囊宽归一后关名 40→**34**、
    // 次行 28→**22**、胶囊 33→**27**。28 那个「E1 地板」不再拦：它当年的理由只是「22px 落普通文本档
    // 需 4.5:1」，而换令牌后次行墨压胶囊已是 **4.61:1** ✓ —— 故本例的「⛔ 回退 22 档」守卫已作废，
    // 改为守「次行必须是 plateSub（22 粗），⛔ 不得退回 labelBold 28（那是资源条专用）」。
    it('两行 = 胶囊(platePill) + 关序 22 粗 + 关名 34 粗，E2 开也不放大（牌面定尺）', () => {
        setMenuBitmapResolver(() => true);
        // largeText 强制开：木牌侧「不随 E2 放大」是 §10 的在册例外，必须在这一例里一并守住。
        const cmds = allCmds({ ...dataFor(named, 'pushing'), largeText: true, arcStarGot: 18, arcStarNeed: 21 });
        const texts = cmds.filter((c) => c.kind === 'text')
            .map((c) => c as unknown as { text: string; font?: string; fill?: string });
        const sub = texts.find((c) => c.text === seq)!;
        expect(sub.font, '次行字号 = 22 粗体（plateSub），E2 档下也不得变 35').toBe(UI_FONT.plateSub);
        expect(sub.font, '⛔ 退回 labelBold 28（资源条数值专用，会把木牌又撑大）').not.toBe(UI_FONT.labelBold);
        expect(sub.fill, '次行墨 = plate_sub_ink（压胶囊 4.61:1 ✓，22px 也过普通文本档 4.5）')
            .toBe(DEFAULT_PALETTE.plateSubInk);

        const title = texts.find((c) => c.text === '曼陀罗')!;
        expect(title.font, '关名字型 = plateTitle（bold 34；墨高 ≈29.9 ≈ 稿归一后的 29.5）')
            .toBe(UI_FONT.plateTitle);
        expect(title.fill, '关名墨 = plate_title_ink（压牌面亮木 5.38:1 ✓）').toBe(DEFAULT_PALETTE.plateTitleInk);

        // 胶囊底必须真画出来：缺了它，次行墨压亮木牌面只有 1.35:1（比旧法更糟）。
        const pill = cmds.filter((c) => c.kind === 'rect')
            .map((c) => c as unknown as { w: number; h: number; radius?: number; fill?: string })
            .find((c) => c.fill === DEFAULT_PALETTE.platePill && c.w === 130);
        expect(pill, '胶囊底（plate_pill / 宽照稿 130）必须存在').toBeTruthy();
        expect(pill!.h, '高 27 = 0.72 定义式（次行 22 字身 19.4 ÷ 27 = 0.72 ≈ 稿 0.70）').toBe(27);
        expect(pill!.radius, '圆角 = 高/2（全圆端，同稿）').toBe(pill!.h / 2);
    });
});

describe('未开启态淡灰墨', () => {
    it('每色都比推关中灰墨更浅', () => {
        const lv = LEVELS[0]!;
        const gray = beadGrayInksFor(lv).hexes;
        const faded = beadFadedInksFor(lv).hexes;
        expect(faded.length).toBe(gray.length);
        faded.forEach((h, i) => expect(lum(h)).toBeGreaterThan(lum(gray[i]!)));
    });
});
