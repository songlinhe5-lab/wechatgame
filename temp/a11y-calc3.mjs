const parse = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
const mix = (hex, a) => { const [r, g, b] = parse(hex); const t = a >= 0 ? 255 : 0; const k = Math.abs(a); return toHex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k); };
const lum = (hex) => { const [r, g, b] = parse(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const over = (ink, al, g) => { const i = parse(ink), q = parse(g); return toHex(i[0] * al + q[0] * (1 - al), i[1] * al + q[1] * (1 - al), i[2] * al + q[2] * (1 - al)); };
const f = (x, n = 3) => Number(x).toFixed(n);
const INK = '#1E2033', PLATE = '#FFFFFF', L_INK = lum(INK);
const B = [['奶白', '#FDF6E9'], ['柠黄', '#FFD23F'], ['活力橙', '#F59B23'], ['草绿', '#3FBF6B'], ['玫红', '#E84C3D'], ['丁香紫', '#8E6FD9'], ['湖蓝', '#3D7BF5'], ['赭棕', '#A5652C'], ['深棕', '#6B3E1E'], ['炭黑', '#33333D']];
const out = [], log = (s) => out.push(s);

log('=== J. L0a 落点改判：旧地 = 容器板 panel_surface #FFFFFF（v1.4 G1 期该格只画珠十层）===');
const o18 = lum(PLATE) - lum(over(INK, 0.18, PLATE)), o12 = lum(PLATE) - lum(over(INK, 0.12, PLATE));
log(`旧地 #FFFFFF：峰 ΔL(α0.18)=${f(o18)}  静息 ΔL(α0.12)=${f(o12)}  摆动=${f(o18 - o12)}`);
log('底色\tS1 hex\tL_S1\t余量 L_S1−L_ink\t新峰ΔL\t降幅\t新摆动\t恢复 α(需 ΔL=' + f(o18) + ')');
for (const [n, hex] of B) {
    const S1 = mix(hex, -0.30), head = lum(S1) - L_INK;
    const n18 = lum(S1) - lum(over(INK, 0.18, S1)), n12 = lum(S1) - lum(over(INK, 0.12, S1));
    const need = head > 0 ? o18 / head : Infinity;
    log(`${n}\t${S1}\t${f(lum(S1))}\t${f(head)}\t${f(n18)}\t${f((1 - n18 / o18) * 100, 0)}%\t${f(n18 - n12)}\t${need > 1 ? '不可达(>1)' : f(need, 3)}`);
}

log('\n=== K. A3 灰度可辨核算：v1.5 凹陷坑各层 luma(×255)，阈值 = 本仓自判据 ΔL≤4% ⇒ 10.2/255 ===');
const TH = 0.04 * 255;
for (const layer of [['S1 暗缘框', -0.30], ['S2 坑底', -0.14], ['S4 下受光', 0.20], ['base 目标色', 0]]) {
    const rows = B.map(([n, hex]) => ({ n, v: lum(mix(hex, layer[1])) * 255 })).sort((a, b) => b.v - a.v);
    log(`\n-- ${layer[0]}（mix ${layer[1]}）--`);
    log(rows.map((r) => `${r.n} ${f(r.v, 1)}`).join(' | '));
    const gaps = rows.slice(1).map((r, i) => ({ a: rows[i].n, b: r.n, d: rows[i].v - r.v }));
    log('相邻差：' + gaps.map((g) => `${f(g.d, 1)}${g.d < TH ? '❌' : ''}`).join(' / '));
    const cls = [];
    for (const r of rows) { const last = cls[cls.length - 1]; if (last && last.min - r.v < TH) { last.mem.push(r.n); last.min = r.v; } else { cls.push({ min: r.v, mem: [r.n] }); } }
    log(`阈值 ${f(TH, 1)}/255 下可分离类数 = ${cls.length}（需 10）⇒ ` + cls.map((c) => `{${c.mem.join(',')}}`).join(' '));
    log('落榜（无独立明度位）：' + cls.filter((c) => c.mem.length > 1).map((c) => c.mem.slice(1).join('/')).join('、'));
}

log('\n=== L. 凹凸形态能否区分「哪个色的空槽」：空 vs 珠 的形态对比 vs 色间对比 ===');
{
    const n = '活力橙', hex = '#F59B23';
    const S1 = lum(mix(hex, -0.30)) * 255, S2 = lum(mix(hex, -0.14)) * 255, S4 = lum(mix(hex, 0.20)) * 255, bs = lum(hex) * 255;
    const L1 = bs, L2 = lum(mix(hex, -0.26)) * 255, L3 = lum(mix(hex, 0.20)) * 255, L3b = lum(mix(hex, 0.38)) * 255;
    log(`${n}：坑 S1=${f(S1, 1)} S2=${f(S2, 1)} base=${f(bs, 1)} S4=${f(S4, 1)}  ⇒ 坑内最大跨度 S4−S1 = ${f(S4 - S1, 1)}/255`);
    log(`${n}：珠 L2=${f(L2, 1)} L1=${f(L1, 1)} L3=${f(L3, 1)} L3b=${f(L3b, 1)} ⇒ 珠内最大跨度 L3b−L2 = ${f(L3b - L2, 1)}/255`);
    log(`空 vs 珠（同色）主体面比较：坑底 S2 ${f(S2, 1)} vs 珠主体 L1 ${f(L1, 1)} ⇒ Δ=${f(L1 - S2, 1)}/255（= 0.14×L，恒可辨）`);
    log(`色间比较（同为坑底 S2）：最大 ${f(212.1 - 44.8, 1)}、最小相邻 ${f(2.2, 1)}/255 ⇒ 3 对 < 阈值 ${f(TH, 1)}`);
    log('⇒ 形态通道（凹 vs 凸）区分「空/珠」= 1 bit；色间区分需 10 位 ⇒ 形态不承载色序号');
}

log('\n=== M. 咬合环（ink=mix(底色,−0.30), α=1）在 90 个错位有序对上的灰度可辨性 ===');
{
    const ds = [];
    for (const [, ground] of B) for (const [, bead] of B) { if (ground === bead) continue; ds.push(Math.abs(lum(bead) - lum(mix(ground, -0.30))) * 255); }
    ds.sort((a, b) => a - b);
    const below = ds.filter((d) => d < TH).length;
    log(`n=${ds.length} 最小=${f(ds[0], 1)} 中位=${f(ds[Math.floor(ds.length / 2)], 1)} 最大=${f(ds[ds.length - 1], 1)} /255；低于阈值 ${f(TH, 1)} 的对数=${below}（${f(below / ds.length * 100, 0)}%）`);
}

log('\n=== N. 图元：G1 并发上限（v1.22 解环器链式）===');
{
    const gate = 120, step = 80;
    log(`单条 G1 = ${gate}ms；解环器逐颗间隔 = ${step}ms ⇒ 同帧并发 = ceil(${gate}/${step}) = ${Math.ceil(gate / step)}`);
    log(`⇒ 网格侧 S1 露缘环最坏同帧 = ${Math.ceil(gate / step)} 层（每颗 +1）；若无输入门叠加玩家取回落槽 ⇒ ${Math.ceil(gate / step) + 1}`);
}
console.log(out.join('\n'));
