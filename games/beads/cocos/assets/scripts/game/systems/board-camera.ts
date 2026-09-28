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
 * View model (真机三反馈修正 WXG-T-169 · §3.3 v1.59 绝对倍率化 WXG-T-217):
 *  - 初始 = 「含边距适配」：棋盘缩到正好放进 PUZZLE_BAND 且居中、四周留白，不贴边。
 *  - 缩放有界（绝对倍率）：`zoom ∈ [CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]` = [0.2, 2.0]；
 *    `fit` 仅作初始视图，不再是下钳（旧 `fit × CAMERA_ZOOM_MAX_SPAN` 口径已退役）。
 *  - 平移有界：棋盘 ≤ 视口时锁死居中（拖不动，也拖不出屏）；> 视口时按内容边界夹取
 *    （可滚到棋盘四角，但棋盘边缘永不离开视口、也不露出空白）。
 */
import {
  DESIGN_W,
  PUZZLE_BAND,
  BEAD_PITCH,
  BEAD_GAP,
  BOARD_FIT_MARGIN,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  IDENTITY_CAMERA,
  gridLayoutFor,
  hitGridCell,
  type BoardCamera,
} from '../config/tuning';

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
 * This is the initial view (居中不贴边); since §3.3 v1.59 it is **no longer** the
 * zoom-out floor (`CAMERA_ZOOM_MIN` is) — it only stays guaranteed inside
 * `[CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]` via the §3 invariant `MIN ≤ fit ≤ 1 ≤ MAX`.
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
 * Zoom is bounded to the absolute range `[CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]`
 * (§3.3 v1.59; board-independent — `fit` no longer clamps).
 *
 * The ratio is `current / anchor two-finger distance`, so the gesture is
 * scale-relative and never jumps when the second finger lands.
 *
 * ponytail: zoom is anchored at the board centre (gridLayoutFor scales pitch
 * about the band centre). Pinch-to-focal-point (keep the pinched spot under the
 * fingers) is a feel refinement deferred to playtest; add a counter-offset term
 * here if it earns its keep.
 */
export function applyPinch(snap: PinchInput, cam: BoardCamera, g: Gesture): boolean {
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
    cam.zoom = clamp((g.zoom0 * dist) / g.pinchDist0, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
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
 * Clamp zoom (to the absolute `[CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]`, §3.3 v1.59) and pan
 * so the board can never be lost or leave the viewport. Offset limit = how far the
 * board overhangs the window:
 * board ≤ window ⇒ 0 (locked centred — a fitting board cannot be dragged off
 * screen); board > window ⇒ `(board − window)/2` (scroll to each corner, but a
 * board edge never comes inside a window edge, so no empty space beyond it).
 */
export function clampCamera(cam: BoardCamera, cols: number, rows: number): void {
  cam.zoom = clamp(cam.zoom, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
  const b = boardPx(cols, rows, cam.zoom);
  const maxOffX = Math.max(0, (b.w - WINDOW_W) / 2);
  const maxOffY = Math.max(0, (b.h - WINDOW_H) / 2);
  cam.offsetX = clamp(cam.offsetX, -maxOffX, maxOffX);
  cam.offsetY = clamp(cam.offsetY, -maxOffY, maxOffY);
}

/** slider 归一位置 t∈[0,1] → zoom：绝对档 `[CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]` 线性插值（§3.3 v1.59，与 fit 无关）。 */
export function zoomFromSliderT(t: number): number {
  return CAMERA_ZOOM_MIN + clamp(t, 0, 1) * (CAMERA_ZOOM_MAX - CAMERA_ZOOM_MIN);
}

/** zoom → slider 归一位置 t∈[0,1]（`zoomFromSliderT` 的逆；knob 定位用）。 */
export function sliderTFromZoom(zoom: number): number {
  const span = CAMERA_ZOOM_MAX - CAMERA_ZOOM_MIN;
  return span > 0 ? clamp((zoom - CAMERA_ZOOM_MIN) / span, 0, 1) : 0;
}

/**
 * 低倍点击档（§3.3 v1.59 `ZOOM_TAP_MIN`，行为正本 `input-control §2.1`）：
 * 以设计空间点 (x, y) 为焦点把 zoom 设为 `target`（该点屏幕位置尽量不变），平移保持夹取口径。
 * 实现＝直接拿 `gridLayoutFor`（渲染/命中唯一真源）算新档零偏移下的目标格屏幕位，再解
 * `offset = 焦点屏幕位 − 新档零偏移屏幕位`：不另发明屏幕式（历版手推均因与真源微差而错），
 * 也保证焦点格由 `hitGridCell` 在同一真源下选出。冷路径（一次点击一次），热路径禁 alloc 不适用。
 * 补偿越出新档平移悬挑时 clampCamera 锁边，被点格不严格跟手——既有口径优先（测试钉两分支）。
 */
export function zoomAtPoint(
  cam: BoardCamera,
  x: number,
  y: number,
  target: number,
  cols: number,
  rows: number,
): void {
  const z0 = cam.zoom;
  if (z0 <= 0) return;
  const z1 = clamp(target, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
  const cell = hitGridCell(gridLayoutFor(cols, rows, cam), z0, x, y);
  const j = cell ? cell.col : Math.floor(cols / 2);
  const i = cell ? cell.row : Math.floor(rows / 2);
  const fresh = gridLayoutFor(cols, rows, { zoom: z1, offsetX: 0, offsetY: 0 });
  cam.zoom = z1;
  cam.offsetX = x - fresh.colCenterX(j);
  cam.offsetY = y - fresh.rowCenterY(i);
  clampCamera(cam, cols, rows);
}

/** 直接设定 zoom（slider / 按钮路径），夹取到合法域并按新尺寸夹平移。 */
export function setCameraZoom(
  cam: BoardCamera,
  zoom: number,
  cols: number,
  rows: number,
): void {
  cam.zoom = zoom;
  clampCamera(cam, cols, rows);
}
