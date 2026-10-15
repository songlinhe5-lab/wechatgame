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
import { menuAnchors, MENU_CTA_H, SIGN_BAND_PAD } from '../src/config/tuning.js';
import type { MenuAnchorsInput } from '../src/config/tuning.js';

/** st/cap/sb = **dp 原值**（×k 后应落 §4 表的设计 px）。 */
const TIERS = [
    { name: 'SE', st: 20, cap: 56, sb: 0, wW: 375, H: 1334, gap: [19, 38] },
    { name: 'Android 挖孔', st: 29, cap: 64, sb: 0, wW: 360, H: 1625, gap: [109, 219] },
    { name: 'X-14', st: 47, cap: 80, sb: 34, wW: 375, H: 1624, gap: [75, 150] },
    { name: '灵动岛', st: 54, cap: 83, sb: 34, wW: 393, H: 1626, gap: [74, 147] },
    { name: '16 Pro Max', st: 54, cap: 90, sb: 34, wW: 440, H: 1630, gap: [81, 162] },
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
            // ⑤a 资源条↔橱窗一体缝 0：case 顶缘 = bar 底缘 + MENU_BAR_H(46)。
            expect(fromTop(a.H, a.caseTopY)).toBeCloseTo(fromTop(a.H, a.barTopY) + 46, 9);
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
