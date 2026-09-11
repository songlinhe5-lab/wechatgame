import { describe, expect, it } from 'vitest';
import { Ball } from '../src/entities/ball.js';
import { Paddle } from '../src/entities/paddle.js';
import { DEFAULT_TUNING } from '../src/config/tuning.js';
import {
  WallHit,
  applyPaddleBounce,
  computeSubSteps,
  createStepResult,
  reflectOffBox,
  resolveArenaWalls,
  stepBall,
  type Arena,
  type BrickLike,
} from '../src/systems/physics.js';

const ARENA: Arena = { left: 0, right: 750, top: 1334, bottom: 0 };
const T = DEFAULT_TUNING;

function brick(x: number, y: number, overrides: Partial<BrickLike> = {}): BrickLike {
  return {
    x,
    y,
    width: 72,
    height: 40,
    score: 10,
    color: '#4cc9f0',
    damage: 1,
    indestructible: false,
    hp: 1,
    destroyed: false,
    ...overrides,
  };
}

/** Run stepBall repeatedly; returns the first result that reports a brick hit. */
function stepUntilBrickHit(
  ball: Ball,
  paddle: Paddle,
  bricks: BrickLike[],
  maxSteps = 400,
): ReturnType<typeof createStepResult> {
  const result = createStepResult();
  for (let i = 0; i < maxSteps; i++) {
    stepBall(ball, 1 / 60, ARENA, paddle, bricks, T, result);
    if (result.bricksHit.length > 0 || result.lost) return result;
  }
  return result;
}

describe('resolveArenaWalls', () => {
  it('reflects off the left wall and pushes the ball out', () => {
    const ball = new Ball(5, 500, 16);
    ball.vx = -200;
    ball.vy = 100;
    const hits = resolveArenaWalls(ball, ARENA);
    expect(hits & WallHit.Left).toBeTruthy();
    expect(ball.x).toBe(16);
    expect(ball.vx).toBeGreaterThan(0);
  });

  it('reflects off the right wall', () => {
    const ball = new Ball(745, 500, 16);
    ball.vx = 200;
    const hits = resolveArenaWalls(ball, ARENA);
    expect(hits & WallHit.Right).toBeTruthy();
    expect(ball.x).toBe(750 - 16);
    expect(ball.vx).toBeLessThan(0);
  });

  it('reflects off the top wall', () => {
    const ball = new Ball(375, 1330, 16);
    ball.vy = 200;
    const hits = resolveArenaWalls(ball, ARENA);
    expect(hits & WallHit.Top).toBeTruthy();
    expect(ball.y).toBe(1334 - 16);
    expect(ball.vy).toBeLessThan(0);
  });

  it('reports the bottom without reflecting', () => {
    const ball = new Ball(375, 10, 16);
    ball.vy = -200;
    const hits = resolveArenaWalls(ball, ARENA);
    expect(hits & WallHit.Bottom).toBeTruthy();
    expect(ball.vy).toBe(-200); // velocity untouched; the game decides
  });

  it('does not falsely report hits in open space', () => {
    const ball = new Ball(375, 500, 16);
    ball.vx = 100;
    ball.vy = 100;
    expect(resolveArenaWalls(ball, ARENA)).toBe(WallHit.None);
  });
});

describe('reflectOffBox', () => {
  it('returns none when there is no overlap', () => {
    const ball = new Ball(0, 0, 16);
    expect(reflectOffBox(ball, { x: 0, y: 500, w: 72, h: 40 })).toBe('none');
  });

  it('resolves a vertical hit and pushes the ball below the box', () => {
    const ball = new Ball(375, 518, 16);
    ball.vy = 300;
    const axis = reflectOffBox(ball, { x: 375, y: 540, w: 72, h: 40 });
    expect(axis).toBe('y');
    expect(ball.y).toBeCloseTo(540 - 20 - 16, 6);
    expect(ball.vy).toBeLessThan(0);
  });

  it('resolves a horizontal hit and pushes the ball outside the box', () => {
    const ball = new Ball(342, 540, 16);
    ball.vx = 300;
    ball.vy = 0.001;
    const axis = reflectOffBox(ball, { x: 375, y: 540, w: 72, h: 40 });
    expect(axis).toBe('x');
    expect(ball.x).toBeLessThan(375 - 36);
    expect(ball.vx).toBeLessThan(0);
  });

  it('never reflects twice on the same axis in one call', () => {
    const ball = new Ball(375, 540, 16); // dead centre: inside the box
    ball.vy = 300;
    reflectOffBox(ball, { x: 375, y: 540, w: 72, h: 40 });
    const afterFirst = ball.vy;
    reflectOffBox(ball, { x: 375, y: 540, w: 72, h: 40 });
    expect(ball.vy).toBe(afterFirst); // already outside now
  });
});

describe('applyPaddleBounce', () => {
  it('sends the ball upward at the tuning speed', () => {
    const ball = new Ball(375, 180, 16);
    ball.vy = -T.ball.speed;
    ball.vx = 0;
    const paddle = new Paddle(375, 150, 160, 24);
    applyPaddleBounce(ball, paddle, T);
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.speed).toBeCloseTo(T.ball.speed, 6);
    expect(ball.launched).toBe(true);
  });

  it('steers left or right by contact offset', () => {
    const paddle = new Paddle(375, 150, 160, 24);
    const right = new Ball(375 + 70, 180, 16);
    right.vy = -T.ball.speed;
    applyPaddleBounce(right, paddle, T);
    expect(right.vx).toBeGreaterThan(0);

    const left = new Ball(375 - 70, 180, 16);
    left.vy = -T.ball.speed;
    applyPaddleBounce(left, paddle, T);
    expect(left.vx).toBeLessThan(0);
  });

  it('is symmetric: mirrored contacts produce mirrored angles', () => {
    const paddle = new Paddle(375, 150, 160, 24);
    const a = new Ball(375 + 50, 180, 16);
    a.vy = -T.ball.speed;
    const b = new Ball(375 - 50, 180, 16);
    b.vy = -T.ball.speed;
    applyPaddleBounce(a, paddle, T);
    applyPaddleBounce(b, paddle, T);
    expect(a.vx).toBeCloseTo(-b.vx, 6);
    expect(a.vy).toBeCloseTo(b.vy, 6);
  });

  it('clamps extreme offsets to ±1', () => {
    const paddle = new Paddle(375, 150, 160, 24);
    const far = new Ball(375 + 5000, 180, 16);
    far.vy = -T.ball.speed;
    applyPaddleBounce(far, paddle, T);
    expect(Math.abs(far.vx)).toBeLessThanOrEqual(T.ball.speed * T.ball.english + 1e-6);
  });

  it('never leaves the ball near-horizontal', () => {
    const paddle = new Paddle(375, 150, 160, 24);
    const ball = new Ball(375 + 80, 180, 16);
    ball.vy = -T.ball.speed;
    applyPaddleBounce(ball, paddle, T);
    expect(ball.verticalFactor).toBeGreaterThanOrEqual(T.ball.minVerticalFactor - 1e-9);
  });
});

describe('computeSubSteps', () => {
  it('always performs at least one step', () => {
    expect(computeSubSteps(0, 1 / 60, 16, T)).toBe(1);
    expect(computeSubSteps(1, 0, 16, T)).toBe(1);
  });

  it('increases with distance travelled', () => {
    const slow = computeSubSteps(100, 1 / 60, 16, T);
    const fast = computeSubSteps(2000, 1 / 60, 16, T);
    expect(fast).toBeGreaterThan(slow);
  });

  it('caps at the configured maximum', () => {
    expect(computeSubSteps(1e9, 1, 16, T)).toBe(T.physics.maxSubSteps);
  });

  it('never moves more than radius / divisor per sub-step', () => {
    const speed = 1500;
    const dt = 1 / 60;
    const steps = computeSubSteps(speed, dt, 16, T);
    const perStep = (speed * dt) / steps;
    expect(perStep).toBeLessThanOrEqual(16 / T.physics.subStepDivisor + 1e-9);
  });
});

describe('stepBall', () => {
  it('does nothing when the ball has not launched', () => {
    const ball = new Ball(375, 500, 16);
    const result = stepBall(ball, 1 / 60, ARENA, new Paddle(375, 150, 160, 24), [], T, createStepResult());
    expect(result.bricksHit).toEqual([]);
    expect(ball.y).toBe(500);
  });

  it('ignores non-positive dt', () => {
    const ball = new Ball(375, 500, 16);
    ball.launched = true;
    ball.vy = 500;
    stepBall(ball, 0, ARENA, new Paddle(375, 150, 160, 24), [], T, createStepResult());
    expect(ball.y).toBe(500);
  });

  it('destroys a 1-hp brick and reflects', () => {
    const ball = new Ball(375, 500, 16);
    ball.launched = true;
    ball.vy = 560;
    const bricks = [brick(375, 540)];
    const result = stepUntilBrickHit(ball, new Paddle(375, 150, 160, 24), bricks);
    expect(result.bricksHit).toHaveLength(1);
    expect(result.bricksDestroyed).toHaveLength(1);
    expect(bricks[0]!.destroyed).toBe(true);
    expect(bricks[0]!.hp).toBe(0);
    expect(ball.vy).toBeLessThan(0);
  });

  it('damages but does not destroy a 2-hp brick in one hit', () => {
    const ball = new Ball(375, 500, 16);
    ball.launched = true;
    ball.vy = 560;
    const bricks = [brick(375, 540, { hp: 2 })];
    const result = stepUntilBrickHit(ball, new Paddle(375, 150, 160, 24), bricks);
    expect(result.bricksDestroyed).toHaveLength(0);
    expect(bricks[0]!.hp).toBe(1);
    expect(bricks[0]!.destroyed).toBe(false);
  });

  it('bounces off an indestructible brick without destroying it', () => {
    const ball = new Ball(375, 500, 16);
    ball.launched = true;
    ball.vy = 560;
    const bricks = [brick(375, 540, { indestructible: true })];
    const result = stepUntilBrickHit(ball, new Paddle(375, 150, 160, 24), bricks);
    expect(result.bricksHit).toHaveLength(1);
    expect(bricks[0]!.destroyed).toBe(false);
    expect(bricks[0]!.hp).toBe(1);
    expect(ball.vy).toBeLessThan(0);
  });

  it('does not tunnel through a brick at extreme speed', () => {
    const ball = new Ball(375, 400, 16);
    ball.launched = true;
    ball.vy = 20000;
    const bricks = [brick(375, 540)];
    const result = stepBall(ball, 1 / 60, ARENA, new Paddle(375, 150, 160, 24), bricks, T, createStepResult());
    expect(result.bricksHit).toHaveLength(1);
    expect(bricks[0]!.destroyed).toBe(true);
  });

  it('flags the ball as lost when it passes the bottom', () => {
    const ball = new Ball(375, 30, 16);
    ball.launched = true;
    ball.vy = -800;
    const result = createStepResult();
    for (let i = 0; i < 30 && !result.lost; i++) {
      stepBall(ball, 1 / 60, ARENA, new Paddle(375, 150, 160, 24), [], T, result);
    }
    expect(result.lost).toBe(true);
    expect(ball.y).toBeLessThan(16);
  });

  it('bounces off the paddle when moving down onto it', () => {
    const paddle = new Paddle(375, 150, 160, 24);
    const ball = new Ball(375, 200, 16);
    ball.launched = true;
    ball.vy = -560;
    const result = createStepResult();
    for (let i = 0; i < 60 && !result.paddleBounced; i++) {
      stepBall(ball, 1 / 60, ARENA, paddle, [], T, result);
    }
    expect(result.paddleBounced).toBe(true);
    expect(result.paddleHits).toBeGreaterThan(0);
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.y).toBeGreaterThan(paddle.top);
  });

  it('does not bounce off the paddle while travelling upward', () => {
    const paddle = new Paddle(375, 150, 160, 24);
    const ball = new Ball(375, 175, 16);
    ball.launched = true;
    ball.vy = 560; // moving away
    const result = createStepResult();
    stepBall(ball, 1 / 60, ARENA, paddle, [], T, result);
    expect(result.paddleBounced).toBe(false);
  });

  it('keeps total speed constant across a rally', () => {
    const paddle = new Paddle(375, 150, 160, 24);
    const ball = new Ball(375, 400, 16);
    ball.launched = true;
    ball.vy = 560;
    ball.vx = 120;
    const speed0 = ball.speed;
    const result = createStepResult();
    for (let i = 0; i < 240; i++) {
      stepBall(ball, 1 / 60, ARENA, paddle, [], T, result);
      expect(ball.speed).toBeCloseTo(speed0, 4);
    }
  });

  it('never lets the ball sit inside the side walls after many steps', () => {
    const paddle = new Paddle(375, 150, 160, 24);
    const ball = new Ball(400, 400, 16);
    ball.launched = true;
    ball.launch(560, 60, 1); // steep angle → lots of wall bounces
    const result = createStepResult();
    for (let i = 0; i < 600; i++) {
      stepBall(ball, 1 / 60, ARENA, paddle, [], T, result);
      expect(ball.x - ball.radius).toBeGreaterThanOrEqual(ARENA.left - 1e-6);
      expect(ball.x + ball.radius).toBeLessThanOrEqual(ARENA.right + 1e-6);
    }
  });

  it('is deterministic for identical inputs', () => {
    const run = () => {
      const paddle = new Paddle(375, 150, 160, 24);
      const ball = new Ball(300, 500, 16);
      ball.launched = true;
      ball.launch(560, 35, 1);
      const bricks = [brick(300, 700), brick(400, 700)];
      const result = createStepResult();
      const trace: string[] = [];
      for (let i = 0; i < 300; i++) {
        stepBall(ball, 1 / 60, ARENA, paddle, bricks, T, result);
        trace.push(`${ball.x.toFixed(4)},${ball.y.toFixed(4)},${bricks[0]!.hp},${bricks[1]!.hp}`);
      }
      return trace;
    };
    expect(run()).toEqual(run());
  });

  it('reuses (and clears) the provided result object', () => {
    const result = createStepResult();
    const ball = new Ball(375, 500, 16);
    ball.launched = true;
    ball.vy = 560;
    stepBall(ball, 1 / 60, ARENA, new Paddle(375, 150, 160, 24), [], T, result);
    result.bricksHit.push(brick(0, 0));
    result.lost = true;
    stepBall(ball, 1 / 60, ARENA, new Paddle(375, 150, 160, 24), [], T, result);
    expect(result.bricksHit).toHaveLength(0);
    expect(result.lost).toBe(false);
  });
});
