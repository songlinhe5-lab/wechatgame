/**
 * `[WXG-T-1116]` 性能覆层面板几何唯一真源 —— 绘制（`view/debug-layer.ts`）与
 * 命中（`game/beads-game.ts` 的 `tapDebugPanel`）同源，⛔ 两处各算一套。
 *
 * ⚠ 落 `config/` 而非 `view/`：WXG-T-420 T9 架构门规定 `game/beads-game.ts` 的
 * 运行时闭包不加载 view（Node 玩法测试判据），命中判定必须在 view 之外可导入。
 */

/** 面板横向几何（设计 px，贴屏顶左侧；`top = builder.height` 动态高）。 */
export const PERF_PANEL = { x: 12, w: 316, radius: 12 } as const;

/**
 * 行距（设计 px）。`⛔` 别改小——22px 字号下 38 是「两行不粘」的下限（黄金比 1.7）。
 */
export const PERF_ROW_GAP = 38;

/**
 * `[WXG-T-1116]` 面板行数唯一真源（绘制与命中同源）。展开 = 常规五行 + 按需追加行；
 * 收起 = 一行紧凑行（fps）。细分 / 探针行只在数据真的回投时出现。
 */
export function perfPanelRows(segmented: boolean, probed: boolean, expanded: boolean): number {
    return expanded ? 5 + (segmented ? 1 : 0) + (probed ? 1 : 0) : 1;
}

/**
 * `[WXG-T-1116]` 面板命中判定（与绘制同源矩形；纯数学零分配，tap 路径直调）。
 * `designH` = 设计高（`liveDesignHeight()`）；面板贴屏顶、下缘恒 `designH - 12`，
 * 上缘随行数上移（`panelDy = -(38·rows - 4)` 同式）。
 */
export function perfPanelHit(
    x: number,
    y: number,
    designH: number,
    segmented: boolean,
    probed: boolean,
    expanded: boolean,
): boolean {
    const rows = perfPanelRows(segmented, probed, expanded);
    const top = designH - (PERF_ROW_GAP * rows - 4);
    return x >= PERF_PANEL.x && x <= PERF_PANEL.x + PERF_PANEL.w
        && y >= top && y <= top + (PERF_ROW_GAP * rows - 16);
}
