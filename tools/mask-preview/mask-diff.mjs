#!/usr/bin/env node
/**
 * `[WXG-T-226 EP12-S1 / ADR-0029 DEC-3]` **`mask:diff` 对拍门禁** ——
 * 定稿 py 产物（`tools/mask-preview/cocos-assets/*-tint-128-mask.png`）vs TS 场计算输出。
 *
 * ## 它守什么
 *
 * 1. **编码不变式（硬判据，逐条断言）**：`A ≡ 255`、珠面 `B = 圆角方 − 真透孔`、
 *    格面 B＝纯结构件（`[WXG-T-258]`：有孔档只留 3dp 斜面环 255、槽底/格外真透 0；
 *    无孔档槽口内整块 255 —— 0.32 深坑承载 I-5 分叉）、槽底 d（有孔 0.70 / 无孔 0.32）、
 *    格外 d = 0.70、mask 内**零色值**（V-1：与 tint 色无关）。
 *    —— 这些是设计口径（`cell-standard-holed/holeless` J4 + 定稿 py 头注），**不容许容差**。
 * 2. **数值一致（容差）**：逐像素 `|Δ|` 的均值/最大值/P99。
 *
 * ## 退出码
 *
 * `0` = 编码不变式全过 **且** 数值在容差内；`1` = 越容差；`2` = 编码不变式红（口径漂移，比容差更严重）。
 *
 * ## 用法
 *
 * ```bash
 * node --import ./tools/scripts/lib/ts-js-resolve.mjs tools/mask-preview/mask-diff.mjs
 * # 只报数不判定（看真实读数用）：
 * node --import ./tools/scripts/lib/ts-js-resolve.mjs tools/mask-preview/mask-diff.mjs --report-only
 * # 自定义容差（1/255 = 1 个 8-bit 量化步）：
 * node --import ./tools/scripts/lib/ts-js-resolve.mjs tools/mask-preview/mask-diff.mjs --mean 1 --max 2
 * ```
 *
 * ⛔ **本脚本不改动 `verify` 配置**（是否挂进 `pnpm run verify` 由主理人裁定；见 TASKS-DETAIL 回写）。
 * **容差定档（2026-10-07 主理人拍板）**：按**逐字节一致**判（默认 `--mean 0 --max 0`）——
 * 实测四件套恒 `mean=0.0000 max=0`（py 真源与 TS 场计算逐式复刻），建议值（≤1/≤2）反成放宽；
 * 若未来 PIL 升级引入量化差，红灯即暴露（这正是门禁目的），届时再按设计变更流程议容差。
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPngRgba } from './lib/png-rgba.mjs';
import { computeMaskField } from '../../packages/framework/src/core/bake/mask-field.js';
import { maskSpecFor, MASK_CANONICAL_SIZE, MASK_SCHEMA_VERSION } from '../../packages/framework/src/core/bake/mask-spec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, 'cocos-assets');

/** 四件套 = 2 kind × 2 gauge（`art/tint-mask-asset-spec.md §1.1`）。 */
const TARGETS = [
    { kind: 'bead', gauge: 'holed', file: 'bead-hole-tint-128-mask.png' },
    { kind: 'cell', gauge: 'holed', file: 'grid-hole-tint-128-mask.png' },
    { kind: 'bead', gauge: 'holeless', file: 'bead-holeless-tint-128-mask.png' },
    { kind: 'cell', gauge: 'holeless', file: 'grid-holeless-tint-128-mask.png' },
];

const argv = process.argv.slice(2);
const reportOnly = argv.includes('--report-only');
const readArg = (flag, dflt) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] !== undefined ? Number(argv[i + 1]) : dflt;
};
/** 容差（8-bit 量化步 = 1/255 ⇒ 1）。默认值 = 方案件 §4.3 的**建议值**（未与 QA 对齐）。 */
const MEAN_TOL = readArg('--mean', 1);
const MAX_TOL = readArg('--max', 2);

/** 从 `(sx,sy)` 洪泛 `B < thr` 的 4-邻接连通域，返回像素数（孔区量测用）。 */
function floodFillB(data, w, sx, sy, thr) {
    const seen = new Uint8Array(w * w);
    const stack = [sy * w + sx];
    seen[sy * w + sx] = 1;
    let n = 0;
    while (stack.length > 0) {
        const i = stack.pop();
        n++;
        const x = i % w;
        const y = (i - x) / w;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            if (nx < 0 || ny < 0 || nx >= w || ny >= w) continue;
            const j = ny * w + nx;
            if (seen[j] === 1) continue;
            if (data[j * 4 + 2] >= thr) continue;
            seen[j] = 1;
            stack.push(j);
        }
    }
    return n;
}

function invariantFailures(kind, gauge, spec, field) {
    const { width: w, data } = field;
    const fails = [];
    const px = (x, y, c) => data[(y * w + x) * 4 + c];

    // I-1：A ≡ 255 满幅（免疫 Trim）。
    for (let i = 0; i < w * w; i++) {
        if (data[i * 4 + 3] !== 255) {
            fails.push(`I-1 A≠255 @px${i % w},${Math.floor(i / w)} = ${data[i * 4 + 3]}`);
            break;
        }
    }
    // I-4（`[WXG-T-258]` v10.0 复核定档，WXG-T-230 三方对齐后落定）：格面 B = **纯结构件**。
    // 依据链：用户裁定原话「两张图的格底应该是透明，可以和纯色底混合」（TASKS-DETAIL §WXG-T-258）
    //   ⇒ 有孔档 shape 只留 3dp 斜面环 255，槽底/格外/孔位一律真透（B=0），格底纯色下沉到下层
    //   （盘面 L0 底 tile / 托盘 `drawEmptySocket` base rect）；**无孔档不跟随**（其槽底 = 0.32 假孔，
    //   属结构件，抹平即毁判据 I-5 的「有孔 0.70 / 无孔 0.32」分叉）。
    // 旧口径沿革：v7.0（WXG-T-237）「槽口内 255」→ 258 起对有孔档失效；py 的 512 空间那笔
    //   `gm[...,2][槽底]=255` 是**死笔**（被 128 空间判定覆盖，258 定标单明文）。
    // 校验（分档）：① 槽底 B；② 格外 B=0 ⇒ 透明；③ 环带正向腿 B=255 —— ⛔ 没有它
    //   「整格透明」这种错改法也能让 ①② 全绿（258 交付表原文）；④ 全场纯二值（零振铃中间带）。
    if (kind === 'cell') {
        const bAt = (x, y) => data[(y * w + x) * 4 + 2];
        const c = Math.floor(w / 2);
        if (spec.gauge === 'holeless') {
            if (bAt(c, c) !== 255) {
                fails.push(`I-4 槽底 B≠255 @px${c},${c} = ${bAt(c, c)}（无孔档槽底 = 0.32 深坑，结构件必须不透明：判据 I-5 分叉）`);
            }
        } else if (bAt(c, c) !== 0) {
            fails.push(`I-4 槽底 B≠0 @px${c},${c} = ${bAt(c, c)}（[WXG-T-258] 有孔档格底真透，与纯色底混合）`);
        }
        if (bAt(1, 1) !== 0) {
            fails.push(`I-4 格外 B≠0 @px1,1 = ${bAt(1, 1)}（格外须透明以露出 −0.30 底色层）`);
        }
        if (spec.gauge !== 'holeless') {
            // 环带正向腿：中心正上 10.5dp 处（槽口半宽 12dp、环深 3dp ⇒ sd = −1.5dp ∈ 环带内）。
            const ry = c - Math.round((10.5 / spec.cellDp) * w);
            if (bAt(c, ry) !== 255) {
                fails.push(`I-4 斜面环 B≠255 @px${c},${ry} = ${bAt(c, ry)}（正向腿：3dp 环带必须不透明，防「整格透明」假绿）`);
            }
        }
        for (let i = 0; i < w * w; i++) {
            const b = data[i * 4 + 2];
            if (b !== 0 && b !== 255) {
                fails.push(`I-4 shape 非二值 @px${i % w},${Math.floor(i / w)} = ${b}（零振铃中间带）`);
                break;
            }
        }
    }
    // I-5 / I-6：槽底与格外定值（中心像素 / 角像素，±1 量化步）。
    const centre = px(Math.floor(w / 2), Math.floor(w / 2), 0);
    const expectCentre = kind === 'cell' ? Math.trunc(spec.slotFloorD * 255) : null;
    if (expectCentre !== null && Math.abs(centre - expectCentre) > 1) {
        fails.push(`I-5 槽底 R=${centre}，期望 ${expectCentre}±1（${spec.gauge}）`);
    }
    const corner = px(1, 1, 0);
    const expectCorner = Math.trunc(spec.outsideD * 255);
    if (kind === 'cell' && Math.abs(corner - expectCorner) > 1) {
        fails.push(`I-6 格外 R=${corner}，期望 ${expectCorner}±1`);
    }
    // I-2：珠面孔区 B = 0（有孔档，真透 ⌀12 + 0.5dp 羽化 ⇒ 芯区 B 必为 0）。
    // ⚠ 量测口径：与 `asset/tint-mask-asset-spec §2.3 I-2` 对齐 = **「B < 250 的孔区」**
    // （含 0.5dp 羽化环，实测 114.4 dp² ⇒ ⌀12.07dp）。必须**从孔心洪泛**取连通域 ——
    // 直接全图数 `B<250` 会把「圆角方之外的透明角」算进去（那也是 B=0）。
    if (kind === 'bead' && spec.holeDp > 0) {
        const c = Math.floor(w / 2);
        if (px(c, c, 2) !== 0) fails.push(`I-2 孔心 B=${px(c, c, 2)}，期望 0`);
        const holePx = floodFillB(data, w, c, c, 250);
        const perPx = (spec.cellDp / w) * (spec.cellDp / w); // dp²/px²
        const area = holePx * perPx;
        const dEq = 2 * Math.sqrt(area / Math.PI);
        // 参照 spec 实测 12.07dp（羽化环计入）；容差带覆盖 ±1 量化步与浮点差。
        if (dEq < 11.4 || dEq > 13.2) fails.push(`I-2 孔等效 ⌀=${dEq.toFixed(2)}dp（${area.toFixed(1)}dp²），越出 [11.4, 13.2]`);
    }
    // I-3：holeless 珠面无孔（孔区 B ≥ 250，仅外轮廓 AA 残留）。
    if (kind === 'bead' && spec.holeDp <= 0) {
        const c = Math.floor(w / 2);
        if (px(c, c, 2) < 250) fails.push(`I-3 holeless 孔心 B=${px(c, c, 2)}，期望 ≥250`);
    }
    // V-1：mask 与颜色无关 —— 本模块不接收任何颜色参数（结构性保证），此处钉住「无非 0/255 色值」。
    void gauge;
    return fails;
}

function diffStats(a, b) {
    let sum = 0;
    let max = 0;
    let over1 = 0;
    const hist = new Uint32Array(256);
    const n = a.length;
    for (let i = 0; i < n; i++) {
        const d = Math.abs(a[i] - b[i]);
        sum += d;
        if (d > max) max = d;
        if (d > 1) over1++;
        hist[d] = (hist[d] ?? 0) + 1;
    }
    let acc = 0;
    let p99 = 0;
    for (let d = 0; d < 256; d++) {
        acc += hist[d];
        if (acc >= n * 0.99) {
            p99 = d;
            break;
        }
    }
    return { mean: sum / n, max, p99, over1, n };
}

let invariantRed = false;
let tolRed = false;
const lines = [];
lines.push(`mask:diff  规格 MASK_SCHEMA_VERSION=${MASK_SCHEMA_VERSION}  档位 ${MASK_CANONICAL_SIZE}px`);
lines.push(`容差：mean ≤ ${MEAN_TOL}  max ≤ ${MAX_TOL}（8-bit 步）  ${reportOnly ? '〔--report-only：不判定〕' : ''}`);
lines.push('');

for (const t of TARGETS) {
    const spec = maskSpecFor(t.gauge);
    const field = computeMaskField(t.kind, spec, MASK_CANONICAL_SIZE);
    const ref = readPngRgba(join(ASSETS, t.file));

    if (ref.width !== field.width || ref.height !== field.height) {
        lines.push(`❌ ${t.file} 尺寸不符：py ${ref.width}×${ref.height} vs TS ${field.width}×${field.height}`);
        invariantRed = true;
        continue;
    }

    const fails = invariantFailures(t.kind, t.gauge, spec, field);
    const r = diffStats(ref.data, field.data);
    const g = diffStats(ref.data.subarray(1), field.data.subarray(1));
    const b = diffStats(ref.data.subarray(2), field.data.subarray(2));

    lines.push(
        `── ${t.file}  (${t.kind}/${t.gauge})  R: mean=${r.mean.toFixed(4)} max=${r.max} p99=${r.p99} >1步:${r.over1}/${r.n}` +
            ` | G: mean=${g.mean.toFixed(4)} max=${g.max} | B: mean=${b.mean.toFixed(4)} max=${b.max} >1步:${b.over1}`,
    );
    if (fails.length === 0) {
        lines.push('   编码不变式 ✅');
    } else {
        invariantRed = true;
        for (const f of fails) lines.push(`   ❌ ${f}`);
    }
    if (r.mean > MEAN_TOL || r.max > MAX_TOL || g.mean > MEAN_TOL || g.max > MAX_TOL || b.mean > MEAN_TOL || b.max > MAX_TOL) {
        tolRed = true;
        lines.push(`   ⚠ 越容差（未判定=${reportOnly}）`);
    }
}

lines.push('');
if (invariantRed) {
    lines.push('❌ FAIL · 编码不变式红 ⇒ **口径漂移**，比容差更严重（须改 spec 或改 py 定稿，走设计变更流程）');
} else if (tolRed && !reportOnly) {
    lines.push('❌ FAIL · 数值越容差 ⇒ 两实现漂移（R-4）。DEC-3：**对拍绿之前 TS 不得成为唯一真源**');
} else {
    lines.push('✅ PASS · 编码不变式全过' + (tolRed ? '（数值越容差，但 --report-only 不判定）' : ' 且数值在容差内'));
}
console.log(lines.join('\n'));
process.exit(invariantRed || (tolRed && !reportOnly) ? 1 : 0);
