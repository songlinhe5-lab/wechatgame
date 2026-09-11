import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  IMPLEMENTED_POWERUPS,
  ballSpeedForLevel,
  paddleLimits,
} from '../src/config/tuning.js';

describe('BreakoutTuning', () => {
  it('defines a portrait design resolution', () => {
    expect(DEFAULT_TUNING.width).toBe(750);
    expect(DEFAULT_TUNING.height).toBe(1334);
    expect(DEFAULT_TUNING.height).toBeGreaterThan(DEFAULT_TUNING.width);
  });

  /**
   * Mirrors `design/gdd/systems-index.md §3` — the frozen single source of truth.
   * If this test fails, the *code* drifted and §3 is right.
   */
  it('mirrors the frozen §3 constant table', () => {
    // §3.1 canvas & safe area
    expect(DEFAULT_TUNING.safeTopH).toBe(120);

    // §3.2 playfield
    expect(DEFAULT_TUNING.arena).toEqual({ left: 30, right: 720, top: 1240, bottom: 100 });

    // §3.3 brick grid
    expect(DEFAULT_TUNING.cols).toBe(10);
    expect(DEFAULT_TUNING.maxRows).toBe(6);
    expect(DEFAULT_TUNING.grid).toEqual({
      originX: 35,
      originY: 1203,
      cellWidth: 68,
      cellHeight: 40,
      gapX: 6,
      gapY: 6,
    });

    // §3.4 paddle & ball
    expect(DEFAULT_TUNING.paddle.width).toBe(140);
    expect(DEFAULT_TUNING.paddle.expandedWidth).toBe(196);
    expect(DEFAULT_TUNING.paddle.height).toBe(24);
    expect(DEFAULT_TUNING.paddle.y).toBe(200);
    expect(DEFAULT_TUNING.paddle.followTau).toBe(0.06);
    expect(DEFAULT_TUNING.ball.radius).toBe(12);
    expect(DEFAULT_TUNING.ball.speed).toBe(480);
    expect(DEFAULT_TUNING.ball.maxSpeed).toBe(720);
    expect(DEFAULT_TUNING.ball.minVerticalFactor).toBe(0.25);

    // §3.5 general rules
    expect(DEFAULT_TUNING.rules.lives).toBe(3);
    expect(DEFAULT_TUNING.rules.maxLives).toBe(5);
    expect(DEFAULT_TUNING.rules.comboStep).toBe(3);
    expect(DEFAULT_TUNING.rules.comboMultiplierStep).toBe(1);
    expect(DEFAULT_TUNING.rules.maxComboMultiplier).toBe(5);
    expect(DEFAULT_TUNING.powerups.dropBase).toBe(0.12);
    expect(DEFAULT_TUNING.powerups.fallSpeed).toBe(260);
    expect(DEFAULT_TUNING.powerups.missY).toBe(100);
    expect(DEFAULT_TUNING.powerups.maxOnField).toBe(3);
    expect(DEFAULT_TUNING.powerups.maxBalls).toBe(9);

    // §3.6 implemented powerups
    expect(IMPLEMENTED_POWERUPS).toEqual(['expand', 'multi', 'life']);
    expect(DEFAULT_TUNING.powerups.implemented).toEqual([...IMPLEMENTED_POWERUPS]);
  });

  it('lays the grid out inside the arena with an integer column count', () => {
    const g = DEFAULT_TUNING.grid;
    // 10 columns of 68 span 680, which is exactly the width minus both margins.
    expect(g.cellWidth * DEFAULT_TUNING.cols).toBeCloseTo(
      DEFAULT_TUNING.width - g.originX * 2,
      6,
    );
    expect(g.cellWidth).toBe(62 + 6); // BRICK_W + BRICK_GAP_X
    expect(g.cellHeight).toBe(34 + 6); // BRICK_H + BRICK_GAP_Y
    expect(g.gapX).toBeLessThan(g.cellWidth);
    expect(g.gapY).toBeLessThan(g.cellHeight);
  });

  it('keeps the rightmost brick clear of the right wall', () => {
    const g = DEFAULT_TUNING.grid;
    const brickW = g.cellWidth - (g.gapX ?? 0);
    const rightEdge = g.originX + DEFAULT_TUNING.cols * g.cellWidth - (g.gapX ?? 0) / 2;
    expect(rightEdge).toBeCloseTo(712, 6);
    expect(rightEdge).toBeLessThanOrEqual(DEFAULT_TUNING.arena.right);
    expect(brickW).toBe(62);
  });

  it('keeps the paddle inside the arena margins', () => {
    const { min, max } = paddleLimits(DEFAULT_TUNING);
    expect(min).toBeGreaterThan(DEFAULT_TUNING.arena.left);
    expect(max).toBeLessThan(DEFAULT_TUNING.arena.right);
    expect(min).toBeLessThan(max);
    expect(min).toBeCloseTo(
      DEFAULT_TUNING.arena.left + DEFAULT_TUNING.paddle.width / 2 + DEFAULT_TUNING.paddle.margin,
      6,
    );
  });

  it('clamps the fallback ball speed at the ceiling', () => {
    // Levels carry their own speed (§2.4); this is the "level omitted one" path,
    // so it must not extrapolate per level index.
    expect(ballSpeedForLevel(DEFAULT_TUNING)).toBe(DEFAULT_TUNING.ball.speed);

    const tooFast = {
      ...DEFAULT_TUNING,
      ball: { ...DEFAULT_TUNING.ball, speed: 9999 },
    };
    expect(ballSpeedForLevel(tooFast)).toBe(DEFAULT_TUNING.ball.maxSpeed);
  });

  it('keeps timing constants positive', () => {
    expect(DEFAULT_TUNING.timings.levelClearDelay).toBeGreaterThan(0);
    expect(DEFAULT_TUNING.timings.lifeLostDelay).toBeGreaterThan(0);
    expect(DEFAULT_TUNING.rules.lives).toBeGreaterThan(0);
    expect(DEFAULT_TUNING.rules.maxLives).toBeGreaterThanOrEqual(DEFAULT_TUNING.rules.lives);
  });

  it('launches the ball at a sane angle', () => {
    expect(DEFAULT_TUNING.ball.launchAngleDeg).toBeGreaterThan(0);
    expect(DEFAULT_TUNING.ball.launchAngleDeg).toBeLessThan(90);
    expect(DEFAULT_TUNING.ball.maxBounceAngleDeg).toBe(60);
    expect(DEFAULT_TUNING.ball.minVerticalFactor).toBeGreaterThan(0);
    expect(DEFAULT_TUNING.ball.minVerticalFactor).toBeLessThan(1);
  });
});
