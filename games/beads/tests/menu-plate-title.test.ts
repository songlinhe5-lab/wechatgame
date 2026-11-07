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

    it('无展示名 ⇒ 只画关序「第 N 关」；有展示名 ⇒ 只画关名（隐关序，(b) 口径）', () => {
        setMenuBitmapResolver(() => true);
        expect(texts(dataFor(lv, 'pushing'))).toContain(`第 ${lv.id} 关`);
        const named = texts(dataFor({ ...lv, title: '曼陀罗' }, 'pushing'));
        expect(named).not.toContain(`第 ${lv.id} 关`);
        expect(named).toContain('曼陀罗');
    });

    // `[WXG-T-585]` 2026-11-07 切生产：v2 背板已烘**空白木牌本体** ⇒ 标题不再依赖 `ui_menu_plate`
    // 位图（v1 那条「无底面不写字」的守卫随 v1 版面退场；配置缺失时按切生产口径「露空」而不降级）。
    it('牌体烘进背板 ⇒ 标题不依赖 `ui_menu_plate` 位图（切生产后恒画）', () => {
        expect(texts(dataFor(lv, 'pushing'))).toContain(`第 ${lv.id} 关`);
    });
});

describe('累计星进度件（WXG-T-346 · ux v1.11 §4.1 甲臂）', () => {
    const named = { ...LEVELS[0]!, title: '曼陀罗' };

    it('有门槛 ⇒ 两行：★ n/门槛 落在第二行槽，关名不动（v2 绝对槽）', () => {
        setMenuBitmapResolver(() => true);
        const solo = textCmds(dataFor(named, 'pushing')).find((c) => c.text === '曼陀罗')!;
        const both = textCmds({ ...dataFor(named, 'pushing'), arcStarGot: 18, arcStarNeed: 21 });
        const title = both.find((c) => c.text === '曼陀罗')!;
        const bar = both.find((c) => c.text === '★ 18/21')!;
        expect(bar, '第二行画出进度').toBeDefined();
        // `[WXG-T-585]` 切生产：v2 两行 = `MENU_V2.plateTitle` / `plateSub` 两个**绝对槽** ⇒
        // 出第二行时关名不挪位（v1「关名上移让位」那条链式位移已随 v1 版面退场）。
        expect(title.y, '关名守 line1 槽').toBe(solo.y);
        expect(bar.y, '进度在关名之下（y 向上 ⇒ 更小）').toBeLessThan(title.y);
    });

    it('无门槛字段 ⇒ 不画进度件（原单行逐字不变）', () => {
        setMenuBitmapResolver(() => true);
        expect(texts(dataFor(named, 'pushing')).some((t) => t.startsWith('★ '))).toBe(false);
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
    // 关名 5.38:1 ✓ / 次行 4.61:1 ✓。
    it('两行 = 胶囊(platePill) + 次行墨 28 粗 + 关名墨 40 粗，E2 开也仍 28（牌面定尺，⛔ 回退 22 档）', () => {
        setMenuBitmapResolver(() => true);
        // largeText 强制开：木牌侧「不随 E2 放大」是 §10 的在册例外，必须在这一例里一并守住。
        const cmds = allCmds({ ...dataFor(named, 'pushing'), largeText: true, arcStarGot: 18, arcStarNeed: 21 });
        const texts = cmds.filter((c) => c.kind === 'text')
            .map((c) => c as unknown as { text: string; font?: string; fill?: string });
        const bar = texts.find((c) => c.text === '★ 18/21')!;
        expect(bar.font, '次行字号 = 28 粗体（labelBold），E2 档下也不得变 35').toBe(UI_FONT.labelBold);
        expect(bar.font, '⛔ 回到 cell 22 档（22px 需 4.5:1）').not.toBe(UI_FONT.cell);
        expect(bar.fill, '次行墨 = plate_sub_ink（压胶囊 4.61:1 ✓）').toBe(DEFAULT_PALETTE.plateSubInk);

        const title = texts.find((c) => c.text === '曼陀罗')!;
        expect(title.font, '关名字型 = plateTitle（bold 40，稿「关名÷次行」1.70 的宽度上限内解）')
            .toBe(UI_FONT.plateTitle);
        expect(title.fill, '关名墨 = plate_title_ink（压牌面亮木 5.38:1 ✓）').toBe(DEFAULT_PALETTE.plateTitleInk);

        // 胶囊底必须真画出来：缺了它，次行墨压亮木牌面只有 1.35:1（比旧法更糟）。
        const pill = cmds.filter((c) => c.kind === 'rect')
            .map((c) => c as unknown as { w: number; h: number; radius?: number; fill?: string })
            .find((c) => c.fill === DEFAULT_PALETTE.platePill && c.w === 130);
        expect(pill, '胶囊底（plate_pill / 宽照稿 130）必须存在').toBeTruthy();
        expect(pill!.h, '高 33 = A 档定义式（次行 28 字身 25.2 ÷ 33 = 0.76 ≈ 稿 0.72）').toBe(33);
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
