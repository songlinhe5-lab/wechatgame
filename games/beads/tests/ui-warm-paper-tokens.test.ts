/**
 * WXG-T-268 · 「暖纸拼豆台」UI 基础色板换值批（EP12-S1）· 令牌同步与设计判据复算
 * ─────────────────────────────────────────────────────────────────────────────
 * 真源链 = `design/proposals/ui-style-redesign/tokens.md` §1（定稿，用户 2026-10-07 裁 D-2）
 *   ⇒ `art-bible-proposal.md` §3.1（回写 R-7）⇒ 本文件断言 `palette.ts::DEFAULT_PALETTE`（消费副本）。
 *
 * 判据来源（⛔ 不发明新判据 / 新数值，全部为设计侧既有判据的脚本复算）：
 *  - art-bible §3.1 定稿 HEX 表（五项「换」值）；
 *  - art-bible §3.2 B1 对比度（`text_secondary` on 新纸白「4.6:1 [待核]」⇒ 本测试闭合该 [待核]；
 *    wood_text 白 ▶ 对 wood_face 5.4:1 ✓ ≥4.5）；
 *  - art-bible §3.1 bg_base 行「奶白珠 #FDF6E9 ΔL ≈ 5.4% > 4% 不可辨阈」（Rec.601 luma，ΔL% = |Δ|/255）；
 *  - art-bible §2 治愈支柱②「底色为低饱和暖米（饱和度 ≤12%）」⇒ 脚本复算（HSB 口径，[待实测]→脚本项）；
 *  - risks.md P-1 收编行为面：缩放控件条改读 panel/panelBorder（tokens.md §1「控件不再消费 slot 族」）。
 *
 * 封箱联动：本批值变更走第十七次复评归因通道（`bead-style-seal.test.ts` provenance `s3_frame_recheck_17`）
 * 与色表锁追改（`bead-render.test.ts` ④，35 条 / `612ced0aa888`）——本文件不重复锁 sha。
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS, contrastRatio, luminance } from '../src/view/palette.js';
import { zoomControlLayout } from '../src/config/tuning.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { RenderModelBuilder } from '@wxgame/framework';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';

/** HSB/HSV 饱和度（0..1）＝ (max−min)/max；art-bible §2 治愈② 的「饱和度」口径（同 Photoshop HSB）。 */
function hsbSaturation(hex: string): number {
    const h = hex.replace('#', '');
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
}

/** §3.1 bg_base 行的 ΔL%（Rec.601 luma，0..255 标度：|lumaA−lumaB|/255）。 */
function lumaDeltaPercent(a: string, b: string): number {
    return Math.abs(luminance(a) - luminance(b)) * 100;
}

/** 封箱同构夹具（`bead-style-seal-recapture.ts::halfBoardHarness` 逐字同构，⛔ 另造夹具）。 */
function sealStyleHarness(): Harness {
    return createBeadsHarness({
        noAssemble: true,
        levels: [simpleTestLevel({ cols: 13, rows: 12, pattern: Array.from({ length: 12 }, () => '1231231231231') })],
        saveKey: 'wxgame.beads.test.ui-warm-paper-tokens',
    });
}

describe('WXG-T-268 暖纸拼豆台 · UI 基础色板（art-bible §3.1 定稿 ⇒ 消费副本同步）', () => {
    it('五项「换」值逐值对齐 tokens.md §1 定稿表（R-7 消费副本同步门）', () => {
        // 真源 = tokens.md §1（2026-10-07 定稿）；本断言锁「消费副本 ≠ 真源即红」。
        expect(DEFAULT_PALETTE.background, 'bg_base 暖米纸（初稿 #f6efe2 因 ΔL 2.7% 作废）').toBe('#F1E8D8');
        expect(DEFAULT_PALETTE.panel, 'panel 暖纸白').toBe('#FFFCF6');
        expect(DEFAULT_PALETTE.panelBorder, 'panel_border 暖沙 1px').toBe('#E6DAC3');
        expect(DEFAULT_PALETTE.accentPrimary, 'accent_primary 并入木色 wood_face').toBe('#8A5B34');
        expect(DEFAULT_PALETTE.adBadge, 'ad_badge = wood_face 引用值').toBe('#8A5B34');
        // 承行（tokens.md §1「承」= 不改）抽钉两条最关键的零变动面：
        expect(DEFAULT_PALETTE.text, 'text_primary 不改 ⇒ PANEL_SCRIM_RGB (42,46,67) 口径不破').toBe('#2A2E43');
        expect(DEFAULT_PALETTE.traySlot, 'traySlot 不动项（WXG-T-261 二批定稿 #4A5060）').toBe('#4A5060');
    });

    it('art-bible §3.2 B1：text_secondary on 新纸白 ≥ 4.5:1（[待核] 4.6:1 项就此闭合）', () => {
        const ratio = contrastRatio(DEFAULT_PALETTE.textDim, DEFAULT_PALETTE.panel);
        expect(ratio, `实测 ${ratio.toFixed(2)}:1（tokens.md 记 4.6 [待核]）`).toBeGreaterThanOrEqual(4.5);
    });

    it('art-bible §3.1：木面白 ▶ 对 wood_face（= accent_primary 值）≥ 4.5:1', () => {
        const ratio = contrastRatio('#FFFFFF', DEFAULT_PALETTE.accentPrimary);
        expect(ratio, `实测 ${ratio.toFixed(2)}:1（§3.1 声明 5.4:1）`).toBeGreaterThanOrEqual(4.5);
    });

    it('art-bible §3.1 bg_base 判据：奶白珠 #FDF6E9 对暖底 ΔL > 4%（10 色最弱对，初稿 #f6efe2 2.7% 的推翻判据）', () => {
        const creamWhite = DEMO_BEAD_INKS.hexes[0];
        expect(creamWhite, 'demo 十色首位 = 奶白珠（珠色1）').toBe('#FDF6E9');
        const delta = lumaDeltaPercent(creamWhite, DEFAULT_PALETTE.background);
        expect(delta, `实测 ΔL ${delta.toFixed(1)}%（§3.1 声明 ≈5.4%；<4% 即「刻意不可辨」阈）`).toBeGreaterThan(4);
    });

    it('art-bible §2 治愈②：底色饱和度 ≤12%（HSB 口径脚本复算）', () => {
        const sat = hsbSaturation(DEFAULT_PALETTE.background);
        expect(sat, `实测 ${(sat * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.12);
    });
});

describe('WXG-T-268 P-1 收编：缩放控件条改读纸面板族（risks.md P-1 / tokens.md §1）', () => {
    it('缩放钮（72×56）与滑轨轨道 fill/stroke ≡ panel/panelBorder，不再消费 slot 族', () => {
        const harness = sealStyleHarness();
        const builder = new RenderModelBuilder(750, 1334);
        builder.begin();
        buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
        const cmds = builder.end().commands;

        const zc = zoomControlLayout();
        const zoomBtns = cmds.filter(
            (c) => c.kind === 'rect' && c.w === 72 && c.h === 56,
        );
        expect(zoomBtns.length, '1:1 + 适配 两钮在场').toBe(2);
        for (const btn of zoomBtns) {
            expect((btn as { fill?: string }).fill, '缩放钮面 ≡ panel（原 slot）').toBe(DEFAULT_PALETTE.panel);
            expect((btn as { stroke?: string }).stroke, '缩放钮描边 ≡ panelBorder（原 slotBorder）').toBe(
                DEFAULT_PALETTE.panelBorder,
            );
        }
        const track = cmds.find((c) => c.kind === 'rect' && c.w === zc.track.w && c.h === 12);
        expect(track, '滑轨轨道在场').toBeDefined();
        expect((track as { fill?: string }).fill, '轨道面 ≡ panel').toBe(DEFAULT_PALETTE.panel);
        expect((track as { stroke?: string }).stroke, '轨道描边 ≡ panelBorder').toBe(DEFAULT_PALETTE.panelBorder);
        // 已选段/knob 描边走 accentPrimary（本批换值 wood_face）——钉住换值后的消费语义不变。
        const knob = cmds.find((c) => c.kind === 'circle' && c.r === 22);
        expect(knob, 'knob 在场（r22）').toBeDefined();
        expect((knob as { stroke?: string }).stroke, 'knob 描边 ≡ accentPrimary').toBe(DEFAULT_PALETTE.accentPrimary);
    });
});
