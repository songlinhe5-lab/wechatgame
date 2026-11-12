/**
 * `[WXG-T-925]` 珠面剪影轮廓（「贴纸裁切」外圈）：沿整幅图案剪影画一圈轮廓，
 * 折叠处（凹角）用圆角过渡。绘制在珠面**之下** ⇒ 只露出剪影外的一圈。
 *
 * 裁定来源（art 2026-11-12，用户令「轮廓的颜色和效果请 art 帮我裁定」）：
 *  - 颜色 = `palette.panel`（暖纸白 `#FFFCF6`），不新增色值；
 *  - 单层实线，无双层 / 投影 / 发光 / 渐变；
 *  - 线宽 `W = clamp(round(pitch×0.18), 2, 6)`，沿剪影外缘**向外**扩，不侵占珠面；
 *  - 圆角 `R = clamp(round(pitch×0.22), 2, 6)`（凹角折叠处；凸角按线宽自然圆角 = W）；
 *  - 仅详情橱窗启用（选关九宫格 / 作品墙已有木框包边，叠加会成双重包边噪声）。
 *
 * 几何口径：占格 = `pattern` 里非 `.` 的格（`x` 锁定格计入剪影）。按格边提取有向边界环
 * （全部 90° 角）⇒ 凸角画四分之一圆盘（半径 W，只占剪影外侧象限，⛔ 不侵入珠面）、
 * 凹角折叠画四分之一圆环（内半径 R+W、外半径 R ⇒ **可见折角圆角 = R**，带宽恒 W）、
 * 直边画矩形条。每关按（left, top, pitch）缓存形状 ⇒ 逐帧零重建。
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import type { BeadsLevelRaw } from '../config/levels-data.js';

type OutlineShape =
  | { readonly kind: 'rect'; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  | { readonly kind: 'poly'; readonly pts: number[] };

/** 轮廓可见宽度（设计 px）：art 公式 `clamp(round(pitch×0.18), 2, 6)`。 */
export function thumbOutlineWidth(pitch: number): number {
  return Math.min(6, Math.max(2, Math.round(pitch * 0.18)));
}

/** 凹角圆角半径（设计 px）：art 公式 `clamp(round(pitch×0.22), 2, 6)`。 */
export function thumbOutlineRadius(pitch: number): number {
  return Math.min(6, Math.max(2, Math.round(pitch * 0.22)));
}

/** 顶点键步长（盘上限 32×32 ⇒ 64 足够唯一）。 */
const GRID_KEY = 64;

let _cache = new WeakMap<BeadsLevelRaw, { key: string; shapes: readonly OutlineShape[] }>();

/**
 * 画珠面轮廓（必须在珠面之前调用）。
 * @param left  @param top  @param pitch 与 `drawBeadFace` 同一槽位口径（设计空间 y 向上）
 */
export function drawThumbOutline(
    builder: RenderModelBuilder,
    level: BeadsLevelRaw,
    left: number,
    top: number,
    pitch: number,
    color: string,
): void {
  const key = `${left}|${top}|${pitch}`;
  let hit = _cache.get(level);
  if (!hit || hit.key !== key) {
    hit = { key, shapes: buildShapes(level, left, top, pitch) };
    _cache.set(level, hit);
  }
  for (const s of hit.shapes) {
    if (s.kind === 'rect') builder.rect(s.x, s.y, s.w, s.h, { fill: color });
    else builder.polygon(s.pts, { fill: color });
  }
}

function buildShapes(level: BeadsLevelRaw, left: number, top: number, pitch: number): OutlineShape[] {
  const rows = level.pattern.length;
  const cols = level.cols;
  const occ = (r: number, c: number): boolean =>
    r >= 0 && r < rows && c >= 0 && c < cols && level.pattern[r]![c] !== '.';

  // 有向边界边（格坐标、y 向下），物料恒在前进方向右侧 ⇒ 外法线 n = (dy, -dx)。
  const out = new Map<number, number[]>();
  const add = (x1: number, y1: number, x2: number, y2: number): void => {
    const k = x1 * GRID_KEY + y1;
    const a = out.get(k);
    if (a) a.push(x2 * GRID_KEY + y2);
    else out.set(k, [x2 * GRID_KEY + y2]);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!occ(r, c)) continue;
      if (!occ(r - 1, c)) add(c, r, c + 1, r);
      if (!occ(r, c + 1)) add(c + 1, r, c + 1, r + 1);
      if (!occ(r + 1, c)) add(c + 1, r + 1, c, r + 1);
      if (!occ(r, c - 1)) add(c, r + 1, c, r);
    }
  }
  if (out.size === 0) return [];

  const W = thumbOutlineWidth(pitch);
  const R = thumbOutlineRadius(pitch);
  const tx = (gx: number): number => left + gx * pitch;
  const ty = (gy: number): number => top - gy * pitch;
  const shapes: OutlineShape[] = [];

  while (out.size > 0) {
    const first = out.entries().next().value as [number, number[]];
    const sx = Math.floor(first[0] / GRID_KEY);
    const sy = first[0] % GRID_KEY;
    const raw: number[] = [sx, sy];
    let cx = sx;
    let cy = sy;
    for (;;) {
      const arr = out.get(cx * GRID_KEY + cy);
      if (!arr) break;
      const nk = arr.pop()!;
      if (arr.length === 0) out.delete(cx * GRID_KEY + cy);
      const nx = Math.floor(nk / GRID_KEY);
      const ny = nk % GRID_KEY;
      if (nx === sx && ny === sy) break;
      raw.push(nx, ny);
      cx = nx;
      cy = ny;
    }
    // 合并共线点
    const pts: number[] = [];
    const n0 = raw.length / 2;
    for (let i = 0; i < n0; i++) {
      const px = raw[((i - 1 + n0) % n0) * 2]!;
      const py = raw[((i - 1 + n0) % n0) * 2 + 1]!;
      const qx = raw[i * 2]!;
      const qy = raw[i * 2 + 1]!;
      const rx = raw[((i + 1) % n0) * 2]!;
      const ry = raw[((i + 1) % n0) * 2 + 1]!;
      const cross = (qx - px) * (ry - qy) - (qy - py) * (rx - qx);
      if (cross !== 0) {
        pts.push(qx, qy);
      }
    }
    if (pts.length < 8) continue; // <4 顶点：退化形（单格至少 4 顶点）
    const n = pts.length / 2;

    // 角：凸角四分之一圆盘（外侧） / 凹角四分之一圆环（缺口内），直边矩形条。
    for (let i = 0; i < n; i++) {
      const px = pts[((i - 1 + n) % n) * 2]!;
      const py = pts[((i - 1 + n) % n) * 2 + 1]!;
      const qx = pts[i * 2]!;
      const qy = pts[i * 2 + 1]!;
      const rx = pts[((i + 1) % n) * 2]!;
      const ry = pts[((i + 1) % n) * 2 + 1]!;
      const ux = qx - px;
      const uy = qy - py;
      const vx = rx - qx;
      const vy = ry - qy;
      const cross = ux * vy - uy * vx;
      const ul = Math.hypot(ux, uy);
      const vl = Math.hypot(vx, vy);
      // 外法线（格坐标）：n = (dy, -dx) / |d|
      const nix = uy / ul;
      const niy = -ux / ul;
      const nox = vy / vl;
      const noy = -vx / vl;
      const cxd = tx(qx);
      const cyd = ty(qy);
      // 设计空间 y 向上 ⇒ 法线 y 取反后取角
      const a1 = Math.atan2(-niy, nix);
      const a2 = Math.atan2(-noy, nox);
      if (cross > 0) {
        // 凸角：四分之一圆盘（半径 W，只落剪影外侧象限）
        shapes.push({ kind: 'poly', pts: arcPoly(cxd, cyd, W, a1, a2, 6, true) });
      } else if (cross < 0) {
        // 凹角折叠：内边界（贴物料侧）半径 Ri = R + W、圆心在缺口内距两边 Ri；
        // 外边界（可见折角）同心半径 R ⇒ 折角可见圆角 = art 的 R，带宽恒 W。
        const Ri = R + W;
        const ccgx = qx + (Ri / pitch) * (nix + nox);
        const ccgy = qy + (Ri / pitch) * (niy + noy);
        const ccx = tx(ccgx);
        const ccy = ty(ccgy);
        const b1 = Math.atan2(-(-niy), -nix);
        const b2 = Math.atan2(-(-noy), -nox);
        const inner = arcPoly(ccx, ccy, Ri, b1, b2, 6, false);
        const outer = arcPoly(ccx, ccy, R, b2, b1, 6, false);
        shapes.push({ kind: 'poly', pts: inner.concat(outer) });
      }
    }

    for (let i = 0; i < n; i++) {
      const qx = pts[i * 2]!;
      const qy = pts[i * 2 + 1]!;
      const rx = pts[((i + 1) % n) * 2]!;
      const ry = pts[((i + 1) % n) * 2 + 1]!;
      const px = pts[((i - 1 + n) % n) * 2]!;
      const py = pts[((i - 1 + n) % n) * 2 + 1]!;
      const sx2 = pts[((i + 2) % n) * 2]!;
      const sy2 = pts[((i + 2) % n) * 2 + 1]!;
      const ux = rx - qx;
      const uy = ry - qy;
      const ul = Math.hypot(ux, uy);
      const uxU = ux / ul;
      const uyU = uy / ul;
      const startCross = (qx - px) * uy - (qy - py) * ux; // 起点角凸凹
      const endCross = ux * (sy2 - ry) - uy * (sx2 - rx); // 终点角凸凹
      // 凹角端让出整段折角（Ri = R + W），凸角端由半径 W 的圆盘覆盖。
      const startInset = (startCross < 0 ? R + W : W) / pitch;
      const endInset = (endCross < 0 ? R + W : W) / pitch;
      if (ul - startInset - endInset <= 0.25 / pitch) continue; // 短边：两端圆角已覆盖
      const ax = qx + uxU * startInset;
      const ay = qy + uyU * startInset;
      const bx = rx - uxU * endInset;
      const by = ry - uyU * endInset;
      const nx = uyU; // 外法线（格坐标）
      const ny = -uxU;
      const wx = (nx * W) / pitch;
      const wy = (ny * W) / pitch;
      const p1x = tx(ax);
      const p1y = ty(ay);
      const p2x = tx(bx);
      const p2y = ty(by);
      const p3x = tx(bx + wx);
      const p3y = ty(by + wy);
      const p4x = tx(ax + wx);
      const p4y = ty(ay + wy);
      const xMin = Math.min(p1x, p2x, p3x, p4x);
      const xMax = Math.max(p1x, p2x, p3x, p4x);
      const yMin = Math.min(p1y, p2y, p3y, p4y);
      const yMax = Math.max(p1y, p2y, p3y, p4y);
      shapes.push({ kind: 'rect', x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin });
    }
  }
  return shapes;
}

/**
 * 圆弧多边形（设计空间 y 向上）：从角 a1 扫到 a2 的**短弧**（≤180°）。
 * @param withCenter 附圆心点 ⇒ 扇形；否则只出弧线点（圆环用两段弧拼）
 */
function arcPoly(cx: number, cy: number, r: number, a1: number, a2: number, steps: number, withCenter: boolean): number[] {
  let d = a2 - a1;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const pts: number[] = withCenter ? [cx, cy] : [];
  for (let i = 0; i <= steps; i++) {
    const a = a1 + (d * i) / steps;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}
