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
import type { BlitResolver, TextureRegistry } from './canvas2d-renderer.js';
import type { BlitCommand } from '../../core/render/render-model.js';
import type { TintSpriteCache } from './tint-sprite-cache.js';

/**
 * 着色策略：`fx` 有 `base` ⇒ 取 CPU 预合成 sprite；否则 ⇒ 原纹理注册表。
 *
 * ⛔ `fx` 存在但 `base` 不可用 ⇒ 返回 `undefined`（**跳过**，⛔ 不回落贴裸 mask）。
 * ⛔ 合成失败（低端机 OOM 等）由 `TintSpriteCache` 内部降级 + 负缓存，此处只透传 `undefined`。
 */
export function createTintBlitResolver(
    cache: TintSpriteCache,
    registry: TextureRegistry,
): BlitResolver {
    return {
        resolve(cmd: BlitCommand): object | undefined {
            if (cmd.fx === undefined) return registry.get(cmd.textureId);
            const base = tintFxBase(cmd.fx);
            return base === undefined ? undefined : cache.get(cmd.textureId, base);
        },
    };
}
