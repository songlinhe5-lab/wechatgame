import { describe, expect, it } from 'vitest';
import { createTintBlitResolver } from '../../src/adapters/canvas2d/tint-blit-resolver.js';
import { grayFx, grayWipeFx } from '../../src/core/bake/gray-fx.js';
import type { TintSpriteCache } from '../../src/adapters/canvas2d/tint-sprite-cache.js';
import type { BlitCommand } from '../../src/core/render/render-model.js';

/**
 * `[WXG-T-566]` 灰度取图判据：像素公式 / alpha 保留 / 缓存命中 / 与 tint 的优先级 /
 * 未知 fx ⇒ 跳过（⛔ 不回落原图）。
 *
 * 用假 canvas 工厂（内存像素数组）⇒ 纯 Node、零 DOM，与 `canvas2d` 适配层同契约。
 */

type Pixels = Uint8ClampedArray;
interface FakeCanvas {
    width: number;
    height: number;
    pixels: Pixels;
    getContext(t: '2d'): FakeCtx | null;
}
interface FakeCtx {
    drawImage(src: Pixels & { width: number; height: number }, sx: number, sy: number, sw: number, sh: number,
              dx: number, dy: number, dw: number, dh: number): void;
    getImageData(sx: number, sy: number, sw: number, sh: number): { data: Pixels };
    putImageData(data: { data: Pixels }, dx: number, dy: number): void;
}
type FakeSource = Pixels & { width: number; height: number };

function makeSource(width: number, height: number, rgba: number[]): FakeSource {
    const data = new Uint8ClampedArray(width * height * 4);
    data.set(rgba);
    return Object.assign(data, { width, height });
}

function makeFactory() {
    const created: FakeCanvas[] = [];
    const create = (w: number, h: number): FakeCanvas => {
        const canvas: FakeCanvas = {
            width: w,
            height: h,
            pixels: new Uint8ClampedArray(w * h * 4),
            getContext: () => ctx,
        };
        const ctx: FakeCtx = {
            drawImage(src, _sx, _sy, _sw, _sh, _dx, _dy, _dw, _dh) {
                // 本测试只走 1:1 整幅拷贝。
                canvas.pixels.set(src);
            },
            getImageData(sx, sy, sw, sh) {
                const out = new Uint8ClampedArray(sw * sh * 4);
                for (let y = 0; y < sh; y++) {
                    const from = ((sy + y) * canvas.width + sx) * 4;
                    out.set(canvas.pixels.subarray(from, from + sw * 4), y * sw * 4);
                }
                return { data: out };
            },
            putImageData(img, dx, dy) {
                for (let y = 0; y < canvas.height - dy; y++) {
                    const to = ((dy + y) * canvas.width + dx) * 4;
                    canvas.pixels.set(img.data.subarray(y * (canvas.width - dx) * 4, (y + 1) * (canvas.width - dx) * 4), to);
                }
            },
        };
        created.push(canvas);
        return canvas;
    };
    return { create, created };
}

const TINT_SENTINEL = { tint: true };

function cmd(textureId: string, fx?: BlitCommand['fx']): BlitCommand {
    return { kind: 'blit', textureId, x: 0, y: 0, w: 1, h: 1, ...(fx === undefined ? {} : { fx }) };
}

describe('createTintBlitResolver · gray', () => {
    it('g=1 ⇒ Rec.709 亮度，alpha 原样', () => {
        const src = makeSource(1, 1, [255, 0, 0, 128]);
        const registry = { get: () => src };
        const { create } = makeFactory();
        const resolver = createTintBlitResolver({} as TintSpriteCache, registry, create);
        const out = resolver.resolve(cmd('t', grayFx(1))) as FakeCanvas;
        // luma = 0.2126·255 = 54.213 ⇒ Uint8ClampedArray 取 54
        expect(Array.from(out.pixels)).toEqual([54, 54, 54, 128]);
    });

    it('g=0.5 ⇒ c 与 luma 各半', () => {
        const src = makeSource(1, 1, [255, 0, 0, 255]);
        const registry = { get: () => src };
        const { create } = makeFactory();
        const resolver = createTintBlitResolver({} as TintSpriteCache, registry, create);
        const out = resolver.resolve(cmd('t', grayFx(0.5))) as FakeCanvas;
        // R = 255·0.5 + 54.213·0.5 = 154.6；G/B = 0·0.5 + 54.213·0.5 = 27.1
        expect(out.pixels[0]).toBeGreaterThanOrEqual(154);
        expect(out.pixels[0]).toBeLessThanOrEqual(155);
        expect(out.pixels[1]).toBe(27);
        expect(out.pixels[2]).toBe(27);
        expect(out.pixels[3]).toBe(255);
    });

    it('同键命中缓存：只建一次 canvas', () => {
        const src = makeSource(1, 1, [10, 20, 30, 255]);
        const registry = { get: () => src };
        const { create, created } = makeFactory();
        const resolver = createTintBlitResolver({} as TintSpriteCache, registry, create);
        const a = resolver.resolve(cmd('t', grayFx(0.55)));
        const b = resolver.resolve(cmd('t', grayFx(0.55)));
        expect(a).toBe(b);
        expect(created).toHaveLength(1);
    });

    it('base 与 gray 同时出现 ⇒ base 优先（不烘灰）', () => {
        const registry = { get: () => makeSource(1, 1, [1, 2, 3, 255]) };
        const cache = { get: () => TINT_SENTINEL } as unknown as TintSpriteCache;
        const { create, created } = makeFactory();
        const resolver = createTintBlitResolver(cache, registry, create);
        expect(resolver.resolve(cmd('t', { base: '#ffffff', gray: 1 }))).toBe(TINT_SENTINEL);
        expect(created).toHaveLength(0);
    });

    it('无 fx ⇒ 原纹理；有 fx 但键都不认 ⇒ undefined', () => {
        const src = makeSource(1, 1, [1, 2, 3, 255]);
        const registry = { get: () => src };
        const { create } = makeFactory();
        const resolver = createTintBlitResolver({} as TintSpriteCache, registry, create);
        expect(resolver.resolve(cmd('t'))).toBe(src);
        expect(resolver.resolve(cmd('t', { blend: 'x' }))).toBeUndefined();
    });

    it('宿主无离屏能力 ⇒ 跳过（undefined）', () => {
        const registry = { get: () => makeSource(1, 1, [1, 2, 3, 255]) };
        const resolver = createTintBlitResolver({} as TintSpriteCache, registry);
        expect(resolver.resolve(cmd('t', grayFx(1)))).toBeUndefined();
    });
});

/**
 * `[WXG-T-566]` 竖向揭彩：底部彩色 / 顶部灰 / 柔带线性过渡 / 缓存按 (progress, soft) 分键。
 * 源 = 1×8 纯红（全彩行 `[255,0,0]`，全灰行 = Rec.709 ⇒ `[54,54,54]`）。
 */
describe('createTintBlitResolver · grayWipe', () => {
    const H = 8;
    const redColumn = (): FakeSource => {
        const rgba: number[] = [];
        for (let y = 0; y < H; y++) rgba.push(255, 0, 0, 255);
        return makeSource(1, H, rgba);
    };
    const row = (c: FakeCanvas, y: number): number[] => [
        c.pixels[y * 4]!, c.pixels[y * 4 + 1]!, c.pixels[y * 4 + 2]!, c.pixels[y * 4 + 3]!,
    ];
    const make = () => {
        const registry = { get: () => redColumn() };
        const { create, created } = makeFactory();
        return { resolver: createTintBlitResolver({} as TintSpriteCache, registry, create), created };
    };

    it('progress=0.5、soft=0 ⇒ 上半全灰 / 下半原色（硬边）', () => {
        const { resolver } = make();
        const out = resolver.resolve(cmd('t', grayWipeFx(0.5, 0))) as FakeCanvas;
        for (let y = 0; y < H / 2; y++) expect(row(out, y)).toEqual([54, 54, 54, 255]);
        for (let y = H / 2; y < H; y++) expect(row(out, y)).toEqual([255, 0, 0, 255]);
    });

    it('progress=1 ⇒ 全彩；progress=0 ⇒ 全灰（soft 只影响边界附近）', () => {
        const { resolver } = make();
        const full = resolver.resolve(cmd('t', grayWipeFx(1, 0))) as FakeCanvas;
        for (let y = 0; y < H; y++) expect(row(full, y)).toEqual([255, 0, 0, 255]);
        const none = resolver.resolve(cmd('t', grayWipeFx(0, 0))) as FakeCanvas;
        for (let y = 0; y < H; y++) expect(row(none, y)).toEqual([54, 54, 54, 255]);
    });

    it('soft=0.5 ⇒ 交界柔带逐行过渡（顶纯灰、底纯原色、中段介于两者）', () => {
        const { resolver } = make();
        const out = resolver.resolve(cmd('t', grayWipeFx(0.5, 0.5))) as FakeCanvas;
        expect(row(out, 0)).toEqual([54, 54, 54, 255]);
        expect(row(out, H - 1)).toEqual([255, 0, 0, 255]);
        for (let y = 3; y < 6; y++) {
            expect(row(out, y)[0], `y=${y} 落在柔带内`).toBeGreaterThan(54);
            expect(row(out, y)[0], `y=${y} 比下一行更灰`).toBeLessThanOrEqual(row(out, y + 1)[0]!);
        }
    });

    it('缓存按 (progress, soft) 分键：同键复用、异键各自成图', () => {
        const { resolver, created } = make();
        const a = resolver.resolve(cmd('t', grayWipeFx(0.375, 0.08)));
        const b = resolver.resolve(cmd('t', grayWipeFx(0.375, 0.08)));
        expect(a).toBe(b);
        expect(created).toHaveLength(1);
        const c = resolver.resolve(cmd('t', grayWipeFx(0.75, 0.08)));
        expect(c).not.toBe(a);
        expect(created).toHaveLength(2);
    });

    it('无离屏能力 ⇒ 跳过（undefined）', () => {
        const registry = { get: () => redColumn() };
        const resolver = createTintBlitResolver({} as TintSpriteCache, registry);
        expect(resolver.resolve(cmd('t', grayWipeFx(0.5, 0.08)))).toBeUndefined();
    });
});
