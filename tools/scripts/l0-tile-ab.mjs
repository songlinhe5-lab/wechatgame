// S5′-2 底 tile 收口取证（WXG-T-254 / ADR-0030 §5.4 第十四刀）。
//
// 跑法：先 `pnpm run harness:build`（吃 dist 里的**上线同款**合成函数），再 `node tools/scripts/l0-tile-ab.mjs`。
// 出图落 production/qa/beads/evidence/l0-tile-ab/（png 按 .gitignore 体例留盘不入库）。
//
// 用**要上线的那套合成函数**（`compositeTintMask` + 真 mask PNG + `composeMaskTile`）在 Node 里出图：
//   P0 = 今日现网（B0 平色 rect + 格面/珠面 sprite）
//   P1 = 甲（一张带槽底 tile 扩边到 pitch，填格也用它）
//   P2 = 乙（空格带槽 tile，填格平色 tile）
// 另出 P0↔P1、P0↔P2 的填格局部 8× 差值图。
import { readPngRgba } from '../../tools/mask-preview/lib/png-rgba.mjs';
import { compositeTintMask, parseTintColor } from '../../dev/harness/dist/packages/framework/src/core/bake/tint-composite.js';
import { composeMaskTile, maskTileInnerPx } from '../../dev/harness/dist/packages/framework/src/core/bake/mask-tile.js';
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const OUT = join(ROOT, 'production/qa/beads/evidence/l0-tile-ab');
mkdirSync(OUT, { recursive: true });
const TEX = join(ROOT, 'games/beads/cocos/assets/textures');

const PXDP = 4;
const PITCH = 32 * PXDP;
const CELLS = 4;
const PANEL_W = CELLS * PITCH;
const GAP = 24;
const TOTAL_W = PANEL_W * 5 + GAP * 4;
const BASE_D = 0.7; // 格外/B0 = mix(base, −0.30) ⇒ d = 0.70（mask-spec outsideD）

// ── 画布 ───────────────────────────────────────────────────────────────
const make = (w, h, rgb = [255, 255, 255]) => {
  const d = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255;
  }
  return { d, w, h };
};

function fillRect(c, x, y, w, h, rgb) {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(c.w, Math.round(x + w)), y1 = Math.min(c.h, Math.round(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * c.w + px) * 4;
      c.d[i] = rgb[0]; c.d[i + 1] = rgb[1]; c.d[i + 2] = rgb[2]; c.d[i + 3] = 255;
    }
  }
}

/** 双线性采样 + source-over（目标恒不透明 ⇒ 只混 RGB；纹理按正方形处理）。 */
function blit(c, spr, side, cx, cy, size) {
  blitInto({ d: c.d, w: c.w, h: c.h }, spr, side, cx - size / 2, cy - size / 2, size);
}

/** 左上角定位的 source-over 缩放贴（目标恒不透明）。 */
function blitInto(c, spr, side, x0f, y0f, size) {
  const sw = side;
  const sh = side;
  const sx = sw / size, sy = sh / size;
  const x0 = Math.round(x0f), y0 = Math.round(y0f);
  for (let py = 0; py < size; py++) {
    const dy = y0 + py;
    if (dy < 0 || dy >= c.h) continue;
    for (let px = 0; px < size; px++) {
      const dx = x0 + px;
      if (dx < 0 || dx >= c.w) continue;
      const u = (px + 0.5) * sx - 0.5, v = (py + 0.5) * sy - 0.5;
      const uc = Math.max(0, Math.min(sw - 1.001, u)), vc = Math.max(0, Math.min(sh - 1.001, v));
      const ix = Math.floor(uc), iy = Math.floor(vc);
      const ix1 = Math.min(sw - 1, ix + 1), iy1 = Math.min(sh - 1, iy + 1);
      const fx = uc - ix, fy = vc - iy;
      const o = (iy * sw + ix) * 4, o1 = (iy * sw + ix1) * 4;
      const o2 = (iy1 * sw + ix) * 4, o3 = (iy1 * sw + ix1) * 4;
      const sa = (spr[o + 3] * (1 - fx) + spr[o1 + 3] * fx) * (1 - fy)
        + (spr[o2 + 3] * (1 - fx) + spr[o3 + 3] * fx) * fy;
      if (sa <= 0.5) continue;
      const a = sa / 255;
      const t = (dy * c.w + dx) * 4;
      for (let k = 0; k < 3; k++) {
        const s = (spr[o + k] * (1 - fx) + spr[o1 + k] * fx) * (1 - fy)
          + (spr[o2 + k] * (1 - fx) + spr[o3 + k] * fx) * fy;
        c.d[t + k] = Math.round(s * a + c.d[t + k] * (1 - a));
      }
    }
  }
}

// ── PNG 编码（零依赖） ─────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePng(path, c) {
  const stride = c.w * 4 + 1;
  const raw = Buffer.alloc(stride * c.h);
  for (let y = 0; y < c.h; y++) {
    raw[y * stride] = 0;
    Buffer.from(c.d.buffer, c.d.byteOffset + y * c.w * 4, c.w * 4).copy(raw, y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

// ── mask → 成品 sprite（上线同一条合成式） ─────────────────────────────
function composite(mask, rgb) {
  const dst = new Uint8Array(mask.data.length);
  compositeTintMask(dst, mask.data, rgb);
  return dst;
}

/** 派生「pitch 版」mask：源 128px 居中，四周 8px 用其自身边缘像素平铺（⛔ 不新系数）。 */
function widen(mask, side = 144, border = 8) {
  const src = mask.data, sw = mask.width;
  const out = new Uint8Array(side * side * 4);
  const put = (x, y, o) => {
    const i = (y * side + x) * 4;
    out[i] = src[o]; out[i + 1] = src[o + 1]; out[i + 2] = src[o + 2]; out[i + 3] = src[o + 3];
  };
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const ix = Math.max(0, Math.min(sw - 1, x - border));
      const iy = Math.max(0, Math.min(sw - 1, y - border));
      // 越界方向钳到源图最近边缘行列 ⇒ 外圈 = 边缘像素延伸
      const ex = x < border ? 0 : x >= border + sw ? sw - 1 : ix;
      const ey = y < border ? 0 : y >= border + sw ? sw - 1 : iy;
      put(x, y, (ey * sw + ex) * 4);
    }
  }
  return { data: out, width: side, height: side };
}

/**
 * 用户裁定的合成 tile：**128px 画布**（图集零改动）= 平色背景铺满 + 现有 mask 按
 * `cellDp / tileDp = 30/33` 比例**居中**贴上去（⛔ 不拉伸到 33dp）。
 */
function centeredTile(cellSpr, side, inner, bg) {
  const out = new Uint8Array(side * side * 4);
  for (let i = 0; i < side * side; i++) {
    out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255;
  }
  const fake = { d: out, w: side, h: side };
  blitInto(fake, cellSpr, side, (side - inner) / 2, (side - inner) / 2, inner);
  return out;
}

/** 平色 mask：整幅取源边缘像素（d=0.70 / l=0 / B=255）。 */
function flatten(mask, side = 144) {
  const src = mask.data, w = mask.width;
  const out = new Uint8Array(side * side * 4);
  for (let i = 0; i < side * side; i++) {
    for (let k = 0; k < 4; k++) out[i * 4 + k] = src[k]; // 左上角 = 格外像素
  }
  return { data: out, width: side, height: side, refW: w };
}

// ── 场景 ───────────────────────────────────────────────────────────────
const COLORS = ['#FFD23F', '#3D7BF5'];
const cellMask = readPngRgba(join(TEX, 'grid-hole-tint-128-mask.png'));
const beadMask = readPngRgba(join(TEX, 'bead-hole-tint-128-mask.png'));
const wideMask = widen(cellMask);
const flatMask = flatten(cellMask);

const spr = { cell: [], bead: [], wide: [], flat: [], tile: [] };
for (const hex of COLORS) {
  const rgb = parseTintColor(hex);
  spr.cell.push({ d: composite(cellMask, rgb), w: cellMask.width });
  spr.bead.push({ d: composite(beadMask, rgb), w: beadMask.width });
  spr.wide.push({ d: composite(wideMask, rgb), w: wideMask.width });
  spr.flat.push({ d: composite(flatMask, rgb), w: flatMask.width });
}
const edgeOf = (hex) => {
  const { r, g, b } = parseTintColor(hex);
  return [Math.round(r * BASE_D), Math.round(g * BASE_D), Math.round(b * BASE_D)];
};

/**
 * ⚙ **正本对照**：尺与合成一律走框架 `maskTileInnerPx` / `composeMaskTile`（+ 同一条
 * tint 合成式）⇒ 本面板量的就是**将要上线的那段代码**，不是脚本自己的重采样。
 */
const INNER = maskTileInnerPx(33);
for (const [i, hex] of COLORS.entries()) {
  const tileMask = new Uint8ClampedArray(128 * 128 * 4);
  composeMaskTile(tileMask, cellMask.data, 128, INNER);
  const dst = new Uint8ClampedArray(tileMask.length);
  compositeTintMask(dst, tileMask, parseTintColor(hex));
  spr.tile.push({ d: dst });
}

/** 4×4 格的填/空与配色（相邻异色 ⇒ 拼缝可见；(0,1) 与 (2,3) 为填格）。 */
const cellAt = (i, j) => ({
  color: (i + j) % 2,
  filled: (i === 0 && j === 1) || (i === 2 && j === 3),
});

function panel(kind, liftDp = 0) {
  const c = make(PANEL_W, PANEL_W, [255, 255, 255]); // 白板 = palette.panel #FFFFFF
  const lift = liftDp * PXDP;
  for (let i = 0; i < CELLS; i++) {
    for (let j = 0; j < CELLS; j++) {
      const { color, filled } = cellAt(i, j);
      const cx = j * PITCH + PITCH / 2, cy = i * PITCH + PITCH / 2;
      const edge = edgeOf(COLORS[color]);
      if (kind === 'now') {
        fillRect(c, cx - 33 * PXDP / 2, cy - 33 * PXDP / 2, 33 * PXDP, 33 * PXDP, edge);
        // [WXG-T-236 八轮] **有珠格也画坑底**（静息与抬起都是 rect + 格 mask + 珠 三条）
        // ⇒ 本臂必须照此建模，否则抬起差值图里那一弯新月是「脚本少画一层」而非合并代价。
        blit(c, spr.cell[color].d, 128, cx, cy, 30 * PXDP);
        if (filled) blit(c, spr.bead[color].d, 128, cx, cy - lift, 30 * PXDP);
      } else if (kind === 'mergeOne') {
        blit(c, spr.wide[color].d, 144, cx, cy, 33 * PXDP);
        if (filled) blit(c, spr.bead[color].d, 128, cx, cy - lift, 30 * PXDP);
      } else if (kind === 'mergeCenter') {
        blit(c, spr.tile[color].d, 128, cx, cy, 33 * PXDP);
        if (filled) blit(c, spr.bead[color].d, 128, cx, cy - lift, 30 * PXDP);
      } else if (kind === 'merge128') {
        // 用户裁定：现有 128px mask 不扩边、不派生，直接铺到 33dp 的 L0 上（内容拉伸 1.1×）。
        blit(c, spr.cell[color].d, 128, cx, cy, 33 * PXDP);
        if (filled) blit(c, spr.bead[color].d, 128, cx, cy - lift, 30 * PXDP);
      } else if (kind === 'mergeNative') {
        // 144px 原生不缩放：槽恒 30dp，外沿共重叠 1.75dp（同色 ⇒ 不可见）。
        blit(c, spr.wide[color].d, 144, cx, cy, 33.75 * PXDP);
        if (filled) blit(c, spr.bead[color].d, 128, cx, cy - lift, 30 * PXDP);
      } else {
        const base = filled ? spr.flat[color] : spr.wide[color];
        blit(c, base.d, 144, cx, cy, 33 * PXDP);
        if (filled) blit(c, spr.bead[color].d, 128, cx, cy - lift, 30 * PXDP);
      }
    }
  }
  return c;
}

const p0 = panel('now'), p1 = panel('mergeOne'), p2 = panel('mergeNative'), p3 = panel('merge128'), p4 = panel('mergeCenter');
const LIFT = 6.72; // SELECT_LIFT_PX × liftScale 峰值（恒等档）
const l0 = panel('now', LIFT), l1 = panel('mergeOne', LIFT), l2 = panel('mergeNative', LIFT), l3 = panel('merge128', LIFT), l4 = panel('mergeCenter', LIFT);
const strip = make(TOTAL_W, (PANEL_W + 8) * 2 + 8, [24, 24, 28]);
const rows = [[p0, p1, p2, p3, p4], [l0, l1, l2, l3, l4]];
for (const [ri, row] of rows.entries()) {
  for (const [idx, p] of row.entries()) {
    const ox = idx * (PANEL_W + GAP);
    const oy = 8 + ri * (PANEL_W + 8);
    for (let y = 0; y < p.h; y++) {
      Buffer.from(p.d.buffer, p.d.byteOffset + y * p.w * 4, p.w * 4)
        .copy(Buffer.from(strip.d.buffer, strip.d.byteOffset + (oy + y) * strip.w * 4 + ox * 4, p.w * 4));
    }
  }
}
writePng(join(OUT, 'ab-panels.png'), strip);

/** 整格（含邻格一侧）36×36dp 裁块放大 6× 的差值图（差值 ×6 增强，底图压暗叠加）。 */
function diffImage(a, b, path) {
  const dp = 36, crop = dp * PXDP, zoom = 6, side = crop * zoom;
  const ox = 1 * PITCH + PITCH / 2 - crop / 2, oy = 0 * PITCH + PITCH / 2 - crop / 2;
  const cx0 = Math.max(0, Math.min(a.w - crop, Math.round(ox)));
  const cy0 = Math.max(0, Math.min(a.h - crop, Math.round(oy)));
  const out = make(side, side, [0, 0, 0]);
  let maxDiff = 0, hot = 0;
  for (let y = 0; y < crop; y++) {
    for (let x = 0; x < crop; x++) {
      const ia = ((cy0 + y) * a.w + cx0 + x) * 4, ib = ((cy0 + y) * b.w + cx0 + x) * 4;
      const dr = Math.abs(a.d[ia] - b.d[ib]), dg = Math.abs(a.d[ia + 1] - b.d[ib + 1]), db = Math.abs(a.d[ia + 2] - b.d[ib + 2]);
      const dv = Math.max(dr, dg, db);
      maxDiff = Math.max(maxDiff, dv);
      if (dv > 8) hot++;
      const px = Math.round(a.d[ia] * 0.35 + Math.min(255, dv * 6));
      const py = Math.round(a.d[ia + 1] * 0.35);
      const pz = Math.round(a.d[ia + 2] * 0.35);
      for (let zy = 0; zy < zoom; zy++) {
        for (let zx = 0; zx < zoom; zx++) {
          const o = ((y * zoom + zy) * side + (x * zoom + zx)) * 4;
          out.d[o] = px; out.d[o + 1] = py; out.d[o + 2] = pz; out.d[o + 3] = 255;
        }
      }
    }
  }
  writePng(path, out);
  return { maxDiff, hotPct: ((hot / (crop * crop)) * 100).toFixed(1) };
}

const d1 = diffImage(p0, p1, join(OUT, 'ab-diff-rest-mergeOne.png'));
const d5 = diffImage(p0, p3, join(OUT, 'ab-diff-rest-merge128.png'));
const d6 = diffImage(l0, l3, join(OUT, 'ab-diff-lift-merge128.png'));
const d7 = diffImage(p0, p4, join(OUT, 'ab-diff-rest-mergeCenter.png'));
const d8 = diffImage(l0, l4, join(OUT, 'ab-diff-lift-mergeCenter.png'));
const d2 = diffImage(p0, p2, join(OUT, 'ab-diff-rest-mergeNative.png'));
const d3 = diffImage(l0, l1, join(OUT, 'ab-diff-lift-mergeOne.png'));
const d4 = diffImage(l0, l2, join(OUT, 'ab-diff-lift-mergeNative.png'));
console.log(`静息 甲(33dp) vs 今日：最大差 ${d1.maxDiff}，差>8 占 ${d1.hotPct}%`);
console.log(`静息 甲(原生 33.75dp) vs 今日：最大差 ${d2.maxDiff}，差>8 占 ${d2.hotPct}%`);
console.log(`抬起 6.72dp 甲(33dp) vs 今日：最大差 ${d3.maxDiff}，差>8 占 ${d3.hotPct}%`);
console.log(`抬起 6.72dp 甲(原生) vs 今日：最大差 ${d4.maxDiff}，差>8 占 ${d4.hotPct}%`);
console.log(`静息 128px@33dp vs 今日：最大差 ${d5.maxDiff}，差>8 占 ${d5.hotPct}%`);
console.log(`抬起 6.72dp 128px@33dp vs 今日：最大差 ${d6.maxDiff}，差>8 占 ${d6.hotPct}%`);
console.log(`静息 居中不拉伸（mask 占 ${INNER}/128）vs 今日：最大差 ${d7.maxDiff}，差>8 占 ${d7.hotPct}%`);
console.log(`抬起 6.72dp 居中不拉伸 vs 今日：最大差 ${d8.maxDiff}，差>8 占 ${d8.hotPct}%`);
console.log(`图：${join(OUT, 'ab-panels.png')}`);
