/**
 * `[WXG-T-614]` 倒计时结束弹窗（Figma「倒计时结束弹窗」· 文件 `PBIK3RbfGlfzFsAnd97ZsP` ·
 * 页 `225:126` · 抠图层 `231:281`）的**几何与位图单源**。规格正本 = `design/ux/timeout-panel-spec.md`。
 *
 * 坐标口径：**牌内相对锚**（原点 = 木牌左上角，y 向下），⛔ 不存屏幕绝对坐标 ——
 * 木牌逐机垂直居中（`dialogShiftY()`，WXG-T-323 不变式），绝对锚会随屏高漂移。
 * 视图侧统一换算 `yUp = plate.y + plate.h − yDown(− h)`（本仓 y 向上、`box.y` = 下缘）。
 * ⛔ 绘制与热区不得各写一套数字：两侧都从这里取（`systems/fail-panel.ts` 唯一消费）。
 *
 * 稿面实读（2026-11-11 `node 231:281` 全量 JSON，帧原点 (1124,−532) 已扣除）：
 * - 对话框背景 `231:283` 矩形 581×1044 @(85,145)，但**图内木牌只占 alpha bbox**
 *   (16,211)–(565,797) ⇒ 可见木牌 **549×586** @(101,356)。投放件按 alpha 裁切（零透明边），
 *   故本表 `plate` 直接是 549×586，⛔ 不再继承那个 1044 高的空矩形。
 * - 标题 `231:284` 380×96 @(185,400) ⇒ 牌内中线 cyDown 92；
 * - 继续钮 `233:54` 426×154 @(163,533)、重试钮 `233:58` 417×137 @(168,715)
 *   ⇒ 两钮水平居中于牌（稿左余 62/67 vs 右余 61/65，差 ≤2px 属生成图容差）。
 *
 * ⚠ 稿面副标题写死「看广告能增加**60**秒时间」，与 §3.11 冻结值 `REVIVE_BONUS_SEC = 180`
 *   冲突 ⇒ 按 AGENTS §4「代码与 §3 冲突以 §3 为准」取 **180**，文案由
 *   `failPanelHint()` 从常量派生（漂移登记见规格正本 §5）。
 */
export const TIMEOUT_GEO = {
  /**
   * 木牌可见面（alpha 裁切后 549×586；投放件 @2x 1098×1172）。
   * `hRetryOnly` = 续时已用尽档：去掉主钮槽（154 + 净距 28）⇒ 586 − 182 = **404**，
   * 重试钮上移进主钮槽、牌底留白 90 不变 ⇒ 不出现「一大块空木面」。
   * 两档共用同一张位图，靠九宫格纵向压中段（{@link slice}）。
   */
  plate: { w: 549, h: 586, hRetryOnly: 404 },
  /** 板标题「时间到」（`231:284`，Chiron GoRound TC ExtraBold 64）：牌内中线。 */
  title: { cyDown: 92 },
  /**
   * 续时主钮（`233:54`，整枚烘图**只含左侧胶片 ▶ 图标**，文字运行时画）。
   * `textCx` = 文字槽中心相对钮左缘（稿 260.5，比钮心 213 右偏 47.5 ⇒ 让开图标）；
   * 主行 44 Bold / 副行 20 Bold（落地取 `UI_FONT.plateSub` 22，见规格 §4 字号裁定）。
   */
  continueBtn: { w: 426, h: 154, yDown: 177, textCx: 260.5, titleCyDown: 54.5, hintCyDown: 108 },
  /** 重试次钮（`233:58`，整枚烘图只含左侧循环箭头图标）：主行 42 Bold，单行。 */
  retryBtn: { w: 417, h: 137, yDown: 359, textCx: 254, titleCyDown: 67 },
  /** 仅重试档的说明行「本关已续时」：标题横带下缘 139 与钮上缘 177 之间的 38px 净空。 */
  subtitleCyDown: 158,
  /** `failHint`（广告失败等）落位：牌底留白带中线（距牌底 45 ⇒ 586 档 yDown 541）。 */
  hintCyFromBottom: 45,
  /**
   * 九宫格端帽（**源纹理像素 @2x**，`nineSliceFx` 口径）：
   * capY 300 = 150 设计 px ⇒ 上端帽盖住整条标题横带（牌内 44..140）、下端帽盖住底角铆钉；
   * capX 120 = 60 设计 px ⇒ 盖住左右角铆钉。中段纯木纹，纵向压缩不撕裂任何结构件。
   * 原高档（586）下两轴均为**恒等拉伸**（1172 − 600 = 572 = 586×2 − 300×2）。
   */
  slice: { capX: 120, capY: 300 },
  /** 程序化回退（位图未注册）时的圆角：木牌 28 / 按钮 24，与稿面圆角目测同档。 */
  radius: { plate: 28, button: 24 },
} as const;

/**
 * 倒计时弹窗位图 `textureId`（宿主注册表键；正本 = `design/art/final/assets/detail/ui_timeout_*@2x.png`）。
 * 与 `LEVEL_DETAIL_TEXTURES` 同口径：本表只存 id，⛔ 不存资产路径（bundle/path 属宿主）。
 * 任一枚未注册 ⇒ 该元素走**同几何**程序化回退（木牌 → 纸面板、按钮 → 纯色圆角钮）。
 */
export const TIMEOUT_TEXTURES = {
  plaque: 'bitmap__timeout_plaque',
  continueBtn: 'bitmap__timeout_continue',
  retryBtn: 'bitmap__timeout_retry',
} as const;