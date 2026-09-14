/**
 * S7 连击特效三档判据（WXG-T-074）。
 *
 * 冻结来源
 *  - 形态与一一对应：`score-combo §2.5`「Lv1(×2) 珠面星光粒子 / Lv2(×3) 伪震屏 / Lv3(×5) 全屏爆发」；
 *  - 时长：`ux/ux-spec.md §5` 三行 —— Lv1 **200ms** / Lv2 **150ms** / Lv3 **350ms**；
 *  - 红线（`systems-index §3.8`，`§8-9` 引用）：**无真位移震屏**、闪烁 **≤3Hz**。
 *
 * ⚠️ `§8-9` 的 **DevTools 帧检半边**（真机上的闪烁 / 位移实测）不在本文件 —— Node 侧把
 * **结构与参数**钉死：Lv2 的呈现量**只有 `screenScale`、没有位移字段**（红线在类型层无法发生）；
 * 三档都是**单次循环**、无任何自重复周期量（≤3Hz 的来源不存在）。
 */

import { describe, expect, it } from 'vitest';
import {
  COMBO_PARTICLE_COUNT,
  COMBO_SHAKE_SCALE_MAX,
  COMBO_VFX_LV1_MS,
  COMBO_VFX_LV2_MS,
  COMBO_VFX_LV3_MS,
} from '../src/config/tuning.js';
import {
  comboBurst,
  comboParticleOffsets,
  comboPseudoShake,
  comboVfxProgress,
  comboVfxSpec,
} from '../src/view/combo-vfx.js';
import { createBeadsHarness, type Harness } from './helpers.js';

/** 落一颗匹配的珠子（同 sprint-settle 判例；落子不推进时钟 ⇒ 连击窗口不流逝）。 */
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

describe('S7 连击特效三档（§2.5 / §5 / §8-9）', () => {
  it('maps each multiplier tier to its own VFX one-to-one, with §5 durations (§8-9)', () => {
    expect(comboVfxSpec(1)).toEqual({ tier: 1, kind: 'particles', durationMs: COMBO_VFX_LV1_MS });
    expect(comboVfxSpec(2)).toEqual({ tier: 2, kind: 'pseudoShake', durationMs: COMBO_VFX_LV2_MS });
    expect(comboVfxSpec(3)).toEqual({ tier: 3, kind: 'burst', durationMs: COMBO_VFX_LV3_MS });
    // 越界 / 非法 tier → null（调用方零动作，不猜）。
    expect(comboVfxSpec(0)).toBeNull();
    expect(comboVfxSpec(4)).toBeNull();
    expect(comboVfxSpec(Number.NaN)).toBeNull();
    // 时长就是 §5 的三行（镜像常量不许漂）。
    expect(COMBO_VFX_LV1_MS).toBe(200);
    expect(COMBO_VFX_LV2_MS).toBe(150);
    expect(COMBO_VFX_LV3_MS).toBe(350);
  });

  it('Lv2 red line is structural: the presentation has a scale and NO translation', () => {
    const shake = comboPseudoShake(0.5);
    // 没有 dx/dy ⇒ 「用位移伪造震屏」在类型层写不出来（§3.8「震屏不使用」）。
    expect(Object.keys(shake)).toEqual(['screenScale']);
    expect(shake.screenScale).toBeCloseTo(COMBO_SHAKE_SCALE_MAX, 6); // 中点 = 峰值
    expect(comboPseudoShake(0).screenScale).toBe(1); // §2.5：1.00 → 1.015 → 1.00
    expect(comboPseudoShake(1).screenScale).toBe(1);
  });

  it('every tier is a single cycle — no self-repeating period (≤3Hz 的来源不存在)', () => {
    expect(comboVfxProgress(-1, 200)).toBe(0);
    expect(comboVfxProgress(100, 200)).toBe(0.5);
    expect(comboVfxProgress(500, 200)).toBe(1); // 播完钳 1，**不回绕** ⇒ 无周期量
    expect(comboParticleOffsets(0)).toHaveLength(COMBO_PARTICLE_COUNT);
    expect(comboParticleOffsets(0.5)).toHaveLength(COMBO_PARTICLE_COUNT);
    const mag = (o: { x: number; y: number }) => Math.hypot(o.x, o.y);
    expect(mag(comboParticleOffsets(1)[0]!)).toBeGreaterThan(mag(comboParticleOffsets(0)[0]!)); // 由内向外
    expect(comboBurst(0).radial).toBe(0); // 单次：0 → 1（中点）→ 0
    expect(comboBurst(0.5).radial).toBe(1);
    expect(comboBurst(1).radial).toBe(0);
  });

  it('game level: crossing a tier opens the VFX anchored at the placed cell, then it decays', () => {
    const h = createBeadsHarness({ sprintTime: 30, saveKey: 'wxgame.beads.test.vfx' });
    h.game.startSprint();
    expect(placeOne(h)).toBe(true);
    expect(placeOne(h)).toBe(true); // streak 2 ⇒ tier 1（×2 粒子）
    expect(h.game.comboVfx?.kind).toBe('particles');
    expect(h.game.comboVfx?.tier).toBe(1);

    h.advance(1 / 60);
    const snap = h.game.snapshot;
    expect(snap.comboVfxKind).toBe('particles');
    expect(snap.comboVfxRow).toBeGreaterThanOrEqual(0);
    expect(snap.comboVfxCol).toBeGreaterThanOrEqual(0);
    expect(snap.comboVfxProgress).toBeGreaterThan(0);

    h.advance(0.3); // 200ms 播完 ⇒ 清空
    expect(h.game.comboVfx).toBeNull();
    expect(h.game.snapshot.comboVfxKind).toBe('');
    expect(h.game.snapshot.comboVfxProgress).toBe(0);
  });

  it('overlap: a higher tier replaces the running one（派生项：只播最高档）', () => {
    const h = createBeadsHarness({ sprintTime: 30, saveKey: 'wxgame.beads.test.vfx-2' });
    h.game.startSprint();
    for (let i = 0; i < 4; i++) expect(placeOne(h)).toBe(true); // streak 4 ⇒ tier 2
    expect(h.game.comboVfx?.kind).toBe('pseudoShake');
    expect(h.game.comboVfx?.tier).toBe(2);
    expect(h.game.snapshot.comboVfxKind).toBe('pseudoShake');
  });
});
