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
    /**
     * LOD 降档层数（`assets-spec §1.6.4` / `WAVE_BEAD_LOD_LAYERS`、`ZOOM_LOD_LAYERS`）。
     * `undefined` = 满层；传入即「请降到该层数」——**砍哪几层由风格自己定**（渲染侧
     * 只透传、不判语义，控制清单 L5），故本字段是**通道**而不是指令表。
     * ⚠ facet-4 = 6 命令 / 0 真 α，`≤ 7` ⇒ 对本风格**结构性 no-op**（由判据正面钉住
     * 「传 / 不传输出逐字节等值」，⛔ 不静默当不存在）。旧十层的可砍集在 `legacy-ten.ts`。
     */
    readonly lodLayers?: number;
}

/**
 * 珠体图层描述符。字段与 builder 出口逐一对齐（`rect(x,y,w,h,{fill,radius})` /
 * `polygon3(ax,ay,bx,by,cx,cy,{fill})` ADR-0024 / `circle(cx,cy,r,{fill})`），
 * 供 S3 转正时无损回放。
 *
 * ⚠ **`stroke` / `lineWidth` 为 `WXG-T-211-S4`（步 4）新增的可选字段**：`18` 线稿描边的
 * 造型身份就是描边（`assets-spec §7.11.3` 行 2/5 的 `fill + stroke` **同路径**），三态描述符
 * 原本无表达力 ⇒ 不扩字段就落不了正本（要么丢描边、要么改用 `line` 图元叠层，后者会把
 * 已退役的线族以「每层 1 命令」的形态请回盘面、**翻倍命令数**）。两条约束随之定死：
 *  ① 只有 `rect` / `circle` 可带描边（`polygon` 分支不带 ⇒ 刻面必须是一枚枚不透明顶面，
 *     C12 统计域与 J-3 不串形判据的隐含前提）；
 *  ② `fill` 仍为**必填** ⇒ “stroke-only 层”在本契约上**结构不可表达**（§K.5 行 5–8 的
 *     防复活语义因此不从字段上求，改由 `kind` 白名单拦 `line` 图元）。
 * 真 α 计数与命令计数均**不因 stroke 而变**（`§7.11` 读法②；见 `isRealAlphaLayer` 注）。
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
        /** 描边墨（只能由 `palette.ts` 端点 / token 给，⛔ hex 字面量，C3）。 */
        readonly stroke?: string;
        /** 描边宽（设计 px）；⛔ 风格内自算地板，地板真源 = `BEAD_CARD.minStroke` / `LINEART_MIN_STROKE`。 */
        readonly lineWidth?: number;
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
        /** 描边墨（`18` 孔 = `BEAD_SHADOW_HEX`，§7.11.3 行 5）。 */
        readonly stroke?: string;
        /** 描边宽（`18` 孔 = 主体线宽 × `LINEART_HOLE_STROKE_SCALE`）。 */
        readonly lineWidth?: number;
    };

/**
 * 去一层 `readonly` 的**同态映射**（TS 对 `{ -readonly [K in keyof T]: T[K] }` 会自动
 * **沿 union 分配**）⇒ 风格模块可以持有**模块级可变 scratch 层**并在每帧原地改写，
 * 从而满足 `C2` 热路径零分配（本契约不要求 `out` 形参：复用槽由风格自己持有，
 * 因为层的**形状与条数**本来就是风格的静态属性，调用方无从预知尺寸）。
 * ⚠ 只用于 scratch 声明，⛔ 不得拿它去绕过 `BeadStyleLayer` 的只读语义对外暴露可变对象。
 */
type WritableMembers<T> = { -readonly [K in keyof T]: T[K] };

/** 可变底 rect 层（风格模块持有的 scratch 槽位类型）。 */
export type WritableBeadRect = WritableMembers<Extract<BeadStyleLayer, { kind: 'rect' }>>;
/** 可变三角层；`points` 字段本身可变，赋入**模块级可变 6 元组**后可原地写元素（零分配、零 cast）。 */
export type WritableBeadPolygon = WritableMembers<
  Extract<BeadStyleLayer, { kind: 'polygon' }>
>;
/** 可变圆层（孔）。 */
export type WritableBeadCircle = WritableMembers<Extract<BeadStyleLayer, { kind: 'circle' }>>;
/**
 * 可变风格输入槽：渲染侧（`bead-render::drawFilledBead`）逐珠**复用同一对象**写五个字段
 * ⇒ 输入侧也零分配（C2）。⛔ 仅用于模块级复用槽，不得拿它把可变输入暴露给外部。
 */
export type WritableBeadStyleInput = WritableMembers<BeadStyleInput>;

/** 风格模块 = id + 逐 inks 出珠面族图层集（含底衬与孔层，职能由 role 标）。 */
export interface BeadStyle {
    readonly id: string;
    /**
     * 纯函数：同一输入必得同一层集（顺序 = 绘制序，门禁与 C12 认定都依赖它）。
     *
     * ⚠ **热路径复用约定（EP11-S3 / C2）**：本方法**可以**返回模块级复用的数组与层对象
     * （= scratch，`bead-render` 每帧逐珠消费）⇒ 返回值只在**本次调用到下一次调用之间**有效。
     * 消费方必须**当帧逐层读完**（现渲染链与风格池门禁均如此），⛔ **不得跨调用持有引用**；
     * 需留档（测试断言 / 取证快照）⇒ 先深拷贝（`{ ...l, points: [...l.points] }`）。
     * 正面登记：`tests/bead-style-pool.test.ts` 的 `describe('C2 零分配机械锚 …')` 钉住「两次调用返回**同一实例**」
     * （零分配的机械证据；WXG-T-211-S3 补建，⛔ 本注不可在无该判据时重写为「已有钉住」）。
     */
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
 * ⚠ 本函数只看 `alpha` 与 `fill` 两个轴 ⇒ 给一层加 `stroke` **不会**动它的 α 计数
 *   （`18` 实测 5 命令 / 1 真 α 的算术基础就在这条上；反验 = `bead-style-pool.test.ts` 的
 *   `\[lineart-18\] 命令=5 真α=1` 钉值腿）。
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
