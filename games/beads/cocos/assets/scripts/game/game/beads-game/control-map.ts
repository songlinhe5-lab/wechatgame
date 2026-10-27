/**
 * UI 控件映射（从 `BeadsGame` 拆出）：把屏幕点映射为控件 id，供抬起提交门（按下腿）、
 * 面板按下态与面板选项使用。
 *
 * - {@link ControlMap.hitUi}：按相位返回控件 id（缩放 / 齿轮 / 道具卡 / 展开 / 面板钮）；非按钮 ⇒ `''`。
 *   ⚠ 命中序必须与 `HudRouter` / `PanelRouter` 的分派**逐条同序**，几何一律走同一批 `hit*` 函数
 *   （`hit-test.ts`、面板各自 `hitTest`），否则「按下判 A、抬起判 B」= 热区漂移。
 * - {@link ControlMap.pressedButton}：手指按住时落在哪块**可见**面板钮上（按下态，只读、零分配）。
 * - {@link ControlMap.clearPanelOptions}：结算面板文案选项（末关主钮 = 「查看结果」）。
 *
 * 只读：本类不写任何游戏状态（`_pressPoint` 为复用的屏幕→设计坐标暂存，不被保留）。
 */
import type { GameServices } from '../../../framework/index';
import {
  hitClearPanel,
  type ClearPanel,
  type ClearPanelOptions,
} from '../../systems/clear-panel';
import { hitFailPanel } from '../../systems/fail-panel';
import { hitFinishPanel, type FinishPanel } from '../../systems/finish-panel';
import { hitSprintSettle, type SprintSettlePanel } from '../../systems/sprint-settle';
import { pausePanelLayout, rectContains, type PausePanel } from '../../systems/pause-panel';
import { hitBuyConfirm } from '../../systems/buy-confirm-panel';
import type { BeadsPhase, GameMode } from '../state';
import type { BoardCameraController } from './board-camera-controller';
import { hitExpandButton, hitGear, hitPowerupCard } from './hit-test';

/** 结算面板选项：普通关 / 末关（末关主钮文案 = 「查看结果」）。 */
const CLEAR_OPTS_NORMAL: ClearPanelOptions = Object.freeze({ lastLevel: false });
const CLEAR_OPTS_LAST: ClearPanelOptions = Object.freeze({ lastLevel: true });

/** 宿主接口：控件映射只读的状态面（由 `BeadsGame` 以 getter 接线，热路径零分配）。 */
export interface ControlMapHost {
  readonly phase: BeadsPhase;
  readonly mode: GameMode;
  readonly services: GameServices | null;
  readonly board: BoardCameraController;
  readonly hudDy: number;
  readonly trayExpanded: boolean;
  /** 还能再升一档容量（12→24→48，§3.4 v1.83）。 */
  readonly trayCanExpand: boolean;
  /** 失败面板是否还有复活次数。 */
  readonly reviveAvailable: boolean;
  readonly levelCount: number;
  /** 当前是否为末关（结算面板主钮文案切换）。 */
  readonly isLastLevel: boolean;
  /**
   * 当前是否为**本章末关**（P0-1 · `core-loop §8-8`）：真源 = `arcs.ts::ARCS[].levelRefs`
   * ⇒ `isBossLevelId`；章末 ⇒ 结算主钮为「查看结果」且 FINISH 走本章结算。
   */
  readonly isArcFinalLevel: boolean;
  /** 通关画面展示的关数（本章结算 = 本章长度；否则全表长度）。 */
  readonly finishLevelCount: number;
  readonly panel: PausePanel;
  readonly clearPanel: ClearPanel;
  readonly finishPanel: FinishPanel;
  readonly sprintSettle: SprintSettlePanel;
  /** 购买确认弹窗是否打开（模态：打开时只有它自己的两颗钮可点，ux-spec §3.7）。 */
  readonly buyConfirmOpen: boolean;
}

export class ControlMap {
  /** 按下态的屏幕→设计坐标暂存（复用，不被保留）。 */
  private readonly _pressPoint = { x: 0, y: 0 };

  constructor(private readonly _host: ControlMapHost) {}

  /**
   * 抬起提交门的**按下腿**（WXG-T-295 · `input-control §2.1` v2.13）：该点落在哪颗
   * **按钮类控件**上 ⇒ 返回其 id；落在非按钮（托盘槽 / 棋盘格 / 遮罩空白 / slider 轨）
   * 上 ⇒ 返回 `''`（= 维持按下即提交，本门不管）。
   * ⚠ 命中序必须与 `_routeTap` **逐条同序**，几何一律走同一批 `hit*` helper（⛔ 不写第二套
   * 坐标）；两条腿任一改动必须同步另一条，否则「按下判 A、抬起判 B」= 热区漂移（同
   * `meta-view::hitTestMeta` 头注口径）。只读、零分配（返回值全是常量串或 `''`）。
   */
  hitUi(x: number, y: number): string {
    // 购买确认弹窗模态：其余控件一律让位（`ux-spec §3.7`，与 `_routeTap` 顶部同序）。
    if (this._host.buyConfirmOpen) return hitBuyConfirm(x, y) ?? '';
    const phase = this._host.phase;
    if (phase === 'playing') {
      const zc = this._host.board.zoomHit(x, y);
      if (zc === 'track') return ''; // 拖拽控件，按下腿已在本函数上方分流
      if (zc) return zc; // 'reset' | 'fit'
      if (hitGear(x, y, this._host.hudDy)) return 'gear';
      const card = hitPowerupCard(x, y);
      if (card) return card; // 'solver' | 'solverPlus' | 'solverRandom'
      if (hitExpandButton(x, y, this._host.trayCanExpand)) return 'expand';
      return ''; // 路由 4 托盘 / 5 网格 = 落子与取回目标，非按钮
    }
    if (phase === 'paused') return this._host.panel.hitTest(x, y, this._host.mode) ?? '';
    if (phase === 'level-clear') return this._host.clearPanel.hitTest(x, y, this.clearPanelOptions()) ?? '';
    if (phase === 'finish') return this._host.finishPanel.hitTest(x, y, this._host.finishLevelCount) ?? '';
    if (phase === 'game-over') {
      if (this._host.mode === 'sprint') return this._host.sprintSettle.hitTest(x, y) ?? '';
      return hitFailPanel(x, y, this._host.reviveAvailable) ?? '';
    }
    return '';
  }

  /** 面板几何/文案选项（末关把主钮文案切成「查看结果」）。 */
  clearPanelOptions(): ClearPanelOptions {
    return this._host.isArcFinalLevel || this._host.isLastLevel ? CLEAR_OPTS_LAST : CLEAR_OPTS_NORMAL;
  }

  /**
   * 按下态命中（EP12-S4 续办 · screens.md 控件矩阵「按下」列）：手指**按住**时落在哪块**可见**
   * 面板的哪颗钮上（无 ⇒ `null`）。与各面板 `hitTest` **同一几何**，但按 `visible` 而非相位/
   * `interactive` 判。**WXG-T-295 时基翻版注**：面板钮改「抬起才提交」⇒ 按下态的语义变为
   * **按住期间亮、抬起提交那帧即灭**（旧「按下即提交 ⇒ 淡出期内续亮到淡完」的承载理由随之时基
   * 消解：切相位与起淡出同帧发生在手指已离开的抬起帧）。只读、零分配。
   */
  pressedButton(): string | null {
    const services = this._host.services;
    if (!services || !services.input.snapshot.isDown) return null;
    const snap = services.input.snapshot;
    services.viewport.screenToDesign(this._pressPoint, snap.x, snap.y);
    const x = this._pressPoint.x;
    const y = this._pressPoint.y;
    if (this._host.finishPanel.visible) return hitFinishPanel(x, y, this._host.levelCount);
    if (this._host.clearPanel.visible) return hitClearPanel(x, y, this.clearPanelOptions());
    if (this._host.sprintSettle.visible) return hitSprintSettle(x, y);
    if (this._host.panel.visible) {
      for (const b of pausePanelLayout(this._host.mode).buttons) if (rectContains(b.rect, x, y)) return b.id;
      return null;
    }
    if (this._host.phase === 'game-over' && this._host.mode !== 'sprint') {
      return hitFailPanel(x, y, this._host.reviveAvailable);
    }
    return null;
  }
}
