/**
 * FinishPanel — 通关画面（S7 / `FINISH`）的**逻辑**：逐关入场节奏、星级总览布局与按钮
 * 几何 / 命中。开合时钟走四个结算弹窗共享的骨架（UI-33 ⇒ `result-panel.ts`）。
 *
 * 与其他系统同纪律：本模块**绝不触碰玩法状态**（不写网格 / 托盘 / 倒计时 / 存档）。星级
 * 数据由 `BeadsGame` 持有（`_starsByLevel` = 每关历史最好），本模块只做几何与呈现时序。
 *
 * 冻结来源
 *  - 画面：`ux/ux-spec.md` §3.6「全屏庆祝 + 星级总览（8 关星数和）+「重玩第 1 关」
 *    +「回主菜单」副钮（v1.18 直派，go-menu 同语义）」；
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
 *  3. 星级总览取值 = **每关历史最好**（重玩取 max）；该表**随存档跨重启保持**
 *     （S8 GDD §2.2 的 `stars`，WXG-T-071 落码 —— 此前为局内累计，冷启动丢失）。
 */

import {
  // 用户 2026-09-25 直派：`CLEAR_BUTTON_GAP` 随「回主菜单」副钮两格布局重新引入
  // （WXG-T-177 曾因单钮居中移出；复建 U1 三处入口时同用此常量）。
  CLEAR_BUTTON_GAP,
  CLEAR_BUTTON_W,
  CONFETTI_NOFLY_YMIN,
  DESIGN_H,
  DESIGN_W,
  FINISH_LEVEL_STEP_MS,
  FINISH_ROW_GAP,
  FINISH_ROW_H,
  FINISH_ROW_W,
  FINISH_SHELF,
  FINISH_STAR_GAP,
  FINISH_STAR_SIZE,
  PANEL_BUTTON_H,
  STAR_MAX,
} from '../config/tuning.js';
import { rectContains, type PanelRect } from './pause-panel.js';
import { ResultPanelClock } from './result-panel.js';

/** 通关画面能请求的四件事（动作由 `BeadsGame` 执行；分享属平台层，见 `beads-shell`）。 */
export type FinishPanelAction = 'replay' | 'sprint' | 'menu' | 'share';

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
  /**
   * 作品陈列条（EP12-S7）：底板 + 逐关一格（与 `rows` 同序）。**纯展示、零热区**——
   * 不进 `buttons`，`hitFinishPanel` 永不命中它。
   */
  readonly shelf: { readonly plate: PanelRect; readonly cells: readonly PanelRect[] };
}

/** 庆祝标题（`ux-spec §3.6` 全屏庆祝；文案为派生项）。 */
export const FINISH_PANEL_TITLE = '🎊 全部通关';
/** 每关满星数 —— 与存档 `stars` 的钳制上界同一常量（`tuning.ts §3.7` 的 `STAR_MAX`）。 */
export const FINISH_MAX_STARS_PER_LEVEL = STAR_MAX;

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

  // WXG-T-177（用户 2026-09-19「去冲刺按钮先隐藏」）：冲刺入口隐藏，不产出按钮
  // （旧口径「▶去冲刺 / 重玩第 1 关」2 格均分见 `ux-spec §4` 矩阵行，已按 K-053
  // 删划线留档）。用户 2026-09-25 直派：补「回主菜单」副钮（core-loop v2.3；
  // 复用暂停面板 `go-menu` 语义——上报意图、切屏归 shell）⇒ 主/副两格，总宽
  // 仍为 `CLEAR_BUTTON_W` 整体居中；`CLEAR_BUTTON_GAP` 随两格布局复建引入。
  // `FinishPanelAction` 的 `'sprint'` 成员与文案分支保留备复建，但不再产出。
  //
  // WXG-T-405：补「分享」位（结算面板炫耀 = 框架层 Platform.share）。三按钮横排
  // replay(主) / share(次) / menu(副)，cellW 三等分。
  const startX = (DESIGN_W - CLEAR_BUTTON_W) / 2;
  const buttonY = 120;
  const cellW = (CLEAR_BUTTON_W - 2 * CLEAR_BUTTON_GAP) / 3;
  const buttons: FinishButton[] = [
    { id: 'replay', rect: rect(startX, buttonY, cellW, PANEL_BUTTON_H) },
    { id: 'share', rect: rect(startX + cellW + CLEAR_BUTTON_GAP, buttonY, cellW, PANEL_BUTTON_H) },
    { id: 'menu', rect: rect(startX + 2 * (cellW + CLEAR_BUTTON_GAP), buttonY, cellW, PANEL_BUTTON_H) },
  ];

  return { titleY, totalY, rows, buttons, shelf: buildShelf(levelCount, rows, buttonY + PANEL_BUTTON_H) };
}

/**
 * 陈列条：夹在按钮行上缘与「总览末行下缘 / 彩带禁飞带下缘」较低者之间、水平居中；
 * 格边取宽/高两向可容纳的较小值（关数少 ⇒ 总览行高悬，净空带会跨进禁飞带 ⇒ 须封顶）。
 */
function buildShelf(
  levelCount: number,
  rows: readonly FinishRow[],
  buttonTop: number,
): FinishPanelLayout['shelf'] {
  const S = FINISH_SHELF;
  const rowsBottom = rows.length > 0 ? rows[rows.length - 1]!.y - FINISH_ROW_H / 2 : CONFETTI_NOFLY_YMIN;
  const top = Math.min(rowsBottom, CONFETTI_NOFLY_YMIN);
  const n = Math.max(1, levelCount);
  const byW = (S.w - 2 * S.pad - (n - 1) * S.gap) / n;
  const byH = top - buttonTop - 2 * S.margin - 2 * S.pad;
  const cell = Math.max(0, Math.floor(Math.min(S.cellMax, byW, byH)));
  const plateW = n * cell + (n - 1) * S.gap + 2 * S.pad;
  const plateH = cell + 2 * S.pad;
  const plateX = (DESIGN_W - plateW) / 2;
  const plateY = (buttonTop + top - plateH) / 2;
  const cells: PanelRect[] = [];
  for (let i = 0; i < levelCount; i++) {
    cells.push(rect(plateX + S.pad + i * (cell + S.gap), plateY + S.pad, cell, cell));
  }
  return { plate: rect(plateX, plateY, plateW, plateH), cells };
}

/**
 * 按钮文案（`ux-spec §4` 矩阵行；「回主菜单」= 暂停面板 go-menu 同语义）。
 * 与结算面板不同：**主钮是「重玩第 1 关」**（`core-loop §4` 把「重玩第 1 关 → PLAYING」
 * 定为本状态的推进出口之一），菜单钮按 v1.18 退为副钮，冲刺入口按 U1 保留分支。
 */
export function finishPanelLabel(id: FinishPanelAction): string {
  if (id === 'sprint') return '▶ 去冲刺';
  if (id === 'share') return '炫耀一下';
  if (id === 'menu') return '回主菜单';
  return '重玩第 1 关';
}

/** 命中测试（按钮外的任何点击 → null ⇒ 调用方零响应，`input-control §2.3`）。 */
export function hitFinishPanel(x: number, y: number, levelCount: number): FinishPanelAction | null {
  for (const button of finishPanelLayout(levelCount).buttons) {
    if (rectContains(button.rect, x, y)) return button.id;
  }
  return null;
}

/**
 * 面板生命周期走共享骨架（UI-33）：入 200ms / 出 150ms、入场即可点、退场零响应；
 * 逐关入场（`FINISH_LEVEL_STEP_MS`，派生口径见模块头注）由同一公式排出。
 */
export class FinishPanel {
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

  /** 已入场的**关数**（`0..count`）：第 `i` 关在 `i × FINISH_LEVEL_STEP_MS` 时入场；退场中恒 0。 */
  rowsShown(count: number): number {
    return this._clock.popsShown(count, FINISH_LEVEL_STEP_MS);
  }

  /** 第 `index` 行的入场缩放（0 → 1.2 → 1 弹跳；之后恒 1）。纯呈现量。 */
  rowPopScale(index: number): number {
    return this._clock.popScale(index, FINISH_LEVEL_STEP_MS);
  }

  hitTest(x: number, y: number, levelCount: number): FinishPanelAction | null {
    if (!this.interactive) return null;
    return hitFinishPanel(x, y, levelCount);
  }
}
