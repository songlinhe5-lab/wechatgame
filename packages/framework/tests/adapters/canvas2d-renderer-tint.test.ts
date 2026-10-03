import { describe, expect, it } from 'vitest';
import { Canvas2DRenderer, type Canvas2DLike, type BlitResolver } from '../../src/adapters/canvas2d/canvas2d-renderer.js';
import { createTintBlitResolver } from '../../src/adapters/canvas2d/tint-blit-resolver.js';
import { TintSpriteCache, type TintCanvasFactory, type TintCanvasLike, type TintContext2DLike } from '../../src/adapters/canvas2d/tint-sprite-cache.js';
import { tintFx } from '../../src/core/bake/tint-composite.js';
import type { BlitCommand, BlitFx } from '../../src/core/render/render-model.js';
import { Viewport } from '../../src/core/render/viewport.js';
import { RenderModelBuilder } from '../../src/core/render/render-model.js';

/**
 * `[WXG-T-226 EP12-B3 / ADR-0029 §8.1]` 渲染器的**取图钩子契约**。
 *
 * ⛔ 本文件**不改**既有 `canvas2d-renderer.test.ts`（封箱基准邻件，K-082）⇒ 另立新文件。
 *
 * ## 契约三条（逐条钉住）
 *
 * 1. **单一钩子**：渲染器只调 `resolve(cmd)`，⛔ 自己不解释 `fx`（换效果不用改渲染器）。
 * 2. **未注入 = 退回注册表**：与本批之前逐字节相同（V-5 绿线锚）。
 * 3. **resolver 总责**：它返回什么就贴什么；返回 `undefined` 即跳过，⛔ 渲染器不回落。
 */

interface Draw { image: object; x: number; y: number; w: number; h: number }

function mockCtx(draws: Draw[]): Canvas2DLike {
  const noop = () => { /* noop */ };
  return {
    save: noop, restore: noop, setTransform: noop, clearRect: noop, fillRect: noop,
    beginPath: noop, closePath: noop, rect: noop, arc: noop, moveTo: noop, lineTo: noop,
    translate: noop, scale: noop, fill: noop, stroke: noop, fillText: noop,
    drawImage: (image, x, y, w, h) => { draws.push({ image, x, y, w, h }); },
    fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1,
    font: '', textAlign: '', textBaseline: '',
  };
}

const MASK_TEXTURE = { id: 'mask-tex' };
const SPRITE = { id: 'composited-sprite' };

function makeRenderer(opts: { resolver?: BlitResolver; textures?: Record<string, object> } = {}) {
  const draws: Draw[] = [];
  const viewport = new Viewport(100, 100);
  viewport.resize(100, 100);
  const renderer = new Canvas2DRenderer(mockCtx(draws), viewport, {
    textureRegistry: { get: (id) => opts.textures?.[id] },
    blitResolver: opts.resolver,
  });
  return { renderer, draws };
}

function blitModel(fx?: BlitFx): RenderModelBuilder {
  const b = new RenderModelBuilder(100, 100);
  b.begin();
  b.rect(0, 0, 100, 100, { fill: '#000000' });
  if (fx === undefined) b.blit('mask-tex', 10, 10, 30, 30);
  else b.blit('mask-tex', 10, 10, 30, 30, { fx });
  return b;
}

/** 一条命令一条 sprite 的假 cache（只验接线，不重复验合成数学）。 */
function stubCache() {
  const calls: { maskId: string; tint: string }[] = [];
  const cache = { get: (maskId: string, tint: string) => { calls.push({ maskId, tint }); return SPRITE; } };
  return { cache, calls };
}

describe('Canvas2DRenderer · 取图钩子（EP12-B3 / ADR-0029 §8.1）', () => {
  it('契约 1：渲染器只调 resolve(cmd)，⛔ 自己不解释 fx', () => {
    const seen: string[] = [];
    const { renderer, draws } = makeRenderer({
      resolver: { resolve: (cmd) => { seen.push(cmd.textureId); return SPRITE; } },
      textures: { 'mask-tex': MASK_TEXTURE },
    });
    renderer.draw(blitModel(tintFx('#fdf6e9')).end());
    expect(seen).toEqual(['mask-tex']);
    expect(draws).toHaveLength(1);
    expect(draws[0]!.image).toBe(SPRITE);
  });

  it('契约 2：未注入 resolver ⇒ 退回注册表（V-5 绿线锚）', () => {
    const { renderer, draws } = makeRenderer({ textures: { 'mask-tex': MASK_TEXTURE } });
    renderer.draw(blitModel().end());
    expect(draws).toHaveLength(1);
    expect(draws[0]!.image).toBe(MASK_TEXTURE);
  });

  it('契约 2：未注入 resolver 且注册表也没有 ⇒ 静默跳过（不抛）', () => {
    const { renderer, draws } = makeRenderer();
    expect(() => renderer.draw(blitModel().end())).not.toThrow();
    expect(draws).toHaveLength(0);
  });

  it('契约 3：resolver 返回 undefined ⇒ 跳过，⛔ 渲染器不回落去贴裸 mask', () => {
    const { renderer, draws } = makeRenderer({
      resolver: { resolve: () => undefined },
      textures: { 'mask-tex': MASK_TEXTURE },
    });
    renderer.draw(blitModel(tintFx('#fdf6e9')).end());
    expect(draws).toHaveLength(0);
  });

  it('契约 3：resolver 对无 fx 的 blit 也有决定权（总责语义）', () => {
    // ⛔ 这不是「无 fx 就该问注册表」—— 那是 helper 的分流职责，不是渲染器的
    const { renderer, draws } = makeRenderer({
      resolver: { resolve: () => SPRITE },
      textures: { 'mask-tex': MASK_TEXTURE },
    });
    renderer.draw(blitModel().end());
    expect(draws[0]!.image).toBe(SPRITE);
  });
});

describe('createTintBlitResolver · 着色策略接线', () => {
  it('有 fx ⇒ 取合成 sprite（并把 base 颜色透传下去）', () => {
    const { cache, calls } = stubCache();
    const resolver = createTintBlitResolver(cache as unknown as TintSpriteCache, { get: () => MASK_TEXTURE });
    const out = resolver.resolve(blitModel(tintFx('#fdf6e9')).end().commands[1] as BlitCommand);
    expect(calls).toEqual([{ maskId: 'mask-tex', tint: '#fdf6e9' }]);
    expect(out).toBe(SPRITE);
  });

  it('无 fx ⇒ 走注册表（不碰合成）', () => {
    const { cache, calls } = stubCache();
    const resolver = createTintBlitResolver(cache as unknown as TintSpriteCache, { get: () => MASK_TEXTURE });
    const out = resolver.resolve(blitModel().end().commands[1] as BlitCommand);
    expect(calls).toHaveLength(0);
    expect(out).toBe(MASK_TEXTURE);
  });

  it('fx 存在但 base 不可用 ⇒ undefined（跳过，⛔ 不回落贴裸 mask）', () => {
    const { cache, calls } = stubCache();
    const resolver = createTintBlitResolver(cache as unknown as TintSpriteCache, { get: () => MASK_TEXTURE });
    const cmd = blitModel({ base: 123 } as unknown as BlitFx).end().commands[1] as BlitCommand;
    expect(resolver.resolve(cmd)).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it('真 cache 接线：合成失败 ⇒ undefined（逐条降级不中断整帧）', () => {
    const failing: TintCanvasFactory = {
      createCanvas(width: number, height: number): TintCanvasLike {
        const ctx: TintContext2DLike = {
          drawImage: () => { /* noop */ },
          getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
          putImageData: () => { throw new Error('OOM'); },
        };
        return { width, height, getContext: () => ctx };
      },
    };
    const cache = new TintSpriteCache(failing, { get: () => ({}) }, {
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      flipY: false,
      size: 8,
    });
    const resolver = createTintBlitResolver(cache, { get: () => MASK_TEXTURE });
    const cmd = blitModel(tintFx('#fdf6e9')).end().commands[1] as BlitCommand;
    expect(resolver.resolve(cmd)).toBeUndefined();
    expect(cache.stats.errors).toBe(1);
  });
});
