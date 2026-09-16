/**
 * WXG-T-129 · 微信宿主触摸归一化行为测试（BD-48）。
 *
 * 引擎微信适配的坐标是**量纲混合态**（pal/input/minigame/touch-input.ts:86-90：
 * `x = clientX × dpr`；`y = windowSize.height − clientY × dpr`，其中 windowSize
 * 是逻辑 px 而 clientY×dpr 是物理 px）。本测试复现该混合式、验证
 * `normalizeCocosTouchWx` 能把它精确逆变换回框架契约空间（屏幕逻辑 px · 左上
 * 原点），并用**旧 web 公式在同一输入上得出错值**证明本分支的必要性（判别力）。
 */

import { describe, expect, it } from 'vitest';
import {
  normalizeCocosTouch,
  normalizeCocosTouchWx,
} from '../../src/adapters/cocos/touch-normalize.js';

/** 复现引擎微信适配的混合式（与 pal/input/minigame/touch-input.ts:86-90 逐字对应）。 */
function engineWxLocation(
  clientX: number,
  clientY: number,
  windowHeight: number,
  dpr: number,
): { x: number; y: number } {
  return { x: clientX * dpr, y: windowHeight - clientY * dpr };
}

/** 真机典型参数：iPhone 逻辑 390×844、dpr 3、设计竖屏。 */
const H = 844;
const DPR = 3;

describe('WXG-T-129 · normalizeCocosTouchWx（BD-48 微信宿主触摸归一化）', () => {
  it('逆变换精确还原 wx 原始 clientX/clientY（屏幕逻辑 px · 左上原点）', () => {
    // 屏幕四角 + 中心（逻辑 px，左上原点）
    const points: Array<[number, number]> = [
      [0, 0],
      [390, 844],
      [195, 422],
      [390, 0],
      [0, 844],
    ];
    for (const [cx, cy] of points) {
      const loc = engineWxLocation(cx, cy, H, DPR);
      const got = normalizeCocosTouchWx(loc, { canvasHeightCss: H, dpr: DPR, windowHeight: H });
      expect(got.x).toBeCloseTo(cx, 9);
      expect(got.y).toBeCloseTo(cy, 9);
    }
  });

  it('旧 web 公式在同一微信输入上得出错值 ⇒ wx 分支有必要（判别力反例）', () => {
    // 用户真机操作示例：点托盘珠（设计 y≈1150 对应的屏幕逻辑位置）
    const cx = 140;
    const cy = 760;
    const loc = engineWxLocation(cx, cy, H, DPR);
    const viaWeb = normalizeCocosTouch(loc, { canvasHeightCss: H, dpr: DPR });
    const viaWx = normalizeCocosTouchWx(loc, { canvasHeightCss: H, dpr: DPR, windowHeight: H });
    // web 公式（÷dpr 后再用 canvasHeightCss 翻 y）还原不出原始点击位置
    expect(viaWeb.y).not.toBeCloseTo(cy, 3);
    // wx 分支精确还原
    expect(viaWx.x).toBeCloseTo(cx, 9);
    expect(viaWx.y).toBeCloseTo(cy, 9);
  });

  it('space.dpr 非法（0/NaN）时退化处理不产出 NaN（与 web 分支同一纪律）', () => {
    // raw 由引擎以**正常** dpr 产出（引擎侧 dpr 读取失败不影响坐标本身）；
    // 非法 dpr 出现在宿主 space 侧 ⇒ 退化 dpr=1 只保证有限值，不保证正确对位。
    const loc = engineWxLocation(100, 400, H, 3);
    const got = normalizeCocosTouchWx(loc, { canvasHeightCss: H, dpr: Number.NaN, windowHeight: H });
    expect(Number.isFinite(got.x)).toBe(true);
    expect(Number.isFinite(got.y)).toBe(true);
    const zero = normalizeCocosTouchWx(
      engineWxLocation(100, 400, H, 3),
      { canvasHeightCss: H, dpr: 0, windowHeight: H },
    );
    expect(Number.isFinite(zero.x)).toBe(true);
    expect(Number.isFinite(zero.y)).toBe(true);
  });

  it('out 复用对象零分配路径行为一致', () => {
    const out = { x: -1, y: -1 };
    const loc = engineWxLocation(195, 422, H, DPR);
    const got = normalizeCocosTouchWx(loc, { canvasHeightCss: H, dpr: DPR, windowHeight: H }, out);
    expect(got).toBe(out);
    expect(got.x).toBeCloseTo(195, 9);
    expect(got.y).toBeCloseTo(422, 9);
  });
});
