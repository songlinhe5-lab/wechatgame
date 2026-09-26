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
  BEAD_CARD,
  BEAD_CELL,
  BEAD_DRAW_INSET,
  BEAD_PITCH,
  CLEAR_PANEL_DELAY_MS,
  GEAR_HIT_SIZE,
  HUD_BAND,
  SELECT_LIFT_MS,
  SELECT_LIFT_PX,
  SELECT_LIFT_PEAK_T,
  SELECT_LIFT_REBOUND,
  SELECT_LIFT_STAGGER,
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
  WAVE_BEAD_LOD_LAYERS,
  WAVE_MS,
  WAVE_RISE_RATIO,
  WAVE_SCALE_PEAK,
  WAVE_WINDOW_MIN_MS,
  solverSequenceMs,
} from '../src/config/tuning.js';
import { drawFilledBead, type FilledBeadOptions } from '../src/view/bead-render.js';
import { drawLegacyTenBead } from '../src/view/bead-styles/legacy-ten.js';
import {
  SWEEP_LAYER_COUNT,
  liftEase,
  liftStaggerPhase,
  sweepCenterX,
  sweepQuad,
  waveEnvelope,
  waveWindowMs,
  type WaveEnvelope,
} from '../src/view/scene-vfx.js';
import { BEAD_HIGHLIGHT_HEX, DEFAULT_PALETTE, DEMO_BEAD_INKS, endpointOf, withAlpha } from '../src/view/palette.js';
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

/**
 * 抬起珠的**珠心 y 与孔径**：取该格窗口内唯一的那枚 `circle` = 孔心（已填格无凹槽图元）。
 * 定位不用尺寸公式（抄实现 ⇒ 变异时只报「找不到」而不报数字差）；位移拿珠心也是
 * `§1.2` 既有判例：rect 底边会随放大偏移，珠心才是与缩放无关的正确基准。
 */
function liftedBeadAt(snap: BeadsSnapshot, row: number, col: number): { y: number; r: number } {
  const bx = snap.gridLeft + snap.gridCell / 2 + snap.gridPitch * col;
  const cy = snap.gridTop - snap.gridCell / 2 - snap.gridPitch * row;
  const got = renderSnap(snap).find(
    (c) =>
      c.kind === 'circle' &&
      Math.abs((c as { x: number }).x - bx) <= snap.gridCell / 2 &&
      Math.abs((c as { y: number }).y - cy) <= snap.gridCell,
  );
  expect(got, `格 (${row},${col}) 内未找到孔 ⇒ 本夹具没发抬起（或被可视窗剔除）`).toBeDefined();
  return { y: (got as { y: number }).y, r: (got as { r: number }).r };
}
/** 该格格心 y（与 `drawGrid` 同一公式，⇒ 不依赖实现细节也能算位移）。 */
const cellCenterY = (snap: BeadsSnapshot, row: number): number =>
  snap.gridTop - snap.gridCell / 2 - snap.gridPitch * row;
/** 本文件所有抬起用例的默认锚 = (1,2)（`mkMisplaced` 只摆这一颗）。 */
const liftedBead = (snap: BeadsSnapshot): { y: number; r: number } => liftedBeadAt(snap, 1, 2);

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

  // 旧名钉字面量「= 49.68 < pitch 52」是 5mm(50) 基快照（`IMPACT-0020a §7.2-4` 点名的同类样本）。
  // §3.3 **v1.57** 换 32/dip 基后：`(30 − 2×4) × 1.08 = 23.76 < pitch 32`，缝 8.24px（旧 2.32）。
  // ⇒ 标题改为只写**公式**（断言本就是符号式，未为绿而改；K-036 / K-053）。
  it('零叠压：峰径 (BEAD_CELL−2×BEAD_DRAW_INSET)×WAVE_SCALE_PEAK < BEAD_PITCH，且留 ≥2px 缝', () => {
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
  /**
   * **对照臂（`legacy-ten`）同夹具**：本组两条断的对象是「降档砍哪三层」与
   * 「lift 驱动阴影衰减/侧壁变长」，两个通道都只在十层存在（§K.5 行 1/2/4/12 同族，
   * 台账外连带 ⇒ 回传登记）。四棱新基线侧的对应腿：LOD no-op 见
   * `bead-render.test.ts`，lift 两通道见同文件与 `bead-style-ledger.test.ts`。
   */
  function emitLegacyTen(options: FilledBeadOptions): readonly DrawCommand[] {
    const builder = new RenderModelBuilder(750, 1334);
    builder.begin();
    drawLegacyTenBead(builder, 200, 300, 1, options);
    return builder.end().commands;
  }

  // 新基线侧正面登记：四棱 6 命令无可砍集 ⇒ `WAVE_BEAD_LOD_LAYERS` 在本臂上是 no-op
  //（波浪期命令数不降 = 转正的既定后果，⛔ 不得被读成“降档失效”的 bug）。
  it('四棱新基线：波浪降档不削命令（6 条 ≤ C7 上限 7 ⇒ 结构性 no-op）', () => {
    const full = emitBead({ targetColorIdx: 0, scale: WAVE_SCALE_PEAK });
    const lod = emitBead({
      targetColorIdx: 0,
      scale: WAVE_SCALE_PEAK,
      lodLayers: WAVE_BEAD_LOD_LAYERS,
    });
    expect(full).toHaveLength(6);
    expect(lod).toEqual(full);
  });

  it('[legacy-ten] 降档砍 3 个图元（L0a / L3b / L4′），中心孔与 L1 主体恒在', () => {
    const full = emitLegacyTen({ targetColorIdx: 0, scale: WAVE_SCALE_PEAK });
    const lod = emitLegacyTen({ targetColorIdx: 0, scale: WAVE_SCALE_PEAK, lodLayers: WAVE_BEAD_LOD_LAYERS });
    // 旧集为 4 条（L4 三条里砍 L4a/L4b）；L4 已并为一枚椭圆高光 ⇒ 降档只砍该 1 条。
    expect(full.length - lod.length).toBe(3);
    expect(lod.length).toBeGreaterThan(0);
    // 孔 = 识别红线，降档后仍在。
    expect(lod.filter((c) => c.kind === 'circle')).toHaveLength(2);
  });

  it('[legacy-ten] ⛔ 珠体函数不输出底图；`lift` 把整颗珠（含孔）一起抬（§1.6.1 P0 陷阱 #2）', () => {
    // 两侧同走降档 ⇒ 图元集相同，唯一变量 = `lift`。
    const still = emitLegacyTen({ targetColorIdx: 0, lodLayers: WAVE_BEAD_LOD_LAYERS });
    const lifted = emitLegacyTen({ targetColorIdx: 0, lift: WAVE_LIFT_PX, lodLayers: WAVE_BEAD_LOD_LAYERS });
    // B0 已上提为独立函数 ⇒ 珠体输出里根本不存在 pitch 宽图元，
    // “底图被抬走”在结构上不可发生（旧判据靠比对两条 rect，现在由签名保）。
    const rectAt = (cmds: readonly DrawCommand[], i: number): RectCommand => {
      const c = cmds[i]!;
      expect(c.kind).toBe('rect');
      return c as RectCommand;
    };
    expect(still.some((c) => c.kind === 'rect' && c.w === BEAD_PITCH)).toBe(false);
    // ① 位移：拿孔心（= 珠心，无其他修正）量 ⇒ 恰好等于 lift（rect.y 已不能当尺，
    //    因为 size 与 shadowDy 也会随 lift 变）。
    const holeY = (cmds: readonly DrawCommand[]): number =>
      (cmds.filter((c) => c.kind === 'circle')[0] as { y: number }).y;
    expect(holeY(lifted) - holeY(still)).toBeCloseTo(WAVE_LIFT_PX, 6);
    // ② 投影随高度变淡 —— 降档集里 L0a 已砍 ⇒ **L0b 是第 0 条**（不是非降档时的第 1 条）；
    //    ③ 接触面本就在降档集外，其三通道断言由 `bead-render.test` 专例负责。
    const alphaOf = (c: RectCommand): number =>
      Number(/([\d.]+)\)$/.exec(c.fill ?? '')?.[1] ?? NaN);
    expect(alphaOf(rectAt(lifted, 0))).toBeLessThan(alphaOf(rectAt(still, 0)));
    // ④ 侧壁随高度变长（降档后：第 1 条 = L1 主体、第 2 条 = L2′ 侧壁）。
    expect(rectAt(lifted, 2).h).toBeGreaterThan(rectAt(still, 2).h);
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

// ───────────────── §5 选中抬起 · 格级分离影（四棱基线补做）

describe('§5 选中抬起 · 格级分离影（`bead-visual-style-spec §11.6`）', () => {
  /** 空盘 + 一颗色 1 的错位珠（(1,2) 底色 ≠ 1 ⇒ 可作板锚），**尚未选中**。 */
  function mkMisplaced(saveKey: string): Harness {
    const h = createBeadsHarness({
      seed: 'lift-shadow',
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey,
    });
    h.game.goToLevel(0);
    expect(h.game.grid.fill(1, 2, 1)).toBe(true);
    return h;
  }

  /** 帧内的分离影：宽 = 缩放后格径 × `liftShadowW` 的 rect（该宽度无第二持有者）。 */
  function pills(snap: BeadsSnapshot): RectCommand[] {
    const w = snap.gridCell * BEAD_CARD.liftShadowW;
    return renderSnap(snap).filter(
      (c): c is RectCommand => c.kind === 'rect' && Math.abs(c.w - w) < 1e-9,
    );
  }

  it('静息零影 ⇒ 抬起后每颗抬起格 +1 条，且为**实色**（不破四棱 0 真 α）', () => {
    const h = mkMisplaced('wxgame.beads.test.lift-shadow-count');
    expect(pills(h.game.snapshot)).toHaveLength(0); // 未选中 = 无分离影
    expect(h.game.selectBoardBead(1, 2)).toBe(true);
    h.advance(SELECT_LIFT_MS / 1000 + 0.02);
    const got = pills(h.game.snapshot);
    expect(got).toHaveLength(1); // 组内 1 颗 ⇒ 恰 +1 条命令
    expect(String(got[0]!.fill).startsWith('rgba')).toBe(false);
    // 色源 = 本格目标色的 `pit` 端点（零新 hex、与同格凹槽坑底同源）
    expect(got[0]!.fill).toBe(endpointOf(DEMO_BEAD_INKS, h.game.grid.requiredColor(1, 2)).pit);
  });

  it('影钉在格面：中途帧与满帧同坐标（分离量由珠升起露出，不跟物体搬家）', () => {
    const h = mkMisplaced('wxgame.beads.test.lift-shadow-fixed');
    expect(h.game.selectBoardBead(1, 2)).toBe(true);
    h.advance(SELECT_LIFT_MS / 2000);
    expect(h.game.snapshot.liftProgress).toBeLessThan(1); // 斜坡仍在途 ⇒ 本例非平凡
    const mid = pills(h.game.snapshot)[0]!;
    h.advance(SELECT_LIFT_MS / 1000);
    const full = pills(h.game.snapshot)[0]!;
    expect(full.y).toBe(mid.y);
    expect(full.x).toBe(mid.x);
    // 不越出本格：影底缘 ≥ 格面下缘（否则压到邻格底图 = 串形）。
    const snap = h.game.snapshot;
    const cellBottom =
      snap.gridTop - snap.gridCell / 2 - snap.gridPitch * 1 - snap.gridPitch / 2;
    expect(full.y).toBeGreaterThanOrEqual(cellBottom);
  });

  it('抬起量走等比：恒等档逐位不变、缩档随 `gridCell` 同比缩（K-077 同族）', () => {
    const h = mkMisplaced('wxgame.beads.test.lift-shadow-zoom');
    expect(h.game.selectBoardBead(1, 2)).toBe(true);
    h.advance(SELECT_LIFT_MS / 1000 + 0.02);
    const base = h.game.snapshot;
    // 本夹具必须在恒等档，否则下一条“逐位不变”不是它想输的断言。
    expect(base.gridCell).toBe(BEAD_CELL);
    const at = (z: number) => {
      const s: BeadsSnapshot = { ...base, gridCell: base.gridCell * z, gridPitch: base.gridPitch * z };
      const bead = liftedBead(s);
      return { lift: bead.y - (s.gridTop - s.gridCell / 2 - s.gridPitch * 1), r: bead.r, cell: s.gridCell };
    };
    const one = at(1);
    // ① 恒等档乘子恰为 1 ⇒ 旧行为逐位不变（seal / 「1 点击 = 1 珠」类判据的前提）
    expect(one.lift).toBe(SELECT_LIFT_PX);
    // ② 缩档/胀档下抬起量与珠体/影/底图同源 ⇒ 间隙占格径比例恒定（修复前三个档恒为 6）
    for (const z of [0.75, 1.5, 3]) {
      const got = at(z);
      expect(got.lift).toBeCloseTo(SELECT_LIFT_PX * z, 9);
      /** ③ 孔径/格径 恒定 = 放大通道未超发（`liftT` 按**当前档**归一 + `Math.min(1,·)` 钉 C5 峰值；
       *  分母若仍吃静息值，z=3 时本值会多 7.7% ⇒ 间隙比例从 0.0787 跌到 0.0493）。
       *
       * ⚠ **WXG-T-214 口径更替**：孔径末端取整（半径取整 ⇒ 直径偶数设计 px，用户拍板）
       * ⇒ 严格等比被打破**最多半像素**：小尺度档上比例偏差可达 ~11%（z=0.75 档珠面 19.5 ⇒
       * r 4.29→4）。判别力仍在：等比未超发的偏差是 7.7%，而量化误差**恒 ≤ 0.5px** ⇒
       * 改写成「|r − 等比期望| ≤ 0.5px」，比原 12 位小数等值断言**更弱但仍有判别力**，
       * ⛔ 不得写成 `toBeCloseTo(…, 0)` 之类的无意义容差。 */
      const wantR = (one.r / one.cell) * got.cell;
      // ⛔ 不得写回 `toBeCloseTo(…, 12)`：量化后小尺度档必然偏离（恒等档 r 本身已取整 5.95→6）。
      // 判别力核算：真超发（分母吃静息值）在 z=3 给 +7.7% ⇒ |r−期望| ≈ 1.0px > 0.5 ⇒ 仍红。
      expect(Math.abs(got.r - wantR)).toBeLessThanOrEqual(0.5);
    }
  });
});

// ───────────── §5 抬起曲线与错峰（v1.5-r16 · ease-in-out + 回弹 + 组内错峰）

describe('§5 抬起曲线与错峰（v1.5-r16）', () => {
  /** 两颗同色错位珠的组（列 2 底 = 3 ⇒ 色 1 恒为错位），锚 = (2,2)。 */
  function mkPairGroup(saveKey: string): Harness {
    const h = createBeadsHarness({
      seed: 'lift-stagger',
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey,
    });
    h.game.goToLevel(0);
    expect(h.game.grid.fill(1, 2, 1)).toBe(true);
    expect(h.game.grid.fill(2, 2, 1)).toBe(true);
    expect(h.game.selectBoardBead(2, 2)).toBe(true);
    expect(h.game.snapshot.boardGroupCount).toBe(2);
    return h;
  }

  it('liftEase：两端精确、峰值 = 1+REBOUND 在 PEAK_T、起手缓（非旧 ease-out 的即跳）', () => {
    expect(liftEase(0)).toBe(0);
    expect(liftEase(1)).toBe(1); // 稳态抬起量不变 ⇒ 现有 Δy 类判据不漂
    expect(liftEase(SELECT_LIFT_PEAK_T)).toBeCloseTo(1 + SELECT_LIFT_REBOUND, 9);
    const samples: number[] = [];
    for (let i = 0; i <= 100; i++) samples.push(liftEase(i / 100));
    expect(Math.max(...samples)).toBeCloseTo(1 + SELECT_LIFT_REBOUND, 6); // 过冲存在且不越此值
    expect(Math.min(...samples)).toBe(0); // 全程不下穿底面
    // ease-in 起步：首帧斜率远低于线性（旧 easeOutQuad 首帧斜率 = 2 ⇒ “啪地弹上去”的来源）
    expect((liftEase(0.02) - liftEase(0)) / 0.02).toBeLessThan(0.25);
    expect(liftEase(0.9)).toBeGreaterThan(1); // 峰后仍在回落途中，不是一步到位
  });

  it('liftStaggerPhase：组尾晚起；p=0 全 0、p=1 全到位（不留悬珠）；lastRank=0 退化无错峰', () => {
    expect(liftStaggerPhase(0, 0, 5)).toBe(0);
    expect(liftStaggerPhase(0, 5, 5)).toBe(0);
    expect(liftStaggerPhase(1, 0, 5)).toBe(1);
    expect(liftStaggerPhase(1, 5, 5)).toBe(1);
    expect(liftStaggerPhase(0.6, 5, 5)).toBeLessThan(liftStaggerPhase(0.6, 0, 5));
    expect(liftStaggerPhase(0.5, 0, 0)).toBeCloseTo(0.5 / (1 - SELECT_LIFT_STAGGER), 9);
  });

  it('帧级：中途帧锚珠高于组尾珠（从锚揭开），满帧两者等高（错峰收敛）', () => {
    const h = mkPairGroup('wxgame.beads.test.lift-stagger-frame');
    h.advance((SELECT_LIFT_MS * 0.6) / 1000);
    const mid = h.game.snapshot;
    const anchorLift = liftedBeadAt(mid, 2, 2).y - cellCenterY(mid, 2);
    const tailLift = liftedBeadAt(mid, 1, 2).y - cellCenterY(mid, 1);
    expect(anchorLift).toBeGreaterThan(tailLift);
    h.advance(SELECT_LIFT_MS / 1000);
    const full = h.game.snapshot;
    expect(liftedBeadAt(full, 2, 2).y - cellCenterY(full, 2)).toBe(SELECT_LIFT_PX);
    expect(liftedBeadAt(full, 1, 2).y - cellCenterY(full, 1)).toBe(SELECT_LIFT_PX);
  });

  it('D1（reduceMotion）不走曲线与错峰 ⇒ 同帧整组直接到位（静态）', () => {
    const h = mkPairGroup('wxgame.beads.test.lift-stagger-d1');
    const d1: BeadsSnapshot = { ...h.game.snapshot, reduceMotion: true, liftProgress: 0 };
    expect(liftedBeadAt(d1, 2, 2).y - cellCenterY(d1, 2)).toBe(SELECT_LIFT_PX);
    expect(liftedBeadAt(d1, 1, 2).y - cellCenterY(d1, 1)).toBe(SELECT_LIFT_PX);
  });
});
