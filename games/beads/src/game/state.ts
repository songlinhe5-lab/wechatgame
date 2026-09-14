/**
 * Beads phases, transition table and the render snapshot contract.
 *
 * Six states straight from core-loop §2.1; the sprint mode is a *mode flag on
 * the Game*, so the machine itself has zero sprint branches (score-combo §2.1).
 *
 * The snapshot is the ONLY thing the view layer sees — flat, read-only,
 * rebuilt in place from authoritative state each frame (control-manifest §8).
 */

import type { SlotState } from '../entities/tray.js';
import type { CellState } from '../entities/grid.js';
import {
  POWERUP_FREE_USES,
  type BeadsTuning,
  type PowerupType,
} from '../config/tuning.js';

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
  colorIdx: number;
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
  /** GAP-03 首屏引导是否激活（runs==0 且本会话未落过子）。 */
  onboarding: boolean;
  /** GAP-03/04 单一 `hint` 目标格（行主序首个匹配首珠色的空槽；无 = -1）。 */
  hintRow: number;
  hintCol: number;
  /** GAP-03 首珠脉冲所在托盘槽（无 = -1）。 */
  guideSlot: number;

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
    panelVisible: false,
    panelProgress: 0,
    panelInteractive: false,
    bgmMuted: false,
    sfxMuted: false,
    reduceMotion: false,
    largeText: false,
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
      region: POWERUP_FREE_USES,
      clearAll: POWERUP_FREE_USES,
      random: POWERUP_FREE_USES,
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
    onboarding: false,
    hintRow: -1,
    hintCol: -1,
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
