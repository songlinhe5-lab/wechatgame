/**
 * `[WXG-T-254 / ADR-0030 S5′-2]` **L0 底 tile 形态**（画布 = 格距 + 出血，内容 = 格径居中）。
 *
 * ## 为什么要第三种形态
 *
 * 盘面每格今天发 **2 条**命令：`drawTargetTile` 的 B0 平色 rect（边长 `gridPitch + 2×TILE_BLEED`
 * = 33dp，专为盖住相邻格的 AA 缝）+ 格面 mask 的 blit（边长 `gridCell` = 30dp）。
 * 合成一张 tile 就能压成 **1 条**。
 *
 * ## 口径（用户 2026-10-05 裁定）
 *
 * **画布 33dp 只为背景色统一（盖格缝），mask 内容 ⛔ 不跟着放大** —— 外圈 3dp 铺 mask
 * 自身的边缘色（`outsideD = 0.70` = B0 的 `edge`，同源同值），中间 30dp 保持格面原几何。
 *
 * `[WXG-T-257]` **tile 形态 shape（B 通道）恒 255** —— 底图是**纯色底**，⛔ 不继承 cell 形态的
 * 「格外真透」。动因 = 定稿 grid mask 的 shape 只在槽口内为 1（`B = 槽口内 255 / 格外 0`），
 * 而 S5′-2 合并后盘面每格只发这一条 blit（`tilePainted` 跳过了 B0 平色 rect）⇒ 继承 shape 会让
 * 合成 tile **50.7% 像素 alpha=0**（实测：格底外圈 3dp + 出血圈全透）⇒ 盘面珠格四周露出背景，
 * 「-0.3 色档底色」丢失。cell 形态不受影响（结构件仍按 shape 真透）。
 *
 * ⛔ 直接把 128px mask 拉伸到 33dp 是**错的**：槽口 ⌀24→26.4dp、斜面 3→3.3dp，而珠体静息
 * 只有 26dp ⇒ 盖不住 26.4dp 的槽口 ⇒ 每颗珠四周露出一圈槽底。A/B 实测（`tools/scripts/l0-tile-ab.mjs`）：
 * 拉伸版静息与今日最大差 90/255、差 >8 占 4.2%；本口径最大差 8/255、占 **0.0%**。
 *
 * ## 为什么在 CPU 上做双线性，而不是 `ctx.drawImage` 缩放
 *
 * `drawImage` 的采样核由宿主决定（浏览器 imageSmoothing 档位 / wx canvas 实现各异）
 * ⇒ 同一张 tile 在 harness 与 Cocos 会烘出**不同字节**，违 `ADR-0030 DEC-3`「同源 = 同代码」。
 * 本函数纯 TS、逐位确定 ⇒ 两端与单测同一条结果。
 */

import { MASK_CANONICAL_SIZE, MASK_CELL_DP } from './mask-spec';

/** 底 tile 形态的 mask 逻辑 id 后缀（源 mask 同 id 去后缀）。 */
export const MASK_TILE_SUFFIX = '__tile';

/** 该 mask id 是否为「底 tile」形态。 */
export function isMaskTileId(maskId: string): boolean {
    return maskId.endsWith(MASK_TILE_SUFFIX);
}

/** tile id → 源 mask id（非 tile 形态原样返回）。 */
export function maskTileSourceId(maskId: string): string {
    return isMaskTileId(maskId) ? maskId.slice(0, -MASK_TILE_SUFFIX.length) : maskId;
}

/**
 * tile 画布里「格面内容」应占的像素边长。
 *
 * @param tileDp 画布边长（dp）= `gridPitch + 2 × TILE_BLEED`（恒等档 33）
 * @param size   画布像素边长（缺省 = `MASK_CANONICAL_SIZE`）
 */
export function maskTileInnerPx(tileDp: number, size: number = MASK_CANONICAL_SIZE): number {
    return Math.round((size * MASK_CELL_DP) / tileDp);
}

/**
 * 合成一张底 tile：`dst[size×size]` = 边缘色铺满 + `src[size×size]` 内容双线性缩到 `inner×inner` 居中。
 *
 * 缓冲由调用方持有（LRU 槽位复用），本函数 ⛔ 不分配、⛔ 不改 `src`。
 * `inner >= size` ⇒ 退化为整幅拷贝（不放大 —— 放大属于 `TINT_LOD_MAX_UPSCALE` 那道阀的事）。
 */
export function composeMaskTile(
    dst: Uint8ClampedArray,
    src: Uint8ClampedArray,
    size: number,
    inner: number,
): void {
    const n = size * size;
    // 边缘色 = src 左上角像素的 d/l（定稿 mask 四边同值 —— 判据钉在测试里）；shape 见下方统一强制。
    const br = src[0]!, bg = src[1]!, ba = src[3]!;
    for (let i = 0; i < n; i++) {
        const o = i * 4;
        dst[o] = br; dst[o + 1] = bg; dst[o + 3] = ba;
    }
    const inner2 = Math.min(inner, size);
    // shape 通道（B）满幅置 1 ⇒ 底图不透明（口径见文件头 `[WXG-T-257]`；两条出口各一笔）。
    const SHAPE = (): void => { for (let i = 2; i < n * 4; i += 4) dst[i] = 255; };
    if (inner2 >= size) {
        dst.set(src.subarray(0, n * 4));
        SHAPE();
        return;
    }
    const off = (size - inner2) >> 1;
    const scale = size / inner2;
    const last = size - 1;
    for (let y = 0; y < inner2; y++) {
        const fy = (y + 0.5) * scale - 0.5;
        const y0 = Math.max(0, Math.min(last, Math.floor(fy)));
        const y1 = Math.min(last, y0 + 1);
        const wy = Math.max(0, Math.min(1, fy - y0));
        const rowDst = (off + y) * size + off;
        for (let x = 0; x < inner2; x++) {
            const fx = (x + 0.5) * scale - 0.5;
            const x0 = Math.max(0, Math.min(last, Math.floor(fx)));
            const x1 = Math.min(last, x0 + 1);
            const wx = Math.max(0, Math.min(1, fx - x0));
            const w00 = (1 - wx) * (1 - wy), w10 = wx * (1 - wy);
            const w01 = (1 - wx) * wy, w11 = wx * wy;
            const p00 = (y0 * size + x0) * 4, p10 = (y0 * size + x1) * 4;
            const p01 = (y1 * size + x0) * 4, p11 = (y1 * size + x1) * 4;
            const o = (rowDst + x) * 4;
            for (let k = 0; k < 4; k++) {
                dst[o + k] =
                    src[p00 + k]! * w00 + src[p10 + k]! * w10 +
                    src[p01 + k]! * w01 + src[p11 + k]! * w11;
            }
        }
    }
    SHAPE();
}
