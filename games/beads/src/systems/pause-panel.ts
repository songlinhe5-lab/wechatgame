/**
 * PausePanel — the S9 pause panel's *logic*: visibility, enter/exit animation
 * progress, and button geometry/hit-testing.
 *
 * Pure mechanics in the same sense as the other systems: this module
 * **never touches gameplay state** (no grid/tray/timer writes). BeadsGame owns
 * the authoritative phase and settings and applies the action this module
 * resolves from a tap.
 *
 * Frozen sources
 *  - layout: `ux/ux-spec.md` §3.3 (560×600 panel — WXG-T-164 批0 由 480 扩至 600
 *    容纳第 4 行；240×88 primary, ≥88 rows, rgba(42,46,67,0.5) scrim) — mirrored
 *    verbatim in `config/tuning.ts`;
 *  - animation: `ux/ux-spec.md` §5 (入 200ms / 出 150ms, scale 0.9→1.0);
 *  - content list: `pause-settings.md` v1.3 §2.2 (继续 / 重玩本关 / 音乐 / 音效 /
 *    震动) plus the sprint secondary entry (U1) and 回主菜单次钮 (§8-11).
 *
 * Hit testing and rendering share `pausePanelLayout()`, so the picture and the
 * hot zones can never drift apart.
 */

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
  // 高度用暂停面板专有的 PAUSE_PANEL_H（600），宽度沿用共享 PANEL_SIZE.w（560）。
  const bottom = (DESIGN_H - PAUSE_PANEL_H) / 2;
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

  // Row 4 — 两格（pause-settings v1.6 §2.2）。**WXG-T-177（用户 2026-09-19
  // 「去冲刺按钮先隐藏」）**：原 2-cell「start-sprint / go-menu」中的冲刺入口隐藏；
  // v1.6（debug 工具批）把空出的左格补成「性能信息」覆层开关（真机 QA 无 console，
  // 需可点击入口），「回主菜单」退回右格——居中口径随 v1.5 作废。恢复冲刺入口时
  // 复建 `'start-sprint'` 即可（`PausePanelAction` 成员与其处理分支均保留）。
  const row4Top = row3Bottom - PANEL_ROW_GAP;
  const row4Bottom = row4Top - PANEL_BUTTON_H;
  const cell2W = (innerWidth - gap) / 2;
  buttons.push({
    id: 'toggle-debug-info',
    rect: rect(innerLeft, row4Bottom, cell2W, PANEL_BUTTON_H),
  });
  buttons.push({
    id: 'go-menu',
    rect: rect(innerLeft + cell2W + gap, row4Bottom, cell2W, PANEL_BUTTON_H),
  });

  _normal = { panel: plate, buttons, titleY: plate.yMax - 60 };
  return _normal;
}

/** Sprint panel: identical minus the redundant sprint entry (already sprinting). */
function sprintLayout(): PausePanelLayout {
  if (_sprint) return _sprint;
  const full = normalLayout();
  // v1.6 起两模式行 4 都是两格 ⇒ 两布局按钮几何全同，冲刺只隐藏冲刺入口。
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

type PanelState = 'hidden' | 'open' | 'closing';

/**
 * Panel lifecycle + taps. Owns nothing but its own animation clock.
 */
export class PausePanel {
  private _state: PanelState = 'hidden';
  private _elapsedMs = 0;

  /** Show the dialog (entering). Called when the machine enters PAUSED. */
  open(): void {
    this._state = 'open';
    this._elapsedMs = 0;
  }

  /** Begin the exit animation. Taps stop resolving immediately. */
  close(): void {
    if (this._state === 'open') {
      this._state = 'closing';
      this._elapsedMs = 0;
    }
  }

  /** Force-hide (e.g. dispose). */
  reset(): void {
    this._state = 'hidden';
    this._elapsedMs = 0;
  }

  update(dtMs: number): void {
    if (this._state === 'hidden') return;
    this._elapsedMs += Math.max(0, dtMs);
    if (this._state === 'closing' && this._elapsedMs >= PANEL_OUT_MS) {
      this._state = 'hidden';
      this._elapsedMs = 0;
    }
  }

  /** True while anything is drawn (including the exit fade). */
  get visible(): boolean {
    return this._state !== 'hidden';
  }

  /** True only while the panel accepts taps. */
  get interactive(): boolean {
    return this._state === 'open';
  }

  /** Animation length budget actually used (ms) — asserted by §8-10. */
  get durationMs(): number {
    return this._state === 'closing' ? PANEL_OUT_MS : PANEL_IN_MS;
  }

  /**
   * 0 → 1 on the way in, 1 → 0 on the way out; monotonic in both directions
   * (no flicker: a single ramp, never an oscillation — ux-spec §5 red line).
   */
  get progress(): number {
    if (this._state === 'open') return Math.min(1, this._elapsedMs / PANEL_IN_MS);
    if (this._state === 'closing') return Math.max(0, 1 - this._elapsedMs / PANEL_OUT_MS);
    return 0;
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
