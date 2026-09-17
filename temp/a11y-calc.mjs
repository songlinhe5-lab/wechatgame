// 一次性核算脚本（WXG-T-131 交叉收口单）：只读 palette 判例公式，不写任何产物。
const P = {
  slot: '#F7F6FB',
  ink: '#1E2033', // BEAD_SHADOW_HEX
};
const BEADS = [
  ['奶白', '#FDF6E9'], ['柠黄', '#FFD23F'], ['活力橙', '#F59B23'], ['草绿', '#3FBF6B'],
  ['玫红', '#E84C3D'], ['丁香紫', '#8E6FD9'], ['湖蓝', '#3D7BF5'], ['赭棕', '#A5652C'],
  ['深棕', '#6B3E1E'], ['炭黑', '#33333D'],
];
const parse = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
// palette.ts::mix(hex, amount) — amount<0 → black, >0 → white
const mix = (hex, amount) => { const [r, g, b] = parse(hex); const t = amount >= 0 ? 255 : 0; const k = Math.abs(amount); return toHex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k); };
// palette.ts::mixWith(a,b,t)
const mixWith = (a, b, t) => { const x = parse(a), y = parse(b); return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
// palette.ts::luminance — Rec.601 luma 0..1
const lum = (hex) => { const [r, g, b] = parse(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
// palette.ts::withAlpha 合成到不透明底
const over = (inkHex, alpha, groundHex) => { const i = parse(inkHex), g = parse(groundHex); return toHex(i[0] * alpha + g[0] * (1 - alpha), i[1] * alpha + g[1] * (1 - alpha), i[2] * alpha + g[2] * (1 - alpha)); };
const relLum = (hex) => { const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = parse(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const contrast = (a, b) => (Math.max(relLum(a), relLum(b)) + 0.05) / (Math.min(relLum(a), relLum(b)) + 0.05);
const f = (x, n = 3) => x.toFixed(n);

console.log('=== A. 灰度（Rec601 luma ×255）可辨性：empty 凹陷坑 S2 = mix(base,-0.14) ===');
const rows = BEADS.map(([n, hex]) => ({
  n, base: hex, lBase: lum(hex) * 255,
  S1: mix(hex, -0.30), lS1: lum(mix(hex, -0.30)) * 255,
  S2: mix(hex, -0.14), lS2: lum(mix(hex, -0.14)) * 255,
  S4: mix(hex, 0.20), lS4: lum(mix(hex, 0.20)) * 255,
  E1: mixWith(P.slot, hex, 0.42), lE1: lum(mixWith(P.slot, hex, 0.42)) * 255,
}));
for (const r of rows) console.log(`${r.n}\tbase ${r.base} L=${f(r.lBase,1)}\tS1 ${r.S1} L=${f(r.lS1,1)}\tS2 ${r.S2} L=${f(r.lS2,1)}\tS4 L=${f(r.lS4,1)}\t旧E1 ${r.E1} L=${f(r.lE1,1)}`);

console.log('\n=== B. S2 坑底 luma 排序 + 相邻差（阈值 = 本仓 ΔL 4% 判据 = 10.2/255）===');
const sorted = [...rows].sort((a, b) => b.lS2 - a.lS2);
for (let i = 0; i < sorted.length; i++) {
  const d = i === 0 ? null : sorted[i - 1].lS2 - sorted[i].lS2;
  console.log(`${f(sorted[i].lS2,1).padStart(6)}  ${sorted[i].n}${d === null ? '' : `   Δ上邻=${f(d,1)} ${d < 10.2 ? '❌不可辨' : '✓'}`}`);
}
console.log('\n=== C. 贪心最大可分离类（阈值 10.2）===');
let last = Infinity, classes = [], dropped = [];
for (const r of sorted) { if (last - r.lS2 >= 10.2) { classes.push(r.n); last = r.lS2; } else dropped.push(`${r.n}(与 ${classes[classes.length-1]} 差 ${f(last - r.lS2,1)})`); }
console.log(`可分离 ${classes.length} 类: ${classes.join(' / ')}`);
console.log(`无独立明度位 ${dropped.length} 色: ${dropped.join(' ; ')}`);

console.log('\n=== D. L0a 接触阴影 ΔL（α0.18 峰 / α0.12 静息）落在旧底(E1) vs 新底(S1 暗缘框) ===');
for (const r of rows) {
  const dOld18 = lum(r.E1) - lum(over(P.ink, 0.18, r.E1));
  const dOld12 = lum(r.E1) - lum(over(P.ink, 0.12, r.E1));
  const dNew18 = lum(r.S1) - lum(over(P.ink, 0.18, r.S1));
  const dNew12 = lum(r.S1) - lum(over(P.ink, 0.12, r.S1));
  const dNewS2 = lum(r.S2) - lum(over(P.ink, 0.18, r.S2));
  console.log(`${r.n}\t旧E1: 峰ΔL=${f(dOld18)} 摆动=${f(dOld18-dOld12)}\t新S1: 峰ΔL=${f(dNew18)} 摆动=${f(dNew18-dNew12)}\t降幅=${f((1-dNew18/dOld18)*100,0)}%\t(若落 S2: 峰ΔL=${f(dNewS2)})`);
}
console.log(`\n恢复旧 ΔL 所需 α（以活力橙 S1 为地）：`);
{
  const g = mix('#F59B23', -0.30); const target = lum(mixWith(P.slot, '#F59B23', 0.42)) - lum(over(P.ink, 0.18, mixWith(P.slot, '#F59B23', 0.42)));
  const Lg = lum(g), Li = lum(P.ink);
  const a = (Lg - (Lg - target)) / (Lg - Li);
  console.log(`目标 ΔL=${f(target)} ⇒ α = ${f(a,3)}（现值 0.18 ⇒ 需 +${f(a-0.18,3)}）`);
}

console.log('\n=== E. 咬合环 / 露缘环 对比（ink=mix(base,-0.30) vs 珠面 base）===');
for (const r of rows) console.log(`${r.n}\tring ${r.S1} on ${r.base} ⇒ WCAG ${f(contrast(r.S1, r.base),2)}:1  ΔL=${f(lum(r.base)-lum(r.S1))}`);

console.log('\n=== F. hint 环 vs wrong 环 灰度可辨（accent_blue vs danger）===');
{
  const hint = '#3D7BF5', wrong = '#E8434A';
  console.log(`accent_blue L=${f(lum(hint)*255,1)} / danger L=${f(lum(wrong)*255,1)} ⇒ Δ=${f(Math.abs(lum(hint)-lum(wrong))*255,1)} /255 (${f(Math.abs(lum(hint)-lum(wrong))*100,1)}%) WCAG=${f(contrast(hint,wrong),2)}:1`);
}

console.log('\n=== G. 图元核算（v1.22 可达构型）===');
const g = (h, socket) => (156 - h) * 10 + h * socket;          // 网格
const t = (h, socket) => h * 10 + (24 - h) * socket;            // 托盘槽
for (const [tag, sockOld, sockNew, panel] of [['v1.4(E1+E4,代码真值 托盘1/网格2)', 2, 1, 3], ['v1.5(凹陷四层,面板+3)', 4, 4, 6]]) {
  for (const h of [0, 8, 16]) {
    const total = g(h, tag.startsWith('v1.4') ? sockOld : sockNew) + t(h, tag.startsWith('v1.4') ? sockNew : sockNew) + 10 + panel;
    console.log(`${tag} h=${h}: 网格=${g(h, tag.startsWith('v1.4') ? sockOld : sockNew)} 托盘=${t(h, sockNew)} 背景/板=10 面板=${panel} ⇒ ${total}`);
  }
}
console.log('\n--- 2173 构型分解复核 ---');
console.log(`1810 = 3(bg)+7(plate)+1560(156×10)+240(24×10) = ${3+7+1560+240}`);
console.log(`+312(156×2 网格空槽) +48(24×2 托盘空槽) +3(面板内阴影) = ${1810+312+48+3}`);
console.log(`若托盘空槽旧值取代码真值 1（不传 colorIdx ⇒ 无 E4）⇒ Δ=+3/槽 ⇒ 24×3=72 ⇒ ${1810+312+72+3}`);
