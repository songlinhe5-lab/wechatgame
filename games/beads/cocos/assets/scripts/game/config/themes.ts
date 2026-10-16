/**
 * 主题列表。加一个主题 = 在表尾追加一行，并把橱窗图放进该行的 bundle。
 * 顺序只追加，已有 `id` 不改、不删。
 *
 * 走马灯按关翻页，还没改成按本表翻页。装载只认 {@link OPEN_THEMES}。
 */

/**
 * 当前版本开放的主题关数。升级包、追加主题时把这个数调大。
 * 表可以先写好后面的行；只投放前 N 项。走马灯在这 N 页之后还有一页空橱窗。
 */
export const THEME_LEVEL_MAX = 1;

/** 空橱窗上的字（下标 = {@link THEME_LEVEL_MAX} 的那一页）。 */
export const THEME_COMING_SOON = '敬请期待';

export const THEMES = [
  {
    /** 稳定 id。 */
    id: 'mandala',
    /** 橱窗上的主题名。 */
    title: '曼陀罗',
    /** Cocos Bundle 名。现有这一张在 `assets/themes`。 */
    bundle: 'themes',
    /** bundle 内路径，无扩展名。正本 = `design/levels/assets/l9-boss-mandala-256.png`。 */
    art: 'l9-boss-mandala-256',
    /** blit 用的 textureId。 */
    textureId: 'bitmap__boss_l9',
  },
] as const;

export type ThemeEntry = (typeof THEMES)[number];

/** 本版实际投放的主题。长度 = {@link THEME_LEVEL_MAX}。 */
export const OPEN_THEMES: readonly ThemeEntry[] = THEMES.slice(0, THEME_LEVEL_MAX);
