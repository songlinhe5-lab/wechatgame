/**
 * 选关弹窗几何 / 位图单源（`[WXG-T-605]` 起；`[WXG-T-607]` 按 Figma「选关弹窗」page 重排；
 * `[WXG-T-610]` 补齐九宫格样式 / 关闭按钮 / 关卡名字控件）。
 *
 * 容器 **复用关卡详情对话框背景图**（`LEVEL_DETAIL_TEXTURES.plaque`，581×1044 木牌）。
 *
 * 稿面正本：Figma 文件 `PBIK3RbfGlfzFsAnd97ZsP` · page `159:3 选关弹窗` ·
 * `159:5 抠图层`。帧原点 `(-63,+22)` 已扣除，口径 = 帧内 750×1334、y 向下；
 * 视图侧换算 `yUp = DESIGN_H − yDown − h`。
 *
 * 实读：`164:63` 九宫格背板 506×597 @(122,401)；`176:19 grid-1` 158×181 @(138,414)、
 * 列 pitch 158、行 pitch 194。`185:36 grid-background`（木纹圆角底）158×177 是
 * **无数据内容的模板层**（`182:75` 编号牌 / 三星 / 锁 / 缩略均为数据驱动件，不进切图）。
 *
 * `[WXG-T-610]` 稿面补件：`160:48 关闭按钮` 301×105 @(225,1028)；
 * `159:10 关卡名字` TEXT 84×34 @(278,364)（SOLID `#1A1D3F`）；
 * 画布外备料 `183:38/41/44` 三态格底 + `187:39/41` 实心 / 空心星。
 */
export const LEVEL_SELECT_GEO = {
    /** 板标题「选关」：与详情标题同槽（中心 380,278）。 */
    title: { cx: 380, cyDown: 278 },
    /** `[WXG-T-610]` 关卡名字控件（稿 `159:10`）：84×34 @(278,364)，深蓝 SOLID。
     *  ⚠ 文字内容由 VM 给（大关名逐页变），⛔ 不吃稿里的「曼陀罗」字样位图。 */
    name: { x: 278, yDown: 364, w: 84, h: 34, ink: '#1A1D3F' },
    /** 章名（旧槽，保留为程序化回退档；现役以 {@link name} 为准）。 */
    chapter: { cx: 383, cyDown: 367 },
    /** 星进度「★ n/m」：右对齐，板右 −40（= 630），与章名同行。 */
    progress: { x: 630, cyDown: 367 },
    /**
     * 3×3 格墙（稿面绝对帧内坐标）：格 158×181，列 pitch 158（无缝）、行 pitch 194。
     * `topUp` = 首行**上沿**的 y-up 读数（1334 − 414）。绘制与命中同源（levelsLayout）。
     */
    grid: { left: 138, topUp: 920, cellW: 158, cellH: 181, pitchX: 158, pitchY: 194 },
    /** `[WXG-T-610]` 九宫格背板（稿 `164:63`）：506×597 @(122,401)，深棕木框。 */
    tray: { x: 122, yDown: 401, w: 506, h: 597 },
    /** `[WXG-T-610]` 关闭按钮（稿 `160:48`）：301×105 @(225,1028)，木质烘字。 */
    closeBtn: { x: 225, yDown: 1028, w: 301, h: 105 },
    /**
     * `[WXG-T-607]` 单格切图层：`185:36 grid-background` 木纹底 158×177（比格高 181 少 4，
     * 差值是顶部编号牌溢出格框的部分）。blit 按**底对齐**贴，⛔ 不拉伸到 181。
     */
    cellArt: {
        h: 177,
        /** 缩略框高 = `cellH − thumbFrameDrop`（稿 `grid-image` 落格中，⛔ 不与顶部编号牌叠）。 */
        thumbFrameDrop: 37,
        /**
         * `[WXG-T-610]` 三星中线距格底（y-up）：稿 `star-1/2/3` 32×30 @相对格 y_down 138
         * ⇒ y_up 13..43、中心 **28**（`T-607` 文字档 14 偏下，K-053 旧值留档）。
         */
        starBandY: 28,
        /** `[WXG-T-610]` 三枚星位图 32×30，净距 9，居中贴格底。 */
        starW: 32, starH: 30, starGap: 9,
    },
    /**
     * `[WXG-T-606]` 程序化托盘（**缺图降级腿**）：格 = 木框凹槽 + 米白内窗，
     * 托盘底板把九格收成一体。位图就绪时这些层不再画（避免双层木框）。
     */
    gridStyle: { radius: 12, frame: 4, groove: 2, trayPad: 10, trayRadius: 18 },
} as const;

/**
 * `[WXG-T-607 / 610]` 选关弹窗位图 `textureId`（正本 `design/art/final/assets/detail/`，@2x）。
 * 与 `LEVEL_DETAIL_TEXTURES` 同口径：本表只存 id，⛔ 不存资产路径（宿主注册表持有）。
 * 未注册 ⇒ 该元素走 `LEVEL_SELECT_GEO.gridStyle` 的程序化降级腿（同几何）。
 */
export const LEVEL_SELECT_TEXTURES = {
    /** `[WXG-T-607]` 单格木纹底（旧，保留为三态资源缺图时的通用降级腿，K-053 留档）。 */
    cell: 'bitmap__level_select_cell',
    /** `[WXG-T-610]` 九宫格背板。 */
    tray: 'bitmap__level_select_tray',
    /** `[WXG-T-610]` 三态格底：橙 = 普通 / 亮金 = 当前推关 / 灰 = 未解锁。 */
    cellNormal: 'bitmap__level_select_cell_normal',
    cellCurrent: 'bitmap__level_select_cell_current',
    cellLocked: 'bitmap__level_select_cell_locked',
    /** `[WXG-T-610]` 实心金 / 空心灰星（32×30）。 */
    starFilled: 'bitmap__level_select_star_filled',
    starEmpty: 'bitmap__level_select_star_empty',
    /** `[WXG-T-610]` 底部关闭按钮（301×105，整枚烘字）。 */
    closeBtn: 'bitmap__level_select_close',
} as const;
