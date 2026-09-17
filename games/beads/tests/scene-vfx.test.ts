/**
 * G3 `vfx_powerup_sweep` / G4 `vfx_complete_wave` — 场景级动效（WXG-T-146 · T-128 落码②）。
 *
 * 规格正本：`art/assets-spec.md` §1.6.3（扫光）/ §1.6.4（过关波浪，含 **层序死结论** 联动）。
 * 毫秒真源：`design/ux/ux-spec.md` §5「道具生效 400ms」「过关庆祝 800ms + 20ms/列」。
 *
 * 三层判据各管一段，互不越界：
 *   ① 包络 = `scene-vfx.ts` 纯函数（无状态、无命令）；
 *   ② 观感 = `buildBeadsView` 命令层（L5：视图只读快照）；
 *   ③ 时序 = game 侧计时槽与 **裁定 1 的面板延迟门**（表现层不持状态 ⇒ 门只能在 game 侧）。
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder, type DrawCommand, type RectCommand } from '@wxgame/framework';
import {
  BEAD_CELL,
  BEAD_DRAW_INSET,
  BEAD_PITCH,
  CLEAR_PANEL_DELAY_MS,
  GEAR_HIT_SIZE,
  HUD_BAND,
  SWEEP_ALPHAS,
  SWEEP_MS,
  SWEEP_TAN,
  SWEEP_WIDTHS,
  SWEEP_X_FROM,
  SWEEP_X_TO,
  SWEEP_Y_MAX,
  SWEEP_Y_MIN,
  WAVE_COL_DELAY_MS,
  WAVE_LIFT_PX,
  WAVE_LOD_LAYERS,
  WAVE_MS,
  WAVE_RISE_RATIO,
  WAVE_SCALE_PEAK,
  WAVE_WINDOW_MIN_MS,
} from '../src/config/tuning.js';
import { drawFilledBead, type FilledBeadOptions } from '../src/view/bead-render.js';
import {
  SWEEP_LAYER_COUNT,
  sweepCenterX,
  sweepQuad,
  waveEnvelope,
  waveWindowMs,
  type WaveEnvelope,
} from '../src/view/scene-vfx.js';
import { BEAD_HIGHLIGHT_HEX, DEFAULT_PALETTE, withAlpha } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { pausePanelLayout } from '../src/systems/pause-panel.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import type { BeadsSnapshot } from '../src/game/state.js';

const freshWave = (): WaveEnvelope => ({ scale: 1, dy: 0, active: false });

function renderSnap(snap: BeadsSnapshot): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  buildBeadsView(builder, snap, DEFAULT_PALETTE);
  return builder.end().commands;
}

const countPolygons = (cmds: readonly DrawCommand[]): number =>
  cmds.filter((c) => c.kind === 'polygon').length;

/** 填满整块棋盘（空盘装配 ⇒ 走真实 tap 路径触发 `LEVEL_CLEAR`）。 */
function fillBoard(harness: Harness): void {
  const grid = harness.game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isFillable(r, c)) continue;
      const slot = harness.game.giveTrayBead(grid.requiredColor(r, c));
      if (slot < 0) throw new Error(`tray full at (${r},${c})`);
      harness.game.selectTraySlot(slot);
      if (!harness.game.tapGridCell(r, c)) throw new Error(`place failed at (${r},${c})`);
    }
  }
}

function mkClear(saveKey: string): Harness {
  const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey });
  fillBoard(h);
  expect(h.game.phase).toBe('level-clear');
  return h;
}

/** 单颗珠的命令流（LOD / 垫判据用，绕开关卡与快照）。 */
function emitBead(options: FilledBeadOptions): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  drawFilledBead(builder, 200, 300, 1, options);
  return builder.end().commands;
}

// ───────────────────────────────── G3 §1.6.3 · 包络

describe('G3 vfx_powerup_sweep · 包络（assets-spec §1.6.3）', () => {
  it('中心线扫程 = [-260, 1010]，两端点取规格值且全程单调不减', () => {
    expect(sweepCenterX(0)).toBeCloseTo(SWEEP_X_FROM, 6);
    expect(sweepCenterX(1)).toBeCloseTo(SWEEP_X_TO, 6);
    let prev = Number.NEGATIVE_INFINITY;
    for (let p = 0; p <= 1 + 1e-9; p += 0.01) {
      const x = sweepCenterX(Math.min(1, p));
      expect(x).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = x;
    }
  });

  it('斜切 20°：y 越大 x 越靠右，顶/底右移量 = SWEEP_TAN × 玩法区高', () => {
    const quad = sweepQuad(0, 0, [0, 0, 0, 0, 0, 0, 0, 0]);
    const shear = SWEEP_TAN * (SWEEP_Y_MAX - SWEEP_Y_MIN);
    expect(quad[4]).toBeCloseTo(quad[2] + shear, 6); // 右上 − 右下
    expect(quad[6]).toBeCloseTo(quad[0] + shear, 6); // 左上 − 左下
    expect(shear).toBeGreaterThan(400); // ≈442px（§1.6.3「顶部相对底部右移」）
  });

  it('三层宽 [36,84,210] 与 α [0.14,0.10,0.06]：核心最窄最亮、广层最宽最暗', () => {
    expect(SWEEP_WIDTHS.length).toBe(SWEEP_LAYER_COUNT);
    expect(SWEEP_ALPHAS.length).toBe(SWEEP_LAYER_COUNT);
    for (let i = 0; i < SWEEP_LAYER_COUNT; i++) {
      const quad = sweepQuad(i, 0, [0, 0, 0, 0, 0, 0, 0, 0]);
      expect(quad[2] - quad[0]).toBeCloseTo(SWEEP_WIDTHS[i]!, 6);
    }
    expect(SWEEP_ALPHAS[0]!).toBeGreaterThan(SWEEP_ALPHAS[2]!);
    expect(SWEEP_MS).toBe(400); // ux-spec §5 真源
  });

  it('⛔ 不进 HUD 带：`SWEEP_Y_MAX` 由 `HUD_BAND.yMin` 派生 ⇒ 顶点 y 恒 ≤ 该值', () => {
    expect(SWEEP_Y_MAX).toBe(HUD_BAND.yMin);
    const quad = sweepQuad(2, 0, [0, 0, 0, 0, 0, 0, 0, 0]);
    for (let k = 1; k < 8; k += 2) expect(quad[k]).toBeLessThanOrEqual(HUD_BAND.yMin);
  });
});

// ───────────────────────────────── G3 · 观感（命令层）

describe('G3 vfx_powerup_sweep · 命令层', () => {
  it('生效期恰 +3 条 polygon，绘制序反序（先广后核心 ⇒ 后画的更亮）', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.g3-view' });
    const base = h.game.snapshot;
    const cmds = renderSnap({ ...base, sweepProgress: 0.5, reduceMotion: false });
    expect(countPolygons(cmds) - countPolygons(renderSnap({ ...base, sweepProgress: 0 }))).toBe(
      SWEEP_LAYER_COUNT,
    );
    const sweeps = cmds.filter(
      (c) => c.kind === 'polygon' && c.fill === withAlpha(BEAD_HIGHLIGHT_HEX, SWEEP_ALPHAS[2]!),
    );
    expect(sweeps).toHaveLength(1); // 广层（最低 α）排在三层之首
  });

  it('D1（reduceMotion）⇒ 整条关停，零图元（合法性 = A6 面板信息通道）', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.g3-d1' });
    const base = h.game.snapshot;
    expect(
      countPolygons(renderSnap({ ...base, sweepProgress: 0.5, reduceMotion: true })),
    ).toBe(countPolygons(renderSnap({ ...base, sweepProgress: 0, reduceMotion: true })));
  });

  it('道具生效即上弦：`usePowerup` 成功后扫光走完一周期并归零', () => {
    // 默认装配（`swaps` ⇒ 存在错位珠）才有可归位目标；空盘时 solver 合法返回 false。
    const h = createBeadsHarness({ levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.g3-arm' });
    expect(h.game.grid.misplacedCount).toBeGreaterThan(0);
    expect(h.game.usePowerup('solver')).toBe(true);
    // 上弦**当帧** p = 0（与 G1 `placeProgress` 同族的「0 = 未激活」约定 ⇒ 视图守卫把 p=0 读作关闭）。
    // 代价 = 首帧不画（一帧 16.7ms，且此时斜带主体仍在 x < 0 屏外），非缺陷。
    expect(h.game.snapshot.sweepProgress).toBe(0);
    h.advance(1 / 60);
    const p = h.game.snapshot.sweepProgress;
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
    h.advance(SWEEP_MS / 1000);
    expect(h.game.snapshot.sweepProgress).toBe(0); // 单次循环，不残留
  });
});

// ───────────────────────────────── G4 §1.6.4 · 包络

describe('G4 vfx_complete_wave · 包络（assets-spec §1.6.4）', () => {
  it('单列窗口 W = max(240, 800 − 20×(cols−1))', () => {
    expect(waveWindowMs(1)).toBe(WAVE_MS);
    expect(waveWindowMs(7)).toBe(680);
    expect(waveWindowMs(13)).toBe(560);
    expect(waveWindowMs(40)).toBe(WAVE_WINDOW_MIN_MS); // 触底不外溢
    expect(waveWindowMs(0)).toBe(WAVE_MS); // cols < 1 兜底
  });

  it('鼓起 ease-out 至峰 1.08@p=0.35、落下 ease-in 回 1.0@p=1、dy 单峰 3px@p=0.5', () => {
    const window = waveWindowMs(1);
    const peak = waveEnvelope(0, WAVE_RISE_RATIO * window, window, freshWave());
    expect(peak.scale).toBeCloseTo(WAVE_SCALE_PEAK, 6);
    const rest = waveEnvelope(0, window, window, freshWave());
    expect(rest.active).toBe(false);
    expect(rest.scale).toBe(1);
    expect(rest.dy).toBe(0);
    const crest = waveEnvelope(0, 0.5 * window, window, freshWave());
    expect(crest.dy).toBeCloseTo(WAVE_LIFT_PX, 6);
  });

  it('零叠压：峰径 (BEAD_CELL−2×INSET)×1.08 = 49.68 < pitch 52', () => {
    const drawn = (BEAD_CELL - 2 * BEAD_DRAW_INSET) * WAVE_SCALE_PEAK;
    expect(drawn).toBeLessThan(BEAD_PITCH);
    expect(BEAD_PITCH - drawn).toBeGreaterThan(2); // 留 ≥2px 缝 ⇒ 波浪期不糊成一片
  });

  it('列错峰 20ms：后列未轮到 = 满层静息（质感落差来源）', () => {
    const window = waveWindowMs(6);
    const lagging = waveEnvelope(3, 2 * WAVE_COL_DELAY_MS, window, freshWave());
    expect(lagging.active).toBe(false);
    expect(lagging.scale).toBe(1);
    const leading = waveEnvelope(0, 2 * WAVE_COL_DELAY_MS, window, freshWave());
    expect(leading.active).toBe(true);
  });
});

// ───────────────────────────────── G4 · 降档与层序死结论

describe('G4 vfx_complete_wave · LOD 降档 + L11 垫不参与 lift', () => {
  it('降档砍 4 个图元（L0a / L3b / L4a / L4b），L11 垫与 L1 主体恒在', () => {
    const full = emitBead({ padColorIdx: 0, scale: WAVE_SCALE_PEAK });
    const lod = emitBead({ padColorIdx: 0, scale: WAVE_SCALE_PEAK, lodLayers: WAVE_LOD_LAYERS });
    expect(full.length - lod.length).toBe(4);
    expect(lod.length).toBeGreaterThan(0);
  });

  it('⛔ 垫恒锁格缘：`lift` 只抬珠体，垫 rect 尺寸与 y 一字不动（§1.6.1 P0 陷阱 #2）', () => {
    // 两侧同走降档 ⇒ 图元集相同，唯一变量 = `lift`。
    const still = emitBead({ padColorIdx: 0, lodLayers: WAVE_LOD_LAYERS });
    const lifted = emitBead({ padColorIdx: 0, lift: WAVE_LIFT_PX, lodLayers: WAVE_LOD_LAYERS });
    const pad = (cmds: readonly DrawCommand[]): RectCommand =>
      cmds.find((c) => c.kind === 'rect' && c.w === BEAD_CELL) as RectCommand;
    expect(pad(lifted).y).toBe(pad(still).y);
    expect(pad(lifted).h).toBe(BEAD_CELL);
    // 对照：同一 `lift` 下珠体（宽 ≠ 50 的第一条 = L0b 投影）确实上移 ⇒ 「珠上移露垫」读数成立。
    const body = (cmds: readonly DrawCommand[]): RectCommand =>
      cmds.filter((c) => c.kind === 'rect' && c.w !== BEAD_CELL)[0] as RectCommand;
    expect(body(lifted).y - body(still).y).toBeCloseTo(WAVE_LIFT_PX, 6);
  });
});

// ───────────────────────────────── G4 · 面板延迟门（裁定 1）

describe('G4 过关庆祝 · 裁定 1 的面板延迟门', () => {
  it('同帧不开面板、波浪推进；过 800ms 门后面板开、波浪归零', () => {
    const h = mkClear('wxgame.beads.test.g4-gate');
    expect(h.game.clearPanel.visible).toBe(false); // 新契约：庆祝优先
    expect(h.game.snapshot.waveProgress).toBeGreaterThanOrEqual(0);
    h.advance(0.2);
    const mid = h.game.snapshot.waveProgress;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(h.game.clearPanel.visible).toBe(false);
    h.advance((CLEAR_PANEL_DELAY_MS - 0.2 * 1000) / 1000 + 0.1);
    expect(h.game.clearPanel.visible).toBe(true);
    expect(h.game.snapshot.waveProgress).toBe(0);
  });

  it('D1 路径不空等：波浪整条关停 ⇒ 结算面板同帧开', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.g4-d1' });
    h.game.tapDesign(GEAR_HIT_SIZE / 2, (HUD_BAND.yMin + HUD_BAND.yMax) / 2); // 齿轮 → PAUSED
    expect(h.game.phase).toBe('paused');
    const row = pausePanelLayout('normal').buttons.find((b) => b.id === 'toggle-reduce-motion')!.rect;
    h.game.tapDesign((row.xMin + row.xMax) / 2, (row.yMin + row.yMax) / 2);
    expect(h.game.reduceMotion).toBe(true);
    const resume = pausePanelLayout('normal').buttons.find((b) => b.id === 'resume')!.rect;
    h.game.tapDesign((resume.xMin + resume.xMax) / 2, (resume.yMin + resume.yMax) / 2);
    expect(h.game.phase).toBe('playing');

    fillBoard(h);
    expect(h.game.phase).toBe('level-clear');
    expect(h.game.snapshot.waveProgress).toBe(0); // 整条关停
    expect(h.game.clearPanel.visible).toBe(true); // 无 800ms 惩罚
  });
});
