/**
 * 选关弹窗几何 / 位图单源（`[WXG-T-605]` 起；`[WXG-T-607]` 按 Figma「选关弹窗」page 重排；
 * `[WXG-T-610]` 补齐九宫格样式 / 关闭按钮 / 关卡名字控件）。
 *
 * 容器 **复用关卡详情对话框背景图**（木牌图，581×1044）。
 * `[WXG-T-1026/1027]` 用户令「替换成新的背景图，其他不变」：容器键 = `LEVEL_DETAIL_TEXTURES.dialogBg`
 * （`ui_dialog_bg_tall` 木牌图，不在 below 白名单 ⇒ 真机可见）；几何 581×1044 与版式零改动，
 * 母件同名同尺寸 ⇒ 无需拉伸。⛔ 不复用 `plaque`（白名单层真机被底页盖住）、不用橱窗图充当容器。
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
 *
 * `[WXG-T-611]` 六项修正：`176:22 grid-brand background` 65×35（编号牌背景，数字仍 VM 程序化——
 * 稿 `176:67 TEXT` 烘死「1」，九格复用会写死，⛔ 不切字）；`176:21 grid-image` 69×76
 * （格内图案槽：锁定 = 稿面锁图案位图，解锁 = 程序化珠拼，三星隐藏）；
 * 关卡名字按用户令改木牌中轴居中（稿面 278 左锚 K-053 留档）。
 *
 * `[WXG-T-612·二轮]` 稿面 2026-11-11T02:21Z 大更新（用户令「查找 grid-button/grid-star，
 * 看是否要重新导出资源，读取三态实现参数」）：`grid-button` 组件集三态 fill 素材**整体换新**
 * ——浅原木纹、无矩形边框、cornerRadius 14，Highlight 的描边与内阴影已被设计者删除
 * ⇒ 三态 = 同 imageRef `60229b73` + 纯滤镜差：Normal 无滤镜 / Highlight
 * `exposure+0.15, contrast+0.03, saturation+0.15, highlights+0.10` / Disabled
 * `exposure−0.10, contrast−0.015, saturation−1`。三态位图重导**直用**（⛔ 不再裁框，T-612 一轮
 * 的腐蚀裁框随旧素材一并退场，K-053）；星换 `214:98 grid-star` 新组件集（素材重导 64×60）+
 * gap 3；brand / lockImage / grid-image 几何逐字未变（imageLeft 44 / imageTopDown 49 / 65×35）。
 *
 * `[WXG-T-616]` 用户令「选关页 grid 里图案尺寸太小，尽量占合理空间的尺寸」⇒ 图案槽由稿面
 * 69×76 @(44, 距顶 49) 放大到 **126×94 @(16, 距顶 39)**（三带净距：距编号牌 4、距星带 5；
 * 横向左右各留 16 贴三态格底圆角边）；锁定图（原生 69×76）按高**等比**居中，⛔ 不横向拉伸。
 * 稿面 69×76 退为历史值（K-053 留档）。
 */
// `[WXG-T-1046]` `LEVEL_DETAIL_TEXTURES` 导入已退役：容器木牌不再借 below 白名单分流。
export const LEVEL_SELECT_GEO = {
    /** 板标题「选关」：与详情标题同槽（中心 380,278）。 */
    title: { cx: 380, cyDown: 278 },
    /**
     * `[WXG-T-610]` 关卡名字控件：yDown/h/ink 按稿 `159:10`（34 高、深蓝 SOLID）。
     * `[WXG-T-611]` 用户令「居中显示」⇒ x 轴 = 木牌中轴 {@link title}`.cx`（380），
     * 稿面 84 宽槽 @278 左锚退场（K-053 留档）。⚠ 文字内容由 VM 给（大关名逐页变），
     * ⛔ 不吃稿里的「曼陀罗」字样位图。
     */
    name: { yDown: 364, h: 34, ink: '#1A1D3F' },
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
        /**
         * `[WXG-T-610]` 三枚星位图 32×30，居中贴格底。
         * `[WXG-T-612·二轮]` 稿面 `214:98 grid-star` 新组件集（旧 `187:37` 已删）+ 九宫格重排
         * `188:*`：星实例交叉实测（grid-1 / grid-9）**pitch 35 ⇒ gap 3**（旧 9 为换稿前口径，K-053）；
         * 实例 32×30 口径不变（素材导出 64×60 @2x），bandY 28 不变。
         */
        starW: 32, starH: 30, starGap: 3,
        /**
         * `[WXG-T-611]` 编号牌背景（稿 `182:75 grid-brand` → `176:22`）：65×35 贴格**视觉顶**
         * （稿面 yDown 与格同 414 ⇒ 顶对齐）。数字仍 VM 程序化（稿 `176:67` 烘死「1」）。
         */
        brandW: 65, brandH: 35,
        /**
         * `[WXG-T-616]` 格内图案槽（稿 `176:21 grid-image` 69×76 的放大版，用户令「图案尺寸太小」）→
         * 126×94 @(16, 距顶 39)（历史值，K-053 留档）。
         * `[2026-11-20]` 曾放大到 142×118 @(8, 距顶 30)：槽底 33 比星带上沿 43 低 10、槽顶 151
         * 比编号牌下沿 146 高 5，当时用户明确允许覆盖。
         * `[2026-11-23 · WXG-T-1037]` 用户新令「珠面缩小一些，避免被上下遮盖」⇒ 回退为
         * **142×99 @(8, 距顶 37)**：槽底 = 181−37−99 = **45**（星带上沿 43 + 2px 净距），
         * 槽顶 = 181−37 = **144**（编号牌下沿 146 − 2px 净距）。水平居中不变，锁 / 占位 / 珠面
         * 同槽消费本组常量（⛔ 不再各自算框，debug 框也取同一组，见 `meta-widgets.ts`）。
         */
        imageW: 142, imageH: 99, imageLeft: 8, imageTopDown: 37,
        /** `[WXG-T-616]` 锁定图原生尺寸（稿 `176:21`，69×76）——只用于等比换算，⛔ 不直接铺槽。 */
        lockW: 69, lockH: 76,
        /**
         * `[2026-11-20]` 用户令「锁的位置靠下一点，因为下面没有三个星星」：锁格隐藏三星 ⇒ 整枚
         * 锁纹理相对图案槽再下移 `lockDrop`（y-up 减小）。锁按 `lockW/lockH` 等比铺满槽高，
         * ⛔ 不拉伸到槽宽；水平仍居中。
         */
        lockDrop: 10,
        /**
         * `[WXG-T-612·三轮]` 高亮环（稿 grid-4 实例 override `I188:67;218:69 highlight-ring`，
         * ⛔ 组件本体 `183:41` 渲染不带 ⇒ 烘不进导出图，只能数据驱动绘制）：
         * `#FFF0B0` 内描边 4px + 金色内发光（稿 INNER_SHADOW rgba(255,224,138) α0.70 r6，
         * 代码近似为宽半透明 stroke）。环框 = 格内对称缩 148×168、radius 13
         * （稿面手摆 y 偏 2.5 已取整对称，K-053）；仅位图腿当前关绘制、叠在缩略/星之下（稿层序）。
         */
        ring: { insetX: 5, insetY: 6.5, stroke: '#FFF0B0', strokeW: 4, glow: '#FFE08A', glowAlpha: 0.35, glowW: 10, radius: 13 },
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
    /** `[WXG-T-610]` 三态格底：橙 = 普通 / 亮金 = 当前推关 / 灰 = 未解锁。
     * `[WXG-T-1013]` 三件投放位图已出包（blit 腿被 BlitLayerUI 压 Graphics 问题删掉，
     * 程序化腿接管）；键保留为 `tests/level-select-view-model.test.ts` 的「断言不画」哨兵。 */
    cellNormal: 'bitmap__level_select_cell_normal',
    cellCurrent: 'bitmap__level_select_cell_current',
    cellLocked: 'bitmap__level_select_cell_locked',
    /** `[WXG-T-610]` 实心金 / 空心灰星（32×30）。 */
    starFilled: 'bitmap__level_select_star_filled',
    starEmpty: 'bitmap__level_select_star_empty',
    /** `[WXG-T-610]` 底部关闭按钮（301×105，整枚烘字）。 */
    closeBtn: 'bitmap__level_select_close',
    /** `[WXG-T-611]` 编号牌背景（稿 `176:22`，65×35）；数字仍程序化，缺图 ⇒ 程序化木牌回退。 */
    brand: 'bitmap__level_select_brand',
    /** `[WXG-T-611]` 锁定格图案（稿 `176:21 grid-image`，69×76）；缺图 ⇒ 灰珠阵降级腿。
     * `[WXG-T-1013]` 投放位图已出包，键保留为 `tests/arc-wall-locked.test.ts` 的「断言不画」哨兵。 */
    lockImage: 'bitmap__level_select_lock',
} as const;

/**
 * `[2026-11-20]` **不透明大背景位图 = 压到 Graphics 之下**白名单；`[2026-11-21]` 收窄为两件。
 *
 * Cocos 宿主里静态位图默认挂 `BlitLayerUI`（在 `Graphics` 之后）。木牌是整片不透明大图，
 * 若留在高层会盖住后发的程序化格底 rect 与 `drawBeadFace` 缩略图；编号牌 / 星 / 关闭钮
 * 是格内或前景小件，必须继续留在上层。名单只收「承着内容的整片底图」，⛔ 不泛化成 z-index。
 *
 * ⚠ `tray` **不入**本名单（K-115 方向翻转）：压到全局 `BlitAtlas` 时会被底页整屏不透明
 * `backdropFull`（挂在 `GameRoot/BlitLayerUI`）整片盖住 ⇒ 深棕背板零上屏
 * （实帧 `temp/ui-shot/cocos-617-levelselect-bgcheck.png`）。提到容器 `UI:levels` 的
 * `BlitLayerUI` 才可见；由此带来的「盖住当前关程序化红心」由 `level-select-view.ts`
 * 把九格改发 `beginSegment('hud')` 段层解决（段层整棵挂在 `Segments` 下，恒在父容器
 * `BlitLayerUI` 之上）。⛔ 不要靠给命令加层标记解决（K-109：删冲突对象，不扩协议）。
 */
export const BELOW_GRAPHICS_TEXTURE_IDS: ReadonlySet<string> = new Set<string>([
    // `[WXG-T-1046]` `plaque` **不入**本名单：详情 / 设置容器木牌压到全局 `BlitAtlas` 时被
    // 底页不透明 `backdropFull` 盖住（真机「关卡详情页缺背景板」根因，T-1025 同款）；
    // 与选关页 `dialogBg` 同走容器 `BlitLayerUI`（容器通道序 blit < graphics < labels < segments，
    // 缩略 / 星级仍压其上）。⛔ 两键指向同一张 `ui_dialog_bg_tall.png`，零新增资产。
    LEVEL_SELECT_TEXTURES.cell,
    // `[2026-11-21]` normal 格底**不入**本名单（K-115 方向翻转）：实帧证明压到 `BlitAtlas` 后会被
    // 整片不透明 tray 盖住，浅木格底完全不上屏。它是「格内容底」，须与锁纹理同挂 `BlitLayerUI`，
    // 由同层命令序保证 normal 先、锁后。⛔ 已解锁格有 `drawBeadFace` 珠面，不铺此不透明底
    // （见 `meta-widgets.ts` 的 `normalBg`；K-109：删掉引起冲突的对象，不扩层标记）。
]);
