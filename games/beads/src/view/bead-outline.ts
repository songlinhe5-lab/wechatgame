/**
 * `[WXG-T-925 / T-926 / T-927 / T-928 / T-929 / T-930 / T-1106]` 珠面剪影轮廓（「贴纸裁切」外圈）：沿整幅图案剪影画一圈连续描边，
 * 折叠处随每颗边界珠的圆角自然过渡。
 *
 * **绘制层**（`[WXG-T-1106 · 用户 2026-11-27 令]`「描边应该与珠子底图整体绘制，再绘制珠槽和珠面」）：
 * 对局盘面的剪影描边走**底图通道**（`back: true`，宿主 `backGraphics` = 节点树最底），恒在珠 / 底 tile
 * 与全部矢量**之下**，⛔ 不再作末笔覆在珠面之上；且**命令位置无关**（`graphics` 恒在 blit 之上，
 * 单靠把调用挪前不足以改变观感 —— 必须打 `back`，见 `drawBoardOutline` 注）。
 *
 * **带的位置分两档**（`buildShapes` 的 `outset` 形参）：
 *  - `false`（缩略 / 详情）：**骑线**（内 `W/2`、外 `W/2`），沿用 T-929 / T-1040 版面（仍走主 `Graphics`）；
 *  - `true`（**对局盘面**，`[WXG-T-1106 · 用户 2026-11-27 令]**「珠面的外描边，还是压在珠面上绘制」）：
 *    整带**外置**（内缘 = 剪影面缘、外缘 = 面缘 + W）⇒ 珠面零覆盖；盘面侧推翻 T-928 的
 *    「描边要盖在珠面上面」。
 *
 * 裁定来源（art 2026-11-12 二裁，用户令「边缘颜色适合凸显珠面，可以是黑色或者金色；
 * 线条需要连续、紧贴珠面边缘；各种珠面展示都需要加，跟珠面等比例缩放」；
 * T-927 用户三调「描边窄一点、圆角半径再大一点、游戏中也需要」；
 * T-928 用户四调「珠面描边要盖在珠面上面」；T-1106 用户再调「不要压在珠面上」）：
 *  - 颜色 = `palette.shadowInk`（暖可可 `#3D2E1E` 黑，单层实线；金色靠近珠面违反
 *    art-bible §3.5/§4.3「金色仅结算用」，且 `STAR_GOLD` 与珠色 2 柠黄同值 ⇒ 不可用）；
 *  - 线宽 / 圆角（T-930）：**1:1 基准 = 珠距 `BEAD_PITCH` 时 `W=3`、`R=9`**，
 *    其余尺寸一律 `× pitch / BEAD_PITCH` **线性等比**（缩放盘面同步放大缩小，⛔ 不再钳位）；
 *    （历史：T-926 `0.18 / 2–6` 过粗 → T-927 `0.10 / 1–4`、`0.30 / 2–9` → T-930 去钳位改纯比例）；
 *  - 贴边口径（T-929 修正）：轮廓是一条连续闭环带，逐边界珠只画露空的边 + 凸角 1/4 环带 ⇒ 随珠面等比；
 *    ⛔ 不用「整颗边界珠外扩 W 的实心圆角方块」——填色盖在珠面上会把一圈珠子涂黑；
 *  - 同色一次性并集填充（不透明重叠，不叠 α）；
 *  - 适用范围：详情橱窗 / 选关缩略 / **对局盘面**（T-927 新增；盘面与缩略同一套形状，
 *    只把占用判定从 `pattern` 换成快照格 `void`）；首页走马灯 = 烘焙作品图，描边随图烘
 *    （`[WXG-T-954]` 已补 1px `shadowInk` 剪影，见 `menu-showcase-mount-spec.md §10`）；
 *  - 形状按几何缓存 ⇒ 逐帧零重建；盘面缓存用数值键（不做字符串拼接 ⇒ 热路径零分配）。
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import { BEAD_PITCH, gridLayoutFor, TILE_BLEED } from '../config/tuning/board.js';
import type { BeadsLevelRaw } from '../config/levels-data.js';
import type { BeadsSnapshot } from '../game/state.js';

type OutlineShape = { readonly pts: number[] };
type Occupancy = (r: number, c: number) => boolean;

/**
 * `[WXG-T-930 / WXG-T-932 / T-933]` **1:1 基准**：盘面珠距 `BEAD_PITCH`（32）时描边宽 4、圆角半径 4。
 * 其余任何 pitch（缩放 / 缩略 / 详情）一律按 `pitch / BEAD_PITCH` **线性等比**，
 * ⛔ 不再上下钳位（旧 1–4 / 2–9 会让缩放后比例失真，用户令「跟着珠面等比例缩放」）。
 * T-932：W 3→4「不要把珠子边角漏出来」；T-933：R 固定 `= W`（用户令「半径和边缘宽度一样，
 * 保证圆角不会漏出来拐角」）⇒ 改 W 时 R 自动跟随，⛔ 不再单独调 R。
 */
const OUTLINE_BASE_WIDTH = 4;
const OUTLINE_BASE_RADIUS = OUTLINE_BASE_WIDTH;

/** 轮廓可见宽度（设计 px）：1:1 基准 × `pitch / BEAD_PITCH`。 */
export function thumbOutlineWidth(pitch: number): number {
    return OUTLINE_BASE_WIDTH * (pitch / BEAD_PITCH);
}

/**
 * 盘面轮廓宽度：与缩略同一条纯等比通道（⛔ 不再做 `Math.max` 下限钳位，
 * [用户 2026-11-12 令]「描边应该和珠面一起绘制后等比例缩放」）。
 */
export const boardOutlineWidth = thumbOutlineWidth;

/** 折角圆角半径（设计 px）：1:1 基准 × `pitch / BEAD_PITCH`。 */
export function thumbOutlineRadius(pitch: number): number {
    return OUTLINE_BASE_RADIUS * (pitch / BEAD_PITCH);
}

let _cache = new WeakMap<BeadsLevelRaw, { key: string; shapes: readonly OutlineShape[] }>();

let _boardCache: {
    cells: BeadsSnapshot['cells'];
    levelId: string;
    levelIndex: number;
    stageIndex: number;
    rows: number;
    cols: number;
    left: number;
    top: number;
    pitch: number;
    lockedFace: number;
    occSig: number;
    shapes: readonly OutlineShape[];
} | null = null;

/**
 * `[WXG-T-1115]` 恒等相机布局的复用形参（热路径零分配）：`gridLayoutFor` 只读它，
 * 每帧只改 `zoom`。平移恒 0 ⇒ 描边以**恒等相机坐标**发出，几何签名逐帧稳定，
 * 纯拖动帧 Outline 层可整帧冻结（`CocosRendererOptions.outlineGraphics` 协议）。
 */
const _identityPanCam: { zoom: number; offsetX: number; offsetY: number } = { zoom: 1, offsetX: 0, offsetY: 0 };

/**
 * 画珠面轮廓（必须在底块 / 珠体**之后**调用，覆在珠面之上）。
 * @param lockedFace `x` 锁定格的珠面边长（与 `drawLockedBead` 同参）——锁定格无目标色底块，
 *   轮廓贴其珠体；有目标色的格贴底块外缘（`pitch + 2×TILE_BLEED`）。
 * @param occOverride `[WXG-T-1035]` 占用覆盖（缺省 = 整幅 `pattern` 墨）——
 *   显示侧裁圈的消费方（橱窗）传**裁后**占用（按关卡缓存），否则描边会沿被裁掉的外圈走；
 *   `occKey` 必须随占用语义变化（进缓存键）。
 */
export function drawThumbOutline(
    builder: RenderModelBuilder,
    level: BeadsLevelRaw,
    left: number,
    top: number,
    pitch: number,
    lockedFace: number,
    color: string,
    occOverride?: Occupancy,
    occKey?: string,
): void {
    const key = `${occKey ?? ''}|${left}|${top}|${pitch}|${lockedFace}`;
    let hit = _cache.get(level);
    if (!hit || hit.key !== key) {
        hit = { key, shapes: buildShapes(level.pattern.length, level.cols, occOverride ?? thumbOcc(level), thumbLocked(level), left, top, pitch, lockedFace, thumbOutlineWidth(pitch), false) };
        _cache.set(level, hit);
    }
    for (const s of hit.shapes) builder.polygon(s.pts, { fill: color });
}

/**
 * `[WXG-T-927 / T-928 / T-1106]` 对局盘面轮廓：占位取自快照（`cell.void`），锁定格取自 `cell.state`。
 * **绘制命令逐条打 `back: true`**（底图通道）⇒ Cocos 端落到宿主 `backGraphics`（`Background` 节点，
 * 节点序最底），恒在珠 / 底 tile（tint blit）与全部矢量**之下**，后画的底 tile / 槽 / 珠自然盖住带的内侧；
 * 带本身**外置**（`outset = true`）⇒ 珠面零描边墨（`[WXG-T-1106 · 用户 2026-11-27 令]`）。
 * ⚠ **层序不是命令先后决定的**：`graphics` 恒在 blit 之上（`WXG-T-1106` 真机复验结论），
 * 只把调用挪到格循环前面**不足以**让描边沉到珠面下面 —— 必须打 `back`。⛔ 删掉 `back` 即回到旧观感。
 * 缓存键 = 关卡身份 + 几何（数值逐项比较，⛔ 不拼字符串 ⇒ 每帧零分配）。
 */
export function drawBoardOutline(
    builder: RenderModelBuilder,
    snap: BeadsSnapshot,
    color: string,
): void {
    // `[WXG-T-1115]` 描边以**恒等相机坐标**发出（`gridLayoutFor` 平移归零），相机 pan
    // 经 `builder.setBackPan` 下发 ⇒ Cocos Outline 静态层几何逐帧不变，纯拖动帧
    // 免清屏 / 免重三角化 / 免重上传（T-1114 实测 58% 帧间隔耗在 GPU/present 反压）。
    // base 布局与 `gridLayoutFor` 的平移项公式同源（同函数求值，⛔ 不复写公式防漂移）。
    _identityPanCam.zoom = snap.gridPitch / BEAD_PITCH;
    const base = gridLayoutFor(snap.gridCols, snap.gridRows, _identityPanCam);
    const panX = snap.gridLeft - base.left;
    const panY = snap.gridTop - base.top;
    builder.setBackPan(panX, panY);
    const left = base.left + snap.gridCell / 2 - snap.gridPitch / 2;
    const top = base.top - snap.gridCell / 2 + snap.gridPitch / 2;
    // `[WXG-T-1115]` 内容签名：格子缓冲是跨帧复用对象（引用不变）⇒ void 图案与锁定态
    // 的变化必须逐格签名才进得了缓存键。旧键含 pan 烘焙的 left/top（每帧必 miss），
    // 换恒等坐标后键自然稳定 —— 没有本签名，锁定态变化会被旧缓存吞掉（顺带修掉）。
    let occSig = 0;
    const cells = snap.cells;
    for (let i = 0; i < cells.length; i += 1) {
        const c = cells[i]!;
        occSig = (Math.imul(occSig, 31) + (c.void ? 3 : 0) + (c.state === 'locked' ? 5 : 0)) | 0;
    }
    let hit = _boardCache;
    if (
        !hit ||
        hit.cells !== cells ||
        hit.levelId !== snap.levelId ||
        hit.levelIndex !== snap.levelIndex ||
        hit.stageIndex !== snap.stageIndex ||
        hit.rows !== snap.gridRows ||
        hit.cols !== snap.gridCols ||
        hit.left !== left ||
        hit.top !== top ||
        hit.pitch !== snap.gridPitch ||
        hit.lockedFace !== snap.gridCell ||
        hit.occSig !== occSig
    ) {
        const cols = snap.gridCols;
        const occ: Occupancy = (r, c) =>
            r >= 0 && r < snap.gridRows && c >= 0 && c < cols && !cells[r * cols + c]!.void;
        const locked: Occupancy = (r, c) => cells[r * cols + c]!.state === 'locked';
        hit = {
            cells,
            levelId: snap.levelId,
            levelIndex: snap.levelIndex,
            stageIndex: snap.stageIndex,
            rows: snap.gridRows,
            cols,
            left,
            top,
            pitch: snap.gridPitch,
            lockedFace: snap.gridCell,
            occSig,
            shapes: buildShapes(snap.gridRows, cols, occ, locked, left, top, snap.gridPitch, snap.gridCell, boardOutlineWidth(snap.gridPitch), true),
        };
        _boardCache = hit;
    }
    // 逐条打 `back: true`（底图通道）⇒ 恒在珠面 / 底 tile 之下；选项对象循环外建一次（热路径零分配）。
    const paint = { fill: color, back: true } as const;
    for (const s of hit.shapes) builder.polygon(s.pts, paint);
}

function thumbOcc(level: BeadsLevelRaw): Occupancy {
    return (r, c) => r >= 0 && r < level.pattern.length && c >= 0 && c < level.cols && level.pattern[r]![c] !== '.';
}

function thumbLocked(level: BeadsLevelRaw): Occupancy {
    return (r, c) => r >= 0 && r < level.pattern.length && c >= 0 && c < level.cols && level.pattern[r]![c] === 'x';
}

/**
 * `[WXG-T-929]` 轮廓 = **骑在剪影边线上的一条带**（半宽 `W/2` 内、外各半），
 * 逐边界格只画**露空的那几条边** + 凸角四分之一环带 ⇒ 连续闭环，⛔ 不再填满整个边界珠
 * （T-928 实测：整体填色盖到珠面上会把一圈珠子涂黑）。
 */
function buildShapes(
    rows: number,
    cols: number,
    occ: Occupancy,
    locked: Occupancy,
    left: number,
    top: number,
    pitch: number,
    lockedFace: number,
    width: number,
    outset: boolean,
): OutlineShape[] {
    const bw = width / 2;
    const tileFace = pitch + TILE_BLEED * 2;
    const shapes: OutlineShape[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!occ(r, c)) continue;
            const expN = !occ(r - 1, c);
            const expE = !occ(r, c + 1);
            const expS = !occ(r + 1, c);
            const expW = !occ(r, c - 1);
            if (!expN && !expE && !expS && !expW) continue; // 内部珠：无露边
            const face = locked(r, c) ? lockedFace : tileFace;
            const f2 = face / 2;
            const R = Math.min(thumbOutlineRadius(pitch), f2 - 0.01);
            if (R <= 0) continue;
            const cx = left + (c + 0.5) * pitch;
            const cy = top - (r + 0.5) * pitch;
            // `[WXG-T-1106 · 用户 2026-11-27 令]` `outset = true`（仅对局盘面）⇒ 带**整体落在剪影外侧**
            // （内缘 = 面缘 `f2`、外缘 = `f2 + W`），珠面零覆盖；`false`（缩略 / 详情）仍骑线（`f2 ± W/2`，
            // 沿用 T-929 / T-1040 口径，⛔ 不动那两处版面）。
            const nIn = outset ? f2 : f2 - bw;
            const nOut = outset ? f2 + width : f2 + bw;
            // 凸角 = 两相邻边都露空 **且** 斜对角也空（凹角不圆，交给邻格带在缝上自然相接）。
            const cvNE = expN && expE && !occ(r - 1, c + 1);
            const cvSE = expE && expS && !occ(r + 1, c + 1);
            const cvSW = expS && expW && !occ(r + 1, c - 1);
            const cvNW = expW && expN && !occ(r - 1, c - 1);
            // 带端收口（[WXG-T-931] 修断线）：露空边收 R（凸角交给环带）；紧邻占用格则**延伸到本格面缘**
            // `f2` —— 相邻两格底块本身重叠 `2×TILE_BLEED = 1`，两端各到 `f2` 才接得上；
            // ⛔ 旧口径收到 `pitch − f2`（= f2 − 1）会让每段直边缩 1px，形成断线。
            const end = (expSide: boolean, convex: boolean): number => (expSide ? (convex ? f2 - R : f2) : f2);
            if (expN) {
                const x0 = cx - end(expW, cvNW);
                const x1 = cx + end(expE, cvNE);
                shapes.push({ pts: [x0, cy + nIn, x1, cy + nIn, x1, cy + nOut, x0, cy + nOut] });
            }
            if (expS) {
                const x0 = cx - end(expW, cvSW);
                const x1 = cx + end(expE, cvSE);
                shapes.push({ pts: [x0, cy - nOut, x1, cy - nOut, x1, cy - nIn, x0, cy - nIn] });
            }
            if (expW) {
                const y0 = cy - end(expS, cvSW);
                const y1 = cy + end(expN, cvNW);
                shapes.push({ pts: [cx - nOut, y0, cx - nIn, y0, cx - nIn, y1, cx - nOut, y1] });
            }
            if (expE) {
                const y0 = cy - end(expS, cvSE);
                const y1 = cy + end(expN, cvNE);
                shapes.push({ pts: [cx + nIn, y0, cx + nOut, y0, cx + nOut, y1, cx + nIn, y1] });
            }
            const rIn = outset ? R : R - bw;
            const rOut = outset ? R + width : R + bw;
            if (cvNE) shapes.push({ pts: cornerBand(cx + f2 - R, cy + f2 - R, 0, rIn, rOut) });
            if (cvNW) shapes.push({ pts: cornerBand(cx - f2 + R, cy + f2 - R, Math.PI / 2, rIn, rOut) });
            if (cvSW) shapes.push({ pts: cornerBand(cx - f2 + R, cy - f2 + R, Math.PI, rIn, rOut) });
            if (cvSE) shapes.push({ pts: cornerBand(cx + f2 - R, cy - f2 + R, Math.PI * 1.5, rIn, rOut) });
        }
    }
    return shapes;
}

/** 凸角 1/4 环带（外弧 → 内弧反向，设计空间 y 向上）；半径直接给内/外弧（骑线档 = `R∓W/2`，外置档 = `R…R+W`）。 */
function cornerBand(cx: number, cy: number, a0: number, rIn: number, rOut: number): number[] {
    const pts: number[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
        const a = a0 + (Math.PI / 2) * (i / steps);
        pts.push(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
    }
    if (rIn > 0.01) {
        for (let i = steps; i >= 0; i--) {
            const a = a0 + (Math.PI / 2) * (i / steps);
            pts.push(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
        }
    } else {
        pts.push(cx, cy);
    }
    return pts;
}
