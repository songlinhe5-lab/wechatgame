/**
 * 大关表。加大关 = 在表尾追加一行，并把橱窗图放进该行的 bundle。
 * 顺序只追加，已有 `id` 不改、不删（`tls §8.1 D1`）。
 *
 * 「大关」 = 一组题材关卡 + boss 关收尾（曾用名「主题」，Q14 = 已裁，
 * `tls §8.1 D9`）；⚠️ 与珠材质皮肤主题（`systems-index §3.7`）不同源、不同解锁链。
 * 走马灯按大关翻页属 S4（分片 C-2 ⑤）；装载只认 {@link OPEN_ARCS}。
 */

/**
 * 当前版本开放的大关数。升级包、追加关卡组时把这个数调大。
 * 表可以先写好后面的行；只投放前 N 项。走马灯在这 N 页之后还有一页空橱窗。
 */
export const ARC_OPEN_MAX = 1;

/** 空橱窗上的字（下标 = {@link ARC_OPEN_MAX} 的那一页）。 */
export const ARC_COMING_SOON = '敬请期待';

export const ARCS = [
  {
    /** 稳定 id。 */
    id: 'mandala',
    /** 橱窗上的大关名。 */
    title: '曼陀罗',
    /** Cocos Bundle 名。现有这一张在 `assets/themes`。⚠️ 值是资源路径，改名批**不动**。 */
    bundle: 'themes',
    /** bundle 内路径，无扩展名。正本 = `design/levels/assets/l9-boss-mandala-256.png`。 */
    art: 'l9-boss-mandala-256',
    /** blit 用的 textureId。 */
    textureId: 'bitmap__boss_l9',
    /**
     * 本大关的关卡清单 = **1-based 连续区间** `[from, to]`（与 `levels-data.ts` 的
     * `id` 同轴；Q17 = 甲 ⇒ 大关① = 关号 1–9，L9 boss 收尾）。区间不重叠、
     * 落现池内（`DEMO_LEVEL_COUNT`）由 `tests/arcs.test.ts` 表侧不变式把关；
     * ⛔ 不新建关、⛔ 不动 `design/levels/*.json` 与生成链（`tls §8.1 D1`）。
     */
    levelRefs: [[1, 9]],
  },
] as const;

export type ArcEntry = (typeof ARCS)[number];

/** 本版实际投放的大关。长度 = {@link ARC_OPEN_MAX}。 */
export const OPEN_ARCS: readonly ArcEntry[] = ARCS.slice(0, ARC_OPEN_MAX);
