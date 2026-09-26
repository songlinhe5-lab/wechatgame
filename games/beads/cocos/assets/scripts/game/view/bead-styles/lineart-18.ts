/**
 * **`18` 线稿描边（lineart-18）** —— §12.9 步 4 入池（EP11-S4 / WXG-T-211-S4）
 * ─────────────────────────────────────────────────────────────────────────────
 * 层集 = `assets-spec §7.11.3` 行 1–5（正本逐字），珠体 **5 命令 / 1 真 α**
 * = `§7.11.4` 余量表里的「α 压线者」（命令余量 2 / α 余量 **1** ⇒ 任何新增软光/内阴影即触门，走 C11）。
 * 本套也是池内**唯一带真 α**、唯一带**描边**的风格；归类 = 图元型 ⇒ 义务 = 一份 §6 差分记录（C7）。
 *
 * 造型语义：**平涂主体 + 粗描边 + 两枚明暗带 + 硬投影**，全矢量原生、零渐变 ⇒
 * 「线宽即身份」= 本套的凸/凹通道不是刻面墨序，而是**描边宽与硬投影方向**。
 *
 * **E 单 C 组三处必改（本模块落 ①②③）**：
 *  1. **孔底 = 目标格 `pit`（K3 透色）** —— 正本行 5 的 `'#FFFFFF'` 字面量违 K3/C5
 *     「透色恒保留」⇒ 按必改 ① + QA `§K.5 行 10`「白孔判红」换成 `endpointOf(target).pit`。
 *     ⚠ 连带后果（⛔ 不静默）：任务单工作项 2 另有一句「`18` 白高光引 `BEAD_HIGHLIGHT_HEX`」，
 *       它与必改 ① 在**本层**不共容（白孔 vs 透色孔）。正本行 5 的处置建议本身写的就是
 *       「落码须换 token `BEAD_HIGHLIGHT_HEX`」⇒ 两条读法都指向「⛔ `view/` 零 hex 字面」，
 *       但只有采孔底 = `pit` 才同时满足 K3/C5 与 QA 判据 ⇒ 采之，`BEAD_HIGHLIGHT_HEX`
 *       在本模块**零消费者**（不预 import 无消费者的符号）。**已登记为未决两读法回传**。
 *  2. **孔径 = `size × BEAD_CARD.holeRatio / 2`（= 0.22S）** —— spike 的 `0.15S` 偏小 **32%**
 *     （`§7.11.6`），与四棱转正后口径同源 ⇒ ⛔ 风格内自孔径。
 *  3. **孔甲口径单孔**（1 枚 `circle`，无内壁自阴影第二枚）⇒ 真 α 恒 1（= D4 已裁的甲口径）。
 *
 * **线宽地板（PT-SKIN-02 A/B 位，任务单已裁）**：正本 `lw = max(3, 0.06S)` 的绝对地板 `3`
 * 在 `§7.11.3 / §7.11.6` 标 `[待真机]`（2 ↔ 3 之争）⇒ 按已裁：**引 `LINEART_MIN_STROKE`
 * = `BEAD_CARD.minStroke`（现值 2）**，⛔ 不自造第三值。三处口径事实如实落在此处（不粉饰）：
 *  · 盘面尺 `S = 22` → `0.06S = 1.32`、本尺 `S = 30` → `1.8` ⇒ **主体线宽被地板钳住**（正本「钳」字成立）；
 *  · 孔线宽 = `lw × 0.7`，**同样受 §1.1 地板约束**（沿用现码既有惯例：`drawEmptySocket`
 *    对三档线宽一律 `Math.max(BEAD_CARD.minStroke, …)`）⇒ 钳地板的后果 = **两档同宽**：
 *    分档仅在 `0.042S > 地板` 时出现 ⇒ 地板 2 需 `S > 47.6`、地板 3 需 `S > 71.4`，
 *    而现行三把尺（盘 22 / 本尺 30 / 托 44）**全部在钳平区** ⇒ 「线宽即身份」的两档在
 *    纸面上不体现为可见粗细差（与 `§7.11.6` 对凹槽「三口径全被地板钳平 ⇒ 无实测差」同族）。
 *    ⇒ 本模块不选择“弃地板换分档”（那是拿红线换观感），而是把该后果当**机检读数**写进
 *    `tests/bead-style-ledger.test.ts` 附行 B（逐尺钉「不低于地板」+「同宽事实」，
 *    并配「弃地板」变异自证 ⇒ 红线腿当场红）。
 *
 * **热路径零分配（C2）**：五层皆模块级 scratch，逐帧原地改写（描边两字段同理）。
 * ⛔ **L3 禁 cc**、⛔ **C3 色源唯一**（只走 `palette.ts` 端点与 token，本文件**零 hex 字面量**）、
 * ⛔ **C4 零裸系数**（全部比率/α 经 `tuning.ts` 命名常量注入）。机械锚 =
 *   `tests/bead-style-pool.test.ts` 的 C4 扫描（扫目录 ⇒ 本文件自动受门）。
 */
import {
    BEAD_CARD,
    LINEART_BAND_H,
    LINEART_BAND_RADIUS,
    LINEART_BAND_W,
    LINEART_BAND_Y,
    LINEART_EDGE_H,
    LINEART_EDGE_RADIUS,
    LINEART_EDGE_W,
    LINEART_HOLE_STROKE_SCALE,
    LINEART_MIN_STROKE,
    LINEART_SHADOW_ALPHA,
    LINEART_SHADOW_DX,
    LINEART_SHADOW_DY,
    LINEART_STROKE_RATIO,
    LINEART18_STYLE_ID,
} from '../../config/tuning';
import { BEAD_SHADOW_HEX, endpointOf } from '../palette';
import type {
    BeadStyle,
    BeadStyleInput,
    BeadStyleLayer,
    WritableBeadCircle,
    WritableBeadRect,
} from './contract';

/* ── 模块级 scratch：五层的形状与条数是风格的静态属性 ⇒ 逐帧原地改写，不新建（C2）。 ── */

/** #1 硬投影（`plate` 职能：底衬/投影 ⇒ 排除出 C12 珠面族统计域；本套唯一真 α 层）。 */
const SHADOW: WritableBeadRect = {
    kind: 'rect',
    role: 'plate',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    fill: BEAD_SHADOW_HEX,
    radius: 0,
    alpha: LINEART_SHADOW_ALPHA,
};

/** #2 主体（描边同路径：`fill + stroke` 仍算 **1 命令**，`§7.11` 读法②）。 */
const BODY: WritableBeadRect = {
    kind: 'rect',
    role: 'facet',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    fill: '',
    radius: 0,
    stroke: BEAD_SHADOW_HEX,
    lineWidth: 0,
};

/** #3 上亮带（叠压式明暗带 ⇒ `facet`：它是可见珠面，不是底衬）。 */
const BAND_LIT: WritableBeadRect = {
    kind: 'rect',
    role: 'facet',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    fill: '',
    radius: 0,
};

/** #4 下暗带（同上 `facet`；与 #3 一起构成「叠压式层集」⇒ 面积级重叠是**其身份**）。 */
const BAND_EDGE: WritableBeadRect = {
    kind: 'rect',
    role: 'facet',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    fill: '',
    radius: 0,
};

/** #5 单孔（甲口径 + 描边；fill = 目标 `pit`，见文件头必改 ①）。 */
const HOLE: WritableBeadCircle = {
    kind: 'circle',
    role: 'hole',
    cx: 0,
    cy: 0,
    r: 0,
    fill: '',
    stroke: BEAD_SHADOW_HEX,
    lineWidth: 0,
};

/**
 * 层集本体（冻结数组本身；数组序 = 绘制序 = `§7.11.3` 行 1–5：
 * #1 硬投影 → #2 主体（描边）→ #3 上亮带 → #4 下暗带 → #5 孔）。
 */
const LAYERS: readonly BeadStyleLayer[] = Object.freeze([SHADOW, BODY, BAND_LIT, BAND_EDGE, HOLE]);

/**
 * 逐 inks 出层集（纯函数：同一输入 ⇒ 同一输出**值**；返回复用槽，见文件头约定）。
 *
 * 与 spike `styles.mjs:61-68` 同式，**格心局部系、y 轴向上**（`contract.ts` 文件头）：
 * 投影 `dx = +0.09S`／`dy = −0.05S` ⇒ 右下斜向（`§7.11.3` 行 1 的方向措辞；
 * ⚠ 与 legacy `L0b` 的正下方向不同 = `§7.11.7` D6，两风格同屏永不共存 ⇒ 无现网冲突）。
 */
function lineart18Layers({
    inks,
    colorIdx,
    targetColorIdx,
    size,
}: BeadStyleInput): readonly BeadStyleLayer[] {
    const e = endpointOf(inks, colorIdx);
    const h = size / 2;
    const lw = Math.max(LINEART_MIN_STROKE, size * LINEART_STROKE_RATIO);
    const radius = Math.round(size * BEAD_CARD.radius);

    // #1 硬投影：`S×S` 满格平移，墨 = `BEAD_SHADOW_HEX` token、α = `LINEART_SHADOW_ALPHA`。
    // 计真 α 的正是这一枚（C7 判据第一支 `alpha < 1`）⇒ 本套「唯一带真 α 者」的那 1 枚；
    // ⛔ 不得是「孔内壁自阴影」（那是已否掉的 D4 乙口径第二枚孔，任务单已裁甲口径单孔）。
    SHADOW.x = -h + size * LINEART_SHADOW_DX;
    SHADOW.y = -h - size * LINEART_SHADOW_DY; // 绘制侧加负号（系数只存量，见 tuning 注）
    SHADOW.w = size;
    SHADOW.h = size;
    SHADOW.radius = radius;

    // #2 主体 = `endpoints.base` + 描边同路径 ⇒ C12 两读法均干净的来源（base 可见 ≈66%）。
    BODY.x = -h;
    BODY.y = -h;
    BODY.w = size;
    BODY.h = size;
    BODY.fill = e.base;
    BODY.radius = radius;
    BODY.lineWidth = lw;

    // #3 上亮带：`x∈[−0.31S,+0.31S]`、`y∈[+0.17S,+0.37S]` ⇒ x 由带宽/2 居中导出（⛔ 另立 x 系数）。
    BAND_LIT.x = -(size * LINEART_BAND_W) / 2;
    BAND_LIT.y = size * LINEART_BAND_Y;
    BAND_LIT.w = size * LINEART_BAND_W;
    BAND_LIT.h = size * LINEART_BAND_H;
    BAND_LIT.fill = e.lit;
    BAND_LIT.radius = size * LINEART_BAND_RADIUS;

    // #4 下暗带：`w = 0.72S`、`y∈[−0.36S,−0.20S]`（h = 0.16S、r = 0.08S）。
    // ⚠ 正本把 x 与 y 的起算都写成 `−0.36S`（spike 字面 `cx − h*0.72` / `cy − h*0.72` 同一系数）
    //   ⇒ 本处**复用同一系数** `LINEART_EDGE_W`，不另立同值的 `EDGE_X` / `EDGE_Y`（K-042 真源单一）；
    //   两个语义都是「居中布层」，故 x = −w/2、y = −0.36S 同式成立（若真源日后拆档再改本行）。
    BAND_EDGE.x = -(size * LINEART_EDGE_W) / 2;
    BAND_EDGE.y = -(size * LINEART_EDGE_W) / 2;
    BAND_EDGE.w = size * LINEART_EDGE_W;
    BAND_EDGE.h = size * LINEART_EDGE_H;
    BAND_EDGE.fill = e.edge;
    BAND_EDGE.radius = size * LINEART_EDGE_RADIUS;

    // #5 单孔（必改 ①②③）：`r = 0.22S`（唯一真源 = `BEAD_CARD.holeRatio`）、
    // fill = **目标格 `pit`**（⛔ 白孔，见文件头）、描边 = `lw × 0.7` 并同样受 §1.1 地板钳。
    // 同 `facet-4` 的取整口径（用户拍板「孔径整数、2 的倍数 px」，§7.11.6 三套同源）。
    HOLE.r = Math.round((size * BEAD_CARD.holeRatio) / 2);
    HOLE.fill = endpointOf(inks, targetColorIdx ?? colorIdx).pit;
    HOLE.lineWidth = Math.max(LINEART_MIN_STROKE, lw * LINEART_HOLE_STROKE_SCALE);
    // ⚠ **本行不自检「地板是否抹掉了两档差别」**：实现侧自证自己写的表达式无判别力
    //   （K-060）⇒ 该约束的**判别力承载体在测试侧** = `tests/bead-style-ledger.test.ts` 附行 B：
    //   逐尺钉 `holeLw ≥ 地板`（§1.1 红线腿）+ 钉住本尺下 `holeLw === bodyLw` 的**钳平事实**
    //   （= PT-SKIN-02 A/B 要读的量，⛔ 不靠弃地板求“两档分明”，亦⛔ 不拿注释免责）。

    return LAYERS;
}

/** 注册对象（`registry.ts` 的注册项；步 5 起才可被玩家切到）。 */
export const LINEART_18: BeadStyle = {
    id: LINEART18_STYLE_ID,
    beadLayers: lineart18Layers,
};
