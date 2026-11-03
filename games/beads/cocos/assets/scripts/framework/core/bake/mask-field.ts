/**
 * `[WXG-T-226 EP12-S1 / ADR-0029 DEC-3 · DEC-6]` tint mask **场计算**（纯数学）。
 *
 * `MaskSpec`（纯数据，见 `mask-spec.ts`）→ 本模块 → `MaskField`（`Uint8Array` RGBA，**已按 DEC-6 编码**）。
 * 落盘/入库（PNG / 纹理）由 adapter 负责（⛔ core 不碰 canvas/平台 API，L2）。
 *
 * ## L2 / L4 合规
 *
 * 纯计算：无 `cc` / DOM / `wx` / `window` / `document`、无文件系统、无 `Math.random`。
 *
 * ## 拆分结构（2026-11-03 WXG-T-567）
 *
 * 原始 mask-field.ts（746 行）拆为五模块，逐字节复刻纪律（逐函数 mask:diff 对拍绿）：
 * - `mask-lanczos.ts` — PIL 12.x LANCZOS ÷4 重采样（Step 1，mask:diff 四档 mean=0）
 * - `mask-geometry.ts` — 纯数学 + 光照场（clamp01 / cInt / pyround / to8 / cosineLight / frameSideWeights / upMembership）
 * - `mask-fill.ts` — 栅格化（fillHline / fillRectMask / fillPolygonMask / fillRoundedRectMask + 椭圆状态机）
 * - **本文件只留场计算主流程**（Planes + applyLayerSet / beadShapePlane / paintHoleRing / paintFrameLight / computeBeadPlanes / cellShapePlane / computeCellPlanes / packRGBA / computeMaskField）
 */

import {
    FRAME_EDGE_D,
    FRAME_LEFT_W,
    FRAME_RIGHT_W,
    FRAME_SIDE_D_BASE,
    FRAME_SIDE_D_SPAN,
    FRAME_T_INNER,
    GRID_EDGE_D_LIT,
    GRID_EDGE_D_SPAN,
    MASK_CELL_DP,
    MASK_SUPERSAMPLE,
    type BeadMaskKind,
    type MaskGaugeSpec,
    type MaskLayer,
} from './mask-spec';
import { resampleSquare } from './mask-lanczos';
import {
    clamp01, cInt, to8, cosineLight, frameSideWeights, upMembership, pyround,
} from './mask-geometry';
import {
    fillRectMask, fillPolygonMask, fillRoundedRectMask,
} from './mask-fill';
import { acquireUint8, releaseUint8 } from '../pool/typedarray-pool';

/** 场计算产物：交错 RGBA，**已按 DEC-6 编码**（`R=d / G=l / B=形状 / A=255`）。 */
export interface MaskField {
    readonly width: number;
    readonly height: number;
    /** `width × height × 4`，交错 RGBA。 */
    readonly data: Uint8Array;
}

// ─── 场计算主流程 ────────────────────────────────────────────────────────

interface Planes {
    r: Uint8Array;
    g: Uint8Array;
    b: Uint8Array;
}

/** 层集逐层覆盖（R/G **无条件双写** —— DEC-6 承 WXG-T-229 D1 修复：跳过 ⇒ 底层 d 渗漏）。 */
function applyLayerSet(p: Planes, render: number, px: number, layers: readonly MaskLayer[]): void {
    const n = render * render;
    const _buf = acquireUint8(n);
    const mask = _buf.subarray(0, n);
    try {
        const xs: number[] = [];
        const ys: number[] = [];
        for (const layer of layers) {
            if (layer.kind === 'circle') continue;
            mask.fill(0);
            if (layer.kind === 'rect') {
                const x0 = layer.x * px;
                const y0 = render - layer.y * px - layer.h * px;
                const w = layer.w * px;
                const h = layer.h * px;
                const r = layer.r * px;
                if (r > 0) fillRoundedRectMask(mask, render, render, x0, y0, x0 + w, y0 + h, r, 255);
                else fillRectMask(mask, render, render, pyround(x0), pyround(y0), pyround(x0 + w), pyround(y0 + h), 255);
            } else {
                xs.length = 0; ys.length = 0;
                const pts = layer.pts;
                for (let i = 0; i + 1 < pts.length; i += 2) {
                    xs.push(cInt(pts[i]! * px));
                    ys.push(cInt(render - pts[i + 1]! * px));
                }
                fillPolygonMask(mask, render, render, xs, ys, 255);
            }
            const dr = to8(layer.d <= 1 ? layer.d : 1);
            const lg = to8(layer.l <= 1 ? layer.l : 1);
            for (let i = 0; i < mask.length; i++) {
                if (mask[i]! > 0) { p.r[i] = dr; p.g[i] = lg; }
            }
        }
    } finally {
        releaseUint8(_buf);
    }
}

/** 珠形 B 通道（圆角方 − 真透孔 + 0.5dp smoothstep 羽化；无孔档 = 满幅圆角方）。 */
function beadShapePlane(spec: MaskGaugeSpec, render: number, px: number): Uint8Array {
    const n = render * render;
    const _s = acquireUint8(n);
    const shape = _s.subarray(0, n);
    const o0 = ((spec.cellDp - spec.beadDp) / 2) * px;
    const o1 = ((spec.cellDp + spec.beadDp) / 2) * px;
    fillRoundedRectMask(shape, render, render, o0, o0, o1, o1, spec.beadCornerDp * px, 255);
    if (spec.holeDp <= 0) {
        // 无孔档直接 return shape 池化 buffer；调用方用完后 releaseUint8 归槽
        return shape;
    }
    const c = render / 2;
    const holeR = (spec.holeDp / 2) * px;
    const feather = spec.holeFeatherDp * px;
    const _o = acquireUint8(n);
    const out = _o.subarray(0, n);
    for (let y = 0; y < render; y++) {
        const dy = y - c;
        for (let x = 0; x < render; x++) {
            const dx = x - c;
            const dist = Math.sqrt(dx * dx + dy * dy);
            let k = clamp01((dist - (holeR - feather)) / (2 * feather));
            k = k * k * (3 - 2 * k);
            out[y * render + x] = cInt(shape[y * render + x]! * k);
        }
    }
    // shape 已用完，归还
    releaseUint8(_s);
    // return 池化的 out 给调用方，调用方用完后 releaseUint8
    return out;
}

/** 孔边 1dp 斜面（内凹：上内壁 → hole 档、下内壁 → lit）。⛔ 孔区不做硬清零。 */
function paintHoleRing(p: Planes, spec: MaskGaugeSpec, render: number, px: number): void {
    if (spec.holeDp <= 0) return;
    const c = render / 2;
    const rIn = (spec.holeDp / 2) * px;
    const rOut = rIn + spec.holeRingDp * px;
    for (let y = 0; y < render; y++) {
        const dy = y - c;
        for (let x = 0; x < render; x++) {
            const dx = x - c;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const isRing = dist >= rIn && dist < rOut;
            const isHole = dist < rIn;
            if (!isRing && !isHole) continue;
            const light = cosineLight(dx, dy);
            const fade = isRing ? 1 - clamp01((dist - rIn) / (rOut - rIn)) : 1;
            const i = y * render + x;
            p.r[i] = to8(spec.plateD - spec.darkStep * light * fade);
            p.g[i] = to8(spec.litL * (1 - light) * fade);
        }
    }
}

/** 珠外框 1dp 斜面（四扇单调斜率 上0.70/左0.63/右0.52/下0.42；外缘 −0.10·t）。 */
function paintFrameLight(p: Planes, spec: MaskGaugeSpec, render: number, px: number): void {
    const o0 = ((spec.cellDp - spec.beadDp) / 2) * px;
    const o1 = ((spec.cellDp + spec.beadDp) / 2) * px;
    const w = spec.frameDp * px;
    const n = render * render;
    const _o = acquireUint8(n);
    const _i = acquireUint8(n);
    const outer = _o.subarray(0, n);
    const inner = _i.subarray(0, n);
    try {
        fillRoundedRectMask(outer, render, render, o0, o0, o1, o1, spec.beadCornerDp * px, 255);
        fillRoundedRectMask(
            inner, render, render,
            o0 + w, o0 + w, o1 - w, o1 - w,
            Math.max(0, spec.beadCornerDp * px - w), 255,
        );
        const c = render / 2;
        for (let y = 0; y < render; y++) {
            const dy = y - c;
            for (let x = 0; x < render; x++) {
                const i = y * render + x;
                if (outer[i]! === 0 || inner[i]! > 0) continue;
                const dx = x - c;
                const up = upMembership(dx, dy);
                const sw = frameSideWeights(dx, dy);
                const sideD = FRAME_SIDE_D_BASE + FRAME_SIDE_D_SPAN * (up + FRAME_LEFT_W * sw.left + FRAME_RIGHT_W * sw.right);
                p.r[i] = to8(sideD + FRAME_EDGE_D);
                p.g[i] = to8(spec.litL * up);
            }
        }
    } finally {
        releaseUint8(_o);
        releaseUint8(_i);
    }
    void FRAME_T_INNER;
}

/**
 * `[WXG-T-226 WXG-T-232]` **形状通道去振铃地板**（LANCZOS 硬台阶的残留斑点）。
 * ⛔ **两侧（py / TS）必须同值** —— 否则 `mask:diff` 逐字节门立即红。
 */
const SHAPE_RINGING_FLOOR = 8;
function applyShapeFloor(plane: Uint8Array): Uint8Array {
    for (let i = 0; i < plane.length; i += 1) {
        if (plane[i]! < SHAPE_RINGING_FLOOR) plane[i] = 0;
    }
    return plane;
}

function computeBeadPlanes(spec: MaskGaugeSpec, size: number): Planes {
    const render = size * MASK_SUPERSAMPLE;
    const px = render / MASK_CELL_DP;
    const n = render * render;
    const _r = acquireUint8(n);
    const _g = acquireUint8(n);
    const _b = acquireUint8(n);
    const p: Planes = { r: _r.subarray(0, n), g: _g.subarray(0, n), b: _b.subarray(0, n) };
    applyLayerSet(p, render, px, spec.beadLayers);
    paintHoleRing(p, spec, render, px);
    paintFrameLight(p, spec, render, px);
    const br = resampleSquare(p.r, render, size);
    const bg = resampleSquare(p.g, render, size);
    // beadShapePlane return 池化 buffer → resampleSquare 用完后归还
    const _bs = beadShapePlane(spec, render, px);
    const bb = applyShapeFloor(resampleSquare(_bs, render, size));
    releaseUint8(_bs);
    releaseUint8(_r);
    releaseUint8(_g);
    releaseUint8(_b);
    return { r: br, g: bg, b: bb };
}

function cellShapePlane(spec: MaskGaugeSpec, size: number): Uint8Array {
    const n = size * size;
    const _o = acquireUint8(n);
    const out = _o.subarray(0, n);
    const px = size / MASK_CELL_DP;
    const c = size / 2;
    const q = (spec.slotHalfDp - spec.slotCornerDp) * px;
    const cornerPx = spec.slotCornerDp * px;
    const ringOnly = spec.gauge !== 'holeless';
    const edgePx = spec.slotEdgeDp * px;
    for (let y = 0; y < size; y += 1) {
        const dy = y - c;
        for (let x = 0; x < size; x += 1) {
            const dx = x - c;
            const qx = Math.abs(dx) - q;
            const qy = Math.abs(dy) - q;
            const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cornerPx;
            out[y * size + x] = sd <= 0 && (!ringOnly || sd >= -edgePx) ? 255 : 0;
        }
    }
    return out;
}

/** 格面场（**纯程序化**：⛔ 不消费 `cellLayers`）。 */
function computeCellPlanes(spec: MaskGaugeSpec, size: number): Planes {
    const render = size * MASK_SUPERSAMPLE;
    const px = render / MASK_CELL_DP;
    const c = render / 2;
    const edgePx = spec.slotEdgeDp * px;
    const q = (spec.slotHalfDp - spec.slotCornerDp) * px;
    const cornerPx = spec.slotCornerDp * px;
    const n = render * render;
    const _rh = acquireUint8(n);
    const _gh = acquireUint8(n);
    const rHi = _rh.subarray(0, n);
    const gHi = _gh.subarray(0, n);
    for (let y = 0; y < render; y++) {
        const dy = y - c;
        for (let x = 0; x < render; x++) {
            const dx = x - c;
            const rg = Math.sqrt(dx * dx + dy * dy) + 1e-6;
            const uy = dy / rg;
            const downW = clamp01((uy - Math.abs(dx / rg)) * 2);
            const qx = Math.abs(dx) - q;
            const qy = Math.abs(dy) - q;
            const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cornerPx;
            const i = y * render + x;
            let d: number; let l = 0;
            if (sd >= -edgePx && sd <= 0) {
                const tIn = clamp01(-sd / edgePx);
                const dEdge = GRID_EDGE_D_LIT - GRID_EDGE_D_SPAN * clamp01(1 - uy);
                d = dEdge + (spec.slotFloorD - dEdge) * tIn;
                l = spec.litL * downW * (1 - tIn);
            } else if (sd < -edgePx) { d = spec.slotFloorD; }
            else { d = spec.outsideD; }
            rHi[i] = to8(d);
            gHi[i] = to8(l);
        }
    }
    const br = resampleSquare(rHi, render, size);
    const bg = resampleSquare(gHi, render, size);
    releaseUint8(_rh);
    releaseUint8(_gh);
    return {
        r: br,
        g: bg,
        b: cellShapePlane(spec, size),
    };
}

/** 平面 → 交错 RGBA（`A = 255` 满幅，免疫 Trim —— DEC-6）。 */
function packRGBA(p: Planes, size: number): Uint8Array {
    const out = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        out[i * 4] = p.r[i]!;
        out[i * 4 + 1] = p.g[i]!;
        out[i * 4 + 2] = p.b[i]!;
        out[i * 4 + 3] = 255;
    }
    return out;
}

/**
 * 场计算入口（`MaskSpec` → `MaskField`）。
 *
 * - `kind = 'bead'`：珠面（圆角方 − 真透孔 + 刻面 + 孔边 + 外框）。
 * - `kind = 'cell'`：格面（槽口 3dp 斜面 + 槽底/格外定值）。
 * - `size` 必须是 `MASK_SUPERSAMPLE` 的整数倍（÷4 整数比 LANCZOS）。
 */
export function computeMaskField(kind: BeadMaskKind, spec: MaskGaugeSpec, size: number): MaskField {
    if (size % MASK_SUPERSAMPLE !== 0) {
        throw new Error(`computeMaskField: size=${size} must be divisible by MASK_SUPERSAMPLE=${MASK_SUPERSAMPLE}`);
    }
    const planes = kind === 'bead' ? computeBeadPlanes(spec, size) : computeCellPlanes(spec, size);
    try {
        const data = packRGBA(planes, size);
        return { width: size, height: size, data };
    } finally {
        // cellShapePlane return 的池化 out → Planes.b → packRGBA 用完后归还
        // beadShapePlane 无孔档池化 shape 也走 Planes.b，同一处覆盖
        // releaseUint8 对非池化 buffer 安全（bucketIndex 找不到桶就跳过）
        releaseUint8(planes.b);
    }
}
