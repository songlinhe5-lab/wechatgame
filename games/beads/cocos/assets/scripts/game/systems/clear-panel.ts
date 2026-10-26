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
 * `[WXG-T-432]` 按钮行右侧追加「好友 / 这关榜」纸 chip：ADR-0035 §5.2 S-3 的结算面板上下文入口
 * （`settle` 榜），与主钮同排、右缘贴 `panel.xMax - PANEL_PADDING`；`PANEL_SIZE` 零改动。
 */

import {
  // `[WXG-T-432]` 复引入 `CLEAR_BUTTON_GAP`：好友榜 chip 与主钮同排的间距。
  CLEAR_BUTTON_GAP,
  CLEAR_BUTTON_W,
  CLEAR_STAR_GAP,
  CLEAR_STAR_SIZE,
  CLEAR_STAR_STEP_MS,
  DESIGN_H,
  DESIGN_W,
  PANEL_BUTTON_H,
  PANEL_PADDING,
  PANEL_ROW_GAP,
  PANEL_SIZE,
  dialogShiftY,
} from '../config/tuning';
import { rectContains, type PanelRect } from './pause-panel';
import { ResultPanelClock } from './result-panel';

/** 面板按钮能请求的三件事（动作由 `BeadsGame` 执行）。 */
export type ClearPanelAction = 'next' | 'sprint' | 'rank';

export interface ClearButton {
  readonly id: ClearPanelAction;
  readonly rect: PanelRect;
}

export interface ClearPanelLayout {
  /** 对话框底板。 */
  readonly panel: PanelRect;
  /** 两个按钮，视觉优先级序（主钮在前）。 */
  readonly buttons: readonly ClearButton[];
  /** 好友这关榜纸 chip（ADR-0035 S-3）：与主钮同排，右缘抵 `panel.xMax - PANEL_PADDING`。 */
  readonly rankChip: PanelRect;
  /** 缎带标题基线 y。 */
  readonly titleY: number;
  /**
   * 品质分行中心 y（ADR-0035 §3.2.1 ②）——缎带顶与面板顶缘之间的空带中点。
   * 面板共用 560×480 冻结几何，`PANEL_SIZE` 零改动（只吃既有 98px 净空）。
   */
  readonly qualityY: number;
  /** 星级行中心 y。 */
  readonly starsY: number;
  /**
   * 结算发豆行中心 y（§3.14 v1.81）——**星级正下方**（星底 = `starsY + CLEAR_STAR_SIZE/2 = +32`，
   * 缎带顶 ≈ `titleY − 40` ⇒ 净空 32~70，取中点 `starsY + 56`）。
   */
  readonly rewardY: number;
  /**
   * 判星对照行中心 y（ux-spec §3.4 v1.23）——夹在次要信息行与星级行之间。
   * 旧口径「星级行中心 = `infoY + 70`」下该带净空只有 ~32 设计像素，容不下
   * art-bible 最小字号 28 的一行 ⇒ WXG-T-355 把星级行抬到 `infoY + 92`，本行取中点。
   */
  readonly criteriaY: number;
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
/** 金色缎带高度（ux-spec §3.4；视图与布局共用，⛔ 两处各写 84）。 */
export const CLEAR_RIBBON_H = 84;
/** 好友这关榜纸 chip 宽（`[WXG-T-432]`；ADR-0035 §5.2 S-3 结算面板上下文入口）。 */
export const CLEAR_RANK_CHIP_W = 110;

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
    // `[WXG-T-323]` 与暂停面板同源位移 ⇒ 中心对齐手机中心（基准档 427 逐字不变）。
    (DESIGN_H - PANEL_SIZE.h) / 2 + dialogShiftY(),
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
  // `[WXG-T-432]` 好友这关榜 chip（ADR-0035 §5.2 S-3）：主钮右侧、同一行；
  // 右缘 = `startX + CLEAR_BUTTON_W + CLEAR_BUTTON_GAP + CLEAR_RANK_CHIP_W` = `panel.xMax - PANEL_PADDING`。
  const rankChip = rect(startX + CLEAR_BUTTON_W + CLEAR_BUTTON_GAP, rowY, CLEAR_RANK_CHIP_W, PANEL_BUTTON_H);
  const infoY = rowY + PANEL_BUTTON_H + PANEL_ROW_GAP;
  // WXG-T-355：判星对照行落 `infoY + 41`（上下各留 ~13 净空），星级行随之抬到 +92；
  // 缎带行距（`titleY = starsY + 110`）不动 ⇒ 面板顶缘余量由 120 收到 98，`PANEL_SIZE` 零改动。
  const criteriaY = infoY + 41;
  const starsY = infoY + 92;
  const starsTotal = CLEAR_STAR_SIZE * 3 + CLEAR_STAR_GAP * 2;
  const firstStar = (DESIGN_W - starsTotal) / 2 + CLEAR_STAR_SIZE / 2;
  const starX = [0, 1, 2].map((i) => firstStar + i * (CLEAR_STAR_SIZE + CLEAR_STAR_GAP));
  void lastLevel; // 两个变体只差按钮文案（见 clearPanelLabel），几何相同
  // §3.14 v1.81 结算发豆行：夹在**星底（starsY+32）**与**缎带顶（titleY−40）**之间取中点，
  // `PANEL_SIZE` 与缎带行距（+110）均零改动。
  const rewardY = starsY + 56;
  const titleY = starsY + 110;
  // 品质分行（ADR-0035 §3.2.1 ②）：缎带顶（y 向上 = `titleY + 缎带半高`）到面板顶缘的
  // 98px 净空带取中点 ⇒ 不挤压既有六行、`PANEL_SIZE` / 缎带行距均零改动。
  const qualityY = (titleY + CLEAR_RIBBON_H / 2 + panel.yMax) / 2;
  return { panel, buttons, rankChip, titleY, qualityY, starsY, rewardY, criteriaY, infoY, starX };
}

/** 按钮文案（`ux-spec §3.4`；末关主钮文案为派生项）。 */
export function clearPanelLabel(id: ClearPanelAction, lastLevel: boolean): string {
  if (id === 'rank') return '好友这关榜';
  if (id === 'sprint') return '▶ 去冲刺';
  return lastLevel ? '查看结果' : '下一关';
}

/** 命中测试（面板外 / 非交互期为 null）。 */
export function hitClearPanel(x: number, y: number, opts: ClearPanelOptions): ClearPanelAction | null {
  const layout = clearPanelLayout(opts);
  for (const button of layout.buttons) {
    if (rectContains(button.rect, x, y)) return button.id;
  }
  if (rectContains(layout.rankChip, x, y)) return 'rank';
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
