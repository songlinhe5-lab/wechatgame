import { BEAD_DRAW_INSET } from './visual';
import { DESIGN_W, PUZZLE_BAND, TRAY_BAND } from './layout';

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
 * `[WXG-T-235 / 2026-10-03 用户裁定「甲」]` **B0 底图接缝外扩量**（单位：设计px，每边）。
 *
 * ## 要解决的实测现象（不是推测）
 * `zoom 1.0 × dpr 2` 盘面带像素剖面（`temp/tint-wiring/` 截图）实测：
 * 板底 `edge` 色 `(150,71,99) lum 97.8`，而**格边界上出现 1 device px 的亮线**
 * `(172,112,133) lum 132.3`；解混合三通道一致 ⇒ **约 20% 的白面板从相邻两个 B0 rect
 * 的接缝漏上来**（R 需 0.18 / G 0.22 / B 0.22）。
 *
 * 成因：格距在设备像素上多为分数（`gridPitch × zoom × dpr`），相邻 rect 的 AA 边缘各只
 * 覆盖一部分、合计不足 100% ⇒ 缝里透出底下浅色板。⇒ **线的强弱是 `zoom × dpr × 窗口宽`
 * 的相位函数**（用户初判「与放大缩小时采样有关」经实测成立）。
 *
 * ## 为什么两臂都有、且不是 tint 引入
 * 同位置 `?tint=off`（矢量臂）像素分布几乎一致（p99 均 157）⇒ B0 lattice 由
 * `drawTargetTile` 在**两臂共用** ⇒ 既有现象，**不构成 tint 臂的阻塞项**。
 *
 * ## 取值 0.5 的依据
 * 每边 0.5 ⇒ 相邻两格**重叠 1 设计px**。⚠️ **重叠的设备像素 = `zoom × dpr`**（外扩量在设计域，
 * 设计→设备要乘缩放）⇒ 只有 `zoom × dpr ≥ 1` 时才够 1 设备px；`zoom 0.5 × dpr 1` 只有 0.5。
 * ⛔ **本值不能只按「重叠 ≥ 1 设备px」论证**：定点实测 8 点里接缝**只在 `zoom = 1.0`** 出现
 * （那里重叠 = 1.0 / 2.0 设备px），而重叠更小的低 zoom 反而**未检出** ⇒ 「接缝是否出现与
 * `zoom × dpr` 是什么关系」**尚未建立**，不把该机理当已证事实（与同批被推翻的「低倍率最显眼」
 * 同类：机理自洽不等于成立）。要盖住 1 设备px 的 AA 缝，0.5/边是**已实测有效**的取值，
 * 实测到的 1px 缝；再大只会让**相邻异色格**的色界多偏 0.5px（无收益）。
 *
 * ## 为什么不改 `BEAD_GAP`（判例留档）
 * `BEAD_GAP = 2` 治的是**珠与珠之间的缝**；本值治的是**底图与底图之间的缝**，两者层级不同。
 * 改 `BEAD_GAP` 会动 §3 冻结值并波及珠体绘制边长（26dp 口径）⇒ ⛔ 本值**只放大绘制边长、
 * 不动布局格距**（`gridPitch` 语义不变、命中判定不变、封箱快照的 `gridPitch` 逐字节不变）。
 *
 * ⛔ 可视代价：相邻**异色**格的色界位置整体平移 0.5px（同色格完全不可见）。
 */
export const TILE_BLEED = 0.5;
/**
 * Bead edge length（正方形 1:1）。**§3.3 v1.57 由冻结量（旧 50）降为派生量 = 30**；
 * 珠屏幕径 = `BEAD_CELL × zoom`。绘制边长再减 `BEAD_DRAW_INSET × 2`（见 assets-spec §1.10.1
 * 「`stroke()` 的基准是绘制边长、不是格径」）⇒ 新尺静息档 = (30 − 8) = **22** 设计 px。
 */
export const BEAD_CELL = BEAD_PITCH - BEAD_GAP;

/**
 * `[WXG-T-220 / ADR-0025 DEC-2 · WXG-T-221 二批]` 烘焙基准尺寸（px）。
 *
 * 128 = 32dip（`BEAD_PITCH` 整格节距）× 2（dpr cap）× 2.0（`CAMERA_ZOOM_MAX`）—— 用户
 * 2026-09-28 拍板：基准从旧「26dip 珠体边长 ×2×2 + 防截边 pad ≈112」抬到「整格节距 ×2×2 = 128」，
 * 让底图（格面）与珠子在满 zoom + 满 dpr 下都不截边。所有烘焙纹理统一在此尺寸下创建，
 * 消费时由 `blit` 命令缩放到珠体当前视觉尺寸。LRU 缓存键不含本值（schema version 另管）。
 *
 * ⚠ 本值是烘焙管线的「源分辨率」，不是珠体渲染尺寸。渲染尺寸由 `BEAD_CELL` / `TRAY_BEAD_SIZE`
 * / `scale` / `lift` 等动态决定；烘焙纹理在 blit 时按目标尺寸缩放（Canvas2D drawImage）。
 */
export const BAKE_CANONICAL_SIZE = 128;
/**
 * `[WXG-T-226 EP12-B4 / ADR-0029 DEC-4]` tint mask 的**放大回退阈值**（zoom LOD）。
 *
 * 机制（Q4 ③ 裁定）：`mask 绘制设备像素 > MASK_CANONICAL_SIZE × 本值` ⇒ **该帧回矢量臂**，
 * 以满足 `control-manifest §19`「⛔ 运行时放大」——**不靠「显式豁免」绕过**。
 *
 * ⚠ **`null` = 永不回退 = 本批默认**：阈值 `[待真机]`（ADR-0029 DEC-4 明文「不落数值」），
 * 真机测出可接受上限前**不填**。`null` 语义取「永不回退」而非「永不 tint」，是为守住
 * V-5 绿线锚：注入即与今日矢量臂逐字节相同，回退是**显式开启**的阀。
 *
 * 实测算式（blit 矩形边长 = `outer` = `BEAD_CELL 30` ⇒ `30 × zoom × dpr` vs 128）：
 * `dpr = 2` 全区间安全（zoom 2.0 时 120px = 0.94×，只缩不放大）；
 * ⛔ `dpr = 3` ⇒ zoom > **1.42** 即放大（zoom 2.0 时 180px = 1.41× 须回退）。
 *
 * @see `view/bead-tint-mask.ts` 的 `tintUpscaleAllowed()`（纯判据）与 `BeadTintRuntime.allowTint()`（宿主注入口）
 */
export const TINT_LOD_MAX_UPSCALE: number | null = null;
/**
 * `[WXG-T-255 / ADR-0030 §5.5]` **mask 档位宏**（编码切换旋钮，⛔ 不是 §3 冻结数值）。
 *
 * 来历（2026-10-05）：Cocos 构建期只打包**被引用**的资产，四张定稿 mask 里当时只有 `holed` 两张进主包
 * （另两张的唯一引用体是宿主里的 uuid **字符串** ⇒ 依赖分析看不见）。那段窗口期用本宏把运行期钉到
 * `holed` 以解除注入前提；随后用户裁定把 `assets/textures` 配成 Bundle（**引擎侧**目录级全量收录，
 * 压缩类型默认「合并依赖」= 仍留主包本地目录，⛔ 不是微信分包）⇒ `pnpm run build:cocos` 后
 * `pnpm run check:cocos-mask` 实测 **4/4** ⇒ 本宏改回 `null`（债已偿）。
 *
 * 生效面 = `view/bead-tint-mask.ts` 的**查表处**（一处守卫覆盖两宿主 × 两形态，
 * ⛔ 不在 `view-model` 两个调用点各写一遍）；同时驱动两宿主的 **装载/预热/warmup 需求集**
 * （`requiredTintMaskIds()`）。
 *
 * 留作旋钮的用场：想临时比某一档观感 ⇒ 本值改 `'holed'` / `'holeless'`（一行，⛔ 不动调用点）。
 * ⚠ **长期钉住就是债**：两档恒同一张图 ⇒ 未被选中的一对 mask 无消费者，且小豆档（玩家设「小巧」，
 * 非默认档 `BEAD_SIZE_DEFAULT = full`）在 tint 臂与矢量臂（按 `hideHole`）会**观感分叉**。默认档零影响。
 */
export const TINT_MASK_GAUGE_PIN: 'holed' | 'holeless' | null = null;
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
 * 托盘容量**三档**（§3.4 v1.83，用户 2026-10-25 拍板）：**基础 12 → 首次激励视频 24 →
 * 二次激励视频 48，上限 48**。
 *
 * 依据（实测，非估算）：同一 BAC 策略 bot 在三档容量下重跑现池 10 关，基础槽 24→12 后
 * 步数普遍上升（L2 30→64、L8 22→43、L9 183→225），而 24/48 档对多数盘仍显著更低
 * （L2 30/22、L9 183/113）⇒ **容量本身构成一条难度轴**：小关在 12 槽下 2★ 紧平衡、
 * 3★ 需靠扩容（用户口径，已落为定价公式的基准档，见 `measuredLevelTime`）。
 * ⚠ 该轴**不单调**（bot 贪心：L5 48 槽 110 步 > 12 槽 64 步；L3/L7 24 槽略差于 12 槽）
 * ⇒ 用途限于「同一策略的相对读数」，⛔ 不得当「扩容必胜」的依据。
 *
 * 版面：`panelH(rows) = 54·rows + 18` ⇒ 1 行 72 / 2 行 126 / 3 行 180 / **4 行 234 = 带高
 * `TRAY_BAND` 234，恰好铺满、零溢出**（v1.24 定带高时的口径）。`btn_expand` 视觉
 * y∈[236,284] 在 1/2 行态不被压；3 行态压 14dp、4 行态整块覆盖——但 4 行 = 顶档，
 * 按钮本就该消失（`canExpand` 为假）⇒ 该重叠不可达。
 *
 * A1 语义不变：每关内有效、重开/换关重置（`Tray.reset()` 回第 0 档）。
 */
export const TRAY_TIER_SLOTS: readonly number[] = Object.freeze([12, 24, 48]);
/** 基础（未看广告）容量 = 第 0 档 = **12 槽（1 行）**。 */
export const TRAY_BASE_SLOTS = TRAY_TIER_SLOTS[0]!;
/** 顶档容量 = **48 槽（4 行，恰好铺满托盘带）= 广告可解锁的上限**。 */
export const TRAY_MAX_SLOTS = TRAY_TIER_SLOTS[TRAY_TIER_SLOTS.length - 1]!;
/** 可看的扩容广告次数 = 档数 − 1 = **2**（本关内计数，`Tray.reset()` 清零）。 */
export const TRAY_AD_EXPAND_COUNT = TRAY_TIER_SLOTS.length - 1;
/** Slots per tray row. */
export const TRAY_COLS = 12;
/**
 * Slot edge length.
 *
 * **[WXG-T-261 · 2026-10-06 用户裁定「托盘整体放大一些，两边离边缘不要太远 + 格缝加大」]**
 * 推翻 WXG-T-237 v4.0 的「1:1 不缩放」（当时 48→30），**尺回到旧 48/6 系**；但**保留 v4.0 的
 * mask 接线**（托盘槽用盘面 `cell` mask、珠用 `bead` mask，按 `size / BEAD_CELL` 等比缩放，
 * ⛔ 不另建托盘专属 mask）：
 * · `TRAY_SLOT = 48` · `TRAY_GAP = 6` ⇒ `pitch = 54`
 * · 12 列行宽 `12×48 + 11×6` = **642** ⇒ 每边留白 `(750 − 642) / 2` = **54**（v4.0 是 184）
 * · 托盘珠 `outer = TRAY_SLOT` ⇒ 珠面 = `48 − 2×(2×48/30)` ≈ **41.6**（等比内缩，⚠ 不是
 *   `TRAY_BEAD_SIZE` 那条 `48 − 4 = 44`，见其注）
 *
 * ⚠ **负面后果（诚实记，不隐去）**：3 行展开态 `panelH = 3×54 − 6 + 2×12 = 180` ⇒ 面板底
 * y=270 压到 `btn_expand` 视觉框（y∈[236,284]）≈14dp（最深一行**槽**只压 2dp）；2 行基础态
 * `panelH 126` ⇒ 底 y=324 不碰。该重叠在 v1.x 旧尺下同样存在，属在册 **E2 `[待真机]`** 同族，
 * ⛔ 不作本批判据。`systems-index §3` 冻结表随之顶版（§6 变更记录同批登记）。
 */
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
/**
 * **[WXG-T-237 v4.0]** 托盘珠的**名义边长**（不是 `drawFilledBead` 的 `outer`）。
 * `outer` 现取 `TRAY_SLOT`，内缩按 `outer / BEAD_CELL` **等比** ⇒ 实际珠面 = `SLOT − 2×(2×SLOT/30)`
 * ⛔ 本常量是**绝对**内缩 4，故 `SLOT ≠ 30` 时两者不等（SLOT=48 ⇒ 本值 44 vs 珠面 ≈41.6）。
 * 消费面（2026-10-06 grep 实测）= `TRAY_HIT_SIZE` 与 `bead-render.ts` 的 re-export，
 * **绘制路径不读它** ⇒ 本值是「命中框基准」而非视觉尺。
 * ⚠ 原值 44 属「托盘格 48 独立体系」；WXG-T-261 把 `TRAY_SLOT` 回到 48 后本值**随之回到 44**。
 */
export const TRAY_BEAD_SIZE = TRAY_SLOT - 2 * BEAD_DRAW_INSET;
/**
 * Slot gap. **[WXG-T-261 · 2026-10-06 用户裁定「托盘格子之间增加一些间隔」]** = **6**
 * ⇒ `pitch = 54`（v4.0 的 `BEAD_GAP 2` / pitch 32 一并推翻，尺回旧 6/54 系）。
 */
export const TRAY_GAP = 6;
/**
 * 托盘一行（12 列）总宽 = `TRAY_COLS × pitch − TRAY_GAP` = **642**，每边留白 54。
 * 派生自 §3.4 冻结族，⛔ 另硬编 642。
 */
export const TRAY_ROW_WIDTH = TRAY_COLS * (TRAY_SLOT + TRAY_GAP) - TRAY_GAP;
/** 托盘面板竖向内边距（面板高 = rows×54 − 6 + 2×12）。 */
export const TRAY_PANEL_PAD = 12;
/**
 * 托盘**整体宽度**（面板外宽）= `TRAY_ROW_WIDTH + 2×TRAY_PANEL_PAD` = **666**。
 * **[WXG-T-262 三续裁 v1.65]** = fit 档**横向目标宽度**正本：用户裁「（适配）放大效果还是
 * 不够宽，宽度需要对齐托盘整体宽度」⇒ `computeFitZoom` 钉到面板外框（⛔ 不是槽行宽 642）。
 */
export const TRAY_PANEL_WIDTH = TRAY_ROW_WIDTH + 2 * TRAY_PANEL_PAD;
/**
 * `btn_expand` 视觉尺寸（§3.4 v1.20 ← `assets-spec §1.3`：132×48、圆角旧 24）。
 * 热区高 88 来自 `accessibility C1`（48 < `TOUCH_MIN` ⇒ 视觉不变、热区扩大），
 * 二者同心，因此视觉在带下沿居中于热区（y∈[236,284]，热区 y∈[216,304]；
 * **v1.97** 随 `TRAY_BAND` 下沿 230→216 整体 −14，旧读数 [250,298]/[230,318]）。
 */
export const EXPAND_BTN_W = 132;
export const EXPAND_BTN_H = 48;
/** [EP12-S3] 木化 T4 档（tokens.md §2 `radius_btn_small` 16，原 §1.3 胶囊 24 作废）。 */
export const EXPAND_BTN_RADIUS = 16;
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
 * 扩展位占位提示的绘制 y：在 `POWERUP_BAND`（顶 200）与 `TRAY_BAND`（底 216，**v1.97**）
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
 * ⚠ 本值是 **§3.3 顶格档算式的分母项**（旧 `c_max = floor((750−2×24+2)/32) = 22`、
 * `r_max = floor((640−2×24+2)/32) = 18`）⇒ 顶格档不能建在未冻结的占位值上，这才是转正的动因。
 * ⚠ **[WXG-T-262 三续裁 v1.65] 作用域再收窄 = 仅平移夹取窗口项**：fit 档横向目标宽改
 * `TRAY_PANEL_WIDTH`（666，用户裁「对齐托盘整体宽度」）且**高度腿退役**（初屏可不完整，
 * 带外行走既有格心裁除 + 拖动可见）⇒ 本值不再进 `computeFitZoom`；旧 v1.64「仅纵向留白」
 * 口径随之作废。本值**零改动**，⛔ 不得删常量（clampCamera/控件净空等消费面另计）。
 * 真机若判「贴边」⇒ 走 §3 变更单，不在本单预登记。
 */
export const BOARD_FIT_MARGIN = 24;
/**
 * 缩放**绝对倍率**下限（§3.3 v1.59 冻结，WXG-T-217，用户 2026-09-27 拍板）。
 * 取代旧「下限 = fit」口径（`fit` 仅作初始视图，不再是下钳）。
 * 不变式：`CAMERA_ZOOM_MIN ≤ fit ≤ CAMERA_ZOOM_MAX`（**[WXG-T-262 · 用户 2026-10-06 裁「适配/初始 =
 * 整盘放大到左右留空隙」推翻旧 `fit ≤ 1`** ⇒ 小盘 fit 可 >1，顶格档仍恰为 1；最大盘 32×32
 * fit = 512/1022 ≈ 0.501，下界天然成立）。
 * 负面后果如实：小盘可缩至 0.2（22 列盘 ≈140 px 宽、四周大留白），交互合理性 `[待真机 playtest]`。
 */
export const CAMERA_ZOOM_MIN = 0.2;
/**
 * 缩放**绝对倍率**上限（§3.3 v1.59 冻结，WXG-T-217；zoom=1 ⇔ 珠绘制边长恰为静息档 26 设计 px）。
 *
 * **退役 `CAMERA_ZOOM_MAX_SPAN`**（旧口径 `fit × 2.5`，从未冻结占位 ⇒ 退役不涉翻改冻结值）。
 * 现有关卡 `fit` 全 = 1 ⇒ 实盘放大上限由 2.5 **降为 2.0**（用户知情拍板）。[WXG-T-262 注：
 * 本句前提已变 —— 适配档放大后现有关卡初始 fit 全 >1（顶格档除外），上限仍挂本值 ⇒ 初始档
 * 不会越过烘焙/LOD 已覆盖的 ×2.0 档。]
 * 烘焙侧最大档直接挂本值（`BEAD_CELL × CAMERA_ZOOM_MAX`，不再 × fit，保证只缩小不放大，
 * 正本 `proposals/bead-visual-style-spec §13`）；低倍段（0.2–0.7）画质/闪烁验证待
 * `proposals/zoom-bake-mip-validation.md`。
 */
export const CAMERA_ZOOM_MAX = 2.0;
/**
 * 低倍点击门（§3.3 v1.59 新登，**`[待真机]`**，未验前不作 QA 判据）：
 * `zoom < 本值` 时棋盘区 tap **不放珠**，改以点击处为焦点放大到 `zoom = 1`。
 * 理由 = 0.2 档珠热区仅 `GRID_HIT_SIZE × 0.2 ≈ 9` 设计 px 不可命中；
 * 行为正本 = GDD `input-control §2.1`「棋盘区 tap·低倍档」行（v2.11）。
 */
export const ZOOM_TAP_MIN = 0.7; // [待真机]

// ───────────── 棋盘缩放控件（盘面下方净空带 · 与上方相机组同口径）─────────────
// ⚠ `ZOOM_CTRL_HOT` 等几何为工程参；净空公式随 §3.3 v1.59 换源（旧 × SPAN）。
/** 控件条各元素热区边长（= `TOUCH_MIN`，`accessibility C1`「视觉不变、热区扩大」）。 */
export const ZOOM_CTRL_HOT = TOUCH_MIN;
/** 控件条距 `PUZZLE_BAND` 左缘的内边距（设计 px）。 */
export const ZOOM_CTRL_PAD = 12;
/** slider 轨道热区宽（视觉轨道在热区内缩绘制）。 */
export const ZOOM_SLIDER_HOT_W = 240;
/**
 * 控件条与盘带下沿的**让位量**：放大到最大档时，最底行格的命中框会向下外溢
 * `BEAD_HIT_PAD × zoom`（热区不随 `BEAD_CELL` 缩 ⇒ 只随 zoom 缩）= 8 × 2.0 = **16**。
 * §3.3 v1.59：公式换源 `BEAD_HIT_PAD × CAMERA_ZOOM_MAX`（旧 × SPAN = 20）⇒ 控件条整体上移 4px，
 * §3.1 盘带可行区间下界 552→548，现值 560 仍在区间内（两带值不动）。
 * 控件条上界 = `PUZZLE_BAND.yMin − 本值` ⇒ 与盘面热区**相切不重叠**（珠子本体永不越带沿）。
 */
export const ZOOM_CTRL_BOARD_CLEARANCE = BEAD_HIT_PAD * CAMERA_ZOOM_MAX; // 16

/** 缩放控件几何（渲染 `view-model` 与命中 `beads-game` **单一真源**，`gridLayoutFor` 判例）。 */
export interface ZoomControlLayout {
  readonly reset: { x: number; y: number; w: number; h: number };
  readonly fit: { x: number; y: number; w: number; h: number };
  readonly track: { x: number; y: number; w: number; h: number };
}

/**
 * 缩放控件条：[1:1][适配][slider]，各热区 88×88，**落在盘面以外的底部净空带**
 * （§3.3 v1.59 换源后现 y∈[456,544]；旧 × SPAN 口径为 [452,540]）。
 * 上沿 = `PUZZLE_BAND.yMin − ZOOM_CTRL_BOARD_CLEARANCE`（与放大态盘热区相切）⇒ 没有一颗珠子的
 * 点击被吃掉；下沿 = 456，距托盘 row0 槽热区顶 444 有 **12px** 富余（`[待真机]`）⇒ 也不抢托盘。
 * 零遮叠 = 本函数存在的意义；不变量钉在 `tests/tuning.test.ts`（符号式，不写快照数）。
 * 事件语义：轨道按下/拖动 → 线性映射 zoom（绝对档 [CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX]）；
 * `reset` → 恒等相机（1.0×）；`fit` → `fitCamera`。
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
 * 命中（`beads-game/hit-test.hitTraySlot`）必须共用本函数 —— 各写一份就会出现「画出来的槽」
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
  const rowWidth = TRAY_ROW_WIDTH;
  const left = (width - rowWidth) / 2;
  const panelH = rows * pitch - TRAY_GAP + TRAY_PANEL_PAD * 2;
  return {
    rows,
    pitch,
    rowWidth,
    left,
    panelX: left - TRAY_PANEL_PAD,
    panelBottom: TRAY_BAND.yMax - panelH,
    panelW: TRAY_PANEL_WIDTH,
    panelH,
    slotCenterX: (col: number) => left + TRAY_SLOT / 2 + pitch * col,
    slotCenterY: (row: number) =>
      TRAY_BAND.yMax - TRAY_PANEL_PAD - TRAY_SLOT / 2 - pitch * row,
  };
}

/**
 * 虚线预览行是否留位（§3.4 v1.83 三档制的视觉配套）。
 *
 * 判据 = 再加一行后面板底是否仍在 `btn_expand` **视觉框上沿**之上：
 * · 基础档 1 行 + 1 预览 ⇒ `panelBottom 324 ≥ 284` ✅ 留（玩家看得到「还差一行」）；
 * · 24 槽 2 行 + 1 预览 ⇒ `270 < 284` ❌ 不留（会压按钮 14dp，而此刻按钮**必须**可点：
 *   它正是升到 48 槽的入口）。
 * ⛔ 不另硬编 324/270：两侧都由 `trayLayout()` 与 `EXPAND_BTN_*` 派生。
 */
export function trayPreviewFits(unlockedRows: number): boolean {
  const btnTop = TRAY_BAND.yMin + (EXPAND_BTN_HIT_H - EXPAND_BTN_H) / 2 + EXPAND_BTN_H;
  return trayLayout(unlockedRows + 1).panelBottom >= btnTop;
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
