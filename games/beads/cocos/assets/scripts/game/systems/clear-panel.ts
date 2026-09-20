/**
 * ClearPanel — 结算·过关面板（S7）的**逻辑**：可见性、入/出动画进度、星级入场进度与
 * 按钮几何 / 命中。
 *
 * 与其他系统同纪律：本模块**绝不触碰玩法状态**（不写网格 / 托盘 / 倒计时）。`BeadsGame`
 * 持有权威相位与结算数据，并执行本模块从点击里解析出的动作。
 *
 * 冻结来源
 *  - 布局：`ux/ux-spec.md` §3.4（`panel_dialog` 560×480；主钮「下一关」+ 副钮「▶去冲刺」
 *    并排，两者各 ≥ `TOUCH_MIN`）—— 常量镜像在 `config/tuning.ts`；
 *  - 动画：`ux/ux-spec.md` §5（**星入场逐颗 150ms** ⇒ `CLEAR_STAR_STEP_MS`；面板入 / 出 200 / 150ms）；
 *  - 内容：§3.4 三段——缎带标题 / 星级行 / 次要信息「剩余 mm:ss ｜ 道具 n/3」。
 *
 * 布局与命中共用 `clearPanelLayout()`（按 `lastLevel` 缓存两份），图与热区不可能各说一套。
 *
 * ⚠️ 与旧实现的差别（WXG-T-063）：`LEVEL_CLEAR` 此前是「1.4s 后自动进下一关」的占位，
 * 而 `ux-spec §4` 的流转表写的是「LEVEL_CLEAR → 下一关 / 去冲刺*(U1) → 玩法·n+1 / 玩法·冲刺」
 * ⇒ **面板必须等按钮**，自动推进已删除（`LEVEL_CLEAR_DELAY_S` 随之退休）。
 */

import {
  // WXG-T-177：`CLEAR_BUTTON_GAP` 曾用于第二按钮（去冲刺）落位，入口隐藏后不再需要；
  // 复建 U1 三处入口时从 `tuning` 重新引入即可。
  CLEAR_BUTTON_W,
  CLEAR_STAR_GAP,
  CLEAR_STAR_SIZE,
  CLEAR_STAR_STEP_MS,
  DESIGN_H,
  DESIGN_W,
  PANEL_BUTTON_H,
  PANEL_IN_MS,
  PANEL_OUT_MS,
  PANEL_PADDING,
  PANEL_ROW_GAP,
  PANEL_SIZE,
} from '../config/tuning';
import { rectContains, type PanelRect } from './pause-panel';

/** 面板按钮能请求的两件事（动作由 `BeadsGame` 执行）。 */
export type ClearPanelAction = 'next' | 'sprint';

export interface ClearButton {
  readonly id: ClearPanelAction;
  readonly rect: PanelRect;
}

export interface ClearPanelLayout {
  /** 对话框底板。 */
  readonly panel: PanelRect;
  /** 两个按钮，视觉优先级序（主钮在前）。 */
  readonly buttons: readonly ClearButton[];
  /** 缎带标题基线 y。 */
  readonly titleY: number;
  /** 星级行中心 y。 */
  readonly starsY: number;
  /** 次要信息基线 y（「剩余 mm:ss ｜ 道具 n/3」）。 */
  readonly infoY: number;
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

/** 缎带标题（ux-spec §3.4）。 */
export const CLEAR_PANEL_TITLE = '🎉 闯关成功';

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
    (DESIGN_W - PANEL_SIZE.w) / 2,
    (DESIGN_H - PANEL_SIZE.h) / 2,
    PANEL_SIZE.w,
    PANEL_SIZE.h,
  );
  const rowY = panel.yMin + PANEL_PADDING;
  // WXG-T-177（用户 2026-09-19「去冲刺按钮先隐藏」）：冲刺入口隐藏 ⇒ 仅「下一关」
  // 单按钮并**居中**（旧口径「下一关 / ▶去冲刺」2 格均分见 `ux-spec §3.4` 图，
  // 已按 K-053 删划线留档；`ClearPanelAction` 保留 `'sprint'` 成员与文案分支，
  // 便于将来按 U1 原口径复建，但本函数不再产出该按钮 ⇒ 该动作永不可达）。
  const startX = (DESIGN_W - CLEAR_BUTTON_W) / 2;
  const buttons: ClearButton[] = [
    { id: 'next', rect: rect(startX, rowY, CLEAR_BUTTON_W, PANEL_BUTTON_H) },
  ];
  const infoY = rowY + PANEL_BUTTON_H + PANEL_ROW_GAP;
  const starsY = infoY + 70;
  const starsTotal = CLEAR_STAR_SIZE * 3 + CLEAR_STAR_GAP * 2;
  const firstStar = (DESIGN_W - starsTotal) / 2 + CLEAR_STAR_SIZE / 2;
  const starX = [0, 1, 2].map((i) => firstStar + i * (CLEAR_STAR_SIZE + CLEAR_STAR_GAP));
  void lastLevel; // 两个变体只差按钮文案（见 clearPanelLabel），几何相同
  return { panel, buttons, titleY: starsY + 110, starsY, infoY, starX };
}

/** 按钮文案（`ux-spec §3.4`；末关主钮文案为派生项）。 */
export function clearPanelLabel(id: ClearPanelAction, lastLevel: boolean): string {
  if (id === 'sprint') return '▶ 去冲刺';
  return lastLevel ? '查看结果' : '下一关';
}

/** 命中测试（面板外 / 非交互期为 null）。 */
export function hitClearPanel(x: number, y: number, opts: ClearPanelOptions): ClearPanelAction | null {
  for (const button of clearPanelLayout(opts).buttons) {
    if (rectContains(button.rect, x, y)) return button.id;
  }
  return null;
}

/**
 * 面板状态机：入 200ms / 出 150ms（与 S9 面板同口径），另持**星级入场**计时。
 *
 * `progress` 契约与 `PausePanel` 一致：进入 0→1，退出 1→0，未显示 = 0；
 * `interactive` 只在「已显示且未在退出」时为真（退出淡出期不接受点击）。
 */
export class ClearPanel {
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

  /** 面板自打开起的毫秒数（星级入场计时用）。 */
  get elapsedMs(): number {
    return this._elapsed;
  }

  /**
   * 已入场的星数（`0..count`）：第 `i` 颗在 `i × CLEAR_STAR_STEP_MS` 时入场
   * （ux-spec §5「逐颗 150ms」）。关闭中返回 0。
   */
  starsShown(count: number): number {
    if (!this._shown || this._closing) return 0;
    let shown = 0;
    for (let i = 0; i < count; i++) {
      if (this._elapsed >= i * CLEAR_STAR_STEP_MS) shown = i + 1;
    }
    return shown;
  }

  /**
   * 第 `index` 颗星的缩放（入场 150ms 内 0 → 1.2 → 1 弹跳；之后恒 1）。
   * 纯呈现量，不含任何玩法语义。
   */
  starScale(index: number): number {
    if (!this._shown) return 0;
    const local = (this._elapsed - index * CLEAR_STAR_STEP_MS) / CLEAR_STAR_STEP_MS;
    if (local <= 0) return 0;
    if (local >= 1) return 1;
    return local < 0.5 ? (local / 0.5) * 1.2 : 1.2 - 0.2 * ((local - 0.5) / 0.5);
  }

  hitTest(x: number, y: number, opts: ClearPanelOptions): ClearPanelAction | null {
    if (!this.interactive) return null;
    return hitClearPanel(x, y, opts);
  }
}
