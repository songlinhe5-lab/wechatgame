# ADR-0028 — 珠面纹理改「灰度 mask × 着色（tint）」：纹理粒度 style×color → style（八裁 = 现行目标路线，实证待 §5 验证批）

- **状态**：**采纳为现行目标路线（仍待 §5 验证批实证）** · 2026-09-28 **八裁**：用户拍板「运行时烘焙暂缓/改道 tint+mask，预制 mask 纹理；旧路线历史归档」（B 案）⇒ 本 ADR 自「候选调研」升为**现行目标路线**，ADR-0025/0027 运行时烘轨转 Superseded（归档不抹除）。⚠ 诚实边界：原条款「采纳/否决须先过 §5 验证批」与「⛔ 验证批出结果前不得引用为已定」**仍然有效**——八裁定的是**路线取向**，T1'–T4'（尤其 T2' wx 侧 multiply/screen 支持面，仓内在役用量=零）**未证不得落码**；§2.4「0025/0027 仍为现行」一句由八裁划除。
- **日期**：2026-09-28 · 执笔：主会话（WXG-T-221 三批延伸）· 委托：用户拍板「起一条 tint 新方案，重新调研」
- **关联**：ADR-0025（§2 备选 C 本案前身，追记 §6-1 重开）、ADR-0027（DEC-6/DEC-7 逐色张数问题 = 本案要消解的对象，追记 §5-8）、ADR-0022（载体② 自定义材质实测在案）、ADR-0019（`BeadMaterial` CPU 参数表，同名不同物消歧先例）、`games/beads/src/view/palette.ts`（端点族真源）、`art/cell-standard.md`（边线/底透口径 SSOT）。
- **证据**：行业调研（2026-09-28 检索）：Unity 移动优化指南官方原话背书「尽可能使用允许在着色器中 tint 的灰度纹理」（限定均匀色对象）；Phaser v4 GradientMap/ColorRamp（2026-03 明文 palette swap 用途）、GameMaker LUT/gradient map shader、Defold gradient map 插件、像素派 LUT 调色板实践（知乎 2D 光照调色板篇）均为**在役先例**；微信生态无平台级 tint 机制（纯工程选型）。

## 1. 上下文（Context）

- **逐色纹理是三份 ADR 里最重的连锁**：ADR-0025 DEC-1 的烘焙 key 带 `colorIdx`、ADR-0027 DEC-6 的 P1/P2/P3 投放档位、DEC-7 的 L1 双张 ≈133.6 KB/色 ⇒ 35 色 ≈4.7 MB [待定]——全部源于「每个颜色一张纹理」。而珠面颜色**不是任意色**：全族由 `palette.ts` 端点族派生，`mix(hex, ±k)` 只走**黑-白轴**（base/edge/pit/lit + facet 系数的固定档）。
- **被否的备选 C 欠一次重估**：ADR-0025 §2 备选 C 否因 = 「纯乘法 tint 不可表达亮端 ⇒ 需双通道模板或自定义 shader」——当时判定复杂度最高而搁置；此后 ADR-0022 §11 已实测**载体②（自定义材质）成立**（+1 draw call 级），且双通道模板存在**数学封闭解**（下 §2）。行业调研（本案 §0 证据）显示平涂参数化变体的标准解恰是这条路。
- **触发时机**：tint 不改变渲染架构主干（烘焙/blit/读序原样），改变的是**纹理寻址粒度**——若成立，DEC-7 内存题与 DEC-6 包体题同时消解，是烘焙管线现行两大 [待定] 的共同上游。

## 2. 决定（Decision，开题裁定 = 成文时点；八裁升格见头部状态行）

**采纳为候选路线并立项验证批（§5），本轮不落码；~~现行主路径仍 = ADR-0025/0027 口径~~（八裁划除：现行目标路线 = 本案，0025/0027 运行时烘轨转历史归档）；⛔ 任何人不得在验证批出结果前引用本案为「已定」（八裁后仍有效：定的是取向，不是实证）。同时明文：ADR-0025 §2 备选 C 的「否」自本 ADR 起改为「重开评估中」。**

### 2.1 核心技术主张（数学封闭解）

端点族每层色 = `mix(base, ±k)`，归一化后：

- 暗端：`base·(1−k)` —— 恒等 = 与常数灰 `d = 1−k` 做 **multiply**；
- 亮端：`base + k·(1−base)` —— 恒等 = 与常数灰 `l = k` 做 **screen**。

烘焙**一张每风格 mask**（无颜色）：RGB 通道存该像素层的 `d`（暗系数），A 通道存 `l`（亮系数）。facet-4 实层核对（`facet-4.ts` 在役配方，系数真数 = `tuning.ts`）：plate `d=1−0.44=0.56`（`FACET4_PLATE_MIX=−0.44`）、FACET_TOP `l=0.38`（`SOCKET_LIT_MIX`）、FACET_LEFT `d=1, l=0`、FACET_RIGHT `d=1−0.16=0.84`（`FACET4_FACET_RIGHT_MIX`）、FACET_BOTTOM `d=1−0.30=0.70`（edge）—— **每层只居暗端或亮端之一，(d,l) 不同时非零**。

- **Canvas2D 两路合成**（harness + wx Canvas 渲染器，现役主路径）：先 `globalCompositeOperation='multiply'` blit d 通道、再 `'screen'` blit l 通道。因 d·l 逐像素不同存非零，两路串行 = `base·d` 后再 screen `l` = `base·d + l(1 − base·d)`；对 l 层（d=1）退化为 `base + l(1−base)` ✓，对 d 层（l=0）= `base·d` ✓ ⇒ **对端点族逐层精确**（唯一误差 = mask 8-bit 量化 ≤0.5/255/通道，ΔE 可忽略但须 T1' 实证）。
- **Cocos 单 pass shader**（载体② 路线，ADR-0022 已实测成立）：`out = base·d + (1−base)·l` 一次采样出全族 ⇒ 命令红利最大化；与两路版观感同源（同 mask）。
  - **Cocos 支持面调研回写（2026-09-28，用户点名）**：通道存在且优于预期——① 官方 API 面：3.8 `Sprite`/UIRenderer 自带 `customMaterial`（官方手册定性「2D 渲染对象自定义材质 = 最佳实践」，shader 内 `cc-sprite-texture` 直接采样）+ `BlendState` 枚举 + `color` 顶点乘色（内置仅乘法半通道）；② 单 pass 式只是 fragment 内三行代数，**连 blend factor 都不依赖**（硬件因子 multiply=`(dst_color, zero)` / screen=`(one, one_minus_src_color)` 另有标准写法备用）；③ 前提不变：`Graphics` 不能画 image 的结构负面仍在（ADR-0025 §4.2），blit 仍需 Sprite 池/载体② 立项——tint 不解决它，只保证立项后立刻可用。

### 2.2 收益（若验证全绿）

| 维度 | 现行（style×color 纹理） | tint 后（style 纹理 + 色参数） |
|---|---|---|
| 烘焙张数 | 每色双张；35 色 ≈70 张 | **每风格 1 张**（珠面+格面各一，与色无关） |
| L1 内存（DEC-7） | ≈133.6 KB/色 ⇒ 4.7 MB [待定] | mask 固定 ≈2 张 ⇒ **逐色维归零，DEC-7 消解** |
| 包体投放（DEC-6） | P1/P2/P3 逐色档位，P3 数学否 | mask 体量恒定（≈2×4–10 KB）⇒ **P 档体系作废** |
| 换肤/新色 | 触发逐色重烘/重投 | **零资产动作**（色 = 运行时参数） |
| 首次烘齐（T6） | N 色 × raster 成本 | 1 次（风格 mask），首屏帧尖峰同维下降 |
| C12/零新 hex | 纹理含色，统计域需重设计（ADR-0027 §4.2） | **mask 无色** ⇒ 主体色 = tint 参数本身，C12 反而可在参数层机械成立；B4 零新 hex 更强 |
| schema 失效面 | colorIdx 参与 key | key 去 colorIdx ⇒ `bakeSchemaVersion` 失效半径缩小 |

### 2.3 代价与边界（诚实登记）

- **命令数回升**：Canvas2D 两路 = 已填格 `blit` ×2（+multiply/screen 状态切换）⇒ ADR-0025 DEC-1 的「3 命令」变 4–5；Cocos 单 pass 可保 1 但依赖 Sprite 池/shader 载体立项（既有负面，非新增）。
- **H-FILL 翻倍风险**：每珠两次全珠面混合（multiply+screen 都是 per-pixel blend），低端机 fill rate 是本案主审项（对照 ADR-0022 H-FILL 假设与 K 族教训）⇒ T4' 实测，不达则两路版整体回退逐色单 blit。
- **wx 支持面未验（2026-09-28 调研后范围改写：从「支不支持」变「支持×好不好用」）**：浏览器主流对 `multiply/screen` 稳定（harness 侧近乎无险）；但 **wx 官方无 globalCompositeOperation 支持清单页**，仅有间接证据（阿里 Mars 项目 iOS 16.4/Android 13 小游戏 Canvas 实测过 multiply/screen 可用，但同文提醒「优先高效模式，复杂效果考虑 WebGL」⇒ 低端实现质量未知）；仓内在役 `globalCompositeOperation` 用量 = **零**（grep 实证）⇒ 无任何自家在案证据，T2' 必测正确性+开销两项，⛔ 纸面判。
- **效果包络 = 黑-白轴**：珍珠虹彩类 `mixWith` 双色轴风格（ADR-0022 已判 CPU 路径原理上做不到）tint **同样做不到**——本案不解决它，只把端点族风格做到 O(1)；将来若有双色轴风格过门禁，需 LUT 变体（1×K 调色条 shader），另立 ADR，⛔ 预铺。
- **AA 边缘一致性**：mask 半透明边界像素在两路合成下的 fringe（`base·d` 与 screen 的 α 交互）与矢量臂/逐色纹理观感是否等价 = T1' 主验项（孔/shadow 本就 live，不入 mask 通道）。
- **孔外缘 ⌀12 / 真透 ⌀10 口径不受影响**：孔 live（ADR-0025 DEC-3）原样；`cell-standard.md` v1.0-r2 的固定 1 dp 边线裁定对 mask 版同样成立（边线在 mask 里 = 固定灰阶，线宽仍 dp 制）。
- **视觉真源不变**：mask 仍由同一份层集配方生成（DEC-4 同源纪律原样），tint 只是把「色」从纹理内容退回参数——真源收敛，不分叉。

### 2.4 与现行两案的关系（不改判，只挂起）

- ADR-0025（运行时烘逐色）**仍为现行**直至 T1'–T4' 出结果；tint 成立则是其 §2 的**新 E′**（同框架、换 key 与 blit 次数）。
- ADR-0027（预烘投放）S3-lite 已产 dev 资产（levels/ 四张 128 PNG）**不废**——它是解剖样张与 P1 兜底的工艺验证；tint 采纳后投放档内容从「逐色 PNG」变「风格 mask PNG」，生成器链路（`bake-recipes.ts`/`bake:check`）直接复用。

## 3. 备选方案（Alternatives，本案内部）

| 方案 | 对比 | 结论 |
|---|---|---|
| 维持逐色纹理（现状） | DEC-6/DEC-7 两大 [待定] 长期在场；P3 类需求数学不可达 | 现行为基线，非终态 |
| **丁｜双通道 mask × 两路合成（Canvas2D 原生）** | 无 shader 依赖、双端（harness/wx Canvas）一致；代价 = +1 blit + 双混合 | **本案主验证对象** |
| 戊｜双通道 mask × 单 pass shader（载体②） | 保 1 blit、fill 最优；依赖 Cocos 材质立项（ADR-0022 门禁在案） | 挂起：等 Cocos 端 blit/Sprite 池立项同批复评（ADR-0025 §5-6 / 0027 §5-7 同一触发器） |
| 己｜LUT（1×K 调色条）泛化 | 覆盖非黑白轴风格；需 shader + 索引量化，复杂度跃升 | 否（YAGNI）：无在册需求风格，触发条件见 §5-3 |

## 4. 后果（Consequences）

**正面**：见 §2.2（若成立 = DEC-7 内存题与 DEC-6 包体题**同时**消解 + 门禁语义简化）。
**负面（本案自身引入的义务）**：
- 验证义务新增 4 项（T1'–T4'，§5），载体并入 `zoom-bake-mip-validation.md`（DEC-8 #7 帧数口径同批重算：已填格 3→4/5 命令的两路版账）。
- mask 的生成/存储需扩一个维度约定（RGB=d、A=l）⇒ `BAKE_SCHEMA_VERSION` 随实现批 bump（与 inset 修复、1dip 边线批可同批，⛔ 拆成三次 bump 三次重烘）。
- 若 T4' 不达而回退，本案全部字节（mask 生成器半成品）须删净，不留「半条 tint 路」——回退预案写死在此。

## 5. 验证批与复评触发（Review Triggers）

**验证批（判据先行，⛔ 纸面判）**：
| # | 判据 | 通过线 |
|---|---|---|
| **T1'** | 两路合成 vs 矢量臂静态等价 | ΔE 容差 = §13.13 T1 同线；重点 = AA fringe 与暗/亮层交界 |
| **T2'** | wx 双端 composite 支持**与质量** | iOS/Android 上屏+离屏 `multiply/screen` 可用、与 harness 同观感、单次 blit 开销可接受（间接证据已登记 §2.3，真机在手三台含 HarmonyOS 档）；仓内在役用量 = 0，⛔ 继承任何「浏览器可用」推定 |
| **T3'** | 命令/带宽账落码实测 | 已填格两路版命令数、GPU blend 次数入 `§13.12` 四帧账重算留痕 |
| **T4'** | 低端机帧时间 | 沿用 T4 判据 C ≥ A×1.5；fill 翻倍是否吃掉命令减半的收益 = 本案生死线 |

1. T1'–T4' **全绿** ⇒ 提请用户裁决采纳 tint（届时 ADR-0025 §2 出 E′、ADR-0027 DEC-6/7 按 §5-8 重算、烘焙 key 去 colorIdx、`BAKE_SCHEMA_VERSION` bump）。
2. T4' 不达 ⇒ 两路版否决，本案仅存戊（shader 单 pass）分支，随 Cocos blit 立项复评（= ADR-0025 §5-6 触发器，不另立）。
3. 风格池出现**非黑白轴**端点需求（珍珠虹彩翻案等）⇒ 复评己（LUT），须另立 ADR。
4. `cell-standard.md` 端点族/边线口径变更 ⇒ mask 通道语义随之重算（本案 §2.1 的逐层核对基于 2026-09-28 现役配方）。
5. wx 基础库若原生提供纹理调色 API（调研时不存在）⇒ 复评合成实现载体。

**执行态（2026-09-29 · r9 批，浏览器通道探针对象 = `temp/tint-probe/`，temp 件不入库、判据只认这里登记的摘要）**：

- **T1' 前置可行性：本地浏览器通道 PASS（非 T1' 本体）**。探针按现树整备（⛔ **口径澄清 2026-09-28 / WXG-T-223**：下句「孔族墨 `mix(base,−0.58)` **不入 mask**、拆为 live 层 A/B 两路同源重放」是本探针的**A/B 整备口径**（为对比两路差异而把孔拆 live 重放），**不是归属裁定**；⛔ 勿据此认为「孔不入 mask」——归属正本 = `bead-visual-style-spec` **B15**（孔边线**入 mask**、`pit` 仍 live）。本会话曾据此误读出「孔不入 mask」并已自纠，留注防复发），关键读数：
  - `[mask-stable] bead PASS / cell PASS` ⇒ 逐色 (d,l) 命令序列全等 ⇒ **mask 与颜色无关**（§2.1 核心主张的直接验证）；
  - `[off-family] PASS 零族外墨`；`[alpha-layers] bead=0 cell=0` ⇒ 两层集 0 真 α；
  - 不透明芯 ΔE：珠面 mean 0.05–0.28 / p95 ≤ 0.62；格面 mean 0.01–0.44 / p95 ≤ 0.57 ⇒ **均达 §13.13 T1 平均线 ΔE<2**；
  - 未达项如实登记：AA fringe 最劣 11.3（> T1「珠边缘 <5」线）；不透明芯 max 4.62（单点族，疑 = mask 8bit 量化尾）；珠面 >2 的芯像素最多 151/14961。
  - **边界**：本探针 = Canvas2D multiply/screen 通道可行性；T1' 本体 = `zoom-bake-mip-validation.md` 五类分桶 × zoom 三档 + 真机口径；T2'–T4' **均未跑**（T2' wx 支持面 = 生死门前置，⛔ 不得由本 PASS 外推）。证据：`temp/tint-probe/results-r9.log` + `shot.png` + `mask-*.png`。
- 其余 T2'/T3'/T4'：未启动；立项与否归用户拍板。

### §5-补：孔内阴影可行性探针（r10 · 2026-09-28，浏览器通道，temp 件不入库）

> 背景：WXG-T-223 空槽内阴影走 tint 时，用户连带裁定**珠孔也要内阴影**（孔底 `pit` −0.44 + 孔口内阴影环 + 方向性）。
> 探针 = `temp/tint-probe/hole-seam-v2.mjs`（干净重写版；同目录 `hole-shade-ab.mjs` 经多轮 patch 已弃用，
> ⛔ 其数据不可引用——本轮曾据它误报「珠面自带 234 亮环」，经裸底基线复测**不存在**，已自纠）。
> 配套出图：`hole-mask-64.mjs` / `hole-mask-128.mjs`（底图 / mask / 融合三张，64 与 128 两尺）。

- **结论（孔内阴影在 tint 制下成立，含四条实现约束）**：
  1. **三段渐变**：径向 沿环带 孔底 −0.44（内端）→ `hole` −0.58（中段最深）→ 珠面 0.84（外端）⇒ **两端都收敛**，
     实测孔口跨越跳变 36 → **5**（合成后），外缘与珠面齐平（差 0）。⇔ **渐变内端必须等于孔底色**，否则孔口必然出现由深变浅的台阶（两段版实测 36）。
  2. **形状通道与压暗通道必须解耦**：收尾 `destination-in` 用珠面轮廓（sil），⛔ 不得用 D 图——D 的 α 若被形状占用，
     环外缘 α 羽化与 mask 透明孔都做不了（上一版 D9 因此失效）。
  3. **mask 的孔中心必须抠成透明圆**：珠面层集的 plate 铺满整块，会把孔填成灰（实测踩到）；孔底由收尾 pit 实色承担 ⇒ mask 孔区 α=0。
  4. **conic 方向调制（screen = 亮端 l）**：暗侧 l=0 保持径向深度、亮侧提亮 ⇒ 深度与方向解耦；⛔ **必须先收窄有效角度（±36°）再加 LMAX**，
     顺序反了会连带洗淡中间方向的深度（实测：收窄前 LMAX 0.6→0.75 最暗 159→175，收窄后 0.85 ⇒ Δ 94→104 且深度不损）。
- **参数档**（2 本仓 dp 环）：D2/D8/D9 对比见 `temp/tint-probe/hole-seam-v2.png`；「深度 ↔ 方向」仍是同一枚硬币（收窄 + 加 LMAX 后双超：最暗 106 / Δ94，均优于偏置环 154/83）。
- **连带**：① mask 语义扩一段「孔口内阴影环」⇒ `BAKE_SCHEMA_VERSION` 需 bump；② 层集需扩 conic/径向渐变图元或由烘焙器在层集外追加（涉及 DEC-4 同源降级，⛔ 需单独裁定）；③ 环宽换算已钉 `cell-standard.md` §1（本仓 dp = 0.5 CSS px，2 本仓 dp = 2–3 物理 px）。
- **边界**：仍是浏览器 Canvas2D；T2'–T4' 未跑；`createConicGradient` 与 `destination-in` 在 wx 侧无在案证据；本项目所有探针数据 ⛔ 不得外推为 wx 已验。
