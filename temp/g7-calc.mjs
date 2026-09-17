// WXG-T-131 追加核算：G7 D1 退化环 slot_border vs v1.5 S1 暗缘框
const BASE = [
  ['奶白','#FDF6E9'],['柠黄','#FFD23F'],['活力橙','#F59B23'],['草绿','#3FBF6B'],['玫红','#E84C3D'],
  ['丁香紫','#8E6FD9'],['湖蓝','#3D7BF5'],['赭棕','#A5652C'],['深棕','#6B3E1E'],['炭黑','#33333D'],
];
const h2r = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const r2h = (c) => '#' + c.map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0').toUpperCase()).join('');
const lum = (h) => { const [r,g,b] = h2r(h); return (0.299*r + 0.587*g + 0.114*b) / 255; };
const chan = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
const wcag = (a,b) => { const [r1,g1,b1]=h2r(a),[r2,g2,b2]=h2r(b);
  const L1 = 0.2126*chan(r1)+0.7152*chan(g1)+0.0722*chan(b1);
  const L2 = 0.2126*chan(r2)+0.7152*chan(g2)+0.0722*chan(b2);
  const hi = Math.max(L1,L2), lo = Math.min(L1,L2); return (hi+0.05)/(lo+0.05); };
const mix = (a,b,t) => { const A=h2r(a), B=h2r(b); return r2h(A.map((v,i)=>v+(B[i]-v)*t)); };

const RING = '#D8D5E6';   // palette.slotBorder（G7 D1 退化环墨）
const THR = 0.04 * 255;   // 本仓自判据：ΔL ≤ 4% = 刻意不可辨
console.log(`=== G7 D1 退化环 slot_border ${RING} (L×255=${(lum(RING)*255).toFixed(1)}) vs S1 暗缘框 mix(base,#000,0.30) ===`);
let bad = 0;
for (const [n,hex] of BASE) {
  const s1 = mix(hex, '#000000', 0.30);
  const dL = Math.abs(lum(RING) - lum(s1)) * 255;
  const ok = dL >= THR;
  if (!ok) bad++;
  console.log(`${n.padEnd(4)} S1=${s1} L×255=${(lum(s1)*255).toFixed(1).padStart(5)}  ΔL=${dL.toFixed(1).padStart(5)}  WCAG=${wcag(RING,s1).toFixed(2)}:1  ${ok?'✓ 可辨':'✗ 不可辨(<10.2)'}`);
}
console.log(`=> 10 色中 ${bad} 色下 G7 退化环与 S1 暗缘框灰度不可辨（阈值 ${THR.toFixed(1)}/255）`);

console.log('');
console.log('=== 对照：hint 环 accent_blue / wrong 环 danger vs S1（同法）===');
for (const [label, ink] of [['hint','#3D7BF5'],['wrong','#E8434A']]) {
  let b2 = 0;
  for (const [,hex] of BASE) { const s1 = mix(hex,'#000000',0.30); if (Math.abs(lum(ink)-lum(s1))*255 < THR) b2++; }
  console.log(`${label} ${ink} (L×255=${(lum(ink)*255).toFixed(1)}) ⇒ 10 色中 ${b2} 色与 S1 灰度不可辨`);
}

console.log('');
console.log('=== S1 露缘环 vs 珠面 base（任务 C：1px 露缘是否有色调分离）===');
for (const [n,hex] of BASE) {
  const s1 = mix(hex,'#000000',0.30);
  const dL = Math.abs(lum(s1)-lum(hex))*255;
  console.log(`${n.padEnd(4)} S1 on base ⇒ ΔL=${dL.toFixed(1).padStart(5)} (${(dL/255*100).toFixed(1)}%)  WCAG=${wcag(s1,hex).toFixed(2)}:1  ${dL>=THR?'✓':'✗'}`);
}
