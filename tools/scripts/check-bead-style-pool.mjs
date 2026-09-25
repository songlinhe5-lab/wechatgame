#!/usr/bin/env node
/**
 * check-bead-style-pool.mjs — 风格池门禁（WXG-T-211-B1 / EP11-S2 · §12.2 C7/C11/C12 · ADR-0023 §7）
 * ─────────────────────────────────────────────────────────────────────────────
 * 遍历 `games/beads/src/view/bead-styles/registry.ts` 的**全部已注册风格**，逐套：
 *   A. **双指标计数**（C7，口径 = assets-spec 附 `styles.mjs::probe()` 同源）：
 *      命令数 = 珠体层集全量长度（底图 B0 不在风格层集内 = 「另计」由构造成立；
 *      凹槽不注册进风格模块 = 「另列」）；真 α = `alpha ?? 1 < 1`（本契约下
 *      fill 恒为 palette 派生 hex，probe 的 `rgba` 析取支结构性不可命中）。
 *      上限 = `tuning.ts::BEAD_STYLE_MAX_COMMANDS / BEAD_STYLE_MAX_ALPHA_LAYERS`。
 *   B. **C12 主体色不变式（弱读法，用户 2026-09-26 裁定・八批已钉进 §12.2 正本）**：
 *      主体色 = 珠面 pixel 数占比最大的端点色；统计域 = `role:'facet'` 图元的
 *      **可见像素**（painter 顶面胜出 ⇒ 底衬 `plate` 与 `hole` 天然不入统计，
 *      与正本「排除底衬/描边 rect 与孔」同义）；断言 = 占比最大端点色 ∈ 本格
 *      base 同族四端点集（⛔ 禁锚色派生 / 他格色；⛔ 禁面积阈值化；⛔ 不预设
 *      主体 kind）。占比用**确定性网格采样**数 pixel（字面实现「pixel 数占比」，
 *      不解析圆-三角相交）。
 * 输出纪律（C11「禁止两种静默」）：
 *   · 触门 ⇒ 打全**五项**数值（①实测命令 ②实测真α ③两项上限 ④超哪项多少
 *     ⑤与基线四棱 6/0 差值）+ `STATUS: FAIL` + exit 1「停在待确认态」——
 *     ⛔ 不改上限、不跳过；
 *   · 零注册 ⇒ `STATUS: SKIP`（verify 汇总如实单列 SKIP ≠ 测，K-036）；
 *   · 全过 ⇒ `STATUS: OK` + 逐风格数值表。⛔ 两种情形都不许只报退出码。
 *
 * 用法：
 *   pnpm run check:bead-style-pool            # 遍历真实 registry（verify 常门）
 *   node tools/scripts/check-bead-style-pool.mjs --fixtures   # 注入两反例臂（TC-STY-08 夹具腿）
 *
 * ⚠ C12 tie 如实登记：facet-4 四枚刻面几何等面积（E 单 §7.2 亦自书「等面积 ⇒ 无
 * 最大者可指认」）⇒ 端点色 lit/base/edge 三者**并列最大**（各 ≈25%，右刻面
 * `mix(base,−0.16)` 非端点色不入候选）。判定对象按正本 = 「占比最大端点色 ∈
 * base 同族」⇒ tie 全员族内 ⇒ 四棱过；本脚本以严格最大值 + 绘制序 scan 实现
 * tiebreak（结果确定、可复现），并恒输出完整占比表。⛔ 不在实现侧消解「用户
 * 纸面语句（base 左刻面占比最大）与实测等面积」的差异——数值全部摆在台面上。
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** 动态 import 游戏侧 TS 真源（Node ≥22.18 原生 type-stripping；`.js`→`.ts` 由 --import 钩子接管）。
 *  路径一律走 `import.meta.resolve`（本脚本所在目录解析，⛔ 不依赖 cwd，也不依赖
 *  vite-node 对绝对 file: URL 的动态 import——两种宿主都只剩静态 specifier 解析）。 */
async function loadSources() {
    const [registry, tuning, palette, contract] = await Promise.all([
        import.meta.resolve('../../games/beads/src/view/bead-styles/registry.ts'),
        import.meta.resolve('../../games/beads/src/config/tuning.ts'),
        import.meta.resolve('../../games/beads/src/view/palette.ts'),
        import.meta.resolve('../../games/beads/src/view/bead-styles/contract.ts'),
    ]).then((urls) => Promise.all(urls.map((u) => import(u))));
    return { registry, tuning, palette, contract };
}

/* ────────────────────────── 几何/采样（纯函数，测试可直接 import） ────────────────────────── */

/** 网格采样点数（每边；确定性常量，⛔ 禁随机采样）。 */
export const SAMPLE_GRID = 121;

const EPS = 1e-9;

/** rect 含点（圆角忽略：唯一可能为 rect 的 `plate` 永远在最底层，不吃任何可见像素）。 */
function inRect(layer, x, y) {
    return x >= layer.x - EPS && x <= layer.x + layer.w + EPS && y >= layer.y - EPS && y <= layer.y + layer.h + EPS;
}

/** 圆含点。 */
function inCircle(layer, x, y) {
    const dx = x - layer.cx;
    const dy = y - layer.cy;
    return dx * dx + dy * dy <= layer.r * layer.r + EPS;
}

/** 三角形含点（边函数同号法；points = 6 元扁平数组）。 */
function inTriangle(layer, x, y) {
    const [ax, ay, bx, by, cx, cy] = layer.points;
    const s = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
    const d1 = s(x, y, ax, ay, bx, by);
    const d2 = s(x, y, bx, by, cx, cy);
    const d3 = s(x, y, cx, cy, ax, ay);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
}

/** painter 顶面胜出：返回覆盖 (x,y) 的最上层（数组序从后往前扫），平局取先画者。 */
function topLayerAt(layers, x, y) {
    for (let i = layers.length - 1; i >= 0; i--) {
        if (layerContains(layers[i], x, y)) return layers[i];
    }
    return null;
}

/** 单层含点判定（按 kind 分派）。 */
function layerContains(layer, x, y) {
    if (layer.kind === 'rect') return inRect(layer, x, y);
    if (layer.kind === 'circle') return inCircle(layer, x, y);
    return inTriangle(layer, x, y);
}

/** facet 族成员重叠像素数（统计域自洽性哨兵：facet 间重叠会使「占比」语义失真 ⇒ 报数值不猜）。 */
function facetOverlapPixels(layers, size, grid = SAMPLE_GRID) {
    const facets = [];
    for (let i = 0; i < layers.length; i++) if (layers[i].role === 'facet') facets.push(layers[i]);
    if (facets.length < 2) return 0;
    let overlap = 0;
    const step = size / grid;
    for (let gy = 0; gy < grid; gy++) {
        const y = -size / 2 + (gy + 0.5) * step;
        for (let gx = 0; gx < grid; gx++) {
            const x = -size / 2 + (gx + 0.5) * step;
            let hits = 0;
            for (const f of facets) {
                if (layerContains(f, x, y)) hits++;
                if (hits > 1) break;
            }
            if (hits > 1) overlap++;
        }
    }
    return overlap;
}

/* ────────────────────────── C12 主体色认定 ────────────────────────── */

/**
 * 弱读法认定：珠面族（facet 可见像素）中占比最大的**端点色**。
 * 候选集 = 全池端点色（`candidateEndpoints`，缺省回退本族 family）：他格 base 也是端点色，
 * 必须参赛才能在赢过本族色时被指认为越界（⛔ 若候选只认本族，「不得他格色」永不触发）；
 * 非任何格端点色（锚色派生/mix 中间档）不参赛但进 offenders 暴露。
 * 返回 { counts 全像素表, argmaxColor, argmaxShare, tie 并列者, offenders }。
 * ⛔ 无面积阈值；⛔ 返回值由像素实算驱动（臂 B 的判别力来源）。
 */
export function identifyPrimary(layers, family, size, candidateEndpoints) {
    const grid = SAMPLE_GRID;
    const step = size / grid;
    const counts = new Map(); // fill -> 可见 pixel 数（只计 facet 顶面）
    let facetPixels = 0;
    for (let gy = 0; gy < grid; gy++) {
        const y = -size / 2 + (gy + 0.5) * step;
        for (let gx = 0; gx < grid; gx++) {
            const x = -size / 2 + (gx + 0.5) * step;
            const top = topLayerAt(layers, x, y);
            if (top && top.role === 'facet') {
                facetPixels++;
                counts.set(top.fill, (counts.get(top.fill) ?? 0) + 1);
            }
        }
    }
    // 端点色候选排名（候选 = 全池端点色）：非候选色不进 argmax，但全部暴露给越界判定。
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const endpoints = new Set(family);
    const candidates = candidateEndpoints ?? endpoints;
    let argmaxColor = null;
    let argmaxCount = -1;
    for (const [color, n] of ranked) {
        if (!candidates.has(color)) continue;
        if (n > argmaxCount) {
            argmaxColor = color;
            argmaxCount = n;
        }
    }
    const tie = argmaxCount > 0 ? ranked.filter(([c, n]) => candidates.has(c) && n === argmaxCount).map(([c]) => c) : [];
    const offenders = ranked.filter(([c, n]) => !candidates.has(c) && n > argmaxCount).map(([c, n]) => ({ color: c, pixels: n }));
    return {
        grid,
        facetPixels,
        counts: ranked.map(([color, n]) => ({
            color,
            pixels: n,
            share: facetPixels ? n / facetPixels : 0,
            inFamily: endpoints.has(color),
        })),
        argmaxColor,
        argmaxShare: facetPixels ? Math.max(0, argmaxCount) / facetPixels : 0,
        tie,
        offenders,
        totalSamples: grid * grid,
    };
}

/** argmax 色的像素数（从占比表回查；供臂 A 指认行报数）。 */
function argmaxPixelsOf(res) {
    return res.counts.find((c) => c.color === res.argmaxColor)?.pixels ?? 0;
}

/* ────────────────────────── 逐风格审计（C7 双指标 + C12） ────────────────────────── */

/**
 * 审计一个风格：返回 { id, commands, alpha, c12: Map<colorIdx, result>, violations[] }。
 * violation 文案自带 C11 五项，调用方只管打印。
 */
export function auditStyle(style, { inks, tuning, palette, contract, baseline }) {
    const violations = [];
    const layers = style.beadLayers({ inks, colorIdx: 1, size: tuning.BEAD_CELL });
    const commands = layers.length; // probe() 同源：珠体层集全量（B0 另计 / 凹槽另列，见文件头）
    const alpha = layers.filter(contract.isRealAlphaLayer).length;

    const overCmd = commands - tuning.BEAD_STYLE_MAX_COMMANDS;
    const overAlpha = alpha - tuning.BEAD_STYLE_MAX_ALPHA_LAYERS;
    if (overCmd > 0 || overAlpha > 0) {
        violations.push(c11Five(style.id, commands, alpha, tuning, baseline, overCmd, overAlpha));
    }

    // C12：逐色跑（颜色维度与几何维度正交，全色过才算过）。候选集 = 全池四端点并集。
    const allEndpoints = new Set(inks.endpoints.flatMap((e) => [e.base, e.lit, e.edge, e.pit]));
    const c12 = new Map();
    for (let ci = 1; ci <= inks.hexes.length; ci++) {
        const ls = style.beadLayers({ inks, colorIdx: ci, size: tuning.BEAD_CELL });
        const family = contract.endpointFamily(inks, ci);
        const res = identifyPrimary(ls, family, tuning.BEAD_CELL, allEndpoints);
        c12.set(ci, res);
        const base = palette.beadColorOf(inks, ci);
        if (res.facetPixels === 0) {
            violations.push(
                `C12 [${style.id}] colorIdx=${ci}：珠面族统计域零像素（无 role:'facet' 可见层？）⇒ 主体色不可认定，判违规（⛔ 不得静默放行）。`,
            );
        } else if (res.argmaxColor !== base && !family.includes(res.argmaxColor)) {
            // 任务单已裁口径：断言 = 占比最大端点色 ∈ base 同族（beadColorOf + lit/edge/pit）；
            // 族内非 base（facet-4 实测情形：argmax=edge 25.2% > base 24.8%）不入违规——
            // 占比分布表全量输出 + 近并列注记恒打台面，在回传报告里如实登记，⛔ 不在实现侧消解。
            // TC-STY-10 臂 A：须指认越界色**与它所属 colorIdx**（不给数值/归属 = 静默失败，C11 禁止项）。
            // 指认对象 = argmax 本身（它已是端点色但属他格）；若无 argmax（珠面全为锚色派生）则指 offenders。
            const flagged =
                res.argmaxColor && !family.includes(res.argmaxColor)
                    ? [{ color: res.argmaxColor, pixels: argmaxPixelsOf(res) }]
                    : res.offenders;
            const ownership = flagged
                .map((o) => {
                    const pct = res.facetPixels ? ((o.pixels / res.facetPixels) * 100).toFixed(1) : '0.0';
                    for (let k = 1; k <= inks.hexes.length; k++) {
                        if (palette.beadColorOf(inks, k) === o.color)
                            return `${o.color} = colorIdx=${k} 的 base（他格珠色），占珠面 ${pct}%`;
                        const ep = inks.endpoints[k - 1];
                        if ([ep.lit, ep.edge, ep.pit].includes(o.color))
                            return `${o.color} = colorIdx=${k} 的端点派生，占珠面 ${pct}%`;
                    }
                    return `${o.color} = 非任何格端点色（锚色派生类，C3 同样违规），占珠面 ${pct}%`;
                })
                .join(' / ');
            violations.push(
                `C12 [${style.id}] colorIdx=${ci}：占比最大端点色 = ${res.argmaxColor ?? '无（珠面内无端点色参赛）'} ∉ 本格 base 同族 {${family.join(', ')}}` +
                ` ⇒ 指认越界色 = ${ownership || `${res.argmaxColor}（见占比表）`}；` +
                `本格 base = ${base}。C12 判红（反例 = 主体色被换为锚色派生/他格色）。`,
            );
        }
    }
    // 几何与颜色无关（beadLayers 只有 fill 随 ci 变）⇒ 重叠哨兵只算 colorIdx=1 一次。
    // ⚠ 共边/共点像素会被相邻 facet 双计（facet-4 **实测 151px** ≈ 共边线长 × 网格密度），
    //   属边界带噪声非面积重叠 ⇒ 只报数不判红；**面积级**重叠（> 统计域 10%）才追加违规。
    const overlaps = [];
    {
        const ls = style.beadLayers({ inks, colorIdx: 1, size: tuning.BEAD_CELL });
        const ov = facetOverlapPixels(ls, tuning.BEAD_CELL);
        if (ov > 0) overlaps.push({ colorIdx: 1, pixels: ov });
        if (ov > 0.1 * (SAMPLE_GRID * SAMPLE_GRID)) {
            violations.push(
                `C12 [${style.id}]：facet 族面积级重叠 ${ov}px（> 全盘 10%）⇒ 统计域自洽性破坏，占比语义失真，报数值不猜，停。`,
            );
        }
    }
    return { id: style.id, commands, alpha, c12, overlaps, violations, layers };
}

/** C11 五项诊断（①②③④⑤ 一条都不许少；两种静默都违 C11）。 */
function c11Five(id, commands, alpha, tuning, baseline, overCmd, overAlpha) {
    const exceed = [];
    if (overCmd > 0) exceed.push(`命令数超 ${overCmd}（${commands} > ${tuning.BEAD_STYLE_MAX_COMMANDS}）`);
    if (overAlpha > 0) exceed.push(`真 α 层超 ${overAlpha}（${alpha} > ${tuning.BEAD_STYLE_MAX_ALPHA_LAYERS}）`);
    return [
        `C11 触门 [${id}] —— 停在待确认态（⛔ 不得调上限、不得跳过；等用户拍板「此拦截是否符合预期」）：`,
        `  ① 实测命令数 = ${commands}`,
        `  ② 实测真 α 层数 = ${alpha}`,
        `  ③ 两项上限 = 命令 ≤ ${tuning.BEAD_STYLE_MAX_COMMANDS} / 真 α ≤ ${tuning.BEAD_STYLE_MAX_ALPHA_LAYERS}（tuning.ts C7 常量）`,
        `  ④ 超出 = ${exceed.join('；')}`,
        `  ⑤ 与基线四棱 ${baseline.commands}/${baseline.alpha} 差值 = 命令 ${commands - baseline.commands >= 0 ? '+' : ''}${commands - baseline.commands} / 真 α ${alpha - baseline.alpha >= 0 ? '+' : ''}${alpha - baseline.alpha}（基线来源：${baseline.source}）`,
    ].join('\n');
}

/* ────────────────────────── 反例夹具（TC-STY-08；⛔ 不进 registry） ────────────────────────── */

/** 造一层：8 命令 / 0 α 的假风格（触命令门）。 */
export function fixtureEightCommandsZeroAlpha() {
    const layers = [];
    for (let i = 0; i < 7; i++) {
        layers.push({ kind: 'polygon', role: 'facet', points: [-9 + i, -11, 11 - i, 11, 0, 0], fill: '#00FF00' });
    }
    layers.push({ kind: 'circle', role: 'hole', cx: 0, cy: 0, r: 4, fill: '#0000FF' });
    return { id: 'fixture-8cmd-0alpha', beadLayers: () => Object.freeze(layers) };
}

/**
 * 造一层：5 命令 / 3 真 α 的假风格（触 α 门）。⚠ 三支真 α **故意分跟计数式的两个析取支**：
 * 两面显式 `alpha`（第一支）+ 一枚 `plate` rect 只写 `rgba(...)` fill 不带 `alpha`（第二支
 * = spike / `styles.mjs` 写法）⇒ 若实现漏第二支，实测 α = 2 不触门 ⇒ TC-STY-08 臂 2 必红
 * ⇒ 本臂就是「计数式与正本 `probe()` 同式」的可验凭证（⛔ 不得只靠注释免责）。
 */
export function fixtureFiveCommandsThreeAlpha() {
    return {
        id: 'fixture-5cmd-3alpha',
        beadLayers: ({ inks, colorIdx }) => {
            const e = inks.endpoints[colorIdx - 1];
            return Object.freeze([
                { kind: 'rect', role: 'plate', x: -14.5, y: -14.5, w: 29, h: 29, fill: 'rgba(0, 0, 0, 0.35)', radius: 9 },
                { kind: 'polygon', role: 'facet', points: [-11, 11, 11, 11, 0, 0], fill: e.lit, alpha: 0.5 },
                { kind: 'polygon', role: 'facet', points: [-11, -11, -11, 11, 0, 0], fill: e.base, alpha: 0.4 },
                { kind: 'polygon', role: 'facet', points: [11, 11, 11, -11, 0, 0], fill: e.edge },
                { kind: 'circle', role: 'hole', cx: 0, cy: 0, r: 4, fill: e.pit },
            ]);
        },
    };
}

/** C12 越界臂（TC-STY-10 臂 A）：珠面族主体色 = **他格 base**（非本格端点色）。 */
export function fixtureForeignBaseFacets() {
    return {
        id: 'fixture-c12-foreign-base',
        beadLayers: ({ inks, size }) => {
            const h = size / 2;
            const l = -h + size * 0.09;
            const r = h - size * 0.09;
            const other = inks.hexes[1]; // colorIdx=2 的 base —— 对 colorIdx=1 而言是他格色
            return Object.freeze([
                { kind: 'rect', role: 'plate', x: -h, y: -h, w: size, h: size, fill: inks.hexes[0], radius: 9 },
                { kind: 'polygon', role: 'facet', points: [l, r, r, r, 0, 0], fill: other },
                { kind: 'polygon', role: 'facet', points: [l, l, l, r, 0, 0], fill: other },
                { kind: 'polygon', role: 'facet', points: [r, r, r, l, 0, 0], fill: other },
                { kind: 'polygon', role: 'facet', points: [r, l, l, l, 0, 0], fill: other },
                { kind: 'circle', role: 'hole', cx: 0, cy: 0, r: size * 0.17, fill: other },
            ]);
        },
    };
}

/* ────────────────────────── CLI ────────────────────────── */

/**
 * 臂 B 探针（TC-STY-10 臂 B「防恒返 base 自证」的实装侧，QA 腿在
 * `games/beads/tests/bead-style-pool.test.ts`）：对 registry 首风格实算 argmax，
 * 再把**夺得 argmax 的那一层**朝格心缩半重数像素 ⇒ 若认定函数由像素驱动，
 * 榜首必变；若函数恒返某色（如写死 base），两次输出必相同 ⇒ 测试判红。
 * 实现住在真源侧，测试只 spawn + 比 JSON（⛔ 不在测试内重采样，K-042）。
 */
async function probeArgmax() {
    const { registry, tuning, palette, contract } = await loadSources();
    const inks = palette.DEMO_BEAD_INKS;
    const style = registry.registeredStyles()[0];
    if (!style) {
        console.log('PROBE-STATUS: SKIP');
        return 1;
    }
    const size = tuning.BEAD_CELL;
    const family = contract.endpointFamily(inks, 1);
    const allEndpoints = new Set(inks.endpoints.flatMap((e) => [e.base, e.lit, e.edge, e.pit]));
    const layers = style.beadLayers({ inks, colorIdx: 1, size });
    const before = identifyPrimary(layers, family, size, allEndpoints);
    if (!before.argmaxColor) {
        console.log('PROBE-STATUS: FAIL');
        console.log('无端点色 argmax，臂 B 无法缩占优层。');
        return 1;
    }
    const shrunk = layers.map((l) => {
        if (l.role !== 'facet' || l.fill !== before.argmaxColor || l.kind !== 'polygon') return l;
        // 三角形三顶点朝格心 (0,0) 缩半 = 面积 ×1/4（确定性几何变形，只改这一层）。
        const p = l.points.map((v) => v / 2);
        return { ...l, points: p };
    });
    const after = identifyPrimary(shrunk, family, size, allEndpoints);
    console.log(
        JSON.stringify({
            probe: { argmaxBefore: before.argmaxColor, argmaxAfter: after.argmaxColor, shareBefore: before.argmaxShare, shareAfter: after.argmaxShare, facetPxBefore: before.facetPixels, facetPxAfter: after.facetPixels },
        }),
    );
    console.log('PROBE-STATUS: OK');
    return 0;
}

async function main(argv) {
    const { registry, tuning, palette, contract } = await loadSources();
    const inks = palette.DEMO_BEAD_INKS;
    const sizes = { BEAD_CELL: tuning.BEAD_CELL, MAX_COMMANDS: tuning.BEAD_STYLE_MAX_COMMANDS, MAX_ALPHA: tuning.BEAD_STYLE_MAX_ALPHA_LAYERS };

    const registered = registry.registeredStyles();
    const useFixtures = argv.includes('--fixtures');
    // TC-STY-08 两触门臂（只超命令 / 只超 α，单臂无法证明④的判别力）+ TC-STY-10 臂 A（C12 他格色）；
    // ⛔ 反例夹具永不进 registry（epics S2 字面），仅本模式临时注入。
    const styles = useFixtures
        ? [...registered, fixtureEightCommandsZeroAlpha(), fixtureFiveCommandsThreeAlpha(), fixtureForeignBaseFacets()]
        : [...registered];

    console.log(
        `[bead-style-pool] registry=${JSON.stringify(registry.registeredStyleIds())}` +
        ` 上限=命令≤${sizes.MAX_COMMANDS}/真α≤${sizes.MAX_ALPHA}（tuning C7） 模式=${useFixtures ? '--fixtures 反例臂注入' : '常门'}`,
    );

    // 基线四棱 6/0：优先 registry 实算（facet-4 在场），缺席 ⇒ 用 §12.6 纸面值并如实标注来源。
    const facet4 = registered.find((s) => s.id === 'facet-4');
    const baseline = facet4
        ? (() => {
            const ls = facet4.beadLayers({ inks, colorIdx: 1, size: tuning.BEAD_CELL });
            return { commands: ls.length, alpha: ls.filter(contract.isRealAlphaLayer).length, source: 'registry facet-4 实算' };
        })()
        : { commands: 6, alpha: 0, source: '§12.6 纸面值（facet-4 未注册）' };

    if (styles.length === 0) {
        console.log('registry 零注册风格 ⇒ 无审计对象。');
        console.log('STATUS: SKIP');
        return 0;
    }

    const allViolations = [];
    for (const style of styles) {
        const a = auditStyle(style, { inks, tuning, palette, contract, baseline });
        // 数值表恒打（两种静默都违 C11）：逐色占比摘要（argmax + facet 像素数 + 全量分布表）。
        // 分布表把「非端点色不参赛」（如四棱右刻面的表外 mix 系数层）显式标出，⛔ 不静默丢数据。
        const c12Summary = [...a.c12.entries()]
            .map(([ci, res]) => {
                const dist = res.counts
                    .map((c) => `${c.color}:${(c.share * 100).toFixed(1)}%${c.inFamily ? '' : '(非端点不参赛)'}`)
                    .join('|');
                return (
                    `  colorIdx=${ci} argmax=${res.argmaxColor ?? 'null'}(${(res.argmaxShare * 100).toFixed(1)}%)` +
                    `${res.tie.length > 1 ? ` tie=[${res.tie.join(',')}]` : ''}` +
                    ` facetPx=${res.facetPixels}/${res.totalSamples} 分布=${dist}`
                );
            })
            .join('\n');
        // 近并列台面上纸（任务单：“算出非 base ⇒ 停手回报数值，不自行消解”）：
        // 弱读断言（∈ 同族）过，但“base 占比最大”的纸面预期与实测不符 ⇒ 注记恒打，不藏。
        const near = [...a.c12.entries()].filter(([ci, res]) => {
            const base = palette.beadColorOf(inks, ci);
            return res.facetPixels > 0 && res.argmaxColor && res.argmaxColor !== base && contract.endpointFamily(inks, ci).includes(res.argmaxColor);
        });
        const nearNote =
            near.length === 0
                ? ''
                : (() => {
                    const shareOfBase = (r, idx) => r.counts.find((c) => c.color === palette.beadColorOf(inks, idx))?.share ?? 0;
                    const [ci, res] = near[0];
                    const base = palette.beadColorOf(inks, ci);
                    const spread = Math.max(...near.map(([k, r]) => r.argmaxShare - shareOfBase(r, k)));
                    return (
                        `\n  ⚠ C12 近并列登记 [${a.id}]：${near.length}/${a.c12.size} 色的占比最大端点色 ∈ base 同族但非 base` +
                        `（例 ci=${ci} argmax=${res.argmaxColor} ${(res.argmaxShare * 100).toFixed(1)}% vs base ${base} ${(shareOfBase(res, ci) * 100).toFixed(1)}%；` +
                        `最大偏离 ${(spread * 100).toFixed(1)}pp）` +
                        ` ⇒ 按已裁弱读法（断言对象 = ∈ 同族）判过，⛔ 不滑回强读法判红；` +
                        `纸面预期（base 占优）与实测差异已回传主理人，实现侧不消解。`
                    );
                })();
        console.log(`[${a.id}] 命令=${a.commands} 真α=${a.alpha} facet重叠px=${a.overlaps.reduce((s, o) => s + o.pixels, 0)}\n${c12Summary}${nearNote}`);
        allViolations.push(...a.violations);
    }

    if (allViolations.length > 0) {
        console.log('');
        for (const v of allViolations) console.log(v);
        console.log(`\n共 ${allViolations.length} 条违规 ⇒ 停在待确认态（C11）。修正 = 换造型/删层需用户拍板；⛔ 本脚本永不代劳。`);
        console.log('STATUS: FAIL');
        return 1;
    }
    console.log(`✅ ${styles.length} 个已注册风格全部过双指标与 C12 弱读断言。`);
    console.log('STATUS: OK');
    return 0;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
    const code = process.argv.includes('--probe-argmax') ? await probeArgmax() : await main(process.argv.slice(2));
    process.exit(code);
}
