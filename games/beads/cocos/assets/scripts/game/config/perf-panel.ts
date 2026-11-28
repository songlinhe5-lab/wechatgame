/**
 * `[WXG-T-1116]` 性能覆层面板几何唯一真源 —— 绘制（`view/debug-layer.ts`）与
 * 命中（`game/beads-game.ts` 的 `tapDebugPanel`）同源，⛔ 两处各算一套。
 *
 * ⚠ 落 `config/` 而非 `view/`：WXG-T-420 T9 架构门规定 `game/beads-game.ts` 的
 * 运行时闭包不加载 view（Node 玩法测试判据），命中判定必须在 view 之外可导入。
 */
import { DBG_CHIP_ROWS } from './debug-flags';

/** 面板横向几何（设计 px，贴屏顶左侧；`top = builder.height` 动态高）。 */
export const PERF_PANEL = { x: 12, w: 316, radius: 12 } as const;

/**
 * 行距（设计 px）。`⛔` 别改小——22px 字号下 38 是「两行不粘」的下限（黄金比 1.7）。
 */
export const PERF_ROW_GAP = 38;

/**
 * `[WXG-T-1119]` 归因 chip 几何（展开态面板**最底部**的开关排）。
 *
 * 放最底部而不是最顶部：文字行自面板顶部向下排（`drawPerfOverlay` 的 `y -= 38`），
 * 面板底部恒留 `38 - 16 = 22` 的余量，chip 高 26 ⇒ 只有贴底这条带子放得下。
 * `[WXG-T-1121]` 7 枚挤一行每枚只剩 ~35px（`HUD` 放不下）⇒ 分两行（`DBG_CHIP_ROWS`），
 * 每行各占一条 `PERF_ROW_GAP` 带子 ⇒ 面板再让一行。
 */
export const DBG_CHIP = { h: 26, gap: 6, rowGap: 6, padX: 16, radius: 8, lift: 4 } as const;

/** chip 占用几条行带（= 行数）。绘制与行数公式同源。 */
export function dbgChipRowCount(): number {
    return DBG_CHIP_ROWS.length;
}

/** 某一行的 chip 宽度（该行按自身枚数等分，扣掉行内间距）。 */
export function dbgChipWidth(rowBits: number): number {
    return (PERF_PANEL.w - DBG_CHIP.padX * 2 - DBG_CHIP.gap * (rowBits - 1)) / rowBits;
}

/** 第 `row` 行第 `i` 枚 chip 的左缘 x。 */
export function dbgChipX(rowBits: number, i: number): number {
    return PERF_PANEL.x + DBG_CHIP.padX + i * (dbgChipWidth(rowBits) + DBG_CHIP.gap);
}

/** chip 行（第 `row` 行）的下缘 y：贴面板底、抬 `lift`，逐行向上叠 `h + rowGap`。 */
export function dbgChipY(
    designH: number,
    segmented: boolean,
    probed: boolean,
    row: number,
): number {
    const rows = perfPanelRows(segmented, probed, true);
    const bottom = designH - (PERF_ROW_GAP * rows - 4);
    return bottom + DBG_CHIP.lift + row * (DBG_CHIP.h + DBG_CHIP.rowGap);
}

/**
 * `[WXG-T-1119/1121]` chip 命中：返回**全局序号**（= `DBG_CHIP_BITS` 下标），`-1` = 没点中。
 * 绘制与命中同源几何。tap 路径单次调用 ⇒ 允许两重循环，⛔ 不进逐帧热路径。
 */
export function dbgChipAt(
    x: number,
    y: number,
    designH: number,
    segmented: boolean,
    probed: boolean,
): number {
    let index = 0;
    for (let row = 0; row < DBG_CHIP_ROWS.length; row++) {
        const bits = DBG_CHIP_ROWS[row]!;
        const cy = dbgChipY(designH, segmented, probed, row);
        if (y >= cy && y <= cy + DBG_CHIP.h) {
            const w = dbgChipWidth(bits);
            for (let i = 0; i < bits; i++) {
                const cx = dbgChipX(bits, i);
                if (x >= cx && x <= cx + w) return index + i;
            }
        }
        index += bits;
    }
    return -1;
}

/**
 * `[WXG-T-1120]` 覆层数值的**降频投影**周期（帧）。
 *
 * 真机实测（2026-11-28 · 1.0.125 五档读数）：展开态 21.7ms / 46fps，收起态 16.0ms / 62fps
 * ⇒ 覆层自身吃 **5.7ms**。账单在文字通道：5 行读数每帧数字都在变（`toFixed(1)` 的 EMA），
 * 池化 label 的脏门全不命中 ⇒ 每帧 5 次 label 重排。把数字改成 250ms 一跳（60fps ≈ 15 帧）
 * 后同一字符串逐帧复用 ⇒ 脏门全命中，读数本身不再污染读数。
 */
export const PERF_UI_REFRESH_FRAMES = 15;

/**
 * `[WXG-T-1116]` 面板行数唯一真源（绘制与命中同源）。展开 = 常规五行 + 按需追加行；
 * 收起 = 一行紧凑行（fps）。细分 / 探针行只在数据真的回投时出现。
 * `[WXG-T-1119/1121]` 展开态底部让出 chip 行带（`dbgChipRowCount()` 条）。
 */
export function perfPanelRows(segmented: boolean, probed: boolean, expanded: boolean): number {
    return expanded ? 5 + dbgChipRowCount() + (segmented ? 1 : 0) + (probed ? 1 : 0) : 1;
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
