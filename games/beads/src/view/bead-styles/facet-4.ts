/**
 * **复刻·四棱刻面（facet-4）** —— §12.9 步 3 转正后的**默认珠体风格**
 * （`bead-visual-style-spec §12.2 C1/C2/C6/C7/C12` · `assets-spec §7.11.1` 甲口径层集）
 * ─────────────────────────────────────────────────────────────────────────────
 * 层集 = §7.11.1 行 1–6，**6 命令 / 0 真 α**（= `§12.6` 基线值，C7 双指标余量 1 命令 / 2 α）。
 * 本文件从 `registry.ts` 的内联定义**提出为独立模块**（转正 = 渲染链开始消费它），
 * 并落 S2 就登记的两处待纠正项（`§7.11.1` 行 6 + `§7.11.6` 读法③ + S2 偏差登记）：
 *
 *  1. **孔底 = 目标格 `pit`（K3 透色）** —— S2 照抄 spike 的 `base` 口径，随十层乙口径**双孔**
 *     一起退役；用户 2026-09-26 裁定「孔 = 甲口径（单孔 `circle`，孔底透目标色）」。
 *     ⇒ 本项 + 下一条半径纠正 = **本单唯一被允许的视觉变更源**
 *     （十层 → 四棱的整体换肤是转正的既定后果，观感归 Playtest `[待真机]`）。
 *  2. **孔半径 = `size × BEAD_CARD.holeRatio / 2`（= 0.22S）** —— `§7.11.6` 读法③明写
 *     「落码以 `holeRatio 0.44` 为准」，spike 的 `0.17S` 偏小 23%；旧常量
 *     `FACET4_HOLE_RADIUS` 已随本批删除（孔径唯一真源 = 卡，⛔ 风格内不得自孔径）。
 *
 * **热路径零分配（C2 / ADR-0024 值语义）**：层对象与 `points` 元组都是**模块级 scratch**，
 * 每帧原地改写 ⇒ 每珠每帧零层集分配。消费方（`bead-render`）当帧逐层回放，
 * ⛔ 不得跨调用持有返回数组（`contract.ts::BeadStyle.beadLayers` 已把该约定写进契约）。
 *
 * ⛔ **L3 禁 cc**、⛔ **C3 色源唯一**（只走 `palette.ts` 端点 / `mix()`）、
 * ⛔ **C4 零裸系数**（几何与 mix 档全部经 `tuning.ts` 命名常量注入；机械锚 =
 *   `tests/bead-style-pool.test.ts` 的「C4 裸系数扫描」判据）。本文件**零字面量系数、零 hex**。
 */
import {
  BEAD_CARD,
  FACET4_FACET_INSET,
  FACET4_FACET_RIGHT_MIX,
  FACET4_PLATE_MIX,
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

/** 三角顶点组（写入 scratch 的 `points`；可变元组可赋给契约里的 `readonly` 元组 ⇒ 零 cast）。 */
type FacetPoints = [number, number, number, number, number, number];

/* ── 模块级 scratch：形状与条数是风格的静态属性 ⇒ 逐帧原地改写，不新建（C2）。 ── */

const PT_TOP: FacetPoints = [0, 0, 0, 0, 0, 0];
const PT_LEFT: FacetPoints = [0, 0, 0, 0, 0, 0];
const PT_RIGHT: FacetPoints = [0, 0, 0, 0, 0, 0];
const PT_BOTTOM: FacetPoints = [0, 0, 0, 0, 0, 0];

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
const HOLE: WritableBeadCircle = { kind: 'circle', role: 'hole', cx: 0, cy: 0, r: 0, fill: '' };

/**
 * 层集本体（**冻结的是数组本身、不是元素** ⇒ 长度与顺序不可被改写，字段仍可原地写）。
 * 数组序 = 绘制序：#1 底 → #2 上 → #3 左 → #4 右 → #5 下 → #6 孔。
 */
const LAYERS: readonly BeadStyleLayer[] = Object.freeze([
  PLATE,
  FACET_TOP,
  FACET_LEFT,
  FACET_RIGHT,
  FACET_BOTTOM,
  HOLE,
]);

/**
 * 逐 inks 出层集（纯函数：同一输入 ⇒ 同一输出**值**；返回的是复用槽，见文件头约定）。
 *
 * 与 spike `styles.mjs::facetBead` 同式：三角形 = (角A, 角B, 格心)，格心局部系原点 ⇒ 第三顶点
 * 恒 `(0, 0)`；四角内缩 `i2 = FACET4_FACET_INSET × S`。
 */
function facet4Layers({
  inks,
  colorIdx,
  targetColorIdx,
  size,
}: BeadStyleInput): readonly BeadStyleLayer[] {
  const e = endpointOf(inks, colorIdx);
  const h = size / 2;
  const i2 = size * FACET4_FACET_INSET;
  const l = -h + i2; // 内缩后的左/下缘
  const r = h - i2; // 内缩后的右/上缘

  // #1 底 rect（`plate` 职能 = 暗底兼描边 ⇒ 排除出 C12 统计域）。radius 与十层同源：
  // `round(0.30S)` = `BEAD_CARD.radius`（§1.1 K1），⛔ 不在风格内重算圆角（K-042）。
  //
  // ⚠ **WXG-T-214（2026-09-26 用户拍板）轮廓可读性**：四棱无阴影层 ⇒ 珠的**下 / 右刻面**
  // 墨 = `edge`，与 B0 目标底图（同为 `edge`）**逐字同色（CR 1.00）**；正确落位时珠的下半圈
  // 整个溶进底色，只剩上/左两个刻面在承载轮廓。修法 = **加深本行**（`plate` 的职能本就是
  // 「暗底兼描边」，§7.11.1）⇒ 见 `tuning.FACET4_PLATE_MIX` 注。
  // ⛔ **不走 `stroke`**：`KIND_POLICY['facet-4'].allowStroke = false`（倒角线族退役的负向
  // 防复活门，`tests/bead-style-ledger.test.ts` §K.5 行 5–8 + 变异臂），加描边层当场判红。
  PLATE.x = -h;
  PLATE.y = -h;
  PLATE.w = size;
  PLATE.h = size;
  PLATE.fill = mix(e.base, FACET4_PLATE_MIX);
  PLATE.radius = Math.round(size * BEAD_CARD.radius);

  // #2–#5 四枚三角刻面。墨序 = 上 `lit` → 左 `base` → 右 `mix(base, −0.16)` → 下 `edge`
  //（“上亮→左本→右中暗→下暗”，§7.11.1 的凸感载体；受光左上，与 §6 光向一致）。
  PT_TOP[0] = l;
  PT_TOP[1] = r;
  PT_TOP[2] = r;
  PT_TOP[3] = r;
  FACET_TOP.fill = e.lit;

  PT_LEFT[0] = l;
  PT_LEFT[1] = l;
  PT_LEFT[2] = l;
  PT_LEFT[3] = r;
  FACET_LEFT.fill = e.base;

  PT_RIGHT[0] = r;
  PT_RIGHT[1] = r;
  PT_RIGHT[2] = r;
  PT_RIGHT[3] = l;
  FACET_RIGHT.fill = mix(e.base, FACET4_FACET_RIGHT_MIX);

  PT_BOTTOM[0] = r;
  PT_BOTTOM[1] = l;
  PT_BOTTOM[2] = l;
  PT_BOTTOM[3] = l;
  FACET_BOTTOM.fill = e.edge;
  // 第三顶点恒 = 格心（局部系原点）：四枚共用 `(0, 0)`，初始化即 (0,0) 且**永不改写**
  // ⇒ 「四枚共点于格心」这一几何不变式由代码结构本身保证（判据 J-3 的正面依据）。

  // #6 单孔（甲口径，K3）：`r = 0.22S`（唯一真源 = `BEAD_CARD.holeRatio`）、
  // 孔底 = **目标格 `pit`**（通孔物理上透下去看见该格目标色）；无目标色（托盘珠）
  // ⇒ 按契约 `targetColorIdx ?? colorIdx` 回落本格 `pit`（仍是端点表内色，C3 零新色）。
  // ⚠ **孔径取整（用户 2026-09-26 拍板：「孔径为整数、2 的倍数 px」）**：
  // 半径取整 ⇒ **直径恒为偶数设计 px**；真源仍是 `BEAD_CARD.holeRatio 0.44`（Midi 实物真比），
  // 本行只在派生末端做一次量化 ⇒ 恒等档珠面 26：⌀11.44 → **12 设计 px（6 CSS px）**，
  // 小豆档 / zoom 各档同样保证偶数（⌀ 不会出现 11.44 这种半像素值）。
  HOLE.r = Math.round((size * BEAD_CARD.holeRatio) / 2);
  HOLE.fill = endpointOf(inks, targetColorIdx ?? colorIdx).pit;

  return LAYERS;
}

/** 注册对象（`registry.ts` 的注册项，也是 `bead-render` 默认消费的层集来源）。 */
export const FACET4: BeadStyle = {
  id: FACET4_STYLE_ID,
  beadLayers: facet4Layers,
};
