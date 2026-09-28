/**
 * **复刻·四棱刻面（facet-4）** —— §12.9 步 3 转正后的**默认珠体风格**
 * （`bead-visual-style-spec §12.2 C1/C2/C6/C7/C12` · `assets-spec §7.11.1` 甲口径层集）
 * ─────────────────────────────────────────────────────────────────────────────
 * 层集 = §7.11.1 行 1–5 + 孔行（**六裁拆二：孔环 + 孔底**），**7 命令 / 0 真 α**
 * （旧 6 命令基线属 WXG-T-221 六裁前；C7 双指标余量 **0 命令** / 2 α，压线登记见 LAYERS 注）。
 * 本文件从 `registry.ts` 的内联定义**提出为独立模块**（转正 = 渲染链开始消费它），
 * 并落 S2 就登记的两处待纠正项（`§7.11.1` 行 6 + `§7.11.6` 读法③ + S2 偏差登记）：
 *
 *  1. **孔底 = 目标格 `pit`（K3 透色）** —— S2 照抄 spike 的 `base` 口径，随十层乙口径**双孔**
 *     一起退役；用户 2026-09-26 裁定「孔 = 甲口径（单孔 `circle`，孔底透目标色）」。
 *  2. **孔半径（真透）= `size × BEAD_CARD.holeRatio / 2`** —— `§7.11.6` 读法③明写
 *     「落码以 `holeRatio` 为准」；孔径唯一真源 = 卡（⛔ 风格内不得自算孔径）。
 *     **六裁（2026-09-28）真透制 + 七裁回定 0.44（派生值取整 dp）**（四裁 0.538 外缘制已被更正，
 *     视觉等值，沿革见 `tuning.ts::BEAD_CARD.holeRatio` 注）。
 *
 * **圆角扇几何（WXG-T-218，2026-09-27 用户拍板「多点 polygon 逼近弧线 + 边缘描边 1dp」）**：
 * 四向刻面从旧版三角升级为**圆角扇形**（每向 1 枚 polygon，格心 + 两段 45° 圆角弧的
 * `FACET4_ARC_STEP_DEG` 采样边界）⇒ 刻面在边中段与四角**铺满**圆角矩形；外轮廓描边 =
 * `plate` 暗底在扇形外缘（内缩 `FACET4_EDGE_INSET_PX = 1dp`）露出的整圈环。相邻扇形
 * 共享对角射线的 AA 发丝缝由**同色自描边**（`FACET4_SEAM_STROKE_PX`，契约约束 ①）封住。
 * 命令数不变（每向仍 1 命令）⇒ C7 双门禁不破；层流值变 ⇒ seal 基准随批重封。
 *
 * **热路径零分配（C2 / ADR-0024 值语义）**：层对象与 `points` 数组都是**模块级 scratch**，
 * 每帧原地改写 ⇒ 每珠每帧零层集分配。消费方（`bead-render`）当帧逐层回放，
 * ⛔ 不得跨调用持有返回数组（`contract.ts::BeadStyle.beadLayers` 已把该约定写进契约）。
 *
 * ⛔ **L3 禁 cc**、⛔ **C3 色源唯一**（只走 `palette.ts` 端点 / `mix()`）、
 * ⛔ **C4 零裸系数**（几何与 mix 档全部经 `tuning.ts` 命名常量注入；机械锚 =
 *   `tests/bead-style-pool.test.ts` 的「C4 裸系数扫描」判据）。本文件**零字面量系数、零 hex**。
 */
import {
  BEAD_CARD,
  FACET4_ARC_STEP_DEG,
  FACET4_EDGE_INSET_PX,
  FACET4_FACET_RIGHT_MIX,
  FACET4_PLATE_MIX,
  FACET4_SEAM_STROKE_PX,
  FACET4_STYLE_ID,
} from '../../config/tuning.js';
import { endpointOf, mix } from '../palette.js';
import type {
  BeadStyle,
  BeadStyleInput,
  BeadStyleLayer,
  WritableBeadCircle,
  WritableBeadPolygon,
  WritableBeadRect,
} from './contract.js';

/* ── 模块级 scratch：形状与条数是风格的静态属性 ⇒ 逐帧原地改写，不新建（C2）。 ── */

/**
 * 每向扇形顶点数 = **格心 1 + 边界 7**（两段 45° 圆角弧、`FACET4_ARC_STEP_DEG = 15°`
 * 步长：4 + 3 个采样点，弧端 = 对角 45° 分界射线）。四向同构 ⇒ 定长 16 float scratch。
 */
const FAN_FLOATS = 16;

const PT_TOP: number[] = new Array<number>(FAN_FLOATS).fill(0);
const PT_LEFT: number[] = new Array<number>(FAN_FLOATS).fill(0);
const PT_RIGHT: number[] = new Array<number>(FAN_FLOATS).fill(0);
const PT_BOTTOM: number[] = new Array<number>(FAN_FLOATS).fill(0);

const PLATE: WritableBeadRect = {
  kind: 'rect',
  role: 'plate',
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  fill: '',
  radius: 0,
};

const FACET_TOP: WritableBeadPolygon = { kind: 'polygon', role: 'facet', points: PT_TOP, fill: '' };
const FACET_LEFT: WritableBeadPolygon = { kind: 'polygon', role: 'facet', points: PT_LEFT, fill: '' };
const FACET_RIGHT: WritableBeadPolygon = { kind: 'polygon', role: 'facet', points: PT_RIGHT, fill: '' };
const FACET_BOTTOM: WritableBeadPolygon = { kind: 'polygon', role: 'facet', points: PT_BOTTOM, fill: '' };
const HOLE_RING: WritableBeadCircle = { kind: 'circle', role: 'hole', cx: 0, cy: 0, r: 0 };
const HOLE: WritableBeadCircle = { kind: 'circle', role: 'hole', cx: 0, cy: 0, r: 0, fill: '' };

/**
 * 层集本体（**冻结的是数组本身、不是元素** ⇒ 长度与顺序不可被改写，字段仍可原地写）。
 * 数组序 = 绘制序：#1 底 → #2 上 → #3 左 → #4 右 → #5 下 → #6 孔环 → #7 孔底。
 * ⚠ **WXG-T-221 六裁（2026-09-28）**：旧 #6 单命令 `fill+stroke` 拆为两枚同心圆
 * （环描边圆先画、pit 孔底圆后画 ⇒ pit 盖住环内侧半宽，露出 1dp 墨环）。
 * 命令数 6 → **7 = 上限 `BEAD_STYLE_MAX_COMMANDS` 压线、余量 0**（C7/C11 登记随之改）；
 * 真 α 仍 0；⚠ LOD 通道 `≤ 7` 对本风格 no-op 的前提换为「满层恒 7」。
 */
const LAYERS: readonly BeadStyleLayer[] = Object.freeze([
  PLATE,
  FACET_TOP,
  FACET_LEFT,
  FACET_RIGHT,
  FACET_BOTTOM,
  HOLE_RING,
  HOLE,
]);

/**
 * 把一枚圆角扇的顶点写入 scratch：`[格心, 边界 b0..b6]`。
 * 边界 = 从对角分界角 `startDeg` 起、沿圆角矩形外缘（内缩 `FACET4_EDGE_INSET_PX`）走 90°：
 * 前 4 个采样点落在**第一枚圆角**（`c1`），后 3 个落在第二枚（`c2`）——中段直边由
 * 多边形闭合边承担（两端点已在采样序列里）。
 * 角向约定（y-up，θ 自 +x 轴逆时针）：TOP `135°→45°`、RIGHT `45°→−45°`、
 * BOTTOM `−45°→−135°`、LEFT `−135°→−225°`，四向共用「递减 `ARC_STEP`」一条游标。
 */
function writeFan(
  pts: number[],
  c1x: number,
  c1y: number,
  c2x: number,
  c2y: number,
  startDeg: number,
  rc: number,
): void {
  pts[0] = 0;
  pts[1] = 0;
  let w = 2;
  for (let i = 0; i < 7; i++) {
    const th = ((startDeg - i * FACET4_ARC_STEP_DEG) * Math.PI) / 180;
    const cx = i < 4 ? c1x : c2x;
    const cy = i < 4 ? c1y : c2y;
    pts[w++] = cx + rc * Math.cos(th);
    pts[w++] = cy + rc * Math.sin(th);
  }
}

/**
 * 逐 inks 出层集（纯函数：同一输入 ⇒ 同一输出**值**；返回的是复用槽，见文件头约定）。
 *
 * 几何（y-up）：外轮廓半宽 `e = S/2 − EDGE_INSET`、圆角半径 `rc = round(0.30S) − EDGE_INSET`、
 * 圆心偏 `a = e − rc`；四枚扇形由对角 45° 射线分界（J-3「四枚共点于格心」由 scratch 首顶点
 * 结构性保证）。墨序 = 上 `lit` → 左 `base` → 右 `mix(base, −0.16)` → 下 `edge`
 * （「上亮→左本→右中暗→下暗」，§7.11.1 的凸感载体；受光左上，与 §6 光向一致）。
 */
function facet4Layers({
  inks,
  colorIdx,
  targetColorIdx,
  size,
}: BeadStyleInput): readonly BeadStyleLayer[] {
  const e = endpointOf(inks, colorIdx);
  const h = size / 2;

  // #1 底 rect（`plate` 职能 = 暗底兼描边 ⇒ 排除出 C12 统计域）。radius 与十层同源：
  // `round(0.30S)` = `BEAD_CARD.radius`（§1.1 K1），⛔ 不在风格内重算圆角（K-042）。
  //
  // ⚠ **WXG-T-214（2026-09-26 用户拍板）轮廓可读性**：四棱无阴影层 ⇒ `plate` 取「坑底」
  // 同档深墨（`FACET4_PLATE_MIX −0.44`）⇒ 环与底图恒差两档（CR ≈ 1.7–1.8）。
  // WXG-T-218 起它的可见部分 = 扇形外缘 1dp 环（描边职能的承载体，见文件头注）。
  PLATE.x = -h;
  PLATE.y = -h;
  PLATE.w = size;
  PLATE.h = size;
  PLATE.fill = mix(e.base, FACET4_PLATE_MIX);
  PLATE.radius = Math.round(size * BEAD_CARD.radius);

  // 圆角扇几何参量（见函数头注）：rc 钳 0 防极小尺寸负半径（退化 = 方角，扇形仍闭合）。
  const rc = Math.max(Math.round(size * BEAD_CARD.radius) - FACET4_EDGE_INSET_PX, 0);
  const a = h - FACET4_EDGE_INSET_PX - rc;

  // 四向扇形边界（角向约定见 writeFan 注）：圆心序 = 先走到的那枚圆角。
  writeFan(PT_TOP, -a, a, a, a, 135, rc);
  writeFan(PT_LEFT, -a, -a, -a, a, -135, rc);
  writeFan(PT_RIGHT, a, a, a, -a, 45, rc);
  writeFan(PT_BOTTOM, a, -a, -a, -a, -45, rc);

  // #2–#5 墨序（§7.11.1）+ 同色自描边封对角 AA 缝（契约约束 ①：stroke === fill）。
  FACET_TOP.fill = e.lit;
  FACET_LEFT.fill = e.base;
  FACET_RIGHT.fill = mix(e.base, FACET4_FACET_RIGHT_MIX);
  FACET_BOTTOM.fill = e.edge;
  for (const f of [FACET_TOP, FACET_LEFT, FACET_RIGHT, FACET_BOTTOM]) {
    f.stroke = f.fill;
    f.lineWidth = FACET4_SEAM_STROKE_PX;
  }

  // #6/#7 单孔（甲口径，K3；**六裁真透制**，用户 2026-09-28：「孔径 = 真透的区域」）：
  // `r真透 = holeRatio/2 · S`（唯一真源 = `BEAD_CARD.holeRatio 0.44`，七裁定值，派生后取整）；孔底 = **目标格 `pit`**
  // （通孔物理上透下去看见该格目标色）；无目标色（托盘珠）⇒ 按契约 `targetColorIdx ?? colorIdx`
  // 回落本格 `pit`（仍是端点表内色，C3 零新色）。
  // ⚠ **孔径取整（用户 2026-09-26 拍板：「孔径为整数、2 的倍数 px」）+ 真透制（六裁更正四裁外缘制）**：
  // 取整对象 = **真透半径** ⇒ 真透恒偶（J4）；外缘 = 真透 + 2×1dp 同偶。恒等档珠面 26：
  // 真透 ⌀12（0.44×26/2 = 5.72 → round 6，+4.9% 取整偏已由用户七裁接受）/ 外缘 ⌀14；小豆档 / zoom 各档同样保证偶数。孔边线墨环**外扩吃珠面**
  //（描边中心线 = 真透 r + 边线宽）⇒ 与四裁外缘制视觉逐 texel 等值，六裁 = 语义回正、七裁 = 定值，皆非恒等档观感变更。
  const holeR = Math.round((size * BEAD_CARD.holeRatio) / 2);
  const holeLw = BEAD_CARD.holeStrokeWidthPx;
  HOLE.r = holeR;
  HOLE.fill = endpointOf(inks, targetColorIdx ?? colorIdx).pit;
  HOLE.stroke = undefined;
  HOLE.lineWidth = undefined;
  // 孔环（B14 必选层；用户 2026-09-28 三裁：**族墨随 base** = `mix(base, −0.58)` 端点 `hole`，
  // 推翻旧恒定阴影墨；宽 = 1dp 绝对，与 plate 外框同宽不吃地板）。六裁后以 stroke-only 圆表达
  //（契约 circle 分支 `fill?` 同批放开），画在孔底之前 ⇒ pit 盖住内半宽，成环 [r, r+lw]。
  HOLE_RING.r = holeR + holeLw;
  HOLE_RING.stroke = e.hole;
  HOLE_RING.lineWidth = holeLw;

  return LAYERS;
}

/** 注册对象（`registry.ts` 的注册项，也是 `bead-render` 默认消费的层集来源）。 */
export const FACET4: BeadStyle = {
  id: FACET4_STYLE_ID,
  beadLayers: facet4Layers,
};
