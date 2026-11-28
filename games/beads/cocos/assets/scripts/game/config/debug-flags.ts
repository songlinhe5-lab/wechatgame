/**
 * `[WXG-T-1119]` 性能归因开关（**仅调试**：`settings.debugInfo` 关时快照里恒为 0）。
 *
 * 用途：把「空 22.9ms」按绘制内容归因——真机上逐项关掉再看覆层读数，
 * 比任何估算都可靠。四个开关对应覆层展开态面板下方的一排 chip。
 *
 * ⛔ 这些位**不参与玩法/命中**，只让视图少画；关掉 `debugInfo` 即全部失效
 * （`BeadsGame._syncSnapshot` 写 0），release 路径零分支成本可忽略。
 */

/** 隐珠：盘面珠体（tint blit）不画，底 tile / HUD 照画。 */
export const DBG_HIDE_BEADS = 1 << 0;
/** 隐盘：底 tile + 盘面描边不画（珠体仍画 ⇒ 可判断「底 tile 是不是成本源」）。 */
export const DBG_HIDE_BOARD = 1 << 1;
/** 隐 HUD：顶部 HUD、缩放条、托盘面板、道具卡、扫光/连击特效全部不画。 */
export const DBG_HIDE_HUD = 1 << 2;
/** 限帧 30：走平台 `setPreferredFps(30)`（关掉回 60）——验证「稳定 30fps」这条腿。 */
export const DBG_CAP_30 = 1 << 3;

/**
 * chip 序号 → 位（顺序 = 覆层面板上从左到右：珠 / 盘 / HUD / 30）。
 * ⛔ 绘制与命中都读这张表，别在别处再写一遍顺序。
 */
export const DBG_CHIP_BITS = [DBG_HIDE_BEADS, DBG_HIDE_BOARD, DBG_HIDE_HUD, DBG_CAP_30] as const;

/** chip 文案（短到 74px 宽能放下）。 */
export const DBG_CHIP_LABELS = ['珠', '盘', 'HUD', '30'] as const;
