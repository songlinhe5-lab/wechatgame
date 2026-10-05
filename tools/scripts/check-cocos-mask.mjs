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
// 检什么：载体 `MASK_ASSETS` 表里**该档实际要的那几张**（现役 = `TINT_MASK_GAUGE_PIN` 钉住 `holed` ⇒ 2 张），
// 逐张在产物 `assets/<bundle>/native/<uuid 前 2 位>/<uuid>.png` 里核在不在（`textures` 配成 Bundle 后
// 就从 `main/` 搬到 `textures/` ⇒ ⛔ 不能只扫 main）。需求集与两个宿主同源，⛔ 不在本脚本再抄一遍 uuid 表。
//
// 机读标记 `STATUS: OK|SKIP|FAIL`（供 `verify-all.mjs` 聚合；K-036：SKIP ≠ 测）。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

/** 产物里该 uuid 的原图（Cocos 命名 = `<bundle>/native/<前2位>/<uuid>.png`；子资源 `<uuid>@6c48a.png` 也算命中）。 */
function findNative(pngFiles, uuid) {
    return pngFiles.find((f) => {
        const name = f.slice(f.lastIndexOf('/') + 1);
        return name.startsWith(`${uuid}.png`) || name.startsWith(`${uuid}@`);
    });
}

/**
 * 产物里各 bundle 的原图：逐 bundle 扫（`assets/<bundle>/native/<xx>/<uuid>.png`，不写死 `main`）。
 * `textures` 目录被配置为 Bundle 后，四张就从 `assets/main/native/` 搬进 `assets/textures/native/`，
 * 只查 main 会把「已落地」误报成「没进包」。
 */
function listNativePngs(buildDir) {
    const assets = join(buildDir, 'assets');
    if (!existsSync(assets)) return [];
    const out = [];
    for (const bundleName of readdirSync(assets)) {
        const native = join(assets, bundleName, 'native');
        if (!existsSync(native)) continue;
        for (const shard of readdirSync(native)) {
            const d = join(native, shard);
            if (!existsSync(d)) continue;
            for (const f of readdirSync(d)) if (f.endsWith('.png')) out.push(`${bundleName}/${shard}/${f}`);
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
if (existsSync(join(ROOT, CANON))) {
    console.log('\n定稿等值（cocos/assets/textures ≡ tools/mask-preview/cocos-assets）：');
    for (const f of readdirSync(join(ROOT, CANON)).filter((n) => n.endsWith('tint-128-mask.png')).sort()) {
        const a = join(ROOT, CANON, f), b = join(ROOT, SHIPPED, f);
        const md5 = (p) => (existsSync(p) ? createHash('md5').update(readFileSync(p)).digest('hex').slice(0, 8) : '缺失');
        const [ca, cb] = [md5(a), md5(b)];
        if (ca === cb) console.log(`  ✅ ${f}（${ca}）`);
        else { console.log(`  ❌ ${f} 定稿 ${ca} ≠ 产物件 ${cb} ⇒ 两端不同源（重跑 tools/mask-preview/export-cocos-textures*.py 后拷进 ${SHIPPED}）`); drift = true; }
    }
}

const found = BUILD_DIRS.map((d) => join(ROOT, d)).filter(existsSync);
if (found.length === 0) {
    console.log('  ⚠ 未找到任何 Cocos 构建产物：' + BUILD_DIRS.join('、'));
    console.log('  结论 = **SKIP**（不是「通过」）。解除条件：`pnpm run build:cocos`（默认 wechatgame）后复跑本脚本。');
    console.log('  说明：本门禁只在有产物时才有意义；干净检出无产物属预期，但 ⛔ 静默报绿（K-036/K-037）。');
    console.log('STATUS: SKIP');
    process.exit(0);
}

let anyFail = false;
for (const buildDir of found) {
    const pngs = listNativePngs(buildDir);
    console.log(`\n产物：${buildDir.slice(ROOT.length + 1)}（native png ${pngs.length} 张）`);
    for (const id of ids) {
        const uuid = MASK_TABLE[id];
        const hit = findNative(pngs, uuid);
        if (hit) console.log(`  ✅ ${id} → ${uuid}（${hit}）`);
        else {
            console.log(`  ❌ ${id} → ${uuid} **不进包**（构建期无引用 ⇒ 运行期 warmup 凑不齐 ⇒ 静默落回矢量臂）`);
            anyFail = true;
        }
    }
}

if (anyFail || drift) {
    console.log('\n构建产物 mask 门禁 — **FAIL**：' + (drift ? '定稿资产漂移。' : '') + (anyFail && drift ? ' + ' : '') + (anyFail ? '需求集有缺张。' : ''));
    if (drift) console.log('  出路（漂移）：把定稿件拷进 `games/beads/cocos/assets/textures/`（生成器 = `tools/mask-preview/export-cocos-textures*.py`），再重建。');
    console.log('  出路（缺张）：把 `assets/textures` 在编辑器里配置为 Bundle（项目设置 → Bundle 配置），重新构建。');
    console.log('        压缩类型 ⛔ 不要选「小游戏分包」（那是微信侧分包），本诉求 = 合并进主包；或给缺的那几张补一条构建期引用（见 ADR-0030 §5.5）。');
    console.log('  临时接线：把 `TINT_MASK_GAUGE_PIN` 钉到已进包的那一档（⛔ 别长期留着）。');
    console.log('STATUS: FAIL');
    process.exit(1);
}
console.log('\n构建产物 mask 门禁 — **OK**（需求集齐张，载体 warmup 可注入）。');
console.log('STATUS: OK');
