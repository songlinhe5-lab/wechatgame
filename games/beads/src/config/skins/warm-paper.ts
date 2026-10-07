/**
 * EP12-S8 · 第一肤（默认肤）「暖纸拼豆台」。
 *
 * **裁定（用户 2026-10-07，WXG-T-268 批 2）**：暖纸即默认肤（维持 EP12-S1 落码现状）——
 * `tokens` **直引** `view/palette.ts::DEFAULT_PALETTE`（S1 换值批的消费副本 = 本肤取值，
 * 同一实例引用 ⇒ 默认肤渲染逐字节不变，T-267 mvp A1 前提）。
 *
 * 层向说明：`config/skins/` 运行时引 `view/palette` 是**皮肤系统的定向例外**——皮肤
 * 的职责就是「持有/切换 BeadsPalette 实例」，且 view 侧不 import 本目录（无环）；
 * `levels.ts` 的「config 不引 view」纪律针对的是**数值查询链**（PALETTES 查 hex），
 * 此处不适用（arch.md D1 判例：config 层持 hex 有 `palettes-data.ts` 先例）。
 */
import { DEFAULT_PALETTE } from '../../view/palette.js';
import type { BeadsSkin } from './registry.js';

export const WARM_PAPER_SKIN: BeadsSkin = Object.freeze({
    id: 'warm-paper',
    label: '暖纸拼豆台',
    tokens: DEFAULT_PALETTE,
});
