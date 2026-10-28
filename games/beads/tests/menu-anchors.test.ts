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
 * `[WXG-T-453]` **收回 `[WXG-T-448]` 的底隙下探**（用户 2026-10-27 拍板「完全收回」）：
 * 热区回归与视觉重合（上下各内缩 2 设计 px），`open-rank` 恢复「绘制/热区同对象」。
 *
 * 收回依据：当初下探是为补「按钮下半点不上」，真因后来钉死为 Cocos 节点命中的
 * letterbox 死区（`[WXG-T-451]` 全局 input 已修）⇒ 下探失去收益，只剩「框比按钮
 * 大一圈、点版本号带误触按钮」的代价。底隙 32 归版本号带（**不响应**）。
 *
 * 判据（逐档）：
 *  ① CTA 热区 = `ctaBotY+2` 起、高 `TOUCH_MIN`（T-448 前口径逐值还原）；
 *  ② `rankHit` 与 `rankBox` **同一对象**（绘制/热区同源守卫恢复）；
 *  ③ 底隙带（热区下沿之下）**不响应**；框内正常命中。
 */
describe('`[WXG-T-453]` 底部热区收回（与视觉重合）', () => {
    for (const t of TIERS) {
        it(`${t.name}：热区还原 T-448 前口径 · rankHit===rankBox · 底隙带不响应`, () => {
            const a = menuAnchors(toInput(t));
            const g = anchoredGeo(a);
            const ctaBot = Math.round(a.ctaBotY);

            // ① 还原 T-448 前口径：下缘 = 视觉下缘内缩 2，高 = TOUCH_MIN。
            expect(g.ctaHit.y).toBe(ctaBot + 2);
            expect(g.ctaHit.h).toBe(TOUCH_MIN);
            expect(g.ctaHit.y + g.ctaHit.h).toBe(ctaBot + 90);
            expect(g.ctaBox.y).toBe(ctaBot);
            expect(g.ctaBox.h).toBe(MENU_CTA_H);

            // ② 绘制/热区同对象（同源守卫保留）。
            // `WXG-T-487`（用户裁「把好友榜放到左上设计一个图标按钮，左上右上各两枚」）起
            // 好友榜自 CTA 左侧纸钮**上提为顶栏左上第二枚** ⇒ 旧断言
            // `rankHit.y === ctaBot + 2`（与 CTA 底缘同源）随该裁定作废，改为钉顶栏位：
            // x = `MENU_TOPBAR_X.rank`（24）、y = 设置钮 y − `MENU_TOPBAR_ROW2_DY`（88）。
            expect(g.rankHit).toBe(g.rankBox);
            expect(g.rankHit.h).toBe(TOUCH_MIN);
            expect(g.rankHit.w).toBe(TOUCH_MIN);
            expect(g.rankBox.x).toBe(24);
            expect(g.rankBox.y).toBe(g.settingsHit.y - 88);

            // ③ 底隙带（CTA 热区下沿之下、安全区上沿之上）不响应；框内正常命中。
            // rank 已不在底部 ⇒ 本段只对 CTA 生效（原先 rank 那两行随之退场）。
            const belowHit = ctaBot + 1;
            expect(inBox(g.ctaHit, g.ctaBox.x + 10, belowHit)).toBe(false);
            expect(inBox(g.ctaHit, g.ctaBox.x + 10, ctaBot + 40)).toBe(true);
        });
    }
});
