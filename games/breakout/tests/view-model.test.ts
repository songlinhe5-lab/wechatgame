import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type CompiledBrick, type DrawCommand } from '@wxgame/framework';
import { DEFAULT_TUNING } from '../src/config/tuning.js';
import { createSnapshot, type BreakoutSnapshot } from '../src/game/state.js';
import { DEFAULT_PALETTE, shade, withAlpha } from '../src/view/palette.js';
import { brickRenderFill, buildBreakoutView, formatScore } from '../src/view/view-model.js';

const T = DEFAULT_TUNING;

function brick(overrides: Partial<CompiledBrick> = {}): CompiledBrick {
  return {
    col: 0,
    row: 0,
    type: '1',
    maxHp: 1,
    hp: 1,
    score: 10,
    color: '#4cc9f0',
    indestructible: false,
    damage: 1,
    x: 375,
    y: 900,
    width: 72,
    height: 40,
    destroyed: false,
    ...overrides,
  };
}

function snapshot(overrides: Partial<BreakoutSnapshot> = {}): BreakoutSnapshot {
  const snap = createSnapshot(T);
  Object.assign(snap, {
    phase: 'playing' as const,
    levelIndex: 0,
    levelName: 'Warm-up',
    levelCount: 6,
    score: 1234,
    bestScore: 4321,
    lives: 3,
    remainingBricks: 2,
    totalBricks: 4,
    paddleX: 375,
    paddleY: T.paddle.y,
    paddleWidth: T.paddle.width,
    paddleHeight: T.paddle.height,
    ballX: 400,
    ballY: 500,
    ballRadius: T.ball.radius,
    ballResting: false,
    bricks: [brick()],
    ...overrides,
  });
  return snap;
}

function render(snap: BreakoutSnapshot) {
  const builder = new RenderModelBuilder(T.width, T.height);
  builder.begin();
  buildBreakoutView(builder, snap, DEFAULT_PALETTE);
  return builder.end();
}

const texts = (cmds: readonly DrawCommand[]) =>
  cmds.filter((c): c is Extract<DrawCommand, { kind: 'text' }> => c.kind === 'text');
const circles = (cmds: readonly DrawCommand[]) =>
  cmds.filter((c): c is Extract<DrawCommand, { kind: 'circle' }> => c.kind === 'circle');
const rects = (cmds: readonly DrawCommand[]) =>
  cmds.filter((c): c is Extract<DrawCommand, { kind: 'rect' }> => c.kind === 'rect');

describe('formatScore', () => {
  it('zero-pads to six digits', () => {
    expect(formatScore(0)).toBe('000000');
    expect(formatScore(42)).toBe('000042');
    expect(formatScore(123456)).toBe('123456');
  });

  it('floors and clamps negatives', () => {
    expect(formatScore(99.9)).toBe('000099');
    expect(formatScore(-5)).toBe('000000');
  });
});

describe('palette helpers', () => {
  it('shades toward black and white', () => {
    expect(shade('#808080', -1)).toBe('#000000');
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', 0)).toBe('#808080');
  });

  it('accepts 3-digit hex', () => {
    expect(shade('#fff', 0)).toBe('#ffffff');
  });

  it('builds rgba strings', () => {
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
  });
});

describe('brickRenderFill', () => {
  it('returns the authored colour at full hp', () => {
    expect(brickRenderFill(brick({ maxHp: 3, hp: 3 }))).toBe('#4cc9f0');
  });

  it('darkens a damaged brick', () => {
    expect(brickRenderFill(brick({ maxHp: 3, hp: 1 }))).toBe(shade('#4cc9f0', -0.45));
  });

  it('never darkens an indestructible brick', () => {
    expect(brickRenderFill(brick({ indestructible: true, maxHp: 1, hp: 1 }))).toBe('#4cc9f0');
  });
});

describe('buildBreakoutView', () => {
  it('sets the background from the palette', () => {
    expect(render(snapshot()).background).toBe(DEFAULT_PALETTE.background);
  });

  it('draws the arena frame', () => {
    const model = render(snapshot());
    // 4 walls + fill plate + HUD bar track (at minimum).
    expect(model.commands.filter((c) => c.kind === 'line').length).toBeGreaterThanOrEqual(4);
  });

  it('draws one rect per live brick and skips destroyed ones', () => {
    const live = brick({ x: 100, y: 1000 });
    const dead = brick({ x: 200, y: 1000, destroyed: true });
    const model = render(snapshot({ bricks: [live, dead] }));
    const brickRects = rects(model.commands).filter((r) => r.y > 900 && r.h === 40);
    expect(brickRects).toHaveLength(1);
  });

  it('adds hp pips only to multi-hp bricks', () => {
    const single = render(snapshot({ bricks: [brick({ maxHp: 1, hp: 1 })] }));
    const multi = render(snapshot({ bricks: [brick({ maxHp: 3, hp: 3 })] }));
    expect(circles(multi.commands).length).toBeGreaterThan(circles(single.commands).length);
  });

  it('cross-hatches indestructible bricks', () => {
    const model = render(snapshot({ bricks: [brick({ indestructible: true })] }));
    expect(model.commands.filter((c) => c.kind === 'line').length).toBeGreaterThanOrEqual(6);
  });

  it('draws the ball as a glow plus a core', () => {
    const model = render(snapshot({ ballX: 123, ballY: 456 }));
    const ballCircles = circles(model.commands).filter((c) => c.y > 400 && c.y < 500 && c.x === 123);
    expect(ballCircles.length).toBeGreaterThanOrEqual(2);
  });

  it('draws the paddle at the snapshot position and width', () => {
    const model = render(snapshot({ paddleX: 200, paddleWidth: 140 }));
    const paddle = rects(model.commands).find((r) => r.y === T.paddle.y - T.paddle.height / 2 && r.h === T.paddle.height);
    expect(paddle).toBeDefined();
    expect(paddle!.x).toBe(200 - 70);
    expect(paddle!.w).toBe(140);
  });

  it('renders the HUD score, board counter and life pips', () => {
    const model = render(snapshot({ score: 4321, levelIndex: 2, levelCount: 6, lives: 2 }));
    const labels = texts(model.commands).map((t) => t.text);
    expect(labels).toContain('004321');
    expect(labels).toContain('BOARD 3/6');
    expect(labels.some((l) => l.startsWith('BEST'))).toBe(true);
    const lifePips = circles(model.commands).filter((c) => c.y > 1250 && c.r === 8);
    expect(lifePips.length).toBeGreaterThanOrEqual(T.rules.lives);
  });

  it('fills the progress bar proportionally to cleared bricks', () => {
    const bars = (cmds: readonly DrawCommand[]) =>
      rects(cmds).filter((r) => r.h === 8 && r.y === 1246);
    const none = render(snapshot({ totalBricks: 10, remainingBricks: 10 }));
    const half = render(snapshot({ totalBricks: 10, remainingBricks: 5 }));

    // Always the track; the fill only appears once something has been cleared.
    expect(bars(none.commands)).toHaveLength(1);
    expect(bars(half.commands)).toHaveLength(2);
    expect(bars(half.commands)[1]!.w).toBeCloseTo(702 * 0.5, 6);
  });

  it('shows the combo banner only above x1', () => {
    const flat = render(snapshot({ combo: 1, multiplier: 1 }));
    const hot = render(snapshot({ combo: 12, multiplier: 2.5 }));
    expect(texts(flat.commands).some((t) => t.text.startsWith('COMBO'))).toBe(false);
    expect(texts(hot.commands).some((t) => t.text === 'COMBO x2.5')).toBe(true);
  });

  it('shows a launch affordance instead of a banner while ready', () => {
    const model = render(snapshot({ phase: 'ready', banner: '', awaitingLaunch: true }));
    expect(texts(model.commands).some((t) => t.text === 'TAP TO LAUNCH')).toBe(true);
    expect(model.commands.some((c) => c.kind === 'polygon')).toBe(true);
  });

  it('renders phase banners for terminal states', () => {
    const over = render(snapshot({ phase: 'game-over', banner: 'GAME OVER', subBanner: 'Tap to retry' }));
    const labels = texts(over.commands).map((t) => t.text);
    expect(labels).toContain('GAME OVER');
    expect(labels).toContain('Tap to retry');
  });

  it('never mutates the snapshot it is given', () => {
    const snap = snapshot();
    const before = JSON.stringify({ ...snap, bricks: snap.bricks.map((b) => ({ ...b })) });
    render(snap);
    const after = JSON.stringify({ ...snap, bricks: snap.bricks.map((b) => ({ ...b })) });
    expect(after).toBe(before);
  });

  it('produces an identical model for identical snapshots (pure)', () => {
    const a = render(snapshot({ phaseElapsed: 0.5 }));
    const b = render(snapshot({ phaseElapsed: 0.5 }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('animates only the launch hint with phaseElapsed', () => {
    const a = render(snapshot({ phase: 'ready', banner: '', phaseElapsed: 0 }));
    const b = render(snapshot({ phase: 'ready', banner: '', phaseElapsed: 0.5 }));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('uses a custom palette when supplied', () => {
    const custom = { ...DEFAULT_PALETTE, background: '#123456' };
    const builder = new RenderModelBuilder(T.width, T.height);
    builder.begin();
    buildBreakoutView(builder, snapshot(), custom);
    expect(builder.end().background).toBe('#123456');
  });
});
