/**
 * Fail overlay — ordinary-mode GAME_OVER: 续时主钮 + 重试次钮 (ux-spec §3.5 U5).
 *
 * `[WXG-T-614]` 版式换 Figma「倒计时结束弹窗」木牌稿：几何单源 =
 * `config/tuning/timeout-panel.ts::TIMEOUT_GEO`（**牌内相对锚**，y 向下）；本文件只做
 * 「牌内锚 → 设计空间 y-up」换算 + 逐机居中位移，⛔ 不再自持一套宽高。
 *
 * Sprint GAME_OVER does not use this layout (no revive). Geometry is static so
 * hit-testing and drawing share one object.
 */

import {
  DESIGN_H,
  DESIGN_W,
  REVIVE_BONUS_SEC,
  TIMEOUT_GEO,
  dialogShiftY,
} from '../config/tuning';
import { rectContains, type PanelRect } from './pause-panel';

export type FailPanelAction = 'revive' | 'retry';

export interface FailPanelButton {
  readonly id: FailPanelAction;
  readonly rect: PanelRect;
}

/**
 * 布局 = **命中面**（牌框 + 钮框）+ 档位文案。文字锚不在本表：视图侧由
 * `TIMEOUT_GEO` 的牌内锚直接换算（与选关 / 详情页同口径）⇒ 只有一套换算式。
 */
export interface FailPanelLayout {
  readonly panel: PanelRect;
  readonly buttons: readonly FailPanelButton[];
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
  const g = TIMEOUT_GEO;
  const plateW = g.plate.w;
  const plateH = withRevive ? g.plate.h : g.plate.hRetryOnly;
  const plateX = (DESIGN_W - plateW) / 2;
  // `[WXG-T-323]` 中心对齐手机中心（两档各自居中 ⇒ 牌高变化不带走中心）。
  const plateY = (DESIGN_H - plateH) / 2 + dialogShiftY();
  const plate = rect(plateX, plateY, plateW, plateH);
  /** 牌内锚（自牌顶 y 向下）→ 设计空间框：水平居中于牌、`yMin = 牌顶 − yDown − h`。 */
  const slot = (w: number, h: number, yDown: number): PanelRect =>
    rect(plateX + (plateW - w) / 2, plateY + plateH - yDown - h, w, h);
  const buttons: FailPanelButton[] = [];

  if (withRevive) {
    buttons.push({ id: 'revive', rect: slot(g.continueBtn.w, g.continueBtn.h, g.continueBtn.yDown) });
  }
  // 仅重试档：重试钮**上移进主钮槽**（牌高 404 = 586 − 154 − 28）⇒ 牌底留白 90 不变，
  // ⛔ 不沿用 586 档的 yDown 359（那会把钮甩到牌外）。
  const retryYDown = withRevive ? g.retryBtn.yDown : g.continueBtn.yDown;
  buttons.push({ id: 'retry', rect: slot(g.retryBtn.w, g.retryBtn.h, retryYDown) });

  return {
    panel: plate,
    buttons,
    subtitle: withRevive ? '' : FAIL_PANEL_SUBTITLE,
  };
}

export function hitFailPanel(x: number, y: number, reviveAvailable: boolean): FailPanelAction | null {
  const layout = failPanelLayout(reviveAvailable);
  for (const button of layout.buttons) {
    if (rectContains(button.rect, x, y)) return button.id;
  }
  return null;
}

/** 板标题（稿 `231:284`）。 */
export const FAIL_PANEL_TITLE = '时间到';
/** 仅重试档的说明行（产品补文案，稿上无此行）。 */
export const FAIL_PANEL_SUBTITLE = '本关已续时';
/**
 * 续时钮副行（稿 `233:40`「看广告能增加60秒时间」）——**秒数由 §3.11 冻结值派生**：
 * 稿写死 60，与 `REVIVE_BONUS_SEC = 180`（v1.25 冻结）冲突 ⇒ 按 AGENTS §4 以 §3 为准取 180，
 * 漂移登记见 `design/ux/timeout-panel-spec.md §5`。模块级一次成串 ⇒ 逐帧返回**同一引用**（零分配）。
 */
const REVIVE_HINT = `看广告能增加${REVIVE_BONUS_SEC}秒时间`;

/**
 * Button copy — 主行只写动作（稿 `233:39` / `233:49`）；「增加多少秒」落在副行
 * {@link failPanelHint}，⛔ 不再把 `+180秒` 塞进主行（稿面主行无此时长）。
 */
export function failPanelLabel(id: FailPanelAction): string {
  return id === 'revive' ? '继续本关' : '重试本关';
}

/** 续时钮副行文案（含 `REVIVE_BONUS_SEC`，不只说「看视频」）。 */
export function failPanelHint(): string {
  return REVIVE_HINT;
}
