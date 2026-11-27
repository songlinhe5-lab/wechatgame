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
 *  - 初始 = 「宽度钉到托盘」：横向铺到**托盘整体宽度**（`TRAY_PANEL_WIDTH`，面板外框 666，
 *    左右缘与托盘对齐）、带内居中。**[WXG-T-262 三续裁 v1.65]** 高度腿退役（用户裁「还是不够宽，
 *    宽度对齐托盘整体宽度」）⇒ 长盘初屏**上下不完整**，带外行可见性/拖动见下方「平移夹取」
 *    与 `view-model` 离屏剔除（[五续裁 v1.67]：显示不限带内，手势区仍限带内）
 *    `[待真机]`。**[WXG-T-262] 小盘同样放大**（上钳 `CAMERA_ZOOM_MAX`）⇒ fit 允许 >1，
 *    钳在绝对档 [CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX] 内。
 *  - 缩放有界（绝对倍率）：`zoom ∈ [CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]` = [0.2, 2.0]；
 *    `fit` 仅作初始视图，不再是下钳（旧 `fit × CAMERA_ZOOM_MAX_SPAN` 口径已退役）。
 *  - 平移有界：[WXG-T-262 六续裁 v1.68] 双条件同时满足才夹（拖动边触操作界 **且** 背向边
 *    过操作心）；[七续裁 v1.69] Y 操作边界 = 「菜单下 ~ 托盘上」（非盘带沿），上下限不对称；
 *    X 仍整幅对称。至少半盘恒在操作区内 ⇒ 不丢盘）
 */
import {
  DESIGN_W,
  PUZZLE_BAND,
  BEAD_PITCH,
  BEAD_GAP,
  TRAY_PANEL_WIDTH,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  IDENTITY_CAMERA,
  gridLayoutFor,
  hitGridCell,
  type BoardCamera,
} from '../config/tuning';

/** 横向操作边界（设计 px）：整幅；纵向见 OP_Y_*（v1.69 不再用盘带高）。 */
const WINDOW_W = DESIGN_W;

/**
 * 纵向**操作边界**（[WXG-T-262 七续裁 v1.69]，用户裁「上边界应该是在 top 的 menu 下面
 * 一点，下边界应该是在托盘上面一点」）：由 `PUZZLE_BAND`（560 高）换成
 * 「HUD 下缘留 `BOARD_FIT_MARGIN` 净空 ~ 托盘带上缘留同净空」（1190 → 474，共 716 高）；
 * 「一点」= 既有留边常量 24，零新冻结。盘仍锚 `PUZZLE_BAND` 心布局（offset=0 不变），
 * 故夹取区间关于新操作中心（832）不对称（带心 840 ≠ 操作心，差 8px 如实入式）。
 */
// `[WXG-T-1090]` 旧的「操作心相对带心 −8」随 4 格可见口径作废（v1.66/67/69 窗口已被取代）。

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
 * Zoom that fits a `cols × rows` board. **[WXG-T-262 裁定]** 小盘也放大（初始视图 = 「适配」档），
 * 上钳 `CAMERA_ZOOM_MAX` ⇒ 不变式 `MIN ≤ fit ≤ MAX`（下界天然成立：最宽 32 列 fit = 666/1022 ≈ 0.65
 * > MIN 0.2，不设死码下钳）。
 * **[WXG-T-262 三续裁 v1.65（用户裁「（适配）放大效果还是不够宽，宽度需要对齐托盘整体宽度」）]**：
 * 横向目标宽 = `TRAY_PANEL_WIDTH`（666 面板外宽，非槽行宽 642、非 `DESIGN_W − 2×24` = 702），
 * 盘面居中 ⇒ 左右缘与托盘面板外框对齐；**高度腿退役**（旧 `fitH` 的 `min` 项删除）⇒ 高盘初屏
 * 上下溢出盘带。[五续裁 v1.67 订正] 溢出行**照画**（带内剔除退役，`view-model` 离屏剔除
 * 兜性能）；拖动可见性见 `clampCamera`；带外屏位仍属 HUD/托盘路由区，手势不可点中盘面。
 * 代价（如实）：顶格档「行数域」消失（fit 不再看 rows），长盘「开局完整可见」不变式退役 `[待真机]`。
 * **[WXG-T-1056 · 用户 2026-11-25 真机裁「初始盘面偏小，缩放比例不对」]**：可选第三参 `contentCols`
 * = **内容列跨度**（非空/非 void 格的列轴包围盒，口径同选关格缩略 T-1055 / 详情 T-1052 的墨界）：
 * 给定后横向目标改钉**墨界宽** ⇒ 带空边大盘（如 L9 曼陀罗名义 30 列、墨 24 列）初始不再被
 * 名义阵摊薄（fit 666/958≈0.70 → 666/766≈0.87）。缺省 / ≤0 ⇒ 名义列（逐字节旧口径）；
 * 墨界 = 名义列的盘（现池其余关）换算不变。平移夹取 / 命中仍按名义阵（⛔ 玩法域不改）。
 */
export function computeFitZoom(cols: number, _rows: number, contentCols?: number): number {
  // v1.65：行高不再参与 fit（形参保留，调用面不扩）
  const span = contentCols !== undefined && contentCols > 0 && contentCols < cols ? contentCols : cols;
  const natW = span * BEAD_PITCH - BEAD_GAP;
  return Math.min(CAMERA_ZOOM_MAX, TRAY_PANEL_WIDTH / natW);
}

/** Reset a camera to identity in place (tests / neutral baseline). */
export function resetCamera(cam: BoardCamera): void {
  cam.zoom = IDENTITY_CAMERA.zoom;
  cam.offsetX = IDENTITY_CAMERA.offsetX;
  cam.offsetY = IDENTITY_CAMERA.offsetY;
}

/** Set a camera to the fitting, centred initial view for a board (开局 / 换关 / 重试 / 冲刺换 stage)。 */
export function fitCamera(cam: BoardCamera, cols: number, rows: number, contentCols?: number): void {
  cam.zoom = computeFitZoom(cols, rows, contentCols);
  cam.offsetX = 0;
  cam.offsetY = 0;
}

/**
 * Fold a two-finger pinch into `cam`. Returns `true` while two fingers are down
 * (caller should recompute the layout); `false` when a single finger is down.
 * Zoom is bounded to the absolute range `[CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]`
 * (§3.3 v1.59; board-independent — `fit` no longer clamps).
 * `[WXG-T-1100]` 缩放后必须复用 `clampCamera` 的 4 格可见边界：否则 offset
 * 留在旧档，缩到低倍时盘面被推出视口（拖动/残差/按钮三路都已夹，唯独本路曾漏）。
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
    cam.zoom = clamp((g.zoom0 * dist) / g.pinchDist0, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
    clampCamera(cam, cols, rows);
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
 * Clamp zoom (to the absolute `[CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]`, §3.3 v1.59) and pan.
 * **[WXG-T-262 六续裁 v1.68（用户裁「必须同时满足滑动方向边界到达最大操作边界并且
 * 滑动反方向边界超过中心点才会被限制这个方向滑动，否则可以滑动这个方向」）]**
 * 单轴夹取 = 两条件 AND：① 拖动方向盘缘 ≥ 操作边界（视口边）；② 背向盘缘 ≥ 视口
 * 中线 ⇒ 上限 `maxOff = max(盘, 视口 − 盘)/2`：盘越视口时退化为 v1.66/67 的 `盘/2`
 * （盘缘至中线，数值不变）；窄盘（盘 < 视口一半）改为可拖至**拖动方向盘缘顶格操作边界**
 * （旧 `盘/2` 对窄盘偏严）。链：v1.66 越界轴 `盘/2` → v1.67 两轴统一 → 本批双条件式。
 * 护栏不变：不丢盘（大盘至少半盘在操作区内，窄盘全盘在内）。
 * **[七续裁 v1.69]** 纵向窗口换尺：操作边界 = 「菜单下 ~ 托盘上」（`OP_Y_LO/HI`，716 高），
 * 不再用 `PUZZLE_BAND` 的 560；新操作心相对带心偏 −8 ⇒ Y 轴上下限**不对称**（如实）。
 */
/**
 * `[WXG-T-1090]` 拖动/缩放边界至少要露出的盘面格数（用户令：上下左右都至少 4 格珠子可见）。
 */
export const MIN_VISIBLE_CELLS = 4;

export function clampCamera(cam: BoardCamera, cols: number, rows: number): void {
  cam.zoom = clamp(cam.zoom, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
  const b = boardPx(cols, rows, cam.zoom);
  // `[WXG-T-1090 · 用户 2026-11-26 令]` **边界 = 盘面任一侧至少保留 `MIN_VISIBLE_CELLS` 格可见**：
  // 「珠面上下左右拖动时候，边缘限制必须至少展现出 4 格珠子；缩放过程中也要严格限制」。
  // 推翻 v1.66/67/69 那套「拖动边触操作界 且 背向边过中线」的双条件窗口：口径改为**可见格数**，
  // 与缩放无关地一致（缩放路径同样走本函数 ⇒ 过程中也严格受限）。
  const minVis = MIN_VISIBLE_CELLS * BEAD_PITCH * cam.zoom;
  // X：盘面左/右可见宽度各 ≥ minVis（视口 = 全宽 `WINDOW_W`，对称）。
  const minOffX = minVis - WINDOW_W / 2 - b.w / 2;
  const maxOffX = WINDOW_W / 2 - minVis + b.w / 2;
  // Y：可见带 = `PUZZLE_BAND`（托盘与 HUD 之上），以带中心为基准。
  const bandMid = (PUZZLE_BAND.yMin + PUZZLE_BAND.yMax) / 2;
  let minOffY = PUZZLE_BAND.yMin + minVis - bandMid - b.h / 2;
  let maxOffY = PUZZLE_BAND.yMax - minVis - bandMid + b.h / 2;
  // 盘面本身比「带 + 2×minVis」还窄时两侧条件会打架 ⇒ 退化为**居中**（不留可拖余量）。
  if (minOffY > maxOffY) { const mid = (minOffY + maxOffY) / 2; minOffY = mid; maxOffY = mid; }
  cam.offsetX = clamp(cam.offsetX, minOffX, maxOffX);
  cam.offsetY = clamp(cam.offsetY, minOffY, maxOffY);
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
