/**
 * [WXG-T-222] Studio tint 资源导出 + 实时预览（有孔/无孔 × 四向刻面）。
 *
 * 与 bake-export（T-221 逐色位图成品）不同：tint mask 是**色无关**的
 * （一张 mask × 运行时 tint 色 = 任意珠色，ADR-0028）⇒ 无逐色导出，
 * 只按档位（holed/holeless）出 2 张 mask：bead/grid（base.png 已于 WXG-T-237 v8.0 移除）。
 *
 * 烘焙逻辑**不搬 JS**（单一真源零移植）：`GET /api/tint-export` 服务端子进程跑
 * 定稿脚本 tools/mask-preview/export-cocos-textures{,-holeless}.py（v1.0 冻结口径），
 * 回 base64 → 本模块①逐张触发浏览器下载；②本地 Canvas 按 shader 同款公式
 * `rgb = c·d + (1−c)·l, a = 形状` 逐像素合成实时预览（改色即时重算，零请求）。
 *
 * [WXG-T-383] 参数化（B 阶）：`PARAM_SPEC` 生成调参滑杆（只在本页有 `#tint-params` 时渲染）。
 * ⛔ 滑杆停在 `def`（= 脚本冻结常量）⇒ **不发送** ⇒ 定稿口径，服务端写 cocos-assets/（逐字节不变）；
 * 动过任意一条 ⇒ 只发改动项 ⇒ 服务端写 cocos-assets/_variants/<key>/（实验档，不入库）。
 * 珠面裁窗读服务端回的 `meta.beadDp`（非固定 26/24）——改 beadDp 后 sprite 才不会裁错。
 */

function setStatus(text, cls) {
    const el = document.getElementById('tint-status');
    if (el) { el.textContent = text; el.className = cls || ''; }
}

// ── 参数规格（WXG-T-383）：与服务端 `TINT_MODES[...].params` 同值同界，`def` = 脚本冻结常量。
//   ⛔ 键集随档位不同（无孔档没有孔、cornerDp 上界 12）—— 一份通用表会让服务端 400 变成 500。
//   ⛔ `def` 必须落在 `(def − min) / step` 为整数的网格上：`<input type=range>` 会把越网格的 value
//   **静默吸附**到邻近格（实测 step=0.02 时 facetDown 0.37 → 0.38）⇒ 页面一载入就被判成「改过」，
//   请求带 params 落进 _variants/ 而用户什么都没动。故 0..1 档一律 step 0.01。
const PARAM_COMMON = {
    frameDp: { def: 1, min: 0, max: 5, step: 0.25, label: '外框宽 dp' },
    litL: { def: 0.38, min: 0, max: 1, step: 0.01, label: 'lit 档' },
    plateD: { def: 0.56, min: 0, max: 1, step: 0.01, label: 'plate 档' },
    facetUp: { def: 1, min: 0, max: 1, step: 0.01, label: '上刻面' },
    facetRight: { def: 0.74, min: 0, max: 1, step: 0.01, label: '右刻面' },
    facetDown: { def: 0.37, min: 0, max: 1, step: 0.01, label: '下刻面' },
};
const PARAM_SPEC = {
    holed: {
        holeDp: { def: 12, min: 6, max: 20, step: 0.5, label: '孔径 dp' },
        holeRingDp: { def: 1, min: 0, max: 4, step: 0.25, label: '孔边宽 dp' },
        cornerDp: { def: 8, min: 0, max: 15, step: 0.5, label: '圆角 dp' },
        beadDp: { def: 26, min: 18, max: 30, step: 0.5, label: '珠面 dp' },
        ...PARAM_COMMON,
    },
    holeless: {
        cornerDp: { def: 7, min: 0, max: 12, step: 0.5, label: '圆角 dp' },
        beadDp: { def: 24, min: 18, max: 30, step: 0.5, label: '珠面 dp' },
        ...PARAM_COMMON,
    },
};

/** 只收「动过」的键（= 与 def 不等）⇒ 全默认时请求不带 params，走定稿口径。 */
function readParams(mode) {
    const spec = PARAM_SPEC[mode] || {};
    const out = {};
    for (const k of Object.keys(spec)) {
        const el = document.getElementById(`p-${k}`);
        if (!el) continue;
        const v = Number(el.value);
        if (Number.isFinite(v) && Math.abs(v - spec[k].def) > 1e-9) out[k] = v;
    }
    return out;
}

function paramKey(mode, params) {
    const ks = Object.keys(params).sort();
    return ks.length ? `${mode}|${ks.map((k) => `${k}=${params[k]}`).join(',')}` : mode;
}

/** 渲染本档滑杆（幂等：同档位已渲染则跳过）。容器缺失（生成页）⇒ 静默不做事。 */
function renderParamInputs(mode) {
    const box = document.getElementById('tint-params');
    if (!box || box.dataset.mode === mode) return;
    box.dataset.mode = mode;
    box.innerHTML = '';
    for (const [k, s] of Object.entries(PARAM_SPEC[mode] || {})) {
        const row = document.createElement('label');
        row.className = 'p-row';
        row.innerHTML = `<span>${s.label}</span><span id="v-${k}">${s.def}</span>`
            + `<input type="range" id="p-${k}" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.def}">`;
        box.appendChild(row);
    }
}

// ── 档位缓存：mode(+params) → {bead:{mask}, grid:{mask}, beadDp}（ImageData）──
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

async function loadMode(mode, params = {}) {
    const key = paramKey(mode, params);
    if (cache[key]) return cache[key];
    if (loading) await loading.catch(() => { });
    if (cache[key]) return cache[key];
    loading = (async () => {
        setStatus('烘焙中（服务端跑定稿脚本）…');
        const qs = new URLSearchParams({ mode });
        if (Object.keys(params).length) qs.set('params', JSON.stringify(params));
        const res = await fetch(`/api/tint-export?${qs}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || String(res.status));
        const byName = {};
        for (const f of j.files) byName[f.filename] = f.dataUrl;
        // base 已于 WXG-T-237 v8.0 移除（透明度只由 mask B(shape) 承担）；holed 改名 *-hole-*（v9.0）。
        const beadPrefix = mode === 'holed' ? 'bead-hole-tint-128' : 'bead-holeless-tint-128';
        const gridPrefix = mode === 'holed' ? 'grid-hole-tint-128' : 'grid-holeless-tint-128';
        const [bm, gm] = await Promise.all([
            imgDataFromDataUrl(byName[`${beadPrefix}-mask.png`]),
            imgDataFromDataUrl(byName[`${gridPrefix}-mask.png`]),
        ]);
        cache[key] = {
            mode, params,
            beadDp: j.meta?.beadDp ?? BEAD_FACE_DP[mode], // 珠面裁窗真源（改 beadDp 才不裁错）
            variant: j.variant ?? null, // 实验档目录名；定稿口径为 null
            bead: { mask: bm }, grid: { mask: gm },
            _urls: byName, // 导出复用（免二次烘焙请求）
        };
        return cache[key];
    })();
    try {
        return await loading;
    } finally {
        loading = null;
    }
}

/**
 * shader 同款合成（games/beads/cocos tint-mask.effect 同公式）：
 *   rgb = baseColor·d + (1−baseColor)·l ；a = 形状（mask B）。
 * mask 编码 R=d / G=l / B=形状（A=255 满幅，免疫 Trim）。base.png 已于 v8.0 移除（恒不透明）。
 */
function composite(mask, hex) {
    const n = hex.replace('#', '');
    const cr = parseInt(n.slice(0, 2), 16) / 255;
    const cg = parseInt(n.slice(2, 4), 16) / 255;
    const cb = parseInt(n.slice(4, 6), 16) / 255;
    const w = mask.width, h = mask.height;
    const out = new ImageData(w, h);
    const md = mask.data, od = out.data;
    for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        const d = md[o] / 255, l = md[o + 1] / 255, shp = md[o + 2] / 255;
        od[o] = (cr * d + (1 - cr) * l) * 255;
        od[o + 1] = (cg * d + (1 - cg) * l) * 255;
        od[o + 2] = (cb * d + (1 - cb) * l) * 255;
        od[o + 3] = shp * 255;
    }
    return out;
}

function drawPreview(kind, entry, hex) {
    const cv = document.getElementById(`tint-cv-${kind}`);
    const m = entry?.[kind];
    if (!cv || !m) return;
    const off = document.createElement('canvas');
    off.width = m.mask.width; off.height = m.mask.height;
    off.getContext('2d').putImageData(composite(m.mask, hex), 0, 0);
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false; // 1:1 texel 放大（pixelated）
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
}

/** 当前档 + 当前滑杆值对应的缓存条目（未烘焙到 ⇒ undefined）。 */
function currentEntry() {
    const mode = document.getElementById('tint-mode')?.value || 'holed';
    return cache[paramKey(mode, readParams(mode))];
}

function refreshPreview() {
    const hex = document.getElementById('tint-color')?.value || '#d9534f';
    const m = currentEntry();
    if (!m) return; // 未拉取完成时不画
    drawPreview('bead', m, hex);
    drawPreview('grid', m, hex);
}

// ── 棋盘 tint 渲染支持（WXG-T-222 追加）：按色合成 sprite canvas，board-render 消费 ──
// 每格珠 = bead sprite × 该珠色；空槽 = grid sprite × 该格目标色（= 运行时 tint 渲染预演）。
// ⚠ **布局不变，变的只是豆子样式**（用户 2026-09-29）：bead sprite **裁到珠面窗口**
//（有孔 26dp / 无孔 24dp，调参后以 `meta.beadDp` 为准）⇒ 调用侧把它画到旧版珠体矩形（格内缩 4/30）
// ⇒ 珠占比/缝宽与旧版逐像素一致。
const spriteCache = {}; // paramKey → kind → hex → canvas
const BEAD_FACE_DP = { holed: 26.0, holeless: 24.0 }; // 定稿珠面（= 服务端 meta.beadDp 的兜底值）

function spriteFor(kind, key, hex) {
    const m = cache[key];
    if (!m) return null;
    spriteCache[key] = spriteCache[key] || { bead: {}, grid: {} };
    const bucket = spriteCache[key][kind];
    if (!bucket[hex]) {
        const src = composite(m[kind].mask, hex);
        const cv = document.createElement('canvas');
        if (kind === 'bead') {
            // 裁珠面窗口：128px 画布中珠面 = dp/30 居中
            const face = Math.round(src.width * m.beadDp / 30);
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

// B0 tile（有珠格的格底）：目标色平铺 ×0.70（B0 档）——**不含坑底结构**。
// ⛔ 有珠格格底禁用 grid sprite（坑底 0.32 会从豆孔透出 ⇒ 孔内死黑难辨底色，
// 用户 2026-09-29 反馈）；孔真透应透出 tile 色（色相可辨），空槽才用 grid（深度感）。
function tileFor(key, hex) {
    spriteCache[key] = spriteCache[key] || { bead: {}, grid: {} };
    const bucket = (spriteCache[key].tile ??= {});
    if (!bucket[hex]) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 128;
        const g = cv.getContext('2d');
        const n = hex.replace('#', '');
        g.fillStyle = `rgb(${Math.round(parseInt(n.slice(0, 2), 16) * 0.70)},${Math.round(parseInt(n.slice(2, 4), 16) * 0.70)},${Math.round(parseInt(n.slice(4, 6), 16) * 0.70)})`;
        g.fillRect(0, 0, 128, 128);
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
        const params = readParams(mode);
        const key = paramKey(mode, params);
        const entry = cache[key];
        if (!entry) return null;
        return {
            mode, params, variant: entry.variant,
            beadFor: (hex) => spriteFor('bead', key, hex),
            gridFor: (hex) => spriteFor('grid', key, hex),
            tileFor: (hex) => tileFor(key, hex),
            faceDp: entry.beadDp, // 珠面 dp——调用侧据此推珠体 inset，勿用旧快照 4/30
        };
    },
};

async function refreshMode() {
    const mode = document.getElementById('tint-mode')?.value || 'holed';
    renderParamInputs(mode);
    const params = readParams(mode);
    try {
        const entry = await loadMode(mode, params);
        refreshPreview();
        const tag = mode === 'holed' ? '有孔' : '无孔';
        const changed = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' ');
        setStatus(entry.variant
            ? `实验档（${tag}）· ${changed} · _variants/${entry.variant}/`
            : `定稿口径（${tag}）· 滑杆全默认，产物逐字节不变`, 'ok');
        // 通知棋盘重绘（版面按当前 tint 档位 + 参数渲染）
        document.dispatchEvent(new CustomEvent('tint-change', { detail: { mode, params } }));
    } catch (e) {
        setStatus('预览失败：' + e.message, 'err');
    }
}

async function runExport() {
    const btn = document.getElementById('tint-export');
    const mode = document.getElementById('tint-mode')?.value || 'holed';
    btn.disabled = true;
    try {
        const m = cache[paramKey(mode, readParams(mode))] || (await loadMode(mode, readParams(mode)));
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
        setStatus(`已导出 ${names.length} 张（${mode === 'holed' ? '有孔' : '无孔'}档`
            + `${m.variant ? ` · 实验档 ${m.variant}` : ' · 定稿口径'}）`, 'ok');
    } catch (e) {
        setStatus('导出失败：' + e.message, 'err');
    } finally {
        btn.disabled = false;
    }
}

/** 滑杆值 → 右侧读数（拖动中即时更新，不触发烘焙）。 */
function syncParamLabel(el) {
    const k = el.id.slice(2);
    const mode = document.getElementById('tint-mode')?.value || 'holed';
    const s = PARAM_SPEC[mode]?.[k];
    const out = document.getElementById(`v-${k}`);
    if (!s || !out) return;
    out.textContent = el.value;
    out.classList.toggle('diff', Math.abs(Number(el.value) - s.def) > 1e-9);
}

/** 全部滑杆回默认 ⇒ 下次 refreshMode 走去 params 的定稿口径。@returns refreshMode 的 promise */
function resetParams() {
    const mode = document.getElementById('tint-mode')?.value || 'holed';
    for (const [k, s] of Object.entries(PARAM_SPEC[mode] || {})) {
        const el = document.getElementById(`p-${k}`);
        if (el) { el.value = s.def; syncParamLabel(el); }
    }
    return refreshMode();
}

/**
 * 清空 `cocos-assets/_variants/`（WXG-T-387，服务端删、本端只发起）。
 * 清完把变体缓存全清、滑杆回默认 ⇒ 预览回定稿口径，免得对着已删目录继续显示。
 */
async function clearVariants() {
    if (!window.confirm('删除 cocos-assets/_variants/ 下全部实验档？定稿四张不受影响，但变体不可恢复。')) return;
    try {
        const res = await fetch('/api/tint-variants', { method: 'DELETE' });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || String(res.status));
        for (const k of Object.keys(cache)) if (k.includes('|')) delete cache[k];
        for (const k of Object.keys(spriteCache)) if (k.includes('|')) delete spriteCache[k];
        await resetParams();
        setStatus(`已清理 ${j.removed} 个变体目录 · 回到定稿口径`, 'ok');
    } catch (e) {
        setStatus('清理失败：' + e.message, 'err');
    }
}

document.addEventListener('click', (ev) => {
    const id = ev.target?.id;
    if (id === 'tint-export') runExport();
    else if (id === 'tint-params-reset') resetParams();
    else if (id === 'tint-variants-clear') clearVariants();
});
document.addEventListener('change', (ev) => {
    const id = ev.target?.id || '';
    // 滑杆只在**释放**时烘焙（拖拽期间 input 连续触发，逐次 spawn python 太贵）
    if (id === 'tint-mode' || id.startsWith('p-')) refreshMode();
});
document.addEventListener('input', (ev) => {
    const id = ev.target?.id || '';
    if (id === 'tint-color') refreshPreview();
    else if (id.startsWith('p-')) syncParamLabel(ev.target);
});

refreshMode(); // 页面载入即预览当前档
