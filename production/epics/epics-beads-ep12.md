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

### EP12-S5 difficultyOf() 难度分单一真源落码 + 守卫

- **描述**：`level-difficulty.md §3` 公式落码（`DI = round₁₀(M × f_C × f_K)`，系数 6 枚 + 钳位 + §3.2 取整口径），住游戏侧单一实现；守卫 G1（单一真源扫描）/ G2（确定性零 RNG，L4）/ G3（取整）/ G4（钳位可达 + 现池无钳位）/ G7（与定价解耦）/ G9（反解自洽）/ G10（双轨解耦）。
- **验收**：① level-difficulty §5 现池 9 关实测表逐值复现（54.3…538.0，Spearman 0.933 校验）；② §7 守卫表对应断言全绿（纯 Node vitest）；③ **零 §3 新增零改动**（§6.1 自证）；④ 门禁⑥（G6：新入关同类内 DI 严格递增，无数值阈值——第五轮终裁）挂 `sync-levels-data` 链。
- **估点**：M。**依赖**：无（纯 Node，可并行）。
- **In/Out**：In = 公式 + 守卫 + 门禁⑥；Out = 定价（`SEC_PER_STEP` 实测轨不动，§1.2 边界）、CH-A/CH-B §3 文字变更（归主理人串行落笔）。

### EP12-S6 主菜单 / boot 屏「拼豆小铺」落码（menu-architecture §5 + screens.md S0 二合一）

- **描述**：R-12 闭合案落码（T-266 §7.2：**不新增独立 boot 屏**，S0 内容就地落已实装 `meta-view` 主菜单）：招牌 `beadText` 点阵珠标题「拼豆小铺」（8×8 字模**纯数据**，只复用珠体绘制、珠面 recipe 零涉）+ slogan「一颗一颗，拼出你的小铺」（令牌读 `tokens.md §7`）+ 木框橱窗作品墙 4×3 可点（已通关 = 珠拼缩略 + 星；未解锁 = 虚线空槽零热区）+ 陈列序 = **DI 升序**（消费 EP12-S5，现池入关序 ≠ 难度序是实测判据）+ 主钮「开始游戏」语义不变 + 次级行 3→2 钮（选关入口隐藏 Q5，代码保留）+ `meta-view.ts:361` 标题改读 `app_name` 令牌（P-7）+ P-5 溢出收敛 / P-6 招牌与资源条重叠实测回填。
- **验收**：① menu-architecture §5.1–§5.4 版面与三条硬口径（主钮 = 当前关、墙格 = 指定关、无第三入口；未解锁格零事件）；② §3.3 陈列序单调（G5：严格递增，tie 关号升序）——复现 §5.2 九关墙序 `L1→L8→L4→L3→L7→L2→L6→L5→L9`；③ 招牌珠距档 d∈[10,15]（§5.3，`CAMERA_ZOOM_MIN` 之上零新绘制通道）；④ **K-6**：招牌/缩略图元数按珠数线性增长 ⇒ K-051 差分复算 + 封箱复评（不预支纸面值）；⑤ boot 入场 200ms 复用（tokens §6 定稿），ux-spec §5 零新增；⑥ 橱窗零新热区（框/纸底不可点）；⑦ `menu:零玩法事件` 用例（menu-architecture §8 下游④，`meta-ui §8-3` 同形状）。
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
| Story 数 | **9**（S1 ✅ 已落码收口 · S2/S3 ✅ 已落码收口（批 3）· S4 ✅ 已落码收口（批 4）· S5 难度真源 · S6/S7 主菜单与陈列 · S8 换肤通道 · S9 studio 导出链） |
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
