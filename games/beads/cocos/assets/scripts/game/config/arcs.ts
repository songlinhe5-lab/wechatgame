/**
 * ⚠️ GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: games/beads/design/levels/{manifest.json, chapters/*.json}
 *   · 章语义（名字 / 关卡清单 / 橱窗图选择）= chapters/<id>.json
 *   · 章序与是否开放              = manifest.json 的 chapters[{order, open}]
 * Regenerate:      node tools/scripts/sync-levels-data.mjs --game=beads
 * Drift guard:     pnpm run levels:check（pnpm run verify 内；生成期断言集见脚本头）
 *
 * 大关（chapter）配置层设计正本 = design/proposals/level-content-pipeline.md §11
 * （WXG-T-335 双成员设计批；落码 = WXG-T-336 CH-S1/S2）。改大关 = 加/改
 * chapters/*.json + manifest 一行，⛔ 不改本文件（手改会被 levels:check 打红）。
 *
 * 「大关」 = 一组题材关卡 + boss 关收尾（曾用名「主题」；术语正本 =
 * design/ux/arc-level-select-spec.md）；⚠️ 与珠材质皮肤主题（systems-index §3.7）
 * 不同源、不同解锁链。走马灯按大关翻页；装载只认 {@link OPEN_ARCS}。
 */

/**
 * 大关行（生成物数据体元素）。类型独立声明（生成侧写显式注解，⛔ 不用 `as const`，
 * 与手写时代 `(typeof ARCS)[number]` 对外等价：消费点只读字段、不依赖字面量窄化）。
 */
export interface ArcEntry {
  /** 稳定 id（= chapters/<id>.json 文件名；一经发布不改不删、不复用）。 */
  readonly id: string;
  /** 橱窗上的大关名（真源 = 章文件 `title`；空值由生成期拒收）。 */
  readonly title: string;
  /** Cocos Bundle 名。⚠️ 值是资源路径（现有这一张在 `assets/themes`），改名批**不动**。 */
  readonly bundle: string;
  /** bundle 内路径，无扩展名。资产正本 = design/levels/assets/<art>.png（生成期断言存在）。 */
  readonly art: string;
  /** blit 用的 textureId（全表唯一，生成期断言）。 */
  readonly textureId: string;
  /**
   * 本大关的关卡清单 = **1-based 连续区间** `[from, to][]`（与 `levels-data.ts` 的
   * `id` 同轴；Q17 = 甲 ⇒ 大关① = 关号 1–9，L9 boss 收尾）。**生成派生**：真源 = 章文件
   * `levels[]`（uid 列表）→ 装配下标 → 章内相邻连续项合并；区间不重叠、落现池内
   * （`DEMO_LEVEL_COUNT`）由 `tests/arcs.test.ts` 表侧不变式把关；
   * ⛔ 不新建关、⛔ 不动 `design/levels/singles/**` 与生成链（`tls §8.1 D1`）。
   */
  readonly levelRefs: readonly (readonly [number, number])[];
}

/** 空橱窗上的字（下标 = {@link ARC_OPEN_MAX} 的那一页）。手写常量，⛔ 不属生成数据体。 */
export const ARC_COMING_SOON = '敬请期待';

export const ARCS: readonly ArcEntry[] = [
  {
    id: "mandala",
    title: "曼陀罗",
    bundle: "themes",
    art: "l9-boss-mandala-256",
    textureId: "bitmap__boss_l9",
    levelRefs: [
      [
        1,
        9,
      ],
    ],
  },
];

/** 本版开放的大关数 = `open:true` 前缀长度（生成派生；真源 = manifest.chapters[].open）。 */
export const ARC_OPEN_MAX = 1;

/** 本版实际投放的大关。长度 = {@link ARC_OPEN_MAX}。 */
export const OPEN_ARCS: readonly ArcEntry[] = ARCS.slice(0, ARC_OPEN_MAX);
