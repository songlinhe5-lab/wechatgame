/**
 * 皮肤注册表（EP12-S8 · WXG-T-268 批 2；架构真源 = `design/proposals/skin-system/arch.md` D1/D5
 * + `epics-beads-ep12.md` S8）。
 * ─────────────────────────────────────────────────────────────────────────────
 * **本表 = 玩家可选皮肤池的唯一真源**（判例 = `view/bead-styles/registry.ts` 同构）：
 * 注册即可见（`registeredSkins()` 同时服务设置钮计数与循环序）；**注册序 = 循环序 =
 * 池序**（S9 §8-15 判例），⛔ 随手 append 会改玩家可见循环序。
 *
 * **默认肤 = 注册序首位**（用户 2026-10-07 裁定 1：暖纸即默认）⇒ `DEFAULT_SKIN` 直引
 * 注册项本身（同 `DEFAULT_BEAD_STYLE` 判例：不存在「默认档掉出池而静默回退」的形态）。
 *
 * **皮肤 = 纯数据包**（arch.md D1 方案 A）：hex / 字符串字段，⛔ 不携带代码分支
 * （方案 C 已弃）；模块级 `Object.freeze`（⛔ 运行时 `Object.assign(DEFAULT_PALETTE, …)`
 * 全局突变禁令，L5 只读快照纪律）。作用域 = **UI 令牌族**（`tokens`）；珠色基色、
 * 几何、动效参数**不入肤**（arch.md D4 / §1.9.7①；本批 endpointCoeffs 通道不开放，
 * 归 T-267 批 2）。珠面与格面美术不动（EP12 范围铁律）⇒ 换肤生效帧内珠体族输出零变更。
 *
 * **运行时切换**（arch.md D5）：设置页 `cycle-skin` 选择器钮 → 写 `settings.skinId` →
 * 渲染链换 `palette` 实例引用；下一帧生效、零过渡（⛔ 不引入插值，styleId 先例）。
 * 未注册 id 的最后防线 = `skinById(id) ?? DEFAULT_SKIN`（读档层 `normalizeSettings`
 * 已逐字段降级，本防线由测试钉住，同 `styleById` 回落判例）。
 */
import { COOL_VIOLET_SKIN } from './cool-violet.js';
import { WARM_PAPER_SKIN } from './warm-paper.js';
import type { BeadsPalette } from '../../view/palette.js';

/**
 * 皮肤包数据结构（arch.md D1 字段表映射；本批只落地已裁字段——
 * `endpointCoeffs` / `beadStyleDefault` / `inkMap` 均未开放，**不预留**，
 * 与 bead-styles「未注册风格不得预留 styleId」同纪律）。
 */
export interface BeadsSkin {
    /** 皮肤 id（持久化于 `settings.skinId`；studio 导出链 `levelDraft.skin` 引用同键）。 */
    readonly id: string;
    /** 玩家侧名（设置钮文案单源，⛔ 文案不写死款数——S9 §8-14 U16=甲判例）。 */
    readonly label: string;
    /** UI 令牌整实例（渲染链唯一消费面 = 现有 `BeadsPalette` 形参通道，不造第二套）。 */
    readonly tokens: BeadsPalette;
}

/** 注册序即池序即循环序；首位 = 默认肤（裁定 1：暖纸即默认）。 */
const REGISTRY: readonly BeadsSkin[] = Object.freeze([WARM_PAPER_SKIN, COOL_VIOLET_SKIN]);

const BY_ID: ReadonlyMap<string, BeadsSkin> = new Map(REGISTRY.map((s) => [s.id, s]));

/** 默认肤（直引注册项本身，不查表）。 */
export const DEFAULT_SKIN: BeadsSkin = WARM_PAPER_SKIN;
/** 默认肤 id 对外别名（存档层 / snapshot 初值用，⛔ 不得另写字面量）。 */
export const DEFAULT_SKIN_ID = WARM_PAPER_SKIN.id;

/** 全部已注册皮肤（返回冻结数组，禁运行时增删）。 */
export function registeredSkins(): readonly BeadsSkin[] {
    return REGISTRY;
}

/** 已注册 skinId 列表（设置钮计数 = `S9§8-19` 同形状：注册数 ≤ 1 ⇒ 钮不呈现）。 */
export function registeredSkinIds(): readonly string[] {
    return REGISTRY.map((s) => s.id);
}

/** 按 id 取皮肤；未注册 ⇒ undefined（调用方负责降级，⛔ 不得静默回退他档）。 */
export function skinById(id: string): BeadsSkin | undefined {
    return BY_ID.get(id);
}

/** id → 玩家侧名；未注册 id 回落 id 本身（同 `beadStyleLabel` 判例，⛔ 不回落默认档名）。 */
export function skinLabel(id: string): string {
    return BY_ID.get(id)?.label ?? id;
}
