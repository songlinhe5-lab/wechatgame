/**
 * 反馈特效时钟（表现层计时：GAP-04/03/10 · G1 落座 / G3 扫光 / G4 波浪 / G6 彩带 / G7 轻压 ·
 * T-244 托盘进珠 / 组落座 / 单色提示 · S7 连击 · BD-16 轻提示）。
 *
 * 自 `beads-game.ts` 拆出（BeadsGame 重构 · 协作类 ④）。判例统一：**表现层不被 PAUSED 冻结**
 * （与面板动画同判例）；单标量 / 定长槽 / 到点自清 ⇒ 零残留；起播带重启门，门的时基 =
 * `_pulseClock`（本类自己推进的单调毫秒）。
 *
 * 边界（⛔ 不在本类）：
 *   · `_solverFx`（G2′ 解环器）：推进会**写棋盘**，属玩法提交时序 ⇒ 留在 BeadsGame；
 *   · 「判定什么时候该亮」（`_maybeColorCue` 的棋盘判据）与清盘面板的开关流程 ⇒ 留在 BeadsGame；
 *   · 音效：起播是否成功由返回值告知，音效由调用方播（本类不碰 audio）。
 *
 * 热路径零分配：所有计时槽在构造期或首次登记时分配，逐帧只写值（无进珠时
 * `trayLand*` 写**共享空数组**而非逐帧 `[]` ⇒ 每帧省两次分配，WXG-T-420 T8）。
 *
 * 写面（WXG-T-420 T8）：`writeSnapshot` 只收**特效片**（`SnapshotFx`）⇒ 本类编译期就
 * 看不见其余 99 个字段（原先它拿到整份 `BeadsSnapshot`，越权写面板/对局字段不会报错）。
 */
import type { ColorCueMode } from '../state';
import type { SnapshotFx } from '../snapshot-shards';
import { comboVfxProgress, type ComboVfxKind, type ComboVfxSpec } from '../../view/combo-vfx';
import {
  CLEAR_PANEL_DELAY_MS,
  COLOR_WAVE_MS,
  COLOR_WAVE_SWEEP_MS,
  CONFETTI_MS,
  DENIED_MAX_CELLS,
  DENIED_PRESS_MS,
  DENIED_PRESS_RESTART_GATE_MS,
  FILL_POP_MS,
  FILL_POP_RESTART_GATE_MS,
  GROUP_LAND_MAX,
  GROUP_LAND_TOTAL_MS,
  SELECT_LIFT_MS,
  SWEEP_MS,
  TAP_HINT_MS,
  WAVE_MS,
  WRONG_FX_MS,
  WRONG_FX_RESTART_GATE_MS,
} from '../../config/tuning';

export interface FeedbackFxHost {
  /** 当前是否 PLAYING（托盘进珠 / 组落座表现在非 PLAYING 相位作废）。 */
  readonly playing: boolean;
}

type ComboFx = { spec: ComboVfxSpec; elapsedMs: number; row: number; col: number };
type DeniedSlot = { row: number; col: number; elapsedMs: number; armedAtMs: number };
type GroupLandFx = {
  rows: number[];
  cols: number[];
  steps: number[];
  count: number;
  elapsedMs: number;
  totalMs: number;
};
type TrayLandFx = { slots: number[]; steps: number[]; elapsedMs: number; totalMs: number };
/**
 * 无进珠动画时写进快照的共享空数组（WXG-T-420 T8）：view 只读到 `trayLandCount` 为止，
 * 且⛔ 不写回 ⇒ 共用一份实例安全；逐帧 `: []` 会每帧造两个新数组。
 */
const NO_TRAY_LAND_SLOTS: number[] = [];
const NO_TRAY_LAND_STEPS: number[] = [];
type CellFx = { row: number; col: number; elapsedMs: number };
type TapHintFx = {
  text: string;
  row: number;
  col: number;
  anchor: 'cell' | 'expand';
  elapsedMs: number;
};

export class FeedbackFx {
  /** S7 连击特效：同时只存在一个（多档重叠只播最高档，避免叠加成闪烁）。 */
  private _comboVfx: ComboFx | null = null;
  /** GAP-04/03/10 循环相位基准（ms，单调推进；告急 α / hint 呼吸 / 满槽脉冲 / 重启门时基）。 */
  private _pulseClock = 0;
  /** §5 选中抬起斜坡计时（ms）。板锚组与托盘珠共用一个时钟；选中判定只读（`liftElapsedMs`）。 */
  private _liftElapsedMs = 0;
  /** [T-244 九批] 托盘进珠多槽队列（push 不覆盖；总窗恒 `GROUP_LAND_TOTAL_MS`）。 */
  private _trayLandFx: TrayLandFx | null = null;
  /** GAP-04 `wrong` 态：被拒格心 + 播放进度（`WRONG_FX_MS` 后自清）。 */
  private _wrongFx: CellFx | null = null;
  /** 上次起播 `wrong` 的时基（`_pulseClock` ms）；驱动 500ms 重启门；`-Infinity` = 首帧即允许。 */
  private _wrongFxArmedAtMs = Number.NEGATIVE_INFINITY;
  /** G1 `vfx_fill_pop` 落座回弹（单槽；120ms 重启门）。 */
  private _placeFx: CellFx | null = null;
  /** 落座 fx 上次起播时刻（同 `_wrongFxArmedAtMs` 判例）。 */
  private _placeFxArmedAtMs = Number.NEGATIVE_INFINITY;
  /**
   * G7 `vfx_denied_press` 不可填格轻压：定长槽数组（`DENIED_MAX_CELLS`，构造期一次分配）。
   * 同格门按「同格计」⇒ 多格并存；播完槽**不清 row/col**（同格门 250ms > 动画 120ms，需死窗记忆）。
   */
  private readonly _deniedFx: DeniedSlot[] = Array.from({ length: DENIED_MAX_CELLS }, () => ({
    row: -1,
    col: -1,
    elapsedMs: 0,
    armedAtMs: Number.NEGATIVE_INFINITY,
  }));
  /** [T-244] 组批量落座队列（定长 `GROUP_LAND_MAX`，首次登记惰性建）。 */
  private _groupLandFx: GroupLandFx | null = null;
  /** G3 `vfx_powerup_sweep` 扫光：一个计时标量（`-1` = 未播放）。 */
  private _sweepElapsedMs = -1;
  /** G6 `vfx_confetti` 结算彩带：一个计时标量（`-1` = 未播放）。 */
  private _confettiElapsedMs = -1;
  /** G4 `vfx_complete_wave` 过关庆祝波浪：一个计时标量（`-1` = 未播放）；同时是结算面板延迟门。 */
  private _waveElapsedMs = -1;
  /** [T-244 十六批] 单色对齐波浪：`-1` = 未播放。时长/错峰按档分派（`_colorWaveTotalMs`）。 */
  private _colorWaveElapsedMs = -1;
  /** 本条波浪的主角色（`_colorWaveElapsedMs >= 0` 时有效，0 = 无）。 */
  private _colorWaveIdx = 0;
  /**
   * [T-244 十八批] **让位门**（只管 `jump` 档）：某色刚齐但落位动画还在跑 ⇒ 存待播 `colorIdx`
   * （0 = 无），`_stepColorWave` 等落位三通道（place / group / solver）全空才接管。
   * ⛔ 不用定长让位期：解环器相 B 长度可变（`solverSequenceMs`），等队列空比猜时长可靠。
   */
  private _colorWavePendingIdx = 0;
  /** [T-244 十八批] 已齐备色位图（bit = `colorIdx`）；`lock` 档的常驻环靠它，换关清零。 */
  private _colorLockMask = 0;
  /** [T-244 十八批] 当前表达档（默认 `pulse`；dev `?cue=` 可切）。 */
  private _colorCue: ColorCueMode = 'pulse';
  /**
   * 一次性轻提示（BD-16 / BD-15 共用通道，ux-spec §5 WXG-T-097）。表现层计时，
   * `TAP_HINT_MS` 后自清；不发事件、不走 `sfx_reject`。
   */
  private _tapHint: TapHintFx | null = null;

  constructor(private readonly _host: FeedbackFxHost) {}

  /** S7 连击特效状态（只读）。`null` = 当前无特效。 */
  get comboVfx(): { kind: ComboVfxKind; tier: number; elapsedMs: number } | null {
    const vfx = this._comboVfx;
    return vfx ? { kind: vfx.spec.kind, tier: vfx.spec.tier, elapsedMs: vfx.elapsedMs } : null;
  }

  /** §5 抬起斜坡已走过的毫秒（选中判定只读；写入只经 `resetLift` / `stepPresentation`）。 */
  get liftElapsedMs(): number {
    return this._liftElapsedMs;
  }

  /** §5 新锚建起 ⇒ 抬起斜坡重来。 */
  resetLift(): void {
    this._liftElapsedMs = 0;
  }

  /** 庆祝波浪是否在播（结算面板的延迟门读它）。 */
  get waveActive(): boolean {
    return this._waveElapsedMs >= 0;
  }

  /** 通关庆祝波浪起播（非 D1 路径）。 */
  startWave(): void {
    this._waveElapsedMs = 0;
  }

  /** 离开结算相位即弃波浪（否则残留延迟门可能在别的相位掀开面板）。 */
  cancelWave(): void {
    this._waveElapsedMs = -1;
  }

  /** G6 彩带与结算面板入场同帧启动（非 D1 路径）。 */
  startConfetti(): void {
    this._confettiElapsedMs = 0;
  }

  /**
   * 结算相位内的波浪推进 + 面板延迟门（裁定 1）。本相位内不存在 PAUSED，故照常推进。
   * `ClearPanel.update()` 在 `_shown = false` 时早退 ⇒ 星级计时不会在延迟期攒成一次爆发。
   */
  stepWave(dt: number): void {
    if (this._waveElapsedMs >= 0) {
      this._waveElapsedMs += Math.max(0, dt) * 1000;
      if (this._waveElapsedMs >= CLEAR_PANEL_DELAY_MS) this._waveElapsedMs = -1;
    }
  }

  /**
   * G3 起播（`assets-spec §1.6.3`）。**无重启门**：400ms 内再触发 = 从头再扫一次。
   * 起点 = 按下帧（`powerup:used` 同栈，`core-loop v2.2 §8` 注②）。
   */
  startSweep(): void {
    this._sweepElapsedMs = 0;
  }

  /**
   * S7 连击特效起播：三档随倍率档触发，重叠时只播**最高档**。
   * `spec` 由调用方经 `comboVfxSpec(tier)` 取得（null 即无特效）。
   */
  armCombo(spec: ComboVfxSpec, row: number, col: number): void {
    if (!this._comboVfx || spec.tier >= this._comboVfx.spec.tier) {
      this._comboVfx = { spec, elapsedMs: 0, row, col };
    }
  }

  /**
   * GAP-04 `wrong` 态起播（WXG-T-102 / BD-29）。连续拒绝受 **500ms 重启门**约束
   * （`ux-spec §5:180`）：门内不重启，门内且已自然结束 ⇒ 本次不给视觉反馈。
   * 按 `systems-index §3.8` 从严：门禁**整个 wrong-fx 事件**（抖动与描边同进同退）。
   */
  armWrong(row: number, col: number): void {
    if (this._pulseClock - this._wrongFxArmedAtMs < WRONG_FX_RESTART_GATE_MS) return;
    this._wrongFx = { row, col, elapsedMs: 0 };
    this._wrongFxArmedAtMs = this._pulseClock;
  }

  /**
   * G1 落座回弹起播（WXG-T-128）。120ms 重启门，只管手动连点；解环器逐颗落位走独立队列
   * （`_solverFx`，见 BeadsGame），不经本方法。
   */
  armPlace(row: number, col: number): void {
    if (this._pulseClock - this._placeFxArmedAtMs < FILL_POP_RESTART_GATE_MS) return;
    this._placeFx = { row, col, elapsedMs: 0 };
    this._placeFxArmedAtMs = this._pulseClock;
  }

  /**
   * G7 轻压起播（WXG-T-152）：**同格 250ms 重启门**。门内重复点同格不重启、不放音 ⇒ 返回 `false`；
   * 过门 ⇒ 槽重启并返回 `true`（调用方据此播 `AUDIO_CLIP_DENIED`）。槽满时逐出最早起播者。
   * 合法性（越界 / void 外形格）由调用方先判（一处守卫，覆盖两条路径）。
   */
  armDenied(row: number, col: number): boolean {
    const now = this._pulseClock;
    const slots = this._deniedFx;
    let reuse = -1; // 空槽，或已过动画窗（只剩门记忆）的槽
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]!;
      if (s.row === row && s.col === col) {
        if (now - s.armedAtMs < DENIED_PRESS_RESTART_GATE_MS) return false; // 同格门内
        s.elapsedMs = 0;
        s.armedAtMs = now;
        return true;
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
    return true;
  }

  /** 托盘进珠登记（取回落槽）：push 不覆盖，错峰序 = 落珠序。 */
  pushTrayLand(slot: number): void {
    const tlf = (this._trayLandFx ??= {
      slots: [],
      steps: [],
      elapsedMs: 0,
      totalMs: GROUP_LAND_TOTAL_MS,
    });
    tlf.slots.push(slot);
    tlf.steps.push(tlf.slots.length - 1);
  }

  /**
   * [T-244] 组落座登记（纯表现）。惰性建队列；总时长恒 `GROUP_LAND_TOTAL_MS`（错峰预算 + 单珠窗，
   * 与颗数无关），错峰偏移按落珠序号等差分配（view 侧 `groupLandOffsetMs` 同式）。
   */
  pushGroupLand(row: number, col: number, step: number): void {
    if (!this._groupLandFx) {
      this._groupLandFx = {
        // 容量用 `GROUP_LAND_MAX`（盘面格数上界）⛔ 不用 `SOLVER_MAX_CELLS`（解环器单次上限 = 3）。
        rows: new Array<number>(GROUP_LAND_MAX).fill(-1),
        cols: new Array<number>(GROUP_LAND_MAX).fill(-1),
        steps: new Array<number>(GROUP_LAND_MAX).fill(-1),
        count: 0,
        elapsedMs: 0,
        totalMs: 0,
      };
    }
    const fx = this._groupLandFx;
    if (fx.count >= fx.rows.length) return; // 定长越界静默丢
    fx.rows[fx.count] = row;
    fx.cols[fx.count] = col;
    fx.steps[fx.count] = step;
    fx.count++;
    fx.totalMs = GROUP_LAND_TOTAL_MS;
  }

  /**
   * [T-244 十六批] 某色的全部珠子归位（判据在 BeadsGame 的 `_maybeColorCue`）⇒ 锁定位图置位，
   * 并按表达档起播：`pulse` 当场起播（亮通道与位移通道正交）；`jump` 记入让位门等落位队列空；
   * `lock` / `off` 只置位图。
   * ponytail: 单槽——一色接管前一色（400ms 内连齐两色时前一色被截）；要并存再上定长槽数组。
   */
  markColorAligned(colorIdx: number): void {
    this._colorLockMask |= 1 << colorIdx;
    if (this._colorCue === 'jump') {
      this._colorWavePendingIdx = colorIdx; // 让位门 ⇒ 不在此处起播
    } else if (this._colorCue === 'pulse') {
      this._colorWavePendingIdx = 0;
      this._colorWaveElapsedMs = 0;
      this._colorWaveIdx = colorIdx;
    }
  }

  /** 发一次性轻提示（ux-spec §5 WXG-T-097）。 */
  showTapHint(text: string, row: number, col: number, anchor: 'cell' | 'expand' = 'cell'): void {
    this._tapHint = { text, row, col, anchor, elapsedMs: 0 };
  }

  /** 单色提示表达档（dev / harness 切换；不影响判据，只换渲染通道）。 */
  setCue(mode: ColorCueMode): void {
    this._colorCue = mode;
  }

  /**
   * 换关 / 重试 ⇒ 清单色波浪、让位门、锁定位图与组落座队列（旧格坐标不动新棋盘）。
   * 不清：`_pulseClock`（单调）、表达档（设置类）、其余单次特效（各自到点自清）。
   */
  resetForLevel(): void {
    this._colorWaveElapsedMs = -1;
    this._colorWaveIdx = 0;
    this._colorWavePendingIdx = 0;
    this._colorLockMask = 0;
    this._groupLandFx = null;
  }

  /**
   * 托盘进珠 + 组落座推进（`_update` 中解环器之后）。**表现层判例**：不被 PAUSED 冻结，
   * 但非 PLAYING 相位作废（`_host.playing`）。
   */
  stepLandings(dt: number): void {
    const glfx = this._groupLandFx;
    if (glfx) {
      if (!this._host.playing) {
        this._groupLandFx = null;
      } else {
        glfx.elapsedMs += Math.max(0, dt) * 1000;
        if (glfx.elapsedMs >= glfx.totalMs) this._groupLandFx = null;
      }
    }
    const tlf = this._trayLandFx;
    if (tlf) {
      if (!this._host.playing) {
        this._trayLandFx = null;
      } else {
        tlf.elapsedMs += Math.max(0, dt) * 1000;
        if (tlf.elapsedMs >= tlf.totalMs) this._trayLandFx = null;
      }
    }
  }

  /**
   * 其余表现计时的统一推进（`_update` 中面板动画之后）。顺序即原序：连击 → 脉冲时钟 → 抬起斜坡 →
   * wrong → place → denied → 扫光 → 彩带 → 单色波浪 → 轻提示。
   * `solverBusy`：解环器队列是否在播（单色让位门的第三通道；调用方在本帧 `_stepSolverFx` 之后传入）。
   */
  stepPresentation(dt: number, solverBusy: boolean): void {
    this._stepCombo(dt);
    this._pulseClock += Math.max(0, dt) * 1000; // 循环脉冲基准（同判例不冻结）
    // §5 抬起斜坡：上限钳在 SELECT_LIFT_MS，不等“满了还累”造成无界计数。
    this._liftElapsedMs = Math.min(SELECT_LIFT_MS, this._liftElapsedMs + Math.max(0, dt) * 1000);
    this._stepWrong(dt);
    this._stepPlace(dt);
    this._stepDenied(dt);
    this._stepSweep(dt);
    this._stepConfetti(dt);
    this._stepColorWave(dt, solverBusy);
    this._stepTapHint(dt);
  }

  /**
   * 写入快照（表现层投影：只给单调进度 / 格坐标 / 定长槽，曲线与几何在 view 侧推导，L5）。
   * 不写 `failHint` / 解环器 / 面板 / 引导——那些归 BeadsGame。
   */
  writeSnapshot(s: SnapshotFx): void {
    // S7 连击特效（§2.5）：形态 + 播放进度 + 锚点一起进快照。
    s.comboVfxKind = this._comboVfx ? this._comboVfx.spec.kind : '';
    s.comboVfxProgress = this._comboVfx
      ? comboVfxProgress(this._comboVfx.elapsedMs, this._comboVfx.spec.durationMs)
      : 0;
    s.comboVfxRow = this._comboVfx ? this._comboVfx.row : -1;
    s.comboVfxCol = this._comboVfx ? this._comboVfx.col : -1;

    // GAP-04/03/10 反馈态相位（WXG-T-087）：表现时钟 + wrong 进度 + 落座进度。
    s.pulseClock = this._pulseClock;
    const wfx = this._wrongFx;
    s.wrongRow = wfx ? wfx.row : -1;
    s.wrongCol = wfx ? wfx.col : -1;
    s.wrongProgress = wfx ? Math.min(1, wfx.elapsedMs / WRONG_FX_MS) : 0;
    const pfx = this._placeFx;
    s.placeRow = pfx ? pfx.row : -1;
    s.placeCol = pfx ? pfx.col : -1;
    s.placeProgress = pfx ? Math.min(1, pfx.elapsedMs / FILL_POP_MS) : 0;
    // §5 抬起斜坡**进格量**（0→1，未缓动）；D1 与 ease 由 view 侧施。
    s.liftProgress = Math.min(1, this._liftElapsedMs / SELECT_LIFT_MS);
    // [T-244 九批] 托盘进珠快照（多槽队列）。⛔ 无动画时写共享空数组，不逐帧新建 `[]`。
    s.trayLandSlots = this._trayLandFx ? this._trayLandFx.slots : NO_TRAY_LAND_SLOTS;
    s.trayLandSteps = this._trayLandFx ? this._trayLandFx.steps : NO_TRAY_LAND_STEPS;
    s.trayLandCount = this._trayLandFx ? this._trayLandFx.slots.length : 0;
    s.trayLandElapsedMs = this._trayLandFx ? this._trayLandFx.elapsedMs : 0;
    // G7 轻压：仅在播槽可见（120ms 后零残留）。
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
    // [T-244] 组落座表现队列。
    const glfx = this._groupLandFx;
    s.groupLandCount = glfx ? glfx.count : 0;
    s.groupLandElapsedMs = glfx ? glfx.elapsedMs : 0;
    for (let i = 0; i < s.groupLandRows.length; i++) {
      s.groupLandRows[i] = glfx && i < glfx.count ? glfx.rows[i]! : -1;
      s.groupLandCols[i] = glfx && i < glfx.count ? glfx.cols[i]! : -1;
      s.groupLandSteps[i] = glfx && i < glfx.count ? glfx.steps[i]! : -1;
    }
    // G3 扫光 / G6 彩带 / G4 波浪：各一条单调进度。
    s.sweepProgress = this._sweepElapsedMs < 0 ? 0 : Math.min(1, this._sweepElapsedMs / SWEEP_MS);
    s.confettiProgress =
      this._confettiElapsedMs < 0 ? 0 : Math.min(1, this._confettiElapsedMs / CONFETTI_MS);
    s.waveProgress = this._waveElapsedMs < 0 ? 0 : Math.min(1, this._waveElapsedMs / WAVE_MS);
    // [T-244 十六批] 单色对齐波浪：分母 = `_colorWaveTotalMs()`（与通道同长，见其头注）。
    s.colorWaveProgress =
      this._colorWaveElapsedMs < 0
        ? 0
        : Math.min(1, this._colorWaveElapsedMs / this._colorWaveTotalMs());
    s.colorWaveColorIdx = this._colorWaveIdx;
    // [T-244 十八批] 表达档与常驻锁定态。
    s.colorCueMode = this._colorCue;
    s.colorLockedMask = this._colorLockMask;
    // BD-16/BD-15 轻提示：只给文本与锚点格（无进度曲线）。
    const th = this._tapHint;
    s.tapHintText = th ? th.text : '';
    s.tapHintRow = th ? th.row : -1;
    s.tapHintCol = th ? th.col : -1;
    s.tapHintAnchor = th ? th.anchor : 'cell';
  }

  // ─────────────────────────────────────────────── 推进（私有）

  private _stepCombo(dt: number): void {
    const vfx = this._comboVfx;
    if (!vfx) return;
    vfx.elapsedMs += Math.max(0, dt) * 1000;
    if (vfx.elapsedMs >= vfx.spec.durationMs) this._comboVfx = null;
  }

  private _stepWrong(dt: number): void {
    const fx = this._wrongFx;
    if (!fx) return;
    fx.elapsedMs += Math.max(0, dt) * 1000;
    if (fx.elapsedMs >= WRONG_FX_MS) this._wrongFx = null;
  }

  private _stepPlace(dt: number): void {
    const fx = this._placeFx;
    if (!fx) return;
    fx.elapsedMs += Math.max(0, dt) * 1000;
    if (fx.elapsedMs >= FILL_POP_MS) this._placeFx = null;
  }

  /** 只推进在播槽；播完**不清 row/col**（同格门死窗记忆，零残留由快照的在播过滤保证）。 */
  private _stepDenied(dt: number): void {
    const step = Math.max(0, dt) * 1000;
    if (step === 0) return;
    const slots = this._deniedFx;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]!;
      if (s.row >= 0 && s.elapsedMs < DENIED_PRESS_MS) s.elapsedMs += step;
    }
  }

  private _stepSweep(dt: number): void {
    if (this._sweepElapsedMs < 0) return;
    this._sweepElapsedMs += Math.max(0, dt) * 1000;
    if (this._sweepElapsedMs >= SWEEP_MS) this._sweepElapsedMs = -1;
  }

  private _stepConfetti(dt: number): void {
    if (this._confettiElapsedMs < 0) return;
    this._confettiElapsedMs += Math.max(0, dt) * 1000;
    if (this._confettiElapsedMs >= CONFETTI_MS) this._confettiElapsedMs = -1;
  }

  /**
   * 单色波浪推进。`jump` 档的让位门：只读落位三通道（place / group / solver）的存亡，
   * 三者全空那一帧才接管；零新轮询（本函数本就逐帧在跑）。
   */
  private _stepColorWave(dt: number, solverBusy: boolean): void {
    if (this._colorWaveElapsedMs < 0) {
      const pending = this._colorWavePendingIdx;
      if (pending === 0 || this._placeFx !== null || this._groupLandFx !== null || solverBusy) {
        return;
      }
      this._colorWavePendingIdx = 0;
      this._colorWaveIdx = pending;
      this._colorWaveElapsedMs = 0;
      return;
    }
    this._colorWaveElapsedMs += Math.max(0, dt) * 1000;
    if (this._colorWaveElapsedMs >= this._colorWaveTotalMs()) {
      this._colorWaveElapsedMs = -1;
      this._colorWaveIdx = 0;
    }
  }

  /**
   * 单色提示通道全长按档分派：`pulse` 光带横扫 ⇒ `COLOR_WAVE_SWEEP_MS`，`jump` 紧凑 ⇒ `COLOR_WAVE_MS`。
   * ⛔ 与 view 侧 `cwT = progress × 同一值` 是一对（不一致 ⇒ 光带被加速或扫不完）。
   */
  private _colorWaveTotalMs(): number {
    return this._colorCue === 'pulse' ? COLOR_WAVE_SWEEP_MS : COLOR_WAVE_MS;
  }

  private _stepTapHint(dt: number): void {
    const hint = this._tapHint;
    if (!hint) return;
    hint.elapsedMs += Math.max(0, dt) * 1000;
    if (hint.elapsedMs >= TAP_HINT_MS) this._tapHint = null;
  }
}
