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
  REWARDED_PLACEMENT,
  SaveManager,
  StateMachine,
  type AudioVoices,
  type Game,
  type GameServices,
  type RenderModelBuilder,
  type Rng,
} from '../../framework/index';

import {
  AUDIO_CLIP_BGM,
  AUDIO_CLIP_CLEAR,
  AUDIO_CLIP_COMBO_BREAK,
  AUDIO_CLIP_COMBO_T1,
  AUDIO_CLIP_COMBO_T2,
  AUDIO_CLIP_COMBO_T3,
  AUDIO_CLIP_DISSOLVE,
  AUDIO_CLIP_PANEL_IN,
  AUDIO_CLIP_PANEL_OUT,
  AUDIO_CLIP_PLACE,
  AUDIO_CLIP_POWERUP,
  AUDIO_CLIP_REJECT,
  AUDIO_CLIP_REVIVE_OK,
  AUDIO_CLIP_SELECT,
  AUDIO_CLIP_STAGE,
  AUDIO_CLIP_STAR,
  AUDIO_CLIP_TRAY_FULL,
  AUDIO_CLIP_UI_TAP,
  AUDIO_CLIP_URGENT_BEAT,
  AUDIO_REJECT_MIN_INTERVAL,
  AUDIO_SFX_MIN_INTERVAL,
  AUDIO_TRAYFULL_MIN_INTERVAL,
  AUDIO_URGENT_MIN_INTERVAL,
  DEFAULT_TUNING,
  GEAR_HIT_SIZE,
  HUD_BAND,
  REVIVE_BONUS_SEC,
  REVIVE_MAX_PER_LEVEL,
  STAGE_BONUS_TIME,
  computeClearStars,
  normalSettleScore,
  TIMER_URGENT_T,
  TAP_HINT_MS,
  TAP_HINT_NO_SELECTION_TEXT,
  AD_PLACEHOLDER_HINT_TEXT,
  WRONG_FX_MS,
  WRONG_FX_RESTART_GATE_MS,
  TRAY_COLS,
  expandButtonLayout,
  trayLayout,
  GRID_HIT_SIZE,
  TRAY_HIT_SIZE,
  POWERUP_TYPES,
  powerupCardRects,
  gridLayoutFor,
  stageParamsFor,
  validatedSprintTime,
  type BeadsTuning,
  type GridLayout,
  type PowerupType,
  type StageParams,
} from '../config/tuning';
import { BEADS_AUDIO_VOICES } from '../config/audio-voices';
import {
  LEVELS,
  buildStagePattern,
  decoyColorIndices,
  levelIdOf,
  validateBeadsLevel,
  type BeadsLevelRaw,
} from '../config/levels';
import { BeadGrid } from '../entities/grid';
import {
  CrashSnapshotStore,
  decodeFilledBits,
  encodeFilledBits,
  type CrashSnapshot,
} from './crash-snapshot';
import { Tray } from '../entities/tray';
import { PowerupSystem } from '../systems/powerups';
import { FinishPanel, type FinishPanelAction } from '../systems/finish-panel';
import { SprintSettlePanel, type SprintSettleAction } from '../systems/sprint-settle';
import { comboVfxProgress, comboVfxSpec, type ComboVfxKind, type ComboVfxSpec } from '../view/combo-vfx';
import {
  ClearPanel,
  type ClearPanelAction,
  type ClearPanelOptions,
} from '../systems/clear-panel';
import { judgeRetrieve } from '../systems/retrieve';
import { judgePlacement } from '../systems/placement';
import { Spawner } from '../systems/spawner';
import { GameTimer } from '../systems/timer';
import { SprintTracker } from '../systems/sprint';
import { PausePanel, type PausePanelAction } from '../systems/pause-panel';
import { hitFailPanel } from '../systems/fail-panel';
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
  SAVE_VERSION,
  bootLevel,
  defaultBeadsSave,
  migrateV1ToV2,
  normalizeBeadsSave,
  preserveCorruptBackup,
  type BeadsSave,
} from './save-schema';
import { DEFAULT_PALETTE, type BeadsPalette } from '../view/palette';
import { buildBeadsView } from '../view/view-model';

/** Events emitted on the framework bus — systems-index §4 (v1.22 event table). */
export interface BeadsEvents extends Record<string, unknown> {
  'tray:spawned': { slot: number; colorIdx: number };
  'tray:selected': { slot: number; colorIdx: number };
  /** v1.22 新增：错位珠选中（选择锚置 `board`，与 `tray:selected` 互斥对称）。 */
  'board:selected': { row: number; col: number; colorIdx: number };
  /** v1.22 新增：取回入槽（S3/S4 同帧原子，不计分不断连）。 */
  'tray:stored': { slot: number; colorIdx: number; fromRow: number; fromCol: number };
  /** v1.22 payload 变更：`slot` 改可选（托盘路径必带；解环器路径不带，E4）。 */
  'bead:placed': { row: number; col: number; colorIdx: number; slot?: number };
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

/**
 * §3.2 限流分档（真源：`audio-events.md §3.2` ↔ `systems-index §3.12`）。
 *
 * **一刀切 0.05 是缺陷**（冲突登记 C-A05-4）：那会让 `sfx_reject` 跑到 20 次/秒，
 * 直接违反 §3.8「错误反馈 ≤2 次/秒」。未列出的 clip = 一次性事件音 ⇒ `0`
 * （不限流），因为状态机天然单次触发（过关 / 结算 / 面板 / 续时 / stage）。
 */
const SFX_MIN_INTERVAL: Readonly<Record<string, number>> = {
  [AUDIO_CLIP_REJECT]: AUDIO_REJECT_MIN_INTERVAL,
  [AUDIO_CLIP_URGENT_BEAT]: AUDIO_URGENT_MIN_INTERVAL,
  [AUDIO_CLIP_TRAY_FULL]: AUDIO_TRAYFULL_MIN_INTERVAL,
  [AUDIO_CLIP_PLACE]: AUDIO_SFX_MIN_INTERVAL,
  [AUDIO_CLIP_SELECT]: AUDIO_SFX_MIN_INTERVAL,
};

/** §1「面板入 / 出」的宿主相位：四个面板态均覆盖（A05-18）。 */
const PANEL_PHASES: readonly BeadsPhase[] = ['paused', 'level-clear', 'game-over', 'finish'];

function isPanelPhase(phase: BeadsPhase | null): boolean {
  return phase !== null && PANEL_PHASES.indexOf(phase) >= 0;
}

export class BeadsGame implements Game {
  readonly id = 'beads';
  readonly tuning: BeadsTuning;
  readonly palette: BeadsPalette;
  /**
   * clip → 合成配方（数值全为**工程占位**，见 `config/audio-voices.ts` 头注）。
   * App 把它转交给 `Platform.createAudioBackend()`，框架不持有玩法音色库（ADR-0013）。
   */
  readonly audioVoices: AudioVoices = BEADS_AUDIO_VOICES;

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
  /**
   * S6 道具系统（`powerups.md`）。持有**只读镜像**与三计数；清槽仍由 `_tray`
   * 执行（§2.4），网格与时钟零接触（§2.2 明确边界）。
   */
  private readonly _powerups = new PowerupSystem();
  /** Over-limit card tap hint（§2.6 布局 A 占位轻提示；成功使用 / 换关即清）。 */
  private _powerupHint = '';
  /**
   * S7 结算·过关面板（WXG-T-063）。`LEVEL_CLEAR` 由它**等按钮**推进
   * （`ux-spec §4` 流转表），取代此前的「1.4s 自动进下一关」占位。
   */
  private readonly _clearPanel = new ClearPanel();
  /** 本关结算分（C7，局内不显示；面板与测试读它）。 */
  private _lastSettleScore = 0;
  /** 已触发过入场音效的星数（每星一次，ux-spec §5）。 */
  private _clearStarsAnnounced = 0;
  /**
   * S7 通关画面（FINISH，WXG-T-066）：`ux-spec §3.6` 全屏庆祝 + 星级总览 + 双钮
   * （去冲刺 / 重玩第 1 关）。进入条件与出口见 `core-loop §4` 与判据 `§8-8`。
   */
  private readonly _finishPanel = new FinishPanel();
  /**
   * 每关**历史最好**星级（`0` = 未通关），下标 = `levelIndex`；通关画面总览的数据源。
   * **权威在存档**（S8 GDD §2.2 的 `stars`，WXG-T-071 落码）：BOOT 装载、过关时随
   * `_persistProgress()` 写回；本字段是内存**镜像**（与 `_sprintBestScore` 同判例）。
   */
  private _starsByLevel: number[] = [];
  /** 已触发过入场音效的**关数**（每关一次，逐关 150ms）。 */
  private _finishRowsAnnounced = 0;
  /**
   * S7 冲刺结算面板（`ux-spec §3.5` **左列**，WXG-T-067）：冲刺归零时复用 `GAME_OVER`
   * 相位展示「单局 / 最高梯位 / 最高连击」+ 双钮（再来一局 / 返回关卡），且**不出现**
   * 续时主钮（§3.5 明文）。
   */
  private readonly _sprintSettle = new SprintSettlePanel();
  /**
   * S7 连击特效（`score-combo §2.5`）：当前正在播的那一档（**同时只存在一个** —— 多档重叠
   * 时只播最高档，避免叠加成闪烁）。`row/col` 是 Lv1 粒子的锚点（落子格心）。
   */
  private _comboVfx: { spec: ComboVfxSpec; elapsedMs: number; row: number; col: number } | null = null;
  /**
   * GAP-04/03/10 反馈态（WXG-T-087）——均为**表现层**，与 `_comboVfx`/面板同判例。
   * `_pulseClock` 单调推进（ms），驱动告急 α、hint 呼吸、满槽脉冲的循环相位。
   */
  private _pulseClock = 0;
  /** `wrong` 态：被拒格心 + 播放进度（`WRONG_FX_MS` 后自动清）。 */
  private _wrongFx: { row: number; col: number; elapsedMs: number } | null = null;
  /**
   * 上次起播 `wrong` fx 的时基（`_pulseClock` ms）。驱动**连续拒绝 500ms 重启门**
   * （WXG-T-102/BD-29，`WRONG_FX_RESTART_GATE_MS`）；`-Infinity` ⇒ 首帧即允许起播。
   */
  private _wrongFxArmedAtMs = Number.NEGATIVE_INFINITY;
  /**
   * 一次性轻提示（BD-16 无选中点格 / BD-15 扩展位占位共用通道，ux-spec §5 WXG-T-097）。
   * 与 `_wrongFx` 同判例：表现层计时，`TAP_HINT_MS` 后自清，不占常驻分配。
   */
  private _tapHint: {
    text: string;
    row: number;
    col: number;
    anchor: 'cell' | 'expand';
    elapsedMs: number;
  } | null = null;
  /** 首屏引导已完成（老玩家 BOOT 即 true；首次玩家首次落子后置 true）。一置不再重现。 */
  private _onboardDone = true;
  /**
   * Why we entered PAUSED (WXG-T-055 D-04). `null` outside PAUSED.
   * Gear → `'manual'`; WeChat `onHide` → `'system'`. Both stay on the
   * panel until 继续 — `onResume` (foreground) never exits PAUSED.
   */
  private _pauseIntent: 'manual' | 'system' | null = null;
  /** Successful fail-page revives this attempt (reset on full level restart). */
  private _reviveCount = 0;
  /** Seconds of fail-page bonus still attached to the playable clock. */
  private _reviveBonusSec = 0;
  /** True while `rewardedAd.show()` for fail-continue is in flight. */
  private _watchingAd = false;
  /** Fail-panel hint (Noop / rejected show). Cleared on the next overlay action. */
  private _failHint = '';

  private _grid: BeadGrid = new BeadGrid(['..11..', '.1111.', '111111', '.1111.', '..11..']);
  private _layout: GridLayout = gridLayoutFor(6, 5);

  private _services: GameServices | null = null;
  private _save: SaveManager<BeadsSave> | null = null;
  /** D-03 崩溃恢复档（另键 sidecar，WXG-T-059；与 S8 常规档物理隔离）。 */
  private _crash: CrashSnapshotStore | null = null;
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
  /** WXG-T-088 accessibility mirror: D1 减弱动效 / E2 大字号（走 snapshot 暴露给 view）。 */
  private _reduceMotion = false;
  private _largeText = false;
  /** BOOT validation errors — non-empty means the game refuses PLAYING. */
  private _bootErrors: string[] = [];

  /** Scratch point for screen → design conversion (never retained). */
  private readonly _pointer = { x: 0, y: 0 };

  /**
   * 统一选择锚 · board 侧（input-control §2.1 v2.0，Epic T-133 E2）。`null` = 无
   * board 锚。与托盘的 `selected` 槽位态（S4）**三值互斥**：`selection ∈ {tray,
   * board, none}` 至多一侧非空——建立一侧时必须清除另一侧（换选即转移，不叠选）。
   * 生命周期 = PLAYING 局内态：`_setupLevel` / `_loadStage` 重置；不在崩溃快照里
   * （恢复后锚 = tray-or-none，与 traySelected 同批管理，E5 扩错位珠色时再议）。
   */
  private _boardSelected: { row: number; col: number } | null = null;

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

  /**
   * Pause source while `phase === 'paused'`, else `null`.
   * Distinguishes player gear from WeChat `onHide` (D-04 / D-03 hook).
   */
  get pauseIntent(): 'manual' | 'system' | null {
    return this._pauseIntent;
  }

  /** True after a successful fail-page revive this attempt. */
  get revived(): boolean {
    return this._reviveCount > 0;
  }

  /** Bonus seconds currently subtracted from remaining when rating stars. */
  get reviveBonusSec(): number {
    return this._reviveBonusSec;
  }

  /** True while a fail-page ad is showing (tests settle the Mock). */
  get watchingAd(): boolean {
    return this._watchingAd;
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

  /**
   * 统一选择锚（input-control §2.1 v2.0）——派生只读，三值互斥不变式由本类所有
   * 写点共同维持：`tray` = 托盘有 `selected` 槽；`board` = `_boardSelected` 非空；
   * 两侧写点互为清除（换选即转移）。测试 / harness / E6 快照消费。
   */
  get selection(): 'tray' | 'board' | 'none' {
    if (this._tray.selectedSlot >= 0) return 'tray';
    if (this._boardSelected !== null) return 'board';
    return 'none';
  }

  /** board 锚：选中的错位珠格坐标（无 = null）。与快照 `boardSelectedRow/Col` 同真源。 */
  get boardSelected(): { readonly row: number; readonly col: number } | null {
    return this._boardSelected;
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

  /** S6 道具系统（暴露给测试；只读用法，写路径仍走 `usePowerup`）。 */
  get powerups(): PowerupSystem {
    return this._powerups;
  }

  /** 超限占位轻提示（'' = 无）。视图从快照读，测试从这里读。 */
  get powerupHint(): string {
    return this._powerupHint;
  }

  get bgmMuted(): boolean {
    return this._bgmMuted;
  }

  get sfxMuted(): boolean {
    return this._sfxMuted;
  }

  /** D1 减弱动效开关（view 经 snapshot 消费，抑制非必要位移/脉冲）。 */
  get reduceMotion(): boolean {
    return this._reduceMotion;
  }

  /** E2 大字号开关（view 经 snapshot 消费，正文类文本放大）。 */
  get largeText(): boolean {
    return this._largeText;
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
    // S6 的 `random` 只能抽自注入的 Rng（铁律 L4；§8-4 有架构守卫）。
    this._powerups.attach(services.rng);

    // Preserve an unreadable document before SaveManager discards it — best effort.
    preserveCorruptBackup(services.storage, this._saveKey);

    this._save = new SaveManager<BeadsSave>(services.storage, {
      key: this._saveKey,
      version: SAVE_VERSION,
      defaults: defaultBeadsSave,
      // v1→v2（WXG-T-088 可访问性开关）：只升版本号，新字段交由 normalizeSettings
      // 逐字段降级——不注册则 SaveManager 会把旧档判为待迁移而重置丢进度。
      migrations: { 1: migrateV1ToV2 },
    });

    // D-03：崩溃恢复档是**另键** sidecar（提案 §5 方案 A）——S8 的键 / version /
    // `normalizeBeadsSave` 零改动，`save-schema.ts` 一字未动。
    this._crash = new CrashSnapshotStore(services.storage);

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
    // S8 §2.2 `stars`：装载为内存镜像（长度已由 `normalizeBeadsSave` 按关卡表补齐）。
    this._starsByLevel = [...normalized.save.starsByLevel];
    this._bgmMuted = normalized.save.settings.bgmMuted;
    this._sfxMuted = normalized.save.settings.sfxMuted;
    this._reduceMotion = normalized.save.settings.reduceMotion;
    this._largeText = normalized.save.settings.largeText;
    this._applyAudioChannels();

    this._subscribe();
    this._boot();
  }

  update(dt: number): void {
    if (!this._services) return;
    // ── 输入段（相位无关，WXG-T-100 / BD-34）────────────────────────────────
    // `_handleTap` 的相位路由表已写全四相位（`input-control §2.3 状态门禁`：
    // PAUSED 仅暂停面板按钮；LEVEL_CLEAR / GAME_OVER / FINISH 仅各自面板按钮；
    // BOOT 全部忽略），此前唯一缺口是 `_readInput()` 只被 `_stepPlaying()` 调用
    // ⇒ 面板四相位收不到真链点击、面板按钮沦为空壳（真人永久卡死在暂停面板）。
    // 读输入必须**先于** `machine.update()`：帧内序为
    //   输入（段内序：状态指令 → 玩法事件）→ 连击窗 → 供料 → 计时
    // （`core-loop §2.2.2` / `pause-settings §6`）；放到 `machine.update()` 之后
    // 会把输入挤到计时之后，破坏该序。热路径零分配：`_readInput` 只写复用指针。
    this._readInput();
    this._machine.update(dt);
    // Panel animation is presentation, not gameplay: it keeps running while the
    // world is frozen so the enter/exit ramp never stalls (ux-spec §5).
    this._panel.update(dt * 1000);
    this._clearPanel.update(dt * 1000); // 结算面板同理：退出淡出要在离开 LEVEL_CLEAR 后跑完
    this._finishPanel.update(dt * 1000); // 通关画面同理
    this._sprintSettle.update(dt * 1000); // 冲刺结算面板同理
    this._stepComboVfx(dt); // §2.5 连击特效：表现层，不被 PAUSED 冻结
    this._pulseClock += Math.max(0, dt) * 1000; // GAP-04/03/10 循环脉冲基准（同判例不冻结）
    this._stepWrongFx(dt);
    this._stepTapHint(dt); // BD-16/BD-15 一次性轻提示：同不冻结（表现层）
  }

  buildRenderModel(builder: RenderModelBuilder): void {
    this._syncSnapshot();
    buildBeadsView(builder, this._snapshot, this.palette);
  }

  /**
   * App moved to the background (WeChat `onHide`). PLAYING → PAUSED as a
   * system pause; already-PAUSED (manual gear) stays put — no re-enter,
   * no second `game:paused`. D-03 crash snapshot will hook this path and
   * must still run when already paused (see `design/proposals/in-level-snapshot.md`).
   */
  onPause(): void {
    this._requestPause('system');
    // D-03（WXG-T-059）：写崩溃快照。**必须在 `_requestPause` 之后**——那时 phase 已是
    // PAUSED、倒计时已冻结；而「手动暂停后再 onHide」时 `_requestPause` 会早退，
    // 写盘仍必须执行（提案 §3：已 PAUSED 的 hide 也要覆盖写）。
    this._writeCrashSnapshot();
  }

  /**
   * App returned to the foreground (WeChat `onShow`).
   *
   * Pause-settings §6: panel buttons are the **only** exit from PAUSED.
   * Both system hide and manual gear therefore stay on the pause panel
   * until the player taps 继续. `App` still calls `loop.reset()` then
   * this hook — we do not split that framework wiring.
   */
  onResume(): void {
    // State-machine no-op by design (WXG-T-055 D-04).
  }

  dispose(): void {
    for (const unsub of this._unsubs) unsub();
    this._unsubs.length = 0;
    this._save?.flush();
    this._services = null;
  }

  // ────────────────────────────────────────────────────────── player commands

  /**
   * Select a tray slot (S2 route 4a). Idempotent; re-selection moves the mark.
   * v2.0：成功即建立 tray 锚并**清除 board 锚**（互斥换选，input-control §2.1）。
   */
  selectTraySlot(slot: number): boolean {
    if (this._machine.current !== 'playing') return false;
    const result = this._tray.select(slot);
    if (result !== 'selected') return false;
    this._boardSelected = null; // 互斥换选：tray 锚建立 ⇒ board 锚清除（零事件）
    const color = this._tray.slot(slot)!.colorIdx;
    this._emit('tray:selected', { slot, colorIdx: color });
    this._powerups.noteSelected(slot); // S6 镜像：region 的窗口锚点（§2.2）
    return true;
  }

  /**
   * v2.0 选错位珠命令（S2 route 5a 的公开形态，Epic T-133 E2；与 `selectTraySlot`
   * / `retrieveBead` 同判例——测试与 harness 不伪造触摸）。仅 `filled(错位)` 可选中
   * （判定直接用 grid 派生谓词 `isMisplaced`，不在路由层复制逻辑）；同一颗幂等
   * （双击零新事件，§8-6 同型）；换选别的错位珠即转移锚。成功时清除托盘选中
   * （互斥，静默零事件）并广播 `board:selected {row, col, colorIdx}`
   * （systems-index §4；`colorIdx` = 珠色 `beadColorIdx`，与 `tray:selected` 的
   * 「珠色」语义对称）。
   *
   * @returns true only when the anchor was established (or already on this bead).
   */
  selectBoardBead(row: number, col: number): boolean {
    if (this._machine.current !== 'playing') return false;
    if (!this._grid.isMisplaced(row, col)) return false;
    const prev = this._boardSelected;
    if (prev && prev.row === row && prev.col === col) return true; // 幂等：不重发
    this._clearTraySelection(); // 互斥换选：board 锚建立 ⇒ tray 锚清除
    this._boardSelected = { row, col };
    this._emit('board:selected', {
      row,
      col,
      colorIdx: this._grid.cell(row, col)!.beadColorIdx,
    });
    return true;
  }

  /**
   * 静默清除托盘选中（锚互斥的 S4 侧半边，input-control §2.1「换选即转移」）。
   * ⚠️ 槽位态 `selected → holding` 直写：Tray 尚无 deselect 通道（`src/entities/**`
   * 属 E1 域本单禁改，已回传登记，建议后续批次给 Tray 补 `deselect()`）。S6 镜像
   * **无需**反向通知——`_anchor` 语义只要求该槽仍 `holding`（powerups.ts §region
   * 的回退读法），`selected → holding` 天然满足，无漂移。
   */
  private _clearTraySelection(): void {
    const selected = this._tray.selectedSlot;
    if (selected < 0) return;
    this._tray.slot(selected)!.state = 'holding';
  }

  /**
   * Attempt to place the currently selected bead at (row, col) — the S2 → S3
   * route as a public command so tests and the harness never fake touch events.
   * v2.0：与真链路由 5b 共用 `_routeGridEmpty`——「无托盘选中」的前置缺口轻提示
   * （BD-16，§8-7）在路由层统一表达，旁路与真链同口径。
   * @returns true only when the placement was accepted.
   */
  tapGridCell(row: number, col: number): boolean {
    if (this._machine.current !== 'playing') return false;
    return this._routeGridEmpty(row, col);
  }

  /**
   * v2.0 取回命令（Epic T-133 E1）— the S2 route 4b → S3/S4 pair-write as a
   * public command. Takes the explicit misplaced cell `(row, col)` and the
   * PLAYER-CHOSEN `targetSlot` (v2.0: no random drop); the caller (E2 router,
   * tests) reads them off its selection anchor — this API deliberately does
   * NOT own the anchor (input-control §2.1: `selection ∈ {tray, board, none}`
   * is E2's routing state, see `retrieve.ts` for the adjudication).
   *
   * On success: grid `filled(错位)` → `empty` + slot `free` → `holding` in the
   * same call stack, then `tray:stored {slot, colorIdx, fromRow, fromCol}`.
   * Every refusal branch is ZERO-EVENT (满槽禁取珠 §3.13; locked/就位 taps get
   * their 极轻反馈 from the S2/view layer, never from here).
   *
   * @returns true only when the retrieval was stored.
   */
  retrieveBead(row: number, col: number, targetSlot: number): boolean {
    if (this._machine.current !== 'playing') return false;
    const verdict = judgeRetrieve(this._grid, this._tray, row, col, targetSlot);
    if (verdict.outcome === 'stored') {
      this._emit('tray:stored', {
        slot: verdict.slot,
        colorIdx: verdict.colorIdx,
        fromRow: verdict.fromRow,
        fromCol: verdict.fromCol,
      });
      return true;
    }
    // All refusals are silent by design; only impossible coordinates log.
    if (verdict.reason === 'out-of-bounds') {
      console.warn(`[beads] retrieve out of bounds (${row},${col}) — ignored`);
    }
    return false;
  }

  /**
   * S2 route 2 — 道具卡点击，一次原子结算（powerups §2.3）。
   *
   * 「点名归 S6、动手归 S4」：本方法拿 `affectedSlots` 后**由 `_tray` 执行清槽**
   * （§2.4「清槽动作由 S4 执行」），再把**实际清空**的槽广播进 `powerup:used`
   * （§8-1 要求 payload 与 S4 实际清空 1:1）。
   *
   * @returns 仅当效果真的生效时为 true；`exhausted` 另置占位轻提示（§2.6），
   *          `empty` / `invalid` 为零事件零扣次的静默出口。
   */
  usePowerup(type: PowerupType): boolean {
    if (this._machine.current !== 'playing') return false;
    const outcome = this._powerups.request(type);
    if (outcome.kind === 'exhausted') {
      // 占位文案与 `btn_expand` 同一常量（§2.6 布局 A：四处广告位同一语义）。
      this._powerupHint = AD_PLACEHOLDER_HINT_TEXT;
      return false;
    }
    if (outcome.kind !== 'used') return false;
    this._powerupHint = '';
    const cleared = this._tray.clearSlots(outcome.affectedSlots);
    if (cleared.length !== outcome.affectedSlots.length) {
      // 镜像漂移（S4 侧已 free）：幂等跳过并记警告供回归排查（§2.4 一致性硬要求）。
      console.warn(
        `[beads] S6 镜像漂移：点名 ${outcome.affectedSlots.length} 槽、实际清空 ${cleared.length} 槽`,
      );
    }
    this._emit('powerup:used', { type: outcome.type, affectedSlots: cleared });
    return true;
  }

  /** Unlock the tray expansion row (MVP: badge-only placeholder, no ad call). */
  expandTray(): boolean {
    if (!this._tray.expand()) return false;
    this._emit('tray:expanded', {});
    this._powerups.noteCapacity(this._tray.capacity); // S6 镜像：生效容量（§2.1）
    return true;
  }

  /**
   * Debug/dev hook: route a design-space tap through the real S2 priority
   * router (gear → 道具卡 → btn_expand → tray → grid). Lets tests and the harness
   * exercise routing without faking platform pointer events.
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
    this._powerups.noteSpawned(slot);
    return slot;
  }

  /** Retry after game over: normal → same level fresh; sprint → new run. */
  retryLevel(): boolean {
    if (this._machine.current !== 'game-over') return false;
    this._watchingAd = false;
    this._failHint = '';
    this._sprintSettle.close(); // 冲刺结算淡出由 `update()` 跑完（与其余面板同判例）
    this._crash?.clear(); // D-03（提案 §3）：重开本局 ⇒ 旧快照失效
    if (this._mode === 'sprint') {
      this._setupSprintRun();
    } else {
      this._setupLevel(this._levelIndex);
    }
    this._machine.transition('playing');
    return true;
  }

  /**
   * Fail-page 续时: load + show the fail-continue placement. Stays in
   * GAME_OVER until `onRewarded`. Sprint / cap / in-flight show → no-op.
   */
  requestRevive(): boolean {
    if (this._machine.current !== 'game-over') return false;
    if (this._mode !== 'normal') return false;
    if (this._reviveCount >= REVIVE_MAX_PER_LEVEL) return false;
    if (this._watchingAd) return false;
    const ad = this._services?.rewardedAd;
    if (!ad) return false;
    this._failHint = '';
    this._watchingAd = true;
    ad.load(REWARDED_PLACEMENT.failContinue);
    ad.show();
    if (this._watchingAd) return true;
    if (this._machine.current !== 'game-over') return true;
    this._failHint = '即将开放';
    return false;
  }

  /** From the FINISH screen: replay the whole normal campaign from level 1. */
  restartRun(): boolean {
    if (this._machine.current !== 'finish') return false;
    this._mode = 'normal';
    this._crash?.clear(); // D-03：整轮重玩 ⇒ 旧快照失效
    this._finishPanel.close(); // 淡出由 `update()` 跑完（与结算面板同判例）
    this._setupLevel(0);
    this._machine.transition('playing');
    return true;
  }

  /** Level jump for level-select UI / harness / tests (normal mode). */
  goToLevel(index: number): void {
    this._mode = 'normal';
    const clamped = Math.max(0, Math.min(index, this._levels.length - 1));
    this._levelIndex = clamped;
    this._crash?.clear(); // D-03：跳关 ⇒ 旧快照失效
    this._setupLevel(clamped);
    this._machine.reset('playing');
  }

  /** Enter a fresh sprint run (endless ladder). */
  startSprint(): void {
    this._mode = 'sprint';
    this._crash?.clear(); // D-03：开新冲刺 run ⇒ 旧快照失效
    this._setupSprintRun();
    this._machine.reset('playing');
  }

  /** Leave sprint back to the normal campaign at the current level. */
  startNormal(): void {
    this._mode = 'normal';
    this._sprintSettle.close(); // 「返回关卡」出口：面板退场（§3.5 左列副钮）
    this.goToLevel(this._levelIndex);
  }

  // ─────────────────────────────────────────────────────────────── internals

  private readonly _unsubs: (() => void)[] = [];

  // ───────────────────────────────────────── D-03 崩溃快照（WXG-T-059）──────────

  /** 该关可填格数（快照位图长度校验用）；索引非法 → 0。 */
  private _crashFillableCountFor(index: number): number {
    const level = this._levels[index];
    if (!level) return 0;
    return new BeadGrid(level.pattern).fillableTotal;
  }

  /**
   * 快照位图应有长度：普通关按关卡表，**冲刺按舞台图案**
   * （`buildStagePattern(stageIndex)`——与 `levelIndex` 无关；见 `CrashContext` 注释）。
   */
  private _fillableCountFor(mode: GameMode, levelIndex: number, stageIndex: number): number {
    if (mode === 'sprint') {
      return new BeadGrid(buildStagePattern(stageIndex).pattern).fillableTotal;
    }
    return this._crashFillableCountFor(levelIndex);
  }

  /**
   * 只在 PLAYING / PAUSED 写快照；其余相位（BOOT / LEVEL_CLEAR / GAME_OVER / FINISH）
   * **删除**既有快照（提案 §3 表）——否则过关前的残局会覆盖下次启动。
   */
  private _writeCrashSnapshot(): void {
    const store = this._crash;
    if (!store) return;
    const phase = this._machine.current;
    if (phase !== 'playing' && phase !== 'paused') {
      store.clear();
      return;
    }
    // 写失败静默（微信 storage 配额）：本局内存态继续，与 S8 §6 同口径。
    store.write(this._captureCrashSnapshot());
  }

  /** 抓取局内可序列化子集（提案 §2 字段表 + 2 项增补，见 `crash-snapshot.ts` 文件头）。 */
  private _captureCrashSnapshot(): CrashSnapshot {
    // 只收**可填格**：`locked`（x）与 `.` void 由图案重建，禁止另存（防双真源）。
    const filled: boolean[] = [];
    for (let r = 0; r < this._grid.rows; r++) {
      for (let c = 0; c < this._grid.cols; c++) {
        const cell = this._grid.cell(r, c);
        if (!cell || cell.void || cell.state === 'locked') continue;
        filled.push(cell.state === 'filled');
      }
    }

    const traySlots: { colorIdx: number }[] = [];
    for (let i = 0; i < this._tray.capacity; i++) {
      const slot = this._tray.slot(i);
      traySlots.push({ colorIdx: slot && slot.state !== 'free' ? slot.colorIdx : 0 });
    }

    const sprint = this._sprint;
    return {
      version: 1,
      // 提案写 `platform.now()`；`GameServices` 未暴露时钟，且 TTL 未启用 ⇒ 用 Date.now()。
      writtenAtMs: Date.now(),
      mode: this._mode,
      levelIndex: this._levelIndex,
      pauseIntent: this._pauseIntent ?? 'system',
      gridFilled: encodeFilledBits(filled),
      traySlots,
      trayExpanded: this._tray.expanded,
      traySelected: this._tray.selectedSlot,
      remaining: this._timer.remaining,
      timeTotal: this._timer.total,
      spawnAcc: this._spawner.acc,
      spawnInterval: this._spawner.interval,
      spawnFullReported: this._spawner.fullReported,
      // S6 已入 `src`（WXG-T-060）⇒ 真值；字段语义 = **已用次数**（`0..POWERUP_FREE_USES`）。
      powerupUses: this._powerups.used,
      reviveCount: this._reviveCount,
      reviveBonusSec: this._reviveBonusSec,
      sprint:
        this._mode === 'sprint'
          ? {
            streak: sprint.streak,
            multiplier: sprint.multiplier,
            tier: sprint.tier,
            score: sprint.score,
            stageIndex: sprint.stageIndex,
            bestStage: sprint.bestStage,
            bestStreak: sprint.bestStreak,
            windowRemaining: sprint.windowRemaining,
          }
          : null,
    };
  }

  /**
   * BOOT 恢复（提案 §4）：校验通过则装配局内态并**停在 PAUSED**，返回 true；
   * 否则返回 false，由 `_boot()` 走常规新局（坏档已被 `read()` 清掉）。
   *
   * `machine.reset('paused')` 会触发 `paused.onEnter`（开面板 + 发 `game:paused`）——
   * 正是提案要的「与 D-04 回前台语义一致」，也避免 BOOT 当帧 dt 吃掉 remaining。
   */
  private _restoreCrashSnapshot(): boolean {
    const store = this._crash;
    if (!store) return false;
    const snapshot = store.read({
      levelCount: this._levels.length,
      fillableCountFor: (spec) =>
        this._fillableCountFor(spec.mode, spec.levelIndex, spec.stageIndex),
    });
    if (!snapshot) return false;

    if (!this._applyCrashSnapshot(snapshot)) {
      store.clear();
      return false;
    }
    // 杀进程后一律按「系统打断」展示面板（提案 §2）。
    this._pauseIntent = 'system';
    this._machine.reset('paused');
    return true;
  }

  /** 把校验过的快照盖回权威状态；返回 false = 与现行关卡表对不上（丢快照）。 */
  private _applyCrashSnapshot(snapshot: CrashSnapshot): boolean {
    const bits = decodeFilledBits(
      snapshot.gridFilled,
      this._fillableCountFor(snapshot.mode, snapshot.levelIndex, snapshot.sprint?.stageIndex ?? 0),
    );
    if (!bits) return false;

    this._mode = snapshot.mode;
    if (snapshot.mode === 'sprint') {
      const sprint = snapshot.sprint;
      if (!sprint) return false;
      this._sprint.reset();
      this._loadStage(sprint.stageIndex);
      this._sprint.restore(sprint);
      this._timer.reset(Math.max(snapshot.timeTotal, 0));
    } else {
      const level = this._levels[snapshot.levelIndex];
      if (!level) return false;
      // 普通关：供料心跳须与现行关卡表一致，否则视为对不上（提案 §2）。
      const expected = level.spawnInterval ?? 4.0;
      if (Math.abs(expected - snapshot.spawnInterval) > 1e-9) return false;
      this._levelIndex = snapshot.levelIndex;
      this._setupLevel(snapshot.levelIndex);
      this._timer.reset(Math.max(snapshot.timeTotal, 0));
    }

    // 倒计时：`GameTimer` 没有 remaining setter ⇒ 用 `reset(total)` 再 `tick` 掉差值
    // （差值 ≥ 0；tick 内部 clamp 到 0，其返回值此处无需消费）。
    const delta = snapshot.timeTotal - snapshot.remaining;
    if (delta > 0) this._timer.tick(delta);

    // 位图按图案 zip 盖回（只盖可填格）。
    let k = 0;
    for (let r = 0; r < this._grid.rows; r++) {
      for (let c = 0; c < this._grid.cols; c++) {
        const cell = this._grid.cell(r, c);
        if (!cell || cell.void || cell.state === 'locked') continue;
        if (bits[k]) this._grid.fill(r, c);
        k += 1;
      }
    }
    if (k !== bits.length) return false;

    // needed[] **重算**（提案 §2：绝不从快照恢复，防双真源）。
    this._tray.initNeeded(this._grid.neededColorCounts());

    // 托盘：先扩容，再逐槽还原（`colorIdx = 0` 即 free）。
    if (snapshot.trayExpanded && !this._tray.expanded) this._tray.expand();
    // S6 镜像：**先容量、后逐槽**（否则扩展行槽会被容量守卫丢弃）。镜像本身绝不
    // 从快照恢复——它只是托盘的投影，防双真源（与 `needed[]` 同口径，提案 §2）。
    this._powerups.noteCapacity(this._tray.capacity);
    for (let i = 0; i < snapshot.traySlots.length; i++) {
      const colorIdx = snapshot.traySlots[i]!.colorIdx;
      if (colorIdx > 0 && this._tray.spawnInto(i, colorIdx)) this._powerups.noteSpawned(i);
    }
    if (snapshot.traySelected >= 0 && this._tray.select(snapshot.traySelected) === 'selected') {
      this._powerups.noteSelected(snapshot.traySelected);
    }
    this._powerups.restoreUses(snapshot.powerupUses);

    // 供料：**先 interval 再 acc**（`interval` setter 会把累加器清零）。
    this._spawner.interval = snapshot.spawnInterval;
    this._spawner.acc = snapshot.spawnAcc;
    this._spawner.fullReported = snapshot.spawnFullReported;

    this._reviveCount = snapshot.reviveCount;
    this._reviveBonusSec = snapshot.reviveBonusSec;
    this._isNewBest = false;
    return true;
  }

  private _buildStateMachine(): StateMachine<BeadsGame, BeadsPhase> {
    const machine = new StateMachine<BeadsGame, BeadsPhase>(this, 'boot', {
      transitions: PHASE_TRANSITIONS,
    });

    machine
      .addState('boot', {})
      .addState('playing', {
        onEnter: (game, from) => {
          // §1「面板出」= 从四个面板态回到 PLAYING 的那一帧（出场动效首帧）：
          // 恢复 / 下一关 / 重试 / 续时 / 重玩 / 去冲刺 都经本入口（A05-18）。
          if (isPanelPhase(from)) game._sfx(AUDIO_CLIP_PANEL_OUT);
          if (from === 'paused') {
            game._pauseIntent = null;
            game._panel.close();
            game._emit('game:resumed', {});
          }
          // 离开结算面板两出口（下一关 / 去冲刺）都经本状态 ⇒ 在此收起面板，
          // 淡出由 `update()` 的 `_clearPanel.update()` 跑完（与 S9 面板同判例）。
          if (from === 'level-clear') game._clearPanel.close();
        },
        onUpdate: (game, dt) => {
          game._stepPlaying(dt);
        },
      })
      .addState('paused', {
        onEnter: (game) => {
          game._panel.open();
          game._sfx(AUDIO_CLIP_PANEL_IN);
          game._emit('game:paused', {});
        },
      })
      .addState('level-clear', {
        onEnter: (game) => {
          const level = game._levels[game._levelIndex]!;
          const levelId = levelIdOf(level);
          const remaining = game._timer.remaining;
          const { ratio, stars } = computeClearStars(
            remaining,
            game._timer.total,
            game._reviveBonusSec,
            game._reviveCount > 0,
          );
          game._lastStars = stars;
          // 通关画面总览：取**历史最好**（重玩不降级，与 `maxUnlockedLevel` 同语义）。
          const li = game._levelIndex;
          game._starsByLevel[li] = Math.max(game._starsByLevel[li] ?? 0, stars);
          // C7 结算分（局内不显示，供排行/段位与面板外部读取）：四因子全在此刻可得。
          game._lastSettleScore = normalSettleScore(
            stars,
            ratio,
            game._powerups.usedCount,
            game._tray.expanded,
          );
          game._emit('level:cleared', { levelId, remaining, ratio, stars });
          game._persistProgress();
          game._crash?.clear(); // D-03（提案 §3）：过关即删，避免残局覆盖下次启动
          // 结算面板开：`ux-spec §4` 要求 LEVEL_CLEAR **等按钮**（下一关 / 去冲刺）。
          game._clearStarsAnnounced = 0;
          game._clearPanel.open();
          game._sfx(AUDIO_CLIP_PANEL_IN);
        },
        onUpdate: (game, dt) => {
          game._stepLevelClear(dt);
        },
      })
      .addState('game-over', {
        onEnter: (game) => {
          const levelId = game._mode === 'sprint' ? 'sprint' : levelIdOf(game._levels[game._levelIndex]!);
          game._emit('level:failed', { levelId });
          if (game._mode === 'sprint') {
            game._recordSprintEnd(); // 先结算（NEW BEST 与写盘），再开面板（§8-11 的显示依据）
            game._sprintSettle.open();
          }
          game._crash?.clear(); // D-03（提案 §3）：失败即删
          game._sfx(AUDIO_CLIP_PANEL_IN);
        },
      })
      .addState('finish', {
        onEnter: (game) => {
          game._finishRowsAnnounced = 0;
          game._finishPanel.open();
          game._sfx(AUDIO_CLIP_PANEL_IN);
        },
        onUpdate: (game, dt) => {
          game._stepFinish(dt);
        },
      });

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

    // GAP-03 首屏引导（ux-spec §6.3）：本次 BOOT 前 `runs==0` 才为首玩。
    // ——必须在下方自增**之前**取（否则首玩也变 1）；老玩家（runs>0）_onboardDone 永 true。
    this._onboardDone = save ? save.data.runs > 0 : true;

    if (save) {
      save.patch({ runs: save.data.runs + 1 });
      save.save();
    }

    // D-03（提案 §4）：校验通过的崩溃档优先——装配局内态并**停在 PAUSED**。
    // 校验失败/缺失 → `read()` 已清掉坏档，走常规新局 PLAYING。
    if (this._restoreCrashSnapshot()) return;

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

    const ad = services.rewardedAd;
    this._unsubs.push(
      ad.onRewarded(() => this._onReviveRewarded()),
      ad.onClose((event) => {
        // A05-20：未看完（`reason !== 'completed'`）⇒ 温和否定音，受**同一** 0.5s
        // 限流（连点主钮不产生 >2 次/秒）。已发奖路径上 `_watchingAd` 已先被
        // `onRewarded` 清掉 ⇒ 不会与 `sfx_revive_ok` 同时发。
        if (this._watchingAd && event?.reason !== 'completed') this._sfx(AUDIO_CLIP_REJECT);
        this._watchingAd = false;
      }),
      ad.onError(() => {
        this._watchingAd = false;
      }),
    );

    // ── 音频派发（WXG-T-096 / BD-05）：clip 选择**只**按 `audio-events §1` 的触发源
    // 事件，时长与限流不在这里发明（真源 = §1 表 + §3.2 分档 + §3.12 冻结值）。
    this._unsubs.push(
      bus.on('bead:placed', () => this._sfx(AUDIO_CLIP_PLACE)),
      bus.on('tray:selected', () => this._sfx(AUDIO_CLIP_SELECT)),
      bus.on('bead:rejected', () => this._sfx(AUDIO_CLIP_REJECT)),
      // A05-07：道具生效帧两条并存（id 不同 ⇒ 不被同帧去重吞掉）；
      //         `affectedSlots` 为空 ⇒ **零发声**（powerups §4 零噪声原则）。
      bus.on('powerup:used', (payload) => {
        const slots = (payload as { affectedSlots?: readonly number[] }).affectedSlots;
        if (!slots || slots.length === 0) return;
        this._sfx(AUDIO_CLIP_POWERUP);
        this._sfx(AUDIO_CLIP_DISSOLVE);
      }),
      // A05-08：三档分流不串音；`tier=0`（未升档）零发声。
      bus.on('combo:up', (payload) => {
        const tier = (payload as { tier: number }).tier;
        if (tier === 3) this._sfx(AUDIO_CLIP_COMBO_T3);
        else if (tier === 2) this._sfx(AUDIO_CLIP_COMBO_T2);
        else if (tier === 1) this._sfx(AUDIO_CLIP_COMBO_T1);
      }),
      // A05-10：两种 `reason` 同一 clip（§5 只一行）；`wrong` 时与 `sfx_reject` 同帧
      //         并存不互斥（双通道红线优先，Q-A05-3 采推荐项）。
      bus.on('combo:break', () => this._sfx(AUDIO_CLIP_COMBO_BREAK)),
      // A05-D7：首拍由 `timer:urgent` **边沿**驱动，后续每拍由 `timer:tick` 驱动；
      //         同帧两条都到 ⇒ scheduler 入队去重 + 0.9s 限流 ⇒ 仍恰一拍。
      bus.on('timer:urgent', () => this._sfx(AUDIO_CLIP_URGENT_BEAT)),
      bus.on('timer:tick', (payload) => {
        const remaining = (payload as { remaining: number }).remaining;
        if (remaining <= TIMER_URGENT_T) this._sfx(AUDIO_CLIP_URGENT_BEAT);
      }),
      // A05-14：每次 `tray:full` 恰 1 次（**不循环**；500ms 呼吸属视觉，互不驱动）。
      bus.on('tray:full', () => this._sfx(AUDIO_CLIP_TRAY_FULL)),
      bus.on('sprint:stage', () => this._sfx(AUDIO_CLIP_STAGE)),
      bus.on('level:cleared', () => this._sfx(AUDIO_CLIP_CLEAR)),
    );
  }

  /** Load a normal level: fresh grid/tray/rhythm/timer (S5 §2.4 reset list). */
  /**
   * S6 复位（§3.5 整关重置第 5 项 + §2.5）：三计数回 `POWERUP_FREE_USES`、镜像
   * 随托盘一并清空、容量回基线，并丢掉超限占位提示。
   */
  private _resetPowerups(): void {
    this._powerups.reset();
    this._powerupHint = '';
  }

  private _setupLevel(index: number): void {
    const level = this._levels[index];
    if (!level) throw new Error(`Beads: no level at index ${index}`);
    this._grid = new BeadGrid(level.pattern);
    this._layout = gridLayoutFor(this._grid.cols, this._grid.rows);
    this._boardSelected = null; // 换关 ⇒ 旧 board 锚指向的格已不存在
    this._tray.reset();
    this._resetPowerups();
    this._tray.initNeeded(this._grid.neededColorCounts());
    this._spawner.reset();
    this._spawner.interval = level.spawnInterval ?? 4.0;
    this._spawner.setDecoys(decoyColorIndices(level));
    this._timer.reset(level.time);
    this._sprint.reset();
    this._stageIndex = 0;
    this._isNewBest = false;
    this._clearReviveBookkeeping();
  }

  /** Fresh sprint run: stage 0 + full countdown. */
  private _setupSprintRun(): void {
    this._sprint.reset();
    this._sprintCap = this.tuning.sprintTime;
    this._isNewBest = false;
    this._loadStage(0);
    this._timer.reset(this._sprintCap);
    this._clearReviveBookkeeping();
    this._emit('sprint:stage', { stageIndex: 0, nextParams: stageParamsFor(0) });
  }

  /** Load sprint stage `n`: pool pattern + C6 params (streak untouched, C8). */
  private _loadStage(n: number): void {
    const { pattern } = buildStagePattern(n);
    this._grid = new BeadGrid(pattern);
    this._layout = gridLayoutFor(this._grid.cols, this._grid.rows);
    this._boardSelected = null; // 换 stage ⇒ 旧 board 锚指向的格已不存在
    this._tray.reset();
    this._resetPowerups(); // 冲刺换 stage = 换关语义，三计数一并复位（§2.5）
    this._tray.initNeeded(this._grid.neededColorCounts());
    this._spawner.reset();
    this._spawner.interval = stageParamsFor(n).interval;
    this._spawner.setDecoys([]);
    this._stageIndex = n;
  }

  /** One PLAYING frame: combo window → feed → countdown (input is read in `update()`). */
  private _stepPlaying(dt: number): void {
    // 输入段已在 `update()` 头部落下（相位无关，WXG-T-100 / BD-34）。此守卫保留
    // 原语义——「读输入后若已离开 PLAYING（放置/阶段完成可在输入段内切相位：
    // cleared-priority / C8 stage-first）⇒ 本帧不再跑供料 / 连击窗 / 倒计时」。
    // 上提后该语义由**调用点**结构性地保证：`_readInput()` 若切走相位，
    // `machine.update()` 会直接派发新相位的 `onUpdate` ⇒ 本函数根本不会被调用。
    // 保留显式守卫作为该语义的锚点，并防未来新增调用点（如直接从别处驱动）时静默破约。
    if (this._machine.current !== 'playing') return;

    // Combo window (sprint only): placement already reset the window this
    // frame, so a same-frame placement never times out (score-combo §6).
    if (this._mode === 'sprint') {
      const broke = this._sprint.windowTick(dt);
      if (broke) this._emit('combo:break', { reason: broke });
    }

    const spawn = this._spawner.tick(dt, this._tray, this._rng!);
    if (spawn.spawned) {
      this._emit('tray:spawned', spawn.spawned);
      this._powerups.noteSpawned(spawn.spawned.slot); // S6 镜像（§2.4）
    }
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
        this._requestPause('manual');
      }
      return;
    }
    switch (this._machine.current) {
      case 'playing': {
        // 2. 道具卡（input-control §2.1 优先级 2）。卡片自身即热区
        //    （`POWERUP_CARD_H` ≥ TOUCH_MIN，§3.8）——超限 / 空作用也在本分支
        //    内消化：零事件、不落到托盘与网格（§2.6 + 零噪声原则）。
        const card = this._hitPowerupCard(x, y);
        if (card) {
          this._consumedTap = true;
          this._sfx(AUDIO_CLIP_UI_TAP);
          this.usePowerup(card);
          return;
        }
        // 3. `btn_expand`（`input-control §2.1` 优先级 3）——**布局 A**（powerups §2.6）：
        //    本轮无解锁路径 ⇒ 只给同道具超限的占位轻提示，**零事件、零槽变化、
        //    零扣次、不调 wx 广告 API**（不 `expandTray()`、不发 `tray:expanded`）。
        if (this._hitExpandButton(x, y)) {
          this._consumedTap = true;
          if (!this._tray.expanded) {
            this._showTapHint(AD_PLACEHOLDER_HINT_TEXT, -1, -1, 'expand');
          }
          return;
        }
        // 4. Tray band (62² hit area, nearest slot centre wins) — v2.0 内部分支
        //    4a holding / 4b 空槽，见 `_routeTraySlot`（带级次序不变）。
        const slot = this._hitTraySlot(x, y);
        if (slot >= 0) {
          this._routeTraySlot(slot);
          return;
        }
        // 5. Grid cell (66² hit area, nearest cell centre wins) — v2.0 内部分支
        //    5a 错位珠 / 5b 空格 / 5c locked・就位，见 `_routeGridCell`。
        const cell = this._hitGridCell(x, y);
        if (cell) {
          this._routeGridCell(cell.row, cell.col);
        }
        return;
      }
      case 'game-over':
        if (this._mode === 'sprint') {
          // `ux-spec §3.5` 左列冲刺结算：只认两个按钮（再来一局 / 返回关卡）——
          // 面板外点击零响应。此前任意点击都直接重开本局 ✗（与 FINISH 的旧毛病同型）。
          const settle: SprintSettleAction | null = this._sprintSettle.hitTest(x, y);
          if (settle) {
            this._consumedTap = true;
            this._sfx(AUDIO_CLIP_UI_TAP);
            if (settle === 'back') this.startNormal();
            else this.retryLevel();
          }
          return;
        }
        {
          const reviveAvailable = this._reviveCount < REVIVE_MAX_PER_LEVEL;
          const action = hitFailPanel(x, y, reviveAvailable);
          if (action === 'revive') {
            this._consumedTap = true;
            this._sfx(AUDIO_CLIP_UI_TAP);
            this.requestRevive();
          } else if (action === 'retry') {
            this._consumedTap = true;
            this._sfx(AUDIO_CLIP_UI_TAP);
            this.retryLevel();
          }
        }
        return;
      case 'level-clear': {
        // S7 结算面板：只认自己的两个按钮（面板外点击无命中 ⇒ 不推进）。
        const action: ClearPanelAction | null = this._clearPanel.hitTest(x, y, this._clearPanelOptions());
        if (action) {
          this._consumedTap = true;
          this._sfx(AUDIO_CLIP_UI_TAP);
          if (action === 'next') this._advanceAfterClear();
          else this._startSprintRun();
        }
        return;
      }
      case 'finish': {
        // `ux-spec §4` 矩阵行 `FINISH | 去冲刺* / 重玩第 1 关`；`input-control §2.3`
        // 「FINISH：**仅**面板按钮」⇒ 面板外点击零响应（不推进、不误触）。
        const action: FinishPanelAction | null = this._finishPanel.hitTest(
          x,
          y,
          this._levels.length,
        );
        if (action) {
          this._consumedTap = true;
          this._sfx(AUDIO_CLIP_UI_TAP);
          if (action === 'replay') this.restartRun();
          else this._startSprintRun();
        }
        return;
      }
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

  /**
   * 路由 4 · 托盘带内部分支（input-control §2.1 v2.0，Epic T-133 E2；带级次序不变）：
   *  - **4a holding 槽** → 选中/换选（发 `tray:selected`，锚置 tray）。
   *    **例外（§8-11 满槽禁取珠）**：锚 = board 且托盘无空槽时，点任意托盘槽 =
   *    满槽取回拒绝 ⇒ 零事件零状态写、board 锚保持（§2.4 满槽取回条）。
   *  - **4b 空槽 且 锚 = board** → 取回（`retrieveBead`，E1 API；成功即清 board
   *    锚——珠已离格，锚不得指向空格）。
   *  - **4b 空槽 且 锚 ∈ {tray, none}** → 零事件忽略。GDD 4b 对此写「无效落点
   *    轻提示」，但轻提示通道 `_showTapHint` 只有 cell / expand 两种锚点几何，
   *    托盘锚点属 E6 视觉面（本单禁改 view）⇒ 按任务口径先零事件忽略，已回传登记。
   */
  private _routeTraySlot(slot: number): void {
    const traySlot = this._tray.slot(slot)!;
    if (traySlot.state !== 'free') {
      // 4a holding —— 先过 §8-11 满槽禁取珠门（托盘满 ⇒ 所有槽皆 holding）。
      if (this._boardSelected !== null && this._tray.freeCount === 0) return;
      this.selectTraySlot(slot);
      return;
    }
    const anchor = this._boardSelected;
    if (!anchor) return; // 4b 无 board 锚：零事件忽略（见方法头注）
    if (this.retrieveBead(anchor.row, anchor.col, slot)) {
      this._boardSelected = null; // 取回成功 ⇒ 珠离格，board 锚随之失效
    }
  }

  /**
   * 路由 5 · 网格带内部分支（input-control §2.1 v2.0；带级次序不变）：
   *  - **5a `filled(错位)`** → `selectBoardBead`（锚置 board，发 `board:selected`）。
   *    错位判定**只用 grid 派生谓词** `isMisplaced`，不在路由层复制逻辑。
   *  - **5b `empty`** → 锚 = tray ⇒ `_placeSelected`（S3 裁决 placed/rejected）；
   *    锚 ∈ {board, none} ⇒ 归位前置缺口轻提示（零事件，仅可落空格——§8-7），
   *    分支体见 `_routeGridEmpty`（`_placeSelected` 的 slot<0 分支已迁来）。
   *  - **5c locked / `filled(就位)`** → 极轻非惩罚反馈忽略（§2.4 裁定 4）。G7
   *    极轻反馈通道（scale 1.00→0.96→1.00 + `sfx_denied`）尚无现成实现（全仓
   *    无 press/denied 状态，WXG-T-128 属 E6/音频落码批次）⇒ 按任务口径
   *    **零事件零状态写**，通道落码后在 5c 出口接入。
   */
  private _routeGridCell(row: number, col: number): void {
    if (this._grid.isMisplaced(row, col)) {
      this.selectBoardBead(row, col); // 5a
      return;
    }
    if (this._grid.isFillable(row, col)) {
      this._routeGridEmpty(row, col); // 5b
      return;
    }
    // 5c：locked / void / filled(就位) —— 零事件零状态写（见方法头注）
  }

  /**
   * 5b 空格分支体，真链（`_routeGridCell`）与旁路（`tapGridCell`）共用：
   * 锚 = tray → 归位请求；否则归位前置缺口轻提示（BD-16，`TAP_HINT_NO_SELECTION_TEXT`，
   * 仅 fillable 格给——锁定/就位格走 5c 的零事件口径，两判据交界 = §8-7；真链 5b
   * 只在 empty 格到达本方法，fillable 复核是给旁路保住旧判据）。
   * 自 `_placeSelected` 的 `slot<0` 分支**迁来**（v2.0：「无选中」语义由锚表达，
   * S3 收到的归位请求必带 tray 锚；此处是迁移落点而非新增行为）。
   * @returns true only when the placement was accepted.
   */
  private _routeGridEmpty(row: number, col: number): boolean {
    if (this._tray.selectedSlot >= 0) return this._placeSelected(row, col);
    if (this._grid.isFillable(row, col)) {
      this._showTapHint(TAP_HINT_NO_SELECTION_TEXT, row, col);
    }
    return false;
  }

  /**
   * Enter PAUSED from PLAYING with a recorded intent. Idempotent while
   * already paused (no re-enter, no second notification).
   */
  private _requestPause(intent: 'manual' | 'system'): void {
    if (this._machine.current !== 'playing') return;
    this._pauseIntent = intent;
    this._machine.transition('paused');
  }

  /** Gear hot zone: TOUCH_MIN square at the left edge of HUD_BAND. */
  private _hitGear(x: number, y: number): boolean {
    return x >= 0 && x <= GEAR_HIT_SIZE && y >= HUD_BAND.yMin && y <= HUD_BAND.yMax;
  }

  /**
   * Powerup card hot zone — the *drawn* rect, from the shared
   * `powerupCardRects()` (§3.8: card height ≥ TOUCH_MIN, so no extra expansion;
   * a card tap is never ambiguous with the tray/grid bands).
   */
  private _hitPowerupCard(x: number, y: number): PowerupType | null {
    const rects = powerupCardRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]!;
      if (x >= r.x && x <= r.x + r.w && y >= r.bottom && y <= r.bottom + r.h) {
        return POWERUP_TYPES[i] ?? null;
      }
    }
    return null;
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
      case 'toggle-reduce-motion':
        // D1: write the setting only (leave PAUSED) — the view re-reads it off
        // the snapshot, so the change is visible the moment we resume (WXG-T-088).
        this._setReduceMotion(!this._reduceMotion);
        return;
      case 'toggle-large-text':
        this._setLargeText(!this._largeText);
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

  /** 面板几何/文案选项（末关把主钮文案切成「查看结果」）。 */
  private _clearPanelOptions(): ClearPanelOptions {
    return { lastLevel: this._levelIndex >= this._levels.length - 1 };
  }

  /**
   * 结算面板每帧：只在**星级入场**时各触发一次音效（ux-spec §5「每星叮上行」）。
   * 面板自身的入/出动画在 `update()` 里跑（表示层不停表，与 S9 面板同判例）。
   */
  private _stepLevelClear(_dt: number): void {
    const shown = this._clearPanel.starsShown(this._lastStars);
    while (this._clearStarsAnnounced < shown) {
      this._clearStarsAnnounced++;
      this._sfx(AUDIO_CLIP_STAR);
    }
  }

  /**
   * 通关画面每帧：只在**逐关入场**时各触发一次音效（与结算面板「每星叮上行」同判例）。
   * 面板自身的入 / 出动画在 `update()` 里跑（表示层不停表）。
   */
  private _stepFinish(_dt: number): void {
    const shown = this._finishPanel.rowsShown(this._levels.length);
    while (this._finishRowsAnnounced < shown) {
      this._finishRowsAnnounced++;
      this._sfx(AUDIO_CLIP_STAR);
    }
  }

  /**
   * 结算面板「下一关 / 查看结果」：末关 → FINISH，否则推进到下一关。
   * `ux-spec §4` 流转表 = `LEVEL_CLEAR → 下一关 / 去冲刺*(U1) → 玩法·n+1 / 玩法·冲刺`
   * ——面板**等按钮**，此前的「1.4s 自动推进」占位已随本面板删除。
   */
  private _advanceAfterClear(): void {
    if (this._machine.current !== 'level-clear') return;
    if (this._levelIndex >= this._levels.length - 1) {
      // 交接给通关画面：结算面板必须退场，否则它 150ms 的淡出会从通关画面后面透出来
      // （两个面板都画全屏遮罩，叠着会看到两层）。
      this._clearPanel.close();
      this._machine.transition('finish');
      return;
    }
    this._levelIndex++;
    this._setupLevel(this._levelIndex);
    this._machine.transition('playing');
  }

  /** 结算面板「▶ 去冲刺」（U1 三处入口之第二处）：直接开一局新冲刺。 */
  private _startSprintRun(): void {
    this._mode = 'sprint';
    this._clearPanel.close();
    this._finishPanel.close(); // 两个面板都可能发起冲刺（结算页 / 通关画面，U1 三处之其二）
    this._crash?.clear();
    this._setupSprintRun();
    this._machine.reset('playing');
  }

  /**
   * 「重玩本关」/「重新冲刺」= 整关重置五项 (§3.5: 倒计时回满 / 图案清空但
   * locked 不动 / 托盘清空 / 扩展重置 / 道具免费次数回 POWERUP_FREE_USES).
   * Sprint also drops the combo state (P1 frozen 2026-09-12).
   */
  private _resetLevelForArtifact(): void {
    this._crash?.clear(); // D-03：重玩本关 / 重新冲刺 ⇒ 旧快照失效
    if (this._mode === 'sprint') {
      this._setupSprintRun();
    } else {
      this._setupLevel(this._levelIndex);
    }
    this._machine.transition('playing');
  }

  private _clearReviveBookkeeping(): void {
    this._reviveCount = 0;
    this._reviveBonusSec = 0;
    this._watchingAd = false;
    this._failHint = '';
  }

  private _onReviveRewarded(): void {
    this._watchingAd = false;
    this._continueFromReward();
  }

  /**
   * Same-run continue: add bonus seconds, keep grid/tray/spawner, enter PLAYING.
   * No-op unless we are still on the ordinary GAME_OVER overlay.
   */
  private _continueFromReward(): void {
    if (this._machine.current !== 'game-over') return;
    if (this._mode !== 'normal') return;
    if (this._reviveCount >= REVIVE_MAX_PER_LEVEL) return;
    const cap = Math.max(this._timer.total, REVIVE_BONUS_SEC);
    this._timer.addTime(REVIVE_BONUS_SEC, cap);
    this._reviveBonusSec += REVIVE_BONUS_SEC;
    this._reviveCount += 1;
    this._failHint = '';
    // A05-19：只在**真加时**的那一帧发奖励音（零加时 ⇒ 零 `sfx_revive_ok`）。
    this._sfx(AUDIO_CLIP_REVIVE_OK);
    this._machine.transition('playing');
  }

  /**
   * The S2 → S3 route: place the selected bead, then handle every outcome.
   * v2.0 E2：归位前置「锚 = tray」由调用方（`_routeGridEmpty`）保证；本方法收窄为
   * 纯裁决应用——原 `slot<0` 轻提示分支已迁到路由层（`_routeGridEmpty` 方法头注），
   * 这里只保留旁路防御（无选中零事件拒绝，不再提示）。
   */
  private _placeSelected(row: number, col: number): boolean {
    const slot = this._tray.selectedSlot;
    if (slot < 0) return false; // 防御：无锚不该到达（路由层已拦截并提示）
    const colorIdx = this._tray.selectedColor;
    const verdict = judgePlacement(this._grid, row, col, colorIdx, slot);

    switch (verdict.outcome) {
      case 'placed': {
        this._tray.takeBead(slot);
        this._powerups.notePlaced(slot); // S6 镜像：该槽 free + 选中锚点失效（§2.4）
        this._emit('bead:placed', {
          row: verdict.row,
          col: verdict.col,
          colorIdx: verdict.colorIdx,
          slot: verdict.slot,
        });
        this._onboardDone = true; // GAP-03：首次落子即清引导（事件驱动，无计时器，§6.1）

        if (this._mode === 'sprint') {
          const score = this._sprint.onPlaced();
          if (score.tierUp !== null) {
            // §2.5 特效三档随倍率档触发；派生项：重叠时只播**最高档**。
            const spec = comboVfxSpec(score.tierUp);
            if (spec && (!this._comboVfx || spec.tier >= this._comboVfx.spec.tier)) {
              this._comboVfx = { spec, elapsedMs: 0, row: verdict.row, col: verdict.col };
            }
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
        // GAP-04 `wrong` 态：仅颜色不匹配（mismatch）触发拖动+danger 描边；
        // `invalid-color`（越界编程错）只 console.warn，不给玩家反馈。
        if (verdict.reason === 'mismatch') {
          this._armWrongFx(verdict.row, verdict.col);
        }
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
      settings: {
        bgmMuted: this._bgmMuted,
        sfxMuted: this._sfxMuted,
        reduceMotion: this._reduceMotion,
        largeText: this._largeText,
      },
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

  /** D1 减弱动效开关：写档 + 经 snapshot 回显给 view（不切相位）。 */
  private _setReduceMotion(on: boolean): void {
    this._reduceMotion = on;
    this._persistSettings();
  }

  /** E2 大字号开关：写档 + 经 snapshot 回显给 view（不切相位）。 */
  private _setLargeText(on: boolean): void {
    this._largeText = on;
    this._persistSettings();
  }

  /**
   * Apply both channels to the audio layer.
   *
   * Deviation note (reported to the lead): architecture-beads §2 proposes two
   * `AudioScheduler` instances sharing one `AudioBackend`, but a game only ever
   * receives `GameServices.audio` — the `Platform` (which owns
   * `createAudioBackend()`, `platform/platform.ts`) is created inside `App`
   * (`compose/app.ts`) and is not reachable from `GameServices`
   * (`core/game/game.ts`). ADR-0013 (WXG-T-096) widened that factory to
   * `createAudioBackend({ voices })` — the recipe table now flows game → App →
   * Platform — but it deliberately did **not** hand the backend itself to the
   * game, so the two-scheduler shape still needs a further framework decision.
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

  /**
   * Sfx request gate (never touched by the music toggle, §8-4).
   *
   * `minInterval` 按 clip 分档（§3.2）——**不得**回到统一 0.05（那会把 reject 推成
   * 20 次/秒，违反 §3.8 红线，判据 A05-05/06）。
   */
  private _sfx(clipId: string): void {
    if (this._sfxMuted) return;
    this._services?.audio.play(clipId, { minInterval: SFX_MIN_INTERVAL[clipId] ?? 0 });
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
      // S8 §2.2 `stars` / §8-2：每关历史最高星（max 在过关记分处取，这里只负责落档）。
      starsByLevel: [...this._starsByLevel],
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
    // 与 `view-model.drawTray` 共用 `trayLayout()`（§3.4 单一真源，WXG-T-062 判例）。
    const lay = trayLayout(rows, this.tuning.width);
    for (let idx = 0; idx < this._tray.capacity; idx++) {
      const row = Math.floor(idx / TRAY_COLS);
      const col = idx % TRAY_COLS;
      const dx = x - lay.slotCenterX(col);
      const dy = y - lay.slotCenterY(row);
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = idx;
      }
    }
    return best;
  }

  /**
   * `btn_expand` 命中框 = **132×88** 热区（§3.4 v1.20 ← `accessibility C1`：视觉
   * 132×48，热区扩大）。几何与渲染同源 `expandButtonLayout()`；该热区与
   * 托盘槽热区实测净空 11px ⇒ 不需要热区重叠仲裁（`input-control §8-2`）。
   */
  private _hitExpandButton(x: number, y: number): boolean {
    const btn = expandButtonLayout();
    return (
      x >= btn.hitX &&
      x <= btn.hitX + btn.hitW &&
      y >= btn.hitBottom &&
      y <= btn.hitBottom + btn.hitH
    );
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

  // ─────────────────────────────────────────────────────────────── snapshot

  private _lastStars = 0;

  /** Last normal-mode clear's stars (view convenience). */
  get lastStars(): number {
    return this._lastStars;
  }

  /** 本关 C7 结算分（局内不显示；排行/段位与测试读它，§8-2）。 */
  get lastSettleScore(): number {
    return this._lastSettleScore;
  }

  /** S7 结算面板逻辑（暴露给测试；只读用法，写路径走两个按钮动作）。 */
  get clearPanel(): ClearPanel {
    return this._clearPanel;
  }

  /** S7 通关画面逻辑（暴露给测试；只读用法，写路径走两个按钮动作）。 */
  get finishPanel(): FinishPanel {
    return this._finishPanel;
  }

  /** S7 冲刺结算面板逻辑（暴露给测试；只读用法，写路径走两个按钮动作）。 */
  get sprintSettle(): SprintSettlePanel {
    return this._sprintSettle;
  }

  /** S7 连击特效状态（暴露给测试；只读）。`null` = 当前无特效。 */
  get comboVfx(): { kind: ComboVfxKind; tier: number; elapsedMs: number } | null {
    const vfx = this._comboVfx;
    return vfx ? { kind: vfx.spec.kind, tier: vfx.spec.tier, elapsedMs: vfx.elapsedMs } : null;
  }

  /**
   * 连击特效推进：**表现层**，与面板动画同判例 —— PAUSED 冻结的是玩法（计时/供料/连击窗），
   * 不是表现。播完即清；三档都是单次循环 ⇒ 本方法不自重复（`§3.8` 红线的来源不在这里）。
   */
  private _stepComboVfx(dt: number): void {
    const vfx = this._comboVfx;
    if (!vfx) return;
    vfx.elapsedMs += Math.max(0, dt) * 1000;
    if (vfx.elapsedMs >= vfx.spec.durationMs) this._comboVfx = null;
  }

  /**
   * GAP-04 `wrong` 态起播（WXG-T-102 / BD-29）。连续拒绝受 **500ms 重启门**约束
   * （`ux-spec §5:180`）：自上次起播（`_wrongFxArmedAtMs`）起算未满
   * `WRONG_FX_RESTART_GATE_MS` 的新 mismatch **不重启**——
   *   · 门内且当前 fx 仍在播 ⇒ 沿用其相位（不重置 elapsedMs）；
   *   · 门内但 fx 已自然结束（>200ms）⇒ 本次**不给任何视觉反馈**。
   * ⇒ 反馈有效频次 ≤2 次/秒，落 `systems-index §3.8`「错误反馈 抖动+描边闪 ≤2 次/秒」
   * 冻结值（与音频侧 `AUDIO_REJECT_MIN_INTERVAL`=0.5s 同拍，双通道一致）。
   *
   * ⚠️ **门禁范围判断**（本单回传「500ms 门语义」）：§5:180 字面把门写成「**视觉脉冲**
   * 重启门」，仅直接提描边；但 §3.8 冻结值是「**抖动+描边闪** ≤2 次/秒」——「错误反馈」
   * 是**两通道一体的事件**。若只门禁描边、放抖动自由重启，则 100ms 连点可把抖动刷到
   * 10 次/秒，按字面即违 §3.8。故本实现按 **§3.8 从严**：门禁**整个 wrong-fx 事件**
   * （抖动与描边同进同退）。若裁定只门禁描边，去掉本方法的位移抑制即为一行放宽。
   *
   * 非每帧路径：仅在 mismatch 拒绝帧调用 ⇒ 无每帧分配顾虑（起播时才 new 一个 fx 对象，
   * 与旧实现同）。
   */
  private _armWrongFx(row: number, col: number): void {
    if (this._pulseClock - this._wrongFxArmedAtMs < WRONG_FX_RESTART_GATE_MS) return;
    this._wrongFx = { row, col, elapsedMs: 0 };
    this._wrongFxArmedAtMs = this._pulseClock;
  }

  /**
   * GAP-04 `wrong` 态推进（WXG-T-087）：与 `_stepComboVfx` 同判例——表现层，不被
   * PAUSED 冻结。单次播放 `WRONG_FX_MS`（200ms）；播完即清（重启门由 `_armWrongFx` 管）。
   */
  private _stepWrongFx(dt: number): void {
    const fx = this._wrongFx;
    if (!fx) return;
    fx.elapsedMs += Math.max(0, dt) * 1000;
    if (fx.elapsedMs >= WRONG_FX_MS) this._wrongFx = null;
  }

  /**
   * 发一次性轻提示（ux-spec §5 WXG-T-097）。**不**发任何玩法事件，也不走
   * `sfx_reject`——它是「前置缺口告知」而不是错误反馈（错误反馈频率上限属 §3.8，
   * 本通道不得被算进去）；`audio-events §1` 无对应 clip ⇒ **静默**。
   */
  private _showTapHint(
    text: string,
    row: number,
    col: number,
    anchor: 'cell' | 'expand' = 'cell',
  ): void {
    this._tapHint = { text, row, col, anchor, elapsedMs: 0 };
  }

  /** 轻提示推进：与 `_stepWrongFx` 同判例（表现层，不被 PAUSED 冻结），窗口 `TAP_HINT_MS`。 */
  private _stepTapHint(dt: number): void {
    const hint = this._tapHint;
    if (!hint) return;
    hint.elapsedMs += Math.max(0, dt) * 1000;
    if (hint.elapsedMs >= TAP_HINT_MS) this._tapHint = null;
  }

  /** 每关历史最好星级（`0` = 未通关）—— 通关画面总览的数据源（测试读它）。 */
  get starsByLevel(): readonly number[] {
    // 内部按需写入（稀疏）；对外一律**稠密**（未通关 = 0），与快照同一契约。
    const out: number[] = [];
    for (let i = 0; i < this._levels.length; i++) out.push(this._starsByLevel[i] ?? 0);
    return out;
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
        s.cells.push({ state: 'empty', colorIdx: 0, beadColorIdx: 0, void: false });
      }
    }
    for (let i = 0; i < cellsNeeded; i++) {
      const row = Math.floor(i / this._grid.cols);
      const col = i % this._grid.cols;
      const cell = this._grid.cell(row, col)!;
      const out = s.cells[i]!;
      out.state = cell.state;
      out.colorIdx = cell.colorIdx;
      out.beadColorIdx = cell.beadColorIdx;
      out.void = cell.void;
    }
    s.gridLeft = this._layout.left;
    s.gridTop = this._layout.top;

    // S6 cards: remaining free uses per powerup (0 ⇒ the view dims the card and
    // leans on the always-on ad_badge, §2.6) + the one-shot over-limit hint.
    s.powerupFreeUses.region = this._powerups.uses.region;
    s.powerupFreeUses.clearAll = this._powerups.uses.clearAll;
    s.powerupFreeUses.random = this._powerups.uses.random;
    s.powerupHint = this._powerupHint;

    // S7 结算·过关面板（ux-spec §3.4）：数据 + 动画进度一起进快照，视图只读。
    s.clearPanelVisible = this._clearPanel.visible;
    s.clearPanelProgress = this._clearPanel.progress;
    s.clearPanelInteractive = this._clearPanel.interactive;
    s.clearStars = this._lastStars;
    const shown = this._clearPanel.starsShown(this._lastStars);
    s.clearStarsShown = shown;
    s.clearStarPopScale = shown > 0 ? this._clearPanel.starScale(shown - 1) : 1;
    // BD-47（WXG-T-127）：结算面板「剩余 mm:ss」不吃浮点尾数 —— 快照层即取整，
    // 口径与上方 s.remaining 一致（ceil − 1e-9，倒计时显示不提前归零）；
    // formatTime 的 floor 只是视图兜底，两层都补（T-118 前发现、本单补登）。
    s.clearRemaining = Math.max(0, Math.ceil(this._timer.remaining - 1e-9));
    s.clearPowerupsUsed = this._powerups.usedCount;
    s.clearLastLevel = this._levelIndex >= this._levels.length - 1;

    // S7 通关画面（ux-spec §3.6）：总览数据 + 逐关入场进度一起进快照，视图只读。
    s.finishPanelVisible = this._finishPanel.visible;
    s.finishPanelProgress = this._finishPanel.progress;
    s.finishPanelInteractive = this._finishPanel.interactive;
    if (s.finishStars.length !== this._levels.length) {
      s.finishStars = new Array<number>(this._levels.length).fill(0);
    }
    for (let i = 0; i < s.finishStars.length; i++) {
      s.finishStars[i] = this._starsByLevel[i] ?? 0;
    }
    const finishRows = this._finishPanel.rowsShown(this._levels.length);
    s.finishRowsShown = finishRows;
    s.finishRowPopScale = finishRows > 0 ? this._finishPanel.rowPopScale(finishRows - 1) : 1;

    // S7 冲刺结算面板（ux-spec §3.5 左列）：内容行数据 + 入/出进度一起进快照。
    s.sprintSettleVisible = this._sprintSettle.visible;
    s.sprintSettleProgress = this._sprintSettle.progress;
    s.sprintSettleInteractive = this._sprintSettle.interactive;
    s.sprintRunBestStage = this._sprint.bestStage;
    s.sprintRunBestStreak = this._sprint.bestStreak;

    // S7 连击特效（§2.5）：形态 + 播放进度 + 锚点一起进快照，视图只读。
    s.comboVfxKind = this._comboVfx ? this._comboVfx.spec.kind : '';
    s.comboVfxProgress = this._comboVfx
      ? comboVfxProgress(this._comboVfx.elapsedMs, this._comboVfx.spec.durationMs)
      : 0;
    s.comboVfxRow = this._comboVfx ? this._comboVfx.row : -1;
    s.comboVfxCol = this._comboVfx ? this._comboVfx.col : -1;

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
    // v2.0 统一选择锚 · board 侧（E2）：E6 据此画错位珠高亮；-1 = 无。
    // 与 traySelected 三值互斥（input-control §2.1），至多一侧 ≥ 0。
    s.boardSelectedRow = this._boardSelected ? this._boardSelected.row : -1;
    s.boardSelectedCol = this._boardSelected ? this._boardSelected.col : -1;

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
    s.reduceMotion = this._reduceMotion;
    s.largeText = this._largeText;

    const copy = bannerFor(s.phase, this._levelIndex >= this._levels.length - 1);
    s.banner = copy.banner;
    s.subBanner = copy.sub;
    s.bootError = this._bootErrors.join('; ');
    s.reviveAvailable =
      s.phase === 'game-over' && this._mode === 'normal' && this._reviveCount < REVIVE_MAX_PER_LEVEL;
    s.revived = this._reviveCount > 0;
    s.watchingAd = this._watchingAd;
    s.failHint = this._failHint;

    // ── GAP-04/03/10 反馈态相位（WXG-T-087）：表现时钟 + wrong 进度 + 引导目标。
    //    相位基准（脉冲周期）由视图从 `pulseClock` 推导；此处只给单调时钟与单次进度。
    s.pulseClock = this._pulseClock;
    const wfx = this._wrongFx;
    s.wrongRow = wfx ? wfx.row : -1;
    s.wrongCol = wfx ? wfx.col : -1;
    s.wrongProgress = wfx ? Math.min(1, wfx.elapsedMs / WRONG_FX_MS) : 0;
    // BD-16/BD-15 轻提示：只给文本与锚点格（无进度曲线——§5 未定淡入淡出，见该行的 `[待确认]`）。
    const th = this._tapHint;
    s.tapHintText = th ? th.text : '';
    s.tapHintRow = th ? th.row : -1;
    s.tapHintCol = th ? th.col : -1;
    s.tapHintAnchor = th ? th.anchor : 'cell';

    // GAP-03 首屏引导：仅普通模式 PLAYING、首玩且本会话未落过子时激活（§6.3）。
    s.onboarding = this._mode === 'normal' && s.phase === 'playing' && !this._onboardDone;
    if (s.onboarding) {
      // 首珠 = 托盘当前持有的最前一颗（GAP-02 首供落点）；其色决定单一目标格。
      let guideSlot = -1;
      let firstColor = -1;
      for (let i = 0; i < s.traySlots.length; i++) {
        const sl = s.traySlots[i]!;
        if (sl.state !== 'free') {
          guideSlot = i;
          firstColor = sl.colorIdx;
          break;
        }
      }
      s.guideSlot = guideSlot;
      if (firstColor >= 0) {
        // 行主序首个匹配该色的可填空槽（单一指向 = 引导设计原则，避免多格同亮）。
        for (let i = 0; i < s.gridRows && s.hintRow < 0; i++) {
          for (let j = 0; j < s.gridCols; j++) {
            const c = s.cells[i * s.gridCols + j]!;
            if (!c.void && c.state === 'empty' && c.colorIdx === firstColor) {
              s.hintRow = i;
              s.hintCol = j;
              break;
            }
          }
        }
      }
    } else {
      s.hintRow = -1;
      s.hintCol = -1;
      s.guideSlot = -1;
    }
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
