/**
 * Beads phases, transition table and the render snapshot contract.
 *
 * Six states straight from core-loop §2.1; the sprint mode is a *mode flag on
 * the Game*, so the machine itself has zero sprint branches (score-combo §2.1).
 *
 * The snapshot is the ONLY thing the view layer sees — flat, read-only,
 * rebuilt in place from authoritative state each frame (control-manifest §8).
 */

import type { SlotState } from '../entities/tray';
import type { CellState } from '../entities/grid';
import {
  DENIED_MAX_CELLS,
  POWERUP_FREE_USES,
  SOLVER_MAX_CELLS,
  VIBRATE_DEFAULT,
  type BeadsTuning,
  type PowerupType,
} from '../config/tuning';

export type BeadsPhase = 'boot' | 'playing' | 'paused' | 'level-clear' | 'game-over' | 'finish';
export type GameMode = 'normal' | 'sprint';

/**
 * Declared legal edges. Anything not listed is impossible by construction:
 * cleared/failed/pause all leave PLAYING; only PLAYING resumes from PAUSED;
 * retry / revive (game-over) and next-level (level-clear) re-enter PLAYING.
 */
export const PHASE_TRANSITIONS: Readonly<Record<BeadsPhase, readonly BeadsPhase[]>> = {
  boot: ['playing'],
  playing: ['paused', 'level-clear', 'game-over'],
  paused: ['playing'],
  'level-clear': ['playing', 'finish'],
  'game-over': ['playing'],
  finish: ['playing'],
};

/** Mutable per-cell view struct — reused, never retained (hot-path rule). */
export interface SnapshotCell {
  state: CellState;
  /** 底色 — the colour the pattern requires at this cell (0 locked/void). */
  colorIdx: number;
  /**
   * Colour of the bead occupying the cell (v2.0 错位归位; 0 = empty). Differs
   * from `colorIdx` exactly on misplaced cells — E6 renders the bead from
   * this and the socket from `colorIdx`.
   */
  beadColorIdx: number;
  /** `.` cells: outside the pattern shape — render as background. */
  void: boolean;
}

/** Mutable per-slot view struct — reused, never retained. */
export interface SnapshotSlot {
  state: SlotState;
  colorIdx: number;
}

/** Read-only, per-frame view of the world handed to the renderer. */
export interface BeadsSnapshot {
  phase: BeadsPhase;
  phaseElapsed: number;
  mode: GameMode;

  levelIndex: number;
  levelId: string;
  levelName: string;
  levelCount: number;

  /** Countdown, display seconds (ceiled). */
  remaining: number;
  timeTotal: number;
  urgent: boolean;

  /** Grid dimensions; `cells` is a flat row-major array (row 0 = top row). */
  gridCols: number;
  gridRows: number;
  cells: SnapshotCell[];

  /** Tray slots (flat; capacity 12 or 24 when expanded). */
  traySlots: SnapshotSlot[];
  trayExpanded: boolean;
  traySelected: number;
  /**
   * v2.0 统一选择锚 · board 侧（Epic T-133 E2）：选中的错位珠格坐标，E6 据此
   * 画高亮；`-1` = 无 board 锚。与 `traySelected`（tray 锚）**三值互斥**
   * （input-control §2.1：`selection ∈ {tray, board, none}`）——至多一侧 ≥ 0。
   */
  boardSelectedRow: number;
  boardSelectedCol: number;
  /**
   * board 锚的**连通错位珠组**（WXG-T-148 ③，预分配 64 容量写值不新建）。
   * `boardGroupCount = 0` 表示无锚；组内格渲染层画统一抬起效果。
   */
  boardGroupRows: number[];
  boardGroupCols: number[];
  boardGroupCount: number;

  /** S9 pause panel: visible = anything drawn (incl. the exit fade). */
  panelVisible: boolean;
  /** Panel animation progress, 0→1 entering, 1→0 leaving. */
  panelProgress: number;
  /** True only while the panel accepts taps (not during the exit fade). */
  panelInteractive: boolean;
  /** S9 audio toggles for immediate visual echo (no restart needed). */
  bgmMuted: boolean;
  sfxMuted: boolean;
  /** WXG-T-088 accessibility toggles (view reads these off the snapshot). */
  reduceMotion: boolean;
  largeText: boolean;
  /** §3.8 震动开关（WXG-T-164；view 经 snapshot 回显面板行开/关）。 */
  vibrate: boolean;

  /** Sprint HUD — normal mode leaves these at zero and the view hides them. */
  score: number;
  multiplier: number;
  streak: number;
  stageIndex: number;
  sprintBestScore: number;
  isNewBest: boolean;

  /** Stage geometry for hit-testing-agnostic rendering (§3.3 derivation). */
  gridLeft: number;
  gridTop: number;

  /** Banner text for the current phase ('' when none). */
  banner: string;
  subBanner: string;

  /** BOOT validation failure — the game refuses to enter PLAYING (core-loop §2.1). */
  bootError: string;

  /** Ordinary GAME_OVER: the fail overlay may still offer a revive. */
  reviveAvailable: boolean;
  /** True after a successful fail-page revive this attempt. */
  revived: boolean;
  /** True while a fail-page ad `show()` is in flight. */
  watchingAd: boolean;
  /** One-shot copy under the fail panel (e.g. Noop 「即将开放」). */
  failHint: string;

  /**
   * S6 **剩余免费次数**，每道具一项（`0..POWERUP_FREE_USES`）。视图把 `0` 的卡
   * 变灰，超限入口靠常驻 `ad_badge`（powerups §2.6 布局 A —— 仅角标，零 wx API）。
   *
   * 注意与崩溃快照的 `powerupUses`（语义 = **已用次数**）区分：这里给视图，
   * 那里给恢复档，两者互为 `POWERUP_FREE_USES − x`。
   */
  powerupFreeUses: Record<PowerupType, number>;
  /** One-shot light hint under the powerup band (over-limit tap only, §2.6). */
  powerupHint: string;

  /** S7 结算·过关面板（`ux-spec §3.4`）：可见性 + 入/出进度 + 是否接受点击。 */
  clearPanelVisible: boolean;
  /** 面板入/出进度，0→1 进入、1→0 退出（与 S9 面板同口径）。 */
  clearPanelProgress: number;
  clearPanelInteractive: boolean;
  /** 本关星级 1..3。 */
  clearStars: number;
  /** 已入场的星数（`0..clearStars`）—— 视图据此逐颗显示（ux-spec §5，逐颗 150ms）。 */
  clearStarsShown: number;
  /** 最新入场那颗星的弹跳缩放（0→1.2→1；已稳定 = 1）。 */
  clearStarPopScale: number;
  /** 次要信息「剩余 mm:ss ｜ 道具 n/3」的两项原料。 */
  clearRemaining: number;
  clearPowerupsUsed: number;
  /** 末关 ⇒ 主钮文案「查看结果」（点后进 FINISH）。 */
  clearLastLevel: boolean;

  /** S7 通关画面（FINISH，`ux-spec §3.6`）：可见性 + 入/出进度 + 是否接受点击。 */
  finishPanelVisible: boolean;
  finishPanelProgress: number;
  finishPanelInteractive: boolean;
  /**
   * 每关**历史最好**星级（长度 = 关卡数，`0` = 未通关）—— 通关画面的「星级总览」。
   * 取值口径 = 每关 max；**权威在存档**（S8 §2.2 `stars`，WXG-T-071 起跨重启保持）。
   */
  finishStars: number[];
  /** 已入场的总览**关数**（`0..finishStars.length`，逐关 150ms）。 */
  finishRowsShown: number;
  /** 最新入场那一行的弹跳缩放（0→1.2→1；稳定 = 1）。 */
  finishRowPopScale: number;

  /** S7 冲刺结算面板（`ux-spec §3.5` 左列，GAME_OVER · 冲刺态）：可见性 + 入/出进度。 */
  sprintSettleVisible: boolean;
  sprintSettleProgress: number;
  sprintSettleInteractive: boolean;
  /**
   * 本局**最远梯位**（0-based；面板显示 `+1`）与**最高连击**（`ux-spec §3.5` 第 2/3 行）。
   * 与 `sprintBestScore`（**历史最佳**，跨局）区分：这两个是**本局**的。
   */
  sprintRunBestStage: number;
  sprintRunBestStreak: number;

  /**
   * S7 连击特效（`score-combo §2.5`）：当前档位的**形态**与播放进度；`''` = 无特效。
   * ⚠️ Lv2（`pseudoShake`）的「整屏 scale」需要**全局变换通道**，当前渲染管线没有 ⇒
   * 该档只把值算对（见 `view/combo-vfx.ts` 的平台缺口说明），视图不为它假造替代画面。
   */
  comboVfxKind: '' | 'particles' | 'pseudoShake' | 'burst';
  comboVfxProgress: number;
  /** 特效锚点：Lv1 粒子的落子格心（无特效 = -1）。 */
  comboVfxRow: number;
  comboVfxCol: number;

  /**
   * GAP-04/03/10 反馈态相位（WXG-T-087）。均为**单调表现时钟**驱动，
   * 与面板/连击特效同判例 —— PAUSED 冻结玩法不冻结表现。毫秒真源 ux-spec §5。
   */
  /** 单调表现时钟（ms）：循环脉冲（告急 α、hint 呼吸、满槽）的相位基准。 */
  pulseClock: number;
  /** GAP-04 `wrong` 态：被拒格心（无动画 = -1）与播放进度 0..1。 */
  wrongRow: number;
  wrongCol: number;
  wrongProgress: number;
  /**
   * G1 `vfx_fill_pop` 落座回弹（WXG-T-128 / `assets-spec §1.6.1`）：刚填入的**网格**格
   * 与播放进度 0..1（无动画 = -1 / 0）。与 `wrong*` 同构 = **单调标量**，包络曲线由
   * view 侧纯函数推导（L5：渲染不持有游戏状态）；`reduceMotion` 的退化也在 view 侧。
   */
  placeRow: number;
  placeCol: number;
  placeProgress: number;
  /**
   * G2′ `vfx_solver_restore` 解环器归位（WXG-T-150 / `assets-spec §1.6.2a`）：
   * 整条序列（相 A 预警 + 相 B 逐颗落座）的单调进度，`0` = 不播放。
   * 绝对毫秒 = `solverProgress × solverSequenceMs(solverCellCount)`（单一真源在 `tuning`，
   * game 定窗 / view 还原同用一式）。
   */
  solverProgress: number;
  /**
   * 相 A 点名格（= S6 `powerup:used.affectedCells`，行主序、≤ `SOLVER_MAX_CELLS`）。
   * 这些格在预警窗口内**仍是错位珠**（用户裁定「甲」：动手延后到相 A 之后）。
   */
  solverCellRows: number[];
  solverCellCols: number[];
  solverCellCount: number;
  /**
   * 相 B 落座格（= 归位后**收到珠**的格；交换场景一步两格 ⇒ 共享同一 `step`）。
   * 三数组等长、`step` = 该格属于序列里的第几颗（view 侧据此算逐颗 80ms 错开的局部相位）。
   */
  solverLandRows: number[];
  solverLandCols: number[];
  solverLandSteps: number[];
  solverLandCount: number;
  /**
   * G3 `vfx_powerup_sweep` 道具生效扫光（WXG-T-146 / `assets-spec §1.6.3`）：斜带覆盖整个玩法区
   * ⇒ **无空间坐标**，只需一个单调标量（0 = 不绘制）；几何与缓动全在 view 侧推导。
   */
  sweepProgress: number;
  /**
   * G6 `vfx_confetti` 结算彩带（WXG-T-153 / `assets-spec §1.6.6`）：44 枚全由 idx 派生
   * ⇒ 同 sweep 同构，一个单调标量（0 = 不绘制/未激活）；分布/逐帧几何全在 view 侧纯函数推导（L5）。
   */
  confettiProgress: number;
  /**
   * G4 `vfx_complete_wave` 过关庆祝波浪（WXG-T-146 / `assets-spec §1.6.4`）：
   * 全场逐列弹跳 ⇒ **无逐珠坐标**（列号 = 网格 `j`，窗口时长由 `snap.gridCols` 推导）。
   * 0 = 不播放；1 = `WAVE_MS` 走完。同时 = 结算面板的**延迟门**（裁定 1）。
   */
  waveProgress: number;
  /**
   * G7 `vfx_denied_press` 不可填格轻压（WXG-T-152 / `assets-spec §1.6.7`）：
   * **多格并存**（同格 250ms 门，不同格可同时在播）⇒ 定长槽数组
   * （容量 `DENIED_MAX_CELLS` = 工程选择，非规格值），`row = -1` = 空槽，
   * `deniedProgress[k]` 0..1 = 该槽单调进度（包络曲线 view 侧纯函数推导，L5 同 `place*` 判例）。
   * 预分配一次 ⇒ 逐帧只写值，热路径零分配。
   */
  deniedRows: number[];
  deniedCols: number[];
  deniedProgress: number[];
  deniedCount: number;
  /** GAP-03 首屏引导是否激活（runs==0 且本会话未落过子）。 */
  onboarding: boolean;
  /** GAP-03/04 单一 `hint` 目标格（行主序首个匹配首珠色的空槽；无 = -1）。 */
  hintRow: number;
  hintCol: number;
  /** GAP-03 首珠脉冲所在托盘槽（无 = -1）。 */
  guideSlot: number;
  /**
   * 一次性「轻提示」（ux-spec §5 WXG-T-097；BD-16 无选中点格 / BD-15 扩展位占位共用）。
   * `''` = 无；`tapHintRow/Col` = 锚点格。L5：只读相位，不持状态。
   */
  tapHintText: string;
  tapHintRow: number;
  tapHintCol: number;
  /**
   * 轻提示锚点（§5）：`'cell'` = 落在被点的可落空格格心（BD-16）；
   * `'expand'` = 落在 `btn_expand` 正下方的空白带隙（BD-15，`AD_HINT_TEXT_Y`）。
   */
  tapHintAnchor: 'cell' | 'expand';

  tuning: BeadsTuning;
}

/** Build the mutable snapshot object (created once, updated in place). */
export function createSnapshot(tuning: BeadsTuning): BeadsSnapshot {
  return {
    phase: 'boot',
    phaseElapsed: 0,
    mode: 'normal',
    levelIndex: 0,
    levelId: '',
    levelName: '',
    levelCount: 0,
    remaining: 0,
    timeTotal: 0,
    urgent: false,
    gridCols: 0,
    gridRows: 0,
    cells: [],
    traySlots: [],
    trayExpanded: false,
    traySelected: -1,
    boardSelectedRow: -1,
    boardSelectedCol: -1,
    boardGroupRows: new Array<number>(64).fill(-1),
    boardGroupCols: new Array<number>(64).fill(-1),
    boardGroupCount: 0,
    panelVisible: false,
    panelProgress: 0,
    panelInteractive: false,
    bgmMuted: false,
    sfxMuted: false,
    reduceMotion: false,
    largeText: false,
    vibrate: VIBRATE_DEFAULT,
    score: 0,
    multiplier: 1,
    streak: 0,
    stageIndex: 0,
    sprintBestScore: 0,
    isNewBest: false,
    gridLeft: 0,
    gridTop: 0,
    banner: '',
    subBanner: '',
    bootError: '',
    reviveAvailable: false,
    revived: false,
    watchingAd: false,
    failHint: '',
    powerupFreeUses: {
      solver: POWERUP_FREE_USES,
      solverPlus: POWERUP_FREE_USES,
      solverRandom: POWERUP_FREE_USES,
    },
    powerupHint: '',
    clearPanelVisible: false,
    clearPanelProgress: 0,
    clearPanelInteractive: false,
    clearStars: 0,
    clearStarsShown: 0,
    clearStarPopScale: 1,
    clearRemaining: 0,
    clearPowerupsUsed: 0,
    clearLastLevel: false,
    finishPanelVisible: false,
    finishPanelProgress: 0,
    finishPanelInteractive: false,
    finishStars: [],
    finishRowsShown: 0,
    finishRowPopScale: 1,
    sprintSettleVisible: false,
    sprintSettleProgress: 0,
    sprintSettleInteractive: false,
    sprintRunBestStage: 0,
    sprintRunBestStreak: 0,
    comboVfxKind: '',
    comboVfxProgress: 0,
    comboVfxRow: -1,
    comboVfxCol: -1,
    pulseClock: 0,
    wrongRow: -1,
    wrongCol: -1,
    wrongProgress: 0,
    placeRow: -1,
    placeCol: -1,
    placeProgress: 0,
    // G2′（WXG-T-150）：预分配容量 ⇒ 逐帧只写值、不新建（热路径零分配）。
    // 上界 = `SOLVER_MAX_CELLS`（点名）与其 2 倍（交换一步两格）。
    solverProgress: 0,
    solverCellRows: new Array<number>(SOLVER_MAX_CELLS).fill(-1),
    solverCellCols: new Array<number>(SOLVER_MAX_CELLS).fill(-1),
    solverCellCount: 0,
    solverLandRows: new Array<number>(SOLVER_MAX_CELLS * 2).fill(-1),
    solverLandCols: new Array<number>(SOLVER_MAX_CELLS * 2).fill(-1),
    solverLandSteps: new Array<number>(SOLVER_MAX_CELLS * 2).fill(-1),
    solverLandCount: 0,
    sweepProgress: 0,
    confettiProgress: 0,
    waveProgress: 0,
    // G7（WXG-T-152）：与 solver 数组同判例，预分配 ⇒ 逐帧只写值。
    deniedRows: new Array<number>(DENIED_MAX_CELLS).fill(-1),
    deniedCols: new Array<number>(DENIED_MAX_CELLS).fill(-1),
    deniedProgress: new Array<number>(DENIED_MAX_CELLS).fill(0),
    deniedCount: 0,
    onboarding: false,
    hintRow: -1,
    hintCol: -1,
    tapHintText: '',
    tapHintRow: -1,
    tapHintCol: -1,
    tapHintAnchor: 'cell',
    guideSlot: -1,
    tuning,
  };
}

/** Human-readable banner copy per phase (kept out of the renderer). */
export function bannerFor(phase: BeadsPhase, isLastLevel: boolean): { banner: string; sub: string } {
  switch (phase) {
    case 'boot':
      return { banner: '', sub: '' };
    case 'playing':
      return { banner: '', sub: '' };
    case 'paused':
      return { banner: '已暂停', sub: '' };
    case 'level-clear':
      return { banner: '过关！', sub: isLastLevel ? '全部完成！' : '下一关来了…' };
    case 'game-over':
      return { banner: '时间到', sub: '' };
    case 'finish':
      return { banner: '全部通关！', sub: '' };
    default:
      return { banner: '', sub: '' };
  }
}
