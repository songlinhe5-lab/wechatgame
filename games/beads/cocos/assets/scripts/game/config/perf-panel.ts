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
 * `[WXG-T-1119]` 归因 chip 几何（展开态面板**最下一行**的 4 个开关）。
 *
 * 放最下一行而不是最上一行：文字行自面板顶部向下排（`drawPerfOverlay` 的 `y -= 38`），
 * 面板底部恒留 `38 - 16 = 22` 的余量，chip 高 26 ⇒ 只有贴底这 34px 带子放得下。
 */
export const DBG_CHIP = { h: 26, gap: 6, padX: 16, radius: 8, lift: 4 } as const;

/** chip 宽度（= 面板内宽四等分，扣 3 个间距）。 */
export function dbgChipWidth(bits: number): number {
    return (PERF_PANEL.w - DBG_CHIP.padX * 2 - DBG_CHIP.gap * (bits - 1)) / bits;
}

/** 第 `i` 个 chip 的左缘 x（顺序与 `DBG_CHIP_BITS` 一致）。 */
export function dbgChipX(i: number, bits: number): number {
    return PERF_PANEL.x + DBG_CHIP.padX + i * (dbgChipWidth(bits) + DBG_CHIP.gap);
}

/** chip 行的下缘 y（贴面板底、抬 `lift`）。 */
export function dbgChipY(designH: number, segmented: boolean, probed: boolean): number {
    const rows = perfPanelRows(segmented, probed, true);
    return designH - (PERF_ROW_GAP * rows - 4) + DBG_CHIP.lift;
}

/**
 * `[WXG-T-1119]` chip 命中：返回序号，`-1` = 没点中（绘制与命中同源几何）。
 * tap 路径单次调用 ⇒ 允许循环，⛔ 不进逐帧热路径。
 */
export function dbgChipAt(
    x: number,
    y: number,
    designH: number,
    segmented: boolean,
    probed: boolean,
    bits: number,
): number {
    const cy = dbgChipY(designH, segmented, probed);
    if (y < cy || y > cy + DBG_CHIP.h) return -1;
    const w = dbgChipWidth(bits);
    for (let i = 0; i < bits; i++) {
        const cx = dbgChipX(i, bits);
        if (x >= cx && x <= cx + w) return i;
    }
    return -1;
}

/**
 * `[WXG-T-1116]` 面板行数唯一真源（绘制与命中同源）。展开 = 常规五行 + 按需追加行；
 * 收起 = 一行紧凑行（fps）。细分 / 探针行只在数据真的回投时出现。
 * `[WXG-T-1119]` 展开态底部再让一行给归因 chip（见 `DBG_CHIP`）。
 */
export function perfPanelRows(segmented: boolean, probed: boolean, expanded: boolean): number {
    return expanded ? 6 + (segmented ? 1 : 0) + (probed ? 1 : 0) : 1;
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
