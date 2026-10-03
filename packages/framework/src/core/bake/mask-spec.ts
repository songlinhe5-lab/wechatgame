/**
 * `[WXG-T-226 EP12-S1 / ADR-0029 DEC-3 · DEC-6 · DEC-4]` tint mask 规格 —— 定稿口径的 **spec 化载体**。
 *
 * ## 单一真源纪律（DEC-3「⛔ 禁止手写第二份系数」）
 *
 * - **口径正本 = 定稿 py**：`tools/mask-preview/export-cocos-textures.py`（有孔 v1.1）/
 *   `…-holeless.py`（无孔 v1.0-holeless）的**冻结口径块**。本文件是它的 **TS 侧 spec 化实现**
 *   （**只换载体、不改数值**）；py 仍是资产产出源（DEC-3 丙·渐进第 ① 步）。
 * - **层集真源 = capture 产物**：`tools/mask-preview/layers.json`（有孔）/
 *   `layers-holeless.json`（无孔）由 `capture-layers.mjs` 生成，**⛔ 不手改**。本文件内嵌的
 *   `beadLayers` 是它的快照，由 `mask-spec.test.ts` **逐字段对拍**（单测红即层集漂移）。
 * - **防漂移 = `mask:diff`**：`tools/mask-preview/mask-diff.mjs` 对拍 py 产物 vs 本 spec 的场计算输出。
 *   DEC-3 原文：「对拍绿之前 TS 不得成为唯一真源」。
 *
 * ## 编码（DEC-6，承 ADR-0028 §2.1，**不得改**）
 *
 * `R = d`（暗系数）/ `G = l`（亮系数）/ `B = 形状 α` / `A = 255`（满幅，免疫 SpriteFrame Trim）。
 * 合成式（唯一）：`rgb = base·d + (1−base)·l`、`a = B/255`，**预乘 α**（由消费侧做）。
 *
 * ## L2 合规
 *
 * 本模块是**纯数据 + 纯数学**（无 `cc` / DOM / `wx` / `window` / `document`），
 * 且不 import 任何游戏模块（`core/**` 不许反向依赖 `games/**`）。
 */

/** 面种：`bead` = 珠面 · `cell` = 格面（空格凹槽 + 格外）。 */
export type BeadMaskKind = 'bead' | 'cell';

/** 档位：`holed` = 满豆有孔（26dp / 真透 ⌀12）· `holeless` = 小豆无孔（24dp）。 */
export type BeadMaskGauge = 'holed' | 'holeless';

/**
 * `[EP12-S7]` mask 侧独立的失效号。**⛔ 不与 `BAKE_SCHEMA_VERSION` 合并**：
 * 位图 key 含 `colorIdx`、mask key 不含 ⇒ 两套失效纪律混在一个号上必然互相牵连
 * （ADR-0028 §4「⛔ 拆成三次 bump 三次重烘」）。
 */
export const MASK_SCHEMA_VERSION = 1;

/**
 * 烘焙档位（px）。**128 = 定稿 py 的 `OUT`**（`BAKE_CANONICAL_SIZE` 也是 128，两处同值，
 * 由 `bead-render` 侧单测钉住，见 `games/beads/tests/bead-tint-arm.test.ts`）。
 *
 * ⚠ DEC-4：`zoom > LOD 回矢量阈值` 时必须回退矢量臂 ⇒ **⛔ 运行时不得放大**（`control-manifest §19`）。
 * 阈值 `[待真机]`：本批只落「回退机制存在 + 阈值可配」，**不落数值**。
 */
export const MASK_CANONICAL_SIZE = 128;

/** 超采样倍数（`SS`）：`RENDER = MASK_CANONICAL_SIZE × SS` = 512，随后 LANCZOS ÷4 缩回 128。 */
export const MASK_SUPERSAMPLE = 4;

/** 层集 dp 空间边长（= 格径 30dp）。`PX = RENDER / MASK_CELL_DP`（px per dp）。 */
export const MASK_CELL_DP = 30;

// ─── 层集（capture 产物快照，见文件头「层集真源」） ─────────────────────────

export interface MaskRectLayer {
    readonly kind: 'rect';
    readonly d: number;
    readonly l: number;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly r: number;
}

export interface MaskPolygonLayer {
    readonly kind: 'polygon';
    readonly d: number;
    readonly l: number;
    /** 扁平 `[x0, y0, x1, y1, …]`，**dp 空间、y 向上**（与 `layers.json` 一致）。 */
    readonly pts: readonly number[];
}

export interface MaskCircleLayer {
    readonly kind: 'circle';
    readonly d: number;
    readonly l: number;
    readonly r: number;
    readonly lw: number;
}

export type MaskLayer = MaskRectLayer | MaskPolygonLayer | MaskCircleLayer;

/** 墨档字典规则（`capture-layers.mjs::buildDict` 的规格化表述，供不变式断言用）。 */
export const MASK_INK_RULE =
    'k<0 ⇒ d=1+k, l=0；k>0 ⇒ d=1, l=k；k=0 ⇒ d=1, l=0（每层只居暗端或亮端之一）';

// ─── 两档定稿口径（**逐字承定稿 py 头注，勿改**） ───────────────────────────

/** 有孔档 v1.1 珠面层集（= `layers.json` 的 `beadLayers` 全文，含两枚 `circle`）。 */
const HOLED_BEAD_LAYERS: readonly MaskLayer[] = [
    { kind: 'rect', d: 0.56, l: 0, x: 2, y: 2, w: 26, h: 26, r: 8 },
    {
        kind: 'polygon', d: 1, l: 0.38,
        pts: [
            15, 15, 5.050252531694168, 24.949747468305834, 6.500000000000002, 26.062177826491073,
            8.188266684282354, 26.761480784023476, 10, 27, 21.811733315717646, 26.761480784023476,
            23.5, 26.06217782649107, 24.949747468305834, 24.94974746830583,
        ],
    },
    {
        kind: 'polygon', d: 0.92, l: 0,
        pts: [
            15, 15, 5.050252531694168, 5.050252531694166, 3.9378221735089287, 6.5,
            3.238519215976522, 8.188266684282354, 3, 10, 3.2385192159765204, 21.811733315717643,
            3.9378221735089305, 23.5, 5.050252531694166, 24.94974746830583,
        ],
    },
    {
        kind: 'polygon', d: 0.78, l: 0,
        pts: [
            15, 15, 24.949747468305834, 24.94974746830583, 26.062177826491073, 23.5,
            26.761480784023476, 21.811733315717646, 27, 20, 26.761480784023476, 8.188266684282354,
            26.062177826491073, 6.5, 24.949747468305834, 5.050252531694168,
        ],
    },
    {
        kind: 'polygon', d: 0.6, l: 0,
        pts: [
            15, 15, 24.949747468305834, 5.050252531694168, 23.5, 3.9378221735089305,
            21.811733315717646, 3.238519215976522, 20, 3, 8.188266684282354, 3.238519215976522,
            6.500000000000002, 3.9378221735089287, 5.050252531694168, 5.050252531694166,
        ],
    },
    { kind: 'circle', d: 0.42000000000000004, l: 0, r: 7, lw: 0 },
    { kind: 'circle', d: 0.56, l: 0, r: 6, lw: 0 },
];

/** 无孔档 v1.0-holeless 珠面层集（= `layers-holeless.json` 的 `beadLayers` 全文）。 */
const HOLeless_BEAD_LAYERS: readonly MaskLayer[] = [
    { kind: 'rect', d: 0.56, l: 0, x: 3, y: 3, w: 24, h: 24, r: 7 },
    {
        kind: 'polygon', d: 1, l: 0.38,
        pts: [
            15, 15, 5.757359312880716, 24.242640687119284, 7.000000000000002, 25.196152422706632,
            8.447085729384874, 25.79555495773441, 10, 26, 21.552914270615126, 25.79555495773441,
            23, 25.196152422706632, 24.242640687119284, 24.242640687119284,
        ],
    },
    {
        kind: 'polygon', d: 0.92, l: 0,
        pts: [
            15, 15, 5.757359312880716, 5.757359312880714, 4.803847577293368, 7,
            4.20444504226559, 8.447085729384874, 4, 10, 4.20444504226559, 21.552914270615123,
            4.803847577293368, 23, 5.757359312880714, 24.242640687119284,
        ],
    },
    {
        kind: 'polygon', d: 0.78, l: 0,
        pts: [
            15, 15, 24.242640687119284, 24.242640687119284, 25.196152422706632, 23,
            25.79555495773441, 21.552914270615126, 26, 20, 25.79555495773441, 8.447085729384876,
            25.196152422706632, 7, 24.242640687119284, 5.757359312880716,
        ],
    },
    {
        kind: 'polygon', d: 0.6, l: 0,
        pts: [
            15, 15, 24.242640687119284, 5.757359312880716, 23, 4.803847577293368,
            21.552914270615126, 4.20444504226559, 20, 4, 8.447085729384874, 4.20444504226559,
            7.000000000000002, 4.803847577293368, 5.757359312880716, 5.757359312880714,
        ],
    },
];

/** 一档 mask 的全部冻结口径。**所有字段都是定稿值，任何改动 = 变更设计口径。** */
export interface MaskGaugeSpec {
    readonly gauge: BeadMaskGauge;
    /** 格径 dp（两档同 = 30）。 */
    readonly cellDp: number;
    /** 珠面边长 dp（含外框/外描边）。 */
    readonly beadDp: number;
    /** 珠面圆角 dp。 */
    readonly beadCornerDp: number;
    /** 珠外框/外描边宽 dp。 */
    readonly frameDp: number;
    /** 真透孔径 dp；`0` = 无孔档（J4 不适用）。 */
    readonly holeDp: number;
    /** 孔边环宽 dp。 */
    readonly holeRingDp: number;
    /**
     * 孔缘羽化宽 dp（B 通道 smoothstep；`0` = 无孔档）。
     *
     * ⚠ **`0.5 → 0.25`（WXG-T-232，2026-10-03 用户裁「甲」**：原 0.5dp 与 LANCZOS 振铃**叠加**，
     * 实测孔缘过渡带 **7px ≈ 1.64dp**（标称 0.5dp = 2.1px），并把**全透区侵蚀**到 ⌀≈10.5dp
     * （标称 12dp）⇒ 孔看起来比标称大且边缘过软。收到 0.25dp 后实测 ≈3px（≈0.7dp）。
     * ⛔ 不是改物理孔径（`holeDp = 12` **未动**，50% 交点仍在 r=25.6px）。
     */
    readonly holeFeatherDp: number;
    /** plate 档 d（= −0.44）。 */
    readonly plateD: number;
    /** plate → hole 档差。 */
    readonly darkStep: number;
    /** lit 档 l（= +0.38）。 */
    readonly litL: number;
    /** 槽口半宽 dp。 */
    readonly slotHalfDp: number;
    /** 槽口圆角 dp。 */
    readonly slotCornerDp: number;
    /** 槽内边沿斜面深度 dp。 */
    readonly slotEdgeDp: number;
    /** 槽底定值 d（有孔 0.70 = 格底色；无孔 0.32 = 深坑）。 */
    readonly slotFloorD: number;
    /** 格外圈定值 d（两档同 = 0.70 = −0.30）。 */
    readonly outsideD: number;
    /** 珠面层集（dp 空间，y 向上）。 */
    readonly beadLayers: readonly MaskLayer[];
}

/** 有孔档 —— **定稿 v1.1**（槽底 = 格底色 0.70，J4 真透 ⌀12）。 */
export const HOLED_MASK_SPEC: MaskGaugeSpec = {
    gauge: 'holed',
    cellDp: 30,
    beadDp: 26,
    beadCornerDp: 8,
    frameDp: 1,
    holeDp: 12,
    holeRingDp: 1,
    holeFeatherDp: 0.25,
    plateD: 0.56,
    darkStep: 0.14,
    litL: 0.38,
    slotHalfDp: 12,
    slotCornerDp: 8,
    slotEdgeDp: 3,
    slotFloorD: 0.7,
    outsideD: 0.7,
    beadLayers: HOLED_BEAD_LAYERS,
};

/** 无孔档 —— **定稿 v1.0-holeless**（槽底 0.32 深坑保留；⛔ 不跟随有孔档的槽底变更）。 */
export const HOLeless_MASK_SPEC: MaskGaugeSpec = {
    gauge: 'holeless',
    cellDp: 30,
    beadDp: 24,
    beadCornerDp: 7,
    frameDp: 1,
    holeDp: 0,
    holeRingDp: 0,
    holeFeatherDp: 0,
    plateD: 0.56,
    darkStep: 0.14,
    litL: 0.38,
    slotHalfDp: 11,
    slotCornerDp: 7,
    slotEdgeDp: 3,
    slotFloorD: 0.32,
    outsideD: 0.7,
    beadLayers: HOLeless_BEAD_LAYERS,
};

/** 档位 → 规格（**无未命中分支**：两档都已定稿，非法档位由类型系统挡住）。 */
export function maskSpecFor(gauge: BeadMaskGauge): MaskGaugeSpec {
    return gauge === 'holeless' ? HOLeless_MASK_SPEC : HOLED_MASK_SPEC;
}

// ─── 程序化段共用常量（承定稿 py，**勿改**） ───────────────────────────────

/** 外框四扇斜率：下基准 d（−0.58 实色档位基数）。 */
export const FRAME_SIDE_D_BASE = 0.42;
/** 外框四扇斜率跨度（上 0.70 / 左 0.63 / 右 0.52 / 下 0.42 ⇒ 跨度 0.28）。 */
export const FRAME_SIDE_D_SPAN = 0.28;
/** 左扇权重（0.42 + 0.28×0.75 = 0.63）。 */
export const FRAME_LEFT_W = 0.75;
/** 右扇权重（0.42 + 0.28×0.35 = 0.518 ≈ 0.52）。 */
export const FRAME_RIGHT_W = 0.35;
/** 外缘压暗量（`d − 0.10·t`）。 */
export const FRAME_EDGE_D = -0.1;
/** 斜面内缘 `t`（内缘 0.35 → 外缘 1.0）。 */
export const FRAME_T_INNER = 0.35;
/** 格面斜面：受光侧本色 d（`d_edge = 0.70 − 0.38·clip(1−uy)`）。 */
export const GRID_EDGE_D_LIT = 0.7;
/** 格面斜面：受光侧压暗幅度（0.70 − 0.38 = 0.32 = −0.68 档）。 */
export const GRID_EDGE_D_SPAN = 0.38;
