/**
 * `[WXG-T-221 / ADR-0027 S3-lite]` Studio 当前关纹理预烘导出（浏览器端）。
 *
 * 流程：详情面板「烘焙本关纹理」按钮 → `GET /api/bake-manifest` 拿缺失清单
 * （服务端扫当前 result 用到的色集 ∖ 已有文件）→ 逐张用 `Canvas2DBakeSurface`
 * 在浏览器出 PNG → `POST /api/bake-save` 回写 `games/beads/assets/{bead,cell}/levels/`。
 *
 * 同源（DEC-4）：出图走 `makeBeadRecipe` / `makeCellRecipe` + 游戏正源 `drawFilledBead`
 * / `drawTargetTile` / `drawEmptySocket`（从 harness 编译产物 import，经 studio server
 * 的 `/harness-dist/*` 只读映射）。依赖 `pnpm run harness:build` 先产出 `dev/harness/dist/`。
 *
 * 本批限制（ADR-0027 S3-lite 范围外）：只支持 demo 10 色盘（`palette === '10'`）。品牌色板
 * （artkal/mard…）的 inks 注入未接线 ⇒ 烘出的 PNG 会用错色 ⇒ 非 demo 盘按钮置灰。
 */
import { Canvas2DBakeSurface, makeBeadRecipe, makeCellRecipe } from '@wxgame/framework';
import { drawFilledBead, drawTargetTile, drawEmptySocket } from '/harness-dist/games/beads/src/view/bead-render.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '/harness-dist/games/beads/src/view/palette.js';
import { BEAD_PITCH, BEAD_CELL, BEAD_DRAW_INSET, BAKE_CANONICAL_SIZE } from '/harness-dist/games/beads/src/config/tuning.js';

const bakeCanvasFactory = {
    createCanvas(w, h) {
        const el = document.createElement('canvas');
        el.width = w;
        el.height = h;
        return el;
    },
};

/** 珠面 / 格面各一个 surface（recipe 注入同一批游戏正源函数）。 */
const beadSurface = new Canvas2DBakeSurface(
    bakeCanvasFactory,
    makeBeadRecipe(drawFilledBead),
);
const cellSurface = new Canvas2DBakeSurface(
    bakeCanvasFactory,
    makeCellRecipe(drawTargetTile, drawEmptySocket, {
        palette: DEFAULT_PALETTE,
        inks: DEMO_BEAD_INKS,
        cellOfPitch: BEAD_CELL / BEAD_PITCH,
        insetOverPitch: BEAD_DRAW_INSET / BEAD_PITCH,
    }),
);

/** BakeResult(RGBA, top-to-bottom) → PNG dataURL（与运行时注册的纹素同源朝向）。 */
function bakeResultToPng(result) {
    const canvas = bakeCanvasFactory.createCanvas(result.width, result.height);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(result.width, result.height);
    img.data.set(result.data);
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
}

async function saveOne(kind, filename, dataUrl) {
    const res = await fetch('/api/bake-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, filename, dataUrl }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || String(res.status));
    return j;
}

/** demo 色板判定：只有 palette==='10'（无品牌引用）时烘出的 PNG 才用对色。 */
function isDemoPalette(r) {
    return !r.palette || r.palette === '10';
}

// ── 与详情面板的接线：index.html 的 show(r) 会调 window.updateBakeButton(r) ──
let currentResult = null;
let baking = false;

function setStatus(text, cls) {
    const el = document.getElementById('bake-status');
    if (el) { el.textContent = text; el.className = cls || ''; }
}

function refreshButton() {
    const btn = document.getElementById('bake');
    if (!btn) return;
    if (!currentResult) { btn.disabled = true; btn.title = '先选中一条结果'; return; }
    if (!isDemoPalette(currentResult)) {
        btn.disabled = true;
        btn.title = '本批仅支持 10 色 demo 盘，品牌色板待 palette 注入接线';
        return;
    }
    btn.disabled = baking;
    btn.title = '';
}

window.updateBakeButton = function (r) {
    currentResult = r;
    baking = false;
    refreshButton();
    const st = document.getElementById('bake-status');
    if (st) st.textContent = isDemoPalette(r) ? '' : '（本批仅支持 10 色 demo，品牌色板待接线）';
};

async function runBake() {
    if (!currentResult || baking) return;
    baking = true;
    refreshButton();
    const styleId = 'facet-4'; // 本批默认皮肤（其余皮肤待注册表接入，S3-lite 范围外）
    try {
        const mres = await fetch(`/api/bake-manifest?id=${encodeURIComponent(currentResult.id)}&style=${styleId}`);
        const manifest = await mres.json().catch(() => ({}));
        if (!mres.ok) throw new Error(manifest.error || String(mres.status));
        const total = manifest.bead.length + manifest.cell.length;
        if (total === 0) {
            setStatus(`全部已烘（本关 ${manifest.counts.used} 色，无缺失）`, 'ok');
            return;
        }
        let done = 0;
        setStatus(`烘焙中 0/${total}…`);
        for (const item of manifest.bead) {
            const result = beadSurface.bake(styleId, item.colorIdx, BAKE_CANONICAL_SIZE);
            await saveOne('bead', item.filename, bakeResultToPng(result));
            setStatus(`烘焙中 ${++done}/${total}…（珠面 c${item.colorIdx}）`);
        }
        for (const item of manifest.cell) {
            const result = cellSurface.bake(styleId, item.colorIdx, BAKE_CANONICAL_SIZE);
            await saveOne('cell', item.filename, bakeResultToPng(result));
            setStatus(`烘焙中 ${++done}/${total}…（格面 c${item.colorIdx}）`);
        }
        setStatus(`已烘 ${total} 张 → games/beads/assets/{bead,cell}/levels/`, 'ok');
    } catch (e) {
        setStatus('烘焙失败：' + e.message, 'err');
    } finally {
        baking = false;
        refreshButton();
    }
}

document.addEventListener('click', (ev) => {
    if (ev.target && ev.target.id === 'bake') runBake();
});

refreshButton();
