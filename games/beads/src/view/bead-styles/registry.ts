/**
 * 风格注册表（EP11-S2 · ADR-0023 §7 形态 · §12.9 步 2）
 * ─────────────────────────────────────────────────────────────────────────────
 * **本单只注册 `facet-4`（复刻·四棱刻面）**：层集逐枚复刻 assets-spec §7.11.1
 * recipe / spike `styles.mjs::facetBead`（实测 **6 命令 / 0 真 α** = C11 第⑤项差值
 * 基准）。注册表 = 风格池门禁（`check-bead-style-pool.mjs`）的遍历对象；
 * **渲染链路本单不消费本表**（`bead-render::drawBead` 仍走十层现码）⇒ 盘面逐帧
 * 不变是硬门（SVG 对拍逐字节等值，证据 `temp/wxg-t-211-b1/`）；四棱转正 = EP11-S3。
 *
 * ⛔ 未注册风格**不得预留 styleId**（`16`/`19` 已移出池、`06` 只出池条件，
 * epics Out of Scope）；注册数 ≤ 1 ⇒ 设置钮不呈现（S9 §8-19，本单不得新增钮）。
 */
import {
    FACET4_FACET_INSET,
    FACET4_FACET_RIGHT_MIX,
    FACET4_HOLE_RADIUS,
    FACET4_PLATE_MIX,
    FACET4_STYLE_ID,
} from '../../config/tuning.js';
import { BEAD_CARD } from '../bead-render.js';
import { endpointOf, mix } from '../palette.js';
import type { BeadStyle, BeadStyleInput, BeadStyleLayer } from './contract.js';

/**
 * **复刻·四棱刻面**（§7.11.1 行 1–6，绘制序 = 数组序）：
 * 1. `plate` rect 满格 `mix(base, −0.34)`（暗底兼描边，radius = `round(0.30S)` =
 *    `BEAD_CARD.radius`，与 §1.1 卡同源）——**不进 C12 统计域**；
 * 2–5. 四枚三角刻面（上 = `lit` / 左 = `base` / 右 = `mix(base, −0.16)` /
 *      下 = `edge`），四角内缩 `i2 = 0.09S`，第三顶点恒在格心；
 * 6. `hole` circle `r = 0.17S`，fill = 目标格 `base`（K3 透色；`targetIdx ?? ci`
 *    回落口径同 spike）。
 *
 * ⚠ **偏差登记（不自行消解，任务单「孔双口径本单不裁不碰」）**：§7.11.1 行 6
 * 规格为 `pit` 色 + 半径 `0.22S`（`holeRatio 0.44`）；本实现照抄 spike recipe
 * （`base` 色 / `0.17S`），纠正归 §12.9 步 3/4。系数全部经 `tuning.ts::FACET4_*`
 * 注入（C4），色源全部经 `palette.ts`（C3），本文件零字面量。
 */
const FACET4: BeadStyle = {
    id: FACET4_STYLE_ID,
    beadLayers: ({ inks, colorIdx, targetColorIdx, size }: BeadStyleInput): readonly BeadStyleLayer[] => {
        const e = endpointOf(inks, colorIdx);
        const h = size / 2;
        const i2 = size * FACET4_FACET_INSET;
        // 与 spike 同式：三角形 = (角A, 角B, 格心)。格心局部系原点 ⇒ 第三顶点恒 (0,0)。
        const l = -h + i2; // 内缩后的左/下缘
        const r = h - i2; // 内缩后的右/上缘
        return [
            { kind: 'rect', role: 'plate', x: -h, y: -h, w: size, h: size, fill: mix(e.base, FACET4_PLATE_MIX), radius: Math.round(size * BEAD_CARD.radius) },
            { kind: 'polygon', role: 'facet', points: [l, r, r, r, 0, 0], fill: e.lit }, // 上刻面
            { kind: 'polygon', role: 'facet', points: [l, l, l, r, 0, 0], fill: e.base }, // 左刻面
            { kind: 'polygon', role: 'facet', points: [r, r, r, l, 0, 0], fill: mix(e.base, FACET4_FACET_RIGHT_MIX) }, // 右刻面
            { kind: 'polygon', role: 'facet', points: [r, l, l, l, 0, 0], fill: e.edge }, // 下刻面
            {
                kind: 'circle',
                role: 'hole',
                cx: 0,
                cy: 0,
                r: size * FACET4_HOLE_RADIUS,
                fill: endpointOf(inks, targetColorIdx ?? colorIdx).base,
            },
        ];
    },
};

/** 注册序即循环序（S9 §8-15「注册序」真源）；模块级预建 + frozen（ADR-0023 §7）。 */
const REGISTRY: readonly BeadStyle[] = Object.freeze([FACET4]);

const BY_ID: ReadonlyMap<string, BeadStyle> = new Map(REGISTRY.map((s) => [s.id, s]));

/** 全部已注册风格（门禁脚本遍历入口；返回冻结数组，禁运行时增删）。 */
export function registeredStyles(): readonly BeadStyle[] {
    return REGISTRY;
}

/** 已注册 styleId 列表（设置钮循环与 §8-19「注册数 ≤ 1 不呈现」的计数入口）。 */
export function registeredStyleIds(): readonly string[] {
    return REGISTRY.map((s) => s.id);
}

/** 按 id 取风格；未注册 ⇒ undefined（调用方负责降级，⛔ 不得静默回退他档）。 */
export function styleById(id: string): BeadStyle | undefined {
    return BY_ID.get(id);
}
