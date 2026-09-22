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
 *   node tools/scripts/beads-gen.mjs --in pic.jpg --board standard29 --palette artkal-s --colors 8 --mis none
 *   node tools/scripts/beads-gen.mjs --in pic.jpg --cols 29 --rows 29 --shape heart --swaps 8
 *   node tools/scripts/beads-gen.mjs                       # 无 --in ⇒ 合成 demo 图跑通全管线
 *   node tools/scripts/beads-gen.mjs --in-raw raw.json --no-png --out out  # 免浏览器路径（WXG-T-179 Web 服务）：
 *          raw.json = { w, h, data: base64(RGBA) }（前端解像后的源图像素）；--no-png 跳过 PNG 导出
 *   node tools/scripts/beads-gen.mjs --help                # 全部参数
 *
 * 入关前置（两条硬约束，都须先解）：
 *   ① rows ≤ GRID_MAX_ROWS、cols ≤ GRID_MAX_COLS（`systems-index §3.3` 冻结值）；
 *   ② paletteHex 的色值须能在游戏 BEAD_PALETTE（10 色）中找到对应珠 ——
 *      用 `--palette 10` 产出直接合规的盘（⚠️ 2026-09-21 起 UI 已下架 10 色选项，
 *      仅存 API 兼容）；artkal-s/c/r 需先接 ADR-0016 戊案（换色值）。
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
//   node temp/beads-gen.mjs --smooth 2      # 众数滤波轮数（默认 0 = 关；游戏盘大块风可开 1–2）
//   node temp/beads-gen.mjs --minblock 4    # 小于 N 格的碎块整体并入邻色（默认 1 = 关；<2 = 关）
//   node temp/beads-gen.mjs --premedian 3   # 源像素 k×k 中值滤波（0=关；3=JPEG 去噪；量化前执行）
//
// ⚠️ 聚集度是**独立目标**（用户 2026-09-19 反馈：「豆子要尽量同色大块集中，以触发连续填充」）：
//    与「配色平衡 ≤½」（只保证全盘错位有解，不保证成块）不是一回事。四个旋钮力度递增：
//    `--premedian`（源像素中值，消 JPEG 伪影）→ `--sample`（块内众数投票）→ `--smooth`（格级众数滤波）→ `--minblock`（碎块并入，最激进）。
//    报告的「同色相邻率 / 碎块占比 / 块数」是量化判据，别凭肉眼。

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
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
// v1.40：demo 十色真源 = `games/beads/design/levels/palette.json` 的 `palette`
// （game-10.json 已删除，v1.40 品牌引用制；关卡内容管线 P1 起从 levels-01-08.json
// 顶层抽出为独立 palette.json）；与 view/palette.ts DEMO_BEAD_INKS 同源（sync 门禁）。
const GAME_PALETTE = (() => {
  try {
    return JSON.parse(readFileSync(join(SCRIPT_DIR, '../../games/beads/design/levels/palette.json'), 'utf8')).palette;
  } catch {
    console.error('⚠️ demo 色板真源 palette.json 缺失（关卡内容管线 P1 目录化后真源）');
    process.exit(3);
  }
})();
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
// cols/rows 用 let：异形盘包围盒裁剪（下方 trim 块）会重赋值为裁后尺寸，下游全走裁后坐标
let cols = hasExplicitSize ? Math.max(1, parseInt(arg('cols', '12'), 10)) : preset?.cols ?? 12;
let rows = hasExplicitSize ? Math.max(1, parseInt(arg('rows', '12'), 10)) : preset?.rows ?? 12;
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
const smoothRounds = Math.max(0, parseInt(arg('smooth', '0'), 10)); // 众数滤波轮数（0 = 关；默认关：滤波会抹掉 2–3 格小特征，实物还原主用例受伤 2026-09-21）
const minBlock = Math.max(0, parseInt(arg('minblock', '1'), 10)); // 碎块并入阈值（格；<2 = 关。默认关：同理保小特征 2026-09-21）
const colorsMax = Math.max(0, parseInt(arg('colors', '0'), 10)); // 用色数上限（0/≥色板大小 = 不限制）
const paletteArg = arg('palette', 'artkal-s'); // 品牌色板 slug（games/beads/art/<slug>.json：artkal-s/c/a/m/r、hama-*、perler*、nabbi、yant、mard、diamond-dotz）| 数字（程序化色域；'10' 游戏真源已从 UI 下架，仅 API 兼容）
const colorsMode = arg('colorsmode', 'error'); // freq（频次优先）| error（ 误差最小优先；默认；仅 keptPx 为空时生效）
const cellmode = arg('cellmode', 'mode'); // 格级映射风格：mode=主导色（卡通干净）| avg=平均色（照片纹理）
const premedian = Math.max(0, parseInt(arg('premedian', '0'), 10)); // 源像素中值滤波核大小（0=关；3或5）；在 buildGrid 量化前执行，消 JPEG 块状伪影
if (!['mode', 'avg'].includes(cellmode)) {
  console.error('⚠️ --cellmode 只支持 mode / avg');
  process.exit(3);
}
const isBrandPalette = !/^[0-9]+$/.test(paletteArg); // 非纯数字 = 品牌 slug（⚠️ slug 需匹配 [a-z0-9-]，防路径穿越）
const paletteSize = isBrandPalette ? 0 : Math.max(2, parseInt(paletteArg, 10));

// 色板落地：数字 ⇒ `buildPalette`；slug ⇒ 读 `games/beads/art/<slug>.json`（真实品牌色，去重）
const BRAND = (() => {
  if (!isBrandPalette) return null;
  if (!/^[a-z0-9-]+$/.test(paletteArg)) {
    console.error(`⚠️ --palette 非法 slug：${paletteArg}`);
    process.exit(3);
  }
  try {
    // 色板数据是**入库资产**（games/beads/art/）；兼容 spike 期 artkal-s 放 temp/ 的老位置
    const j = (() => {
      for (const f of [
        // ⚠️ 不能放 `design/levels/` —— 目录模式（P1 起）下该目录顶层出现 manifest/palette 以外的
        //    关卡 .json 即触发 sync「stray/歧义」断言报红（旧「恰 1 JSON」 WXG-T-048 门禁同一后果）。故色板归美术资产目录。
        join(SCRIPT_DIR, `../games/beads/art/${paletteArg}.json`),
        join(SCRIPT_DIR, `../../games/beads/art/${paletteArg}.json`),
        paletteArg === 'artkal-s' ? join(process.cwd(), 'temp/artkal-palette.json') : '', // 老位置仅 artkal-s 兼容
      ]) {
        if (!f) continue;
        try { return JSON.parse(readFileSync(f, "utf8")); } catch { /* try next */ }
      }
      return null;
    })();
    if (!j) return null;
    // 去重同步 codes：Set 去重 hex 时保留首个索引，色号随同取同位（v1.40 品牌引用制：关卡存色号不存 hex）
    const uniq = new Map();
    j.palette.forEach((h, i) => { if (!uniq.has(h)) uniq.set(h, (j.codes ?? [])[i] ?? null); });
    return { hex: [...uniq.keys()], codes: [...uniq.values()], src: j._source, raw: j.palette.length };
  } catch {
    return null;
  }
})();
if (isBrandPalette && !BRAND) {
  console.error(`⚠️ --palette ${paletteArg} 需要 games/beads/art/${paletteArg}.json（未找到，见 WXG-T-179）`);
  process.exit(3);
}
const palHex = isBrandPalette ? BRAND.hex : buildPalette(paletteSize);
const palRgb = palHex.map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
});
const PAL_N = palHex.length;

// ── 感知色差（Lab ΔE76，2026-09-21 选项A）：RGB 欧氏把阴影绿判到橄榄、高光混色判到灰青
// （1f59 取证 + 开源对比：pixel2perler 用 CIEDE2000、Zippland 把 Lab 列入 roadmap）。
// 取 ΔE76 而非 CIEDE2000：每像素 ×210 色板色的最近邻搜索下性价比最高，不够再升。
function rgb2lab(r, g, b) {
  const f = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  r = f(r); g = f(g); b = f(b);
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const h = (t) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  x = h(x); z = h(z);
  const yy = h(y);
  return [116 * yy - 16, 500 * (x - yy), 200 * (yy - z)];
}
const PAL_LAB = palRgb.map(([r, g, b]) => rgb2lab(r, g, b));
/** RGB(0..255) → 最近色板色号(1..PAL_N)，Lab 感知距离。 */
function nearestPal(r, g, b) {
  const q = rgb2lab(r, g, b);
  let best = 1, bd = Infinity;
  for (let p = 0; p < PAL_N; p++) {
    const t = PAL_LAB[p];
    const dd = (t[0] - q[0]) ** 2 + (t[1] - q[1]) ** 2 + (t[2] - q[2]) ** 2;
    if (dd < bd) { bd = dd; best = p + 1; }
  }
  return best;
}
mkdirSync(outDir, { recursive: true });

// ── 纯逻辑（Node 侧，可独立推理/断言）────────────────────────────────────────
/** 两色板索引(1..PAL_N)间的 Lab 感知距离平方（原 RGB 欧氏，2026-09-21 选项A）。 */
function palDist(a, b) {
  const x = PAL_LAB[a - 1];
  const y = PAL_LAB[b - 1];
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
    // 贪心 k-medoids 起步 + **Lloyd 式迭代细化**（libimagequant 经验，2026-09-21 选项A）：
    // 单遍贪心会停在坏局部最优（实证 1f59：树冠橄榄 #345621 ×162 抢走深绿主体）。
    // 距离用 Lab 感知色差（cellLab = 每格平均色的 Lab，预计算避免迭代内重复转换）。
    const cells = [];
    const cellLab = [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > 0) { cells.push(i); cellLab.push(rgb2lab(avg[i * 3], avg[i * 3 + 1], avg[i * 3 + 2])); }
    }
    const BIG = 1e9;
    const near = new Array(cells.length).fill(BIG);
    kept = [];
    const chosen = new Set();
    while (kept.length < n) {
      let bestC = -1, bestGain = -1;
      for (let c = 1; c <= PAL_N; c++) {
        if (chosen.has(c)) continue;
        const p = PAL_LAB[c - 1];
        let gain = 0;
        for (let k = 0; k < cells.length; k++) {
          const q = cellLab[k];
          const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
          if (d < near[k]) gain += near[k] - d;
        }
        if (gain > bestGain) { bestGain = gain; bestC = c; }
      }
      if (bestC < 0) break;
      kept.push(bestC);
      chosen.add(bestC);
      const p = PAL_LAB[bestC - 1];
      for (let k = 0; k < cells.length; k++) {
        const q = cellLab[k];
        const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
        if (d < near[k]) near[k] = d;
      }
    }
    // Lloyd 迭代：重分配 → 每簇在 210 色里换「簇内总距离最小」的簇心（仍是真实珠色），直到稳定。
    for (let it = 0; it < 8; it++) {
      const members = new Map(); // 色号 → [cellIdx in cells]
      for (const c of kept) members.set(c, []);
      for (let k = 0; k < cells.length; k++) {
        let best = kept[0], bd = Infinity;
        for (const c of kept) {
          const p = PAL_LAB[c - 1], q = cellLab[k];
          const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
          if (d < bd) { bd = d; best = c; }
        }
        members.get(best).push(k);
      }
      let moved = 0;
      const next = [];
      for (const [c, ms] of members) {
        if (ms.length === 0) continue; // 空簇淘汰
        let bestC = c, bd = Infinity;
        for (let cc = 1; cc <= PAL_N; cc++) {
          const p = PAL_LAB[cc - 1];
          let s = 0;
          for (const k of ms) {
            const q = cellLab[k];
            s += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
          }
          if (s < bd) { bd = s; bestC = cc; }
        }
        if (bestC !== c) moved++;
        next.push(bestC);
      }
      next.sort((a, b) => a - b);
      const stable = moved === 0 && next.length === kept.length && next.every((v, i) => v === kept[i]);
      kept = next.length ? next : kept;
      if (stable) break;
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

// ── 浏览器侧：解码源图 → 区域缩放像素缓冲（量化/限色统一在 Node 侧 buildGrid 做），及导出 PNG ──
// ⚠ 不在顶层启动浏览器：`--in-raw --no-png`（Web 服务路径）必须完全不碰 chromium，
//    故页面一律由 readGrid / renderPng 内部的 ensurePage() **按需**创建。

async function readGrid() {
  await ensurePage();
  return await page.evaluate(
    async ({ w, h, pal, srcBase64, skew, K }) => {
      const cv = document.createElement('canvas');
      let W, H, R, G, B;
      if (!srcBase64) {
        // ── 合成图（demo/skew）：按公式直出，每格色复制成 K×K 块（与真图路径同构）──
        W = w * K; H = h * K;
        R = new Array(W * H); G = new Array(W * H); B = new Array(W * H);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const gx = (x / K) | 0, gy = (y / K) | 0;
            let idx; // palette 0-based
            if (skew) {
              idx = (gx * 3 + gy * 5) % 10 < 7 ? 0 : 1 + ((gx + gy) % Math.min(3, pal.length - 1)); // 色0 约 70%，逼出主导色
            } else {
              idx = (gx * 3 + gy * 5) % Math.min(5, pal.length); // 5 色近均布（板小则退化为可用色数）
            }
            const p = pal[idx];
            const ti = y * W + x;
            R[ti] = p[0]; G[ti] = p[1]; B[ti] = p[2];
          }
        }
        return { W, H, R, G, B, A: null };
      }

      // ── 真图：**超采样**平滑缩放到 w·K × h·K（2026-09-19 口径保留）──
      // 旧口径 = 最近邻缩放、每格取 1 个像素 ⇒ 高频细节直接变单格色差 ⇒ 碎块遍地。
      // 量化与限色已统一移到 Node 侧 buildGrid（像素级 k-means 限色 + 格级映射）。
      W = w * K; H = h * K;
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
      R = new Array(W * H); G = new Array(W * H); B = new Array(W * H);
      for (let i = 0; i < W * H; i++) {
        R[i] = d[i * 4]; G[i] = d[i * 4 + 1]; B[i] = d[i * 4 + 2];
      }
      return { W, H, R, G, B, A: null };
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

/**
 * 源像素 k×k 中值滤波（R/G/B 各通道独立，A 通道保持原样）。
 * 在 buildGrid 量化前执行，将 JPEG 块状伪影在源头抹除，再送入 k-means。
 * 边界格保留原値；透明邻格按中心复制（不把 void 像素的色拉进来）。
 * @param {{W:number,H:number,R:Float64Array,G:Float64Array,B:Float64Array,A:Uint8Array}} px
 * @param {number} k 奇数滤滤核（3 或 5）
 */
function medianFilterPx(px, k) {
  const { W, H, R, G, B, A } = px;
  if (!W || !H || k < 3) return px;
  const half = k >> 1;
  const kk = k * k;
  const nR = Float64Array.from(R);
  const nG = Float64Array.from(G);
  const nB = Float64Array.from(B);
  const buf = new Float64Array(kk);
  /** 插入排序找中位（kk=9/25，比全排快；每次调用完全覆写 buf）。*/
  function chanMedian(src, ci) {
    let bi = 0;
    for (let dy = -half; dy <= half; dy++)
      for (let dx = -half; dx <= half; dx++) {
        const ni = (ci / W + dy | 0) * W + (ci % W + dx);
        buf[bi++] = (A && !A[ni]) ? src[ci] : src[ni];
      }
    // 插入排序到升序，取中位
    for (let i = 1; i < kk; i++) {
      const v = buf[i]; let j = i - 1;
      while (j >= 0 && buf[j] > v) { buf[j + 1] = buf[j]; j--; }
      buf[j + 1] = v;
    }
    return buf[kk >> 1];
  }
  for (let y = half; y < H - half; y++)
    for (let x = half; x < W - half; x++) {
      const ci = y * W + x;
      if (A && !A[ci]) continue; // 中心透明，不滤
      nR[ci] = chanMedian(R, ci);
      nG[ci] = chanMedian(G, ci);
      nB[ci] = chanMedian(B, ci);
    }
  return { W, H, R: nR, G: nG, B: nB, A };
}

// ── 纯 Node 侧：--in-raw 免浏览器路径（WXG-T-179 Web 服务复用；前端解好像素后发 RGBA）──
// 输入 = JSON { w, h, data: base64(RGBA) }。
// 只做第一步区域平均缩放（等价浏览器 imageSmoothing 缩到 cols·K × rows·K；alpha<128 不参与）；
// 量化与限色统一在 buildGrid（2026-09-21 前曾在此逐像素全色板投票，已并入统一管线）。
function readPixelsRaw(raw) {
  const sw = raw.w, sh = raw.h;
  const buf = Buffer.from(raw.data, 'base64');
  if (buf.length < sw * sh * 4) {
    console.error(`--in-raw 数据不足：${buf.length} < ${sw}×${sh}×4`);
    process.exit(3);
  }
  const W = cols * sample, H = rows * sample;
  const R = new Float64Array(W * H), G = new Float64Array(W * H), B = new Float64Array(W * H);
  const A = new Uint8Array(W * H); // 0 = 整块透明
  for (let ty = 0; ty < H; ty++) {
    const y0 = Math.floor((ty * sh) / H), y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * sh) / H));
    for (let tx = 0; tx < W; tx++) {
      const x0 = Math.floor((tx * sw) / W), x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * sw) / W));
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * sw + x) * 4;
          if (buf[o + 3] < 128) continue; // 透明像素不参与（前端抠图/异形源友好）
          sr += buf[o]; sg += buf[o + 1]; sb += buf[o + 2]; n++;
        }
      }
      const ti = ty * W + tx;
      R[ti] = n ? sr / n : 255; G[ti] = n ? sg / n : 255; B[ti] = n ? sb / n : 255;
      A[ti] = n ? 1 : 0;
    }
  }
  return { W, H, R, G, B, A };
}

function nearestLabIdx(q, labs) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < labs.length; i++) {
    const p = labs[i];
    const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

// 确定性 k-means（Lab 空间，L4：无随机——最远点初始化 + Lloyd 迭代）
function kmeansLab(pts, k) {
  const centers = [pts[0].slice()];
  const minD = new Float64Array(pts.length).fill(Infinity);
  while (centers.length < k) {
    const last = centers[centers.length - 1];
    let bi = -1, bd = 0;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      const d = (last[0] - q[0]) ** 2 + (last[1] - q[1]) ** 2 + (last[2] - q[2]) ** 2;
      if (d < minD[i]) minD[i] = d;
      if (minD[i] > bd) { bd = minD[i]; bi = i; }
    }
    if (bd <= 1e-12) break; // 剩余点几乎重合，凑不满 k
    centers.push(pts[bi].slice());
  }
  for (let it = 0; it < 12; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const q of pts) {
      const s = sums[nearestLabIdx(q, centers)];
      s[0] += q[0]; s[1] += q[1]; s[2] += q[2]; s[3]++;
    }
    let moved = 0;
    for (let c = 0; c < centers.length; c++) {
      const s = sums[c];
      if (!s[3]) continue; // 空簇保持原簇心
      const nc = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
      if ((nc[0] - centers[c][0]) ** 2 + (nc[1] - centers[c][1]) ** 2 + (nc[2] - centers[c][2]) ** 2 > 1e-9) moved++;
      centers[c] = nc;
    }
    if (!moved) break;
  }
  return centers;
}

// ── 像素级限色 + 格级映射（2026-09-21，对标 makebead / 豆豆龙类在线工具）────────
// 根因实证：旧架构在**格级**才限色——红苹果/黑轮廓到那时只剩 1-3 格，贪心 k-medoids
// 按「总色差收益」选色必输给大片区域的色阶内耗（8 席全被绿的微妙渐变占掉）。在线工具
// 都在**像素级**限色：小特征此时还是几千像素的大簇，稳占一席；然后再逐格映射。
//   · 簇心吸附到最近品牌真值色（保证可采购；kept 去重后可能 < k）。
//   · cellmode：mode=格内主导色（卡通干净，对标 makebead）| avg=格均色就近（照片纹理，对标豆豆龙）。
function buildGrid(px, n, cellmode) {
  const { W, H, R, G, B, A } = px;
  const LAB = new Float64Array(W * H * 3); // 每像素 Lab（k-means 与格级映射共用）
  const pts = [];
  for (let i = 0; i < W * H; i++) {
    if (A && !A[i]) continue;
    const l = rgb2lab(Math.round(R[i]), Math.round(G[i]), Math.round(B[i]));
    LAB[i * 3] = l[0]; LAB[i * 3 + 1] = l[1]; LAB[i * 3 + 2] = l[2];
    pts.push(l);
  }
  let colors; // 本轮可用色号（kept 非空 = 已做像素级限色）
  if (n > 0 && n < PAL_N && pts.length) {
    const seen = new Set();
    for (const c of kmeansLab(pts, Math.min(n, pts.length))) seen.add(nearestLabIdx(c, PAL_LAB) + 1);
    colors = [...seen].sort((a, b) => a - b);
  } else {
    colors = Array.from({ length: PAL_N }, (_, i) => i + 1); // 不限制 → 全色板
  }
  const mapLab = colors.map((c) => PAL_LAB[c - 1]);
  const grid = new Array(cols * rows).fill(0);
  const avg = new Array(cols * rows * 3).fill(0);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const vote = new Array(mapLab.length).fill(0);
      let sr = 0, sg = 0, sb = 0, nn = 0;
      for (let sy = 0; sy < sample; sy++) {
        for (let sx = 0; sx < sample; sx++) {
          const ti = (cy * sample + sy) * W + cx * sample + sx;
          if (A && !A[ti]) continue;
          vote[nearestLabIdx([LAB[ti * 3], LAB[ti * 3 + 1], LAB[ti * 3 + 2]], mapLab)]++;
          sr += R[ti]; sg += G[ti]; sb += B[ti]; nn++;
        }
      }
      const gi = cy * cols + cx;
      if (!nn) continue; // 整格透明 ⇒ 空位
      avg[gi * 3] = Math.round(sr / nn);
      avg[gi * 3 + 1] = Math.round(sg / nn);
      avg[gi * 3 + 2] = Math.round(sb / nn);
      if (cellmode === 'avg') {
        grid[gi] = colors[nearestLabIdx(rgb2lab(avg[gi * 3], avg[gi * 3 + 1], avg[gi * 3 + 2]), mapLab)];
      } else { // 主导色：平局取小下标（确定性）
        let bi = 0, bn = 0;
        for (let p = 0; p < vote.length; p++) if (vote[p] > bn) { bn = vote[p]; bi = p; }
        grid[gi] = colors[bi];
      }
    }
  }
  return { grid, avg, kept: colors.length < PAL_N ? colors : [] };
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
const _rawPx = inRawPath
  ? readPixelsRaw(JSON.parse(readFileSync(inRawPath, 'utf8')))
  : await readGrid();
const px = premedian >= 3 ? medianFilterPx(_rawPx, premedian) : _rawPx;
const { grid, avg: avg0, kept: keptPx } = buildGrid(px, colorsMax, cellmode);
let avg = avg0; // let：异形盘包围盒裁剪（下方 trim 块）会重赋为裁后 avg

// 去背景：取四边框里最常见的一色当背景 → void（0）。--noframe 则整盘可填。
// ⚠️ 异形盘（shape ≠ square）**自动跳过**本步 —— 形状本身就是图案边界，
//    再从「四边框」取背景会把形状边缘误判成背景。
// **2026-09-19 改（用户「同色大块集中」诉求）**：旧口径把**全盘所有**该色格都设为 void ——
// 主体内部与背景同色的区域会被一并挖掉，直接把大色块切成碎块（并为后续平滑制造假边界）。
// 改为**只删「自四边框 4 连通可达」**的该色格（flood fill）⇒ 背景照旧干净，主体内部同色保留。
let solved = grid.slice();

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

// ── 包围盒裁剪（2026-09-21 用户拍板「异形盘」）：全空行/列不算宽高——背景去格/形状
//    掩码后边缘的 void 行列白占 cols/rows（39×39 的树裁完 ≈33×36），游戏导入尺寸门更易
//    过、玩法盘面更满、物理尺寸更贴近实际用盘。插在聚集/平衡/错位构造**之前**
//    ⇒ 下游（smooth/balance/sw/der/renderPng/toRowStrings）全部走裁后坐标。
//    noframe（铺满整盘）无 void ⇒ bbox=整盘，trim 空转。
{
  let c0 = cols, c1 = -1, r0 = rows, r1 = -1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (solved[r * cols + c] > 0) {
      if (c < c0) c0 = c;
      if (c > c1) c1 = c;
      if (r < r0) r0 = r;
      if (r > r1) r1 = r;
    }
  }
  if (c1 >= 0 && (c0 > 0 || r0 > 0 || c1 < cols - 1 || r1 < rows - 1)) {
    const nc = c1 - c0 + 1, nr = r1 - r0 + 1;
    const s2 = new Array(nc * nr).fill(0);
    const a2 = new Array(nc * nr * 3).fill(0);
    for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
      const si = (r + r0) * cols + c + c0, di = r * nc + c;
      s2[di] = solved[si];
      a2[di * 3] = avg[si * 3];
      a2[di * 3 + 1] = avg[si * 3 + 1];
      a2[di * 3 + 2] = avg[si * 3 + 2];
    }
    console.error(`# trim ${cols}×${rows} → ${nc}×${nr}（裁空边：左${c0} 右${cols - 1 - c1} 上${r0} 下${rows - 1 - r1}）`);
    solved = s2; avg = a2; cols = nc; rows = nr;
  }
}

// 用色数上限：像素级 k-means 已在 buildGrid 内完成（keptPx 非空时跳过格级 limitColors，
// 避免对已限色网格重复选色）；keptPx 为空（不限制）时走原格级逻辑兑底。
const errPreLimit = meanColorErr(solved, avg); // keptPx 非空时 solved 已限色，此值≈限色后
const limit = keptPx.length
  ? { changed: 0, kept: keptPx, mode: `pixel-kmeans/${cellmode}` }
  : limitColors(solved, colorsMax, colorsMode, avg);

// 聚集度处理（力度递增；三步与「配色平衡」「错位打乱」互不冲突，可自由组合）：
//   stats0 → 众数滤波 → 碎块并入 → stats1，报告里给出前后对比，便于调参。
const stats0 = clusterStats(solved); // 限色后、聚集处理前（基线）
const smoothChanged = smooth(solved, smoothRounds);
const mergedCells = mergeSmallBlocks(solved, minBlock);
const stats1 = clusterStats(solved); // 聚集处理后

const h0 = hist(solved);
// ⚠️ 必须把 `--colors` 的保留色集传给 balance（否则它会把禁用色复活，见其头注）
const allowSet = limit.kept.length ? new Set(limit.kept) : null;
// 错位模式（`--mis full|swaps|none`；默认：给了 `--swaps K` 就 swaps，否则 full）。
// ⚠ 模式必须在**构造之前**定：否则 `--mis full` 遇上 `--swaps 8` 仍会走交换法，
//    得到的只是 2k 颗错位（不是全盘错位）—— 静默给错东西。
const misMode = arg('mis', parseInt(arg('swaps', '0'), 10) > 0 ? 'swaps' : 'full');
if (misMode !== 'full' && misMode !== 'swaps' && misMode !== 'none') {
  console.error(`⚠️ --mis 只支持 full / swaps / none，收到 "${misMode}"`);
  process.exit(3);
}
// mis=none（实物图纸模式）：跳过配色平衡 —— balance 是为全错位构造的前提（主导色 ≤ N/2，
// Hall 条件）服务的；实物还原不需要错位，强钳主导色只会把大片树冠绿改成棕黑（2026-09-21
// 用户实测「树都不绿了」的根因，balancedChanged=103）。
const { changed, note } = misMode === 'none'
  ? { changed: [], note: 'mis=none 实物图纸模式：跳过配色平衡（不做主导色 ≤ N/2 钳制）' }
  : balance(solved, allowSet); // 就地改 solved（正确解受平衡约束）
const h1 = hist(solved);
const errFinal = meanColorErr(solved, avg); // 全部处理之后的最终色差 = **形状保真度**（越小越像原图）
// 错位构造二选一：swaps ⇒ 游戏口径的 k 对异色交换（仅 2k 颗错位）；full ⇒ 全盘错位（每颗都不就位）。
const swapsK = misMode === 'swaps' ? Math.max(0, parseInt(arg('swaps', '0'), 10)) : 0;
const sw = swapsK > 0 ? buildSwaps(solved, swapsK) : null;
const der = misMode === 'none'
  ? { ok: false, misplaced: null, maxFreq: 0, N: 0, reason: 'mis=none（实物图纸，不做错位）' }
  : sw
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
  pattern: toRowStrings(solved), // 正确解（= 每格底色）
  // 色号紧凑序 → 实际 hex（与 toRowStrings 的重编号对齐：pattern 字符第 i 个用色 ↔ paletteHex[i]；
  // 供 Web 前端忠实预览 artkal 色值，levelDraft 内另有自包含副本）
  paletteHex: [...new Set(solved.filter((v) => v > 0))].sort((a, b) => a - b).map((c) => palHex[c - 1]),
  // 紧凑序色号（v1.40 品牌引用制）：品牌模式下游戏侧按 slug+codes 从注册表查 hex；
  // demo/程序化色板无色号语义 → 省略字段（关卡回落顶层默认色板）
  ...(isBrandPalette ? { paletteCodes: [...new Set(solved.filter((v) => v > 0))].sort((a, b) => a - b).map((c) => BRAND.codes[c - 1]) } : {}),
  time: null,
  cycleProfile: 'long',
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
      // pattern 字符（紧凑序第 i 个用色）对应的**实际色值**：paletteHex[i]
      paletteHex: [...new Set(solved.filter((v) => v > 0))].sort((a, b) => a - b).map((c) => palHex[c - 1]),
      ...(isBrandPalette ? { paletteCodes: [...new Set(solved.filter((v) => v > 0))].sort((a, b) => a - b).map((c) => BRAND.codes[c - 1]) } : {}),
    };
  })(),
  misplaced: der.misplaced ? toRowStrings(der.misplaced) : [], // 初始全错位局面（mis=none 时无）
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
    clusteringMisplaced: der.misplaced ? clusterStats(der.misplaced) : null, // 玩家实际看到的初始盘
    // 难度/时长 = **生成期真引擎实测**（§3.5 v1.41 · 公式 v0.2）：本文件**不再自带公式**。
    // v0.1 按颗定价（M × 22.5 × f_N × f_C × g_A）已作废 —— 32 盘语料 32/32 触顶 420s、
    // 隐含 s/tap 跨 0.46–70s（150 倍）。证据：games/beads/design/forensics/diff-v02/grid.log.txt。
    // 此处占位 null，写盘后由 beads-bot.ts `--patch` 回填（mis=none 实物图纸无错位 ⇒ 终为 null）。
    difficulty: null,
  },
};
const patternPath = join(outDir, 'pattern.json');
writeFileSync(patternPath, JSON.stringify(json, null, 2));

// ── 生成期真引擎实测（§3.5 v1.41 · 公式 v0.2）───────────────────────────────
// 正源 = bot 实测点击数 × `SEC_PER_TAP`（装配走生产 BOOT、每步走 BeadsGame 公开命令）。
// 结果暂存 `measured`，报告末尾统一打印并据 blockers **拒产**（用户 2026-09-21 拍板「硬拦」）。
// 容器内无 games/ 引擎（deploy.sh 只 rsync 三单元）⇒ spawn 失败时写 error 字段，
// **不静默回落到失真的静态公式**；入关期（server `ingestLevel`，仅本地仓）会再测并硬拦。
let measured = null;
if (misMode !== 'none' && der.ok && der.misplaced) {
  const r = spawnSync(process.execPath, [
    '--experimental-transform-types',
    '--import=./games/beads/design/forensics/g3/g3-hooks.mjs',
    'tools/scripts/beads-bot.ts', patternPath, '--patch',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  const last = (r.stdout || '').trim().split('\n').pop();
  measured = last && last.startsWith('{') ? JSON.parse(last) : null; // stdout 最后一行 = 结果 JSON
  if (!measured) {
    // 无引擎（容器）或 bot 崩溃：标记未实测，不给假数。
    json.report.difficulty = { error: `beads-bot 不可用（exit=${r.status}）：未实测，难度/时长待入关期补测`, stderr: (r.stderr || '').slice(-300) };
    writeFileSync(patternPath, JSON.stringify(json, null, 2));
  }
}

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
const c0 = stats0, c1 = stats1, cm = der.misplaced ? clusterStats(der.misplaced) : null; // mis=none 无错位盘
console.log(
  colorsMax > 0
    ? `用色限制：≤${colorsMax} 色（保留 ${JSON.stringify(limit.kept)}，重映射 ${limit.changed} 格）`
    : '用色限制：不限制（8 色全开）',
);
console.log(
  `调色板 ${PAL_N} 色` +
  (isBrandPalette
    ? `（**${paletteArg} 真值** ${BRAND.raw} 项 → 去重 ${PAL_N}；⚠️ 游戏无对应珠色 ⇒ 不可直接入关）`
    : PAL_N > GAME_PALETTE.length
      ? '（程序化色域，⚠️ 游戏暂无对应珠色 ⇒ 不可直接入关）'
      : `（游戏真源前 ${PAL_N} 色）`) +
  `｜选色模式 ${limit.mode}｜最终用色 ${colorsUsed}` +
  (colorsUsed > 10 ? ' ⚠️ 超 BEAD_COLOR_MAX=10 ⇒ 不可入关' : ' ✅ 合规（≤ BEAD_COLOR_MAX=10）'),
);
console.log(`色差（0..441，越小越保形）：限色前 ${errPreLimit} → 最终 ${errFinal}`);
console.log(`聚集度（参数 premedian=${premedian} sample=${sample} smooth=${smoothRounds} minblock=${minBlock} colors=${colorsMax}）：`);
console.log(`  处理前  块数 ${c0.blocks}  最大块 ${c0.largest}  平均块 ${c0.avg}  碎块格 ${c0.tinyCells}  同色相邻率 ${c0.adjRate}`);
console.log(`  处理后  块数 ${c1.blocks}  最大块 ${c1.largest}  平均块 ${c1.avg}  碎块格 ${c1.tinyCells}  同色相邻率 ${c1.adjRate}（滤波改 ${smoothChanged} 格、碎块并入 ${mergedCells} 格）`);
console.log(`  初始盘  块数 ${cm ? cm.blocks : '—'}  最大块 ${cm ? cm.largest : '—'}  平均块 ${cm ? cm.avg : '—'}  同色相邻率 ${cm ? cm.adjRate : '—'}  ← 玩家看到的就是它${cm ? '' : '（mis=none：无错位盘，玩家拼的就是正确解）'}`);
console.log(`产物 → ${outDir}/{${has('no-png') ? '' : 'solved.png, misplaced.png, '}pattern.json}`);
console.log(
  measured
    ? `难度 D${measured.difficulty}｜真引擎实测 ${measured.taps} 次点击（bot 通关=${measured.cleared ? 'Y' : 'N'}）｜预估清关 ${measured.time}s（公式 v0.2 = taps × SEC_PER_TAP，§5）`
    : misMode === 'none'
      ? '难度 ——（mis=none 实物图纸，无错位无难度）'
      : '难度 ——（本环境无引擎，未实测；入关期会再测并硬拦）',
);

// 断言即自检 → 非零退出。
// 2026-09-19 修：旧版写成 `if (der.ok) { …断言… }` —— **错位打乱失败时整段跳过**，
// 脚本照旧写盘并打印「自检：通过」，而 misplaced 其实是**全 void 的废盘**
// （实测 `--colors 2` 即触发：主导色 589 > cap 588）。失败必须 loud。
if (!der.ok && misMode !== 'none') {
  // mis=none 实物图纸模式：不做错位，der.ok=false 是预期值，不视为失败
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
} else if (misMode !== 'none') {
  // mis=none 无错位盘，全错位断言不适用
  for (let i = 0; i < solved.length; i++) {
    if (solved[i] > 0 && der.misplaced[i] === solved[i]) {
      console.error('自检失败：错位后存在就位珠', i);
      process.exit(1);
    }
  }
}
if (misMode !== 'none' && Math.max(...h1.slice(1)) > Math.floor(fillN / 2)) {
  // mis=none 不做平衡钳制，主导色超半数是实物图纸的预期形态（如树冠大块绿）
  console.error('自检失败：平衡后仍有颜色 > 半数');
  process.exit(1);
}
console.log('自检：通过');

// 硬拦放在最后：拒产时用户仍能看完整报告（知道为何被拒）。
if (measured && measured.blockers.length) {
  console.error(`⛔ 拒产：${measured.blockers.join('；')}`);
  console.error('（该盘在倒计时预算内不可能通关；减小盘面 / 降低错位密度后重生）');
  process.exit(4);
}
