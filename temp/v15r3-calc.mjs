/**
 * v1.5-r3 核算脚本（WXG-T-131，林绘澄，2026-09-17）
 * 承 temp/a11y-calc2.mjs / bc-calc.mjs 判例：所有写进 art 三件的数字先在此逐条推出，
 * 主理人可 `node temp/v15r3-calc.mjs` 复算。
 *
 * 真源：systems-index.md §3（v1.23）/ src/config/tuning.ts（代码现状）/
 *       src/view/palette.ts（hex 与 mix 系数）/ src/view/combo-vfx.ts（既有粒子语言）。
 */

// ---------- palette.ts 同函数（Rec.601） ----------
function luminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
}
function mixHex(hex, amount) {
    // palette.ts::mix —— amount<0 向黑、>0 向白（单向黑白）
    const t = Math.abs(amount);
    const target = amount < 0 ? 0 : 255;
    const ch = (i) => {
        const v = parseInt(hex.slice(i, i + 2), 16);
        return Math.round(v + (target - v) * t);
    };
    const h = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${h(ch(1))}${h(ch(3))}${h(ch(5))}`;
}

const BEADS = [
    ['奶白', '#FDF6E9'], ['柠黄', '#FFD23F'], ['活力橙', '#F59B23'], ['草绿', '#3FBF6B'],
    ['玫红', '#E84C3D'], ['丁香紫', '#8E6FD9'], ['湖蓝', '#3D7BF5'], ['赭棕', '#A5652C'],
    ['深棕', '#6B3E1E'], ['炭黑', '#33333D'],
];
const THRESH = 0.04 * 255; // 本仓自判据 ΔL ≤4% = 10.2/255 不可辨

console.log('=== §A  A3 分侧核算 · 默认态（开关关）：S2 坑底 10 色明度链 ===');
{
    const rows = BEADS.map(([n, hex]) => {
        const s2 = mixHex(hex, -0.14);
        return { n, s2, L: luminance(s2) * 255 };
    }).sort((a, b) => b.L - a.L);
    let clusters = 1;
    const chain = [];
    for (let i = 0; i < rows.length; i++) {
        const d = i === 0 ? null : rows[i - 1].L - rows[i].L;
        if (d !== null) chain.push(`${rows[i].n} Δ${d.toFixed(1)}${d < THRESH ? '❌' : ''}`);
        if (d !== null && d < THRESH) { /* same cluster */ } else if (i > 0) clusters++;
    }
    console.log(rows.map((r) => `${r.n} ${r.L.toFixed(1)} (${r.s2})`).join('｜'));
    console.log('相邻差：' + chain.join(' / '));
    console.log(`单链聚类可分离档 = ${clusters}（阈值 ${THRESH.toFixed(1)}）`);
    // 同法核 S1(-0.30) / S4(+0.20)
    for (const [tag, k] of [['S1 −0.30', -0.3], ['S4 +0.20', 0.2]]) {
        const L = BEADS.map(([n, hex]) => ({ n, L: luminance(mixHex(hex, k)) * 255 }))
            .sort((a, b) => b.L - a.L);
        let c = 1, min = Infinity;
        for (let i = 1; i < L.length; i++) {
            const d = L[i - 1].L - L[i].L;
            min = Math.min(min, d);
            if (d >= THRESH) c++;
        }
        console.log(`${tag}：档 ${c}、最小相邻差 ${min.toFixed(1)}`);
    }
}

console.log('\n=== §A2  A3 分侧核算 · 开启态（E4 幽灵符号回归）===');
{
    // 开启态：empty 层 = S1–S4 + E4 符号（GHOST_SYMBOL_SCALE 0.8、α 0.32）
    // 符号通道 = 10 个互异矢量 ⇒ 离散 10 位，与明度无关
    console.log('符号通道：10 色 ↔ 10 符号（○★●■♥◐▽▲◆✚）一一映射 ⇒ 10 档（离散、不依赖 luma）');
    console.log('⇒ 开启态 empty 侧恢复到 v1.4 前的「10 色 + 6 状态 100% 可辨」');
    // E4 的 α 0.32 叠在 S2 坑底上的合成明度（诚实核：符号是否真读得出来）
    const rows = BEADS.map(([n, hex]) => {
        const pit = luminance(mixHex(hex, -0.14));
        const inkL = luminance(mixHex(hex, -0.55)); // SYMBOL_INK_DARK_MIX
        const bright = pit > 0.6;
        const ink = bright ? inkL : 1.0;             // SYMBOL_INK_LIGHT #FFFFFF
        const comp = 0.32 * ink + 0.68 * pit;        // α 叠加
        return { n, pit, comp, d: Math.abs(comp - pit) * 255, bright };
    });
    console.log('E4 符号对坑底的合成 ΔL（α0.32，ink 按 SYMBOL_INK_LUMA_THRESHOLD 0.6 分侧）：');
    console.log(rows.map((r) => `${r.n}${r.bright ? '(暗墨)' : '(白墨)'} Δ${r.d.toFixed(1)}${r.d < THRESH ? '❌' : '✓'}`).join('｜'));
}

// ---------- 冻结常量（双口径） ----------
const SPEC = { base: 6, expand: 6, cols: 12, slot: 48, gap: 6, pad: 12 };   // systems-index §3.4 v1.23
const CODE = { base: 12, expand: 12, cols: 12, slot: 48, gap: 6, pad: 12 };  // tuning.ts:101-111 现状
const GRID_MAX = 13 * 12;      // 156（§3.3 GRID_MAX_COLS 13 × GRID_MAX_ROWS 12）
const BG = 3, PLATE = 7;       // §1.8 / §1.7
const PANEL = 3, PLATE_INNER = 3; // §1.3 投影/板体/描边 + v1.5 微拱白瓷 3 段内阴影
const LAYER = { filled: 10, emptyV15: 4, emptyV14spec: 2, emptyV14code: 1, dashed: 1 };

function baselines(C, tag) {
    const cap = C.base + C.expand;              // 最坏槽数
    console.log(`\n=== §B  三基线（${tag}：base ${C.base} + expand ${C.expand} ⇒ 最坏 ${cap} 槽）===`);
    const b1 = BG + PLATE + GRID_MAX * LAYER.filled + cap * LAYER.filled;
    const b2 = b1 + GRID_MAX * (LAYER.emptyV15 - LAYER.emptyV14spec) + cap * (LAYER.emptyV15 - LAYER.emptyV14spec) + PLATE_INNER;
    const b3 = GRID_MAX * LAYER.filled + cap * LAYER.emptyV15 + (BG + PLATE) + PANEL + PLATE_INNER;
    const b3un = GRID_MAX * LAYER.filled + C.base * LAYER.emptyV15 + C.expand * LAYER.dashed + (BG + PLATE) + PANEL + PLATE_INNER;
    const b3v14s = GRID_MAX * LAYER.filled + cap * LAYER.emptyV14spec + (BG + PLATE) + PANEL;
    const b3v14c = GRID_MAX * LAYER.filled + cap * LAYER.emptyV14code + (BG + PLATE) + PANEL;
    console.log(`①  v1.4 材质    = 3+7+156×10+${cap}×10            = ${b1}`);
    console.log(`    构成：背景 3 + 容器板/band 7 + 网格 1560 + 托盘最坏 ${cap}×10 = ${cap * 10}`);
    console.log(`②  v1.5 松上界  = ① + 156×(+2) + ${cap}×(+2) + 3      = ${b2}`);
    console.log(`    构成：${b1} + 网格空槽 +${GRID_MAX * 2} + 托盘空槽 +${cap * 2} + 微拱白瓷 +3`);
    console.log(`③  v1.5 可达真值= 1560 + ${cap}×4 + 10 + 3 + 3        = ${b3}`);
    console.log(`③u 未扩展       = 1560 + ${C.base}×4 + ${C.expand}×1 + 10+3+3     = ${b3un}`);
    console.log(`③a v1.4 材质·规格 2 层  = 1560 + ${cap}×2 + 10 + 3    = ${b3v14s}`);
    console.log(`③b v1.4 材质·代码真值 1 层 = 1560 + ${cap}×1 + 10 + 3 = ${b3v14c}`);
    console.log(`④  解环器期真值 = ③ + 5                            = ${b3 + 5}`);
    console.log(`⑤  归位连击期（global 门 +5） = ③ + 5               = ${b3 + 5}  ⚠️与④数值巧合`);
    console.log(`⑥  解环器 + 连击同帧（global 门 +10） = ③ + 10      = ${b3 + 10}`);
    console.log(`⑦  解环器 + 连击同帧（per-cell 门 +20）= ③ + 20     = ${b3 + 20}`);
    console.log(`⑧  庆祝期 −580 = ③ − 580                           = ${b3 - 580}`);
    console.log(`⑨  庆祝期 −600（阀③）= ③ − 600                      = ${b3 - 600}`);
    console.log(`⑩  道具期本轮落码 +3 = ③ + 3                        = ${b3 + 3}`);

    // h 不变量
    console.log(`\n--- h 不变量复验（h = 托盘持珠数，上限 = ${cap}）---`);
    for (const h of [0, 4, 8, cap]) {
        if (h > cap) continue;
        const grid = (GRID_MAX - h) * LAYER.filled + h * LAYER.emptyV15;
        const tray = (cap - h) * LAYER.emptyV15 + h * LAYER.filled;
        const total = grid + tray + (BG + PLATE) + PANEL + PLATE_INNER;
        console.log(`h=${String(h).padStart(2)}：网格 ${GRID_MAX - h}×10+${h}×4 = ${grid}｜托盘 ${cap - h}×4+${h}×10 = ${tray}｜总 = ${total}`);
    }
    return { b1, b2, b3, b3un, b3v14s, b3v14c, cap };
}

const S = baselines(SPEC, '规格口径 v1.23');
const K = baselines(CODE, '代码现状（v1.23 工程落码后作废）');

console.log('\n=== §B3  主理人粗算校验 ===');
console.log(`主理人给：② 2173 → 2149（只把托盘空槽增量 24×2=48 改 12×2=24）`);
console.log(`本脚本：② = ${S.b2}（同时把「托盘最坏 filled」由 24×10=240 改 12×10=120）`);
console.log(`差 = ${2149 - S.b2} = 恰好 120 = 12 槽 × 10 层 ⇒ 主理人的 2149 保留了 24 槽的 filled 项`);
console.log(`③ 主理人给 1672 → 1624；本脚本 = ${S.b3} ⇒ ${S.b3 === 1624 ? '一致 ✓' : '不一致 ✗'}`);

console.log('\n=== §B4  「最坏情况」定义复核（网格全 filled 1560 是否仍成立）===');
console.log(`§3.13：MISPLACED_PAIRS_MIN 1 / MAX 8 ⇒ k ≤ 8 ⇒ 错位珠 ≤ 2k = 16`);
console.log(`v1.22 开局 = 满盘（swaps 两两交换构造）⇒ 网格 filled = 156 − 已取回未归位数`);
console.log(`⇒ 「网格全 filled 1560」在开局那一帧成立；游戏中最多 16 格转 empty（取回后）`);
console.log(`   该 16 格的层数变化 = 16×(10−4) = 96 ⇒ 与 h 不变量相消（见上）`);

console.log('\n=== §C  新活 1 · 托盘面板几何（trayLayout() 同式）===');
function trayGeom(C, cap) {
    const pitch = C.slot + C.gap;                       // 54
    const rowWidth = C.cols * pitch - C.gap;            // 12×54−6 = 642
    const left = (750 - rowWidth) / 2;                  // 54
    const rows = Math.ceil(cap / C.cols);
    const panelH = rows * pitch - C.gap + C.pad * 2;
    const panelW = rowWidth + C.pad * 2;
    const panelX = left - C.pad;
    const panelBottom = 450 - panelH;                   // TRAY_BAND.yMax 450，贴上沿
    const x0 = left, xN = left + (Math.min(cap, C.cols) - 1) * pitch + C.slot;
    console.log(`cap=${cap}：rows=${rows} pitch=${pitch} rowWidth=${rowWidth} left=${left}`);
    console.log(`  面板 x∈[${panelX},${panelX + panelW}] 宽 ${panelW}｜y∈[${panelBottom},450] 高 ${panelH}`);
    console.log(`  槽簇 x∈[${x0},${xN}] 宽 ${xN - x0}`);
    console.log(`  右侧留白 = ${(panelX + panelW - C.pad) - xN} px（板内缘到末槽右缘）`);
    console.log(`  btn_expand：视觉 y∈[250,298] 热区 y∈[230,318]；面板底 ${panelBottom} ⇒ 净空 ${panelBottom - 318}px`);
    return { rows, panelH, panelW, panelX, panelBottom };
}
console.log('--- 规格口径 v1.23（6 base）---');
trayGeom(SPEC, SPEC.base);
console.log('--- 规格口径 v1.23（扩展后 12）---');
trayGeom(SPEC, SPEC.base + SPEC.expand);
console.log('--- 代码现状（12 base）---');
trayGeom(CODE, CODE.base);
console.log('--- 代码现状（扩展后 24）---');
trayGeom(CODE, CODE.base + CODE.expand);

console.log('\n--- 案 (b) 面板收窄到 6 槽宽 的几何 ---');
{
    const rowWidth6 = 6 * 54 - 6;             // 318
    const panelW6 = rowWidth6 + 2 * 12;       // 342
    const left6 = (750 - rowWidth6) / 2;      // 216
    console.log(`rowWidth(6 槽) = 6×54−6 = ${rowWidth6}；panelW = ${panelW6}；left = ${left6}；panelX = ${left6 - 12}`);
    console.log(`扩展后 12 槽 ⇒ panelW 回到 ${12 * 54 - 6 + 24} ⇒ 宽度变化 ${12 * 54 - 6 + 24 - panelW6}px ⇒ 需「面板动态变宽」动画（§5 缺行）`);
    console.log(`btn_expand 热区 132×88 不动、x = (750−132)/2 = ${(750 - 132) / 2} ⇒ 与收窄面板（x∈[${left6 - 12},${left6 - 12 + panelW6}]）的关系：按钮在面板正下方、水平居中 ⇒ 面板变宽时按钮不动 ⇒ 视觉脱节`);
}

console.log('\n=== §D  新活 3 · 归位连击粒子渐强 ===');
{
    const easeOut = (u) => 1 - (1 - u) ** 2;
    const MS = 200;                                  // ux-spec §5「归位连击（普通模式）」行
    const COUNTS = [2, 3, 4, 5];                     // 档 1..4
    console.log(`时长真源 200ms（复用 Lv1 行）；枚数阶梯 ${COUNTS.join('/')}（档 4 = 5 = Lv1 先例上界）`);
    console.log('--- 与 sprint Lv1 的镜像恒等性 ---');
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        const rSprint = 26 + 34 * p;                   // combo-vfx.ts:88
        const rGather = 60 - 34 * p;                   // 本卡（时间反演）
        const radSprint = 3 + 50 * 0.1 * (1 - p);      // view-model.ts:1006 → 3 + 5(1−p)
        const radGather = 3 + 50 * 0.1 * p;            // 3 + 5p
        console.log(`p=${p}：sprint R=${rSprint} r=${radSprint.toFixed(2)}｜gather R=${rGather} r=${radGather.toFixed(2)}｜α=${(1 - p).toFixed(2)}`);
    }
    console.log('--- 角度公式推广（原式 (π/2)·i 对 n≠4 退化）---');
    for (const n of [2, 3, 4, 5]) {
        const oldA = [], newA = [];
        for (let i = 0; i < n; i++) {
            oldA.push((((Math.PI / 2) * i + Math.PI / 4) * 180 / Math.PI) % 360);
            newA.push((((2 * Math.PI / n) * i + Math.PI / 4) * 180 / Math.PI) % 360);
        }
        console.log(`n=${n}：原式 [${oldA.map((a) => a.toFixed(0)).join(',')}]°  推广 [${newA.map((a) => a.toFixed(0)).join(',')}]°`);
    }
    console.log('n=4 时两式逐枚相等 ⇒ sprint Lv1 零回归：');
    for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i + Math.PI / 4, b = (2 * Math.PI / 4) * i + Math.PI / 4;
        console.log(`  i=${i}: ${a.toFixed(6)} vs ${b.toFixed(6)} ⇒ ${Math.abs(a - b) < 1e-12 ? '恒等 ✓' : '不等 ✗'}`);
    }
    console.log('--- A5 符号遮挡核算（符号区 = 中心 BEAD×0.40 = 20px ⇒ ±10px）---');
    let minGap = Infinity, at = 0;
    for (let p = 0; p <= 1.0001; p += 0.01) {
        const R = 60 - 34 * p, r = 3 + 5 * p;
        const gap = R - r;                 // 粒子内缘到格心的距离
        if (gap < minGap) { minGap = gap; at = p; }
    }
    console.log(`min(R − r) = ${minGap.toFixed(2)}px @ p=${at.toFixed(2)} ⇒ ${minGap > 10 ? '> 10 ⇒ 全程不进符号区 ✓' : '≤ 10 ⇒ 会遮符号 ✗'}`);
    console.log(`且 R 最小 = 26px > 格半宽 25px ⇒ 粒子终点在格缘外 1px（落 2px 格缝内）`);
    console.log('--- A5 邻珠重叠核算（粒子最外缘）---');
    console.log(`R 最大 = 60 + r(0) = 60 + 3 = 63px ⇒ 越出本格半宽 25px 达 38px ⇒ 会扫过邻格`);
    console.log(`  ⇒ 但 α = 1−p，R=63 时 p=0 ⇒ α=1（最亮时最远）；R 越小时 α 越低 ⇒ 进入邻格中心区的粒子已半透`);
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        const R = 60 - 34 * p, r = 3 + 5 * p;
        console.log(`  p=${p}：外缘 ${R + r}px、α=${(1 - p).toFixed(2)}；越过 pitch 52 的邻格心 = ${R + r > 52 ? '是' : '否'}`);
    }
    console.log('--- D2 频率核算 ---');
    console.log(`单次 burst：α = 1−p 单调递减 ⇒ 0 往复（承 G2 判例）；非周期、事件驱动、无自重复周期量（承 combo-vfx.ts 头注判例）`);
    console.log(`解环器逐颗 80ms 间隔 ⇒ 同帧并发 burst = ceil(200/80) = ${Math.ceil(200 / 80)}`);
    console.log(`错峰叠加：S(t) = α1(t) + α2(t−80) + α3(t−160)，各单调减 ⇒ S 至多 2 次突升后单调降 ⇒ 按 BD-29 house 口径（G1 单峰 = 0 往复）计 ≤2 峰、0 往复`);
    console.log(`保守折算：3 峰 / (200+160)ms = ${(3 / 0.36).toFixed(1)} 峰/秒 —— 若把「峰」当「往复」读则 > 3Hz`);
    console.log(`  ⇒ 消解：采 global 门（同一时刻只播一个 burst，承 combo-vfx.ts 头注「多档重叠只播最高档」）⇒ 同区域恒 1 峰`);
    console.log(`同格重复触发：filled 是终态、不可回退 ⇒ 同一格不可能被二次归位 ⇒ 同区域重复 = 0`);
    console.log('--- 图元 ---');
    for (const [tag, n] of [['global 门', 1], ['per-cell 门', 3]]) {
        console.log(`${tag}：最坏单帧新增 circle = ${n} × 5（档 4 枚数）= ${n * 5}`);
    }
    console.log(`原语：circle（render-model.ts:128-149 五原语之一）⇒ 零 polygon、零新增原语`);
}

console.log('\n=== §E  G2 卡重立 · 解环器批量上限复核 ===');
{
    console.log(`SOLVER_PLUS_COUNT = 3（tuning.ts:176）/ SOLVER_RANDOM_COUNT = 1（:178）`);
    console.log(`错位珠总数 ≤ 2×MISPLACED_PAIRS_MAX(8) = 16`);
    console.log(`ux-spec §5「解环器归位」= 200ms + 120ms/颗、逐颗 80ms 间隔`);
    console.log(`G1 并发 = ceil(120/80) = ${Math.ceil(120 / 80)} ⇒ S1 露缘 +2`);
    console.log(`高亮闪 ≤ 3 颗 × 1 层 = +3 ⇒ 解环器期净 = +5（与 v1.5-r2 的「并发上限 +3」同源）`);
    console.log(`⚠️ beads-game.ts:810-816 swap 路径一次发 2 个 bead:placed ⇒ solverPlus 3 颗最坏发 6 个事件`);
    console.log(`   ⇒ 若「高亮闪」按事件计而非按颗计：6 × 1 = +6 ⇒ 净 +8（本卡按颗计 = +5，事件口径登记为风险）`);
}

console.log('\n=== §F  新活 2 · 换肤面的零 hex 系数组 ===');
{
    const coeffs = {
        BEAD_SOFT_HIGHLIGHT_ALPHAS: [0.08, 0.16, 0.30],
        BEAD_BEVEL_DARK_MIX: -0.26,
        BEAD_BEVEL_LIGHT_MIX: 0.2,
        BEAD_RIM_MIX: 0.38,
        BEAD_CONTACT_SHADOW_ALPHA: 0.12,
        BEAD_SHADOW_ALPHA: 0.15,
    };
    console.log(JSON.stringify(coeffs, null, 0));
    // 「光泽度」单参数换肤：三层软高光 α 同比缩放 k
    for (const k of [0.5, 1.0, 1.5]) {
        const a = coeffs.BEAD_SOFT_HIGHLIGHT_ALPHAS.map((v) => +(v * k).toFixed(3));
        // 累计中心 α（§1.1 F4 说明：中心累计 ≈0.48）
        console.log(`k=${k}：L4a/b/c α = ${a.join('/')}，中心累计 = ${a.reduce((s, v) => s + v, 0).toFixed(3)}`);
    }
    // 换肤是否破坏 B2 符号对比（symbols.test.ts 只对 base 算 ⇒ 测不到）
    console.log('--- B2 风险：符号对比只对 base 算（tests/symbols.test.ts:70-100 symbolInk(base)）---');
    for (const k of [1.0, 1.5, 2.0]) {
        const a = coeffs.BEAD_SOFT_HIGHLIGHT_ALPHAS.map((v) => v * k);
        const rows = BEADS.map(([n, hex]) => {
            const L = luminance(hex);
            // 符号区在珠面中心，L4c 覆盖中心 0.56×0.14 区 ⇒ 符号区合成面 = base 叠三层白
            let comp = L;
            for (const al of a) comp = al * 1.0 + (1 - al) * comp;
            const ink = L > 0.6 ? luminance(mixHex(hex, -0.55)) : 1.0;
            const d = Math.abs(comp - ink) * 255;
            return `${n} Δ${d.toFixed(1)}${d < THRESH ? '❌' : ''}`;
        });
        console.log(`k=${k}：${rows.join('｜')}`);
    }
}
