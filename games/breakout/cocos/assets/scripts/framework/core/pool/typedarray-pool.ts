/**
 * `[WXG-T-567]` TypedArray 复用池 —— 烘焙热路径（`frostPixels` / `mask-field`）的 GC 抑制。
 *
 * ## 设计
 *
 * - 按 `byteLength` **向上取桶**（256 / 1024 / 4096 / 16384 / 65536 / 262144 / 1048576）；
 *   acquire(300) 返回 byteLength ≥ 300 的空闲 buffer（1024），比刚好 300 的 buffer 更易复用。
 * - 每桶最多 **2** 个空闲实例（烘焙低频用不上更多；超出直接丢弃，不累积）。
 * - acquire 返回后，release 前调用方独占使用；⛔ 持有引用到 release 后（与 `ObjectPool` 同纪律）。
 * - ⛔ 池化不是零成本：getOrBake miss 率 < 5% 时池化收益可忽略；本池仍保留——
 *   低端设备 / 大包烘焙（L2 以上）的 GC 抖动是不可接受的卡顿来源。
 *
 * ⛔ 纯 Node / 纯浏览器均可运行（无 DOM / `cc` / `wx`，L2 合规）。
 */

/** 桶边界，按 4× 递增覆盖 256B → 1MB。 */
const BUCKETS = [256, 1024, 4096, 16384, 65536, 262144, 1048576] as const;

/** 每桶最大空闲实例数。 */
const MAX_PER_BUCKET = 2;

function bucketIndex(requested: number): number {
    for (let i = 0; i < BUCKETS.length; i++) {
        if (BUCKETS[i]! >= requested) return i;
    }
    return -1; // 超出最大桶 → 不池化，每次 new
}

/** 池化存储：Uint8ClampedArray 与 Uint8Array 各一套（类型不可互换）。 */
const _clamped = BUCKETS.map(() => [] as Uint8ClampedArray[]);
const _uint8 = BUCKETS.map(() => [] as Uint8Array[]);

export type AnyUint8 = Uint8Array | Uint8ClampedArray;

/**
 * 申请一个 byteLength ≥ `requested` 的 Uint8ClampedArray。
 * 归还时用 {@link releaseClamped}。
 *
 * @param requested 所需最小字节数
 * @returns 已清零的 buffer（池化返回时被清零；新分配的当然是零值）
 */
export function acquireClamped(requested: number): Uint8ClampedArray {
    const i = bucketIndex(requested);
    if (i < 0) return new Uint8ClampedArray(Math.max(requested, 1));
    const idle = _clamped[i]!;
    if (idle.length > 0) {
        const buf = idle.pop()!;
        buf.fill(0);
        return buf;
    }
    return new Uint8ClampedArray(BUCKETS[i]!);
}

/** 归还 Uint8ClampedArray 到池。超桶容量则丢弃。 */
export function releaseClamped(buf: Uint8ClampedArray): void {
    const i = bucketIndex(buf.byteLength);
    if (i < 0) return; // 超最大桶 → 直接丢
    const idle = _clamped[i]!;
    if (idle.length >= MAX_PER_BUCKET) return; // 桶满，丢
    idle.push(buf);
}

/** 同 {@link acquireClamped} 但类型为 Uint8Array。 */
export function acquireUint8(requested: number): Uint8Array {
    const i = bucketIndex(requested);
    if (i < 0) return new Uint8Array(Math.max(requested, 1));
    const idle = _uint8[i]!;
    if (idle.length > 0) {
        const buf = idle.pop()!;
        buf.fill(0);
        return buf;
    }
    return new Uint8Array(BUCKETS[i]!);
}

/** 归还 Uint8Array 到池。超桶容量则丢弃。 */
export function releaseUint8(buf: Uint8Array): void {
    const i = bucketIndex(buf.byteLength);
    if (i < 0) return;
    const idle = _uint8[i]!;
    if (idle.length >= MAX_PER_BUCKET) return;
    idle.push(buf);
}

/** 清空所有池（测试 / 内存告警时用）。 */
export function clearTypedArrayPool(): void {
    for (let i = 0; i < BUCKETS.length; i++) {
        _clamped[i]!.length = 0;
        _uint8[i]!.length = 0;
    }
}
