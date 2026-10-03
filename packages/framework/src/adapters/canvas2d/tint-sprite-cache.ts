/**
 * `[WXG-T-226 EP12-B3]` Canvas2D **tint sprite 缓存**（CPU 预合成 + 字节预算 LRU）。
 *
 * ## 为什么是「缓存」而不是每帧现算
 *
 * 一颗珠 = 128×128 = 16384 像素的逐像素合成。盘面 841 格 ⇒ 每帧 1380 万次乘加不可接受。
 * 缓存键 = `(maskId, tint)`，**工作集 = 单关卡色集**（实测 `design/levels/singles/*.json`
 * 的 `palette` 恒 8 项 / 7 个不同色 ⇒ 7 条 sprite = 448 KB）⇒ `DEFAULT_BAKE_BUDGET_BYTES`
 * （2.5 MiB = 40 条 128² RGBA = 2.5 MiB/64 KiB 整除）有 **5.7× 余量**⇒ 稳态零逐出。
 * ⛔ 品牌调色板规模（15 份合计 2104 色）是**调色板**不是工作集，不参与本预算口径。
 *
 * ## 零分配查表（C2 同款纪律）
 *
 * 查表走**两层 Map**（`maskId → tint → sprite`）⇒ 命中路径 **0 次堆分配**；
 * ⛔ 不做 `maskId + tint` 拼键（那会让每珠每帧产生一次字符串分配）。
 * LRU 顺序另用一条以 sprite 引用为键的 `Map`（插入序 = LRU 序，与 `bake-lru.ts` 同款手法）。
 *
 * ## 键的形状
 *
 * 用 `tint`（颜色串）而**不是** `colorIdx` 入键：本缓存在 adapter 层，只拿到 blit 上的
 * `tint` 字段（`core/bake/bake-key.ts` 的 `deriveKey` 语义 ⛔ 不动，避免污染烘焙键纪律）。
 */

import { compositeTintMask, parseTintColor } from '../../core/bake/tint-composite.js';
import { estimateTextureSize, DEFAULT_BAKE_BUDGET_BYTES, BakeCacheCounters } from '../../core/bake/bake-budget.js';
import { MASK_CANONICAL_SIZE } from '../../core/bake/mask-spec.js';

/** 最小离屏 canvas 子集（结构化类型 ⇒ `OffscreenCanvas` / DOM canvas / wx canvas 均满足）。 */
export interface TintCanvasLike {
    width: number;
    height: number;
    getContext(contextId: '2d'): TintContext2DLike | null;
}

/** 最小 2D 上下文子集：读 mask 像素 + 落地合成结果。 */
export interface TintContext2DLike {
    drawImage(image: object, dx: number, dy: number, dw: number, dh: number): void;
    getImageData(sx: number, sy: number, sw: number, sh: number): { data: Uint8ClampedArray };
    /** ⚠ 真实浏览器只接受 `ImageData` **实例**（传裸 `Uint8ClampedArray` 会抛）。 */
    putImageData(image: object, dx: number, dy: number): void;
}

/** 最小 `ImageData` 视图（真实实现 = 浏览器内置类；测试 = 纯对象）。 */
export interface TintImageDataLike {
    data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
}

/** 离屏 canvas 工厂（宿主注入；`core` 与 adapter 层均 ⛔ 不 `import 'cc'` / lib.dom）。 */
export interface TintCanvasFactory {
    createCanvas(width: number, height: number): TintCanvasLike;
}

/** mask 逻辑 id → 可 `drawImage` 的对象（通常与 `TextureRegistry` 同一注入源）。 */
export interface TintMaskSource {
    get(maskId: string): object | undefined;
}

export interface TintSpriteCacheOptions {
    /**
     * **必填**：`ImageData` 构造器（宿主注入 —— `ImageData` 是浏览器/宿主能力，
     * `core` 与 adapter 均 ⛔ 不假设 lib.dom，同 `BakeCanvasFactory` 先例）。
     *
     * ⛔ **为什么必填而不是可选**：真实浏览器的 `putImageData` 只接受 `ImageData` 实例；
     * 传裸 `Uint8ClampedArray` 会抛 `parameter 1 is not of type 'ImageData'`。
     * 做成必填 ⇒ 漏配的宿主在**编译期**报错；做成可选 ⇒ 运行时静默失败（首版就是这样：
     * 单测 fake ctx 照收不误 ⇒ 410 绿而真浏览器 0 条产出）。
     */
    readonly createImageData: (width: number, height: number) => TintImageDataLike;
    /**
     * **必填**：合成出的 sprite 是否要**上下镜像**。
     *
     * ## 实测口径（2026-10-03，A/B 截图 + `tools/` 侧离线模拟）
     *
     * `Canvas2DRenderer` 的 `blit` 在 `applyViewportTransform = true` 时会绕矩形中心
     * `scale(1,-1)`，但**帧级已有一次 y 翻转**（viewport 变换）⇒ **两翻相抵**。
     * 所以贴图约定是「**纹理按屏幕朝向给**」（`bake-surface-impl.ts` 的预翻转同理）。
     * 定稿 mask PNG 由 py 产出，正是屏幕朝向 ⇒ **默认 `false`（不预镜像）**。
     *
     * ⚠ **反向教训**：曾按「blit 会翻转 ⇒ sprite 需预镜像」推理落 `true`，
     * 实测 A/B 读数为「flip=0 上半 112.3 / 下半 88.6（光影在上，对）」、
     * 「flip=1 上半 99.7 / 下半 109.4（反）」⇒ 推理错、实测对。**改这一行前先跑 A/B**。
     *
     * 保留本选项而非删掉：宿主若用 `applyViewportTransform: false` 或自建变换，
     * 约定由它决定 ⇒ 仍需一个**显式声明位**（做成必填 ⇒ 漏配在编译期炸，不静默错色）。
     */
    readonly flipY: boolean;
    /** 字节预算（缺省 = `DEFAULT_BAKE_BUDGET_BYTES` 2.5 MB，与烘焙 LRU 同口径）。 */
    readonly budgetBytes?: number;
    /** mask 边长（px）。全部 mask 按 `MASK_CANONICAL_SIZE` 烘 ⇒ 缺省即 128。 */
    readonly size?: number;
    /** 最多缓存几张 mask 的像素（白名单只 4 张；超限清空重来，最省事且无泄漏）。 */
    readonly maxMasks?: number;
}

interface MaskEntry {
    readonly pixels: Uint8ClampedArray;
    readonly sizeBytes: number;
}

interface SpriteEntry {
    readonly maskId: string;
    readonly tint: string;
    readonly sprite: object;
    readonly sizeBytes: number;
}

const DEFAULT_MAX_MASKS = 8;

/** 原地逐行上下镜像（RGBA 交错，行宽 = `width * 4`）。⛔ 不分配新缓冲。 */
function flipRows(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const stride = width * 4;
    for (let y = 0; y < (height >> 1); y++) {
        const top = y * stride;
        const bottom = (height - 1 - y) * stride;
        for (let x = 0; x < stride; x += 4) {
            const a = pixels[top + x]!;
            pixels[top + x] = pixels[bottom + x]!;
            pixels[bottom + x] = a;
            const b = pixels[top + x + 1]!;
            pixels[top + x + 1] = pixels[bottom + x + 1]!;
            pixels[bottom + x + 1] = b;
            const c = pixels[top + x + 2]!;
            pixels[top + x + 2] = pixels[bottom + x + 2]!;
            pixels[bottom + x + 2] = c;
            const d = pixels[top + x + 3]!;
            pixels[top + x + 3] = pixels[bottom + x + 3]!;
            pixels[bottom + x + 3] = d;
        }
    }
    return pixels;
}

/** 诊断读数（供守卫/台账引用；⛔ 非热路径）。 */
export interface TintSpriteStats {
    readonly hits: number;
    readonly misses: number;
    readonly evictions: number;
    readonly sprites: number;
    readonly masks: number;
    readonly usedBytes: number;
    readonly budgetBytes: number;
    /** canvas 侧失败累计次数（异常 / 无 2D 上下文）。⚠ 命中负缓存后不再重复计入。 */
    readonly errors: number;
    /** 负缓存条目数（已放弃合成的 `(maskId, tint)` 对）。 */
    readonly failed: number;
}

export class TintSpriteCache {
    private readonly _factory: TintCanvasFactory;
    private readonly _masks: TintMaskSource;
    private readonly _createImageData: (w: number, h: number) => TintImageDataLike;
    private readonly _flipY: boolean;
    private readonly _size: number;
    private readonly _maxMasks: number;
    private readonly _budgetBytes: number;

    /** 两层查表（零分配命中路径）。 */
    private readonly _byKey = new Map<string, Map<string, SpriteEntry>>();
    /** 以 sprite 引用为键的插入序表 = 全局 LRU 序（最近使用在末尾）。 */
    private readonly _lru = new Map<SpriteEntry, true>();
    private readonly _maskPixels = new Map<string, MaskEntry>();
    private readonly _counters = new BakeCacheCounters();
    /**
     * **负缓存**（`maskId → tint 集合`）：canvas 侧合成失败后**不再重试**。
     *
     * ⚠ 为什么必需（2026-10-03 review 抓出）：只「跳过本帧」的话，低端机 OOM 时
     * **每帧**都要 `createCanvas` + 合成 16384 px + 抛异常 ⇒ 29×29 盘 = 841 次/帧
     * ⇒ 优雅降级退化成性能雪崩。
     *
     * ⛔ **只缓存 canvas 侧失败**；`mask 未注册` **不**缓存 —— 资产可能异步到位
     * （负缓存会把「还没加载完」永久钉成「不可用」）。
     */
    private readonly _failed = new Map<string, Set<string>>();
    private _usedBytes = 0;
    private _errors = 0;

    /** ⛔ `options` 必填（`createImageData` 是必填项 ⇒ 不给「忘了配」的默认值）。 */
    constructor(factory: TintCanvasFactory, masks: TintMaskSource, options: TintSpriteCacheOptions) {
        this._factory = factory;
        this._masks = masks;
        this._createImageData = options.createImageData;
        this._flipY = options.flipY;
        this._size = options.size ?? MASK_CANONICAL_SIZE;
        this._maxMasks = options.maxMasks ?? DEFAULT_MAX_MASKS;
        this._budgetBytes = options.budgetBytes ?? DEFAULT_BAKE_BUDGET_BYTES;
    }

    get stats(): TintSpriteStats {
        return {
            hits: this._counters.hitCount,
            misses: this._counters.missCount,
            evictions: this._counters.evictCount,
            sprites: this._lru.size,
            masks: this._maskPixels.size,
            usedBytes: this._usedBytes,
            budgetBytes: this._budgetBytes,
            errors: this._errors,
            failed: this._failed.size,
        };
    }

    /**
     * 取 `(maskId, tint)` 的合成 sprite。
     *
     * @returns 可直接交给 `drawImage` 的对象；**颜色不可解析 / mask 未注册 / 无 2D 上下文**
     *   ⇒ `undefined`（调用方跳过该 blit，与纹理缺失同处理，不抛）。
     */
    get(maskId: string, tint: string): object | undefined {
        const rgb = parseTintColor(tint);
        if (rgb === undefined) return undefined;

        // 负缓存优先：已放弃的键直接跳过（⛔ 不重试 ⇒ 防雪崩）
        if (this._failed.get(maskId)?.has(tint) === true) return undefined;

        const byTint = this._byKey.get(maskId);
        const hit = byTint?.get(tint);
        if (hit !== undefined) {
            // 命中：提到 LRU 末尾（`Map` 无 re-insert API ⇒ delete+set，与 bake-lru 同款）
            this._lru.delete(hit);
            this._lru.set(hit, true);
            this._counters.recordHit();
            return hit.sprite;
        }

        this._counters.recordMiss();
        const mask = this._maskPixelsOf(maskId);
        // ⛔ mask 未注册 ⇒ **不**负缓存（资产可能异步到位，见 `_failed` 注）
        if (mask === undefined) return undefined;

        let sprite: object;
        let sizeBytes: number;
        try {
            const canvas = this._factory.createCanvas(this._size, this._size);
            const ctx = canvas.getContext('2d');
            if (ctx === null) throw new Error('[TintSpriteCache] no 2d context');
            const out = new Uint8ClampedArray(mask.pixels.length);
            compositeTintMask(out, mask.pixels, rgb);
            // ⚠ 必须包成 `ImageData` **实例**（真浏览器不接受裸数组）—— 见 options 注
            const image = this._createImageData(this._size, this._size);
            image.data.set(out);
            ctx.putImageData(image, 0, 0);
            sprite = canvas;
            sizeBytes = estimateTextureSize(this._size, this._size);
        } catch {
            // 原子性：合成失败 ⇒ **不入缓存** + 负缓存（该 blit 本帧跳过，逐条降级不中断整帧）
            this._markFailed(maskId, tint);
            this._errors += 1;
            return undefined;
        }

        this._evictUntilRoom(sizeBytes);
        const entry: SpriteEntry = { maskId, tint, sprite, sizeBytes };
        if (byTint === undefined) this._byKey.set(maskId, new Map());
        this._byKey.get(maskId)!.set(tint, entry);
        this._lru.set(entry, true);
        this._usedBytes += sizeBytes;
        return sprite;
    }

    /** 清空全部缓存与计数（换肤 / mask 换代时调用）。 */
    invalidateAll(): void {
        this._byKey.clear();
        this._lru.clear();
        this._maskPixels.clear();
        this._failed.clear();
        this._usedBytes = 0;
        this._errors = 0;
        this._counters.reset();
    }

    /** 负缓存登记（canvas 侧失败 ⇒ 该键不再重试）。 */
    private _markFailed(maskId: string, tint: string): void {
        let tints = this._failed.get(maskId);
        if (tints === undefined) {
            tints = new Set<string>();
            this._failed.set(maskId, tints);
        }
        tints.add(tint);
    }

    // ── 内部 ────────────────────────────────────────────────────────────

    /** 取 mask 像素（每张 mask 只抽一次；抽像素靠 `drawImage` + `getImageData`）。 */
    private _maskPixelsOf(maskId: string): MaskEntry | undefined {
        const cached = this._maskPixels.get(maskId);
        if (cached !== undefined) return cached;

        const source = this._masks.get(maskId);
        if (source === undefined) return undefined;
        const scratch = this._factory.createCanvas(this._size, this._size);
        const ctx = scratch.getContext('2d');
        if (ctx === null) return undefined;
        ctx.drawImage(source, 0, 0, this._size, this._size);
        const raw = ctx.getImageData(0, 0, this._size, this._size).data;
        // 宿主渲染器若会 y 翻转 ⇒ sprite 必须预先镜像（见 options.flipY 的几何说明）。
        // ⚠ **先拷贝再翻**：`getImageData` 的缓冲按契约归本缓存所有，但若宿主返回的是
        // 共享/复用缓冲，原地翻会**污染宿主的数据**（真浏览器每次新分配 ⇒ 不触发；
        // 测试与 wx 宿主不一定）。4 张 mask × 64 KiB 的拷贝代价可忽略。
        const pixels = this._flipY ? flipRows(new Uint8ClampedArray(raw), this._size, this._size) : raw;

        const entry: MaskEntry = { pixels, sizeBytes: estimateTextureSize(this._size, this._size) };
        if (this._maskPixels.size >= this._maxMasks) {
            // mask 张数是白名单常量级（4）；超限直接清空重来（最省事、无逐出顺序要维护）
            this._dropAllMasks();
        }
        this._maskPixels.set(maskId, entry);
        this._usedBytes += entry.sizeBytes;
        return entry;
    }

    private _dropAllMasks(): void {
        for (const m of this._maskPixels.values()) this._usedBytes -= m.sizeBytes;
        this._maskPixels.clear();
    }

    private _evictUntilRoom(incoming: number): void {
        while (this._usedBytes + incoming > this._budgetBytes && this._lru.size > 0) {
            const oldest = this._lru.keys().next().value;
            if (oldest === undefined) return;
            this._lru.delete(oldest);
            this._byKey.get(oldest.maskId)?.delete(oldest.tint);
            this._usedBytes -= oldest.sizeBytes;
            this._counters.recordEviction();
        }
    }
}

/** 便捷构造：把 sprite 缓存接到既有注册表上（mask 与普通纹理可共用同一注入源）。 */
export function createTintSpriteCache(
    factory: TintCanvasFactory,
    registry: TintMaskSource,
    options: TintSpriteCacheOptions,
): TintSpriteCache {
    return new TintSpriteCache(factory, registry, options);
}
