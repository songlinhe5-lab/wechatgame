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

import { MASK_SCHEMA_VERSION, type BeadMaskGauge, type BeadMaskKind } from '@wxgame/framework';

/** 唯一已定稿的风格（= 默认皮肤 `facet-4`）。 */
export const TINT_MASK_STYLE_ID = 'facet-4';

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
 * 白名单查表 —— `maskId = 白名单(kind, gauge, styleId)`。
 *
 * @returns 命中的 mask 逻辑 id；未命中（风格未定稿 / 档未烘 / 未注入）⇒ `undefined` ⇒ 矢量回退。
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
    return byGauge[gauge];
}

/** 白名单里已定稿的风格 id 列表（**只读副本**，供守卫/诊断打印；⛔ 非热路径）。 */
export function whitelistedTintStyles(): readonly string[] {
    return Object.keys(MASK_ID_TABLE);
}
