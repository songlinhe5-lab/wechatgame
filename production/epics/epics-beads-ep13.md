# beads · Epic / Story 拆分 · **EP-13「大关选关页」落码批**（epics-beads-ep13）

- **任务**：WXG-T-284 · P1 ｜ **作者**：程基岩（engineering-lead）· 2026-10-17 ｜ **性质**：**纯计划批** ⛔ 零代码、零 `src/` 改动、零 §3 变更、未 commit ｜ **本批 = 裁定转正收口批**（U-1/U-3/U-4 闭合 · S4 **BLOCKED → READY** · S5 口径同步 · 越 B 门史证外移）
- **Epic 目标（一句话）**：把「主菜单走马灯大关页 →（点橱窗图）→ 本大关关卡列表 →（点格）→ 玩法」这条导航链，按 UX 正本 v1.1+v1.2 的三裁定与 Q13/Q14 续裁**落进代码**，并让「大关」术语在代码标识符层与文档层同批对齐。
- **权威来源（冲突按此序）**：`games/beads/design/gdd/systems-index.md` **§3 冻结常量**（本批零涉）→ `gdd/meta-ui.md` **§2.7 / §6 / §8**（概念正本，Q4/Q5/Q7/Q7-b ⛔ 不推翻）→ `design/ux/arc-level-select-spec.md` **v1.1 + v1.2 订正**（原 `theme-level-select-spec.md`）→ 其分片 **`arc-level-select-spec.s9-history.md` §9 改动面 C-1…C-8** → 本件史证分片 **`epics-beads-ep13.s-history.md`**（只增不改）→ `docs/architecture/control-manifest.md`（L1–L5 + §2/§3/§15）→ ADR-0006 / 0012 / 0015 / 0031。
- **用户已拍板口径（2026-10-16，⛔ 不重开论证）**：① 大关 = 关卡**连续区间**，清单存 `themes.ts` 行内（Q17=甲，大关① 曼陀罗 = 关 1–9，L9 即 boss 收尾，**不新建关**）；② 点橱窗图 = 只列本大关关卡（`levels` overlay 重定义，入口数不变）；③ 点已通关格 = 直接开新局，扣心/弃局逐字沿用 Q7/Q7-b，**零新热区**；④ 0 心点可进格 ⇒ 不进关不扣心 + 拉起既有体力回满激励位（Q13=乙）；⑤ 橱窗三态按大关集合派生（Q16=甲）；⑥ 改名纪律 = 代码标识符与清单字段**同批一次性改**（C-1）。
- **拆分纪律**：验收**只引用** `meta-ui §8-<k>` 与 `tls §4` 矩阵行（记作 `tls §4-R<n>`），**零新判据、零新数值**；口头裁定与正本现文本不一致 ⇒ 标 `[Blocked: 待规格回写]`，⛔ 工程侧不得代裁（K-035）。

---

## 0. 阅读约定

1. **Story 四要素** = 描述 / 验收（引用式）/ 估点 S·M·L / 依赖；另给改动面 `C-#`、In-Out、证据落点、ready 判定。
2. **引用锚的读法（K-046）**：文中 `file:line` 一律指**当前工作树**（2026-10-17 实测），行号会漂 ⇒ 落码前复 grep；`tls §4-R<n>` = §4 矩阵自上而下第 n 行。—— **WXG-T-289 复核**：本件全部锚点与代码对表一致（含 §2-S1 引用点清单）。
3. **估点**：S/M/L 只表相对规模，不折人时。
4. **环境标注**：`[待真机]` = 无真机不可判（不作 DoD 阻塞）；`[Blocked: 待规格回写]` = 已口头拍板但正本现文本仍 `[待裁]`；`[Blocked: 待编辑器]` = 依赖 `.meta`/`.scene`/构建链。
5. **每 Story 公共 DoD（不再逐条重复）**：① `pnpm run verify` 全绿（含 `check:arch`/`check:es5-spread`/`framework:sync:check`/`levels:check`）；② Logic/Integration 有 `games/beads/tests/<name>.test.ts` 且通过（**BLOCKING**）；③ 动 `games/beads/src/**` ⇒ **同批** `framework:sync` 落镜像（pre-commit 硬门，⛔ 镜像拷贝绝不手改）；④ L1–L5 与 §2 热路径零分配自查（overlay 集合重建属「装载期」还是「每帧」必须写明）。
6. **射程外红线**：微信主包 ≤4MB 与内部 2000KB 目标（现超标**已登记发布批**）⇒ ⛔ 减包动作**不得混进**本 Epic；`ux-spec`/`meta-ui`/`tls` 三文的**正文回写**归设计轨，本批只引用。
7. **史证分片** = `production/epics/epics-beads-ep13.s-history.md`：正本越 **8000 tok** B 门 ⇒ 史证段逐字节外移、正本留指针（先例 = `arc-level-select-spec.s9-history.md`；承载清单见该件）⇒ **⛔ 只增不改**（**K-053**）；正本只留**在用**四要素与判据引用。

---

## 1. Epic 列表（拓扑序）

| Epic | 一句话目标 | 覆盖面 | 依赖 |
|---|---|---|---|
| **EP-13** 大关选关页落码 | 大关清单数据化 + `levels` overlay 按大关出格 + 0 心链路 + 走马灯按大关（五腿 READY） | S10 元游戏页族（`meta-ui §2.7`）、S3/S9 呈现与设置面零涉 | **EP12-S6**（走马灯小卡 / `levels` overlay / 墙格几何 = 既有底座）、EP-08（S8 `maxUnlockedLevel`/`starsByLevel` 真源）、EP-09 |

> **Epic 立项两案 · 结论 = 甲案（新 Epic EP-13）**：两案对比整块（含乙案「并入 EP-12 作 S10/S11」的理由与代价）已逐字节外移 → `epics-beads-ep13.s-history.md` §1。留一句理由：**判据真源换了一整条链**（EP-13 权威 = `tls` + `meta-ui §2.7`，与 EP-12 已收口 Story 的对账不可混裁）。两案**均不改动 §2 的 Story 内容与顺序**。

---

## 2. Story 拆分

### EP13-S1 大关表承载关卡清单 + 术语改名同批（**C-1**）

- **描述**：大关表每行新增**关卡清单字段**（连续区间，Q17=甲 ⇒ 大关① 曼陀罗 = 关号 1–9，L9 boss 收尾）；同批把「内容分组」语义的代码标识符一次改到「大关」，并同步全部引用点与镜像。⛔ 不新建关、⛔ 不动 `design/levels/*.json` 与 `manifest.json`、⛔ 不动 `levels-data.ts` 生成链。
- **改动面**：C-1（`src/config/themes.ts` 表 + 头注自陈项「走马灯按关翻页」随 S4 作废）。**实测连带引用点**（逐处核过）：`config/tuning.ts:15,1300,1596`、`game/beads-shell.ts:49,563-564,662,677`、`view/meta-view.ts:87,184,1024`、`dev/harness/main.ts:28,146`、`tests/themes.test.ts`；镜像 5 件（`cocos/assets/scripts/game/` 下 `config/{themes,tuning}.ts`、`game/beads-shell.ts`、`view/meta-view.ts`，与 `host/beads-blit-carrier.ts`）。
- **命名建议（工程侧钉，非设计判据；实现者若变更须回报）**：`ARCS` / `ArcEntry` / `ARC_OPEN_MAX` / `arc.levelRefs: readonly (readonly [from, to])[]`（**1-based 关号**，与 `levels-data.ts` 的 `id` 同轴）。区间 vs 展平 id 清单：推荐**区间**（贴 Q17=甲、校验面更小）。
- **验收（引用式）**：
  - 范围契约 = `tls §8.1 D1`（清单存表、表尾追加、已有 `id` 不改不删）+ `tls §8.1 D9`（术语 = 大关，橱窗展示该大关的 boss 图）。
  - 数据必须能被 overlay 消费成 `tls §4-R2`（越界空槽）与 `tls §4-R12`（清单为空 ⇒ 全槽虚线、零热区、无文字）两态 ⇒ 行为腿在 S2 验，本条验**表侧不变式**：区间连续、落在现池内、跨行不重叠、`id` 稳定。
  - `meta-ui §8-2` **同型引用**：归属只有**一处真源** ⇒ 现池文件零 diff（`git diff --stat games/beads/design/levels/` 为空 = 正面证据）。
  - `meta-ui §2.7`「零 §3 变更、零新常量」⇒ §3 冻结表零 diff + `check:arch` 绿。
- **复用框架**：`DataRegistry` / `compileLevels()` / 关卡装载链**一律不动**（清单只是新增列，不是新数据源）。
- **估点**：**M**（机械但面广：6 源文件 + 5 镜像 + 测试）。**依赖**：无。
- **In / Out**：In = 上列全部代码标识符与字段。**Out** = ① **文档族文件名改名**（原 `theme-level-select-spec(.s9-history).md` → 现 `arc-level-select-spec(.s9-history).md`，含 7 处按名引用）⇒ **已由设计轨「纯改名批」于 2026-10-17 完成，S1 不背该面**（§6.3 U-1 已闭合）；② overlay 出格行为（S2）；③ 走马灯语义（S4）。
- **证据落点**：`games/beads/tests/themes.test.ts`（扩：区间连续性 / 落池内 / 跨行去重 / `id` 稳定 / 表尾追加不破前序行）；改名后全量用例绿 + `framework:sync:check` 一致。
- **ready**：**READY**（Config/Data 类，判据 ≥1 组，边界清晰，类型可判定）。

### EP13-S2 `levels` overlay = 本大关清单 ∩ 解锁闸门（**C-2 ①②④ + C-5**）

- **描述**：进 overlay 时把「当前大关页索引」写进 shell 上下文（现两处入口都**不带**该上下文：`open-levels:360-365` 与 `_releaseGlass:492-504` 只置 `_overlay='levels'`）；墙集合由「全量 `wallSlots`」改「**本大关清单 ∩ 闸门**」；`_rebuildWallSlots` 容量截断按清单长度重算。
- **改动面**：C-2 ①②④（`beads-shell.ts:360-365`、`:492-504`、`_wallSlotsFor/_rebuildWallSlots:582-621`、`_applyMetaAction('pick-level'):373-381` 的映射源）；C-5（`tuning.ts:1419-1440 WALL_*` 的**容量语义注释**随动，⛔ 无新常量；Q12 未触发前不改数值）。
- **工程边界（写明防越界）**：**闸门本身不动**（`tls §8.1 D7` / §4 注 A）⇒ `levelIdx === undefined || levelIdx + 1 > maxUnlockedLevel ⇒ return false` 那一臂**逐字保留**，本条只换**集合来源**。栈深度红线：`_overlay` 是枚举单值、无栈 ⇒ ⛔ 不得为「大关详情中间页」或「列表内叠 overlay」开口子（`tls §2`）。
- **验收（`tls §4` 逐行 ⇒ 每行可直转 QA 用例）**：R1 未解锁格（零事件、零扣心、虚线空槽）｜R2 越界空槽（**逐字同判据**，同一闸门臂）｜R3 已解锁未通关格（扣 1 心 + 切屏 + `goToLevel(idx)`）｜**R4 已通关格 = 直接开新局**（同一入口、同一扣心、⛔ 无二次确认、⛔ 无长按、⛔ 无新热区、`stars[idx] = max(旧,新)`）｜R5 当前关格（与 R3/R4 **可叠加**，非互斥）｜R8 `back` → 主菜单且**大关页仍停 T**｜R9 面板外零响应｜R10 棋盘区 drag/捏合零相机变化｜R11 本页**无**翻页输入（换大关必 `back`）｜R12 空清单态。
  联合引用：`meta-ui §8-3`（页族零玩法事件，作用于 R1/R2/R9/R10/R12 这些**不进关**的行）、`§8-4`（相机旁路）、`§8-5`（启动红线：落地页 ⛔ 不得判为选关页）、`§8-7`（体力形态不变式：一格 = 一次新局 ⇒ 恰扣 1 心）。
- **复用框架 / 既有码**：`levelsLayout`/`pushWallCells` 几何与 `slot` 间接层（视图 ⛔ 拿不到也不该拿关索引，契约不变）、`hitTestMeta`、`buildMetaView`、`goToLevel`、`meta:overlay` 事件形状（⚠ 字段名 `id` vs `name` 漂移已在册 = **U-2**，不入射程；本条 ⛔ 不新增事件、不自造 payload）。
- **估点**：**M**。**依赖**：EP13-S1。
- **In / Out**：In = arc 上下文 + 集合来源 + 容量重算。Out = 走马灯语义（S4）、0 心反馈（S3）、按下态（S5）、**Q12 清单 >12 的分页/滚动机制**（本版 9 ≤ 12 不触发 ⇒ ⛔ 不预写机制，`tls §8.2 TODO-2`）。
- **证据落点**：`tests/meta-menu-wall.test.ts`（集合断言**换形**：从「全量墙」到「本大关清单」）+ 新建 `tests/arc-level-select.test.ts`（R1–R5/R8–R12 逐行 + **反例臂**：非本大关的关不得出现在本页；`levelIdx = slot` 的「按槽当关」回归必红）。
- **ready**：**READY**。

### EP13-S3 0 心点可进格 → 不进关不扣心 + 拉起既有体力回满激励位（**C-4**，Q13=乙）

- **描述**：`_startLevel`（`beads-shell.ts:327-334`）的静默 `return false` 改为「**留本页 + 请求既有回满位**」；激励位内容零改动、零新数值。现码该落差 = `ux-spec §6.3` 债 B「未闭」的直接对象（`tls §8.2 TODO-3`）。
- **改动面**：C-4。**通道形态已裁 = 乙**（用户 2026-10-17 ⇒ U-3 闭合）：shell 直取 `services.rewardedAd.load(STAMINA_REFILL_PLACEMENT)+show()`，`onRewarded` → `meta.refillStamina()`（⛔ 不碰 play 态；代价 = 新增第二个广告订阅点 ⇒ 下方串道反例仍为 **DoD 硬项**）。甲案（未采纳）旧正文 = `…s-history.md` §5。
- **⚠ 已确诊风险（本条必须自带反例断言，实测取证非推演）**：`RewardedAdProvider.onRewarded` 是**广播**（`platform/rewarded-ad.ts:85-88` 遍历全部订阅者），而 play 的 `_onAdRewarded()` 在 `_adKind === null` 时落到 `_continueFromReward()` = **revive 腿**（`beads-game.ts:3043-3065`，守卫只有 `machine.current === 'game-over'`）；`showMenu()`（`:311-315`）**不重置玩法状态机** ⇒ 存在真实串道路径：「上一局 GAME_OVER → 回主菜单 → 0 心点格看广告 → 被拉回旧失败盘 + 白得 `REVIVE_BONUS_SEC`」。⇒ **DoD 硬含一条**：菜单侧发奖不得触发加时 / 不得切 `PLAYING` / 不得发 `sfx_revive_ok`。
- **验收**：`tls §4-R7`（0 心 · 任意可进格行，**逐字**：不进关、不扣心、拉起既有体力回满激励位、玩家留本页）+ 该表「格状态 × 呈现通道」矩阵「0 心点格」列；`tls §5` 0 心拦截行（**引用**面板入 200 / 出 150 与抽屉音，⛔ 零新毫秒、零新 clip）；`meta-ui §8-7`（不进关 ⇒ 零扣心 ⇒ 「新局成立 ⇔ 恰一次扣心」不变式不被破坏）；`meta-ui §8-5` + `tls §6`（首屏不扣心、本页仍是第 2 次交互）。
- **估点**：**M**。**依赖**：EP13-S2（「留本页」需其 overlay 上下文，顺序在 S2 后）。
- **In / Out**：In = `_startLevel` 统一下入口 ⇒ 主钮 `start` 与选关格 `pick-level` **同语义**（单点改造的自然结果，判据 = `ux-spec §6.3` 债 A 已转在用；⛔ 不是范围膨胀）。Out = 激励位内容与数值（`STAMINA_REFILL_PLACEMENT` 不动）、weapp 真实广告接入（ADR-0006 现行 = **Noop** ⇒ 真机腿 `[待真机 + 待广告接入]`，**不作 DoD 阻塞**，⛔ 不得写「已能回满」）。
- **证据落点**：`tests/arc-stamina-refill.test.ts`（Node 下 `MockRewardedAdProvider.settle('complete')` 驱动三臂：不进关零扣心 / 回满后可再点成功 / **串道反例**）+ harness 走查（web = Mock `'complete'`，可直接看到回满）。
- **ready**：**READY**（U-3 只决定形态，不决定判据）。

### EP13-S4 走马灯按大关翻页 + 橱窗三态由大关集合派生（**C-2 ③⑤⑥**，Q16=甲 / Q17=甲）

- **描述**：`_fillCarousel`（`:550-567`）现按**关**建序、页数按**大关**（`THEME_LEVEL_MAX + 1`）= 语义混装 ⇒ 收敛为**按大关**；橱窗代表图 = 该大关 boss 图；三态 = 任一 pushing / 全清 / 未开。
- **改动面**：C-2 ③⑤（`_fillCarousel`、`_metaViewData:657-688` 的 `carouselLevel/carouselState/carouselPeer*`）；**两处表外硬取首行**（`tuning.ts:1300 MENU_TEXTURES.bossArt`、`:1595 BOSS_THUMB_TEXTURES`）须改为按 arc 取图 ⇒ 设计轨已登记为分片 **C-2 ⑥**（**F-2 随之闭合**，旧行 = `…s-history.md` §3）。
- **验收**：`tls §4-R13`（空橱窗页 tap 图位 = 零事件，无 `levelRefs` 可列）、`§4-R11`（换大关必 `back`）、`tls §3`（单大关版呈现）、`§5` 翻页行（吸附 `MENU_CAROUSEL.snapMs` 180、`reduceMotion` 交叉淡变，零新数值）。
  三态派生与归组边界的**判据正文**现已在正本：`tls §8.2 TODO-6 / TODO-7` 均记「**已裁 = 甲**」（Q16 = 大关集合归约、只换数据源；Q17 = 关卡连续区间、L9 收尾）+ `meta-ui §2.7` 同态 ⇒ **引用之**，⛔ 不重述、不自造判据。
- **阻塞已解除（2026-10-17 · F-5 闭合）**：~~⛔ BLOCKED（Q16/Q17 口头拍板未进正本）~~ ⇒ 复 grep 证实两文均记「已裁 = 甲」+ v1.2 已补 F-1/F-2；阻塞段逐字旧文 = `…s-history.md` §2（**K-053**）。通用纪律不变：口头裁定未进正本前 ⛔ 不得落码（§0.4 + K-035）。
- **估点**：**M**。**依赖**：EP13-S1、EP13-S2（~~`[Blocked: 待规格回写]`~~ ⇒ 已解除 2026-10-17）。
- **In / Out**：Out = 新大关资产投放（本版 1 个大关 ⇒ 零新图；日后加行需 boss 图 + `.meta` ⇒ `[Blocked: 待编辑器]`，归美术轨）；页头大关名（TODO-1，文案令牌批）。
- **ready**：**READY**（原 **BLOCKED** 已于 2026-10-17 解除，根据 = 上条 F-5 闭合；判据现文本齐备）。

### EP13-S5 格按下态补齐 + 陈旧注释订正（**C-3 ①③**，附带 ② 核对）

- **描述**：`drawWallCell`（`meta-view.ts:1189-1237`）当前**不消费** `data.pressed` ⇒ 选关格无按下态、与 `back`/CTA 不一致；补 `pressDy`（−`UI_PRESS_SINK` 2px，`reduceMotion` ⇒ 位移归零只换面）。同批订正 `MetaButton.slot` 注释「陈列序 = DI 升序」= 陈旧（现码恒等配置序，`beads-shell.ts:609-621`）。
- **⚠ C-3 ② 经核已成立（F-1 已闭 · 分片 v1.2 已订正）**：「已通关」呈现（星带 `STAR_LABELS[stars]` + `stars>0 ⇒ palette.text / 否则 textDim` + 同形同尺）现码已在（`:1203-1217`），分片 C-3 ② 已改订为「现码已成立 ⇒ 只做核对断言」⇒ 本条 **零新增呈现工作**：验收 = 一条「现形状不破」核对断言，⛔ 不得按旧文重复建设。
- **验收**：`tls §4-R6`（任意格 · 按下态行，含「沿用既有 `pressedButton` 机制、**对象身份比对**」口径）+ 矩阵「按下」列四行；`tls §5` 格按下态行（2px、**无时长**、⛔ 不占 §5 红线）；`tls §7` 非色相三通道（本条 ⛔ 不得把「已通关」表达改成只靠颜色）。
- **类型 = Visual/UI** ⇒ 证据 = 快照命令位移腿（`text`/`rect` y 偏移）+ `production/qa/evidence/arc-cell-pressed-evidence.md`（**ADVISORY**，harness 出图 + 签署）；条数门槛 ≥2。
- **估点**：**S**（口径 = 按下态补齐 + 注释订正 + C-3② **只核对不建设**；若实现侧仍按旧文重做已通关表达即越界，需回报）。**依赖**：无（可与 S1 并行；出图走查建议排 S2 后）。
- **In / Out**：Out = C-3 ④ 页头大关名（TODO-1）；⛔ 不新增热区、不动 `levelsLayout` 几何、不动 `WALL_*` 数值。
- **ready**：**READY**。

---

## 3. 第一个冲刺建议（最小可玩垂直切片）

| 入选 Story | 入选理由 |
|---|---|
| **EP13-S1 → S2 → S5** | 本 Epic 的**核心垂直切片**：「点橱窗图 → 只见本大关关卡 → 按下有反馈 → 点格扣 1 心进关」；全链 **Node + harness 可验**，零编辑器零真机；S1 数据前提、S2 行为主体、S5 最小视觉补齐（S 档）。 |
| **EP13-S3** 列第二冲刺 | 判据完备、通道**已裁 = 乙**（U-3 闭合）⇒ 仍单独成批：含串道反例（R-2），不与 S2 的集合改造混在同一次改动里定位。 |
| **EP13-S4** 列第二冲刺（不入首批） | 阻塞**已解除**（BLOCKED→READY，2026-10-17，史证 = `…s-history.md` §2）；不入首批只因**依赖 S1+S2 先落码**，⛔ 不再是规格阻塞。 |

排除的 Story 不删，留后续冲刺。

---

## 4. 环境约束声明

- **无 Cocos 编辑器**：`.meta` / `.scene` / `.prefab` 不可手写、禁止伪造（L1 + ADR-0009）。本 Epic **五 Story 均不需新场景/新预制**；唯一可能触编辑器的是 S4 日后新增大关的 **boss 位图**投放 ⇒ `[Blocked: 待编辑器]`、归美术轨。
- **微信真机构建链未接入**：`games/beads/build/wechatgame/` 不存在 ⇒ 真机项一律 `[待真机]`、**不进 DoD**；`weapp.ts` 的 `createRewardedAdProvider()` 现返 **Noop**（ADR-0006）⇒ S3 真机腿 `[待真机 + 待广告接入]`，Node/Web 用 Mock 可完整验。
- **日常验证** = `pnpm run verify` + harness smoke（`dev/harness`；另见 §0.5）。
- **镜像与 ES5 纪律**：动 `games/beads/src/**` ⇒ 同批 `framework:sync` + `framework:sync:check`（pre-commit 硬门，BD-20 两次复发的根治）；§15 ⇒ 集合构造一律 `Array.from`，⛔ 非数组展开。
- **包体红线不混批**：见 **§0.6**（超标处置已在发布批登记）。

---

## 5. 统计

| 项 | 数值 |
|---|---|
| Epic 数 | **1**（EP-13；宿主登记拟行见 §7） |
| Story 数 | **5**（S1 清单+改名 · S2 overlay 按大关 · S3 0 心链路（乙）· S4 走马灯 · S5 按下态+注释） |
| ready 分布 | **READY × 5 · BLOCKED × 0**（S4 的 `[Blocked: 待规格回写]` 已于 2026-10-17 随 F-5 解除） |
| 估点分布 | S × 1 · M × 4 · L × 0 |
| C 表覆盖 | **C-1（S1）· C-2①②④ + C-5（S2）· C-2③⑤⑥（S4）· C-3①③ + ②核对（S5）· C-4（S3）**；**C-6/C-7/C-8 不属本批** ⇒ §7 占位；C-3④ 归文案令牌批 |
| 判据来源 | `tls §4` 逐行 + `tls §5/§7/§8.1/§8.2（Q16/Q17 已裁 = 甲）` + `meta-ui §2.7/§6/§8-2…§8-9` + 用户 2026-10-16 三裁定与 Q13/Q14/Q16/Q17 续裁 + 2026-10-17 三项拍板 —— **零新判据、零新数值、零 §3 变更** |

---

## 6. 风险、矛盾点登记与未决（⛔ 本批只登记，不擅改任何设计文档）

### 6.1 风险与缓解

| # | 风险 | 缓解 |
|---|---|---|
| R-1 | `_wallSlotsFor()` 是**单份缓存**且被走马灯与 `levels` overlay **共读** ⇒ S2 改集合时易顺手改掉走马灯语义（S4） | S2 失效键扩为二元 `(levelCount, arcIndex)`、缓存仍**一份数组复用**（⛔ 每帧分配，L5/§2）；S2 不动 `_fillCarousel`，收敛留给 S4 |
| R-2 | **广告发奖广播串道**（S3 正文实测取证）：菜单侧订阅 ⇒ play 的 revive 腿同帧被触发 | S3 的 DoD 硬含反例断言（U-3 已裁 = 乙 ⇒ 该断言仍为硬项） |
| R-3 | ~~S4 无判据可引（口头裁定未进正本）~~ ⇒ **已消除**（2026-10-17；旧行逐字 = `…s-history.md` §2） | 纪律保留：口头裁定未进正本前 ⛔ 不得落码（§0.4 / K-035）；S4 现按 `tls §8.2` 现文本判据开工 |
| R-4 | 改名批（S1）面广易漏 ⇒ 断链、镜像不同步、harness 起不来 | S1 的 DoD = `framework:sync:check` + `verify` 全绿 + 逐处引用点清单（§2-S1 已实测列举） |
| R-5 | Q12（清单 >12）被实现侧提前预写机制 | S2 的 Out 明确禁止；本版 9 ≤ 12 不可达 |

### 6.2 规格 ↔ 代码 / 文档 矛盾点（**只登记**）

| # | 矛盾 | 处置建议 |
|---|---|---|
| F-1 / F-2 / F-5 | **均已闭（2026-10-17）** ⇒ C-3 ② 已订正「只做核对断言」／两处硬取首行已登记 **C-2 ⑥**／Q16/Q17 已进 `tls §8.2` 与 `meta-ui §2.7` 现文本（旧文逐字 = `…s-history.md` §3） | F-1 → S5 正文与估点已同步；F-2 射程仍在 **S4**；F-5 → **S4 转 READY** 依据（阻塞旧段 = `…s-history.md` §2）、U-4 随之闭合 |
| F-3 | `epics-beads.md` §环境约束仍写「`platform/weapp` 无 `createRewardedAdProvider`」⇒ **已过期**（现码 `weapp.ts:239` = `NoopRewardedAdProvider`） | 建议宿主件下次触及时订正该行（本批不改他人正文） |
| F-4 | `meta:overlay` payload：`systems-index §4` 写 `{id, open}`、现码 emit `{open, name}` ⇒ 已在 TASKS backlog 在册 | **U-2 = 登记不动**（用户 2026-10-17）⇒ ⛔ **不入本 Epic 射程**；S2/S3 不自造第三形状，处置归独立批 |

### 6.3 未决与闭合登记（本批后**无待裁项**；四旧案整段正文 = `…s-history.md` §4/§5）

| # | 结论（2026-10-17） | 落点 / 残留 |
|---|---|---|
| U-1 | **已闭合**（主理人裁 **丙+**：设计轨「纯改名批」落地，原 `theme-level-select-spec(.s9-history).md` → 现 `arc-level-select-spec(.s9-history).md`，16 处引用已改齐，曾用名注保留） | ⓐ **S1 不背该面**（§2-S1 Out ①）、ⓑ 三案候选集已过期（旧案 = §4）。**未决残面**：`arc` 正本 L6 仍写「文件名本批不改 ⇒ 改名归 C-1」= 陈旧口径 ⇒ 移交设计轨下批 |
| U-2 | **登记不动**（用户 2026-10-17） | `meta:overlay` 字段名漂移维持在册欠账，⛔ **不入本 Epic 射程**（F-4）；S2/S3 不自造第三形状，改判归独立批 |
| U-3 | **已裁 = 乙**：shell 直取 `services.rewardedAd` | S3 形态转正；代价 = 新增订阅点（R-2）⇒ **串道反例断言仍为 DoD 硬项**（正文三条逐字见 §2-S3 ⚠ 行）；甲案旧文 = §5 |
| U-4 | **已闭合**：TLS v1.2 回写由设计轨（WXG-T-283 续批）落地 | `tls §8.2` + `meta-ui §2.7` + 分片 C-2/C-3 已订正 ⇒ S4 前置解除（F-5）、D-4 已兑现 |

---

## 7. 后置 / 下游占位（⛔ 本批不展开为 Story，后续另领任务号）

| # | 项 | 来源 | 归属 |
|---|---|---|---|
| D-1 | **C-6** `tests/*` 判据化用例族扩面（R1–R5/R7/R12 的 §A 硬判据族 + 大关过滤后的集合断言） | `s9-history §9` C-6 | quality-lead 严守真（`wxgame-qa-gates`；前置 **TLS v1.2 已到位**）；各 Story 自带最小回归腿不替代它 |
| D-2 | **C-7** 美术轨回写 `menu-architecture §4/§3.0`：`category_dimension:'di'` 与裁定① 冲突 ⇒ 改「大关」维度；§3.2 推演按清单长度复算 | C-7 | 美术轨林绘澄另批（**用户裁定优先**已明确） |
| D-3 | **C-8** `menu-wall-signage-spec` / `assets-spec` 图元基线（满墙 1518 / 首日 696 / 地板 504）**K-051 差分复算** | C-8 | 须**实测**复算（⛔ 沿用纸面数），触发 = S2 落地后；载体可并入 D-1 的 QA 批 |
| ~~D-4~~ | **已兑现（2026-10-17）**：TLS v1.2 回写（Q16/Q17 转正 + F-1/F-2 订正）完成 ⇒ S4 开工前置解除 | U-4（已闭）| 设计轨 WXG-T-283 续批；旧行逐字 = `…s-history.md` §4 |
| D-5 | 页头大关名文案令牌（TODO-1） | C-3④ | `copy-tokens` / `tokens.md` 令牌批 |

---

## 8. 宿主登记拟行（⛔ 本批不代落盘，待主理人批准后由领号会话粘贴）

**`production/TASKS.md` 主表行**（过 `check:tasks`）：

```
| WXG-T-284 | beads·大关选关页拆分（EP-13，纯计划批） | 程基岩(engineering-lead)｜主理人调度 | 📝 计划已落档、未落码（`epics-beads-ep13.md` + 史证分片 `….s-history.md`；5 Story **全 READY**，零代码零 §3 变更） | 见详情 |
```

**`production/epics/epics-beads.md` §1 Epic 表追加行**：

```
| **EP-13** 大关选关页落码 | 大关清单数据化 + `levels` overlay 按大关出格 + 0 心链路 + 走马灯按大关（五腿均 READY） | S10（`meta-ui §2.7`）| EP-08, EP-09, EP-12-S6 |
```

**§2 指针行**（与 EP-11/EP-12 同格式）：

```
### EP-13 大关选关页落码（S10 元游戏页族 · 导航链）

> **正文拆分件 →** [《epics-beads-ep13.md》](./epics-beads-ep13.md)：5 个 Story（`EP13-S1…S5`，**READY × 5 · BLOCKED × 0**）+ C-1…C-5 改动面映射 + `tls §4` 逐行引用式验收；越 B 门史证另挂 [《epics-beads-ep13.s-history.md》](./epics-beads-ep13.s-history.md)（⛔ 只增不改）。权威 = `design/ux/arc-level-select-spec.md` v1.1+v1.2 与其分片 `…s9-history.md §9` + `gdd/meta-ui.md §2.7/§8`；**零 §3 变更、零新判据**；C-6/C-7/C-8 为下游占位。
```

**§5 统计行需同步**：Epic 数 12 → **13**；Story 总数 47 → **52**（+5）；估点 S×18 → **19**、M×22 → **26**、L×7 不变；`[Blocked]` **维持 5**（原拟行「5 → 6」作废划线，S4 阻塞已于 2026-10-17 解除）。
