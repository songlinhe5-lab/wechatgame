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
 * | 本文件 | 键名 `base`（借 `tintFxBase()`）+ 「有 fx 走合成、无 fx 走注册表」 |
 * | 合成数学 | `(mask, rgb) → 像素`（⛔ 不知道 blit / 命令 / 颜色从哪来） |
 *
 * ⇒ 换一种效果 = 换一个 resolver 实现；**渲染器与 core 都不动**（`ADR-0029 §8.2` 规则 1）。
 */

import { tintFxBase } from '../../core/bake/tint-composite.js';
import { nineSliceFxRead } from '../../core/bake/nine-slice-fx.js';
import type { BlitResolver, TextureRegistry } from './canvas2d-renderer.js';
import type { BlitCommand } from '../../core/render/render-model.js';
import type { TintSpriteCache } from './tint-sprite-cache.js';

/** 可 `drawImage` 的源（与注册表同源）。 */
type Source = { width: number; height: number };
type Ctx2DLike = {
  drawImage(image: Source, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
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
 * 着色策略：`fx` 有 `base` ⇒ 取 CPU 预合成 sprite；否则 ⇒ 原纹理注册表。
 *
 * ⛔ `fx` 存在但 `base` 不可用 ⇒ 返回 `undefined`（**跳过**，⛔ 不回落贴裸 mask）。
 * ⛔ 合成失败（低端机 OOM 等）由 `TintSpriteCache` 内部降级 + 负缓存，此处只透传 `undefined`。
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
            return base === undefined ? undefined : cache.get(cmd.textureId, base);
        },
    };
}
