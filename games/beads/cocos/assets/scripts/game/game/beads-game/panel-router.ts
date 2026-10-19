/**
 * 面板相位的点击路由（PAUSED / LEVEL_CLEAR / FINISH / GAME_OVER），从 `BeadsGame._routeTap` 拆出。
 *
 * 职责：命中**本相位可见面板**的按钮 ⇒ 发出对应动作（走各动作既有入口）；返回是否消费本次点击。
 * 边界：面板外点击零响应、零副作用（`input-control §2.3` 「面板相位仅面板按钮」）；
 * 动作本体（重开、推进、暂停面板动作等）仍在 `BeadsGame`，经 {@link PanelRouterHost} 注入。
 *
 * ⚠ 音效口径与拆分前逐字一致：冲刺结算 / 结算面板 / 完成面板 / 失败面板由本类先播 `UI_TAP`；
 * PAUSED 的面板动作由 `BeadsGame._applyPanelAction` 自行播放（本类不重复播）。
 */
import { AUDIO_CLIP_UI_TAP } from '../../config/tuning';
import { hitFailPanel } from '../../systems/fail-panel';
import type { ClearPanel, ClearPanelAction, ClearPanelOptions } from '../../systems/clear-panel';
import type { FinishPanel, FinishPanelAction } from '../../systems/finish-panel';
import type { PausePanel, PausePanelAction } from '../../systems/pause-panel';
import type { SprintSettlePanel, SprintSettleAction } from '../../systems/sprint-settle';
import type { BeadsPhase, GameMode } from '../state';

/** 宿主接口：面板路由需要的面板对象与动作入口（由 `BeadsGame` 以 getter / 方法接线）。 */
export interface PanelRouterHost {
  readonly mode: GameMode;
  /** 失败面板是否还有复活次数（`_reviveCount < REVIVE_MAX_PER_LEVEL`）。 */
  readonly reviveAvailable: boolean;
  readonly levelCount: number;
  readonly panel: PausePanel;
  readonly clearPanel: ClearPanel;
  readonly finishPanel: FinishPanel;
  readonly sprintSettle: SprintSettlePanel;
  clearPanelOptions(): ClearPanelOptions;
  sfx(clipId: string): void;
  startNormal(): void;
  retryLevel(): void;
  requestRevive(): void;
  advanceAfterClear(): void;
  startSprintRun(): void;
  restartRun(): void;
  openMenu(): void;
  applyPanelAction(action: PausePanelAction): void;
}

export class PanelRouter {
  constructor(private readonly _host: PanelRouterHost) {}

  /**
   * 面板相位点击。命中 ⇒ 派发并返回 `true`；未命中 / 非面板相位 ⇒ `false`（零副作用）。
   */
  route(phase: BeadsPhase, x: number, y: number): boolean {
    const h = this._host;
    switch (phase) {
      case 'game-over': {
        if (h.mode === 'sprint') {
          // `ux-spec §3.5` 左列冲刺结算：只认两个按钮（再来一局 / 返回关卡）。
          const settle: SprintSettleAction | null = h.sprintSettle.hitTest(x, y);
          if (!settle) return false;
          h.sfx(AUDIO_CLIP_UI_TAP);
          if (settle === 'back') h.startNormal();
          else h.retryLevel();
          return true;
        }
        const action = hitFailPanel(x, y, h.reviveAvailable);
        if (action === 'revive') {
          h.sfx(AUDIO_CLIP_UI_TAP);
          h.requestRevive();
          return true;
        }
        if (action === 'retry') {
          h.sfx(AUDIO_CLIP_UI_TAP);
          h.retryLevel();
          return true;
        }
        return false;
      }
      case 'level-clear': {
        // S7 结算面板：只认自己的两个按钮（面板外点击无命中 ⇒ 不推进）。
        const action: ClearPanelAction | null = h.clearPanel.hitTest(x, y, h.clearPanelOptions());
        if (!action) return false;
        h.sfx(AUDIO_CLIP_UI_TAP);
        if (action === 'next') h.advanceAfterClear();
        else h.startSprintRun();
        return true;
      }
      case 'finish': {
        // `ux-spec §4` 矩阵行 `FINISH | 去冲刺* / 重玩第 1 关`；面板外点击零响应。
        const action: FinishPanelAction | null = h.finishPanel.hitTest(x, y, h.levelCount);
        if (!action) return false;
        h.sfx(AUDIO_CLIP_UI_TAP);
        if (action === 'replay') h.restartRun();
        else if (action === 'menu') h.openMenu();
        else h.startSprintRun();
        return true;
      }
      case 'paused': {
        // PAUSED 只答复面板按钮 —— 遮罩吞掉其余一切（pause-settings §2.2 + §8-1）。
        const action = h.panel.hitTest(x, y, h.mode);
        if (!action) return false;
        h.applyPanelAction(action);
        return true;
      }
      default:
        return false;
    }
  }
}
