const parse = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
const mix = (hex, a) => { const [r, g, b] = parse(hex); const t = a >= 0 ? 255 : 0; const k = Math.abs(a); return toHex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k); };
const mixWith = (a, b, t) => { const x = parse(a), y = parse(b); return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
const lum = (hex) => { const [r, g, b] = parse(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const over = (ink, al, g) => { const i = parse(ink), q = parse(g); return toHex(i[0] * al + q[0] * (1 - al), i[1] * al + q[1] * (1 - al), i[2] * al + q[2] * (1 - al)); };
const rel = (hex) => { const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = parse(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const cr = (a, b) => (Math.max(rel(a), rel(b)) + 0.05) / (Math.min(rel(a), rel(b)) + 0.05);
const f = (x, n = 3) => Number(x).toFixed(n);
const SLOT = '#F7F6FB', INK = '#1E2033';
const B = [['奶白', '#FDF6E9'], ['柠黄', '#FFD23F'], ['活力橙', '#F59B23'], ['草绿', '#3FBF6B'], ['玫红', '#E84C3D'], ['丁香紫', '#8E6FD9'], ['湖蓝', '#3D7BF5'], ['赭棕', '#A5652C'], ['深棕', '#6B3E1E'], ['炭黑', '#33333D']];
const out = [];
const log = (s) => out.push(s);

log('=== D. L0a 接触阴影 ΔL：旧底(E1 粉彩 0.42) vs 新底(S1 暗缘框 −0.30) ===');
for (const [n, hex] of B) {
    const E1 = mixWith(SLOT, hex, 0.42), S1 = mix(hex, -0.30), S2 = mix(hex, -0.14);
    const o18 = lum(E1) - lum(over(INK, 0.18, E1)), o12 = lum(E1) - lum(over(INK, 0.12, E1));
    const n18 = lum(S1) - lum(over(INK, 0.18, S1)), n12 = lum(S1) - lum(over(INK, 0.12, S1));
    const s18 = lum(S2) - lum(over(INK, 0.18, S2));
    log(`${n}\t旧E1 峰ΔL=${f(o18)} 摆动=${f(o18 - o12)}\t新S1 峰ΔL=${f(n18)} 摆动=${f(n18 - n12)}\t降幅=${f((1 - n18 / o18) * 100, 0)}%\t落S2 峰ΔL=${f(s18)}`);
}
{
    const hex = '#F59B23', S1 = mix(hex, -0.30), E1 = mixWith(SLOT, hex, 0.42);
    const target = lum(E1) - lum(over(INK, 0.18, E1));
    const a = target / (lum(S1) - lum(INK));
    log(`\n恢复旧峰 ΔL=${f(target)} 所需 α（以活力橙 S1 ${S1} 为地，ink ${INK} L=${f(lum(INK))}）= ${f(a, 3)} ⇒ 需 0.18 → ${f(a, 2)}（+${f(a - 0.18, 2)}）`);
}

log('\n=== E. 咬合环/露缘环（ink = mix(底色,−0.30)）对珠面 base 的对比 ===');
for (const [n, hex] of B) log(`${n}\tring ${mix(hex, -0.30)} on ${hex} ⇒ WCAG ${f(cr(mix(hex, -0.30), hex), 2)}:1  ΔL=${f(lum(hex) - lum(mix(hex, -0.30)))}`);
log('环墨对**错位**珠面（底色≠珠色）示例：底色活力橙环 on 湖蓝珠 ⇒ WCAG ' + f(cr(mix('#F59B23', -0.30), '#3D7BF5'), 2) + ':1 ΔL=' + f(Math.abs(lum('#3D7BF5') - lum(mix('#F59B23', -0.30)))));

log('\n=== F. hint 环(accent_blue) vs wrong 环(danger) 灰度 ===');
log(`accent_blue #3D7BF5 L=${f(lum('#3D7BF5') * 255, 1)} / danger #E8434A L=${f(lum('#E8434A') * 255, 1)} ⇒ Δ=${f(Math.abs(lum('#3D7BF5') - lum('#E8434A')) * 255, 1)}/255 = ${f(Math.abs(lum('#3D7BF5') - lum('#E8434A')) * 100, 2)}% ; WCAG=${f(cr('#3D7BF5', '#E8434A'), 2)}:1`);

log('\n=== G. 图元核算（口径 = 规格层数，同 §1.8）===');
const BG = 3, PLATE = 7;
function total(h, sockGrid, sockTray, panel, gridCells = 156, traySlots = 24) {
    const g = (gridCells - h) * 10 + h * sockGrid;
    const t = h * 10 + (traySlots - h) * sockTray;
    return { g, t, sum: g + t + BG + PLATE + panel };
}
log('v1.4 材质（网格空槽=E1底+E4符号 计 2；托盘空槽=中性 rect 计 1（代码真值：不传 colorIdx ⇒ 无 E4）；面板 3）');
for (const h of [0, 8, 16]) { const r = total(h, 2, 1, 3); log(`  h=${h}: 网格=${r.g} 托盘=${r.t} ⇒ ${r.sum}`); }
log('v1.5 材质（凹陷四层：网格/托盘空槽各 4；面板 3+3=6）');
for (const h of [0, 8, 16]) { const r = total(h, 4, 4, 6); log(`  h=${h}: 网格=${r.g} 托盘=${r.t} ⇒ ${r.sum}`); }
log('⇒ v1.5 − v1.4：h=0 ' + (total(0, 4, 4, 6).sum - total(0, 2, 1, 3).sum) + ' / h=8 ' + (total(8, 4, 4, 6).sum - total(8, 2, 1, 3).sum) + ' / h=16 ' + (total(16, 4, 4, 6).sum - total(16, 2, 1, 3).sum));
log('\n2173 构型分解：1810 = 3+7+1560+240 = ' + (3 + 7 + 1560 + 240) + '；+312(156×2)+48(24×2)+3 = ' + (1810 + 312 + 48 + 3));
log('若托盘空槽旧值取代码真值 1 ⇒ Δ=+3/槽 ⇒ ' + (1810 + 312 + 72 + 3));
log('「全空网格」在 v1.22 下不可达：开局满盘（swaps 交换不空格），空格数 = 手持珠数 h ≤ 2·MISPLACED_PAIRS_MAX = 16');

log('\n=== H. 庆祝期（h=0，全格就位）v1.5 真值 ===');
{
    const stat = total(0, 4, 4, 6).sum;
    const wave = 156 * 6 + 24 * 4 + BG + PLATE + 6 + 44;
    log(`静态=${stat}（网格 1560 + 托盘 96 + 10 + 6）；庆祝期(G4 六层 936 + G6 44)=${wave} ⇒ 净 ${wave - stat}`);
    const wave3 = 156 * 6 + 24 * 4 + BG + PLATE + 6 + 24;
    log(`启阀③(44→24)=${wave3} ⇒ 净 ${wave3 - stat}`);
}
log('\n=== I. 落座期 S1 露缘环可见窗（scale 穿越 1.00 的时刻）===');
{
    // 压下段 scale = 1.06 − 0.10·easeOut(t/40)，easeOut(u)=1−(1−u)²
    const u = 1 - Math.sqrt(1 - 0.6);           // easeOut(u)=0.6 ⇒ scale=1.00
    log(`压下段 scale=1.00 ⇔ easeOut(u)=0.6 ⇔ u=${f(u, 4)} ⇔ t=${f(u * 40, 1)}ms ⇒ 露缘窗 t∈[${f(u * 40, 1)},120]ms（占窗口 ${f((120 - u * 40) / 120 * 100, 0)}%）`);
    log(`t=40ms 谷 scale 0.96 ⇒ 珠 48px、S1 50px ⇒ 露缘宽 (50−48)/2 = 1.0px；S2 坑 44px ⇒ 被珠全覆盖（48>44，余量 2px/边）`);
    log(`S3 线宽 max(2,50×0.05)=${Math.max(2, 50 * 0.05)}px、S4 max(2,50×0.04)=${Math.max(2, 50 * 0.04)}px，均贴 S2 坑内缘（坑 44 ⇒ 内缘带 y∈[3,7]/[43,47]）⇒ 珠 48px(y∈[1,49]) 全覆盖`);
    log(`托盘侧：S=48 ⇒ S1 48、S2 坑 48×0.94=${f(48 * 0.94, 1)}；托盘珠 TRAY_BEAD_SIZE=48−4=44 ⇒ 静息即露 S1 环 (48−44)/2=2.0px、S2 环 (45.1−44)/2=${f((48 * 0.94 - 44) / 2, 2)}px`);
}
console.log(out.join('\n'));
