/**
 * 风格注册表（EP11-S2 骨架 → **EP11-S3 转正** → **EP11-S4 入池两套** · ADR-0023 §7 · §12.9 步 3/4）
 * ─────────────────────────────────────────────────────────────────────────────
 * **本表 = 玩家可选风格池的唯一真源**：注册即可见（`registeredStyleIds()` 同时服务
 * S9 §8-19「注册数 ≤ 1 ⇒ 设置钮不呈现」的计数与 U16 钮循环）⇒ ⛔ **对照用的
 * `legacy-ten` 十层风格不在本表内**，它住在 `bead-styles/legacy-ten.ts` 的
 * **registry 外对照通道**（任务单工作项 ②「不得让它触 U16 玩家钮」；把十层注册进来的
 * 字面做法会直接把它变成玩家可选风格，故不采）。理由其二：十层含 `line` 图元、stroke-only
 * 层与**双枚孔**——`contract.ts::BeadStyleLayer` 三态描述符仍表达不了它们（`WXG-T-211-S4`
 * 为 `18` 扩的是 `rect`/`circle` 的**可选 `stroke`/`lineWidth`**，⛔ 不等于「契约已能表达十层」，
 * 详见该文件头注的两条定死约束）。
 *
 * **S3 起渲染链开始消费本表**：`bead-render::drawFilledBead` 逐珠回放
 * `DEFAULT_BEAD_STYLE.beadLayers(...)` 的层集 ⇒ 盘面从十层变为**复刻·四棱刻面**
 * （6 命令 / 0 真 α，`assets-spec §7.11.1`）。S2 的「渲染链不消费本表 + 盘面逐帧不变」
 * 纪律随转正作废，改由 `legacy-ten` 对照臂承接「什么都没变」（§K.5.1 ④）。
 *
 * ⛔ 未注册风格**不得预留 styleId**（`16`/`19` 已移出池、`06` 只出池条件，epics Out of Scope）；
 *   注册数 ≤ 1 ⇒ 设置钮不呈现（S9 §8-19）。
 *
 * **注册序 = 池序 = `bead-visual-style-spec §12.6` 入选池表的行序**（正本行序为
 * 四棱 → `18` → `16` → `13` → `06` → `19`，剔除已移出/未出池者 ⇒ 实际注册序
 * **四棱 → `18` → `13`**）。注册序即设置钮循环序（S9 §8-15「注册序」真源）⇒ ⛔ 随手append。
 * 两条结构性约束另钉住「四棱必须居首」：① `DEFAULT_BEAD_STYLE` 直引注册项本身；
 * ② 门禁脚本 `--probe-argmax`（TC-STY-10 臂 B）取 `registeredStyles()[0]` 作探针对象。
 *
 * ⚠ **步 4 计划内中间态**（已回传供 QA 翻转 `TC-STY-11` 措辞）：本表注册数已达 3，
 *   但**面板设置钮属 §12.9 步 5**（EP11-S5）⇒ 「注册 ≥ 2 而面板无钮」是**时序**，
 *   ⛔ 不得读本行如「§8-19 后半句已违反」；亦不得为验该句提前造钮（越出本 Story 切片）。
 */
import { FACET4_STYLE_ID } from '../../config/tuning';
import { DUAL_TONE_13 } from './dual-tone-13';
import { FACET4 } from './facet-4';
import { LINEART_18 } from './lineart-18';
import type { BeadStyle } from './contract';

/**
 * **复刻·四棱刻面**（层集与纠正史见 `facet-4.ts` 头注；S2 内联定义在 S3 提出为独立模块）。
 * 绘制序 = 数组序 = `assets-spec §7.11.1` 行 1–6，实测 **6 命令 / 0 真 α**。
 */
const FACET4_STYLE: BeadStyle = FACET4;

/**
 * **`18` 线稿描边**（`assets-spec §7.11.3` 行 1–5，实测 **5 命令 / 1 真 α** = 池内 α 压线者）。
 * 本套是契约 `stroke`/`lineWidth` 字段的**唯一消费者**（造型身份 = 描边 ⇒ 不扩字段则落不了正本）。
 */
const LINEART18_STYLE: BeadStyle = LINEART_18;

/** **`13` 双色对角**（`§7.11.2` 行 1–3，实测 **3 命令 / 0 真 α** = 池内最省）。 */
const DUAL13_STYLE: BeadStyle = DUAL_TONE_13;

/** 注册序即循环序（S9 §8-15「注册序」真源，序由 = §12.6 池表行序）；模块级预建 + frozen（ADR-0023 §7）。 */
const REGISTRY: readonly BeadStyle[] = Object.freeze([FACET4_STYLE, LINEART18_STYLE, DUAL13_STYLE]);

const BY_ID: ReadonlyMap<string, BeadStyle> = new Map(REGISTRY.map((s) => [s.id, s]));

/**
 * **默认风格 = 四棱**（§12.9 步 3 转正；S5 设置两钮 + 存档落地前玩家不可改）。
 * 直接引用注册项本身（不查表）⇒ 不存在「默认档掉出池而渲染链静默回退」的形态；
 * 由 `tests/bead-style-pool.test.ts` 钉住「默认档 ∈ REGISTRY 且 id === `FACET4_STYLE_ID`」。
 */
export const DEFAULT_BEAD_STYLE: BeadStyle = FACET4_STYLE;
/** 默认档 styleId 的对外别名（给 view-model / 存档层用，⛔ 不得由调用方另写字面量）。 */
export const DEFAULT_BEAD_STYLE_ID = FACET4_STYLE_ID;

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
