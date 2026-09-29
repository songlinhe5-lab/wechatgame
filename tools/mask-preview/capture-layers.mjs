#!/usr/bin/env node
/**
 * 捕获珠面/底图层集 → layers.json（供 Streamlit 预览工具 `preview-app.py` 用）。
 *
 * **固化说明（2026-09-28，自 temp/tint-mask-export 收编至 tools/mask-preview/）**：
 * - 几何**直读** `dev/harness/dist` 真模块（DEC-4 同源：改 `drawFilledBead` / `drawEmptySocket`
 *   / `palette` / `tuning` 后**重跑本脚本一次**即可刷新 layers.json，预览端零改动）。
 * - 层集口径对齐 **WXG-T-223 r8**（槽内一周内阴影 4 层：`shadeOuter −0.80` → `shadeMid −0.68`
 *   → `hole −0.58` → 中心坑底 `pit −0.44`，S3 暗线墨改 `hole`）与 **ADR-0028 §5-补**（孔内阴影
 *   V4 修正版）。字典曾漏 `-0.58/-0.68/-0.80` 三档 ⇒ 内阴影在预览里整段塌成不压暗（已修）。
 * - **孔族不入 mask**（B15）：`captureBead` 不传 `hideHole` ⇒ 孔底 pit 圆 + 孔边线环进 JSON
 *   保留几何，但预览端（preview-app.py `build_mask`）按 B15 跳过 circle ⇒ 孔 live。
 * - `layers.json` 为中间产物，可随时由本脚本重新生成；随库提交是为了 Python 侧免装 Node。
 *
 * USAGE: node --import tools/mask-preview/reg.mjs tools/mask-preview/capture-layers.mjs
 *        （需先 `pnpm run harness:build`；--import 注册 resolve hook——根 node_modules 无
 *        `@wxgame/framework`，bare specifier 直跑会 ERR_MODULE_NOT_FOUND，同 tint-probe r9 复现问题）
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const OUT = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(OUT, '../..');
const DIST = join(ROOT, 'dev/harness/dist');

const { RenderModelBuilder } = await import(pathToFileURL(join(DIST, 'packages/framework/src/core/render/render-model.js')));
const { drawFilledBead, drawTargetTile, drawEmptySocket } = await import(pathToFileURL(join(DIST, 'games/beads/src/view/bead-render.js')));
const { DEMO_BEAD_INKS, endpointOf, mix } = await import(pathToFileURL(join(DIST, 'games/beads/src/view/palette.js')));
const { BEAD_CARD, BEAD_CELL, FACET4_STYLE_ID, FACET4_PLATE_MIX, FACET4_FACET_RIGHT_MIX, BEAD_DRAW_INSET } = await import(pathToFileURL(join(DIST, 'games/beads/src/config/tuning.js')));
const { SOCKET_LIT_MIX, SOCKET_EDGE_DARK_MIX, SOCKET_PIT_DARKEN, SOCKET_SHADE_MID_MIX, SOCKET_SHADE_OUTER_MIX, BEAD_HOLE_STROKE_MIX } = await import(pathToFileURL(join(DIST, 'games/beads/src/view/palette.js')));

// ⛔ **dp 空间烘焙**（2026-09-29）：drawFilledBead/drawEmptySocket 的 size 参数语义是 **dp 数值**
// （内部绝对量如 innerShadeStepDp=1、线宽 1dp 都按 dp 走）⇒ builder 与 size 都用 dp，
// ⛔ 传 px 会把所有绝对 dp 量缩半（实测内阴影层 26/25/24/23dp，文档要求 26/24/22/20）。
// 输出坐标 = dp，由 export 端 ×PX_PER_DP 栅格化。
const CELL_DP = BEAD_CELL;                       // 30dp 格径
const BEAD_FACE_DP = CELL_DP - 2 * BEAD_DRAW_INSET; // 26dp 珠面
const SIZE = CELL_DP;                            // builder 尺寸 = dp 空间 30×30
const COLOR_IDX = 5;
const ep = endpointOf(DEMO_BEAD_INKS, COLOR_IDX);

function captureBead() {
    const b = new RenderModelBuilder(SIZE, SIZE);
    b.begin();
    // ⛔ 不传 hideHole：孔几何（pit 圆 + 边线环）进 JSON，预览端按 B15 跳过（孔 live 不入 mask）。
    drawFilledBead(b, SIZE / 2, SIZE / 2, COLOR_IDX, { size: CELL_DP, styleId: FACET4_STYLE_ID, targetColorIdx: COLOR_IDX });
    return b.end();
}

function captureCell() {
    const b = new RenderModelBuilder(SIZE, SIZE);
    b.begin();
    // tilePainted=true ⇒ B0 由 drawTargetTile 承担；palette 补 slot 防 tray 路径误用。
    const palette = { slot: ep.base, base: ep.base, pit: ep.pit };
    drawTargetTile(b, SIZE / 2, SIZE / 2, COLOR_IDX, DEMO_BEAD_INKS, CELL_DP);
    drawEmptySocket(b, SIZE / 2, SIZE / 2, palette, CELL_DP, COLOR_IDX, DEMO_BEAD_INKS, true, BEAD_DRAW_INSET);
    return b.end();
}

/**
 * 墨档字典（hex → {d,l}）。⚠ 对齐 r8：**必须含槽内阴影三档与 hole 档**，
 * 否则内阴影各层在预览里塌成 d=1（不压暗）——上一版正是漏了这三档。
 */
function buildDict(base) {
    const coeffs = [
        0,                          // base
        FACET4_PLATE_MIX,           // −0.44 plate / 右扇形
        FACET4_FACET_RIGHT_MIX,     // −0.16
        -0.30,                      // 下扇形
        -(SOCKET_EDGE_DARK_MIX + SOCKET_PIT_DARKEN), // −0.44 pit
        -BEAD_HOLE_STROKE_MIX,      // −0.58 hole（S3 暗线 + 内阴影末层 + 孔边线）
        -SOCKET_SHADE_MID_MIX,      // −0.68
        -SOCKET_SHADE_OUTER_MIX,    // −0.80
        SOCKET_LIT_MIX,             // +0.38 lit（S4 亮线）
    ];
    const m = new Map();
    for (const k of coeffs) {
        const hex = (k === 0 ? base : mix(base, k)).toLowerCase();
        m.set(hex, k < 0 ? { d: 1 + k, l: 0 } : k > 0 ? { d: 1, l: k } : { d: 1, l: 0 });
    }
    return m;
}

function toLayers(model, dict) {
    const out = [];
    for (const c of model.commands) {
        // line 也要收（S3 暗线 / S4 亮线是槽凹感的明暗主轴，上一版整类丢弃 ⇒ 预览缺明暗线）。
        if (c.kind !== 'rect' && c.kind !== 'polygon' && c.kind !== 'circle' && c.kind !== 'line') continue;
        const inkHex = c.fill !== undefined ? c.fill : c.stroke;
        const v = inkHex !== undefined ? dict.get(String(inkHex).toLowerCase()) : undefined;
        const L = { kind: c.kind, d: v ? v.d : 1, l: v ? v.l : 0 };
        if (c.kind === 'rect') Object.assign(L, { x: c.x, y: c.y, w: c.w, h: c.h, r: c.radius ?? 0 });
        else if (c.kind === 'circle') Object.assign(L, { cx: c.cx, cy: c.cy, r: c.r, lw: c.lw ?? 0 });
        else if (c.kind === 'line') Object.assign(L, { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, lw: c.lineWidth ?? 1 });
        else { const pts = []; for (let k = 0; k < c.count; k++) pts.push(model.vertices[c.offset + k * 2], model.vertices[c.offset + k * 2 + 1]); L.pts = pts; }
        out.push(L);
    }
    return out;
}

const data = {
    SIZE,            // dp 空间边长（30）
    DP: CELL_DP,     // 格径 dp（兼容旧消费者字段名）
    TEXEL_PER_DP: 1, // layers 坐标已是 dp（兼容旧消费者字段名）
    HOLE_R: Math.round((BEAD_FACE_DP * BEAD_CARD.holeRatio) / 2), // 真透半径 dp（J4：round(26×0.44/2)=6 ⇒ ⌀12）
    beadLayers: toLayers(captureBead(), buildDict(ep.base)),
    cellLayers: toLayers(captureCell(), buildDict(ep.base)),
    base: ep.base,
};

writeFileSync(join(OUT, 'layers.json'), JSON.stringify(data));
console.log(`✅ layers.json（bead:${data.beadLayers.length} cell:${data.cellLayers.length} HOLE_R=${data.HOLE_R}）`);
console.log('   cell 各层 d/l：', data.cellLayers.map((l) => `${l.kind}:${l.d.toFixed(2)}/${l.l.toFixed(2)}`).join(' '));
