/**
 * Beads tuning — every gameplay number lives here, none in the systems.
 *
 * ⚠️ AUTHORITY: every constant below is a mirror of
 * `design/gdd/systems-index.md §3` (the frozen single source of truth; sprint
 * constants C1–C8 frozen in §3.10, WXG-T-020). If a value here disagrees with
 * §3, **§3 wins** and this file is the bug. Do not invent values here; add them
 * to §3 first.
 *
 * Units are *design-space* units (see the framework `Viewport`). The design
 * resolution is 750 × 1334 (portrait). Design-space origin is the
 * **bottom-left**, y grows upward.
 */

// ──────────────────────────────────────── §3.1 canvas, safe area & layout bands
/** Design resolution width (px). */
export const DESIGN_W = 750;
/** Design resolution height (px), portrait. */
export const DESIGN_H = 1334;
/** Top safe-area height: y ∈ [1214, 1334]. */
export const SAFE_TOP_H = 120;
/** HUD band: settings gear left, timer capsule centre, capsule-avoid right. */
export const HUD_BAND = { yMin: 1214, yMax: 1334 } as const;
/** WeChat capsule avoidance zone (top-right). */
export const CAPSULE_AVOID = { xMin: 560, xMax: 750, yMin: 1214, yMax: 1334 } as const;
/** Puzzle band — the pattern matrix is centred inside it (both axes).
 *
 * ⚠ **§3.1 换尺（本轮用户拍板）：下沿 480 → 560**（带高 640 → 560）。动的理由只有一个：
 * 底部要给缩放控件条让出 **合规 88 热区**（§3.8 C1 / `TOUCH_MIN`）且**不与任何可点元素抢**。
 * 旧布局下「盘面下沿 480 → 托盘槽热区顶 444」只有 36px（含放大态热区下探则 ≤ 23px），
 * 88 无论如何放不下 ⇒ 只能从盘带让高。
 * ⚙ **取值 560 而不是 568 的理由（用户选定）**：可用区间为 `yMin ∈ [552, 562]`（下界 =
 * 控件条底沿不得碰托盘槽热区 444，上界 = `r_max` 须仍 ≥ 16 行）⇒ 取中值 560 同时保住
 * **顶格档 16 行**与热区，代价是控件条底与槽热区只剩 **8px** 富余（旧取 568 为 16px）⇒ `[待真机]`。
 * **连带（实测，非推定）**：`r_max` 18 → **16**；关卡池 6 尺寸（12×16 / 8×15 / 14×14 /
 * 10×14 / 14×13 / 14×12）**全部仍 fit=1**（最大盘 12×16：`natH=510 ≤ 560−48=512`）⇒ **零缩放代价**。
 * ⚙ 真源回写 = `design/gdd/systems-index.md §3.1/§3.3` + 变更单（与代码同批，非事后补票）。
 */
export const PUZZLE_BAND = { yMin: 560, yMax: 1120 } as const;
/** Tray band (white rounded panel). §3.1 v1.25：下沿 230→216 —— v1.24 冻结的
 * 4 行扩展态（panelH 234）必须完整落带（推导见 design/proposals/tray-24-layout-derivation.md）；
 * 基础态 2 行（panelH 120，y∈[330,450]）与 `btn_expand` 净空 12px 不受影响。 */
export const TRAY_BAND = { yMin: 216, yMax: 450 } as const;
/** Powerup band (3 white cards — S6 landed in WXG-T-060). */
// ─────────────────── v1.5 质感渲染（assets-spec §1.9 / §1.2 v1.5，WXG-T-131/143）──
// 以下均为**实现派生值**（美术规格数值级落码），非 §3 gameplay 冻结常量。

/** L11 目标色垫 · 珠视觉内缩（v1.5-r5「垫色显缝」，WXG-T-142）：垫 = 全格，珠四边各缩。
 * WXG-T-162 真机 playtest 裁定「乙档」：2→6（旧值在真机 scale 0.5 下仅 ≈1 CSS px 看不见）。
 * **v1.57（WXG-T-207-A，§3.3 渲染基尺 5mm→32/dip 基）6 → 4**：按 k = 新/旧 `BEAD_CELL` = 30/50 = 0.6
 * 机械缩放的**起始值**，art 起始表正本 = `art/assets-spec.md §1.10.2`（其理由不是机械缩放，
 * 而是「目标色读数已有 B0 满铺底图 + L1c 孔底透色两条并行通道 ⇒ 环带从唯一载体降为帮载体」）。
 * ⚠️ **`[待真机]`，本值未验收**；回退序 4 → 5 → 3（assets-spec §1.10.2 三档对比表）。
 *
 * **4 → 2（WXG-T-214，用户 2026-09-26 拍板「中空的豆子要满豆效果，豆子基本覆盖格子」）**：
 * 4px 环带下珠面只占格径 22/30 = 73%，读作「格子里摆了个小扣子」而非实拼豆；取 2 ⇒
 * 珠面 **26/30 = 87%**（屏上 ×0.5 只剩 1 CSS px 环）⇒ 目标色读数由「孔底透色」主担
 * （`BEAD_CARD.holeRatio` 不变 ⇒ 孔随珠面等比放大到 r 5.72，读数反而更强），
 * 环带退为帮载体（与 §1.10.2「环带降为帮载体」同一方向，只是把它压到极限一档）。
 * ⚠️ **硬约束②对冲已按同批处理**：削 inset ⇒ 孔绝对值变大 18% ⇒ 本批**刻意不动**
 * `BEAD_CARD.holeRatio 0.44`（Midi 实物真比）⇒ 变化可归因到单一变量（inset）。
 * 下一档（1 ⇒ 珠 28/30 = 93%，环仅 1 设计 px）留作真机 A/B，⛔ 未拍板不擅自再削。
 * ⚠️ 硬约束②（assets-spec §1.10.9 末）：**本值与 `BEAD_CARD.holeRatio` 必须同提交**
 * （两者互为对冲：削 inset ⇒ 珠面变大 ⇒ 孔绝对值变大；升 ratio 同理。分开改会留下
 * 「尺子按实物、孔按保守一档」的混合口径，真机无法归因）⇒ 由 `tests/bead-render.test.ts`
 * 的同批性断言钉住。
 * ⚠️ **本值是比例基准、不是绝对量**：静息档（`zoom = 1`，格径 = `BEAD_CELL`）每边缩 4px，
 * 实际内缩 = `本值 × 格径 / BEAD_CELL`。原「绝对不随 zoom 缩」是 ADR-0015 §3.3-5 C-5 的 art
 * 判定（当时 8 关全 `fit = 1`，未暴露）；WXG-T-169 棋盘相机上线后，底图 tile（`snap.gridPitch`）
 * 全程比例制 ⇒ 绝对 inset 让珠/背景比例从 69% 漂到 56%（用户真机反馈）⇒ 已改等比，C-5 裁定更替。
 * ⚠️ 仅作用于**传 `targetColorIdx` 的盘面珠**；托盘珠恒 0（见 `bead-render.ts` 的 inset 分支）。 */
export const BEAD_DRAW_INSET = 2;

/**
 * **小豆档**单边内缩基准（WXG-T-211-S5 / EP11-S5 · S9 v1.7 §2.2 行4 右格「豆子尺寸」）。
 * ⚠️ **[暂定·待 PT-SKIN-05 真机 A/B]**：GDD 明文「档间 inset 系数住 `tuning.ts`、本文不钉值
 * `[待真机 A/B]`」（§12 C5 / §12.8-⑨），spike `temp/beads-facet/styles.mjs` **无小豆档样例**
 * ⇒ 本值 = 任务单授权的「初值自定最小合理档」，⛔ 不得读成已裁。
 *
 * 取值依据（三条，全部走既有通道，⛔ 不另立尺寸真源 = ADR-0023 DEC-7）：
 *  1. **同一条比例通道**：小豆档不引入第二把尺子，只把 `BEAD_DRAW_INSET` 的基准从 4 换成
 *     本值 ⇒ 实际内缩仍 = `本值 × 格径 / BEAD_CELL`（WXG-T-169 等比制），zoom / LOD 零改动；
 *  2. **「最小合理档」= 2 倍满豆内缩**：静息档珠面 `30 − 2×4 = 22` → `30 − 2×8 = 14`，
 *     珠/格径 73.3% → 46.7%（缝宽 8 → 16）；再大一档（10 ⇒ 珠 10px）已低于 `FACE_MIN 12`，
 *     而 `FACE_MIN` 在现口径下**永不触发**（见其注）⇒ 14 是「不新造护栏、不触地板」的最大内缩档；
 *  3. **只缩不胀** ⇒ `assets-spec` A5「珠不重叠」在缩珠方向平凡成立（无越界新证明义务）。
 *
 * ⚠️ 作用域 = **仅网格珠珠体（含已填态）**；托盘珠恒满幅不随档（S9 §2.2 / ux §3.3 ④）
 *     ⇒ 本值只由 `view-model::drawGrid` 传入，托盘侧不传（`bead-render` 的 inset 分支同门）。
 * ⚠️ **命中判据零变**：`BEAD_HIT_PAD` 名义外扩与珠体**视觉**尺寸无关（ux §3.3「触控不随档降级」）
 *     ⇒ 本值不进任何命中/判定路径，由 `tests/bead-style-settings.test.ts` 钉「改档零命中面变更」。
 *
 * **8 → 3（WXG-T-214，用户 2026-09-26 拍板）**：旧值 8 是「2 倍满豆内缩」时代的产物
 * （`BEAD_DRAW_INSET` 当时 = 4）；满豆改 2 后该规则已失效，8 只剩一个孤立绝对值 ⇒
 * 珠面 14（占格径 43.8%）、珠色面积仅 196（19%）⇒ 豆子小到读不出色。
 * 新值取 **格内面积账**的反解：无孔档**没有孔**，目标色只能靠**环**读 ⇒ 环必须更宽
 * （`inset 3 ⇒ 环 4 设计 px = 2.0 CSS px`）⇒ 珠面 **24**，与有孔档（珠面 26 / 孔 ⌀12）
 * 一样把「珠色 : 底色」落在 **≈56 : 44**（576 : 448）。 */
export const BEAD_DRAW_INSET_SMALL = 3;

/**
 * 珠面可画边长地板（设计 px）—— **预留、本单未启用**（assets-spec §1.10.2 C-5 护栏建议）。
 *
 * 拟用公式（**尚未接入 `bead-render.ts`**）：
 * `inset_eff = min(BEAD_DRAW_INSET, max(0, (BEAD_CELL × zoom − FACE_MIN) / 2))`
 * —— 防未来大盘走 fit<1 档时把珠面削到 0（现 8 关全 `fit = 1` ⇒ 落与不落**零行为差异**，
 * assets-spec §1.10.2 已算；`inset = 6` 时的硬奇异点 `zoom ≤ 0.4` 当前不可达）。
 *
 * 状态：仅登记常量与语义，**仍不启用**——`BEAD_DRAW_INSET` 改随格径等比后，珠面恒 =
 * `0.733 × 格径`，数学上永不为 0 ⇒ 本护栏在现口径下**永不触发**（原解除条件「fit<0.9 的盘」
 * 已由等比制直接解掉）。**不进 §3 冻结**（art-owned）。启用前不得在任何渲染路径引用本值。 */
export const FACE_MIN = 12;

/** 空格凹陷坑四层（§1.2 v1.5）：几何以内缩比例表达，墨色端点在 palette 预烘焙表。 */
export const SOCKET_CARD = Object.freeze({
  /** S1 暗缘框线宽（坑边比例，min 2px 地板在渲染层）。 */
  edgeWidth: 3 / 64,
  /** S2 坑底四边内缩（坑边比例 = 6%）。 */
  pitInset: 0.06,
  /** S3 上内缘内阴影线宽。 */
  shadeWidth: 2.5 / 64,
  /** S4 下内缘受光亮线宽。 */
  litWidth: 2.5 / 64,
  /**
   * **坑外廓相对「珠体绘制边长」再退的一圈**（格径比例；`WXG-T-214` 用户裁定
   * 「豆坑永远比豆子小一圈，有豆时看不到豆坑」）。
   * 坑外廓 = `珠体绘制边长 − 2 × max(minStroke, 格径 × 本值)`；恒等档实测
   * 珠 22 → 坑 **17.8**（旧值 26.4，比珠还大 ⇒ 有豆/无豆不是一张图）。
   * ⚠ 随格径等比 ⇒ zoom / 豆径档自动跟随；`minStroke` 地板沿用既有口径。
   */
  relief: 0.07,
} as const);

/** 托盘面板「微拱白瓷」三段内阴影（§1.3 v1.5：底缘两段 + 右缘一段）。 */
export const TRAY_PLATE = Object.freeze({
  ink: '#1E2033',
  /** 底缘外段（α 0.03）。 */
  bottomOuterAlpha: 0.03,
  /** 底缘内段（α 0.05）。 */
  bottomInnerAlpha: 0.05,
  /** 右缘段（α 0.02）。 */
  rightAlpha: 0.02,
  /** 各段线宽（px）。 */
  width: 3,
} as const);

export const POWERUP_BAND = { yMin: 48, yMax: 200 } as const;
/**
 * 道具卡几何。**不是 §3 冻结常量**（冻结的是带位 `POWERUP_BAND`），但渲染与 S2 命中
 * 测试必须**共用同一份** —— 各写一份就会出现「画出来的卡」与「点击落点」不一致的静默
 * 漂移（`gridLayoutFor` 判例）。
 *
 * ⚠️ 与 `assets-spec §1.4` 的关系（WXG-T-062 主理人裁定 = 方案 A「改卡高、不动带位」）：
 *  §1.4 原写「卡 **176×150** + **卡下方**标签 28px」，而 §3.1 的 `POWERUP_BAND` 只有
 *  **152** 高 —— 150 + 4 + 28 = 182 > 152，两条冻结规格**无法同时成立**。裁定取
 *  「卡 **176×116**（宽仍用 §1.4 的 176，高按带位反推）+ 间隔 4 + 标签 28 = 148 ≤ 152」，
 *  这样 §3.1 与底部留白 48 一字不动、A4 的「文字标签并列」得以落地。§1.4 已同步改数并注明。
 *
 * `POWERUP_CARD_H` ≥ `TOUCH_MIN`，且 §1.4 规定「整卡即热区」⇒ 卡自身就是命中区。
 */
export const POWERUP_CARD_W = 176;
export const POWERUP_CARD_H = 116;
/**
 * 三卡间距（**WXG-T-062 主理人观感复核后 30 → 60**）：三卡总宽 = 176×3 + 60×2 = 648，
 * 两侧余量 51（比网格最紧的 38 更宽松）。间距区**无命中**（`input-control §6`
 * 「触摸点落在布局带间隙：无命中，静默忽略」）⇒ 放大间距只产生中性死区，不改变可选性。
 */
export const POWERUP_CARD_GAP = 60;
export const POWERUP_CARD_RADIUS = 20; // §1.4「圆角 20」
/** §1.4「卡下方标签 28px」（亦满足 §3.8 文字最小 28）。 */
export const POWERUP_LABEL_H = 28;
/** 卡与标签的竖向间隔：§1.4 未规定，本项派生（取 4 使整块 148 ≤ 带高 152）。 */
export const POWERUP_LABEL_GAP = 4;
/** §1.4 视频角标 `ad_badge`：28×28 圆角 8，贴卡右上角内缩 (8,8)，白色 ▶ 边 10。 */
export const POWERUP_BADGE_SIZE = 28;
export const POWERUP_BADGE_RADIUS = 8;
export const POWERUP_BADGE_INSET = 8;
export const POWERUP_BADGE_GLYPH_EDGE = 10;

// ──────────────────────────────────────────────── §3.2 palette & bead charset
/** Pattern row charset: `.`=空位 `x`=锁定格 `1-9`+`A-Z`=色板索引 1–35（**只收大写**：
 *  `x`=锁定符 vs `X`=索引 **33**（`Y`=34、`Z`=35）⇒ 解码必须大小写敏感）。§3.2 v1.55（提案 v1.54）。
 *  ⚠️ 本串是 **regex-style 区间记法**，`BEAD_CHARSET.includes(ch)` 是错的 ⇒ 展开表
 *  与唯一解码实现见 `config/bead-charset.ts`（判据 X1）。 */
export const BEAD_CHARSET = '.x1-9A-Z';
/** Per-level colour-count ceiling. §3.2 v1.55（提案登记 v1.54；用户 2026-09-24 改判
 *  「放开 10 色上限」⇒ **推翻 v1.36 的 ≤10**）：35 = 当前 rowstring（每格一字符，
 *  ADR-0004）形态的**编码天花板** `1-9`+`A-Z` ⇒ 在本形态下即「不限制」；>35 需换编码
 *  格式 = 另案（正本 §8）。语义收窄为「单关 `pattern` **实际用色数**」，**不约束候选
 *  色板规模**（`PALETTES[slug].codes` 上百条不受本值限制，v1.40 品牌引用制）。
 *  ⚠️ 抬到 35 后本常量不再顺带挡住「索引 >10 却未携 `palette`+`paletteCodes`」⇒ 该
 *  组合会让 `view/palette.ts` 静默兑炭黑，改由 `levels.ts` B1 硬校兜住（正本 §2.6-ⓐ）。 */
export const BEAD_COLOR_MAX = 35;
/** Per-level decoy-count ceiling. §3.2 v1.17 (U8=D, WXG-T-086): 2→0 — no decoys
 * are supplied; the spawner's A′ invariant (`held ≤ demand`) removes the tail
 * soft-lock at the source, so the decoy subsystem is inert (kept for the schema). */
export const DECOY_COLORS_MAX = 0;
/**
 * ⛔ v1.22 作废（WXG-T-130 案 A 供料关停 / WXG-T-136 代码摘除）：抽色权重随供料
 * 消失而失去消费方（`Spawner` 类整体转为死路径）。死值保留（systems-index §3.2
 * 同款口径：供料复活零成本；删除需先清 `Spawner` 死路径 + levels 校验面）。
 */
/** Spawn weight for a "still needed" colour. */
export const NEEDED_WEIGHT = 3;
/** Spawn weight for a decoy colour. Inert while `DECOY_COLORS_MAX = 0` (v1.17). */
export const DECOY_WEIGHT = 1;

// ──────────────────────────────────────────────────────────── §3.3 bead grid
/**
 * Grid pitch（设计 px，**格心距**）。**§3.3 v1.57（WXG-T-207-A）升为冻结量**
 * （旧：由 `BEAD_CELL + BEAD_GAP` 派生 = 52；本单为「冻结量换位」——钉住的是格心距，
 * 不是珠径 ⇒ 任何质感调参都不可能再挪动 5mm↔32 这条映射）。
 *
 * 语义 = **5mm 实物 peg 中心距**，与品牌 dip 同尺：`ADR-0021 §3` 冻结
 * `dip(mm) = 2 × round(mm × 6.4 / 2)` ⇒ `dip(5) = 32` ⇒ **zoom=1 时源图 1 px ↔ 渲染 1 设计 px
 * 逐格 1:1**。**⚠ 只对 5mm 参照档成立**：其它品牌档（2.6mm→dip16 / 10mm→dip64）不随本值
 * 搬家，「按所选品牌渲染」属另案（防再造「32 = 恒定量」的 v1.8 式误读；`levels-spec §3`
 * 的 `dip × dens` 口径才是正本）。
 *
 * **推翻 `ADR-0018 §3.4.1①`**（该条以 50 设计px = 5mm 实物等比参照）；被放弃的那一半等比是
 * 「真机屏上 ≈1:1 物理大小」（旧尺 750 设计px ≈ 72.1mm ≈ iPhone 屏宽；新尺 750/6.4 =
 * **117.2mm** ⇒ 屏上一颗 5mm 豆只画成 ≈3mm），取「与源图/做图域同尺」换掉它（用户
 * 2026-09-24 知情裁定；`ADR-0018 §3.4.4` 修订注已登记）。
 *
 * **⚠️ 撞数警告**：本值 32 与下行 `GRID_MAX_COLS` 的 32 **不是同一回事**（前者 = 设计px/渲染域，
 * 后者 = 格数/格数域）。旧注释「与每颗像素标准 32px 严丝合缝」在旧 52 基下只是巧合，
 * 本单后才是**结构性同尺**（studio `PER_BEAD_PX = brand.dip` 与本值第一次同源同值）。
 */
export const BEAD_PITCH = 32;
/** 格间距。**§3.3 v1.57 不动**：本单唯一不随基尺搬家的渲染域绝对像素量（缝 = 盘面露底色，
 *  2px 在 30px 珠上占比由 4% 升到 6.7%，缩到 1 有「真机看不见缝」风险，判例同 WXG-T-162 对
 *  `inset` 的裁定）。 */
export const BEAD_GAP = 2;
/**
 * Bead edge length（正方形 1:1）。**§3.3 v1.57 由冻结量（旧 50）降为派生量 = 30**；
 * 珠屏幕径 = `BEAD_CELL × zoom`。绘制边长再减 `BEAD_DRAW_INSET × 2`（见 assets-spec §1.10.1
 * 「`stroke()` 的基准是绘制边长、不是格径」）⇒ 新尺静息档 = (30 − 8) = **22** 设计 px。
 */
export const BEAD_CELL = BEAD_PITCH - BEAD_GAP;
/**
 * Max columns per level. **v1.45（WXG-T-203）：50 → 32** —— 用户拍板「单图上限 32 个珠子宽度，
 * 超过就拆组合图」。本值语义由 v1.37 的「导入硬顶」升为**单图/组合图（Plate）分界线 = 切块阈值**：
 * 任一维 > 32 ⇒ beads-studio 一键入关自动走 `sliceBoard` 均分切块（k = ceil(n/32)）。
 * 与每颗像素标准 32px（`levels-spec §3`）现为**结构性同尺**（旧 52 基下只是巧合，
 * v1.57 后 `BEAD_PITCH = 32 = dip(5mm)` 才使两者同源；正本 `levels-spec §3` v1.13 的
 * `dip × dens` 口径优先于旧 v1.8 单值口径）：1024 源图 → 32×32 最大单图；
 * 2048 → 64×64 母版 → 2×2 均分 ⇒ 恰好 4 宫 32×32、**零残余**（旧 50 阀下 40×40 会被当合法单图，
 * 而 ADR-0018 已裁 29×29 触控不可玩）。
 * 历史：13 → 29（v1.34，对齐 5mm Midi 标准方盘）→ 50（v1.37「最大可玩硬顶」）→ 32（v1.45）。
 * ⚠️ 连带（诚实登记）：① 单屏仍放不下 32 列（32×`BEAD_PITCH` = 1024px ≫ 750px 设计宽；旧 52 基
 * 为 1664px，v1.57 后裕度变大但仍需缩放 ⇒ 本条结论不变）⇒ 靠缩放
 * （ADR-0015 丁-3 已落码）；② 32×32 = 1024 格静态图元 ≈ 1.1 万 ⇒ **LOD 仍待立项**，性能未经真机验证；
 * ③ E1 实测：32×32 **全错位** 176–178 taps 结构性超 420s 预算 ⇒ 单图满尺寸档仍须 ≤60% 整区域就位
 * （`levels-spec §3.1①`）；④ 旧 33–50 维度的异形盘（包围盒裁剪后 33×36 类）从「合法单图」
 * 改为「自动切块」，入关不会因此拒收。
 */
export const GRID_MAX_COLS = 32;
/** Max rows per level（12 → 29（v1.34）→ 50（v1.37）→ **32**（v1.45，同上））。 */
export const GRID_MAX_ROWS = 32;
/** Demo minimum columns. */
export const GRID_MIN_COLS = 6;
/** Demo minimum rows. */
export const GRID_MIN_ROWS = 5;

// ───────────────────────────────────────────────────────────── §3.4 tray
/**
 * Base tray capacity（**v1.42 冻结变更 12→24**，WXG-T-203 丙档，用户 2026-09-22 拍板
 * D1=丙・D2=接受 v2.1 小托盘深度降格）：**2 行 × 12**。
 *
 * 依据 = E1 两轮 bot 实测矩阵（提案 §6.1/§6.2）：32×32 宫 reg60 部分错位下
 * tray12=148–160 全超 116 taps 线、tray24=90–96 达标（余量 22%）——增益窗口
 * 恰好卡在「大色块 + 整区域就位部分错位」（组合图宫形态）上；全错位大盘
 * 两轮复现 176–178 仍不可入关（v1.41 规模闸维持，扩容不解锁全错位）。
 *
 * 诚实记录（负面后果，不得隐去）：
 *  - **推翻 v1.30（WXG-T-168「先开一行」）的取值但保留其版面方法论**：v1.30
 *    针对的是 4 行态（24/24 面板高 216）；丙档 2 行基础态几何 v1.24 已验
 *    （panelH 126 零溢出）、3 行扩展态（panelH 180）与 `btn_expand` 热区重叠
 *    48px **待 E2 真机重验，未验前不作 QA 判据**。
 *  - 与 `input-control §2.1` v2.1「小托盘滚窗 = 操作深度所在」论述冲突——
 *    用户明示取舍（大盘可玩优先，D2），该条已同批复注。
 *  - `Tray` 实体与 `trayLayout(rows)` 的行数均为 capacity 派生 ⇒ 本值切换零接线；
 *    虚线判据 `row >= ceil(TRAY_BASE_SLOTS / TRAY_COLS)`（v1.30 修误判）在
 *    2 行基础态下正确划界（row0/1 实线、row2 虚线）。
 */
export const TRAY_BASE_SLOTS = 24;
/**
 * Expansion capacity（**v1.42 不变**，丙档 base 24 / expand 12）：**+1 行 × 12 = 12 槽**，
 * 扩展后共 36 槽（3 行，panelH 180 ≤ 带高）。激励视频解锁、MVP 无广告调用
 * （badge 占位）、本关内有效、重开重置（A1 语义不变）；扩展行沿用虚线槽语言
 * （WXG-T-168 修 `dashed = row > 0` 误判后的判据在丙档下正确划界）。
 */
export const TRAY_EXPAND_SLOTS = 12;
/** Slots per tray row. */
export const TRAY_COLS = 12;
/** Slot edge length. */
export const TRAY_SLOT = 48;
/**
 * 托盘珠绘制边长。**§3.4 v1.57（WXG-T-207-A）由 `view/bead-render.ts` 的私有绝对量升为
 * §3 派生常量**（K-012 补漏：它一直被 `view/view-model.ts` 与 `tests/bead-render.test.ts`
 * 消费，却不在冻结表内）。⚠️ 其中「4」= 槽内单边内缩 2px，是**未标定的绝对值**，
 * 随本单挂 `[待林绘澄]`（assets-spec §1.10.9 托盘族行：本单零改动）。
 *
 * ⚠️ **v1.57 引入的视觉反转（如实登记，assets-spec §1.10.8）**：旧尺 盘珠 50 > 托盘珠 44；
 * 32 基后 **盘珠 30 < 托盘珠 44**（托盘珠屏上径 = 盘珠 2.0×，旧尺为 1.16×）。可辩护理由
 * = 托盘是取子入口・大热区有利，但属**观感判断** ⇒ `[待真机]`；真机若判不可接受
 * ⇒ 同尺方案 `TRAY_SLOT 48→32`（连带重开 v1.42 三行态与 `btn_expand` 重叠 48px 的 E2
 * 真机重验）**属另案，不并入本单**。
 */
export const TRAY_BEAD_SIZE = TRAY_SLOT - 4;
/** Slot gap. */
export const TRAY_GAP = 6;
/** 托盘面板竖向内边距（面板高 = rows×54 − 6 + 2×12）。 */
export const TRAY_PANEL_PAD = 12;
/**
 * `btn_expand` 视觉尺寸（§3.4 v1.20 ← `assets-spec §1.3`：132×48、圆角 24）。
 * 热区高 88 来自 `accessibility C1`（48 < `TOUCH_MIN` ⇒ 视觉不变、热区扩大），
 * 二者同心，因此视觉在带下沿居中于热区（y∈[250,298]，热区 y∈[230,318]）。
 */
export const EXPAND_BTN_W = 132;
export const EXPAND_BTN_H = 48;
export const EXPAND_BTN_RADIUS = 24;
export const EXPAND_BTN_HIT_H = 88;
/** 按钮内 ▶ 三角边长（§1.3：12px）。 */
export const EXPAND_BTN_GLYPH_EDGE = 12;
/** ▶ 与文字间距（§1.3 未定，本项派生）。 */
export const EXPAND_BTN_GLYPH_GAP = 12;
/** 「扩展」两字宽 = 2 × 字号 28（CJK 等宽近似，RenderModel 无文本度量）。 */
export const EXPAND_BTN_LABEL_W = 56;
/** 按钮文字（§1.3：「扩展」28px 白字）。 */
export const EXPAND_BTN_LABEL = '扩展';
/** 占位文案：与道具超限同一语义（`powerups §2.6` 布局 A：本轮无路径）。 */
export const AD_PLACEHOLDER_HINT_TEXT = '即将开放';
/**
 * 扩展位占位提示的绘制 y：在 `POWERUP_BAND`（顶 200）与 `TRAY_BAND`（底 230）
 * 之间的空白中线上——空间上贴着刚被点的按钮，且不压任何元素（`ux-spec §5`）。
 */
export const AD_HINT_TEXT_Y = 214;
/**
 * ⛔ v1.22 作废（WXG-T-130 案 A 供料关停 / WXG-T-136 代码摘除，systems-index §3.4
 * 同款口径）：供料 tick 已从主循环摘除 ⇒ 三常量无活消费方。死值保留——①
 * `Spawner` 死路径与快照 `spawnInterval` 字段往返仍引用；② `levels.ts` 校验与
 * `levels-data.ts` 逐关 `spawnInterval` 字段（E5 swaps/JSON 批次统一清理）仍消费
 * MIN/MAX。供料复活时三值自动恢复生效。
 */
/** Default spawn interval (s); levels may override within [SPAWN_INTERVAL_MIN, MAX]. */
export const SPAWN_INTERVAL_DEFAULT = 4.0;
/** Spawn interval legal minimum (s). */
export const SPAWN_INTERVAL_MIN = 2.0;
/** Spawn interval legal maximum (s). */
export const SPAWN_INTERVAL_MAX = 6.0;

// ──────────────────────────────────────────────────────── §3.5 timer / fail
/** Default level countdown (s); levels may override within [MIN, MAX]. */
export const LEVEL_TIME_DEFAULT = 300;
/**
 * Level time legal minimum (s).
 *
 * **v1.23 冻结变更 180 → 120**（WXG-T-138 提案 Q10，用户拍板；WXG-T-139 落码）：
 * 下沿随 `LEVEL_TIME_OVERRIDE = clamp(k × 45s, 120, 420)` 放宽——k = 1/2 的关
 * 定价 45/90 s，一律被钳到 120 s 下限（systems-index §3.5 合法区间 `[LEVEL_TIME_MIN, LEVEL_TIME_MAX]`，
 * 当时上沿为 420；现值见下行）。
 * 旧值 180 会让 L1–L4（120/120/120/135 s）在 BOOT 被自家校验器拒收。
 *
 * **§3.5 v1.50 冻结变更 120 → 30**（用户 2026-09-23 拍板）。动因：**三档时钟制**（§3.7 v1.50）下
 * 2★/3★ = 1★ × 0.85 / × 0.70，而八关 1★ 实测最短只 84s ⇒ 其 3★ 档 = 59s。旧下限 120s 会把小关的
 * **三档全钳成同一个 120s ⇒ 档位塌缩、星级体系直接失效**（单档时钳位只是“该关变松”，三档时是
 * “该关没有星级”）。历史：180 → 120（v1.23）→ 30（v1.50）。
 */
export const LEVEL_TIME_MIN = 30;
/**
 * Level time legal maximum (s) —— **§3.5 v1.47 开发期临时放宽 420 → 2500**（用户 2026-09-22 拍板
 * 「改成 2500，我先验证玩法，时间上线需要再调整」）。
 *
 * **为何改**：规模闸 `taps × SEC_PER_TAP ≤ LEVEL_TIME_MAX` 等价于「点击数硬顶 = 本值 ÷ 3.6」；
 * 420 ⇒ 116 击，而全错位盘实测 `taps ≈ 0.65 × 错位珠数`（初始零洞 ⇒ 每颗都要挖+填两遍），
 * ⇒ 全错位盘只能做到 ~178 颗珠。一张 31×31 大色块图（M=828、同色相邻率 0.843）实测 540 击
 * = 1944s 被拒 —— **闸在系统性误杀「大色块 + 全错位」这类真正成片的盘**。
 *
 * **本值的性质 = 开发期验证档，不是产品值**。上线前必须按 playtest 回调（取证与回调协议
 * `levels-spec §5.0.1`）。ponytail: 未做分档预算（小盘 420 / 大盘放宽）——那需先定
 * 「大盘 3★ 与失败页激励位怎么算」，属玩法裁定，不在此拍。
 *
 * **连带漂移（已登记 §6 v1.47）**：难度分 `D = round(100 × T / LEVEL_TIME_MAX)` 的分母是本值，
 * 改档后一切 D 读数缩水 ≈6×（旧 420s 顶格盘 D100 → D17）⇒ **D 不可跨档比较**，
 * 历史报告里的 D 值仅作当时档位记录。
 */
export const LEVEL_TIME_MAX = 2500;
/**
 * 单位错位对的定价（s/对）——`LEVEL_TIME_OVERRIDE` 公式的系数（§3.5 v1.23 冻结）。
 * 8 关 k 曲线 [1,2,2,3,4,5,6,8] ⇒ 120/120/120/135/180/225/270/360 s。
 */
export const LEVEL_TIME_PER_PAIR = 45;

/**
 * 每个「批量动作」的秒数预算（§3.5 v1.50 冻结变更：**改名 `SEC_PER_TAP` → `SEC_PER_STEP` 并重锚**）。
 *
 * ⚠ **量纲变了，不是改数值**：旧自变量 = 「每次成功点击」（bot 四个公开命令返回 true 的计数，
 * 含选锚/选槽那一下）；新自变量 = **`refSteps` = 一个玩家可感知的批量动作**
 * （`直填 + 取回 + 落子` 三类之和，选锚并入被它服务的那个动作）。
 * 同一个盘两个数差≈2 倍 ⇒ 不改名不重锚就会让注释与代码说两套话。
 *
 * **取值 1.69 = 八关实测 `t_act ÷ BAC步数` 的中位数**（同一玩家，2026-09-23，
 * 取证见 `levels-spec §5.0.1`）。自变量取 **`branchOrder='BAC'`**（先取回挖洞→再落子→最后直填），
 * 理由是在八关上同时拿下两个独立判据：最大误差最小（±28%，现况 ACB ±39%）与
 * 难度排序最准（Spearman ρ = 0.95，现况 0.83）。
 *
 * ⚠ **本值的用途已降格为「新关引导值」**（公式 v0.4）：已人工试玩过的关一律直接用实测
 * `t_act` 定 1★ 时钟，不经过本常数。原因：本常数在八关上的残差仍有 **±29%**（L1 −21% / L8 +29%），
 * 直接进玩家体验不可接受。**切勿把它当“可预测人类用时”的模型**：
 * 历史上同族先验已三次被同一批数据证伪（`t_act÷bot_taps` 四点崩、`M×1.6` 八点 ρ 仅 0.69、
 * n=4 上选的 `CAB` 到 n=8 最大误差 **162%**）。
 *
 * 校准机制不变（§5.0.1）：单关 `|t_act − T|/T > 25%` ⇒ 该关改用实测覆盖；均值超阈 ⇒ 回调本值。
 */
export const SEC_PER_STEP = 1.69;

/**
 * **时间按 k 定价**（§3.5 v1.23）：`clamp(k × LEVEL_TIME_PER_PAIR, MIN, MAX)`。
 * `k` 非有限 / 非正时按 `LEVEL_TIME_DEFAULT` 兜底（不产生 NaN 倒计时——NaN 永
 * 不到零 = 唯一失败条件永不触发，见 `levels.ts` 同款注释）。
 */
export function levelTimeFor(pairs: number): number {
  if (!Number.isFinite(pairs) || pairs <= 0) return LEVEL_TIME_DEFAULT;
  const raw = Math.floor(pairs) * LEVEL_TIME_PER_PAIR;
  return Math.max(LEVEL_TIME_MIN, Math.min(LEVEL_TIME_MAX, raw));
}
/** Urgent threshold (s): timer switches to danger presentation. */
export const TIMER_URGENT_T = 10;
/** Display refresh granularity (s); internal accumulation is per-dt. */
export const TIMER_TICK = 1.0;
/** Failure condition is *only* the countdown reaching zero (tray full never fails). */

// ────────────────────────────────────────────────────── §3.13 misplaced (v1.22/1.23)
/**
 * 单关错位交换对数下限（§3.13 冻结）：0 对 = 无错位 = 无玩法 ⇒ BOOT 拒收。
 */
export const MISPLACED_PAIRS_MIN = 1;
/**
 * 单关错位交换对数上限（§3.13 冻结）：= 色板 8 色上限的保守界，防单色全灭型死局。
 */
export const MISPLACED_PAIRS_MAX = 8;
/**
 * 环长分布 `cycleProfile` 的目标环长（v1.23 增补，**levels JSON 建议值、不冻结**）。
 * 环 = 「珠→格→珠」追踪链：`short` 全 2-环（短对换）、`mixed` 长短混合、
 * `long` 偏长环。k 相同下长环更难（心理难度），但**长环会让错位珠数 = k + 环数
 * 而非 2k**——与 levels-spec §2.1 恒等式冲突，故 8 关数据暂一律取 `short`
 * （恒等式与 §3 表「2k」优先），长环留给 playtest 调参。详见
 * `game/misplaced-assembler.ts` 文件头。
 */
export const CYCLE_LEN_SHORT = 2;
export const CYCLE_LEN_MIXED = 3;
export const CYCLE_LEN_LONG = 5;

// ─────────────────────────────────────────────────────────── §3.6 powerups
/**
 * v1.22（WXG-T-137，用户裁定）：三道具从「清托盘珠」反转为**解环器 = 自动归位棋盘
 * 错位珠**，次序即卡片左 → 右（§3.6）。
 *
 *  `solver`        — 归位**行主序第 1 颗**错位珠；
 *  `solverPlus`    — 归位前 `SOLVER_PLUS_COUNT` 颗错位珠（不足不补）；
 *  `solverRandom`  — 用注入 `Rng` 抽 `SOLVER_RANDOM_COUNT` 颗错位珠（不足不补）。
 *
 * 道具目标 = 棋盘错位珠；托盘**零读写**（错位珠在 grid 内直移 / 交换闭环）。
 */
export const POWERUP_TYPES = ['solver', 'solverPlus', 'solverRandom'] as const;
/** `solverPlus`：一次最多归位的错位珠数（§3.6 v1.22；不足不补）。 */
export const SOLVER_PLUS_COUNT = 3;
/** `solverRandom`：一次抽取归位的错位珠数（§3.6 v1.22；不足不补）。 */
export const SOLVER_RANDOM_COUNT = 1;
/**
 * ⛔ v1.22 作废（WXG-T-137 解环器反转，systems-index §3.6）：「清**槽**」语义随道具
 * 目标改换而整体消失 ⇒ 窗口长度与随机抽珠数失去消费方。**死值保留**（§3.2 / §3.4
 * 同款口径：清槽玩法复活零成本；删除需先复活 `regionWindow` 与其调用面）。
 */
/** ~~`region`：清连续这么多槽。~~ ⛔ 作废死值，见上。 */
export const REGION_CLEAR_SLOTS = 6;
/** ~~`random`：等概率抽至多这么多颗持有珠。~~ ⛔ 作废死值，见上。 */
export const RANDOM_CLEAR_COUNT = 5;
/** Free uses of *each* powerup per level — three independent counters (§3.6, A5). */
export const POWERUP_FREE_USES = 1;
/**
 * In-level rewarded-video placements: 3 powerup cards + tray expansion (§3.6).
 * Layout A (WXG-T-057): all four are `ad_badge` placeholders this round — the
 * only live placement is the fail-page continue (§3.11).
 */
export const AD_PLACEMENTS = 4;
/** A powerup identity — the frozen tuple's element type. */
export type PowerupType = (typeof POWERUP_TYPES)[number];

// ──────────────────────────────────────────────────────── §3.11 fail revive
/**
 * Seconds written onto the playable clock after a completed fail-page ad.
 * **v1.25 冻结变更 60→180**（WXG-T-149，用户 2026-09-17 拍板）：对齐参考视频
 * 实测量级（ref-video §10.5：失败挽留后 +180s 原局续打）。原 60 为 WXG-T-057
 * 初版值。注意星级口径不受影响：`computeClearStars` 的 `starRemaining` 扣减
 * 与 `revived` 2★ 封顶逻辑按本常量自动放大，无需另改。
 */
export const REVIVE_BONUS_SEC = 180;
/** Successful revives allowed per attempt (reset on full level restart). */
export const REVIVE_MAX_PER_LEVEL = 1;
/**
 * 体力回满激励位（§3.11 v1.28 第二 live 位 / §3.14「体力回满 = 激励视频 onRewarded」）。
 * 0 心时 retry/restart 被拒 → 看此广告回满至 `STAMINA_MAX` 再重试（WXG-T-164）。
 * 框架 `REWARDED_PLACEMENT` 未列本值，但 `RewardedAdPlacement` 型别容 `| string`，
 * 故用游戏侧字符串位（不改冻结框架枚举）；ponytail: 真机广告单元映射待发布侧接入。
 */
export const STAMINA_REFILL_PLACEMENT = 'stamina-refill';

// ──────────────────────────────────────────────────────── §3.7 stars & settle
/**
 * **三档时钟系数（§3.7 v1.50 冻结）**——星级 = 本局所选档位，**不再看剩余时间占比**。
 *
 * 旧 `STAR3_RATIO = 0.32` / `STAR2_RATIO = 0.12` 已**删除**（不是弃用，是删：让任何残留引用在
 * 类型检查上红）。删除动因：旧制把「失败压力（倒计时→广告）」与「效率奖励（星级）」
 * 焊在同一只时钟上，二者互相绑死：时钟调紧 ⇒ 人人看广告且 3★ 实质作废；调松 ⇒ 广告位不开张。
 * 拆成三只时钟后两条线各自成立（`levels-spec §5.0` 公式 v0.4 / `systems-index-changelog` v1.50）。
 *
 * 关卡 JSON 的 `time` 字段语义 = **1★ 档时钟**（不存三个数）；2★/3★ 由 `tierSecondsFor` 派生
 * ⇒ 单一真源，不会三个数各自漂移。
 */
export const STAR_TIER_K = [1.00, 0.85, 0.70] as const;
/** 档位数（1★/2★/3★）。 */
export const STAR_TIER_COUNT = 3;

/** 本关 `time`（= 1★ 时钟）在第 `tier` 档实际给多少秒。 */
export function tierSecondsFor(levelTime: number, tier: number): number {
  const t = Math.max(1, Math.min(STAR_TIER_COUNT, Math.round(tier)));
  const k = STAR_TIER_K[t - 1] ?? 1;
  return Math.max(LEVEL_TIME_MIN, Math.round(levelTime * k));
}

/**
 * 本局应开哪一档（§3.7 v1.50 双条件闸门）。**没有“选档”操作**——合法档唯一，由存档推导：
 *
 * - **(a) 本关前一档已过** ⇒ `T ≤ starsThisLevel + 1`（1★ 不涉及此条）
 * - **(b) 上一关同档已过** ⇒ `T ≤ starsPrevLevel + 1`；**首关豁免 (b)**
 *   —— 否则 L1 的 2★ 永不可开，而 (b) 是传递的 ⇒ **整张表的 2★/3★ 链在源头永久锁死**
 *   （用户 2026-09-23 补裁）。
 * - `T = 1` 时 (b) 退化为旧推关门「上一关已通关」，与 `maxUnlockedLevel` 同语义。
 *
 * 前置：因 (a) 保证不跳档，`starsByLevel`（历史最高星）与“档 T 已过”等价 ⇒ **存档不需扩结构**。
 *
 * @param starsPrevLevel 上一关星数；**首关传 `null`**（豁免 (b)）。
 */
export function nextTierFor(starsThisLevel: number, starsPrevLevel: number | null): number {
  const bySelf = Math.floor(starsThisLevel) + 1;
  const byPrev = starsPrevLevel === null ? STAR_TIER_COUNT : Math.floor(starsPrevLevel) + 1;
  return Math.max(1, Math.min(STAR_TIER_COUNT, bySelf, byPrev));
}
/** Demo level count（**§3.7 v1.46 pre-release 重置第二批**：原 demo 8 关已按用户裁定移出，关表改由
 * beads-studio 生成的盘逐张入关重建，本值**随表走 = 当前关数**（先例 = v1.43 随入关 9→10）；
 * **2026-09-22 已入满 8 张**（`L00001..L00008`，均 studio 产物、`time` 全来自真引擎实测）⇒ 回到 v1.44 关数基线，
 * 但**内容全换**（旧 demo 1–8 关的 playtest 校准值已脱离关表）。uid 5 位零填充与区间 5–10 不变，
 * 见 `level-content-pipeline.md` §1.2 v0.7。
 * ⚠️ 再入/再移出关时本值需同步改，否则 `levels.test` / `misplaced-assembler.test` / `level-import.test` 三处断言即红。 */
export const DEMO_LEVEL_COUNT = 8;
/**
 * 单关满星数（§3.7 星级 1–3 语义）。`computeClearStars` 的上限、S8 存档
 * `stars` 数组的逐项钳制上界（save-progress §2.2/§6）、通关画面总览的分母共用它。
 */
export const STAR_MAX = 3;

// ──────────────────────────────────────────────────────── §3.8 accessibility
/** Min hit area for *UI controls* (buttons/cards/gear). */
export const TOUCH_MIN = 88;
/**
 * 棋盘/托盘珠的外扩命中余量（设计 px）。**§3.8 v1.57（WXG-T-207-A）新冻结**：
 * 取代旧散文「名义尺寸外扩 8px」⇒ **冻规则不冻数字**（热区数值一律由本值派生）。
 */
export const BEAD_HIT_PAD = 8;
/**
 * Board/tray beads are the documented exception（不扩至 `TOUCH_MIN`，防跨格误触），
 * 相邻重叠按格心最近命中（S2 `input-control §2.2`，对齐 art `accessibility.md` F2）。
 *
 * **§3.8 v1.57 公式化**（随 §3.3 同批）：
 *  • `GRID_HIT_SIZE = BEAD_CELL + 2×BEAD_HIT_PAD` = **46**（旧字面 66 = 50+16，随基尺落 46）；
 *  • `TRAY_HIT_SIZE = TRAY_BEAD_SIZE + 2×BEAD_HIT_PAD` = **60**。
 * ⚠️ **旧 62 无出处，本单订正为 60**：`git log -S "TRAY_HIT_SIZE = 62"` 追至 `1c83776`，
 * `TRAY_SLOT+16 = 64` 与 `TRAY_BEAD_SIZE+16 = 60` 两条算法都得不出 62，而网格侧一致用
 * **珠名义**（`BEAD_CELL` 而非 pitch）⇒ 托盘侧对齐珠名义 = 60。−2px 触控方向 = 缩小与
 * `btn_expand` 的既存重叠（利好 E2 待验项），但仍是触控变化 ⇒ `[待真机]`。
 *
 * **三条与基尺无关的结构性不变式**（替代旧快照式 `52z < 66z`，由 `tests/tuning.test.ts` 钉住）：
 *  ① `GRID_HIT_SIZE > BEAD_PITCH` ⇔ `2×PAD > GAP`（16 > 2）⇒ **无死区**（ADR-0015 §3.3-4）；
 *  ② `GRID_HIT_SIZE ≥ BEAD_CELL`；
 *  ③ 相邻热区重叠量 = `GRID_HIT_SIZE − BEAD_PITCH = 2×PAD − GAP` = **14px，新旧同值**
 * （旧 66−52 = 14、新 46−32 = 14）⇒ `IMPACT-0020a` 的「HIT/PITCH 1.269→1.941」是**比值假警报**，
 * 真正要守的是重叠量与无死区，两者都没变。热区**不需上界**（相邻重叠本就是设计意图）。
 */
export const GRID_HIT_SIZE = BEAD_CELL + 2 * BEAD_HIT_PAD;
export const TRAY_HIT_SIZE = TRAY_BEAD_SIZE + 2 * BEAD_HIT_PAD;

// ──────────────────────────────────────────────────────── §3.10 sprint (C1–C8)
/** Sprint run length (s); legal [90, 120], out-of-range falls back to default (C1). */
export const SPRINT_TIME_DEFAULT = 120;
export const SPRINT_TIME_MIN = 90;
export const SPRINT_TIME_MAX = 120;
/** Combo window: max gap between two correct placements (s) (C2). */
export const COMBO_WINDOW_S = 5.0;
/** streak thresholds → ×2/×3/×5; multiplier cap ×5 (C3). */
export const COMBO_STREAK_TIERS = [2, 4, 7] as const;
export const COMBO_TIER_MULTIPLIERS = [2, 3, 5] as const;
export const COMBO_MULT_MAX = 5;
/** Base score per correct placement, before the multiplier (C4). */
export const SCORE_PER_BEAD = 10;
/** Stage-completion time bonus (s) (C5). */
export const STAGE_BONUS_TIME = 15;
/** Stage-completion score = base + step × stageIndex (C5). */
export const STAGE_CLEAR_BONUS_BASE = 200;
export const STAGE_CLEAR_BONUS_STEP = 50;

/** Normal-mode settle score weights (C7, not shown in-run). */
export const SETTLE_STAR_WEIGHT = 1000;
export const SETTLE_RATIO_SCALE = 1000;
export const SETTLE_POWERUP_PENALTY = 50;
export const SETTLE_NO_EXPAND_BONUS = 200;

/** One sprint stage's mechanical parameters (C6 ladder rung). */
export interface StageParams {
  /** Distinct colours on the stage pattern. */
  readonly colors: number;
  /** Fillable-cell target for the stage. */
  readonly cells: number;
  /**
   * Spawn interval for the stage (s). ⛔ v1.22 作废（C6 供料间隔公式段随供料关停
   * 失去消费方，WXG-T-136）：stage 切换后新错位布置改由 `misplaced` 交换构造生成
   * （systems-index §3.10f / §3.13），无供料可注入。公式与死值保留（供料复活零成本）。
   */
  readonly interval: number;
}

/**
 * C6 ladder — stage `n` (0-based) parameters, endpoints aligned to §3.2/3.3/3.4.
 * ⛔ v1.22：`interval` 段作废（同上），`colors` / `cells` 两段现行有效。
 */
export function stageParamsFor(n: number): StageParams {
  const index = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return {
    // §3.2 v1.55 抬上限后本式的封顶由 10 变 35（高梯级不再在 10 色处触顶）。
    // 现网不可观测：`buildStagePattern` 另有 `min(params.colors, 池图案实际色数)`
    // 二次钳制，而池 = 已入库 8 关（实测最大 8 色）⇒ 冲刺实际仍 ≤8 色。
    // 是否另冻 `SPRINT_COLORS_MAX` = 正本 §7-Q3，推荐 丙（挂账），本单不发明新值。
    colors: Math.min(3 + Math.floor(index / 2), BEAD_COLOR_MAX),
    cells: Math.min(30 + 10 * index, GRID_MAX_COLS * GRID_MAX_ROWS),
    interval: Math.max(6.0 - 0.5 * index, SPAWN_INTERVAL_MIN),
  };
}

/** Stage-clear score bonus for the stage that was just completed (C5). */
export function stageClearBonus(stageIndex: number): number {
  return STAGE_CLEAR_BONUS_BASE + STAGE_CLEAR_BONUS_STEP * stageIndex;
}

/**
 * C7 normal-mode settle score (not shown in-run; for ranking/segments).
 * `settleScore = stars×1000 + round(ratio×1000) − powerupsUsed×50 + (未用扩展 ? 200 : 0)`
 */
export function normalSettleScore(
  stars: number,
  ratio: number,
  powerupsUsed: number,
  expandUsed: boolean,
): number {
  const s = Math.max(0, Math.min(3, Math.floor(stars)));
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const p = Number.isFinite(powerupsUsed) && powerupsUsed > 0 ? Math.floor(powerupsUsed) : 0;
  return (
    s * SETTLE_STAR_WEIGHT +
    Math.round(r * SETTLE_RATIO_SCALE) -
    p * SETTLE_POWERUP_PENALTY +
    (expandUsed ? 0 : SETTLE_NO_EXPAND_BONUS)
  );
}

/**
 * §3.7 v1.50：**星级 = 本局档位**（选档即定星）。剩余时间只决定「成不成」（= 0 即失败），
 * 不再决定“得几星”。`ratio` 仍输出，但只供 `normalSettleScore` 的展示/排行分量。
 *
 * 旧签名 `(remaining, total, reviveBonusSec, revived)` 已改：**续时不再封 2★**（用户 2026-09-23 裁定
 * 取消封顶）——星级只考核效率，广告救济的是“时间不够”，两线解耦才是本制的目的；
 * 且旧 `starRemaining = remaining − reviveBonusSec` 的扣减本身已是双重惩罚，叠加封顶属重复计罚。
 */
export function computeClearStars(
  remaining: number,
  total: number,
  tier: number,
): { ratio: number; stars: number } {
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const stars = Math.max(1, Math.min(STAR_TIER_COUNT, Math.round(tier)));
  return { ratio, stars };
}

// ─────────────────────────────────────────────────────── §3.6b finish screen
/**
 * S7 通关画面（FINISH）几何。`ux-spec §3.6` 只给「全屏庆祝 + 星级总览（8 关星数和）
 * + 去冲刺 + 重玩第 1 关」一句话，**未给几何** ⇒ 本组是**派生常量**（沿用结算面板
 * 的常量族与设计空间约定），登记于台账。
 */
/** 总览每行高度。 */
export const FINISH_ROW_H = 64;
/** 总览行间距。 */
export const FINISH_ROW_GAP = 12;
/** 总览每行宽度（居中，含标签与 3 颗星）。 */
export const FINISH_ROW_W = 540;
/** 总览星尺寸（小于结算行的 `CLEAR_STAR_SIZE`，8 行竖列需紧凑）。 */
export const FINISH_STAR_SIZE = 34;
/** 总览行内星间距。 */
export const FINISH_STAR_GAP = 8;
/**
 * 总览**逐关**入场步长。`ux-spec §5` 的「逐颗 150ms」是结算行 3 颗的时序；
 * 总览最多 8×3 = 24 颗，逐颗要 3.6s ✗ ⇒ 改为逐关 150ms（8 关 = 1.2s），
 * 同一关的 3 颗同时入场（派生项，登记台账）。
 */
export const FINISH_LEVEL_STEP_MS = 150;

// ──────────────────────────────────────────────────── §2.5 combo VFX (Lv1–3)
/**
 * 连击特效三档时长与形态参数。**毫秒值全部来自 `ux/ux-spec.md §5`**（score-combo §2.5
 * 明写「本篇不自写动效毫秒值」），形态来自 §2.5。常量镜像在此，供纯逻辑与测试共用。
 */
/** Lv1（×2）珠面星光粒子：200ms。 */
export const COMBO_VFX_LV1_MS = 200;
/** Lv2（×3）伪震屏：150ms。 */
export const COMBO_VFX_LV2_MS = 150;
/** Lv3（×5）边缘径向光 + 珠面波浪：350ms。 */
export const COMBO_VFX_LV3_MS = 350;
/** Lv2 整屏 scale 脉冲峰值（§2.5：1.00 → 1.015 → 1.00，**仅缩放、无位移**）。 */
export const COMBO_SHAKE_SCALE_MAX = 1.015;
/** Lv1 粒子枚数（§2.5 给的是 3–5 区间；本模块无 RNG ⇒ 取中值，确定性可测）。 */
export const COMBO_PARTICLE_COUNT = 4;

// ──────────────────────────────────────── presentation timings (非冻结真源)
/**
 * ~~`LEVEL_CLEAR_DELAY_S`（过关横幅自动推进延迟）~~ —— **WXG-T-063 退休**：
 * `ux-spec §4` 流转表要求 `LEVEL_CLEAR` **等按钮**（结算·过关面板），"1.4s 自动进下一关"
 * 只是占位实现 ⇒ 占位与常量一并删除（留墓碑注以便追溯）。星入场节奏见
 * `CLEAR_STAR_STEP_MS`（ux-spec §5「逐颗 150ms」）。
 */

// ──────────────────── §3.8 S9 暂停面板几何（来源：ux-spec §3.3 线框，本篇不派生）
/** Pause settings gear hit area — a TOUCH_MIN square anchored left in HUD_BAND. */
export const GEAR_HIT_SIZE = TOUCH_MIN;
/** Panel size: 560 × 480 (`panel_dialog`, ux-spec §3.3；结算/过关面板共底板). */
export const PANEL_SIZE = { w: 560, h: 480 } as const;
/**
 * 暂停面板专有高度（WXG-T-164 批0 由 480 扩至 600 容第 4 行 → **WXG-T-211-S5 扩至 718 容第 5 行**）。
 * 上位裁 = S9 v1.7 **Q2 = 甲「扩行」**（行4 =「珠子风格 / 豆子尺寸」两格，行5 =「性能信息 / 回主菜单」
 * 两格**原样下移**、语义与动作零改动）；ux §3.3「几何」条的 `PAUSE_PANEL_H` `[待定]` **由本值回填**
 * （S9 §5 授权「按行高地板 `TOUCH_MIN` 实测回填」，GDD/UX 两份正本都不钉值 ⇒ 本行即唯一真源）。
 * 不污染共享的 `PANEL_SIZE`（结算/失败/通关面板冻结几何不变）。
 *
 * **实算**（行高地板 `TOUCH_MIN = 88`，`PANEL_ROW_GAP = 30`，标题带 100）：
 *   自然高 = 100 + 5×88 + 4×30 = **660**；再加 **58 底衬**（= 四行时 600 − 542 的同一底衬值，
 *   行距与底衬**零改动**、只增一行）⇒ **718**。
 * **避让复核**（S9 §8-5，沿旧判据）：plate `yMax = (1334 + 718) / 2 = 1026 < CAPSULE_AVOID.yMin 1214`
 * ⇒ 不侵入微信胶囊区；`yMin = 308 > TRAY_BAND.yMax 450`？—— 否：308 < 450 ⇒ 面板**盖住托盘带**，
 *   这正是遮罩「防偷看」的既有语义（遮罩覆盖棋盘与托盘，ux §3.3），非新代价；行5 底 `366` 与
 *   plate 底 `308` 之间即那 58px 底衬，逐行间距 = 现行算式（`pause-panel.ts` 五行同一条链）。
 * 行重叠 / 避让的最终结论仍由 `tests/pause-settings.test.ts` 的 §8-5 腿跑实测（本注只登记算式）。 */
export const PAUSE_PANEL_H = 718;
/** Scrim over board+tray: rgba(42,46,67,0.5) (ux-spec §3.3). */
export const PANEL_SCRIM_RGB = { r: 42, g: 46, b: 67 } as const;
export const PANEL_SCRIM_ALPHA = 0.5;
/**
 * **设置态**背景遮罩 α（WXG-T-211-S5 / ux §3.3「遮罩」条，裁 = **丙案**（U14 已改丙）：
 * 面板含行4（珠子风格 / 豆子尺寸）的**设置态期间下调遮罩**，让玩家实时看见自己改档的效果）。
 * ⚠️ **[暂定·待 PT-SKIN-01 真机校准]**：ux ① 明文「具体 α 值本文不钉 `[待定]`、由落码单实测回填」
 * ⇒ 本行即落码回填位，取值依据 = 任务单已裁「**初值 0.3**（从 0.5 下调、非 0）」，
 *   同时守住 ux ②「下调不得为 0」（仍保住面板与背板的对比度下限，可辨程度 `[待真机]`）。
 * **射程（本批准入的两处，其余零改动）**：① 暂停面板 scrim（`view-model::drawPausePanel`）
 *   ② 菜单**设置** overlay scrim（`meta-view` 且**仅 `overlay === 'settings'`**；签到 / 选关
 *   overlay 不属设置态 ⇒ 恒读 `PANEL_SCRIM_ALPHA`）。**结算 / 失败 / 通关 / 冲刺结算四类面板
 *   继续读 `PANEL_SCRIM_ALPHA` 零改动**（ux ⑥「不得从本行读出全局遮罩变浅」）。
 * **RGB 三通道零改动**（面板侧仍 = `PANEL_SCRIM_RGB`；⚠ 登记既有不同源事实：菜单 overlay 的
 * scrim 一直硬编 `rgba(0,0,0,·)`，本批**只换 α 不洗 RGB**——洗 RGB 就是 ux ① 的「RGB 零改动」违例）。
 * **零新增毫秒值、§5 动效表零新行**；「防误触」不受影响（拦截由 §4 状态门禁保证，与 α 无因果）；
 * 「防偷看」语义弱化 = ux ④ **已接受代价**，不辩护。
 * **设置态判定所取（回传已注明）**：任务单已裁「两入口都算设置态」⇒ 判定面 = **overlay 打开期间**，
 *   暂停面板可见期间即设置态（暂停面板自身承担设置职，内容单源 S9），不引入第三种「子态」。 */
export const SETTINGS_SCRIM_ALPHA = 0.3;
/** Panel button height — every row honours the TOUCH_MIN control floor (§3.8). */
export const PANEL_BUTTON_H = TOUCH_MIN;
/** Primary button ("继续") width (ux-spec §3.3: 240×88 主钮). */
export const PANEL_PRIMARY_W = 240;
/** Inner horizontal padding inside the panel. */
export const PANEL_PADDING = 20;
/** Vertical gap between panel rows. */
export const PANEL_ROW_GAP = 30;
/** Vertical space reserved above the primary row for the title band. */
export const PANEL_TITLE_BAND_H = 100;

// ─────────── §3.8-companion 结算·过关面板几何（来源：ux-spec §3.4 线框）
// 面板本体复用 `panel_dialog`（560×480）与 `PANEL_PADDING` / `PANEL_ROW_GAP`；
// 只有星与按钮的排布是本面板专有。
/** 每颗星入场的间隔（ms）—— ux-spec §5「结算星入场 逐颗 150ms（150×3）」。 */
export const CLEAR_STAR_STEP_MS = 150;
/** 单颗星的外接直径：ux-spec §3.4 未定尺寸 ⇒ 本项派生（三颗等距排在面板中部）。 */
export const CLEAR_STAR_SIZE = 64;
/** 星与星的水平间隔。 */
export const CLEAR_STAR_GAP = 28;
/** 主/副钮宽度：240 + 30 + 240 = 510 ≤ 560 − 2×20（面板内边距）⇒ 可并排落地。 */
export const CLEAR_BUTTON_W = PANEL_PRIMARY_W;
export const CLEAR_BUTTON_GAP = 30;

// ─────────────────────── 面板动效（来源：ux-spec §5「面板入 / 出 200 / 150」）
/** Panel enter animation duration (ms). */
export const PANEL_IN_MS = 200;
/** Panel exit animation duration (ms). */
export const PANEL_OUT_MS = 150;
/** Enter scale start → 1.0 (ux-spec §5: scale 0.9→1.0). */
export const PANEL_SCALE_FROM = 0.9;

// ══════════════ §3.8 / §3.14 meta 冻结常量镜像（真源：systems-index v1.28） ══════════════

/** §3.8 震动默认值：VIBRATE_DEFAULT = ON（用户 2026-09-18 拍板⑦）。 */
export const VIBRATE_DEFAULT = true;

/** §3.14 体力上限（宽容包 B：8 心）。 */
export const STAMINA_MAX = 8;
/** §3.14 体力恢复速率：8 分钟/心（离线恢复 f(Δt wallClock)，登录时钳上限）。 */
export const STAMINA_REGEN_MIN_MS = 8 * 60 * 1000;
/** §3.14 开局扣心：新局开局/重试各扣 1（PAUSED 恢复与菜单在途续进不重复扣）。 */
export const STAMINA_START_COST = 1;

/**
 * §3.14 签到奖励表（MF5 循环制：day cell = claims % 7，断签不清零）。
 * 冻结面只有第 3/5 天各 1 心（溢出即弃）；币数额**不冻结**（playtest 调参位）。
 */
export const SIGNIN_REWARDS: readonly { coins: number; hearts: number }[] = [
  { coins: 20, hearts: 0 },
  { coins: 30, hearts: 0 },
  { coins: 30, hearts: 1 },
  { coins: 40, hearts: 0 },
  { coins: 40, hearts: 1 },
  { coins: 60, hearts: 0 },
  { coins: 100, hearts: 0 },
];

/**
 * §3.14 买心阶梯价（钱包 A 包）。**不冻结**——待 playtest 调参（systems-index
 * §3.14 明文「阶梯价不冻结」）；第 n 次购买（当日计数）取 `ladder[min(n, len-1)]`。
 */
export const HEART_PRICE_LADDER: readonly number[] = [50, 100, 200];

// ─────────── 主菜单（shell 屏）几何（来源：ux-spec v1.7 §2 流程 + meta-ui 线框）
/** 主菜单主钮「开始游戏」：复用面板主钮宽 × TOUCH_MIN。 */
export const MENU_PRIMARY_W = 320;
/** 主菜单次级入口（签到 / 设置）按钮尺寸。 */
export const MENU_SECONDARY_W = 240;
/** 主菜单纵向行距。 */
export const MENU_ROW_GAP = 36;

// ────────────── §GAP-04/03/10 反馈态动效（来源：ux-spec §5 / art-bible §7，WXG-T-087）
/**
 * `wrong`（放错拒绝）事件总时长（ux-spec §5:180 = 200）：±px 抖动 ×2（**位移通道**）与
 * danger 描边**单次脉冲**共用同一 fx 窗口（`WRONG_FADE_IN_MS + WRONG_HOLD_MS +
 * WRONG_FADE_OUT_MS` = 200）。
 */
export const WRONG_FX_MS = 200;
/** `wrong` 水平抖动幅度（±px，art §7「位移 ±3px」；属位移，不在闪烁通道内，§5:180）。 */
export const WRONG_SHAKE_PX = 3;
/**
 * `wrong` danger 描边**单次脉冲** α 包络分段（ux-spec §5:180，WXG-T-102/BD-29）：
 * α 0→1 淡入 `WRONG_FADE_IN_MS`（ease-out）→ 峰值保持 `WRONG_HOLD_MS` → 1→0 淡出
 * `WRONG_FADE_OUT_MS`（ease-in）。一次 fx 窗口内 **α 极值点 ≤1（不往复）** ⇒ 配合
 * `WRONG_FX_RESTART_GATE_MS`，有效闪烁 ≤2 次/秒（`systems-index §3.8` 冻结值）。
 * 属**反馈态动效参数**（同 `WRONG_FX_MS` / `HINT_PULSE_MS` 判例）⇒ 落 `tuning`，
 * **不进 `systems-index §3`**。
 */
export const WRONG_FADE_IN_MS = 60;
/** `wrong` 描边峰值保持段（ms，缓动的「峰值保持」项）。 */
export const WRONG_HOLD_MS = 80;
/** `wrong` 描边淡出段（ms，ease-in）。 */
export const WRONG_FADE_OUT_MS = 60;
/**
 * 连续拒绝时的**反馈重启门**（ux-spec §5:180「视觉脉冲重启门 500ms」，与音频侧
 * `AUDIO_REJECT_MIN_INTERVAL` = 0.5 s **同拍**，双通道一致）：自上次起播 `wrong` fx 起算，
 * 门内到达的新 mismatch 不重启反馈，门外才重启 ⇒ 有效频次 ≤2 次/秒。
 *
 * ⚠️ 门禁**范围**的判断（描边 vs 抖动，见 `beads-game._armWrongFx`）：§5:180 字面把门
 * 写成「**视觉脉冲**重启门」，但 §3.8 冻结值写的是「**抖动+描边闪** ≤2 次/秒」（两通道
 * 一体的错误反馈事件上限）⇒ 本实现按 §3.8 **从严**，门禁**整个 wrong-fx 事件**。
 */
export const WRONG_FX_RESTART_GATE_MS = 500;

/* ─────────────────────────────────────────────────────────────────────
 * G1 `vfx_fill_pop` — 珠子落座回弹（WXG-T-128 美术 v1.4「动态质感章」首单）。
 * 规格正本 = `art/assets-spec.md` §1.6.1（逐帧公式 / clamp / D1 退化）+ `art-bible §7.3.1`；
 * 毫秒真源 = `design/ux/ux-spec.md` §5「珠子落座」行（**只冻结总时长 120 与起止值 1.06→1.0**）。
 * 本组常量属**表现层动效参数**（同 `WRONG_FX_MS` / `HINT_PULSE_MS` 判例）⇒ 落 `tuning`，
 * **不进 `systems-index §3`**（§3 只承载玩法数值；改冻结常量须走变更单）。
 * ⚠️ 谷值 0.96 与 40ms 分段是 v1.4 新增的 **art-owned 中间插值**（裁定 7：`1.06` = 规格
 *   起点值、**非过冲量**）⇒ 落码不得把 §5 的 `1.06→1.0` 读成「ease-out-back 过冲」。
 */

/** 落座动画总时长（ux-spec §5 冻结值，**不改**）。 */
export const FILL_POP_MS = 120;
/** 压下段时长（`assets-spec §1.6.1` 逐帧分段；§5 未列 ⇒ 不违 §5）。 */
export const FILL_POP_PRESS_MS = 40;
/** 起点 scale（v1.3 既有值；clamp 上界）。 */
export const FILL_POP_SCALE_START = 1.06;
/** 压下谷 scale（t = 40ms；clamp 下界）。全程单调、**不二次过冲**。 */
export const FILL_POP_SCALE_TROUGH = 0.96;
/** L0a 接触阴影 α 峰值（静息 = `BEAD_CONTACT_SHADOW_ALPHA` 0.12；clamp [0.12, 0.18]）。 */
export const FILL_POP_CONTACT_A_PEAK = 0.18;
/** L0a 接触阴影宽比峰值（静息 = `BEAD_CARD.contactW` 0.88）。 */
export const FILL_POP_CONTACT_W_PEAK = 0.92;
/** L0b 柔和投影 α 谷值（静息 = `BEAD_SHADOW_ALPHA` 0.15；clamp [0.12, 0.15]）。 */
export const FILL_POP_SHADOW_A_TROUGH = 0.12;
/** L0b 投影偏移分子谷值（`/64` 归一；静息 = `BEAD_CARD.shadowDy` 的 3）。 */
export const FILL_POP_SHADOW_DY_MIN = 2;
/**
 * 连点**重启门**（= 动画自身长 120ms）：门内到达的新 `bead:placed` **不重启**落座动画。
 * 同族判例 = `WRONG_FX_RESTART_GATE_MS`（500ms）与 ux-spec §5「放错拒绝」行的 500ms 门。
 */
export const FILL_POP_RESTART_GATE_MS = 120;

/* §5 选中抬起斜坡（v1.5-r16 改独立时长）。历史：`bead-visual-style-spec` v1.5-r10（用户
   2026-09-23 裁定「斜坡按 120ms 复用做」）⇒ 本值曾 = `FILL_POP_MS` 以避开新增毫秒值。
   **现解除该裁定**（用户 2026-09-26 要求「回弹 + ease-in-out + 组内错峰」）：回弹需一个
   「过冲→回落」的完整周期，120ms 内两个阶段各只占 40ms ⇒ 不可读；已同步新增 `ux-spec §5` 行。 */
/**
 * 抬起斜坡总时长（含组内错峰展开 + 回弹回落）。
 * ⚠ 错峰 = **同窗口内的相位偏移**（见 `SELECT_LIFT_STAGGER`）⇒ 改本值不会拉长
 *   「从选中到可落」的响应预算（首颗珠仍在 `本值 × (1 − 错峰占比)` 内到位）。
 */
export const SELECT_LIFT_MS = 200;
/**
 * 板锚组抬起位移（设计 px，y 轴向上）。**单一真源在此**：
 * `bead-render.BEAD_CARD.liftRef` 与 view-model 均引用本值，避免“改了抬起量、
 * 三通道响应强度却没跟着改”的静默漂耦。
 *
 * ⚠ **本值 = 静息档（`gridCell = BEAD_CELL = 30`）基准值，不是绝对量**：盘面一切几何
 *（珠体边长 / B0 底图 / 分离影）均比例制，抬起量若不走等比，fit 档上就会“珠抬得更高、
 * 影离得更远”（间隙占格径比例翻倍）⇒ 消费侧乘 `view-model::liftScale = gridCell / BEAD_CELL`，
 * 算式与 `BEAD_DRAW_INSET` 同形（K-077 判例）。恒等档乘子恰为 1 ⇒ 逐位不变。
 */
export const SELECT_LIFT_PX = 6;
/**
 * 托盘 `selected` 抬起位移（§1.2 selected 行既有值 4px，仅从字面量提出）。
 * ⚠ **恒用绝对值、不随 zoom 缩**：托盘带（`TRAY_BAND` / `TRAY_SLOT`）不随棋盘相机变尺，
 * 珠与槽同源 ⇒ 无“与比例制几何同屏对照”的脱钩面（与板上 `SELECT_LIFT_PX` 有意不同）；
 * 且托盘无底图 ⇒ 也不走 `drawLiftGroundShadow`（污渍判例）。
 */
export const TRAY_SELECTED_LIFT_PX = 4;
/**
 * **组内错峰总占比**（v1.5-r16）：组尾比锚点晚起 `本值 × SELECT_LIFT_MS`（= 200 × 0.35 = 70ms）。
 * 走相位偏移而非拉长窗口 ⇒ **零新增毫秒值**（仅上面的 `SELECT_LIFT_MS` 一行需拍板）。
 * 上限 1（= 组尾刚起步时首颗已到位）；0 = 关错峰。取值 `[待真机/playtest]`（半屏大组 24 颗下需看是否偏扰）。
 * 消费者 = `view/scene-vfx.ts::liftStaggerPhase`。
 */
export const SELECT_LIFT_STAGGER = 0.35;
/**
 * **回弹过冲出现点**（总时长比例）与**过冲量**（一次完整抬起的比例）。
 * 峰值 抬起量 = `SELECT_LIFT_PX × (1 + 0.12)` = 6.72px（恒等档）⇒ 仍 < 半格（16px），
 * 不撞 A5 零重叠前提（同 `C5` 的口径：含 `liftScaleGain` 后仍须不越格）。
 * 两个值都是观感量 ⇒ `[待真机/playtest]` 定细档；消费者 = `view/scene-vfx.ts::liftEase`。
 */
export const SELECT_LIFT_PEAK_T = 0.7;
export const SELECT_LIFT_REBOUND = 0.12;

/* v1.5-r16：旧 `easeOutQuad`（注为「选中抬起斜坡专用」）已删 —— 抬起曲线换成 ease-in-out + 回弹
   后它**零消费者**（仓内纪律：不留无消费者常量，判例 = `FACET4_HOLE_RADIUS` 退役）。
   新曲线与逐珠相位住在 `view/scene-vfx.ts`（`liftEase` / `liftStaggerPhase`），与本模块
   `sweepCenterX` 共用已有的 smoothstep，⛔ 不另开一份缓动函数。 */

/* G2′ `vfx_solver_restore` — 解环器归位（WXG-T-150，T-128 动态质感章落码③）。
   规格正本 = assets-spec §1.6.2a；毫秒真源 = ux-spec §5「解环器归位」行
   （**200 + 120/颗、逐颗 80ms 间隔**）⇒ 本组零新造时长、**零 §3 变更**。
   ⚠️ **与 G1/G3/G4 不同口径（诚实登记）**：相 A 的 200ms 不只是观感时长，而是
   **「先预警 → 后动手」的玩法提交时序**（用户 2026-09-17 拍板「甲：归位延后到 200ms 后」）
   ⇒ 它决定 `bead:placed` / 过关判定 / 托盘可取状态的实际发生帧。仍按 §1.6.2a 口径住
   `tuning`（时长真源在 ux-spec §5 而非 §3），但**不得当作纯表现层常量改动**。 */
/** 相 A 高亮预警时长（单峰 `α = sin(π·t/200)`）；**D1 不关停**（纯 α 通道，非形变非位移）。 */
export const SOLVER_HINT_MS = 200;
/** 相 B 逐颗落座时长：**直接复用 G1** `FILL_POP_MS`（不复制值，§1.6.2a「逐字复用 §1.6.1 逐帧表」）。 */
export const SOLVER_PER_BEAD_MS = FILL_POP_MS;
/**
 * 逐颗错开量（ux-spec §5 冻结值 80）——**小于** G1 的 `FILL_POP_RESTART_GATE_MS` 120
 * ⇒ 单槽通道每隔一颗就会被门拑掉（`_armPlaceFx` 头注登记的冲突）。本单解法 =
 * **逐颗队列**（每颗一份 120ms 包络、由 `SOLVER_STAGGER_MS` 错位起播），
 * **不动** G1 的手动连点重启门（那是防连点堆叠的，不是为道具设的）。
 */
export const SOLVER_STAGGER_MS = 80;
/** 一次点名的上限：沿 §3.6 `SOLVER_PLUS_COUNT`（引用冻结值，不新增）。 */
export const SOLVER_MAX_CELLS = SOLVER_PLUS_COUNT;
/**
 * 整条序列总时长 = 相 A + 逐颗错开 `80×(n−1)` + 末颗落座 120（§1.6.2a 相序行）。
 * **单一真源函数**：game 侧用它定计时窗口，view 侧用它把单调标量还原成绝对毫秒
 * ⇒ 不得在两边各写一份公式（漂移先例 = §1.6.4 初稿 `lodLayers` 6 vs 7）。
 */
export function solverSequenceMs(count: number): number {
  const n = count < 1 ? 1 : count;
  return SOLVER_HINT_MS + SOLVER_STAGGER_MS * (n - 1) + SOLVER_PER_BEAD_MS;
}

/* G3 `vfx_powerup_sweep` — 道具生效扫光（WXG-T-146，T-128 动态质感章落码②）。
   规格正本 = assets-spec §1.6.3；毫秒真源 = ux-spec §5「道具生效」行（400ms）。
   同样属表现层动效参数 ⇒ 落 tuning，**不进 systems-index §3**。 */
export const SWEEP_MS = 400;
/** tan(20°)：斜向剪切（非水平带 —— 与 Lv3 burst 的「能量上涌」形态区分）。 */
export const SWEEP_TAN = 0.364;
/** 起点：完全屏外左侧（≥ 广层半宽 105 + 余量）。 */
export const SWEEP_X_FROM = -260;
/** 终点：完全屏外右侧（750 + 广层半宽 105 + 50）。 */
export const SWEEP_X_TO = 1010;
/**
 * 扫光下/上沿。上沿取 `HUD_BAND.yMin` 而**不写字面 1214**（§3.1 顶部 HUD 带为冻结真源）：
 * 用户裁定「全屏」= 玩法全屏 `y∈[0, HUD_BAND.yMin]`，不得侵入 HUD 与胶囊避让区。
 */
export const SWEEP_Y_MIN = 0;
export const SWEEP_Y_MAX = HUD_BAND.yMin;
/** 核心 / 中 / 广（由内向外）；绘制序取**反序**（先广后核心）⇒ 后画的更亮。 */
export const SWEEP_WIDTHS = [36, 84, 210] as const;
export const SWEEP_ALPHAS = [0.14, 0.10, 0.06] as const;

/* G4 `vfx_complete_wave` — 过关庆祝波浪（WXG-T-146，同属 T-128 落码②）。
   规格正本 = assets-spec §1.6.4；毫秒真源 = ux-spec §5「过关庆祝」行（800ms + 20ms/列）。
   ⚠️ `WAVE_BEAD_LOD_LAYERS` = **7** 而**不是** §1.6.4 初稿的 6：v1.5-r6 按 B′ 重算后
   可砍集不得包含 **L11 垫**（垫 = 静态谜面载体，三条理由见§1.6.4 LOD 行）
   ⇒ 保留集 = L0b+L1+L2+L3+L4c ⊕ 垫（**旧文此处还列 L5 符号层**，该层已随
      `bead-visual-style-spec` v1.5-r8（2026-09-23，WXG-T-203 `c8d2fe8`）整层删除
      ⇒ WXG-T-207-A 注释核销；是否因此应重数为 6 = art/QA 另案，本单不动值）。
   ⚠ **层数与渲染基尺无关** ⇒ 本值不随 §3.3 v1.57 复算，`assets-spec §11.2` 图元基线同理。 */
export const WAVE_MS = 800;
export const WAVE_COL_DELAY_MS = 20;
export const WAVE_SCALE_PEAK = 1.08;
export const WAVE_RISE_RATIO = 0.35;
/** 微抬幅度（与 `WRONG_SHAKE_PX` 同量级；单峰非震动）。⚠ **静息档基准值**，同 `SELECT_LIFT_PX`：
 *  实际位移 = 本值 × `gridCell / BEAD_CELL`（`view-model::liftScale`）—— 波浪与珠体/底图同屏对照，不得走绝对值。 */
export const WAVE_LIFT_PX = 3;
/**
 * clamp 下限：逐列窗口 W = max(240, 800 − 20×(N−1)) 在 N ≥ 29 时恒 = **240（触及下限）**
 * ⇒ 大盘下波浪从"递降"退化为"全体同窗口"，观感需复核（v1.37 GRID_MAX 50 同样触底）；
 * 240 兜底仍保留防异常（原注「13 ⇒ W=560」随 §3.3 v1.33 作废）。
 */
export const WAVE_WINDOW_MIN_MS = 240;
/**
 * G4 波浪期的**降档层集标记**（含垫，见上方⚠️）：L0b+L1+L2+L3+L4c + L11（旧文此处还列已删的 L5 符号层）。
 *
 * **WXG-T-211-B1 / §12.2 C7 拆名**：旧名 `WAVE_LOD_LAYERS` 一词两义（本波浪降档 +
 * 下方 zoom LOD 层集共用一个常量），已拆为 `WAVE_BEAD_LOD_LAYERS`（本常量）与
 * `ZOOM_LOD_LAYERS` 两名单值仍是 **7**（值不变更，行为不变，盘面逐帧不变）。
 * 视图侧只判 `!== undefined` ⇒ 数值从不参与算术、纯标记（C7 实测注）。
 */
export const WAVE_BEAD_LOD_LAYERS = 7;
/**
 * ADR-0017 甲案 · zoom 自适应 LOD 的**触发阈值**（工程通道；本轮只落「满层 / 降档」两态）。
 * 触发量 = 珠屏幕径 `layout.cell = BEAD_CELL × zoom` ⇒ 不必给快照新增 zoom 字段。
 *
 * **动因（实测）**：24×31 / 26×26 关在 fit 档每帧 **2833–2953 条绘制命令，与 zoom 完全无关**
 * （视口剔除已落，但 fit 档全盘可见 ⇒ 剔不到）；Node 侧建模仅 0.10 ms/帧 ⇒ 瓶颈在真机
 * canvas 执行那 2900 条命令× 60fps。缩到 0.37（珠 19px）时一半以上质感层本来就分辨不出。
 *
 * 阈值：`BEAD_LOD_CELL` 的出身是**比例**而非绝对地板——取 ADR-0017 建议档起点
 * `zoom 0.9`。故 **§3.8/§3.3 v1.57（WXG-T-207-A）公式化 = `0.9 × BEAD_CELL` = 27**，
 * 与 `BEAD_CELL` **同批提交**（P0：若只翻基尺不翻本值，旧 45 在新尺下永不达标
 * ⇒ **盘面永久降档**，中心孔与质感层集体缺席）。
 * 公式化后降档触发点仍是 `zoom < 0.9`，与旧尺**行为同构** ⇒ `IMPACT-0020a 摘要③`
 * 「LOD 档结构性失效 / 默认视角恒降档」不成立（其前提是把 45 当绝对px，变更单 §7 修正一）。
 * ⚠ 阈值仍未真机验（`ADR-0017` 状态仍 Proposed），且 27 是**格径**而非珠面径
 * ⇒ 「降档时珠面只余 27−2×inset ≈ 19px，可省的层是否还值得省」= `[待真机 + art]`。
 * 降档层集**= `ZOOM_LOD_LAYERS`（7 层，art 已在 WXG-T-146 冻结；C7 拆名后与波浪降档
 * 各自一名、值仍同 7，⛔ 不得据此自造新层集）**；
 * ADR 的中/低三档细分待 art 冻结后再分。红线不变：**L11/B0 目标色底图与 L1c 中心孔
 * 任何档不砍**（旧文此处写的“L5 符号”已随 v1.5-r8 整层删除，见上方核销注）。
 */
export const BEAD_LOD_CELL = BEAD_CELL * 0.9;
/**
 * ADR-0017 zoom 自适应 LOD 的**降档层集标记**（C7 拆名产物：从旧 `WAVE_LOD_LAYERS`
 * 的 zoom 消费者一侧独立命名；值 7 与波浪降档同源同值，去留另见 ADR-0023 §9-1）。
 */
export const ZOOM_LOD_LAYERS = 7;
/**
 * 滞回带宽（ADR-0017 §2.1「滞回必需」）：降档 < 27、升档 ≥ 29.5 ⇒ 阈值附近缩放不闪。
 *
 * ⚠️ **v1.57 裁定 = 保持绝对 2.5，不随基尺派生**（主理人任务单 207-A 口径 = art 起始表
 * `assets-spec §1.10.9`「`BEAD_LOD_HYST` 2.5 不动」）。**诚实登记口径冲突**：变更单 §0.1 曾拟
 * 派生 `BEAD_CELL/20 = 1.5`；采绝对 2.5 后，带宽占格径比例由旧尺 5% 升到 **9.3%**
 * ⇒ 升档点从 `0.95×CELL` 变为 `0.983×CELL`（仍 < 1，不会“升不回去”）。后果可接受且**不阻塞**，
 * 但它是**触控以外的第二个观感项** ⇒ 随 `BEAD_LOD_CELL` 一起挂 `[待真机]`，派生化留另案。 */
export const BEAD_LOD_HYST = 2.5;

/** LOD 滞回状态机（纯函数、可单测）：输入当前珠屏幕径与上帧降档态，输出本帧是否降档。 */
export function nextBeadLod(cell: number, wasLow: boolean): boolean {
  return wasLow ? cell < BEAD_LOD_CELL + BEAD_LOD_HYST : cell < BEAD_LOD_CELL;
}

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
   */
  holeRatio: 0.44,
  /** 孔内壁自阴影的偏移量（半径比例）与 α；光从左上 ⇒ 阴影偏左上，留出右下亮弧。 */
  holeShadeOffset: 0.22,
  holeShadeAlpha: 0.3,
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
  liftShadowFade: 0.4,
  /** 接触阴影收窄（35%）：离地后接触面应变小而不是留着黑块。
   * ⚠ **不衰减它的 α** —— §1.2 已把 L0a 定调为「固定 α 不受 lift 影响」（本批上一版
   *   试图连 α 一起淡掉，被 `§1.2 lift and shadow α` 判据拦下）。只改宽度，不改颜色语义。 */
  liftContactShrink: 0.35,
  /** 侧壁在满抬起时多长出 90%（与上面四通道共用 `liftT` ⇒ 方向一致）。 */
  wallLiftGain: 0.9,
  /**
   * **格级抬起分离影**（§5 空间语言 · 四棱基线补做，正本 = `bead-visual-style-spec §11.6`）
   * —— 宽 / 高 / 偏移一律取**珠体外缘边长 `outer` 的比例**（比率制 ⇒ zoom 档自动跟随，
   * 与 `radius`/`holeRatio` 同族）。
   *
   * 动因：S8 十层退役后默认皮肤 `facet-4` = 6 命令 / **0 真 α** ⇒ 上面 `liftShadow*` /
   * `liftContact*` / `wallLiftGain` 四条通道**在盘面无承载体**（只在 `legacy-ten` 对照臂活着），
   * 玩家实际看到的抬起 = 纯平移 + 4% 放大，斜俯视该有的「影物分离」缺席。
   *
   * ⚠ **影子钉在格面静息足迹上、不随 `lift` 搬家** —— 分离量由「珠升起来露出多少」
   * 几何地长出来，因此**不需要**再给影子配时域曲线（斜俯视里地面的影本来就不跟物体一起动）。
   * 消费方 = `view/bead-render.ts::drawLiftGroundShadow`（仅 `lift > 0` 的选中格调用）。
   */
  liftShadowW: 0.66,
  liftShadowH: 0.2,
  /** 影的水平偏移：光从左上（§6 光向）⇒ 影偏**右**。 */
  liftShadowDx: 0.06,
  /** 影的垂直偏移：落在格心**下方**（设计系 y 向上 ⇒ 调用点取负）。 */
  liftShadowDy: 0.36,
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
   | 孔半径 | 四棱 #6 | ✅ **归位唯一真源** `BEAD_CARD.holeRatio`（§7.11.6「落码以 0.44 为准」）
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
/** 复刻·四棱 #3 右刻面的 `mix(base, −0.16)`（§7.11.1 / §7.12 表外系数）。 */
export const FACET4_FACET_RIGHT_MIX = -0.16;
/**
 * 复刻·四棱四角内缩比 `i2 = 0.09S`（§7.11.1；三角形顶点自格中心收缩量）。
 * ⚠ **WXG-T-211-S4**：`13` 双色对角的对角三角共用**同一个** `i2`（`assets-spec §7.11.6` 把
 * 两者列为同一行：「四棱／`13` 刻面内缩 `i2` = `0.09S`」）⇒ `dual-tone-13.ts` **复用本常量**，
 * ⛔ 不另立同值常量（K-042 真源单一）。
 * ⚠ 命名遗留（已回传，不在本批解）：名字里的 `FACET4` 前缀现在管着两套层集，属历史住址；
 *   改名会牵动风格模块与台账判据的引用面 ⇒ 归后续单独的符号清算批（⛔ 不顺手扩大改动面）。
 */
export const FACET4_FACET_INSET = 0.09;

/* **`13` 双色对角 / `18` 线稿描边风格系数组**（WXG-T-211-S4 / EP11-S4 · §12.9 步 4；C4：逐常量注归属）。
   来源 = `assets-spec §7.11.2 / §7.11.3` 层集正本（逐字抄自 spike `styles.mjs:131-136 / :61-68`
   的**比例**，⛔ 非新造值）；颜色仍走 `palette.ts` 端点与 token（C3 色源唯一，本组只落**系数**）。

   两个关键取值已按正本与任务单已裁口径定死：
   - **孔径不立常量**：`13`/`18` 与四棱同源 = `BEAD_CARD.holeRatio 0.44` ⇒ 半径 `0.22S`
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
/**
 * 裁定 1（用户 2026-09-16）：结算面板**延迟 WAVE_MS 开**——庆祝先行放完再落遮罩。
 * 代价已写入 ux-spec §5（过关到可点按钮多等 800ms）。
 */
export const CLEAR_PANEL_DELAY_MS = WAVE_MS;

/* G7 `vfx_denied_press` — 不可填格轻压（WXG-T-152，T-128 动态质感章落码③·音频原子批）。
   规格正本 = assets-spec §1.6.7；毫秒真源 = ux-spec §5「不可填格轻压」行（120ms，
   复用「珠子落座」行值、**不新造时长**）⇒ 视觉侧零 §3 变更；唯一跨域例外 =
   裁定 3 的 `sfx_denied` 连带 §3.12 `AUDIO_CLIP_TOTAL` 19→20（冻结变更单 v1.26，
   与本组、clip 常量、voice 配方、`SPEC_CLIPS`、`audio-events §1` 表行**同批**，
   拆开即 A05-24 红；解除条件清单见 `audio-events §5` Q-A05-5）。 */
/** 轻压动画总时长（ux-spec §5 冻结值；D1 退化环同窗口，120ms 后由 game 侧清除）。 */
export const DENIED_PRESS_MS = 120;
/** 压下段时长（与 `FILL_POP_PRESS_MS` 同族分段）。 */
export const DENIED_PRESS_TROUGH_MS = 40;
/** 压下谷 scale（与 `FILL_POP_SCALE_TROUGH` 同值；clamp [0.96, 1.00]，起点/终点恒 1.00）。 */
export const DENIED_PRESS_SCALE_TROUGH = 0.96;
/**
 * **同格**重启门（§1.6.7「同格计」⇒ 逐颗独立门，区别于 G1 的全局单槽门）：
 * 不同格的轻压可并存（game 侧走定长槽数组）；同格 250ms ⇒ 每格 ≤4 次/秒。
 * 音频侧 `sfx_denied` 的 `minInterval` **由本值换算**（/1000，不新造数值，裁定 3 / Q-A05-5 ⑥）。
 */
export const DENIED_PRESS_RESTART_GATE_MS = 250;
/** D1（`reduceMotion`）退化态：1px `slot_border` 静态描边环线宽（§1.6.7 `DENIED_RING_LINEWIDTH`）。 */
export const DENIED_RING_LINEWIDTH = 1;
/**
 * 并存轻压的槽容量（**工程容量选择、非规格值**）：§1.6.7 只钉「同格 250ms 门」，
 * 未给并存上限 ⇒ 取 4 覆盖「相邻格快速连扫」的现实上限，占满时逐出最旧起播者。
 * 快照数组按本常量**一次性预分配**（热路径只写值，零分配）。
 */
export const DENIED_MAX_CELLS = 4;

/* G6 `vfx_confetti` — 结算彩带礼花（WXG-T-153，T-128 动态质感章落码④）。
 * 规格卡 = `art/assets-spec.md §1.6.6`；毫秒真源 = `ux-spec §5`「结算彩带」行（800，
 * 复用「过关庆祝」不新造）。零冻结常量：全部住呈现层（§1.6 硬纪律③）。
 * 零 RNG（L4）：44 枚全由 idx 黄金比/黄金角派生，同输入同画面。 */
export const CONFETTI_MS = 800;
/** 总枚数 = 主体 + 前景（回退阀 44→24 本轮不预埋，裁定 5）。 */
export const CONFETTI_COUNT = 44;
/** 主体层（drawClearPanel **之前** ⇒ 被 scrim α0.5 压住，读作「远处彩带」）。 */
export const CONFETTI_MAIN_COUNT = 36;
/** 前景层（drawClearPanel **之后**）；44 − 36。 */
export const CONFETTI_FG_COUNT = 8;
/** 单枚 6×14 px（面积 84px² ≈ 占屏 0.008%，D2 闪烁阈值余量极大）。 */
export const CONFETTI_W = 6;
export const CONFETTI_H = 14;
/** 落程系数 >1 ⇒ 保末帧已出屏。 */
export const CONFETTI_FALL_FACTOR = 1.15;
/** 横向摆动：±18px × 2 周期（叠加旋转致单枚可见面积 1.25Hz < 3Hz 红线）。 */
export const CONFETTI_SWAY_PX = 18;
export const CONFETTI_SWAY_CYCLES = 2;
/** 全场旋转 1.25 转 ⇒ D2 核算基准 1.25Hz。 */
export const CONFETTI_SPIN_TURNS = 1.25;
/** 末段淡出起点（p 比），避免 800ms 硬切。 */
export const CONFETTI_FADE_START = 0.7;
/** 五档错高（idx mod 5），避免齐平下落。 */
export const CONFETTI_SPAWN_STEP_Y = 60;
/** 前景禁飞带（clearPanelLayout 派生：按钮行 yMin 447 / 缎带 yMax 787）；FG 枚入带**跳过绘制**。MAIN 不受限。 */
export const CONFETTI_NOFLY_YMIN = 447;
export const CONFETTI_NOFLY_YMAX = 787;
/** 零 RNG 分布参数（承 `comboParticleOffsets` 判例）：x = 750 × frac(idx × 0.618)；phase = idx × 137.5°。 */
export const CONFETTI_GOLDEN_RATIO = 0.618;
export const CONFETTI_GOLDEN_ANGLE = 137.5;

/** `hint` / 引导脉冲呼吸周期（α 0.5↔1.0，600ms ≈1.67Hz，落 §3.8 ≤3Hz 红线内）。 */
export const HINT_PULSE_MS = 600;
/**
 * 一次性「轻提示」窗口（ux-spec §5「无效落点轻提示」行，WXG-T-097/BD-16）。
 * **不是新数值**：取 §5 表头统一红线「反馈 ≤400 ms」的上界（BD-15 扩展位占位共用同一窗口）。
 */
export const TAP_HINT_MS = 400;
/** 无选中珠点可落空格时的占位文案（`input-control §2.3` 落子前置；文案不属 §3 数值真源）。 */
export const TAP_HINT_NO_SELECTION_TEXT = '先选一颗珠子';
/** 倒计时告急 α 脉冲周期（1→0.6→1，ux-spec §5 / art §7「1000/循环」）。 */
export const DANGER_PULSE_MS = 1000;
/**
 * 托盘满槽告警描边呼吸周期（ux-spec §5「满槽告警」行：500ms/循环，BD-10）。
 * ≈2Hz 落 §3.8 ≤3Hz 红线内；α 幅度沿用 `hud_timer_danger` 同族 0.6↔1.0（不新造第三档，
 * 见 `assets-spec §1.5` `tray_panel_danger`）；`reduceMotion` 下退为静态描边（D1）。
 */
export const TRAY_FULL_PULSE_MS = 500;

/** Fail-panel primary/retry width (ux-spec §3.5: 480×88). */
export const FAIL_PRIMARY_W = 480;
export const FAIL_BUTTON_H = TOUCH_MIN;
export const FAIL_BUTTON_GAP = 24;

// ───────────── 音频 clip id（真源：`design/audio/audio-events.md §1`，共 20 条）
// A05-24：本导出集 **≡ §1 表**（双向无孤儿）；新增音效必须先改 §1 再改这里。
// v1.26（WXG-T-152）：+`sfx_denied`（WXG-T-128 裁定 3，G7 原子批）。
/** BGM clip played with `loop: true` on the bgm channel (architecture §2). */
export const AUDIO_CLIP_BGM = 'bgm_main';
/** UI tap sfx — every panel button uses it（§5 无行 ⇒ 待 Q-A05-1 归位，见 §5 未纳入）。 */
export const AUDIO_CLIP_UI_TAP = 'sfx_ui_tap';
/** 结算星入场音效（ux-spec §5「每星"叮"上行」，逐颗 150ms）。 */
export const AUDIO_CLIP_STAR = 'sfx_star';
export const AUDIO_CLIP_PLACE = 'sfx_place';
export const AUDIO_CLIP_SELECT = 'sfx_select';
export const AUDIO_CLIP_REJECT = 'sfx_reject';
export const AUDIO_CLIP_DISSOLVE = 'sfx_dissolve';
export const AUDIO_CLIP_POWERUP = 'sfx_powerup';
export const AUDIO_CLIP_COMBO_T1 = 'sfx_combo_t1';
export const AUDIO_CLIP_COMBO_T2 = 'sfx_combo_t2';
export const AUDIO_CLIP_COMBO_T3 = 'sfx_combo_t3';
export const AUDIO_CLIP_COMBO_BREAK = 'sfx_combo_break';
export const AUDIO_CLIP_URGENT_BEAT = 'sfx_urgent_beat';
export const AUDIO_CLIP_TRAY_FULL = 'sfx_tray_full';
export const AUDIO_CLIP_STAGE = 'sfx_stage';
export const AUDIO_CLIP_CLEAR = 'sfx_clear';
export const AUDIO_CLIP_PANEL_IN = 'sfx_panel_in';
export const AUDIO_CLIP_PANEL_OUT = 'sfx_panel_out';
export const AUDIO_CLIP_REVIVE_OK = 'sfx_revive_ok';
/** G7 不可填格轻压（WXG-T-128 裁定 3 新增第 20 剪辑；ux-spec §5「不可填格轻压」行 = 权威源）。 */
export const AUDIO_CLIP_DENIED = 'sfx_denied';

// ─────────── §3.12 冻结常量镜像（真源：`gdd/systems-index.md §3.12`，v1.18）
/** 高频短音（`sfx_place`/`sfx_select`）per-clip 最小重触发间隔。 */
export const AUDIO_SFX_MIN_INTERVAL = 0.05;
/** `sfx_reject` 限流 = §3.8「错误反馈 ≤2 次/秒」的音频侧换算。 */
export const AUDIO_REJECT_MIN_INTERVAL = 0.5;
/** 告急心跳周期：**不新造数值** = `TIMER_TICK`（与 §5 视觉 1000ms 脉冲同周期）。 */
export const AUDIO_URGENT_BEAT_PERIOD = TIMER_TICK;
/** 告急心跳派生限流 = 周期 − 0.1s 余量（吸收 fixedStep 尾差，防偶发双拍）。 */
export const AUDIO_URGENT_MIN_INTERVAL = 0.9;
/**
 * 满槽告警防御档。⛔ v1.22 作废死值保留（§3.12g，WXG-T-130 案 A / WXG-T-136）：
 * 触发源 `tray:full` 玩法侧零发射 ⇒ 本间隔无事件可限；死路径保留（供料复活自动
 * 恢复生效）。**不删**——`AUDIO_CLIP_TRAY_FULL` 仍在 A05-24 20-clip 闭合集内，
 * `audio-events §1`（音频域，本单禁改）未删行。
 */
export const AUDIO_TRAYFULL_MIN_INTERVAL = 1.0;
/** 单帧派发上限（框架 `AudioScheduler` 默认值的显式冻结，不传参漂移）。 */
export const AUDIO_MAX_PER_FRAME = 6;
/** 本游 clip 总数（= §1 表行数；A05-24 闭合判据的账目）。v1.26：19→20（+`sfx_denied`，WXG-T-152）。 */
export const AUDIO_CLIP_TOTAL = 20;

// ─────────────────────────────────────────────────────── grid layout derivation
/** Derived geometry for one level's grid, centred inside `PUZZLE_BAND`. */
export interface GridLayout {
  /** Left edge x of column 0. */
  readonly left: number;
  /** Top edge y of row 0 (row 0 is the top row; y grows upward). */
  readonly top: number;
  /** Bottom edge y of the last row. */
  readonly bottom: number;
  readonly cols: number;
  readonly rows: number;
  /** Camera-scaled cell edge (`BEAD_CELL · zoom`; = BEAD_CELL at identity). */
  readonly cell: number;
  /** Camera-scaled grid pitch (`BEAD_PITCH · zoom`; = BEAD_PITCH at identity). */
  readonly pitch: number;
  /** `colCenterX(j) = gridLeft + BEAD_CELL/2 + BEAD_PITCH * j` (§3.3). */
  colCenterX(j: number): number;
  /** `rowCenterY(i) = gridTop − BEAD_CELL/2 − BEAD_PITCH * i` (§3.3). */
  rowCenterY(i: number): number;
}

/**
 * Board-camera state (WXG-T-169 / ADR-0015 丁-3 「布局即相机」).
 *
 * Three scalars: a uniform `zoom` and a design-space `offsetX/offsetY` pan.
 * The camera is folded into `gridLayoutFor` so the grid's centres ARE the
 * on-screen geometry and hit-testing reads the very same numbers — no second
 * coordinate space, no inverse-transform channel (the ADR-0011 offset-bug class
 * stays closed). The authoritative instance is held by the gameplay layer
 * (L5: view + hit-test are read-only consumers).
 */
export interface BoardCamera {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/** Identity camera — `gridLayoutFor(cols, rows, IDENTITY_CAMERA)` equals today's output. */
export const IDENTITY_CAMERA: BoardCamera = { zoom: 1, offsetX: 0, offsetY: 0 };

// ───────────────────────── WXG-T-169 棋盘相机 / 手势工程占位值 ─────────────────────────
// ⚠ 数值**未冻结**：最终档位与阈值属 `systems-index §3` 真源，须走 §3 变更单 + 真机 playtest
//   定值（ADR-0015 §3.4「只交能力不交数值」）。下列仅为「跑得起来 + 口径清晰」的工程占位，
//   QA 不得据本组占位数值造判据。
/** 棋盘区 tap ↔ drag 分界（设计空间 px）：按下到抬起全程 **切比雪夫位移** L∞ = max(|dx|,|dy|) < 此值判为 tap（抬起才提交）；度量形态归 GDD `input-control §2.1` v2.5（WXG-T-171 裁定）。 */
export const BOARD_TAP_MOVE_THRESHOLD = 8; // [待确认]
/**
 * 初始「含边距适配」视图四周留白（设计 px）：把棋盘缩放到正好放进 PUZZLE_BAND 且居中不贴边。
 *
 * **§3.3 v1.57（WXG-T-207-A）由工程占位转正冻结**（旧：仅住本行、带 `[待确认]`、未入 §3 表）。
 * **裁定 = 不随基尺派生**（保持绝对 24）：留边语义属「屏幕呼吸」而非「珠子尺度」；且派生几乎
 * 不买空间 —— 取 `PITCH/2 = 16` 时 `c_max = floor(720/32) = 22`（**列数不变**）、仅 `r_max`
 * 18→19（多 1 行），收益小于把占位值改写的冻结成本（正本变更单 §1.1）。
 * ⚠ 本值是 **§3.3 顶格档算式的分母项**（`c_max = floor((750−2×24+2)/32) = 22`、
 * `r_max = floor((640−2×24+2)/32) = 18`）⇒ 顶格档不能建在未冻结的占位值上，这才是转正的动因。
 * 真机若判「贴边」⇒ 走 §3 变更单，不在本单预登记。
 */
export const BOARD_FIT_MARGIN = 24;
/**
 * 相对「适配 zoom」最多可放大的倍数（缩放上限 = fit × 此值）；下限 = fit（不能再缩到留白更多）。
 *
 * **v1.57 值不动（仍 2.5，仍 `[待确认]`）**，但登记一条既存硬缺陷**随基尺自动消失**：
 * 29×29 盘达到 `zoom = 1` 所需 span = `natH / (640 − 2×24)` 在旧 52 基 = **1506/592 = 2.544**
 * ⇒ `ADR-0018 §4.2-1` 据此判「SPAN=2.5 对 29×29 是硬缺陷、复评须 ≥2.6」；32 基下同一算式
 * = **926/592 = 1.564** ⇒ 余量 60%，**该缺陷不再成立**，`ADR-0018 §5` 复评触发 1 的依据作废
 * （登记于修订注，正本变更单 §1.1 / §3）。本值仍是未冻结占位 ⇒ 转正与否属另案。
 */
export const CAMERA_ZOOM_MAX_SPAN = 2.5; // [待确认]

// ───────────── 棋盘缩放控件（盘面下方净空带 · 工程占位，与上方相机组同口径）─────────────
// ⚠ 数值**未冻结**：与 `CAMERA_ZOOM_MAX_SPAN` 同批属 `systems-index §3` 真源（[待确认]）。
/** 控件条各元素热区边长（= `TOUCH_MIN`，`accessibility C1`「视觉不变、热区扩大」）。 */
export const ZOOM_CTRL_HOT = TOUCH_MIN;
/** 控件条距 `PUZZLE_BAND` 左缘的内边距（设计 px）。 */
export const ZOOM_CTRL_PAD = 12;
/** slider 轨道热区宽（视觉轨道在热区内缩绘制）。 */
export const ZOOM_SLIDER_HOT_W = 240;
/**
 * 控件条与盘带下沿的**让位量**：放大到最大档时，最底行格的命中框会向下外溢
 * `BEAD_HIT_PAD × zoom`（热区不随 `BEAD_CELL` 缩 ⇒ 只随 zoom 缩）= 8 × 2.5 = **20**。
 * 控件条上界 = `PUZZLE_BAND.yMin − 本值` ⇒ 与盘面热区**相切不重叠**（珠子本体永不越带沿）。
 */
export const ZOOM_CTRL_BOARD_CLEARANCE = BEAD_HIT_PAD * CAMERA_ZOOM_MAX_SPAN; // 20

/** 缩放控件几何（渲染 `view-model` 与命中 `beads-game` **单一真源**，`gridLayoutFor` 判例）。 */
export interface ZoomControlLayout {
  readonly reset: { x: number; y: number; w: number; h: number };
  readonly fit: { x: number; y: number; w: number; h: number };
  readonly track: { x: number; y: number; w: number; h: number };
}

/**
 * 缩放控件条：[1:1][适配][slider]，各热区 88×88，**落在盘面以外的底部净空带**（现 y∈[452,540]）。
 * 上沿 = `PUZZLE_BAND.yMin − ZOOM_CTRL_BOARD_CLEARANCE`（与放大态盘热区相切）⇒ 没有一颗珠子的
 * 点击被吃掉；下沿 = 452，距托盘 row0 槽热区顶 444 有 **8px** 富余（`[待真机]`）⇒ 也不抢托盘。
 * 零遮叠 = 本函数存在的意义；不变量钉在 `tests/tuning.test.ts`（符号式，不写快照数）。
 * 事件语义：轨道按下/拖动 → 线性映射 zoom；`reset` → 恒等相机（1.0×）；`fit` → `fitCamera`。
 */
export function zoomControlLayout(): ZoomControlLayout {
  const y = PUZZLE_BAND.yMin - ZOOM_CTRL_BOARD_CLEARANCE - ZOOM_CTRL_HOT;
  return {
    reset: { x: ZOOM_CTRL_PAD, y, w: ZOOM_CTRL_HOT, h: ZOOM_CTRL_HOT },
    fit: { x: ZOOM_CTRL_PAD + ZOOM_CTRL_HOT, y, w: ZOOM_CTRL_HOT, h: ZOOM_CTRL_HOT },
    track: {
      x: ZOOM_CTRL_PAD + ZOOM_CTRL_HOT * 2 + 8,
      y,
      w: ZOOM_SLIDER_HOT_W,
      h: ZOOM_CTRL_HOT,
    },
  };
}

/**
 * Derive the band-centred grid geometry for a `cols × rows` pattern, optionally
 * transformed by a board camera (WXG-T-169 / ADR-0015 丁-3).
 *
 * **本函数零逻辑改动**（§3.3 v1.57）：它已经全量由 `BEAD_PITCH / BEAD_CELL / BEAD_GAP`
 * 派生 ⇒ 换基尺 = 自动等比缩。动的只是下面的注释快照（旧文是 52 基取证，K-053）。
 *
 * Horizontal: centred in 750. Vertical: centred in `PUZZLE_BAND`（现高 560；旧 640，
 * 下沿 480→560 为缩放控件条让高，见 §3.1 行注）。
 * 约束**全部符号化、不写快照数**（§3.3 v1.57 新行）：
 *  `gridLeft ≥ BEAD_CELL/2`（边缘珠外溢不越屏）、`gridTop ≤ PUZZLE_BAND.yMax`、
 *  `gridBottom ≥ PUZZLE_BAND.yMin`、`natH ≤ 带高 − BEAD_CELL`。
 * 旧文「left ≥ 30 容纳到 13 列：(750−674)/2 = 38」与「12 行：1111/489」均为 52 基快照，
 * 随本次改注作废（32 基下 13 列 = `(750−414)/2 = 168`）。
 *
 * **顶格档（`fit = 1` 的最大盘，由 `BOARD_FIT_MARGIN` 而非本函数决定）**：
 *  `c_max = floor((750 − 2×24 + 2)/32) = 22`、`r_max = floor((560 − 2×24 + 2)/32) = 16`
 *  ⇒ 历史：13×11（52 基）→ 22×18（§3.3 v1.57）→ **22×16（盘带下沿抬至 560）**。
 *  守卫断言见 `tests/board-camera.test.ts`「顶格档」例（公式腿 + 字面快照腿双钉）。
 *
 * With `camera` omitted (or identity zoom=1 / offset=0) the produced numbers are
 * **bit-identical** to the pre-zoom version — the level layout, snapshot and
 * every existing assertion must not drift at the identity step (regression anchor).
 * ⚠ 本句只保证**公式同构**，不保证**快照同值**（常量换尺 ⇒ 坐标逐条重 bless）。
 */
export function gridLayoutFor(cols: number, rows: number, camera?: BoardCamera): GridLayout {
  const z = camera ? camera.zoom : 1;
  const ox = camera ? camera.offsetX : 0;
  const oy = camera ? camera.offsetY : 0;
  const pitch = BEAD_PITCH * z;
  const cell = BEAD_CELL * z;
  const width = cols * pitch - BEAD_GAP * z;
  const height = rows * pitch - BEAD_GAP * z;
  const left = (DESIGN_W - width) / 2 + ox;
  const bandMidY = (PUZZLE_BAND.yMin + PUZZLE_BAND.yMax) / 2;
  const top = bandMidY + height / 2 + oy;
  const bottom = top - height;
  return {
    left,
    top,
    bottom,
    cols,
    rows,
    cell,
    pitch,
    colCenterX: (j: number) => left + cell / 2 + pitch * j,
    rowCenterY: (i: number) => top - cell / 2 - pitch * i,
  };
}

/**
 * Nearest grid cell within the (camera-scaled) hit area — the single source of
 * the grid hit test, shared by gameplay (`beads-game::_hitGridCell`) and the
 * layout⇄hit regression test so the two can never drift (WXG-T-169 / ADR-0015).
 *
 * The hit radius **scales with zoom** (`GRID_HIT_SIZE · zoom / 2`). This is not
 * polish: at any zoom the scaled pitch must stay **inside** the scaled hit box, or
 * an unscaled radius would open a no-hit seam between cells and break
 * `input-control §8-2` (nearest-centre wins, no dead zone).
 *
 * ⚠️ **v1.57（WXG-T-207-A）旧注释的 `52z < 66z` / `zoom=1.5 ⇒ pitch 78 > 66` 是 52 基快照**，
 * 随基尺作废。换为与尺子无关的**符号不变式**（§3.8 v1.57，由 `tests/tuning.test.ts` 钉住）：
 * `BEAD_PITCH·z < GRID_HIT_SIZE·z` ⇔ `GAP < 2×BEAD_HIT_PAD` ⇔ `2 < 16` ⇒ **恒真**。
 * Ties → smaller row.
 */
export function hitGridCell(
  layout: GridLayout,
  zoom: number,
  x: number,
  y: number,
): { row: number; col: number } | null {
  const half = (GRID_HIT_SIZE * zoom) / 2;
  let bestRow = -1;
  let bestCol = -1;
  let bestD2 = half * half;
  for (let i = 0; i < layout.rows; i++) {
    for (let j = 0; j < layout.cols; j++) {
      const dx = x - layout.colCenterX(j);
      const dy = y - layout.rowCenterY(i);
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestRow = i;
        bestCol = j;
      }
    }
  }
  return bestRow >= 0 ? { row: bestRow, col: bestCol } : null;
}

// ───────────────────────────────────────────────────────── §3.4 tray layout

/**
 * 托盘面板 / 槽位派生几何（§3.4）。**单一真源**：渲染（`view-model.drawTray`）与
 * 命中（`beads-game._hitTraySlot`）必须共用本函数 —— 各写一份就会出现「画出来的槽」
 * 与「点击落点」不一致的静默漂移（`powerupCardRects()` / `gridLayoutFor()` 判例，
 * WXG-T-062）。
 *
 * 垂直锚定：面板**贴上沿**（v1.20，原「带内居中」）—— 槽簇上移后，带下沿才能
 * 容下 `btn_expand` 的 88 热区而不与槽热区重叠（实测净空 11px）。
 * ⚠ 旧文此处写的是 **62 槽热区**；§3.8 v1.57 公式化后 `TRAY_HIT_SIZE = 60`（−2px）
 * ⇒ 与 `btn_expand` 的既存重叠**变小**（方向利好 v1.42 E2 待验项）。但旧括注的「实测净空
 * 11px」本身是**以 62 为热区量取证的快照数**，换 60 后需重测 ⇒ 不得当作仍成立，`[待真机]`。 */
export interface TrayLayout {
  readonly rows: number;
  /** 槽间距 = `TRAY_SLOT + TRAY_GAP` = 54。 */
  readonly pitch: number;
  /** 一行槽的总宽（12 列 = 642）。 */
  readonly rowWidth: number;
  /** 槽行左缘（水平居中）。 */
  readonly left: number;
  readonly panelX: number;
  readonly panelBottom: number;
  readonly panelW: number;
  readonly panelH: number;
  /** 第 `col` 列槽心 x。 */
  slotCenterX(col: number): number;
  /** 第 `row` 行槽心 y（`row` 0 = 最上排，贴带上沿）。 */
  slotCenterY(row: number): number;
}

export function trayLayout(rows: number, width: number = DESIGN_W): TrayLayout {
  const pitch = TRAY_SLOT + TRAY_GAP;
  const rowWidth = TRAY_COLS * pitch - TRAY_GAP;
  const left = (width - rowWidth) / 2;
  const panelH = rows * pitch - TRAY_GAP + TRAY_PANEL_PAD * 2;
  return {
    rows,
    pitch,
    rowWidth,
    left,
    panelX: left - TRAY_PANEL_PAD,
    panelBottom: TRAY_BAND.yMax - panelH,
    panelW: rowWidth + TRAY_PANEL_PAD * 2,
    panelH,
    slotCenterX: (col: number) => left + TRAY_SLOT / 2 + pitch * col,
    slotCenterY: (row: number) =>
      TRAY_BAND.yMax - TRAY_PANEL_PAD - TRAY_SLOT / 2 - pitch * row,
  };
}

/**
 * `btn_expand` 几何（§3.4 v1.20）：带**下沿**居底，视觉 132×48 居中于 132×88 热区。
 * 热区 = 命中框（`input-control §2.2` 对「按钮类 ≥ 88 用名义框」的例外，依 `accessibility C1`）。
 */
export function expandButtonLayout(): {
  readonly x: number;
  readonly bottom: number;
  readonly w: number;
  readonly h: number;
  readonly hitX: number;
  readonly hitBottom: number;
  readonly hitW: number;
  readonly hitH: number;
} {
  const x = (DESIGN_W - EXPAND_BTN_W) / 2;
  return {
    x,
    bottom: TRAY_BAND.yMin + (EXPAND_BTN_HIT_H - EXPAND_BTN_H) / 2,
    w: EXPAND_BTN_W,
    h: EXPAND_BTN_H,
    hitX: x,
    hitBottom: TRAY_BAND.yMin,
    hitW: EXPAND_BTN_W,
    hitH: EXPAND_BTN_HIT_H,
  };
}

/** One powerup card's rect (`x`/`bottom` = design-space bottom-left corner). */
export interface PowerupCardRect {
  readonly x: number;
  readonly bottom: number;
  readonly w: number;
  readonly h: number;
}

/**
 * 竖向整块的底基准 y：`[标签 28] + [间隔 4] + [卡 116]` 共 148，在带内**整体居中**
 * （带高 152 ⇒ 上下各余 2）。卡底 = 基准 + 标签 + 间隔，标签中心另见 `powerupLabelY()`。
 */
function powerupBlockBaseY(): number {
  const blockH = POWERUP_LABEL_H + POWERUP_LABEL_GAP + POWERUP_CARD_H;
  const bandH = POWERUP_BAND.yMax - POWERUP_BAND.yMin;
  return POWERUP_BAND.yMin + (bandH - blockH) / 2;
}

/** 标签中心 y（§1.4「卡下方标签」，落在卡外、带内）。 */
export function powerupLabelY(): number {
  return powerupBlockBaseY() + POWERUP_LABEL_H / 2;
}

/**
 * The three card rects — the single geometry source shared by
 * `view/view-model.ts` (draw) and the S2 tap router (hit test), so a drawn card
 * can never disagree with where taps land. Cards sit **above** the label row.
 */
export function powerupCardRects(): PowerupCardRect[] {
  const totalW = POWERUP_CARD_W * 3 + POWERUP_CARD_GAP * 2;
  const startX = (DESIGN_W - totalW) / 2;
  const bottom = powerupBlockBaseY() + POWERUP_LABEL_H + POWERUP_LABEL_GAP;
  const rects: PowerupCardRect[] = [];
  for (let i = 0; i < POWERUP_TYPES.length; i++) {
    rects.push({
      x: startX + i * (POWERUP_CARD_W + POWERUP_CARD_GAP),
      bottom,
      w: POWERUP_CARD_W,
      h: POWERUP_CARD_H,
    });
  }
  return rects;
}

/** Tuning bundle handed to the game (mirrors the breakout `BreakoutTuning` shape). */
export interface BeadsTuning {
  readonly width: number;
  readonly height: number;
  /** Sprint run length after C1 validation (out-of-range overrides fall back). */
  readonly sprintTime: number;
}

export const DEFAULT_TUNING: BeadsTuning = {
  width: DESIGN_W,
  height: DESIGN_H,
  sprintTime: SPRINT_TIME_DEFAULT,
};

/** C1 validation: sprint time overrides outside [90, 120] fall back to default. */
export function validatedSprintTime(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return SPRINT_TIME_DEFAULT;
  if (value < SPRINT_TIME_MIN || value > SPRINT_TIME_MAX) {
    return SPRINT_TIME_DEFAULT; // BOOT rejects the override, falls back (score-combo §6)
  }
  return value;
}

// ───── v1.3 丙案几何/α 常量（assets-spec §1.7/§1.8 + art-bible §6；F2/F3/F7/F8）──
//
// 与 WRONG_* 判例同族：**反馈/呈现层参数**，不进 systems-index §3。墨色在 view/palette
//（GLOW_WARM_HEX 等，control-manifest §3：hex 只住 palette）。

// §1.7 拼图容器板 + 暖光 band（F2/F3）。
/** 容器板每边外扩（px）：plate = grid 外扩 2×8。 */
export const PLATE_OUTSET = 8;
/** 容器板圆角（art-bible §6 圆角规范「拼图容器板 20」）。 */
export const PLATE_RADIUS = 20;
/** B4 板投影偏移 (0,−3) / α 0.10（墨复用 BEAD_SHADOW_HEX）。 */
export const PLATE_SHADOW_DY = 3;
export const PLATE_SHADOW_ALPHA = 0.1;
/** 暖光 band：三环 α 由外向内递增（贴板缘累计 ≈0.15，极淡不抢珠焦点）。 */
export const GLOW_BAND_ALPHAS: readonly [number, number, number] = [0.04, 0.05, 0.06];
/** bandOut 上限（§1.7 clamp：不越带、不越屏）。 */
export const GLOW_BAND_OUT_MAX = 18;
/** band 环圆角增量系数（环圆角 = 板圆角 + 外扩量×0.6，art-bible §6）。 */
export const GLOW_BAND_RADIUS_SCALE = 0.6;
/** B6 完成贴纸：板体外扩白描边宽度 / 投影 α（clear 面板可见时叠于板体）。 */
export const PLATE_STICKER_OUTSET = 6;

// §1.8 背景层次（F8）：全屏冷沉 + 中心两档提亮（ΔL ≤4%，禁止暖色入背景）。
export const BG_DEPTH_ALPHA = 0.04;
export const BG_LIFT_RECT = { w: 645, h: 830, radius: 48, alpha: 0.35 } as const;
export const BG_CORE_RECT = { w: 470, h: 620, radius: 40, alpha: 0.3 } as const;

// art-bible §6 HUD：倒计时白胶囊（F7①）+ 设置 8 齿齿轮（F7②）。
export const TIMER_CAPSULE = { w: 220, h: 64, radius: 32 } as const;
/** 胶囊投影偏移 (0,−2) / α 0.10。 */
export const TIMER_CAPSULE_SHADOW_DY = 2;
export const TIMER_CAPSULE_SHADOW_ALPHA = 0.1;
/** 时钟图标外径（环 Ø36 3px，针同色）。 */
export const CLOCK_ICON_DIA = 36;
/** 齿轮：Ø48 = hub r13 + 8 齿线 r13→r21 线宽 6 + 中心孔 r5（F7②）。 */
export const GEAR_TEETH = 8;
export const GEAR_HUB_R = 13;
export const GEAR_TEETH_R0 = 13;
export const GEAR_TEETH_R1 = 21;
export const GEAR_TEETH_W = 6;
export const GEAR_HOLE_R = 5;
