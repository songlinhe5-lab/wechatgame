/**
 * SprintSettlePanel — 冲刺结算面板（`GAME_OVER` · 冲刺态）的**逻辑**：内容行几何与按钮
 * 布局 / 命中。开合时钟走四个结算弹窗共享的骨架（UI-33 ⇒ `result-panel.ts`）。
 *
 * 与其他系统同纪律：本模块**绝不触碰玩法状态**（不写分数 / 连击 / 存档）。结算数据由
 * `BeadsGame` 持有（`SprintTracker` + `_isNewBest`），本模块只做几何与文案。
 *
 * 冻结来源
 *  - 画面：`ux/ux-spec.md` §3.5 **左列**「冲刺结算」——三行内容（「单局 N」/「最高梯位
 *    第 n 梯」/「▸×M 最高连击 K」）+ 双钮「再来一局 / 返回关卡」；§3.5 明写「冲刺归零：
 *    **不出现**续时主钮，只走左列冲刺结算」；
 *  - 相位：`gdd/core-loop.md` §4 状态表 `| 玩法·冲刺 | 倒计时归零 | 冲刺结算（无续时）|
 *    冲刺结算 |` —— 复用 `GAME_OVER` 相位（`score-combo §2.1`：「sprint 是 Game 上的 mode
 *    flag，状态机零冲刺分支」）；
 *  - 判据：`score-combo §8-11`「破纪录：sprint 结算分 > S8 最佳 → NEW BEST 显示且 S8 写入
 *    新值；≤ 最佳 → 不写不显示」——**写盘半边**已由 `_recordSprintEnd()` 承担（`score >
 *    sprintBestScore` ⇒ patch + save），本模块负责「显示」半边与按钮出口；
 *  - 动画：面板入 / 出 200 / 150ms（`ux-spec §5`「面板入 / 出」行）。
 *
 * ⚠️ 派生项（已登记台账）
 *  1. §3.5 左列**没有标题行**（首行即「单局 N」），而本面板家族（暂停 / 结算 / 失败 / 通关）
 *     都有标题 ⇒ 增「冲刺结束」标题行；几何沿用面板常量族（`CLEAR_BUTTON_*` / `PANEL_*`）；
 *  2. 「▸×M 最高连击 K」的 `M` 由 `K` **重算**（`multiplierForStreak(bestStreak)`）而不另存
 *     一个倍率字段——与 `SprintTracker.restore()` 的「streak 是唯一权威」同口径；
 *  3. `§8-11` 只说「显示 / 不显示」，未给角标位置 ⇒ 角标贴标题行右侧（同 `ad_badge` 的角标语汇）。
 */

import {
  CLEAR_BUTTON_GAP,
  CLEAR_BUTTON_W,
  DESIGN_H,
  DESIGN_W,
  PANEL_BUTTON_H,
  PANEL_PADDING,
} from '../config/tuning.js';
import { rectContains, type PanelRect } from './pause-panel.js';
import { ResultPanelClock } from './result-panel.js';
import { multiplierForStreak } from './sprint.js';

/** 面板能请求的两件事（动作由 `BeadsGame` 执行）。 */
export type SprintSettleAction = 'again' | 'back';

export interface SprintSettleRow {
  /** 行标签（空串 = 该行只有值，如「▸×5 最高连击 14」）。 */
  readonly label: string;
  /** 行中心 y。 */
  readonly y: number;
  /** 标签中心 x。 */
  readonly labelX: number;
  /** 值（右对齐）中心 x。 */
  readonly valueX: number;
}

export interface SprintSettleButton {
  readonly id: SprintSettleAction;
  readonly rect: PanelRect;
}

export interface SprintSettleLayout {
  readonly panel: PanelRect;
  /** 标题基线 y。 */
  readonly titleY: number;
  /** 三行内容（「单局」/「最高梯位」/「最高连击」）。 */
  readonly rows: readonly SprintSettleRow[];
  /** NEW BEST 角标（`§8-11`：仅破纪录时渲染）。 */
  readonly badge: PanelRect;
  /** 两个按钮，视觉优先级序（主钮「再来一局」在前）。 */
  readonly buttons: readonly SprintSettleButton[];
}

/** 面板标题（派生项 1；§3.5 左列无标题行）。 */
export const SPRINT_SETTLE_TITLE = '冲刺结束';
/** `§8-11` 的破纪录角标文案。 */
export const SPRINT_SETTLE_NEW_BEST = 'NEW BEST';

/** 结算面板三行的静态标签（值见 `sprintSettleRows`）。 */
const ROW_LABELS = ['单局', '最高梯位', ''] as const;

/** 千位分隔（§3.5 示例「单局 12,340」；非有限值/负数按 0 处理）。 */
export function formatScore(n: number): string {
  const v = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface SprintSettleValues {
  /** 本局结算分（= `sprint:ended.settleScore`，`§8-11` 与 §8-8 同值）。 */
  readonly score: number;
  /** 本局最远梯位（0-based ⇒ 显示 `+1`）。 */
  readonly bestStage: number;
  /** 本局最高连击。 */
  readonly bestStreak: number;
}

/**
 * 三行内容的值（与 `layout.rows` 一一对应）。纯函数 ⇒ 可直接断言文案。
 */
export function sprintSettleRows(v: SprintSettleValues): readonly string[] {
  const stage = Number.isInteger(v.bestStage) && v.bestStage > 0 ? v.bestStage : 0;
  const streak = Number.isInteger(v.bestStreak) && v.bestStreak > 0 ? v.bestStreak : 0;
  return [
    formatScore(v.score),
    `第 ${stage + 1} 梯`,
    streak > 0 ? `▸×${multiplierForStreak(streak)} 最高连击 ${streak}` : '—',
  ];
}

function rect(x: number, y: number, w: number, h: number): PanelRect {
  return { xMin: x, yMin: y, xMax: x + w, yMax: y + h };
}

let _cache: SprintSettleLayout | null = null;

/** 静态几何（布局运行时不变 ⇒ 不逐帧分配）。 */
export function sprintSettleLayout(): SprintSettleLayout {
  if (_cache) return _cache;
  const plateW = 560;
  const plateH = 420;
  const panel = rect((DESIGN_W - plateW) / 2, (DESIGN_H - plateH) / 2, plateW, plateH);
  const titleY = panel.yMax - 56;
  const scoreY = titleY - 64;
  const labelX = panel.xMin + PANEL_PADDING + 60;
  const valueX = panel.xMax - PANEL_PADDING - 90;
  const rowPitch = 52;
  const rows: SprintSettleRow[] = ROW_LABELS.map((label, i) => ({
    label,
    y: scoreY - i * rowPitch,
    labelX,
    valueX,
  }));
  const totalW = CLEAR_BUTTON_W * 2 + CLEAR_BUTTON_GAP;
  const startX = (DESIGN_W - totalW) / 2;
  const buttonY = panel.yMin + PANEL_PADDING;
  const buttons: SprintSettleButton[] = [
    { id: 'again', rect: rect(startX, buttonY, CLEAR_BUTTON_W, PANEL_BUTTON_H) },
    {
      id: 'back',
      rect: rect(startX + CLEAR_BUTTON_W + CLEAR_BUTTON_GAP, buttonY, CLEAR_BUTTON_W, PANEL_BUTTON_H),
    },
  ];
  _cache = {
    panel,
    titleY,
    rows,
    // BD-45（WXG-T-127）：底衬必须容得下 28px「NEW BEST」（Chrome measureText 实测
    // 147px）。原 120 宽令角标白字两端溢出深底、落在白面板上隐形（读成「EW BES」）。
    // 168 = 147 + 两侧各 ≈10 填充；xMin = 655−24−168 = 463，与标题「冲刺结束」
    // （40px × 4 字 ⇒ 右缘 ≈455）净空 ≈8px。视图侧文字固定 28px（见 drawSprintSettle），
    // 不随 E2 大字号放大 ⇒ 本宽度是闭口约束，不再有更宽字号的溢出路径。
    badge: rect(panel.xMax - PANEL_PADDING - 168, titleY - 16, 168, 32),
    buttons,
  };
  return _cache;
}

/** 按钮文案（`ux-spec §3.5` 左列双钮）。 */
export function sprintSettleLabel(id: SprintSettleAction): string {
  return id === 'back' ? '返回关卡' : '再来一局';
}

/** 命中测试（两钮之外 → null ⇒ 调用方零响应）。 */
export function hitSprintSettle(x: number, y: number): SprintSettleAction | null {
  for (const button of sprintSettleLayout().buttons) {
    if (rectContains(button.rect, x, y)) return button.id;
  }
  return null;
}

/**
 * 面板生命周期走共享骨架（UI-33）：入 200ms / 出 150ms、入场即可点、退场零响应。
 */
export class SprintSettlePanel {
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

  hitTest(x: number, y: number): SprintSettleAction | null {
    if (!this.interactive) return null;
    return hitSprintSettle(x, y);
  }
}
