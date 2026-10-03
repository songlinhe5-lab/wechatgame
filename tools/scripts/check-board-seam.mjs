#!/usr/bin/env node
/**
 * check-board-seam.mjs — 盘面 B0 底图「接缝白线」守卫（WXG-T-235 / 判例 K-091）。
 *
 * ## 为什么有这个门
 * 修前 B0 底图按「边长 = 格距、边缘恰好重合」绘制 => 相邻 rect 的 AA 边缘在分数设备像素上
 * 合计覆盖不足 100% => 缝里漏出底下约 20% 的浅色板 => 格边界出现 1 设备px 亮线（实测 `edge`
 * 色 lum 97.8 -> 缝 lum 132，三通道解混合一致）。修法 = 每边外扩 `TILE_BLEED = 0.5` 设计px
 * （相邻重叠 1 设计px）。**该修复横跨「布局格距 / 命中判定 / 珠体边长」三层，极易在后续重构里
 * 被无意改掉** => 本门把「口径不被改回」变成机械断言。
 *
 * ## 两种模式
 * - **默认（静态口径门，无浏览器依赖）** => 进 `verify`。纯读源码 + 算术，
 *   **无 Chrome / 无 harness server** => CI 可跑（本仓 CI 无 Chrome）。
 * - **`--pixels`（像素复验，需本地 Chrome + harness 跑在 :4173）** => **不挂 verify**
 *   （CI 无浏览器 => 挂进去必假红）。
 *
 * ## 纪律：守卫必须能红（K-089）
 * 落码时已逐条实测能红：1) `TILE_BLEED` 改 0  2) 去掉 `drawTargetTile` 的外扩
 * 3) 测试口径改回字面量格距 —— 三种改法各自被捕获（读数见 T-235 详情节）。
 *
 * USAGE
 *   node tools/scripts/check-board-seam.mjs              # 静态口径门（进 verify）
 *   node tools/scripts/check-board-seam.mjs --pixels     # 像素复验（需 Chrome + harness）
 *
 * 退出码：0 = OK；1 = FAIL；2 = 像素模式缺前置。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readPngRgba } from '../mask-preview/lib/png-rgba.mjs';
import { ROOT } from './lib/context-index.mjs';

const argv = process.argv.slice(2);
const PIXELS = argv.includes('--pixels');
const optNum = (name) => {
  const hit = argv.find((x) => x.startsWith(`--${name}=`));
  return hit ? Number(hit.slice(name.length + 3)) : undefined;
};

const TUNING = 'games/beads/src/config/tuning.ts';
const RENDER = 'games/beads/src/view/bead-render.ts';
const TESTS = 'games/beads/tests';
const D_MARGIN = 20;   // 像素判据：超过 B0 底色中位多少算「亮」
const F_MIN = 0.5;     // 像素判据：亮行占比下限（缝贯穿全高 => 约 1.0；珠子高光远小于此）
const W_MAX = 4;       // 像素判据：缝列组宽度上限（更宽 = 盘外页边/面板缘，不是缝）

const problems = [];
const notes = [];
const fail = (id, msg) => problems.push({ id, msg });

/** C1 · `TILE_BLEED` 存在且 > 0（防「改回 0」——那正好是修前行为）。 */
function checkBleedPositive() {
  const src = readFileSync(join(ROOT, TUNING), 'utf8');
  const m = src.match(/export const TILE_BLEED\s*=\s*([\d.]+)\s*;/);
  if (!m) { fail('C1', `${TUNING} 找不到 \`export const TILE_BLEED = <数>;\``); return null; }
  const v = Number(m[1]);
  if (!(v > 0)) { fail('C1', `TILE_BLEED = ${m[1]}（必须 > 0；= 0 即修前行为，接缝白线会回来）`); return null; }
  notes.push(`C1 OK  TILE_BLEED = ${m[1]}（每边设计px）`);
  return v;
}

/** C2 · `drawTargetTile` 真用了外扩 + 常量同源导入（防「常量在、函数不用」）。 */
function checkDrawUsesBleed() {
  const src = readFileSync(join(ROOT, RENDER), 'utf8');
  const i = src.indexOf('export function drawTargetTile');
  if (i < 0) { fail('C2', `${RENDER} 找不到 drawTargetTile`); return; }
  const body = src.slice(i, src.indexOf('\n}', i));
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // ⚠ 乘法顺序无关：实现写的是 `size + TILE_BLEED * 2`，早先只匹配 `2 * TILE_BLEED`
  //    ⇒ **守卫误报过一次**（真实现被判红）。口径门必须匹配语义而非写法。
  if (!/size\s*\+\s*(?:2\s*\*\s*TILE_BLEED|TILE_BLEED\s*\*\s*2)/.test(code)) {
    fail('C2', 'drawTargetTile 未按 `size + 2 * TILE_BLEED` 外扩（绘制宽 = 格距 => 修前行为）');
    return;
  }
  if (!/from '\.\.\/config\/tuning\.js'/.test(src)) {
    fail('C2', 'bead-render.ts 未从 config/tuning.js 导入（TILE_BLEED 来源须同源）');
    return;
  }
  notes.push('C2 OK  drawTargetTile 按 `size + 2 * TILE_BLEED` 外扩，且常量同源导入');
}

/** C3 · 相邻重叠 = 2 x TILE_BLEED >= 1 **设计px**。
 *  ⚠️ 口径澄清：重叠的**设备**像素 = `zoom × dpr` ⇒ 只有 `zoom × dpr >= 1` 才够 1 设备px。
 *  本断言守的是**设计域地板**（外扩量不许被悄悄减到 0.2/0.4 那一档），
 *  ⛔ 不是「保证盖住 1 设备px」—— 后者尚未建立（实测接缝只在 zoom 1.0 出现，见 K-091 追记）。 */
function checkOverlapEnough(bleed) {
  if (bleed === null) return;
  const overlap = bleed * 2;
  if (overlap < 1) {
    fail('C3', `相邻重叠 ${overlap} 设计px < 1 => dpr=1 时不足 1 设备px，盖不住实测的 1px AA 缝`);
    return;
  }
  notes.push(`C3 OK  相邻重叠 ${overlap} 设计px（设备像素 = zoom x dpr；本断言守设计域地板）`);
}

/** C4 · B0 tile 宽度判据不再用「字面量格距」（那道过滤器曾静默退化为空断言）。 */
function checkNoLiteralPitchJudge() {
  const dir = join(ROOT, TESTS);
  const bad = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts')) continue;
    const lines = readFileSync(join(dir, f), 'utf8').split('\n');
    for (let n = 0; n < lines.length; n++) {
      if (!/\bw\s*===\s*(BEAD_PITCH|[A-Za-z_.]*gridPitch)/.test(lines[n])) continue;
      if (/TILE_BLEED|B0_TILE_PX/.test(lines[n])) continue; // 已跟绘制边长
      bad.push(`${f}:${n + 1}  ${lines[n].trim().slice(0, 78)}`);
    }
  }
  if (bad.length) {
    fail('C4', `B0 tile 宽度判据又用回字面量格距（会筛不出 tile => 静默空断言）：\n     - ${bad.join('\n     - ')}`);
    return;
  }
  notes.push('C4 OK  B0 tile 宽度判据均跟绘制边长（无字面量格距硬判）');
}

/**
 * 像素复验（`--pixels`）：真拍图量「缝列」。
 *
 * 板面锚点 = **饱和红珠子行**（画面里唯一饱和红，不会与页底 238 / 白面板 255 / 托盘槽 68 混淆）。
 * ⚠ 这条锚点是三版踩坑后定下的：v1「暗像素最多的行」在低倍率会选中缩放滑杆那一行、
 * v3「全图主色」被页底抢占。它对**低倍率灵敏度偏低**（珠子会打断整列）⇒ 低倍率档位读数偏弱。
 */
function pixelsCheck() {
  const zArg = optNum('zoom');
  const dArg = optNum('dpr');
  const zooms = Number.isFinite(zArg) ? [zArg] : [1.0];
  const dprs = Number.isFinite(dArg) ? [dArg] : [1, 2];
  const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!existsSync(CHROME)) {
    console.error(`X 找不到 Chrome（CHROME_PATH 可覆盖）：${CHROME}`);
    console.error('  => 像素模式**不挂 verify**（本仓 CI 无浏览器，挂进去必假红）。');
    return 2;
  }
  const rows = [];
  for (const d of dprs) {
    for (const z of zooms) {
      const out = `/tmp/wxg-seam-${z}-${d}.png`;
      try {
        execFileSync(CHROME, [
          '--headless=new', '--disable-gpu', '--hide-scrollbars',
          `--force-device-scale-factor=${d}`, '--window-size=420,900',
          '--virtual-time-budget=7000', `--screenshot=${out}`,
          `http://localhost:4173/?game=beads&dbg=off&zoom=${z}`,
        ], { stdio: 'ignore' });
      } catch (e) {
        console.error(`X 截图失败（zoom=${z} dpr=${d}）：${e.message}`);
        console.error('  前提：harness 须在跑（pnpm run harness）且已构建（pnpm run harness:build）。');
        return 2;
      }
      const { width: W, height: H, data } = readPngRgba(out);
      const px = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
      const lum = (x, y) => { const [r, g, b] = px(x, y); return 0.299 * r + 0.587 * g + 0.114 * b; };
      let best = -1e9, by = -1;
      for (let y = 100; y < H - 120; y++) {
        let red = 0;
        for (let x = 0; x < W; x += 2) { const [r, g, b] = px(x, y); if (r - (g + b) / 2 > 40) red++; }
        if (red > best) { best = red; by = y; }
      }
      if (by < 0 || best < 8) { rows.push({ z, d, nSeam: -1, dmax: 0, note: '未识别珠子行（无判别力）' }); continue; }
      const y0 = Math.max(0, by - 12), y1 = Math.min(H - 1, by + 12);
      const all = [];
      for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x += 2) all.push(lum(x, y));
      all.sort((a, b) => a - b);
      const med = all[all.length >> 1];
      const cols = [];
      for (let x = 0; x < W; x++) {
        let hit = 0, peak = 0;
        for (let y = y0; y <= y1; y++) { const v = lum(x, y); if (v > med + D_MARGIN) hit++; if (v > peak) peak = v; }
        if (hit / (y1 - y0 + 1) >= F_MIN && peak - med >= D_MARGIN) cols.push({ x, peak });
      }
      const groups = [];
      for (const c of cols) { const g = groups[groups.length - 1]; if (g && c.x - g[g.length - 1].x <= 2) g.push(c); else groups.push([c]); }
      const seams = groups.filter((g) => g.length <= W_MAX);
      const dmax = seams.length ? Math.max(...seams.map((g) => Math.max(...g.map((c) => c.peak)))) - med : 0;
      rows.push({ z, d, nSeam: seams.length, dmax: Math.round(dmax) });
    }
  }
  console.log('盘面接缝像素复验（WXG-T-235 修后应全 0）');
  console.log('zoom  dpr   缝列数  最大dLum  备注');
  for (const r of rows) {
    const bad = r.nSeam > 0;
    console.log(`${String(r.z).padEnd(5)} ${String(r.d).padEnd(4)} ${String(r.nSeam).padStart(7)} ${String(r.dmax).padStart(9)}  ${r.note ?? (bad ? 'X 有缝' : 'OK 无缝')}`);
    if (bad) fail('PX', `zoom=${r.z} dpr=${r.d} 检出 ${r.nSeam} 条缝列（dLum ${r.dmax}）`);
    else if (r.nSeam === -1) notes.push(`PX  zoom=${r.z} dpr=${r.d} 未识别珠子行（不计入通过）`);
  }
  return 0;
}

if (PIXELS) {
  const code = pixelsCheck();
  if (code === 2) process.exit(2);
} else {
  const bleed = checkBleedPositive();
  checkDrawUsesBleed();
  checkOverlapEnough(bleed);
  checkNoLiteralPitchJudge();
}

for (const n of notes) console.log(`  ${n}`);
if (problems.length) {
  console.error('');
  for (const p of problems) console.error(`X [${p.id}] ${p.msg}`);
  console.error('');
  console.error('修法：1) TILE_BLEED 须 > 0（= 0 即修前行为）2) drawTargetTile 须按 '
    + '`size + 2 * TILE_BLEED`（乘法顺序无关）外扩 3) B0 tile 宽度判据须跟**绘制**边长（格距 + 2xTILE_BLEED），'
    + '不用字面量格距（会筛不出 tile => 静默空断言）。详见判例 K-091。');
  console.log('STATUS: FAIL');
  process.exit(1);
}
console.log('STATUS: OK');
