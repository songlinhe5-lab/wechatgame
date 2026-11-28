/**
 * `[WXG-T-1119]` 性能归因开关（**仅调试**：`settings.debugInfo` 关时快照里恒为 0）。
 *
 * 用途：把「空」按绘制内容归因——真机上逐项关掉再看覆层读数，比任何估算都可靠。
 * 开关对应覆层展开态面板底部的一排 chip（`[WXG-T-1121]` 起分两行：内容 / HUD 细分）。
 *
 * ⛔ 这些位**不参与玩法/命中**，只让视图少画；关掉 `debugInfo` 即全部失效
 * （`BeadsGame._syncSnapshot` 写 0），release 路径零分支成本可忽略。
 */

/** 隐珠：盘面珠体（tint blit）不画，底 tile / HUD 照画。 */
export const DBG_HIDE_BEADS = 1 << 0;
/** 隐盘：底 tile + 盘面描边不画（珠体仍画 ⇒ 可判断「底 tile 是不是成本源」）。 */
export const DBG_HIDE_BOARD = 1 << 1;
/** 隐 HUD（**整组总开关**）：托盘 + 道具卡 + 顶栏 + 缩放条 + 扫光/连击特效全部不画。 */
export const DBG_HIDE_HUD = 1 << 2;
/** 限帧 30：走平台 `setPreferredFps(30)`（关掉回 60）——验证「稳定 30fps」这条腿。 */
export const DBG_CAP_30 = 1 << 3;

/**
 * `[WXG-T-1121]` HUD 三位细分（真机读数：HUD 整组 ≈ 16.4ms，需要知道落在哪块）。
 * 三者都**独立于** `DBG_HIDE_HUD`：总开关照旧一键全关，细分位各自关一块。
 */
/** 隐托盘：托盘面板 + 槽 + 托盘珠 + 「扩展」钮（面板 + 3 段内阴影 + 12 槽的叠层大户）。 */
export const DBG_HIDE_TRAY = 1 << 4;
/** 隐道具卡：底部三张道具卡（卡面 + 投影 + 图标 + 角标 + ×N）。 */
export const DBG_HIDE_CARDS = 1 << 5;
/** 隐顶栏：顶部时间胶囊 / LV 徽章 / 帮助钮（`drawHud`）。 */
export const DBG_HIDE_TOPBAR = 1 << 6;

/**
 * chip 序号 → 位（顺序 = 覆层面板上从左到右、自上而下）。
 * ⛔ 绘制与命中都读这张表，别在别处再写一遍顺序。
 */
export const DBG_CHIP_BITS = [
    DBG_HIDE_BEADS,
    DBG_HIDE_BOARD,
    DBG_HIDE_HUD,
    DBG_CAP_30,
    DBG_HIDE_TRAY,
    DBG_HIDE_CARDS,
    DBG_HIDE_TOPBAR,
] as const;

/** chip 文案（短到单行能放下）。 */
export const DBG_CHIP_LABELS = ['珠', '盘', 'HUD', '30', '托', '卡', '顶'] as const;

/**
 * `[WXG-T-1121]` chip 分行清单（每行枚数）：第一行 = 内容（珠/盘/HUD/30），
 * 第二行 = HUD 细分（托/卡/顶）。7 枚挤一行会让每枚只剩 ~35px、`HUD` 放不下。
 */
export const DBG_CHIP_ROWS = [4, 3] as const;
