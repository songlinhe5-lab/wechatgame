// WXG-T-182 · G-3 取证 任务③④ —— 求解器对照 / MISPLACED_BLOB_MAX 必要性 / 道具兜底。
// temp/ 临时件（非生产码）。机器人每一步都只经真链命令（见 g3-lib.runBot）。
// 运行：node --experimental-transform-types --import=./temp/g3-hooks.mjs temp/g3-solver.ts
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  blobAnchors,
  layoutBase,
  makeBoard,
  mount,
  runBot,
  TRAY_BASE_SLOTS,
  type BotResult,
  type DenseBoard,
  type LayoutKind,
} from './g3-lib.js';

const ROWS = 12;
const COLS = 12;
const N = ROWS * COLS;
void N;
const CAP = TRAY_BASE_SLOTS; // 12（玩法内有效容量，见 g3-repro §8）
const sub = (t: string): void => console.log(`\n── ${t}`);
const hr = (t: string): void => console.log(`\n══ ${t}`);

// ═════════════════════ A. 真实母版（spike 产物）的同色连通块几何 ═════════════════════
hr('§A 真实母版块几何（temp/beads-*/pattern.json；⛔ 旧 spike 含 void，非 12×12 密集）');
/** 母版底色 8 向连通块（脚本自有 BFS，仅用于**几何统计**，不参与任何玩法裁决）。 */
function baseBlobs(rows: string[], conn8 = true): { max: number; sizes: number[]; fillable: number; voids: number } {
  const R = rows.length;
  const C = rows[0]!.length;
  const at = (r: number, c: number): string => (r < 0 || c < 0 || r >= R || c >= C ? '#' : rows[r]![c]!);
  const seen = new Set<number>();
  const sizes: number[] = [];
  let fillable = 0;
  let voids = 0;
  const dirs = conn8
    ? [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
    : [[-1, 0], [0, -1], [0, 1], [1, 0]];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) {
      const ch = at(r, c);
      if (ch === '.' || ch === '#') {
        if (ch === '.') voids++;
        continue;
      }
      const key = r * C + c;
      if (seen.has(key)) continue;
      fillable++;
      let size = 0;
      const stack = [[r, c]];
      seen.add(key);
      while (stack.length) {
        const [cr, cc] = stack.pop()!;
        size++;
        for (const [dr, dc] of dirs) {
          if (at(cr + dr, cc + dc) !== ch) continue;
          const k2 = (cr + dr) * C + (cc + dc);
          if (seen.has(k2)) continue;
          seen.add(k2);
          stack.push([cr + dr, cc + dc]);
        }
      }
      sizes.push(size);
    }
  sizes.sort((a, b) => b - a);
  return { max: sizes[0] ?? 0, sizes, fillable, voids };
}
const spikeDirs = ['beads-out', 'beads-36', 'beads-48', 'beads-heart', 'beads-flower', 'beads-36-img1'];
for (const d of spikeDirs) {
  const f = join('temp', d, 'pattern.json');
  if (!existsSync(f)) continue;
  const j = JSON.parse(readFileSync(f, 'utf8')) as { pattern?: string[]; rows?: number; cols?: number };
  if (!j.pattern) continue;
  const b8 = baseBlobs(j.pattern, true);
  const b4 = baseBlobs(j.pattern, false);
  console.log(
    `${d}: ${j.pattern.length}x${j.pattern[0]!.length} 可填=${b8.fillable} void=${b8.voids} ` +
      `母版同色块 max(8向)=${b8.max} max(4向)=${b4.max} 前5=[${b8.sizes.slice(0, 5).join(',')}] ` +
      `≥${CAP} 的块=${b8.sizes.filter((s) => s >= CAP).length}/${b8.sizes.length}`,
  );
}
console.log('➡ 母版侧结论：条带/大图母版天然产生 ≫12 的同色连通块；void 在新模型下被取消 ⇒ 块只会更大（此表是**下界**）。');

// ═════════════════════ B. 合成密集盘 × 策略对照（死锁率 / 峰值占用）═════════════════
hr(`§B 策略对照（12×12 密集全错位 / 色数∈{4,6,8} / 布局 D；容量 cap=${CAP}）`);
interface Cfg {
  colors: number;
  kind: LayoutKind;
  blob?: number;
}
const cfgs: Cfg[] = [];
for (const colors of [4, 6, 8]) {
  for (const kind of ['stripes', 'rows', 'blocks', 'dither', 'snake'] as LayoutKind[]) {
    for (const blob of kind === 'snake' ? [4, 9, 20] : [0]) cfgs.push({ colors, kind, blob });
  }
}
const STRATS: { key: string; label: string; opt: Parameters<typeof runBot>[1] }[] = [
  { key: 'G+', label: 'a) 贪心取最大组 + 允许直填', opt: { allowDirectFill: true, retrieve: 'max' } },
  { key: 'G-', label: 'a) 贪心取最大组 · 禁用直填', opt: { allowDirectFill: false, retrieve: 'max' } },
  { key: 'T2+', label: 'b) 逐环周转(取回≤2) + 允许直填', opt: { allowDirectFill: true, retrieve: 'min', maxRetrieve: 2 } },
  { key: 'T2-', label: 'b) 逐环周转(取回≤2) · 禁用直填', opt: { allowDirectFill: false, retrieve: 'min', maxRetrieve: 2 } },
  { key: 'G-D', label: 'c) 贪心 · 禁直填 + 允许道具', opt: { allowDirectFill: false, retrieve: 'max', usePowerups: true } },
];
function boardOf(c: Cfg): DenseBoard | null {
  return makeBoard(ROWS, COLS, layoutBase(ROWS, COLS, c.colors, c.kind, 7, c.blob ?? 9));
}
const tally: Record<string, { clear: number; dead: number; peak: number; moves: number }> = {};
for (const s of STRATS) tally[s.key] = { clear: 0, dead: 0, peak: 0, moves: 0 };
console.log('配置(colors/kind/blob) | 实测块 max/块数≥cap | ' + STRATS.map((s) => s.key).join(' | '));
for (const c of cfgs) {
  const b = boardOf(c);
  if (!b) {
    console.log(`${c.colors}/${c.kind}/${c.blob ?? '-'} ⇒ derangeShift=null（COLOR_CAP 违规，生成器需回退）`);
    continue;
  }
  const k0 = mount(b);
  const blobs = blobAnchors(k0.game.grid).map((x) => x.size).sort((x, y) => y - x);
  const cells: string[] = [];
  for (const s of STRATS) {
    const k = mount(b);
    const r: BotResult = runBot(k.h, s.opt);
    tally[s.key]!.clear += r.cleared ? 1 : 0;
    tally[s.key]!.dead += r.cleared ? 0 : 1;
    tally[s.key]!.peak = Math.max(tally[s.key]!.peak, r.peakTray);
    tally[s.key]!.moves += r.moves;
    cells.push(`${r.cleared ? '通关' : '死锁'}(p${r.peakTray},m${r.moves})`);
  }
  console.log(
    `${c.colors}/${c.kind}/${c.blob ?? '-'} | max=${blobs[0]} ≥cap块数=${blobs.filter((x) => x >= CAP).length}/${blobs.length} | ` +
      cells.join(' | '),
  );
}
sub('策略汇总（配置数=' + cfgs.length + '）');
for (const s of STRATS) {
  const t = tally[s.key]!;
  console.log(
    `${s.label} ⇒ 通关 ${t.clear}/${t.clear + t.dead} 死锁率 ${((t.dead / (t.clear + t.dead)) * 100).toFixed(0)}% ` +
      `峰值托盘=${t.peak} 平均步数=${(t.moves / (t.clear + t.dead)).toFixed(0)}`,
  );
}

// ═════════════════════ C. 逐环周转的真实峰值占用（文策渊「峰值仅 2 颗」核实）═════════════════
hr('§C 「逐环周转」峰值托盘占用 vs 允许的取回上限 R');
for (const c of [cfgs[0]!, cfgs.find((x) => x.kind === 'dither' && x.colors === 4)!, cfgs.find((x) => x.kind === 'snake' && x.blob === 4)!]) {
  const b = boardOf(c);
  if (!b) continue;
  const k0 = mount(b);
  const maxBlob = blobAnchors(k0.game.grid).reduce((a, x) => Math.max(a, x.size), 0);
  const line: string[] = [];
  for (const R of [1, 2, 3, 4, 6, 8, 11, 12, CAP + 1]) {
    const k = mount(b);
    const r = runBot(k.h, { allowDirectFill: true, retrieve: 'min', maxRetrieve: R });
    line.push(`R=${R}:${r.cleared ? `通关p${r.peakTray}` : `死锁p${r.peakTray}`}`);
  }
  console.log(`${c.colors}/${c.kind}/${c.blob ?? '-'}（实测最大块=${maxBlob}） ${line.join(' ')}`);
}
console.log('➡ 读法：R = 玩家自愿的单次取回上限；R < 实测最大块 ⇒ **首步无珠可取**（真链只能整组收，无「只取 1 颗」入口），周转策略直接不可执行。');

// ═════════════════════ D. MISPLACED_BLOB_MAX 候选值反推 ═════════════════════
hr('§D 所需 MISPLACED_BLOB_MAX（生成器侧上限）：使「贪心取最大组 + 禁直填」仍可通关');
for (const c of cfgs) {
  const b = boardOf(c);
  if (!b) continue;
  const k0 = mount(b);
  const blobs = blobAnchors(k0.game.grid).map((x) => x.size);
  const max = Math.max(...blobs);
  const g = runBot(mount(b).h, { allowDirectFill: false, retrieve: 'max' });
  console.log(
    `${c.colors}/${c.kind}/${c.blob ?? '-'}: 实测最大块=${max} ≥${CAP}块数=${blobs.filter((s) => s >= CAP).length}/${blobs.length} ` +
      `禁直填贪心=${g.cleared ? '通关' : '死锁'} ⇒ 若采 MISPLACED_BLOB_MAX=${CAP - 1} 该母版${max >= CAP ? '**违规，需打散**' : '合规'}`,
  );
}

// ═════════════════════ E. 死锁率 vs 生成器块上限（扫更宽的盘族）═════════════════
hr('§E 块上限 B → 死锁率曲线（行主序等长条带盘族；按实测最大块分档）');
/** 行主序等长色条带（与 g3-repro §7 同一旋钮）。 */
function runLayout(rows: number, cols: number, colors: number, run: number): number[] {
  const n = rows * cols;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (Math.floor(i / run) % colors) + 1;
  return out;
}
interface Bucket {
  n: number;
  gFirst: number; // 首步即死锁
  gDead: number; // 贪心·禁直填最终死锁
  tDead: number; // 周转(R=cap-1)·禁直填最终死锁
  tp: number; // 周转峰值占用合计
}
const buckets = new Map<number, Bucket>();
for (const colors of [4, 6, 8]) {
  for (let run = 2; run <= 36; run++) {
    const b = makeBoard(ROWS, COLS, runLayout(ROWS, COLS, colors, run));
    if (!b) continue;
    const max = Math.max(...blobAnchors(mount(b).game.grid).map((x) => x.size));
    const bucket = Math.min(12, Math.max(2, max)); // ≥12 归为一档（首步必死）
    const e = buckets.get(bucket) ?? { n: 0, gFirst: 0, gDead: 0, tDead: 0, tp: 0 };
    e.n++;
    if (max >= CAP) e.gFirst++;
    if (!runBot(mount(b).h, { allowDirectFill: false, retrieve: 'max' }).cleared) e.gDead++;
    const t = runBot(mount(b).h, { allowDirectFill: false, retrieve: 'min', maxRetrieve: CAP - 1 });
    if (!t.cleared) e.tDead++;
    e.tp = Math.max(e.tp, t.peakTray);
    buckets.set(bucket, e);
  }
}
console.log(`实测最大块档 | 盘数 | 首步即死锁 | 贪心禁直填死锁 | 周转(R=11)禁直填死锁 | 周转峰值`);
for (const k of [...buckets.keys()].sort((a, b) => a - b)) {
  const e = buckets.get(k)!;
  const label = k === 12 ? '≥12' : String(k);
  console.log(
    `  B=${label} | ${e.n} | ${e.gFirst}/${e.n} (${((e.gFirst / e.n) * 100).toFixed(0)}%) | `
    + `${e.gDead}/${e.n} (${((e.gDead / e.n) * 100).toFixed(0)}%) | ${e.tDead}/${e.n} (${((e.tDead / e.n) * 100).toFixed(0)}%) | ${e.tp}`,
  );
}
console.log('➡ 读法：『B<12 ⇒ 安全』只对**首步**成立；多列显示“累计死锁”仍在低位发生 ⇒ 块上限是必要非充分。');
