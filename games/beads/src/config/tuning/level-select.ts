/**
 * 选关弹窗几何 / 位图单源（`[WXG-T-605]` 起；`[WXG-T-607]` 按 Figma「选关弹窗」page 重排）。
 *
 * 容器 **复用关卡详情对话框背景图**（`LEVEL_DETAIL_TEXTURES.plaque`，581×1044 木牌），
 * 标题 / 关闭件同槽同件（⛔ 本文件不复制第二份）。
 *
 * 稿面正本：Figma 文件 `PBIK3RbfGlfzFsAnd97ZsP` · page `159:3 选关弹窗` ·
 * `159:5 抠图层` → `164:64 九宫格` → `176:19 grid-1`。帧原点 `(-63,+22)` 已扣除，
 * 口径 = 帧内 750×1334、y 向下；视图侧换算 `yUp = DESIGN_H − yDown − h`。
 *
 * 实读：`164:63` 九宫格背板 506×597 @(122,401)；`grid-1` 158×181 @(138,414)、
 * `grid-2` @(296,414)、`grid-4` @(138,608)、`grid-7` @(138,799) ⇒ 列 pitch 158、
 * 行 pitch 194。格内 `185:36 grid-background`（木纹圆角底）158×177 @(138,418) 是
 * **无数据内容的模板层**（`182:75` 编号牌 / 三星 / 锁 / 缩略均为数据驱动件，不进切图）。
 */
export const LEVEL_SELECT_GEO = {
    /** 板标题「选关」：与详情标题同槽（中心 380,278）。 */
    title: { cx: 380, cyDown: 278 },
    /** 章名：与详情副标题同槽（中心 383,367）。 */
    chapter: { cx: 383, cyDown: 367 },
    /** 星进度「★ n/m」：右对齐，板右 −40（= 630），与章名同行。 */
    progress: { x: 630, cyDown: 367 },
    /**
     * 3×3 格墙（稿面绝对帧内坐标）：格 158×181，列 pitch 158（无缝）、行 pitch 194。
     * `topUp` = 首行**上沿**的 y-up 读数（1334 − 414）。绘制与命中同源（levelsLayout）。
     */
    grid: { left: 138, topUp: 920, cellW: 158, cellH: 181, pitchX: 158, pitchY: 194 },
    /**
     * `[WXG-T-607]` 单格切图层：`185:36 grid-background` 木纹底 158×177（比格高 181 少 4，
     * 差值是顶部编号牌溢出格框的部分）。blit 按**底对齐**贴，⛔ 不拉伸到 181。
     */
    cellArt: {
        h: 177,
        /** 缩略框高 = `cellH − thumbFrameDrop`（稿 `grid-image` 落格中，⛔ 不与顶部编号牌叠）。 */
        thumbFrameDrop: 37,
        /** 星带中线距格底（y-up）；稿 `star-1/2/3` 在格底 ⇒ 与格顶编号牌分带。 */
        starBandY: 14,
    },
    /**
     * `[WXG-T-606]` 程序化托盘（**缺图降级腿**）：格 = 木框凹槽 + 米白内窗，
     * 托盘底板把九格收成一体。位图就绪时这些层不再画（避免双层木框）。
     */
    gridStyle: { radius: 12, frame: 4, groove: 2, trayPad: 10, trayRadius: 18 },
} as const;

/**
 * `[WXG-T-607]` 选关弹窗位图 `textureId`（正本 `design/art/final/assets/detail/`，@2x）。
 * 与 `LEVEL_DETAIL_TEXTURES` 同口径：本表只存 id，⛔ 不存资产路径（宿主注册表持有）。
 * 未注册 ⇒ 该元素走 `LEVEL_SELECT_GEO.gridStyle` 的程序化降级腿（同几何）。
 */
export const LEVEL_SELECT_TEXTURES = {
    cell: 'bitmap__level_select_cell',
} as const;
