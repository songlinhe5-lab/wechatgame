/**
 * FinishPanel — 通关画面（S7 / `FINISH`）的**逻辑**：可见性、入 / 出动画进度、逐关星级
 * 入场进度、星级总览布局与按钮几何 / 命中。
 *
 * 与其他系统同纪律：本模块**绝不触碰玩法状态**（不写网格 / 托盘 / 倒计时 / 存档）。星级
 * 数据由 `BeadsGame` 持有（`_starsByLevel` = 每关历史最好），本模块只做几何与呈现时序。
 *
 * 冻结来源
 *  - 画面：`ux/ux-spec.md` §3.6「全屏庆祝 + 星级总览（8 关星数和）+「去冲刺」+「重玩第 1 关」」；
 *  - 状态：`gdd/core-loop.md` §4 状态表 `FINISH | 通关画面（8 关全清） | 最后关 LEVEL_CLEAR
 *    确认 | 重玩第 1 关 → PLAYING`；判据 `core-loop §8-8`「第 8 关通过 → 进 FINISH；
 *    FINISH 可重玩第 1 关」；
 *  - 输入：`gdd/input-control.md` §2.3「LEVEL_CLEAR / GAME_OVER / FINISH：**仅**结算 / 失败
 *    面板按钮」⇒ 面板外点击零响应；`ux-spec §4` 矩阵行 `FINISH | 去冲刺* / 重玩第 1 关
 *    | 玩法·冲刺 / 玩法·L1`；
 *  - 副钮：`gdd/pause-settings.md` §2「去冲刺 = **副按钮**样式，不抢主钮」+ `ux-spec §8` U1
 *    （冲刺入口三处：结算过关页 / 通关画面 / 暂停面板）；
 *  - 动画：入 200ms / 出 150ms（与 S9 暂停面板、S7 结算面板同口径）。
 *
 * ⚠️ 三处**派生项**（GDD / UX 无明文，已登记台账）
 *  1. §3.6 只有一句画面描述、**未给几何** ⇒ 布局（标题位 / 8 行竖列 / 星尺寸）沿用结算
 *     面板的常量族与设计空间约定；
 *  2. `ux-spec §5`「逐颗 150ms」是**结算行 3 颗**的时序；总览最多 8×3 = 24 颗、逐颗要
 *     3.6s ✗ ⇒ 改为**逐关** 150ms（8 关 = 1.2s），同一关的 3 颗同时入场；
 *  3. 星级总览取值 = **每关历史最好**（重玩取 max，与 `maxUnlockedLevel` 的持久语义一致）；
 *     存档**无**星级表（S8 schema 未改，本轮不动 schema）⇒ 本次为**局内累计**，冷启动丢失
 *     （已登记 backlog）。
 */

import {
  CLEAR_BUTTON_GAP,
  CLEAR_BUTTON_W,
  DESIGN_H,
  DESIGN_W,
  FINISH_LEVEL_STEP_MS,
  FINISH_ROW_GAP,
  FINISH_ROW_H,
  FINISH_ROW_W,
  FINISH_STAR_GAP,
  FINISH_STAR_SIZE,
  PANEL_BUTTON_H,
  PANEL_IN_MS,
  PANEL_OUT_MS,
} from '../config/tuning.js';
import { rectContains, type PanelRect } from './pause-panel.js';

/** 通关画面能请求的两件事（动作由 `BeadsGame` 执行）。 */
export type FinishPanelAction = 'replay' | 'sprint';

export interface FinishButton {
  readonly id: FinishPanelAction;
  readonly rect: PanelRect;
}

/** 星级总览的一行：关卡号 + 标签位 + 3 颗星的中心 x。 */
export interface FinishRow {
  /** 1-based 关卡号（文案「第 n 关」）。 */
  readonly level: number;
  /** 行中心 y。 */
  readonly y: number;
  /** 「第 n 关」标签的**中心** x（视图按 center 基线绘制，与按钮文案同口径）。 */
  readonly labelX: number;
  /** 3 颗星的中心 x（索引 0 = 最左）。 */
  readonly starX: readonly number[];
}

export interface FinishPanelLayout {
  /** 庆祝标题基线 y。 */
  readonly titleY: number;
  /** 「共 N / M ★」总星数基线 y。 */
  readonly totalY: number;
  /** 星级总览各行（按关卡序）。 */
  readonly rows: readonly FinishRow[];
  /** 两个按钮，视觉优先级序（主钮「重玩第 1 关」在前）。 */
  readonly buttons: readonly FinishButton[];
}

/** 庆祝标题（`ux-spec §3.6` 全屏庆祝；文案为派生项）。 */
export const FINISH_PANEL_TITLE = '🎊 全部通关';
/** 每关满星数（`computeClearStars` 的上限）。 */
export const FINISH_MAX_STARS_PER_LEVEL = 3;

function rect(x: number, y: number, w: number, h: number): PanelRect {
  return { xMin: x, yMin: y, xMax: x + w, yMax: y + h };
}

let _cache: { levelCount: number; layout: FinishPanelLayout } | null = null;

/** 静态几何，按关卡数缓存一份（布局运行时不变 ⇒ 不逐帧分配）。 */
export function finishPanelLayout(levelCount: number): FinishPanelLayout {
  if (_cache && _cache.levelCount === levelCount) return _cache.layout;
  _cache = { levelCount, layout: build(levelCount) };
  return _cache.layout;
}

function build(levelCount: number): FinishPanelLayout {
  const titleY = DESIGN_H - 180;
  const totalY = titleY - 90;
  const rowTop = totalY - 80;
  const left = DESIGN_W / 2 - FINISH_ROW_W / 2;
  const right = DESIGN_W / 2 + FINISH_ROW_W / 2;
  const starsW = FINISH_STAR_SIZE * 3 + FINISH_STAR_GAP * 2;
  const firstStar = right - starsW + FINISH_STAR_SIZE / 2;

  const rows: FinishRow[] = [];
  for (let i = 0; i < levelCount; i++) {
    rows.push({
      level: i + 1,
      y: rowTop - i * (FINISH_ROW_H + FINISH_ROW_GAP) - FINISH_ROW_H / 2,
      labelX: left + 140,
      starX: [0, 1, 2].map((k) => firstStar + k * (FINISH_STAR_SIZE + FINISH_STAR_GAP)),
    });
  }

  const totalW = CLEAR_BUTTON_W * 2 + CLEAR_BUTTON_GAP;
  const startX = (DESIGN_W - totalW) / 2;
  const buttonY = 120;
  const buttons: FinishButton[] = [
    { id: 'replay', rect: rect(startX, buttonY, CLEAR_BUTTON_W, PANEL_BUTTON_H) },
    {
      id: 'sprint',
      rect: rect(startX + CLEAR_BUTTON_W + CLEAR_BUTTON_GAP, buttonY, CLEAR_BUTTON_W, PANEL_BUTTON_H),
    },
  ];

  return { titleY, totalY, rows, buttons };
}

/**
 * 按钮文案（`ux-spec §4` 矩阵行；「去冲刺」沿用结算面板的副钮文案，U1 三处一致）。
 * 与结算面板不同：**主钮是「重玩第 1 关」**（`core-loop §4` 把「重玩第 1 关 → PLAYING」
 * 定为本状态的唯一推进出口），冲刺入口按 U1 退为副钮。
 */
export function finishPanelLabel(id: FinishPanelAction): string {
  return id === 'sprint' ? '▶ 去冲刺' : '重玩第 1 关';
}

/** 命中测试（按钮外的任何点击 → null ⇒ 调用方零响应，`input-control §2.3`）。 */
export function hitFinishPanel(x: number, y: number, levelCount: number): FinishPanelAction | null {
  for (const button of finishPanelLayout(levelCount).buttons) {
    if (rectContains(button.rect, x, y)) return button.id;
  }
  return null;
}

/**
 * 面板状态机：入 200ms / 出 150ms（与 S9、S7 结算面板同口径），另持**逐关入场**计时。
 *
 * `progress` 契约与 `PausePanel` / `ClearPanel` 一致：进入 0→1，退出 1→0，未显示 = 0；
 * `interactive` 只在「已显示且未在退出」时为真（退出淡出期不接受点击）。
 */
export class FinishPanel {
  private _elapsed = 0;
  private _shown = false;
  private _closing = false;

  open(): void {
    this._shown = true;
    this._closing = false;
    this._elapsed = 0;
  }

  close(): void {
    if (!this._shown) return;
    this._closing = true;
    this._elapsed = 0;
  }

  update(dtMs: number): void {
    if (!this._shown) return;
    this._elapsed += Math.max(0, dtMs);
    if (this._closing && this._elapsed >= PANEL_OUT_MS) {
      this._shown = false;
      this._closing = false;
      this._elapsed = 0;
    }
  }

  get visible(): boolean {
    return this._shown;
  }

  get interactive(): boolean {
    return this._shown && !this._closing;
  }

  get progress(): number {
    if (!this._shown) return 0;
    if (this._closing) return Math.max(0, 1 - this._elapsed / PANEL_OUT_MS);
    return Math.min(1, this._elapsed / PANEL_IN_MS);
  }

  /** 面板自打开起的毫秒数（逐关入场计时用）。 */
  get elapsedMs(): number {
    return this._elapsed;
  }

  /**
   * 已入场的**关数**（`0..count`）：第 `i` 关在 `i × FINISH_LEVEL_STEP_MS` 时入场。
   * 关闭中返回 0（与 `ClearPanel.starsShown` 同口径）。
   */
  rowsShown(count: number): number {
    if (!this._shown || this._closing) return 0;
    let shown = 0;
    for (let i = 0; i < count; i++) {
      if (this._elapsed >= i * FINISH_LEVEL_STEP_MS) shown = i + 1;
    }
    return shown;
  }

  /**
   * 第 `index` 行入场的缩放（150ms 内 0 → 1.2 → 1 弹跳；之后恒 1）。
   * 纯呈现量，不含任何玩法语义。
   */
  rowPopScale(index: number): number {
    if (!this._shown) return 0;
    const local = (this._elapsed - index * FINISH_LEVEL_STEP_MS) / FINISH_LEVEL_STEP_MS;
    if (local <= 0) return 0;
    if (local >= 1) return 1;
    return local < 0.5 ? (local / 0.5) * 1.2 : 1.2 - 0.2 * ((local - 0.5) / 0.5);
  }

  hitTest(x: number, y: number, levelCount: number): FinishPanelAction | null {
    if (!this.interactive) return null;
    return hitFinishPanel(x, y, levelCount);
  }
}
