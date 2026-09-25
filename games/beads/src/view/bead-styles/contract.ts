/**
 * 风格模块契约（`bead-visual-style-spec §12.2 C1/C4/C7/C12` · ADR-0023 §7 · EP11-S2）
 * ─────────────────────────────────────────────────────────────────────────────
 * 一个「珠体风格」= `id` + **逐 inks 出图层集**的纯函数。本契约是风格池门禁
 * （`tools/scripts/check-bead-style-pool.mjs`，C11）与四棱转正（EP11-S3）的公共地基。
 *
 * ⛔ **L3 禁 cc**：本文件与其实现只准产出**纯数据**（图元描述符），不得 import
 *   `cc`、不得直接触碰 `RenderModelBuilder`——把层集喂给 builder 是 S3 转正时
 *   `bead-render` 一侧的适配职责（层字段与 `polygon3/rect/circle` 入参逐一对齐，
 *   正是为那一步预留的形状）。
 * ⛔ **C3 色源唯一**：层色只能由 `palette.ts` 端点 / `mix()` 派生，禁 hex 字面量。
 *
 * **坐标系**：格心局部系（格心 = 原点）、**y 轴向上**（与 assets-spec / 现码一致）；
 * `size` = 珠体边长 S（调用方决定传 `BEAD_CELL` 还是小豆档值 ⇒ 豆径档正交归 S3/S5）。
 */
import type { BeadInks } from '../palette.js';
import { endpointOf } from '../palette.js';

/**
 * 层职能（C12 统计域的唯一判据来源，§12.2 C12 + epics S2「两条实现硬约束 (a)」）：
 * - `plate` = 底衬 / 描边（§7.11.1 的 #1 暗底 rect，职能 = 描边/底衬）⇒ **排除出珠面族统计域**；
 * - `facet` = 珠面族（刻面 / 对角 / 线稿等主体可见面）⇒ **计入** C12 统计域；
 * - `hole`  = 孔（K3 透色）⇒ **排除出统计域**（且本单不得改孔形态，任务单已裁）。
 */
export type BeadLayerRole = 'plate' | 'facet' | 'hole';

/** 共享输入：风格函数逐 inks 出层集所需的最小上下文（纯数据，无引擎对象）。 */
export interface BeadStyleInput {
    /** 墨水组（`beadInksFor(level)` 预烘焙产物；⛔ 风格内不得重推端点公式，K-042）。 */
    readonly inks: BeadInks;
    /** 本格珠色（1-based，与 `beadColorOf/endpointOf` 同口径）。 */
    readonly colorIdx: number;
    /**
     * 孔透色目标格（K3）；`undefined` ⇒ 按现码 `facetBead` 口径回落本格 `ci`
     * （`styles.mjs::facetBead` 的 `ep(targetIdx ?? ci)`）。
     */
    readonly targetColorIdx?: number;
    /** 珠体边长 S（格心局部系）。 */
    readonly size: number;
}

/**
 * 珠体图层描述符。字段与 builder 出口逐一对齐（`rect(x,y,w,h,{fill,radius})` /
 * `polygon3(ax,ay,bx,by,cx,cy,{fill})` ADR-0024 / `circle(cx,cy,r,{fill})`），
 * 供 S3 转正时无损回放。
 */
export type BeadStyleLayer =
    | {
        readonly kind: 'rect';
        readonly role: BeadLayerRole;
        readonly x: number;
        readonly y: number;
        readonly w: number;
        readonly h: number;
        readonly fill: string;
        readonly radius?: number;
        readonly alpha?: number;
    }
    | {
        /** 三角形专用（本单四棱 = polygon3 消费方）：恰 6 元扁平数组。 */
        readonly kind: 'polygon';
        readonly role: BeadLayerRole;
        readonly points: readonly [number, number, number, number, number, number];
        readonly fill: string;
        readonly alpha?: number;
    }
    | {
        readonly kind: 'circle';
        readonly role: BeadLayerRole;
        /** 圆（格心局部系圆心即本层 cx/cy）。 */
        readonly cx: number;
        readonly cy: number;
        readonly r: number;
        readonly fill: string;
        readonly alpha?: number;
    };

/** 风格模块 = id + 逐 inks 出珠面族图层集（含底衬与孔层，职能由 role 标）。 */
export interface BeadStyle {
    readonly id: string;
    /** 纯函数：同一输入必得同一层集（顺序 = 绘制序，门禁与 C12 认定都依赖它）。 */
    readonly beadLayers: (input: BeadStyleInput) => readonly BeadStyleLayer[];
}

/**
 * **真 α 判据（与 assets-spec `§1.9.7 7.11 取证链` 的 `probe()` 计数式同式，C7 口径）**：
 * `alpha < 1` **∨** `fill` 以 `rgba` 开头 —— 两支缺一不可（正本字面）。
 * ⚠ 本契约层集惯用显式 `alpha` 字段，但风格模块**可以**只给 `rgba(...)` 串而不填
 * `alpha`（= spike / `styles.mjs` 写法）⇒ 只实现第一支会把这类层误计为 0 α
 * = 静默放行（C11 禁止项）。反例臂 `fixture-5cmd-3alpha` 把一枚 `plate` rect 的
 * `fill` 写成 `rgba(...)` 且不带 `alpha` 字段，以此钉住第二支
 * （漏计 ⇒ 实测 α = 2 不触门 ⇒ TC-STY-08 臂 2 必红）。
 * stroke 不计 α、`fill+stroke` 同路径仍只算 1 命令（7.11 读法②）。
 */
export function isRealAlphaLayer(layer: BeadStyleLayer): boolean {
    return (
        (layer.alpha ?? 1) < 1 || layer.fill.slice(0, 4).toLowerCase() === 'rgba'
    );
}

/** 端点四色集（C12「本格 base 同族」的唯一真源 = palette 端点表，⛔ 不得另列成员清单）。 */
export function endpointFamily(inks: BeadInks, colorIdx: number): readonly string[] {
    const e = endpointOf(inks, colorIdx);
    return [e.base, e.lit, e.edge, e.pit];
}
