import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type LevelDef } from '@wxgame/framework';
import { BreakoutGame } from '../src/game/breakout-game.js';
import { DEFAULT_TUNING } from '../src/config/tuning.js';
import { LEVELS } from '../src/config/levels.js';
import { aimAt, createHarness, singleBrickLevel } from './helpers.js';

const T = DEFAULT_TUNING;

/** Default settings block matching `defaultSettings()`. */
const SETTINGS = { sfx: true, music: true, vibrate: true, controlMode: 'absolute' };
/** Default stats block matching `defaultStats()`. */
const STATS = { runs: 0, clears: 0, bricksDestroyed: 0, bestCombo: 0, lastPlayedAt: 0 };

/** Serialise a v1 save document, overriding individual fields as needed. */
function saveDoc(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    maxUnlockedLevel: 1,
    allCleared: false,
    currentLevel: 1,
    bestScore: 0,
    settings: SETTINGS,
    stats: STATS,
    ...overrides,
  });
}

/** Two bricks side by side: destroying one never clears the board. */
const TWO_BRICKS: LevelDef = singleBrickLevel({ id: 'test-two', layout: ['1.1'] });

/** One indestructible obstacle plus one reachable destructible brick. */
const WITH_WALL: LevelDef = {
  id: 'test-wall',
  name: 'Wall',
  layout: ['X..', '..1'],
  legend: {
    X: { hp: 1, score: 0, color: '#4a4e69', indestructible: true },
    '1': { hp: 1, score: 10, color: '#4cc9f0' },
  },
};

/** Four bricks per row, two rows — enough to build a multiplier of x2. */
const EIGHT_BRICKS: LevelDef = singleBrickLevel({ id: 'test-eight', layout: ['1111', '1111'] });

/** Send the ball straight out of the bottom of the arena. */
function loseBall(h: ReturnType<typeof createHarness>, advance = true): void {
  h.game.ball.x = 100;
  h.game.ball.y = 30;
  h.game.ball.vx = 0;
  h.game.ball.vy = -900;
  if (advance) h.advance(0.3);
}

describe('BreakoutGame — boot & lifecycle', () => {
  it('boots into the ready phase with board 1 loaded', () => {
    const h = createHarness();
    expect(h.game.phase).toBe('ready');
    expect(h.game.levelIndex).toBe(0);
    expect(h.game.levelCount).toBe(LEVELS.length);
    expect(h.game.lives).toBe(T.rules.lives);
    expect(h.game.score).toBe(0);
    expect(h.game.remainingBricks).toBe(30); // board 1: 3 rows × 10 columns
    expect(h.game.bricks).toHaveLength(30);
  });

  it('emits run:start and level:start during init', () => {
    const h = createHarness();
    expect(h.count('run:start')).toBe(1);
    expect(h.count('level:start')).toBe(1);
    expect(h.last<{ id: string }>('level:start')!.id).toBe(LEVELS[0]!.id);
  });

  it('ignores update() before init (defensive)', () => {
    const game = new BreakoutGame();
    expect(() => game.update(1 / 60)).not.toThrow();
    expect(game.phase).toBe('ready');
  });

  it('builds a render model without mutating the game', () => {
    const h = createHarness();
    const builder = new RenderModelBuilder(T.width, T.height);
    builder.begin();
    h.game.buildRenderModel(builder);
    const model = builder.end();
    expect(model.commands.length).toBeGreaterThan(10);
    expect(h.game.phase).toBe('ready');
    expect(h.game.score).toBe(0);
  });

  it('unsubscribes its event subscriptions on dispose', () => {
    const h = createHarness();
    // The harness adds one tracking listener; the game adds one audio listener.
    expect(h.events.listenerCount('brick:destroyed')).toBe(2);
    h.game.dispose();
    expect(h.events.listenerCount('brick:destroyed')).toBe(1);

    // Behavioural proof: a brick event after dispose no longer reaches audio.
    h.events.emit('brick:destroyed', { x: 0, y: 0, color: '#fff', points: 1, combo: 1 });
    h.services.audio.flush(0.1);
    expect(h.audio.played).toEqual([]);
  });

  it('fails fast when level content is invalid', () => {
    const broken: LevelDef = {
      id: 'broken',
      name: 'Broken',
      layout: ['#', '##'], // unequal widths
      legend: { '#': { hp: 1, score: 1, color: '#fff' } },
    };
    expect(() => createHarness({ levels: [broken] })).toThrow(/row 1 has width/);
  });
});

describe('BreakoutGame — launching', () => {
  it('launches from ready into playing exactly once', () => {
    const h = createHarness();
    expect(h.game.launch()).toBe(true);
    expect(h.game.phase).toBe('playing');
    expect(h.game.launch()).toBe(false);
    expect(h.count('ball:launched')).toBe(1);
  });

  it('starts the ball upward at the level speed', () => {
    const h = createHarness();
    h.game.launch();
    expect(h.game.ball.vy).toBeGreaterThan(0);
    expect(h.game.ball.speed).toBeCloseTo(T.ball.speed, 6);
  });

  it('launches from the paddle', () => {
    const h = createHarness();
    h.game.movePaddleTo(200);
    h.advance(0.5);
    h.game.launch();
    expect(h.game.ball.x).toBeCloseTo(h.game.paddle.x, 6);
    expect(h.game.ball.y).toBeCloseTo(h.game.paddle.y + T.ball.restOffsetY, 6);
  });

  it('tracks the paddle before launch without letting the ball drift', () => {
    const h = createHarness();
    h.game.movePaddleTo(500);
    h.advance(1);
    expect(h.game.ball.x).toBeCloseTo(h.game.paddle.x, 6);
    expect(h.game.ball.y).toBeCloseTo(h.game.paddle.y + T.ball.restOffsetY, 6);
  });

  it('clamps the paddle to the arena', () => {
    const h = createHarness();
    h.game.movePaddleTo(-9999);
    h.advance(1);
    expect(h.game.paddle.x - h.game.paddle.width / 2).toBeGreaterThanOrEqual(T.arena.left);
    h.game.movePaddleTo(9999);
    h.advance(1);
    expect(h.game.paddle.x + h.game.paddle.width / 2).toBeLessThanOrEqual(T.arena.right);
  });
});

describe('BreakoutGame — bricks, scoring and combos', () => {
  it('destroys a brick, scores it and reflects the ball', () => {
    const h = createHarness({ levels: [TWO_BRICKS] });
    h.game.launch();
    aimAt(h.game, h.game.bricks[0]!);
    h.advance(0.3);

    expect(h.game.bricks[0]!.destroyed).toBe(true);
    expect(h.game.score).toBe(10);
    expect(h.game.remainingBricks).toBe(1);
    expect(h.count('brick:destroyed')).toBe(1);
    expect(h.last<{ points: number }>('brick:destroyed')!.points).toBe(10);
    expect(h.game.ball.vy).toBeLessThan(0);
  });

  it('leaves a multi-hp brick standing and reports the damage', () => {
    const level = singleBrickLevel({
      id: 'hp2',
      layout: ['1.1'],
      legend: { '1': { hp: 2, score: 25, color: '#4361ee' } },
    });
    const h = createHarness({ levels: [level] });
    h.game.launch();
    aimAt(h.game, h.game.bricks[0]!);
    h.advance(0.3);

    expect(h.game.bricks[0]!.hp).toBe(1);
    expect(h.game.bricks[0]!.destroyed).toBe(false);
    expect(h.game.score).toBe(0);
    expect(h.count('brick:damaged')).toBeGreaterThan(0);
    expect(h.game.remainingBricks).toBe(2);
  });

  it('bounces off an indestructible brick without destroying it', () => {
    const h = createHarness({ levels: [WITH_WALL] });
    h.game.launch();
    const wall = h.game.bricks.find((b) => b.indestructible)!;
    aimAt(h.game, wall);
    h.advance(0.3);

    expect(wall.destroyed).toBe(false);
    expect(wall.hp).toBe(1);
    expect(h.game.remainingBricks).toBe(1); // only the destructible brick counts
    expect(h.game.ball.vy).toBeLessThan(0);
  });

  it('builds a combo across bricks and raises the multiplier', () => {
    const h = createHarness({ levels: [EIGHT_BRICKS] });
    h.game.launch();

    // Lowest bricks first so no surviving brick blocks the aimed shot.
    const order = [...h.game.bricks].sort((a, b) => a.y - b.y);
    for (const brick of order) {
      if (brick.destroyed) continue;
      aimAt(h.game, brick);
      h.advance(0.3);
    }

    expect(h.game.bricks.every((b) => b.destroyed)).toBe(true);
    expect(h.game.combo).toBeGreaterThanOrEqual(8);
    expect(h.game.multiplier).toBeGreaterThan(1);
    expect(h.game.score).toBeGreaterThan(30);
    expect(h.count('combo:changed')).toBeGreaterThan(0);
  });

  it('resets the combo when the paddle is hit', () => {
    const h = createHarness({ levels: [singleBrickLevel({ id: 'three', layout: ['1.1', '.1.'] })] });
    h.game.launch();
    aimAt(h.game, h.game.bricks[0]!);
    h.advance(0.3);
    expect(h.game.combo).toBe(1);

    // Drop the ball straight onto the paddle.
    h.game.ball.x = h.game.paddle.x;
    h.game.ball.y = h.game.paddle.y + h.game.ball.radius + 30;
    h.game.ball.vx = 0;
    h.game.ball.vy = -400;
    h.advance(0.5);

    expect(h.count('paddle:hit')).toBeGreaterThan(0);
    expect(h.game.combo).toBe(0);
    expect(h.game.multiplier).toBe(1);
  });

  it('keeps the run deterministic for a fixed seed', () => {
    const play = () => {
      const h = createHarness({ seed: 'replay', levels: [EIGHT_BRICKS] });
      h.game.launch();
      h.advance(3);
      return h.game.ball.x + ',' + h.game.ball.y;
    };
    expect(play()).toBe(play());
  });
});

describe('BreakoutGame — lives, game over and retry', () => {
  it('loses a life, holds the banner, then returns to ready', () => {
    const h = createHarness({ levels: [TWO_BRICKS] });
    h.game.launch();
    loseBall(h);

    expect(h.game.phase).toBe('life-lost');
    expect(h.game.lives).toBe(T.rules.lives - 1);
    expect(h.count('ball:lost')).toBe(1);

    h.advance(T.timings.lifeLostDelay + 0.1);
    expect(h.game.phase).toBe('ready');
    expect(h.game.ball.launched).toBe(false);
    expect(h.game.ball.y).toBeCloseTo(h.game.paddle.y + T.ball.restOffsetY, 6);
  });

  it('resets the combo when the ball is lost', () => {
    const h = createHarness({ levels: [EIGHT_BRICKS] });
    h.game.launch();
    aimAt(h.game, h.game.bricks[0]!);
    h.advance(0.3);
    expect(h.game.combo).toBeGreaterThan(0);
    loseBall(h);
    expect(h.game.combo).toBe(0);
  });

  it('ends the run after the last life and records a new best', () => {
    const h = createHarness({ levels: [TWO_BRICKS] });
    h.game.launch();
    aimAt(h.game, h.game.bricks[0]!);
    h.advance(0.3);
    expect(h.game.score).toBe(10);

    for (let remaining = T.rules.lives; remaining > 0; remaining--) {
      if (h.game.phase === 'ready') h.game.launch();
      loseBall(h);
      if (h.game.phase === 'life-lost') h.advance(T.timings.lifeLostDelay + 0.1);
    }

    expect(h.game.phase).toBe('game-over');
    expect(h.game.lives).toBe(0);
    expect(h.count('game:over')).toBe(1);
    expect(h.last<{ isNewBest: boolean }>('game:over')!.isNewBest).toBe(true);
    expect(h.game.bestScore).toBeGreaterThanOrEqual(h.game.score);
  });

  it('retryLevel restores lives, score and brick damage on the same board', () => {
    const level = singleBrickLevel({
      id: 'hp2',
      layout: ['1.1'],
      legend: { '1': { hp: 2, score: 25, color: '#4361ee' } },
    });
    const h = createHarness({ levels: [level] });
    h.game.launch();
    aimAt(h.game, h.game.bricks[0]!);
    h.advance(0.3);
    expect(h.game.bricks[0]!.hp).toBe(1);

    h.game.retryLevel();
    expect(h.game.phase).toBe('ready');
    expect(h.game.lives).toBe(T.rules.lives);
    expect(h.game.score).toBe(0);
    expect(h.game.bricks[0]!.hp).toBe(2);
    expect(h.game.bricks[0]!.destroyed).toBe(false);
    expect(h.game.levelIndex).toBe(0);
  });

  it('restartRun returns to board 1', () => {
    const h = createHarness();
    h.game.goToLevel(3);
    expect(h.game.levelIndex).toBe(3);
    h.game.restartRun();
    expect(h.game.levelIndex).toBe(0);
    expect(h.game.phase).toBe('ready');
  });
});

describe('BreakoutGame — level progression and victory', () => {
  it('clears a board, pays a bonus and advances', () => {
    const a = singleBrickLevel({ id: 'a', name: 'A' });
    const b = singleBrickLevel({ id: 'b', name: 'B', layout: ['..1'] });
    const h = createHarness({ levels: [a, b] });

    h.game.launch();
    aimAt(h.game, h.game.bricks[0]!);
    h.advance(0.3);

    expect(h.game.phase).toBe('level-clear');
    expect(h.count('level:clear')).toBe(1);
    expect(h.game.score).toBeGreaterThan(10); // base + clear bonus

    h.advance(T.timings.levelClearDelay + 0.2);
    expect(h.game.levelIndex).toBe(1);
    expect(h.game.phase).toBe('ready');
    expect(h.game.bricks).toHaveLength(1);
    expect(h.game.remainingBricks).toBe(1);
  });

  it('reaches victory after the final board', () => {
    const h = createHarness({ levels: [singleBrickLevel()] });
    h.game.launch();
    aimAt(h.game, h.game.bricks[0]!);
    h.advance(0.3);
    expect(h.game.phase).toBe('level-clear');

    h.advance(T.timings.levelClearDelay + 0.2);
    expect(h.game.phase).toBe('victory');
    expect(h.count('victory')).toBe(1);
  });

  it('goToLevel clamps out-of-range indices', () => {
    const h = createHarness();
    h.game.goToLevel(999);
    expect(h.game.levelIndex).toBe(LEVELS.length - 1);
    h.game.goToLevel(-5);
    expect(h.game.levelIndex).toBe(0);
  });

  it('applies per-board paddle and ball overrides', () => {
    const narrow = singleBrickLevel({ id: 'n', layout: ['1'], paddleWidth: 100, ballRadius: 10 });
    const h = createHarness({ levels: [narrow] });
    expect(h.game.paddle.width).toBe(100);
    expect(h.game.ball.radius).toBe(10);
  });

  it('uses the board speed override when launching', () => {
    const fast = singleBrickLevel({ id: 'f', layout: ['1'], ballSpeed: 900 });
    const h = createHarness({ levels: [fast] });
    h.game.launch();
    expect(h.game.ball.speed).toBeCloseTo(900, 6);
  });

  it('restores overridden paddle width after leaving the board', () => {
    const narrow = singleBrickLevel({ id: 'n', layout: ['1'], paddleWidth: 100 });
    const normal = singleBrickLevel({ id: 'm', layout: ['1'] });
    const h = createHarness({ levels: [narrow, normal] });
    expect(h.game.paddle.width).toBe(100);
    h.game.goToLevel(1);
    expect(h.game.paddle.width).toBe(T.paddle.width);
  });
});

describe('BreakoutGame — pause / resume', () => {
  it('pauses, freezes and resumes to the previous phase', () => {
    const h = createHarness();
    h.game.launch();
    expect(h.game.phase).toBe('playing');
    h.game.onPause();
    expect(h.game.phase).toBe('paused');

    const y = h.game.ball.y;
    h.advance(0.5);
    expect(h.game.ball.y).toBe(y);

    h.game.onResume();
    expect(h.game.phase).toBe('playing');
  });

  it('pause is idempotent', () => {
    const h = createHarness();
    h.game.onPause();
    h.game.onPause();
    expect(h.game.phase).toBe('paused');
    h.game.onResume();
    expect(h.game.phase).toBe('ready');
  });

  it('ignores launch while paused', () => {
    const h = createHarness();
    h.game.onPause();
    expect(h.game.launch()).toBe(false);
    expect(h.game.phase).toBe('paused');
  });
});

describe('BreakoutGame — input plumbing', () => {
  it('converts a screen tap into paddle movement', () => {
    const h = createHarness();
    h.input.beginFrame();
    h.input.push({ id: 0, x: 600, y: 100, phase: 'down', time: 0 });
    h.game.update(1 / 60);
    expect(h.game.paddle.targetX).toBeGreaterThan(375);
    h.input.endFrame(1 / 60);
  });

  it('a tap while ready launches the ball', () => {
    const h = createHarness();
    h.input.beginFrame();
    h.input.push({ id: 0, x: 375, y: 100, phase: 'down', time: 0 });
    h.game.update(1 / 60);
    expect(h.game.phase).toBe('playing');
    h.input.endFrame(1 / 60);
  });

  it('a tap while game-over retries the board', () => {
    const h = createHarness({ levels: [TWO_BRICKS] });
    for (let remaining = T.rules.lives; remaining > 0; remaining--) {
      if (h.game.phase === 'ready') h.game.launch();
      loseBall(h);
      if (h.game.phase === 'life-lost') h.advance(T.timings.lifeLostDelay + 0.1);
    }
    expect(h.game.phase).toBe('game-over');

    h.input.beginFrame();
    h.input.push({ id: 0, x: 375, y: 100, phase: 'down', time: 0 });
    h.game.update(1 / 60);
    h.input.endFrame(1 / 60);

    expect(h.game.phase).toBe('ready');
    expect(h.game.lives).toBe(T.rules.lives);
  });

  it('a tap while paused resumes', () => {
    const h = createHarness();
    h.game.onPause();
    h.input.beginFrame();
    h.input.push({ id: 0, x: 375, y: 100, phase: 'down', time: 0 });
    h.game.update(1 / 60);
    h.input.endFrame(1 / 60);
    expect(h.game.phase).not.toBe('paused');
  });
});

describe('BreakoutGame — audio and persistence', () => {
  it('routes gameplay events to named audio clips', () => {
    const h = createHarness({ levels: [TWO_BRICKS] });
    h.game.launch();
    aimAt(h.game, h.game.bricks[0]!);
    h.advance(0.3);
    h.services.audio.flush(0.1); // the App does this every frame
    expect(h.audio.played).toContain('breakout.brick');
  });

  it('writes the best score to storage', () => {
    const h = createHarness({ levels: [singleBrickLevel()], saveKey: 'test.progress' });
    h.game.launch();
    aimAt(h.game, h.game.bricks[0]!);
    h.advance(0.3);
    h.advance(T.timings.levelClearDelay + 0.2);

    const raw = h.storage.get('test.progress');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!);
    expect(saved.version).toBe(1);
    expect(saved.bestScore).toBeGreaterThan(0);
    expect(h.count('save:written')).toBeGreaterThan(0);
  });

  it('restores the best score on a fresh launch (shared storage)', () => {
    const storage = createHarness({ saveKey: 'test.restore' }).storage;
    const first = createHarness({ levels: [singleBrickLevel()], saveKey: 'test.restore', storage });
    first.game.launch();
    aimAt(first.game, first.game.bricks[0]!);
    first.advance(0.3);
    first.advance(T.timings.levelClearDelay + 0.2);
    const best = first.game.bestScore;
    expect(best).toBeGreaterThan(0);

    const second = createHarness({ levels: [singleBrickLevel()], saveKey: 'test.restore', storage });
    expect(second.game.bestScore).toBe(best);
    expect(second.game.score).toBe(0); // a new run always starts from zero
  });

  it('survives a corrupt save document', () => {
    const storage = createHarness({ saveKey: 'test.corrupt' }).storage;
    storage.set('test.corrupt', '{{{ not json');
    const h = createHarness({ saveKey: 'test.corrupt', storage });
    expect(h.game.bestScore).toBe(0);
    expect(h.game.phase).toBe('ready');
    expect(h.game.remainingBricks).toBeGreaterThan(0);
  });

  it('rejects a save document from a newer build', () => {
    const storage = createHarness({ saveKey: 'test.newer' }).storage;
    storage.set('test.newer', JSON.stringify({ version: 99, bestScore: 9999 }));
    const h = createHarness({ saveKey: 'test.newer', storage });
    expect(h.game.bestScore).toBe(0);
  });

  it('applies a persisted sound-off preference on boot', () => {
    const storage = createHarness({ saveKey: 'test.mute' }).storage;
    storage.set('test.mute', saveDoc({ settings: { ...SETTINGS, sfx: false } }));
    const h = createHarness({ saveKey: 'test.mute', storage });
    // The audio scheduler is muted when sfx is off, so nothing is queued.
    expect(h.services.audio.muted).toBe(true);
    h.services.audio.play('anything');
    expect(h.services.audio.pendingCount).toBe(0);
  });

  it('resumes the saved currentLevel instead of restarting at board 1', () => {
    const storage = createHarness({ saveKey: 'test.resume' }).storage;
    storage.set('test.resume', saveDoc({ currentLevel: 3, maxUnlockedLevel: 3, stats: { ...STATS, runs: 2 } }));
    const h = createHarness({ saveKey: 'test.resume', storage });
    expect(h.game.levelIndex).toBe(2);
    expect(h.game.phase).toBe('ready');
  });

  it('degrading an out-of-range currentLevel lands on board 1 and writes back', () => {
    const storage = createHarness({ saveKey: 'test.oob' }).storage;
    storage.set('test.oob', saveDoc({ currentLevel: 99, stats: { ...STATS, runs: 3 } }));
    const h = createHarness({ saveKey: 'test.oob', storage });
    expect(h.game.levelIndex).toBe(0);
    expect(h.game.phase).toBe('ready'); // never crashes, never soft-locks
    const written = JSON.parse(storage.get('test.oob')!) as { currentLevel: number };
    expect(written.currentLevel).toBe(1);
  });

  it('non-numeric currentLevel degrades to board 1', () => {
    const storage = createHarness({ saveKey: 'test.nan' }).storage;
    storage.set('test.nan', saveDoc({ currentLevel: 'three', stats: { ...STATS, runs: 3 } }));
    const h = createHarness({ saveKey: 'test.nan', storage });
    expect(h.game.levelIndex).toBe(0);
  });

  it('boots into the FINISH screen when every board is cleared', () => {
    const storage = createHarness({ saveKey: 'test.finish' }).storage;
    storage.set(
      'test.finish',
      saveDoc({ allCleared: true, currentLevel: 5, maxUnlockedLevel: 5, stats: { ...STATS, runs: 4 } }),
    );
    const h = createHarness({ saveKey: 'test.finish', storage });
    expect(h.game.phase).toBe('victory');
    expect(h.game.levelIndex).toBe(LEVELS.length - 1);
  });

  it('preserves an unreadable document to the backup key', () => {
    const storage = createHarness({ saveKey: 'test.broken' }).storage;
    storage.set('test.broken', '{ not json at all');
    const h = createHarness({ saveKey: 'test.broken', storage });
    expect(h.game.phase).toBe('ready');
    expect(h.game.levelIndex).toBe(0);
    expect(storage.get('test.broken.bak')).toBe('{ not json at all');
  });
});
