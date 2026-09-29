/**
 * [WXG-T-222] Studio tint 资源导出 + 实时预览（有孔/无孔 × 四向刻面）。
 *
 * 与 bake-export（T-221 逐色位图成品）不同：tint mask 是**色无关**的
 * （一张 mask × 运行时 tint 色 = 任意珠色，ADR-0028）⇒ 无逐色导出，
 * 只按档位（holed/holeless）出 4 张：bead/grid × base/mask。
 *
 * 烘焙逻辑**不搬 JS**（单一真源零移植）：`GET /api/tint-export` 服务端子进程跑
 * 定稿脚本 tools/mask-preview/export-cocos-textures{,-holeless}.py（v1.0 冻结口径），
 * 回 base64 → 本模块①逐张触发浏览器下载；②本地 Canvas 按 shader 同款公式
 * `rgb = c·d + (1−c)·l, a = 形状` 逐像素合成实时预览（改色即时重算，零请求）。
 */

function setStatus(text, cls) {
    const el = document.getElementById('tint-status');
    if (el) { el.textContent = text; el.className = cls || ''; }
}

// ── 档位缓存：mode → {bead:{base,mask}, grid:{base,mask}}（ImageData）──
const cache = {};
let loading = null; // 进行中的 loadMode Promise（防并发重复拉取）

function imgDataFromDataUrl(url) {
    return new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = im.width; cv.height = im.height;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(im, 0, 0);
            resolve(ctx.getImageData(0, 0, im.width, im.height));
        };
        im.onerror = () => reject(new Error('贴图解码失败'));
        im.src = url;
    });
}

async function loadMode(mode) {
    if (cache[mode]) return cache[mode];
    if (loading) await loading.catch(() => {});
    if (cache[mode]) return cache[mode];
    loading = (async () => {
        setStatus('烘焙中（服务端跑定稿脚本）…');
        const res = await fetch(`/api/tint-export?mode=${encodeURIComponent(mode)}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || String(res.status));
        const byName = {};
        for (const f of j.files) byName[f.filename] = f.dataUrl;
        const pick = (prefix) => ({
            base: byName[`${prefix}-base.png`],
            mask: byName[`${prefix}-mask.png`],
        });
        const beadPrefix = mode === 'holed' ? 'bead-tint-128' : 'bead-holeless-tint-128';
        const gridPrefix = mode === 'holed' ? 'grid-tint-128' : 'grid-holeless-tint-128';
        const [bb, bm, gb, gm] = await Promise.all([
            imgDataFromDataUrl(pick(beadPrefix).base),
            imgDataFromDataUrl(pick(beadPrefix).mask),
            imgDataFromDataUrl(pick(gridPrefix).base),
            imgDataFromDataUrl(pick(gridPrefix).mask),
        ]);
        cache[mode] = {
            bead: { base: bb, mask: bm }, grid: { base: gb, mask: gm },
            _urls: byName, // 导出复用（免二次烘焙请求）
        };
        return cache[mode];
    })();
    try {
        return await loading;
    } finally {
        loading = null;
    }
}

/**
 * shader 同款合成（games/beads/cocos tint-mask.effect 同公式）：
 *   rgb = baseColor·d + (1−baseColor)·l ；a = 形状（mask B）× base alpha。
 * mask 编码 R=d / G=l / B=形状（A=255 满幅，免疫 Trim）。
 */
function composite(mask, base, hex) {
    const n = hex.replace('#', '');
    const cr = parseInt(n.slice(0, 2), 16) / 255;
    const cg = parseInt(n.slice(2, 4), 16) / 255;
    const cb = parseInt(n.slice(4, 6), 16) / 255;
    const w = mask.width, h = mask.height;
    const out = new ImageData(w, h);
    const md = mask.data, bd = base.data, od = out.data;
    for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        const d = md[o] / 255, l = md[o + 1] / 255, shp = md[o + 2] / 255;
        od[o]     = (cr * d + (1 - cr) * l) * 255;
        od[o + 1] = (cg * d + (1 - cg) * l) * 255;
        od[o + 2] = (cb * d + (1 - cb) * l) * 255;
        od[o + 3] = shp * (bd[o + 3] / 255) * 255;
    }
    return out;
}

function drawPreview(kind, mode, hex) {
    const cv = document.getElementById(`tint-cv-${kind}`);
    const m = cache[mode]?.[kind];
    if (!cv || !m) return;
    const off = document.createElement('canvas');
    off.width = m.mask.width; off.height = m.mask.height;
    off.getContext('2d').putImageData(composite(m.mask, m.base, hex), 0, 0);
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false; // 1:1 texel 放大（pixelated）
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
}

function refreshPreview() {
    const mode = document.getElementById('tint-mode')?.value || 'holed';
    const hex = document.getElementById('tint-color')?.value || '#d9534f';
    if (!cache[mode]) return; // 未拉取完成时不画
    drawPreview('bead', mode, hex);
    drawPreview('grid', mode, hex);
}

// ── 棋盘 tint 渲染支持（WXG-T-222 追加）：按色合成 sprite canvas，board-render 消费 ──
// 每格珠 = bead sprite × 该珠色；空槽 = grid sprite × 该格目标色（= 运行时 tint 渲染预演）。
// ⚠ **布局不变，变的只是豆子样式**（用户 2026-09-29）：bead sprite **裁到珠面窗口**
//（有孔 26dp / 无孔 24dp）⇒ 调用侧把它画到旧版珠体矩形（格内缩 4/30）⇒ 珠占比/缝宽与旧版逐像素一致。
const spriteCache = {}; // mode → kind → hex → canvas
const BEAD_FACE_DP = { holed: 26.0, holeless: 24.0 }; // 珠面（含外框）——裁窗依据，与定稿口径同源

function spriteFor(kind, mode, hex) {
    const m = cache[mode];
    if (!m) return null;
    spriteCache[mode] = spriteCache[mode] || { bead: {}, grid: {} };
    const bucket = spriteCache[mode][kind];
    if (!bucket[hex]) {
        const src = composite(m[kind].mask, m[kind].base, hex);
        const cv = document.createElement('canvas');
        if (kind === 'bead') {
            // 裁珠面窗口：128px 画布中珠面 = dp/30 居中
            const face = Math.round(src.width * BEAD_FACE_DP[mode] / 30);
            const off = Math.round((src.width - face) / 2);
            cv.width = face; cv.height = face;
            cv.getContext('2d').drawImage(
                srcCanvas(src), off, off, face, face, 0, 0, face, face);
        } else {
            cv.width = src.width; cv.height = src.height;
            cv.getContext('2d').putImageData(src, 0, 0); // grid 满幅（格外圈即垫角色）
        }
        bucket[hex] = cv;
    }
    return bucket[hex];
}

function srcCanvas(imageData) {
    const cv = document.createElement('canvas');
    cv.width = imageData.width; cv.height = imageData.height;
    cv.getContext('2d').putImageData(imageData, 0, 0);
    return cv;
}

/** board-render 消费接口：当前档的按色 sprite 取用器（未就绪返回 null ⇒ 回退旧画法）。 */
window.TintBoard = {
    current() {
        const mode = document.getElementById('tint-mode')?.value || 'holed';
        if (!cache[mode]) return null;
        return {
            mode,
            beadFor: (hex) => spriteFor('bead', mode, hex),
            gridFor: (hex) => spriteFor('grid', mode, hex),
            // B0 tile（有珠格的格底）：目标色平铺 ×0.70（B0 档）——**不含坑底结构**。
            // ⛔ 有珠格格底禁用 grid sprite（坑底 0.32 会从豆孔透出 ⇒ 孔内死黑难辨底色，
            // 用户 2026-09-29 反馈）；孔真透应透出 tile 色（色相可辨），空槽才用 grid（深度感）。
            tileFor: (hex) => {
                spriteCache[mode] = spriteCache[mode] || { bead: {}, grid: {} };
                const bucket = (spriteCache[mode].tile ??= {});
                if (!bucket[hex]) {
                    const cv = document.createElement('canvas');
                    cv.width = cv.height = 128;
                    const g = cv.getContext('2d');
                    const n = hex.replace('#', '');
                    g.fillStyle = `rgb(${Math.round(parseInt(n.slice(0, 2), 16) * 0.70)},${
                        Math.round(parseInt(n.slice(2, 4), 16) * 0.70)},${
                        Math.round(parseInt(n.slice(4, 6), 16) * 0.70)})`;
                    g.fillRect(0, 0, 128, 128);
                    bucket[hex] = cv;
                }
                return bucket[hex];
            },
            faceDp: BEAD_FACE_DP[mode], // 珠面 dp（26/24）——调用侧据此推珠体 inset，勿用旧快照 4/30
        };
    },
};

async function refreshMode() {
    const mode = document.getElementById('tint-mode')?.value || 'holed';
    try {
        await loadMode(mode);
        refreshPreview();
        setStatus(`预览就绪（${mode === 'holed' ? '有孔' : '无孔'}档；改色即时刷新）`, 'ok');
        // 通知棋盘重绘（版面按当前 tint 档位渲染）
        document.dispatchEvent(new CustomEvent('tint-change', { detail: { mode } }));
    } catch (e) {
        setStatus('预览失败：' + e.message, 'err');
    }
}

async function runExport() {
    const btn = document.getElementById('tint-export');
    const mode = document.getElementById('tint-mode')?.value || 'holed';
    btn.disabled = true;
    try {
        const m = cache[mode] || (await loadMode(mode));
        const names = Object.keys(m._urls);
        for (let i = 0; i < names.length; i++) {
            setStatus(`下载 ${i + 1}/${names.length}：${names[i]}…`);
            const a = document.createElement('a');
            a.href = m._urls[names[i]];
            a.download = names[i];
            document.body.appendChild(a);
            a.click();
            a.remove();
            if (i < names.length - 1) await new Promise(r => setTimeout(r, 300));
        }
        setStatus(`已导出 ${names.length} 张（${mode === 'holed' ? '有孔' : '无孔'}档）`, 'ok');
    } catch (e) {
        setStatus('导出失败：' + e.message, 'err');
    } finally {
        btn.disabled = false;
    }
}

document.addEventListener('click', (ev) => {
    if (ev.target && ev.target.id === 'tint-export') runExport();
});
document.addEventListener('change', (ev) => {
    if (ev.target && ev.target.id === 'tint-mode') refreshMode();
});
document.addEventListener('input', (ev) => {
    if (ev.target && ev.target.id === 'tint-color') refreshPreview();
});

refreshMode(); // 页面载入即预览当前档
