/**
 * ClearPanel — 结算·过关面板（S7）的**逻辑**：布局与命中、星级入场节奏。
 *
 * 与其他系统同纪律：本模块**绝不触碰玩法状态**（不写网格 / 托盘 / 倒计时）。`BeadsGame`
 * 持有权威相位与结算数据，并执行本模块从点击里解析出的动作。
 *
 * 开合时钟与入场公式由四个结算弹窗共享（UI-33 ⇒ `result-panel.ts`）；布局与命中纯函数
 * 按 `ui-architecture-beads §8` 就地保留。
 *
 * 现役版面（`ux-spec §3.4` v1.58 · `[WXG-T-949]`，Figma `过关结算 269:44`）：
 *  - 布局：整张木牌 **545×585**（含四角铆钉 / 标题凹槽 / 自带阴影，牌顶距屏顶 356）；
 *    四类内容 = 星级 96×99 / 用时 / `+N 豆` / 未满 3★ 的差距提示（提示放双钮下方）；
 *    主钮 279×106（橙）+ 次钮 192×101（奶油），顶对齐、间隔 17。
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
  CLEAR_HINT_UP,
  CLEAR_PAIR_GAP,
  CLEAR_PANEL_SIZE,
  CLEAR_PANEL_TOP_DOWN,
  CLEAR_REWARD_DY,
  CLEAR_ROW_BOTTOM,
  CLEAR_ROW_LEFT,
  CLEAR_SECONDARY_H,
  CLEAR_SECONDARY_W,
  CLEAR_STARS_DY,
  CLEAR_STAR_GAP,
  CLEAR_STAR_SIZE,
  CLEAR_STAR_STEP_MS,
  CLEAR_TIME_DY,
  CLEAR_TITLE_DY,
  DESIGN_H,
  DESIGN_W,
  dialogShiftY,
} from '../config/tuning.js';
import { rectContains, type PanelRect } from './pause-panel.js';
import { ResultPanelClock } from './result-panel.js';

/** 面板按钮能请求的三件事（动作由 `BeadsGame` 执行）。 */
export type ClearPanelAction = 'next' | 'menu' | 'replay';

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
  /** 内容区（545×465）：去掉标题凹槽后的牌内区域（星 / 用时 / 豆 / 提示 / 双钮）。 */
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
  /** 有可播的「上一局」录像（`ux/bot-replay §3.1`）；false ⇒ 回放钮不画、不可点。 */
  readonly showReplay?: boolean;
}

/** 标题（`[WXG-T-509]` 精简：去 emoji、去缎带）。 */
export const CLEAR_PANEL_TITLE = '过关';

/**
 * 回放入口小钮（**临时功能触发入口**，一期测试用）：独立 160×96，绝对坐标。
 * 对齐 Figma `过关结算 269:44` 的 `312:38`（x=463，牌坐标 top=385 ⇒ y-up 底 = 1334−385−96 = 853）。
 * 2026-11-20 用户令：暂时入口，**暂不考虑与木牌 / 双钮重叠**。
 */
const REPLAY_ENTRY_W = 160;
const REPLAY_ENTRY_H = 96;
const REPLAY_ENTRY_X = 463;
const REPLAY_ENTRY_BOTTOM = 853;

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
    // `[WXG-T-949]` Figma `过关结算 269:44`：牌顶距屏顶 356 ⇒ y-up 底 = 1334 − 356 − 585。
    DESIGN_H - CLEAR_PANEL_TOP_DOWN - CLEAR_PANEL_SIZE.h + dialogShiftY(),
    CLEAR_PANEL_SIZE.w,
    CLEAR_PANEL_SIZE.h,
  );
  // `[WXG-T-949]` 双钮顶对齐（Figma 751 down）：主 279×106 + 次 192×101，间隔 17。
  const rowTop = panel.yMin + CLEAR_ROW_BOTTOM + CLEAR_ACTION_H;
  const buttons: ClearButton[] = [
    {
      id: 'next',
      rect: rect(CLEAR_ROW_LEFT, rowTop - CLEAR_ACTION_H, CLEAR_ACTION_W, CLEAR_ACTION_H),
    },
    {
      id: 'menu',
      rect: rect(
        CLEAR_ROW_LEFT + CLEAR_ACTION_W + CLEAR_PAIR_GAP,
        rowTop - CLEAR_SECONDARY_H,
        CLEAR_SECONDARY_W,
        CLEAR_SECONDARY_H,
      ),
    },
    // `EP15-S4`：独立回放钮（临时触发入口；无录像时由调用方过滤掉）。
    {
      id: 'replay',
      rect: rect(REPLAY_ENTRY_X, REPLAY_ENTRY_BOTTOM, REPLAY_ENTRY_W, REPLAY_ENTRY_H),
    },
  ];
  // `[WXG-T-949]` 牌内三段：标题 / 星 / 用时 / 豆（Figma 距牌顶 92 / 193.5 / 278.5 / 345）。
  const titleY = panel.yMax - CLEAR_TITLE_DY;  const starsY = panel.yMax - CLEAR_STARS_DY;
  const timeY = panel.yMax - CLEAR_TIME_DY;
  const rewardY = panel.yMax - CLEAR_REWARD_DY;
  // 差距提示是 Figma 未给的 <3★ 态：放双钮下方，⛔ 不改设计稿的三段节奏。
  const hintY = panel.yMin + CLEAR_HINT_UP;
  // 内容区 = 去掉标题凹槽（约 120）后的牌内区域（星 / 用时 / 豆 / 提示 / 双钮）。
  const content = rect(panel.xMin, panel.yMin, panel.xMax - panel.xMin, panel.yMax - panel.yMin - 120);
  const starsTotal = CLEAR_STAR_SIZE * 3 + CLEAR_STAR_GAP * 2;
  const firstStar = (DESIGN_W - starsTotal) / 2 + CLEAR_STAR_SIZE / 2;
  const starX = [0, 1, 2].map((i) => firstStar + i * (CLEAR_STAR_SIZE + CLEAR_STAR_GAP));
  return { panel, buttons, titleY, starsY, timeY, rewardY, hintY, content, starX };
}

/** 按钮文案（`ux-spec §3.4`；末关主钮文案为派生项）。 */
export function clearPanelLabel(id: ClearPanelAction, lastLevel: boolean): string {
  if (id === 'menu') return '回主界面';
  if (id === 'replay') return '回放';
  return lastLevel ? '查看结果' : '下一关';
}

/** 命中测试（面板外 / 非交互期为 null）。 */
export function hitClearPanel(x: number, y: number, opts: ClearPanelOptions): ClearPanelAction | null {
  const layout = clearPanelLayout(opts);
  for (const button of layout.buttons) {
    if (button.id === 'replay' && !opts.showReplay) continue;
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
