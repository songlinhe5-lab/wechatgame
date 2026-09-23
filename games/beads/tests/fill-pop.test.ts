/**
 * G1 `vfx_fill_pop` — 珠子落座回弹（WXG-T-128 美术 v1.4「动态质感章」首单）。
 *
 * 规格正本：`art/assets-spec.md` §1.6.1（逐帧公式 / clamp / D1 退化 / **层序死结论**）、
 * `art-bible.md` §7.3.1；毫秒真源 `design/ux/ux-spec.md` §5「珠子落座」行
 * （只冻结 `1.06→1.0` 与 `120ms`，谷值 0.96 与 40ms 分段是 art-owned 中间插值）。
 *
 * 本文件**只用纯函数与命令层断言**（不 import `helpers.ts`）——落座动画是表现层，
 * 不需要关卡 fixture；这也让 G1 的判据与 `bead-grid §8` 的玩法判据天然解耦。
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import { BEAD_CELL, BEAD_DRAW_INSET, BEAD_PITCH } from '../src/config/tuning.js';
import {
  FILL_POP_CONTACT_A_PEAK,
  FILL_POP_MS,
  FILL_POP_PRESS_MS,
  FILL_POP_SCALE_START,
  FILL_POP_SCALE_TROUGH,
  FILL_POP_SHADOW_A_TROUGH,
  FILL_POP_SHADOW_DY_MIN,
} from '../src/config/tuning.js';
import {
  BEAD_CARD,
  drawFilledBead,
  fillPopEnvelope,
  type FillPopEnvelope,
  type FilledBeadOptions,
} from '../src/view/bead-render.js';
import {
  BEAD_CONTACT_SHADOW_ALPHA,
  BEAD_SHADOW_ALPHA,
  BEAD_SHADOW_HEX,
  DEMO_BEAD_INKS,
  endpointOf,
  withAlpha,
} from '../src/view/palette.js';

const PRESS_P = FILL_POP_PRESS_MS / FILL_POP_MS; // 40/120 = 1/3

const fresh = (): FillPopEnvelope => ({
  scale: 1,
  contactAlpha: 0,
  contactWidth: 0,
  shadowAlpha: 0,
  shadowDy: 0,
});

/** 等距采样归一化进度（含端点）。 */
function samples(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(i / n);
  return out;
}

function emit(options: FilledBeadOptions) {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  drawFilledBead(builder, 100, 200, 1, options);
  return builder.end().commands;
}

describe('G1 vfx_fill_pop · 逐帧包络（assets-spec §1.6.1）', () => {
  it('三个关键相位取规格值：起点 1.06 → 谷 0.96@40ms → 终 1.00@120ms', () => {
    expect(fillPopEnvelope(0, false, fresh()).scale).toBeCloseTo(FILL_POP_SCALE_START, 6);
    expect(fillPopEnvelope(PRESS_P, false, fresh()).scale).toBeCloseTo(FILL_POP_SCALE_TROUGH, 6);
    expect(fillPopEnvelope(1, false, fresh()).scale).toBeCloseTo(1, 6);
  });

  it('t=120ms 全通道回静息 ⇒ 零残留（不得留任何偏移量）', () => {
    const env = fillPopEnvelope(1, false, fresh());
    expect(env.scale).toBeCloseTo(1, 9);
    expect(env.contactAlpha).toBeCloseTo(BEAD_CONTACT_SHADOW_ALPHA, 9);
    expect(env.contactWidth).toBeCloseTo(BEAD_CARD.contactW, 9);
    expect(env.shadowAlpha).toBeCloseTo(BEAD_SHADOW_ALPHA, 9);
    expect(env.shadowDy).toBeCloseTo(BEAD_CARD.shadowDy, 9);
  });

  it('全程单调、不二次过冲（裁定 7：1.06 = 起点值而非过冲量）', () => {
    const step = 0.001;
    let prev = Number.NaN;
    let last = Number.NEGATIVE_INFINITY;
    for (let p = 0; p <= 1 + 1e-9; p += step) {
      const s = fillPopEnvelope(Math.min(1, p), false, fresh()).scale;
      // clamp 界内
      expect(s).toBeGreaterThanOrEqual(FILL_POP_SCALE_TROUGH - 1e-9);
      expect(s).toBeLessThanOrEqual(FILL_POP_SCALE_START + 1e-9);
      // 压下段非增、回弹段非减 ⇒ 全场只有一个谷（不二次过冲）。首帧无比照，跳过方向判定
      if (!Number.isNaN(prev)) {
        if (s > last + 1e-9) {
          expect(p, `上升出现在压下段 p=${p}`).toBeGreaterThanOrEqual(PRESS_P - 1e-9);
        }
        if (p > PRESS_P + 1e-9) {
          expect(s).toBeGreaterThanOrEqual(prev - 1e-9);
        } else {
          expect(s).toBeLessThanOrEqual(prev + 1e-9);
        }
      }
      prev = s;
      last = Math.max(last, s);
    }
  });

  it('L0a α 单峰、L0b α 单谷（各 1 个极值点 ⇒ D2「0 往复」不触闪烁）', () => {
    for (const key of ['contactAlpha', 'shadowAlpha'] as const) {
      const series = samples(240).map((p) => fillPopEnvelope(p, false, fresh())[key]);
      let turns = 0;
      let dir = 0;
      for (let i = 1; i < series.length; i++) {
        const d = Math.sign(series[i]! - series[i - 1]!);
        if (d === 0) continue;
        if (dir !== 0 && d !== dir) turns++;
        dir = d;
      }
      expect(turns, `${key} 极值点数`).toBe(1);
    }
    // 峰 / 谷值即规格常量
    expect(fillPopEnvelope(PRESS_P, false, fresh()).contactAlpha).toBeCloseTo(
      FILL_POP_CONTACT_A_PEAK,
      6,
    );
    expect(fillPopEnvelope(PRESS_P, false, fresh()).shadowAlpha).toBeCloseTo(
      FILL_POP_SHADOW_A_TROUGH,
      6,
    );
  });

  it('clamp 兜得住越界进度（浮点尾数不致重叠 / α 越界）', () => {
    for (const p of [-0.5, 1.5, Number.NaN]) {
      const env = fillPopEnvelope(Number.isNaN(p) ? 1 : p, false, fresh());
      expect(env.scale).toBeGreaterThanOrEqual(FILL_POP_SCALE_TROUGH);
      expect(env.scale).toBeLessThanOrEqual(FILL_POP_SCALE_START);
      expect(env.contactAlpha).toBeLessThanOrEqual(FILL_POP_CONTACT_A_PEAK);
      expect(env.shadowAlpha).toBeGreaterThanOrEqual(FILL_POP_SHADOW_A_TROUGH);
    }
  });

  it('D1（reduceMotion）：关 scale 与 L0b 联动，仅保留 L0a α 单峰', () => {
    for (const p of samples(60)) {
      const env = fillPopEnvelope(p, true, fresh());
      expect(env.scale).toBe(1);
      expect(env.shadowDy).toBe(BEAD_CARD.shadowDy);
      expect(env.shadowAlpha).toBe(BEAD_SHADOW_ALPHA);
      // 宽比属形变通道 ⇒ 一并关
      expect(env.contactWidth).toBe(BEAD_CARD.contactW);
    }
    expect(fillPopEnvelope(PRESS_P, true, fresh()).contactAlpha).toBeCloseTo(
      FILL_POP_CONTACT_A_PEAK,
      6,
    );
  });

  it('投影偏移分子谷 = 2/64（`FILL_POP_SHADOW_DY_MIN`）在 t=40ms 落地', () => {
    expect(fillPopEnvelope(PRESS_P, false, fresh()).shadowDy).toBeCloseTo(
      FILL_POP_SHADOW_DY_MIN / 64,
      9,
    );
  });
});

describe('G1 · 渲染接线：垫不参与 scale（§1.6.1 层序死结论）', () => {
  const pad = emit({ padColorIdx: 3 });
  const pop = emit({ padColorIdx: 3, scale: FILL_POP_SCALE_START });
  const rest = emit({ padColorIdx: 3, scale: 1 });

  it('L11 垫 = 第 0 条图元、恒为 pitch 满铺方角 52×52、恒格心（scale 不带动 · v1.5-r8）', () => {
    for (const commands of [pad, pop, rest]) {
      const c = commands[0]!;
      expect(c.kind).toBe('rect');
      if (c.kind === 'rect') {
        expect(c.w).toBeCloseTo(BEAD_PITCH, 9);
        expect(c.h).toBeCloseTo(BEAD_PITCH, 9);
        expect(c.x).toBeCloseTo(100 - BEAD_PITCH / 2, 9);
        expect(c.y).toBeCloseTo(200 - BEAD_PITCH / 2, 9);
        expect(c.radius ?? 0).toBe(0); // v1.5-r8：方角 ⇒ 相邻格底色无缝
        expect(c.fill).toBe(endpointOf(DEMO_BEAD_INKS, 3).edge);
      }
    }
    // 垫恒画：与是否处于动画无关（不受动画开关控制）
    expect(pop[0]!.kind === 'rect' && pop[0]!.fill).toBe(
      rest[0]!.kind === 'rect' ? rest[0]!.fill : undefined,
    );
  });

  it('珠体（L0a/L0b/L1）宽度 = (50 − 2×INSET) × scale ⇒ scale 只作用珠体', () => {
    const body = (BEAD_CELL - BEAD_DRAW_INSET * 2) * FILL_POP_SCALE_START;
    const l0a = pop[1]!,
      l0b = pop[2]!;
    expect(l0a.kind === 'rect' && l0a.w).toBeCloseTo(body * BEAD_CARD.contactW, 6);
    expect(l0b.kind === 'rect' && l0b.w).toBeCloseTo(body, 6);
    expect(l0b.kind === 'rect' && l0b.h).toBeCloseTo(body, 6);
  });

  it('静息回归护栏：缺省 options 与 scale=1 完全同流（G1 不破 §1.1 十层卡）', () => {
    expect(rest.length).toBe(pad.length);
    for (let i = 0; i < rest.length; i++) {
      expect(rest[i]).toEqual(pad[i]);
    }
  });

  it('峰态图元数 ≡ 静息（B′ 下动画期 +0/颗，§1.6.9 双口径归一）', () => {
    expect(pop.length).toBe(rest.length);
  });

  it('动画期珠永不越出本格（峰 48.76 < 格 50 ⇒ A5 零重叠的几何前提）', () => {
    const l0b = pop[2]!;
    expect(l0b.kind === 'rect' && l0b.w).toBeLessThan(BEAD_CELL);
    // 与邻珠（同为 46）的间隙：pitch 52 − (半峰宽 + 半静息宽) > 0
    const peakHalf = ((BEAD_CELL - BEAD_DRAW_INSET * 2) * FILL_POP_SCALE_START) / 2;
    const restHalf = (BEAD_CELL - BEAD_DRAW_INSET * 2) / 2;
    expect(52 - (peakHalf + restHalf)).toBeGreaterThan(4);
  });

  it('L0a α / 宽比覆写确实进命令（否则「重量+接触」退化为贴图缩放）', () => {
    const env = fillPopEnvelope(PRESS_P, false, fresh());
    const commands = emit({
      padColorIdx: 3,
      scale: env.scale,
      contactAlpha: env.contactAlpha,
      contactWidth: env.contactWidth,
      shadowAlpha: env.shadowAlpha,
      shadowDy: env.shadowDy,
    });
    const l0a = commands[1]!,
      l0b = commands[2]!;
    expect(l0a.kind === 'rect' && l0a.fill).toBe(withAlpha(BEAD_SHADOW_HEX, env.contactAlpha));
    expect(l0a.kind === 'rect' && l0a.w).toBeCloseTo(
      (BEAD_CELL - BEAD_DRAW_INSET * 2) * env.scale * env.contactWidth,
      6,
    );
    expect(l0b.kind === 'rect' && l0b.fill).toBe(withAlpha(BEAD_SHADOW_HEX, env.shadowAlpha));
    expect(l0b.kind === 'rect' && l0b.y).toBeCloseTo(
      200 - ((BEAD_CELL - BEAD_DRAW_INSET * 2) * env.scale) / 2 -
        (BEAD_CELL - BEAD_DRAW_INSET * 2) * env.scale * env.shadowDy,
      6,
    );
  });
});
