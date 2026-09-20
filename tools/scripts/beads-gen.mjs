#!/usr/bin/env node
/**
 * beads 拼豆图案生成器（照片 / 图案 → 拼豆棋盘数据草案）。
 *
 * ── 定位（诚实口径）─────────────────────────────────────────────────────
 * 产出 = **关卡数据草案**（rowstring pattern + 错位构造 swaps + 色值表），用于出关与对比取材。
 * **本工具不判 PASS** —— 能否入关由 `levels.ts` 的 BOOT 校验决定，当前有两条硬约束（见文末）。
 *
 * ── 盘面档位（用户 2026-09-20 调研；落档 games/beads/design/proposals/board-size-29-mvp.md）──
 *   standard29  29×29  = 841    5mm Midi   **标准方形盘**（业界默认「标准盘」）
 *   maxi29      29×29  = 841    10mm Maxi  格数同上、物理更大
 *   small18     18×18  = 324    5mm Midi   小号方盘（套装常见）
 *   small16     16×16  = 256    5mm Midi
 *   small14     14×14  = 196    5mm Midi
 *   mini107    107×107 = 11449  2.6mm Mini 28cm 方盘（⚠️ 仅供导出参考图，不可入关）
 *
 * ── 异形盘（非规则网格用「空位」语义表达，引擎侧无需改动）────────────────
 *   --shape circle | hex | heart    形状外的格 = 空位（渲染空白、不计完成）
 *   ⚠️ 选 shape 时自动跳过「背景去格」—— 形状本身就是图案边界
 *
 * 用法：
 *   node tools/scripts/beads-gen.mjs --in pic.jpg --board standard29 --palette artkal --colors 8 --swaps 12
 *   node tools/scripts/beads-gen.mjs --in pic.jpg --cols 29 --rows 29 --shape heart --swaps 8
 *   node tools/scripts/beads-gen.mjs                       # 无 --in ⇒ 合成 demo 图跑通全管线
 *   node tools/scripts/beads-gen.mjs --in-raw raw.json --no-png --out out  # 免浏览器路径（WXG-T-179 Web 服务）：
 *          raw.json = { w, h, data: base64(RGBA) }（前端解像后的源图像素）；--no-png 跳过 PNG 导出
 *   node tools/scripts/beads-gen.mjs --help                # 全部参数
 *
 * 入关前置（两条硬约束，都须先解）：
 *   ① rows ≤ GRID_MAX_ROWS、cols ≤ GRID_MAX_COLS（`systems-index §3.3` 冻结值）；
 *   ② paletteHex 的色值须能在游戏 BEAD_PALETTE（10 色）中找到对应珠 ——
 *      用 `--palette 10` 产出直接合规的盘；`artkal` 需先接 ADR-0016 戊案（换色值）。
 */
// 管线：源图 → 量化到拼豆色板 → 形状/背景去格(void) → **配色平衡**(任一色 ≤½)
//       → **错位打乱**(多重集全错位：按色排序 + 循环左移 maxFreq)。
// 产物：temp/beads-out/{solved.png, misplaced.png, pattern.json}
//
// 图片解码 / PNG 导出复用已装的 playwright/chromium canvas（同 temp/confetti-pixcheck.mjs），
// 不手写 PNG 编解码。量化/平衡/错位为纯确定性 Node 逻辑，零 Math.random（对 L4 口径友好）。
//
// 用法：
//   node temp/beads-gen.mjs                 # 合成 demo 图，跑通全管线
//   node temp/beads-gen.mjs --skew          # 制造单色多数，验证配色平衡
//   node temp/beads-gen.mjs --in pic.png --cols 12 --rows 12 --cell 26
//   node temp/beads-gen.mjs --noframe       # 不做背景去格（整盘皆可填）
//   node temp/beads-gen.mjs --sample 8      # 每格采样倍率（默认 8 ⇒ 块内众数投票；1 = 旧最近邻）
//   node temp/beads-gen.mjs --smooth 2      # 众数滤波轮数（默认 1；0 = 关）
//   node temp/beads-gen.mjs --minblock 4    # 小于 N 格的碎块整体并入邻色（默认 3；<2 = 关）
//
// ⚠️ 聚集度是**独立目标**（用户 2026-09-19 反馈：「豆子要尽量同色大块集中，以触发连续填充」）：
//    与「配色平衡 ≤½」（只保证全盘错位有解，不保证成块）不是一回事。三个旋钮力度递增：
//    `--sample`（采样去噪，最保细节）→ `--smooth`（众数滤波）→ `--minblock`（碎块并入，最激进）。
//    报告的「同色相邻率 / 碎块占比 / 块数」是量化判据，别凭肉眼。

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { dirname as dirOf } from 'node:path';
import { fileURLToPath as urlToPath } from 'node:url';
// 本脚本所在目录（tools/scripts/）—— 色板等数据资产按脚本位置解析，不依赖 cwd
const SCRIPT_DIR = dirOf(urlToPath(import.meta.url));

// ── 解析 playwright/chromium ──────────────────────────────────────────────────
let chromium = null;
let browser = null;
let page = null;
// 惰性解析：仅真实图片路径（--in）需要；`--in-raw` / 合成图不碰浏览器亦可（合成图仍用 canvas）
async function ensurePage() {
  if (page) return page;
  for (const c of [
    join(homedir(), '.workbuddy/binaries/node/workspace/node_modules'),
    join(process.cwd(), 'node_modules'),
  ]) {
    try {
      chromium = createRequire(join(c, 'package.json'))('playwright').chromium;
      break;
    } catch {
      /* try next */
    }
  }
  if (!chromium) {
    console.error('playwright/chromium 不可解析（参考 temp/confetti-pixcheck.mjs；或改用 --in-raw 免浏览器路径）');
    process.exit(3);
  }
  browser = await chromium.launch();
  page = await browser.newPage();
  return page;
}

// ── 色板 ──────────────────────────────────────────────────────────────────────
// 用户 2026-09-19 调研的真实拼豆色数：IKEA-Pyssla 10-20 / Nabbi 30-50 / Hama 60-90 /
// Perler 100+ / Artkal 200+。**而游戏内只冻结 8 色**（`BEAD_COLOR_MAX = 8`，真源
// `view/palette.ts`）—— 那 8 色全是**高饱和对比色**，照片里的灰/肤/暗部会被硬拽到最近的
// 饱和色 ⇒ **8 色本身就不保形**，再砍色数必然「看不出形状」。故拆成两个正交旋钮：
//   · `--palette 8`（默认）= 游戏 8 色真源，产物**可直接进游戏**；
//   · `--palette N>8`      = 程序化色板（色域覆盖），**仅供调研比较** ——
//                           游戏暂无对应珠色，**不得直接入关**（报告会标注）。
const GAME_PALETTE = [
  '#FDF6E9', // 1 奶白 ○ 亮
  '#FFD23F', // 2 柠黄 ★ 亮
  '#F59B23', // 3 活力橙 ● 中
  '#3FBF6B', // 4 草绿 ■ 中
  '#E84C3D', // 5 玫红 ♥ 中暗
  '#8E6FD9', // 6 丁香紫 ◐ 中暗
  '#3D7BF5', // 7 湖蓝 ▽ 暗
  '#A5652C', // 8 赭棕 ▲ 暗
  '#6B3E1E', // 9 深棕 ◆ 最暗  ← 2026-09-20 补：此前脚本只取前 8 色，**暗部无落点**
  '#33333D', // 10 炭黑 ✚ 最暗  ← 同上（真源 `view/palette.ts::BEAD_PALETTE` 是 **10 色**）
];
const rgbToHex = (c) =>
  '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
/** HSL(h∈[0,1), s∈[0,1], l∈[0,1]) → RGB(0..255)。 */
function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
/**
 * 程序化色板：在 H/S/L 候选网格上做**最远点采样**（farthest-point）：从黑白起，
 * 每次取「离已选集合最远」的候选 ⇒ 色域覆盖均匀，且对任意 n 都自适应。
 * ⚠️ 近似：不含品牌实测 hex（那需逐色采样），足以回答「色域够不够」这一层问题。
 */
function buildPalette(n) {
  if (n <= GAME_PALETTE.length) return GAME_PALETTE.slice(0, n); // ≤10 = 游戏真源的前 n 色
  const cands = [];
  for (let h = 0; h < 24; h++) {
    for (const s of [0.2, 0.45, 0.7, 1.0]) {
      for (const l of [0.2, 0.35, 0.5, 0.65, 0.8]) cands.push(hslToRgb(h / 24, s, l));
    }
  }
  const picked = [[255, 255, 255], [26, 26, 26]]; // 起手双锚（白/黑），保证有极值
  while (picked.length < n && cands.length) {
    let best = -1, bestD = -1;
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      let dmin = Infinity;
      for (const p of picked) {
        const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
        if (d < dmin) dmin = d;
      }
      if (dmin > bestD) { bestD = dmin; best = i; }
    }
    picked.push(cands[best]);
    cands.splice(best, 1);
  }
  return picked.map(rgbToHex);
}
const CHAR = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // idx 1..35 → 字符（⚠️ 游戏 charset 仅到 'A'=10）
/**
 * 盘面档位（落档口径见 design/proposals/board-size-29-mvp.md）。
 * `--board <name>` 只覆盖 cols / rows / beadMm 三个默认值；显式 `--cols/--rows` 优先。
 */
const BOARD_PRESETS = {
  standard29: { cols: 29, rows: 29, beadMm: 5, note: '5mm Midi 标准方形盘（业界默认）' },
  maxi29: { cols: 29, rows: 29, beadMm: 10, note: '10mm Maxi，格数同 standard29、物理更大' },
  small18: { cols: 18, rows: 18, beadMm: 5, note: '5mm Midi 小号方盘' },
  small16: { cols: 16, rows: 16, beadMm: 5, note: '5mm Midi 小号方盘' },
  small14: { cols: 14, rows: 14, beadMm: 5, note: '5mm Midi 小号方盘' },
  mini107: { cols: 107, rows: 107, beadMm: 2.6, note: '2.6mm Mini（28cm 方盘；仅供导出参考图）' },
};

/**
 * 异形盘掩码：`1` = 形状内（可填），`0` = 形状外（空位 ⇒ rowstring 写空位符，引擎已有语义：不可填、不计完成）。
 * 归一化坐标 (u,v) ∈ [-1,1]²（v 向上）：
 *   · circle: u²+v² ≤ r²
 *   · hex   : 尖顶正六边形 —— max(|v|, 0.866·|u| + 0.5·|v|) ≤ r
 *   · heart : (u²+v²−1)³ − u²v³ ≤ 0（v 向上 ⇒ 心尖朝下）
 *
 * 两处“缺漏”修正（用户 2026-09-20：“拼豆要铺满整个形状”）：
 * ① 不再默认内缩（旧 `inset = 0.02` 把半径削到 98% ⇒ 盘子边缘一整圈空位）；
 * ② 旧口径只测**格心** ⇒ 一半在形状内的格被判空，轮廓呈阶梯缺角。
 *   现按“**格的中心或任一角在形状内即保留**”（5 点采样），铺满到边界；形状外仍为 void。
 * @returns {Uint8Array} 1 = 在形状内（可参与棋盘）
 */
function shapeMask(cols, rows, shape, inset = 0) {
  const mask = new Uint8Array(cols * rows);
  const r = 1 - inset;
  const du = 1 / cols; // 归一化空间下半格的宽/高（u,v ∈ [−1,1]）
  const dv = 1 / rows;
  const inside = (u, v) => {
    if (shape === 'circle') return u * u + v * v <= r * r;
    if (shape === 'hex') return Math.max(Math.abs(v), 0.8660254 * Math.abs(u) + 0.5 * Math.abs(v)) <= r;
    if (shape === 'heart') {
      const uu = u / r, vv = v / r, t = uu * uu + vv * vv - 1;
      return t * t * t - uu * uu * vv * vv * vv <= 0;
    }
    return true; // 未知形状 ⇒ 不裁剪
  };
  for (let y = 0; y < rows; y++) {
    const v = 1 - ((y + 0.5) / rows) * 2; // 行 y 自上而下 ⇒ v 自 +1 到 −1（与 rowstring 首行在上一致）
    for (let x = 0; x < cols; x++) {
      const u = ((x + 0.5) / cols) * 2 - 1;
      if (
        inside(u, v) ||
        inside(u - du, v - dv) || inside(u + du, v - dv) ||
        inside(u - du, v + dv) || inside(u + du, v + dv)
      ) {
        mask[y * cols + x] = 1;
      }
    }
  }
  return mask;
}
const VOID_HEX = '#E9E6F2'; // 预览里 void 格的颜色（非玩法色）

// ── argv ──────────────────────────────────────────────────────────────────────
const A = process.argv.slice(2);
const arg = (k, d) => {
  const i = A.indexOf('--' + k);
  return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d;
};
const has = (k) => A.includes('--' + k);
// 盘面档位：`--board` 给默认尺寸，显式 `--cols/--rows` 优先
const boardName = arg('board', '');
const preset = BOARD_PRESETS[boardName] ?? null;
if (boardName && !preset) {
  console.error('⚠️ 未知盘面档位 ' + boardName + '；可用：' + Object.keys(BOARD_PRESETS).join(' / '));
  process.exit(3);
}
const hasExplicitSize = A.includes('--cols') || A.includes('--rows');
const cols = hasExplicitSize ? Math.max(1, parseInt(arg('cols', '12'), 10)) : preset?.cols ?? 12;
const rows = hasExplicitSize ? Math.max(1, parseInt(arg('rows', '12'), 10)) : preset?.rows ?? 12;
const beadMm = parseFloat(arg('beadMm', String(preset?.beadMm ?? 5))) || 5;
const shape = arg('shape', 'square'); // square（默认）| circle | hex | heart
if (!['square', 'circle', 'hex', 'heart'].includes(shape)) {
  console.error('⚠️ --shape 只支持 square / circle / hex / heart');
  process.exit(3);
}
const cell = Math.max(4, parseInt(arg('cell', '26'), 10));
const inPath = arg('in', null);
const inRawPath = arg('in-raw', null); // JSON {w,h,data:base64(RGBA)} —— 免浏览器路径（WXG-T-179）
const outDir = arg('out', join(process.cwd(), 'temp/beads-out'));
const skew = has('skew'); // 合成图里逼出一个主导色，验证平衡
const noFrame = has('noframe'); // 跳过去背景
const sample = Math.max(1, parseInt(arg('sample', '8'), 10)); // 每格采样倍率（块内众数投票）
const smoothRounds = Math.max(0, parseInt(arg('smooth', '1'), 10)); // 众数滤波轮数
const minBlock = Math.max(0, parseInt(arg('minblock', '3'), 10)); // 碎块并入阈值（格）
const colorsMax = Math.max(0, parseInt(arg('colors', '0'), 10)); // 用色数上限（0/≥色板大小 = 不限制）
const paletteArg = arg('palette', '10'); // 数字（≤10 游戏真源 / >10 程序化色域）| 'artkal'（真实品牌色板）
const colorsMode = arg('colorsmode', 'error'); // freq（频次优先）| error（误差最小优先；默认）
const paletteSize = paletteArg === 'artkal' ? 0 : Math.max(2, parseInt(paletteArg, 10));

// 色板落地：数字 ⇒ `buildPalette`；`artkal` ⇒ 读 `temp/artkal-palette.json`（真实品牌色，去重）
const ARTKAL = (() => {
  try {
    // 转正后色板数据是**入库资产**；兼容 spike 期放在 temp/ 的老位置
    const j = (() => {
      for (const f of [
        // ⚠️ 不能放 `design/levels/` —— 该目录的 .json 必须**恰好 1 个**（关卡真源唯一性门禁，
        //    WXG-T-048；2026-09-20 实测：放进去会让 `levels:check` 报红）。故色板归美术资产目录。
        join(SCRIPT_DIR, '../games/beads/art/artkal-palette.json'),
        join(SCRIPT_DIR, '../../games/beads/art/artkal-palette.json'),
        join(process.cwd(), 'temp/artkal-palette.json'),
      ]) {
        try { return JSON.parse(readFileSync(f, "utf8")); } catch { /* try next */ }
      }
      return null;
    })();
    if (!j) return null;
    return { hex: [...new Set(j.palette)], src: j._source, raw: j.palette.length };
  } catch {
    return null;
  }
})();
if (paletteArg === 'artkal' && !ARTKAL) {
  console.error('⚠️ --palette artkal 需要 temp/artkal-palette.json（未找到，见 WXG-T-179）');
  process.exit(3);
}
const palHex = paletteArg === 'artkal' ? ARTKAL.hex : buildPalette(paletteSize);
const palRgb = palHex.map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
});
const PAL_N = palHex.length;
mkdirSync(outDir, { recursive: true });

// ── 纯逻辑（Node 侧，可独立推理/断言）────────────────────────────────────────
/** 两色板索引(1..8)间的 RGB 距离平方。 */
function palDist(a, b) {
  const x = palRgb[a - 1];
  const y = palRgb[b - 1];
  return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2;
}

/** 统计颜色直方图（含 0=void）。 */
function hist(arr) {
  const h = new Array(PAL_N + 1).fill(0);
  for (const v of arr) h[v]++;
  return h;
}

/**
 * 配色平衡：把可填格里超过 cap=⌊N/2⌋ 的主导色，逐颗改到「离它最近且尚有空位」的
 * 其它色，直到无色列超半数 —— 这是「全盘错位」可行的充要前提（Hall 定理）。
 *
 * `allow`（可选）= **允许的色集**（`--colors` 的保留色）。**必须传**：候选池若仍是
 * 1..8 全调色板，`balance` 会把玩家已被限掉的色「复活」，`--colors` 形同虚设
 * （2026-09-19 实测：`--colors 4` 却产出 5 色 ⇒ 修此 bug）。无可用目标时**如实返回 note**，
 * 不静默越界。
 * @param {Set<number>|null} allow 允许改判到的色号集合（null = 不限制）
 * @returns { changed: number[], note?: string } 被改判的格索引
 */
function balance(solved, allow = null) {
  const fill = [];
  const cnt = new Array(PAL_N + 1).fill(0);
  for (let i = 0; i < solved.length; i++) {
    const v = solved[i];
    if (v > 0) {
      fill.push(i);
      cnt[v]++;
    }
  }
  const N = fill.length;
  const cap = Math.floor(N / 2);
  const changed = [];
  if (N < 4) return { changed, note: '可填格 < 4，跳过平衡' };
  let guard = N * 8; // 上限，防色板退化时死循环
  while (guard-- > 0) {
    let over = 0;
    let overN = 0;
    for (let c = 1; c <= PAL_N; c++) {
      if (cnt[c] > overN) {
        overN = cnt[c];
        over = c;
      }
    }
    if (overN <= cap) break; // 全部 ≤½，达标
    // 找离 over 最近、仍 <cap、且**在允许色集内**的目标色
    let target = 0;
    let td = Infinity;
    for (let c = 1; c <= PAL_N; c++) {
      if (c !== over && cnt[c] < cap && (!allow || allow.has(c))) {
        const d = palDist(over, c);
        if (d < td) {
          td = d;
          target = c;
        }
      }
    }
    if (target === 0) {
      return { changed, note: `无空位色可承接，无法降到 ≤½（主导色 ${over}=${overN}, cap=${cap}）` };
    }
    // 取一个 over 的格改判（末位，稳定可复现）
    let pick = -1;
    for (let k = fill.length - 1; k >= 0; k--) {
      if (solved[fill[k]] === over) {
        pick = fill[k];
        break;
      }
    }
    solved[pick] = target;
    cnt[over]--;
    cnt[target]++;
    changed.push(pick);
  }
  return { changed };
}

/**
 * 多重集全错位：可填格按色排序后整体循环左移 maxFreq 位。
 * 前提 maxFreq ≤ ⌊N/2⌋（由 balance 保证）⇒ 每格新色必 ≠ 原色（无固定点）。
 * @returns {{ ok: boolean, misplaced: number[], maxFreq: number, N: number, reason?: string }}
 */
function derange(solved) {
  const cells = [];
  for (let i = 0; i < solved.length; i++) if (solved[i] > 0) cells.push(i);
  const N = cells.length;
  const cnt = new Array(PAL_N + 1).fill(0);
  for (const i of cells) cnt[solved[i]]++;
  let maxFreq = 0;
  for (let c = 1; c <= PAL_N; c++) if (cnt[c] > maxFreq) maxFreq = cnt[c];
  const misplaced = new Array(solved.length).fill(0);
  for (let i = 0; i < solved.length; i++) if (solved[i] === 0) misplaced[i] = 0;
  if (N < 2) return { ok: false, misplaced, maxFreq, N, reason: '可填格 < 2' };
  if (maxFreq > Math.floor(N / 2))
    return { ok: false, misplaced, maxFreq, N, reason: `主导色 ${maxFreq} > N/2=${Math.floor(N / 2)}，无法全错位` };

  // 按色分组（次级按原索引，稳定）
  const sorted = cells.slice().sort((a, b) => solved[a] - solved[b] || a - b);
  const seqColor = sorted.map((i) => solved[i]);
  const k = maxFreq;
  for (let j = 0; j < sorted.length; j++) {
    misplaced[sorted[j]] = seqColor[(j + k) % N];
  }
  // 自检：无固定点
  for (const i of cells) {
    if (misplaced[i] === solved[i]) {
      return { ok: false, misplaced, maxFreq, N, reason: `断言失败：格 ${i} 错位后就位` };
    }
  }
  return { ok: true, misplaced, maxFreq, N };
}

/**
 * 限制用色数（2026-09-19 用户想法：「调色板色数少是不是就更容易大块集中」）。
 * 两种选色模式（`--colorsmode`）：
 *   · `freq`（默认）= **频次优先**：取出现最多的 n 色。简单，但会丢掉「面积小却承载形状」的色
 *     —— 用户 2026-09-19 反馈「颜色限制太少了看不出来形状」正是它的锅；
 *   · `error`        = **误差最小优先**（贪心 k-medoids）：每次加入「使全盘色差总和下降最多」的色，
 *     依据是**每格原始平均色**（`avg`）而非频次 ⇒ 同样的 n 色能保住更多形状细节。
 *
 * ⚠️ 与「全盘错位有解」的**张力**（必须看报告里的 `balancedChanged`）：
 * `derange` 的前提是 `maxFreq ≤ ⌊可填/2⌋`；色数越少 ⇒ 单色平均占比 1/n 越高 ⇒ 越易撞线，
 * 一撞线 `balance` 就把主导色逐格改判 ⇒ **反手把刚集中的大块拆散**。故 n 有下限。
 *
 * 顺序：排在**去背景之后、聚集处理之前** —— 统计要基于真实可填格（不含 void）。
 * @param {number[]} arr 可填格色号（0 = void）
 * @param {number} n 保留色数
 * @param {'freq'|'error'} mode 选色模式
 * @param {number[]|null} avg 每格原始平均色（仅 error 模式需要）
 * @returns {{ changed: number, kept: number[], mode: string }}
 */
function limitColors(arr, n, mode = 'freq', avg = null) {
  if (n <= 0 || n >= PAL_N) return { changed: 0, kept: [], mode };
  const cnt = new Array(PAL_N + 1).fill(0);
  for (const v of arr) if (v > 0) cnt[v]++;
  let kept;
  if (mode === 'error' && avg) {
    // 贪心 k-medoids：逐次加入「使总色差下降最多」的色。
    // near[k] = 第 k 个可填格到已选集合的**最小距离²**；BIG 替代 Infinity（避免 Infinity 参与比较）。
    const cells = [];
    for (let i = 0; i < arr.length; i++) if (arr[i] > 0) cells.push(i);
    const BIG = 3 * 255 * 255;
    const near = new Array(cells.length).fill(BIG);
    kept = [];
    const chosen = new Set();
    while (kept.length < n) {
      let bestC = -1, bestGain = -1;
      for (let c = 1; c <= PAL_N; c++) {
        if (chosen.has(c)) continue;
        const p = palRgb[c - 1];
        let gain = 0;
        for (let k = 0; k < cells.length; k++) {
          const i = cells[k];
          const dr = avg[i * 3] - p[0], dg = avg[i * 3 + 1] - p[1], db = avg[i * 3 + 2] - p[2];
          const d = dr * dr + dg * dg + db * db;
          if (d < near[k]) gain += near[k] - d;
        }
        if (gain > bestGain) { bestGain = gain; bestC = c; }
      }
      if (bestC < 0) break;
      kept.push(bestC);
      chosen.add(bestC);
      const p = palRgb[bestC - 1];
      for (let k = 0; k < cells.length; k++) {
        const i = cells[k];
        const dr = avg[i * 3] - p[0], dg = avg[i * 3 + 1] - p[1], db = avg[i * 3 + 2] - p[2];
        const d = dr * dr + dg * dg + db * db;
        if (d < near[k]) near[k] = d;
      }
    }
    kept.sort((a, b) => a - b);
  } else {
    kept = [];
    for (let c = 1; c <= PAL_N; c++) if (cnt[c] > 0) kept.push(c);
    kept.sort((a, b) => cnt[b] - cnt[a] || a - b); // 频次降序；平局取小色号（确定性）
    kept.length = Math.min(kept.length, n);
  }
  const keepSet = new Set(kept);
  let changed = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v === 0 || keepSet.has(v)) continue;
    let best = kept[0], bd = Infinity;
    for (const k of kept) {
      const d = palDist(v, k);
      if (d < bd) { bd = d; best = k; }
    }
    arr[i] = best;
    changed++;
  }
  return { changed, kept, mode };
}

/**
 * 平均色差（0..441）：可填格「最终色号对应的调色板色」与「该格**原始平均色**」的欧氏距离均值。
 * 这是**形状保真度的量化判据** —— 用户 2026-09-19「看不出来形状」= 这个数字太大；
 * 与「同色相邻率」（聚集度）方向相反，两者必须一起看才叫"调优"。
 */
function meanColorErr(arr, avg) {
  let sum = 0, n = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === 0) continue;
    const p = palRgb[arr[i] - 1];
    const dr = avg[i * 3] - p[0], dg = avg[i * 3 + 1] - p[1], db = avg[i * 3 + 2] - p[2];
    sum += Math.sqrt(dr * dr + dg * dg + db * db);
    n++;
  }
  return n ? +(sum / n).toFixed(1) : 0;
}

/**
 * 交换构造法（`levels-spec §2.1`，**游戏关卡的错位口径**）：在**已就位**的盘上做 k 次
 * 「异色可填格两两交换」，产出 4 元组 `swaps`（`[r1,c1,r2,c2]`）与由它复原的初始盘。
 *
 * 与 `derange`（全盘错位）的分工：全盘错位只用于"验证破碎度"，**不适合做可玩关卡** ——
 * 841 格的盘若全错位，玩家要挪 841 颗（不可玩）。游戏难度旋钮 = **错位对数 k**
 * （`levels-spec §3`：k 逐关递增）。
 * 确定性（守 L4）：行主序贪心配对、无 RNG；`minDist` 过滤"紧邻交换"（相邻两格互换在满盘上
 * 几乎看不出，等于白送难度）。
 */
function buildSwaps(arr, k, minDist = 2) {
  const cells = [];
  for (let i = 0; i < arr.length; i++) if (arr[i] > 0) cells.push(i);
  const used = new Uint8Array(arr.length);
  const swaps = [];
  for (let a = 0; a < cells.length && swaps.length < k; a++) {
    const ia = cells[a];
    if (used[ia]) continue;
    const ra = (ia / cols) | 0, ca = ia % cols;
    // ⚠️ 内层只扫**局部窗口**（默认 400 个候选）：Mini 107×107 = 11449 格时 O(n²) 是 1.3 亿次
    // 比较（实测跑不完）；局部窗口既够配对，也让交换发生在邻近区域（视觉上更像"手抖放错"）。
    const winEnd = Math.min(cells.length, a + 400);
    for (let b = a + 1; b < winEnd; b++) {
      const ib = cells[b];
      if (used[ib] || arr[ib] === arr[ia]) continue;
      const rb = (ib / cols) | 0, cb = ib % cols;
      if (Math.abs(ra - rb) + Math.abs(ca - cb) < minDist) continue; // 太近 ⇒ 视觉上看不出换过
      swaps.push([ra, ca, rb, cb]);
      used[ia] = 1;
      used[ib] = 1;
      break;
    }
  }
  const init = arr.slice();
  for (const [r1, c1, r2, c2] of swaps) {
    const i1 = r1 * cols + c1;
    const i2 = r2 * cols + c2;
    const t = init[i1];
    init[i1] = init[i2];
    init[i2] = t;
  }
  return { swaps, init, pairs: swaps.length };
}

/**
 * 众数滤波（8 邻域含自身，`rounds` 轮）：逐格取邻域内出现最多的色；**原色并列最多时保留原色**
 * （否则会系统性偏向小色号）。void 格不参与投票，也不被改写（不吃背景）。
 * 力度介于 `--sample` 与 `--minblock` 之间 ⇒ 先跑它可保住细节，再决定要不要上碎块并入。
 * @returns 改判格数（累计）
 */
function smooth(arr, rounds) {
  if (rounds <= 0) return 0;
  const cur = arr.slice();
  const next = arr.slice();
  let total = 0;
  for (let t = 0; t < rounds; t++) {
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (cur[i] === 0) { next[i] = 0; continue; }
        const votes = new Array(PAL_N + 1).fill(0);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const v = cur[nr * cols + nc];
            if (v > 0) votes[v]++;
          }
        }
        let bw = 0;
        for (let cc = 1; cc <= PAL_N; cc++) if (votes[cc] > bw) bw = votes[cc];
        let bc = cur[i];
        if (votes[cur[i]] < bw) {
          for (let cc = 1; cc <= PAL_N; cc++) if (votes[cc] === bw) { bc = cc; break; }
        }
        next[i] = bc;
        if (bc !== cur[i]) n++;
      }
    }
    for (let i = 0; i < cur.length; i++) cur[i] = next[i];
    total += n;
  }
  for (let i = 0; i < arr.length; i++) arr[i] = cur[i];
  return total;
}

/**
 * 碎块并入（力度最大）：把 8 连通、size < `minBlock` 的同色块**整体**改成
 * 「其边界上邻接最多的异色」；全 void 邻居则保留。迭代到不再有小块为止
 * （每轮块数严格减少 ⇒ 收敛）。`minBlock < 2` 关闭。
 * @returns 被并入的格数
 */
function mergeSmallBlocks(arr, minBlock) {
  if (minBlock < 2) return 0;
  let merged = 0;
  const N8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  for (let pass = 0; pass < 64; pass++) {
    let changed = false;
    const seen = new Uint8Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === 0 || seen[i]) continue;
      const color = arr[i];
      // 收集 8 连通块
      const block = [];
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const p = stack.pop();
        block.push(p);
        const r = (p / cols) | 0, c = p % cols;
        for (const [dr, dc] of N8) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const q = nr * cols + nc;
          if (!seen[q] && arr[q] === color) { seen[q] = 1; stack.push(q); }
        }
      }
      if (block.length >= minBlock) continue;
      // 块边界上的邻色票数
      const votes = new Array(PAL_N + 1).fill(0);
      for (const p of block) {
        const r = (p / cols) | 0, c = p % cols;
        for (const [dr, dc] of N8) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const q = nr * cols + nc;
          if (arr[q] !== 0 && arr[q] !== color) votes[arr[q]]++;
        }
      }
      let bw = 0, bc = 0;
      for (let cc = 1; cc <= PAL_N; cc++) if (votes[cc] > bw) { bw = votes[cc]; bc = cc; }
      if (bc === 0) continue; // 四面皆 void ⇒ 孤立图案，保留
      for (const p of block) arr[p] = bc;
      merged += block.length;
      changed = true;
    }
    if (!changed) break;
  }
  return merged;
}

/**
 * 聚集度统计（用户 2026-09-19 诉求的**量化判据**，替代肉眼判断）：
 *   · blocks      = 8 连通同色块数（越少越聚）
 *   · largest/avg = 最大块 / 平均块（格）
 *   · tinyCells   = 「块 size ≤ 2」所含格数（碎块占比 = tinyCells / 可填格）
 *   · adjRate     = 同色相邻率 = 4 向相邻且同色的边 ÷ 全部 4 向相邻（双可填）边
 * @returns {{ blocks: number, largest: number, avg: number, tinyCells: number, adjRate: number }}
 */
function clusterStats(arr) {
  const seen = new Uint8Array(arr.length);
  const N8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  let blocks = 0, largest = 0, fillN = 0, tinyCells = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === 0) continue;
    fillN++;
    if (seen[i]) continue;
    const color = arr[i];
    let size = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const r = (p / cols) | 0, c = p % cols;
      for (const [dr, dc] of N8) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const q = nr * cols + nc;
        if (!seen[q] && arr[q] === color) { seen[q] = 1; stack.push(q); }
      }
    }
    blocks++;
    if (size > largest) largest = size;
    if (size <= 2) tinyCells += size;
  }
  let same = 0, edges = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = arr[r * cols + c];
      if (v === 0) continue;
      if (c + 1 < cols) { const q = arr[r * cols + c + 1]; if (q > 0) { edges++; if (q === v) same++; } }
      if (r + 1 < rows) { const q = arr[(r + 1) * cols + c]; if (q > 0) { edges++; if (q === v) same++; } }
    }
  }
  return {
    blocks,
    largest,
    avg: blocks ? +(fillN / blocks).toFixed(1) : 0,
    tinyCells,
    adjRate: edges ? +(same / edges).toFixed(3) : 0,
  };
}

/**
 * 行字符串（level pattern 形态：色→字符，void→'.'）。
 * ⚠️ **必须先把「实际出现的色号」升序重映射到 1..N** —— 大色板下限色后的色号是**原板索引**
 * （Artkal 可达 174），直接用 `CHAR[v-1]` 会越界成 `undefined`（2026-09-20 实测：29×29 首行
 * 输出 229 个字符全是 `undefined` —— 同 K-056 追记的「维度泄漏」型）。
 * @returns {string[]} 29 行 × 29 字符（>10 色时字符用扩展表 1-9+A-Z，超 35 色会越界 ⇒ 调用方须自查）
 */
function toRowStrings(arr) {
  const used = [...new Set(arr.filter((v) => v > 0))].sort((a, b) => a - b);
  if (used.length > CHAR.length) {
    throw new Error(`色数 ${used.length} > 字符表 ${CHAR.length}（需扩 charset）`);
  }
  const toChar = new Map(used.map((c, i) => [c, CHAR[i]]));
  const out = [];
  for (let r = 0; r < rows; r++) {
    let s = '';
    for (let c = 0; c < cols; c++) {
      const v = arr[r * cols + c];
      s += v > 0 ? toChar.get(v) : '.';
    }
    out.push(s);
  }
  return out;
}

// ── 浏览器侧：解码源图 + 降采样量化到 cols×rows（主导/最近色），及导出 PNG ────────
// ⚠ 不在顶层启动浏览器：`--in-raw --no-png`（Web 服务路径）必须完全不碰 chromium，
//    故页面一律由 readGrid / renderPng 内部的 ensurePage() **按需**创建。

async function readGrid() {
  await ensurePage();
  return await page.evaluate(
    async ({ w, h, pal, srcBase64, skew, K }) => {
      /** 单像素 → 最近调色板色（1..8）。 */
      const quant = (r, gg, b) => {
        let best = 1, bd = Infinity;
        for (let p = 0; p < pal.length; p++) {
          const pr = pal[p][0] - r, pg = pal[p][1] - gg, pb = pal[p][2] - b;
          const dd = pr * pr + pg * pg + pb * pb;
          if (dd < bd) { bd = dd; best = p + 1; }
        }
        return best;
      };
      const grid = new Array(w * h);
      const avg = new Array(w * h * 3); // 每格**原始平均色**(RGB)：色差统计与「误差最小选色」用
      const cv = document.createElement('canvas');

      if (!srcBase64) {
        // ── 合成图（demo/skew）：按公式直出，单点取色即可 ──
        cv.width = w;
        cv.height = h;
        const g = cv.getContext('2d');
        const id = g.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let idx; // palette 0-based
            if (skew) {
              idx = (x * 3 + y * 5) % 10 < 7 ? 0 : 1 + ((x + y) % Math.min(3, pal.length - 1)); // 色0 约 70%，逼出主导色
            } else {
              idx = (x * 3 + y * 5) % Math.min(5, pal.length); // 5 色近均布（板小则退化为可用色数）
            }
            const p = pal[idx];
            const o = (y * w + x) * 4;
            id.data[o] = p[0];
            id.data[o + 1] = p[1];
            id.data[o + 2] = p[2];
            id.data[o + 3] = 255;
          }
        }
        g.putImageData(id, 0, 0);
        const d = g.getImageData(0, 0, w, h).data;
        for (let i = 0; i < w * h; i++) {
          grid[i] = quant(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
          avg[i * 3] = d[i * 4];
          avg[i * 3 + 1] = d[i * 4 + 1];
          avg[i * 3 + 2] = d[i * 4 + 2];
        }
        return { grid, avg };
      }

      // ── 真图：**超采样 + 块内众数投票**（2026-09-19，用户「要同色大块集中」）──
      // 旧口径 = 最近邻缩放到 w×h、每格取**1 个像素** ⇒ 照片的高频细节（纹理/渐变/噪点）
      // 直接变成单格色差 ⇒ 碎块遍地、同色不相邻，玩家无法用「组选/连续填充」。
      // 新口径 = 先平滑放大到 w·K × h·K，再对每格 K×K 像素**各自量化**并取**众数**。
      //   · 取众数而非块内平均：平均值常落在两个调色板色中间 ⇒ 量化后仍会抖；
      //     众数是「该区域里出现最多的调色板色」，对渐变与噪点都稳。
      //   · K 越大越去噪（默认 8；`--sample 1` 退回旧行为，便于对照）。
      const W = w * K, H = h * K;
      cv.width = W;
      cv.height = H;
      const g = cv.getContext('2d');
      const bin = atob(srcBase64);
      const u8 = new Uint8Array(bin.length);
      for (let t = 0; t < bin.length; t++) u8[t] = bin.charCodeAt(t);
      const bmp = await createImageBitmap(new Blob([u8]));
      g.imageSmoothingEnabled = true; // 平滑缩放 ⇒ 每格携带**区域**信息而非单点
      g.imageSmoothingQuality = 'high';
      g.drawImage(bmp, 0, 0, bmp.width, bmp.height, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data;
      const pn = pal.length; // ⚠️ 浏览器侧看不到 Node 的 PAL_N ⇒ 一律用传入的 pal.length
      for (let gy = 0; gy < h; gy++) {
        for (let gx = 0; gx < w; gx++) {
          const votes = new Array(pn + 1).fill(0);
          let sr = 0, sg = 0, sb = 0;
          for (let sy = 0; sy < K; sy++) {
            for (let sx = 0; sx < K; sx++) {
              const o = ((gy * K + sy) * W + gx * K + sx) * 4;
              sr += d[o];
              sg += d[o + 1];
              sb += d[o + 2];
              votes[quant(d[o], d[o + 1], d[o + 2])]++;
            }
          }
          const gi = gy * w + gx;
          const nn = K * K;
          avg[gi * 3] = sr / nn;
          avg[gi * 3 + 1] = sg / nn;
          avg[gi * 3 + 2] = sb / nn;
          let bw = -1, bc = 1;
          for (let c = 1; c <= pn; c++) if (votes[c] > bw) { bw = votes[c]; bc = c; } // 平局取小色号（确定性）
          grid[gi] = bc;
        }
      }
      return { grid, avg };
    },
    {
      w: cols,
      h: rows,
      pal: palRgb,
      srcBase64: inPath ? readFileSync(inPath).toString('base64') : null,
      skew,
      K: sample,
    },
  );
}

async function renderPng(colors, label) {
  await ensurePage();
  const url = await page.evaluate(
    ({ w, h, colors, pal, voidHex, cell }) => {
      const gap = 2, pad = 3;
      const cv = document.createElement('canvas');
      cv.width = pad * 2 + w * (cell + gap) - gap;
      cv.height = pad * 2 + h * (cell + gap) - gap;
      const g = cv.getContext('2d');
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = colors[y * w + x];
          g.fillStyle = v > 0 ? pal[v - 1] : voidHex;
          g.fillRect(pad + x * (cell + gap), pad + y * (cell + gap), cell, cell);
        }
      }
      return cv.toDataURL('image/png');
    },
    { w: cols, h: rows, colors, pal: palHex, voidHex: VOID_HEX, cell },
  );
  writeFileSync(join(outDir, label + '.png'), Buffer.from(url.split(',')[1], 'base64'));
}

// ── 纯 Node 侧：--in-raw 免浏览器路径（WXG-T-179 Web 服务复用；前端解好像素后发 RGBA）──
// 输入 = JSON { w, h, data: base64(RGBA) }；与浏览器 readGrid 同口径：每格块内逐像素量化 + 众数投票。
function readGridRaw(raw) {
  const sw = raw.w, sh = raw.h;
  const buf = Buffer.from(raw.data, 'base64');
  if (buf.length < sw * sh * 4) {
    console.error(`--in-raw 数据不足：${buf.length} < ${sw}×${sh}×4`);
    process.exit(3);
  }
  const grid = new Array(cols * rows);
  const avg = new Array(cols * rows * 3);
  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor((cy * sh) / rows), y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * sh) / rows));
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor((cx * sw) / cols), x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * sw) / cols));
      const vote = new Array(PAL_N + 1).fill(0);
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * sw + x) * 4;
          const r = buf[o], g = buf[o + 1], b = buf[o + 2];
          if (buf[o + 3] < 128) continue; // 透明像素不参与（前端抠图/异形源友好）
          let best = 1, bd = Infinity;
          for (let p = 0; p < PAL_N; p++) {
            const pr = palRgb[p][0] - r, pg = palRgb[p][1] - g, pb = palRgb[p][2] - b;
            const dd = pr * pr + pg * pg + pb * pb;
            if (dd < bd) { bd = dd; best = p + 1; }
          }
          vote[best]++;
          sr += r; sg += g; sb += b; n++;
        }
      }
      let pick = 0, bn = 0;
      for (let p = 1; p <= PAL_N; p++) if (vote[p] > bn) { bn = vote[p]; pick = p; }
      const gi = cy * cols + cx;
      grid[gi] = n > 0 ? pick : 0; // 整格透明 ⇒ 空位
      avg[gi * 3] = n ? Math.round(sr / n) : 0;
      avg[gi * 3 + 1] = n ? Math.round(sg / n) : 0;
      avg[gi * 3 + 2] = n ? Math.round(sb / n) : 0;
    }
  }
  return { grid, avg };
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
const { grid, avg } = inRawPath
  ? readGridRaw(JSON.parse(readFileSync(inRawPath, 'utf8')))
  : await readGrid();

// 去背景：取四边框里最常见的一色当背景 → void（0）。--noframe 则整盘可填。
// ⚠️ 异形盘（shape ≠ square）**自动跳过**本步 —— 形状本身就是图案边界，
//    再从「四边框」取背景会把形状边缘误判成背景。
// **2026-09-19 改（用户「同色大块集中」诉求）**：旧口径把**全盘所有**该色格都设为 void ——
// 主体内部与背景同色的区域会被一并挖掉，直接把大色块切成碎块（并为后续平滑制造假边界）。
// 改为**只删「自四边框 4 连通可达」**的该色格（flood fill）⇒ 背景照旧干净，主体内部同色保留。
const solved = grid.slice();

// ── 异形盘掩码（在去背景**之前**）：形状外的格直接判空位
let shapeCells = null;
if (shape !== 'square') {
  const mask = shapeMask(cols, rows, shape);
  for (let i = 0; i < solved.length; i++) if (!mask[i]) solved[i] = 0;
  shapeCells = mask.reduce((a, b) => a + b, 0);
}
let bgRemoved = 0;
if (!noFrame && shape === 'square') {
  const border = {};
  const push = (i) => (border[grid[i]] = (border[grid[i]] || 0) + 1);
  for (let c = 0; c < cols; c++) {
    push(c);
    push((rows - 1) * cols + c);
  }
  for (let r = 0; r < rows; r++) {
    push(r * cols);
    push(r * cols + cols - 1);
  }
  let bg = 0, bn = -1;
  for (const k in border) if (border[k] > bn) { bg = +k; bn = border[k]; }
  if (bg > 0) {
    const stack = [];
    const seed = (i) => { if (solved[i] === bg) { solved[i] = 0; stack.push(i); } };
    for (let c = 0; c < cols; c++) { seed(c); seed((rows - 1) * cols + c); }
    for (let r = 0; r < rows; r++) { seed(r * cols); seed(r * cols + cols - 1); }
    while (stack.length) {
      const p = stack.pop();
      bgRemoved++;
      const r = (p / cols) | 0, c = p % cols;
      if (r > 0) seed(p - cols);
      if (r < rows - 1) seed(p + cols);
      if (c > 0) seed(p - 1);
      if (c < cols - 1) seed(p + 1);
    }
  }
}

// 用色数上限（用户想法：相似色被合并 ⇒ 更易大块）；排在聚集处理**之前**，使统计基于真实可填格。
const errPreLimit = meanColorErr(solved, avg); // 限色前的色差 = **调色板本身**的保形上限
const limit = limitColors(solved, colorsMax, colorsMode, avg);

// 聚集度处理（力度递增；三步与「配色平衡」「错位打乱」互不冲突，可自由组合）：
//   stats0 → 众数滤波 → 碎块并入 → stats1，报告里给出前后对比，便于调参。
const stats0 = clusterStats(solved); // 限色后、聚集处理前（基线）
const smoothChanged = smooth(solved, smoothRounds);
const mergedCells = mergeSmallBlocks(solved, minBlock);
const stats1 = clusterStats(solved); // 聚集处理后

const h0 = hist(solved);
// ⚠️ 必须把 `--colors` 的保留色集传给 balance（否则它会把禁用色复活，见其头注）
const allowSet = limit.kept.length ? new Set(limit.kept) : null;
const { changed, note } = balance(solved, allowSet); // 就地改 solved（正确解受平衡约束）
const h1 = hist(solved);
const errFinal = meanColorErr(solved, avg); // 全部处理之后的最终色差 = **形状保真度**（越小越像原图）
// 错位模式（`--mis full|swaps`；默认：给了 `--swaps K` 就 swaps，否则 full）。
// ⚠ 模式必须在**构造之前**定：否则 `--mis full` 遇上 `--swaps 8` 仍会走交换法，
//    得到的只是 2k 颗错位（不是全盘错位）—— 静默给错东西。
const misMode = arg('mis', parseInt(arg('swaps', '0'), 10) > 0 ? 'swaps' : 'full');
if (misMode !== 'full' && misMode !== 'swaps') {
  console.error(`⚠️ --mis 只支持 full / swaps，收到 "${misMode}"`);
  process.exit(3);
}
// 错位构造二选一：swaps ⇒ 游戏口径的 k 对异色交换（仅 2k 颗错位）；full ⇒ 全盘错位（每颗都不就位）。
const swapsK = misMode === 'swaps' ? Math.max(0, parseInt(arg('swaps', '0'), 10)) : 0;
const sw = swapsK > 0 ? buildSwaps(solved, swapsK) : null;
const der = sw
  ? {
    ok: sw.pairs === swapsK,
    misplaced: sw.init,
    maxFreq: 0,
    N: 0,
    reason: sw.pairs < swapsK ? `可配对数不足（实得 ${sw.pairs}/${swapsK}）` : '',
  }
  : derange(solved);

const fillN = solved.filter((v) => v > 0).length;
const colorsUsed = h1.slice(1).filter((n) => n > 0).length;

// 出图 + 落 JSON（--no-png 跳过：预览由 Web 前端 canvas 负责，VPS 免装 chromium）
if (!has('no-png')) {
  await renderPng(solved, 'solved');
  await renderPng(der.misplaced, 'misplaced');
}
if (browser) await browser.close();
const json = {
  _proto: 'beads-gen spike (WXG-T-179 前置，未接引擎)',
  cols, rows,
  time: null,
  cycleProfile: 'long',
  pattern: toRowStrings(solved), // 正确解（= 每格底色）
  // 错位模式（`--mis full|swaps`，定法见上方 swapsK 处）：
  //   · full  = **全盘错位初盘**（每颗可填珠都不就位，成片错豆）⇒ 走 `misplaced` 字段
  //             （引擎 v1.3 起支持，入库 8 关用的就是它）；前提 = `der.ok`（Hall 条件
  //             maxFreq ≤ N/2，`balance()` 已强制）。
  //   · swaps = 游戏口径的 k 对异色交换 ⇒ 只有 2k 颗错位（29×29 盘上 k=8 仅占 ≈2%）。
  // 两模式互斥：引擎侧 `applyMisplacedToGrid` 见 misplaced 优先、忽略 swaps。
  levelDraft: (() => {
    const mis = misMode;
    const ok = mis === 'swaps' ? !!sw : der.ok;
    if (!ok) return null; // full 模式下 der.ok=false 已在自检处非零退出，这里只堆防空跑
    return {
      cols,
      rows,
      time: null,
      // 交换法构造的两两互换 = **恒为 2-环** ⇒ `short`（旧写 'long' 会被 BOOT 的
      //   validateSwaps「cycleProfile=long 与实际最长环 2 矛盾」直接拒收，2026-09-20 E2E 实测）。
      //   全盘错位走循环左移 ⇒ 长环，且 misplaced 模式下 swaps 不参与校验。
      cycleProfile: mis === 'swaps' ? 'short' : 'long',
      decoys: [],
      swaps: mis === 'swaps' ? sw.swaps : [],
      ...(mis === 'full' ? { misplaced: toRowStrings(der.misplaced) } : {}),
      pattern: toRowStrings(solved),
      // pattern 里的字符 1..N 对应的**实际色值**（本单用 Artkal；换游戏 10 色板时按此对齐色号）
      paletteHex: [...new Set(solved.filter((v) => v > 0))].sort((a, b) => a - b).map((c) => palHex[c - 1]),
    };
  })(),
  misplaced: toRowStrings(der.misplaced), // 初始全错位局面（引擎现从 swaps 装配，此处直存供人核）
  report: {
    fillable: fillN, voidCells: bgRemoved, colorsUsed,
    cap: Math.floor(fillN / 2),
    maxFreqBefore: Math.max(...h0.slice(1)), maxFreqAfter: Math.max(...h1.slice(1)),
    balancedChanged: changed.length, balanceNote: note ?? null,
    derangement: der.ok ? 'FULL (0 固定点)' : 'PARTIAL/FAIL: ' + der.reason,
    // 聚集度（用户 2026-09-19：「同色大块集中」）—— clusteringBefore = 限色后未做聚集处理
    clusteringParams: { sample, smooth: smoothRounds, minblock: minBlock, colors: colorsMax },
    colorLimit: {
      requested: colorsMax, palette: PAL_N, mode: limit.mode,
      used: colorsUsed, changed: limit.changed, kept: limit.kept,
    },
    // 形状保真度（0..441，越小越像原图）vs 聚集度（adjRate，越大越成块）—— 二者需同时看
    colorError: { beforeColorLimit: errPreLimit, final: errFinal },
    clusteringBefore: stats0,
    clusteringAfter: stats1,
    smoothChanged, mergedCells,
    clusteringMisplaced: clusterStats(der.misplaced), // 玩家实际看到的初始盘
  },
};
writeFileSync(join(outDir, 'pattern.json'), JSON.stringify(json, null, 2));

console.log('=== beads 拼豆生成报告 ===');
console.log(
  '盘面档位 ' + (boardName || '(自定义)') + '：' + cols + '×' + rows + ' = ' + cols * rows + ' 格' +
  '｜豆径 ' + beadMm + 'mm' +
  '｜物理约 ' + Math.round((cols * beadMm) / 10 * 10) / 10 + '×' + Math.round((rows * beadMm) / 10 * 10) / 10 + ' cm' +
  (preset ? '｜' + preset.note : '') +
  (shape !== 'square' ? '｜异形 ' + shape + '（形状内 ' + shapeCells + ' 格，其余为空位）' : ''),
);
console.log(`棋盘 ${cols}×${rows}=${cols * rows}  可填 ${fillN}  void ${bgRemoved}  用色 ${colorsUsed}`);
console.log(`直方图(平衡后 1..8)= ${JSON.stringify(h1.slice(1))}  cap(≤半数)= ${Math.floor(fillN / 2)}`);
console.log(`配色平衡改判 ${changed.length} 格${note ? '（' + note + '）' : ''}`);
console.log(`错位构造：${sw ? `**交换法 k=${sw.pairs}**（游戏口径，可玩）` : `全盘错位（spike 口径，仅验证破碎度；**不可直接做关卡**）`}`);
console.log(`错位打乱：${der.ok ? (sw ? `交换 ${sw.pairs} 对，全部异色 ⇒ 无固定点 ✓` : `全错位 OK（maxFreq=${der.maxFreq} ≤ ${Math.floor(fillN / 2)}，0 固定点）`) : '不可全错位 → ' + der.reason}`);
const c0 = stats0, c1 = stats1, cm = clusterStats(der.misplaced);
console.log(
  colorsMax > 0
    ? `用色限制：≤${colorsMax} 色（保留 ${JSON.stringify(limit.kept)}，重映射 ${limit.changed} 格）`
    : '用色限制：不限制（8 色全开）',
);
console.log(
  `调色板 ${PAL_N} 色` +
  (paletteArg === 'artkal'
    ? `（**Artkal S 真值** ${ARTKAL.raw} 项 → 去重 ${PAL_N}；⚠️ 游戏无对应珠色 ⇒ 不可直接入关）`
    : PAL_N > GAME_PALETTE.length
      ? '（程序化色域，⚠️ 游戏暂无对应珠色 ⇒ 不可直接入关）'
      : `（游戏真源前 ${PAL_N} 色）`) +
  `｜选色模式 ${limit.mode}｜最终用色 ${colorsUsed}` +
  (colorsUsed > 8 ? ' ⚠️ 超 BEAD_COLOR_MAX=8 ⇒ 不可入关' : ' ✅ 合规（≤ BEAD_COLOR_MAX=8）'),
);
console.log(`色差（0..441，越小越保形）：限色前 ${errPreLimit} → 最终 ${errFinal}`);
console.log(`聚集度（参数 sample=${sample} smooth=${smoothRounds} minblock=${minBlock} colors=${colorsMax}）：`);
console.log(`  处理前  块数 ${c0.blocks}  最大块 ${c0.largest}  平均块 ${c0.avg}  碎块格 ${c0.tinyCells}  同色相邻率 ${c0.adjRate}`);
console.log(`  处理后  块数 ${c1.blocks}  最大块 ${c1.largest}  平均块 ${c1.avg}  碎块格 ${c1.tinyCells}  同色相邻率 ${c1.adjRate}（滤波改 ${smoothChanged} 格、碎块并入 ${mergedCells} 格）`);
console.log(`  初始盘  块数 ${cm.blocks}  最大块 ${cm.largest}  平均块 ${cm.avg}  同色相邻率 ${cm.adjRate}  ← 玩家看到的就是它`);
console.log(`产物 → ${outDir}/{${has('no-png') ? '' : 'solved.png, misplaced.png, '}pattern.json}`);

// 断言即自检 → 非零退出。
// 2026-09-19 修：旧版写成 `if (der.ok) { …断言… }` —— **错位打乱失败时整段跳过**，
// 脚本照旧写盘并打印「自检：通过」，而 misplaced 其实是**全 void 的废盘**
// （实测 `--colors 2` 即触发：主导色 589 > cap 588）。失败必须 loud。
if (!der.ok) {
  console.error(`自检失败：错位打乱未成功 —— ${der.reason}`);
  console.error('（该参数组合产出的 misplaced 不可用；请放宽 --colors、加大 --smooth，或调整图/网格）');
  process.exit(1);
}
if (sw) {
  // **交换构造口径**：只断言「错位颗数恰 = 2k」+「每对确实异色互换」。
  // ⚠️ 不得沿用全盘错位的「无固定点」断言 —— 交换法只动 2k 颗，**其余格本就该就位**
  // （2026-09-20 实测踩到：841 格盘上跑 k=8 时误报「存在就位珠 10」）。
  let misplacedN = 0;
  for (let i = 0; i < solved.length; i++) {
    if (solved[i] > 0 && der.misplaced[i] !== solved[i]) misplacedN++;
  }
  if (misplacedN !== sw.swaps.length * 2) {
    console.error(`自检失败：错位颗数 ${misplacedN} ≠ 2k=${sw.swaps.length * 2}`);
    process.exit(1);
  }
  for (const [r1, c1, r2, c2] of sw.swaps) {
    const i1 = r1 * cols + c1;
    const i2 = r2 * cols + c2;
    if (der.misplaced[i1] !== solved[i2] || der.misplaced[i2] !== solved[i1]) {
      console.error(`自检失败：交换对 (${r1},${c1})↔(${r2},${c2}) 未按构造互换`);
      process.exit(1);
    }
  }
} else {
  for (let i = 0; i < solved.length; i++) {
    if (solved[i] > 0 && der.misplaced[i] === solved[i]) {
      console.error('自检失败：错位后存在就位珠', i);
      process.exit(1);
    }
  }
}
if (Math.max(...h1.slice(1)) > Math.floor(fillN / 2)) {
  console.error('自检失败：平衡后仍有颜色 > 半数');
  process.exit(1);
}
console.log('自检：通过');
