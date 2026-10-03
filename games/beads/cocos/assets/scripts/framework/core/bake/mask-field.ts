/**
 * `[WXG-T-226 EP12-S1 / ADR-0029 DEC-3 · DEC-6]` tint mask **场计算**（纯数学）。
 *
 * `MaskSpec`（纯数据，见 `mask-spec.ts`）→ 本模块 → `MaskField`（`Uint8Array` RGBA，**已按 DEC-6 编码**）。
 * 落盘/入库（PNG / 纹理）由 adapter 负责（⛔ core 不碰 canvas/平台 API，L2）。
 *
 * ## 为什么逐式复刻定稿 py 的实现细节
 *
 * DEC-3 要求 py 产物与 TS 场计算容差内一致（`mask:diff` 对拍门禁）。定稿 py 的位图来自
 * **PIL 12.x**：`ImageDraw.rounded_rectangle`（Python 层 `round()` + 4 段 90° `pieslice` +
 * 中间竖带 + 左右竖条）、`polygon`（`polygon_generic` 扫描线，`ROUND_UP/ROUND_DOWN`）、
 * `resize(LANCZOS)`（3 瓣 lanczos、support 3、系数归一化后量化到 2²² 定点、两遍顺序）。
 * 这些是位图一致性的前提 ⇒ 本模块逐式复刻（各处注明 C 出处），漂移面收敛为「py 与本模块的
 * 平台/版本差异」一处，由对拍门禁暴露（R-4 缓解）。
 *
 * ## L2 / L4 合规
 *
 * 纯计算：无 `cc` / DOM / `wx` / `window` / `document`、无文件系统、无 `Math.random`。
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

/** 场计算产物：交错 RGBA，**已按 DEC-6 编码**（`R=d / G=l / B=形状 / A=255`）。 */
export interface MaskField {
    readonly width: number;
    readonly height: number;
    /** `width × height × 4`，交错 RGBA。 */
    readonly data: Uint8Array;
}

function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** C `(int)` = 向零截断。 */
function cInt(v: number): number {
    return Math.trunc(v);
}

/** Python `round()` = 银行家舍入（half-to-even）；`rounded_rectangle` 的坐标预处理。 */
function pyround(v: number): number {
    const f = Math.floor(v);
    const diff = v - f;
    if (diff > 0.5) return f + 1;
    if (diff < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
}

/** `Draw.c`: `ROUND_UP(f) = (int)(f >= 0 ? f + 0.5 : f - 0.5)`。 */
function roundUp(v: number): number {
    return cInt(v >= 0 ? v + 0.5 : v - 0.5);
}

/** `Draw.c`: `ROUND_DOWN(f) = (int)(f >= 0 ? ceil(f - 0.5) : -ceil(|f| - 0.5))`。 */
function roundDown(v: number): number {
    return v >= 0 ? Math.ceil(v - 0.5) : -Math.ceil(Math.abs(v) - 0.5);
}

/** 定稿 py 的 `int(v * 255)`（向零截断）+ CLIP8。 */
function to8(v: number): number {
    const t = cInt(v * 255);
    return t < 0 ? 0 : t > 255 ? 255 : t;
}

// ─── 光照场（承定稿 py：`light_map` / `facet_light` / `UP_W`） ─────────────

/** 连续受光系数 0..1：余弦，峰 = 图像左上（`atan2` 的 y 向下 ⇒ 峰角 225°）。 */
function cosineLight(dx: number, dy: number): number {
    return 0.5 + 0.5 * Math.cos(Math.atan2(dy, dx) - (225 * Math.PI) / 180);
}

/**
 * 外框用的**左/右扇隶属度** —— 与定稿 py 的 `_left_w` / `_right_w` **同式直算**
 * （facet-4 同构亮度场：上 1.0 / 右 0.74 / 下 0.37 / 左 0，方向权重 `×2` 后 clip 到 0..1）。
 *
 * ⚠ **⛔ 不可写成 `1 − up − right − down`（四扇补集）**：四扇权重之和并不恒为 1，在**对角线 45°**
 * 上三扇全为 0 ⇒ 补集式会给出 `left = 1`，而 py 的直算式给出 0。外框恰好在这条对角线上取值
 * （四个圆角的 45° 点）⇒ 用补集式会把外框 d 从 0.42 抬到 0.63，实测在 128 产物上造成
 * 四角弧各约 900 像素、R 通道 Δ 最大 57（已实测复现并修正）。
 */
function frameSideWeights(dx: number, dy: number): { left: number; right: number } {
    const r = Math.sqrt(dx * dx + dy * dy) + 1e-6;
    const ux = dx / r;
    const uy = dy / r;
    return {
        left: clamp01((-ux - Math.abs(uy)) * 2),
        right: clamp01((ux - Math.abs(uy)) * 2),
    };
}

/** 上扇隶属度 `UP_W`（外框受光提亮用；⛔ 不用余弦 —— 见定稿 py 注：正上 0.85 与本体 0.38 差 0.06 = 接缝台阶）。 */
function upMembership(dx: number, dy: number): number {
    const r = Math.sqrt(dx * dx + dy * dy) + 1e-6;
    return clamp01((-dy / r - Math.abs(dx / r)) * 2);
}

// ─── 栅格化（PIL 12.x 逐式复刻） ──────────────────────────────────────────

/** `hline8`：y 越界整行丢弃；x 端点**含**（`x1 = CLIP(x1 + 1)` ⇒ 半开区间右端）。 */
function fillHline(plane: Uint8Array, w: number, h: number, x0: number, y: number, x1: number, value: number): void {
    if (y < 0 || y >= h) return;
    if (x1 < 0 || x0 >= w) return;
    const xa = x0 < 0 ? 0 : x0;
    const xb = x1 >= w ? w - 1 : x1;
    if (xa > xb) return;
    const row = y * w;
    for (let x = xa; x <= xb; x++) plane[row + x] = value;
}

/** `ImagingDrawRectangle` fill=1（y 从 y0 到 y1 含；hline 端点含）。 */
function fillRectMask(plane: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, value: number): void {
    if (y1 < y0) {
        const t = y1;
        y1 = y0;
        y0 = t;
    }
    const ya = Math.max(0, y0);
    const yb = Math.min(h - 1, y1);
    for (let y = ya; y <= yb; y++) fillHline(plane, w, h, x0, y, x1, value);
}

interface Edge {
    x0: number;
    y0: number;
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    dx: number;
}

function newEdge(): Edge {
    return { x0: 0, y0: 0, xmin: 0, ymin: 0, xmax: 0, ymax: 0, dx: 0 };
}

/** `Draw.c::add_edge`。 */
function addEdge(e: Edge, x0: number, y0: number, x1: number, y1: number): void {
    e.xmin = x0 <= x1 ? x0 : x1;
    e.xmax = x0 <= x1 ? x1 : x0;
    e.ymin = y0 <= y1 ? y0 : y1;
    e.ymax = y0 <= y1 ? y1 : y0;
    e.dx = y0 === y1 ? 0 : (x1 - x0) / (y1 - y0);
    e.x0 = x0;
    e.y0 = y0;
}

/**
 * `polygon_generic`（`Draw.c`）的 8bpc 分支逐式复刻：逐整数扫描线求交点（`>=ymin && <=ymax`）→
 * `qsort` → `hline(ROUND_UP(xx[i-1]), ROUND_DOWN(xx[i]))`。坐标已由调用方**向零截断**
 * （`_draw_polygon` 的 `ixy[i] = (int)xy[i]`）。
 */
function fillPolygonMask(
    plane: Uint8Array,
    w: number,
    h: number,
    xs: readonly number[],
    ys: readonly number[],
    value: number,
): void {
    const count = xs.length;
    if (count < 2) return;
    const edges: Edge[] = [];
    for (let i = 0; i < count - 1; i++) {
        const x0 = xs[i]!;
        const y0 = ys[i]!;
        const x1 = xs[i + 1]!;
        const y1 = ys[i + 1]!;
        if (y0 === y1 && i !== 0 && y0 === ys[i - 1]) {
            // 紧跟另一条水平线：合并（`ImagingDrawPolygon` 的水平边合并分支）。
            const last = edges[edges.length - 1];
            if (last === undefined) continue;
            if (x1 > x0 && x0 > xs[i - 1]!) {
                last.xmax = x1;
                continue;
            }
            if (x1 < x0 && x0 < xs[i - 1]!) {
                last.xmin = x1;
                continue;
            }
        }
        const e = newEdge();
        addEdge(e, x0, y0, x1, y1);
        edges.push(e);
    }
    if (xs[count - 1] !== xs[0] || ys[count - 1] !== ys[0]) {
        const e = newEdge();
        addEdge(e, xs[count - 1]!, ys[count - 1]!, xs[0]!, ys[0]!);
        edges.push(e);
    }

    const table: Edge[] = [];
    let ymin = h - 1;
    let ymax = 0;
    for (const e of edges) {
        if (ymin > e.ymin) ymin = e.ymin;
        if (ymax < e.ymax) ymax = e.ymax;
        if (e.ymin === e.ymax) {
            // 水平边：8bpc 分支直接 hline（不进边表）。
            fillHline(plane, w, h, e.xmin, e.ymin, e.xmax, value);
            continue;
        }
        table.push(e);
    }
    if (table.length === 0) return;
    if (ymin < 0) ymin = 0;
    if (ymax > h) ymax = h;

    const xx: number[] = [];
    for (let y = ymin; y <= ymax; y++) {
        xx.length = 0;
        for (let i = 0; i < table.length; i++) {
            const cur = table[i]!;
            if (y < cur.ymin || y > cur.ymax) continue;
            xx.push((y - cur.y0) * cur.dx + cur.x0);
            if (y === cur.ymax && y < ymax) {
                xx.push(xx[xx.length - 1]!); // 重复交点（接角）
            } else if ((y === cur.ymin || y === cur.ymax) && cur.dx !== 0) {
                // `Draw.c`「connect discontiguous corners」修正。
                for (let k = 0; k < i; k++) {
                    const other = table[k]!;
                    if ((y !== other.ymin && y !== other.ymax) || other.dx === 0) continue;
                    if (cInt(xx[xx.length - 1]! + (xx[xx.length - 1]! < 0 ? -0.5 : 0.5)) !== cInt((y - other.y0) * other.dx + other.x0 + ((y - other.y0) * other.dx + other.x0 < 0 ? -0.5 : 0.5))) continue;
                    const offset = y === cur.ymax ? -1 : 1;
                    const adjCur = (y + offset - cur.y0) * cur.dx + cur.x0;
                    if (y + offset < other.ymin || y + offset > other.ymax) continue;
                    const adjOther = (y + offset - other.y0) * other.dx + other.x0;
                    const v = xx[xx.length - 1]!;
                    if (v > adjCur + 1 && v > adjOther + 1) {
                        xx[xx.length - 1] = cInt(Math.max(adjCur, adjOther) + 0.5) + 1;
                    } else if (v < adjCur - 1 && v < adjOther - 1) {
                        xx[xx.length - 1] = cInt(Math.min(adjCur, adjOther) - 0.5) - 1;
                    }
                    break;
                }
            }
        }
        xx.sort((a, b) => a - b);
        for (let i = 1; i < xx.length; i += 2) {
            fillHline(plane, w, h, roundUp(xx[i - 1]!), y, roundDown(xx[i]!), value);
        }
    }
}

// ─── 椭圆状态机（`Draw.c::quarter_state` / `ellipse_state`） ───────────────

interface QuarterState {
    cx: number;
    cy: number;
    ex: number;
    ey: number;
    a2: number;
    b2: number;
    a2b2: number;
    finished: boolean;
}

function quarterInit(a: number, b: number): QuarterState | undefined {
    if (a < 0 || b < 0) return undefined;
    return {
        cx: a,
        cy: b % 2,
        ex: a % 2,
        ey: b,
        a2: a * a,
        b2: b * b,
        a2b2: a * a * b * b,
        finished: false,
    };
}

function quarterDelta(s: QuarterState, x: number, y: number): number {
    return Math.abs(s.a2 * y * y + s.b2 * x * x - s.a2b2);
}

/** 返回 `{ code: -1 | 0, x, y }` —— C 的 `quarter_next` 用引用出参，此处改为返回值。 */
function quarterNext(s: QuarterState): { code: number; x: number; y: number } {
    if (s.finished) return { code: -1, x: 0, y: 0 };
    const rx = s.cx;
    const ry = s.cy;
    if (s.cx === s.ex && s.cy === s.ey) {
        s.finished = true;
        return { code: 0, x: rx, y: ry };
    }
    let nx = s.cx;
    let ny = s.cy + 2;
    let ndelta = quarterDelta(s, nx, ny);
    if (nx > 1) {
        const c1 = quarterDelta(s, s.cx - 2, s.cy + 2);
        if (ndelta > c1) {
            nx = s.cx - 2;
            ny = s.cy + 2;
            ndelta = c1;
        }
        const c2 = quarterDelta(s, s.cx - 2, s.cy);
        if (ndelta > c2) {
            nx = s.cx - 2;
            ny = s.cy;
        }
    }
    s.cx = nx;
    s.cy = ny;
    return { code: 0, x: rx, y: ry };
}

/**
 * `ellipse_next`（fill 模式 ⇒ `width = a + b`）的整数跨度枚举。
 *
 * 端口要点（C 语义）：`ellipse_init` 消费外椭圆第一个点存入 `pr/py`；每轮取
 * `y = py / r = pr`（**旧值**），再把外椭圆推进到 `cy > y`；内椭圆（fill 时退化）推进到
 * `cy ≤ y` 取 `l`；按四个象限发 4 条跨度，`l == 0` 时左端抬到 2。
 */
function forEachFilledEllipseSpan(a: number, b: number, emit: (y: number, xLo: number, xHi: number) => void): void {
    const width = a + b; // fill=1
    const leftmost = a % 2;
    const so = quarterInit(a, b);
    if (so === undefined || width < 1) return;
    const first = quarterNext(so);
    if (first.code === -1) return;
    let pr = first.x;
    let py = first.y;
    const si = quarterInit(a - 2 * (width - 1), b - 2 * (width - 1));
    let pl = leftmost;
    for (;;) {
        const y = py;
        const r = pr;
        let l = pl;
        let next = quarterNext(so);
        while (next.code !== -1 && next.y <= y) {
            next = quarterNext(so);
        }
        const outerDone = next.code === -1;
        if (!outerDone) {
            pr = next.x;
            py = next.y;
        }
        if (si !== undefined) {
            let n2 = quarterNext(si);
            while (n2.code !== -1 && n2.y <= y) {
                l = n2.x;
                n2 = quarterNext(si);
            }
            pl = n2.code === -1 ? leftmost : n2.x;
        }
        const hasWidth = l > 0 || l < r;
        if (hasWidth && y > 0) emit(y, l === 0 ? 2 : l, r);
        if (y > 0) emit(y, -r, -l);
        if (hasWidth) emit(-y, l === 0 ? 2 : l, r);
        emit(-y, -r, -l);
        if (outerDone) break;
    }
}

/**
 * 90° 象限的椭圆填充（对应 `rounded_rectangle` 的四段 `draw_pieslice`）。
 * `qx` = −1 左 / +1 右；`qy` = −1 上 / +1 下。
 *
 * 象限裁剪与 `clip_tree` 在 90° 象限上的行为一致：半平面过圆心 ⇒
 * Y 侧按**整行**丢弃（`A≈0` 分支），X 侧把越界端 `lround` 到 0（跨界则裁到 0，纯越界则整段丢弃）。
 */
function fillQuarterEllipse(
    plane: Uint8Array,
    w: number,
    h: number,
    bx0: number,
    by0: number,
    bx1: number,
    by1: number,
    qx: number,
    qy: number,
    value: number,
): void {
    const X0 = cInt(bx0);
    const Y0 = cInt(by0);
    const X1 = cInt(bx1);
    const Y1 = cInt(by1);
    const a = X1 - X0;
    const b = Y1 - Y0;
    if (a < 0 || b < 0) return;
    forEachFilledEllipseSpan(a, b, (Y, xLo, xHi) => {
        if (qy < 0 ? Y > 0 : Y < 0) return;
        let lo = xLo;
        let hi = xHi;
        if (qx < 0) {
            if (lo > 0) return;
            if (hi > 0) hi = 0;
        } else {
            if (hi < 0) return;
            if (lo < 0) lo = 0;
        }
        if (lo > hi) return;
        fillHline(plane, w, h, X0 + cInt((lo + a) / 2), Y0 + cInt((Y + b) / 2), X0 + cInt((hi + a) / 2), value);
    });
}

/**
 * 圆角矩形填充 —— 复刻 `ImageDraw.rounded_rectangle`（Python 层）的**分解**：
 * `x0/y0/x1/y1` 走 `round()`，`d = radius × 2`（可被 `full_x/full_y` 覆写），`r = int(d // 2)`；
 * 填充 = 4 段 90° `pieslice` + （`full_x` ? 上下横带 : 中间竖带) + 左右竖条。
 */
function fillRoundedRectMask(
    plane: Uint8Array,
    w: number,
    h: number,
    fx0: number,
    fy0: number,
    fx1: number,
    fy1: number,
    radius: number,
    value: number,
): void {
    const x0 = pyround(fx0);
    const y0 = pyround(fy0);
    const x1 = pyround(fx1);
    const y1 = pyround(fy1);
    let d = radius * 2;
    const fullX = d >= x1 - x0 - 1;
    const fullY = d >= y1 - y0 - 1;
    if (fullX) d = x1 - x0;
    if (fullY) d = y1 - y0;
    if (d === 0) {
        fillRectMask(plane, w, h, x0, y0, x1, y1, value);
        return;
    }
    const r = cInt(d / 2);

    fillQuarterEllipse(plane, w, h, x0, y0, x0 + d, y0 + d, -1, -1, value); // 180→270 上左
    fillQuarterEllipse(plane, w, h, x1 - d, y0, x1, y0 + d, 1, -1, value); // 270→360 上右
    fillQuarterEllipse(plane, w, h, x1 - d, y1 - d, x1, y1, 1, 1, value); // 0→90 下右
    fillQuarterEllipse(plane, w, h, x0, y1 - d, x0 + d, y1, -1, 1, value); // 90→180 下左

    if (fullX) {
        fillRectMask(plane, w, h, x0, y0 + r + 1, x1, y1 - r - 1, value);
    } else if (x1 - r - 1 > x0 + r + 1) {
        fillRectMask(plane, w, h, x0 + r + 1, y0, x1 - r - 1, y1, value);
    }
    if (!fullX && !fullY) {
        fillRectMask(plane, w, h, x0, y0 + r + 1, x0 + r, y1 - r - 1, value);
        fillRectMask(plane, w, h, x1 - r, y0 + r + 1, x1, y1 - r - 1, value);
    }
    void fullY;
}

// ─── LANCZOS ÷4（`Resample.c` 8bpc 定点路径逐式复刻） ─────────────────────

/** `Resample.c`: `PRECISION_BITS = 32 − 8 − 2`。 */
const PRECISION_BITS = 22;
const PRECISION_ONE = 1 << PRECISION_BITS;

function sincFilter(x: number): number {
    if (x === 0) return 1;
    const px = x * Math.PI;
    return Math.sin(px) / px;
}

function lanczosFilter(x: number): number {
    if (x >= -3 && x < 3) return sincFilter(x) * sincFilter(x / 3);
    return 0;
}

/** `precompute_coeffs` + `normalize_coeffs_8bpc`（`LANCZOS` support = 3）。 */
function lanczosCoeffs(inSize: number, outSize: number): { bounds: Int32Array; k: Int32Array; ksize: number } {
    const scale = inSize / outSize;
    const filterscale = scale < 1 ? 1 : scale;
    const support = 3 * filterscale;
    const ksize = Math.ceil(support) * 2 + 1;
    const bounds = new Int32Array(outSize * 2);
    const pre = new Float64Array(outSize * ksize);
    for (let xx = 0; xx < outSize; xx++) {
        const center = (xx + 0.5) * scale;
        const ss = 1 / filterscale;
        let xmin = cInt(center - support + 0.5);
        if (xmin < 0) xmin = 0;
        let xmax = cInt(center + support + 0.5);
        if (xmax > inSize) xmax = inSize;
        xmax -= xmin;
        let ww = 0;
        const base = xx * ksize;
        for (let x = 0; x < xmax; x++) {
            const wgt = lanczosFilter((x + xmin - center + 0.5) * ss);
            pre[base + x] = wgt;
            ww += wgt;
        }
        for (let x = 0; x < xmax; x++) {
            if (ww !== 0) pre[base + x] = pre[base + x]! / ww;
        }
        bounds[xx * 2] = xmin;
        bounds[xx * 2 + 1] = xmax;
    }
    const k = new Int32Array(outSize * ksize);
    for (let i = 0; i < outSize * ksize; i++) {
        const v = pre[i]!;
        k[i] = v < 0 ? cInt(-0.5 + v * PRECISION_ONE) : cInt(0.5 + v * PRECISION_ONE);
    }
    return { bounds, k, ksize };
}

/** `clip8(ss) = clip8_lookups[ss >> 22]`（算术右移 = floor，表端点 clamp 0/255）。 */
function clip8(ss: number): number {
    const v = Math.floor(ss / PRECISION_ONE);
    return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** 单通道 `size×size` → `n×n`：横遍（`size`→`n`）后纵遍（`size`→`n`），PIL 的两遍顺序。 */
function resampleSquare(src: Uint8Array, size: number, n: number): Uint8Array {
    if (size === n) return src.slice();
    // 横遍：src(size×size) → temp(n×size)。
    const h = lanczosCoeffs(size, n);
    const temp = new Uint8Array(n * size);
    for (let yy = 0; yy < size; yy++) {
        for (let xx = 0; xx < n; xx++) {
            const xmin = h.bounds[xx * 2]!;
            const xmax = h.bounds[xx * 2 + 1]!;
            const kb = xx * h.ksize;
            let ss = 1 << (PRECISION_BITS - 1);
            const row = yy * size;
            for (let x = 0; x < xmax; x++) ss += src[row + (x + xmin)]! * h.k[kb + x]!;
            temp[yy * n + xx] = clip8(ss);
        }
    }
    // 纵遍：temp(n×size) → out(n×n)。
    const v = lanczosCoeffs(size, n);
    const out = new Uint8Array(n * n);
    for (let yy = 0; yy < n; yy++) {
        const ymin = v.bounds[yy * 2]!;
        const ymax = v.bounds[yy * 2 + 1]!;
        const kb = yy * v.ksize;
        for (let xx = 0; xx < n; xx++) {
            let ss = 1 << (PRECISION_BITS - 1);
            for (let y = 0; y < ymax; y++) ss += temp[(y + ymin) * n + xx]! * v.k[kb + y]!;
            out[yy * n + xx] = clip8(ss);
        }
    }
    return out;
}

// ─── 场计算主流程 ────────────────────────────────────────────────────────

interface Planes {
    r: Uint8Array;
    g: Uint8Array;
    b: Uint8Array;
}

/** 层集逐层覆盖（R/G **无条件双写** —— DEC-6 承 WXG-T-229 D1 修复：跳过 ⇒ 底层 d 渗漏）。 */
function applyLayerSet(p: Planes, render: number, px: number, layers: readonly MaskLayer[]): void {
    const mask = new Uint8Array(render * render);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const layer of layers) {
        if (layer.kind === 'circle') continue; // B15：孔 live，跳过 circle
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
            xs.length = 0;
            ys.length = 0;
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
            if (mask[i]! > 0) {
                p.r[i] = dr;
                p.g[i] = lg;
            }
        }
    }
}

/** 珠形 B 通道（圆角方 − 真透孔 + 0.5dp smoothstep 羽化；无孔档 = 满幅圆角方）。 */
function beadShapePlane(spec: MaskGaugeSpec, render: number, px: number): Uint8Array {
    const shape = new Uint8Array(render * render);
    const o0 = ((spec.cellDp - spec.beadDp) / 2) * px;
    const o1 = ((spec.cellDp + spec.beadDp) / 2) * px;
    fillRoundedRectMask(shape, render, render, o0, o0, o1, o1, spec.beadCornerDp * px, 255);
    if (spec.holeDp <= 0) return shape;
    const c = render / 2;
    const holeR = (spec.holeDp / 2) * px;
    const feather = spec.holeFeatherDp * px;
    const out = new Uint8Array(render * render);
    for (let y = 0; y < render; y++) {
        const dy = y - c;
        for (let x = 0; x < render; x++) {
            const dx = x - c;
            const dist = Math.sqrt(dx * dx + dy * dy);
            let k = clamp01((dist - (holeR - feather)) / (2 * feather));
            k = k * k * (3 - 2 * k); // smoothstep
            out[y * render + x] = cInt(shape[y * render + x]! * k);
        }
    }
    return out;
}

/** 孔边 1dp 斜面（内凹：上内壁 → hole 档、下内壁 → lit）。⛔ 孔区不做硬清零（三通道连续延拓）。 */
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
    const outer = new Uint8Array(render * render);
    fillRoundedRectMask(outer, render, render, o0, o0, o1, o1, spec.beadCornerDp * px, 255);
    const inner = new Uint8Array(render * render);
    fillRoundedRectMask(
        inner,
        render,
        render,
        o0 + w,
        o0 + w,
        o1 - w,
        o1 - w,
        Math.max(0, spec.beadCornerDp * px - w),
        255,
    );
    const c = render / 2;
    for (let y = 0; y < render; y++) {
        const dy = y - c;
        for (let x = 0; x < render; x++) {
            const i = y * render + x;
            if (outer[i]! === 0 || inner[i]! > 0) continue;
            // `t`：内缘（贴本体）0.35 → 外缘 1.0。带内像素不在 inner 内 ⇒ t = 1（外缘），
            // 与定稿 py 的 `np.where(ring, np.where(inside, 0.35, 1.0), 0.0)` 同构。
            const t = 1;
            const dx = x - c;
            const up = upMembership(dx, dy);
            const sw = frameSideWeights(dx, dy);
            const sideD = FRAME_SIDE_D_BASE + FRAME_SIDE_D_SPAN * (up + FRAME_LEFT_W * sw.left + FRAME_RIGHT_W * sw.right);
            p.r[i] = to8(sideD + FRAME_EDGE_D * t);
            p.g[i] = to8(spec.litL * up);
        }
    }
    void FRAME_T_INNER;
}

/** 珠面场（512 超采样 → LANCZOS ÷4 → size）。 */
/**
 * `[WXG-T-226 WXG-T-232]` **形状通道去振铃地板**（LANCZOS 硬台阶的残留斑点）。
 *
 * ## 为什么需要（2026-10-03 实测）
 *
 * 珠外缘是 B 通道的 **0 ↔ 255 硬跳**，LANCZOS 在两侧各留 1–4/255 的**振铃斑点**
 * （实测 `x=6 shape=4`、`x=121 shape=2`）⇒ 它们落在 B0 底图上成为**极淡亮晕**，
 * 视觉上让「亮刻面压格边界」比几何应有值更靠外（**几何本身是对的**：实测珠 solid 区
 * `x=9..118 = 110px`，理论 26dp = 110.9px）。
 *
 * ## 为什么取 8/255
 *
 * 真 AA 边实测值是 **128 / 190**（远高于 8）⇒ 地板**只清振铃斑点，不碰真边缘**；
 * 孔缘渐变带里 `r=23` 的值 2 也会被清掉 ⇒ 过渡带顺带收窄 1px。
 *
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
    const p: Planes = { r: new Uint8Array(render * render), g: new Uint8Array(render * render), b: new Uint8Array(render * render) };
    applyLayerSet(p, render, px, spec.beadLayers);
    paintHoleRing(p, spec, render, px);
    paintFrameLight(p, spec, render, px);
    return {
        r: resampleSquare(p.r, render, size),
        g: resampleSquare(p.g, render, size),
        b: applyShapeFloor(resampleSquare(beadShapePlane(spec, render, px), render, size)),
    };
}

/** 格面场（**纯程序化**：⛔ 不消费 `cellLayers` —— 承定稿 py「槽视觉完全程序化」）。 */
function computeCellPlanes(spec: MaskGaugeSpec, size: number): Planes {
    const render = size * MASK_SUPERSAMPLE;
    const px = render / MASK_CELL_DP;
    const c = render / 2;
    const edgePx = spec.slotEdgeDp * px;
    const q = (spec.slotHalfDp - spec.slotCornerDp) * px;
    const cornerPx = spec.slotCornerDp * px;
    const rHi = new Uint8Array(render * render);
    const gHi = new Uint8Array(render * render);
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
            let d: number;
            let l = 0;
            if (sd >= -edgePx && sd <= 0) {
                const tIn = clamp01(-sd / edgePx);
                const dEdge = GRID_EDGE_D_LIT - GRID_EDGE_D_SPAN * clamp01(1 - uy);
                // ⛔ 渐入目标是**槽底定值**（有孔 0.70 = 格底色 / 无孔 0.32 = 深坑），
                // **不是**格外值 0.70 —— 两档的斜面内缘在这处分叉（承定稿 py 各自的 `d_val` 公式）。
                d = dEdge + (spec.slotFloorD - dEdge) * tIn;
                l = spec.litL * downW * (1 - tIn);
            } else if (sd < -edgePx) {
                d = spec.slotFloorD;
            } else {
                d = spec.outsideD;
            }
            rHi[i] = to8(d);
            gHi[i] = to8(l);
        }
    }
    return {
        r: resampleSquare(rHi, render, size),
        g: resampleSquare(gHi, render, size),
        b: new Uint8Array(size * size).fill(255), // 格面 = 满幅实底
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
 * - `kind = 'cell'`：格面（**满幅实底**，槽口 3dp 斜面 + 槽底/格外定值）。
 * - `size` 必须是 `MASK_SUPERSAMPLE` 的整数倍（512 → 128，÷4 整数比 LANCZOS；⛔ 非整数比会把内容压偏）。
 */
export function computeMaskField(kind: BeadMaskKind, spec: MaskGaugeSpec, size: number): MaskField {
    if (size % MASK_SUPERSAMPLE !== 0) {
        throw new Error(`computeMaskField: size=${size} must be divisible by MASK_SUPERSAMPLE=${MASK_SUPERSAMPLE}`);
    }
    const planes = kind === 'bead' ? computeBeadPlanes(spec, size) : computeCellPlanes(spec, size);
    return { width: size, height: size, data: packRGBA(planes, size) };
}
