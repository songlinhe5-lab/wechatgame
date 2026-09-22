/**
 * WXG-T-169 / ADR-0015 甲′ 相机模型判据（`board-camera.ts`）——直接对应真机三反馈：
 *   ① 缩放相对倍率、有界 [fit, fit×SPAN]（issue 2「有限度」）；
 *   ② 平移：board ≤ 视口时 offset 锁 0（居中、拖不动也拖不出屏），board > 视口时可
 *      滚到内容边界、棋盘边缘永不离开视口（issue 1 能拖 + issue 2 不拖出屏）；
 *   ③ fitCamera 初始 zoom = 含边距适配、居中不贴边（issue 3）；
 *   ④ **WXG-T-172 · F3 甲裁**（以实现为准）后的复位**落点**：复位档 = `fit` 初始，实际复位点
 *      只有 `_setupLevel` / `_loadStage` 两处；回菜单 / 后台隐藏当帧**不**复位（ADR-0015 §3.4）。
 */
import { describe, expect, it } from 'vitest';
import {
  applyPinch,
  applyPan,
  clampCamera,
  createGesture,
  resetCamera,
  fitCamera,
  computeFitZoom,
  type PinchInput,
} from '../src/systems/board-camera.js';
import {
  createBeadsHarness,
  simpleTestLevel,
  placeColor,
  firstEmptyCell,
  burnToRemaining,
  type Harness,
} from './helpers.js';
import type { BeadsGame } from '../src/game/beads-game.js';
import {
  IDENTITY_CAMERA,
  type BoardCamera,
  CAMERA_ZOOM_MAX_SPAN,
  BEAD_PITCH,
  BEAD_GAP,
  DESIGN_W,
  BOARD_FIT_MARGIN,
  LEVEL_TIME_MIN,
  gridLayoutFor,
} from '../src/config/tuning.js';
import { STAGE_PATTERN_POOL } from '../src/config/levels.js';

const cam = (): BoardCamera => ({ zoom: 1, offsetX: 0, offsetY: 0 });
const two = (x: number, y: number, x2: number, y2: number): PinchInput => ({
  isDown: true,
  isDown2: true,
  x,
  y,
  x2,
  y2,
});

// 6×5 小盘：放进带内富余 → fit=1（不放大）。13×12 大盘：fit<1（缩到含边距）。
const SC = 6;
const SR = 5;
const BC = 13;
const BR = 12;

describe('computeFitZoom / fitCamera（issue 3 初始适配）', () => {
  it('小盘放得下 → fit=1（不放大到超过自然尺寸）', () => {
    expect(computeFitZoom(SC, SR)).toBe(1);
  });
  it('大盘 → fit<1，且适配后棋盘确实含边距放进视口', () => {
    const fit = computeFitZoom(BC, BR);
    expect(fit).toBeLessThan(1);
    expect(fit).toBeGreaterThan(0);
    const natW = BC * BEAD_PITCH - BEAD_GAP;
    expect(natW * fit).toBeLessThanOrEqual(DESIGN_W - 2 * BOARD_FIT_MARGIN + 1e-6);
  });
  it('fitCamera 把相机设为 zoom=fit、offset=0（居中）', () => {
    const c: BoardCamera = { zoom: 9, offsetX: 50, offsetY: -50 };
    fitCamera(c, BC, BR);
    expect(c.zoom).toBeCloseTo(computeFitZoom(BC, BR), 9);
    expect(c.offsetX).toBe(0);
    expect(c.offsetY).toBe(0);
  });
  it('resetCamera 回恒等（测试基线）', () => {
    const c: BoardCamera = { zoom: 2, offsetX: 5, offsetY: 5 };
    resetCamera(c);
    expect(c.zoom).toBe(IDENTITY_CAMERA.zoom);
    expect(c.offsetX).toBe(0);
    expect(c.offsetY).toBe(0);
  });
});

describe('applyPinch（issue 2 缩放有界）', () => {
  it('single finger is not a pinch (false, unchanged)', () => {
    const c = cam();
    const g = createGesture();
    const one: PinchInput = { isDown: true, isDown2: false, x: 10, y: 10, x2: 0, y2: 0 };
    expect(applyPinch(one, c, g, SC, SR)).toBe(false);
    expect(c.zoom).toBe(1);
  });
  it('anchors on 2nd finger landing without a jump', () => {
    const c = cam();
    c.zoom = 2;
    const g = createGesture();
    expect(applyPinch(two(100, 100, 200, 100), c, g, SC, SR)).toBe(true);
    expect(c.zoom).toBe(2);
    expect(g.pinchDist0).toBeCloseTo(100, 6);
  });
  it('spread/pinch drives zoom by the relative ratio', () => {
    const c = cam();
    const g = createGesture();
    applyPinch(two(0, 0, 100, 0), c, g, SC, SR); // anchor 100, zoom0=1
    applyPinch(two(0, 0, 200, 0), c, g, SC, SR); // ratio 2 → 2
    expect(c.zoom).toBeCloseTo(2, 6);
  });
  it('clamps to [fit, fit × CAMERA_ZOOM_MAX_SPAN]', () => {
    const fit = computeFitZoom(SC, SR);
    const c = cam();
    const g = createGesture();
    applyPinch(two(0, 0, 100, 0), c, g, SC, SR);
    applyPinch(two(0, 0, 100000, 0), c, g, SC, SR); // huge spread → max
    expect(c.zoom).toBeCloseTo(fit * CAMERA_ZOOM_MAX_SPAN, 6);
    const c2 = cam();
    const g2 = createGesture();
    applyPinch(two(0, 0, 100, 0), c2, g2, SC, SR);
    applyPinch(two(0, 0, 0.0001, 0), c2, g2, SC, SR); // collapse → min = fit
    expect(c2.zoom).toBeCloseTo(fit, 6);
  });
  it('2nd finger up drops the anchor (no re-anchor on owner)', () => {
    const c = cam();
    const g = createGesture();
    applyPinch(two(0, 0, 100, 0), c, g, SC, SR);
    expect(g.pinchDist0).toBe(100);
    const lifted: PinchInput = { isDown: true, isDown2: false, x: 0, y: 0, x2: 100, y2: 0 };
    expect(applyPinch(lifted, c, g, SC, SR)).toBe(false);
    expect(g.pinchDist0).toBe(0);
  });
});

describe('applyPan + clampCamera（issue 1 能拖 / issue 2 拖不出屏）', () => {
  it('board ≤ 视口（fit 视图）→ offset 锁 0，拖不动也拖不出屏', () => {
    const c = cam();
    fitCamera(c, SC, SR); // 6×5 → zoom=1，放进带富余
    applyPan(9999, -9999, c, SC, SR);
    expect(c.offsetX).toBe(0);
    expect(c.offsetY).toBe(0);
  });
  it('放大到 board > 视口 → 可平移，但夹在内容边界（棋盘边缘不出视口）', () => {
    const fit = computeFitZoom(BC, BR);
    const c = cam();
    c.zoom = fit * CAMERA_ZOOM_MAX_SPAN; // 最大放大，棋盘远大于视口
    clampCamera(c, BC, BR);
    const boardW = (BC * BEAD_PITCH - BEAD_GAP) * c.zoom;
    const maxOffX = (boardW - DESIGN_W) / 2;
    expect(maxOffX).toBeGreaterThan(0); // 此时确有可平移余量
    applyPan(999999, 0, c, BC, BR); // 往左猛拖
    expect(c.offsetX).toBeCloseTo(maxOffX, 4); // 夹到内容边界，不再多
    applyPan(-999999, 0, c, BC, BR); // 反向
    expect(c.offsetX).toBeCloseTo(-maxOffX, 4);
  });
  it('clampCamera 顺带把越界的 zoom 拉回区间', () => {
    const c: BoardCamera = { zoom: 999, offsetX: 0, offsetY: 0 };
    clampCamera(c, SC, SR);
    expect(c.zoom).toBeCloseTo(computeFitZoom(SC, SR) * CAMERA_ZOOM_MAX_SPAN, 6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WXG-T-172 · F3 甲裁（以实现为准）⇒ 复位口径的**落点测试**（QA TC-CAM-08 的 [Node] 半边）。
//
// 判据源 = `ADR-0015 §3.4` 回写后正文：复位档 = 相机归 **fit 初始**（不是归恒等），
// 实际复位触发点 = **两处**（`_setupLevel`：换关/新局/重试/跳关；`_loadStage`：冲刺换 stage）。
// 断言一律走 `computeFitZoom(cols, rows)` **函数调用**，不钉字面 zoom：`BOARD_FIT_MARGIN` /
// `CAMERA_ZOOM_MAX_SPAN` / `BOARD_TAP_MOVE_THRESHOLD` 三个值均 `[待确认]` 工程占位，不作判据。
// 另锁一条**负向**口径（旧 §3.4 误列的复位点）：后台隐藏当帧不复位 ⇒ 见末例。「回菜单」同属
// 不复位一类（暂停面板次钮只上报意图 + 切屏归 shell，路径上不触碰相机），但那是 shell 接线 ⇒
// 本节不为其虚构断言；按新口径也**不得**写出「回菜单后当帧复位」这类断言（那本身是错的）。
// ─────────────────────────────────────────────────────────────────────────────

/** 相机权威存于玩法层私有字段（§3.3-1 / L5）；落点测试按现状读，不为此扩公开 API。 */
function cameraOf(game: BeadsGame): BoardCamera {
  return (game as unknown as { _camera: BoardCamera })._camera;
}

/** 把相机弄脏：7.5 恒在合法档 [fit, fit×SPAN] 之外 ⇒ 复位缺失必留痕，不靠巧合相等。 */
function dirtyCamera(game: BeadsGame): void {
  const c = cameraOf(game);
  c.zoom = 7.5;
  c.offsetX = 123;
  c.offsetY = -77;
}

/** 新口径核心断言：zoom 逐位等于当前棋盘的 fit（非 toBeCloseTo），offset 归零。 */
function expectFitReset(game: BeadsGame): void {
  const c = cameraOf(game);
  expect(c.zoom).toBe(computeFitZoom(game.grid.cols, game.grid.rows));
  expect(c.offsetX).toBe(0);
  expect(c.offsetY).toBe(0);
}

/** 冲刺换 stage 的复位点是私有装配函数（无公开入口；本单不为其扩 API）。 */
function loadStageForTest(game: BeadsGame, n: number): void {
  (game as unknown as { _loadStage(n: number): void })._loadStage(n);
}

/** 13×12 大盘（与第 8 关同尺寸 ⇒ fit<1）；时长取关卡下沿，只为重试例少烧表。 */
function bigTestLevel(): ReturnType<typeof simpleTestLevel> {
  return simpleTestLevel({
    id: 91,
    cols: BC,
    rows: BR,
    time: LEVEL_TIME_MIN,
    pattern: Array.from({ length: BR }, () => '1231231231231'),
  });
}

/** 6×5 小盘（屏内容得下 ⇒ fit=1 恒等档）；不依赖 shipped 关卡数据。 */
function smallTestLevel(): ReturnType<typeof simpleTestLevel> {
  return simpleTestLevel({
    id: 92,
    cols: SC,
    rows: SR,
    time: LEVEL_TIME_MIN,
    pattern: Array.from({ length: SR }, () => '123123'),
  });
}

/** 把当前 stage 打到完成（直接投放，不走时间）；与 `sprint.test.ts` 同形。 */
function fillCurrentStage(h: Harness): void {
  const game = h.game;
  const stage = game.stageIndex;
  let guard = 0;
  while (!game.grid.isComplete() && game.phase === 'playing' && game.stageIndex === stage) {
    const cell = firstEmptyCell(game);
    if (!cell) break;
    if (!placeColor(game, game.grid.requiredColor(cell.row, cell.col), cell.row, cell.col)) break;
    if (++guard > 5000) throw new Error('fillCurrentStage: ran away');
  }
}

describe('复位落点 = fit 初始（WXG-T-172 / ADR-0015 §3.4 · TC-CAM-08）', () => {
  it('换关（_setupLevel）：13×12 大盘归 fit，且 fit<1 ⇒ 与旧「恒等」档不等价', () => {
    // 受控夹具（先例 = 同文件小盘例喂 smallTestLevel、retry 例喂 bigTestLevel）：
    // 旧版 `goToLevel(7)` + `LEVELS[7 % LEVELS.length]` 是对**出货关表**的巧合耦合 ——
    // 索引 7 在「钳到末关」与「取模」两种映射下落不到同一关，v1.46 关表重置（8 关 → studio 三关）即失配。
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [smallTestLevel(), bigTestLevel()],
      saveKey: 'wxgame.beads.test.cam172-switch-big',
    });
    expect(h.game.levelIndex).toBe(0);
    dirtyCamera(h.game);

    h.game.goToLevel(1); // 6×5 → 13×12（换关即重算 fit）

    expect(h.game.grid.cols).toBe(BC);
    expect(h.game.grid.rows).toBe(BR);
    expect(computeFitZoom(BC, BR)).toBeLessThan(1); // 大盘不再 zoom=1
    expectFitReset(h.game);
  });

  it('换关（_setupLevel）：6×5 小盘 fit=1，与旧恒等档逐位相同（回归锚）', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [smallTestLevel()],
      saveKey: 'wxgame.beads.test.cam172-switch-small',
    });
    dirtyCamera(h.game);

    h.game.goToLevel(0); // 6×5

    expect(h.game.grid.cols).toBe(SC);
    expect(h.game.grid.rows).toBe(SR);
    expectFitReset(h.game);
    expect(cameraOf(h.game).zoom).toBe(IDENTITY_CAMERA.zoom); // 小盘：fit 档与恒等档重合
    // 「逐位相同」不只 zoom：整张布局在复位后的相机下应与无相机入参完全一致。
    const withCam = gridLayoutFor(SC, SR, cameraOf(h.game));
    const bare = gridLayoutFor(SC, SR);
    expect(withCam.left).toBe(bare.left);
    expect(withCam.top).toBe(bare.top);
    expect(withCam.bottom).toBe(bare.bottom);
    for (let j = 0; j < SC; j++) expect(withCam.colCenterX(j)).toBe(bare.colCenterX(j));
    for (let i = 0; i < SR; i++) expect(withCam.rowCenterY(i)).toBe(bare.rowCenterY(i));
  });

  it('重试（retryLevel → _setupLevel）：大盘重新归 fit（不是恒等）', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [bigTestLevel()],
      saveKey: 'wxgame.beads.test.cam172-retry',
    });
    expect(h.game.grid.cols).toBe(BC);
    burnToRemaining(h, 0); // 烧穿倒计时 → GAME_OVER
    expect(h.game.phase).toBe('game-over');
    dirtyCamera(h.game);

    expect(h.game.retryLevel()).toBe(true);

    expect(h.game.phase).toBe('playing');
    expectFitReset(h.game);
    expect(cameraOf(h.game).zoom).toBeLessThan(1);
  });

  it('冲刺换 stage（_loadStage）：真实链路 stage0→1 归 fit；再取大盘 stage 验「按新尺寸重算」', () => {
    const h = createBeadsHarness({ noAssemble: true, saveKey: 'wxgame.beads.test.cam172-stage' });
    h.game.startSprint();
    expect(h.game.stageIndex).toBe(0);
    dirtyCamera(h.game);

    fillCurrentStage(h); // 填满 → _completeStage 内部 _loadStage(1)

    expect(h.game.stageIndex).toBe(1);
    expect(h.count('sprint:stage')).toBe(2); // 开局横幅 + 换 stage
    expectFitReset(h.game);

    // 第二档：棋盘尺寸不同，锁住「按新尺寸重算」而非写死 1。
    // 尺寸正本 = `STAGE_PATTERN_POOL`（冲刺 stage 图案走 `buildStagePattern(n)` → pool[n % pool.length]，
    // **与出货关表无关**）；旧版拿 `LEVELS[7 % LEVELS.length]` 比对是巧合耦合，
    // v1.46 关表重置（demo 8 关 → studio 三关）后即失配。先例：同文件 retry 例喂 `bigTestLevel()`。
    dirtyCamera(h.game);
    loadStageForTest(h.game, 7);
    const stage7 = STAGE_PATTERN_POOL[7 % STAGE_PATTERN_POOL.length]!;
    expect(h.game.grid.cols).toBe(stage7[0]!.length);
    expect(h.game.grid.rows).toBe(stage7.length);
    expectFitReset(h.game);
    expect(cameraOf(h.game).zoom).toBeLessThan(1);
  });

  it('后台隐藏（onPause/onResume）当帧不复位 ⇒ 复位由下次装配承担（新口径负向锁）', () => {
    const h = createBeadsHarness({ noAssemble: true, saveKey: 'wxgame.beads.test.cam172-hide' });
    dirtyCamera(h.game);

    h.game.onPause();
    expect(h.game.phase).toBe('paused');
    expect(cameraOf(h.game).zoom).toBe(7.5); // 隐藏路径不触碰相机（旧 §3.4 误列 InputManager.reset()）
    expect(cameraOf(h.game).offsetX).toBe(123);
    h.game.onResume();
    expect(cameraOf(h.game).zoom).toBe(7.5);

    h.game.goToLevel(0); // 下一局装配 = 复位真正发生处
    expectFitReset(h.game);
  });
});
