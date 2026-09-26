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

/**
 * **逐 facet 层的顶面覆盖实算**（WXG-T-211-S4 / 步 4 新增，本函数的输出 = 重叠判据改写后的
 * 主担者）：一趟网格采样同时得
 *  - `overlap`：同时被 ≥2 枚 facet 层包含的样本数（几何事实，语义见下方政策注）；
 *  - `perFacet[]`：每枚 facet 层的 `{ index, fill, topPixels, coveredPixels }` ——
 *    `topPixels` = 该层作为**顶面胜出者**的样本数（= 它真正画得出来的面积），
 *    `coveredPixels` = 它被包含却上有更高层的样本数。
 * ⚠ 与 `identifyPrimary` 共用 `topLayerAt` ⇒ 两套读数同一顶面口径（⛔ 另起一套采样 = K-042）。
 */
export function facetCoverage(layers, size, grid = SAMPLE_GRID) {
    const idx = [];
    for (let i = 0; i < layers.length; i++) if (layers[i].role === 'facet') idx.push(i);
    const stats = new Map(idx.map((i) => [i, { index: i, fill: layers[i].fill, topPixels: 0, coveredPixels: 0 }]));
    let overlap = 0;
    if (idx.length === 0) return { overlap, perFacet: [] };
    const step = size / grid;
    for (let gy = 0; gy < grid; gy++) {
        const y = -size / 2 + (gy + 0.5) * step;
        for (let gx = 0; gx < grid; gx++) {
            const x = -size / 2 + (gx + 0.5) * step;
            const hits = []; // facet 层命中集，自顶向下序
            for (let i = layers.length - 1; i >= 0; i--) if (stats.has(i) && layerContains(layers[i], x, y)) hits.push(i);
            if (hits.length > 1) overlap++;
            if (hits.length === 0) continue;
            const top = topLayerAt(layers, x, y);
            const visible = top !== null && top.role === 'facet';
            stats.get(hits[0])[visible ? 'topPixels' : 'coveredPixels']++;
            for (let k = 1; k < hits.length; k++) stats.get(hits[k]).coveredPixels++;
        }
    }
    return { overlap, perFacet: idx.map((i) => stats.get(i)) };
}

/**
 * **facet 族重叠：从「泛阈值判红」改为「逐风格钉值 + 死层硬门」**（WXG-T-211-S4 / 步 4）
 * ────────────────────────────────────────────────────────────────
 * 旧门的推论链只有一环站得住：「facet 间重叠 ⇒ 占比语义失真」。但主体色认定（C12 弱读法）
 * 自 S3 就走 `topLayerAt` **顶面胜出** ⇒ 每样本只计一次、占比永远归一（实测：`18` 三枚 facet
 * 顶面占比 73.6% + 13.4% + 13.1% = 100.0%）⇒ **叠压不使语义失真**，旧前提失效。
 * 而 `§7.11.3` 的 `18` 层集本身就是叠压式（#2 主体满格 rect 上再压两条明暗带）：
 * 旧门在新套上**必然误伤**（实测 3453px = 全盘 23.6%）。两条出路只有一条合法：
 * ⛔ 不得为了过旧门而重造型（删带/不叠压 = 改掉正本身份），而是把门改到真正危险的东西上：
 *  ① **死层硬门**（更强替代）：任一 facet 层顶面可见像素 = 0 ⇒ 判红。被完全遮住的层
 *     不贡献任何像素却白占一枚命令 ⇒ 那才是“叠压失真”的真形态（旧门对此**反而看不见**：
 *     完全重叠时旧门只报一个重叠数，不区分“可见”与“死掉”）。
 *  ② **逐风格钉值**（登记而非阈值）：重叠像素实算值必须等于登记值 ⇒ 任何 facet 几何改动
 *     都会扯动它 ⇒ 强制重跑差分复算后才能改登记（K-051）。⛔ **不用区间**：区间会把
 *     尚未解释清的偏差藏进门里（本批实测前曾误推「采样系统性偏低」，复算后证明是我方
 *     解析期望算错（孔径 0.22S 而非 0.11S）⇒ 先弄清偏差再谈区间）。
 *  ③ **默认拒绝**：未登记风格一律判违规并打出实算值（⛔ 不得“新套自动继承旧套阈值”）。
 * ⚠ 本改写只动**统计域自洽性哨兵**，⛔ 不触碰 C12 裁定式（argmax ∈ base 同族）与占比表。
 * ⚠ 旧 `facetOverlapPixels()` 独立函数的职责已并入 `facetCoverage().overlap`（一趟采样同时得
 *   重叠数与逐层顶面数 ⇒ 两套读数不会因两趟网格不一致而漂移）。
 */
const FACET_OVERLAP_REGISTER = {
    // 三套均为 colorIdx=1 / size=BEAD_CELL(30) / grid=121 的实算值（`temp/wxg-t-211-s4/` 台面存证）。
    'facet-4': 151, // 四枚刻面共边带噪声（旧注已标“非面积重叠”，值未变 = S3 基线可复现）
    'dual-tone-13': 0, // 单枚 facet ⇒ 无重叠对象（结构性事实，不是“调低了阈值”）
    'lineart-18': 3453, // 叠压式层集（主体 rect 上两条带）⇒ 旧 10% 泛阈值在此必误伤的正因
};

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
            // 族内非 base（facet-4 实测情形：argmax=edge 25.3% > base 24.8%，自 WXG-T-211-S3
            // 四棱转正后有实测值；旧乙口径孔径 0.17S 下为 25.2%，孔径改 0.22S 后跨过
            // toFixed(1) 进位线 ⇒ 差分复算见 spec §11.2-a，⛔ 本注旧值不得再被引用）不入违规——
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
    // 几何与颜色无关（beadLayers 只有 fill 随 ci 变）⇒ 重叠/覆盖哨兵只算 colorIdx=1 一次。
    // ⚠ 旧门「重叠 > 全盘 10% 即红」已在步 4 作废（前提失效 + 对新套必误伤），改写理由
    //   逐字记在上方 `FACET_OVERLAP_REGISTER` 的政策注里（K-053：旧值旧句留档，不净删）。
    const overlaps = [];
    let coverage = [];
    {
        const ls = style.beadLayers({ inks, colorIdx: 1, size: tuning.BEAD_CELL });
        const cov = facetCoverage(ls, tuning.BEAD_CELL);
        const ov = cov.overlap;
        coverage = cov.perFacet;
        if (ov > 0) overlaps.push({ colorIdx: 1, pixels: ov });
        const registered = Object.prototype.hasOwnProperty.call(FACET_OVERLAP_REGISTER, style.id);
        if (!registered) {
            violations.push(
                `C12 重叠登记缺失 [${style.id}]：facet 族重叠实算 ${ov}px，但本风格未在 ` +
                `FACET_OVERLAP_REGISTER 登记钉值 ⇒ **默认拒绝**（⛔ 不得让新套自动继承旧套阈值）。` +
                `请先按 K-051 差分复算（重叠像素来由逐层归因 + C12 占比表重跑）后登记。`,
            );
        } else if (ov !== FACET_OVERLAP_REGISTER[style.id]) {
            violations.push(
                `C12 重叠钉值漂移 [${style.id}]：实算 ${ov}px ≠ 登记 ${FACET_OVERLAP_REGISTER[style.id]}px ` +
                `⇒ facet 层几何被动过。须先重跑逐层归因与 C12 占比表（更新 §6 差分记录）再改登记值，` +
                `⛔ 不得就地改阈值求绿。`,
            );
        }
        // ① 死层硬门（本批替代旧泛阈门的更强判据）：顶面完全不可见的 facet = 无效造型。
        for (const f of coverage) {
            if (f.topPixels === 0) {
                violations.push(
                    `C12 死层 [${style.id}] #${f.index + 1}（role=facet, fill=${f.fill}）：顶面可见像素 = 0` +
                    `（被上层全遮蔽，covered=${f.coveredPixels}px）⇒ 该层不贡献任何画面却占一枚命令，` +
                    `造型意图不成立，判红（⛔ 不得靠删层静默消解，需同批改层集并重钉双指标）。`,
                );
            }
        }
    }
    return { id: style.id, commands, alpha, c12, overlaps, coverage, violations, layers };
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

/**
 * **死层反例臂**（步 4 重叠判据改写的变异自证，K-060）：两枚几何全同的 facet，先画的 `#1`
 * 被后画的 `#2` 完全遮蔽 ⇒ 顶面可见像素 = 0。
 * ⚑ **重叠量故意做小**（两枚全同三角 = 0.049 全盘，低于旧 10% 泛阈）⇒ 旧门对本臂
 *   **放行**而新门判红 ⇒ 这才真正证明本批改写是**判别力净增加**，不是「把阈值抬高一档」。
 * 命令数 4 ≤ 7、真 α 0 ≤ 2 ⇒ **不触 C7 门**；反例夹具永不入 `FACET_OVERLAP_REGISTER`
 * （默认拒绝亦作用其上）⇒ 本臂会同时打「登记缺失」与「死层」两行，归因断言只钉**死层行**。
 */
export function fixtureDeadFacetLayer() {
    return {
        id: 'fixture-dead-facet',
        beadLayers: ({ inks, colorIdx }) => {
            const e = inks.endpoints[colorIdx - 1];
            // 上四分之一窄三角（|x| ≤ 4y/11）×两枚全同 ⇒ 重叠 = 单枚面积 ≈ 全盘 4.9%。
            const tri = [-4, 11, 4, 11, 0, 0];
            return Object.freeze([
                { kind: 'polygon', role: 'facet', points: tri, fill: e.lit },
                { kind: 'polygon', role: 'facet', points: tri, fill: e.base },
                { kind: 'polygon', role: 'facet', points: [-11, -11, -11, 11, 0, 0], fill: e.edge },
                { kind: 'circle', role: 'hole', cx: 0, cy: 0, r: 4, fill: e.pit },
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
        ? [...registered, fixtureEightCommandsZeroAlpha(), fixtureFiveCommandsThreeAlpha(), fixtureForeignBaseFacets(), fixtureDeadFacetLayer()]
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
                        // ⚠ 本注只登记「argmax ≠ base」这一**事实**，不对任何风格宣称「与纸面不符」：
                        //   各风格的纸面预期见 `assets-spec §7.11.x` 逐套核对结论——四棱（亮底占优）与
                        //   `13`（珠面域只有一枚 `pit` 三角 ⇒ argmax 预期即 pit）都**在本注下同形**，
                        //   把注文写成「base 占优预期落空」会谎报后者（K-051 同族：输出不得含未核对的断言）。
                        `差异是否合纸面预期 ⇒ 逐套查 §7.11.x 核对结论，本行不代定；已回传主理人，实现侧不消解。`
                    );
                })();
        console.log(
            `[${a.id}] 命令=${a.commands} 真α=${a.alpha} facet重叠px=${a.overlaps.reduce((s, o) => s + o.pixels, 0)}` +
            ` facet顶面px=${a.coverage.map((f) => `#${f.index + 1}:${f.topPixels}`).join(' ')}` +
            `\n${c12Summary}${nearNote}`,
        );
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
