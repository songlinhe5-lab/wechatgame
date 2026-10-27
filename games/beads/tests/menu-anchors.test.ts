/**
 * WXG-T-280 · P-6 — 菜单锚定链 `menuAnchors()` 的五档验收账 + 不变式（落地单 §2/§4）。
 *
 * 判据真源（⛔ 本文件零新数值）：
 *  - `games/beads/design/art/specs/menu-layout-implementation-spec.md` §4 五档验收账
 *    （gapTop/gapBot 设计 px 逐档对表）与 §2 链式算式（不变式即链式的代数重述）；
 *  - `games/beads/src/config/tuning.ts` `menuAnchors` 顶部注释：接口优先语义（0 = 合法值，
 *    仅 `null` 走 `SAFE_TOP_H`/`SAFE_BOTTOM_H` 兜底，判例 K-124）。
 *
 * 母本 = `temp/menu-landing/anchors-check.mts`（落地期一次性自检脚本），此处为常驻化。
 */

import { describe, expect, it } from 'vitest';
import { menuAnchors, MENU_CTA_H, SIGN_BAND_PAD, TOUCH_MIN } from '../src/config/tuning.js';
import type { MenuAnchorsInput } from '../src/config/tuning.js';
import { anchoredGeo, inBox } from '../src/view/meta-layout.js';

/** st/cap/sb = **dp 原值**（×k 后应落 §4 表的设计 px）。 */
const TIERS = [
    // v3.7：招牌缩至 370×240（链 165）+ 资源条嵌窗顶（组高 871）后的五档账（真值由公式算出，见 tuning 注释）。
    { name: 'SE', st: 20, cap: 56, sb: 0, wW: 375, H: 1334, gap: [38, 75] },
    { name: 'Android 挖孔', st: 29, cap: 64, sb: 0, wW: 360, H: 1625, gap: [130, 259] },
    { name: 'X-14', st: 47, cap: 80, sb: 34, wW: 375, H: 1624, gap: [95, 191] },
    { name: '灵动岛', st: 54, cap: 83, sb: 34, wW: 393, H: 1626, gap: [94, 188] },
    { name: '16 Pro Max', st: 54, cap: 90, sb: 34, wW: 440, H: 1630, gap: [101, 203] },
] as const;

const toInput = (t: (typeof TIERS)[number]): MenuAnchorsInput => ({
    safeTopDp: t.st,
    capsuleBottomDp: t.cap,
    safeBottomDp: t.sb,
    windowWidthDp: t.wW,
    designHeight: t.H,
});

/** y-down 量的换算：输出已翻 y-up（原点左下），从顶深度的量 = H − 字段。 */
const fromTop = (H: number, yUp: number) => H - yUp;

describe('menuAnchors · 五档验收账（落地单 §4）', () => {
    for (const t of TIERS) {
        it(`${t.name}：gapTop/gapBot 对表 + 不变式①②⑤`, () => {
            const a = menuAnchors(toInput(t));
            expect(Math.round(a.gapTop)).toBe(t.gap[0]);
            expect(Math.round(a.gapBot)).toBe(t.gap[1]);

            // ① 链闭合：case 底缘 → gapBot → CTA → 底隙 32 → sb 恰好铺到 H。
            const caseFromTop = fromTop(a.H, a.caseBotY);
            expect(caseFromTop + a.gapBot + MENU_CTA_H + 32 + a.sb).toBeCloseTo(a.H, 9);
            // ② 比例隙：gapBot = 2×gapTop（钳未触发档，浮点域精确）。
            expect(a.gapBot).toBeCloseTo(2 * a.gapTop, 9);
            // ⑤a 资源条嵌窗顶（v3.6）：条顶 = 橱窗顶（条覆盖楣的上 46 px，不占堆叠高度）。
            expect(fromTop(a.H, a.caseTopY)).toBeCloseTo(fromTop(a.H, a.barTopY), 9);
            // ⑤b 板底组隙下限：bar ≥ sign1 + SIGN_BAND_PAD。
            expect(fromTop(a.H, a.barTopY)).toBeGreaterThanOrEqual(fromTop(a.H, a.signBotY) + SIGN_BAND_PAD - 1e-9);
        });
    }
});

describe('menuAnchors · 接口优先语义与 fallback（tuning 注释口径）', () => {
    it('0 是合法接口值（SE/Android sb=0 进链），不触发兜底', () => {
        const a = menuAnchors({
            safeTopDp: 20, capsuleBottomDp: 56, safeBottomDp: 0,
            windowWidthDp: 375, designHeight: 1334,
        });
        expect(a.sb).toBe(0); // 兜底会是 SAFE_BOTTOM_H=68
        expect(a.H).toBe(1334);
    });

    it('null（web/node 无接口）⇒ SAFE_TOP_H/SAFE_BOTTOM_H 兜底 + gapTop 钳 ≥ SIGN_BAND_PAD 不穿模', () => {
        const fb = menuAnchors({
            safeTopDp: null, capsuleBottomDp: null, safeBottomDp: null,
            windowWidthDp: 0, designHeight: 0,
        });
        expect(fb.gapTop).toBe(SIGN_BAND_PAD); // 钳位生效（raw 为负）
        expect(fb.H).toBe(1334); // designHeight ≤0 ⇒ DESIGN_H 兜底
        // 退化档 gapBot 可为负（zone < 917）⇒ 只钉「CTA 不越屏底」这条底线。
        expect(fb.ctaBotY).toBeGreaterThanOrEqual(0);
    });
});

/**
 * `[WXG-T-448]` 底隙响应带（用户令 2026-10-27：「视觉不动，只是事件响应区域要覆盖除了安全区域
 * 的范围，这样所有在安全区域的范围都可以响应点击事件」）。
 *
 * 判据 = 三条，逐档钉死：
 *  ① 热区下沿**贴安全区上沿**（`= sb`）⇒ 底隙 32 设计 px 不再是死带；
 *  ② **视觉框一个像素都不动**（`ctaBox.y` 仍 `ctaBotY`、`rankBox.y` 仍 `ctaBotY + 2`，高度仍 92/88）
 *     ⇒ 「视觉不动」是硬约束，⛔ 不得为补热区去挪绘制；
 *  ③ 热区 ⊇ 视觉框，且**安全区内不响应**（home 条手势区不得被抢）。
 */
describe('`[WXG-T-448]` 底隙响应带（热区下探到安全区上沿）', () => {
    for (const t of TIERS) {
        it(`${t.name}：下沿 = sb · 视觉框零改动 · 覆盖视觉 · 安全区内不命中`, () => {
            const a = menuAnchors(toInput(t));
            const g = anchoredGeo(a);
            const sb = Math.round(a.sb);
            const ctaBot = Math.round(a.ctaBotY);

            // ① 下沿贴安全区上沿（两颗钮同一个下沿）。
            expect(g.ctaHit.y).toBe(sb);
            expect(g.rankHit.y).toBe(sb);
            expect(g.ctaHit.h).toBe(g.rankHit.h);

            // ② 视觉框零改动。
            expect(g.ctaBox.y).toBe(ctaBot);
            expect(g.ctaBox.h).toBe(MENU_CTA_H);
            expect(g.rankBox.y).toBe(ctaBot + 2);
            expect(g.rankBox.h).toBe(TOUCH_MIN);

            // ③ 上沿**逐值不变**（本改只向下加长，不动既有命中边）：
            //    CTA 热区上沿本就是视觉框上下各内缩 2 设计 px ⇒ 上沿 = ctaBox.y + 90；
            //    好友榜热区上沿与视觉框上沿重合 ⇒ 完全覆盖。
            expect(g.ctaHit.y + g.ctaHit.h).toBe(g.ctaBox.y + (MENU_CTA_H - TOUCH_MIN) / 2 + TOUCH_MIN);
            expect(g.rankHit.y + g.rankHit.h).toBe(g.rankBox.y + g.rankBox.h);
            // 下沿覆盖视觉框下沿（热区 ⊇ 视觉的下半段 + 整条底隙）。
            expect(g.ctaHit.y).toBeLessThanOrEqual(g.ctaBox.y);
            expect(g.rankHit.y).toBeLessThanOrEqual(g.rankBox.y);

            // ③ 安全区内不响应（sb>0 的档才有这条带）。
            if (sb > 0) {
                expect(inBox(g.ctaHit, g.ctaBox.x + 10, sb - 1)).toBe(false);
                expect(inBox(g.rankHit, g.rankBox.x + 10, sb - 1)).toBe(false);
            }
            // 底隙带内必响应（下沿往上一格 = 响应）。
            expect(inBox(g.ctaHit, g.ctaBox.x + 10, sb + 1)).toBe(true);
            expect(inBox(g.rankHit, g.rankBox.x + 10, sb + 1)).toBe(true);
        });
    }
});
