/**
 * WXG-T-129 · 微信宿主触摸归一化行为测试（BD-48）—— **[WXG-T-161 勘误]**。
 *
 * ⚠ 本文件首版（T-129）的引擎模型是**错的**：它把 `windowSize.height` 当成
 * `wx.getWindowInfo().windowHeight`（逻辑 px），据「量纲混合」写了
 * `y = (windowHeight − raw.y) / dpr`，并断言 web 公式在微信输入上「必然出错」。
 * 2026-09-18 用构建产物 `cocos-js/cc.js` 的引擎源码实锤（`screenAdapter.windowSize
 * = windowSize × dpr` —— 翻转基准是**物理 px**）⇒ 正确逆变换与 web 分支**同形**：
 *   `clientX = raw.x / dpr`；`clientY = windowHeight − raw.y / dpr`。
 * 本文件随之改写：① `engineWxLocation` 复现**真实**引擎式；② 判别力反例改为
 * 「T-129 旧式在同一输入上得出错值」（而不是 web 公式出错）；③ 增补「wx 分支
 * ≡ web 分支」等价性钉子，防止两分支再次各自漂移。
 */

import { describe, expect, it } from 'vitest';
import {
  normalizeCocosTouch,
  normalizeCocosTouchWx,
} from '../../src/adapters/cocos/touch-normalize.js';

/**
 * 复现引擎微信适配（与 `pal/input/minigame/touch-input.ts` 逐字对应）：
 * `windowSize = windowSize(逻辑) × dpr`（`screenAdapter.windowSize`）。
 */
function engineWxLocation(
  clientX: number,
  clientY: number,
  windowHeight: number,
  dpr: number,
): { x: number; y: number } {
  return { x: clientX * dpr, y: windowHeight * dpr - clientY * dpr };
}

/** 真机典型参数：iPhone 逻辑 390×844、dpr 3、设计竖屏。 */
const H = 844;
const DPR = 3;

/** WXG-T-129 的旧实现（错误式），留作判别力反例的对照实现。 */
function legacyWxFormula(rawY: number, windowHeight: number, dpr: number): number {
  return (windowHeight - rawY) / dpr;
}

describe('WXG-T-129/162 · normalizeCocosTouchWx（BD-48 微信宿主触摸归一化）', () => {
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

  it('T-129 旧式 (H − raw.y)/dpr 在同一输入上得出错值 ⇒ 本次修正有必要（判别力反例）', () => {
    const cx = 140;
    const cy = 760; // 真机点托盘珠一带的屏幕逻辑位置
    const loc = engineWxLocation(cx, cy, H, DPR);
    const legacy = legacyWxFormula(loc.y, H, DPR);
    // 旧式偏差 = −H·(dpr−1)/dpr = −562.67 ⇒ 恒落屏外（点击全失效的真因）
    expect(legacy).not.toBeCloseTo(cy, 3);
    expect(legacy).toBeCloseTo(cy - (H * (DPR - 1)) / DPR, 6);
    const viaWx = normalizeCocosTouchWx(loc, { canvasHeightCss: H, dpr: DPR, windowHeight: H });
    expect(viaWx.x).toBeCloseTo(cx, 9);
    expect(viaWx.y).toBeCloseTo(cy, 9);
  });

  it('wx 分支 ≡ web 分支（引擎量纲一致 ⇒ 两分支数学同形，防各自漂移）', () => {
    for (const dpr of [1, 2, 3]) {
      for (const [cx, cy] of [
        [0, 0],
        [195, 422],
        [390, 844],
      ] as Array<[number, number]>) {
        const loc = engineWxLocation(cx, cy, H, dpr);
        const viaWx = normalizeCocosTouchWx(loc, { canvasHeightCss: H, dpr, windowHeight: H });
        const viaWeb = normalizeCocosTouch(loc, { canvasHeightCss: H, dpr });
        expect(viaWx.x).toBeCloseTo(viaWeb.x, 9);
        expect(viaWx.y).toBeCloseTo(viaWeb.y, 9);
      }
    }
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
