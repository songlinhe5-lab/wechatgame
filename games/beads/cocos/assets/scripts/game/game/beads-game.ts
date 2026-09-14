/**
 * BeadsGame — the whole game, wired to the framework `Game` contract.
 *
 * Architecture in one paragraph: the class owns the *authoritative state*
 * (pattern grid, tray, spawner rhythm, countdown, sprint tracker, phase
 * machine). Systems (`placement` / `spawner` / `timer` / `sprint`) are pure
 * mechanics that return outcomes; this class applies them and broadcasts the
 * registered events. Subscriptions live in `_subscribe()`, unwound in
 * `dispose()`. `buildRenderModel` only copies state into the snapshot — the
 * view can never reach back, which makes "UI holds no game state" true by
 * construction.
 *
 * Freeze discipline (ADR-0007): the state machine is the single arbiter —
 * PAUSED simply stops calling spawner/timer/combo-window ticks. The
 * `game:paused` / `game:resumed` events are notifications only.
 */

import {
  SaveManager,
  StateMachine,
  type Game,
  type GameServices,
  type RenderModelBuilder,
  type Rng,
} from '../../framework/index';

import {
  AUDIO_CLIP_BGM,
  AUDIO_CLIP_UI_TAP,
  DEFAULT_TUNING,
  GEAR_HIT_SIZE,
  HUD_BAND,
  STAR2_RATIO,
  STAR3_RATIO,
  STAGE_BONUS_TIME,
  TIMER_URGENT_T,
  TRAY_COLS,
  TRAY_GAP,
  TRAY_SLOT,
  TRAY_BAND,
  GRID_HIT_SIZE,
  TRAY_HIT_SIZE,
  gridLayoutFor,
  stageParamsFor,
  validatedSprintTime,
  type BeadsTuning,
  type GridLayout,
  type StageParams,
} from '../config/tuning';
import {
  LEVELS,
  buildStagePattern,
  decoyColorIndices,
  levelIdOf,
  validateBeadsLevel,
  type BeadsLevelRaw,
} from '../config/levels';
import { BeadGrid } from '../entities/grid';
import { Tray } from '../entities/tray';
import { judgePlacement } from '../systems/placement';
import { Spawner } from '../systems/spawner';
import { GameTimer } from '../systems/timer';
import { SprintTracker } from '../systems/sprint';
import { PausePanel, type PausePanelAction } from '../systems/pause-panel';
import {
  PHASE_TRANSITIONS,
  bannerFor,
  createSnapshot,
  type BeadsPhase,
  type BeadsSnapshot,
  type GameMode,
} from './state';
import {
  SAVE_KEY,
  bootLevel,
  defaultBeadsSave,
  normalizeBeadsSave,
  preserveCorruptBackup,
  type BeadsSave,
} from './save-schema';
import { DEFAULT_PALETTE, type BeadsPalette } from '../view/palette';
import { buildBeadsView } from '../view/view-model';

/** Events emitted on the framework bus — the 17 registered in systems-index §4. */
export interface BeadsEvents extends Record<string, unknown> {
  'tray:spawned': { slot: number; colorIdx: number };
  'tray:selected': { slot: number; colorIdx: number };
  'bead:placed': { row: number; col: number; colorIdx: number; slot: number };
  'bead:rejected': { row: number; col: number; colorIdx: number };
  'tray:full': Record<string, never>;
  'tray:expanded': Record<string, never>;
  'powerup:used': { type: string; affectedSlots: readonly number[] };
  'timer:tick': { remaining: number };
  'timer:urgent': { remaining: number };
  'level:cleared': { levelId: string; remaining: number; ratio: number; stars: number };
  'level:failed': { levelId: string };
  'game:paused': Record<string, never>;
  'game:resumed': Record<string, never>;
  'combo:up': { streak: number; multiplier: number; tier: number };
  'combo:break': { reason: 'wrong' | 'timeout' };
  'sprint:stage': { stageIndex: number; nextParams: StageParams };
  'sprint:ended': { score: number; bestStage: number; settleScore: number };
}

export interface BeadsGameOptions {
  /** Gameplay tuning. Defaults to {@link DEFAULT_TUNING}. */
  readonly tuning?: BeadsTuning;
  /** Colour palette. Defaults to {@link DEFAULT_PALETTE}. */
  readonly palette?: BeadsPalette;
  /** Level table. Defaults to the shipped 8 levels. */
  readonly levels?: readonly BeadsLevelRaw[];
  /** Save key; overridable so tests get isolated storage. */
  readonly saveKey?: string;
  /**
   * Sprint run length override (C1): legal [90, 120], anything else is
   * rejected at BOOT and falls back to `SPRINT_TIME_DEFAULT`.
   */
  readonly sprintTime?: number;
}

export class BeadsGame implements Game {
  readonly id = 'beads';
  readonly tuning: BeadsTuning;
  readonly palette: BeadsPalette;

  private readonly _levels: readonly BeadsLevelRaw[];
  private readonly _saveKey: string;
  private readonly _machine: StateMachine<BeadsGame, BeadsPhase>;
  private readonly _snapshot: BeadsSnapshot;
  private readonly _tray = new Tray();
  private readonly _spawner = new Spawner(4.0);
  private readonly _timer = new GameTimer(300);
  private readonly _sprint = new SprintTracker();
  /** S9 pause panel: geometry + hit testing only; never gameplay state. */
  private readonly _panel = new PausePanel();

  private _grid: BeadGrid = new BeadGrid(['..11..', '.1111.', '111111', '.1111.', '..11..']);
  private _layout: GridLayout = gridLayoutFor(6, 5);

  private _services: GameServices | null = null;
  private _save: SaveManager<BeadsSave> | null = null;
  private _rng: Rng | null = null;

  private _mode: GameMode = 'normal';
  private _levelIndex = 0;
  private _stageIndex = 0;
  /** Validated sprint run length = also the stage-bonus cap (C1 + §8-7). */
  private _sprintCap = DEFAULT_TUNING.sprintTime;
  private _sprintBestScore = 0;
  private _sprintBestStage = 0;
  private _isNewBest = false;
  /** S9 settings mirror (S8 is the authority; these are the in-memory copy). */
  private _bgmMuted = false;
  private _sfxMuted = false;
  /** BOOT validation errors — non-empty means the game refuses PLAYING. */
  private _bootErrors: string[] = [];

  /** Scratch point for screen → design conversion (never retained). */
  private readonly _pointer = { x: 0, y: 0 };

  constructor(options: BeadsGameOptions = {}) {
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    this.palette = options.palette ?? DEFAULT_PALETTE;
    this._saveKey = options.saveKey ?? SAVE_KEY;
    this._levels = options.levels ?? LEVELS;

    this._sprintCap = validatedSprintTime(options.sprintTime);
    if (options.sprintTime !== undefined && this._sprintCap !== options.sprintTime) {
      // C1: out-of-range override rejected, fall back to the frozen default.
      console.warn(
        `[beads] sprintTime ${options.sprintTime} outside [90, 120] — using ${this._sprintCap}`,
      );
    }
    this.tuning = { ...this.tuning, sprintTime: this._sprintCap };

    this._snapshot = createSnapshot(this.tuning);
    this._machine = this._buildStateMachine();
  }

  // ─────────────────────────────────────────────────────────────── public API

  get phase(): BeadsPhase {
    return this._machine.current;
  }

  get mode(): GameMode {
    return this._mode;
  }

  get levelIndex(): number {
    return this._levelIndex;
  }

  get levelCount(): number {
    return this._levels.length;
  }

  get stageIndex(): number {
    return this._stageIndex;
  }

  /** Current pattern grid (authoritative; read-only usage expected). */
  get grid(): BeadGrid {
    return this._grid;
  }

  /** Tray (authoritative; read-only usage expected). */
  get tray(): Tray {
    return this._tray;
  }

  get remaining(): number {
    return this._timer.remaining;
  }

  get sprintTracker(): SprintTracker {
    return this._sprint;
  }

  get sprintBestScore(): number {
    return this._sprintBestScore;
  }

  get isNewBest(): boolean {
    return this._isNewBest;
  }

  /** S9 panel logic (exposed for tests — layout/hit-testing only). */
  get panel(): PausePanel {
    return this._panel;
  }

  get bgmMuted(): boolean {
    return this._bgmMuted;
  }

  get sfxMuted(): boolean {
    return this._sfxMuted;
  }

  /** BOOT validation failures ('' when the level data is clean). */
  get bootError(): string {
    return this._bootErrors.join('; ');
  }

  /** The read-only snapshot handed to the renderer (exposed for tests). */
  get snapshot(): Readonly<BeadsSnapshot> {
    this._syncSnapshot();
    return this._snapshot;
  }

  // ─────────────────────────────────────────────────────────────── lifecycle

  init(services: GameServices): void {
    this._services = services;
    this._rng = services.rng;

    // Preserve an unreadable document before SaveManager discards it — best effort.
    preserveCorruptBackup(services.storage, this._saveKey);

    this._save = new SaveManager<BeadsSave>(services.storage, {
      key: this._saveKey,
      version: 1,
      defaults: defaultBeadsSave,
    });

    // BOOT static validation of every level: broken data must fail at boot,
    // never mid-run (core-loop §2.1 — no entering PLAYING with bad data).
    this._bootErrors = [];
    for (const level of this._levels) {
      for (const error of validateBeadsLevel(level)) {
        this._bootErrors.push(error);
      }
    }

    const loaded = this._save.load();
    const normalized = normalizeBeadsSave(loaded.data, this._levels.length);
    this._save.patch(normalized.save);
    if (normalized.changed || loaded.wasReset) this._save.save();

    this._sprintBestScore = normalized.save.sprintBestScore;
    this._sprintBestStage = normalized.save.sprintBestStage;
    this._bgmMuted = normalized.save.settings.bgmMuted;
    this._sfxMuted = normalized.save.settings.sfxMuted;
    this._applyAudioChannels();

    this._subscribe();
    this._boot();
  }

  update(dt: number): void {
    if (!this._services) return;
    this._machine.update(dt);
    // Panel animation is presentation, not gameplay: it keeps running while the
    // world is frozen so the enter/exit ramp never stalls (ux-spec §5).
    this._panel.update(dt * 1000);
  }

  buildRenderModel(builder: RenderModelBuilder): void {
    this._syncSnapshot();
    buildBeadsView(builder, this._snapshot, this.palette);
  }

  /** App moved to the background (WeChat `onHide`) — same as a player pause. */
  onPause(): void {
    if (this._machine.current === 'playing') {
      this._machine.transition('paused');
    }
  }

  onResume(): void {
    if (this._machine.current === 'paused') {
      this._machine.transition('playing');
    }
  }

  dispose(): void {
    for (const unsub of this._unsubs) unsub();
    this._unsubs.length = 0;
    this._save?.flush();
    this._services = null;
  }

  // ────────────────────────────────────────────────────────── player commands

  /** Select a tray slot (S2 route 4). Idempotent; re-selection moves the mark. */
  selectTraySlot(slot: number): boolean {
    if (this._machine.current !== 'playing') return false;
    const result = this._tray.select(slot);
    if (result !== 'selected') return false;
    const color = this._tray.slot(slot)!.colorIdx;
    this._emit('tray:selected', { slot, colorIdx: color });
    return true;
  }

  /**
   * Attempt to place the currently selected bead at (row, col) — the S2 → S3
   * route as a public command so tests and the harness never fake touch events.
   * @returns true only when the placement was accepted.
   */
  tapGridCell(row: number, col: number): boolean {
    if (this._machine.current !== 'playing') return false;
    return this._placeSelected(row, col);
  }

  /** Unlock the tray expansion row (MVP: badge-only placeholder, no ad call). */
  expandTray(): boolean {
    if (!this._tray.expand()) return false;
    this._emit('tray:expanded', {});
    return true;
  }

  /**
   * Debug/dev hook: route a design-space tap through the real S2 priority
   * router (gear → tray → grid). Lets tests and the harness exercise routing
   * without faking platform pointer events.
   * @returns true only when the tap was consumed (never == "something changed").
   */
  tapDesign(x: number, y: number): boolean {
    const before = this._machine.current;
    this._handleTap(x, y);
    return this._machine.current !== before || this._consumedTap;
  }

  /** True when the last `_handleTap` route consumed the tap without a phase change. */
  private _consumedTap = false;

  /** Debug/dev hook: drop a specific colour into the first free slot (S4 path). */
  giveTrayBead(colorIdx: number): number {
    const slot = this._tray.firstFree();
    if (slot < 0 || !this._tray.spawnInto(slot, colorIdx)) return -1;
    this._emit('tray:spawned', { slot, colorIdx });
    return slot;
  }

  /** Retry after game over: normal → same level fresh; sprint → new run. */
  retryLevel(): boolean {
    if (this._machine.current !== 'game-over') return false;
    if (this._mode === 'sprint') {
      this._setupSprintRun();
    } else {
      this._setupLevel(this._levelIndex);
    }
    this._machine.transition('playing');
    return true;
  }

  /** From the FINISH screen: replay the whole normal campaign from level 1. */
  restartRun(): boolean {
    if (this._machine.current !== 'finish') return false;
    this._mode = 'normal';
    this._setupLevel(0);
    this._machine.transition('playing');
    return true;
  }

  /** Level jump for level-select UI / harness / tests (normal mode). */
  goToLevel(index: number): void {
    this._mode = 'normal';
    const clamped = Math.max(0, Math.min(index, this._levels.length - 1));
    this._levelIndex = clamped;
    this._setupLevel(clamped);
    this._machine.reset('playing');
  }

  /** Enter a fresh sprint run (endless ladder). */
  startSprint(): void {
    this._mode = 'sprint';
    this._setupSprintRun();
    this._machine.reset('playing');
  }

  /** Leave sprint back to the normal campaign at the current level. */
  startNormal(): void {
    this._mode = 'normal';
    this.goToLevel(this._levelIndex);
  }

  // ─────────────────────────────────────────────────────────────── internals

  private readonly _unsubs: (() => void)[] = [];

  private _buildStateMachine(): StateMachine<BeadsGame, BeadsPhase> {
    const machine = new StateMachine<BeadsGame, BeadsPhase>(this, 'boot', {
      transitions: PHASE_TRANSITIONS,
    });

    machine
      .addState('boot', {})
      .addState('playing', {
        onEnter: (game, from) => {
          if (from === 'paused') {
            game._panel.close();
            game._emit('game:resumed', {});
          }
        },
        onUpdate: (game, dt) => {
          game._stepPlaying(dt);
        },
      })
      .addState('paused', {
        onEnter: (game) => {
          game._panel.open();
          game._emit('game:paused', {});
        },
      })
      .addState('level-clear', {
        onEnter: (game) => {
          const level = game._levels[game._levelIndex]!;
          const levelId = levelIdOf(level);
          const remaining = game._timer.remaining;
          const ratio = game._timer.ratio;
          const stars = ratio >= STAR3_RATIO ? 3 : ratio >= STAR2_RATIO ? 2 : 1;
          game._lastStars = stars;
          game._emit('level:cleared', { levelId, remaining, ratio, stars });
          game._persistProgress();
        },
        onUpdate: (game) => {
          if (game._machine.elapsed < game.tuning.levelClearDelay) return;
          if (game._levelIndex >= game._levels.length - 1) {
            game._machine.transition('finish');
          } else {
            game._levelIndex++;
            game._setupLevel(game._levelIndex);
            game._machine.transition('playing');
          }
        },
      })
      .addState('game-over', {
        onEnter: (game) => {
          const levelId = game._mode === 'sprint' ? 'sprint' : levelIdOf(game._levels[game._levelIndex]!);
          game._emit('level:failed', { levelId });
          if (game._mode === 'sprint') game._recordSprintEnd();
        },
      })
      .addState('finish', {});

    return machine;
  }

  /**
   * BOOT routing (S1 §8-1, no menu): first launch → level 1; otherwise resume
   * `currentLevel`. Invalid level data keeps the game in BOOT forever.
   */
  private _boot(): void {
    if (this._bootErrors.length > 0) {
      console.warn(`[beads] level validation failed — refusing PLAYING:\n  ${this._bootErrors.join('\n  ')}`);
      return;
    }
    const save = this._save;
    const target = save ? bootLevel(save.data) : 1;

    this._levelIndex = Math.max(0, Math.min(target - 1, this._levels.length - 1));
    this._setupLevel(this._levelIndex);

    if (save) {
      save.patch({ runs: save.data.runs + 1 });
      save.save();
    }
    this._machine.reset('playing');
  }

  /** Event subscription assembly — the only place that touches the bus (§5). */
  private _subscribe(): void {
    const services = this._services;
    if (!services) return;
    const bus = services.events;

    this._unsubs.push(
      // Architecture §2 note ①: the needed-colour projection consumes placed
      // beads — a data flow piggybacking on the notification, no S3→S4 call.
      bus.on('bead:placed', (payload) => {
        this._tray.consumeNeeded((payload as { colorIdx: number }).colorIdx);
      }),
      // Cross-mode injection defence (score-combo §6): level:cleared is a
      // normal-mode-only event; hearing it during sprint means someone
      // injected it — ignore + warn (the state machine never acts on it).
      bus.on('level:cleared', () => {
        if (this._mode === 'sprint') {
          console.warn('[beads] level:cleared received in sprint mode — ignored (cross-mode defence)');
        }
      }),
    );
  }

  /** Load a normal level: fresh grid/tray/rhythm/timer (S5 §2.4 reset list). */
  private _setupLevel(index: number): void {
    const level = this._levels[index];
    if (!level) throw new Error(`Beads: no level at index ${index}`);
    this._grid = new BeadGrid(level.pattern);
    this._layout = gridLayoutFor(this._grid.cols, this._grid.rows);
    this._tray.reset();
    this._tray.initNeeded(this._grid.neededColorCounts());
    this._spawner.reset();
    this._spawner.interval = level.spawnInterval ?? 4.0;
    this._spawner.setDecoys(decoyColorIndices(level));
    this._timer.reset(level.time);
    this._sprint.reset();
    this._stageIndex = 0;
    this._isNewBest = false;
  }

  /** Fresh sprint run: stage 0 + full countdown. */
  private _setupSprintRun(): void {
    this._sprint.reset();
    this._sprintCap = this.tuning.sprintTime;
    this._isNewBest = false;
    this._loadStage(0);
    this._timer.reset(this._sprintCap);
    this._emit('sprint:stage', { stageIndex: 0, nextParams: stageParamsFor(0) });
  }

  /** Load sprint stage `n`: pool pattern + C6 params (streak untouched, C8). */
  private _loadStage(n: number): void {
    const { pattern } = buildStagePattern(n);
    this._grid = new BeadGrid(pattern);
    this._layout = gridLayoutFor(this._grid.cols, this._grid.rows);
    this._tray.reset();
    this._tray.initNeeded(this._grid.neededColorCounts());
    this._spawner.reset();
    this._spawner.interval = stageParamsFor(n).interval;
    this._spawner.setDecoys([]);
    this._stageIndex = n;
  }

  /** One PLAYING frame: input → combo window → feed → countdown (fixed order). */
  private _stepPlaying(dt: number): void {
    this._readInput();

    // Placement/stage completion can leave PLAYING within the input step
    // (cleared-priority / C8 stage-first) — nothing else may run that frame.
    if (this._machine.current !== 'playing') return;

    // Combo window (sprint only): placement already reset the window this
    // frame, so a same-frame placement never times out (score-combo §6).
    if (this._mode === 'sprint') {
      const broke = this._sprint.windowTick(dt);
      if (broke) this._emit('combo:break', { reason: broke });
    }

    const spawn = this._spawner.tick(dt, this._tray, this._rng!);
    if (spawn.spawned) this._emit('tray:spawned', spawn.spawned);
    if (spawn.full) this._emit('tray:full', {});

    const tick = this._timer.tick(dt);
    if (tick.displayTick !== null) this._emit('timer:tick', { remaining: tick.displayTick });
    if (tick.urgent !== null) this._emit('timer:urgent', { remaining: tick.urgent });
    if (tick.expired) {
      this._machine.transition('game-over');
    }
  }

  /** Route a design-space tap by priority (input-control §2.1, short-circuit). */
  private _readInput(): void {
    const services = this._services;
    if (!services) return;
    const snap = services.input.snapshot;
    if (!snap.justDown) return;

    services.viewport.screenToDesign(this._pointer, snap.x, snap.y);
    this._handleTap(this._pointer.x, this._pointer.y);
  }

  private _handleTap(x: number, y: number): void {
    this._consumedTap = false;
    // S2 route 1 — the gear is evaluated **before** the phase router and it is
    // only meaningful while PLAYING (pause-settings §2.1: 其余状态点齿轮 = 忽略).
    // Crucially the tap is *swallowed* rather than falling through to the
    // phase's generic behaviour, which is what §8-7 asserts (no retry-with-the-
    // pause-button edge in GAME_OVER, no accidental restart in FINISH).
    if (this._hitGear(x, y)) {
      if (this._machine.current === 'playing') {
        this._consumedTap = true;
        this.onPause();
      }
      return;
    }
    switch (this._machine.current) {
      case 'playing': {
        // 2. Tray bead (62² hit area, nearest slot centre wins).
        const slot = this._hitTraySlot(x, y);
        if (slot >= 0) {
          this.selectTraySlot(slot);
          return;
        }
        // 3. Grid cell (66² hit area, nearest cell centre wins).
        const cell = this._hitGridCell(x, y);
        if (cell) {
          this._placeSelected(cell.row, cell.col);
        }
        return;
      }
      case 'game-over':
        this.retryLevel();
        return;
      case 'finish':
        this.restartRun();
        return;
      case 'paused': {
        // PAUSED answers to panel buttons **only** — the scrim eats everything
        // else (board / tray / cards / gear, pause-settings §2.2 + §8-1).
        const action = this._panel.hitTest(x, y, this._mode);
        if (action) {
          this._consumedTap = true;
          this._applyPanelAction(action);
        }
        return;
      }
      default:
        return; // boot / level-clear: taps ignored (panel answers are PAUSED-only)
    }
  }

  /** Gear hot zone: TOUCH_MIN square at the left edge of HUD_BAND. */
  private _hitGear(x: number, y: number): boolean {
    return x >= 0 && x <= GEAR_HIT_SIZE && y >= HUD_BAND.yMin && y <= HUD_BAND.yMax;
  }

  /**
   * Execute a resolved panel action. Buttons that change the world leave PAUSED
   * (→ PLAYING directly, never through GAME_OVER, §8-3); the audio toggles only
   * write the setting (§8-4) and leave the phase untouched.
   */
  private _applyPanelAction(action: PausePanelAction): void {
    this._sfx(AUDIO_CLIP_UI_TAP);
    switch (action) {
      case 'resume':
        this._machine.transition('playing');
        return;
      case 'restart':
        this._resetLevelForArtifact();
        return;
      case 'toggle-bgm':
        this._setBgmMuted(!this._bgmMuted);
        return;
      case 'toggle-sfx':
        this._setSfxMuted(!this._sfxMuted);
        return;
      case 'start-sprint':
        // U1 secondary entry: leave PAUSED straight into a fresh sprint run.
        this._mode = 'sprint';
        this._setupSprintRun();
        this._machine.reset('playing');
        return;
      default:
        return;
    }
  }

  /**
   * 「重玩本关」/「重新冲刺」= 整关重置五项 (§3.5: 倒计时回满 / 图案清空但
   * locked 不动 / 托盘清空 / 扩展重置 / 道具免费次数回 POWERUP_FREE_USES).
   * Sprint also drops the combo state (P1 frozen 2026-09-12).
   */
  private _resetLevelForArtifact(): void {
    if (this._mode === 'sprint') {
      this._setupSprintRun();
    } else {
      this._setupLevel(this._levelIndex);
    }
    this._machine.transition('playing');
  }

  /** The S2 → S3 route: place the selected bead, then handle every outcome. */
  private _placeSelected(row: number, col: number): boolean {
    const slot = this._tray.selectedSlot;
    if (slot < 0) return false; // S2 gate: no bead selected → no request at all
    const colorIdx = this._tray.selectedColor;
    const verdict = judgePlacement(this._grid, row, col, colorIdx, slot);

    switch (verdict.outcome) {
      case 'placed': {
        this._tray.takeBead(slot);
        this._emit('bead:placed', {
          row: verdict.row,
          col: verdict.col,
          colorIdx: verdict.colorIdx,
          slot: verdict.slot,
        });

        if (this._mode === 'sprint') {
          const score = this._sprint.onPlaced();
          if (score.tierUp !== null) {
            this._emit('combo:up', {
              streak: score.streak,
              multiplier: score.multiplier,
              tier: score.tierUp,
            });
          }
          // Stage full → immediate switch (≤1 frame), bonus time applied
          // BEFORE this frame's timer tick (C8: stage first).
          if (this._grid.isComplete()) this._completeStage();
        } else if (this._grid.isComplete()) {
          // Cleared-priority: the same frame can never also judge a failure —
          // the machine leaves PLAYING before the timer ticks again (S1 §8-5).
          this._machine.transition('level-clear');
        }
        return true;
      }
      case 'rejected': {
        if (verdict.reason === 'invalid-color') {
          console.warn(
            `[beads] invalid colorIdx ${verdict.colorIdx} at (${verdict.row},${verdict.col}) — rejected`,
          );
        }
        this._emit('bead:rejected', {
          row: verdict.row,
          col: verdict.col,
          colorIdx: verdict.colorIdx,
        });
        if (this._mode === 'sprint') {
          const reason = this._sprint.onRejected();
          this._emit('combo:break', { reason });
        }
        return false;
      }
      case 'ignored': {
        // Locked/occupied are silent (zero events, zero noise); only truly
        // invalid coordinates deserve a warning (bead-grid §6).
        if (verdict.reason === 'out-of-bounds') {
          console.warn(`[beads] placement out of bounds (${verdict.row},${verdict.col}) — ignored`);
        }
        return false;
      }
      default:
        return false;
    }
  }

  /** Stage completed: score bonus + time bonus (C8: before the frame's timer tick). */
  private _completeStage(): void {
    const advance = this._sprint.onStageComplete();
    this._timer.addTime(STAGE_BONUS_TIME, this._sprintCap);
    this._loadStage(advance.stageIndex);
    this._emit('sprint:stage', {
      stageIndex: advance.stageIndex,
      nextParams: advance.nextParams,
    });
  }

  /** Sprint run over: persist records and broadcast the settlement. */
  private _recordSprintEnd(): void {
    const score = this._sprint.score;
    const bestStage = this._sprint.bestStage;
    this._isNewBest = score > this._sprintBestScore;
    const save = this._save;
    if (save && this._isNewBest) {
      save.patch({
        sprintBestScore: score,
        sprintBestStage: Math.max(this._sprintBestStage, bestStage),
      });
      save.save();
      this._sprintBestScore = score;
      this._sprintBestStage = Math.max(this._sprintBestStage, bestStage);
    }
    // settleScore: for a sprint run the leaderboard value IS the run score.
    this._emit('sprint:ended', { score, bestStage, settleScore: score });
  }

  // ──────────────────────────────────────────────── S9 settings & audio channels

  /**
   * Persist a settings change immediately (save-progress §2.2: 开关切换即写).
   * The whole `settings` object is patched in one write, so a same-frame pair
   * of toggles never produces two documents (§6 idempotence).
   */
  private _persistSettings(): void {
    const save = this._save;
    if (!save) return;
    save.patch({
      settings: { bgmMuted: this._bgmMuted, sfxMuted: this._sfxMuted },
    });
    save.save();
  }

  /** Music channel toggle — see `_applyAudioChannels` for the two-channel note. */
  private _setBgmMuted(muted: boolean): void {
    this._bgmMuted = muted;
    this._applyAudioChannels();
    this._persistSettings();
  }

  /** Sfx channel toggle — fully independent of the music channel (§8-4). */
  private _setSfxMuted(muted: boolean): void {
    this._sfxMuted = muted;
    this._persistSettings();
  }

  /**
   * Apply both channels to the audio layer.
   *
   * Deviation note (reported to the lead): architecture-beads §2 proposes two
   * `AudioScheduler` instances sharing one `AudioBackend`, but a game only ever
   * receives `GameServices.audio` — the `Platform` (which owns
   * `createAudioBackend()`, `platform/platform.ts:37`) is created inside `App`
   * (`compose/app.ts:76`) and is not reachable from `GameServices`
   * (`core/game/game.ts:51,56`). Building a second scheduler would therefore
   * require a framework change — out of bounds here.
   *
   * Instead the two channels are realised over the single scheduler:
   *   - **bgm** = one looping clip; muting stops it, un-muting re-requests it;
   *   - **sfx** = a request gate; a muted sfx channel never queues anything.
   * Both behaviours are observable independently, which is what §8-4 asserts.
   */
  private _applyAudioChannels(): void {
    const services = this._services;
    if (!services) return;
    if (this._bgmMuted) {
      services.audio.stop(AUDIO_CLIP_BGM);
    } else {
      services.audio.play(AUDIO_CLIP_BGM, { loop: true });
    }
  }

  /** Sfx request gate (never touched by the music toggle, §8-4). */
  private _sfx(clipId: string): void {
    if (this._sfxMuted) return;
    this._services?.audio.play(clipId, { minInterval: 0.05 });
  }

  /** Normal-mode clear → unlock progression (write on key events only). */
  private _persistProgress(): void {
    const save = this._save;
    if (!save) return;
    const levelCount = this._levels.length;
    const next = Math.min(this._levelIndex + 2, levelCount);
    save.patch({
      maxUnlockedLevel: Math.max(save.data.maxUnlockedLevel, next),
      currentLevel: next,
    });
    save.save();
  }

  // ───────────────────────────────────────────────────────────── hit testing

  /** Nearest tray slot within the 62² hit area (ties → lower index). */
  private _hitTraySlot(x: number, y: number): number {
    const half = TRAY_HIT_SIZE / 2;
    let best = -1;
    let bestD2 = half * half;
    const rows = Math.ceil(this._tray.capacity / TRAY_COLS);
    for (let idx = 0; idx < this._tray.capacity; idx++) {
      const row = Math.floor(idx / TRAY_COLS);
      const col = idx % TRAY_COLS;
      const cx = this._traySlotX(col);
      const cy = this._traySlotY(row, rows);
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = idx;
      }
    }
    return best;
  }

  /** Nearest grid cell within the 66² hit area (ties → smaller row). */
  private _hitGridCell(x: number, y: number): { row: number; col: number } | null {
    const half = GRID_HIT_SIZE / 2;
    let bestRow = -1;
    let bestCol = -1;
    let bestD2 = half * half;
    for (let i = 0; i < this._grid.rows; i++) {
      for (let j = 0; j < this._grid.cols; j++) {
        const dx = x - this._layout.colCenterX(j);
        const dy = y - this._layout.rowCenterY(i);
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestRow = i;
          bestCol = j;
        }
      }
    }
    return bestRow >= 0 ? { row: bestRow, col: bestCol } : null;
  }

  /** Tray slot centre X for column `col` (panel centred in the design width). */
  private _traySlotX(col: number): number {
    const rowWidth = TRAY_COLS * (TRAY_SLOT + TRAY_GAP) - TRAY_GAP;
    const left = (this.tuning.width - rowWidth) / 2;
    return left + TRAY_SLOT / 2 + (TRAY_SLOT + TRAY_GAP) * col;
  }

  /** Tray slot centre Y — base row at band centre, expansion row above it. */
  private _traySlotY(row: number, totalRows: number): number {
    const bandMid = (TRAY_BAND.yMin + TRAY_BAND.yMax) / 2;
    const pitch = TRAY_SLOT + TRAY_GAP;
    return bandMid + ((totalRows - 1) * pitch) / 2 - row * pitch;
  }

  // ─────────────────────────────────────────────────────────────── snapshot

  private _lastStars = 0;

  /** Last normal-mode clear's stars (view convenience). */
  get lastStars(): number {
    return this._lastStars;
  }

  private _syncSnapshot(): void {
    const s = this._snapshot;
    s.phase = this._machine.current;
    s.phaseElapsed = this._machine.elapsed;
    s.mode = this._mode;
    s.levelIndex = this._levelIndex;
    const currentLevel = this._levels[this._levelIndex];
    s.levelId = this._mode === 'sprint' ? 'sprint' : currentLevel ? levelIdOf(currentLevel) : '';
    s.levelName =
      this._mode === 'sprint'
        ? `冲刺 STAGE ${this._stageIndex + 1}`
        : (currentLevel?.name ?? '');
    s.levelCount = this._levels.length;

    s.remaining = Math.max(0, Math.ceil(this._timer.remaining - 1e-9));
    s.timeTotal = this._timer.total;
    s.urgent = this._timer.remaining <= TIMER_URGENT_T && this._timer.remaining > 0;

    // Grid cells (rebuild the flat buffer only when dimensions change).
    const cellsNeeded = this._grid.rows * this._grid.cols;
    if (s.gridCols !== this._grid.cols || s.gridRows !== this._grid.rows) {
      s.gridCols = this._grid.cols;
      s.gridRows = this._grid.rows;
      s.cells = [];
      for (let i = 0; i < cellsNeeded; i++) {
        s.cells.push({ state: 'empty', colorIdx: 0, void: false });
      }
    }
    for (let i = 0; i < cellsNeeded; i++) {
      const row = Math.floor(i / this._grid.cols);
      const col = i % this._grid.cols;
      const cell = this._grid.cell(row, col)!;
      const out = s.cells[i]!;
      out.state = cell.state;
      out.colorIdx = cell.colorIdx;
      out.void = cell.void;
    }
    s.gridLeft = this._layout.left;
    s.gridTop = this._layout.top;

    // Tray slots (rebuild on capacity change, i.e. expansion).
    if (s.traySlots.length !== this._tray.capacity) {
      s.traySlots = [];
      for (let i = 0; i < this._tray.capacity; i++) {
        s.traySlots.push({ state: 'free', colorIdx: 0 });
      }
    }
    for (let i = 0; i < this._tray.capacity; i++) {
      const slot = this._tray.slot(i)!;
      const out = s.traySlots[i]!;
      out.state = slot.state;
      out.colorIdx = slot.colorIdx;
    }
    s.trayExpanded = this._tray.expanded;
    s.traySelected = this._tray.selectedSlot;

    // Sprint HUD (normal mode keeps zeros — the view hides the block).
    s.score = this._mode === 'sprint' ? this._sprint.score : 0;
    s.multiplier = this._mode === 'sprint' ? this._sprint.multiplier : 1;
    s.streak = this._mode === 'sprint' ? this._sprint.streak : 0;
    s.stageIndex = this._stageIndex;
    s.sprintBestScore = this._sprintBestScore;
    s.isNewBest = this._isNewBest;

    s.panelVisible = this._panel.visible;
    s.panelProgress = this._panel.progress;
    s.panelInteractive = this._panel.interactive;
    s.bgmMuted = this._bgmMuted;
    s.sfxMuted = this._sfxMuted;

    const copy = bannerFor(s.phase, this._levelIndex >= this._levels.length - 1);
    s.banner = copy.banner;
    s.subBanner = copy.sub;
    s.bootError = this._bootErrors.join('; ');
  }

  private _emit<K extends keyof BeadsEvents>(type: K, payload: BeadsEvents[K]): void {
    if (!this._services) return;
    const bus = this._services.events as unknown as {
      emit: (type: string, payload: unknown) => void;
    };
    bus.emit(type as string, payload);
  }
}

/** Convenience factory used by the dev harness and tests. */
export function createBeadsGame(options: BeadsGameOptions = {}): BeadsGame {
  return new BeadsGame(options);
}
