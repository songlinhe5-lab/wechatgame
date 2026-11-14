/**
 * ClearPanel — 结算·过关面板（S7）的**逻辑**：布局与命中、星级入场节奏。
 *
 * 与其他系统同纪律：本模块**绝不触碰玩法状态**（不写网格 / 托盘 / 倒计时）。`BeadsGame`
 * 持有权威相位与结算数据，并执行本模块从点击里解析出的动作。
 *
 * 开合时钟与入场公式由四个结算弹窗共享（UI-33 ⇒ `result-panel.ts`）；布局与命中纯函数
 * 按 `ui-architecture-beads §8` 就地保留。
 *
 * 现役版面（`ux-spec §3.4` v1.41 · `[WXG-T-510]`）：
 *  - 布局：`CLEAR_PANEL_SIZE` 520×470（仅结算用；其他面板仍 `PANEL_SIZE`），200×64 标题木牌
 *    骑上沿；四类内容 = 星级 / 用时 / `+N 豆` / 未满 3★ 的差距提示；
 *    主钮 300×92（木）+ 弱化次钮 150×88（纸）。
 *  - 动画：星入场逐颗 150ms（`CLEAR_STAR_STEP_MS`）；**面板本身是静态卡** ——
 *    `[WXG-T-509]` A 案「静纸卡」定稿不接 `clearPanelProgress` 补间，
 *    `ResultPanelClock` 的 200 / 150ms 只作**可见 / 可点门**（入场即可点、退场零响应）。
 *    `[WXG-T-947]` 快照随之退场 `clearPanelProgress` / `clearPanelInteractive`（无消费者）。
 *
 * 布局与命中共用 {@link clearPanelLayout} 的**单份缓存**（布局与 `lastLevel` 无关；
 * 末关只改主钮文案）⇒ 图与热区不可能各说一套。
 *
 * ⚠️ 与旧实现的差别（WXG-T-063）：`LEVEL_CLEAR` 此前是「1.4s 后自动进下一关」的占位，
 * 而 `ux-spec §4` 的流转表写的是「LEVEL_CLEAR → 下一关 / 去冲刺*(U1) → 玩法·n+1 / 玩法·冲刺」
 * ⇒ **面板必须等按钮**，自动推进已删除（`LEVEL_CLEAR_DELAY_S` 随之退休）。
 */

import {
  CLEAR_ACTION_H,
  CLEAR_ACTION_W,
  CLEAR_PANEL_SIZE,
  CLEAR_SECONDARY_H,
  CLEAR_SECONDARY_W,
  CLEAR_STAR_GAP,
  CLEAR_STAR_SIZE,
  CLEAR_STAR_STEP_MS,
  DESIGN_H,
  DESIGN_W,
  dialogShiftY,
} from '../config/tuning.js';
import { rectContains, type PanelRect } from './pause-panel.js';
import { ResultPanelClock } from './result-panel.js';

/** 面板按钮能请求的两件事（动作由 `BeadsGame` 执行；冲刺入口已隐藏，不再是可选动作）。 */
export type ClearPanelAction = 'next' | 'menu';

export interface ClearButton {
  readonly id: ClearPanelAction;
  readonly rect: PanelRect;
}

export interface ClearPanelLayout {
  /** 对话框底板（`[WXG-T-510]` 520×470，其他面板不受影响）。 */
  readonly panel: PanelRect;
  /** 主钮 + 弱化次钮（`menu`）；`sprint` 入口仍隐藏。 */
  readonly buttons: readonly ClearButton[];
  /** A2 木挂牌中心 y（= 面板上沿，挂牌骑在上沿）。 */
  readonly titleY: number;
  /** 星级行中心 y。 */
  readonly starsY: number;
  /** 用时行中心 y。 */
  readonly timeY: number;
  /** 发豆行中心 y。 */
  readonly rewardY: number;
  /** 差距提示行中心 y（仅未满 3★ 时画）。 */
  readonly hintY: number;
  /** 核心信息区（400×270）：星 / 用时 / 豆 / 提示 必须落在框内。 */
  readonly content: PanelRect;
  /** 三颗星的中心 x（索引 0 = 最左）。 */
  readonly starX: readonly number[];
}

export interface ClearPanelOptions {
  /**
   * 最后一关：主钮文案切为「查看结果」（点后进 FINISH）。§3.4 只给了「下一关」，
   * 末关无明文 ⇒ 本项为派生文案，登记于台账。
   */
  readonly lastLevel: boolean;
}

/** 标题（`[WXG-T-509]` 精简：去 emoji、去缎带）。 */
export const CLEAR_PANEL_TITLE = '过关';

function rect(x: number, y: number, w: number, h: number): PanelRect {
  return { xMin: x, yMin: y, xMax: x + w, yMax: y + h };
}

let _layout: ClearPanelLayout | null = null;

/** 静态几何，**单份缓存**（布局与 `lastLevel` 无关；末关只改主钮文案 ⇒ 不逐帧分配）。 */
export function clearPanelLayout(_opts: ClearPanelOptions): ClearPanelLayout {
  return (_layout ??= build());
}

function build(): ClearPanelLayout {
  const panel = rect(
    (DESIGN_W - CLEAR_PANEL_SIZE.w) / 2,
    // `[WXG-T-323]` 与暂停面板同源位移 ⇒ 中心对齐手机中心。
    (DESIGN_H - CLEAR_PANEL_SIZE.h) / 2 + dialogShiftY(),
    CLEAR_PANEL_SIZE.w,
    CLEAR_PANEL_SIZE.h,
  );
  const rowY = panel.yMin + 44;
  // `[WXG-T-510]` 双钮：主 300×92（木）+ 弱化 150×88（纸）；总宽 466 居中。
  const rowGap = 16;
  const rowTotal = CLEAR_ACTION_W + rowGap + CLEAR_SECONDARY_W;
  const rowLeft = (DESIGN_W - rowTotal) / 2;
  const buttons: ClearButton[] = [
    { id: 'next', rect: rect(rowLeft, rowY, CLEAR_ACTION_W, CLEAR_ACTION_H) },
    {
      id: 'menu',
      rect: rect(rowLeft + CLEAR_ACTION_W + rowGap, rowY + (CLEAR_ACTION_H - CLEAR_SECONDARY_H) / 2, CLEAR_SECONDARY_W, CLEAR_SECONDARY_H),
    },
  ];
  // `[WXG-T-510]` A2：标题木牌骑上沿；四行信息在牌下、双钮上。
  const titleY = panel.yMax;
  const starsY = panel.yMax - 102;
  const timeY = starsY - 56;
  const rewardY = starsY - 100;
  const hintY = starsY - 142;
  // 核心信息区（限定 400×270）：星顶 832 ≤ 850，提示底 ≥ 580。
  const contentTop = panel.yMax - 52;
  const contentBottom = rowY + CLEAR_ACTION_H + 12;
  const content = rect((DESIGN_W - 400) / 2, contentBottom, 400, contentTop - contentBottom);
  const starsTotal = CLEAR_STAR_SIZE * 3 + CLEAR_STAR_GAP * 2;
  const firstStar = (DESIGN_W - starsTotal) / 2 + CLEAR_STAR_SIZE / 2;
  const starX = [0, 1, 2].map((i) => firstStar + i * (CLEAR_STAR_SIZE + CLEAR_STAR_GAP));
  return { panel, buttons, titleY, starsY, timeY, rewardY, hintY, content, starX };
}

/** 按钮文案（`ux-spec §3.4`；末关主钮文案为派生项）。 */
export function clearPanelLabel(id: ClearPanelAction, lastLevel: boolean): string {
  if (id === 'menu') return '回主界面';
  return lastLevel ? '查看结果' : '下一关';
}

/** 命中测试（面板外 / 非交互期为 null）。 */
export function hitClearPanel(x: number, y: number, opts: ClearPanelOptions): ClearPanelAction | null {
  const layout = clearPanelLayout(opts);
  for (const button of layout.buttons) {
    if (rectContains(button.rect, x, y)) return button.id;
  }
  return null;
}

/**
 * 面板生命周期走共享骨架（UI-33）：入 200ms / 出 150ms、入场即可点、退场零响应。
 * 星级入场按 `ux-spec §5`「逐颗 150ms」由骨架的同一公式排出。
 */
export class ClearPanel {
  private readonly _clock = new ResultPanelClock();

  open(): void {
    this._clock.open();
  }

  close(): void {
    this._clock.close();
  }

  update(dtMs: number): void {
    this._clock.update(dtMs);
  }

  get visible(): boolean {
    return this._clock.visible;
  }

  get interactive(): boolean {
    return this._clock.interactive;
  }

  get progress(): number {
    return this._clock.progress;
  }

  /** 已入场的星数（`0..count`）：第 `i` 颗在 `i × CLEAR_STAR_STEP_MS` 时入场；退场中恒 0。 */
  starsShown(count: number): number {
    return this._clock.popsShown(count, CLEAR_STAR_STEP_MS);
  }

  /** 第 `index` 颗星的入场缩放（0 → 1.2 → 1 弹跳；之后恒 1）。纯呈现量。 */
  starScale(index: number): number {
    return this._clock.popScale(index, CLEAR_STAR_STEP_MS);
  }

  hitTest(x: number, y: number, opts: ClearPanelOptions): ClearPanelAction | null {
    if (!this.interactive) return null;
    return hitClearPanel(x, y, opts);
  }
}
