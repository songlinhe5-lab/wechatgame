/**
 * `[WXG-T-254 / ADR-0030 S5′-2]` 底 tile 形态的口径判据。
 *
 * 钉住的正是用户 2026-10-05 的裁定原话：「**画布 33dp 只为背景色统一（盖格缝），
 * mask 内容 ⛔ 不跟着放大，居中绘制**」。
 * ⇒ 三条腿：① 内容像素尺寸 = 格径映射（33dp 画布 ⇒ 116/128，**绝不 ≥128**）；
 * ② 合成结果 = 边缘色环带 + 内容居中（⛔ 不是整幅拉伸，也不是左上贴）；
 * ③ `inner ≥ size` 退化为整幅拷贝（放大不归这里管）。
 */
import { describe, expect, it } from 'vitest';
import {
    MASK_TILE_SUFFIX,
    composeMaskTile,
    isMaskTileId,
    maskTileInnerPx,
    maskTileSourceId,
} from '../../src/core/bake/mask-tile.js';
import { MASK_CANONICAL_SIZE, MASK_CELL_DP } from '../../src/core/bake/mask-spec.js';

/** 把 dp 画布换算成 inner（与生产同一笔算术：格距 32 + 出血 0.5×2 = 33）。 */
const TILE_DP = 33;

const flat = (size: number, r: number, g: number, b: number): Uint8ClampedArray => {
    const d = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
    return d;
};

/** 取像素（返回 `[r, g, b, a]`，便于 `toEqual` 读断言失败信息）。 */
const px = (d: Uint8ClampedArray, size: number, x: number, y: number): number[] => {
    const o = (y * size + x) * 4;
    return [d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!];
};

describe('mask-tile · 画布与内容的尺（用户裁定：33dp 画布 / 30dp 内容）', () => {
    it('画布 = 格径 ⇒ 零缩放（inner = size）', () => {
        expect(maskTileInnerPx(MASK_CELL_DP)).toBe(MASK_CANONICAL_SIZE);
    });

    it('画布 = 33dp ⇒ inner = 116（< 128 ⇒ 内容是**缩小居中**，⛔ 不是放大）', () => {
        expect(maskTileInnerPx(TILE_DP)).toBe(116);
        expect(maskTileInnerPx(TILE_DP)).toBe(Math.round((MASK_CANONICAL_SIZE * MASK_CELL_DP) / TILE_DP));
        expect(maskTileInnerPx(TILE_DP)).toBeLessThan(MASK_CANONICAL_SIZE);
    });

    it('tile id 与源 id 互推（宿主注册表只认源 id）', () => {
        const src = 'mask__grid__holed__v1';
        const tile = `${src}${MASK_TILE_SUFFIX}`;
        expect(isMaskTileId(tile)).toBe(true);
        expect(isMaskTileId(src)).toBe(false);
        expect(maskTileSourceId(tile)).toBe(src);
        expect(maskTileSourceId(src)).toBe(src);
    });
});

describe('composeMaskTile · 边缘色铺满 + 内容居中', () => {
    it('① 环带 = 源边缘色，内容 = 居中（size 8 / inner 4 ⇒ 四周 1 环 + 中心 4×4）', () => {
        const size = 8;
        const inner = 4;
        const src = flat(size, 7, 7, 7);
        // 源中心块（4,4)-(5,5) 涂亮 ⇒ 映射后应落在 dst 的 (off+2, off+2) 一个像素上。
        for (let y = 4; y < 6; y++) {
            for (let x = 4; x < 6; x++) {
                const o = (y * size + x) * 4;
                src[o] = 200; src[o + 1] = 0; src[o + 2] = 0;
            }
        }
        const dst = new Uint8ClampedArray(size * size * 4);
        composeMaskTile(dst, src, size, inner);

        expect(px(dst, size, 0, 0)).toEqual([7, 7, 255, 255]);       // 左上角 = 边缘色（d/l 同源；shape 被强制 255）
        expect(px(dst, size, size - 1, size - 1)).toEqual([7, 7, 255, 255]); // 右下角 = 边缘色（四角同源）
        expect(px(dst, size, 1, 4)).toEqual([7, 7, 255, 255]);       // 环带（x < off）不含内容色 ⇒ 未被整幅拉伸
        // 内容居中：off = (8-4)/2 = 2，dst(4,4) = inner(2,2) ⇒ 采样 src 的 (4..5, 4..5) = 亮块。
        expect(px(dst, size, 4, 4)).toEqual([200, 0, 255, 255]);
        expect(px(dst, size, 3, 3)).toEqual([7, 7, 255, 255]);       // inner(1,1) 采到的是 src 暗区
        expect(px(dst, size, 6, 6)).toEqual([7, 7, 255, 255]);       // 右下环带（x ≥ off+inner）= 边缘色
    });

    it('② 源为纯色 ⇒ 输出逐位仍是同一纯色（环带与内容无缝，格缝被背景色盖住）', () => {
        const size = 8;
        const src = flat(size, 150, 71, 99);
        const dst = new Uint8ClampedArray(size * size * 4);
        composeMaskTile(dst, src, size, 6);
        for (let i = 0; i < size * size; i++) {
            expect(dst[i * 4]! + dst[i * 4 + 1]! + dst[i * 4 + 2]!).toBe(150 + 71 + 255);
            expect(dst[i * 4 + 3]!).toBe(255);
        }
    });

    it('③ inner ≥ size ⇒ 整幅拷贝（⛔ 不放大，也不留环带；shape 仍被强制）', () => {
        const size = 8;
        const src = flat(size, 1, 2, 3);
        src[4] = 99; // (1,0) 一个独有像素
        const dst = new Uint8ClampedArray(size * size * 4);
        composeMaskTile(dst, src, size, size);
        for (let i = 0; i < size * size; i++) {
            expect([dst[i * 4], dst[i * 4 + 1], dst[i * 4 + 3]]).toEqual([src[i * 4], src[i * 4 + 1], src[i * 4 + 3]]);
            expect(dst[i * 4 + 2]).toBe(255);
        }
    });

    // `[WXG-T-257]` 病灶：定稿 grid mask 的 shape（B）在格外 = 0（cell 形态的「真透」），
    // 而盘面合并后每格只发底 tile 这一条 blit ⇒ 继承 shape = 合成 tile 一半像素透明
    // ⇒ 格底外圈与格缝露背景（-0.3 色档丢失）。本腿钉住「底图满幅不透明」。
    it('④ 源 shape 全 0（cell 形态的格外真透）⇒ tile 形态 shape 恒 255（底图不继承真透）', () => {
        const size = 8;
        const src = flat(size, 178, 0, 0);   // = 定稿 grid mask 边缘像素：d 0.70 / l 0 / shape 0
        const dst = new Uint8ClampedArray(size * size * 4);
        composeMaskTile(dst, src, size, 6);   // 环带路径（整幅那条已由 ③ 覆盖）
        for (let i = 0; i < size * size; i++) expect(dst[i * 4 + 2]).toBe(255);
    });
});
