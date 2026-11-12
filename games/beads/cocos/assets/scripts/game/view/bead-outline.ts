/**
 * `[WXG-T-925 / T-926 / T-927 / T-928]` 珠面剪影轮廓（「贴纸裁切」外圈）：沿整幅图案剪影画一圈连续描边，
 * 折叠处随每颗边界珠的圆角自然过渡。绘制在珠面**之上**（T-928 用户令「珠面描边要盖在珠面上面」）⇒
 * 线条压住边界珠外缘 W 宽。
 *
 * 裁定来源（art 2026-11-12 二裁，用户令「边缘颜色适合凸显珠面，可以是黑色或者金色；
 * 线条需要连续、紧贴珠面边缘；各种珠面展示都需要加，跟珠面等比例缩放」；
 * T-927 用户三调「描边窄一点、圆角半径再大一点、游戏中也需要」；
 * T-928 用户四调「珠面描边要盖在珠面上面」）：
 *  - 颜色 = `palette.shadowInk`（暖可可 `#3D2E1E` 黑，单层实线；金色靠近珠面违反
 *    art-bible §3.5/§4.3「金色仅结算用」，且 `STAR_GOLD` 与珠色 2 柠黄同值 ⇒ 不可用）；
 *  - 线宽 `W = clamp(round(pitch×0.10), 1, 4)`（T-926 的 0.18/2–6 过粗，用户令收窄）；
 *  - 折角圆角 `R = clamp(round(pitch×0.30), 2, 9)`（T-926 的 0.22/2–6 再放大）；
 *  - 贴边口径：轮廓为**每颗边界珠**的「珠面外扩 W」圆角方块，内缘与底块（tile）
 *    外缘重合（tile 含 `TILE_BLEED` 外扩）⇒ 无缝、连续，⛔ 不再按格边留缝；
 *  - 同色一次性并集填充（不透明重叠，不叠 α）；
 *  - 适用范围：详情橱窗 / 选关缩略 / **对局盘面**（T-927 新增；盘面与缩略同一套形状，
 *    只把占用判定从 `pattern` 换成快照格 `void`）；首页走马灯例外（烘焙作品图，待 art 重出）；
 *  - 形状按几何缓存 ⇒ 逐帧零重建；盘面缓存用数值键（不做字符串拼接 ⇒ 热路径零分配）。
 */

import type { RenderModelBuilder } from '../../framework/index';
import { TILE_BLEED } from '../config/tuning/board';
import type { BeadsLevelRaw } from '../config/levels-data';
import type { BeadsSnapshot } from '../game/state';

type OutlineShape = { readonly pts: number[] };
type Occupancy = (r: number, c: number) => boolean;

/** 轮廓可见宽度（设计 px）：`clamp(round(pitch×0.10), 1, 4)`。 */
export function thumbOutlineWidth(pitch: number): number {
    return Math.min(4, Math.max(1, Math.round(pitch * 0.1)));
}

/** 折角圆角半径（设计 px）：`clamp(round(pitch×0.30), 2, 9)`。 */
export function thumbOutlineRadius(pitch: number): number {
    return Math.min(9, Math.max(2, Math.round(pitch * 0.3)));
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
    const W = thumbOutlineWidth(pitch);
    const R = thumbOutlineRadius(pitch);
    const tileFace = pitch + TILE_BLEED * 2;
    const shapes: OutlineShape[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!occ(r, c)) continue;
            // 只画边界珠（四邻有空格 / 越界）：内部珠的外扩会被邻格底块盖住，画了也看不见。
            if (occ(r - 1, c) && occ(r, c + 1) && occ(r + 1, c) && occ(r, c - 1)) continue;
            const face = locked(r, c) ? lockedFace : tileFace;
            const half = face / 2 + W;
            const cx = left + (c + 0.5) * pitch;
            const cy = top - (r + 0.5) * pitch;
            shapes.push({ pts: roundedSquare(cx, cy, half, Math.min(R, half - 0.01)) });
        }
    }
    return shapes;
}

/** 圆角方块多边形（设计空间 y 向上，每角 5 点）。 */
function roundedSquare(cx: number, cy: number, half: number, r: number): number[] {
    const pts: number[] = [];
    const steps = 4;
    const corners: readonly (readonly [number, number, number])[] = [
        [1, 1, 0],
        [-1, 1, Math.PI / 2],
        [-1, -1, Math.PI],
        [1, -1, Math.PI * 1.5],
    ];
    for (const [sx, sy, a0] of corners) {
        const ax = cx + sx * (half - r);
        const ay = cy + sy * (half - r);
        for (let i = 0; i <= steps; i++) {
            const a = a0 + (Math.PI / 2) * (i / steps);
            pts.push(ax + Math.cos(a) * r, ay + Math.sin(a) * r);
        }
    }
    return pts;
}
