/**
 * `[WXG-T-226 EP12-S2 / ADR-0029 DEC-5]` tint mask **白名单**（显式化）。
 *
 * ## 纪律（DEC-5 原文）
 *
 * `maskId = 白名单(kind, gauge, styleId)`；返回 `undefined` ⇒ **矢量回退**（逐字节 = 今日）。
 *
 * ⛔ **当前只有 `facet-4` 有定稿 mask**（`art/tint-mask-asset-spec §1.1` 的八件套只覆盖默认皮肤）。
 * ⛔ **不得给未定稿风格偷烘 mask** —— 同屏 tint/矢量混用的观感由美术评（`[待真机]`）；
 * 新增风格进白名单 = 一次**定稿动作**（须先有 py 定稿产物 + 过 `mask:diff`），不是加一行映射。
 *
 * ## C2 热路径零分配
 *
 * 白名单表**预建全部 id 字符串**，`tintMaskId` 只做两次属性读取 ⇒ 每珠每帧**零堆分配**
 * （⛔ 不用模板串拼 id：那会让每珠每帧产生一次字符串分配，与 `bead-render` 里
 * `styleById` 预建 Map 的同款纪律相悖）。
 */

import { MASK_CANONICAL_SIZE, MASK_SCHEMA_VERSION, MASK_TILE_SUFFIX, type BeadMaskGauge, type BeadMaskKind } from '@wxgame/framework';
import { TINT_LOD_MAX_UPSCALE, TINT_MASK_GAUGE_PIN } from '../config/tuning.js';

/** 唯一已定稿的风格（= 默认皮肤 `facet-4`）。 */
export const TINT_MASK_STYLE_ID = 'facet-4';

/**
 * `[WXG-T-226 EP12-B4 / ADR-0029 DEC-4]` 放大回退判据（纯函数，⛔ 不读宿主状态）。
 *
 * @param maskDevicePx 该 mask 在屏上的**设备像素**边长（宿主算：`blit` 矩形边长 × zoom × dpr）
 * @param maxUpscale   阈值；缺省 = 冻结常量 `TINT_LOD_MAX_UPSCALE`（`null` ⇒ 永不回退）
 * @returns `false` ⇒ 该帧**不得**走 tint 臂（调用方落矢量臂）
 *
 * 宿主侧（唯一知道 zoom / dpr 的一层）在 `BeadTintRuntime.allowTint()` 里调本函数；
 * 滞回（`BEAD_LOD_HYST` 同型）也归宿主 —— 判据本身保持纯函数、可单测、不引入第二套状态机。
 */
export function tintUpscaleAllowed(
    maskDevicePx: number,
    maxUpscale: number | null = TINT_LOD_MAX_UPSCALE,
): boolean {
    if (maxUpscale === null) return true;
    return maskDevicePx <= MASK_CANONICAL_SIZE * maxUpscale;
}

/** `styleId → kind → gauge → mask 逻辑 id`（**id 全部预建**，见文件头 C2 注）。 */
const MASK_ID_TABLE: Readonly<
    Record<string, Readonly<Record<BeadMaskKind, Readonly<Record<BeadMaskGauge, string>>>>>
> = {
    [TINT_MASK_STYLE_ID]: {
        bead: {
            holed: `mask__bead__holed__v${MASK_SCHEMA_VERSION}`,
            holeless: `mask__bead__holeless__v${MASK_SCHEMA_VERSION}`,
        },
        cell: {
            holed: `mask__grid__holed__v${MASK_SCHEMA_VERSION}`,
            holeless: `mask__grid__holeless__v${MASK_SCHEMA_VERSION}`,
        },
    },
};

/**
 * `[WXG-T-254 / ADR-0030 S5′-2]` **L0 底 tile** 形态的 id 表（画布 = 格距 + 出血、内容 = 格径居中）。
 *
 * 与 `cell` 同一张源 mask（⛔ 不新造资产），只多一个 `__tile` 后缀 ⇒ 缓存侧按后缀分流到
 * `composeMaskTile`。单开一张表而不扩 `BeadMaskKind`：那个联合类型同时是**烘焙面种**
 * （`computeMaskField` 要按它选层集），而 tile 不是一种新面、只是一种新**包装**。
 */
const MASK_TILE_ID_TABLE: Readonly<Record<string, Readonly<Record<BeadMaskGauge, string>>>> = {
    [TINT_MASK_STYLE_ID]: {
        holed: `mask__grid__holed__v${MASK_SCHEMA_VERSION}${MASK_TILE_SUFFIX}`,
        holeless: `mask__grid__holeless__v${MASK_SCHEMA_VERSION}${MASK_TILE_SUFFIX}`,
    },
};

/** 两档全名（需求集派生用；顺序 = 有孔在前）。 */
const ALL_GAUGES: readonly BeadMaskGauge[] = ['holed', 'holeless'];

/**
 * `[WXG-T-255 / ADR-0030 §5.5]` **档位宏解析**（纯函数，⛔ 不读宿主状态）。
 *
 * `TINT_MASK_GAUGE_PIN` 非 `null` ⇒ 两档一律落到该档（打包缺张时的临时接线）；
 * `null` ⇒ 按调用方给的档位取。本函数只住在**查表处**调（见 `tintMaskId` / `tintTileMaskId`），
 * ⇒ 一处守卫同时覆盖两个宿主（harness / Cocos 载体）与两种形态（珠面 / 底 tile）。
 *
 * @param pin 缺省 = 在册宏；单测可传 `null` 验「不钉」那一态（⛔ 不去改模块常量）。
 */
export function resolveTintGauge(
    gauge: BeadMaskGauge,
    pin: BeadMaskGauge | null = TINT_MASK_GAUGE_PIN,
): BeadMaskGauge {
    return pin === null ? gauge : pin;
}

/**
 * 宿主**装载 / 预热 / warmup 阈值**的需求集（源 mask 逻辑 id，不含 `__tile` 后缀 ——
 * tile 由 `TintSpriteCache` 从同一张源像素派生，⛔ 不另发请求）。
 *
 * ⇒ 注入前提从「4/4 齐」收为「宏实际要的那几张齐」（WXG-T-255：构建档现在只包得到 `holed` 两张）。
 * 两个宿主均只消费本函数，⛔ 各自硬编码一遍 id。
 */
export function requiredTintMaskIds(
    pin: BeadMaskGauge | null = TINT_MASK_GAUGE_PIN,
): readonly string[] {
    const gauges = pin === null ? ALL_GAUGES : [pin];
    const out: string[] = [];
    for (let i = 0; i < gauges.length; i++) {
        const g = gauges[i]!;
        out.push(`mask__bead__${g}__v${MASK_SCHEMA_VERSION}`);
        out.push(`mask__grid__${g}__v${MASK_SCHEMA_VERSION}`);
    }
    return out;
}

/**
 * 底 tile 白名单查表（同 `tintMaskId` 的纪律：未定稿风格 ⇒ `undefined` ⇒ 视图层不合并）。
 */
export function tintTileMaskId(gauge: BeadMaskGauge, styleId: string): string | undefined {
    const byGauge = MASK_TILE_ID_TABLE[styleId];
    if (byGauge === undefined || typeof byGauge !== 'object') return undefined;
    return byGauge[resolveTintGauge(gauge)];
}

/**
 * 白名单查表 —— `maskId = 白名单(kind, gauge, styleId)`。
 *
 * @returns 命中的 mask 逻辑 id；未命中（风格未定稿 / 档未烘 / 未注入）⇒ `undefined` ⇒ 矢量回退。
 *
 * ⚠ 查表前先过 `resolveTintGauge()`（档位宏）⇒ 宏生效时两档同一张源 mask。
 */
export function tintMaskId(
    kind: BeadMaskKind,
    gauge: BeadMaskGauge,
    styleId: string,
): string | undefined {
    const byKind = MASK_ID_TABLE[styleId];
    // ⛔ 显式 `typeof` 守卫：挡掉原型链键（`'constructor'` 等）落到非 plain object 的情形。
    if (byKind === undefined || typeof byKind !== 'object') return undefined;
    const byGauge = byKind[kind];
    if (byGauge === undefined || typeof byGauge !== 'object') return undefined;
    return byGauge[resolveTintGauge(gauge)];
}

/** 白名单里已定稿的风格 id 列表（**只读副本**，供守卫/诊断打印；⛔ 非热路径）。 */
export function whitelistedTintStyles(): readonly string[] {
    return Object.keys(MASK_ID_TABLE);
}
