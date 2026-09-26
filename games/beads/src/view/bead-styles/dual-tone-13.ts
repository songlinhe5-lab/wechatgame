/**
 * **`13` 双色对角（dual-tone-13）** —— §12.9 步 4 入池（EP11-S4 / WXG-T-211-S4）
 * ─────────────────────────────────────────────────────────────────────────────
 * 层集 = `assets-spec §7.11.2` 行 1–3（正本逐字），珠体 **3 命令 / 0 真 α**
 * = `§7.11.4` 余量表里的「池内最省」（命令余量 4 / α 余量 2 ⇒ 不触 C7 门）。
 * 归类 = **图元型**（含 1 枚 `polygon` 新几何）⇒ 义务 = **一份 §6 差分记录**（C7，本批随附）。
 *
 * 造型语义（纪律 ③ 的载体）：**亮底 + 一枚对角暗三角** = 两档色读作一颗珠。
 * `§7.11.2` 明写「两枚会把亮面盖光」⇒ 三角**恰一枚**（枚数是造型身份，不是可调项）。
 *
 * **E 单 C 组三处必改（本模块落 ①②，⛔ 不照抄 spike 的旧口径）**：
 *  1. **孔底 = 目标格 `pit`（K3 透色）** —— spike 行 3 的 `endpoints.base` 是「base 唯一在场处」，
 *     而按 K3/C5「透色恒保留」改透目标色后**珠体再无任何 base**（`§7.11.2` C12 列原文）。
 *     ⇒ 本模块不自辩：孔 fill 走 `endpointOf(target).pit`（⛔ `'#FFFFFF'` / base 字面），
 *       base 缺席的后果由 C12 **弱读法 + role 域**承接（珠面域 = `#2` 一枚 ⇒ argmax = `pit`
 *       ∈ 本格 base 同族 ⇒ 判过；已裁依据 = QA `test-cases §K.1`「`13` 在弱读下必须过」）。
 *  2. **孔径 = `size × BEAD_CARD.holeRatio / 2`（= 0.22S）** —— spike 的 `0.16S` 偏小 **27%**
 *     （`§7.11.6` 同一行），与四棱转正后的口径**同源** ⇒ ⛔ 风格内自孔径（K-042 真源单一）。
 *  3. （必改 ③ = `18` 的白高光引 token ⇒ 与本模块无关，见 `lineart-18.ts`。）
 *
 * **热路径零分配（C2 / ADR-0024 值语义）**：层对象与 `points` 元组都是**模块级 scratch**，
 * 每帧原地改写 ⇒ 每珠每帧零层集分配；返回值的生命周期 = 本次调用（`contract.ts` 已写入契约）。
 *
 * ⛔ **L3 禁 cc**、⛔ **C3 色源唯一**（只走 `palette.ts` 端点，本文件**零 hex**）、
 * ⛔ **C4 零裸系数**（几何比率全部经 `tuning.ts` 命名常量注入；`i2` **复用四棱同名常量**，
 *   依据 = `§7.11.6` 把四棱与 `13` 的刻面内缩列为**同一行**）。机械锚 =
 *   `tests/bead-style-pool.test.ts` 的「C4 裸系数扫描 · 风格模块静态门」（扫目录 ⇒ 本文件自动受门）。
 */
import {
    BEAD_CARD,
    DUAL13_STYLE_ID,
    FACET4_FACET_INSET,
} from '../../config/tuning.js';
import { endpointOf } from '../palette.js';
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

const PT_DIAGONAL: FacetPoints = [0, 0, 0, 0, 0, 0];

/** #1 亮底（`plate` 职能 ⇒ 排除出 C12 珠面族统计域，见下方 role 定档理由）。 */
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

const DIAGONAL: WritableBeadPolygon = {
    kind: 'polygon',
    role: 'facet',
    points: PT_DIAGONAL,
    fill: '',
};

const HOLE: WritableBeadCircle = { kind: 'circle', role: 'hole', cx: 0, cy: 0, r: 0, fill: '' };

/**
 * 层集本体（**冻结的是数组本身、不是元素** ⇒ 长度与顺序不可被改写，字段仍可原地写）。
 * 数组序 = 绘制序：#1 亮底 → #2 对角暗三角 → #3 孔（= `§7.11.2` 行 1–3，⛔ 不可重排）。
 */
const LAYERS: readonly BeadStyleLayer[] = Object.freeze([PLATE, DIAGONAL, HOLE]);

/**
 * 逐 inks 出层集（纯函数：同一输入 ⇒ 同一输出**值**；返回的是复用槽，见文件头约定）。
 *
 * 与 spike `styles.mjs:131-136` 同式：**格心局部系、y 轴向上**（`contract.ts` 文件头），
 * 三角 = (内方左下, 内方右上, 内方右下) ⇒ 与 `§7.11.2` 行 2 的顶点措辞逐字对应；
 * 内缩 `i2 = FACET4_FACET_INSET × S`（与四棱同一系数，`§7.11.6` 同一行）。
 */
function dualTone13Layers({
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

    // #1 亮底 rect：满格 S×S、圆角与四棱同源 = `round(BEAD_CARD.radius × S)`（§1.1 K1，
    // ⛔ 不在风格内重算圆角）。墨 = `endpoints.lit`（+0.38 档）⇒ **首个 fill 非 base**，
    // 但 `role = 'plate'` 把它排除出珠面族统计域：它的职能是「底衬」（被 #2 盖掉一半），
    // 与四棱 #1 暗底同理同标法（`contract.ts::BeadLayerRole`）。
    // ⚠ 该定档直接决定 `13` 的 C12 argmax = `pit` 而非 `lit` ⇒ 已按任务单预期与 QA §K.1
    //   裁定采之，并作为**本批唯一 role 判断**写进回传，供主理人/QA 复核（⛔ 不静默）。
    PLATE.x = -h;
    PLATE.y = -h;
    PLATE.w = size;
    PLATE.h = size;
    PLATE.fill = e.lit;
    PLATE.radius = Math.round(size * BEAD_CARD.radius);

    // #2 对角暗三角：面积 ≈ 37%（`§7.11.2`），墨 = `endpoints.pit`（实装 −0.44 档）。
    // 顶点组 = (l,l) 左下 → (r,r) 右上 → (r,l) 右下 ⇒ 剩下可见的亮区 = 左上半（对角分界）。
    // ⚠ 双口径登记：`§1.9.2` 表列 `pit` = −0.14，而端点表**实装** = −0.44（`§7.11.7` D3）
    //   ⇒ 本模块按实装端点表取色（`endpointOf` 是唯一色源，⛔ 风格内不选档），差额归 art 对齐单。
    PT_DIAGONAL[0] = l;
    PT_DIAGONAL[1] = l;
    PT_DIAGONAL[2] = r;
    PT_DIAGONAL[3] = r;
    PT_DIAGONAL[4] = r;
    PT_DIAGONAL[5] = l;
    DIAGONAL.fill = e.pit;

    // #3 单孔（甲口径 / 必改 ①②）：`r = 0.22S`（唯一真源 = `BEAD_CARD.holeRatio`）、
    // 孔底 = **目标格 `pit`**（通孔物理上透下去看见该格目标色）；无目标色（托盘珠）
    // ⇒ 按契约 `targetColorIdx ?? colorIdx` 回落本格 `pit`（仍是端点表内色，C3 零新色）。
    // 同 `facet-4` 的取整口径（用户拍板「孔径整数、2 的倍数 px」，§7.11.6 三套同源）。
    HOLE.r = Math.round((size * BEAD_CARD.holeRatio) / 2);
    HOLE.fill = endpointOf(inks, targetColorIdx ?? colorIdx).pit;

    return LAYERS;
}

/** 注册对象（`registry.ts` 的注册项；步 5 起才可被玩家切到）。 */
export const DUAL_TONE_13: BeadStyle = {
    id: DUAL13_STYLE_ID,
    beadLayers: dualTone13Layers,
};
