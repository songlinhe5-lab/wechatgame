/**
 * `[WXG-T-925 / T-926]` 珠面剪影轮廓（「贴纸裁切」外圈）：沿整幅图案剪影画一圈连续描边，
 * 折叠处随每颗边界珠的圆角自然过渡。绘制在珠面**之下** ⇒ 只露珠面外的一圈。
 *
 * 裁定来源（art 2026-11-12 二裁，用户令「边缘颜色适合凸显珠面，可以是黑色或者金色；
 * 线条需要连续、紧贴珠面边缘；各种珠面展示都需要加，跟珠面等比例缩放」）：
 *  - 颜色 = `palette.shadowInk`（暖可可 `#3D2E1E` 黑，单层实线；金色靠近珠面违反
 *    art-bible §3.5/§4.3「金色仅结算用」，且 `STAR_GOLD` 与珠色 2 柠黄同值 ⇒ 不可用）；
 *  - 线宽 `W = clamp(round(pitch×0.18), 2, 6)`，三处展示（详情 / 选关 / 走马灯）共用；
 *  - 贴边口径：轮廓为**每颗边界珠**的「珠面外扩 W」圆角方块，内缘与底块（tile）
 *    外缘重合（tile 含 `TILE_BLEED` 外扩）⇒ 无缝、连续，⛔ 不再按格边留缝；
 *  - 同色一次性并集填充（不透明重叠，不叠 α）；折叠处圆角 = `R=clamp(round(pitch×0.22),2,6)`；
 *  - 形状按（left, top, pitch, lockedFace）缓存 ⇒ 逐帧零重建。
 */

import type { RenderModelBuilder } from '../../framework/index';
import { TILE_BLEED } from '../config/tuning/board';
import type { BeadsLevelRaw } from '../config/levels-data';

type OutlineShape = { readonly pts: number[] };

/** 轮廓可见宽度（设计 px）：art 公式 `clamp(round(pitch×0.18), 2, 6)`。 */
export function thumbOutlineWidth(pitch: number): number {
  return Math.min(6, Math.max(2, Math.round(pitch * 0.18)));
}

/** 折角圆角半径（设计 px）：art 公式 `clamp(round(pitch×0.22), 2, 6)`。 */
export function thumbOutlineRadius(pitch: number): number {
  return Math.min(6, Math.max(2, Math.round(pitch * 0.22)));
}

let _cache = new WeakMap<BeadsLevelRaw, { key: string; shapes: readonly OutlineShape[] }>();

/**
 * 画珠面轮廓（必须在底块 / 珠体之前调用）。
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
    hit = { key, shapes: buildShapes(level, left, top, pitch, lockedFace) };
    _cache.set(level, hit);
  }
  for (const s of hit.shapes) builder.polygon(s.pts, { fill: color });
}

function buildShapes(level: BeadsLevelRaw, left: number, top: number, pitch: number, lockedFace: number): OutlineShape[] {
  const rows = level.pattern.length;
  const cols = level.cols;
  const occ = (r: number, c: number): boolean =>
    r >= 0 && r < rows && c >= 0 && c < cols && level.pattern[r]![c] !== '.';
  const W = thumbOutlineWidth(pitch);
  const R = thumbOutlineRadius(pitch);
  const tileFace = pitch + TILE_BLEED * 2;
  const shapes: OutlineShape[] = [];
  for (let r = 0; r < rows; r++) {
    const row = level.pattern[r]!;
    for (let c = 0; c < cols; c++) {
      if (row[c] === '.') continue;
      // 只画边界珠（四邻有空格 / 越界）：内部珠的外扩会被邻格底块盖住，画了也看不见。
      if (occ(r - 1, c) && occ(r, c + 1) && occ(r + 1, c) && occ(r, c - 1)) continue;
      const face = row[c] === 'x' ? lockedFace : tileFace;
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
