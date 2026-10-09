# beads · Epic / Story 拆分 · **EP-12「暖纸拼豆台」UI 风格落地与换肤双面**（epics-beads-ep12）

- **任务**：WXG-T-268 · P0 ｜ **作者**：程基岩（engineering-lead）· 2026-10-07 ｜ **宿主**：[`epics-beads.md`](./epics-beads.md) §1 EP-12 行 + §2 指针
- **权威来源（冲突以此为准）**：`design/proposals/ui-style-redesign/` 四件采纳态（art-bible-proposal / screens / tokens / risks，用户 2026-10-07 裁 D-1「拼豆小铺」/ D-2 甲案 / D-3 boot 随批）· `design/proposals/ui-style-redesign/menu-architecture.md` + `level-difficulty.md`（WXG-T-266 全部 Q1–Q10 已裁）· `design/proposals/skin-system/` 三件（WXG-T-267 架构稿）· `games/beads/design/ux/ux-spec.md` §5（毫秒冻结）· `systems-index §3`（零新增零改动）
- **拆分纪律**：本单判据**只引设计侧既有判据**（art-bible §2 四支柱判读 / §3.1 定稿 HEX 与对比度声明 / screens.md 4 态矩阵与 6 相位 / ux-spec §5 毫秒表 / T-266 难度公式与陈列序律），**零新判据零新数值**；`systems-index §3` 冻结值零涉。
- **范围铁律**：珠面与格面美术不动（art-bible §7 不动项清单；WXG-T-263 蜡笔不入批）。

---

## 0. 阅读约定

1. **Story 四要素** = 一句话描述 / 验收条目（引用式，标真源出处）/ 估点 S·M·L / 依赖；另给 In/Out of Scope。
2. **编号** = `EP12-S1…S9`；状态对账以 `epics-beads-status.md` 惯例为准（本件 newly created，S1 状态 inline 标注）。
3. **估点**：S / M / L 只表相对规模。
4. **环境标注**：`[待真机]` = 无真机不可判；`[待实测]` = 须跑数/差分复算（K-051 禁纸面值）；`[Blocked: 待裁]` = 主理人/用户未裁项。
5. **封箱联动**：凡动 `palette.ts` hex / 容器命令流的 Story，一律走官方复取器复评通道（`bead-style-seal.test.ts` 头注手续 ①–④；现役键 = 第十七次复评 `s3_frame_recheck_17`）。

---

## 1. Epic 列表（拓扑序）

| Epic | 一句话目标 | 覆盖面 | 依赖 Epic |
|---|---|---|---|
| **EP-12** 「暖纸拼豆台」UI 风格落地与换肤双面 | 甲案采纳态全量落码（6 相位换肤 + 主菜单作品墙 + DI 单一真源）+ 换肤双面（游戏内运行时设置项 ① / beads-studio 导出链携带风格 ②） | S3 呈现层 / S9 / S8 / meta / 工程交付（studio） | EP-08、EP-09、EP-11（珠体绘制复用前提） |

> 本 Epic 为**单 Epic 多 Story**（九个 Story 内部拓扑排序，见 §2）；studio 侧（② 裁定）体量若超冲刺，按 S9 独立 Story 标估点与依赖，**不丢弃**。

---

## 2. Story 拆分

### EP12-S1 UI 基础色板换值批 ✅（已随本单落码收口，2026-10-07）

- **描述**：`DEFAULT_PALETTE` 五值替换（`bg_base #F1E8D8` / `panel #FFFCF6` / `panel_border #E6DAC3` / `accent_primary #8A5B34`（并入 wood_face）/ `ad_badge #8A5B34`）+ risks P-1 收编（缩放控件条 slot 族 → panel 族）。纯墨、零几何、零 §3 变更。
- **验收**：① art-bible §3.1 定稿 HEX 逐值对齐（`tests/ui-warm-paper-tokens.test.ts` 消费副本同步门）；② §3.2 B1 对比度脚本复算（textDim on panel **4.64:1 ≥ 4.5** ✓，[待核] 闭合；白 ▶ 对 wood 5.4:1 ✓）；③ §2 治愈②底色饱和度 ≤12%（HSB 10.4% ✓ 脚本复算）；④ §3.1 bg_base 判据奶白珠 ΔL 5.4% > 4% ✓（Rec.601 脚本复算）；⑤ 封箱第十七次复评归因（未解释 0 条、计数零变更）+ 色表锁 35 条 / `612ced0aa888`；⑥ `pnpm run verify` 全量 PASS 21/21。
- **估点**：M。**依赖**：无。
- **In**：上列五值 + P-1。**Out**：`shadow_ink #3D2E1E` 暖化（BEAD_SHADOW_HEX 与珠面 L0b 共用、属 art-bible §7 不动项 ⇒ 归 S2 新 token）；`text_primary` 不改（PANEL_SCRIM_RGB 零变动）；wood/card 族新 token；`[待真机]` 观感项（K-1/K-2）。

### EP12-S2 控件语言落码（T1–T6 容器/按钮语言 + 状态矩阵）✅（已落码收口，2026-10-07 批 3）

> ✅ **状态（2026-10-07 批 3）**：用户裁 **P-3 = 24**（见 §6-4）⇒ 开工阻塞解除，与 S3 同批落码。

- **描述**：art-bible §4 六类图元语言落 `view-model` 通用绘制面：T3/T4 木钮（`wood_face`/`wood_sheen` 1px 顶缘线/`wood_edge` 2px 底缘线/`wood_text`；按下 = y+2px 静态位移 + 投影 α−0.04，零 tween）、T1/T2 纸面（投影 α0.10/0.08 单层柔投影）、T5 纸胶囊、T6 状态描边；新 token（`wood_*` / `card_*` / `text_disabled` / `shadowInk #3D2E1E` 暖化）按消费面入 `palette.ts`（色表锁 +N 走 art 单同步快照通道，R-6 判例）。
- **验收（批 3 实测读数）**：② 灰度可辨 K-4 ✓；③ 每元素 ≤1 投影 + ≤1 内线 ✓；④ ux-spec §5 零新增 ✓；⑤ **第十八次复评**（QA `K.5.1-补10` · provenance 键 18）流级差分两帧同 18 条（插入 3 + 改写 15 · 未解释 0 条）✓；色表锁 35→**46 条 / `68a4b509bb65`**；11 枚新 token 逐值锁 + `cool-violet` 临时别名（史证/既有冷值，零新色相，冷调口径待 S8）。**⚠ 验收①（4 态矩阵）部分兑现**：pressed/disabled 态 token（`woodFacePressed`/`cardPressed` 等）本批**零帧内消费** ⇒ 归 S4（按下/禁用态）收口（**S4 批 4 已收口**：disabled 消费于 fail 主钮；pressed 无快照载体，判交互新增续办）。
- **估点**：M。**依赖**：EP12-S1。
- **In**：token 接口扩展 + 通用绘制面 + `shadowInk` 暖化消费。**Out**：各相位逐页换肤（S3/S4）；P-2 虚线槽双漂移（**不得顺手改**，risks §6）；~~P-3 面板圆角 18 vs 24 收敛（**[Blocked: 待裁]**）~~ → **已裁 = 24**（批 3 代码 18→24 收敛，assets-spec §1.3 漂移销案）。

### EP12-S3 playing 页换肤收口（screens.md S1）✅（已落码收口，2026-10-07 批 3，随 S2 同批）

- **描述**：HUD（齿轮紫不变 + LV 纸 chip 96×48 + 计时纸胶囊几何 220×64 不变）、托盘面板纸化 + 微拱内阴影 ink 暖化（art-bible §5，几何/α 不变）、道具三卡纸化（T2）、`btn_expand` 木化（T4）、告急通道按 **D-5 已裁（2026-10-07）= 计时胶囊恒纸底**落（K-3 回退案即终案：不切纸底、无状态翻转，数字/图标切 danger + 脉冲照旧）。
- **验收（批 3 实测读数）**：① S1 控件逐件对齐 ✓（计时胶囊投影墨暖化、几何/DY/α 不动；**LV 纸 chip 96×48** 新增图元，sprint 分支维持右对齐；托盘 T1 纸化 = 投影 rect + 1px `panelBorder` 描边 + 三段内阴影换墨，`back` 桌面通道随批；`btn_expand` T4 木化 = fill `#8A5B34`、radius 24→16、新增底缘 2px `#5E3B1E`；道具三卡 T2 = 投影 `rgba(61,46,30,0.08)`、描边 `#E6DAC3`）；② 明快⑤ ✓；③ B3 三通道告急不变 ✓（D-5 恒纸底已落）；④ **第十八次复评**登记 ✓（K.5.1-补10，不动项最强反证 = `legacyFlow` 96 + facet 45+45 逐字节零变更）。harness 出图观感：playing/sprint 两帧已核（`temp/wxg-t-211-s3/harness-{playing,sprint}.png`）。
- **估点**：M。**依赖**：EP12-S2。
- **In/Out**：In = S1 相位全部控件换肤；Out = `traySlot #4A5060` / 盘面格底 / 珠面一切（不动项）；~~D-5 未裁前告急切纸底不落码~~（已裁恒纸底，本批即按终案落）。

### EP12-S4 弹窗族换肤（screens.md S2/S3/S4）✅（已落码收口，2026-10-07 批 4）

> ✅ **状态（2026-10-07 批 4）**：三弹窗（paused / level-clear / game-over）容器与控件换肤落码收口；**disabled 态 token 就此消费**（承 S2 §44「归 S4」），**pressed 态**因无快照载体（面板 tap 抬起才提交，`isDown` 仅存 debug 探针不入 `BeadsSnapshot`）判为**交互新增非换肤**，登记续办（见 In/Out）。

- **描述**：paused / level-clear / game-over 三面板纸化 + 主钮木化（T3）+ 开关纸 chip（选中 = 木底白字）+ 行结构零改动（`ux-spec §3.3` S9 单源逐字沿用）。
- **验收（批 4 实测读数）**：① screens.md S2–S4 换肤点逐条 ✓（三面板 = `drawPaperPanel` 暖墨投影 + 1px `panelBorder`；主钮 = `drawWoodButton` T3 `radiusWood` 20；开关 = 纸 chip，选中 `woodFace`+`woodText`、关 `panel`+`panelBorder`+`textDim`；次钮/选择器 = 纸底 + 值字面）；② art-bible §2 休闲③ ✓（danger 仍只在倒计时告急 + 失败页，本批零新增 danger 面）；③ ux-spec §5 毫秒零新增 ✓（面板入 200/出 150 不动，仅换 fill/stroke/radius）；④ `reduceMotion` 退静态 ✓（本批无按下 tween，退静态腿天然满足）。**disabled 消费**：fail 续时主钮 `watchingAd` 走 `woodFaceDisabled` + `woodText`@60%（替旧 α0.35 蒙版 hack）。
- **验证**：beads **853** 全绿（+2 自检：`ui-warm-paper-tokens.test.ts` paused 纸投影+木钮+chip 木底 / fail 禁用真 token+hack 退出）· verify **PASS 22 / FAIL 0** · playing 封箱 frame0 `1325/3269d92b…` · frame78 `1871/749b3ada…` **逐字节 MATCH 零漂**（本批零涉 playing，无封箱复评）· 色表锁 **46 条不动**（零新增 token，全消费既有色）· harness 出图 paused 面板观感已核（`temp/beads-pause-panel.png`）。
- **估点**：S。**依赖**：EP12-S2。
- **In/Out**：In = 三弹窗容器与控件换肤 + disabled 态消费；Out = 行结构/事件/文案（U16 不写死款数）；~~`[Blocked: 待裁]` D-5~~ → **已解除（2026-10-07 用户裁：计时胶囊恒纸底，不切纸底）**；**pressed 态实时视觉 = 输入链新增（touch-down 命中态入快照 + 逐钮命中），⛔ 本批不伪造，登记续办**。

### EP12-S5 difficultyOf() 难度分单一真源落码 + 守卫 ✅（已落码收口，2026-10-07 批 5）

- **状态**：公式落码于 `games/beads/src/game/difficulty.ts::difficultyOf()`（全仓唯一真源）；系数 7 枚住 `tuning.ts::DIFFICULTY`（⛔ 不进 §3，§6.1 自证）；N/C/A/M 复用 `boardStats` 不重造（ponytail 梯 2）；门禁⑥（G6）挂 `sync-levels-data` 链（动态字面 `.ts` import，仅目录模式且有 `difficulty.ts` 生效 ⇒ breakout/单测零牵连）。
- **验收（批 5 实测读数）**：① §5 现池 9 关 DI **逐值复现**（54.3/133.0/89.7/86.3/206.0/143.5/118.9/78.8/538.0，含中间量 A/K/fC/fK 全中）+ 陈列序 = §5.2 九关墙序 `L1→L8→L4→L3→L7→L2→L6→L5→L9` + **Spearman 0.933**（doc tie-break 关号升序；平局平均秩口径下为 0.954，差异纯在 tie-break）✓；② §7 守卫 G1（单一真源扫描）/G2（零 RNG）/G3（取整口径）/G4（钳位可达 + 现池无一触界）/G5（陈列序单调 + 反例）/G6（并列红·node 侧）/G7（与定价解耦）/G9（反解自洽）/G10（双轨零生成器参数）**全绿**✓；③ 零 §3 新增零改动（系数全进 `tuning.ts`，§6.1）✓；④ 门禁⑥（G6：同类内 DI 严格可排、**⛔ 无数值阈值**——第五轮终裁 Q7=③）挂 `sync-levels-data` 链，`node --test` 证有牙✓。
- **验证**：beads **864** 全绿（+11：`difficulty.test.ts` 11 例）· 门禁⑥ node 侧 `sync-levels-data.test.mjs` **10/10**（+3：可排绿/并列红/跨类不红）· verify **PASS 22 / FAIL 0**（含 `levels:check` 带钩跑 G6 + `framework:sync:check` 已同步镜像）· playing 封箱 frame0 `1325/3269d92b…` · frame78 `1871/749b3ada…` **四键逐字节 MATCH 零漂**（难度属数据/逻辑，零涉渲染）· 色表锁 46 不动。
- **估点**：M。**依赖**：无（纯 Node，可并行）。
- **In/Out**：In = 公式 + 守卫 G1–G10 + 门禁⑥；Out = 定价（`SEC_PER_STEP` 实测轨不动，§1.2）、CH-A/CH-B §3/§5.0 文字变更（归主理人串行落笔）、**生成器反解本体**（`DI_START/ΔDI` 仅测试内引用，落码留待 S6 陈列序/造关需求；§4.0 双轨：门禁零引用）。

### EP12-S6 主菜单 / boot 屏「拼豆小铺」落码（menu-architecture §5 + screens.md S0 二合一）🚧（批 6-A 工程切片 + 批 6-B 美术半边均已落 · 真机面未闭合）

> 🚧 **状态（2026-10-07 批 6-B · WXG-T-269-S6 子单 T-2B，承批 6-A/T-2A）**：**双半边已落码**，但 **Story 不宣布闭合**——可 Node 复验面（版面/陈列序/零热区/图元差分/封箱复评/档口径自算）**已达标**；观感与真机性能面仍 `[待真机]`（解除条件见本条末）。
>
> **批 6-B 新增（美术半边落码）**：① **招牌 `beadText` 珠拼** = `view/menu-signage.ts::drawBeadText` + `config/sign-glyphs.ts`（T-1 §1.5 **`10×10 @ d=12`** 位表逐字转写，⛔ 工程侧不自拟字形）；T-2A 的系统字体占位标题已**退场**（实测 `text` 族零增量），文案仍只读 `copy-tokens.app_name`；slogan/version 维持文字令牌。② **作品格珠拼缩略** = `drawLevelThumb`（案乙：缩略区 `THUMB_AREA = WALL_CELL − 8 − 28 = 84`、现装占位格几何不动）+ **5×5 主色块聚合**（`levelThumbCells`，一次性 `WeakMap` 缓存）+ **单格 ≤ 25 珠硬判据**；格内**编号占位已退场**，改「缩略 + 星」；未解锁/越界格仍虚线空槽零热区（沿用 T-2A）。③ **`SIGN_*` / `THUMB_*` 档进 `tuning.ts`**（`Object.freeze`，判例 `DIFFICULTY`/`PAUSE_PANEL_H`）⇒ **零 §3 变更**（自证用例在 `meta-menu-wall.test.ts`）。④ **K-6 取数装置** = `tests/menu-primitives-lib.ts`（共用实现）+ `tests/menu-primitives-capture.ts`（捕获腿，env 门 `WXG269_CAPTURE`）+ `tests/menu-primitives-k6.test.ts`（**实测断言 + 台账回归门**）；台账 `temp/wxg-t-269-s6/t269s6-k6-ledger.json`，已核对副本 `tests/__fixtures__/wxg-t-269-s6-k6-ledger.json`（**入库待主理人批准**）。
>
> **K-6 实测读数（⛔ 非纸面；`risks.md` 旧登记「+77~115 推算」作废；台账已于走马灯改造后重采 `capturedFrom 8514d20a9adf…`）**：⚠ **走马灯改造（menu-architecture §1.3 第五轮）拆两屏**——主菜单主区由整墙→单张卡，墙成本搬 `levels` 选关页。**主菜单生产帧**（满载/首日逐字节等）`total=1145 / beads=148 / kinds{text:9, rect:152, polygon:592, circle:296, line:96}`（= 招牌 148 珠 + 空卡虚线，新档未通⇒卡零缩略珠）；**选关页墙生产基线** `wall.rows3`（满载）`total=1518 / beads=193`（首日 `696 / beads=23 / line 528`）。**Δ招牌 beadText = +1036 命令（148 珠 × 7，菜单腿）**，增量**闭于珠体三族**（rect +148 / circle +296 / polygon +592，`text`/`line` **+0** ⇒ 文字腿确实退场）；**Δ陈列格 3→2 行 = −307**（现量选关页墙帧；首日态 −192 **纯落 `line`**）；**Δ缩略 5→4 = −427（61 珠）/ 4→3 = −378（54 珠）/ 5→3 = −805（115 珠）**（逐级单调）；全回落地板（选关页）`504`。**~~成本比 1.370×~~ 作废**：旧「满载菜单帧 2563 = 1.370× frame78」随整墙搬出菜单而失效 ⇒ 新主菜单 `1145/1871 ≈ 0.61×`、选关页墙 `1518/1871 ≈ 0.81×`（**均 <1**）。
>
> **验收③（珠距档，真几何口径 B）实测**：升档式 `d = ⌊W_avail/(5.5n)⌋` 钳进 `[10,15]` ⇒ `8@15` 面 **11.267** ✓ / `10@12` 面 **8.667** ✓（**采用档**，`n·d = 120` 不变式）/ `12@10` 面 **6.933 < SIGN_FACE_FLOOR 8 ✗** ⇒ 12×12 **不做**（T-1 §1.6 结论被自算式复现）；总宽恒 `5.5·n·d = 660 ≤ 可用 702`（余量 42）。缩略面 `5 档 12.827 / 4 档 16.467 / 3 档 22.533` 全过地板；九关 5 档珠数 `23/23/18/21/24/22/20/19/23` ⇒ **max 24 ≤ 25**、合计 **193 珠 = 1351 命令**（与 T-1 §3.4 表 `Δ5→3 = 115 珠` 逐字相符）。
>
> **验收④（封箱复评）实测**：playing 四键 **逐字节 MATCH** —— frame0 `1325 / 3269d92b5730…`、frame78 `1871 / 749b3ada8368…`；两条独立腿互证（K-6 装置内复取腿 + 官方复取器 `WXG211_CAPTURE=t269s6-seal` 重抓 ⇒ 同四键），加 **import 图静态门**（`view-model.ts`/`bead-render.ts`/`beads-shell.ts`/`beads-game.ts` 零引用 `menu-signage`）⇒ **珠拼/缩略未渗进盘面命令流**（S0 约束⑤ / L5）。
>
> **CONCERNS（诚实登记，⛔ 不假绿）**：① 走马灯改造后主菜单帧 `0.61×` / 选关页墙帧 `0.81×`（**均 <1**，旧 1.37× 作废）⇒ 接受，但**真机抽检**首屏帧率/绘制耗时；② `MENU_TITLE_Y = 1040` 改按**外接框中心**语义后，字框 `[980,1100]` 与 slogan（968，行高 28 ⇒ 顶 ≈990）存 **≈2px 微交** ⇒ 属 ux 版面重排面（T-4），本批**未自改 y**；③ `SIGN_INK_IDX = 0`（art 未定值）⇒ 按 T-1 §1.7 以 `relativeLuminance` 最高 demo 色**确定性派生**，观感 `[待真机]`，art 回写 1..10 即覆盖；④ **8×8 回落档无位表**（T-1 明文不预支）⇒ 杠杆序 5 一旦触发须 art 回单补数据，工程侧已以 `signTierReady(8, 15) === false` 钉住「档变表未跟上先红」；⑤ 新增镜像 3 文件（`copy-tokens`/`sign-glyphs`/`menu-signage`）**无 `.meta`** ⇒ 同 T-2A 的环境阻塞（无编辑器，⛔ 不伪造）；⑥ 台账副本入库待主理人批准。
>
> **`[待真机]` 解除条件（K-044）**：首屏 5s 内可认出「拼豆小铺」· 单色招牌墨在 `bg_base` 上的观感与色差（含 ③ 的索引定值）· 5×5/4×4 缩略能否认出「是这一关的作品」· 菜单帧走马灯改造后 `0.61×`（旧 1.37× 作废）在低端机的实测帧率（触发则按 T-1 §3.8 五级杠杆序 1→5 逐级回落，现量选关页墙帧）· 虚线槽 6/4 的锯齿/AA 观感。`ux-spec §4` 两行回写归 T-4（K-035：本状态行不代述 UX 进度）。

- **描述**：R-12 闭合案落码（T-266 §7.2：**不新增独立 boot 屏**，S0 内容就地落已实装 `meta-view` 主菜单）：招牌 `beadText` 点阵珠标题「拼豆小铺」（8×8 字模**纯数据**，只复用珠体绘制、珠面 recipe 零涉）+ slogan「一颗一颗，拼出你的小铺」（令牌读 `tokens.md §7`）+ 木框橱窗作品墙 4×3 可点（已通关 = 珠拼缩略 + 星；未解锁 = 虚线空槽零热区）+ 陈列序 = **DI 升序**（消费 EP12-S5，现池入关序 ≠ 难度序是实测判据）+ 主钮「开始游戏」语义不变 + 次级行 3→2 钮（选关入口隐藏 Q5，代码保留）+ `meta-view.ts:361` 标题改读 `app_name` 令牌（P-7）+ P-5 溢出收敛 / P-6 招牌与资源条重叠实测回填。
  - ⚠ **走马灯改造（menu-architecture §1.3 第五轮）取代表述中的「主菜单内作品墙」**：主菜单主区→**单张走马灯小卡**（内容 = 闯关进度 + 已通最高 DI 关落位图），**卡 = 菜单唯一选关入口**（点击→`open-levels`，⛔ 不设显性选关钮）；**作品墙整体下移 `levels` 选关 overlay**（同源渲染，选关能力不丢）。上述墙格陈列序/虚线空槽零热区口径**随墙搬至选关页**，仍成立。
- **验收**：① menu-architecture §5.1–§5.4 版面与三条硬口径（主钮 = 当前关、墙格 = 指定关、无第三入口；未解锁格零事件）；② §3.3 陈列序单调（G5：严格递增，tie 关号升序）——复现 §5.2 九关墙序 `L1→L8→L4→L3→L7→L2→L6→L5→L9`；③ 招牌珠距档 d∈[10,15]（§5.3，`CAMERA_ZOOM_MIN` 之上零新绘制通道）；④ **K-6**：招牌/缩略图元数按珠数线性增长 ⇒ K-051 差分复算 + 封箱复评（不预支纸面值）；⑤ boot 入场 200ms 复用（tokens §6 定稿），ux-spec §5 零新增；⑥ 橱窗零新热区（框/纸底不可点）；⑦ `menu:零玩法事件` 用例（menu-architecture §8 下游④，`meta-ui §8-3` 同形状）。
- **验证（批 6-A · 工程半边实测读数）**：① §5.1–§5.4 版面与三条硬口径 ✓（16×16 网格扫面：菜单动作集恰 = `{start, pick-level, open-signin, open-settings}`，`open-levels` 不在场；主钮 = 当前关与墙格解耦）；② 陈列序 ✓：DI 升序索引序 `0,7,3,2,6,1,5,4,8` ⇒ 关号序逐位命中 §5.2 `L1→L8→L4→L3→L7→L2→L6→L5→L9`（DI 现值 54.3/133.0/89.7/86.3/206.0/143.5/118.9/78.8/538.0，本批**不复算公式**；现池 DI **无并列** ⇒ tie-break「关号升序」分支不可达，诚实登记）；⑤ ux-spec §5 零新增 ✓（`meta-view.ts`/`beads-shell.ts` 无任何 duration/tween 字面）；⑥ 橱窗零新热区 ✓（框/纸底/格间隙不入热区表 + 采样点 `hitTestMeta` 为 null、`tapMeta` 返 false）；⑦ 零玩法事件 ✓（惰性面点扫 ⇒ **零任何事件**；菜单侧合法侧效闭集 = `{meta:overlay, stamina:changed}`；含探针自检阳性对照防假绿）。**反例双臂（有牙证明，临时突变已复原）**：视图侧 `levelIdx = slot` ⇒ **3 红**；shell 侧 `levelIdx = slot` ⇒ **2 红**（行为腿「槽 1 → 索引 7」+ 口径①）。读数：beads **895** 全绿（63 files / 2 skipped；新增 `meta-menu-wall.test.ts` **28** 例 + `ui-warm-paper-tokens.test.ts` 橱窗色消费面 +3（13 例）+ `beads-shell.test.ts` 15 例重写口径）· verify **PASS 22 / WARN 0 / SKIP 0 / FAIL 0** · `framework:sync` 镜像 4 文件（`view/meta-view.ts`/`config/tuning.ts`/`game/beads-shell.ts` 改写 + `config/copy-tokens.ts` 新增）`framework:sync:check` 一致 · playing 封箱 `bead-style-seal` **12** 例逐字节 MATCH 零漂 · 色表锁 46 不动 · **零新 hex**（菜单帧全部 fill/stroke ∈ `DEFAULT_PALETTE`）。
- **验证（批 6-B · 美术半边实测读数）**：③ 珠距档 ✓（上列口径 B 自算：采用 `10@12` 面 8.667 ≥ 地板 8，`12@10` 面 6.933 破地板 ⇒ 不做，`d ∈ [10,15]` 由升档式钳位覆盖）；④ **K-6 差分复算 + 封箱复评** ✓（**全为实测**：Δ招牌 +1036 = 148 珠 × 7、Δ格 3→2 −307、Δ缩略 5→4→3 = −427/−378、地板 513；playing 四键逐字节 MATCH；成本比 1.370×）〔⚠ **走马灯改造后重采作废部分读数**：地板 513→**504**、成本比 1.370×→**作废**（新菜单 0.61×/选关页墙 0.81×）；Δ招牌/Δ格/Δ缩略 命令值不变（腿分组重定向至选关页墙帧），正本以本文上方 K-6 行与 `risks.md` §4b 为准〕；增量闭于珠体三族 ⇒ ①​`text` 腿退场、编号占位退场均为**实测事实**而非注释。**反例臂（有牙证明）**：位表**反位**三套（上下/左右/双翻）期望集全部 ≢ 实测，且「移位 ⇔ 非自对称」写成双向恒等式（`豆` 左右自对称 ⇒ h 翻不移位是事实，不是漏网）；给结构自证喂「混入非珠圆」的污染帧 ⇒ **当场 throw**；平票「先见者 ≠ 最小索引」双序对撞 ⇒ 仍取最小 colorIdx。**新增 3 套 49 例**：`menu-signage-beadtext.test.ts` 16（位表完整性/反位/几何/通道对撞/降级臂）· `menu-thumb-primitives.test.ts` 16（切块覆盖与仅覆盖/平票确定性/≤ 25 硬判据含 30×30 大盘/缓存**引用相等**/案乙几何/零命令早退）· `menu-primitives-k6.test.ts` 17（同源自证/台账对撞/三档差分单调/四键/静态 import 图/反例臂）；刷新 `meta-menu-wall.test.ts` 28→**30**（格内编号断言改为**缩略 oracle 逐条 deep-equal** + 阳性对照 + 零新 hex 值域门改用**同通道可发射色集**，⛔ 不列第二份色表）。读数：beads **946** 全绿（66 files / 2 skipped）· verify **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**（含 `check:arch`/`framework:sync:check`/`levels:check`/`check:size`）· 镜像新增 3 + 改写 3（`meta-view`/`tuning`/`beads-shell`）· playing 封箱 `bead-style-seal` **12** 例常驻绿 + 本批官方复取器重抓四键 MATCH · **色表锁 46 条不动、零新 hex、零 §3 变更、零 RNG、菜单帧零 `blit`**。
- **估点**：L。**依赖**：EP12-S2、EP12-S5。
- **In/Out**：In = 上列全部；Out = 走马灯机制（Q9 = carousel 仅在 `n > wall_capacity` 溢出时按 `wall_overflow_mode` 配置生效，9 关现状为单层墙，**本 Story 不实现轮播**）；类别分带（K(n)=0 现状）；`ux-spec §4` 两行回写（T-266 §7.3，归主理人转 UX 轨）。

### EP12-S7 finish 通关画面作品上架陈列条（screens.md S5）

- **描述**：通关时已完成图案逐格摆进与 S0 同源的陈列条（已通关 = 珠拼缩略；未通关 = 虚线空槽），复用 EP12-S6 缩略绘制通道；纯展示零热区零新功能。
- **验收**：① screens.md S5（格 ≤160、条宽 ≤560、落在彩带禁飞带 y∈[447,787] 之外，精确 y 实测回填 `[待实测]`）；② art-bible §1.1 命名语义闭环（S0 空槽在此填满）；③ 零新热区判据 + 图元差分复算（K-6 同面）。
- **估点**：S。**依赖**：EP12-S6。
- **In/Out**：Out = 星级总览数据口径（不变）、彩带/波浪（既有语言不动）。

### EP12-S8 换肤通道批（游戏内裁定①：运行时设置项）

- **描述**：T-267 架构稿 MVP 批 1 收编：`BeadsSkin` 类型 + `src/config/skins/`（`DEFAULT_SKIN` + `warm-paper.ts`，模块级 `Object.freeze`）+ `options.skin` 构造注入（下游 palette 形参通道零改动）+ `settings.skinId` **运行时设置项**（本单裁定①：暂停面板/菜单设置 `cycle-skin` 选择器钮，文案读 `skin.label` 不写死款数）+ `normalizeSettings` 逐字段降级（SAVE_VERSION 不 bump）+ 未注册 id 回落 `DEFAULT_SKIN`（最后防线钉测试）。
- **验收补（2026-10-07 用户裁定 1 追加）**：**`cool-violet` 注册为第二肤**（冷紫灰收编进皮肤池，非退役）——注册表 = `[warm-paper（默认，首位）, cool-violet]`；`cool-violet.tokens` 取值 = EP12-S1 改动前史证（git 对照逐值核对，测试钉住）；注册数 = 2 ⇒ `cycle-skin` 钮 present（`S9§8-19` 守卫语义保留：注册数 ≤ 1 不呈现——从 0→2 是预期行为变化，随批登记）。
- **验收**：T-267 mvp.md 批 1 断言方向 A1–A6（默认肤 seal 逐字节不变 / warm-paper 结构恒等 + sha 归因 / 无模块级 DEFAULT_PALETTE 直引 / 降级四态 / 下一帧生效零过渡 / 热路径零分配探针）+ 本单裁定①（运行时可设）。
- **估点**：L。**依赖**：EP12-S1（值已定稿）；与 T-267 台账**范围交叠**——本批以本单裁定①为准（见回传同步项）。
- **In/Out**：In = 批 1 全量；Out = 批 2 端点系数（另批）、批 3b 珠色映射（须推翻 §1.9.7①，另立 ADR）、批 3c 文案令牌（T-267 已建议不做）。

### EP12-S9 beads-studio 导出链携带风格（生成侧裁定②）

- **描述**：studio 生成 → 导出 → 小游戏在线导入全链路（盘点结论：`server.mjs /api/generate → beads-gen levelDraft → GET /api/results/:id/level → level-import.ts::importLevel()` 先过 `validateBeadsLevel` 再入关表）加**风格字段**：levelDraft schema 增可选 `skin`（值 = 游戏侧已注册皮肤 id 白名单，缺省 `'default'`）+ 前端 `public/index.html` 风格选项 + `server.mjs::importBlockers()` 对未注册 id **不拒收关卡本体**（422 面只增风格告警）+ 游戏侧导入成功后应用 `settings.skinId`（未注册 id ⇒ 回落 `'default'` + 一次性告警，K-064「谎报值不采信」判例形状：游戏侧以**本地注册表**为准复验，不信任自报）。
- **验收**：① 本单裁定②（用户 2026-10-07：导出链路能携带「暖纸拼豆台」风格、与 T-267 皮肤包数据结构接轨——以 `BeadsSkin.id` 为引用键，**不传皮肤数据本体**）；② K-064 反例判据：谎报未注册 skin ⇒ 导入成功但回落 default 且告警；③ `levels-spec §2` 口径零破坏（levelDraft 既有字段逐字节兼容，旧草案无 `skin` 字段照常导入）；④ E2E：POST 生成（选 warm-paper）→ `/level` → `importLevel` 全绿且 `settings.skinId === 'warm-paper'`。
- **估点**：M。**依赖**：EP12-S8（`skinId` 语义与注册表先行）；可先落 schema 与测试桩（标 `[Blocked: 待 S8 注册表]` 的仅应用半边）。
- **In/Out**：In = schema + 前端选项 + 导入消费 + E2E；Out = 部署链（`beads-studio-deploy.yml` 现成，零改动）、生成算法（风格不影响 pattern 生成，零涉）。

---

## 3. 第一个冲刺建议（本单 Sprint-01 已执行）

| 入选 Story | 入选理由 |
|---|---|
| **EP12-S1**（已完成收口） | ① 任务单点名起点 = §3.1 基础色板 token 替换；② **零几何纯墨** ⇒ 封箱通道走最小面（第十七次复评：计数零变更、15 行/帧改写、未解释 0 条）；③ 它是 T-267 批 1（`warm-paper.ts` 取值）与 S2–S4 全部容器批的**值源前提**；④ 全链 Node/vitest 可验 + `verify` 21/21 全绿，无环境阻塞。 |

排除说明：S2 起需新 token 消费面与复评通道再开一轮（增量归因成本），S5 可并行但属独立真源批（不与本批混归因），S6/S8/S9 依赖前两者——均留后续冲刺，**未丢弃**。

---

## 4. 环境约束声明

- **无真机**：一切观感/对比度精确值/图元实测标 `[待真机]`/`[待实测]`；⛔ 不伪造、不假绿（K-1 奶白珠最弱对 / K-2 wood 与赭珠同族 / K-6 图元线性增长三项为真机走查重点）。
- **无 git commit 权限（本单）**：第十七次复评锚 = 工作树态（承键 13/14 同一欠账）⇒ 主理人登记台账并 commit 后，须按复取器头注官方跑法复跑自证等值。
- **镜像纪律**：S1 已按 `games/beads/src ↔ cocos/assets/scripts/game` 成对同步并过 `framework:sync:check`；后续 Story 同此。
- **Cocos 构建基线**：重建必须 `build:cocos --release`（默认 debug 口径在案）。

---

## 5. 统计

| 项 | 数值 |
|---|---|
| Epic 数 | **1**（EP-12，宿主表追加行） |
| Story 数 | **9**（S1 ✅ 已落码收口 · S2/S3 ✅ 已落码收口（批 3）· S4 ✅ 已落码收口（批 4）· S5 难度真源 ✅ 已落码收口（批 5） · S6/S7 主菜单与陈列 · S8 换肤通道 · S9 studio 导出链） |
| 估点分布 | S × 2 · M × 5 · L × 2 |
| 判据来源 | art-bible §2/§3.1/§3.2 · screens.md 全 6 相位与状态矩阵 · ux-spec §5 · T-266 公式与陈列序 · T-267 mvp A1–A6 · 本单裁定①②（用户 2026-10-07）——**零新判据** |
| 待裁项 | P-3 圆角收敛、D-5 告急翻转、art-bible §1.1 橱窗主视觉确认、默认肤语义（见 §0/未决）——**2026-10-07 批 2 状态更新见 §6** |

---

## 6. 未决问题状态（2026-10-07 批 2 更新）

| # | 项 | 状态 |
|---|---|---|
| 1 | **默认肤语义** | ✅ **已裁**：暖纸即默认肤（维持 EP12-S1 落码现状）；**冷紫灰收编为可选肤 `cool-violet`**（注册进皮肤池，非退役）——`cool-violet.tokens` = S1 改动前史证值。S8 验收已补（见 §2）。 |
| 2 | **D-5 告急翻转** | ✅ **已裁**：计时胶囊**恒纸底**（不切纸底，K-3 回退案即终案）——EP12-S4 对应局部阻塞解除（§2 S3/S4 行已改写）。 |
| 3 | **art-bible §1.1 橱窗主视觉** | ✅ **已裁（作废）**：boot/主菜单按 **T-266 作品墙方案**执行（招牌 + 木框橱窗 4×3 作品格 + 木主钮）——`art-bible-proposal.md §1.1` 已就地追加裁定注（正文修订归美术侧林绘澄另批）。 |
| 4 | **P-3 面板圆角（18 vs 24）** | ✅ **已裁（2026-10-07 批 3，用户拍板 = 24）**：以规格值 24 为准 ⇒ 代码 `UI_CONTAINER.radiusPanel` 18→24 收敛，`assets-spec §1.3` v1.5-r3 起的漂移登记**正式销案**（回写注在案）；EP12-S2 阻塞随之解除、与 S3 同批落码。 |
