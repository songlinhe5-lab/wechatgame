/**
 * **`diagonal-facet` 对角四棱（方案 D）** —— 2026-11-17 用户定稿
 * ─────────────────────────────────────────────────────────────────────────────
 * 诉求 = 「用经典四棱的绘制方式实现双色对角的效果（实际是两个面的高亮差异）」。
 * 即沿用 `facet-4.ts` 的**圆角扇几何 + 同色封缝 + 外轮廓环 + 孔环孔底**全套工艺，
 * 但把四档明暗**塌成对角两档**：沿 ↗/↙ 对角线把珠面分两半，各半的两枚扇同墨。
 *
 * 层集 = 7 命令 / 0 真 α（与 `facet-4` 同构，命令数不变，C7 上限压线不破）：
 *   #1 暗底 rect（外轮廓环，mix(base, FACET4_PLATE_MIX)）
 *   #2–#5 四枚圆角扇：左上两扇（`lit`）/ 右下两扇（`pit`）——**对角两档高亮差异**
 *   #6 孔环（stroke-only）/ #7 孔底（目标格 pit）
 *
 * 墨序（y-up，收光左上）：TOP/LEFT 扇 = `lit`(+0.38)，RIGHT/BOTTOM 扇 = `pit`(−0.44)。
 *   ⇒ 左上亮、右下暗，读作一颗沿对角线劈开的四棱珠；比原 `dual-tone-13` 的
 *   「亮底 rect + 直角三角」多出圆角、封缝、轮廓环与孔环，硬纸片感消失。
 *
 * ⛔ 纪律（与 `facet-4.ts` 同源）：
 *  - C3 色源唯一：只走 `endpointOf` / `mix`，零 hex；
 *  - C4 零裸系数：几何比率全部复用 `facet-4` 同名常量，本文件零比率字面量；
 *  - C2 热路径零分配：层对象与 `points` 数组 = 模块级 scratch，逐帧原地改写；
 *  - L3 禁 cc；`writeFan` 从 `facet-4.ts` 复用（唯一几何真源，不另写弧采样）。
 */
import {
  BEAD_CARD,
  DIAGONAL_FACET_STYLE_ID,
  FACET4_EDGE_INSET_PX,
  FACET4_PLATE_MIX,
  FACET4_SEAM_STROKE_PX,
} from '../../config/tuning';
import { endpointOf, mix } from '../palette';
import { writeFan } from './facet-4';
import type {
  BeadStyle,
  BeadStyleInput,
  BeadStyleLayer,
  WritableBeadCircle,
  WritableBeadPolygon,
  WritableBeadRect,
} from './contract';

/* ── 模块级 scratch（C2）：格心 + 7 边界点，四向同构 ⇒ 定长 16 float。 ── */
const FAN_FLOATS = 16;
const PT_TOP: number[] = new Array<number>(FAN_FLOATS).fill(0);
const PT_LEFT: number[] = new Array<number>(FAN_FLOATS).fill(0);
const PT_RIGHT: number[] = new Array<number>(FAN_FLOATS).fill(0);
const PT_BOTTOM: number[] = new Array<number>(FAN_FLOATS).fill(0);

const PLATE: WritableBeadRect = {
  kind: 'rect', role: 'plate', x: 0, y: 0, w: 0, h: 0, fill: '', radius: 0,
};
const FACET_TOP: WritableBeadPolygon = { kind: 'polygon', role: 'facet', points: PT_TOP, fill: '' };
const FACET_LEFT: WritableBeadPolygon = { kind: 'polygon', role: 'facet', points: PT_LEFT, fill: '' };
const FACET_RIGHT: WritableBeadPolygon = { kind: 'polygon', role: 'facet', points: PT_RIGHT, fill: '' };
const FACET_BOTTOM: WritableBeadPolygon = { kind: 'polygon', role: 'facet', points: PT_BOTTOM, fill: '' };
const HOLE_RING: WritableBeadCircle = { kind: 'circle', role: 'hole', cx: 0, cy: 0, r: 0 };
const HOLE: WritableBeadCircle = { kind: 'circle', role: 'hole', cx: 0, cy: 0, r: 0, fill: '' };

/** 冻结的是数组本身、不是元素 ⇒ 长度与顺序不可变，字段逐帧原地写。绘制序同 `facet-4`。 */
const LAYERS: readonly BeadStyleLayer[] = Object.freeze([
  PLATE, FACET_TOP, FACET_LEFT, FACET_RIGHT, FACET_BOTTOM, HOLE_RING, HOLE,
]);

function diagonalFacetLayers({
  inks, colorIdx, targetColorIdx, size,
}: BeadStyleInput): readonly BeadStyleLayer[] {
  const e = endpointOf(inks, colorIdx);
  const h = size / 2;

  // #1 暗底 rect（外轮廓环）——与四棱同源。
  PLATE.x = -h;
  PLATE.y = -h;
  PLATE.w = size;
  PLATE.h = size;
  PLATE.fill = mix(e.base, FACET4_PLATE_MIX);
  PLATE.radius = Math.round(size * BEAD_CARD.radius);

  // 圆角扇几何参量（writeFan 唯一真源在 facet-4.ts）。
  const rc = Math.max(Math.round(size * BEAD_CARD.radius) - FACET4_EDGE_INSET_PX, 0);
  const a = h - FACET4_EDGE_INSET_PX - rc;
  writeFan(PT_TOP, -a, a, a, a, 135, rc);
  writeFan(PT_LEFT, -a, -a, -a, a, -135, rc);
  writeFan(PT_RIGHT, a, a, a, -a, 45, rc);
  writeFan(PT_BOTTOM, a, -a, -a, -a, -45, rc);

  // #2–#5 对角两档：左上 lit / 右下 pit；同色自描边封对角 AA 缝（契约约束 ①）。
  FACET_TOP.fill = e.lit;
  FACET_LEFT.fill = e.lit;
  FACET_RIGHT.fill = e.pit;
  FACET_BOTTOM.fill = e.pit;
  for (const f of [FACET_TOP, FACET_LEFT, FACET_RIGHT, FACET_BOTTOM]) {
    f.stroke = f.fill;
    f.lineWidth = FACET4_SEAM_STROKE_PX;
  }

  // #6/#7 单孔（六裁真透制 + 七裁定值，与四棱 / 13 同源）。
  const holeR = Math.round((size * BEAD_CARD.holeRatio) / 2);
  const holeLw = BEAD_CARD.holeStrokeWidthPx;
  HOLE.r = holeR;
  HOLE.fill = endpointOf(inks, targetColorIdx ?? colorIdx).pit;
  HOLE.stroke = undefined;
  HOLE.lineWidth = undefined;
  HOLE_RING.r = holeR + holeLw;
  HOLE_RING.stroke = e.hole;
  HOLE_RING.lineWidth = holeLw;

  return LAYERS;
}

/** 注册对象（registry append 项；玩家可切）。 */
export const DIAGONAL_FACET: BeadStyle = {
  id: DIAGONAL_FACET_STYLE_ID,
  beadLayers: diagonalFacetLayers,
};
