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
 *  - layout: `ux/ux-spec.md` §3.3 v1.46 (**560-wide, h = `PAUSE_PANEL_H` = 364**——
 *    WXG-T-934 由五行 718 收到三钮两行；240×88 primary / 240×88 secondary ×2,
 *    row gap 20, rgba(42,46,67,.5) scrim) — mirrored verbatim in `config/tuning.ts`;
 *  - animation: `ux/ux-spec.md` §5 (入 200ms / 出 150ms, scale 0.9→1.0);
 *  - content list: `pause-settings.md` **v1.8 §2.2 三钮**（继续 / 重玩本关 / 回主菜单；
 *    全局设置全部迁菜单 `settings` 弹窗，暂停面板零设置项）.
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
  /**
   * v1.8（WXG-T-934）起暂停面板**不再有设置钮**；以下设置动作保留在联合类型里，
   * 因为 `beads-shell` 的菜单 `settings` overlay 复用 `applySettingsAction(action)` 串值
   * （`PausePanelAction` 与 `SettingsAction` 同串、非第二套语义）。
   */
  | 'toggle-bgm'
  | 'toggle-sfx'
  | 'toggle-reduce-motion'
  | 'toggle-large-text'
  | 'toggle-vibrate'
  | 'toggle-debug-info'
  | 'toggle-ghost-symbol'
  | 'toggle-debug-guides'
  | 'cycle-bead-style'
  | 'cycle-bead-size'
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
  // 高度用暂停面板专有的 PAUSE_PANEL_H（v1.8 三钮 = 364），宽度沿用共享 PANEL_SIZE.w（560）。
  // ⚠️ ⛔ 不得回写成 `PANEL_SIZE.h`：那是结算/失败面板共用的 480（任务单「不污染共用 PANEL_SIZE」）。
  // `[WXG-T-323]` 底缘 = 基准居中 + 逐机位移 ⇒ 面板中心对齐**手机中心**（1334 档位移 0 ⇒ 逐字不变）。
  const bottom = (DESIGN_H - PAUSE_PANEL_H) / 2 + dialogShiftY();
  return rect(left, bottom, PANEL_SIZE.w, PAUSE_PANEL_H);
}

/**
 * Row 1 primary + row 2 (重玩本关 / 回主菜单). v1.8（WXG-T-934）起暂停面板只此三钮，
 * 全局设置全部迁菜单 `settings` 弹窗。
 */
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

  // Row 2 — 重玩本关 / 回主菜单：两枚 240×88、间距 20、整行居中（ux §3.3 v1.46）。
  const row2Top = primaryBottom - PANEL_ROW_GAP;
  const row2Bottom = row2Top - PANEL_BUTTON_H;
  const rowGap = 20;
  const rowW = PANEL_PRIMARY_W * 2 + rowGap;
  const rowLeft = (DESIGN_W - rowW) / 2;
  buttons.push({
    id: 'restart',
    rect: rect(rowLeft, row2Bottom, PANEL_PRIMARY_W, PANEL_BUTTON_H),
  });
  buttons.push({
    id: 'go-menu',
    rect: rect(rowLeft + PANEL_PRIMARY_W + rowGap, row2Bottom, PANEL_PRIMARY_W, PANEL_BUTTON_H),
  });

  _normal = { panel: plate, buttons, titleY: plate.yMax - 60 };
  return _normal;
}

/** 冲刺面板：与普通面板同构三钮；`start-sprint` 入口仍隐藏（WXG-T-177）。 */
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
