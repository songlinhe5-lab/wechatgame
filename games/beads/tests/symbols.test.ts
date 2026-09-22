/**
 * Symbol channel — `art/assets-spec.md` §1.1（10 符号矢量定义）+ `art/accessibility.md`
 * A1（三重编码）/ A3（灰度可辨）/ B2（符号对珠面 ≥ 3:1）.
 *
 * Why this file exists: before it, the symbol channel was **not drawn at all** while
 * `accessibility.md` marked A1/A3/B2 as ✅ 落地 — the third, non-colour encoding was
 * missing, so colour-blind safety did not actually hold. These assertions pin it shut.
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import {
  SYMBOL_CONTRAST_MIN,
  SYMBOL_INK_DARK_MIX,
  SYMBOL_INK_LUMA_THRESHOLD,
  beadColorOf,
  DEMO_BEAD_INKS,
  luminance,
  mix,
} from '../src/view/palette.js';
import {
  BEAD_SYMBOLS,
  SYMBOL_MIN_STROKE,
  SYMBOL_SIZE_RATIO,
  beadSymbol,
  emitSymbol,
  symbolInk,
} from '../src/view/symbols.js';
import { BEAD_CELL, TRAY_SLOT } from '../src/config/tuning.js';

function builderFor(): RenderModelBuilder {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  return builder;
}

/** Commands emitted for one symbol at a given bead size. */
function commandsFor(colorIdx: number, size = BEAD_CELL) {
  const builder = builderFor();
  emitSymbol(builder, beadSymbol(colorIdx), 100, 200, size, '#123456');
  return builder.end().commands;
}

/** Largest axis-aligned extent spanned by a command list (design units). */
function extentOf(commands: ReturnType<typeof commandsFor>): number {
  let extent = 0;
  for (const cmd of commands) {
    if (cmd.kind === 'circle') extent = Math.max(extent, cmd.r * 2);
    if (cmd.kind === 'rect') extent = Math.max(extent, cmd.w, cmd.h);
    if (cmd.kind === 'polygon') {
      const xs = cmd.points.filter((_, i) => i % 2 === 0);
      const ys = cmd.points.filter((_, i) => i % 2 === 1);
      extent = Math.max(
        extent,
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      );
    }
  }
  return extent;
}

describe('beads symbol channel (assets-spec §1.1, accessibility A1/A3/B2)', () => {
  // A1 「10 色各绑唯一矢量符号」—— 绑定必须是一一映射，否则同一符号会出现在两种颜色上。
  it('A1 binds each of the 10 palette colours to a distinct symbol', () => {
    expect(BEAD_SYMBOLS).toHaveLength(10);
    expect(new Set(BEAD_SYMBOLS).size).toBe(10);
    const bySymbol = new Set<string>();
    for (let colorIdx = 1; colorIdx <= 10; colorIdx++) bySymbol.add(beadSymbol(colorIdx));
    expect(bySymbol.size).toBe(10);
  });

  // 越界索引与 beadColor() 的兜底一致（index 10 = 炭黑 ✚），避免「有颜色无符号」的珠子。
  it('falls back to the charcoal symbol (✚) for out-of-range indices', () => {
    expect(beadSymbol(0)).toBe(beadSymbol(10));
    expect(beadSymbol(999)).toBe(beadSymbol(10));
    expect(beadSymbol(Number.NaN)).toBe(beadSymbol(10));
    expect(beadSymbol(1)).toBe('ring');
    expect(beadSymbol(10)).toBe('cross');
  });

  // B2 硬地板：「符号对珠面 ≥ 3:1」—— 10 色全部必须达标，这是色盲可辨的前提。
  it('B2 gives every one of the 10 beads an ink at ≥ 3:1 contrast', () => {
    for (let colorIdx = 1; colorIdx <= 10; colorIdx++) {
      const base = beadColorOf(DEMO_BEAD_INKS, colorIdx);
      const ink = symbolInk(base);
      expect(ink.contrast, `${base} (${beadSymbol(colorIdx)})`).toBeGreaterThanOrEqual(
        SYMBOL_CONTRAST_MIN,
      );
    }
  });

  // §1.1 L5 阈值规则：亮度 > 0.6 → 深色墨。9 色按规则直取；**草绿是唯一例外**，
  // 其首选白墨仅 ≈2.4:1，故按 B2 地板翻转为深色墨。这条例外必须被显式钉住，
  // 否则未来有人「修正」阈值或墨色时会静默退回不可达。
  it('§1.1 L5 threshold decides the ink, with 草绿 as the single documented B2 exception', () => {
    const flipped: string[] = [];
    for (let colorIdx = 1; colorIdx <= 10; colorIdx++) {
      const base = beadColorOf(DEMO_BEAD_INKS, colorIdx);
      const preferDark = luminance(base) > SYMBOL_INK_LUMA_THRESHOLD;
      const ruleInk = preferDark ? mix(base, SYMBOL_INK_DARK_MIX) : undefined; // undefined = 白墨
      const actual = symbolInk(base);
      const isDark = ruleInk !== undefined && actual.color === ruleInk;
      const isLight = ruleInk === undefined && actual.color.startsWith('rgba(255,255,255');
      if (!isDark && !isLight) flipped.push(base);
    }
    expect(flipped).toEqual(['#3FBF6B']); // 草绿 — the only colour that had to flip
  });

  // §1.1「最小特征约束：符号线宽 ≥ 2px」—— 珠子尺寸最小处（托盘 44px）也必须成立。
  it('keeps every symbol stroke at or above the 2px floor at both bead sizes', () => {
    for (const size of [BEAD_CELL, TRAY_SLOT - 4]) {
      for (let colorIdx = 1; colorIdx <= 10; colorIdx++) {
        for (const cmd of commandsFor(colorIdx, size)) {
          if (cmd.kind === 'line') {
            expect(cmd.lineWidth, `colour ${colorIdx} @ ${size}`).toBeGreaterThanOrEqual(
              SYMBOL_MIN_STROKE,
            );
          }
          if (cmd.kind === 'circle' && cmd.lineWidth !== undefined) {
            expect(cmd.lineWidth).toBeGreaterThanOrEqual(SYMBOL_MIN_STROKE);
          }
        }
      }
    }
  });

  // §1.1「尺寸 BEAD×0.40」是**规格框**（26/64 ≈ 0.406）：每个符号必须落在框内，
  // 且至少一个真正用满它。逐符号的自身尺寸由 §1.1 的表单列，见下一条测试。
  it('fits every symbol inside the §1.1 40% box, with at least one reaching it', () => {
    const ratios: number[] = [];
    for (let colorIdx = 1; colorIdx <= 10; colorIdx++) {
      const ratio = extentOf(commandsFor(colorIdx, BEAD_CELL)) / BEAD_CELL;
      expect(ratio, `symbol ${beadSymbol(colorIdx)}`).toBeLessThanOrEqual(SYMBOL_SIZE_RATIO + 0.02);
      ratios.push(ratio);
    }
    expect(Math.max(...ratios)).toBeGreaterThanOrEqual(SYMBOL_SIZE_RATIO - 0.01);
  });

  // §1.1 符号矢量定义表：逐符号尺寸（64 参考帧 → 设计单位）。
  it('uses the per-symbol dimensions given in the §1.1 table', () => {
    const k = BEAD_CELL / 64; // 参考帧 → 设计单位
    expect(commandsFor(1)[0]).toMatchObject({ kind: 'circle', r: 13 * k }); // ○ 圆环 r=13
    expect(commandsFor(3)[0]).toMatchObject({ kind: 'circle', r: 11 * k }); // ● 实心圆 r=11

    const square = commandsFor(4)[0]!; // ■ 20×20
    expect(square.kind === 'rect' ? square.w : 0).toBeCloseTo(20 * k, 6);
    expect(square.kind === 'rect' ? square.h : 0).toBeCloseTo(20 * k, 6);

    const diamond = commandsFor(9)[0]!; // ◆ 对角线 26 / 16
    if (diamond.kind === 'polygon') {
      const xs = diamond.points.filter((_, i) => i % 2 === 0);
      const ys = diamond.points.filter((_, i) => i % 2 === 1);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(26 * k, 6);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(16 * k, 6);
    }

    const cross = commandsFor(10); // ✚ 两矩形 22×6 正交
    expect(cross[0]).toMatchObject({ kind: 'rect', w: 22 * k, h: 6 * k });
    expect(cross[1]).toMatchObject({ kind: 'rect', w: 6 * k, h: 22 * k });

    // ▽/▲ 边 24 —— 等边三角形外接圆半径 R 满足 side = R√3。
    const triangle = commandsFor(7)[0]!;
    if (triangle.kind === 'polygon') {
      const xs = triangle.points.filter((_, i) => i % 2 === 0);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(24 * k, 4);
    }
  });

  // §1.1 逐符号形状：每个符号至少一条指令；描边类（○ ◐）不得填充，填充类不得只有描边。
  it('emits each symbol with the primitive §1.1 specifies', () => {
    const counts = (colorIdx: number) => commandsFor(colorIdx).length;
    for (let colorIdx = 1; colorIdx <= 10; colorIdx++) {
      expect(counts(colorIdx), `symbol ${beadSymbol(colorIdx)}`).toBeGreaterThan(0);
    }

    // ○ 圆环 — stroke only, no fill.
    const ring = commandsFor(1);
    expect(ring).toHaveLength(1);
    expect(ring[0]).toMatchObject({ kind: 'circle' });
    expect(ring[0]!.kind === 'circle' && ring[0]!.stroke).toBe('#123456');
    expect(ring[0]!.kind === 'circle' && ring[0]!.fill).toBeUndefined();

    // ● 实心圆 — filled circle.
    expect(commandsFor(3)).toMatchObject([{ kind: 'circle', fill: '#123456' }]);

    // ■ 实心方 — rounded rect.
    expect(commandsFor(4)).toMatchObject([{ kind: 'rect', fill: '#123456', radius: expect.any(Number) }]);

    // ♥ 心形 — 双圆 + 下三角 → 2 circles then 1 polygon.
    const heart = commandsFor(5);
    expect(heart.map((c) => c.kind)).toEqual(['circle', 'circle', 'polygon']);

    // ◐ 半圆 — filled arc polygon + diameter line.
    const half = commandsFor(6);
    expect(half.map((c) => c.kind)).toEqual(['polygon', 'line']);

    // ▽/▲ 三角 — 3 vertices; apex down / up (y grows upward, so the apex is the min y).
    const triDown = commandsFor(7)[0]!;
    const triUp = commandsFor(8)[0]!;
    expect(triDown.kind === 'polygon' && triDown.points).toHaveLength(6);
    expect(triUp.kind === 'polygon' && triUp.points).toHaveLength(6);
    const lowestY = (cmd: typeof triDown) =>
      cmd.kind === 'polygon' ? Math.min(...cmd.points.filter((_, i) => i % 2 === 1)) : Number.NaN;
    expect(lowestY(triDown)).toBeLessThan(lowestY(triUp));

    // ◆ 菱形 — 4 vertices.
    const diamond = commandsFor(9)[0]!;
    expect(diamond.kind === 'polygon' && diamond.points).toHaveLength(8);

    // ✚ 十字 — two orthogonal bars (one wide, one tall).
    const cross = commandsFor(10);
    expect(cross.map((c) => c.kind)).toEqual(['rect', 'rect']);
    const [barH, barV] = [cross[0]!, cross[1]!];
    expect(barH.kind === 'rect' ? barH.w : 0).toBeGreaterThan(barH.kind === 'rect' ? barH.h : 0);
    expect(barV.kind === 'rect' ? barV.h : 0).toBeGreaterThan(barV.kind === 'rect' ? barV.w : 0);
  });

  // 纯函数：同一输入两次给出逐字节相同的指令序列（control-manifest §8 可复现）。
  it('is a pure function of its arguments', () => {
    for (let colorIdx = 1; colorIdx <= 10; colorIdx++) {
      expect(commandsFor(colorIdx)).toEqual(commandsFor(colorIdx));
    }
  });
});
