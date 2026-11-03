/**
 * `[WXG-T-567 2026-11-03 拆分 Step 3]` mask-field.ts → mask-fill.ts。
 *
 * 逐字复制原始 mask-field.ts L113-457（栅格化函数 + 椭圆状态机 + fillRoundedRectMask）。
 * 从 mask-geometry import 依赖工具函数（cInt / roundUp / roundDown / pyround）。
 */

import { cInt, roundUp, roundDown, pyround } from './mask-geometry';

// ─── 栅格化（PIL 12.x 逐式复刻） ──────────────────────────────────────────

/** `hline8`：y 越界整行丢弃；x 端点**含**（`x1 = CLIP(x1 + 1)` ⇒ 半开区间右端）。 */
export function fillHline(plane: Uint8Array, w: number, h: number, x0: number, y: number, x1: number, value: number): void {
    if (y < 0 || y >= h) return;
    if (x1 < 0 || x0 >= w) return;
    const xa = x0 < 0 ? 0 : x0;
    const xb = x1 >= w ? w - 1 : x1;
    if (xa > xb) return;
    const row = y * w;
    for (let x = xa; x <= xb; x++) plane[row + x] = value;
}

/** `ImagingDrawRectangle` fill=1（y 从 y0 到 y1 含；hline 端点含）。 */
export function fillRectMask(plane: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, value: number): void {
    if (y1 < y0) {
        const t = y1;
        y1 = y0;
        y0 = t;
    }
    const ya = Math.max(0, y0);
    const yb = Math.min(h - 1, y1);
    for (let y = ya; y <= yb; y++) fillHline(plane, w, h, x0, y, x1, value);
}

export interface Edge {
    x0: number;
    y0: number;
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    dx: number;
}

export function newEdge(): Edge {
    return { x0: 0, y0: 0, xmin: 0, ymin: 0, xmax: 0, ymax: 0, dx: 0 };
}

/** `Draw.c::add_edge`。 */
export function addEdge(e: Edge, x0: number, y0: number, x1: number, y1: number): void {
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
export function fillPolygonMask(
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
            const last = edges[edges.length - 1];
            if (last === undefined) continue;
            if (x1 > x0 && x0 > xs[i - 1]!) { last.xmax = x1; continue; }
            if (x1 < x0 && x0 < xs[i - 1]!) { last.xmin = x1; continue; }
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
                xx.push(xx[xx.length - 1]!);
            } else if ((y === cur.ymin || y === cur.ymax) && cur.dx !== 0) {
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

export interface QuarterState {
    cx: number;
    cy: number;
    ex: number;
    ey: number;
    a2: number;
    b2: number;
    a2b2: number;
    finished: boolean;
}

export function quarterInit(a: number, b: number): QuarterState | undefined {
    if (a < 0 || b < 0) return undefined;
    return { cx: a, cy: b % 2, ex: a % 2, ey: b, a2: a * a, b2: b * b, a2b2: a * a * b * b, finished: false };
}

export function quarterDelta(s: QuarterState, x: number, y: number): number {
    return Math.abs(s.a2 * y * y + s.b2 * x * x - s.a2b2);
}

export function quarterNext(s: QuarterState): { code: number; x: number; y: number } {
    if (s.finished) return { code: -1, x: 0, y: 0 };
    const rx = s.cx;
    const ry = s.cy;
    if (s.cx === s.ex && s.cy === s.ey) { s.finished = true; return { code: 0, x: rx, y: ry }; }
    let nx = s.cx;
    let ny = s.cy + 2;
    let ndelta = quarterDelta(s, nx, ny);
    if (nx > 1) {
        const c1 = quarterDelta(s, s.cx - 2, s.cy + 2);
        if (ndelta > c1) { nx = s.cx - 2; ny = s.cy + 2; ndelta = c1; }
        const c2 = quarterDelta(s, s.cx - 2, s.cy);
        if (ndelta > c2) { nx = s.cx - 2; ny = s.cy; }
    }
    s.cx = nx; s.cy = ny;
    return { code: 0, x: rx, y: ry };
}

/**
 * `ellipse_next`（fill 模式 ⇒ `width = a + b`）的整数跨度枚举。
 * C 语义：`ellipse_init` 消费外椭圆第一个点存入 `pr/py`；每轮取 `y = py / r = pr`（**旧值**）。
 */
export function forEachFilledEllipseSpan(a: number, b: number, emit: (y: number, xLo: number, xHi: number) => void): void {
    const width = a + b;
    const leftmost = a % 2;
    const so = quarterInit(a, b);
    if (so === undefined || width < 1) return;
    const first = quarterNext(so);
    if (first.code === -1) return;
    let pr = first.x;
    let py = first.y;
    const si = quarterInit(a - 2 * (width - 1), b - 2 * (width - 1));
    let pl = leftmost;
    for (; ;) {
        const y = py;
        const r = pr;
        let l = pl;
        let next = quarterNext(so);
        while (next.code !== -1 && next.y <= y) { next = quarterNext(so); }
        const outerDone = next.code === -1;
        if (!outerDone) { pr = next.x; py = next.y; }
        if (si !== undefined) {
            let n2 = quarterNext(si);
            while (n2.code !== -1 && n2.y <= y) { l = n2.x; n2 = quarterNext(si); }
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
 */
export function fillQuarterEllipse(
    plane: Uint8Array, w: number, h: number,
    bx0: number, by0: number, bx1: number, by1: number,
    qx: number, qy: number, value: number,
): void {
    const X0 = cInt(bx0); const Y0 = cInt(by0); const X1 = cInt(bx1); const Y1 = cInt(by1);
    const a = X1 - X0; const b = Y1 - Y0;
    if (a < 0 || b < 0) return;
    forEachFilledEllipseSpan(a, b, (Y, xLo, xHi) => {
        if (qy < 0 ? Y > 0 : Y < 0) return;
        let lo = xLo; let hi = xHi;
        if (qx < 0) { if (lo > 0) return; if (hi > 0) hi = 0; }
        else { if (hi < 0) return; if (lo < 0) lo = 0; }
        if (lo > hi) return;
        fillHline(plane, w, h, X0 + cInt((lo + a) / 2), Y0 + cInt((Y + b) / 2), X0 + cInt((hi + a) / 2), value);
    });
}

/**
 * 圆角矩形填充 —— 复刻 `ImageDraw.rounded_rectangle`（Python 层）的**分解**：
 * `x0/y0/x1/y1` 走 `round()`，`d = radius × 2`（可被 `full_x/full_y` 覆写），`r = int(d // 2)`；
 * 填充 = 4 段 90° `pieslice` + （`full_x` ? 上下横带 : 中间竖带) + 左右竖条。
 */
export function fillRoundedRectMask(
    plane: Uint8Array, w: number, h: number,
    fx0: number, fy0: number, fx1: number, fy1: number,
    radius: number, value: number,
): void {
    const x0 = pyround(fx0); const y0 = pyround(fy0);
    const x1 = pyround(fx1); const y1 = pyround(fy1);
    let d = radius * 2;
    const fullX = d >= x1 - x0 - 1;
    const fullY = d >= y1 - y0 - 1;
    if (fullX) d = x1 - x0;
    if (fullY) d = y1 - y0;
    if (d === 0) { fillRectMask(plane, w, h, x0, y0, x1, y1, value); return; }
    const r = cInt(d / 2);
    fillQuarterEllipse(plane, w, h, x0, y0, x0 + d, y0 + d, -1, -1, value);
    fillQuarterEllipse(plane, w, h, x1 - d, y0, x1, y0 + d, 1, -1, value);
    fillQuarterEllipse(plane, w, h, x1 - d, y1 - d, x1, y1, 1, 1, value);
    fillQuarterEllipse(plane, w, h, x0, y1 - d, x0 + d, y1, -1, 1, value);
    if (fullX) { fillRectMask(plane, w, h, x0, y0 + r + 1, x1, y1 - r - 1, value); }
    else if (x1 - r - 1 > x0 + r + 1) { fillRectMask(plane, w, h, x0 + r + 1, y0, x1 - r - 1, y1, value); }
    if (!fullX && !fullY) {
        fillRectMask(plane, w, h, x0, y0 + r + 1, x0 + r, y1 - r - 1, value);
        fillRectMask(plane, w, h, x1 - r, y0 + r + 1, x1, y1 - r - 1, value);
    }
    void fullY;
}
