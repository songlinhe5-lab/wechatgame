import { SELECT_LIFT_PX } from './motion.js';

/* **§1.1 珠体参数卡 `BEAD_CARD`（WXG-T-211-S3 / EP11-S3 真源上移）**
   ───────────────────────────────────────────────────────────────────────────
   **为什么上移**（判例 = v1.57 `TRAY_BEAD_SIZE` 上移，K-012 补漏同族）：四棱转正后风格层集
   （`view/bead-styles/facet-4.ts`，经 `registry` 消费）需要卡上的**比率制几何**
   （`radius` 0.30 / `holeRatio` 0.44），而 `bead-render.ts` 又要 `import` registry 出层集
   ⇒ 旧住法会造出 `bead-render ⇄ bead-styles` **循环依赖**（ESM 能跑但初始化顺序脆弱、
   打包期不可静态定序）。上移后 DAG 单向前进：
   `config/tuning` ← `view/palette` ← `view/bead-styles/*` ← `view/bead-render`。
   另层合 **C4**（呈现层系数只进本文件）；`bead-render.ts` 降为**再导出**（不拆既有消费者）。
   ⛔ 字段值与语义**逐字不变**（本批只搬家），因此十层 `legacy-ten` 对照臂与旧判据不受影响。 */

/**
 * §1.1 layer geometry, as fractions of the bead edge. Source values are the
 * spec's 64px example (`r = round(BEAD × 0.22)`, insets 1.5 / 1, widths 3 / 2,
 * highlight at 0.10 / 0.62 with size 0.80 × 0.26 and radius 0.13).
 */
export const BEAD_CARD = {
  /**
   * Corner radius as a fraction of the **drawn** bead edge.
   *
   * **0.22 → 0.30（`bead-visual-style-spec` K1，用户 2026-09-23 拍板）**。旧值在网格
   * 珠上还叠加了「同心倒推」（珠圆角 = 垫圆角 − inset），实际得到 `50×0.22−6 = 5`，
   * 在 38px 珠上近乎方角 ⇒ 用户直接判为“变成正方形”。新模型里底图是方角连续一张，
   * 同心约束已无对象 ⇒ 网格珠与托盘珠共用同一公式 `round(size × radius)`。
   * 实物熔合后是**圆角方**，不是正圆（参考图仍偏圆，以本值与真机为准）。
   */
  radius: 0.30,
  /** L0a 接触阴影（v1.3 · F4）：贴底窄条，x/y/w/h 为边长比例，radius = 主圆角 × 0.5。 */
  contactX: 0.06,
  contactY: -0.02,
  contactW: 0.88,
  contactH: 0.1,
  contactRadiusScale: 0.5,
  /** L0b shadow vertical offset (spec: `y − 3` in the 64 frame). */
  shadowDy: 3 / 64,
  /** L2 inset from the bottom/right inner edge (v1.3: 2/64, was 1.5). */
  bevelInsetDark: 2 / 64,
  /** L3 inset from the top/left inner edge (v1.3: 1.5/64, was 1). */
  bevelInsetLight: 1.5 / 64,
  /** L2 stroke width (v1.3: 5/64, was 3). */
  bevelWidthDark: 5 / 64,
  /** L3 stroke width (v1.3: 4/64, was 2). */
  bevelWidthLight: 4 / 64,
  /**
   * L3b rim 光（v1.3 新增）：上内缘单线，内缩 1/64。线宽 **2/64 → 3/64**（「06 珐琅·金属
   * 包边」加粗上缘高光边）。
   *
   * ⚠️ **旧括注的加粗理由是「错基注释」，WXG-T-207-A 核销（正本判定 = `assets-spec §1.10 ②`，
   * 林绘澄）**：原文写「2/64 在 50px 珠上被 `minStroke=2` 钳住 ⇒ 无变化，3/64 才真变粗」。
   * 该算式把分母当成 `BEAD_CELL`，**而实装分母是绘制边长** `(outer − 2×inset)`（见
   * `bead-render.ts` 十层体的 `size` 与 `stroke()`）⇒ 旧 50 基盘面上 `size = 50 − 2×6 = 38`，
   * `38×2/64 = 1.19` 与 `38×3/64 = 1.78` **双双钳到 2.00** —— 那次加粗在盘面对照上
   * **从来就是 no-op**（不是「换尺后才失效」）。唯一名义越线处是托盘珠（`size = 44`、
   * `inset = 0`）：`44×3/64 = 2.0625`，超地板 0.0625 设计 px ≈ 0.03 CSS px ⇒ 不可辨。
   * ⇒ 本句**不得再作为「比例线宽有效」的先例引用**（K-035 族「假绿登记」）。
   *
   * v1.57 换 30 基后现状（同一算式）：盘面 `size = 30 − 2×4 = 22` ⇒ `22×{5,4,3}/64 =
   * {1.72,1.38,1.03}` 全部 < 2 ⇒ **三档倒角 + rim 一起钳平为 2**（层集只剩方向/墨差/同心
   * 内缩序在承载，`assets-spec §1.10.3` 因此裁「比例不动、地板不动」）。**不在本单解**：
   * 分母 64→32 翻倍、或 `minStroke`→1 弃地板，两条出路均 `[待林绘澄/真机]`。
   *
   * ⚠ **WXG-T-211-S3 连带（§K.5 行 9）**：四棱基线**无 rim 线承载体** ⇒ 本字段与
   * `BEAD_RIM_MIX` / `bevelWidth*` 在默认皮肤下只剩 `legacy-ten` 对照臂消费；
   * `06` 出池门（K.6）必须继续引用它们，不得因「四棱用不到」删常量。
   */
  rimInset: 1 / 64,
  rimWidth: 3 / 64,
  /**
   * L4a/b/c 软高光三层（v1.3 · F4，取代硬边单高光条）：外扩递减、中心递增叠层模拟柔光。
   * x/y/w/h/radius 均为边长比例，α 见 `palette.ts::BEAD_SOFT_HIGHLIGHT_ALPHAS`。
   */
  softHighlight: Object.freeze([
    { x: 0.06, y: 0.52, w: 0.82, h: 0.38, radius: 0.19 },
    { x: 0.1, y: 0.6, w: 0.72, h: 0.26, radius: 0.13 },
    { x: 0.16, y: 0.68, w: 0.56, h: 0.14, radius: 0.07 },
  ] as const),
  /**
   * **L1c 中心孔（`bead-visual-style-spec` K2–K4）** —— 实物拼豆最强的识别特征，
   * 之前完全没做。
   *
   * **0.36 → 0.44（v1.57 / WXG-T-207-A；art 起始值正本 = `assets-spec §1.10.4`）**：
   * 0.44 是 Midi 实物真比（孔 ⌀2.2 / 豆 ⌀5），旧值 0.36 是「小屏怕吃掉色面」的**保守一档**；
   * 在 30px 珠上按实物真比反推，孔**半径** = `(30−2×4)×0.44/2 = 4.84` 设计px（旧尺
   * `(50−12)×0.36/2 = 6.84`）⇒ 绝对孔径仍缩 29%。**⚠ `[待真机]`**：真机 scale≈0.5 下直径
   * ≈4.8 CSS px，与当初判 `inset=2`「看不见」只差一档 ⇒ 禁止以「比例没变」判绿（K-035/K-040）。
   * ⚠️ **硬约束②（`assets-spec §1.10.9`）：本值与 `BEAD_DRAW_INSET` 互为对冲，必须同提交**
   * （削 inset ⇒ 珠面变大 ⇒ 孔绝对值变大）；分开改会留下混合口径、真机无法归因
   * ⇒ 由 `tests/bead-render.test.ts` 的同批性断言钉住。
   *
   * ✅ **WXG-T-211-S3 升为孔径唯一真源**：`facet-4` 孔半径 = `size × holeRatio / 2`
   * （= §7.11.6「落码以 0.44 为准」），旧 spike 口径 `0.17S` 常量 `FACET4_HOLE_RADIUS`
   * **随本批退役删除** ⇒ 底图卡与风格孔共用同一把尺（⛔ 风格内不得自孔径）。
   *
   * ⚠ **WXG-T-221（用户 2026-09-28 四裁 A 案 → 六裁语义更正 → 七裁定值）：现值 `0.44`，口径 = 「孔径 = 真透，派生值取整 dp」**。
   * 四裁曾改钉「孔外缘」（0.538）；用户 09-28 六裁更正语义：`BEAD_DRAW_INSET` 内缩出的珠面**含孔区**，
   * `holeRatio` 派生的**孔径 = 真透圆**（底色实际透出），孔边线墨环**外扩吃珠面**；
   * 同日七裁拍板「holeRatio 取 0.44，计算后取整 dp」⇒ 语义不变、值回 0.44（Midi 实物真比），
   * 接受恒等档 +4.9% 取整偏（旧精确值 0.4615 作废）。
   * 恒等档 `0.44 × 26 / 2 = 5.72 → round = 6` ⇒ **真透 ⌀12 / 外缘 ⌀14**（与六裁同值同形）；
   * 面积账与四裁外缘制**视觉逐 texel 等值**（本裁 = 定值，⛔ 非观感变更）；13/18/legacy 同源。
   * 取整对象 = 真透半径 ⇒ 真透恒偶（J4）；外缘 = 真透 + 2×1dp 同偶。`J7 成对锁`（inset = 2）随本行同批改。
   */
  holeRatio: 0.44,
  /** 孔内壁自阴影的偏移量（半径比例）与 α；光从左上 ⇒ 阴影偏左上，留出右下亮弧。 */
  holeShadeOffset: 0.22,
  holeShadeAlpha: 0.3,
  /**
   * **孔描边宽 = 1dp 绝对**（用户 2026-09-28 裁决，推翻 09-27 二裁的「粗环」）：与 plate
   * 外框同宽（`FACET4_EDGE_INSET_PX = 1` 设者语义），设计 px 直接落地 ⇒ ⛔ 不走比例系数、
   * 不吃 `minStroke` 地板（旧 `0.0769×size` 在静息 22px 珠面上本就被钳成 2dp，与裁决值 1dp 不符）。
   * 墨 = 端点族 `hole`（`mix(base, −0.58)`，见 `palette.BEAD_HOLE_STROKE_MIX`）。
   */
  holeStrokeWidthPx: 1,
  /**
   * **L2′ 侧壁高度**（K5）——实物是硬币状，有一条竖向侧壁；旧模型只靠同色压暗倒角，
   * 读作“斜切边”不读作“厚度”。`lift` 时按 `1 + lift/size` 拉长（§5 空间语言）。
   */
  wallRatio: 0.1,
  /** 侧壁与托盘珠孔底的下暗量（复用既有 mix 族，**零新 hex**）。 */
  wallDarkMix: -0.42,
  holeDarkMix: -0.5,
  /**
   * **§5 抬起三通道（`bead-visual-style-spec` v1.5-r9）** —— 以 `liftRef` 为“一次完整抬起”
   * 归一化，使高度语言随离开底面的距离连续变化（旧模型只平移，不透明物体凭空挪几 px
   * 就是“突兀”的来源）。
   *
   * ⚠ `liftRef` = **`tuning.SELECT_LIFT_PX`（单一真源 = 静息档一次完整抬起）**，与 view-model 给 `draft.lift` 的值同源；
   *   波浪的 `WAVE_LIFT_PX = 3` ⇒ liftT = 0.5（半高 ⇒ 半量的阴影响应）。
   *   抬起量改动时三通道响应强度自动跟着改，不会漂耦。
   *   ⚠ **本值 = 静息档分母，不是「任何档都拿它除」**（`bead-render` 于本批订正，旧注曾写反）：
   *   调用侧的 `lift` 已随档等比缩 ⇒ 消费方需把分母同乘 `outer / BEAD_CELL`，否则胀档下
   *   liftT > 1 ⇒ 放大通道超发、越过 C5 峰值前提，各档观感不同形。
   */
  liftRef: SELECT_LIFT_PX,
  /** 抬到 `liftRef` 时珠体额外放大 4%（与 G1 落座包络的 scale 相乘，峰值合计仍 < 1.12 ≪ 格宽）。 */
  liftScaleGain: 0.04,
  /** 投影偏移放大倍数（150%）与 α 衰减（40%）：离得越远，影子越大越淡。 */
  liftShadowDyGain: 1.5,
  liftShadowFade: 0.55,
  /**
   * **[T-244 十一批 · 2026-10-04 用户报「现在还是珠子与阴影有缝隙」] 分离影上沿的
   * 「咬合量」**（静息档 dp，消费侧乘 `size / BEAD_CELL` 等比）：影顶弧从「抬起后珠底」
   * 再**往珠体方向探 1dp**。
   *
   * 成因（本批单测探钉 + mask 实测）：影按**矢量臂**的珠半径 13.52（含 4% 放大）算珠底，
   * 而**生产走的 tint 臂**珠体 = 30dp 帧内的 mask 轮廓（R>127 实测半宽 **12.77dp**）
   * ⇒ 影顶比实渲珠底**低 0.75dp** ⇒ 两者之间恒有一条亮缝（与抬起量无关，所以十批把
   *   14 降到 9 后缝仍在）。`bead-render` 头注曾把此差读反（当成「影外凸进珠覆盖区」）。
   * ⇒ 咬合 1dp > 两臂最大轮廓差 0.75dp ⇒ **两臂都被珠盖住**（z 序：影在珠**之前**绘）。
   * ⛔ 不得小于 0.75（缝重现）；上限受「影不得上到孔缘」约束（孔径 ≈ 6dp ≪ 12.52dp）。
   */
  liftShadowBite: 1,
  /** 接触阴影收窄（35%）：离地后接触面应变小而不是留着黑块。
   * ⚠ **不衰减它的 α** —— §1.2 已把 L0a 定调为「固定 α 不受 lift 影响」（本批上一版
   *   试图连 α 一起淡掉，被 `§1.2 lift and shadow α` 判据拦下）。只改宽度，不改颜色语义。 */
  liftContactShrink: 0.35,
  /** 侧壁在满抬起时多长出 90%（与上面四通道共用 `liftT` ⇒ 方向一致）。 */
  wallLiftGain: 0.9,
  /**
   * **[WXG-T-236 四～五轮] 抬起投影（格面影 / 槽内影）均已删除** —— 四轮实测证明在
   * 「珠 26dp / 槽 24dp（mask `slotHalfDp 12`）/ 抬起 6dp」的几何下**没有可用的表现空间**：
   *
   * ① **格面影不可见**：tint 的 cell mask `shape` 全 255（完全不透明）、矢量槽 = 4 枚不透明同心
   *    rect ⇒ 两者都盖住同格其下所有图元（换序前后画面**逐字节相同**、两臂槽内像素**逐字节相同**）。
   * ② **槽内影撞色**：抬起后可见槽带仅 `[+7, +12]` = **5dp**（珠覆盖 `[-19,+7]`、槽跨 `[-12,+12]`），
   *    而该带内**已有**槽自身的底缘着色（受光亮线 lum 175.5 + 下斜面 lum 42.5）；影取
   *    `shadeOuter` 实测 lum **42.5** ⇒ **与下斜面同色同带** ⇒ 视觉上消失（差分实测影确实画了）。
   *
   * ⇒ 结论：**「抬起后看到槽」这件事的杠杆是抬高位移，不是影**。用户 2026-10-03 裁定
   * **甲（删影）+ 丁（提高抬起位移）** ⇒ 见 `SELECT_LIFT_PX` 的新值与理由。
   */
  /** §1.1 最小特征约束: no stroke below 2 design px. */
  minStroke: 2,
} as const;

/* §12.2 **C7 双门禁常量**（WXG-T-211-B1 / EP11-S2）—— 风格进池检查的真源。
   C7 原文：「新建**两个**门禁常量（命令上限 = 7 / 真 α 上限 = 2，一个常量装不下两个
   量）」；上限出自 §12.2 S8「全局上限 = 双指标：珠体命令 ≤ 7 且真 α 层 ≤ 2」。
   计数口径 = `assets-spec` 附 `styles.mjs::probe()`（珠体命令数，底图另计、凹槽另列）。
   按 **C4**：呈现层系数/门禁常量只进本文件，⛔ 不进 systems-index §3。
   基线四棱实测 = **6 命令 / 0 真 α**（§12.6）⇒ 门禁脚本 C11 第⑤项的差值基准。 */
/** 风格珠体图元命令数上限（C7①；超出即触门 ⇒ C11 五项诊断 + 停待确认态）。 */
export const BEAD_STYLE_MAX_COMMANDS = 7;
/** 风格**真 α** 层数上限（C7①；真 α 判据 = `alpha<1` 或 fill 为 `rgba(...)`，probe 同源）。 */
export const BEAD_STYLE_MAX_ALPHA_LAYERS = 2;

/* **复刻·四棱刻面（facet-4）风格系数组**（WXG-T-211-B1 / EP11-S2；C4：逐常量注归属）。
   来源 = `assets-spec §7.11.1` recipe / spike `styles.mjs::facetBead` 复刻，⛔ 非新造值。
   颜色仍走 palette.ts `mix()` 派生（C3 色源唯一），本组只落**系数**。

   ── **§7.12「五表外系数」清算结论（WXG-T-211-S3 / C4 收账）** ──
   | 系数 | 归属 | 本单处置 |
   |---|---|---|
   | `mix(base, −0.34)` | 四棱 #1 底 rect | ✅ **命名常量** `FACET4_PLATE_MIX`（本组） |
   | `mix(base, −0.16)` | 四棱 #4 右刻面 | ✅ **命名常量** `FACET4_FACET_RIGHT_MIX`（本组） |
   | `0.09S` 四角内缩 | 四棱 #2–#5 | ✅ **命名常量** `FACET4_FACET_INSET`（本组） |
   | 孔半径 | 四棱 #6 | ✅ **归位唯一真源** `BEAD_CARD.holeRatio`（§7.11.6「落码以 0.44 为准」；WXG-T-221 六裁真透制 + 七裁回定 0.44（派生值取整 dp），沿革见该常量注）
   |     ⇒ 旧 spike 口径常量 `FACET4_HOLE_RADIUS`（0.17）**本批退役删除**（不留无消费者常量） |
   | `mix(base, +0.34)` | 凹槽 spike 坑底亮 rect | ✅ **按端点表归位**：生产 `drawEmptySocket` 坑底 =
   |     `endpoints.pit`、亮线 = `SOCKET_LIT_MIX 0.38`（= 端点 `lit`）⇒ **无裸值、无需新常量**
   |     （§7.12 建议「改引 `lit`」已成立；spike 侧 +0.34 住在 `temp/` 不入库） |
   | `mix(base, +0.55)` | 凹槽 spike 下亮线 | ✅ 同上：生产实装 = `SOCKET_LIT_MIX 0.38`，**未采纳 0.55**；
   |     建议档 `BEAD_RIM_MIX 0.50` 属「06 珐琅」主题值 ⇒ **本单零涉及**（任务单已裁），登记待 06 归位 |
   | `alpha 0.22` | `18` 硬投影 | ✅ **已清算（WXG-T-211-S4 / 步 4）**：命名 `LINEART_SHADOW_ALPHA = 0.22`
   |     随本套层集同批入本文件（见下方 `18` 组），⛔ 未预落无消费者常量（旧注的 K-060 死码风险
   |     已由「消费者与常量同批」消除） |
   | `'#FFFFFF'`（spike `18` 孔） | `18` 孔 fill | ✅ **随本批零涉及而消解**：`18` 落码采 E 单 C 组必改 ①
   |     （孔底 = 目标色 `pit` 透色），孔 fill **不再需要白色 token** ⇒ 字面量与 `BEAD_HIGHLIGHT_HEX`
   |     引用一并消失（⛔ 不采纳 §7.11.7 D5 的 R2 造型改造、不预设未裁变更）。
   |     ⚠ 登记：正本行 5 与 Story 必改 ① 此处**不共容**（白孔 vs 透色孔），取值按必改 ① + QA 行 10
   |     「白孔判红」裁定；已回传主理人作**未决两读法**（见本单回传 §5） |

   ⇒ **机械锚**：`tests/bead-style-pool.test.ts` 的「C4 裸系数扫描 · 风格模块静态门」判据钉住风格模块内不得出现
   `mix(…, <字面量>)` 与孔径字面量（注入一枚裸系数即可判红）。
   ⚠ **本锚 = WXG-T-211-S3 本批补建**：上一批只在本处写了「机械锚」而**判据并不存在**（文档声称有门、
   实际无门 = K-060 同族）；补建后的两型真码变异自证（`mix(e.base, -0.16)` / `… / 2 * 0.16`）
   各判红一次，证据 `temp/wxg-t-211-s3/16-c4-mutation.txt`。已知限制：剔注释后扫描，
   ⛔ 不解析字符串字面量（诚实登记，不冒充完整 AST 门）。 */
export const FACET4_STYLE_ID = 'facet-4';
/**
 * 复刻·四棱 #1 底 rect 的 `mix(base, −0.44)`（暗底兼描边；§7.11.1 的 #1 `plate`）。
 * ⚠ 职能 = 底衬/描边 ⇒ **不进 C12 珠面族统计域**（contract.ts 层 role 标 `plate`）。
 *
 * **−0.34 → −0.44（WXG-T-214，2026-09-26 用户拍板）**：四棱 0 真 α ⇒ 珠的轮廓只能由
 * `plate` 环承载；而 `−0.34` 与 B0 目标底图（`endpoint.edge` = `−0.30`）**只差 4%**
 * ⇒ 实测对比度 CR 1.03–1.12（10 色），正确落位时珠的**下 / 右刻面**（墨同为 `edge`，
 * CR 1.00）连同底衬一起溶进底色，只有上/左两个刻面在承载轮廓。
 * 取 `−0.44` = `−(SOCKET_EDGE_DARK_MIX 0.30 + SOCKET_PIT_DARKEN 0.14)`，即**与「坑底」
 * 同档**（`endpoint.pit`）⇒ 环与底图恒差两档（CR ≈ 1.7–1.8），且复用既有 mix 族、零新 hex。
 * ⛔ 不用 `stroke` 实现（`KIND_POLICY['facet-4'].allowStroke = false`，见 `facet-4.ts` 注）。
 * ⚠ **属视觉变更**：`tests/bead-style-seal.test.ts` 腿 2（`facet-4` #1–#5 ≡ HEAD）需按
 * 封箱流程重封；本值 **`[待真机]`**（真机 ×0.5 下环宽 ≈1 CSS px）。
 */
export const FACET4_PLATE_MIX = -0.44;
/**
 * 复刻·四棱 #3 右刻面（§7.11.1 / §7.12 表外系数）。
 * **−0.16 → −0.22（WXG-T-229，2026-09-29 用户拍板「甲」）**：tint 合成式 `out = c·d + (1−c)·l`
 * 下 `l`（受光）对**亮色珠数学无效**（c→1 时贡献→0），而修复 D1 渗漏后上/左两扇 d 同为 1（饱和）
 * ⇒ 亮色珠左上象限一整块平光、光向丢失。甲案 = 四扇 **d 单调**（上 1 / 左 0.92 / 右 0.78 / 下 0.60）
 * ⇒ 右扇由 −0.16 加深到 −0.22。⛔ 属视觉变更 ⇒ `bead-style-seal` 腿 2 需按封箱流程重封（不自更新）。
 */
export const FACET4_FACET_RIGHT_MIX = -0.22;
/**
 * 复刻·四棱 #2 左刻面（**新增，WXG-T-229**）：旧值 = 端点 `base`（d=1，与 #3 上扇的 d 同为 1
 * ⇒ 亮色上上=左、无内部对比）。甲案取 `−0.08` ⇒ d=0.92，使四扇构成单调梯度（上>左>右>下）。
 */
export const FACET4_FACET_LEFT_MIX = -0.08;
/**
 * 复刻·四棱 #5 下刻面（**新增，WXG-T-229**）：旧值 = 端点 `edge`（`−0.30`，全局端点族）。
 * 甲案取 `−0.40` ⇒ d=0.60（加大暗端跨度）。⛔ **不动全局 `edge` 端点**（影响面覆盖槽底/B0 等），
 * 本常量只服务四棱下扇 ⇒ 下扇墨由 `endpoint.edge` 改为 `mix(base, 本值)`（语义脱钩，已登记）。
 */
export const FACET4_FACET_BOTTOM_MIX = -0.40;
/**
 * 复刻·四棱四角内缩比 `i2 = 0.09S`（§7.11.1；三角形顶点自格中心收缩量）。
 * ⚠ **WXG-T-211-S4**：`13` 双色对角的对角三角共用**同一个** `i2`（`assets-spec §7.11.6` 把
 * 两者列为同一行：「四棱／`13` 刻面内缩 `i2` = `0.09S`」）⇒ `dual-tone-13.ts` **复用本常量**，
 * ⛔ 不另立同值常量（K-042 真源单一）。
 * ⚠ 命名遗留（已回传，不在本批解）：名字里的 `FACET4` 前缀现在管着两套层集，属历史住址；
 *   改名会牵动风格模块与台账判据的引用面 ⇒ 归后续单独的符号清算批（⛔ 不顺手扩大改动面）。
 */
export const FACET4_FACET_INSET = 0.09;
/**
 * **圆角扇外缘内缩（设计 px，定值）**（`WXG-T-218` 2026-09-27 用户拍板：「多点 polygon
 * 逼近弧线，边缘描边 1dp」）：四向刻面扇形的外边界 = 珠体外轮廓（`plate` 圆角矩形）
 * **向内缩 1dp** ⇒ `plate` 暗底只在整圈轮廓露出 1dp 环 = 用户要的「边缘描边」；
 * 刻面在边中段与四角**全部铺满**（旧三角版的 `0.09S` 缓冲带与角部月牙空隙一并取消）。
 * ⚠ 设计 px 定值（非比例）：描边语义随 zoom 等比缩放（设计系），与 `minStroke` 地板族不同。
 */
export const FACET4_EDGE_INSET_PX = 1;
/** 圆角扇弧采样步长（度）：45° 圆角弧 / 15° = 3 段 ⇒ 每向扇形恒 8 顶点（定长 scratch）。 */
export const FACET4_ARC_STEP_DEG = 15;
/**
 * 刻面扇形**同色自描边宽**（设计 px；`stroke === fill`，契约约束 ①）：封相邻扇形共享
 * 对角射线的 AA 发丝缝（复刻 `hole-variant.mjs` 探针 `stroke-width 0.6` 同职责）。
 */
export const FACET4_SEAM_STROKE_PX = 0.75;

/* **`13` 双色对角 / `18` 线稿描边风格系数组**（WXG-T-211-S4 / EP11-S4 · §12.9 步 4；C4：逐常量注归属）。
   来源 = `assets-spec §7.11.2 / §7.11.3` 层集正本（逐字抄自 spike `styles.mjs:131-136 / :61-68`
   的**比例**，⛔ 非新造值）；颜色仍走 `palette.ts` 端点与 token（C3 色源唯一，本组只落**系数**）。

   两个关键取值已按正本与任务单已裁口径定死：
   - **孔径不立常量**：`13`/`18` 与四棱同源 = `BEAD_CARD.holeRatio` ⇒ 半径 `ratio/2·S`（现值 0.44，WXG-T-221 六裁真透制 + 七裁定值，派生后取整 dp）
     （E 单 C 组必改 ②；spike 的 `0.16S` / `0.15S` 偏小 27% / 32%，`§7.11.6`，⛔ 不照抄）；
   - **`18` 描边地板**：正本 `§7.11.3 / §7.11.6` 的 `LINEART_MIN_STROKE` 取 2 还是 3 已标
     `[待真机]` ⇒ 按任务单已裁：**暂接现码既有 `BEAD_CARD.minStroke` 值**（= 2），
     ⛔ **不自造第三值**；本常量即 PT-SKIN-02 的 **A/B 位**（要试 spike 字面 3 ⇒ 只改本行，
     不等式与判据不跟着改），A/B 结论前不得将本值写进 `systems-index §3`（任务单已裁：§3 零改动）。 */

/** `13` 双色对角的 styleId（= `registry` 池项与 `settings.beadStyle` 的合法值；步 5 才开始被玩家切）。 */
export const DUAL13_STYLE_ID = 'dual-tone-13';
/** `18` 线稿描边的 styleId（同上）。 */
export const LINEART18_STYLE_ID = 'lineart-18';
/**
 * `18` 描边地板（**PT-SKIN-02 A/B 位**）。❗ **本行不是新数值**：它 = `BEAD_CARD.minStroke`，
 * 存下的只是「本风格用哪一把地板」这个**选型**（§1.1 「no stroke below 2 design px」）。
 * spike 字面地板是绝对 `3`（`max(3, 0.06S)`）⇒ 2↔3 之争 `[待真机]`（§7.11.6）；
 * 现盘面尺 `S = 22` 下 `0.06S = 1.32`、本尺 `S = 30` 下 `1.8` ⇒ **两把地板均被钳平**，
 * 差异在真机上不体现为“可见粗细”而体现为“是否被钳”⇒ A/B 需含小尺珠面，⛔ 拿纸面比 2↔3。
 */
export const LINEART_MIN_STROKE: number = BEAD_CARD.minStroke;
/** `18` 比例线宽 `lw = 0.06S`（与地板取大，§7.11.3 行 2）。 */
export const LINEART_STROKE_RATIO = 0.06;
/** `18` 孔描边相对主体线宽的收缩（§7.11.3 行 5：`lw × 0.7`）。 */
export const LINEART_HOLE_STROKE_SCALE = 0.7;
/** `18` #1 硬投影的斜向偏移（§7.11.3 行 1：`dx = +0.09S`、`dy = −0.05S`，y 轴向上 ⇒ 右下）。 */
export const LINEART_SHADOW_DX = 0.09;
/** `18` #1 硬投影的竖向偏移量（同上；**取大后在绘制侧加负号**，本值只存量）。 */
export const LINEART_SHADOW_DY = 0.05;
/**
 * `18` #1 硬投影的 α = 0.22（§7.12 表外量清算表的最后一项；与既有
 * `BEAD_SHADOW_ALPHA 0.15` / `_SELECTED 0.25` / `CONTACT 0.12` / `holeShade 0.30` **均不同档**
 * ⇒ 不自建旧值、不“顺手归一”到 0.25：那会把正本的一档抹成另一档）。
 * ⚠ 本层计入**真 α**（C7 口径第一支 `alpha < 1`）⇒ `18` 在池内唯一带真 α 者的那 1 枚就是它。
 */
export const LINEART_SHADOW_ALPHA = 0.22;
/** `18` #3 上亮带宽（§7.11.3 行 3：`x∈[−0.31S,+0.31S]` ⇒ 本值 = 2×0.31，居中布层由本值/2 导出）。 */
export const LINEART_BAND_W = 0.62;
/** `18` #3 上亮带下缘 y（§7.11.3 行 3：`y∈[+0.17S,+0.37S]` 的下端）。 */
export const LINEART_BAND_Y = 0.17;
/** `18` #3 上亮带高（同上 `h = 0.20S`）。 */
export const LINEART_BAND_H = 0.2;

/* ── `handdrawn` 手绘有机轮廓（**MVP 原型**，2026-10-07 用户树形参考图定调；⛔ 未过 §12.6 入池评审）──
 * 造型身份 = 一颗**歪四角方豆**（四角整数偏移 + 每角切角 ⇒ 8 顶点硬轮廓，v2.2 用户
 * 二批回调「不规则四边形」；v2.1 密采样超椭圆读成齿轮已废）+ 深色轮廓线（stroke-only
 * 同形多边形）+ 手绘感内环 + 真透孔（4 命令 / 0 真 α）。
 * 歪斜是**静态形状**（整数偏移表，同 13 的「三角枚数」地位，C4 不扫整数）⇒ 纯函数确定性，
 * 不违 L4；⛔ 不得改成逐珠随机（像素封箱与可复现性会碎）。
 * 判据（v2.3 重账，S = 风格入参尺寸，比例均对 S/2；方形角点半宽 = |x|max，对角伸出
 * 不另计——邻格同形，A5 测试代理 `bead-size-tier` 同口径）：角点最大半宽
 * = FACE + 2×WOBBLE = 0.90；轮廓线外沿再 + OUTLINE_W = 0.95；满抬起 ×1.04
 * ⇒ 0.988 < 1 ⇒ **A5 零重叠**静息/抬起两态成立（托盘珠无 inset 是最紧腿；盘面珠另有
 * BEAD_DRAW_INSET 通道，恒更松；⚠ `minStroke` 地板在小尺寸抬宽另计入尾注，风格块旁）。
 * v2.3 = 歪斜量从 0.015（±0.7px 不可见，读成正八边）抬到 0.05 ⇒ 角点可见推拉。
 * C12：facet 域仅主体一枚且 fill ≡ `endpointOf().base` ⇒ 强读法过；轮廓线/内环
 * stroke-only = `plate` 职能排除出统计域（⛔ 轮廓不走主体自描边——契约约束① 只准
 * `stroke === fill`）。 */
/** `handdrawn` 的 styleId（注册序末位 = 设置钮循环末位；原型档，退出 = 从 registry 摘除）。 */
export const HANDDRAWN_STYLE_ID = 'handdrawn';
/** 豆体四角半宽比（S/2 的占比；v2.3 歪四角档 = 0.80，歪斜预算让给 WOBBLE，账见上）。 */
export const HANDDRAWN_FACE_RATIO = 0.8;
/** 手绘歪斜幅度（半径比；角点整数偏移 ±1 × 本值 ⇒ 每角可见推拉，见上账）。 */
export const HANDDRAWN_WOBBLE = 0.05;
/** 切角比例（每角沿相邻两边各取边长此比例的点 ⇒ 硬轮廓圆角感；形状族系数，0 = 尖角）。 */
export const HANDDRAWN_CHAMFER = 0.24;
/** 轮廓线宽比（stroke-only 同形多边形，墨 = `edge`；与地板 `BEAD_CARD.minStroke` 取大）。 */
export const HANDDRAWN_OUTLINE_W = 0.05;
/** 内环半径比（stroke-only 圆，墨 = `edge`，role = `plate` 排除出 C12 统计域）。 */
export const HANDDRAWN_RING_RATIO = 0.55;
/** 内环线宽比（与地板 `BEAD_CARD.minStroke` 取大，⛔ 风格内自算地板）。 */
export const HANDDRAWN_RING_W = 0.08;
/** `18` #3 上亮带圆角（§7.11.3 行 3：`r = 0.10S`）。 */
export const LINEART_BAND_RADIUS = 0.1;
/** `18` #4 下暗带宽（§7.11.3 行 4：`w = 0.72S`，且 `y∈[−0.36S,−0.20S]` 的下端 = 本值/2 ⇒ 居中导出）。 */
export const LINEART_EDGE_W = 0.72;
/** `18` #4 下暗带高（同上 `h = 0.16S`）。 */
export const LINEART_EDGE_H = 0.16;
/** `18` #4 下暗带圆角（§7.11.3 行 4：`r = 0.08S`）。 */
export const LINEART_EDGE_RADIUS = 0.08;


/* **换肤设置文案与豆径档枚举**（WXG-T-211-S5 / EP11-S5 · §12.9 步 5；S9 v1.7 §2.2 行4 +
   ux v1.19 §3.3 文案映射表）。两钮 = **选择器钮**（点按循环切档、非开关；钮面 = 标签 +
   当前值字面 + `▸`，选择即确认、写档一次、无「确认」钮）。
   ⛔ **文案禁写死款数**（S9 §2.2「珠子风格钮文案规则」条 / U16 = 甲；QA `TC-STY-11` 腿 B 的
   「共 N 款」grep 门常驻会抓）⇒ 下面的表**只是 styleId → 玩家侧名的映射，不构成池清单**：
   循环一律走 `registry.registeredStyles()` 的**运行时注册序**（S9 §8-14），表内缺项**不阻断**
   （`beadStyleLabel()` 回落 id 本身）⇒ 池扩容只改 registry 一处、本表与框都不动（§2.2 ④）。
   ⚠ 住址权衡（已回传）：「注册即可见」更纯的形态是把 label 做成 `BeadStyle` 契约字段，但那要给
   三套风格模块各加一字段并牵动 C11 池门禁的层集 schema；本批取本文件既有分工（三个 `*_STYLE_ID`
   常量本就住这里 ⇒ 同文件引用、零跨模块字面量），并由 `tests/bead-style-settings.test.ts`
   机检「每个已注册 id 必须有 label」钉住本表不落后于池。 */
/** styleId → 玩家侧标签（内部正名见各风格模块头注：`facet-4` = 复刻·四棱刻面）。 */
export const BEAD_STYLE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  [FACET4_STYLE_ID]: '经典四棱',
  [DUAL13_STYLE_ID]: '双色对角',
  [LINEART18_STYLE_ID]: '线稿描边',
});

/**
 * 钮面取标签：表内无项 ⇒ 回落 **id 本身**。
 * ⛔ 不得回落「默认档名」——那会把「未注册 / 未配文案」演成「已注册四棱」，正是 K-035 禁的假象。
 */
export function beadStyleLabel(styleId: string): string {
  return BEAD_STYLE_LABELS[styleId] ?? styleId;
}

/**
 * **豆径档枚举**（内部正名「满豆 / 小豆」= S9 §2.2 / §12 S5·S9；玩家侧文案「标准 / 小巧」）。
 * 存档字段 `settings.beadSize` 即存本枚举单值（S8 §8-11「字段名与结构终稿归代码」），
 * 逐字段降级见 `save-schema.ts::normalizeSettings`（⛔ 不进 §3 冻结：呈现层量，判例 = `debugInfo`）。
 */
export const BEAD_SIZE_FULL = 'full';
export const BEAD_SIZE_SMALL = 'small';
/** 豆径档联合类型（`BeadsSettings.beadSize` / `BeadsSnapshot.beadSize` / 循环算式共用）。 */
export type BeadSizeKind = typeof BEAD_SIZE_FULL | typeof BEAD_SIZE_SMALL;
/** 循环序 = 数组序（S9 §8-14「两档循环、到末档回第一档」；与风格池同一条「注册序即循环序」口径）。 */
export const BEAD_SIZE_ORDER: readonly BeadSizeKind[] = Object.freeze([
  BEAD_SIZE_FULL,
  BEAD_SIZE_SMALL,
]);
/** 默认档 = **满豆**（= 现状档；S8 §8-12 与 S9 §8-18 的降级目标与此同值，⛔ 两处各写一份）。 */
export const BEAD_SIZE_DEFAULT: BeadSizeKind = BEAD_SIZE_FULL;
/** 豆径档玩家侧标签（ux §3.3 文案映射表行4-2「标准 → 小巧 →（回第一）」）。 */
export const BEAD_SIZE_LABELS: Readonly<Record<BeadSizeKind, string>> = Object.freeze({
  [BEAD_SIZE_FULL]: '标准',
  [BEAD_SIZE_SMALL]: '小巧',
});
