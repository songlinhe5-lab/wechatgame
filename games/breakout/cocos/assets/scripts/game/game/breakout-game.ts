/**
 * BreakoutGame — the whole game, wired to the framework `Game` contract.
 *
 * Architecture in one paragraph: the class owns the *authoritative state*
 * (bricks, ball, paddle, scorer, phase machine). Each fixed step it reads an
 * input snapshot, advances the phase machine, and pushes physics results into
 * the scorer and the event bus. `buildRenderModel` copies the state into a flat
 * snapshot and hands it to the view model. Nothing in the view layer can reach
 * back into this class, which is what makes "UI holds no game state" true by
 * construction rather than by discipline.
 */

import {
  compileLevels,
  DataRegistry,
  SaveManager,
  StateMachine,
  type CompiledBrick,
  type CompiledLevel,
  type Game,
  type GameServices,
  type LevelDef,
  type RenderModelBuilder,
  type Rng,
} from '../../framework/index.js';

import { DEFAULT_TUNING, ballSpeedForLevel, type BreakoutTuning } from '../config/tuning.js';
import {
  BRICK_BEHAVIOR,
  LEVELS,
  LEVEL_DATA,
  levelIdOf,
  powerupWeights,
  type BrickTypeCode,
} from '../config/levels.js';
import { LEVELS_DATA, type LevelData, type PowerupId } from '../config/levels-data.js';
import { Ball } from '../entities/ball.js';
import { Paddle } from '../entities/paddle.js';
import { Scorer, levelClearBonus } from '../systems/scoring.js';
import {
  PICKUP_SETTLE_ORDER,
  POWERUP_SIZE,
  effectiveDropRate,
  overlapsPaddle,
  pickPowerupId,
  rollDrop,
  splitVelocities,
  type FallingPowerup,
} from '../systems/powerups.js';
import {
  WallHit,
  createStepResult,
  stepBall,
  type Arena,
  type BrickLike,
  type StepResult,
} from '../systems/physics.js';
import {
  createExplosionResult,
  resolveExplosion,
  type ExplodableBrick,
  type ExplosionResult,
} from '../systems/explosion.js';
import {
  MOTION_DEFAULTS,
  MOTION_FULL,
  resolveMotionEffects,
  type MotionEffects,
} from '../systems/motion.js';
import {
  PHASE_TRANSITIONS,
  bannerFor,
  createSnapshot,
  type BreakoutPhase,
  type BreakoutSnapshot,
} from './state.js';
import {
  SAVE_KEY,
  SAVE_VERSION,
  bootLevel,
  defaultBreakoutSave,
  normalizeBreakoutSave,
  preserveCorruptBackup,
  type BreakoutSave,
} from './save-schema.js';
import { DEFAULT_PALETTE, type BreakoutPalette } from '../view/palette.js';
import { buildBreakoutView } from '../view/view-model.js';

/** Events emitted on the framework bus. UI/analytics subscribe; gameplay never reads them. */
export interface BreakoutEvents extends Record<string, unknown> {
  'run:start': { levelIndex: number };
  'level:start': { levelIndex: number; id: string; name: string; bricks: number };
  'level:clear': { levelIndex: number; bonus: number };
  'score:changed': { score: number; delta: number };
  'combo:changed': { combo: number; multiplier: number };
  'brick:damaged': { x: number; y: number; color: string; hp: number };
  'brick:destroyed': { x: number; y: number; color: string; points: number; combo: number };
  /**
   * A steel brick was struck. Steel never takes damage and never shatters, so it
   * gets its own signal instead of a fake `brick:damaged` — the art layer plays a
   * metal spark rather than a break.
   */
  'steel:hit': { x: number; y: number; color: string };
  'ball:launched': { x: number; y: number; speed: number };
  'ball:lost': { remainingLives: number };
  'paddle:hit': { x: number; y: number };
  'wall:hit': { x: number; y: number };
  'game:over': { score: number; levelIndex: number; bestScore: number; isNewBest: boolean };
  victory: { score: number; bestScore: number; isNewBest: boolean };
  'save:written': { key: string };
  /** A settings toggle changed at runtime (settings UI / dev harness). */
  'settings:changed': { reduceMotion: boolean };
  /** A powerup capsule spawned at a destroyed brick (S7 drop roll won). */
  'powerup:dropped': { type: PowerupId; x: number; y: number };
  /** The paddle caught a falling powerup; the effect is applied immediately. */
  'powerup:picked': { type: PowerupId };
  /** A falling powerup fell past the pickup line and vanished (no penalty). */
  'powerup:missed': { type: PowerupId };
}

export interface BreakoutGameOptions {
  /** Gameplay tuning. Defaults to {@link DEFAULT_TUNING}. */
  readonly tuning?: BreakoutTuning;
  /** Colour palette. Defaults to {@link DEFAULT_PALETTE}. */
  readonly palette?: BreakoutPalette;
  /** Level table. Defaults to the shipped {@link LEVELS}. */
  readonly levels?: readonly LevelDef[];
  /**
   * Design records (drop rate, powerup pool, hint) aligned by index with
   * `levels`. Defaults to the shipped `LEVEL_DATA`; tests inject custom
   * records so TC-PWR criteria can pin drop rates and pools per board.
   */
  readonly levelData?: readonly LevelData[];
  /** Save key; overridable so tests get isolated storage. */
  readonly saveKey?: string;
}

export class BreakoutGame implements Game {
  readonly id = 'breakout';
  readonly tuning: BreakoutTuning;
  readonly palette: BreakoutPalette;

  readonly paddle: Paddle;
  readonly ball: Ball;

  private readonly _levelDefs: readonly LevelDef[];
  private readonly _levelData: readonly LevelData[];
  private readonly _registry = new DataRegistry<LevelDef>('breakout-levels');
  private readonly _saveKey: string;
  private _levels: readonly CompiledLevel[] = [];
  private _bricks: CompiledBrick[] = [];
  private readonly _scorer: Scorer;
  private readonly _machine: StateMachine<BreakoutGame, BreakoutPhase>;
  private readonly _snapshot: BreakoutSnapshot;
  private readonly _stepResult: StepResult = createStepResult();
  /** Scratch for bomb cascades — reused, never retained. */
  private readonly _explosionResult: ExplosionResult = createExplosionResult();
  /** Bricks destroyed by blasts (not by the ball) this step. */
  private readonly _blastDestroyed: ExplodableBrick[] = [];
  private readonly _arena: Arena;

  private _services: GameServices | null = null;
  private _save: SaveManager<BreakoutSave> | null = null;
  private _rng: Rng | null = null;
  private _rngSeed = 'breakout';

  private _levelIndex = 0;
  private _lives: number;
  private _remainingBricks = 0;
  private _totalBricks = 0;
  private _bestScore = 0;
  /** Bricks already folded into the saved lifetime counter (avoids double counting). */
  private _persistedBricks = 0;
  private _phaseBeforePause: BreakoutPhase = 'ready';
  /** Phase timer stashed on pause so resume continues instead of restarting. */
  private _elapsedBeforePause = 0;
  private readonly _unsubs: (() => void)[] = [];

  /** Balls beyond the primary, created by the `multi` powerup (§2.2 multi). */
  private readonly _extraBalls: Ball[] = [];
  /** Powerup capsules currently falling toward the paddle (§2.1). */
  private readonly _falling: FallingPowerup[] = [];
  /** Seconds left on the `expand` effect; 0 = inactive (§2.4 refresh rule). */
  private _expandRemaining = 0;

  /** Scratch point for screen → design conversion (never retained). */
  private readonly _pointer = { x: 0, y: 0 };
  /** Last design-space pointer X seen, or null when the player never touched. */
  private _pointerX: number | null = null;

  /** Accessibility D1 switch (assets-spec §6) — adopted from settings at boot. */
  private _reduceMotion = false;
  /** Per-effect motion levels derived from `_reduceMotion`. */
  private _motion: MotionEffects = MOTION_FULL;
  /** Seconds of screen shake left; 0 = steady. Frozen while paused. */
  private _shakeTimer = 0;

  /** Ring buffer of recent ball positions for the trail (§B3). Reused. */
  private readonly _trail: { x: number; y: number }[] = [];

  constructor(options: BreakoutGameOptions = {}) {
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    this.palette = options.palette ?? DEFAULT_PALETTE;
    this._saveKey = options.saveKey ?? SAVE_KEY;
    this._levelDefs = options.levels ?? LEVELS;
    this._levelData = options.levelData ?? LEVEL_DATA;

    this.paddle = new Paddle(
      this.tuning.width / 2,
      this.tuning.paddle.y,
      this.tuning.paddle.width,
      this.tuning.paddle.height,
    );
    this.ball = new Ball(
      this.paddle.x,
      this.paddle.y + this.tuning.ball.restOffsetY,
      this.tuning.ball.radius,
    );
    this._scorer = new Scorer(this.tuning);
    this._lives = this.tuning.rules.lives;
    this._snapshot = createSnapshot(this.tuning);
    this._arena = {
      left: this.tuning.arena.left,
      right: this.tuning.arena.right,
      top: this.tuning.arena.top,
      bottom: this.tuning.arena.bottom,
    };

    this._machine = this._buildStateMachine();
  }

  // ─────────────────────────────────────────────────────────────── public API

  get phase(): BreakoutPhase {
    return this._machine.current;
  }

  get score(): number {
    return this._scorer.score;
  }

  get lives(): number {
    return this._lives;
  }

  get levelIndex(): number {
    return this._levelIndex;
  }

  get levelCount(): number {
    return this._levels.length;
  }

  get remainingBricks(): number {
    return this._remainingBricks;
  }

  get totalBricks(): number {
    return this._totalBricks;
  }

  get combo(): number {
    return this._scorer.combo;
  }

  get multiplier(): number {
    return this._scorer.multiplier;
  }

  get bestScore(): number {
    return this._bestScore;
  }

  get bestCombo(): number {
    return this._scorer.bestCombo;
  }

  get bricksDestroyed(): number {
    return this._scorer.bricksDestroyed;
  }

  /** Live brick array — exposed read-only for tests and tooling. */
  get bricks(): readonly CompiledBrick[] {
    return this._bricks;
  }

  /**
   * Design record for the board in play (drop rate, powerup pool, hint).
   * Needed because `LevelDef` cannot carry the game-specific fields.
   */
  get levelData(): LevelData | undefined {
    return this._levelDataFor(this._levelIndex);
  }

  get save(): Readonly<BreakoutSave> | null {
    return this._save?.data ?? null;
  }

  /** Deterministic seed that drives this run (useful in bug reports/replays). */
  get rngSeed(): string {
    return this._rngSeed;
  }

  /** The read-only snapshot handed to the renderer (exposed for tests). */
  get snapshot(): Readonly<BreakoutSnapshot> {
    this._syncSnapshot();
    return this._snapshot;
  }

  // ─────────────────────────────────────────────────────────────── lifecycle

  init(services: GameServices): void {
    this._services = services;
    this._rngSeed = services.platform.isMiniGame ? 'breakout-weapp' : 'breakout-web';
    this._rng = services.rng;

    // Preserve an unreadable document before SaveManager discards it
    // (save-progress §6.2) — best effort, never fatal.
    preserveCorruptBackup(services.storage, this._saveKey);

    this._save = new SaveManager<BreakoutSave>(services.storage, {
      key: this._saveKey,
      version: SAVE_VERSION,
      defaults: defaultBreakoutSave,
    });

    // Compile content up front: broken level data must fail at boot, not mid-run.
    this._registry.registerAll(this._levelDefs);
    this._levels = compileLevels(this._levelDefs, this.tuning.grid);

    const loaded = this._save.load();
    // §6.8: repair out-of-range fields instead of erroring, and write the repair
    // back immediately so we do not re-repair on every launch.
    const normalized = normalizeBreakoutSave(loaded.data, this._levels.length);
    this._save.patch(normalized.save);
    if (normalized.changed || loaded.wasReset) this._save.save();

    this._bestScore = normalized.save.bestScore;
    services.audio.setMuted(!normalized.save.settings.sfx);
    this._adoptReduceMotion(normalized.save.settings.reduceMotion);
    this._subscribe();
    this._boot();
  }

  update(dt: number): void {
    if (!this._services) return;
    this._readInput();
    this._machine.update(dt);
  }

  buildRenderModel(builder: RenderModelBuilder): void {
    this._syncSnapshot();
    buildBreakoutView(builder, this._snapshot, this.palette);
  }

  onPause(): void {
    if (this._machine.current !== 'paused') {
      this._phaseBeforePause = this._machine.current;
      // Stash the phase timer: a banner must resume with the time it had left,
      // not restart its countdown (transitions always clear `elapsed`).
      this._elapsedBeforePause = this._machine.elapsed;
      this._machine.transition('paused');
    }
  }

  onResume(): void {
    if (this._machine.current === 'paused') {
      this._machine.transition(this._phaseBeforePause);
      this._machine.elapsed = this._elapsedBeforePause;
    }
  }

  dispose(): void {
    for (const unsub of this._unsubs) unsub();
    this._unsubs.length = 0;
    this._save?.flush();
    this._services = null;
  }

  // ────────────────────────────────────────────────────────── player commands

  /**
   * Move the paddle toward a design-space X. Public so a dev harness (or a test)
   * can drive the game without synthesising a pointer stream.
   */
  movePaddleTo(designX: number): void {
    this._pointerX = designX;
    this.paddle.setTarget(designX, this.tuning);
  }

  /** Launch the ball if the board is waiting. Safe to call repeatedly. */
  launch(): boolean {
    if (!this._machine.is('ready')) return false;
    const speed = this._ballSpeedForCurrentLevel();

    // Paddle motion decides the launch side; a stationary paddle falls back to
    // the framework RNG so the first shot of a run is not always the same angle.
    // Deterministic per seed, which keeps tests and replays reproducible.
    let side: 1 | -1;
    if (this.paddle.vx > 0) side = 1;
    else if (this.paddle.vx < 0) side = -1;
    else side = (this._rng?.bool(0.5) ?? true) ? 1 : -1;

    this.ball.launch(speed, this.tuning.ball.launchAngleDeg, side);
    this._machine.transition('playing');
    this._emit('ball:launched', { x: this.ball.x, y: this.ball.y, speed });
    return true;
  }

  /** Restart the current board: fresh lives, score reset, same board. */
  retryLevel(): void {
    this._retryLevel();
  }

  /** Restart the whole run from board 1. */
  restartRun(): void {
    this._newRun();
  }

  /**
   * Toggle the reduced-motion switch (accessibility D1, assets-spec §6).
   * Persists through the settings channel so the choice survives relaunch,
   * then re-derives the §6.1/§6.2 effect table.
   */
  setReduceMotion(value: boolean): void {
    if (value === this._reduceMotion) return;
    this._adoptReduceMotion(value);
    const save = this._save;
    if (save) {
      save.patch({ settings: { ...save.data.settings, reduceMotion: value } });
      save.save();
      this._emit('save:written', { key: this._saveKey });
    }
    this._emit('settings:changed', { reduceMotion: value });
  }

  get reduceMotion(): boolean {
    return this._reduceMotion;
  }

  /** Derive the §6.1/§6.2 effect table from the switch (no I/O here). */
  private _adoptReduceMotion(value: boolean): void {
    this._reduceMotion = value;
    this._motion = resolveMotionEffects(value);
    if (value) {
      // Shutdown takes effect immediately: drop any live shake and trail.
      this._shakeTimer = 0;
      this._trail.length = 0;
    }
  }

  /** Skip straight to a board. Used by level-select UI and tests. */
  goToLevel(index: number): void {
    const clamped = Math.max(0, Math.min(index, this._levels.length - 1));
    this._levelIndex = clamped;
    this._setupLevel(clamped);
    this._machine.reset('ready');
  }

  // ─────────────────────────────────────────────────────────────── internals

  private _buildStateMachine(): StateMachine<BreakoutGame, BreakoutPhase> {
    const machine = new StateMachine<BreakoutGame, BreakoutPhase>(this, 'ready', {
      transitions: PHASE_TRANSITIONS,
    });

    machine
      .addState('ready', {
        onEnter: (game) => {
          game._restBall();
        },
        onUpdate: (game, dt) => {
          game._followPointer(dt);
          game._keepBallOnPaddle();
        },
      })
      .addState('playing', {
        onUpdate: (game, dt) => {
          game._followPointer(dt);
          game._stepPhysics(dt);
          game._updatePowerups(dt);
          game._updateMotion(dt);
        },
      })
      .addState('life-lost', {
        onUpdate: (game) => {
          if (game._machine.elapsed >= game.tuning.timings.lifeLostDelay) {
            game._machine.transition('ready');
          }
        },
      })
      .addState('level-clear', {
        onEnter: (game) => {
          const isLast = game._isLastLevel();
          const bonus = levelClearBonus(game.tuning, game._levelIndex, game._lives);
          game._scorer.addBonus(bonus);
          game._bestScore = Math.max(game._bestScore, game._scorer.score);
          game._emit('level:clear', { levelIndex: game._levelIndex, bonus });
          game._persist({ progressedLevel: !isLast });
        },
        onUpdate: (game) => {
          if (game._machine.elapsed < game.tuning.timings.levelClearDelay) return;
          if (game._isLastLevel()) game._machine.transition('victory');
          else game._advanceLevel();
        },
      })
      .addState('game-over', {
        onEnter: (game) => {
          const previousBest = game._save?.data.bestScore ?? 0;
          const wasNewBest = game._scorer.score > previousBest;
          game._scorer.endOfRunBonus(game._lives);
          game._bestScore = Math.max(game._bestScore, game._scorer.score);
          game._persist({ progressedLevel: false, runEnded: true });
          game._emit('game:over', {
            score: game._scorer.score,
            levelIndex: game._levelIndex,
            bestScore: game._bestScore,
            isNewBest: wasNewBest,
          });
        },
      })
      .addState('victory', {
        onEnter: (game) => {
          const previousBest = game._save?.data.bestScore ?? 0;
          const wasNewBest = game._scorer.score > previousBest;
          game._bestScore = Math.max(game._bestScore, game._scorer.score);
          game._persist({ progressedLevel: true, runEnded: true, allCleared: true });
          game._emit('victory', {
            score: game._scorer.score,
            bestScore: game._bestScore,
            isNewBest: wasNewBest,
          });
        },
      })
      .addState('paused', {});

    return machine;
  }

  /**
   * Route gameplay events to audio clips. The bus keeps the audio layer fully
   * decoupled: the game never calls `audio.play` inline, so a future mix pass
   * can be data-driven without touching gameplay.
   */
  private _subscribe(): void {
    const services = this._services;
    if (!services) return;
    const bus = services.events;

    this._unsubs.push(
      bus.on('brick:destroyed', () => services.audio.play('breakout.brick', { minInterval: 0.025 })),
      bus.on('steel:hit', () => services.audio.play('breakout.steel', { minInterval: 0.05, volume: 0.6 })),
      bus.on('paddle:hit', () => services.audio.play('breakout.paddle', { minInterval: 0.04 })),
      bus.on('wall:hit', () => services.audio.play('breakout.wall', { minInterval: 0.06, volume: 0.6 })),
      bus.on('ball:lost', () => services.audio.play('breakout.life-lost')),
      bus.on('level:clear', () => services.audio.play('breakout.level-clear')),
      bus.on('game:over', () => services.audio.play('breakout.game-over')),
      bus.on('combo:changed', () =>
        services.audio.play('breakout.combo', { minInterval: 0.2, volume: 0.5 }),
      ),
    );
  }

  /**
   * BOOT routing — no main menu (save-progress §4 / ux-spec):
   *   - `allCleared` → straight to the FINISH (victory) screen
   *   - `runs === 0` → level 1
   *   - otherwise    → resume `currentLevel`
   */
  private _boot(): void {
    const save = this._save;
    const target = save ? bootLevel(save.data) : 1;

    this._scorer.reset();
    this._persistedBricks = 0;
    this._lives = this.tuning.rules.lives;

    if (target === null) {
      // Everything cleared: show the FINISH screen over the final board.
      this._levelIndex = this._levels.length - 1;
      this._setupLevel(this._levelIndex);
      this._machine.reset('victory');
      return;
    }

    this._levelIndex = Math.max(0, Math.min(target - 1, this._levels.length - 1));
    this._setupLevel(this._levelIndex);
    this._machine.reset('ready');
    this._bumpRuns();
    this._emit('run:start', { levelIndex: this._levelIndex });
  }

  /** Count this launch against the lifetime run counter (drives first-launch detection). */
  private _bumpRuns(): void {
    const save = this._save;
    if (!save) return;
    save.patch({ stats: { ...save.data.stats, runs: save.data.stats.runs + 1 } });
    save.save();
  }

  /** New run from board 1 (used by the victory screen). */
  private _newRun(): void {
    this._scorer.reset();
    this._persistedBricks = 0;
    this._lives = this.tuning.rules.lives;
    this._levelIndex = 0;
    this._setupLevel(0);
    this._machine.reset('ready');
    this._bumpRuns();
    this._emit('run:start', { levelIndex: 0 });
  }

  /** Retry the current board: fresh lives, score reset, same board. */
  private _retryLevel(): void {
    this._scorer.reset();
    this._persistedBricks = 0;
    this._lives = this.tuning.rules.lives;
    this._setupLevel(this._levelIndex);
    this._machine.reset('ready');
    this._bumpRuns();
    this._emit('run:start', { levelIndex: this._levelIndex });
  }

  private _advanceLevel(): void {
    this._levelIndex = Math.min(this._levelIndex + 1, this._levels.length - 1);
    this._setupLevel(this._levelIndex);
    this._machine.transition('ready');
  }

  /** Load a board: fresh bricks, paddle width, ball radius and rest position. */
  private _setupLevel(index: number): void {
    const level = this._levels[index];
    if (!level) throw new Error(`Breakout: no compiled level at index ${index}`);

    // Copy the template so hp/destroyed mutations never leak between attempts.
    this._bricks = level.bricks.map((b) => ({
      col: b.col,
      row: b.row,
      type: b.type,
      maxHp: b.maxHp,
      hp: b.maxHp,
      score: b.score,
      color: b.color,
      indestructible: b.indestructible,
      damage: b.damage,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      destroyed: false,
    }));

    this._totalBricks = level.brickCount;
    this._remainingBricks = level.brickCount;
    this._scorer.resetCombo();
    this._trail.length = 0;
    this._shakeTimer = 0;
    // S7 state never leaks across boards: no stale capsules, no extra balls,
    // no expand timer (the paddle width itself is restored just below).
    this._extraBalls.length = 0;
    this._falling.length = 0;
    this._expandRemaining = 0;

    this.paddle.setWidth(level.def.paddleWidth ?? this.tuning.paddle.width, this.tuning);
    this.paddle.resetTo(this.tuning.width / 2, this.tuning);
    this._pointerX = null;
    this.ball.radius = level.def.ballRadius ?? this.tuning.ball.radius;
    this._restBall();

    this._emit('level:start', {
      levelIndex: index,
      id: level.def.id,
      name: level.def.name,
      bricks: level.brickCount,
    });
  }

  private _ballSpeedForCurrentLevel(): number {
    const level = this._levels[this._levelIndex];
    // Levels always carry their own speed (§2.4); the fallback is a clamp only.
    return level?.def.ballSpeed ?? ballSpeedForLevel(this.tuning);
  }

  /** Design record for board `index` (drop rate / pool), or undefined. */
  private _levelDataFor(index: number): LevelData | undefined {
    const def = this._levels[index]?.def;
    if (!def) return undefined;
    return this._levelData.find((d) => levelIdOf(d) === def.id);
  }

  /** The width the paddle returns to when `expand` expires (§2.4). */
  private _paddleBaseWidth(): number {
    return this._levels[this._levelIndex]?.def.paddleWidth ?? this.tuning.paddle.width;
  }

  private _restBall(): void {
    this.ball.restOn(this.paddle.x, this.paddle.y + this.tuning.ball.restOffsetY);
  }

  /**
   * Per-frame motion housekeeping (playing state only, so everything freezes
   * on pause — §6.2 keeps ball motion, but shake/trail are playing-state VFX).
   */
  private _updateMotion(dt: number): void {
    // Ball trail (§B3 / §6.1 item 5): sample once per step, cap at the table's
    // layer count. When reduce-motion zeroes the budget the buffer stays empty.
    const maxLayers = this._motion.ballTrailLayers;
    if (maxLayers <= 0) {
      this._trail.length = 0;
    } else if (this.ball.launched) {
      this._trail.push({ x: this.ball.x, y: this.ball.y });
      while (this._trail.length > maxLayers) this._trail.shift();
    } else {
      this._trail.length = 0;
    }

    // Screen shake decay (§6.1 item 1): linear ramp back to 0 over the budget.
    if (this._shakeTimer > 0) {
      this._shakeTimer = Math.max(0, this._shakeTimer - dt);
    }
  }

  /** Kick a screen shake, honouring the reduced-motion amplitude (0 = off). */
  private _triggerShake(): void {
    if (this._motion.shakeAmplitudePx <= 0) return;
    this._shakeTimer = MOTION_DEFAULTS.shakeDurationS;
  }

  /** Current shake amplitude in px — 0 when steady or motion-reduced. */
  private get _shakeAmplitude(): number {
    if (this._shakeTimer <= 0 || this._motion.shakeAmplitudePx <= 0) return 0;
    const k = this._shakeTimer / MOTION_DEFAULTS.shakeDurationS; // 1 → 0
    return this._motion.shakeAmplitudePx * k;
  }

  private _keepBallOnPaddle(): void {
    this.ball.x = this.paddle.x;
    this.ball.y = this.paddle.y + this.tuning.ball.restOffsetY;
  }

  private _followPointer(dt: number): void {
    if (this._pointerX === null) return;
    this.paddle.setTarget(this._pointerX, this.tuning);
    this.paddle.update(dt, this.tuning);
  }

  private _readInput(): void {
    const services = this._services;
    if (!services) return;
    const snap = services.input.snapshot;
    if (!snap.isDown && !snap.justDown) return;

    services.viewport.screenToDesign(this._pointer, snap.x, snap.y);
    this.movePaddleTo(this._pointer.x);
    if (snap.justDown) this._handleTap();
  }

  private _handleTap(): void {
    switch (this._machine.current) {
      case 'ready':
        this.launch();
        break;
      case 'game-over':
        this._retryLevel();
        break;
      case 'victory':
        this._newRun();
        break;
      case 'paused':
        this.onResume();
        break;
      default:
        break;
    }
  }

  private _stepPhysics(dt: number): void {
    // One ball at a time: `multi` can put up to `maxBalls` balls in flight, and
    // each gets its own full physics+scoring pass (the scratch result is reused
    // sequentially, never shared across balls in the same step).
    const primaryLost = this._stepOneBall(this.ball, dt);
    // Lost extras are removed immediately; backwards iteration keeps the
    // indices valid while splicing. Every ball that leaves play is reported.
    for (let i = this._extraBalls.length - 1; i >= 0; i--) {
      if (this._stepOneBall(this._extraBalls[i]!, dt)) {
        this._extraBalls.splice(i, 1);
        this._emit('ball:lost', { remainingLives: this._lives });
      }
    }

    // §6.2 (life-gameover): a clear beats a lost ball on the same frame.
    if (this._remainingBricks <= 0) {
      this._machine.transition('level-clear');
      return;
    }

    // Ball bookkeeping for lost balls. A lost EXTRA is simply removed; the
    // primary is kept alive by adopting the first extra (life-gameover §2.1:
    // only the LAST ball costs a life). Adopt-or-lose is mutually exclusive:
    // if an extra was adopted, the primary is still in play.
    if (primaryLost) {
      const adopt = this._extraBalls.shift();
      if (adopt) {
        this.ball.x = adopt.x;
        this.ball.y = adopt.y;
        this.ball.vx = adopt.vx;
        this.ball.vy = adopt.vy;
        this.ball.radius = adopt.radius;
        this.ball.launched = adopt.launched;
        this._emit('ball:lost', { remainingLives: this._lives });
      } else {
        this._onBallLost();
      }
    }
  }

  /**
   * Advance one ball by `dt`: physics, walls, paddle, bricks, bomb chains,
   * scoring and powerup drops. @returns true when this ball fell out of play.
   */
  private _stepOneBall(ball: Ball, dt: number): boolean {
    const result = stepBall(
      ball,
      dt,
      this._arena,
      this.paddle,
      this._bricks,
      this.tuning,
      this._stepResult,
    );

    if ((result.wallHits & WallHit.Top) !== 0) {
      this._emit('wall:hit', { x: ball.x, y: ball.y });
    }

    if (result.paddleBounced) {
      this._scorer.onPaddleHit();
      this._emit('paddle:hit', { x: ball.x, y: ball.y });
      this._emit('combo:changed', {
        combo: this._scorer.combo,
        multiplier: this._scorer.multiplier,
      });
    }

    // Bomb bricks chain: a blast can shatter neighbours, and a neighbour that is
    // itself a bomb propagates the cascade (depth-limited inside the resolver).
    this._blastDestroyed.length = 0;
    for (const brick of result.bricksDestroyed) {
      const behavior = BRICK_BEHAVIOR[brick.type as BrickTypeCode];
      const explode = behavior?.explode;
      if (!explode) continue;

      // §6.1 item 1: a bomb blast is the one shake source. Reduced motion
      // clamps the amplitude to 0, making this a no-op.
      this._triggerShake();

      const blast = resolveExplosion(
        brick as ExplodableBrick,
        this._bricks as unknown as readonly ExplodableBrick[],
        { radius: explode.radius, damage: explode.damage, maxChain: explode.maxChain },
        this._explosionResult,
      );

      for (const hit of blast.damaged) {
        if (!hit.destroyed) {
          this._emit('brick:damaged', {
            x: hit.x,
            y: hit.y,
            color: hit.color,
            hp: hit.hp,
          });
        }
      }
      for (const shattered of blast.destroyed) {
        this._blastDestroyed.push(shattered);
      }
    }

    // Score every brick that left the board this step — ball kills first (that is
    // the player's combo), then blast kills, so the combo reads naturally.
    for (const brick of result.bricksDestroyed) {
      this._awardDestroyedBrick(brick);
    }
    for (const brick of this._blastDestroyed) {
      this._awardDestroyedBrick(brick);
    }

    // Damaged-but-alive bricks are reported separately so the art layer can
    // spawn a hit flash without affecting score. Steel is a distinct case: it can
    // never be damaged, so it reports a spark instead of a break.
    for (const brick of result.bricksHit) {
      if (brick.indestructible) {
        this._emit('steel:hit', { x: brick.x, y: brick.y, color: brick.color });
        continue;
      }
      if (brick.destroyed) continue;
      this._emit('brick:damaged', { x: brick.x, y: brick.y, color: brick.color, hp: brick.hp });
    }

    return result.lost;
  }

  /** Fold one destroyed brick into score, progress and the event stream. */
  private _awardDestroyedBrick(brick: BrickLike): void {
    const points = this._scorer.onBrickDestroyed(brick.score);
    this._remainingBricks = Math.max(0, this._remainingBricks - 1);
    this._emit('brick:destroyed', {
      x: brick.x,
      y: brick.y,
      color: brick.color,
      points,
      combo: this._scorer.combo,
    });
    this._emit('score:changed', { score: this._scorer.score, delta: points });
    this._emit('combo:changed', {
      combo: this._scorer.combo,
      multiplier: this._scorer.multiplier,
    });
    // S7 drop roll (powerups.md §2.1): fires on every destroyed brick — ball
    // kills and blast kills alike — unless the field is already at its cap.
    this._maybeDropPowerup(brick);
  }

  /** §2.1 drop roll for one destroyed brick. Never throws; RNG-safe pre-init. */
  private _maybeDropPowerup(brick: BrickLike): void {
    if (!this._rng) return;
    if (this._falling.length >= this.tuning.powerups.maxOnField) return;

    const data = this._levelDataFor(this._levelIndex);
    const base = data ? data.powerupDropRate : this.tuning.powerups.dropBase;
    const multiplier =
      BRICK_BEHAVIOR[brick.type as BrickTypeCode]?.dropRateMultiplier ?? 1;
    const rate = effectiveDropRate(base, multiplier);
    if (!rollDrop(this._rng, rate)) return;

    const id = this._pickPowerupId(data);
    if (!id) return;

    const powerup: FallingPowerup = {
      id,
      x: brick.x,
      y: brick.y,
      width: POWERUP_SIZE,
      height: POWERUP_SIZE,
    };
    this._falling.push(powerup);
    this._emit('powerup:dropped', { type: id, x: powerup.x, y: powerup.y });
  }

  /**
   * Weighted pick among the board's *implemented* candidates (§3.6):
   * `level.powerupPool ∩ IMPLEMENTED_POWERUPS`, weights re-normalised by
   * `powerupWeights`. Unimplemented ids are silently skipped, never an error.
   */
  private _pickPowerupId(data: LevelData | undefined): PowerupId | null {
    if (!this._rng) return null;
    if (data) return pickPowerupId(powerupWeights(data), this._rng.next());
    // No design record (bare test levels): MVP pool with shipped catalog weights.
    const weights = this.tuning.powerups.implemented.map((id) => ({
      id: id as PowerupId,
      weight: LEVELS_DATA.powerupPool[id]?.weight ?? 0,
    }));
    return pickPowerupId(weights, this._rng.next());
  }

  /**
   * Per-frame S7 housekeeping (playing state only → frozen on pause AND on
   * ready, per powerups.md §2.4 "可暂停计时器"). Falls, pickups, misses and
   * the expand timer.
   */
  private _updatePowerups(dt: number): void {
    // Expand timer: refresh-on-pickup, never stacked (§2.4). Expiry restores
    // the board's own paddle width.
    if (this._expandRemaining > 0) {
      this._expandRemaining = Math.max(0, this._expandRemaining - dt);
      if (this._expandRemaining === 0) {
        this.paddle.setWidth(this._paddleBaseWidth(), this.tuning);
      }
    }

    if (this._falling.length === 0) return;

    const fallSpeed = this.tuning.powerups.fallSpeed;
    const missY = this.tuning.powerups.missY;
    const caught: FallingPowerup[] = [];
    const missed: FallingPowerup[] = [];
    for (let i = this._falling.length - 1; i >= 0; i--) {
      const p = this._falling[i]!;
      // Pickup check comes first: a capsule reaching the paddle band is caught
      // even in the step it would otherwise expire (§2.3 AABB test).
      if (overlapsPaddle(p, this.paddle)) {
        caught.push(p);
        this._falling.splice(i, 1);
      } else {
        p.y -= fallSpeed * dt;
        if (p.y < missY) {
          missed.push(p);
          this._falling.splice(i, 1);
        }
      }
    }

    // §6.4: settle same-frame pickups in a fixed order (life → multi → expand).
    caught.sort((a, b) => PICKUP_SETTLE_ORDER.indexOf(a.id) - PICKUP_SETTLE_ORDER.indexOf(b.id));
    for (const p of caught) {
      this._applyPowerup(p.id);
      this._emit('powerup:picked', { type: p.id });
    }
    for (const p of missed) {
      this._emit('powerup:missed', { type: p.id });
    }
  }

  /** Apply a caught powerup's effect (§2.2 MVP rows; values from the data). */
  private _applyPowerup(id: PowerupId): void {
    const def = LEVELS_DATA.powerupPool[id];
    switch (id) {
      case 'expand': {
        // ×1.4 → 196; a repeat pickup refreshes the timer instead of stacking.
        this._expandRemaining = (def?.durationMs ?? 15000) / 1000;
        this.paddle.setWidth(this.tuning.paddle.expandedWidth, this.tuning);
        break;
      }
      case 'multi': {
        // Every ball in flight splits into 3 (±splitAngleDeg), capped at
        // `maxBalls` total (§6.1 multi-ball protection).
        const splitCount = Math.max(0, def?.params.splitCount ?? 3);
        const angle = def?.params.splitAngleDeg ?? 25;
        const cap = this.tuning.powerups.maxBalls;
        const clonesPerSource = Math.max(0, splitCount - 1);
        if (clonesPerSource === 0) break;
        const sources = [this.ball, ...this._extraBalls];
        for (const source of sources) {
          if (!source.launched || this._totalBallCount() >= cap) continue;
          const clones = splitVelocities(source.vx, source.vy, angle);
          for (let k = 0; k < clonesPerSource && k < clones.length; k++) {
            if (this._totalBallCount() >= cap) break;
            const c = clones[k]!;
            const ball = new Ball(source.x, source.y, source.radius);
            ball.vx = c.vx;
            ball.vy = c.vy;
            ball.launched = true;
            this._extraBalls.push(ball);
          }
        }
        break;
      }
      case 'life': {
        // +1 up to MAX_LIVES; overflow converts to bonus score (§2.2 life row).
        const overflow = def?.params.overflowScore ?? 500;
        if (this._lives < this.tuning.rules.maxLives) {
          this._lives += 1;
        } else {
          const total = this._scorer.addBonus(overflow);
          this._emit('score:changed', { score: total, delta: overflow });
        }
        break;
      }
      default:
        // Defined-but-unimplemented ids can never reach here: §3.6 filters
        // them out of the candidate pool before a drop can spawn.
        break;
    }
  }

  /** Total balls in flight, primary included. */
  private _totalBallCount(): number {
    return 1 + this._extraBalls.length;
  }

  /** Total balls in flight (primary + `multi` extras). Drives the HUD ball pips. */
  get ballCount(): number {
    return this._totalBallCount();
  }

  /**
   * Apply a powerup effect directly, bypassing the drop/pickup chain.
   * Debug + dev-harness hook (mirrors `movePaddleTo`): lets tools and tests
   * exercise effect semantics without choreographing physics. Effects, timers
   * and caps behave exactly as a picked-up capsule.
   */
  grantPowerup(id: PowerupId): void {
    this._applyPowerup(id);
  }

  private _onBallLost(): void {
    this._scorer.onBallLost();
    this._lives = Math.max(0, this._lives - 1);
    this._emit('ball:lost', { remainingLives: this._lives });
    if (this._lives <= 0) this._machine.transition('game-over');
    else this._machine.transition('life-lost');
  }

  private _isLastLevel(): boolean {
    return this._levelIndex >= this._levels.length - 1;
  }

  /**
   * Write progression to storage (save-progress §2 "write on key events only").
   * Never throws; a failed write is non-fatal.
   */
  private _persist(options: {
    progressedLevel: boolean;
    runEnded?: boolean;
    allCleared?: boolean;
  }): void {
    const save = this._save;
    if (!save) return;
    const data = save.data;
    const levelCount = this._levels.length;

    // Fold in only the bricks not yet accounted for, so repeated persists during
    // a run do not inflate the lifetime counter.
    const stats = {
      ...data.stats,
      bestCombo: Math.max(data.stats.bestCombo, this._scorer.bestCombo),
      bricksDestroyed:
        data.stats.bricksDestroyed + (this._scorer.bricksDestroyed - this._persistedBricks),
      lastPlayedAt: Date.now(),
    };
    this._persistedBricks = this._scorer.bricksDestroyed;

    const patch: Partial<BreakoutSave> = {
      bestScore: Math.max(data.bestScore, this._scorer.score),
      stats,
    };

    if (options.progressedLevel) {
      // Clearing level index i unlocks i+2 (1-based) and becomes the resume point.
      patch.maxUnlockedLevel = Math.max(
        data.maxUnlockedLevel,
        Math.min(this._levelIndex + 2, levelCount),
      );
      patch.currentLevel = Math.min(this._levelIndex + 2, levelCount);
    }
    if (options.allCleared) patch.allCleared = true;
    if (options.runEnded) {
      stats.clears = data.stats.clears + (options.allCleared ? 1 : 0);
      // The run is over: bank the resume point as the board just failed on.
      patch.currentLevel = Math.min(this._levelIndex + 1, levelCount);
    }

    save.patch(patch);
    if (save.save()) this._emit('save:written', { key: this._saveKey });
  }

  private _syncSnapshot(): void {
    const s = this._snapshot;
    s.phase = this._machine.current;
    s.phaseElapsed = this._machine.elapsed;
    s.levelIndex = this._levelIndex;
    s.levelName = this._levels[this._levelIndex]?.def.name ?? '';
    s.levelCount = this._levels.length;
    s.score = this._scorer.score;
    s.bestScore = Math.max(this._bestScore, this._scorer.score);
    s.combo = this._scorer.combo;
    s.bestCombo = this._scorer.bestCombo;
    s.multiplier = this._scorer.multiplier;
    s.lives = this._lives;
    s.remainingBricks = this._remainingBricks;
    s.totalBricks = this._totalBricks;

    s.paddleX = this.paddle.x;
    s.paddleY = this.paddle.y;
    s.paddleWidth = this.paddle.width;
    s.paddleHeight = this.paddle.height;

    s.ballX = this.ball.x;
    s.ballY = this.ball.y;
    s.ballRadius = this.ball.radius;
    s.ballResting = !this.ball.launched;

    // S7 view data: falling capsules + the expand buff countdown.
    s.expandRemaining = this._expandRemaining;
    if (s.fallingPowerups.length !== this._falling.length) {
      s.fallingPowerups = this._falling.slice();
    } else {
      for (let i = 0; i < this._falling.length; i++) {
        const f = this._falling[i]!;
        const sf = s.fallingPowerups[i]!;
        if (sf.x !== f.x || sf.y !== f.y || sf.id !== f.id) {
          s.fallingPowerups = this._falling.slice();
          break;
        }
      }
    }

    // Accessibility/motion (assets-spec §6): the switch plus its effect table.
    s.reduceMotion = this._reduceMotion;
    s.motion = this._motion;
    s.shakeAmplitude = this._shakeAmplitude;
    if (s.ballTrail.length !== this._trail.length) {
      s.ballTrail = this._trail.slice();
    } else {
      for (let i = 0; i < this._trail.length; i++) {
        const t = this._trail[i]!;
        const st = s.ballTrail[i]!;
        if (st.x !== t.x || st.y !== t.y) {
          s.ballTrail = this._trail.slice();
          break;
        }
      }
    }

    s.bricks = this._bricks;

    const copy = bannerFor(s.phase, this._isLastLevel());
    s.banner = copy.banner;
    s.subBanner = copy.sub;
    s.awaitingLaunch = s.phase === 'ready';
    s.launched = this.ball.launched;
  }

  private _emit<K extends keyof BreakoutEvents>(type: K, payload: BreakoutEvents[K]): void {
    if (!this._services) return;
    const bus = this._services.events as unknown as {
      emit: (type: string, payload: unknown) => void;
    };
    bus.emit(type as string, payload);
  }
}

/** Convenience factory used by the Cocos bootstrap and the dev harness. */
export function createBreakoutGame(options: BreakoutGameOptions = {}): BreakoutGame {
  return new BreakoutGame(options);
}
