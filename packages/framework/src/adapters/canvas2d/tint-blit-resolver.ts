/**
 * `[WXG-T-226 EP12-B3 / ADR-0029 §8.1]` **着色效果的取图策略**（宿主侧 3 行装配的现成实现）。
 *
 * 装配：`new Canvas2DRenderer(ctx, vp, { textureRegistry, blitResolver: createTintBlitResolver(cache, registry) })`
 *
 * ## 分工（这才是「代码独立性好」的落点）
 *
 * | 层 | 只知道 |
 * |---|---|
 * | 渲染器 | 「把 blit 变成一个可贴对象」（⛔ 不知道 base / 颜色 / mask） |
 * | 本文件 | 键名 `base`（借 `tintFxBase()`）/ `gray`（借 `grayFxRead()`）+「有 fx 走效果、无 fx 走注册表」 |
 * | 合成数学 | `(mask, rgb) → 像素`（⛔ 不知道 blit / 命令 / 颜色从哪来） |
 *
 * ⇒ 换一种效果 = 换一个 resolver 实现；**渲染器与 core 都不动**（`ADR-0029 §8.2` 规则 1）。
 */

import { tintFxBase } from '../../core/bake/tint-composite.js';
import { grayFxRead, grayWipeRead } from '../../core/bake/gray-fx.js';
import { nineSliceFxRead } from '../../core/bake/nine-slice-fx.js';
import type { BlitResolver, TextureRegistry } from './canvas2d-renderer.js';
import type { BlitCommand } from '../../core/render/render-model.js';
import type { TintSpriteCache } from './tint-sprite-cache.js';

/** 可 `drawImage` 的源（与注册表同源）。 */
type Source = { width: number; height: number };
/** `getImageData` / `putImageData` 的最小结构（framework ⛔ 不假设 lib.dom）。 */
type ImageDataLike = { readonly data: Uint8ClampedArray };
type Ctx2DLike = {
  drawImage(image: Source, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageDataLike;
  putImageData(data: ImageDataLike, dx: number, dy: number): void;
};
type CanvasLike = Source & { getContext(t: '2d'): Ctx2DLike | null };

/**
 * `[WXG-T-280]` nine-slice 预烘：把九段拉成**单张**目标尺寸纹理（渲染器/取图契约不变，
 * 命中缓存后每帧零绘制）。键 = `texId|w|h|capX|capY`（尺寸档极少，CTA 仅常态/按下态两档）。
 * 烘面朝向 = 源图同向（与 `TextureRegistry` 条目同一约定，y 翻由渲染器 blit 分支统一处理）。
 */
const _nineSlices = new Map<string, CanvasLike>();
function bakeNineSlice(
  textureId: string,
  src: Source,
  w: number,
  h: number,
  capX: number,
  capY: number,
  create: (w: number, h: number) => CanvasLike | null,
): CanvasLike | undefined {
  // 键 = 纹理 id + 目标尺寸档（⛔ 不拿宿主对象的 `__id` 猜：普通注册表条目没这字段 ⇒ 会撞键）。
  const key = `${textureId}|${w}|${h}|${capX}|${capY}`;
  const hit = _nineSlices.get(key);
  if (hit !== undefined) return hit;
  const canvas = create(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return undefined;
  const sw = src.width;
  const sh = src.height;
  // 端帽按源纹 px 裁。目标比源纹矮（CTA 240→92）时，端帽跟较短边同比缩小，只拉中间。
  // 放得下时不放大端帽。旧写法把源纹 px 直接当目标 px，圆角被压扁。
  const srcCx = Math.min(capX, sw / 2);
  const srcCy = Math.min(capY, sh / 2);
  let fit = Math.min(w / sw, h / sh);
  if (!(fit > 0) || fit > 1) fit = 1;
  const cx = Math.min(srcCx * fit, w / 2);
  const cy = Math.min(srcCy * fit, h / 2);
  const srcRestX = sw - srcCx * 2;
  const srcRestY = sh - srcCy * 2;
  const dstX = [0, cx, w - cx];
  const dstW = [cx, w - cx * 2, cx];
  const srcTop = [0, srcCy, sh - srcCy];
  const srcH = [srcCy, srcRestY, srcCy];
  const dstY = [0, cy, h - cy];
  const dstH = [cy, h - cy * 2, cy];
  const srcW = [srcCx, srcRestX, srcCx];
  const srcLeft = [0, srcCx, sw - srcCx];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (dstW[c]! <= 0 || dstH[r]! <= 0 || srcW[c]! <= 0 || srcH[r]! <= 0) continue;
      ctx.drawImage(src, srcLeft[c]!, srcTop[r]!, srcW[c]!, srcH[r]!, dstX[c]!, dstY[r]!, dstW[c]!, dstH[r]!);
    }
  }
  _nineSlices.set(key, canvas);
  return canvas;
}

/**
 * `[WXG-T-566]` 灰度预烘：对整张纹理做线性去饱和，命中缓存后每帧零拷贝。
 *
 * 键 = `texId|gray`（生产侧只三档 ⇒ 每个纹理最多 2 张灰化副本）。
 * 公式与 `bake/gray-fx.ts` 头注逐字同一式：`luma = Rec.709`、`out = c·(1−g) + luma·g`，alpha 原样。
 * ⛔ 不用 `ctx.filter = 'grayscale()'`：微信小游戏 Canvas 2D 的 filter 支持不保证（跨端不确定）。
 */
const _graySlices = new Map<string, CanvasLike>();
function bakeGray(
    textureId: string,
    src: Source,
    gray: number,
    create: (w: number, h: number) => CanvasLike | null,
): CanvasLike | undefined {
  const g = gray < 0 ? 0 : gray > 1 ? 1 : gray;
  const key = `${textureId}|${g}`;
  const hit = _graySlices.get(key);
  if (hit !== undefined) return hit;
  const canvas = create(Math.max(1, Math.round(src.width)), Math.max(1, Math.round(src.height)));
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return undefined;
  ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = image.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i]!;
    const gr = p[i + 1]!;
    const b = p[i + 2]!;
    const luma = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
    p[i] = r * (1 - g) + luma * g;
    p[i + 1] = gr * (1 - g) + luma * g;
    p[i + 2] = b * (1 - g) + luma * g;
  }
  ctx.putImageData(image, 0, 0);
  _graySlices.set(key, canvas);
  return canvas;
}

/**
 * `[WXG-T-566]` 竖向揭彩预烘：底部 `progress` 比例保持原色，顶部保持灰度，交界处按 `soft`
 * 做线性过渡（`soft = 0` ⇒ 硬边）。
 *
 * 行号约定：像素数组自**顶**向下（canvas `getImageData` 的原生行序）⇒ 彩色区
 * = `y ≥ height·(1−progress)`。柔带半宽 `band = soft·height/2`（`soft` 是总带宽占比）。
 * 公式与 `bakeGray` 同一式：`luma = Rec.709`、`out = c·(1−g) + luma·g`，alpha 原样。
 *
 * **缓存粒度 = 每纹理最新一档**（⛔ 不按 `progress` 累加）：生产侧进度单调递增，
 * 旧档不会再被显示 ⇒ 只留最新副本，显存上限 = 大关纹理数（不是「关数 × 档数」）。
 */
interface WipeSlice {
  readonly p: number;
  readonly s: number;
  readonly canvas: CanvasLike;
}
const _wipeSlices = new Map<string, WipeSlice>();
function bakeGrayWipe(
    textureId: string,
    src: Source,
    progress: number,
    soft: number,
    create: (w: number, h: number) => CanvasLike | null,
): CanvasLike | undefined {
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const s = soft < 0 ? 0 : soft > 1 ? 1 : soft;
  const hit = _wipeSlices.get(textureId);
  if (hit !== undefined && hit.p === p && hit.s === s) return hit.canvas;
  const canvas = create(Math.max(1, Math.round(src.width)), Math.max(1, Math.round(src.height)));
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return undefined;
  ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  const w = canvas.width;
  const h = canvas.height;
  const boundary = h * (1 - p);
  const band = s > 0 ? Math.max(1, (s * h) / 2) : 0;
  for (let y = 0; y < h; y++) {
    const t = band > 0
      ? (y < boundary - band ? 0 : y > boundary + band ? 1 : (y - (boundary - band)) / (2 * band))
      : (y >= boundary ? 1 : 0);
    const g = 1 - t;
    for (let i = y * w * 4; i < (y + 1) * w * 4; i += 4) {
      const r = px[i]!;
      const gr = px[i + 1]!;
      const b = px[i + 2]!;
      const luma = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
      px[i] = r * (1 - g) + luma * g;
      px[i + 1] = gr * (1 - g) + luma * g;
      px[i + 2] = b * (1 - g) + luma * g;
    }
  }
  ctx.putImageData(image, 0, 0);
  _wipeSlices.set(textureId, { p, s, canvas });
  return canvas;
}

/**
 * 着色/灰度策略：`fx` 有 `base` ⇒ 取 CPU 预合成 sprite；有 `gray` ⇒ 取灰化副本；
 * 有 `grayWipe` ⇒ 取竖向揭彩副本；否则 ⇒ 原纹理注册表。
 *
 * ⛔ `fx` 存在但键都不可用 ⇒ 返回 `undefined`（**跳过**，⛔ 不回落贴裸 mask）。
 * ⛔ 合成失败（低端机 OOM 等）由 `TintSpriteCache` 内部降级 + 负缓存，此处只透传 `undefined`。
 * 分派顺序刻意把 `base` 放在 `gray` 前 ⇒ 同一 `fx` 混用两键时 `base` 优先。
 */
export function createTintBlitResolver(
    cache: TintSpriteCache,
    registry: TextureRegistry,
    /** nine-slice 烘面用的小工厂；宿主无离屏能力（不传/返 null）⇒ 九宫格命令跳过。 */
    createCanvas?: (w: number, h: number) => CanvasLike | null,
): BlitResolver {
    return {
        resolve(cmd: BlitCommand): object | undefined {
            if (cmd.fx === undefined) return registry.get(cmd.textureId);
            const slice = nineSliceFxRead(cmd.fx);
            if (slice !== undefined) {
                const src = registry.get(cmd.textureId) as Source | undefined;
                if (src === undefined || createCanvas === undefined) return undefined;
                return bakeNineSlice(cmd.textureId, src, cmd.w, cmd.h, slice.capX, slice.capY, createCanvas);
            }
            const base = tintFxBase(cmd.fx);
            if (base !== undefined) return cache.get(cmd.textureId, base);
            const gray = grayFxRead(cmd.fx);
            if (gray !== undefined) {
                const src = registry.get(cmd.textureId) as Source | undefined;
                if (src === undefined || createCanvas === undefined) return undefined;
                return bakeGray(cmd.textureId, src, gray, createCanvas);
            }
            const wipe = grayWipeRead(cmd.fx);
            if (wipe !== undefined) {
                const src = registry.get(cmd.textureId) as Source | undefined;
                if (src === undefined || createCanvas === undefined) return undefined;
                return bakeGrayWipe(cmd.textureId, src, wipe[0]!, wipe[1]!, createCanvas);
            }
            return undefined;
        },
    };
}
