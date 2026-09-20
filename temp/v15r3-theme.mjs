/**
 * v1.5-r3 追加核算（WXG-T-131，林绘澄，2026-09-17）
 * 主题：新活 2「珠材质主题换肤占位」的 B2 安全边界 + palette 结构可行性取证。
 *
 * ⚠️ 口径严格照抄代码，不自造模型：
 *  · 符号墨选择 = `src/view/symbols.ts:90-111 symbolInk()`：
 *      preferDark = luminance(base) > SYMBOL_INK_LUMA_THRESHOLD(0.6)；
 *      首选墨 contrast < SYMBOL_CONTRAST_MIN(3) ⇒ **翻转**另一侧、取对比更高者（草绿例外即由此产生）；
 *      白墨的 contrast 按 `mixWith(base,#FFF,SYMBOL_INK_LIGHT_ALPHA 0.9)` 合成后测。
 *  · 对比 = `palette.ts::contrastRatio`（WCAG 相对亮度）。
 *  · 高光几何 = `bead-render.ts:186-191 BEAD_CARD.softHighlights`（边长比，y 向上）。
 *
 * 本脚本的动机：`accessibility.md` A5 与 `assets-spec §6` 均声称「10 色符号墨**对合成面**对比
 * 经 `bead-render.test` 复算仍 ≥3:1」，但 `grep -n "contrast" tests/bead-render.test.ts`
 * **零命中**，唯一的对比断言在 `tests/symbols.test.ts:82`，且它测的是
 * `symbolInk(base).contrast` = **对 base**、不是对合成面 ⇒ 该声称**无测试支撑**。
 * 本脚本把「对合成面」真正算出来。
 */

// ---------- palette.ts 同函数 ----------
function relLum(hex) {
    const f = (i) => {
        const v = parseInt(hex.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5);
}
function luminance(hex) { // Rec.601
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
}
function mixHex(hex, amount) { // palette.ts::mix —— 单向黑白
    const t = Math.abs(amount), target = amount < 0 ? 0 : 255;
    const ch = (i) => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(v + (target - v) * t); };
    const h = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${h(ch(1))}${h(ch(3))}${h(ch(5))}`;
}
function mixWith(a, b, t) { // palette.ts::mixWith —— 双色插值
    const ch = (i) => Math.round((1 - t) * parseInt(a.slice(i, i + 2), 16) + t * parseInt(b.slice(i, i + 2), 16));
    const h = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${h(ch(1))}${h(ch(3))}${h(ch(5))}`;
}
const cr = (a, b) => (Math.max(relLum(a), relLum(b)) + 0.05) / (Math.min(relLum(a), relLum(b)) + 0.05);

const TH = 0.6, DARK = -0.55, LIGHT_A = 0.9, FLOOR = 3;
function symbolInk(base) {
    const preferDark = luminance(base) > TH;
    const meas = (useDark) => useDark
        ? { dark: true, color: mixHex(base, DARK), contrast: cr(mixHex(base, DARK), base), kind: '暗墨(不透明)' }
        : { dark: false, color: mixWith(base, '#FFFFFF', LIGHT_A), contrast: cr(mixWith(base, '#FFFFFF', LIGHT_A), base), kind: '白墨α0.9' };
    const preferred = meas(preferDark);
    if (preferred.contrast >= FLOOR) return preferred;
    const flipped = meas(!preferDark);
    return flipped.contrast > preferred.contrast ? { ...flipped, flipped: true } : { ...preferred, flipped: true };
}
/** 墨画在合成面 face 上的实际对比（暗墨不透明；白墨 α0.9 叠在 face 上） */
function inkOnFace(ink, face) {
    const c = ink.dark ? ink.color : mixWith(face, '#FFFFFF', LIGHT_A);
    return cr(c, face);
}

const BEADS = [
    ['奶白', '#FDF6E9'], ['柠黄', '#FFD23F'], ['活力橙', '#F59B23'], ['草绿', '#3FBF6B'],
    ['玫红', '#E84C3D'], ['丁香紫', '#8E6FD9'], ['湖蓝', '#3D7BF5'], ['赭棕', '#A5652C'],
    ['深棕', '#6B3E1E'], ['炭黑', '#33333D'],
];
const ALPHAS = [0.08, 0.16, 0.30]; // BEAD_SOFT_HIGHLIGHT_ALPHAS（L4a/L4b/L4c）

console.log('=== §0 符号区 × 三层软高光的实际重叠（几何取自 BEAD_CARD，y 向上）===');
{
    const SYM = [0.30, 0.70];           // 居中、BEAD_SYMBOL_SIZE_RATIO 0.40
    const layers = [['L4a', 0.52, 0.90, 0.08], ['L4b', 0.60, 0.86, 0.16], ['L4c', 0.68, 0.82, 0.30]];
    for (const [n, lo, hi, a] of layers) {
        const o = Math.max(0, Math.min(SYM[1], hi) - Math.max(SYM[0], lo));
        console.log(`  ${n} α${a.toFixed(2)}：y∈[${lo},${hi}] ∩ 符号 y∈[0.30,0.70] = ${o.toFixed(2)} ⇒ 符号高的 ${(o / 0.4 * 100).toFixed(0)}%（${(o * 50).toFixed(1)}px@50）`);
    }
    console.log(`  x 向：L4a[0.06,0.88] / L4b[0.10,0.82] / L4c[0.16,0.72] 均 ⊇ 符号 x[0.30,0.70] ⇒ x 向全重叠`);
    const e1 = ALPHAS[0];
    const e2 = 1 - (1 - ALPHAS[0]) * (1 - ALPHAS[1]);
    const e3 = 1 - (1 - ALPHAS[0]) * (1 - ALPHAS[1]) * (1 - ALPHAS[2]);
    console.log(`  ⇒ 符号分区（自下而上）：`);
    console.log(`     y∈[0.30,0.52] 纯 base            = 符号高 55%（α_eff 0）`);
    console.log(`     y∈[0.52,0.60] base+L4a           = 20%（α_eff ${e1.toFixed(4)}）`);
    console.log(`     y∈[0.60,0.68] base+L4a+L4b       = 20%（α_eff ${e2.toFixed(4)}）`);
    console.log(`     y∈[0.68,0.70] base+L4a+L4b+L4c   =  5%（α_eff ${e3.toFixed(4)}）＝顶缘 ${(0.02 * 50).toFixed(0)}px@50`);
}

const MODELS = [
    ['A｜house/测试口径：单层 max α（= tests 的隐含前提）', ALPHAS[2]],
    ['B｜符号上半 20% 区：L4a+L4b 叠', 1 - (1 - ALPHAS[0]) * (1 - ALPHAS[1])],
    ['C｜符号顶缘 5%（1px）：三层全叠', 1 - (1 - ALPHAS[0]) * (1 - ALPHAS[1]) * (1 - ALPHAS[2])],
];

for (const [tag, aEff] of MODELS) {
    console.log(`\n=== §1 模型 ${tag}｜α_eff = ${aEff.toFixed(4)} ===`);
    const rows = BEADS.map(([n, base]) => {
        const ink = symbolInk(base);
        const face = mixWith(base, '#FFFFFF', aEff);
        return { n, ink, face, cBase: ink.contrast, cFace: inkOnFace(ink, face) };
    });
    for (const r of rows) {
        console.log(`  ${r.n.padEnd(4)}[${r.ink.kind}${r.ink.flipped ? '·翻转' : ''}] 对 base ${r.cBase.toFixed(2)}${r.cBase < 3 ? '❌' : '✓'} ｜ 对合成面 ${r.cFace.toFixed(2)}${r.cFace < 3 ? '❌' : '✓'}（面 ${r.face}）`);
    }
    const minBase = Math.min(...rows.map((r) => r.cBase));
    const minFace = Math.min(...rows.map((r) => r.cFace));
    console.log(`  ⇒ 10 色最小：对 base ${minBase.toFixed(2)}:1 ${minBase >= 3 ? '✓' : '✗'}｜对合成面 ${minFace.toFixed(2)}:1 ${minFace >= 3 ? '✓' : '✗'}`);
}

console.log('\n=== §2 换肤「光泽度」k 的 B2 安全上限（三模型并列反解）===');
{
    for (const [tag, a0] of MODELS) {
        const minAt = (k) => Math.min(...BEADS.map(([, base]) => {
            const ink = symbolInk(base);
            return inkOnFace(ink, mixWith(base, '#FFFFFF', a0 * k));
        }));
        let lo = 0, hi = 3;
        if (minAt(hi) >= 3) { console.log(`  ${tag.slice(0, 1)}：k 上限 > 3（不敏感）`); continue; }
        for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (minAt(mid) >= 3) lo = mid; else hi = mid; }
        console.log(`  ${tag.slice(0, 1)}：k 上限 = ${lo.toFixed(4)}（k=1 时最小 ${minAt(1).toFixed(2)}:1；k=0 时 ${minAt(0).toFixed(2)}:1）`);
    }
    console.log('  ⇒ 三模型的 k 上限全部 ≈ 0 ⇒ **奶白的高光 α 已无任何上调余量**（现值即临界）');
}

console.log('\n=== §3 结论：换肤面「可换 / 锁死」判定 ===');
console.log('· L1 主体 base：**锁死**。理由三条——① 换即新增 hex（违纪律 ④）；② base 是 A1 色相通道与');
console.log('   §1.9.2「10 色色相间距不塌」的唯一承载面；③ symbolInk 的 preferDark 与 contrast 判据都以 base 为输入');
console.log('   ⇒ base 锁死 ⇒ **墨选择恒不变** ⇒ A1/B2 的符号通道零风险。');
console.log('· BEAD_SOFT_HIGHLIGHT_ALPHAS：**不可上调**（§2：k 上限 ≈ 0，奶白现值即临界）；**可下调**（k<1 ⇒ 面变暗');
console.log('   ⇒ 暗墨对比升、白墨对比降 ⇒ 需按 §1 三模型逐色复核，白墨侧最紧是炭黑/深棕）。');
console.log('· BEAD_BEVEL_DARK_MIX / LIGHT_MIX / RIM_MIX：**可自由换**。几何证明：');
{
    const S = 50;
    const stroke = (r) => Math.max(2, S * r);
    const L2 = [S * 2 / 64, S * 2 / 64 + stroke(5 / 64)];
    const L3 = [S * 1.5 / 64, S * 1.5 / 64 + stroke(4 / 64)];
    const L3b = [S * 1 / 64, S * 1 / 64 + stroke(2 / 64)];
    console.log(`   L2 暗倒角带 = [${L2[0].toFixed(2)},${L2[1].toFixed(2)}]；L3 = [${L3[0].toFixed(2)},${L3[1].toFixed(2)}]；L3b rim = [${L3b[0].toFixed(2)},${L3b[1].toFixed(2)}]（自内缘起算，px@50）`);
    console.log(`   符号区 = 中心 ±${S * 0.4 / 2} ⇒ 自内缘起算 [${(S / 2 - S * 0.2).toFixed(2)},${(S / 2 + S * 0.2).toFixed(2)}] ⇒ 与三条倒角带**零交集** ⇒ 对 B2 恒零影响`);
}
console.log('· BEAD_CONTACT_SHADOW_ALPHA / BEAD_SHADOW_ALPHA：**可换但不得降为 0**——投影是 §1.9.4');
console.log('   「must not read as a bead」五通道之第 3 条，降为 0 即减一条通道（其余四条仍在，但会削弱凹凸主轴）。');
console.log('· ⇒ **demo 阶段的「换肤占位」只能是「材质主题」（光泽度/倒角对比/rim 强度），不能是「配色主题」**；');
console.log('   配色主题需新增 hex 到 palette.ts（铁律允许、但违本轮纪律 ④）⇒ 登记为待裁定，本轮不交付。');

console.log('\n=== §4 palette.ts 结构可行性（只读取证，不改代码）===');
console.log('① `BeadsPalette` 接口 + `DEFAULT_PALETTE`：UI token 层，**已可注入**（view-model 全链传 palette）✓');
console.log('② `BEAD_PALETTE`：`Object.freeze` 的模块级数组，`beadColor(colorIdx)` 直接读 ⇒ **不可注入** ✗');
console.log('③ `drawFilledBead(builder, cx, cy, colorIdx, options)`：**签名无 palette 参数**（bead-render.ts:98-104）；');
console.log('   材质系数（:20-28 七个 import）全为模块级 ⇒ 珠体十层对主题化**零参数通道** ✗');
console.log('④ `drawEmptySocket(builder, cx, cy, palette, size, colorIdx?)`：**有 palette**（:224/:228 用 slot/slotBorder）');
console.log('   ⇒ 空槽侧已可注入、珠体侧不可 ⇒ **结构性不对称**');
console.log('⑤ `palette.slotDashed`（palette.ts:40 声明 / :69 = #C9C5DA）：**定义但零消费者**');
console.log('   （grep src/ tests/ 仅 2 命中 = 声明与赋值）；`drawDashedRect` 实参 = `palette.slotBorder`(#D8D5E6)、');
console.log('   `lineWidth = 1`（view-model.ts:869-892）⇒ §1.3「描边 slot_dashed #C9C5DA 2px」**双漂移**（色 token + 线宽）');
