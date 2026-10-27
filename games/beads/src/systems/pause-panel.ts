/**
 * PausePanel — the S9 pause panel's *logic*: visibility, enter/exit animation
 * progress, and button geometry/hit-testing.
 *
 * UI-31（WXG-T-306）：开合动画时钟退役，改由框架 `ModalLifecycle` 驱动
 * （时长仍由本模块按 `PANEL_IN_MS` / `PANEL_OUT_MS` 传入）；布局与命中纯函数
 * **就地保留**（`ui-architecture-beads §8`：避免一次性搬迁）。
 *
 * Pure mechanics in the same sense as the other systems: this module
 * **never touches gameplay state** (no grid/tray/timer writes). BeadsGame owns
 * the authoritative phase and settings and applies the action this module
 * resolves from a tap.
 *
 * Frozen sources
 *  - layout: `ux/ux-spec.md` §3.3 (560-wide panel, **h = `PAUSE_PANEL_H`**——WXG-T-164 批0
 *    由 480 扩至 600 容纳第 4 行，**EP11-S5 再扩至 718 容纳第 5 行**；240×88 primary,
 *    ≥88 rows, rgba(42,46,67,.5) scrim — 设置态遮罩 α 自 EP11-S5 分列为
 *    `SETTINGS_SCRIM_ALPHA`) — mirrored verbatim in `config/tuning.ts`;
 *  - animation: `ux/ux-spec.md` §5 (入 200ms / 出 150ms, scale 0.9→1.0);
 *  - content list: `pause-settings.md` **v1.7 §2.2 五行终态**（继续 / 重玩・音乐・音效 /
 *    减弱动效・大字号・震动 / 珠子风格⇄豆子尺寸 / 性能信息・回主菜单）
 *    plus the sprint secondary entry (U1，WXG-T-177 起隐藏) and 回主菜单次钮 (§8-11).
 *
 * Hit testing and rendering share `pausePanelLayout()`, so the picture and the
 * hot zones can never drift apart.
 */

import { ModalLifecycle } from '@wxgame/framework';
import {
  DESIGN_H,
  DESIGN_W,
  PANEL_BUTTON_H,
  PANEL_IN_MS,
  PANEL_OUT_MS,
  PANEL_PADDING,
  PANEL_PRIMARY_W,
  PANEL_ROW_GAP,
  PANEL_SIZE,
  PANEL_TITLE_BAND_H,
  PAUSE_PANEL_H,
  dialogShiftY,
} from '../config/tuning.js';
import type { GameMode } from '../game/state.js';

/** The things a panel button can ask the game to do. */
export type PausePanelAction =
  | 'resume'
  | 'restart'
  | 'toggle-bgm'
  | 'toggle-sfx'
  | 'toggle-reduce-motion'
  | 'toggle-large-text'
  | 'toggle-vibrate'
  | 'toggle-debug-info'
  /**
   * `[WXG-T-434]` E4 幽灵符号开关（`systems-index §3.8` v1.23 转正；MVP 验收线
   * 「幽灵符号设置开关」）。落**行5 三格**（原两格改三格，面板高度零改动）。
   */
  | 'toggle-ghost-symbol'
  /** 菜单设置的安全区标定线。暂停面板不放钮（末行已满），动作仍可被设置 overlay 串进来。 */
  | 'toggle-debug-guides'
  /** EP11-S5 行4：两枚**选择器钮**（非开关）——循环 registry 注册序 / `BEAD_SIZE_ORDER`。 */
  | 'cycle-bead-style'
  | 'cycle-bead-size'
  /** EP12-S8 行4 第三枚选择器钮：循环 `config/skins/registry` 注册序（判例同上两枚）。 */
  | 'cycle-skin'
  | 'start-sprint'
  | 'go-menu';

/** Axis-aligned rectangle in design space (y grows upward). */
export interface PanelRect {
  readonly xMin: number;
  readonly yMin: number;
  readonly xMax: number;
  readonly yMax: number;
}

export interface PanelButton {
  readonly id: PausePanelAction;
  readonly rect: PanelRect;
}

export interface PausePanelLayout {
  /** The dialog plate itself. */
  readonly panel: PanelRect;
  /** Every interactive control, in visual priority order. */
  readonly buttons: readonly PanelButton[];
  /** Title text baseline y. */
  readonly titleY: number;
}

function rect(x: number, y: number, w: number, h: number): PanelRect {
  return { xMin: x, yMin: y, xMax: x + w, yMax: y + h };
}

/**
 * Static panel geometry for one mode. **Cached per mode** — the layout never
 * changes at runtime, so it costs two objects for the whole process instead of
 * a per-frame allocation.
 *
 * Panel plate: centred in the design canvas (x∈[95,655], y∈[427,907]) — always
 * below `CAPSULE_AVOID` (y≥1214), so nothing can overlap the WeChat capsule.
 */
export function pausePanelLayout(mode: GameMode): PausePanelLayout {
  return mode === 'sprint' ? sprintLayout() : normalLayout();
}

let _normal: PausePanelLayout | null = null;
let _sprint: PausePanelLayout | null = null;

function panelPlate(): PanelRect {
  const left = (DESIGN_W - PANEL_SIZE.w) / 2;
  // 高度用暂停面板专有的 PAUSE_PANEL_H（EP11-S5 五行 = 718），宽度沿用共享 PANEL_SIZE.w（560）。
  // ⚠️ ⛔ 不得回写成 `PANEL_SIZE.h`：那是结算/失败面板共用的 480（任务单「不污染共用 PANEL_SIZE」）。
  // `[WXG-T-323]` 底缘 = 基准居中 + 逐机位移 ⇒ 面板中心对齐**手机中心**（1334 档位移 0 ⇒ 逐字不变）。
  const bottom = (DESIGN_H - PAUSE_PANEL_H) / 2 + dialogShiftY();
  return rect(left, bottom, PANEL_SIZE.w, PAUSE_PANEL_H);
}

/** Row 1 primary + row 2 (重玩 / 音乐 / 音效) + row 3 sprint secondary. */
function normalLayout(): PausePanelLayout {
  if (_normal) return _normal;
  const plate = panelPlate();
  const buttons: PanelButton[] = [];

  // Row 1 — primary "继续", centred, 240×88 (ux-spec §3.3).
  const primaryTop = plate.yMax - PANEL_TITLE_BAND_H;
  const primaryBottom = primaryTop - PANEL_BUTTON_H;
  buttons.push({
    id: 'resume',
    rect: rect((DESIGN_W - PANEL_PRIMARY_W) / 2, primaryBottom, PANEL_PRIMARY_W, PANEL_BUTTON_H),
  });

  // Row 2 — three equal controls inside the padded inner width.
  const row2Top = primaryBottom - PANEL_ROW_GAP;
  const row2Bottom = row2Top - PANEL_BUTTON_H;
  const innerWidth = PANEL_SIZE.w - PANEL_PADDING * 2;
  const gap = 20;
  const cellW = (innerWidth - gap * 2) / 3;
  const innerLeft = plate.xMin + PANEL_PADDING;
  const ids: PausePanelAction[] = ['restart', 'toggle-bgm', 'toggle-sfx'];
  for (let i = 0; i < ids.length; i++) {
    buttons.push({
      id: ids[i]!,
      rect: rect(innerLeft + i * (cellW + gap), row2Bottom, cellW, PANEL_BUTTON_H),
    });
  }

  // Row 3 — accessibility + haptics toggles (D1 减弱动效 / E2 大字号 / 震动，
  // WXG-T-088 / WXG-T-164 拍板⑦), sharing row 2's 3-cell grid; every cell
  // ≥ TOUCH_MIN (§8-5).
  const row3Top = row2Bottom - PANEL_ROW_GAP;
  const row3Bottom = row3Top - PANEL_BUTTON_H;
  const row3Ids: PausePanelAction[] = [
    'toggle-reduce-motion',
    'toggle-large-text',
    'toggle-vibrate',
  ];
  for (let i = 0; i < row3Ids.length; i++) {
    buttons.push({
      id: row3Ids[i]!,
      rect: rect(innerLeft + i * (cellW + gap), row3Bottom, cellW, PANEL_BUTTON_H),
    });
  }

  // Row 4 — **EP11-S5 / pause-settings v1.7 §2.2 行4：选择器钮族**
  // （「珠子风格」「豆子尺寸」+ **EP12-S8 第三格「皮肤」**）。与行五的开关族不同门：
  // 本行不是 `toggle-*`，语义 = 循环切档（S9 §8-15）；几何改用行 2/3 的 3-cell 算法
  // （cell 宽 160 ≥ TOUCH_MIN 88，行数不变 ⇒ PAUSE_PANEL_H 718 与 ux §3.3 面板几何零改动）。
  const row4Top = row3Bottom - PANEL_ROW_GAP;
  const row4Bottom = row4Top - PANEL_BUTTON_H;
  const row4Ids: PausePanelAction[] = ['cycle-bead-style', 'cycle-bead-size', 'cycle-skin'];
  for (let i = 0; i < row4Ids.length; i++) {
    buttons.push({
      id: row4Ids[i]!,
      rect: rect(innerLeft + i * (cellW + gap), row4Bottom, cellW, PANEL_BUTTON_H),
    });
  }

  // Row 5 — **行五（v1.7 终态）：性能信息 / 回主菜单**，即 v1.6 原行4 两钮**原样下移**
  // （S9 §2.2：语义与动作零变更，只换行位）。历史注记保留：WXG-T-177（用户 2026-09-19
  // 「去冲刺按钮先隐藏」）原 2-cell「start-sprint / go-menu」中的冲刺入口隐藏；
  // v1.6（debug 工具批）把空出的左格补成「性能信息」覆层开关。恢复冲刺入口时
  // 复建 `'start-sprint'` 即可（`PausePanelAction` 成员与其处理分支均保留）。
  const row5Top = row4Bottom - PANEL_ROW_GAP;
  const row5Bottom = row5Top - PANEL_BUTTON_H;
  // [WXG-T-434] 行5 由 2 格改 **3 格**（2-cell 改 3-cell，`PAUSE_PANEL_H 718` 零改动）：
  // 中格新增「幽灵符号」开关（E4，默认关）。cell 宽 160 ≥ TOUCH_MIN 88。
  const row5Ids: PausePanelAction[] = ['toggle-debug-info', 'toggle-ghost-symbol', 'go-menu'];
  for (let i = 0; i < row5Ids.length; i++) {
    buttons.push({
      id: row5Ids[i]!,
      rect: rect(innerLeft + i * (cellW + gap), row5Bottom, cellW, PANEL_BUTTON_H),
    });
  }

  _normal = { panel: plate, buttons, titleY: plate.yMax - 60 };
  return _normal;
}

/**
 * 冲刺面板：与普通面板**同构五行**（任务单「normal/sprint 两模式同构」）。
 * v1.6 起两模式行4/行5 都是两格 ⇒ 两布局按钮几何全同，冲刺只隐藏冲刺入口（若复活）。
 */
function sprintLayout(): PausePanelLayout {
  if (_sprint) return _sprint;
  const full = normalLayout();
  const buttons = full.buttons.filter((b) => b.id !== 'start-sprint');
  _sprint = { panel: full.panel, buttons, titleY: full.titleY };
  return _sprint;
}

/** `true` when `p` is inside `r` (inclusive edges). */
export function rectContains(r: PanelRect, x: number, y: number): boolean {
  return x >= r.xMin && x <= r.xMax && y >= r.yMin && y <= r.yMax;
}

/** True when the two rectangles share any area (used by the layout asserts). */
export function rectsOverlap(a: PanelRect, b: PanelRect): boolean {
  return a.xMin < b.xMax && b.xMin < a.xMax && a.yMin < b.yMax && b.yMin < a.yMax;
}

/**
 * Panel lifecycle + taps. Animation clock is the framework `ModalLifecycle`
 * (UI-31); this class only supplies the frozen durations and keeps the
 * historical getter surface (`visible` / `interactive` / `durationMs` / `progress`).
 */
export class PausePanel {
  private readonly _modal = new ModalLifecycle();

  /** Show the dialog (entering). Called when the machine enters PAUSED. */
  open(): void {
    this._modal.open(PANEL_IN_MS);
  }

  /** Begin the exit animation. Taps stop resolving immediately. */
  close(): void {
    this._modal.close(PANEL_OUT_MS);
  }

  /** Force-hide (e.g. dispose). */
  reset(): void {
    this._modal.reset();
  }

  update(dtMs: number): void {
    this._modal.update(dtMs);
  }

  /** True while anything is drawn (including the exit fade). */
  get visible(): boolean {
    return this._modal.phase !== 'closed';
  }

  /**
   * True while the panel accepts taps — **including the entrance ramp**
   * (旧实现 open() 即进入可点态；关合期仍零响应，§8-1)。
   */
  get interactive(): boolean {
    return this._modal.phase === 'open' || this._modal.phase === 'opening';
  }

  /** Animation length budget actually used (ms) — asserted by §8-10. */
  get durationMs(): number {
    return this._modal.phase === 'closing' ? PANEL_OUT_MS : PANEL_IN_MS;
  }

  /**
   * 0 → 1 on the way in, 1 → 0 on the way out; monotonic in both directions
   * (no flicker: a single ramp, never an oscillation — ux-spec §5 red line).
   */
  get progress(): number {
    return this._modal.progress;
  }

  /**
   * Resolve a tap. Anything that is not an *open* panel button is `null` —
   * including taps on the scrim, board, tray and powerup cards (§8-1: zero
   * response while PAUSED).
   */
  hitTest(x: number, y: number, mode: GameMode): PausePanelAction | null {
    if (!this.interactive) return null;
    for (const button of pausePanelLayout(mode).buttons) {
      if (rectContains(button.rect, x, y)) return button.id;
    }
    return null;
  }
}
