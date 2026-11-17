/**
 * palette-rules.mjs — 选色规则共享真源（palette-quantize / beads-gen 共用）
 * ──────────────────────────────────────────────────────────────
 * 只放纯函数，零依赖：RGB↔Hex、色相辅助、hue-aware Median Cut、簇主导色。
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
