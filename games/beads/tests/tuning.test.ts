/**
 * `config/tuning.ts` — 派生几何与纯函数（breakout `tests/tuning.test.ts` 的同位物）。
 *
 * `tuning.ts` 的**数值**真源是 `design/gdd/systems-index.md §3`（该文件自己声明 §3 优先），
 * 所以这里**不复述 §3 的数字**（两份真源必然漂移），只断言两类东西：
 *   ① 由常量派生的不变量（pitch、band 次序、布局落在设计分辨率与 band 内）；
 *   ② 纯函数的分支与边界（C1 越界回退、C6 阶梯夹取、C7 结算公式）。
 */

import { describe, it, expect } from 'vitest';
import {
  BEAD_CELL,
  BEAD_COLOR_MAX,
  BEAD_GAP,
  BEAD_PITCH,
  DEFAULT_TUNING,
  DESIGN_H,
  DESIGN_W,
  GRID_MAX_COLS,
  GRID_MAX_ROWS,
  HUD_BAND,
  POWERUP_BAND,
  PUZZLE_BAND,
  CLEAR_STAR_STEP_MS,
  SPAWN_INTERVAL_MAX,
  SPAWN_INTERVAL_MIN,
  SPRINT_TIME_DEFAULT,
  TRAY_BAND,
  TRAY_BASE_SLOTS,
  TRAY_COLS,
  TRAY_EXPAND_SLOTS,
  TRAY_GAP,
  TRAY_SLOT,
  computeClearStars,
  gridLayoutFor,
  normalSettleScore,
  stageParamsFor,
  validatedSprintTime,
} from '../src/config/tuning.js';

describe('beads tuning derivation (systems-index §3 mirrors)', () => {
  it('derives the grid pitch from cell + gap', () => {
    expect(BEAD_PITCH).toBe(BEAD_CELL + BEAD_GAP);
  });

  it('keeps the four layout bands ordered and inside the design height', () => {
    expect(HUD_BAND.yMin).toBeGreaterThan(PUZZLE_BAND.yMax);
    expect(PUZZLE_BAND.yMin).toBeGreaterThan(TRAY_BAND.yMax);
    expect(TRAY_BAND.yMin).toBeGreaterThan(POWERUP_BAND.yMax);
    expect(POWERUP_BAND.yMin).toBeGreaterThan(0);
    expect(HUD_BAND.yMax).toBeLessThanOrEqual(DESIGN_H);
  });

  it('keeps the default tuning bundle consistent with the module constants', () => {
    expect(DEFAULT_TUNING.width).toBe(DESIGN_W);
    expect(DEFAULT_TUNING.height).toBe(DESIGN_H);
    expect(DEFAULT_TUNING.sprintTime).toBe(SPRINT_TIME_DEFAULT);
    // WXG-T-063：`levelClearDelay`（自动推进占位）已退休，节奏改由「星入场逐颗 150ms」
    // 承担（ux-spec §5）；此处钉住该值，防止有人再退回「到点自动翻页」。
    expect(CLEAR_STAR_STEP_MS).toBe(150);
  });

  describe('gridLayoutFor', () => {
    it('centres the max-size board inside PUZZLE_BAND and the design width', () => {
      const layout = gridLayoutFor(GRID_MAX_COLS, GRID_MAX_ROWS);
      const width = GRID_MAX_COLS * BEAD_PITCH - BEAD_GAP;
      expect(layout.left).toBeCloseTo((DESIGN_W - width) / 2, 6);
      // Symmetric margins ⇒ the board is horizontally centred.
      expect(layout.left).toBeCloseTo(DESIGN_W - (layout.left + width), 6);
      expect(layout.left).toBeGreaterThanOrEqual(30);
      expect(layout.top).toBeLessThanOrEqual(PUZZLE_BAND.yMax);
      expect(layout.bottom).toBeGreaterThanOrEqual(PUZZLE_BAND.yMin);
      expect(layout.cols).toBe(GRID_MAX_COLS);
      expect(layout.rows).toBe(GRID_MAX_ROWS);
    });

    it('places cell centres on the §3.3 pitch formulas', () => {
      const layout = gridLayoutFor(6, 5);
      expect(layout.colCenterX(0)).toBeCloseTo(layout.left + BEAD_CELL / 2, 6);
      expect(layout.colCenterX(3) - layout.colCenterX(2)).toBeCloseTo(BEAD_PITCH, 6);
      // Row 0 is the TOP row, so centres descend as the index grows.
      expect(layout.rowCenterY(0)).toBeCloseTo(layout.top - BEAD_CELL / 2, 6);
      expect(layout.rowCenterY(2)).toBeLessThan(layout.rowCenterY(1));
    });
  });

  describe('validatedSprintTime (C1)', () => {
    it('accepts the legal band and rejects everything else', () => {
      expect(validatedSprintTime(90)).toBe(90);
      expect(validatedSprintTime(100)).toBe(100);
      expect(validatedSprintTime(120)).toBe(120);
      // Out of band → fall back to the default rather than clamping silently.
      expect(validatedSprintTime(89)).toBe(SPRINT_TIME_DEFAULT);
      expect(validatedSprintTime(121)).toBe(SPRINT_TIME_DEFAULT);
      expect(validatedSprintTime(undefined)).toBe(SPRINT_TIME_DEFAULT);
      expect(validatedSprintTime(Number.NaN)).toBe(SPRINT_TIME_DEFAULT);
      expect(validatedSprintTime(Number.POSITIVE_INFINITY)).toBe(SPRINT_TIME_DEFAULT);
    });
  });

  describe('stageParamsFor (C6 ladder)', () => {
    it('starts at the documented floor and saturates at the §3 ceilings', () => {
      // 起步档 = 最少色数 / 最小格数 / 最慢供料（供料间隔的上限）。
      expect(stageParamsFor(0)).toEqual({ colors: 3, cells: 30, interval: SPAWN_INTERVAL_MAX });
      const deep = stageParamsFor(50);
      expect(deep.colors).toBe(BEAD_COLOR_MAX);
      expect(deep.cells).toBe(GRID_MAX_COLS * GRID_MAX_ROWS);
      expect(deep.interval).toBe(SPAWN_INTERVAL_MIN);
    });

    it('is monotonic: more colours and cells, shorter intervals, never out of range', () => {
      let previous = stageParamsFor(0);
      for (let stage = 1; stage <= 20; stage++) {
        const current = stageParamsFor(stage);
        expect(current.colors).toBeGreaterThanOrEqual(previous.colors);
        expect(current.cells).toBeGreaterThanOrEqual(previous.cells);
        expect(current.interval).toBeLessThanOrEqual(previous.interval);
        expect(current.colors).toBeLessThanOrEqual(BEAD_COLOR_MAX);
        expect(current.cells).toBeLessThanOrEqual(GRID_MAX_COLS * GRID_MAX_ROWS);
        expect(current.interval).toBeGreaterThanOrEqual(SPAWN_INTERVAL_MIN);
        previous = current;
      }
    });

    it('treats negative and non-finite stages as the first rung', () => {
      expect(stageParamsFor(-3)).toEqual(stageParamsFor(0));
      expect(stageParamsFor(Number.NaN)).toEqual(stageParamsFor(0));
    });
  });

  describe('computeClearStars (§3.7 revive rating)', () => {
    it('uses starRemaining / total and caps a revived run at 2★', () => {
      expect(computeClearStars(96, 300, 0, false)).toEqual({ ratio: 0.32, stars: 3 });
      expect(computeClearStars(35.7, 300, 0, false).stars).toBe(1);
      expect(computeClearStars(60, 300, 60, true)).toEqual({ ratio: 0, stars: 1 });
      expect(computeClearStars(200, 300, 60, true).stars).toBe(2);
    });
  });

  describe('normalSettleScore (C7)', () => {
    it('applies stars ×1000 + ratio ×1000 − powerups ×50 + unused-expansion bonus', () => {
      expect(normalSettleScore(3, 1, 0, false)).toBe(4200);
      expect(normalSettleScore(2, 0.5, 3, false)).toBe(2550);
      expect(normalSettleScore(0, 0, 0, true)).toBe(0);
    });

    it('clamps stars to 0..3, ratio to 0..1 and ignores negative powerup counts', () => {
      expect(normalSettleScore(9, 0, 0, true)).toBe(3000);
      expect(normalSettleScore(-4, 0, 0, true)).toBe(0);
      expect(normalSettleScore(0, 5, 0, true)).toBe(1000);
      expect(normalSettleScore(0, -2, 0, true)).toBe(0);
      expect(normalSettleScore(1, 0.5, -5, true)).toBe(1500);
      expect(normalSettleScore(1, Number.NaN, 0, true)).toBe(1000);
    });
  });

  it('keeps tray rows inside the design width, with both capacities row-aligned', () => {
    const rowWidth = TRAY_COLS * (TRAY_SLOT + TRAY_GAP) - TRAY_GAP;
    expect(rowWidth).toBeLessThanOrEqual(DESIGN_W);
    // v1.30（WXG-T-168，用户 2026-09-18「先开一行，扩容再开第二行」）：基础 = **1 实心行**、扩展 = **+1 行**（都是 TRAY_COLS 宽）。
    expect(TRAY_BASE_SLOTS).toBe(1 * TRAY_COLS);
    expect(TRAY_EXPAND_SLOTS).toBe(1 * TRAY_COLS);
    // v1.25 带位修订：带高 234（未随 v1.30 改动，仍容 4 行态）；当前只需 2 行（126）。
    expect(TRAY_BAND.yMax - TRAY_BAND.yMin).toBeGreaterThanOrEqual(
      2 * (TRAY_SLOT + TRAY_GAP) - TRAY_GAP + 2 * 12,
    );
  });
});
