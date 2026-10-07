/**
 * **`handdrawn` 手绘有机轮廓（MVP 原型）** —— 2026-10-07 用户树形参考图定调批
 * ─────────────────────────────────────────────────────────────────────────────
 * 目的 = 验证「手绘风格珠子」能否**零改动挂进换肤系统**（`BeadStyle` 契约 + registry
 * append 即玩家可选）。造型四件套（对应参考图珠体，v2.2 = 用户观感二批「不规则四边形」）：
 *  #1 豆体 = **歪四角方豆**（四角 = 单位方四角 + 整数偏移表逐角推拉，每角沿两边切角
 *     ⇒ 8 顶点四边形轮廓；`facet`，fill ≡ `endpointOf().base` ⇒ C12 **强读法**过）；
 *  #2 轮廓线 = stroke-only **同形**多边形（复用 #1 顶点 scratch；`plate` 职能 ⇒
 *     排除出 C12 统计域。⛔ 不走 #1 自描边 = 契约约束① 只准 `stroke === fill`，
 *     深色轮廓必须独立层）；
 *  #3 内环 = stroke-only 圆（`plate` 职能 = 描边，六裁 circle 分支的 stroke-only
 *     表达，⛔ 不引入 `line` 图元）；
 *  #4 真透孔 = 与 `13`/`facet-4` 同源口径（`BEAD_CARD.holeRatio` 真透 + K3 透目标格
 *     `pit`，⛔ 风格内自孔径，K-042）。
 *
 * 实测 **4 命令 / 0 真 α**（v1 = 3 命令；轮廓线 +1，仍省档）。
 *
 * **手绘感的来源纪律**（⛔ 三条红线）：
 *  - 歪斜 = **静态整数偏移表**（造型身份，同 `13` 的「三角枚数恰一枚」地位）⇒
 *    纯函数确定性，不违 L4（无 rng、无 `Math.random`）；⛔ 不得改成逐珠/逐帧随机
 *    （像素封箱与「同一输入必得同一层集」的契约注会碎）；
 *  - 色源 = `endpointOf` 四端点，**零新增 hex**（C3）；
 *  - 全部几何比率住 `tuning.ts`（C4：`HANDDRAWN_FACE_RATIO / _WOBBLE / _OUTLINE_W /
 *    _CHAMFER / _RING_RATIO / _RING_W`），本文件零比率字面量；顶点数 8（四角×切角）、
 *    四角基准与偏移表是**形状**不是系数（整数 ⇒ C4 射程外）。
 *
 * **A5 零重叠账**（v2.3，对 S/2）：角点最大半宽 = FACE + 2×WOBBLE = 0.90；轮廓外沿
 * +OUTLINE_W = 0.95；满抬起 ×1.04 ⇒ 0.988 < 1 ⇒ 静息/抬起两态均不越格（⚠ 小尺寸下
 * `minStroke` 地板可把线宽抬过比例值 ⇒ 外沿最多再 +几分之一 px，盘面/托盘两档实测在
 * 测试 `bead-size-tier` A5 腿兜（顶点代理，描边带不计）；账正本见 `tuning.ts` 注）。
 *
 * 热路径零分配（C2）：层对象、`points` 数组与四角中间表 = 模块级 scratch 原地改写；
 * 本模块无加载期预计算表依赖（四角基准 = 常量表只读）。⛔ L3 禁 cc。
 */
import {
    BEAD_CARD,
    HANDDRAWN_CHAMFER,
    HANDDRAWN_FACE_RATIO,
    HANDDRAWN_OUTLINE_W,
    HANDDRAWN_RING_RATIO,
    HANDDRAWN_RING_W,
    HANDDRAWN_STYLE_ID,
    HANDDRAWN_WOBBLE,
} from '../../config/tuning.js';
import { endpointOf } from '../palette.js';
import type {
    BeadStyle,
    BeadStyleInput,
    BeadStyleLayer,
    WritableBeadCircle,
    WritableBeadPolygon,
} from './contract.js';

/** 顶点数（形状身份 = 四角×每角两点切角，整数 ⇒ C4 射程外）。 */
const VERTS = 8;

/**
 * 四角偏移表（[右上 dx,dy, 右下 dx,dy, 左下 dx,dy, 左上 dx,dy]，±1/0 整数 ×
 * `HANDDRAWN_WOBBLE` ⇒ 每角沿 x/y 独立推拉 = 「不规则四边形」主体来源；
 * 非对称、无简单位周期 = 手绘感；改表 = 改造型身份，须重新过 §6 差分）。
 */
const CORNER_OFFSETS: readonly number[] = [1, -1, -1, 0, 0, 1, 1, 0];

/* 四角基准（单位方，逆时针序；偏移在热路径内叠加，本表只读）。 */
const CORNERS: readonly number[] = [1, 1, 1, -1, -1, -1, -1, 1];

/* ── 模块级 scratch（C2；返回值生命周期 = 本次调用，见 contract 文件头）── */

const PT_BODY: number[] = new Array(VERTS * 2).fill(0);
const PT_CORNER: number[] = new Array(8).fill(0);

const BODY: WritableBeadPolygon = {
    kind: 'polygon',
    role: 'facet',
    points: PT_BODY,
    fill: '',
};

/** #2 轮廓线：stroke-only **同形**多边形（与 #1 共用顶点 scratch ⇒ 同一次调用内
 * 内容恒定，消费方逐层即时拷入 arena，契约「返回值生命周期 = 本次调用」下安全）。
 * fill 空串 = 不填色，与 #3 内环（circle 分支）同一 stroke-only 表达。 */
const OUTLINE: WritableBeadPolygon = {
    kind: 'polygon',
    role: 'plate',
    points: PT_BODY,
    fill: '',
};

/** #3 内环：stroke-only 圆（fill 空串 = 不填色，六裁 circle 分支合法表达）。 */
const RING: WritableBeadCircle = {
    kind: 'circle',
    role: 'plate',
    cx: 0,
    cy: 0,
    r: 0,
    fill: '',
};

const HOLE: WritableBeadCircle = { kind: 'circle', role: 'hole', cx: 0, cy: 0, r: 0, fill: '' };

const LAYERS: readonly BeadStyleLayer[] = Object.freeze([BODY, OUTLINE, RING, HOLE]);

function handdrawnLayers({ inks, colorIdx, targetColorIdx, size }: BeadStyleInput): readonly BeadStyleLayer[] {
    const e = endpointOf(inks, colorIdx);
    const half = size / 2;
    const wob = size * HANDDRAWN_WOBBLE;

    // #1 豆体：歪四角（四角 = 单位方角 × h + 整数偏移 × wob）→ 每边两端各取切角点
    // （ler t = CHAMFER）⇒ 8 顶点。边为直线段 = 参考图「手绘四边形」的硬轮廓，
    // 圆角感由切角提供（v2.1 密采样超椭圆读成齿轮，已废）。
    const h = half * HANDDRAWN_FACE_RATIO;
    const CX = PT_CORNER;
    for (let i = 0; i < 4; i++) {
        CX[i * 2] = CORNERS[i * 2]! * h + CORNER_OFFSETS[i * 2]! * wob;
        CX[i * 2 + 1] = CORNERS[i * 2 + 1]! * h + CORNER_OFFSETS[i * 2 + 1]! * wob;
    }
    const t = HANDDRAWN_CHAMFER;
    for (let i = 0; i < 4; i++) {
        const j = (i + 1) & 3;
        PT_BODY[i * 4] = CX[i * 2]! + (CX[j * 2]! - CX[i * 2]!) * t;
        PT_BODY[i * 4 + 1] = CX[i * 2 + 1]! + (CX[j * 2 + 1]! - CX[i * 2 + 1]!) * t;
        PT_BODY[i * 4 + 2] = CX[j * 2]! + (CX[i * 2]! - CX[j * 2]!) * t;
        PT_BODY[i * 4 + 3] = CX[j * 2 + 1]! + (CX[i * 2 + 1]! - CX[j * 2 + 1]!) * t;
    }
    BODY.fill = e.base;

    // #2 轮廓线：同形 stroke-only，墨 = `edge`（零新增 hex，C3）；地板同内环口径。
    OUTLINE.stroke = e.edge;
    OUTLINE.lineWidth = Math.max(BEAD_CARD.minStroke, Math.round(size * HANDDRAWN_OUTLINE_W));

    // #3 内环：edge 墨描边、线宽 = 比例与地板取大（地板真源 = BEAD_CARD.minStroke）。
    RING.r = half * HANDDRAWN_RING_RATIO;
    RING.stroke = e.edge;
    RING.lineWidth = Math.max(BEAD_CARD.minStroke, Math.round(size * HANDDRAWN_RING_W));

    // #4 真透孔：与 13/facet-4 同源（holeRatio + K3 透目标格 pit，无目标回落本格）。
    HOLE.r = Math.round((size * BEAD_CARD.holeRatio) / 2);
    HOLE.fill = endpointOf(inks, targetColorIdx ?? colorIdx).pit;

    return LAYERS;
}

/** 注册对象（registry append 项；原型档 = 玩家可切但 ⛔ 未过 §12.6 入池评审）。 */
export const HANDDRAWN: BeadStyle = {
    id: HANDDRAWN_STYLE_ID,
    beadLayers: handdrawnLayers,
};
