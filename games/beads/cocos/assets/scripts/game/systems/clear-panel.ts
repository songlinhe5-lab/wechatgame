/**
 * ClearPanel — 结算·过关面板（S7）的**逻辑**：布局与命中、星级入场节奏。
 *
 * 与其他系统同纪律：本模块**绝不触碰玩法状态**（不写网格 / 托盘 / 倒计时）。`BeadsGame`
 * 持有权威相位与结算数据，并执行本模块从点击里解析出的动作。
 *
 * 开合时钟与入场公式由四个结算弹窗共享（UI-33 ⇒ `result-panel.ts`）；布局与命中纯函数
 * 按 `ui-architecture-beads §8` 就地保留。
 *
 * 冻结来源
 *  - 布局：`ux/ux-spec.md` §3.4（`panel_dialog` 560×480；主钮「下一关」+ 副钮「▶去冲刺」
 *    并排，两者各 ≥ `TOUCH_MIN`）—— 常量镜像在 `config/tuning.ts`；
 *  - 动画：`ux/ux-spec.md` §5（**星入场逐颗 150ms** ⇒ `CLEAR_STAR_STEP_MS`；面板入 / 出 200 / 150ms）；
 *  - 内容：§3.4 四段——缎带标题 / 星级行 / **判星对照**「3★ 用时 ≤ mm:ss ｜ 2★ 用时 ≤ mm:ss」
 *    / 次要信息「剩余 mm:ss ｜ 道具 n/3」。
 *
 * 布局与命中共用 `clearPanelLayout()`（按 `lastLevel` 缓存两份），图与热区不可能各说一套。
 *
 * ⚠️ 与旧实现的差别（WXG-T-063）：`LEVEL_CLEAR` 此前是「1.4s 后自动进下一关」的占位，
 * 而 `ux-spec §4` 的流转表写的是「LEVEL_CLEAR → 下一关 / 去冲刺*(U1) → 玩法·n+1 / 玩法·冲刺」
 * ⇒ **面板必须等按钮**，自动推进已删除（`LEVEL_CLEAR_DELAY_S` 随之退休）。
 *
 * `[WXG-T-509]` 精简为 **A·静纸卡**：面板 520×440、四类内容（星/用时/豆/差距提示）、
 * 单钮 320×92。品质分与「好友这关榜」chip 从面板退场（品质分仍算、仍进榜；好友榜仍在首页）。
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
} from '../config/tuning';
import { rectContains, type PanelRect } from './pause-panel';
import { ResultPanelClock } from './result-panel';

/** 面板按钮能请求的三件事（动作由 `BeadsGame` 执行；`sprint` 入口仍隐藏）。 */
export type ClearPanelAction = 'next' | 'sprint' | 'menu';

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
  /** 核心信息区（限定 400×192）：星 / 用时 / 豆 / 提示 必须落在框内。 */
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

let _normal: ClearPanelLayout | null = null;
let _lastLevel: ClearPanelLayout | null = null;

/** 静态几何，按 `lastLevel` 缓存两份（布局运行时不变 ⇒ 不逐帧分配）。 */
export function clearPanelLayout(opts: ClearPanelOptions): ClearPanelLayout {
  if (opts.lastLevel) {
    _lastLevel ??= build(true);
    return _lastLevel;
  }
  _normal ??= build(false);
  return _normal;
}

function build(lastLevel: boolean): ClearPanelLayout {
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
  void lastLevel;
  return { panel, buttons, titleY, starsY, timeY, rewardY, hintY, content, starX };
}

/** 按钮文案（`ux-spec §3.4`；末关主钮文案为派生项）。 */
export function clearPanelLabel(id: ClearPanelAction, lastLevel: boolean): string {
  if (id === 'menu') return '回主界面';
  if (id === 'sprint') return '▶ 去冲刺';
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
