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
 *
 * **[EP12-S6 · WXG-T-269-S6 T-2A] 追加**：主菜单「木框橱窗作品墙」的**色值消费面**（框/纸/格/空槽
 * 全读既有 token，⛔ 零新 hex）。与 `meta-menu-wall.test.ts` **分工不重叠**：那边钉陈列序 /
 * 热区 / 文案行为，本文件只钉「暖纸与木色在橱窗上的消费是否走对了 token」（K-042：同源判据不两处各钉）。
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS, contrastRatio, luminance, withAlpha } from '../src/view/palette.js';
import {
    EXPAND_BTN_H,
    EXPAND_BTN_W,
    UI_CONTAINER,
    WALL_FRAME_INSET,
    powerupCardRects,
    zoomControlLayout,
} from '../src/config/tuning.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { buildMetaView, metaLayout, type MetaViewData } from '../src/view/meta-view.js';
import { failPanelLayout } from '../src/systems/fail-panel.js';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import { LEVELS } from '../src/config/levels.js';

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

describe('[EP12-S2] 控件语言 token 批：逐值对齐 tokens.md §1「新」行 + 消费面', () => {
    it('11 枚新 token 入 DEFAULT_PALETTE（真源 tokens.md §1，消费副本 ≠ 真源即红）', () => {
        expect(DEFAULT_PALETTE.shadowInk, 'shadow_ink 暖墨投影').toBe('#3D2E1E');
        expect(DEFAULT_PALETTE.woodFace, 'wood_face（≡ accent_primary 同值不同名）').toBe('#8A5B34');
        expect(DEFAULT_PALETTE.woodFacePressed, 'wood_face_pressed（按下态 S4 消费）').toBe('#7E5230');
        expect(DEFAULT_PALETTE.woodFaceDisabled, 'wood_face_disabled（禁用态 S4 消费）').toBe('#C7B299');
        expect(DEFAULT_PALETTE.woodEdge, 'wood_edge 底缘承重线').toBe('#5E3B1E');
        expect(DEFAULT_PALETTE.woodSheen, 'wood_sheen 顶缘受光线').toBe('#B98A5C');
        expect(DEFAULT_PALETTE.woodText, 'wood_text 暖白字').toBe('#FFF6E8');
        expect(DEFAULT_PALETTE.cardPressed, 'card_pressed（纸钮按下态 S4 消费）').toBe('#F4EAD7');
        expect(DEFAULT_PALETTE.cardDisabled, 'card_disabled（禁用态 S4 消费）').toBe('#F7F2E6');
        expect(DEFAULT_PALETTE.cardDisabledBorder, 'card_disabled_border（禁用态 S4 消费）').toBe('#EAE0CC');
        expect(DEFAULT_PALETTE.textDisabled, 'text_disabled（禁用态字）').toBe('#B4A98F');
        // 材质语义锚：木面字对比 ≥4.5（art-bible §3.2 口径，wood_text on wood_face）。
        expect(contrastRatio(DEFAULT_PALETTE.woodText, DEFAULT_PALETTE.woodFace)).toBeGreaterThanOrEqual(4.5);
    });

    it('playing 帧消费面：btn_expand 木面 / 道具卡 panelBorder 描边 / 投影暖墨', () => {
        const harness = sealStyleHarness();
        const builder = new RenderModelBuilder(750, 1334);
        builder.begin();
        buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
        const cmds = builder.end().commands;

        const woodFace = cmds.find(
            (c) => c.kind === 'rect' && c.w === EXPAND_BTN_W && c.h === EXPAND_BTN_H && c.fill === DEFAULT_PALETTE.woodFace,
        );
        expect(woodFace, 'btn_expand 面走 drawWoodButton（woodFace，非旧 EXPAND_BTN_INK 直填）').toBeDefined();

        const card = powerupCardRects()[0]!;
        const face = cmds.find(
            (c) => c.kind === 'rect' && c.x === card.x && c.y === card.bottom && c.stroke === DEFAULT_PALETTE.panelBorder,
        );
        expect(face, '道具卡描边改读 panelBorder（旧 slotBorder 冷边退出）').toBeDefined();
        const shadow = cmds.find(
            (c) =>
                c.kind === 'rect' &&
                c.x === card.x &&
                c.y === card.bottom - 3 &&
                c.fill === withAlpha(DEFAULT_PALETTE.shadowInk, UI_CONTAINER.shadowAlphaCard),
        );
        expect(shadow, '道具卡投影墨暖化 shadowInk').toBeDefined();
    });
});

describe('WXG-T-268 EP12-S4 弹窗族换肤（screens.md S2/S3/S4 · paused/clear/fail）', () => {
    function render(harness: Harness) {
        const builder = new RenderModelBuilder(750, 1334);
        builder.begin();
        buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
        return builder.end().commands;
    }

    it('paused：纸面板暖墨投影 + T3 木主钮 + 开关 chip 选中 = 木底（音乐/音效默认开）', () => {
        const harness = createBeadsHarness({
            noAssemble: true,
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.ep12-s4-pause',
        });
        harness.game.onPause();
        harness.advance(0.3);
        const cmds = render(harness);
        // T1 纸面板投影（shadowInk @ 面板 α）——旧版面板底无投影 ⇒ 新腿
        expect(
            cmds.some((c) => c.kind === 'rect' && c.fill === withAlpha(DEFAULT_PALETTE.shadowInk, UI_CONTAINER.shadowAlphaPanel)),
            '暂停面板 = drawPaperPanel（暖墨投影）',
        ).toBe(true);
        // 同一 #8A5B34 fill：旧版仅主钮 1 枚（accentPrimary），新版主钮木化 + ≥1 枚选中 chip ⇒ ≥2
        const woodRects = cmds.filter((c) => c.kind === 'rect' && c.fill === DEFAULT_PALETTE.woodFace);
        expect(woodRects.length, '主钮木化 + 至少一枚选中 chip 木底').toBeGreaterThanOrEqual(2);
    });

    it('fail：续时主钮禁用态（watchingAd）走 woodFaceDisabled，旧 α0.35 蒙版 hack 退出', () => {
        const harness = createBeadsHarness({
            noAssemble: true,
            levels: [simpleTestLevel()],
            saveKey: 'wxgame.beads.test.ep12-s4-fail',
        });
        let guard = 0;
        while (harness.game.phase === 'playing' && guard++ < 20000) harness.advance(0.5);
        expect(harness.game.phase).toBe('game-over');
        const revive = failPanelLayout(true).buttons.find((b) => b.id === 'revive')!;
        harness.game.tapDesign(
            (revive.rect.xMin + revive.rect.xMax) / 2,
            (revive.rect.yMin + revive.rect.yMax) / 2,
        );
        expect(harness.game.snapshot.watchingAd).toBe(true);
        const cmds = render(harness);
        expect(
            cmds.some((c) => c.kind === 'rect' && c.fill === DEFAULT_PALETTE.woodFaceDisabled),
            '禁用面 woodFaceDisabled（可点性消失双通道之一）',
        ).toBe(true);
        expect(
            cmds.some((c) => c.kind === 'rect' && c.fill === withAlpha(DEFAULT_PALETTE.panel, 0.35)),
            '旧 α0.35 蒙版 hack 已移除',
        ).toBe(false);
    });
});

// ───────────────────────── [EP12-S6] 主菜单橱窗（木框 + 纸底 + 作品格/空槽）色值消费面

/**
 * 橱窗夹具：只入**最小数据**（`wallSlots = [0]` ⇒ 槽 0 = 已解锁纸格、其余格越界成空槽），
 * 因此本文件**不拷贝九关陈列序**（那条判据只在 `meta-menu-wall.test.ts` 钉一份）。
 */
function menuShellCmds(currentLevelIndex: number): readonly DrawCommand[] {
    const data: MetaViewData = {
        stamina: 5,
        staminaMax: 5,
        coins: 0,
        overlay: 'none',
        signinDay: 0,
        canClaim: false,
        bgmMuted: false,
        sfxMuted: false,
        reduceMotion: false,
        largeText: false,
        vibrate: true,
        debugInfo: false,
        beadStyle: 'facet-4',
        beadSize: 'full',
        skinId: 'tokens',
        levelCount: 9,
        currentLevelIndex,
        maxUnlockedLevel: 1,
        starsByLevel: [3, 2, 1, 0, 0, 0, 0, 0, 0],
        wallSlots: [0],
        // EP12-S6 · T-2B：珠拼缩略需关卡本体（与 `wallSlots` 同序同长）；本文件只钉 token 色消费面，
        // ⛔ 不在这里反推缩略口径（那条判据只在 `menu-thumb-primitives.test.ts` 钉一份）。
        wallLevels: [LEVELS[0]],
    };
    const builder = new RenderModelBuilder(750, 1334);
    builder.begin();
    buildMetaView(builder, data, DEFAULT_PALETTE);
    return builder.end().commands;
}

/** 作品格热区矩形（取几何 ⇒ 反推框带；⛔ 不依赖视图私有常量）。 */
function wallBoxes() {
    return metaLayout('none')
        .buttons.filter((b) => b.id === 'pick-level')
        .map((b) => b.box);
}

describe('[EP12-S6] 主菜单橱窗·木框与纸底消费既有 token（⛔ 零新 hex）', () => {
    it('框带尺寸 = 作品格包围盒外扩 `WALL_FRAME_INSET`；木面 = wood_face', () => {
        const boxes = wallBoxes();
        const minX = Math.min(...boxes.map((b) => b.x));
        const maxX = Math.max(...boxes.map((b) => b.x + b.w));
        const minY = Math.min(...boxes.map((b) => b.y));
        const maxY = Math.max(...boxes.map((b) => b.y + b.h));
        const frame = menuShellCmds(4).find(
            (c) =>
                c.kind === 'rect' &&
                c.fill === DEFAULT_PALETTE.woodFace &&
                c.x === minX - WALL_FRAME_INSET &&
                c.w === maxX - minX + 2 * WALL_FRAME_INSET,
        );
        expect(frame, '木框 = wood_face（art-bible §3.1 T3 木语言，⛔ 不新造木色）').toBeDefined();
        expect((frame as { y: number }).y).toBe(minY - WALL_FRAME_INSET);
        expect((frame as { h: number }).h).toBe(maxY - minY + 2 * WALL_FRAME_INSET);
    });

    it('T3 三线：底缘承重线 = wood_edge(2px) / 顶缘受光线 = wood_sheen(1px) / 纸底 = panel + panel_border(1px)', () => {
        const cmds = menuShellCmds(4);
        const edge = cmds.find((c) => c.kind === 'line' && c.stroke === DEFAULT_PALETTE.woodEdge);
        const sheen = cmds.find((c) => c.kind === 'line' && c.stroke === DEFAULT_PALETTE.woodSheen);
        expect(edge, '框底缘读 wood_edge').toBeDefined();
        expect((edge as { lineWidth: number }).lineWidth).toBe(UI_CONTAINER.strokeWoodEdge);
        expect(sheen, '框顶缘读 wood_sheen').toBeDefined();
        expect((sheen as { lineWidth: number }).lineWidth).toBe(UI_CONTAINER.strokeSheen);
        const paper = cmds.find(
            (c) =>
                c.kind === 'rect' &&
                c.fill === DEFAULT_PALETTE.panel &&
                c.stroke === DEFAULT_PALETTE.panelBorder &&
                c.lineWidth === UI_CONTAINER.strokePanel,
        );
        expect(paper, '纸底 = 暖纸白 + 暖沙 1px（tokens.md §1，与面板族同值）').toBeDefined();
    });

    it('作品格 = slot/slot_border 纸格，当前关描边 = accent_primary(4px)；空槽虚线 = slot_dashed', () => {
        // 非当前关（current=4）：槽 0 纸格走 slot_border。
        const idle = menuShellCmds(4);
        const plain = idle.find(
            (c) =>
                c.kind === 'rect' &&
                c.fill === DEFAULT_PALETTE.slot &&
                c.stroke === DEFAULT_PALETTE.slotBorder &&
                c.w === wallBoxes()[0]!.w,
        );
        expect(plain, '已解锁非当前格 = slot 面 + slot_border 描边').toBeDefined();
        // 当前关（current=0）：同格改读 accent_primary（= wood_face 同值不同名判例）。
        const cur = menuShellCmds(0);
        const hi = cur.find(
            (c) =>
                c.kind === 'rect' &&
                c.stroke === DEFAULT_PALETTE.accentPrimary &&
                c.w === wallBoxes()[0]!.w,
        );
        expect(hi, '当前关高亮描边 = accent_primary').toBeDefined();
        expect((hi as { lineWidth: number }).lineWidth).toBe(4);
        // 未解锁 / 越界格 = 虚线空槽，虚线色 = tokens.md §1 `slot_dashed`（⛔ 不新造灰）。
        const dashed = menuShellCmds(4).filter((c) => c.kind === 'line' && c.stroke === DEFAULT_PALETTE.slotDashed);
        expect(dashed.length, '空槽虚线段在场').toBeGreaterThan(0);
        expect(DEFAULT_PALETTE.slotDashed, 'slot_dashed 定稿值未漂（§1 扩展行虚线）').toBe('#C9C5DA');
    });
});
