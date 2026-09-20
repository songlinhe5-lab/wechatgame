/**
 * BeadsGame — the whole game, wired to the framework `Game` contract.
 *
 * Architecture in one paragraph: the class owns the *authoritative state*
 * (pattern grid, tray, countdown, sprint tracker, phase
 * machine). Systems (`placement` / `timer` / `sprint`) are pure
 * mechanics that return outcomes; this class applies them and broadcasts the
 * registered events. Subscriptions live in `_subscribe()`, unwound in
 * `dispose()`. `buildRenderModel` only copies state into the snapshot — the
 * view can never reach back, which makes "UI holds no game state" true by
 * construction.
 *
 * Freeze discipline (ADR-0007): the state machine is the single arbiter —
 * PAUSED simply stops calling timer/combo-window ticks. The
 * `game:paused` / `game:resumed` events are notifications only.
 *
 * ⛔ Feed (S4 spawner): dead since v2.0 (WXG-T-136, 定时供料关停·案 A) —
 * misplaced beads are the ONLY supply and the tray is a pure buffer
 * (tray-spawner v2.0). The `Spawner` instance survives as a documented dead
 * path (snapshot fields / reset list / zero-cost revival); the main loop no
 * longer ticks it, so `tray:spawned` / `tray:full` are never emitted.
 */

import {
  REWARDED_PLACEMENT,
  SaveManager,
  StateMachine,
  type AudioVoices,
  type Game,
  type GameServices,
  type RenderModelBuilder,
} from '../../framework/index';

import {
  AUDIO_CLIP_BGM,
  AUDIO_CLIP_CLEAR,
  AUDIO_CLIP_COMBO_BREAK,
  AUDIO_CLIP_COMBO_T1,
  AUDIO_CLIP_COMBO_T2,
  AUDIO_CLIP_COMBO_T3,
  AUDIO_CLIP_DENIED,
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
  STAMINA_REFILL_PLACEMENT,
  STAGE_BONUS_TIME,
  computeClearStars,
  normalSettleScore,
  TIMER_URGENT_T,
  TAP_HINT_MS,
  VIBRATE_DEFAULT,
  TAP_HINT_NO_SELECTION_TEXT,
  AD_PLACEHOLDER_HINT_TEXT,
  WRONG_FX_MS,
  WRONG_FX_RESTART_GATE_MS,
  FILL_POP_MS,
  FILL_POP_RESTART_GATE_MS,
  SOLVER_HINT_MS,
  SOLVER_MAX_CELLS,
  SOLVER_STAGGER_MS,
  solverSequenceMs,
  SWEEP_MS,
  CONFETTI_MS,
  WAVE_MS,
  CLEAR_PANEL_DELAY_MS,
  DENIED_MAX_CELLS,
  DENIED_PRESS_MS,
  DENIED_PRESS_RESTART_GATE_MS,
  TRAY_COLS,
  expandButtonLayout,
  trayLayout,
  TRAY_HIT_SIZE,
  POWERUP_TYPES,
  powerupCardRects,
  gridLayoutFor,
  hitGridCell,
  IDENTITY_CAMERA,
  BOARD_TAP_MOVE_THRESHOLD,
  PUZZLE_BAND,
  stageParamsFor,
  validatedSprintTime,
  type BeadsTuning,
  type BoardCamera,
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
import { applyMisplacedToGrid } from './misplaced-assembler';
import { collectMisplacedGroup } from '../entities/grid';
import { BeadGrid } from '../entities/grid';
import {
  CrashSnapshotStore,
  decodeFilledBits,
  encodeFilledBits,
  type CrashSnapshot,
} from './crash-snapshot';
import { Tray } from '../entities/tray';
import { PowerupSystem, type MisplacedBead } from '../systems/powerups';
import { FinishPanel, type FinishPanelAction } from '../systems/finish-panel';
import { SprintSettlePanel, type SprintSettleAction } from '../systems/sprint-settle';
import { comboVfxProgress, comboVfxSpec, type ComboVfxKind, type ComboVfxSpec } from '../view/combo-vfx';
import {
  ClearPanel,
  type ClearPanelAction,
  type ClearPanelOptions,
} from '../systems/clear-panel';
import { judgeRetrieve } from '../systems/retrieve';
import { judgePlacement, planGroupFill } from '../systems/placement';
import { Spawner } from '../systems/spawner';
import {
  applyPinch,
  applyPan,
  createGesture,
  resetGesture,
  fitCamera,
} from '../systems/board-camera';
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
  migrateV2ToV3,
  migrateV3ToV4,
  normalizeBeadsSave,
  preserveCorruptBackup,
  type BeadsSave,
} from './save-schema';
import { DEFAULT_PALETTE, type BeadsPalette } from '../view/palette';
import { buildBeadsView } from '../view/view-model';

/** Events emitted on the framework bus — systems-index §4 (v1.22 event table). */
export interface BeadsEvents extends Record<string, unknown> {
  'tray:spawned': { slot: number; colorIdx: number };
  /**
   * v1.27 payload 变更（WXG-T-158 用户裁定②）：同色全组选中——`slot` = 被点槽、
   * `count` = 组珠数（与 `board:selected.count` 对称）；整组取消零事件。
   */
  'tray:selected': { slot: number; colorIdx: number; count: number };
  /** v1.22 新增：错位珠选中（选择锚置 `board`，与 `tray:selected` 互斥对称）。 */
  'board:selected': { row: number; col: number; colorIdx: number; count: number };
  /** v1.22 新增：取回入槽（S3/S4 同帧原子，不计分不断连）。 */
  'tray:stored': { slot: number; colorIdx: number; fromRow: number; fromCol: number };
  /** v1.22 payload 变更：`slot` 改可选（托盘路径必带；解环器路径不带，E4）。 */
  'bead:placed': { row: number; col: number; colorIdx: number; slot?: number };
  'bead:rejected': { row: number; col: number; colorIdx: number };
  'tray:full': Record<string, never>;
  'tray:expanded': Record<string, never>;
  'powerup:used': { type: string; affectedCells: readonly { row: number; col: number }[] };
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
  /** §4 meta 事件（systems-index v1.28）：震动开关切换（局外不带 levelId）。 */
  'settings:vibrate': { on: boolean };
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
  /**
   * **测试专用**：跳过 BOOT 期错位装配（levels-spec v1.2 §2.1）。生产路径恒装配；
   * 单测用空盘夹具自由构造场景时置 true。场景需要错位珠时用 grid.setBead /
   * applyMisplacedToGrid 显式装配。
   */
  readonly noBootAssembly?: boolean;
  /**
   * 暂停面板「回主菜单」次钮回调（WXG-T-164 批0，pause-settings v1.3 §8-11）：
   * 玩法层不知道 shell/菜单存在，只上报意图；缺省（无 shell）时按钮无副作用。
   */
  readonly onMenuRequest?: () => void;
  /**
   * 新局开局体力闸门（WXG-T-164，systems-index §3.14）：普通局 retry/restart 前调用，
   * 返回 true=已扣心放行、false=0 心被拒（转而触发 {@link onStaminaRefill} 广告回满再重试）。
   * 缺省（无 shell 的独立 BeadsGame）→ 不设闸门，retry/restart 恒放行（保后向兼容，既有单测不变）。
   */
  readonly canStartRun?: () => boolean;
  /**
   * 体力回满激励位发奖回调（§3.11 第二 live 位 / §3.14）：0 心重试被拒后看完广告调用，
   * 由 shell 执行 `meta.refillStamina()`；缺省则不接广告回满（被拒即无副作用）。
   */
  readonly onStaminaRefill?: () => void;
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
  // G7 `sfx_denied`（裁定 3 ⑥ / Q-A05-5）：minInterval = 同格视觉门换算（/1000），
  // **不新造数值**（`assets-spec §1.6.7` 音频行）。
  [AUDIO_CLIP_DENIED]: DENIED_PRESS_RESTART_GATE_MS / 1000,
};

/** §1「面板入 / 出」的宿主相位：四个面板态均覆盖（A05-18）。 */
const PANEL_PHASES: readonly BeadsPhase[] = ['paused', 'level-clear', 'game-over', 'finish'];

function isPanelPhase(phase: BeadsPhase | null): boolean {
  return phase !== null && PANEL_PHASES.indexOf(phase) >= 0;
}

/**
 * G2′ `vfx_solver_restore` 队列槽（WXG-T-150 / `assets-spec §1.6.2a`）。
 *
 * 命名成单独类型（而非内联）是为了给相 B 的执行入口 `_solveMisplaced` 一个
 * **可空**形参：`null` = 手动路径（走 G1 单槽门），非空 = 解环器路径（进队列）。
 */
interface SolverFxQueue {
  /** 序列内已推进的毫秒。 */
  elapsedMs: number;
  /** `solverSequenceMs(count)` ⇒ 快照标量的分母（单一真源在 tuning）。 */
  totalMs: number;
  /** 点名颗数（= `cellRows` 有效长度）。 */
  count: number;
  /** 下一颗待执行的序号（`while` 追帧用）。 */
  step: number;
  /** 实际归位成功的颗数（序列末过关判定与零归位警告用）。 */
  solved: number;
  readonly cellRows: number[];
  readonly cellCols: number[];
  landCount: number;
  readonly landRows: number[];
  readonly landCols: number[];
  readonly landSteps: number[];
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
  /** 测试专用开关：见 {@link BeadsGameOptions.noBootAssembly}。 */
  private readonly _noBootAssembly: boolean;
  private readonly _machine: StateMachine<BeadsGame, BeadsPhase>;
  private readonly _snapshot: BeadsSnapshot;
  private readonly _tray = new Tray();
  /**
   * ⛔ 供料死路径（v2.0 定时供料关停，WXG-T-136）：主循环不再 tick 供料（错位珠是
   * 唯一供给，tray-spawner v2.0 §2.2）。实例保留仅为：① 重置/续时清单的字段保留
   * （timer-gameover v1.3 §2.4 第 2 项注记）；② 崩溃快照 `spawnAcc` / `spawnInterval`
   * / `spawnFullReported` 的往返一致性；③ 供料复活零成本重启。
   */
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
   * G1 `vfx_fill_pop` 落座回弹（WXG-T-128 / `assets-spec §1.6.1`）：与 `_wrongFx` **同判例**
   * 的表现层计时槽（私有、不入玩法状态；`FILL_POP_MS` 后自清；起播受
   * `FILL_POP_RESTART_GATE_MS` 重启门约束）。触发源 = `bead:placed` 事件（旧现状：
   * 该事件 view 侧**零消费者** = G1 列为 P0 的根因）。
   */
  private _placeFx: { row: number; col: number; elapsedMs: number } | null = null;
  /** 落座 fx 上次起播时刻（同 `_wrongFxArmedAtMs` 判例；`-Infinity` ⇒ 首帧即允许起播）。 */
  private _placeFxArmedAtMs = Number.NEGATIVE_INFINITY;
  /**
   * G7 `vfx_denied_press` 不可填格轻压（WXG-T-152 / `assets-spec §1.6.7`）：与 `_placeFx`
   * 同为**表现层**计时槽（不被 PAUSED 冻结、`_setupLevel` 不清），但门按「同格计」
   * ⇒ **多格并存**，定长槽数组（`DENIED_MAX_CELLS` = 工程容量，构造期一次性分配，
   * 逐帧只写值）。⚠️ 动画 120ms 播完后槽**不清 row/col** —— 同格门 250ms > 时长，
   * 需要死窗记忆；零残留口径由 `_syncSnapshot` 的「在播才导出」保证。
   */
  private readonly _deniedFx: {
    row: number;
    col: number;
    elapsedMs: number;
    armedAtMs: number;
  }[] = Array.from({ length: DENIED_MAX_CELLS }, () => ({
    row: -1,
    col: -1,
    elapsedMs: 0,
    armedAtMs: Number.NEGATIVE_INFINITY,
  }));
  /**
   * G2′ `vfx_solver_restore` 解环器归位队列（WXG-T-150 / `assets-spec §1.6.2a`）。
   *
   * ⚠️ **与 `_placeFx` / `_sweepElapsedMs` 不同类**：本槽的推进**会改棋盘**（相 B 到点才真
   * 正 `_solveMisplaced`）⇒ 它是玩法提交时序的一部分，必须走 `playing` 相位守卫，
   * **不能**放进 `_update` 尾部的「表现层不冻结」那一串。用户 2026-09-17 裁定「甲：
   * 归位延后到相 A 200ms 之后」⇒ `powerup:used` 只点名，`bead:placed` / 过关判定
   * 都推到各自到点的那一帧。
   *
   * 数组定长预分配（`SOLVER_MAX_CELLS` / ×2），逐帧只写值（热路径零分配）。
   */
  private _solverFx: SolverFxQueue | null = null;
  /**
   * G3 `vfx_powerup_sweep` 道具生效扫光（WXG-T-146 / `assets-spec §1.6.3`）：斜带覆盖整个玩法区
   * ⇒ 无空间坐标，一个计时标量即可（`-1` = 未播放）。触发源 = `powerup:used`。
   */
  private _sweepElapsedMs = -1;
  /**
   * G6 `vfx_confetti` 结算彩带（WXG-T-153 / `assets-spec §1.6.6`）：44 枚全由 idx 派生
   * ⇒ 同 `_sweepElapsedMs` 同构，一个计时标量（`-1` = 未播放）。触发源 = 结算面板入场帧
   * （裁定 1 延迟门到点开面板同帧臂；D1 直开路径不臂 = 整条关停）。
   */
  private _confettiElapsedMs = -1;
  /**
   * G4 `vfx_complete_wave` 过关庆祝波浪（WXG-T-146 / `assets-spec §1.6.4`）：全场逐列
   * ⇒ 一个计时标量（`-1` = 未播放）。同时充当**结算面板的延迟门**（裁定 1）。
   */
  private _waveElapsedMs = -1;
  /** 庆祝放完后待开的结算面板（避免离场后残留门在别的相位把面板掀开）。 */
  private _clearPanelPending = false;
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
  /** Board camera (WXG-T-169 / ADR-0015 丁-3). Identity until a pinch/drag mutates it; authoritative here, view+hit read only. */
  private _camera: BoardCamera = { ...IDENTITY_CAMERA };
  private _layout: GridLayout = gridLayoutFor(6, 5);

  private _services: GameServices | null = null;
  private _save: SaveManager<BeadsSave> | null = null;
  /** D-03 崩溃恢复档（另键 sidecar，WXG-T-059；与 S8 常规档物理隔离）。 */
  private _crash: CrashSnapshotStore | null = null;

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
  /** §3.8 震动开关镜像（VIBRATE_DEFAULT = ON；init 时从存档装载）。 */
  private _vibrate = VIBRATE_DEFAULT;
  /** 暂停面板「回主菜单」回调（options.onMenuRequest；无 shell 时 undefined）。 */
  private readonly _onMenuRequest?: () => void;
  /** 新局开局体力闸门（options.canStartRun；无 shell 时 undefined ⇒ 不设门）。 */
  private readonly _canStartRun?: () => boolean;
  /** 体力回满发奖回调（options.onStaminaRefill；无 shell 时 undefined）。 */
  private readonly _onStaminaRefill?: () => void;
  /** 在飞广告种类：区分续时（revive）与体力回满（staminaRefill）的发奖路由。 */
  private _adKind: 'revive' | 'staminaRefill' | null = null;
  /** 0 心被拒时挂起的 run-start 续体（广告回满后重放 retry/restart）。 */
  private _pendingRunStart: (() => boolean) | null = null;
  /** BOOT validation errors — non-empty means the game refuses PLAYING. */
  private _bootErrors: string[] = [];

  /** Scratch point for screen → design conversion (never retained). */
  private readonly _pointer = { x: 0, y: 0 };
  // ── Board tap / drag / pinch state (WXG-T-169 / ADR-0015 C-3(a)) ──
  // Reused objects + scalars; the input segment must stay allocation-free per frame.
  private readonly _tapStart = { x: 0, y: 0 };
  private _tapActive = false; // owner pressed inside the board region → tap deferred to lift
  private _tapMoved = false; // single-finger drag past threshold → pan, suppress tap
  private _pinched = false; // a second finger joined → pinch, suppress tap
  /**
   * 调试专用逐帧累计（`debugGestureState` 读）：pan 分支跑了多少帧、pan 总位移、
   * 进过 drag 态的帧数。预分配常量字段，热路径**零分配**，不影响行为。
   */
  private readonly _dbgPan = { frames: 0, dxSum: 0, movedFrames: 0 };
  private readonly _gesture = createGesture();

  /**
   * 统一选择锚 · board 侧（input-control §2.1 v2.0，Epic T-133 E2）。`null` = 无
   * board 锚。与托盘的 `selected` 槽位态（S4）**三值互斥**：`selection ∈ {tray,
   * board, none}` 至多一侧非空——建立一侧时必须清除另一侧（换选即转移，不叠选）。
   * 生命周期 = PLAYING 局内态：`_setupLevel` / `_loadStage` 重置；不在崩溃快照里
   * （恢复后锚 = tray-or-none，与 traySelected 同批管理，E5 扩错位珠色时再议）。
   */
  /**
   * board 锚：起点 + 错位珠组缓存（选中时算好）。
   * 【WXG-T-157 用户裁定】组 = 8 向两步（切比雪夫 ≤2）**同色**错位珠（原 WXG-T-148 ③
   * 「8 邻接 flood fill 不限色不限距」作废）；规则 2 直填后**组保持**（逐颗续填）：
   * 被填珠移出 `cells`，锚珠被填 ⇒ 锚静默转移到剩余组首（快照坐标下一帧跟随）。
   */
  private _boardSelected: {
    row: number;
    col: number;
    /** 组色 = 锚珠色（组内恒同色）。 */
    color: number;
    cells: readonly { row: number; col: number }[];
  } | null = null;

  constructor(options: BeadsGameOptions = {}) {
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    this.palette = options.palette ?? DEFAULT_PALETTE;
    this._saveKey = options.saveKey ?? SAVE_KEY;
    this._levels = options.levels ?? LEVELS;
    this._noBootAssembly = options.noBootAssembly ?? false;
    this._onMenuRequest = options.onMenuRequest;
    this._canStartRun = options.canStartRun;
    this._onStaminaRefill = options.onStaminaRefill;

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

  /** 最高解锁关（1-based）；无存档 = 1。供 shell 选关屏每帧只读（不分配）。 */
  get maxUnlockedLevel(): number {
    return this._save ? this._save.data.maxUnlockedLevel : 1;
  }

  /**
   * 每关历史最好星——**原始引用**（可能稀疏，视图按 `?? 0` 取）。
   * 与 {@link starsByLevel}（稠密拷贝、供结算/测试）区分：本 getter **零分配**，
   * 供 shell `_metaViewData` 每帧取用（热路径零分配）。
   */
  get starsByLevelRaw(): readonly number[] {
    return this._starsByLevel;
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
    // 只回起点视图：`cells` 组缓存是内部实现（WXG-T-148 ③），不进公共锚形状。
    const a = this._boardSelected;
    return a ? { row: a.row, col: a.col } : null;
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

  /** 震动开关（§3.8；shell/设置页与面板行回显共读）。 */
  get vibrateOn(): boolean {
    return this._vibrate;
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
    // ⛔ 供料死路径（WXG-T-136）：`_spawner.tick` 已摘除，游戏级 Rng 缓存随之移除；
    // S6 `random` 直接 attach 注入 Rng（铁律 L4；§8-4 有架构守卫）。供料复活时
    // 恢复 tick 调用即可（直接用 `services.rng`，无需重建字段）。
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
      migrations: { 1: migrateV1ToV2, 2: migrateV2ToV3, 3: migrateV3ToV4 },
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
    this._vibrate = normalized.save.settings.vibrate;
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
    // G2′ 相 B 到点动手：**先于**面板与表现层步进，因为本步会写棋盘并可能达成过关
    // （`cleared-priority`，core-loop §2.2.2 ⇒ 完成判定排在同一帧的事件之后）。
    this._stepSolverFx(dt);
    // Panel animation is presentation, not gameplay: it keeps running while the
    // world is frozen so the enter/exit ramp never stalls (ux-spec §5).
    this._panel.update(dt * 1000);
    this._clearPanel.update(dt * 1000); // 结算面板同理：退出淡出要在离开 LEVEL_CLEAR 后跑完
    this._finishPanel.update(dt * 1000); // 通关画面同理
    this._sprintSettle.update(dt * 1000); // 冲刺结算面板同理
    this._stepComboVfx(dt); // §2.5 连击特效：表现层，不被 PAUSED 冻结
    this._pulseClock += Math.max(0, dt) * 1000; // GAP-04/03/10 循环脉冲基准（同判例不冻结）
    this._stepWrongFx(dt);
    this._stepPlaceFx(dt); // G1 落座回弹：同为表现层，不被 PAUSED 冻结
    this._stepDeniedFx(dt); // G7 不可填格轻压：同为表现层（`assets-spec §1.6.7`）
    this._stepSweepFx(dt); // G3 道具生效扫光：同上（§1.6.3）
    this._stepConfettiFx(dt); // G6 结算彩带：同为表现层不冻结（§1.6.6）
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
   * Select a tray slot (S2 route 4a). **v2.2 组选（tray-spawner §2.1 裁定②）**：
   * 点任一 holding 珠 = 同色全组选中（发 `tray:selected {slot,colorIdx,count}`，
   * 锚置 tray）；再点已选组任一颗 = **整组静默取消**（零事件，锚回 none）。
   * v2.0：成功组选即建立 tray 锚并**清除 board 锚**（互斥换选，input-control §2.1）。
   */
  selectTraySlot(slot: number): boolean {
    if (this._machine.current !== 'playing') return false;
    const result = this._tray.select(slot);
    if (result === 'invalid') return false;
    if (result === 'deselected') return true; // 整组取消：零事件，锚自然回 none
    this._boardSelected = null; // 互斥换选：tray 锚建立 ⇒ board 锚清除（零事件）
    const color = this._tray.slot(slot)!.colorIdx;
    this._emit('tray:selected', { slot, colorIdx: color, count: this._tray.selectedCount });
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
    // WXG-T-148 ③ → 【WXG-T-157 裁定改写】：锚 = 8 向两步（切比雪夫 ≤2）**同色**错位珠组
    //（collectMisplacedGroup 内部筛色）；组色 = 锚珠色（规则 2 直填的对应色基准）。
    const cells = collectMisplacedGroup(this._grid, row, col);
    this._boardSelected = { row, col, color: this._grid.cell(row, col)!.beadColorIdx, cells };
    this._emit('board:selected', {
      row,
      col,
      colorIdx: this._grid.cell(row, col)!.beadColorIdx,
      count: cells.length,
    });
    return true;
  }

  /**
   * 静默清除托盘选中（锚互斥的 S4 侧半边，input-control §2.1「换选即转移」）。
   * **v2.2 组选改写**：清除的是整个 `selected` 组（旧版单槽直写随 Tray.deselectAll
   * 收拢）。`selected → holding` 零事件；S6 镜像无反向通知需求不变。
   */
  private _clearTraySelection(): void {
    this._tray.deselectAll();
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
   * public command. Takes the explicit misplaced cell `(row, col)`; **v2.3
   * (WXG-T-168 用户裁定，推翻 v2.2 裁定①) 落槽 = 玩家点槽定落位**：`landSlot`
   * = 玩家点击的空槽，珠**就落在那一槽**（`insertRun`）。未传 `landSlot` ⇒ 退回
   * v2.2 的 `insertGrouped` 自动归类（夹具 / 死路径兼容，玩法入口必传）。
   *
   * On success: grid `filled(错位)` → `empty` + 入槽 in the same call
   * stack, then `tray:stored {slot, colorIdx, fromRow, fromCol}` — `slot` =
   * 实际落位. Every refusal branch is ZERO-EVENT (满槽禁取珠 §3.13; locked/就位
   * taps get their 极轻反馈 from the S2/view layer, never from here).
   *
   * @returns true only when the retrieval was stored.
   */
  retrieveBead(row: number, col: number, landSlot?: number): boolean {
    if (this._machine.current !== 'playing') return false;
    const verdict = judgeRetrieve(this._grid, this._tray, row, col, landSlot);
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
   * 整组取回（WXG-T-148 裁定 ③④；**v2.3 WXG-T-168 重写落槽与容量口径**）：把
   * board 锚的错位珠组**一次**收进托盘，落位 = 从玩家点击的空槽 `targetSlot`
   * 起**连续相邻**排布（`Tray.insertRun`），推翻 v2.2 裁定① 的「自动归类 /
   * 点槽仅作触发信号」。
   *
   * **容量口径（WXG-T-168 用户裁定②，替换旧「整组拒」）**：可收数
   * `count = min(组大小, 从 targetSlot 起的连续空槽数)` —— **有多少空槽就收多少
   * 颗**；所收 = 组珠中**离点击位置（锚珠）最近的 `count` 颗**（`_nearestFirst`
   * 重排：因 `collectMisplacedGroup` 给的是**行主序**，不是距锚序）。
   * 收满 ⇒ 锚清除；未收满 ⇒ 剩余珠留在 board 且**锚改指剩余首颗**（可续点，
   * 锚变更属内部状态，**不发事件**）。
   * 连续空槽数 = 0 ⇒ 拒绝（零事件零状态写，满槽禁取珠 §3.13 的组化推广）。
   *
   * 逐颗复用 `retrieveBead`（judgeRetrieve 逐颗原子 + 逐颗 `tray:stored`）；
   * 万一中途失败（理论不可达）保守中断。
   *
   * @param targetSlot 玩家点击的空槽；省略 ⇒ 回退第一个空槽（夹具 / 旧调用兼容）。
   * @returns 至少收进 1 颗即 true。
   */
  retrieveSelectedGroup(targetSlot?: number): boolean {
    if (this._machine.current !== 'playing') return false;
    const anchor = this._boardSelected;
    if (!anchor) return false;
    const start = targetSlot ?? this._tray.firstFree();
    if (start < 0) return false; // 满槽：无任何空槽
    // 就近优先：`collectMisplacedGroup` 返回**行主序**（grid.ts 末尾 sort），与
    // 「离点击位置近」无关 ⇒ 先按到锚珠的距离重排，再从头截取。
    const ordered = this._nearestFirst(anchor.row, anchor.col, anchor.cells);
    const count = Math.min(ordered.length, this._tray.freeRunFrom(start));
    if (count <= 0) return false; // 该处无连续空槽 ⇒ 零事件零状态写
    for (let i = 0; i < count; i++) {
      const c = ordered[i]!;
      if (!this.retrieveBead(c.row, c.col, start + i)) break; // 保守中断（理论不可达）
    }
    if (count >= ordered.length) {
      this._boardSelected = null; // 整组离格 ⇒ 锚失效
    } else {
      // 部分收纳：剩余珠仍在格上 ⇒ 锚改指剩余首颗（距序 ⇒ 仍是最近的未收珠）。
      const rest = ordered.slice(count);
      const head = rest[0]!;
      this._boardSelected = { row: head.row, col: head.col, color: anchor.color, cells: rest };
    }
    return true;
  }

  /**
   * WXG-T-168 裁定②「**以当前点击位置越近越优先选择**」：把组珠按**到点击位置
   * （锚珠）的距离**升序重排。
   *
   * 为什么必须重排：`collectMisplacedGroup`（grid.ts）末尾有一句行主序 `sort`，
   * 其返回值是**行主序而非距锚序** —— 锚在组中段时，上方行的珠会被排到最前，
   * 直接取前 N 颗会「先收最远的」。故此处重排后再截取。
   *
   * 排序键 = 欧氏距离平方（整数、免开方）；平局 ⇒ 行主序（`sort` 稳定 ⇒ 确定性）。
   * 输入路径调用（一次点击一次）⇒ `slice` + `sort` 的分配可接受（同 `planGroupFill` 判例）。
   */
  private _nearestFirst(
    row: number,
    col: number,
    cells: ReadonlyArray<{ row: number; col: number }>,
  ): { row: number; col: number }[] {
    const cols = this._grid.cols;
    return cells.slice().sort((a, b) => {
      const dra = a.row - row;
      const dca = a.col - col;
      const drb = b.row - row;
      const dcb = b.col - col;
      const da = dra * dra + dca * dca;
      const db = drb * drb + dcb * dcb;
      if (da !== db) return da - db;
      return a.row * cols + a.col - (b.row * cols + b.col); // 平局 ⇒ 行主序
    });
  }

  /**
   * S2 route 2 — 道具卡点击，一次原子结算（powerups §2.3）。
  /**
   * v1.22 解环器（§3.6，用户 2026-09-16 裁定）：「**点名归 S6、动手归 S3**」。
   * S6 只从**当下**的错位珠清单里点名本次要归位的格（`affectedCells`），真正的
   * grid 归位由本方法经 grid 既有写原语（`retrieve` / `fill` / `setBead`）执行 ——
   * 沿用旧版「S6 不写、调用方动手」的分层，只是作用对象从**托盘槽**换成**棋盘格**。
   *
   * 归位规则（§3.6）：错位珠直移入「其珠色对应的 empty 目标格」；若该目标格被
   * 另一颗错位珠占据 ⇒ **两格交换**（`setBead` 双向写，`_misplacedCount` 自洽）。
   * 托盘零读写（tray-spawner v2.0 §2.2 纯缓冲）。
   *
   * @returns 仅当效果真的生效时为 true；`exhausted` 另置占位轻提示（§2.6），
   *          `empty` / `invalid` 为零事件零扣次的静默出口。
   */
  usePowerup(type: PowerupType): boolean {
    if (this._machine.current !== 'playing') return false;
    const outcome = this._powerups.request(type, this._misplacedBeads());
    if (outcome.kind === 'exhausted') {
      // 占位文案与 `btn_expand` 同一常量（§2.6 布局 A：四处广告位同一语义）。
      this._powerupHint = AD_PLACEHOLDER_HINT_TEXT;
      return false;
    }
    if (outcome.kind !== 'used') return false;
    this._powerupHint = '';

    // G2′（用户 2026-09-17 裁定「甲」）：本帧**只点名不动手** —— 相 A 200ms 闪环期间
    // 棋盘保持原样，`bead:placed` 与过关判定全部推到相 B 各自到点的那一帧（`_stepSolverFx`）。
    // 事件载荷 = 点名格（§1.6.2a「affectedCells = 预警高亮的格」）；音频派发（S6）零变化。
    const named = outcome.affectedCells;
    this._emit('powerup:used', { type: outcome.type, affectedCells: named });
    this._armSweepFx(); // G3 扫光（表现层，不影响裁决）：与 §1.6.2a 解环器归位同帧启动
    this._armSolverFx(named);
    return true;
  }

  /**
   * 当下棋盘上的错位珠清单（**行主序**）—— S6 请求那一刻的唯一输入。
   * v1.22 用它替换旧「托盘只读镜像」：S6 因此无状态、零双真源（连带消解 E3
   * 移交的 `noteSpawned` 失真 —— 供料关停后主循环恒不喂 `tray:spawned`）。
   */
  private _misplacedBeads(): MisplacedBead[] {
    const out: MisplacedBead[] = [];
    for (let row = 0; row < this._grid.rows; row++) {
      for (let col = 0; col < this._grid.cols; col++) {
        if (!this._grid.isMisplaced(row, col)) continue;
        out.push({ row, col, colorIdx: this._grid.cell(row, col)!.beadColorIdx });
      }
    }
    return out;
  }

  /**
   * 把 `(row, col)` 上的错位珠**归位**：移到「珠色对应的目标格」。
   *  - 目标格为 empty ⇒ `retrieve` + `fill`（同一调用栈，与取回→归位同源）；
   *  - 目标格被另一颗错位珠占据 ⇒ 两格 `setBead` 交换（就位珠 / locked 永不可触）。
   *
   * 落座动画的两条路（§1.6.1 vs §1.6.2a）：
   *  - **手动 / 非 G2′ 调用**（`fx = null`）⇒ 走 `_armPlaceFx`，受 120ms 连点重启门约束；
   *  - **解环器相 B**（传 `fx`）⇒ **不碰** `_armPlaceFx`，只往队列的 `land*` 槽里记录
   *    「哪一格在第 `step` 颗落座」⇒ 视图按逐颗 80ms 错开自行取包络（每颗一份完整
   *    120ms，不受手动连点门拑制）。交换场景两格**共享同一 `step`**（一步两格同时落）。
   *
   * @returns 是否真的归位（false = 该格不是错位珠 / 无合法目标格）。相 B 里玩家已在
   *          预警窗口内自行取走该珠 ⇒ false，静默跳过（不警告、不扣次、不回放动画）。
   */
  private _solveMisplaced(
    row: number,
    col: number,
    fx: SolverFxQueue | null = null,
    step = 0,
  ): boolean {
    if (!this._grid.isMisplaced(row, col)) return false;
    const bead = this._grid.cell(row, col)!.beadColorIdx;

    // 1) 首选：珠色的 empty 目标格。2) 退而：被另一颗错位珠占据的同色目标格 ⇒ 交换。
    let target: { row: number; col: number } | null = null;
    let swapWith: { row: number; col: number } | null = null;
    for (let r = 0; r < this._grid.rows; r++) {
      for (let c = 0; c < this._grid.cols; c++) {
        if (r === row && c === col) continue;
        const other = this._grid.cell(r, c)!;
        if (other.colorIdx !== bead) continue;
        if (other.state === 'empty') {
          if (!target) target = { row: r, col: c };
        } else if (this._grid.isMisplaced(r, c) && !swapWith) {
          swapWith = { row: r, col: c };
        }
      }
    }

    if (target) {
      this._grid.retrieve(row, col);
      this._grid.fill(target.row, target.col, bead);
      // 解环器路径**不带 slot**（§4 事件表：`bead:placed.slot` 改可选）。
      this._emit('bead:placed', { row: target.row, col: target.col, colorIdx: bead });
      this._noteSolverLand(fx, step, target.row, target.col);
      return true;
    }
    if (swapWith) {
      const otherBead = this._grid.cell(swapWith.row, swapWith.col)!.beadColorIdx;
      this._grid.setBead(row, col, otherBead);
      this._grid.setBead(swapWith.row, swapWith.col, bead);
      this._emit('bead:placed', { row, col, colorIdx: otherBead });
      this._emit('bead:placed', { row: swapWith.row, col: swapWith.col, colorIdx: bead });
      // 手动路径：两颗交换仅**首颗**得落座动画（120ms 门拑掉第二颗）——§1.6.1「单颗」口径，
      // 方注已登记。相 B（有 `fx`）不走门，两格共享 `step` ⇒ 同时落座。
      this._noteSolverLand(fx, step, row, col);
      this._noteSolverLand(fx, step, swapWith.row, swapWith.col);
      return true;
    }
    return false;
  }

  /**
   * 相 B 落座格登记（G2′）：`fx` 为空（手动 / 其他调用方）时退回 G1 单槽通道。
   * 定长数组越界 = 静默丢弃（上界已由 `SOLVER_MAX_CELLS × 2` 保证，不每帧抛错）。
   */
  private _noteSolverLand(
    fx: SolverFxQueue | null,
    step: number,
    row: number,
    col: number,
  ): void {
    if (!fx) {
      this._armPlaceFx(row, col); // G1 落座回弹（表现层，不影响裁决）
      return;
    }
    const i = fx.landCount;
    if (i >= fx.landRows.length) return;
    fx.landRows[i] = row;
    fx.landCols[i] = col;
    fx.landSteps[i] = step;
    fx.landCount = i + 1;
  }

  /** Unlock the tray expansion row (MVP: badge-only placeholder, no ad call). */
  expandTray(): boolean {
    if (!this._tray.expand()) return false;
    this._emit('tray:expanded', {});
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

  /**
   * Debug/dev hook: drop a specific colour into the tray (S4 path).
   *
   * ⛔ v2.0 供料关停后这是**唯一**还广播 `tray:spawned` 的入口（测试 / harness
   * 夹具专用，非玩法触发源；tray-spawner v2.0 §4 死路径保留口径）。供料复活时
   * 主循环供料段恢复，本钩子语义自动并入。
   * **v2.2 裁定①**：落位改走 `insertGrouped` 自动归类——夹具构造的托盘与玩法
   * 实况同一不变式（同色连续块紧凑排列），不会造出违反归类的测试态。
   */
  giveTrayBead(colorIdx: number): number {
    const slot = this._tray.insertGrouped(colorIdx);
    if (slot < 0) return -1;
    this._emit('tray:spawned', { slot, colorIdx });
    return slot;
  }

  /** Retry after game over: normal → same level fresh; sprint → new run. */
  retryLevel(): boolean {
    if (this._machine.current !== 'game-over') return false;
    // §3.14：普通局重开 = 新局开局，扣 1 心；0 心 → 看广告回满再重试（冲刺消耗不冻结，不设门）。
    if (this._mode === 'normal' && !this._gateRunStart(() => this.retryLevel())) return false;
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
    this._adKind = 'revive';
    this._watchingAd = true;
    ad.load(REWARDED_PLACEMENT.failContinue);
    ad.show();
    if (this._watchingAd) return true;
    if (this._machine.current !== 'game-over') return true;
    this._failHint = '即将开放';
    return false;
  }

  /**
   * 新局开局体力闸门（§3.14）。无 shell（`_canStartRun` 未注入）→ 恒放行（独立 BeadsGame
   * 后向兼容）；扣心成功 → 放行；0 心被拒 → 触发体力回满激励位（{@link _requestStaminaRefill}），
   * 本次调用返回 false（停在原面板，广告发奖后经挂起续体重放）。
   */
  private _gateRunStart(proceed: () => boolean): boolean {
    if (!this._canStartRun) return true;
    if (this._canStartRun()) return true;
    this._requestStaminaRefill(proceed);
    return false;
  }

  /**
   * 0 心重试的体力回满广告（§3.11 第二 live 位）：加载 `stamina-refill` 位并挂起 run-start
   * 续体；发奖路由见 {@link _onAdRewarded}（回满 → 重放 retry/restart，此时闸门扣 1 心成功）。
   * 无广告位 / 无 shell 回满回调 → 无副作用（被拒即停在面板，可再点或等自然恢复）。
   */
  private _requestStaminaRefill(proceed: () => boolean): void {
    if (this._watchingAd) return;
    const ad = this._services?.rewardedAd;
    if (!ad || !this._onStaminaRefill) return;
    this._failHint = '';
    this._adKind = 'staminaRefill';
    this._pendingRunStart = proceed;
    this._watchingAd = true;
    ad.load(STAMINA_REFILL_PLACEMENT);
    ad.show();
  }

  /** From the FINISH screen: replay the whole normal campaign from level 1. */
  restartRun(): boolean {
    if (this._machine.current !== 'finish') return false;
    // §3.14：整轮重玩 = 新局开局，扣 1 心；0 心 → 看广告回满再重试。
    if (!this._gateRunStart(() => this.restartRun())) return false;
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

  /**
   * 主菜单设置 overlay 复用 S9 开关（ux-spec v1.7 §2「设置 = overlay、复用 S9
   * 面板内容」，WXG-T-164 批0）：只受理 `toggle-*` 动作，相位无关（局外设置），
   * 与暂停面板共用同一批私有 setter ⇒ 两入口状态恒一致。非 toggle 动作零作用。
   */
  applySettingsAction(action: PausePanelAction): void {
    switch (action) {
      case 'toggle-bgm':
        this._setBgmMuted(!this._bgmMuted);
        return;
      case 'toggle-sfx':
        this._setSfxMuted(!this._sfxMuted);
        return;
      case 'toggle-reduce-motion':
        this._setReduceMotion(!this._reduceMotion);
        return;
      case 'toggle-large-text':
        this._setLargeText(!this._largeText);
        return;
      case 'toggle-vibrate':
        this._setVibrate(!this._vibrate);
        return;
      default:
        return;
    }
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
      // v2.0 供料关停（WXG-T-136）⇒ 旧「供料心跳比对」判据随死路径删除。
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
    // v1.22（WXG-T-137）：S6 已无托盘镜像（道具目标 = 棋盘错位珠）⇒ 这里不再
    // 逐槽喂镜像，只恢复三计数（`restoreUses`）。托盘槽由上面的逐槽还原独立恢复。
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
          if (from === 'level-clear') {
            game._clearPanel.close();
            // 离场即弃庆祝门与波浪（否则残留 pending 可能在别的相位掀开面板）。
            game._waveElapsedMs = -1;
            game._clearPanelPending = false;
          }
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
          // 裁定 1（T-128）：面板**延迟 `CLEAR_PANEL_DELAY_MS` 开** —— 庆祝波浪先行放完再落遮罩。
          // 代码事实：`drawClearPanel` 首行即全屏遮罩 α0.5 且在 drawGrid 之后 ⇒ 同帧开 = 庆祝被遮死。
          // D1（reduceMotion）：波浪整条关停 ⇒ **不再空等 800ms**（庆祝是延迟的唯一理由，
          // 关掉庆祝还让手感多等 = 纯惩罚）。本派生口径已入台账 T-146 待确认。
          if (game._reduceMotion) {
            game._clearPanel.open();
            game._sfx(AUDIO_CLIP_PANEL_IN);
          } else {
            game._waveElapsedMs = 0;
            game._clearPanelPending = true;
          }
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

    // GAP-03 首屏引导（ux-spec §6.3）+ **BD-32（T-097）**：判定改显式 `onboarded`
    // 标记 —— `runs` 每次 BOOT 自增，作真源会在「首玩落子前杀进程」时永久失引导
    // （BOOT#1 runs 0→1 落盘 ⇒ BOOT#2 判老玩家）。v2 存量档的迁移在
    // `normalizeBeadsSave`（runs>0 一次性判 true），此处只信字段。
    this._onboardDone = save ? save.data.onboarded : true;

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
      ad.onRewarded(() => this._onAdRewarded()),
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
      //         `affectedCells` 为空 ⇒ **零发声**（powerups §4 零噪声原则）。
      //         BD-49（WXG-T-151 实证 / WXG-T-154 修复）：v1.22 payload 改名旧字段
      //         `affectedSlots` 残留读本分支恒 undefined 早退 ⇒ 真链零发声；现读 L171 契约字段。
      bus.on('powerup:used', (payload) => {
        const cells = (payload as { affectedCells?: readonly { row: number; col: number }[] }).affectedCells;
        if (!cells || cells.length === 0) return;
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
      // ⛔ v2.0 供料关停（WXG-T-136）：`tray:full` 玩法侧零发射（systems-index §4 作废），
      // 本监听为**死路径保留**——满槽告警视觉改由槽态驱动（view-model 读 `freeSlots`），
      // 不经本事件；供料复活时自动恢复发声。`AUDIO_CLIP_TRAY_FULL` 仍留在 A05-24
      // 19-clip 闭合集内（audio-events §1 未删行，音频域文件本单禁改）。
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
    // v2.0 BOOT 装配（levels-spec v1.2 §2.1 / v1.3 §2.2，WXG-T-139 装配器）：
    // 初盘真源二选一——`level.misplaced`（全错位初盘，直读）优先，否则 `swaps`
    // 两两交换。装配发生在玩法状态机接管之前（bead-grid §2.1），绕过 retrieve/place
    // 边合法；重试经本函数重装配 = 恢复初始错位（timer-gameover v1.3 重置清单）。
    // 合法性已由 BOOT validateBeadsLevel 静态校验。
    if (!this._noBootAssembly) {
      applyMisplacedToGrid(this._grid, level.pattern, level.swaps, level.misplaced);
    }
    // WXG-T-172 · F3 甲裁：本行 = 复位点①（换关 / 新局 / 重试 / 跳关共用）。复位档 =
    // fit 初始（小盘 fit=1 与旧恒等逐位相同）；回菜单 / 后台隐藏当帧不复位，由下次装配复位（ADR-0015 §3.4）。
    fitCamera(this._camera, this._grid.cols, this._grid.rows);
    resetGesture(this._gesture);
    this._tapActive = false;
    this._tapMoved = false;
    this._pinched = false;
    this._layout = gridLayoutFor(this._grid.cols, this._grid.rows, this._camera);
    this._boardSelected = null; // 换关 ⇒ 旧 board 锚指向的格已不存在
    this._solverFx = null; // 换关 / 重试 ⇒ 作废在途的 G2′ 队列（相 B **会写盘**，不能拿旧格坐标动新棋盘）
    this._tray.reset();
    this._resetPowerups();
    this._tray.initNeeded(this._grid.neededColorCounts());
    this._spawner.reset();
    this._spawner.interval = 4.0; // ⛔ 死路径缺省（供料关停，关卡字段已删）
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
    // WXG-T-172 · F3 甲裁：本行 = 复位点②（冲刺换 stage）。与 _setupLevel 那处合计 2 点，
    // 不变式 = 装配即复位；fit 按新棋盘尺寸重算（ADR-0015 §3.4）。
    fitCamera(this._camera, this._grid.cols, this._grid.rows);
    resetGesture(this._gesture);
    this._tapActive = false;
    this._tapMoved = false;
    this._pinched = false;
    this._layout = gridLayoutFor(this._grid.cols, this._grid.rows, this._camera);
    this._boardSelected = null; // 换 stage ⇒ 旧 board 锚指向的格已不存在
    this._tray.reset();
    this._resetPowerups(); // 冲刺换 stage = 换关语义，三计数一并复位（§2.5）
    this._tray.initNeeded(this._grid.neededColorCounts());
    this._spawner.reset();
    this._spawner.interval = stageParamsFor(n).interval;
    this._spawner.setDecoys([]);
    this._stageIndex = n;
  }

  /** One PLAYING frame: combo window → countdown (input is read in `update()`). The feed segment is dead (v2.0). */
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

    // ⛔ 供料段（v2.0 定时供料关停，WXG-T-136 / 用户 2026-09-16 裁定案 A）：
    // 错位珠是珠子唯一供给，托盘为纯解谜缓冲（tray-spawner v2.0 §2.2 全节作废、
    // core-loop §2.2.2「供料段恒空」）⇒ PLAYING 心跳里本段**恒空**。`tray:spawned`
    // 与 `tray:full` 随之零发射（systems-index v1.22 §4 作废标注）。死路径保留：
    // `Spawner` 类 / `Tray.spawnInto` / `giveTrayBead()` 调试钩子与快照字段不动，
    // 供料复活（需走 tray-spawner §6 变更 + 主理人确认）时恢复本段即可。
    // S6 `noteSpawned` 镜像（§2.4）同步失去主循环喂入口，仅为死路径/快照恢复保留。

    const tick = this._timer.tick(dt);
    if (tick.displayTick !== null) this._emit('timer:tick', { remaining: tick.displayTick });
    if (tick.urgent !== null) this._emit('timer:urgent', { remaining: tick.urgent });
    if (tick.expired) {
      this._machine.transition('game-over');
    }
  }

  /** Read one frame of input and route it (input-control §2.1, short-circuit).
   *  WXG-T-169 / ADR-0015 C-3(a): 棋盘区 tap 抬起才提交（区外按下即提交不变）；
   *  双指 = 捏合缩放、单指位移 ≥ 阈值 = 平移，均只写相机、不产玩法指令。 */
  private _readInput(): void {
    const services = this._services;
    if (!services) return;
    const snap = services.input.snapshot;
    const vp = services.viewport;
    const playing = this._machine.current === 'playing';

    if (snap.justDown) {
      vp.screenToDesign(this._pointer, snap.x, snap.y);
      // 棋盘区起手域 = PUZZLE_BAND 整块（不限「命中某格」）：真机拖拽可从盘面任意处起手。
      const onBoard =
        playing && this._pointer.y >= PUZZLE_BAND.yMin && this._pointer.y <= PUZZLE_BAND.yMax;
      if (onBoard) {
        // 棋盘区按下 → 登记，不提交；抬起为 tap，中途越阈值转拖拽、次指落下转捏合。
        this._tapActive = true;
        this._tapMoved = false;
        this._pinched = false;
        this._tapStart.x = this._pointer.x;
        this._tapStart.y = this._pointer.y;
        // WXG-T-170 / F1：同一固定步内 down+up 到达（snap.justDown && snap.justUp 同时为真、
        // snap.isDown 已因 owner 抬起而 false）⇒ 位移恒 0 = 即时 tap。此处不 return，
        // 下面 `_tapActive && isDown` 守卫自然跳过（isDown=false），到 `justUp` 分支当场提交并复位。
        if (!snap.justUp) return;
      } else {
        this._handleTap(this._pointer.x, this._pointer.y); // 区外：按下即提交（语义不变）
        return;
      }
    }

    if (this._tapActive && snap.isDown) {
      if (snap.isDown2) {
        this._pinched = true;
        if (applyPinch(snap, this._camera, this._gesture, this._grid.cols, this._grid.rows)) this._recomputeLayout();
        return;
      }
      vp.screenToDesign(this._pointer, snap.x, snap.y);
      if (!this._tapMoved) {
        // WXG-T-171 / F2：度量形态 = **切比雪夫 L∞ = max(|dx|,|dy|)**（GDD `input-control §2.1` v2.5 字面对齐）。
        // 判定域 = 正方形（与盘面格子对齐，手指抖动「不越格」直觉）；旧实现为曼哈顿 L1=|dx|+|dy|，已废。
        const moved = Math.max(
          Math.abs(this._pointer.x - this._tapStart.x),
          Math.abs(this._pointer.y - this._tapStart.y),
        );
        if (moved >= BOARD_TAP_MOVE_THRESHOLD) this._tapMoved = true;
      }
      if (this._tapMoved) {
        // 单指拖拽 → 平移相机（screen dx/dy → design：/scale、y 翻向）。
        const scale = vp.fit.scale || 1;
        this._dbgPan.frames += 1;
        this._dbgPan.dxSum += snap.dx / scale;
        applyPan(snap.dx / scale, -snap.dy / scale, this._camera, this._grid.cols, this._grid.rows);
        this._recomputeLayout();
      } else {
        this._dbgPan.movedFrames += 1;
      }
      return;
    }

    if (snap.justUp) {
      if (this._tapActive && !this._tapMoved && !this._pinched) {
        vp.screenToDesign(this._pointer, snap.x, snap.y);
        this._handleTap(this._pointer.x, this._pointer.y); // 棋盘区 tap：抬起提交
      }
      this._tapActive = false;
      this._tapMoved = false;
      this._pinched = false;
      this._dbgPan.frames = 0;
      this._dbgPan.dxSum = 0;
      this._dbgPan.movedFrames = 0;
      resetGesture(this._gesture);
    }
  }

  /** Fold `_camera` into the grid layout (丁-3). Only called while a gesture is
   *  active — steady frames allocate nothing. ponytail: transient per-frame
   *  layout object during an active pinch/drag; pool-mutate it if profiling says so. */
  private _recomputeLayout(): void {
    this._layout = gridLayoutFor(this._grid.cols, this._grid.rows, this._camera);
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
    // v2.3（WXG-T-168）：点击的空槽 = 落位起点（`slot` 即 API 参数，v2.2「仅触发
    // 信号」口径作废）；容量不足 ⇒ 按距锚就近部分收纳。
    this.retrieveSelectedGroup(slot);
  }

  /**
   * 路由 5 · 网格带内部分支（input-control §2.1 v2.0；带级次序不变）：
   *  - **5a `filled(错位)`** → `selectBoardBead`（锚置 board，发 `board:selected`）。
   *    错位判定**只用 grid 派生谓词** `isMisplaced`，不在路由层复制逻辑。
   *  - **5b `empty`** → 锚 = tray ⇒ `_placeSelected`（S3 裁决 placed/rejected）；
   *    锚 ∈ {board, none} ⇒ 归位前置缺口轻提示（零事件，仅可落空格——§8-7），
   *    分支体见 `_routeGridEmpty`（`_placeSelected` 的 slot<0 分支已迁来）。
   *  - **5c locked / `filled(就位)`** → 极轻非惩罚反馈忽略（§2.4 裁定 4）。G7 极轻
   *    反馈通道**已落码**（WXG-T-152 / `assets-spec §1.6.7`）⇒ 出口接 `_armDeniedFx`
   *    （scale 1.00→0.96→1.00 + `sfx_denied`；**零事件零状态写**红线不变）。
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
    // 5c：locked / void / filled(就位) —— 零事件零状态写；G7 极轻反馈出口
    //（void / 越界不触发的守卫集中在 `_armDeniedFx`，§1.6.7 非触发集）。
    this._armDeniedFx(row, col);
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
    // 【WXG-T-162 用户裁定 · 直填放开任意距离】board 锚：组非空 ⇒ 点「对应颜色的空格」
    // （不限距）直接归位，组保持逐颗续填。未消费（null/false）⇒ 走既有轻提示。
    const direct = this._tryDirectFillFromBoard(row, col);
    if (direct !== null) return direct;
    if (this._grid.isFillable(row, col)) {
      this._showTapHint(TAP_HINT_NO_SELECTION_TEXT, row, col);
    }
    return false;
  }

  /**
   * 【WXG-T-162 用户裁定（2026-09-18）· 直填任意距离】board 锚直填：
   * 点「对应颜色（= 组色）的空格」（**不限距**，覆盖 WXG-T-157 的 ≤2 门）⇒ 从组内取一颗
   * （离目标格最近，平局行主序）错位珠直接归位（`retrieve` + `fill` 同帧两写，
   * `_filledCount` 不变、misplaced −1、无中间态外泄）。
   * - **组保持（逐颗续填，T-157 裁定 B 沿用）**：被填珠移出 `cells`；锚珠被填 ⇒ 锚**静默转移**到
   *   剩余组首（不重发 `board:selected` —— 快照坐标下一帧跟随，白环/点名视图自动对齐）；
   *   组空 ⇒ 锚清除。
   * - 归位可能达成零错位 ⇒ cleared-priority（core-loop §2.2.2，同 `_placeSelected`）。
   * - 底色不匹配 ⇒ 不消费（null），走既有「无对应路径」轻提示口径。
   * @returns true = 已直填；false = 已消费但拒绝（取珠/落盘失败防御面）；null = 与 board 锚无关（调用方续走旧路径）。
   */
  private _tryDirectFillFromBoard(row: number, col: number): boolean | null {
    const anchor = this._boardSelected;
    if (!anchor) return null;
    // 组员存活复核（solver / region / 其它消费可能中途清珠）：
    const alive = anchor.cells.filter((c) => {
      const cell = this._grid.cell(c.row, c.col);
      return !!cell && cell.state === 'filled' && cell.beadColorIdx === anchor.color && cell.beadColorIdx !== cell.colorIdx;
    });
    if (alive.length === 0) {
      this._boardSelected = null;
      return null;
    }
    const target = this._grid.cell(row, col);
    if (!target || target.void || target.state !== 'empty' || target.colorIdx !== anchor.color) return null; // 非对应色空格 ⇒ 不消费
    this._consumedTap = true; // 直填已消费本次点击

    // 【#3 · WXG-T-180 用户裁定】一次点击 = **组批量归位**：填被点空格 + 其 8 向连通的
    // 同色空格一片（上限 = 组内可用错位珠数），对齐托盘侧 `planGroupFill` 连续填充手感。
    // 旧「逐颗续填（一点一格）」放宽为整片；每格取「距该格最近的剩余组员」，retrieve+fill 同帧两写。
    const targets: { row: number; col: number }[] = [{ row, col }];
    const extra = planGroupFill(this._grid, row, col, anchor.color, alive.length - 1);
    for (const e of extra) targets.push(e);

    let placedAny = false;
    for (const t of targets) {
      const cell = this._grid.cell(t.row, t.col);
      if (!cell || cell.state !== 'empty' || cell.colorIdx !== anchor.color) continue; // 复核（被点格外均为 BFS 收集的同色空格）
      // 取距该目标格最近的剩余组员（平局行主序）。
      let bi = 0;
      let bd = Infinity;
      let bord = Infinity;
      for (let i = 0; i < alive.length; i++) {
        const c = alive[i]!;
        const d = Math.max(Math.abs(c.row - t.row), Math.abs(c.col - t.col));
        const ord = c.row * this._grid.cols + c.col;
        if (d < bd || (d === bd && ord < bord)) {
          bd = d;
          bord = ord;
          bi = i;
        }
      }
      const src = alive[bi]!;
      const bead = this._grid.retrieve(src.row, src.col);
      if (!bead || !this._grid.fill(t.row, t.col, bead)) {
        if (bead) this._grid.setBead(src.row, src.col, bead); // 防御回滚（理论不可达：目标已验 empty）
        continue;
      }
      alive.splice(bi, 1);
      this._emit('bead:placed', { row: t.row, col: t.col, colorIdx: bead }); // 盘内移动不经托盘 ⇒ 无 slot
      placedAny = true;
      if (alive.length === 0) break;
    }
    if (!placedAny) return false;

    // 锚更新：组空 ⇒ 清；否则转移到剩余组首（行主序，快照坐标下帧跟随）。
    if (alive.length === 0) {
      this._boardSelected = null;
    } else {
      alive.sort((a, b) => a.row * this._grid.cols + a.col - (b.row * this._grid.cols + b.col));
      const head = alive[0]!;
      this._boardSelected = { row: head.row, col: head.col, color: anchor.color, cells: alive };
    }
    // 归位后可能达成零错位 ⇒ cleared-priority（core-loop §2.2.2）
    if (this._grid.isComplete()) {
      if (this._mode === 'sprint') this._completeStage();
      else this._machine.transition('level-clear');
    }
    return true;
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
      case 'toggle-vibrate':
        // §3.8：只写设置（留 PAUSED），真机 vibrateShort 调用属平台适配层（ponytail:
        // 批0 不接真震动 API，待真机复验窗口接入 adapters）。
        this._setVibrate(!this._vibrate);
        return;
      case 'go-menu':
        // 回主菜单（pause-settings v1.4 §8-11，WXG-T-165 真机反馈反转）：上报意图、
        // 切屏归 shell（本局棋盘不保留，下次「开始游戏」由 shell.goToLevel 复位）。
        this._onMenuRequest?.();
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
  private _stepLevelClear(dt: number): void {
    // G4 波浪推进 + 结算面板延迟门（裁定 1）。本相位内不存在 PAUSED，故照常推进；
    // `ClearPanel.update()` 在 `_shown = false` 时早退 ⇒ 星级计时不会在延迟期攒成一次爆发。
    if (this._waveElapsedMs >= 0) {
      this._waveElapsedMs += Math.max(0, dt) * 1000;
      if (this._waveElapsedMs >= CLEAR_PANEL_DELAY_MS) this._waveElapsedMs = -1;
    }
    if (
      this._clearPanelPending &&
      this._waveElapsedMs < 0 &&
      this._machine.current === 'level-clear'
    ) {
      this._clearPanelPending = false;
      this._clearPanel.open();
      this._confettiElapsedMs = 0; // G6 彩带与面板入场同帧启动（非 D1 路径；D1 直开不臂 = 整条关停）
      this._sfx(AUDIO_CLIP_PANEL_IN);
    }
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
    this._adKind = null;
    this._pendingRunStart = null;
  }

  /** 广告发奖分发：按在飞种类路由到续时（revive）或体力回满（staminaRefill）。 */
  private _onAdRewarded(): void {
    this._watchingAd = false;
    if (this._adKind === 'staminaRefill') {
      this._adKind = null;
      const proceed = this._pendingRunStart;
      this._pendingRunStart = null;
      this._onStaminaRefill?.(); // shell: meta.refillStamina() → STAMINA_MAX
      // 回满后重放被拒的 run-start：此时闸门扣 1 心必成功（MAX ≥ START_COST），不会再次被拒。
      proceed?.();
      return;
    }
    this._adKind = null;
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
   * The S2 → S3 route: place the selected bead group, then handle every outcome.
   * v2.0 E2：归位前置「锚 = tray」由调用方（`_routeGridEmpty`）保证；本方法收窄为
   * 纯裁决应用——原 `slot<0` 轻提示分支已迁到路由层（`_routeGridEmpty` 方法头注），
   * 这里只保留旁路防御（无选中零事件拒绝，不再提示）。
   *
   * **v2.1 组批量填充（bead-grid §2.3 路径 B 第 3 步，WXG-T-158 裁定③④）**：
   * 被点格匹配 ⇒ 从被点格起 8 向 BFS、不限步数，沿「`empty` 且底色 = 组色」的
   * 连通空格蔓延，至多填 `min(组珠数, 连通格数)` 格（被点格必最先填，其余按 BFS
   * 距层就近）；每格一份逐颗 `bead:placed`（同调用栈串行发完，每颗携各自来源槽
   * = 组块尾部倒序取珠，保持归类紧凑不变式）。**部分填充（裁定③）**：珠不够 ⇒
   * 点到珠为止；珠有余 ⇒ 剩余珠保持 `selected`（锚不变可续点）；组清空 ⇒ 锚自然
   * 回 none。不匹配/不可填目标 = 既有 rejected/ignored 单格口径不变（整组留托盘）。
   */
  private _placeSelected(row: number, col: number): boolean {
    const slotHead = this._tray.selectedSlot;
    if (slotHead < 0) return false; // 防御：无锚不该到达（路由层已拦截并提示）
    const colorIdx = this._tray.selectedColor;
    const groupSize = this._tray.selectedCount;
    const verdict = judgePlacement(this._grid, row, col, colorIdx, slotHead);

    switch (verdict.outcome) {
      case 'placed': {
        // 填充序：被点格最先，其余 = planGroupFill（BFS 距层，至多组珠数 −1）。
        const cells: { row: number; col: number }[] = [
          { row: verdict.row, col: verdict.col },
        ];
        if (groupSize > 1) {
          const rest = planGroupFill(
            this._grid,
            verdict.row,
            verdict.col,
            colorIdx,
            groupSize - 1,
          );
          for (let i = 0; i < rest.length; i++) cells.push(rest[i]!);
        }
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i]!;
          // 逐颗：从组块尾部取珠（块尾离格 ⇒ 紧凑不变式保持）。
          const slot = this._tray.selectedLastSlot;
          if (slot < 0) break; // 防御：珠与格严格配对，理论不可达
          // 首格 = 被点格，已由 `judgePlacement` 写入；后续 BFS 格在此落子。
          if (i > 0 && !this._grid.fill(c.row, c.col, colorIdx)) break; // 防御：格已被占
          this._tray.takeBead(slot);
          this._emit('bead:placed', { row: c.row, col: c.col, colorIdx, slot });
          this._armPlaceFx(c.row, c.col); // G1 落座回弹（`assets-spec §1.6.1`）
          // GAP-03：首次落子即清引导（事件驱动，无计时器，§6.1）。
          // BD-32：引导完成**显式落盘** —— patch 只置 dirty，杀进程场景 flush 前丢
          // 写 ⇒ 此处一次性低频 IO 直接 save()。幂等守卫：仅首次落子写一次（后续
          // 落子零 S8 写，守 §8-11「放置不触存档」）。
          if (!this._onboardDone) {
            this._onboardDone = true;
            this._save?.patch({ onboarded: true });
            this._save?.save();
          }

          if (this._mode === 'sprint') {
            const score = this._sprint.onPlaced();
            if (score.tierUp !== null) {
              // §2.5 特效三档随倍率档触发；派生项：重叠时只播**最高档**。
              const spec = comboVfxSpec(score.tierUp);
              if (spec && (!this._comboVfx || spec.tier >= this._comboVfx.spec.tier)) {
                this._comboVfx = { spec, elapsedMs: 0, row: c.row, col: c.col };
              }
              this._emit('combo:up', {
                streak: score.streak,
                multiplier: score.multiplier,
                tier: score.tierUp,
              });
            }
            // Stage full → immediate switch (≤1 frame), bonus time applied
            // BEFORE this frame's timer tick (C8: stage first).
            if (this._grid.isComplete()) {
              this._completeStage(); // ⚠️ 换关会重置托盘 ⇒ 必须终止本批剩余格
              break;
            }
          } else if (this._grid.isComplete()) {
            // Cleared-priority: the same frame can never also judge a failure —
            // the machine leaves PLAYING before the timer ticks again (S1 §8-5).
            this._machine.transition('level-clear');
            break; // 过关已判 ⇒ 不再续填（同帧口径与单珠版一致）
          }
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
        // G7（WXG-T-152 / §1.6.7）：触发口径 = 裁决 `ignored` 且 reason ∈
        // {occupied, locked} ⇒ 极轻非惩罚反馈（仍零事件，只起表现层计时槽）。
        // out-of-bounds / no-color 不触发；真链 5c 与同格 250ms 门天然去重。
        if (verdict.reason === 'occupied' || verdict.reason === 'locked') {
          this._armDeniedFx(verdict.row, verdict.col);
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
        vibrate: this._vibrate,
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

  /** §3.8 震动开关：写档 + 发 `settings:vibrate`（§4 meta 事件；不切相位）。 */
  private _setVibrate(on: boolean): void {
    this._vibrate = on;
    this._persistSettings();
    this._emit('settings:vibrate', { on });
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
    // v1.25（WXG-T-143）：扩展态按钮隐藏 ⇒ 命中同时失效。其热区 [230,318] 此时
    // 已被 4 行托盘面板覆盖（row2 槽心 y=306 / row3 y=252 落在区间内），若不短路
    // 会把扩展态的托盘点选截胡在 route 3（渲染侧 drawExpandButton 同款守卫）。
    if (this._tray.expanded) return false;
    const btn = expandButtonLayout();
    return (
      x >= btn.hitX &&
      x <= btn.hitX + btn.hitW &&
      y >= btn.hitBottom &&
      y <= btn.hitBottom + btn.hitH
    );
  }

  /** Nearest grid cell within the camera-scaled hit area (ties → smaller row).
   *  Delegates to `tuning::hitGridCell` so gameplay and the layout⇄hit regression
   *  test share one implementation (WXG-T-169 / ADR-0015). */
  private _hitGridCell(x: number, y: number): { row: number; col: number } | null {
    return hitGridCell(this._layout, this._camera.zoom, x, y);
  }

  /**
   * 调试只读口（`BeadsBootstrap` 在 `__WXG_TOUCH_DEBUG` 下暴露给探针 / 真机调试 Console）。
   *
   * 为何公开：**必须走游戏自己的命中函数与当前布局**。探针若自己重推格心/命中公式，
   * 就与真源共用了同一个错（判例 K-042），得出的「zoom≠1 命中正确」只是自证。
   * 两个方法都**无副作用**（不写状态、不发事件），且仅在调试开关下被调用。
   */
  debugHitCell(x: number, y: number): { row: number; col: number } | null {
    return this._hitGridCell(x, y);
  }

  /** 格心的设计坐标——由**当前布局**（已烘入相机）给出，与渲染层同源。 */
  debugCellCenter(row: number, col: number): { x: number; y: number } | null {
    if (row < 0 || col < 0 || row >= this._grid.rows || col >= this._grid.cols) return null;
    return { x: this._layout.colCenterX(col), y: this._layout.rowCenterY(row) };
  }

  /**
   * 调试只读：**拖拽/捏合链上的闸位与相机当前值**（WXG-T-167 真机反馈「能缩放不能拖动」复现用）。
   * 不写不测；仅供 [B] 探针与真机 Console 定位「哪一步没走通」，避免靠猜（K-036）。
   */
  debugGestureState(): Record<string, number | boolean> {
    const s = this._services ? this._services.input.snapshot : null;
    return {
      tapActive: this._tapActive,
      tapMoved: this._tapMoved,
      pinched: this._pinched,
      isDown: !!s && s.isDown,
      isDown2: !!s && s.isDown2,
      // 拖拽位移的直接源头：pan 用 snap.dx/scale。dx 恒 0 ⇒ 断在输入层；dx 非 0 而
      // offsetX 仍 0 ⇒ 断在 `_readInput` 分支或 clamp（K-036：不拿猜测当定位）。
      snapX: s ? s.x : 0,
      snapY: s ? s.y : 0,
      dx: s ? s.dx : 0,
      dy: s ? s.dy : 0,
      // 逐帧累计量：避开「在固定步之外读 snapshot」的时窗假象（dx 可能已归零）。
      panFrames: this._dbgPan.frames,
      panDxSum: this._dbgPan.dxSum,
      panMovedFrames: this._dbgPan.movedFrames,
      zoom: this._camera.zoom,
      offsetX: this._camera.offsetX,
      offsetY: this._camera.offsetY,
      pinchDist0: this._gesture.pinchDist0,
    };
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
   * G1 落座回弹起播（WXG-T-128 / `assets-spec §1.6.1`）。**120ms 重启门**（= 动画自身长，
   * 同族判例 = `_armWrongFx` 的 500ms 门）：门内到达的新 `bead:placed` **不重启**，
   * 防连点堆叠。
   *
   * ⚠️ **与 G2′ 的口径分工**（冲突已在 WXG-T-150 销账）：本门只管**手动连点**。
   * 解环器逐颗 80ms（`SOLVER_STAGGER_MS` < 120）若挤过本槽，每隔一颗会被拑掉而无声
   * ⇒ G2′ 走**独立队列**（`_solverFx` 的 `land*` 槽，每颗一份完整 120ms 包络），
   * 相 B 路径上 `_solveMisplaced` **不再**调用本方法（见 `_noteSolverLand`）。
   *
   * 非每帧路径：仅在落入网格帧调用 ⇒ 无每帧分配顾虑。
   */
  private _armPlaceFx(row: number, col: number): void {
    if (this._pulseClock - this._placeFxArmedAtMs < FILL_POP_RESTART_GATE_MS) return;
    this._placeFx = { row, col, elapsedMs: 0 };
    this._placeFxArmedAtMs = this._pulseClock;
  }

  /**
   * G1 落座回弹推进（WXG-T-128）：与 `_stepWrongFx` / `_stepComboVfx` 同判例——表现层，
   * 不被 PAUSED 冻结。单次播放 `FILL_POP_MS`（120ms）后**零残留**（槽置 null，
   * 不等 `placeProgress` 达到 1 后还留着偏移量）。
   */
  private _stepPlaceFx(dt: number): void {
    const fx = this._placeFx;
    if (!fx) return;
    fx.elapsedMs += Math.max(0, dt) * 1000;
    if (fx.elapsedMs >= FILL_POP_MS) this._placeFx = null;
  }

  /**
   * G7 轻压起播（WXG-T-152 / `assets-spec §1.6.7`）：**同格 250ms 重启门**
   * （§1.6.7「同格计」⇒ 区别于 G1 的全局单槽门）：门内重复点同格不重启、不放音；
   * 过门 ⇒ 该槽重启 + `_sfx(AUDIO_CLIP_DENIED)`。不同格的轻压可并存；槽满时逐出
   * **最早起播**者（其动画早已播完，视觉无打断）。void（谜面外形格）/ 越界守卫
   * 集中在此，一处覆盖真链 5c 与裁决旁两条路径。
   * 非每帧路径：仅在点击被拒帧调用 ⇒ 无每帧分配。
   */
  private _armDeniedFx(row: number, col: number): void {
    const cell = this._grid.cell(row, col);
    if (!cell || cell.void) return; // §1.6.7 非触发集：越界 / `.` 外形格
    const now = this._pulseClock;
    const slots = this._deniedFx;
    let reuse = -1; // 空槽，或已过动画窗（只剩门记忆）的槽
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]!;
      if (s.row === row && s.col === col) {
        if (now - s.armedAtMs < DENIED_PRESS_RESTART_GATE_MS) return; // 同格门内
        s.elapsedMs = 0;
        s.armedAtMs = now;
        this._sfx(AUDIO_CLIP_DENIED);
        return;
      }
      if (reuse < 0 && (s.row < 0 || s.elapsedMs >= DENIED_PRESS_MS)) reuse = i;
    }
    if (reuse < 0) {
      // 全槽在播（相邻格快速连扫超容量）⇒ 逐出最早起播者
      reuse = 0;
      for (let i = 1; i < slots.length; i++) {
        if (slots[i]!.armedAtMs < slots[reuse]!.armedAtMs) reuse = i;
      }
    }
    const slot = slots[reuse]!;
    slot.row = row;
    slot.col = col;
    slot.elapsedMs = 0;
    slot.armedAtMs = now;
    this._sfx(AUDIO_CLIP_DENIED);
  }

  /**
   * G7 轻压推进：与 `_stepPlaceFx` 同判例——表现层，不被 PAUSED 冻结。只推进在播槽；
   * 播完**不清 row/col**（同格门 250ms 需要死窗记忆），零残留由 `_syncSnapshot` 的
   * 在播过滤保证。
   */
  private _stepDeniedFx(dt: number): void {
    const step = Math.max(0, dt) * 1000;
    if (step === 0) return;
    const slots = this._deniedFx;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]!;
      if (s.row >= 0 && s.elapsedMs < DENIED_PRESS_MS) s.elapsedMs += step;
    }
  }

  /**
   * G2′ 起播（`assets-spec §1.6.2a`）：`usePowerup` 只点名，本方法建队列。
   * 数组**一次性定长**分配（`SOLVER_MAX_CELLS` / ×2）⇒ 逐帧只写值。
   * 非每帧路径（道具点击帧）⇒ 允许分配。
   */
  private _armSolverFx(cells: readonly { row: number; col: number }[]): void {
    const n = cells.length < SOLVER_MAX_CELLS ? cells.length : SOLVER_MAX_CELLS;
    if (n === 0) return; // `empty`/`invalid` 已由调用方早退；防御性不建空序列
    const cellRows = new Array<number>(SOLVER_MAX_CELLS).fill(-1);
    const cellCols = new Array<number>(SOLVER_MAX_CELLS).fill(-1);
    for (let i = 0; i < n; i++) {
      cellRows[i] = cells[i]!.row;
      cellCols[i] = cells[i]!.col;
    }
    this._solverFx = {
      elapsedMs: 0,
      totalMs: solverSequenceMs(n),
      count: n,
      step: 0,
      solved: 0,
      cellRows,
      cellCols,
      landCount: 0,
      landRows: new Array<number>(SOLVER_MAX_CELLS * 2).fill(-1),
      landCols: new Array<number>(SOLVER_MAX_CELLS * 2).fill(-1),
      landSteps: new Array<number>(SOLVER_MAX_CELLS * 2).fill(-1),
    };
  }

  /**
   * G2′ 推进（相 A → 相 B）。**不是表现层步进**（与 `_stepPlaceFx` / `_stepSweepFx` 的
   * 「不被 PAUSED 冻结」判例相反）：
   *  - `paused` ⇒ **冻结不作废**（道具已扣次，不该因一次暂停丢掉归位）；
   *  - 其他非 `playing` 相位（过关 / 失败 / 面板）⇒ 作废队列，不再动棋盘；
   *  - 逐颗执行按到点时刻 `SOLVER_HINT_MS + SOLVER_STAGGER_MS × step`，`while` 追帧
   *    （大 dt / 后台回前的多帧补齐 ⇒ 不会漏执行）；
   *  - 过关判定排在**序列末**（整条落座动画放完才进 G4 庆祝，裁定 1 同族）。
   */
  private _stepSolverFx(dt: number): void {
    const fx = this._solverFx;
    if (!fx) return;
    const phase = this._machine.current;
    if (phase === 'paused') return;
    if (phase !== 'playing') {
      this._solverFx = null;
      return;
    }
    fx.elapsedMs += Math.max(0, dt) * 1000;
    while (fx.step < fx.count) {
      if (fx.elapsedMs < SOLVER_HINT_MS + SOLVER_STAGGER_MS * fx.step) break;
      // 预警窗口内玩家可能已自行取走该珠 ⇒ 静默跳过（不警告、不补动画）。
      if (this._solveMisplaced(fx.cellRows[fx.step]!, fx.cellCols[fx.step]!, fx, fx.step)) {
        fx.solved++;
      }
      fx.step++;
    }
    if (fx.elapsedMs < fx.totalMs) return;
    this._solverFx = null;
    if (fx.solved === 0) {
      // 点名却无一可归位（几何上不应发生，除非玩家刚好全取走）⇒ 记警告供回归排查。
      console.warn(`[beads] S6 解环器点名 ${fx.count} 格、实际归位 0 格`);
      return;
    }
    // 归位后可能达成零错位 ⇒ cleared-priority（core-loop §2.2.2）。
    if (this._grid.isComplete()) {
      if (this._mode === 'sprint') this._completeStage();
      else this._machine.transition('level-clear');
    }
  }

  /**
   * G3 起播（`assets-spec §1.6.3`）。**无重启门**（与 G1 不同：本卡只一个标量、无逐格错开，
   * 400ms 内再触发 = 从头再扫一次；规格里也没给门值 ⇒ 不自行发明）。
   * WXG-T-173 / U11 丁裁（2026-09-18）：扫光起点 = **按下帧**（全库唯一调用点 = `powerup:used` 同栈
   * `:1022`，区外道具卡本就按下即提交），不随棋盘区 tap 按下→抬起后移；与 `core-loop v2.2 §8` 注② 一致。
   */
  private _armSweepFx(): void {
    this._sweepElapsedMs = 0;
  }

  private _stepSweepFx(dt: number): void {
    if (this._sweepElapsedMs < 0) return;
    this._sweepElapsedMs += Math.max(0, dt) * 1000;
    if (this._sweepElapsedMs >= SWEEP_MS) this._sweepElapsedMs = -1;
  }

  /** G6 推进（同 `_stepSweepFx` 判例：单标量、到点自清 ⇒ 零残留）。 */
  private _stepConfettiFx(dt: number): void {
    if (this._confettiElapsedMs < 0) return;
    this._confettiElapsedMs += Math.max(0, dt) * 1000;
    if (this._confettiElapsedMs >= CONFETTI_MS) this._confettiElapsedMs = -1;
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
    // Camera-scaled spacing/size so the render path matches `hitGridCell` exactly
    // at any zoom (丁-3). = BEAD_PITCH/BEAD_CELL at identity → snapshot byte-identical.
    s.gridPitch = this._layout.pitch;
    s.gridCell = this._layout.cell;

    // S6 cards: remaining free uses per powerup (0 ⇒ the view dims the card and
    // leans on the always-on ad_badge, §2.6) + the one-shot over-limit hint.
    s.powerupFreeUses.solver = this._powerups.uses.solver;
    s.powerupFreeUses.solverPlus = this._powerups.uses.solverPlus;
    s.powerupFreeUses.solverRandom = this._powerups.uses.solverRandom;
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
    // WXG-T-148 ③：连通组快照（预分配容量，写值不新建 —— 热路径零分配）。
    const grp = this._boardSelected?.cells;
    s.boardGroupCount = grp ? Math.min(grp.length, s.boardGroupRows.length) : 0;
    if (grp) {
      for (let gi = 0; gi < s.boardGroupCount; gi++) {
        s.boardGroupRows[gi] = grp[gi]!.row;
        s.boardGroupCols[gi] = grp[gi]!.col;
      }
    }
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
    s.vibrate = this._vibrate;

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
    // G1 落座回弹：与 wrong 同构，只给格心 + 单调进度（曲线在 view 侧纯函数推导，L5）。
    const pfx = this._placeFx;
    s.placeRow = pfx ? pfx.row : -1;
    s.placeCol = pfx ? pfx.col : -1;
    s.placeProgress = pfx ? Math.min(1, pfx.elapsedMs / FILL_POP_MS) : 0;
    // G7 轻压：多格并存 ⇒ 定长数组逐槽导出，**仅在播槽**可见（120ms 后零残留；
    // 过窗槽只留同格门记忆，不占快照）。曲线在 view 侧纯函数推导（L5）。
    let deniedActive = 0;
    for (let i = 0; i < DENIED_MAX_CELLS; i++) {
      const dfx = this._deniedFx[i]!;
      const active = dfx.row >= 0 && dfx.elapsedMs < DENIED_PRESS_MS;
      s.deniedRows[i] = active ? dfx.row : -1;
      s.deniedCols[i] = active ? dfx.col : -1;
      s.deniedProgress[i] = active ? Math.min(1, dfx.elapsedMs / DENIED_PRESS_MS) : 0;
      if (active) deniedActive++;
    }
    s.deniedCount = deniedActive;
    // G2′ 解环器：一条单调进度 + 两组定长格坐标（相序曲线在 view 侧推导，L5）。
    // 不活跃 ⇒ count 归零且数组填 -1（零残留，同 G1 槽置 null 口径）。
    const sfx = this._solverFx;
    s.solverProgress = sfx ? Math.min(1, sfx.elapsedMs / sfx.totalMs) : 0;
    s.solverCellCount = sfx ? sfx.count : 0;
    s.solverLandCount = sfx ? sfx.landCount : 0;
    for (let i = 0; i < s.solverCellRows.length; i++) {
      s.solverCellRows[i] = sfx ? sfx.cellRows[i]! : -1;
      s.solverCellCols[i] = sfx ? sfx.cellCols[i]! : -1;
    }
    for (let i = 0; i < s.solverLandRows.length; i++) {
      s.solverLandRows[i] = sfx && i < sfx.landCount ? sfx.landRows[i]! : -1;
      s.solverLandCols[i] = sfx && i < sfx.landCount ? sfx.landCols[i]! : -1;
      s.solverLandSteps[i] = sfx && i < sfx.landCount ? sfx.landSteps[i]! : -1;
    }
    // G3 扫光：只一条单调进度（斜带几何与缓动在 view 侧推导，L5）。
    s.sweepProgress =
      this._sweepElapsedMs < 0 ? 0 : Math.min(1, this._sweepElapsedMs / SWEEP_MS);
    // G6 彩带：同样只一条单调进度（44 枚分布与逐帧几何在 view 侧推导，L5）。
    s.confettiProgress =
      this._confettiElapsedMs < 0 ? 0 : Math.min(1, this._confettiElapsedMs / CONFETTI_MS);
    // G4 波浪：全场逐列 ⇒ 一条单调进度（列错峰与曲线在 view 侧推导，L5）。
    s.waveProgress =
      this._waveElapsedMs < 0 ? 0 : Math.min(1, this._waveElapsedMs / WAVE_MS);
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
