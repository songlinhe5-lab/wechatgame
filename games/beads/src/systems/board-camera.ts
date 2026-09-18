/**
 * Board camera + gesture resolution (WXG-T-169 / ADR-0015 甲′ 的「手势解算留游戏侧」).
 *
 * Pure functions over a `BoardCamera` (three scalars) and a reusable `Gesture`
 * memory object — no `cc` / `wx` / DOM (L2/L3), no allocation on the hot path
 * (callers hold one camera + one gesture instance and mutate them in place).
 *
 * Why here and not in the framework: ADR-0013 — "the framework knows structure,
 * not gameplay". The framework only exposes a second pointer slot
 * (`InputSnapshot.isDown2/x2/y2`); interpreting two fingers as a pinch, or a
 * one-finger move as a pan, is beads gameplay and lives in this layer. The camera
 * it produces is folded into `gridLayoutFor`, so render and hit-test stay in
 * lock-step (丁-3 「布局即相机」).
 *
 * View model (真机三反馈修正 WXG-T-169):
 *  - 初始 = 「含边距适配」：棋盘缩到正好放进 PUZZLE_BAND 且居中、四周留白，不贴边。
 *  - 缩放有界：下限 = fit（不能再缩），上限 = fit × CAMERA_ZOOM_MAX_SPAN。
 *  - 平移有界：棋盘 ≤ 视口时锁死居中（拖不动，也拖不出屏）；> 视口时按内容边界夹取
 *    （可滚到棋盘四角，但棋盘边缘永不离开视口、也不露出空白）。
 */
import {
  DESIGN_W,
  PUZZLE_BAND,
  BEAD_PITCH,
  BEAD_GAP,
  BOARD_FIT_MARGIN,
  CAMERA_ZOOM_MAX_SPAN,
  IDENTITY_CAMERA,
  type BoardCamera,
} from '../config/tuning.js';

/** 棋盘所在视口（设计 px）：横向整幅、纵向 PUZZLE_BAND。 */
const WINDOW_W = DESIGN_W;
const WINDOW_H = PUZZLE_BAND.yMax - PUZZLE_BAND.yMin;

/**
 * The slice of `InputSnapshot` this module reads. Duck-typed so the module does
 * not import framework internals; the real snapshot satisfies it structurally.
 */
export interface PinchInput {
  isDown: boolean;
  isDown2: boolean;
  /** owner (first finger) screen px */
  x: number;
  y: number;
  /** second finger screen px */
  x2: number;
  y2: number;
}

/** Per-gesture memory; the caller owns one instance and reuses it every frame. */
export interface Gesture {
  /** two-finger distance at the moment the second finger landed (0 = not pinching) */
  pinchDist0: number;
  /** camera zoom captured at that anchor */
  zoom0: number;
}

export function createGesture(): Gesture {
  return { pinchDist0: 0, zoom0: IDENTITY_CAMERA.zoom };
}

export function resetGesture(g: Gesture): void {
  g.pinchDist0 = 0;
  g.zoom0 = IDENTITY_CAMERA.zoom;
}

function clamp(v: number, lo: number, hi: number): number {
  const r = v < lo ? lo : v > hi ? hi : v;
  // 归一 -0：offset 下界为 -maxOffX，maxOffX=0 时会交出 -0 → 渗进快照/JSON 与断言。
  return r === 0 ? 0 : r;
}

/** Zoomed board pixel size in design space (uniform scale, gap scales too). */
function boardPx(cols: number, rows: number, zoom: number): { w: number; h: number } {
  return {
    w: (cols * BEAD_PITCH - BEAD_GAP) * zoom,
    h: (rows * BEAD_PITCH - BEAD_GAP) * zoom,
  };
}

/**
 * Zoom that fits a `cols × rows` board into the band with `BOARD_FIT_MARGIN`
 * breathing room on every side, capped at 1 (never enlarge past natural size).
 * This is the initial view (居中不贴边) AND the zoom-out floor.
 */
export function computeFitZoom(cols: number, rows: number): number {
  const natW = cols * BEAD_PITCH - BEAD_GAP;
  const natH = rows * BEAD_PITCH - BEAD_GAP;
  const fitW = (WINDOW_W - 2 * BOARD_FIT_MARGIN) / natW;
  const fitH = (WINDOW_H - 2 * BOARD_FIT_MARGIN) / natH;
  return Math.min(1, fitW, fitH);
}

/** Reset a camera to identity in place (tests / neutral baseline). */
export function resetCamera(cam: BoardCamera): void {
  cam.zoom = IDENTITY_CAMERA.zoom;
  cam.offsetX = IDENTITY_CAMERA.offsetX;
  cam.offsetY = IDENTITY_CAMERA.offsetY;
}

/** Set a camera to the fitting, centred initial view for a board (开局 / 换关 / 重试). */
export function fitCamera(cam: BoardCamera, cols: number, rows: number): void {
  cam.zoom = computeFitZoom(cols, rows);
  cam.offsetX = 0;
  cam.offsetY = 0;
}

/**
 * Fold a two-finger pinch into `cam`. Returns `true` while two fingers are down
 * (caller should recompute the layout); `false` when a single finger is down.
 * Zoom is bounded to `[fit, fit × CAMERA_ZOOM_MAX_SPAN]` for this board.
 *
 * The ratio is `current / anchor two-finger distance`, so the gesture is
 * scale-relative and never jumps when the second finger lands.
 *
 * ponytail: zoom is anchored at the board centre (gridLayoutFor scales pitch
 * about the band centre). Pinch-to-focal-point (keep the pinched spot under the
 * fingers) is a feel refinement deferred to playtest; add a counter-offset term
 * here if it earns its keep.
 */
export function applyPinch(
  snap: PinchInput,
  cam: BoardCamera,
  g: Gesture,
  cols: number,
  rows: number,
): boolean {
  if (!snap.isDown2) {
    // Second finger up (or never down): drop the pinch anchor. The remaining
    // owner finger must NOT be re-read as a pinch (owner non-migration,
    // ADR-0015 §3.2-3); single-finger drag is handled by the caller via applyPan.
    if (g.pinchDist0 !== 0) resetGesture(g);
    return false;
  }
  const dist = Math.hypot(snap.x - snap.x2, snap.y - snap.y2);
  if (g.pinchDist0 === 0) {
    g.pinchDist0 = dist; // just became two-finger — anchor baseline + zoom
    g.zoom0 = cam.zoom;
    return true;
  }
  if (dist > 0) {
    const fit = computeFitZoom(cols, rows);
    cam.zoom = clamp((g.zoom0 * dist) / g.pinchDist0, fit, fit * CAMERA_ZOOM_MAX_SPAN);
  }
  return true;
}

/**
 * Fold a single-finger pan into `cam` by a **design-space** delta (+x right,
 * +y up — the same axes `gridLayoutFor` offsets use). The caller converts the
 * owner's screen `dx/dy` to design units via the viewport scale (and flips y),
 * so the board tracks the finger 1:1. Offsets are clamped to the board extents.
 */
export function applyPan(
  ddxDesign: number,
  ddyDesign: number,
  cam: BoardCamera,
  cols: number,
  rows: number,
): void {
  cam.offsetX += ddxDesign;
  cam.offsetY += ddyDesign;
  clampCamera(cam, cols, rows);
}

/**
 * Clamp zoom (to `[fit, fit × SPAN]`) and pan so the board can never be lost or
 * leave the viewport. Offset limit = how far the board overhangs the window:
 * board ≤ window ⇒ 0 (locked centred — a fitting board cannot be dragged off
 * screen); board > window ⇒ `(board − window)/2` (scroll to each corner, but a
 * board edge never comes inside a window edge, so no empty space beyond it).
 */
export function clampCamera(cam: BoardCamera, cols: number, rows: number): void {
  const fit = computeFitZoom(cols, rows);
  cam.zoom = clamp(cam.zoom, fit, fit * CAMERA_ZOOM_MAX_SPAN);
  const b = boardPx(cols, rows, cam.zoom);
  const maxOffX = Math.max(0, (b.w - WINDOW_W) / 2);
  const maxOffY = Math.max(0, (b.h - WINDOW_H) / 2);
  cam.offsetX = clamp(cam.offsetX, -maxOffX, maxOffX);
  cam.offsetY = clamp(cam.offsetY, -maxOffY, maxOffY);
}
