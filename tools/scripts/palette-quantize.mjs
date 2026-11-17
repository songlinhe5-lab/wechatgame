#!/usr/bin/env node
/**
 * palette-quantize.mjs — 照片 → 拼豆选色 Studio 侧管线
 * ──────────────────────────────────────────────────────────────
 * 零依赖 Node 脚本。输入图像像素（PNG/JPEG/WebP 需要 sharp；
 * PPM 或 JSON 网格零依赖也能跑），经 Median Cut 量化 →
 * 品牌色板映射 → 门 B/C 过滤 → 分布质量评分，输出选色 + 报告 + 可选预览。
 *
 * 管线（games/beads/design/art/specs/palette-selection-gates.md §5.2）：
 *   照片 → Median Cut → Dominant Color → 品牌色板最近邻(ΔE76)
 *        → 门 B(单色下限) + 门 C(近似族互斥) → 分布质量评分 → 最终选色
 *
 * 依赖：sharp 可选（PNG/JPEG 输入才需要，其他输入零依赖）。
 *   pnpm add sharp -w    # 根 workspace 安装
 *
 * 用法：
 *   node tools/scripts/palette-quantize.mjs --input photo.png \
 *     --palette artkal-s --colors 12 --max-colors 35
 *
 *   # PPM 输入（零依赖）
 *   node tools/scripts/palette-quantize.mjs --input photo.ppm
 *
 *   # JSON 像素输入：{"width":N,"height":N,"pixels":["#RRGGBB",...]}
 *   node tools/scripts/palette-quantize.mjs --input pixels.json --colors 10
 *
 *   # 直接 demo（无输入，用内置测试色板）
 *   node tools/scripts/palette-quantize.mjs --demo
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hexToRgb, rgbToHex, rgbToHueDeg, hueRingRange, medianCut, dominantColor } from './lib/palette-rules.mjs';

// ──────────────────────────────────────────────────────────────
// 常量（= palette-selection-gates.md τ 值，2026-11-17 Spike 定标）
// ──────────────────────────────────────────────────────────────
const NEARFAM_BAND_MAX = 10;   // 门 C：bandΔE < 10 → 近似族互斥
const NEARFAM_BASE_MAX = 22;   // 门 C：baseΔE < 22 → 近似族互斥（合取）
const PIT_VISIBLE_MIN = 8;      // 门 B：单色 baseΔE ≥ 8（防深珠不可见）
const MAX_COLORS = 35;          // 关卡颜色上限
const QUALITY_HUE_SECTORS = 8;  // 分布质量：色相扇区
const QUALITY_MIN_SECTOR_COVERAGE = (n) => Math.ceil(n / 2);
const QUALITY_LUMA_SPAN_MIN = 40;  // 分布质量：明度跨度
const QUALITY_MIN_BAND = 15;       // 补色硬门槛：新选色与已选集最小 bandΔE ≥ 15（软约束升级为硬门，耗尽降级）

// ──────────────────────────────────────────────────────────────
// CLI 参数
// ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
    const args = { input: null, palette: 'artkal-s', colors: 10, maxColors: MAX_COLORS, html: null, demo: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--demo') { args.demo = true; continue; }
        const next = () => argv[++i];
        if (a === '--input') args.input = next();
        else if (a === '--palette') args.palette = next();
        else if (a === '--colors') args.colors = parseInt(next(), 10);
        else if (a === '--max-colors') args.maxColors = parseInt(next(), 10);
        else if (a === '--html') args.html = next();
        else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    }
    return args;
}
function printHelp() { /* lazy: just print top comment */
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 18).join('\n'));
}

// ──────────────────────────────────────────────────────────────
// 色板加载
// ──────────────────────────────────────────────────────────────
function loadPalette(slug) {
    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const ART_DIR = resolve(SCRIPT_DIR, '../../games/beads/design/art/specs');
    // ponytail: 只查 slug.json，不静默 fallback（避免错误 slug 悄悄跑到 artkal-palette.json）
    const p = join(ART_DIR, slug + '.json');
    let data;
    try { data = JSON.parse(readFileSync(p, 'utf8')); }
    catch { throw new Error(`色板未找到: ${slug}（文件不存在: ${p}）`); }
    // 注册表格式：{brands: {slug: {colors, codes}}}
    if (data.brands && data.brands[slug]) {
        const b = data.brands[slug];
        return { name: b.name || slug, slug, hexes: b.colors, codes: b.codes };
    }
    // 直接 palette + codes 格式
    if (data.palette && data.codes) {
        return { name: data.name || slug, slug, hexes: data.palette, codes: data.codes };
    }
    throw new Error(`色板文件 ${slug}.json 格式无效（缺 palette/codes 或 brands[slug]）`);
}

// ──────────────────────────────────────────────────────────────
// 颜色空间工具（RGB↔Lab / ΔE76 / 三点派生带 / mix）
// RGB↔Hex 与 Median Cut 见 lib/palette-rules.mjs（与 beads-gen 共用真源）
// ──────────────────────────────────────────────────────────────

const rgbToLinear = (v) => {
    const c = v / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
};
const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;

const rgbToLab = (rgb) => {
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
const deltaE76 = (A, B) => {
    const [L1, a1, b1] = labOf(A), [L2, a2, b2] = labOf(B);
    return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
};
// ponytail: ADR-0028-explainer 真义：amount ∈ [-1, +1]
//   负向（amount<0）→ target=0, c×(1+amount)
//   正向（amount>0）→ target=255, c+(255-c)×amount
// 修正：原正向乘了 0.5（19% 白）→ 直接用 factor（38% 白）
const mixHex = (hex, factor) => {
    const [r, g, b] = hexToRgb(hex);
    let nr, ng, nb;
    if (factor < 0) {
        const k = 1 + factor;
        nr = r * k; ng = g * k; nb = b * k;
    } else {
        const k = factor;  // ← 修正：去掉 ×0.5
        nr = r + (255 - r) * k;
        ng = g + (255 - g) * k;
        nb = b + (255 - b) * k;
    }
    return rgbToHex(nr, ng, nb);
};
const bandDelta = (A, B) => {
    const edgeA = mixHex(A, -0.30), litA = mixHex(A, +0.38);
    const edgeB = mixHex(B, -0.30), litB = mixHex(B, +0.38);
    return Math.min(deltaE76(A, B), deltaE76(edgeA, edgeB), deltaE76(litA, litB));
};

// Lab→Luma（感知明度，0-100）
const lumaOf = (hex) => {
    const [L] = labOf(hex);
    return Math.max(0, Math.min(100, L));
};

// RGB→HSL（色相 0-360°，简化版用于扇区覆盖）
const hslOf = (hex) => {
    const [r, g, b] = hexToRgb(hex).map(v => v / 255);
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

// ──────────────────────────────────────────────────────────────
// 门 B/C：单色下限 + 近似族互斥
// ──────────────────────────────────────────────────────────────
const BLACK = '#000000';
// ponytail: 修正门 B — 文档声明 ΔE(c, mix(c, −0.44)) < 8（pit 派生色）
// 错误近似：原实现用 ΔE(c, BLACK) → diamond-dotz 8001 #1F1F24 被错放（ΔE_black=12.5，ΔE_pit=7.0）
const GATE_B_FAIL = (hex) => deltaE76(hex, mixHex(hex, -0.44)) < PIT_VISIBLE_MIN;
const CONFUSABLE = (A, B) => bandDelta(A, B) < NEARFAM_BAND_MAX && deltaE76(A, B) < NEARFAM_BASE_MAX;

// ──────────────────────────────────────────────────────────────
// 分布质量评分
// ──────────────────────────────────────────────────────────────
function distributionQuality(hexes) {
    const n = hexes.length;
    if (n < 2) return { hueSectors: 0, lumaSpan: 0, minBandDelta: 0, score: 0 };

    // 色相扇区覆盖
    const sectorSize = 360 / QUALITY_HUE_SECTORS;
    const sectors = new Set();
    for (const h of hexes) sectors.add(Math.floor(hslOf(h) / sectorSize));
    const hueOk = sectors.size >= QUALITY_MIN_SECTOR_COVERAGE(n);

    // 明度跨度
    const lumas = hexes.map(lumaOf);
    const lumaSpan = Math.max(...lumas) - Math.min(...lumas);
    const lumaOk = lumaSpan >= QUALITY_LUMA_SPAN_MIN;

    // 两两最小 bandΔE
    let minBand = Infinity;
    for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
            minBand = Math.min(minBand, bandDelta(hexes[i], hexes[j]));

    const score = (hueOk ? 2 : 0) + (lumaOk ? 1 : 0) + (minBand >= 15 ? 1 : 0);
    return {
        hueSectors: sectors.size,
        hueOk,
        lumaSpan: Math.round(lumaSpan),
        lumaOk,
        minBandDelta: Math.round(minBand * 10) / 10,
        score, // 0-4
    };
}

// ──────────────────────────────────────────────────────────────
// Hue 辅助（RGB→HSL hue + 环形距离 + 色相集中度）
// rgbToHueDeg / hueRingRange 见 lib/palette-rules.mjs（与 beads-gen 共用真源）
// ──────────────────────────────────────────────────────────────
// ponytail: 色相集中度 = 环形均值方向一致性（1=单色, 0=完全分散）
function hueConcentration(rgbPixels) {
    if (rgbPixels.length === 0) return 0;
    // sharp resize/flatten 边缘可能产生 1-2 个 NaN 像素 → 过滤
    const hues = rgbPixels
        .filter(p => p.every(v => Number.isFinite(v)))
        .map(rgbToHueDeg);
    if (hues.length < 2) return 0;
    let sinSum = 0, cosSum = 0;
    for (const h of hues) { sinSum += Math.sin(h * Math.PI / 180); cosSum += Math.cos(h * Math.PI / 180); }
    const R = Math.sqrt(sinSum * sinSum + cosSum * cosSum) / hues.length;
    return 180 * (1 - R); // 0°=集中, 180°=完全分散
}

// ──────────────────────────────────────────────────────────────
// Median Cut 量化 + Dominant Color
// 实现见 lib/palette-rules.mjs（hue-aware；与 beads-gen --quantizer median-hue 共用）
// ──────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
// 品牌色板最近邻映射（ΔE76）
// ──────────────────────────────────────────────────────────────
function nearestBrand(hex, palette) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < palette.hexes.length; i++) {
        const d = deltaE76(hex, palette.hexes[i]);
        if (d < bestD) { bestD = d; best = i; }
    }
    return { hex: palette.hexes[best], code: palette.codes?.[best] || '', index: best, dE: Math.round(bestD * 10) / 10 };
}

// ──────────────────────────────────────────────────────────────
// PNG / JPEG / WebP 输入（sharp，可选依赖）
// ──────────────────────────────────────────────────────────────
let _sharp;
async function parseImage(filePath) {
    if (!_sharp) {
        try { _sharp = (await import('sharp')).default; }
        catch { throw new Error('PNG/JPEG 输入需要 sharp 依赖。运行: pnpm add sharp -w'); }
    }
    // ponytail: 整图解码为 raw，下采样到 128×128 做量化（Median Cut 要的是颜色分布，原图尺寸不影响结果）
    const BUCKET = 128;
    const { data, info } = await _sharp(filePath)
        .ensureAlpha()
        .resize(BUCKET, BUCKET, { fit: 'inside', withoutEnlargement: false })
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // 去透明
        .raw().toBuffer({ resolveWithObject: true });
    const out = [];
    for (let i = 0; i < data.length; i += 3) out.push([data[i], data[i + 1], data[i + 2]]);
    return { width: info.width, height: info.height, pixels: out };
}

// ──────────────────────────────────────────────────────────────
// PPM / JSON 输入解析
// ──────────────────────────────────────────────────────────────
function parsePixels(raw, kind) {
    // raw = Buffer 或字符串
    if (kind === 'json') {
        let data;
        try { data = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')); }
        catch { throw new Error('JSON 解析失败'); }
        let pixels;
        if (Array.isArray(data.pixels)) {
            pixels = data.pixels.map(p => {
                if (typeof p === 'string') return hexToRgb(p.startsWith('#') ? p : '#' + p);
                if (Array.isArray(p)) return p;
                throw new Error('pixels 元素必须是 "#RRGGBB" 或 [r,g,b]');
            });
        } else if (Array.isArray(data)) {
            pixels = data.map(p => typeof p === 'string' ? hexToRgb(p) : p);
        } else {
            throw new Error('JSON 格式：{"pixels":["#RRGGBB",...]} 或 [["#RRGGBB",...]]');
        }
        return { width: data.width || pixels.length, height: data.height || 1, pixels };
    }
    // PPM（P3 ASCII / P6 binary）
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    // 找第一个非注释非空白字符
    let off = 0;
    while (off < buf.length) {
        const c = String.fromCharCode(buf[off]);
        if (c === '#') { while (off < buf.length && buf[off] !== 10) off++; off++; }
        else if (c === ' ' || c === '\n' || c === '\t' || c === '\r') off++;
        else break;
    }
    const magic = String.fromCharCode(buf[off], buf[off + 1]);
    off += 2;
    if (magic !== 'P3' && magic !== 'P6') throw new Error(`非 PPM: magic=${magic}`);
    const readNum = () => {
        while (off < buf.length) {
            const c = String.fromCharCode(buf[off]);
            if (c === '#') { while (off < buf.length && buf[off] !== 10) off++; off++; }
            else if (c === ' ' || c === '\n' || c === '\t' || c === '\r') off++;
            else break;
        }
        let n = '';
        while (off < buf.length && /[0-9]/.test(String.fromCharCode(buf[off]))) { n += String.fromCharCode(buf[off]); off++; }
        return parseInt(n, 10);
    };
    const W = readNum(), H = readNum(), maxVal = readNum();
    const pixels = [];
    if (magic === 'P3') {
        const str = buf.slice(off).toString('utf8').trim();
        const parts = str.split(/\s+/);
        for (let i = 0; i < parts.length; i += 3) pixels.push([+parts[i], +parts[i + 1], +parts[i + 2]]);
    } else {
        for (let i = 0; i < buf.length - off; i += 3) pixels.push([buf[off + i], buf[off + i + 1], buf[off + i + 2]]);
    }
    return { width: W, height: H, pixels };
}

// ──────────────────────────────────────────────────────────────
// 主流程
// ──────────────────────────────────────────────────────────────
async function run(args) {
    console.log(`\n🎨 palette-quantize.mjs`);
    console.log(`   ─ 输入=${args.input || '(demo)'}  色板=${args.palette}  目标色数=${args.colors}  上限=${args.maxColors}`);

    // 1. 加载色板
    const palette = loadPalette(args.palette);
    console.log(`\n📋 色板: ${palette.name} (${palette.hexes.length} 色)`);

    // 2. 加载像素
    let pixels;
    if (args.demo || !args.input) {
        // demo: 艺术七色（白橙红紫蓝绿黄）+ 灰棕
        pixels = ['#FFFFFF', '#FF8200', '#EE2737', '#EF64A2', '#0077CF', '#26D07C', '#FFC72C', '#97999B', '#B39D88', '#000000']
            .flatMap(h => {
                const [r, g, b] = hexToRgb(h);
                // 每色生成 50 个带±10 扰动的像素模拟量化噪声
                const out = [];
                for (let i = 0; i < 50; i++) {
                    const jitter = () => Math.floor((Math.random() - 0.5) * 20);
                    out.push([Math.max(0, Math.min(255, r + jitter())),
                              Math.max(0, Math.min(255, g + jitter())),
                              Math.max(0, Math.min(255, b + jitter()))]);
                }
                return out;
            });
        console.log(`📷 demo 模式: 10 色 × 50 扰动像素 = ${pixels.length} px`);
    } else {
        const ext = args.input.split('.').pop().toLowerCase();
        const imgExt = ['png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff', 'gif'];
        let parsed;
        if (imgExt.includes(ext)) {
            parsed = await parseImage(args.input);
        } else {
            const raw = readFileSync(args.input);
            const kind = ext === 'json' ? 'json' : 'ppm';
            parsed = parsePixels(raw, kind);
        }
        pixels = parsed.pixels;
        console.log(`📷 ${args.input}: ${parsed.width}×${parsed.height} = ${pixels.length} px`);
    }

    // 2.5. 输入色相集中度（ponytail: 小=集中=单色图，大=分散=全色谱）
    const hueSpread = hueConcentration(pixels);
    const HUE_GUARD_THRESHOLD = 60; // 环形均值方向的集中度角，<60° 视为色相集中图
    const hueGuardActive = hueSpread < HUE_GUARD_THRESHOLD;
    console.log(`🌈 输入色相集中度: ${hueSpread.toFixed(0)}°（${hueGuardActive ? '集中图 → 补色限 ±90°' : '分散图 → 无限制'}）`);

    // 3. Median Cut 量化到 N 色（Hue-aware 4 通道）
    const clusters = medianCut(pixels, 0, args.colors);
    console.log(`🔬 Median Cut → ${clusters.length} 簇`);

    // 4. 每簇 Dominant Color（众数）
    const clusterHexes = clusters.map((c, i) => ({ hex: dominantColor(c), size: c.length }));
    console.log(`   Dominant Color（众数，非均值）: ${clusterHexes.map(c => c.hex).join(', ')}`);

    // 5. 映射到品牌色板（ΔE76 最近邻）
    const mapped = [];
    for (const c of clusterHexes) {
        const m = nearestBrand(c.hex, palette);
        // 跳过已映射相同的（去重）
        if (!mapped.some(x => x.index === m.index)) {
            mapped.push({ ...m, clusterSize: c.size, clusterHex: c.hex });
        }
    }
    console.log(`🎯 品牌色板最近邻 → ${mapped.length} 色（ΔE76）`);
    mapped.forEach(m => console.log(`   ${m.code} ${m.hex}  dE=${m.dE}  (簇色 ${m.clusterHex}  size=${m.clusterSize})`));

    // 6. 门 B 过滤（单色下限：baseΔE 与黑 ≥ 8）
    const passB = mapped.filter(m => !GATE_B_FAIL(m.hex));
    const bFail = mapped.filter(m => GATE_B_FAIL(m.hex));
    if (bFail.length) console.log(`⛔ 门 B 拦截（深珠不可见）: ${bFail.map(m => `${m.code} ${m.hex}`).join(', ')}`);

    // 7. 门 C 过滤（近似族互斥）——贪心保留独立集
    const passC = [];
    for (const m of passB) {
        if (passC.length >= args.maxColors) break;
        if (passC.every(p => !CONFUSABLE(p.hex, m.hex))) passC.push(m);
    }
    const cRejected = passB.filter(m => !passC.includes(m));
    if (cRejected.length) console.log(`⛔ 门 C 拦截（近似族互斥）: ${cRejected.map(m => `${m.code} ${m.hex}`).join(', ')}`);

    // 8. 补色：如果门 C 过滤后不够，从剩余品牌色板挑分布质量最优的
    // ponytail: 加 hue guard（输入色相较集中时补色限 ±90°）+ minBandΔE ≥ 15 硬门槛
    let selected = passC;
    let bandHardGate = true;  // minBandΔE ≥ 15 硬门开（耗尽降级）
    if (selected.length < args.colors) {
        console.log(`\n🔄 门 C 过滤后仅 ${selected.length} 色，补色至 ${Math.min(args.colors, args.maxColors)} 色（分布质量优先${hueGuardActive ? ' + hue guard ±90°' : ''}${bandHardGate ? ' + minBandΔE ≥ 15' : ''}）`);
        const target = Math.min(args.colors, args.maxColors);
        while (selected.length < target) {
            // 候选 hue guard：集中图时，候选色 hue 与已选集均值 hue 环形差 ≤ 90°
            const wrapHue = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
            let selMeanHue = null;
            if (hueGuardActive) {
                // 环形均值
                let sinS = 0, cosS = 0;
                for (const s of selected) { const h = hslOf(s.hex); sinS += Math.sin(h * Math.PI / 180); cosS += Math.cos(h * Math.PI / 180); }
                selMeanHue = Math.atan2(sinS, cosS) * 180 / Math.PI;
            }
            let best = null, bestScore = -Infinity;
            const selectedHexes = selected.map(s => s.hex);
            for (let i = 0; i < palette.hexes.length; i++) {
                const h = palette.hexes[i];
                if (selected.some(s => s.index === i)) continue;
                if (selected.some(s => CONFUSABLE(s.hex, h))) continue;
                // Hue guard 过滤
                if (hueGuardActive && selMeanHue !== null) {
                    const candidateHue = hslOf(h);
                    if (wrapHue(candidateHue, selMeanHue) > 90) continue;
                }
                // minBandΔE 硬门槛（新选色与已选集最小 bandΔE ≥ 15，耗尽降级）
                let minBandToSel = Infinity;
                for (const s of selectedHexes) minBandToSel = Math.min(minBandToSel, bandDelta(s, h));
                if (bandHardGate && minBandToSel < QUALITY_MIN_BAND) continue;
                const temp = [...selectedHexes, h];
                const q = distributionQuality(temp);
                const score = q.score * 100 + minBandToSel;
                if (score > bestScore) { bestScore = score; best = { hex: h, code: palette.codes?.[i] || '', index: i }; }
            }
            if (!best) {
                if (hueGuardActive) {
                    console.log(`   ℹ️ hue guard 内候选耗尽，降级为无 guard 补色`);
                    hueGuardActive = false; continue;
                }
                if (bandHardGate) {
                    console.log(`   ℹ️ minBandΔE ≥ ${QUALITY_MIN_BAND} 硬门槛耗尽，降级为软门槛补色`);
                    bandHardGate = false; continue;
                }
                break;
            }
            selected.push(best);
        }
    }

    // 9. 分布质量最终评分
    const selectedHexes = selected.map(s => s.hex);
    const q = distributionQuality(selectedHexes);

    // 10. 输出
    console.log(`\n✅ 最终选色 ${selected.length} 色：`);
    selected.forEach((s, i) => console.log(`   #${i + 1}  ${s.code.padEnd(10)} ${s.hex}  ΔE_black=${Math.round(deltaE76(s.hex, BLACK))}  luma=${Math.round(lumaOf(s.hex))}  hue=${Math.round(hslOf(s.hex))}°`));
    console.log(`\n📊 分布质量评分: ${q.score}/4
   · 色相扇区覆盖 ${q.hueSectors}/${QUALITY_HUE_SECTORS}（≥${QUALITY_MIN_SECTOR_COVERAGE(selected.length)}? ${q.hueOk ? '✓' : '✗'}）
   · 明度跨度 ${q.lumaSpan}（≥${QUALITY_LUMA_SPAN_MIN}? ${q.lumaOk ? '✓' : '✗'}）
   · 最小 bandΔE ${q.minBandDelta}（≥15? ${q.minBandDelta >= 15 ? '✓' : '✗'}）`);

    const result = {
        palette: palette.name,
        paletteSlug: palette.slug,
        targetColors: args.colors,
        maxColors: args.maxColors,
        selected: selected.map(s => ({ code: s.code, hex: s.hex, index: s.index })),
        distributionQuality: q,
        gates: {
            b: { threshold: PIT_VISIBLE_MIN, blackFails: bFail.length, filtered: bFail.map(m => m.code) },
            c: { bandMax: NEARFAM_BAND_MAX, baseMax: NEARFAM_BASE_MAX, rejected: cRejected.length, filtered: cRejected.map(m => m.code) },
        },
        pipeline: { quantizer: 'median-cut', dominant: 'mode(per-6bit-channel)', mapper: 'ΔE76-nearest', gateC: 'τ=10 band ∧ τ=22 base confusable' },
    };

    const OUT_JSON = resolve(args.html ? dirname(args.html) : process.cwd(), 'palette-quantize-result.json');
    writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
    console.log(`\n→ JSON: ${OUT_JSON}`);

    // 11. 可选 HTML 预览
    if (args.html) {
        writeFileSync(resolve(args.html), renderPreview(selected, q, palette));
        console.log(`→ HTML: ${args.html}`);
    }

    return result;
}

// ──────────────────────────────────────────────────────────────
// HTML 预览（刻面豆渲染）
// ──────────────────────────────────────────────────────────────
function renderPreview(selected, q, palette) {
    const BEAD_R = 32, GAP = 14, STEP = BEAD_R * 2 + GAP;
    // 与上方 mixHex 同步 ADR-0028 语义（正向直接 factor，不再 ×0.5）
    const mix = (hex, f) => {
        const [r, g, b] = hexToRgb(hex); let nr, ng, nb;
        if (f < 0) { const k = 1 + f; nr = r * k; ng = g * k; nb = b * k; }
        else { const k = f; nr = r + (255 - r) * k; ng = g + (255 - g) * k; nb = b + (255 - b) * k; }
        return rgbToHex(nr, ng, nb);
    };
    const svgBead = (hex, cx, cy, code) => {
        const dark = mix(hex, -0.44), edge = mix(hex, -0.30), lit = mix(hex, +0.38), right = mix(hex, -0.16), hole = mix(hex, -0.55);
        return `<g><circle cx="${cx}" cy="${cy}" r="${BEAD_R}" fill="${edge}"/>
<polygon points="${cx},${cy - BEAD_R + 2} ${cx - BEAD_R + 4},${cy - 2} ${cx + BEAD_R - 4},${cy - 2}" fill="${lit}"/>
<polygon points="${cx + BEAD_R - 2},${cy - 2} ${cx + BEAD_R - 2},${cy + BEAD_R - 2} ${cx},${cy}" fill="${right}"/>
<polygon points="${cx - BEAD_R + 2},${cy + BEAD_R - 2} ${cx + 2},${cy + BEAD_R - 2} ${cx},${cy}" fill="${dark}"/>
<circle cx="${cx}" cy="${cy}" r="${BEAD_R * 0.55}" fill="${hex}"/>
<circle cx="${cx}" cy="${cy}" r="${BEAD_R * 0.22}" fill="${hole}"/>
<text x="${cx}" y="${cy + BEAD_R + 12}" text-anchor="middle" font-size="10" fill="#666" font-family="monospace">${code}</text></g>`;
    };
    const n = selected.length;
    const cols = Math.min(n, 8);
    const rows = Math.ceil(n / cols);
    const W = cols * STEP + 40, H = rows * STEP + 80;
    let svg = `<svg width="${W}" height="${H}">`;
    selected.forEach((s, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        svg += svgBead(s.hex, 20 + BEAD_R + col * STEP, 40 + BEAD_R + row * STEP, s.code);
    });
    svg += '</svg>';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>palette-quantize 预览</title>
<style>body{font-family:system-ui,sans-serif;margin:40px;background:#fafaf5}h1{font-size:18px}h2{font-size:14px;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px;display:inline-block}code{background:#eee;padding:1px 4px;border-radius:3px;font-size:12px}.badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:4px}.pass{background:#e0ffe0;color:#3c3}.fail{background:#ffe0e0;color:#c33}</style></head><body>
<h1>🎨 palette-quantize · ${palette.name}</h1>
<p style="color:#888;font-size:12px">${selected.length} 色 · 门 B(τ=${PIT_VISIBLE_MIN}) + 门 C(band≤${NEARFAM_BAND_MAX} ∧ base≤${NEARFAM_BASE_MAX}) · 分布质量 ${q.score}/4</p>
${svg}
<h2>分布质量</h2>
<p>
  <span class="badge ${q.hueOk ? 'pass' : 'fail'}">色相扇区 ${q.hueSectors}/${QUALITY_HUE_SECTORS}</span>
  <span class="badge ${q.lumaOk ? 'pass' : 'fail'}">明度跨度 ${q.lumaSpan}（≥${QUALITY_LUMA_SPAN_MIN}）</span>
  <span class="badge ${q.minBandDelta >= 15 ? 'pass' : 'fail'}">最小 bandΔE ${q.minBandDelta}（≥15）</span>
</p>
</body></html>`;
}

// ──────────────────────────────────────────────────────────────
// Entry
// ──────────────────────────────────────────────────────────────
run(parseArgs(process.argv)).catch((e) => { console.error('❌', e.message); process.exit(1); });
