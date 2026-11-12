/**
 * `[WXG-T-925 / T-926 / T-927 / T-928 / T-929 / T-930]` 珠面剪影轮廓（「贴纸裁切」外圈）：沿整幅图案剪影画一圈连续描边，
 * 折叠处随每颗边界珠的圆角自然过渡。绘制在珠面**之上**（T-928 用户令「珠面描边要盖在珠面上面」）⇒
 * 线条压住边界珠外缘 W 宽。
 *
 * 裁定来源（art 2026-11-12 二裁，用户令「边缘颜色适合凸显珠面，可以是黑色或者金色；
 * 线条需要连续、紧贴珠面边缘；各种珠面展示都需要加，跟珠面等比例缩放」；
 * T-927 用户三调「描边窄一点、圆角半径再大一点、游戏中也需要」；
 * T-928 用户四调「珠面描边要盖在珠面上面」）：
 *  - 颜色 = `palette.shadowInk`（暖可可 `#3D2E1E` 黑，单层实线；金色靠近珠面违反
 *    art-bible §3.5/§4.3「金色仅结算用」，且 `STAR_GOLD` 与珠色 2 柠黄同值 ⇒ 不可用）；
 *  - 线宽 / 圆角（T-930）：**1:1 基准 = 珠距 `BEAD_PITCH` 时 `W=3`、`R=9`**，
 *    其余尺寸一律 `× pitch / BEAD_PITCH` **线性等比**（缩放盘面同步放大缩小，⛔ 不再钳位）；
 *    （历史：T-926 `0.18 / 2–6` 过粗 → T-927 `0.10 / 1–4`、`0.30 / 2–9` → T-930 去钳位改纯比例）；
 *  - 贴边口径（T-929 修正）：轮廓是**骑在剪影边线上的一条带**（宽 W：内 `W/2`、外 `W/2`），
 *    逐边界珠只画露空的边 + 凸角 1/4 环带 ⇒ 连续闭环、随珠面等比；
 *    ⛔ 不再用「整颗边界珠外扩 W 的实心圆角方块」——填色盖在珠面上会把一圈珠子涂黑；
 *  - 同色一次性并集填充（不透明重叠，不叠 α）；
 *  - 适用范围：详情橱窗 / 选关缩略 / **对局盘面**（T-927 新增；盘面与缩略同一套形状，
 *    只把占用判定从 `pattern` 换成快照格 `void`）；首页走马灯例外（烘焙作品图，待 art 重出）；
 *  - 形状按几何缓存 ⇒ 逐帧零重建；盘面缓存用数值键（不做字符串拼接 ⇒ 热路径零分配）。
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import { BEAD_PITCH, TILE_BLEED } from '../config/tuning/board.js';
import type { BeadsLevelRaw } from '../config/levels-data.js';
import type { BeadsSnapshot } from '../game/state.js';

type OutlineShape = { readonly pts: number[] };
type Occupancy = (r: number, c: number) => boolean;

/**
 * `[WXG-T-930]` **1:1 基准**：盘面珠距 `BEAD_PITCH`（32）时描边宽 3、圆角半径 9。
 * 其余任何 pitch（缩放 / 缩略 / 详情）一律按 `pitch / BEAD_PITCH` **线性等比**，
 * ⛔ 不再上下钳位（旧 1–4 / 2–9 会让缩放后比例失真，用户令「跟着珠面等比例缩放」）。
 */
const OUTLINE_BASE_WIDTH = 3;
const OUTLINE_BASE_RADIUS = 9;

/** 轮廓可见宽度（设计 px）：1:1 基准 × `pitch / BEAD_PITCH`。 */
export function thumbOutlineWidth(pitch: number): number {
    return OUTLINE_BASE_WIDTH * (pitch / BEAD_PITCH);
}

/** 折角圆角半径（设计 px）：1:1 基准 × `pitch / BEAD_PITCH`。 */
export function thumbOutlineRadius(pitch: number): number {
    return OUTLINE_BASE_RADIUS * (pitch / BEAD_PITCH);
}

let _cache = new WeakMap<BeadsLevelRaw, { key: string; shapes: readonly OutlineShape[] }>();

let _boardCache: {
    cells: BeadsSnapshot['cells'];
    levelId: string;
    levelIndex: number;
    stageIndex: number;
    rows: number;
    cols: number;
    left: number;
    top: number;
    pitch: number;
    lockedFace: number;
    shapes: readonly OutlineShape[];
} | null = null;

/**
 * 画珠面轮廓（必须在底块 / 珠体**之后**调用，覆在珠面之上）。
 * @param lockedFace `x` 锁定格的珠面边长（与 `drawLockedBead` 同参）——锁定格无目标色底块，
 *   轮廓贴其珠体；有目标色的格贴底块外缘（`pitch + 2×TILE_BLEED`）。
 */
export function drawThumbOutline(
    builder: RenderModelBuilder,
    level: BeadsLevelRaw,
    left: number,
    top: number,
    pitch: number,
    lockedFace: number,
    color: string,
): void {
    const key = `${left}|${top}|${pitch}|${lockedFace}`;
    let hit = _cache.get(level);
    if (!hit || hit.key !== key) {
        hit = { key, shapes: buildShapes(level.pattern.length, level.cols, thumbOcc(level), thumbLocked(level), left, top, pitch, lockedFace) };
        _cache.set(level, hit);
    }
    for (const s of hit.shapes) builder.polygon(s.pts, { fill: color });
}

/**
 * `[WXG-T-927 / T-928]` 对局盘面轮廓：占位取自快照（`cell.void`），锁定格取自 `cell.state`。
 * 必须在对局格循环**之后**调用（末笔覆在珠面之上）。
 * 缓存键 = 关卡身份 + 几何（数值逐项比较，⛔ 不拼字符串 ⇒ 每帧零分配）。
 */
export function drawBoardOutline(
    builder: RenderModelBuilder,
    snap: BeadsSnapshot,
    color: string,
): void {
    const left = snap.gridLeft + snap.gridCell / 2 - snap.gridPitch / 2;
    const top = snap.gridTop - snap.gridCell / 2 + snap.gridPitch / 2;
    let hit = _boardCache;
    if (
        !hit ||
        hit.cells !== snap.cells ||
        hit.levelId !== snap.levelId ||
        hit.levelIndex !== snap.levelIndex ||
        hit.stageIndex !== snap.stageIndex ||
        hit.rows !== snap.gridRows ||
        hit.cols !== snap.gridCols ||
        hit.left !== left ||
        hit.top !== top ||
        hit.pitch !== snap.gridPitch ||
        hit.lockedFace !== snap.gridCell
    ) {
        const cols = snap.gridCols;
        const cells = snap.cells;
        const occ: Occupancy = (r, c) =>
            r >= 0 && r < snap.gridRows && c >= 0 && c < cols && !cells[r * cols + c]!.void;
        const locked: Occupancy = (r, c) => cells[r * cols + c]!.state === 'locked';
        hit = {
            cells,
            levelId: snap.levelId,
            levelIndex: snap.levelIndex,
            stageIndex: snap.stageIndex,
            rows: snap.gridRows,
            cols,
            left,
            top,
            pitch: snap.gridPitch,
            lockedFace: snap.gridCell,
            shapes: buildShapes(snap.gridRows, cols, occ, locked, left, top, snap.gridPitch, snap.gridCell),
        };
        _boardCache = hit;
    }
    for (const s of hit.shapes) builder.polygon(s.pts, { fill: color });
}

function thumbOcc(level: BeadsLevelRaw): Occupancy {
    return (r, c) => r >= 0 && r < level.pattern.length && c >= 0 && c < level.cols && level.pattern[r]![c] !== '.';
}

function thumbLocked(level: BeadsLevelRaw): Occupancy {
    return (r, c) => r >= 0 && r < level.pattern.length && c >= 0 && c < level.cols && level.pattern[r]![c] === 'x';
}

/**
 * `[WXG-T-929]` 轮廓 = **骑在剪影边线上的一条带**（半宽 `W/2` 内、外各半），
 * 逐边界格只画**露空的那几条边** + 凸角四分之一环带 ⇒ 连续闭环，⛔ 不再填满整个边界珠
 * （T-928 实测：整体填色盖到珠面上会把一圈珠子涂黑）。
 */
function buildShapes(
    rows: number,
    cols: number,
    occ: Occupancy,
    locked: Occupancy,
    left: number,
    top: number,
    pitch: number,
    lockedFace: number,
): OutlineShape[] {
    const bw = thumbOutlineWidth(pitch) / 2;
    const tileFace = pitch + TILE_BLEED * 2;
    const shapes: OutlineShape[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!occ(r, c)) continue;
            const expN = !occ(r - 1, c);
            const expE = !occ(r, c + 1);
            const expS = !occ(r + 1, c);
            const expW = !occ(r, c - 1);
            if (!expN && !expE && !expS && !expW) continue; // 内部珠：无露边
            const face = locked(r, c) ? lockedFace : tileFace;
            const f2 = face / 2;
            const R = Math.min(thumbOutlineRadius(pitch), f2 - 0.01);
            if (R <= 0) continue;
            const cx = left + (c + 0.5) * pitch;
            const cy = top - (r + 0.5) * pitch;
            // 凸角 = 两相邻边都露空 **且** 斜对角也空（凹角不圆，交给邻格带在缝上自然相接）。
            const cvNE = expN && expE && !occ(r - 1, c + 1);
            const cvSE = expE && expS && !occ(r + 1, c + 1);
            const cvSW = expS && expW && !occ(r + 1, c - 1);
            const cvNW = expW && expN && !occ(r - 1, c - 1);
            // 带端收口：露空边收 R（凸角交给环带）；紧邻占用格则收到邻格面缘（重叠 1 = TILE_BLEED）。
            const end = (expSide: boolean, convex: boolean): number => (expSide ? (convex ? f2 - R : f2) : pitch - f2);
            if (expN) {
                const x0 = cx - end(expW, cvNW);
                const x1 = cx + end(expE, cvNE);
                shapes.push({ pts: [x0, cy + f2 - bw, x1, cy + f2 - bw, x1, cy + f2 + bw, x0, cy + f2 + bw] });
            }
            if (expS) {
                const x0 = cx - end(expW, cvSW);
                const x1 = cx + end(expE, cvSE);
                shapes.push({ pts: [x0, cy - f2 - bw, x1, cy - f2 - bw, x1, cy - f2 + bw, x0, cy - f2 + bw] });
            }
            if (expW) {
                const y0 = cy - end(expS, cvSW);
                const y1 = cy + end(expN, cvNW);
                shapes.push({ pts: [cx - f2 - bw, y0, cx - f2 + bw, y0, cx - f2 + bw, y1, cx - f2 - bw, y1] });
            }
            if (expE) {
                const y0 = cy - end(expS, cvSE);
                const y1 = cy + end(expN, cvNE);
                shapes.push({ pts: [cx + f2 - bw, y0, cx + f2 + bw, y0, cx + f2 + bw, y1, cx + f2 - bw, y1] });
            }
            if (cvNE) shapes.push({ pts: cornerBand(cx + f2 - R, cy + f2 - R, 0, R, bw) });
            if (cvNW) shapes.push({ pts: cornerBand(cx - f2 + R, cy + f2 - R, Math.PI / 2, R, bw) });
            if (cvSW) shapes.push({ pts: cornerBand(cx - f2 + R, cy - f2 + R, Math.PI, R, bw) });
            if (cvSE) shapes.push({ pts: cornerBand(cx + f2 - R, cy - f2 + R, Math.PI * 1.5, R, bw) });
        }
    }
    return shapes;
}

/** 凸角 1/4 环带（外弧 → 内弧反向，设计空间 y 向上）。 */
function cornerBand(cx: number, cy: number, a0: number, r: number, bw: number): number[] {
    const pts: number[] = [];
    const steps = 4;
    const ro = r + bw;
    const ri = r - bw;
    for (let i = 0; i <= steps; i++) {
        const a = a0 + (Math.PI / 2) * (i / steps);
        pts.push(cx + Math.cos(a) * ro, cy + Math.sin(a) * ro);
    }
    if (ri > 0.01) {
        for (let i = steps; i >= 0; i--) {
            const a = a0 + (Math.PI / 2) * (i / steps);
            pts.push(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri);
        }
    } else {
        pts.push(cx, cy);
    }
    return pts;
}
