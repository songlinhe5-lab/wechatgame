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

    it('木牌位图未就绪 ⇒ 不画标题（无底面不写字）', () => {
        expect(texts(dataFor(lv, 'pushing'))).not.toContain(`第 ${lv.id} 关`);
    });
});

describe('累计星进度件（WXG-T-346 · ux v1.11 §4.1 甲臂）', () => {
    const named = { ...LEVELS[0]!, title: '曼陀罗' };

    it('有门槛 ⇒ 两行：关名上移，第二行 ★ n/门槛（在册 line1/line2 槽）', () => {
        setMenuBitmapResolver(() => true);
        const solo = textCmds(dataFor(named, 'pushing')).find((c) => c.text === '曼陀罗')!;
        const both = textCmds({ ...dataFor(named, 'pushing'), arcStarGot: 18, arcStarNeed: 21 });
        const title = both.find((c) => c.text === '曼陀罗')!;
        const bar = both.find((c) => c.text === '★ 18/21')!;
        expect(bar, '第二行画出进度').toBeDefined();
        expect(title.y, '关名让位给第二行').not.toBe(solo.y);
        expect(bar.y, '进度在关名之下（y 向上 ⇒ 更小）').toBeLessThan(title.y);
    });

    it('无门槛字段 ⇒ 不画进度件（原单行逐字不变）', () => {
        setMenuBitmapResolver(() => true);
        expect(texts(dataFor(named, 'pushing')).some((t) => t.startsWith('★ '))).toBe(false);
    });

    // 视觉裁决守卫（art 规格 `menu-layout-implementation-spec.md §10` v3.10 · WXG-T-346 art 批）：
    // 本件不在金样本里（两态均落门票已开放首章）⇒ 只能靠本例防回退到 22px 档。
    // 22px 属「普通文本」档需 4.5:1，而实测对牌底 `wood_face` 3.60:1 / `text_secondary` 2.95:1 ⇒ 都不达标。
    it('第二行视觉 = 28 档 + woodFace，E2 开也仍 28（牌面定尺，⛔ 回退 22 档）', () => {
        setMenuBitmapResolver(() => true);
        // largeText 强制开：木牌侧「不随 E2 放大」是 §10 的在册例外，必须在这一例里一并守住。
        const bar = textCmds({ ...dataFor(named, 'pushing'), largeText: true, arcStarGot: 18, arcStarNeed: 21 })
            .find((c) => c.text === '★ 18/21')!;
        expect(bar.font, '字号 = font_label 28（UI_FONT.sub），E2 档下也不得变 35').toBe(UI_FONT.sub);
        expect(bar.font, '⛔ 回到 cell 22 档（22px 需 4.5:1，实测 wood_face 仅 3.60:1）').not.toBe(UI_FONT.cell);
        expect(bar.fill, '色 = wood_face（与关名 woodEdge 拉开一档层级）').toBe(DEFAULT_PALETTE.woodFace);
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
