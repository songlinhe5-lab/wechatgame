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
  drawTargetTile,
  fillPopEnvelope,
  type FillPopEnvelope,
  type FilledBeadOptions,
} from '../src/view/bead-render.js';
import { drawLegacyTenBead } from '../src/view/bead-styles/legacy-ten.js';
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

/**
 * B0 底图（`drawTargetTile`）单独采样：它不接受 scale / lift 形参，结构上无法被珠体包络带动。
 *
 * ⚠ **恒等档不变式**（`ADR-0020` 附录 A 甲案 / WXG-T-206）：本助手**不传 `size`** ⇒ 吃默认
 * `BEAD_PITCH`，即 `z = 1` 那一档。甲案只改 `z ≠ 1` 的呈现，所以下面那四条 `BEAD_PITCH`
 * 断言逐字保留，其职责 = 钉住默认值没被动（动了即红）。缩放档行为不在本文件测（对象 =
 * 包络与层序，不是格距），见 `view-model.test.ts`。
 */
function emitTile(colorIdx: number) {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  drawTargetTile(builder, 100, 200, colorIdx, DEMO_BEAD_INKS);
  return builder.end().commands;
}

function emit(options: FilledBeadOptions) {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  drawFilledBead(builder, 100, 200, 1, options);
  return builder.end().commands;
}

/**
 * **对照臂（`legacy-ten`）同一夹具**：G1 包络的四个通道（`contactAlpha` / `contactWidth` /
 * `shadowAlpha` / `shadowDy`）在四棱基线上**无承载体**（§K.5 行 1/2 同族，台账外连带⇒ 回传登记），
 * 因此“通道真的进了命令”这一腿只能打十层臂。新基线侧另钉 `scale` 腿（仍有效）。
 */
function legacyEmit(options: FilledBeadOptions) {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  drawLegacyTenBead(builder, 100, 200, 1, options);
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

describe('G1 · 渲染接线：scale 只作用珠体，B0 底图不参与（§1.6.1 层序死结论 · v1.5-r8）', () => {
  const pad = emit({ targetColorIdx: 3 });
  const pop = emit({ targetColorIdx: 3, scale: FILL_POP_SCALE_START });
  const rest = emit({ targetColorIdx: 3, scale: 1 });

  it('B0 = 独立函数画的 pitch 满铺方角单图元；珠体函数不再输出任何 pitch 宽图元', () => {
    // v1.5-r8：「珠下画一块垫」已上提为 `drawTargetTile` ⇒ scale / lift / pop 包络**在结构上**
    // 无路径传递给它（旧写法靠“垫不吃 scale”的约定保，现在由函数签名保）。
    // 下方 `BEAD_PITCH` 四断言 = 恒等档不变式（`emitTile` 不传 size，见助手注）。
    const tile = emitTile(3)[0]!;
    {
      expect(tile.kind).toBe('rect');
      if (tile.kind !== 'rect') return;
      expect(tile.w).toBeCloseTo(BEAD_PITCH, 9);
      expect(tile.h).toBeCloseTo(BEAD_PITCH, 9);
      expect(tile.x).toBeCloseTo(100 - BEAD_PITCH / 2, 9);
      expect(tile.y).toBeCloseTo(200 - BEAD_PITCH / 2, 9);
      expect(tile.radius ?? 0).toBe(0); // 方角 ⇒ 相邻格底色无缝
      expect(tile.fill).toBe(endpointOf(DEMO_BEAD_INKS, 3).edge); // 恒为目标色暗档
    }
    // 珠体三条静息/峰值/落座命令里均无 pitch 宽图元 ⇒ 底图不会被珠体包络带动。
    for (const commands of [pad, pop, rest]) {
      expect(commands.some((c) => c.kind === 'rect' && c.w === BEAD_PITCH)).toBe(false);
    }
  });

  it('[legacy-ten] 珠体（L0a/L0b/L1）宽度 = (50 − 2×INSET) × scale ⇒ scale 只作用珠体', () => {
    const lpop = legacyEmit({ targetColorIdx: 3, scale: FILL_POP_SCALE_START });
    const body = (BEAD_CELL - BEAD_DRAW_INSET * 2) * FILL_POP_SCALE_START;
    // v1.5-r8：珠内已无垫 ⇒ L0a = 第 0 条、L0b = 第 1 条（旧为 [1] / [2]）。
    const l0a = lpop[0]!,
      l0b = lpop[1]!;
    expect(l0a.kind === 'rect' && l0a.w).toBeCloseTo(body * BEAD_CARD.contactW, 6);
    expect(l0b.kind === 'rect' && l0b.w).toBeCloseTo(body, 6);
    expect(l0b.kind === 'rect' && l0b.h).toBeCloseTo(body, 6);
  });

  // 新基线侧同题：四棱只有“一条珠体外缘”（#1 底 rect）⇒ scale 腿直接钉在它身上。
  it('四棱新基线：`scale` 作用珠体（底 rect 边长 = 内缩边长 × scale）', () => {
    const body = (BEAD_CELL - BEAD_DRAW_INSET * 2) * FILL_POP_SCALE_START;
    for (const c of pop) {
      if (c.kind === 'rect') expect(c.w).toBeCloseTo(body, 6);
      if (c.kind === 'circle') expect(c.r).toBeCloseTo((body * BEAD_CARD.holeRatio) / 2, 6);
    }
    // 珠体族零图元超出内缩尺 ⇒ 与下方“不越格”腿共供 A5 前提。
    expect(rest.filter((c) => c.kind === 'rect')).toHaveLength(1);
  });

  it('静息回归护栏：缺省 options 与 scale=1 完全同流（G1 不破当前层卡）', () => {
    expect(rest.length).toBe(pad.length);
    for (let i = 0; i < rest.length; i++) {
      expect(rest[i]).toEqual(pad[i]);
    }
  });

  it('峰态图元数 ≡ 静息（B′ 下动画期 +0/颗，§1.6.9 双口径归一）', () => {
    expect(pop.length).toBe(rest.length);
  });

  it('[legacy-ten] 动画期珠永不越出本格（峰 40.28 < 格 50 ⇒ A5 零重叠的几何前提）', () => {
    const lpop = legacyEmit({ targetColorIdx: 3, scale: FILL_POP_SCALE_START });
    const l0b = lpop[1]!;
    expect(l0b.kind === 'rect' && l0b.w).toBeLessThan(BEAD_CELL);
    // 与邻珠（同为 46）的间隙：pitch 52 − (半峰宽 + 半静息宽) > 0
    const peakHalf = ((BEAD_CELL - BEAD_DRAW_INSET * 2) * FILL_POP_SCALE_START) / 2;
    const restHalf = (BEAD_CELL - BEAD_DRAW_INSET * 2) / 2;
    expect(52 - (peakHalf + restHalf)).toBeGreaterThan(4);
  });

  it('[legacy-ten] L0a α / 宽比覆写确实进命令（否则「重量+接触」退化为贴图缩放）', () => {
    const env = fillPopEnvelope(PRESS_P, false, fresh());
    const commands = legacyEmit({
      targetColorIdx: 3,
      scale: env.scale,
      contactAlpha: env.contactAlpha,
      contactWidth: env.contactWidth,
      shadowAlpha: env.shadowAlpha,
      shadowDy: env.shadowDy,
    });
    const l0a = commands[0]!,
      l0b = commands[1]!;
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
