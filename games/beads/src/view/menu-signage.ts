/**
 * 菜单屏珠拼图元（`beadText` 招牌 + 作品格珠拼缩略）— WXG-T-269-S6 · 子单 T-2B。
 *
 * ## 为什么单独成文件（而不是住在 `meta-view.ts`）
 * `meta-view.ts` 的既有职能 = **版面 / 热区 / 容器**（真源 `menu-architecture §5.1–§5.4`）；本文件的职能 =
 * **把布尔位表与关卡 `pattern` 翻成珠体命令**（真源 `games/beads/art/menu-wall-signage-spec.md` T-1）。
 * 两个真源、两种变更节奏（档位随 art 回写搬家、版面随 ux 回写搬家），混在一处会让「菜单帧图元差分」（K-6）
 * 与热区表互相牵动。判例形状 = `view/bead-styles/*`（层集住风格文件、调用侧只调）。
 * **装配点仍在 `meta-view::buildMetaView`** ⇒ 本模块不自行决定「画不画、画在哪一带」（L5 同族纪律）。
 *
 * ## S0 五条硬接线约束（`design/proposals/ui-style-redesign/screens.md` §42–§47）逐条落点
 * ① **只复用珠体绘制、⛔ 不改珠面 recipe**：两条腿都只调 `bead-render.ts::drawFilledBead`（与盘面/托盘珠
 *   **同一通道**）⇒ 系数恒 **7 命令/颗**（`facet-4` = 1 `rect` plate + 4 `polygon` 扇 + 2 `circle` 孔，
 *   T-1 §0.3）；层集 / 系数 / 倒角 / 风格池零涉入，蜡笔不入，⛔ 不造「UI 简化珠」第二通道（T-1 §3.7）。
 *   ⚠ **不传 `maskGauge` ⇒ tint 臂与烘焙臂都不命中 ⇒ 恒走矢量臂**（`bead-render.ts` 分流注「不传（默认）
 *   ⇒ tint 臂永不命中 ⇒ 矢量臂逐字节 = 今日」）⇒ 菜单帧图元数**确定可复算**（K-6 的前提）。
 * ② 新增只有布尔位表 ⇒ 位图 +0 KB：字模住 `config/sign-glyphs.ts`，本文件零资产引用、零字体。
 * ③ 只取既有 `palette` 珠色：招牌走 `DEMO_BEAD_INKS`、缩略走 `beadInksFor(level)`，都经 `endpointOf`
 *   ⇒ **零新 hex**（色表锁 46 条 / `68a4b509bb65` 不触动）；⛔ 不取 UI token（`text`/`accent_*`），
 *   那会把 UI 墨混进珠色族、破坏 C3 色源唯一（T-1 §1.7）。
 * ④ 封箱：本文件不碰 `drawFilledBead` 及其下游 ⇒ 珠面 seal 不触发；菜单帧的实测口径由
 *   `tests/menu-primitives-capture.ts`（K-6 装置）出数，⛔ 不引纸面值（K-051）。
 * ⑤ **⛔ 不进玩法 `buildRenderModel` 的盘面/托盘命令流**：本模块**只被 `view/meta-view.ts` 引用**，
 *   由 import 图 + 「playing 帧四键 = 封箱基准」双向钉住（`tests/menu-primitives-k6.test.ts`）。
 *
 * ## 热路径纪律（`control-manifest §2` / L4）
 * - **位表渲染零分配**：逐格 `charCodeAt` 比较；入参选项住**模块级复用槽** `beadOpts`
 *   （判例 = `bead-render.ts` 的 `styleInput` / `polyWorld` / `tintBlitOpts`；C2 机械锚见测试）。
 * - **缩略聚合一次性缓存**：`WeakMap<关卡, Map<n, 表>>`（判例 = `palette.ts::inksCache`），每帧只 `get`；
 *   表本体 = `number[]` 扁平三元组 `(r, c, colorIdx)` ⇒ 绘制侧零属性解构、零分配。
 * - **零 RNG（L4）**：切块 `floor`、平票取**最小 `colorIdx`**（T-1 §3.1「确定性、可复现；⛔ 禁 Math.random、
 *   ⛔ 禁依赖扫描顺序」——本实现的平票语义由「升序扫 + 严格 `>`」结构性保证）。
 *
 * 层级：view（L3 clean：无 `cc` / DOM / `wx`；⛔ 不 import `game/**` ⇒ L5 视图不持状态）。
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import {
    BEAD_COLOR_MAX,
    BEAD_GAP,
    DESIGN_W,
    SIGN_BEAD_PITCH,
    SIGN_FACE_FLOOR,
    SIGN_GLYPH_GAP_RATIO,
    SIGN_INK_IDX,
    SIGN_MATRIX_N,
    THUMB_AREA,
    THUMB_MATRIX_N,
    THUMB_TOP_INSET,
    signFaceB,
    thumbOuterFor,
    thumbPitchFor,
} from '../config/tuning.js';
import { signGlyphOf } from '../config/sign-glyphs.js';
import { colorIndexOfChar } from '../config/bead-charset.js';
import type { BeadsLevelRaw } from '../config/levels-data.js';
import { DEMO_BEAD_INKS, beadInksFor, relativeLuminance, type BeadInks } from './palette.js';
import { drawFilledBead, type FilledBeadOptions } from './bead-render.js';

/**
 * 可变选项槽（同 `bead-styles/contract.ts::WritableBeadStyleInput` 的写法）：逐珠**复用同一对象**写三个字段
 * ⇒ 输入侧零分配。⛔ 不外泄（模块私有）、⛔ 不得跨调用持有（`drawFilledBead` 同步消费即弃）。
 * ⚠ 只写 `size` / `inks` / `targetColorIdx` 三条 ⇒ 其余字段恒 `undefined`（= 默认臂），两条腿共用同槽
 *   也不会串味（`tests/menu-signage-beadtext.test.ts` 以「两次调用只产同一实例」为机械锚）。
 */
type WritableBeadOptions = { -readonly [K in keyof FilledBeadOptions]: FilledBeadOptions[K] };
const beadOpts: WritableBeadOptions = {};

/** 位表「有珠」格字符码点（`'#'`，与 `config/sign-glyphs.ts` 同口径）。 */
const HASH_CODE = 0x23;

// ───────────────────────────────────────────── 招牌墨（S0 约束③ / T-1 §1.7）

/** 相对亮度最高的一档（1-based 珠色索引；确定性派生、模块级一次算定，⛔ 不落 hex）。 */
function brightestInkIdx(inks: BeadInks): number {
    let best = 1;
    let bestLum = -1;
    for (let i = 0; i < inks.hexes.length; i++) {
        const lum = relativeLuminance(inks.hexes[i]!);
        if (lum > bestLum) {
            bestLum = lum;
            best = i + 1;
        }
    }
    return best;
}

/**
 * 招牌墨索引 = `SIGN_INK_IDX`；其为 **0**（art 未定值，T-1 §1.7 明文「本轮不写死」）⇒ 按该节**建议口径**
 * 确定性派生 =「demo 十色中 `relativeLuminance` 最高的一档」（在册通道，零新算式发明）。
 * ⚠ 真机观感裁定后 art 回写 `SIGN_INK_IDX`（1..10）即覆盖本派生 ⇒ 一行改值、无第二通道。
 */
export const SIGN_INK_COLOR_IDX: number =
    SIGN_INK_IDX > 0 ? SIGN_INK_IDX : brightestInkIdx(DEMO_BEAD_INKS);

// ───────────────────────────────────────────── beadText 渲染器（卡 A）

let warnedMissingGlyph = false;

/** 测试专用：复位一次性告警门（判例 = `palette.ts::resetPaletteFallbackWarnings`）。 */
export function resetSignageWarnings(): void {
    warnedMissingGlyph = false;
}

/** 招牌几何（由档参数派生；`signBands()` 与 `drawBeadText()` **共用**同一算式 ⇒ 无第二份换算）。 */
function signBoxOf(n: number, d: number): { box: number; gap: number } {
    const box = n * d;
    return { box, gap: box * SIGN_GLYPH_GAP_RATIO };
}

/**
 * 招牌带**外接框**（T-1 §2.2 关系不变式的读数口：`sign.yMin ≥ 橱窗 frameTop + SIGN_BAND_PAD`）。
 * `centerY` 语义 = **外接框中心**（主理人裁定；替 T-2A 系统字体的 `baseline: 'middle'`，
 * 闭合漂移 D-1：按 baseline 生长时字高 120 的顶会撞资源条带）。
 */
export function signBands(
    glyphCount: number,
    centerY: number,
    n: number = SIGN_MATRIX_N,
    d: number = SIGN_BEAD_PITCH,
): { x: number; yMin: number; yMax: number; w: number; h: number } {
    const { box, gap } = signBoxOf(n, d);
    const w = glyphCount * box + Math.max(0, glyphCount - 1) * gap;
    return { x: (DESIGN_W - w) / 2, yMin: centerY - box / 2, yMax: centerY + box / 2, w, h: box };
}

/**
 * 画一串珠拼字（`beadText`），返回**实际画出的珠数**（0 ⇒ 调用方可回落文字占位；二者互斥 ⇒
 * 「不同时上屏两份」是**结构保证**而非约定，T-1 §5 可访问性条：招牌以文本 Alternative 暴露）。
 *
 * 位表换算（T-1 §0.5，设计空间 **y 向上、原点左下**，`control-manifest §8`）：
 * - 单字外接框 = `n·d × n·d`；字间 = 半字宽 `(n/2)·d` ⇒ 总宽 `5.5·n·d`（`n=8` 退化为原文 `44d`）。
 * - 第 `r` 行珠心 `y = glyphTop − (r + 0.5)·d`（**`rows[0]` = 视觉顶行**）；
 *   第 `c` 列珠心 `x = glyphLeft + (c + 0.5)·d`（`c00` = 视觉最左列）。
 * - 珠面走**口径 B（真几何）**：绘制外缘 `size = d − BEAD_GAP`，再经 `targetColorIdx` 触发的等比内缩
 *   `× 26/30` ⇒ 面 `= (d − GAP) × 26/30`（`d = 12 ⇒ 8.67 ≥ SIGN_FACE_FLOOR 8`，与 T-1 §1.4 推荐档逐值同）。
 *
 * ⚠ 未知字符 / 位表边长与档不符 ⇒ 跳过该字（保留其字槽 ⇒ 版面不移位）+ **一次性告警**；
 * ⛔ 不猜字形、⛔ 不自拟位表（字模只准来自 `config/sign-glyphs.ts` = art 域）。
 *
 * @param text    待拼串（生产侧只传 `COPY_TOKENS.app_name`，⛔ 不散字面）
 * @param centerY 外接框中心 y
 * @param n       字模阵边长（缺省 `SIGN_MATRIX_N`；K-6 差分/回落档可传 `SIGN_FALLBACK_MATRIX_N`）
 * @param d       珠距（缺省 `SIGN_BEAD_PITCH`）
 * @param inkIdx  珠色索引（缺省 {@link SIGN_INK_COLOR_IDX}）
 * @param inks    墨水组（缺省 demo 十色；T-1 §1.7「demo 十色够用」= 现 9 关最大色索引 9）
 */
export function drawBeadText(
    builder: RenderModelBuilder,
    text: string,
    centerY: number,
    n: number = SIGN_MATRIX_N,
    d: number = SIGN_BEAD_PITCH,
    inkIdx: number = SIGN_INK_COLOR_IDX,
    inks: BeadInks = DEMO_BEAD_INKS,
): number {
    const { box, gap } = signBoxOf(n, d);
    const count = text.length;
    const totalW = count * box + Math.max(0, count - 1) * gap;
    const left0 = (DESIGN_W - totalW) / 2;
    const top = centerY + box / 2;
    const outer = d - BEAD_GAP; // 口径 B 的**外缘**（面 = outer × 26/30 由渲染侧等比内缩给出）
    let beads = 0;
    for (let i = 0; i < count; i++) {
        const code = text.codePointAt(i)!;
        const glyph = signGlyphOf(code);
        if (glyph === undefined || glyph.n !== n) {
            if (!warnedMissingGlyph) {
                warnedMissingGlyph = true;
                console.warn(
                    `[beads] beadText: 码点 ${code} 无 n=${n} 字模 ⇒ 跳过该字（位表真源 = config/sign-glyphs.ts，` +
                        '字模归 art 单，工程侧不猜字形；本条仅告警一次）',
                );
            }
            if (code > 0xffff) i++;
            continue;
        }
        if (code > 0xffff) i++;
        const glyphLeft = left0 + i * (box + gap);
        const rows = glyph.rows;
        for (let r = 0; r < n; r++) {
            const row = rows[r]!;
            const y = top - (r + 0.5) * d;
            for (let c = 0; c < n; c++) {
                if (row.charCodeAt(c) !== HASH_CODE) continue;
                beadOpts.size = outer;
                beadOpts.inks = inks;
                beadOpts.targetColorIdx = inkIdx;
                drawFilledBead(builder, glyphLeft + (c + 0.5) * d, y, inkIdx, beadOpts);
                beads++;
            }
        }
    }
    return beads;
}

// ───────────────────────────────────────────── 作品格缩略（卡 C）

/**
 * 关卡 `pattern` → `n×n` 主色块聚合（**保识别不保细节**，T-1 §3.1 逐字落码）：
 *
 * ```
 * rowRange = [ floor(r·rows/n) , max(r0+1, floor((r+1)·rows/n)) )      （列同理，块尺寸 ∈ {⌊R/n⌋,⌈R/n⌉}）
 * tally    = 块内字符计数，忽略 '.'（空）与 'x'（不可填 / 无墨）
 * tally 空 ⇒ 该位**不画珠**（露纸底，⛔ 不画「空珠」）
 * 否则     ⇒ 1 颗珠，colorIdx = 块内计数最大者；平票 ⇒ 取 colorIdx **最小**者
 * ```
 *
 * 返回**扁平三元组表** `[r, c, colorIdx, ...]`（row-major）⇒ 绘制侧零对象解构、零分配。
 * 表内容只依赖 `pattern` 与 `n`（⛔ 不依赖墨 / 皮肤 / 帧号）⇒ 换肤不会让缩略变味、缓存也不需失效键。
 * ⚠ 本函数**只在缓存未命中时**被调（一次性烘焙）⇒ 内部 `row[x]` 造临时串属合规；每帧路径走 {@link levelThumbCells}。
 */
const _thumbCache = new WeakMap<BeadsLevelRaw, Map<number, readonly number[]>>();

/** 聚合用的模块级计数槽（只在一次性烘焙里用，⛔ 不进每帧路径；长度 = `BEAD_COLOR_MAX + 1`）。 */
const _tally: number[] = new Array<number>(BEAD_COLOR_MAX + 1).fill(0);

function aggregateThumb(level: BeadsLevelRaw, n: number): readonly number[] {
    const pattern = level.pattern;
    const rows = pattern.length;
    const cols = level.cols;
    const out: number[] = [];
    for (let r = 0; r < n; r++) {
        const r0 = Math.floor((r * rows) / n);
        const r1 = Math.max(r0 + 1, Math.floor(((r + 1) * rows) / n));
        for (let c = 0; c < n; c++) {
            const c0 = Math.floor((c * cols) / n);
            const c1 = Math.max(c0 + 1, Math.floor(((c + 1) * cols) / n));
            for (let k = 0; k <= BEAD_COLOR_MAX; k++) _tally[k] = 0;
            for (let y = r0; y < Math.min(r1, rows); y++) {
                const row = pattern[y];
                if (row === undefined) continue;
                const limit = Math.min(c1, row.length);
                for (let x = c0; x < limit; x++) {
                    const idx = colorIndexOfChar(row[x]!);
                    if (typeof idx !== 'number') continue; // '.' / 'x' ⇒ 无墨，不计入 tally
                    _tally[idx] = (_tally[idx] ?? 0) + 1;
                }
            }
            let bestIdx = 0;
            let bestCount = 0;
            for (let k = 1; k <= BEAD_COLOR_MAX; k++) {
                const count = _tally[k] ?? 0;
                if (count > bestCount) {
                    bestCount = count;
                    bestIdx = k; // 升序 + 严格 `>` ⇒ 平票结构性留在最小 colorIdx
                }
            }
            if (bestCount > 0) out.push(r, c, bestIdx);
        }
    }
    return out;
}

/** 取聚合表（命中缓存 ⇒ 零分配；这是每帧唯一走到的入口）。 */
export function levelThumbCells(level: BeadsLevelRaw, n: number = THUMB_MATRIX_N): readonly number[] {
    let byN = _thumbCache.get(level);
    if (byN === undefined) {
        byN = new Map<number, readonly number[]>();
        _thumbCache.set(level, byN);
    }
    const hit = byN.get(n);
    if (hit !== undefined) return hit;
    const cells: readonly number[] = Object.freeze(aggregateThumb(level, n));
    byN.set(n, cells);
    return cells;
}

/** 该关该档的缩略珠数（= 表长 / 3）⇒「单格 ≤ `THUMB_BEADS_MAX`(25)」硬判据的读数口。 */
export function levelThumbBeads(level: BeadsLevelRaw, n: number = THUMB_MATRIX_N): number {
    return levelThumbCells(level, n).length / 3;
}

/**
 * 画一格作品缩略（**案乙**：格顶内缩 `THUMB_TOP_INSET` ⇒ `THUMB_AREA` 见方，底部 `THUMB_STAR_BAND`
 * 留给星；现装占位格几何不动 ⇒ 零版面扰动、零 §3 变更）。
 *
 * 与盘面珠**同 recipe、同系数（7）、同风格池**（T-1 §3.7）；墨走 `beadInksFor(level)` ⇒ 与关卡色板同源
 * （C3 色源唯一，⛔ 不建「UI 简化色表」、不做色号压缩映射）。珠面同走口径 B：外缘 `thumbOuterFor(n)`
 * `= d − BEAD_GAP`，经 `targetColorIdx` 内缩 `×26/30` ⇒ 5 档面 = 12.83 ≥ 8（T-1 §3.4 表）。
 *
 * @param x       格**左缘**
 * @param yBottom 格**下缘**（本设计空间 y 向上）
 * @param w       格宽
 * @param h       格高
 * @param n       缩略档（缺省 `THUMB_MATRIX_N`；K-6 差分传 4 / 3 ⇒ 同帧对照）
 */
export function drawLevelThumb(
    builder: RenderModelBuilder,
    level: BeadsLevelRaw,
    x: number,
    yBottom: number,
    w: number,
    h: number,
    n: number = THUMB_MATRIX_N,
): void {
    const cells = levelThumbCells(level, n);
    if (cells.length === 0) return;
    const pitch = thumbPitchFor(n);
    const outer = thumbOuterFor(n);
    const left = x + (w - THUMB_AREA) / 2;
    const top = yBottom + h - THUMB_TOP_INSET;
    const inks = beadInksFor(level);
    for (let i = 0; i < cells.length; i += 3) {
        const r = cells[i]!;
        const c = cells[i + 1]!;
        const idx = cells[i + 2]!;
        beadOpts.size = outer;
        beadOpts.inks = inks;
        beadOpts.targetColorIdx = idx;
        drawFilledBead(builder, left + (c + 0.5) * pitch, top - (r + 0.5) * pitch, idx, beadOpts);
    }
}

/** 缩略面读数（口径 B，供判据 / K-6 台账用，⛔ 不参与绘制）。 */
export function thumbFaceB(n: number = THUMB_MATRIX_N): number {
    return signFaceB(thumbPitchFor(n));
}

/** 招牌档自审（位表边长与 `n` 相符 **且** 面过地板）⇒ 档位被改而位表未跟上时先红在这里。 */
export function signTierReady(n: number = SIGN_MATRIX_N, d: number = SIGN_BEAD_PITCH): boolean {
    return signFaceB(d) >= SIGN_FACE_FLOOR && signGlyphOf(0x62fc) !== undefined && signGlyphOf(0x62fc)!.n === n;
}
