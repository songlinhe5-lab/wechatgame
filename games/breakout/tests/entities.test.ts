import { describe, expect, it } from 'vitest';
import { Ball } from '../src/entities/ball.js';
import { Paddle } from '../src/entities/paddle.js';
import { DEFAULT_TUNING, paddleLimits } from '../src/config/tuning.js';

describe('Ball', () => {
  it('rests without velocity', () => {
    const ball = new Ball(10, 20, 16);
    ball.restOn(30, 40);
    expect([ball.x, ball.y]).toEqual([30, 40]);
    expect(ball.speed).toBe(0);
    expect(ball.launched).toBe(false);
  });

  it('launches upward at the requested angle and speed', () => {
    const ball = new Ball();
    ball.launch(100, 30, 1);
    expect(ball.launched).toBe(true);
    expect(ball.speed).toBeCloseTo(100, 6);
    expect(ball.vy).toBeGreaterThan(0); // upward
    expect(ball.vx).toBeGreaterThan(0); // rightward for side = +1
    expect(ball.vx).toBeCloseTo(50, 6);
  });

  it('launches to the left when side = -1', () => {
    const ball = new Ball();
    ball.launch(100, 30, -1);
    expect(ball.vx).toBeCloseTo(-50, 6);
    expect(ball.vy).toBeCloseTo(86.60254037844386, 6);
  });

  it('setSpeed rescales without changing direction', () => {
    const ball = new Ball();
    ball.launch(100, 30, 1);
    const ratio = ball.vx / ball.vy;
    ball.setSpeed(250);
    expect(ball.speed).toBeCloseTo(250, 6);
    expect(ball.vx / ball.vy).toBeCloseTo(ratio, 6);
  });

  it('setSpeed on a stopped ball points it straight up instead of NaN', () => {
    const ball = new Ball();
    ball.setSpeed(120);
    expect(ball.vx).toBe(0);
    expect(ball.vy).toBe(120);
    expect(Number.isNaN(ball.speed)).toBe(false);
  });

  it('enforceMinVertical lifts a near-horizontal ball and preserves speed', () => {
    const ball = new Ball();
    ball.vx = 500;
    ball.vy = 6;
    const speed = ball.speed;
    ball.enforceMinVertical(0.34);
    expect(ball.verticalFactor).toBeGreaterThanOrEqual(0.34 - 1e-9);
    expect(ball.speed).toBeCloseTo(speed, 6);
    expect(ball.vy).toBeGreaterThan(0); // keeps its original sign
  });

  it('enforceMinVertical preserves a downward direction', () => {
    const ball = new Ball();
    ball.vx = 500;
    ball.vy = -6;
    ball.enforceMinVertical(0.34);
    expect(ball.vy).toBeLessThan(0);
  });

  it('enforceMinVertical is a no-op when already steep enough', () => {
    const ball = new Ball();
    ball.vx = 10;
    ball.vy = 100;
    const before = { vx: ball.vx, vy: ball.vy };
    ball.enforceMinVertical(0.34);
    expect([ball.vx, ball.vy]).toEqual([before.vx, before.vy]);
  });

  it('clampSpeed only ever reduces speed', () => {
    const ball = new Ball();
    ball.launch(900, 20, 1);
    ball.clampSpeed(500);
    expect(ball.speed).toBeCloseTo(500, 6);
    ball.clampSpeed(1000);
    expect(ball.speed).toBeCloseTo(500, 6);
  });

  it('reflect helpers flip a single axis', () => {
    const ball = new Ball();
    ball.launch(100, 30, 1);
    const { vx, vy } = ball;
    ball.reflectX();
    expect(ball.vx).toBe(-vx);
    expect(ball.vy).toBe(vy);
    ball.reflectY();
    expect(ball.vy).toBe(-vy);
  });

  it('reports movingDown', () => {
    const ball = new Ball();
    ball.vy = -1;
    expect(ball.movingDown).toBe(true);
    ball.vy = 1;
    expect(ball.movingDown).toBe(false);
  });

  it('verticalFactor is 0 for a stationary ball', () => {
    expect(new Ball().verticalFactor).toBe(0);
  });
});

describe('Paddle', () => {
  const make = () => new Paddle(375, 150, 160, 24);

  it('exposes its bounds', () => {
    const p = make();
    expect(p.left).toBe(295);
    expect(p.right).toBe(455);
    expect(p.top).toBe(162);
    expect(p.bottom).toBe(138);
    const b = p.bounds;
    expect(b).toEqual({ x: 375, y: 150, w: 160, h: 24 });
  });

  it('clamps the target inside the arena margins', () => {
    const p = make();
    // The paddle is 160 wide here, so the limits must use its *actual* width.
    const limits = paddleLimits(DEFAULT_TUNING, p.width);
    p.setTarget(-1000, DEFAULT_TUNING);
    expect(p.targetX).toBe(limits.min);
    p.setTarget(99999, DEFAULT_TUNING);
    expect(p.targetX).toBe(limits.max);
  });

  it('eases toward the target using the §3.4 time constant', () => {
    const p = make();
    p.resetTo(0, DEFAULT_TUNING);
    const start = p.x;
    p.setTarget(start + 500, DEFAULT_TUNING);
    p.update(1 / 60, DEFAULT_TUNING);
    const moved = p.x - start;
    // Exponential smoothing: 1 - e^(-dt/tau) of the remaining distance.
    const k = 1 - Math.exp(-1 / 60 / DEFAULT_TUNING.paddle.followTau);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeCloseTo(500 * k, 4);
    expect(moved).toBeLessThan(500); // never overshoots
  });

  it('converges onto the target without overshooting', () => {
    const p = make();
    p.resetTo(375, DEFAULT_TUNING);
    p.setTarget(500, DEFAULT_TUNING);
    for (let i = 0; i < 120; i++) p.update(1 / 60, DEFAULT_TUNING);
    expect(p.x).toBeCloseTo(500, 1);
    expect(p.x).toBeLessThanOrEqual(500);
  });

  it('snaps onto a sub-pixel target instead of asymptoting', () => {
    const p = make();
    p.resetTo(375, DEFAULT_TUNING);
    p.setTarget(375.2, DEFAULT_TUNING);
    p.update(1 / 60, DEFAULT_TUNING);
    expect(p.x).toBe(375.2);
  });

  it('reports the horizontal velocity actually applied', () => {
    const p = make();
    p.resetTo(0, DEFAULT_TUNING);
    p.setTarget(300, DEFAULT_TUNING);
    p.update(0.1, DEFAULT_TUNING);
    expect(p.vx).toBeGreaterThan(0);
    p.update(0, DEFAULT_TUNING);
    expect(p.vx).toBe(0);
  });

  it('resetTo clears velocity and re-clamps', () => {
    const p = make();
    const limits = paddleLimits(DEFAULT_TUNING, p.width);
    p.resetTo(-500, DEFAULT_TUNING);
    expect(p.vx).toBe(0);
    expect(p.x).toBe(limits.min);
    expect(p.targetX).toBe(p.x);
  });

  it('setWidth keeps the paddle inside the arena', () => {
    const p = make();
    p.resetTo(paddleLimits(DEFAULT_TUNING, p.width).max, DEFAULT_TUNING);
    p.setWidth(300, DEFAULT_TUNING);
    const limits = paddleLimits(DEFAULT_TUNING, 300);
    expect(p.x).toBeLessThanOrEqual(limits.max);
    expect(p.x + p.width / 2).toBeLessThanOrEqual(DEFAULT_TUNING.arena.right);
  });
});
