import { describe, expect, it } from 'vitest';
import {
  TintSpriteCache,
  type TintCanvasFactory,
  type TintCanvasLike,
  type TintContext2DLike,
} from '../../src/adapters/canvas2d/tint-sprite-cache.js';

/**
 * `[WXG-T-226 EP12-B3]` tint sprite 缓存的判据：命中恒等、零分配查表、字节预算 LRU、
 * 不可解析色 / 未注册 mask 的静默跳过，以及「单关卡色集装得下预算」的工作集口径。
 *
 * 假 canvas 走**最小结构化接口**（与生产同型）：`drawImage` 取 mask 像素 ⇒ `getImageData`
 * 读回 ⇒ `putImageData` 落地合成结果。每次 `createCanvas` 记一条 slot，供断言观测。
 */

interface FakeImage { readonly id: string }

const SIZE = 8; // 测试用小尺寸（生产 = MASK_CANONICAL_SIZE = 128）
const PX = SIZE * SIZE * 4;
const CREAM = '#fdf6e9';

/** 假 `ImageData`（结构化视图；真浏览器是内置类）。 */
const fakeImageData = (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
/** 默认不翻（测试只验数学；翻转专测见 `flipY` 用例）。 */
const NO_FLIP = { flipY: false } as const;
const CHARCOAL = '#33333d';

/** 单通道 mask：`R = d` / `G = l` / `B = shape` / `A = 255`（ADR-0028 §2.1）。 */
function maskWith(d: number, l: number, shape: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(PX);
  for (let i = 0; i < PX; i += 4) {
    data[i] = d;
    data[i + 1] = l;
    data[i + 2] = shape;
    data[i + 3] = 255;
  }
  return data;
}

function fakeFactory(maskPixels: Record<string, Uint8ClampedArray>) {
  interface Slot { src?: Uint8ClampedArray; put?: Uint8ClampedArray; draws: number }
  const slots: Slot[] = [];
  const factory: TintCanvasFactory = {
    createCanvas(width: number, height: number): TintCanvasLike {
      const slot: Slot = { draws: 0 };
      slots.push(slot);
      const ctx: TintContext2DLike = {
        drawImage(image) {
          slot.draws += 1;
          slot.src = maskPixels[(image as FakeImage).id];
        },
        getImageData() {
          return { data: slot.src ?? new Uint8ClampedArray(width * height * 4) };
        },
        putImageData(image) {
          slot.put = (image as { data: Uint8ClampedArray }).data;
        },
      };
      return { width, height, getContext: () => ctx };
    },
  };
  return { factory, slots };
}

function makeCache(maskPixels: Record<string, Uint8ClampedArray>, options?: { budgetBytes?: number }) {
  const { factory, slots } = fakeFactory(maskPixels);
  const cache = new TintSpriteCache(
    factory,
    { get: (id) => (maskPixels[id] ? ({ id } as FakeImage) : undefined) },
    { createImageData: fakeImageData, ...NO_FLIP, size: SIZE, ...options },
  );
  return { cache, slots };
}

describe('TintSpriteCache · 合成与命中', () => {
  it('首次 miss 合成 sprite，二次命中返回同一引用（零重算）', () => {
    const { cache } = makeCache({ m: maskWith(255, 0, 255) });
    const a = cache.get('m', CREAM);
    const b = cache.get('m', CREAM);
    expect(a).toBeDefined();
    expect(b).toBe(a);
    expect(cache.stats).toMatchObject({ hits: 1, misses: 1, sprites: 1 });
  });

  it('同 mask 不同 tint ⇒ 各一条 sprite（键含 tint）', () => {
    const { cache } = makeCache({ m: maskWith(255, 0, 255) });
    const a = cache.get('m', CREAM);
    const b = cache.get('m', CHARCOAL);
    expect(b).toBeDefined();
    expect(b).not.toBe(a);
    expect(cache.stats.sprites).toBe(2);
  });

  it('合成结果逐字节 = 纯数学真值（d=1,l=0 ⇒ 本色）', () => {
    const { cache, slots } = makeCache({ m: maskWith(255, 0, 255) });
    cache.get('m', CREAM);
    const spriteSlot = slots[slots.length - 1]!;
    expect(Array.from(spriteSlot.put!.slice(0, 4))).toEqual([253, 246, 233, 255]);
  });

  it('flipY = true ⇒ sprite 上下镜像（修「上亮变下亮」；宿主渲染器会 y 翻转时必开）', () => {
    // 事故 #2：mask PNG 是屏幕朝向（上沿=上扇亮），而渲染器 blit 会 scale(1,-1)
    // ⇒ 不预镜像就会上下颠倒。构造上下两行不同的 mask，断言翻转后互换。
    const top = new Uint8ClampedArray(SIZE * SIZE * 4);
    const bottom = new Uint8ClampedArray(SIZE * SIZE * 4);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const i = (y * SIZE + x) * 4;
            const src = y < SIZE / 2 ? top : bottom;
            src[i] = 255; src[i + 1] = 0; src[i + 2] = 255; src[i + 3] = 255;
        }
    }
    top[0] = 11; bottom[(SIZE - 1) * SIZE * 4] = 99;   // 两个特征字节
    const masks: Record<string, Uint8ClampedArray> = {
      m: new Uint8ClampedArray(top.length),
    };
    // 逐行合并成一张（上半 = 11 那一行的值，下半 = 99 那一行的值）
    for (let y = 0; y < SIZE; y++) {
      const from = y < SIZE / 2 ? top : bottom;
      masks.m!.set(from.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), y * SIZE * 4);
    }
    const built: Uint8ClampedArray[] = [];
    const factory: TintCanvasFactory = {
      createCanvas(width, height) {
        let src: Uint8ClampedArray | undefined = masks.m;
        const ctx: TintContext2DLike = {
          drawImage: () => { /* noop */ },
          getImageData: () => ({ data: src! }),
          putImageData: (image) => { built.push((image as { data: Uint8ClampedArray }).data); },
        };
        return { width, height, getContext: () => ctx };
      },
    };
    const cache = new TintSpriteCache(factory, { get: () => ({ id: 'm' } as FakeImage) },
      { createImageData: fakeImageData, flipY: true, size: SIZE });
    cache.get('m', CREAM);
    const out = built[0]!;
    // 特征字节走的是合成后的值：mask 末行首像素 R=99（d=99/255）⇒ 合成 R = round(253/255·99/255·255) = 98
    expect(out[0]).toBe(98);
    // 对照：不翻时首行取的是 mask 首行 R=11（d=11/255）⇒ 合成 R = 11
    const cacheNoFlip = new TintSpriteCache(factory, { get: () => ({ id: 'm' } as FakeImage) },
      { createImageData: fakeImageData, flipY: false, size: SIZE });
    built.length = 0;
    cacheNoFlip.get('m', CREAM);
    expect(built[0]![0]).toBe(11);
  });

  it('⛔ putImageData 收到的是 ImageData **实例**，⛔ 不是裸 Uint8ClampedArray', () => {
    // 回归锚（2026-10-03 真实浏览器事故）：真浏览器的 `putImageData` 只接受 `ImageData`
    // 实例，传裸数组会抛 `parameter 1 is not of type 'ImageData'` ⇒ 合成全失败但被 catch
    // 吞掉 ⇒ 「410 单测全绿 + 浏览器 0 条产出」。本断言把那条语义差异钉在单测里。
    const pixels = maskWith(255, 0, 255);
    const got: unknown[] = [];
    const factory: TintCanvasFactory = {
      createCanvas(width, height) {
        let src: Uint8ClampedArray | undefined = pixels;
        const ctx: TintContext2DLike = {
          drawImage: () => { /* noop */ },
          getImageData: () => ({ data: src! }),
          putImageData: (image) => { got.push(image); },
        };
        return { width, height, getContext: () => ctx };
      },
    };
    const cache = new TintSpriteCache(factory, { get: () => ({ id: 'm' } as FakeImage) },
      { createImageData: fakeImageData, ...NO_FLIP, size: SIZE });
    cache.get('m', CREAM);
    expect(got).toHaveLength(1);
    const image = got[0] as { data: Uint8ClampedArray; width: number; height: number };
    expect(image).not.toBeInstanceOf(Uint8ClampedArray);
    expect(image.data).toBeInstanceOf(Uint8ClampedArray);
    expect(image.data).toHaveLength(SIZE * SIZE * 4);
    expect(Array.from(image.data.slice(0, 4))).toEqual([253, 246, 233, 255]);
  });

  it('孔区真透：shape=0 的像素全零（含 RGB）', () => {
    const { cache, slots } = makeCache({ m: maskWith(143, 97, 0) });
    cache.get('m', CREAM);
    expect(Array.from(slots[slots.length - 1]!.put!.slice(0, 4))).toEqual([0, 0, 0, 0]);
  });

  it('mask 像素只抽一次（第二色复用同一份 mask 数据）', () => {
    const { cache, slots } = makeCache({ m: maskWith(255, 0, 255) });
    cache.get('m', CREAM);
    cache.get('m', CHARCOAL);
    // 每次 miss 各建 1 个 scratch + 1 个 sprite canvas；drawImage 只发生在 scratch 上
    expect(slots.filter((s) => s.draws > 0)).toHaveLength(1);
  });

  it('不可解析色 ⇒ undefined 且不占缓存（不抛）', () => {
    const { cache } = makeCache({ m: maskWith(255, 0, 255) });
    expect(cache.get('m', 'red')).toBeUndefined();
    expect(cache.stats.sprites).toBe(0);
  });

  it('未注册 mask ⇒ undefined（静默跳过 ⇒ 矢量层兜底）', () => {
    const { cache } = makeCache({ m: maskWith(255, 0, 255) });
    expect(cache.get('nope', CREAM)).toBeUndefined();
    expect(cache.stats.sprites).toBe(0);
  });

  it('invalidateAll 清空缓存与计数', () => {
    const { cache } = makeCache({ m: maskWith(255, 0, 255) });
    cache.get('m', CREAM);
    cache.invalidateAll();
    expect(cache.stats).toMatchObject({ hits: 0, misses: 0, sprites: 0, masks: 0, usedBytes: 0 });
  });
});

describe('TintSpriteCache · 字节预算 LRU', () => {
  const one = SIZE * SIZE * 4;

  it('默认预算 2.5 MiB 装得下 40 条 128² sprite（单关卡 7 色 ⇒ 5.7× 余量）', () => {
    const { cache } = makeCache({});
    expect(cache.stats.budgetBytes).toBe(2.5 * 1024 * 1024);
    expect(Math.floor(cache.stats.budgetBytes / (128 * 128 * 4))).toBe(40);
  });

  it('超预算 ⇒ 逐出最旧（LRU），usedBytes 回落', () => {
    const { cache } = makeCache({ m: maskWith(255, 0, 255) }, { budgetBytes: one * 4 });
    const a = cache.get('m', '#000000')!;
    cache.get('m', '#111111');
    cache.get('m', '#222222');
    expect(cache.stats.sprites).toBe(3);
    expect(cache.stats.evictions).toBe(0);

    cache.get('m', '#333333');
    expect(cache.stats.evictions).toBe(1);
    expect(cache.stats.sprites).toBe(3);
    // a 是最旧 ⇒ 已被逐出，重新合成必得不同引用
    expect(cache.get('m', '#000000')).not.toBe(a);
  });

  it('命中会提到 LRU 末尾（先命中谁，谁就不被逐出）', () => {
    const { cache } = makeCache({ m: maskWith(255, 0, 255) }, { budgetBytes: one * 4 });
    const a = cache.get('m', '#000000')!;
    cache.get('m', '#111111');
    cache.get('m', '#222222');
    cache.get('m', '#000000'); // 命中 a ⇒ a 变最新
    cache.get('m', '#333333'); // 逐出 #111111
    expect(cache.get('m', '#000000')).toBe(a);
    expect(cache.stats.evictions).toBe(1);
  });

  it('合成失败 ⇒ 负缓存（不再重试）+ errors 计数（防低端机雪崩）', () => {
    let boom = true;
    const pixels = maskWith(255, 0, 255);
    const factory: TintCanvasFactory = {
      createCanvas(width, height) {
        let src: Uint8ClampedArray | undefined = pixels;
        const ctx: TintContext2DLike = {
          drawImage: () => { /* mask 像素直供 */ },
          getImageData: () => ({ data: src! }),
          putImageData: () => { if (boom) throw new Error('OOM'); },
        };
        return { width, height, getContext: () => ctx };
      },
    };
    const cache = new TintSpriteCache(factory, { get: () => ({ id: 'm' } as FakeImage) }, { createImageData: fakeImageData, ...NO_FLIP, size: SIZE });
    expect(cache.get('m', CREAM)).toBeUndefined();
    expect(cache.stats).toMatchObject({ errors: 1, failed: 1, sprites: 0 });
    // 第二次：**不再进合成**（负缓存）⇒ errors 不增
    expect(cache.get('m', CREAM)).toBeUndefined();
    expect(cache.stats.errors).toBe(1);
    // 恢复后仍不重试（负缓存要显式 invalidateAll 才清）
    boom = false;
    expect(cache.get('m', CREAM)).toBeUndefined();
    cache.invalidateAll();
    expect(cache.get('m', CREAM)).toBeDefined();
  });

  it('mask 未注册 ⛔ 不负缓存（资产可能异步到位）', () => {
    let registered = false;
    const pixels = maskWith(255, 0, 255);
    const factory: TintCanvasFactory = {
      createCanvas(width, height) {
        let src: Uint8ClampedArray | undefined = pixels;
        const ctx: TintContext2DLike = {
          drawImage: () => { /* noop */ },
          getImageData: () => ({ data: src! }),
          putImageData: () => { /* noop */ },
        };
        return { width, height, getContext: () => ctx };
      },
    };
    const cache = new TintSpriteCache(factory, { get: () => (registered ? { id: 'm' } as FakeImage : undefined) }, { createImageData: fakeImageData, ...NO_FLIP, size: SIZE });
    expect(cache.get('m', CREAM)).toBeUndefined();
    registered = true;                       // 资产到位
    expect(cache.get('m', CREAM)).toBeDefined();
    expect(cache.stats.failed).toBe(0);
  });

  it('usedBytes 记账 = sprite + mask 像素（诊断口径可核）', () => {
    const { cache } = makeCache({ m: maskWith(255, 0, 255) });
    cache.get('m', CREAM);
    expect(cache.stats.usedBytes).toBe(one * 2);
    expect(cache.stats.masks).toBe(1);
  });
});
