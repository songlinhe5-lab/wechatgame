/**
 * WXG-T-169 / ADR-0015 甲′ 相机模型判据（`board-camera.ts`）——直接对应真机三反馈：
 *   ① 缩放相对倍率、有界 [fit, fit×SPAN]（issue 2「有限度」）；
 *   ② 平移：board ≤ 视口时 offset 锁 0（居中、拖不动也拖不出屏），board > 视口时可
 *      滚到内容边界、棋盘边缘永不离开视口（issue 1 能拖 + issue 2 不拖出屏）；
 *   ③ fitCamera 初始 zoom = 含边距适配、居中不贴边（issue 3）。
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
  IDENTITY_CAMERA,
  type BoardCamera,
  CAMERA_ZOOM_MAX_SPAN,
  BEAD_PITCH,
  BEAD_GAP,
  DESIGN_W,
  BOARD_FIT_MARGIN,
} from '../src/config/tuning.js';

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
