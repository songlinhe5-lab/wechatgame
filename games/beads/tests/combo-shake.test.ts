/**
 * G5 连击 Lv2「伪震屏」— 整屏 scale 经框架全局变换通道呈现
 * （WXG-T-132 · 案 B · `art-bible §7.3.5` / ADR-0014）。
 *
 * 规格：scale 1.00→1.015→1.00 三角波（`COMBO_SHAKE_SCALE_MAX` / `COMBO_VFX_LV2_MS`
 * = 150ms 均为既有冻结值，本单**零新增常量**）；锚点 = 屏幕中心（设计中心
 * 375,667，两 adapter 居中映射下恒重合，ADR-0014 §1）；D1 **整条关停**；图元 +0。
 * 红线（`systems-index §3.8`）：只缩放、**无位移**——变换语义位结构上没有 dx/dy。
 *
 * 三层判据（denied-press / confetti 同族）：① 视图层（snap 覆写 → 纯呈现）；
 * ② 真链（连击到 tier2 → game.buildRenderModel 的模型变换位）；③ 护栏
 * （变换不进命令流）。⚠️ 只到 `[Node]` 指令层（K-037）：Cocos 节点缩放是编辑器半
 * （bindings，ADR-0009 P2 构建阻塞），真机亚像素抖动为 B1/E1 观察项——整条不判 PASS。
 */

import { describe, expect, it } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import {
  COMBO_SHAKE_SCALE_MAX,
  COMBO_VFX_LV2_MS,
  DESIGN_H,
  DESIGN_W,
} from '../src/config/tuning.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { DEFAULT_PALETTE } from '../src/view/palette.js';
import { comboPseudoShake } from '../src/view/combo-vfx.js';
import { createBeadsHarness, type Harness } from './helpers.js';
import type { BeadsSnapshot } from '../src/game/state.js';

const FRAME = 1 / 60;
const ANCHOR_X = DESIGN_W / 2;
const ANCHOR_Y = DESIGN_H / 2;

/** 落一颗匹配的珠子（combo-vfx.test.ts `placeOne` 判例）。 */
function placeOne(h: Harness): boolean {
  const grid = h.game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isFillable(r, c)) continue;
      const slot = h.game.giveTrayBead(grid.requiredColor(r, c));
      if (slot < 0) return false;
      h.game.selectTraySlot(slot);
      return h.game.tapGridCell(r, c);
    }
  }
  return false;
}

function modelOf(snap: BeadsSnapshot) {
  const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
  builder.begin();
  buildBeadsView(builder, snap, DEFAULT_PALETTE);
  return builder.end();
}

function baseHarness(saveKey: string): Harness {
  const h = createBeadsHarness({ sprintTime: 30, saveKey });
  h.game.startSprint();
  return h;
}

describe('G5 伪震屏 · 全局变换通道（art-bible §7.3.5 案 B · WXG-T-132）', () => {
  // ── ① 视图层 ────────────────────────────────────────────────────────

  it('峰值帧：scale = 1.015、锚点 = 设计中心（=屏幕中心），恰三字段无位移', () => {
    const snap = { ...baseHarness('wxgame.beads.test.shake-a').game.snapshot,
      comboVfxKind: 'pseudoShake', comboVfxProgress: 0.5 } as BeadsSnapshot;
    const t = modelOf(snap).transform!;
    expect(t.scale).toBe(COMBO_SHAKE_SCALE_MAX); // 三角波中点 = 冻结峰值
    expect(t.anchorX).toBe(ANCHOR_X);
    expect(t.anchorY).toBe(ANCHOR_Y);
    // 红线类型层落实：位移/旋转在结构上不存在。
    expect(Object.keys(t).sort()).toEqual(['anchorX', 'anchorY', 'scale']);
  });

  it('三角波上爬/下衰两侧同值且单调（0→峰→0，单次循环）', () => {
    const snap0 = baseHarness('wxgame.beads.test.shake-b').game.snapshot;
    const scaleAt = (p: number): number =>
      modelOf({ ...snap0, comboVfxKind: 'pseudoShake', comboVfxProgress: p } as BeadsSnapshot)
        .transform!.scale;
    const up = scaleAt(0.25);
    const down = scaleAt(0.75);
    expect(up).toBeCloseTo(comboPseudoShake(0.25).screenScale, 12);
    expect(down).toBeCloseTo(up, 12); // 对称
    expect(up).toBeGreaterThan(1);
    expect(up).toBeLessThan(COMBO_SHAKE_SCALE_MAX);
    expect(scaleAt(0.1)).toBeLessThan(up);
    expect(scaleAt(0.9)).toBeLessThan(down);
  });

  it('波形回 1.00（p=1）⇒ 变换位消失，不留残帧', () => {
    const snap = { ...baseHarness('wxgame.beads.test.shake-c').game.snapshot,
      comboVfxKind: 'pseudoShake', comboVfxProgress: 1 } as BeadsSnapshot;
    expect(comboPseudoShake(1).screenScale).toBe(1);
    expect('transform' in modelOf(snap)).toBe(false);
  });

  it('D1（reduceMotion）整条关停：窗口内任意相位都无变换', () => {
    const snap0 = baseHarness('wxgame.beads.test.shake-d').game.snapshot;
    for (const p of [0.25, 0.5, 0.75]) {
      const m = modelOf({ ...snap0, comboVfxKind: 'pseudoShake', comboVfxProgress: p,
        reduceMotion: true } as BeadsSnapshot);
      expect('transform' in m).toBe(false);
    }
  });

  it('通道专属：Lv1 particles / Lv3 burst 档不触全局变换', () => {
    const snap0 = baseHarness('wxgame.beads.test.shake-e').game.snapshot;
    for (const kind of ['particles', 'burst'] as const) {
      const m = modelOf({ ...snap0, comboVfxKind: kind, comboVfxProgress: 0.5,
        comboVfxRow: 1, comboVfxCol: 1 } as BeadsSnapshot);
      expect('transform' in m).toBe(false);
    }
  });

  // ── ② 真链 ──────────────────────────────────────────────────────────

  it('streak4 ⇒ pseudoShake 臂：经 game.buildRenderModel 下发变换，播完自清', () => {
    const h = baseHarness('wxgame.beads.test.shake-f');
    for (let i = 0; i < 4; i++) expect(placeOne(h)).toBe(true); // streak 4 ⇒ tier 2
    expect(h.game.snapshot.comboVfxKind).toBe('pseudoShake');

    h.advance(FRAME); // 表现层起步：progress > 0 且 < 峰 ⇒ 变换在场
    const mid = (): number | undefined => {
      const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
      b.begin();
      h.game.buildRenderModel(b);
      return b.end().transform?.scale;
    };
    let sawAboveOne = false;
    for (let f = 0; f < Math.ceil(COMBO_VFX_LV2_MS / 1000 / FRAME); f++) {
      const p = h.game.snapshot.comboVfxProgress;
      const s = mid();
      if (p > 0 && p < 1) {
        // 与纯函数自洽（视图只消费快照标量，L5）；且从不越峰。
        expect(s).toBeCloseTo(comboPseudoShake(p).screenScale, 12);
        expect(s!).toBeGreaterThan(1);
        expect(s!).toBeLessThanOrEqual(COMBO_SHAKE_SCALE_MAX + 1e-12);
        sawAboveOne = true;
      } else {
        expect(s).toBeUndefined();
      }
      h.advance(FRAME);
    }
    expect(sawAboveOne).toBe(true);
    expect(h.game.snapshot.comboVfxKind).toBe(''); // 150ms 到点自清
    expect(mid()).toBeUndefined();
  });

  it('begin() 复位兜底：上一帧变换不跨帧残留（App 每帧 begin 的真实节奏）', () => {
    const h = baseHarness('wxgame.beads.test.shake-g');
    for (let i = 0; i < 4; i++) placeOne(h);
    h.advance(FRAME);
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    h.game.buildRenderModel(b);
    expect('transform' in b.end()).toBe(true); // 在播
    // 下一帧窗口已关 ⇒ 无变换（快照每帧重取，不可拿旧引用）。
    h.advance(0.3); // 300ms > 150ms ⇒ 已自清
    expect(h.game.snapshot.comboVfxKind).toBe('');
    b.begin();
    h.game.buildRenderModel(b);
    expect('transform' in b.end()).toBe(false);
  });

  // ── ③ 护栏 ──────────────────────────────────────────────────────────

  it('变换不进命令流：同 snap 仅动 comboVfx 字段 ⇒ commands 逐字节相等（图元 +0）', () => {
    const snap0 = baseHarness('wxgame.beads.test.shake-h').game.snapshot;
    const plain = modelOf(snap0);
    const shake = modelOf({ ...snap0, comboVfxKind: 'pseudoShake',
      comboVfxProgress: 0.5 } as BeadsSnapshot);
    expect(shake.commands).toEqual(plain.commands);
    expect('transform' in plain).toBe(false);
    expect(shake.transform).toBeDefined();
  });
});
