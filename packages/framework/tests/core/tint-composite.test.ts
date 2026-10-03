import { describe, expect, it } from 'vitest';
import { compositeTintMask, parseTintColor } from '../../src/core/bake/tint-composite.js';

/**
 * `[WXG-T-226 EP12-B3]` tint 合成数学的判据。
 *
 * 期望值取自**定稿 py 公式**（`tools/mask-preview/preview-combined.py:29-36`，
 * `out = base·d + (1−base)·l·shape`，`alpha = shape`）的独立实算 ⇒ 本测试是
 * 「TS 运行时合成」对「py 资产侧真源」的交叉校验，不是同义反复。
 */

const CREAM: [number, number, number] = [0xfd, 0xf6, 0xe9];
const CHARCOAL: [number, number, number] = [0x33, 0x33, 0x3d];

/** 单像素 RGBA（`A` 恒 255：ADR-0028 §2.1「A=255 满幅」）。 */
function px(d: number, l: number, shape: number): number[] {
  return [d, l, shape, 255];
}

function composite1(m: number[], rgb: [number, number, number]): number[] {
  const dst = new Uint8ClampedArray(4);
  compositeTintMask(dst, new Uint8ClampedArray(m), { r: rgb[0], g: rgb[1], b: rgb[2] });
  return Array.from(dst);
}

describe('parseTintColor', () => {
  it('解析 #rrggbb（大小写皆可）', () => {
    expect(parseTintColor('#fdf6e9')).toEqual({ r: 253, g: 246, b: 233 });
    expect(parseTintColor('#FDF6E9')).toEqual({ r: 253, g: 246, b: 233 });
    expect(parseTintColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseTintColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('解析 #rgb（每位自我复制）', () => {
    expect(parseTintColor('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
    expect(parseTintColor('#000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('不可解析 ⇒ undefined（调用方跳过 blit，不抛）', () => {
    // ⛔ 关键字色 / rgba() / 8 位带 alpha / 空串一律不认：blit 契约里 alpha 走 `cmd.alpha` 字段
    expect(parseTintColor('red')).toBeUndefined();
    expect(parseTintColor('rgb(1,2,3)')).toBeUndefined();
    expect(parseTintColor('#fdf6e9ff')).toBeUndefined();
    expect(parseTintColor('#12345')).toBeUndefined();
    expect(parseTintColor('')).toBeUndefined();
  });
});

describe('compositeTintMask（与定稿 py 同式）', () => {
  it('d=1 且 l=0 ⇒ 逐字节等于本色（亮色珠纯本色像素，D1 修复后的应落值）', () => {
    expect(composite1(px(255, 0, 255), CREAM)).toEqual([253, 246, 233, 255]);
    expect(composite1(px(255, 0, 255), CHARCOAL)).toEqual([0x33, 0x33, 0x3d, 255]);
  });

  it('d=1 且 l=0.38 ⇒ base·1 + (1−base)·0.38（受光抬亮，py 实算 (254,249,241)）', () => {
    expect(composite1(px(255, 97, 255), CREAM)).toEqual([254, 249, 241, 255]);
  });

  it('d=0.56 且 l=0.38 ⇒ py 实算 cream (143,141,139) / charcoal (106,106,108)', () => {
    expect(composite1(px(143, 97, 255), CREAM)).toEqual([143, 141, 139, 255]);
    expect(composite1(px(143, 97, 255), CHARCOAL)).toEqual([106, 106, 108, 255]);
  });

  it('shape=0（孔区真透 · DEC-2）⇒ 全零含 RGB（防内预乘边缘晕影）', () => {
    expect(composite1(px(143, 97, 0), CREAM)).toEqual([0, 0, 0, 0]);
    expect(composite1(px(255, 255, 0), CREAM)).toEqual([0, 0, 0, 0]);
  });

  it('alpha 取 shape 通道（不是 mask 的 A）', () => {
    expect(composite1(px(143, 97, 128), CREAM)[3]).toBe(128);
    expect(composite1(px(143, 97, 1), CREAM)[3]).toBe(1);
  });

  it('逐像素独立处理一张 2×2 图（行主序）', () => {
    const mask = new Uint8ClampedArray([
      ...px(255, 97, 255), ...px(143, 97, 255),
      ...px(255, 0, 255), ...px(143, 97, 0),
    ]);
    const dst = new Uint8ClampedArray(mask.length);
    compositeTintMask(dst, mask, { r: CREAM[0], g: CREAM[1], b: CREAM[2] });
    expect(Array.from(dst)).toEqual([
      254, 249, 241, 255,
      143, 141, 139, 255,
      253, 246, 233, 255,
      0, 0, 0, 0,
    ]);
  });

  it('空 mask ⇒ 空 dst（不抛）', () => {
    const dst = new Uint8ClampedArray(0);
    expect(() => compositeTintMask(dst, new Uint8ClampedArray(0), { r: 1, g: 2, b: 3 })).not.toThrow();
  });
});
