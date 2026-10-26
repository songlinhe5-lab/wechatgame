/**
 * RankPanel — 好友榜面板**占位**（ADR-0035 §5.2 S-3）。
 *
 * 职责：面板开合、状态文案、布局与命中；主域 ⇄ 子域的收发**只经**
 * `OpenDataProvider`（S-1 协议 / S-2 透传）。本模块不碰 `wx`、不碰子域工程
 * （S-4/S-5 才接真宿主）。
 *
 * 协议约束（ADR-0035 §3.1）：
 *  - 子域只回 `ready` / `rank:ready{count}` / `rank:error{code}`，**不回好友明细**
 *    ⇒ 面板不显示「第 N」、不画头像行。
 *  - `open` 只发 `init`；收到 `ready` 且版本兼容才发 `rank:query`（同一次 open 只发一次）。
 *
 * 布局与命中同源（`rankPanelLayout` 按 `hasSettings` 缓存两份）；开合走四弹窗共享的
 * `ResultPanelClock`（UI-33）。`PANEL_SIZE` 560×480 冻结，零改动。
 */

import {
  DESIGN_H,
  DESIGN_W,
  PANEL_BUTTON_H,
  PANEL_PADDING,
  PANEL_PRIMARY_W,
  PANEL_ROW_GAP,
  PANEL_SIZE,
  TOUCH_MIN,
  dialogShiftY,
} from '../config/tuning.js';
import { OPEN_DATA_VERSION, isCompatibleOpenDataVersion } from '@wxgame/framework';
import type {
  OpenDataProvider,
  OpenDataTheme,
  OpenDataToHost,
  RankBoard,
} from '@wxgame/framework';
import { rectContains, type PanelRect } from './pause-panel.js';
import { ResultPanelClock } from './result-panel.js';

/** 面板状态。`unsupported` = 宿主没有 `services.openData`（Node / web / 旧宿主）。 */
export type RankPanelState =
  | 'unsupported'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'no-auth'
  | 'fail'
  | 'incompatible';

/** 面板按钮动作（`back` 常驻；`settings` 仅宿主提供钩子时出现）。 */
export type RankPanelAction = 'back' | 'settings';

export interface RankButton {
  readonly id: RankPanelAction;
  readonly rect: PanelRect;
}

export interface RankPanelLayout {
  /** 对话框底板（与结算面板同源位移）。 */
  readonly panel: PanelRect;
  readonly buttons: readonly RankButton[];
  readonly titleY: number;
  readonly subtitleY: number;
  readonly statusY: number;
}

/** 视图只读契约；`settings` = 是否渲染「去设置开启」（S-3 恒 false）。 */
export interface RankPanelView {
  readonly visible: boolean;
  readonly progress: number;
  readonly interactive: boolean;
  readonly state: RankPanelState;
  readonly count: number;
  readonly board: RankBoard;
  readonly settings: boolean;
}

export interface RankPanelOptions {
  /** 随 `init` 下行的主题（子域不能 import `palette.ts`）。 */
  readonly theme: OpenDataTheme;
  /** 「去设置开启」钩子；未提供 ⇒ 不渲染该钮（避免死按钮，S-5 再接）。 */
  readonly openSettings?: () => void;
}

/** 榜页标题（ADR-0035 §3.4）。 */
export const RANK_PANEL_TITLE = '好友榜';
export const RANK_PANEL_SUBTITLE_TOTAL = '总榜';
export const RANK_PANEL_SUBTITLE_LEVEL = '本关';
export const RANK_BUTTON_BACK = '返回';
export const RANK_BUTTON_SETTINGS = '去设置开启';
/** 单次查询条数（`rank:query.limit`）；主域拿不到明细，只影响子域画布行数。 */
export const RANK_QUERY_LIMIT = 10;

/** 主题源（结构类型 ⇒ systems 层⛔ 依赖 `view/palette.ts`；调用方传 `BeadsPalette` 即可）。 */
export interface RankThemeSource {
  readonly panel: string;
  readonly slot: string;
  readonly woodFace: string;
  readonly text: string;
  readonly accentPrimary: string;
}

/**
 * 子域主题（随 `init` 下行；子域不能 import `palette.ts`）。
 * 构造期调用一次即可；返回对象不被本层缓存。
 */
export function rankTheme(palette: RankThemeSource): OpenDataTheme {
  return {
    bg: palette.panel,
    rowBg: palette.slot,
    rowBgSelf: palette.woodFace,
    text: palette.text,
    accent: palette.accentPrimary,
    avatarSize: 56,
    rowH: TOUCH_MIN,
    fontPx: 26,
  };
}

const STATUS_TEXT: Readonly<Record<Exclude<RankPanelState, 'ready'>, string>> = {
  unsupported: '当前环境不支持好友榜',
  loading: '正在加载…',
  empty: '还没有好友上榜，去邀请一位',
  'no-auth': '未授权，无法显示好友榜',
  fail: '好友榜暂时打不开，稍后再试',
  incompatible: '好友榜版本不匹配，请更新后再试',
};

/** 状态行文案（`ready` 带计数；其余为常量表）。 */
export function rankStatusText(state: RankPanelState, count: number): string {
  if (state === 'ready') return `共 ${count} 位好友上榜`;
  return STATUS_TEXT[state];
}

function rect(x: number, y: number, w: number, h: number): PanelRect {
  return { xMin: x, yMin: y, xMax: x + w, yMax: y + h };
}

let _plain: RankPanelLayout | null = null;
let _withSettings: RankPanelLayout | null = null;

/** 静态几何，按 `hasSettings` 缓存两份（运行时不变 ⇒ 不逐帧分配）。 */
export function rankPanelLayout(hasSettings: boolean): RankPanelLayout {
  if (hasSettings) {
    _withSettings ??= build(true);
    return _withSettings;
  }
  _plain ??= build(false);
  return _plain;
}

function build(hasSettings: boolean): RankPanelLayout {
  const panel = rect(
    (DESIGN_W - PANEL_SIZE.w) / 2,
    (DESIGN_H - PANEL_SIZE.h) / 2 + dialogShiftY(),
    PANEL_SIZE.w,
    PANEL_SIZE.h,
  );
  // 设计空间 y 向上：`yMin` = 面板下缘 ⇒ 按钮行贴底（与 clear / sprint-settle 同式）。
  const rowY = panel.yMin + PANEL_PADDING;
  const buttons: RankButton[] = [];
  if (hasSettings) {
    // 两钮均分：左「返回」/ 右「去设置开启」。
    const cellW = (PANEL_SIZE.w - PANEL_PADDING * 2 - PANEL_ROW_GAP) / 2;
    buttons.push({ id: 'back', rect: rect(panel.xMin + PANEL_PADDING, rowY, cellW, PANEL_BUTTON_H) });
    buttons.push({
      id: 'settings',
      rect: rect(panel.xMin + PANEL_PADDING + cellW + PANEL_ROW_GAP, rowY, cellW, PANEL_BUTTON_H),
    });
  } else {
    buttons.push({ id: 'back', rect: rect((DESIGN_W - PANEL_PRIMARY_W) / 2, rowY, PANEL_PRIMARY_W, PANEL_BUTTON_H) });
  }
  return {
    panel,
    buttons,
    titleY: panel.yMax - PANEL_PADDING - 40,
    subtitleY: panel.yMax - PANEL_PADDING - 92,
    statusY: panel.yMax - 236,
  };
}

/** 命中测试（退场期 / 未显示 ⇒ null）。 */
export function hitRankPanel(
  x: number,
  y: number,
  hasSettings: boolean,
): RankPanelAction | null {
  for (const button of rankPanelLayout(hasSettings).buttons) {
    if (rectContains(button.rect, x, y)) return button.id;
  }
  return null;
}

interface MutableRankPanelView {
  visible: boolean;
  progress: number;
  interactive: boolean;
  state: RankPanelState;
  count: number;
  board: RankBoard;
  settings: boolean;
}

/** 关档默认视图（快照缺省 / 金样本字面量用；冻结共享实例）。 */
export const CLOSED_RANK_VIEW: RankPanelView = Object.freeze({
  visible: false,
  progress: 0,
  interactive: false,
  state: 'unsupported',
  count: 0,
  board: 'settle-total',
  settings: false,
});

export class RankPanel {
  private readonly _clock = new ResultPanelClock();
  private readonly _theme: OpenDataTheme;
  private readonly _openSettings: (() => void) | undefined;
  private _provider: OpenDataProvider | null = null;
  private _unsub: (() => void) | null = null;
  private _board: RankBoard = 'settle-total';
  private _key = '';
  private _state: RankPanelState = 'unsupported';
  private _count = 0;
  private _queried = false;
  private readonly _view: MutableRankPanelView = {
    visible: false,
    progress: 0,
    interactive: false,
    state: 'unsupported',
    count: 0,
    board: 'settle-total',
    settings: false,
  };

  constructor(options: RankPanelOptions) {
    this._theme = options.theme;
    this._openSettings = options.openSettings;
  }

  /** 订阅宿主 Provider；`null` = 宿主无该能力（打开时落 `unsupported`）。幂等。 */
  attach(provider: OpenDataProvider | null): void {
    if (provider === this._provider) return;
    this.detach();
    if (!provider) return;
    this._provider = provider;
    this._unsub = provider.onMessage((event) => this._onMessage(event));
  }

  /** 退订 Provider（幂等；销毁后 `send` 不再发）。 */
  detach(): void {
    this._unsub?.();
    this._unsub = null;
    this._provider = null;
  }

  /**
   * 打开面板。先 `render:visible=true` + `init`；`ready` 后在
   * {@link _onMessage} 里补 `rank:query`。
   */
  open(board: RankBoard, key: string): void {
    this._board = board;
    this._key = key;
    this._count = 0;
    this._queried = false;
    this._clock.open();
    this._state = 'loading';
    const provider = this._provider;
    if (!provider) {
      this._state = 'unsupported';
      return;
    }
    provider.send({ type: 'render:visible', visible: true });
    provider.send({ type: 'init', version: OPEN_DATA_VERSION, theme: this._theme, board });
  }

  /** 关闭面板（退场期仍可见；`render:visible=false` 只发一次）。 */
  close(): void {
    if (!this.visible) return;
    this._clock.close();
    this._provider?.send({ type: 'render:visible', visible: false });
    this._queried = false;
  }

  update(dtMs: number): void {
    this._clock.update(dtMs);
  }

  hitTest(x: number, y: number): RankPanelAction | null {
    if (!this.interactive) return null;
    return hitRankPanel(x, y, this._openSettings !== undefined);
  }

  tap(action: RankPanelAction): void {
    if (action === 'back') {
      this.close();
    } else {
      this._openSettings?.();
    }
  }

  /** 复用视图对象（热路径零分配）。 */
  view(): RankPanelView {
    const v = this._view;
    v.visible = this.visible;
    v.progress = this.progress;
    v.interactive = this.interactive;
    v.state = this._state;
    v.count = this._count;
    v.board = this._board;
    v.settings = this._openSettings !== undefined;
    return v;
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

  get state(): RankPanelState {
    return this._state;
  }

  get count(): number {
    return this._count;
  }

  get board(): RankBoard {
    return this._board;
  }

  private _onMessage(event: OpenDataToHost): void {
    if (!this.visible) return;
    switch (event.type) {
      case 'ready': {
        if (!isCompatibleOpenDataVersion(event.version)) {
          this._state = 'incompatible';
          return;
        }
        if (this._queried) return;
        this._queried = true;
        this._provider?.send({
          type: 'rank:query',
          board: this._board,
          key: this._key,
          order: 'desc',
          limit: RANK_QUERY_LIMIT,
        });
        return;
      }
      case 'rank:ready': {
        if (event.board !== this._board) return;
        this._count = event.count;
        this._state = event.count > 0 ? 'ready' : 'empty';
        return;
      }
      case 'rank:error': {
        if (event.board !== this._board) return;
        // `api-missing` 对玩家等同「打不开」；`empty` 保留独立文案（ADR §3.4）。
        this._state = event.code === 'no-auth' ? 'no-auth' : event.code === 'empty' ? 'empty' : 'fail';
        return;
      }
      default:
        return;
    }
  }
}
