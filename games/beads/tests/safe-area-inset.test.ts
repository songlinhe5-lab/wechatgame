/**
 * **[WXG-T-265 ①iii]** 单边安全偏移纯函数判据套（顶栏胶囊避让 + 底部 Home Indicator 避让）。
 * ─────────────────────────────────────────────────────────────────────────────
 * 真源：`games/beads/design/art/proposals/ui-style-redesign/menu-architecture.md` **§5.1b-2**（裁定 B 规则式）
 *      + `design/gdd/systems-index.md §3.1`（`SAFE_TOP_H` 120 / `SAFE_BOTTOM_H` 68 = **fallback**，v1.75）；
 * 实现 = `src/config/tuning.ts::safeEdgeInset`（纯函数，不 import `cc`/`wx` ⇒ L2/L3）。
 *
 * ## 本套盯的三个失败模式
 * 1. **单位混用**：把 dp 当设计 px 直接相加 ⇒ 在 375 dp 机上少让 1 倍，钮仍被胶囊压住。
 *    ⇒ 腿 1 用**逐机档**钉死（116/137/164/176/161），任何一次换算漏乘/多乘都会翻车。
 * 2. **兜底返 0**：web / node / 机型不返 `safeArea` 时返 0 ⇒ 控件贴屏幕边，harness 与真机两套观感。
 *    ⇒ 腿 2 锁「退化 = fallback 带 + 余量」，且明确 **≠ 0**。
 * 3. **宏当家**（v1.75 根因判例）：旧式 `max(floor, 接口换算)` 会让静态宏在真机上赢过接口
 *    ⇒ 非刘海档 112 被 120 顶到 124、Pro Max 底部 59 被 68 顶到 72，接口说了不算。
 *    ⇒ 腿 3 跑**两条**：不变式（结果 ≥ 胶囊底换算，永不与胶囊相交）+ **相等式**
 *    （接口有效时结果 **严格等于** 接口换算 + 余量，fallback 不得参与）。
 *
 * 数值来源：iOS 状态栏/胶囊几何与 Home Indicator 34 dp 的公开实测（见 §5.1b-1 调研注），
 * 胶囊尺寸恒定 87×32 dp、`top = 状态栏 + 4` ⇒ 底缘 dp 逐机 56 / 64 / 83 / 90。
 */
import { describe, expect, it } from 'vitest';
import {
    DESIGN_W, SAFE_TOP_H, SAFE_BOTTOM_H, SAFE_EDGE_MARGIN, safeEdgeInset,
    MENU_TOPBAR_TOP_FALLBACK, menuTopbarTop,
} from '../src/config/tuning.js';

/** 顶栏：`edgeDp` = 胶囊底缘（接口值），`fallbackH` = SAFE_TOP_H。 */
const topbar = (capsuleBottomDp: number, windowWidthDp: number): number =>
    safeEdgeInset(capsuleBottomDp, windowWidthDp, SAFE_TOP_H);
/** 底部：`edgeDp` = safeAreaBottom（接口值），`fallbackH` = SAFE_BOTTOM_H。 */
const bottom = (insetDp: number, windowWidthDp: number): number =>
    safeEdgeInset(insetDp, windowWidthDp, SAFE_BOTTOM_H);

describe('safeEdgeInset — 顶栏（裁定 B 逐机档）', () => {
    // 屏宽 dp / 胶囊底缘 dp -> 期望设计 px（自顶向内）
    const CASES: readonly { label: string; wdp: number; capsule: number; want: number }[] = [
        { label: 'iPhone SE/6/7/8（非刘海）', wdp: 375, capsule: 56, want: 116 },
        { label: 'Android 主流全面屏', wdp: 360, capsule: 64, want: 137 },
        { label: 'iPhone X（44 dp 状态栏）', wdp: 375, capsule: 80, want: 164 },
        { label: 'iPhone 12/13/14（47 dp）', wdp: 390, capsule: 83, want: 164 },
        { label: '灵动岛 14/15 Pro·16（54 dp）', wdp: 393, capsule: 90, want: 176 },
        { label: 'Pro Max 档（430 dp）', wdp: 430, capsule: 90, want: 161 },
    ];
    for (const c of CASES) {
        it(`${c.label} -> ${c.want} 设计px`, () => {
            expect(topbar(c.capsule, c.wdp)).toBe(c.want);
        });
    }

    it('接口有效 ⇒ 结果严格等于胶囊底换算 + 余量（fallback 宏不得参与，v1.75 证伪旧 max 语义）', () => {
        // 非刘海档：胶囊底 56 dp @375 = 112 设计px < SAFE_TOP_H 120。
        // 旧式 max 会取 124（宏赢）⇒ 现式必须给 116（接口赢）。这是本批改语义的唯一可观测差值。
        expect(topbar(56, 375)).toBe(112 + SAFE_EDGE_MARGIN);
        expect(topbar(56, 375)).not.toBe(SAFE_TOP_H + SAFE_EDGE_MARGIN);
    });

    it('无 wx（胶囊拿不到）⇒ 才用 fallback，与定稿图口径 124 一致', () => {
        expect(topbar(0, 375)).toBe(SAFE_TOP_H + SAFE_EDGE_MARGIN);
    });

    it('不变式：任何档位结果都 ≥ 胶囊底换算值 + 余量（顶栏永不与胶囊相交）', () => {
        for (const c of CASES) {
            const capsuleDesignPx = (c.capsule * DESIGN_W) / c.wdp;
            expect(topbar(c.capsule, c.wdp)).toBeGreaterThanOrEqual(capsuleDesignPx);
        }
    });

    it('单调性：同一 dp 遮挡，屏越窄 -> 设计 px 越大（换算方向不得反）', () => {
        expect(topbar(90, 360)).toBeGreaterThan(topbar(90, 430));
    });
});

describe('safeEdgeInset — 底部（Home Indicator / 导航栏）', () => {
    it('iOS 全面屏 34 dp @375 -> 72（接口换算 68 + 余量）', () => {
        expect(bottom(34, 375)).toBe(72);
    });
    it('iOS 34 dp @430（Pro Max）-> 63（接口换算 59，宏不再顶高）', () => {
        expect(bottom(34, 430)).toBe(59 + SAFE_EDGE_MARGIN);
        expect(bottom(34, 430)).not.toBe(SAFE_BOTTOM_H + SAFE_EDGE_MARGIN);
    });
    it('Android 三键导航栏 48 dp @360 -> 104（高于任何兜底值 ⇒ 只能从接口拿）', () => {
        expect(bottom(48, 360)).toBe(104);
    });
    it('非刘海 iOS（接口 inset 0）-> 走兜底 72，不得为 0', () => {
        expect(bottom(0, 375)).toBe(72);
    });
    it('Android targetSdk 35/36 实测 BUG（safeArea.bottom == screenHeight ⇒ inset 算成 0）-> 走兜底', () => {
        // 接口脏值等价于 0 ⇒ 同走 fallback；这条是本批保留兜底值的唯一理由。
        expect(bottom(0, 407)).toBe(SAFE_BOTTOM_H + SAFE_EDGE_MARGIN);
    });
});

describe('safeEdgeInset — 退化与防御', () => {
    it('拿不到屏宽（windowWidthDp = 0 / NaN）-> 退化为兜底带 + 余量，不返回 0、不出 NaN', () => {
        expect(topbar(90, 0)).toBe(SAFE_TOP_H + SAFE_EDGE_MARGIN);
        expect(topbar(90, Number.NaN)).toBe(SAFE_TOP_H + SAFE_EDGE_MARGIN);
        expect(bottom(34, Number.NaN)).toBe(SAFE_BOTTOM_H + SAFE_EDGE_MARGIN);
    });
    it('遮挡值为负（脏数据）-> 同样退化，不得把控件推到屏外', () => {
        expect(topbar(-10, 390)).toBe(SAFE_TOP_H + SAFE_EDGE_MARGIN);
    });
    it('harness / web 无 wx：胶囊与 inset 均 0 -> 顶 124 / 底 72（走兜底档）', () => {
        expect(topbar(0, 0)).toBe(124);
        expect(bottom(0, 0)).toBe(72);
        // ~~旧注「与真机非刘海档一致」~~ ⇒ **v1.75 后作废**：非刘海真机走接口换算 112 + 4 = **116**，
        // 124 现在**只在无接口值时出现**（定稿图版面基准）。
        expect(topbar(56, 375)).not.toBe(topbar(0, 375));
    });
});

describe('menuTopbarTop — 顶栏 wrapper（接口原值直喂，⛔ 不留第二份换算）', () => {
    it('`capsuleBottomDp = null`（适配层无接口值的唯一写法）⇒ 逐字等于兜底档 124', () => {
        expect(menuTopbarTop(null, 390)).toBe(MENU_TOPBAR_TOP_FALLBACK);
        expect(MENU_TOPBAR_TOP_FALLBACK).toBe(SAFE_TOP_H + SAFE_EDGE_MARGIN);
    });
    it('接口有值 ⇒ 只信接口，且与纯函数腿**同一读数**（顶栏不另算一份）', () => {
        expect(menuTopbarTop(56, 375)).toBe(topbar(56, 375)); // 非刘海 116
        expect(menuTopbarTop(90, 393)).toBe(topbar(90, 393)); // 灵动岛 176
        expect(menuTopbarTop(90, 393)).toBe(176);
    });
    it('适配层若拿 0 当「未知」⇒ 仍归一到兜底档（与 `null` 同路 ⇒ 契约可验）', () => {
        expect(menuTopbarTop(0, 390)).toBe(MENU_TOPBAR_TOP_FALLBACK);
    });
});
