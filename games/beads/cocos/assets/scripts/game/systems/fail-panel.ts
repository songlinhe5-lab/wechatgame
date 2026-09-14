/**
 * Fail overlay — ordinary-mode GAME_OVER: 续时主钮 + 重试次钮 (ux-spec §3.5 U5).
 *
 * Sprint GAME_OVER does not use this layout (no revive). Geometry is static so
 * hit-testing and drawing share one object.
 */

import {
  DESIGN_H,
  DESIGN_W,
  FAIL_BUTTON_GAP,
  FAIL_BUTTON_H,
  FAIL_PRIMARY_W,
  REVIVE_BONUS_SEC,
} from '../config/tuning';
import { rectContains, type PanelRect } from './pause-panel';

export type FailPanelAction = 'revive' | 'retry';

export interface FailPanelButton {
  readonly id: FailPanelAction;
  readonly rect: PanelRect;
}

export interface FailPanelLayout {
  readonly panel: PanelRect;
  readonly buttons: readonly FailPanelButton[];
  readonly titleY: number;
  readonly subtitleY: number;
  readonly subtitle: string;
}

function rect(x: number, y: number, w: number, h: number): PanelRect {
  return { xMin: x, yMin: y, xMax: x + w, yMax: y + h };
}

let _withRevive: FailPanelLayout | null = null;
let _retryOnly: FailPanelLayout | null = null;

/**
 * @param reviveAvailable when false, only the retry button is laid out
 *   (`REVIVE_MAX_PER_LEVEL` already used).
 */
export function failPanelLayout(reviveAvailable: boolean): FailPanelLayout {
  if (reviveAvailable) {
    if (_withRevive) return _withRevive;
    _withRevive = buildLayout(true);
    return _withRevive;
  }
  if (_retryOnly) return _retryOnly;
  _retryOnly = buildLayout(false);
  return _retryOnly;
}

function buildLayout(withRevive: boolean): FailPanelLayout {
  const plateW = 560;
  const plateH = withRevive ? 360 : 280;
  const plateX = (DESIGN_W - plateW) / 2;
  const plateY = (DESIGN_H - plateH) / 2;
  const plate = rect(plateX, plateY, plateW, plateH);
  const btnX = (DESIGN_W - FAIL_PRIMARY_W) / 2;
  const innerPad = 40;
  const retryY = plate.yMin + innerPad;
  const buttons: FailPanelButton[] = [];

  if (withRevive) {
    const reviveY = retryY + FAIL_BUTTON_H + FAIL_BUTTON_GAP;
    buttons.push({
      id: 'revive',
      rect: rect(btnX, reviveY, FAIL_PRIMARY_W, FAIL_BUTTON_H),
    });
  }
  buttons.push({
    id: 'retry',
    rect: rect(btnX, retryY, FAIL_PRIMARY_W, FAIL_BUTTON_H),
  });

  return {
    panel: plate,
    buttons,
    titleY: plate.yMax - 56,
    subtitleY: plate.yMax - 100,
    subtitle: withRevive ? '' : '本关已续时',
  };
}

export function hitFailPanel(x: number, y: number, reviveAvailable: boolean): FailPanelAction | null {
  const layout = failPanelLayout(reviveAvailable);
  for (const button of layout.buttons) {
    if (rectContains(button.rect, x, y)) return button.id;
  }
  return null;
}

/** Button copy — must mention `REVIVE_BONUS_SEC`, not just "watch a video". */
export function failPanelLabel(id: FailPanelAction): string {
  if (id === 'revive') return `▶ +${REVIVE_BONUS_SEC}秒 继续本关`;
  return '重试本关';
}
