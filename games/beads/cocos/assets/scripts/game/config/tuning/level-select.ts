/**
 * 选关弹窗几何单源（`[WXG-T-605]`）：**沿用关卡详情木牌**（581×1044 / 标题槽 / 右上 38² 凹槽 ✕），
 * 只把中间橱窗区换成 3×3 格墙。规格正本 = `design/ux/level-select-page-layout.md` v0.8。
 *
 * 坐标口径同 {@link LEVEL_DETAIL_GEO}：Figma 原生 y 向下；视图侧换算 `DESIGN_H − yDown − h`。
 * 木牌 / 标题 / 关闭钮 / 投影**直接复用** `level-detail.ts` 的常量（⛔ 本文件不复制第二份）。
 *
 * 橱窗内沿（烘焙木牌实测，581×1044 坐标系）：x∈[70,510] / y∈[240,668]；
 * 格墙 416² 居中后左右各留 ~12、上下各留 ~6。
 */
export const LEVEL_SELECT_GEO = {
    /** 板标题「选关」：与详情标题同槽（中心 380,278）。 */
    title: { cx: 380, cyDown: 278 },
    /** 章名：与详情副标题同槽（中心 383,367）。 */
    chapter: { cx: 383, cyDown: 367 },
    /** 星进度「★ n/m」：右对齐，板右 −40（= 630），与章名同行。 */
    progress: { x: 630, cyDown: 367 },
    /** 3×3 格墙：格 128 / 净距 16（合宽 416²）；左缘 171.5、上沿 y_up 922。 */
    grid: { left: 171.5, topUp: 922, cell: 128, gap: 16 },
    /**
     * `[WXG-T-606]` 九宫格木托盘（Token Plan 两 seed 定稿）：格 = 木框凹槽 + 米白内窗，
     * 托盘底板把九格收成一体。frame = 木框宽、groove = 框内深槽线、trayPad = 托盘外扩。
     */
    gridStyle: { radius: 12, frame: 4, groove: 2, trayPad: 10, trayRadius: 18 },
    /** 判星对照行：橱窗下带居中（中心 380,904）。 */
    criteria: { cx: 380, cyDown: 904 },
} as const;
