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
  solverSequenceMs,
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
import { BEAD_HIGHLIGHT_HEX, DEFAULT_PALETTE, DEMO_BEAD_INKS, withAlpha } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { pausePanelLayout } from '../src/systems/pause-panel.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import type { BeadsSnapshot } from '../src/game/state.js';

const freshWave = (): WaveEnvelope => ({ scale: 1, dy: 0, active: false });

function renderSnap(snap: BeadsSnapshot): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(750, 1334);
  builder.begin();
  buildBeadsView(builder, snap, DEFAULT_PALETTE, DEMO_BEAD_INKS);
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

  /**
   * 裁定「恒播满」（**WXG-T-128 待裁③ = 甲**，2026-09-19 用户拍板）：
   * 扫光臂起后**恒播满 `SWEEP_MS`**，**不因状态切换（含离 playing 进 level-clear）中断**。
   *
   * 为什么必须钉住：`_stepSweepFx` 与 `_stepConfettiFx` 同属**表现层步进组**（`beads-game.ts`
   * `_update` 末尾、不受 `playing` 门约束），而 G6 彩带正是「level-clear 臂起、播满 800ms」
   * 的判例；裁定 1「庆祝先行放完再落遮罩」亦同精神（面板延迟 `CLEAR_PANEL_DELAY_MS` 开
   * ⇒ 400ms 扫光必然在面板前播完、无遮挡）。**给扫光加 playing 门会与上述两条分叉**。
   *
   * 构造要点：需**恰 1 颗错位**（序列 = `solverSequenceMs(1)` = 320ms）才留出
   * 「已过关但扫光未归零」的观测窗口（400 − 320 = 80ms）；`buildMisplaced(…, 1)` 的
   * 两两对调会给 **2 颗**（序列 400ms ≈ 扫光 ⇒ 窗口消失，本判据退化为恒真）。
   */
  it('裁定「恒播满」（WXG-T-128 待裁③ 甲）：solver 归位致过关 ⇒ 扫光不被掐断、仍走完 400ms', () => {
    // 前提（本判据的可观测性条件）：解环器序列**严格短于**扫光 ⇒ 才存在「已过关但扫光未归零」
    // 的窗口。若将来常量调整破坏该前提（序列 ≥ 扫光），本行会先于断言报警，而非静默伪绿。
    expect(solverSequenceMs(1)).toBeLessThan(SWEEP_MS);

    const h = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.g3-clear-continue',
    });
    expect(h.game.grid.misplacedCount).toBeGreaterThan(0); // 默认装配即有可归位目标

    expect(h.game.usePowerup('solver')).toBe(true);
    // 逐帧推进**到过关即停**；上界 23 帧（≈383ms）保证不越过扫光 400ms（越过后窗口消失）。
    let frames = 0;
    while (h.game.phase === 'playing' && frames < 23) {
      h.advance(1 / 60);
      frames++;
    }
    expect(h.game.phase).toBe('level-clear'); // ① 确已过关
    // ② 裁定甲：过关**不掐断**扫光 —— 过关帧扫光仍在途。
    // ⚠ 判别力自检（K-036）：「加 `playing` 门」这一变异下本条**仍会通过**（门令扫光冻结在非零值
    // 而非归零）⇒ 真正的判别力在 ③（冻结 ⇒ 永不推进/永不归零）。故 ① ② 只作前置，③ 才是判据。
    const pAtClear = h.game.snapshot.sweepProgress;
    expect(pAtClear).toBeGreaterThan(0);
    h.advance(1 / 60); // ③ 过关后**仍在推进**（加门 ⇒ 冻结 ⇒ 本条失败）
    expect(h.game.snapshot.sweepProgress).toBeGreaterThan(pAtClear);
    h.advance(SWEEP_MS / 1000); // ④ 越过 400ms
    expect(h.game.snapshot.sweepProgress).toBe(0); // 到点自清、零残留（与 G6 彩带同判例）
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

describe('G4 vfx_complete_wave · LOD 降档 + B0 底图不参与 lift（v1.5-r8）', () => {
  it('降档砍 3 个图元（L0a / L3b / L4′），中心孔与 L1 主体恒在', () => {
    const full = emitBead({ targetColorIdx: 0, scale: WAVE_SCALE_PEAK });
    const lod = emitBead({ targetColorIdx: 0, scale: WAVE_SCALE_PEAK, lodLayers: WAVE_LOD_LAYERS });
    // 旧集为 4 条（L4 三条里砍 L4a/L4b）；L4 已并为一枚椭圆高光 ⇒ 降档只砍该 1 条。
    expect(full.length - lod.length).toBe(3);
    expect(lod.length).toBeGreaterThan(0);
    // 孔 = 识别红线，降档后仍在。
    expect(lod.filter((c) => c.kind === 'circle')).toHaveLength(2);
  });

  it('⛔ 珠体函数不输出底图；`lift` 把整颗珠（含孔）一起抬（§1.6.1 P0 陷阱 #2）', () => {
    // 两侧同走降档 ⇒ 图元集相同，唯一变量 = `lift`。
    const still = emitBead({ targetColorIdx: 0, lodLayers: WAVE_LOD_LAYERS });
    const lifted = emitBead({ targetColorIdx: 0, lift: WAVE_LIFT_PX, lodLayers: WAVE_LOD_LAYERS });
    // B0 已上提为独立函数 ⇒ 珠体输出里根本不存在 pitch 宽图元，
    // “底图被抬走”在结构上不可发生（旧判据靠比对两条 rect，现在由签名保）。
    const rectAt = (cmds: readonly DrawCommand[], i: number): RectCommand => {
      const c = cmds[i]!;
      expect(c.kind).toBe('rect');
      return c as RectCommand;
    };
    expect(still.some((c) => c.kind === 'rect' && c.w === BEAD_PITCH)).toBe(false);
    // L0b 投影确实上移（降档后 = 第 1 条）⇒ 「珠上移、露出更多底图」读数成立。
    expect(rectAt(lifted, 1).y - rectAt(still, 1).y).toBeCloseTo(WAVE_LIFT_PX, 6);
    // 孔必须跟着珠体走 —— 孔不抬的话会在抬升态上“从珠上滑开”。
    const holeY = (cmds: readonly DrawCommand[]): number =>
      (cmds.filter((c) => c.kind === 'circle')[0] as { y: number }).y;
    expect(holeY(lifted) - holeY(still)).toBeCloseTo(WAVE_LIFT_PX, 6);
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
