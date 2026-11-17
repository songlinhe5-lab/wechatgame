/**
 * palette-rules.mjs — 选色规则共享真源（palette-quantize / beads-gen 共用）
 * ──────────────────────────────────────────────────────────────
 * 只放纯函数，零依赖：RGB↔Hex / RGB↔Lab / ΔE76 / 门 B·C / 分布质量 /
 * hue-aware Median Cut / 簇主导色。
 * 口径来源：games/beads/design/art/specs/palette-selection-gates.md §5.2
 *   （Median Cut → Dominant Color；Hue 作第 4 通道是同节 2026-11-17 Spike 的结论）。
 * ⚠️ 这里的方法学只服务「选色」；生成主流程默认仍是 k-means（beads-gen --quantizer kmeans）。
 */

export const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export const rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

// ── RGB → Lab / ΔE76（palette-quantize 原实现原样上移，单一真源）──────────
const rgbToLinear = (v) => {
    const c = v / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
};
const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;

export const rgbToLab = (rgb) => {
    const [r, g, b] = rgb;
    const rl = rgbToLinear(r), gl = rgbToLinear(g), bl = rgbToLinear(b);
    const X = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
    const Y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
    const Z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;
    const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const fx = f(X / Xn), fy = f(Y / Yn), fz = f(Z / Zn);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

const labsCache = new Map();
const labOf = (hex) => {
    let c = labsCache.get(hex);
    if (!c) { c = rgbToLab(hexToRgb(hex)); labsCache.set(hex, c); }
    return c;
};

/** CIE76 色差（hex 入参）。 */
export const deltaE76 = (A, B) => {
    const [L1, a1, b1] = labOf(A), [L2, a2, b2] = labOf(B);
    return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
};

/**
 * ADR-0028 亮度混合：amount ∈ [-1, +1]
 *   负向 ⇒ target=0（c×(1+amount)）；正向 ⇒ target=255（c+(255−c)×amount）。
 * ⚠️ 正向不乘 0.5（2026-11-17 修复的历史偏差，见 palette-rules-review）。
 */
export const mixHex = (hex, factor) => {
    const [r, g, b] = hexToRgb(hex);
    let nr, ng, nb;
    if (factor < 0) {
        const k = 1 + factor;
        nr = r * k; ng = g * k; nb = b * k;
    } else {
        const k = factor;
        nr = r + (255 - r) * k;
        ng = g + (255 - g) * k;
        nb = b + (255 - b) * k;
    }
    return rgbToHex(nr, ng, nb);
};

/** 三点带色差（原色 / 压暗 30% / 提亮 38% 取最小）——门 C 的主判据。 */
export const bandDelta = (A, B) => {
    const edgeA = mixHex(A, -0.30), litA = mixHex(A, +0.38);
    const edgeB = mixHex(B, -0.30), litB = mixHex(B, +0.38);
    return Math.min(deltaE76(A, B), deltaE76(edgeA, edgeB), deltaE76(litA, litB));
};

/** Lab 明度（0–100）。 */
export const lumaOf = (hex) => Math.max(0, Math.min(100, labOf(hex)[0]));

/** RGB→HSL 色相（0–360）。 */
export const hslOf = (hex) => {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
        else if (max === g) h = ((b - r) / d + 2);
        else h = ((r - g) / d + 4);
        h *= 60;
    }
    return h;
};

// ── 门 B/C 阈值（= palette-selection-gates.md τ 值，2026-11-17 Spike 定标）──
export const NEARFAM_BAND_MAX = 10;   // 门 C：bandΔE < 10 → 近似族互斥
export const NEARFAM_BASE_MAX = 22;   // 门 C：baseΔE < 22 → 近似族互斥（合取）
export const PIT_VISIBLE_MIN = 8;     // 门 B：单珠 baseΔE（对 pit 派生色）≥ 8
export const QUALITY_HUE_SECTORS = 8; // 分布质量：色相扇区数
export const QUALITY_MIN_SECTOR_COVERAGE = (n) => Math.ceil(n / 2);
export const QUALITY_LUMA_SPAN_MIN = 40;
export const QUALITY_MIN_BAND = 15;   // 补色硬门槛：min bandΔE ≥ 15（耗尽降级）

/** 门 B：深珠对盘面底色不可见（pit = 自身压暗 44%）。 */
export const GATE_B_FAIL = (hex) => deltaE76(hex, mixHex(hex, -0.44)) < PIT_VISIBLE_MIN;
/** 门 C：近似族互斥（三点带 + 原色都太近才算可混淆）。 */
export const CONFUSABLE = (A, B) => bandDelta(A, B) < NEARFAM_BAND_MAX && deltaE76(A, B) < NEARFAM_BASE_MAX;

/** 分布质量 0–4 分（色相扇区覆盖 / 明度跨度 / 两两最小 bandΔE）。 */
export function distributionQuality(hexes) {
    const n = hexes.length;
    if (n < 2) return { hueSectors: 0, lumaSpan: 0, minBandDelta: 0, score: 0 };
    const sectorSize = 360 / QUALITY_HUE_SECTORS;
    const sectors = new Set();
    for (const h of hexes) sectors.add(Math.floor(hslOf(h) / sectorSize));
    const hueOk = sectors.size >= QUALITY_MIN_SECTOR_COVERAGE(n);
    const lumas = hexes.map(lumaOf);
    const lumaSpan = Math.max(...lumas) - Math.min(...lumas);
    const lumaOk = lumaSpan >= QUALITY_LUMA_SPAN_MIN;
    let minBand = Infinity;
    for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
            minBand = Math.min(minBand, bandDelta(hexes[i], hexes[j]));
    const score = (hueOk ? 2 : 0) + (lumaOk ? 1 : 0) + (minBand >= QUALITY_MIN_BAND ? 1 : 0);
    return {
        hueSectors: sectors.size,
        hueOk,
        lumaSpan: Math.round(lumaSpan),
        lumaOk,
        minBandDelta: Math.round(minBand * 10) / 10,
        score,
    };
}

// ── Hue 辅助（RGB→HSL hue + 环形跨度）──────────────────────────
export function rgbToHueDeg([r, g, b]) {
    const rl = r / 255, gl = g / 255, bl = b / 255;
    const mx = Math.max(rl, gl, bl), mn = Math.min(rl, gl, bl), d = mx - mn;
    if (d === 0) return 0;
    let h;
    if (mx === rl) h = ((gl - bl) / d + (gl < bl ? 6 : 0));
    else if (mx === gl) h = ((bl - rl) / d + 2);
    else h = ((rl - gl) / d + 4);
    return h * 60;
}

/** hue 环形 range（0-360）：最大 gap 之外的部分 */
export function hueRingRange(hues) {
    if (hues.length < 2) return 0;
    const sorted = [...hues].sort((a, b) => a - b);
    let maxGap = sorted[0] + 360 - sorted[sorted.length - 1];
    for (let i = 1; i < sorted.length; i++) maxGap = Math.max(maxGap, sorted[i] - sorted[i - 1]);
    return 360 - maxGap;
}

// ── Hue-aware Median Cut ──────────────────────────────────────
// ponytail: Hue 为第 4 通道（环形距离），让色相相近像素聚一起；递归切片，叶数 = 2^ceil(log2 maxColors)。
export function medianCut(rgbPixels, depth = 0, maxColors = 64) {
    // rgbPixels: [[r,g,b], ...]
    if (rgbPixels.length === 0) return [];
    if (rgbPixels.length === 1 || 2 ** depth >= maxColors) {
        return [rgbPixels];
    }
    const hues = rgbPixels.map(rgbToHueDeg);
    const ranges = [0, 0, 0, 0];
    for (let c = 0; c < 3; c++) {
        const vals = rgbPixels.map((p) => p[c]);
        ranges[c] = Math.max(...vals) - Math.min(...vals);
    }
    ranges[3] = hueRingRange(hues) * (255 / 360); // Hue 量纲归一化（0-360 → 0-255 等权）
    let channel = 0, maxRange = 0;
    for (let c = 0; c < 4; c++) if (ranges[c] > maxRange) { maxRange = ranges[c]; channel = c; }
    if (maxRange === 0) return [rgbPixels];
    let sorted;
    if (channel < 3) {
        sorted = [...rgbPixels].sort((a, b) => a[channel] - b[channel]);
    } else {
        // Hue 环形排序：以环形均值方向为 0° 展开
        let sinS = 0, cosS = 0;
        for (const h of hues) { sinS += Math.sin(h * Math.PI / 180); cosS += Math.cos(h * Math.PI / 180); }
        const meanHue = Math.atan2(sinS, cosS) * 180 / Math.PI;
        const wrap = (h) => ((h - meanHue + 540) % 360) - 180;
        sorted = [...rgbPixels].sort((a, b) => wrap(rgbToHueDeg(a)) - wrap(rgbToHueDeg(b)));
    }
    const mid = Math.floor(sorted.length / 2);
    return [...medianCut(sorted.slice(0, mid), depth + 1, maxColors), ...medianCut(sorted.slice(mid), depth + 1, maxColors)];
}

/** 簇主导色（众数 hex，不取均值——均值生灰浊感，行业共识） */
export function dominantColor(rgbCluster) {
    const counts = new Map();
    for (const [r, g, b] of rgbCluster) {
        // 量化到 6-bit/通道（每步 4）做高频统计，防每个像素唯一
        const key = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    let bestKey = -1, bestCount = 0;
    for (const [k, v] of counts) if (v > bestCount) { bestCount = v; bestKey = k; }
    const matching = rgbCluster.filter(([r, g, b]) =>
        ((r >> 2) << 12 | (g >> 2) << 6 | (b >> 2)) === bestKey);
    const n = matching.length;
    const sum = matching.reduce((a, [r, g, b]) => [a[0] + r, a[1] + g, a[2] + b], [0, 0, 0]);
    return rgbToHex(sum[0] / n, sum[1] / n, sum[2] / n);
}
