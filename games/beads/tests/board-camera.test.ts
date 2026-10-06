/**
 * WXG-T-169 / ADR-0015 甲′ 相机模型判据（`board-camera.ts`）——直接对应真机三反馈：
 *   ① 缩放绝对倍率有界 [CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]（§3.3 v1.59；旧 [fit, fit×SPAN] 退役）；
 *   ② 平移：[WXG-T-262 六续裁 v1.68] 双条件同时满足才夹（拖动边触操作界 **且** 背向边过
 *      操作心）；[七续裁 v1.69] Y 操作边界 = 「菜单下 ~ 托盘上」（非盘带沿，上下限不对称），
 *      X 仍整幅对称 = `max(盘, 视口−盘)/2`；
 *   ③ fitCamera 初始 zoom = 含边距适配、居中不贴边（issue 3）；
 *   ④ **WXG-T-172 · F3 甲裁**（以实现为准）后的复位**落点**：复位档 = `fit` 初始，实际复位点
 *      只有 `_setupLevel` / `_loadStage` 两处；回菜单 / 后台隐藏当帧**不**复位（ADR-0015 §3.4）。
 */
import { describe, expect, it } from 'vitest';
import {
  applyPinch,
  applyPan,
  clampCamera,
  createGesture,
  resetCamera,
  fitCamera,
  computeFitZoom,
  setCameraZoom,
  sliderTFromZoom,
  zoomAtPoint,
  zoomFromSliderT,
  type PinchInput,
} from '../src/systems/board-camera.js';
import {
  createBeadsHarness,
  simpleTestLevel,
  placeColor,
  firstEmptyCell,
  burnToRemaining,
  type Harness,
} from './helpers.js';
import type { BeadsGame } from '../src/game/beads-game.js';
import {
  IDENTITY_CAMERA,
  type BoardCamera,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  BEAD_PITCH,
  BEAD_GAP,
  TRAY_PANEL_WIDTH,
  PUZZLE_BAND,
  HUD_BAND,
  TRAY_BAND,
  BOARD_FIT_MARGIN,
  GRID_MIN_COLS,
  GRID_MIN_ROWS,
  LEVEL_TIME_MIN,
  gridLayoutFor,
} from '../src/config/tuning.js';
import { STAGE_PATTERN_POOL } from '../src/config/levels.js';

const cam = (): BoardCamera => ({ zoom: 1, offsetX: 0, offsetY: 0 });

/** Y 夹取镜像（[v1.69] 与 `clampCamera` 同构，换 band 尺不漂移）：返回 [下限, 上限]。 */
const OP_LO = TRAY_BAND.yMax + BOARD_FIT_MARGIN;
const OP_HI = HUD_BAND.yMin - BOARD_FIT_MARGIN;
const BAND_MID = (PUZZLE_BAND.yMin + PUZZLE_BAND.yMax) / 2;
const OP_MID_REL = (OP_LO + OP_HI) / 2 - BAND_MID;
const clampY = (bh: number): [number, number] => [
  Math.min(OP_LO - BAND_MID + bh / 2, OP_MID_REL - bh / 2),
  Math.max(OP_HI - BAND_MID - bh / 2, OP_MID_REL + bh / 2),
];

const two = (x: number, y: number, x2: number, y2: number): PinchInput => ({
  isDown: true,
  isDown2: true,
  x,
  y,
  x2,
  y2,
});

// 6×5 小盘：**[WXG-T-262 · 用户 2026-10-06 裁「不是 1:1，整盘放大到左右留空隙；初始 = 适配档」]**
// ⇒ fit = 放大档（本盘越上钳 → `CAMERA_ZOOM_MAX`；旧「fit=1 不放大」口径推翻）。“大盘”（fit<1）仍需越过**顶格档**。
// ⚠ **v1.57（§3.3 5mm→32/dip 基）换尺后的直接后果**：旧夹具 13×12 在新尺下
// `fit = 1`（顶格档由 13×11 抬到 22×18）⇒ 它不再是“缩放档”，借用它的用例全部当场红。
// 本文件因此把 `BC×BR` 抬到 **顶格档 + 1 行**（取最小越界量：既仍钉住“fit<1”
// 这一族行为，又不把夹具无关地拉大）。⛔ 不得为了绿而删断言（K-036）。
// ⚠ **盘带下沿 480→560（缩放控件条让高）后本值随之落为 22×17**——形式不变、只跟真源动。
const SC = 6;
const SR = 5;
const BC = 22;
const BR = 17;

/** 顶格档快照（正本 = `systems-index §3.3` “顶格档”行）：
 * 13×11（52 基）→ 22×18（§3.3 v1.57）→ 22×16（盘带下沿抬至 560）→ 20×16（v1.64）→
 * **列域 20，行数域退役**（§3.3 v1.65 · WXG-T-262 三续裁：fit 只看宽（基准 `TRAY_PANEL_WIDTH`
 * 666），`floor((666+2)/32)` = 20；行高不再参与 fit ⇒ 顶格档只剩列轴）。 */
const TOP_COLS = 20;
const TOP_ROWS = 16; // 仅作“行轴独立性”腿的基准盘高，不再是顶格档约束

describe('computeFitZoom / fitCamera（issue 3 初始适配）', () => {
  it('小盘 → fit = 放大档（WXG-T-262：整盘放大到留边，越上钳钉 `CAMERA_ZOOM_MAX`；⛔ 旧 fit=1 回潮即红）', () => {
    expect(computeFitZoom(SC, SR)).toBe(CAMERA_ZOOM_MAX);
  });
  it('中间档（不越上钳的放大盘）→ 1 < fit < MAX', () => {
    // 12×16（现池最大尺）：[v1.65] fit = 666/382 = 1.743（宽度钉到托盘面板外宽；高度腿已退役）
    const f = computeFitZoom(12, 16);
    expect(f).toBeGreaterThan(1);
    expect(f).toBeLessThan(CAMERA_ZOOM_MAX);
  });
  it('大盘 → fit<1，且适配后棋盘不越**托盘整体宽**（[v1.65] 横向目标 = TRAY_PANEL_WIDTH）', () => {
    const fit = computeFitZoom(BC, BR);
    expect(fit).toBeLessThan(1);
    expect(fit).toBeGreaterThan(0);
    const natW = BC * BEAD_PITCH - BEAD_GAP;
    expect(natW * fit).toBeLessThanOrEqual(TRAY_PANEL_WIDTH + 1e-6);
  });
  it('fitCamera 把相机设为 zoom=fit、offset=0（居中）', () => {
    const c: BoardCamera = { zoom: 9, offsetX: 50, offsetY: -50 };
    fitCamera(c, BC, BR);
    expect(c.zoom).toBeCloseTo(computeFitZoom(BC, BR), 9);
    expect(c.offsetX).toBe(0);
    expect(c.offsetY).toBe(0);
  });

  // 顶格档（fit ≥ 1 的最大盘）随基准动：13×11（52 基）→ 22×18（§3.3 v1.57）→ 22×16（v1.58 让高）
  //→ 20×16（v1.64）→ **列域 20，行数域退役**（§3.3 v1.65 · WXG-T-262 三续裁「宽度对齐托盘整体
  //  宽度」：fit = min(MAX, TRAY_PANEL_WIDTH/natW)，高度腿删除 ⇒ 顶格档只剩列轴）。
  // 两腿：① 公式腿（列域由 `TRAY_PANEL_WIDTH` 派生）② 快照腿（字面 20）——换尺必同时红。
  // 旧「纵向由 BOARD_FIT_MARGIN 派生」公式腿随高度腿退役 ⇒ 换成**行轴独立性腿**（防“行高
  // 静偷偷回 fit 式”回潮，断言加非删，K-036 合规）。
  it('顶格档 = 列域 20（fit≥1 只看宽，v1.65），越列必缩、行高不参与', () => {
    const cMax = Math.floor((TRAY_PANEL_WIDTH + BEAD_GAP) / BEAD_PITCH);
    expect(cMax).toBe(TOP_COLS); // 快照腿：换尺 ⇒ 本行必跟着 §3 动（668/32=20.875→20）
    // 派生守卫（**[WXG-T-262] `⇔ fit = 1` 改 `⇔ fit ≥ 1`**：顶格档内一律放大或恰压线，
    // 越档必缩。⛔ 666 非 `32n−2` 整珠宽 ⇒ 不存在恰 `fit=1` 盘宽，勿改回 toBe(1)。
    expect(computeFitZoom(TOP_COLS, TOP_ROWS)).toBeGreaterThanOrEqual(1);
    expect(computeFitZoom(TOP_COLS - 1, TOP_ROWS - 1)).toBeGreaterThan(1);
    expect(computeFitZoom(GRID_MIN_COLS, GRID_MIN_ROWS)).toBe(CAMERA_ZOOM_MAX); // 6×5 越上钳钉格
    // 越列一档必缩；行数不参与 fit（v1.65 高度腿退役，新长盘初屏上下溢出：带外行
    // 照画 + 平移拖动可见（上限口径见 clampCamera 族），v1.67/68）。
    expect(computeFitZoom(TOP_COLS + 1, TOP_ROWS)).toBeLessThan(1);
    expect(computeFitZoom(TOP_COLS, TOP_ROWS + 1)).toBe(computeFitZoom(TOP_COLS, TOP_ROWS));
    expect(computeFitZoom(TOP_COLS, 40)).toBe(computeFitZoom(TOP_COLS, TOP_ROWS));
    // ⛔ 本例**不**钉“出货关表逐关 fit=1”：那又是对关表内容的巧合耦合（本文件 :236-238
    // 已登记 v1.46 关表重置失配的教训）。“现 8 关均 ≤ 顶格档”是变更单 §2.2 的
    // 文档结论，它属 `levels.test.ts` 的规模闸职责，不属相机公式本例。
  });
  it('resetCamera 回恒等（测试基线）', () => {
    const c: BoardCamera = { zoom: 2, offsetX: 5, offsetY: 5 };
    resetCamera(c);
    expect(c.zoom).toBe(IDENTITY_CAMERA.zoom);
    expect(c.offsetX).toBe(0);
    expect(c.offsetY).toBe(0);
  });
});

describe('applyPinch（issue 2 缩放有界 · §3.3 v1.59 绝对档）', () => {
  it('single finger is not a pinch (false, unchanged)', () => {
    const c = cam();
    const g = createGesture();
    const one: PinchInput = { isDown: true, isDown2: false, x: 10, y: 10, x2: 0, y2: 0 };
    expect(applyPinch(one, c, g)).toBe(false);
    expect(c.zoom).toBe(1);
  });
  it('anchors on 2nd finger landing without a jump', () => {
    const c = cam();
    c.zoom = 2;
    const g = createGesture();
    expect(applyPinch(two(100, 100, 200, 100), c, g)).toBe(true);
    expect(c.zoom).toBe(2);
    expect(g.pinchDist0).toBeCloseTo(100, 6);
  });
  it('spread/pinch drives zoom by the relative ratio', () => {
    const c = cam();
    const g = createGesture();
    applyPinch(two(0, 0, 100, 0), c, g); // anchor 100, zoom0=1
    applyPinch(two(0, 0, 200, 0), c, g); // ratio 2 → 2
    expect(c.zoom).toBeCloseTo(2, 6);
  });
  it('clamps to the absolute range [CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]（与 fit 无关）', () => {
    const c = cam();
    const g = createGesture();
    applyPinch(two(0, 0, 100, 0), c, g);
    applyPinch(two(0, 0, 100000, 0), c, g); // huge spread → max
    expect(c.zoom).toBeCloseTo(CAMERA_ZOOM_MAX, 6);
    const c2 = cam();
    const g2 = createGesture();
    applyPinch(two(0, 0, 100, 0), c2, g2);
    applyPinch(two(0, 0, 0.0001, 0), c2, g2); // collapse → min = CAMERA_ZOOM_MIN（旧「下限 = fit」已退役）
    expect(c2.zoom).toBeCloseTo(CAMERA_ZOOM_MIN, 6);
  });
  it('2nd finger up drops the anchor (no re-anchor on owner)', () => {
    const c = cam();
    const g = createGesture();
    applyPinch(two(0, 0, 100, 0), c, g);
    expect(g.pinchDist0).toBe(100);
    const lifted: PinchInput = { isDown: true, isDown2: false, x: 0, y: 0, x2: 100, y2: 0 };
    expect(applyPinch(lifted, c, g)).toBe(false);
    expect(g.pinchDist0).toBe(0);
  });
});

describe('applyPan + clampCamera（issue 1 能拖 / issue 2 拖不出屏）', () => {
  it('窄盘（盘 > 视口一半）仍夹在背向盘缘过中线——双条件缺一不夹，拖动边未触界（[v1.68]）', () => {
    const c = cam();
    fitCamera(c, SC, SR); // 6×5 → zoom=2.0（宽度钉上钳），盘 380×320
    applyPan(9999, -9999, c, SC, SR);
    const bw = (SC * BEAD_PITCH - BEAD_GAP) * c.zoom; // 380 > 750/2 ⇒ 取盘/2分支
    const bh = (SR * BEAD_PITCH - BEAD_GAP) * c.zoom; // 320 > 560/2 ⇒ 同上
    expect(c.offsetX).toBeCloseTo(bw / 2, 4);
    expect(c.offsetY).toBeCloseTo(clampY(bh)[0], 4); // v1.69：下限由新操作窗口定（不对称）
  });
  it('窄窄盘（盘 < 视口一半）可拖至拖动方向盘缘顶格操作边界（[v1.68] 旧「盘/2」对窄盘偏严作废）', () => {
    // 6×5 @0.5 → 95×80：背向边到不了操作心就应先触界 ⇒ 上限 = (窗口−盘)/2 分支
    const c = cam();
    c.zoom = 0.5;
    c.offsetX = 9999;
    clampCamera(c, SC, SR);
    expect(c.offsetX).toBeCloseTo((750 - (SC * BEAD_PITCH - BEAD_GAP) * 0.5) / 2, 4); // 327.5
    c.offsetY = -9999;
    clampCamera(c, SC, SR);
    expect(c.offsetY).toBeCloseTo(clampY((SR * BEAD_PITCH - BEAD_GAP) * 0.5)[0], 4); // −326（v1.69 托盘上边界）
  });
  it('放大到 board > 视口 → 可平移，上限 = 盘缘至视口中线（[v1.66] 旧「边缘不出视口」作废）', () => {
    const c = cam();
    c.zoom = CAMERA_ZOOM_MAX; // 最大放大（绝对档，与盘无关），棋盘远大于视口
    clampCamera(c, BC, BR);
    const boardW = (BC * BEAD_PITCH - BEAD_GAP) * c.zoom;
    const maxOffX = boardW / 2; // v1.66：盘缘至中线 ⇒ 上限 = 半盘宽
    expect(maxOffX).toBeGreaterThan(0); // 此时确有可平移余量
    applyPan(999999, 0, c, BC, BR); // 往左猛拖
    expect(c.offsetX).toBeCloseTo(maxOffX, 4); // 夹在「盘缘 = 中线」，不再多
    applyPan(-999999, 0, c, BC, BR); // 反向
    expect(c.offsetX).toBeCloseTo(-maxOffX, 4);
  });
  it('clampCamera 顺带把越界的 zoom 拉回区间', () => {
    const c: BoardCamera = { zoom: 999, offsetX: 0, offsetY: 0 };
    clampCamera(c, SC, SR);
    expect(c.zoom).toBeCloseTo(CAMERA_ZOOM_MAX, 6);
  });
});

// §3.3 v1.59 `ZOOM_TAP_MIN` 低倍点击档的数学腿（行为正本 = `input-control §2.1`「tap·低倍档」）：
// 焦点不变式 = 被点珠的格心屏幕位缩放前后不变；屏幕位一律用 `gridLayoutFor`（渲染/命中同一真源）算，
// 不另写公式（历版正是手推屏幕式错了两回——判据与被测面同源才不会假红）。
// 诚实登记：板小于视口的盘（如 22×17 @1.0：702 < 750）平移锁 0，焦点补偿被既有口径吞掉
// ⇒ 跟手分支一律用 32×32 大盘（@1.0 悬挑 X 503 / Y 210）；补偿越界时只验「仍缩到 1.0 + offset 被夹」。
describe('zoomAtPoint（低倍点击焦点放大）', () => {
  const BIG = 32; // = GRID_MAX_COLS/ROWS，@1.0 板 1022 大于视口 750 ⇒ 有平移余量可验跟手分支
  it('焦点 = 盘心：缩放后仍居中（理想 offset = 0，不触夹）', () => {
    // 奇数盘（21×21）⇒ 盘心恰落中心格心；偶数盘的「盘心」在两格之间，hitGridCell 会选到
    // 邻格（等距取小者）⇒ 理想 offset = ±PITCH/2·(2j−cols+1) 不为 0（本例旧败因）。
    const c = cam();
    c.zoom = 0.3;
    const before = gridLayoutFor(21, 21, c);
    const px = before.left + ((21 * BEAD_PITCH - BEAD_GAP) * 0.3) / 2;
    const py = (before.top + before.bottom) / 2;
    zoomAtPoint(c, px, py, 1, 21, 21);
    expect(c.zoom).toBe(1);
    expect(c.offsetX).toBeCloseTo(0, 9);
    expect(c.offsetY).toBeCloseTo(0, 9);
  });
  it('大盘靠内格跟手：格心屏幕位不变，理想 offset 在悬挑区内未被夹', () => {
    const c = cam();
    c.zoom = 0.3;
    const before = gridLayoutFor(BIG, BIG, c);
    const bead = { row: 20, col: 10 }; // 距盘心 ≤ 8 格 ⇒ 理想补偿 X −258 / Y +32，均在悬挑区内
    const px = before.colCenterX(bead.col);
    const py = before.rowCenterY(bead.row);
    zoomAtPoint(c, px, py, 1, BIG, BIG);
    expect(c.zoom).toBe(1);
    const fresh = gridLayoutFor(BIG, BIG, { zoom: 1, offsetX: 0, offsetY: 0 });
    const idealX = px - fresh.colCenterX(bead.col);
    const idealY = py - fresh.rowCenterY(bead.row);
    const maxOffX = (BIG * BEAD_PITCH - BEAD_GAP) / 2; // v1.66：盘缘至中线 ⇒ 半盘宽（旧 (b−750)/2=136 作废）
    const [, yUpper] = clampY((BIG * BEAD_PITCH - BEAD_GAP) * c.zoom); // v1.69 镜像（夹取发生在 zoom=1）
    expect(Math.abs(idealX)).toBeLessThan(maxOffX); // 本例恰为 −(col−(cols−1)/2)·PITCH = −258
    expect(Math.abs(idealY)).toBeLessThan(yUpper);
    expect(c.offsetX).toBeCloseTo(idealX, 6);
    expect(c.offsetY).toBeCloseTo(idealY, 6);
    const after = gridLayoutFor(BIG, BIG, c);
    expect(after.colCenterX(bead.col)).toBeCloseTo(px, 6);
    expect(after.rowCenterY(bead.row)).toBeCloseTo(py, 6);
  });
  it('平移上限直检（[v1.69] 新操作窗口）：猛拖 offset 必被夹回不对称区间', () => {
    // 旧例「焦点补偿越出悬挑区 ⇒ 锁边」的夹具前提随 v1.66 上限放宽而消失
    // （zoom 0.3→1.0 最大补偿 ≈347，落在新区间内 ⇒ 永不触夹）；
    // 断言换形为非删（K-036）：改直检上限本身，防「夹取式被改松/改紧」回潮。
    const c = cam();
    c.zoom = 1;
    c.offsetY = 9999;
    c.offsetX = -9999;
    clampCamera(c, BIG, BIG);
    const b = BIG * BEAD_PITCH - BEAD_GAP; // 1022；X > 视口 ⇒ 半盘 511
    const [yMin, yMax] = clampY(b); // v1.69：+503 / −519（操作心相对带心 −8）
    expect(c.offsetY).toBeCloseTo(yMax, 4);
    expect(c.offsetX).toBeCloseTo(-b / 2, 4);
    c.offsetY = -9999;
    clampCamera(c, BIG, BIG);
    expect(c.offsetY).toBeCloseTo(yMin, 4); // 向下拖动边触「托盘上」边界
  });
  it('目标超上限被夹到 CAMERA_ZOOM_MAX', () => {
    const c = cam();
    c.zoom = 1;
    zoomAtPoint(c, 400, 800, 9, SC, SR);
    expect(c.zoom).toBe(CAMERA_ZOOM_MAX);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WXG-T-172 · F3 甲裁（以实现为准）⇒ 复位口径的**落点测试**（QA TC-CAM-08 的 [Node] 半边）。
//
// 判据源 = `ADR-0015 §3.4` 回写后正文：复位档 = 相机归 **fit 初始**（不是归恒等），
// 实际复位触发点 = **两处**（`_setupLevel`：换关/新局/重试/跳关；`_loadStage`：冲刺换 stage）。
// 断言一律走 `computeFitZoom(cols, rows)` **函数调用**，不钉字面 zoom：尺族常量（含
// `BOARD_FIT_MARGIN`，v1.65 起已退出 fit 算式）不作字面判据；缩放上下限自 **§3.3 v1.59**
// 已冻结（CAMERA_ZOOM_MIN/MAX），本组仍走符号引用防换尺漂移。
// 另锁一条**负向**口径（旧 §3.4 误列的复位点）：后台隐藏当帧不复位 ⇒ 见末例。「回菜单」同属
// 不复位一类（暂停面板次钮只上报意图 + 切屏归 shell，路径上不触碰相机），但那是 shell 接线 ⇒
// 本节不为其虚构断言；按新口径也**不得**写出「回菜单后当帧复位」这类断言（那本身是错的）。
// ─────────────────────────────────────────────────────────────────────────────

/** 相机权威存于玩法层私有字段（§3.3-1 / L5）；落点测试按现状读，不为此扩公开 API。 */
function cameraOf(game: BeadsGame): BoardCamera {
  return (game as unknown as { _camera: BoardCamera })._camera;
}

/** 把相机弄脏：7.5 恒在合法档 [CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX] 之外 ⇒ 复位缺失必留痕，不靠巧合相等。 */
function dirtyCamera(game: BeadsGame): void {
  const c = cameraOf(game);
  c.zoom = 7.5;
  c.offsetX = 123;
  c.offsetY = -77;
}

/** 新口径核心断言：zoom 逐位等于当前棋盘的 fit（非 toBeCloseTo），offset 归零。 */
function expectFitReset(game: BeadsGame): void {
  const c = cameraOf(game);
  expect(c.zoom).toBe(computeFitZoom(game.grid.cols, game.grid.rows));
  expect(c.offsetX).toBe(0);
  expect(c.offsetY).toBe(0);
}

/** 冲刺换 stage 的复位点是私有装配函数（无公开入口；本单不为其扩 API）。 */
function loadStageForTest(game: BeadsGame, n: number): void {
  (game as unknown as { _loadStage(n: number): void })._loadStage(n);
}

/** 顶格档 + 1 行的大盘（`BC×BR` = 22×17 ⇒ fit<1）；时长取关卡下沿，只为重试例少烧表。 */
function bigTestLevel(): ReturnType<typeof simpleTestLevel> {
  return simpleTestLevel({
    id: 91,
    cols: BC,
    rows: BR,
    time: LEVEL_TIME_MIN,
    // 行宽由 BC 派生（旧硬编 13 字串随 BC=22 与列数不一致，校验器必拒）。
    pattern: Array.from({ length: BR }, () => '123'.repeat(BC).slice(0, BC)),
  });
}

/** 6×5 小盘（屏内容得下 ⇒ fit=1 恒等档）；不依赖 shipped 关卡数据。 */
function smallTestLevel(): ReturnType<typeof simpleTestLevel> {
  return simpleTestLevel({
    id: 92,
    cols: SC,
    rows: SR,
    time: LEVEL_TIME_MIN,
    pattern: Array.from({ length: SR }, () => '123123'),
  });
}

/** 把当前 stage 打到完成（直接投放，不走时间）；与 `sprint.test.ts` 同形。 */
function fillCurrentStage(h: Harness): void {
  const game = h.game;
  const stage = game.stageIndex;
  let guard = 0;
  while (!game.grid.isComplete() && game.phase === 'playing' && game.stageIndex === stage) {
    const cell = firstEmptyCell(game);
    if (!cell) break;
    if (!placeColor(game, game.grid.requiredColor(cell.row, cell.col), cell.row, cell.col)) break;
    if (++guard > 5000) throw new Error('fillCurrentStage: ran away');
  }
}

describe('复位落点 = fit 初始（WXG-T-172 / ADR-0015 §3.4 · TC-CAM-08）', () => {
  it('换关（_setupLevel）：`BC×BR` 大盘归 fit，且 fit<1 ⇒ 与旧「恒等」档不等价', () => {
    // 受控夹具（先例 = 同文件小盘例喂 smallTestLevel、retry 例喂 bigTestLevel）：
    // 旧版 `goToLevel(7)` + `LEVELS[7 % LEVELS.length]` 是对**出货关表**的巧合耦合 ——
    // 索引 7 在「钳到末关」与「取模」两种映射下落不到同一关，v1.46 关表重置（8 关 → studio 三关）即失配。
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [smallTestLevel(), bigTestLevel()],
      saveKey: 'wxgame.beads.test.cam172-switch-big',
    });
    expect(h.game.levelIndex).toBe(0);
    dirtyCamera(h.game);

    h.game.goToLevel(1); // 6×5 → `BC×BR`（换关即重算 fit）

    expect(h.game.grid.cols).toBe(BC);
    expect(h.game.grid.rows).toBe(BR);
    expect(computeFitZoom(BC, BR)).toBeLessThan(1); // 大盘不再 zoom=1
    expectFitReset(h.game);
  });

  it('换关（_setupLevel）：6×5 小盘归 **fit 放大档**（[WXG-T-262] 推翻旧「fit=1 与恒等逐位相同」回归锚）', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [smallTestLevel()],
      saveKey: 'wxgame.beads.test.cam172-switch-small',
    });
    dirtyCamera(h.game);

    h.game.goToLevel(0); // 6×5

    expect(h.game.grid.cols).toBe(SC);
    expect(h.game.grid.rows).toBe(SR);
    expectFitReset(h.game);
    // [WXG-T-262 · 用户裁「不是 1:1，整盘放大到左右留空隙；初始 = 适配档」]：6×5 越上钳
    // ⇒ 落点 = `CAMERA_ZOOM_MAX`；⛔ 回潮成恒等 1.0 即本钉红。
    expect(cameraOf(h.game).zoom).toBe(CAMERA_ZOOM_MAX);
    // 放大档的布局确实等比放大（列心距 = 基尺节距 × zoom，绕带心）。
    const withCam = gridLayoutFor(SC, SR, cameraOf(h.game));
    const bare = gridLayoutFor(SC, SR);
    expect(withCam.pitch).toBeCloseTo(bare.pitch * CAMERA_ZOOM_MAX, 9);
  });

  it('重试（retryLevel → _setupLevel）：大盘重新归 fit（不是恒等）', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [bigTestLevel()],
      saveKey: 'wxgame.beads.test.cam172-retry',
    });
    expect(h.game.grid.cols).toBe(BC);
    burnToRemaining(h, 0); // 烧穿倒计时 → GAME_OVER
    expect(h.game.phase).toBe('game-over');
    dirtyCamera(h.game);

    expect(h.game.retryLevel()).toBe(true);

    expect(h.game.phase).toBe('playing');
    expectFitReset(h.game);
    expect(cameraOf(h.game).zoom).toBeLessThan(1);
  });

  it('冲刺换 stage（_loadStage）：真实链路 stage0→1 归 fit；再取大盘 stage 验「按新尺寸重算」', () => {
    const h = createBeadsHarness({ noAssemble: true, saveKey: 'wxgame.beads.test.cam172-stage' });
    h.game.startSprint();
    expect(h.game.stageIndex).toBe(0);
    dirtyCamera(h.game);

    fillCurrentStage(h); // 填满 → _completeStage 内部 _loadStage(1)

    expect(h.game.stageIndex).toBe(1);
    expect(h.count('sprint:stage')).toBe(2); // 开局横幅 + 换 stage
    expectFitReset(h.game);
    const stage1Dims: readonly [number, number] = [h.game.grid.cols, h.game.grid.rows];

    // 第二档：棋盘尺寸不同，锁住「按新尺寸重算」而非写死 1。
    // 尺寸正本 = `STAGE_PATTERN_POOL`（冲刺 stage 图案走 `buildStagePattern(n)` → pool[n % pool.length]，
    // **与出货关表无关**）；旧版拿 `LEVELS[7 % LEVELS.length]` 比对是巧合耦合，
    // v1.46 关表重置（demo 8 关 → studio 三关）后即失配。先例：同文件 retry 例喂 `bigTestLevel()`。
    dirtyCamera(h.game);
    loadStageForTest(h.game, 7);
    const stage7 = STAGE_PATTERN_POOL[7 % STAGE_PATTERN_POOL.length]!;
    expect(h.game.grid.cols).toBe(stage7[0]!.length);
    expect(h.game.grid.rows).toBe(stage7.length);
    expectFitReset(h.game);
    // (b) 两档尺寸不同 ⇒ 排除“两次恰好同尺”的偶然相等。
    expect([h.game.grid.cols, h.game.grid.rows]).not.toEqual(stage1Dims);
    // ⚠ 旧腿 `expect(zoom).toBeLessThan(1)` 的前提已被 v1.57 取消：§3.3 换 32 基后顶格档
    // 抬到 22×18，而冲刺池（= `STAGE_PATTERN_POOL` ≡ `LEVELS` 图案）均≤顶格档 ⇒
    // **池内不再存在 fit<1 的盘**（不是断言写错，是被测前提消失，变更单 §2.2）。
    // ⛔ 不删不补是违规（K-036）⇒ “不是写死 1”改由下面探针腿承担：
    //    对**越界尺寸**直接跑 `fitCamera`，若实现被写成常量 1（或任何定值）本腿必红。
    const probe: BoardCamera = { zoom: 9, offsetX: 0, offsetY: 0 };
    fitCamera(probe, BC, BR);
    expect(probe.zoom).toBeLessThan(1);
    expect(probe.zoom).toBe(computeFitZoom(BC, BR));
  });

  it('后台隐藏（onPause/onResume）当帧不复位 ⇒ 复位由下次装配承担（新口径负向锁）', () => {
    const h = createBeadsHarness({ noAssemble: true, saveKey: 'wxgame.beads.test.cam172-hide' });
    dirtyCamera(h.game);

    h.game.onPause();
    expect(h.game.phase).toBe('paused');
    expect(cameraOf(h.game).zoom).toBe(7.5); // 隐藏路径不触碰相机（旧 §3.4 误列 InputManager.reset()）
    expect(cameraOf(h.game).offsetX).toBe(123);
    h.game.onResume();
    expect(cameraOf(h.game).zoom).toBe(7.5);

    h.game.goToLevel(0); // 下一局装配 = 复位真正发生处
    expectFitReset(h.game);
  });
});

describe('盘面下方缩放控件：slider ↔ zoom 映射（§3.3 v1.59 绝对档，与 fit 无关）', () => {
  // 夹取域与捏合共用同一绝对区间；轨道端点 = 0.2 / 2.0，不再随盘而变。
  const COLS = 29;
  const ROWS = 29;

  it('端点与往返：t=0 ⇒ MIN、t=1 ⇒ MAX，且 t→zoom→t 恒等', () => {
    expect(zoomFromSliderT(0)).toBe(CAMERA_ZOOM_MIN);
    expect(zoomFromSliderT(1)).toBeCloseTo(CAMERA_ZOOM_MAX, 10);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(sliderTFromZoom(zoomFromSliderT(t))).toBeCloseTo(t, 10);
    }
  });

  it('越界 t 被夹到端点（轨道外拖拽不产生域外 zoom）', () => {
    expect(zoomFromSliderT(-5)).toBe(CAMERA_ZOOM_MIN);
    expect(zoomFromSliderT(5)).toBeCloseTo(CAMERA_ZOOM_MAX, 10);
  });

  it('fit 不变式（§3.3 v1.59）：MIN ≤ fit ≤ 1 ≤ MAX，最大盘也在区间内', () => {
    const fit = computeFitZoom(COLS, ROWS);
    expect(fit).toBeLessThan(1);
    expect(fit).toBeGreaterThanOrEqual(CAMERA_ZOOM_MIN);
    expect(1).toBeLessThanOrEqual(CAMERA_ZOOM_MAX);
  });

  it('setCameraZoom 走与捏合同一夹取：超上限落回 MAX，并按新尺寸重夹平移', () => {
    const c = cam();
    c.offsetX = 2000; // [v1.66] 旧 900 在新上限（半盘 926）内不再触夹 ⇒ 换越界值
    setCameraZoom(c, 999, COLS, ROWS);
    expect(c.zoom).toBeCloseTo(CAMERA_ZOOM_MAX, 10);
    // 夹取上限 = 盘缘至视口中线（[v1.66]）⇒ 与 clampCamera 同口径。
    // （绝对档 2.0 下 29×29 的 maxOff = 926×2/2 = 926 ⇒ 2000 必被重夹。）
    clampCamera(c, COLS, ROWS);
    expect(c.offsetX).toBeLessThan(2000);
    expect(c.offsetX).toBeCloseTo(
      (COLS * BEAD_PITCH - BEAD_GAP) * CAMERA_ZOOM_MAX / 2,
      4,
    );
  });
});
