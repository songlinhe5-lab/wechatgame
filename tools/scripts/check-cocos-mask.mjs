// 构建产物 mask 门禁（WXG-T-255 / ADR-0030 §5.5）。
//
// 跑法：`pnpm run check:cocos-mask`（先 `pnpm run build:cocos`——默认平台 wechatgame，需 Cocos Creator CLI
// 才有产物可检；无产物 ⇒ 结论写 **SKIP**，⛔ 不许当通过 —— 同 `check-bundle-size.mjs` BD-18 体例）。
//
// 动因（2026-10-05 实测）：Cocos **构建期依赖分析**只打包被 `.prefab` / `.scene` / `.mtl` 引用的资产；
// 载体里的 `MASK_ASSETS` 是**运行期常量** ⇒ 引擎看不见 ⇒ 那两张 `holeless` 不进主包 ⇒ `warmup()`
// 永远凑不齐 ⇒ 静默落回矢量臂 ⇒ `carrier=on` 的收益在任何构建档都拿不到（编辑器 Preview 唯一跑得通）。
// 「静默降级」这件事在屏幕上看是不动声色的，所以必须有**产物级**门禁。
//
// 检什么：① 载体 `MASK_ASSETS` 表里**该档实际要的那几张**（现役 = `TINT_MASK_GAUGE_PIN` 钉住 `holed` ⇒ 2 张），
// 逐张在产物 `assets/<bundle>/native/<uuid 前 2 位>/<uuid>.png|.webp` 里核在不在（`textures` 配成 Bundle 后
// 就从 `main/` 搬到 `textures/` ⇒ ⛔ 不能只扫 main）。需求集与两个宿主同源，⛔ 不在本脚本再抄一遍 uuid 表。
// ② 定稿等值腿（mask 四张）。③ **菜单纹理归属腿**（BD-61）：投放件必须最接近**自己同名**的正本，
// 否则判为「装错件」（文件名与内容不同源）。本脚本因此不止管 mask，名字沿用历史（改名需同改
// package.json + verify 步骤表 + 多处文档引用，按 K-031 不顺手改）。
//
// 机读标记 `STATUS: OK|SKIP|FAIL`（供 `verify-all.mjs` 聚合；K-036：SKIP ≠ 测）。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');

const CARRIER = 'games/beads/cocos/assets/scripts/host/beads-blit-carrier.ts';
const TUNING = 'games/beads/src/config/tuning.ts';
/** 产物目录候选：同 `check-bundle-size.mjs` 的双路径约定。 */
const BUILD_DIRS = ['games/beads/cocos/build/wechatgame', 'games/beads/build/wechatgame'];

/**
 * `--pin=holed|holeless|null` 覆盖在册宏（不改文件就能问「放开宏的话产物够不够」），
 * 缺省 = 读 `tuning.ts` 的 `TINT_MASK_GAUGE_PIN`。
 */
const PIN_ARGV = process.argv.find((a) => a.startsWith('--pin='))?.slice('--pin='.length);

/**
 * `BITMAP_ASSETS` 字面条目解析（`[MENU_TEXTURES.xxx]: { path: 'p' }` / 可带 `bundle`）。
 * 需求集真源 = 载体本身，⛔ 不在本脚本再抄一份文件清单（同 `MASK_ASSETS` 腿口径）。
 * 只认字面条：`...Object.fromEntries(OPEN_ARCS.map(...))` 那类展开条目不在本腿范围（= 关卡缩略图族）。
 */
function parseBitmapPaths(src) {
    const out = [];
    for (const m of src.matchAll(/\[MENU_TEXTURES\.\w+\]:\s*\{\s*path:\s*'([^']+)'(?:[^}]*?bundle:\s*'([^']+)')?\s*\}/g)) {
        out.push({ path: m[1], bundle: m[2] || 'textures' });
    }
    return out;
}

/**
 * `MASK_ASSETS` 字面量解析（`{ 'mask__bead__holed': { uuid: '<uuid>', path: '…' }, … }`）。
 * 只认本文件里那一段常量，正则即够用；表体改写 ⇒ 解析为空 ⇒ 下面按「读不到」报红。
 */
function parseMaskTable(src) {
    const block = src.match(/const MASK_ASSETS[^{]*\{([\s\S]*?)\n\};/);
    if (!block) return {};
    const out = {};
    for (const m of block[1].matchAll(/'([^']+)'\s*:\s*\{\s*uuid:\s*'([0-9a-f-]{36})'/g)) out[m[1]] = m[2];
    return out;
}

/** `TINT_MASK_GAUGE_PIN` 取值（`'holed'` / `'holeless'` / `null`）。 */
function parseGaugePin(src) {
    const m = src.match(/export const TINT_MASK_GAUGE_PIN[^=]*=\s*([^;]+);/);
    if (!m) return null;
    const v = m[1].trim();
    return v === 'null' ? null : v.replace(/^['"]|['"]$/g, '');
}

/**
 * 需求集 = 载体 `MASK_ASSETS` 表里属于该档的条目（`pin = null` ⇒ 两档全要）。
 *
 * 直接从表里筛（⛔ 不在本脚本重造 `mask__<kind>__<gauge>__vN` 的命名式）⇒ 命名/版本改了
 * 也不用同步这里；载体实际就是按 `requiredTintMaskIds()` 去 `id.split('__v')[0]` 查本表，
 * 所以「本表该档的条目」与「宿主真要装的张数」等价。
 */
function requiredIds(pin, table) {
    return Object.keys(table).filter((k) => pin === null || k.endsWith(`__${pin}`));
}

/** 产物里该 uuid 的原图（Cocos 命名 = `<bundle>/native/<前2位>/<uuid>.png|.webp`；子资源 `<uuid>@6c48a.…` 也算命中）。 */
function findNative(imageFiles, uuid) {
    return imageFiles.find((f) => {
        const name = f.slice(f.lastIndexOf('/') + 1);
        return name.startsWith(`${uuid}.`) || name.startsWith(`${uuid}@`);
    });
}

/**
 * 产物里各 bundle 的原图：逐 bundle 扫（`assets/<bundle>/native/<xx>/<uuid>.png|.webp`，不写死 `main`）。
 * `textures` 目录被配置为 Bundle 后，四张就从 `assets/main/native/` 搬进 `assets/textures/native/`，
 * 只查 main 会把「已落地」误报成「没进包」。
 */
function listNativeImages(buildDir) {
    const assets = join(buildDir, 'assets');
    if (!existsSync(assets)) return [];
    const out = [];
    for (const bundleName of readdirSync(assets)) {
        const native = join(assets, bundleName, 'native');
        if (!existsSync(native)) continue;
        for (const shard of readdirSync(native)) {
            const d = join(native, shard);
            if (!existsSync(d)) continue;
            for (const f of readdirSync(d)) if (f.endsWith('.png') || f.endsWith('.webp')) out.push(`${bundleName}/native/${shard}/${f}`);
        }
    }
    return out;
}

// ── 主流程 ──────────────────────────────────────────────────────────────
const carrierPath = join(ROOT, CARRIER);
if (!existsSync(carrierPath)) {
    console.log('构建产物 mask 门禁 — **SKIP**（未找到 blit 载体：' + CARRIER + '）');
    console.log('STATUS: SKIP');
    process.exit(0);
}

const MASK_TABLE = parseMaskTable(readFileSync(carrierPath, 'utf8'));
const pin = PIN_ARGV !== undefined ? (PIN_ARGV === 'null' ? null : PIN_ARGV)
    : parseGaugePin(readFileSync(join(ROOT, TUNING), 'utf8'));
if (Object.keys(MASK_TABLE).length === 0) {
    console.log('构建产物 mask 门禁 — **FAIL**：解析不到 `MASK_ASSETS` 表（载体改写后本门禁需同步）。');
    console.log('STATUS: FAIL');
    process.exit(1);
}

const ids = requiredIds(pin, MASK_TABLE);
console.log(`档位宏 TINT_MASK_GAUGE_PIN = ${pin === null ? 'null（按档位取）' : `'${pin}'`}${PIN_ARGV !== undefined ? '（--pin 覆盖）' : ''} ⇒ 需求集 ${ids.length} 张：${ids.join('、')}`);

// ── 资产漂移腿（`[WXG-T-257]`，⛔ 与产物无关 ⇒ 无产物也要跑）────────────────
// 动因：harness 读定稿正本 `tools/mask-preview/cocos-assets/`，Cocos 读 `cocos/assets/textures/`
// 的手抄件 ⇒ 2026-10-05 实测两张 `*-hole` 已漂（旧档 B 通道恒 255 ⇒ 格外不透明）。
// 两端不同源 = 违 ADR-0030 DEC-3，且上面那腿（只验「在包里」）根本拦不住。
const CANON = 'tools/mask-preview/cocos-assets';
const SHIPPED = 'games/beads/cocos/assets/textures';
let drift = false;
/** 解码后像素 md5（png；2026-10-17 用户裁定：交付格式统一 PNG，小程序不支持 WebP）。 */
const PIXEL_MD5_PY =
    'import sys,hashlib\nfrom PIL import Image\nfor p in sys.argv[1:]:\n    im=Image.open(p).convert("RGBA")\n    print(hashlib.md5(im.tobytes()).hexdigest()[:8])';
/** 字节 md5（同格式同内容时最快路径；不存在 ⇒ null）。 */
function byteMd5(p) {
    return existsSync(p) ? createHash('md5').update(readFileSync(p)).digest('hex').slice(0, 8) : null;
}
function pixelMd5(p) {
    try {
        return execFileSync('python3', ['-c', PIXEL_MD5_PY, p], { encoding: 'utf8' }).trim() || null;
    } catch {
        return null;   // ⛔ 不得返回一个可比较的哨兵字符串：两端都失败时会相等 ⇒ 假绿
    }
}
/** 批量版（N 个文件一次 python 调用；逐件起 python 会慢 10 倍）。任一端取到 null = 不可比较。 */
function pixelMd5Batch(paths) {
    if (paths.length === 0) return new Map();
    try {
        const out = execFileSync('python3', ['-c', PIXEL_MD5_PY, ...paths], { encoding: 'utf8' }).trim().split('\n');
        return new Map(paths.map((p, i) => [p, (out[i] ?? '').trim() || null]));
    } catch {
        return new Map(paths.map((p) => [p, null]));
    }
}
if (existsSync(join(ROOT, CANON))) {
    console.log('\n定稿等值（cocos/assets/textures ≡ tools/mask-preview/cocos-assets，像素级）：');
    for (const f of readdirSync(join(ROOT, CANON)).filter((n) => n.endsWith('tint-128-mask.png')).sort()) {
        const a = join(ROOT, CANON, f);
        const b = join(ROOT, SHIPPED, f);
        const [ha, hb] = [byteMd5(a), byteMd5(b)];
        const [pa, pb] = [pixelMd5(a), pixelMd5(b)];
        const eq = (ha !== null && ha === hb) || (pa !== null && pa === pb); // 字节一致，或字节不同但解码像素一致
        if (eq) console.log(`  ✅ ${f}`);
        else { console.log(`  ❌ ${f} 定稿 ≠ 产物件（${b.slice(ROOT.length + 1)}）⇒ 两端不同源（重跑 tools/mask-preview/export-cocos-textures*.py 后把**PNG** 拷进 ${SHIPPED}）`); drift = true; }
    }
}

// ── 菜单纹理腿（BD-61；⛔ 与产物无关 ⇒ 无产物也要跑）───────────
// 动因：2026-10-18 交付格式收口时发现 `cocos/assets/textures/ui_btn_arrow_bg_pressed.png` 与它的
// 设计正本差 16.39、反而与 normal 正本只差 3.16 ⇒ 上架包里 ◀▶ 按下无盘体下沉反馈；而 harness 读正向
// PNG ⇒ 浏览器全绿（K-110 型双端不一致）。事后定位的根因**不是装错文件**：投放件确实等于
// 「RGBA octree(正本)」，是现役量化配方把 alpha 一起算进色距、256 格被透明组合占满 ⇒ 低幅差的态差先被合并。
// 两条判据（本腿同时看，才能区分两种病）：
//   ① 归属：投放件必须最接近**自己同名同尺寸**的正本（相对比较 ⇒ 免疫量化噪声，⛔ 不需调绝对阈值）；
//   ② 保持率：同族两态在投放件上的互异 / 正本上的互异 ≥ KEEP_MIN（专治「量化把反馈吃掉」）。
const MENU_SRC = 'games/beads/design/art/final/assets/menu';
/** ① 归属余量。实测基线（同尺寸可比集）：正常件 own ≤ 1.65、最近同尺寸他正本 ≥ 5.00。 */
const NEAREST_MARGIN = 2.0;
/** ② 同族两态互异保持率下限（BD-61 实测：旧配方 0.13 ⇒ 红；新配方 0.98 ⇒ 绿）。 */
const KEEP_MIN = 0.5;
/** 真差小于此值时两态本就几乎一样，保持率无判别力 ⇒ 不判。 */
const KEEP_TRUTH_MIN = 2.0;
const NEAREST_PY = [
    'import sys, os',
    'import numpy as np',
    'from PIL import Image',
    'shipped_dir, src_dir = sys.argv[1], sys.argv[2]',
    'def arr(path, ref):',
    '    im = Image.open(path).convert("RGBA")',
    '    if im.size != ref: im = im.resize(ref)',
    '    return np.asarray(im, dtype=np.int16)',
    'def mean(a, b): return float(np.abs(a - b)[..., :3].mean())',
    'def pair(stem, srcs):',
    '    # 同仓两种命名并存：X ↔ X_pressed、X_normal ↔ X_pressed',
    '    if stem.endswith("_pressed"):',
    '        b = stem[:-8]; cands = [b + "_normal.png", b + ".png"]',
    '    elif stem.endswith("_normal"): cands = [stem[:-7] + "_pressed.png"]',
    '    else: cands = [stem + "_pressed.png"]',
    '    return next((c for c in cands if c in srcs), "")',
    'srcs = sorted(f for f in os.listdir(src_dir) if f.endswith(".png"))',
    'size_of = {f: Image.open(os.path.join(src_dir, f)).size for f in srcs}',
    'for s in sorted(os.listdir(shipped_dir)):',
    '    if not s.endswith(".png") or s not in srcs: continue',
    '    sp = os.path.join(shipped_dir, s)',
    '    ref = Image.open(sp).size',
    '    a = arr(sp, ref)',
    '    own = mean(a, arr(os.path.join(src_dir, s), ref))',
    '    # 只与**同尺寸**正本比：跨尺寸靠 resize 拉齐后的差值不是同类比较。',
    '    cands = [o for o in srcs if o != s and size_of[o] == ref]',
    '    best, who = -1.0, "-"',
    '    for o in cands:',
    '        d = mean(a, arr(os.path.join(src_dir, o), ref))',
    '        if best < 0 or d < best: best, who = d, o',
    '    # exact = 在册件是否恰好等于「RGBA octree(正本)」⇒ 区分「量化塌缩」与「装错件」',
    '    ex = mean(np.asarray(Image.open(sp).convert("RGBA"), dtype=np.int16),',
    '             np.asarray(Image.open(os.path.join(src_dir, s)).convert("RGBA").quantize(colors=256, method=Image.FASTOCTREE).convert("RGBA"), dtype=np.int16)) == 0',
    '    print("own", s, round(own, 4), round(best, 4), who, int(ex))',
    '    q = pair(s[:-4], srcs)',
    '    bp = os.path.join(shipped_dir, q)',
    '    if q and os.path.exists(bp):',
    '        t = mean(arr(os.path.join(src_dir, s), ref), arr(os.path.join(src_dir, q), ref))',
    '        k = mean(a, arr(bp, ref))',
    '        print("keep", s, q, round(t, 4), round(k, 4))',
].join('\n');

let menuFail = false, nown = 0, nocomp = 0, nkeep = 0;
const menuSrcDir = join(ROOT, MENU_SRC);
if (existsSync(menuSrcDir)) {
    console.log(`\n菜单纹理（① 归属余量 ≥ ${NEAREST_MARGIN}；② 同族互异保持率 ≥ ${KEEP_MIN}）：`);
    let out = '';
    try {
        out = execFileSync('python3', ['-c', NEAREST_PY, join(ROOT, SHIPPED), menuSrcDir], { encoding: 'utf8' });
    } catch {
        console.log('  ❌ 取不了证（python3 / PIL 调用失败）⇒ 本腿按 FAIL 计，⛔ 静默报绿（K-036）');
        menuFail = true;
    }
    for (const line of out.trim().split('\n').filter(Boolean)) {
        const f = line.split(/\s+/);
        if (f[0] === 'own') {
            const [, name, own, best, other, exact] = f;
            const o = Number(own), b = Number(best);
            nown++;
            if (b < 0) { nocomp++; continue; }   // 无同尺寸正本可混 ⇒ 不参与归属判定
            if (o <= b + NEAREST_MARGIN) continue;
            console.log(`  ❌ ${name} 距自己正本 ${o.toFixed(2)} ＞ 距同尺寸他正本「${other}」${b.toFixed(2)} ⇒ 与正本不同源（${exact === '1' ? '现役 RGBA-octree 配方塌缩' : '疑装错件 / 手改，非配方产物'}）`);
            menuFail = true;
        } else {
            const [, name, pair, truth, kept] = f;
            const t = Number(truth), k = Number(kept);
            if (t < KEEP_TRUTH_MIN) continue;    // 两态本来几乎无差 ⇒ 保持率无判别力
            nkeep++;
            const rate = k / t;
            if (rate >= KEEP_MIN) continue;
            console.log(`  ❌ ${name} 与同族「${pair}」互异保持率 ${rate.toFixed(2)} < ${KEEP_MIN}（正本真差 ${t.toFixed(2)} → 投放件只剩 ${k.toFixed(2)}）⇒ 态差被量化吃掉`);
            menuFail = true;
        }
    }
    console.log(`  （归属 ${nown - nocomp}/${nown} 件参与判定，${nocomp} 件无同尺寸可比对象；互异保持率 ${nkeep} 对）`);
}

const found = BUILD_DIRS.map((d) => join(ROOT, d)).filter(existsSync);
if (found.length === 0) {
    // ⛔ 上面两条腿（定稿等值 / 菜单归属）与产物无关 ⇒ 不得因为「没产物」把它们 SKIP 掉
    //（K-036：缺对象仍报绿 = 假绿）。
    if (drift || menuFail) {
        console.log('\n构建产物 mask 门禁 — **FAIL**（无产物，但资产腿已红：' + [drift && '定稿漂移', menuFail && '菜单纹理与正本不同源/态差被抹平'].filter(Boolean).join(' + ') + '）');
        console.log('STATUS: FAIL');
        process.exit(1);
    }
    console.log('  ⚠ 未找到任何 Cocos 构建产物：' + BUILD_DIRS.join('、'));
    console.log('  结论 = **SKIP**（不是「通过」）。解除条件：`pnpm run build:cocos`（默认 wechatgame）后复跑本脚本。');
    console.log('  说明：本门禁只在有产物时才有意义；干净检出无产物属预期，但 ⛔ 静默报绿（K-036/K-037）。');
    console.log('STATUS: SKIP');
    process.exit(0);
}

let anyFail = false;
/** 菜单纹理「源 ↔ 产物」等值腿（BD-61 收尾腿）：上面两条资产腿只保证 `cocos/assets/textures/` 与正本同源；
 *  源改了但**编辑器未 reimport / 未重建**时，包里仍是旧纹理（= 修一半），只能在此拦住。 */
const BITMAPS = parseBitmapPaths(readFileSync(carrierPath, 'utf8'));
let stale = false;
for (const buildDir of found) {
    const images = listNativeImages(buildDir);
    console.log(`\n产物：${buildDir.slice(ROOT.length + 1)}（native 图 ${images.length} 张）`);
    for (const id of ids) {
        const uuid = MASK_TABLE[id];
        const hit = findNative(images, uuid);
        if (hit) console.log(`  ✅ ${id} → ${uuid}（${hit}）`);
        else {
            console.log(`  ❌ ${id} → ${uuid} **不进包**（构建期无引用 ⇒ 运行期 warmup 凑不齐 ⇒ 静默落回矢量臂）`);
            anyFail = true;
        }
    }
    if (BITMAPS.length === 0) {
        console.log('  ❌ 解析不到 `BITMAP_ASSETS` 菜单条目（载体改写后本腿需同步）⇒ 不报绿（K-036）');
        stale = true;
    } else {
        const pairs = [];
        console.log(`\n菜单纹理 源 ↔ 产物等值（${BITMAPS.length} 件；需求集 = 载体 BITMAP_ASSETS）：`);
        for (const b of BITMAPS) {
            const srcFile = join(ROOT, 'games/beads/cocos/assets', b.bundle, `${b.path}.png`);
            const metaFile = srcFile + '.meta';
            if (!existsSync(srcFile) || !existsSync(metaFile)) {
                console.log(`  ❌ ${b.path}：源件或 .meta 缺失（bundle = ${b.bundle}）`);
                stale = true; continue;
            }
            const uuid = String(JSON.parse(readFileSync(metaFile, 'utf8')).uuid ?? '');
            const hit = findNative(images, uuid);
            if (!hit) {
                console.log(`  ❌ ${b.path}（${uuid}）**不进包** ⇒ 运行期该元素静默走程序化回退`);
                stale = true; continue;
            }
            pairs.push({ name: b.path, src: srcFile, prod: join(buildDir, 'assets', hit) });
        }
        // 字节不同不等于像素不同（Cocos 会重编码）⇒ 字节不等的对再比一次解码像素（一次 python 批量取）。
        const need = pairs.flatMap((p) => (byteMd5(p.src) === byteMd5(p.prod) ? [] : [p.src, p.prod]));
        const px = pixelMd5Batch(need);
        for (const p of pairs) {
            if (byteMd5(p.src) === byteMd5(p.prod)) { console.log(`  ✅ ${p.name}（字节相同）`); continue; }
            const [a, c] = [px.get(p.src), px.get(p.prod)];
            if (a && c && a === c) { console.log(`  ✅ ${p.name}（字节不同但解码像素一致 = 重编码）`); continue; }
            console.log(`  ❌ ${p.name}：产物 ≠ 源（${a ?? '解码失败'} vs ${c ?? '解码失败'}）⇒ 源改过但 **未 reimport / 未重建**，包里仍是旧纹理（BD-61 型半修）`);
            stale = true;
        }
    }
}

if (anyFail || drift || menuFail || stale) {
    console.log('\n构建产物 mask 门禁 — **FAIL**：' + [drift && '定稿资产漂移', menuFail && '菜单纹理不合格', stale && '菜单纹理产物 ≠ 源', anyFail && '需求集有缺张'].filter(Boolean).join(' + ') + '。');
    if (stale) console.log('  出路（产物陈旧）：在 Cocos 编辑器里 reimport 变更的纹理并重新构建（`pnpm run build:cocos`）——源件对了不算修完，包里对才算。');
    if (drift) console.log('  出路（漂移）：把定稿件（PNG）拷进 `games/beads/cocos/assets/textures/`（生成器 = `tools/mask-preview/export-cocos-textures*.py`），再重建。');
    if (menuFail) console.log('  出路（菜单纹理）：`python3 games/beads/design/ai-workflows/quantize-cocos-textures.py <件名.png>` 从正本重出（RGB 量化 + 原 α），再经**编辑器 reimport**（`.meta` 不伪造，L1）。');
    console.log('  出路（缺张）：把 `assets/textures` 在编辑器里配置为 Bundle（项目设置 → Bundle 配置），重新构建。');
    console.log('        压缩类型 ⛔ 不要选「小游戏分包」（那是微信侧分包），本诉求 = 合并进主包；或给缺的那几张补一条构建期引用（见 ADR-0030 §5.5）。');
    console.log('  临时接线：把 `TINT_MASK_GAUGE_PIN` 钉到已进包的那一档（⛔ 别长期留着）。');
    console.log('STATUS: FAIL');
    process.exit(1);
}
console.log('\n构建产物 mask 门禁 — **OK**（需求集齐张，载体 warmup 可注入；菜单纹理资产腿与产物等值全绿）。');
console.log('STATUS: OK');
