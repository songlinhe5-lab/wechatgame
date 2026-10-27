/**
 * BeadsGame — the authoritative gameplay state (NOT a framework `Game` any
 * more: since WXG-T-420 T9 the render leg belongs to the shell + assembly
 * layer, so `BeadsShell` is the one that satisfies the framework contract).
 *
 * Architecture in one paragraph: the class owns the *authoritative state*
 * (pattern grid, tray, countdown, sprint tracker, phase
 * machine). Systems (`placement` / `timer` / `sprint`) are pure
 * mechanics that return outcomes; this class applies them and broadcasts the
 * registered events. Subscriptions live in `_subscribe()`, unwound in
 * `dispose()`. WXG-T-420 T9: reading `snapshot` only projects state into the
 * flat read-model — this class no longer draws anything (the `buildBeadsView`
 * binding lives in the assembly layer `ui/play-binding.ts`), which makes
 * "UI holds no game state" true by construction **and** lets Node run gameplay
 * tests without loading the view layer.
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
 *
 * ── 模块地图（拆分后的协作类，均在 `beads-game/` 下；BeadsGame 为编排者）──
 *  - `bead-conservation.ts`     珠色守恒哨兵（只报告，不回滚）。
 *  - `game-settings.ts`         设置值 / 音频通道 / 设置动作（持久化一次写入）。
 *  - `board-camera-controller.ts` 棋盘相机、缩放、手势与棋盘 tap 的计量入口。
 *  - `feedback-fx.ts`           反馈特效时钟（连击 / 脉冲 / 抬起 / 各反馈计时）。
 *  - `crash-snapshot-io.ts`     D-03 崩溃快照的写入 / 清档 / 恢复与校验。
 *  - `input-router.ts`          输入协议：每帧读输入、抬起提交门、计量。
 *  - `hud-router.ts`            PLAYING 界面控件分派（缩放 / 齿轮 / 道具卡 / 展开）。
 *  - `panel-router.ts`          面板相位分派（PAUSED / LEVEL_CLEAR / FINISH / GAME_OVER）。
 *  - `board-tap-router.ts`      托盘 / 网格点击分派（选取 / 取回 / 归位 / 直填）。
 *  - `control-map.ts`           控件映射（按下腿命中 / 按下态 / 面板选项，只读）。
 *  - `hit-test.ts`              无状态命中几何（齿轮 / 道具卡 / 展开 / 托盘槽）。
 *  - `effects-dispatch.ts`      效果派发：音频订阅 / 触觉映射 / 广告点火 / 分享透传（无状态）。
 *  - `snapshot-projection.ts`   快照投影：权威态 → `BeadsSnapshot` 原地写回（无状态，`_syncSnapshot` 逐帧委派）。
 *  投影之外另有**组装层** `../ui/play-binding.ts`（WXG-T-420 T9）：快照 → `buildBeadsView` 的
 *  绑定在此，`game/` 不再运行时引 `view/`。
 *  留在本类：状态机（`_buildStateMachine`）、托盘锚归位裁决（`_placeSelected`）、
 *  解环器表现（`_armSolverFx` / `_stepSolverFx`）、
 *  BOOT / 订阅 / 装配（`_boot` / `_subscribe` / `_setupLevel`）。
 */

import {
  REWARDED_PLACEMENT,
  SaveManager,
  StateMachine,
  type AudioVoices,
  type GameServices,
  type RankBoard,
} from '../../framework/index';

import {
  AUDIO_CLIP_DENIED,
  AUDIO_CLIP_PANEL_IN,
  AUDIO_CLIP_PANEL_OUT,
  AUDIO_CLIP_REJECT,
  AUDIO_CLIP_REVIVE_OK,
  AUDIO_CLIP_STAR,
  AUDIO_CLIP_UI_TAP,
  DEFAULT_TUNING,
  DESIGN_H,
  REVIVE_BONUS_SEC,
  REVIVE_MAX_PER_LEVEL,
  COMBO_WINDOW_S,
  SELECT_LIFT_MS,
  STAMINA_REFILL_PLACEMENT,
  STAGE_BONUS_TIME,
  computeClearStars,
  nextTierFor,
  tierSecondsFor,
  normalSettleScore,
  POWERUP_BUY_DENIED_HINT,
  SOLVER_HINT_MS,
  SOLVER_MAX_CELLS,
  SOLVER_STAGGER_MS,
  solverSequenceMs,
  gridLayoutFor,
  hitGridCell,
  menuAnchors,
  nextBeadLod,
  type BeadSizeKind,
  isBossLevelId,
  stageParamsFor,
  validatedSprintTime,
  type BeadsTuning,
  type GridLayout,
  type PowerupType,
} from '../config/tuning';
import { BEADS_AUDIO_VOICES } from '../config/audio-voices';
import {
  LEVELS,
  buildStagePattern,
  decoyColorIndices,
  levelIdOf,
  levelIdentityKeys,
  validateBeadsLevel,
  type BeadsLevelRaw,
} from '../config/levels';
import { applyMisplacedToGrid } from './misplaced-assembler';
import { collectMisplacedGroup } from '../entities/grid';
import { BeadGrid } from '../entities/grid';
import { Tray } from '../entities/tray';
import {
  PowerupSystem,
  type AffectedCell,
  type MisplacedBead,
  type PowerupInputs,
  type PowerupOutcome,
  type TrayBead,
  type TrayMove,
} from '../systems/powerups';
import { hitBuyConfirm } from '../systems/buy-confirm-panel';
import { FinishPanel, } from '../systems/finish-panel';
import { SprintSettlePanel, } from '../systems/sprint-settle';
import { comboVfxSpec, type ComboVfxKind } from '../systems/combo-vfx';
import {
  ClearPanel,
} from '../systems/clear-panel';
import { judgeRetrieve } from '../systems/retrieve';
import { judgePlacement, planGroupFill } from '../systems/placement';
import { planConsumeOrder } from '../systems/consume-order';
import { Spawner } from '../systems/spawner';
import { GameTimer } from '../systems/timer';
import { SprintTracker, tierForStreak } from '../systems/sprint';
import { PausePanel, type PausePanelAction } from '../systems/pause-panel';
import {
    RankPanel,
    rankTheme,
    type RankPanelAction,
    type RankPanelView,
} from '../systems/rank-panel';
import {
  PHASE_TRANSITIONS,
  createSnapshot,
  type BeadsPhase,
  type BeadsSnapshot,
  type ColorCueMode,
  type GameMode,
} from './state';
import {
  BEADS_MIGRATIONS,
  SAVE_KEY,
  SAVE_VERSION,
  bootLevel,
  collapseStars,
  defaultBeadsSave,
  flattenStars,
  normalizeBeadsSave,
  preserveCorruptBackup,
  toBeadsSavePatch,
  type BeadsSave,
} from './save-schema';
import type { BeadsPalette } from '../view/palette'; // WXG-T-420 T9：只取类型作字段面，渲染绑定已上移
// **EP12-S8**：整套皮肤的注册真源（注册序即循环序；`DEFAULT_SKIN_ID` = 默认肤，⛔ 不另写字面量）。
import { DEFAULT_SKIN, DEFAULT_SKIN_ID, skinById } from '../config/skins/registry';
import type { UiDebugState } from '../ui/ui-host';
import type { BeadsEvents, BeadsGameOptions } from './beads-game-types';
import type { ClearCoinGrant } from './meta-state';
import { BeadConservation } from './beads-game/bead-conservation';
import { GameSettings } from './beads-game/game-settings';
import { BoardCameraController } from './beads-game/board-camera-controller';
import { FeedbackFx } from './beads-game/feedback-fx';
import { CrashSnapshotIO } from './beads-game/crash-snapshot-io';
import { InputRouter } from './beads-game/input-router';
import { PanelRouter } from './beads-game/panel-router';
import { HudRouter } from './beads-game/hud-router';
import { BoardTapRouter, type BoardAnchor } from './beads-game/board-tap-router';
import { ControlMap } from './beads-game/control-map';
import { hitTraySlot } from './beads-game/hit-test';
import {
  attachAudioCues,
  fireRewardedAd,
  fireShare,
  hapticKindFor,
} from './beads-game/effects-dispatch';
import { projectSnapshot, type SnapshotSource } from './beads-game/snapshot-projection';

/**
 * 公共契约类型（事件表 `BeadsEvents` + 构造选项 `BeadsGameOptions`）已抽至
 * `./beads-game-types.ts`；此处再导出，保持既有导入路径（`beads-shell.ts` 等）不变。
 */
export type { BeadsEvents, BeadsGameOptions };

// **EP12-S9**：未注册 skin 引用的一次性告警门（判例 = `palette.ts` 的 B2 兜底告警族：
// 布尔门先行 ⇒ 命中路径零分配，且不逐条刷噪声）。测试可经 `resetSkinImportWarnings` 复位。
let warnedUnregisteredSkin = false;
function warnUnregisteredSkin(id: string): void {
  if (warnedUnregisteredSkin) return;
  warnedUnregisteredSkin = true;
  console.warn(
    `[beads] importLevel: levelDraft.skin "${id}" 未在皮肤注册表内 ⇒ 不采信（K-064），回落默认肤 ${DEFAULT_SKIN_ID}；本条仅告警一次`,
  );
}
/** **测试专用**：复位皮肤导入一次性告警门（生产不调）。 */
export function resetSkinImportWarnings(): void {
  warnedUnregisteredSkin = false;
}

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

/** 结算面板选项两档常量（命中/按下态每帧查表 ⇒ ⛔ 不逐次造对象）。 */

/**
 * 权威玩法态（WXG-T-420 T9：不再 `implements Game` —— 去掉了 `buildRenderModel` 这条腿，
 * 框架 `Game` 契约由 `BeadsShell` 承担；`createBeadsGame` 因此**不再可直接 drop-in** 给
 * `App`，须经壳或自行接上 `ui/play-binding.ts` 的渲染腿）。
 */
export class BeadsGame {
  readonly id = 'beads';
  readonly tuning: BeadsTuning;
  /**
   * UI 令牌实例（渲染链唯一消费面：`buildBeadsView` 逐参传递，下游零改动）。
   * **EP12-S8**：不再是构造期常量——换肤 = **换引用**（arch.md D2：`this.palette =
   * skin.tokens`，⛔ 禁 `Object.assign` 全局突变），下一帧生效、零过渡。
   * 初值 = `options.palette ?? DEFAULT_SKIN.tokens`（默认肤 tokens 直引
   * `DEFAULT_PALETTE` ⇒ 不传时渲染逐字节不变，T-267 mvp A1）。
   */
  palette: BeadsPalette;
  /**
   * clip → 合成配方（数值全为**工程占位**，见 `config/audio-voices.ts` 头注）。
   * App 把它转交给 `Platform.createAudioBackend()`，框架不持有玩法音色库（ADR-0013）。
   */
  readonly audioVoices: AudioVoices = BEADS_AUDIO_VOICES;

  private _levels: readonly BeadsLevelRaw[];
  private readonly _saveKey: string;
  /** 测试专用开关：见 {@link BeadsGameOptions.noBootAssembly}。 */
  private readonly _noBootAssembly: boolean;
  private readonly _machine: StateMachine<BeadsGame, BeadsPhase>;
  private readonly _snapshot: BeadsSnapshot;
  /**
   * 快照投影的读访问宿主（WXG-T-420 T6）：构造期一次性装配的 getter 对象，逐帧交
   * `projectSnapshot` 只读 ⇒ 既授予私有读访问又不公开成员，且宿主本身零分配。
   */
  private readonly _snapshotSource: SnapshotSource;
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
   * 待确认的豆子购买（`ux-spec §3.7`，§3.6 v1.80 出口）：非 null ⇒ 确认弹窗打开，
   * 期间**全控件不响应**（模态）；确定才扣豆，取消/板外/换关/重试即清。
   */
  private _pendingBuy: PowerupType | null = null;
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
  /**
   * 每关**历史最佳品质分**（C7 结算分，ADR-0035 §3.2.1 ①；Q1 = B 品质分单榜）。
   * 权威在存档 `settleBestByUid`，本字段是内存镜像（同 `_starsByLevel` 判例）：
   * BOOT 装载、通关帧取 `max(旧, 新)`、随 `_persistProgress()` 写回。
   * 键 = 关卡稳定身份 token（同一根 `_levelKeys` 轴）；稀疏 ⇒ 无条目 = 未通关。
   */
  private _settleBestByUid: Record<string, number> = {};
  /**
   * 关表的**稳定身份轴**只读镜像（ADR-0034 **DEC-3**）：第 i 项 = 第 i 关的存档记账 token，
   * 与 `_levels` 同生命周期。星账的 uid↔index 换算只发生在**既有两个边界点**
   * （BOOT 读档展平 / `_persistProgress` 收拢），各恰一次；本镜像**只在关表装配处**构造
   * （下方 BOOT 与 `importLevel` 两处）。⛔ 视图 / 结算 / 每帧路径不得再构造——那会
   * 重新开出一条「按存档长度反推关身份」的第二条读取路径（`save-progress v1.3 §8-22-④` 静态臂）。
   * L5：它是关表的派生只读镜像，**不是游戏状态**；无身份槽取 `''`（dev 导入草案，不入档）。
   */
  private _levelKeys: readonly string[] = [];
  /**
   * 本局所打档位（§3.7 v1.50）。**选档即定星**：过关星级 = 本值，与剩余时间占比无关。
   * 由 `_setupLevel` 按双条件闸门推导（(a) 本关前一档已过 ∧ (b) 上一关同档已过，首关豁免 (b)）。
   * 冲刺模式不走关卡档位 ⇒ 本值不影响 sprint 结算（sprint 无星）。
   */
  private _tierThisLevel = 1;
  /** 本局档位（1/2/3）。view / 测试只读。 */
  get tierThisLevel(): number {
    return this._tierThisLevel;
  }
  /** 已触发过入场音效的**关数**（每关一次，逐关 150ms）。 */
  private _finishRowsAnnounced = 0;
  /**
   * P0-1 本章收尾：FINISH 总览展示到哪一关（0-based，含）。`-1` = 未进本章结算
   * ⇒ 退回全表长度（旧口径）。章界真源 = `arcs.ts::ARCS[].levelRefs` ⇒ `isBossLevelId`。
   */
  private _finishEndIndex = -1;
  /**
   * S7 冲刺结算面板（`ux-spec §3.5` **左列**，WXG-T-067）：冲刺归零时复用 `GAME_OVER`
   * 相位展示「单局 / 最高梯位 / 最高连击」+ 双钮（再来一局 / 返回关卡），且**不出现**
   * 续时主钮（§3.5 明文）。
   */
  private readonly _sprintSettle = new SprintSettlePanel();
  /**
   * 好友榜面板占位（ADR-0035 §5.2 S-3）。theme 在构造期由 palette 派生；
   * 宿主 Provider 由 `init(services)` attach。
   */
  private readonly _rankPanel: RankPanel;
  /** 反馈特效时钟（协作类，见 beads-game/feedback-fx.ts）：连击 / 脉冲 / 抬起 / 各反馈计时全归其内。 */
  private readonly _fx: FeedbackFx;
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
  /** 庆祝放完后待开的结算面板（避免离场后残留门在别的相位把面板掀开）。 */
  private _clearPanelPending = false;
  /** 珠色守恒哨兵（T-244 二十二批）：状态与比对全在协作类里，见 `./beads-game/bead-conservation.ts`。 */
  private readonly _conservation: BeadConservation;
  /** 首屏引导已完成（老玩家 BOOT 即 true；首次玩家首次落子后置 true）。一置不再重现。 */
  /**
   * **[WXG-T-239 · 2026-10-04 用户裁「先把新手引导留档，实现上先屏蔽掉，后期统一调整」]**
   * GAP-03/04 首屏引导**总开关 —— 当前 = `false`（屏蔽显示，设计与规格全部留档）**。
   *
   * ## 屏蔽的是什么
   * 仅「**引导的显示**」：目标格呼吸框（`drawStateRing` + `palette.hintBlue` #3D7BF5，
   * α 0.5↔1 循环 ⇒ 用户观感「闪烁蓝框」）与托盘首珠槽呼吸框，两处同时闪。
   *
   * ## ⛔ 明确没动的（留档，保后期可原样恢复）
   * - **规格与留档全在**：`production/qa/beads/` 与 `ux-spec §6.3`（GAP-03/04）**一字未删**。
   * - `_onboardDone` 判定链**未动**：仍从 `save.data.onboarded` 读、首次落子仍落盘 `onboarded: true`。
   * - `hintRow` / `hintCol` / `guideSlot` / `firstColor` 的**算法**未动（仅因 `onboarding === false` 而不执行）。
   * - 「减弱动效」时呼吸转静态（α=1）的分支未动。
   *
   * ## 恢复时必须知道的两件事（⚠ 屏蔽期间产生的状态）
   * 1. **屏蔽期落子照旧写 `onboarded: true`**（本文件首次落子处）⇒ **恢复后老玩家不会看到引导**
   *    （这本身合理：引导只给新玩家）。⛔ 但**内部要看效果必须清存档**或手动把
   *    `onboarded` 置 `false`，否则「恢复后没人看到引导」会被误判为功能坏了。
   * 2. **既有缺陷（本次不修，留档）**：`this._onboardDone = save ? save.data.onboarded : true`
   *    —— **无存档时默认 `true`（不引导）** ⇒ 「卸载重装 / 清缓存后首次进入」拿不到首玩提示。
   *    若后期统一调整引导，应一并修（无 save 时应默认 `false`）。
   *
   * ## 后期统一调整时的建议（本批不做）
   * 弱化而非删除更稳（用户尚未裁「彻底去掉」）：呼吸幅度 `0.5↔1` → `0.75↔1`，
   * 或周期 `HINT_PULSE_MS` 放慢；再或只保留托盘槽那处、去掉盘面目标格那处。
   * ⇒ **本开关只做「显示与否」，不做参数化**；参数化留待统一调整时一次做完。
   */
  private static readonly ONBOARDING_ENABLED = false;

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
  /** 棋盘相机 + 手势（协作类；ADR-0015 丁-3 相机真源在其内，本类只读 `camera`）。 */
  private readonly _board: BoardCameraController;
  /** 输入协议（按下/抬起提交门、计量、指针缓存）；控件映射与分派仍在本类，见 beads-game/input-router.ts。 */
  private readonly _input: InputRouter;
  /** 面板相位的点击路由（协作类，见 beads-game/panel-router.ts）。 */
  private readonly _panelRouter: PanelRouter;
  /**
   * `[WXG-T-440 / ADR-0033 边界②]` 面板命中委托（壳在 `init` 后注入 = `UiRoot` 栈顶 presenter）。
   * 未注入（Node 侧直调 `tapDesign` 的用例）⇒ 回落自带 {@link _panelRouter}，行为逐字不变。
   */
  private _panelHit: ((phase: BeadsPhase, x: number, y: number) => boolean) | null = null;
  /** UI 控件映射（命中 / 按下态 / 面板选项；协作类，见 beads-game/control-map.ts）。 */
  private readonly _controls: ControlMap;
  /** PLAYING 托盘 / 网格点击的分派（协作类，见 beads-game/board-tap-router.ts）。 */
  private readonly _boardTaps: BoardTapRouter;
  /** PLAYING 相位界面控件（缩放 / 齿轮 / 道具卡 / 展开按钮）的路由（协作类，见 beads-game/hud-router.ts）。 */
  private readonly _hud: HudRouter;
  /** `[WXG-T-295 续]` 顶部安全区深度（设计 px，距屏顶）；仅小游戏宿主取值，其余 0。 */
  private _safeTop = 0;
  /** 胶囊底缘深度（设计 px，距屏顶）；HUD 带顶缘 = 设计高 − 本值。仅小游戏宿主取值。 */
  private _capsuleBottom = 0;
  /** 底部安全区深度（设计 px，距屏底）；仅小游戏宿主取值。 */
  private _safeBottom = 0;
  private _layout: GridLayout = gridLayoutFor(6, 5);

  private _services: GameServices | null = null;
  private _save: SaveManager<BeadsSave> | null = null;
  /**
   * 解锁位 / 续玩位的 **0-based 下标镜像**（S-2b / DEC-7）：身份 token 只住档内，
   * 运行时一律吃下标（视图契约 L5 零改动）。两值只由两处写：BOOT 归一、
   * `_persistProgress` 推进（后者只增不减，I7 棘轮）。
   */
  private _maxUnlockedIndex = 0;
  private _lastPlayedIndex = 0;
  /** D-03 崩溃恢复档 IO（另键 sidecar，WXG-T-059；与 S8 常规档物理隔离）。协作类见 beads-game/crash-snapshot-io.ts。 */
  private readonly _crashIO: CrashSnapshotIO;

  private _mode: GameMode = 'normal';
  /**
   * **[WXG-T-434] 归位连击（普通模式 · 纯感官）** — MVP 验收线项，`concept §7` /
   * changelog v1.23「MVP 追加归位连击（纯感官 streak，零 HUD 数字）」。
   *
   * 与冲刺连击**共用阈值、不共用计分**：窗口 `COMBO_WINDOW_S` 与档位
   * `COMBO_STREAK_TIERS`（§3.10 C2/C3）经 {@link tierForStreak} 复用 ⇒ **零新常量**；
   * ⛔ 但不算分、不乘倍率、不上 HUD（`play-page` 的 `×M COMBO n` 恒为冲刺专属）。
   * 表现走既有三档特效（`comboVfxSpec`）+ 既有 combo 音（`effects-dispatch` 监听
   * `combo:up` / `combo:break`）。普通模式 `combo:up.multiplier` 恒发 1。
   */
  private _placeStreak = 0;
  /** 归位连击窗口剩余秒（0 = 无活跃 streak）。 */
  private _placeWindow = 0;
  /** 归位连击当前档位（0 = 无）；只在**升档**那一颗触发特效（与冲刺 `tierUp` 同门）。 */
  private _placeTier = 0;
  /**
   * 本批落子待发的**最高档**（0 = 无）。
   * ⛔ 不在 `_armPlaceCombo` 里直接 emit：组填充一次可连升多档，同帧 3 个 combo clip 会
   * 挤占 `AudioScheduler.maxPerFrame`（6）而把同帧的 `sfx_panel_in` 挤出预算
   * （A05-18 实测：过关面板音丢失）。同批只发最高档 —— 与冲刺「重叠时只播最高档」同口径。
   */
  private _placePendingTier = 0;
  private _placePendingRow = 0;
  private _placePendingCol = 0;
  /**
   * 帧序号（`update()` 每次 ++）。归位连击用它做**同帧只响一次**的守卫：
   * 一帧内连升 3 档对听觉无意义，却会各占一个 `AudioScheduler` 名额（`maxPerFrame` = 6）
   * ⇒ 把同帧的 `sfx_panel_in` 挤出预算（A05-18 判据实测）。
   */
  private _frameSeq = 0;
  /** 上一次真正发出 `combo:up` 的帧序号（-1 = 从未）。 */
  private _placeUpFrame = -1;
  private _levelIndex = 0;
  private _stageIndex = 0;
  /** Validated sprint run length = also the stage-bonus cap (C1 + §8-7). */
  private _sprintCap = DEFAULT_TUNING.sprintTime;
  private _sprintBestScore = 0;
  private _sprintBestStage = 0;
  private _isNewBest = false;
  /** S9 设置值镜像 + 音频通道 + 换肤单点（协作类，见 beads-game/game-settings.ts）。 */
  private readonly _settings: GameSettings;
  /** DEBUG 虚线轮廓开关（不持久化；仅 dev/harness 与 Console 临时开，走 snapshot 暴露给 view）。 */
  private _debugOutlines = false;
  /** DEBUG：帧耗时 EMA（ms，α=0.1）；覆层关闭不更新、恒 0，view 派生 fps。 */
  private _frameMs = 0;
  /** 暂停面板「回主菜单」回调（options.onMenuRequest；无 shell 时 undefined）。 */
  private readonly _onMenuRequest?: () => void;
  /** 新局开局体力闸门（options.canStartRun；无 shell 时 undefined ⇒ 不设门）。 */
  private readonly _canStartRun?: () => boolean;
  /** 广告加心发奖回调（options.onStaminaRefill；无 shell 时 undefined）。 */
  private readonly _onStaminaRefill?: () => void;
  /** 广告加心是否还可用（options.canWatchStaminaAd；日限/满心闸门，无 shell 时 undefined ⇒ 不设门）。 */
  private readonly _canWatchStaminaAd?: () => boolean;
  /** 道具超限豆子购买闸门（options.onPowerupPurchase；无 shell 时 undefined ⇒ 占位提示）。 */
  private readonly _onPowerupPurchase?: (type: PowerupType) => boolean;
  /** 免费腿用掉即落档（options.onPowerupFreeSpent；无 shell 时 undefined ⇒ 不落档）。 */
  private readonly _onPowerupFreeSpent?: (depleted: Readonly<Record<PowerupType, boolean>>) => void;
  /** 结算发豆（options.onClearCoins；无 shell 时 undefined ⇒ 面板不显示该行）。 */
  private readonly _onClearCoins?: (stars: number, isBoss: boolean, prevStars: number) => ClearCoinGrant | undefined;
  /**
   * 跨章推进闸门（options.canAdvanceAcrossArc；无 shell 时 undefined ⇒ 不设门、行为逐字不变）。
   * S-4：只在**章界那一刻**参与解锁位推进（I7 棘轮），⛔ 参与门票归约本体。
   */
  private readonly _canAdvanceAcrossArc?: (fromIndex: number, toIndex: number) => boolean;
  /**
   * 皮肤买断拥有态（options.ownsSkin；WXG-T-363）：无 shell 时 `undefined` ⇒ **不设门**，
   * 穿/循腿行为逐字回到注入前。受理单点仍在 `GameSettings`（本类只负引用转交）。
   */
  private readonly _ownsSkin?: (skinId: string) => boolean;
  /** 在飞广告种类：区分续时（revive）/ 广告加心（staminaRefill）/ 托盘扩容（trayExpand）的发奖路由。 */
  private _adKind: 'revive' | 'staminaRefill' | 'trayExpand' | null = null;
  /**
   * 弃局标（EP13-S3）：`showMenu`（暂停次钮回主菜单）置真，新局装配（两装配入口共经
   * {@link _clearReviveBookkeeping}）清假。广告发奖是**广播**，续时腿只认机器状态；
   * 无此标 ⇒ 「上局失败 → 回菜单 → 看体力广告」会被拉回旧失败盘白得加时。
   */
  private _abandoned = false;
  /** 0 心被拒时挂起的 run-start 续体（广告加心后重放 retry/restart）。 */
  private _pendingRunStart: (() => boolean) | null = null;
  /** BOOT validation errors — non-empty means the game refuses PLAYING. */
  private _bootErrors: string[] = [];

  /** 手指按住处的面板钮 id（无 ⇒ null）；每帧由 {@link _pressedButtonNow} 刷新。 */
  private _pressedButton: string | null = null;
  /**
   * 统一选择锚 · board 侧（input-control §2.1 v2.0，Epic T-133 E2）。`null` = 无
   * board 锚。与托盘的 `selected` 槽位态（S4）**三值互斥**：`selection ∈ {tray,
   * board, none}` 至多一侧非空——建立一侧时必须清除另一侧（换选即转移，不叠选）。
   * 生命周期 = PLAYING 局内态：`_setupLevel` / `_loadStage` 重置；不在崩溃快照里
   * （恢复后锚 = tray-or-none，与 traySelected 同批管理，E5 扩错位珠色时再议）。
   */
  /**
   * board 锚：起点 + 错位珠组的**消费序**缓存（拾取时一次算好）。
   * 【WXG-T-157 用户裁定】组 = 8 向两步（切比雪夫 ≤2）**同色**错位珠（原 WXG-T-148 ③
   * 「8 邻接 flood fill 不限色不限距」作废）；规则 2 直填后**组保持**（逐颗续填）：
   * 被填珠移出 `order`，锚珠被填 ⇒ 头珠（`row/col`）静默转移到剩余序首（快照坐标下一帧跟随）。
   * 【用户裁定 2026-09-20 · 选豆点固定】`anchorRow/anchorCol` = **拾取那一下的坐标**，
   * 填珠/收纳全程不改——它是消费序的 BFS 根，序本身只在拾取时算一次；`row/col` 只是展示用
   * 「当前头珠」，可随转移漂移，**不参与**排序。
   * 【WXG-T-186 用户裁定】`order` = `planConsumeOrder` 剥皮序（沿组连通的图上距离 ⇒
   * 不吃割点 ⇒ 同层押后引路珠），**直填与取回落槽共用同一份序**；推翻 v2.4（WXG-T-183）
   * 的「距选豆点切比雪夫」几何口径。
   */
  private _boardSelected: BoardAnchor | null = null;

  constructor(options: BeadsGameOptions = {}) {
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    // EP12-S8：默认肤 tokens 直引 DEFAULT_PALETTE ⇒ 不传 options.palette 时渲染逐字节不变。
    this.palette = options.palette ?? DEFAULT_SKIN.tokens;
    this._rankPanel = new RankPanel({ theme: rankTheme(this.palette) });
    this._saveKey = options.saveKey ?? SAVE_KEY;
    this._levels = options.levels ?? LEVELS;
    this._noBootAssembly = options.noBootAssembly ?? false;
    this._onMenuRequest = options.onMenuRequest;
    this._canStartRun = options.canStartRun;
    this._onStaminaRefill = options.onStaminaRefill;
    this._canWatchStaminaAd = options.canWatchStaminaAd;
    this._onPowerupPurchase = options.onPowerupPurchase;
    this._onPowerupFreeSpent = options.onPowerupFreeSpent;
    this._onClearCoins = options.onClearCoins;
    this._canAdvanceAcrossArc = options.canAdvanceAcrossArc;
    this._ownsSkin = options.ownsSkin;

    this._sprintCap = validatedSprintTime(options.sprintTime);
    if (options.sprintTime !== undefined && this._sprintCap !== options.sprintTime) {
      // C1: out-of-range override rejected, fall back to the frozen default.
      console.warn(
        `[beads] sprintTime ${options.sprintTime} outside [90, 120] — using ${this._sprintCap}`,
      );
    }
    this.tuning = { ...this.tuning, sprintTime: this._sprintCap };

    this._snapshot = createSnapshot(this.tuning);
    // 协作类的只读宿主视图：getter 惰性读，换关重建 grid/tray 后仍取到最新引用。
    const self = this;
    // 快照投影宿主（WXG-T-420 T6）：逐字段 getter 回指 `self._X`，构造一次、逐帧只读不建。
    // `hudDy` / `onboardingEnabled` 分别桥接方法 `self._hudDy()` 与静态 `BeadsGame.ONBOARDING_ENABLED`。
    this._snapshotSource = {
      get machine() { return self._machine; },
      get mode() { return self._mode; },
      get levelIndex() { return self._levelIndex; },
      get levels() { return self._levels; },
      get stageIndex() { return self._stageIndex; },
      get starsByLevel() { return self._starsByLevel; },
      get levelKeys() { return self._levelKeys; },
      get timer() { return self._timer; },
      get grid() { return self._grid; },
      get layout() { return self._layout; },
      get board() { return self._board; },
      get tray() { return self._tray; },
      get powerups() { return self._powerups; },
      get powerupHint() { return self._powerupHint; },
      get pendingBuy() { return self._pendingBuy; },
      get clearPanel() { return self._clearPanel; },
      get finishPanel() { return self._finishPanel; },
      get sprintSettle() { return self._sprintSettle; },
      get sprint() { return self._sprint; },
      get panel() { return self._panel; },
      get settings() { return self._settings; },
      get fx() { return self._fx; },
      get input() { return self._input; },
      get solverFx() { return self._solverFx; },
      get boardSelected() { return self._boardSelected; },
      get clearCoins() { return self._clearCoins; },
      get lastStars() { return self._lastStars; },
      get lastSettleScore() { return self._lastSettleScore; },
      get settleBestByUid() { return self._settleBestByUid; },
      get actionsPlaying() { return self._actionsPlaying; },
      get pressedButton() { return self._pressedButton; },
      get sprintBestScore() { return self._sprintBestScore; },
      get isNewBest() { return self._isNewBest; },
      get debugOutlines() { return self._debugOutlines; },
      get frameMs() { return self._frameMs; },
      get hudDy() { return self._hudDy(); },
      get safeTop() { return self._safeTop; },
      get capsuleBottom() { return self._capsuleBottom; },
      get safeBottom() { return self._safeBottom; },
      get bootErrors() { return self._bootErrors; },
      get reviveCount() { return self._reviveCount; },
      get watchingAd() { return self._watchingAd; },
      get failHint() { return self._failHint; },
      get beadLod() { return self._beadLod; },
      get onboardDone() { return self._onboardDone; },
      get onboardingEnabled() { return BeadsGame.ONBOARDING_ENABLED; },
      get finishLevelCount() { return self._finishRowCount(); },
      get isArcFinalLevel() { return self._isArcFinalIndex(self._levelIndex); },
      // `[WXG-T-432]` 好友榜面板只读视图（投影入口落 `snapshot-projection`）。
      get rankPanel() { return self._rankPanel; },
    };
    this._settings = new GameSettings({
      get save() { return self._save; },
      get services() { return self._services; },
      applyPalette(tokens) { self.palette = tokens; },
      emitVibrate(on) { self._emit('settings:vibrate', { on }); },
      // `[WXG-T-363]` 买断门：拥有态只经本口子读 shell 的 `MetaState`（⛔ 本类不存副本）。
      ownsSkin: this._ownsSkin,
    });
    this._fx = new FeedbackFx({
      get playing() { return self._machine.current === 'playing'; },
    });
    this._board = new BoardCameraController({
      get grid() { return self._grid; },
      get playing() { return self._machine.current === 'playing'; },
      handleTap(x, y) { self._input.handleTap(x, y); },
      layoutChanged() { self._recomputeLayout(); },
    });
    this._hud = new HudRouter({
      get board() { return self._board; },
      get hudDy() { return self._hudDy(); },
      get trayExpanded() { return self._tray.expanded; },
      get trayCanExpand() { return self._tray.canExpand; },
      sfx(clipId: string) { self._sfx(clipId); },
      pauseManual() { self._requestPause('manual'); },
      usePowerup(type: PowerupType) { self.usePowerup(type); },
      requestExpand() { self.requestTrayExpand(); },
    });
    this._boardTaps = new BoardTapRouter({
      get grid() { return self._grid; },
      get tray() { return self._tray; },
      get boardSelected() { return self._boardSelected; },
      set boardSelected(v: BoardAnchor | null) { self._boardSelected = v; },
      get fx() { return self._fx; },
      get mode() { return self._mode; },
      emit(type, payload) { self._emit(type, payload); },
      checkConservation(op: string) { self._conservation.check(op); },
      completeStage() { self._completeStage(); },
      requestLevelClear() { self._machine.transition('level-clear'); },
      countAction(ok: boolean) { return self._countAction(ok); },
      placeSelected(row: number, col: number) { return self._placeSelected(row, col); },
      selectTraySlot(slot: number) { return self.selectTraySlot(slot); },
      selectBoardBead(row: number, col: number) { return self.selectBoardBead(row, col); },
      retrieveSelectedGroup() { return self.retrieveSelectedGroup(); },
      markConsumed() { self._consumedTap = true; },
      armDenied(row: number, col: number) { self._armDeniedFx(row, col); },
    });
    this._controls = new ControlMap({
      get phase() { return self._machine.current; },
      get mode() { return self._mode; },
      get services() { return self._services; },
      get board() { return self._board; },
      get hudDy() { return self._hudDy(); },
      get trayExpanded() { return self._tray.expanded; },
      get trayCanExpand() { return self._tray.canExpand; },
      get reviveAvailable() { return self._reviveCount < REVIVE_MAX_PER_LEVEL; },
      get levelCount() { return self._levels.length; },
      get isLastLevel() { return self._levelIndex >= self._levels.length - 1; },
      get isArcFinalLevel() { return self._isArcFinalIndex(self._levelIndex); },
      get finishLevelCount() { return self._finishRowCount(); },
      get panel() { return self._panel; },
      get clearPanel() { return self._clearPanel; },
      get finishPanel() { return self._finishPanel; },
      get sprintSettle() { return self._sprintSettle; },
      get buyConfirmOpen() { return self._pendingBuy !== null; },
    });
    this._panelRouter = new PanelRouter({
      get mode() { return self._mode; },
      get reviveAvailable() { return self._reviveCount < REVIVE_MAX_PER_LEVEL; },
      get levelCount() { return self._levels.length; },
      get finishLevelCount() { return self._finishRowCount(); },
      get panel() { return self._panel; },
      get clearPanel() { return self._clearPanel; },
      get finishPanel() { return self._finishPanel; },
      get sprintSettle() { return self._sprintSettle; },
      clearPanelOptions() { return self._controls.clearPanelOptions(); },
      sfx(clipId: string) { self._sfx(clipId); },
      startNormal() { self.startNormal(); },
      retryLevel() { self.retryLevel(); },
      requestRevive() { self.requestRevive(); },
      advanceAfterClear() { self._advanceAfterClear(); },
      startSprintRun() { self._startSprintRun(); },
      restartRun() { self.restartRun(); },
      openMenu() { self._onMenuRequest?.(); }, // core-loop v2.3：go-menu 同通道（pause-settings §2.2 判例）
      applyPanelAction(action: PausePanelAction) { self._applyPanelAction(action); },
      share() { self._share(); },
      openLevelRank() { self.openLevelRank(); },
    });
    this._input = new InputRouter({
      get phase() { return self._machine.current; },
      get services() { return self._services; },
      get board() { return self._board; },
      hitUiControl(x: number, y: number) { return self._controls.hitUi(x, y); },
      dispatchTap(x: number, y: number) { self._routeTap(x, y); },
    });
    this._conservation = new BeadConservation({
      get grid() { return self._grid; },
      get tray() { return self._tray; },
    });
    this._crashIO = new CrashSnapshotIO({
      get phase() { return self._machine.current; },
      get levels() { return self._levels; },
      get grid() { return self._grid; },
      get tray() { return self._tray; },
      get sprint() { return self._sprint; },
      get timer() { return self._timer; },
      get spawner() { return self._spawner; },
      get powerups() { return self._powerups; },
      get mode() { return self._mode; },
      set mode(v: GameMode) { self._mode = v; },
      get levelIndex() { return self._levelIndex; },
      set levelIndex(v: number) { self._levelIndex = v; },
      get pauseIntent() { return self._pauseIntent; },
      set pauseIntent(v: 'manual' | 'system' | null) { self._pauseIntent = v; },
      get reviveCount() { return self._reviveCount; },
      set reviveCount(v: number) { self._reviveCount = v; },
      get reviveBonusSec() { return self._reviveBonusSec; },
      set reviveBonusSec(v: number) { self._reviveBonusSec = v; },
      get isNewBest() { return self._isNewBest; },
      set isNewBest(v: boolean) { self._isNewBest = v; },
      loadStage(stageIndex: number) { self._loadStage(stageIndex); },
      setupLevel(index: number) { self._setupLevel(index); },
      resetToPaused() { self._machine.reset('paused'); },
    });
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

  /**
   * 当前关卡原始数据（WXG-T-420 T9：渲染门面所需的珠色墨水组由**组装层**按本 getter
   * 解析 ⇒ Game 只出数据，不再知道「怎么画」）。构造期即定（`_levels` 非空），热路径零分配。
   */
  get currentLevel(): BeadsLevelRaw {
    return this._levels[this._levelIndex]!;
  }

  get levelCount(): number {
    return this._levels.length;
  }

  /** 最高解锁关（1-based）；无存档 = 1。供 shell 选关屏每帧只读（不分配）。 */
  get maxUnlockedLevel(): number {
    return this._save ? this._maxUnlockedIndex + 1 : 1;
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

  /** 待确认购买的道具型（`null` = 弹窗关闭）。测试从这里读。 */
  get pendingPowerupBuy(): PowerupType | null {
    return this._pendingBuy;
  }

  get bgmMuted(): boolean {
    return this._settings.values.bgmMuted;
  }

  get sfxMuted(): boolean {
    return this._settings.values.sfxMuted;
  }

  /** D1 减弱动效开关（view 经 snapshot 消费，抑制非必要位移/脉冲）。 */
  get reduceMotion(): boolean {
    return this._settings.values.reduceMotion;
  }

  /** E2 大字号开关（view 经 snapshot 消费，正文类文本放大）。 */
  get largeText(): boolean {
    return this._settings.values.largeText;
  }

  /** 震动开关（§3.8；shell/设置页与面板行回显共读）。 */
  get vibrateOn(): boolean {
    return this._settings.values.vibrate;
  }

  /** DEBUG 性能覆层开关（pause-settings v1.6；菜单设置 overlay 与暂停面板同串值共读）。 */
  get debugInfo(): boolean {
    return this._settings.values.debugInfo;
  }

  /** 菜单安全区标定线（设置 Debug 开关；view 只读）。 */
  get debugGuides(): boolean {
    return this._settings.values.debugGuides;
  }

  /**
   * `[WXG-T-434]` E4 幽灵符号开关（`systems-index §3.8` v1.23 转正，默认关）。
   * 对局页经快照 `ghostSymbol`（menu 片）读它决定空槽是否叠目标色符号。
   */
  get ghostSymbol(): boolean {
    return this._settings.values.ghostSymbol;
  }

  /**
   * 当前珠子风格 id（EP11-S5 / S9 §2.2 行4 左格）。**view 查 registry 的唯一入口**（L5：
   * 渲染层不持有游戏状态，只读本值），未经渲染侧兵，非法值已在 `normalizeSettings` 降级。
   */
  get beadStyle(): string {
    return this._settings.values.beadStyle;
  }

  /** 当前豆径档（EP11-S5 / S9 §2.2 行4 右格；仅网格珠读，托盘珠恒满幅不读本值）。 */
  get beadSize(): BeadSizeKind {
    return this._settings.values.beadSize;
  }

  /** 当前整套皮肤 id（EP12-S8；shell 菜单回显与暂停面板共用同一 getter ⇒ 两入口恒一致）。 */
  get skinId(): string {
    return this._settings.values.skinId;
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
    // `[WXG-T-295 续]` 对局 HUD 顶部避让：与主菜单 `menuAnchors` 同一套接口值/换算，
    // 只在小游戏宿主启用（harness / node 无刘海与胶囊 ⇒ 全部 0，旧版面逐字节不变）。
    const plat = services.platform;
    if (plat.isMiniGame) {
      const vp = services.viewport;
      const anchors = menuAnchors({
        safeTopDp: plat.safeAreaTop,
        capsuleBottomDp: plat.capsuleBottomDp,
        safeBottomDp: plat.safeAreaBottom,
        windowWidthDp: vp.fit.screenWidth,
        designHeight: vp.designHeight,
      });
      this._safeTop = anchors.st;
      this._capsuleBottom = anchors.H - anchors.btTopY;
      this._safeBottom = anchors.sb;
    }
    // ⛔ 供料死路径（WXG-T-136）：`_spawner.tick` 已摘除，游戏级 Rng 缓存随之移除；
    // S6 `random` 直接 attach 注入 Rng（铁律 L4；§8-4 有架构守卫）。供料复活时
    // 恢复 tick 调用即可（直接用 `services.rng`，无需重建字段）。
    // S6 的 `random` 只能抽自注入的 Rng（铁律 L4；§8-4 有架构守卫）。
    this._powerups.attach(services.rng);
    // 好友榜（ADR-0035 S-3）：宿主有能力才订阅；Node / web / 旧宿主传 null ⇒ 打开落 unsupported。
    this._rankPanel.attach(services.openData ?? null);

    // Preserve an unreadable document before SaveManager discards it — best effort.
    preserveCorruptBackup(services.storage, this._saveKey);

    this._save = new SaveManager<BeadsSave>(services.storage, {
      key: this._saveKey,
      version: SAVE_VERSION,
      defaults: defaultBeadsSave,
      // v1→v2（WXG-T-088 可访问性开关）：只升版本号，新字段交由 normalizeSettings
      // 逐字段降级——不注册则 SaveManager 会把旧档判为待迁移而重置丢进度。
      // v4→v5（ADR-0034 **DEC-4**）同一判例形状：**只做版本标记**，⛔ 不在迁移里做 uid
      // 换算（`Migration` 签名拿不到关表轴），真正的对位换算住 `normalizeBeadsSave`。
      // **S-7 改严**：链 = `BEADS_MIGRATIONS`（单一真源，每级返回 n+1）；此前四条都返回
      // `SAVE_VERSION` ⇒ 一条跳到底、后续迁移被静默跳过（ADR §6 S-7 / M-13）。
      migrations: BEADS_MIGRATIONS,
    });

    // D-03：崩溃恢复档是**另键** sidecar（提案 §5 方案 A）——S8 的键 / version /
    // `normalizeBeadsSave` 零改动，`save-schema.ts` 一字未动。
    this._crashIO.attach(services.storage);

    // BOOT static validation of every level: broken data must fail at boot,
    // never mid-run (core-loop §2.1 — no entering PLAYING with bad data).
    this._bootErrors = [];
    for (const level of this._levels) {
      for (const error of validateBeadsLevel(level)) {
        this._bootErrors.push(error);
      }
    }

    // ADR-0034 **DEC-3** 的轴装配点（两处之一，另一处 = `importLevel`）：身份镜像与
    // `this._levels` 同生命周期，此处**恰构造一次**；读档与写档两个边界均只读它。
    this._levelKeys = Object.freeze(levelIdentityKeys(this._levels));

    const loaded = this._save.load();
    const normalized = normalizeBeadsSave(loaded.data, this._levels.length, this._levelKeys);
    // `toBeadsSavePatch`：框架 `patch` 浅合并不删键 ⇒ 旧位置型数组需显式置 undefined 才能
    // 从档里物理消失（DEC-1「⛔ 双轨并存」的执行腿；写档频次不变，仍只下一次）。
    this._save.patch(toBeadsSavePatch(normalized.save, normalized.staleKeys));
    if (normalized.changed || loaded.wasReset) this._save.save();

    this._sprintBestScore = normalized.save.sprintBestScore;
    this._sprintBestStage = normalized.save.sprintBestStage;
    // S8 §2.2 `stars`：**边界换算恰一次**（uid 账 → 下标稠密数组，长度 = `levelKeys`）。
    // 运行时与视图继续吃下标数组（7 处取数位点零改动，ADR-0034 §4.2）⇒ 身份不进热路径。
    this._starsByLevel = flattenStars(normalized.save.starsByUid, this._levelKeys);
    // v6 品质分最佳账：归一产物本身就是新对象（稀疏），直接作内存镜像（同星账边界）。
    this._settleBestByUid = normalized.save.settleBestByUid;
    // 两根进度指针的身份 → 下标镜像（S-2b：这是**唯一**换算处，DEC-3）。
    this._maxUnlockedIndex = normalized.maxUnlockedIndex;
    this._lastPlayedIndex = normalized.lastPlayedIndex;
    // 十个设置值整对象装载（非法值已由 `normalizeSettings` 逐字段降级为默认）；
    // 同批换皮肤 tokens 引用、按 bgm 静音态启停背景乐。
    this._settings.load(normalized.save.settings);

    this._subscribe();
    this._boot();
  }

  update(dt: number): void {
    if (!this._services) return;
    this._frameSeq += 1;
    this.sampleFrame(dt);
    // ── 输入段（相位无关，WXG-T-100 / BD-34）────────────────────────────────
    // `InputRouter.handleTap` 的相位路由表已写全四相位（`input-control §2.3 状态门禁`：
    // PAUSED 仅暂停面板按钮；LEVEL_CLEAR / GAME_OVER / FINISH 仅各自面板按钮；
    // BOOT 全部忽略），此前唯一缺口是 `InputRouter.readFrame()` 只被 `_stepPlaying()` 调用
    // ⇒ 面板四相位收不到真链点击、面板按钮沦为空壳（真人永久卡死在暂停面板）。
    // 读输入必须**先于** `machine.update()`：帧内序为
    //   输入（段内序：状态指令 → 玩法事件）→ 连击窗 → 供料 → 计时
    // （`core-loop §2.2.2` / `pause-settings §6`）；放到 `machine.update()` 之后
    // 会把输入挤到计时之后，破坏该序。热路径零分配：`InputRouter.readFrame` 只写复用指针。
    this._input.readFrame();
    this._pressedButton = this._controls.pressedButton();
    this._machine.update(dt);
    // G2′ 相 B 到点动手：**先于**面板与表现层步进，因为本步会写棋盘并可能达成过关
    // （`cleared-priority`，core-loop §2.2.2 ⇒ 完成判定排在同一帧的事件之后）。
    this._stepSolverFx(dt);
    this._fx.stepLandings(dt); // [T-244] 组落座 + 托盘进珠：表现层（非 PLAYING 作废）
    // Panel animation is presentation, not gameplay: it keeps running while the
    // world is frozen so the enter/exit ramp never stalls (ux-spec §5).
    this._panel.update(dt * 1000);
    this._clearPanel.update(dt * 1000); // 结算面板同理：退出淡出要在离开 LEVEL_CLEAR 后跑完
    this._finishPanel.update(dt * 1000); // 通关画面同理
    this._sprintSettle.update(dt * 1000); // 冲刺结算面板同理
    this._rankPanel.update(dt * 1000); // 好友榜面板：表现层，不随相位冻结
    this._fx.stepPresentation(dt, this._solverFx !== null); // 连击 / 脉冲 / 抬起 / 反馈计时（表现层，不冻结）
  }

  /**
   * 性能采样（UI-24）：帧耗时 EMA（α=0.1 ≈ 十帧平滑）。由 `BeadsShell.update` 每帧统一喂
   * ⇒ 菜单腿也在测（旧版只在玩法 update 里算，菜单 fps 会冻结）。关→开从 0 重起步。
   */
  sampleFrame(dt: number): void {
    if (!this._settings.values.debugInfo || dt <= 0) return;
    const ms = dt * 1000;
    this._frameMs = this._frameMs === 0 ? ms : this._frameMs * 0.9 + ms * 0.1;
  }

  /**
   * 调试层数据投影（UI-25 / UI-50）：文案与开关的**唯一出处**，由 `UiRoot` 的宿主
   * 实现逐帧调用（旧的 `drawDebugLayer` 直调已在 UI-50 退役）。写入调用方对象并返回，
   * 热路径零分配。
   */
  debugState(out: UiDebugState, onMenu = false): UiDebugState {
    const s = this._snapshot;
    out.enabled = this._settings.values.debugInfo;
    out.frameMs = this._frameMs;
    out.phase = onMenu ? 'menu' : s.phase;
    out.level = onMenu ? '' : s.mode === 'sprint' ? '冲刺' : `L${s.levelIndex + 1}`;
    out.detail = onMenu ? '' : `pitch ${s.gridPitch.toFixed(1)} · LOD ${s.beadLodLayers}`;
    return out;
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
    this._crashIO.write();
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
    this._rankPanel.detach();
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
    // [WXG-T-240] 同色再点 = **幂等保持选中**：零事件、锚不动（「再点击能取消」是错误行为）。
    // 口径与 `selectBoardBead` 的「同一颗幂等（§8-6）」同构。
    if (result === 'unchanged') return this._countAction(true);
    if (this._countAction(result === 'deselected')) return true; // 兜底：select 已不再产生该值
    this._boardSelected = null; // 互斥换选：tray 锚建立 ⇒ board 锚清除（零事件）
    const color = this._tray.slot(slot)!.colorIdx;
    this._fx.resetLift(); // §5：托盘选中同样走斜坡（与板锚共用一个时钟）
    this._emit('tray:selected', { slot, colorIdx: color, count: this._tray.selectedCount });
    return this._countAction(true);
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
    if (prev && prev.row === row && prev.col === col) return this._countAction(true); // 幂等：不重发
    // WXG-T-148 ③ → 【WXG-T-157 裁定改写】：组 = 8 向两步（切比雪夫 ≤2）**同色**错位珠
    // （collectMisplacedGroup 内部筛色）；组色 = 锚珠色（规则 2 直填的对应色基准）。
    // 【WXG-T-186】组成员随即转成剥皮消费序（含锚，锚恒在序首）——直填与取回落槽共用。
    const cells = collectMisplacedGroup(this._grid, row, col);
    // [WXG-T-236 · 用户 2026-10-03 裁定「甲」] **已完全抬起的组内换锚不再重播斜坡**。
    //
    // 缺陷（用户报「已抬起的珠子点击还会走一遍抬起动画」）：抬起量是**一个全局时钟**
    // （`_liftElapsedMs` / `SELECT_LIFT_MS`）=> 整组共用一个 `liftProgress`；原写法在此**无条件**
    // 归零 => 点组内**另一颗已抬起**的珠时，整组**掉回地面再抬起一遍** => 观感是「闪了一下」。
    //
    // 判据（两条同时成立才**不**复位）：(1) 组**已完全抬起**（时钟到位）；
    // (2) 新锚**仍属当前已抬起的组**（`cells` 含旧锚）=> 只是换锚，视觉高度不变 => 不该重播。
    // ⛔ 越界不静默：新锚不在旧组内（换组）或组未抬完（时钟未到位）=> 仍旧复位（= 原行为）。
    const stillRaised =
      this._fx.liftElapsedMs >= SELECT_LIFT_MS
      && prev !== null
      && cells.some((c) => c.row === prev.row && c.col === prev.col);
    if (!stillRaised) this._fx.resetLift(); // §5：新锚建起 => 抬起斜坡重来（组内珠一同从底面抬起来）
    this._clearTraySelection(); // 互斥换选：board 锚建立 => tray 锚清除
    const order = planConsumeOrder(this._grid, row, col, cells);
    this._boardSelected = {
      row,
      col,
      anchorRow: row, // 选豆点 = 拾取那一下的坐标，此后恒定（用户裁定 2026-09-20）
      anchorCol: col,
      color: this._grid.cell(row, col)!.beadColorIdx,
      order,
    };
    this._emit('board:selected', {
      row,
      col,
      colorIdx: this._grid.cell(row, col)!.beadColorIdx,
      count: cells.length,
    });
    return this._countAction(true);
  }

  /**
   * 静默清除托盘选中（锚互斥的 S4 侧半边，input-control §2.1「换选即转移」）。
   * **v2.2 组选改写**：清除的是整个 `selected` 组（旧版单槽直写随 Tray.deselectAll
   * 收拢）。`selected → holding` 零事件；S6 镜像无反向通知需求不变。
   */
  private _clearTraySelection(): void {
    this._tray.deselectAll();
  }

  // ────────────────────────────────────────────────── 珠色守恒哨兵（T-244 二十二批）

  /**
   * **手动体检**（公开）：拿「盘 + 托」实际每色数与**图案每色目标**（另加夹具凭空量）比对。
   * 抓盘场景专用：抓到一张怪盘时在控制台敲
   * `__beads.game.checkBeadConservation()` ⇒ 红 = **数据面**被写坏（某色多/少），
   * 绿 = 数对得上 ⇒ 问题在渲染层，不用再来一轮守恒排查。
   * 命令级哨兵只管「一次搬运内不增不减」，本函数管「整张盘对不对得起图案」。
   */
  checkBeadConservation(op = '手动体检'): boolean {
    return this._conservation.audit(op);
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
    // 计量在 `_routeGridEmpty` 里做（真链 `_routeTap` 直调该函数、不经本入口），
    // 在此再计一次会双计。
    return this._boardTaps.routeGridEmpty(row, col);
  }

  /**
   * v2.0 取回命令（Epic T-133 E1）— the S2 route 4b → S3/S4 pair-write as a
   * public command. Takes the explicit misplaced cell `(row, col)`. **v2.4
   * (WXG-T-204 用户裁定，推翻 WXG-T-168) 落槽 = 自动归类**：珠落到同色块尾 /
   * 最左可用空格（`insertGrouped`），玩家点击的空槽仅作 4b 触发、不参与定位。
   *
   * On success: grid `filled(错位)` → `empty` + 入槽 in the same call
   * stack, then `tray:stored {slot, colorIdx, fromRow, fromCol}` — `slot` =
   * 实际落位. Every refusal branch is ZERO-EVENT (满槽禁取珠 §3.13; locked/就位
   * taps get their 极轻反馈 from the S2/view layer, never from here).
   *
   * @returns true only when the retrieval was stored.
   */
  retrieveBead(row: number, col: number): boolean {
    if (this._machine.current !== 'playing') return false;
    this._conservation.mark(); // [T-244 二十二批] 哨兵入口（盘→托）
    const verdict = judgeRetrieve(this._grid, this._tray, row, col);
    if (verdict.outcome === 'stored') {
      // [T-244 九批] 进珠动画登记（多槽队列：push 不覆盖；总窗恒 200ms 承甲案）
      this._fx.pushTrayLand(verdict.slot);
      this._emit('tray:stored', {
        slot: verdict.slot,
        colorIdx: verdict.colorIdx,
        fromRow: verdict.fromRow,
        fromCol: verdict.fromCol,
      });
      this._conservation.check('取回落槽 retrieve'); // 珠离格必入槽，一处漏写即报
      return true;
    }
    // All refusals are silent by design; only impossible coordinates log.
    if (verdict.reason === 'out-of-bounds') {
      console.warn(`[beads] retrieve out of bounds (${row},${col}) — ignored`);
    }
    return false;
  }

  /**
   * 整组取回（WXG-T-148 裁定③④；**v2.4 WXG-T-204 落槽回退自动归类**）：把 board
   * 锚的错位珠组**一次**收进托盘，落位 = `insertGrouped` 逐颗自动归类（同色成块、
   * 紧凑无洞），点击空槽仅作 4b 触发、不参与定位（推翻 WXG-T-168 点槽定落位）。
   *
   * **容量口径（WXG-T-204）**：可收数 `count = min(组大小, tray.freeCount)` ——
   * 有多少空槽收多少颗；所收 = 组珠**消费序的前 `count` 颗**（【WXG-T-186】序 =
   * 拾取时算好的 `planConsumeOrder` 剥皮序，与直填共用）。收满 ⇒ 锚清；未收满 ⇒
   * 余珠留 board、**锚改指剩余首颗**（可续点，锚变更不发事件）。`freeCount = 0`
   * ⇒ 拒绝（零事件零状态写，满槽禁取珠 §3.13 的组化推广）。
   *
   * 逐颗复用 `retrieveBead`（judgeRetrieve 逐颗原子 + 逐颗 `tray:stored`）。
   *
   * @returns 至少收进 1 颗即 true。
   */
  retrieveSelectedGroup(): boolean {
    if (this._machine.current !== 'playing') return false;
    const anchor = this._boardSelected;
    if (!anchor) return false;
    if (this._tray.freeCount === 0) return false; // 满槽：无任何空槽
    // 消费序已在拾取那一下算好（`anchor.order` 剥皮序，与直填共用）⇒ 逐颗从消费序首部归类收进。
    const ordered = anchor.order;
    const count = Math.min(ordered.length, this._tray.freeCount);
    for (let i = 0; i < count; i++) {
      const c = ordered[i]!;
      if (!this.retrieveBead(c.row, c.col)) break; // 保守中断（理论不可达：freeCount 已足）
    }
    if (count >= ordered.length) {
      this._boardSelected = null; // 整组离格 ⇒ 锚失效
    } else {
      // 部分收纳：剩余珠仍在格上 ⇒ 头珠改指剩余序首（消费序下颗 = 下一个该揭的珠）；
      // 选豆点 anchorRow/Col 恒不变（用户裁定 2026-09-20）。
      const rest = ordered.slice(count);
      const head = rest[0]!;
      this._boardSelected = {
        row: head.row,
        col: head.col,
        anchorRow: anchor.anchorRow,
        anchorCol: anchor.anchorCol,
        color: anchor.color,
        order: rest,
      };
    }
    return this._countAction(true);
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
    const pool = this._misplacedBeads();
    const outcome = this._powerups.request(type, pool, this._powerupInputs());
    if (outcome.kind === 'exhausted') {
      // 免费次数用尽 ⇒ **豆子购买**（§3.6 v1.80 唯一出口）：先弹确认（`ux-spec §3.7`），
      // 此刻**零扣豆、零事件**；确定才走 {@link confirmPowerupBuy}。
      if (pool.length === 0 || !this._powerups.canPurchase(type)) {
        this._powerupHint = POWERUP_BUY_DENIED_HINT;
        return false;
      }
      this._powerupHint = '';
      this._pendingBuy = type;
      return false;
    }
    if (outcome.kind !== 'used') return false;
    this._applyPowerupUse(outcome);
    // 免费腿用掉即落档（§3.6 v1.95「必须入档」；购买腿不经过此路径）。
    this._onPowerupFreeSpent?.(this._powerups.freeDepleted);
    return true;
  }

  /**
   * 注入账号级免费额度耗尽标志（§3.6 v1.95；shell 在 meta 载档后调用一次）。
   * 透传 {@link PowerupSystem.setFreeDepleted}（仅收布尔字段，缺省不动）。
   */
  setPowerupFreeDepleted(flags: Partial<Record<PowerupType, boolean>>): void {
    this._powerups.setFreeDepleted(flags);
  }

  /**
   * 确认购买（弹窗「确定」）：扣豆**一次** + 生效**一次**。
   * 豆子不足 / 棋盘已无错位珠 ⇒ 关窗 + 轻提示，零扣款零事件（v1.95 删除「达上限」路径）。
   */
  confirmPowerupBuy(): boolean {
    const type = this._pendingBuy;
    this._pendingBuy = null;
    if (!type || this._machine.current !== 'playing') return false;
    const pool = this._misplacedBeads();
    if (pool.length === 0 || !this._powerups.canPurchase(type)) {
      this._powerupHint = POWERUP_BUY_DENIED_HINT;
      return false;
    }
    if (!this._onPowerupPurchase?.(type)) {
      this._powerupHint = POWERUP_BUY_DENIED_HINT;
      return false;
    }
    const outcome = this._powerups.purchase(type, pool, this._powerupInputs());
    if (outcome.kind !== 'used') return false;
    this._applyPowerupUse(outcome);
    return true;
  }

  /** 取消购买（弹窗「取消」/ 点板外）：零副作用关窗。 */
  cancelPowerupBuy(): void {
    this._pendingBuy = null;
  }

  /**
   * 道具**生效腿**（免费与购买共用，唯一点名落地处）。
   *
   * G2′（用户 2026-09-17 裁定「甲」）：本帧**只点名不动手** —— 相 A 200ms 闪环期间棋盘保持原样，
   * `bead:placed` 与过关判定全部推到相 B 各自到点的那一帧（`_stepSolverFx`）。
   * 事件载荷 = 点名格（§1.6.2a「affectedCells = 预警高亮的格」）+ `trayRestore` 的
   * `traySlots`（§2.4 托盘清空信号）；音频派发（S6）零变化。
   *
   * ⚠ v1.95 分流（WXG-T-431）：`trayRestore` **同帧动手**（`_execTrayPlan`）——
   * `powerups-v2 §2.2.5` 伪代码无相 A/相 B，且 plan 与动手同帧 ⇒ 盘面/托盘状态
   * 与 plan 完全一致（零重算、零重消费 Rng）；另两件照旧走 G2′ 队列。
   */
  private _applyPowerupUse(outcome: Extract<PowerupOutcome, { kind: 'used' }>): void {
    this._powerupHint = '';
    this._emit('powerup:used', {
      type: outcome.type,
      affectedCells: outcome.affectedCells,
      ...(outcome.traySlots ? { traySlots: outcome.traySlots } : {}),
    });
    this._fx.startSweep(); // G3 扫光（表现层，不影响裁决）：与 §1.6.2a 解环器归位同帧启动
    if (outcome.trayPlan) this._execTrayPlan(outcome.trayPlan);
    else this._armSolverFx(outcome.affectedCells);
  }

  /**
   * `trayRestore` 动手腿（v1.95，§2.2.5）：按 plan **同帧**执行托盘→盘归位。
   * plan 即真相（request 与动手同帧 ⇒ 不重算、不重消费 Rng，§2.2.5-⑥ 次数不破）。
   * 托盘写入真方 = S4（经 `Tray` 写原语清槽，S6 保持只读）；**倒序执行** ——
   * `takeBead` 左移补位会前移右侧槽号（v2.2 归类不变式），倒序清则 plan 槽号恒有效。
   * 每颗一份 `bead:placed`（**带来源 slot**，托盘路径必带）+ 组落座队列
   * （与手动放珠同视觉通道，`step` = 槽序 ⇒ 逐颗错开的「扫过」观感）。
   */
  private _execTrayPlan(plan: readonly TrayMove[]): void {
    for (let i = plan.length - 1; i >= 0; i--) {
      const m = plan[i]!;
      this._conservation.mark(); // 哨兵入口（托→盘）
      const slot = this._tray.slot(m.slot);
      const bead = slot && slot.state !== 'free' ? slot.colorIdx : 0;
      if (!bead) continue; // 防御：plan 与动手同帧，理论不可达
      const target = this._grid.cell(m.targetRow, m.targetCol)!;
      if (target.state === 'empty') {
        if (!this._grid.fill(m.targetRow, m.targetCol, bead)) continue;
      } else if (m.evictRow >= 0) {
        // 换出：被占珠落 evict 空格（fill），托盘珠进目标格（setBead 改珠色）。
        const evicted = target.beadColorIdx;
        if (!this._grid.fill(m.evictRow, m.evictCol, evicted)) continue;
        this._grid.setBead(m.targetRow, m.targetCol, bead);
      } else {
        continue; // 防御：被占且无 evict 位（plan 时已保证不发生）
      }
      this._tray.takeBead(m.slot);
      this._emit('bead:placed', { row: m.targetRow, col: m.targetCol, colorIdx: bead, slot: m.slot });
      this._fx.pushGroupLand(m.targetRow, m.targetCol, i);
      this._conservation.check('trayRestore 归位');
    }
    // 同帧可能达成零错位 ⇒ cleared-priority（与 _stepSolverFx 序列末同判例）。
    if (this._grid.isComplete()) {
      if (this._mode === 'sprint') this._completeStage();
      else this._machine.transition('level-clear');
    }
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
   * 组装 S6 的 `PowerupInputs`（v1.95，WXG-T-431）：
   *  - `dims`：盘面尺寸（`windowRestore` 算最密集 6×6 贴边收缩窗口）；
   *  - `tray` / `empties`：`trayRestore` 的托盘珠清单（每颗带它的唯一归宿格，行主序
   *    第一个匹配格；锁定 / 无归宿的珠**不进清单**——S6 约定调用方预筛）与盘面空格。
   * 全部**读取期**构造，S6 仍无状态（不持镜像）。
   */
  private _powerupInputs(): PowerupInputs {
    const grid = this._grid;
    const tray: TrayBead[] = [];
    for (let slot = 0; slot < this._tray.capacity; slot++) {
      const s = this._tray.slot(slot);
      if (!s || s.state !== 'holding') continue;
      // 归宿格 = 行主序第一个「要求色 == 珠色 且 (empty 或 misplaced)」的格；
      // locked / 已就位格不可能是归宿（守恒 ⇒ 有珠在托盘就有格缺珠）。
      for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
          if (grid.requiredColor(row, col) !== s.colorIdx) continue;
          const cell = grid.cell(row, col)!;
          if (cell.state === 'empty' || (cell.state === 'filled' && grid.isMisplaced(row, col))) {
            tray.push({ colorIdx: s.colorIdx, slot, targetRow: row, targetCol: col });
            row = grid.rows; // 找到即跳出双层
            break;
          }
        }
      }
    }
    const empties: AffectedCell[] = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const cell = grid.cell(row, col)!;
        if (cell.state === 'empty') empties.push({ row, col });
      }
    }
    return { dims: { rows: grid.rows, cols: grid.cols }, tray, empties };
  }

  /**
   * 把 `(row, col)` 上的错位珠**归位**：移到「珠色对应的目标格」。
   *  - 目标格为 empty ⇒ `retrieve` + `fill`（同一调用栈，与取回→归位同源）；
   *  - 目标格被另一颗错位珠占据 ⇒ 两格 `setBead` 交换（就位珠 / locked 永不可触）。
   *
   * 落座动画的两条路（§1.6.1 vs §1.6.2a）：
   *  - **手动 / 非 G2′ 调用**（`fx = null`）⇒ 走 `FeedbackFx.armPlace`，受 120ms 连点重启门约束；
   *  - **解环器相 B**（传 `fx`）⇒ **不碰** `FeedbackFx.armPlace`，只往队列的 `land*` 槽里记录
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
    this._conservation.mark(); // [T-244 二十二批] 哨兵入口（盘→盘，相 B 逐颗驱动时同样过）
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
      this._conservation.check('解环归位 solve');
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
      this._conservation.check('解环交换 solve');
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
      this._fx.armPlace(row, col); // G1 落座回弹（表现层，不影响裁决）
      return;
    }
    const i = fx.landCount;
    if (i >= fx.landRows.length) return;
    fx.landRows[i] = row;
    fx.landCols[i] = col;
    fx.landSteps[i] = step;
    fx.landCount = i + 1;
  }

  /**
   * 升一档托盘容量（12 → 24 → 48，§3.4 v1.83）。**纯机制**：不发广告、不判相位，
   * 供广告发奖 / 崩溃恢复 / 测试直调。顶档后再调 ⇒ `false`。
   */
  expandTray(): boolean {
    if (!this._tray.expand()) return false;
    this._emit('tray:expanded', {});
    return true;
  }

  /**
   * `btn_expand` 的完整语义（§3.4 v1.83）：本关内**每升一档看一次激励视频**，
   * 顶档（48）后按钮消失 ⇒ 本方法不再可达。
   *
   * 降级口径（用户 2026-10-25 拍板「失败即免费给」）：weapp 宿主的激励位是 Noop
   * （`show()` 必 onError）⇒ 失败分支必须**照发奖励**，否则真机永远拿不到扩容。
   * 该分支是开发期手段，上线前随真广告接入一并删除。
   * @returns 是否受理（顶档 / 已在飞广告 / 非 playing ⇒ false，按钮侧应已不可见）。
   */
  requestTrayExpand(): boolean {
    if (!this._tray.canExpand) return false;
    if (this._watchingAd) return false;
    const ad = this._services?.rewardedAd;
    if (!ad) return this.expandTray(); // 无广告位宿主 ⇒ 同降级口径直发
    this._adKind = 'trayExpand';
    this._watchingAd = true;
    fireRewardedAd(ad, REWARDED_PLACEMENT.trayExpand);
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
    this._input.handleTap(x, y);
    return this._machine.current !== before || this._consumedTap;
  }

  /** True when the last `InputRouter.handleTap` route consumed the tap without a phase change. */
  private _consumedTap = false;

  /**
   * zoom 自适应 LOD 当前态（true = 珠屏幕径低于阈值 ⇒ 走降层集）。
   * 状态住 game 侧而非视图：滞回要有上一帧，而 L5 视图不持状态（工程铁律 L5）。
   */
  private _beadLod = false;

  /** 本局玩家点击数（含误点；harness/调试用，结算面板走快照字段 `clearTaps`）。 */
  get tapsThisLevel(): number {
    return this._input.tapsPlaying;
  }

  /**
   * 本局**有效动作数**（定星口径）：四个公开玩法命令任一返回 true 就计一。
   *
   * 与 `tapsThisLevel` 的区别：后者是输入计数（含误点与只触到轻提示的无效点），
   * 本者是「真的改变了世界」的动作数 ⇒ **与 `tools/scripts/beads-bot.ts` 的 `CMDS`
   * 计数器逐字同口径**（连「幂等重选同一个锚」也同口径，因为 bot 那边也是按返回 true 计），
   * 所以可直接与关卡真源 `pricing.actions` 对表定星。
   *
   * ⚠ 不能用 `clearTaps` 定星：触屏上手滑一下就会掉星（含误点）。
   */
  get actionsThisLevel(): number {
    return this._actionsPlaying;
  }

  private _actionsPlaying = 0;

  /** 计量包：透传 `ok`，为 true 时计一次有效动作（不改任何判定）。 */
  private _countAction(ok: boolean): boolean {
    if (ok) this._actionsPlaying++;
    return ok;
  }

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
    // [T-244 二十二批] 本钩子按定义就是「凭空造珠」⇒ 计入体检基准（_invExtra），
    // 否则夹具与 harness 控制台注入会造成假红。玩法命令里的凭空珠仍会报（它不走这里）。
    this._conservation.noteExtra(colorIdx);
    this._emit('tray:spawned', { slot, colorIdx });
    return slot;
  }

  /** Retry after game over: normal → same level fresh; sprint → new run. */
  retryLevel(): boolean {
    if (this._machine.current !== 'game-over') return false;
    // §3.14：普通局重开 = 新局开局，扣 1 心；0 心 → 看广告加心再重试（冲刺消耗不冻结，不设门）。
    if (this._mode === 'normal' && !this._gateRunStart(() => this.retryLevel())) return false;
    this._watchingAd = false;
    this._failHint = '';
    this._sprintSettle.close(); // 冲刺结算淡出由 `update()` 跑完（与其余面板同判例）
    this._crashIO.clear(); // D-03（提案 §3）：重开本局 ⇒ 旧快照失效
    if (this._mode === 'sprint') {
      this._setupSprintRun();
    } else {
      this._setupLevel(this._levelIndex);
    }
    this._machine.transition('playing');
    return true;
  }

  /**
   * 回主菜单 = **弃本局**（EP13-S3）：置弃局标 ⇒ 在途/后续广告发奖不得复活旧棋盘。
   * 下次新局装配（`goToLevel`/retry/restart）自动清除。
   */
  abandonRun(): void {
    this._abandoned = true;
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
    fireRewardedAd(ad, REWARDED_PLACEMENT.failContinue);
    if (this._watchingAd) return true;
    if (this._machine.current !== 'game-over') return true;
    this._failHint = '即将开放';
    return false;
  }

  /**
   * 新局开局体力闸门（§3.14）。无 shell（`_canStartRun` 未注入）→ 恒放行（独立 BeadsGame
   * 后向兼容）；扣心成功 → 放行；0 心被拒 → 触发广告加心激励位（{@link _requestStaminaRefill}），
   * 本次调用返回 false（停在原面板，广告发奖后经挂起续体重放）。
   */
  private _gateRunStart(proceed: () => boolean): boolean {
    if (!this._canStartRun) return true;
    if (this._canStartRun()) return true;
    this._requestStaminaRefill(proceed);
    return false;
  }

  /**
   * 0 心重试的广告加心位（§3.11 第二 live 位）：加载 `stamina-refill` 位并挂起 run-start
   * 续体；发奖路由见 {@link _onAdRewarded}（加心 → 重放 retry/restart，此时闸门扣 1 心成功）。
   * 无广告位 / 无 shell 加心回调 → 无副作用（被拒即停在面板，可再点或等自然恢复）。
   */
  private _requestStaminaRefill(proceed: () => boolean): void {
    if (this._watchingAd) return;
    const ad = this._services?.rewardedAd;
    if (!ad || !this._onStaminaRefill) return;
    // §3.14 v1.80 日限/满心闸门：不可加心时不拉广告（避免「看完啥也没有」）。
    if (this._canWatchStaminaAd && !this._canWatchStaminaAd()) return;
    this._failHint = '';
    this._adKind = 'staminaRefill';
    this._pendingRunStart = proceed;
    this._watchingAd = true;
    fireRewardedAd(ad, STAMINA_REFILL_PLACEMENT);
  }

  /** From the FINISH screen: replay the whole normal campaign from level 1. */
  restartRun(): boolean {
    if (this._machine.current !== 'finish') return false;
    // §3.14：整轮重玩 = 新局开局，扣 1 心；0 心 → 看广告加心再重试。
    if (!this._gateRunStart(() => this.restartRun())) return false;
    this._mode = 'normal';
    this._crashIO.clear(); // D-03：整轮重玩 ⇒ 旧快照失效
    this._finishPanel.close(); // 淡出由 `update()` 跑完（与结算面板同判例）
    this._levelIndex = 0; // P0-1：重玩本章 ⇒ 回第 1 关（`_setupLevel` 不移动游标）
    this._setupLevel(0);
    this._machine.transition('playing');
    return true;
  }

  /**
   * 分享按钮点击（WXG-T-405）：透传给效果派发模块（`effects-dispatch.ts::fireShare`）。
   * 宿主无分享能力（Node/harness）静默 noop、分享抛错吞掉、卡片内容注释均随迁移住该模块。
   */
  private _share(): void {
    if (!this._services) return;
    fireShare(this._services);
  }

  /** Level jump for level-select UI / harness / tests (normal mode). */
  goToLevel(index: number): void {
    this._mode = 'normal';
    const clamped = Math.max(0, Math.min(index, this._levels.length - 1));
    this._levelIndex = clamped;
    this._crashIO.clear(); // D-03：跳关 ⇒ 旧快照失效
    this._setupLevel(clamped);
    this._machine.reset('playing');
  }

  /**
   * **跨章入口授权**（WXG-T-345 · S-4；ADR-0034 §6 S-4 行 / §6.1 M-15 的唯一写入点）。
   *
   * 门票只在**首次进入该章那一刻**作为放行依据（shell 在 `pick-level` 章首格上算）；
   * 放行即把**既有两根进度指针**推到该关 —— 此后「已得入口」的证据就住在这两根指针里：
   * 后续章内解锁继续走“线性过一开一”，**不回看门票**（I7 棘轮：⛔ 因内容变更回收入口）。
   * ⛔ 新增布尔位、⛔ 碰星账（星是通关事实，归 `_persistProgress` 的收拢腿）。
   *
   * 幂等：目标已在解锁位内且恰为续玩点 ⇒ 不重复写档。无存档（未 `init` 的独立 play）⇒ 只动内存镜像。
   * 无身份槽（`''` = dev 导入草案，未过生成器）⇒ 不推指针（与 `_persistProgress` 同判据）。
   */
  unlockAcrossArc(index: number): void {
    if (this._levels.length === 0) return;
    const clamped = Math.max(0, Math.min(index, this._levels.length - 1));
    const key = this._levelKeys[clamped] ?? '';
    if (key === '') return;
    if (clamped <= this._maxUnlockedIndex && clamped === this._lastPlayedIndex) return;
    this._maxUnlockedIndex = Math.max(this._maxUnlockedIndex, clamped);
    this._lastPlayedIndex = clamped;
    const save = this._save;
    if (!save) return;
    const maxKey = this._levelKeys[this._maxUnlockedIndex] ?? '';
    save.patch({
      maxUnlockedKey: maxKey !== '' ? maxKey : save.data.maxUnlockedKey,
      lastPlayedKey: key,
    });
    save.save();
  }

  /**
   * 调试导入（WXG-T-179 · beads-studio）：将一关**已通过 BOOT 校验**的外部关卡
   * 追加到关表末尾并跳进去试玩。校验失败 ⇒ 返回错误串且**不改关表**（不伪造可玩态）。
   * 注：这是宿主侧调试通道，产物不入 `design/levels/`（入关走 `levels:sync`）。
   */
  importLevel(raw: BeadsLevelRaw): string[] {
    const errors = validateBeadsLevel(raw);
    if (errors.length) return errors;
    this._levels = this._levels.concat([raw]); // 一次性操作，非热路径（拷写避免改入参冻结数组）
    // 关表被重新装配 ⇒ 身份镜像同批重建（DEC-3：镜像与 `_levels` 同生命周期，
    // 这是除 BOOT 外唯一的装配点）。草案未过生成器 ⇒ 无 `uid`，该槽取 `''`（不入档）。
    this._levelKeys = Object.freeze(levelIdentityKeys(this._levels));
    this.goToLevel(this._levels.length - 1);
    // EP12-S9（裁定②）：草案携 `skin`（**引用 id，不传数据本体**）⇒ 导入成功后应用。
    // ⛔ 以**本地注册表**复验，不信任自报值（K-064「谎报值不采信」判例形状）：
    // 已注册 ⇒ 应用；未注册 ⇒ **不拒收关卡本体**，回落默认肤 + 一次性告警。
    // 缺 `skin` 字段的旧草案 ⇒ 零影响（settings.skinId 原样保留）。
    if (typeof raw.skin === 'string') {
      if (skinById(raw.skin) !== undefined) {
        this._settings.applySkin(raw.skin);
      } else {
        warnUnregisteredSkin(raw.skin);
        this._settings.applySkin(DEFAULT_SKIN_ID);
      }
      this._settings.persist();
    }
    return [];
  }

  /** Enter a fresh sprint run (endless ladder). */
  startSprint(): void {
    this._mode = 'sprint';
    this._crashIO.clear(); // D-03：开新冲刺 run ⇒ 旧快照失效
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
      case 'toggle-debug-info':
        this.setDebugInfo(!this._settings.values.debugInfo);
        return;
      case 'toggle-debug-guides':
        this.setDebugGuides(!this._settings.values.debugGuides);
        return;
      default:
        this._settings.apply(action);
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
            game._fx.cancelWave();
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
            level.time,
            game._tierThisLevel,
            game.revived,
            level.starTierK, // §3.7 v1.86 单关三档系数（如 boss 关 3★ 必须开 48 槽）
          );
          // §3.14 v1.90：`prevStars` 必须在**写星之前**取（下面写星是 `Math.max`，写后就恒 ≥1）。
          const li = game._levelIndex;
          const prevStars = game._starsByLevel[li] ?? 0;
          game._lastStars = stars;
          // 结算发豆：首通/升星按档累进（每档各发一次）/ 复刷走日上限（经济全在 shell+meta，本类只透传）。
          game._clearCoins = game._onClearCoins?.(stars, isBossLevelId(level.id), prevStars) ?? null;
          // 通关画面总览：取**历史最好**（重玩不降级，与 `maxUnlockedLevel` 同语义）。
          game._starsByLevel[li] = Math.max(game._starsByLevel[li] ?? 0, stars);
          // C7 结算分（品质分；ADR-0035 Q1=B 品质分单榜）：四因子全在此刻可得。
          game._lastSettleScore = normalSettleScore(
            stars,
            ratio,
            game._powerups.usedCount,
            game._tray.expanded,
          );
          // 每关历史最佳（max 在过关记分处取，⛔ 在存档层；同星账 §8-2 判例）。
          // 无身份槽（`''` = dev 导入草案）不入账，⛔ 不发明 token。
          const settleKey = game._levelKeys[li] ?? '';
          if (settleKey !== '') {
            const prevBest = game._settleBestByUid[settleKey] ?? 0;
            if (game._lastSettleScore > prevBest) {
              game._settleBestByUid[settleKey] = game._lastSettleScore;
            }
          }
          game._emit('level:cleared', { levelId, remaining, ratio, stars });
          game._persistProgress();
          game._crashIO.clear(); // D-03（提案 §3）：过关即删，避免残局覆盖下次启动
          // 结算面板开：`ux-spec §4` 要求 LEVEL_CLEAR **等按钮**（下一关 / 去冲刺）。
          game._clearStarsAnnounced = 0;
          // 裁定 1（T-128）：面板**延迟 `CLEAR_PANEL_DELAY_MS` 开** —— 庆祝波浪先行放完再落遮罩。
          // 代码事实：`drawClearPanel` 首行即全屏遮罩 α0.5 且在 drawGrid 之后 ⇒ 同帧开 = 庆祝被遮死。
          // D1（reduceMotion）：波浪整条关停 ⇒ **不再空等 800ms**（庆祝是延迟的唯一理由，
          // 关掉庆祝还让手感多等 = 纯惩罚）。本派生口径已入台账 T-146 待确认。
          if (game._settings.values.reduceMotion) {
            game._clearPanel.open();
            game._sfx(AUDIO_CLIP_PANEL_IN);
          } else {
            game._fx.startWave();
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
          game._crashIO.clear(); // D-03（提案 §3）：失败即删
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
   * the **last-played pointer** (already resolved to a 0-based index at the save
   * boundary). Invalid level data keeps the game in BOOT forever.
   */
  private _boot(): void {
    if (this._bootErrors.length > 0) {
      console.warn(`[beads] level validation failed — refusing PLAYING:\n  ${this._bootErrors.join('\n  ')}`);
      return;
    }
    const save = this._save;
    const target = save ? bootLevel(save.data, this._lastPlayedIndex) : 1;

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
    if (this._crashIO.restore()) return;

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
        const colorIdx = (payload as { colorIdx: number }).colorIdx;
        this._tray.consumeNeeded(colorIdx);
        this._maybeColorCue(colorIdx);
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
        // 托盘扩容降级（用户 2026-10-25 裁「失败即免费给」）：weapp 激励位是 Noop ⇒
        // 真机必走本分支。⛔ 该分支随真广告接入删除（否则 = 白送槽位）。
        if (this._adKind === 'trayExpand') {
          this._adKind = null;
          this.expandTray();
        }
      }),
    );

    // ── 音频派发（WXG-T-096 / BD-05）：整块迁至 `effects-dispatch.ts::attachAudioCues`
    // （T5 效果派发协作模块）。注册序、clip 映射、限流口径与 tray:full 死路径注释逐条随迁；
    // 返回的 unsub 并入 `_unsubs`，`dispose()` 统一解绑。调用点仍在数据投影订阅之后
    // ⇒「同一 bead:placed 上投影先于发声」的既有先后不变。
    this._unsubs.push(...attachAudioCues(bus, (clipId) => this._sfx(clipId)));
  }

  /** Load a normal level: fresh grid/tray/rhythm/timer (S5 §2.4 reset list). */
  /**
   * S6 复位（§3.5 整关重置第 5 项 + §2.5）：三计数回 `POWERUP_FREE_USES`、镜像
   * 随托盘一并清空、容量回基线，并丢掉超限占位提示。
   */
  private _resetPowerups(): void {
    this._powerups.reset();
    this._powerupHint = '';
    this._pendingBuy = null; // 换关 / 重试 / 新局一律关掉购买确认（ux-spec §3.7 闸门）
  }

  private _setupLevel(index: number): void {
    const level = this._levels[index];
    if (!level) throw new Error(`Beads: no level at index ${index}`);
    this._finishEndIndex = -1; // 装配新关 ⇒ 总览口径退回全表，直到下次章末结算
    this._input.resetTapCount(); // 换关/重试/新局共用复位点（同 F3 甲裁「装配即复位」）
    this._resetPlaceCombo(); // [WXG-T-434] 换关/重试/新局 ⇒ 归位连击清零（不跨局携带）
    this._actionsPlaying = 0;
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
    // fit 初始（[WXG-T-262] 小盘 fit > 1 = 整盘放大档，旧「与恒等逐位相同」口径已推翻）；
    // 回菜单 / 后台隐藏当帧不复位，由下次装配复位（ADR-0015 §3.4）。
    this._board.resetForAssembly();
    this._input.cancelPress(); // 抬起提交门不得跨装配存活（在途按压到新盘上会指向不存在的控件）
    this._layout = gridLayoutFor(this._grid.cols, this._grid.rows, this._board.camera);
    // ADR-0017 甲案：布局变（= 珠屏幕径变）即重算 LOD 档，带滞回（阈值附近不跳变闪烁）。
    this._beadLod = nextBeadLod(this._layout.cell, this._beadLod);
    this._boardSelected = null; // 换关 ⇒ 旧 board 锚指向的格已不存在
    this._solverFx = null; // 换关 / 重试 ⇒ 作废在途的 G2′ 队列
    this._fx.resetForLevel();
    this._tray.reset();
    this._resetPowerups();
    this._tray.initNeeded(this._grid.neededColorCounts());
    this._spawner.reset();
    this._spawner.interval = 4.0; // ⛔ 死路径缺省（供料关停，关卡字段已删）
    this._spawner.setDecoys(decoyColorIndices(level));
    // §3.7 v1.78 三档时钟：关卡 `time` = **1★ 档时钟**；本局档 = 本关历史最高 +1（封顶 3★，
    // 单条件闸门 R5），时钟按档缩放。**必须在写 `_starsByLevel` 之前算**（否则刚通的星会当场推高本局档）。
    this._tierThisLevel = nextTierFor(this._starsByLevel[index] ?? 0);
    this._timer.reset(tierSecondsFor(level.time, this._tierThisLevel, level.starTierK));
    this._sprint.reset();
    this._stageIndex = 0;
    this._isNewBest = false;
    this._clearReviveBookkeeping();
    // [T-244 二十二批] 装配即算守恒基准并体检一次（图案每色目标 vs 初盘每色实数）。
    // `noAssemble` 夹具盘故意不装配（全盘 empty）⇒ 只算基准不体检，避免假红。
    this._conservation.resetBaseline(!this._noBootAssembly);
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
    this._input.resetTapCount(); // 冲刺换 stage = 换关语义 ⇒ 计量同步归零
    this._actionsPlaying = 0;
    const { pattern } = buildStagePattern(n);
    this._grid = new BeadGrid(pattern);
    // WXG-T-172 · F3 甲裁：本行 = 复位点②（冲刺换 stage）。与 _setupLevel 那处合计 2 点，
    // 不变式 = 装配即复位；fit 按新棋盘尺寸重算（ADR-0015 §3.4）。
    this._board.resetForAssembly();
    this._input.cancelPress(); // 抬起提交门不得跨装配存活（在途按压到新盘上会指向不存在的控件）
    this._layout = gridLayoutFor(this._grid.cols, this._grid.rows, this._board.camera);
    // ADR-0017 甲案：布局变（= 珠屏幕径变）即重算 LOD 档，带滞回（阈值附近不跳变闪烁）。
    this._beadLod = nextBeadLod(this._layout.cell, this._beadLod);
    this._boardSelected = null; // 换 stage ⇒ 旧 board 锚指向的格已不存在
    this._tray.reset();
    this._resetPowerups(); // 冲刺换 stage = 换关语义，三计数一并复位（§2.5）
    this._tray.initNeeded(this._grid.neededColorCounts());
    this._spawner.reset();
    this._spawner.interval = stageParamsFor(n).interval;
    this._spawner.setDecoys([]);
    this._stageIndex = n;
    // [T-244 二十二批] 换 stage ⇒ 棋盘已换且故意是空盘 ⇒ 只重算基准，不体检。
    this._conservation.resetBaseline(false);
  }

  /**
   * **[WXG-T-434] 归位连击：一次正确落子推进 streak / 重置窗口 / 升档即播特效。**
   *
   * 纯感官：⛔ 不算分、不乘倍率、⛔ 不上 HUD。档位阈值 = §3.10 C3 `COMBO_STREAK_TIERS`
   * （经 `tierForStreak` 复用）、窗口 = C2 `COMBO_WINDOW_S` ⇒ **零新常量**。
   * `combo:up.multiplier` 在普通模式**恒发 1**（无倍率语义；⛔ 不改 §4 字段集合）。
   */
  private _armPlaceCombo(row: number, col: number): void {
    this._placeWindow = COMBO_WINDOW_S;
    this._placeStreak += 1;
    const tier = tierForStreak(this._placeStreak);
    if (tier > this._placeTier) {
      this._placeTier = tier;
      // 只记账，不 emit：见 `_placePendingTier` 注释（同帧音频预算）。
      if (tier > this._placePendingTier) {
        this._placePendingTier = tier;
        this._placePendingRow = row;
        this._placePendingCol = col;
      }
    }
  }

  /**
   * **[WXG-T-434] 把本批最高档的归位连击真正发出去**（特效 + `combo:up`）。
   * 调用点 = `_placeSelected` 组填充循环**之后**（一批落子 = 一次连击升级）。
   */
  private _flushPlaceCombo(): void {
    const tier = this._placePendingTier;
    if (tier <= 0) return;
    this._placePendingTier = 0;
    // 同帧只响一次（`fillBoard` 式的同帧批量落子会连升三档 ⇒ 挤掉同帧面板音）。
    if (this._placeUpFrame === this._frameSeq) return;
    this._placeUpFrame = this._frameSeq;
    const spec = comboVfxSpec(tier);
    if (spec) this._fx.armCombo(spec, this._placePendingRow, this._placePendingCol);
    this._emit('combo:up', { streak: this._placeStreak, multiplier: 1, tier });
  }

  /**
   * **[WXG-T-434] 归位连击断连**：`wrong` = 错色落子 / `timeout` = 超窗。
   * 无活跃 streak ⇒ 零动作零事件（与冲刺 `SprintTracker._break` 同门）。
   */
  private _breakPlaceCombo(reason: 'wrong' | 'timeout'): void {
    const live = this._placeStreak > 0;
    this._placeStreak = 0;
    this._placeWindow = 0;
    this._placeTier = 0;
    this._placePendingTier = 0;
    if (live) this._emit('combo:break', { reason });
  }

  /**
   * **[WXG-T-434] 归位连击清零**（换关 / 重开 / 新局）：⛔ 不发 `combo:break`
   * —— 重开不是「断连」，发事件会让提示音每次换关响一次。
   */
  private _resetPlaceCombo(): void {
    this._placeStreak = 0;
    this._placeWindow = 0;
    this._placeTier = 0;
    this._placePendingTier = 0;
  }

  /** One PLAYING frame: combo window → countdown (input is read in `update()`). The feed segment is dead (v2.0). */
  private _stepPlaying(dt: number): void {
    // 输入段已在 `update()` 头部落下（相位无关，WXG-T-100 / BD-34）。此守卫保留
    // 原语义——「读输入后若已离开 PLAYING（放置/阶段完成可在输入段内切相位：
    // cleared-priority / C8 stage-first）⇒ 本帧不再跑供料 / 连击窗 / 倒计时」。
    // 上提后该语义由**调用点**结构性地保证：`InputRouter.readFrame()` 若切走相位，
    // `machine.update()` 会直接派发新相位的 `onUpdate` ⇒ 本函数根本不会被调用。
    // 保留显式守卫作为该语义的锚点，并防未来新增调用点（如直接从别处驱动）时静默破约。
    if (this._machine.current !== 'playing') return;

    // Combo window (sprint only): placement already reset the window this
    // frame, so a same-frame placement never times out (score-combo §6).
    if (this._mode === 'sprint') {
      const broke = this._sprint.windowTick(dt);
      if (broke) this._emit('combo:break', { reason: broke });
    } else if (this._placeStreak > 0) {
      // [WXG-T-434] 归位连击窗口（普通模式）：同 `COMBO_WINDOW_S`、同「同帧落子先重置窗口」
      // 判例 ⇒ 同帧落子永不会被本帧 tick 判超时。超窗 = `timeout` 断连。
      this._placeWindow = Math.max(0, this._placeWindow - dt);
      if (this._placeWindow <= 0) this._breakPlaceCombo('timeout');
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

  /** Fold `_board.camera` into the grid layout (丁-3). Only called while a gesture is
   *  active — steady frames allocate nothing. ponytail: transient per-frame
   *  layout object during an active pinch/drag; pool-mutate it if profiling says so. */
  private _recomputeLayout(): void {
    this._layout = gridLayoutFor(this._grid.cols, this._grid.rows, this._board.camera);
    // ADR-0017 甲案：布局变（= 珠屏幕径变）即重算 LOD 档，带滞回（阈值附近不跳变闪烁）。
    this._beadLod = nextBeadLod(this._layout.cell, this._beadLod);
  }

  private _routeTap(x: number, y: number): void {
    this._consumedTap = false;
    // 好友榜面板 = 模态（ADR-0035 §5.2 S-3）：可见期吞掉一切其它点击，只派发面板按钮。
    if (this._rankPanel.visible) {
      this._consumedTap = true;
      const rankAction = this._rankPanel.hitTest(x, y);
      if (rankAction) this._rankPanel.tap(rankAction);
      return;
    }
    // 购买确认弹窗 = **模态**（ux-spec §3.7）：开窗期间其余控件全部不响应，
    // 「确定」才提交，「取消」或点板外一律零副作用关窗。
    if (this._pendingBuy) {
      this._consumedTap = true;
      if (hitBuyConfirm(x, y) === 'buy-confirm') this.confirmPowerupBuy();
      else this.cancelPowerupBuy();
      return;
    }
    // S2 route 0–3（HUD 控件：缩放 / 齿轮 / 道具卡 / 展开按钮）—— 见 `HudRouter`。
    // 三态：放行（pass）⇒ 继续相位分派；消费（consumed）⇒ 计入 `_consumedTap`；吞掉（swallowed）⇒ 不计消费、不进任何分支。
    const hud = this._hud.route(this._machine.current, x, y);
    if (hud !== 'pass') {
      this._consumedTap = hud === 'consumed';
      return;
    }
    switch (this._machine.current) {
      case 'playing': {
        // 4. Tray band (`TRAY_HIT_SIZE`² hit area = 60²，§3.8 v1.57 公式化；旧字面 62) — v2.0 内部分支
        //    4a holding / 4b 空槽，见 `_routeTraySlot`（带级次序不变）。
        const slot = hitTraySlot(x, y, this._tray.capacity, this.tuning.width);
        if (slot >= 0) {
          this._boardTaps.routeTraySlot(slot);
          return;
        }
        // 5. Grid cell (66² hit area, nearest cell centre wins) — v2.0 内部分支
        //    5a 错位珠 / 5b 空格 / 5c locked・就位，见 `_routeGridCell`。
        const cell = this._hitGridCell(x, y);
        if (cell) {
          this._boardTaps.routeGridCell(cell.row, cell.col);
        }
        return;
      }
      case 'game-over':
      case 'level-clear':
      case 'finish':
      case 'paused': {
        // 面板相位（PAUSED / LEVEL_CLEAR / FINISH / GAME_OVER）：面板外点击零响应。
        // `[WXG-T-440]` 命中已搬上路由栈：壳注入 `_panelHit`（= `UiRoot` 栈顶 presenter）时走它，
        // 未注入（Node 侧直调）回落 `PanelRouter` ⇒ 生产走栈、测试零改动。
        const phase = this._machine.current;
        this._consumedTap = this._panelHit ? this._panelHit(phase, x, y) : this.routePanelTap(phase, x, y);
        return;
      }
      default:
        return; // boot: taps ignored (panel answers are PAUSED-only)
    }
  }

  // ─────────────────────────────────────── 相位面板（ADR-0033 边界② / WXG-T-440）

  /**
   * `[WXG-T-440]` 注入面板命中委托（壳在拿到 `UiRoot` 后调一次）。
   *
   * 生产壳注入的闭包 = 「先 `syncPhase` 对账，再 `UiRoot.hitTest`」⇒ 命中与渲染出自**同一张路由表**。
   * ⛔ Node 侧测试不注入 ⇒ 仍是自带 `PanelRouter`（169 处 `tapDesign` 用例零改动）。
   */
  setPanelPresenter(hit: (phase: BeadsPhase, x: number, y: number) => boolean): void {
    this._panelHit = hit;
  }

  /**
   * `[WXG-T-440]` 相位面板的动作派发（= `PanelRouter.route` 的公开面）。
   * 路由 presenter 只拿得到面板名，动作本体仍在本类 ⇒ 由壳把「面板名 → 相位」映好后回调本方法。
   */
  routePanelTap(phase: BeadsPhase, x: number, y: number): boolean {
    return this._panelRouter.route(phase, x, y);
  }

  // ─────────────────────────────────────── 好友榜（ADR-0035 §5.2 S-3）

  /** 打开榜单面板（`settle-total` = 菜单总榜；`settle` = 结算面板上下文榜）。 */
  openRank(board: RankBoard, key: string): void {
    this._rankPanel.open(board, key);
  }

  /** 结算面板「好友这关榜」：当前关的稳定身份 token 作 key。 */
  openLevelRank(): void {
    this._rankPanel.open('settle', this._levelKeys[this._levelIndex] ?? '');
  }

  closeRank(): void {
    this._rankPanel.close();
  }

  get rankOpen(): boolean {
    return this._rankPanel.visible;
  }

  /** 只读视图（复用对象，零分配）。 */
  rankView(): RankPanelView {
    return this._rankPanel.view();
  }

  /** 菜单腿推进（dt 秒）。 */
  updateRank(dt: number): void {
    this._rankPanel.update(dt * 1000);
  }

  hitRank(x: number, y: number): RankPanelAction | null {
    return this._rankPanel.hitTest(x, y);
  }

  tapRank(action: RankPanelAction): void {
    this._rankPanel.tap(action);
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

  /**
   * HUD 带逐机上移量 = 实际设计高 − 1334 基准（`[WXG-T-280]` 宽恒定版式：高屏多出量全落顶部）。
   * 渲染（`snap.hudDy`）与齿轮热区同读本值 ⇒ 图与热区同源；静态档/无 viewport ⇒ 0。
   */
  private _hudDy(): number {
    const h = this._services?.viewport?.designHeight ?? DESIGN_H;
    const extra = h > DESIGN_H ? h - DESIGN_H : 0;
    // 胶囊底缘是「吞点击」硬约束：HUD 带顶缘压到其下方（仅小游戏宿主；其余档 0 = 旧行为）。
    return extra - this._capsuleBottom;
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
      // 设置类动作：只写设置 + 经 snapshot 回显（不切相位、不推计时；toggle-vibrate 的真机
      // vibrateShort 属平台适配层，批0 不接）。与主菜单设置 overlay 共用 `GameSettings.apply`。
      case 'toggle-bgm':
      case 'toggle-sfx':
      case 'toggle-reduce-motion':
      case 'toggle-large-text':
      case 'toggle-vibrate':
      case 'toggle-ghost-symbol':
      case 'cycle-bead-style':
      case 'cycle-bead-size':
      case 'cycle-skin':
        this._settings.apply(action);
        return;
      case 'toggle-debug-info':
        // pause-settings v1.6 §2.2：只写设置 + 经 snapshot 回显（不切相位），真机 QA 无 console 时的性能诊断入口。
        this.setDebugInfo(!this._settings.values.debugInfo);
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

  /**
   * 结算面板每帧：只在**星级入场**时各触发一次音效（ux-spec §5「每星叮上行」）。
   * 面板自身的入/出动画在 `update()` 里跑（表示层不停表，与 S9 面板同判例）。
   */
  private _stepLevelClear(dt: number): void {
    // G4 波浪推进 + 结算面板延迟门（裁定 1）。本相位内不存在 PAUSED，故照常推进；
    // `ClearPanel.update()` 在 `_shown = false` 时早退 ⇒ 星级计时不会在延迟期攒成一次爆发。
    this._fx.stepWave(dt);
    if (
      this._clearPanelPending &&
      !this._fx.waveActive &&
      this._machine.current === 'level-clear'
    ) {
      this._clearPanelPending = false;
      this._clearPanel.open();
      this._fx.startConfetti(); // G6 彩带与面板入场同帧启动（非 D1 路径；D1 直开不臂 = 整条关停）
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
    const shown = this._finishPanel.rowsShown(this._finishRowCount());
    while (this._finishRowsAnnounced < shown) {
      this._finishRowsAnnounced++;
      this._sfx(AUDIO_CLIP_STAR);
    }
  }

  /**
   * 是否**本章末关**（P0-1 · `core-loop §8-8`）。
   * 真源 = `arcs.ts::ARCS[].levelRefs` 派生的 `isBossLevelId`（1-based 关号）；
   * ⛔ 不新建第二套 boss 真源、⛔ 不把第一章关数写进常量（K-161 / K-151）。
   */
  private _isArcFinalIndex(index: number): boolean {
    return isBossLevelId(index + 1);
  }

  /** FINISH 总览关数：本章结算用本章长度；`-1`（未进本章结算）退回全表长度。 */
  private _finishRowCount(): number {
    return this._finishEndIndex >= 0 ? this._finishEndIndex + 1 : this._levels.length;
  }

  /**
   * 结算面板「下一关 / 查看结果」：**本章末关**或全局末关 → FINISH，否则推进到下一关。
   * `ux-spec §4` 流转表 = `LEVEL_CLEAR → 下一关 / 去冲刺*(U1) → 玩法·n+1 / 玩法·冲刺`
   * ——面板**等按钮**，此前的「1.4s 自动推进」占位已随本面板删除。
   *
   * MVP 期间章末不跨章 ⇒ 第一章 L9 即本切片的收尾关；跨章推进留后续批次。
   */
  private _advanceAfterClear(): void {
    if (this._machine.current !== 'level-clear') return;
    if (this._levelIndex >= this._levels.length - 1 || this._isArcFinalIndex(this._levelIndex)) {
      this._finishEndIndex = this._levelIndex;
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
    this._crashIO.clear();
    this._setupSprintRun();
    this._machine.reset('playing');
  }

  /**
   * 「重玩本关」/「重新冲刺」= 整关重置五项 (§3.5: 倒计时回满 / 图案清空但
   * locked 不动 / 托盘清空 / 扩展重置 / 道具免费次数回 POWERUP_FREE_USES).
   * Sprint also drops the combo state (P1 frozen 2026-09-12).
   */
  private _resetLevelForArtifact(): void {
    this._crashIO.clear(); // D-03：重玩本关 / 重新冲刺 ⇒ 旧快照失效
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
    this._abandoned = false; // 新局装配 = 重新入局（弃局标只活到下一次装配）
  }

  /** 广告发奖分发：按在飞种类路由到托盘扩容 / 续时（revive）/ 广告加心（staminaRefill）。 */
  private _onAdRewarded(): void {
    this._watchingAd = false;
    if (this._adKind === 'trayExpand') {
      this._adKind = null;
      this.expandTray();
      return;
    }
    if (this._adKind === 'staminaRefill') {
      this._adKind = null;
      const proceed = this._pendingRunStart;
      this._pendingRunStart = null;
      this._onStaminaRefill?.(); // shell: meta.grantAdHearts() → +HEART_AD_GAIN（§3.14 v1.80）
      // 加心后重放被拒的 run-start：+3 ≥ START_COST(1) ⇒ 扣心必成功，不会再次被拒。
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
    // 弃局后（已回主菜单）任何广告发奖不得复活旧棋盘（EP13-S3 串道反例：菜单侧看体力广告
    // 会广播到这里，旧 `game-over` 机器状态仍在 ⇒ 不加此守卫即白得 REVIVE_BONUS_SEC）。
    if (this._abandoned) return;
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
    this._conservation.mark(); // [T-244 二十二批] 哨兵入口（托→盘）
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
          // [T-244 修正 · 2026-10-04 用户报「没有错峰落子/没有下压/顺序不由近及远」]
          // 病灶：本循环每颗调 `FeedbackFx.armPlace`（**G1 单槽**）⟹ 逐颗互相覆盖，只有**最后一颗**
          // 有落座动画 ⟹ 组批量时：无错峰、无下压、顺序无从谈起（**首版挂错了路径**——
          // 只挂了 board 锚直填 `_tryDirectFillFromBoard`，而游戏主流程是本托盘锚路径）。
          // 修法：走 `_groupLandFx` 队列（step = 与**点击落珠位置**的距离）。
          //
          // [T-244 修正三批 · 2026-10-04 用户裁定「**所有落珠的空格**都播动画，延迟按与点击位置的
          // 距离决定，由近及远」] ⟹ **取消「组批量才播」的限制**：单颗（`groupSize === 1`）也走队列。
          // ⛔ 单颗时只有环 0 ⟹ 偏移 0 ⟹ 立即起播（与原 G1 单槽同帧起播等价，**无额外延迟**），
          //   观感连续性不断；`placeProgress` 不再被 arm（G1 单槽仅保留给 `_placeSelected` 之外的
          //   单格路径，如解环器相 A），故直喂 snapshot 的既有测试仍零感知。
          // [T-244 修正三批] 取消「组批量才播」限制：单颗也走队列；单颗 = 序号 0 ⟹ 零延迟起播。
          // `placeProgress` 不再被 arm（G1 单槽仅留给解环器相 A）⟹ 直喂 snapshot 的测试零感知。
          // [T-244 修正四批 · 用户裁「乙」] step = **落珠序号**（`i` = 填充序）⟹ 每颗都错峰（蛇形）。
          // ⛔ 撤销修正二批的「环号 + 同环同时」：用户明确改口径为**按落珠顺序**逐颗延迟。
          // 「由近及远」仍成立 —— `planGroupFill` 的填充序本身 = 被点格 + BFS 由近及远。
          this._fx.pushGroupLand(c.row, c.col, i);
          // GAP-03：首次落子即清引导（事件驱动，无计时器，§6.1）。
          // BD-32：引导完成**显式落盘** —— patch 只置 dirty，杀进程场景 flush 前丢
          // 写 ⇒ 此处一次性低频 IO 直接 save()。幂等守卫：仅首次落子写一次（后续
          // 落子零 S8 写，守 §8-11「放置不触存档」）。
          if (!this._onboardDone) {
            this._onboardDone = true;
            this._save?.patch({ onboarded: true });
            this._save?.save();
          }

          // [WXG-T-434] 归位连击（普通模式 · 纯感官）：与冲刺腿并列、互不干扰。
          if (this._mode === 'normal') this._armPlaceCombo(c.row, c.col);

          if (this._mode === 'sprint') {
            const score = this._sprint.onPlaced();
            if (score.tierUp !== null) {
              // §2.5 特效三档随倍率档触发；派生项：重叠时只播**最高档**。
              const spec = comboVfxSpec(score.tierUp);
              if (spec) this._fx.armCombo(spec, c.row, c.col);
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
        // [WXG-T-434] 本批落子结束 ⇒ 发一次最高档归位连击（组填充同批只响一次）。
        this._flushPlaceCombo();
        this._conservation.check('托盘落子 place'); // 每填一格必少一珠，混色重排写坏即报
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
          this._fx.armWrong(verdict.row, verdict.col);
        }
        if (this._mode === 'sprint') {
          const reason = this._sprint.onRejected();
          this._emit('combo:break', { reason });
        } else {
          // [WXG-T-434] 普通模式：错色落子 = 立即断连（与冲刺 `wrong` 同语义）。
          // `ignored` 分支（占用 / 锁定）**不断连** —— 那是无效点击而非失误。
          this._breakPlaceCombo('wrong');
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

  /** 音频请求门（实现与限流分档见 `GameSettings.sfx`）。 */
  private _sfx(clipId: string): void {
    this._settings.sfx(clipId);
  }

  /** Normal-mode clear → unlock progression (write on key events only). */
  private _persistProgress(): void {
    const save = this._save;
    if (!save) return;
    const levelCount = this._levels.length;
    // 0-based：过关 ⇒ 下一关（夹到关表末位）。
    const rawNext = Math.min(this._levelIndex + 1, levelCount - 1);
    // `[WXG-T-345]` S-4 **跨章推进钳制**（ADR-0034 §6 S-4 / §6.1 M-15）：门票只在章界那一刻
    // 参与解锁位推进 —— 回调不放行 ⇒ 解锁位停在当前关（本章末关），⛔ 越界把下一章首关白送。
    // 星账照写（关卡已通是事实）；「已得入口」的证据只住两根指针 ⇒ 运行期⛔ 回看门票（I7）。
    const blocked =
      rawNext !== this._levelIndex &&
      this._canAdvanceAcrossArc !== undefined &&
      !this._canAdvanceAcrossArc(this._levelIndex, rawNext);
    const nextIndex = blocked ? this._levelIndex : rawNext;
    const nextKey = this._levelKeys[nextIndex] ?? '';
    // 解锁位**只增不减**（I7 棘轮 D）；右值取自身份表，⛔ 数值位置。
    const maxIndex = Math.max(this._maxUnlockedIndex, nextIndex);
    const maxKey = this._levelKeys[maxIndex] ?? '';
    // 无身份槽（`''` = beads-studio 导入草案）不入档、不推进指针：草案未过生成器无 uid，
    // 写空串会把指针打回兜底（降级登记，非发布路径）。
    if (maxKey !== '') this._maxUnlockedIndex = maxIndex;
    if (nextKey !== '') this._lastPlayedIndex = nextIndex;
    save.patch({
      maxUnlockedKey: maxKey !== '' ? maxKey : save.data.maxUnlockedKey,
      lastPlayedKey: nextKey !== '' ? nextKey : save.data.lastPlayedKey,
      // S8 §2.2 `stars` / §8-2：每关历史最高星（max 在过关记分处取，这里只负责落档）。
      // ADR-0034 **DEC-3** 的第二条边界换算（收拢，每局 ≤1 次）：下标镜像 → 身份账；
      // 无身份槽（`''`，dev 导入草案）不入档。⛔ 不在本路径构造 `levelKeys`（只读镜像）。
      starsByUid: collapseStars(this._starsByLevel, this._levelKeys),
      // v6 品质分最佳账：稀疏镜像的浅拷贝（⛔ 直接把可变态交给存档层 ⇒ 避免别名）。
      settleBestByUid: { ...this._settleBestByUid },
    });
    save.save();
  }

  // ───────────────────────────────────────────────────────────── hit testing

  /** Nearest grid cell within the camera-scaled hit area (ties → smaller row).
   *  Delegates to `tuning::hitGridCell` so gameplay and the layout⇄hit regression
   *  test share one implementation (WXG-T-169 / ADR-0015). */
  private _hitGridCell(x: number, y: number): { row: number; col: number } | null {
    return hitGridCell(this._layout, this._board.camera.zoom, x, y);
  }

  /**
   * DEBUG 缩放设定（dev/harness / Console）：直接设相机倍率，**跳过滑杆交互**。
   *
   * 用途：把「格间白线是否随缩放相位出现」从肉眼判断变成**可复现的实测**——headless
   * 截图无法点滑杆，而白线是**分数设备像素**现象（同 `zoom × dpr × 窗口宽` 的相位函数），
   * 必须能按指定倍率出图才谈得上量化。
   *
   * 与 `setDebugOutlines` 同型：**不持久化、不参与玩法、无副作用**（复用同一条
   * `setCameraZoom` + `_recomputeLayout` 路径 ⇒ 与滑杆设出的状态**完全同构**）。
   * ⛔ 越界值由 `setCameraZoom` 自带 clamp 兜住（`CAMERA_ZOOM_MIN 0.2 … MAX 2.0`）。
   *
   * 用法：`__beads.game.setZoomForDebug(1.37)` 或 harness `?game=beads&zoom=1.37`。
   */
  setZoomForDebug(zoom: number): void {
    this._board.setZoom(zoom);
  }

  /**
   * DEBUG 开关（dev/harness / Console）：开则绘制腿（`ui/play-binding.ts` → 视图）每帧在盘面叠画虚线——
   * 底图 tile 轮廓（品红，固定 `BEAD_PITCH`）与珠/槽轮廓（青，缩放 `gridCell`）。甲案后真实底图
   * `drawTargetTile` 已随相机缩放，品红框因此是「若 tile 仍不缩放会怎样」的**诊断参照**、非当前实画尺寸；
   * 与青色缩放轮廓的宽度差即曾致相邻重叠/不居中的可视化。不持久化、不参与玩法；关即零开销（view 跳过）。
   * 用法：`__beads.game.setDebugOutlines(true)` 或 harness `?game=beads&dbg=outline`。
   */
  setDebugOutlines(on: boolean): void {
    this._debugOutlines = on;
  }

  /**
   * [T-244 十八批] 切**单色齐备提示**的表达档（用户裁「几种方案都实现出来对比」）：
   * `jump` 逐列跳 / `pulse` 亮一档 / `lock` 常驻环 / `off` 全关（对照）。
   * 只换渲染通道，**不动触发时机与参与集**（`_maybeColorCue`）⇒ 四档看到的是同一件事。
   * 不持久化、不参与玩法。用法：harness `?game=beads&cue=pulse` 或 `__beads.game.setColorCueMode('lock')`。
   */
  setColorCueMode(mode: ColorCueMode): void {
    this._fx.setCue(mode);
  }

  /**
   * DEBUG 性能覆层开关（pause-settings v1.6 §2.2）：开则 view 在主循环之上叠画
   * fps / 帧耗时 / 相位 / 格距·LOD 只读诊断面板。与 `setDebugOutlines` 同走
   * snapshot 暴露，唯一差别是经 `settings.debugInfo` **持久化**（真机 QA 无
   * console / query 可用，需跨重启保留）。用法：暂停面板行 4「性能信息」或
   * `__beads.game.setDebugInfo(true)` / harness `?dbg=info`。
   */
  setDebugInfo(on: boolean): void {
    if (this._settings.values.debugInfo === on) return;
    this._frameMs = 0; // 重开时从首帧实测值重新起步，不读旧 EMA
    this._settings.setDebugInfo(on);
  }

  /** 菜单安全区标定线。与 `setDebugInfo` 一样即写档，缺字段旧档降级 false。 */
  setDebugGuides(on: boolean): void {
    if (this._settings.values.debugGuides === on) return;
    this._settings.setDebugGuides(on);
  }

  /**
   * 装扮馆点卡 = **定向穿档**（WXG-T-363 · `ux-spec` v1.25 §3.8）：与暂停面板的 `cycle-skin`
   * 共用同一个 `GameSettings` 受理点（两入口状态恒一致），买断门也在彼处（options.ownsSkin）。
   * 本方法 ⛔ 判拥有态（买断闭环归 shell，它才持有 `MetaState`）；生效 = 下一帧、零过渡（§3.3 口径）。
   */
  wearSkin(skinId: string): void {
    this._settings.wearSkin(skinId);
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
      tapActive: this._board.tapActive,
      tapMoved: this._board.tapMoved,
      pinched: this._board.pinched,
      isDown: !!s && s.isDown,
      isDown2: !!s && s.isDown2,
      // 拖拽位移的直接源头：pan 用 snap.dx/scale。dx 恒 0 ⇒ 断在输入层；dx 非 0 而
      // offsetX 仍 0 ⇒ 断在 `InputRouter.readFrame` 分支或 clamp（K-036：不拿猜测当定位）。
      snapX: s ? s.x : 0,
      snapY: s ? s.y : 0,
      dx: s ? s.dx : 0,
      dy: s ? s.dy : 0,
      // 逐帧累计量：避开「在固定步之外读 snapshot」的时窗假象（dx 可能已归零）。
      panFrames: this._board.dbgPan.frames,
      panDxSum: this._board.dbgPan.dxSum,
      panMovedFrames: this._board.dbgPan.movedFrames,
      zoom: this._board.camera.zoom,
      offsetX: this._board.camera.offsetX,
      offsetY: this._board.camera.offsetY,
      pinchDist0: this._board.pinchDist0,
    };
  }

  // ─────────────────────────────────────────────────────────────── snapshot

  private _lastStars = 0;
  /** 本局结算发豆结果（§3.14 v1.81）；`null` ⇒ 面板不画该行。每局 `level-clear` 重算。 */
  private _clearCoins: ClearCoinGrant | null = null;

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
    return this._fx.comboVfx;
  }

  /**
   * G7 轻压起播入口（`assets-spec §1.6.7`）：void（谜面外形格）/ 越界在此守卫；门内不放音。
   */
  private _armDeniedFx(row: number, col: number): void {
    const cell = this._grid.cell(row, col);
    if (!cell || cell.void) return; // §1.6.7 非触发集：越界 / `.` 外形格
    if (this._fx.armDenied(row, col)) this._sfx(AUDIO_CLIP_DENIED);
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
   * G2′ 推进（相 A → 相 B）。**不是表现层步进**（与 `FeedbackFx.stepPresentation` / `FeedbackFx.stepPresentation` 的
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
   * [T-244 十六批] 某色的**全部珠子各归其位** ⇒ 发一条单色齐备提示（十八批 = 三档表达同一个时机、
   * 同一参与集，只换渲染通道：`jump` 逐列跳 / `pulse` 亮一档 / `lock` 常驻环）。
   *
   * 判据（单向即充分）：每个**底色为 C** 的可填格都已填着 C 珠。
   * 充分性 = 关卡不变式「C 珠总数 == 底色 C 的格数」（`validateBeadsLevel` 静态校验）
   * ⇒ 全格填对 ⇒ 不存在歪在他格或留在托盘的 C 珠。锁定/镂空格底色恒 0 ⇒ 天然不参与。
   *
   * 触发点 = `bead:placed`（放置是全库唯一能让某色「由缺变齐」的边，且各条放置路径——
   * 单颗 / 组填 / 盘内移动 / 解环器——都已汇流到这条事件）⇒ 无需逐帧轮询。
   * 代价 O(rows×cols) 落在**输入路径**（非每帧热路径），单循环零分配。
   *
   * 单调性 ⇒ 每色至多触发一次：就位珠是终态（`retrieve` 拒绝 ⇒ 齐了不会再缺）。
   * [T-244 十八批] `_colorLockMask` 不是「防重触发」位图（单调性已保证），而是 `lock` 档的
   * **常驻表达**载体（齐了就得一直看得出来）。
   *
   * ⛔ 全盘达成时不臂：那一帧 `level-clear` 的 G4 全场波浪已在放（本色珠是其子集）
   *   ⇒ 同一格同帧两条同形语言会互相覆写（`view-model` 里 G4 优先级在前）。
   *   （锁定位图仍不置 ⇒ 全盘那一帧已无需单色信号。与 G4 同判例。）
   */
  private _maybeColorCue(colorIdx: number): void {
    if (colorIdx <= 0 || this._grid.isComplete()) return;
    const grid = this._grid;
    for (let i = 0; i < grid.rows; i++) {
      for (let j = 0; j < grid.cols; j++) {
        const cell = grid.cell(i, j);
        if (!cell || cell.void || cell.colorIdx !== colorIdx) continue;
        if (cell.state !== 'filled' || cell.beadColorIdx !== colorIdx) return; // 本格还缺 ⇒ 未齐
      }
    }
    this._fx.markColorAligned(colorIdx);
  }

  /** 每关历史最好星级（`0` = 未通关）—— 通关画面总览的数据源（测试读它）。 */
  get starsByLevel(): readonly number[] {
    // 内部按需写入（稀疏）；对外一律**稠密**（未通关 = 0），与快照同一契约。
    const out: number[] = [];
    for (let i = 0; i < this._levels.length; i++) out.push(this._starsByLevel[i] ?? 0);
    return out;
  }

  private _syncSnapshot(): void {
    projectSnapshot(this._snapshot, this._snapshotSource);
  }

  /**
   * 事件总线出口 + 触觉映射（WXG-T-403）。
   *
   * 特定事件自动衍生一条 `haptic:trigger` 意图，由 shell 订阅 gated by
   * `vibrateOn` 再调 `services.haptic?.()`。kind 映射表：
   * - bead:placed → light（轻触放珠）
   * - bead:rejected → heavy（碰撞反弹）
   * - combo:up → medium（连击递进）
   * - combo:break → heavy（连击断裂）
   * - level:cleared → success（过关）
   * - level:failed → warning（失败）
   * - powerup:used → medium（道具触发）
   *
   * haptic:trigger / settings:* / meta:* / game:* / timer:* / tray:* /
   * sprint:* → 不衍生（要么是元事件要么是已经过细或已被消费过的事件）。
   */
  private _emit<K extends keyof BeadsEvents>(type: K, payload: BeadsEvents[K]): void {
    if (!this._services) return;
    const bus = this._services.events as unknown as {
      emit: (type: string, payload: unknown) => void;
    };
    bus.emit(type as string, payload);
    // 衍生 haptic —— 防 haptic:trigger 自身递归（映射表迁至 effects-dispatch.ts::hapticKindFor）
    if (type === 'haptic:trigger') return;
    const kind = hapticKindFor(type as string);
    if (kind !== undefined) {
      bus.emit('haptic:trigger', { kind });
    }
  }
}

/** Convenience factory used by the dev harness and tests. */
export function createBeadsGame(options: BeadsGameOptions = {}): BeadsGame {
  return new BeadsGame(options);
}

