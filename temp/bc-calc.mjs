// WXG-T-131 任务 B/C 核算（口径 = 规格层数，同 assets-spec §1.8）
// 冻结真值：BEAD_CELL 50 / BEAD_PITCH 52 / TRAY_SLOT 48 / TRAY_BEAD 44 /
//          网格 13×12 = 156 / TRAY_BASE 12 + TRAY_EXPAND 12 = 24 /
//          MISPLACED_PAIRS_MAX 8 => 错位珠 <= 16 / SOLVER_PLUS_COUNT 3
const L = (s) => console.log(s);

// ── 基线构成 ────────────────────────────────────────────
const BG = 3;          // §1.8 背景 G1-G4（G1 background 计 1 + 3 叠层）
const PLATE = 7;       // §1.7 容器板 + 暖光 band B1-B6(+stroke)
const PANEL_V14 = 3;   // §1.3 托盘面板（投影/板体/描边）
const PANEL_V15 = 6;   // + 3 段内阴影（§1.9.5）
const FILLED = 10, EMPTY_V14 = 2, EMPTY_V15 = 4, DASHED = 1;

L('=== 基线 A / A′ / B / C 构成 ===');
const A = BG + PLATE + 156 * FILLED + 24 * FILLED;                    // 1810（面板未计）
L(`A  (v1.4 记账原文，托盘面板未计)      = ${BG}+${PLATE}+${156*FILLED}+${24*FILLED} = ${A}`);
const Ap = A + PANEL_V14;
L(`A′ (v1.4 补计托盘面板 3)              = ${A}+${PANEL_V14} = ${Ap}`);
const B = A + 156 * (EMPTY_V15 - EMPTY_V14) + 24 * (EMPTY_V15 - EMPTY_V14) + (PANEL_V15 - PANEL_V14);
L(`B  (v1.5 松上界 = A + 全格 empty 增量) = ${A}+${156*2}+${24*2}+${3} = ${B}`);
L(`   B 亦 = A′ + ${156*2 + 24*2} = ${Ap + 360}`);

// 基线 C：v1.5 材质 + v1.22 玩法（网格 filled 与托盘持珠互为消长）
function C(h, expanded) {
  const gridEmpty = h;                                  // v1.22：空格数 = 手持珠数
  const grid = (156 - gridEmpty) * FILLED + gridEmpty * EMPTY_V15;
  const traySlots = expanded ? 24 : 12;
  const tray = h * FILLED + (traySlots - h) * EMPTY_V15 + (expanded ? 0 : 12 * DASHED);
  return { grid, tray, total: BG + PLATE + PANEL_V15 + grid + tray };
}
L('');
L('=== 基线 C（v1.5 材质 + v1.22 构型，已扩展 24 实槽）===');
for (const h of [0, 8, 16]) {
  const r = C(h, true);
  L(`h=${String(h).padStart(2)} : 网格=${r.grid} 托盘=${r.tray} 总=${r.total}`);
}
L(`=> h 不变量成立（−6h/+6h 相消）⇒ 基线 C = ${C(0,true).total}`);
L(`未扩展（12 实槽 + 12 虚线槽）：h=0 总=${C(0,false).total}，h=16 总=${C(16,false).total}`);
L(`v1.4 材质同构型对照：h=0 = ${BG+PLATE+PANEL_V14+156*FILLED+24*EMPTY_V14}` +
  `（托盘空槽按规格 2 层）；按代码真值 1 层 = ${BG+PLATE+PANEL_V14+156*FILLED+24*1}`);

// ── 任务 B：T-128 四净值在三基线上的机械重算 ──────────────
L('');
L('=== 任务 B：净值重算（净值 = 增量，与基线无关；绝对值 = 基线 + 净值）===');
const nets = [
  ['道具期·规格口径（阀②启用）', +3 + 96 - 240],
  ['道具期·本轮落码口径',        +3],
  ['庆祝期（G4 六层 + G6 44）',  -624 + 44],
  ['庆祝期·若再启阀③（44→24）',  -624 + 24],
];
for (const base of [['1810', A], ['2173', B], ['1672', C(0,true).total]]) {
  L(`-- 基线 ${base[0]} --`);
  for (const [n, d] of nets) L(`   ${n.padEnd(28)} 净 ${String(d).padStart(4)}  绝对 ${base[1] + d}`);
}

// ── 任务 B：v1.22 真实构型下的净值（解环器，托盘零读写）────
L('');
L('=== v1.22 解环器期真值（基线 C；批量上限 = SOLVER_PLUS_COUNT 3，非旧 24）===');
const ring = 1;                        // 「错位珠高亮闪 1 次」候选 = 1 层描边环/颗（待裁定）
const popConcurrent = Math.ceil(120 / 80);
L(`高亮闪 ≤ ${3}颗 × ${ring} 层 = ${3*ring}`);
L(`G1 并发 = ceil(120ms / 80ms 间隔) = ${popConcurrent} ⇒ 露缘 S1 +${popConcurrent}`);
L(`=> 解环器期净（最坏）= +${3*ring + popConcurrent}；绝对 = ${C(0,true).total + 3*ring + popConcurrent}`);
L(`旧 T-128 道具期批量 24 的依据（region≤6/random≤5/clearAll≤24）已随 REGION_CLEAR_SLOTS/RANDOM_CLEAR_COUNT ⛔作废`);
L(`且错位珠总数 ≤ 2×MISPLACED_PAIRS_MAX = 16 < 24 ⇒ 即使按旧语义，24 亦不可达`);

// ── G2 溶解：96 的双重语义 ────────────────────────────────
L('');
L('=== G2「240→96」语义核查 ===');
L(`v1.4 LOD 后半（τ∈(80,200)）= 24 × 4 层【降档珠 L1+L2+L3+L5】= ${24*4}`);
L(`v1.4 终态（τ≥200，槽 free）= 24 × ${EMPTY_V14} 层【E1 混色底 + E4】= ${24*EMPTY_V14}`);
L(`v1.5 终态（τ≥200，槽 free）= 24 × ${EMPTY_V15} 层【S1-S4 凹坑】= ${24*EMPTY_V15}  <= 与 LOD 后半数值巧合相同`);
L(`=> v1.5 使【终态】由 ${24*EMPTY_V14} 变 ${24*EMPTY_V15}（+${24*EMPTY_V15-24*EMPTY_V14}），而【LOD 后半】仍是 ${24*4} ⇒ 必须分行列`);

// ── 任务 C：G1 落座期图元与露缘几何 ────────────────────────
L('');
L('=== 任务 C：S1 露缘几何（网格 BEAD_CELL 50 / 托盘 TRAY_SLOT 48）===');
const troughs = [1.06, 1.00, 0.96, 0.94, 0.92];
for (const s of troughs) {
  const bead = 50 * s;
  const wGrid = (50 - bead) / 2;
  const trayBead = 44 * s, wTray = (48 - trayBead) / 2;
  L(`scale ${s.toFixed(2)} : 网格珠 ${bead.toFixed(2)}px ⇒ S1 露缘 ${wGrid.toFixed(2)}px` +
    `（${wGrid >= 2 ? '≥2 ✓' : '<2 ✗ 亚地板'}）｜托盘珠 ${trayBead.toFixed(2)}px ⇒ 露缘 ${wTray.toFixed(2)}px` +
    `（${wTray >= 2 ? '≥2 ✓' : '<2 ✗'}）`);
}
L(`托盘静息（scale 1.00）：珠 44 / 槽 S1 48 ⇒ 露缘恒 ${(48-44)/2}px（≥2 ✓）；S2 坑 48×0.94=${(48*0.94).toFixed(2)} ⇒ 露 ${(48*0.94-44)/2}px`);
L(`网格静息：珠 50 = S1 50、同 radius round(50×0.22)=11 ⇒ 轮廓精确重合 ⇒ 露缘 0px`);
L(`scale=1.00 穿越时刻：压下段 1.06−0.10·easeOut(t/40)=1.00 ⇒ easeOut=0.6 ⇒ u=1−√0.4=${(1-Math.sqrt(0.4)).toFixed(4)} ⇒ t=${(40*(1-Math.sqrt(0.4))).toFixed(2)}ms`);
L(`露缘窗占比 = (120−${(40*(1-Math.sqrt(0.4))).toFixed(2)})/120 = ${((120-40*(1-Math.sqrt(0.4)))/120*100).toFixed(1)}%`);

L('');
L('=== 任务 C：图元自算（三种退场方案对比）===');
const schemes = [
  ['方案甲·可见性剔除（推荐）', '段0 s>1.00: 10 层；段1 s<1.00: 1(S1)+10 = 11 层', 1],
  ['方案乙·四层全帧淡出',       '全窗 4+10 = 14 层', 4],
  ['方案丙·四层立即消失(v1.4旧)', '全窗 10 层', 0],
];
for (const [n, d, inc] of schemes) {
  L(`${n}：${d} ⇒ 动画期增量 vs filled 静息 10 = +${inc}/颗；并发 2 ⇒ +${inc*2}；含玩家手动叠加 3 ⇒ +${inc*3}`);
}
L(`状态转换（放置瞬间 empty 4 → filled 10）= +6，属状态迁移、不属动画期增量（与 §1.8 静态基线口径一致）`);

// ── A5 间隙复核（trough 若改 0.92）─────────────────────────
L('');
L('=== A5 间隙复核：trough 0.96 vs 0.92（若采纳回退阀）===');
for (const s of [1.06, 0.96, 0.92]) {
  const half = 50 * s / 2;
  L(`scale ${s}: 半宽 ${half} + 静止邻珠半宽 25 = ${(half+25).toFixed(2)} vs pitch 52 ⇒ 间隙 ${(52-half-25).toFixed(2)}px`);
}
L(`符号 stroke 兜底：max(2, 50×0.92×3/64) = max(2, ${(50*0.92*3/64).toFixed(2)}) = ${(50*0.92*3/64).toFixed(2)}`);
