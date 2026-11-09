/**
 * `[WXG-T-604]` 关卡详情弹窗（Figma「关卡详情弹窗 v25b」· 文件 `PBIK3RbfGlfzFsAnd97ZsP` ·
 * 节点 `92:36`）的**几何与位图单源**。规格正本 = `design/ux/level-detail-spec.md`。
 *
 * 坐标口径：设计帧 750×1334，本表用 Figma 原生 **y 向下**锚点；视图侧统一换算
 * `yUpBottom = DESIGN_H − yDown − h`（本仓口径 y 向上、`box.y` = 下缘）。
 * ⛔ 绘制与热区不得各写一套数字：两侧都从这里取（`meta-layout.ts` / `meta-level-detail-page.ts`）。
 *
 * 稿面实读（2026-11-08 `node 92:36` 全量 JSON，帧原点 −63,+22 已扣除）：
 * - 木牌 581×1044 @ (89,166)：底缘距屏底 124 ⇒ **不是垂直居中**（居中为 145），按稿保留 21 px 上偏；
 * - 所有内容都落在牌内；「返回」是产品补钮（稿上只有「开始」），见 {@link LEVEL_DETAIL_GEO.back}。
 */
export const LEVEL_DETAIL_GEO = {
  /** 木牌面板（Figma `95:116`，整张烘图：木框 + 四角铆钉 + 空橱窗 + 底座）。 */
  plate: { x: 89, yDown: 166, w: 581, h: 1044 },
  /** 板标题「关卡详情」（`95:59`，380×96 @190,230 ⇒ 中心）。 */
  title: { cx: 380, cyDown: 278 },
  /** 副标题「大关名·第 N 关」（`95:104`，167×34 @300,350 ⇒ 中心）。 */
  subtitle: { cx: 383, cyDown: 367 },
  /** 橱窗内容框（`123:3`，295×285 @245,520）；运行时画关卡缩略，⛔ 不吃稿里的占位猫图。 */
  thumb: { x: 245, yDown: 520, w: 295, h: 285, area: 240 },
  /** 星级行（`147:36`，3×58×60 @279,858，净距 9）。 */
  stars: { x: 279, yDown: 858, size: 58, h: 60, gap: 9, count: 3 },
  /** 时限（`145:36`，80×17 @482,880 ⇒ 中心 888.5；稿 14px 低于可读地板，实现取 `UI_FONT.cell`）。
   *  左对齐锚 x=482：稿面字号只 14，22 档字宽会越过 80 槽，居中会压到第三枚星 ⇒ 用左缘锚。 */
  time: { x: 482, cyDown: 889 },
  /** 道具行（`148:36`，3×84 @240,912，净距 9；中轴 = 375）。 */
  items: { cx: 375, yDown: 912, size: 84, gap: 9 },
  /** 可用数角标（`137:37`，24×24 r8；贴每枚道具右上角，⛔ 不留内缩）。 */
  badge: { size: 24, radius: 8 },
  /** 「开始」钮（`119:36`，326×154 @212,1027；整枚烘字，⛔ 不再另画文字）。 */
  start: { x: 212, yDown: 1027, w: 326, h: 154 },
  /** 产品补钮「关闭」：木牌右上角**刻入木板的浅槽 ✕**（中心 600,198，臂长 12）。
   *  程序化两线（深槽 3px + 上缘受光 1px），零底板 / 零位图；热区取 `TOUCH_MIN 88`。
   *  ⚠ 中心避开牌角黄铜铆钉（约 640, 215），刻槽与铆钉留 ≥20px。
   *  另：点木牌外的空白也关闭（布局侧四条遮罩带，⛔ 不做全屏钮——会吞掉牌内空白点击）。 */
  close: { cx: 600, cyDown: 198, arm: 12 },
  /** 遮罩浓度沿用弹窗通用档（`UI_SCRIM.alpha`）——稿面背景是整屏场景图，无独立遮罩层。 */
} as const;

/**
 * 板标题「关卡详情」的文字投影（Figma `95:59.effects` 的 `DROP_SHADOW`，2026-11-09 回读）：
 * `#5A2F0D` α0.80 · offset(+9,+7) · blur 3 · y 向下（与 {@link LEVEL_DETAIL_GEO} 同口径）。
 * 落地 = `TextCommand.shadow` 最小契约（Canvas 原生阴影含 blur / Cocos 双 Label（blur 忽略）/
 * SVG 双 text）。⚠ 同节点另有两枚 `INNER_SHADOW`（高光 `#FFF4D6` α0.90 offset(0,+3) blur2 /
 * 暗边 `#8A4B1A` α0.70 offset(0,−2) blur2）仍未实现（文字命令只有单色填充）。
 * 完整效果表见 `design/ux/level-detail-spec.md §4.1`。
 */
export const LEVEL_DETAIL_TITLE_SHADOW = { dx: 9, dyDown: 7, blur: 3, alpha: 0.8 } as const;

/**
 * 关卡详情位图 `textureId`（宿主注册表键；正本 = `design/art/final/assets/detail/`，均 @2x）。
 * 与 `MENU_TEXTURES` 同口径：本表只存 id，⛔ 不存资产路径（bundle/path 属宿主）。
 * 任一枚未注册 ⇒ 该元素走**同几何**的程序化回退（木牌 → 纸面板、开始 → 通用钮、星 → 文字档）。
 */
export const LEVEL_DETAIL_TEXTURES = {
  plaque: 'bitmap__detail_plaque',
  start: 'bitmap__detail_start',
  starFilled: 'bitmap__detail_star_filled',
  starEmpty: 'bitmap__detail_star_empty',
} as const;
