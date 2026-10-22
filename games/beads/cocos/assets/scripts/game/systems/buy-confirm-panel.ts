/**
 * BuyConfirmPanel — 道具购买确认弹窗的**纯几何**（`ux-spec §3.7` / §3.6 v1.80 豆子出口）。
 *
 * 与其它面板同构：本模块**不碰玩法状态**（无网格 / 托盘 / 计时写），只给「板在哪、两颗钮在哪、
 * 标题基线在哪」，命中与绘制共用同一份 `buyConfirmLayout()` ⇒ 图与热区不可能漂移。
 *
 * Frozen sources
 *  - 版面：`ux/ux-spec.md` **§3.7**（560×300 居中板，下排 2×240×88、间距 24；左取消 / 右确定）；
 *  - 文案：`copy-tokens.ts`（`powerup_buy_confirm_title` / `btn_confirm_label` / `btn_cancel_label`）。
 *
 * ⚠ 本批**静态出图、无进出场动画**（与 `ux-spec §5` 弹窗动效表的差异已登记 `[待 art]`）。
 */

import {
  DESIGN_H,
  DESIGN_W,
  PANEL_BUTTON_H,
  PANEL_PADDING,
  PANEL_ROW_GAP,
  PANEL_SIZE,
  PANEL_TITLE_BAND_H,
} from '../config/tuning';

/** 弹窗可请求的动作。 */
export type BuyConfirmAction = 'buy-confirm' | 'buy-cancel';

/** 设计坐标系轴对齐矩形（y 向上，与 `pause-panel` 同型）。 */
export interface BuyConfirmRect {
  readonly xMin: number;
  readonly yMin: number;
  readonly xMax: number;
  readonly yMax: number;
}

export interface BuyConfirmButton {
  readonly id: BuyConfirmAction;
  readonly rect: BuyConfirmRect;
}

export interface BuyConfirmLayout {
  /** 弹窗纸面板本身。 */
  readonly panel: BuyConfirmRect;
  /** 两颗钮：`[0]` = 取消（次）、`[1]` = 确定（主）。 */
  readonly buttons: readonly BuyConfirmButton[];
  /** 标题基线 y。 */
  readonly titleY: number;
}

/** 弹窗高度：标题带 + 一排钮 + 上下 padding。 */
const BUY_CONFIRM_H = PANEL_TITLE_BAND_H + PANEL_BUTTON_H + PANEL_PADDING * 3;
/** 钮宽：板宽减两侧 padding，再按 2 颗 + 间距对分。 */
const BUY_CONFIRM_BTN_W = (PANEL_SIZE.w - PANEL_PADDING * 2 - PANEL_ROW_GAP) / 2;

let _layout: BuyConfirmLayout | null = null;

function rect(x: number, y: number, w: number, h: number): BuyConfirmRect {
  return { xMin: x, yMin: y, xMax: x + w, yMax: y + h };
}

export function rectContains(r: BuyConfirmRect, x: number, y: number): boolean {
  return x >= r.xMin && x <= r.xMax && y >= r.yMin && y <= r.yMax;
}

/**
 * 静态几何（运行时不变 ⇒ 全进程一份，热路径零分配）。
 * 纵向居中于设计画布：`yMin = (DESIGN_H − h) / 2`，恒在胶囊避让线（y ≥ 1214）之下。
 */
export function buyConfirmLayout(): BuyConfirmLayout {
  if (_layout) return _layout;
  const left = (DESIGN_W - PANEL_SIZE.w) / 2;
  const bottom = (DESIGN_H - BUY_CONFIRM_H) / 2;
  const panel = rect(left, bottom, PANEL_SIZE.w, BUY_CONFIRM_H);

  const btnY = bottom + PANEL_PADDING;
  const cancelX = left + PANEL_PADDING;
  const confirmX = cancelX + BUY_CONFIRM_BTN_W + PANEL_ROW_GAP;

  _layout = {
    panel,
    buttons: [
      { id: 'buy-cancel', rect: rect(cancelX, btnY, BUY_CONFIRM_BTN_W, PANEL_BUTTON_H) },
      { id: 'buy-confirm', rect: rect(confirmX, btnY, BUY_CONFIRM_BTN_W, PANEL_BUTTON_H) },
    ],
    titleY: bottom + BUY_CONFIRM_H - PANEL_TITLE_BAND_H / 2,
  };
  return _layout;
}

/** 命中（模态：板外也消费，由调用方决定「点板外 = 取消」）。 */
export function hitBuyConfirm(x: number, y: number): BuyConfirmAction | null {
  for (const button of buyConfirmLayout().buttons) {
    if (rectContains(button.rect, x, y)) return button.id;
  }
  return null;
}
