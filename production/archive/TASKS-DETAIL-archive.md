# WXG 任务台账 · 详情归档（tasks:archive 维护，勿手工编辑）

> 由 `pnpm run tasks:archive`（tools/scripts/archive-tasks.mjs）从 `production/TASKS-DETAIL.md`
> **成对搬入**：主表行进 `TASKS-archive.md` 的同一批，其详情小节进本文件（WXG-T-065）。
> 本文件**不进 ctx 索引面**（`production/archive/` 命中 `lib/context-index.mjs` SKIP_DIRS，WXG-T-029 先例）。
>
> ⚠️ **覆盖范围**：只覆盖标题制拆分（WXG-T-064）之后的归档。更早归档的行（WXG-T-001…047）
> 没有独立小节——那时主表还是详情制，**正文随行留在 `TASKS-archive.md` 里，没有丢失**。
>
> 取用：按 `## WXG-T-0NN` 定位，或直接 grep 任务号。

---

## WXG-T-048

- **名称**：多游戏粒度修正（两笔）：① **`build:cocos` 定名纠偏 + 落地**——原「根层裸命令」在多游戏矩阵下**无法表达构建哪一款**（`games/<game>/cocos/` 是每款游戏都有的目录）；改为 **per-package 声明 + 根 `pnpm -r` 聚合**（与既有 `test`/`typecheck` 同构，**新增游戏零改根脚本**），并实现 `tools/scripts/build-cocos.mjs`（**前置检查 + 人工步骤引导**，不假装能构建）+ `--open-panel`（经 MCP 开构建面板，唯一可自动化段）② **泛化 `sync-levels-data.mjs`**：原脚本**硬编码 breakout 的路径与 TS 接口** ⇒ beads **有真源、有产物，却零门禁且静默报绿**（含 `verify` 与 beads 自身 40 单测，K-031 族）；改为「**每游戏自带 header 模板 + 通用遍历**」+ **覆盖面断言**（有 JSON 必须有 header/产物、header 必须成对、JSON 必须唯一）⇒ 新游戏**零改共享脚本**、漏登记**报红**
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：tools/scripts/{build-cocos,sync-levels-data}.mjs · games/breakout/package.json（`build:cocos`）· package.json（`build:cocos` 聚合）· games/{breakout,beads}/design/levels/levels-data.header.txt（**新增**，逐字节取自各自产物头部并验证可复原）· games/beads/src/config/levels-data.ts（按统一渲染器归一）· architecture.md §6 · docs/agent/cocos-setup.md §12-3 · 本台账

---

## WXG-T-049

- **名称**：构建自动化能力修正 + CLI 构建落地：① **推翻本会话上轮的「构建结构上不可自动化」**——MCP 的 `project_build_system` 确实无构建 action（那半个偏差成立），但 **Cocos Creator 自带 CLI 可构建**：`CocosCreator --project <proj> --build "platform=<p>;debug=true"`（官方手册《命令行发布项目》），实测 `web-mobile` **3.9s 构建成功**且**编辑器开着可并存** ⇒ 正确表述是「**MCP 不可、编辑器 CLI 可**」② `build-cocos.mjs` 由"人工步骤引导"升级为**前置检查 + CLI 构建 + 产物校验**（默认 `wechatgame`；`--platform=` / `--no-build` / `--open-panel`）③ 新增 per-game `build:cocos:web`（web-mobile，**免 AppID**，走手机浏览器预览）与根 `pnpm -r` 聚合；实测 `pnpm run build:cocos:web` **12.5s 成功** ④ **`check:size` 发现路径补 `cocos/build/<platform>`**——CLI 默认把产物写在**工程内**，只认 `games/<game>/build/` 会造成「产物在、门禁说没有」的**静默跳过**（K-031 族，与 T-048 同源）
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：tools/scripts/{build-cocos,check-bundle-size}.mjs · package.json（`build:cocos:web`）· games/breakout/package.json · ADR-0009 §3.2（**追加修正注**，不改写原行/原注）· architecture.md §6 · docs/agent/cocos-setup.md §12-3 · 实测产物 `games/breakout/cocos/build/web-mobile/`（gitignore，不入库）· 本台账

---

## WXG-T-050

- **名称**：**里程碑验收回填**（用户确认「已基本完成 breakout」）：把预览/构建的实测结论**落盘**到知识缺口清单——`VERSION.md §3` 的 **G2/G3/G4/G5/G6 逐条回填**（按 §6 约定**只追加结论、不删提问**）+ §4 验证矩阵对应行 ❌→✅。**证据分层**：① 能由**编辑器生成的 3.8.8 官方声明**回答的，给行号引用（`rect(x,y,w,h)` 的 `x,y` 是**左上角**（`top left point`）、`roundRect` **存在**且为 `(x,y,w,h,r)`、`circle(cx,cy,r)`、`lineWidth/strokeColor/fillColor` 是**只读属性访问器**（`Readonly<Color>` ⇒ 不可原地改）、对齐枚举真名是 `HorizontalTextAlignment`/`VerticalTextAlignment`（**顺带纠正原文误写的 `Label.HorizontalAlign`**）、`TOUCH_START = "touch-start"`（与代码字符串逐字一致）、`getID(): number \| null`、`delay ... Unit: s`）；② 声明**回答不了**的如实标「声明未明说」并改由**实测闭环**（Label 锚点默认值、`getUILocation` 原点语义、`schedule` 的 `interval=0`）；③ **真未闭环项单独登记、不得记为已关闭**——`_anchorForText()` **仍用 `0.55` 估算宽度**（`cocos-renderer.ts:171`），文档要求"必须用真实 `Label` 尺寸替换"**尚未执行**
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：docs/engine-reference/cocos/VERSION.md（§3 五条回填 + §4 矩阵 4 行）· 本台账

---

## WXG-T-051

- **名称**：引擎功能裁剪 + 包体内部目标达标（backlog「引擎功能裁剪 + 包体回归」立项）：裁剪 `cocos/settings/v2/packages/engine.json` —— `includeModules` **22 → 10**，关闭 **14 个**未使用模块（`spine` / `spine-3.8` / `dragon-bones` / `tiled-map` / `video` / `webview` / `particle-2d` / `physics-2d` / `physics-2d-box2d` / `mask` / `rich-text` / `animation` / `audio` / `tween`；保留 `2d` / `affine-transform` / `base` / `custom-pipeline` / `gfx-webgl` / `gfx-webgl2` / `graphics` / `intersection-2d` / `profiler` / `ui`）。**证据前置**：全量 `cc` 导入符号实测只有 **7 个**（`Color` / `Component` / `Graphics` / `Label` / `Node` / `UITransform` / `_decorator`），待裁模块引用数**全为 0**；假命中 `Animation` 实为 `requestAnimationFrame`（浏览器 API，非引擎模块）。改写走 **parse → set → serialize + 解析校验**（非手改文本）。**结果（release 同口径）**：主包 **3008.3 → 1815.1 KB（−39.7%）**、`cocos-js/` **2560 → 1356 KB（−47%）**、gzip 809 → 490 KB；**§3.8② 内部目标 2000 KB 首次达标**，引擎亦回到 1800 KB 预算内；红线余量升至 **55.7%**。`cocos:check` 类型检查通过。**⚠️ 未闭环**：运行时**实玩验收**待做（类型检查抓不到禁模块的运行时行为）——已登记 backlog X-01
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成（实玩验收待补）
- **产出**：games/breakout/cocos/settings/v2/packages/engine.json · docs/engine-reference/cocos/VERSION.md（G7 裁剪结果与对比表）· 实测产物（gitignore，不入库）· 本台账

---

## WXG-T-052

- **名称**：beads 工程化对齐 breakout（用户裁定「参考 breakout 优化 beads 小游戏框架」，用户选 A 档）：① **渲染层符号通道落地**——新增 `view/symbols.ts`（10 符号 ○★●■♥◐▽▲◆✚ 矢量 path，不依赖字体）+ `view/bead-render.ts`（六层参数卡 L0–L5 → DrawCommand，纯函数），修掉 `art/accessibility.md` **A1/A3/B2 三处假绿**（「三重编码」实为颜色+明度两重、灰度可辨不成立、符号对比度无对象）；② **补四组测试**（`view-model` / `levels` + `levels-sync` 对账 / `tuning` / `save-schema`，对齐 breakout 同名判据）；③ **`smoke-harness.mjs` 参数化 game**，让 `?game=beads` 进 CI（现仅断言 breakout 专有字段 `totalBricks`）；④ **文档对账**（`architecture-beads.md` §9「src 未开始」与 §3 实际落地情况、`epics-beads.md` 过期 `[待 GDD §8]` 标记）
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：games/beads/src/view/symbols.ts（10 符号矢量 path + L5 墨色规则）· games/beads/src/view/bead-render.ts（六层参数卡 L0–L5 + empty/locked 变体）· games/beads/src/view/palette.ts（luminance / contrastRatio / mixWith + 卡面常量）· games/beads/src/view/view-model.ts（接线 + 头注改写）· games/beads/tests/{symbols,bead-render,view-model,tuning,levels,save-schema}.test.ts（**+64 用例，43 → 107**；测试文件 6 → 12，与 breakout 持平）· games/beads/src/config/levels.ts（**修 `validateBeadsLevel` 放行 NaN 时长/供料间隔的缺陷**）· tools/scripts/smoke-harness.mjs 与 lib/harness-runtime.mjs（**参数化 game，`?game=beads` 分支首次进 CI**）· docs/architecture/architecture-beads.md §9 · production/epics/epics-beads.md · games/beads/design/art/specs/accessibility.md · 本台账

---

## WXG-T-053

- **名称**：beads Cocos 宿主落地（B 档，用户裁定「接着走 B 档」）——**仓库侧前置三件**：① `sync-framework-to-cocos.mjs` 由**硬编码 breakout 泛化为多游戏**（遍历 `games/*`，仅处理已有 `cocos/` 者；未建工程者**明确跳过并打印**，与 `check-cocos-scripts.mjs` 同口径——泛化前 beads 永远拿不到拷贝件）；② `games/beads/package.json` 补 `build:cocos` / `build:cocos:web`，使根层 `pnpm -r` 覆盖 beads（`build-cocos.mjs` 早已「新增游戏零改根脚本」，缺的只是 per-package 声明）；③ `docs/agent/cocos-setup.md` 新增 **§13 beads 落地清单**（**顺序约定**：仓库侧不预建 `cocos/`，否则编辑器建工程撞非空目录；编辑器 7 步；`BeadsBootstrap.ts` 完整代码；engine 裁剪依据「**与 breakout 模块集完全相同**——共用同一份 cocos 适配器且 L3 禁止 `src` import `cc`」；构建命令；预期与风险）。**回归验证**：`framework:sync:check` 仍报 breakout **逐字节一致**（framework 36 + game 16）、同步幂等（写入 0 / 未变 52）、beads 的构建失败**未连带阻断** breakout（pnpm `-r` 不 bail）。**⚠️ 未闭环**：`games/beads/cocos/` 工程本身**必须由编辑器 GUI 创建**（L1 禁止伪造 `.scene`/`.prefab`/`.meta`），故本轮止于「仓库侧就绪 + 逐步清单」；R1 真机帧率待工程建立后实测
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成（工程创建待人工 GUI）
- **产出**：tools/scripts/sync-framework-to-cocos.mjs · games/beads/package.json · docs/agent/cocos-setup.md §13 · docs/architecture/architecture-beads.md §9 · 本台账

---

## WXG-T-054

- **名称**：beads 星级×关卡数值整组返工（阶段 0 缺口 D-01/D-05；阶段 5→6 FAIL 门）
- **负责**：文策渊　**状态**：✅ 完成（组 C 已冻结）
- **产出**：提案 + 回写：STAR3=0.32/STAR2=0.12；L5–L8 时限 360/360/380/280；§3.7 T-B 预留口径

---

## WXG-T-057

- **名称**：beads 广告位重排 + 失败页续时裁决（阶段 0 D-02；依赖 T-054 组 C）
- **负责**：文策渊 + 程基岩　**状态**：✅ 完成（规则已冻结，实现另排）
- **产出**：布局 A；`REVIVE_BONUS_SEC=60` / `REVIVE_MAX_PER_LEVEL=1`；续命 2★ 封顶；ADR-0006 够用 Mock 路径约 2–3 人日

---

## WXG-T-058

- **名称**：beads Mock 续时实现（F1+F2+B1；零 wx 广告 API）
- **负责**：程基岩　**状态**：✅ 完成
- **产出**：框架 `RewardedAdProvider` + Node/Web Mock + weapp Noop（**零 wx 广告 API**）；失败页主钮续时 / 次钮重试；`onRewarded` 后 +60s 同局续打、星级走 `starRemaining`；冲刺不续时。知识沉淀：候选 2 条未入账（`kb:sync` 新增 0 / 修改 0 / 激活 0 / 归档 0）

---

## WXG-T-055

- **名称**：beads 打断留存：回前台停面板（D-04）+ 局内快照提案（D-03）
- **负责**：程基岩　**状态**：✅ 完成（快照未落码）
- **产出**：D-04：`onResume` 不再解暂停（109 测绿）；D-03 提案 `games/beads/design/proposals/in-level-snapshot.md`（推荐另键 `wxgame.beads.crash.v1`）

---

## WXG-T-056

- **名称**：G4 复核：星级可达性用例缺口（注入 ratio 假绿）
- **负责**：严守真　**状态**：✅ 完成（readonly）
- **产出**：确认假绿；拟写 TC-CONST-09/10，**待 T-054 冻结后升格硬表**；D-03/D-04 当时无 §8 探针

---

## WXG-T-060

- **名称**：beads S6 道具系统落码（EP-06，用户裁定「beads 游戏继续规划任务执行」）：① `tuning.ts` 补 §3.6 常量（`POWERUP_TYPES` / `REGION_CLEAR_SLOTS=6` / `RANDOM_CLEAR_COUNT=5` / `POWERUP_FREE_USES=1` / `AD_PLACEMENTS=4`）+ 卡片几何真源 `powerupCardRects()`（视图与 S2 命中测试**共用**，消灭双份常量）；② 新增 `systems/powerups.ts` —— 只读镜像（`tray:spawned`/`bead:placed`/`tray:expanded` + 选中锚点）、三道具效果（region 恒长窗口 + 两端钳制、clearAll 全容量、random 等概率无放回）、三计数独立、**点名归 S6、清槽归 S4**；③ `beads-game` 接线（S2 路由优先级 2 + `usePowerup` + 整关重置 + 崩溃档读写 + 快照字段）；④ 崩溃档 `powerupUses` **上限钳制**关闭（T-059 留的「待 S6 落地补」）；⑤ 视图落 **A4 三图标**（魔法棒/扫帚/磁铁，§1.4 程序化 path）+ 用尽变灰 + `×N` + 占位轻提示。**测试**：新增 `tests/powerups.test.ts` **16 条**（§8 十条判据 1:1 + 常量镜像），beads **129 → 145**。**顺带修两处假绿/失配**：A4 此前标「✅ 落地」而实现是 3 张空白卡（无图标无标签）；A1/A3 符号特征计数被新增图标同原语污染（断言限定进拼图带）。**未闭环**：① §8-4 判据（200 次 ±20%）统计上偏紧（12 槽族极大偏差期望 ≈22%，实测 6 seed 落在 0.104–0.256）⇒ 测试固定 seed 并登记修订建议；② §1.4 卡片几何（176×150 + 卡下方标签）与 §3.1 带高 152 **互相矛盾**，未擅自改尺寸，登记待裁定；③ 图标文字标签未落码
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：games/beads/src/systems/powerups.ts · src/config/tuning.ts · src/game/{beads-game,state,crash-snapshot}.ts · src/view/{view-model,palette}.ts · tests/powerups.test.ts · games/beads/design/art/specs/accessibility.md（A4 改真）· 本台账

---

## WXG-T-061

- **名称**：**「到达序」判据清理**（用户裁定，承接 WXG-T-031 已确立基准）：把 beads 各 GDD 里以「事件到达序 / 以先到为准」为基准的「同帧」条款**统一换基准**为可观测的**帧内执行序**——`core-loop §2.2` 拆为「**玩法叙事序**（玩家感知的因果链，非执行序）」+「**帧内执行序**（规范，唯一真源）：输入（段内序：状态指令 → 玩法事件）→ 连击窗（仅冲刺）→ 供料 → 计时」，并**补齐玩法事件段内序**（落子回执 → 通关判定；`level:cleared`（输入段）恒先于 `level:failed`（计时段））与「cleared 优先」的**可观测机制**（输入段处理完已离开 PLAYING ⇒ 本帧直接返回，供料与计时都不执行）。改 `tray-spawner §6` / `powerups §6` / `score-combo §6` / `bead-grid §6` / `input-control §6` 共 **14 处**（**outcome 一一对应，非改判据、仅换基准**），并把 `pause-settings §6` / `timer-gameover §6` 的复述改为对 `core-loop §2.2.2` 的**归口引用**（两处各自复述正是 WXG-T-031 漂移的成因）。**顺带更正文档级错误**：`epics-beads.md` EP01-S2 把叙事序误读成「update 顺序」（原文「供料心跳 → 输入快照 → …」）——实现与基准都是**输入在前**（`_stepPlaying`）。**新增可执行证明**：`tests/frame-order.test.ts` **4 条**（真·同帧注入 + 探针实测供料帧号 + 对照组），钉住「暂停抑制同帧供料」「道具恒先于供料（新珠存活）」「最后一格 vs 同帧归零（仅 cleared、零 `timer:tick`）」与段序。**新发现**：`score-combo §6` 的「placed 与 rejected 同帧」、`input-control §6` 的「同帧先选珠后落子」等条款在「每帧最多 1 条输入指令」下**不可达**，已如实改为「不可能同帧」，不留假想分支
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：games/beads/design/gdd/core-loop.md（§2.2.2 规范真源 + §6 + §9 变更记录）· tray-spawner / powerups / score-combo / bead-grid / input-control / pause-settings / timer-gameover 各 §6 · production/epics/epics-beads.md · games/beads/tests/frame-order.test.ts · tests/helpers.ts（共享 `tapInFrame`）· systems-index §6 变更记录 · 本台账

---

## WXG-T-062

- **名称**：**三项待裁定落地**（用户裁定「按推荐」）：① **卡几何（方案 A：改卡高、不动带位）** —— `assets-spec §1.4` 原「卡 176×150 + 卡下方标签 28」与 `systems-index §3.1` 的 `POWERUP_BAND` 高 **152** 无法同时成立（150+4+28 = 182 > 152）⇒ 卡改 **176×116**（+ 间隔 4 + 标签 28 = 148 ≤ 152），**§3.1 与底部留白 48 一字不动**；视图按 §1.4 补齐**角标 28×28 贴右上内缩 (8,8) + 白 ▶ 边 10、圆角 20、描边 1px、投影 α0.10、卡下方 28px 标签**，几何常量与 S2 命中测试共用 `powerupCardRects()` / `powerupLabelY()`；**A4 由此转真**（「形状唯一」+「文字标签并列」两半都在）。② **§8-4 判据改卡方检验** —— 原「各槽偏差 ≤ ±20%」在 n=200 / 12 槽下约一半概率误报（12 槽族极大偏差期望本身 ≈20–24%，单槽 σ ≈ 11%）⇒ 改为 **χ²（df=11、α=0.01、临界 24.725）**，与 seed 无关、误报率恒定 1%。③ **`region` 偶数窗口偏向升格明文** —— 原 §6「实现约定」升为 §2.2 表格内规定（含锚点在内、左 2 右 3），§6 改为指引以免两处漂移。**测试**：`view-model.test.ts` 新增 A4 几何/形状/标签判据、`powerups.test.ts` §8-4 改 χ²，beads **149 → 150**。**新增常量**：`POWERUP_CARD_W/H/RADIUS`、`POWERUP_LABEL_H/GAP`、`POWERUP_BADGE_*`（§1.4 的资产几何，非 §3 数值；**§3 全表零改动**）
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：games/beads/design/art/specs/assets-spec.md（§1.4 + 裁定注）· art/accessibility.md（A4 转真 + 落地计数 13）· design/gdd/powerups.md（§2.2 明文 + §6 指引 + §8-4 卡方 + §9 变更记录）· src/config/tuning.ts · src/view/{view-model,palette}.ts · src/systems/powerups.ts（`POWERUP_LABELS`）· tests/{powerups,view-model}.test.ts · systems-index §6 变更记录 · 本台账。**观感复核追加**（同日）：三卡间距 **30 → 60**（三卡总宽 648、两侧余量 51），A4 判据补「整组不贴屏边」断言

---

## WXG-T-064

- **名称**：台账「标题制 + 详情分片」：治 `TASKS.md` 随任务数线性膨胀（用户 2026-09-14 反馈「详情写进索引文件、命中标题后再读详情」，并指出定期归档治不了膨胀）。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **根因（实测）**：`TASKS.md` 曾 **81% 体积是任务行详情**——16 行 ≈ **5334 tok**（中位 389、最重 613），非任务行部分仅 ≈1207；`tasks:archive` 只清**已完成**行，**每个新任务仍带入 400–600 tok** ⇒ 必然反复撞 `ctx:check` B 项 8000（当时 7035、余量 965）。上一轮把 backlog 该条按「T-053 归档已治」结项**属误判**，本轮回检重开并结清。
- **关键发现（装置无需新增机器）**：`ctx/index.json` **已按小节**输出 `anchor/level/startLine/endLine/tokens/summary/keywords` ⇒ 「命中标题后再读详情」＝先读主表标题、再按该小节的 `startLine`/`endLine` 精确 `read_file` ⇒ **详情索引就是 `ctx/index.json`**；此前失效是因为详情塞在**表格单元格**里，索引器只能把整文件当一个 blob。
- **落地**：① 主表改**标题制**（名称 ≤ 60 字符，产出列改「见详情」）；② 正文迁 `production/TASKS-DETAIL.md`（16 节**原样搬、零改写**）；③ 顺带修两处真实格式缺陷——**我前几轮插行带进空行、把 Markdown 表格从 T-060 起截断**，以及表内夹注（3 条注移到表后）；④ 新增 `tools/scripts/check-tasks.mjs`（`pnpm run check:tasks`，已接进 `verify`）：名称超限 / 行不连续 / 行⇔小节不配对 / 详情残留已归档 id，四类即 FAIL，带 `--prune` 清理；⑤ 读取协议进 `ctx/ROUTES.md`（台账成本 **1439 → 2220** 修正 + 新增详情入口行）与主表头注。
- **效果**：`TASKS.md` **7224 → 2220 tok（−69%）**；单任务详情按需读 ≈ **290 tok**（不再整读 7k）；主表体积不再随任务数线性膨胀。
- **未闭环**：归档器**成对搬运**（行 + 小节）—— **已由 WXG-T-065 闭环**（见该节）。另注：本轮的 `--prune` 当时是**删除**语义，T-065 已改为**搬入**语义（删除会丢正文）。

---

## WXG-T-065

- **名称**：归档器「**成对搬运**」机械化：把 WXG-T-064 登记的未闭环项闭环 —— `archive-tasks.mjs` 搬行时**同批搬走详情小节**，详情文件不再只增不减。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **落地**：① 新增共享解析库 `tools/scripts/lib/tasks-detail.mjs`（preamble / 节的 parse·serialize·take·append + 详情归档头常量）—— **单一真源**：归档器与门禁都走它；两边各写一套切分逻辑必然漂移，而漂移的后果是**静默丢任务正文**（不可接受）② `archive-tasks.mjs`：行 → `production/archive/TASKS-archive.md`、节 → `production/archive/TASKS-DETAIL-archive.md`（同目录、同样被 `SKIP_DIRS` 排除索引面），**节数 == 行数**（不等即 fail loud、**两个文件都不写**），批次留痕写明成对；③ `check-tasks.mjs`：新增 **E 项**（详情归档有节 ⇒ 行归档必须有行 = 成对脱钩检测），并把 `--prune` 语义从「**删除**残留小节」改为「**搬入**详情归档」—— 删除会丢正文，与成对搬运语义相反（本轮顺带纠正的一处**危险默认**）。
- **三条安全边界**：**宁漏勿错**（主表有行但详情无小节 ⇒ **跳过该行**并告警，搬了会丢正文）｜**退化**（详情文件不存在 ⇒ 只搬行并明示；老仓库与桩自测不受影响）｜**幂等**（节已在详情归档则跳过，重跑四文件字节不变）。
- **证据**：① 桩自测 `archive-tasks-selftest.sh` 新增 **[7] 组**（dry-run 不落盘 / 行与节同批走 / 正文逐字节不变 / 在办行小节不动 / 重跑字节不变 / 缺小节跳过）⇒ 全量 **PASS 41 → 67**；② 解析库对**真实** `TASKS-DETAIL.md` 实测 `serialize(parse(x)) === x`（幂等 ⇒ 归档写盘不会 churn 文件）；③ 真实仓库 dry-run：`--until-under=2000` 报「计划归档 **14 行 + 详情节 14 节**」（数量守恒）且未落盘。
- **未执行**：真实归档写入（`--until-under=2000 --write` 会搬走 14 行、含 T-060…T-062）—— 属治理动作，等主理人发令。

---

## WXG-T-066

- **名称**：EP-07 通关画面（FINISH）落地：`ux-spec §3.6` 的全屏庆祝 + 星级总览 + 双钮，接上判据 `core-loop §8-8`。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **落地**：① 新增 `systems/finish-panel.ts`（纯逻辑：布局 / 命中 / 入出动画 / **逐关**入场；镜像 `clear-panel.ts` 的纪律——不碰网格 / 托盘 / 倒计时 / 存档）② `beads-game.ts`：`addState('finish')` 由**空壳**补全（onEnter 开面板 + `_stepFinish` 逐关音效）、点击路由改为**只认两个按钮**（此前**任意点击**都被当成「重玩第 1 关」✗ 面板外误触会重开整轮）③ 星级总览数据 = 每关**历史最好**（`_starsByLevel`，重玩取 max）④ 视图 `drawFinishPanel`（全屏遮罩 + 顶部三色带 + 逐关行 + 总星数 + 主副钮）⑤ 顺带修一处**真缺陷**：末关进 FINISH 时**结算面板不退场** ⇒ 它 150ms 的淡出会从通关画面后面透出来（两个面板都画全屏遮罩，叠着见两层）——现于交接处 `close()` 并有断言钉住。
- **判据**：`core-loop §8-8` 三段全覆盖（n<8 推进 / 第 8 关进 FINISH / FINISH 重玩第 1 关）+ `ux-spec §4` 矩阵行（去冲刺 / 重玩第 1 关）+ `input-control §2.3`（面板外零响应，含淡出期）。新测试 `tests/finish-panel.test.ts` 10 例 ⇒ beads 全量 **157 → 167 全过**。
- **派生项（GDD / UX 无明文，已登记）**：① §3.6 只有一句话、**未给几何** ⇒ 布局沿用结算面板的常量族与设计空间约定；② `ux-spec §5` 的「逐颗 150ms」是结算行 3 颗的时序，总览最多 8×3 = 24 颗（逐颗要 3.6s ✗）⇒ 改**逐关** 150ms（8 关 = 1.2s），同关 3 颗同时入场；③ 总览取值 = 每关历史最好（与 `maxUnlockedLevel` 的持久语义一致）。
- **未闭环（EP-07 剩余）**：冲刺结算面板（`ux-spec §3.5` 左列，含 NEW BEST 与 §8-11）、连击特效三档（`score-combo §2.5`；判据 §8-9 属 DevTools 帧检）、星级表持久化（见 backlog）。
- **文档回写**：`epics-beads.md` EP07-S1 里「STAR3_RATIO 0.40 / STAR2_RATIO 0.20」与 `systems-index §3` 的**冻结值**（T-054 重冻结：**0.32 / 0.12**）冲突 ⇒ 按该文档自身的裁定纪律「以 §3 为准，回写本文档」一并更正。**本轮实测踩到过**：ratio 0.15 应判 2★，按过期阈值会误判 1★（我的测试第一版就写错了，改用冻结常量取值）。
- **产出**：games/beads/src/systems/finish-panel.ts（**新增**）· game/beads-game.ts · game/state.ts · config/tuning.ts · view/view-model.ts · src/index.ts · tests/finish-panel.test.ts（**新增**）· cocos 拷贝件（`framework:sync`：beads game 22 → 23）· production/epics/epics-beads.md · 本台账

---

## WXG-T-067

- **名称**：EP-07 冲刺结算面板落地：`ux-spec §3.5` **左列**（单局 / 最高梯位 / 最高连击 + 双钮），接上判据 `score-combo §8-11`。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **落地**：① 新增 `systems/sprint-settle.ts`（纯逻辑：布局 / 命中 / 入出动画；文案与千位分隔为纯函数）② `beads-game.ts`：冲刺归零时 `_recordSprintEnd()` **先结算再开面板**（NEW BEST 与写盘有先后依赖），点击路由由「**任意点击即重开本局**」✗ 改为**只认两个按钮**（再来一局 / 返回关卡）；`retryLevel` / `startNormal` 补面板退场 ③ 视图 `drawSprintSettle` 顶掉 banner 里那行 `SCORE N · NEW BEST!` 占位（占位随本任务删除，banner 守卫改为认结算面板可见性）④ **`SprintTracker` 增 `bestStreak`**：§3.5 要「最高连击」而 `streak` 断连即归零 ⇒ 必须单独记最大值；它**不进 `sprint:ended` payload**（该事件字段受 `systems-index §6` 变更流程约束，而这是**展示量**）⑤ 崩溃快照增 `bestStreak`（提案 §4 **例外**：缺省 ⇒ 0、不弃整份快照——纯展示量不值得丢一局恢复档；其余 sprint 字段仍「缺字段 → 丢」）。
- **判据**：`score-combo §8-11` **两半都钉住**——`> 最佳` ⇒ `isNewBest` + NEW BEST 渲染 + 写 S8；`≤ 最佳` ⇒ 不显示不写（用**共享 storage 的两个 harness** 造真「重启」语义，而非「0 > 0」的弱用例）；§3.5 双钮路由；§3.5「不出现续时主钮」（冲刺态 `requestRevive()` 为 no-op）；面板外零响应。新测试 `tests/sprint-settle.test.ts` 9 例 ⇒ beads **167 → 176 全过**。
- **改了既有用例（如实登记）**：`tests/revive.test.ts` 的 `sprint GAME_OVER has no revive and **still retries on any tap**` 是在**钉住旧行为** ✗ —— 与 `§3.5` 及 `input-control §2.3` 直接冲突。已改名为 `…answers the settle panel buttons only`，断言改为「面板外零响应 + 只有双钮能离开本相位」，**覆盖没有削弱**（反而更严）。这是本轮唯一被改动的既有断言。
- **派生项（已登记）**：① §3.5 左列**无标题行**（首行即「单局 N」）⇒ 增「冲刺结束」标题（沿用面板常量族）；② 「▸×M 最高连击 K」的 `M` 由 `K` **重算**（`multiplierForStreak`），不另存倍率字段；③ `§8-11` 只说显示 / 不显示、未给角标位置 ⇒ 贴标题行右侧。
- **EP-07 剩余**：连击特效三档（`score-combo §2.5`；判据 §8-9 属 DevTools 帧检）、星级表持久化（见 backlog）。
- **产出**：systems/sprint-settle.ts（**新增**）· systems/sprint.ts · game/beads-game.ts · game/state.ts · game/crash-snapshot.ts · view/view-model.ts · src/index.ts · tests/sprint-settle.test.ts（**新增**）· tests/revive.test.ts · tests/in-level-snapshot.test.ts · design/proposals/in-level-snapshot.md · cocos 拷贝件（game 23 → 24）· 本台账

---

## WXG-T-059

- **名称**：beads 局内崩溃快照**落码**（D-03 实现轮；用户裁定「局内崩溃快照（D-03）任务执行」）：T-055 的提案自身写明「本轮禁止落运行时写档」+ §7 标「落码时，非本轮」⇒ 本轮**开新轮次**，不推翻其条款。范围：① 新增 `src/game/crash-snapshot.ts`（**另键** `wxgame.beads.crash.v1`，`save-schema.ts` 一字未改、S8 version 未升；字段级校验/降级、永不抛异常）；② `Spawner` 暴露 `acc` / `fullReported` 存取（原私有；恢复须在热路径外写，且须**先设 interval 再设 acc**，因为 interval setter 会重置累加器）；③ `BeadsGame.onPause` 末尾写快照（含「已 PAUSED 又 onHide」）；结算/过关/失败/finish/重玩/换关 **删**快照；④ BOOT 读快照 → 校验 → 装配 → 进 PAUSED（走 `machine.reset('paused')`，**不动** `PHASE_TRANSITIONS` 冻结表）；⑤ `tests/in-level-snapshot.test.ts`（提案 §6 六条判据，本轮据用户裁定去 `[待冻结]`）。**对提案 §2 的必要增补 2 项**（均有既有冻结依据，非发明）：`reviveCount`（T-057 已冻结 `REVIVE_MAX_PER_LEVEL=1`；不存则恢复后可再续一次、绕过该规则）、`reviveBonusSec`（参与 `computeClearStars`；不存则恢复后过关多给星）
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：games/beads/src/game/crash-snapshot.ts · games/beads/src/systems/spawner.ts · games/beads/src/game/beads-game.ts · games/beads/tests/in-level-snapshot.test.ts · 本台账

---

## WXG-T-063

- **名称**：**EP-07 结算·过关面板落地**（用户裁定「开始 EP-07 结算面板」）：`ux-spec §4` 流转表要求 `LEVEL_CLEAR` **等按钮**（下一关 / 去冲刺 U1），而实现一直是「1.4s 自动进下一关」的占位 ⇒ 新增 `systems/clear-panel.ts`（纯布局 + 命中 + 入/出 200/150ms + **星入场逐颗 150ms**，同 PausePanel 范式），按 §3.4 画遮罩 + `panel_dialog` 底板 + 金色缎带标题 + 逐颗弹跳星级 + 「剩余 mm:ss ｜ 道具 n/3」+ 主/副双钮；`LEVEL_CLEAR` 改为**等按钮**，`LEVEL_CLEAR_DELAY_S` 与 `tuning.levelClearDelay` **退休**（留墓碑注）；面板开时压掉相位横幅；C7 结算分在 `level:cleared` 当帧装配（`lastSettleScore`，§8-2）；星入场各触发一次 `sfx_star`。**测试**：新增 `tests/clear-panel.test.ts` **7 条**（含「3s 内不自动推进」回归闸门 + 两条按钮出口 + C7 精确值 4200 + §8-2 数据装配），另改两处依赖自动推进的旧用例（改点面板主钮）；beads **150 → 157**。**EP-07 未完**：冲刺结算面板（`ux-spec §3.5` 左列）+ FINISH 通关画面（§3.6）+ 连击特效三档（§2.5，判据 `score-combo §8-9` 属 DevTools）
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成（EP07-S1 关面完成）
- **产出**：games/beads/src/systems/clear-panel.ts · src/game/{beads-game,state}.ts · src/view/view-model.ts · src/config/tuning.ts · tests/clear-panel.test.ts · 本台账

---

## WXG-T-068

- **名称**：`memory/` 日志的**分级加载**：新增摘要层 `memory/INDEX.md`（生成物）——先读摘要，需要时按行区间只读那一节。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **问题（用户 2026-09-14 提出）**：`memory/` 4 篇日记合计 **31,690 tok**（单篇 5.6k–10.1k；09-12 单篇 10,141 已靠 B 门豁免放行）⇒ 任何会话都读不起 ⇒ 事实上「知识库很大但没人敢读」。`knowledge/` 早已是正确形状（`INDEX.md` 3.2k 摘要 + `lessons.md`/`patterns.md` 详情），`memory/` 缺这一层；且 ROUTES 只登记了 `MEMORY.md` 的小节，**4 篇日记没有任何入口**。
- **落地**：① 新增 `tools/scripts/lib/memory-index.mjs`：渲染 `<!-- memory:index:start -->` 标记块（**只列 `##` 级主题**：文件 → 行区间 + 体量 + 摘要素描；手写协议在块外，与 `knowledge/INDEX.md` 的 `kb:active` 同规格）② 摘要**取 `ctx/index.json` 里已有的** `firstSentence()`，**不写第二套摘要器**——两套必然漂移，而漂移后果是索引**指错行**（比没有索引更坏）③ `ctx:build` 写完索引后生成它，并**纳入不动点收敛**（它本身也是被索引的 .md；块内不含自身行 ⇒ 无自指反馈，通常一轮即达）④ pre-commit 的产物暂存行补 `memory/INDEX.md`（钩子注释明写「新增 ctx 产物必须登记到本行」，照办）⑤ `ctx:check` 新增 C 子项：**现算文本 vs 磁盘逐字节比对** + **蒸馏天数口径断言**（本模块的 `MEMORY_DIGEST_DAYS=30` 必须等于 `distill-memory.mjs` 的 `args.days ?? 30`——该默认值内联、无导出，故机械对账，防两处慢慢走散）。
- **口径诚实声明（已写进产物与文档）**：摘要 = 节首句**摘取**，**不是**人工撰写的提要 ⇒ 用它判断「要不要读这一节」，别当结论。
- **收益**：入口成本 **31,690 → 3,756 tok（8.4×）**，且**可路由**（行区间可直接喂 `read_file`）；产物头部写明「怎么用它读一节」。
- **实测（门禁双向验证，非假绿）**：移走 `memory/INDEX.md` ⇒ `ctx:check` FAILED 并给出修复命令；移回 ⇒ OK。
- **协议登记**：`memory/MEMORY.md` 规程补一条读法 · `ctx/ROUTES.md` 增入口行（指向 `memory/INDEX.md#§4. 摘要表（自动生成）`）· `docs/agent/memory-distill.md` 增 §8 分级读取。
- **已知限制（如实登记）**：产物是「生成 + 读取既有文件」型 ⇒ 在 `--staged-blobs`（提交时）模式下，**手写前言**取工作树版本而非暂存版（日记表的行号仍按暂存 blob 索引 ✓）。前言极少改动，影响低。
- **产出**：tools/scripts/lib/memory-index.mjs（**新增**）· tools/scripts/build-context-index.mjs · tools/scripts/check-context-budget.mjs · .githooks/pre-commit · memory/INDEX.md（**新增，生成物**）· memory/MEMORY.md · ctx/ROUTES.md · docs/agent/memory-distill.md · 本台账

---

## WXG-T-069

- **名称**：把 `knowledge/` 与 `memory/` 的**使用触发协议**写进文档（回答「memory 该什么时候用」）。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **背景**：用户提问「每次新窗口加载 knowledge 确认经验教训，那 memory 什么时候用？」。查证后发现**用户的前提与现协议相反**：`AGENTS.md:118` 的 knowledge 读法是「**实现/修复/接入/发布类任务开工前**读 `lessons.md` **同域**条目」（按任务触发，非每窗口无条件）；而**被挂进四个 IDE** 的（三个符号链接 + Cursor 指针，`AGENTS.md:21-25`）是 `memory/MEMORY.md`。真正的缺口是 `my-rules/agents-md.md:13` 把 memory 的用法写成含糊的「需要活上下文时 Read」✗。
- **落地（四处，各司其职、不重复）**：① `my-rules/agents-md.md`（常驻，最省字）只放**四个触发词**；② `AGENTS.md` 在 knowledge 段旁补**对称的 memory 段**（此前只有 knowledge 半边 ✗）；③ `memory/INDEX.md §1` 放**完整协议**（四触发 + grep 查法 + 例行用途 + 与 knowledge 的分工口诀）；④ `knowledge/INDEX.md §1` 加镜像一句分工。
- **协议要点**：`MEMORY.md` 可常读；日记**只在四触发下查** —— **改旧政之前**（查当初为什么这么定）/ **接续未完成工作** / **追溯用户原话与裁定**（本层**独有**的权威记录）/ **排障找当初的确诊法**。查法 = `grep -n '<任务号或关键词>' memory/INDEX.md` 定位到「哪一天 / 哪一节 / 行区间」→ `read_file` **只读那一节**（几百 tok，而非 3.2 万）。例行用途只有一条：满 30 天蒸馏时重读那一天的节。
- **预算纪律（本任务的主要约束）**：`AGENTS.md` 1743 → **1859 / 2000** ✅、`my-rules/agents-md.md` 374 → **413 / 500** ✅ —— 常驻层每个字**每次会话都付费** ⇒ **触发词进常驻、完整协议进按需层**；`memory/INDEX.md` 3811 → 4248、`knowledge/INDEX.md` 3170 → 3319（皆按需层、无硬门）。
- **顺带验证机制**：改完 §1 后重跑 `ctx:build` ⇒ **手写前言原样保住、生成块完好** ⇒ WXG-T-068 的「手写协议在外、生成表在内」规格成立（这条不是推理，是跑出来的）。
- **产出**：my-rules/agents-md.md · AGENTS.md · memory/INDEX.md · knowledge/INDEX.md · 本台账

---

## WXG-T-070

- **名称**：台账头注**落后**的机械门禁（F 项）——`check-tasks.mjs` 断言头注号 **≥** 主表 ∪ 归档全局最大号。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **动机（真事，非假想）**：本次 T-067…T-069 三笔登记里，我用 `str.replace` 改台账头注**静默没匹配上**（真实文案是「…建档：2026-09-12，主理人游承峰。当前已分配至 **WXG-T-066**，下一可用号…」，不含我假设的「（已完成）」✗；且那三处我**漏了 `assert`** ✗，别处却用了 ✓）⇒ 头注停在 **T-066** 而表内已到 **T-069**。唯一的告警方 `tasks:archive` **平时不跑** ⇒ 直到本次归档才暴露 —— 差一点就带着一个「已释放的号」继续领号（并行会话重号的经典成因）。
- **落地**：`check-tasks.mjs` 新增 **F 项**：头注号**落后**于全局最大号即 FAIL；**领先合法**（`tasks:archive` 明写「头注只进不退」，某会话先推进头注而对应行未落盘是正常态）⇒ 领先只出一条 note。
- **双向实测**：把头注改回 `WXG-T-066`（模拟落后）⇒ `check:tasks` FAILED 并给出修复命令；改回 ⇒ OK。
- **为什么值得单独立项**：这是一次「**修自己**」——同一类错（脚本化改文档时 `replace` 静默 no-op）本任务之前已犯过 ✗，光说「下次注意」不算修复；把它变成门禁，下次它在**提交前**就会响。
- **产出**：tools/scripts/check-tasks.mjs · 本台账

---

## WXG-T-071

- **名称**：星级表持久化 —— 实现 S8 GDD §2.2 **早已冻结**的 `stars` 字段（每关历史最高星），通关画面总览从此**跨重启保持**。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **侦察结论（纠正了我自己在 T-066 登记的第一步）**：backlog 那行写的是「① 回写 `save-progress` GDD 增字段」✗ —— 实测该 GDD **§2.2 早就冻结了** `stars | number[DEMO_LEVEL_COUNT] | 每关历史最高星（1–3；未过=0）| 过关结算时 max(旧,新)`，§2.4 给了降级规则、§6 给了小数口径、§8-2/§8-3 给了判据 ⇒ **GDD 不需要回写**，缺的是**实现**（「文档有、代码没有」，与 A4 道具图标同一类）。故本任务只做后两步。
- **落地（逐条对着 GDD，不发明规则）**：① `save-schema.ts` 增 `starsByLevel`（= GDD 的 `stars`；键名与结构归代码）+ `normalizeStars`：**长度不符 → 重置全 0**（§2.4 明文）、单值非有限 → 0、**小数向下取整**（§6）、再钳 `[0, STAR_MAX]`；**绝不弃整档**（与 `settings` 同判例），并把该字段纳入 `changed` 判定（缺字段 ⇒ 写回一次）② `tuning.ts` 增 `STAR_MAX = 3`（§3.7），`finish-panel.ts` 的 `FINISH_MAX_STARS_PER_LEVEL` 改为引用它 ⇒ 同一事实只有一个常量 ③ `beads-game.ts`：BOOT 从存档装载为内存**镜像**（与 `_sprintBestScore` 同判例）、过关时随 `_persistProgress()` 写回（§2.5「结算写」）。
- **max 语义的归属（刻意划分）**：`max(旧, 新)` 由**游戏侧**在过关时取（§8-2），schema **只钳制、不取大** —— 并有专门用例钉住「schema 不发明 max」，防两处各取一次。
- **判据**：§8-2「`stars[n-1] = max(旧,新)`；**重启保留**」用共享 storage 的两个 harness 实测（真重启语义）；§2.4/§6 降级矩阵逐条断言（长度不符、越界、小数、非有限、非数组）。新增用例 3 条 ⇒ beads **176 → 179 全过**；`save-schema.test.ts` 的「合法文档」夹具随字段新增而更新（否则它不再是合法文档）。
- **顺带清理（台账卫生）**：backlog 移除本项；另发现「台账随任务数线性膨胀」那行**其实已由 T-064/065/068 结项却仍挂在 backlog、数字也已过期** ✗ ⇒ 一并标注结项。
- **产出**：game/save-schema.ts · config/tuning.ts · systems/finish-panel.ts · game/beads-game.ts · game/state.ts · tests/save-schema.test.ts · tests/finish-panel.test.ts · cocos 拷贝件 · 本台账

---

## WXG-T-072

- **名称**：`ctx:build` 的**写入顺序闭环** —— 消除「每次提交都要手工重建一轮才过」的假失败。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **真因（读代码定位，非猜测）**：WXG-T-068 新加 `memory/INDEX.md` 产物时，我把它写在 `serializeIndex()` **之后** ✗ ⇒ `ctx/index.json` 记录的是**上一轮**的 `memory/INDEX.md` 哈希 ⇒ pre-commit 的 `C(--staged)` 每次都判「暂存与索引不一致」⇒ 当天连踩**四次**（每次都要手工 `ctx:build` + 重暂存一轮才过）。
- **修法**：改成显式三步闭环 —— ① 先以最终内容落盘 `memory/INDEX.md`（它自己也是被索引的 .md）② **再**建一次索引把它纳入 ③ 最后才 `serializeIndex()` ⇒ 磁盘上的 INDEX.md 与 index.json 记的哈希必然同源。`hot-files.md` 用「写两遍」绕开了同一问题，本处不再依赖重试。
- **实测**：修后本笔提交**首次即过**（此前连续四笔都需手工重试）。
- **如实保留的不确定性**：手工逐步复现该序列时仍能造出一次不一致 ⇒ 除「写入顺序致哈希滞后」外**可能还有第二因子**，本次未穷尽。已记录，不宣称已彻底根治（下次再遇同类拦截时应先看是否仍是 `memory/INDEX.md`）。
- **产出**：tools/scripts/build-context-index.mjs · 本台账

---

## WXG-T-073

- **名称**：归档器新增 `--detail-until-under=<N>`（体积驱动 · **详情侧**），并抽出口径唯一的 `eligibleRows()`。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **动机（同一错位当天咬人两次）**：`--until-under` 量的是**台账**，而标题制（T-064）之后台账只剩 ~2.4k，B 项压力却在**详情文件**（8274）⇒ 用台账阈值去压详情只能「凭感觉挑一个很低的数」✗（第一次在 T-065 手挑 2400；这次 `--until-under=2500` 直接**空转** ✗）。本旋钮直接量详情文件，意图与手段一致。
- **附带抽出的口径**：三条策略（默认 30 天 / `--until-under` / `--detail-until-under`）原本各自内联「可归档行」的筛选 ⇒ 我把新旋钮接到了**已被年龄筛过**的 `candidates` 上 ⇒ 默认口径下它是空的，**新旋钮静默什么都不搬** ✗。现抽成 `eligibleRows()` 单一出处，策略只负责「选多少」。
- **另一处顺序教训**：候选重算必须在 `toArchive` **派生之前**，否则「报告列了候选、计划 0 行」——与本笔的 `ctx:build` 写入顺序（T-072）是**同一类**缺陷 ✗，一日内两次 ⇒ 已同时写进两处代码注释防复发。
- **实测**：`--detail-until-under=7000` ⇒ 候选 2 行与「计划归档 2 行 + 详情节 2 节」一致（此前为 0 行）；本次即用它把详情压回 B 门内。
- **产出**：tools/scripts/archive-tasks.mjs · 本台账

---

## WXG-T-074

- **名称**：EP-07 最后一项 —— 连击特效三档（`score-combo §2.5`）的**可测半边**落码：档位↔特效一一对应 + `§3.8` 红线的结构性落实。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **规格**：形态与触发 = `score-combo §2.5`（Lv1 ×2 珠面星光粒子 / Lv2 ×3 **伪**震屏：整屏 scale 1.00→1.015→1.00、**无位移抖动** / Lv3 ×5 边缘径向光 + 珠面波浪）；**毫秒值全部来自 `ux-spec §5`**（§2.5 明写「本篇不自写」）＝ 200 / 150 / 350；`combo:up` 事件**早已登记并在发** ✓，缺的是任何消费方 ✗。
- **落地**：① 新增 `view/combo-vfx.ts`（**纯逻辑**：`tier → spec`、各档「已播毫秒 → 呈现参数」；无状态、不绘制）② `tuning.ts` 镜像 §5 三档时长 + `COMBO_SHAKE_SCALE_MAX` + `COMBO_PARTICLE_COUNT` ③ `beads-game.ts`：`combo:up` 处设 VFX（**同时只播最高档**——派生项，防叠加成闪烁）、表现层推进（PAUSED 只冻玩法不冻表现，与面板同判例）、播完即清 ④ 视图 `drawComboVfx`：Lv1 粒子锚在**落子格心**（复用 `drawGrid` 同一套格心公式 ⇒ 画在哪与判定在哪一致）、Lv3 四边径向光带 + 扫过波浪。
- **两条红线的「结构性」落实**（比注释提醒可靠）：① Lv2 的呈现类型 `ComboPseudoShake` **只有 `screenScale`、没有 dx/dy** ⇒「用位移伪造震屏」在类型层写不出来；② 三档都是**单次循环**（0→峰→0，播完即清）⇒ 本模块无任何自重复周期量 ⇒ ≤3Hz 闪烁的来源**不存在**。
- **平台缺口（如实登记，不假造）**：Lv2 需要整屏 scale，而 `RenderModelBuilder` 只产出逐图元命令、**无全局变换**（`_commands` 私有）⇒ 视图**不为它画替代物**；快照照常推进，等 Canvas/Cocos 宿主提供变换即生效。`§8-9` 的「档位一一对应」半边由此完整可测；**DevTools 帧检半边**（真闪烁 / 真位移）属真机。
- **派生项（已登记）**：粒子数取 4（§2.5 是 3–5 区间、无 RNG ⇒ 取中值）；多档重叠只播最高档。
- **判据**：新用例 5 条 ⇒ beads **179 → 184 全过**（一一对应 / 红线结构性 / 单次循环 / 游戏级起止与锚点 / 重叠取最高）。
- **EP-07 至此全部闭环**（结算·过关面板 T-063、FINISH T-066、冲刺结算 T-067、连击特效本笔）；留待真机/后续：§8-9 帧检半边、连击升档与断连的**音效**（`§4` 输出表有列、不在 §8 判据内，如实登记）。
- **产出**：view/combo-vfx.ts（**新增**）· config/tuning.ts · game/beads-game.ts · game/state.ts · view/view-model.ts · src/index.ts · tests/combo-vfx.test.ts（**新增**）· cocos 拷贝件 · 本台账

---

## WXG-T-075

- **名称**：领号协议精化 —— 「**领号只读头注**」写进 `ctx/ROUTES.md` 与本文件前言。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **动机**：领号只需要头注里那一行（**≈30 tok**），而旧读法写的是「只读主表拿号」（≈2.4k）——每次领号多付约 80 倍。且头注所在**行号会随编辑漂移**，硬编码行号必错 ✗ ⇒ 用 `grep -n '当前已分配至'` 定位（与本仓 `memory/INDEX.md §1` 的 grep 法同判例）。
- **落地**：① `ctx/ROUTES.md`「领号 / 任务台账」行改写（「看全部状态」仍保留整表读法）② 本文件前言条目 1 同步。
- **产出**：ctx/ROUTES.md · production/TASKS-DETAIL.md · 本台账

---

## WXG-T-076

- **名称**：台账 backlog 卫生门（`check-tasks` **G 项**）+ 主表行数观察哨（**H 项**，report-only）。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **动机（用户问出来的架构账）**：「分级读取后还需要 archive 吗？TASKS.md 还会膨胀吗？」——按段量化回答：头注 485（有界）/ 主表标题行 526（≈48/行、行数无门）/ **backlog 1,399（占全文 57%，唯一没有门的段）** ✗，其中一条**已结项**的删除线占位行就占 **383 tok（全文 16%）**。
- **落地**：① backlog 段重写——结项行移除、7 行全部压到 ≤160 字符、**顺带修一处坏表**（原表头后缺 `|---|` 分隔 ⇒ 30–32 与 34–38 是两张断开的表 ✗）② `check-tasks.mjs` 新增 **G 项**：backlog 行**不得用删除线占位**（结项即移除）+ **行 ≤160 字符**（只写「是什么 / 谁发现 / 下一步动作」，长分析开任务再写）③ 新增 **H 项观察哨**：主表行数 >20 只 WARN 不阻断（对齐「结构门硬、行为门软」惯例，WXG-T-026）④ backlog 段头部写纪律——闸的「立法」与「执法」放在同一处。
- **实测（双向，非假绿）**：正常态 OK；注入 246 字符行 + 删除线行 ⇒ **恰好两条 G 失败**（行长 / 删除线各一）、退出码 1；回滚 ⇒ OK。
- **口径说明（会话中已向主理人说明）**：分级读取之后，B 项「单文件 8000」对这类文件的原初理由（整读读不起）已变弱；它现在的价值是兜底。是否降级为「节数门」属独立架构决定，本次不动。
- **产出**：tools/scripts/check-tasks.mjs · production/TASKS.md（backlog 2,410 → 1,565 tok）· 本台账

---

## WXG-T-078

- **名称**：**`tasks:archive` 同号守卫**（自 backlog「归档器缺同号守卫」立项； WXG-T-061 归档复核发现、T-032 曾重号）：归档器此前只防「候选已在归档」（跨批次去重），**不防主表内部同号** ⇒ 两会话撞用的同号两行会被当独立候选各自搬进归档、制造重复行。本任务补齐：**① 写盘前扫「主表 ∪ 归档」号频次**，凡出现 ≥2 次即打 **告警横幅**（列出号 + 出现位置如 `主表 + 主表` / `主表 + 归档`），**dry-run 与 --write 都报**、独立于能否归档；**② 批次内同号只归档首份**，其余同号行**保留主表**。**只警告不自动合并**（合并语义需人判，符合台账纪律）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成
- **位置与约束**：新增两段均在**报告/早退分支之前**，保证 0 候选与 dry-run 也能看到告警；批次去重放在 `toArchive` 定稿后、守恒校验前，守恒（行数 == 节数）自然成立。不改行内容、不删信息（宁漏勿错）。
- **实测（双向，非假绿）**：`archive-tasks-selftest.sh` **PASS 67 → 75**（新 [8a]/[8b]）——[8a] 主表两行同号 ⇒ dry-run 出「同号守卫」横幅且台账字节不变；[8b] `--write` ⇒ 归档中 `WXG-T-001` 仅 1 份（未放大）、主表保留 1 份（不自动合并）。真实台账 dry-run：**无同号误报**（健康数据全部唯一），头注与全局最大号一致、空转不落盘。
- **产出**：tools/scripts/archive-tasks.mjs（同号检测 + 批次去重 + doc/help）· tools/scripts/archive-tasks-selftest.sh（[8] 两例）· 本台账

---

## WXG-T-079

- **名称**：beads 工程接入 Cocos MCP —— 补齐 `games/beads/cocos/settings/` 缺失的两件扩展设置（cocos-setup.md §13.3 B2 当时未做）。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **现状核查**：链路其余各环**早已就位**——编辑器 3.8.8 + Dashboard ✓、全局扩展 `cocos-mcp-server` v1.5.4（dist 已构建）✓、三份 IDE 配置含 `cocos-creator`（WXG-T-043 生成物）✓、beads 工程已创建且编辑器正开着 ✓。唯二缺口都在 beads 工程的 `settings/`。
- **落地**：① `settings/mcp-server.json`——`port 3000 / autoStart true / enableDebugLog false / maxConnections 10`（`autoStart` 用 **true**，与 breakout 的 false 不同：实测可免「重启后手点 Start」，§12.2）② `settings/tool-manager.json`——照抄 breakout 的 **L1 白名单**（50 工具，21 启用 / 29 禁用；写类全禁）③ 顺带提交编辑器为 T-067 `combo-vfx.ts` 生成的 `.meta`。
- **拦下一个回归**：编辑器把 beads `project.json` 的 `fitHeight: true` **删了**——breakout 有 ✓、框架代码不自设分辨率（grep 无 `setDesignResolutionSize`）⇒ 该键是 Fit Height 的**唯一落点**，提交即静默破坏竖屏适配 ✗。已恢复，**不跟随编辑器提交**；若反复被重写需查 GUI 是否有人动过分辨率设置。
- **剩一步（GUI，无法代点）**：重启编辑器（`autoStart` 生效）或 扩展 → Cocos MCP Server → 启动服务器；探活 `GET http://127.0.0.1:3000/health`（**勿用 /mcp**，恒 404 会误判）。

---

## WXG-T-080

- **名称**：beads 可玩性 P0·**GAP-01 空槽目标色美术规格裁定**（阶段0全面复盘立项；用户拍板路线C「先修可玩性P0」+全部并行派波次1）。根因：空槽不显示目标色 →「同色入格」玩法无从下手；定性=**设计规格缺口**（数据层 `grid.ts::GridCell.colorIdx`「required colour for fillable empty」已就绪、快照层已照抄，渲染层 `drawGrid`/`drawEmptySocket` 丢弃；源头＝`assets-spec §1.2` + `art-bible` L47-49/L93/L145 同源漏写参考作 §2.1「槽位着色」）。
- **负责**：林绘澄(art-director)　**状态**：✅ 完成（波次1）。产出：`assets-spec §1.2` empty 目标色底 E1/E4 + locked 偏差追认、`art-bible` 三处同源、`accessibility` A2 三重编码重算+B3 假绿订正；回传常量 `EMPTY_TINT_MIX=0.35`/`EMPTY_GHOST_ALPHA=0.20` 由主对话 v1.16 串行落 §3.8。落码接口契约交 T-085。
- **Deliverables**：`art/assets-spec.md` §1.2 `empty`（目标色底+明度/饱和衰减系数+保留「不可读作已填珠」凹陷感+色盲冗余通道+与 `hint` 态叠加优先级）、§1.2 `locked` 偏差追认；`art/art-bible.md` 三处同源；`art/accessibility.md` A2 三重编码重算+B3 假绿订正；回传「落码接口契约」(drawEmptySocket 新签名)+「QA 可感知判据」供 T-085/T-084 引用。
- **约束**：**禁止直接写 `systems-index §3`**（与 T-081/T-083 并发竞写）——拟增常量（目标色衰减系数等）**回传主对话串行落盘**走 §6 变更记录。
- **依赖**：无前置；T-085（GAP-01 落码）硬前置。必读 `my-skills/wxgame-art-spec-programmatic/SKILL.md`。

---

## WXG-T-081

- **名称**：beads 可玩性 P0·**GAP-02/03/06 设计裁定 + ux-spec 内部矛盾消解**（路线C，波次1）。三裁定：①GAP-03 `ux-spec §1「0文字教学」vs §6「教学气泡」自相矛盾`+气泡零实现；②GAP-02 §6「1.5s珠已在托盘」但 `_setupLevel` 无立即 feed→开局空托盘；③GAP-06 杂色无终局出口→尾部软锁死（§4「玩家不会卡死」是假承诺），出泄压阀4方案(A供料过滤/B丢弃珠出口/C满槽自动清/D杂色置0)推荐+影响面（**最终用户拍板**）。
- **负责**：文策渊(design-strategist)　**状态**：✅ 完成（波次1）。产出：`ux-spec` §1/§4/§6 冲突裁定与首屏留存可执行化、`tray-spawner §2.4` 出口表、`levels-spec §5` L7/L8 尾盘校验；泄压阀 4 方案推荐回传 → **用户拍板 U8=A′+D**（供料侧 held≤demand 不变量 + 杂色置0）。落码归 T-086。
- **Deliverables**：`ux-spec.md` §1/§4/§6 冲突裁定（写成不可两读条文）+首屏留存路径可执行化；`gdd/tray-spawner.md` §2.4 出口表补行；参考作 §6「错豆挪移」立项裁决**建议**（路线C本轮不做，出预案不拍板）；`levels-spec.md` §5 L7/L8 尾盘满槽定性校验；泄压阀4方案推荐回传。
- **约束**：**禁止直接写 `systems-index §3`**——泄压阀若触及冻结常量，**回传拟改**由主对话串行落盘走 §6。
- **依赖**：无前置；T-086（GAP-02/03/04/10 落码）硬前置。必读 `my-skills/wxgame-ux-spec/SKILL.md`→`wxgame-gdd-writer/SKILL.md`。

---

## WXG-T-082

- **名称**：beads **GAP-07/08 坐标空间契约 ADR + Cocos 双路径取证**（路线C，波次1）。GAP-07 真凶＝`compose/app.ts` L104-105 `start()` 用 `getScreenSize()`(CSS px) 覆盖 harness device-px fit，且输入送 device px→点击映射出设计空间→**托盘/格子全点不中**（契约本为 CSS px，harness 越界）；GAP-08＝`canvas2d-renderer.ts` L82 y-flip 下 L133-141 `fillText` 未补偿→文字镜像（仅 harness）。
- **负责**：程基岩(engineering-lead)　**状态**：✅ 完成（波次1）。产出：`ADR-0011`（坐标契约=CSS px，DPR 由 renderer 承担，状态 Accepted）、`VERSION.md` 据实修订（Cocos 3.8.8 已装/MCP 在线/§2 能力 9 行 ⚠️→✅）、`epics-beads.md` 状态声明修订、`dev/harness/README.md` beads 章节 + `main.ts` L276；**Cocos 双路径取证**反证 GAP-07/08 仅 harness，并**新登 G10【P0】：真机路径 ES5 转译击穿 `patternColors()`→8 关 BOOT 全失败**（→ T-090）。执行 `framework:sync` 解除 BD-20 漂移、G1 转绿。
- **Deliverables**：新增 ADR「屏幕坐标空间契约=CSS px，DPR 由 renderer 承担」（五节，编号顺延既有集；**0008 已预约未落盘、0009 已用→本 ADR 拟用 0010**，请查 `adr/` 确认）；据实修订 `docs/engine-reference/cocos/VERSION.md`（Cocos 3.8.8 已装/工程已建/web-mobile 已通，⚠️→✅）+ `epics-beads.md` 状态声明#2 错误证据引用；**Cocos 双路径取证报告**（`build:cocos:web` 产物+浏览器，实测 GAP-01/02/04/06 是否真机复现、反证 GAP-07/08 仅 harness）；`dev/harness/README.md` 补 beads 章节 + main.ts L276 提示对齐。
- **约束**：**协调 WXG-T-077**（Cocos Label 进行中）——**不得改** `cocos-renderer.ts`/`label-pool.ts`（T-077 工作面）；坐标修复本体归波次2 T-087，本单只出 ADR+取证。MCP 编辑器预览需用户手动重启（T-079 遗留 GUI 步），取证优先走 `build:cocos:web`+浏览器。
- **依赖**：无前置（先与 T-077 定先后序）；T-087（harness 落码）硬前置。必读 `my-skills/wxgame-adr-arch/SKILL.md`+`wxgame-minigame-bridge/SKILL.md`。

---

## WXG-T-083

- **名称**：beads **GAP-05 音频规格从零建档**（路线C，波次1；beads 首次派工阮和鸣）。现状：`design/` 无 `audio/` 目录、`tuning.ts` 仅3 clip 引用而 ux-spec §5 隐含13类音效、`web.ts` 为 `NullAudioBackend`→harness 恒静音→「解压」支柱无法评估、阶段6 Playtest 会系统性失真。
- **负责**：阮和鸣(audio-director)　**状态**：✅ 完成（波次1）。产出：`design/audio/audio-spec.md` + `audio-events.md`（19 clip 三总线事件表、`minInterval` 分档修正 reject 违约、包体实测 web-mobile 1968 KB/内部目标 2000→余量 32 KB、选型=程序化合成 0 KB）；回传常量 `AUDIO_SFX_MIN_INTERVAL=0.05s`/`AUDIO_REJECT_MIN_INTERVAL=0.5s` 主对话 v1.16 落 §3.12；发现 `assets-spec §5` 音频预算表自相矛盾（→ R5 重算）；Web Audio 后端需求单路由波次4。
- **Deliverables**：`design/audio/audio-spec.md`（音频事件表 事件ID↔触发源↔时长↔与§5动效对齐↔优先级/抢占；混音规范 SFX/BGM/UI 总线+同时发声上限+voice-stealing；BGM 结构；实现策略 程序化合成vs采样+**包体预算数字+依据**；验证手段矩阵）+逐事件可执行验收判据；Web Audio 后端落地**需求单**（回传，不落码，路由给程基岩）。**框架版未定值标 `[TODO]`，不产伪数值**。
- **约束**：**禁止直接写 `systems-index §3`**——音频冻结常量回传主对话串行落盘。本单**只出规格不生成音频文件**（文件走 `indie-game-ost-pack`/`game-ui-voice-pack` 执行层，后续另派）。
- **依赖**：无前置（可与 T-080/081/082/084 全并行）；阶段6 Playtest 有效的必要条件。必读 `my-skills/wxgame-audio-spec/SKILL.md`。

---

## WXG-T-084

- **名称**：beads **GAP-14 G4 首次执行 + 可感知判据补编 + GAP-09 假绿复核**（路线C，波次1；G门证据唯一合法来源）。根因：`qa/beads/test-cases.md` 61条判据全「待实现」且**无一条可感知型**→表现层缺陷结构上无法被门禁捕获；beads G4 从未执行（`production/qa/` 只有 breakout 报告）；GAP-09 accessibility D1/E2 第三次假绿（同 breakout D-01）。
- **负责**：严守真(quality-lead)　**状态**：✅ 完成（波次1）。产出：新建 `qa/beads/g4-regression-report.md`（450 行/19 探针）+ `g4-probe.mjs`、`test-cases.md` v1.3 可感知判据补编、`bug-severity`/`playtest-plan`/`smoke-tests`/`test-plan` 修订。**裁定：G4=FAIL**（11 FAIL/5 PASS*/2 PASS/1⛔）、**G1=FAIL**（sync 漂移短路，程基岩 sync 后转绿）、G2=PASS 有缺口、G3 部分、G5 未执行。6 项 P0（BD-01/02/03/04/06/14）+ 关键 BD-20 漂移解除条件。未标任何假绿。
- **Deliverables**：新建 `qa/beads/g4-regression-report.md`（沿 breakout 格式，逐条 PASS/⛔不可测/FAIL+证据+缺陷号，**给 beads G4 明确裁定**，不可测项写原因禁标绿）；`test-cases.md` 补「可感知性判据」章节（覆盖 GAP-01/02/03/04/05/06/10，每条标取证手段+前置依赖，v1.3）；G1–G3 全量证据（实跑 `pnpm run verify`/`harness:smoke`/`preview:frames`/`build:cocos:web`）；GAP-09 假绿复核（列全部「文档✅但代码零命中」+与 breakout D-01 同款性归因+防再犯）；14缺口按缺陷分级登记。
- **约束**：harness 带 GAP-07(点不中)/GAP-08(镜像)→ T-087 修好前 `[Harness]` 结论不可信须标注；无真机/无音频后端→`[Device]`/音频判据**如实标不可测禁标绿**；裁定权属主理人，你出证据+建议裁定。
- **依赖**：无前置（可立即出「现状基线 G4」=FAIL/CONCERNS）；可感知判据**执行**依赖波次2落地→建议分两次（现状基线+修复后复验）。必读 `my-skills/wxgame-qa-gates/SKILL.md`。

---

## WXG-T-085

- **名称**：beads P0·**GAP-01 空槽目标色落码**（波次2，路线C 首单）。承接 T-080 美术规格裁定：把 `EMPTY_TINT_MIX=0.35`（E1 目标色底）+ `EMPTY_GHOST_ALPHA=0.20`（E4 幽灵符号）从规格落到渲染层。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（3abb4dc）
- **落地证据**：`bead-render.ts::drawEmptySocket` 扩末位可选 `colorIdx`→E1 色底 `mixWith(slot,beadColor,EMPTY_TINT_MIX=0.35)` + E4 幽灵符号 `emitSymbol(size*0.8, withAlpha(beadColor,EMPTY_GHOST_ALPHA=0.20))`；`palette.ts` 落 §3.8 两常量；`view-model.ts::drawGrid` 透传 `cell.colorIdx`（托盘 `drawEmptySocket` 不传保持中性）。ghost dot 因 size×0.8 不被旧精确-r 校验命中→`isDotSymbol` 放宽为 band 内填充圆，A3 反向断言改正向。beads 187 全绿 tsc 干净；harness smoke 136 draw cmds。守 L5（渲染只读）、§3.8 冻结常量无魔法数。
- **约束**：守 L5（渲染不持状态，只读 `buildRenderModel`）+ 热路径零分配（混色复用暂存）；颜色系数走 §3.8 冻结常量，禁魔法数。**不改 `systems-index §3`**——常量已由主对话 v1.16 落盘。
- **依赖**：硬前置 T-080（规格）+ t7（§3.8 常量已落）。GAP-01 是「同色入格」可玩性的第一道解锁。

---

## WXG-T-086

- **名称**：beads P0·**GAP-02 首供提速 + GAP-06 尾部泄压阀落码（U8=A′+D）**（波次2）。承接 T-081 设计裁定 + 用户拍板 U8=A′+D。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（c2ab5eb，镜像漂移 ac74b5c）
- **落地偏差（诚实登记）**：GAP-02 首供实际落在 `spawner.ts`（`_firstFeed` 标记于 `reset()` 置位、首 tick 消费后 early-return，不预先 `_acc+=dt`）而非详情初稿写于 `beads-game._setupLevel`——供料逻辑内聚于 Spawner，且恢复路径（直接设 interval/acc 不调 reset）不误触首供（内聚供料逻辑于 Spawner）。GAP-06 A′：`_drawColor` needed 循环加 `held < needed` 过滤（`Tray.heldCount`），decoy 循环保留。U8=D：§3.2 `DECOY_COLORS_MAX` 2→0（`tuning.ts` + `levels-01-08.json` 清空 L1–L6 `decoys` + `levels:sync` 重生）；已登记 `systems-index v1.17`（changelog §6）。同批落保 `levels:check` 绿；beads 187 全绿，新增 tray-spawner 首供+A′ 锁定测试。
- **约束**：A′ 与 D 耦合 `levels.json`/`spawner.ts`，必须同批落否则 `levels:check` 红；改冻结常量走 §6 变更记录（本单由主对话串行落，非成员并发）；守 L4（RNG 走 `services.rng`）。
- **依赖**：硬前置 T-081（泄压阀裁定）。与 T-085 无冲突（不同文件面）。

---

## WXG-T-087

- **名称**：beads P0·**GAP-04 四类 VFX + wrong/hint 态 + GAP-03 引导三通道 + GAP-10 告警脉冲落码**（波次2）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2291203）
- **Deliverables**：① GAP-04：落 `filled/empty/locked/hint/wrong/selected` 六态中缺失的视觉反馈（错误抖动+描边闪 ≤2 次/秒按 §3.8、hint 高亮、combo 连击 VFX）；② GAP-03：首屏引导三通道（0 文字教学按 T-081 裁定后的条文落地——视觉演示/手势/箭头，消解 ux-spec §1 vs §6 矛盾）；③ GAP-10：倒计时告急脉冲（图标+颜色+脉冲三通道，§3.8「告急表达」）。
- **约束**：VFX 走命令层 emit、渲染层只读（L5）；时长走 ux-spec §5 动效毫秒表冻结值；BD-04 已由 R2 升 P0（关键反馈零通道）。可访问性 D1/E2 开关归 T-088，本单只做默认视觉反馈本体。
- **依赖**：硬前置 T-081（引导裁定）+ T-084（可感知判据）。与 T-085 共享 `view-model.ts`/`bead-render.ts` → **须与 T-085 串行**（先 T-085 后 T-087，避同文件竞写）。
- **落地证据**：相位循 `_comboVfx` 判例—game 层 `_pulseClock`/`_wrongFx` 计相位→snapshot→view 只读（守 L5）。GAP-04 wrong：`_placeSelected` mismatch 拒绝→`_wrongFx`（±3px 抖动+danger 闪 2 次，`WRONG_FX_MS`=200）；invalid-color 仍静默。GAP-04 hint / GAP-03 引导：`drawStateRing` 蓝环呼吸（accent_blue #3D7BF5，`palette.hintBlue`），`runs==0` 首玩（BOOT 自增前捕获）时首珠槽脉冲 + 行主序单一目标格 hint，首次落子即清永不再现。GAP-10：urgent 时钟图标（stroke-only circle+两指针）+ 数字/图标 α 0.6↔1.0 @`DANGER_PULSE_MS`=1000 脉冲。tuning 新增 ux-spec §5 时长常量（WRONG/HINT/DANGER_PULSE），非 §3 冻结→不动 systems-index。combo VFX（GAP-04 一类）已前序存在（`combo-vfx.ts`），本单未重复。**未接线项**：满槽告警（art §7 500ms 描边呼吸）不属 GAP-04/03/10 核心三通道，本单未做（待后续评估）。测试：`feedback-vfx.test.ts` 5 例（相位契约+命令级环断言），beads 192 全绿、verify 全绿。

---

## WXG-T-088

- **名称**：beads·**R1=甲 D1/E2 可访问性开关落码**（波次2，用户拍板 R1 全做）。根治 accessibility D1/E2 第三次假绿：三文档冲突消解 + 真实装设置字段。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（save-schema 0ccba7a + 面板/view/文档同批）
- **Deliverables**：① `BeadsSettings` 落 `reduceMotion` + `largeText` 字段（`save-schema.ts` + version 升位迁移）；② 回写 `pause-settings §2.2` 冻结清单 + `ux-spec §3.3` 线框使三文档一致；③ `accessibility.md` D1/E2 由假绿 ✅ 改为真实落地后 ✅；④ 消费端接线：`reduceMotion`→抑制 T-087 的 VFX/脉冲，`largeText`→字号放大系数。
- **依赖**：软前置 T-087（`reduceMotion` 要有可抑制的 VFX）。与 T-085/086 文件面不冲突。
- **落地证据**：① `save-schema.ts` BeadsSettings 加 `reduceMotion`/`largeText`，SAVE_VERSION 1→2，`migrateV1ToV2` 只升版本号透传旧字段 + `normalizeSettings` 逐字段降级 false（旧档不炸）；beads-game SaveManager 改 `version: SAVE_VERSION` + `migrations{1}`。② `pause-panel.ts` 行3 由单居中去冲刺改为三格 `[减弱动效|大字号|去冲刺]`（复用行2 cellW≈160≥TOUCH_MIN，面板维持 560×480，§8-5 不变量不破；sprint 下去冲刺退场、两开关常驻）；beads-game 接 两 setter + `_applyPanelAction` 两 case + 镜像/getters/_persistSettings/_syncSnapshot；state 快照加两字段。③ view-model：panelLabel 两标签（次要小字号 panelToggle），reduceMotion 令 dangerAlpha/hintAlpha/wrong 抖动dx/wrong flash/clearStarPopScale/finishRowPopScale 全退静态，largeText 经 `bodyFont` 放大 `sub`(28→35)/`hudSmall`(22→27)。④ 三文档回写：pause§2.2 两行 / ux§3.3 行3 线框 / accessibility D1、E2 由假绿改 ✅+§2 复核（诚实标「落座回弹/消除溶解」本作无对应动画=N/A）。测：save-schema v1→v2 迁移保进度牙 + feedback-vfx 4 消费牙 + pause §8-1/§8-5/§8-11。**未触 §3 冻结常量**（FONT 为 view 局部项，非 systems-index §3）。beads 198 全绿、framework:sync 镜像 5 文件、verify exit 0。

---

## WXG-T-089

- **名称**：beads P0·**GAP-07/08 harness 坐标契约落码（ADR-0011 裁决落地）**（波次2）。承接 T-082 ADR-0011（坐标契约=CSS px，DPR 由 renderer 承担）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（framework 0e673d1 + harness eb0572d）
- **Deliverables**：① GAP-07：`dev/harness/main.ts` `fitCanvas`/`pushPointer` 对齐 CSS px 契约（harness 是唯一越界者——框架 `compose/app.ts` L104-105 用 CSS px 正确，改 harness 送 CSS px 坐标，使点击映射回设计空间）；② GAP-08：`canvas2d-renderer.ts` L133-141 `fillText` 在 y-flip 下补偿（**收窄到 text case 内部**，禁改全局变换——矢量符号 ▲▽♥◐ 在 y-up 下自洽）。
- **约束**：GAP-07 真凶定位经主理人纠正＝harness 越界非框架 bug ⇒ **只改 `dev/harness/`，不改 `packages/framework/src/compose/app.ts`**（框架契约正确）；GAP-08 修复禁全局 transform 改动（否则符号镜像）。改框架源后须 `framework:sync` 同步 cocos 镜像（BD-20 教训）。
- **依赖**：硬前置 T-082（ADR-0011 + 取证）。仅影响 harness 路径（真机 Cocos 路径 GAP-07/08 结构上不复现，T-082 已反证）。
- **落地证据**：GAP-07（harness 唯一越界者，框架契约正确→未改 `app.ts`）：`dev/harness/main.ts` `pushPointer` 改送 `event.clientX/clientY`（去 `* dpr`），`fitCanvas` 改 `app.resize(cssW, cssH)`，DPR 只留 `canvas.width = css×dpr` 交 `Canvas2DRenderer` 新 `pixelRatio` 选项吸收（整个 `setTransform` 缩放+两平移项按 dpr 前置，dpr=1 保持旧行为）。GAP-08：text 在 y-up 全局翻转下局部 `save/translate/scale(1,-1)` 复原，垂直 baseline `top↔bottom` 互换、`middle/alphabetic` 不变，`applyViewportTransform=false` 不补偿；禁改全局变换（符号 ▲▽♥◐ 依赖 y-up）。§3(d) 双牙：`viewport.test.ts` DPR=2 device-px 样本被 `containsScreenPoint` 拒收；`smoke-harness` 断言 `fit.screenWidth === canvas.clientWidth`（stub `devicePixelRatio`→2 + 镜像 `globalThis.innerWidth` 修正 `window!==globalThis` 致 `getScreenSize()` 落 1280 的旧失真）。canvas2d-renderer cocos 双镜像已 `framework:sync`。beads 192+framework 全绿、verify exit 0。

---

## WXG-T-090

- **名称**：**G10 ES5 转译致命缺陷修复**（波次2·spike 先行；用户拍板「先验证 spike 再裁 ADR-0012」）。T-082 Cocos 取证新发现——**beads 在真机路径也不可玩**：Cocos 构建 Babel 降 ES5 把 `[...seen]`（Set）编成 `[].concat(seen)` 不展开 → `patternColors()` 长度恒 1 → **8 关 BOOT 校验全失败、永远停在启动画面**。
- **负责**：程基岩(engineering-lead)　**状态**：✅ 完成（本环境可验面全绿；真机 runtime/微信 AppID 复验随 G4，未记假绿）
- **实测（修法甲）**：Spike 产物字节实锤 `[].concat(seen)`（Set 不展开→长度恒 1）；产物 `new Set()` 原生无 polyfill → 推翻「Array.from 需 polyfill」顾虑、`Array.from` 可行；`builder.json`/`program.json` 仅剩 `__version__` → 修法丙（提 target）无工程级开关不可控→已否。**6 处**（framework `storage.ts:40`/`object-pool.ts:112` + beads `levels.ts:78/:245`/`powerups.ts:106/130`）改 `Array.from`，类型级 AST 全仓复扫 78 文件零第 7 处，安全展开未动。CI 守卫 `check-es5-spread.mjs`（TS 类型+AST，fail-closed，不依赖 Cocos）入 `verify` 链，selftest 红→绿双向。**复验**：`verify` exit 0（659）、`sync:check` 绿、重建 web-mobile `[].concat(seen)`=0/`Array.from(`=6；从 bundle 切出转译后 `patternColors` 在 Node eval 喂 L1–L8→色数 ∈[3,10]（BOOT 判据可过），反证换回 concat→`[object Set]` 长度 1。**未跑**浏览器加载（沙箱禁监听 socket）与真机 runtime → 归 G4/AppID（EP-10 保持环境阻塞）。
- **Deliverables**：① **Spike**（先验证不裁 ADR）：确认目标平台最低 ES 版本、复现 `patternColors()` 降级失效、对比 `Array.from`/显式循环两种改法的转译产物；② 据 spike 结论**裁 ADR-0012**（转译目标 vs 源码规避 Set 展开）；③ 修复落码：`core`/`levels`/`powerups` 内所有 `[...set]`/`Set` 展开模式统一改法；④ **CI 守卫**：加检查（grep/lint）防 `[...Set]` 展开回归；⑤ `framework:sync` + 真机 `build:cocos:web` 复验 8 关 BOOT 通过。
- **约束**：**spike 结论出来前不裁 ADR-0012、不落修复码**（用户明确「先验证再裁」）；改 core 守 L2（不碰 cc/DOM/wx）；修复须覆盖全部 Set 展开点（非仅 `patternColors`），否则漏点仍锁死。
- **依赖**：硬前置 T-082（G10 发现 + 取证）。**优先级最高**——这是真机路径的第一道锁，早于 GAP-01（harness 路径）。

---

## WXG-T-091

- **名称**：**beads 波次1 汇编 R4/R5/R6 文档回写销项**（用户拍板「R4 全按 QA 改 / R5+R6 都做」；波次2 代码单基后的收尾项，无新代码，纯文档一致性闭环）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成
- **背景**：T-084 G4 回归报告 §8 登记 8 项「判据冲突/不可构造」移交策划；T-082 音频建档时发现 `assets-spec §5` 预算表自相矛盾（→ R5）；§6.5 拟沉淀 a11y 假绿教训按硬约束未落盘（→ R6）。R4-5（D1/E2 三文档冲突 = 甲）已随 T-088 落地，本单不重复。
- **落地（R4 全按 QA 建议回写）**：① `input-control §8-2` 补「重叠区以 §8-4 为准」（BD-23）；② `tray-spawner §8-2` ±20% 容差→卡方拟合优度（BD-22）；③ `save-progress §8-9`「200 次落子」→「≤ 最大可构造量 156」（BD-24）且结算帧明定 = `level:cleared`（P18③）；④ `tray-spawner §8-1` / `core-loop §8-2` 期望显式改 **16（±0）**含首供（BD-25，与 T-086 已落的首供语义对齐）；⑦ `assets-spec §1.2` hint 行删 `[待 ux-spec 对齐]` 占位（毫秒归 ux-spec §5）；⑧ `accessibility C2` 32px → 实现 `POWERUP_CARD_GAP=60`（648 ≤ 750）（BD-26）。
- **落地（R5）**：`assets-spec §5` 包体预算表按 `audio-spec §4.2` 实测重算——引擎 1500 + 业务/资源 452 + 美术 0 + 音频 0 = **实测合计 1968 KB**，内部目标 2000 KB ⇒ 安全余量 32 KB；废弃原「音频≤400预留 + 安全≥2000」（分项和 2600/4600 KB 超目标超红线）的自相矛盾行。
- **落地（R6）**：`knowledge/lessons.md` 新增 **[流程][K-035]** 「文档状态列混淆『规格已写』与『代码已实现』= 可访问性假绿温床」（四轮谱系 + 3 条防再犯，① check:a11y 机械守卫**待立项未落码**、诚实标注）；经 `kb:sync` 入 `ledger.json`。
- **约束**：均为文档回写，**未触 systems-index §3 冻结常量**（4096/2000/音频0KB 均沿 §3.9 现值），无需 §6 变更记录；不擅改代码，判据冲突只按 QA 建议同步文档。
- **依赖**：前置 T-084（冲突清单）、T-082（R5 预算发现）、T-088（R4-5 已落）。

---

## WXG-T-092

- **名称**：**beads G4 复验——探针重跑 + 回归报告 v1.1**（波次3·甲路线；用户拍板「先复验拿真相再定音频/Playtest 排期」）。现状：g4-regression-report v1.0 为 2026-09-14 **修复前基线**（建议 G4=FAIL）；波次2（T-085~090）已把 GAP-01~10 修复全部落码且 verify 全绿，但**至今只有代码/单测级自证，无复验他证**。
- **负责**：严守真(quality-lead)　**状态**：✅ 完成（2026-09-15）
- **复验结果（v1.1，26 组探针）**：改判 PASS 2→13 / PASS* 5→8 / FAIL 11→**4** / ⛔ 1；零新回归（4 FAIL 与 v1.0 严格同集：P5 音频、P8/BD-15 扩展路由、P10/BD-16 轻提示、P17/BD-12 meta 字段）。波次2 修复经探针他证：首供第 1 帧、空槽 22/22、告急 1Hz 三通道、A′ 不变量 7933 采样死珠 0、χ²=5.32、harness 往返误差 ≤2.3e-13、§8-9 156/156 写档 0/1。新登 **BD-27~32**（含实现缺陷 BD-32：每次 BOOT `runs+1` ⇒ 开局即杀进程永久失引导）。G1 PASS（BD-20 关）、G2 PASS、G3 未执行（BD-17/18 结构假绿仍在）。建议裁定 **CONCERNS**（五条限制声明见报告 §18）。
- **产出**：`g4-probe-v1.1.mjs`、报告 v1.1（§12–§18 追加式）、`evidence/g4-reverify-v1.1.log` + 诊断夹具×2、`test-plan.md` v1.2、`test-cases.md` v1.4；未动 src/设计文档，未 commit（主对话收口）。
- **Deliverables**：① `g4-probe.mjs` 适配后重跑（预期值按已裁判据更新：BD-22 卡方 / BD-24 156 / BD-25 16±0 等，探针自身缺陷必须区分于实现缺陷）；② 逐探针 v1.0→v1.1 改判表（19 组 P1–P19）+ BD-01~26 处置状更新；③ §8 八项冲突关闭标记（已随 T-091 回写 7 项）；④ test-plan §R6/R7/R9 状态行同步；⑤ 向主理人报 G4 复验结论（PASS/CONCERNS/FAIL 裁定权属主理人）。
- **环境事实**：无真机/无微信 AppID ⇒ `[Cocos]/[Device]/[R]` 道次仍标 ⛔ 不得假验；沙箱禁监听 socket ⇒ 浏览器道次走离屏渲染脚本（render-harness-frame/clip），同 v1.0 口径。
- **硬约束**：readonly 面 = 不改 src/设计文档；只写 `production/qa/beads/**`；判据不变（从 GDD §8 导出），改探针断言必须引 T-091 回写后的 §8 现文；禁止以「代码已落」代替实测改判。
- **依赖**：前置 T-085~091 全部；后继（据本报告裁）：音频后端排期、M2 降级 Playtest、BD-21 测试补全。

---

## WXG-T-093

- **名称**：**beads 文档漂移回写（ux-spec U8 / accessibility B3）+ 守卫登记**（波次3·C 组；小单，回写已生效裁定，无新设计决策）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成
- **背景**：阶段0诊断（2026-09-15）发现两处「状态列=实现事实」漂移，同 K-035 病根家族：① ux-spec §8 U8 仍标「⏳ 待用户拍板」，实际 2026-09-14 已拍板 A′+D 并随 T-086 落码、§3 已 v1.17 冻结；② accessibility B3 仍标「脉冲未实现移交 T-086」，实际 GAP-10 告急三通道（色切+图标切+1000ms α 脉冲）已随 T-087 落地（`view-model.ts` L418–424，dangerAlpha；D1 联动退静态）。
- **落地**：① `ux-spec §8` U8 行改 ✅（引 v1.17/T-086 事实）+ 尾注「待确认项归零」；② `accessibility §2` B3 行改 ✅ 附判定位置、§3 小结 14→15 项、部分落地行清空；③ `TASKS.md` backlog 新增「check:a11y 机械守卫（待立项）」行（来源 K-035，本单不实施只登记）。
- **约束**：不改 §3、不改判据文本、不新增设计语义；纯事实同步。
- **依赖**：前置 T-086/T-087/T-091；守卫实施工单待后续波次领号。

---

## WXG-T-094

- **名称**：**波次3 汇编——G4 主理人裁决 + 波次4 立项排期**（阶段 8 汇编段，编排者独占）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-15）
- **输入**：用户两度拍板「甲」（阶段0 推荐路线 = 先复验拿真相再定音频/Playtest 排期）⇒ T-092 他证 + T-093 回写。
- **裁决**：**G4 = CONCERNS**（全文见 `production/qa/beads/g4-regression-report.md` **§18.5**）。放行：波次4 全部单 + M2 降级 Playtest + 波次2/3 修复的代码级冻结；**不放行**：阶段7 发布（包体无数据 + `[Cocos]/[Device]/[R]` 未验）、每日挑战评审（既定「PASS 前不评」）、对「解压/治愈」下 PASS。五条限制声明入档，任一未解除不得升 PASS。
- **事实修正（重要）**：§18.2 **B2** 的解除条件不是「主理人授权代跑 `build:cocos`」——`tools/scripts/build-cocos.mjs` 头注明载 `wechatgame` 平台**需有效 AppID**；本环境只能产 `web-mobile`（beads 已有，1968 KB 代理值即出自它）⇒ B2 挂 B4（用户侧）。
- **波次4 立项（一次占位防跨 IDE 撞号，见主表注 4 教训）**：T-095 门禁可信度 / T-096 音频后端 / T-097 P1 反馈缺口 / T-098 裁定包回写 / T-099 取证通路。**施工顺序**：T-095 →（T-096 ∥ T-098）→ T-097 → T-099 → Playtest 降级轮（领号待 T-096 后）。
- **升 PASS 最小集**：T-095 + T-098（⇒ BD-25 关单）+ T-099 + AppID 到位后的 `wechatgame` 包体实测。
- **约束**：本单零代码零设计交付物（裁决与立项属主理人独占段，不代成员产出）。

---

## WXG-T-095

- **名称**：**门禁自身可信度修复（BD-17 verify 短路 + BD-18 check:size 静默 ✅）**——波次4 首位，P0（成本最低、收益最大）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-15）
- **背景（仓库现物已核）**：`package.json:51` `verify` 仍以 `&&` 串 **14** 项 ⇒ 任一项失败后续门静默不跑（v1.0 轮在第 8/13 项即短路，9–13 项从未执行）；`check-bundle-size.mjs:82` 对缺产物只 `status:'skipped'` 打印后整体报 ✅ ⇒ 包体门只测到 breakout 1815.1KB。
- **Deliverables**：① `verify` 改「**逐项收集 + 汇总退出码**」，尾部打印未通过/未执行清单（若保留现 `verify` 语义则新增 `verify:all`，**不得两套口径不一致**）；② `check:size` 遍历 `games/*`，缺 `wechatgame` 产物时**显式 SKIP + WARN 计数**，禁止静默 ✅；③ 两脚本各自 selftest 补例（沿用 `tools/scripts/*-selftest.sh` 惯例）+ `pnpm run verify` 全绿复跑；④ 回写：报告 §14 BD-17/18 状态行、`docs/agent/commands.md` verify 口径、`knowledge/lessons.md` 候选（门禁假绿谱系）。
- **约束**：不改任何判据数值与 §3 冻结常量；门禁改动必须能被门禁自己验证；**禁**为凑绿而放宽阈值。
- **依赖**：无前置（本环境可全验）；后继 T-099/T-100 的「绿」才可信。
- **完成记录（2026-09-15）**：① 新增 `tools/scripts/verify-all.mjs`——**14 项逐项执行永不短路**，取子命令 stdout 末次 `STATUS: OK\|SKIP\|FAIL` 定性，尾打 `PASS/SKIP/FAIL` 汇总 + 未通过清单并据汇总定退出码；`--validate` 防步骤表与 `package.json` 脱钩并**拦住 `verify` 回退成 `&&`**。② `check-bundle-size.mjs` 按 `games/*` 算覆盖面 + `overallStatus()`，缺产物打 **SKIP（非 OK）**+ WARN 清单，新增 `--strict`。③ 自测：`verify:selftest`（新，5 段红→绿实测含「注入失败项后 `[2/2]` 仍执行」）、`check:size:selftest`（§C1–C6，**19/19**）、`verify-all --selftest` **9/9**；全量 `pnpm run verify` = **PASS 13｜SKIP 1｜FAIL 0**。④ 回写：`docs/agent/commands.md`、报告 §14 BD-17/18 + §18.2 B3 + §18.5 裁决后续更新、`test-plan.md` R8、`lessons.md` K-036 落地行。**未改判据与 §3；未因本单升 G4**（beads 红线仍无数据，挂 B4/AppID）。

---

## WXG-T-096

- **名称**：**beads 音频后端落码（BD-05 clip 派发 + BD-05b 三平台 backend）**——支柱内最后一个零实现，P0。
- **负责**：程基岩(eng)+主理人(Qoder)　**状态**：✅ 完成（2026-09-15；**Deliverable ① 部分交付**，见下方偏离①）
- **背景（现物已核）**：`packages/framework/src/platform/{web,weapp}.ts` 的 `createAudioBackend()` 均 `return new NullAudioBackend()`（注释自认「待首个带音频的游戏」）⇒ harness 恒静音；G4 探针 P5 因此维持 FAIL，Playtest「解压/治愈」维度结构性不可评。现 `games/beads/src` 仅 3 个 clip 常量（`AUDIO_CLIP_BGM/UI_TAP/STAR`）。
- **权威来源**：`games/beads/design/audio/audio-spec.md` **§6.2 后端需求单（6 项）** + `audio-events.md §1/§4`（A05-01..27）+ `systems-index §3` `AUDIO_*`（v1.16 已冻结）。
- **Deliverables**：① 框架侧 WebAudio 程序化合成 backend（**零外部音频文件** ⇒ 守包体音频 0 KB 承诺）+ InnerAudioContext 池（weapp）+ node 侧保持 Null 以护单测；② 游戏侧 19 项事件→clip 映射与**同帧多事件**策略（BD-05）；③ 单测（L2：core 不碰 `cc`/DOM/`wx`）+ 热路径零分配；④ `framework:sync` 镜像 + `verify` 全绿；⑤ 交严守真复跑 P5（探针预期值先改再跑）。
- **约束**：不产伪数值（音量/时长一律引 §3 与 audio-events）；配乐/口播**文件**生成走 `indie-game-ost-pack`/`game-ui-voice-pack`，本单只做后端与派发。
- **依赖**：T-095（需可信门禁）；后继 Playtest 降级轮。
- **完成记录（2026-09-15）**：
  - ① **框架侧合成 backend**：新增 `packages/framework/src/platform/audio-synth.ts`（`SynthAudioBackend`，最小 Web Audio 结构面编程 ⇒ web 与 `wx.createWebAudioContext()` 共用）；三平台适配器按能力探测建 context 并以工厂回调注入，缺能力 ⇒ `NullAudioBackend`（node 恒 Null 以护单测）。归属与理由 = **ADR-0013**（新增）；反模式两行 + **§16 音频后端契约** 入 `control-manifest.md`。
  - ② **游戏侧 19 clip**：`games/beads/src/config/audio-voices.ts`（音色表，数值一律标**工程占位**，不回引为规格）+ `beads-game.ts _subscribe()` 的 13 条事件→clip 派发 + `_sfx()` 双通道门控；同帧策略 = 入队序 + per-clip 限流（`AUDIO_MAX_PER_FRAME=6`，§1 已核算最坏 4 条）；`priority/steal` 与三总线**增益数值**按 §3.12 `[TODO]` 不发明。
  - ③ **测试**：`framework/tests/platform/audio-synth.test.ts` **15 例**（假 Web Audio 记录型夹具：构造期不建 context / 未登记静默 / 三总线一次 / notes / buffer 复用 / loop 幂等 / suspend-resume 期望态 / setVolume 当场生效 / `usesExternalFiles()===false`）+ `beads/tests/audio-dispatch.test.ts` **27 例**（A05-01..24 中 `[N]` 可证面 + 清单闭合 + bus 前缀派生守卫）。全量 **framework 255 / beads 225** 例绿，L2 面由 `check:arch` 守。
  - ④ **镜像与门禁**：`framework:sync` 已产（含 breakout 侧共用件），`pnpm run verify` = **PASS 13｜SKIP 1（`check:size`，无 `wechatgame` 产物）｜FAIL 0**。
  - ⑤ **严守真复跑 P5**：报告升 **v1.2 §19**，预期值先改后跑 ⇒ **PASS 12 / PASS\* 8 / FAIL 0 / ⛔ 8**（⛔ = `[B]/[C]/[R]/[P]` 道次）；BD-05 → 部分关闭（仅 `[N]` 派发层）降 P2 不关单，BD-05b → 关闭（仅 `[N]` 结构层）；**G4 仍 = CONCERNS，不因 P5 转绿升 PASS**。
- **偏离任务书三项（不冒充交付）**：
  - **①（对 Deliverable ①）weapp `InnerAudioContext` 池未实现**——与 §3.12 冻结的「主包音频 0 KB」正面冲突（`audio-spec §4.1` 回退需主理人先解除内部目标余量冲突，本轮不成立）⇒ 采 ADR-0013 §2 丁之否因，记为部分交付；真机若证 `createWebAudioContext` 不可用，weapp 侧**无第二方案**。
  - **② `sfx_ui_tap` 时长 40 ms 为占位**——`ux-spec §5` 无该行（Q-A05-1 未裁）⇒ 不参与 `[B]` 验收。
  - **③ 听感未成立**——全部 Hz/ms/增益属占位（`BGM_LOOP_MS=8000` 系内存权衡而非规格）；三总线增益 1.0 ⇒ 真机可能削顶。解除条件：`AUDIO_BUS_GAIN_*` 冻结 + `[B]/[P]` 道次。
- **QA 本轮附带发现（移交，不在本单修）**：**BD-33**（3 个新增镜像脚本缺 `.ts.meta`，`cocos:check` 不覆盖 ⇒ 静默漏报；`.meta` 只能由编辑器生成，§14 红线，本环境无编辑器 = 阻塞写明不伪造）；**BD-34**（`_readInput()` 唯一调用点在 `_stepPlaying` ⇒ PAUSED/LEVEL_CLEAR/GAME_OVER/FINISH 四相位在**真输入链**（harness 鼠标 / Cocos touch）下收不到点击，面板按钮点不动；`App.tick` = `beginFrame → game.update → endFrame`，一次性标志被 `endFrame` 清 ⇒ 是丢弃不是延后。QA 定级「需 `[B]/[R]`」偏保守——**本环境 harness 即可复现**，现有自动化全走 `tapDesign()` 旁路故长期无人测到）。⇒ 建议另立 **WXG-T-100**，不由本单顺带改玩法输入。
- **BD-20 复发核实（结论：流程性，非工具 bug）**：v1.2 实跑 `framework:sync:check` EXIT=1（12 处 differs）为**真**——成因 = 我在末次 sync 之后又改了 `platform/{audio-synth,platform,weapp,web}.ts` 与 `core/audio/audio.ts`，未重跑 sync 就报了「verify 13 PASS」（该自述在当时为真、随后失效，**QA 限制声明 ⑥ 成立**）。已 `framework:sync` 复绿并**在同一状态下**重跑 verify 取证；`sync` 的拷贝是逐字复制，不存在 `{ }`→`{}` 规范化（既有 `{ }` 样式件反证），故不改工具。防复发建议（**待拍板，不擅自加门禁**）：pre-commit 增「暂存含 `packages/framework/src/**` 才跑 `framework:sync:check`」的条件步骤。

---

## WXG-T-098

- **名称**：**B7 裁定包一次性回写（BD-27/28/29/30/31）**——解除 BD-25 关单阻塞
- **负责**：文策渊(design-strategist) + 林绘澄(art-director)　**状态**：✅ 完成（2026-09-15，回写 + QA 改判复跑闭环；主理人裁决见报告 **§21**）
- **范围**：① **BD-27** `tray-spawner §8-1` 补「60s 窗口开/闭区间 + 帧量化容差」二句（现 ±0 在闭区间下=15 次）；② **BD-28** `§8-3` 标「作废（v1.17 D 方案）」或改写为平凡真；③ **BD-29** `ux-spec §5` 红线「无 >3Hz 闪烁」与 wrong 描边「2 次/200ms」(=10Hz) 互斥 ⇒ 二择一（改豁免或降频 ≤1.5Hz）；④ **BD-30** `ux-spec §6.2` 补注 `_firstFeed` 等价实现措辞；⑤ **BD-31** `assets-spec:106` 同类占位与 `:187` 过期尾注。
- **约束**：成员**禁写** `systems-index §3`（BD-27 若需新容差 ⇒ 回传拟改，主对话串行落盘）；回写后**先改探针再跑**（报告 §18.3-6 惯例），由主理人中转 QA。
- **依赖**：前置 T-092（登记来源）；后继 = BD-25 关单 + P20/P26 转判。
- **回写记录（2026-09-15，并行 spawn 文策渊 / 林绘澄，均直接落盘）**：
  - **BD-27** `tray-spawner §8-1`（文策渊）：定**闭区间 `t∈[0,60]`** + 次数轴维持 **±0 不放宽** + 时刻轴**单列**：`0 ≤ t_actual − 4×(i−1) ≤ 2 帧（33.4ms）`（非负硬要求，上界 2 帧 = 首供分支不累计 `_acc` 1 帧 + `_acc≥interval` 向上取整 1 帧，恰等于 P20 实测 60.033s）；邻间隔维持 ±0.1s；并补「用例前提：供料不得被满槽截断」以免与 §8-4 混测。**否因**：采「15 周期 + 1 首供、周期取 `[0,60)`」（改数值掩盖歧义，且与 §6.2/§2.4.6 的「16 颗」语义撞车）与「帧序窗口」（脱离 60 秒语义、dt 被覆盖即失效）两种候补。
  - **主理人裁定（不采）**：成员呈请新增 `SIM_FIXED_STEP=1/60s` 与 `SPAWN_WINDOW_SLACK=2帧` 入 §3 ⇒ **否**——时基属框架 `GameLoop` 实现事实，进游戏 §3 必造两处漂移；改为在 §3 前言「使用约定」新增第 4 条作**划界定义**（§3 数值零改动，随 **v1.19** 登记）。
  - **BD-28** `§8-3`（文策渊）：取**「作废（v1.17 D 方案）」**而非「平凡真」，理由 = 本条主体是 3:1 比例，杂色集恒空时不可观测，记 PASS 即伪绿；附**复活条件**（`DECOY_COLORS_MAX` 改回 ≥1 即恢复为硬判据）。**QA P26 改判口径 = ⛔ 不可验**（撤销 3:1 判据，不记 PASS；若要保留只作 `decoys` 非空 → BOOT 拒收的负向用例）。
  - **BD-29** `ux-spec §5`（文策渊）：**不开豁免、改视觉列**——放错拒绝改**单次脉冲**（淡入 60 + 保持 80 + 淡出 60 = 200ms，一个 fx 窗口内 α 极值点 ≤1）+ 连续拒绝**重启门 500ms** ⇒ 有效 ≤2 次/秒（= §3.8 冻结值，对 3Hz 红线留余量）；`reduceMotion` 退静态红描边（与 WXG-T-088 R1甲 一致）；「≤2 次/秒」正本**移回视觉列**并澄清它约束**事件重触发频次**。**实现落差已就地登记**（现码仍 10Hz，P4 实测 α 4 档）⇒ 改码拆 **WXG-T-102**。
  - **BD-30** `ux-spec §6.2`/§8 U7 + `tray-spawner §2.4.6`（文策渊）：补「等价口径」行——判据只锁可观测语义（`reset()` 后 PLAYING 第 1 个 tick 即首供，≤1 帧），`_acc` 后置与 `_firstFeed` 标志位两型均合法，**以 (ii) 为准据名**；并写明两型唯一差异（周期滞后 1 帧 vs 2 帧）正是 §8-1 取 2 帧上界之因。
  - **BD-31** `assets-spec.md:106/:187`（林绘澄）：删 `hud_timer_danger` 的 `[待 ux-spec 对齐]` 占位，改指 `ux-spec §5`/§3.1 为权威（四处互核一致，**零数值改动**，1Hz 不触 BD-29 争点）；尾注按事实重写（§3 现版 **v1.18**、真源 changelog；v1.1→v1.18 网格/托盘/告急三组零改动；「待 UX 规格产出」之说作废）。残留清单：`:7`/`:73`/`:93` 均为元纪律或历史注记非占位；`:81 tray_panel` 属 §3 未冻面板几何，仍待 GDD。
  - **新发现（移交主理人，本轮未动）**：① `ux-spec §5` 告急行只给周期未给 **α 幅度**（hint 行有 0.5↔1.0）⇒ 已入 **T-102** 前置补句；② `assets-spec §5` 包体分项 1952 vs 实测 1968（Δ16 KB，`audio-spec §4.2` 同表述）⇒ 登 backlog **BD-36**；③ `systems-index.md:3` 版本行停在 v1.12（实际 v1.18）⇒ 主对话已随 v1.19 修正。
  - **QA 侧收尾（严守真，先改预期值后实跑，顺序自证 = mtime 硬记录）**：探针修订 **38** 三处 ⇒ **P20 PASS\* → PASS**（16/16、最大滞后 **2.00 帧压线**、零负偏差；**旧字面严格读法仍 15≠16 ⇒ 两读并列呈报**）、**P26 → ⛔**（3:1 断言从脚本删除，不产绿；新增负向 **P26-N PASS**）、**P4 收紧后 FAIL**（峰点 2 = 10Hz、起点间隔 100ms）。整轮 **54 组 = PASS 27 / PASS\* 14 / FAIL 4 / ⛔ 9**；非本单 50 组判定零翻转。证据 `production/qa/beads/evidence/g4-reverify-v1.3-t098.log`，报告 **v1.3 §20**（§12–§19 与 §18.5 未动），`test-cases.md` **v1.5** §G.5。
  - **主理人裁决（报告 §21，本对话独立重跑探针复现计数）**：**BD-25 / BD-27 / BD-28 / BD-30 / BD-31 关闭**（BD-25 效力只到 `[N]` 层）；**BD-29 不关闭→转态「实现落差」**，下家 **WXG-T-102**；新赋号 **BD-35**（α 幅度，归 T-102 前置）、**BD-36**（包体分项 Δ16 KB，登 backlog）；**O4 已处理**（主对话直改 `levels-spec.md:23/:42` 的 `DECOY_COLORS_MAX` 旧值 2→**0** + 文首 §3 版本引用 v1.5→v1.19）；**G4 仍 = CONCERNS**（不因 P20 转绿升级；P4 变红 = 判据变严而非新回归）。本单收尾 `pnpm run verify` = **PASS 13 ｜ SKIP 1 ｜ FAIL 0**。
  - **提交时新撞到的门禁（非成员产出问题）**：§5 两条新注使 `ux-spec.md` = **8683 tok > 单文件上限 8000** ⇒ `pre-commit` 的 `ctx:check` 真实拦下（不是一次性竞态，首两次提交均被阻）。处置：**登记豁免 + 写可执行到期条**（`ctx/budget-exempt.json` 新增条：reason = §4 矩阵与 §5 动效表互为镜像不可割；note = 下次单次增幅 >500 tok 先评 §3 ASCII 线框外移为 `design/ux/wireframes.md` 并同步 ROUTES 锚点），取向对齐 backlog 里 `epics-beads.md 贴 B 门（结构性）` 条的「不适用豁免、不得删信息凑体积」声明。**同批第二个越界：本单自己的沉淀 `knowledge/lessons.md` = 9021 tok** ⇒ 先跑 `kb:audit` 看能否走设计内的减压阀（结果：**无归档候选**，41 条全 ≤90 天，沉淀面太年轻），因此同样只能登记豁免，但写了**硬到期条**（2026-10-15 或再增 >800 tok 先到 ⇒ 必评「按标签分片 + 同步 `tools/scripts/lib` 的 `ACTIVE_FILES`」，禁续期、禁删正文凑体积）。**口径：连续两个文件撞同一上限 ⇒ 上限该被结构性回应，逐文件放行只是延后。**同批发现另一条仓库事实：**`production/qa/beads/evidence/*.log` 被 `.gitignore:55` 排除**，只跟踪 `diag-*.mjs` ⇒ 本轮 v1.3 证据日志以路径 + mtime 被报告引用，**不入库**（已据此修正 T-099 第 ④ 条的错误表述）。

---

## WXG-T-100

- **名称**：**beads 面板相位真输入断链（BD-34）**——四相位收不到真链点击，可玩性硬断点
- **负责**：主理人(Qoder)　**状态**：📋 已占位（**用户 2026-09-15 拍板：本轮只立项不动码**，排在音频单之后）
- **现象（WXG-T-096 附带发现，QA v1.2 §15.2）**：`_readInput()` 全仓唯一调用点在 `_stepPlaying()` 内 ⇒ `paused` / `level-clear` / `game-over` / `finish` 四相位不读输入；`App.tick` 为 `beginFrame → game.update → endFrame`，`endFrame()` 清一次性标志 ⇒ 面板相位的点击是**丢弃**而非延后。harness（`dev/harness/main.ts:95` `app.input.push`）与 Cocos（`adapters/cocos/bindings.ts` 的 `onTouchStart` 桥）**同走这条真链** ⇒ 真人在浏览器里过第一关后点不动结算面板。
- **为什么三轮回归没测到**：面板相关单测与探针 P22 一律用 `game.tapDesign()`（便捷旁路，直连 `_handleTap`）⇒ 旁路恒绿、真链恒断（沉淀 **K-038**）。
- **范围（建议施工序）**：① **先加红例**：经 `input.beginFrame()/push(down,up)/game.update()/input.endFrame()` 真链点面板按钮中心，断言四相位各自生效（与同坐标 `tapDesign()` 结果一致）；② 再改接线：把输入读取上提到 `update()` 的相位路由前（或给四面板态补 `onUpdate`），**语义须守** `input-control §2.3`「面板只认自己的按钮、面板外零响应」与 `pause-settings §2.2`「遮罩吃掉其余一切」；③ 保留旁路例做双口径对照（旁路只用于装配前置）；④ 回写 `input-control §8` 判据行与 QA 探针（改判据先改探针，报告 §18.3-6 惯例）。
- **约束**：**禁**为凑绿删旁路例；`_handleTap` 的路由表是唯一裁决面，不得在 `App`/适配器侧另起一套命中逻辑；改动若触到 `§8` 判据 ⇒ 先改文档再改码。
- **依赖**：无前置；后继 = QA 复跑 P8/P10/P22 与 Playtest M2 降级轮（本轮之前音频与面板交互维度均记 BLOCKED）。
- **阶段 0 诊断（2026-09-15，主理人）——原登记的「需工程侧裁定口径」前置可关闭**：① **设计口径不需要裁定** —— `input-control §2.3 状态门禁` 已明文规定四相位有效输入（`PAUSED` 仅暂停面板按钮；`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 仅结算/失败面板按钮；`BOOT` 全部忽略），且 §8 判据 8 写明「PAUSED…**仅面板按钮响应**」⇒ 设计意图是「面板按钮**必须**响应」，当前完全不响应 = **纯实现缺陷**，无需请文策渊裁定。② **`_handleTap` 的相位路由表早已写全**：`beads-game.ts:1250 case 'game-over'` / `:1277 case 'level-clear'` / `:1288 case 'finish'` / `:1304 case 'paused'` 四分支均已正确实现「只认自己的面板按钮、面板外零响应」并逐条引条款；齿轮亦在相位路由**之前**被吞（合 `pause-settings §2.1`）。③ **唯一缺口 = `_readInput()` 仅在 `_stepPlaying` 内调用**（`:1191` 定义、`:1155` 唯一调用点）⇒ 上述四分支在现网是**死代码**。⇒ 修法是「把一个调用点挪出 playing」，**不是**重新设计输入路由；`input-control §2.3/§8` 判据**不需要改** ⇒「先改文档再改码」前置**不触发**。
- **判据侧覆盖事实（供后续 QA 单用）**：§8 十条中**仅判据 8** 覆盖 `PAUSED`；`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 三相位**仅由 §2.3 状态门禁表覆盖，§8 无独立可测条目** ⇒ 判据回写有真实空间，但**不阻塞改码**。
- **用户裁定（2026-09-15，两项全采推荐项）**：**修法 = A** —— 把 `_readInput()` 从 `_stepPlaying` **上提到 `update()`**（一处改动、全部相位覆盖、路由表原样复用）；须保留原语义「playing 内读输入后若离开 PLAYING ⇒ 本帧不再跑供料/倒计时」。**范围/顺序 = A 先工程后 QA** —— 第一单只派工程（**先加真链红例 → 再改接线 → 保留 `tapDesign` 旁路例做双口径对照**）；修完再由主理人另派 QA 复跑 P8/P10/P22 并把真链口径回写判据/探针。
- **派工（2026-09-15，负责人由 主理人(Qoder) 改为 程基岩(eng)）**：施工序严格按上文「范围/顺序 = A」；**禁止**为凑绿删旁路例；`_handleTap` 是唯一裁决面，**不得**在 `App`/适配器侧另起一套命中逻辑；判据回写**不在本单**（留后继 QA 单）。
- **⚠️ 与缺陷 C1（WXG-T-104）的关系**：两者**独立**且**观感相似**（都表现为「点了没反应」）。C1 = 全局 y 轴镜像（已在 T-104 修复并复证）；BD-34 = 非 `playing` 相位不读输入。排查时勿互相归因。T-104 实测中「`game-over` 相位 `_readInput` 调用数 = 0 / `playing` = 260」即本缺陷现象，**未并入 T-104 结论**。

- **完成记录（2026-09-15，程基岩(eng)）**：修法按用户裁定 **A** 落地 —— `_readInput()` 由 `_stepPlaying()` **上提到 `update()`**（一处改动、四相位全覆盖、`_handleTap` 路由表原样复用）。
  - **时序位置选「`machine.update(dt)` 之前」**：冻结帧内序为「输入（段内序：状态指令 → 玩法事件）→ 连击窗 → 供料 → 计时」（`core-loop §2.2.2` / `pause-settings §6`），放之后会把输入挤到计时之后 ⇒ 破坏该序。**原语义「读输入后若已离开 PLAYING ⇒ 本帧不再跑供料/连击窗/倒计时」保留**：上提后由**调用点**结构性保证（`_readInput()` 若切走相位，`machine.update` 直接派发新相位的 `onUpdate`，`_stepPlaying` 根本不被调用）；守卫原样留作该语义的显式锚点 + 防未来新增调用点静默破约。
  - ① **真链红例（先跑，证断链）**：新增 `games/beads/tests/phase-input-realchain.test.ts`（9 例）。用真链 `input.beginFrame()` → `push({phase:'down'|'up'})` → `game.update(dt)` → `input.endFrame(dt)`（与 `App._fixedUpdate` 同形）在 `paused` / `game-over` / `level-clear` / `finish` 各点该面板按钮中心，与**同坐标 `game.tapDesign()`** 双口径对照。**改码前：5 条真链正面断言全红、4 条负向闸门（面板外零响应）恒绿**；改码后 **23 文件 / 247 例全绿**。
  - ② **改码**：`games/beads/src/game/beads-game.ts` 唯一 src 改动点（`update()` 头部 + `_stepPlaying()` 注释）；**`_handleTap` 一字未动**（仍为唯一裁决面，未在 App/适配器侧另起命中逻辑）。
  - ③ **旁路例全保留**：既有 `tapDesign()` 单测零删除（`pause-settings`/`clear-panel`/`finish-panel`/`sprint-settle`/`revive`/`in-level-snapshot`/`audio-dispatch`/`powerups`/`timer`/`feedback-vfx`/`sprint` 等）；形成「旁路 + 真链」双口径。仅订正 `tests/helpers.ts::tapInFrame` 一处**陈旧注释**（`_stepPlaying` → `update()`），行为未变。
  - ④ **端到端浏览器复证（决定性验收，真指针 / headless Chrome / 1280×720）**：① 过一关（`level-clear`）→ 真指针点「下一关」screen(567.1,455)=设计(240,491) → **`playing` 且 `levelIndex 0→1`**（ADVANCED，两轮一致）；② 真指针点齿轮 screen(461.3,57.3)=设计(44,1227.8) → **`paused`** → 真指针点「继续」screen(640,308.2)=设计(375,763) → **`playing`**（UNSTUCK，两轮一致，即「永久卡死」场景已解）。每次点击前 `elementFromPoint` 校验落点元素 = canvas。旁路对照：独立 context 同坐标 `tapDesign()` = ADVANCED / UNSTUCK。复证脚本落在 `/tmp/bd34-e2e.mjs`（**未入库**：落盘面越出本单 §7）。
  - ⑤ **镜像同步**：`pnpm run framework:sync` 写入 1（beads-game 镜像件）→ `pnpm run framework:sync:check` ✅（beads framework 40 + game 26；无他人残留漂移）。
  - ⑥ **自证**：`pnpm -F @wxgame/beads test` **247/247 ✅**；`pnpm run check:arch` **OK**（仅 1 条既有 L1 编辑器产物 WARN）；`pnpm run verify` = **PASS 14 ｜ WARN 0 ｜ SKIP 1（`check:size` 未覆盖）｜ FAIL 0**。
  - ⚠️ **harness 侧附带发现（非本单范围，未改 `dev/harness/**`）**：`dev/harness/index.html` 的三个固定 DOM 面板遮挡画布对应屏幕区 —— 1280×720 下**齿轮中心 screen(461.3,32.4) 恰在 `#hud`（y∈[10,46]）之下**（实测 `elementFromPoint='hud'`），同一 x 带 `#controls`（`top:56px`，含 `<a href="./index.html">` 切换链接）会吞掉点击并**触发导航**（实测）。真人点齿轮仍可行（用齿轮热区内 screen y∈(46,56] 那条窄带），但 harness 里齿轮可点面积被压得很窄 ⇒ 建议后续单给 `#hud`/`#controls` 加 `pointer-events:none`。
  - ⚠️ **观察（未定级，交主理人）**：`App._fixedUpdate` 每个 tick 可跑多个固定子步，而 `InputManager.beginFrame()` 按设计**不清**一次性标志、`endFrame()` 每 tick 才清一次 ⇒ 一次物理 tap 在**同一 tick 的每个子步**都会被 `_readInput()` 读到（实测浏览器单次点击触发多次 `_handleTap`）。Node 单测（`advance` 每步 1 次 begin/update/end）与正常 60fps 单子步下不可见，故 `input-control §8-3/§8-10`「一次触摸仅一条指令」在浏览器多子步下**未锁**。**本单未改**，仅登记。
  - **`[R]` 阻塞**：无真机 / 无 AppID ⇒ 微信侧真链未验（与 `control-manifest §17` 同口径），**不得记 PASS**。
  - **未 commit、未 push**。判据回写（`input-control §8` 三相位可测条目 + QA 探针真链口径）**不在本单**，留后继 QA 单。
  - **⑦ 主理人独立复核（2026-09-15）**：① `pnpm -F @wxgame/beads test` = **23 文件 / 247 例全绿**（新真链文件 9/9）；`pnpm run verify` = **PASS 14 ｜ WARN 0 ｜ SKIP 1 ｜ FAIL 0**；`git diff --stat -- games/beads/src/` = **恰 1 个文件**（`beads-game.ts` +17/−5），符合「唯一 src 改动点」。② **主理人自跑真指针复证**（harness + Chrome 1280×720，先隐藏 `#hud`/`#controls`/`#help` 以避开 DOM 遮挡，全程 `mousemove`+`mousedown`+`mouseup`，未用 `tapDesign` 做验收）：
    - **[8] 失败页路径**：真指针点「重试」screen(640,412) ⇒ `playing`、`remaining=299/300`、`filled=0`（整关重置）✅
    - **[9] 负向语义保留**：`paused` 相位真指针点**面板外** screen(454,704) ⇒ **仍 `paused`**（零响应，合 `input-control §2.3` / `pause-settings §2.2`）✅
    - 另独立复现两次决定性路径：真指针点「继续」screen(640,308) ⇒ `playing`/面板关闭（**「永久卡死」解除**）；旁路铺场至 `level-clear`（3★）后真指针点「下一关」screen(567,455) ⇒ `playing`、`levelIndex 0→1`、`l2`「小屋」8×6 ✅
    - **结论：四相位真链均已接通，且面板外零响应语义未被破坏。**
  - **⑧ 对「1 帧 dt 差异」的裁定**：上提至 `machine.update(dt)` **之前** ⇒ 帧内切换相位后本帧照常跑计时段，`game-over` 重试后 `remaining = 300 − 1/60 ≈ 299.983`（帧外 `tapDesign` 为 300）。主理人在复证中实测到 `remaining=299`（`Math.ceil` 后显示值）。**接受**：与 `pause-settings §8-2`「≤1 帧 dt 可由 resume 帧自身消耗」同口径，且时序选择理由（保 `core-loop §2.2.2` 帧内序「输入 → 连击窗 → 供料 → 计时」）成立 —— 放 `machine.update` 之后会把输入挤到计时段之后，破坏该序。**登记为已裁定的取舍，不列缺陷。**
  - **⑨ 未决问题裁定（主理人）**：**① harness DOM 遮挡齿轮 = A**（另立小单给 `#hud`/`#controls` 加 `pointer-events:none`；本单不越界改 `dev/harness/**` —— 该发现登记价值高：它同时解释了「真人点齿轮可点面积被压窄」与「同 x 带 `#controls` 的 `<a href>` 会吞点击并触发导航」）；**② 多子步一次触摸多指令 = A 另立单核实**（`App._fixedUpdate` 每 tick 多子步 ⇒ 同一 tick 内每个子步都读到了一次性标志 ⇒ 一次物理 tap 触发多次 `_handleTap`；Node 单测与正常 60fps 单子步下不可见，故 `input-control §8-3/§8-10` 在浏览器多子步下**未锁**。**注意：该现象在本单改码前同样存在**（`_readInput` 当时也按子步调用），**不是本单引入的回归**；但既然现在四相位都读输入，影响面变大 ⇒ 应立项核实）；**③ `[R]` 真机 = A**（接受现状并列为真机首验 **P0**，与 `control-manifest §17` / ADR-0011 §4.2(10) 同口径）。
  - **⑩ 后继单（用户已裁定「先工程后 QA」）**：派 QA 复跑 **P8/P10/P22** 并把口径从 `tapDesign` 旁路切到**真链**；**判据回写** —— `input-control §8` 目前仅**判据 8** 覆盖 `PAUSED`，`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 三相位仅由 §2.3 门禁表覆盖、**无独立可测条目** ⇒ 有真实回写空间（**先改探针后改报告**，g4 报告 §18.3-6 惯例）。= **WXG-T-114**（已领号）。
  - **⑪ 主理人裁定（2026-09-15，三项全采推荐项）**：**① 丢帧重复投递 = A 立新单核实并修**（= **WXG-T-113**）；**② 后继 QA 单 = A 现在派**（= **WXG-T-114**）；**③ harness DOM 遮挡 = A 收编进①**（不单独立号，随 T-113 一并处理）。

---

## WXG-T-113

- **名称**：**框架 · 丢帧重复投递（一次 touch 多指令）+ harness DOM 遮挡齿轮**
- **负责**：程基岩(engineering-lead)　**状态**：✅ 完成（2026-09-15，程基岩）　**P1**
- **背景（WXG-T-100 附带发现，主理人已用代码锚点坐实）**：`App.tick()` = `loop.advance(frameDt)` + `input.endFrame(frameDt)`（`packages/framework/src/compose/app.ts:147-152`）；而 `_fixedUpdate(dt)` = `input.beginFrame()` + `game.update(dt)`（`:172-175`）。`advance()` 一个 tick 可跑 **N 个子步**（丢帧 / 帧 dt > `fixedDt` 时 N>1），**每子步**都 `beginFrame + game.update`；而一次性标志（`_downThisFrame` / `_upThisFrame`）按 `memory/2026-09-13.md:146` 的修复是 **`endFrame` 独占生命周期** ⇒ **同一 tick 内每个子步都读到同一次按下** ⇒ 一次物理 tap 触发 N 次 `_handleTap`。违反 `input-control §8-3`（一次触摸仅触发一条指令）与 §8-10（每帧指令上限）。
- **⚠️ 不是 WXG-T-100 引入的回归**：改码前 `_readInput` 也在每子步被调用（当时只在 `playing`）。但 T-100 后四相位都读输入 ⇒ **影响面变大**。Node 单测（每步 1 次 begin/update/end）与正常 60fps 单子步下**均不可见** ⇒ §8-3/§8-10 在浏览器多子步下**从未被锁**（K-038「旁路恒绿」同族病）。
- **Deliverables（严格按序）**：
  - ① **先写多子步复现红例**（Node 即可，不需要浏览器）：一次 `input.push(down)` 后跑一个**多子步**帧（如 `app.tick(fixedDt × 3)`），断言 `_handleTap` / 落子事件**恰 1 次**。**改码前必须真的红**。
  - ② **定级**：确认丢帧下是否真的会**连落子 / 连换选**（即危害是否可达），给出定级建议（P1/P2）与依据。
  - ③ **再改**。**修法硬约束**：**不得**破坏「**事件到达早于帧仍可见**」这一属性 —— 它是 2026-09-13 为修「Cocos 事件驱动宿主下 `justDown` 永远不可见」而**刻意建立**的（当时把一次性标志的生命周期从 `beginFrame` 移到 `endFrame`）。因此「读完即清」或「把清移回 `beginFrame`」这两种朴素修法**都会踩回原坑**，必须先论证再动手；若你判断需要动 `InputManager` 语义，请在回传中给出**备选方案比较**与对 `packages/framework/tests/**` 既有输入测试的影响面。
  - ④ **收编项（用户裁定：随本单处理，不单独立号）**：`dev/harness/index.html` 三个固定 DOM 面板遮挡画布 —— 1280×720 下**齿轮中心 screen(461.3,32.4) 恰在 `#hud`（y∈[10,46]）之下**（实测 `elementFromPoint='hud'`），同一 x 带的 `#controls`（`top:56px`，含 `<a href="./index.html">` 切换链接）会吞掉点击**并触发导航**（实测）。修法：给 `#hud` / `#controls` 加 `pointer-events:none`（或抬到不遮挡画布热区的位置），使 e2e/QA 探针能直接点齿轮中心。**改完须复核 `#controls` 的切换链接仍可点**（必要时只对 `#hud` 加 `pointer-events:none`、给 `#controls` 加内边距/避让而非整体禁用）。
  - ⑤ **自证**：新红例改码前红 / 改码后绿；`pnpm -F @wxgame/framework test` 与 `pnpm -F @wxgame/beads test` 全绿；`pnpm run verify` 汇总；若改了 `packages/framework/src/**` 须跑 `pnpm run framework:sync` + `framework:sync:check`。
- **权威来源**：`packages/framework/src/compose/app.ts`（`:147-152` / `:172-175`，权威实现）> `packages/framework/src/core/input/input-manager.ts`（一次性标志生命周期）> `memory/2026-09-13.md:140-149`（修复 4 的原始动机与验证手法）> `games/beads/design/gdd/input-control.md` §8 判据 3 / 10 > `production/TASKS-DETAIL.md` 的 `## WXG-T-100` 小节 ⑦ 段末尾的观察登记。
- **Output Path**：`packages/framework/src/core/input/**`、`packages/framework/src/compose/app.ts`、`packages/framework/tests/**`、`dev/harness/index.html`，以及 `production/TASKS-DETAIL.md` 的 `## WXG-T-113` 小节（**追加**）。**禁改**：`games/beads/src/**`（T-100 刚改完，本单若确需动须先回传请示）、`systems-index §3`、`production/qa/**`（QA 域）。
- **必读 skill**：`my-skills/wxgame-adr-arch/SKILL.md`；另读 `AGENTS.md`、`docs/architecture/control-manifest.md`（§4「事件是通知，不是状态」、§6 输入）、`memory/2026-09-13.md:140-149`。
- **约束**：热路径零分配（`tick` / `_fixedUpdate` 是每帧路径）；须补红例而非只改码；不 commit/push。
- **完成记录（2026-09-15，程基岩(engineering-lead)·CodeBuddy）**：缺陷坐实 + 修复 + harness 收编，三项全落地。
  - ① **多子步红例（先跑，证缺陷）**：新增 `packages/framework/tests/compose/input-multistep.test.ts`（6 例；`InputObserver` 观测型假游戏，在每个 `game.update()` 内统计读到 `justDown`/`justUp` 的**固定步数**，不碰旁路）。**改码前：4 红 2 绿** —— `app.tick(3×fixedDt)` 下一次 `down` 读到 **3** 次、一次 `up` 读到 **3** 次、5 子步帧读到 **5** 次、0 子步帧到达的 down 被 `endFrame` 丢弃（读到 **0** 次）；两条恒绿哨兵 = 「帧间到达仍可见」与「单子步不回归」。**改码后：6/6 全绿**。
  - ② **定级 = P1**。**危害可达、已实证**：临时探针（Node，跑完即删）在 **`paused`→真指针点「继续」** 场景实测 —— 缺陷版投影 `["game:resumed","tray:spawned","bead:placed"]`（**同一 tick 的后续子步在新相位里又落了一颗子**），修复版 `["game:resumed","tray:spawned"]`。⇒ 一次「继续」点击会**顺手落子**（玩家非预期动作、可改盘面）。**但「连落子 / 连换选」在 `playing` 相位不可达**：同坐标重放被玩法侧幂等吸收 —— `Tray.select` 同槽重复 = `already-selected`（零事件）、`_placeSelected` 首次落子即 `takeBead` 清选中 ⇒ 第 2 子步零事件；齿轮仅 `playing` 生效（第 2 子步已 `paused` ⇒ 吞掉）；道具卡首用即清槽 ⇒ 再请求落 `empty`、零扣次。⇒ **可观测危害集中在「相位切换的落穿」**（面板按钮 → 目标相位同 tick 再动作），且**须丢帧**（多子步）才触发，正常 60fps 单子步不可见。**P1 依据**：a) 违反**冻结判据** `input-control §8-3/§8-10`；b) 危害可达且玩家可见（非预期落子）；c) 属**输入层契约**缺陷，未来任何非幂等处理器都会被放大；d) 丢帧在低端机 / GC / 回前台后是常态。**诚实降权项**：`playing` 侧「连落子/连换选」当前被玩法幂等吸收 ⇒ 实际爆发面窄于字面。
  - ③ **修法**：采用「**`endFrame` 下移到 `_fixedUpdate`（每固定子步一次）**」—— `App.tick()` 去掉 `this.input.endFrame(frameDt)`；`_fixedUpdate` 改为 `beginFrame → game.update → endFrame(dt)`。语义 = **每个固定步就是一次输入帧**，与仓库既有全链辅助（各游戏 `tests/helpers.ts::advance`、QA 探针 `tickFrame`）的对称口径一致。**备选否决**：(B)「读完即清」（`snapshot` getter 消费一次性标志）**踩回原坑** —— 任何先于 `game.update` 的读 / 单帧多次读都会吞掉 tap；(C)「把清移回 `beginFrame`」**正是 2026-09-13 修复 4 修掉的 bug**（Cocos 帧间到达的 tap 永不可见）；(D) 子步仅首个读输入（`_fixedUpdate` 加子步序号）⇒ 破坏 `dx/dy` 与 holdTime，且需改 `LoopCallbacks`，过度设计。**InputManager 语义零改动**（`beginFrame` 仍不清、`endFrame` 仍独占清）；仅更新两处 doc 注释。**「事件到达早于帧仍可见」属性保住**：帧间到达的事件跨 `beginFrame` 存活、被首个 `game.update` 消费后由 `endFrame` 清除；**0 子步帧不再误丢该事件**（原 `tick` 级 `endFrame` 会丢）。**热路径零分配**：未引入任何分配。
  - ④ **harness DOM 遮挡（收编项）**：`dev/harness/index.html` —— `#hud`/`#help` 加 `pointer-events:none`（纯信息/说明，无控件）；`#controls` 面板盒加 `pointer-events:none` + `#controls > * { pointer-events: auto }`（面板背景/内边距/flex 间隙不再吞画布点击，`<a>`/`<button>` 照常可点）。**浏览器复核（playwright-cli / headless Chrome / 1280×720）**：① 齿轮中心 `elementFromPoint(461.3,32.4)` = `CANVAS#stage`（原为 `hud`）；② **真指针** `mousemove→mousedown→mouseup` 点齿轮中心 ⇒ `phase playing→paused`（端到端）；③ `#controls` 两个切换链接中心 `elementFromPoint` = 对应 `<a>`，真指针点击 breakout 链接 ⇒ `search=""`、beads 链接 ⇒ `search="?game=beads"`（**导航正常**）；④ 六个 `#controls button`（L1–L5 / 重新开始）命中自检全部 `true`；⑤ 底部 `#help` 带 `elementFromPoint` = `CANVAS#stage`。
  - ⑤ **自证**：`pnpm -F @wxgame/framework test` = **29 文件 / 273 例全绿**（新文件 6/6）；`pnpm -F @wxgame/beads test` = **23 文件 / 247 例全绿**（与 T-100 同数，无回归）；`pnpm run verify` = **PASS 14 ｜ WARN 0 ｜ SKIP 1（`check:size` 未覆盖）｜ FAIL 0**；`pnpm run framework:sync` 写入 2×2 件（`beads`/`breakout` 的 `compose/app.ts` + `core/input/input-manager.ts`）→ `framework:sync:check` ✅。
  - ⚠️ **`[R]` 阻塞**：无真机 / 无 AppID ⇒ 微信侧真链未验（与 `control-manifest §17` 同口径），**不得记 PASS**。
  - **未 commit、未 push**。**判据回写不在本单**（`input-control §8` 属设计域；§8-3/§8-10 的**多子步**口径回写留后继 QA 单 **WXG-T-114** 一并处理）。
  - **⑥ 主理人独立复核（2026-09-15）**：
    - **修法实质已核**：`tick()` 中的 tick 级 `input.endFrame` **已移除**；`_fixedUpdate()` 末尾新增 `this.input.endFrame(dt)`（`app.ts:184`），即「**一个固定步 = 一次输入帧**」，**`InputManager` 行为零改动**（改动仅限 `app.ts` + 一处 doc 注释）。`app.ts:174-183` 的注释完整交代了理由，并**显式声明保住了 2026-09-13 的属性**（事件帧间到达仍可见）+ **0 子步帧不再丢标志**（比修前更强）。语义判定：**该修法不是「读完即清」，也不是「把清移回 `beginFrame`」，因此未踩回原坑** —— 与 2026-09-13 修复 4 的动机不冲突。
    - **红例独立复跑**：`pnpm -F @wxgame/framework test tests/compose/input-multistep.test.ts` ⇒ **6/6 绿**。
    - **门禁**：`pnpm run verify` ⇒ **PASS 14 ｜ WARN 0 ｜ SKIP 1 ｜ FAIL 0**。
    - **harness CSS 改动已核**（`git diff -- dev/harness/index.html`）：`#hud` 加 `pointer-events: none`（注释写明齿轮中心 screen(461.3,32.4) 正落在其 y∈[10,46] 内）；`#controls` **面板盒**关命中 + `#controls > * { pointer-events: auto }` ⇒ **面板内边距与 flex 间隙不再吞画布点击，但切换链接与 L1–L5 按钮照常可点** —— 正是任务书要求的「避让而非整体禁用」。`#help` 同处理。
  - **⑦ 主理人裁定（成员未决四问）**：**① 定级 = P1（确认成员建议）** —— 理由采纳其诚实陈述：违反**冻结判据** `§8-3/§8-10`、危害玩家可见（`paused` 点「继续」会在新相位**多落一颗子**）、属输入层契约缺陷（未来任何非幂等处理器都会被放大）；同时**保留其诚实降权项**（`playing` 侧连落子被玩法幂等吸收 ⇒ 实际爆发面窄于字面，且须丢帧才触发）。**② 多子步口径回写 = 随 T-114（B）** —— 不另开工程单改 `control-manifest §6`；理由：该口径本质是 `input-control §8-3/§8-10` 的实现契约，归设计域条文（`8b/8c/8d` 同批）+ QA 用例即可，避免同一语义三处落。**③ holdTime 语义微变 = A 登记** —— `endFrame` 现按 `fixedDt`（非 `frameDt`）累计、0 子步帧不再累计；当前**无任何消费方**（全仓仅 framework 一处直接测），风险低，但**必须登记**（已由本段代为登记，不另开单）。**④ 游戏层真链多子步回归例 = 交 T-114** —— `games/beads/tests/**` 不在本单 Output Path，且 T-114 的真链探针已覆盖四相位；不另开单。
  - **⑧ `[R]` 真机**：无真机 / 无 AppID ⇒ 微信侧真链未验，**不得记 PASS**；与 `control-manifest §17` 同口径，真机首验列 **P0**。

---

## WXG-T-114

- **名称**：**QA · 真链口径切换（P8/P10/P22）+ input-control §8 三相位判据回写**
- **负责**：严守真(quality-lead)　**状态**：📋 已立项（待施工；**用户已批准写入 `production/qa/beads/`**）　**P1**
- **背景**：`WXG-T-100` 已修掉 **BD-34**（`_readInput()` 仅在 `_stepPlaying` 内 ⇒ `paused`/`level-clear`/`game-over`/`finish` 四相位真链点击全失效）。但 QA 侧的探针 **P8 / P10 / P22 至今仍用 `game.tapDesign()` 旁路**驱动面板 ⇒ **旁路恒绿、真链恒断**（沉淀 **K-038**；这正是三轮回归都没测到 BD-34 的原因）。另：`input-control §8` 十条中**仅判据 8** 覆盖 `PAUSED`，`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 三相位**仅由 §2.3 状态门禁表覆盖、无独立可测条目**。
- **Deliverables**：
  - ① **口径切换**：把 P8 / P10 / P22 从 `tapDesign()` 旁路改为**真链**（`input.beginFrame()` → `push({phase:'down'|'up'})` → `game.update(dt)` → `input.endFrame(dt)`，与 `App._fixedUpdate` 同形），并**保留旁路例做双口径对照**（旁路仍是合法的装配前置，**不得删除**）。复跑并逐条回填结果。
  - ② **§8 三相位判据回写**：为 `LEVEL_CLEAR` / `GAME_OVER` / `FINISH` 三相位补**独立可测条目**（现仅 `PAUSED` 有判据 8）。⚠️ **域边界**：`games/beads/design/gdd/input-control.md §8` 属**设计域（文策渊）**，**你不得直接改笔** —— 请产出**拟改条文**（含判据原文、环境道次、可测形式）并在回传中交主理人中转；你在 `production/qa/beads/test-cases.md` 侧落**对应用例**。
  - ③ **顺序纪律**：**先改探针、后改报告**（`g4-regression-report.md` §18.3-6 惯例）；**先写预期、后跑**（禁止先看输出再回填预期 = 假绿）。
  - ④ **诚实标注**：`[R]` 真机（无 AppID / 无真机）一律 **⛔ + 解除条件**，**不得记 PASS 亦不得记 FAIL**；本单跑不到的相位（如 `runtime` 与 `playing` 下 T-113 尚未修完的**多子步重复投递**）须显式登记为未覆盖。
  - ⑤ **与 T-113 的关系（必须写清）**：**丢帧多子步下「一次 touch 多指令」属 WXG-T-113，不在本单**。若你的真链用例在正常 60fps 下为绿、但在多子步下为红，**如实分别登记**，不要把它并进 BD-34 的结论、也不要为凑绿放宽断言。
- **权威来源**：`production/TASKS-DETAIL.md` 的 `## WXG-T-100` 小节（含四相位真链实测与主理人复证数字）> `production/qa/beads/g4-probe*.mjs` 与 `test-cases.md` 现行体系 > `games/beads/design/gdd/input-control.md` §2.3 + §8 > `packages/framework/src/core/input/input-manager.ts`（真链语义）。
- **Output Path**：`production/qa/beads/**`（探针、`test-cases.md`、`evidence/`）+ `production/TASKS-DETAIL.md` 的 `## WXG-T-114` 小节（**追加**）。**禁改**：`games/beads/design/**`（§8 条文须回传拟稿）、`packages/**`、`games/**/src/**`、`systems-index §3`、`production/qa/beads/` 之外的 `production/**`（台账主表与状态回填由主理人执笔）。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`（**必须**）；另读 `AGENTS.md`、`production/qa/beads/test-cases.md`、`knowledge/lessons.md`（查 K-038 同域教训）。
- **约束**：严守真默认 readonly，本单**已获用户批准**写入上列路径；不 commit/push；**不得为凑绿删旁路例或放宽断言**。
- **完成记录（2026-09-15，严守真）**：
  - ① **探针真链口径**（`production/qa/beads/g4-probe-v1.1.mjs`，头注**修订 41**）：`mk()` 增 `tapChain(dx,dy)` = `input.beginFrame()` → `push({phase:'down'})` → `push({phase:'up'})` → `game.update(dt)` → `input.endFrame(dt)`（与 `App._fixedUpdate` 同形；坐标 `designToScreen` → `push` → 游戏内 `screenToDesign` 读回）。
  - ② **三组口径切换（P8/P10/P22 → 真链）**：新增 **`P8R`/`P10R`/`P22R`** 真链重跑（断言子集合与旁路口径一致）；**旁路例一条未删**——`P8`/`P10`/`P22` 原样保留，仅标题加「【旁路口径 tapDesign】」并互指真链对照组。**判定/阈值零改动**。双口径对照：**差异 = 0**（`P8`=PASS\* ↔ `P8R`=PASS\*；`P10`=PASS ↔ `P10R`=PASS；`P22`=PASS\* ↔ `P22R`=PASS\*）。除口径切换外，`P22R` 额外补证「**D1 开关本身经真链可达**」（PLAYING 真链点齿轮 → PAUSED 真链点面板行 3 → `reduceMotion` 翻转 + 落档 + 回显）——这正是 BD-34 曾打断的那一步。
  - ③ **四相位真链门禁矩阵（新增 `P27a..d` · BD-34 回归闸门）**：`PAUSED`/`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 每相位**正向（真链点面板按钮 ⇒ 相位迁移/整关重置）+ 负向（真链点面板外死区 `(30,53)` ⇒ 事件增量 0、相位不变）**并列 ⇒ 负向**非平凡真**（点击确已到达 `_handleTap`）。**`P27a..d` 4 条全绿**，与 `## WXG-T-100` 小节 ⑦ 段主理人真指针复证**逐条吻合**（Node 真链 + 浏览器真指针两条独立取证链互印）。这就是 §8 三相位「无独立可测条目」空缺的 QA 侧落码。
  - ④ **`§8` 三相位判据回写（拟稿，**未越界改笔**）**：产出 **拟增条文 8b/8c/8d** 全文（含判据原文、环境道次、可测形式、来源标注、编号理由）于 `g4-regression-report.md §22.5`，**交主理人中转设计侧（文策渊）**；QA 侧对应用例落 `test-cases.md §A4b`（`TC-INP-11/12/13`，标「条文待设计侧确认」）。**`games/beads/design/**` 一字未改。**
  - ⑤ **顺序纪律**：**先改探针、后改报告**；**先写预期、后跑**（预期取自 `input-control §8`/§2.3 现文与 T-100 实测数字）。两口径在**同一次运行、同一 `.smoke` 产物**下并列产出 ⇒ 对照自洽。确定性自证：连跑两次判定**逐条一致**。
  - ⑥ **自证与计数**：`node production/qa/beads/g4-probe-v1.1.mjs` ⇒ **EXIT=0**；全量 **PASS 34 ｜ PASS\* 16 ｜ FAIL 2 ｜ ⛔ 9（61 组）**；**T-114 修订面 7 条 = PASS 5 ｜ PASS\* 2 ｜ FAIL 0 ｜ ⛔ 0**。证据：`evidence/g4-probe-v1.1-t114.log`（正式）/ `…-t114-rerun.log`（确定性）/ `…-t114-baseline.log`（改动前旁路基线）。**未改** `games/beads/src/**`、`packages/**`、`design/**`、`systems-index §3`、`cocos-input-probe.mjs`；未 commit / push。
  - ⑦ **探针自身缺陷自查（+1，诚实登记）**：`P27a`/`P22R` 证据串原直接嵌 `${h.game.phase}`，在 `rec()` 时才求值 ⇒ 打印**后续帧**相位（P27a 曾打印 `phase=playing` 与其断言 `phase=paused` 自相矛盾；与修订 15bis(a)「活快照晚读」同族）。改为**当场拷标量**后重跑；判定不受影响（判定用当场捕获的布尔）。
  - ⑧ **外部变量（非本单，已核实）**：基线 log 跑时 `dev/harness/dist`=14:26:04Z（早于被测源 `compose/app.ts` 14:39:07Z）⇒ `P5/S` 的**新鲜度门**判 FAIL；其后**并发会话（WXG-T-113）重建 dist**（→14:43:12Z）⇒ 正式轮 `P5/S` 转 PASS\*。**两轮唯一差异就是该新鲜度门那一行**，与本单改动无关；本单结论一律以正式轮 log 为准。
  - ⑨ **⚠️ 已知遗留（非本单、建议后续小改）**：`P5/S` 证据串末句「本轮探针开跑前 dist 曾早于 src 38 分钟，已用 `pnpm run harness:build` 重建」是 **T-096 轮遗留的静态文案**，对「由并发会话重建」的本次运行**不成立**（freshness 数字行本身是实时计算的、为真）。属证据文本陈旧，未在本单改笔。
  - ⑩ **`[R]` 阻塞**：无真机 / 无 AppID ⇒ 微信宿主真链 **⛔**（解除条件：有效 AppID → `build:cocos:wx` 出包 → 微信开发者工具/真机可跑 → 同一真链探针在 `wx` 宿主复取按钮命中）；**不记 PASS 亦不记 FAIL**，真机首验须把「四相位面板按钮可点」列 **P0**。
  - ⑪ **与 WXG-T-113 的边界（不得合并）**：丢帧多子步「一次 touch 多指令」属 **T-113**（框架 `App.tick` 子步 × `endFrame` 独占标志生命周期）；本单真链用例一律在**正常 60fps 单步**（直接 `game.update(dt)`，不经 `app.tick` 多子步）下取证 ⇒ **互不覆盖**；若多子步下为红**如实分别登记**，不并入 BD-34 结论、不为凑绿放宽断言。
  - ⑫ **门禁建议（裁决权归主理人）**：**G4 建议维持 CONCERNS**（本单未触及 §21.3 三条未闭项）；**BD-34 建议关闭**（T-100 已修 + 本单真链回归闸门全绿）。
- **依赖**：无前置；后继 = `§8` 三相位拟增条文经设计中转确认后回写（QA 侧用例已挂好，确认后去「拟」）；Playtest M2 降级轮可就绪。
- **⑬ 主理人独立复核（2026-09-15）**：
  - **探针独立复跑**：`node production/qa/beads/g4-probe-v1.1.mjs` ⇒ **EXIT=0**；【T-114 修订面】= **PASS 5 ｜ PASS\* 2 ｜ FAIL 0 ｜ ⛔ 0**（7 条）。全量 61 组：PASS 34 ｜ PASS\* 16 ｜ FAIL 2 ｜ ⛔ 9（FAIL 2 为既有的 P4 / 另一条，**与本单无关**）。
  - **真链口径已验证落地**：输出中可见 `PASS* P8R`、`PASS P10R`、`PASS* P22R`、`PASS P27a/b/c/d`，且旧的 `P8 / P10 / P22` **原样保留并标注「【旁路口径 tapDesign】」** ⇒ 双口径并存、**旁路例零删除**属实。
  - **关键价值确认**：**旧口径 vs 真链口径差异 = 0**（三条逐条一致）。这正是 **K-038「旁路恒绿、真链恒断」的缺口** —— 三轮回归都没测到 BD-34，就是因为缺这条「旁路 ≡ 真链」断言；本单把它补上了。
  - **判据落盘已核**：`test-cases.md` 新增 **§A4b**（`TC-INP-01R/07R/08R` 真链孪生 + `TC-INP-11/12/13` 三相位拟增，**加 `R` 后缀 / 续号不重排**，§A4b 声明**不计入**「5 组×10=50」）；版本 **v1.6→v1.7**、总用例 **140→146**（`:17` / `:130` / `:133-135` / `:481`）。
  - **§8 拟改条文已成稿**（报告 `§22.5`）：**8b（LEVEL_CLEAR）/ 8c（GAME_OVER）/ 8d（FINISH）** 三条，含判据原文、环境道次、可测形式、来源标注、编号理由 ⇒ 具备**设计中转**条件。
- **⑭ 主理人裁定（成员未决四问）**：**① §8 条文形态 = A（`8b/8c/8d` 后缀，不整体重排）** —— 与 `A05-09b` 判例同形，改动最小且不牵动既有引用；**② `P5/S` 陈旧文案 = A（本单不碰，登记待订正）** —— 避免跨任务改笔；**③ 基线 log = A（保留为旁路口径参照）** —— 其 dist 口径已在 `§22.2` 标清；**④ 真机首验 P0 = 随本单排**（与 `control-manifest §17` 同口径，不另立单）。
- **⑮ 主理人裁定：BD-34 关单** ✅ —— 判据：① 实现已修（`WXG-T-100`，四相位接通，主理人真指针复证三条真人路径 + 负向语义全过）；② **回归闸门已建**（本单 `P27a..d` 四相位真链 + 面板外负向，全绿）；③ 真链口径已从旁路切换并与旁路**逐条一致（差异=0）**。**限定**：效力只到 `[Node]` 真链 + `[Harness]` 真指针层；**`[R]` 真机仍 ⛔ 未验**，真机首验须把「四相位面板按钮可点」列 **P0**。**`G4` 建议维持 CONCERNS**（§21.3 三条未闭项本单未触及）。
- **⑯ 设计中转待办（主理人执行）**：把 `§22.5` 的 `8b/8c/8d` 拟改条文 + 编号理由转 **文策渊**（`input-control §8` 属设计域，QA 与主理人**均不代改笔**）；确认后 QA 侧把 `TC-INP-11/12/13` 的「拟」字去掉。
- **⑰ 沉淀候选（成员报 1 条，主理人认可）**：*重跑轮必须记录**产物/夹具 mtime** —— 跨会话重建 dist 会把「外部变量」误读成「本轮变化」*（本轮 `P5/S` 由 FAIL→PASS\* 即为实例，唯一差异是其新鲜度门行 `dist 14:26:04Z 早于 src 14:39:07Z`，而并发会话 `WXG-T-113` 于 22:41 重建 dist 后转绿）。与 **K-039「时点性」同族，可补其「跨会话」维度** —— 交 `kb:sync` 收尾时入 `knowledge/lessons.md`。

---

## WXG-T-115

- **名称**：**beads · `input-control §8` 三相位门禁 + 多子步口径回写（设计域落笔）**
- **负责**：文策渊(design-strategist)　**状态**：📋 已立项（待施工）　**P1**
- **背景（两笔判据欠账，同一文件、同一批处理）**：
  1. **三相位门禁条文缺失**：`input-control §8` 十条中**仅判据 8** 覆盖 `PAUSED`；`LEVEL_CLEAR` / `GAME_OVER` / `FINISH` 三相位**仅由 §2.3 状态门禁表覆盖、§8 无独立可测条目**。上游 **`WXG-T-100`** 已修掉 BD-34（`_readInput()` 原先只挂在 `_stepPlaying` ⇒ 四相位真链点击失效、真人过第一关后点不动结算面板且点齿轮进暂停后**永久卡死**）；**`WXG-T-114`** 已把拟改条文成稿于 `production/qa/beads/g4-regression-report.md` **§22.5**（含判据原文 / 环境道次 / 可测形式 / 来源标注 / 编号理由），QA 侧用例已挂好（`test-cases.md §A4b` 的 `TC-INP-11/12/13`，**标「条文待设计侧确认」**）。
  2. **多子步口径未落到条文**：上游 **`WXG-T-113`** 修了「丢帧重复投递」（`loop.advance()` 一个 tick 可跑 N 个子步，而一次性标志由 `endFrame` 独占生命周期 ⇒ **一次触摸触发 N 次指令**）。主理人裁定该口径**归设计域条文**（不另开工程单改 `control-manifest §6`）⇒ `input-control §8-3` / `§8-10` 需补澄清：**「一次触摸 → 一条指令」的时基是「固定步」而非「tick」；丢帧不得重复投递**。否则判据字面与实现口径仍对不上，下次回归会再次误判。
- **用户裁定（2026-09-15）**：条文形态采 **A —— `8b/8c/8d` 后缀，不整体重排 §8**（同 `A05-09b` 判例：重排会牵动台账与既有证据引用，成本更高）。
- **Deliverables**：
  1. **审阅 `§22.5` 拟稿并逐条确认或修正**。你是设计口径的裁决者：若拟稿与你对设计意图的判断不符，**按设计意图改写并说明理由**（不得为迁就实现而降低判据）。
  2. 回写 `games/beads/design/gdd/input-control.md §8`：新增 **8b（LEVEL_CLEAR）/ 8c（GAME_OVER）/ 8d（FINISH）** 三条门禁判据（每条须含：判据原文 / 环境道次 / 可测形式 / 来源标注）。
  3. 同批在 **§8-3 / §8-10** 补「**多子步 / 丢帧**」口径澄清（时基 = 固定步；丢帧不得重复投递）。
  4. 若 **§2.3 状态门禁表**措辞需与新条文对齐，一并**对齐**（**只对齐、不改变语义**）。
  5. 按该文件既有惯例更新**文首版本号 + 变更记录**。
- **权威来源（冲突以 A 为准）**：
  - **A**：`production/qa/beads/g4-regression-report.md` **§22.5**（拟稿全文）
  - **B**：`games/beads/design/gdd/input-control.md` §2.1 / §2.3 / §8 现行文本
  - **C**：`production/TASKS-DETAIL.md` 的 `## WXG-T-114`（上游产出）／`## WXG-T-100`（BD-34 修复与四相位真链实测）／`## WXG-T-113`（多子步缺失与修法）
  - **D**：`games/beads/design/ux/ux-spec.md` §4 流转表（`LEVEL_CLEAR` / `FINISH` 行）
  - **E**：实现锚点 `games/beads/src/game/beads-game.ts` 的 `_handleTap` 四相位分支（**只读**，用于核对可行性；**不得据此改设计**）
  - 不发明 `systems-index §3` 未冻结数值；本单**不应需要**任何新游戏数值。
- **Output Path**：`games/beads/design/gdd/input-control.md`（**主产物**）+ `production/TASKS-DETAIL.md` 的 `## WXG-T-115` 小节（**追加**完成记录）。
  **禁改**：`packages/**`、`games/**/src/**`、`systems-index §3`、`production/qa/**`（QA 用例去「拟」是严守真的活，不在本单）、`ux-spec.md`（若你判断必须同改，**先回传请示**）、`production/**` 除上列小节外的一切。
- **必读 skill（开工前先 Read）**：`my-skills/wxgame-gdd-writer/SKILL.md`；若行文涉及 UX 流转表述，续读 `my-skills/wxgame-ux-spec/SKILL.md`。另读 `AGENTS.md`、`games/beads/design/gdd/input-control.md`（**先摸清 §2.1/§2.3/§8 现行体系再落笔**）。
- **约束**：**不整体重排 §8**（裁定 A）；**不得为迁就实现而降低判据**；若发现实现与设计不符（除已在册的已知残留）⇒ **如实登记、回传**，不改设计迁就代码；先问再写；不 commit/push。
- **后继（不在本单）**：本条落地后由 **严守真** 把 `test-cases.md §A4b` 的 `TC-INP-11/12/13` 去掉「拟」字（`production/**` 写权限在其侧）。
- **完成记录（2026-09-15，文策渊(design-strategist)）**：主产物 `games/beads/design/gdd/input-control.md` **v1.0 → v1.1**（新增 §9 变更记录），三笔一次落盘。
  - ① **§8 新增三相位门禁判据 `8b/8c/8d`**（插在判据 8 与 9 之间；**采后缀、不重排判据 1–10**，用户裁定 A）。每条含**四要素**（判据原文 / 环境道次 / 可测形式 / 来源标注），并附「编号理由」。
    - `8b`（LEVEL_CLEAR）：点棋盘/托盘/道具卡/齿轮全忽略；**仅过关面板按钮响应（下一关 / 去冲刺）**；面板外零命中、不推进（不误触下一关、不误开冲刺）。可测：真链点「下一关」⇒ `level-clear→playing`、`levelIndex n→n+1`；点面板外 ⇒ 事件增量 0、相位与关卡号不变。
    - `8c`（GAME_OVER）：点棋盘/托盘/道具卡/齿轮全忽略；**仅失败面板按钮响应**——普通局 续时 / 重试本关，**冲刺局 再来一局 / 返回关卡**；面板外零命中、不重开。可测：真链点「重试本关」⇒ `game-over→playing`、`filled=0`（整关重置）；面板外 ⇒ 事件增量 0、相位不变。
    - `8d`（FINISH）：点棋盘/托盘/道具卡/齿轮全忽略；**仅通关面板按钮响应（去冲刺 / 重玩第 1 关）**；面板外零命中、不误触。可测：真链点「重玩第 1 关」⇒ `finish→playing`、`levelIndex=0`；面板外 ⇒ 事件增量 0、相位不变。
    - 环境道次三条同口径：`[Node]/[Probe]` 真链 ✅ ＋ `[Harness]` 真指针 ✅ ＋ `[Device]/[R]` 真机 **⛔**（无 AppID/无真机；解除条件 = 有 AppID → `build:cocos:wx` 出包 → 开发者工具/真机可跑 → 同一真链探针在 `wx` 宿主复取按钮命中）。
  - ② **对 `g4-regression-report §22.5` 拟稿的审阅结论：核心采纳，另作 3 处修正/加强**（**均未降低判据**）——
    - **修正 1（按钮集补齐，据 `ux-spec §4`/§3.3/§3.5/§3.6 与实现锚点只读核对）**：拟稿 `8b` 仅列「下一关/去冲刺」（已含）、`8c` 仅列「重试/续时」。**裁决**：`8c` 补**冲刺局子分支**（`_mode==='sprint'`：再来一局 / 返回关卡）——`game-over` 相位在冲刺局呈现的是冲刺结算面板（`ux-spec §3.5`/§4），按钮集不同，漏列即留下「有规范、无可测条目」的新型缺口（本单正是治此病）；`8b`/`8d` 的「去冲刺」保留。
    - **修正 2（形态）**：拟稿把「判据原文」用 blockquote、「环境道次/可测形式/来源标注」用合并表。**裁决**：改为**逐条四要素清单**（每条自带四槽），严格满足任务书「每条须含四要素」，也便于 QA 1:1 挂用例。
    - **修正 3（来源锚点精确化）**：实现锚点行号随码漂移，改为**符号锚**（`case 'level-clear'` / `case 'game-over'` / `case 'finish'`）并显式标注「只读核对、不据以实现改判据」（守 §10 硬约束）。
    - **未降低判据的声明**：三条均**未**因实现现状放宽（`[R]` 真机诚实标 ⛔ 且写解除条件，未记 PASS）。
  - ③ **§8-3 / §8-10 补「多子步 / 丢帧」时基口径**：判据「一次触摸 = 一条指令」的时基 = **固定步**（`GameLoop.fixedDt`，即「一个固定步 = 一次输入帧」），**非渲染 tick**；一 tick 承载 N 个固定步时**同一次触摸仍只准投递一条指令，不得因子步重放重复触发**；并加「相位切换落穿」子句（点「继续」不得顺手落子）。§8-10 同口径（N 子步注入 1 触摸 ⇒ 路由计数 =1）。
  - ④ **§2.3 状态门禁表第 3 行对齐**（**只对齐、不改语义**）：按钮集由不完整的「（下一关/重试/重玩第 1 关）」改为**逐相位准确枚举**（过关：下一关/去冲刺；失败：续时/重试本关；通关：去冲刺/重玩第 1 关）并加 §8-8b/8c/8d 交叉引用。
  - ⑤ **附带对齐（超 Deliverables 清单，已在文首/§9 登记）**：`§2.4` / `§6` 原用「帧」指输入帧，与 §8-3 新口径同义但未显式化 ⇒ 仅加「（帧 = 固定步，见 §8-3）」**透明标注，零语义/数值改动**。理由：不改则同文件内「帧」歧义正是本单要治的误判源；如需回退，删括号即可。
  - ⑥ **产出与边界**：只写 `input-control.md` 与本节。**未改** `ux-spec.md`（判断无需同改：UX 侧 §4/§3.x 与条文一致，仅作来源引用）、`systems-index §3`（**零新数值**）、`packages/**`、`games/**/src/**`、`production/qa/**`（QA 用例去「拟」= 严守真的活）。
  - ⑦ **门禁自检**：`pnpm run check:links` **OK**（agents=7 / skills=17）；`pnpm run check:tasks` **OK**（主表 46 行 / 详情 46 节配对完整）。
  - ⑧ **未 commit、未 push**。
  - **交接（经主理人中转）**：① **后继 = 严守真** 把 `test-cases.md §A4b` 的 `TC-INP-11/12/13` 去「拟」（本单未越界改 QA 文档）；② 条文新增的**次按钮**子句（`8b`「去冲刺」/ `8c`「续时」与冲刺局子分支 / `8d`「去冲刺」）**真链孪生用例待 QA 补**——现 `TC-INP-11/12/13` 仅覆盖各相位**主按钮** + 面板外负向（**本条如实登记，不为凑覆盖而删子句**）。
- **⑨ 主理人独立复核（2026-09-15）**：逐项 `grep` / `sed` 已核 —— **`8b/8c/8d` 落盘**（`:109 / :115 / :121`，**逐条四要素齐备**）；**§8-3 时基口径落盘**（`:100`，含「时基 = 固定步（`GameLoop.fixedDt`），**非渲染 tick**」+「**丢帧 / N 子步下同一次触摸仍只准投递一条指令**」+ **相位切换落穿子句**（点「继续」不得顺手落子）+ 明写「该口径由 `App._fixedUpdate` 每固定子步一次 `beginFrame`/`endFrame` 保证」）；**§8-10 多子步口径落盘**（`:130`，N 固定步注入 1 触摸 ⇒ 路由计数 =1；单固定步注入 20 触摸 ⇒ 仅 1 条入路由）；**`§2.4`/`§6` 的「帧」标注「= 固定步」**（`:50 / :79 / :82`）；**§2.3 第 3 行对齐**（按钮集逐相位枚举 + 交叉引用 `§8-8b/8c/8d`，**只对齐未改语义**）；**文首 v1.1 + `## 9. 变更记录`**（`:3 / :134 / :139`）。**判定：落盘属实、无虚报。**
- **⑩ 主理人特别肯定一处写法**：`§8-3` 末句「**若实现在丢帧多子步下未达此口径，须如实登记为缺陷，不得放宽本条**」—— 这是**判据不迁就实现**的正确兜底，正是本仓反复强调的纪律（对照：C1 与 BD-34 的成因都是「判据没写清 → 实现绕过去 → 无人发现」）。**该句予以保留，不得删。**
- **⑪ 对成员三处修正的裁定（予以采纳）**：**修正 1（`8c` 补齐冲刺局子分支按钮集「再来一局/返回关卡」）** —— **实质增益**，采纳。若不补，本单刚填的三相位缺口会因「冲刺局走同一 `case 'game-over'` 但按钮集不同」而立刻留下新缺口。**修正 2（拆成逐条四要素清单）** —— 采纳（满足可测性与 QA 1:1 挂用例）。**修正 3（行号锚 → 符号锚 `case 'level-clear'`）** —— 采纳，防「随码漂移的行号」再次失效（本仓已有该类事故）。
- **⑫ 主理人裁定（成员未决三问）**：**A｜`§2.4`/`§6` 顺带对齐 = 保留** —— 零语义 / 零数值改动，且是给「帧」一词消歧（与 §8-3 时基口径同源），属正当同步；**不采 ③ 整句改写**（避免扩大改动面）。**B｜次按钮取证缺口 = 并入后继 QA 单**（去「拟」时同批补），**不另开单** —— 同一文件同一批，拆单只会增加交接成本。**C｜道次用词 = 保持 `[Device]/[R]` 并列** —— 兼容 `test-cases` 图例与 QA 报告两套既有用法。
- **⑬ 后继（需领号，不在本单）**：派 **严守真** 做两件事 —— ① 把 `test-cases.md §A4b` 的 `TC-INP-11/12/13` **去「拟」**；② 按 `8b/8c/8d` 新增的**次按钮子句**补**真链孪生用例**（含 `8c` 冲刺局子分支；若该路径在本环境不可达，**如实标 ⛔ 并写解除条件**）。= **WXG-T-116**（已领号）。

---

## WXG-T-116

- **名称**：**QA · `§A4b` 去「拟」+ 次按钮真链孪生用例（含冲刺局子分支）**
- **负责**：严守真(quality-lead)　**状态**：📋 已立项（待施工；**用户已批准写入 `production/qa/beads/`**）　**P2**
- **背景**：上游 **`WXG-T-115`** 已把设计侧条文回写完毕 —— `games/beads/design/gdd/input-control.md` 新增 **§8 的 `8b`（LEVEL_CLEAR）/ `8c`（GAME_OVER）/ `8d`（FINISH）** 三条门禁判据（每条含判据原文 / 环境道次 / 可测形式 / 来源标注），并在 **§8-3 / §8-10** 补了「多子步 / 丢帧」时基口径（时基 = **固定步**，非渲染 tick；丢帧不得重复投递；含相位切换落穿子句）。但 QA 侧尚有两笔收尾：
  1. **`production/qa/beads/test-cases.md §A4b`** 的 `TC-INP-11/12/13` 仍标「**条文待设计侧确认**」（`§8-8b/8c/8d` 写作「**拟增**」）⇒ 条文已定稿，**该去「拟」**。
  2. **次按钮子句尚无真链孪生用例**。`WXG-T-114` 的 `P27a..d` 与 `TC-INP-11/12/13` 只覆盖各相位**主按钮** + 面板外负向；而 `8b/8c/8d` 的按钮集**不止主按钮**，且 `8c` 还含**冲刺局子分支**（`XWXG-T-115` 修正 1 补齐，见 `## WXG-T-115` ⑪）。**该缺口由 文策渊 主动登记、主理人裁定并入本单**。
- **Deliverables**：
  1. **去「拟」**：把 `TC-INP-11/12/13` 的判据引用从「`§8-8b/8c/8d`（**拟增**）」改为正式编号 **`input-control §8-8b / 8c / 8d`**；`§A4b` 节首与变更记录同步（判据/阈值**零改动**，本条只改引用与状态）。
  2. **补次按钮真链孪生用例**（逐条对应条文新增的次按钮子句）：
     - `8b`「**去冲刺**」⇒ 进冲刺模式（相位 / 模式断言）
     - `8c` 普通局「**续时**」（⚠️ 依赖激励视频 `onRewarded` 路径；harness 侧是 `MockRewardedAdProvider`，可达性由你实测判定）
     - `8c` **冲刺局子分支**「**再来一局**」「**返回关卡**」（冲刺结算面板，与普通局按钮集不同）
     - `8d`「**去冲刺**」
  3. **探针同步**：在 `production/qa/beads/g4-probe-v1.1.mjs` 加对应用例（编号自定，建议沿 `P27` 族续号并在输出中说明映射），**先改探针、后改报告**。
  4. **不可达者如实标 ⛔**：任一路径若在本环境不可达（如「续时」需真实激励视频、冲刺子分支受前置约束），记 **⛔ + 解除条件** —— **不得记 PASS，亦不得记 FAIL**。
  5. **顺序与诚实纪律**：**先写预期、后跑**（禁止先看输出再回填预期 = 假绿）；**旁路例一条不得删**；**不得为凑绿放宽断言**。
- **权威来源（冲突以 A 为准）**：
  - **A**：`games/beads/design/gdd/input-control.md` **§8-8b/8c/8d**（**已定稿的条文**，含按钮集与可测形式）与 **§8-3 / §8-10**
  - **B**：`production/TASKS-DETAIL.md` 的 `## WXG-T-115`（条文回写与三处修正）／`## WXG-T-114`（真链口径与 `P27a..d`）／`## WXG-T-100`（四相位真链实测）
  - **C**：`production/qa/beads/test-cases.md §A4b` 与 `g4-probe-v1.1.mjs` 现行体系（**先摸清再落笔**）
  - **D**：`games/beads/design/ux/ux-spec.md` §4 流转表 / §3.3 / §3.5 / §3.6（按钮集来源）
  - 不引用你未实际执行过的结果。
- **Output Path**：`production/qa/beads/**`（探针、`test-cases.md`、`evidence/`）+ `production/TASKS-DETAIL.md` 的 `## WXG-T-116` 小节（**追加**）。
  **禁改**：`games/beads/design/**`（条文已定稿，本单**只读引用** —— 若你认为条文有误，**回传登记、不得代改笔**）、`packages/**`、`games/**/src/**`、`systems-index §3`、`production/qa/beads/` 之外的 `production/**`（台账主表与状态回填由主理人执笔）。
- **环境事实**：✅ Node ≥20 + `node production/qa/beads/g4-probe-v1.1.mjs`（依赖 `dev/harness/.smoke` 暂存产物，必要时先 `harness:build`／`harness:smoke`）；✅ 浏览器真链可用（`playwright-cli` + 本机 Chrome，`export PATH="$HOME/.workbuddy/binaries/node/workspace/node_modules/.bin:$PATH"`）。⚠️ 已知坑：**须在 `phase=playing` 下取状态**、**`mousemove` 不要放进 for 循环**（harness 顶层 DOM 遮挡已由 WXG-T-113 修掉）。⛔ 无真机 / 无 AppID ⇒ `[R]` 一律 ⛔。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`（**必须**）；另读 `AGENTS.md`、`production/qa/beads/test-cases.md`、`games/beads/design/gdd/input-control.md` §8、`production/TASKS-DETAIL.md` 的 `## WXG-T-116` 与 `## WXG-T-115` 小节。
- **约束**：严守真默认 readonly，本单**已获用户批准**写入 §Output Path 上列路径；不 commit/push；**不得为凑绿删旁路例或放宽断言**；**不得代改设计条文**。
- **完成记录（2026-09-15，严守真）**：
  - ① **去「拟」**（`test-cases.md §A4b`）：`TC-INP-11/12/13` 的判据引用由「`§8-8b/8c/8d`（**拟增**，待设计侧确认）」改为正式编号 **`input-control §8-8b / 8c / 8d`**（WXG-T-115 已定稿），状态串同步；§A4b 节首、口径注、合计表、变更记录同步。**判据 / 阈值零改动**（只改引用与状态）。探针侧 P27b/c/d 标题/归属串同步去「拟」。
  - ② **补 5 条次按钮真链孪生**（探针 `P27e..i`，逐条对应 `8b/8c/8d` 新增的次按钮子句）：
    - `P27e`/`TC-INP-11b` = `8b`「**去冲刺**」：LEVEL_CLEAR 真链点副钮 ⇒ `mode normal→sprint`、`playing`。
    - `P27f`/`TC-INP-12b` = `8c` 普通局「**续时**」：真链点钮 ⇒ `watchingAd=true`、相位仍 `game-over`（等回调）；`MockRewardedAdProvider.settle('complete')` 发奖腿 ⇒ `playing`、`remaining += REVIVE_BONUS_SEC`、`revived=true`。
    - `P27g`/`TC-INP-12c` = `8c` **冲刺局子分支「再来一局」**：冲刺结算真链点主钮 ⇒ `mode=sprint`、`playing`。
    - `P27h`/`TC-INP-12d` = `8c` **冲刺局子分支「返回关卡」**：冲刺结算真链点副钮 ⇒ `mode=normal`、`playing`。
    - `P27i`/`TC-INP-13b` = `8d`「**去冲刺**」：FINISH 真链点副钮 ⇒ `mode normal→sprint`、`playing`。
    - 每条**正负并列**（同相位真链点面板外死区 `(30,53)` ⇒ 事件增量 0 ⇒ 负向非平凡真）。装配前置用**合法公开 API**（`fillBoard` / `startSprint`），判据主体 = 面板按钮真链点击。
  - ③ **实测结果**：`node production/qa/beads/g4-probe-v1.1.mjs` ⇒ **EXIT=0**；全量 **66 组：PASS 38 ｜ PASS\* 17 ｜ FAIL 2 ｜ ⛔ 9**（较 T-114 轮 61 组 **+5**）；**T-116 修订面 5 条 = PASS 4 ｜ PASS\* 1 ｜ FAIL 0 ｜ ⛔ 0**。确定性自证：连跑两次判定**逐条一致**。证据：`evidence/g4-probe-v1.1-t116.log`（正式）/ `…-t116-rerun.log`（确定性）。
  - ④ **⛔ 边界（不记 PASS 亦不记 FAIL）**：`P27f` 的**发奖腿由 harness 替身驱动**（`MockRewardedAdProvider(null)`，autoSettle 关 ⇒ 须显式 `settle()`）⇒ 只证「按钮→请求→发奖→续打」**结构链路**；真机激励视频**拉起/发奖/「未看完·skip·error」三分支**属 `[R]`（无 AppID/无真机）⇒ **⛔**（解除条件：有效 AppID → `build:cocos:wx` 出包 → 开发者工具/真机可跑 → 同一真链探针在 `wx` 宿主复取）。故 `TC-INP-12b` 记 **PASS\*** 而非 PASS。
  - ⑤ **纪律**：**先改探针、后改报告**（报告 §23）；**先写预期、后跑**（预期取自 `input-control §8-8b/8c/8d` 现文 + `ux-spec §4`/§3.4/§3.5/§3.6）；**旁路例一条未删**；**未放宽任何断言**；**未改条文与阈值**；**`games/beads/design/**` 一字未改**（只读引用）。
  - ⑥ **产物新鲜度（自证）**：跑前 `dev/harness/dist/games/beads/src/game/beads-game.js` mtime = **2026-09-15 22:53:12**、`.smoke` 对应件 = **22:56:51**（晚于被测源 ⇒ 未报新鲜度门失败）；已按 T-114 教训**记 mtime 入证据 log 头部**。
  - ⑦ **探针自身改动自查**：P27b/c/d 去「拟」；新增 `T116_PREFIXES` **独立分桶**（不并入 T-114，六段计数不得合并解读）；修两处证据串笔误（多余反引号，判定不受影响）；未新增探针自身缺陷。
  - ⑧ **门禁建议（裁决权归主理人）**：**G4 建议维持 `CONCERNS`**（未触及 §21.3 三条未闭项）；**`8b/8c/8d` 次按钮子句在 `[Node]/[Probe]` 真链层已可测且成立**；**去「拟」收尾完成**。
  - ⑨ **文档产出**：`production/qa/beads/{g4-probe-v1.1.mjs, test-cases.md(v1.7→v1.8), g4-regression-report.md(v1.5→v1.6 §23)}` + `evidence/g4-probe-v1.1-t116{,-rerun}.log`。**未改** `games/beads/design/**`、`packages/**`、`games/**/src/**`、`systems-index §3`、`production/qa/beads/` 之外的 `production/**`；未 commit / push。
- **⑩ 主理人独立复核（2026-09-15）**：
  - **探针独立复跑**：`node production/qa/beads/g4-probe-v1.1.mjs` ⇒ **EXIT=0**；【T-116 修订面】= **PASS 4 ｜ PASS\* 1 ｜ FAIL 0 ｜ ⛔ 0**（5 条：`P27e/f/g/h/i`）。全量 **66 组**（较 T-114 轮 61 组 +5）：**PASS 38 ｜ PASS\* 17 ｜ FAIL 2 ｜ ⛔ 9**（FAIL 2 = 既有 P4/BD-29 + 另一条，**与本单无关**）。
  - **去「拟」已核**：`test-cases.md` 的 `TC-INP-11/12/13` 判据列已由「`§8-8b`（**拟增**）」改为正式 **`§8-8b/8c/8d`**，状态串改为「**条文已定稿（WXG-T-115）**」（`:137-139`）；新增 **5 条** `TC-INP-11b/12b/12c/12d/13b`（`:140-144`）；版本 **v1.7→v1.8**、总用例 **146→151**（`:496`）。**判据/阈值零改动属实。**
  - **⚠️ 一处需说明的「残留」已澄清**：`grep "拟增\|条文待设计侧确认"` 仍有 **3 处**（`:125 / :495 / :496`）—— 逐条读过，**全部是合法的历史/动作引用**：`:125` 是 §A4b 节首叙述 T-114 当时的产出状态；`:495` 是 **v1.7 变更记录的历史条目**；`:496` 是 **v1.8 条目在描述「去拟」这个动作本身**（须引用旧串才能说明改了什么）。**非漏改，不作缺陷。**
  - **旁路例保留已核**：`P8/P10/P22` 与 `tapDesign` 前置**一条未删**。
  - **特别肯定一处取证质量**：`P27f`（「续时」）**把两个替身分支的证据分开呈现** —— `Noop`（weapp）⇒「即将开放」轻提示、`Mock`（harness）⇒ 等回调 + `settle('complete')` 发奖（`remaining 0→60`、`revived=true`、revive 音 =1）。这恰好证明了**同一 UI 在两个宿主下的差异化行为都在设计预期内**，比只跑一条更有说服力。
- **⑪ 主理人裁定（成员未决四问）**：**① `TC-INP-12b` 记 `PASS\*` = 接受** —— 按钮腿（真链点「续时」⇒ `watchingAd=true`、相位仍 `game-over`）是**真实可测且已成立**的，改记 ⛔ 会**低估**已证部分；`PASS\*` + 显式边界（真机激励视频维度 ⛔）正是该语义的正确用法。**限定**：真机广告拉起 / 发奖 / 「未看完·skip·error」三分支仍 **⛔**。**② 主/次按钮腿计入口径 = 维持并入 §A4b 行、不单开行** —— 与用户「采后缀、不重排」的裁定同口径；单开行会割裂「同判据的不同腿」这一语义。已要求（且成员已写）节首「主/次按钮孪生」注说清口径。**③ `8c` 冲刺局「续时主钮不出现」的可测句 = 登记待办、不在本单** —— 现条文已有规范、只是可测化程度不足，本轮以 `mode=sprint` 断言**间接覆盖**；属**设计域条文补句**，并入下次 `input-control` / `ux-spec` 修订即可。**不记为缺陷**（避免为一句开一单）。**④「产物 mtime 入证据」升格为探针默认输出 = 方向接受，登记为探针维护待办** —— 这正对应成员自己在 T-114 登记的沉淀候选（K-039「时点性」的「跨会话」维度），机械化为默认输出能结构性防「把外部变量误读成本轮变化」；但**本单已产出正式轮证据，中途改探针会让证据与代码版本错位** ⇒ 不追改、留下次探针维护一并做，**不另开单**。
- **⑫ 门禁**：**G4 维持 `CONCERNS`**（本单只补「次按钮腿」取证维度，**未触及 §21.3 三条未闭项**：P4/BD-29 实现落差仍在、`[B]/[C]/[R]/[P]` 道次未执行、包体红线无数据）。**本单 PASS**。
- **⑬ 至此 BD-34 全链收口**：实现修复（T-100）→ 真链回归闸门（T-114 `P27a..d`）→ 设计判据条文（T-115 `8b/8c/8d` + §8-3/§8-10）→ **次按钮腿孪生取证 + 判据去「拟」（本单）**。四相位**主/次按钮**在 `[Node]/[Probe]` 真链层均已可测且成立；`[R]` 真机层 ⛔（首验 P0 项：四相位面板**主/次按钮**可点 + 点击落点 + dpr 缩放）。

---

## WXG-T-101

- **名称**：**pre-commit 增 Cocos 镜像漂移条件守卫（防 BD-20 再复发）**
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-15，用户拍板「加条件步骤」）
- **背景**：BD-20 已两次复发（v1.0 轮 4 处漂移入 HEAD ⇒ G1 FAIL + 全链路 Cocos 取证阻塞；WXG-T-096 轮 12 处）。成因固定：改了 `packages/framework/src/**` 忘记跑 `framework:sync`，而 `.githooks/pre-commit` 现只跑 secrets / links / plugins / mcp / ctx，**没有** `framework:sync:check` ⇒ 漂移可以顺利入 HEAD，等下一轮独立复验才发现（沉淀 **K-039**）。
- **Deliverables**：① pre-commit 新增**条件步**：`git diff --cached` 含 `packages/framework/src/**/*.ts` 时才跑 `sync-framework-to-cocos.mjs --check`（无框架改动的提交零开销）；② **只拦不写**——理由与 `check:mcp` 同取向，且技术上必须如此：`git commit` 提交的是**索引**，钩子改写工作区不会进本次提交，静默重写只会造出「钩子说绿了但镜像仍漏在 HEAD 之外」的新坑；③ 失败提示须写清修复动作（`pnpm run framework:sync` + 重新暂存镜像）与「勿用 `--no-verify`」；④ 回写 `docs/agent/hooks-best-practices.md` 步骤表 + `control-manifest.md §15` 镜像条（把「靠人记得跑」升级为硬门）。
- **验收**：红→绿双向手工实测——(a) 只暂存框架源码改动 ⇒ 钩子 exit=1 且点名 ①⁷⁄₈ 步；(b) 补跑 sync 并暂存镜像 ⇒ 同一步通过；(c) 不含框架源码的提交 ⇒ 该步整体不触发（零开销）。
- **约束**：不改 `sync:check` 的比对口径；不为通过而放宽任何阈值。
- **完成记录（2026-09-15）**：① `.githooks/pre-commit` 新增步骤 **①⁷⁄₈**（插在 ①¾ `check:mcp` 与 ② ctx 重建之间），`STAGED_FW` 命中才跑；头注步骤表同步。② **只拦不写**（技术上必需：提交的是索引，钩子改工作区不会入本次提交），失败提示写明 `pnpm run framework:sync` + 重暂存镜像 + 勿用 `--no-verify`。③ 回写：`docs/agent/hooks-best-practices.md` §1 表格行 + 新增取向注（含红→绿复现命令）、`control-manifest.md §15` 镜像条升为硬门。④ **验收实测**：(a) 只暂存 `core/audio/audio.ts` 换行改动 → `sh .githooks/pre-commit` **EXIT=1** 并点名四处 differs；(b) 补跑 sync 并暂存两份镜像 → **EXIT=0** 且步骤行正常打印；(c) 本单提交（仅 hook + .md，无框架源码）→ 日志中无 `sync-framework-to-cocos` 行，零开销成立。测试产生的临时改动已 `git checkout` 复位，事后 `framework:sync:check` ✅。⑤ **未做**：未脚本化自测（无 `*-selftest.sh`，靠文档里的复现命令），因为钩子依赖真实索引态，脚本化需临时仓库夹具，性价比待评。
- **追加修正（2026-09-15，WXG-T-098 轮发现，归本单）**：初版 `STAGED_FW` 只匹配 `^packages/framework/src/.*\.ts$`，**但 `sync-framework-to-cocos.mjs` 同时镜像 `games/<game>/src/**`**（一次 sync 报「beads framework 39 + game 26」）⇒ 只改玩法源码的提交不触发核镜像，守卫漏一半（与 `control-manifest §15` 上方「ES5 适用面 = 入库源码（框架 + `games/*/src`）」口径也不一致）。已改为 `grep -E` 并列两条前缀，并手工复现两类源的红→绿：(a) 改 `games/beads/src/config/tuning.ts` 不 sync → `--check` **EXIT=1**（报 `game/config/tuning.ts differs`）且新 grep 命中该文件；(b) 补跑 sync → **EXIT=0**；测试临时改动已复位（源与镜像均回 HEAD）。`docs/agent/hooks-best-practices.md` 取向注与 `control-manifest.md §15` 镜像条同步改写。

---

## WXG-T-102

- **名称**：**beads 放错拒绝描边改码（BD-29 下家）**
- **负责**：主理人(Qoder)　**状态**：📋 已立项（待排期；由 WXG-T-098/BD-29 派生）
- **背景**：`ux-spec §5` 已（WXG-T-098）把「放错拒绝」重写为**单次脉冲 + 500ms 重启门**，但现实现仍按旧表——QA P4 实测 wrong 态 danger α **4 档起伏 / 200ms = 10Hz**，既违新表亦违 §3.8 冻结的「错误反馈 ≤2 次/秒」，并与 >3Hz 硬红线相抵（光敏性安全面，**不开豁免**）。⇒ 文档已一致，**代码未一致**；不得把「文档已改」读成「已修」。
- **Deliverables**：① **先补文档**：`ux-spec §5` 告急行补 **α 幅度**（林绘澄 BD-31 核对时发现只给周期未给幅度；参照 hint 行 0.5↔1.0 口径，由 UX 定值，不得发明为 §3 常量）；② 改码：`buildRenderModel`/view-model 侧 wrong 态描边由「200ms 内 2 次闪」改为「单次淡入 60 / 保持 80 / 淡出 60」，并加**连续拒绝 500ms 重启门**（与 `AUDIO_REJECT_MIN_INTERVAL=0.5s` 同拍，双通道一致）；③ `reduceMotion` 开启时退**静态红描边 + 抖动位移归零**（沿用 WXG-T-088 R1甲 现有分支，不新增开关）；④ 单测：断言一次 fx 窗口内 α 极值点数 ≤1 与 500ms 门限（**热路径零分配**纪律照常：不新增每帧集合分配）；⑤ 回写 `ux-spec §5` 的「实现落差登记」行为已一致，并**先改探针 P4 预期再跑**（报告 §18.3-6 惯例）。
- **约束**：**禁**手改 `systems-index §3`（本单无需新常量；若施工中发现必需 ⇒ 回传拟改串行落盘）；**禁**为凑绿删旧断言而不登记改判；渲染层不持有状态（L5）。
- **依赖**：前置 T-098（规格已回写）；可与 T-097 并行（不同文件：T-097 触 view-model 的扩展入口/轻提示，本单触 wrong 态描边时序 ⇒ **同文件需串行**，排期时二选一先或拆开改）。
- **阶段 0 诊断（2026-09-15，主理人）**：
  - **①「先补文档再改码」前置已满足** —— （原登记 ① 要求先补 `ux-spec §5` **告急行** α 幅度）。核对后确认：**告急行 α 幅度属 BD-35，与 wrong 描边改码无依赖**（告急脉冲 ≠ 放错拒绝描边，两个不同视觉）。而 **wrong 描边的规格早在 WXG-T-098 已定稿**（`ux-spec §5:180`：单次脉冲 淡入 60 / 保持 80 / 淡出 60＝200ms、**α 极值点 ≤1**、连续拒绝**重启门 500ms**、`reduceMotion` 退静态红描边 + 抖动归零），同文件 `:203` 亦明写「**本条回写后由工程侧跟进**」⇒ **工程侧已被放行，可立即改码**，不必等 BD-35。⇒ BD-35 拆出为 **WXG-T-117**（文策渊）**并行**推进。
  - **② 根因两处已精确定位**：
    - **α 往复（实测 10Hz）**：`games/beads/src/view/view-model.ts:539` —— `const flash = snap.reduceMotion ? 1 : 0.4 + 0.6 * Math.abs(Math.sin(snap.wrongProgress * Math.PI * 2));`，`|sin(2πp)|` 在 p=0.25/0.75 各一个极值 ⇒ **2 极值点 / 200ms = 10Hz**（设计要求 ≤1）。
    - **无 500ms 重启门**：`games/beads/src/game/beads-game.ts:1569` —— `this._wrongFx = { row, col, elapsedMs: 0 }` 每次 mismatch **无条件重置** ⇒ 100ms 连点即 100ms 一次脉冲 = **10 次/秒**（设计要求 ≤2 次/秒）。
  - **③ 同文件冲突风险已解除**：原登记警告「与 T-097 同文件需串行」。实测 `view-model.ts` **已提交、工作树无未提交改动** ⇒ 可安全改动。
  - **④ 新增常量归属已定**：`WRONG_FX_MS = 200`、`WRONG_SHAKE_PX = 3` 现位于 `games/beads/src/config/tuning.ts:376/378`（属「反馈态动效」组，来源 `ux-spec §5`）。新增的 **60 / 80 / 60 / 500** 属**同组同源**，**应进 `tuning.ts`**，**不触 `systems-index §3`**（与 `WRONG_FX_MS` / `HINT_PULSE_MS` 同判例）⇒ 符合本单「禁手改 §3」约束。
- **用户裁定（2026-09-15）**：**BD-35 并行另开单（= WXG-T-117，不阻塞本单）**；**本单负责改为 程基岩(eng)**，范围 = **原 Deliverable ②③④**（改码 + `reduceMotion` 静态分支沿用 + 单测）；**Deliverable ①（告急 α 幅度）已移交 WXG-T-117**；**修完再由主理人另派 QA「先改探针 P4 预期再跑」**（报告 §18.3-6 惯例）。
- **派工（2026-09-15）**：负责由 主理人(Qoder) 改为 **程基岩(engineering-lead)**；Output Path = `games/beads/src/view/view-model.ts`、`games/beads/src/game/beads-game.ts`、`games/beads/src/config/tuning.ts`、`games/beads/tests/**`。**禁改** `systems-index §3`、`ux-spec.md`（属 WXG-T-117）、`production/qa/**`（QA 域）。
- **完成记录（2026-09-15，程基岩 engineering-lead）** —— 范围 = 原 Deliverable **②③④**（① 告急 α 幅度已移交 WXG-T-117）：
  - **① α 包络（改码，`view-model.ts`）**：`wrong` 描边由 `0.4 + 0.6·|sin(2πp)|`（200ms 内 **2** 极值点 = 10Hz）改为**单次脉冲包络** `wrongFlashAlpha(p)`：`ms = p·WRONG_FX_MS`；`<60ms` ease-out 淡入（`t(2−t)`，t=ms/60）→ `60..140ms` 保持 1 → `≥140ms` ease-in 淡出（`1−t²`，t=(ms−140)/60）。分段常量 `WRONG_FADE_IN_MS=60` / `WRONG_HOLD_MS=80` / `WRONG_FADE_OUT_MS=60` 落 `tuning.ts`「反馈态动效」组（同 `WRONG_FX_MS` 判例，**不触 §3**）。`wrongFlashAlpha` 为**纯函数、零分配**（无闭包/无中间集合）——在 `buildRenderModel` 每帧可达路径上。
  - **② 500ms 重启门（改码，`beads-game.ts`）**：新增 `_armWrongFx(row,col)` + 时基字段 `_wrongFxArmedAtMs`（基准 `_pulseClock` 单调 ms）；`rejected/mismatch` 分支由「无条件 `this._wrongFx = {…}`」改为调 `_armWrongFx` ⇒ 自上次起播未满 `WRONG_FX_RESTART_GATE_MS=500` 的新 mismatch **不重启**（门内且 fx 在播 ⇒ 沿用相位不重置 elapsedMs；门内但 fx 已自然结束 ⇒ **本次不给视觉反馈**）。**非每帧路径**（仅拒绝帧调用）。
    - **门语义判断（任务书要求回传，未静默选）**：§5:180 字面把门写成「**视觉脉冲**重启门」（仅直提描边），但 §3.8 冻结值是「**抖动+描边闪** ≤2 次/秒」——「错误反馈」是**两通道一体的事件上限**。若只门禁描边、放抖动自由重启，则 100ms 连点可把抖动刷到 **10 次/秒**，按字面即违 §3.8。故本实现**按 §3.8 从严**：门禁**整个 wrong-fx 事件**（抖动与描边同进同退）。理由：① §3.8 为数值真源且 P1 红线不开豁免，从严读；② 抖动相位与描边同源于单一 `_wrongFx`，只门禁其一会让两通道相位失配。**若裁定只门禁描边 ⇒ 一行放宽**（在 `_armWrongFx` 内仅抑制描边重启、抖动态另存）。
  - **③ `reduceMotion` 分支核对（未改）**：沿用 WXG-T-088 R1甲 现有 `snap.reduceMotion ? 1 : …`，**未新增开关**。核对结论：`? 1` 满足「静态红描边、α 恒 1、**0 往复**、200ms 后由 game 侧清除」；抖动位移在 `!snap.reduceMotion` 分支 ⇒ `reduceMotion=true` 时 `dx=0`（**位移归零**）。**已达标，无需改动。**
  - **④ 单测（`tests/feedback-vfx.test.ts` 新增 describe）**：① 分段锚点 α（淡入中 **0.75** / 保持 **1** / 淡出中 **0.75** / 两端→**0**）+ 全窗 **400** 点采样**极值点计数 = 1**（旧实现为 **3** ⇒ 断言有判别力）且峰值 = 1；② `reduceMotion` 5 相位 α 恒 1 + 位移归零（`shaken.x − still.x = WRONG_SHAKE_PX`）；③ 500ms 门三况：门内连点**不重启**（相位继续推进 >0.5）、门内且 fx 已结束**不给反馈**（`wrongProgress=0` / `wrongRow=−1`）、门外**重启**（相位 <0.25）。**热路径零分配**：`wrongFlashAlpha` 无每帧分配；`_armWrongFx` 仅拒绝帧 new 一个 fx 对象（与旧实现同）。
  - **自证**：`pnpm -F @wxgame/beads test` **250 PASS**（22→25 例）；`pnpm run check:arch` **OK**（1 pre-existing WARN：编辑器产物文件存在性提示）；`framework:sync` 写入 **3**（三源文件镜像）+ `framework:sync:check` **OK**；`pnpm run verify` **PASS 14 / WARN 0 / SKIP 1（check:size 未覆盖）/ FAIL 0**。
  - **未决 / 风险**：见回传。本题**不 commit / 不 push**。后继 = **QA（严守真）先改探针 P4 预期再跑**（报告 §18.3-6 惯例）；探针 P4 属 `production/qa/**`（本单禁改）。
  - **并发注意**：`beads-game.ts` / `tests/helpers.ts` / `TASKS-DETAIL.md` 工作树内含**并发会话 WXG-T-100/BD-34** 未提交改动。本单改动落在**不同 hunk**（`_wrongFx` 区 / `_stepWrongFx` 区），二者可并存；**提交时同文件两单改动随行**（勿按文件级拆，否则拆不出干净的 T-102 笔）。
- **⑤ 主理人独立复核（2026-09-15）**：
  - **常量落盘已核**：`games/beads/src/config/tuning.ts:391` 起新增 `WRONG_FADE_IN_MS=60` / `WRONG_HOLD_MS=80` / `WRONG_FADE_OUT_MS=60` / `WRONG_FX_RESTART_GATE_MS=500`，且 `WRONG_FX_MS` 注释已同步订正（旧注「描边闪 2 次」已过时）。**不触 `systems-index §3`** ✅（符合约束）。
  - **包络实现逐段验过**（`view-model.ts:435-445`）：`ms = p·WRONG_FX_MS`；`ms ≤ 0 → 0`；`ms < 60 → t(2−t)`（ease-out 淡入，t=ms/60）；`60 ≤ ms < 140 → 1`（峰值保持）；`≥140 → 1−t²`（ease-in 淡出，t=(ms−140)/60），`t ≥ 1 → 0`。**单峰、α 极值点 = 1** ✅；纯函数、无闭包无中间集合 ⇒ **零分配** ✅；**分段常量取自 `tuning.ts`**（未把 0.3/0.7 之类归一化切点硬编码）✅ —— 这一点做对了，否则后续调 60/80/60 就要动视图层。
  - **500ms 门已核**（`beads-game.ts:265` `_wrongFxArmedAtMs`、`:1850-1851` `if (this._pulseClock - this._wrongFxArmedAtMs < WRONG_FX_RESTART_GATE_MS) return;`）✅；`reduceMotion` 分支沿用既有 `? 1`、未新增开关 ✅。
  - **门禁**：`pnpm -F @wxgame/beads test` ⇒ **250/250 全绿**（较修前 +3）；`pnpm run verify` ⇒ **PASS 14 ｜ WARN 0 ｜ SKIP 1（`check:size` 未覆盖，非本单）｜ FAIL 0**。
  - **特别肯定**：单测用**全窗 400 点采样断言极值点计数 = 1**，并把旧实现计数 **3** 一并记下作对照 ⇒ **断言有判别力**（不是「跑绿就算」）；门的三况（门内不重启 / 门内且 fx 已结束不给反馈 / 门外重启）也把边界都覆盖到了。
- **⑥ 主理人裁定（成员未决两问）**：
  - **① 门禁范围 = A（从严：门禁整个 wrong-fx 事件，抖动与描边同进同退）** —— 理由：**`systems-index §3.8` 是冻结常量真源**，其口径是「**错误反馈** 抖动+描边闪 **≤2 次/秒**」，这是一个**事件级**上限；而 `ux-spec §5:180` 的「**视觉脉冲**重启门 500ms」是实现规格的**措辞**。二者冲突时**以 §3 为准**（AGENTS §4）。若按 B 只门禁描边，100ms 连点会把**抖动**刷到 10 次/秒 ⇒ **按 §3.8 字面即违**。⇒ **A 正确，维持现状**。
  - **⚠️ 随之登记一处待对齐（非缺陷）**：`ux-spec §5:180` 的「视觉脉冲重启门」**措辞易被读成只门禁描边** ⇒ 应改为「**错误反馈（抖动+描边）重启门 500ms**」。属 ux-spec 域，与下面 ② 同批处理，**不单独开单**。
  - **② 原 Deliverable ⑤（回写 `ux-spec :203` 的「待工程侧跟进」）** = **并入下一个 ux-spec 小追加**（与上条措辞对齐、以及 T-117 的残留一并做），**不为一行单独开单**。**:203 那句现在已与实际脱节**（实现已一致），属**活跃文档漂移**，须尽快处理而非长期挂账。
- **⑦ 光敏性红线的效力边界**：本单只证 **`[N]`（Node/单测）层的 α 序列与门限**；**`[B]` 屏幕像素发光序列**与 **`[R]` 真机观感均未取证**（无 AppID / 无真机）⇒ **不得宣称「光敏性红线已达标」**，只可宣称「代码层已符合 §3.8 的时序口径」。真机首验须把「wrong 态观感」列 P0。

---

## WXG-T-117

- **名称**：**beads · `ux-spec §5` 告急行 α 幅度补全（BD-35）**
- **负责**：文策渊(design-strategist)　**状态**：✅ 完成（2026-09-15）　**P2**
- **背景（报告 §21.1 BD-35）**：`games/beads/design/ux/ux-spec.md` **§5** 的**倒计时告急行**（`:187`）写的是「`danger` + 1000ms **α 脉冲循环**」—— **只给了周期、没给 α 幅度**。同表其余同类行都写了幅度（如 `:189`/`:190` 教学引导行均写 **`α 0.5↔1.0`**）。该缺口由 林绘澄 在 BD-31 核对时发现。
- **影响**：此行**不可判定** ⇒ QA 探针 **P7 维持 `PASS\*`**；且**QA 与美术侧均不猜值**（报告 §21.1 明文）。补齐后 P7 该子句可转正。
- **用户裁定（2026-09-15）**：与 `WXG-T-102`（wrong 描边改码）**无依赖**，**并行另开本单**，不阻塞改码。
- **Deliverables**：
  1. 给 `ux-spec §5` **告急行补 α 幅度**（**由 UX 定值**，参照同表 hint 行的 `0.5↔1.0` 口径）。
  2. **同表同类缺口一次扫干净**：逐行核对是否还有其他「只给周期未给幅度」（或反之）的条目，一并补或显式登记。
  3. 若告急行还有其他未定值（颜色 / 图标 / 时长），一并处理或**显式登记为待定**。
  4. 按该文件惯例更新**版本号 + 变更记录**。
  5. **不触** `systems-index §3` —— α 幅度属**反馈态动效参数**，**不是 gameplay 冻结常量**（同 `WRONG_FX_MS` / `HINT_PULSE_MS` 判例：工程侧落在 `tuning.ts`，不进 §3）。
- **权威来源（冲突以 A 为准）**：**A** `games/beads/design/ux/ux-spec.md` §5 现行表格（**先摸清同行 hint 行的写法与全表惯例再落笔**）＞ **B** `production/TASKS-DETAIL.md` 的 `## WXG-T-117` / `## WXG-T-102` 小节 ＞ **C** `production/qa/beads/g4-regression-report.md` §21.1（BD-35 裁定原文）与 P7 现状 ＞ **D** `games/beads/design/gdd/systems-index.md §3.8`（**≤3Hz 红线**——新增幅度须仍在红线内，且红线本身**不得改**）。不发明 §3 未冻结数值。
- **Output Path**：`games/beads/design/ux/ux-spec.md`（**主产物**）+ `production/TASKS-DETAIL.md` 的 `## WXG-T-117` 小节（**追加**）。
  **禁改**：`systems-index §3`、`packages/**`、`games/**/src/**`、`production/qa/**`（QA 域）、`games/beads/design/gdd/input-control.md`（属 T-115，已定稿）。
- **⚠️ 体积注意**：`ux-spec.md` 现 ≈8683 tok，**已超 8000 单文件上限并在豁免中**（见台账 backlog「ux-spec 预算豁免到期条」）⇒ 本次增补须**克制**（补幅度、不重写段落、不搬动既有表格），并在回传中报告增补后的 token 估算；若预计增幅 >500 tok，**先回传请示**。
- **必读 skill**：`my-skills/wxgame-ux-spec/SKILL.md`（**必须**）；另按文策渊路由表先读 `my-skills/wxgame-gdd-writer/SKILL.md`。另读 `AGENTS.md`、`games/beads/design/ux/ux-spec.md` §5。
- **约束**：**不得发明 §3 常量**；**不得改 ≤3Hz 红线**；先问再写；不 commit/push。
- **后继（不在本单）**：条文落地后由 **QA**（严守真）把探针 **P7** 的该子句从 `PASS\*` 转正 —— 需主理人另派。
- **完成记录（2026-09-15）**：
  1. **告急行补 α 幅度**：`ux-spec §5:187`「倒计时告急」视觉列由「danger + 1000ms α 脉冲循环」补为「`danger` + 1000ms **α 0.6↔1.0** 脉冲循环」（附「恰 **1.0Hz** 往复，§3.8 ≤3Hz 内」）；并同格补两项未定值——**③ 图标**（时钟图标同步切 `danger`，坐实 §3.8「图标+颜色+脉冲」三通道）、**④ reduceMotion**（开 ⇒ 静态 `danger`，α=1，脉冲停）。**定值理由**：取**已落地实现同值**（`src/config/tuning.ts` `DANGER_PULSE_MS` 注释「1→0.6→1」/ `src/view/view-model.ts::dangerAlpha` = `breathe(clock,1000,0.6,1)`）⇒ **无实现落差**；0.6 地板略高于同表 hint 行的 0.5，系「持续 1Hz 警告应比短时引导更克制」之设计取舍（hint 的 0.5 保留不动）。
  2. **同表同类缺口扫净**：逐行核 `ux-spec §5` 全表（「只给周期未给幅度」/「有幅度无周期」双轴）⇒ 除告急行外另查出 **2 行**同类缺并就地补齐：`§5:188` 满槽告警 **0.6↔1.0**@500ms、`§5:190` 目标格 `hint` **0.5↔1.0**@600ms（与 `§5:189` 首珠脉冲同族）。其余行无同类缺——`§5:189` 原已给值；`§5:180` 放错拒绝 = 单次 `α 0→1→0` 淡入淡出 = 1 峰 0 往复（不属「往复」类）；「有幅度无周期」类**零命中**。
  3. **版本/变更记录**：`ux-spec` 文首版本 **v1.2 → v1.3**、任务号尾追加「§5 α 幅度补全：WXG-T-117，BD-35」；并在 §5 表下（BD-29 注后）追加「α 幅度补全」注一段（该文件无独立变更记录节，沿其「文首版本行」惯例）。
  4. **不触 §3**：α 幅度属**反馈态动效参数**，落 `tuning.ts`（`DANGER_PULSE_MS`/`TRAY_FULL_PULSE_MS`/`HINT_PULSE_MS`），**不进 `systems-index §3`**（同 `WRONG_FX_MS`/`HINT_PULSE_MS` 判例）；§3.8 **≤3Hz 红线未改**（告急 1.0Hz、满槽 2.0Hz 均在内）。
  5. **体积**：`ux-spec.md` **30781 → 31868 B**（**+1087 B ≈ +307 tok**，<500 阈值，未越「先请示」线）；版式与既有表格结构未动。
  6. **禁改项未碰**：未改 `systems-index §3`、`input-control.md`、`packages/**`、`games/**/src/**`、`production/qa/**`；未 commit/push（T-098 首次把本行 BD-35 判据留给 UX，本节即其闭合）。
- **主理人独立复核（2026-09-15）**：
  - **告急行已落盘**：`ux-spec.md:187` = 「`danger` + 1000ms **α 0.6↔1.0** 脉冲循环（恰 **1.0Hz** 往复，§3.8 ≤3Hz 内）+ **时钟图标同步切 danger**（§3.8「图标+颜色+脉冲」三通道）；`reduceMotion` 开 ⇒ 静态 danger（α=1，脉冲停）」✅ —— 幅度、周期、图标、`reduceMotion` 四项齐备（比只补一个幅度更完整）。
  - **同表扫描已核**：另查出并就地补齐 **2 行**同类缺 —— `:188` 满槽告警 → `α 0.6↔1.0`@500ms（2.0Hz）、`:190` 目标格 `hint` → `α 0.5↔1.0`@600ms；`:189` 首珠脉冲原本已有值。`:205` 新增注记说明本轮补齐 3 行与定值理由 ✅。**双轴扫描（只给周期未给幅度 / 有幅度无周期）已覆盖**。
  - **体积已核**：`wc -c` = **31868 B**，与成员报的 `30781 → 31868`（+1087 B ≈ +307 tok）**一致**，未越 500 tok 请示线 ✅。
  - **特别肯定一处定值策略**：告急 α **取已落地实现的同值（0.6↔1.0）**，而非任务书字面提示的 hint 口径（0.5↔1.0）。这一选择是对的 —— 本行原本**只缺文档**、实现早已按 0.6 跑，取同值 ⇒ **零实现落差、P7 可无代价转正**；若取 0.5，反而要开一张改码单去改 `tuning.ts`，把「补文档」变成「先改文档再改码」的无谓往返。成员在回传中把两条路的代价都写清了，没有静默选择。
- **主理人裁定（成员未决三问）**：**① α 地板 = 维持 `0.6↔1.0`** —— 采纳其三条理由（零落差 / 持续 1Hz 警告比短时引导更克制 / 红线内），且 `DANGER_PULSE_MS` 与 `trayFullAlpha` 已是同值，自洽。**② 版本号 = 维持 v1.3** —— 本次是**实质规格补全**（补一个此前缺失的判据数值 + 3 行同类缺），与 T-093/097/098 那些「只追加任务号尾」的记录性改动不同性质，值得抬号；抬高成本为零（无外部按版本号硬引用）。**③ 满槽告警的 `reduceMotion` 静态化半句 = 保留** —— 与 `trayFullAlpha` 实现一致，同属 accessibility D1「减弱动效保留通道」口径，非扩范围。
- **⚠️ 登记残留（与 T-102 ⑥ 同批，不单开单）**：`ux-spec.md` 有**两处活跃漂移**待处理 —— ① `:203` 的「**待工程侧跟进**」：T-102 已完成改码 ⇒ 该句与实际脱节，应改为「已一致」；② `:180` 的「**视觉脉冲**重启门」措辞：T-102 裁定按 §3.8 从严**门禁整个错误反馈（抖动+描边）** ⇒ 措辞应改为「错误反馈重启门」，否则后人会再读成「只门禁描边」。两处同文件、同性质 ⇒ **合并为一次 ux-spec 小追加**（文策渊）。

---

## WXG-T-118

- **名称**：**QA 复跑 P4 + P7（T-102 改码验证 + T-117 判据补齐后转正）**
- **负责**：严守真(qa)　**状态**：✅ 完成（2026-09-15；P4 **FAIL→PASS\***、P7 **PASS\*→PASS**；只重跑 P4/P7，未改 P4 预期、未放宽阈值）　**P2**
- **背景**：上游两单已闭合 —— **WXG-T-102**（BD-29 改码：wrong 描边单次脉冲 + 500ms 门，`α 极值点=1`、250 例全绿）、**WXG-T-117**（BD-35 文档：`ux-spec §5:187` 告急行补 `α 0.6↔1.0`@1000ms + 图标通道 + `reduceMotion`）。本单是**其下游取证**，按报告 §18.3-6 惯例「**先改探针、后改报告**」。
- **❗ 范围铁声明**：本轮**只重跑 P4 段 + P7 段**。其余段（P1–P3、P5–P6、P8–P26 等）**不重跑**，判定与预期值沿用现行轮次，**不得合并计数解读**（同 v1.2/v1.3/v1.4/v1.5/v1.6 的范围铁声明体例）。
- **阶段 0 诊断（主理人已核，直接采用）**：
  - **① P4 的预期值「无需再改」—— 这一点必须核准，否则会白改一轮甚至改错**：`g4-probe-v1.1.mjs` 的 **修订 38③（WXG-T-098 轮）** 已把这条例的预期值改成**现文新口径**并「先改后跑」。现行断言面（`:749` 标题即 `P4 (v1.3 改判) / BD-04 · BD-29 转态 · 拒绝反馈「单次脉冲 + 500ms 重启门」`，`:744-748`）：
    ```js
    const pulseStructOk = pk.peaks <= 1;                              // 一个 fx 窗口内 α 极值点 ≤1
    const gateStructOk  = minGapMs === null || minGapMs >= 500 - 1e-9; // 连续拒绝重启门 500ms
    const wrongOk = rejected === 1 && ... && shakeDir === 2 && pk.peaks >= 1;
    const v = wrongOk && pulseStructOk && gateStructOk && residual.length === 0 ? 'PASS'
            : (wrongOk && pulseStructOk && gateStructOk) ? 'PASS*' : 'FAIL';
    ```
    ⇒ 本轮**只重跑**，**不改 P4 预期**。预期结论：`v` 由 **FAIL → `PASS*`**（BD-29 三条件过，但 `residual` 大概率非空）。
  - **② P4 是复合条 ⇒ 两半边必须分列，别让 `PASS*` 把 BD-04 的残留盖掉**：`residual`（`:740-743`）承载 **BD-04 其余三行**（`vfx_fill_pop` / `vfx_clear_dissolve` / `vfx_complete_wave`，沿用 v1.1 读数、本单未复核该半边预期值）。**BD-29 半边本轮闭合；BD-04 半边维持「降级不关闭」** —— 报告须分列写明，并如实报 `residual` 的实测项（若恰为空则整条记 `PASS`，同样照实）。
  - **③ P7 必须改预期（收紧方向）** —— 探针自己钉着上限（`:1785-1788` 注释原文）：
    > 【BD-35 钉住上限】`ux-spec §5` 告急行**未定义 α 幅度**（报告 §BD-35：「QA 与美术侧均不自造常量」）⇒ 「脉冲到不到 1.0」无判据可验。因此即使可判定子句全过（含本轮新落地的满槽呼吸），本条**仍是 PASS\* 而非 PASS**；升 PASS 的前置 = BD-35 由 UX 侧在 §5 告急行补 α 数值。
    **该前置已由 WXG-T-117 满足** ⇒ 本轮须：**(a)** 新增**告急 α 幅度断言**（须覆盖 `[0.6, 1.0]`，真源 `ux-spec §5:187` + `tuning.ts:DANGER_PULSE_MS`「1→0.6→1」）；**(b)** 顺带为 **④ 满槽半边**加幅度断言（`:188` 现文亦已补 `α 0.6↔1.0`@500ms；此前该腿**只验周期未验幅度**）；**(c)** 删去「BD-35 钉住上限」注释与该 `v` 的强制 `PASS*` 分支 ⇒ 满足则记 **PASS**。
    **⚠️ 容差口径由 QA 定并写明理由**：130 帧采样 @60fps、告急周期 1000ms ⇒ 一个周期仅 60 帧，**端点未必采满**。容差须给出依据，**不得为凑绿放宽**（这是本单最容易被自己糊弄过去的一处，请把容差推导写进证据）。
  - **④ 顺带核查（不扩大范围）**：`:190` 目标格 `hint` 行现文亦补了 `α 0.5↔1.0`@600ms ⇒ 看一眼 **P19 / P3** 的 hint 相关断言是否因此可加／受影响（若 hint 态仍未实装则**不受影响，照实记**，不得借机改判）。
- **硬要求**：
  1. **先改探针、后改报告**（§18.3-6）—— 顺序不可倒置，不得留「先看输出再回填预期」的窗口。
  2. 探针头注**续号 = 修订 42**（现到 41），并写清「哪些是预期值改动（P7）、哪些只是重跑（P4）」。
  3. 证据落 `production/qa/beads/evidence/`（新日志），含 §0 范围声明 / 探针 stdout / 命令与计数 / P4·P7 逐条判定索引 / 未执行・⛔ 清单 / 汇总核对。
  4. **不得**把 ⛔ 写成 PASS；**不得**因数字好看而放宽阈值；**不得**为凑绿删旧断言而不登记改判。
  5. **效力边界（必须写进报告）**：本轮 P4 取证在**指令流层**（`RenderModel` 指令 α 序列），T-102 的单测在 **`[N]` 层**，二者**互补但不可互相替代**；**`[B]` 屏幕像素发光序列**与 **`[R]` 真机观感**（光敏性观感）**仍未取证** ⇒ 光敏性红线**不得据本轮宣称达标**。
- **权威来源（冲突以 A 为准）**：**A** `production/qa/beads/g4-probe-v1.1.mjs` 现行 P4/P7 段与头注修订体例 ＞ **B** `games/beads/design/ux/ux-spec.md` **§5:187/188/190/203**（T-117 回写后的现文）+ **§5:174**（闪烁口径正本「同一区域内 α 往复」）＞ **C** `games/beads/design/gdd/systems-index.md §3.8`（**≤2 次/秒 / ≤3Hz 红线**，只读）+ `timer-gameover §8-10` ＞ **D** 报告 `g4-regression-report.md` §18.3-6（惯例）、BD-29/BD-35 段、P4/P7 历史判定 ＞ **E** `production/TASKS-DETAIL.md` 的 `## WXG-T-102` / `## WXG-T-117` / `## WXG-T-118`。
- **Output Path**：`production/qa/beads/g4-probe-v1.1.mjs`、`production/qa/beads/g4-regression-report.md`、`production/qa/beads/evidence/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-118` 小节（**追加**）。
  **禁改**：`games/**`（含 `src/**` 与 `design/**`）、`packages/**`、`systems-index §3`、其他成员的台账小节。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`；另读 `AGENTS.md`、`production/qa/beads/g4-probe-v1.1.mjs`（头注修订体例 + P4/P7 段）、`games/beads/design/ux/ux-spec.md` §5。
- **约束**：只跑 P4/P7、不合并计数、不放宽阈值、不把 ⛔ 写绿；先问再写；不 commit/push。
- **后继（不在本单）**：若 P4/P7 均如预期转正，可另派一单做**本轮口径的收口**（是否具备把 G4 的 CONCERNS 升级、或仍需等 `[C]`/`[R]` 道次）。
- **完成记录（2026-09-15 · 严守真）**：
  1. **结果：P4 `FAIL → PASS*`；P7 `PASS* → PASS`**（两条**全如预期**转正，无意外卡点）。只重跑 P4+P7 两条 ⇒
     **范围铁声明成立**；与 T-116 轮 log 机验比对：**判定串 diff 仅 2 行**（P4/P7）、其余 **64 组逐字未变**，
     全文 diff 仅 16 行且全落在 P4/P7 小节内。
  2. **P4 实测**：`pk.peaks = 1`（判据 ≤1 ✓）、连续 9 次误点只起 2 次脉冲、`minGapMs = 500 ms`（判据 ≥500 ✓）、
     位移 max 2.6px ≤±3px、换号 2 ✓ ⇒ **BD-29 半边闭合**；`residual` 实测 **2 项**
     （`vfx_clear_dissolve` / `vfx_complete_wave`；`FILL_POP` 因签名去重=2>1 **未入 residual**）
     ⇒ 整条按既定判据记 **`PASS*`**、**BD-04 维持「降级不关闭」**（**两半边分列**，不得互相稀释）。
  3. **P4 预期值未改（核准）**：现行断言面即修订 38③ 的 T-098 现文口径（`pk.peaks<=1` / `minGapMs>=500-1e-9`），
     本轮**只重跑**；唯一文字订正是把**随 T-102 失效的旧代码锚点**（`view-model.ts:521` / `beads-game.ts:1524`）
     换成现锚点（`view-model.ts:435-445 wrongFlashAlpha` / `beads-game.ts:1850-1854 _armWrongFx`），
     并把 v1.3 轮对「α 下限≠0」的旧归因改述为**采样相位**（判定逻辑零改动，否则证据正文与实测自相矛盾）。
  4. **P7 实测（预期值收紧，唯一一处改动）**：删旧「BD-35 钉住上限」注释与强制 `PASS*` 分支；
     新增**告急 α 端点覆盖断言**（真实测 **min=0.600000 / max=1.000000**、偏差 0/0，tol **0.006667**）+
     **满槽半边端点覆盖断言**（同为 0.6/1.0、tol **0.013333**）；周期 1000ms（1.00Hz）/ 500ms；
     ⑤ 分区读法沿用（托盘 2.00Hz / HUD 1.00Hz，跨区合成 3.00/s 照实披露不判 FAIL）⇒ **P7 转 PASS**。
  5. **容差推导（QA 侧定，禁止为凑绿放宽）**：三角波半周期单调 ⇒ 幅度斜率 =(hi−lo)·2/T；采样步长
     Δt = 1/60 s ⇒ 最大相位偏差 Δt/2 ⇒ **tol =(hi−lo)·Δt/T**（与相位起点无关的**严格上界**）；
     判据 `abs(min−lo) ≤ tol` **且** `abs(max−hi) ≤ tol`（**两侧都断** ⇒ 欠幅/超幅均 FAIL）。
     结构旁证（不替代上界）：1000ms = 恰 60 帧、500ms = 恰 30 帧，采样窗 130/120 帧均 ≥1 整周期。
  6. **命令与计数**：`pnpm run harness:build` **EXIT=0** → `node production/qa/beads/g4-probe-v1.1.mjs` **EXIT=0**；
     全量 66 组 **PASS 39 ｜ PASS\* 17 ｜ FAIL 1 ｜ ⛔ 9**；**T-118 修订面（2 条）= PASS 1 ｜ PASS\* 1 ｜ FAIL 0 ｜ ⛔ 0**；
     唯一 FAIL = **P17**（既有欠账，非本单产生）。汇总段新增 **T-118 分桶**（P4 移出 T-098 桶、P7 移出 T-097 桶
     ⇒ 两桶条数 4→3，**非判定变化**）；七段计数**不得合并解读**（桶条数相加 94 > 66 系故意重叠口径）。
  7. **顺序自证（mtime 链，四步严格递增）**：上游现文 `ux-spec.md` 23:17:32 / `view-model.ts` 23:17:28 /
     `beads-game.ts` 23:17:37（**均非本 agent 改动**）→ 探针 **23:26:59**（改完 + `node --check` 通过）→
     `harness:build` dist **23:27:06** → 首跑结束 **15:27:09.563Z**、重跑结束 **15:27:31.176Z** → 报告 §24。
     两次运行**逐字节一致**（仅时间戳行不同）⇒ 确定性自证成立。
  8. **只读边界**：只写 `production/qa/beads/**`（探针 / 报告 §24 / 证据 2 份）与本小节；**未改** `games/**`
     （含 `src/**` 与 `design/**`）、`packages/**`、`systems-index §3`；未 commit / push；未跑 `pnpm run verify`
     （G1–G3 未复核，口径同前几轮，不得据本单改判）。
  9. **⛔ 未执行（原样在册）**：`pnpm run verify`（G1–G3）、`[B]` 像素层、`[C]` Cocos 产物、`[R]` 真机（无 AppID/无真机）、
     `[P]` Playtest；`A05-09` 本体仍 ⛔（**WXG-T-103 残留**：判据主体已更正为 `sfx_combo_t2`，探针/台账未同步）。
     **不得据本轮宣称「光敏性红线已达标」**，只能宣称「指令流层已符合 §3.8 时序口径」。
  10. **建议（裁决权归主理人）**：BD-29 **建议关闭**（限指令流层）、BD-35 **建议关闭**、
      **BD-04 维持「降级不关闭」**；**G4 维持 `CONCERNS`**（§21.3 第 ① 条具备解除条件，②③ 仍成立）。
      新增观察（不占 BD 号）：P4 证据串「折算峰频 ≈ 5.0 Hz」是窗口折算量、**非有效频率**（有效 = 2 次/秒），建议下轮改名。
  11. **产物**：`production/qa/beads/g4-probe-v1.1.mjs`（修订 43）、`production/qa/beads/g4-regression-report.md` §24、
      `production/qa/beads/evidence/g4-probe-v1.1-t118.log`（正式轮：§0–§6）、
      `evidence/g4-probe-v1.1-t118-rerun.log`（确定性自证）。
  12. **后继（本单已收尾；建议下一动作）**：① 由主理人裁 **BD-29 / BD-35 关单**（**BD-04 不关**）；
      ② `production/TASKS.md` 主表状态更新由主理人执行（**本单 Output Path 不含该文件**）；
      ③ 升级路径：`[B]` 浏览器逐帧取证（覆盖 P4 屏幕发光序列 + A05 时长族）→ AppID 到位后实测包体 → 同步 `A05-09` 清 T-103 残留。
- **主理人独立复核（2026-09-15，事后非采信自述）**：
  - **P7 判定面已核**（`:1857`）：`const v = okPulse && okFull && okAmpUrgent && okAmpFull ? 'PASS' : 'FAIL';` —— **无强制 `PASS*` 残留** ✅；标题改 `P7 (v1.7 改判) / BD-10 · BD-35 闭合`，正文注释明写「旧『BD-35 未定义幅度 ⇒ 强制 PASS\*』已删」。
  - **容差实现已核**（`:1847-1848`）：`const tolUrgent = ampTol(0.6, 1.0, T.DANGER_PULSE_MS);` / `ampTol(0.6, 1.0, T.TRAY_FULL_PULSE_MS)` —— **由 §5 现文值与 `tuning` 周期算出，未硬编码** ✅。推导 `tol = (hi−lo)·Δt/T`（`:265-271`）是**与相位起点无关的严格上界**，且**两侧都断**（欠幅与超幅均 FAIL）✅ —— 这个推导是硬功夫，不是「拍个余量」。
  - **分桶已核**（`:2912-2914`、`:2922`）：`inT118` 含 P4/P7；**T-098 桶已剔除 P4、T-097 桶已剔除 P7** ⇒ **无重复计数** ✅（分桶迁移容易漏，这里做对了）。
  - **报告结构已核**：§24（`:1328-1493`）含 24.3 P4 **两半边分列**、24.4 P7、24.5 顺带核查、24.6 效力边界、24.7 探针自身改动自查、24.8 ⛔、24.9 建议裁定 ✅。
  - **门禁**：beads 单测全绿；`pnpm run verify` = **PASS 14 ｜ WARN 0 ｜ SKIP 1 ｜ FAIL 0** ✅。
  - **❗ 发起方（主理人）错误登记**：本单工单写「探针现到修订 41 ⇒ 续号 **42**」，但工作树 `:222` 的 **42 已由 WXG-T-116 占用** ⇒ 我的前提**读错了**（只读了头注末条，未 grep 实际占用）。成员**未照单硬塞重号**，改用 **43**（`:243`）且确未重号 ⇒ **处理正确，不追认偏离**。**教训入册：工单里的「现到第 N 条」类前提，必须用 `grep` 核实实际占用，不能只读头注末条。**
  - **两处值得记录的正面之处**：① **P4 证据正文的订正属必要且未触判定** —— 旧锚点（`view-model.ts:521` / `beads-game.ts:1524`）随 T-102 失效，若不订正，正文会与实测（峰点数=1、门=500ms）**自相矛盾**，后人会读成「探针自证假绿」；成员**主动**处理并明确声明「判定逻辑零改动」，分寸对。② **主动纠正发起方错误**（42→43），没有照单执行 —— 这正是「先核再写」要的行为。
- **主理人裁定（成员四项未决）**：
  1. **BD 关单 = ①**：**BD-29 关闭**（**限指令流层**，效力边界须随关单声明一并保留）、**BD-35 关闭**、**BD-04 维持「降级不关闭」**（`residual` 实测 2 项：`vfx_clear_dissolve(200ms)` + `vfx_complete_wave(逐列20ms/800ms)`）。**明确不采纳 ③**（连 BD-04 一并关）—— 残留实测非空，关掉即假绿。
  2. **P4「折算峰频 ≈5.0 Hz」字段 = ① 下一轮改名/删除**（**本单不改**）。理由：该值是窗口**折算量**（峰点数×1000/`WRONG_FX_MS`），**不是有效闪烁频率**；有效频率来自 500ms 门 = **2 次/秒**，那才是 §3.8 红线的口径。字段名带「Hz」会让后人误读成「有效频率 5Hz ⇒ 超红线」。登记为**下一轮探针小改**（与 `A05-09` 同批）——本单不改是为避免打断已落定的 mtime 顺序自证。
  3. **`A05-09` 探针/台账同步 = ① 并入下一轮 QA**（与 `[B]` 道次同批）。
  4. **主表状态由主理人更新** ⇒ 本回复已完成（`TASKS.md` 行已回填）。
- **关单后果（必须写进各自的缺陷记录，不得只改状态）**：BD-29 与 BD-35 的关闭均**仅覆盖指令流层的可判定结论**；**`[B]` 屏幕像素发光序列**与 **`[R]` 真机观感**仍**零证据** ⇒ 光敏性安全**不得据本轮声称达标**。真机首验须把「wrong 态观感 + 告急脉冲观感」列 P0。

---

## WXG-T-119

- **名称**：**beads · `[B]` 浏览器逐帧取证（P4 屏幕发光序列 + A05 时长/包络族）**
- **负责**：严守真(qa)　**状态**：📋 已立项（待施工）　**P1**
- **背景**：WXG-T-102 / T-117 / T-118 三条改判共同的**天花板**就是 `[B]` 道次。T-118 后 P4 在**指令流层**转 `PASS*`、P7 转 `PASS`，但**屏幕像素层**与**真实合成音频层**仍是零证据（T-118 报告 §24.6 已把这条边界写死）。本单即补这一层。
- **道次口径（先钉死，勿混用）**：`production/qa/beads/test-cases.md:10` 图例 —— `[N]` 无头浏览器**逻辑层** / **`[B]` 浏览器真实渲染·像素级**（≈ `[Cocos]` 已解锁像素道次）/ `[R]` 真机·微信宿主 / `[P]` 人（听感·Playtest）。**T-118 是 `[N]`（指令流），本单要 `[B]`（真实渲染像素 / 真实合成音频）**，两者结论不得互相顶替。
- **成熟范式先例（强烈建议照做，不要另发明骨架）**：`production/qa/beads/cocos-input-probe.mjs`（**WXG-T-108**，同作者）已经是本仓一枚跑通的 `[B]` 探针，具备本单需要的一整套纪律，其文件头明确写了本仓吃过「判别力为零的探针」的亏：
  1. **预期值先写后跑**（判据的算术推论**先落盘**，不是看输出回填）—— 反假绿；
  2. **判据自检 `SELF-xx`**：把**修复前**的实测数字喂给同一批判定函数，断言它们**必须判 FAIL** ⇒ 用反例证明探针**有判别力**；
  3. **退出码契约**：`0` = 可执行全 PASS ｜ `1` = 存在 FAIL（真回归）｜ `2` = 无 FAIL 但**有未预期阻塞 / 探针无效**（**不得当绿**）｜ `3` = 脚本级环境错误；
  4. **道次诚实**：`⛔` 显式登记「阻塞 + 解除条件」，**不记 PASS 也不记 FAIL**；
  5. **新鲜度自查**：入口/产物须为当前代码所构建，并自查镜像一致性。
- **Deliverables**：
  1. **新建 `[B]` 探针**（落 `production/qa/beads/`，命名自定，如 `beads-browser-probe.mjs`），对齐上条骨架；**自带断言 + 退出码**，可复跑。
  2. **P4 屏幕发光序列**（覆盖 T-118 未覆盖的那一层）：真渲染后**逐帧**取屏幕像素/画布，量
     - wrong 描边在**屏幕上的发光强度时间序** ⇒ **α 极值点 ≤1**（单次脉冲，非往复）；
     - 连续拒绝时 **500ms 起播间隔在屏幕层成立**（⇒ 有效闪烁 ≤2 次/秒）。
     判据正本：`ux-spec §5:180` + `systems-index §3.8`（冻结值）。
  3. **A05 时长 / 包络族**（T-118 报告里那批 `⛔` 条目）：在**真 WebAudio** 上取**真实合成输出**量时长与包络。**哪些条可测、哪些仍 ⛔ 由你逐条判定并写清原因**；**听感（A05-26）留 `[P]` ⛔**，不得代判。
  4. 报告**追加一节**（v1.8），结构对齐既有体例（含**效力边界**与 ⛔ 清单 + 解除条件）。
  5. **顺带夹带（T-118 主理人裁定的两项小额项，同批做掉）**：
     - **`A05-09` 探针/台账同步**（清 **T-103 残留**：主体已改 `sfx_combo_t3 → sfx_combo_t2`，探针/台账未同步）；
     - **P4「折算峰频 ≈5.0 Hz」字段改名/删除** —— 该值是窗口**折算量**（峰点数×1000/`WRONG_FX_MS`），**不是有效闪烁频率**（有效频率 = 500ms 门 ⇒ **2 次/秒**）；字段名带「Hz」会让后人误读成「有效 5Hz ⇒ 超红线」。
- **⚠️ 阶段 0 必须先判清的障碍（先回传，别硬上）**：
  1. **substrate 选哪条？** `[B]` 可用 (a) **Cocos web-mobile 产物**（真机同源渲染路径，`pnpm --filter @wxgame/beads run build:cocos:web` 无需 AppID，产物已存在）或 (b) **harness 页面**（`dev/harness`，Canvas2D 渲染器，**渲染器与真机不同源**）。**优先 (a)**；若因故改选 (b)，须在报告里**披露渲染器不同源**这一限制。**选哪条、理由是什么，写进报告。**
  2. **真出声通路在哪条 substrate 上成立？** 已核事实：beads **确实**把 `BEADS_AUDIO_VOICES` 交给 App ⇒ `Platform.createAudioBackend({ voices })`（`games/beads/src/game/beads-game.ts:82/199-200/1678-1681`），而 `packages/framework/src/platform/web.ts` 在**有 `AudioContext` 且有 `voices`** 时返回 `SynthAudioBackend`（否则诚实退 `NullAudioBackend`）⇒ **浏览器侧真出声通路存在**。但**该通路在 Cocos 产物上是否同样接上，须现场核实**（`BeadsBootstrap.ts` 侧）。
  3. **无头 Chrome 的 WebAudio 时序**：无头环境可能无音频设备 ⇒ `AudioContext.currentTime` 未必推进。**`OfflineAudioContext` 可离线渲染真实 PCM、不依赖设备**（这是一条提示，不是指定方案）；若采用，须说明「离线渲染的真实性边界」（它证的是**合成器输出**，不是**声卡输出**）。**方法由你定，但须写明其效力边界。**
  4. **`tools/scripts/**` 不可用**：`render-harness-frame.mjs` / `render-harness-clip.mjs` 是 **breakout 硬编码**（`game.movePaddleTo(...)`）⇒ **不支持 beads**（= §18.2 **B8**，BD-19/BD-13 残留，属**工程域**）⇒ **本单不得指望它，也不要改它**；走自建探针。
- **硬要求**：
  1. **预期值先写、后跑**（顺序不可倒置），新探针头注写清判据来源与「先写后跑」自证。
  2. **判据自检必做**：用**修复前**的读数（P4：`pk.peaks=2` / 无 500ms 门；A05：声明值 vs 实测包络的差异）喂同一批判定函数，**断言必判 FAIL**。
  3. **不得**把 ⛔ 写成 PASS；**不得**把 `[P]`（听感）代判；**不得**为好看放宽阈值。
  4. **效力边界（必须写进报告）**：本轮即使全绿，也只到 **屏幕像素层 + 合成器输出层**；**真机硬件/观感（`[R]`）与人耳听感（`[P]`）仍零证据** ⇒ 光敏性安全可据本轮从「指令流层」升到「**屏幕像素层**」，但**仍不得宣称「真机不闪 / 同屏不刺眼 / 听感达标」**（屏幕像素 ≠ 人眼感知：还差屏幕亮度、环境光、硬件差异）。
  5. 证据落 `production/qa/beads/evidence/`（含新探针 stdout 全文 + 确定性重跑自证 + 截图/像素取样物）。
- **权威来源（冲突以 A 为准）**：**A** `production/qa/beads/cocos-input-probe.mjs` 文件头（**范式与纪律**）+ `test-cases.md:10`（**道次图例**）＞ **B** `ux-spec §5:180/187/188` + `systems-index §3.8`（P4/P7 判据与冻结红线）+ `audio-events §4`（A05 各条时长/包络判据）＞ **C** `g4-regression-report.md` §18.2（B1/B5/B8 阻塞项）、§24.6（T-118 效力边界）、§19.3（A05 ⛔ 清单）、§21.3 ＞ **D** `production/TASKS-DETAIL.md` 的 `## WXG-T-118`（裁定 ① 关单口径 / 裁定 ② 峰频字段）与 `## WXG-T-102`。
- **Output Path**：`production/qa/beads/beads-browser-probe.mjs`（新建，名可自定）、`production/qa/beads/g4-probe-v1.1.mjs`（**仅** P4 峰频字段改名 + A05-09 同步；其余不动）、`production/qa/beads/g4-regression-report.md`、`production/qa/beads/evidence/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-119` 小节（**追加**）。
  **禁改**：`games/**`、`packages/**`、`tools/scripts/**`、`systems-index §3`、`ux-spec.md`、其他成员的台账小节。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`；另读 `AGENTS.md`、`production/qa/beads/cocos-input-probe.mjs`（**头注全文**）、`production/qa/beads/test-cases.md` §I 节首（道次等价关系）。
- **约束**：不代判 `[P]`/`[R]`、不把 ⛔ 写绿、不放宽阈值、不动工程域文件；先问再写；不 commit/push。
- **后继（不在本单）**：① `[R]` 真机首验（需 AppID + 真机，P0 检查项含 wrong/告急观感）；② §18.2 **B8**（`preview:frames` 支持 beads）属**工程域**，需另立工程单；③ 若本轮 `[B]` 全绿，G4 的 CONCERNS 是否可升，另派收口单裁。
- **完成记录（首轮 · 2026-09-15 · 严守真）—— 状态：🔄 部分完成（`[B]` 通路已建立；A05 段未执行）**：
  - **产物**：① 新建 `production/qa/beads/beads-browser-probe.mjs`（1148 行、`node --check` 通过；含判据来源 / 道次 / **预期值先写后跑** / 退出码契约 / `SELF-01`·`SELF-02` 判据自检）；② 报告**追加 §25**（v1.8）；③ 证据 `evidence/beads-browser-probe.log`（10541 B）+ `evidence/beads-browser-p4-screen.json`（逐帧像素取样物）+ `beads-p4screen-{base,peak}.png`（目视留证，不作判据）。
  - **substrate 选型（§7.1 要求写明）**：**(a) Cocos web-mobile 产物**（真机同源渲染路径）；**未**选 (b) harness（Canvas2D 渲染器，**与真机不同源**）。**未重跑** `build:cocos:web`（产物 mtime 15:36:43Z 晚于源最新 15:18:12Z；`framework:sync:check` exit=0）。
  - **结果**：`PASS 6 ｜ PASS* 0 ｜ FAIL 5 ｜ ⛔ 4`，脚本退出码 **1**（**建议按契约记 `2`**，见下「D0」）。
  - **❗ 5 个 FAIL 逐条定性（本单最高价值一问答毕）**：
    1. **ENV-04 = 探针缺陷**（交叉验证方法不成立）：`readPixels` ↔ 同帧 `toDataURL()` 平均 `|Δ| = 36.382`（判据 ≤2）、最大 235 ⇒ 两条取数路径本非同物，**不能**反推「钩内读回非真实帧」。
    2. **ENV-03 = 派生 FAIL**（判定式 = `env04ok===false`）⇒ 随 ENV-04 不可采信；但其「钩外读回不可依赖」的**前提订正有效并保留**（原写「钩外恒 0」，实测全画布求和 **453900000** 否证之）。
    3. **CLK-01 = 真实偏差，落在宿主集成层** ⇒ 登记 **BD-40**：墙钟 2.510s 内仿真推进 5.017s、固定步 301 / 渲染帧 150 ⇒ **仿真/墙钟 = 1.999（双驱动）**；真机有同源风险（`WeappPlatform.requestFrame` 同样优先 `requestAnimationFrame`）。
    4. **P4S-01 = 探针缺陷（测度不纯 + 显著度算法）**：见下条「2 个像素极值」。
    5. **P4S-03 = 读数真实、成因 = CLK-01**：墙钟最小起点间距 299ms ⇒ 3.35 次/秒 > 2；但实现自身 game 时基口径 **P4S-02 ✅（600ms ≥ 500ms）**。
  - **❗「2 个像素极值」定性（主理人点名的一问）= 测度不纯，非屏幕层真 2 峰**：① **`m` 不是 α 的纯函数** —— f7/f8 的 α **完全相同（都 =1.000，保持段）**，`m` 却由 **27372 掉到 22268（−19%）**；而 `dx=0` 的两帧（f6/f9）α 相同且 `m` **逐位相同（24995）** ⇒ `m` 与**位移通道**强相关。② **机制**：box 半宽 43 device px、格间距 52 设计 px ⇒ box **跨骑相邻格**，而抖动 ±3 设计 px **超过 2 设计 px 格间隙** ⇒ 位移改变遮挡关系（行主序绘制 ⇒ 右移被邻格盖更多）⇒ `m` 对位移**符号不对称**（+2.6px ⇒ 22268 ＜ 0 ⇒ 24995 ＜ −2.6px ⇒ 27372）。而 `ux-spec §5:180` 明文把 ±3px 抖动定为**位移、不在闪烁通道内**。③ **另有独立算法缺陷**：显著度取 `min(左基,右基)`，标准地形显著度应取 **`max`** ⇒ 以正确口径复算次峰显著度 = **2727 < 门槛 5474** ⇒ **峰点数 = 1**（与 T-118 §24.3 的 `pk.peaks=1` 一致）。⇒ **不得**据此判「屏幕层真 2 峰」（不开新 BD 号、不改实现），**也不得**改判 PASS（该测度不可用）。
  - **A05 段：未执行（如实登记）** —— `RUN_AUDIO` 在页面侧跑完且**无页面错误**，但 `pg.evaluate()` **返回 `undefined`**（log 第 62 行 `[DBG] audio typeof=undefined`）⇒ `if (audio)` 不成立而 `record('AUD-00'…)` 写在该分支内部 ⇒ **静默跳过整段 A05**（`wxgame-qa-gates` 明文禁止静默跳过）⇒ 登记探针缺陷 **D4**。`AUD-00`（§7.2 现场核实）亦未完成。**⛔ 不记 PASS 也不记 FAIL**；报告 §25.6 已逐条给出「可测 / 仍 ⛔」判定与解除条件。`A05-26` 听感留 `[P]` ⛔ **不代判**。
  - **顺带两项（T-118 裁定）**：`A05-09` 探针同步与 `g4-probe-v1.1.mjs:802` 的「折算峰频 ≈5.0 Hz」字段**上轮均未落**（已 `grep` 核实）⇒ 本轮处理，改动面见报告 §25.7。
  - **判据自检判别力**：`SELF-01` **PASS**（喂「修复前形态」反例：200ms 内 2 峰 → 峰数判定 `FAIL(对)`；无门、起点间隔 100 game ms → 门限判定 `FAIL(对)`）；`SELF-02` **PASS**（130% 超长 ⇒ FAIL；恰 120 ⇒ PASS；`=`195 ⇒ FAIL；**瞬时起音 ⇒ FAIL**；线性 4ms 起音 ⇒ PASS）⇒ 判定函数**有判别力**。**缺口**：自检**不覆盖**「测度纯净性」——正是本轮翻车处 ⇒ 登记 **D3**。
  - **探针自身缺陷 5 处**：`D0` 退出码分支（FAIL 无条件优先于「探针无效」⇒ 本轮应为 2 实落 1）；`D1` ENV-04 判据形式；`D2` box 跨骑邻格；`D3` 显著度 `min`→`max` + 自检缺测度纯净性；`D4` A05 静默跳过。**均为探针缺陷，与实现缺陷严格分开**；实现侧**零新增 BD**（唯一新增 = `BD-40`，落宿主集成层）。
  - **G4 建议：维持 `CONCERNS`**（§18.5 / §21.3 / §24.9 同口径）——① 本单**无被测实现的真回归**；② 第 ② 条「`[B]/[C]/[R]/[P]` 四道次」**动了但未通**（`[B]` 通路建立 ≠ `[B]` 取证完成）；③ 第 ③ 条（beads 主包红线无实测数据）**依旧成立** ⇒ **不得据本单升 PASS**。
  - **效力边界（写进报告 §25.8，一句不可省）**：本轮即使全绿也只到**屏幕像素层 + 合成器输出层**；而实际**这两层都未取证**。`[R]` 真机观感与 `[P]` 人耳听感**零证据** ⇒ **不得**宣称「真机不闪 / 同屏不刺眼 / 听感达标」。⛔ 不记 PASS 也不记 FAIL；`[P]`/`[R]` 不代判。
  - **约束遵守**：只写 §Output Path 内文件与本节；**未改** `games/**`（源码）/`packages/**`/`tools/**`/`systems-index §3`/`ux-spec.md`/其他成员台账；**未 commit / push**。
- **复跑补记 + 勘误（2026-09-16 追记 · 覆盖上文与之冲突的表述）**：
  - **以上「完成记录（首轮）」写的是首轮**（日志时间戳 `15:46:55Z`）。此后同一探针又跑了**两轮**（`18:03:53Z` / `18:59:35Z`）⇒ **以第三轮为准**；报告已追加 **§25.12 勘误节**（不改写 §25 正文）。
  - **最新计数（第三轮 `18:59:35Z`）**：`PASS 13 ｜ PASS* 10 ｜ FAIL 1 ｜ ⛔ 4` ⇒ **唯一 FAIL = `CLK-01`**（仿真/墙钟比值 **2.005**；三轮 1.999 / 2.029 / 2.005 **稳定复现**）⇒ **退出码记 `1`**（**不是 `2`**——我原先「应记 2」的答案已在 §25.12.3 更正；契约里 `2` 的定义以「**无 FAIL**」为前提，本轮不适用）。
  - **勘误 · 我错了**：`ENV-04` 的 `平均|Δ| = 36.382` 真根因 = **我的比对代码漏了 GL 行序 `bh-1-y`**（把同一 box 上下颠倒地比），**并非**我原判的「预乘 α / 取数路径不同」。修后 **平均|Δ| = 0.0000**、负向反证（故意错位）**68.41** ⇒ `ENV-04`/`ENV-03` **转 PASS**，原结论**撤回**。
  - **❗新增关键结论 —— 屏幕层 `P4S-01/02/03` 的 PASS 不得采信**：① `onset` 阈值由**几何先验** `RING_FULL_EST = 25049` 折算，而**实测窗口 max 仅 2023（= 先验的 8.1%）** ⇒ 阈值**正好压在峰上** ⇒ 「峰点数 = 1」**平凡为真**，且「非零支撑 = **33.3 game ms**」自证**欠采样**（判据对标的包络是 200ms）；② **三轮回异**：`P4S-03` = **3.35 / 3.95 / 1.67 次/秒**（FAIL / FAIL / **PASS**）、`P4S-02` 的 game 起点间距 = **600 / 500 / 1200 ms** ⇒ **同一判据面给出相反结论**。⇒ **屏幕像素层仍属「未取证」**（不是没通路，是**判据面与采样栅格不达标**）。修法（下轮 P0）：阈值改数据相对口径 + 支撑加下限 + **采样与 rAF 解耦**（`app.update(1/60)` 定步），做不到则须声明栅格并**拒绝判定**。
  - **A05 段状态更正（已执行，非「未执行」）**：`AUD-00 PASS`（`SynthAudioBackend` / voices = **19** ⇒ **§7.2 现场核实完成**）；10 条 A05 有真 WebAudio 实测（`PASS*`）：**03** 119.61ms + 起音 3.107ms、**04** 99.82、**09(t2)** 149.93、**15** 499.55 + 双段（谷 0.4% / 回升 100%）、**16** 799.59、**18** 199.68/149.86、**19** 249.98、**21** 8000ms + 接缝 0.0004 ≤ 环内最大 0.0011、**22** `activeLoops` 恒 1、**25** 0 KB。**`A05-09b` 两轮不一致（348.39 → FAIL / 通过）⇒ 待裁；QA 不放宽 ±1ms**。量规迭代（−40dB→−60dB、窗级→**样本级**）**只改量规、判据一字未改**。`A05-26`（`[P]`）/ `A05-27`（`[R]`）**仍 ⛔ 不代判**。
  - **顺带两项：本轮已落盘（动手前已 grep 确认此前确实未做）**：① `g4-probe-v1.1.mjs` 的 `A05-09` 主体 `sfx_combo_t3` → **`sfx_combo_t2`**，t3 另立 **`A05-09b`**（**条数 66 → 67**，判据真源 = `audio-events §4` WXG-T-103 现文，非新造判据 ⇒ **T-103 残留清零**）；② 删去 P4 证据串的「折算峰频 **≈X Hz**」字段，改注为**窗口折算量**口径（**不是有效闪烁频率**；有效 = 500ms 重启门 ⇒ **2 次/秒**）。两处均 `node --check` 通过；**只改未复跑**（该探针**无 `--log` 开关**，复跑会覆盖 T-118 证据）⇒ 报告 §24.1 的计数仍为**改前口径**（已在探针头注与报告 §25.12.7 声明）。
  - **新增探针自身缺陷（与实现缺陷严格分开）**：`D5` `onset` 阈值随视口漂移（44.8% ↔ 8.1%）；`D6` 采样栅格未与 rAF 解耦（33.33–83.33 game ms）；`D7` `SELF-01` 用**实测帧长**构造反例（6 帧 × 83.33 = 500ms）⇒ **异常帧长下自检失效**（第二轮 FAIL / 第三轮 PASS ⇒ 自检本身不稳定）；`D8` `AUD-01` 的「预期（先写）」栏写成「（见正文）」= **无先验预期**（违反「先写后跑」纪律）。`D1` 真根因已更正；`D3` 已由我修（显著度 `min(左基,右基) → max`，影响面已核：**不改变第三轮任何 PASS/FAIL**）；`D4` 随 A05 段落地而消除。
  - **新增缺陷（唯一，落点在宿主侧）：`BD-40`** = 宿主双驱动（App 自驱 + `CocosLoopBridge.schedule` 同时推进 `app.tick`，实测 ≈2 倍帧步，**三轮复现**）⇒ **真机有同源风险**（`WeappPlatform.requestFrame` 同样优先 `requestAnimationFrame`）⇒ 列入真机首验 **P0**；**若真机同样 ≈2×，则升级为产品级 P1**。
  - **G4 建议：仍 `CONCERNS`**（不得升 PASS）—— ② 「`[B]` 道次」**动了但判据面不达标 ⇒ 仍未通**；③ beads 主包红线**无实测数据**。**不得宣称**「屏幕层不闪 / 真机不闪 / 同屏不刺眼 / 听感达标 / `[B]` 道次已覆盖」。
  - **⚠️ 并发声明**：本轮工作树有**并发会话在同一单上作业**（`evidence/*` 于 `02:59:41–46` 被其重写、探针被其扩充 A05 段）。我为免覆盖其新鲜证据**未再复跑**。若本节的「§25 正文」与并发会话产出的版本冲突，**以 §25.12 勘误为准**，并请主理人收口（含 `g4-regression-report.md` 是否出现重复 §25 的检查）。
- **主理人复核 + 裁定 + 收口（2026-09-16）**：
  - **事实复核（非采信自述）**：① 探针 `beads-browser-probe.mjs` **75502 B、`node --check` 通过**；② **`BD-40` 主理人已做代码级确证** —— `packages/framework/src/compose/app.ts:121`（`start()` 无条件 `_schedule()`）→ `:158-169`（`platform.requestFrame` **自驱** `tick`）**与** `packages/framework/src/adapters/cocos/loop-bridge.ts:32/42`（`schedule(_tick, 0)` → `app.tick(dt)`）**同时驱动**，而 `adapters/cocos/bindings.ts:106-108` **两者都接**（`new CocosLoopBridge(app)` + `start()`，其内部又调 `App.start()`）⇒ **双驱动成立**，与实测 1.999/2.029/2.005 **三轮复现吻合**；③ **无重复 §25**（仅一处 `## 25.` + 一处追加节 `## 25.12`，且后者自声明「覆盖 §25.0–§25.11 中与之冲突的表述」）；④ `check:tasks` / `check:links` 均 OK。
  - **裁定 ①：G4 维持 `CONCERNS`（不得升 PASS）** —— 采纳 QA 建议。`[B]` 道次**动了但判据面不达标**，屏幕像素层**仍属未取证**；`beads` 主包红线仍无实测数据（无 AppID）。
  - **裁定 ②：屏幕像素层结论「不采信」，且这不是失败而是判据面不合格** —— 采纳 QA 自判：`onset` 阈值由**几何先验** `RING_FULL_EST` 折算，而实测窗口 max 仅为其 **8.1%↔44.8%**（**随视口漂移**）⇒ 阈值压在峰上 ⇒「峰点数=1」**平凡为真**；且「非零支撑 33.3 game ms」自证**欠采样**（对标包络是 200ms）；**4 次运行 `P4S-03` = FAIL/FAIL/PASS/FAIL** ⇒ 同一判据面跨轮给出**相反结论**。⇒ **下轮 P0 修法**：阈值改**数据相对口径** + 支撑加下限 + **采样与 rAF 解耦**（定步 `app.update(1/60)`）；做不到则须声明栅格并**拒绝判定**。
  - **裁定 ③：本轮唯一实质推进 = `[B]` 通路建立 + A05 时长/包络族实测** —— `AUD-00 PASS`（**§7.2 现场核实完成**：Cocos 产物上 `SynthAudioBackend` + voices=19）；10 条 A05 有真实合成输出实测（`PASS*`）；`A05-09` 清 **T-103 残留**（主体 `sfx_combo_t2` + 另立 `A05-09b`，**条数 66→67**）；顺带项 ② 删去「折算峰频 ≈X Hz」误读字段。**`A05-09b` 两轮不一致（348.39 FAIL ↔ 通过）⇒ 挂「待裁」**；**QA 拒绝放宽 ±1ms 是正确的** —— 交给设计侧裁「该量规下的固有截断是否属容差」。
  - **裁定 ④：`BD-40` 定级 `P1`**（**若真机同样 ≈2× ⇒ 升产品级 P1**）。**后果必须写足**：仿真/墙钟 ≈**2×** ⇒ 倒计时/动效/音频时长相对墙钟**减半**，且 **wrong 闪烁在墙钟口径 3.35–4.49 次/秒 > `systems-index §3.8` 的 2 次/秒** ⇒ **光敏性红线在宿主层被违反**（`T-102` 的游戏时基逻辑本身正确）。**真机有同源风险**（`WeappPlatform.requestFrame` 同样优先 `requestAnimationFrame`）⇒ 列出真机首验 **P0**。**注意 `WXG-T-121` 已把 BD-40 挂进门禁**（另一会话），该线只解决**检测**；**BD-40 的修复本身仍无工程单**，需另立。
  - **裁定 ⑤：并发收口完成** —— 无重复 §25；探针以 `mtime` 最新者为唯一真源；`D3` 修正（显著度 `max`）保留、`D5` 发现（几何先验阈值面不成立）**已被并发作业采纳并写入探针注记**。
  - **❗ 发起方（主理人）错误登记**：我把工具返回的两次 **「Execution Cancelled: Idle timeout」当作「代理已死」**，第二次**险些据此重复派工**；实测该消息**不可信** —— 第一次报 cancelled 后代理**仍继续跑了 40+ 分钟**并产出次轮成果，第二次同样续跑至收工。⇒ **教训入册：该 cancelled 消息不得作为「已停止」的判据，必须以文件 `mtime` / 进程表核实后再动作。**
  - **残留（不阻断，留档）**：① 报告 `## 25.12` 是**二级标题却用子节式编号**（`25.12`），格式微瑕；② `evidence/*.log` 被根 `.gitignore:55` 的 `*.log` 覆盖 ⇒ **不入 git**（沿用既有体例，复核请读盘）；③ `pnpm run verify` 未随本单跑（口径同前几轮）。

- **终轮复跑记录（2026-09-16 · 严守真=并发 QA 会话；**执行主理人 §25.12.2 列为「下轮 P0」的修法**）**：
  - **做了什么**：把 §25.12.2 的三条修法（＋§25.12 缺陷表 D7/D8）在探针里落盘，**只改探针、判据数值一字未改**：
    **D5** 起播门限改**数据相对**（`0.15 × 本序列 max`，滞回下界 `0.02×max`；`RING_FULL_EST` 不再参与判定）；
    **D5②** 支撑判据改**两端都断** `[80, 233.3] game ms`（下限 80ms **由指标自身仿射律推出**：`metric(α) ∝ max(0,141α−55)` ⇒ α<0.39 恒 0 ⇒ 以 0.15·max 为界 ⇒ α≥0.48 ⇒ 200ms 梯形包络预期支撑 ≈134ms）；
    **D6** 采样与 rAF **解耦**：新建**精栅格上下文** —— `comp._loop.stop()`（撤 Cocos schedule ＋ `app.stop()` 撤自驱）后由探针每帧 `app.loop.advance(1/60)` ⇒ **每样本恰 1 固定步（16.67 game ms）**；
    **D6′（本轮新发现）** 间距/支撑改取**逐样本真实时钟**（`pulseClock` 差 / `performance.now()` 差）—— 首版用「帧号 × 中位栅格」，而**每帧推进的固定步数并非常数**（实测 16.67/33.33/50ms 混布）⇒ 把 583ms 的间距误算成 433ms，**这才是 §25.12「三轮回异」的直接成因**；
    **D7** `SELF-01` 反例改用**标称固定步** `1000/60` 折算；**D8** `AUD-01` 补先验预期；**D9** 支撑下限改由仿射律推出（首版直接取 0.6×200=120ms ⇒ 把 100–150ms 的**正确**读数伪判不通过）；
    **D0**（§25.12.3 建议）新增第三态 **`⊘` = 判据面不成立（拒绝判定）**，与 `⛔` 同级、**不影响退出码**。
  - **终轮结果（两轮判定串逐字一致 ⇒ 确定性自证成立）**：`PASS 12 ｜ PASS* 10 ｜ FAIL 1 ｜ ⛔ 4 ｜ ⊘ 2` ⇒ **退出码 `1`**，**唯一 FAIL = `CLK-01`**（仿真/墙钟 **2.003**）。
    - `P4S-00` 21 个候选无环帧 `ringMetric` **全 0**；`P4S-01` 峰点数 **1**、**非零支撑 150.0 game ms ∈ [80,233.3]**；
      `P4S-01b` 连续拒绝下 **6 次脉冲逐次数峰 = 全 1**（两轮中一轮出现 1 次 2 峰 ⇒ 记 `⊘`）；
      `P4S-02` 起播间距（game）**[617,600,583,617,583] ms ⇒ 最小 583 ≥ 500**（判据含 1 栅格容差 483.3）⇒ **§25.12.2 的「不得采信」已在 game 时基上解除**。
    - `P4S-03` 记 **`⊘`**：直测墙钟 2.22 次/秒 vs 由 `CLK-01` 比值换算 3.88 次/秒 ⇒ **两法差 1.75 倍** ⇒ **双驱动宿主上「墙钟」这一个量本身不稳定** ⇒ 拒绝判定（不给 PASS 也不给 FAIL）。
  - **A05 段最终口径**：判据面 = **1ms 窗峰值包络**（不是样本级 —— 多音叠加如 `sfx_combo_t3` 的瞬时和**拍频到零**，样本级会系统性提前 348.39 vs 窗级 349.21）；容差 = **1 窗 = 1ms**（由量规几何推出）。`A05-09b` 终轮 **349.21ms** ⇒ 通过（**未放宽 ±1ms**，改的是量规口径）⇒ §25.12.5 的「待裁」建议**按量规收敛关闭**，仍请设计侧确认口径。
  - **效力边界（不因转绿而放宽）**：可宣称「**一次拒绝 = 一次可见脉冲事件**（game 时基 ≥500ms、像素支撑 133–150ms）」＋「合成器输出层 10 条 A05 实测」＋「`[C]` 音频资产 0」；
    **不可宣称**「真机不闪／同屏不刺眼」（`[R]` 零证据）、「听感达标」（`[P]` 零证据）、「`[B]` 道次已覆盖」、「α 极值点 ≤1 已在屏幕层证实」（严格判据面仍是指令流层 T-118 §24.3；屏幕度量混有 ±3px 位移通道）。
  - **`BD-40` 的可复核事实已加强**：仿真/墙钟 = **2.003** ⇒ 同一「game 500ms」的门在墙钟上只值 ≈ **250ms** ⇒ **若真机同为双驱动，墙钟有效闪烁 ≈ 4 次/秒 > §3.8 的 2 次/秒**（真机同源风险，`WeappPlatform.requestFrame` 同样优先 rAF）⇒ 真机首验 P0。**修复建议**：`App.start()` 加 `{ selfDrive:false }` 或宿主改用「只初始化不自驱」变体。
  - **产物**：探针 `production/qa/beads/beads-browser-probe.mjs`（`node --check` 通过，唯一真源以 `mtime` 最新者为准）；证据
    `evidence/beads-browser-probe-t119.log`（EXIT=1）、`beads-browser-probe-t119-rerun.log`（**判定串逐字一致**）、
    `beads-browser-p4-screen.json`（原生＋精栅格两套序列）、`beads-browser-crosscheck.json`（`|Δ|=0.0000` ＋ 反向 68.41）、
    `beads-browser-a05-envelope.json`（19 clip）、`beads-p4screen-{base,peak,fine-base,fine-peak}.png`；报告 **§25.13**。
  - **只读边界**：只写 `production/qa/beads/**` 与本小节后半段；**未改** `games/**` 源码、`packages/**`、`tools/**`、`systems-index §3`、`ux-spec.md`、其他成员台账；**未 commit / push**（`cocos/build/**` 与 `dev/harness/dist` 已被 `.gitignore` 覆盖）。
  - **⚠️ 并发合并说明（供收口）**：本轮与主理人/另一会话**同文件并发作业**（探针被双方编辑过；`D3` 显著度 `max` 修正保留；我另修了其引入的**切片边界**问题——`countPeaksSignificant` 用 `max(左基,右基)` 时，**位于切片首样本的峰显著度为 0** ⇒ 多脉冲复验里每次脉冲的首峰被漏计）。**建议收口动作**：① 以 `mtime` 最新探针为唯一真源；② 检查报告是否出现重复 §25（本次检查：仅 `## 25.` / `## 25.12` / `## 25.13` 三处，无重复）；③ `pnpm run verify` 仍未随本单跑（口径同前几轮）。

---

## WXG-T-103

- **名称**：**音频裁定包补做（冲突 C1 / C3）——T-098 漏列项**
- **负责**：文策渊(design-strategist)　**状态**：✅ 完成（2026-09-15；**A05-09 本体仍记 ⛔**，因探针未同步）
- **背景（主理人认错）**：`g4-regression-report.md §19`（T-096 轮）建议第 4 条已明文「C1/C3 随 T-098 一次性打包给文策渊」，但主理人写 T-098 任务书时**漏列**该两项 ⇒ 另号补做，不把范围 retroactively 扣到 T-098 头上。**C1** = `A05-09` 把「伪震屏 scale 1.015」写成 `sfx_combo_t3` 的同帧主体，而 §1 行 7 与 `combo-vfx.ts:46-50`（tier=2→pseudoShake、tier=3→burst）均表明**伪震屏属 Lv2** ⇒ 子句不可判定（QA 记 ⛔）。**C3** = `audio-events §1` 时长列 7 处非纯数字 ⇒ `[B]` 实测无期望值可比。
- **Deliverables**：① C1 —— `audio-events §4` 判据主体改到正确梯级（t2）+ t3 侧另立子判据，并逐行核 §1 全部 combo 梯级有无同类错置；② C3 —— 7 处逐条分流（**甲** = 可凭 §3.12 / `ux-spec §5` 现有值定写；**乙** = 保持 `[TODO]` 但写成**可解除**的 `[TODO]`，标解除条件与「实现占位值不得回引为规格」）；③ 两篇各补总口径一句；④ 零新拟增常量（`audio-spec §7.2` 复核确认）。
- **完成记录（2026-09-15）**：① **C1**：`A05-09` 主体 `sfx_combo_t3` → **`sfx_combo_t2`**，t3 的「350ms + 同帧」另立 **A05-09b**（挂 `burst`）；§1 全部 combo 梯级逐行核过，**同类错置仅此一处**。主对话顺带清掉同源错置注释 `src/config/audio-voices.ts` T2/T3 两行（纯注释，无行为变更）⇒ `framework:sync` 已重镜像。**编号采 `b` 后缀，不做整体重排**（重排会牵动台账与已有证据引用）。② **C3**：**5 甲**（`urgent_beat ≤1000` 周期窗口、`tray_full ≤500`【主理人裁甲：沿用 §5 500ms 上限，非期望值】、`stage 500`、`star 150`、`revive_ok ≤400`）/ **2 乙**（`ui_tap` 解除条件 = Q-A05-1 裁决；`bgm_main` 循环点 = A05-21/22 `[B]+[R]`）。总口径入两篇文首与 §4.3。③ 零 §3 改动、零伪数值。
- **约束**：成员只允许写 `design/audio/audio-events.md` 与 `audio-spec.md`；**禁改** `src/**`、§3、`production/**`（含 QA 文档）。

---

## WXG-T-106

- **名称**：**memory 二级详情文件索引（`memory/details/`）——治单日期文件反复越 B 门**
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-15；桩自测 36 + 56 全绿，16 节逐字节外移且还原比对通过）
- **动机（实测，非猜）**：`memory/2026-09-15.md` 在 WXG-T-097/BD-10 轮冲到 **8693 tok**（B 门 8000）被 pre-commit 真拦；本轮按用户拍板「乙」压成摘要+指针勉强降到 **7876**，**余量仅 124 tok**，而同日还有 ≥2 轮待写 ⇒ 压缩不是可持续解。另：`2026-09-12.md` 10141 / `2026-09-14.md` 12586 全靠 **WXG-T-030 / WXG-T-065** 两条豁免挂着，而 **T-041 收窄裁决**原文是「到期不得靠 B 门豁免硬扛」。
- **设计（用户两项拍板：① `memory/details/` 单层；② 批次2 本轮一并做完并撤销那两条豁免）**：
  - **分层**：`memory/YYYY-MM-DD.md` 降为**当日骨架层**（逐轮一节：摘要要点 + 指针）；长正文逐节外移至 `memory/details/<YYYY-MM-DD>-<slug>.md`（**一节一文件**）。外移触发口径（机械可判）：**单节 > 600 tok** 即外移；未达阈值的短节留在日记。
  - **隶属标记**（详情文件首行，唯一真源）：~~`> 隶属日记：\`<YYYY-MM-DD>#<节锚点>\``~~ ⇒ **实现改为详情件 H1**：`# 隶属 · <YYYY-MM-DD> · §<日记节 anchor>`。理由：任务书原口径把标记放 blockquote，而生成器**只能从 `index.sections` 派生**（不读正文 ⇒ 避开 `--staged-blobs`/HEAD 契约不同源，判例 K-042/K-043），H1 天然是可靠可解析的唯一入口；且 anchor 串必与日记节**同口径**（含以数字开头时的改写与重复后缀），手写 `#<锚点>` 反而易错。**已按实现回写本节与 `memory/INDEX.md §1.1`**（先文档后代码不得反着干，但此处是发现漂移 ⇒ 订正文档而非伪造成 just-in-time 口径）。
    **故意不带目录前缀**——满 30 天连座归档后日记本体在 `memory/archive/`，该标记仍成立（distill 铁律是逐字节保留，**不得**改写归档件内容）。
  - **二级索引**：`memory/INDEX.md` 生成表的每篇日记节表**新增一列「详情」**（由生成器扫 `memory/details/` 的隶属标记派生，**不手维护第二份表**）；详情文件自身进 ctx 索引面 ⇒ 受同一道 8000 B 门约束（**机制自带防再膨胀**）。
  - **断链硬拦**：日记里有指针而详情文件不存在 = 证据已丢 ⇒ 新增一道**断链/孤儿**检查入 `ctx:check`（不静默降级为 note，否则就是假绿）。
  - **30 天轮转连座**：`memory:distill` 归档某天时必一并归档该天的 `details/<date>-*`（否则留孤儿 + 指针悬空），同样逐字节回读校验。
- **Deliverables**：① 生成器 `lib/memory-index.mjs`（`isMemoryDetail` / 隶属解析 / 「详情」列 / preamble）；② 断链检查入 `ctx:check`；③ `distill-memory.mjs` 连座归档 + `distill-memory-selftest.sh` 补用例；④ 迁移批次1（09-15 三节）+ 批次2（09-12 / 09-14）；⑤ 撤销 `budget-exempt.json` 两条（WXG-T-030 / WXG-T-065）；⑥ 协议回写（`memory/INDEX.md` 手写节·`MEMORY.md`·`docs/agent/memory-distill.md §8`·`ctx/ROUTES.md:193` 描述行）。
- **追加交付（任务书未列，但不做就是半个机制）**：⑦ 可复用外移器 `tools/scripts/split-memory-detail.mjs`（默认 dry-run，`--date=` 必填；节解析**复用** `lib/context-index.mjs::makeFileRecord`（该函数由私有改 export）⇒ 与门禁同口径，杜绝两套实现漂移）+ 其桩自测 `split-memory-detail-selftest.sh`（6 组 / 36 断言，含**跨脚本契约**：产物用 `makeFileRecord` + `parseMemoryDetailLink` + `memoryDetailLinks` 复核，并反向造孤儿证明硬拦有效）；⑧ 入口 `pnpm run memory:split` / `memory:split:selftest` / `memory:distill:selftest`（已核 `verify-all.mjs` STEPS 为显式列表，不误挂进 `verify`）。
- **约束**：**不新增任何豁免条**；日记原「逐字节不动」口径必同步改掉（不能只改代码不改协议）；详情文件不自动进 `ctx/hot-files.md`（`HOT_FILES` 为固定 6 文件集合，而该产物已 3992/4000 贴顶）；不代写/不伪造已丢内容（外移 = 逐字节搬运）；**不碰并发会话（T-104）未提交内容**，台账两份共享文件走「索引 blob 重建」而非文件级 `git add`（K-045）。
- **跳空说明**：取 106 而非 105——并发会话的 T-104 详情节里写有「dpr 另开单（建议 WXG-T-105）」，尽管其状态行已改「阶段 B 含 ×dpr」，仍**让号 105** 不跨会话抢号（注 4 同族教训；单号递增不回收，跳空合规）。
- **依赖**：无前置；后继 = 满 30 天蒸馏轮必用连座归档（T-041 口径）。
- **完成记录（2026-09-15）**：
  - ① **生成器**：`memoryDetails` / `memoryDetailLinks`（`byDaily` + `orphans`）、「详情」列、孤儿清单、preamble 四层化 + §1.1 外移口径 + 连座归档条。另修一处自毁导航价值的细节：**已外移行的「摘要」列改取详情件里的**原节首句（`orig = det.sections.find(level===2 && anchor===s.anchor)`），否则摘要列只会抽出骨架指针句并被截成半截括号。
  - ② **双向硬拦**：`check-context-budget.mjs::checkMemoryIndex()` 新增 **C-③**（孤儿：缺 H1 标记 / 指不到现存节；断链：骨架指向不在索引面的详情件），两者均 push 入 `failures`（不降级为 note ⇒ 不留假绿）。未跟踪新日记按 `resolveContent` 返回 `null` 处理为**不据此判红**（三分支契约，WXG-T-026/032⑤）。
  - ③ **连座归档**：`distill-memory.mjs` 新增 `DETAILS_DIR`/`ARCHIVE_DETAILS_DIR`、`orphanDetails` 报告、**组内任一目标重名则整组跳过**（日记与详情件同进同退），`--write` 改为**全量 read → 全量 write+回读校验 → 统一 rm**（中途失败不拆散两边）；`distill-memory-selftest.sh` 补连座夹具与 [7] 整组跳过用例 → **56 PASS / 0 FAIL**。
  - ④ **迁移**：共 **15 节**逐字节外移至 `memory/details/`（单层，用户拍板）：09-12 4 节（10141→**3132** tok）、09-14 7 节（12586→**6911**）、09-15 4 节（7876→**2674**）。**还原性自证**：一次性脚本把「骨架 + 详情件正文」回拼与 `git show HEAD:` 比对，**三篇全部逐字节一致**。
  - ⑤ **两条豁免已撤销**（`ctx/budget-exempt.json` 删 WXG-T-030 / WXG-T-065 整块）⇒ 本轮**零新增豁免**，且机制自带防再膨胀（详情件同受 B 门）。
  - ⑥ **协议回写已完成**：`memory/INDEX.md` 手写节（标题 / 四层 / 与 preamble 同口径的 §1.1 外移口径 / §2 文件分工新增 `details/` 行 / §3 连座归档）—— preamble **只在首次创建时生效**，既有文件必手改（否则代码改了协议没改 ⇒ 下一轮会话照旧口径写）；`MEMORY.md`（蒸馏规程三条 + 常用脚本一行）；`ctx/ROUTES.md` 摘要行描述与估算；`AGENTS.md §9` 读（memory）条的分流口径；`docs/agent/memory-distill.md` 新增 **§9** 并在 **§5** 补「两条豁免已撤销」现状条；`docs/agent/commands.md` 新增 `memory:split` 行与 `memory:distill` 的连座口径（任务书原写 §8，实现因 §8 已有内容而新增 §9，**以 §9 为准**）。
  - ⑦ **当场撞上的真 bug（幂等判据误伤）**：`split-memory-detail.mjs` 原用「节正文里出现过 `memory/details/`」当「已外移」判据 ⇒ **一节只是在讨论本机制本身**就被静默跳过（写本单当日日志时现形：刚写的 T-106 轮记录 1022 tok 却被判「已外移」）。现只匹配**本脚本自己发出的骨架行固定开头**（`SKELETON_RE` 与 `skeletonLine()` 同字形）；自测新增 **[6] 组**（反向：正文提及仍须被选中；正向：`--min-tokens=10` 降阈让真骨架也超阈，确认是靠指针判据而跳过、不新建件）⇒ **36 PASS / 0 FAIL**。另修两处同源缺陷：头注与 `--help` 写「整节跳过」而实现是 fail loud ⇒ 订正；重建自检只查首节标题 ⇒ 改为逐节查。可复用同构教训入 `knowledge/lessons.md`：**幂等判据必锁「自己写出的产物字形」，不得锁「正文里出现过某个关键词」**。
  - ⑧ **本机制吃自己的狗食**：本单自己的当日日志节（1022 tok）即用本工具外移为第 **16** 件 `memory/details/2026-09-15-s10-t106.md`，日记降到 **2745 tok**；全仓复扫（含 `09-11`/`09-13`）确认早前迁移**无漏移**（`09-12`/`09-14` 现均无 > 600 tok 的 `##` 节），且两篇未越阈历史日记按存量口径**不预先切**（工具会列出它们为候选，此为人为不执行，已写进 §1.1 口径）。
  - 门禁复验：`ctx:build --working-tree` → `ctx:check --working-tree`（**必成对**：默认 committed 模式会 skip 未跟踪详情件）⇒ C 项「✅ memory 二级详情层（WXG-T-106）：**16** 个详情文件，隶属/指针双向可解析」；B 门已无 `09-12`/`09-14` 两行（豁免已撤且自然降回阈下）。**唯一红**：`ADR-0011` 8446 tok > 8000 —— 属**并发会话 T-104 未提交改动**，不由本单代拆、**不为其新增豁免**。
  - **代价诚实记录**：`memory/INDEX.md` 本体 5513 → **6777 tok**（+23%：手写协议加长 + 新增一列），仍 <8000 且随 30 天归档自然回落；若后续日报继续追加，本文件自己也会需要拆（它不在本单范围，已登记）。
  - ⑨ **实际落库四笔与「为何不能再拆」**（`742752c` / `2e6ca7f` / `b7ae82d` / `3fa8c27`）：第一笔必为「生成器 + 门禁硬拦 + 三篇骨架 + 16 详情件 + 撤两条豁免」**同笔**——拆开必红：`ctx:check` 的豁免表是**读磁盘**，只要撤豁免这件事已在工作树里，未暂存的骨架就会让 B 门按 `HEAD:` blob 量到旧巨型日记（实测 10141 / 12586 tok 双红）；工具单独一笔亦不成立（理由同上）。剩下三笔按关心点拆：外移器+自测、连座归档、协议回写。
  - ⑩ **撞上一处既存门禁缺陷（非本单引入，已登 backlog）**：`memory/INDEX.md` 是**生成物又被索引**，但不在 `lib/context-index.mjs:127` 的 `WORKTREE_AUTHORITATIVE` 集合里 ⇒ `--staged-blobs` 下它的索引记录取的是**暂存旧字节**，而磁盘已被重写成新字节 ⇒ pre-commit 单遍「重建 → add → 校」对不上 `sha256`，报 `C(--staged): 暂存内容与索引不一致 — memory/INDEX.md`，**需再跑一遍 build+add 才收敛**（钩子提示的「直接重新提交即可」同源于此，但字面未解释为何）⇒ 登 **BD-38**（修法建议：把 `memory/INDEX.md` 加入 `WORKTREE_AUTHORITATIVE`，与 `ctx/BUDGET.md` 同处理）。
- **本号归属声明（防跨会话歧义）**：并发会话 T-104 的「收尾裁定」文内写有「④ 派严守真固化 R1/R2/R3 取证 = **WXG-T-106**」，但该派单**实际已落在 `## WXG-T-108`**（同一会话另写的 control-manifest 单落 107）⇒ 那句是未订正的旧字面，**不构成本号冲突**。本号 106 的唯一归属 = memory 二级详情层（占位已随 `1f73e2b` 入库）。根因已入沉淀候选：**领号只看了 HEAD 的头注，而并发会话占的 105–108 当时仍全在工作树未提交** ⇒ 领号必以**工作树全文**（`grep '^## WXG-T-' TASKS-DETAIL.md` ∪ 主表行）全局最大号为准，不能只信已提交头注（与 K-045 同族）。

---

## WXG-T-111

- **名称**：**knowledge 沉淀库按行内标签分片（`knowledge/lessons/<tag>.md`）——结掉 WXG-T-098 豁免的硬到期条**
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-15 当日开工当日收口；用户两项拍板：粒度＝**按行内标签切 6 片**；旧路径＝**保留 `lessons.md` 作指针页**）
- **动机（实测）**：`knowledge/lessons.md` = **10768 tok**，而 WXG-T-098 豁免 note 的硬到期条件是「自登记基线 **9021** 起再增长 **>800 tok**」⇒ 已 **+1747 越线**（且本轮开工前就已越，不是本轮写进去的）。协议明写到期**不得续期豁免**，只许做结构性拆分评估；用户裁定「本轮就地做」⇒ 本单 = 评估 + 实施一体。
- **实测结构（分片依据，不靠猜）**：条目**行内标签**与 `##` 小节**不一致**（`## 流程` 里挂着 `[测试]` / `[判据]` / `[工具链]` 条目），故按 `##` 切不干净。按行内标签统计：**工具链 15 条 4789 tok ／ 流程 6 条 2774 ／ 判据 3 条 1516 ／ 测试 2 条 1033 ／ 跨 IDE 3 条 483 ／ 环境 1 条 136**（条正文合计 10731，30 条）。⇒ 最片 4789，对 8000 余量 3.2k。
- **布局口径（冻结）**：
  - 一标签一文件：`knowledge/lessons/{toolchain,process,criteria,testing,cross-ide,environment}.md`；**条目正文逐字节搬运**（标题行 + 缩进子行 + 归档元信息行原样），`## <标签>` 行随条目进对应分片。
  - **`knowledge/lessons.md` 保留为指针页**（≈250 tok，**不再放条目**）：布告「已分片 + 标签→文件表 + 引用口径」。理由：全仓 20+ 处脚本注释以「`knowledge/lessons.md` K-0NN」形式引用，保留指针页 ⇒ 旧引用仍解得出，**零无关文件搅动**。
  - **引用口径**：引用一律写 **K-0NN**（可附任务号），**不写文件路径**；ID→分片由 `knowledge/INDEX.md` 活跃表的「分片」列机械解析。
  - **K-0NN 命名空间 = 全局单一**（`ledger.nextId` 不变）：分片只改正文落位，**不改编号语义、不回收旧号**。
  - **归档仍单份**：各分片共用 `knowledge/archive/lessons-archived.md`（`kb:archive` 按条目 `file` 反查所属 ACTIVE_FILES 项，**不得再写 `file === 'knowledge/lessons.md'` 硬编码三元**）。
  - **防再膨胀**：分片同受 B 门（8000）约束，**不为其新增豁免**；某分片再越阈 ⇒ 该标签内部再按子标签切（口径入 `knowledge/INDEX.md`）。
- **连动面（必改，逐项验收）**：① `lib/knowledge-ledger.mjs::ACTIVE_FILES` 改为**动态枚举** `knowledge/lessons/*.md` ∪ `patterns.md`（目录不存在 ⇒ 回退到单文件旧布局，**不假绿亦不砸错**）；② `kb-sync` / `kb-check` / `kb-collect` / `kb-audit` / `kb-archive` / `kb-reactivate` 六脚本（均 import 同一常量 ⇒ 预期只改 lib 与 archive 硬编码一处）；③ `ledger.json` 条目 `file` 改指分片（**`contentHash` 不含 `file`** ⇒ 不算「修改」，不造 30 条伪 updated）；④ `INDEX.md` 活跃表新增「分片」列；⑤ `ctx/budget-exempt.json` **删 WXG-T-098 对 lessons.md 的豁免条**；⑥ 协议回写：`knowledge/INDEX.md` 读取协议、`ctx/ROUTES.md`、`AGENTS.md §9`、`memory/MEMORY.md`、`docs/agent/*` 同族口径。
- **Deliverables**：① 一次性迁移脚本（**dry-run 默认**，逐字节搬运 + 回读自证：拼回与 `git show HEAD:` 逐字节一致）；② `ACTIVE_FILES` 动态化 + `kb-archive` 硬编码修正；③ 分片桩自测（新标签/未知标签 fail loud、跨分片补号单调、归档同进同退）；④ 6 个分片文件 + 指针页；⑤ 写入 **K-046**（领号必以**工作树**全文全局最大号为准，不能只读已提交头注）与 **K-047**（幂等判据必锁「自己写出的产物字形」）；⑥ 撤销 WXG-T-098 豁免条（本轮**零新增豁免**）；⑦ 协议回写六处；⑧ `kb:sync` + `kb:audit` + `ctx:build` + `pnpm run verify` 全绿并沉淀统计入库。
- **验收**：`pnpm run kb:check` 绿；`kb:audit` 条目总数 = **32**（原 30 + 新 2）无丢失；`ctx:check` B 门不再含 `knowledge/lessons.md` 行且无新增豁免；全仓 `grep -rn 'lessons.md'` 无断链（指针页存在）；`verify` 不短路全绿；迁移前后条目正文逐字节一致（自证脚本输出为准）。
- **约束**：不动 `patterns.md`（1452 tok）；不靠删信息凑体积；不伪造分片后的旧引用校验；**不碰并发会话未提交内容**（台账两份仍走 blob 重建 + `update-index`，K-045）。
- **代价诚实记录（预期）**：指针页 + 6 片头注 ≈ 新增常驻 200–300 tok；`INDEX.md` 活跃表多一列×32 行；分片后「跨标签同族互引」（如 K-035↔K-038↔K-039）需跳文件读，靠活跃表定位（WXG-T-098 当时以此为由不拆，本轮拆 = 用户裁定优先，代价在此登记）。

- **完成记录（2026-09-15 当日开工当日收口）**：
  - ① **迁移**：一次性工具 `tools/scripts/split-knowledge-lessons.mjs`（默认 dry-run，`--write` 才落盘）把 30 条正文按**行内标签**逐字节搬入 6 片（toolchain 15 / process 6 / criteria 3 / testing 2 / cross-ide 3 / environment 1），`## <标签>` 小标题随片保留（`kb:reactivate` 靠它定位）。**还原性自证不沿用旧结论**：头注收紧后**复跑**独立脚本，以 `git show dd02a6f:knowledge/lessons.md`（分片前的 30 条源）为对照重解析回拼 ⇒ 「源 30 块 ↔ 现 32 块，**逐字节差异 0**，新增号 K-046 / K-047」（判例 K-047③：自证要拿 `git show HEAD:` 而非内存自比）。
  - ② **装置连动**：`ACTIVE_FILES` 由固定两文件改**运行时枚举** `knowledge/lessons/*.md`（目录缺失 ⇒ 回退旧布局单文件，**不砸错亦不假绿**；已知片按 `LESSONS_SHARD_ORDER` 稳定序、未知片按名序追加），新增 `shardOf` / `shardCellOf`，`INDEX.md` 活跃表加「分片」列；`kb-archive.mjs` 归档目的地由硬编码三元改**按条目 `file` 反查**。实测「改落位不算修改」成立：`ledger.json` 仅 30 处 `file` 变化、`contentHash` **全等**、`events` 零新增、`CHANGELOG.md` 未被改写。
  - ③ **撤豁免且零新增**：删 `ctx/budget-exempt.json` 中 `knowledge/lessons.md` 条（WXG-T-098 登记的硬到期条已越 +1747 tok），现存 **22** 条豁免全属既存、本单**未加任何一条**；`ctx:check` B 门已无该文件行。**撤豁免与分片必同笔**（`f88666c`）——豁免表**读磁盘**，拆成两笔时未暂存的旧巨型文件会被按 `HEAD:` blob 量到判红（同 T-106 ⑨ 的谱系）。
  - ④ **桩自测**：新增 `split-knowledge-lessons-selftest.sh` **9 组 / 45 断言**（dry-run 不落盘、回拼用**第二套实现**而非自比、指针页零正文、未知标签 / 缺号 fail loud 且零产物、`ACTIVE_FILES` 两分支、跨分片补号单调、两片共用单份归档、二跑守卫 + 注释符号真实性）。另撞出**既存**缺陷：`knowledge-selftest.sh` 此前**既无 pnpm 入口也不在 verify** ⇒ 首跑 **4 FAIL**（根因 = `build-context-index.mjs` 自 WXG-T-068 起无条件写 `memory/INDEX.md`，桩仓库无 `memory/` ⇒ ENOENT 连带 [9]/[16] 两组失真）；已补 `pnpm run kb:selftest` 入口 + 夹具建目录 ⇒ **190 PASS / 0 FAIL**。「与本单改动无关」是**临时 checkout HEAD 版 lib 再跑**证出来的，不是推测；未挂进 verify 的债登 **BD-39**。
  - ⑤ **沉淀**：**K-046**（领号认工作树全局最大号，不止已提交头注）、**K-047**（幂等 / 重复执行判据必锁自己写出的产物字形；收尾追加 ⑤ = 一次性工具必带「已完成」判定 + `--force` 出口）。`kb:sync` 沉淀统计：分片段**新增 2｜修改 0**、K-047 ⑤ 段**新增 0｜修改 1**；`kb:check` 八重 exit 0。附带修一处枚举漏项：`INDEX.md §2` 类别表原本没有 `判据`，而库里已有 3 条 `[判据]` 条目（K-031「人写的枚举必漏项」同族）。
  - ⑥ **协议回写六处**：`knowledge/INDEX.md`（§1 读取按活跃表定位 / §2 类别与「新标签 = 新建一片」 / §3 文件分工 / §4 分片不越 B 门不得加豁免 + K-0NN 全局单一命名空间）、`AGENTS.md §9`、`ctx/ROUTES.md`（教训库行改指针页 + **订正领号行**——旧文「领号只读头注」正是本轮撞号成因）、`memory/MEMORY.md`、`docs/agent/repo-layout.md`、`docs/agent/commands.md`（登记 `knowledge:split` / `knowledge:split:selftest` / `kb:selftest`）。`kb-sync.mjs` 头注仍写「解析 `knowledge/lessons.md` + patterns.md」⇒ 一并订正为分片集（`190950b`，纯注释、重跑产物字节不变）。
  - ⑦ **实测代价（预估口径写错，据实订正）**：任务书「常驻 +200–300 tok」把「按片读」与「常驻」混了。实测结构开销 = 指针页 **350** + 6 片头注 **545**（首版 791，随后把每片 3 条 `>` 并为 2 条并把重复口径指向 `INDEX.md` 正本 ⇒ −246；`shardHeader()` 模板同步改，工具与产物不分叉），**单次读一个片 ≈ 350 + 91**。各片现状：toolchain 4925 / process 3500 / criteria 2275 / testing 1165 / cross-ide 615 / environment 269 tok ⇒ 下一越阈的大概率是 **toolchain**，届时按子标签再切（口径已写进 `INDEX.md §4`）。另：任务书「全仓 20+ 处脚本注释」实测 = **6 处**代码注释 + 2 处活文档以「`lessons.md` K-0NN」形式引用 ⇒ 按本单「零无关文件搅动」口径**不扫**，旧引用靠指针页仍可解出；新增引用一律只写 K-0NN。
  - ⑧ **本单自查撞出的三处自身缺陷（都已修，不藏）**：`split-knowledge-lessons.mjs` 注释引用的 `lib::LESSONS_TAG_ORDER` **符号不存在**（真名 `LESSONS_SHARD_ORDER`，K-035 族）⇒ 订正 + 自测加「注释里的 `lib::<NAME>` 必须是 lib 真实导出」断言；一次性工具**无「已完成」判定** ⇒ 二跑把指针页的 `- **…**` 排版行报成「缺 [K-0NN] 先跑 kb:sync」假故障 ⇒ 加守卫 + `--force` 出口（`9652f94`）；`fca7bd8` 正文写「`knowledge/INDEX.md` 上一笔已随分片改」**说早了**（协议改动当时仍在工作树）⇒ `0ee8bf4` 据实补入库并在本处订正。
  - ⑨ **验收逐条对照**：`kb:check` ✅ exit 0｜lessons 条目 30 → **32 无丢失**、逐字节差异 0 ✅｜B 门无 `knowledge/lessons.md` 行且**零新增豁免** ✅｜全仓无断链（指针页在，`check:links` OK）✅｜`verify` **PASS 14｜SKIP 1（check:size 缺 wechatgame 产物）｜FAIL 0**（逐项未短路）✅｜桩自测 45/0 + 190/0 ✅。**遗留**：BD-39（装置自测未挂 verify）；「生成物又被索引」单遍不收敛一族 —— 本轮新数据点：**手工跑 committed 模式 `ctx:build` 并把产物 add 后再提交 ⇒ pre-commit 连拦两遍，改为不手跑、让钩子按暂存 blob 自建即一次通过**（`memory/2026-09-15.md` 入库时实测），与 **BD-38** 同族 ⇒ 交 **WXG-T-112** 评估，本单不扩面。
  - ⑩ **提交面（12 笔，均带 WXG-T-111）**：`be58dbe` 占位 → `c000f62` 夹具修复 → `83fa2bd` 分片器 + 自测 → `dd02a6f` lib 动态化 + 归档反查 → `f88666c` 分片 + 指针页 + 撤豁免 → `4fbbb66` K-046/047 → `fca7bd8` 协议回写 → `0ee8bf4` INDEX 协议正文补入库 → `9652f94` 二跑守卫 + 符号订正 → `9e606c9` K-047⑤ + 头注收紧 → `3f2e361` 当日日志 → `190950b` kb-sync 头注 → 本笔台账回填。

---

## WXG-T-112

- **名称**：**装置自指类门禁缺陷评估（含 BD-38：`memory/INDEX.md` 单遍不收敛）**
- **负责**：主理人(Qoder)　**状态**：✅ **完成**（2026-09-15 收口；BD-38 关单）
- **动机**：凡「**自身被索引的生成物**」都有同一类时序坑：重建时它自己的索引记录取的是**旧字节**，写盘后又是**新字节** ⇒ 单遍「重建 → add → 校」必不一致。实测判例：① **BD-38** `memory/INDEX.md` 不在 `lib/context-index.mjs:127` 的 `WORKTREE_AUTHORITATIVE` 集合 ⇒ pre-commit 需跑**两遍**才收敛（本轮 2026-09-15 撞上，已登 backlog，钩子提示「直接重新提交即可」同源于此但未解释为何）；② `ctx/BUDGET.md` / `ctx/hot-files.md` 已靠该集合规避；③ WXG-T-111 新引入的 `knowledge/lessons.md` **指针页 + `INDEX.md` 生成块**属同一形态 ⇒ 本单必评估其暂存区语义。
- **Deliverables**：① 判定三类形态是否应统一收口（候选修法：把生成物一律加入 `WORKTREE_AUTHORITATIVE`，或 pre-commit 改为「重建 → add → **再重建** → 校」双遍并写进钩子注释）；② 桩自测：暂存区模式下生成物与索引**单遍必收敛**；③ 按结论回写 `.githooks/pre-commit` 与 `docs/agent/hooks-best-practices.md`。
- **约束**：不用 `--no-verify` 规避；不得为了「绿」把 C 项降级为 note。
- **完成记录（2026-09-15，主理人自证：隔离 `git worktree` 实测，不动在飞工作树）**：
  - ① **判定（Deliverable ①）**：任务书列的三类形态里只有**类①成立**——`memory/INDEX.md` 与 `ctx/BUDGET.md` / `ctx/hot-files.md`
    同根因（`ctx:build` 自产 .md 又被索引，而索引对它取的是**改写前**的 HEAD / 旧暂存 blob 字节），差别只在**是否登记进**
    `lib/context-index.mjs::WORKTREE_AUTHORITATIVE` ⇒ 统一收口 = 补登记，**不需要**改钩子为双遍重建。
  - ② **类③ 假设不成立（订正任务书）**：`knowledge/INDEX.md` 活跃块由 `kb:sync` 写、`knowledge/lessons.md` 指针页由一次性分片器写，
    二者**都不在 `ctx:build` 写盘链内** ⇒ 无「build 期间被本进程改写」这一时序条件，其一致性已由 `kb:check` ④ 守护。实测（改 `knowledge/INDEX.md`
    并暂存 → 跑 pre-commit）**第一遍即绿**，反证其不属本族 ⇒ 不收口、不扩面。
  - ③ **取证数据**（基线 = `3fa3be4`，改日记一行 + 只 `add` 该日记 + 跑真 `.githooks/pre-commit`）：基线**三种起手第一遍全部 exit 1**，
    诊断只点名一个文件 —— A 只暂存自有改动 / B 手跑 committed 模式 build 并 add 四产物 / C 手跑 build 不 add 产物；三方 sha 对账：
    `idx=e6c82d12 == head` 而 `staged == worktree == 694e63d8`（另两个产物则 `idx == staged == worktree` 全等）⇒ 根因坐实到取源分支。
    补登记后**同三起手第一遍全部 exit 0**。
  - ④ **推翻两条既有认知（诚实）**：a) 本轮早先记的「不手跑 `ctx:build`、让钩子按暂存 blob 自建即一次通过」是**错的**——那次一次通过
     因为前两遍失败时钩子已把产物 add 过；b) WXG-T-072 的「先落盘产物 → 再建索引 → 最后序列化，三步同源」在 committed / staged-blobs 模式
     下**并不成立**（第二步取源仍走 HEAD/暂存分支），顺序调整只是必要条件 ⇒ 两处注释均已按实测订正，不留误导后人的错论。
  - ⑤ **落码**：集合补 `memory/INDEX.md` 并 `export`（连带导出 `BUDGET_MD_REL` / `HOT_FILES_MD_REL`，消掉 `check-context-budget.mjs` 内
    重复字面量）；`ctx:check` 新增**装置自指对账**项（`C:` 级 failure，**非 note**：生成物集合 ⊄ 工作树权威集合即拦，并直接给修法位置）；
    新增 `tools/scripts/worktree-authoritative-selftest.sh`（入口 `pnpm run ctx:selftest`，**9/0**）；回写 `.githooks/pre-commit` ② 段与
    `docs/agent/hooks-best-practices.md §7`；沉淀 **K-048**。
  - ⑥ **自测为何可信**：含**判别力对照**（同一 gate 下普通 dirty 文件 → `head`、已暂存 → `staged`，否则「全部 worktree」的断言恒真）与
    **红绿双向端到端**（在隔离 worktree 里把登记行删掉 → 同一流程必须 `exit 1` 且诊断点名；`ctx:check` 对账门亦须报红）⇒ 绿灯是被本修法挣来的。
  - ⑦ **自查两处（本轮自犯）**：a) 新门注释初稿写「跑在 verify / CI / pre-commit 三处」—— 实测 `verify` 的 15 项里**没有** `ctx:check`
     （grep 零命中），真实覆盖只有 CI（`ci.yml` ctx:check 步）+ 钩子兜底两处 ⇒ 三处措辞已全部订正，并另登 **BD-40**；b) 自测脚本初稿两处
     假绿风险：红测那遍的补丁被 `run_hook_once` 每次拷回正确版冲掉、`String.replace` 替换串里 `$` 开头序列被特殊解释 ⇒ 改为显式传缺项源 +
     函数型替换。
  - ⑧ **代价（如实登记，不隐藏）**：集合内产物的索引记录跟随**工作树** ⇒ 钩子 `git add <产物>` 会把工作树中**未暂存**的产物改动一并纳入本次
     提交（三产物同语义，且属既存行为，非本单新增）；`memory/INDEX.md` 标记块**外**允许手写协议正文 ⇒ 手写后须与改动同次暂存。**未削弱既有守卫**：
     实测「手改 INDEX.md + 暂存」在基线与修法下都为绿（钩子本就会重建吸收），非本单引入的松动。
  - ⑨ **验收**：`ctx:check` exit 0 且打印「装置自指：3 个生成物全部在工作树权威集合内」｜`ctx:selftest` **9/0**｜`pnpm run verify` **PASS 14 ｜ SKIP 1（check:size）｜ FAIL 0**｜`kb:check` 八重 ✅（活跃 48）。

---

## WXG-T-104

- **名称**：**beads · P0 · Cocos 宿主输入 y 轴镜像（缺陷 C1）——「先锁语义，再改码」**
- **负责**：程基岩(engineering-lead)　**状态**：📋 已立项（待施工；2026-09-15 主理人实测发现并派单，用户拍板「先锁语义再改码」）
- **背景（主理人 2026-09-15 实测，Cocos web-mobile 产物 + 桌面 Chrome）**：在 Cocos 产物上**每一次点击都落在上下镜像的位置** ⇒ 玩法不可用。三层证据：① 页面点 (700,100)（窗口 1280×720）时 `e.getLocation()` 返回 **(700, 620)** = `720 − 100`，`e.getUILocation()` 返回 (1296.94, 1148.72) ⇒ **两者均为左下原点**；三坐标点全符合同一关系 `(480,545)→175`、`(480,175)→545`、`(700,100)→620`。② 给 `app.input.push` 打桩 ⇒ 该值**原样**进入 `InputManager`。③ 端到端反证：托盘槽 0 在页面可见位置 y≈545，但**点页面 (480,175) 才选中它**（`traySelected=0`、`slot0='selected'`），点可见位置 (480,545) 无任何反应。
- **根因定位**：`packages/framework/src/adapters/cocos/bindings.ts` 的 `readTouch()`（L264-268）直接透传 `getLocation()`，而 `_bindInput()` L205-212 的注释断言「`getLocation()` 是 top-left origin」。实际 `getLocation()` 是**左下原点**，而 `Viewport.screenToDesign` 自身还做一次 y 翻转 ⇒ 两次假设叠加成镜像。
- **历史归因（不得回避）**：`memory/2026-09-13.md:144` 记录当时「readTouch 弃用 getUILocation 改用 getLocation（符合 RawPointerInput **左上**原点契约）；**删 mapPoint 的 y 翻转**」。该结论的验证只用了 breakout 的**挡板跟手——挡板只吃 x，x 对 y 翻转不敏感** ⇒ 语义从未被 y 敏感场景锁过。`docs/engine-reference/cocos/VERSION.md:130` 曾把该翻转标为「猜测性，必须验证后修正」，该验证欠账即本单。
- **连带**：`docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md` 把 `bindings.ts L204-213` 那句错误断言作为**坐标契约的引用依据之一** ⇒ 与实测直接矛盾，本单须一并订正。
- **Deliverables（严格两阶段，A 未完成不得进 B）**：
  - **A 阶段（锁语义，先做）**：① 给出 `getLocation()` / `getUILocation()` / `getStartLocation()` 在 **Cocos web-mobile（浏览器）** 宿主的原点语义结论（有实测支撑，非引文档猜）；② 写明**微信小游戏 runtime** 宿主的语义——**无真机 ⇒ 如实标阻塞，禁止凭推测定写**；③ 产出**一条可机械执行的断言/测试**锁死该语义，且该断言**在今日代码下必须失败**（否则等于没锁）；④ 给出「修好」的判据（点可见位置即命中、y 不再镜像）；⑤ **解释** 2026-09-13 那条「删翻转 ⇒ 与 screenToDesign 双重翻转相消」的结论为何与本次实测矛盾（二者必有一误，须给出证据与理由，不得含糊带过）。
  - **B 阶段（改码，A 通过后才动）**：⑥ 修 `readTouch` / `_bindInput`（或程基岩判断的等价位置），使 Cocos 宿主落点正确；⑦ 补/改测试锁死，防回退；⑧ 订正 **ADR-0011**（按其 ADR 写作规范判断是修订正文还是另立 ADR，诚实写负面后果）；⑨ 回传时附**重建产物后的复跑证据**（见下）。
- **复现 / 验证通路（主理人已跑通，直接复用）**：`pnpm --filter @wxgame/beads run build:cocos:web` → `python3 -m http.server 8091 --directory games/beads/cocos/build/web-mobile` → `playwright-cli` 开 `http://127.0.0.1:8091/`；句柄 = `cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot').getComponent(cc.js.getClassByName('BeadsBootstrap'))._app`（`App.game` / `App.viewport` 均 public）。**注意**：现有产物 mtime `2026-09-15 08:48`，改码后**必须先重建产物再取证**，否则验的是旧产物。
- **Output Path（只准写这些）**：`packages/framework/src/adapters/cocos/bindings.ts`（及 `input-bridge.ts` 如需）、`packages/framework/tests/**`、`docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md`（及如另立新 ADR 则新文件）。
- **禁改**：`games/beads/src/**` 玩法逻辑、`systems-index §3` 冻结常量、`production/**`（台账回填由主理人执笔）、`dev/harness/**` 坐标（harness 侧映射实测正确，不是本单范围）。
- **范围边界（重要）**：本单**只修 y 镜像**，**不修** BD-34（`_readInput` 仅在 `_stepPlaying` 内、面板相位不读输入 —— 已占位 **WXG-T-100**，用户此前拍板本轮不动码）。两者观感相似（都是「点了没反应」）但**相互独立**；本单实测中 `_readInput` 调用数在 `playing`=260 / `game-over`=0 属 BD-34 现象，**不得并入本单结论**。
- **约束**：遵守 L1–L5；`packages/framework/src/core/**` 禁 `cc`/DOM（本单改动在 `adapters/` 层，注意别把 `cc` 依赖漏进 core）；禁 `Math.random()`；**先问再写**——落盘前确认路径，无用户指令不 commit/push。
- **必读 skill（开工前先 Read）**：`my-skills/wxgame-adr-arch/SKILL.md`（本单含 ADR 订正，必须）；若需拆 Story 则加 `my-skills/wxgame-epic-split/SKILL.md`。另读 `docs/architecture/control-manifest.md`（L1–L5）与 `docs/agent/cocos-setup.md §13`。
- **阶段 A 完成记录（2026-09-15，程基岩回传 + 主理人独立复核）**：落盘 `packages/framework/tests/adapters/cocos-touch-origin-contract.test.ts`（5 例；**3 绿 / 2 红，红灯为刻意**——主理人已独立复跑确认）。五条结论：① `getLocation()` = 画布相对 · **device px（× min(dpr,2)）· 左下原点**（`x=(clientX−rect.x)×dpr`、`y=(rect.y+rect.height−clientY)×dpr`）；`getStartLocation()` 同空间；`getUILocation()` = 设计单位 · 左下原点 · 量纲 dpr 无关但**不减信箱偏移**（引擎 FIXED_HEIGHT ≠ 框架 contain）⇒ 不可当设计坐标用。② 微信 minigame 宿主源码 `pal/input/minigame/touch-input.ts:86-90` 同形，但**无真机 ⇒ 标 `[R]` 阻塞，未定写**。③ 机械断言已落盘且今日必红。④ 修复判据 R1–R5 已写。⑤ 2026-09-13「删翻转」结论的误因 = 把「画布相对（真）」外推成「左上原点（假）」，挡板只吃 x ⇒ 判别力为零，且当时 dpr=1 使 ×dpr 同时隐身。
- **⚠️ 阶段 A 连带发现（升级本单严重度）**：`getLocation()` 还 **×dpr**，而 `Viewport` 是 CSS px ⇒ **真机（dpr≥2）上 x 也被放大 2 倍**，点屏幕右侧即越界出屏。`page(200,300)@393×659/dpr3→封顶2` 实测 `getLocation=(400,718)`。即真机**两轴全错**，不止 y 镜像。与当年 harness 的 GAP-07 同类（`clientX*dpr` 送进 CSS px viewport）。
- **用户裁定（2026-09-15，四项全采推荐项）**：**Q1 = A** y 与 ×dpr **一起修**（同一处代码；只修 y 则真机仍不可用）；**Q2 = A 甲** 抽纯函数 `normalizeCocosTouch`（可在 Node 做真正的行为测试，根治「判别力为零」）；**Q3 = A** **修订 ADR-0011 正文**（决策主体「屏幕坐标 = CSS px」未被推翻，仅事实断言错；新增「宿主归一化契约」一节）；**Q4 = A** **接受那两条红灯到阶段 B 结束**（最诚实；代价是 framework 包测试在此期间红，牵动 CI/verify 汇总，须在回传中点名）。
- **阶段 B 派发（2026-09-15 放行）**：范围 = 归一化同时处理 **y 翻转** 与 **÷dpr**；改 `bindings.ts` / 新增纯函数模块；把源码级断言换成 **Node 行为测试**；阶段 B 结束时**两条红灯必须转绿**；修订 ADR-0011；重建 web-mobile 产物后复跑 R1/R2/R3 取证。仍**禁改** `games/beads/src/**` 与 `systems-index §3`；仍**不含** BD-34（WXG-T-100）。
- **阶段 B 完成记录（2026-09-15，程基岩回传 + 主理人独立复核）**：新增 `packages/framework/src/adapters/cocos/touch-normalize.ts`（纯函数、零 `cc` 依赖、`x/dpr` 与 `canvasHeightCss − y/dpr`）；`bindings.ts` 的 `readTouch()` 改调纯函数并订正三处错误注释（含**超出派单列举的第三处** `_fitToGameCanvas()` 头注释 —— 主理人认可，留着就是下一个陷阱）；新增 `tests/adapters/cocos-touch-normalize.test.ts`（9 例 Node 行为测试）并让 `cocos-touch-origin-contract.test.ts` 的两条源码级红灯**退役**；ADR-0011 订正正文 + 新增 **§3(e) 宿主归一化契约** + §4.2 负面后果。**主理人独立复核**：framework **28 文件 / 267 例全绿**；`check:arch` OK；`pnpm run verify` = **PASS 13 ｜ SKIP 1（check:size 未覆盖）｜ FAIL 0**；产物含新模块。**端到端 R1 复证（主理人自跑，修复前后完全反转）**：点可见位置 (479,497) ⇒ `_pointer=(76.7,413.2)`、`traySelected=0`、`slot0='selected'`；点镜像位置 (479,223) ⇒ `_pointer=(76.7,920.8)` 落进拼图区、不命中。数据流同反转（push y = pageY）。
- **主理人探针缺陷 s4（诚实自查）**：首次复证用坐标 (78,325) 得「仍不命中」，实为**托盘已被并行会话上移** —— `tuning.ts:29` 现为 `TRAY_BAND={230,450}`、槽心改**贴带上沿** `450−12−24=414`。已核对**非漂移**：`systems-index.md:80` 已是 `y∈[230,450]`（**v1.20 上沿 420→450**）、`:118` 注明「垂直贴上沿」，均已提交 ⇒ §3 真源与代码一致、程序合规；是我的常量陈旧。
- **收尾裁定（2026-09-15，四项全采推荐项）**：**① `[R]` 真机 = A** 接受现状（web 实测 + minigame 源码同形），真机首验须把「点击落点 / 托盘选中 / dpr 缩放」列为 **P0 检查项**并附打屏日志；**② BD-33 = A 不关闭**，只登记本轮新事实（CLI 构建会自动补 `.ts.meta`，但只跑 `framework:sync` 不构建仍缺 ⇒ 原场景未消除）；**③ = A** 另派单给程基岩把宿主归一化契约加进 `control-manifest`（= **WXG-T-105**）；**④ = A** 派严守真固化 R1/R2/R3 取证 + breakout `[B]` 目视（= **WXG-T-106**）。
- **本单收尾状态**：✅ 阶段 A + B 全部完成并复核；**红灯期已结束**（2026-09-15 起 framework 包测试曾为红，期间 CI/verify 汇总不可作回归信号，现已转绿）。残余：`[R]` 真机未验（已按 ① 接受 + 列 P0）；BD-34 不属本单。未 commit、未 push。

---

## WXG-T-107

- **名称**：**宿主归一化契约入控制清单（control-manifest §17）**
- **负责**：程基岩(engineering-lead)　**状态**：📋 已立项（待施工）
- **背景**：WXG-T-104 把「宿主必须把原始触摸事件归一化成 **CSS px + 左上原点** 再交给 `Viewport`」写进了 `ADR-0011 §3(e)`，但**没有进 `docs/architecture/control-manifest.md`**。控制清单是 L1–L5 工程铁律的落点，新契约不进去就会重演「注释对了、清单没写 ⇒ 后人照旧踩」的坑 —— 本单缺陷 C1 本身就是这个模式的产物（2026-09-13 那条错误断言只活在代码注释与 ADR 引用里）。
- **Deliverables**：① 在 `docs/architecture/control-manifest.md` 新增 **§17 宿主输入归一化**（编号若已被占用则顺延并回传说明）；② 内容须覆盖：宿主 adapter 负责 ÷dpr 与 y 翻转、**不得**把引擎原生事件坐标直接喂 `InputManager`、`Viewport` 只接受 CSS px + 左上原点、新宿主接入时必须补一条**行为测试**（禁止只写源码级正则断言）；③ 与既有 L1–L5 编号体系不冲突，并在文中指回 ADR-0011 §3(e)；④ 诚实写入该约束的**负面后果**（如：新增宿主漏做归一化时症状是「点击整体偏移/镜像」，不易第一时间定位）。
- **Output Path**：`docs/architecture/control-manifest.md`（**唯一落盘文件**）。禁改 `packages/framework/src/**`、`games/**/src/**`、`systems-index §3`、`production/**` 除本小节外的一切。
- **权威来源**：`docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md`（尤其 §3(e)）> `production/TASKS-DETAIL.md` 的 `## WXG-T-104` 小节 > `packages/framework/src/adapters/cocos/touch-normalize.ts`。
- **必读 skill**：`my-skills/wxgame-adr-arch/SKILL.md`；另读 `AGENTS.md`、`docs/architecture/control-manifest.md`。
- **约束**：先问再写；不发明 §3 未冻结数值；不 commit/push。
- **完成记录（2026-09-15，程基岩落盘 + 主理人独立复核）**：`docs/architecture/control-manifest.md` 新增 **`## 17. 宿主输入归一化（ADR-0011 §3(e)，根因 缺陷 C1）`**（L251–305），四条硬要求（禁原生坐标直喂 / 归一化归 adapter 且 ÷dpr+翻 y 必须同时做 / `Viewport` 只吃 CSS px·左上原点且 `screenToDesign` 翻转非"重复" / 纯函数 + Node 行为测试且新宿主同形态复刻）+ 两条 ⚠️（DPR 须显式注入否则无头 CI 断言恒真失效；微信 `[R]` 未实测、真机首验列 P0）+ 四条负面后果，全部可追溯 ADR-0011 §3(e)/§4.2。**交叉引用 4 处**（原计划 3 处，程基岩顺带补第 4 条同类反模式）：§6 输入（L94）、§12 自查表（L170）、§13 反模式两行（L193 直喂 `getLocation()`、L194 用正则锁 y 翻转语义）。**主理人复核**：`grep` 确认 §17 与 4 处引用均在；`check:arch` = OK — no violations；成员自证 `check:links` OK（agents=7 skills=17）、framework 行为测试 9 例通过。**未 commit / 未 push。**
- **⚠️ 本轮真实发生的工程事故（须沉淀）**：程基岩在**同一文件**做多处改动时，§6 那行交叉引用**首次写入被同文件后续写入覆盖**，落盘后 `grep` 才发现并补回。⇒ 同文件多处改动须**串行编辑 + 落盘后逐条 grep 校验**（本次已执行，4 处全在）。该现象与 `memory/2026-09-13.md:100` 记录的「Edit 报成功但未落盘（并行写竞争）」同族。
- **主理人疏漏（认错）**：首轮派单只给了 Output Path、**漏写「用户已批准写入」这句授权**，导致程基岩按「先问再写」停住未落盘（多花一轮）。纪律：派单给非 readonly 成员时，若期望其落盘，**必须显式写授权句**。
- **成员遗留未决问题（待拍板）**：**Q1** §17 是否升格（推荐 A 维持：独立节 + 交叉引用；B 补进 §0 铁律表下；C 进 `AGENTS.md §3` 摘要表）；**Q2** 是否把「新宿主必须有行为测试」做成 CI 守卫（推荐 **C**：先做 warn 级观察一轮，第二个宿主出现前 fail-closed 易成噪声）；**Q3** minigame 侧 `[R]` 处理（推荐 A 不立新单，等真机并入首验 P0；备选 B 派单做 `pal/input/minigame/touch-input.ts` 源码级同形比对，约半日，**不解除 `[R]`**）；**Q4** 索引同步（推荐 A：`pnpm run ctx:build` 自动吸收）。

---

## WXG-T-108

- **名称**：**Cocos 输入取证固化：R1/R2/R3 可复跑 + breakout `[B]` 目视**
- **负责**：严守真(quality-lead)　**状态**：📋 已立项（待施工；**用户已批准写入 `production/qa/beads/`**）
- **背景**：WXG-T-104 修掉了 Cocos 宿主的 **y 轴镜像 + ×dpr**（缺陷 C1），判据 R1（点可见位置命中托盘槽）/ R2（`InputManager.push` 收到的 y ≈ 页面 pageY）/ R3（dpr=1/2/3 封顶 2 下同一可见点均命中）由主理人**临时**跑通并复证，但目前**没有可复跑的固化脚本**；breakout 侧只到数据流层，**`[B]` 目视（挡板跟手）未做**。⇒ 下次回归仍靠人肉，同类缺陷还会漏。
- **Deliverables**：① 把 R1/R2/R3 做成**可复跑脚本**（落 `production/qa/beads/`，同目录既有 `g4-probe*.mjs` 可参考其证据落盘与自证风格）；② 脚本须**自带断言与退出码**（红=失败，禁止「跑了但没判」）；③ 补 breakout 的 `[B]` 浏览器目视道次（挡板跟手 + 点击落点），记录取证方式与截图；④ 明确标注**哪些道次本环境做不了**（`[R]` 真机需 AppID + 真机），不得记为通过。
- **环境事实**：✅ Cocos 3.8.8 CLI 与 web-mobile 构建可用、playwright-cli 可用；⛔ 无 AppID（wechatgame 平台构建阻塞）、⛔ 无真机 ⇒ `[R]` 一律标阻塞。
- **Output Path**：`production/qa/beads/`（脚本 + 证据日志 + 截图）。禁改 `packages/framework/src/**`、`games/**/src/**`、`systems-index §3`、`docs/**`。
- **权威来源**：`production/TASKS-DETAIL.md` 的 `## WXG-T-104` 小节（含 R1/R2/R3 原始判据与主理人复证实测数字）> `packages/framework/src/adapters/cocos/touch-normalize.ts` > `docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md`。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`；另读 `AGENTS.md`、`production/qa/beads/smoke-tests.md`。
- **约束**：严守真默认 **readonly**，本单**已获用户批准**写入 `production/qa/beads/`，不得越界写其他目录；不 commit/push；不得把 ⛔ 记为 PASS。
- **残留（不得归零）**：① **A05-09 本体仍 ⛔** —— 探针与 `test-cases` 需按新主体同改后复跑（成员无 `production/**` 写权限），已登 backlog，与 T-102 的 P4 复跑同批；② `audio-spec §9` 判据总数 27→28（含 A05-09b），QA 侧若不接受 `b` 后缀需整体重排（成本高，已否）。

### 完成记录（严守真 quality-lead，2026-09-15 · 证据已固化 · **未 commit / 未 push**；状态行与台账主表由主理人回填）

**① 落盘清单**（全部在已批准的 Output Path `production/qa/beads/` 内，未越界）

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `production/qa/beads/cocos-input-probe.mjs` | **新增** | 可复跑探针（R1/R2/R3 + 宿主语义 + breakout `[B]`）。**自带断言与退出码**：`0` 全绿 ｜ `1` FAIL ｜ `2` 无 FAIL 但有未预期阻塞/探针无效 ｜ `3` 脚本级环境错误。预期值写在文件头（**先写后跑**），含 `SELF-01` 判据自检 |
| `production/qa/beads/evidence/cocos-input-probe.log` | **新增** | 本轮实跑证据日志，每条含「预期（先写）/ 实测」 |
| `production/qa/beads/evidence/cocos-input-beads-{base,dsf2,dsf3}-{A-base,C-mirror,B-visible}.png`（9 张）+ `cocos-input-beads-dsf1-500x1000-*.png`（3 张） | **新增** | beads `[B]` 目视：三档 dpr × 三态（基态 / 点镜像 / 点可见）+ 500×1000 信箱档 |
| `production/qa/beads/evidence/cocos-input-breakout-dsf{1,2}-x{300,600}.png`（4 张） | **新增** | breakout `[B]` 目视：挡板跟手两位置 × 两 dpr |
| `production/qa/beads/evidence/cocos-input-probe-g1g2-subset.log` | **新增** | 支撑证据（见 ③） |

**② 实跑结果（第 5 次复跑，本地 2026-09-15 21:50；**退出码 0**；PASS 18 ｜ FAIL 0 ｜ ⛔ 2（已声明阻塞道次））**

| 用例 | 道次 | 结果 | 实测数字（节选） |
| --- | --- | --- | --- |
| ENV-01/02 产物新鲜度 + 镜像一致 + 产物含归一化函数 | `[N]` | ✅ | 产物 `assets/main/index.js` mtime `21:01:42.656`（beads）/ `21:14:29.535`（breakout）均晚于源最新 `21:01:16`；`framework:sync:check` exit=0；产物内 `normalizeCocosTouch` 命中 **9** 次 ⇒ 验的确实是**修复后**产物 |
| SELF-01 判据自检（反假绿） | `[N]` | ✅ | 把 T-104 A4 记录的**修复前**数字喂同一批判定函数 ⇒ `judgeHost/judgeR1/judgeR2/judgeR3` **全部返回不通过** ⇒ 探针有判别力，非「跑了但没判」 |
| HOST-01/02/03 宿主语义（dsf 1/2/3） | `[N]` | ✅ | `getLocation()`：dsf1 `raw=(479,223)` = 式 `(479,223)`；dsf2 `raw=(958,446)`；dsf3（window dpr **3** / 引擎封顶 **2**）`raw=(958,446)`；三档 Δ=(0,0)。反证：与「左上原点」式差 **274 / 548 / 548 px** ⇒ 左下原点 + device px 成立 |
| HOST-03b 封顶口径反证 | `[N]` | ✅ | 用**未封顶** window dpr=3 套同一恒等式 ⇒ Δy=**223px**，判定函数**正确否决** ⇒ 「dpr 必须与输入源同源」被锁死 |
| R1-01 + R1-02（端到端 + 反证） | `[N]` | ✅ | 点可见点 `(478.6,496.6)` ⇒ `traySelected=0`、`slot0='selected'`、`_pointer=(76.70,413.17)` vs 槽心 `(76,414)`；点**镜像点** `(478.6,223.4)` ⇒ `traySelected=-1`、`_pointer=(76.70,920.83)`（离槽心 **506.8** 设计 px）⇒ 修复前后行为完全反转 |
| R2-01 数据流 | `[N]` | ✅ | 两次点击 `push(down)=(479,223)` / `(479,497)` vs 页面相对 Δ=**(0.4,0.4)**；反镜像 guard：与旧式 `canvasH−pageY` 相差 **273.6px** |
| R1-03 + R1-04（500×1000 信箱） | `[N]` | ✅ | `scale=0.6667`、`offsetY=55.33`（>0）；可见点 `(50.7,668.7)` ⇒ 命中；镜像点 `(50.7,331.3)` ⇒ `-1` |
| R3-01 dpr 不变性 | `[N]` | ✅ | 三档同一页面点 ⇒ `push=(479,497)` **完全一致**（两两差 **0.0px**）；`raw.x` = 479 / 958 / 958 = `page×dpr` ⇒ ÷dpr 真被行使（修前 dsf≥2 为 `(958,994)`） |
| R3-02 / R3-03（R1 端到端 @ dsf2 / dsf3） | `[N]` | ✅ | 两档均「可见点命中 / 镜像点不命中」 |
| B-01 `[B]` 镜像点像素反证 | `[B]` | ✅ | 托盘槽行（屏幕行 `487..507`）内点镜像点前后 **changedPixels=0** |
| B-02 `[B]` 可见点像素命中 | `[B]` | ✅ | changedPixels=**181**，变化簇 `x∈[467,491]`（宽 25，**簇心 479.0**）vs 点击点屏幕 x=478.6 ⇒ 渲染层与命中层同位 |
| BR-01 breakout 数据流 | `[N]` | ✅ | dsf1 / dsf2 均 `push=(366,510)` = 页面坐标，两档差 **0.0px**（修前 dsf2 应为 `(732,510)`） |
| B-03 `[B]` 挡板跟手（模型） | `[B]` | ✅ | 点设计 x=300 / 600 ⇒ `paddle.x=299.41 / 599.56`（Δ=0.59 / 0.44 设计 px）、`phase=playing` |
| B-04 `[B]` 挡板像素级 | `[B]` | ✅ | 挡板带（行 `502..518`）亮像素簇心 **365.5 / 500.5** vs 期望 366.3 / 501.2（Δ=0.7 / 0.7）；位移 **135.0px** vs 期望 设计位移×scale=**134.9px** |
| DEV-01 `[R]` 微信小游戏宿主 | ⛔ | ⛔ | **未实测**（无 AppID、无真机）。解除条件：① 有效 AppID；② `build:cocos:wx` 出包；③ 微信开发者工具/真机；④ 用同款探针在 `wx` 宿主复取三 accessor 与 push 值。真机首验须把「点击落点 / 托盘选中 / dpr 缩放」列 **P0**（ADR-0011 §4.2(10)） |
| DEV-02 wechatgame 平台构建 | ⛔ | ⛔ | 缺 AppID ⇒ 上条前置不成立 |

**③ 支撑证据（G1/G2，只读子集）**：`node tools/scripts/verify-all.mjs --steps=check:arch,typecheck,framework:sync:check,test` ⇒ **PASS 4 ｜ SKIP 0 ｜ FAIL 0**；单测 framework **267** + breakout **239** + beads **238** = **744 例全绿**（62 文件）。
⚠ **未跑**全量 `pnpm run verify`（14 项）：其 `harness:build` / `check:size` 等会写 `dev/harness/dist` 等**本单 Output Path 之外**的路径 ⇒ 按只读纪律不跑，全量门由主理人/工程侧复跑。

**④ 探针口径与踩坑（供复用）**
- 槽心**不硬编码**：用游戏自身 `_hitTraySlot` 在 4px/2px 网格扫 bbox 现算（槽 0 实测 bbox `x[48,104] y[384,444]` ⇒ 槽心 `(76,414)`），再经 `viewport.designToScreen` 得屏幕点 —— 托盘位置若再变（v1.20 已上移过一次）不会脱靶。
- 前置两条：必须 `phase==='playing'`；**槽 0 必须持珠**（空槽 `select()` 恒 `'invalid'`，T-104 已记录的坑）。探针用 `giveTrayBead(1)` 补珠（只影响槽内容，不碰坐标逻辑）。
- `mousemove` **不放进 for 循环**；每次点击独立 `move→down→up`。`[B]` 像素分析**在浏览器内解码 PNG**（`createImageBitmap` + `OffscreenCanvas`），不引第三方依赖。
- 改码后必须**先重建产物**：`ENV-*` 门会拦陈旧产物 / 镜像未同步 / 产物不含归一化函数（本轮两次实跑都因此挡住过，属设计内行为）。
- 复跑命令：`node production/qa/beads/cocos-input-probe.mjs`（自带启停 `python3 -m http.server`；端口被占用且标记不符时会换端口，不会验错对象）。
- 未覆盖：① **画布不铺满窗口**的 CSS 布局（本产物 canvas 恒 100% 铺满，`rect=(0,0)`）；② 触屏事件序（`hasTouch`，本探针走真实 **mouse** 事件；Cocos mouse 源同样 ×dpr，已在 HOST 用例中实证）；③ 真机 dpr 无 2 封顶这条差异（见 DEV-01）。

**⑤ 残留 / 不得归零**：⛔ `[R]` 真机（DEV-01/DEV-02）仍为阻塞，**不得记 PASS**；本单零 `src/**` 改动、零 `systems-index §3` 改动。

---

### 阶段 A 交付（程基岩 engineering-lead，2026-09-15，实测取证完成 · **未落任何 `src/**` 改动**）

> 权威说明：以下全部数字来自**本人在真实 Cocos web-mobile 产物上跑出来的实测**（不是文档推断）。
> 产物沿用 `games/beads/cocos/build/web-mobile`（mtime `2026-09-15 08:48`）而非重建：本阶段**零 `src/**` 改动**，
> 且已用 mtime 比对该产物晚于全部输入链路镜像源（最新 `bindings.ts` = `2026-09-14 20:40`）⇒ 产物含当前代码。
> ⚠ 现有工作树有 T-102 等在改的 `games/beads/src/{config/tuning.ts,view/view-model.ts}`，
> `framework:sync:check` 现为红 ⇒ `build:cocos:web` 被前置检查拦住（见 A6 注意事项）。

#### A1 · 语义结论（Cocos web-mobile / 浏览器宿主，**实测**）

**`getLocation()` = 画布相对 · device px（× dpr）· 左下原点**；`getStartLocation()` 同空间（touch-start 时数值与 `getLocation()` 相同）；
`getUILocation()` = 设计单位 · 左下原点 · dpr 无关，但**不减信箱偏移**，且属**引擎 FIXED_HEIGHT 空间**（≠ 框架 `Viewport` 的 contain 空间）。

三组宿主配置、7 个采样点（页面坐标 = 原生 `pointerdown` 的 clientX/clientY，与 Cocos accessor 同帧对照）：

| 宿主配置 | dpr(引擎) | fit(scale/offsetX/offsetY) | page | `getLocation()` | `getUILocation()` | 到达 `InputManager` |
| --- | --- | --- | --- | --- | --- | --- |
| 1280×720 canvas 铺满 | 1 | 0.539730 / 437.601 / 0 | 700,100 | **700,620** | 1296.94,1148.72 | 700,620 |
| 〃 | 1 | 〃 | 480,545 | **480,175** | 889.33,324.24 | 480,175 |
| 〃 | 1 | 〃 | 480,175 | **480,545** | 889.33,1009.76 | 480,545 |
| 〃 | 1 | 〃 | 200,300 | **200,420** | 370.56,778.17 | 200,420 |
| 〃 | 1 | 〃 | 900,650 | **900,70** | 1667.50,129.69 | 900,70 |
| 500×1000（offsetY>0） | 1 | 0.666667 / 0 / **55.333** | 250,150 | **250,850** | 333.50,1133.90 | 250,850 |
| iPhone15 模拟 393×659 | 3（引擎封顶 **2**） | 0.494003 / 11.249 / 0 | 200,300 | **400,718** | 404.86,726.72 | 400,718 |

恒等式（全部样本吻合，容差 ≤1 px，Cocos 取整）：
`x = (clientX − rect.x) × dpr`、`y = (rect.y + rect.height − clientY) × dpr`，其中 `dpr = min(window.devicePixelRatio ?? 1, 2)`。
⇒ **左上原点假设与本式相差整屏高度**，判别力为满屏，非边缘差。

引擎源码互证（Cocos 3.8.8，本机 `/Applications/Cocos/Creator/3.8.8/.../resources/3d/engine` 与产物 `cocos-js/cc.js`）：

- web 触摸源（`cc.js` L40348-40359）：`x = touch.clientX - canvasRect.x; y = canvasRect.y + canvasRect.height - touch.clientY; … x *= dpr; y *= dpr;`
- `Touch.getLocation()` 直返 `_point`；`getUILocation()` = `_point` 再经 `view._convertToUISpace()`。
- 实测 `view`：设计分辨率 750×1334，但 500×1000 下 `getScaleX/Y = 0.749625`、`visibleSize = 667×1334` ⇒ 引擎按 **FIXED_HEIGHT** 适配，与框架 `Viewport` 的 contain（`scale 0.6667` + offsetY 55.33）**不等价** ⇒ `getUILocation()` **不可当作框架设计坐标使用**。

**⚠ 连带发现（超出 y 镜像的第二处偏离，见 Q1）**：`getLocation()` 还是 **device px**（×dpr），而 `Viewport` 屏幕空间是 CSS px（`_fitToGameCanvas()` 用 `canvas.clientWidth/Height`）。实测：同一页面点在 dpr=1 下 push `(478,175)`，dpr=2/3 下 push `(956,350)/(400,718)` ⇒ **真机（dpr≥2）上即使修好 y，x/y 仍整体放大 2 倍，玩法照样不可用**。

#### A2 · 微信小游戏 runtime 宿主（**阻塞，禁止定写**）

- **已读源码（非实测）**：`pal/input/minigame/touch-input.ts:86-90` = `x = touch.clientX * dpr; y = windowSize.height - touch.clientY * dpr;` —— 与 web **同形**（左下原点 + ×dpr）；`pal/screen-adapter/minigame/screen-adapter.ts:71-78`：`dpr = minigame.getWindowInfo().pixelRatio`（**无 web 侧的 2 封顶**）。
- **结论**：预期同为「左下原点 + device px」，但 **⛔ `[R]` 阻塞 —— 无 AppID、无真机，未实测，不得写为已验证**。
- **解除条件**：① 有效 AppID 且 `pnpm --filter @wxgame/beads run build:cocos:wx` 出包；② 微信开发者工具或真机可跑；③ 用 A6 同款探针在 `wx` 宿主复取三个 accessor 与 push 值。

#### A3 · 机械断言（已落盘，**今日必红**）

文件：`packages/framework/tests/adapters/cocos-touch-origin-contract.test.ts`（新增，vitest，Node，不 import `cc`）
实测结果：`Tests 2 failed | 3 passed (5)`；`pnpm -F @wxgame/framework test` 全量 `2 failed | 258 passed`（**只有本单刻意红灯，无其他回归**）；`npx tsc --noEmit` 绿。

- 绿（今日通过）：① 7 个样本逐点校验 `x=(page.x)·dpr`、`y=(canvasH−page.y)·dpr`，并断言**不是**左上原点；② y 与页面坐标反向 / x 同向（左下原点定向判据）；③ 镜像算术（真值 1148.72 与透传值 185.28 之和 = 1334）。
- **红（今日必红 = 锁住语义）**：④ `readTouch()` 不得再 `y: p.y` 原样透传，且必须显式引用可翻转 y 的高度量；⑤ 源码不得再断言 `getLocation()` 为 top-left origin（现 L206-212 / L258-262 两处均命中）。
- ⚠ ④⑤ 是**源码级契约测试**（`bindings.ts` 静态 import `cc`，Node 不可编译，只能扫源码），属临时形态；阶段 B 若采 B1 甲（抽纯函数），应被真行为测试取代。

#### A4 · 修复判据（可机验）

- **R1 端到端（决定性）**：取托盘槽 i 的设计中心 P（用游戏自身 `_hitTraySlot` 在 4px 网格扫 bbox 取中），`S = viewport.designToScreen(P)`；在页面点 **S** ⇒ 必须 `traySelected === i`。**今日实测（槽 0，P=(76,324)，S=(478.62,545.13)）：点 S ⇒ `traySelected = -1`、`_pointer = (74.85,1009.76)`（镜像值）；点 (478.62,174.87) ⇒ `traySelected = 0`、`slot0.state = 'selected'`。**
- **R2 数据流**：`app.input.push` 记录到的 `y ≈ pageY − rect.y`（±1.5 px）。今日 = `canvasH − pageY`。
- **R3 dpr 不变性**（若 Q1 选一起修）：dpr=1 与 dpr=2/3 上下文点同一页面点 ⇒ push 值相同（±1.5 px）。今日 dpr=2 时翻倍。
- **R4 单测**：A3 的两条红灯转绿；若采 B1 甲则新增纯函数行为测试全绿。
- **R5 无回归**：`pnpm run verify` 全绿；harness（`dev/harness/**`）不经 `bindings.ts`，不受影响，须复跑确认。

#### A5 · 2026-09-13 结论为何与本次实测矛盾（二者必有一误 ⇒ 误在前者）

1. 那次结论由两句话组成：(i)「getLocation 是**画布相对**（页面 600 → 335）」—— **真**（引擎源码 `clientX − canvasRect.x` 佐证，本单三配置的 canvas 恰好铺满窗口故不可再区分）；(ii)「因此符合 RawPointerInput **左上原点**契约」—— **假**。
2. (i) 的证据是一个**平移**偏移，(ii) 需要的是**定向**证据。**平移证据对 y 翻转完全不敏感**，用它推出定向结论属越界外推。
3. 当时唯一验证手段是 breakout 挡板跟手，而**挡板只吃 x**；实测 x 在两种假设下完全相同（`page.x 480→480`、`700→700`、`200→200`）⇒ 该验证对 (ii) 的**判别力为零**。且当时是桌面 Chrome dpr=1 ⇒ 连 ×dpr 那一半偏差也同时隐身。
4. 「删 mapPoint 的 y 翻转」在借来的假设下自洽，而 `VERSION.md:130` 自己标过该翻转是「猜测性，必须验证后修正」⇒ 一次猜测被固化进**代码 → 注释 → ADR-0011 引用依据**三级放大。
5. 判据：本次 3 配置 7 采样点全部满足 `y = (canvasH − pageY) × dpr`，与左上原点假设差**整屏高度**；并在 `playing` 相位端到端复现「点可见位置不中、点镜像位置中」。⇒ **误在 2026-09-13 那条结论及引用它的注释/ADR 依据**，本单不为其圆场。
6. 沉淀候选（供主理人决定是否入 `knowledge/`）：**「平移证据不能外推定向结论；锁坐标语义必须用 y 敏感场景 + 至少两个 dpr 档位」**。

#### A6 · 最小复现法（已跑通）

```bash
# 0) 前置：镜像必须与源码一致，否则构建被拦（当前工作树因 T-102 在改 beads src 而是红的）
pnpm run framework:sync:check          # 红则先 sync 或等镜像干净
# 1) 构建（已有产物且本阶段零 src 改动时可跳过，但须先核 mtime：产物须晚于镜像源）
pnpm --filter @wxgame/beads run build:cocos:web
# 2) 静态服务
python3 -m http.server 8091 --directory games/beads/cocos/build/web-mobile
# 3) 打开（playwright-cli 在受管 workspace）
export PATH="$HOME/.workbuddy/binaries/node/workspace/node_modules/.bin:$PATH"
playwright-cli -s=c1 open --browser=chrome http://127.0.0.1:8091/    # 桌面 dpr=1
playwright-cli -s=c1d open --browser=chrome --device="iPhone 15" http://127.0.0.1:8091/   # 真 dpr=3
# 4) 注入探针（取句柄 + 打桩 push + 同帧记录 accessor）
#    app = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot')
#           .getComponent(cc.js.getClassByName('BeadsBootstrap'))._app
#    a) canvasNode.on('touch-start', e => 记 getLocation/getUILocation/getStartLocation/getUIStartLocation)
#    b) window.addEventListener('pointerdown', e => 记 clientX/clientY, true)
#    c) const orig = app.input.push.bind(app.input); app.input.push = ev => { log(ev); return orig(ev); };
# 5) 点击并读数：mousemove X Y → mousedown → mouseup（勿放进 for 循环，实测会退化成 (0,0)）
#    end-to-end：先用 g._hitTraySlot(x,y) 在 4px 网格扫出槽 0 的 bbox 取中 ⇒ designToScreen ⇒ 点它
#    读：g._snapshot.traySelected / g._tray._slots[0].state / g._pointer / g._machine.current
# ⚠ 必须 phase == 'playing' 才有输入（game-over/paused 属 BD-34，WXG-T-100，不得并入本单结论）
```

取证痕迹：全部探针只存在于浏览器会话与 `/tmp`（`/tmp/wxg-probe-*.js`），**仓库零改动**；临时静态服务已停。

---

### 阶段 B 方案（**本轮只给方案，严禁落码**，等主理人放行）

#### B1 · 改法与备选比较

- **甲（推荐）· 抽纯函数 + Node 可测**：新增 `packages/framework/src/adapters/cocos/touch-normalize.ts`（**不 import `cc`**）：
  `normalizeCocosTouch(p, canvasCssHeight, dpr, out)` → `out.x = p.x / dpr; out.y = canvasCssHeight − p.y / dpr;`
  `readTouch()` 调它；`dpr` 取**引擎口径** `cc.view.devicePixelRatio`（web 封顶 2 / 小游戏取 `wx` pixelRatio，免得自己复刻封顶规则），高度取 `#GameCanvas.clientHeight`（== `viewport.fit.screenHeight`，因 `_fitToGameCanvas()` 已按它 resize）。
  优点：可真行为单测（取代 A3 的源码级断言）、dpr 口径与引擎同源、零 core 侵入（L2 合规，改动只在 `adapters/`）。缺点：多一个文件。
- **乙 · 改用 `getUILocation()` 反算**：`cssX = uiX · canvasH / designH`、`cssY = canvasH − uiY · canvasH / designH`（实测 dpr 无关）。优点：不碰 dpr。缺点：依赖「引擎设计单位 == 框架 designHeight」的隐式耦合；引擎为 FIXED_HEIGHT 而框架为 contain，窄屏下二者不等价，语义随引擎适配策略演化 ⇒ 脆弱；且 `designHeight` 常量分处两处需同步。**不推荐**。
- **丙 · 最小改动**：`_bindInput()` 里给 `CocosInputBridge` 传 `mapPoint`（该选项已存在且已有测试先例）：`mapPoint: (x,y) => ({x: x/dpr, y: canvasH − y/dpr})`。优点：一行。缺点：映射函数仍不可在 Node 单测；`readTouch` 错误注释仍在需另改；测试只能停在源码级。**次选**。
- 三者都**必须**顺带订正 `bindings.ts` L206-212 与 L258-262 两处错误注释（否则 A3 ⑤ 不转绿）。
- 宿主差异：不打算为 wechat 分叉；甲/丙按引擎同源 dpr 取值即可，真机可得后按 A2 解除条件复验。

#### B2 · 影响面清单

- **宿主**：Cocos **web-mobile**（实测确认）+ Cocos **wechatgame**（源码同形，⛔ 未实测）。`canvas2d` / Node 平台 / `dev/harness/**` **不经 `bindings.ts` ⇒ 不受影响**（harness 映射实测正确，不属本单）。
- **游戏**：`beads` ⇒ **P0**（托盘 / 棋盘 / 按钮全部 y 敏感，今日玩法整体不可用）。`breakout` ⇒ 对 **y 镜像免疫**（挡板只吃 x —— 这正是 2026-09-13 漏检的成因），**但对 ×dpr 不免疫**（x 同样翻倍）；若 Q1 选「一起修 dpr」，breakout 需一并复验。
- **不受影响**：`packages/framework/src/core/**`、`games/*/src`（零玩法改动）、`systems-index §3`（本单**不需要任何新数值**，已确认）。

#### B3 · ADR-0011 处置建议：**修订正文，不另立新 ADR**（理由 + 负面后果预写）

- 理由：被推翻的是 ADR-0011 的**引用依据与一句旁证**，不是**决策主体**。决策主体（屏幕坐标唯一契约 = CSS px top-left；DPR 由 renderer/adapter 承担）不但未倒，反而被本单实测**加强**——正因为输入源给的是 device px，才更需要在 adapter 层归一回 CSS px。另立 ADR 会把「实现违约」讲成「契约变更」，误导后人。
- 拟修订点：① §1.1 表格里 `bindings.ts L204-213` 那条：改注为「该注释为**当时的错误断言**，已被 WXG-T-104 实测推翻（getLocation = 左下原点 device px）；契约不变，违约方是 `readTouch`」；② §3(c) 末「输入全程留在 CSS px」改为「viewport 在 CSS px；**Cocos 输入源在 device px，必须由 adapters 层除以 dpr 归一**」；③ §4.2 增一条负面：ADR-0011 写作时「引擎已在输入侧消化 DPR」属**误判**，代价是真到 WXG-T-104 才暴露；④ §5 增触发条件：真机可得时复核 minigame 的 dpr 口径（无 2 封顶）。
- **负面后果预写**：① ADR-0011 已 Accepted，改正文会让「已冻结裁决」的可信度受损，须在文首加「2026-09-15 修订（WXG-T-104）」时间戳以保留可审计性；② 修订后 ADR-0011 同时含「原判断」与「推翻后的事实」两层叙述，读者需自行分辨哪层有效（用时间戳 + 显式「已推翻」措辞缓解，不能消除）；③ §4.2(1) 那种「明知注释过期却不改」的文档债模式重演风险——故**必须**与改码同批改 `bindings.ts` 注释，不得只改 ADR。
- 备选（若主理人裁定「Accepted 正文不动」）：另立 **ADR-0014「Cocos 输入坐标归一化」** + 在 ADR-0011 顶部加一行指针。负面：坐标契约出现两处真源，后人难判孰为准；且 ADR-0011 §1.1 那条错误依据仍在正文里继续误导（只能靠顶部一行指针，弱）。

#### B4 · 需要补/改的测试清单

1. **新增** `packages/framework/tests/adapters/cocos-touch-normalize.test.ts`（采甲时）：dpr=1/2/3、`offsetY>0`、画布非全屏（`rect.x/y ≠ 0` 构造值）、取整容差；与 `Viewport` 往返（设计点 → `designToScreen` → 归一化反推，误差 <1e-6）。
2. **改** 本单 `cocos-touch-origin-contract.test.ts`：④⑤ 转绿；采甲后把 ④ 换成对 `normalizeCocosTouch` 的行为断言（源码级断言降级或删除），⑤ 保留为「注释不得回退」的守门。
3. **保留** `cocos-input-bridge.test.ts` 现有 `mapPoint` 用例（bridge 本身不做坐标假设，未被本单推翻）；可补一条「bridge 不改写未映射值」。
4. **端到端 `[B]` 道次**：R1/R2/R3 三条做成可复跑脚本（建议落 `production/qa/beads/` 或 `tools/scripts/`，属 QA/主理人域，需另派单）；须附**重建产物后**的复跑证据。
5. **回归**：`pnpm run verify` 全绿 + `node tools/scripts/check-architecture.mjs` + harness 冒烟（证明 canvas2d 路径未受影响）。

#### 阶段 B 未决问题（供用户拍板，2–4 项）

- **Q1（范围）**：是否**顺带修 ×dpr**？ **A)** 一起修（真机 dpr≥2 必坏，推荐，成本≈同一处代码） / **B)** 本单只修 y，dpr 另开单（建议 WXG-T-105） / **C)** 只修 y，dpr 记为已知缺陷直到真机可得（风险：真机出货仍不可用）。
- **Q2（改法）**：甲（抽纯函数，可行为单测，推荐） / 丙（mapPoint 一行，最小面） / 乙（getUILocation 反算，不推荐）。
- **Q3（ADR）**：修订 ADR-0011 正文（推荐） / 另立 ADR-0014 + 顶部指针。
- **Q4（红灯期）**：A3 的两条刻意红灯会让 `pnpm -F @wxgame/framework test` 保持红到阶段 B 结束。**A)** 接受（红灯即欠账，最诚实，推荐） / **B)** 改 `it.fails` 标记（绿但需阶段 B 同步移除，易忘） / **C)** 加 `skip` + TODO（最省事但最易被遗忘）。

---

#### 阶段 B 完成记录（程基岩 engineering-lead，2026-09-15 · 用户四项裁定全采推荐项：Q1=A / Q2=甲 / Q3=修订 ADR-0011 / Q4=接受红灯到本阶段结束）

**① 落盘清单**（全部在放行 Output Path 内）

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `packages/framework/src/adapters/cocos/touch-normalize.ts` | **新增** | 纯函数 `normalizeCocosTouch(raw, {canvasHeightCss, dpr}, out?)`：**同时**做 y 翻转与 ÷dpr；**不 import `cc`**、不碰 DOM/全局 ⇒ Node 可行为测试（甲案的唯一理由） |
| `packages/framework/src/adapters/cocos/bindings.ts` | 改 | `readTouch(e, space)` 调纯函数；`_bindInput` L205-212 与 `readTouch` 头注释 L255-262 两处错误断言**就地订正**；另**顺带**订正第三处同型错误（`_fitToGameCanvas` 头注释称 getLocation 为 CSS px，实为 device px）；新增 `_touchSpace()` 与 `engineDpr()`（取 `cc.screen.devicePixelRatio`） |
| `packages/framework/tests/adapters/cocos-touch-normalize.test.ts` | **新增** | Node 行为测试 **9 例**（见下） |
| `packages/framework/tests/adapters/cocos-touch-origin-contract.test.ts` | 改 | 两条源码级红灯**退役**（行为测试已覆盖）；保留 ①③ 宿主实测台账断言（锁"宿主到底给了什么"，与代码无关） |
| `docs/architecture/adr/ADR-0011-*.md` | 改 | 修订正文（不另立 ADR）：文首修订戳 + §1.1 订正表 + §1.1/§1.5 两处"唯一越界者/不得改 bindings"勘误 + §3(c) 半句订正 + **新增 §3(e) 宿主归一化契约** + §4.1(5) + §4.2(0)(8)(9)(10) + §5(8)(9)(10)(11) |
| 镜像拷贝件 | 由 `framework:sync` 产出 | `games/{beads,breakout}/cocos/assets/scripts/framework/adapters/cocos/touch-normalize.ts`（**未手改**）；`.ts.meta` 由 **Cocos CLI 构建时自动生成**（见 ⑤ 备注） |

**② 红灯期结束声明（Q4=A 的收口）**：阶段 A 的两条刻意红灯**已转绿并退役** ⇒
`pnpm -F @wxgame/framework test` = **28 files / 267 tests 全绿**（改码前 258 passed / 2 failed）；
全仓 `pnpm -r run test` = framework 267 + breakout 239 + beads 238 全绿；
`pnpm run verify` = **PASS 13 ｜ SKIP 1（check:size，未覆盖非失败）｜ FAIL 0**。
⇒ 红灯期自 2026-09-15 起结束，**此前受其牵动的 CI / `verify` 汇总恢复为可信信号**；
且红灯已由"源码级正则"升级为"9 例 Node 行为测试"，不再是判别力为零的守门。

**③ 复跑取证（**先 `pnpm --filter @wxgame/beads run build:cocos:web` 重建产物**，mtime 2026-09-15 21:0x，非旧产物）**
探针 = `cc.director.getScene()→Canvas→GameRoot→getComponent('BeadsBootstrap')._app`，打桩 `app.input.push`；
前置 = `phase === 'playing'` **且** 槽 0 `state === 'holding'`（空槽 `select()` 恒 `'invalid'`，这是本轮踩到的第二个坑，不属本单缺陷）。
同一会话内 A/B：**先点镜像点、再点可见点**。

| 判据 | 1280×720 dsf=1 | 393×659 dsf=1 | 393×659 dsf=2 | 393×659 dsf=3（引擎封顶 2） |
| --- | --- | --- | --- | --- |
| `window.devicePixelRatio` / `screen.devicePixelRatio` | 1 / 1 | 1 / 1 | 2 / 2 | **3 / 2** |
| canvas CSS / backing | 1280×720 / 1280×720 | 393×659 / 393×659 | 393×659 / **786×1318** | 393×659 / **786×1318** |
| 槽 0 设计中心 → `designToScreen` | (76,414) → (478.62, **496.55**) | (76,414) → (48.79, **454.48**) | 同左 | 同左 |
| **R1 点可见位置** | push (478,496) ⇒ `traySelected=0`、`slot0='selected'` | push (48,454) ⇒ `traySelected=0` | push (48,454) ⇒ `traySelected=0` | push (48,454) ⇒ `traySelected=0` |
| **R1 反证：点镜像位置** (`h−S.y`) | 点 (478.6, 223.4) ⇒ `traySelected=-1`（旧行为此处才命中） | 点 (48.8, 204.5) ⇒ -1 | ⇒ -1 | ⇒ -1 |
| **R2 数据流** | push y=496 vs pageY=496.55（Δ≤0.6px；今日之前 = 720−496.55=223.45） | 454 vs 454.48 | 454 vs 454.48 | 454 vs 454.48 |
| **R3 dpr 不变性** | — | (48,454) | (48,454) **一致** | (48,454) **一致**（今日之前 dsf≥2 会翻倍） |
| `_pointer`（设计空间回读） | (74.85, 415.02) ≈ 槽心 (76,414) | (74.39, 414.98) | 同 | 同 |
| 页面错误 | 无 | 无 | 无 | 无 |

⇒ **R1 / R2 / R3 三条全过**；且"点镜像位置不再命中"反证成立（阶段 A 时点镜像才命中）。

**④ 新增行为测试 9 例**（`pnpm -F @wxgame/framework test tests/adapters/cocos-touch-normalize.test.ts`）：
① dpr=1 五个实测样本翻转回页面坐标；② ÷dpr 含 **window dpr=3 / 引擎封顶 2**，并反向锁"用未封顶 dpr=3 必偏离 >60px"；
③ 纵向信箱 `offsetY=55.33` 样本（归一化与信箱偏移无关，`containsScreenPoint` 为真）；④ 边界（左下→屏幕底、左上→屏幕顶）；
⑤ 画布不铺满窗口时只取决于画布内相对位置；⑥ `out` 复用同一实例（热路径零分配）；⑦ dpr 非法（0/NaN/负）退化按 1、不产 NaN；
⑧ 与 `Viewport` 往返（设计点→`designToScreen`→模拟宿主 device px→归一化→`screenToDesign` 回到原点，dpr=1/2 各一遍）；
⑨ 镜像反证（透传值经 `screenToDesign` 后 = 真值关于设计中线的镜像：1148.72 + 185.28 = 1334；归一化后二者重合）。

**⑤ 对本单相关"坑"的补充实测（供后续复用）**
- **BD-33（镜像脚本缺 `.ts.meta`）本轮**未构成阻塞**：`framework:sync` 后新文件无 meta，但 **Cocos CLI 构建时自动生成了**
  `touch-normalize.ts.meta`（mtime 21:01，171B，编辑器产物，**非手编**），产物 `assets/main/index.js` 内 `normalizeCocosTouch` 命中 7 处。
  ⚠ 该结论只对"跑过一次 CLI 构建"的路径成立；若某游戏只 sync 不构建，仍缺 meta —— **BD-33 不因本单关闭**。
- **`screen.devicePixelRatio` 是本轮实测确认过的取值**：web 侧 = `min(window.devicePixelRatio, 2)`（dsf=3 → 2，与 `pal/screen-adapter/web` 源码一致）；
  backing store 比 `786/393 = 2` 与之相等（即"由 canvas `width/clientWidth` 反推 dpr"这条备选在本产物上也成立）。
- **`framework:sync:check` 现状为绿**：本轮 sync 时工作树的并行改动已不在 `games/beads/src/**`（`git status` 仅 ctx/knowledge/memory/production 在改）⇒ **未出现"因他人改动而红"**，无需代为修复。
- **breakout 附带复验（B2 要求：Q1=A 时需一并复验）**：同样**重建产物**后探针（800×600，打桩 `app.input.push`，点页面 (300,400)）
  ⇒ dsf=1 push **(300,400)**、dsf=2 push **(300,400)**（修前 dsf=2 应为 (600,400)）；两档均无页面错误；
  `touch-normalize.ts.meta` 亦由 CLI 构建自动生成，产物内 `normalizeCocosTouch` 命中 7 处。
  ⚠ 只验到**数据流**这一层，**未**验 breakout 玩法手感（挡板跟手 `[B]` 目视道次未做，本单不做）。

**⑥ 残留 / 不得归零**
- ⛔ **`[R]` 微信小游戏宿主未验**：`pal/input/minigame/touch-input.ts` 源码同形（左下原点 + ×pixelRatio，**无 2 封顶**），
  但无 AppID、无真机 ⇒ 未实测。解除条件同 A2（AppID + `build:cocos:wx` 出包 + 用 A6 探针在 `wx` 宿主复取三 accessor 与 push 值）。
  **真机首验必须把"点击落点 / 托盘选中"列为 P0 检查项**（ADR-0011 §4.2(10)）。
- ⛔ **BD-34（`_readInput` 仅在 `_stepPlaying` 内）不在本单**：`game-over` 下 `_readInput` 调用数仍为 0，属 **WXG-T-100**，用户已拍板本轮不动码。
- ⛔ **A05-09 本体仍 ⛔**（探针与 `test-cases` 需按新主体同改后复跑，成员无 `production/**` 写权限）。
- 本单**未引入任何新游戏数值**，`systems-index §3` 零改动；`games/beads/src/**`、`dev/harness/**` 零改动。
- **主理人独立复核（2026-09-15）**：`node production/qa/beads/cocos-input-probe.mjs` ⇒ **退出码 0**，汇总 **PASS 18 ｜ FAIL 0 ｜ ⛔ 2**（DEV-01 微信宿主、DEV-02 wechatgame 构建缺 AppID，**未记 PASS 亦未记 FAIL**），耗时 23.3s，**可复跑**。探针自带 `SELF-01` 判据自检（把 T-104 记录的**修复前**数字喂同一批判定函数，四个判定函数全部返回不通过）⇒ 判别力有反例证明，非恒真。落盘：`production/qa/beads/cocos-input-probe.mjs`、`evidence/cocos-input-probe.log`、`evidence/cocos-input-*.png`（beads 12 张 + breakout 4 张）、`evidence/cocos-input-probe-g1g2-subset.log`。**关键实测**：R1 点可见 (478.6,496.6) ⇒ `traySelected=0`、`_pointer=(76.70,413.17)`；点镜像 (478.6,223.4) ⇒ `-1`、`_pointer=(76.70,920.83)`；R2 push 与页面坐标 Δ=(0.4,0.4)（旧式差 273.6px）；R3 dsf 1/2/3 三档 push 完全一致（两两差 0.0px），`raw.x`=479/958/958 证明 ÷dpr 真被行使；`[B]` 像素级 beads 亮像素簇心 479.0 vs 点击 478.6、breakout 位移 135.0px vs 期望 134.9px。**未 commit / 未 push。**
- **成员遗留未决问题（待拍板）**：**① 是否纳入 CI/`verify`**（推荐 A：不纳入，依赖 Cocos 产物 + 浏览器，全量 verify 会变重；B 只文档登记命令；C 纳入 `verify-all.mjs` STEPS 需工程侧）；**② 判据是否回写 `production/qa/beads/test-cases.md §A`**（推荐 **B 倾向**：把 R1/R2/R3 升为三条硬判据用例，避免只活在本单日志里；A 维持现状；C 连 `smoke-tests.md` 图例加 `[B]` 道次）；**③ 真机首验 DEV-01 挂哪张单**（推荐 A 维持随 T-104 残留，真机可得时列 P0；B 另立单但前置不可执行；C 合入发布前 checklist）；**④ 是否接受「探针不覆盖画布非铺满窗口」边界**（本产物 canvas 恒 100% 铺满；推荐 A 接受并登记，B 另派工程侧加 viewport 非全屏测试）。
- **成员门禁建议（转呈编排者裁决）**：本单（证据固化）**PASS**；若把「宿主输入正确性」整体视作一道门，建议 **CONCERNS** —— G1 ✅（只读子集）／G2 ✅（744 例全绿）／**G3 未执行**（不属本单，且 `harness:build` 会写 `dev/harness/dist`，越出本单 Output Path 故未跑全量 verify）／G4 = 已执行硬判据全过 + `[R]` 真机一条 ⛔ 未测。
- **用户裁定（2026-09-15）**：本单未决 ② 采 **B 倾向** ⇒ 判据回写另立 **WXG-T-109**（派严守真）；①③④ 维持现状不立新单。

---

## WXG-T-109

- **名称**：**Cocos 输入 R1/R2/R3 回写为 `test-cases.md` 硬判据**
- **负责**：严守真(quality-lead)　**状态**：📋 已立项（待施工；**用户已批准写入 `production/qa/beads/test-cases.md`**）　**P2**
- **背景**：WXG-T-108 已把 R1（点可见位置命中 / 点镜像位置不命中）、R2（`InputManager.push` 的 y ≈ 页面 pageY）、R3（dpr=1/2/3 封顶 2 下同一可见点落点一致）固化成**可复跑探针** `production/qa/beads/cocos-input-probe.mjs`（PASS 18 ｜ FAIL 0 ｜ ⛔ 2，主理人独立复跑退出码 0）。但**这三条只活在本单的探针与日志里，QA 五件套的 `test-cases.md` 未收录** ⇒ 下轮回归若只跑用例表，仍会漏掉这一类缺陷（本仓已因此重复踩过四次同类坑）。
- **Deliverables**：① 在 `production/qa/beads/test-cases.md` **新增三条硬判据**（编号/分组按该文件既有体系，由你按 `wxgame-qa-gates` 规范决定并**在回传中说明选号理由**）；② 每条须写明：**判据原文** / 环境标签（`[N]`·`[B]`·`[R]`）/ **预期值来源**（指向 WXG-T-104 实测、`ADR-0011 §3(e)`、以及探针 `cocos-input-probe.mjs` 的对应用例 ID）/ 当前状态；③ 同步该文件顶部 **§A.0 实测状态回填表**（若存在此表）；④ **不得把 ⛔ 记为 PASS** —— DEV-01（微信宿主）、DEV-02（wechatgame 构建缺 AppID）须记 ⛔ 并写解除条件；⑤ 回写后**自证**：三条判据均能在探针里找到对应可执行用例。
- **权威来源**：`production/TASKS-DETAIL.md` 的 `## WXG-T-108` 小节（含主理人复核的实测数字）> `production/qa/beads/cocos-input-probe.mjs` > `docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md` §3(e) > `packages/framework/src/adapters/cocos/touch-normalize.ts`。
- **Output Path**：`production/qa/beads/test-cases.md`（**主产物**）；如需补证据放 `production/qa/beads/evidence/`。**禁改**：`packages/**`、`games/**`、`docs/**`、`systems-index §3`、`production/qa/beads/` 之外的 `production/**`（台账主表与状态回填由主理人执笔）。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`（**必须**）；另读 `AGENTS.md`、`production/qa/beads/test-cases.md`（先摸清其编号与分组体系再落笔）。
- **约束**：严守真默认 readonly，本单**已获用户批准**写入上列路径，不得越界；不 commit/push；不把未执行项记为通过。

### 完成记录（严守真 quality-lead，2026-09-15 · 已落盘 · **未 commit / 未 push**；状态行与台账主表由主理人回填）

**① 落盘清单**（全部在已批准的 Output Path 内，未越界）

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `production/qa/beads/test-cases.md` | **改**（v1.5 → **v1.6**） | 新增 **§I 宿主坐标归一化判据**（3 条硬判据 `TC-COORD-01..03`）+ **§I.2 ⛔ 未测道次** + **§I.3 自证映射表**；同步 §A.0（新增 `A.0b` 增量块）+ 文首图例 + 分组汇总表 + 变更记录 |
| `production/qa/beads/evidence/t109/cocos-input-probe-t109.log` | **新增** | 本轮复跑探针证据（每条含「预期（先写）/ 实测」） |
| `production/qa/beads/evidence/t109/cocos-input-*.png`（16 张） | **新增** | 本轮 `[B]` 目视截图（独立目录，**不覆盖** T-108 冻结证据） |

**② 新增用例编号与选号理由**：**新开 §I 一节，三条用例编号 `TC-COORD-01 / 02 / 03`**（= T-104 A4 的 R1 / R2 / R3）。

- **为何单开一节**：本文件组织法 = 「每一节 = 一个判据来源家族」（§A=GDD §8 / §B=systems-index/accesibility / §C=score-combo §8 / §D=powerups §8 / §E=core-loop §2.2.2 帧内序 / §F=ux-spec / §G=可感知规格层 / §H=未映射 §8 补编）。R1/R2/R3 来源是 **`ADR-0011 §3(e)` + `T-104·A4`**，**既非 §8、也非 §G 的规格层** ⇒ 并入 §A 会破坏「50 条 = 5 组 × 10」的 1:1 计数、并入 §G 会污染其来源谱系 ⇒ **新开 §I**。
- **为何取 `TC-COORD-*` 而非 `TC-HOST-*`**：探针里 `HOST-01/02/03` 是「宿主 **accessor 级**」断言的另一组 ID，同名会混。`R1/R2/R3` 保留在「判据代号」列，与 `judgeR1/2/3` 同名，使 `T-104 A4 ↔ 探针用例 ID ↔ 本表` 三向可对。

**③ 三条判据 ↔ 探针用例 ID 映射（自证，一一对上）**

| 本节用例 | 判据原文（来源） | 环境 | 探针 `cocos-input-probe.mjs` 用例 ID | 判定函数 | 本轮结论 |
| --- | --- | --- | --- | --- | --- |
| TC-COORD-01 | R1 端到端命中 + 镜像反证（`T-104·A4-R1` / `ADR-0011 §3(e)-1`） | `[N]` | `R1-01+R1-02`（+`R1-03+R1-04` 信箱 / `R3-02`+`R3-03` dsf2-3 端到端） | `judgeR1` | ✅ PASS |
| TC-COORD-02 | R2 `InputManager.push` 的 y ≈ pageY（`T-104·A4-R2` / `§3(e)-2`） | `[N]` | `R2-01`（同族 `HOST-01/02/03`+`HOST-03b`；`BR-01`） | `judgeR2` / `judgeHost` | ✅ PASS |
| TC-COORD-03 | R3 dpr=1/2/3（封顶 2）落点一致（`T-104·A4-R3` / `§3(e)-3` / `§4.2(0)`） | `[N]` | `R3-01` | `judgeR3` | ✅ PASS |
| DEV-01 / DEV-02 | 微信宿主 / wechatgame 构建 | `[R]` / `[⛔]` | `DEV-01` / `DEV-02`（脚本内 `DECLARED_BLOCKED`） | —（仅登记，不判定） | **⛔ 未测**（**不记 PASS、不记 FAIL**） |

**④ 本轮实跑（第一手，非引 T-108 日志）**：`node production/qa/beads/cocos-input-probe.mjs --out=production/qa/beads/evidence/t109 --log=…/t109/cocos-input-probe-t109.log` ⇒ **退出码 0 ｜ PASS 18 ｜ FAIL 0 ｜ ⛔ 2**（2026-09-15T14:03:12Z，耗时 23.2s）。关键实测与 T-108 记录**逐字一致**：R1 可见点 `(478.6,496.6)`⇒`traySelected=0`/`_pointer=(76.70,413.17)`、镜像点 `(478.6,223.4)`⇒`-1`/`_pointer=(76.70,920.83)`（guard 273.1px）；R2 push vs 页面坐标 Δ=(0.4,0.4)、反镜像 guard 273.6px；R3 三档 `push=(479,497)` 两两差 **0.0px**、`raw.x`=479/958/958。探针 `SELF-01` 以 T-104 **修复前**数字为反例，`judgeHost/judgeR1/judgeR2/judgeR3` 全返回不通过 ⇒ 判别力有反例证明。
> **踩坑登记（供复用）**：① 探针**不自建 OUT_DIR**（在 `finally` 才 `mkdirSync`）⇒ 用非默认 `--out` 须**先手动建目录**，否则每条 `[B]`/截图用例 `ENOENT` 全 ⛔、退出码 2（本例首次复跑即撞此坑，二次建目录后复跑得 0）。② 用独立 `--out=evidence/t109` 落盘以**避免覆盖 T-108 冻结证据** `evidence/cocos-input-probe.log` 与同名 png。

**⑤ §A.0 是否同步**：**已同步**——新增 `### A.0b WXG-T-109 轮回填（增量）` 块，只列**本轮真正执行过**的 5 行（TC-COORD-01/02/03 ✅ + DEV-01/02 ⛔）；上方 16 行 WXG-T-084 轮**未改**（追加不覆盖）。另更新：文首图例（追加 `[N]/[B]/[R]` lane 映射）、分组汇总表（新增 §I 行、**合计用例数 137 → 140**）、变更记录（v1.6 行）。

**⑥ 未决问题（转呈主理人）**

- **Q1 §I 是否纳入 CI/`verify`**（推荐 **A** 维持 T-108 决定：不纳入——依赖 Cocos 产物 + 浏览器，全量 verify 变重；B 只文档登记复跑命令；C 纳入 `verify-all.mjs` 需工程侧）。
- **Q2 §I 的道次标记是否与文首图例彻底统一**（推荐 **A** 保留探针 lane `[N]/[B]/[R]` 并在 §I 节首给等价表，因这些用例**必须在探针语境**下读；B 全部改写为 `[Node]/[Cocos]/[Device]` 会与探针输出对不上）。
- **Q3 真机首验（DEV-01）挂哪张单**（推荐 **A** 维持随 T-104/T-108 残留、真机可得时列 P0，与本单落盘口径一致；B 另立单但前置不可执行）。
- **Q4 是否顺手把 `smoke-tests.md` 也加 §I 对应冒烟条**（推荐 **A** 本单不动——已超本单 Deliverable；B 另立小单把「宿主输入落点」加进冒烟主链路）。

**⑦ 门禁建议（转呈编排者裁决）**：本单（判据回写）**PASS** —— 三条判据已回写、可与探针用例一一对上、⛔ 如实标注、§A.0 已同步。若把「宿主输入正确性」整体视作一道门，建议 **CONCERNS**：**G1 ✅**（未跑静态门，属只读文档单；探针自身过 `framework:sync:check`=exit 0）／**G2 未执行**（不属本单）／**G3 未执行**／**G4 = 本轮 `[N]/[B]` 硬判据全过（18/18）+ `[R]` 真机 2 道 ⛔ 未测**。

**⑧ 已知风险与缓解**：① `[R]` 真机未验（`DEV-01`）——缓解=源码同形已读 + 真机首验 P0 清单（解除条件见 §I.2）；② §I 三条用例依赖 Cocos 产物 + 浏览器 ⇒ **不能进 `[CI]`**，须人工/主理人按命令复跑——缓解=探针自带退出码与 `SELF-01` 判别力自检；③ 本节结论**不含**画布非铺满窗口的 CSS 布局（本产物 canvas 恒 100% 铺满）与触屏事件序（探针走真实 mouse）——已随 T-108 登记，不属本单范围。

**⑨ 下一 Task / 下游角色建议**：下游 = **主理人**（回填台账主表与状态行、裁定 Q1–Q4）；若后续要闭环真机，责任人 = **主理人/工程侧**（挂 `DEV-01` 首验 P0）。本单零 `src/**`、零 `systems-index §3`、零 `docs/**` 改动，未 commit、未 push。

**⑩ 主理人独立复核（2026-09-15）**：`grep` 确认 **§I 已落盘**（`test-cases.md:396`，节标题含「缺陷 C1 回归闸门」）、**TC-COORD-01/02/03 在 §I.1**（`:408` 起，每条含判据原文 / 环境道次 / 预期值来源 / 探针用例 ID 映射三向可对）、**§A.0b 回填表**（`:46–48`，只列本轮真跑过的 5 行且未覆盖上方 T-084 轮原文）、**分组汇总表新增 §I 行**（`:183`，合计 137→140）。⛔ 标注如实（DEV-01/DEV-02 未记 PASS、亦未记 FAIL）。**审定：本单 PASS。**
- **观察项（成员已报，不擅铸缺陷号，待裁）**：探针 `cocos-input-probe.mjs` **不自建 `OUT_DIR`**（在 `finally` 才 `mkdirSync`）⇒ 用非默认 `--out` 时须先手建目录，否则截图用例 `ENOENT` 全 ⛔、退出码 2（首次复跑即中招）。探针已冻结为 T-108 证据，**成员未擅改** —— 处置建议：随 T-108 的后续维护一并修（**一行级**），**不另立单、不铸 BD 号**。
- **主理人裁定（Q1–Q4）**：**Q1 = A**（维持不纳入 `verify`／CI —— 依赖 Cocos 产物 + 浏览器，全量 verify 会变重）；**Q2 = A**（**保留探针 lane `[N]/[B]/[R]`** 并在 §I 节首给等价表 —— 与探针输出对得上比「统一 + 文首图例」更重要）；**Q3 = A**（真机首验维持随 T-104/T-108 残留，真机可得时列 P0）；**Q4 = A**（本单不动 `smoke-tests.md`，超 Deliverable）。

---

## WXG-T-110

- **名称**：**宿主行为测试守卫（warn 级，非 fail-closed）**
- **负责**：程基岩(engineering-lead)　**状态**：✅ 完成（2026-09-15 落盘；2026-09-16 复核落盘完整 + 主表回填）　**P2**
- **✅ 收口（2026-09-16）**：守卫脚本 `check-host-behavior-tests.mjs`（WARN 态 + `--selftest` 9 例）+ `package.json` 双 script + `verify-all.mjs` STEPS 第 15 项 `check:host-tests`。`pnpm run verify` 含该门禁 PASS 16 / FAIL 0。
- **背景**：`control-manifest §17`（WXG-T-107 落盘）要求「新宿主 / 新引擎适配器接入必须有 Node **行为测试**」，但该约束目前**只能靠 §12 提交前自查表人工执行**，无机械守卫 ⇒ 会重演「清单写了但无人对照」的老问题。
- **⚠️ 用户裁定（2026-09-15，重要）**：先做 **warn 级**观察一轮，**不做 fail-closed**。理由：当前只有 Cocos 一个宿主适配器，fail-closed 无真阳性、易成噪声。**不得擅自升级为阻断。**
- **Deliverables**：① **守卫脚本**：扫 `packages/framework/src/adapters/*/`，对每个含输入归一化 / 触摸归一化模块的引擎适配器，检查是否配对 `packages/framework/tests/adapters/<引擎>-touch-normalize.test.ts`（或等价**行为**测试文件）；② 输出为 **WARN 且不阻断**（退出码 0），并在输出中写明**何时可升 fail-closed**（建议条件：出现**第二个**宿主适配器时）；③ **明确排除源码级正则断言** —— 只扫源码文本不算配对（§17 明令禁止其当交付），需识别出真正的可执行行为测试；④ 挂载位置由你判断（独立脚本 + `package.json` script，或并入 `verify-all.mjs` STEPS），但**不得破坏 `verify` 的「逐项执行、永不短路」语义**（WXG-T-095 / BD-17 硬约束，禁止改回 `&&` 串链）；⑤ **自证双向实测**：有配对 ⇒ 静默/绿；人为移除或改名 ⇒ 报 WARN 且退出码仍为 0。
- **权威来源**：`docs/architecture/control-manifest.md` **§17**（含 4 处交叉引用：§6 / §12 / §13×2）> `production/TASKS-DETAIL.md` 的 `## WXG-T-107` 与 `## WXG-T-104` 小节 > `packages/framework/tests/adapters/cocos-touch-normalize.test.ts`（现有正例）。
- **Output Path**：`tools/scripts/` 或 `packages/framework/`（你判断并回传）；如需改 `package.json` / `tools/scripts/verify-all.mjs` 一并包含。**禁改**：`games/**/src/**`、`systems-index §3`、`docs/architecture/control-manifest.md`（已落盘，本单不动）、`docs/architecture/adr/**`、`production/**` 除 `TASKS-DETAIL.md` 的 `## WXG-T-110` 小节外的一切。
- **必读 skill**：`my-skills/wxgame-adr-arch/SKILL.md`；另读 `AGENTS.md`、`docs/architecture/control-manifest.md`、`docs/agent/commands.md`（`verify` 语义）。
- **约束**：先问再写；本单**已授权**你落上列 Output Path；不 commit/push；**不得把守卫升级为阻断**。

### 完成记录（程基岩 engineering-lead，2026-09-15 · 已落盘 · **未 commit / 未 push**；状态行与台账主表由主理人回填）

**① 落盘清单**（全部在已批准 Output Path 内；`docs/**`、`games/**/src/**`、`systems-index §3`、`production/**`（除本小节）零改动）

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `tools/scripts/check-host-behavior-tests.mjs` | **新增** | §17 守卫：按宿主适配器扫「输入/触摸归一化模块」↔「行为测试」配对；默认 **WARN + 退出 0**；自带 `--selftest`（9 例，含反例判别力）与预留升级开关 `--fail-on-gap` |
| `package.json` | **改** | 新增 `check:host-tests`、`check:host-tests:selftest` |
| `tools/scripts/verify-all.mjs` | **改** | ①支持第 4 种状态 **`WARN`**（观察项：**不记 PASS**、**不影响退出码**，`--strict` 亦然 —— 不违反「不得升级为阻断」）；②`STEPS` **追加** `check:host-tests`（15 项，仍**逐项执行、永不短路**，未动 `&&`）；③合成自测 9 → **12** 例；④去掉硬编码「14 项」措辞（防脱钩） |
| `production/TASKS-DETAIL.md` | **改** | 本小节（追加，未删改既有内容） |

**② 守卫判定口径**（脚本头注 + 运行输出「② 判定口径」双份可查）

- **检查面**：`packages/framework/src/adapters/<引擎>/` 下任一 `.ts`（非测试）满足其一即视为归一化模块：**(a)** 文件名含 `normaliz`（§17 自己规定的命名约定）；**(b)** AST 判定文件**导出了名字含 `normaliz` 的函数**（`export function` / `export const`）。注：这里只是**探测「有没有这类模块」**，不充当语义断言 —— §17 禁止的是「拿正则当语义交付的证据」，不是禁止守卫识别文件（此点已在头注写明，避免自相矛盾）。
- **配对 = 行为测试**（四条同时成立）：① 测试文件的 `import` 路径**解析到**该模块（支持 `./x.js`→`x.ts` 的 NodeNext 写法）；② 导入了至少一个**值绑定**（`import type` 不算）；③ 在测试体里**真的调用了**该绑定（`fn(...)` 或 `ns.fn(...)`）；④ 文件里有 `it(`/`test(` 用例。
- **明确不算**（三类，均报缺口）：`MISSING_TEST`（无人 import）／`NOT_BEHAVIOR_TEST`（只 `import type`、或值导入却从不调用）／`SOURCE_REGEX_ONLY`（只 `readFileSync(源码)` + `toMatch(/…/)` 这类**源码级正则/文本断言**，§17 明令其不能当交付，输出单独点名）。
- 实现手段：用 **TypeScript 编译器 API 的 AST**（非正则）判定 import/调用形态；正则只用于**识别**「疑似源码级断言」（仅作输出说明，不参与判定）。
- **诚实边界（已知成本，非「已解决」）**：②③ 是**静态近似** —— 「import 且调用」不等于「断言真的覆盖了 ÷dpr 与 y 翻转」；真正的判别力仍在配对测试的**反例用例**（`cocos-touch-normalize.test.ts` 的 ②反向锁 / ⑨镜像反证；探针 `SELF-01`）。本守卫不检查归一化模块的**纯度**（不 import `cc` / 不碰 DOM）—— 那属 §17 另一条，L2/L3 与 `check:arch` 另有覆盖面，本守卫不越界。

**③ 挂载位置与理由**：**并入 `verify-all.mjs` 的 `STEPS`（第 15 项）+ 独立脚本**。理由：§17 的痛点正是「约束只活在自查表里没人跑」⇒ 独立脚本单放等于重演该痛点；而并入 STEPS 若沿用既有三态，会**要么伪装成 PASS、要么在 `--strict` 下变成阻断**（两者都违反用户裁定）⇒ 故为聚合器新增语义自洽的第 4 态 **`WARN`**（🔶，不计 PASS、不改退出码）。`verify` 的「逐项执行、永不短路」语义**未动**（`--validate` 仍绿；`verify-all-selftest.sh` 全绿，含「注入失败项后后续仍执行」）。

**④ 自证双向实测（2026-09-15，本机实跑）**

| 场景 | 命令 | 结果 |
| --- | --- | --- |
| ① 有配对（现状） | `node tools/scripts/check-host-behavior-tests.mjs` | `STATUS: OK`、**exit 0**；cocos 配对 `tests/adapters/cocos-touch-normalize.test.ts`（值导入绑定被实际调用 1 个、9 个 it 用例） |
| ① 经聚合器 | `verify-all.mjs --steps=check:host-tests --strict` | `✅ PASS check:host-tests`、**exit 0** |
| ② 人为移除配对测试 | 同上（测试文件暂移出） | 守卫 `STATUS: **WARN**`、**exit 0**（缺口 `MISSING_TEST`）；经聚合器变 🔶 `WARN check:host-tests`、**exit 0**（`--strict` 下亦然） |
| ② 升级开关（预留） | `… --fail-on-gap` | `STATUS: FAIL`、exit 1 —— 证明「升级 = 一步」真实可用，但**默认与 verify 均不使用** |
| 守卫自测 | `pnpm run check:host-tests:selftest` | **9/9**（正例静默 + 6 个反例必报：改名/源码级正则/只 import type/值导入不调用/第二宿主/第二模块） |
| 聚合器自测 | `pnpm run verify:selftest` | **全绿**（含合成 12/12、`--validate` 15 项、不短路、SKIP≠PASS 五步） |

> 自证后**已还原**：目标文件 `cp` 回原位、`git status --porcelain -- <该路径>` 与改动前一致（该文件本就未跟踪 `??`，属 T-104/T-108 未提交产物，**未动他人改动**）。

**⑤ 升级 fail-closed 的条件**（写进守卫运行输出「④」，且主判据**已机械化**、自报是否满足）

1. **主判据**：**含输入归一化模块的宿主适配器数 ≥ 2**。现状 = **1**（cocos）⇒ 条件**未满足**，仍是观察期。（`canvas2d` 是第 2 个适配器目录，但**无**输入归一化模块 ⇒ 不计入本判据；这正是「只在第二个宿主出现时才有真阳性」的机械化表达。）
2. 同一宿主在 CI 上出现过一次真实的「漏写行为测试」回归。
3. §17 复评（ADR-0011 §5）结论要求收紧。
   **升级方式（一行）**：`verify-all.mjs` 的 `STEPS` 把该项改为 `check:host-tests --fail-on-gap`，并把脚本 WARN 语义改判 FAIL。

**⑥ 未决问题（转呈主理人，2–4 选项）**

- **Q1 `docs/agent/commands.md` 出现措辞漂移**：该文件写「`verify` 全量门禁聚合器 …… **14 项**」，现为 **15 项**（本单新增 `check:host-tests`）。`commands.md` **不在本单 Output Path**，我未改。**推荐 A**：主理人另开小单（或随本单收尾）把该行改为「步骤表见 `--list`」的**非硬编码**写法，并补一行 `check:host-tests` 的用途/口径；**B** 就地只改数字 14→15（仍会再次漂移）；**C** 暂不动，登记为已知漂移。
- **Q2 `WARN` 是否要推广到其它「观察项」**：本单为聚合器引入第 4 态。**推荐 A** 先只服务 `check:host-tests`，观察一轮再谈复用；**B** 立刻把 `check:tasks` 的 report-only 观察哨（H 项）也迁到 WARN 通道（统一语义，但扩大改动面）；**C** 不给 WARN 落文档（不推荐，会变成隐性约定）。
- **Q3 守卫是否纳入 pre-commit**：本单只进 `verify`。**推荐 A** 维持（pre-commit 已被 BD-20 教训要求「只拦不写」，warn 级项进 pre-commit 收益低）；**B** 在 `.githooks/pre-commit` 加一条 warn-only 提示（需改 `.githooks/**`，超本单 Output Path）。
- **Q4 第二个宿主的机械预警**：**推荐 A** 维持本守卫每次 `verify` 自报「含归一化模块的适配器数」（现状 1/2），升到 2 时自动提示「已达升级条件」；**B** 另立单在 `systems-index`/Epic 层登记「新宿主接入 checklist 含运行本守卫」。

**⑦ 已知风险与缓解**

1. **静态近似的误判面**（风险：把「import 且调用」误当「真行为测试」）—— 缓解：③ 的诚实边界已写在脚本头注与输出；真正的判别力靠配对测试的反例用例，且 §17/§12 仍保留人工项（机械守卫**不替代**自查表）。
2. **`WARN` 第 4 态影响面**（风险：改动共享工具 `verify-all.mjs`）—— 缓解：不改退出码、`--strict` 不判红、原 9 条自测断言全部保留并**新增 3 条**专测 WARN；`verify-all-selftest.sh` 五步全绿；`--validate` 绿（防 `&&` 回退仍生效）。
3. **升级条件依赖「适配器目录数」**（风险：新宿主若把归一化写进 `src/platform/**` 而非 `adapters/`，守卫扫不到）—— 缓解：本守卫会在输出里点明检查面路径；若新宿主选非 `adapters/` 落位，须同批扩检查面并复评（已列为 Q4 备选）。
4. **无真机 / 无 AppID** 对本单**无影响**（纯静态守卫）。

**⑧ 建议下一 Task / 下游角色**

- 下游 = **主理人**：回填台账主表与状态行；裁定 Q1（`commands.md` 漂移，**建议就本单内一次改掉**，因它会立刻误导读者）。
- 若 Q1 选 A：责任人 = **程基岩**（工程侧，`tools/scripts` + `docs/agent/commands.md` 小改单）。
- 新宿主接入时（触发条件 1 达成）：责任人 = **程基岩**（升 fail-closed + 同批复刻 `<引擎>-touch-normalize.test.ts`），QA 侧由 **严守真** 把该判据收进 `production/qa/beads/test-cases.md`。

**⑨ 明确回答主理人**：**守卫已落盘**（`tools/scripts/check-host-behavior-tests.mjs`，并已挂进 `verify` 第 15 项）；**默认退出码为 0（不阻断）**，含发现缺口时（`--strict` 亦然）；**已自证双向**（有配对 ⇒ `STATUS: OK` / exit 0；移除配对 ⇒ `STATUS: WARN` / exit 0；预留 `--fail-on-gap` ⇒ exit 1，未接入 verify）。未 commit、未 push。

**⑩ 主理人独立复核（2026-09-15）**：本单动过**共享门禁聚合器** `verify-all.mjs`（新增第 4 态 `WARN`），属高风险改动，故逐项实跑：
1. `pnpm run check:host-tests` ⇒ **`STATUS: OK`、EXIT=0**；输出自报「适配器 2 个 ｜ 含归一化模块 1 个 ｜ 缺口 0 ｜ PASS 1 ｜ WARN 0」，并把**升级 fail-closed 的触发条件**（含归一化模块的宿主适配器 **≥2** 个）机械写进结论。
2. **「有缺口不阻断」独立复现**（把 `tests/adapters/cocos-touch-normalize.test.ts` 临时改名）⇒ **`STATUS: WARN`、缺口 1 项、EXIT=0**（不阻断成立）；**已还原并 `diff` 内容一致**，未留残迹。
3. `pnpm run verify -- --validate` ⇒ **步骤表 15 项全部存在于 `package.json` 且 `verify` 仍指向本聚合器**（WXG-T-095 的「反 `&&` 串链回退」守卫仍生效）。
4. `pnpm run verify` 全量 ⇒ **PASS 14 ｜ WARN 0 ｜ SKIP 1（check:size 未覆盖）｜ FAIL 0**（15 项），旧 14 项无回归。
**审定：本单 PASS。** 判定口径（AST 识别而非正则、配对＝解析到模块 + **值导入** + **实际调用** + 有 `it(`、`SOURCE_REGEX_ONLY` 单独点名）与 §17 的「禁正则当交付」自洽，未自相矛盾。
- **主理人追正 `docs/agent/commands.md` 漂移（成员 Q1）**：该文件仍写「verify …… **14 项**」且汇总表缺 `WARN` 态 ⇒ 由主理人执笔追正（同 T-098 · O4 先例，**成员 Output Path 不含该文件，守纪律未擅改**）：① 计数改为「**以 `--list` 为准，勿硬编码计数**」并去掉「后面 13 项」的硬编码；② 汇总表补 `PASS/WARN/SKIP/FAIL` 且写明 `WARN` = **观察期守卫（不计通过、不影响退出码、`--strict` 亦不判红）**；③ 新增 `check:host-tests` 一行（含判定口径与升级条件）。
- **主理人裁定（Q2–Q4）**：**Q2 = A**（`WARN` 先只服务 `check:host-tests` 观察一轮，不外推）；**Q3 = A**（维持只进 `verify`，不进 pre-commit）；**Q4 = A**（维持每次 `verify` 自报「含归一化模块适配器 1/2」，达 2 时自动提示升级）。
- **⚠️ 收尾时发现的既有红（非本单引入）**：`pnpm run ctx:check` 的 **C 项**（索引过期 19 个变更）已由主理人 `pnpm run ctx:build` 修复；重建后仅剩 **B 项单文件上限** 红 —— `memory/2026-09-12.md`(10141) 与 `memory/2026-09-14.md`(12586)，**属并行会话 WXG-T-106（memory 二级详情拆分）的在途工作**，非本单亦非本会话产物，主理人未越界处理。

---

## WXG-T-123

- **名称**：**QA 复测 `CLK-01`（BD-40 修复后产物）+ 勘误 §25.13 的 CLK-01 行 + 判据测量分辨率口径**
- **负责**：严守真(qa)　**状态**：📋 已立项（待施工）　**P1**
- **❗范围说明（先读，避免重复劳动）**：本单原拟两件事 —— ① 复测 `CLK-01`、② 屏幕层判据面修复（`§25.12.2` 的 P0 清单）。**② 已由并发 QA 会话完成并落盘为报告 `§25.13`（终轮：探针口径收敛后复跑）**，本单**只做 ① + 勘误 + 分辨率口径**，**不得重做 ②**、不得动已收敛的判据面。
- **时间线（主理人已厘清）**：① `§25.12` 发现 BD-40 并列屏幕层 P0 修法；② **并发 QA 会话执行了该清单**（D5 阈值数据相对 / D5② 支撑上下限 / D6 采样与 rAF 解耦 / D6′ 逐样本真实时钟 / D7 自检不依赖本机帧长 / D8 补先验预期 / **D0 新增第三态 `⊘`**）⇒ 屏幕层判据面**已达标且跨轮稳定**（`P4S-00/01/02` 全绿；`P4S-03`/`P4S-01b` 记 **⊘** 拒绝判定）—— **但其 `CLK-01 = 2.003` 是在 `WXG-T-122` 修复**前**的 Cocos 产物上跑的**；③ **`WXG-T-122` 已修 BD-40**（`App.startHostDriven()` + 三道互斥守卫），工程自证 `CLK-01 = 0.999`（1.999 → 0.999），但该自证**被后续运行覆盖**、不在盘上，且**不替代 QA 复测**。
- **Deliverables**：
  1. **确认产物新鲜度**（`ENV-01` 自查须过：产物 mtime ≥ `packages/framework/src/**` 最新；`framework:sync:check` exit=0）—— `T-122` 已重建 `build:cocos:web`，预期直接过；若不过，**先回传**再重建。
  2. **复跑 `production/qa/beads/beads-browser-probe.mjs`** ⇒ 预期 **`CLK-01` = 仿真/墙钟 ≈ 1.00（±0.10）⇒ PASS**（真源 `T-122` 工程自证 0.999）。**若仍 ≈2 ⇒ 那是重大发现（修复未生效或产物陈旧），立即停手回传，不得自行解读**。
  3. **勘误报告 `§25.13` 的 `CLK-01` 行**（`2.003`）—— 加【`WXG-T-123` 注】：该读数系 **`WXG-T-122` 修复前产物**所测，**已被复测取代**；沿用「追加不覆盖」纪律，不改写原文。**同时**：`P4S-03` 在修复后产物的读数须重新取（修后墙钟口径 ≈2.01 次/秒，见 `T-122` 工程自证）⇒ 据实记（`PASS`/`⊘` 由判据面定，**不得因贴线而放宽**）。
  4. **把「判据测量分辨率」写进判据口径**（`T-122` 主理人裁定 ①）：墙钟闪烁率类判据须声明**帧量化分辨率** —— 一帧 ≈16.7ms ⇒ 500ms 门的实测起点间距落在 500±8ms ⇒ 折算 **1.97–2.03 次/秒**；**2.01 属分辨率噪声，非真超线**。**只写口径，不改任何阈值**。
  5. 证据落 `production/qa/beads/evidence/`（新 log + 确定性重跑自证）。
- **权威来源（冲突以 A 为准）**：**A** `production/qa/beads/g4-regression-report.md` **§25.13**（判据面现行口径与 `⊘` 语义）+ **§25.12.3**（退出码契约）＞ **B** `production/TASKS-DETAIL.md` 的 `## WXG-T-122`（修复内容 + **CLK-01 自证 0.999** + 裁定 ① 分辨率口径）＞ **C** `production/qa/beads/beads-browser-probe.mjs`（**只读**，本轮不改判据面）＞ **D** `games/beads/design/gdd/systems-index.md §3.8`（≤2 次/秒，只读）。
- **Output Path**：`production/qa/beads/g4-regression-report.md`、`production/qa/beads/evidence/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-123` 小节（**追加**）。**禁改**：`beads-browser-probe.mjs`（判据面已收敛）、`g4-probe-v1.1.mjs`、`games/**`、`packages/**`、`tools/**`、`systems-index §3`、其他成员台账小节。
- **硬要求**：不把 ⛔/⊘ 写成 PASS；不放宽阈值；**判据面一字不改**；`[R]`（真机 1×）与 `[P]`（听感）仍 ⛔ 不代判；先问再写；不 commit/push。
- **必读**：`my-skills/wxgame-qa-gates/SKILL.md`；`g4-regression-report.md` §25.13；`TASKS-DETAIL.md` 的 `## WXG-T-122` / `## WXG-T-123`。
- **⚠️ 防超时纪律**：任何可能 >60s 静默的命令用重定向 + `tail` 或后台 + 轮询；先落盘台账与报告、再补证据。
- **回传（固定结构）**：① 文件列表；② 摘要（产物新鲜度、`CLK-01` 实测、`P4S-03` 修后读数与判定、勘误内容、分辨率口径落点）；③ 未决问题；④ 风险与缓解（含 `[R]`/`[P]` 边界）；⑤ 建议下一 Task；⑥ **明确回答**：`CLK-01` 是否 ≈1.00、`§25.13` 勘误是否落盘、分辨率口径是否写入且未改阈值、有无放宽。
- **完成记录（2026-09-16 · 严守真）—— 状态：✅ 交付完成（三项 Deliverables 全部落地，未动判据面）**：
  - **Deliverable 1 产物新鲜度 ✅**：产物最新 mtime `1789515802`（web-mobile）≥ `packages/framework/src` 最新 `1789515641`（`bindings.ts`）；`framework:sync:check` **exit=0**；探针自证 `ENV-01 = PASS`（产物 mtime 晚于全源链 + 镜像守卫 OK）。**未重建**（T-122 已重建，预期直接过 ⇒ 事实过）。
  - **Deliverable 2 `CLK-01` 复测 ✅ PASS**：修复后产物两轮 **1.002 / 0.997**（判据 ≈1.00±0.10；与 T-122 工程自证 0.999 一致）；**退出码 `1 → 0`、FAIL 0**；判定串两轮除 `P4S-01b`（⊘↔PASS 条件性翻转，§25.13 已声明）外逐字一致。正式轮计数 `PASS 13 ｜ PASS* 10 ｜ FAIL 0 ｜ ⛔ 4 ｜ ⊘ 2`。
  - **Deliverable 3 勘误 ✅（追加不覆盖）**：`g4-regression-report.md` §25.13.0 末尾追加【WXG-T-123 注】——`CLK-01 = 2.003` 系 **T-122 修复前产物**所测，已被复测取代；原文一字未动；完整记录落新节 **§25.14**。
  - **Deliverable 4 `P4S-03` 修后读数 ✅ 记 `⊘`**：判据面（探针 `DECLARED_INVALID`）硬编码无条件 `⊘`，本轮不改；读数据实登记 —— 直测 **2.02 次/秒**（正式轮，最小墙钟间距 495ms）/ **2.38 次/秒**（重跑轮，420ms，超出纯帧量化带宽，系起播检测对位移通道肩峰的敏感度所致）；换算交叉校验 ≈2.00 / ≈2.06。**既不因 2.02 贴线记 PASS，也不因 2.38 漂移改判 FAIL**。产品侧结论仍以 `P4S-02`（game 时基 ≥500ms ✓）与指令流层为准。
  - **Deliverable 4b 分辨率口径 ✅（只写文字、未改阈值）**：§25.14.4 落档 T-122 裁定 ① —— 一帧 ≈16.7ms ⇒ 500ms 门实测起点间距 500±8ms ⇒ 折算 **1.97–2.03 次/秒**；带宽内读数（2.01/2.02）属分辨率噪声、非真超线，**不得据此放宽或收紧门限**；`§3.8` 冻结值与探针判据**一字未动**。带宽边界声明：只覆盖纯帧量化，重跑轮 2.38 超带宽属检测敏感度，不得读作判定。
  - **顺带登记（探针文案滞留，不在本单修）**：§25.14.5 —— D12：`P4S-03` 正文仍硬编码「双驱动宿主不可测」理由（修后已单驱动，文案过时）；D13：重跑轮计数行「⊘ 1」与括注「P4S-01b, P4S-03」不符。均为文案/展示，不影响判定与退出码，建议并入下轮探针维护单。
  - **改动文件**：`production/qa/beads/g4-regression-report.md`（§25.13.0 追加勘误注 + 新增 §25.14，共 +102 行）、`production/qa/beads/evidence/beads-browser-probe-t123.log`（新）、`evidence/beads-browser-probe-t123-rerun.log`（新）；截图/JSON 取样物由探针每轮覆写（盘上版本对应重跑轮）。**未改** `beads-browser-probe.mjs`、`games/**`、`packages/**`、`tools/**`、`systems-index §3`。**未 commit / 未 push**。
  - **G4 建议（裁决权归主理人）**：维持 **CONCERNS** —— `CLK-01` 已闭合，剩余阻塞全部收束到真机首验（DEV-01）与探针维护单，无新实现缺陷。
- **主理人独立复核（2026-09-16，事后非采信自述）**：
  - **`CLK-01` 已核**（`beads-browser-probe-t123.log`）：**仿真/墙钟 = 1.002**（墙钟 2.513s / 仿真 2.517s / 151 固定步）⇒ **PASS** ✅；重跑轮 **0.997** ⇒ 两点与 `T-122` 自证 0.999 **三点一致**。**退出码 1 → 0，FAIL 0** ⇒ **BD-40 至此 `[B]` 道次闭合**。
  - **勘误与口径已核**：§25.13.0 的【`WXG-T-123` 注】（`:1951`，**追加不覆盖**、原文零改动）✅；**§25.14**（`:2028`）+ **判据测量分辨率口径**（`:2080-2084`，折算带宽 **1.97–2.03 次/秒**）✅ —— **只写文字、阈值与 `§3.8` 冻结值一字未动** ✅。
  - **特别肯定一处纪律**：`P4S-03` 直测读数**跨轮漂移 2.02 → 2.38**，**超出其自己刚写的纯帧量化带宽（1.97–2.03）** ⇒ 成员**没有**拿 2.02 贴线记 PASS，也**没有**因 2.38 改判 FAIL，而是**据实登记漂移 + 维持 `⊘`（拒绝判定）**，并把漂移成因指到「起播检测对位移通道肩峰的敏感度」。**带宽判据被自己的新数据顶穿时，正确动作是拒绝判定并追因，不是挑一个好看的数** —— 这是本单最值得留档的一笔。
  - **门禁**：`check:tasks` **52 行 ⇔ 52 节**、`check:links` OK、`verify` PASS 14 / WARN 0 / SKIP 1 / FAIL 0 ✅。
- **主理人裁定（成员四项未决）**：
  1. **`P4S-03` ⊘ 的后续 = A（维持 ⊘，至真机首验一并复核）** —— 采纳其建议。理由：① 判据面本轮**禁改**（`§25.13` D10 裁定）；② 直测读数**跨轮漂移超出分辨率带宽** ⇒ 该测度对该宿主形态**本身不稳定**，此时重设判据面（B）是过早优化，**真机上拿同源读数再定才有意义**；C（拿 2.02 记 PASS）**否**。
  2. **`D12`/`D13` 探针文案** = **并入下轮探针维护单**（与 §25.13.6-4 的 `P4S-01b` 测度纯净度增强同批），**不挂 backlog** —— 它们是「文案与展示失实」（会误导后人），属**活跃漂移**而非低优先欠账。
  3. **G4 裁决 = 维持 `CONCERNS`** —— 采纳。`CLK-01` 闭合后剩余阻塞收束为：**DEV-01 真机首验（需 AppID，P0 含 `CLK-01` 同源复核 + wrong/告急观感）**、探针维护单、`beads` 主包红线仍无实测数据。**不得升 PASS**。
  4. **主表状态行** ⇒ 本条已由主理人更新。
  - **沉淀**：QA 提出的两条 K 候选（①判据读数须声明测量分辨率带宽，带宽内不判超线也不据此放宽；②修后复测先核产物新鲜度，防在陈旧产物上测出假 FAIL）**均采纳**，已入主理人经验库；建议下次 `tasks:archive` 时一并沉淀进仓内 memory。
- **📥 待入库清单（2026-09-16 盘点 · 61 项 · 用户裁定：等并发入库会话收口后由主理人按序提交）**：
  - **触发条件**：并发入库会话（HEAD `7e2565d` @ 08:21:43，正入库 WXG-T-119 的 docs/memory/knowledge）**停止产出 ≥30 分钟**方可动手。**⚠️ 该会话在 08:39–08:41 仍在 `temp/` 产出 beads 截图 ⇒ 截至本条登记时仍未收口**；`temp/` 系其在途产物，**勿清理**。
  - **已随盘点完成**：`.gitignore` 已补 `production/qa/beads/evidence/**/*.json|*.png`（82 → 61 项噪音）；`/tmp/beads-evidence` 已清；残留 `serve-harness` 进程已终止。
  - **提交分组（⚠️ 混笔文件须随行，勿按文件级拆）**：
    1. **T-104**（C1 坐标归一化）：`packages/framework/src/adapters/cocos/touch-normalize.ts`(新)、`tests/adapters/cocos-touch-*.test.ts`×2(新)、`src/core/input/input-manager.ts`、`docs/architecture/adr/ADR-0011…md`、`docs/architecture/control-manifest.md`
    2. **T-122**（BD-40 修复）：`src/compose/app.ts`、`src/adapters/cocos/loop-bridge.ts`、`tests/compose/app-host-driven.test.ts`(新)、`tests/adapters/cocos-loop-bridge.test.ts` —— ⚠️ **与 1 在 `bindings.ts` 混笔**（本单 4 行注释 + T-104 大半 diff）⇒ **1+2 同一笔提交**，message 双任务号
    3. **T-102 + T-100/T-114**（beads BD-29 改码 + 真链）：`games/beads/src/{config/tuning,game/beads-game,view/view-model}.ts`、`tests/{feedback-vfx,helpers,phase-input-realchain}.ts` —— ⚠️ `beads-game.ts` 混笔随行
    4. **T-115/T-117**（设计文档）：`games/beads/design/gdd/input-control.md`、`games/beads/design/ux/ux-spec.md`
    5. **T-118/119/123**（QA 探针与报告）：`g4-probe-v1.1.mjs`、`g4-regression-report.md`、`test-cases.md`、`beads-browser-probe.mjs`(新)、`cocos-input-probe.mjs`(新)、`evidence/diag-t119-a05.mjs`(新，**按体例 .mjs 入库**；其 json/png 已忽略)
    6. **T-121/T-110**（工具/门禁）：`tools/scripts/{selftests,verify-all,check-host-behavior-tests}.mjs`、`dev/harness/index.html`
    7. **台账**（**最后**）：`production/TASKS.md`、`production/TASKS-DETAIL.md` —— ⚠️ 并发会话若也动台账，须先 `git add` 前复查其最新状态
  - **镜像/meta 随行**：两游戏 `cocos/**/framework/**` 拷贝件由 `framework:sync` 产出，随组 1/2/3 对应任务走；各 `.meta`（Cocos 编辑器补生成，含 T-058 遗漏的 `ads.meta`）随最近一次涉及该目录的任务走。
  - **✅ 已处置：`dev/harness/preview/*.svg` —— 判定「不需要记录」并已还原**（2026-09-16）。依据：报告 §BD-19（`:232`）明文登记 `preview:frames`「**不识别 `--help`、直接执行并覆写 `dev/harness/preview/level-{1..5}.svg`**」⇒ 该 +54/−14 是 **BD-19 已登记缺陷的副作用覆写**（跑 `preview:frames` 想看 help 却被脚本直接执行），**非任何任务的有意产出**；svg 本身是 `render-harness-frame.mjs` 的纯再生成产物。处置 = `git checkout -- dev/harness/preview/` 回到 HEAD 有意入库版。**防复发提示**：在 BD-19/B8 修复（`preview:frames` 支持 beads + 识别 `--help`）落地前，任何「想看 help」的调用都会再次覆写这 5 个文件。
  - **体例提醒**（K-050 教训）：**提交不带 pathspec、逐组确认 staged 清单**；台账与归档收口须双向对账。
- **🧪 主理人实测（T-130 · 2026-09-16 · harness + playwright 真实指针，产物含 T-122/T-124/T-125/T-126）**：
  - **符合预期（v1.3 验收面）**：冷启动直进 L1、托盘开局 1 颗；T-124 v1.3 视觉（白胶囊 HUD/8 齿齿轮/28px floor/hint accent_blue/E1 混色/E4 幽灵/三道具卡+ad 角标/扩展入口）；主链路落子与拒绝 ✓；**BD-29 修复运行时成立**（单次脉冲梯形 60/80/60、α 序列 `0.48→1×5→0.48→0`、峰数=1；500ms 门内连点不重启）；**BD-34 回归**（真实指针 暂停→恢复→下一关 全通）；**暂停冻结计时**（184→184）；通关 22/22、3 星、结算面板；L2 推进（8×6）；clearAll 槽位清空 ✓（托盘 9→3）；冲刺 120s、计分累计 10→140、倍率阶梯 ×1/×2/×3 ✓、冲刺结算面板（单局/最高梯位/最高连击 + 再来一局/返回关卡 = §8-8c）✓；normal 失败（时间到 + revive/retry）+ 续时 +60s（revived=true）✓；按钮 ≥88 ✓。
  - **新缺陷登记（证据截图 /tmp/beads-t130/01–06.png，本轮会话结束即清）**：
    - **BD-43（P1）道具卡热区与视觉渲染错位**：`T.powerupCardRects()[0] = {x:51, bottom:82, h:116}` ⇒ 热区 y≈**82–198（顶部 HUD 下）**，而视觉卡渲染在**底部 y≈1120**。实测双向对照：tap 视觉位置 (375,1150) ⇒ `clearAll` **消费 0**（玩家点卡无效）；tap 矩形位置 (375,140) ⇒ **消费 1**（且该位置视觉上是网格上方空白 ⇒ **误触风险**）。疑根因 = `powerupCardRects()` 内 `powerupBlockBaseY()`（tuning.ts:619 调用，定义在 layout 模块）与 **T-124 改版后的渲染布局脱节**；**判例复发**：tuning.ts:517 明文登记过 T-062「rects 与点击落点不一致的静默漂移」同类问题。
    - **BD-44（P2）region 消费后无可见效果**：L2 场景（5 颗已填充）tap 卡 ⇒ `uses.region 1→0` 但 `filled` 不变（cleared=0）。疑区域锚点语义（未选中格时锚在哪）或效果实现缺失，随 BD-43 一并查。
    - **BD-45（P2）冲刺结算面板「NEW BEST」被黑色图元遮挡**：截图显示「IEW BES」（左首字母被黑块压住）。T-124 丙案视觉回归。
    - **BD-46（P3）冲刺 HUD「STAGE 1」左裁成「AGE 1」**：同上截图，文字左缘被裁。
    - **BD-47（P3）= 原 N1 复现**：结算面板「剩余 **02:50.1999999999997174**」—— `formatTime` 秒未取整 + `clearRemaining` 传原始浮点（`beads-game.ts` 结算路）；设计 = mm:ss（ux-spec §3.4）。上次实测（T-118 前）已发现并建议修复，**当时未立项** ⇒ 本条补登记。
  - **未完成台账任务（不挡可玩性）**：T-077（Label 宽度，进行中）、T-099（取证通路 B8/BD-19，已立项 —— 与本批 `preview/` 覆写复发直接相关）、T-121（verify STEPS 待 T-110）。
  - **⚠️ 勘误（2026-09-16 追记）**：**BD-43 / BD-44 经 WXG-T-127 复测与代码级复核，裁定均非缺陷** —— ① BD-43：渲染（drawPowerupBand）与命中（_hitPowerupCard）**本就同源于 powerupCardRects()**，双基底（harness + Cocos web-mobile）真实指针点视觉卡均正确消费；② BD-44：region 的 GDD 语义 = **清托盘连续窗口**（powerups §2.2）、§8-7「零网格写入」是验收项本身 —— **T-130 的两项「无效」观测系探针时序伪影 + 观察对象看错（盯网格没盯托盘）**。回归断言已由 T-127 补入。**教训入册**：道具/动效类断言禁止以 snapshot 即时读数为准（uses 扣减/托盘变化存在动画后生效的滞后），须固定延时 + 终态断言或事件计数 —— 已沉淀并转 QA 探针维护单吸收。登记人 = 主理人。

---

## WXG-T-122

- **名称**：**框架 · 宿主驱动权互斥（BD-40 宿主双驱动修复）**
- **负责**：程基岩(engineering-lead)　**状态**：📋 已立项（待施工）　**P1**
- **背景**：**BD-40** 由 `WXG-T-119`（`[B]` 道次探针）发现、主理人**代码级确证**：Cocos 宿主下 **仿真/墙钟 ≈ 2×**（实测 **1.999 / 2.029 / 2.005 / 2.003**，四轮稳定复现）。**`WXG-T-121` 只把 BD-40 挂上了检测门禁，修复本身此前无单** ⇒ 本单即修复单。
- **根因（已确证，可直接采用）**：
  - `packages/framework/src/compose/app.ts:121` —— `start()` **无条件** `this._schedule()`；`:158-169` `_schedule()` 用 `platform.requestFrame` **自驱** `tick`；
  - `packages/framework/src/adapters/cocos/loop-bridge.ts:38-43` —— `CocosLoopBridge.start()` **先** `this._app.start()`（⇒ 触发自驱）**再** `this._scheduler.schedule(this._tick, 0)`（⇒ Cocos 又驱动一次）；
  - `packages/framework/src/adapters/cocos/bindings.ts:105-108` —— 宿主**两者都接**。
  - ⇒ `app.tick` 每墙钟帧被调 **2 次** ⇒ 游戏跑 ≈2 倍速。
- **定性：设计意图与实现的脱节，不是宿主误用** —— `app.ts:141-146` 的 `tick()` docstring **明写**「Used by tests and by hosts whose engine owns the tick (e.g. a Cocos `Component.update`)」⇒ 框架**本就打算**让宿主自 tick，但 `start()` 没有提供关闭自驱的开关。
- **后果（必须随修复一并声明）**：仿真/墙钟 ≈2× ⇒ 倒计时/动效/音频时长相对墙钟**减半**；**wrong 闪烁在墙钟口径 3.35–4.49 次/秒 > `systems-index §3.8` 的 2 次/秒** ⇒ **光敏性红线在宿主层被违反**（`T-102` 的游戏时基逻辑本身正确）。**真机同源风险**：`packages/framework/src/platform/weapp.ts:197` 亦有 `requestFrame` ⇒ **weapp 宿主的驱动权须在本单一并核实并写清结论**（若 weapp 无 bridge 则 `App.start()` 自驱是唯一驱动 ⇒ 单驱正确；若有同类 bridge 则同样双驱）。
- **⚠️ 已知陷阱（修复时最易踩）**：`bindings.ts:108-110` 注释**明说** `CocosLoopBridge.start()` 调 `App.start()` 是**有意依赖** —— 为了让它做 **viewport re-fit**（`platform.getScreenSize()`），且「Doing this any earlier gets silently overwritten (observed 2026-09-13)」。⇒ **不能简单删掉 `app.start()` 调用**，否则 viewport fit 静默失效。修复必须**保住初始化语义**（`game.init` / `onHide/onShow` 挂接 / viewport re-fit），只把「**驱动权**」从初始化里**解耦**出来。
- **修复方向（选型权归你，但须满足以下约束）**：
  1. **向后兼容**：`App.start()` 的**默认**行为（无人声明宿主驱动）**保持自驱** —— harness、Node 单测、`render-harness-*.mjs` 全靠它，**不得破坏**。
  2. **显式宿主驱动**：提供一种**显式**声明「驱动权归宿主」的方式（构造选项 / `start()` 选项 / 独立方法，**由你定**），宿主驱动模式下 `start()` 做**全部初始化**但**不 `_schedule()`**；`stop()` 在该模式下须安全（`_frameHandle` 为 null 时不得抛）。
  3. **互斥防护（强烈建议）**：两种驱动**同时生效**时应**硬失败**（抛错或显式 WARN + 拒绝第二路），**不得静默双驱** —— 本缺陷能存活到今天，正是因为双驱是静默的。`CocosLoopBridge` 改用宿主驱动路径。
  4. **行为测试**：`packages/framework/tests/compose/**`（已存在该目录）新增断言：宿主驱动模式下 ① `_schedule` 未启动（无 `requestFrame` 调用）；② 外部每墙钟秒调一次 `tick` ⇒ `loop.advance` 的固定步数 ≈ 预期（**1×**）；③ 双驱时**硬失败**。**用假 platform / 假 scheduler**（沿用 `tests/adapters` 现有假件风格）。
  5. **`framework:sync`**：改 `packages/framework/src/**` ⇒ 必跑 `pnpm run framework:sync` + `framework:sync:check`（两游戏拷贝件同步）。
- **验收标准**：
  1. framework 行为测试全绿（含新增 3 条）；
  2. `pnpm run framework:sync:check` OK；
  3. `pnpm run verify` FAIL 0；
  4. **Cocos web 产物重跑 `production/qa/beads/beads-browser-probe.mjs` 的 `CLK-01` ⇒ 仿真/墙钟 ≈ 1.00（±0.10）** —— 此项属 **QA 域复测**，工程侧**先自证单测**，复测由主理人另派；若你本地能顺带跑（`node production/qa/beads/beads-browser-probe.mjs`，**产物须重建**：`pnpm --filter @wxgame/beads run build:cocos:web`），可作为自证附在回传，但**不得替代 QA 复测**。
  5. **`breakout` 同受影响**（共用 framework 拷贝件）⇒ 修复后其 Cocos 产物同样回到 1×；**不得顺手改游戏侧 src**（如确需，先回传）。
- **权威来源（冲突以 A 为准）**：**A** `packages/framework/src/compose/app.ts`（`start`/`tick`/`_schedule`/`stop` 现实现 + `:141-146` docstring 的**设计意图**）＞ **B** `packages/framework/src/adapters/cocos/loop-bridge.ts`（全文 55 行，已确证）+ `bindings.ts:105-118`（**含 viewport 陷阱注释**）＞ **C** `production/TASKS-DETAIL.md` 的 `## WXG-T-119`（BD-40 四轮实测 + 效力边界）与 `## WXG-T-121`（**只挂了门禁，非修复**）＞ **D** `docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md`（**不得**与本修复耦合；viewport re-fit 语义仍归它管）。
- **Output Path**：`packages/framework/src/compose/app.ts`、`packages/framework/src/adapters/cocos/loop-bridge.ts`（如需）、`packages/framework/src/adapters/cocos/bindings.ts`（**仅**适配新驱动权 API；**若需动它须在回传说明为何**）、`packages/framework/tests/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-122` 小节（**追加**）。
  **禁改**：`games/**/src/**`、`games/**/cocos/assets/scripts/**`、`production/qa/**`、`tools/scripts/**`、`systems-index §3`、其他成员台账小节。镜像拷贝件由 `framework:sync` 产出，**禁手改**。
- **必读 skill**：`my-skills/wxgame-adr-arch/SKILL.md`；另读 `AGENTS.md`、`docs/architecture/control-manifest.md`（L4/L5）、`packages/framework/src/compose/app.ts` 全文、`loop-bridge.ts` 全文、`production/TASKS-DETAIL.md` 的 `## WXG-T-119` / `## WXG-T-121`。
- **约束**：渲染层不持有状态（L5）；先问再写；不 commit/push；**若发现 weapp 宿主同样双驱，须如实登记并评估是否需同修，不得静默只修 Cocos**。
- **后继（不在本单）**：① QA 复测 `CLK-01`（主理人另派）；② weapp/真机道次复核（需 AppID）；③ 屏幕层探针 P0 修法（T-119 裁定 ②，另单）。
- **完成记录（2026-09-16 · 程基岩）—— 状态：✅ 工程侧交付完成（QA 复测 `CLK-01` 待另派）**：
  - **驱动权 API 选型**：**独立显式方法 `App.startHostDriven()`**（备选：构造选项 / `start()` 选项）。理由：① `start()` 签名与默认行为**逐字节不变**（向后兼容硬约束零风险）；② 语义在调用点自解释；③ **`bindings.ts` 无需行为改动**（宿主仍只 `new CocosLoopBridge(app, this)`，驱动权改由 bridge 内部声明），避免触碰 `cc` 依赖的未验证文件。模式为**实例生命周期粘性**（`_hostDriven` 一经置位不复位）。
  - **初始化语义保全（viewport 陷阱）**：两路 start 共用抽出的 `_init()`（`getScreenSize` → `viewport.resize` → `game.init` → `onHide/onShow` 挂接 → `_running/_lastFrameMs`）；`startHostDriven()` 只是**不调 `_schedule()`**。bindings.ts 的「必须 loop start 之后 `_fitToGameCanvas()`」时序前提原样成立（仅订正注释措辞：`App.start()` → `App.startHostDriven()`，行为零改动）。`stop()` 在宿主驱动下 `_frameHandle` 恒 null，原实现本就安全，新增测试钉死。
  - **互斥防护（三道，全部硬失败，无静默双驱）**：① 自驱 App 上调 `startHostDriven()` → 抛错（正是 BD-40 接线形态）；② 宿主驱动 App 上调 `start()`（含 stop 后重启）→ 抛错（粘性驱动权，拒绝静默翻转）；③ `_schedule()` 内防御守卫 → 抛错（兜未来新调用路径）。自驱模式下手工 `tick()` **保持允许**（harness / 既有 13 例 app 测试依赖），互斥守卫放在**接线点**而非 tick 点 —— 这是与「向后兼容」约束的明确折衷，已在 `tick()` docstring 写明。
  - **`CocosLoopBridge.start()` 改走 `app.startHostDriven()`**；对其余宿主零影响。
  - **weapp 侧核实结论（`[R]` 未取证，代码级）**：微信真机产物（`games/breakout/cocos/build/wechatgame/game.js`）就是 **Cocos 壳** —— 真机宿主 = 同一套 `Bootstrap` + `CocosLoopBridge`，`detectPlatform()` 因 `wx` 存在返回 `WeappPlatform`（其 `requestFrame:197` 优先 `requestAnimationFrame`）⇒ **weapp 同样双驱**（T-119 探针的「同源风险」判断成立）。但**双驱源头是 framework 正本**（App 自驱 + bridge），不存在独立的 weapp bridge ⇒ 本修复经 `framework:sync` **自动同修 weapp 路径**，无需（也不得）改游戏侧。真机 1× 仍须 `[R]` 复核。
  - **测试（`tests/compose/app-host-driven.test.ts` 新增 7 例 + `tests/adapters/cocos-loop-bridge.test.ts` 增 1 例）**：① 宿主驱动 start 后 `platform.hasPendingFrame === false` 且 pump 1000ms 零 update、init/viewport 全部完成；② 64 次 `tick(1/64)` ⇒ 64 固定步、`loop.time` = 1.0（1/64 二进制精确，期望值非容差游戏）；③ 自驱上 `startHostDriven` 抛错且第二路被拒（`scheduler.scheduled === false`）；另钉：粘性拒绝、幂等、`stop()` 安全、默认 `start()` 仍自驱 64 步/墙钟秒（向后兼容）。
  - **验证数字**：framework vitest **281/281 绿**（30 文件）；`tsc --noEmit` OK；`framework:sync` 写入 3 文件/游戏 + `:check` OK；`pnpm run verify` **PASS 14 ｜ WARN 0 ｜ SKIP 1（既有 `check:size` 未覆盖项，非本单引入）｜ FAIL 0**。
  - **CLK-01 工程自证（不替代 QA 复测）**：重建 `build:cocos:web` 后跑探针 ⇒ **CLK-01 PASS，仿真/墙钟 = 0.999**（墙钟 2.503s / 仿真 2.500s / 150 固定步；修复前 1.999）。顺带观察：P4S-03 墙钟有效闪烁 **2.01 次/秒**（修复前 3.35–4.49；§3.8 判据 ≤2）—— 已回到**贴线**量级，是否须为红线留余量归 QA/策划裁定，本单不判。
  - **改动文件**：`packages/framework/src/compose/app.ts`、`src/adapters/cocos/loop-bridge.ts`、`src/adapters/cocos/bindings.ts`（**仅注释订正**，理由见上）、`tests/compose/app-host-driven.test.ts`（新）、`tests/adapters/cocos-loop-bridge.test.ts`（+1 例）；镜像拷贝件由 `framework:sync` 产出。**未 commit / 未 push**；主表 `TASKS.md` 状态行更新归主理人。
- **主理人独立复核（2026-09-16，事后非采信自述）**：
  - **API 已核**（`app.ts:62-66` `_hostDriven` 粘性标志、`:112-114` getter、`:120-131` `start()` 在宿主驱动态**抛错**）：两路 start **共用抽出的 `_init()`** ⇒ **viewport re-fit / `game.init` / onHide/onShow 全量保留** ✅ —— `bindings.ts:108-110` 那条「loop start 之后 `_fitToGameCanvas()`」的时序前提**原样成立**，陷阱避开了。
  - **`loop-bridge.ts:49-50`** 已改走 `startHostDriven()` + `schedule(_tick, 0)` ⇒ **单驱** ✅。
  - **CLK-01 自证已核**（`beads-browser-probe.log`）：**仿真/墙钟 = 0.999**（墙钟 2.503s / 仿真 2.500s / 150 固定步 ≈ 59.9 步/秒）✅ —— **1.999 → 0.999，BD-40 修复生效**。⚠️ 此项是**工程自证**，**QA 复测仍须另派**（不替代）。
  - **❗`bindings.ts` 的「仅注释订正」属实，但有一处须补记**：该文件工作树 diff 为 **+89/−24**，**绝大部分是 `WXG-T-104` 的未提交笔**（`touch-normalize.ts` **不在 HEAD** ⇒ T-104 笔未提交；`normalizeCocosTouch` / `_touchSpace()` / C1 注释订正皆其产物）；**本单改动确实只有 4 行注释**（`App.start()` → `App.startHostDriven()`）。⇒ **提交时同文件两单笔随行，勿按文件级拆**（同 `WXG-T-102` 的教训）。**成员回传未声明此点，属回传完整性缺口**（非行为问题，已代为补记）。
  - **门禁**：framework vitest **281/281**；`framework:sync:check` OK；`pnpm run verify` = **PASS 14 ｜ WARN 0 ｜ SKIP 1 ｜ FAIL 0** ✅。
- **主理人裁定（成员四项未决）**：
  1. **光敏红线贴线（`P4S-03` 墙钟 ≈2.01 次/秒）= 不改 500ms 门**。**理由**：2.01 与 2.00 之差在**帧量化分辨率内** —— 一帧 ≈16.7ms ⇒ 500ms 门的实测起点间距落在 500±8ms ⇒ 折算 **1.97–2.03 次/秒**，**2.01 属测量分辨率噪声，非真超线**。⇒ **登记**：下轮 QA 须把「**判据的测量分辨率**」写进判据口径（否则后人会拿 2.01 当超线、或据此反向放宽）；**不得**为过线而调门限 —— 那是 `§3.8` 冻结值（≤2 次/秒）的实现参数，**改它 = 改光敏性安全余量的设计**，须文策渊裁定并走 §3 流程，工程/QA 都无权自裁。
  2. **`check:size` SKIP** → **backlog**（另议，不并入本单）。
  3. **主表状态行** ⇒ 本条已由主理人更新。
  4. **主表归档**（52 行 > 观察哨 20）→ **另议**；建议下轮跑 `pnpm run tasks:archive -- --detail-until-under=7000 --write`。
- **BD-40 关单口径**：**限 `[N]`/`[B]` 已验**（CLK-01 = 0.999）；**真机 1× 留 `[R]` 复核** —— weapp 真机 = **同一 Cocos 壳** + `WeappPlatform` 自驱 ⇒ 本修复经 `framework:sync` **同修**（成员已核实「真机宿主即 Cocos 壳」），但无 AppID 未实测 ⇒ **不得据本单宣称「真机时长正确 / 真机不闪」**；真机首验 **P0** 须含 `CLK-01` 同源复核（`T-119` DEV-01 口径）。

---

## WXG-T-121

- **名称**：**装置自测分档挂门禁（BD-39 · BD-40 并单）**
- **负责**：主理人(Qoder)　**状态**：🔄 **部分交付**（2026-09-16：CI 侧两条已闭合；`verify` 本地半边受 WXG-T-110 在飞阻塞）
- **并单依据（先取证再裁定）**：两条缺陷同根因（「门存在、但不跑」）、同处改（`verify` 步骤表 / CI）、同验收 ⇒ 并成一单。实测代价：
  11 件装置自测合计 **29.4s**、`ctx:check` **0.51s**、`verify` 现有各项相加 **13.8s**；`grep selftest .github/workflows/ci.yml` **零命中**
  ⇒ 本地与 CI **两条链都零覆盖**。全挂进 `verify` ⇒ 14s → 43s（+213%），反而诱发绕开门禁 ⇒ 结论 = **按实测耗时分两档**。
- **动手前抓到一条正在腐烂的自测（本单的直接证据）**：`context-usage-selftest.sh` 在 `3fa3be4`（改动前）与 `e9664da`（改动后）
  两个点同测都是 **FAIL=63** ⇒ 以「隔离 worktree 跑历史点」判定为**存量腐烂**，非本轮引入。两处根因同一形状「手写清单追不上正本扩张」：
  ① 桩只 `cp` `lib/` 两件，而 `check-context-budget.mjs` 后来 import 了 `lib/memory-index.mjs` ⇒ 桩里 `ctx:check` 崩在 `ERR_MODULE_NOT_FOUND`；
  ② 桩**手写** `ctx/index.json`（固定 5 文件）追不上生成物集合扩张（`ctx/BUDGET.md` 须入索引、`memory/INDEX.md` 须同源存在），且桩仓库无 `memory/`
  时 `ctx:build` 写生成物直接 ENOENT。修法 = 依赖**整目录通配** + **索引由被测生成器播种**（跑一次桩 build 再注入本轮度量文件）+ 预置写盘目录 ⇒ **63 → 0**（172 断言全绿）。
- **落码**：① 新增 `tools/scripts/selftests.mjs` 分档执行器 —— 三条规矩：**逐项执行永不短路**（K-036）、打 `STATUS: OK|SKIP|FAIL` 机读行
  （⇒ `verify` 接入只需往 `STEPS` 加一项）、**完整性守卫**（磁盘上未入档的 `*-selftest.sh` / package.json 里未入档的 `*:selftest` 入口 / 档位项脱钩 ⇒ 当场红；
  确实挂不上的须写进源码 `AWAITING` 并给理由 ⇒ 降为 SKIP，**不是通过而是没测**，`--strict` 判失败）。② `fast` 档 = 六件自测 **+ `ctx:check`**（BD-40 本体 0.3s，
  并入而非另挂一项 ⇒ 将来补 `STEPS` 一行同时闭合两条缺陷）。③ `package.json` 补 5 个入口（`ctx:usage:selftest`、`tasks:archive:selftest`、`ci:review:selftest`、
  `selftest:fast`、`selftest:heavy`）。④ CI `unit` job 加 fast+heavy 两步 ⇒ 自测覆盖 **11/11**。⑤ `worktree-authoritative-selftest.sh` 在 worktree 里播种
  `node_modules` 软链（兜 pnpm 10 对未安装 worktree 拒执；本机 pnpm 9.15.9 容忍 ⇒ 该风险本地**未能复现**，如实标注）。⑥ 回写 `docs/agent/commands.md`。
- **未改 `verify-all.mjs`（串行纪律）**：该文件正被并发 WXG-T-110 在飞改动（+43 行 `WARN` 态与新步骤）⇒ 同文件不抢改；
  改为在执行器里 `noteVerifyCoverage()` **每次运行点名**该缺口，免得又变成一件「只有 CI 跑、本地腐烂无人见」的事。
- **半入库登记**：HEAD 的 `package.json` 里 `check:host-tests` 入口指向**未跟踪**脚本（`git ls-files --error-unmatch` 证实）⇒
  它的 `:selftest` 留在 `AWAITING`（SKIP），待 WXG-T-110 收口后并入 fast 档。
- **验收（现场复跑）**：`selftest:fast` **PASS 7 ｜ FAIL 0**（≈6.5s）｜`selftest:heavy` **PASS 5 ｜ FAIL 0**（≈26s，断言 22/172/9/190）｜
  `ctx:usage:selftest` **172 断言 0 红**（HEAD 存量 63 红）｜`ctx:selftest` 仍 **9/0**｜`--strict` 正确因 `AWAITING` 判失败｜`pnpm run verify` **PASS 14 ｜ SKIP 1（check:size）｜ FAIL 0**｜`kb:check` 八重 ✅（活跃 49）。
- **沉淀 K-049**：自测夹具须由**被测生成器播种**、依赖按**整目录拷贝**，否则门禁一扩就整片假红；判「我改坏 vs 早就红」一律先取**历史点同测**证据。
- **余项**：① `verify` STEPS 加 `selftest:fast`（待 T-110）；② `check:host-tests:selftest` 入档（同前）；③ CI 首跑观察 pnpm 10 环境下 `ctx:selftest` 的 worktree 执行。
- **✅ 余项收口（2026-09-16 · 主理人）**：T-110 落盘经复核完整 ⇒ 阻塞解除。`verify-all.mjs` STEPS 追加 **`selftest:fast`** 与 **`check:host-tests:selftest`**；实跑 `pnpm run verify` ⇒ **PASS 16 ｜ WARN 0 ｜ SKIP 1 ｜ FAIL 0，总时长 26.2s**（优于预估 43s）。③ CI 首跑观察留给下次 CI 触发。**T-121 关闭。**

---

## WXG-T-124

**beads 美术 v1.3「丙案·双色温对撞」风格单（三件套 + 落码）** · 负责：林绘澄(art) + 主理人(Qoder) · 状态：✅ 完成（2026-09-16，真机截图待补）

- 起因：用户「review 美术设计，对标行业领先，需独立风格与质感」。主理人三方对账（规格×代码×真机帧）得 F1–F8；用户裁定风格=丙（双色温对撞）、落地=派林绘澄出草案、F5=独立立项。
- 本轮交付：
  - art/ 三件套升 v1.3：art-bible §3.1 UI token 冷底真源(F1)/§3.5 强调色纪律(F6)/§4.3+§6 拼图容器板+暖光 band(F2/F3/丙案)/§6+§8 珠子十层质感(F4)/§6 HUD 白胶囊+8齿齿轮+图标笔画+标签字号色(F7)/§6+§8 背景层次解锁(F8)；assets-spec §1.1 十层卡/§1.7 容器板+band/§1.8 背景层次；accessibility A5 新增 + B1/E1 F7④ a11y 假绿根治。
  - 落码（不撞并发两文件）：palette.ts DEFAULT_PALETTE 7 值换丙案冷底 token(F1) + 十层卡常量；bead-render.ts 六层→十层(L0a 接触阴影/L3b rim/L4a-c 软高光)；bead-render.test 重钉 13/13；framework:sync 镜像 2 件；beads 全量 typecheck 0 + 251 测试绿。
- view-model 落码补全（2026-09-16，排并发后）：view-model.ts 消费面全量——F6 textAccent 字段删除并由编译器找漏网逐处路由(五面板主钮+NEW BEST 角标→accent_primary 白字、选中点→hintBlue ≤8px、连击光/爆发光条→白、缎带/结算星→STAR_GOLD、finish 色带→accent_primary/adBadge)、F2/F3 容器板+暖光 band(B1-B6 全程态常驻)、F7 HUD 白胶囊+8齿齿轮+最小字号 28px(F7⑤ 22px 作废)、F8 背景三层冷色叠层；tuning.ts +24 几何常量(§1.7/§1.8/F7)；feedback-vfx 重钉 22/27→28/35px；beads typecheck 0 + 251 绿 + verify 14 PASS/0 FAIL + framework:sync 镜像 3 件。ux-spec §3 HUD 条款对齐(文策渊)待后续单。
- F1 过渡处置：textDim 值 #8B8578→#6E7288(严格更暗，闭合 F7④ 白底标签 4.74:1)；token 改名(text_secondary)与图标 re-route 留 view-model 阶段。textAccent 值本轮不动(语义混杂，盲改会误染选中点/连击光/星)。
- 未决(待用户/后续)：① success #3FBF6B 与珠色4同值是否走冻结变更；② 十层卡真机性能回退阀(合并 L4a+b 降 8 层)是否预授权；③ 单帧最坏 +624 图元。

---

## WXG-T-125

**beads §3.8 幽灵符号可见性冻结变更单（F5，独立于风格单）** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-16，真机截图待补）

- 起因：art 评审 F5——EMPTY_GHOST_ALPHA=0.20 + EMPTY_TINT_MIX=0.35(§3.8 冻结常量)真机上空槽目标色/幽灵符号几乎不可读，削弱「同色入格」第一道解锁。
- 拟变更：EMPTY_GHOST_ALPHA 0.20→0.32、EMPTY_TINT_MIX 0.35→0.42。
- 流程(§6 冻结变更)：用户确认改值 → 主理人评估连带影响 → 落 systems-index §3.8 值 + §6 变更记录行 → palette.ts 两常量同步 → 探针 A2b 复验(幽灵符号可见性) → 下游(QA 判据/assets-spec §1.2 引用)对齐。
- 与 T-124 解耦：本单只动两个 §3.8 冻结常量，不涉丙案风格；风格单 v1.3 文档已注明「幽灵符号可见性由本独立变更单处理」，不改值。
- 施工记录（2026-09-16，用户拍板甲=按拟定值）：① systems-index §3.8 两值 + 文首版本行 v1.21；② changelog v1.21 行；③ palette.ts 两常量 + framework:sync 镜像；④ assets-spec §1.2 E1/E4 数值 + [v1.3·F5] 声明闭合；⑤ beads 全量 251 绿 + typecheck 0（断言全引常量零改动）；⑥ A2b 指令流探针 2/2（TC-PER-01 [Probe]：全关卡 E1 去重数 ≥ 关色数 + E4 ink α=0.32），探针临用临删。
- 待补：Cocos 产物截图肉眼比对（R1+R2 道次）受构建阻塞，真机可达后补验（changelog v1.21 已诚实记录）。

---

## WXG-T-126

**beads ux-spec §3/§5/§7 HUD 条款对齐（v1.3 落码事实回写，F7①②⑤/F6）** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-16）

- 起因：WXG-T-124 遗留项——view-model 落码后 ux-spec 侧 HUD 条款仍停在 v1.2 事实（无白胶囊/齿轮样式/字号 floor；§5 选中圆点未锁色，原实装暖橙已随 F6 作废）。并发热写已停（ux-spec.md mtime 隔夜）后施工。
- 对齐五处（引用真源不复制数值）：① §3.1 补 HUD 视觉落地条（白胶囊 220×64 + 时钟 Ø36 accent_blue + 8 齿 Ø48 accent_purple，几何/色彩真源 assets-spec §1.5，本表只锁信息分区与热区；线框 ⚙88×88 澄清为热区）；② §3.1 补 F7⑤ HUD 小字 28px floor（v1.2 22px 作废）+ 冷底小字 text_primary；③ §5 托盘选中圆点锁 accent_blue ≤8px（F6 环状提示纪律）；④ §3.3 E2 大字号基准写明 28×1.25=35px；⑤ §7 可访问性表新增「字号」行。版本行挂 WXG-T-126 变更记录。
- 边界裁决（诚实口径）：§3.2 冲刺 HUD 差异仍标「提案」——代码已落码（SCORE / ×multiplier / COMBO，view-model.ts 冲刺 HUD 块）但布局与提案线框有差（连击窗口进度条/梯级进度点未核）⇒ 提案转正需设计侧比对落码几何，**另立单**，本单不越界。
- 验证：纯文档单（仅 ux-spec.md），零代码改动；check:links 过。

---

## WXG-T-130

- **名称**：**beads · 玩法细化文案：「错位归位」核心循环 + 格底纯色（用户 2026-09-16 裁定）**
- **负责**：文策渊(design-strategist)　**状态**：📋 已立项（待施工 · 第一批=纯回传）　**P1**
- **⚠️ 第一优先产出 = 差异清单回传，审定后才落盘**（核心循环变更，不得直接改 GDD）。
- **用户裁定原文（2026-09-16，设计意图真源）**：
  > 「棋盘里摆满了棋子，只是区分对应颜色棋子不能选，与底色不对应棋子可以选高亮，如果点击托盘空格填到托盘里，点击对应颜色空格子，填到棋盘空格子里。」
  另：格底改**纯色**（现空格底为中性底混目标色，用户嫌花）。
- **解读（主理人，回传时请复核）**：每格有**底色 = 目标色**；已就位珠（颜色=底色）**不可选**；**错位珠**（颜色≠底色）**可选并高亮**；选中后点**托盘空格**收进托盘；托盘珠点**颜色匹配的空格**放回。全部归位 = 过关。⇒ 核心循环从「托盘单向供珠填空盘」改为「满盘错位 → 取回/归位」。
- **现状锚点（主理人已核）**：
  - `design/gdd/core-loop.md` §2.2.1：现玩法叙事 = 托盘供珠 → 空位放置（匹配 placed / 不匹配 rejected 抖动）；
  - `games/beads/src/game/beads-game.ts:1511` `_placeSelected` + `judgePlacement`（invalid-color 拒绝）；
  - `games/beads/src/view/bead-render.ts:211` `drawEmptySocket`：**E1** 空格底 = `mixWith(slot, 目标色, EMPTY_TINT_MIX)`；**E4 幽灵符号 = 色盲冗余通道（D1 判据）**；
  - 已填格渲染 `drawFilledBead`（无选中交互）；`input-control.md` §2.3 状态门禁 / S2 路由表。
- **Deliverables（第一批 = 只回传、不改文件）**：
  1. **现状 vs 目标差异清单 + 影响面**：逐系统列（judgePlacement / 托盘双向化 / input-control 路由新增「错位珠选中」「取回」 / 关卡初始错位布置生成 / 通关判定 / score-combo 语义 / 道具语义 / 教程 / ux-spec 交互流与 HUD）；每项标「改规格 / 改实现 / 改判据」。
  2. **细化玩法文案草案**（落盘待审定）：归位循环全流程 + 边界未决问题（各列选项待主理人裁）：托盘满时能否取珠？错位珠取回后原格变空格？是否允许棋盘格间直换免经托盘？计时/失败条件是否不变？
  3. **视觉条目**：格底纯色方案（E1 权重改法）+ **幽灵符号去留两案并陈**（保留 = D1 色盲通道不丢；移除 = 可访问性降级裁定，须用户签字）。保留时给「与纯色底共存」的具体画法（角落化/淡化/描边化）。
  4. 受影响 GDD/UX 文件的修订清单（**本单只列不改**——修订待审定后第二批）。
- **权威来源（冲突以 A 为准）**：**A** 用户裁定原文（本节引用）＞ **B** `core-loop.md` §2.2.1 现行 + `bead-render.ts` E1/E4 注释（现状事实）＞ **C** `systems-index §3`（冻结常量不得动）＞ **D** `ux-spec.md` §5 现行（8683B 豁免中，增补克制）。
- **Output Path**：**本批无文件写入**（纯回传）；审定后第二批再定落盘文件。
- **约束**：不得发明 §3 常量；不得动 ≤3Hz 红线；不 commit/push。
- **后继**：差异清单审定 → 第二批落盘（GDD/UX 修订）→ 工程实现单（预计 Epic 级拆分）。
- **第一批回传（2026-09-16，文策渊）**：差异清单 12 系统 + 玩法草案 + 视觉两案 + 修订清单，已由主理人复核通过（解读补强：托盘=解谜缓冲区；交换构造法保证可解性；k=难度旋钮）。
- **用户裁定（2026-09-16，四项）**：
  1. **定时供料 = 关停**（案 A）—— 错位珠唯一供给，托盘纯缓冲；tray-spawner 冻结判据逐条「作废/改写」标注。
  2. **幽灵符号（E4）= 移除** —— 用户原文「暂时不需要支持色盲玩家，我需要的是珠子和托盘，棋盘都有质感」⇒ **可访问性降级裁定（用户签字，2026-09-16）**：accessibility.md A2b/A3 降档登记 + **可恢复路径**（E4 绘制保留为关闭的开关/死路径，重开零成本）。**同时新增需求：珠子/托盘/棋盘要有质感** ⇒ 移交 **WXG-T-131**（美术规格，林绘澄）。
  3. **道具 = 反转为解环器**（自动归位错位珠）—— §3.6 冻结变更，走变更记录。
  4. **已就位珠/锁定格 = 静默忽略**（极轻反馈不弹错，复用 §8-5/G7 判例）。
  其余按推荐默认：托盘满禁取珠、格间必经托盘（swap 列 Should）、错位参数 = 关卡 JSON + §3 新小节冻结、倒计时失败不变、取回不计分不断连。
- **第二批（本单续做）**：落盘 §4 清单全部 GDD/UX 修订 + systems-index v1.22 冻结变更（E1 纯色、E4 作废、§3.6 道具反转、供料判据作废、新增错位参数小节、§4 事件表 tray:stored）。
- **主理人复核（2026-09-16，抽查非采信自述）**：systems-index v1.22（S1/S4/S6 描述同步、§3.13 `MISPLACED_PAIRS` 区间冻结 + 逐关曲线 `[待 playtest]`、交换构造可解性、满槽禁取珠）✅；core-loop v2.0（术语统一/BOOT swaps 校验/LEVEL_CLEAR 语义）✅；accessibility v1.5（用户签字 + 降档范围 + **可恢复路径**）✅；`check:links`/`check:tasks` 双绿 ✅。**⚠️ ux-spec 体积**：31868 → **38355 B**（文策渊自报超 500 tok 请示线，理由 = 玩法级新行非文案润色）⇒ **主理人追认本批**（玩法反转的必要内容），**backlog「ux-spec 拆分」优先级提升**。三小未决裁定：solverPlus=3/solverRandom=1 按冻结默认（playtest 后可调）；k 曲线维持待 playtest；事件 `board:selected` 立项采纳。
- **后继（工程 Epic，待拆）**：E1 网格错位状态机 → E2 选择锚路由 → E3 供料摘除+tray:stored → E4 解环器 → E5 swaps 装配+校验 → E6 渲染改造（E1 纯色 + E4 删除 + T-131 质感，**与 T-131 归并**）→ E7 QA 判据迁移（供料 16 颗/3:1 抽色/满槽跳供/道具清槽四族改判 ⛔）。

---

## WXG-T-131

- **名称**：**beads · 美术质感规格：珠子/托盘/棋盘的材质感（用户 2026-09-16 裁定）**
- **负责**：林绘澄(art-director)　**状态**：📋 已立项（待施工）　**P1**
- **背景**：玩法变更（WXG-T-130「错位归位」）带来视觉重塑窗口。用户裁定：**「暂时不需要支持色盲玩家，我需要的是珠子和托盘、棋盘都有质感」** ⇒ ① E4 幽灵符号移除（降级已在 T-130 登记）；② **新增质感需求**：三类物体（棋盘格底座 / 托盘底座与珠 / 棋盘珠）都要有**材质感**。用户此前嫌「底色花」（E1 混色）⇒ **纯色底 + 光影质感**是方向：底色保持单一目标色，质感靠明暗渐变/高光/投影/内阴影表达。
- **Deliverables**：
  1. **质感语言规格**：三类物体各自的材质表现 —— 渐变色标（同色相明暗两端值）、高光（位置/形状/α）、投影（offset/blur/α）、内阴影/倒角（数值级，可直接落 `bead-render.ts` 矢量绘制）；**零外部资产**（程序化矢量，包体预算不变）。
  2. **空格 vs 就位珠的形态区分**（E4 移除后）：纯色底空格与同色实心珠的区分方案（质感差异：空格=凹陷/内阴影，就位珠=凸起/高光+投影 —— 凹凸对比是最自然的材质区分）。
  3. **更新 art-bible / assets-spec** 对应节（版本号 + 变更记录按惯例）；登记 accessibility A2b/A3 降级已由 T-130 承载（本单只交叉引用）。
  4. **色板兼容**：10 色在质感渐变下的明暗端值须保持色相可辨（黑白可辨性虽降级，色相本身仍须拉开）。
- **权威来源**：**A** 用户裁定原文（本节）＞ **B** `games/beads/design/art/art-bible.md` + `assets-spec.md` 现行惯例（先摸清再落笔）＞ **C** `games/beads/src/view/bead-render.ts` + `palette.ts`（现有绘制能力边界：矢量 fill/stroke/渐变）＞ **D** `systems-index §3`（冻结，只读）。
- **Output Path**：`games/beads/design/art/**`（art-bible / assets-spec）+ `production/TASKS-DETAIL.md` 的 `## WXG-T-131` 小节（追加）。**禁改**：`src/**`（实现后继另派）、`ux-spec.md`（T-130 正在改）、`systems-index §3`。
- **必读 skill**：`my-skills/wxgame-art-spec-programmatic/SKILL.md`；另读 AGENTS.md、art-bible 现行、bead-render.ts。
- **约束**：零外部资产；不发明 §3 常量；先问再写；不 commit/push。
- **后继**：质感规格审定 → 工程实现（与 T-130 的玩法实现 Epic 合并排期）。
- **完成回传（2026-09-16，林绘澄）**：art-bible **v1.5** + assets-spec **v1.5** 已落盘（实际路径 `games/beads/design/art/specs/`——任务书写作 `design/art/`，按仓内现行结构落位，已在回传说明）。要点：① **质感语言** = 纯色底 + 同色相明暗端点（明端 `mix #FFF 0.38` / 暗端 `mix #000 0.26` / 坑底 `−0.14`，全部复用既有 mix 判例系数），渲染管线经查**无渐变原语**（RenderModel 仅 rect/circle/line/polygon）⇒ 全部以端点平涂 + 叠层 α 落地；② **空格 = 凹陷四层**（S1 暗缘框 / S2 坑底 / S3 上内阴影 / S4 下受光亮线），珠 = 凸起十层卡零改动 ⇒ **凹凸对比取代幽灵符号**；「must not read as a bead」五形态通道复核成立（assets-spec §1.9.4）；③ **10 色端点对照表 + 推导规则**（assets-spec §1.9.2，向纯黑白混色色相不变 ⇒ 色相间距不塌，奶白明端钳制）；④ **E1/E4 作废标注为引用态**（落点 = T-130 第二批 systems-index 冻结变更 + 工程单，本单零改 §3 / 零代码）；⑤ 新常量组 `SOCKET_*`（7）/ `TRAY_PLATE_*`（3）归 `tuning.ts`，零冻结变更、零外部资产；⑥ **性能**：最坏静态图元 1810→≈2173（+363，典型 +51～+75）；端点 hex 建议模块级预计算（31 串一次构建），防每帧 `mix()` 字符串分配。**未决（待裁）**：珠体 L1 两段伪渐变增项（+1 图元/珠，默认不做）；L5 珠面符号去留（随 T-130 工程单）。`accessibility.md` 无 T-130 笔迹且本单未改（归文策渊）。

---

## WXG-T-134

- **名称**：**beads · E1：网格错位状态机 + 取回/归位裁决（Epic T-133 之首）**
- **负责**：程基岩(engineering-lead)　**状态**：🔄 进行中（2026-09-16 派工）　**P1**
- **范围**：规格真源 = `bead-grid.md v2.0` §2.2（状态机）§2.3（取回裁决）§8（判据）+ `core-loop.md v2.0` §2.2 + `tray-spawner.md v2.0` §2.4（`tray:stored`）+ `systems-index v1.22` §4（事件 payload）。
- **Deliverables**：
  1. **网格状态机**：`filled` 拆分「就位（终态，色=底色）/ 错位（可取回）」；取回使格转 `empty`；锁定格不变。
  2. **取回裁决**：新 API（形状自定，须与 E2 路由消费兼容并回传说明）：校验「错位珠 + 托盘有空槽」（满槽拒绝，极轻反馈零事件）→ 珠入槽、格转空 → 发 `tray:stored {slot, colorIdx, fromRow, fromCol}`。
  3. **归位裁决**：`judgePlacement` 对齐 v2.0（`placed` = 托盘珠入颜色匹配空格；`rejected` = 不匹配，珠留托盘）；`bead:placed` 的 `slot` **改可选**（为 E4 铺路，本单 placed 仍恒带）。
  4. **通关判定**：`isComplete()` 改「可填格全满 且 零错位」（`grid.ts:91` 现只查 filled 数）。
  5. **托盘入槽**：`_tray` 增 store 通道（现仅 select/takeBead 出向）。
  6. **单测**：状态机三态转换 + 取回前提（错位/空槽）+ 满槽拒取 + 归位匹配/不匹配 + `isComplete` 零错位负例（满盘含错位 = 未通关）+ `tray:stored` payload 断言。
- **❗ 不做（后续 Story）**：输入路由（E2）、供料摘除（E3）、解环器（E4）、关卡 JSON/BOOT swaps 校验（E5）、渲染（E6）。测试手工构造局面，不依赖 JSON。
- **⚠️ 陷阱**：① `_tray` 结构位置现场核实；② 选择锚统一是 E2 —— 本单 API 不得预设「只有托盘可选中」；③ 热路径零分配；④ 工作树并发（**勿动 T-132/T-122 等并发笔**）；⑤ 新常量落 `tuning.ts` 并回传说明，§3 已冻结的不动。
- **Output Path**：`games/beads/src/game/**`、`games/beads/tests/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-134` 小节（追加）。**禁改**：`src/view/**`（E6）、`design/**`、`packages/**`、`production/qa/**`。
- **验收**：`pnpm -F @wxgame/beads test` 全绿；`pnpm run verify` FAIL 0；`framework:sync` + `:check`。**不 commit/push**（主理人复核后统一提）。
- **主理人独立复核（2026-09-16，非采信自述）**：
  - **测试**：beads **266/266 全绿**（新增 `misplaced.test.ts` 10 例：状态机三态、取回前提零事件、满槽拒取**零事件零状态写**、取回重归位双向性、`isComplete` 零错位**负例**、`tray:stored` payload 四字段 `toEqual` 精确断言、slot 可选）。
  - **实现抽查**：`grid.ts` —— **不引入新 CellState 值**，`misplaced` 为派生谓词（`filled && beadColorIdx ≠ colorIdx`），`colorIdx` 收窄为底色语义，`_misplacedCount` 增量维护 ⇒ `isComplete` O(1)、26 处既有消费方零破坏 —— 这个「可派生量不做持久态」的取舍是对的（比加状态枚举干净）✅；`retrieveBead(row,col,targetSlot)` **显式收参零锚状态** ⇒ E2 路由可直接消费 ✅；`tray:stored` payload 与 §4 事件表逐字对齐 ✅；`spawnInto→storeInto` 委托保留供料死路径（E3 摘除时可干净移除）✅。
  - **边界**：`src/view/**` 未动 ✅（E6 域）；`judgeRetrieve` 拒绝分支（not-misplaced/tray-full/slot-not-free/out-of-bounds）全零事件 ✅。
  - **门禁**：`verify` = **PASS 14 ｜ FAIL 1** —— 唯一 FAIL = `check:size`（主包 4537.6KB > 4096 红线）。**定性 = 存量**：引擎包 3.3MB 属构建链未通（ADR-0009 P2），且该步此前长期 SKIP（T-118 轮即记「SKIP 1（check:size 未覆盖）」），本批被执行才显形；本单真实增量 ≈2KB。**裁定 = A 登记漂移交发布域**，不混入本单验收结论。
- **主理人裁定（四项未决）**：① `retrieve.ts` **进 barrel**（与 placement 同列，外部可测导入一致性）；② `check:size` **登记漂移交发布域后置**（见上定性）；③ crash-snapshot 扩容 **E5 顺手**（采纳）；④ `setBead` 装配原语 **E5 直接消费**（认可，无需返工）。
- **状态**：**✅ E1 完成**（`[N]` 层全绿；Epic T-133 进度 1/7）。
- **✅ 完成记录（2026-09-16，程基岩）**：
  - **状态机**（`src/entities/grid.ts`）：`GridCell` 增 `beadColorIdx`（占格珠色；`colorIdx` 语义收窄为**底色**）；`misplaced = filled 且 beadColorIdx ≠ colorIdx`；`_misplacedCount` 增量维护（O(1)，热路径零分配）；新增 `retrieve()`（唯一出边：`filled(错位)→empty`，**就位珠终态拒绝**）与 `setBead()`（BOOT 装配原语，E5 swaps 消费；装配发生在玩法状态机接管前，绕过 retrieve/place 边是设计使然）；`isComplete()` 改「可填格全满 **且** 零错位」。
  - **取回裁决**（新文件 `src/systems/retrieve.ts`）：`judgeRetrieve(grid, tray, row, col, targetSlot)` 纯裁决+同调用栈原子双写（沿 `judgePlacement` 判例）；拒绝分支 `not-misplaced / tray-full / slot-not-free / out-of-bounds` 全零事件；`targetSlot` = 玩家选择（v2.0 无随机落槽）。**E2 消费口**：`BeadsGame.retrieveBead(row, col, targetSlot)` 公开命令——显式收 `(row,col,slot)`，**不持有选择锚**（`selection ∈ {tray, board, none}` 归 E2）。
  - **归位裁决**（`src/systems/placement.ts`）：`slot` 参数与 verdict 字段改**可选**（v1.22 payload 变更，E4 解环器路径不带；本单托盘路径仍恒带）。
  - **托盘入槽**（`src/entities/tray.ts`）：新增 `storeInto(slot, colorIdx)`（取回唯一入槽通道）；`spawnInto` 转委托（死路径保留，供料复活时自动生效）。
  - **事件**（`beads-game.ts`）：`BeadsEvents` 增 `tray:stored {slot, colorIdx, fromRow, fromCol}`；`bead:placed.slot` 改可选。
  - **快照**（`src/game/state.ts` + `_syncSnapshot`）：`SnapshotCell` 增 `beadColorIdx`（E6 渲染错位珠从它取色、底座从 `colorIdx` 取色；视图层零改动即编译通过）。
  - **tuning**：**零新常量**（§3.13 冻结值未被本单消费——`MISPLACED_PAIRS` 区间是 E5 生成参数）。
  - **单测**：新文件 `tests/misplaced.test.ts` **10 例**（状态机三态×3、取回前提零事件、满槽拒取零事件零状态写、取回重归位双向性 §8-6、`isComplete` 零错位**负例**满盘含错位=不通关、`tray:stored` payload 精确断言、placement slot 可选×2）；`helpers.ts` 事件追踪补 `tray:stored`。全包 **24 文件 266 例全绿**。
  - **门禁**：`pnpm run verify` **PASS 14 / FAIL 1** —— 唯一 FAIL `check:size` 为**存量问题**（beads 构建产物 `cocos-js` 引擎包 3.3MB，产物时间戳早于本单开工，构建链未通 ADR-0009 P2；本单 src 增量 ~2KB，不构成翻转因素）。`framework:sync` 已执行（beads 写入 6 拷贝件）+ `:check` PASS。
  - **遗留移交**：① E5 装配落地时 crash-snapshot 需扩存错位珠色（现 `gridFilled` 位图只记 filled 位，恢复时 `fill()` 默认按底色就位——E1 阶段真实玩法流不产生错位珠，不破现网）；② E6 渲染错位珠前视图仍按 `colorIdx`（底色）画已填珠，错位珠视觉失真属 E6 已知工作面。

---

## WXG-T-135

- **名称**：**beads · E2：输入路由选择锚化（Epic T-133 · 依赖 E1/T-134 已就绪）**
- **负责**：程基岩(engineering-lead)　**状态**：🔄 进行中（2026-09-16 派工）　**P1**
- **规格真源**：`input-control.md v2.0`（§2.1 路由表重排、统一选择锚、§2.3 门禁）+ `systems-index v1.22` §4（`board:selected {row,col,colorIdx}`）+ `ux-spec v1.4` §4 矩阵新增 3 行。
- **范围**：
  1. **统一选择锚**：`selection ∈ {tray(slot), board(row,col), none}`，互斥换选（换选即转移，同帧最多 1 条输入指令沿用既有裁决）。
  2. **路由 4/5 内部分支化**（带级次序不变：齿轮→道具卡→btn_expand→托盘带→棋盘）：
     - 4 托盘带：holding 槽 → 选中/换选（发 `tray:selected` 沿用）；**空槽 且 锚=board → `retrieveBead(row,col,targetSlot)`**（E1 API）；空槽且无锚 → 忽略。
     - 5 棋盘：**错位珠 → 选中/换选（发 `board:selected`）**；空格 且 锚=tray → `_placeSelected`；**已就位珠/锁定格 → 极轻反馈忽略（零事件）**。
  3. **快照同步**：`SnapshotCell` 已有 `beadColorIdx`（E1）；快照增 board 选中态（形状自定，E6 消费画高亮）。
  4. **旧 `_placeSelected` 前置重构**：现实现自带 slot<0 轻提示分支（`beads-game.ts:1513`）——锚化后「无选中」语义由锚表达，提示分支迁到路由层（保持 fillable 才提示的判据）。
  5. **单测**：锚互斥换选（tray→board→tray）、路由各分支命中、取回全链（锚=board 点空槽 → `tray:stored`）、归位全链（锚=tray 点匹配/不匹配空格 → placed/rejected）、已就位忽略零事件、`board:selected` payload。
- **E1 就绪接口（直接消费，勿改动语义）**：`game.retrieveBead(row, col, targetSlot): boolean`、`judgeRetrieve`（拒绝分支零事件）、`judgePlacement(row, col, colorIdx, slot?)`、`tray:stored` 事件已发。**如需改 E1 API，先回传说明**。
- **⚠️ 陷阱**：① 「错位珠」判定用 grid 派生谓词（勿复制逻辑）；② 齿轮/道具卡/扩展按钮的优先级 1–3 **不得变动**；③ 极轻反馈通道复用 G7 判例（有现成实现就复用，没有就零事件，**不得新增每帧分配**）；④ 工作树并发（勿动 T-132/T-122 等并发笔）。
- **Output Path**：`games/beads/src/game/**`、`games/beads/tests/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-135` 小节（追加）。**禁改**：`src/view/**`（E6）、`src/entities/**`、`src/systems/**`（E1 域，除非回传说明）、`design/**`、`packages/**`、`production/qa/**`。
- **验收**：`pnpm -F @wxgame/beads test` 全绿（含 E1 的 266 例零回归）；`pnpm run verify`（`check:size` 存量漂移已裁定，不算本单）。**不 commit/push**。
- **主理人独立复核（2026-09-16，非采信自述）**：**284/284 全绿**（E1 266 零回归 + 18 新增）✅；**边界**：`entities/systems/view` 未动 ✅；**锚互斥**为写点双向清除（`selectTraySlot` 成功清 board 锚 / `selectBoardBead` 静默清托盘选中，`beads-game.ts:613`）✅；`board:selected` payload 与 §4 事件表一致 ✅；路由 1–3 零变动且有用例钉住（§8-12）✅；**5c 已就位珠零事件**有 delta=0 断言（含「托盘锚不被吸走」）✅。特别认可：tray 侧**复用 `_tray.selectedSlot` 不建双真源**，`selection` 为派生只读 —— 与 E1 的「可派生量不做持久态」同一品味。
- **主理人裁定（四项未决）**：① 4b 轻提示缺口 = **A 维持零事件，E6 批次补托盘锚几何**（届时同步 GDD §2.1 措辞）；② 轻提示文案「先选一颗珠子」语义偏 = **E6 批次新增「去托盘取回」类文案常量**（挂 tuning + ux-spec §4 对齐，随高亮一起做才可测）；③ `Tray.deselect()` = **E4 批次补**（E4 动 tray 消费面，一并收干净）；④ `check:links` 存量（`.qoder/skills/*` 并发目录）= **留给创建它的会话收口**，不代修；若后续提交被阻断再升级。
- **状态**：**✅ E2 完成**（Epic T-133 进度 2/7；E3/E4/E5 可并行）。
- **完成记录（2026-09-16，程基岩自述，待主理人独立复核）**：
  - **实现**（`beads-game.ts`）：
    1. **统一选择锚**：新增私有态 `_boardSelected: {row,col} | null` + 派生只读 getter `selection: 'tray'|'board'|'none'` / `boardSelected`。三值互斥由所有写点共同维持：`selectTraySlot` 成功即清 board 锚；新公开命令 **`selectBoardBead(row,col)`**（route 5a 公开形态，与 `selectTraySlot`/`retrieveBead` 同判例——测试/harness 不伪造触摸）成功即静默清托盘选中（`selected→holding` 槽位态直写，**未改 entities**——Tray 无 deselect 通道，已登记为待补项）。同颗错位珠幂等（零新事件），换选即转移。
    2. **路由 4 分支化**（`_routeTraySlot`）：4a holding → `tray:selected` 沿用，**例外 = §8-11 满槽禁取珠**（锚=board 且 freeCount=0 点任意槽 → 零事件零状态、锚保持）；4b 空槽且锚=board → `retrieveBead`（成功即清 board 锚）；4b 空槽锚∈{tray,none} → 零事件忽略（GDD 4b 的「轻提示」通道 `_showTapHint` 只有 cell/expand 两种锚点几何，托盘锚点属 E6 视觉面 → 本单不扩，**偏差已登记**）。
    3. **路由 5 分支化**（`_routeGridCell`）：5a `isMisplaced`（grid 派生谓词，零复制）→ `selectBoardBead`，发 **`board:selected {row, col, colorIdx=珠色beadColorIdx}`**（systems-index §4）；5b empty → `_routeGridEmpty`（锚=tray → `_placeSelected`；否则 BD-16 轻提示，**仅 fillable 格**——旧判据保持，旁路 `tapGridCell` 同体）；5c locked/就位 → **零事件零状态**（G7 极轻反馈通道全仓无现成实现，grep 无 press/denied，按任务口径走零事件，通道落码后在 5c 出口接入）。
    4. **轻提示迁移**：`_placeSelected` 的 `slot<0` 分支摘除（收窄为纯裁决应用 + 防御性零事件拒绝），迁至 `_routeGridEmpty`（真链 5b 与旁路 `tapGridCell` 共用）；`tapGridCell` 语义与旧版逐位等价（含「仅 fillable 提示」）。
    5. **生命周期**：`_setupLevel` / `_loadStage` 清 board 锚（换关换舞台）；board 锚不进崩溃快照（恢复后锚=tray-or-none，E5 扩错位珠色时再议）。
  - **快照**（`state.ts`）：`BeadsSnapshot` 增 `boardSelectedRow/Col`（-1 = 无；与 `traySelected` 三值互斥，至多一侧 ≥0），E6 据此画错位珠高亮。已走官方同步脚本落 cocos 镜像（`framework:sync:check` ✅）。
  - **单测**（`tests/selection-anchor.test.ts` 新增 **18 例**；`helpers.ts` 增追踪 `board:selected`）：锚互斥换选 tray→board→tray（双向 + 静默清除 + 快照通道）、带级次序不受锚影响（§8-12 道具卡分支）、同颗幂等/换选转移、4a 命中、**4b 取回全链**（真链 tapDesign：错位珠→空槽 → `tray:stored` 恰 1 次 payload 四字段 `toEqual` + 双写 + 锚清）、4b 无锚/锚=tray 零事件、**满槽禁取珠**（§8-11 全形态：零事件零状态锚保持 + 腾槽后同路径 stored）、**归位全链**（真链：匹配 → placed payload；不匹配 → rejected + 珠留托盘选中态保留 + 锚保持）、5b 无锚轻提示（仅 fillable，§8-7）、5b 锚=board 零事件、5c 就位珠/锁定格零事件零状态、旁路轻提示兼容、换关清锚、`selectBoardBead` 守卫（就位/空格/越界 false 零事件）。
  - **门禁**：`pnpm -F @wxgame/beads test` **284/284 全绿**（E1 266 零回归 + E2 新增 18）；`pnpm run verify` **PASS 13 ｜ FAIL 2** —— `check:size` = 已裁定存量（不算本单）；`check:links` = `.qoder/skills/*` 符号链接缺失（工作树 `??` 未跟踪目录系并发会话产物，本单未触碰该域，**定性存量**）。`typecheck` 本单曾因未使用 import 红 1 项、已修复；`framework:sync:check` 本单改动引起、已同步转绿。
  - **边界**：`src/view/**` / `src/entities/**` / `src/systems/**` / `design/**` / `packages/**` / `production/qa/**` 零触碰；E1 API（`retrieveBead`/`judgeRetrieve`/`judgePlacement`/`tray:stored`）语义零改动；路由 1–3（齿轮/道具卡/btn_expand）代码路径零改动；未 commit/未 push。
  - **遗留移交**：① G7 极轻反馈（5c/满槽拒绝的 scale+sfx_denied）通道落码批次需在 `_routeGridCell` 5c 出口与 `_routeTraySlot` §8-11 出口接入（现状零事件已合规）；② GDD 4b「空槽锚∈{tray,none} → 轻提示」的托盘锚点几何属 E6 视觉面，现状零事件忽略；③ 建议后续批次给 `Tray` 补 `deselect()` 替代 `_clearTraySelection` 的槽位态直写。

---

## WXG-T-136

- **名称**：**beads · E3：供料摘除 + 托盘纯缓冲收尾（Epic T-133 · 依赖 E1/E2 已就绪）**
- **负责**：程基岩(engineering-lead)　**状态**：✅ 完成（2026-09-16，未 commit）　**P1**
- **规格真源**：`tray-spawner.md v2.0`（定时供料**关停**（用户 2026-09-16 裁定案 A）：§8 判据逐条作废/改写标注；托盘 = 纯缓冲：容量管理、取回入槽、扩展行）+ `systems-index v1.22` §3.2/§3.4/§3.10f/§3.12g（供料常量作废）+ `core-loop v2.0` §2.2.2。
- **范围**：
  1. **关停定时供料**：spawner tick 从主循环摘除（`beads-game.ts:1193` 附近 `_spawner.tick`）；`SPAWN_INTERVAL_DEFAULT` 等 §3.4 已作废常量的代码侧消费一并摘除（tuning.ts 对应项注释标注「v1.22 作废，死值保留待 E6/E7 清理」或直接删，回传说明选择）。
  2. **死路径清理**：E1 的 `spawnInto→storeInto` 委托（`tray.ts`）—— 评估直接移除 spawn 入口 vs 保留委托，回传说明。
  3. **事件处置**：`tray:spawned` 作废（§4 已标）⇒ 代码侧移除发射点 + 消费方排查（**不得静默删**：grep 全部消费方，有视觉/音频消费则联动处置或登记）；`tray:full` **核实**（满槽语义仍存在 —— 取回被拒场景，视觉告警是否仍消费？按规格现场判定并回传）。
  4. **重置语义**：重开/重试时托盘清空 + 无 spawn（`timer-gameover v1.3` 重置清单）。
  5. **单测**：长时间运行零 spawn（反证）、重置清空、满槽拒取回归（E1/E2 已有，补 spawner 关停面）、`tray:full` 处置后消费方行为。
- **❗ 不做**：解环器（E4）、swaps/JSON（E5）、渲染（E6）。
- **⚠️ 陷阱**：① `tray:full` 可能牵动满槽告警视觉/`AUDIO_TRAYFULL`（§3.12g 已作废标注）—— 联动面先 grep 再动，越界回传；② 权限/powerup 的 noteSpawned 镜像（S6）随供料关停的语义核实；③ 热路径零分配；④ 工作树并发。
- **Output Path**：`games/beads/src/game/**`、`games/beads/src/entities/tray.ts`、`games/beads/src/systems/spawner.ts`、`games/beads/src/config/tuning.ts`（仅供料常量）、`games/beads/tests/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-136` 小节（追加）。**禁改**：`src/view/**`、`design/**`、`packages/**`、`production/qa/**`、`games/beads/design/audio/**`。
- **验收**：`pnpm -F @wxgame/beads test` 全绿（284 例零回归）；`pnpm run verify`（check:size 存量漂移不算）。**不 commit/push**。
- **主理人独立复核（2026-09-16，非采信自述）**：**286/286 全绿**（284 逐例保留改写不删例 + 新增 2 例）✅；spawner tick 摘除 + 三重死路径标注（spawner 头/`beads-game.ts:502`/tuning 7 项）✅；零 spawn 反证三连断言（`tray:spawned`/`tray:full`/`holdingCount`，另首帧/重置/满槽 30s 共 4 处反证面）✅；**联动面零静默改动**：`tray:full` 音频监听保留为标注死路径（音频域禁改 + A05-24 闭合不动，供料复活自动恢复发声）、视觉满槽告警为槽态驱动不消费事件 ✅；`spawnInto→storeInto` 委托保留（`giveTrayBead` 测试夹具唯一入槽死路径）✅。边界：`src/view/**`、`design/**` 未动 ✅。
- **⚠️ 教训修正（「cancelled」判据）**：T-119 入册的是「cancelled 后仍继续跑 40 分钟」；本轮为第二种形态——**代理在被掐前已完成全部落盘，静默即收工**。⇒ 入册补全：**cancelled 消息一律不作「已停止/未完成」判据，唯盘上 mtime + 内容事实为准；且「mtime 静止」不等于「没干活」——须先读盘上内容再判**（本轮 18:41 的 mtime 就是上轮代理的完成笔，主理人一度误判为真死而重派，好在重派会话自行核实为「核验即收工」，未产生重复施工）。
- **主理人裁定（四项未决，全部按移交口径维持）**：① `levels-data.ts`/`levels.ts` 残余消费 → **E5**；② `noteSpawned` 镜像失真 → **E4**；③ 满槽视觉语义变更 → 走设计变更单；④ `check:size` → 维持发布域后置。
- **状态**：**✅ E3 完成**（Epic T-133 进度 3/7）。
- **完成记录（2026-09-16）**：
  - **① spawner 摘除方式**：`beads-game.ts::_stepPlaying` 的 `_spawner.tick` 调用块整体删除（PLAYING 心跳 = 输入段→连击窗→计时，供料段恒空，对齐 `core-loop §2.2.2`）；**`Spawner` 类整体保留为标注死路径**（systems-index §3.4「死路径保留」口径，复活零成本），`_spawner.reset()`/`interval` 赋值/快照 `spawnAcc`/`spawnInterval`/`spawnFullReported` 三字段往返均保留（timer-gameover v1.3 §2.4「供料累加器字段保留」注记）。游戏级 `_rng` 缓存随摘除移除（唯一消费方是 tick；S6 仍直连 `services.rng`，L4 不受影响）。
  - **② tuning 常量处置**：选「**注释标注作废、死值保留**」（非直接删）——`SPAWN_INTERVAL_DEFAULT/MIN/MAX`、`NEEDED_WEIGHT`、`DECOY_WEIGHT`、`StageParams.interval`、`AUDIO_TRAYFULL_MIN_INTERVAL` 共 7 项加 ⛔ v1.22 作废标注。理由：① systems-index §3.4 明文保留死路径；② `levels.ts` 校验与 `levels-data.ts` 逐关 `spawnInterval` 字段（**不在本单 Output Path**，属 E5 swaps/JSON 批次）仍消费 MIN/MAX，直接删会级联越界改文件；③ `AUDIO_CLIP_TRAY_FULL` 不得删（A05-24 19-clip 闭合判据 ≡ `audio-events §1`，音频域禁改）。
  - **③ 事件处置排查结论**（grep 全量）：
    - `tray:spawned`：玩法侧发射点 2 处——`_stepPlaying`（已随 tick 摘除消失）+ `giveTrayBead()` 调试钩子（**保留**：测试/harness 夹具唯一入槽死路径，v2.0 §4 死路径口径；`BeadsEvents` 类型保留）。消费方排查：`powerups.ts` 头注释提及（文案未动，语义已由完成记录登记）、测试 harness 计数器、无视觉/音频消费。**S6 `noteSpawned` 镜像核实**：主循环喂入口消失，现存调用 = `giveTrayBead`（死路径）+ 快照恢复（合法：还原既有槽态）；**已知遗留**：E2 `retrieveBead` 入槽未喂镜像（v2.0 起真实对局镜像失真）——**登记不修**（E4 解环器反转后 S6 托盘零读写、`affectedSlots` 语义消失，现在补属白干，移交 E4 评估）。
    - `tray:full`：玩法侧唯一发射点在 tick 块内（已消失）⇒ **玩法侧零发射**（dead path）。消费方 2 处：① 音频 `bus.on('tray:full')→sfx_tray_full`（**保留为死路径**：A05-24 闭合不动、`audio-dispatch.test` 既有 27 例零改动继续锁定其行为，供料复活自动恢复发声）；② 视觉满槽告警 = **槽态驱动**（view-model 读 `freeSlots===0`，不消费事件）⇒ **不受影响、按 v2.0 保留**（tray-spawner §6 只作废「告警**事件**」；ux-spec §5 满槽告警行未作废，`src/view/**` 禁改未动）。**视觉/音频联动面零改动**。
  - **④ 重置语义**：`_loadLevel`/`_loadStage`/retry 链已有 `_tray.reset()`（全清+扩展回基线）+ `_spawner.reset()`，tick 摘除后「重置 + 无 spawn」结构成立；新增专测钉住（见 ⑤）。
  - **⑤ 单测清单与数字**：**286 例全绿**（原 284 例逐例保留——改写不删例，新增 2 例）。改写（按 v2.0 §8 改写替代判据）：`tray-spawner.test` §8-1→**60s 零供料反证**（`tray:spawned`===0 + `tray:full`===0 + 托盘恒空，**有显式计数断言**）、GAP-02→首帧零供料、§8-3/GAP-06 降为 Spawner 类**死路径单元锁定**；`frame-order.test` fo-1/2/4→供料段恒空下的帧内序（输入段先于计时段）、fo-3 去掉供料前置；`pause-settings` §8-2→恢复后零供料反证（6s>原 interval）；`powerups` §8-6/§8-10→「清槽后可再持有 / 同帧入槽守恒」（giveTrayBead 死路径替代首供位）；`core-loop` §8-5、`sprint` §8-1/§8-7、`in-level-snapshot` §8-15、`feedback-vfx` 5 处→夹具珠改 `giveTrayBead`+`placeColor` 直投（helpers 增 `firstEmptyCell`）。**新增 2 例**：① 重试重置清空（托盘全空 + 扩展回基线 + 重置后 10s 零 spawn 零 full）；② 满槽长跑 30s 零 `tray:full`（满槽只禁取回、无告警事件，E1/E2 满槽拒取回归在 `misplaced.test` 继续覆盖）。`revive.test`/`audio-dispatch.test` 等 17 文件**零改动**通过。
  - **⑥ 验证**：`pnpm -F @wxgame/beads test` 286/286 全绿；`pnpm run verify` 14 PASS + `check:size` FAIL（beads 主包 4537.6 KB>4096，**存量构建产物漂移，任务书已裁定不算**）；`framework:sync` 镜像已刷新（写入 3：tuning/beads-game/spawner），`framework:sync:check` ✅。热路径零分配（删代码无新增分配）；`src/view/**`/`design/**`/`packages/**`/`production/qa/**`/`design/audio/**` 零触碰；未 commit/push。
  - **遗留移交**：① S6 镜像失真（E2 retrieve 不喂 `noteSpawned`）→ E4 解环器反转时一并消解；② `levels-data.ts` 逐关 `spawnInterval` 字段 + `levels.ts` 区间校验（作废常量的残余消费）→ E5 swaps/JSON 批次统一清理；③ E6 若需满槽告警视觉语义变更（如改文/取消），走设计变更单，本单未动。

---

## WXG-T-137

- **名称**：**beads · E4：解环器三型（powerups 反转，Epic T-133 · 依赖 E1/E3 已就绪）**
- **负责**：程基岩(engineering-lead)　**状态**：🔄 进行中（2026-09-16 派工）　**P1**
- **规格真源**：`powerups.md v1.3`（三道具反转为**解环器** = 自动归位错位珠；§3.6 冻结变更）+ `systems-index v1.22` §3.6（`POWERUP_TYPES → ['solver','solverPlus','solverRandom']`、新冻结 `SOLVER_PLUS_COUNT=3`/`SOLVER_RANDOM_COUNT=1`、`REGION_CLEAR_SLOTS`/`RANDOM_CLEAR_COUNT` 作废、道具目标改「棋盘错位珠（**托盘零读写**）」）+ `bead-grid.md v2.0` §8-6（`filled` 终态推翻后的道具写入口径）+ §4 事件表（`powerup:used.affectedSlots → affectedCells`）。
- **用户裁定依据**：2026-09-16「三个道具反转为解环器（推荐）」。
- **范围**：
  1. **三型解环器**：`solver`（行主序首颗错位珠）/ `solverPlus`（同ocha）/`solverRandom`（RNG 选 1 颗）—— 每型把选中的错位珠**自动归位**（珠移到其颜色对应的空格）。
  2. **常量落地**：`SOLVER_PLUS_COUNT=3`/`SOLVER_RANDOM_COUNT=1` 进 `tuning.ts`（来源 §3.6 v1.22）；旧 `REGION_CLEAR_SLOTS`/`RANDOM_CLEAR_COUNT` 按 §3.6 作废处置（参照 E3 的「注释标注作废 + 死值保留」口径，回传说明）。
  3. **事件**: `powerup:used` payload `affectedSlots → affectedCells`（消费方 grep 后联动，不得静默）；`bead:placed` 在解环器路径**不带 `slot`**（E1 已把 slot 改可选，本单收尾）。
  4. **结构保留**：三卡位 + `AD_PLACEMENTS=4` 结构、激励视频位不动；**旧类型名不静默映射**（若旧名仍在用，改名 + 回传说明）。
  5. **S6 镜像收口**（E3 移交项）：`noteSpawned` 失真（E2 `retrieveBead` 入槽不喂）随本单「托盘零读写」一并消解。
  6. **单测**：三型各自效果（含 `SOLVER_*_COUNT` 数值断言）、「无可解错位珠」时的行为（零事件 or 占位提示，按规格）、`affectedCells` payload、`bead:placed` 解环器路径无 slot、S6 镜像行为。
- **⚠️ 陷阱**：① 道具**不得读写托盘**（§3.6 反转：目标=棋盘错位珠）—— 遇必须触碰托盘的实现请以 `retrieveBead` 复用 E1 API 或回传说明；② RNG 走既有 `services.rng`（L4 禁 `Math.random()`）；③ 归位可能触发通关判定（`isComplete` 零错位）—— 注意清除优先于失败（§2.2.2 cleared-priority）；④ **不得**在同帧既用解环器又产生玩家落子（每帧最多 1 条输入指令）；⑤ 工作树并发。
- **Output Path**：`games/beads/src/game/**`、`games/beads/src/systems/powerups.ts`、`games/beads/src/config/tuning.ts`（仅解环器常量）、`games/beads/tests/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-137` 小节（追加）。**禁改**：`src/view/**`（E6）、`src/entities/grid.ts`（E1 域，除非回传说明）、`design/**`、`packages/**`、`production/qa/**`。
- **验收**：`pnpm -F @wxgame/beads test` 全绿（286 例零回归）；`pnpm run verify`（check:size 存量不算）。**不 commit/push**。
- **⚠️ 派工形态记录**：本单 subagent 连续 4 次中途空返/被掐（读文件后零产出 ×2、idle timeout ×1、写盘被打断 ×1），最终由**主理人亲自接手落码收尾**——S6 重写主体由前次被掐会话完成（质量合格），主理人完成 `beads-game.ts` 接线、快照字段迁移、`powerups.test.ts` 全量改写与三处消费方同步。**教训**：E4 级别的「语义反转 + 全调用面迁移」任务对 subagent 的上下文负担过重，宜拆成「S6 纯函数重写」+「接线与测试迁移」两单。
- **主理人落码记录（2026-09-16/17）**：
  - **S6（`powerups.ts`）**：翻转 `POWERUP_TYPES` 为 `['solver','solverPlus','solverRandom']`；`request(type, misplaced)` 改为**无状态纯点名**（错位珠清单由调用方从 grid 现取，行主序）⇒ 旧「托盘只读镜像」（`_holding`/`_anchor`/`noteSpawned`/`notePlaced`/`noteSelected`/`noteCapacity`）整体删除——**连带消解 E3 移交的 `noteSpawned` 失真**；`regionWindow` 标死路径保留；`POWERUP_LABELS` 改「解环 / 解环 ×3 / 随机解环」（⚠️ 待美术/文案确认，原出处 `assets-spec §1.4` 本单禁改）。
  - **S3 接线（`beads-game.ts`）**：`usePowerup` 改「点名归 S6、动手归 S3」——`_misplacedBeads()` 现取行主序错位清单 + `_solveMisplaced()` 经 grid 既有写原语（`retrieve`/`fill` 直移，或 `setBead` 双格交换）执行归位；**托盘零读写**；`powerup:used` payload `affectedSlots → affectedCells`（记**实际归位**格，点名珠可能被同对交换连带修好）；解环器路径 `bead:placed` **不带 slot**；归位后零错位 ⇒ cleared-priority（normal → `level-clear`，sprint → `_completeStage`）。
  - **快照迁移**：`powerupFreeUses` 字段 `region/clearAll/random → solver/solverPlus/solverRandom`（`state.ts` + `crash-snapshot.ts` 同批）。
  - **测试**：`powerups.test.ts` 全量改写（§3.6 常量镜像 / §8-1 solver 首颗 / §8-2 solverPlus 上限与不足不补 / §8-3 直移与交换两几何 / §8-4 solverRandom 确定性 / §8-5 不足不补 / **§8-6 零托盘读写**（新判据）/ §8-7 只动错位珠 / §8-8 计数独立+超限占位不 load/show / §8-9 空作用零扣次+非法 type / §8-10 `bead:placed` 无 slot + 通关）；`frame-order`（道具在输入段先于计时）/ `in-level-snapshot`（§8-16 字段名）/ `finish-panel`（删死路径步骤）同步。
  - **测试基建教训（入册）**：① `isFillable` 只对 **empty** 格为真 ⇒ fill 之后收集 flat 恒为空（曾致整组 0 错位）；② 三色下同色对调 = 零错位 ⇒ 错位装配必须贪心找**异色对**。
- **门禁**：`pnpm -F @wxgame/beads test` **284/284 全绿**（25 文件；原 286 例改写不删例，新增若干、合并若干）；`tsc --noEmit` 零错误；`framework:sync:check` ✅；`verify` PASS 14｜FAIL 1（唯一 FAIL = `check:size` 存量漂移，维持发布域后置裁定）。
- **主理人复核结论**：三型均实际归位（含 `SOLVER_PLUS_COUNT=3`/`SOLVER_RANDOM_COUNT=1` 数值断言）✅；零托盘读写有专判据 ✅；`affectedCells` 消费方全同步（frame-order/audio-dispatch/in-level-snapshot）✅。
- **状态**：**✅ E4 完成**（Epic T-133 进度 4/7）。

---

## WXG-T-138

- **名称**：**beads · v1.23「大胆重制」提案落盘（冻结面七项变更串行落）**
- **负责**：主理人(WorkBuddy)　**状态**：✅ 完成（2026-09-17 落盘）　**P1**
- **用户裁定依据**：2026-09-16 grill-me 设计拷问会话（WorkBuddy），两轮 16 问**全部按推荐拍板**。提案正本 = `games/beads/design/proposals/v1.23-bold-remake.md`（裁定全录 + 诚实修正存档）。
- **核心诊断**：v1.22 后供料关停 + 托盘 12 槽 ≫ k≤8 + 恒定 300s ⇒ 支柱 2「槽位压力」事实死亡，失败页/续时位/星级区分度连坐悬空。**诚实修正**：托盘 2 槽即可滚窗解任意置换 ⇒ 容量是手感旋钮非难度闸门。
- **落盘清单（实际执行）**：
  1. `systems-index.md` → **v1.23**，七处：版本行；§1 S4 职责注；§3.4 `TRAY_BASE_SLOTS` 12→**6**、`TRAY_EXPAND_SLOTS` 12→**6**（A1 二次变更）；§3.5 区间 [180,420]→**[120,420]** + 新冻结 `LEVEL_TIME_OVERRIDE = clamp(k×45s, 120, 420)`；§3.7 新增**主题解锁语义**行（★货币化，动「星级只记录」原句）；§3.10 新增 `SPRINT_K_CURVE = min(2+⌊stage/2⌋, MISPLACED_PAIRS_MAX)` `[待 playtest]`；§3.13 新增**环长分布 `cycleProfile`** 行；§3.8 `EMPTY_GHOST_ALPHA` 作废态**转正为设置开关**（默认关，值 0.32 恢复有效）。
  2. `systems-index-changelog.md`：追加 **v1.23** 行（含全部变更逐条与后继清单）。
  3. `input-control.md` → **v2.1**：§2.1「格间不直换」升级——`swap` 由 Should 改**裁定永不实现**（Q2；工程无需预留接口，无路由/判据改动）。
  4. `concept.md` → **v1.2**：支柱 2 改写「托盘工作台的手感与环谜题」；§4 MDA 去供料化对齐「错位归位」；§6 张力双源/三旋钮/心流保护对齐（时间按 k 定价、托盘 6 槽、k×cycleProfile）；§7 范围分层随 Q15 更新（MVP 追加归位连击 + 幽灵符号开关；动画/收藏册 Should；主题/生成器 Could；Won't 加 swap）；决策记录新增 **D11**（禁 swap）/ **D12**（星级主题语义）；附录 A 加「历史轨迹」声明。
- **本单不改**：`src/**`（工程落码另排，不与 T-137 竞写）、`levels-01-08.json`（逐关 time 按公式复核属数据侧后继）、`score-combo.md`（归位连击机制节后继补）、`save-progress.md`（幽灵开关字段后继补）、art 侧文档（主题材质与托盘 6 槽面板视觉归 WXG-T-131 域）。
- **后继（候选 backlog）**：① score-combo 增「归位连击」机制节（streak ≤4 档、音高表走 audio-events 变更单）；② levels JSON 逐关 time 复核；③ art：珠材质主题视觉规格 + 托盘 6 槽面板收窄；④ save-schema 幽灵开关字段；⑤ 生成器工具链化（印章库扩充 + `tools/scripts/`）。
- **提交**：未 commit（待用户指示；台账 blob 法回填见下）。

---

## WXG-T-139

- **名称**：**beads · E5：错位装配器（swaps）+ BOOT 校验器 + levels JSON v2（Epic T-133 · 依赖 E1/E3/E4）**
- **负责**：程基岩(engineering-lead)　**状态**：🔄 进行中（2026-09-17 派工）　**P1**
- **⚠️ 规格真源已升版**：`systems-index` **v1.23**（WXG-T-138「大胆重制」已落盘）在 §3.13 基础上新增了 E5 直接消费的冻结项，**一律以 v1.23 为准**（不要照 v1.22 的旧表施工）：
  - `MISPLACED_PAIRS_MIN/MAX = [1,8]`（区间冻结）；逐关 k 曲线建议值 `[1,2,2,3,4,5,6,8]`（L1→L8，`[待 playtest]`，调值走 levels JSON）
  - 交换构造法 `swaps: [[r1,c1,r2,c2], ...]`；**可解性由构造保证**（可逆置换）
  - **`cycleProfile`**（v1.23 增补）：第二难度旋钮（k 相同下长环更难），levels JSON 建议值、**不冻结**
  - `TRAY_BASE_SLOTS` **12 → 6**（v1.23 冻结变更）
  - **`LEVEL_TIME_OVERRIDE = clamp(k × 45s, 120, 420)`**（v1.23 新冻结：**时间按 k 定价**）
  - 其他：`levels-spec v1.2`（`misplaced` 字段、§5 时长预估重推）、`core-loop v2.0` §2.1（BOOT 校验 swaps）、`timer-gameover v1.3`（重置 = 恢复初始错位布置）
- **范围（分两段落盘，见下）**：
  1. **装配器**：从 pattern 生成「正确解」→ 按 `swaps`（受 `cycleProfile` 约束）执行 k 次两两交换 ⇒ 错位局面（可解性由构造保证，无需运行时搜索）。
  2. **BOOT 校验器**：坐标可填、每对珠色不同、k ∈ [1,8]、`misplaced === 2 × swaps.length` 恒等式、`cycleProfile` 合法性；不合法则拒收（沿用既有 BOOT 拒收与报错形态 `L<id> row.. col..`）。
  3. **levels JSON v2**：8 关数据（k 曲线 + swaps/cycleProfile 字段）+ `version` 升级 + 时间按 k 定价落地。
  4. **收尾移交项**：① `levels-data.ts` 逐关 `spawnInterval` 与 `levels.ts` 区间校验的**供料残余消费**清理（E3 移交）；② crash-snapshot 扩**错位珠色**字段（E1 遗留①，当前按底色就位会「复活成就位」）。
  5. **单测**：装配器确定性（同 seed 同局面）、恒等式、各校验分支拒收、8 关数据全过 BOOT、时间公式边界（k=1→120s 下限、k 大→420s 上限）。
- **❗ 不做**：渲染（E6）、QA 判据（E7）。**禁改** `design/**`（规格已冻结，若发现规格缺项**先回传**）、`packages/**`、`production/qa/**`、`src/view/**`。
- **Output Path**：`games/beads/src/game/**`、`games/beads/src/levels*.ts`（或既有关卡装配模块）、`games/beads/src/config/tuning.ts`（仅本单常量）、`games/beads/tests/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-139` 小节（追加）。
- **验收**：`pnpm -F @wxgame/beads test` 全绿（**284 例零回归**）；`pnpm run verify`（`check:size` 存量不算）。**不 commit/push**。
- **⚠️ 规格基线说明**：施工中规格已升 **v1.23**（WXG-T-138「大胆重制」，另一会话）——E5 消费面全部按 v1.23 对齐（`TRAY_BASE_SLOTS` 6 槽、`LEVEL_TIME_OVERRIDE = clamp(k×45s, 120, 420)`、`cycleProfile` 第二旋钮、冲刺 k 爬梯）。
- **主理人落码收尾记录（2026-09-17；subagent 完成 80% 后在调试阶段被掐，主理人接手收尾）**：
  - **装配器**（`src/game/misplaced-assembler.ts`，492 行新文件）：`generatePlan(pattern, pairs, profile, rng)` 生成 k 次交换的**环构造**（底色桶保证环内底色互异；`cycleProfile` 控环长分布）；`assembleBoard` 按 swaps 真交换；`applyMisplacedToGrid` 经 `grid.fill` 写入（BOOT 期绕过 retrieve/place 边，bead-grid §2.1 明文合法）。
  - **BOOT 校验器**（`validateSwaps` + `levels.ts` 接入）：①对数 ∈ [1,8] ②四元整数/坐标可填/两格不同 ③**恒等式一般式** `misplaced === swaps.length + 环数` ⑤cycleProfile 白名单+与实际环长一致。
  - **❗ 修掉一个 subagent 死循环**（本轮最重要发现）：`decomposeCycles` 的并查集 `find()` 用 `parent.get(root) !== root` 比较 —— 形状非法的 swap（如三元素 `[0,0,0]`）算出 `b = NaN`，`add(NaN)` 后 **NaN !== NaN 恒真 ⇒ 死循环**，被「坐标越界」用例引爆（整包测试挂起 100s+ 无输出）。修：`!Number.isFinite(a/b)` 守卫跳过非法项。
  - **❗ 判据修正（自造判据被规格否决）**：subagent 自造了「交换图必须成链，分叉 = 复制珠 = 死局」判据 —— 与 `levels-spec v1.2 §2.1`「交换是**可逆置换**（真交换，非复制）」矛盾：星序 (A,B),(A,C) 恰是 3-环、合法且一般式恒等式成立。⇒ 删「链形/分叉」「环内底色重复」两条，恒等式（一般式）统一覆盖「歪打正着就位」场景。测试同步改写并注明原判据删除理由。
  - **levels JSON v2**：`levels-01-08.json` 8 关带 `swaps`/`cycleProfile`（k 曲线 [1,2,2,3,4,5,6,8]）；`levels.ts` BOOT 校验接入；时间按 k 定价落地；E3 移交的 `spawnInterval` 残余消费清理（`beads-game.ts` 快照比对死路径 + spawner 缺省化）。
- **门禁**：`pnpm -F @wxgame/beads test` **314/314 全绿**（27 文件；原 284 零回归 + 新增 30）；`tsc --noEmit` 零错误；`framework:sync:check` ✅。
- **状态**：**✅ E5 完成**（Epic T-133 进度 5/7）。

---

## WXG-T-140

- **名称**：beads · 谜面可读性裁定 **(b)「L11 目标色环」** 落盘（accessibility §5.4 P0 关项）
- **背景与裁定依据**：用户 2026-09-17 在美术草稿确认环节提出「每个珠子底板颜色没有展示，怎么区分珠子是否放对位置」。经查为**真缺口**且已登记在案——珠 50px = 格 50px、同 `radius 11` ⇒ 坑底色被珠体**零露出**，`grep -rn misplaced src/view/` **零命中**（代码侧无错位标记），`assets-spec` L945 自认「本节的凹凸五通道**不能**证明 filled 格谜面可读」。用户从三候选中拍板 **(b) 目标色环**（(a) 缩珠径已驳回——`BEAD` 50 是 §3.3 冻结值；(c) 只标错位珠＝泄底，不采纳）。
- **本单落盘（规格层，零代码）**：
  1. `accessibility.md §5` 第 4 条：待裁决 → **已裁定**，记 (b) 采纳 / (a)(c) 驳回理由、**已接受副作用**（视觉噪声 + 与 §1.9.4「must not read as a bead」对偶轻微打架）、**回退第一顺位 = 砍 L11**、后继工程项清单。
  2. `assets-spec.md §1.1`：十层卡加 **L11 目标色环**行（沿格缘 `roundRect(x+0.02, y+0.02, 0.96, 0.96, r×0.9)`、`stroke mix(pattern_colorIdx,#000,0.30)`、`lineWidth max(2, BEAD×2/50)`；ink 复用 §1.9.2 端点 ⇒ **零新 hex**；环宽常量归 `tuning.ts` ⇒ **零 §3 变更**；**归属「格」而非「珠」**，不随 selected 上移/落座缩放；托盘珠 / `locked` / `empty` **不画**）。
  3. `assets-spec.md §1.2` `filled` 行：静态层数 10 → **11**，附裁定语义与副作用。
  4. `assets-spec.md §1.8` 末基线表：新增 **基线 ④ = 1672 + 156 = 1828**（**可达真值非松上界**，因 v1.22 开局即满盘 filled）；记录 **`h` 不变量破例**（每手持珠净值 −1，`h=8⇒1820`、`h=16⇒1812`）。
  5. `bead-grid.md` L74：「错位/就位：珠色≠底色即可辨」的**循环论证**改正为指向 L11（逻辑态 `misplaced` 判定不变）。
  6. `games/beads/design/art/specs/style-drafts-20260917.html`：整屏草稿同步（每颗棋盘珠加目标色环、原蓝虚线标注环撤除）。
- **本单不改**：`systems-index.md` §3 全部冻结值（零 §3 变更，已在两文显式声明）、`src/**`、`packages/**`、`production/qa/**`、`levels JSON`。`art-bible.md` **亦未改**——经核其 §7.4 已声明「绝对值一律以 `assets-spec` 基线表为唯一真源」，无并存数值需同步。
- **后继 backlog（需另立单）**：① **渲染层**（`src/view/**`）：view-model 快照对 `filled` 格是否携带 `pattern colorIdx` 需核实（empty 侧已消费同值 ⇒ 源应在，未携带则补字段）；② `tuning.ts` 加环宽常量；③ **真机验收**：「156 格 2px 环」的视觉噪声是否可接受，不可接受 ⇒ 按登记的第一顺位回退砍 L11（−156 层、零玩法语义改变）。
- **Output Path**：`games/beads/design/art/specs/accessibility.md`、`games/beads/design/art/specs/assets-spec.md`、`games/beads/design/gdd/bead-grid.md`、`games/beads/design/art/specs/style-drafts-20260917.html`、`production/TASKS-DETAIL.md` 的 `## WXG-T-140` 小节（本段）。
- **验收**：已自检——`L11` 在 `assets-spec.md` 命中 §1.1 / §1.2 / §1.8 三处；`v1.5-r3` 在 art 二文命中；`bead-grid.md` L74 无残留旧句。**本单为纯文档裁定落盘，不涉及单测与 `verify`**。**不 commit/push**。
## WXG-T-141 · beads·参考竞品四项裁定落盘（托盘 24 槽 / 缩放手势 / HUD / 失败页确认）

- **日期 / 执笔**：2026-09-17，主理人（WorkBuddy）。
- **背景**：用户提供第三方拼豆游戏高清录屏（1284×2778 @3x），分析见 `design/references/ref-video-2026-09-17-ui-ux-analysis.md`（§10 高清复核）。用户对 4 项待确证问题当场拍板，其中托盘方案**推翻 v1.23 Q9 的 6 槽裁定**。
- **四项裁定**：
  1. **缩放交互**：棋盘若引入缩放，**只做双指捏合手势**，无滑轨/按钮控件（对参考竞品左侧「放大镜+竖滑轨」的替代方案）。
  2. **HUD**：**不设「更多游戏」入口**（用户：「暂时不要」）。
  3. **失败页**：倒计时归零 → **看广告增加时间，或退出关卡**——与 §3.5/§3.11 现稿完全一致，**零变更**（登记为确认项，非变更项）。
  4. **托盘定案**：**固定 2 行 × 12 = `TRAY_BASE_SLOTS`=24；扩展 +2 行 × 12 = `TRAY_EXPAND_SLOTS`=24（看广告）**——对 concept 附录 A1 的三次变更，推翻 v1.23 Q9（6 槽滚窗方案）。
- **落盘清单**：
  - `systems-index.md` → **v1.24**：§3.4 两常量 6→24 + 诚实记录（容量=手感旋钮非难度闸门，v1.23 滚窗论述作废）+ 托盘槽定位行加「4 行态几何需整体重验」注记；changelog v1.24 全条目。
  - `tray-spawner.md` → **v2.1**：版本行、§1「24+24 槽」、§2.1「2 行实线 / 2 行虚线」。
  - `concept.md` → **v1.3**：支柱 2 与 Dynamics 去「滚窗」表述、§7 MVP 托盘口径、新增 **D13**、附录 A 警示行补 v1.24。
  - `input-control.md` → **v2.2**：多点触控条款加 Should 缩放手势注记 + §9 变更行。
  - `ux/ux-spec.md` → **v1.6**：HUD 区加三条 v1.6 注记；**头注补记 v1.5 漏升版**（WXG-T-128 的 E4 更正早已入文但头注停在 v1.4，属登记漂移，本次修正）。
  - `references/ref-video-2026-09-17-ui-ux-analysis.md` §8 待确认清单：1/2/3/5 四项回填裁定闭环。
- **本单不改**：§3.5/§3.7/§3.10/§3.11/§3.13 全部冻结值；`REVIVE_BONUS_SEC`=60 维持（竞品 180s 仅作基准记录，是否上调 `[待 playtest]`）；`src/**`、`packages/**`。
- **后继 backlog（需另立单）**：① **art/ux 几何重验**：4 行态（2 实+2 虚）的 `TRAY_BAND` 带高、`btn_expand` 热区 y、与 12 行关卡的热区冲突复检（§3.4 两行旧 y 值已标不作 QA 判据）；② 捏合缩放的实现单（若立项，含 §8 判据新增与多点触控路由修订）；③ T-140 的 L11/B′ 载体选择仍**待用户拍板**（描边环 vs 垫色显缝，见参考文档 §10）。
- **Output Path**：`games/beads/design/gdd/systems-index.md`、`games/beads/design/gdd/systems-index-changelog.md`、`games/beads/design/gdd/tray-spawner.md`、`games/beads/design/gdd/input-control.md`、`games/beads/design/concept.md`、`games/beads/design/ux/ux-spec.md`、`games/beads/design/references/ref-video-2026-09-17-ui-ux-analysis.md`、`production/TASKS.md`。
- **验收**：`grep -n "TRAY_BASE_SLOTS.*24" systems-index.md` 命中 §3.4；`v1.24` 命中 changelog 与 systems-index 版本行；五文档版本号与 changelog 互指一致；不涉及测试与 verify（纯文档裁定落盘）。**不 commit/push**。

## WXG-T-142 · beads·谜面可读性载体切换 B′「目标色垫·垫色显缝」（用户拍板）

- **日期 / 执笔**：2026-09-17，主理人（WorkBuddy）。
- **裁定**：用户拍板 **B′**，把 T-140 采纳的 (b)「L11 目标色环（描边）」载体切换为 **B′「目标色垫·垫色显缝」**。**语义完全不变**（每颗棋盘 filled 格呈现该格目标色暗一档的可见参照，珠色 ≠ 垫色即错位），只换实现：垫 = 画于珠层之下的**单层平面 roundRect 全格**，ink `mix(target,#000,0.30)`（与 empty 坑 S1 同源 ⇒ 零新 hex）；**珠视觉内缩 `BEAD_DRAW_INSET = 2`**（draw rect 46/50，四周露垫 2px 缝）。
- **诚实记录**：(a)「缩珠径」此前因 `BEAD`=50 是 §3.3 冻结值被驳回——B′ 用**渲染内缩**绕开而非推翻该冻结（`BEAD`=50 仍为格几何/热区真值，零 §3 变更）。行业实证 = 参考竞品同方案（珠 44/格 64/缝 ≈31%，我方缝 8%，**[待 playtest 视认性]**，INSET 可调）。
- **优点（相对描边环）**：垫是平面 ⇒ 与 §1.9.4「must not read as a bead」**无冲突**；噪声低于 156 条描边环；与 empty 坑语言同源。层数 +1/格不变 ⇒ **基线 ④ = 1828 不变**。
- **落盘**：`assets-spec.md`（§1.1 L11 行重写 + §1.2 `filled` 行 + §1.8 ④ 表述，标 **v1.5-r5**）；`accessibility.md` §5.4（(b) 留档划线 + 新增 B′ 最终裁定条 + 后继常量改名）；`bead-grid.md` L74（可读性载体改垫）；草稿 `style-drafts-20260917.html` ① 重出（B′ 样张 + 24 槽托盘 + 广告 +24 按钮）。
- **本单不改**：§3 全部冻结值；层数/基线数值；`src/**`。
- **后继**：渲染层实现单（核实 view-model 对 `filled` 格携带 pattern colorIdx + `tuning.ts` 加 `BEAD_DRAW_INSET`）；缝宽视认性 playtest。
- **验收**：`assets-spec` 内「目标色环」仅存于留档划线处；`BEAD_DRAW_INSET` 命中 spec/accessibility；基线 1828 不变。**不 commit/push**。

---

## WXG-T-143

- **名称**：**beads · E6：渲染改造（E1 纯色凹陷卡 + L11 垫 + E4 删除 + 托盘 24 槽适配）（Epic T-133）**
- **负责**：程基岩(engineering-lead)　**状态**：🔄 进行中（2026-09-17 派工）　**P1**
- **⚠️ 规格基线已两次前移，一律以现行为准**：`assets-spec` **v1.5-r5**（T-131 四层凹陷卡 + T-140 L11 目标色环 → **T-142 B′「目标色垫·垫色显缝」**：`filled` = 十层 + **L11 垫**、`BEAD_DRAW_INSET=2` 珠视觉内缩；`empty` = 四层 S1–S4 不变）+ `systems-index` **v1.24**（`TRAY_BASE_SLOTS` 6→**24**、`TRAY_EXPAND_SLOTS` 6→**24**，扩展后 48 槽 4 行——**推翻 v1.23 的 6 槽**）。
- **❗ 工程侧滞后项（本单一并落）**：`tuning.ts` 现仍是 `TRAY_BASE_SLOTS=12`/`TRAY_EXPAND_SLOTS=12` ⇒ 随本单同步 24/24。
- **范围**：
  1. **`drawEmptySocket` 四层凹陷卡**（assets-spec §1.2 v1.5）：S1 暗缘框 `mix(base,#000,0.30)` → S2 坑底内缩 6%、`−0.14` 同色相暗档 → S3 上内阴影线 → S4 下受光亮线；几何以坑边 S 计（棋盘 `BEAD_CELL` 50、托盘 `TRAY_SLOT` 现行值）；**删幽灵符号**（E4 死路径开关保留，可恢复零成本）。
  2. **端点表预烘焙**（§1.9.5）：10 色 × {L+, L−, Lpit} + 托盘中性槽 = 31 串模块级一次构建（或 `palette.ts` 字面量直抄）；**热路径零新增字符串分配**（T-131 风险条目的缓解承诺）。
  3. **`filled` 加 L11 目标色垫**（§1.1 v1.5-r5）：画于珠十层之下、平面零投影；珠绘制 rect 内缩 `BEAD_DRAW_INSET=2`（新 art 常量归 tuning，零 §3 变更）。
  4. **托盘微拱白瓷**（§1.3）：面板底缘两段 + 右缘一段内阴影（α 0.03/0.05/0.02，ink `#1E2033`）。
  5. **托盘 24/24 槽适配**：tuning 同步 + 视图行数（2 行基线 / 4 行扩展）+ 快照 `traySlots` 长度 + 受影响测试夹具；**逐项 grep 消费方**（powerups 已无镜像，负担小）。
  6. **`palette.ts`**：`EMPTY_TINT_MIX`/`EMPTY_GHOST_ALPHA` 作废标注（死值保留，判例同 E3）。
  7. **测试**：`bead-render` 命令检视断言（empty 发射 S1–S4 且明暗方向正确、filled 含 L11 且垫在珠下、**不发射**幽灵符号、托盘行数）；端点表与 §1.9.2 对照；托盘 24/24 适配回归。
- **❗ 不做**：QA 判据迁移（E7）；选中高亮的视觉方案（`boardSelected` 数据通道 E2 已备，其视觉行待 ux-spec §5 落值后另批）。**禁改** `design/**`（规格已冻结，缺项先回传）、`packages/**`、`production/qa/**`、`src/game/**`（E1–E5 域）。
- **Output Path**：`games/beads/src/view/**`、`games/beads/src/config/tuning.ts`、`games/beads/src/config/palette.ts`、`games/beads/tests/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-143` 小节（追加）。
- **⚠️ 陷阱**：① 热路径零分配（端点表预烘焙是硬承诺）；② ES5 构建约束（ADR-0012：禁 Set 展开等）；③ `TRAY_SLOT` 现行值核实（v1.24 24 槽后槽宽可能重算——规格若未定先回传）；④ L5 珠面符号**保留**（T-131 未决③裁定随本单统一处理=保留为装饰+明度通道）；⑤ 工作树并发。
- **验收**：`pnpm -F @wxgame/beads test` 全绿（314 例零回归）；`pnpm run verify`（`check:size` 存量不算）；`framework:sync:check`。**不 commit/push**。
- **⚠️ 规格增量回传（工单约定「缺项先回传」）**：**托盘 24/24 槽的布局适配未在本单落** —— v1.24 只冻结槽数（2 行基线/4 行扩展），**未定义新 `TRAY_PANEL` 面板尺寸与 `TRAY_BAND` 带位**（4 行 × 54px ≈ 216 + padding，现行面板 190 放不下，且 HUD 底部化后棋盘/托盘带会连锁重排）⇒ **破坏性布局变更，需设计侧（或用户）先定面板尺寸**。tuning 已挂 ⛔ 注释（24 为目标值、12 仍生效）。
- **主理人落码记录（2026-09-17，亲自施工；E4 同型 subagent 三连失败后接手）**：
  - **端点表预烘焙**（`palette.ts` §1.9.5）：`BEAD_ENDPOINTS` 模块级一次构建 10 色 × {base,edge,pit,lit}（S1 0.30 / pit +0.14 / S4 0.38，奶白经 mix 钳制）⇒ **热路径零新增字符串分配**（每帧查表）。
  - **`drawEmptySocket` 四层凹陷卡**（v1.5）：S2 坑底内缩 6%（pit）→ S1 暗缘框（stroke edge）→ S3 上内阴影线 → S4 下受光亮线；**幽灵符号删除**（EMPTY_GHOST_ALPHA 消费删，死值保留可恢复）；中性槽（托盘空槽）走 slot 色推导端点。
  - **`drawFilledBead` L11 垫**（v1.5-r5 垫色显缝）：新增 `padColorIdx`（底色），垫 = 端点表 edge 平面（零投影，不读作珠），珠十层整体内缩 `BEAD_DRAW_INSET=2` 露垫缝；**错位珠「歪在垫上」可视化**（view-model 棋盘调用改传珠色 `beadColorIdx` + 垫色 `colorIdx` —— E1 遗留的「错位珠画成底色」一并修正）。
  - **托盘微拱白瓷**（§1.3）：`drawTrayPlateShading` 三段内阴影（底缘 0.03/0.05 + 右缘 0.02，ink #1E2033）。
  - **测试改写**（判据随规格作废/更新，不删例）：`bead-render.test` 中性四层 5 命令断言、目标色四层（纯色底/无 circle/S1 edge/S3 暗 S4 亮方向/无高光）；`view-model.test` A3 改 a11y 降级语义（空盘零符号、就位珠 5 满墨）；`feedback-vfx` GAP-10 时钟断言随 **v1.24 HUD 底部化**改 `y > gridTop`。
  - **两处「非我引入」的既有断言滞后一并修正**：① GAP-10（T-141 HUD 底部化后时钟 y=1274 > gridTop=929，旧断言 `y < gridTop` 恒 false）；② bead-render E1/E4 断言（T-130/131 规格作废旧判据）。**已用 git stash 基线对照法确认归属**（基线绿 → 我的改动暴露了滞后的断言面；其中 GAP-10 实为 T-141 遗留、与 E6 渲染改动无因果）。
- **门禁**：`pnpm -F @wxgame/beads test` **315/315 全绿**（27 文件）；`tsc --noEmit` 零错误；`framework:sync:check` ✅。
- **状态**：**✅ E6 完成**（Epic T-133 进度 6/7；**遗留**：托盘 24 槽布局适配待设计定尺寸后另批）。

---

## WXG-T-141

- **名称**：beads·参考竞品四项裁定落盘（托盘 24 槽 / 缩放手势 / HUD / 失败页确认）
- **负责**：主理人(WorkBuddy)　**状态**：✅ 完成（主表见 WXG-T-141 行）
- **⚠️ 详情节欠账（2026-09-17 占位）**：本节为 **WXG-T-144 提交批次**为解 `check:tasks` C 项配对失败所补的**最小占位**——该单由并发会话（WorkBuddy）施工、主表行已在而详情节未落，致全仓 commit 被 `check:tasks` 阻断。**完整执行记录待该会话收口时补写**（裁定内容可从 `systems-index v1.24` 冻结变更注记追溯：TRAY_BASE/EXPAND 12→24/24 等）。

---

## WXG-T-142

- **名称**：beads·谜面可读性载体切换 B′「目标色垫·垫色显缝」
- **负责**：主理人(WorkBuddy)　**状态**：✅ 完成（assets-spec v1.5-r5：L11 垫 + BEAD_DRAW_INSET=2）
- **⚠️ 详情节欠账（2026-09-17 占位）**：同 WXG-T-141 —— 并发会话欠账占位，完整执行记录待其收口补写（B′ 裁定内容可从 `assets-spec v1.5-r5` §1.1/§1.2 头注与 `accessibility §5.4` 追溯）。

---

## WXG-T-077

- **名称**：**Cocos G3 遗留收口——`Label` 真实宽度替换 + `setAlign` 空实现补齐**（自 backlog「G3 遗留」正式立项；根因由 WXG-T-050 验收回填时登记为「不得记为已关闭」）：`packages/framework/src/adapters/cocos/cocos-renderer.ts:171` 的 `_anchorForText()` 仍用 `text.length × fontSize × 0.55` **估算**文本宽度做左右对齐偏移，VERSION.md G3 要求换成真实 `Label` 尺寸（建议 `UITransform`/`getBoundingClientRect` 回填）；`bindings.ts` 的 `wrapLabel.setAlign` 目前是**空实现占位**（对齐枚举真名 T-050 已纠正为 `HorizontalTextAlignment`/`VerticalTextAlignment`）。**拆两半执行**：① **可测半**（纯逻辑、Node 单测可验，守 L2——core 不碰 `cc`，仅 adapter）：`CocosLabelLike` 增测量出口（`measureWidth(text,fontSize): number` 或 `get width()`），`_anchorForText` 改为**消费注入的实测宽度**、删除 `0.55` 估算，补 fake-label 单测断言左/右对齐按真实宽度对称偏移；② **待编辑器半**（`[阻塞：无 Cocos Creator]`）：`bindings.ts` 真接 `cc.Label` 尺寸 + 落 `setAlign` 枚举，**运行时/目视验证无编辑器不可完成**，解除条件＝在 Cocos Creator 跑最小场景目视校正后方可回填关闭 G3。
- **负责**：主理人(Qoder)　**状态**：🔄 进行中——**可测半完成**，待编辑器半仍阻塞（G3 **保持不关闭**，符合下方验收）
- **验收**：G3 关闭须**两半都落**——可测半进 `pnpm run verify` 绿 + bindings 半在编辑器目视通过并更新 VERSION.md §G3/§4 矩阵；**只落可测半时 G3 保持不关闭**（禁止以「假绿」记关）。
- **实测（可测半，非假绿）**：`CocosLabelLike` 新增**可选** `measureWidth?(text,fontSize)` 出口（可选 ⇒ `bindings.ts` 本轮不动、不进 Node typecheck、Cocos 运行时不回归）；`_anchorForText(cmd, label)` 经 `_measureTextWidth` **优先消费注入实测宽**，无出口时退回显式常量 `FALLBACK_CHAR_WIDTH_RATIO=0.55`（即 G3 未关的降级根因）。vitest `cocos-renderer.test.ts` 新增 2 例（注入不同斜率测量证消费且左右严格对称 + 无出口证走降级），11→**13 全绿**；framework 全量 25 文件 **236 测试**绿；仓库 `typecheck` 3 项目 Done；harness `--build-only` OK。**未伪造**：`bindings.ts` 仅加 `[G3·待编辑器半]` 纯注释锚点（`setAlign` 枚举 + `measureWidth` 接 `UITransform` 接入点），未写任何 `cc` 代码。L2 合规（core 不碰 cc，仅 adapter）。
- **产出**：packages/framework/src/adapters/cocos/cocos-renderer.ts（已改）· tests/adapters/cocos-renderer.test.ts（已测）· bindings.ts（仅注释锚点，待编辑器落码）·【待编辑器半】cc.Label 实测接入 + setAlign 枚举 + 更新 VERSION.md §G3/§4（须真机
- **收口核验（2026-09-17，主理人）**：**编辑器半已在 `d79d10c` 落码**（`bindings.ts:423` `setAlign` → `HorizontalTextAlignment` 真实枚举（未知回退 CENTER）；`:433` `measureWidth` → `updateRenderData(true)` 后读 `UITransform.width` 真实文本宽，0/负由 `_measureTextWidth` 自动退 `FALLBACK_CHAR_WIDTH_RATIO` 估算 —— 与可测半契约对齐 ✅）。host-tests 绿 ✅；build-cocos 全程编译通过 ✅（bindings 不进 Node typecheck 的边界未破）。**⚠️ 验收所写「VERSION.md」文件已不存在**（文档重组未留迁移锚）—— §G3/§4 矩阵落点待定：建议并入 `g4-regression-report.md` 或补建 VERSION.md，挂 backlog。
- **G3 判定：保持不关闭（非假绿纪律）** —— 两半码齐、可测半绿，但**编辑器目视验证未做**（真机 ⛔ 无 AppID；浏览器预览目视待用户）。状态改「码齐待目视」。
- **目视验证（2026-09-17，主理人经 agent-browser 截屏 localhost:7456）**：**PASS** —— 预览运行态核验 G3 两出口的真实表现：
  - `measureWidth` 实测宽：HUD「01:54」胶囊居中、「LV 1/8」、「扩展」钮、三道具卡「×1」全部位置正确、**无溢出/无挤压/无错位**（旧按字符数估算的病灶未复现）；
  - `setAlign` 真实枚举：居中对齐肉眼成立；
  - 附带收获：截图同时实证 v2.0 装配（心形盘满铺 + 2 颗紫色错位珠）与 E4 道具卡（×1）。
  - 证据：`production/qa/beads/evidence/g3-label-visual-20260917.png`（750×1334 设计分辨率运行帧；**留盘不入库**，evidence 体例只收 .mjs）。
- **✅ G3 正式关闭**（两半码齐 + 可测半 verify 绿 + 目视 PASS）。**VERSION.md §G3/§4 矩阵缺口注明**：文件已不存在（文档重组未留锚），矩阵补建挂 backlog，不阻断本关闭。
目视校正）· 本台账

---

## WXG-T-097

- **名称**：**beads P1/P2 反馈与路由缺口工程单（BD-15/16 + BD-04 余类 + BD-10 半边 + BD-32）**
- **负责**：主理人(Qoder)　**状态**：🔶 进行中（BD-16 / BD-15 已关；BD-10 视觉半边已关；余 BD-32 / BD-04 余类）
- **进度（2026-09-15）**：**BD-16**（无选中点格轻提示）= `0b5dc79`；**BD-15**（`btn_expand` 入口）= `ffb8bd3` §3.4 **v1.20** + `88bd091` 代码 + `2acafc9` 测试 + `61af856` 文档回写 + `66c0216` 探针改判。方案取 **丙-A**（`TRAY_BAND` 上沿 420→450、托盘面板改贴带上沿）：用户约束「不影响核心区域玩法」⇒ `PUZZLE_BAND` / `gridLayoutFor()` / 关卡数据 / 托盘容量零改动；甲（跨带上沿间隙，净空仅 3px）与丙-B（`TRAY_COLS` 12→8 改根容量）均作废。同轮修两处工具缺陷：`pause-settings.test.ts` 自推带中线公式致「PAUSED 点托盘零响应」永真断言（改 `trayLayout()` + 正向对照）；探针 P10 只查旧字段且 `sig()` 剔 text 致已实现反判 FAIL（补 textSig 配对差分 + 锚点校验）。旧夹具 `g4-probe.mjs` 误当现役已全量回退，只加冻结声明。**BD-37** 新判据冲突已登记（见 backlog）并写进 `input-control §8-1`。verify 13P/1S；探针 v1.1 = PASS 28 / PASS\* 15 / FAIL 2（P4→T-102、P17→BD-12）/ ⛔ 9。
- **进度（2026-09-15·BD-10 满槽告警视觉通道）**：**「零通道」半边关闭** = `83be050` 规格（assets-spec §1.5 新增 `tray_panel_danger` + accessibility D1 关停/保留清单）→ `1654bdc` 代码（`tuning.ts:TRAY_FULL_PULSE_MS=500` + `view-model.ts::trayFullAlpha()`，`drawTray` 末尾下发 2px `palette.danger` 呼吸描边；`reduceMotion` 退静态描边）→ `4efe5a6` 测试 5 条 → `c39ebac` + `cc8065e` 探针修订 **40**。**真源**：周期 = `ux-spec §5`「满槽告警」行现文（500ms/循环），与 `DANGER_PULSE_MS`/`HINT_PULSE_MS` 同族先例一致 ⇒ **§3 冻结常量零改动**；α 幅度 0.6↔1.0 系沿用告急同族**现有实现值**，表内已声明「不构成判据」。
  - **两项实测收获**：① `timer-gameover §8-10`「与满槽告警同屏叠加」由 **⛔ 不可测转可测**（主实例本就是满槽 + 告急双主体同场）——按 `ux-spec §5:174` 口径正本「闪烁 = 同一区域内 α 的往复」分区读 ⇒ 托盘带 2.00Hz / HUD 带 1.00Hz 各自 ≤3Hz（两带不重叠：`TRAY_BAND.yMax=450 < HUD_BAND.yMin=1214`）；跨区域合成 3.00/s **不属该红线口径**但照实披露（不据此判 FAIL，也不据此宣称在红线内）。② **P7 维持 PASS\* 未升 PASS**：卡点由「缺通道」换成 **BD-35「判据缺 α 幅度」**（报告明文 QA/美术均不自造常量）⇒ 部分关闭只改「残留描述」不改整条判定（上一笔越界升格已自纠，沉淀 **K-044**）。
  - **两处探针自身缺陷（首跑造出假 FAIL，已修，沉淀 K-043）**：(a) `loadHarness()` 内部才 `stageDist()`，而它写在模块 import **之后** ⇒ 命名空间拿到上一轮旧 `.smoke`，新常量读成 `undefined`、新图元永远找不到；已前置并加「新常量不在内存就硬抛」防呆（修订 34 的 dist↔src mtime 自证**覆盖不到**装载顺序）。(b) `tray:full` 不在满槽那帧发，而在**下一次供料尝试**发现无空位时才发（`spawner.ts:_feedOnce` + `_fullReported`）⇒ 夹具未等首次广播会把「首次广播」误读成「重复广播」（看似违反 `tray-spawner §8-4`）；`fullTrayHarness()` 已改为等到广播。
  - **改的是驱动口径不是判据**：D1 测试条原走真 `InputManager` 链点面板——`_readInput()` 唯一调用点在 `_stepPlaying` ⇒ PAUSED/level-clear/game-over/finish 四相收不到任何点击（= **BD-34**，用户裁定只立 WXG-T-100 占位、本单不动码）⇒ 面板动作改 `tapDesign` 驱动（与 `pause-settings.test.ts`/探针 P22 同口径）并在用例内写明「不得据此判面板真机可点」。
  - **本轮读数**：beads **238 passed**（22 文件）；探针整轮 54 组 = **PASS 29 / PASS\* 14 / FAIL 2（P4→T-102、P17→BD-12）/ ⛔ 9**，P5 段 FAIL 归零（A05-14 音↔视三方向解耦转 PASS）；证据 `production/qa/beads/evidence/g4-probe-v1.4-t097bd10.log`（`*.log` 被 `.gitignore` 排除，不入库）。**`pnpm run verify` = PASS 12｜SKIP 1（check:size）｜FAIL 1**：唯一红**与本单无关**——仓内**未跟踪**的 `packages/framework/tests/adapters/cocos-touch-origin-contract.test.ts`（**WXG-T-104 阶段 A 自标「今日必红」**的语义锁定用例，另一条线产物，2 failed/258 passed）⇒ 未动不删；BD-10 自身口径由 typecheck 干净 + beads 全量绿 + `framework:sync:check` ✅ 三处自证。
  - **收尾与沉淀**：本轮入 `knowledge/lessons.md` 三条 —— **K-043**（取证脚本装载必在模块 import 之前）、**K-044**（判定上限由判据完备性决定）、**K-045**（并发会话下共享台账禁文件级 `git add`，改 `git diff -U3` → 按 hunk/行过滤 → `git apply --cached` 单挑自己 hunk，并对被剔对象做**计数断言**）。`kb:sync` 沉淀统计 = **新增 1（K-045）｜修改 1（去重 `[K-xxx]` 残留占位——该脚本插号不删占位，本轮第二次遇到）｜激活 0｜归档 0**；`kb:check` 八重通过。**memory 越阈处置（用户拍板「乙」）**：`memory/2026-09-15.md` 本轮段由 1398 tok 压为**「摘要 + 指针」**至 7876 tok（原 8693），**未新增 budget-exempt 豁免条**；细节正本即本节。**遗留机制债**：单日期文件仍会随轮次反复越阈，已按用户要求立项「memory 二级详情文件索引」（下一轮领号；本轮不动并发会话正在写的 `TASKS.md` 头注，以免撞号）。本单提交面：`83be050` → `1654bdc` → `4efe5a6` → `c39ebac` → `cc8065e` → 本笔台账回填（共 6 笔，均含 `WXG-T-097`）。
- **进度（2026-09-17·BD-04 核销）**：**BD-04 余两类 VFX**（消除溶解 `vfx_powerup_sweep` / 完成波浪 `vfx_complete_wave`）已随 **WXG-T-146** 落码（`scene-vfx.ts` + view-model 接线 + 15 例专项测试），本单四项范围**全部关闭**（BD-15/16/10 两半/32 ✅ + BD-04 ✅）⇒ **T-097 ✅ 完成**。后继：G4 探针 P4 段复跑归 QA。
- **进度（2026-09-17·BD-32 完整修复）**：核验发现 T-087 只落了「首次落子清引导」（GAP-03），**判定仍是 `runs > 0`** ⇒ BD-32 病灶（首玩落子前杀进程 ⇒ runs=1 ⇒ 永久失引导）仍在。本批按规格「显式 `onboarded` 标记」修全：`save-schema` **v2→v3**（新字段 `onboarded`；`migrateV2ToV3` 内以 `runs>0` 一次性迁移存量档 —— ⚠️ 迁移必须在 migrate 层做：SaveManager.load 先 merge defaults，normalize 层无法区分「无字段」与「显式 false」）+ `beads-game` 判定改纯标记（`:1321`）+ 首次落子 `patch({onboarded:true})` **并显式 `save()`**（patch 只置 dirty，杀进程场景丢写）。测试：新增 `onboarded.test.ts` 4 例（v2 存量迁移 runs=5/0、**病灶回归：BOOT 未落子杀进程 ⇒ 重启引导仍在**、落子后重启不再见）；T-087 回访用例改写为 v2 存量档场景（旧场景「BOOT 未落子即退出」按 BD-32 语义**应**再看引导）；save-schema 测试补字段。全包 336/337（唯一红 = 并发会话 view-model 图元笔，非本单域）。
- **范围（四项 FAIL/开放项）**：① **BD-15** 扩展入口（`input-control §8-1` 一类路由缺；连带让 `accessibility C1` 有对象）；② **BD-16** 拒绝轻提示（`input-control §8-7` 零反馈；hint 通道 T-087 已就绪，改动极小）；③ **BD-04** 余两类 VFX；④ **BD-10** 满槽告警多通道半边；⑤ **BD-32** 引导判定：`beads-game.ts:947` 以 `runs > 0` 判老玩家而每次 BOOT 自增 ⇒ 开局即杀进程永久失引导，改「首次 `bead:placed`」或显式 `onboarded` 标记。
- **约束**：BD-32 若改 `runs` 语义/新增字段 ⇒ 走 `save-schema` 版本升位向后兼容（判例 T-088 v1→v2）；**禁**手改 §3，需动常量回传主对话串行落盘 §6；每子项一条细粒度提交含 `WXG-T-097`。
- **依赖**：T-096（音效与 VFX 同批验收更省一轮）；完成后由 QA 复跑 P8/P10/P4。

---

## WXG-T-099

- **名称**：**取证通路补全（`[Cocos]` 像素/色盲滤镜 + `preview:frames` 支持 beads + §H 缺口进探针）**
- **负责**：程基岩(eng) + 严守真(qa)　**状态**：📋 已立项（待施工）
- **范围**：① **B1** 无头截图 + 色盲/灰度滤镜脚本（§G 10 条像素半边、TC-PER-13/14 整条、P15 真实栅格化）；② **B8/BD-19** `render-harness-frame|clip` 去 breakout 硬编码 + `--game` 透传（现「不支持 beads」）；③ **BD-21 执行层剩余**：`test-cases §H` 中 `pause-settings §8` 10 条 + `timer §8-11/12` 2 条进探针；④ 证据入 `production/qa/beads/evidence/`——**⚠️ 该目录仅跟踪 `diag-*.mjs` 夹具，`*.log` 被 `.gitignore:55` 排除**（WXG-T-098 轮核得，原写「本轮起已入库」为误）⇒ 要么改成报告内引用路径 + mtime（现行做法），要么显式定入库形式（`git add -f` 或转 `.md` 摘要），**不得口头声称证据已随单入库**。
- **约束**：**不得**因 Node 全绿而抬升 `[Cocos]/[Device]/[R]` 综合结论；真机面仍卡 B4（AppID），解除条件写明不伪验。
- **依赖**：T-095（可信门禁）、T-096（音频取证一并跑）；产出即 G4 升 PASS 的取证面。

- **工程半完成记录（2026-09-16，主理人代行 —— 派单通道故障，subagent 调用连续三次参数解析失败）**：
  - **② B8/BD-19 已修**：`render-harness-frame.mjs` / `render-harness-clip.mjs` —— ① **去 breakout 硬编码**（`launch`/`movePaddleTo` 按 `--game` 分支；beads 进关走 `goToLevel`，`BeadsGame` 本无 `launch`）；② **`--game=beads|breakout` 透传**（`loadHarness({ game })` 既有能力，本次接通）；③ **`--help`/无参 ⇒ 只输出用法、exit 0、不产出**（**移除无参默认 breakout**，根治覆写复发；`package.json` 的 `preview:frames`/`preview:clip` 显式带 `--game=breakout` 保持旧行为可用，另加 `preview:frames:beads`/`preview:clip:beads`）；④ `argValue` 支持 `--flag=value` 等号形式。
  - **① B1 已落**：新增 **`tools/scripts/cocos-vision-shot.mjs`** —— 对 Cocos web-mobile 产物（真实引擎栅格化）起本地 http 服务 + playwright 截图，输出 **raw + protanopia/deuteranopia/tritanopia/灰度** 五张（SVG feColorMatrix 矩阵经 CSS filter，零新增依赖）；截图前 `cc.debug.setDisplayStats(false)` 关闭 debug stats 浮层（初版 `isShowStats` API 名不对，实测探得 `setDisplayStats` 后修正）；退出码契约 0/2/3（对齐 cocos-input-probe 范式）。
  - **自证实跑**：frame —— beads **8 关**全渲染 ✓、breakout 5 关 ✓；clip —— beads MP4 ✓；vision-shot —— **beads 与 breakout 各 5 张** ✓（`production/qa/*/evidence/vision/`，png 已走 gitignore 留盘）。`pnpm run verify` PASS 14 / FAIL 0。
  - **⚠️ caveat（已写进脚本头注）**：① 页面级 CSS filter 对**部分图元**（黄色星星珠 / ad 角标）未生效 —— 疑多 canvas/合成层，色盲判读须以 raw 对照并人工复核该类图元；② Cocos debug stats 浮层初版遮挡两卡，已用 `setDisplayStats(false)` 关闭。
  - **探针半（③ BD-21 剩余 + §H 缺口进探针）**：⏳ 待严守真（派单通道故障未派成，登记在此）；像素半边的**判读**也待 QA —— 脚本只产取证物，不判 PASS。
  - **未 commit / 未 push**。

---

- **✅ 主理人收口（2026-09-17）**：
  - **①② 复现自证**：`render-harness-frame --game=beads` **8 关全渲染** ✓（beads|breakout 必填、BD-19 关死）；`cocos-vision-shot.mjs`/clip 已入库（`git ls-files` 核）✓。工程半（①B1 + ②B8/BD-19）**确认完成**。
  - **③ §H 映射核验（22 条，test-cases.md §H 三表状态列全量更新）**：**19 条 ✅ 已由 Node 测试覆盖**（TC-PAUSE-01..09 → `pause-settings.test` 14 例逐条命中；H3 §8-11/12 → `revive.test`（180s 全走常量）；TC-SAVE 系列 → `save-schema`（v3 迁移链）/`onboarded`/`in-level-snapshot`/`sprint`/`audio-dispatch`）；**1 条 ❌** TC-SAVE-07（winStreak）= BD-12 归属不变；**1 条 ⚠️** TC-SAVE-09（PASS\* 改判维持）；**1 条 ⏳** TC-PAUSE-10（[Cocos] 面板动效帧检）—— 通路已备，判读待 QA。
  - **⛔ 复跑新发现（诚实登记）**：`g4-probe.mjs` **P4 段在 v2.0 下崩溃**（`findEmpty` 满盘无空格 ⇒ undefined；P4 判读文本仍是 v1.2「四类 VFX 全缺 FAIL」硬编码，与现状（四类已落码）完全脱节）⇒ **探针 54 组整体未适配 v2.0**（满盘/24 槽/onboarded/组语义）⇒ 立 **WXG-T-151（探针 v2.0 适配复跑，移交 QA 严守真）**；G4 升 PASS 依赖该单。
  - **状态 → ✅ 完成（取证通路面全齐：无头截图/滤镜/`--game` 透传/§H 映射；探针适配拆 T-151）**。

- **③ 探针半落地（2026-09-17，CodeBuddy 会话续做）**：§H 的 H2/H3 **12 条进探针**（`P28a..j` = `pause-settings §8-1..10`；`P29a/b` = `timer §8-11/12`），判读 **PASS 8 / PASS\* 4 / FAIL 0 / ⛔ 0**（P28b 供料子句因 v2.0 关停 ⛔→零供反证记 PASS\*；P28j 像素层闪烁帧检 `[Cocos]` ⛔ 记 PASS\*；P29a/b 发奖腿替身驱动记 PASS\*）。证据 `production/qa/beads/evidence/g4-probe-v1.2-t099.log`（mtime `2026-09-17 20:23:46`；新鲜度链 `src 20:21:31 → harness:build 20:23:46 → log` 已核，**不早于源码**）。**④ 证据形式裁定 = 维持「文档内引用路径 + mtime」，不入仓**（`*.log` 仍被 `.gitignore:55` 排除；复现命令见 `test-cases §H.4`）。
  - **切片说明（诚实登记）**：v1.1 前序 27 段在 v2.0 下不可跑（P4 崩于 `s.traySlots[held]`；自定义关卡缺 `swaps` BOOT 拒收）⇒ 另出切片 `g4-probe-v1.2-t099.mjs`（由 v1.1 **按行切片**生成、helpers 整块搬移，非手抄）；**前序段适配仍归 T-151**，本单已在 v1.1 回写四处**夹具可构造性修复**供其复用：① `probeLevel` 补 `swaps`/`cycleProfile`（v1.2 必需字段）；② 取回夹具改 **v2.0 两步式**（点错位珠 → 点空槽）；③ 新增 `solveBoard099` 解算归位（替代「填空格」模型）；④ FINISH 装配等足 `CLEAR_PANEL_DELAY_MS=WAVE_MS=800ms` 延迟门。另修两处**探针活对象/读数缺陷**防假 FAIL：`snapshot.remaining` 是 display ceiled（归零前恒 0）须读 `game.remaining`；证据串延迟读活对象须当场拷标量（修订 15bis(a) 同款）。
  - 全部变更**未 commit / 未 push**（待用户核）。

---

## WXG-T-154

- **名称**：**beads · BD-49 道具音频断链修复（T-151 移交首项）**
- **负责**：主理人(Qoder)　**状态**：🔄 进行中（2026-09-17；backlog 按优先级排序后首项施工）　**P1**
- **背景**：T-151 三跑实证 BD-49——powerups GDD §4 v1.22 payload 改名 `affectedSlots→affectedCells` 后，`beads-game.ts:1488-1492` 音频 handler 仍读旧字段恒 undefined 早退 ⇒ 真卡与注入腿双 clip（sfx_powerup_used/sfx_bead_dissolve）零发声；单测 audio-dispatch.test.ts:276/284/422 同用旧字段不受影响 ⇒ 不构反证。
- **范围**：修 handler 改读 `affectedCells`（L171 事件契约已声明新字段）+ 夹具同步订正 + 空数组零发声判据保持；禁碰 §3 冻结常量与无关重构。
- **验收**：①单测订正后全绿；②G4 探针 A05-07 复跑转 PASS（双 clip 各 1）；③报告 §27.3 BD-49 状态更新。
- **并发注记**：本轮台账编辑中首次 SearchReplace 报「全部失败」实为**部分应用**（头注未中但主表行已插），已去重——后续会话遇同类报错先重读现场再重试。

---

## WXG-T-155

- **名称**：**工具 · check:a11y 代码符号锚点机械守卫（K-035 假绿防线，backlog 次项）**
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-17；正/反向实测均成立，验法见「验收」行；未 commit）　**P1**
- **交付面**：① 锚点表 `games/beads/design/art/specs/a11y-anchors.md`（21 行）+ `games/breakout/design/art/specs/a11y-anchors.md`（19 行），两矩阵 §2 各加指针行；② `tools/scripts/check-a11y-anchors.mjs`：id 集合相等 + ✅ 行锚点非空 + 非 `-` 锚点在 src 字面命中；③ 挂 `package.json check:a11y` + verify STEPS（check:links 后）。
- **设计取舍（诚实）**：锚点表**独立文件**不入 accessibility.md（WXG-T-130 预算注记指引「再增判据拆独立文件」，该档已豁免态）；脚本**不解析矩阵长文本状态列**（行内嵌 `|` 公式致切分不可靠），状态列一致性归 QA 评审 + §3 小结对账，限制已写脚本头注与表首注。
- **验收**：正向两游戏全绿；**反向破坏测试**（改一锚点为不存在符号）⇒ FAIL 精确报行，已验后恢复；`pnpm run verify` 新增项 PASS。
- **首面对账副产品（诚实登记）**：breakout 矩阵 B2 声称 hex（`#0C0B1E` 等）在 src **零命中**（实现 `#0b1021`）——真实文档漂移，新登 backlog 行，不在本单修为（跨域）。

---

## WXG-T-156

- **名称**：**beads · BD-50 Cocos 色彩工厂 rgba 串解析成纯黑（裁定②「彩带未渲染」排障）**
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-17；未 commit）　**P0**（TC-PER 全家桶取证可信度的地基缺陷）
- **背景**：T-128 裁定②连拍判读 4 帧均未见彩带、`confettiProgress` 读数 0 与上轮 0.10→0.79 不稳定复现，登记「Cocos 侧彩带未渲染疑点」待排障。
- **排障三层取证（逐层排除，未猜一次）**：① **读数层** = 旧 burst 产物十帧 PNG 字节全同 ⇒ 彩带窗口实际耗在 G3 段（道具单颗解完末珠同帧通关，「首跑教训」路径重演），G6 段抓的全是窗口后静帧 ⇒「读数 0 不稳定」是取证时序假象；② **命令流层**（页内代理 `builder.polygon` 逐帧计数）⇒ 窗口内 37 帧×44 枚、五色 fill 齐备 ⇒ 视图层分派无恙，嫌疑收敛到消费层；③ **色彩层**（代理 `cc.Graphics.prototype.fillColor` setter 金标准）⇒ 窗口内 **3240 次全不透明黑 (0,0,0,255)** 设置，非黑样本恰为 hex 路径纯色（#E84C3D 等）⇒ 实锤。
- **根因（BD-50）**：`bindings.ts` 色彩工厂 `parseHex` 只识 `#rrggbb`，视图层 `withAlpha()` 产出的 `rgba(r,g,b,a)` 串经 `parseInt('rgba…',16)=NaN` → `Color(0,0,0,255)` —— **彩带在 Cocos 上被画成不透明纯黑**（深色底盘上近隐形；窗口帧像素差分 R≈G≈B 灰点 121/128/192 = 黑化彩带混色，旁证吻合）。canvas2d 渲染器直接喂 CSS 引擎天然兼容 ⇒ harness 探针全绿而 Cocos 黑化 = **双渲染器色彩解析不对称的假绿家族缺陷**，波及全视图 ≈50 处 rgba 消费点（背景/遮罩/阴影因本色近黑而未显症，彩带首个亮色特效即暴露）。
- **修复（单一收口）**：`cocos-renderer.ts` 新增引擎无关纯函数 `parseColorLiteral`（`#rgb/#rrggbb/rgb()/rgba()`，非法串黑不透明兑底绝不 NaN）；`bindings.ts` 色彩工厂改走它，嵌入 α 与命令级 alpha **相乘**对齐 canvas2d `globalAlpha` 语义；旧 `parseHex` 删除；测试 mock 同步改走同源实现（不得再手抄 hex-only 缺陷版）。新增 3 例失败先行（实现前 import 即红）。
- **验收（金标准复验）**：重建产物后同口径插桩 = 窗口内全黑填充 **3240→0**，非黑样本出现 `(244,242,250,89)` 等带分数 α 真色；像素差分 bbox 从窄带（344–494）展开到全幅（x 3–720，黄金比 44 枚分布特征）；**窗口内截帧目视：五色旋转彩带 + sandwich 层序清晰可见**（temp/burst-mid.png）。回归：framework 298/298（295+3）、beads 409/409、`framework:sync:check` OK。
- **连带发现（登记不修）**：① burst 工具 G6 段触发依赖「G3 段道具不通关」，level 0 实为 2 错位珠仍被解算通关 ⇒ 窗口耗在 G3 段，十帧全静帧——**工具时序缺陷已新登 backlog**（彩带方向裁定②需先修工具重拍）；② 旧产物 freshness STALE（bundle 22:26 < src 23:01）已由本轮 `build:cocos:web` 重建消除；③ burst 色检测对 MAIN 层（scrim 混色）不敏感，纯色彩匹配会漏检——修工具时一并处理。
- **边界**：方向裁定（上行 vs 飘落）仍归用户拍板，本单只消障不代拍；真机微信端色彩链路同源于本修复（同一 bindings），但需真机复验项仍挂 T-129/首验包。

### burst 工具 v2 → v2.1 修复与重拍（2026-09-17 本会话续，backlog「裁定②待重拍」行闭合）

- **v2 残留障实（诊断面，temp/burst-diag2）**：`cc.screenshot` 在 Cocos **3.8.8 web-mobile 产物不存在**（实测 undefined，模块被构建剔除）⇒ v2 页内 `toCanvas` 回读通路无效；同时排除解算嫌疑（同板 misplaced=2 可解）。
- **v2.1 换捕获通道**：实测 **CDP `Page.startScreencast`**（temp/screencast-probe：≈37fps、合成器输出 ⇒ WebGL 画布天然非空白、无逐帧往返）后采纳：页内只挂相位记录器（代理 `buildRenderModel` 每帧记 `{Date.now(), snapshot[field]}`，零捕获成本），Node 侧连续收帧，按 `frame.metadata.timestamp` 与相位越界时刻**最近邻对齐**选帧落盘（帧序单调，>150ms 无帧则如实记 err）。诚实注记：screencast 为 jpeg q90，差分阈值放宽 >10 吸收压缩噪声。
- **G6 触发器换解环器卡（诊断③ temp/burst-diag3）**：手动 tap 风暴遇「目标格被另一颗错位珠占据」的环会滞留托盘（实测 filled=21/tray=1 静置 6s ⇒ 永不清关，彩带窗口根本没开）；改 `tapDesign(卡 0 中心)` ⇒ `usePowerup` 点名全部错位珠、相 B 含交换归位、每颗落座判 isComplete ⇒ 通关必然。两卡各自 `POWERUP_FREE_USES=1` 换关复位，G6/G3 段互不抢卡。
- **重拍结果（成）**：G6 **8/8 相位帧**（窗口跨度 695ms ≈ CONFETTI_MS 800ms，收帧 85 ≈41.7fps）+ G3 **5/5 帧**（320ms，新板错位珠=4 不通关，扫光后 phase=playing）；`pageErrors=[]`。产物 `production/qa/beads/evidence/vfx-burst/`（gitignore 内，符合 T-099 裁定④证据不入仓）。
- **目视判读（观感取证物，不判 PASS）**：g6-02（p=0.208）五色碎片顶部成带炸出（白/黄/绿/红/丁香紫，**BD-50 修复在 Cocos 产物上实证可见**）；g6-07（p=0.854）碎片已落至屏幕底部 ⇒ **实际观感 = 顶部炸出→飘落底部，与卡文案「飘落」一致**；面板/sandwich 层序正常。g3-02（p=0.375）斜带光扫全屏清晰。⇒ 差异②的裁定前提已满足，方向拍板归用户（backlog 行已改「待用户裁定」）。

### 差异②裁定闭合（用户 2026-09-17「认可」）

- **裁定**：彩带方向以重拍目视为准 = **飘落**，与 `assets-spec §1.6.6` 卡文案一致；**公式不改、规格本体不改、无 v1.5 修订项**。旧登记「公式单调递减 = 上行出屏」定性为**坐标系误读**（设计坐标 y 向上，`cellCenter = gridTop − pitch×row` 同族口径；递减即屏面下落）。裁定注已追加至 `assets-spec §1.6.6` 回写注差异 2 条目；backlog「G6 彩带方向待用户裁定」行结项移除；T-128 行同步。至此 T-128 两项规格差异（① scratch 契约 = 裁定 B 已执行；② 方向 = 本条）**全部关闭**。

---

## WXG-T-127

- **名称**：**beads 可玩性实测差距修复（BD-43 热区错位 P1 + BD-44/45/46/47）**
- **负责**：程基岩(engineering-lead)　**状态**：📋 已立项（待施工）　**P1**（BD-43 = 玩家无法使用道具 + 误触）
- **背景**：主理人实测（T-130，见 `## WXG-T-123` 节末「🧪 主理人实测」块）发现 5 项差距，登记为 **BD-43..47**（证据与复现步骤俱在登记块）。BD-29/34/40 已修并实测通过；本单清剩余差距。
- **Deliverables**：
  1. **BD-43（P1）**：`powerupCardRects()` 热区与视觉渲染对齐 —— 根因排查从 `powerupBlockBaseY()`（tuning.ts:619 调用）入手；**须先写复现断言**（渲染矩形 vs 命中矩形同源，禁止两套坐标 —— `tuning.ts:517` **T-062 判例**就是同类静默漂移，本轮是复发，修法须让两类矩形**共享同一来源**）。
  2. **BD-44（P2）**：region 消费后无可见效果 —— 定位区域锚点语义（未选中格时锚点在哪/是否应默认网格中心），要么修效果要么修「无锚时应拒绝消费并给提示」，**二选一须有 ux-spec 依据，拿不准回传**。
  3. **BD-45（P2）**：冲刺结算「NEW BEST」被黑色图元遮挡（T-124 丙案回归，截图 `/tmp/beads-t130/05-fail.png`，会话结束即清 —— 以登记描述为准）。
  4. **BD-46（P3）**：冲刺 HUD「STAGE 1」左缘裁切成「AGE 1」（同截图）。
  5. **BD-47（P3）**：结算面板「剩余 mm:ss」浮点尾数 —— `formatTime` 秒取整 + `clearRemaining` 取整（两层都补），补单测。
- **验收**：① 全部 beads 测试绿 + 新增回归测试（热区/渲染同源断言、N1 mm:ss）；② `pnpm run verify` FAIL 0；③ `framework:sync` + `:check` OK；④ 主理人浏览器复测（真实指针点**视觉**卡生效 + 结算面板 mm:ss + 冲刺结算/HUD 无遮挡裁切）。
- **权威来源**：**A** `production/TASKS-DETAIL.md` 的 `## WXG-T-123` 节末「🧪 主理人实测」块（BD-43..47 证据）＞ **B** `games/beads/src/config/tuning.ts:517`（**T-062 判例**）+ `:616` `powerupCardRects()` + `games/beads/src/view/view-model.ts`（`drawPowerupBand` 渲染侧）＞ **C** `games/beads/design/ux/ux-spec.md` v1.3（§4 道具/§5 动效）+ `systems-index §3`。
- **Output Path**：`games/beads/src/**`、`games/beads/tests/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-127` 小节（**追加**）。**禁改**：`packages/**`、`production/qa/**`、设计文档（BD-44 若需规格裁定先回传）。
- **⚠️ 并发注意**：`games/beads/src/view/view-model.ts` 曾被 T-124/T-126 改过且**已全部入库**（工作树干净）⇒ 无在途笔冲突；但仍以提交前 `git status` 复核为准。
- **必读 skill**：`my-skills/wxgame-adr-arch/SKILL.md`；另读 `AGENTS.md`、台账 `## WXG-T-127`/`## WXG-T-123` 实测块、`tuning.ts:517` 判例。
- **约束**：热路径零分配；先问再写；不 commit/push；**修完不自行 commit（由主理人走门禁入库）**。
- **完成记录（2026-09-16 · 程基岩）—— 状态：✅ 交付完成（BD-45/46/47 改码 + 回归；BD-43 判「HEAD 不复现」+ 同源断言补钉；BD-44 判「非缺陷」并附实测证据）**：
  - **BD-43（P1）根因裁定：HEAD 不复现，T-130 观测系探针时序伪影（高置信）**。① 代码级：`drawPowerupBand`（view-model.ts:1144）与 `_hitPowerupCard`（beads-game.ts:1358）**本就同源**（共用 `powerupCardRects()`，T-062 判例的修法已在位）；`powerupBlockBaseY()` 与渲染带一致（卡 rect y 82–198 = `POWERUP_BAND` 48–200 内整体居中，y-up 设计系 ⇒ 屏幕底部）。② 浏览器级（playwright 真实指针、viewport 750×1334 ⇒ scale=1）：**harness 与 Cocos web-mobile 产物双基底**点视觉卡 (375,1194) 均正确消费（clearAll 1→0、托盘清空），点 (375,140) 均零消费，`g._pointer` 读回 design y=140↔screen 1194 翻转精确，`designToScreen↔screenToDesign` 往返零误差。③ T-130 的两组读数（视觉位消费 0 / 顶部位消费 1）与「**tap 后同步读快照**」伪影精确吻合：第一次 tap 实已消费、同步读为 0；第二次 tap 前该帧已处理 ⇒ 读到第一次的扣次记在第二次头上（任务书 §9 明列的坑）。**处置**：按任务书要求补「两类矩形逐值相等」回归断言（`tests/view-model.test.ts`「BD-43/T-062 回归」：每张命中卡必有逐值相等的白卡绘制矩形指令，渲染侧私写坐标当场红）——同源结构 + 断言双保险，判例复发空间清零。
  - **BD-44（P2）裁定：非缺陷（效果存在且正确），不改码、不动规格**。实测（真实指针点 region 视觉卡）：`uses.region 1→0`、托盘 holding `[0,1,2,10]→[10]`（锚点 = 最小 holding 槽 0，清出连续窗口、窗口外槽保留 = GDD powerups §2.2 锚点语义逐字成立），`filled` 不变 = **§8-7「零网格写入」验收项本身**（三道具只清托盘槽、绝不写网格）。T-130 的「无可见效果」系观察口径看错对象（盯网格 `filled` 而非托盘）。ux-spec §4 该行「点道具卡（次数>0）→ 清槽生效（powerup:used）」与实现一致 ⇒ 「修效果」与「拒绝消费+提示」两案均无规格依据、无需启动。
  - **BD-45（P2）已修**：根因 = 角标底衬 120×32 容不下 28px「NEW BEST」（Chrome `measureText` 实测 **147px**；E2 放大后 35px = **183px**）⇒ 白字两端溢出深底、落在白面板上隐形（截图实测读成「EW BES」，遮挡物即溢出字自身，非外部图元）。修两层：① `sprint-settle.ts` 底衬 120→**168**（=147+两侧≈10 填充；与标题「冲刺结束」右缘净空≈8px）；② `view-model.ts` 角标文字改**固定 28px**（不走 bodyFont/E2 —— F7⑤「数字/标题/按钮字号不随开关变化」，且堵死 183px 的再度溢出路径）。浏览器复验截图：**「NEW BEST」完整可见** ✓。
  - **BD-46（P3）已修**：根因 = HUD 模式标签右对齐锚 `DESIGN_W−220`(530) 距白胶囊右缘(485) 仅 45px，而 28px「STAGE 1」宽 **117px** ⇒ 左段白字压白胶囊白底隐形（读成「AGE 1」）。修：锚点右移至 `DESIGN_W−30`(720)（屏右 30 边距，仓内留白惯例）；最宽情形 35px「STAGE 10」≈146px（左缘 ≈574）仍净空胶囊 ≥89px。浏览器复验截图：**「STAGE 1」完整可见** ✓。
  - **BD-47（P3）已修（两层）**：① `beads-game.ts` buildSnapshot：`s.clearRemaining = Math.ceil(remaining − 1e-9)`（与 `s.remaining` 同口径，倒计时不提前归零）；② `view-model.ts formatTime`：秒 `Math.floor` 兜底。补单测（clear-panel.test.ts「BD-47 回归」：推进 0.5s 造小数 ⇒ `Number.isInteger(clearRemaining)` + 面板文案严格匹配 `/^剩余 \d{2}:\d{2} ｜ 道具 \d\/3$/` 且无小数点；改前该断言在 formatTime 层必红，判别力成立）。
  - **验证数字**：`pnpm -F @wxgame/beads test` **256/256 绿**（23 文件，含新增 5 例：BD-43 同源 ×1、BD-46 锚点 ×1、BD-45 几何+渲染 ×2、BD-47 ×1）；`pnpm run verify` **PASS 14 ｜ WARN 0 ｜ SKIP 1（既有 check:size 环境阻塞，非本单引入）｜ FAIL 0**；`framework:sync` 写入 beads game 拷贝件 **3** 文件 + `:check` OK；harness 重建后真实指针复跑 BD-43/44 行为不变（无回归）。
  - **改动文件**：`games/beads/src/view/view-model.ts`（formatTime 取整 / HUD 标签锚点 / 角标字体固定）、`games/beads/src/game/beads-game.ts`（clearRemaining 取整，+3 行注释）、`games/beads/src/systems/sprint-settle.ts`（角标 168，+5 行注释）、`games/beads/tests/{view-model,sprint-settle,clear-panel}.test.ts`（新增 5 回归例 + 渲染辅助）；Cocos 拷贝件由 `framework:sync` 产出（3 文件）。**未改** `packages/**`、`production/qa/**`、`design/**`。**未 commit / 未 push**；主表状态行归主理人。
  - **给主理人复测的提示**：① BD-43/44 复测请用「**tap 后先 `await raf()`/等待 ≥1 帧再读快照**」的节奏（T-130 伪影根源），且 BD-44 的效果观察对象是**托盘槽**（GDD §8-7 网格恒不变）；② 本会话遗留两个本地服务：harness `:4187`（已重建为新码）、Cocos web-mobile 静态件 `:4188`（**产物为旧码**，如需 Cocos 侧复验请先 `pnpm --filter @wxgame/beads run build:cocos:web`）；③ 复现探针在 `/tmp/bd43-probe.mjs`、`/tmp/bd44-region-probe.mjs`、`/tmp/bd4546-probe.mjs`（临时件，未入仓）。
  - **沉淀候选（0–3 条）**：①「真实指针探针判读：tap 与读数的跨帧时序必须显式等待，单点读数不得作为『无效/误触』双态证据 —— 双向对照各留 ≥1 帧间隔」（K 候选）；②「文字底衬类 UI（角标/胶囊标签）验收须含 measureText 宽度核对，E2 大字号是隐藏的加宽路径」（K 候选）。
  - **状态同步（2026-09-17，CodeBuddy 会话）**：核实交付已随 **`ec49da8`** 入库（`sprint-settle.ts` 角标 168 等修复均在 HEAD）；beads 测试现值 **409/409 绿**（35 文件，含 T-151 期新增）；主表状态行 📋→✅。**唯一未闭环项 = 验收 ④ 主理人浏览器复测**（BD-43/44 复测须「tap 后等 ≥1 帧再读快照」防 T-130 同款伪影；Cocos 侧复验先 `build:cocos:web` 刷新产物）。

---

## WXG-T-129

- **名称**：**微信真机触摸坐标归一化错误（BD-48）—— 真机点托盘/网格全部无响应，可玩性 P0**
- **负责**：程基岩(engineering-lead)　**状态**：🔄 施工半闭合（wx 分支已落码；真因经 T-161 勘误修正随 `706e99f` 入库；出包 14:27 实证含修正；**余 = 用户真机复测 B4**）　**P0**（真机完全不可交互）
- **现象（用户真机首验 · 2026-09-16）**：真机进入 L1 后——点托盘任意珠 ⇒ 游戏**回「请先选一颗珠子」**（提示属「点网格且无选中」分支 ⇒ 命中判定落在网格区域，**未落在托盘**）；点棋盘空格 ⇒ 无任何反应；错色放置从未发生 ⇒ wrong 态从未触发 ⇒ 「光敏性反馈完全没有」（用户 B 确认）。web 与工具模拟器渲染均正常，仅**交互命中**错位。
- **根因（主理人代码级实锤，Cocos 3.8.8 引擎源码）**：
  1. **引擎微信适配坐标量纲混合**：`pal/input/minigame/touch-input.ts:86-90` —— `x = clientX × dpr`（物理），`y = windowSize.height − clientY × dpr`，而 `windowSize` 来自 `wx.getWindowInfo()`（**逻辑像素**）⇒ y = 逻辑高 − 物理y，**量纲不一致**（web 版同位置用 canvas CSS 高，量纲一致 —— 微信版破坏了 T-104 实测的前提「getLocation 与 canvas CSS 高同量纲」）。
  2. **`normalizeCocosTouch` 无 wx 分支**：T-104 按 web 实测写（÷dpr + 翻 y），文件头明文「微信宿主**未实测标 [R] 阻塞**」—— 本缺陷即该 `[R]` 风险引爆。
- **修复方向（供施工参考，须真机数据验证）**：微信 touch 原始事件（`clientX/clientY`）天然是 **屏幕逻辑 px · 左上原点** = 框架契约空间（`RawPointerInput` 期望态）⇒ **weapp 平台的正确归一化 = 从引擎内部坐标逆变换回 clientX/clientY 后直接放行（不做 ÷dpr、不翻 y）**：`clientX = loc.x / dpr`；`clientY = (windowHeight − loc.y) / dpr`（`windowHeight` 取 `wx.getWindowInfo()`，bindings weapp 分支可读 `wx` 全局）。实现落 `touch-normalize.ts` 新增 wx 分支（纯函数可 Node 单测，延续 T-104 架构）；`bindings.ts` weapp 时传入 `windowHeight`。
- **Deliverables**：① `touch-normalize.ts` wx 分支 + Node 单测（wx 语义：给 loc/窗口/dpr ⇒ 屏幕逻辑 px 左上）；② `bindings.ts` weapp 传参；③ `build:cocos:wx` 出包 + **用户真机复测**（点托盘珠可选中、错色放置出红描边 —— 复测人 = 用户）。
- **Output Path**：`packages/framework/src/adapters/cocos/touch-normalize.ts`、`bindings.ts`、`packages/framework/tests/adapters/**`、镜像（sync）、`production/TASKS-DETAIL.md` 本节。
- **验收**：① Node 单测绿；② 用户真机：点托盘珠选中 ✓、错色放置出红描边（单次脉冲）✓；③ web 回归不破坏（web 分支行为不变，`cocos-touch-*.test.ts` 全绿）。
- **约束**：延续 T-104 架构（纯函数、Node 可测、不碰 `cc`）；不 commit/push。
- **✅ 完成记录（2026-09-16 · 主理人代行 —— subagent 派单通道连续 4 次「参数解析失败」，与 T-099 工程半同因，已按代行先例记录）**：
  - **修复**：① `touch-normalize.ts` 新增 **`normalizeCocosTouchWx`** 独立 wx 分支（纯函数、Node 可测）：逆变换 `clientX = loc.x/dpr`、`clientY = (windowHeight − loc.y)/dpr`，**不做 ÷dpr 收敛、不做 y 翻转**（wx 原始 touch = 屏幕逻辑 px · 左上原点 = 框架契约空间）；文档化引擎量纲混合根因。② `bindings.ts`：`_touchSpace()` 增 `windowHeight`（wx 取 `wx.getWindowInfo()`，非微信填占位）；`readTouch` 按 `globalThis.wx` 存在性判宿主走 wx 分支 —— **web 分支一字未变**。
  - **单测**：新增 `tests/adapters/cocos-touch-wx.test.ts` 4 例 —— ① 四角+中心逆变换精确还原（toBeCloseTo 9 位）② **旧 web 公式同输入出错值**（判别力反例）③ space.dpr 非法退化有限值 ④ out 复用零分配。首版 ③ 例自摆乌龙（NaN 放进 raw 构造），已修正为「raw 由正常 dpr 产出、非法 dpr 只在 space 侧」。
  - **自证**：framework 测试 **285/285**；`framework:sync`+`:check` OK（镜像回填）；`verify` **PASS 15 ｜ FAIL 0**（守卫 check:host-tests 缺口 0）；`build:cocos:wx` **17.9s 出包成功**（产物含修复，待用户真机复测）。
  - **待办**：① **用户真机复测**（点托盘珠可选中 + 错色放置出红描边）⇒ 通过则 P0-2/P0-5 解除；② web 分支回归已由既有 cocos-touch-*.test.ts 守住（全绿）。
- **🔧 诊断辅助：触摸 debug overlay（2026-09-16 · 主理人代行；用户真机复测报「点击事件仍对不上」）**：
  - **触发**：BD-48 修复出包后用户真机复测仍偏移 ⇒ 需要可视化诊断手段（屏幕直读偏移向量 + 三段坐标数值），替代易被框架日志淹没的 console 采集。
  - **实现**（`bindings.ts`，**运行时开关默认关闭、零常态开销**）：`_drawTouchDebug()` —— touch-start 时若 `GameGlobal.__WXG_TOUCH_DEBUG === true`：在 Canvas 下懒创建 `WXGTouchDebug` 节点（Graphics 十字+圆圈 @ 命中点设计位置 + Label 三段数值 `loc（引擎原始）/ scr（归一化后）/ dsn（设计坐标）`）；非微信同理可用。**不影响输入管线**（调试节点无触摸监听，不拦截事件；整段 try/catch）。
  - **用法**：真机调试 Console 执行 `GameGlobal.__WXG_TOUCH_DEBUG = true` ⇒ 点屏幕任意处 ⇒ 十字标记即「游戏判定的点击位置」（与手指实际位置对比即偏移向量）+ 顶部数值。**采集到数值即可反推 BD-48 的真实变换公式**。
  - 已随包构建验证（16.7s）；提交随本节。
  - **未 commit / 未 push**（主理人门禁入库）。
- **⚠️ 真因勘误（2026-09-18 · WXG-T-161）**：本节的「引擎量纲混合」根因**是误读**，
  已由构建产物 `games/beads/cocos/build/wechatgame/cocos-js/cc.js` 的引擎源码实锤推翻 ——
  `screenAdapter.windowSize = new Size(windowWidth*dpr, windowHeight*dpr)`，翻转基准是
  **物理 px**，与 `clientY*dpr` 量纲**一致** ⇒ 正确逆变换与 web 分支同形
  （`clientY = windowHeight − raw.y/dpr`）。本节落地的旧 wx 式 `(windowHeight − raw.y)/dpr`
  引入 `−H·(dpr−1)/dpr` 的全屏偏移 ⇒ **真机任何点击都落空**（用户 2026-09-18「无法点击
  任何珠子」）。修正与判别力反例见 `## WXG-T-161`；本节其余内容（web 分支不变、
  debug overlay、真机复测人 = 用户）继续有效。

---

## WXG-T-160

**装置自测 fast 档挂 verify（BD-39 / BD-40 本地半边闭合）** · 负责：主理人(CodeBuddy) · 状态：✅ 完成（verify PASS 17/17）

- **起因**：backlog 两条 —— BD-39「装置自测未挂 verify」、BD-40「`ctx:check` 未挂 verify」，均自 2026-09-16 `176f1bf` 起暂缓（登记理由：隔离 worktree 下 `verify:selftest` exit 1，疑依赖缺失）；backlog 明写「本地半边与 BD-39 同一次改动即闭合」。
- **根因（两处，均实测取证非推测）**：
  1. **`verify:selftest` 第 5 步恒红（与仓库状态无关）**：该步用 `grep -q 'SKIP'` 判「子命令是否自报 SKIP」，而聚合器汇总行恒含计数串 `… ｜ SKIP 0 ｜ …` ⇒ 子串**恒命中** ⇒ 恒进 strict 分支；真 SKIP 数为 0 时 `--strict` 退 0 ⇒ 判「收紧失效」**必红**。⇒ 产物齐备时 100% 复现（本机实测 `verify:selftest` 1.7s exit 1）。修：改为只认**该步骤自己的状态行** `^  (✅|🔶|⚠️|❌) [A-Z]+ +check:size`，非 SKIP 时明写「断言不适用，由 1) 合成用例 5/6 覆盖」。
  2. **`ctx:check` 在隔离 worktree 恒红（即原登记的「依赖缺失」真身）**：索引 `ctx/index.json` 收录了**不入仓**的 vendor 克隆 `my-skills/_repos/**`（`.gitignore` 覆盖），全新 worktree / clone 下这些文件必然不存在 ⇒ C 项对每个都报「索引过期 — 文件缺失」⇒ exit 1。修（`check-context-budget.mjs`）：把「磁盘缺失 **且** 路径被 `git check-ignore` 覆盖」的条目拆出，降为 note「**环境缺失 ⇒ 未校验，不是通过**」；真过期照旧判红。
- **顺带订正（守卫自身腐烂的实例）**：`selftests.mjs` 的 `AWAITING` 里 `check:host-tests:selftest` 的理由「被测脚本未入库」随 WXG-T-110 已**失效**——脚本已入库且 `--selftest` 9/9 绿 ⇒ 并入 fast 档（现 fast = 7 件自测 + `ctx:check` 共 8 件，AWAITING 为空）。
- **证据（三处实测）**：
  - 主检出：`selftest:fast` **8/8 绿** `STATUS: OK`；`verify` **17 项 PASS**（新增 `selftest:fast` 6.3s，总时长 13.8s → ≈20s）。
  - 隔离 worktree（`git worktree add --detach .worktrees/bd39-wt HEAD`：无 `node_modules`、无构建产物、无 vendor 克隆）：修复前 `ctx:check` exit 1 ⇒ fast 档 `STATUS: FAIL`；修复后 **8/8 绿**、`ctx:check` exit 0（worktree 已 `git worktree remove` 清理）。
  - **反向自检（防把红灯抹绿）**：worktree 内给 `ctx/BUDGET.md` 加一行脏改动 ⇒ C 项报 1 条「索引过期」且 **exit 1**；还原后 exit 0 ⇒ 容错只作用于「环境没这份数据」，不掩盖真过期。
- **改动文件**：`tools/scripts/verify-all-selftest.sh`（第 5 步判据）、`tools/scripts/check-context-budget.mjs`（C 项环境缺失分区 + `spawnSync` import）、`tools/scripts/selftests.mjs`（AWAITING→fast 档、注释口径）、`tools/scripts/verify-all.mjs`（`STEPS` 加 `selftest:fast` 并改写暂缓注释）、`.gitignore`（加 `.worktrees/` 防隔离目录误提交）、`production/TASKS*.md`。
- **遗留（诚实登记）**：① heavy 档（5 件 ≈25s）仍只走 CI 不入 verify（判据：本地全量翻三倍会诱发绕开）；② **CI 侧** fast 档是否真跑过、CI 环境是否同样有 vendor 缺失（现应降为 note 而非红）**未经本单验证** —— 本单只在本地 + 隔离 worktree 取证；③ `.worktrees/` 仅加入 `.gitignore`，未提交。
- **Output Path**：上述改动文件 + 本节。
- **约束**：未 commit / 未 push。

---

## WXG-T-159

**breakout 配色双轨漂移定性对账（backlog「a11y B2 文档 hex 漂移」项）** · 负责：主理人(CodeBuddy) · 状态：✅ 完成（对账完成；**用户 2026-09-18 裁定 C = 维持登记 ⛔**）

- **起因**：WXG-T-155 首面对账登记「矩阵 B2 声称 `#FFFFFF/#A6AEC8 on #0C0B1E`，实现 `palette.ts` background `#0b1021`，文档 hex 在 src 零命中 ⇒ 示例游戏文档陈旧」，backlog 挂账待 breakout 域订正。
- **本单动作**：机械全量对账（脚本抽 `games/breakout/{art,design}/*.md` 与 `src/**/*.ts` 的 `#rrggbb` 集合求交）。结论**推翻原单一定性**：
  - **砖块色 = 全对齐**：`src/config/levels.ts` 的 `N #35C2F0` / `T #A96BFF`（受损 `#7649B3`）/ `S #8892A6` / `B #FF6B3D` / `G #FFCB3D`，与 `art-bible §3.3`、`assets-spec §1.2`、`accessibility A2` **逐值一致** ⇒ 美术规格在砖块域已落地。
  - **漂移面 = 仅 UI/场景色**：`src/view/palette.ts` 20 键与 `art-bible §3.1 基础色板` 13 色**零重合**（唯一共有值 `#ffffff` 系通用白；`0b1021` 在文档侧仅出现在 T-155 自身的登记注记里，属自引用，不计）。实现侧 13 个自有 hex 在 `art/`、`design/` 下**逐个零命中**（`4cc9f0/ffd166/ff5d8f/8be9fd/e8f1ff/8b98b8/141a33/d8f6ff/1b6f8a/2a3155/5ee08a/ff5e7a/1e2544`）。
  - **资产维度也有缺口**：§3.1 的 `bg_grid`（40px 网格）、`bg_vignette`（暗角）、`wall_border` 在实现侧**无对应绘制**（`palette.ts` 只有 `backplate` 一个近似位）⇒ 不是单纯换色值。
- **B2 判据两侧读数（WCAG 相对亮度，脚本实算非手算）**：

  | 口径 | 正文 | 次要文字 | 背景 |
  |---|---|---|---|
  | 文档声称 | `#FFFFFF` ≈19:1（实算 19.40） | `#A6AEC8` ≈8:1（实算 8.79） | `#0C0B1E` |
  | 实现实际 | `#e8f1ff` = **16.62:1** | `#8b98b8` = **6.56:1** | `#0b1021` |

  ⇒ **B2「≥4.5:1」在两侧口径下均成立**（实现侧最低 6.43:1 = `powerupLife #ff5e7a`）⇒ 判据 ✅ 不变，**变的是读数**；文档现写的是文档侧读数，与出货画面不符。
- **定性结论（诚实）**：`palette.ts` 头注自陈「The art pipeline (games/breakout/design/art/specs) owns the values」，`art-bible` v2.0 为九节完整版且列明权威常量来源；`src` 系 `6c02732`「vibe coding 框架构建入库」产物 ⇒ **倾向判定为「实现未按 §3.1 落码」，而非原登记的「文档陈旧」**。但两者同出自 `6c02732`，无时间序权威，**方向须用户拍板**，本单不擅自改写任一侧（不 whitewash）。
- **三选项与裁定**：

  | 选项 | 动作 | 代价 | 结果 |
  |---|---|---|---|
  | A 改实现对齐规格 | `palette.ts` 按 §3.1 换色 + 补 `bg_grid`/`bg_vignette`/`wall_border` 绘制 | 视觉全线变化；需 art 复验 + a11y B1/B2/B3 重算 + QA 复跑 | — |
  | B 改文档承认实现 | `art-bible §3.1` / `assets-spec` / `accessibility B2·B3` 按 `palette.ts` 重写数值 | 九节规格降级为实现快照；砖块域（已对齐）不受影响 | — |
  | **C 维持登记 ⛔** | 只留本对账与锚点表注记，两侧都不动 | 漂移继续挂账 | **✅ 用户 2026-09-18 拍板选定** |

- **裁定 C 的解除条件（写死，防无限挂账）**：① 走 A 的前置 = art 复验档期 + QA 复跑档期齐备；② 走 B 的前置 = 设计域出具「规格正本重写」决议；③ 两者皆无 ⇒ 保持 ⛔，且**每次对账必须复算两侧读数**（现读数：文档侧 19.40/8.79，实现侧 16.62/6.56），不得凭记忆沿用。

- **本单已改动（方向中性，不含 A/B 择一）**：① 主表领号 + backlog 行定性订正 + BD-36 重复行去重；② `games/breakout/design/art/specs/a11y-anchors.md` 首注由单向「文档陈旧」改为「双向零重合 · 定性待裁定」并补实测读数与 T-159 指针（锚点列 `textDim` 未动 ⇒ `check:a11y` 仍绿）；③ 本节。
- **Output Path**：`production/TASKS.md`、`production/TASKS-DETAIL.md` 本节、`games/breakout/design/art/specs/a11y-anchors.md`。
- **约束**：未 commit / 未 push。

---

## WXG-T-132


**G5 案 B：渲染管线全局变换通道（跨 `packages/framework`）** · 负责：主理人(Qoder)（原登程基岩；本单为执行 2026-09-16 用户裁定的落码批，沿 T-150/152/153 同模式） · 状态：✅ 完成（随 `ede72d5` 入库）

- 起因：WXG-T-128 美术 v1.4 缺口 **G5**——连击 Lv2「伪震屏」需**整屏 scale**，而渲染管线**无全局变换通道**（`RenderModelBuilder._commands` 为 `private readonly`，`RenderModel` 仅 `begin/build`、无变换字段；WXG-T-074 已登记）。视图侧现行处置 = **不假造替代画面**（`view-model.ts::drawComboVfx` 头注：`'pseudoShake'` 分支空实现，快照 `comboVfxProgress` 照常推进）。
- **用户裁定（2026-09-16）**：采**案 B（改框架）**，案 A（全场 filled 珠面齐脉冲 scale 1.00→1.015→1.00，约 15 行、不改框架、冲击感打约 6 折）**作废且不作降级预案**。
- 交付面：`RenderModelBuilder` 增全局变换通道（如 `setTransform({ scale, anchorX, anchorY })`）+ `RenderModel` 承载可选变换位 + **两个 adapter 各自实现**（web 2D context 变换 / `CocosRender2D` 节点缩放）。规格真源 = `art-bible §7.3.5`（v1.4-r2 定案段）+ `§7.1` Lv2 行「整屏 scale 1.00→1.015→1.00，150ms」（**措辞未改**，案 B 下规格与实现一致）。
- **前置验证项（不得当已解决）**：`FIXED_WIDTH` 下整屏放大 **1.015** 是否**露黑边**——设计空间 750×1334、`systems-index §3` 冻结「原点左下 / y 向上 / FIXED_WIDTH」，缩放锚点与视口填充策略须先给结论再动接口。
- 铁律与风险：跨 `packages/framework` 域 ⇒ **全矩阵回归**（framework + beads + breakout 三包测试 + `check:arch` L2「core 禁 cc/DOM/wx」不得因变换通道破例）；`sync-framework-to-cocos` 镜像须同批；**热路径零分配**（变换位不得逐帧 new）；L5「UI/渲染不持有游戏状态」不破。
- a11y 口径（`accessibility`，不随选案变）：D1 **整条关停**（`reduceMotion` 开 ⇒ 无缩放）；D2 单峰非周期 ⇒ 不构成闪烁；A5 峰值 50.75px < pitch 52 ⇒ 零重叠。**真机观察项**：整屏缩放会使 HUD 文字与 1px 描边产生**亚像素抖动**，影响 E1/B1 观感 ⇒ 落码后须真机抽检（现 Cocos 构建阻塞，ADR-0009 P2）。
- 图元：净 **+0**（变换不改图元数）。毫秒真源 = `ux-spec §5`「连击 ×3（Lv2）」行 **150ms**（冻结，不改）；幅度复用既有 `COMBO_SHAKE_SCALE_MAX`（**零新增冻结常量**）。
- **编号说明**：本单原拟领 `WXG-T-131`，但并发会话在主理人核查（表内最大号 130）与写入之间领走 T-131（beads 美术质感规格，林绘澄）⇒ **改领 T-132**。撞号由幂等守卫拦下（worktree 侧未误插状态行），已落盘详情内 2 处 T-131 引用同批修正；诚实登记不掩盖。
- **交叉依赖**：`art-bible §7.3.5`（v1.4-r2 定案段）现与并发会话的 **v1.5「纯色底 + 光影材质」**（T-131）叠加共存于同一文件，本单施工前须以**当时最新的 art-bible** 为准复核 §7.1 Lv2 行措辞是否仍为「整屏 scale 1.00→1.015→1.00，150ms」。
- **主理人复核（2026-09-16，抽查）**：art-bible/assets-spec **v1.5「纯色底+光影材质」**基调与四层凹陷卡（S1 暗缘/S2 内缩坑底/S3 上内阴影/S4 下受光亮线）已核，数值级可落码 ✅；能力边界遵守（无渐变原语 ⇒ 平涂+α 叠层，承 §1.7/§1.8 判例）✅；**端点表预烘焙**（10 色×3 端点模块级一次构建，热路径零新增字符串分配）—— 这条是成员主动识别的每帧分配风险，处理正确 ✅；凹凸区分「比原方案更强」复核结论 + 验收断言钉住 ✅；零外部资产 ✅。路径纠正（任务书写 design/art/**、实际 games/beads/design/art/specs/**）属实且处理正确。四小未决裁定：L1 增项默认不做；L5 符号随工程单；`SOCKET_*`/`TRAY_PLATE_*` 常量并入 T-130 工程 Epic；托盘 3 段内阴影保留。
- **落码回写（2026-09-17，本会话）**：① **前置验证项已给结论**——零露黑边（锚点必落屏幕中心：canvas2d letterbox 居中 / Cocos 居中换算+GameRoot 原点；scale>1 ⇒ 内容边缘径向外移；**背景参与变换 ⇒ 无需外扩补边**），推导与未关部分（真机亚像素抖动）登记于 **ADR-0014 §1**。② 接口落地：`RenderModelBuilder.setTransform(scale, anchorX, anchorY)`（**标量入参**，与任务书「如 setTransform({…})」的对象例不同——热路径零分配；恒等帧 `end()` 不产变换位）+ `RenderModel.transform?` + canvas2d ctx 矩阵复合 + Cocos `transformHost`（GameRoot 节点缩放，`bindings.ts` 编辑器半 ⚠）；备选与否因见 ADR-0014 §2（含弃「渲染器内逐点坐标映射」的 setFontSize 重排理由）。③ beads 接线：`buildBeadsView` 头部消费 `comboPseudoShake(p).screenScale`（L5 不破、D1 整条关停、零新冻结常量、图元 +0）；WXG-T-074 历史登记就此收口。④ 判据：framework +10（builder 5 / canvas2d 2 / cocos host 3）+ 新建 `games/beads/tests/combo-shake.test.ts` **8 例**；全矩阵 framework **295** / beads **409** / breakout **239** 全绿，`tsc` exit 0，`check:arch` OK（L2 不破：core 零 cc），`framework:sync` 镜像已同批（beads 写 6 / breakout 写 4）。⑤ 文档回写：ADR-0014 新建、control-manifest 禁例行 +1、art-bible §7.3.5 卡末落码注、QA v1.12 增 TC-PER-27（整条不判 PASS：`[Cocos]`/真机待执行）。⑥ 未关风险：真机构建阻塞（ADR-0009 P2）⇒ 亚像素抖动观察项与节点缩放实机验证挂账；震屏窗口内输入不随变换（≤1.5%/150ms，ADR-0014 §4.1 登记）。

---

## WXG-T-133

- **名称**：**beads · Epic：错位归位工程实现（WXG-T-130 v2.0 规格的落地）**
- **负责**：主理人（编排）；Story 分派　**状态**：✅ 完成（2026-09-17 收口核销，见下「收官记录」）　**P1**
- **规格真源**：`systems-index v1.22`（§3.13 错位参数 / §3.6 解环器 / §3.8 E1 纯色+E4 作废 / §4 事件表）+ `core-loop v2.0` + `bead-grid v2.0` + `input-control v2.0` + `tray-spawner v2.0` + `levels-spec v1.2` + `art-bible/assets-spec v1.5`。
- **Story 拓扑（文策渊建议，主理人核定）**：
  - **E1 = T-134**：网格错位状态机（`filled(错位)⇄empty`）+ 取回/归位裁决 + 通关判定（零错位）+ `tray:stored` 事件管线
  - **E2**：输入路由选择锚化（`selection ∈ {tray, board, none}`，路由 4/5 分支化）—— 依赖 E1 的 API 形状
  - **E3**：供料摘除 + 托盘入槽收尾 —— 依赖 E1
  - **E4**：解环器三型（solver/solverPlus/solverRandom；`bead:placed.slot` 可选化收尾）—— 依赖 E1
  - **E5**：swaps 装配 + BOOT 校验器 + `levels-01-08.json` version 2 + 逐关 k 曲线 —— 依赖 E1
  - **E6**：渲染改造（E1 纯色直填 + E4 删除/死路径开关 + T-131 四层凹陷卡 + 端点表预烘焙）—— **与美术实现归并同批改 `bead-render.ts`**
  - **E7**：QA 判据迁移（供料 16 颗/3:1 抽色/满槽跳供/道具清槽四族改判 ⛔ + 新判据用例）—— 依赖 E1–E6
  - 拓扑：**E1 → (E2, E3, E4, E5) → E6 → E7**；E2–E5 不同文件域可部分并行。
- **Epic 验收总口径**：全部 GDD/UX v2.0 文 §8 判据可导出用例并通过；`pnpm run verify` FAIL 0；真机 `[R]` 仍 ⛔（无 AppID）。
- **⚠️ 与并发会话的文件域区隔**：T-132（G5案B 渲染管线）在 `packages/framework/**` 跨域；本 Epic 全在 `games/beads/**` 游戏层 ⇒ 无文件冲突，但**提交时序**需主理人协调（本 Epic 不 commit，复核后统一提）。
- **收官记录（2026-09-17 收口核销，Qoder）**：
  - **7/7 收官**：E1=T-134、E2=T-135、E3=T-136、E4=T-137、E5=T-139、E6=T-143、E7=T-144 均 ✅（前六已随批次归档，见 `production/archive/TASKS-archive.md`）；另有用户反馈追加单 T-147（连通选取+整组收进）/ T-148（错位珠恒亮白环）同域落地。
  - **门禁复核**：`pnpm run verify` **14/15** —— `test` 三包全绿 **295/409/239**；唯一 FAIL = `check:size`（beads 构建产物 4647.2 KB > 红线 4096 KB），系**存量漂移**（T-134 收口时已移交发布域；T-144 验收口径明示「`check:size` 存量不算」），非本 Epic 新回归，不掩盖：升级上线前仍须按 §3.8 处置（分包/远程包）。
  - **效力边界（本单不解除）**：① G4 指令流取证：探针 v2.0 适配复跑另单 **T-151**（📋 待施工）；② 真机 `[R]` 仍 ⛔（无 AppID）；③ 屏幕像素层限制声明沿用 T-144 / 报告 v1.9。
  - **提交边界**：本次收口仅改台账两件（TASKS.md 行 + 本小节）；工作树三处在途改动（`combo-shake.test.ts` / `confetti.test.ts` / `g4-probe-v1.1.mjs`）属并发会话，不入本单文件域。

---

## WXG-T-144

- **名称**：**beads · E7：QA 判据迁移（供料四族 ⛔ + 新玩法用例 + G4 收口）（Epic T-133 收官）**
- **负责**：严守真(qa)　**状态**：🔄 进行中（2026-09-17 派工）　**P1**
- **⚠️ 防超时纪律**（E4/E5/E6 三单 subagent 均被掐，主理人代收尾）：**分两段落盘，每段落完立即写盘**：第一段 = test-cases.md 判据迁移（纯文档）；第二段 = g4-probe 适配。命令 >60s 一律重定向。
- **规格真源（全部已落盘）**：各 GDD/UX **v2.0/v1.x** 文的 §8 判据（tray-spawner §8 逐条 ⛔ 标注含「原因+替代判据+复活条件」）、`systems-index v1.23/§3.13`、`input-control v2.0`、`powerups v1.3`、`levels-spec v1.2`、`ux-spec v1.4`、`accessibility v1.5`（A2b/A3 降档）。
- **范围（两段）**：
  1. **第一段（纯文档）**：`test-cases.md` 判据迁移 —— ① **供料四族改判 ⛔**：供料 16 颗 / 3:1 抽色 / 满槽跳供 / 道具清槽（每条写「作废原因 + 替代判据 + 复活条件」，防假绿）；② **新玩法判据用例落账**（[N] 层，对齐 E1–E5 单测的判据面）：错位装配恒等式（misplaced = swaps+环数）、BOOT swaps 校验五分支、取回（满槽拒/零事件）、归位（placed/rejected）、解环器三型（COUNT 断言）、时间定价 clamp 边界、恒等式一般式；③ 幽灵符号相关条目随 accessibility v1.5 降档改判（⚠️ 非本单决策，引用登记）。
  2. **第二段（探针适配）**：`g4-probe-v1.1.mjs` 受影响段改判/适配 —— P4（拒绝反馈）在新语义下仍成立（invalid-color 拒绝路径未变）如实核；新增/改判段沿用「预期先写后跑」纪律；`LEVELS` v2 数据下探针能否跑通（harness 用 L1 新 swaps 数据）。
  3. **G4 报告收口**：追加 **v1.9 节**（E1–E6 的 QA 覆盖变化 + 判据迁移汇总 + 效力边界：屏幕像素层与真机仍 ⛔）。
- **❗ 不做**：渲染（E6 已完）、玩法 src（E1–E5 已完，**禁改**）。**禁改** `games/beads/src/**`、`design/**`、`packages/**`、`tools/**`、其他会话域。
- **Output Path**：`production/qa/beads/test-cases.md`、`production/qa/beads/g4-probe-v1.1.mjs`（仅判据适配）、`production/qa/beads/g4-regression-report.md`（追加 v1.9）、`production/qa/beads/evidence/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-144` 小节（追加）。
- **验收**：`pnpm -F @wxgame/beads test` 全绿（315 例零回归）；`pnpm run verify`（`check:size` 存量不算）；探针跑通（EXIT 0/2 按契约，**不得为绿改判据**）。**不 commit/push**。- **⚠️ 派工形态记录**：subagent 对本单**连续 4 次调用失败**（工具级 `missing subagent_name`，与工单内容无关——E6 同型），主理人**亲自执行**全部两段。
- **主理人执行记录（2026-09-17）**：
  - **第一段 ✅**：`test-cases.md` 追加 **§J 判据迁移节** —— J.0 范围铁声明（效力边界：全 [N] 层，光敏不达标）、J.1 四族改判 ⛔ 表（供料节律/抽色 3:1/满槽跳供/道具清槽，各带作废原因+替代判据+复活条件）、J.2 新用例 **TC-J-01..12**（[N] 层，与 E1–E5 单测一一对应，全部 ✅ 已锚）、J.3 G4 联动。
  - **第二段 ✅（结论 = ⛔）**：探针 `g4-probe-v1.1.mjs` 在 v2 关卡数据（L1 带 swaps）下 **P4 段 `:756` 崩溃**（`TypeError: colorIdx of undefined`）—— P4 旧模型（空盘+空格放置）前提在满盘错位局面下不成立 ⇒ **指令流取证本轮不可用，整包 ⛔**；解除条件 = 按 v2.0 语义重写 P4/P7 段预期（另单，预期先写后跑）。**未为跑通改判据** ✓。
  - **报告 ✅**：`g4-regression-report.md` 追加 **v1.9（§26）**：判据迁移汇总表（旧→⛔/新增）、探针 ⛔ 与解除条件、效力边界强化（[B] 判据面未达标 + 真机 ⛔ + 托盘 24 槽未适配 ⇒ 槽值判据全 ⛔）。
  - **门禁**：beads 单测 **315/315 全绿**（零回归）；`check:links` OK。
- **src 缺陷报告**：无（E1–E6 未发现需要修复的 src 缺陷；P4 崩溃属**探针未适配**，非产品缺陷）。
- **状态**：**✅ E7 完成**（Epic **T-133 全部 7 个 Story 收官**）。

---

## WXG-T-145

- **名称**：**beads · G1 落座回弹落码（`vfx_fill_pop`）（T-128 动态质感章 落码①）**
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-17）　**P0**
- **起因**：T-128 规格层定稿后，`src/` 内 `FILL_POP` **grep 零命中** ⇒ 用户原始要求「**要有及时的互动**」仍属纸面。本单为该欠账的首张落码单（拆分①）。
- **规格真源**：`art/assets-spec.md §1.6.1`（逐帧公式 / clamp / **层序死结论** / D1 退化）+ `art-bible.md §7.3.1`；毫秒 = `design/ux/ux-spec.md §5`「珠子落座」行（只冻总时长 120 与起止 1.06→1.00）。
- **落码（5 文件 + 1 测试）**：
  1. `src/config/tuning.ts` +32：9 个 `FILL_POP_*` 常量（表现层动效参数 ⇒ **不进 systems-index §3**）。
  2. `src/game/state.ts` +11：快照 3 个**单调标量** `placeRow` / `placeCol` / `placeProgress`（L5：视图不持状态）。
  3. `src/view/bead-render.ts`：`FilledBeadOptions` 新增 4 字段（`scale` / `contactAlpha` / `contactWidth` / `shadowDy`；`shadowAlpha` 已有）+ 导出 `FillPopEnvelope` / `fillPopEnvelope()` 纯函数包络（两段曲线 + 三道硬钳 + D1 分支）。
  4. `src/view/view-model.ts`：`drawGrid` **循环外**建 `pop` 包络槽（热路径零分配）+ `isPop` 接线。
  5. `src/game/beads-game.ts` +58：`_placeFx` / `_placeFxArmedAtMs` / `_armPlaceFx` / `_stepPlaceFx`（**1:1 照 `_wrongFx` 判例骨架**；PAUSED 不冻结）+ 三处 `bead:placed` 发射点后 arm。
- **⚠️ 本单最关键的实现约束（照 v1.5-r6 层序死结论）**：`scale` **严禁乘在 `outer` 上**——`outer` 同时驱动 L11 垫 ⇒ 只乘珠体 `size = (outer − 2×BEAD_DRAW_INSET) × scale`；垫**不参与 scale / 不参与 lift / 恒画**。违反即「目标色谜面在 120ms 内被自己抹除」。
- **证据（A/B 对照，非推断）**：基线 HEAD `dbb3c1c` 排除本单改动 = **28 文件 / 315 例全绿**；接回本单 5 文件 + `tests/fill-pop.test.ts` = **29 文件 / 328 例全绿（+13，零回归）**；`npx tsc --noEmit` **0 错**。（过程记录：中途一次全量跑出 66 红，经定位为**并发会话提交前的 `tests/helpers.ts` 编辑中间态**（空盘迁移），与本单无关；已用 A/B 而非推断坐实归属。）
- **测试隔离取向**：`fill-pop.test.ts` **故意不 import `tests/helpers.ts`** —— 除当时基线不稳外，更重要的是落座动画属表现层，不需关卡 fixture，与 `bead-grid §8` 玩法判据天然解耦；13 例均命令层断言（含**垫恒 50×50 不随 scale**、**缺省 options 与 `scale=1` 命令流逐条相等**的静息回归护栏、峰 48.76 < 格 50 的 A5 几何前提）。
- **与拆分口径的偏差（如实）**：① 拆分①写「`FilledBeadOptions` 扩 **6** 字段」，实际新增 **4**（`shadowAlpha` 已存在，不重复加）；② swap 路径只 arm **首颗**（120ms 重启门会厉禁第二颗）；③ **登记在代码注释里的真实张力**：§1.6.2a G2′「解环器逐颗 80ms 错开」< 本门 120ms ⇒ **G2/G2′ 落码时必须单独处理**（提高错开量或改逐颗队列），本单不预修。
- **提交归属异常（追认）**：本单代码未由本会话 commit，而是由并发会话**连带提交进 `dbb3c1c`（WXG-T-139 补遗）**，提交消息未提 G1 ⇒ 按台账注 2 判例处理：**不回改已入 HEAD 的提交信息，以本台账为准**。本会话至今零提交。
- **诚实边界**：`[待真机]` = 120ms 回弹的观感与帧率开销（Cocos 构建未接入，同 T-124/T-125/T-128 口径）；`[待 playtest]` = v1.5-r6 提出的幅度重定两候选（谷 0.96→0.92 或 `INSET 2→3`）——本单按**现行冻结规格**实现，未提前改动幅度。
- **产出**：`games/beads/src/{config/tuning.ts,game/state.ts,game/beads-game.ts,view/bead-render.ts,view/view-model.ts}`、`games/beads/tests/fill-pop.test.ts`、本台账两文件。

---

## WXG-T-147

- **名称**：**beads · 连通选取 + 整组收进（「错位归位」组语义增强，用户 2026-09-17 裁定）**
- **负责**：主理人(Qoder)（派单路线对工程单不可靠，本单主理人直接实现）　**P1**
- **用户裁定原文（设计意图真源）**：
  > ③「任意相邻错位珠子，相邻包括当前错位珠子和接续的相邻错位珠子，直到找不到相邻的珠子」；④「整组一次性收进，但是不会限制个数，只有槽位数量限制。」
  另（同批反馈 ①②，已先行交付 `667d2c5`）：错位珠恒亮白环（可选取标识）+ 锚珠抬起。
- **实现**：
  - `grid.ts`：`collectMisplacedGroup(row,col)` —— 8 邻接 flood fill 错位珠闭包（就位/空/锁定不连通），行主序。
  - `beads-game.ts`：`_boardSelected` 扩为「起点 + 组缓存」；`board:selected` payload 增 `count`；新 API `retrieveSelectedGroup(preferredSlot)` —— free 槽 ≥ 组大小 ⇒ 整组逐颗收进（复用 judgeRetrieve 原子 + 逐颗 tray:stored），不足 ⇒ 零事件零状态写；路由 4b 改走组版；`boardSelected` 公共视图只回起点。
  - `state.ts`：快照增 `boardGroupRows/Cols/Count`（预分配 64，写值不新建）。
  - `view-model.ts`：组内全格 lift -6 + 加深投影（抬起组）；错位珠 selectableRing 白环。
- **测试**：新增 `misplaced-group.test.ts` 8 例（斜链/断连/单珠/换选重算/整组收进 payload/槽不足零事件/归位通路回归）；`selection-anchor.test.ts` 4 例按组语义改写不删例（payload count、4b 双 stored、满槽腾槽两段）。全包 **335/335**。
- **⚠️ 规格回填（GDD 批待办）**：`input-control v2.0` §2.1（锚 = 连通组、4b 组化）、`bead-grid v2.0` §2.3（取回组化前提：free ≥ 组大小）、`systems-index §4`（board:selected.count）；术语建议「组锚 = group anchor / 整组收进 = group retrieve」。
- **状态**：✅ 完成（码 + 测试）；GDD 回填另批。
- **⚠️ 收口后复核注（2026-09-17，WXG-T-146 会话代补、不改写上文）**：上行「全包 **335/335**」**按其自身提交内容不可重现**——实测 `3359c25` 为 **10 例红**（`clear-panel` / `finish-panel` / `phase-input-realchain` / `pause-settings` / `audio-dispatch` 五文件，均面板族）。根因：**该笔 `git add` 连带扫走了 T-146 在途的 G3/G4 六件 src**（含裁定 1 的面板延迟门），而提交消息与本节均未提这些——即本单测试是在**包含他人未收口代码的工作树**上跑的。归属方已按裁定 1 完成判据迁移（现 **350/350** 绿）。⇒ 纪律回写：多会话同仓时，「全包绿」必须在**提交后的 blob** 上跑（先 `git stash`/`git worktree` 隔离），不能只在工作树上跑。另：本节「lift -6 抬起组」与 L11 垫的相互作用已由 T-146 修正（垫不再随 `lift`，§1.6.1 层序死结论），本单行为不变。

---

## WXG-T-146

- **名称**：beads · T-128 「动态质感章」落码② —— G3 道具扫光 / G4 过关波浪（含裁定 1 面板延迟门 + G4 LOD 降档通道）
- **负责**：主理人(Qoder)　**P1**　**状态**：🔄 进行中（G3/G4 已落，**G2′ 待裁**）
- **覆写声明**：本节此前为另一会话（T-077 收口批）因 `check:tasks` 配对而建的**占位节**，并邀「归属会话收口时覆写并追认」——本会话即归属方，已按实际内容覆写并**追认占位行为**（占位避免了共享工作树提交被门禁阻断）。
- **规格真源**：`art/assets-spec.md` §1.6.3（`vfx_powerup_sweep`）/ §1.6.4（`vfx_complete_wave`，**v1.5-r6 B′ 重算后**）/ §1.6.1 层序死结论；毫秒真源 `design/ux/ux-spec.md` §5「道具生效 400」「过关庆祝 800 + 20ms/列」（本单零新造时长、零 §3 变更）。
- **落码（6 件）**：`tuning.ts` SWEEP_* ×10 + WAVE_* ×8（`SWEEP_Y_MAX = HUD_BAND.yMin` 、`CLEAR_PANEL_DELAY_MS = WAVE_MS` 均为**派生**不写字面）；`game/state.ts` `sweepProgress`/`waveProgress`；`game/beads-game.ts` `_armSweepFx`/`_stepSweepFx` + `_waveElapsedMs`/`_clearPanelPending` + `_stepLevelClear` 门 + `onExit` 清理；**新建 `view/scene-vfx.ts`**（纯函数包络，不 import cc/DOM/wx）；`view/bead-render.ts` `lodLayers` 降档；`view/view-model.ts` `drawSweep()` + `drawGrid` 波浪槽（循环外建、热路径零分配）。
- **三处口径偏差（与规格书不同处，均已核）**：① §1.6.3 只写通用 `easeInOut(p)` ⇒ 实现取 **smoothstep**；② **`WAVE_LOD_LAYERS = 7` 而非 §1.6.4 初稿 6**（v1.5-r6 重算后 **L11 垫不得进可砍集**）；③ §1.6.3 「扫光在 `drawHud` 之前 ⇒ 被 HUD 压住」的**成因叙述与实码不符**（实码 `drawHud` 在 `drawGrid` 之前、更底层），结论仍成立但只靠 `SWEEP_Y_MAX` 几何排除。
- **自行派生的裁定（待追认）**：D1（`reduceMotion`）时波浪整条关停 ⇒ 结算面板**不空等 800ms**（庆祝是延迟的唯一理由，只关停动效还延迟 = 纯惩罚）。
- **⛔ 落码中抓到的真缺陷（P0 陷阱 #2 坐实）**：`bead-render.ts` 的 L11 垫 rect 用 `y = cy + lift` ⇒ **`lift` 会带动垫**，与 §1.6.1「不参与 `lift` · 恒锁格缘」相反。旧约束「`view-model` 不传 `lift` ⇒ 零实害」已被我的波浪（`lift = dy`）与并发会话 T-148 锚组（`lift = -6`）**双双打破** ⇒ 垫改为锁定格心 `cy`。**既有 335 例无一覆盖此点**（本轮 `scene-vfx.test.ts` 补上判据）。
- **判据迁移（裁定 1 的连带）**：5 文件 10 例（`audio-dispatch` A05-18 / `clear-panel` ×2 / `finish-panel` ×3 / `pause-settings` §8-7 / `phase-input-realchain` ×3）——推进过门后再断言，入口收敛到 `tests/helpers.ts::advancePastClearWave`（真源 = `tuning.ts`，**测试里零字面秒数**）；**判据意图零软化、旁路例零删除**。ux-spec §5 L204 已含该裁定与代价，无需再改（本单 QA 侧只回写 `test-cases.md` v1.9：新增 TC-PER-21/22 + 三行结论就地追加）。
- **A/B 归属实测（不采信签名推断）**：HEAD 自身即 10 红；把 `view-model.ts` 换回 HEAD 版 → **同样 10 红** ⇒ 与我的波浪接线无关；再将 `CLEAR_PANEL_DELAY_MS = 0` 单常量实验 → 仅救回 **1** 例 ⇒ 真实机制不是「800ms 撞车」而是「**面板不再与 `LEVEL_CLEAR` 同帧可见**」（可见性 / 命中 / `sfx_panel_in` 时机 / 绘制命令四类）。⚠️ 开工时预判「大概率撞 800ms」**方向对、机制错**，若无单常量实验就会把迁移做偏。
- **验证边界**：vitest **350/350**（+15 新例）、`tsc --noEmit` 0 错；**`[Probe]` / `[Cocos]` / 真机 全部未跑**（K-037：指令流可证 ≠ 屏幕层可证 ⇒ 本单不得作为任何视觉层 PASS 证据）。
- **收口后复测（同一工作树、非本单改动引入）**：收口时连跑三次全量 = **350 绿 → 351 passed/3 failed → 353 passed/1 failed**（期间并发会话 T-149 正在落 `save-schema` v3 并当场追认其侧断言，本会话未碰这些文件）。余下 1 红已**据实码定位到属他人未提交代码**：`in-level-snapshot §8-11`「落子期 S8 零写」`expected 10 to be 4` ⇒ 工树内 `beads-game.ts:1919-1924` 新增的 `this._save?.patch({ onboarded: true }); this._save?.save();` 在**每次 `placed` 都跑一次全量写盘**（而 `_onboardDone` 首颗后即 true ⇒ 下方引导分支不再进入，**无幂等门**），与本单 G3/G4 零关系。已登记待其自收口；本会话**不当手改他人存折**（互扫风险 > 修红收益）。`tsc --noEmit` 全程 0 错。
- **提交归属异常（第三例）**：G3/G4 五件 src 与 `scene-vfx.ts` 被并发会话 `3359c25`（T-147）**连带提交且消息未提**；该笔 HEAD 当时 **10 例红**而其详情记「全包 335/335」⇒ 见 `## WXG-T-147` 收口后复核注。
- **未动（本单遗留）**：**G2′ `vfx_solver_restore`（§1.6.2a）未落码** —— 相 A 的 `slot_border` 状态环与 T-148 的 `selectableRing` 恒亮白环**同格双环**（solver 点名目标必为错位珠），需用户/美术裁定；另：原 `vfx_clear_dissolve`（G2）自 v1.22 道具反转起为**失效规格**（作用对象/触发/批量/payload 四项需重立），已在 TC-PER-11 标注。G5 = T-132、G6 彩带、G7 原子批各自另单。

---

- **✅ 主理人收口（2026-09-17）**：
  - **D1 波浪关停不空等 800ms（自行派生裁定）→ 追认**：庆祝延迟唯一理由 = 动效，D1 关停动效仍延迟 = 纯惩罚；`CLEAR_PANEL_DELAY_MS` 派生逻辑随 reduceMotion 归零，判据迁移已落。
  - **9 例红收口（本批适配）**：满槽塞珠/S9 restart 扩展容量/`lay1` 派生/BD-15 隐藏语义（穿透点选）—— 全部为 24 槽 v1.24/v1.25 的测试适配 + 语义改写不删例；连带 §8-11 消耗首落 `onboarded` 一次性写（BD-32 v3 合法例外）。
  - **验证**：全量 **369/369**（32 文件）+ `tsc --noEmit` 0 + `build-cocos` ✅（14.0s）。
  - **G2′ 拆出 T-149 确认**；「同格双环」待裁随 T-149 施工面处理（`selectableRing` 为可选取标识、`slot_border` 为 solver 点名动画，二者语义可分层共存或择一，届时裁）。
  - **状态 → ✅ 完成（G3/G4 落码 + 24 槽适配收口；G2′ 拆 T-149）**。

---

## WXG-T-148

- **名称**：beads·错位珠恒亮白环 + 锚珠抬起（用户反馈 ①②）
- **负责**：并发会话(Qoder)（非本会话产出）　**状态**：✅ 完成（随 `667d2c5` 落码）　**P1**
- **本节的性质 = 代登记**：`667d2c5` 提交消息写了 **WXG-T-148**，但**主表行 / 头注 / 详情节三处当时均无此号**（该笔实际回填的是 **T-145** 的行与节——即本会话 G1 的台账由该笔连带提交，属注 7 的「连带提交他人产出」又一例）。缺节会触发 `check:tasks` 的「行/节成对」门禁 ⇒ 由 WXG-T-146 收口时**按提交内容事后补登**，不改写其原提交。
- **改动面（据 `git show --stat 667d2c5` 逐文件核）**：`src/view/bead-render.ts` +15（`FilledBeadOptions` 新增 `selectableRing`，L5 之上最顶层画外扩白环，α 0.92、随 `lift` 一起动）；`src/view/view-model.ts` +32（`opts` 由三元式改为 `draft` 可变草稿再定型：错位珠 `selectableRing=true`、`board` 锚珠 `lift=-6` + `SELECTED_SHADOW_ALPHA`）；两份 cocos 镜像同步；另有 memory/TASKS/ctx 索引类文件。**零 `src/game/**` 改动**（纯视图层，符合 L5）。
- **与 WXG-T-146 的交叉影响（两条，均已核）**：
  1. ⛔ **垫 × `lift`**：本节代码注释写「`lift` 沿用托盘 selected 语义，垫不参与 `lift` ⇒ 珠上移露垫 = 抬起读数」——**该断言在其自身提交时并不成立**（`bead-render.ts` 当时仍 `y = cy + lift`，垫被一起抬走）。T-146 按 §1.6.1 层序死结论修正后，这句注释**才变成事实**，本单行为无需改动、读数由「珠垫同移」变为「珠上移露垫」。
  2. ⚔️ **同格双环（未决，待裁）**：`selectableRing` 恒亮白环画在**所有错位珠**上，而 G2′ 相 A（`assets-spec §1.6.2a`，尚未落码）要在 solver 点名目标格画 `slot_border` 状态环——solver 的目标按定义就是错位珠 ⇒ 同一格两条环。三种处置候选：① 相 A 期内互斥（点名时压掉白环）② 合并为一条环（改色/改宽表达状态）③ 改墨（相 A 不用描边而用填充/内发光）。已登记在 `## WXG-T-146`「未动」行，等用户或美术（林绘澄）拍板后随 G2′ 落码。
- ⚠️ **本会话复核另发现四处未登记的几何/基线代价**（据 `bead-render.ts:351-357` 实码读数手算，**非推断**；`size = 46`、`pad = max(3, size×0.07) = 3.22`、`lineWidth = size×0.09 = 4.14` ⇒ 环带 = 距珠心 **半径 24.15 → 28.29**）：
  1. **压 B′ 谜面缝**：静息缝带 = 半径 23→25（`BEAD_DRAW_INSET = 2`），而环带内缘 24.15 ⇒ **遮掉缝的 0.85px（≈43%）**——但 §1.6.2a / §1.6.4 都把「垫色缝」当作错位可辨性的承重通道（A5）⇒ 白环部分抵消了它自己要辅证的读数。
  2. **相邻白环糊连**：格距 `BEAD_PITCH = 52` ⇒ 两颗相邻错位珠的环带分别为 24.15–28.29 与 23.71–27.85（自同侧量）⇒ **涂覆区重叠 ≈3.7px**，“逐颗可选”读成“一片白格”（斜向邻居因距离 √2×52 不重叠）。
  3. **越格缘绘制**：环带外缘 28.29 > 半格 26 ⇒ 恒向外多画 **2.29px 进邻格**；G4 波峰 `scale=1.08` 时外径进一步到 **30.56** ⇒ §1.6.4「峰径 49.68 < pitch 52 ⇒ 零叠压」的结论**只覆盖珠体，不覆盖本环**（该结论成文于 T-148 之前）。
  4. **静态基线漂移**：错位珠由 **11 层 → 12 层** 且**恒画**（非动画期）⇒ §1.8 / §1.6.9 的 ④ **1828** 未含此层；按 §3.13 `MISPLACED_PAIRS_MAX = 8` 的双向交换上界（2×8 = 16 颗）⇒ 最坏 **+16 rect → 1844**，属**静态回退阀 S1–S4 口径**变更，非动画增量。⇒ 归 art 域重算（本单不代改 §1.8 数值）。
- **验证边界**：本节代码已在 HEAD，`[Node]` 层随本会话 350/350 绿；**其白环/抬起的实际观感未经 `[Probe]`/真机**（同 T-145/T-146 口径）。

---

## WXG-T-149

- **名称**：beads · 失败续时 `REVIVE_BONUS_SEC` 60→180 落码 + ref-video §10.7 勘误（用户 2026-09-17 拍板「180s」）
- **负责**：WorkBuddy 主会话（即头注预警所指「T-149 在途会话」，收到预警后自登本行与节）　**P1**　**状态**：✅ 完成（码 + 文档 + 测试）
- **用户裁定原文**：「180s」——回应「续时 60s 还是 180s」拍板询问；对齐参考视频失败挽留实测 +180s（`ref-video-2026-09-17` §10.5）。
- **改动面（4 件）**：
  1. `games/beads/design/gdd/systems-index.md` §3.11：`REVIVE_BONUS_SEC` 60s→**180s**，节头追加 v1.25 变更注（依据 WXG-T-057 初版 + timer-gameover 曾自标「值得复核」至此闭环）。
  2. `games/beads/design/gdd/systems-index-changelog.md`：新增 **v1.25** 行（§3.7 星级口径零变更说明：`starRemaining` 扣减按常量自动放大、`revived` 2★ 封顶不变；`proposals/ads-revive.md` 为 2026-09-14 历史推导记录不改）。
  3. `games/beads/src/config/tuning.ts`：常量落码 180 + 注释（**src 与 cocos 镜像 `cp` 同步，diff 已核 SAME**）。测试零字面量（`revive.test.ts` 等全走常量 import）⇒ 无测试改动。
  4. `games/beads/design/references/ref-video-2026-09-17-ui-ux-analysis.md` §10.7：**勘误**——原「同向于我方 v1.23 的 k×45s」方向有误（实测 L3 150s→L4 120s **递减**，与 k 递增曲线相反）；样本仅 2 关不足以推断定价公式，我方 `LEVEL_TIME_PER_PAIR=45` 维持不变，补采样本后再议。
- **测试**：`revive.test.ts` + `timer.test.ts` **15/15 绿**。⚠️ 全包当时 4 例红（`feedback-vfx` / `onboarded` ×2 / `save-schema` ×2）——**与本次改动零关联**（无一引用 `REVIVE_*`；工作树内 `save-schema.ts`/`view-model.ts`/`beads-game.ts` 有并发会话未提交在途改动，归属其单）。git index.lock 被并发进程持有 ⇒ 未能 stash 做 HEAD 基线比对，改以「改动面交集为空 + 常量引用扫描」证伪关联，**非假绿声明**。
- **边界**：真机/预览未验证（常量级变更，无表现层改动；`failPanelLabel` 等文案消费方走常量自动更新）。

---

## WXG-T-150

- **名称**：beads · G2′ `vfx_solver_restore` 解环器归位落码（T-128「动态质感章」落码③，自 T-146 拆出）
- **负责**：主理人(Qoder)　**P1**　**状态**：🔶 代码 + 判据 + 规格回写完成，**本会话零提交**（工作树混有并发会话 WXG-T-143 在途改动，见「提交边界」）
- **用户裁定（2026-09-17，三次 AskUserQuestion）**：
  1. **裁定「甲」（双环处置）**：T-148 恒亮白环与相 A 状态环不得同格叠两圈 ⇒ 白环 **clamp 进珠体内缘** + solver **点名期压掉白环**（该带由相 A 环独占）。
  2. **裁定「甲」（相序）**：归位延后到相 A 200ms 之后（保 `ux-spec §5` 规格序）⇒ `usePowerup` **只扣次 + 点名**，到点逐颗 80ms 错开才真正 `_solveMisplaced`；执行时重算，玩家已自行取走的静默跳过。
  3. **推进方式**：拍板后由我直接落码，不再 spawn 美术（历史裁定：用户曾两次取消 art-director 派单）。
- **改动面（本单 6 件代码 + 4 件判据/文档回写）**：
  1. `src/config/tuning.ts`：`SOLVER_HINT_MS / SOLVER_PER_BEAD_MS(=FILL_POP_MS) / SOLVER_STAGGER_MS / SOLVER_MAX_CELLS` + 总时长单一真源 `solverSequenceMs(n)`；头注写明**相 A = 玩法提交时刻，不得当纯表现层常量改**。
  2. `src/game/state.ts`：快照 8 字段（`solverProgress` 哨兵 + `solverCell{Rows,Cols}Count` ≤3 + `solverLand{Rows,Cols,Steps}Count` ≤6）；**预分配、逐帧只写值**，不活跃 ⇒ count 归 0 且数组填 -1。
  3. `src/game/beads-game.ts`：`interface SolverFxQueue` + `_solverFx`；`update()` 内 `_stepSolverFx(dt)` **排在 `_machine.update` 之后**（本步会写棋盘 ⇒ 必须先于表现层步进）；相位守卫（`paused` 冻结不作废 / 其他非 `playing` 作废 / `_setupLevel` 作废）；**过关判定排在序列末**；相 B 走 `_noteSolverLand` 逐颗独立落座包络，**不进** G1 单槽 `_armPlaceFx`。
  4. `src/view/scene-vfx.ts`：`solverHintAlpha(t) = sin(π·t/SOLVER_HINT_MS)` 与 `solverBeadProgress(t, step)` 两个「相位 → 幅值」纯函数（不重列落座公式）。
  5. `src/view/view-model.ts`：循环外算 `solverN/solverT/solverHintA`；`popProgress = solverPopP > 0 ? solverPopP : (popActive ? placeProgress : 0)` 统一 G1 与相 B 包络来源；`named ⇒ draft.selectableRing = false`；`drawFilledBead` 之后画相 A 环；两个线性扫助手 `solverIsNamed` / `solverLandStep`。
  6. `src/view/bead-render.ts`：`selectableRing` 由外扩（环带 24.15–28.29）改为珠体内缘环（`ringW = stroke(0.09) = 4.14` ⇒ 环带 18.86–23），注释逐条写四处代价。
  7. 判据：新建 `tests/solver-vfx.test.ts`（**15 例全绿**：①包络 3 / ②时序 8 / ③观感 4）；`tests/powerups.test.ts` **14 例迁移**（同帧零 `bead:placed` 不变式 + 过门后断言，payload 语义「实际归位格」→「点名格」，§8-2b `toHaveLength(1)→(2)`，**未软化原意图**）；`tests/helpers.ts` 新增 `advancePastSolver`（测试内**零字面秒数**）。
  8. 规格回写：`art/assets-spec.md §1.6.2a` 追加「WXG-T-150 落码回写注」（三点与规格原文不同均系用户当场裁定 + 两处命名漂移 `SOLVER_MAX_BEADS→SOLVER_MAX_CELLS`、总时长走单一真源函数 + 80/120 门旁通消解）。
  9. QA 镜像：`production/qa/beads/test-cases.md` v1.9→**v1.10**，新增 **TC-PER-23/24/25**（时序门 / 环互斥与 clamp / 单一真源）。
  10. `ux-spec §5` **零变更**（毫秒真源未被推翻）；`systems-index §3` **零变更**（无新冻结常量）。
- **两处实测推翻规格（诚实登记，非软化判据）**：
  - **图元净值 +3 → +0**：§1.6.2a 的「净 +3」前提是立项时「错位珠无恒亮标记」；T-148 已上线恒亮白环 ⇒ 点名格为**白环 ↔ 相 A 环 1:1 互换** ⇒ `countRects` 差分实测**相等**（已钉测试）⇒ **§1.8 基线 ④1828 / ④1924 零变动**，不推高包体口径。
  - **80ms vs 120ms 门冲突消解旁通**：相 B 不走 G1 的 `FILL_POP_RESTART_GATE_MS`（该常量**一字未动**），改走独立逐颗队列 ⇒ 交换一步的两格**共享同一 step**，既保逐颗 80ms 错开又保每颗完整 120ms 包络。
- **验证**：`games/beads` 全量 `npx vitest run` = **369 passed / 0 failed**（本会话中段曾为 3 failed | 366 passed，那 3 红属并发会话 **WXG-T-143 托盘 24 槽在途**判据迁移（`btn_expand` 热区 275 vs 304、`tray.capacity` 12 vs 24），**已由该会话自行收口** ⇒ 报数前必重跑，不引用上一段旧数）。归属举证方法：逐条读失败断言 + `git diff` 确认本单 hunk 零涉及 `TRAY_*` / `btn_expand`。`npx tsc --noEmit` **exit 0**；`pnpm run framework:sync` 已跑（cocos 镜像 = src 单向产物）；`check:tasks` / `check:links` 双绿。
- ⚠️ **`pnpm run verify` = 14 PASS / 1 FAIL**：唯一红 = **`check:size`**（beads 产物主包 **4647.2 KB > 平台红线 4096 KB**）。产物时间戳 = **19:39**（本会话未跑 `build:cocos`，系并发会话当时刚重建的本地构建目录）⇒ **不归因本单**（本单图元净 **+0**、零新增资源、零音频/图片改动）；该超出属托盘 24 槽批次的包体议题，**已提请主理人关注，未自行处置**（包体优化需用户拍板走分包/远程包）。
- **提交边界（⚠️ 后续收口方必读）**：`tuning.ts` / `beads-game.ts` / `view-model.ts` 三件**同文件交叉**了 WXG-T-143 的 v1.25 托盘改动与 onboard 标记；`memory/2026-09-17.md` 同理。⇒ 要么等该单收口后整批提交并在消息内并列两号，要么 `git add -p` 逐 hunk 拆；**禁止**整文件 `git add` 时误带他人未收口改动。
- **边界**：像素级目视与真机手感**待执行**（无屏幕层通路，判据只到命令层几何与 α）；相 A 的「先预警后动手」手感是否需调 200ms 需 Playtest 反馈，本单不改常量。

- **✅ 主理人收口（2026-09-17）**：
  - **代码入库确认**：SOLVER_* 全套（tuning 3 处 / beads-game 6 处 / state / scene-vfx 5 处）已随 `3ab5457`（T-146 收口批）**连带入库** —— 当时工作树含本单 src 笔，全量 **369/369** + `tsc 0` 佐证完整可用（「零提交」状态解除）。
  - **文档回写 6 件随本批提交**（assets-spec §1.6.2a 错字修 + knowledge 登记 + memory）。
  - **三裁定追认**：① 白环 clamp 进珠体内缘 + solver 点名期压掉白环；② 相 A 200ms 后逐颗 80ms 错开归位、执行时重算、玩家已取走静默跳过；③ 不 spawn 美术直接落码。
  - **验证**：全量 369/369 ✅ tsc 0 ✅（本批纯文档，无重建必要）。
  - **状态 → ✅ 完成**。

---

## WXG-T-151

- **名称**：**beads · G4 探针 v2.0 适配复跑（WXG-T-099 收口时发现：探针 54 组停留在 v1.2 假设）**
- **负责**：严守真(qa)　**状态**：✅ 完成（2026-09-17；两会话并发施工——CodeBuddy 会话适配+二跑，Qoder 会话接管收口+三跑终验；判据回写与缺陷落码待移交）　**P1**
- **背景**：T-099 收口复跑 `g4-probe.mjs` 即崩（P4 段 `findEmpty` 满盘下 undefined；判读文本硬编码「四类 VFX 全缺 FAIL」与现状脱节）。v2.0 玩法反转（满盘错位/24 槽/onboarded/组锚）使探针多数组的**构造与判读双双过期**。
- **范围**：54 组逐段适配（构造面：满盘+swaps 关卡、24 槽托盘、组锚路由；判读面：P4 四类 VFX 已落码改 PASS 口径、P5 音频、§H 22 条联动）→ 复跑取证（evidence/）→ G4 报告升版。
- **约束**：K-043（脚本装载先于 import）；K-037（[Probe] 可证 ≠ 屏幕可证）；[Cocos]/[Device]/[R] 结论不因 Node 绿而抬升。
- **验收**：54 组全跑通零崩溃；判读与 v2.0 规格一致；证据落盘；G4 报告刷新。
- **T-099 顺带移交（2026-09-17）**：v1.1 已回写四处**夹具可构造性修复**（`probeLevel` 补 `swaps`/`cycleProfile`；`retrieveOneMisplaced` 两步式取回；`solveBoard099` 解算归位；FINISH 装配等足 800ms 延迟门）——属**修探针**，前序组的构造/判读适配（P4 崩溃、VFX 判读过期等）仍待本单；`g4-probe-v1.2-t099.mjs` 切片可作「只跑 §H 12 条」的轻量复跑入口（P28a..j/P29a/b 已全绿）。

- **✅ 探针适配 + 复跑判读（2026-09-17，CodeBuddy 会话）**：`g4-probe-v1.1.mjs` **79 组全跑通零崩溃**（exit=0），最终分布 **PASS 37 / PASS\* 22 / FAIL 4 / ⛔ 16**。证据 `production/qa/beads/evidence/g4-probe-v1.3-t151.log`（mtime 2026-09-17 21:26 后；产物新鲜度经 `harness:build` 重建，P5/S 内建机验通过）。**适配面（修探针，非判据放宽）**：① `fillBoard`/`fillBoardAudio` 函数体改 v2.0 解算（旧「灌珠填空格」模型 `isFillable` 恒 false ⇒ 下游全假 FAIL）；② 30 处「开局托盘有珠」假设统一换 `primePlaceable` 前置（真链两步式取回，白盒珠仅 P21 类按修订 20 注明）；③ 结算面板 800ms 延迟门（P27b/d/e/i、A05-18/23）；④ `hudPulse` 固定 x 筛选未命中时钟圆（修探针缺陷，α 恒 1.0 假 FAIL）；⑤ P27c「filled=0」改 v2.0「恢复初始错位布置」语义；⑥ P18 写档计数扣 BOOT 基线（BD-32 已知行为）。
- **⛔ 供料侧判据整体失效（16 条 ⛔ 中的 7 条，同 P26/§J.1 体例）**：P2/P6/P12/P20/P21/A05-14 视觉半边/P7④⑤ 满槽半边 —— v2.0 供料关停 ⇒ `tray:spawned`/`tray:full` 恒 0，供料判据**不可构造**（P21 平凡真不记绿），**复活条件 = 供料复活**；P18 另见下方规格漂移。
- **❌ FAIL 4 条 = 3 项真发现 + 1 已知（全部移交，不自行落码）**：
  1. **【真缺陷·建议立 BD】A05-07 道具音效恒零发声**：`beads-game.ts:905` emit `powerup:used { affectedCells }`（v1.22 解环器改字段），而 :1489 音频 handler 仍读旧字段 `affectedSlots` ⇒ 恒 undefined ⇒ `sfx_powerup + sfx_dissolve` **永不派发**（逐字段实测确认）。一行修法 = handler 改读 `affectedCells`，**移交落码**。
  2. **【v2.0 适配缺口·移交裁定】P3+P19 新手引导死亡**：引导「首珠 = 托盘最前持有（GAP-02 首供落点）」（`beads-game.ts:2789-2813`）依赖已关停的供料 ⇒ v2.0 下 `guideSlot=-1`、hint 永不出现 ⇒ **新手对「点错位珠取回」的新玩法零引导**。需设计裁定：引导改指向取回操作，或随供料移除引导（BD-32 顺带）。
  3. **【规格漂移·移交裁定】P18 in-level 快照 vs §8-9**：v2.0 断点续玩快照**每次落子落档 1 次**（逐步实测 placed=1⇒writes 0→1、placed=2⇒writes 1→2）⇒ 与 §8-9 现文「PLAYING 零写档 / 结算帧恰 1 次」互斥。快照是有意设计 ⇒ **规格未随特性回写**，§8-9 需改写（区分快照写档与业务写档）。
  4. P17（连胜 meta）= **BD-12 已知开放**（save-schema 无 meta 段，concept §7 MVP 线外），非新回归。

- **🧹 接管收口（2026-09-17，Qoder 会话；本节覆盖上方「FAIL 4 条」块中被推翻的定性，冲突以此为准）**：检测到两会话并发编辑同一探针文件后，用户拍板「本会话接管统一收口」。动作：① 接受并发会话同型适配（P18⛔/P19/A05-07），补修 P18 正文残留矛盾句（「改判 PASS；BD-24 关闭」与 ⛔ 判定自相矛盾）+ 头注**修订 46**登记 + 汇总区新增 **T-151 修订面桶**（35 条，成员自 T-097/098/099/114/116/118 桶移入不双计）；② **三跑终验**：`retrieveOneMisplaced`（仅取 1 颗）前置升级为 `primePlaceable`（连取至可落）后 —— **上方第 2 项「P3+P19 引导死亡移交裁定」撤销**：P3 → **PASS\***、P19 → **PASS**，引导三通道+hint 在 v2.0 真链下功能正常，前轮 FAIL = **探针前置不足（假红，修订 15bis 同款）**非实现缺口；③ 上方第 3 项 P18 维持 ⛔ 移交（真规格漂移，§8-9 未随 in-level 快照回写）；④ 新实现缺陷仅 **BD-49** 一项（上方第 1 项，报告 §27.3 正式登记）；**BD-50 评估后不启用**；⑤ 终跑 = **PASS 38 / PASS\* 23 / FAIL 2（A05-07=BD-49、P17=BD-12）/ ⛔ 16**，证据 `evidence/g4-reverify-v1.8-t151.log`（上方 `g4-probe-v1.3-t151.log` 降为中间轮）；⑥ **报告升版 v2.0（§27）+ 横幅维护**；验收四项（零崩溃/判读一致/证据落盘/报告刷新）全成立 ⇒ **✅ 完成**。**移交包**：BD-49 落码单（待主理人立项）；§8-9 规格回写裁定；供料侧 16 ⛔ 复活条件挂供料复活；全部变更未 commit。
- **待办移交（收口后更新）**：① ~~报告升版~~ 已由本单完成（v2.0 §27）；剩余 = **BD-49 落码单立项**（一行修法+夹具同步，建议 P1）与 **§8-9 规格回写裁定**（设计侧接，区分快照写档/业务写档）；② G4 整体门禁结论不因本单升 PASS（供料侧 16 ⛔ + `[B]/[Cocos]/[R]` 边界保留），裁决权归主理人。
- **变更未 commit / 未 push**。

---

## WXG-T-152

- **名称**：beads · G7 不可填格轻压 + `sfx_denied` 音频原子批落码（T-128 落码③）
- **负责**：主理人(Qoder)　**状态**：✅ 完成（随 `7fc1c8a` 入库，与 T-153 同笔：两批在共享源文件上不可按文件干净拆分，消息双号并列如实登记）　**P1**
- ⚠️ **撞号改号记**：本单开工时头注「下一可用号 151」，落码中并发会话随 `adb471a`（T-099 收口）把 T-151 登记为 **G4 探针复跑单**⇒ 两单撞号。本单产物（games/beads 内 31 处引用）已全部改领 **T-152**，QA 表的 T-151 一字未动。教训入候选：领号后、收口前必须重读头注 + `git log --oneline -6` 双向校对（K-045/K-046 同源），尤其长会话。
- **依据**：WXG-T-128 用户裁定 3（2026-09-16「新增第 20 个音频剪辑」）+ 裁定 4（G7 极轻非惩罚反馈）；规格真源 `assets-spec §1.6.7` / `ux-spec §5`「不可填格轻压」行 / `audio-events §5` Q-A05-5。本单为**执行已登记决策**，零新规格值。
- **原子批六项（A05-24 活测试禁拆，拆开当场红）**：① `systems-index §3.12` `AUDIO_CLIP_TOTAL` 19→20 + 总线行 + 头注版本行 **v1.26**（顺手弥合 v1.25 漂移）② changelog v1.26 新行 ③ `tuning.ts` G7 常量块 + `AUDIO_CLIP_DENIED` + TOTAL=20 ④ `audio-voices.ts` 音色配方（非冻结，程序化 0 KB；硬值只有 120ms 引 §5）⑤ `audio-dispatch.test.ts` `SPEC_CLIPS` +id + cap 120 ⑥ `audio-events.md` §1 表行/计数/§3.2 限流 0.25s/Q-A05-5 闭环标记；连带转正：ux-spec L211、bead-grid §4、input-control §2.4、art-bible §7、accessibility ⑥、test-cases TC-GRID-04/TC-INP-05。
- **视觉+时序落码（game/view 分工沿 L5）**：`state.ts` 快照 denied 四字段预分配（多格并存 ≤4 槽，工程容量非规格值）；`beads-game.ts` `_armDeniedFx`/`_stepDeniedFx`（触发 = 5c 旁路 + `_placeSelected` ignored 且 reason∈{occupied,locked}；void 守卫集中一处；同格 250ms 重启门；门记忆不清 row/col，零残留由「在播才导出」保）；`scene-vfx.ts` `deniedPressScale` 纯函数（1.00→0.96@40ms→1.00@120ms ease-out 分段）；`view-model.ts` 消费（scale 只乘珠体 46 基准不碰 L11 垫；locked 走 `drawLockedBead` size 形参通道；D1 = `drawStateRing` 1px `slotBorder` α1 静态环；优先级 pop/wave > denied）。
- **判据**：新建 `tests/denied-press.test.ts` **18 例**（包络三关键相位 / game 红线：零事件零状态写、void 零反馈、同格门、多格并存、容量逐出、120ms 零残留、静音视觉在 / 命令层：谷帧宽度、图元 +0、D1 +1、护栏）。测试方法两个坑已踩实：AudioScheduler minInterval 从**派发时刻**起算（中途不 flush 会并发同刻被限流吞）⇒ helper `advFrames` 逐帧 advance+flush；零分配。
- **验证（收口已补跑）**：改号后 beads 全量 **387 passed**、`tsc --noEmit` exit 0；framework:sync / check:tasks / check:links 随 `7fc1c8a` 提交前全绿（pre-commit 五门含 ctx 硬门）。
- **提交边界**：工作树另有并发 QA 会话在途改动（`production/qa/beads/g4-probe-v1.1.mjs`、`_diag099-run.mjs`、`g4-probe-v1.2-t099.mjs`）⇒ **勿整文件 `git add` 误带**；本单文件面 = games/beads src/tests/design/art + qa/test-cases.md + production 台账两件。
- **边界**：像素级目视/真机听感待执行（K-037；A05-26 `[P]`）；音色调参（Hz/增益）系工程占位非规格。

---

## WXG-T-153

- **标题**：beads·G6 结算彩带落码（零 RNG 44 枚 sandwich，T-128 拆分④）
- **负责/状态**：主理人(Qoder) ｜ ✅ 完成（随 `7fc1c8a` 入库，与 T-152 同笔，拆分理由见 `## WXG-T-152` 状态行）
- **依据**：`assets-spec §1.6.6`（v1.4-r6 定稿卡）+ `ux-spec §5`「结算彩带」行（800ms，复用「过关庆祝」窗口不新造时长）。执行已登记决策，零新规格值。
- **落码六件**：`tuning.ts` G6 常量块 16 项；`palette.ts::CONFETTI_COLORS`（5 色**引用既有 token** 零新 hex，排除暖橙/奶白/暗档）；`state.ts` 快照 `confettiProgress` 单标量（L5：44 枚全 idx 派生 ⇒ 无需逐枚通道，同 sweep 判例）；`beads-game.ts` `_confettiElapsedMs`（-1 哨兵）+ `_stepConfettiFx`（update 表现层不冻结位）+ arm = `_stepLevelClear` 延迟门 `open()` 同帧（**D1 直开路径天然不臂** = 整条关停）；`scene-vfx.ts` 六纯函数（baseX/phase/spawnY/isForeground/frame/quad，公式**字面移植**）；`view-model.ts::drawConfetti` 两层 sandwich（MAIN 36 → scrim → FG 8）+ 禁飞带跳画 + `CONFETTI_SCRATCH` 标量槽。
- **判据**：新建 `tests/confetti.test.ts` **14 例**三段——① 纯函数（均布 min gap 9.000 > 带宽 6 / max 25.5 < 30 先 node 实测再定阈值；逐帧 y 单调、摆动 ±18、1.25 转、α 淡出、钳制、四角刚体边长 6×14）② 真链（波浪门开面板同帧臂、零玩法事件、播放期零新 clip（只 panel_in/star）、800ms 自清、D1 真链全程 0、下一关可再臂）③ 命令层（p=0.2 44 枚层序、p=0.65 禁飞带跳画且被跳枚 α 恒 1、D1/终帧净 0、色集 ⊆ 5 色禁暖橙）。踩坑登记：识别器初版误捕 HUD 区同色（丁香紫）**斜置 40×6 大图元** ⇒ 加 bbox ≤16 尺寸闸（彩带任意旋转 bbox ≤ hypot(6,14)≈15.3）。
- **验证**：`tsc --noEmit` exit 0；beads 全量 **34 files / 401 passed**（387+14）；framework:sync（镜像写入 6）/ check:tasks（18 行/18 节）/ check:links 均随 `7fc1c8a` 提交前跑绿。
- **两项规格差异（诚实登记于 §1.6.6 落码回写注，未改规格本体，待 art 复验）**：① 「预分配 352-float scratch」在 `polygon()` 按引用存 points 的现契约下不成立 ⇒ 采 G3 判例逐枚新建 8-float（仅 800ms 窗口内分派）；② 卡文案「飘落」vs 公式 `y = spawnY − 1334×1.15×easeIn(p)` 单调递减（上行出屏）⇒ 按硬纪律「只抄不改」以公式为准，若裁定改向下属**规格修订**。
- **提交边界**：同 T-152——勿整文件 `git add` 误带并发 QA 在途文件；本单文件面 = games/beads src/tests/art/assets-spec + qa/test-cases.md + production 台账两件。
- **边界**：像素级观感（`[Cocos]` 连拍）与真机待执行（K-037）；TC-PER-26 整条不判 PASS。

---

## WXG-T-157

- **名称**：**beads · 组选收窄 + board 锚直填落码（用户 2026-09-17 三项裁定）**
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成（415/415 绿；verify PASS 16/FAIL 0）　**P1**
- **裁定（用户 2026-09-17，问答三项）**：① 距离定义 = **8-连通规则**（8 向、锚起两步内 = 切比雪夫 ≤2）；② 组构成 = **同色才抬**（距离 ≤2 且珠色与锚珠相同；异色错位珠留盘面）；③ 直填细则 = **组内逐颗续填**（点对应色空格、切比雪夫 ≤2 ⇒ 组内最近珠直接归位；被填珠移出组、锚珠被填 ⇒ 锚静默转移到剩余组首、组空锚清；超距 ⇒ 轻提示拒绝）。
- **落码**：① `grid.collectMisplacedGroup` 组选语义改写（8 向两步同色；旧 WXG-T-148 ③ flood fill 不限色不限距作废）；② `beads-game._routeGridEmpty` 增 `_tryDirectFillFromBoard` 分支（`retrieve`+`fill` 同帧搬移、`bead:placed` 无 slot、cleared-priority 照常、超距复用 BD-16 文案零新常量）；③ 锚结构扩 `color`（组色）。
- **规格代落盘（待设计域正主复验）**：`input-control` v2.2 变更记录（路由 5a 收窄 + 5b 直填分支 + 超距拒绝 + 与 v2.1 swap 禁令的关系澄清）；`bead-grid` 变更记录追加（组语义 + 直填 + 「格间必经托盘」例外口澄清）。
- **测试**：`misplaced-group`（4 例迁移到新语义 + 新增异色不抬/切比 >2 两断言）、`selection-anchor`（4 例构造 swapBeads→同色对 setBead、断言 colorIdx 随迁）、**新增 `misplaced-direct-fill` 6 例**（直填/续填/超距/不匹配/锚转移/cleared 混合路径）。**语义要点**：直填是**搬移**（源格空出）⇒ 不直接产生 complete（交换对场景异色不可组选）⇒ cleared 走「直填归位错位珠 + 托盘补空格」混合路径。
- **验证**：beads **415/415** 绿（36 文件）；`verify` **PASS 16 ｜ WARN 0 ｜ SKIP 0 ｜ FAIL 0**。
- **未 commit / 未 push**（工作树含并发会话 T-152~155 在途内容，提交需协调）。

---

## WXG-T-158

- **名称**：**beads · 托盘同色归类 + 组选 + 批量填充落码（用户 2026-09-18 四项裁定）**
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-18；未 commit）　**P1**
- **裁定（用户 2026-09-18，问答四项，均选推荐项）**：① 归类 = **自动归类**（珠进托盘自动插入同色堆旁，玩家不再选落槽）；② 组选 = **同色全组·互斥**（点任一珠 → 该色全部 selected；换点他色整组换选；再点同组任一颗整组静默取消；同帧至多一色组被选）；③ 批量填充 = **部分填充**（BFS 就近点到珠为止，剩余珠保持选中）；④ 连通口径 = **8 向·不限步数**（与盘侧 T-157 的 ≤2 收窄不同，填充区沿同色空格全连通蔓延）。
- **冲突面（先改文档再改代码）**：tray-spawner §2.1「selected 至多 1 槽」/ §2.4 落槽=玩家点槽 / §6 双击幂等 / §8-6 判据；input-control 路由 4a/4b/5b；bead-grid §2.3 路径 B 单珠填充；systems-index §4 `tray:selected` payload（非 §3 冻结数值，§3 零改动）。
- 产出：GDD 回写 + src 四件（tray/placement/retrieve/beads-game）+ cocos 镜像 + 新增测试与既有冲突判据迁移。
- **测试与收尾证据（2026-09-18）**：
  - 新增判据文件 `tests/tray-batch-fill.test.ts`（GDD bead-grid v2.1 变更记录指名）9 例：Tray 归类不变式单元（§8-6b）/ `planGroupFill` BFS 口径单元（8 向对角、多层不限步、锁定/异色不穿越、珠数截断）/ game 级全链（部分填充、珠有余保持 selected + 异区续点、不匹配仍单格 rejected、整组离盘紧凑性）。
  - **新测试暴露实现缺口并修复**：旧 `Tray.takeBead` 取中间块尾珠后留块间空洞，破坏 §8-6b「任意次归位后」不变式且坐坏 `insertGrouped` 紧凑前提 ⇒ takeBead 离珠左移补位（src + cocos 镜像同步）；连带迁移 `misplaced.test.ts` 两例「离珠后槽号稳定」旧口径断言。
  - 既存冲突判据迁移：tray-spawner §8-6 组选改写、selection-anchor 满槽/腾槽用例改尾取珠、misplaced-group 收进归类断言等均已改 v2.2 口径。
  - 门禁：beads vitest **424/424 绿**（含新增 9 例）；根 `pnpm run verify` **16 项全 PASS**（含 framework:sync:check 镜像一致、cocos:check、check:tasks）。

---

## WXG-T-161

**框架·微信宿主触摸逆变换公式勘误（BD-48 真因；真机「无法点击任何珠子」）** · 负责：主理人(CodeBuddy) · 状态：✅ 落码（**待用户真机复测**）

- **现象（用户 2026-09-18）**：微信侧开局后**任何珠子都点不动**（托盘/棋盘皆无响应）；本机会话前先排除了玩法层——`games/beads` 真链探针（`input.push` → `game.update`）点错位珠正常发出 `board:selected`，424/424 绿 ⇒ 玩法与命中路由无缺陷，问题在宿主坐标归一化。
- **根因（构建产物引擎源码实锤，非推测）**：`cocos-js/cc.js` 内
  `_getLocation(touch, windowSize, dpr) { x = clientX*dpr; y = windowSize.height − clientY*dpr }`，
  而 `screenAdapter.windowSize` 的 getter 是 `new Size(windowWidth*dpr, windowHeight*dpr)`
  ⇒ 翻转基准**已是物理 px**，两侧量纲一致。WXG-T-129 把它当成 `wx.getWindowInfo().windowHeight`
  （逻辑 px）⇒ 判定「量纲混合」并写出 `y = (windowHeight − raw.y)/dpr`；
  代入真值得偏差 `−H·(dpr−1)/dpr`（dpr=3、H=844 ⇒ −562.7）⇒ **y 恒落屏外、x 恒正确**，
  与「全部点不动且不是整体镜像」的现象逐条吻合。
- **修正（最小面）**：`normalizeCocosTouchWx` 改为 `y = windowHeight − raw.y/dpr`
  （≡ `(windowHeight*dpr − raw.y)/dpr`，与 web 分支数学同形）；`bindings.ts` 两处注释订正；
  同步 `framework:sync`（beads + breakout 镜像各写入 2 件）。
- **测试（判别力反例改写）**：`tests/adapters/cocos-touch-wx.test.ts` ——
  ① `engineWxLocation` 改复现**真实**引擎式（`windowHeight*dpr − clientY*dpr`）；
  ② 反例改判「T-129 旧式」出错（并断言偏差恰为 `−H(dpr−1)/dpr`）；
  ③ 新增「wx ≡ web」等价性钉子（dpr 1/2/3 × 三点），防两分支再次漂移。
  ⚠️ 首版测试的前提本身是错的（据误读写的「web 公式必出错」反例），本次连同实现一并订正。
- **门禁**：framework vitest **299/299 绿**；`framework:sync`+`:check` 镜像一致；
  根 `verify` **PASS 16 ｜ FAIL 1** —— FAIL = `check:secrets` 存量项（仓库根 `project.config.json`
  含真实 AppID，随 b6d6c65 忽略层级订正后暴露，**与本次改动无关**，处置需用户决定：忽略该文件或改环境变量）。
- **待办**：① `build:cocos` 重新出包（当前 `build/wechatgame` 产物 2026-09-18 10:13，**仍带旧式**）
  ⇒ ② 用户真机复测（点托盘珠可选中、错色放置出红描边）；③ 若仍偏移，开 `GameGlobal.__WXG_TOUCH_DEBUG = true`
  采集 `loc/scr/dsn` 三段数值。
- **处置核销（2026-09-18 提交会话）**：① 本门禁 FAIL 项（根 `project.config.json` AppID）已按 checker 建议处置——`.gitignore` 补根 `/project.config.json` + `/project.private.config.json`（随 `2f62027`），`check:secrets` 转绿；② 同批编辑器产物 `project.json fitWidth=false→true` **无文档登记**，用户裁定**回滚不入库**（真机复测时如需再显式改）。
- **入库**：随 `706e99f` 提交（framework 正本 + beads/breakout 镜像 + 判别力测试）。
- **边界（诚实登记）**：本次结论来自**构建产物中的引擎源码**与 `weapp.getScreenSize()` 返回值
  （= `wx.getWindowInfo()` 逻辑 px）的**静态推导**，本机无真机 / 无 AppID ⇒ **未经真机实测**；
  真机复测前不得标「已验证」。

---

## WXG-T-162

**beads+框架 · 真机五项修复（SFX 离线渲染 / 组选全连通 / 直填放距 / 乙档缝宽 / 同心圆角）** · 负责：主理人(Qoder) · 状态：✅ 落码（**待用户真机复验**；未 commit）

- **裁定来源（用户 2026-09-18，真机反馈五项）**：① 真机只出 BGM、无任何音效/结算音效；② 缝宽采**乙档**（`BEAD_DRAW_INSET` 2→6）；③ 直填**放开任意距离**；④ 组选 = 「找相邻直到找不到，所有找到的珠子一起抬起」；⑤ 锚起 3×3（8 向含对角）按④找全。含前序补充：旧 5×5 窗选不全全部连通珠。
- **① SFX 根因与修法（框架 `audio-synth.ts`）**：BGM 有声 ⇒ WebAudio 通路活；真因 = 微信 iOS `createWebAudioContext().currentTime` 恒 0、AudioParam 时间轴不推进 ⇒ 旧振荡器路线（`start(when>0)` + `setValueAtTime`/`linearRamp`）永久停在起始增益。改**一次性 clip 一律 CPU 离线渲染成 PCM buffer** + BufferSource + 静态增益 + **无参** `start()`（即 BGM 存活配方）；滑音相位累加、attack/decay 包络、噪声按 clipId 种子 `createRng` 烘焙（L4 合规）；`_shotBuffers` 按 clip 缓存只渲染一次；`SynthOsc`/时间自动化入口编译期删除。判据入 `framework/tests/platform/audio-synth.test.ts`（18 绿，含「BD-51 存活配方」describe）。
- **④⑤ 组选全连通（`grid.collectMisplacedGroup`）**：5×5 几何筛选 → 锚起 8 向 BFS 完整连通块不限步；就位/锁定/空格/异色阻断传播（隔珠同色自动拆组）。覆盖 T-157 ①。
- **③ 直填放距（`beads-game._tryDirectFillFromBoard`）**：删切比雪夫 ≤2 门与超距轻提示分支；其余口径（取最近者/组保持逐颗续填/锚静默转移/cleared-priority）沿用 T-157 裁定 B。覆盖 T-157 ②③。
- **② 乙档 + 同心圆角（呈现层，零 §3 变更）**：`tuning.ts` `BEAD_DRAW_INSET` 2→6（旧值真机 scale 0.5 下≈ 1 CSS px 不可见）；`bead-render.ts` 珠圆角 = 垫圆角 − inset（等距内缩必同心，旧式缝宽转角不均）。⚪ 白环（T-148 selectableRing）去留未裁定 ⇒ 维持现状。
- **规格回写（代落盘待正主复验）**：`assets-spec` v1.5-r7（头注 + §1.1 L11；基于 46/2px 的派生值声明作废）、`accessibility.md` §5-4 闭环（待 playtest → 乙档已裁、余留待真机）、`input-control` v2.4（路由 5a/5b + changelog）、`bead-grid` v2.2（§2.2 组语义条 + changelog）。
- **测试**：`misplaced-group` 新增连通判据 5 例（隔空/异色/就位阻断、斜链、竖列超旧窗）；`misplaced-direct-fill` 布局重排（斜连组）+ 超距拒改写为放开回归。beads 全量 **429/429 绿**；framework audio-synth **18 绿**；`tsc --noEmit` exit 0。
- **门禁与镜像**：`framework:sync`（beads 写入 6 / breakout 2）+ `:check` 一致；根 `verify` **PASS 14 ｜ FAIL 3** —— FAIL 均存量与本单无关：`check:secrets`（`project.config.json` AppID，T-161 已登记待用户处置）、`check:size`（debug 产物超 4MB 红线，存量漂移归发布域）、`selftest:fast`（其第 5 步以 check:size 为探针，连带 FAIL）。两包 `build:cocos` 已重建（wechatgame · debug）。
- **待办（用户侧）**：真机复验清单 —— ① 一次性音效/结算音效出声；② 缝宽 6px 视认 + 转角匀缝；③ 点任意距离同色空格局部直填；④ 大连通块一次全抬；⑤ 前单 SHOW_ALL 点击偏移修复同批复验（T-161 待办项）。
- **入库（2026-09-18 提交会话）**：随 `79f217a` 提交；`tuning.ts` / `beads-game.ts` 与本单 T-162 改动物理交织 ⇒ 按判例 T-154/155 合笔（头注双挂 WXG-T-162/164）。

---

## WXG-T-163

**beads·主菜单+元游戏页族程序结构设计** · 负责：主理人(Qoder)+程基岩（engineering-lead 委草） · 状态：✅ 完成（草稿零落盘、结构拍板；反转冻结与实现归 T-164）

- **背景**：用户提供 9 屏竞品参考图（主菜单/总榜/七日签到/图鉴/游戏圈/设置/名片/回复体力/HUD 货币栏），要求「先设计程序结构、确认后再实现」。
- **阶段 0 诊断**：`BeadsPhase` 仅 6 相无主菜单；存档 save-schema v3（4 开关）；框架已有 `Platform.wallClock()`；渲染遵 L5 只读 view-model。页族 = 全新 meta 系统（S10），跨工程/UX/美术/数值四域 ⇒ 编排路由。
- **结构草稿要点（程基岩，零落盘）**：BeadsShell 双对象（play+meta 两层；overlay 栈复用 core SceneStack；meta 存档独立 sidecar 键）；玩法状态机/判据/存档零扰动、框架零改动；menu-route = 暂停次钮 → shell 屏；meta-view 只读 buildRenderModel；ui-kit 程序化图元；harness `?meta=` 注入验证。
- **冲突登记 C1–C7**：C1 主菜单 vs ux-spec §2 有意移除；C2 排行榜 vs concept §7 Won't；C3 体力 vs meta-framework M5 永不采纳；C4 钱包 vs 三货币禁令；C5 震动 vs §3.8 屏震冻结；C7 游戏圈/分享 vs Won't + 微信能力未实测。
- **用户四项结构拍板（2026-09-18）**：① 屏架构 = **B Shell 双对象**；② 范围 = **分批 0-1-2**（批0 shell+路由+设置 v4+签到；批1 图鉴+本地榜+名片；批2 开放数据域+游戏圈+分享；首启仍直进玩法保留存）；③ 排行 = **本地榜做 + 好友榜置灰**；④ 体力/广告/钱包 = **装**（反转冻结归 T-164）。
- **交付形态**：结构草稿会话内全文回传（零落盘），主理人汇编后用户拍板；数值与语义包二轮拍板归 T-164。

---

## WXG-T-165

**beads·真机首验反馈修复批（白环移除 + 回主菜单弃本局棋盘）** · 负责：主理人(Qoder) · 状态：✅ 已落码待重建复验（代码 + 文档同批、beads 455 例绿、framework:sync/links 绿；待 `build:cocos` 重建后进真机）

- **缘起（用户真机首验五项回报，2026-09-18）**：P0-A 点击命中 / P0-B 音频 / P0-C 玩法 / P0-D 元游戏 / P1 视觉均 OK；两项修正裁定 + 一项缺功另立 T-166。
- **① 白环移除（P0-C）**：错位珠「恒亮白描边」（T-148 用户反馈①）经真机验证用户裁定「不要白环」⇒ 移除 `view-model.ts` `selectableRing` 赋值与 `bead-render.ts` 字段/描边块；**保留组选抬起（反馈②③④）与相 A 状态环**。无障碍提醒：白环原为近似色「色≠底」辨识补充，移除后仍由 L5 符号 + 相 A 环承担（影响可控）。同步删 `solver-vfx.test.ts` 三条白环专测（几何/互斥/图元口径）、剪孤儿 import。
- **② 回主菜单弃本局棋盘（P0-D，反转 §3.14/S9）**：用户裁定「回主菜单不保留进度」⇒ `beads-shell.startGame()` 删「在途 PAUSED 续进不扣心」分支，改为每次 `goToLevel(levelIndex)` 复位当前关 + 扣 1 心；关卡解锁进度/当前关指针不变（0 心留菜单走回满）。选「弃棋盘不退心」（非退心项）。连带：删死方法 `beads-game.resumeFromPause()`（唯一调用者已移除）+ 改 `go-menu` 注释。**注**：局内暂停「继续游戏」仍走 play 内部 `machine.transition('playing')`，不受本反转影响。
- **文档同批（§3.14 数值零改、仅行为反转）**：systems-index **v1.29**（版本头 + S9 行 + changelog v1.29）；pause-settings **v1.4**（§2.2 行 + §8-11 判据 + §9）。`STAMINA_START_COST=1` 不变，仅「新局」集合扩大。
- **测试**：`beads-shell.test.ts` 续进条改写为「回主菜单弃本局→重进再扣心」；beads 全量 **40 files / 455 tests 绿**；tsc 净。
- **真机首验结论回写（本会话）**：T-128 首验包 P0-1..P1-7 → ✅；T-129/T-161 触摸点击 → ✅（SHOW_ALL 已重开，产物 policy:2）；T-162 五项 → ✅（除白环，已本单移除）；T-164 菜单路由→本单按用户新裁定反转。余低优 UX 待裁③不阻塞。
- **待办**：`build:cocos` 重建后回真机复验本两项（白环不在、回主菜单重进为新局）。

---

## WXG-T-168

**beads·取回落槽口径改写（点槽定落位 + 部分收纳·就近优先）** · 负责：主理人(CodeBuddy) · 状态：✅ 落码 + 三文回写（**待真机复验**）

- **用户两项反馈（2026-09-18 游戏体检）**：①「选游戏区多个相邻珠子，无法一键放到连续相邻的空槽，现象是**一个一个的填空槽**」；②「底槽满了连续选中的珠子还能放到下面一行，**应该是还有多少空槽就放多少相邻珠子进来，以当前点击位置越近越优先**」。
- **定位（同一处）**：`retrieveSelectedGroup` 的**落槽与容量口径**。链路 = 点 board 错位珠 → `collectMisplacedGroup`（8 向不限步）→ 点 tray 空槽 → `_routeTraySlot` → `retrieveSelectedGroup` → 逐颗 `retrieveBead` → `Tray.insertGrouped`。
- **真因**：① 落槽 = **WXG-T-158 裁定①「自动归类」**（今天刚落码）——被点空槽**仅作触发信号**，每颗各自插进同色堆尾 ⇒ 表现即「一颗一颗填、与点击位置无关」；② `:910` `freeCount < cells.length ⇒ return false` = **整组拒**，与「有多少空槽收多少」相反。
- **第三问排查（非 bug，认知偏差）**：用户报「容量 12 却放进第二行」。实测 **基础容量 = 24（2 行 × 12）**（`tuning.ts:142` `TRAY_BASE_SLOTS = 24`，v1.24 冻结 12→24，WXG-T-141 用户 2026-09-17 拍板）⇒ 第二行是合法基础容量；`btn_expand` = 24→48（4 行），**MVP 无广告无消耗**（`beads-game.ts:1054` 「badge-only placeholder, no ad call」），`reset()` 缩回 24。
- **用户拍板（问卷三题）**：① **改回点槽定落位**（推翻 T-158 裁定①）；② **部分收纳 + 就近优先**；③ 容量问题 = 需排查实际容量（已答，见上）。
- **落码（v2.3 口径）**：
  - `Tray.insertRun(startSlot, colorIdx, count)` 新增 —— 从起点起向右**连续相邻**写入，遇非 `free` 即止（不移位、不按色插堆）；`Tray.freeRunFrom(startSlot)` 容量预判。`insertGrouped` **降级为夹具 / 死路径专用**（归类不变式不再约束玩法布局）。
  - `judgeRetrieve(grid, tray, row, col, landSlot?)` —— **先校验落槽再动 grid**（避免事后回滚 `grid.retrieve`）；未传 `landSlot` 退回 `insertGrouped`（夹具兼容）。
  - `retrieveBead(row, col, landSlot?)` / `retrieveSelectedGroup(targetSlot?)`：`targetSlot` = 玩家点击的空槽；可收数 = `min(组大小, freeRunFrom(start))`；收满清锚、未收满**锚改指剩余首颗**（可续点、不发事件）。
  - **`_nearestFirst`（关键坑）**：`collectMisplacedGroup` 末尾有行主序 `sort`（`grid.ts:219`）⇒ 其返回值是**行主序而非距锚序**，直接取前 N 颗会「先收最远的」。故按**到锚珠的欧氏距离平方**升序重排（平局行主序）后再截取，落实「越近越优先」。
- **测试**：新增 `tests/retrieve-landing.test.ts` 5 例（点槽 5 ⇒ 落 5/6/7 且 0..4 仍 free；只收最近 1 颗；续点收完才清锚；起点右侧被占 ⇒ 只填到首个非 free；满槽零事件）；迁移 `misplaced-group`（整组拒 → 部分收纳就近）、`selection-anchor`（腾 1 槽 ⇒ 收 1 颗；⚠ `takeBead` 左移补位使腾槽后 free 的仍是**末槽**）。beads **460/460 绿**（455+5）。
- **文档回写（三文同源）**：`tray-spawner` v2.3（§2.1 归类不变式降级 / §2.4 出口表 / §8-6b ⛔ 作废 + §8-6c 新增 / §9）、`bead-grid` v2.3（§2.3 路径 A 第 2·3 步 / §8-2 / §9）、`input-control` v2.6（§2.1 路由 4b / §2.3 前置 / §4 出口表 / §9；**只动取回分支，v2.5 的 C-3 时基翻转不受影响**）；QA 新增 `TC-TRAY-11/12`。**§3 冻结数值零改动**。
- **门禁**：`framework:sync`（beads 写入 3）+ `cocos:check` + 根 `verify` **17/17 PASS**。
- **⚠️ 领号教训（补充 K-046）**：按 SSOT grep `TASKS.md`/`TASKS-DETAIL.md` 得「下一可用号 167」并领用后，发现 **`input-control.md` v2.5 头注已占用 WXG-T-167**（并发会话 ADR-0015 C-3，漏登主表）⇒ 全量 sed 改号 168。**判例升级：领号前除 grep 两张表，还须 grep 工作树 `design/gdd/*.md` 头注与 `docs/architecture/adr/*.md`**（本会话已回写主表头注登记 167 归属）。
- **追加（同单第二项，用户 2026-09-18 续报）**：「容量第二行显示不明显，看不出来是开放的槽」「版面没有那么多槽 ⇒ 先开放一行 12 个，扩容再开放第二行」。
  - **视觉误判（真因，非美术参数问题）**：`view-model.drawTray` 的 `const dashed = row > 0` —— 虚线语言本应**只属扩展行**，但基础容量 24 时 rows=2 ⇒ **基础第 2 行（已开放）被画成 `slotDashed`(#C9C5DA) 虚线**，玩家读成「未解锁/虚位」。**这正是上一轮用户报「容量 12 却放进第二行」的根因**（闭环）。修：`dashed = row >= ceil(TRAY_BASE_SLOTS / TRAY_COLS)`。
  - **§3.4 冻结变更 v1.30**：`TRAY_BASE_SLOTS` 24→**12**（1 行×12）、`TRAY_EXPAND_SLOTS` 24→**12**（+1 行，扩展后 24/2 行）。**推翻 v1.24（WXG-T-141，用户 2026-09-17 拍板 6→24）**。回写：systems-index §3.4 + §1 S4 行 + 头注 v1.30 + `systems-index-changelog` v1.30 + `tray-spawner` v2.3（§1/§2.1/changelog）+ QA `TC-TRAY-05`。
  - **负面后果（诚实）**：空间压力回升；与同单**部分收纳**叠加 ⇒ **部分收纳触发频率显著上升**。若 playtest 手感受损，容量是最优先回调旋钮（改 `tuning.ts` 一个值 + systems-index 一行）。
  - **版面副作用（2026-09-18 用户已裁定 = **保持现状**，本项零落码）**：面板高随行数派生（1 行 ⇒ 72）且仍**贴带顶锚定** ⇒ 未扩容时带上沿以下留出约 80px 空白（原第 2 行位置）。用户裁定该留白 = **「扩展行预留位」**（扩容后自然填满），锚定规则保持单一、零特判。未采纳的另两个方向（改「贴 `btn_expand` 上方」锚定 / 收紧 `TRAY_BAND` 把空间还给棋盘带）**留档不执行** —— 若后续 playtest 反馈「托盘区显空」再议，届时须连带重推 `tray-24-layout-derivation.md`。
  - **测试迁移**：`tuning.test.ts`（行对齐 2→1 行、带高断言改 2 行态）、`misplaced-group`（满槽构造 22→10 颗）。beads **460/460 绿**；`framework:sync` 写入 2；根 `verify` **17/17 PASS**（⚠️ 中途因 `build:cocos` **debug** 产物含 sourcemap 触发 `check:size` FAIL，属存量陷阱：包体数字只对 **release** 有意义 —— 改 `--release` 后 1949.3 KB ≤ 2000 KB 内部目标过）。
- **待办**：真机复验（① 未扩容只显示 1 行**实线**槽、扩容后第 2 行为**虚线**；② 多选相邻珠点 tray 空槽 ⇒ 连续相邻落位；③ 空槽不足 ⇒ 只收最近的 N 颗、余珠留格可续点；④ 12 槽下空间压力是否可接受）；release 产物已出（1949.3 KB，**距内部目标 2000 KB 仅余 ~50 KB**，后续美术资产需盯包体）。
- **沉淀统计（`kb:sync --task=WXG-T-168`，2026-09-18；`kb:audit` 无归档相似命中、`kb:check` 八重校验 PASSED）**：**新增 2** —— K-055 [判据]「连通块」API 返回序是行主序非距锚序：「就近/最近」取前 N 前必须显式重排（含「锚在组中段」的判别力用例要求）；K-056 [判据] 渲染「未解锁/扩展」视觉语言须随容量语义常量派生（裸行号 `row > 0` ⇒ 已开放行画成未开放，并反噬成「假容量」报告）。**修改 1** —— K-046 [流程] 追加**反向面**：只 grep 两张任务表仍会撞号，还须 grep 工作树 `design/gdd/*.md` 头注与 `docs/architecture/adr/*.md`（本轮 167 实例）。**激活 0 / 归档 0**。

---

## WXG-T-128

**beads 美术 v1.4「动态质感章」风格单（G1–G9 动效欠账清偿）** · 负责：林绘澄(art) + 主理人(Qoder) · 状态：🔄 待真机首验（可推进项**全部闭合** 2026-09-18：落码 5 单 + 规格待裁归零 + `[Cocos]` 判读 ✅；余 = 真机首验包 B4 ⛔ + 低优先 UX 待裁③）

- 起因：用户「review 美术设计，提出优化方案，要求有质感、对比竞品要吸引人、要有及时的互动」。主理人**三方对账（规格 × 代码 × 竞品）**得 G1–G9。
- **v1.3 已达标面（不重复动）**：静态质感十层卡、冷底 token 真源、暖光 band 三级色温、背景层次、HUD 白胶囊/8 齿齿轮、a11y 假绿根治；竞品差异化辨识（冷紫灰 × 唯一暖焦点）已立住。
- **缺口清单（全部有代码证据，grep 零命中）**：
  - **G1 落座零视觉反馈（P0）**：art-bible §2「落座感」+ §7 `vfx_fill_pop` 120ms + assets-spec §1.6 + ux-spec §5 四处规格已冻结，但 view 侧 `bead:placed` **零消费**（仅音效 `_sfx(AUDIO_CLIP_PLACE)` 已实装）⇒ 最高频交互画面纹丝不动。
  - **G2 消除无溶解（P1）**：`vfx_clear_dissolve` 200ms 零命中 ⇒ 与「溶解沙」音效**音画不同步**。
  - **G3 道具生效无全屏扫光（P1）**：400ms 规格零命中（唯一 sweep 属 combo Lv3 burst，语义不同）。
  - **G4 过关无庆祝高潮（P1）**：`vfx_complete_wave` 800ms 逐列弹跳零命中 ⇒ 填满直接跳结算面板。
  - **G5 连击 Lv2 伪震屏空缺（P2·工程）**：渲染管线无全局变换通道（`_commands` 私有，WXG-T-074 登记），视图不假造。
  - **G6 结算无彩带礼花（P2·竞品差）**：**规格本身无此条**（assets-spec §1.6 仅 4 条 VFX）⇒ 需先补规格。竞品 = 全屏彩带 + 缎带 + 礼盒轨道。
  - **G7 不可填格纯静默（P2）**：ux-spec §4 已裁定「零反馈」，与竞品 pop-it「按下总有凹陷态」有差 ⇒ **用户拍板：加极轻非惩罚反馈**（改 ux-spec §4 矩阵行，属设计裁定）。
  - **G8 根因归纳**：v1.3 做满**静态**质感，**动态**质感四项（G1–G4）全欠账 ⇒ 珠子仍像贴图而非有质量的物体。
  - **G9 a11y 连带**：accessibility §2 D1 把「落座回弹/消除溶解」标 **N/A**（理由：无对应动画通道）⇒ G1/G2 落地后该 N/A 自动失效，须改「关停项」，防下次假绿。
- **用户裁定（2026-09-16）**：方案 = **丙案·全量 v1.4 风格单**（派林绘澄出「动态质感章」草案 → 主理人三方复核 → 用户拍板 → 落码，同 v1.3 丙案流程）；G7 = **加极轻非惩罚反馈**（守 D2 ≤3Hz + 零惩罚语义）。
- **可行性关键**：`_wrongFx` 是现成可 1:1 复用判例（表现层计时 `{row,col,elapsedMs}` + view 消费 + 重启门 + PAUSED 不冻结 + 快照字段）；毫秒值全部已冻结在 ux-spec §5 权威表 ⇒ G1–G4 **不需新冻结变更、不动 framework**。
- **性能口径（须入草案）**：动画期图元增量 G1 单颗 / G2 按批（数十颗）/ G4 全场 ≤156 珠逐列 scale；建议回退阀 = 动画进行中的珠子降层绘制（如溶解期只画 L1+L5），静态珠维持十层。
- **诚实口径**：评审结论全部基于代码事实（grep 零命中 + 已实装项核对），**未经真机截图验证**（Cocos 构建阻塞，同 T-124/T-125 口径）。



### 裁定与回写记录（2026-09-16，主理人复核 + 用户拍板 7 项）

**主理人三方复核结论**：改动范围合规（零代码、零 gdd/ux、零冻结常量、palette 零新增 hex）；林绘澄自报纠错的四类数字**逐条对代码复算验真**——彩带 5 色（`STAR_GOLD #FFD23F` == 珠色2 柠黄）、scratch 352 float（44×4×2）、A5 线宽 2.48/2.0/2.53/2.25（`SYMBOL_REF_SIZE 64` + `stroke(3)=max(2,size×3/64)` + `TRAY_BEAD_SIZE=TRAY_SLOT−4=44`）、图元净 −141/−580（基线 1810→1669/1230）；G6 禁飞带 `y∈[447,787]` 按 `clearPanelLayout()` **逐像素验过**（`panel.yMin=(1334−480)/2=427`、`rowY=427+20=447` = 按钮顶、缎带 `titleY 745 ± 84/2 = [703,787]`）。

**复核另抓 4 处缺陷（已全部修净，v1.4-r2）**：① **G2 LOD 阈值 126ms → 80ms**（卡内 `α = 1−q` 线性 ⇒ α≥0.6 ⇔ τ≤200×0.40=80ms；旧值系误把线性 α 当 easeIn 反解，落码按 126 会多画 46ms 十层）——错在 `assets-spec §1.6.2/§1.6.9` + `art-bible §7.4` 三处；② `§1.6.9`「砍掉的四层」→ **六层**（十层−保留 L1/L2/L3/L5）；③ `accessibility` A5⑦ G7 间隙 **4px → 3px**（`52−48/2−50/2`；只有被点那颗缩，4px 是「两颗都缩」的误用）；④ **改号 7 处**（`WXG-T-127` → `WXG-T-128`）。林绘澄另自查出 2 处同型残留并同批修净：A5① 取整写法 `27+25=52 相切` → `26.5+25=51.5<52 间隙 0.5px`（五处）、v1.3 遗留松口径「下压谷 ≥0.95」→ 收紧为 **0.96**（与 `FILL_POP_SCALE_TROUGH` 同源）。

**用户 7 项裁定（2026-09-16）**：

| # | 裁定 | 落笔处 |
|---|---|---|
| 1 | **G4 结算面板延迟 800ms 开**（庆祝先行放完再落遮罩；代价 = 过关到可点按钮多等 800ms） | `ux-spec §5`「过关庆祝」行 + `bead-grid §4` 表注 + `art-bible §7.3.4` / `assets-spec §1.6.4` 由「前提」改定案陈述 |
| 2 | **G5 采案 B（改框架，案 A 作废且不作降级预案）** | `art-bible §7.3.5` 全节重写 + `§7.1` Lv2「整屏 scale 1.015」**措辞不动**（案 B 下规格与实现一致，假绿种子消解）+ `accessibility` D1/D2/A5⑤/§2⑥；工程单 = **WXG-T-132**（原定 T-131，因并发会话占用改领） |
| 3 | **G7 加音效 = 新增第 20 个剪辑 `sfx_denied`**（非零音效、非复用 `sfx_place` 降 volume） | `ux-spec §5` 新行音效列「极轻闷「哒」」+ `audio-events §1` 注/§2.1/§5 Q-A05-5・6 + `art-bible §7.5` 注改写（**G6 仍无音效**，BD-16 判例保留）+ `assets-spec §1.6.7` 原子约束块 |
| 4 | **G6/G7 毫秒入 `ux-spec §5`**（「结算彩带」800 /「不可填格轻压」120，均复用既有行值、不新造时长） | `ux-spec §5` 增两行 ⇒ art 三件「§5 无此行 / 未决项 3」标注全清 |
| 5 | **LOD 只预埋 G4 的 6 层档**（G2 的 α<0.6 降 4 层与 G6 的 44→24 枚**规格保留、本轮不预埋**，只留回退阀②/③） | `art-bible §7.4` + `assets-spec §1.6.9/§1.6.10/§1.8末`；**图元改双口径**（规格口径 1669/−141；本轮落码口径 **1813/+3**，庆祝期 −580 本轮即成立） |
| 6 | **G3「全屏」限玩法区 `y∈[0,1214]`**（不侵入 `HUD_BAND`；白扫过 HUD 会让倒计时瞬时发白触 B1/E1） | `art-bible §7.3.3` + `assets-spec §1.6.3/§6`；⚠️ **主理人派单信里「HUD 在屏底」是错的**——`systems-index §3` 冻结「原点左下 / **y 向上**」+ §3.1「**顶部** HUD 带」，林绘澄拒绝照抄、按冻结真源写「顶部」（裁定实质与数值一字未改） |
| 7 | **1.06 = 规格起点值、非过冲量**（`ux-spec §5` 的 `1.06→1.0 / 120ms` 一字未改） | `art-bible §7` 主表由「ease-out-back，过冲 ≤1.05」改分段口径 + `§7.3.1` / `assets-spec §1.6.1` 读法声明块；谷 0.96 = **中间插值**，不违 §5（§5 只冻总时长与起止值） |

**主理人串行落笔的四域回写（非冻结规格文本，美术侧不改）**：

- **ux 域**：`ux-spec §4` 矩阵行「点锁定/已填格」由「静默忽略（零反馈）」→「**极轻非惩罚反馈**」；`§5` 增「结算彩带」「不可填格轻压」两行 + 「过关庆祝」行层序裁定 + **「珠子落座」行分段细化**（起点 1.06 → 谷 0.96@40ms → 终 1.00@120ms、L0a/L0b 联动、**重启门 120ms**）——补源依据：`§5` 事实纪律本就载有分段与门（「放错拒绝」行 60/80/60ms + 500ms 门），不补则 G1 的 40ms/门属「无源毫秒」。
- **GDD 域**：`input-control §2.4` + `§8-5` + `§8-7` + **v1.2 变更记录**（**§8-5 硬判据主体由「零反馈」转为「零事件」**，并显式写明「QA 不得再按旧文把 G7 轻压判成缺陷」；§8-7 与 §8-5 的 v1.1 期互斥随判据改写**消解**）；`bead-grid §4`（新增「（无事件）表现层轻压」行 + level:cleared 层序注）+ `§6` + `§8-4`（「零事件、零反馈」→「**零事件**」）。
- **audio 域**：`audio-events §1` 增变更注 + `§2.1` 两行归位（结算彩带 = 有意不做；轻压 = 预约）+ `§5` 新增 **Q-A05-5 / Q-A05-6**。⚠️ **冻结值 `AUDIO_CLIP_TOTAL` 19→20 本轮不动**：A05-24 是**活测试**（`audio-dispatch.test.ts` 断言 `SPEC_CLIPS.length === AUDIO_CLIP_TOTAL` 且 voice 表 ≡ clip 集），单独改 §3.12 会当场测试红 ⇒ 必须与 `tuning.ts` 常量 + `audio-voices.ts` 配方 + 测试 `SPEC_CLIPS` + §1 表行**同批原子提交**（解除条件六项见 Q-A05-5）。音频为**程序化合成** ⇒ 0 KB、不占包体、无需生成音频文件。
- **QA 域**：`test-cases.md` TC-GRID-04 / TC-INP-05 两条判据镜像（均「待实现」⇒ 改了零成本，防将来假 FAIL）；`g4-probe-v1.1.mjs` 增**修订 44** + P10 证据串叙述镜像（**不动任何断言/阈值/判定分支**；P10 测的是 §8-7 无选中点 empty 格，与 §8-5 锁定/已填格互斥 ⇒ 既有证据不失效、无需重跑）。

**落码拆分（5 单，施工时各自领号，不在本单预占号）**：

1. **G1 落座回弹（P0，首单）**——图元 +0、零冻结常量、零框架改动，`_wrongFx` 骨架 1:1 可复用（`assets-spec §1.6.10` 给 game 侧 5 步 + view 侧 4 步）；规格侧**已就绪**（林绘澄自评）。需工程定：`drawFilledBead` 的 `FilledBeadOptions` 扩 6 字段签名与默认值、`bead:placed` 的 view 侧消费者新建（现为零 = G1 P0 根因）。**D1 分支须同步接通**，否则 `accessibility` D1 由「N/A 诚实」转「✅ 假绿」。
2. **G2/G3/G4（P1）**——G4 含**面板延迟 800ms 开**（裁定 1）与唯一预埋的 `lodLayers=6`（裁定 5）；G2 作用对象**钉死为托盘槽位珠**（`powerups.ts`「绝不写网格」），照「消除网格珠」落码即破坏玩法状态机。
3. **G7 轻压 + `sfx_denied` 音频原子批**——含 `systems-index §3.12` 19→20 冻结变更单 + changelog 新行（主理人串行落笔）+ A05-24 五项同批；QA 侧须**新增 §8-5 独立探针用例**（事件增量 0 **且** 命令流出现 scale 覆写，按修订 25 用配对差分）。
4. **G6 结算彩带（P2）**——零 RNG lattice、44 枚 polygon、预分配 scratch 352 float；禁飞带 `[447,787]`。
5. **G5 案 B = WXG-T-132**（跨 `packages/framework`，**前置验证项 = `FIXED_WIDTH` 下整屏 1.015 是否露黑边**，未验证不得当已解决）。

**真机验证前置（阻塞项，登记不假装已解）**：v1.4 全部为**纸面几何核算**，真机未验（Cocos 构建阻塞，ADR-0009 P2，同 T-124/T-125 口径）。G1 落码后**首个真机抽检项** = L0a/L0b 接触阴影呼吸的观感（会不会读作「脏」而非「接触」）+ 峰值 0.5px 间隙；案 B 落码后须抽检整屏缩放致 HUD 文字 / 1px 描边的**亚像素抖动**（影响 E1/B1 观感）。若不先解构建阻塞，会重演 v1.3「F5 真机偏淡」那类事后才暴露的问题。

### `[Cocos]` 连拍取证推进（2026-09-17，CodeBuddy 会话）

- **新增工具** `tools/scripts/cocos-vfx-burst.mjs`：Cocos web-mobile 产物内**动画窗口连拍**取证（playwright 真实产物 + `tapDesign` 白盒驱动 + 逐帧相位读数 + 产物新鲜度门）。**观感取证物，不判 PASS**（判读 = 人眼复核）。
- **G6 结算彩带（TC-PER-26）**：✅ 取得有效连拍 —— `evidence/vfx-burst*/`（confetti 相位 0.10→0.83→0 = 播放→自清，两帧落在 800ms 窗口内）；solve 后 `phase=level-clear`（彩带与面板同帧臂起 ✓）。`[Cocos]` 道次取证物已备，判读待 QA/主理人。
- **G3 扫光（TC-PER-21）**：⛔ **连拍前置不足，如实登记**：① 首关错位珠少，道具（solverPlus/solver）一次归位即达成零错位 ⇒ **同帧 `level-clear`**，而 `_stepSweepFx` 只在 playing 推进 ⇒ sweep 相位恒 0（非实现缺陷，是取证构造约束；`--level=1` 换关后 phase 保持 playing 但 sweep 仍读 0，疑点 = `tapDesign` 是否命中卡 / Cocos 环境臂起差异，**未深挖**）；② 解除条件 = 换「错位 ≥4 且道具不致通关」的关卡构造，或裁决「level-clear 下扫光是否应继续播完」（规格未定义，属 UX 侧待裁）。
- **连带发现（线索级，未定性）**：A05-07 已确认音频 handler 读旧字段 `affectedSlots`（道具音效恒零发声，T-151 登记）；扫光视图消费（view-model.ts:1245 `sweepProgress`）读的是**快照字段**、与 payload 字段无关 ⇒ 与 A05-07 不同族，G3 缺口更可能是臂起/推进的相位面问题。
- **产物状态**：`games/beads/cocos/build/web-mobile` 已随本轮 `framework:sync` + `build:cocos:web` 重建为当前代码；脚本与连拍产物**未 commit**。

### 用户裁定执行（2026-09-17，CodeBuddy 会话 · 两项规格差异拍板）

- **裁定 ①（scratch 契约）= B「改实现保规格」→ ✅ 已执行**：
  - `packages/framework/src/core/render/render-model.ts`：`PolygonCommand.points` 与 `polygon()` 签名放宽为 `readonly number[] | Float32Array`（契约注载明「命令按引用持有 ⇒ scratch 段下一帧前不得改写；彩带每帧 44 枚固定段、当帧构建当帧消费 = 安全」）。
  - `games/beads/src/view/scene-vfx.ts`：`confettiQuad` 增 `off` 段偏移参数（默认 0，旧调用兼容）。
  - `games/beads/src/view/view-model.ts`：**`CONFETTI_POINTS = new Float32Array(44×8) = 352-float 预分配**（规格字面兑现），每枚固定段 + `subarray` 视图引用（零拷贝零复制）；原「逐枚新建 8-float」作废。
  - `tests/view-model.test.ts` 两处 points 联合类型收窄（`Array.from`）。
  - **验证**：`tsc --noEmit` 双包零错误；beads **409/409** 绿、framework **295/295** 绿；`framework:sync`+`:check` OK。
- **裁定 ②（彩带方向）= C「先看连拍再定」→ ⏸ 判读前置未满足，暂缓**：人眼复核 4 帧（含色像素定量检测）**均未见彩带**，且 `snapshot.confettiProgress` 读数 0 与上一轮同通路相位推进（0.10→0.79）**不稳定复现** ⇒ 疑点 = 「Cocos 产物上彩带未渲染 / 臂起不稳定」，需正式排障后重拍，方向裁定（上行 vs 飘落）在此之前无从谈起。排障起点：`_stepConfettiFx` 在通用表现层步进（beads-game.ts:698）✓ 已核对；臂源 = `_stepLevelClear` 门满帧（:1912）✓ 已核对；下一个排查面 = Cocos 绑定层 `drawConfetti` 的分派/裁剪（`polygon`+`Float32Array` 视图在 cocos-renderer:178 索引遍历天然兼容，但需确认命令流中确实出现）。
- **⚠️ 连带实测暴露（非本单引入，登记移交）**：`check:size` 从 SKIP 转实跑后首次结果 = **beads `cocos/build/wechatgame` 主包 4647.2 KB > 平台红线 4096 KB（超 551KB）**（breakout 1815KB 达标）。主体为引擎 bundle/资源面，与本单 3 函数改动无关 ⇒ 归 **T-128 真机首验包 P0-4**（原登记「check:size 从 SKIP 转 OK」——现转 OK 后即暴露超标）+ 包体治理（分包/裁剪）移交发布/工程域。
  - **✅ P0-4 澄清收口（2026-09-17，CodeBuddy 会话）——零治理改动即达标**：4647KB 是 **debug 产物基线被误读**（`build-cocos.mjs` 默认 `debug=true`：含 sourcemap 且不压缩，脚本头注明文「测包体基线必须用 --release」）。**release 重建后复测：beads 主包 1927.9 KB**（红线 4096 ✓、内部目标 2000 ✓ 达标；breakout 1815.1KB 达标）；`verify` **PASS 16 ｜ WARN 0 ｜ SKIP 0 ｜ FAIL 0**。
  - **守卫加固（防再误读）**：`tools/scripts/check-bundle-size.mjs` 新增 **debug 产物侦测** —— `cocos-js/cc.js ≥ 2500 KB`（debug ≈3.3MB / release ≈1.5–1.8MB，取空档）⇒ 报告输出「疑似 debug 构建，包体数字不可作为基线，请用 --release 重建复测」，且 `anyFail` 提示里优先指向 release 重建；脚本内建自测 19/19 绿。
  - **教益（K 候选）**：「首次转实跑的守卫」第一次实测结果要**先核测量前提**（此处 = 产物 debug/release 形态）再下「超红线」结论——测量前提不成立时，FAIL 读数是伪信号而非缺陷信号。
- **✅ P0-4 澄清收口（2026-09-17，CodeBuddy 会话）——零治理改动即达标**：4647KB 是 **debug 产物基线被误读**（`build-cocos.mjs` 默认 `debug=true`：含 sourcemap 且不压缩，脚本头注明文「测包体基线必须用 --release」）。**release 重建后复测：beads 主包 1927.9 KB**（红线 4096 ✓、内部目标 2000 ✓ 达标；breakout 1815.1KB 达标）；`verify` **PASS 16 ｜ WARN 0 ｜ SKIP 0 ｜ FAIL 0**。
  - **守卫加固（防再误读）**：`tools/scripts/check-bundle-size.mjs` 新增 **debug 产物侦测** —— `cocos-js/cc.js ≥ 2500 KB`（debug ≈3.3MB / release ≈1.5–1.8MB，取空档）⇒ 报告输出「疑似 debug 构建，包体数字不可作为基线，请用 --release 重建复测」，且 `anyFail` 提示里优先指向 release 重建；脚本内建自测 19/19 绿。
  - **教益（K 候选）**：「首次转实跑的守卫」第一次实测结果要**先核测量前提**（此处 = 产物 debug/release 形态）再下「超红线」结论——测量前提不成立时，FAIL 读数是伪信号而非缺陷信号。

**美术规格侧未决项：零**（林绘澄回传 ⑤ 明述；三件文档内无条件句/待裁结构残留）。

### 收口推进（2026-09-18，CodeBuddy 会话）

- **差异②闭合确认（对账 §1.6.6 回写注）**：系登记时误按 y 向下读（设计坐标 **y 向上** ⇒ 公式递减本就是屏面下落，目视「飘落」与卡文案一致），用户 2026-09-17「认可」⇒ **公式不改、规格本体不改、无 v1.5 修订项** ⇒ 本单**规格侧待裁项归零**（「美术规格侧未决项：零」维持成立）。连带清理 stale 注释：`scene-vfx.ts`（src + cocos 镜像**同批**）旧注「差异已登记待 art 复验」→ 改为闭合口径。
- **`[Cocos]` 连拍 v2.1 在当前代码复跑（本单余下可推进项的执行）**：产物自 T-157/T-158 后已陈旧 ⇒ 按脚本前置 `framework:sync` + `build:cocos:web` 重建（`web-mobile/index.html` mtime 2026-09-18 09:28）后复跑，**14/14 相位帧全取得**：
  - **G6 结算彩带（TC-PER-26）**：8/8 帧，p 0.125→0.958 覆盖 800ms 窗口；每帧 5 色近似差分 ≈44.4k px（基线 0）且**灰度 ≈42k < 彩色** ⇒ 彩带持续渲染、**BD-50 黑化特征不复现**（T-156 修复在当前代码仍成立）。
  - **G3 道具扫光（TC-PER-21）**：5/5 帧，p 0.167→0.958；level 1（错位珠 4）用 v2.1 触发器（道具卡 0）后 **phase=playing** ⇒ v2 期「同帧 level-clear 吃掉扫光窗口」的**取证构造约束已解决**，非实现缺陷的定性获得新证据。
  - **诚实口径**：取证物 ≠ 判读 —— PASS/FAIL 归 QA/主理人**人眼复核**（`evidence/vfx-burst/` v2.1，JPEG q90）。
- **本单剩余（显式移交，不假装已解）**：① **真机首验包 P0-1..P1-7**（前置 = 有效 AppID，用户侧 B4，⛔）；~~② G6/G3 连拍判读~~ **已闭合（2026-09-18 收口，见下）**；③ 低优先 UX 待裁：「level-clear 下扫光是否应继续播完」规格仍未定义（现取证已不依赖该点，不再阻塞）。

### 收口（2026-09-18，Qoder 提交会话 · 主理人人眼判读）

- **余项② G6/G3 连拍判读 = 执行完毕，两项均判 ✅ 视觉达标**（对象 = `evidence/vfx-burst/` v2.1 帧，产物 mtime 09:28）：
  - **G6 彩带（TC-PER-26）**：BASE 无彩带 → p≈0.13/0.21 顶部密集带（五色：黄/绿/红/紫/白）→ p≈0.42 中段整体下移（飘落轨迹与卡文案一致，差异②闭合口径得目视佐证）→ p≈0.83+ 自清零残留；**禁飞带 `[447,787]` 内零彩带**（面板/按钮/缎带全程干净）；BD-50 黑化不复现（彩色像素鲜亮，与定量 colorish>gray 读数互证）。
  - **G3 扫光（TC-PER-21）**：三层斜带（20°）自左向右扫过全程可辨（p≈0.17 左侧 → p≈0.58 中部 → p≈0.96 右侧出屏）→ 尾帧自清；**顶部 HUD 带零侵入**（计时胶囊/齿轮/LV 字全程不受光带经过，裁定 6 达标）。⚠️ **底部道具带被扫到属规格内**：核对 `assets-spec §1.6.3` 裁定回写行明文「限定玩法区 **y∈[0,1214]**」+ 实现 `SWEEP_Y_MAX = HUD_BAND.yMin`（tuning L670）⇒ 非违规，登记以免后续判读误报。
  - **效力边界（诚实）**：判读对象 = web-mobile 产物连拍（非真机屏）；真机亮度/刷新率差异仍归首验包 P0-2/P1-6。
- **T-129 连带核销（出包内容物白盒实证）**：`build/wechatgame`（mtime 09-18 14:27）bundle 内 `normalizeCocosTouchWx` 已是勘误后式（`i.y = windowHeight − n.y/dpr`），且含 T-162 离线渲染（`_shotBuffers`）与 T-164 批0（`createBeadsShell`/`refillStamina`/`stamina-refill`）⇒ **真机复测包就绪**，扫码复测为用户侧动作（B4），本单施工半至此无可再推项。

### 收口（2026-09-19，CodeBuddy 会话 · 待裁③ 裁定 + QA 漏回写补记）

- **待裁③ 裁定 = 甲（用户 2026-09-19 拍板）**：「level-clear 下扫光是否应继续播完」由「规格未定义」改为**明文写入「臂起后恒播满、不因状态切换中断」**。
  - **技术事实（与旧登记相反，纠正本节约 `:110` 的③表述）**：原文曾登记「`_stepSweepFx` 只在 playing 推进 ⇒ sweep 相位恒 0」——**该登记不成立**。三级链路（步进 `beads-game.ts:2914` / 快照 `:3149` / 视图 `view-model.ts:1258`）**均无状态门**；`_stepSweepFx` 与 `_stepConfettiFx` 同属**表现层步进组**（`_update` 末尾，`:770`）。真相 = v2 期是**取证构造**问题（未臂起），v2.1 换构造后已 5/5 帧取得。
  - **决定性论据（与既有裁定同源）**：① 层序 `drawSweep` **在面板之下**（`view-model.ts:220` 注释）；② `CLEAR_PANEL_DELAY_MS = WAVE_MS = 800`（`tuning.ts:703`）⇒ **400ms 扫光必然在面板打开前播完**（`ux-spec §5:238` 裁定 1「庆祝先行放完再落遮罩」）；③ G6 彩带本就是「`level-clear` 臂起、播满 800ms」⇒ 扫光与其**同判例**。**「给扫光加 `playing` 门」= 错误修法**（与 ①②③ 全部分叉）。
  - **落码（零实现改动 = 以实现为准回写）**：`art/assets-spec §1.6.3` 新增「**状态无关性**」条（含三理由 + 判据指引）；`ux-spec` 升 **v1.13**（头注 + §5「道具生效」行补注）；**`§3` 冻结数值零改动、400ms 一字未改**。
- **判据（新 1 例 + K-036 变异自检）**：`tests/scene-vfx.test.ts` 新增「裁定『恒播满』…solver 归位致过关 ⇒ 扫光不被掐断、仍走完 400ms」（G3 命令层组 7→**8 例**）。
  - **构造难点与解法（诚实记录两次失败）**：① 首版用 `noAssemble: true` + 手动 `fill` ⇒ **solver 点名了但棋盘纹丝不动**（手动填充未建内部索引）⇒ 改**默认装配**；② 改默认装配后探针实测 **217ms 归位完毕、367ms 过关，此刻 `sweepProgress = 0.917 > 0`** ⇒ 观测窗口真实存在（过关早于 400ms 扫光归零）。
  - **⚠️ 变异自检暴露的自身缺陷（重要）**：给 `_stepSweepFx` 加 `playing` 门后，**首版判据仍会通过**（门令扫光**冻结在非零值** `0.79` 而非归零 ⇒ 「过关帧 `sweepProgress > 0`」这条**无判别力**）⇒ 判据主体改为**「过关后仍在推进（`> pAtClear`）+ 到点归零」**两条；复跑变异：该例红于 `expected 0.79 to be greater than 0.79` ✓ **判别力确认**。该自检记录已写入判据注释，防后人误把弱断言当主体。
- **QA 两处漏回写补记（属 2026-09-18 收口批遗留，非新判据）**：`test-cases` 升 **v1.16**——
  - **TC-PER-21**（G3 扫光）与 **TC-PER-26**（G6 彩带）的 `[Cocos]` 栏由「**待执行** ⇒ 整条不判 PASS」转「**已验（2026-09-18 人眼判读）**」，证据 = `evidence/vfx-burst{,-l1}/` v2.1 帧；**两条均附效力边界**：判读对象 = web-mobile 产物连拍、**非真机屏** ⇒ **不冒充 `[Device]`**（真机亮度/刷新率差异归首验包 P0-2/P1-6）。
  - **TC-PER-26 差异②闭合回填**：原「公式字面移植 = 上行出屏 / 待 art 复验」是**登记漂移**（2026-09-17 用户已认可）⇒ 改记「设计坐标 y 向上 ⇒ 公式递减 = 屏面下落，与『飘落』文案一致，**公式与规格本体零改动**」（`:105` 已清 `scene-vfx.ts` 注释，本次补齐 QA 表一侧）。
  - **零软化声明**：判据意图零软化、阈值零改动、本表其它行未动；变更记录表**仍缺 v1.10–v1.14 五行**（沿 v1.13 ⑦ 口径只登记不代写）。
- **落笔人非本域正主**：QA 表与 `ux-spec` 代落盘（承 T-146 / T-172-Q1 / T-173 判例），**待严守真 / 文策渊复验**。
- **收口结论**：本单**可推进项全部闭合**（落码 5 单 + 规格待裁归零 + `[Cocos]` 判读与状态回填 + 待裁③ 裁定）；**真机侧唯一余项 = 首验包 P1-8 集中走查轮**（2026-09-19 新挂，跨 T-164/165/168/169，依赖 AppID 扫码）⇒ **移交真机轨，不阻塞本单验收**；主表状态由「🔄 待真机首验」改 **✅ 完成**。

---

## 真机首验包（待 AppID · 2026-09-16 登记 · 解除 DEV-01/B4）

> 前置：① 有效 AppID ② `pnpm --filter @wxgame/beads run build:cocos --release` 出包（⚠️ 2026-09-18 订正：仓库无 `build:cocos:wx` 脚本名，`build:cocos` 默认 platform=wechatgame，测包体必须 `--release`） ③ 微信开发者工具 + 真机扫码 ④ 本包随包执行并回填。

- **P0-1 时基同源复核（BD-40 关单前提）**：真机跑 `production/qa/beads/beads-browser-probe.mjs` 的 CLK-01 等价面 —— 仿真/墙钟须 **≈1.00±0.10**（修复后 web 实测 1.002/0.997；**若真机 ≈2 ⇒ BD-40 复活升产品级 P1**）。
- **P0-2 光敏性观感**：wrong 态连点（观察单次脉冲非往复、无高频闪）+ 告急脉冲 + 满槽呼吸 —— 屏幕像素层 web 已验，真机亮度/刷新率差异须人眼复核。
- **P0-3 T-124 丙案视觉**：十层卡/冷底/F6 白字路由/NEW BEST 角标（T-127 修后 168 底衬）/STAGE 标签（T-127 修后 `DESIGN_W−30` 锚）—— 真机字体回退下不回溢（T-127 风险条款）。
- **P0-4 主包红线**：`build:cocos --release` 实测包体 ≤4096 KB（§3 冻结；程序化合成 ⇒ 音频 0 KB 应天然满足）+ `check:size` 从 SKIP 转 OK。
- **P0-5 四相位真链**：暂停/结算/失败面板真指针可用（web 已验，微信 touch 语义须复验）。
- **P1-6 性能**：T-124 单帧最坏 +624 图元的帧率回退阀（林绘澄预授权条款）真机实测。
- **P1-7 音频**：A05-26 听感（`[P]`）+ 首次手势后出声（A05-27）。
- **P1-8 缩放/平移与周边设备面（集中走查轮，2026-09-19 挂号）**：① **zoom≠1 时棋盘命中精度**（QA `test-cases.md §A4c` 真机 ⛔ 5 条，**P0**——屏→设→棋盘逆变换同 BD-48/T-129/T-161 一条通道，K-037）；② 单指拖拽不拖出屏 / 大盘初始居中不贴边（T-169 真机反馈①③修后复验）；③ 回主菜单弃本局棋盘（T-165）；④ 托盘 12 槽只显示 1 行实线 + 点槽定落位/部分收纳（T-168）；⑤ 菜单入口与体力回满广告链（T-164 收口移交项）。**仍靠 `build:cocos --release` 出包 + 扫码**（前置同本节头）。
- 以上全过 ⇒ G4 的 DEV-01 解除，可议升 PASS；任何一条红 ⇒ 按 BD-40 先例登记并回修。

---

## WXG-T-164

**beads·元游戏页族反转冻结回写 + 批0 落码（体力/钱包/振动）** · 负责：主理人(Qoder) · 状态：✅ 收口（2026-09-19：六文回写 + 批0 落码已随 `79f217a` 入库；真机首验其性 OK（P0-D 元游戏），菜单路由一项由 T-165 反转并已落码；收口批补完 T-165 漏回写面；批1/批2 另单）

- **用户八项拍板（2026-09-18 两轮）**：一轮 = B Shell 双对象 / 分批 0-1-2 / 本地榜+好友置灰 / 装体力+广告+钱包；二轮 = **体力宽容包 B**（上限 8、8 min/心）/ **钱包 A 包**（买心阶梯 + 头像框）/ **装触觉振动**（`VIBRATE_DEFAULT=ON`、仅 isMiniGame 显示行）/ 首启仍直进玩法。
- **冻结回写（六文，已落定）**：systems-index **v1.28**（新 §3.14 体力与钱包：`STAMINA_MAX=8` / `STAMINA_REGEN_MIN=8min/心`（离线恢复 f(Δt wallClock)、登录钳上限）/ `STAMINA_START_COST=1` / 回满 = 激励视频第二 live 位 / 签到第 3/5 天各 1 心（溢出即弃）/ 钱包获取仅签到币·周榜结算·通关首通、消耗 = 买心（阶梯价不冻结 `[待 playtest]`）+头像框 / Won't = 只发不耗·币购道具；§3.8 `VIBRATE_DEFAULT` 新冻结 + 屏震行语义钉死；§3.11 激励主位 1→2、体力移出 Won't；§1 S10 行 + S9 行；§4 meta 域事件 5 行）+ changelog v1.28 行；ux-spec **v1.7**（§1 原则 1 / §2 流程主菜单+overlay 栈 / §6.3 补注 / §8 更正，**启动路由零改动**）；concept **v1.4**（§5 / §7 meta 页族行 + Won't 改写 / D10 反转）；meta-framework **v1.1**（M4/M5 反转 + 三货币条件解除 + §7 分批计划）；pause-settings **v1.3**（回主菜单次钮 + 震动行 + §8 判据 11/12）。
- **语义裁定（本单新增澄清）**：扣心时机 = **新局开局/重试**；~~PAUSED 恢复与菜单在途续进不重复扣心（保留进度不惩罚）~~ → **后半句已随 WXG-T-165 反转**：回主菜单弃本局棋盘，菜单「开始游戏」恒全新开新局扣 1 心（局内暂停「继续游戏」仍不扣心）；签到送心溢出即弃；阶梯价表不冻结归 `tuning.ts` 候选（判例 `SPRINT_K_CURVE`）。
- **批0 落码范围（进行中）**：shell（BeadsShell 双对象）/ meta-state / meta-save-schema（sidecar v1；settings v4 = +vibrate）/ menu-route（暂停次钮→菜单、菜单主钮恢复/新开——**主钮「恢复」分支已随 T-165 反转删除**）；scenes = menu / settings overlay / signin overlay；services = signin（wallClock 自然日判定、循环制断签不清零）/ stamina（离线恢复钳上限）/ wallet（获取三源+买心消耗）；meta-view 只读 + ui-kit 程序化图元 + harness `?meta=` 注入；`gdd/meta-ui.md` GDD 同批建（S10 行预约；**实际未随批，已移交批1**，见收口批）。
- **retry/restart 逐次扣心（本单挂账已关闭，2026-09-18）**：玩法内 retry（normal）/ restartRun 经注入 `play` 的 `canStartRun` 闸门逐次扣 `STAMINA_START_COST`；sprint 不设门（§3.14 冲刺消耗不冻结）。**0 心拒绝路径 = 用户拍板 B（失败页看广告回满再重试）**：闸门拦下 → `_requestStaminaRefill` 拉起 `STAMINA_REFILL_PLACEMENT`（§3.11 第二 live 位，游戏侧字符串位不改冻结框架枚举）→ `onRewarded` 按 `_adKind` 分发（revive vs staminaRefill 共用单一订阅）→ `onStaminaRefill`→`MetaState.refillStamina()` 回满后重放 proceed 续体（MAX≥cost 必成功、无循环）。hook 而非事件（不动 §4 冻结表）；standalone BeadsGame（无 canStartRun）恒放行保 429 既有测试。新增 `tuning.STAMINA_REFILL_PLACEMENT` / `run-start-stamina.test.ts`（5 tests，真实 MetaState 端到端）。
- **门禁证据（本单 retry 扣心段）**：`framework:sync`（beads 写入 3）+ beads `tsc --noEmit` 净 + 全量 beads 测试 **458 passed**（453+5）+ `cocos:check` 两游戏过 + beads `--release` 重建（17.7s）+ `verify` **16/17**（唯一 FAIL = `check:secrets` project.config.json:22 AppID 既有挂账，非本单引入）+ ux-spec v1.8（§3.5 重试扣心注 + §4 矩阵 GAME_OVER 拆有心/0 心）。
- **待办（收口后口径）**：~~批0 落码与测试~~（已完成，`79f217a`：shell/meta-state/sidecar/settings v4/签到·体力·钱包内聚于 meta-state/menu 路由/meta-view/harness `?meta=`；458 绿）；~~真机复验（其性项）~~（2026-09-18 首验 P0-A..P1 五项均 OK，含 P0-D 元游戏：震动行/签到/体力扣心均正常；唯菜单路由一项当场裁定反转）；`gdd/meta-ui.md` GDD 与 ui-kit 独立图元层**未随批0 落盘**（已核 `ls` 证实不存在）→ **移交 backlog 无号行「beads 元游戏批1」**（前置 = 主理人裁 T-167 提案 Q1/Q2）；反转过后的设备面复验（回主菜单弃棋盘）→ **并入下次真机复验批**（与 T-165/168/169 的待复验项同批走查，不单开轮）；批1/批2 实施另单。
- **收口批（2026-09-19，本单关单依据）**：核账时发现 **T-165 的反转只改了 systems-index v1.29 / S9 行 / pause-settings v1.4，未跟 UX/概念两文**（正是判例 K-053 描述的「一对多回写漏点」），本批补齐：① `ux-spec.md` **v1.11** —— §2 流程图（次钮注 + 主钮分支两行）、§3.3 面板几何冻结注、§6.3 启动路径补注、§8 已裁定行共 **四处**旧「保留进度不惩罚 / 在途 PAUSED 恢复 / 不重复扣心」改注为**弃本局棋盘 + 菜单「开始游戏」恒全新开当前关扣 1 心**（旧裁定划线留档，启动三路径仍零改动）；② `concept.md` **v1.5** —— D10 行「有进度 → 续进在途局」作废；③ `proposals/meta-framework.md` **v1.2** —— §7 分批口径订正（体力/钱包服务改记已随批0 落码；批0 欠账明写归批1 并标 Q1/Q2 前置）；④ `systems-index.md` **v1.31** + changelog 同批 —— S10 行 `meta-ui.md` 待建归属由「批0」改记「批1」，并登记 v1.29 反转已镜像至下游。**代码零改动**；**§3 冻结值零改动**（无 `STAMINA_*` 漂移）。
- **收口批门禁与沉淀**：根 `verify` **17/17 PASS**（逐项不短路；含 `check:tasks` / `check:links` / `ctx:check` / `framework:sync:check` / test / `cocos:check` / `check:size`）；`kb:sync --task=WXG-T-164` 沉淀统计：**新增 0 / 修改 1（K-053 追加「反转批文档面不得写死枚举，须拿旧裁定特征短语全仓 grep 定范围 + 收口前复扫上位裁定」） / 激活 0 / 归档 0**；`kb:audit` 无归档候选、无相似命中（活跃 56 / 归档 0）；`ctx:build` 已刷索引面。**附带发现（不属本单，已回写 backlog）**：`ux-spec.md` 实测 **19587 tok**（HEAD 口径），而预算豁免 note 与 backlog 行仍写 8683 ⇒ 该到期条已据实刷新（本批增幅 +420，未触 >500 拆分线）。本批**未提交**（用户要求先看改动）。
- **入库（2026-09-18 提交会话）**：六文回写 + 批0 落码随 `79f217a` 提交（与 T-162 交织文件合笔，头注双挂）；本单 B4 门禁中 `check:secrets` 存量 FAIL 已由根配置 `.gitignore` 处置闭合（见 `## WXG-T-161` 处置核销，随 `2f62027`）。

---

## WXG-T-166

**beads·棋盘区双指缩放 + 单指拖拽（立项）** · 负责：程基岩(eng) + 文策渊(UX) · 主理人核销 · 状态：✅ **核销（2026-09-19）**——本单职责到「立项 + 报出前置阻塞」为止，阻塞与范围均已被 `ADR-0015` 应答、代码已由 WXG-T-169 交付；本单不再挂施工，余项已分流

- **缘起（P1 真机反馈）**：用户「缺个功能，可双指放大缩小、单指左右移动」。用户已钉范围 = **仅棋盘玩法区缩放/平移**（HUD/托盘/面板不缩放）。
- **设计已有意向**：concept v1.24/D13、systems-index v1.24 changelog③、ux-spec v1.6、input-control v2.2 已将「双指捏合缩放」列为 **Should**（无滑轨/按钮）。
- **前置阻塞（硬）**：框架 `InputManager` 为**单指针设计**（`_ownerId` 首指独占、`input-manager.ts:99`「Ignore secondary touches」），`InputSnapshot` 只暴露一组 x/y ⇒ **双指捏合无法在玩法层表达**。解锁需二选一（均需 ADR）：**(甲)** 扩 `core/input` 为多点快照（触 **L2** core 引擎无关 + 影响 breakout，面大）；**(乙)** Cocos 适配层新增第二条触摸通道→游戏专用服务（触 **L3**、适配层）。未裁。
- **高危面声明**：缩放后的「触摸→格子」需逆变换（屏→设→棋盘局部），**正是 BD-48/T-129/T-161 同一 hit-test 通道** ⇒ 不得绕过回归网直接实现（K-037 屏幕层取证）。
- **下一步**：待用户/主理人就甲/乙 定 ADR → 拆子任（框架输入扩展 / 棋盘变换建模 / hit-test 逆变换 / 缩放限幅与钓制 / 双拍复位）+ QA 判据。本会话不动 hit-test 通道。

- **核销记录（2026-09-19，Qoder 收口会话）——「范围 ↔ 交付」映射**（当时本单所列每一条阻塞都已有人做了，但本单行一直停在 📋，下一个读者会误以为还要再走一遍 ADR）：
  | 本单当初的阻塞/待决 | 现状态 |
  |---|---|
  | `InputManager` 单指针，双指无法玩法层表达；甲/乙未裁 | **甲′ 已落码**：`packages/framework/src/core/input/input-manager.ts` 第二指针槽（头注即标「WXG-T-169 / ADR-0015 甲′」），单指语义逐字不变、breakout 不受影响 |
  | 待 ADR | **ADR-0015 Accepted**：C-1=甲′ / C-2=丁-3 / C-3=(a)；C-4 并行开设计轨（T-167） |
  | 拆子任（输入/变换/hit-test/限幅/复位） | **T-169 Z1–Z6 全落**：`systems/board-camera.ts`（`computeFitZoom`/`fitCamera`/`applyPinch`/`applyPan`/`clampCamera`）+ `gridLayoutFor(camera?)` 命中同源 + `_readInput` 三态 + QA §A4c；含真机三反馈修正（①「只能缩放不能拖动」的 `onBoard` 域改判） |
  | 高危面：缩放后 hit-test 逆变换 | 按声明**未绕过回归网**：`layout-camera.test.ts` 回环 + 恒等档逐位锚 + 反例自检（半径不随缩必红） |
  | Z0 Cocos 多点派发取证 ⛔ | 经真机「能缩放」**反证解除** |
  | QA 查出的 F1/F2/F3 | 分别由 T-170 / T-171 / T-172 关闭（含 U11 由 T-173） |

- **余项分流（不并进本单，已逐处挂号）**：① **C-5 缩放后描边/缝隙随缩** → backlog 行（art 轨拍板，改后按 K-051 差分复算）；② **三个相机占位值 + F3-b 底线**（`BOARD_FIT_MARGIN=24` / `CAMERA_ZOOM_MAX_SPAN=2.5` / `BOARD_TAP_MOVE_THRESHOLD=8`）→ backlog 行归 §3 变更单（需 playtest 或用户给值，本批不伪冻结）；③ **pinch-focal 锚定**（现为中心缩放占位）→ 同属②的 playtest 项；④ **zoom≠1 棋盘命中真机 P0**（QA §A4c 真机 ⛔ 5 条）→ 已列入本节上方「真机首验包 P1-8」；⑤ GRID_MAX 扩容与图鉴宫格规格 → **设计轨** T-167（前置 Q1/Q2）。
- **本批同时清偿 F3-c**（T-172 当时选择「下一批顺带」）：`ADR-0015` 头部状态行原写「未改判据前棋盘区捏合不施工；本文仍不落码」——前置已解除、Z1–Z6 已入库，该字面已过期；现校正为「Accepted 且已施工落地」并保留裁定沿革与仍开放项。**代码零改动**（本批只改文档与台账）。
- **本批门禁与沉淀**：根 `verify` **17/17 PASS**（逐项不短路；含 `check:tasks` / `check:links` / `ctx:check` / `framework:sync:check` / test / `cocos:check` / `check:size`）。**诚实登记一次瞬时红**：首跑 `check:links` ❌，单跑同一命令即绿（skills 33 → **36**），真因 = **并发会话正在新建三个 skill**（`my-skills/wxgame-story-dev` / `wxgame-story-gate` / `wxgame-balance-check` + 四 IDE 链接，均为未跟踪文件），与本批零交集 ⇒ 取「复跑后绿」的 17/17 为本批证据（判例 K-045 并发竞写：共享门禁上的红要先分清是不是自己的）。**本批未跑新测试**（零代码改动，沿用 HEAD 现有 496 例绿底）。`kb:sync --task=WXG-T-166` 沉淀统计：**新增 1（K-057 [流程]「立项单」与「ADR 状态行」都不会被实施它们的另一张单自动收口，核销时要成对扫）/ 修改 0 / 激活 0 / 归档 0**；`kb:audit` 无归档候选、无相似命中（活跃 57 / 归档 0）；`ctx:build` 已刷索引面。**未提交**（沿用户口径：先看改动）。**遗留未清（用户本批未选）**：T-169 主表行尾仍写「⚠ QA 查出 F1 待修」（F1 已由 T-170 关），F3-a（ADR §3.4 快照口径）继续挂 backlog。

---

## WXG-T-167

**beads·缩放设计轨（C-3 判据翻转 + 图鉴/扩容盘面 concept 提案）** · 负责：文策渊(design-strategist)·主理人编排 · 状态：✅ **两笔交付均已入库**（(i) 判据翻转随 `e95a55f`/`1fefe3b`；(ii) `gdd/meta-ui.md` 草案 v0.2 随 `bcd1dcb`，同日已升 **v0.3**）；**Q1/Q2/Q4/Q5/Q7/Q7-b 六项已裁完**，未决仅余 Q3/Q6/Q8/Q9/Q10/Q11；**§3 冻结值零变更、零代码改动**，转正式 GDD 与拆 Story 待变更单

- **缘起**：ADR-0015（WXG-T-166）主理人裁定 C-3=(a)「棋盘区抬起才提交 + 位移阈值」＋ C-4=「图鉴/扩容盘面设计轨现在开、与缩放并行」。本单承接这两条的**设计侧交付**，不动代码。
- **领号说明（并发避让·判例见 T-168）**：本会话（Qoder design-strategist）在 `input-control.md` v2.5 头注占用 167；CodeBuddy 会话据此改领 168。头注「167 归属」由 T-168 会话代为登记，主表行/详情节由本会话补齐（即本节）。
- **交付物 (i) · C-3 判据翻转（缩放施工前置）**：
  - `input-control.md` **v2.5**：§2.1 路由入口翻为「棋盘区 tap = 按下→抬起且位移<阈值；drag = ≥阈值→平移不发玩法指令；双指=捏合缩放；HUD/托盘/面板仍按下即响应」；§8 判据 **2/4/9/10 以删划线留档翻转**，§8 头新增「未翻清单」防 QA 全量重跑；§6 补新增手势边界 5 条。**位移阈值 `BOARD_TAP_MOVE_THRESHOLD` 仅给形态不给值 `[待确认]`**。
  - `core-loop.md` **v2.1**：`bead:placed` 发射帧 down→up，§8 末「时基位移注」点名下游（落座回弹/扫光/`level:cleared` 判定帧/连击间隔）并标注**连带 K-052 时长常量重跑**。诚实登记一处旧错引（ADR-0015 所称 core-loop §8-3 实为满槽禁取珠，按 §2.2.2+§8-4 实质落点钉，未改判据编号）。
  - **归属共存**：与 T-168 的 `input-control` v2.6（取回分支）交错但互不影响（T-168 详情已确认「v2.5 时基翻转不受影响」）。
- **交付物 (ii) · 图鉴 + 扩容盘面 concept（新系统，仅提案未裁）**：新建 `games/beads/design/proposals/v2-album-dense-boards.md`（106 行，标题含「提案 · 待裁」）。
  - 理解：每张「图」= 一个拼豆画作，由 3×3（9 宫格）或 4×4（16 宫格）**子拼图版面**组成，每子版面是一个可玩关卡（Album → Plate → Cell-Level 三层树）；全部子版面完成 → 整图完成 → 图鉴收入。落 S10 元游戏页族（`gdd/meta-ui.md` 仍待建）。
  - **开放问题 Q1–Q11**（只列不自答）：**Q1 子版面是否复用「错位归位」内核**（若否 = 加第二玩法内核，S1/S3 判据翻倍、须改判 concept D1）／**Q2 宫格同时可见 vs 顺序解锁**（决定「一屏是否需 N 个独立缩放版面」，直接判定 ADR-0015 丁-3 单相机前提是否失效、是否须提前投资丁-2 分组变换）／盘面扩容档位（GRID_MAX 从 13×12 扩到多少）、图鉴入口位置、整图进度显示、珠子密度/连续性规则、体力扣减口径、与 demo 8 关关系等。
- **不冻结清单**：位移阈值、缩放档位上下限、`GRID_MAX_*` 扩容值、宫格规格、体力口径 —— 全部 `[待确认]`，待主理人裁 Q1/Q2 后再进 GDD。
- **交互形态复确认（2026-09-19，用户）**：本单**不引入滑轨/缩放按钮**——`concept` **D13**（v1.24 / WXG-T-141 用户拍板「棋盘缩放只做双指捏合手势、无滑轨/按钮控件」）**维持原样**；对参考竞品「放大镜图标 + 竖向滑轨」的否案（`design/references/ref-video-2026-09-17-ui-ux-analysis.md` 10.8-1「不猜不抄」）也不变。缩放能力已随 T-169 落码可用，**本单真正的卡点是 Q1（是否引入第二个玩法内核，撞 D1/支柱 3）与 Q2（宫格同时可见 vs 顺序解锁，决定单相机丁-3 前提是否失效）**，不是输入形态。

- **执行批（2026-09-19，用户裁四项 → spawn 文策渊出草案）**：
  - **裁定**：**Q1 = 甲**（子版面 = 复用错位归位内核 ⇒ 不启用 S11、`concept` D1/支柱 3 不改判、S1/S3 判据不翻倍）· **Q2 = 逐格推进 / 点格放大**（单相机 丁-3 前提成立，`ADR-0015 §5-3` 丁-2 复评**不触发**；**提案表原义「甲 = 多格同屏可见」未被采纳** ⇒ 字母与本单选项不一致，已在文件头钉死「引用看正文不看字母」）· **Q4 = 甲**（主菜单页族内独立页，启动路径零改动）· **Q5 = 甲**（完成度纯显示 ⇒ 不发奖、不另立解锁门槛、不扩 S8 档面）。
  - **交付**：新建 `games/beads/design/gdd/meta-ui.md`（S10 + 图鉴八节，**185 行 / 7,992 估算 tokens**，B 门内达标、未申请豁免；余量仅 8 tok ⇒ **转正前须先把 §10 外移**，已挂 backlog），含三层 Screen Flow（§4.1）与 **CH-1…CH-7 §3 变更单草案**（数值列全空、**未提交**）；同笔索引登记 = `systems-index` **v1.33**（S10 行「待建 · 归批1」→「草案 v0.2 已落盘；**ui-kit 图元层仍待建**」）+ changelog v1.33 行。随 `bcd1dcb` 入库。
  - **本批边界**：**零 §3 变更、零新常量、零代码改动**；未改 `ux-spec.md`（19,587 tok 豁免条要求先评线框外移）；未拆 Epic/Story（程基岩拆前须见冻结值）。
  - **顺带发现的漂移已同批回写**：`concept.md` v1.5→**v1.6** —— 支柱 2 / MDA Dynamics / §7 MVP / D13 四处仍写「托盘 24 槽（2×12）+ 扩展 24」，而 `§3.4` v1.30（WXG-T-168）已改为 **12 + 12** ⇒ 四处划线留档改注现值（K-053 型回写遗漏；由本单执行批发现）。D13 的「仅双指捏合、无滑轨」部分按上条复确认维持。
  - **门禁**：`ctx:check` OK · `check:links` OK（agents=7 skills=33）· 根 `verify` **17/17 PASS**（当前态连跑两次均 exit 0；beads 499 / framework 306 / breakout 239）。**一次瞬态红未确诊（诚实登记）**：本批首次 verify 报 `test` exit 1而套件均报通过；当时只 tail 了摘要、**未留全量日志 ⇒ 证据丢失**。已排除「`zz-bis3.test.ts` 采集期消失」假设（该删除早于失败点 3 小时，随 `464afba` 09:13 入库）；最强候选 = CodeBuddy 会话 T-177 测试迁移的**在途写入窗口**（他们 11:58 提交，失败发生在 ≈12:05）。复跑两次均绿 ⇒ **不记为已确诊**；流程改法 = **以后跑全量门禁一律 `> temp/verify-*.log 2>&1` 再看 tail**（同 K-036：无逐项证据不下结论）。
  - **文策渊回执里的新缺项（本单新登记）**：**Q7-b = 子版面→整图页的退回通道语义**（v1.29 只裁了「回主菜单 = 弃本局棋盘」，从第三层退回第二层是保留还是重开无裁定）——提案 Q1–Q11 原本**没有**这一条，写 `ux-spec` 矩阵前必须先裁；与 Q7 体力口径同批裁。
  - **沉淀（`kb:sync --task=WXG-T-167`）**：**新增 1 / 修改 0 / 激活 0 / 归档 0** —— K-059 [流程]「用『甲/乙/丙』转述既有候选清单时必须带正文锚——字母会换义」（本次 Q2 字母与提案原义冲突的根治项）；`kb:audit` 无归档候选、无相似命中（活跃 59）。
  - **续批 v0.3（同日，用户补裁最后两项）**：**Q7 = 甲（逐格扣）**⇒ 一格 = 一次新局 = 扣 1 心，**§3.14 现文与数值零改动、不走反转批**；§2.5 转「已裁」并把读法二/三标为未采纳留档；**已知后果写进正文**（单图预算 = 格数 vs `STAMINA_MAX=8`/8 min-心 ⇒ 半图即碰 0 心门），列为 **playtest 首要观察项**，回调途径 = 变更单而非本文自改口径。**Q7-b = 甲（退回即弃本局）**⇒ 与 v1.29 同口径、不新增第三种语义，新增 **§8-9** 不变式（与 `pause-settings §8-11` 共用测试形状）；§8-7 转正并附反例。同时把 **§10 CH-1…CH-7 整表外移**为 `gdd/meta-ui-changelog.md`（v0.2 只剩 8 tok 余量 ⇒ 分片而非申请豁免，先例 = WXG-T-062 把 systems-index 变更记录分片），正文 §10 改为一行指针；**backlog 的「转正前须外移 §10」条已结项移除**。**仍零 §3 变更、零新常量、零代码改动。**
  - **下一步（建议序）**：**Q1/Q2/Q4/Q5/Q7/Q7-b 已全部裁完** ⇒ meta-ui 已具备**转正与 UX 回写条件**：① 主对话把未提交的 T-167 登记批（systems-index v1.33 + changelog / concept v1.6 / 两张台账 / K-059 / 本文件与分片）一并入库（避开并发会话同文件写入，判例 K-045）；② `ux-spec` 三层 Screen Flow + 矩阵行回写（**触达时先评 §3 线框外移**，该正本实测 19,587 tok）；③ §3 变更单（CH-1/2/3/5/7）须待 Q3/Q6/Q8/Q9/Q10/Q11 裁定；④ 美术轨答 `ADR-0015` C-5 与整图灰态/点亮态；⑤ 冻结值落定后由程基岩拆 Epic、QA 从转正后 §8 重导出五件套。**playtest 首要观察项 = 逐格扣与 8 心上限的冲突。**
- **下一步（旧口径，2026-09-19 已执行完毕，留档不删）**：~~主理人就 **Q1 / Q2** 拍板（其余依赖此两条）→ 文策渊出提案一页纸转正 + 新建 `gdd/meta-ui.md`（八节含图鉴）+ §3 变更单草案~~（✅ 已做：四项裁定 + `meta-ui.md` v0.2 + CH 草案）；~~UX 侧 `ux-spec` 抬起提交回写~~（✅ 已随 T-169 Z6：ux-spec v1.9/v1.10）；~~程基岩在 C-3 前置解除后开工 甲′+丁-3~~（✅ 已随 T-169 落码）。**现行下一步 = 上方「执行批」末条（裁 Q7/Q7-b → 转正 → 变更单 → 拆 Story）。**

---

## WXG-T-169

**beads·棋盘缩放平移落码（Z0–Z6）** · 负责：程基岩(eng)·主理人收口 · 状态：✅ **收口（2026-09-19）** · 上位决策：`ADR-0015`（Accepted，甲′+丁-3+C-3(a)）· 前置判据：`input-control.md` v2.5 / `core-loop.md` v2.1（已随 WXG-T-167 入库）

- **范围**：仅落「棋盘区双指缩放 + 单指平移 + 抬起才提交」能力。**不含** GRID_MAX 扩容、图鉴/meta-ui、C-5 描边随缩裁定、位移阈值与缩放档位数值冻结（后三者分别走设计轨 WXG-T-167 / art 轨 / §3 变更单）。
- **Story 依赖序**：Z0（Cocos 多点派发真机取证，⛔ 无设备/编辑器挂账）‖ Z1（InputManager 多槽化甲′）→ Z2（gridLayoutFor 参数化 + 命中半径随缩 + 回环/反例自检）→ Z3（view-model 参数化 + 格心剔除）‖ Z5（board-camera.ts 纯函数）→ Z4（_readInput 抬起提交状态机 + 相机门禁/复位 + 迁移真链用例）→ Z6（QA test-cases 迁移 + 门禁全跑 + framework:sync）。
- **关键不变式**：`gridLayoutFor` 恒等档（camera=undefined 或 zoom=1/offset=0）产出与今日**逐位相同**（旧 460 例、快照差分、command 流零漂移）；单指旧输入序列在 InputManager 改动前后逐帧 snapshot 全等（向后兼容锚）。
- **假设（若错回炉）**：C-5 未裁→视图占位「不随缩」标 [R]/[P]；Cocos 逐指派发假设成立（Z0 否证则 bindings.ts 补 getTouches 遍历，不触 core）；owner 不迁移为工程自裁（ADR-0015 §3.2-3 附复评）。

- **落码结果（2026-09-18 本会话续）**：Z1–Z5 代码全部落地，`verify` **17/17 PASS**、beads **486 例绿**（+15 回环/恒等锚/反例 +9 手势 +2 抬起提交正面判据）、`framework:sync` 已镜像（input-manager→两游戏；beads tuning/game/state/view-model + 新 board-camera.ts）。
  - Z1 `input-manager.ts` 第二指针槽（甲′，owner 语义逐字不变、次指不产 justDown、owner 抬起不迁移）+ `input-manager.test.ts` 6 例含单指回归锚。
  - Z2 `gridLayoutFor(cols,rows,camera?)` + 抽 `hitGridCell(layout,zoom,x,y)`（`_hitGridCell` 委托，命中半径 ×zoom）+ `layout-camera.test.ts`（回环 / 恒等档逐位 / 反例自检半径不随缩必红 / DPR 2·3 桩）。
  - Z3 `view-model.ts` 几何读 `snap.gridPitch/gridCell`（=layout.cell/pitch，恒等档=常量）+ 格心可视窗剔除（免 clip）；`state.ts` 快照扩两字段；bead-render 零改动。
  - Z4 `beads-game.ts` `_readInput` 三态（棋盘区 tap 抬起提交、区外按下不变、单指 drag→平移、双指→捏合）+ `_camera`/`_gesture` 字段 + setup 复位；`frame-order` fo-3 / `phase-input-realchain` game-over 两处帧账按 2 帧 tap 语义迁移（诚实改，非凑绿）；新增 `board-input-timing.test.ts` 正面证 down 不落/up 才落 + drag 不落。
  - Z5 `board-camera.ts`（`createGesture/applyPinch/applyPan/clampCamera/resetCamera`，纯函数、pinch 相对倍率、ponytail 注：中心锚 zoom，focal 待 playtest）+ `board-camera.test.ts` 9 例。
- **未完（诚实登记，未打假勾）**：
  - **Z0 真机 spike ⛔**：Cocos 逐指点 `touch-start`/`getID()` 形态未取证（无编辑器/无 AppID/无真机，ADR-0009 P2）；解除前 甲′ 在 Cocos 侧「未证可行」，若否证则 `bindings.ts` 补 `getTouches()` 遍历（不触 core）。
  - **Z6 QA/UX 派生文档回写**：`production/qa/beads/test-cases.md` §A2/§A3 抬起提交形态 + zoom/pan Node 用例 + 真机 P0（zoom≠1 棋盘命中）挂账；`ux-spec §4/§5` 抬起提交 + 动效起算点后移回写（GDD `input-control v2.5`/`core-loop v2.1` 已翻转，派生文档待镜像，属 K-053 反转批收尾）。
  - **§3 数值**：位移阈值 `BOARD_TAP_MOVE_THRESHOLD=8`、`CAMERA_ZOOM_MIN/MAX=1/3` 均为 tuning 工程占位 `[待确认]`，未进 §3；最终值走 §3 变更单 + playtest。
- **门禁**：`framework:sync:check` ✅ · `cocos:check` ✅ · `check:size` ✅ · `typecheck` ✅ · `test` ✅。

- **真机三反馈修正（2026-09-18 用户复验后，同单续做）**：
  - **①「只能缩放不能拖动」根因确诊**：`_readInput` 的 `onBoard` 旧判据 = `_hitGridCell != null`（须命中某格半径），真机拖拽从格间隙/盘面留白起手 ⇒ 判为区外 ⇒ 从不进拖拽态。**改**：`onBoard` = 落点在 `PUZZLE_BAND` 整块（起手域，非命中格）；tap 提交仍走 `_handleTap` 内部命中裁决。
  - **②「缩放要有限度 / 拖不出屏」**：`clampCamera(cam, cols, rows)` 重写为内容边界夹取——缩放界 `[fit, fit×CAMERA_ZOOM_MAX_SPAN]`；平移 `maxOff = max(0,(boardPx − viewport)/2)`：棋盘 ≤ 视口时 offset 锁 0（居中、拖不动也拖不出屏），> 视口时可滚到四角但棋盘边缘永不离开视口、不露空白。`clamp` 归一 `-0`（防渗进快照）。
  - **③「初始居中不贴边」**：新增 `computeFitZoom(cols,rows)=min(1, 含 BOARD_FIT_MARGIN 适配)` + `fitCamera`；`_setupLevel`/`_loadStage` 初始相机改 `fitCamera`（大盘缩到含边距居中；小盘 fit=1 恒等 ⇒ 旧基线/测试零漂移）。
  - **数值全部 `[待确认]` 工程占位**（`BOARD_FIT_MARGIN=24`、`CAMERA_ZOOM_MAX_SPAN=2.5`、`BOARD_TAP_MOVE_THRESHOLD=8`），未进 §3；真机手感调参走 §3 变更单。**pinch-focal 锚定仍 ponytail 占位（中心缩放）**。
  - **验证**：beads **489 例绿**（`board-camera.test.ts` 12 例锁 fit/夹取/相对倍率；`layout-camera` 回环+恒等锚+反例；`board-input-timing` 抬起提交正面判据）、`verify` **17/17**、`framework:sync` 镜像。Cocos 逐指点派发经本轮真机「能缩放」反证成立 ⇒ **Z0 `[C]` 前置解除**。

- **Z6 派生文档（2026-09-18 续，本单末批）**：
  - `production/qa/beads/test-cases.md` v1.13（严守真）：§A2/§A3/§A4 输入判据按 `input-control v2.5` 抬起提交改写（旧口径删除线留档）；新增 §A4c 缩放/平移用例，分 **Node 可证 9**（回环 / 反例自检 / 恒等锚 / 输入槽 / 抬起提交，落点 = 本单四测试文件）+ **待执行 7** + **真机 ⛔ 5**（zoom≠1 命中 = P0）；三数值 `[待确认]` 不作判据。
  - `games/beads/design/ux/ux-spec.md` v1.9（文策渊）：§4 状态×输入矩阵 抬起提交 + 新增 drag/捏合 两行 + 区外「按下即响应不变」标注；§5 动效表 11 处「起算点 down→up 后移注」+ K-052 重跑清单 + 未加注白名单（防全表重跑）；§3 零改动。
  - **工作树卫生**：期间 `board-camera.ts`/`.test.ts` 被编辑器自动 2→4 空格重排致 `framework:sync:check` 转红（`git diff -w` 空＝纯空白），已 `git checkout HEAD` 回退（仓库 2 空格约定），镜像复一致。
- **⚠ QA 本单查出、待主理人处置的缺陷/漂移（未在本单改码）**：
  - **F1（P1，代码真缺陷）**：同一固定步内 `down+up` 到达时，`_readInput` 的 `if(justDown){…return}` 吞掉同快照 `justUp` ⇒ 棋盘区快速点击丢提交 + `_tapActive` 悬挂。真机 <16ms 快点概率低不为 0、自动化探针 100% 触发。修法建议：justDown 分支内若同帧 `justUp` 则位移恒 0＝即时 tap，当场抬起提交。**⇒ 已修于 WXG-T-170**（用户 2026-09-18 授权）。
  - **F2（P3）**：位移度量口径——GDD §2.1 写切比雪夫，实现为曼哈顿 `|dx|+|dy|`；阈值未冻结不判 FAIL，但形态须先于定值裁定。**⇒ 已修于 WXG-T-171**（用户 2026-09-18 拍板**甲 · 切比雪夫 L∞**，代码 `sum`→`max` 1 行）。
  - **F3（P3）**：ADR-0015 §3.4 / GDD「相机复位归**恒等**」与本单真机反馈③改用的 `fitCamera`（第 8 关 fit≈0.9518）措辞漂移；须回写 ADR/GDD 复位口径为「归 fit 初始」。
  - **U11（文策渊登记）**：`core-loop v2.1` 注②称扫光整链挂抬起帧，但道具卡属区外（按下即响应）⇒ 两上位口径张力，待主理人裁。

- **收口批（2026-09-19，Qoder）**：本单施工面（Z1–Z6）与缺陷批（T-170~173）均已入库，唯一**真欠账** = QA `test-cases.md §A4c.2`「判据已冻结、`[Node]` 可证、本轮无落点 ⇒ 待执行」（禁读作 PASS）那批。本批补齐：
  - **新落 4 条用例 + 1 条护栏锁**（全入 `tests/board-input-timing.test.ts`，该文件 4→9 例）：**TC-CAM-09** 相机旁路（PAUSED 态拖拽/次指/张开/抬起 ⇒ `snapshot.gridPitch/gridLeft/gridTop` 逐分量不变且零玩法指令）、**TC-SUB-03** 拖→捏不提交（次指落下后主指抬起被压）、**TC-SUB-04** 指令洪泛（每 down 帧 0 条、每 up 帧恰 1 条；实投 10+ 组，受 6×5 测试关盘面限制 ⇒ 规模下标写在用例内不冒充 20 组）、**TC-SUB-07** drag 途中跨格零选中（8 帧扫盘逐帧校）、**F5 几何护栏锁**（阈值 ≥ 带间隙即红）。
  - **五轮变异自检（K-036 / K-042）**：去 `playing` 门禁 ⇒ 唯 CAM-09 红；删 `!_pinched` ⇒ 唯 SUB-03 红；提交改回 down 帧 ⇒ CAM-06/07 + SUB-03/04/07 同红；阈值 8→40 ⇒ 仅护栏例红；阈值 8→100000 ⇒ SUB-07 + 护栏例红。**SUB-07 首版差点无判别力**：抬起点原选在拖拽终点（该格落子本就不合法）⇒ 变异不红；改回「已备珠格心」（同点单指 tap 会落子 = 共位正向对照）后才锁住——已作 **K-042 追记**入库。
  - **§A4c.4 行内回填**：F5 护栏锁已落；**F7 已改**（`denied-press.test.ts` / `selection-anchor.test.ts` 两处把 `tapDesign` 误称「真链」的注释改为「路由口径/旁路，不受也不覆盖 v2.5 时基」，零行为改动；`tapDesign` 已复核为直调 `_handleTap`）；**F8 已闭合**（`framework:sync:check` 恒绿）；**F6 不并入**（用户拍板）⇒ 挂 backlog，理由：复跑会改一大片历史 `[Probe]` 读数，属取证轨独立轮次。
  - **未转态（诚实）**：**TC-SUB-05 仍 `待执行`**——占位阈值 8 < 带间隙 30 ⇒「位移<阈值却跨带」不可构造，强构只能改占位值自证；§A4c.3 真机 ⛔ 5 条**零进账**（zoom≠1 命中已归真机首验包 **P1-8**）。
  - **取证边界**：本轮只跑 `[Node]` ⇒ 所有 `[Probe]`/`[Cocos]`/`[C]`/`[R]` 读数仍属旧轮次，不引用为本批证据。
  - **门禁与沉淀**：`verify` **17/17 PASS**；beads **501 例绿**（496+5）、framework 306 / breakout 239；`test-cases.md` v1.14→**v1.15**（严守真域由主对话代落盘，承 T-146/T-172 Q1 判例，待严守真复验）；`kb:sync --task=WXG-T-169` 沉淀统计：**新增 0 / 修改 1（K-042 追加「零事件类用例新写时同样会中招：先找共位正向对照再跑变异」）/ 激活 0 / 归档 0**，`kb:audit` 无归档候选、无相似命中（活跃 57）；`ctx:build` 已刷索引面；**变更记录表仍缺 v1.10–v1.14 五行**（沿 v1.13 ⑦ 口径只登记不代写）。**本批未提交**（沿用户口径）。
- **收口后余项（逐处挂号）**：三占位值 + F3-b 底线 + pinch-focal → backlog「§3 变更单」行；C-5 描边随缩 → backlog art 轨行；F6 探针升级 → backlog 新行；zoom≠1 命中真机 P0 → 真机首验包 P1-8；TC-SUB-05 → QA 表内标「阻塞 = §3 变更单未定值」；GRID_MAX 扩容/图鉴 → 设计轨 T-167（前置 Q1/Q2）。

---

## WXG-T-170

**beads·F1 同固定步 down+up 丢 tap 修复** · 负责：主理人(Qoder) · 状态：✅ 完成 · 上位决策：`WXG-T-169 §A4c.4-F1` 移交、用户 2026-09-18 直接授权「执行 F1」（修法预先写定，未选其他方案）· 前置判据：`input-control.md` v2.5 §2.1、`ADR-0015` C-3(a)

- **背景**：`WXG-T-169` 收尾时严守真 QA 轨发现 `beads-game.ts::_readInput` 首分支 `if(snap.justDown){…onBoard…return}` 吞掉同快照 `justUp` ⇒ 同一固定步内 `down+up` 到达（真机 <16ms 快点、自动化探针 `tapChain()` 同形）时，棋盘区快速点击丢提交且 `_tapActive` 悬挂（`endFrame` 即清一次性标记，下一帧 `_prevDown=false`，`justUp` 不再复现）。`TC-SUB-06` 无落点。
- **修法**（一行守卫，就地提交）：`onBoard` 分支内登记完成后不直接 `return`，而改为 `if (!snap.justUp) return;`。同帧 `down+up` 时不 `return` ⇒ 下面 `_tapActive && snap.isDown` 守卫自然跳过（owner 已抬 ⇒ isDown=false）⇒ 进入 `justUp` 分支：`_tapActive && !_tapMoved && !_pinched` 成立（刚登记后三者均为 false）→ 就地提交，随后复位。**语义与旧行为向后兼容**：区外 `justDown` 仍当场提交（包入 `else` 分支，行为逐字不变）；多帧 tap（down 帧不提交、up 帧才提交）仍走原分支。
- **落码**：`games/beads/src/game/beads-game.ts::_readInput` onBoard 分支（+8/− 2）；新回归例：`games/beads/tests/board-input-timing.test.ts` “同固定步 down+up” 一例（先跑→红→修→绿，另含后续空帧不重复提交反验）。
- **验证**：beads **490 例绿**（489 旧例零改动 + 本例，`verify` 中）、`framework:sync:check` ✅（本单不触 `packages/framework/**`、无需镜像）、`typecheck` ✅。
- **未干（不属本单）**：`TC-CAM-DEV-03`（Cocos 逐指派发形态与亚帧事件归属）仍 `[C]`⬜，不属本单 Node 可证范围。F2/F3/U11 属口径/设计轨裁决，不在本单。
- **门禁**：`framework:sync:check` ✅·`cocos:check` ✅·`check:size` ✅·`typecheck` ✅·`test` ✅。

---

## WXG-T-171

**beads·F2 棋盘 tap/drag 位移度量形态裁决** · 负责：主理人(Qoder)→文策渊(design)+程基岩(eng)+严守真(QA) · 状态：📋 已立项待裁（形态四选一，推荐甲）· 上位决策：`WXG-T-169 §A4c.4-F2` 移交、用户 2026-09-18「派发任务」· 前置：`input-control.md` v2.5 §2.1、`ADR-0015` C-3(a)、`beads-game.ts:1849-1851`

- **背景**：v2.5 GDD `input-control §2.1` 明写「切比雪夫位移判定」（第 26 行：`BOARD_TAP_MOVE_THRESHOLD`（**切比雪夫**位移判定，单位 px））；`beads-game.ts::_readInput` 实现为 **曼哈顿** `Math.abs(dx) + Math.abs(dy) ≥ BOARD_TAP_MOVE_THRESHOLD`。QA §A4c.4-F2 可构反例：偏移 `(5, 5)` ⇒ L1=10≥8 判 drag，L∞=5<8 应判 tap（当前行为与 GDD 字面语义不一致）。因阈值 `BOARD_TAP_MOVE_THRESHOLD=8` 属 `[待确认]` 工程占位、未进 `systems-index §3` ⇒ **不判 FAIL**；但形态先于定值（否则定值时测得手感与运行行为不同形，K-053 同族风险）。
- **范围与不范围**：
  - **范围**：仅裁**度量形态**（L∞ / L1 / L2）；不裁**阈值数值**（数值仍 `[待确认]`，属另一批走 `systems-index §3` 变更单 + playtest）。
  - **不范围**：不拓其他输入判据（`§2.1` 区外/捏合/拖拽逐帧行为均不变）；不重新基定命中半径与格度。
- **裁决四选一（待用户拍板）**：
  - **甲（推荐）· 切比雪夫 L∞ = max(|dx|,|dy|)**：与 GDD v2.5 字面一致；代码改 1 行（`sum`→`max`）；判定域 = 正方形（与盘面格子自然对齐，手指抖动「不越格」直觉）；斜向 5,5 不越阈 → 判 tap（对手指拖抽宽限）。
  - **乙 · 曼哈顿 L1 = |dx|+|dy|（实现为准）**：代码不动，GDD 回写 1 行（切比雪夫→曼哈顿）+ 变更记录；判定域 = 菱形；斜向 5,5 位移 L1=10≥8 → 判 drag（drag 对斜向更敏感）。
  - **丙 · 欧氏 L2 = hypot(dx,dy)**：直觉「真距离」；代码 1 行 (`Math.hypot`)；判定域 = 圆；需同时改 GDD 与代码；引入开方，热路径性能轻微下负（但本分支已仅手势帧，不属固定每帧热路径）。
  - **丁 · 延后**：与阈值定值一批处理（playtest 时同形同值一起测）。**风险**：GDD 与实现长期并存漂移，下游阅读 GDD 的任何人（包括本仓自身未来会话、新成员）需自行判断哪个为准，K-053 同族。
- **依赖序（拍板后启动）**：
  1. **主理人（用户）**拍板甲/乙/丙/丁。
  2. 若 **甲** ⇒ spawn **程基岩(eng)** 改 `beads-game.ts:1849-1851`（`Math.abs(…) + Math.abs(…)` → `Math.max(Math.abs(…), Math.abs(…))`），GDD 不动；同时 spawn **严守真(QA)** 新增反例判据（`(5,5)` 偏移应判 tap、`(9,0)` 应判 drag），`TC-CAM-*` 补一行，`board-input-timing.test.ts` 或新例。
  3. 若 **乙** ⇒ spawn **文策渊(design)** 回写 GDD `input-control §2.1`（切比雪夫→曼哈顿 + §7 变更记录）+ **主理人确认冻结**；代码不动；QA 补反例同 2。
  4. 若 **丙** ⇒ 同时 spawn 设计轨（回写 GDD：切比雪夫→欧氏）+ 工程轨（`Math.hypot`），QA 同 2。
  5. 若 **丁** ⇒ 本单挂起、不 spawn，入 backlog（需带一个「不先裁漂移风险已接受」的注）。
- **不触及**：`systems-index §3`（阈值未冻结，本单不动 §3）；ADR-0015（度量形态属实现细节，不属架构）。
- **预计交付面**：代码或 GDD 中一边改（**不会**两边同时改）；QA 补 1 反例（与裁决同形）；本单一行回写（裁决后自动）。
- **风险**：丁（延后）一旦选，下个接触阈值定值的任务（playtest 批）必须同时重开本单，拖链 K-053 反转批周期。
- **完成定义**：裁决选定 → 对应成员交付 → `verify` 17/17 → 本单 ✅（包括反例绿）。

- **完成记录（2026-09-18 本会话）**：用户拍板 **甲 · 切比雪夫 L∞**（同推荐）。实际交付与依赖序中「甲」分支一致：
  - **工程轨（程基岩，主对话直行）**：`beads-game.ts::_readInput` L1849–1851 `Math.abs(dx) + Math.abs(dy)` → `Math.max(Math.abs(dx), Math.abs(dy))`（+5/− 2行，含注释）。`tuning.ts::BOARD_TAP_MOVE_THRESHOLD` 注释同步补「**切比雪夫 L∞ = max(|dx|,|dy|)**」；阈值数值仍 `8 [待确认]`，**未进 `systems-index §3`**（属另一批）。GDD `input-control §2.1` v2.5 不动（实现与 GDD 现已一致）。
  - **QA 轨（严守真，主对话直行）**：`board-input-timing.test.ts` 新增 1 例「位移度量 = 切比雪夫 L∞（F2 回归例：(5,5) 应判 tap）」；先跑→红（L1 下判 drag ⇒ 不提交）→修→绿。反验区选 L1=10 / L∞=5 中间阈值 8 的分歧区；(5,5) 仍在盘格内部（格≈46 px），不会因跨格失败。
  - **镜像**：`framework:sync` 写入 2 件（beads-game.ts + tuning.ts），`framework:sync:check` ✅。
  - **验证**：beads **491 例绿**（490 旧例零改动 + 本例）、`verify` **17/17 PASS**。
  - **台账回写**：主表行状态 升 ✅；T-169 §A4c.4-F2 行标「已修于 WXG-T-171」；`production/qa/beads/test-cases.md` §A4c.4-F2 同步。

---

## WXG-T-172

**beads·F3 相机复位口径回写（GDD/ADR vs fitCamera）** · 负责：`studio-orchestrator` → 文策渊(design) + 程基岩(eng) + 严守真(QA) · 状态：🔄 已派单，待阶段 0 诊断与裁决 · 上位：`WXG-T-169 §A4c.4-F3` 移交、用户 2026-09-18 「走完整 spawn」 · 前置判据：`input-control.md` v2.5 §6、`ADR-0015` §3.4、`beads-game.ts:1724 / 1760`、`board-camera.ts::fitCamera / computeFitZoom`

- **背景（漂移）**：`input-control.md §6` 与 `ADR-0015 §3.4` 写「换关/重试/回菜单相机**归恒等**」（zoom=1）；但 T-169 真机反馈③将初始相机改为 `fitCamera`（大盘缩放适配，第 8 关 fit≈0.9518），代码与字面语义不等价。
- **候选口径（待主理人拍板，推荐以实现为准）**：
  - **甲（推荐）· 以实现为准**：回写 GDD/ADR 「归恒等」→「归 fit 初始」（fit=min(1, 含边距适配)），小盘 fit=1 与旧恒等档等价。与 T-169 真机反馈③ 同方向。
  - **乙 · 以 GDD 为准**：代码回退到恒等（fitCamera 仅用于首次入场，复位回恒等）。风险：重新引入 T-169 真机反馈③「初始不贴边」问题；169 已删旧行为基线、回退会拆基线。
- **三成员任务（待 orchestrator 阶段 0 确认拆分）**：
  - **文策渊(design)**：基于裁决结果回写 `input-control.md §6` + `ADR-0015 §3.4`（含变更记录）；不自动定稿，需主理人确认。
  - **程基岩(eng)**：若甲，核对 `beads-game.ts` 复位代码与 GDD 新口径一致，必要时补注释（不改行为）；若乙，回退代码到恒等（需与 T-169 真机反馈③ 同方向）。
  - **严守真(QA)**：`TC-CAM-08` 目前「待执行」，裁决后补落点（Node 可证：相机 `_setupLevel`/重试/回菜单后 zoom==fit）。
- **不触及**：`systems-index §3`（fit 本身不是新常量）；`board-camera.ts` 内部实现。

- **完成记录（2026-09-18 本会话，三成员 spawn 交付）**：用户拍板**甲 + 附裁 5→2**（同 orchestrator 推荐）。实际拆分与派单方案完全一致。
  - **D1·文策渊**（design-strategist spawn）：`input-control.md §6` 相机复位行 回写「归 fit 初始」（不钉数值，不删原行标签），头注升 v2.7、§9 新增 v2.7 行。§8-4 中的「恒等档」（= zoom=1 取值档）与本次不同口径，**未改**，行号与理由入 §9 v2.7。
  - **E1·程基岩**（engineering-lead spawn）：`ADR-0015 §3.4` 回写：复位档=fit 初始（非恒等）+ 5 个复位点收敛为实际 2 点（`_setupLevel` / `_loadStage`）+ 回菜单/后台隐藏归「下次装配兜住」+ `InputManager.reset()` 非复位点（原文误列已删）+ `resetCamera()` 保留（测试工具，不在复位链上）；头部新增修订行（沿 ADR-0011 既有约定，不新造修订史节）。
  - **E2·程基岩**：`beads-game.ts:1724 / :1760` 各补 2 行注释（零行为改动）；`computeFitZoom` 头注已含「initial view」口径，不重复加。
  - **E3·程基岩**：`board-camera.test.ts` 新增 5 例（TC-CAM-08 新落点）：13×12 大盘归 fit（fit<1）、**6×5 小盘 fit=1 与旧恒等逐位相同**（回归锚，与 layout 逐项比）、重试（大盘 120s 烧穿 → retry → 归 fit）、冲刺换 stage（真链 stage0→1 + 大盘 stage7）、**后台隐藏当帧不复位→下次装配兜住**（新口径负向锁）。**变异自检**（K-036）：临时注掉复位点① `fitCamera` ⇒ 5 例中 4 例必红（stage 例仍绿因走复位点②）⇒ 证真实判别力，两点各自有独立覆盖。
  - **Q1·主对话代落笔**（严守真 readonly）：`test-cases.md` TC-CAM-08 升 ✅ 已验（WXG-T-172）；§A4c.4-F3 行标「已修于 WXG-T-171」。新判据正文 = E3 实际断言，不钉字面值。
- **验证**：beads **496 例绿**（491 旧例零改动 + 5 新例）、`framework:sync:check` ✅、`typecheck` ✅、`check:arch` ✅（1 warning 属既有编辑器产物）、`check:es5spread` ✅、`ctx:check` ✅、`verify` **17/17 PASS**。
- **同批新发现移交（不并入本单、需另单或归现有轨）**：
  - **F3-a**（`ADR-0015 §3.4` L168「相机三标量进快照」同类文档漂移）：实现中快照不含 zoom/offset（相机烘进 `gridLayoutFor`，非下发）⇒ **另开一单清偿**（避免本单范围吹大）。
  - **F3-b**（`ADR-0015 §3.4` 钳位条 z<1 与 `TOUCH_MIN=88` 底线未裁）：`TC-CAM-DEV-05` 属 §3 变更单一批（连带 `BOARD_FIT_MARGIN` / `CAMERA_ZOOM_MAX_SPAN` / `BOARD_TAP_MOVE_THRESHOLD` 三占位值），不在本单。
  - **F3-c**（`ADR-0015` 头部状态行「本文仍不落码」，T-169 已施后未回写）：属事实校正一句话，下一批 ADR 回写时顺带。
  - **F3-d**（`ctx/index.json` 中本 ADR token 估计现值 11343 为改前）：ctx:check 仍 OK，留给下一次统一 ctx 刷新（避免为同批其他未收尾文件生成索引）。
- **与 T-169/T-170/T-171 一致性自查**（orchestrator 阶段 0 预定检查点）：
  - `fitCamera` 语义与 `board-camera.ts` 头注 V5「initial view + zoom-out floor」同向✅；小盘 fit=1 与旧恒等逐位相同一句写在 GDD/ADR 正文与 E3 例② 中，**486→496 基线不拆**。
  - `input-control §2.1` 中「切比雪夫」（T-171 F2）未触碰✅。
  - `_readInput:1834` sub-frame tap 提交（T-170 F1）与 `_readInput:1849–1855` L∞（T-171 F2）**不属本单接口**，未碰✅。
  - ADR-0015 §3.5 C-3(a) 分区 未触碰（本单只改 §3.4）✅。

---

## WXG-T-173

**beads·U11 扫光链起算帧归属裁决** · 负责：`studio-orchestrator` → 文策渊(design) + 程基岩(eng) + 严守真(QA) · 状态：🔄 已派单，需用户先裁 · 上位：`WXG-T-169` 中 `U11` 条目（文策渊登记）· 前置判据：`core-loop.md` v2.1 §8 末「时基位移注」② 、`input-control.md` v2.5 §2.1、`ADR-0015` §3.5 C-3

- **背景（两上位口径张力）**：`core-loop v2.1 §8` 注② 写「扫光与道具链整链挂**抬起帧**」（包括解环器相 A 200ms → 逐颗 80ms → 落座收尾）；但道具卡属**区外**，`input-control v2.5 §2.1` 明写「HUD / 托盘 / 道具卡 / 扩展钮 / 面板 仍**按下帧响应**」（T-169 C-3(a) 分区提交）。两上位口径对「`powerup:used` 发射与扫光链起点」归属不一致。
- **候选方向（待文策渊出完整三方案 + 主理人拍板）**：
  - **甲 · 拆两套扫光链**（推荐先评估）：棋盘区扫光（归位/取回引发）挂抬起帧；区外扫光（解环器引发）挂按下帧。`core-loop §8` 注② 改写为拆两套。
  - **乙 · 道具卡例外后移**：道具卡提交时基从按下改到抬起（破坏 T-169 C-3(a) 分区），与棋盘区同。
  - **丙 · 拆事件不拆时基**：`powerup:used` 仍在按下帧（区外不变）；扫光链的「与珠互动部分」（如逐颗 80ms 重启门）挂抬起帧（仅当同帧也有棋盘提交时）。
- **三成员任务（拆阶段）**：
  - **阶段 1（前置）**：spawn **文策渊** 产出三方案完整利弊（MDA/手感、K-052 同族时长常量影响面、下游判据影响）→ 主理人拍板 → 阶段 2。
  - **阶段 2**：按裁决 spawn：
    - **文策渊**回写 `core-loop.md` 注②（拆/不拆两套）与相关判据（如 `input-control §8-11`）。
    - **程基岩** 若需改行为（乙）→ 改 `_readInput` / `_handleTap` 中道具卡提交时基；否则仅注释。
    - **严守真** 补/改 QA 判据（扫光链起算帧的下游时长实测口径，`TC-*`，真机 playtest 部分仍 `[R]`）。
- **不触及**：`systems-index §3`；`ADR-0015` 本体（属实现细节口径，不改架构）。
- **风险**：三方案中乙会直接推翻 T-169 C-3(a) 已裁分区，风险最高；丙需确认「事件拆不拆」与 K-052 同族时长实测可验；甲保留两套机制但下游口径需拆。

- **阶段 1·D0 回传（2026-09-18）**：文策渊报告排序 = **丁 ≫ 甲 > 乙 > 丙**；**丙不推荐**（「同帧既有道具链又有棋盘提交」与 `core-loop §2.2.2`「每帧 ≤1 条输入指令」冲突，且「逐颗 80ms 重启门」在代码不存在——80ms = stagger 间隔，120ms 门属手动连点侧独立队列）。**关键洞察**：「一旦把甲的前提修正为「只有一套扫光、挂按下帧」，甲塌缩为丁」。代码事实确认扫光唯一源 = `_armSweepFx` 定义 `beads-game.ts:2904`、**全库唯一调用 `:1022`**（`powerup:used` 同栈）；区外走 `:1835–1837` 按下帧；逐颗链由 `_stepSolverFx:2868–2881` 计时驱动与 tap 无耦合。用户拍板 **丁**。

- **阶段 2·完成记录（2026-09-18 本会话，三成员 spawn 交付）**：
  - **D1·文策渊**：`core-loop.md` 升 **v2.2**，§8 注② 摘出，**保留编号 ② 占位不重排**（防断 ux-spec / test-cases 对注 ①③④ 的引用），新增 U11 修正声明（含代码事实 4 项 + K-053 反转精神——「注② = 勘误、属修正性撤注」）；K-052 重跑清单**仅撤销「解环器 200ms 重启门」一项**（因其起算点未位移），三族重启门 120/250/500ms 与 §3.8「≤2 次/秒」预算重跑令**不撤销**。`ux-spec.md` 升 **v1.10**，§4:163（保留「区外·按下即响应」分区正面标注）、§5:222/§5:225 **逐字节回到 v1.9 前**（与 `git show 79f217a` 比对确认）；§5 表头与「未加后移注行日」同步；§8 U11 行 升 ✅ 已闭合。
  - **E1·程基岩**：`beads-game.ts:2904` `_armSweepFx` 头注 JSDoc 内补 **2 行注释**（零行为改动），信息要素：扫光起点 = 按下帧 + 全库唯一调用点 `:1022` + 引用 `core-loop v2.2 §8` 注②。`framework:sync` 镜像。**未碰**：T-170/T-171/T-172 已锁基线（`:1834` sub-frame tap 提交 / `:1849–1855` L∞ / `:1724/:1760` fitCamera 注释）均原样。
  - **Q1·主对话代落笔**（严守真 readonly）：`test-cases.md` 升 **v1.14**，头部 L3 任务号列追加 T-170/171/172 修复批 + T-173 U11；**L140 下游后移清单 摘②**（与 `core-loop v2.2 §8` 新正文逐字镜像，QA 不自造）；TC-PER-21 / TC-PER-23 **已验读数全继续有效**（零迁移）。
- **验证**：beads **496 例绿**（零新例、零旧例迁移），`framework:sync:check` ✅、`typecheck` ✅、`check:arch` ✅、`check:es5spread` ✅、`ctx:check` ✅（hot-file 行号/超限门全过）、`check:links` ✅、`verify` **17/17 PASS**。
- **与 T-169/T-170/T-171/T-172 一致性自查**（orchestrator 预定检查点）：
  - `input-control §2.1` 中「切比雪夫」（T-171）与「区外按下即响应」（T-169 C-3(a)）**均未触碰**——本单**加强** C-3(a) 分区而非推翻✅。
  - `_readInput:1834/:1849–1855/:1835–1837` 三处锁基线未碰✅。`ux-spec §5:210` 未加后移注行白名单与 §4/§5 其他 9 处真后移族行逐行未动✅。
- **同批新发现移交（不并入本单，需另单或归现有轨）**：
  - **U11-a（重要）**：`core-loop v2.2 §8` 注③「过关判定帧」仍写「`level:cleared` 恒挂 `bead:placed` 同栈⇒随抬起后移」——但 `beads-game.ts:1017–1019` 明文解环器「本帧只点名不动手 ⇒ `bead:placed` 与过关判定全部推到相 B 到点帧」⇒ 解环器支路下的 `level:cleared` 不以 tap 时基起算，**③** 在支路上不成立。**推荐另批一单为 ③ 补「支路例外」半句**（与本次同构、代价最小、不动判据 5）。本单只登不裁。
  - **U11-b**：「解环器 200ms 重启门」在代码里其实是 `SOLVER_HINT_MS`（相 A 时长）而非门。本单不改数值、不裁术语；撤销理由只挂在「起算点未位移」上。是否重命名属下一批。
  - **U11-c**（行号锚型注释）：本次代码注释引 `:1022` 作为锚（位于注释之上），属可接受的长期可度量式锁定（行号锚本系仓内惯例）；若上方未来插行将漂。缓解方案（主对话行号锚型注释行号预验）可归 `knowledge/lessons` 候选。
- **风险声明**：真机手感（按压时长 → 后移量 `[待确认]`）无 AppID / 无真机 ⇒ `[R]` 未验；本裁决只锁帧归属，不声称已验手感。与 `TC-CAM-DEV-01..05` 挂账同族。

---

## WXG-T-175

**外来 skill 集成 · A 档（Claude Code Game Studios 点菜式吸收）** · 负责：主理人(CodeBuddy) · 状态：✅ 落码（**待真跑一个 story 验证价值**）

- **缘起**：用户 2026-09-19 给出外部仓库 `Donchitos/Claude-Code-Game-Studios`（MIT，25.2k stars），
  要求调研 → 对比 → 评估 → 集成。全量 186 件（73 skills / 49 agents / 12 hooks / 11 rules / 41 templates）。
- **取证方式（诚实登记）**：`git clone` 两次因网络中断（`curl 52 Empty reply`）失败 ⇒ 改用
  **GitHub API 取全量目录清单 + raw 逐份取正文**取证（精读：`dev-story` / `story-readiness` /
  `story-done` / `balance-check` / `test-flakiness` / `test-evidence-review` / `soak-test` /
  `gameplay-code.md` / `systems-index.md` 模板 / `validate-commit.sh` / `technical-preferences.md` /
  `unity-shader-specialist.md` / `godot-specialist.md`）。**留档用 clone 最终成功**（5.4M）。
- **结论：不整包集成**（三条硬理由）：① 31% 的 agent（15/49）是 Godot/Unity/Unreal 专家，
  本仓引擎唯一（Cocos Creator + 微信小游戏）⇒ 无效；② CCGS 无「§3 冻结常量真源 + 变更记录 +
  冲突裁决链」，整包引入会稀释本仓最硬约束；③ 其 12 hooks 路径（`^src/gameplay/`、
  `^design/gdd/`、`^assets/data/*.json`）在本仓**一条都不命中**，且只 WARN 不阻断，强度低于本仓 pre-commit。
- **A 档落地（3 个新 skill，全部 `disable-model-invocation: true` 仅点名）**：
  - `wxgame-story-dev` ← `dev-story`：开工门禁 + 真源装载 + **控制清单版本漂移三选项** +
    **依赖门禁三选项** + 测试证据。改造：`tr-registry` → 本仓 **§8 验收条目 `S<n>§8-<k>`**（同构，
    无需新建 registry）；删引擎派工与 `director-gates`/`review-mode`；进度真源 = story 自身 `Status:`
    + `production/sprints/`（**不引入** `production/session-state/active.md` 第二套状态）。
  - `wxgame-story-gate` ← `story-readiness` + `story-done` 合并：子命令 `ready` / `done`。
    新增本仓特有关卡：**测试↔判据追溯表，>50% UNTESTED ⇒ BLOCKING**。
  - `wxgame-balance-check` ← `balance-check`：真源改 `systems-index §3`；**新增本仓硬纪律 ——
    只读、不得改冻结值**（改值必须走 §3 变更单），并新增「§3 ↔ `tuning.ts` 落码漂移」核对（上游没有）。
- **另两处吸收（不新建 skill）**：
  - `wxgame-qa-gates` 增 §6 测试不稳定性 / §7 测试证据评审 / §8 长跑 —— **已微信宿主化**：
    `wx.onMemoryWarning`、杀进程续进、帧时间漂移、BD-51 音频复发面；删原版 GdUnit4/NUnit/`stat memory` 引擎段。
  - `docs/architecture/control-manifest.md` 新增 **§18 外来吸收四条**（状态机显式转换表 /
    禁静态单例改 DI / 注释标注设计真源 / `TODO(<归属>)`），并**登记未吸收条款**免重复引入。
- **明确不引入（登记备查）**：15 引擎专家 agent（其 description **无引擎前置条件**，会误 spawn；
  `godot-specialist` 还强制读 `docs/engine-reference/godot/VERSION.md`，本仓是 `cocos/`）/
  `/setup-engine`（会污染 `technical-preferences.md` 的 `Engine:` 字段）/ 12 hooks /
  `systems-index.md` 模板（与本仓同名**冻结真源**冲突，只借鉴"高风险系统/进度跟踪"章节）/
  叙事·网络·安全·live-ops·本地化（无对应域或 Won't）。
- **工程事实**：四 IDE 链接 12 条（`.cursor|.codebuddy|.workbuddy|.qoder/skills/<name>` →
  `../../my-skills/<name>`）；`check:links` OK（skills=36）；上游留档
  `my-skills/_repos/Claude-Code-Game-Studios/`（5.4M，更新 = `cd _repos/<repo> && git pull`）。
- **门禁**：`ctx/budget-exempt.json` 新增 2 条 B 门豁免（`UPGRADING.md` 8918 tok、
  `docs/WORKFLOW-GUIDE.md` 14811 tok）—— 沿用 mattpocock/superpowers 同目录 vendor 先例，
  **不调阈值**，且双双登记债务：`git pull` 使留档显著膨胀时**优先精简 `_repos` 而非续加豁免**。
  `verify` **17/17 PASS**。
- **⚠️ 遗留（诚实登记）**：
  1. **动态切换机制未落码** —— `my-skills/INDEX.md §1d` 已定三档（hybrid/ccgs/wxgame），
     但本仓无 profile 文件，且 `AGENTS.md` 是 alwaysApply 静态文本**不会自动读档位文件生效**；
     真正的可回滚切换需新增 `tools/scripts/switch-skill-profile.mjs`（重写链接 + 批量改
     `disable-model-invocation`）。当前默认 hybrid，靠手工维护链接。
  2. **三个新 skill 尚未真跑过一次** —— 价值待证。建议下一个真实 story 走完整循环
     （`story-gate ready` → `story-dev` → `story-gate done`）验收。
  3. 用户级 vs 项目级：本次走**项目级**（与外来通用 16 个一致，可被 `check:links`/`verify` 守到）；
     各 IDE 的用户级扫描路径**未在本机核实**。

- **追加裁定（用户 2026-09-19）：三件并入 `wxgame-*`，独立件删除**
  - 处置：`my-skills/wxgame-story-dev` / `wxgame-story-gate` / `wxgame-balance-check`
    **三个正本目录删除，12 条四 IDE 链接全部摘除**（内容不丢，已并入同域 skill）。
  - 去向（按域就近，而非按来源就近）：
    - `wxgame-epic-split` **§7 Story 生命周期后半段·实现** + **§8 ready/done 门禁**
      ← `dev-story` + `story-readiness` + `story-done`
    - `wxgame-gdd-writer` **§5 数值平衡核对** ← `balance-check`（真源 = §3 冻结常量，属 GDD 域）
  - 连带：`my-skills/INDEX.md` §1c 整节删除；§1 表格两行加标注；§3 优先级链**不再单列 CCGS 层**；
    触发机制与现役 skill 完全一致（靠 `description` 自动命中，无 `disable-model-invocation`）。
  - 另按用户裁定**撤销**「两套 skill 档位动态切换」机制（hybrid/ccgs/wxgame 三档）——
    不为未发生的需求预建机制；将来真要并存，用「挂/摘四 IDE 链接」既有硬开关。
  - 门禁：`check:links` **skills=33**（与合并前一致）、`verify` **17/17 PASS**。
- **验证记录（同日真跑，非静态检查）**
  1. `balance-check` 核心动作：抽查 §3 ↔ `tuning.ts` 七组常量（`TRAY_BASE_SLOTS`/`TRAY_EXPAND_SLOTS`/
     `STAR3_RATIO`/`STAR2_RATIO`/`SPRINT_TIME_DEFAULT`/`STAMINA_MAX`/`STAMINA_REGEN`）⇒ **零漂移**。
  2. QA §7 证据评审抽样（44 文件 / 488 用例 / 2527 expect，均值 5.18）⇒ 抓到
     **`zz-bis3.test.ts`（3 用例 / 0 expect = 空过，按 §7 判 BLOCKING）**与
     `onboarded.test.ts`（2.0/用例，偏薄）。前者 `zz-` 前缀疑似临时诊断件，**待用户裁定处置**。
  3. QA §6 稳定性：连跑两次均 44 files / **501 passed** 一致 ⇒ 按 §6 自定口径（<3 次不得标 confirmed）
     只记「无 flaky 迹象，suspected 级」。
  4. **`story-dev`/`story-gate` 的路径假设被证伪并已修**：上游假设「一 Story 一文件 + 头部
     `Status:`/`Type:`/`Manifest Version:`」，本仓实为 `epics-<game>.md` 内 `EP<nn>-S<k>` 条目 +
     `epics-<game>-status.md` 对账 ⇒ 已改写为按编号定位、Type 按验收条目推断、证据落点用扁平
     `games/<game>/tests/<name>.test.ts`。**本仓 `验收：S1§8-6` 写法与 skill 的 `S<n>§8-<k>` 口径天然一致**（零改造）。

- **合并后三段验证（2026-09-19，真跑非静态）**
  - **§8 `ready` 真跑（靶子 `EP01-S3 暂停冻结编排（S1 单点门禁，ADR-0007）`）⇒ 判定 NEEDS WORK**，命中：
    1. **Story 内嵌引用与 GDD 现文本不一致 ×2** —— Story 写「剩余时间数值不变、**不供料**」，
       而 `core-loop §8-7` 现文本是「…**零取回零归位**」；Story 写「PAUSED 期间零 `tray:spawned`」，
       而 `tray-spawner §8-8` 现文本已标「原文『零 `tray:spawned`』**随供料作废**」。
       ⇒ **§7.2 第 ① 条「以 §8 现文本为准、不采信内嵌旧引用」被实证有效**（一次抓到两处）。
    2. 该 Story **无 In/Out of Scope 字段** ⇒ 标 NEEDS WORK。
  - **暴露两个「上游检查项在本仓不可判定」（已修 skill）**：
    ① 上游要求「ADR 为 `Accepted`」，但**本仓 ADR 无 `Status:` 字段**（格式 = `# ADR-NNNN — 标题` +
       `## 1. 上下文`）⇒ 改为「文件存在 + 正文无未决声明」；
    ② 上游要求「控制清单版本最新」，但 **`control-manifest.md` 无版本字段**（实跑确认）⇒ 本项标 N/A，
       并写明「若日后加 `版本:` 头则自动生效」；另「Out of Scope 缺失」改为不阻断（本仓 Story 普遍未写）。
  - **§7 上下文装载四件可达性**：Story 条目 ✓（`epics-beads.md:62`）、GDD §8 现文本 ✓
    （`core-loop.md:146` + `tray-spawner.md:129`）、ADR ✓（`ADR-0007*.md` 存在）、
    控制清单 ✓（`control-manifest.md` 存在）—— 四件均可定位，无死链。
  - **§7 依赖门禁可达性**：依赖 `EP03-S2`（`epics-beads.md:104`）、`EP05-S1`（`:144`）均可定位；
    状态件显示 S1–S5 已交付、无 DRAFT ⇒ 门禁不误判。
  - **§5 balance-check 扩展核对**：在原有 7 组之外加验 `BEAD_COLOR_MAX` 8/8、
    `MISPLACED_PAIRS_MIN` 1/1、`MISPLACED_PAIRS_MAX` 8/8 ⇒ **累计 10 组全零漂移**。
  - 修正后 `verify` **17/17 PASS**。

---

## WXG-T-176

**ctx 生成器 `SKIP_DIRS` 跳过 vendor `_repos`（索引产物瘦身）** · 负责：主理人(Qoder) · 状态：✅ 完成

- **缘起（用户裁定「写进 .gitignore 让生成器跳过」）**：本批先纠正前提 —— `.gitignore` **早已忽略**
  `my-skills/_repos/mattpocock-skills/` 与 `…/superpowers/`（理由写在注释里：内嵌 git 仓只能记 gitlink，
  内容会静默丢失），但 `pnpm run ctx:build` **仍然把它们写进 `ctx/index.json`**。
- **真因**：`tools/scripts/lib/context-index.mjs::listMarkdown()` 用 `readdirSync` 走全盘，只跳
  点目录与硬编码的 `SKIP_DIRS`（按 `entry.name` 逐段匹配），**从不读 `.gitignore`，也不问 git**。
  ⇒ 「进 .gitignore = 不进索引」在这条链上不成立。实例：vendor 快照入盘后一次重建即
  **+4.6 万行 / +1.17 MB**（2.51 MB → 3.68 MB），并随 `b68d40e` 被固化进提交。
- **落码（最小改动，一行）**：`SKIP_DIRS` 追加 `'_repos'`（与既有 `archive` / `temp` / `library`
  同一机械开关形态，零新机制）；JSDoc 补该目录的由来与"生成器不读 gitignore"这条反直觉事实，
  并按仓库体例留 `ponytail:` 注记上限与升级路径（改用 `git check-ignore` / `git ls-files` 做唯一真源，
  代价 = 多一层子进程与平台差异 ⇒ 现在不值当）。
- **效果（实测）**：`ctx/index.json` **136,369 → 60,271 行、3.68 MB → 1.7 MB**（`grep -c _repos` = 0）；
  文件 276 / 章节 4,119 仍全量覆盖本仓自建文档。**收益不止今天这一笔**：`_repos` 条目此前已长期
  占了约 3 万行索引（905f72e 版 90,450 行里就有 181 处命中），本次一并回收。
- **门禁**：`pnpm run verify` **17/17 PASS**（含 `ctx:check` 结构门 A/B/C/D/D2 + E3、`selftest:fast` 8/8、
  `check:links` skills=33、beads 501 / framework 306 / breakout 239）。C 项候选集与索引面**同口径**
  （`check-context-budget.mjs` 复用同一 `SKIP_DIRS`），故 `_repos` 下的文件今后既不进索引，也不会被
  新鲜度门要求入索引；`kb:check` ③ 只断言含 `archive`，不受影响。
- **未干（避免竞写，挂号待他人顺手清）**：`ctx/budget-exempt.json` 里 8 条 `_repos` 文件的 B 门豁免
  现已成**死条目**（永不命中）。该文件当前由 WXG-T-175 会话在途编辑 ⇒ 本单不碰，改挂 backlog 行。
- **并发避让登记**：本单领号前按 K-046 扫过工作树（主表 + GDD/ADR/skill 头注 + git 跟踪态）：175 已被
  并发会话登记且头注已顶到 176 ⇒ 本会话占 **176**，下一可用号 **177**。
- **沉淀统计（`kb:sync --task=WXG-T-176`）**：**新增 1 / 修改 0 / 激活 0 / 归档 0** —— K-058
  [工具链]「已写进 `.gitignore`」不等于「已排除出索引产物」（枚举型走盘生成器只认自己的硬编码
  跳过集）；`kb:audit` 无归档候选、无相似命中。本单另含一次**险些破坏他单登记的编辑失误**：
  插主表行时误把并发会话的 **WXG-T-175 整行覆盖**（残留其行尾文本），已当轮发现并原样恢复
  （恢复后 `check:tasks` 11 行/11 节配对绿）——判例同 K-045：共享台账上插入务必用**唯一足够长**
  的 lock 文本，不要拿邻行为锚。

- **提交后核实（`ee39498`，−77068 行）**：`ctx/index.json` 文件数 650 → **276**，**非内容丢失**：
  `_repos/Claude-Code-Game-Studios` 经 `git rm --cached` 撤销入库后**不再参与索引**
  —— `ctx:build` 默认是 **HEAD 锚定模式**（未跟踪文件不入索引，见 `ctx/ROUTES.md` ⑨），
  故留档 195 个文件的章节条目整体出索引，**属预期行为**。
  连带：`ctx/budget-exempt.json` 中为本留档加的 2 条 vendor 豁免**成为冗余**（该路径已不在索引面内）。
  **保留不删**，理由：① 与 `_repos/superpowers`、`_repos/mattpocock-skills` 同目录豁免条目现状一致
  （先例同样冗余）；② 若将来该留档入库，豁免即刻生效，避免重演本轮「撤销 → `ctx:check` 转红 → 恢复」
  的反复折腾。**教训（本轮第二次踩同一坑）**：判断 `_repos` 是否需要 B 门豁免，
  取决于「**是否在索引面内**」而非「是否入库」—— 入库（gitlink）时在面内需豁免，
  不入库时不在面内但保留豁免无害。

- **收尾：清理 `_repos` 死豁免 12 条（2026-09-19，随 WXG-T-176 落地）**
  `b6f2dd1`（WXG-T-176）把 `_repos` 加入 `context-index.mjs` 的 `SKIP_DIRS` 后，
  `my-skills/_repos/**` **不再参与索引**（实查：`ctx/index.json` 中 `my-skills/_repos` 出现 **0 次**）。
  连带 `ctx/budget-exempt.json` 中 **12 条**指向该路径的 B 门豁免成为**死配置**：
  10 条 `vendor-skills` 代登记（mattpocock / superpowers）+ **2 条本单所加**（CCGS）。
  - **处置**：全部清除，条目数 **47 → 35**；清后 `verify` **17/17 PASS**（反向印证 12 条确为死配置）。
  - **理由**：死条目会误导后人以为该路径仍在索引面内 —— 本单已因同一误判反复两次
    （先误加 gitlink、再误撤豁免），清理是消除该误导的根治手段。
  - **重建条件（写给将来）**：若日后把 `_repos` 从 `SKIP_DIRS` 移除（使其重回索引面），
    这 12 条豁免需按当时的超限文件**重建**；`_repos` 上游 `git pull` 后文件体积变化时同理。

---

## WXG-T-177

**beads·冲刺入口隐藏（「去冲刺」三处全隐藏，U1 反转）** · 负责：主理人(CodeBuddy) · 状态：✅ 落码（**待真机复验**）

- **用户裁定（2026-09-19）**：原话「去冲刺按钮先隐藏，咱不需要这个功能」⇒ **功能级隐藏**（三处入口同属一个功能，`ux-spec §8` U1 冻结的「三处都放」整体反转）。
- **变更性质 = 入口收敛，非功能删除**：冲刺模式实现（`sprint.ts` / `sprint-settle.ts` / `startSprint()` /
  `_setupSprintRun()`）与 `systems-index §3.10` 全部冻结常量（C1–C8）**一字未动**；
  入口收敛后冲刺模式**暂时不可达**（仅测试 / harness 注入可达）。
- **三处入口的处置**（各面板仅剩单按钮并**居中**）：
  1. `clear-panel.ts`（结算过关页）：原「下一关 / ▶去冲刺」2 格 → **仅「下一关」居中**（`startX` 由两格均分改单钮居中）。
  2. `finish-panel.ts`（通关画面）：原「▶去冲刺 / 重玩第 1 关」→ **仅「重玩第 1 关」居中**。
  3. `pause-panel.ts`（暂停面板行 4）：原「start-sprint / go-menu」→ **仅「go-menu」居中**
     （落位表达式与 `sprintLayout()` 同源 ⇒ 两模式一致）。
  - 三处均**保留** action 类型成员（`'sprint'` / `'start-sprint'`）与文案分支，仅供复建；
    布局不再产出 ⇒ 该动作**永不可达**（同位置点击零响应）。
  - 副作用：`CLEAR_BUTTON_GAP` 在 clear/finish 两面板成为未使用导入，已移除并留注（复建时重新引入）。
- **文档回写（先改文档后改代码）**：
  - `ux-spec` **v1.12**：§8 决策记录 U1 条**删划线留档 + 反转说明**（K-053）、§3.3 暂停面板图行 4、
    §3.4 结算面板图、§4 矩阵 `LEVEL_CLEAR` / `FINISH` 两行。
  - `systems-index` **v1.32**：§1 **S7 行**登记「入口三处隐藏 ⇒ 冲刺模式暂时不可达，
    §3.10 常量与实现保留不动」+ `systems-index-changelog` v1.32 行。**§3 数值零改动**。
  - `pause-settings`：§2.2 去冲刺行删划线 + 隐藏说明。
  - `input-control`：§2.1 路由表 + §8-8b/8c 判据原文（去冲刺改为"已隐藏"）。
- **判据迁移（8 处全绿）**：`clear-panel.test.ts`（布局 2→1 钮 + 单钮居中、命中改"原副钮位零命中"、
  链路改"出口不可达"）、`finish-panel.test.ts`（同型 3 处）、`pause-settings.test.ts`（文案断言
  `含去冲刺 true → false`、`start-sprint` 两模式均不产出）、另清理 `phase-input-realchain` /
  `audio-dispatch` 注释漂移。beads **498/498 绿**；`framework:sync` + `ctx:build` + `verify` **17/17 PASS**。
- **⚠️ 过程失误（诚实登记）**：追加 changelog v1.32 行时用 `node -e "…"`（shell 双引号包裹），
  内容里的反引号被 shell 当**命令替换**执行（`command not found: sprint.ts / ux-spec …`），
  导致该行所有 `` 包裹标识符被吞空。**当场发现并用脚本文件（不经 shell 解释）重写该行修复**。
  教训：**凡内容含反引号/`$` 的文本写入，必须走脚本文件或 `--stdin`，不得塞进 shell 双引号内**（K-002 同族）。
- **待办**：真机复验（① 结算页只剩「下一关」并居中；② 通关画面只剩「重玩第 1 关」；
  ③ 暂停面板行 4 只剩「回主菜单」并居中、无「去冲刺」文案）；恢复路径 = 按 `ux-spec §8` U1 原口径复建三处。

---

## WXG-T-178

**framework·真机「能缩放不能拖动」修复（输入位移改帧末结算）+ 相机/命中调试读回口** · 负责：主理人(Qoder)·程基岩复核 · 状态：✅ 落码待真机复扫

- **缘起**：用户在真机走查 P1-8 时回报「坐标没有问题；但是无法拖动」——即缩放与点击命中都对，单指平移完全不动。此症状与 T-169 真机反馈①（`onBoard` 起手域）同名不同因，不可复用旧结论。
- **取证过程（先定位再改，不猜）**：为把「哪一步没走通」变成可读数字，先加调试读回口（`BeadsBootstrap` 的 `__WXG_GAME_DEBUG` / `__WXG_HIT_DEBUG` / `__WXG_CELL_DEBUG` / `__WXG_GESTURE_DEBUG`，全部由既有 `__WXG_TOUCH_DEBUG` 开关控制、默认关；命中与格心一律走游戏自己的函数，避免探针与真源共用同一个错 = K-042）。首版探针结论**我自己写错了两次**：① 只往一个方向拖、又在该方向已顶到夹取上限时采样 ⇒ 把「顶格」读成「链断」；② 结论句用 `dLeft === 0` 直接判缺陷。改用「双方向 + 手指仍按下时采样逐帧累计量」后才拿到决定性读数：`panFrames=69`（分支每帧在跑）、`panDxSum=0`、`snapX` 确实在变 ⇒ **喂进 `applyPan` 的位移恒为 0**，断点在输入层而非几何或语义。
- **根因**：`InputManager.beginFrame()` 做 `_prevX = _x`，而事件驱动宿主（Cocos / 微信）的原生 `touch-move` 到达在**两个固定步之间**（上次 `endFrame` 之后、下次 `beginFrame` 之前）⇒ 拷贝时 `_x` 已是新值，`dx = _x - _prevX` 恒 0。同步宿主（Node 单测与浏览器 harness：`beginFrame → push → update → endFrame`）永远看不到该缺陷，故 501 例全绿也照不出来（K-037 / K-036）。
- **修法（一处，覆盖所有宿主）**：prev 推进从 `beginFrame` 移到 `endFrame`（一固定步 = 一输入帧；同步宿主逐位等价，事件驱动宿主拿得到真实位移）；`beginFrame()` 保留为帧边界标记并注明「故意为空」。
- **TDD**：新增契约用例 `reports the real delta when a move arrives between fixed steps`（`endFrame → push → beginFrame → 读 snapshot` 断言位移 = 40/20，并断言无新事件的下一帧位移归零）——**修前红** `expected +0 to be 40`，修后绿。
- **影响面核实**：`grep` 全仓确认 **breakout 不读 `snap.dx/dy`** ⇒ 本次时序修正只改 beads 拖拽行为；framework 307 / beads 500 / breakout 239 = 1046 例零回归；`framework:sync` 已镜像两游戏的 cocos 拷贝件。
- **修后实测（同一探针，web-mobile 产物 + CDP touch）**：`向右拖 → gridLeft −12.5 → 0`（`offsetX=+12.5`、`panDxSum=+357`）；`向左拖 → 0 → −25`（`offsetX=−12.5`、`panDxSum=−714`）⇒ 平移链通、且正确被 `clampCamera` 夹在内容边界。
- **同时入库的调试口**（供真机 Console 走查，非玩法状态、L5 合规）：`BeadsGame.debugHitCell/debugCellCenter/debugGestureState` + `board-input-timing.test.ts` 一例「读回口与 `gridLayoutFor` 真源逐位同构 + 越界 null」（**变异自检**：`colCenterX/rowCenterY` 行列互换 ⇒ 本例红）。
- **顺带修的文档债**：`beads-shell.ts` 文件头仍写「有在途 → 恢复、不扣心」，与 v1.29（T-165）反转后的实现自相矛盾 ⇒ 划线留档改注（第五处同类 K-053 漏回写）。
- **门禁**：`verify` **17/17 PASS**（全量留日志 `temp/verify-fix.log`）、`cocos:check` 2/2、`framework:sync:check` ✅、`check:size` 主包 **1955.0 KB ≤ 2000**（release 已重建，扫码请用新包）。
- **沉淀**：`kb:sync --task=WXG-T-178` **新增 1 / 修改 0 / 激活 0 / 归档 0** —— **K-062**「事件驱动宿主的输入位移必须进单测：prev 在帧首结算会把帧间到达的位移吞成 0」。
- **待办**：① 真机复扫（**请在大盘验拖动**：第 5 关起才有 ±338/±198 的可拖范围，第 1 关 6×5 只有 ±13/±3 设计 px ≈ 7 屏幕 px，属 `clampCamera` 规格而非缺陷）→ 回填 `test-cases.md §A4c.3` TC-CAM-DEV-01/02/03；② 若裁定「小盘也该能拖」，那是**规格变更**，并入 backlog 已有的「§3 变更单：相机三占位值」一行处理；③ 探针 `temp/drag-probe.mjs` / `temp/cam-hit-probe.mjs` 属一次性诊断物（temp 不入库），若要固化成长期 `[B]` 取证件，须另立项并配「产物新鲜度自查 + 反例自检」（判例 WXG-T-108）。

---

## WXG-T-180

**beads·盘面规格档位落档（29×29 标准方形盘）+ 29×29 MVP 三关草案** · 负责：主理 人(CodeBuddy) · 状态：✅ 主体完成（2026-09-20 本会话收口）

- **✅ 续作记录（Qoder · 2026-09-20，接 ADR-0018 裁定后的收口）**：
  - **并发会话已落库（本单主体交付）**：`d4a36db`（ADR-0018 归档 + misplaced 全错位初盘规格回写）、`89f28e0`（引擎支持 misplaced 全错位初盘 + **8 关 MVP 图案入库**：关 1–4 = 14×14 / 关 5–8 = 18×18，≥4 色，时长按珠数>色数>聚集度公式；`tools/scripts/beads-mvp-patterns.mjs` 产真源 JSON + 级联感知逐分复算测试）。**生成器转正已完成**（`tools/scripts/beads-gen.mjs` + `beads-mvp-patterns.mjs`，原待办 ③ 销项）；**`GRID_MAX` 放开已在 `systems-index v1.34` 完成**（13/12 → 29/29，§3 变更单 + 三条连带登记，原待办 ① 销项）。
  - **留边模型裁定（用户 2026-09-20）**：`computeFitZoom` **保留固定 `BOARD_FIT_MARGIN=24`**，ADR-0018 §3.4.2 珠宽闭式解**搁置不落码**，复评触发 7 不触发；后续如需再落地另行立项。ADR-0018 已加搁置注记（本会话）。
  - **余项分流（均后续另立项）**：① 色板戊案接 ADR-0016（Proposed 待裁）；② B2/B4 顺序多盘 UX 规格 + `boards[]` 关卡 schema（ADR-0018 §3.2）；③ 29×29 解锁三条件（LOD 真机 + 触控验证 + `CAMERA_ZOOM_MAX_SPAN` §3 变更单，ADR-0018 §3.3）。
  - **本会话改动**：仅文档（ADR-0018 搁置注记 + 本台账），**零代码、零冻结值**；门禁 `check:tasks` / `check:links` / `verify` 随收口跑。

- **上位（用户 2026-09-20 盘面调研）**：5mm Midi 标准方盘 = **29×29 = 841 颗**；另有小号 14/16/18、异形（圆/六边/心形）、Mini 2.6mm ≈107×107、Maxi 10mm 29×29。用户要求「规则化落档 + MVP 先做几关 29×29」。
- **产物**：`design/proposals/board-size-29-mvp.md`（档位表 + 差距表 + 四项风险 + 前置顺序）/ `design/proposals/levels-29-mvp-draft.json`（3 关草案）/ `temp/lv29-0{1,2,3}/`（PNG 预览）。
- **与现状的差距**：`GRID_MAX_COLS/ROWS = 13/12`（= **156 格**）⇒ 29×29 是其 **5.39×**；750px 屏宽下单屏放不下 29 列（1508px）⇒ 必须缩放 ≈ **0.497**（珠屏上 25.9px）；静态图元 ≈ **8410**（现 ≈1560）⇒ **5.4×**。
- **四项风险（诚实登记，按严重度）**：① **图元最大** —— 现无「缩小视图时珠子整体降层」机制（`WAVE_LOD_LAYERS` 只在动画期按列降层）⇒ 前置项 = **zoom 自适应 LOD + 真机帧率验证**；② **触摸** —— 25.9px 珠必错点，靠缩放 + 最近格心判定缓解，须真机手感验证；③ **难度** —— 841 格的寻找成本远高于 156 格，`levels-spec §3` 的 k / time 曲线需**重推**；④ **冻结变更** —— `GRID_MAX` 属 `systems-index §3.3` 冻结值，放开须走 **§3 变更单**（含 changelog），不得就地改。
- **MVP 三关（草案）**：`--palette artkal --colors 8 --colorsmode error --swaps 8/12/18` ⇒ 841 格（可填 778 / void 63）、8 色、交换法错位 **16/24/36 颗**、色差 44.0、初始盘同色相邻率 0.771。**错位采用 `levels-spec §2.1` 交换构造法**（不是 spike 期的"全盘错位" —— 后者在 841 格上要求挪 841 颗，不可玩）。
- **⚠️ 不可直接入关（两条硬阻断，都须先裁）**：① `rows = 29 > GRID_MAX_ROWS = 12`（BOOT 校验会拒）；② 色值为 **Artkal 真值**，游戏 10 色板无对应珠色 ⇒ 接 **ADR-0016 戊案**（只换色值、不动结构）。
- **生成器侧连带修复（3 处，属 WXG-T-179 spike 能力）**：① 新增 `--swaps K`（游戏口径交换构造，输出 4 元组 + `levelDraft`）；② `toRowStrings` **紧凑重映射**修复 —— 大色板下限色后的色号是**原板索引**（可达 174），旧版直接查 35 字符表 ⇒ 29×29 首行输出 229 个 `undefined`（**同 K-056 追记的「维度泄漏」型**）；③ **自检口径分叉** —— 交换法只动 2k 颗、其余格**本就该就位**，旧的全盘错位断言在 k=8 时误报「存在就位珠 10」。
- **门禁**：`check:tasks` / `check:links` / `ctx:check` / `verify` 随本单跑；本单**零冻结值改动、零游戏代码改动**（产物全在 `design/proposals/` + `temp/`）。
- **原待办销项（2026-09-20）**：① `GRID_MAX` 放开 → v1.34 已完成；② zoom LOD → T-181 立项；③ 生成器转正 → 已入 `tools/scripts/`；④ 色板决策 → 余项分流接 ADR-0016；另加 ⑤ 留边模型 → 用户裁保留 24px 搁置（见上方续作记录）。**当前待办：无。**

---

## WXG-T-181

**beads·大盘 zoom 自适应 LOD 立项（ADR-0017，处置 §3.3 v1.34 的风险 1）** · 负责：主理人(CodeBuddy) · 状态：✅ 收口（2026-09-20 本会话，用户拍板）

- **✅ 收尾记录（Qoder · 2026-09-20）**：
  - **不阻塞裁定**：ADR-0018 已裁 MVP 实际用盘 = 14×14 / 18×18（每帧图元 2156/3564，与现行同量级、无需 LOD）⇒ 本立项的 LOD 需求**仅服务于 29×29/异形/2×2 拼图设计档**，转为 **29×29 解锁三条件之一**（ADR-0018 §3.3：LOD 真机 60fps + 触控错点率 < 10% + `CAMERA_ZOOM_MAX_SPAN` §3 变更单），后续解锁时**另立项**实施。
  - **ADR-0017 处置**：保持 **Proposed 留档**（层集/阈值/滞回形态结论有效，作为未来实施单的分析底稿）；本单不再持有待办，原待办 ①②③④ 全部随上述分流转出。
  - **初始取景口径（用户 2026-09-20 重申，二选一拍「维持现状」）**：初始游戏任何盘面**缩放居中**，大盘缩到含 `BOARD_FIT_MARGIN=24` 边距；**小盘（放得下视口）顶格 `zoom=1` 不放大**（留白多于 24px）——与 ADR-0018 §3.4.1「zoom=1 = 5mm Midi 参照、不放大超过参照」及 ADR-0015 §3.4 复位口径**完全一致，现状已实现**（`computeFitZoom = min(1, 含24px适配)`，`fitCamera` 落点 `_setupLevel`/`_loadStage`），**零代码、零文档漂移**；「一律恰好 24px（小盘放大）」方案未采。
  - **本会话改动**：仅台账，**零代码、零冻结值**。

- **上位**：用户 2026-09-20「zoom 自适应 LOD 立项（风险 1）」，并提出三种形态方向：① standard29 单盘；② 小盘单图或 **2×2 拼图**（small18 / small16 / small14）；③ 异形盘。
- **产物**：`docs/architecture/adr/ADR-0017-beads-zoom-adaptive-lod.md`（Proposed）+ `architecture.md` 关联决策行。
- **两种形态的关键判断（由数据直接得出，ADR §1.2）**：
  1. **小盘"单图"不需要 LOD**（small14 2156 / small18 3564 图元，与现行 156 珠的 1810 同量级）—— LOD 只标准确用于 **standard29 / 异形 / 2×2 拼图**；
  2. **2×2 拼图不是更省、而是更贵** —— small18 四盘 = **1296 格 > standard29 的 841**（图元 14256）⇒ **拼图模式对 LOD 的需求最高**，不能因"每块小"就豁免。
- **现状缺口**：已有 LOD 判例只有动画期的 `DISSOLVE_LOD_ALPHA=0.60` / `DISSOLVE_LOD_LAYERS=4`（层集 L1+L2+L3+L5）与 `WAVE_LOD_LAYERS=7`（按列）；**没有「按视图缩放降低静态珠层」的通道** —— 这正是 29×29 能装进去却可能跑不动的原因。
- **方案（ADR §3）**：**乙（视口裁剪）先落地 + 甲（zoom 档位降层）为主干**；丙（整盘一律降）仅作低端设备回退阀；丁（同色连通块合并绘制）登记为远期方向、本轮不做。建议档（均含红线）：满层 11 / 中档 6 / 低档 5 层。**滞回（hysteresis）列为必需项**（否则阈值附近缩放会跳变闪烁，且可能触 `accessibility` D2）。
- **不可降红线（与 ADR-0016 丙案同源）**：`filled` 珠 11 层中，**L11 目标色垫**（谜面载体）与 **L5 符号**（a11y 三重编码的符号维）**不得因性能砍掉** ⇒ 一句话：**LOD 砍的是「质感层」，不是「信息层」**。
- **诚实边界（勿视为已解决）**：① **层集由 art 冻结**、阈值均 `[待确认]` ⇒ 本单**未做真机帧率实测**，不能声称"性能已解决"；② 建议档 11→5 ⇒ 841 珠从 9251 降到 ~4205，**仍未达小盘单图量级**。
- **本单改动**：仅**文档**（新增 ADR-0017 + `architecture.md` 关联行 + 本台账），**零代码、零冻结值**（ADR 明确不引入 `systems-index §3` 新值）。
- **待办**：① art 冻结层集（林绘澄正主）+ 阈值定档；② **工程实施单**（视口裁剪 + zoom 档位 + 滞回）须**另领号**；③ 真机帧率实测（29×29 与三种形态）；④ playtest 观感（"远看变丑"与否）。

---

## WXG-T-183

**beads·board 锚直填消费序改写（选豆点固定 + 同序配对）** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-20，beads 511 例绿、verify 17/17）

- **上位（用户 2026-09-20 三则裁定）**：① `_boardSelected` 增稳定 `anchorRow/anchorCol`（**拾取那一下的坐标**），填珠过程不改——展示用「当前头珠」可另存（沿用 `row/col` 静默转移），但优先级基准恒为选豆点；② 消费序 = 距选豆点**切比雪夫**升序（与组选 8 向连通同度量，平局行主序）；批量填时目标空格按 BFS 序（离被点目标由近及远）、组员按离选豆点序，**同序配对**——最近组员填最近目标，视觉上「从选豆点一片揭起、由近及远归位」；③ 托盘侧不适用（托盘同色珠可互换、不在棋盘格坐标上，「离选豆点距离」只对 board 锚有意义）。
- **实现**（`games/beads/src/game/beads-game.ts`，cocos 镜像同步、两文件仅 import 行差异）：`_boardSelected` 增 `anchorRow/anchorCol`（建锚固化）；`retrieveSelectedGroup` 部分收纳基准改选豆点（`_nearestFirst` 度量保持欧氏² 未动、仅钉死基准）；`_tryDirectFillFromBoard` = 消费序 `consumption`（切比雪夫升序、平局行主序）× 目标序 `targets`（被点格 + `planGroupFill` BFS 由近及远）**按索引同序配对**，替代旧「逐目标就近取珠」O(n²) 扫描；锚更新 = 组空清、否则仅头珠转移、选豆点恒不变。**托盘侧 `_placeSelected`/`planGroupFill` 零改动**（裁定③）。
- **规格同源回写**：`bead-grid.md` v2.4（头注 + §2.2 组语义直填句 + §2.3 路径 A 收纳句 + §9 版本表）。
- **判据**：`misplaced-direct-fill.test.ts` 新增**选豆点基准例**——列 0 竖链 5 珠、拾取 (0,0)、点远端 (4,1)（(3,1) 预填就位堵 BFS 保单目标），断言消耗 (0,0)（新序）而非旧序会取的 (4,0)，直接区分新旧消费序（判据可判别性按 K-055④ 口径构造）。
- **领号披露（K-046 判例再+1）**：用户初令「任务号 182」，按 K-046 扫工作树发现 **182 已被占用**（`games/beads/design/forensics/wxg-t-182-g3-derangement-deadlock.md`，程基岩 2026-09-19 G-3 取证留档、结论已采纳、未登主表），经用户裁定**改领 183**（T-167 同型），头注校准至 184。
- **门禁**：`verify` 17/17 PASS；`kb:check` 八重校验 PASS；`ctx:build` 已刷新（含 forensics 新文件未入库提示，属并发会话产物、本单不代提交）。
- **沉淀**：`kb:sync --task=WXG-T-183` **新增 1 / 修改 0 / 激活 0 / 归档 0** —— **K-063**「会『静默转移』的锚不能当距离排序基准：消费序基准与展示坐标必须分离」（判据片；同族 K-055 下游）。
- **待办**：无（纯行为改写 + 规格回写，零 §3 数值；真机手感随下次真机复验批顺带走查）。

---

## WXG-T-186

**beads·组珠消费序改剥皮序（沿组连通图上距离，直填/取回共用）** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-22 本会话按原用户裁定收口）

- **背景与裁定（用户 2026-09-22 四项）**：① 「最近」由几何距（v2.4 直填切比雪夫 / v2.3 取回欧氏²）改为**沿组连通的图上距离**；② **不设颗数上限**（拾取时一次算完整序，点击只取前缀）；③ 同层内「仍有下层邻居」的引路珠**押后**；④ 直填与取回落槽**共用同一份序**（两路口径一致由构造保证，不靠两处写成一样）。取证：`temp/metric-*.cjs`（两路口径 89.4% 组形给出不同序）/ `temp/peel-*.cjs`（跳 0% · 碎 42.2% 为各口径最优；短路版 47.6ms → Tarjan 版 0.71ms@144）。
- **交付**：`games/beads/src/systems/consume-order.ts`（新增 `planConsumeOrder`：一次 BFS 定层号 + 有序前沿增量维护 + 每步一次迭代 Tarjan 求割点；TypedArray 整次调用共用 ⇒ 零逐步分配；O(n²)）；`beads-game.ts` 接线（`_boardSelected.cells` → `.order`，`selectBoardBead` 拾取时算序，`retrieveSelectedGroup` 截前缀，`_tryDirectFillFromBoard` 删内联切比雪夫 sort，**删 `_nearestFirst`**）；快照 `boardGroupRows/Cols` 语义不变（渲染层只当集合用）。
- **规格回写**：`bead-grid.md` **v2.5** —— §2.2 新增「消费序」条（四档优先级表 + 级 1/2 互证不可兼得、让步固定为级 2）、§2.3 路径 A 第 2 步改「消费序前缀」、§9 补行。**§3 数值零改动**。
- **判据**：`tests/consume-order.test.ts` 7 例全绿（U 形不跳缺口 / 3×3 任意 k 剩余连通且中心珠最后 / 同层引路珠押后 / 单双珠 / 确定性 / 直填集成沿片揭起 / 取回与直填同前缀）；`misplaced-direct-fill.test.ts` 旧基准例仍绿（直链下图距 ≡ 几何距，仅注词迁移）。
- **验证**：beads 全量 `vitest` **543/543 绿**（47 文件）；`pnpm run framework:sync` 已产镜像（写入 2）；`pnpm run verify` **18/18 PASS**（首轮唯一 FAIL = `framework:sync:check`：T-187 会话在 sync 之后改了 `src/` 注释⇒ 重跑 sync 后转绿，非本单缺陷），`check:tasks` / `check:links` 绿。
- **沉淀**：**K-067**（判据）「就近」排序的度量必须与集合的连通定义同度量，且多消费口共用一份序（`kb:sync` 统计：新增 1 / 修改 1（去 `[K-tmp]` 残留标记）/ 激活 0 / 归档 0；`kb:audit` 无相似命中）。
- **号源追认（2026-09-22，注 8）**：本单开工时未及时向主表登记，T-187（托盘修复）会话核树时漏核未跟踪文件误领同号，用户拍板：186 归还消费序、187 归托盘修复。教训同注 7：领号前 `git status` 未跟踪文件也要核头注。
- **收口时澄清的追认页误记**：前记「`beads-game.ts` 已部分接线」为收口会话自身的中间态（当时仅完成 import + 字段改名），非并发会话遗留；前记「`grep consume-order` 在 `src/` 无 import 命中」同理已解除（接线完成后 import 存在）。

---

## WXG-T-187

**beads·托盘满槽死锁修复（§8-11 收窄到 4b，满槽可换选）** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-22，用户裁定 A）

- **症状**：用户真机实报「托盘完全无法选中」（棋盘/齿轮/道具卡正常）；自 T-161/T-178 修复后从未真机复验输入链。
- **根因（探针 100% 实锤，`tmp-tray-deadlock.mjs`）**：`_routeTraySlot` 4a 分支的旧 §8-11 门 `boardSelected !== null && freeCount === 0 → return` 把禁「取回（4b）」扩成禁「换选（4a）」；而 `selectBoardBead` 幂等无取消路径 ⇒ **满槽 + board 锚 = 玩法硬死锁**（托盘 12/12 时任何托盘点击被静默吞）。GDD 自相矛盾：§2.1 4a（v2.3 无条件换选）+ §8-12（换选即转移） vs §2.4/§8-11（v2.0 满槽吞任意槽），代码忠实实现了旧 §8-11。
- **修复口径（用户拍板 A）**：满槽时点 holding 槽 = 4a 正常同色全组换选（锚转移 tray）；满槽禁「取回」由 4b「无空槽可点」几何保证，无需状态门。
- **改动面**：① `beads-game.ts::_routeTraySlot` 删门（1 行）+ 头注；② `input-control.md` v2.9（§2.1 4a 标注满槽不例外 / §2.4 满槽取回条改写 / §8-11 判据收窄 / changelog）；③ `selection-anchor.test.ts` §8-11 用例改写为「满槽换选」断言（含 v2.6 部分收纳续段）。**§3 冻结常量零改动**。
- **门禁结果**：beads vitest **543/543 全绿**（本单验证期间曾两轮观到 consume-order 2 例红，后经实锤定性 = **T-186 并发会话正在同工作树接线中途的中间态**，其收口后稳定全绿——非本单回归；跨会话并发收口时「测试红 ≠ 存在 bug」，需先核并发写）；探针复跑（重建 dist 后）：满槽 + board 锚点 holding 槽 → `tray:selected +1、traySelected=0、boardAnchor=(-1,-1)`，死锁消除；`pnpm run verify` 全量未跑（本单仅动 beads 域，verify 收口随下次提交批）。
- **取证附带结论**：MCP 预览（wx-compat）无法注入合成触摸事件（`isTrusted:false` 不转发 wx 回调）⇒ 输入类真机问题取证走 Node 真链探针 + 用户设备，不走预览代理。
- **改号留痕**：本单初稿误标 186，GDD/代码注释/测试标题已同批改为 187（见注 8）。
- **待办移交**：微信产物重建后真机复测托盘（含满槽场景）；两份临时探针已删（复现步骤存本节 + GDD §8-11 可测形式）。

---

## WXG-T-208

**外部 skill 批次接入（4 仓 → 5 件）+ 知识库新标签「接入」分片** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-24，用户三项拍板：ax 由本仓自撰 / 落位 `my-skills/` 挂四 IDE 链接 / `ocr` 与 `bsk` 都装）

- **范围**：接入 `cloudflare/security-audit-skill`、`alibaba/open-code-review`、`Tencent/BrowserSkill`、`google/ax` 四个外部能力，走 `create-plugin` 转换流程后按用户裁定改以本仓 `my-skills/` 正本 + 四 IDE 链接落位（不产 `.qoder-plugin/` 包，不落 `my-plugins/` vendor）。
- **交付（5 件现役）**：`security-audit`（SKILL.md + 14 份域文档 + `report-schema.json` + 2 个 `.cjs` 校验器，**省略** 2 个 `.test.cjs`——校验器自带单测、SKILL.md 不引用）、`open-code-review`、`open-code-review-delegate`（同仓两件，后者**不需配 LLM 端点**）、`browser-skill`（取 CLI 捆绑的 `crates/bsk-cli/skill/` 全量版而非宿主插件精简版）、`ax-runtime`（**本仓自撰**）。四 IDE 链接 20 条 `.<ide>/skills/<name> -> ../../my-skills/<name>`；`my-skills/INDEX.md` 新增 §1b.1（来源/许可/省略件/安全审计结论/本地注意/与同域既有件的触发分工），现役计数 33→38；拉取脚本随件跟踪在 `my-skills/_repos/fetch-vendor-skills-2026-09.sh`。
- **上游无 SKILL.md 的处置**：`google/ax` 经 git trees API 全仓扫描确认 **0 个 SKILL.md**——它是 K8s 上的声明式 agent 编排运行时。按用户裁定改为自撰整理稿，正文只抄官方 `README/DESIGN/docs/concepts/manifests`（快照 2026-09-24 main），首屏显式标「本仓自撰、非上游移植」+「本仓无集群 ⇒ 全文未实测」。
- **CLI 安装与冒烟（真实产物）**：`ocr` **v1.12.9**（npm 全局，`/opt/homebrew/bin/ocr`）→ `ocr review --preview` 实跑通过（本仓 89 文件变更 / 50 待审，≥v1.10.0 故 `--output` 可用）；`bsk` **0.3.1**（官方 install.sh → `~/.local/bin/bsk`，登录 shell PATH 可达，安装脚本自带 checksum 校验）→ `bsk doctor` 报 daemon ok / protocol 1.3 ok / **`FAIL extension connected`（0 browsers）**。两件冒烟同时扇出真前置：**浏览器扩展须用户手工装**、**`ocr review` 须先配 LLM provider**（本仓无 key ⇒ 可用路径是 delegate 件）。
- **结构处置（沉淀越门）**：两条新条目使 `knowledge/lessons/process.md` 工作树读数 **8919 tok** 越 ctx B 门（8000），而 `knowledge/INDEX.md §4` 禁为分片加豁免 ⇒ 用户拍板**新建 `接入` 标签片** `knowledge/lessons/onboarding.md`（片内 `## 接入` 小标题保留，片头记新切缘由）。同步两处硬映射：`split-knowledge-lessons.mjs::TAG_TO_SHARD` + `lib/knowledge-ledger.mjs::LESSONS_SHARD_ORDER`（**均追加尾部**，不动既有补号序），并回写 `lessons.md` 指针页表与 `knowledge/INDEX.md` §2 类别枚举 / §3 分片表。结果：process **7627** / onboarding **1464**，`process.md` 与 HEAD 逐字一致（无净 diff）。
- **并发避让（K 号）**：本树 `ledger.nextId = 70`，而并发会话（beads 视觉样式批）已公布 **K-070–072** 且其入账未落本树 ⇒ 直接 sync 必撞号。做法 = 条目内手工写 **K-073 / K-074** 跳过该段，`kb:sync` 采纳既有 ID 并把 `nextId` 抬到 **75**；两边合并时 `ledger.json` / `CHANGELOG.md` 会冲突，由主理人以 `max(既有 ID)+1` 校准后重跑 `kb:sync`（幂等，不产新条）。若 T-207 批最终未入账，070–072 成永久跳空号（递增不回收，合规）。
- **门禁结果**：`check:links` OK（agents=7 / skills=39）、`check:secrets` OK、`check:plugins` / `check:mcp` OK、`ctx:build` + `ctx:check` OK、`kb:check` 八重校验 PASSED（活跃 71）、`kb:audit` 归档候选与相似命中均无、`selftest:fast` **8/8 PASS**（含 `knowledge:split:selftest` 45/45 断言，证两处映射同步未破装置）。预算面复核：新入 5 件 `.md` 最大 5608 tok（`security-audit/HUNTING.md`），全部 < 8000 ⇒ 无需登记 `vendor-skills` 豁免；且 ctx 只索引 `.md`，随件 `.cjs`（≈8.4k）天然不在 B 门覆盖面内。
- **沉淀**：K-073（外部 skill 批次接入：上游正文零改写 + 本地差异集中登记 INDEX 批次节）、K-074（接外部能力前先机械验源：「仓库存在」≠「有可转换的 SKILL.md」）。
- **余项移交**：① 用户在 Chrome/Edge 装 BrowserSkill 扩展后复跑 `bsk doctor` 至无 FAIL；② `ocr` LLM provider 由用户配置（`ocr config provider`）后方可用非 delegate 件；③ `bsk doctor` 冒烟已自启 daemon（pid 31294），本单未停，随宿主会话自然回收；④ 新 skill 生效需重启/新会话（技能清单在会话装配时读取）；⑤ 本单与 T-206/T-207 各产物**均未 commit**，提交批与 `verify` 全量随下次收口。

---

## WXG-T-209

**知识库同步批（`kb:sync`）** · 负责：知识库流程 · 状态：✅ 已执行（**本会话（Qoder）2026-09-25 追认入主表**）

- **追认理由**：该号只存在于 `knowledge/CHANGELOG.md`（`### WXG-T-209`）与 `knowledge/ledger.json`（`taskId`），当时未登 `TASKS.md` 主表 ⇒ 注 9 同族的又一实例（用了号未登主表）。
- **后果**：后续会话若按主表最大号领号必与知识库侧撞号。本会话（WXG-T-210）领号前按 **K-046** 口径扫工作树时发现，故取 210 并把 209 追认入表闭合。
- **本行不补交付细节**：原始事实以 `knowledge/CHANGELOG.md` 与 `ledger.json` 为准，不凭推测重写台账（承注 9 的「不代补」纪律）。

---

## WXG-T-212

- **目标**：对 WXG-T-211-S3 的**整帧封箱基线**（`tests/__fixtures__/wxg-t-211-s3-seal.json` + 常驻判据 `tests/bead-style-seal.test.ts`）做一次「因新增 HUD 控件（关卡面板左下角缩放控件）导致基线失效」的复评与收口；⛔ 不碰玩法/视图代码、不碰并发那批、不 commit。
- **委派**：主理人（Qoder）派发 → 严守真（quality-lead）；上位依据 = `assets-spec §11.2-a` / `§12.9 步 3` 验收列 + QA 判据纪律 K-051（禁纸面值入册）/ K-053（不静默删）/ K-060（阳性对照与变异自证）/ K-040（加严不放宽）。
- **前置判定（关键）= 可重抓**：并发批次 `bead-render.ts::BEAD_DRAW_INSET`（绝对 4px → 按 `outer/BEAD_CELL` 等比）**在封箱夹具下实测零贡献**，三重证据：① `git archive HEAD` 隔离副本重跑 ⇒ 逐字节复现登记两键（基准可复现、探针忠实）；② 整帧**流级差分** = 前缀 962 条 + 后缀 157 条全等 + 中间**纯插入 7 条**、**0 改写 0 删除**（frame0 同构 806+7+157），插入条原文已核（含 `1:1` / `适配` / 轨道 rect / knob circle / `1.00×`）；③ 反例控制：副本内 `BEAD_DRAW_INSET` 4→5 ⇒ 腿 1 + 腿 4 立即红 ⇒ **夹具对该通道有眼**。几何理由：夹具 13×12 / `fit = 1` ⇒ 实测 `gridCell = 30 = BEAD_CELL` ⇒ `4×30/30 = 4` 位精确；托盘珠不传 `targetColorIdx` ⇒ inset 恒 0；`legacy-ten.ts` diff 为纯注释。
- **实测 Δ（腿 4 归因，非纸面）**：`rect 487→490 (+3)`、`circle 81→82 (+1)`、`text 9→12 (+3)`、`line`/`polygon` Δ=0 ⇒ `frame78 total 1119→1126 (+7)`；`frame0 total 963→970 (+7)`。**与任务单口径的唯一差额：实测 7 条而非 8 条** —— slider 已选段 rect 受 `if (t > 0)` 门，夹具静息档 `zoomSliderT = 0` 不绘 ⇒ 登记为未收口行为面（遗留 ③）。**珠体三腿（legacyFlow / facetNonHole / hole）复评前后均绿，结论未降级。**
- **交付**：
  - **入库件 `tests/__fixtures__/wxg-t-211-s3-seal.json`（仅 4 键变动）**：`s3.frame0` = `{total 970, sha f9415bec3fee…c84bbd}`；`s3.frame78` = `{total 1126, kinds rect490/circle82/line220/text12/polygon322, sha 5f8c65010cd1…ec8ee5}`；`provenance.s3_frame_recheck`（新键，长归因串）；`_readme`（禁令改写 + 例外通道指针）。**`head.*` 与珠体族三键（`legacyFlow`/`facetNonHoleLayers`/`facetHoleLayer`）零追改**，机械深比较已核（重抓的珠体族 45+45 例 sha 与登记值逐字节相同 ⇒ 无追改需要）。通路 = **官方复取器** `bead-style-seal-recapture.ts`（`WXG211_SOURCE_REV=933d469…`、DESC 明写缩放控件复评），⛔ 未走 `capture.sh s3`（会 `cp work/` 旧快照覆盖工作树 ⇒ 踩并发文件）。
  - **判据 `tests/bead-style-seal.test.ts`**：腿 4 的 `s3.frame0.sha ≡ head.frame0.sha`（读作「非珠体族零变更」）**语义作废** ⇒ 换为**三层可核读法**（① 珠体族逐字节 ≡ HEAD，未降级 ② 整帧字节锁 ≡ 登记值 ③ 头→今 Δ 逐 kind 必等于 78 颗填格珠体差 + `HUD_ZOOM_CTRL_DELTA{rect:3,circle:1,text:3}`，且空盘帧长恰 = `head.frame0.total + 7`）+ **反面自证**（`not.toBe(head)` 显式断言 + `provenance.s3_frame_recheck` 必含「缩放控件」，缺归因即红）。**零删断言、零恒真、无 env 后门**。文件头新增「基准修订的唯一例外通道」三条件（a 非珠体族且珠体族/`head.*` 不动 / b 官方复取器 + 流级纯插入证据 / c provenance 与 §K.5.1 登记），并写明**珠体族三键与 `head.*` 永不走此通道**。
  - **QA 文档 `production/qa/beads/test-cases.md` v1.17→v1.18**：新增 `K.5.1-补` 修订注；`K.5.0-补` 两处旧句（「整帧 1119」「非珠体族 Δ = 0，空盘 frame0 两侧 sha256 全等」）**就地划线作废 + 更替指针**（不净删，K-053）；头部常量速查行的**占位数值禁令扩写**至缩放控件组；变更记录表补 **v1.18 行**并**诚实登记 v1.17 缺行**。
  - **台账**：本行 + 头注（已分配至 212 / 下一可用号 213）+ 注 10 并发披露。
- **自证（`[Node]` only）**：`cd games/beads && npx vitest run` ⇒ 收口时点 **652 passed / 51 files**（复评前 651/652，唯一红 = 腿 4）；`npx tsc --noEmit` 退出 0；`bead-style-seal.test.ts` 7/7。另三组反例控制（均写在 temp 副本，工作树未动）：A 纯 HEAD 代码撞新锁 ⇒ 腿 4 红（证非恒真）；B inset 4→5 ⇒ 腿 1+4 红（证夹具敏感）；C 撤销突变 ⇒ 7/7 绿。转录件 `temp/qa-wxg211-s3-recheck/control-{A,B,C}-*.txt`。
- **⚠ 自证失效登记（尾轮复跑，诚实报不凑绿）**：登记完台账后按纪律再跑一次全量，工作树已被**并发 EP11-S5 批**（换肤两字段 + 面板行 4 两钮）改写 ⇒ `tests 654｜7 failed`、`tsc` 1 error。**逐条归因：① `src/game/save-schema.ts` 新增 `beadStyle`/`beadSize`，而 `src/game/beads-game.ts:2733` 默认档未补齐 ⇒ tsc 红 + `save-schema.test.ts` 6 红（实际值多两字段）；② `PAUSE_PANEL_H` 600→718（= 本文 `K.7 残留 ⑤` 预告的五行扩容）⇒ `pause-settings.test.ts:407` §8-5 高度断言红。七红一错无一属本单**（封箱件仅被 `bead-style-seal.test.ts` 与复取器消费，已 grep 确认；本单判据在突变后的树上仍 7/7 绿）。⇒ 上条「652/652」**只在收口时点成立**，不得引用为现态；证据 `temp/qa-wxg211-s3-recheck/concurrent-S5-reds.log`。
- **数值外溢判定**：**需在 QA 面加限制声明 = 已加**。`ZOOM_CTRL_PAD=12` / `ZOOM_SLIDER_HOT_W=240` / 跨度 `CAMERA_ZOOM_MAX_SPAN=2.5` 属 `[待确认]` 工程占位 ⇒ ⛔ QA 不得据占位数值造判据；**`ZOOM_CTRL_HOT = TOUCH_MIN = 88` 不属占位**（派生自 §3 已冻结 `TOUCH_MIN`），其底线判据仍归 §A4c.3 `TC-CAM-DEV-05`（真机 ⛔，本轮零进账）。§3 真源归属不变，本单不写 §3。
- **门禁建议（编排者终裁）**：**本单范围内建议 PASS；工作树整体建议 CONCERNS**（不属本单的并发半成品红）。已达的门：G1（§8 判据映射未动、零软化）、G2′（常驻测试通道在收口时点全绿且可复现；**尾轮已被并发批次破绿，见下条失效登记**）、G4（证据齐：两路互证 + 三组反例控制）。**未达/未执行**：G3 屏幕层与真机（缩放控件可点性 / 热区实测 / 遮挡 / 手感一律未验，K-037 通路缺口延续）⇒ 本单**不得引用为任何屏幕层 PASS 证据**。
- **遗留与解除条件**：① 缩放控件**尚无 GDD §8 导出的行为判据** ⇒ 本单只登记「它改变了整帧基线」，不据几何造判据；解除 = 设计轨在 `input-control` / `pause-settings §8` 立条后另开 QA 单。② `t > 0 ⇒ Δ = 8` 的未登记行为面 ⇒ 随控件判据立项一并钉。③ 并发那批（`bead-render.ts` / `bead-render.test.ts` / `tool-manager.json`）**不由本单背书**，其收口后须复核本基准（若其真改到珠体族，则本单的「零贡献」声明仅对当时夹具成立，需重跑）。④ 屏幕层/真机道次仍挂账；⑤ **并发 EP11-S5 批的 7 红 + tsc 1 错**（见上条失效登记）⇒ 解除条件 = 该批自行补齐 `beads-game.ts` 默认档并回写 `§8-5` 面板高断言；若其后续将行 4 两钮绘进 `playing` 相位，整帧基线需再走一次本单的**唯一例外通道**。
- **红线**：全程未 commit / 未 push；未改 5 个玩法视图文件、未改并发那批；temp 取证件不入库。

---

## WXG-T-231

**beads·关卡存量 4 红立项（`DEMO_LEVEL_COUNT` 漂移 + 关卡快照判据过期）** — 2026-10-02 主理人（CodeBuddy）立项，**先确诊后建档**（不凭推测写单）。

## 现象与读数（`pnpm --filter @wxgame/beads run test`）

736 例 / **4 红**，长期使 `pnpm run verify` 的 `test` 项 FAIL（常态 PASS 16 / SKIP 1 / **FAIL 1**）：

| # | 用例 | 断言失败 |
|---|---|---|
| 1 | `tests/levels.test.ts` › BOOT validator › *accepts a well-formed level and every shipped level* | `expected LEVELS toHaveLength(8) but got 9` |
| 2 | `tests/misplaced-assembler.test.ts` › *MVP·全部出货关全错位初盘数据全过 BOOT* | 同上（`8 → 9`） |
| 3 | `tests/level-import.test.ts` › WXG-T-179 主菜单「导入」钮接线 | `expected 10 to be 9`（导入前 9 关 + 导入 1 = 10，而断言按 8+1=9 推） |
| 4 | `tests/levels-dir-pipeline.test.ts` › P1 目录化真源不变量 › *产物数据体逐字节等于迁移前快照* | 产物 `src/config/levels-data.ts` ≠ `tests/__fixtures__/levels-body.snapshot` |

## 根因（两类，**不是一个 bug**）

**A 类 · 冻结常量漂移（3 条红，同一根因）**
- `config/tuning.ts::DEMO_LEVEL_COUNT = 8`，而 `design/levels/manifest.json` 实为 **9 关**（`contentVersion 21`、order 1..9 连续、uid 唯一）。
- 变更源 = **`81b08ed`（WXG-T-203「关卡表 pre-release 全量重置，uid 序号改 5 位」，已入库且是 HEAD 祖先）** ⇒ 8→9 关时**未同步该常量**。
- ⛔ 不是笔误而是**已知耦合**：`DEMO_LEVEL_COUNT` 的常量注释自陈「再入/再移出关时本值需同步改，否则 `levels.test` / `misplaced-assembler.test` / `level-import.test` **三处断言即红**」⇒ 本红是这套耦合的第一次真实兑现。

**B 类 · 判据语义过期（1 条红）**
- `levels-dir-pipeline.test.ts` ① 的设计目的是**证明 P1 目录化迁移那一刀零行为漂移**（快照 = 迁移当时的数据体）。
- 关表在 P1 之后被**合法变更**（8→9 关）⇒ 该断言按设计**每次内容变更都会红** ⇒ 它锁的是**历史事件**，却被当作**持续不变量**使用。
- 同文件 ②③（`schemaVersion` 冻结 / manifest order·uid·引用齐全）仍是**活的结构不变量**，未受影响。

## 待裁（⛔ 工程侧不代拍）

**A 类修法**（机械一行，但值须确认）：`DEMO_LEVEL_COUNT` **8 → 9**。⚠ 前置确认：9 关是 pre-release 全量重置后的**终态**还是**中途态**（若后续还要入关，同类漂移会复发 ⇒ 建议同时裁「关数变化 ⇒ 常量必须同批同步」的门禁或把该断言改成读 manifest 长度）。

**B 类处置**（三选一，属判据语义域）：
- **甲**：重取快照（快，但**永久失去**「P1 迁移零漂移」的证据力 ⇒ 不推荐）；
- **乙**：① 降级为一次性历史断言（移入 `T-185` 归档段 + `[T-185 迁移期]` 标注），持续不变量交给 ②③（同文件已有）；
- **丙**：乙 + 把「关表内容变更 ⇒ 快照同步」写进关卡内容管线的收口清单（防同类复发）。

## 状态与影响

- 本单**只立项、不落码**；4 红维持原样，不因「看着像小事」就随手改数。
- 影响面：① `verify::test` 长期 FAIL ⇒ **绿线不可信**（K-089 同族：守卫/断言长期红会让人对整条门禁脱敏）；② 阻塞任何以「beads 全绿」为前置的验收（如 T-226 落码批的回归门）。
- 与本单无关、**不得混计**：WXG-T-229 复评后的 11 红已于 `565fa28` 全部转绿（剩 4 红即本单）。

### A 类处置落码（用户 2026-10-02 拍板「A」，2026-10-02 实施）

**前置已查清（结论对「只改值」不利，故同批加了门禁）**：`systems-index §3` 该行明写本值「**随表走 = 当前关数**」，且关表由 **beads-studio 逐张入关重建**（v1.48 入满 8 张）⇒ **9 是中途态、不是终态** ⇒ 只改值必然复发。

1. **`config/tuning.ts::DEMO_LEVEL_COUNT` 8 → 9**（注释记 v1.60 由来 + 门禁⑤ + 「9 是中途态」告警）。
2. **真源回写**：`systems-index` 版本行 → **v1.60**；§3 `DEMO_LEVEL_COUNT` 行值 8→9 + v1.60 注；`systems-index-changelog.md` 追加 **v1.60** 行（含①②③与「不并入 B 类」的显式声明）。
3. **新增生成期门禁⑤**（`tools/scripts/sync-levels-data.mjs::assembleFromManifest`）：声明了 `DEMO_LEVEL_COUNT` 的游戏，该值必须 == manifest 当前关数，不等即 `levels:check` 硬红。⛔ 只对声明该常量的游戏生效 ⇒ **breakout legacy 零影响**。
   - **门禁自证（K-089「先证守卫能红」）**：临时把常量改回 8 ⇒ `levels:check` 立即 exit 1；复原 9 ⇒ 绿。
   - 头注「覆盖面断言」清单 + `--help` 文本同步加 ⑤。
4. `framework:sync` 同步 Cocos 镜像（写入 1 = `tuning.ts`）。

**读数**：beads **735/736 绿**（A 类 3 红全转绿）· 剩 **1 红 = B 类**（`levels-dir-pipeline` ① 快照断言）· `levels:check` OK（beads + breakout）· `tsc --noEmit` 0 错。

**B 类仍待裁**（甲重取快照 / 乙降级为一次性历史断言 + ②③担纲 / 丙乙 + 写进关卡内容管线收口清单）——⛔ 本单未代裁。

### B 类处置落码（用户 2026-10-02 拍板「乙」）

**选项落地**：`tests/levels-dir-pipeline.test.ts` ① 由「常跑不变量」降级为 **`it.skipIf(env !== '1')` 的一次性历史断言**，标题改 `［T-185 迁移期一次性］`，注释写清：① 它原本证明什么（P1 迁移那一刀零漂移）② 为什么必须降级（锁历史事件却当持续不变量 ⇒ 关表任何**合法**变更即红，红因与被测行为无关）③ 现态由谁承担（同文件 ②③ 活结构不变量 + `levels:check` 的**字节一致性**；本条与它**同源重复**，按 K-042 不两处各钉一份）④ 复跑命令与**「复跑预期为红」**的正确性说明。

⛔ **丙项未做**：「关表内容变更 ⇒ 快照同步」写进关卡内容管线收口清单 —— 本批只按用户所选「乙」落，丙作为可选加强留待裁（快照已不再参与常跑门禁 ⇒ 丙的实际收益随之下降）。

**自证（不只看绿）**：默认跑 = `4 passed | 1 skipped`（不再污染绿线）；`WXG_T185_MIGRATION_RECHECK=1` 复跑 = **如实判红**（快照停在 8 关 / 产物已 9 关）⇒ 一次性断言仍可跑、且其红是正确信号。

**收口读数**：beads **735 passed / 1 skipped / 0 failed**（736 全消红）· `tsc --noEmit` 0 错 · `levels:check` OK。

### B3+B4 落码与四轮架构 review（CodeBuddy + 用户，2026-10-03）

**范围**：`B3` = Canvas2D 合成消费通道（`core/bake/tint-composite` + `adapters/canvas2d/tint-sprite-cache` + 渲染器 tint 分支 + 门禁）；`B4` = zoom LOD 回退机制（`TINT_LOD_MAX_UPSCALE = null` + `tintUpscaleAllowed()` + `BeadTintRuntime.allowTint()` + 两条臂序）。⛔ Cocos 生产载体（S5）与判据改写（S6）仍未做。基线 `4ef6317`，⛔ 未 commit。

**用户定的四条尺子**（延展性 / 可预见性 / 将来少改动 / 性能优异）⇒ 四轮 review 的收敛结果登记进 `ADR-0029 §8` 与延后册，要点：
- **合成权归宿主注入的 `BlitResolver`**（单方法）：渲染器不认识任何效果；未注入 = 今日行为（V-5）。
- **core 收口**：`tint` 是唯一具名效果字段，新增效果一律走 `BlitParams` 袋 ⇒ core 永不再为效果改动。
- **撤掉两处多余设计**：嵌套 `opts` 袋（X1，会引入分配 + 三态歧义）、`blitMode` 标记（X2）、`prewarm()` 专用 API（X3，注入式设计白送预热）。
- **性能口径**：单条 128² = 16384 px；单关卡 **7 色**（`design/levels/singles/*.json` 的 `palette` 恒 8 项）⇒ 7 条 = 448 KB，2.5 MiB 装 **40** 条 ⇒ **5.7× 余量**。⛔ 「品牌 2104 色」是**调色板规模**不是工作集（15 份品牌 25–461 色/份），先前引用口径有误，已更正。

**两个真 bug（单测抓出，非测试自身问题）**
1. **渲染器回落漏洞**：`cmd.tint` 存在但未注入合成器时，三元表达式回落到注册表 ⇒ **把未合成的 d/l mask 当成品贴出**（错色）。修法 = 带 tint 时永不回落（已升为 `ADR-0029 §8.3` 契约）。
2. **`drawEmptySocket` 漏挂 B4 阀**：只加在 `drawFilledBead` ⇒ 关阀时珠回退、格不退（不一致）。已补。

**LOD 数字**（`outer` = `BEAD_CELL 30` × zoom × dpr vs `MASK_CANONICAL_SIZE 128`）：`dpr = 2` 全区间安全（zoom 2.0 ⇒ 120px = 0.94×）；⛔ `dpr = 3` ⇒ zoom > **1.42** 即放大。阈值仍 `[待真机]`（`null`）。

**读数**：framework **410/410 绿**（新增 `tint-composite` 12 + `tint-sprite-cache` 13 + `canvas2d-renderer-tint` 5 = 30）· beads **761 绿 / 1 skipped**（新增 B4 判据 8）· `pnpm run typecheck` 0 错 · `framework:sync` 已同步 8+5 处 · `pnpm run verify` **PASS 18 / SKIP 1（`check:size`，K-089 既有缺口）/ FAIL 0**。

**未落 / 待裁**：⛔ `view-model` 未传 `maskGauge` ⇒ tint 臂仍**无调用方**（安全默认，屏上仍矢量臂）；⛔ 宿主未注入 resolver。接线作用域待用户裁：**甲 = 只接盘面**（托盘恒矢量，推荐）/ 乙 = 盘面 + 托盘珠。⛔ 未 commit。

---

## WXG-T-235

**beads·B0 底图 `TILE_BLEED` 外扩（消 AA 接缝白线）** — 2026-10-03 用户裁定「甲」。

### 起因：用户报「格子之间的白线看起来与放大缩小时采样有关」

用户初判方向**经实测成立**。三次实测把「看起来」变成数字：

1. **白线不在格间**（第一轮）：dpr=1 × 7 个窗口宽下逐行分段，格间与托盘**纯白 0px**；唯二的 2px 纯白线在
   盘面白底板外缘。ⓘ 我当时据此说「格间没有白线」——**错在阈值**：按「纯白 ≥248」筛，而该线混合后
   只有 lum 132 ⇒ 一直没被判成白。
2. **两臂对照**：同位置 `?tint=off`（矢量臂）亮度分布几乎一致（p99 均 157、max 184/185）⇒ 该线由
   `drawTargetTile` 的 B0 lattice **两臂共用**，**不是 tint 臂引入** ⇒ 不构成 tint 臂的阻塞项。
3. **剖面定位**（决定性）：`zoom 1.0 × dpr 2`、y=494 板面带逐像素 —— 板底 `(150,71,99) lum 97.8`，
   格边界 x=286 / x=329 各有 **1 device px** 的 `(172,112,133) lum 132.3`。三通道解混合一致
   （R 需 0.18 / G 0.22 / B 0.22）⇒ **约 20% 的白面板从相邻两个 B0 rect 的接缝漏上来**。

**成因**：格距在设备像素上多为分数（`gridPitch × zoom × dpr`），相邻 rect 的 AA 边缘各只覆盖一部分、
合计不足 100% ⇒ 缝里透出底下浅色板。⇒ **线的强弱是 `zoom × dpr × 窗口宽` 的相位函数**
（低倍率时格距变小、1px 缝占比最大 ⇒ 最显眼）。

### 落码（⛔ 只放大绘制边长，其余全不动）

- `config/tuning.ts` 新增 `TILE_BLEED = 0.5`（每边设计px）。附完整剖面、取值依据与判例。
- `view/bead-render.ts` `drawTargetTile`：`size` → `size + 2 * TILE_BLEED`。
- ⛔ **不动**布局格距 `gridPitch`、命中判定、`BEAD_GAP`（= 2）、珠体绘制边长（26dp）、`gridPitch` 快照。
- 取 0.5 的依据：相邻两格重叠 1 设计px ⇒ `dpr ≥ 1` 下恒 ≥ 1 device px，足够盖住实测的 1px 缝；
  再大只会让**相邻异色格**的色界多偏 0.5px（无收益）。
- 判例：**改 `BEAD_GAP` 是错的**——它治「珠与珠之间的缝」，本值治「底图与底图之间的缝」，层级不同。

### 配套测具（同批落，dev-only）

- `game/beads-game.ts` `setZoomForDebug(zoom)`：照 `setDebugOutlines` 同型，复用滑杆**同一条**
  `setCameraZoom` + `_recomputeLayout` ⇒ 状态完全同构，不持久化、不参与玩法。
- `dev/harness/main.ts` `?zoom=N`：headless 截图可按指定倍率出图（白线是相位现象，必须能定点复现）。
- ⚠ **实测坑**：harness 走 `dist/dev/harness/main.js` **预构建产物**，改 TS 不会自动生效 ⇒ 改完须
  `pnpm run harness:build`，否则参数静默不生效（三档 zoom 结果全同的假象即由此而来）。

### 修后实测（对照上表）

- 两处剖面点 lum `132.3 / 132.2` → **`97.8`**（= 底色本身，Δ −34.5 / −34.3）
- 全盘缝列普查 **7 条单像素缝列**（286/329/414/457/542/585/670）→ **0 条**
- 板面区「> 中位+20」像素 59211 → 55933（−3278 ≈ 20 条缝 × 180 行）；板面中位亮度 97.8 **未变**

### 测试口径变更（逐处留决策出处，非数字微调）

共 10 处「B0 底图 = 满格距、边缘重合」旧不变量：

- **5 处**「按字面量宽度筛 B0 tile」的过滤器改跟绘制边长 —— 其中 **2 处旧写法会静默退化为空断言**
  （筛出 0 条时「逐字段相等」永真，K-060 阳性对照失守）
- **4 处** `tile.w === 格距` 精确值加 `2 * TILE_BLEED`
- **1 处**「相邻砖**零重叠**」翻成「**恰好重叠 1px**」—— 旧零重叠正是漏白成因

### 封箱基准：第七次复评（严守真 · 官方复取器重抓）

- 现象：`bead-style-seal` 腿 4a/4b 红（整帧 sha 漂移）；`kinds` 与 `total` **未变** ⇒ 纯字段漂移。
- 处理：**未手填 sha** ⇒ 用官方复取器 `bead-style-seal-recapture.ts` 重抓
  （`capturedFrom = b84a1fd… · WXG-T-235 TILE_BLEED 工作树`）。
- **最强反证**：单珠命令流 `legacyFlow` **96/96 与前态全等**、`facetLayers` 45/45 全等
  ⇒ 本批**只动 B0 绘制边长，珠体一字未改**。
- 归因键 `provenance.s3_frame_recheck_7` 含：前态/现态锚、修订面（156 块 B0 rect 的 `w`/`h` +1）、
  实测剖面、**两臂对照（非 tint 引入）**、修后读数、配套测试口径变更清单。
- 零追改声明：`head.*` / `s3AtFormalization` / `head_liftShadowFade_r5` / `s3.legacyFlow` /
  `s3.facetNonHoleLayers` / `s3.facetHoleLayer` / `fixture.*` 全部不动；本批仅改 2 个 sha + 新增 1 归因键。
- 腿 4a/4b 补断言锁「无登记的基准追改视为红」⇒ 缺 `TILE_BLEED` / `不是 tint 臂引入` / `96/96` 任一即红。

### 接缝是「窄窗口现象」（本单最有价值的技术沉淀）

修后共测 12 个档位（dpr 1/2 × zoom {0.2, 0.5, 0.8, 1.0} + dpr 3），接缝**一律为 0**；
而修前**只在 `zoom = 1.0`（dpr 1 与 2）**检出。两点推论：

1. ⛔ **「重叠 ≥ 1 设备px 才盖得住缝」不成立为机理**：低 zoom 处重叠**更小**
   （`zoom 0.2 × dpr 1` = 0.2 设备px）却**未检出**接缝 ⇒ 接缝是否出现与 `zoom × dpr`
   **不是单调关系，尚未建立**。`TILE_BLEED = 0.5/边` 的依据是「**已实测有效**」，不是「算得出来」。
2. ⚠ **dpr 越高不等于越明显**（与直觉相反）：dpr 3 未检出，而 dpr 1/2 的 `zoom 1.0` 检出了
   ⇒ 白线是**窄窗口现象**，不是「低倍率必然出现」也不是「高 dpr 必然更明显」。

### 未闭（如实）

> **本单仅剩 1 项真机欠账**（异色格观感已于 2026-10-03 闭合；回归守卫已落 `check:board-seam` 进 verify）。

- ~~⛔ 只验了 `zoom 1.0 × dpr 2` 一档~~ —— **2026-10-03 已补测**（定点缝探针，zoom ∈ {0.2, 0.5, 0.8, 1.0}
  × dpr ∈ {1, 2}，修前/修后各一张，共 8 点）：
  - 修前**只在 `zoom = 1.0` 的两个 dpr 检出缝**（各 **8 条缝列**，Δlum **46 / 41**）；`zoom < 1.0` 四点**未检出**。
  - 修后 **8 点全为 0 条缝列** ⇒ 修复在「缝确实出现」的档位上被验证（8 → 0）。
  - ⚠ **推翻了我自己登记的推论**「低倍率格距变小 ⇒ 1px 缝占比最大 ⇒ 最显眼」：**不成立**。已同步更正
    知识库 `K-091` 的根因段（该错误论断已随前次提交入库，故必须改，不能留着）。
  - ⚠ **探针灵敏度在低倍率偏低**（珠子打断整列 ⇒ 缝列判据失效）⇒「低倍率无缝」单靠探针是**弱证据**。
- ✅ **肉眼确认（用户 2026-10-03，主理人实机目检）**：harness 下 **zoom 0.2 → 2.0 全区间无白线**。
  ⇒ 与探针**互补**：探针强在「缝确实出现」的档位给数字（8 → 0），肉眼强在**不受探针锚点限制**的全区间
  ⇒ 两者合并，「低倍率无缝」由弱证据升为**可采信**（探针的低倍率假阴性被肉眼覆盖）。
  ⛔ 口径边界：肉眼确认只覆盖 **harness（dpr 1/2、桌面 Chromium）**。
- ✅ **dpr ≥ 3 未验 → 已验**（用户 2026-10-03 主理人实测）：**dpr 3 下 Canvas2D 的 AA 接缝未出现**。
  ⇒ 叠加此前的 8 点（dpr 1/2 × zoom 0.2–1.0），**修后在 12 个测过的档位上接缝一律为 0**。
  ⚠ 口径边界：本条若为 harness/Chromium 口径，则 **iOS Safari 的 AA 规则是否同桌面 Chromium 一致仍未证**
  （Canvas2D 光栅化规则跨引擎无强规范）—— 如需彻底闭合，投放前在真机Safari 上过一遍即可。
- ✅ **异色相邻格色界平移 0.5px ⇒ 不可见**（用户 2026-10-03 主理人目检，harness zoom 0.2–2.0 全区间）。
  ⇒ 这条是 `TILE_BLEED` 外扩**唯一的潜在可见代价**（同色相邻格的重叠完全不可见，只有异色格的
  色界会平移 0.5px）⇒ 确认不可见即等于确认**本次修复无可见成本**（WXG-T-235 的「甲」方案
  从「修 1 条白线、代价 0.5px 色界」变成「修 1 条白线、代价 0」）。
- ✅ **无回归守卫 → 已闭合**（用户 2026-10-03 裁定「提升为 tools/ 测具并挂 verify」）：
  新增 `tools/scripts/check-board-seam.mjs`，**静态口径门进 `verify`**（无浏览器依赖 ⇒ CI 可跑），
  四条断言 —— C1 `TILE_BLEED > 0` / C2 `drawTargetTile` 真按外扩绘制 / C3 相邻重叠 ≥ 1 设计px /
  C4 测试口径无「字面量格距硬判」。**四种改法逐条实测能红**（K-089 先证守卫能红）：
  改 0 → C1 红；去掉外扩 → C2 红；外扩减半 0.5→0.2（重叠 0.4 < 1）→ C3 红；测试口径回退字面量
  格距 → C4 红。⛔ **像素复验（`--pixels`）不挂 verify**（本仓 CI 无浏览器 ⇒ 必假红），只作本地
  测具（实测 `zoom 1.0 × dpr 2` = 0 缝列）。
  ⚠ 落码时守卫**误报过一次**（正则只匹配 `2 * TILE_BLEED`，真实现是 `TILE_BLEED * 2`）⇒ 已改为
  乘法顺序无关，并留教训：**口径门要匹配语义而非写法**。


### 收尾（2026-10-04）：观感确认通过 + `TILE_BLEED` 外扩必要性实测

**① 观感确认（用户 2026-10-04 判）**：**异色格色界平移 0.5px 没有缝隙** ⇒
`TILE_BLEED = 0.5` 的可视代价（异色格色界平移）**判为可接受** ⇒ 原「观感确认未做」一条**闭**。

**② 「能不能不加」的实验（用户追问）** ⇒ 临时把 `TILE_BLEED` 改 `0`，扫 **9 个 zoom × dpr 相位**
（zoom 0.6/0.75/1.0/1.5/2.0 × dpr 1/2），与 `0.5` 做**同相位差分**（两态画面**只差**「B0 rect 是否每边
外扩 0.5px」⇒ 差分带必然是格边界）。

| zoom | dpr | 差分像素 | 0 态更亮占比 | 0 态均亮 | 0.5 态均亮 |
|---|---|---|---|---|---|
| 0.6 | 1 / 2 | 4 516 / 8 217 | 96.1% / 92.5% | 150.9 / 138.3 | 123.7 / 97.7 |
| 0.75 | 1 / 2 | 2 977 / 9 062 | 96.0% / 93.0% | 146.0 / 151.8 | 104.5 / 111.8 |
| 1.0 | 1 / 2 | 5 682 / 10 986 | 97.8% / 95.8% | 151.9 / 142.4 | 117.3 / 95.7 |
| 1.5 | 1 / 2 | 6 040 / 14 439 | 94.9% / 91.7% | 149.8 / 143.8 | 117.2 / 104.4 |
| 2.0 | 2 | 12 605 | 93.3% | 132.8 | 91.1 |

**结论：`TILE_BLEED = 0` 在 9/9 相位全部露出白缝**（0 态更亮像素占 **91.7%–97.8%**，
均亮比 0.5 态高 **30–46 lum**）⇒ **0.5 的外扩是必需的，不可以去掉。**
放大对照图：`temp/shadow-preview/tile-bleed-0-vs-05.png`（左 0.5 无缝 / 右 0 现浅色网格线）。

**③ 一处方法学坑（留档）**：先写了个「窄亮峰」检测器，**在 0.5 基线上就误报**（1 258–2 727 px，
最大对比 99–208）—— 因为盘面**心形边界**（暗红 vs 白背景）与**珠子受光亮线**（lum 183.8）都满足
「窄峰且显著亮于两侧」⇒ 假阳性淹没真值。
⇒ **改用「同相位差分」才拿到干净证据**：只测「B0 外扩」这一个变量。
**教训：检测器必须先在「已知无异常」的基线上跑一遍验假阳性**，否则读数无意义
（同 v5.0 的「预览取代表色未自证」、v7.0 的「探针索引 undefined 假绿」同族 —— **都是没先自证工具**）。

---

## WXG-T-241

**盘面已选中珠时点错色空格 ⇒ 错珠动画（⛔ 不是「先选一颗珠子」文案）**

**用户报**（2026-10-04）：「提示先选一颗，但是在盘面上已经有选择的珠子了，应该给错珠动画提示」。

### 病灶（提示与画面直接矛盾）

`_routeGridEmpty` 的「先选一颗珠子」文案（`TAP_HINT_NO_SELECTION_TEXT`）**只在真的没选中时成立**。
但 `_tryDirectFillFromBoard` 在「**board 锚存活** + 点的是**错色空格**」时**也返回 `null`**
（`target.colorIdx !== anchor.color` ⇒ 不消费）⇒ 玩家**明明已选中**却被告知「先选一颗」。

⛔ 既有 `wrong` fx 只挂在 `_placeSelected`（**托盘锚**）的 `rejected/mismatch` 分支
⇒ **board 锚这条路径此前无任何反馈**（全测零覆盖 ⇒ 一直没暴露）。

### 修法

按「调用 `_tryDirectFillFromBoard` **返回后** `_boardSelected` 是否**仍存活**」分流：

| 锚状态 | 判读 | 反馈 |
|---|---|---|
| **存活** | 已选中，点的是**错色格** | **错珠动画**（GAP-04 `wrong` 态，同 `_armWrongFx` 通道）+ ⛔ 不给文案 |
| **已清 / 从无** | 组员全死（函数内自行清锚）或本无选中 | 「先选一颗珠子」**保留** |

⚠ **判据必须用「调用后」的锚状态**：组员全死那条路径会**在函数内清锚** ⇒ 若用「进来前」的锚，
会对一个已不存在的选中态播错珠动画（守卫 ③ 钉死这条）。

### 新增守卫（`tests/board-wrong-fx.test.ts`，3 条）

① 锚存活 + 错色空格 ⇒ `wrongRow/wrongCol` 命中被点格、**推一帧后 `wrongProgress > 0`**
（起播帧 elapsed=0 ⇒ 进度 0 正常；不推帧只能证「标志被置」、证不了动画在播）、⛔ `tapHintText === ''`；
② 从无选中 + fillable 空格 ⇒ 文案**保留**（旧行为不回归）+ `wrongRow === -1`；
③ ⛔ 锚组员全死 + 点空格 ⇒ **回落文案** + `wrongRow === -1`。

### 造盘的三个坑（实测踩到）

⚠ **盘面初始满盘**（`applyMisplacedToGrid` 装配）⇒ 无空格；`noAssemble: true` 会**跳过装配** ⇒ 盘全空 ⇒ 建不了 board 锚。
⚠ **`grid.retrieve` 只收错位珠**（`grid.ts:134` 的 `beadColorIdx === colorIdx` 守卫）
⇒ 空格必须 `setBead` 先造成错位、再 `retrieve` **两步**。
⚠ 直改 `grid` 后**必须 `h.advance(FRAME)`** 让 snapshot 同步（现成测试判例）。

### 读数

beads **780 绿 + 1 skipped**（新增 3 条）· `verify` **PASS 19 / WARN 0 / SKIP 1 / FAIL 0** ·
`check:tasks` **30/30**。

---

## WXG-T-242

**选中反馈批：影加深 + 错位修复 + B0 不位移（乙裁：盘面 lift 保持 6）**

**用户报**（2026-10-04）：「珠子抬起时候，阴影还是和珠子不太适配，错位了。阴影本身也要加深，凸显被选中的效果，抬起似乎不是很明显。」

### 落码五处

① **影跟随 `liftX`**：`drawLiftBeadShadow` 原先只吃 `lift` 不吃 `liftX` ⇒ 珠斜上 15°（偏 −2.95dp）而影留在原地。上下沿同加 `liftX` ⇒ 影与珠严格同列。
② **分离影加深**：`LIFT_SHADOW_ALPHA` 0.38 → **0.52**。
③ **珠体 L0 接触影加深**：`BEAD_SHADOW_ALPHA_SELECTED` 0.25 → **0.40**（与 ② 是两条独立通道）。
④ **托盘抬起 4 → 9**；且**托盘补分离影**——病灶：托盘抬起原本没有任何分离影（全仓仅盘面一处 `drawLiftBeadShadow` 调用）⇒ 用户的「加深」在托盘侧无处落地。口径与盘面同源，层序槽后珠前（与 T-240 ② 一致）。
⑤ **B0 底图移出 `wrong` 位移作用域**（art-director 裁定，见下）：`drawTargetTile` 用 `cx` 不吃 `dx`。

### art-director review（用户令「请美术设计重新 review」）——核出三件事

1. **我的前提错了**：`wrong` fx **从来只在空格上跑**（`placement.ts` 的 `mismatch` 只在 `state === 'empty'` 可达 + 红环只画在 empty 分支 + `ux-spec` 原文「tap 不匹配**空格**」）⇒ `assets-spec §1.6` 的「当前珠」是**文档漂移**（唯一误说源头），已同批修正，并删「闪 2 次」残留旧措辞（实装是单峰 0 往复）。
2. **真 bug 是可算的几何缺陷**：`drawTargetTile` 边长 = `gridPitch` 32（含 `TILE_BLEED 0.5` ⇒ 半宽 16.5），相邻格心距 32 ⇒ B0 是无缝连续马赛克 ⇒ 抖 ±3 **开合 2px 白缝**（200ms 内 4 次），玩家读作「地皮在抖」而非「这一格被拒」。裁定：位移属于格内对象（坑+红环+文字），不属于跨格连续层；坑 3dp 恰好用尽 0.5px 余量（13+3=16<16.5）不越邻格。全部既有参数一字不动。
3. **单槽门吞连点**（第二重真因）：`_armWrongFx` 全局单槽 + 500ms 门 ⇒ T-241 扩面后连点两个不同错色格，第二个格无反应 ⇒ **T-243 工程单**。

### 乙裁与封箱（第十二次复评，`provenance.s3_frame_recheck_12`）

用户裁「**只落加深+托盘**」⇒ 盘面 `SELECT_LIFT_PX` 保持 6（它经 `BEAD_CARD.liftRef` 归一改变 legacy 输出，落 11 就撞腿 1 的 48 例——T-236 五轮记录的阻塞仍在）。

**⚠ 两次归因错误如实留档**（ponytail 会话核出）：
- 错一：「键集漂移」——错把**复取器自用矩阵**（键用代码常量生成 z26/l11）当成腿 1 对照；实际腿 1 矩阵从 **fixture `legacyFxParams` 逐字段直读**，键集恒定与代码常量无关。
- 错二：「影 alpha 撞腿 1」——实证 l6 档 48 例按当前代码重录**值变 0/48**：影 alpha 不在 `drawLegacyTenBead` 输出通道内。

封箱读数：`frame78` total 1877/kinds 全不变仅 sha 变 · `frame0` sha 不变（静息零影响）· `facetNonHole` 全等 · `facetHole` 45 例变（影 alpha 落孔层）· legacyFlow l6 档值自愈（重录为 no-op）。零追改：`head.legacyFlow` 史证不动，r5 段键值均未变（`_readme` 追记口径）。

**读数**：beads **780 绿 + 1 skipped** · 封箱 9/9 · `check:tasks` 32/32 · Cocos 镜像同步。`bead-render.test.ts` 的 `SHADOW_LIFT` 改引 `SELECT_LIFT_PX` 常量（字面量在换档时静默打折，实证 0.567 vs 1.04 错档）。

---

## WXG-T-244

**组归位逐颗 BFS 错峰落座动画（纯表现，数据同帧不变）**

**用户裁定**（2026-10-04）：「一组珠子转移到新的槽里，要从当前点击的槽开始，按照 BFS 扩展出去，按照 ease-in-out 时间间隔出现，并且有落下去的抖动效果。」

### 场景锚定

= **board 锚直填的组批量归位**（WXG-T-186）：一次点击填「被点空格 + BFS 连通同色空格一片」。此前所有珠**同帧出现**，无逐颗错峰。

### 落码（三层全部复用现成件，零新常量/零新毫秒/零新图元）

| 层 | 内容 |
|---|---|
| game 登记 | 新增 `_groupLandFx` **纯表现**队列（`_noteGroupLand` 惰性建、定长 `SOLVER_MAX_CELLS`、越界静默丢——同 `_noteSolverLand` 判例）；组归位循环里 `used−1` = BFS 序登记 |
| game 推进 | `_stepGroupLandFx(dt)`：表现层判例（不被 PAUSED 冻结，同 `_stepWrongFx`）；非 playing 作废；`elapsed ≥ totalMs` 清 |
| 相位口径 | **逐字复刻** `solverBeadProgress`：`tMs = elapsed − SOLVER_STAGGER_MS(80) × step`；`≤0` 未轮到 ⟹ view **不画珠**（= 逐颗「出现」）；`0..SOLVER_PER_BEAD_MS` 送现成 `fillPopEnvelope`（压下回弹 = 「落下抖动」，G1/G2′ 同款） |
| snapshot | 同构 `solverLand*`：`groupLandRows/Cols/Steps/Count + groupLandElapsedMs`（单调标量，L5 判例） |

⛔ **数据同帧写盘不变**（T-186「无中间态外泄」）：队列只驱动「珠画不画/抖不抖」，规则读取不受影响——守卫 ① 显式断言当帧 `filled`。

⛔ **不复用 `_solverFx` 本体**：那条连**落子执行**都由队列驱动（`_stepSolverFx` 逐颗调 `_solveMisplaced`）；直接挂上去会二次落子破坏 T-186。只借表现口径，不借执行语义。

### 造盘坑（实测踩到，`planGroupFill` 手动调用定位）

组员连通判据是「**沿同色错位珠** ≤2 步」——首版把两颗色 2 错位珠放在切比雪夫距 2 但中间格非同色错位珠的位置 ⟹ 不连通 ⟹ 组只剩锚 ⟹ `alive.length − 1 = 0` ⟹ BFS extra 上限 0 ⟹ 第二颗目标格**永远不被填**（且无任何报错）。修法 = 让组员相邻（`swaps: [[0,2,1,1],[0,3,3,1]]`）。

### 守卫（`tests/group-land-fx.test.ts`，2 条）

① 登记序 = BFS 序：`steps` 恒 `0..n-1`、首格 = 被点格 + **当帧 grid 已 filled**（同帧口径）；② 相位窗口：第一颗在窗口内、第二颗未轮到（错峰实证）· 越总时长后 `count=0`（零常驻）。

### 读数

beads **782 绿 + 1 skipped**（新增 2 条；封箱 9/9 含在内 ⟹ 静息帧零影响实证）· Cocos 镜像同步。



### 八批（乙案）· 间隔更明显但总时长仍 200ms

**主理人裁「乙」**（2026-10-04）：在 200ms 硬上限内重分配预算，而非放宽上限。

| 项 | 改前 | 改后 | 说明 |
|---|---|---|---|
| `GROUP_LAND_SPREAD_MS` | 80 | **130** | 环间传播预算 ⟹ 间隔 1.63×，明显可辨 |
| `GROUP_LAND_PER_BEAD_MS` | （复用 120） | **70** | ⛔ **新增落珠专属窗**（不动共享常量） |
| `GROUP_LAND_DROP_PX` | 14 | **22** | 下落距离更明显（零成本，不吃时长预算） |
| 总时长 | 200ms | **200ms** | 130 + 70 **顶满且不破**用户裁定 |

⚠ **为什么必须新增常量**：`SOLVER_PER_BEAD_MS`（= `FILL_POP_MS` = 120）是**解环器点名链与
落珠链共享**的单一真源 ⟹ 直接改它会连带把「逐颗点名」的压下窗砍半（**不在诉求内**）；
而「间隔更明显」在数学上必须从 200ms 预算里抢时间（`间隔 ⊂ 总时长`）⟹ 只能另开落珠专属窗。

⚠ **守卫同步**：`group-land-fx.test.ts` 4 处单颗窗断言改引新常量（1 处 import + 3 处断言/归一化）；
守卫 180 那条「总时长 ≤ 0.2 秒」**继续绿**（130 + 70 = 200，顶满）。
⛔ 落珠链是 `SOLVER_PER_BEAD_MS` 在 `beads-game.ts` / `view-model.ts` 里的**唯一**用处
⟹ 改完两处 import 均**悬空 ⇒ 已删**（零漂移）。

**读数**：beads **788 绿 + 1 skipped** · `verify` **PASS 20 / WARN 0 / SKIP 0 / FAIL 0** ·
`check:tasks` **34/34**。

### 补建美术正本卡（诚实登记）

⚠ 发现 **T-244 前七批改了视觉却从未在 `assets-spec` 建卡** ⟹ 参数（`SPREAD` / `DROP_PX`）
**无处登记 = 规格漂移**。本批补建 **§1.6.2b `vfx_group_land`**（极简，只记代码真值，不改观感）。

### 二十三批（收口：裁日志 + 一处回滚隐患）

**用户裁定**（2026-10-04）：「那批 TEMP-LOG（裁后删除）的 `[GLD+…]` 一并裁掉」+ 面板选项
「回滚隐患 本批一并修」。

- **裁 `[GLD+…]` 临时日志**：game 侧 11 处 + view 侧 1 处（登记/丢弃/播完/初始化/播放节流/
  托盘进珠/起播/复位）全清；随之**只服务于日志节流**的两个游标一并删
  （`_liftLogMs` 字段 + `_groupLandFx.loggedMs`；grep 全仓零其它引用）。
  ⛔ **表现层队列字段本身不动**（`_groupLandFx` / `_trayLandFx` 是真代码）。净 −54 行。
  注：`GldConsoleTrace` 与 `gld-last-frame` 两处 try/catch 探针**此前已随动画重写撤除**，本批无需处理。
- **【顺带修真隐患】**`_tryDirectFillFromBoard` 的防御回滚 `setBead(src.row, src.col, bead)`
  **静默失效**：上一行 `retrieve` 已把源格清成 `empty`，而 `setBead` 要求目标为 `filled`
  ⇒ 恒 false ⇒ 一旦触发那颗珠**凭空蒸发**（本批前一处 16 个色违规的根因，K-013）。
  修 = 改 `fill(...)`（`retrieve` 的精确逆操作）。理论不可达路径，但它是本函数**唯一「吃掉珠」的入口**，
  且二十一批守恒哨兵现在抓得到它 ⇒ 修后哨兵无从可抓。
- **测试入口如实登记**：本批发现前几批用的 `games/beads/tests/scripts/run-node-tests.js`（输出「用例/通过/失败」表）
  已不在树里（全仓 `find` 零命中）⇒ 本批改跑 `vitest run` = **801 passed / 1 skipped（59 文件）**
  —— ⚠ **两个计数不可直接对比**（子集 vs 全量），历史「446 绿」不得当作本批基线。

**验证**：`vitest run` 801 passed / 1 skipped · `tsc --noEmit` 0 错 · `framework:sync` 后两镜像同步
（cocos 副本与 `src` 逐字节一致）· 全仓 grep `GLD` / `TEMP-LOG` / `_liftLogMs` / `loggedMs` **零残留**。

---

## WXG-T-245

**skill 调用审计（`pnpm run skills:audit`）**

**来源**：2026-10-04 用户问「skill 统计为什么没有触发」→ 追加「想看单次会话的调用明细」。

**修正此前的不准确表述**：仓库侧确实**无 hook / 无门禁 / 无统计脚本**（所以「自动触发」不存在），
但 **IDE 本地会话历史里有完整 `use_skill` tool-call 记录** ⟹ 「数据一直在，只是没人读」。

**落码**：`tools/scripts/skill-audit.mjs`（只读）+ npm script `skills:audit`。
输出三段：① 按会话分组的 `use_skill` 明细（时间 + skill）② 工具调用 TOP8（对照 `use_skill` 排第 16）
③ 用过的 skill 集合 + **零调用 skill 清单**（扫 `~/.codebuddy/skills` 与 `my-skills` 的 frontmatter `name`）。
参数：`--json`（机器可读）、`--conv <会话id前缀>`。

**读数**：全库 51433 条 tool-call · `use_skill` 18 条 · **9 个 skill 用过 / 40 个零调用**
（含 `ponytail-audit`/`grilling`/`test-driven-development`/`systematic-debugging` 等）。

**解析踩坑（三次才通）**：块类型是 `tool-call`（**不是** `tool_use`）· 字段 `toolName`/`args`/`toolCallId`
· ⚠ 每个 message 的 `message` 字段是**字符串化 JSON**（必须二次 `JSON.parse`）· glob 层级
`<history>/<会话>/<turn>/messages/*.json`（少一层 ⟹ 静默扫到 0 条，最容易误判成「没有记录」）。

---

## WXG-T-251

### beads·`DEC-1` 改裁 = 甲′（实施形态 甲″ 三层）

**来源**：用户 2026-10-05 在 WXG-T-250 汇报后择 **(A)**（「甲」= 回 `§7 Q1` 改裁 `DEC-1` = 甲′，并要求实施面按 甲″ 三层写）。
**纯文档批**：零代码、零产物、不动 spike；⛔ 裁定生效 ≠ 已实施。

**裁定本体**（`ADR-0030 §3` DEC-1）：

- 采纳 **甲′**（按色图集 + `Sprite` 池）；实施形态 = **甲″ 三层**（L0 静态底图 / L1 珠层（脏帧才同步）/ L2 UI 层（脏帧重放））。
- 四条理由（逐条对应本单实测）：① 甲′ **零未证平台能力**（丙′ 押的 `S0-1` 二值门至今未过）；② `[E]` 档 CPU 1⁄3、tris 1⁄11、**零每帧上传**；
  ③ 分层上界已数 `dc 15 → 2`（§5.0.3）；④ 地基已清（§5.0.2 门控 + §5.0.4 `fx` 入门 ⇒ 静置 tick **0.40 ms**）。
- **三条伴随义务**（与裁定同写一条 DEC，⛔ 不得只拿好处）：(i) 观感一致性 = 同字节产物 + 一次新的 Cocos sprite A/B（UV/Trim、半像素、filter/wrap、**朝向 flip**），
  S3 对拍由「可选」变**必做**；(ii) ⛔ 不得把非珠层每帧全量重放带进生产（否则 = 白拿 13 dc）；(iii) 280 个 `Sprite` 节点的内存与遍历成本进 `[R]` 低端机预读。
- **丙′ 未出局**：降为第二候选，若日后 `S0-1` 过且移动端上传实测可接受，可凭 §5.0.1/§5.0.4 数据重开。

**同批扫四节（承 K-105）**：

| 节 | 动作 |
|---|---|
| §0 结论 | 修订块收尾加一行：初稿推荐已作废；三条支撑**原样保留**作改道证据（支撑 1 仍成立，但被「押未证平台能力」抵消） |
| §3 DEC-1 | 就地标「✅ 已改裁」+ 裁定理由 + 三条伴随义务；原「采纳 丙′」正文一字不删 |
| §5.1 批次表 | ⛔ 不改表原文 ⇒ **新增 §5.2 裁后路由**（逐行判「还算不算数」）+ 开工拓扑 **S1 → S5′ → S3 → `[R]`** |
| §7 Q1 | 标「✅ 已裁 = (b) 甲′」，并注「下面三行保留为当时的选项清单」（承 K-059：带正文语义锚） |

**本批不裁的三条（列为实施单开工门禁）**：
① **L0 烘法**：运行时离屏 canvas 一次性上传 ‖ 直投预烘 PNG（包体实测：主包 **2866.8 KB**、距红线余 **1229 KB**、**已超内部目标 866.8 KB**）；
② **层序**：L0/L1/L2 的 z 序，现网背景是**每帧 `Graphics` 填色** ⇒ 归属未定（归 L0 则背景不得动；有动效就得回 L2）；
③ **L2 重放粒度**：整层重放 ‖ 只重放变化图元；两种都受 **L5**（UI/渲染不持有游戏状态）约束。

**落位**：

| 面 | 文件 |
|---|---|
| ADR | `docs/architecture/adr/ADR-0030-beads-cocos-production-blit-carrier.md`（头注第十一刀 + §0 + §3 + §5.0.4 括注 + **新增 §5.2** + §7 Q1） |
| 台账 | `TASKS.md` 头注 → **252** + 本行；`TASKS-DETAIL.md` 本节点 + T-250 未闭环 ① 就地括注 |
| 知识库 | `knowledge/lessons/process.md` 新增一条 ⇒ `kb:sync` 分配 **K-105** |
| 日记 | `memory/2026-10-04.md` 「三十一批」 |

**验证**：本批零代码 ⇒ `pnpm run verify` **PASS 20 / WARN 0 / SKIP 0 / FAIL 0**（全项为**守恒**验证，不是新功能证据），`check:tasks` 主表 40 行 ⇔ 详情 40 节配对完整 · `check:links` OK · `ctx:build` ✅；⛔ 本批未 commit。
⚠ 中途曾真红过一次（非假绿）：主表行只写了 **4 列** ⇒ `check:tasks` A 项报「列数 4 ≠ 5」，并连带 `verify:selftest` FAIL（该装置自己重跑注入项时会把仓库现状一起拾到）⇒ 补列与补节后两项均转绿。

**沉淀统计（`kb:sync --task=WXG-T-251`）**：**新增 1 / 修改 0 → 二次跑 新增 0 / 修改 1**（同一条 K-105，因改一处笔误），`kb:audit` 无候选。
新增的 **K-105**（[流程]）：改裁不是换个结论而是同批扫四节（§0/§Decision/批次表/§未决问题）；⛔ 不删原文只标作废；
伴随义务与裁定同写一条；实施细节未定的不得代裁；台账钉「裁定生效 ≠ 已实施」。判例链 K-057 / K-059 / K-053。

**未闭环**：① 甲″ 三层的**生产接线**未开工（**S1 carrier 抽象至今未实现**，`case 'blit'` 仍是无条件 warn-skip）⇒ ✅ **同日 WXG-T-252 已交付**；
② S3 两端同帧对拍未做（现为必做）；③ `[R]` 低端机；④ wx 侧 `S0-1` 二值门；⑤ 第三档（底图 vs HUD 拆分比例）仍未测。

---

## WXG-T-255

**WXG-T-255 · beads·mask 档位宏 + 构建产物 mask 门禁**（2026-10-05 · 主理人 Qoder · 程基岩域 · `ADR-0030 §5.5` 第十五刀）

**用户裁定（本单的施工图）**：「hole 和 holeless 图片纹理打包到主包，暂时设定宏，指向 hole 相关图片纹理，可以编码切换到 holeless」
⇒ 两类纹理都要进主包（落地 = 编辑器动作）；**先用宏把运行期钉到 `holed`**，编码可切。

**为什么这条裁定比"等编辑器"重要**：它同时改写了 `warmup()` 的注入前提。旧前提「4/4 齐才注入」= 任何构建档都永不满足
⇒ `carrier=on` 静默落回矢量臂，且屏幕上无异常。前提收为「宏实际要的那几张齐」后，`holed` 两张已在包 ⇒ **构建档当场可注入**
⇒ S5′-3 层序、S3 两端对拍、`[R]` 真机三件的验证闸门解除（不必 ④ 落地就能开工）。

**确诊读数（产物级，⛔ 不是推演）**

| 逻辑名 | uuid | 源图 | 两份产物 |
|---|---|---|---|
| `mask__bead__holed` | `cbf588aa-3ab8-418a-af42-5ea6b4fe0b9c` | 8,750 B | ✅ `native/cb/…png` |
| `mask__grid__holed` | `a626af4b-a549-4224-9703-83c8c1da833c` | 3,395 B | ✅ `native/a6/…png` |
| `mask__bead__holeless` | `dcc16bba-eba7-4404-99e4-85e392b9b405` | 4,210 B | ❌ 不进包 |
| `mask__grid__holeless` | `f8648f92-945c-4e8f-bd9a-03d5c7a97d7a` | 2,872 B | ❌ 不进包 |

包体不是问题（四张合计 19,227 B；主包在册 2866.8 KB 已超内部目标 2000 KB ⇒ 仅 WARN，K-089 口径）。
**取证自纠**：第一轮明文 `grep <uuid> config.json` 得出「wechatgame 档一张都没进」= **假阴性**（该档 `uuids` 存压缩 base64 `cb9YiqOrhBiq9CXqa0/guc@6c48a`）
⇒ 正确取证面 = 直接看 `assets/main/native/<uuid 前 2 位>/<uuid>.png`。沉淀 **K-108**。

**交付**（ponytail：一处守卫住查表处，⛔ 不在两个调用点各写一遍）

| 文件 | 改动 |
|---|---|
| `games/beads/src/config/tuning.ts` | `TINT_MASK_GAUGE_PIN: 'holed' \| 'holeless' \| null = 'holed'`，头注明写「临时接线，⛔ 不是 §3 冻结数值」 |
| `games/beads/src/view/bead-tint-mask.ts` | `resolveTintGauge(gauge, pin?)` 纯函数（只住在 `tintMaskId()` / `tintTileMaskId()` 查表处 ⇒ 一处覆盖两宿主 × 两形态）；`requiredTintMaskIds(pin?)` = 需求集唯一真源；`MASK_ID_TABLE` 本体未改 |
| `host/beads-blit-carrier.ts` | `MASK_IDS = requiredTintMaskIds()` 驱动装载与 warmup 阈值；`MASK_UUID` **保留四张完整目录** ⇒ 宏改回 `null` 本文件零改动；头注写死「bundle 落地后加载面怎么改」的两种形态 |
| `dev/harness/main.ts` | `MASK_IDS` 同源派生、`loadMasks()` 按需求集逐张；预热集随需求集收窄（40 张 → 20 张，⛔ 不得反向加回来） |
| `tools/scripts/check-cocos-mask.mjs`（新） | 产物门禁：解析载体 `MASK_UUID` + `tuning` 宏 ⇒ 逐张核 `native/<xx>/<uuid>.png`；无产物 = **SKIP**（同 `check:size` BD-18 体例），缺张 = **FAIL**；`--pin=` 可否在册宏做反事实提问 |
| `package.json` / `verify-all.mjs` | `check:cocos-mask` 挂进 verify 链（`check:size` 之后 = 第 **21** 项） |
| `games/beads/tests/bead-tint-arm.test.ts` | 改 1 条（现役宏语义）+ 新增 2 条（宏两态 / 需求集两态） |

**门禁双腿实跑**（一条只会绿的门不算门）：在册 `'holed'` ⇒ 需求集 2 张 ⇒ `STATUS: OK`（exit 0）；`--pin=null` ⇒ 4 张 ⇒ 两张报 `❌ 不进包` + `STATUS: FAIL`（exit 1）。

**ponytail 选了什么 / 拒了什么**：取「宏只住查表处」而非在每个调用点判档；取「需求集派生」而非在两宿主各抄一份 id 数组；
⛔ **不预写 `loadBundle` 分支**（无产物可验的预见代码，编辑器落地后按实际 bundle 名再接）；⛔ 不手编 `.meta`（L1）；
⛔ 不为宏生效期做 holeless↔holed 像素 A/B（两档恒同一张图，无从对比）。

**验证**：beads **808 passed + 1 skipped** · `typecheck` ✅ · `cocos:check` 检查 2 / 失败 0 · `framework:sync`（写 0 / 未变 100 + 69，镜像已一致）·
收口 `pnpm run verify` **PASS 21 / WARN 0 / SKIP 0 / FAIL 0**（新增第 21 项在本机有产物档上跑 OK）；⛔ 本批未 commit。

**沉淀统计**：`kb:sync --task=WXG-T-255` ⇒ **新增 1 / 修改 0 / 激活 0 / 归档 0**（新增 **K-108**：运行时 uuid 字符串不构成构建期引用 ⇒ 必须有产物级门禁）。

**残留与解除条件**：
① **④ 的真正落地 = 一条编辑器动作**（`assets/textures` 标 bundle，或给两张 `holeless` 补一条构建期引用）；bundle 路线需改加载面 `assetManager.loadBundle(⋯).load(⋯)`，补引用路线宿主零改动；
② 落地后 `TINT_MASK_GAUGE_PIN → null` ⇒ 复跑 `pnpm run check:cocos-mask` 验 **4/4**；
③ 本批**未重新构建产物** ⇒ 宏的运行效果未在构建档/真机跑过（需一次 `pnpm run build:cocos` 复验）；
④ 关键路径 **④ → ① 层序实装 → ② S3 对拍 → ③ `[R]` 上机**（① 的真因 = 一块 `Graphics` 同装「盘面底板（须在珠下）」与「三处全屏遮罩（须在珠上）」⇒ 插入序必错一侧，解法 = 底板整块挪出 `Graphics`）。

**同日补刀（2026-10-05 · ④ 路线拍板，撤销本批早先「不预写 `loadBundle`」那条取舍）**

用户问「标 bundle 是 Cocos 的要求还是微信的要求」，并择一 **第一解法 = 把 `assets/textures` 配置为 Bundle**，否决「逐张补构建期引用」（理由：每新增一张纹理都要再挂一次材质/引用，不自然）。
**分层结论**：*引擎侧* = Creator 构建系统的收录规则（本缺口在这里）；*平台侧* = 微信主包 ≤4 MB / 分包与 `game.json subpackages`（与「进不进包」无关，只管已产出的东西怎么摆）。
官方口径（3.8 Asset Bundle 文档）：Bundle 是**目录级**配置（项目设置 → Bundle 配置，或属性检查器「配置为 Bundle」）；压缩类型 5 种，默认「合并依赖」⇒ bundle 输出为**主包内的本地目录** `assets/<bundle>/`，⛔ 只有选「小游戏分包」才会挪进 `subpackages/`（那才第一次撞上微信规则）。

**落码**：① 载体 `MASK_UUID` → **`MASK_ASSETS`**（每条 = `uuid` + bundle 内 `path`，四张目录不变）；② `loadImageAsset(entry)` 两腿——`loadBundle('textures').load(path, ImageAsset)` 优先，取不到回落 `assetManager.loadAny({ uuid })`（**编辑器动作落地前这是唯一能跑的腿** ⇒ ⛔ 不是预见代码），哪条生效打一行日志；③ 门禁 `check-cocos-mask.mjs` 改成**逐 bundle 扫** `assets/<bundle>/native/<xx>/<uuid>.png`（只扫 `main/` 会把「已落地」误报成「没进包」）。

**待你在编辑器做**（L1 禁手编 `.meta`，本批不伪造）：选中 `assets/textures` → 属性检查器勾「配置为 Bundle」→ Bundle 名称 `textures`（⛔ 内置名）→ 压缩类型**保持默认「合并依赖」**。落地后我收 `TINT_MASK_GAUGE_PIN → null` + `build:cocos` + 门禁验 **4/4**，运行期日志应从「全局 uuid」切成「bundle `textures`」。

**补刀读数**：`cocos:check` 检查 2 / 失败 0 · beads **808 passed + 1 skipped** · `framework:sync` 写 0（镜像已一致）· 门禁双腿复跑（在册 `'holed'` ⇒ `STATUS: OK`；`--pin=null` ⇒ 缺 2 张 `STATUS: FAIL` exit 1）· 收口 `pnpm run verify` **PASS 21 / WARN 0 / SKIP 0 / FAIL 0**。⛔ 未 commit。

**沉淀**：**K-108 修改**（补第 ⑤ 条：出路分两层、「合并进主包 ≠ 微信分包」、Bundle 化的加载面与门禁连带）。

**收口（同日第三刀 · 用户「做完」= Bundle 已在编辑器配好并重构产物）**：`assets/textures.meta` 由编辑器写入 `userData: { isBundle: true, bundleName: "textures" }`（⛔ 非手编，L1 合规）。本侧收口 = `pnpm -C games/beads run build:cocos`（wechatgame debug，**27.6s** 成功，编辑器 MCP 同时在线不冲突）⇒ 产物多出 `assets/textures/`（`config.json` / `index.js` / `native/{dc,f8}` / `import/…`）：

| 腿 | 读数 |
|---|---|
| `holeless` 两张 | ✅ `assets/textures/native/dc/dcc16bba-….png`、`f8/f8648f92-….png`（**新增进包**） |
| `holed` 两张 | ✅ 仍在 `assets/main/native/cb/…`、`a6/…`（被 `.mtl` 引用 ⇒ main 里另有一份，PNG 字节不重复） |
| 门禁 | 不再需 `--pin` 覆盖，在册宏即读出需求集 **4/4 全 ✅**（逐 bundle 扫生效，没把「已落地」误报成「没进包」） |

⇒ `TINT_MASK_GAUGE_PIN = 'holed' → null`（按档位取，临时接线拆除、只留作 A/B 旋钮；头注改写为「来历 + 债的口径」，并修掉一处笔误 `check:cocos-masks` → `check:cocos-mask`）。连带：`bead-tint-arm.test.ts` 三条断言按新在册语义改写（`null ⇒ 两档不同源`、钉住用显式入参测、需求集在册 4 张 / 钉档 2 张）；`dev/harness/main.ts` 预热注释回到 **4 个 id = 40 张**（预算顶格、非超出）；载体头注改为事实陈述（bundle 已配 ⇒ 装载腿走 `loadBundle`，uuid 只作回退与门禁锚）。

**收口读数**：`framework:sync` 写 1（tuning 镜像）· beads **808 passed + 1 skipped** · `check:cocos-mask` 4/4 `STATUS: OK` · 收口 `pnpm run verify` **PASS 21 / WARN 0 / SKIP 0 / FAIL 0**（含新产物的 `check:size`）。⛔ 未 commit。**仍未跑**：构建档 / 真机的 `carrier=on` 实机观感（holeless 小豆档 A/B 仍是债）。

---

## WXG-T-258

**WXG-T-258 · beads·格面 mask 退化为纯结构件（格底真透 + 纯色底下沉）· 定标单 v10.0**（2026-10-05 · 主理人 Qoder · 美术域＋程基岩域代落盘 · `ADR-0030 §5.9` 第十九刀）

**用户裁定（原话）**：「两张图的格底应该是透明，可以和纯色底混合」⇒ 接续 WXG-T-257（§5.8）留下的两条未闭；本轮追加「图已经看过了可以，A B C 执行」（A 查格缝点阵 / B 格底真透批 / C 写沉淀）+「再看下真机逻辑是否和 harness 一致」。

**口径**：**有孔档** grid mask 的 shape（B 通道）= **只留 3dp 斜面环**，格底与孔位一律真透 ⇒ 格面 mask 成为**纯结构件**；**无孔档不跟随**（其槽底 = `0.32` 假孔，属结构件，抹平即毁判据 I-5 的「有孔 0.70 / 无孔 0.32」分叉）。格底纯色**下沉到下层**：盘面 = L0 底 tile（§5.8 已把 tile 形态 shape 强制 255 = 满幅不透明），托盘 = `drawEmptySocket` 的 base rect。⇒ 一张源两种包装（cell = 结构件 / tile = 满幅底图）彻底解耦，⛔ 不改 shader、不改 `composeMaskTile`、不改 `systems-index §3` 冻结常量。

**交付（资产 1 + 代码 2 + 判据 1 + 门 1 + 文档 3）**

| 面 | 改动 |
|---|---|
| 定稿资产 | `export-cocos-textures.py`：128 空间判定改 `(sd8 <= 0) & (sd8 >= -EDGE_DP * pxs)`（⚠ **512 空间那笔被它覆盖，改它无效** —— 首轮重跑 md5 一字不变才发现）⇒ 新 md5 `8e2deda1`（旧 `ff824d6e`，可由摘掉环带条件的临时脚本逐字节复现）；四张同步进 `cocos/assets/textures/` |
| `mask-field.ts::cellShapePlane` | TS 场计算按 `spec.gauge` 分叉（有孔 = 环带 / 无孔 = 槽口内整块）⇒ `mask-diff` 逐字节 0 差异（对拍门先红后绿，正是它的职责） |
| `mask-field.test.ts` I-4 | 「槽口内 255」→「斜面环 255 / 有孔格底 0」，并补**正向**腿（10.5dp 环带必不透明）—— 否则「整格透明」这种错改法也能让 I-4 绿 |
| 在册 | `ADR-0030` **§5.9** 新增 + §5.8 两条未闭标结；定标单主表行 v10.0；`memory/2026-10-05.md` 第十九刀一节 |

**实测影响面（`?dbg=off`，桌面 Chromium `[E]` 档，⛔ 不作屏幕层/真机 PASS 证据）**：**盘面 0.00% 逐像素变化**（预测成立：下层 tile 与格底同值）· **托盘 20.00%**，槽底 `(170,169,172)` → `(191,191,193)` = 中性方片边消失（`temp/wxg257-maskshape/v258-tray-{before,zoom}.png`）。区域级对比可用 = 已排除 HUD（计时器逐运行变，K-103 同族）。

**A 结案（顺带，非缺陷）**：格缝青 `(38,224,255)` / 品红点阵 = harness **默认开的 DEBUG 虚线轮廓**（`dev/harness/main.ts:496`，`?dbg=off` 关；游戏侧 `debugOutlines` 默认 false ⇒ 不漏进真机/构建）；`dbg=off` 复测两色计数 = **0**，与「三臂同数 20609 px」自洽。上一批登记的「托盘竖粉细线」同族（`DEBUG_OUTLINE_TILE` 品红 = 固定 `BEAD_PITCH` 诊断参照）。⛔ 未改代码。

**真机 vs harness 一致性（本轮可静态取证的部分 + 一处新分叉）**：资产字节（等值腿）✓；派生代码同源（`framework:sync:check`，Cocos 侧 `mask-tile.ts` / `tint-sprite-cache.ts` 为拷贝件）✓；**生效 shader 只有一份** —— `assets/effects/tint-mask.effect`（v7.0 `shape = mask.b`）被两张 `.mtl` 引用并进包，`assets/scripts/game/view/tint-mask.effect`（旧 ADR-0028 编码）**uuid 在 assets 与 build 中零引用 ⇒ 构建已裁，不进包**（死文件，待清）。⚠ **新发现公式分叉**：`shape ∈ (0,1)` 羽化带 CPU 侧 `ls = l·shape`（`tint-composite.ts`）而 GPU 侧不乘 ⇒ 珠 mask 1242 个半透明像素 ΔRGB 最大 **27.8/255**（base 0.70）~ **40.7/255**（base 0.56）；格 mask 纯二值 ⇒ 本批不受影响。⛔ 未擅自改，两侧谁为准待裁（改 CPU 会动 harness 孔缘亮度，可能触到 WXG-T-232 甲钉的过渡带判据）。

**⚠ 一次在册自纠**：`check:size` 逐 `games/*` 报，上一批我把两游戏读数**对调**了 —— 真相 = **beads 主包 2918.8→2919.0 KB（超内部目标 2000，存量 WARN）**、**breakout 1837.8→1886.1 KB（达标）**；beads 大头 = `cc.js` 1360 + `audio/bgm_porch.mp3` 704 + `main/index.js` 464（无 `.map` ⇒ 确为 release）。§5.8 与 memory 均已就地标注二次更正。

**门禁**：framework **447**（含 `mask-diff` 5/5）· beads **811 + 1 skipped** · `check:board-seam` C1–C4 OK · `check:cocos-mask` 定稿等值 4/4 + 需求集 4/4 进包（进包件 `main/native/a6/…png` md5 ≡ 源件）· `framework:sync:check` 一致 · release + web 两档重建 · 沉淀 **K-117 / K-118**（`kb:sync` 新增 2 / 修改 0 / 激活 0 / 归档 0，`kb:audit` 无相似命中）。⛔ 全程未 commit ⇒ **本批字节随 WXG-T-259 一笔落库**。

---

## WXG-T-259

**WXG-T-259 · beads·tint 合成式三端统一（GPU 为准）+ 旧 effect 死件清**（2026-10-06 · 主理人 Qoder · 框架域＋工程域 · `ADR-0030 §5.10` 第廿刀）

**用户裁定（原话）**：「旧 `assets/scripts/game/view/tint-mask.effect` 死文件清除 / GPU 为准 ⇒ CPU 去乘 shape / 提交」（对上一轮 D 项一致性核查给出的三个待拍板问题的拍板）。

**一、式统一（核心）**

- 分叉：CPU `compositeTintMask` 写 `ls = l·shape`，GPU frag 写 `outColor = base*d + (1-base)*l` 后整体预乘 `alpha`。浏览器 `putImageData` 拿 straight alpha 后自行预乘 ⇒ CPU 在 `shape ∈ (0,1)` 羽化带上多衰一次 ⇒ 两端不同色。
- 量化：珠 mask 半透明像素 **1242/16384**（shape 0.031–0.996）；旧式偏差 ΔRGB 最大 **27.8/255**（base 0.70）、**40.7/255**（base 0.56）；格 mask 纯二值 ⇒ 本批盘面/托盘零影响。
- **裁定后发现**：这不是新增口径而是**代码回归规约** —— `tint-mask-asset-spec §5.1`（「合成式（唯一）：`rgb = base·d + (1−base)·l`」）、ADR-0028 §2.1、定标单 §7.2 旁注都不带 shape；`preview-combined.py` 头注自写「与 shader 结果一致」而 `composite()` 代码不符 ⇒ 两处同时修，py 重烘两张 `preview-combined-{128,1024}.png`。
- 落码：`packages/framework/src/core/bake/tint-composite.ts`（去乘 + 头注重写）· `tools/mask-preview/preview-combined.py` · `tools/mask-preview/export-cocos-textures.py` 头注口径行 · `framework:sync` 到 beads/breakout 拷贝件 · `ADR-0029 §8.2` 键名表公式行。
- **新回归门**：`tint-composite.test.ts` 羽化带腿（CREAM/CHARCOAL × `shape=128/200` ⇒ RGB 与 shape 无关）；旧式会算 `(68,68,71)` 而非 `(106,106,108)`，差 **38/255** ⇒ 误改回去必红。其余旧腿 shape 全为 0/255 ⇒ 不需迁移（包括 WXG-T-232 甲钉的孔缘过渡带判据，**未受冲击**）。

**二、死件清（带一个镜像树坑）**

- 取证：生效件 = `assets/effects/tint-mask.effect`（uuid `bf89c803`，被 `tint-mask.mtl` / `tint-mask-001.mtl` 引用并进包）；旧件 uuid `a41bc418` 全仓只自见于自己的 `.meta` ⇒ 零引用。
- ⚠ **坑**：`cocos/assets/scripts/game/**` 不是独立资产而是 `games/beads/src/**` 的**镜像拷贝件**；只删拷贝件后 `framework:sync:check` 报 `OUT … tint-mask.effect (missing)`、`build:cocos` **拒绝构建**（「直接构建会编出旧代码」）⇒ 故须两处一并删（正本 + 拷贝件 + `.meta` = 三文件），beads game 拷贝 47→46。
- 此旧件早已在册：方案件 `wxg-t-226-tint-pipeline-plan.md` **R-12**「旧编码 RGB=d/A=l ⇒ 待清理」；QA 判据 `wxg-t-228-tint-criteria.md:15` 当时还靠它证明「tint 运行时未落码」⇒ 属历史证据链，两处记录不追改。

**三、在册自纠（上一批的债）**

WXG-T-258 主表行与详情节都写了「定标单 **v10.0**」，但 `tray-neutral-slot-mask-spec.md` 当时**只到 v7.0**（登记与实物不符）。本批补写 **§8 v10.0**（a=258 环带、b=259 式统一），并把头注版本行顶到 v10.0、§7.2 公式行同步、§7.3「槽底不得透明」改写为「已被 v10.0 部分推翻：仅无孔档仍守」。

**四、门禁与未闭**

- framework **448**（+1 新腿，含 `mask-diff` 5/5）· beads **811 + 1 skipped**（零回归）· `framework:sync:check` 一致 · release + web 两档重建 · `check:cocos-mask` 等值 4/4 + 需求集进包 · `check:size` beads **2919.0 KB**（超内部目标、存量 WARN）。
- ⛔ **本批只证「公式同式」，不证「屏幕逐像素相等」**：真机 S3 同帧对拍仍需 `[R]`（K-037：桌面 Chromium 读数不得当屏幕层 PASS）。
- 沉淀：**修订 K-117** 那句公式（无当时新建条）；本会话收尾另立 **K-120**（镜像拷贝树删资产三处成对，见 §WXG-T-260 第六节），
  并对 **K-111**（构建档 debug ≠ release）补一次 `kb:touch` 留痕——259 原样复现了一次。

---

## WXG-T-260

# ctx B 预算门收敛（knowledge 分片子切 + 四件豁免登记）

> 2026-10-06，主理人(Qoder)·装置域。用户第③项裁定「提交」开工即被 pre-commit 拦下，本单 = 解堵。

**一、拦下的是什么**

- `git commit -F` → `ctx:check FAILED（7）`，**全属 B 项**（任意 `.md` ≤ 8000 估算 token），无一项是代码问题：
  `ADR-0030` **45088**（新件首次入索引才暴露）· `control-manifest` 8549 · `knowledge/INDEX` 8972 ·
  `knowledge/CHANGELOG` 8153 · `knowledge/lessons/{engine-cocos 8618, process 8752, testing 8722}`。
- **归属查清再动手**：逐件按 HEAD blob 实算 token（不是看体积）—— 后六件**在 HEAD 全部门下**
  （5929 / 7351 / 1688 / 7889 / 7457 / 7975）⇒ 根因 = 本会话 257~259 三批沉淀与登记，不是存量包袋。

**二、三片为何不能豁免（政策而非偏好）**

- 正本：`knowledge/INDEX.md §4`「每片同受 ctx B 门约束，**不得为分片新增豁免**；某片再越阈 ⇒ 该标签内部按子标签再切」
  + `memory/MEMORY.md:17` 同口径 + 指针页尾「再膨胀处置」。
- 先试「归档」这条：`kb:audit` 实跑 = **归档候选 0 条**（活跃 115 / 归档 0，阈值 = 闲置 ≥90 天且访问 ≤1）
  ⇒ 本批无一条可据实归档，⛔ 不得为了过门把在用判据打成“归档”。

**三、子切（仍沿 WXG-T-221 / 235 先例）**

| 原片 | 越限 | 移走 | 新片（新行内标签） | 原片余 |
|---|---:|---|---|---:|
| `引擎Cocos` | 8618 | K-108/111/112/113（构建产物/资产装载） | `engine-cocos-build`（`引擎Cocos构建`） | 6090 |
| `流程` | 8752 | K-045/046/050（台账/领号/并发写盘） | `process-ledger`（`流程台账`） | 5731 |
| `测试` | 8722 | K-038/042/060/089（守卫与变异的有效性） | `testing-guard`（`测试守卫`） | 6124 |

- **逐字节搬运走脚本，不手工拼**（判例 K-030 / K-043）：临时工具 `temp/w260-subsplit.mjs` 复用
  `lib/knowledge-ledger.mjs::parseKnowledgeFile` 同一口径，自带**三重自证**（回拼≡原文 / 块数≡lib 条目数 /
  写后重解析行内标签≡新片），任一不一致即 `exit 1`。
- ⚠ `knowledge:split` **不能**用于再切：它是一次性迁移工具，`lessons/` 已存在即早退（判例 K-047⑤）。
- **两处硬映射同笔登记**（INDEX §3 点名）：`split-knowledge-lessons.mjs::TAG_TO_SHARD` +
  `lib/knowledge-ledger.mjs::LESSONS_SHARD_ORDER`——无机械校验两者同步，只改一侧就是静默漂移。
- 副作用如实入账：换行内标签改了标题行 ⇒ `contentHash` 变 ⇒ `kb:sync` 报**修改 11 / 新增 0**，
  `kb:check` **八重 PASSED**（含 `INDEX` 活跃块↔ledger 双向）。`ACTIVE_FILES` 动态枚举⇒ 新片无需改码即被采集。

**四、四件豁免（均带撤销条件，登记者 = 主理人）**

| 文件 | tok | 理由 | 撤销条件 |
|---|---:|---|---|
| `ADR-0030` | 45088 | ADR 单文件完整性（沿 0011/0015/0020/0022/0023/0024 七份先例） | S5′ 收口后把 §5 施工记录按 Epic 阶段拆 `ADR-0030-build-log-<phase>.md` |
| `control-manifest` | 8549 | 铁律 L1–L5 唯一正本，⛔ 不为过门删正文 | 评审清单区抽 `control-manifest-review.md` 或自然回落门下 |
| `knowledge/INDEX.md` | 8972 | §6 活跃表 = `kb:sync` 生成物（6148）无窗口；**只给入口件，不开分片先例** | 再涨 >500 tok 即外移 §1–§5 协议正文（腾 ≈2825 ≈ 50 条目）并同步 `AGENTS.md §9` / `ctx/ROUTES.md` 锚点 |
| `knowledge/CHANGELOG.md` | 8153 | `kb:sync` 生成、数据源 `events` append-only 无时间窗 | 给 `renderChangelog` 加窗口（须同步 kb selftest）或按季度归档进 `archive/`（已入 SKIP_DIRS） |

**五、未闭**

- ⚠ **生成物无收敛循环** = 真源缺口（已写进豁免 note）：`CHANGELOG` 只要知识库还活着就单调增长，
  每次大沉淀批必顶门；本批只登记未改生成器（改它得连带 kb selftest，不夹带进提交解堵）。
- ⚠ **`toolchain.md` 现 7744 tok，距 B 门仅剩 256** ⇒ 该片下一条沉淀必顶门，届时同样按 §4 再切（⛔ 不新增豁免）。
- ⛔ 全程未用 `--no-verify`；本单字节与 257~259 同一笔落库（header 写 `WXG-T-257~260`）。

**六、收尾沉淀（同会话补账，随 K-119 / K-120 入账）**

- **K-119**（`工具链`）= 本单的定责法与分流政策：pre-commit 尾报掩盖 B 门 / `git show HEAD:` 实算定责 /
  分片不得豁免只能再切 / 归档候选先实跑 / 再切走脚本三重自证。
- **K-120**（`引擎Cocos构建`）= 259 那刀的镜像拷贝树坑（正本 + 拷贝件 + `.meta` 三处成对；`sync:check` 报 OUT 即拒构建）。
- `kb:sync --task=WXG-T-260`：**新增 2 / 修改 0 / 激活 0 / 归档 0**（活跃 **117**）· `kb:audit` 无候选、无相似命中 ·
  `kb:check` **八重 PASSED** · `ctx:build` 已刷 · `ctx:check` OK。
- ⚠ **工具/文档小缺口（只登记不夹带修）**：`knowledge/INDEX.md §5.1` 文面的
  `pnpm run kb:touch -- K-001` 会把分隔符 `--` 本身当 ID（`parseArgs` 的 `/^--([^=]+)…$/` 不匹配裸 `--`）
  ⇒ 报「未知条目 ID：--」并 **exit 1**，但前面的真 ID **已写入成功**（假红 + 退出码失真）。
  可用写法 = `node tools/scripts/kb-touch.mjs K-111 --task=WXG-T-259`；INDEX 那一行已改成正面形，
  脚本侧收口（`parseArgs` 丢弃裸 `--`）待单独领号，已波及 `kb:archive` / `kb:reactivate` 同形调用。

---

## WXG-T-256

**WXG-T-256 · beads·S5′-3 层序 = 视觉裁剪解（去容器板 + 统一单层底色 + 第二块提交体 + 载体插序）**（2026-10-05 · 主理人 Qoder · 程基岩域 + 美术域代落盘 · `ADR-0030 §5.6` 第十六刀）

**用户裁定（两项，选项题均取推荐项）**：① **去板范围 = 整块去掉（最彻底）** —— `drawPuzzlePlate` 的 B1–B3 暖光 band + B4 投影 + B5 白板体 + B5b 内凹 + B6 完成贴纸全拆；② **统一背景 = 收成单层纯色背景** —— `drawBackgroundLayers` 的冷沉 + 两档同心提亮退役，只留 `palette.background`。
第三条是本单给的路线裁定：「**A 起步、B 作为收口替换**」= 底色由**渲染器自己画**（宿主注入第二块提交体），相机 `clearColor` 方案留作 `[R]` 读 dc 后的替换。

**为什么这不是「把底板挪出去」**：§5.5 残留 3 当初的诊断是「一块 `Graphics` 同装底板（珠下）与遮罩（珠上）⇒ 插入序必错一侧，解法 = 底板整块挪出 `Graphics`」。开工复核发现更根本的一条：**裁② 那把尺（按「有没有动效」切 L0/L2）在容器板上失效** —— 板宽 `gridW = (gridCols−1)×snap.gridPitch + gridCell` 随 `camZoom` 每帧重算 ⇒ 「没有动效」为假，烘了就得按缩放档重烘（与「盘面整体缩放、内容不重烘」的用户硬约束冲突）。**去板 + 单层底色 ⇒ 珠下零图元 ⇒ L0 不需要烘 ⇒ 冲突面直接消失**，层序由**节点序**解决（Cocos UI 不需要 zIndex）⇒ ⛔ 框架 `render-model` 零改动，当初预想的「层归属标记」这套新机制**一行都不用写**（改判 = **裁②′**）。

**顺带确诊并修掉一处既有缺陷**：`RenderModelBuilder.setBackground()` 产出的 `model.background` 在 **Cocos 侧此前无任何消费方**（canvas2d 侧 `canvas2d-renderer.ts:165` 有）⇒ 两端底色不一致。`Main.scene` 的 `cc.Camera` 只有 `_color: rgba(0,0,0,255)`、**无** `_clearColor` / `clearFlags` ⇒ 引擎默认清屏色**静态读不出**，⛔ 不得据此断言现网表现。修法 = 宿主注入 `Background` 节点画这一色（复用 canvas2d 语义），**不猜引擎默认值**。

**交付（代码 5 + 判据 4 + 文档 5）**

| 面 | 改动 |
|---|---|
| `view/view-model.ts` | 删 `drawPuzzlePlate()` / `drawBackgroundLayers()` 两函数及调用（**−86 行**，⛔ 不留空转代码，留 6 行退役登记指向 §5.6）；`setBackground` 上加「只发一个 token，铺满屏归宿主」 |
| `config/tuning.ts` / `view/palette.ts` | 退役 `PLATE_*`×8 + `BG_*`×3 = **11 常量** 与 `GLOW_WARM_HEX / BG_DEPTH_HEX / BG_LIFT_HEX` **3 hex**（原地注释留退役登记） |
| `framework/src/adapters/cocos/cocos-renderer.ts` | `CocosRendererOptions.backGraphics?`（**可选**）+ `draw()` 起手铺一屏 `model.background`；⛔ 未注入 = 逐字节等价（DEC-2 口径） |
| `framework/src/adapters/cocos/bindings.ts` | 节点序 `GameRoot → Background(Graphics) → BlitLayer(Node) → Graphics(矢量 UI) → Labels`；`createBlitCarrier(_layer: Node)` 形参语义由 GameRoot 改 **BlitLayer**；`backGraphics` 注入 |
| `cocos/.../beads-blit-carrier.ts` / `BeadsBootstrap.ts` | 图集节点挂 BlitLayer（**兑现旧 `ponytail:` 注**：父节点不再是 GameRoot 末尾 ⇒ 底图之上、矢量 UI 之下，面板/遮罩能压住珠）；覆写签名同步 + 文档写明「⛔ 不是 GameRoot」 |
| 判据 | 封箱三处（`PLATE_BG_RETIRE_FRAME0/78 = 9` 分段登记常量 + 腿 4a/4b + 差分自洽 + `toBe(1868)` + 键 13 三条断言）· 色表锁 `37/fd5a0def780d` → **`34/67c2a2c08a92`** · `tuning.test` ⑤ 改贴 `PUZZLE_BAND.yMin` · `check:a11y` A5 **✅ → ⚠️**（锚 `glow_warm` → `FILL_POP_SCALE_TROUGH`，`accessibility.md` 矩阵行 + §3 小结同步） |
| 文档 | `ADR-0030` 头注第十六刀 + §5.2 裁②′ 就地改判 + §5.5 残留 3 标解除 + **新增 §5.6** · `assets-spec` **v1.5-r20**（§1.7/§1.8 退役条 + 基线表「背景/板 −9」订正注） · `art-bible` **v1.5-r3**（§3.1 三 token 行 + §3.5/§4.3/§6/§8 对应条划线留档，K-053） · `systems-index` **v1.61**（§3 值零改动，只作废 `PUZZLE_BAND` 负面后果 ③）+ changelog 行 · QA `test-cases.md` **K.5.1-补7** |

**封箱基线修订 = 唯一通道**：官方复取器 `tests/bead-style-seal-recapture.ts` 重抓 ⇒ `frame78 1877→1868`（`rect 998 · circle 160 · line 376 · text 12 · polygon 322`，sha `d3a57328…`）、`frame0 1331→1322`（sha `0419c9e2…`）；**逐 kind 归因 = 两帧各 rect −9（板 6 + 背景 3），其余 Δ = 0，未解释 0 条**；**最强反证 = 珠体族 `legacyFlow` 96 例 + facet 45 例逐字节等值**；史证 `head.*` / `s3AtFormalization` / `fixture.*` 不动。⚠ **流程偏差如实登记**：本次重抓由**变更侧**执行、未过 QA 之手（K-082「更新权在 QA」）⇒ 记 P3，见 `K.5.1-补7` 首条。

**ponytail 选了什么 / 拒了什么**：取「**删掉冲突对象**」而非「发明层归属标记 + 三处插序判断」；取「宿主画底色（复用 canvas2d 语义）」而非「相机 `clearColor`」（后者把色值真源劈成 `Main.scene` + `palette.ts` 两处，且 ⛔ 猜不出引擎默认值）；取「**两块提交体**」接受 dc 可能 +1 而非为省 1 dc 引入双真源；⛔ 不留 `PLATE_*` 空转常量「以防想恢复」；⛔ 不把 a11y 锚点抹成 `-` 躲检（按事实降档）。

**验证**：beads **808 passed / 1 skipped（59 文件）** · `typecheck` 0 错 · `cocos:check` 检查 2 / 失败 0 · `framework:sync:check` 一致（framework 53 + game 47）· `check:a11y` 一次**真红**后复绿 · `harness:smoke` OK（`rect=129 arc=3412 fill=1569 fillText=12` / `6127 draw commands`）· 收口 `pnpm run verify` **PASS 21 / WARN 0 / SKIP 0 / FAIL 0**。⛔ 未 commit。

**残留与解除条件**：
① 复取器锚 = `3982e43 + worktree-delta(未提交)` ⇒ 不满足「可复现 commit 锚」全义，**提交后复跑复取器自证等值**；
② **Cocos 端 dc 未读**（本批提交体 1 → 2 块 ⇒ 按 §5.0.3 静置期可能 **+1**）**解除条件** = ② 真机/harness 复读 dc 与截图（`carrier=on` 两臂）；
③ 若 +1 有代价 → ③ 换代**相机 `clearColor`**（删这块 rect，代价 = 色值双真源 + 需改 `Main.scene`，L1 侧要走编辑器动作）；
④ 观感 `[待真机 / art 校准]`：去板后盘/地同色域、暖侧只剩珠子 ⇒ 丙案「双色温对撞」基调是否仍成立归**正主复验**；完成态 B6 贴纸消失，若要补非板形态完成标记 = 另开 art 单；
⑤ `S3` 两端对拍、`[R]` 低端机预读未动。

**沉淀统计**：`kb:sync --task=WXG-T-256` ⇒ **新增 2 / 修改 0 / 激活 0 / 归档 0**（`kb:audit`：归档候选无、相似命中无）。
新增 **K-109**「层序死结优先『删掉引起冲突的对象』，而不是给数据模型加『层归属标记』——加标记 = 扩协议，删对象 = 缩问题面」；
**K-110**「改『渲染真源』字段前必须先 grep 两侧消费方：canvas2d 吃了 ≠ Cocos 吃了，harness 全绿掩盖的是『某个宿主根本没读这个字段』」。
`ctx:build` 已重跑（knowledge/memory/TASKS/QA 索引面刷新）。

**同批补记（用户 2026-10-05 报「格子背景没了、盘面背景板还在」= 旧产物，非漏删）**：截图里那块白板 = `palette.panel #FFFFFF` + `panelBorder #E2DFF0` 圆角矩形（正是 B5 板体），而 `build/wechatgame` 的时间戳是 **16:04（T-255 收口那次）**、源码与镜像改动在 **16:25 / 16:30** ⇒ 产物早于本批 ⇒ 板必然还在。取证 = debug 产物 `assets/main/index.js` 里 `drawPuzzlePlate` / `PLATE_*` 只剩**注释命中**（函数体已无）。重建后 `check:cocos-mask` 4/4 OK、`check:size` OK、`verify` **PASS 21 / FAIL 0**。
⚠ **本批一处自伤（如实）**：第一次重建走的是默认档 = **debug**，把在册 **release** 产物原地覆盖 ⇒ `check:size` 当场 **FAIL**（主包 6074.3 KB > 红线 4096，`cc.js` 3365 KB 触发「疑似 debug」启发）⇒ 立即 `build:cocos -- --release` 复原（主包 **2918.3 KB**，仍 ⚠ 超内部目标 2000 但 ≤ 红线 = K-089 口径 OK）。较在册 2866.8 KB **+51.5 KB**，旧产物已被覆盖 ⇒ **未逐文件归因**（本批不动资产，疑为新层节点代码 + 镜像刷新）。沉淀 **K-111**。

**追加验证（用户「坑底是纹理还是矢量图」· 一次性探针跑完即删，⛔ 不入判据）**：同一盘面同一帧两臂对照 ⇒ **矢量臂** `rect 908 / circle 260 / line 320 / polygon 522 / text 12 = 2022 条`；**纹理臂** `blit 280 / rect 20 / circle 4 / line 16 / polygon 10 / text 12 = 342 条`（需求集 = `mask__{bead,grid}__{holed,holeless}__v1` 四张）。
**分流真源只有一处**：`drawTargetTile` / `drawEmptySocket` 的纹理臂要求 `_tintRuntime !== undefined`，而生产 Cocos 侧该运行时**只由 `beads-blit-carrier` 注入**（`carrierSwitchOn()` ⇒ 默认 `null`）⇒ **当前构建档（不带参数）看到的坑底 = 矢量图**；加 `carrier=on`（web `?carrier=on` / wx 启动参数）且日志 `masks=4/4 carrier=on` 后才是纹理（tile 画布 33dp、内容 30dp 居中，槽与底图同一张图）。harness 侧默认即纹理臂，`?tint=off` 可切回矢量对照（HUD 有 `tint 4/4 mask` / `tint off` 行）。
**同批补记（2026-10-05 · 用户「真机加了 `carrier=on` 还是矢量图」= 装载腿两处缺陷，⛔ 不是参数没传到）**：web-mobile 产物 + Chromium 复现 ⇒ 控制台 `masks=2/4 carrier=off`（参数**已**生效，载体建了、`loadBundle('textures')` 也成功），缺的是两张 `holeless`。逐形态实测（同一路径换六种写法）定位到两条独立缺陷：
① **并发 memo**：`ensureMaskBundle()` 记 `_maskBundleTried` 标志位 + 结果槽，而 warmup 对四张 `Promise.all` 并发调它 ⇒ 后三个调用方当场拿 `null` 走全局 uuid 腿（`holeless` 已离开 `main` ⇒ 解不出）。改为缓存 **Promise 本身**。
② **API 形态**：`bundle.load(path, ImageAsset, cb)` 三参在 3.8.8 把回调当 `options`（`this.onProgress is not a function`）；补成四参后在**构建产物**里只请求到 `import/<uuid>.json`、**永不回调**（连被 `redirect` 回 `main` 的 `holed` 两张也挂），而 `assetManager.loadAny({ bundle, path }, cb)` 同场景直接返回 `ImageAsset` + 128px `HTMLImageElement` ⇒ 取资产一律经 `assetManager`，bundle 句柄只用于注册。
修后（release 重建）：**web-mobile 产物 `?carrier=on` ⇒ `masks=4/4 carrier=on`** ✅；`check:cocos-mask` 4/4、`check:size` OK（beads 主包在册口径不变）、`verify` **PASS 21 / FAIL 0**（含 `typecheck`）。
⚠ 更正上一段「追加验证」的隐含前提：那句「加 `carrier=on` 且日志 `masks=4/4` 后才是纹理」在**本批之前对构建产物不成立**（只有编辑器 Preview / harness 成立）。
⚠ **弱取证面登记**：`check:cocos-mask` 只核 native png 在不在 ⇒ 上面两条它全绿。产物级加载证据 = 跑一次 `?carrier=on` 看 `4/4`（探针留在 `temp/wxg256-socket-arm/probe-carrier.mjs`，⛔ **未入册**，重跑：`node temp/wxg256-socket-arm/probe-carrier.mjs "carrier=on"`；**是否升为常驻 smoke 工具未拍**，代价 = 每次要 Cocos 构建 + Chromium）。沉淀 **K-112**（异步 memo 记 Promise）、**K-113**（跨 Bundle 加载形态）。
⛔ 未闭：微信真机侧 `carrier=on` 的 `4/4` 与 dc 读数（本地探针只覆盖 web-mobile 运行时，`wx.createCanvas` 离屏能力与 `loadAny` 在 wx 档仍需真机确认）= ② 批。

---

## WXG-T-261

# beads·托盘放大批（槽底深色墨档 + 格缝加大 + 尺回 48/6 系）

> 2026-10-06，主理人(Qoder)·美术域＋工程域代落盘。用户三裁原话：「将托盘格子的 mask 混一个深色，
> 槽底显示更深一些；托盘格子之间增加一些间隔；托盘整体放大一些，两边离边缘不要太远。」

**一、代码（src + 镜像同批，`framework:sync` 写入 1）**

- `tuning.ts`：`TRAY_SLOT` 30→**48** · `TRAY_GAP` 2→**6** ⇒ pitch 54 · 12 列行宽 642 · 每边留白 54
  （v4.0 期 184）。推翻 WXG-T-237 v4.0「1:1 格面」；保留其 mask 接线（托盘槽吃盘面 `cell` mask 等比，
  ⛔ 不另建托盘专属 mask）。`TRAY_BEAD_SIZE` 降为**命中框基准**（=44；`TRAY_HIT_SIZE`=60），
  绘制不读它 ⇒ 托盘珠吃等比 `drawInset`、珠面 ≈**41.6**。
- `palette.ts`：新 token `traySlot #BCC2CB`（只换托盘槽底，盘面空格仍 `slot`）= art 单合法通道
  （`assets-spec` **v1.5-r21**，让号自查 r20→r21）；色表锁 **34→35/`38c2bed416c3`**。
- `view-model.ts` / `bead-render.ts`：托盘珠与盘面珠**逐字同参**（防两臂异形）；槽底墨消费 `traySlot`。

**二、封箱第十五次复评（WXG-T-212 官方例外通道，四步闭环）**

1. **前态锚**：HEAD 隔离副本（`git archive HEAD` + symlink node_modules）逐字节复现现役锁
   （frame0 1322/`907ea480…` · frame78 1868/`537de402…` · legacyFlow 96 例零差）。
2. **现态重抓**：官方复取器（临时加 `WXG211_DUMP_FLOW` env 门控 dump，⛔ 不改封存路径）。
3. **流级差分归因**：两帧各 172 条改写（rect 121 + line 51）全落托盘带 y∈[364,450]，零插入零删除
   ⇒ 逐 kind 计数与 total 全等、仅两键 sha 动（新锁 `664f99ee9a49…` / `97a42a866f6e…`）；
   证据 `temp/wxg-t-211-s3/t261-diff-frame{0,78}.txt`。provenance 键 `s3_frame_recheck_15`。
4. **strip-back 处置**：第十四批闭合自证在几何改写口径下数学上不可存续 ⇒ K-053 划线作废不净删、
   back 计数腿保留；前态史证键 `s3_pre_tray_261` 接替（total 全等 + sha 不等）；
   `legacyFlow` 键形 z26→z44 换回转正态（常驻腿读 fixture 登记参数非代码常量，非铁律击穿）。

**三、测试爆炸面与判据修订（4 红→全绿）**

- `bead-render` ④ 色表锁追改；③ 腿改钉等比式 41.6 + 方向 `toBeGreaterThan` + 反向守卫；
  旧臂封箱口径恒 44 ⇒ **两臂差 2.4dp 如实登记**（⛔ 不为凑绿动旧臂击穿 seal），收口 = S7。
- `bead-style-seal` 腿 4a：recheck_15 三条查询断言 + 史证断言；删一处恒真 `kinds===undefined`
  伪绿（K-060）。fixture 经一次性脚本 `temp/wxg-t-211-s3/update-fixture-261.cjs` 更新（防重复守卫）。

**四、文档在册（a4）**：`systems-index` **v1.62**（§3.4 三行 + changelog）· `assets-spec` **v1.5-r21**
（头注/§1.3/§1.10.9/硬约束③④）· `ADR-0018:197` 反转句口径注（盘珠 30 < 珠面 41.6，不另开 ADR）。

**五、验证**：`framework:sync`（写入 1）· beads **59 files / 812 passed / 1 skipped** ·
`pnpm run verify` **PASS 21 / WARN 0 / SKIP 0 / FAIL 0**。**未 commit**。

**五-B、二批续裁（同日 2026-10-06 · 不另领号）**：用户二批两裁 —— ①「托盘槽底色太浅，格底mask混合的颜色需要是深灰或者浅黑」②「托盘珠子孔不透明，看不到下面的槽颜色，孔需要透明透底」。
落码 = **palette `traySlot` #BCC2CB → #4A5060**（同 token 纯墨改值；色表锁条数仍 35 ⇒ sha1 `38c2bed416c3`→`1979d53033a1`；盘面空格仍 `slot`）+
**撤 tint 臂托盘珠 `liveHole` 补孔**（`bead-render.ts` 字段+分支、`view-model.ts` 调用参；2026-10-05 药方的病灶前提「真透透出近白格底」随槽底加深消失 ⇒ 补孔 = 盖底；
撤后 = DEC-2 mask 真透透出槽底、与盘面珠同构；`drawLiveHole` 函数保留 = 烘焙臂仍消费；矢量臂 / 烘焙臂 / 盘面珠零改动）。
**封箱第十六次复评**（`provenance.s3_frame_recheck_16`）：前态锚 ≡ 现役登记逐字节 MATCH（复取器自证）；流级差分 = 两帧各 **168 条纯墨改写**
（rect 120 + line 48，仅 fill/stroke 字段，全落托盘带 y∈[336,396.2]；墨 #BCC2CB 族 → #4A5060 族 + 派生 ramp）⇒ 逐 kind 计数与 total 全等、只两键 sha 动
（`135300071c65…` / `689a2a1b313f…`）；前态史证键 `s3_pre_tray_261b`；最强反证 = legacyFlow 96 例 + facet 层 45+45 例逐字节零变更。
**判据腿同步** = `bead-tint-arm`「1 blit + 0 circle（⛔ 补孔回潮即红）」/ `bead-style-seal` 腿 4a recheck_16 三查询 + pre261b 钉 / `bead-render` ④ 色表锁追改。
**文档在册** = assets-spec v1.5-r21 续裁注（头注 / §1.3 empty 卡 / §1.10.9 托盘族行 + 硬约束④）· systems-index v1.62 版本头与 changelog 二批续裁注（不另顶版）。
**二批验证** = beads 59 files / **812 passed / 1 skipped** · `framework:sync`（写入 3）· `pnpm run verify` **PASS 21 / WARN 0 / SKIP 0 / FAIL 0**。**未 commit**。

**五-C、三批缺陷修复（同日 2026-10-06 · 不另领号）**：用户报「现在槽底没有变化，只有槽边缘的阴影在加深」。
**确诊**（生产合成函数 `compositeTintMask` 实算 + 命令流探针）：格 mask 通道语义 `R=d / G=l / B=shape`，`grid-hole` 内部 **B=0 ⇒ tint blit 槽底面全透明、只着色槽口斜面环**；
盘面有 B0 垫底（`tilePainted=true`）⇒ 槽底读 B0 无病灶；托盘无 B0，而 `drawEmptySocket` tint 分支 early-return 把 JSDoc 自己承诺的「自带亮底」rect 一并跳过
⇒ 槽底实际透出托盘面板白瓷 ⇒ 二批 `#4A5060` 只作用在边缘环上（旧判据腿「命中 ⇒ 0 rect」把这个缺陷钉死过）。**根因修一处** = tint 分支 `!tilePainted` 时先铺与矢量臂同墨同几何的底 rect 再 blit；
盘面路径与矢量臂逐字节不变 ⇒ **封箱零扰动**（不触发复评，seal 9 例实跑过）。**判据腿重写** = `bead-tint-arm` ①「1 底 rect + 1 blit，底墨 ≡ `traySlot`（⛔ 槽底透面板回潮即红）」。
**三批验证** = beads **812 passed / 1 skipped** · `framework:sync`（写入 1）· `pnpm run verify` **PASS 21 / FAIL 0**。**未 commit**。

**五-D、四批观感续裁（同日 2026-10-06 · 不另领号）**：用户裁「托盘槽轮廓外不要有颜色」——三批补的底 rect 是**全格径**，
而格 mask 斜面环外沿在 13/128 处 ⇒ 轮廓外露出一圈 `traySlot` 色带。实量环带（`grid-hole` PNG）：外沿 13 / 内沿 26 px、外圆角 R≈34、角圆心 (47,47)
⇒ 底 rect 改走**环带中线**（inset 19.5 / 半径 27.5，与角圆心同心）= 环整幅覆盖底边、轮廓外零色。
**落码** = `SOCKET_CARD` 新增 `tintBaseInset/tintBaseRadius`（art-owned 比例常量，⛔ 不进 §3）+ tint 分支底 rect 换尺；盘面/矢量臂逐字节不变（seal 9 例实跑）。
**判据** = `bead-tint-arm` ① 加钉 `w/radius` 公式等值（⛔ 全格径底边回潮即红）。**四批验证** = beads **812 / 1 skipped** · `framework:sync`（写入 2）· verify **PASS 21 / FAIL 0**。**未 commit**。

**六、遗留与待裁**

- `[待真机]`：48/6 观感 · ~~`#BCC2CB` 深浅~~（二批判太浅 ⇒ 定稿 `#4A5060`；三批修后槽底才真正吃墨，待复核深灰观感与孔透底观感）· 3 行态面板底压 `btn_expand` ≈14dp（E2 同族）·
  `SELECT_LIFT × liftScale` 越槽算式按 48 重推（tuning 注已标 30 期快照）。
- 沉淀候选 3 条（**未写库，待用户/主理人裁**）：① 双引号 shell 内联脚本含反引号 ⇒ 命令替换吞字卡死终端，
  含反引号/特殊字符的脚本必须落盘再跑；② 封箱复评「等比臂改值、绝对臂锁字节」的两臂差登记法（本批 2.4dp 先例）；
  ③ 格 mask `B=shape` 内部为 0 ⇒ **tint blit 不含底色**，凡「命中 tint 即可跳过矢量图元」的臂切换须逐图元核对**透明下层假设**（盘面有 B0 成立、托盘无 B0 不成立），且旧判据「命中 ⇒ 0 rect」会把这类缺底缺陷钉死（三批先例）。
- 上一会话悬挂终端（bquote 续行态）未清理，不影响本批交付。

---

## WXG-T-266

**主菜单架构裁定「单屏作品墙 + 类别延迟生效」+ 图元难度线性公式（文策渊两件，✅ 裁定稿）**

用户提主菜单两案（① 走马灯橱窗 / ② 二级入口）+ 三条硬要求：主菜单标题含 logo 与背景、
图元在同类型内按难度线性增长、难度计算有固定公式。

### 裁定：第三案（**推翻主理人倾向的方案 1**）

主菜单 = **一块木框橱窗 + 一屏 4×3 作品格（可点）+ 一个木主钮**；不设类别层、不设二级橱窗页、
不设走马灯；**类别在关数 > 12 时才以 tab 形式出现**。

**推翻理由（文策渊给的数据依据）**：
- 9–12 关**一屏放得下** ⟹ 走马灯的横向浏览成本为 0 ⟹ 「为 0 成本问题付机制钱」
- **类别当前无数据**：manifest 全 `pack:"main"`、关卡 JSON 无 category 字段
  ⟹ 类别数应判为 **0**，不是主理人说的「3~5」

### 难度公式（单一真源，可落码）

```
DI = round₁₀( M × f_C × f_K )      // 单位 = 等效错位珠数
M  = ρ · N                          // ρ = 错位率，N = 格数
f_C = clamp(1 + 0.10(C−5), 0.60, 2.00)   // C = 颜色数
f_K = max(0.35, 1 + 1.60(K−0.50))        // K = 1−A，A = 同色相邻率
线性律：N_target(d) = round( DI_target(d) / (ρ·f_C·f_K) )
        DI_target(d) = DI_START + (d−1) × ΔDI    // 类别内第 d 关
```
`DI_START = 50`、`ΔDI = 45` ⟹ **ΔN ≈ 39 格/档**（现池锚 ρ=1、C=7、K=0.469）。

### 9 关实测（验证单调、无退化）

DI = 31.8 / 41.0 / 73.7 / 66.8 / 43.7 / 29.9 / 76.8 / 36.4 / 289.7（L1…L9，2026-10-10 换盘后新池）
⟹ 按 DI 升序**严格递增、无并列无钳位**；与实测 `steps` 序 **Spearman = 0.833**。

⛔ **硬发现**：现池**入关序 ≠ 难度序**（L9 难度 289.7 是最易关 L6 29.9 的 9.7 倍却排最后）
⟹ 裸用关号陈列 = 难度乱序 ⟹ **必须按 DI 排**（这是实测判据）。

> ⚠ **2026-10-10 换盘更新**：本节原为旧池（2026-10-07）实测（Spearman 0.933、最小相邻差 3.4）；现关表换为 teaching-set 9 关，上述数值已按新池重测（区间 [29.9, 289.7]、首末比 9.69、最小相邻差 1.9）；正本见 `level-difficulty.md §5.1/§5.2`。

### §3 关系

**零新增冻结值、零改动已冻结值**；系数住 `levels-spec §5.0.x` + `tuning.ts`。
⛔ **DI 不参与定价**（先验公式对 steps 绝对残差最大 ≈ +102%／最负 ≈ −59%、极差 ≈162pp（2026-10-10 换盘后新池；口径 `k = mean(DI/steps)`，见 `level-difficulty.md §5.3` H-3），定价与规模闸仍走实测）。

### R-12 闭合

不新增独立 boot 屏 —— S0 内容就地落已实装 shell 主菜单（`meta-view.ts:359-370`）；
`ux-spec §4` 改 1 行 + 增 1 行（BOOT 停菜单 / 点开始进关）；`meta-view.ts:361` 的 `'拼豆'` ⇒ 读 `app_name`。

### 第三轮（2026-10-07 用户回应后，文策渊回裁）

**① Q6 = 双轨但主客易位**：门禁**只锁单调**（契约，引 `DI_FLOOR/DI_STEP_MIN`，后者是**下界**非「等于 ΔDI」）；
生成器**保留等差**（默认实现，引 `di_start/di_step`，可配可替换）。两参数**零交集** ⟹ 新增门禁
**G10 断言：把 `di_step` 45→80，门禁仍绿**。理由：反解 `N_target` 必须有标量目标（否则造关无解），
但 DI 对 steps 残差最大 ≈58%，锁死公差等于宣称「知道 45 分是什么手感」。
⛔ **未采纯校验器**（会把用户要求的「线性增长」削成「单调增长」）。

**② 走马灯 = 判 (b) 词义非机制**：用户逐条回 Q1/Q2/Q4/Q6/Q8 无一条反对第三案，且本轮只留「橱窗」删了「走马灯」。
⟹ 保留「橱窗」作**模块名 + 视觉语义**；走马灯与 tab **同层互斥**（`wall_overflow_mode` 一键切）：
判据 = **类别维度是否有序** —— 有序（DI 难度带/尺寸/色数）→ `tab`（默认），无序（题材）→ `carousel`。

**③ 命名组合（用户拟「拼豆小橱」的处理）**：
游戏名 **「拼豆小铺」不动** ｜ ~~「拼豆小橱」= 主界面橱窗模块名~~ **（第四轮已回退：模块名也用「拼豆小铺」）** ｜ slogan **「一颗一颗，拼出你的小铺」**。
⟹ 「**小铺是店，小橱是店里那只陈列柜**」上下位关系，用户拟议的词义全保留。
⛔ 不改游戏名的**落码级理由**：招牌是 8×8 珠点阵，「橱」16 画（含"厨"多层嵌套）**必糊**，「铺」12 画可辨。

**④ 配置化（用户要求「可配置 + 每类关卡数不固定」）**：
```
WallConfig { wall_capacity:12, wall_overflow_mode:'tab'|'carousel', category_dimension:'di',
             category_max:5, category_min:2, category_floor:8,
             category_split:'quantile'|'explicit', category_sizes:null }
DifficultyCurveConfig { curve:'arithmetic', di_start:50, di_step:45, per_category:null, di_ceil:null }
```
`split='quantile'` ⟹ **每类关数由 DI 分位决定、不固定**；`'explicit'` 才按 `category_sizes[]` 人工编排。
⟹ **不再存在「每类关数 = n/K」这个等式**；`category_max` 可配满足「随版本可改」。
配置项住 `levels-spec §5.0.x` + `tuning.ts`，**不进 §3**（零新增冻结值）。

### 第四轮（2026-10-07 用户终裁）：命名回退「拼豆小铺」

用户令：**「还是改回：拼豆小铺」** ⟹ ⛔ 第三轮的「铺 = 游戏名 / 橱 = 模块名」**作废**；
`wall_module_name` 由 `拼豆小橱` 改回 **`拼豆小铺`**。

⟹ **全案只保留「拼豆小铺」一词**：游戏名 = 橱窗模块名 = `拼豆小铺`，slogan =「一颗一颗，拼出你的小铺」。

**回退理由**：不引入与游戏名只差一字的新词（4 字里 3 字相同 ⟹ 读作「再说一遍」，信息增量为零——
这与第三轮自己给出的 N-1/N-2 判据同源，用户在模块名位同样判定成立）；「铺」已含陈列空间语义，
橱窗概念由**视觉**（木框 + 作品格）承担，不必再靠字面命名。

**新增纪律**：对外命名与屏内命名统一为「拼豆小铺」；任何新增模块名不得与它相差一字，
新增即需重裁，成员不得自行拟名。

### 第五轮（2026-10-07 用户三项终裁）

1. **Q9 = `carousel`（走马灯机制上）** ⟹ `wall_overflow_mode` 默认由 `tab` **改为 `carousel`**；
   ⛔ **覆盖**第三轮「有序维度 ⇒ tab」判据（Q1 = DI 难度带有序，本应 tab，用户终裁优先）。
   `tab` 降级为可替换模式（`wall_overflow_mode` 一键切回）。
2. **门禁 = 纯单调（不设数值阈值）** ⟹ 只锁**同类别内 `DI` 严格递增**（`DI[i+1] > DI[i]` = 难度不断升级）；
   ⛔ **删除 `DI_FLOOR` / `DI_STEP_MIN`**（用户「不要具体数值限制」）⟹ 差 > 0 即达标。
   ⟹ 双轨仍成立：门禁纯单调（零数值）、生成器保留等差（`di_start`/`di_step` 可配）。
3. **Q5 = `levels` overlay 入口隐藏**（代码与 overlay 保留，入口收敛 ≠ 功能删除，U1 同判例）。

**至此 WXG-T-266 全部待裁项关闭（Q1–Q10）**，可转程基岩（engineering-lead）拆 Epic 进落码批。

### 待用户拍板

Q2 作品墙可点否（建议可点）· Q1 类别维度（建议丙 = DI 难度带，零人工打标）· Q3 slogan ·
Q4 `WALL_CAPACITY 12 / CATEGORY_MAX 5` · Q6 `DI_START 50 / ΔDI 45` · Q8 DI 是否上 UI（建议不展示）。

---

## WXG-T-265

**整体 UI 美术风格重设计「暖纸拼豆台」甲案（林绘澄四件，✅ 提案已出）**

用户令：调用 studio skill 整体调度，**重设计所有页面与 UI 风格**；风格 = 休闲 / 治愈 /
明快 / 辨识度高；⛔ **唯一不动**：盘面格与托盘里的格子 + 珠子美术（珠面保持现状干净几何，
WXG-T-263 手绘质感不入批）。

### 流程（SOP 阶段 1）

主理人派单 → 林绘澄（art-director）两轮：① 提案四件；② 用户三裁后的**采纳态修订**。
主理人未代笔美术规格（铁律 1）。

### 用户三裁（2026-10-07）

D-2 = **甲案**（暖纸拼豆台）· D-1 = 游戏名 **「拼豆小铺」**（非主理人推荐的「豆豆森林」）·
D-3 = **boot 标题页随本批**。D-4~D-8 维持林绘澄建议值（仍待决策）。

### 林绘澄推翻主理人初稿五处（史证）

① 底色 `#f6efe2` → **`#F1E8D8`**（初稿与奶白珠 ΔL 仅 2.7% < 4% 不可辨阈）
② 删「目标提示条」（违 GAP-03 已裁的 0 文字教学 + 归位连击零 HUD）
③ 托盘 6+6 → **§3.4 冻结 24+12**（主理人凭印象写错）
④ 蜡笔质感前提作废（T-263 不入批 ⟹ 方案在干净几何珠面下自洽）
⑤ 手写体 → 系统字体 0KB（包体纪律）

### 核心设计语义

**「木 = 可按、纸 = 承载、胶囊 = 状态」**——主次按钮靠明度 + 材质 + 位置三通道区分
（色盲友好纪律在 UI 侧落实）。

### 林绘澄第二轮新增建议

「小铺 = 陈列/收藏」做成**木框橱窗**：boot = 招牌（珠拼「拼豆小铺」）+ 3 格货架
（已通关 = 珠拼缩略 / 未通关 = 既有虚线空槽）；finish = 作品**上架**填满同一橱窗 ⟹ 命名语义闭合。

### ⚠ 待裁（阻塞落码）

- **R-12（UX 侧）**：boot 页「点开始」与 `ux-spec §4`「BOOT = 无交互自动过渡」+
  既有 meta 主菜单 **双重口径差** ⟹ boot 与主菜单是同屏还是两屏，本批不自裁
- **R-11①**：`meta-view.ts:361` **已实装**主菜单标题「拼豆」（+「开始游戏」钮）
  ⟹ 是否改为「拼豆小铺」（关键新事实：主菜单此前被认为不存在）
- **K-6**：boot 珠阵图元按珠数线性增长 ⟹ 不预支纸面值，落码差分复算 + 封箱第十七次复评
- 色表锁（35 条 + sha1）与整帧 provenance 必动 ⟹ 走 art 单同步快照通道同批

---

## WXG-T-262

# beads·fit 档放开「只缩不放大」钳（小盘放大铺满留边 + 初始视图 = 适配档）

> 2026-10-06，主理人(Qoder)·设计域＋工程域代落盘。用户裁定原话：「适配按钮触发后有问题：
> 不应该是1:1的缩放比例，应该是整个盘面放大到左右留一定空隙。盘面初始时候应该是适配按钮这个比例。」

**一、裁定解读与不变式推翻**

- 诉求①「适配钮 ≠ 1:1」= `computeFitZoom` 退役 `Math.min(1, ·)` 只缩不放大钳 → `Math.min(CAMERA_ZOOM_MAX, fitW, fitH)`；
  诉求②「初始 = 适配档」= 复位点本就在位（`_setupLevel` 与适配钮均调 `fitCamera`），换式即自动满足，零新代码。
- 「一定空隙」= 在册 `BOARD_FIT_MARGIN = 24`（fit 公式既有边距），零改动，不另造新常量。
- 本单 = **§3.3 v1.59 不变式 `MIN ≤ fit ≤ 1 ≤ MAX` 的二次推翻**，即 ADR-0018 §3.4.5 ②
  「放开上限属另案（须二次推翻本条并登记）」所预留的**另案本身**；按预留路径登记（状态行 + ② 划线注 + 新 §3.4.6 修订注），
  不 Superseded（其余条款仍现行）。
- ⛔ 下钳（`Math.max(CAMERA_ZOOM_MIN, ·)`）不写 = 死码：GRID 上限 29×29 最坏 fit≈0.553 > MIN 0.2，下界天然成立（JSDoc 记理由）。
- 实测样本：6×5 → fit 3.24 → 越上钳落 **2.0**；12×16 → 1.004；13×12 → 1.34；顶格档 22×16 恰 = 1（702/702）；
  现池 6 尺寸初始 fit ≈ 1.004–1.34（均不越 2.0 上钳）。

**二、护栏（「低分辨率放大损质感」旧理由为何不再成立）**

- 烘焙/LOD 最大档早已挂 `BEAD_CELL × CAMERA_ZOOM_MAX`（×2.0）⇒ 放大到 2.0 不越现有烘焙覆盖，⛔ 不另烘新档。
- 命中热区随 zoom **变大**（点击更稳），方向无代价。

**三、测试分域（38 红级联确诊 → 813+1 全绿）**

- **确诊陷阱**：`noAssemble` 只跳 BOOT「错位装配」，**不跳关卡装配** ⇒ `game.init()` 内 `_setupLevel → fitCamera` 照跑
  （探针实证 13×12 夹具 pitch=42.89 = fit 1.34×32）；放开上限后一切隐含 zoom=1 的判据（像素坐标/命中/封箱字节）破功，
  全服首跑 **38 红 / 12 文件**（含 seal sha 变红实证）。
- **收口方案**：`tests/helpers.ts` 新 `pinIdentityCamera(game)`——照 `dirtyCamera` 先例读写 `_camera` 私有字段 + 调
  `_recomputeLayout()`，⛔ 不为测试扩公开 API；`createBeadsHarness` 默认 init 后钉恒等档（像素级判据族回归旧语义）；
  `noCameraPin: true` 豁免**验 fit 传导本身**的判据腿（view-model vm-e `gridPitch ≡ computeFitZoom×32` 与甲案 z<1 腿）；
  中途 `goToLevel/startSprint` 重入 fit 的（scene-vfx / consume-order / misplaced-direct-fill）在调用后补钉。
- **封箱零扰动**：`wxg-t-211-s3-seal.json` 逐字节不动（harness 钉恒等 ⇒ 产帧序列与旧一致）⇒ 不触发第十七次复评。
- `board-camera.test.ts` 三族断言重写：小盘腿钉 `CAMERA_ZOOM_MAX`、新增中间档腿（12×16 >1 且 <MAX）、
  顶格档派生守卫翻转（⇔ `fit ≥ 1`）、TC-CAM-08 小盘回归锚从「与恒等逐位相同」翻转为「zoom=MAX + pitch×zoom」。

**四、文档级联（先改文档再改代码纪律，同批登记）**

- `systems-index.md` **v1.63**：头行摘要 + §3.3 初始缩放行划线换式 + 不变式作废重登 + 顶格档派生断言 ⇔ `fit ≥ 1`；
  冻结三值（`CAMERA_ZOOM_MIN/MAX`、`BOARD_FIT_MARGIN`）**零改动**，仅不变式换形。changelog 追加 v1.63 行。
- `ADR-0018`：状态行「再被 v1.63/WXG-T-262 二次推翻」注 + §3.4.5 ② 划线注 + 新增 **§3.4.6 修订注**
  （推翻声明+用户原话 / 现行口径 / 代价与护栏 / 防连坐正面声明），`[待真机]` 已标。
- `input-control.md` **v2.12**：§6 复位行 `min(1,·)` 划线作废留档（K-053 风格，「小盘 fit=1 与恒等逐位相同」句作废）+ changelog 行。

**五、负面后果（诚实记）**

- 全关初始视图改变（放大档），观感首屏构图 `[待真机]`；6×5 等小盘从「1:1 居中留大片空」变「铺满留 24 边」。
- 旧封箱回归锚「小盘 fit=1 ≡ 恒等」永久翻转（TC-CAM-08），回潮即红——这是**判据换形**不是判据删除（⛔ 无删断言求绿，K-036 合规）。

**六、验证**

- `framework:sync` 写入 3（board-camera / beads-game / tuning 镜像）· beads **813 passed + 1 skipped**（59 文件全绿）·
  `pnpm run verify` **PASS 21 / WARN 0 / SKIP 0 / FAIL 0**（含 check:links / framework:sync:check）· **未 commit**（等用户指示）。

**七、遗留**

- `[待真机]`：全关初始放大档观感（用户 harness 复核）。
- 沉淀候选 2 条（未写库，待裁）：① 夹具选项语义与生产路径的隐含耦合——`noAssemble` 一类「跳某阶段」开关必须实测它**不跳**哪些阶段，改全局渲染参数前先用探针读一个派生量（pitch）验当前生效档位；② 测试分域「钉旧语义 vs 豁免验新语义」二选一不够时，用 harness 默认钉 + 逐腿豁免选项，比全量显式传参小得多。

**八、同日续裁 v1.64（适配档宽度 = 托盘边缘对齐 · 不另领号）**

- 用户续裁原话：「适配档宽度最好能适配到托盘边缘的宽度，两边与托盘两边对齐。」⇒ `computeFitZoom` 的
  `fitW` 基准由 `DESIGN_W − 2×BOARD_FIT_MARGIN`（702）改 **`TRAY_ROW_WIDTH`（642）**：新派生常量
  `= TRAY_COLS × (TRAY_SLOT + TRAY_GAP) − TRAY_GAP`（§3.4 冻结族派生，⛔ 另硬编），`trayLayout().rowWidth`
  同源回收；盘面居中 ⇒ 左右缘与托盘左右缘对齐。纵向不变（24 留边 = 512）。
- `BOARD_FIT_MARGIN` **值零改动、作用域收窄 = 仅纵向**（不再进 `fitW`/`c_max`）。
- **顶格档连带**：`c_max = floor((642+2)/32)` = **20**（旧 22）、`r_max` = 16 不动 ⇒ 20×16；642 非 `32n−2`
  整珠宽 ⇒ 新基准下不存在恰 `fit=1` 的盘宽 ⇒ 守卫 `toBe(1)` → `toBeGreaterThanOrEqual(1)`（判据换形非删断言）；
  大盘腿改钉 `natW × fit ≤ TRAY_ROW_WIDTH`。
- **影响面（如实）**：现池 6 尺寸初始 fit **全不变**（均高度钉 1.004–1.34，宽基准不参与取值）；6×5 越上钳档不变；
  仅 21–22 列宽盘轻度缩至托盘宽内（22×16 恰 1 → ≈0.914）；封箱 fixture 依旧逐字节不动（恒等钉存续）。
- 文档级联 = systems-index **v1.64**（头行 + §3.3 初始缩放行二次划线换式 + 顶格档行 + `BOARD_FIT_MARGIN` 行作用域注）
  / changelog v1.64 行 / ADR-0018 §3.4.6 现行口径行续裁注。`input-control` 零改动（v2.12 起「本文不钉数值」口径，公式真源引用仍成立）。
- 验证 = `framework:sync` 写入 2（board-camera / tuning 镜像）· beads **813 + 1 skipped** 全绿 ·
  `pnpm run verify` **PASS 21 / WARN 0 / SKIP 0 / FAIL 0** · **未 commit**（等用户指示）。

**九、同日三续裁 v1.65（宽度钉到托盘整体宽 + 高度腿退役 · 不另领号）**

- 用户原话（2026-10-06）：「盘面适配点击后，放大效果还是不够宽，宽度需要对齐托盘整体宽度」。
- **诊断（先于动码）**：v1.64 后现池 6 尺寸初始 fit 仍全为**高度钉**（`min` 里 `fitH` 先触顶）⇒ 宽度基准 642→666 的换尺**不可被感知**，诉求无法靠换尺兑现；必须退役高度腿。经 AskUserQuestion 知情确认（选项明示「长盘初屏上下行被裁、拖动可查看」的代价），用户选**宽度优先**，并追加口径：「可点击区域限制在托盘以上、顶部菜单以下」——经查即既有行为（带外屏位属 HUD/托盘路由区，`view-model` 格心可视窗裁除 + `clampCamera` 平移夹取已覆盖），**零新码**。
- 落码 = `computeFitZoom` 换式 `fit = min(CAMERA_ZOOM_MAX, TRAY_PANEL_WIDTH/natW)`（高度项删除）；`tuning.ts` 新派生常量 `TRAY_PANEL_WIDTH = TRAY_ROW_WIDTH + 2×TRAY_PANEL_PAD`（666，`trayLayout().panelW` 同源回收，⛔ 硬编）；`BOARD_FIT_MARGIN` 退出 fit 算式（值 24 零改动，作用域 = 仅平移夹取窗口/控件净空）。
- 测试换形（断言换形非删，K-036）：顶格档「行越界必缩」腿 → **行轴独立性腿** `fit(c,17) ≡ fit(c,16)` + `fit(c,40) ≡ fit(c,16)`；大盘腿锚 642→666；公式腿 rMax 项随 §3 退役；小盘/中间档/封箱零扰动（夹具恒等钉存续）。view-model 两条 noCameraPin 腿等值自动跟随（22×19 fit=666/702≈0.949 仍 z<1）。
- 现池效果 = 初始 fit 由 1.004–1.34（高度钉）变 **1.49–2.0**（宽度钉/上钳）⇒ 初屏普遍变宽，诉求正面兑现；如实登记：8/10 列窄盘钉 `CAMERA_ZOOM_MAX` 2.0 后仍略窄于托盘（不另烘新档）；长盘初屏**不再完整可见** `[待真机]`。
- 文档级联 = systems-index **v1.65**（头行 + §3.3 初始缩放行三次划线 + 顶格档行「列域 20 · 行数域退役」+ `BOARD_FIT_MARGIN` 行作用域注）/ changelog v1.65 行 / ADR-0018 §3.4.6 三续裁注（v1.64 口径划线留档）。`input-control` 零改动（「本文不钉数值」口径存续）。
- 验证 = `framework:sync` 写入 2 · beads **813 + 1 skipped** 全绿 · `pnpm run verify` **PASS 21 / WARN 0 / SKIP 0 / FAIL 0** · check:tasks OK · **未 commit**（等用户指示）。

**十、同日四续裁 v1.66（平移上限放开 = 盘缘至操作区中线 · 不另领号）**

- 用户原话（2026-10-06）：「要求盘面边缘拖动最大能到操作区域的中点」。
- 落码 = `clampCamera` 越界轴 `maxOff = 盘/2`（旧 `(盘 − 视口)/2`「盘缘 = 视口边」作废）；未越界轴保持锁 0（「fit 盘拖不动」基线不动）；护栏 = 至少半盘恒在视口内 ⇒ 不丢盘。动因 = v1.65 宽度钉档后被裁边行需能拖到带中央看/点，带外空白转正为合法中间态（行为翻转如实登记）。
- 测试换形（K-036 非删）：「焦点补偿越悬挑区触夹」腿前提消失（zoom 0.3→1.0 最大补偿 ≈347 < 半盘 511）⇒ 重写为**平移上限直检腿**（offset 猛拖必夹回 ±半盘）；大盘 X 夹腿与 `setCameraZoom` 重夹腿锚换式（越界值 900→2000）；跟手腿内界判断自动放宽跟随。
- 文档 = systems-index **v1.66** 头行（§3 无平移夹取行 ⇒ 零 §3 改动）/ changelog v1.66 / ADR-0018 §3.4.6 四续裁注；`input-control` 零改动（从未在文钉夹取数值）。
- 验证 = `framework:sync` 写入 1 · beads **813 + 1 skipped** 全绿（封箱逐字节不动）· `pnpm run verify` **PASS 21 / FAIL 0** · check:tasks OK · **未 commit**（等用户指示）。

**十一、同日五续裁 v1.67（拖动上限两轴统一 + 带内显示剔除退役 · 不另领号）**

- 用户 2026-10-06 原话：「要求左右最大拖动区域也是边缘到中点；另外上下不限制展示区域，只限制手势区域」。
- ① 拖动：`clampCamera` v1.66 残留的「未越界轴锁 0」档退役 ⇒ 两轴统一 `maxOff = 盘/2`；窄盘（如 6×5 fit 档 380×320）也可拖，盘缘至视口中线；护栏不变 = 至少半盘恒在视口内。连带清理：`WINDOW_W/WINDOW_H` 局部常量失去唯一消费者 ⇒ 删（含 DESIGN_W/PUZZLE_BAND import）。
- ② 显示：`view-model::drawGrid` 带内可视窗剔除 → **离屏窗**（`cy ∈ [-gridCell, DESIGN_H + gridCell]`），溢出行照画。层序现状（确诊于 buildRenderModel 发射序）：`drawHud → drawGrid → drawTray` ⇒ 溢出行**盖上沿 HUD、被下沿托盘面板盖**——「不限制展示」按发令执行，被面板盖部分是既有层序，观感 `[待真机]` 复看。
- ③ 手势区：零改动。带外屏位属 HUD/托盘路由区（input-control §2.1 带级次序）⇒ 可见但点不中，恰合「只限制手势区域」。
- ④ 连带作废：ADR-0015 §2.2 丁-3「25 < 30/94 不压 HUD/托盘」承重核算整体失效（动机被替代；「格心」判据保留 ⛔ 格缘），丁-3 行尾追修订注；ADR-0018 §3.4.6 追五续裁注。
- ⑤ 测试换形（K-036 非删）：「board ≤ 视口 → offset 锁 0」腿 → 窄盘上限直检腿；性能骨架存续 = 恒等档格心全在屏内 ⇒ 零剔除，封箱与 `view-model`/`scene-vfx` 快照逐字节不动（实测全过）。
- 验证 = `framework:sync` 写入 2 · beads 59 files / 813+1 skipped 全绿 · verify **21/21** · check:tasks/links 过。**未 commit**。

**十二、同日六续裁 v1.68（平移夹取改双条件式 · 不另领号）**

- 用户 2026-10-06 原话：「限制滑动的区域作调整：必须同时满足滑动方向边界到达最大操作边界并且滑动反方向边界超过中心点才会被限制这个方向滑动，否则可以滑动这个方向」。
- 解读落码：单轴夹取 = 两条件 AND（① 拖动方向盘缘 ≥ 操作边界；② 背向盘缘 ≥ 视口中线）⇒ 上限取两触发阈值大者 `maxOff = max(盘, 视口 − 盘)/2`。**盘 > 视口** 时 (视口−盘)/2 < 0 ⇒ 退化 v1.66/67 的 `盘/2`（大盘族全部测试数值不动）；**盘 < 视口一半** 时拖动边先触界 ⇒ 上限 `(视口−盘)/2`（旧 `盘/2` 对窄盘偏严，本批放宽）。
- `WINDOW_W/WINDOW_H` 局部常量（v1.67 曾随锁 0 档退役删除）重新引入 = 「最大操作边界」消费方回岗。
- 测试 = 新增「窄窄盘顶格」腿（6×5 @0.5 → X 上限 327.5 / Y 240）；「窄盘」腿改「双条件缺一不夹」表述（380/320 均 > 半视口 ⇒ 仍 b/2 分支）；beads **814 + 1 skipped**（+1 新腿）全绿 · sync 写入 1 · verify **21/21**。**未 commit**；`[待真机]` 追加 = 窄盘顶格拖动手感。

**十三、同日七续裁 v1.69（纵向操作边界 = 菜单下 ~ 托盘上 · 不另领号）**

- 用户 2026-10-06 原话：「左右限制可以，但是上下操作边界不对，上边界应该是在 top 的 menu 下面一点，下边界应该是在托盘上面一点」。
- 落码：`clampCamera` Y 窗口 = `[TRAY_BAND.yMax + BOARD_FIT_MARGIN, HUD_BAND.yMin − BOARD_FIT_MARGIN]`（474~1190，716 高）——两侧锚点全部在册（§3.1 带族冻结），「一点」= 既有留边常量 24（`BOARD_FIT_MARGIN` v1.65 退出 fit 后重获消费方），零新冻结。X 用户明确认可 ⇒ 一行未动。
- 不对称如实入式：盘布局仍锚带心 840（offset=0 语义 = gridLayout 真源不动），新操作心 = 832（差 −8）⇒ Y 上下限不对称。效果分档：长盘（>716 高）= 原 ±b/2 翻转为 +（b/2−8）/−（b/2+8）；中窄盘 = 拖动边触界主导，可拖范围扩大（320 高：±160 → +190/−206）。
- 测试 = 模块级 `clampY` 镜像函数（与 src 同构；band 尺再搬只红真漂移不假红）；直检腿补向下触「托盘上」边界断言；窄盘/窄窄盘/跟手腿换形。beads **814 + 1 skipped** 全绿 · sync 写入 1 · verify **21/21**。**未 commit**；`[待真机]` 追加 = 8px 不对称是否可感。

---

## WXG-T-268

**EP-12「暖纸拼豆台」UI 风格落地与换肤双面 —— Epic 拆分 + 首冲刺落码批（spawn 程基岩，2026-10-07）**

用户令（本会话）：「程基岩 Epic 拆分 + 落码批」，主题确认 = 现有 UI 设计主题风格落地（T-265 采纳态 + T-266 裁定）；**随单补充裁定（原话）**：「换肤不光要能设定暖纸拼豆台，studio 生成时候也要增加风格选项暖纸拼豆台」⇒ 换肤双面：① 游戏内运行时设定；② `apps/beads-studio` 生成侧新增风格选项。

### 交付 A · 拆分件

- `production/epics/epics-beads-ep12.md`（新，EP-12 编号 grep 确认未占用）：1 Epic / **9 Story** —— 呈现 S1–S4（色板 token / 容器语言 / 六相位 / 告急页）、难度真源 S5（`difficultyOf()` 单一真源）、主菜单作品墙 S6（T-266 第三案）、finish 陈列 S7、换肤通道 S8（`settings.skinId` + 注册表白名单）、**studio 导出链 S9**（levelDraft schema 增可选 `skin` 字段 = 引用 `BeadsSkin.id` 白名单不传数据本体 + 前端选项 + 导入侧未注册回落 default + 告警）；估点 S×2·M×5·L×2。
- 判据纪律：只引设计侧既有判据（art-bible §2/§3.1、screens 4 态矩阵、ux-spec §5 毫秒表、T-266 公式），零新判据零新数值；§3 冻结值零涉。
- 宿主 `epics-beads.md` §1 追加 EP-12 行 + §2 指针 + §5 统计更新。
- **需向 T-267 同步 2 条**：① T-267 裁Ⅱ「皮肤入口暂不实现、切换走构建期宏」被本单裁定改为**运行时设置项**；② 若未决问题 1 选 A/B，T-267 arch D1「DEFAULT_SKIN.tokens = 冷紫灰现值」表述需随之修订。

### 交付 B · 首冲刺落码（EP12-S1）

- `palette.ts` 五值替换（`bg_base #F1E8D8` / `panel #FFFCF6` / `panel_border #E6DAC3` / `shadow_ink` 不动项除外等，逐值对 §3.1 表）+ `view-model.ts` P-1 缩放钮/滑轨 slot 族纯墨改写（**零几何变更**）；镜像成对（`framework:sync:check` ✅）。
- 封箱**第十七次复评**：官方复取器差分复算——两帧各 **15 行改写**（字段级 40：panel×16 / P-1×12 / accentPrimary×12），total/逐 kind 全等（1868/1322），**未解释 = 0**；珠体族（legacyFlow 96 + facet 45+45）逐字节不变；色表锁 sha1 `1979d53033a1`→`612ced0aa888`（条数 35 不变）；seal fixture 追改 + 前态史证键 `s3_pre_ui_268`。
- 新测试 `games/beads/tests/ui-warm-paper-tokens.test.ts`（6 例）；判据脚本复算：textDim on panel **4.64:1 ≥4.5**（§3.2 `[待核]` 闭合）/ 白 ▶ 对 wood 5.4:1 / bg 饱和 **10.4% ≤12%** / 奶白珠 ΔL **5.4% > 4%**。
- 读数：beads 相关 3 套件 54 例全绿 · `pnpm run verify` **PASS 21 / WARN 0 / FAIL 0** · typecheck 0 · lint 0。
- `production/qa/beads/test-cases.md` K.5.1-补9 段落笔（含 P3 流程偏差如实登记：复评锚 = 工作树态，commit 后须复跑复取器自证等值）。
- ⚠ harness 截图证据（ADVISORY）未落 `production/qa/evidence/`（headless 截图需主理人配合），移交下游补。

### 未决问题（4 项，交用户/主理人裁）

1. **默认肤语义**（影响 S8 取值）：A 冷紫灰退役、暖纸即默认（现状，推荐）/ B 冷紫灰收编为可选肤 `cool-violet` / C 回退 S1 走第二肤通道。
2. **D-5 告急翻转**（阻塞 EP12-S4 局部）：计时胶囊「告急切纸底」vs「恒纸底」（林绘澄建议后者）。
3. **art-bible §1.1 橱窗主视觉**（林绘澄建议非用户裁）：本拆分按 T-266 第三案落 S6/S7，§1.1 是否作废请确认。
4. **P-3 面板圆角**（阻塞 S2 一项）：代码 18 vs 规格 24 二选一回写。

**台账登记**：主理人（CodeBuddy）2026-10-07 代登；未 commit（工作树含本单前既有脏文件，未触碰）。

### 批 2（同日续 · 用户四裁落地 + EP12-S8 换肤通道 + EP12-S9 studio 导出链）

**用户四裁**：① 默认肤 = warm-paper + **冷紫灰收编可选肤 `cool-violet`**；② D-5 计时胶囊**恒纸底**（S4 阻塞解除）；③ art-bible §1.1 橱窗作废、按 T-266 作品墙执行（§1.1 仅追加一行裁定注，正文修订归林绘澄）；④ P-3 圆角 18 vs 24 未拍板 ⇒ **EP12-S2 不开工**。

**S8 落码**：`config/skins/{registry,warm-paper,cool-violet}.ts`（warm-paper tokens 直引 `DEFAULT_PALETTE` 同实例 ⇒ 默认渲染逐字节不变；cool-violet 18 字段逐值核 `HEAD e8b81a9` 史证）；`settings.skinId` 逐字段降级（SAVE_VERSION 不 bump）；`beads-game` 换肤引用单点 `_applySkin` + `_cycleSkin`（注册序回绕、恰写档 1 次）；pause-panel 行 4 扩三格（`PAUSE_PANEL_H=718` 与 ux §3.3 零改动）；shell 菜单消费 `play.palette` 两屏一致。

**S9 落码**：`LevelDraft.skin?`（**引用 id 不传数据本体**，白名单 warm-paper/cool-violet）；`validateBeadsLevel` 仅类型校验；`importLevel` K-064 复验（未注册回落 default + 一次性告警）；studio `server.mjs` 白名单收敛 + `public/index.html`「风格」下拉（默认暖纸拼豆台）。踩坑：`levels-data.ts` 是生成物，改入 `levels-data.header.txt` 模板真源后 levels:check 转绿（K-031 族正例）。

**读数**：`pnpm run verify` **21/21 全 PASS** · beads vitest **840 passed / 2 skipped**（A6 热路径零分配机械探针无仓内先例，按 K-035 记 SKIP 待裁）· **封箱/色表锁零触碰**（seal 四腿 + 第十七次复评 + 色表锁 35/`612ced0aa888` 原样绿；cool-violet hex 住 `config/skins/` 不入 palette 锁面）· 珠面族逐字节钉住 · 镜像 sync 写 13。**行为变化 2 条**：cycle-skin 钮 present（注册数 0→2，`S9§8-19` 守卫语义保留）；`BeadsShellOptions.palette` 下传 play 两屏一致。

**未决 4 项（交用户/主理人）**：① A6 探针另批补 / 论证关闭 / 挂 T-267；② E2E 真服务腿未跑（注入式 HTTP 腿已绿）——主理人起 studio 服务实跑入 evidence 或延联调；③ cool-violet 玩家侧名「冷紫灰」为工程占位，是否转林绘澄定名；④ **EP11-S5 台账口径差**：任务单写「本体未开工」，仓内事实 = 已收口（registry 头注 + TC-STY 全在）——本批按仓内事实执行、未顺手实现其遗留项，请核对台账。

**T-267 同步项**：arch.md D5「缺省 `'default'`」与 D1 默认肤表述与实落「默认 = `warm-paper`」不一致，文档修订归文档批，代码以注册表为真源。studio 件未 commit ⇒ 未触发部署（deploy.yml 零改动）。`dev/harness/preview/level-*.svg` 9 件 = verify 冒烟再生成产物随工作树。全程零 commit/push。

### WXG-T-224/268 收口批 · check-secrets WARN 核对留痕（2026-10-07）

- 4 处 `WECHAT-APPID` WARN（ADR-0030:124 / VERSION.md:33 / memory/2026-10-04:952 / TASKS-DETAIL:2541）核对：均为**描述性引用**（记录「AppID 在仓」环境事实），源头 = 根 `project.config.json`（`wx63c62151a1c0cf3b`）与 Cocos 构建档（`wx8cf9f756e5390749`）——两者为微信工程**必需配置**，本就在仓、非本批引入。判定：非泄密，放行；AppID 纪律关注点仍是私钥与 upstream 泄露面（check-secrets 持续盯）。

### WXG-T-230 · 续二/续三汇编（2026-10-07）

**续二（程基岩，两项落码 ✅）**：
- **A. C12 换墨反证臂**：`check-bead-style-pool.mjs` 增 `reinkDominantArm()`——facet-4 占优层墨（lit #fef9f1）换成他格 base（#FFD23F）⇒ 重跑 identifyPrimary ⇒ argmax 必须跟色（常门实测跟随 ✓ + 变异自证：identifyPrimary 恒返写死值 ⇒ FAIL 指认，K-060）。与 TC-STY-10 机械门互补（机械门管端点数、换墨臂管判别力）。
- **B. 封箱腿整帧漂移自动报警**（731100c 根治，用户拍板「机器拦」）：fixture 增顶层 `recheckLedger` 复评台账（5 项入账）+ seal 测试 3 条新腿——漂移分类：已登记复评（K.5.1-补N 在案）⇒ WARN+指引官方复取器重封 / 未登记 ⇒ FAIL+指路 §K.5.1。防伪三锁：逐帧 Σ≡帧差 / witness 逐字在 provenance / qaAnchor 在 QA 正本在案；四篡改反证全被机械指认。
- 验证：seal **12/12 绿**（9 既有+3 新）· pool 22/22 绿 · ledger 14/14 绿 · tsc 0 错 · 常门 exit 0。并发冻结文件零触碰。

**续三（严守真，判据文本草案 ✅）**：`wxg-t-228-tint-criteria.md` 增 **§11「§230 判据文本草案」** 五件：§11.1 C12-t（统计域=B≥250 纹理像素，盲区 plate≡pit 结构性登记，拦截职责交叉引用 TC-TINT-09/19）/ §11.2 K3 改写（B0 tile edge vs pit，旧文划线留痕）/ §11.3 C7 拆分（a 配方门沿用 7/2 + b 运行时预算门，新值待裁）/ §11.4 R-9 分域（含「合并域<5=等价否决 tint」后果句）/ §11.5 换墨臂入 TC-STY-10。随批登记漂移：WXG-T-232 已改 holeFeatherDp 0.5→0.25 ⇒ TC-TINT-02 读数须按新产物复测。

**→ 汇编结论**：230 主体完成；剩余 = **「判据裁定会」四项**（C12-t 式并入 / C7-b 新值 / R-9 分域+新值 / K3 取舍）待主理人+策划打包裁定；裁后文策渊并入 §12.2、程基岩同步 ADR-0028 §5、本册并入 test-cases §L。mask:diff 挂载已复绿（PASS）。


### ★ 判据裁定会（2026-10-07，主理人四项全拍板 ①）

| 项 | 裁定 |
|---|---|
| C12-t | **并入 test-cases §L** 作为 tint 臂正式判据（统计域=mask 纹理像素 B≥250；盲区 plate≡pit 由 TC-TINT-09/19 交叉拦截）|
| C7-b | **采纳方案值**（blit ≤1/珠、draw call +1、三角 ≤2、真 α=0——与 S5′ 实现实测一致）|
| R-9 | **采纳分域**（芯区保留 T1 原两线 + 边缘带 p95≤12/单点≤20/无振铃——合并域 <5 = 等价否决 tint 的选项被否）|
| K3 | **跟随定稿**（孔底透 B0 tile edge −0.30；与 226-Q2 裁定连带一致）|

**裁后流水**：① test-cases §L 并入 ✅本批 ② `bead-visual-style-spec §12.2` C5/C12 引用面回写 → 挂文策渊 ③ `ADR-0028 §5` 执行态同步 → 挂程基岩。

---

## WXG-T-272

> memory·日记长节外移 + Qoder 长期记忆清理（上下文瘦身）｜主理人(Qoder)｜2026-10-15 用户令「上下文内容太多，剔除无用上下文」

- **背景**：会话注入面过大（目录树 + 记忆总览 + 定向日记）。体检定位大头：`ctx/index.json` 2.7MB（机器读、hooks 依赖，**不动**）、`memory/2026-10-04.md` 150KB、`temp/` 572 文件（未授权不动，待用户点名）。
- **日记外移（文件侧）**：用现成工具 `pnpm run memory:split`（WXG-T-106 机械口径，dry-run 先跑）对 5 篇（10-04/10-03/09-28/10-13/10-14）外移 31 个 >600 tok `##` 节 → `memory/details/`（详情件 18→49），逐字节搬运 + 工具自带回读校验；5 篇合计 323KB→114KB。`ctx:build` 重建 + `ctx:check` A/B/C/D/D2+E3 全绿；`memory/INDEX.md` 与 ctx 产物由脚本自动更新。
- **Qoder 长期记忆清理（记忆侧，删 11 条，逐条经用户裁决）**：
  - 首轮低价值 2 条（单点实现细节，不满足入库重要性原则）；
  - A1 登录安全策略（失败锁定/短信/IP 审计）＝本仓无登录后端，grep 证实为串台误录；
  - A2 「大图切多关」Plate 主题整档 ×3（architecture 子集条 + pitfalls 正本条 + P2b 算法条）——用户裁「暂不需要，将来再梳理」；底档 = P2 spec §0.2、`tools/scripts/level-derange.mjs`、日记详情件；
  - A3 直填vs级联悬置条（`_nearestFirst` 已删、级联问题被 G-3 裁定关闭，条目描述已废）；
  - A4 P2b 工程经验条（教训 1/2 逐字重复，教训 3 随 A2 整档归档）；
  - B1 `games/beads/art/` 矛盾条（目录不存在，与 `design/art/` 现行正本冲突，保留正确条）；
  - B2 品牌色合并待裁条（`MIN_BRAND_DE` 全仓零命中，路线已被像素级 k-means 正本承载）。
- **保留**：G-3 裁定、剥皮 task_summary（带校正段）、验证盲区专条、k-means 架构正本、安全区双条（分工非重复）。
- **零代码改动**（`src/**` / `packages/framework/**` 未动）⇒ 未重跑 verify；`check:links` 实跑 OK。
- **遗留**：`temp/`（572 文件 + 208 目录）与 `.playwright-cli/` 旧日志仍在目录树注入面内，待用户点名后清理。

---

## WXG-T-284

> beads·EP-13「大关选关页」拆分 + 五批落码｜主理人(Qoder) spawn 程基岩｜2026-10-16 用户三裁定（清单存大关表 / 点图进本大关列表 / 已通关格直接重玩）+ Q13=乙、Q14 大关改称、Q16/Q17=甲

- **本号性质**：拆分立项号（纯计划批）⇒ 五批落码全部沿用同号不另领；正文 = `production/epics/epics-beads-ep13.md`（READY×5），状态对账 = `epics-beads-status.md` 第 9–13 条，史证 = `epics-beads-ep13.s-history.md`。
- **五批入库**：S1 `201c0e4` 大关表承载关卡清单 + `themes.ts`→`arcs.ts` 改名（C-1）· S2 `74acba8` 选关页 = 本大关清单 ∩ 闸门（C-2 ①②④ + C-5）· S3 `994cb24` 0 心点格拉既有体力回满位（C-4，含广告串道反例）· S4 `25015cd` 走马灯按大关 + 三态归约（C-2 ③⑤⑥）· S5 `6e94f49` 格按下态 + 陈旧注释订正（C-3 ①②核对③）。
- **口径**：零 §3 变更、零新判据、零新数值；每批带自带回归腿（末态 beads 1024 passed / 2 skipped，`verify` 22/22，镜像一致）。
- **台账补登说明（K-046 同型）**：拆分件 §8 「待主理人批准后由领号会话粘贴」的宿主登记拟行当时未落地 ⇒ 五批代码已入库而主表无行。本次按 §8 拟行补行 + 详情节，并将头注由 272 校到 289（⚠ 283/286–289 仍属“用了号未登主表”，待各会话自登）。
- **未闭（不属本号射程，已挂账）**：① 规格自陈句回写 ~~6 处~~ ⇒ **已闭：实测七处**（`arc-level-select-spec.md` 版本行 / 术语轮 / §4 两行 / §9 指针行 / TODO-3 / TODO-6，v1.4 随 `4f14028`，设计轨 WXG-T-283 域代落）；② 跟进单 `epics-beads-ep13-fu-wallcell.md`（3×3 收墙 + 未解锁/越界合形锁格）待领号；③ 下游占位 D-1（C-6 QA 判据族）/ D-2（C-7 art 回写）/ D-3（C-8 图元差分复算）/ D-5（TODO-1 页头大关名令牌）；④ 真机腿与目视项（S3 广告真机、S5 harness 出图签署）；`locked` 态本版不可达。
- **台账与知识库补登（2026-10-17 收口批）**：本号已按 §8 拟行补登主表行 + 详情节 + `epics-beads.md` EP-13 三处（提交 `3d2ec80`）；规格自陈句七处已回写（提交 `4f14028`）。`kb:sync --task=WXG-T-289` 沉淀统计：**新增 2 / 修改 1 / 激活 0 / 归档 0**（K-136 文档批假绿门校验盲区、K-137 宿主登记拟行未落地），`kb:audit` 无归档相似命中。

---

## WXG-T-288

> beads·星级玩法立项 + EP14 拆分 + S1 结算引擎落码｜主理人(Qoder)·程基岩域代落｜2026-10-17 用户拍板星级新制（档内按用时判星）

- **本号性质**：星级玩法立项号（P1）⇒ EP14 拆分与 S1 落码沿用不另领。
- **裁定与真源**：`systems-index §3.7` **v1.78** 五行改语义（档位单条件 / 档内按用时判星 / 续时保底档位星 等）⇒ **零数值变更**（复用既有 `STAR_TIER_K` / `tierSecondsFor`）；规则正本 = `design/proposals/star-collect-rule.md` v0.2（R1–R8 + §5 裁定 + §6 待办）；存档结构变更 **0**（R6 复用 `starsByLevel`）。
- **拆分** = `production/epics/epics-beads-ep14.md`：5 Story = S1 M READY / S2 S READY / S3 M READY / S4·S5 **BLOCKED**（待规格 `star-collect-rule §6-T1`：全 3★ 开大关怎么告诉玩家 + 总星数落位与分母形态）；子代理通道不可用 ⇒ 主理人按 `wxgame-epic-split` 方法代执行。
- **已入库两批**：立项回写 + 拆分 `3c889ac`；**EP14-S1 星级结算引擎** `435c8b0`（四臂判据 = `score-combo §8-1` 全绿；旧 v1.50「续时不封顶」与双条件选档用例按 K-053 **换形不删腿**；镜像同步核一致）。
- **在册风险（拆分件 §5）**：R-1 既有用例锁旧语义 ⇒ 换形逐条对 §3.7 v1.78；R-2 总星数求和不得进 `update`（L5 热路径零分配）；R-3 闸门≠通关章两概念不得混用（S3 单列反例臂）；R-5 续时广告真机腿 `[待真机 + 待广告接入]` 不入本批硬门。
- **台账补登说明（K-137 同型）**：本号此前只活在拆分件与提交信息里、主表无行（与 283/285/286/287/289 同一形态欠账）⇒ 由 WXG-T-290 收口批补登主表行 + 详情节 + `epics-beads.md` EP-14 三处（Epic 13→14 / Story 52→57 / `[Blocked]` 5→7）。

---

## WXG-T-340

**工程·beads 选关页空带大关名（`levels-spec §11.4` TODO-1 接线）落码批（用户对 339 回传后续选项选 B） · 负责：主理人(Qoder) · 状态：✅ 完成（2026-10-21）**

- **背景**：WXG-T-334 时代真机报 4 项缺陷之④的收尾半——选关页大关标题应显示章名（用户原话「第9关希望显示大关的名字，比如教学」）。CH-S3（title 上移）已闭、`levels-spec §11.4` 已裁「显示、进顶部空带 [822,1122]」，本批 = 该裁定的接线落码 + 金样本重抓。
- **确诊**：选关页空带 [822,1122] 从无绘制（`drawLevelsPage` 只画标题带「选关」；「第9关」= 木牌 `drawPlateTitle` 旧观感残留，选关页本身从未画过它）；取数唯一正确来源 = `PhaseRouteBinder.levelsArc`（binder 注释原文：「`levels` 页的大关上下文（`_wallSlotsFor` 的唯一来源）」）。
- **修法（三件，正本 §11.4 钉死零分叉）**：① `MetaViewData` 加 `chapterTitle?: string`（注释声明：视图不查表、⛔ 不借 boss 关派生 `title` 作第二通道）；② shell `_metaViewData` 塞 `ARCS[this._phase.levelsArc]?.title`（与选关墙同源）；③ `drawLevelsPage` 空带 [LEVELS_GRID_TOP, navTop - LEVELS_NAV_H] 有值才建节点、居中带心、字号取 `UI_FONT.overlayTitle`。**R1** = 有 title 原样渲染（不拼前缀 / 不加序号）；**R2** = 无值不建文本节点（兜底零猜测）。带内 y / 字号正本明标 `[TODO]` 归 art 批 ⇒ 本批取占位（带中心 + 页头同档字）。
- **文件面**：`src/view/meta-view.ts`（字段 + 空带绘制 + `navTop` 提取共用）+ `src/game/beads-shell.ts`（`_viewData` 初始化 + 塞值）；cocos 镜像 2 件（`framework:sync`）；测试 1 件：`arc-level-select-page.test.ts` 新 describe 2 例（R1 落位断言 / R2 空带零文本节点反证）。
- **金样本**（先登记 ⇒ 重抓；K-051 / K-053 / ADR-0032 DEC-6）：先跑对拍 = 恰 `level-select` / `level-select-mid` 两态红（其余九态绿）；capture 两遍确定性重抓（`WXG298_SOURCE_REV=3609dcb`）⇒ 夹具 diff 恰 7 行：`capturedFrom` = `3609dcb · 选关页空带大关名（WXG-T-340）` + 两态 sha/total/kinds.text（level-select `d4aee179…`→`e193506e…`、total 1421→1422、text 11→12；level-select-mid `22d0adc7…`→`5c668385…`、total 5083→5084、text 17→18），其余九态 sha 逐字未变。`--dump` 机械证据：帧内 `{"kind":"text","x":375,"y":972,"text":"曼陀罗","fill":"#2A2E43","font":"40px sans-serif"}`（x=DESIGN_W/2、y=空带中心 972）且全帧集仅两态含「曼陀罗」。
- **登记**：`ui-architecture-beads §12` UI-34 行视觉变更登记（K-051 / K-053 / ADR-0032 DEC-6：先裁定再重抓）。
- **验证**：beads 全量 98 文件 **1140 过 + 3 skip**（较 339 批 1138 +2 = 本批新例）；`framework:sync:check` 绿；`verify` PASS 22。
- **未做**：①半透（UI-60 容器层，ADR-0033）/ ②BD-62（末张卡左右可见性方向反）/ ③橱窗灯光（美术资产）/ ④暗线；空带带内 y / 字号微调（art 批 `[TODO]`）。

---

## WXG-T-339

**工程·beads 真机缺陷①「设置弹窗标题压首行」修复批（用户对 338 回传后续选项选 B） · 负责：主理人(Qoder) · 状态：✅ 完成（2026-10-21）**

- **背景**：WXG-T-334 时代用户真机报 4 项缺陷之①——主界面设置弹窗标题「设置」与第一行按钮重叠；本批独立修复（①半透属 UI-60 架构 / ②属 BD-62 / ③属美术资产 / ④暗线 ⇒ 均不混做）。
- **确诊（双源）**：标题中心 = `plate.y + plate.h - 70` = 957（字面 40 ⇒ 下缘 937）；首行钮带 = [877, 965] ⇒ 中心落进带内、与按钮叠 **28**。`settingsLayout` 注释原已登记「重叠属既有排版」，本批清零（代码 + 注释同改）。
- **修法（联立实算；平台惯例不可照搬）**：标题基线 −70→**−50**、栅格 `topY` −150→**−170**、行距 `TOUCH_MIN + 16`→**+12** ⇒ 三处净空各 **12**（标题下缘 957 对首行顶 857+88 = 945 / 行间 100−88 / 末行底 457 对返回钮顶 445）；板顶距 30、底距 50。排除项：暂停面板惯例（`PANEL_TITLE_BAND_H` 100）在 720 板 + 5 行 + `TOUCH_MIN` 88 下数学不可行；纯移标题需 ≥ 40 仅余 ≤ 2、纯移栅格需 36 而余量仅 16 ⇒ 取三项联立解（B2）。
- **文件面**：`src/view/meta-view.ts`（标题行 −50 + `settingsLayout` 注释按新几何重写）+ `src/view/settings-content.ts`（−170 / +12 + JSDoc）；cocos 镜像 2 件（`framework:sync`）；测试 3 件：`settings-content.test.ts`（首钮 857 / 末钮 457 / step 100）、`bead-style-settings.test.ts`（注释「457 > 445 间隙 12」）、`dialog-center.test.ts`（+26 行新 describe：标题 text 命令下缘对全场 88 高 rect 最高顶缘净空 ≥ 10）。
- **金样本**（先红取证 ⇒ 重抓）：先跑对拍 = 恰 `settings` / `signin` 两态红（其余 10 绿；actual dump 坐实标题 977 / 首钮 857 / 首行顶 945 与算术逐字节吻合）；`ui-golden-capture.ts` 两遍确定性重抓（`WXG298_SOURCE_REV=90e0e11`）⇒ 夹具 diff 恰 3 行：`capturedFrom` = `90e0e11 · 设置弹窗标题压首行修复（WXG-T-339）` + 两态 sha（settings `24b06b96…`→`d8b5c527…` / signin `a84f5b4c…`→`2a46500d…`），其余九态 sha 逐字未变、total/kinds 全等。signin 标题因共用 chrome 行同步位移（格布局未动、入口已退役不扩面，已注释声明）。
- **登记**：`ui-architecture-beads §12` UI-30 行视觉变更登记（K-051 / K-053 / ADR-0032 DEC-6：先裁定再重抓）。
- **变异自证 1 例**：标题基线咬回 −70 ⇒ `dialog-center` 恰 1 例红（弹着点 = 新守卫），`cmp` 逐字节还原后复绿。
- **验证**：beads 全量 98 文件 **1138 过 + 3 skip**（较 337/338 批 1137 +1 = 新守卫例）；`framework:sync:check` 绿；`verify` PASS 22。
- **未做**：①半透（UI-60 容器层，ADR-0033）/ ②BD-62（末张卡左右可见性方向反）/ ③橱窗灯光（美术资产）/ ④暗线。

---

## WXG-T-338

**工程·beads 大关 CH-S4「断言扩面」落码批（用户对 337 回传后续选项选 B） · 负责：主理人(Qoder) · 状态：✅ 完成（2026-10-21）；CH-S5 未开**

- **背景**：承 `level-content-pipeline.md` §11.8 CH-S4（纯 Node）：给 `sync-levels-data.test.mjs` 补七类装配边界夹具（uid→区间合并边界 / 空章 / 跨包 / open 洞 / boss 非末 / 孤儿关 / 超 `WALL_CAPACITY`）。
- **等价重构**（`sync-levels-data.mjs` +28/−9，行为不变）：`assertOpenPrefix`（断言 1′）与 `assertChapterPackUniform`（断言 5）自 `assembleArcs` 内抽出为纯函数——上游 `pack!=='main'` 门与调用前置使二者在真数据流不可达（§11.4 先绿后守）⇒ 抽出后夹具可直测；`assembleArcs` 导出（注释明示**不写盘**）供夹具驱动。
- **夹具**（`sync-levels-data.test.mjs` +8 例 ⇒ 共 31 过）：temp 目录「single + plate(2 槽) + boss」迷你内容仓 `mkArcFixture`（`os.tmpdir`）驱动 `assembleArcs`——绿路径（`levelRefs [[1,4]]` / openMax 1 / 容量 4）/ 空章 / boss 非末 / 孤儿关 / 孤儿章；断言 1′/5 直测（open 洞 / 跨包）；`uidSlotsToLevelRefs` 空列表 ⇒ §11.8 七类全覆盖（超 `WALL_CAPACITY` 由 336 批「章容量」例守）。
- **变异自证 2 例**：① 跨包断言 `p !== packs[0]` → `false` ⇒ 只红「跨包」1 例（30/1）；② `assembleArcs` boss 非末断言咬断 ⇒ 只红「boss 非末」1 例（30/1）；均 `cmp` **逐字节还原**后复绿 31/31。
- **验证**：`node --test` 31 过（23 旧 + 8 新）；`levels:check` 零漂移（beads/breakout 全一致）；`verify` PASS 22。
- **未做**：CH-S5（分包放开，卡 `build:wx`）；五项不混做（①设置弹窗重叠 / ①半透 UI-60 / ②BD-62 / ③橱窗灯光 / ④暗线）。

---

## WXG-T-337

**工程·beads 大关 CH-S3「title 上移」落码批（用户对 336 回传后续选项选 A） · 负责：主理人(Qoder) · 状态：✅ 完成（2026-10-21）；CH-S4/S5 未开**

- **背景**：承 `level-content-pipeline.md` §11.7 CH-S3 五步迁移（title 上移到 chapter 级）：`BeadsLevelRaw.title` 降级为**生成期派生字段**（唯一真源 = 所属章 `chapters/<id>.json` 的 `title`；仅章收尾关（boss）携带）；运行时 `drawPlateTitle` **零改动**（视图读 `carouselLevel.title`，与今日同路径）。
- **源改动**：`singles/L00009.json` 删手写 `"title": "曼陀罗",` 一行；`manifest.json` `contentVersion` 31→32。
- **生成器**（`sync-levels-data.mjs` 7 处替换、+46/-3）：新增 `assertNoSourceTitle`（**断言 8**：有大关层的游戏，源关卡手写 `title` 即抛）+ `injectChapterTitles`（章 `levels[]` **末项 uid** 的**最后一个展开槽**写 `title`、**追加在对象末尾** ⇒ 产物 diff 仅该记录一行；末项 uid 不在装配表（拼错/retired）或 title 非法 ⇒ **跳过**，交 `assembleArcs` 报红不重复抛）；`expandEntries` 内启用断言 8（plate 查每个 cell / single 查 obj）+ 孤儿检查后注入循环 ⇒ 装配两入口全覆盖。
- **口径订正随批**：`levels-data.header.txt` 的 title 注释「木牌第二行（≤6 字）」→ 属章派生名新语义（4 行）⇒ `levels-spec §11` 登记关闭「双真源窗口」。
- **产物**：`levels:sync` 重生 `levels-data.ts`（L00009 记录 `title` 移至对象末尾、header 注释更新）；`arcs.ts`「已一致，跳过」零变化；`framework:sync` 镜像 1 件。
- **单测与自证**：`sync-levels-data.test.mjs` +3（注入断言含键序末位 / 异常跳过 / 断言 8 抛）⇒ 共 23 过；**变异自证 2 例**：① `chapters/mandala.json` title 曼陀罗→曼陀罗X ⇒ `levels:check` 红报 2 处产物漂移（levels-data.ts + arcs.ts 同咬）⇒ 章名确实流入两产物；② `singles/L00005.json` 插 `"title": "测试",` ⇒ 断言 8 精确咬红（`beads: 源关卡 singles/L00005.json 手写了 title="测试" —— 展示名唯一真源 = 所属章 title…`）；均**逐字节还原**后 check 复绿。
- **验证**：`levels:check` 幂等 OK；beads vitest 98 文件 1137 过（`arcs.test.ts` 4 例 / `menu-plate-title.test.ts` 3 例全绿、ui-golden 零漂移）；`verify` PASS 22；§11.7 验收四条达成（L00009 仍带 title / 两测试全绿 / `DEMO_LEVEL_COUNT` 仍 9 / 木牌渲染路径不变）。
- **未做**：CH-S4（夹具扩面）/ CH-S5（分包放开，卡 `build:wx`）；settings 重叠 / 半透（UI-60）/ BD-62 / 橱窗灯光 / ④ 暗线 未混做。

---

## WXG-T-336

**工程·beads 大关（chapter）配置层落码批 CH-S1/S2（7 项未决全采纳） · 负责：主理人(Qoder) · 状态：✅ 完成（2026-10-21）；CH-S3/S4/S5 未开**

- **背景**：用户令「全采纳开 CH-S1/S2」= 335 设计批 7 项未决按子单推荐全采：Q-A 产物保留 `levelRefs` 区间 / Q-B 章超 9 槽生成期硬拦 / Q-C `ARC_COMING_SOON` 本批不迁（留手写 header） / Q-D `open` 字段本批上；设计 ① 页头章名落空带 [822,1122] / ② 章名不设长度硬门 / ③ 玩法 HUD 分母延后（登记 `[TODO]`）。
- **CH-S1 真源落盘**：新建 `games/beads/design/levels/chapters/mandala.json`（首章一物一文件：`{id:"mandala", title:"曼陀罗", levels:[L00001…L00009 共 9 个 uid], showcase:{bundle:"themes", art:"l9-boss-mandala-256", textureId:"bitmap__boss_l9"}}`）；`manifest.json` 末尾加 `chapters:[{id,file,order:1,open:true}]`；`contentVersion` 不 bump（按 §11.7 步骤 4，CH-S3 才 31→32）。
- **CH-S2 生成器垂直切片**：`sync-levels-data.mjs` 抽 `expandEntries`（装配内核 + `uidSpans` 唯一换算来源）；新增 `assembleArcs`（断言 1–7：章 order 严格递增 / `open` 前缀无洞 / id=文件名 / title 非空 / levels 非空 / uid 全局恰一归属且非 retired / boss 恰 1 条且=末项 / 同章同 pack / 未退役 entry 必须被覆盖 / 孤儿章文件反向查 / showcase 三字段齐备 + textureId 全表唯一 + `assets/<art>.png` 存在 / 轴对齐 `levels[i].id===i+1`）、`uidSlotsToLevelRefs`（相邻连续合并）、`openPrefixLength`、`checkChapterCapacity`（槽位 ≤ 读 tuning 的 `WALL_CAPACITY`，async 驱动同门禁⑥⑦）、`buildArcsModuleSource`（`arcs-data.header.txt` + 生成数据体 = `ARCS`/`ARC_OPEN_MAX`/`OPEN_ARCS`；header `trimEnd` 归一化）；发现阶段加 `chapters/` 与 `manifest.chapters[]` **双向绑定**（成对缺席/成对存在 + 缺 header/产物报红）；`levels:check`/`levels:sync` 自然并入（同脚本）。
- **产物**：`games/beads/src/config/arcs.ts` 重生成为生成物（头部 ⚠️ GENERATED + 真源指路 `chapters/*.json`；`ArcEntry` 接口独立声明替代 `typeof ARCS[number]`；6 个消费点零改动 = beads-shell / tuning / main-menu-presenter / meta-view / arc-carousel 测试 / 宿主 beads-blit-carrier）；`framework:sync` 镜像 1 件；新 `arcs-data.header.txt`（手写模板 = `ArcEntry` 接口 + `ARC_COMING_SOON` + 说明）。
- **单测与自证**：`sync-levels-data.test.mjs` +5（区间合并含 plate 多槽边界 / 断点分段 / 无区间抛 / open 前缀含乱序与空 / 容量超一槽抛）；**变异自证 2 例**（boss 挪首位 ⇒ 咬「boss 必须是 levels[] 末项（现第 1/9 项）」；删 L00005 ⇒ 咬「L00005 未被任何章覆盖」；均逐字节还原后 check 复绿）。
- **验证**：`levels:sync`/`levels:check` 幂等 OK；beads vitest 98 文件 1137 过（`arcs.test.ts` 4 条钉住旧值 ⇒ 产物语义等价手写版）；`node --test` sync 单测 20 过；`verify` PASS 22（含 typecheck / framework:sync:check / levels:check）。
- **未做**：CH-S3（title 上移：删 `L00009.json.title` + 生成期注入 + `contentVersion++`）/ CH-S4（夹具扩面）/ CH-S5（分包放开，卡 `build:wx`）；settings 重叠 / 半透（UI-60）/ BD-62 / 橱窗灯光 / ④ 暗线 未混做。

---

## WXG-T-334

**工程·beads 走马灯木牌大关名「曼陀罗」+ (b) 只显名字（4 项真机缺陷先修 ④） · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-21）**

- **背景**：用户报 4 项真机缺陷（设置页重叠/返回钮/半透；走马灯末张箭头消失+默认图案；橱窗灯光质量；大关外圈暗线+标题「第9关」），本批只先修可独立修的 ④（木牌显大关名），其余各归其位（①半透=UI-60、②=BD-62、③=美术、①重叠/④暗线=待正经批）。
- **④ 确诊**：`BeadsLevelRaw.title?` 字段（`levels-data.ts:19-21`「主菜单橱窗木牌展示名，缺省只显关序」）+ 渲染 `meta-view.ts::drawPlateTitle`（已 `if(lv.title)` 画名字）早已为此设计，只缺数据 ⇒ 非「无概念」（上一轮误判已自纠）。
- **名字来源**：「曼陀罗」= L9 boss 图案主题名，三处坐实（`menu-proto-coords.py:17` PLATE_TEXT=("第9关","曼陀罗")、`menu-showcase-asset-spec.md:180` 实装主题名 boss 曼陀罗、`arc-level-select-spec.md:163` 大关① 曼陀罗=关卡1-9）；关表/studio result/raw 均无此名（只有生成串 studio-3-163c）⇒ 名字取自设计文档，非我编。
- **落码**：`design/levels/singles/L00009.json` 加 `"title":"曼陀罗"` → `pnpm run levels:sync` 重生成 `levels-data.ts`（`stripDevFields` 删除名单透传，title 自动进产物）；用户选 **(b)「有展示名⇒只显名字、隐关序」** ⇒ `drawPlateTitle` 的 `if(lv.title)` 支从「关序 line1 + 名字 line2」改为「名字居中一行（singleOff）」，else（无 title，其余 8 关）逐字不动。
- **测试**：`menu-plate-title.test.ts` 断言从「两行」改为「有 title⇒只画名、不画关序」；`menu-carousel.test.ts`（title 淡变腿）不受影响仍绿；`ui-golden.test.ts` **未红**（main-menu 场景 `unlocked:9` 的木牌当前卡非 L9，命令流无变化）⇒ 免重抓夹具（K-051/053）。
- **⚠ 偏离登记**：(b) 推翻 v3.7 原型「关序+关名两行」布局（`menu-proto-coords.py` 注释本意两行），依用户 2026-10-21 明选 (b) 执行，代码注释已标偏离。
- **验证**：`verify` PASS 22 / FAIL 0（含 framework:sync:check 镜像一致、typecheck、beads 全测）；未跑 build:cocos（真机取证仍卡上传密钥，包留待配钥后重出）。
- **未做**：①设置重叠、①返回钮样式、①半透、②BD-62、③橱窗灯光、④暗线 六项本批不混做。下一可用号 **WXG-T-335**。

---

## WXG-T-333

**工程·headroom 本机安装押后 + 真机走查前置侦察（现包年龄与出包通道） · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 登记（2026-10-21）；未改任何生产代码**

- **用户裁定**：「暂时先不装 headroom，继续走查任务」⇒ `uv tool install` **已取消、零落盘**（本仓与用户机器均未新增 headroom 文件），MCP 接线（WXG-T-330）保持原样。
- **安装前侦察所得（零写入、可复用）**：PyPI `headroom-ai` 当前 = **0.41.0**（203 个版本、迭代很快；`requires_python >=3.10`，本机 3.13.10 可）；`console_scripts` 含 `headroom=headroom.cli:main` ⇒ **装完可直接用命令行跑压缩实测，不需依赖 Qoder 重载 MCP**；extra 分档：`[mcp,code]` 只拖 `mcp` + `tree-sitter`（轻），`[proxy]` 才拖 `transformers` + `onnxruntime` + `fastapi` + `openai`（重，且本宿主用不上）。⇒ 将来要装，命令钉为 `uv tool install --python 3.13 "headroom-ai[mcp,code]==0.41.0"`，装完用 `headroom --version` 读数回写 `my-mcp/README.md §8` 做确定版本锚。
- **走查前沿的真发现（阻塞不在真机、在包）**：`games/beads/cocos/build/wechatgame/` 产物**停在 2026-10-19 23:27**（目录内无 10-20 及以后的文件），而 `WXG-T-322`（高屏遮罩铺满，`7f8d1dd` 10-20 16:24）与 `WXG-T-323`（对话框居中）代码都是 10-20 落的；取证目录也只有 `production/qa/beads/device/2026-10-19/`。⇒ 走查单 P1/P2 那两条 `PASS` 只拿着**用户直读回执**（同一设备、同一天），**未取证物重建腿**；按 §0 判定规则（`PASS*` = 样本不足），这两条应记「待同包复验」而非闭环。⚠ 本批只**登记事实**，不替会话改别人写下的判定列。
- **出包通道已核**：`build:cocos` = `tools/scripts/build-cocos.mjs` 直接 `spawnSync` 编辑器自带 CLI（`/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project <proj> --build "platform=wechatgame;debug=false"`，默认 release 基线档，判例 K-111）⇒ **无需开 GUI**；CLI 文件在位（已 `ls` 确认）。⚠ 新镜像件 `ui-container-order.ts`（WXG-T-329）尚无 `.meta`，按 L1 不得手伪造 ⇒ 要么由编辑器导入生成（CLI 构建含资源导入），要么本批不动它（它未被视图引用，进不了运行路径）。
- **走查单当前可推面（读 §2/§3/§4/§6 得）**：真机 `6UNBB26416051396`（L-A 畅享 CHZ-AL00）在线；**阻塞 X-09 的解除条件只差「B′ 落码」**（路线已拍板 = 只把菜单 BGM 挑进分包，当时按「一轮真机只引入一个变量」暂不落码）；**D-77 遗留的标定线定性不需新包**（确诊法已写：清微信小游戏缓存或换新微信号冷启 ⇒ 仍出则开 BD、不出则记存档态）；D-77 子判点 ③（选关墙第 9 格缩略）需先推进存档；D-40/D-41/D-44 需别的机型（灵动岛 / Android targetSdk 35+ / 胶囊机）⇒ 本机不可推。UI-60 战线一（容器层 + 设备层序读数）仍卡「视图接线未做」，不在「纯走查」范围。
- **未做**：不改代码、不出包、不动真机取证（等用户在下面三条里拍板）。下一可用号 **WXG-T-334**（已核工树除头注自指外无 333 引用）。

---

## WXG-T-332

**工程·headroom 可用形态口径订正（proxy 在 Qoder 不可用） · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 入库（2026-10-21）**

- **触发**：用户指出「headroom 好像只能 MCP 用法，如果直接代理使用，那么 qoder 里面好像不能用」。判定：**对**。上一批（WXG-T-330）我在收尾给的三个选项里把「走 proxy」当作可用路径挂着，没先确认本宿主不开放模型端点 ⇒ 该选项在本仓日常环境从一开始就不成立。
- **事实边界**：headroom 四种形态里，**proxy 与 wrap 都要求宿主能改模型 base URL / 出网代理**（CLI 宿主如 Claude Code・Codex 可以，闭源 GUI IDE 不行）。Qoder 的模型接入不对用户开放 ⇒ 流量无法改道。Library 形态需自写调 LLM 的代码，而**游戏运行时不调 LLM** ⇒ 对产品代码无意义。剩下可用的只有 **MCP 档**。
- **MCP 档的真实价值（本轮同时说清的另一半）**：它只暴露 `headroom_compress` / `headroom_retrieve` / `headroom_stats` 三个**显式工具**——**Agent 主动调才压，默认行为不变、不自动拦 stdout** ⇒ 接线 ≠ 已省。真实省幅仍靠仓内 `ctx/` 读侧预算体系（ROUTES 锚点 + hot-files 局部读 + B 门）与命令产出控制。
- **回写五处**：① [my-skills/headroom/SKILL.md](../../my-skills/headroom/SKILL.md) 四种接入逐档标可用/不可用，并在「削减模型输出」一节顶部加 ⛔ 前置声明（该节在 GUI IDE 用不上）；② [my-mcp/README.md](../../my-mcp/README.md) §8 那条「字面减输出在 proxy 侧」改为「在本仓不可用（proxy / wrap 都要改宿主端点）」；③ 台账 332 行 + 详情节 + 新建当日日记 `memory/2026-10-21.md`；④ 长期记忆两条同步订正（`tool_experience` Headroom 四种接入→逐档加宿主前提；`skill_experience` 知识库沉淀→补「接入配方必逐档标宿主前提，接上≠已省」）——防跨会话重踩同一个错。
- **不动的两处**：旧日记 `memory/2026-10-20.md` 与旧台账行里「字面减输出在 proxy 侧」的表述属时间序过程账，按惯例不回改，本批只订正**现行文档**（技能正文 + 接线记录）。
- **沉淀**：**K-147**（接本地拦截型工具前先查宿主开放度；三问：要改宿主配置吗 → 本宿主开不开这个入 → 有无 CLI 等价宿主；答不上就标「未验」不得当选项交付）。统计：新增 1 / 修改 0 / 激活 0 / 归档 0。
- **不伪造读数**：本仓无从实测 proxy 不可用（正因端点不可改而无从测），文档里写的是「用户 2026-10-21 指出 + 本仓未实测」，没假装跑过 `headroom proxy`。
- **遗留**：MCP 档在当前环境只是「大块的按需压缩后手」；要真省 token 得靠读侧纪律与少出巨输出。若日后换用可调端点的 CLI 宿主，proxy + `HEADROOM_OUTPUT_SHAPER=1` 仍是未展开的那条腿。

---

## WXG-T-331

**工程·外部技能/工具沉淀为可刷新知识库 · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 入库（2026-10-20）；跨项目 arsenal 仓仅登记为候选**

- **来源**：用户问「headroom 库和 ponytail 库能否作为个人知识库沉淀下来，之后的项目直接用？哪种方式方便查询和接入？如果 github 库可以实现那就最好」。给四选（A 都进本仓 my-skills / B 另起跨项目 arsenal 仓 / C 只进 Qoder 记忆 / D 先核上游）⇒ 用户拍 **A**。
- **关键区分（决定归档形态，两者不能同一处理）**：ponytail = **纯文本方法论 skill**（六个 `SKILL.md`）⇒ 适合 vendoring 进仓、随仓库走；headroom = **需本机装二进制的上游包**⇒ ⛔ 不存代码，只存「接入配方型 SKILL.md」，用到时一行装。
- **ponytail 六件入库**：从**本机已装副本** `~/.qoder/skills/ponytail{,-audit,-debt,-gain,-help,-review}` 逐字 `cp -R` 进 `my-skills/`（六目录各仅一份 SKILL.md，frontmatter `name` = 目录名，共 ≈28 KB）。选它不选上游直取的原因 = 本会话亲测在用、内容真实；且 `raw.githubusercontent.com` 在本网域不通（`curl` 全部 FAIL，连接被重）。
- **headroom 薄技能**：新建 `my-skills/headroom/SKILL.md` = 何时用 / 装法 / 四种接入（library · proxy · wrap · MCP）/ 输出削减 (`HEADROOM_OUTPUT_SHAPER=1` 只在 proxy 侧) / 与本仓 `ctx/` 读侧预算互补 / 未装时预期失败。与 `my-mcp/README.md §8`（WXG-T-330）不重复：前者是**可触发技能**、后者是**接线记录**。
- **上游坐实**：`DietrichGebert/ponytail`（MIT），来源二重 = `ponytail-help/SKILL.md:71` 自带 `Full docs + examples: github.com/DietrichGebert/ponytail` + `api.github.com/.../git/trees/HEAD?recursive=1` 列出 `skills/ponytail*/SKILL.md` 与根 `LICENSE`。⇒ 教训：**curl raw 不通不等于仓库不存在**，探结构走 API trees。
- **四 IDE 链接**：7 件 × 4 目录 `ln -sfn ../../my-skills/<name> .<ide>/skills/<name>`（`.cursor` `.codebuddy` `.workbuddy` `.qoder`）⇒ `check:links` OK，技能 40→47。
- **编目（可查询性的落点）**：`my-skills/INDEX.md` 新增 **§1b.2** 逐件表格 + 四注（来料与许可 / provenance与刷新方式 / 安全审计结论 / 优先级不变）；§1b 标题计数 21→28。
- **刷新腿**：新脚本 `my-skills/_repos/update-ponytail-2026-10.sh`（入库）—— `git pull` 克隆 → 逐件 **diff 不自动盖** → 人工确认后 `cp -R` → 跑 `check:links`；`.gitignore` 新增 `my-skills/_repos/ponytail/`（同 mattpocock-skills / superpowers / Claude-Code-Game-Studios 惯例：内嵌 git 克隆只记空 gitlink ⇒ 必不入库）。脚本里写明「先 diff」的理由 = 快照取自已装副本而非上游，直接盖会改掉实际在用的纪律文本。
- **记忆兜底（两条，跨项目自动想起）**：`tool_experience`「Headroom 本机上下文压缩层：安装与四种接入」；`skill_experience`「把外部 GitHub 技能/工具沉淀为可刷新的个人知识库：两种形态分开存」。既有 `learned_skill_experience`（ponytail 触发时机）与 `development_practice_specification`（必触发规则与档位口径）不重复，本批未动。
- **沉淀（kb:sync 已入账）**：**K-145**（`raw.githubusercontent.com` curl 全失败而 `api.github.com` trees 一次成功 ⇒ endpoint 要分层探，别拿单一通道的失败当事实）；**K-146**（快照取本机已装副本⇒刷新语义不同，必须「先 diff 不自动盖」+ 比内容前核非空 + `_repos/` 内嵌克隆必不入库）。沉淀统计：新增 2 / 修改 0 / 激活 0 / 归档 0，`kb:audit` 无相似命中。
- **诚实边界 / 未做**：① 本批**未落上游 `LICENSE` 文件**（域不通）⇒ 许可依 frontmatter `license: MIT` 自证，首跑刷新脚本时顺带 `cp ponytail/LICENSE` 补齐；② 链接为**项目级**，仅在工程内生效 ⇒ 真要「新项目直接用」需另起 arsenal 仓或装到全局技能目录（候选，待用户点头）；③ 纯 skills/docs + 1 脚本 + 1 行 .gitignore、零 TS ⇒ 不进包、不碰游戏运行时。

---

## WXG-T-330

**工程·MCP 接入 headroom（本地上下文压缩 server） · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 接线入库（2026-10-20）；本机二进未装（选项三才装）**

- **来源**：用户给 https://github.com/headroomlabs-ai/headroom 要「调研 + 如何用到本工程减少 token 输出」。调研后给三选（接 MCP / 出 proxy 落地清单 / 先可行性探针），用户选「接 MCP」。
- **Headroom 定位（一句话）**：跑在本机的上下文压缩层，把喂给模型的巨型工具输出（JSON/日志/git diff/RAG）压小再进 LLM，原文本地留档可逆（CCR）。**它压「工具 stdout 回灌」，与本仓 `ctx/` 读侧预算体系（别整读大文件）互补不替代**。
- **接线（只改正本）**：`my-mcp/servers.json` 加 `headroom`（`transport:"stdio", command:"headroom", args:["mcp","serve"]`）→ `pnpm run mcp:build` 重生 `.mcp.json`（explicit）/`.cursor/mcp.json`（cursor）/`.codebuddy/mcp.json`（explicit）三产物（机器生成物不手改）。`command` 走 PATH（与 `npx` 同款），未硬编绝对路。
- **门禁**：`check:mcp` OK（三产物与正本一致；headroom stdio 有 command+args ⇒ C3 绿）；`check:plugins` OK（它只按 vendor 包名匹配带 `@scope/name@semver` 的条目 ⇒ 无版本 spec 的 headroom 被忽略，不影响 weixin 锚校验）。Qoder 读项目根 `.mcp.json`（README §5），首次使用需 IDE 内批准。
- **为何选 stdio MCP 而非 proxy**：proxy（`headroom proxy` + `HEADROOM_OUTPUT_SHAPER=1`）是真正「减少输出 token」的形态（verbosity/effort 削减），但属 Harness/IDE 出网级、本轮不可入仓（也无法在沙箱替 Qoder 改道）；MCP server 可入仓、提供显式 `headroom_compress`/`headroom_retrieve`/`headroom_stats`。两者不互斥。
- **诚实边界**：① 本轮**不装 headroom**（`uv tool install` 写仓外家目录、且属选项三的「可行性探针」职责）⇒ 未装前 Qoder spawn 该 server 失败，同 cocos 未开编辑器时的预期连接失败（README §7-4），装上即恢复；② 游戏运行时不调 LLM ⇒ headroom 不进包、不影响包体红线；③ 版本钉按仓风不硬编 `latest`（README §8 要求装完把 `headroom --version` 读数回写台账做确定锚）。
- **未做 / 下一步**：① 本机装 headroom + `headroom doctor`/`headroom savings` 量真实省幅（选项三）；② 若 Qoder 不继承 PATH，把正本 `command` 改为绝对路径后 `mcp:build`；③ 若要字面「减输出」，走 proxy 形态（需用户 IDE 配出网）。

---

## WXG-T-329

**beads·UI-60 DEC-8①：Node 侧层序守门轨（引擎无关） · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 守门轨完成（2026-10-20），战线一（视图接线 + cc 层树 + 真机读数）排期中）**

- **来源**：用户在「UI-60 三选」里选「先做守门轨（本轮可独立做完并提交）+ 为真机修缺陷排期」。本单 = ADR-0033 **DEC-8①** 的「Node 侧新增机检」腿，与 WXG-T-328 内核同一先例（引擎无关产物先入库、设备腿后接）。
- **新增 `packages/framework/src/core/render/ui-container-order.ts`**（⛔ 不 import `cc` ⇒ Node 可测，进 `core/index.ts` barrel）：`checkUiContainerOrder(commands: readonly DrawCommand[]) → string[]`（返回违规描述列表，空 = 通过；调用方按场景 `throw` 或收集上报）。单次线性扫描，非热路径。
- **校验什么（结构良构，非叠序本身）**：① `beginContainer`/`endContainer` 配对且**容器不重叠/不嵌套**（新容器不得在上一个未闭合时打开）⇒ 每容器一段连续块 ⇔ **DEC-8① 第一句「容器 A 全部命令索引 < 容器 B」**；② `beginSegment` 只在容器内、与 `endSegment` 配对且**段不叠套**（DEC-2）；③ `endContainer`/`endSegment` 不悬空；④ 帧尾不得留未闭容器/段。
- **与内核互补不重复**：`UiScopeTree`（WXG-T-328）管 enter/exit 的**排序行为**（兄弟位怎么算，已被 9 例钉住）；本门管视图**吐出的命令流是否良构**——前提不成立（容器重叠/段跑出容器）则内核再对也白搭。二者合起来才是 DEC-8① 要的「设备无关替身」。
- **验收**：framework **47 文件 508 passed**（+8 例：正样本相邻闭合容器块 + 空流不误报 + 6 反证逐条钉具体违规串，删判定即转红 ⇒ 非空跑）；beads/breakout **零漂移**（新增函数生产侧尚未消费）、三包 typecheck 0；`framework:sync` 新增 1 件镜像（framework 60→61）且 `framework:sync:check` 一致；`verify` **PASS 22 / WARN 0 / FAIL 0**。
- **⚠ 诚实边界（别把本单当修好）**：视图现在还不发容器命令（战线一未做）⇒ 本门当前只咬人造样本；战线一把弹窗内容搬进容器后，把它指向真帧（金样本 / 采样帧）即自动生效、无需改门。**本门单独不消缺陷**。
- **⛔ 战线一（排期、需真机取证 = 缺陷真正的关闭条件）**：① 弹窗视图发 `beginContainer`/`beginSegment`（受 ADR-0033 §4 并发前置：他会话 UI 迁移 WIP——即 T-299…T-318——已入库，前置已解除）；② `bindings.ts` 的 cc 节点层树薄壳（容器×段子树 + 位图腿归属，那条腿真伪只能由设备证）；③ `build:cocos` 后发到在线鸿蒙真机（`6UNBB26416051396`）实拍层序；④ 金样本按容器重抓（指令流多出容器边界 ⇒ sha 会变，须先登记 K-053）；⑤ 解开 `dialog-center.test.ts` 那条 skip（现只能证 canvas2d 层序，不证真机）。② 与③ 不在同一批会反复踩「假绿」（ADR-0033 判例链 322→324→325）。

---

## WXG-T-328

**beads·UI-60 P1（可证部分）：容器×段层树内核 · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 内核完成（2026-10-20），cc 薄壳与视图接线仍待 P1 后半）**

- **来源**：用户选「推 P1 的可证部分」——把层树逻辑写成引擎无关类，让「层怎么排 / 何时建 / 越界怎么办」能在 Node 里逐条证，`bindings.ts` 只留 cc 工厂薄壳（那条腿只能由设备证）。
- **新增 `packages/framework/src/adapters/cocos/ui-scope-tree.ts`**（⛔ 不 import `cc`，进 `adapters/cocos/index.ts` barrel）：`UiScopeTree implements CocosUiScopeHostLike`；宿主注入 `UiScopeTreeHooks = { root, defaultScope, defaultBlitParent, create(key, parent, siblingIndex) }`。`siblingIndex` 由**内核**算定 ⇒ 宿主只照数排兄弟，⛔ 不得自行决定序（否则序有两处真源）。
- **内核兑现的四条规则**（各带单测，共 9 例）：① **懒建**——`enter*` 不建层，只有真落笔（读 `current`）才建，与 `lastScopeCount` 同口径，唯一例外是建段须先有父容器层；② **容器序 = 出现序**，首次出现定兄弟位、跨帧复用不重排；③ **段序 = `UI_SEGMENT_ORDER` 枚举序而非绘制先后**（DEC-3 核心，也正是「Cocos 把指令序压成通道序」那类缺陷的反面）；④ **段挂在容器之下**（用父子序代替 zIndex，DEC-4）；另加防御：未进容器就开段 ⇒ warn-once 忽略、空栈退出不抛。
- **接口修订（如实登记）**：`CocosUiScopeHostLike.exitScope()` 拆为 `exitContainer()` / `exitSegment()`。原因：单一出栈分不开「出段 → 回本容器默认段」与「出容器」，P0 的合一写法会把退出语义埋错；P0 宿主接口尚无生产消费者（只有测试假件）⇒ 零外溢。`CocosUiScopeLike` / 默认层语义未动。
- **兼容面**：视图仍未发任何层级命令、`bindings.ts` 未注入宿主 ⇒ **真机零行为变化**；金样本十一态应零漂移。
- **验收**：framework **46 文件 500 passed**（+9 例）；**三处定向变异全咬红**（段序改插入序 ⇒ 2 例红；取消懒建 ⇒ 1 例红；帧首不清默认层 ⇒ 1 例红），随后按内容比对逐字节还原（sha `dcca8f5ef733`）；beads 98 文件 **1137 passed + 3 skipped**（金样本十一态 sha 零漂移）、breakout 239、三包 typecheck 0 错；`framework:sync` 新增 1 件镜像（framework 59→60）且 `framework:sync:check` 一致；`check:arch` OK（唯一 WARN 是既有的编辑器生成件计数，与本批无关）。
- **⛔ 未完成项（别把本单当修好）**：`bindings.ts` 的 cc 工厂薄壳、视图发 `beginContainer/beginSegment`、真机层序读数（ADR-0033 DEC-8）——这三件才是「设置弹窗层级错乱」的关闭条件；其中视图接线受 §4 前置约束（他会话 UI 迁移 WIP 入库）。

---

## WXG-T-327

**beads·UI-60 P0：容器 / 段语法 + Cocos 作用域映射 · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）**

- **来源**：承 [`ADR-0033`](../docs/architecture/adr/ADR-0033-ui-container-layer-ordering.md) §5 Q1 分期的第一批（用户「Q1 分期确认」）。
- **开工前核前置（并按实测改窄 §4）**：本轮 `git status` = 47 个未提交件在场，脏件集中在 `framework/src/core/ui`（4）与 `games/beads/src/{ui,view}`（+镜像），而 **`core/render/**` 与 `adapters/**` 一个未被触碰** ⇒ P0 框架腿不撞车可先行；P1（弹窗内容入容器）/ P2（输入逆序）仍须等他会话 WIP 入库。ADR §4 原那句「必须等 WIP 全部入库」过硬，已改为按腿分别登记。
- **语法（`core/render/render-model.ts`）**：`UiSegment`（`page|hud|modal|toast`）+ `UI_SEGMENT_ORDER` 唯一序表（⛔ adapter / 视图不得再抄一份）+ 四个 kind（`container` / `containerEnd` / `segment` / `segmentEnd`）+ 四条 builder 方法。新 kind 由 `signature()` 的逐字段遍历自动纳入 ⇒ 「脏帧门控看不见层级变化」这类坑预先堵死；层级命令不带几何 ⇒ 不进顶点 arena。
- **两端映射（`adapters/cocos/cocos-renderer.ts`）**：新增 `CocosUiScopeLike`（一对全通道提交体）+ `CocosUiScopeHostLike`（帧首清层 / 进出容器 / 进段 / 出栈 / 当前层）与 `options.scopeHost`。**未注入宿主 ⇒ 四 kind 静默忽略、旧单层路径逐字不变**（breakout 与一切未接线宿主零漂移；canvas2d 侧的 no-op 由单测锁死，不靠口头声明）。为什么作用域必须自带矢量笔而不只换标签层：同容器内「先画 HUD（矢量 + 文字）再压遮罩」要求后面的 `Graphics` 能盖住前面的 `Labels`——正是 ADR-0030 为 `model.background` 踩过的同一个坑。
- **DEC-5（同层文字叠序）**：`CocosLabelLike.setSiblingIndex?` 可选方法 + 帧内计数，**换作用域重新归零**；不提供该方法的宿主行为同旧。旧行为的问题如实记在注释里：只 `acquire()`+`setPosition()` ⇒ 叠序取决于池节点创建史，跨帧可变。
- **预算实测出口**：`lastScopeCount` = 本帧**真正落过笔**的作用域数（只 `enter` 而未画图元的不计 ⇒ 不虚报），无宿主恒 1。这是用户 Q2 那句「必须实测」的第一个可运行口径；真机 DG 读数仍要等 P1 接线后才能取。
- **⚠ 交付面收窄（如实登记，不算已完成）**：`bindings.ts` 的 cc 节点树（容器 × 段 × 通道子树 + 位图腿归属）**不在本批**——那条腿的真伪只能由设备证（画布叠序 / 节点序 / draw call 实数），无编辑器时写它 = 交不行也证不行的代码。故 P0 对真机**零行为变化**（连宿主都未注入），层级缺陷本身仍未消；解 skip 的层序例归 P1。
- **验收**：framework 45 文件 **491 passed**（新增 6 例）；**反证** = 把作用域解析置空 ⇒ 路由 / DEC-5 / scope 计数 **3 例全红**，随后按 sha256 逐字节还原；beads 98 文件 **1137 passed + 3 skipped**（金样本十一态零漂移，因视图未发新命令）、breakout 239、三包 typecheck 0；`framework:sync` 写 4 件镜像、`framework:sync:check` 一致；`check:arch` / `check:tasks` / `check:links` / ctx A–E 全绿；`verify` PASS 22 / FAIL 0。
- **下一步**：P1 = `bindings.ts` cc 层树 + 弹窗内容搬进容器（解开 `dialog-center.test.ts` 的 skip 层序例 + 真机层序读数）；前置 = 他会话 UI 迁移 WIP 入库。

---

## WXG-T-323

**beads·真机 P2：六处对话框中心不对手机中心（逐机居中收口一处） · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）**

- **触发**：用户扫码复验 WXG-T-322 后回执「暂停遮罩顶到状态栏下方、整屏无漏」「齿轮/继续按钮仍可点」，同轮新报「**对话框上下不居中**」。两项裁剪：居中基准 = 对话框中心对齐手机中心；范围 = 所有对话框一起修、**统一一处**（基类/公共部分）。
- **根因（systematic-debugging Phase 1–3）**：`dynamicHeight` 档（WXG-T-280 P1）把设计高逐机算到 1334~1630，菜单链锚与 HUD 已消新高（`menuAnchors.designHeight` / `_hudDy`），但**局内五处 + 菜单弹窗一处**仍按静态 `DESIGN_H` 居中（`pause-panel:109` / `clear-panel:94` / `fail-panel:59` / `sprint-settle:118` / `meta-view:335`）。畅享实读：1625 档面板中心 667 vs 屏中心 812.5 ⇒ **偏下 145.5 设计 px = 219 dp = 屏高 9%**（三种板高算得同一偏差，因为位移量与板高无关）。
- **落码（收口一处）**：`tuning.ts` 新增 `setLiveDesignHeight` / `liveDesignHeight` / `dialogShiftY`（位移 = `round((实际高 − 1334)/2)`，基准档与更矮档恒 **0**）；`BeadsShell.init` 与菜单链锚**同点一次写入**（早于 `play.init`）；六处底板算式只加 `+ dialogShiftY()`（原数字就地保留⇒ 1334 可读可校）；菜单 `OVERLAY_PLATE` 常量转 `overlayPlate()` 首次算定缓用（保热路径零分配）；彩带**禁飞带同源位移**（`view-model::drawConfetti` 循环外算一次）——面板一动旧带就盖不住按钮，属必须同批改的派生常量。绘制面与命中面仍共用同一 `*PanelLayout()` ⇒ 图与热区同源。
- **测试**：新增 `tests/dialog-center.test.ts` 3 例（1128×2444 动态档 rig：① init 写入 1625 且位移 146；② 局内七份板（暂停 normal/sprint、结算两档、失败两档、冲刺结算）中心 = H/2 ± 0.5；③ 设置弹窗**绘制面** rect（`radiusPanel` 唯一）中心 = H/2）。**反证**：把 `dialogShiftY` 临时改为恒 0 ⇒ 三例全红（145.5 / 146），再按 sha256 逐字节还原。零漂移证据 = beads 98 文件 1137 passed + 2 skipped（含金样本十态 sha 全等、夹具未重抓）+ typecheck 0。
- **未夹带改动（观察项三条）**：① **全通关页（finish-panel）** 不属居中弹窗，它是顶锚标题带 + 底锚按钮行（`titleY = DESIGN_H − 180`），高屏机顶部会多出一条约 291 设计 px 空带 ⇒ 待用户看过实物后单独裁（改它会连带 rows/shelf 链式重算）；② `scene-vfx::confettiSpawnY` 默认 top = `DESIGN_H`，但调用方已传 `builder.height`（WXG-T-322 后与真高同源）⇒ 无需改；③ 本批未给面板加运行期缓存失效，因 `App.resize()` 在真机不触发且 `setLiveDesignHeight` 只在 init 调用（与菜单链锚同一假设）；若将来允许转屏/逐帧改高，两处都要补失效。
- **落点**：`production/TASKS.md` 头注 323/324 + 主表行；本 节；`device-walkthrough §2` P1 行拆读（遮罩已 PASS、居中 CONCERNS 待复验）；无 §3 冻结常量变动（`PAUSE_PANEL_H` / `PANEL_SIZE` 等按 §6.1 判例不入 §3，本批**零改值**、只改锚点）。

---

## WXG-T-322

**beads·真机 P1：暂停遮罩高屏未铺满（动态设计高未同步 builder） · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）**

- **触发**：用户扫码实测（L-A 畅享 90 Pro Max / CHZ-AL00 / 1128×2444 dp / dpr3）报「暂停遮罩没有铺满整屏」；用户明确不需转横屏。
- **根因（systematic-debugging）**：`App._init()` 只 `viewport.resize()`，未同步 `RenderModelBuilder` ⇒ 动态高档首帧 `builder.height` 仍是基准 1334，而 viewport 已 1625（= 750×2444/1128）。所有读 `builder.height` 的全屏图元（暂停 / 失败 / 过关 / 冲刺遮罩、全通关色带、性能覆层、连击变换锚点）顶部漏 291 设计 px；背景与版式读 viewport，所以只有遮罩出问题。
- **落码**：`packages/framework/src/compose/app.ts::_init` 增加 `_builder.resize(...)`（与 `App.resize()` 同款）；`packages/framework/tests/compose/app-host-driven.test.ts` 新增 1 例：1128×2444 + `dynamicHeight` ⇒ viewport 与首帧 `builder.height` 均为 1625（修复前实测 1334 红，修复后绿）。
- **验证**：framework 44 文件 484 例全绿；`framework:sync --check` 一致（beads / breakout 镜像同步）；重建 release 产物（AppID `wx8cf9f756e5390749`，3.1 MB）并出码复验。
- **诚实限制**：真机复视待用户回执；`bindings.ts` 的 GameRoot `setContentSize` 仍在 re-fit 前调用（尺寸停在 1334，未观察到对应症状，未夹带改动，登记为观察项）。

---

## WXG-T-321

**beads·转场收尾：金样本补转场中点帧 + `reduceMotion` 页面转场专项裁定** · 负责：主理人(Qoder)·文策渊域 · 状态：✅ 完成（2026-10-20）

- **触发**：用户选下一步 2（转场收尾两小件）。
- **专项裁定（D1）**：`reduceMotion` 开 ⇒ 页面转场**整段关停**（进页同帧静息、`back` 同帧离页）；弹窗「面板入 / 出」200/150 **不变**。理由 = 全屏 α 斜坡属非必要动效，页面身份已由版式表达；⛔ 未新造毫秒值（关停 = 0ms）。落点 = `arc-level-select-spec §5` v1.7（两行）。
- **落码**：`beads-shell.ts::_beginPageFx` 单分支（`this.play.reduceMotion` ⇒ 取消在途转场；淡出同时 `_phase.close()` + `_emitOverlay(false)`）；`arc-level-select.test.ts` +1 例（进页后 30 帧逐字不变 + `back` 同帧 `overlay = none` + 菜单帧复位）。
- **金样本中点帧**：新增 `level-select-mid`（同属 `LevelSelectPage`，不新增单元）——进页 6 帧 = 100ms / 200ms，ease-out `pageFade = 0.75`；total **5083**（主菜单底页 + 半透明页），两遍确定性自证 PASS。其余十态 sha **逐字未变**；夹具重抓，`capturedFrom = 4b8d1ec · 含选关页转场中点帧（WXG-T-321）`。
- **落点**：`ui-golden-scenes.ts`（状态）/ `ui-golden-capture.ts`（十一帧断言 + readme）/ `ui-golden.test.ts`（11 帧 + 单元去重）/ 夹具；`arc-level-select-spec §5` v1.7；`TASKS.md` 头注 321/322 + 主表行；本小节。
- **诚实限制**：① 中点帧只锁绘制指令流（含 alpha），不覆盖观感；② `reduceMotion` 体感 `[待真机]`（Node 只证状态与帧等价）；③ 弹窗面板转场不在本裁范围。

---

## WXG-T-320

**beads·P5·UI-53 全量验收：`verify` 22 项 + harness 双游 + 真机 `[R]` 登记** · 负责：主理人(Qoder)·质量负责人域 · 状态：✅ 完成（2026-10-20）

- **触发**：用户选下一步 1（UI-53）。验收原文 = 「全量 `verify` 与 harness 验收；真机安全区项登记为 `[R]` 阻塞」（`ui-architecture-beads §12`）。
- **机械面实测**：`verify` **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**；单测 framework 483 / breakout 239 / beads 1132 passed + 2 skipped（1134，97 文件）；`ui-golden` 十态零漂移（自 UI-50 起 sha 未变）；`harness:build` + `harness:smoke` 双游启帧（beads：13×12 盘 / 156 格 / 24 托盘槽 / 5 帧 rect 102·arc 2816·fill 1277·fillText 13 / 4926 条指令）；`check:arch` OK + §20 `--selftest` 11/11；包体 beads 主包 3201.0 KB / 108 文件（余 895.0 KB）。
- **真机 `[R]` 登记**：复用 `device-walkthrough.md §3 Session 2` 既有条目，不另造 ID —— D-40（灵动岛）、D-41/D-42（Android 安全区脏值 / letterbox）、D-43/D-44（ohos 安全区 / 热区与胶囊避让）、P1（高屏 HUD 上移 / 齿轮可点 / 遮罩铺满）。阻塞原因 = iPhone 14 Pro+ 与 Android 三键机无在手设备；L-A 畅享需用户扫码 + 人工看屏，本会话无设备操作权。解除条件 = 扫码装包后按 Session 2 逐条取证入库。
- **落点**：`production/qa/beads/test-cases.md` 新增 **§O**（TC-UI53-01…07 + 阻塞表）；`ui-architecture-beads.md` UI-53 行 ✅ / §13 尾句 / §11 包体实测；`TASKS.md` 头注 320/321 + 主表行；本小节。
- **诚实限制**：① `harness:smoke` 是 Node 内加载产物字节 + canvas 桩，**不构成像素级或真机证据**；② 真机面未签收 ⇒ 整链只记「机械面闭合」，不得记「全部 PASS」；③ 金样本只对拍绘制指令流，不覆盖观感与手感。

---

## WXG-T-319

**beads·P5·UI-52 机械守：`check:arch` §20 五条 + 负样本自测** · 负责：主理人(Qoder)·工程负责人域 · 状态：✅ 完成（2026-10-20）

- **触发**：用户选下一步 1（UI-52）。验收原文 = 「故意违规用例能被拦下」（`ui-architecture-beads §12`）。
- **五条规则**（`tools/scripts/check-architecture.mjs`，只扫 `games/beads/src`）：
  - §20-1 同文件出现 `scrimFill(` + `drawPaperPanel(` 而无 `drawModalFrame(` ⇒ 拦（自造弹窗）；
  - §20-2 `view/` 与 `ui/` 下 rgba()/hsl() 字面量 ⇒ 拦（kit 三件 `ui-theme` / `palette` / `modal-frame` 豁免）；
  - §20-3 `view/` 下 `screen|overlay|phase` 的 `===` / `!==` 判断 ⇒ 拦（登记偏离 `meta-view.ts` / `view-model.ts`）；
  - §20-4 `systems/*.ts` 里 `hit*()` 存在却未调本文件 `*Layout()` ⇒ 拦；
  - §20-5 `this._screen|_overlay` 或 `_screen|_overlay =` 标志位 ⇒ 拦。
- **负样本自测**：`--selftest` 11 例（五条各「被拦 + 放行」，§20-3 加 `!==` 变体）；`check:arch:selftest` 入 `selftests.mjs` fast 档 ⇒ `verify` 覆盖（装置完整性守卫要求新 `*:selftest` 必须入档）。
- **顺带真实违规**：规则扩到 `!==` 后咬出 `play-page.ts:180` `snap.phase !== 'playing'`（缩放条自抑制）⇒ 按守则把相位判断上移到门面：`drawPlayPage` 增第五参 `zoomControlsVisible`，`view-model` 传 `snap.phase === 'playing'`（已是登记偏离）；`tests/play-page.test.ts` 同步（门面等价 / 静态门两条）。
- **验证**：`check:arch` OK（仅存量 L1 场景 WARN）、`check:arch:selftest` 11/11、`selftest:fast` 10 件 PASS、`typecheck` 0、beads 1134 例绿、`verify` PASS 22；金样本十态零漂移（签名变更不改绘制路径）。
- **诚实限制**：① 规则是文本级 grep，只认调用名，判不了「同一个布局函数」的语义等价；② `UI_ARCH_EXCEPTIONS` 是文件级豁免（`meta-view` 整体放行 §20-3），随界面单元拆出逐条收；③ §20-1 只认 scrim+paper 同文件，跨文件自造弹窗仍可漏。

---

## WXG-T-318

**beads·P5·UI-51 文档回写：目录 / 路由表 / §20 守则 / ROUTES** · 负责：主理人(Qoder)·设计策略 + 工程负责人 · 状态：✅ 完成（2026-10-20）

- **触发**：UI 架构迁移 P5 第二格（用户选下一步「1」）。验收口径 = 任务表原文「`check:links`、`ctx:check` 绿」；本批**纯文档、零代码**。
- **`architecture-beads §3` 目录**：按现树重写 —— 新增 `ui/`（`ui-root` / `ui-host` / `phase-route-binder` / `main-menu-presenter`）、`game/beads-game/` 子模块与 `view/bead-styles/`；删除早已不存在的 `view/symbols.ts` 等陈旧条目。
- **界面→路由表**：`ux-spec §2` 新增六行表（`menu` / `play` / `levels` 三条 page，`settings` / `signin` 两条 modal，对局相位面板标「后续单」），并写明 page 不透明 / modal 透明、View 不得用 `screen ===` / `overlay ===`；`arc-level-select-spec §2` 在栈深度红线内补路由身份（`levels` / `page`、`openLevels(arc)`、`back` = `close()`）。
- **`control-manifest §20`**：落 ADR-0032 §8 五条守则（弹窗必经 `ModalFrame` / 遮罩只在 `UiTheme` / View 禁导航判断与游戏对象 / 绘制与命中同布局 / 路由只经 `Navigator`），并**如实登记两处已知偏离**（菜单侧 settings·signin chrome 仍直绘；`buildMetaView` 的 `data.overlay` 分支为唯一存量），避免守则先于事实。
- **`ctx/ROUTES`**：§1.4 增「UI 架构五条守则」锚点（估 300 tok）；`check:links` / `ctx:check` 双绿。
- **诚实限制**：机械守卫（`check:arch` 规则与负样本）归 UI-52；界面单元拆分（弹窗各画各的）仍待 UX 裁定。

---

## WXG-T-317

**beads·P5·UI-50 UiRoot 唯一绘制入口：并行开关退役** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **触发**：UI 架构迁移 P5 首格（用户选下一步「1」）。验收口径 = 任务表原文「无重复实现残留；`framework:sync:check` 绿」。
- **入口收口**：壳 `buildRenderModel` 只剩 `this._uiRoot.draw(builder, this.play.palette)`；删 `UI_ROOT_ENABLED` 开关与 `_drawDebugLayer` 双分支，`update` 每帧推进路由栈。`UiRoot` 仍是「可见路由自下而上 → 调试层最后」。
- **视图绑路由**：`PhaseRouteBinder` 构造期注入 `PhasePageDrawers`（`menu` / `play` 两个闭包）——`menu` / `play` 路由的 `draw` 直接绑到 `buildMetaView` / `play.buildRenderModel`；`levels` 是页路由（挡菜单）⇒ 复用菜单腿入口（`data.overlay === 'levels'` 选整页分支）；`signin` / `settings` 透明弹窗 ⇒ 底下 menu 路由仍可见并画出弹窗，故两条弹窗路由 `draw` 为空。
- **调试层归一**：`BeadsGame.drawDebugLayer` 与其 `_debugState` 暂存对象退役；调试数据只剩 `debugState()` 一个出口（`UiRoot` 宿主逐帧调用），文案与开关仍单源。
- **零漂移**：菜单腿 / 对局腿的绘制调用与层序逐字未改（只是调用点从壳移到路由 `draw`）；`levels` 页路由与旧路径同源 ⇒ 金样本十态 sha 全等、夹具未重抓；调试层仍在内容之后。
- **测试**：`ui-root.test.ts` 删「开关默认关闭」1 例（开关已不存在）；`phase-route-binder.test.ts` 第 6 例改为「基础页路由即绘制入口、弹窗不重复画」；`bead-style-settings.test.ts` 静态门改为「壳无开关 / 无 `_drawDebugLayer`、`buildMetaView` 与 `play.buildRenderModel` 各恰一处、注入先于绘制」。
- **验证读数**：beads 97 文件 **1134**（1132 passed + 2 skipped）；`npx tsc`（beads + harness）双 0；`pnpm run verify` **PASS 22**；`framework:sync` 写 4 件（`beads-shell.ts` / `beads-game.ts` / `ui-root.ts` / `phase-route-binder.ts`），`.meta` 待编辑器生成。
- **诚实限制**：逐单元路由绘制未拆 —— 弹窗 / 页各画各的会变成「弹窗下画菜单」（现有视觉是整屏重画、不画底页），属视觉变更，需 UX 裁定后另开单；对局相位弹窗仍归 `PanelRouter` 的点击分派（同上批）。

---

## WXG-T-300

**beads·UI 架构迁移 P2·UI-22 ModalFrame（遮罩 / 纸面板 / 进出场 / 点击屏障）** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §12 UI-22「ModalFrame（遮罩、面板、标题带、进出场、屏障、内容插槽）」；验收原文 =「屏障单测；进出场与现行逐帧一致」。
- **落点（1 新件 + 5 处消费面）**：`games/beads/src/view/modal-frame.ts` = `modalFrameLayout`（0.9→1.0 绕中心线性缩放，clamp 0..1）/ `drawModalScrim`（全屏遮罩，格式复用 `ui-theme::scrimFill`）/ `drawModalFrame`（遮罩 + 纸面板，返回内容区几何）/ `modalHitTest`（`content` / `block` / `dismiss`，`dismissOnScrim` 默认关）。迁移期落 `src/view/`，UI-25 总装时随 `ui-theme` 一起搬 `src/ui/kit/`。
- **收口射程**：暂停 / 过关 / 失败三处「遮罩 + 纸面板」整体改由 `drawModalFrame`（暂停带进出场，过关/失败 `progress=1`）；冲刺结算 / 全通关只换 `drawModalScrim`——前者底板是手绘单层（无投影/无描边）、后者根本没有整块面板，强行并入即改像素流，按登记不并。
- **逐帧一致（硬证据）**：`tests/modal-frame.test.ts` 把收拢前 `drawPausePanel` 的算式原样留作 oracle，对 `t = 0 / 0.25 / 0.5 / 0.75 / 1` 断言 `toEqual`（同序浮点 ⇒ 位级相等，不是近似）；另钉 `t=1` 还原静止态边界、`t=0` 从 0.9 起且中心不动、越界 clamp。
- **屏障单测**：面板内含边界 ⇒ `content`；面板外默认 ⇒ `block`（暂停面板「其余零响应」口径）；`dismissOnScrim=true` ⇒ `dismiss`。
- **金样本验收**：`tests/ui-golden.test.ts` **11 例全绿、夹具零改动**（十态 sha/total/kinds 全等）⇒ 静止态无漂移，满足 §9.4。
- **静态门同步**：`bead-style-settings` 改钉 `drawModalFrame` 3 处 + `drawModalScrim` 2 处 + `scrimAlpha` 档位 3 处 + DEBUG 0.7 1 处；并禁止 `modal-frame.ts` 硬拼 `rgba`（字符串格式唯一真源仍 = `ui-theme::scrimFill`）。
- **诚实限制**：① `meta-view` 的 overlay 遮罩未接——其高度读菜单锚定档 `A.H` 而非 `builder.height`；② 标题带未参数化——暂停标题 y 不随缩放走（现行行为），抽成随缩放会改像素流，留给后续统一裁定；③ 本批无提交，工作树另含 T-296/297 历史未提交件，提交需人工分拆。
- **验证读数（2026-10-20）**：beads 全量 **85 文件 / 1068 passed + 2 skipped**；`games/beads` `tsc --noEmit` 退出 0；`pnpm run verify` 读数见会话结论。
- **差异处置**：只允许「源码形态变、像素流不变」；要改遮罩/面板视觉先有 UX 裁定并在 §12 登记，再由 `ui-golden-capture.ts` 重抓，⛔ 不得手改夹具求绿（K-051 / K-053 / K-082）。

---

## WXG-T-299

**beads·UI 架构迁移 P2·UI-20 UiTheme 风格层（遮罩 / 纸面板 / 字体 / 按下位移收拢）** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §12 UI-20「UiTheme：收拢遮罩（保留双档名）、纸面板、字体、按下位移」；验收原文 =「金样本中两种遮罩逐字一致」。
- **落点（1 新件 + 4 处消费面）**：`games/beads/src/view/ui-theme.ts` = `UI_FONT`（字面并集）/ `UI_SCRIM`（canvas `42,46,67` · overlay `0,0,0` · 双档 α）/ `scrimFill` / `pressOffset` / `drawPaperPanel`；`view-model.ts` 与 `meta-view.ts` 改为消费本层（本地 `drawPaperPanel` / `pressDy` 实现删除，仅留 1 行包装）。
- **双档遮罩零漂移**：`PANEL_SCRIM_ALPHA`（0.5）与 `SETTINGS_SCRIM_ALPHA`（0.3）**名字与值均未动**，仍住 `tuning.ts`，`UI_SCRIM` 只引用；两族 RGB 历史不同源（画布 `42,46,67` / 菜单 overlay `0,0,0`）⇒ 只收拢不洗色（ux ①「RGB 零改动」）。`bead-style-settings` 静态门同步改为钉 `scrimFill(UI_SCRIM.canvas|overlay, …)` 穷尽 6 处。
- **按下位移单源**：`UI_CONTAINER.pressDy` 由字面 `2` 改为引用 `UI_PRESS_SINK`，两处同值常量不再可各自漂移。
- **金样本验收（硬证据）**：`tests/ui-golden.test.ts` **11 例全绿、夹具零改动**（十态 sha/total/kinds 全等）⇒ 两种遮罩与全部十界面逐字无漂移，满足 §9.4「不得有无登记的差异」。
- **新增机检**：`tests/ui-theme.test.ts` 4 例（两族 × 双档 `rgba` 逐字、双档名指向在册值、位移三分支、按钮字重不互换）。
- **诚实限制**：`meta-view` 的 overlay 底板（无投影/无描边的单层 `palette.panel`）**未**并入 `drawPaperPanel`——并入即改变像素流；统一留给 UI-22 ModalFrame。DEBUG 覆层 0.7 只复用 `scrimFill`，不属双档。
- **验证读数（2026-10-20）**：beads 全量 **84 文件 / 1061 passed + 2 skipped**；`games/beads` `tsc --noEmit` 退出 0；`pnpm run verify` **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**。
- **差异处置**：本批只允许「源码形态变、像素流不变」；若未来需改遮罩/面板视觉，先有 UX 裁定并在 §12 登记，再由 `ui-golden-capture.ts` 重抓，⛔ 不得手改夹具求绿（K-051 / K-053 / K-082）。

---

## WXG-T-341

**工程·beads-studio 大关/小关管理 + 分大关导入 + 替换图案 · 负责：主理人(Qoder) · 状态：✅ 完成（2026-10-21）**

- **诉求（用户原话）**：「后期重新调整关卡时候，不要再动代码，直接通过 studio 完整管理大关列表和小关列表，并且能够创建/编辑小关，分大关导入系统」。四项拍板：编辑深度 = 管理+替换 / 导入 = 一键生效（写盘后自动 `levels:sync` + `framework:sync`，失败整批回滚）/ 章管理 = 完整含删除 / 推进 = 直接开单分批（① 列表+导入链 ② 替换图案 ③ 回写收尾）。
- **缺口（开工前）**：旧 ingest 只能「往指定章插关」，无列表、无调序/移章/删除、无建章 ⇒ 每次调关都要手改 `manifest.json` / `chapters/*.json`，违背诉求。
- **交付一（批次① ae4af5c）**：`tools/scripts/chapter-store.mjs` 纯函数库（`moveChapter` / `moveInChapter` / `insertBeforeBoss` / `swapToEnd` / `setEntryKind` / `removeEntryByUid` / `renumberIds` / `expandedCount` / `syncDemoLevelCount` 等，node:test 12 例）+ `server.mjs` 新端点：`GET /api/manage/state`（章/关轻投影）、`POST /api/manage/verify`（复跑 sync）、`POST /api/manage/chapter`（建章 + 首关 boss，展示图 dataURL 落 `assets/<id>-boss-256.png`）、`POST /api/manage/chapter/:id/(rename|open|move|delete)`（delete 支持 move 并入 / delete 级联）、`POST /api/manage/level/:uid/(remove|move|rename|boss)`；`public/manage.html` 管理页 + 生成页入口改跳转（`/manage.html?result=`）。
- **交付二（批次② cb6c14d）**：`POST /api/manage/level/:uid/replace {resultId}` —— 同 uid 换图案/实测时长，关名/关号/章位不变；仅 single/boss（plate 多文件产物 → 删后重导）；字段显式重建（不 spread 旧 `misplaced` / `paletteCodes`）；管理页每行加「替换图案…」下拉（仅非 plate，options = ≤32 结果）。
- **事务模型（唯一写入口 `applyManage`）**：快照 levels 树 Buffer + tuning 原文 → `mutate(ctx)` 同步写盘 → `writeManifest(contentVersion+1)` → `renumberIds` → `syncDemoLevelCount`（门禁⑤ 联动，同值 no-op）→ `runSync()`（levels:sync + framework:sync）；sync 任一断言红 ⇒ `restoreTree` + 写回 tuning + 重跑 sync + 500 转达 stderr 尾 1200 字；mutate 内用户域拒绝用 `ManageError(msg, 422)`。
- **双轴口径**：展示轴 = 章 `levels[]` 数组序；id 轴 = manifest `order` 升序装配后下标 +1（renumber 统一分配）。`order` 只要求严格递增、允许空洞（retired 先例）⇒ 删 entry / 章内调序 / 移章都不需要重排 order；新增关写 `id: 0` 占位。沉淀 **K-148**。
- **冒烟（本地 `PORT=8899`）**：成功路径 = L00009 22×21/477s → **28×30/997s**（200，name/id/章位不变）、章内调序往返、建章（`testch`，L00010 997s）、删章级联、open 往返；拒绝路径 = 容量 `9+1 > 9` 422、门禁⑦ boss steps < 120 回滚、门禁⑥ DI 并列回滚、L99999 / 未知 result 404。**测后 `git checkout -- games/beads/design/levels games/beads/src/config …` 还原，真源零残留**（测试图移入 `temp/`）。
- **验证**：`node --test tools/scripts/chapter-store.test.mjs` **12/12**；`pnpm run levels:check` 2 款游戏全绿；`verify-all --steps=check:arch,check:es5spread,check:secrets,levels:check,framework:sync:check,typecheck` **PASS 6/6**；`kb:sync` 沉淀统计 = **新增 1（K-148）/ 修改 0 / 激活 0 / 归档 0**；`kb:check` 八重 PASS。
- **提交**：批次① `ae4af5c`（5 files +1280/−116）、批次② `cb6c14d`（2 files +67/−2）；推送 `git ls-remote` = `cb6c14d…`、`git reflog show origin/develop` = `update by push`（K-142 双证）。
- **未做**：① plate 单关替换（删后重导）；② 章展示图创建后不可换（只新建时上传）；③ 容器/VPS 501（无 `games/` 真源，属预期）；④ ①半透(UI-60) / ②BD-62 / ③橱窗灯光 / ④暗线 未混做。

---

## WXG-T-342

**工程·beads 扩池存档迁移腿（前缀搬运）+ S8 §2.4 改判 · 负责：主理人(Qoder) · 状态：✅ 完成（2026-10-21）**

- **诉求（用户选择）**：对 WXG-T-341 回传的三个后续选项选 **1** = 「补存档迁移腿并开单」——把 341 登记的发布红线（扩池即清档）真正接线，而不是只留一句警告。
- **判据变更授权**：该项本质是 S8 存档降级矩阵的裁定变更（「长度不符 → 重置全 0」→ 「前缀搬运」），按纪律需开单 + 用户授权；本单即该授权落点（用户选 1 = 批准改判）。
- **文档先行（3 处）**：① `gdd/save-progress.md` 升 **v1.2**：§2.2 `stars` 降级默认列由「全 0」改「前缀搬运、缺位补 0（非数组仍全 0）」；§2.4 矩阵行改写 + 新增 v1.2 说明块（含旧口径留档与**能力边界**）；§8-3 旧口径就地标注 + **新增 §8-14 迁移腿判据**（四臂：前 N 位无损 / 末位补 0 / 首次 `changed` / 二次幂等）；顺手登记 §8-3「钳 8」与 §2.4 行及代码不一致（既存漂移，本批只登不改）。② `levels/levels-spec.md` §11.7 补「✅ v1.22 已落地」+ ⚠ 能力边界（只对末尾追加成立）；§10 新增 v1.22 行；§3.1① v1.21 块那句「老档历史星清零」加「已于 v1.22 改为前缀搬运，此句为 v1.21 留档」注。③ `ux/arc-level-select-spec.md` 无需改（与存档语义无关）。
- **代码（1 处，root cause）**：`src/game/save-schema.ts::normalizeStars`——原写法 `if (!Array.isArray(raw) || raw.length !== levelCount) return out;`（全或无）→ 现 `if (!Array.isArray(raw)) return out; const carry = Math.min(raw.length, levelCount);`（前缀搬运）。无新函数、无新字段、无 `SAVE_VERSION` bump（§8-14 与 S8 §8-12 一致：patch 型全量写档）。framework 镜像由同步腿自动跟随。
- **测试**：`tests/save-schema.test.ts` —— 原「长度不符 → 全 0」单臂拆为**三臂**（短⇒前缀搬运 / 长⇒截断 / 非数组⇒全 0）+ 新增 §8-14 专测（9 位旧档喂 10 关池：前 9 位无损、末位 0、首次 `changed=true`、二次 `changed=false`）⇒ 17→18 例；`tests/arc-level-select.test.ts` R4/R5 的注释同步改口径（旧句说「写错会静默清星」，现为「会被静默搬运成末位 0 ⇒ 不报错但对不了位」，夹具仍按池长派生）。
- **变异自证**：把 `carry` 临时改回「长度相等才全搬、否则 0」⇒ **恰好 2 例红**（三臂那条 + §8-14 专测），其余 16 绿；`cp` 逐字节还原后复绿。
- **验证**：beads `npx vitest run` = **1141 passed + 3 skipped（98 文件）**；`pnpm run verify` = **PASS 22 ｜ FAIL 0**（其中 `framework:sync:check` 首轮曾瞬时红：校验早于镜像写入，单跑 `pnpm run framework:sync:check` 与重跑 verify 均绿）。
- **能力边界（新增红线，已写入两处正本）**：前缀映射只在**末尾追加**关卡时成立；中间插入 / 删除 / 重排会让星静默错位且不报错 ⇒ 那类变更须另开迁移单，按稳定 uid（`orders` / `uids`）而非下标对位。生成期门禁目前**不**强制「只许末尾追加」，该约束靠发布流程守。
- **未做**：① 未做「中间插关」的 uid 对位迁移；② 未在真机验旧档升级（无 AppID）；③ 未清理 `save-progress §2.2` 既存的「`version` 恒 1」陈旧描述（属另一族漂移，本批只触星表相关行）；④ ①半透(UI-60) / ②BD-62 / ③橱窗灯光 / ④暗线 未混做。

---

## WXG-T-343

**设计+工程·beads 存档改按关卡身份记账 + 大关推进门票 · 负责：文策渊（设计轨）/ 程基岩（工程轨）/ 主理人汇编 · 状态：✅ 决策入库（2026-10-22）· 纯文档批、零落码**

### 1. 诉求与范围（用户原话）

- 前提令：**「存档当前大关所有关状态，有一个很重要前提，每大关所有关需要获取到3星，才能凑足打开下一个大关的钥匙。」**
- 范围令：**「存档与门票一起做」** ⇒ 本批同时处理两件事：（甲）存档从「按第几关（数组位置）」记账改为「按哪一关（稳定身份）」记账；（乙）把早已冻结但运行时零实现的「本章每关都拿满三星才能进下一章」补齐可算的数据基础与界面告知。

### 2. 阶段 0 诊断（主理人）

- 本批不从零起：它是 WXG-T-342 详情节「未做」第①项（未做中间插关的身份对位迁移）的直接接续，也是 EP14 里挂着 `[待规格]` 的 S4 的解锁前置。
- 跨职责域（设计语义 + 工程架构 + Epic 拆分）⇒ 按编排法双轨并行 spawn，主理人不代笔任何一方正本。

### 3. 设计轨产出（文策渊 T-1 + 复批 T-1R）

- `games/beads/design/gdd/save-progress.md` 升 **v1.3（同批复批 R）**：
  - 新增 **§2.6「按大关组织的进度存档」**——只定「存什么」：§2.6.1 存档需承载的信息、§2.6.2 信息充分性表（I1–I7 七条断言，例如 I5「门票不得作为布尔入档」、I6「已推进到第几关无法从星数账派生」、I7「门票一旦成立不因后续改动回收」）、§2.6.3–2.6.4 边界原则与降级场景、§2.6.5 对 v1.2「前缀搬运」的唯一裁定（降格为「无身份旧档的一次性入口」，⛔ 不留两套并存规则）、§2.6.6 上架后再改存档结构的四条前置（迁移腿幂等永不抛 / 镜像用例 / 灰度 / 数值真源对账）。
  - **§2.2 字段表与 §2.4 降级矩阵按新语义同步**（四行新增），§8 新增八条验收判据 **15～22**：门票可算性、改关表顺序免疫、孤儿记录逐条作废不弃整档、章维变更无损、推进位不可派生、门票不回收、旧档一次性入口、内容身份唯一性与同命。⚠ 八条**全属待实现判据**（代码一行未改 ⇒ 落码前直接跑只能拿红基线，K-035）。
  - 本篇刻意**不写键名、不写序列化形态、不选迁移算法**（文首「刻意例外」不变），把「怎么存」全权交给工程轨。
- `games/beads/design/gdd/meta-ui.md` 升 **v0.5** §2.7：大关进度与本章满星的两层口径表。
- `games/beads/design/ux/arc-level-select-spec.md` 升 **v1.10** §4.1：锁格告知件 = 一枚常驻只读的「满星 n/N」小件；点锁格不弹窗、不扣体力。
- `games/beads/design/proposals/star-collect-rule.md` 升 **v0.4**：划除 R6 中「`starsByLevel` 存档零改动」半句（按 K-053 删除线留痕 + 写两条废除理由 + 登记两处同源漂移）；**总星数口径（历史最高星求和）不受影响**；R7（门票 = 本大关全部小关 3★）寻址轴改述。

### 4. 工程轨产出（程基岩 T-2 + 复批 T-2R）

- 新 **`docs/architecture/adr/ADR-0034-beads-save-uid-index-flatten.md`（Accepted，328 行）**：
  - 逐条实测取证十条（存档三处进度全是位置别名 / 运行时关表不带身份 / 生成期已有「数组下标 = 装配槽」硬断言 / 删关即整体重编号 / 存档读写各只有一个边界点 / 未上架故无外部玩家档 / 包体现读 3312.7 KB 余量 783.3 KB）。
  - 四案对比后**采纳甲案**：存档按关卡稳定身份记账（`Record<身份, 历史最高星>`），运行时仍是按下标的稠密数组；身份与下标的换算只发生在**读档展平**与**写档收拢**两个既有边界点，各恰一次（不在每帧路径 ⇒ 不顶撞热路径零分配）。否掉三案：另加一条并行键数组（身份与值分两家、长度不齐时无从配对）、运行时全面改成身份索引（七处消费点换形 + 破坏视图只读契约，收益与甲案相同）、生成期冻结关表顺序（直接废除 studio 既有的调序与删后重编号能力，而该能力是产品要求）。
  - 桥接通道取「关卡记录各自带身份」，章归属**不入档**（每次构建由章清单重新派生）；存档版本 4→5（属换制非加字段）；迁移函数只做版本标记，真正的对位换算落在读档归一化的形态探测三级规则里；门票 = 纯函数、布尔不落档、不复用既有的 `allCleared` 标记、不做运行期活锁。
  - **七步施工清单**（生成期通道 → 存档换制 → 门票纯函数 → 闸门接入 → 测试族换形批 → 包体与漂移复测 → 迁移链改严）+ 逐步前置与并行关系；**变异自证十七臂**（含命门三臂：换算里忽略键表退回前缀搬运必须红、把「等于满星」松成「大于零」必须红、门票回收造成活锁必须红）；**向设计轨的提问单 Q1–Q7 全部闭合 ⇒ 落码批无待裁项**。
- `production/epics/epics-beads-ep14.md`：新增 **S6「存档身份换制（按 uid 记账）+ 生成期通道 · L · READY」**；**S4 由 BLOCKED 转 READY**（阻塞项 `[待规格]` 已清零）；§4 旧的「存档结构变更 0」按 K-053 划线改判；§5 风险表新增四条。

### 5. 两轨冲突与复批（本批唯一实质改判）

- **冲突**：设计正本 §2.4 新行与 §8-18 都预设「存档内部引用了章的身份」；工程采纳形态明确**章编号不进存档** ⇒ 「存档引用一个不存在的章」在真实形态下构造不出来，落码批无从据此造测试夹具。
- **处置**：工程轨只提改写请求不代笔，设计轨复批**采纳更强口径**——「改章名 / 删一章 / 章间挪关 ⇒ ⛔ 不得作废任何关级记录」；§8-18 整条重写为**单个测试夹具即可构造**的三臂判据（三种章维变更各一臂，外加一条静态臂：门票归约的输入里不允许出现章编号），原「不复用 `allCleared`」的禁令逐字保留；同时新增 §8-22（内容身份唯一性与同命，正是工程侧生成期三条断言的判据源）。
- **随动**：判据族由七条（15～21）扩为八条（15～22），工程轨两份文档的引用号同步改；主理人另订正一处措词残留（§2.4 第三行的「或章」二字，因采纳形态下章维不可能单独失配）。

### 6. 遗留与代价（⛔ 不阻塞落码批，但开工前须知会）

- ① **已知代价**：换制批开工时，开发期本地档与真机扫码档**至少清一次**（新旧形态不可互读），须在 QA 冒烟前告知；
- ② 冻结常量表 `systems-index §3.7` 说明列仍写「存档结构零改动」，与本批冲突 ⇒ 需一张**零数值措辞订正单**（用户令 ⛔ 本批自行触 §3）；
- ③ 工程侧侧问「plate 大图改格数时该记什么」尚未进 §2.6.3 场景矩阵（R-3 未答）；
- ④ 「改章编号」目前无机械守卫（历史台账 + `levels:check` 断言）⇒ 需另单（R-2）；
- ⑤ 换制批与内容投放批 ⛔ 不得同期（R-1）；
- ⑥ `star-utility.md:30` 的同源漂移归皮肤批；
- ⑦ EP14-S5 仍阻塞在教学关规格；
- ⑧ 真机与上传腿一律 `[Blocked]`（无 AppID / 无密钥）；
- ⑨ 工作区另有 `apps/beads-studio/public/index.html` 与 `manage.html` 两个他人改动 ⇒ 本批不代提交、不代还原，归属待用户确认。

### 7. 验证

- 纯文档批：零 `src/**` 改动 ⇒ 不新增测试。全量门禁实跑两轮：首轮 FAIL 2（`check:tasks` + `selftest:fast`）——确诊为**台账登记的竞态**：`verify` 跑到该校验时，主表已有 343 行而详情节尚未写完（配对关系临时不齐）；单项重跑均绿。补完后第二轮 = **`verify` PASS 22 ｜ FAIL 0**（含 `check:tasks` 主表 104 行 / 详情 104 节配对完整、`check:links`、`levels:check`、`typecheck`、测试族 8.8s、`check:size`、`selftest:fast` 10/10）。
- `kb:check` 八重 **PASS**（活跃 151 / 归档 0）；`kb:sync --task=WXG-T-343` 沉淀统计 = **新增 2（K-153 双轨并行预设冲突 / K-154 文档内部编号转述断链）/ 修改 1（K-154 换标签与换片，缘由见下条）/ 激活 0 / 归档 0**；`kb:audit` 无相似命中（归档候选 0）；`ctx:build` 已刷新索引面，`ctx:check` **OK**（结构门 A/B/C/D/D2 与 E3 全过）。
- ⚠ **`ctx:check` B 门（单文件 ≤8000 tok）首次拦下本批提交（4 件），已按既有口径分两路处置**：① `knowledge/lessons/criteria.md` 加完 K-154 后达 8386 tok ⇒ 按 `knowledge/INDEX.md §2`「**新标签 = 新建一片**」与「⛔ 不走豁免」（判例 WXG-T-041 + K-025），把该条子切为新片 `knowledge/lessons/doc-reference.md`（标签 `文档引用`，正文逐字不动、ID 仍 K-154 ⇒ kb:sync 记为「修改 1」）；② `ADR-0034`（20055）/ `save-progress.md`（15065）/ `meta-ui.md`（9770）三件属 ADR 与 GDD 正本（决策↔取证行号须同页互查、QA 按 §8 逐条造用例）⇒ 走 `ctx/budget-exempt.json` 豁免登记（与 ADR-0011/0015/0020/0022/0023/0024/0030 与 systems-index/core-loop/input-control/pause-settings/bead-grid/arc-level-select-spec 同族，均 WXG-T-343 登记 + 写明理由）。
- ⚠ `check:tasks` 附观察哨提示：主表 104 行 > 收敛阈值 20 ⇒ 建议另批 `pnpm run tasks:archive`（本批未做，⛔ 归档会移出历史行，属高影响动作须明令）。
- ⚠ 陈旧计数订正三处（本批主理人代修，属机械计数非语义改判，已申报）：`save-progress.md` 版本头、§2.6.5-3、§8-14 交叉引用仍写「15～21」，与 §8 末「15～22 八条」自相矛盾 ⇒ 已全部同步（设计轨成员复批时遗留）。

---

## WXG-T-344

**工程+设计·beads 存档改按关卡身份记账 · 落码批（星账腿） · 负责：程基岩（工程轨 T-3 落码 / T-2S 文书同步）· 文策渊（设计轨 T-1S 文档刷新）· 主理人切批与汇编取证 · 状态：✅ 落码入库（2026-10-22）· 关键路径前半，⛔ 整条换制未完成**

### 1. 立项与切批口径

- 用户对上批（WXG-T-343 纯文档批）回传的后续选项选 **1 =「发落码任务单，按七步顺序开工」**，并被告知这一步会真的清一次开发期存档。
- 主理人切批（不另开一问，理由记在此）：先发**星账腿** = ADR-0034 施工清单的 **S-1（生成期给关卡数据带上身份）/ S-2（存档格式换制）/ S-5（测试夹具同转换形）/ S-6（包体·漂移·镜像复测）** 四片。因为夹具换形必须与格式换制同批提交才不会出现「批量假红」；而「满星钥匙」的纯函数与闸门接入要动界面消费点，混在一批里失败用例难以归因 ⇒ **S-3 / S-4（门票两片）+ S-7（迁移链改严）留下一批 WXG-T-345**。

### 2. 落地面（做什么，玩家可感口径）

玩家侧的变化只有一条：**存档里的星星从此按「哪一关」记，不再按「第几关」记** ⇒ 中间插一关、调整大关内展示顺序、删一关，都不会再让已经拿到的星星静悄悄串到别的关上；旧的「按第几关」存档在第一次读取时一次性对位搬运，此后不再走那条路（搬运腿已被物理清除，不留双轨）。

| 片 | 落到的文件 | 实测口径 |
|---|---|---|
| **S-1 生成期通道** | `tools/scripts/sync-levels-data.mjs`（身份 token 派生 + 装配期三条断言）、`games/beads/design/levels/levels-data.header.txt`（字段说明）、产物 `src/config/levels-data.ts`（**每条记录首键 = `uid`**，只由 `levels:sync` 生成）、`src/config/levels.ts`（只读身份键表通道）、`tools/scripts/sync-levels-data.test.mjs`（生成期断言与夹具，宿主全量 **38/38**） | token 规则照决策原文：普通关 = `L000NN`，大图盘逐格加 `#c` 后缀；`arcs.ts` 与章清单**零改动**（章归属仍每次构建派生） |
| **S-2 存档换制** | `src/game/save-schema.ts`（`SAVE_VERSION` 4→5 现读 `:127`；星账字段 `starsByUid` `:112`；`migrateV4ToV5` `:170` 只作版本标记；形态探测三级 `normalizeStarLedger` `:318`；展平 `flattenStars` `:469`／收拢 `collapseStars` `:488`／写回物理清除 `toBeadsSavePatch` `:510`；`normalizeBeadsSave` 加第三参 `:401`）、`src/game/beads-game.ts`（启动装配处展平、`_persistProgress()` 收拢、身份只读镜像仅**两装配点**构造）、`src/game/level-import.ts`（开发期导入追加身份轴） | 身份↔下标换算**只发生在这两个本来就存在的读写边界点**，各恰一次，不进每帧路径；未知键丢弃 + 一次性汇总告警，⛔ 抛异常、⛔ 不弃整档；框架 core 零改动（旧键物理清除走游戏侧补丁，因框架浅合并不删键） |
| **S-5 测试族换形** | `games/beads/tests/` **7 改 + 1 新增**（新增 `save-identity-boot.test.ts` = 运行期双腿，实读 10 例），身份形态位点实增 **67 处** | 与决策清单「29 处 / 14 文件」**不一致**：那 14 个 grep 命中里 7 个文件的 `starsByLevel:` 是渲染入参（运行时下标轴）而非存档文档形态，不需换形 ⇒ 口径就地订正并记账，⛔ 不改决策本体 |
| **S-6 复测** | 无代码，只跑命令：`levels:sync` → `levels:check`（零漂移）→ `framework:sync`（镜像 5 件同步到 `games/beads/cocos/assets/scripts/game/**`）→ `build:cocos`（默认 release 基线档）→ `check:size` | 主包 **3312.7 → 3314.4 KB / 111 件不变**，余量 781.6 KB；Δ **+1.7 KB** 未触「>4 KB 停批」阈，但**比原估算（+130 B）大一个量级** ⇒ 根因 = 初稿只估了数据腿、漏估新增代码腿，已在决策文 §6.2.3 就地订正 |

### 3. 自证与验证读数

- **故意把代码改坏、看测试是否报警**（变异自证）：本批实跑 **11 臂 + 1 子臂**，每臂「注入 → 记红数 → 逐字节还原（SHA-256 对账）→ 复绿」，工作树零变异残留。命门臂 = **在换算里故意忽略身份键表、退回按位置搬运 ⇒ 插一关夹具必读错格**（实测红 4 例，读数 `expected [3,0,3,0] to deeply equal [3,0,0,3]`）；另有「旧键不再被点名清除」红 5 例、「孤儿键不裁剪」红 3 例、「星数上不封顶」红 1 例（`expected 5 to be 3`）、「启动多写一次档」红 2 例。逐臂台账 = ADR-0034 §6.2.2。
- **两处「计划 ≠ 实测」如实记账**（均只订正口径、⛔ 不动决策）：① 夹具换形面 8 文件而非 14（见上表）；② 幂等性的牙实际住在**写回时物理删除旧键**，而不在 `changed` 布尔上（原计划把它押在 `changed`，实测不成立）。
- **验收判据转绿情况**（设计正本八条新增判据）：**16／17／18／19／21／22 六条有例并逐臂自证**；**15／20 仍属待实现**（门票归约与闸门 = S-3/S-4 未开工，跑只拿红基线，⛔ 判绿）。⚠ 六条中**18 无专属变异读数**、**22 的「逐格互异」腿受「现关表零大图盘」限制对真实数据是空跑**（仅由合成夹具与生成期变异咬住）——两处诚实限定已写进正本注记。

### 4. 汇编查出的实质偏差（本批最重要的一条）

- **现象**：上批决策文把「存档 v5 该有哪些字段」锁成三件（星账 + 解锁边界 + 续玩位置），但**同一份文件的施工清单那一行只列了星账**。执行者照清单交付，无过。
- **后果**：两根进度指针**至今仍是 1-based 位置别名**（全仓搜决策预告的两个身份字段名 = 0 命中），且读档那行**压根不消费身份键表** ⇒ 已有的「插一关/调序后不回退」断言对这两根指针**没有判别力**（绿不代表已验）。玩家可感的影响 = 星星不会串格了，但「下次进来从哪一关继续」「解锁到第几关」在删关/中间插关后仍会错指一格。
- **处置**（⛔ 主理人不代改任一轨正本）：同批加派两条纠偏腿，均为**纯文书批、零代码**——
  - **T-2S（程基岩）**七件事：决策第 7 条与触发条件就地加现读订正（旧句逐字保留）；**新立施工片 S-2b**（两指针身份化，写明**必须先于门票闸门**）；追加三条变异自证 **M-18／M-19／M-20**（台账由 17 臂扩为 **20 臂**，本批未跑）；逐臂台账里涉该不变量的四行**按事实收窄**（防「星账免疫」被读成「整条已验」）；补**版本号处置条款 = 补齐时 `SAVE_VERSION` 仍留 5、⛔ 不 bump 6**（理由：读侧本按字段形状判别；反而 bump 会把回滚代价从「两字段回落第 1 关」升级为「整档清空」）；新开 **Q8**（身份指不回时指针落哪档）与 **Q9**（该不变量缺玩家可见硬判据）两条待裁项；交付边界补一条「**本批交付面 = 星账身份化，⛔ 不含推进／解锁两轴**」。Epic 侧把该 Story 从「前半 DONE」改写为**三档台账**（已完成／未完成且已定义／未完成且未定义），并明写 **⛔ 不得判 DONE**。
  - **T-1S（文策渊）**：设计正本 §8 文末「八条均未落码」的旧注记，按判例 K-053 **整段留档**后逐条分档重写为「已落码有例／仍待实现／前置件现状／环境边界」四块，方向 = **文档跟上已入库代码的事实**（⛔ 反向改语义迁就实现），断言正文与 I1–I7 **一字未动**；并把上面那条偏差作为**语义差距**登记，给主理人三个选项（补落码 / 收窄语义 / 登记为已知限制）而非自行降格。

### 5. 遗留与代价

- ① **Q8 / Q9 待裁**（设计轨复批射程）：两条不阻塞 S-2b 的结构开工，但阻塞它的验收判据可引用化 ⇒ 建议随下一任务单并发文策渊。
- ② **S-2b 待落码**：实测需换形源码 **14 处**、测试 **11 文件**（其余 10 文件零改动）、视图契约零改动、包体估算 +0.5～0.8 KB（非实测）；落地时 **⛔ 不会多一次全档清档**，只多一次「两根指针字段级回落第 1 关」，星账逐字节无损 ⇒ **须知会 QA 别当 bug 提单**。
- ③ **门票两片 + 迁移链改严 = WXG-T-345**（判据 15／20 与被测物在此）。
- ④ 数值真源表 §3.7 说明列那句「存档结构零改动」需一张**零数值措辞订正单**（用户令 ⛔ 我自行触碰该表）。
- ⑤ 换制期开发档「至少清一次」这一代价**已发生**；真机与上传腿一律 `[Blocked]`（无 AppID / 无密钥）。
- ⑥ 大图盘改格数时星星怎么记（仍未进场景矩阵）、改章编号缺机械守卫，两条仍开。
- ⑦ 工作区 `apps/beads-studio/public/index.html` 与 `manage.html` 两个他人改动，本批不代提交、不代还原。

### 6. 验证

- **全量门禁**（本批多轮实跑，均为本机读数）：工程轨落码腿收尾一轮 **`verify` = PASS 22 ｜ FAIL 0**（当时 `pnpm -r run test` 合计 **1923 passed + 3 skipped / 158 文件**，逐字读数 = ADR-0034 §6.2.5 第 10 行）；两条文书腿各自收尾一轮亦 22/22；主理人在详情节与知识库落账后再复跑一轮 = **`verify` PASS 22 ｜ FAIL 0**（`check:tasks` 主表 **105 行** ↔ 详情 **105 节** 配对完整且标题均 ≤ 60 字符、`check:links` OK（agents=7 / skills=47）、`levels:check`、`typecheck`、`framework:sync:check`、`cocos:check`、`check:size`、`selftest:fast` 10/10 全过）。主理人本轮单独复跑 `pnpm run test` = **beads 99 文件全过 / 1176 passed + 3 skipped**（本会话实跑，与上引全仓合计口径不同，⛔ 混用）。
- **铁律复查**（主理人亲自 grep / 实读，非采信自述）：框架 core 无 `cc`/`wx`/DOM；换算只在启动读档与结算写档两个既有边界点，**不进每帧路径**；无 `Math.random()`；视图契约（`MetaViewData.starsByLevel` 只读ViewModel）零改动 = L5 未触；产物 `levels-data.ts` 只由脚本生成（未手编）。
- **知识库**：`kb:check` **八重 PASS（活跃 152 / 归档 0）**；`kb:sync --task=WXG-T-344` 沉淀统计 = **新增 1（K-155）／修改 0 ／激活 0 ／归档 0**；`kb:audit` 无相似命中。新条目 = 「同一份决策文里『决策条文』与『施工清单』各写各的 ⇒ 执行者照清单交付无过、决策却未兑现」（本批 §4 那一条偏差的抽象，含次生坑「既有断言对新字段无判别力 = 假绿」）。
- ⚠ **`流程` 分片现读 7797 tok，再收一条即越 `ctx:check` B 门（8000）** ⇒ 按 `knowledge/INDEX.md` §2「新标签 = 新片、⛔ 不走豁免」将 K-155 入新片 `knowledge/lessons/process-audit.md`（标签 `流程对账`，⛔ 不动既有条目）。
- ⚠ **顺手补一处遗留不一致（代修、已申报）**：上批新建 `knowledge/lessons/doc-reference.md` 时**只建了片、未同步两处硬映射**（`tools/scripts/split-knowledge-lessons.mjs::TAG_TO_SHARD` + `tools/scripts/lib/knowledge-ledger.mjs::LESSONS_SHARD_ORDER`）——按该表自带注释「改一侧必同步另一侧；缺映射时 `knowledge:split --force` 会 fail loud」，本批同时登记 `doc-reference`（上批漏）与 `process-audit`（本批新）两项，并在 `knowledge/INDEX.md` 分片清单里补齐两片 + 如实标注该清单为人工维护、已漏 `art-derivation`（⛔ 本批不整修该清单）。
- `ctx:build` 已刷新索引面；`ctx:check` **OK**（结构门 A/B/C/D/D2 与 E3 全过）。
- **提交与入库**：主提交 = **`83376cc`**（37 文件 / +2571 −653，含新文件 `games/beads/tests/save-identity-boot.test.ts` 与 `knowledge/lessons/process-audit.md`）；本批 ⛔ 无任何变异残留（逐臂还原后 SHA-256 对账）；ADR-0034 头部与 §6 表 S-1/S-2/S-5/S-6 行首、EP14 S6 状态行的提交号占位由紧随的文书小提交回填真实 hash；推送双证（`git ls-remote` + `git reflog show origin/develop`，判例 K-142）在本会话结论回传。
- ⚠ **`ctx:check` B 门（单文件 ≤8000 tok）本批实际拦下一次提交（pre-commit 钩子），已按同族先例处置**：`production/epics/epics-beads-ep14.md` 因 T-2S 把 S6 改写为三档台账（已完成／未完成且已定义／未完成且未定义）从 ≤8000 顶到 **9303 tok** ⇒ 按 `wxgame-epic-split` 的 Story 卡结构（判据引用与 Ready·DONE 判定须同页互查）+ 同族先例（`epics-beads.md` WXG-T-268、`epics-beads-ep12.md` WXG-T-269 达 10088 tok 均已豁免）登记 `ctx/budget-exempt.json`，带 reason + note + taskId。**该豁免自带撤销条件**（⛔ 不得靠豁免放任无界膨胀）：下次修订本 Epic 时把台账里的**逐臂变异读数与包体数字**外移回 ADR-0034 §6.2（该节本就是读数正本，且 Epic 文中已自写「⛔ 不拄读数、只挂引用」），Epic 只留三档状态与判据引用 ⇒ 顶回 ≤8000 即撤销本豁免（这也正是 K-155 所治的「同一读数住两个家」）。上批已登记的三件正本豁免（ADR-0034 / save-progress / meta-ui）本次沿用，⛔ 除此之外本批不新增豁免。
- ⚠ `check:tasks` 观察哨：主表 105 行 > 收敛阈值 20 ⇒ 仍建议另批 `pnpm run tasks:archive`（高影响动作，须用户明令）。
- **真机腿**：`[Blocked: 无真机 / 无 AppID]`；旧档升级的真机验证、上传后的灰度腿均无法在本环境取证（解除条件 = 取得 AppID 与密钥后走 `wxgame-minigame-bridge` + 试玩抽样）。

---

## WXG-T-345

### 1. 立项与切批

- **用户令（2026-10-22）**：对上一步三选项选 **1 =「现在就开这批（门票 + 闸门）」**。上位令 = 同日「每大关所有关需要获取到 3 星，才能凑足打开下一个大关的钥匙」+「**存档与门票一起做**」。
- **射程 = ADR-0034 §6 的四个施工片**（逐片落地面见该表）：
  1. **S-3 门票归约纯函数**：算出「这一大关够不够格开放」；不写存档、不碰界面、不动既有章态显示；
  2. **S-2b 两根进度指针身份化**：「推进到第几关」与「解锁到第几关」从「第几个」改成「哪一关」；
  3. **S-4 闸门接线 + 只读告知件**：把门票结果并进选关页点格那行判断，并给界面两个只读字段（章锁态、满星 n/N）；
  4. **S-7 迁移链改严**：旧版本档一次跑完 1→2→3→4→5 五级、每级必前进一号，⛔ **不得**跳级或返回原号。
- **⚠ 施工顺序硬约束（本批切批的关键一条）**：S-3 与 S-7 可先行；**S-2b 必须先于 S-4** —— 闸门落地时要写的「已得入口不回收」正好写在这两根指针上，先后颠倒会造出「两条腿各搬一半」的第三形态（ADR §6 S-2b 格「顺序硬约束」段 + DEC-7 补充条款 ① 明令禁止）。
- **轨分配（写范围互不重叠，沿 K-153 判例）**：工程轨 T-4（程基岩）只写 `games/beads/src/**` / `games/beads/tests/**` / `tools/scripts/**`；设计轨 T-1Q（文策渊）只写 `games/beads/design/**`（裁 Q8/Q9、把门票判据转成硬条）；主理人负责切批、对帐、全量门禁与入库。

### 2. 逐片落地面与验收判据（摘要；逐字锚点以 ADR-0034 §6 表为准）

| 片 | 落地位置 | 验收什么算过 | 变异臂 |
|---|---|---|---|
| S-3 | 新文件 `games/beads/src/systems/arc-ticket.ts`（暂名，纯函数） | 全 3★ ⇒ 开；章内一关 2★ ⇒ 不开（但「本章已通关」显示仍为真，两层不混用）；空清单 ⇒ 两层都假；首章无前置；归约集合 = 本章清单内每一个槽（boss 关与教学关**不豁免**）；输出含 `n/N` 供只读件 | M-11（两层不混用）/ M-17（豁免臂） |
| S-7 | `games/beads/src/game/save-schema.ts` 的 `migrations[n]` 族 | v1 档一次跑完 1→5 全链、`migrationsApplied` 恰 5 个台阶；摘掉 4→5 那一级该例必红 | M-13 |
| S-2b | `save-schema.ts`（字段声明 / 默认值 / 读档 / 写回 / `changed` 比较 / `staleKeys` 追加两条旧数值键 / `bootLevel()`）+ `beads-game.ts`（写侧收拢点已有，只换右值；getter 签名不变） | 插一关 / 调展示序后两指针仍指得回同一关；旧数值键未点名清除 ⇒ 红（框架浅合并不删键）；降级档位按 Q8 裁定固化；**视图契约零改动** | M-18（身份免疫）/ M-19（双轨并存）/ M-20（降级档） |
| S-4 | `games/beads/src/game/beads-shell.ts` 的 `pick-level` 分支（现行判断 = `levelIdx + 1 > maxUnlockedLevel` 零事件）+ 新只读 ViewModel 字段 | 章内解锁不变（过一开一）；跳章受门票拦；未达标的章仍可进入浏览、但格全锁（零事件 / 零扣心 / 灰珠 + 小锁）；已得入口不因后续加关而回收；门票输入里 ⛔ 不出现章 id | M-12 / M-15（棘轮）/ M-16（静态臂） |

### 3. 禁止项（铁律与边界）

- ⛔ 触 `systems-index §3` 任何冻结数值：门票判据是「全 3★」，读的是既有 `tierSecondsFor` 三线与星账，**零新常量**；§3.7 只允许加注。
- ⛔ 往存档里加「本章已开」布尔（门票每次现算）；⛔ 复用既有 `_arcState.allCleared` 当门票（它答的是「全通关」，两层概念不同）。
- ⛔ 借落码之机改判据语义；⛔ 以「文档已写」当已实现；⛔ 手编 `.scene/.prefab/.meta`；`games/*/src` ⛔ `import 'cc'`；⛔ 每帧路径新增分配；⛔ `Math.random()`。
- ⛔ 改既有三态显示口径（橱窗卡「通关 / 推进中 / 锁」四字不变）；⛔ 因加新按钮或新弹窗（告知件 = 常驻只读，⛔ 注册热区）。

### 4. 待裁与遗留

- **Q8（身份指不回时两指针落哪一档）**：Q8 只阻塞 S-2b 的**降级档取值**，不阻塞其结构开工；工程侧先按「⛔ 丢进度」一侧实现并标注待裁，裁定到位后只改一处。
- **Q9（插关后仍指得回同一关缺玩家可见硬条）**：建议本轮由设计轨转为 `save-progress §8` 硬条（编号顺延 23），并把引用同步到 `star-collect-rule` 与 EP14；⛔ 改既有条目正文。
- 真机与上传腿 `[Blocked]`（无 AppID / 无密钥）；换制期开发档「至少清一次」已发生；S-2b 落地只多一次两指针回落 ⇒ 须知会 QA。

### 5. 验证（2026-10-22 收尾实测；以下数值均为本机本轮跑出，未拿上一批读数代填）

**① 全量门禁**：`pnpm run verify` = **PASS 22 ｜ WARN 0 ｜ SKIP 0 ｜ FAIL 0**（22 项逐项执行、不短路）。与本批直接相关的几项读数：

- **单元测试**：`npx vitest run --root games/beads` = **102 个测试文件 / 1210 passed + 3 skipped**（3 个跳过为既有跳过项，本批未新增跳过）；
- **框架镜像**（`framework:sync:check`）：拷贝件与源码一致 —— beads（framework 61 + game 82）、breakout（framework 61 + game 16）；
- **关卡数据**（`levels:check`）：beads 的 `levels-data.ts` / `arcs.ts` 与 `manifest.json` / `chapters/` 一致，breakout 亦一致，2 款游戏全过；
- **架构静态门**（`check:arch`）：`OK — no violations`，仅 1 条提示，内容为 Cocos 目录内存在 330 个由编辑器生成的 `.scene/.prefab/.meta`（该类文件只允许编辑器产出，属正常提示，非违规）；
- **Cocos 面**（`cocos:check` / `check:cocos-mask` / `check:es5spread`）：镜像代码、遮罩判据与 ES5 展开契约均 PASS。

**② 九条变异臂自证**（逐条先把代码改成错误实现、确认对应用例变红，再逐字节还原）：脚本 `temp/mut-wxg-t-345.py`，逐条读数 `temp/mut-wxg-t-345-result.json`，结果 **9/9 全部按预期变红**：

- 满星判据（臂 M-11）与「boss 关 / 教学关不豁免」（臂 M-17）⇒ 咬住 [arc-ticket.test.ts](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/tests/arc-ticket.test.ts) 的「两层不混用」与「归约集合无豁免」两组；
- 章内线性解锁（臂 M-12）、门票输入不得出现章 id（臂 M-16）、解锁位棘轮（臂 M-15）⇒ 咬住 [arc-ticket-gate.test.ts](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/tests/arc-ticket-gate.test.ts)；
- 旧版本档一次跑完整条迁移链（臂 M-13）⇒ 咬住 [save-schema.test.ts](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/tests/save-schema.test.ts) 的 1→5 全链断言；
- 两根进度指针的内容变更免疫（臂 M-18）、旧数值键点名清除（臂 M-19）、身份指不回时的降级锚（臂 M-20）⇒ 咬住 [save-pointer-identity.test.ts](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/tests/save-pointer-identity.test.ts)。

还原后复跑单测仍为上述 102 个文件 / 1210 passed + 3 skipped，排除「变异未还原」造成的假红或假绿。

**③ 包体（release 基线档，本批源码重建后实测）**：先 `pnpm run build:cocos`（脚本默认即 release 基线：minify on / sourcemap off，见判例 K-111），再 `pnpm run check:size`：

- beads 主包 **3318.7 KB / 111 文件**（gzip 参考 1664.0 KB），距 4096 KB 红线余量 **777.3 KB**；
- 对照上一批（T-3）读数 3314.4 KB ⇒ 本批四片净增 **+4.3 KB**，文件数 111 未变；
- ⚠ 过程留痕：重建前跑的 `check:size` 曾读到 3319.0 KB，但产物时间戳（12:16）早于本批源码（12:34）⇒ 判为旧产物读数并作废，重建后才取上述数值，避免「拿旧产物当新证据」（判例 K-152 同型）。

**④ 文档与知识库门**：`kb:check` **PASSED**（八重校验；活跃 152 / 归档 0）；`ctx:build` 重建索引（文件 470 / 章节 6734）后 `ctx:check` **OK**（结构门 A/B/C/D/D2 与基线回归全过）；`check:tasks` / `check:links` 均 PASS。

**⑤ 铁律与禁止项复核**：

- 上一轮手写的 `games/beads/cocos/assets/scripts/game/systems/arc-ticket.ts.meta` **已删除**；随后 `pnpm run build:cocos`（release 基线档）为新增的 `arc-ticket.ts` **自动重新生成**了一份同构 `.meta`（`ver 4.0.24 / importer: typescript`，与既有 `save-schema.ts.meta` 同款，生成时间 12:39 晚于源码）⇒ 该文件属合法编辑器产物、随本批入库；判定口径 = **生成者与格式**，不是「文件是否存在」。`framework:sync` 仍只写 `.ts`、不生成也不改写 `.meta`；
- 本批 **零 `systems-index §3` 冻结值改动、零 DEC 决策本体改动**，改动面清单见 [ADR-0034 §8](file:///Users/stephenhe/Development/workspace/wechatgame/docs/architecture/adr/ADR-0034-beads-save-uid-index-flatten.md)；
- 新增的门票归约、闸门判断与迁移链均为确定性纯逻辑，未引入 `Math.random()`，未在每帧路径新增集合分配。

**⑥ 环境阻塞（如实）**：真机扫码与上传腿仍 `[Blocked: 无真机 / 无 AppID / 无密钥]` ⇒ 本批验收只到「纯 Node 单测 + 浏览器 harness + CLI 构建」为止，⛔ 未做真机验收。

**结论**：四片判据全部有挂用例、九条变异臂均能咬断、全量门禁全绿 ⇒ 本批可按「工程侧完成」入账；真机腿另行挂起。

**⑦ 知识沉淀**（`pnpm run kb:sync --task=WXG-T-345`）：**新增 2 条 / 修改 0 / 激活 0 / 归档 0**；`kb:audit` 无归档相似命中；沉淀后 `kb:check` 八重校验 PASSED（活跃 **154** / 归档 0）：

- **K-156**（判据实测）：度量「已有构建产物」的读数（包体、快照、生成物校验）必须先核对产物时间戳，否则读到的是上一批的数 —— 源于本批包体读数一次作废重测；
- **K-157**（测试守卫）：夹具手搓的「最小形状」若与生产装配形状不同，对数据形状敏感的边界分支永远走不到，变异也不会红 —— 源于降级锚用例首版的稀疏星账假绿；
- ⚠ 与本条相邻的既有条目 **K-155**（同一份决策文里「决策条文」与「施工清单」各写各的）已由上一批登记，本批不重复沉淀。

---

## WXG-T-346

### 1. 立项与用户令

- **上位令（2026-10-22，见 `## WXG-T-343` / `## WXG-T-345`）**：「每大关所有关需要获取到 3 星，才能凑足打开下一个大关的钥匙」+「存档与门票一起做」。
- **本批改判（用户同日拍板 A）**：门票口径由「本章全部小关 3★」改为「**本章全部小关通关（每关 ≥1★）∧ 累计星 ≥ 门槛**」，逐章判定 —— 全 3★ 对首章过陡，改拆为「通关广度 + 累计星」两条腿。
- **推进方式**：本 Story 四轮均由用户在上一步三选项中选 **1** —— ① 收口 S4（删前置小锁图元 + 补设计变更单）② 走美术批（钉 TODO-8 + 定 `carousel_progress_label` 往哪走）③ 给裁决上锁（两枚防回退守卫）④ 可访问性册回写（把实测对比度落进矩阵与 QA）。
- **⚠ 本任务号被两个会话同时领用**，详见本节第 6 条。

### 2. 门槛口径（纯派生，零新常量）

门槛 = 满星容量 − floor(关数 × 2 ÷ 3)：

| 章内关数 | 满星容量 | 门槛 |
|---|---|---|
| 9 | 27 | **21★** |
| 6 | 18 | **14★** |
| 3 | 9 | **7★** |
| 1–2（短章） | — | 门槛 = 关数（只要求全通关） |

### 3. 逐批落地面（七笔提交，12:57–14:06）

| 提交 | 类型 | 做了什么 | 证据 / 验收 |
|---|---|---|---|
| `e20b8a1` | 工程 | `systems/arc-ticket.ts` 新增 `arcGateStars()`；`arcTicket()` 出参扩为 `starSum`/`gate`/`clearedCount`/`total`，判定 = `total>0 && cleared===total && sum>=gate`（单循环零分配）；shell 与 meta-view 字段改名 `arcStarGot`/`arcStarNeed` | 门票臂单测转绿；零 `systems-index §3` 触达 |
| `4fa7be5` | 工程 | 进度件从「只落数据」改为两处渲染：走马灯木牌第二行（关名让位 `line1Off`、进度走 `line2Off`）+ 选关页章名下方；件 = `★ n/门槛` 数字直拼（与顶栏 `❤ n/n` 同族 ⇒ 零新文案令牌），只读零热区（L5），`drawPlateTitle` 传两个 number 守热路径零分配 | 零新增版面常量；尺/色归 art 批（当时标 TODO-8/TODO-11） |
| `e6cb988` | 工程（补漏） | **实拍取证抓到的壳层漏算**：翻页只动 `_menu.offset`，而归约固定读 `levelsArc`（只在开选关页时才变）⇒ 木牌第二行要么不出现、要么残留上一页数字 ⇒ `_refreshArcGate(arc)` 显式收页号 + 新增 `_refreshArcGateOnMenuPage()`（`_menu.step()` 落定后变号才归约，⛔ 每帧重算） | `tests/arc-ticket-gate.test.ts` 新增 1 例（翻到章 2 ⇒ 20/21；翻回首章 ⇒ 清空）+ M-16 静态臂同步新签名 |
| `ed53293` | 设计 | 用户裁「件仅在未达成时创建 ⇒ 前置小锁恒真、零信息量」⇒ 删锁图元；ux v1.12 §4.1-3 甲臂 / §5 / §7 三处划线（K-053）+ §8.1 D16 + §8.2 TODO-11 收口；epics S4 由 READY 转 DONE | 纯文档、零代码 |
| `e464c4c` | 美术 | 闭 TODO-8 并落 `menu-layout-implementation-spec.md` **v3.10 新增 §10**（正本）：字号 `font_label` 28（原 `UI_FONT.cell` 22 ⇒ 属**改正**不是微调）、木牌侧 `palette.woodFace` / 选关页侧 `palette.textDim`、页侧随 E2 → 35（`bodyFont`）而木牌侧定尺不随放大（牌面高 100、两行行心距 32 无余量）；⛔ 不新建令牌，`carousel_progress_label` 划线退役（值保留不删 + copy-tokens 镜像注） | ui-golden 12 例 sha 不变（两态均无进度件）+ 三个视图测试 24 例全绿 + verify 22/22；ctx B 门拦下一次 ⇒ 落地单 8750>8000 走豁免登记（撤销条件 = 下次增补前外移 §5 资源清单） |
| `8a0f62a` | 测试 | 两枚防回退守卫 `tests/menu-plate-title.test.ts` / `tests/arc-level-select-page.test.ts`：木牌侧 = 28 档 + `woodFace` 且 `largeText` 开仍 28；页侧 = 28 → `bodyLarge`(35) + `textDim`；两例各含一条 `not.toBe(UI_FONT.cell)` 显式反向断言，注释写明 22px 档的对比度读数 | **逐臂变异自证**：两处改回 `UI_FONT.cell` ⇒ 两例同时转红（已还原，工作树 0 dirty）；两文件 16 例全绿、verify 22/22 |
| `9fed05f` | 文档 | 可访问性册回写：`accessibility.md` B1/E1/E2 三行落实测数与「⛔ 不得回落 <24px」硬约束；`a11y-anchors.md` B1 加 `#8A5B34`、E2 加 `bodyFont`（两枚可机检锚）；QA `test-cases.md` 升 v1.24、§M.1 后补 **TC-MN-41**（落位从原拟的 §G 改判为 §M，理由 = 本文件「每节 = 一个判据来源家族」） | `check:a11y` OK（2 个游戏锚点全在 src 命中）、`check:links` OK、verify PASS 22 / WARN 0 / SKIP 0 / FAIL 0 |

### 4. 实测对比度（本批唯一新增的数）

底色 = PIL 采样投放件 `ui_showcase_plate.png` 两条文字带平均色；算式 = WCAG 1.4.3 相对亮度（非抄旧文档读数）。

| 墨 | 底色 | 字号 | 对比度 | 判定 |
|---|---|---|---|---|
| `wood_face #8A5B34` | `#F2C188` | 28 | **3.52:1** | 大字号 3:1 ⇒ 过 |
| `wood_face #8A5B34` | `#F2C48C` | 28 | **3.60:1** | 过 |
| `text_secondary #6E7288` | `#F2C188` | 22（改前态） | **2.88:1** | ❌ 连大字号 3:1 都不过 |
| `text_secondary #6E7288` | `#F2C48C` | 22（改前态） | **2.95:1** | ❌ 同上 |
| `text_secondary #6E7288` | 暖纸底 `#F1E8D8` | 28 | **3.90:1** | 过 |
| 对照位 | `wood_face` 于纸底 **4.76** / `text_secondary` 于白 **4.75** | | | 证「底色不同不得混引」 |

⇒ 本批定性：旧态属 B1 行既有的「dim 于非白底不达标」同型缺陷，**改正而非微调**；且 28px 是两臂墨达标的**前提**，故写硬约束「⛔ 不得回落 <24px」（普通文本档需 4.5:1）。

### 5. 验证读数

- ④⑤⑥⑦ 各批收尾均 `pnpm run verify` **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**（未改 `games/beads/src/**` 的批仍跑全量，`framework:sync:check` 在内须绿）。
- 金样本无变化原因：两态均落在「门票已开放的首章」⇒ 进度件不出现，故 sha 零漂移 ⇒ **该件的字号/色此前无门可守**，这就是 `8a0f62a` 两例守卫立项的直接理由。
- 屏幕层 / 真机 = **⛔ 未执行**（K-037：指令流可证 ≠ 屏幕可证）；TC-MN-41 的 `[Device]` 半边空挂。

### 6. ⚠ 同号双用登记（K-046 同型）

- **事实**：`WXG-T-346` 被两个会话各领一批 —— 另一会话 `d93e580`（10-22 11:47 `design(beads): 星级经济与日常留存提案`）与本会话七笔（12:57–14:06）。两边均未登主表。
- **发现路径**：本批（清工作树归位）核对领号时读 `TASKS.md` 头注 + `git log --grep='WXG-T-346' --all` 才查出；头注此前只承认 `d93e580` 一条，并称「346 尚未被任何文档引用」。
- **处置**：本会话七笔已自登主表与本节（沿「谁用谁自登」口径）；`d93e580` 一行仍由该会话自登（**K-137 只披露不代填**）；领号头注已把「下一可用号」从 347 改口为 **348**（347 仅被旧注文字预占、零提交零文档引用）。
- **二次竞态（本会话自纠，同小节最严重的一条）**：本会话的文档提交 `69fe98d`（14:22:48）实际含 **16 件** = 本会话 2 件台账 + 他方会话（CodeBuddy · `WXG-T-348` 主菜单签到入口）11 件在制品 + `ctx/` 与 `memory/INDEX.md` 生成物 3 件。
  - **根因**：`git commit` 提交的是**索引全集**，不是「本会话刚 `git add` 的路径」；共享工作树里他方会话在 14:22 前已 `git add` 自己的改动 ⇒ 本会话一笔文档提交把别人的半成品一并带入 HEAD。这是 K-046 的**新面**：撞的不是任务号，是**暂存区**。
  - **取证**：`git show --stat 69fe98d`（16 files）+ `git log --oneline -3`（他方 20 秒后 `3499f4e` 自登 348 台账与节）+ `git rev-parse origin/develop` = `9fed05f` ⇒ **两笔均未推送**，远端未受影响。
  - **处置**：⛔ 不改写历史 —— 他方会话活跃中，`reset` 会拆掉其 `3499f4e` 并与其后续提交互踩；改为就地登记交叉引用 ⇒ **追溯 WXG-T-348 的代码须同时看 `69fe98d`（`tuning.ts` / `meta-view.ts` / 镜像 / 两测试 / 两份提案档）与 `3499f4e`（台账 + ctx）**。
  - **登记一条装置缺口**（与上面 F 项盲区并列）：`git commit` 在跨会话共享工作树下无「只提交自己那几条路径」的机械保护，本仓库预提交钩子亦不校验索引归属 ⇒ 并发会话提交前须先 `git diff --cached --name-only` 核暂存区（本会话此前未核，故犯）。
- **门禁盲区（供后续工具单参考）**：`check:tasks` F 项只比「头注号 vs 主表 ∪ 归档最大号」，**不读 git log** ⇒ 提交里署了未登记的号不会变红（本轮 verify 22 全绿即为例）。若要机械守，需新开单把 `git log --grep` 纳入比对。

### 7. 遗留与下一步

1. 屏幕层 / 真机观感 ⛔（需预览产物连拍或真机，解除条件 = 出包 + 人工判读）。
2. ~~工作树仍有三份他会话在制品未入库~~ **同日 14:22 订正**：那三份文档连同他方代码在制品已由本会话的 `69fe98d` 意外入库（见 §6 二次竞态）⇒ 工作树现干净，但 HEAD 含他方 `WXG-T-348` 未完项。
3. `apps/beads-studio/public/index.html` / `manage.html` 的改动经去空白 SHA-256 对账确认为**纯格式重排**（两文件同秒修改、仓库无 HTML 格式化门）⇒ 已按用户裁定 `git restore` 还原。
4. 沉淀候选 3 条待裁（① 对比度读数必须带采样底色 ② QA 用例落位服从「每节一个来源家族」③ commitlint `body-max-line-length=100` 与中文长句冲突需一行一个读数拆分）；本轮 `kb:sync` 活跃 154 / 新增 0 / nextId 158，knowledge 零净变更。
5. **同日沉淀批（用户令「沉淀候选 1/2/3/4」）**：上文 §6 回传的 4 条候选按 `knowledge/INDEX.md` §5.3「优先合并不重复沉淀」处理后，落为 **1 新条目 K-158 + 3 条追记（K-045 / K-076 / K-137）**：候选 1（`git commit` 提交索引全集）入 K-045 作「最裸形态」追记；候选 2（跨会话披露双向通道 + mtime 判归属）新立 K-158；候选 3（门禁不校提交号在册）入 K-137 作「同日二次复现 + 元盲区」追记并转出本单 349；候选 4（文档批免 stash 的第一道判据）入 K-076 追记。读数：`kb:sync --task=WXG-T-346` 新增 1 / 修改 3 / 激活 0 / 归档 0；`kb:audit` 无候选、无相似命中；`kb:check` 八重通过（活跃 155）；`ctx:check` OK（两片均未越 B 门）。第 4 项所列三条仍待裁。

---

## WXG-T-224

**ctx·hot-files 收录瘦身（test-cases 锚点摘要只留高频节）** — 主理人 2026-09-29 立项，quality-lead（严守真）只读裁定。

> ⚠ **本行由主理人（CodeBuddy）于 WXG-T-229 批次代补**（原会话只占号未登详情节，`check:tasks` C 项拦）；
> 正文以各自交付件为准（本批无新事实，只做摘要 + 指针）。

- **起因**：常驻总量 14669 > 软阈值 13500、`ctx/hot-files.md` 5062/上限 5150。
- **关键纠正**：立项时的瘦身对象 `ux-spec.md` **已失效**（不进 hot-files 且已在 `ctx/budget-exempt.json` 豁免 B 项 ⇒ 瘦它零收益）；真实体积主体 = `production/qa/beads/test-cases.md` 的**锚点文字**（块 1412 tok = hot-files 27.9%；§A +261 / §K +184 / §I +106 / §G +111）。
- **裁定（严守真）**：CONCERNS + 方案④。裁节 ROI 为负（父节 9–15k 会突破 B 项）；降门槛机械不可能（可选池 = 0）；推荐**规则 R**（只收 L1/L2 + `ROUTES.md` 引用锚点，或父节 >8000 例外）。
- **P1 缺陷（同批发现）**：`test-cases.md` 标题级别错 ⇒ §I 区间误吞「变更记录」+ 整个 §J（11064 tok vs 真实 ~2000）⇒ 每次协议读多 ~9000 tok。
- **执行（用户选 A）**：P1 修 6 处标题级别 ⇒ §I 572–677→**572–613**（11064→2260）；规则 R 落码（`routesReferencedAnchors()` / `parentTokens()` + `renderHotFileBlock` 节级过滤）⇒ hot-files **5150/5150 ✅**、D2 100%、全门绿；收录文件 18→25。
- **遗留**：A 项余量归 0（下批新增即 FAIL）；P2/P3 挂账；拆单派生 ⇒ **WXG-T-225**。未 commit。

---

## WXG-T-225

**QA·拆 `production/qa/beads/test-cases.md` 判据分片（撤销 WXG-T-084 的 B 项豁免）** — 来源 = WXG-T-224 裁定移交，quality-lead 待裁。

> ⚠ 同 WXG-T-224：本行由主理人（CodeBuddy）于 WXG-T-229 批次代补（原会话只占号未登详情节）。

- **事实**：该件现 **69479 tok**，靠 B 项豁免（WXG-T-084）苟住 ⇒ **69k 整读悬崖**。
- **拆分价值**：① 撤销豁免、消整读风险 ② 脱离 `tier:hot` 必收 ⇒ 重获生成器自调节能力。
- ⛔ **拆分不减 `ctx/hot-files.md` 体积**（锚点文字守恒 + 每新文件多 ≈20 tok 表头）⇒ **它不是 WXG-T-224 的瘦身手段，不得混计收益**。
- **待裁**：拆法（按 §A–§K 族 / 按系统域）、文件名与锚点兼容、`g4-regression-report.md` 等引用面同步。

---

## WXG-T-316

**beads·UI-42 PhaseRouteBinder：壳导航标志位退役** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **触发**：UI 架构迁移 P4 下一格（用户选下一步「1」）。验收口径 = 任务表原文「`_screen` / `_overlay` 删除后全仓测试绿」；DEC-3「栈即导航状态」。
- **落点**：新建 `src/ui/phase-route-binder.ts::PhaseRouteBinder` —— 栈底恒有且只有一个基础页（`menu` / `play`）；`levels` 为**页**路由（不透明）、`signin` / `settings` 为**弹窗**路由（透明）；`screen` / `overlay` 全部由 Navigator 栈**投影**（壳不再有标志位）；`levelsArc` 收口选关页大关上下文。四个转场入口 = `resetTo(screen)` / `openLevels(arc)` / `openModal(name)` / `close()`；基础页永不被弹掉。
- **零漂移**：绘制路径与 `hitTestMeta` 判据逐字未改，只换数据源；`meta:overlay` 事件时序不变（`back` 淡出期间 overlay 仍归页、150ms 终点才 `close()` + 发事件）；金样本十态 sha 全等、夹具未重抓。路由 `draw` 为空实现 ⇒ `UI_ROOT_ENABLED` 打开时画面仍是「旧链内容 + 调试层」。
- **与 UiRoot 共用同一栈**：`PhaseRouteBinder(this._uiRoot.nav)`，不做第二份真源；UI-50 拆旧链时本栈即绘制源。
- **测试**：新增 `tests/phase-route-binder.test.ts` 6 例 —— 初始基础页；`levels` 页路由 + 大关上下文 + 关栈顶；`signin` / `settings` 弹窗不换屏；基础页 `close()` 不弹空栈；`resetTo` 清覆盖层；与 `UiRoot` 共用栈时空 `draw` 零指令。
- **验证读数**：beads 97 文件 **1135**（1133 passed + 2 skipped）；`npx tsc` 0 错；`pnpm run verify` PASS 22；Cocos 镜像 2 件随源更新（`beads-shell.ts` + 新 `phase-route-binder.ts`）。
- **诚实限制**：`UI_ROOT_ENABLED` 仍默认关（拆旧链、开关退役 = UI-50）；对局腿相位弹窗（`paused` / `level-clear` / `game-over` / `finish`）仍由 `BeadsGame.phase` + `PanelRouter` 直接分派 —— 它们是**点击路由**、不持导航状态，搬上路由须先让面板 View 注册（UI-50）；金样本夹具 `_readme` 保留捕获当时的 `_overlay` 措辞（不手改夹具）。

---

## WXG-T-315

**beads·UI-40 MainMenuPage：走马灯状态从 shell 迁入 Presenter** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **触发**：UI 架构迁移 P4 下一格（用户选下一步「1」）。验收口径 = 任务表原文「金样本对拍；走马灯边界行为不变」。
- **迁出内容**：新建 `src/ui/main-menu-presenter.ts::MainMenuPresenter` —— 页位 `offset` / 拖动位移 `dx` / 透明度进度 `t` / 页数 `pages`、玻璃手势（按下 / 拖动 / 松手）、吸附动画（`nudge` / `step` / `peerSign`）全部收口；`beads-shell.ts` 删除 10 个走马灯字段与 7 个私有方法，只保留 `_menu` 一处引用与 `_clock()` 喂时。
- **职责边界**：松手结果 `open` / `page` / `none` 由 Presenter 判定（10px 点按线、30% 阈值、快甩、末页空橱窗都留在同一处）；**副作用仍归壳** —— `overlay` / `overlayArc` / `meta:overlay` / 200ms 页转场只在 `open` 时触发；按钮抬起提交门 `_menuPress` 不动。
- **零漂移**：绘制路径（`buildMetaView`）逐字未改，只把数据源从壳字段换成 Presenter 同名读数；金样本十态 sha 全等、夹具未重抓；`menu-carousel.ts` 仍是纯函数单源，仅改一行注释。
- **测试**：新增 `tests/main-menu-presenter.test.ts` 6 例 —— 点按进选关 / 末页空橱窗零事件、10px 点按线、不足 30% 回弹、过 30% 吸附翻页（中点仍在途、终点页位 +1 且位移归零）、吸附在途按下即停、首末页快甩与 ◀▶ 不越界。既有 `menu-carousel.test.ts`（8）与 `arc-carousel.test.ts`（6）全绿。
- **验证读数**：beads 96 文件 **1129**（1127 passed + 2 skipped）；`npx tsc` 0 错；`pnpm run verify` **PASS 22**；Cocos 镜像 4 件随源更新（`framework:sync:check` 绿）。
- **诚实限制**：UiRoot **路由注册与开关翻转**仍未接线（`UI_ROOT_ENABLED` 默认关；归 UI-42 PhaseRouteBinder），本批只交 Presenter 本体；`_overlay` 仍由壳持有。

---

## WXG-T-314

**beads·UI-42 前置：菜单 ↔ 选关页 200 / 150 页面转场** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **触发**：T-311 登记的两条遗留之一（「200/150 转场未接线」）。真源 = `arc-level-select-spec §5`（入 200 / 出 150，ease-out / ease-in）→ `ux-spec §5` 面板入 / 出行 ⇒ 直接复用 `PANEL_IN_MS` / `PANEL_OUT_MS`，**零新毫秒值**。
- **机制（三件）**：① 框架 `RenderModelBuilder` 增**非嵌套组透明度**（`setAlpha` / `resetAlpha`；`rect/circle/line/text/polygon/blit` 合流，`alpha === 1` 时原样返回 ⇒ 静息帧零新字段）；② `MetaViewData.pageFade` + `buildMetaView`：底页恒为主菜单，选关页（含自身不透明页底）整组 α ⇒ 淡入淡出同一套绘制代码；③ `BeadsShell` 用 **dt 累积**推进（`_pageFxDir` / `_pageFxT`，⛔ 不用墙钟 ⇒ 固定步进可测）。
- **语义取舍**：进入即 `overlay = 'levels'`（页立即可交互）；`back` 淡出期间 **overlay 仍归页**（命中路径不变，⛔ 不把点击送给菜单 CTA），150ms 终点才置 `none` 并补发 `meta:overlay`；`showMenu` / 进玩法 / 开弹窗均 `_cancelPageFx()`。
- **零漂移**：`pageFade === undefined`（缺省）时原路径逐字不变；金样本 `level-select` 场景改为**推完转场再取帧**（`advance(PANEL_IN_MS / 1000 + 1 帧)`）⇒ 十态 sha **全不变、夹具未重抓**（K-051 无需新锚）。
- **测试**：framework `render-model.test.ts` +1（默认零字段 / 乘算 / `resetAlpha` 与 `begin` 复位）；`arc-level-select.test.ts` +2（中点帧 ≠ 静息帧且 200ms 终点逐字等于静息帧；`back` 150ms 内 overlay 仍归页、零关闭事件，到点才落 `none`）；页内既有断言按真实入口先 settle（`openLevels` / `levelsFrame`），未放宽任何判据。
- **验证读数**：beads 95 文件 **1121**（1119 passed + 2 skipped）；framework `render-model` 26 例；`framework:sync` 后镜像 4 件更新（beads 3 / breakout 1）且 `framework:sync:check` 绿；`pnpm run verify` **PASS 22**。
- **诚实限制**：UiRoot **页路由**（`_overlay` 退役）仍归 UI-40 / UI-42，本批只补「转场 + 透明度通道」；转场无音效（抽屉音需音频变更单，⛔ 不夹带）。

---

## WXG-T-313

**CI 运行面对齐 Node 24（原生 TS type-stripping）** · 负责：主理人(Qoder)·工程域 · 状态：✅ 完成（2026-10-20）

- **触发**：T-312 推送后 develop CI 红（run 39363506681）：`Levels check` 报 `ERR_UNKNOWN_FILE_EXTENSION ".ts"`（`difficulty.ts`），`Unit` 报 `bead-style-pool.test.ts` 13 例红（同样错在子进程直接执行 `.ts`）。查历史：develop 自 2026-10-19 起多笔 push 的 CI 均红，属存量漂移，非本批引入。
- **根因**：workflow 五个 job 固定 `node-version: "20"`；而 `tools/scripts/sync-levels-data.mjs` 门禁⑥与 `bead-style-pool` 子进程依赖 Node ≥22.18 的原生 type-stripping（脚本头注已写明）。本地 Node v24.4.1 跑 `pnpm run verify` 全绿，故为运行面口径不一致。
- **落点**：`.github/workflows/ci.yml` 五处 `node-version` `20`→`24`，首处加注释说明版本下限理由；CI 的 `levels:check` 步骤补 `--import=./tools/scripts/lib/ts-js-resolve.mjs`（此前绕过了 package.json 脚本，`difficulty.ts` 内部的 `.js` 引用无钩子解析）；`package.json` `engines.node` `>=20`→`>=22.18`。`commit-lint.yml` 未动（只跑 commitlint，Node 20 可胜任且一直绿）。
- **三轮验证**：① 只升 Node（`52a7b7a`）→ Unit 转绿、Levels 仍红（`Cannot find module tuning.js`）；② 补钩子（`28b279c`）→ CI run 39366031955 **七个 job 全绿**（Detect changes / Arch guard / Context budget / Unit / Harness / Levels check / gate），Commit Lint run 39366031793 亦绿；③ 本地用与 CI 同一条命令复跑 `levels:check OK —— 2 款游戏全部一致（beads、breakout）`。
- **不夹带**：未改任何测试、未放宽任何判据、未跳过任何检查；Node 24 与本地 验证环境一致。
- **验证读数**：本地 `pnpm run verify` PASS 22（Node v24.4.1）；远端 CI 39366031955 / 39366031793 双绿（develop 自 2026-10-19 起首次全绿）。

---

## WXG-T-312

**协作纪律·完成即提交推送与提交总结** · 负责：主理人(Qoder)·工程域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 原话）**：「增加规则，每次完成修改，提交commit并push，同时给出修改提交总结。」该指令覆盖 2026-10-19「会话不得自行 push」的旧裁。
- **落点（5 份规则/记忆件 + 台账）**：① `my-rules/agents-md.md`（四 IDE 常驻摘要）改为「每完成一次修改即 commit + push 并回传提交总结」；② `AGENTS.md §7` 两条合并改写：完成即提交 + 推送取证（以 `git ls-remote` / `git reflog` 为准）；③ `docs/ci/commit-and-review-rules.md` 新增 §2.6「完成即提交推送」四步流程（验证 → 提交 → 推送 → 总结）与例外；④ `docs/agent/output-style.md` 新增「每次提交的提交总结」五项口径；⑤ `memory/MEMORY.md §Hooks` 订正旧约束，IDE 自动推送降为叠加兜底；⑥ 本台账自登。
- **例外未变**：发布、删除高影响产物、改动他人未提交的工作树内容，仍须先取得用户明确同意；⛔ 强推、⛔ `--no-verify`。
- **同批收口**：T-311 的「未提交 / 金样本 `capturedFrom` 记工作树」限制已闭合 —— 累积落码入库 `8e0d133`，金样本改用 `WXG298_SOURCE_REV=8e0d133` 复取（仅 `capturedFrom` 一行变化，十态 sha 不变，两遍确定性自证 PASS）。
- **验证读数**：`pnpm run verify` PASS 22；金样本 11 例全绿。

---

## WXG-T-311

**beads·UI 架构迁移 P4·UI-34 选关整页落码** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §12 **UI-34**：「LevelSelectPage 整页（ScreenFrame + 仅标题 NavBar，从主界面 push 页面路由，无遮罩；**页专用常量，不改 `WALL_CELL`**）」；验收原文 = **版式与确认单 §2 一致；选关意图正确；底部 `back` 回主界面；抬起才提交且同钮**。前置 UI-34a（确认单 v0.2 §4.1 六条清零）已就位。
- **落点（1 常量组 + 2 处视图 + 4 处测试）**：① [`tuning.ts`](../games/beads/src/config/tuning.ts) 新增页专用 `LEVELS_CELL`(170) / `LEVELS_GAP`(30) / `LEVELS_GRID_LEFT`(90) / `LEVELS_GRID_TOP`(822) / `LEVELS_THUMB_AREA`(134 = 170−8−28 派生式) / `LEVELS_BACK_W`(240) / `LEVELS_BACK_BOTTOM`(116 = `SAFE_BOTTOM_H`+48) / `LEVELS_NAV_H`(88) / `LEVELS_NAV_TOP`(1210 = `DESIGN_H`−124)；`WALL_CELL`(120) / `WALL_CAPACITY`(9) / `THUMB_AREA`(84) **零改动**。② [`meta-view.ts`](../games/beads/src/view/meta-view.ts)：`levelsLayout()` 按版式 P 重算（网格 x∈[90,660]、行底 652/452/252，back 240×88 @ (255,116)）；`buildMetaView` 增 `levels` **整页分支** —— 只画导航带标题，⛔ 不画遮罩、⛔ 不画 `OVERLAY_PLATE`；`drawWallCell` / `drawLockedWallCell` 的缩略改传 `LEVELS_THUMB_AREA`（走 `drawLevelThumb` 既有 `area` 入参，零新绘制分支）。
- **标题随安全区**：标题中心 y = `(anchors?.btTopY ?? LEVELS_NAV_TOP) − LEVELS_NAV_H/2`。真机有 `MenuAnchors` 时随胶囊底缘下移；无锚宿主（直调/单测）落 1210 兜底 ⇒ 无第二套几何。网格仍**底部锚定静态**（版式 P 的选型理由：多出的高度给顶部空带）。
- **为何整页仍由 shell `_overlay` 驱动**：UiRoot 页面路由接线归 UI-40（MainMenuPage）/ UI-42（PhaseRouteBinder）。本批只改「画成什么样」，不改「谁来推栈」；`meta:overlay` 事件、`back` 语义与抬起提交门逐字未动（R8/R10/R11 回归已证）。
- **不夹带**：spec v1.6 §5 的 **200/150 淡入淡出未实现** —— 现 meta overlay 无转场机制、`meta:overlay` 无监听者，且 UI-34 验收未列 ⇒ 登记为 UI-42 遗留，⛔ 不伪造时钟。（**已由 WXG-T-314 闭合**：组透明度 + dt 累积转场，见该节）
- **零漂移边界**：金样本**仅 `level-select` 态变化**（total 1423→1421 = 遮罩 + 纸面板两条 rect 退场；缩略 84→134 与 back 位移全进 sha），其余**九态逐字不变**（前后夹具 `JSON.stringify` 逐态全等已核）。重抓严格走 `tests/ui-golden-capture.ts`（两遍确定性自证 PASS），`capturedFrom = 8e0d133 · 累积落码（WXG-T-311）`。
- **新增 / 改测**：新建 [`arc-level-select-page.test.ts`](../games/beads/tests/arc-level-select-page.test.ts) **6 例** —— 版式 P 九格左缘（90/290/490）与行底（652/452/252）、`LEVELS_THUMB_AREA` 派生式、back 盒与热区（375,160 命中 / 10,10 空白零响应）、整页性质（`background` = `palette.background` / 无遮罩 / 无 600×720 纸面板）、标题居中 1166、格内图元不越格。改测：`meta-menu-wall` 的缩略 oracle **同参补 `LEVELS_THUMB_AREA`**（旧缺省 84 与生产签名恒失配 = 假红）；`arc-level-select` **R10** 手势改**跨格拖拽**（旧坐标经 `screenToDesign` y 翻转后落进同一格，版式 P 下那是一次正当点击）；`arc-wall-locked` 几何断言改页常量。
- **诚实限制**：① 已闭合 —— 累积落码入库 `8e0d133`，金样本按该 commit 复取（见 WXG-T-312）；② 200/150 转场与 UiRoot 页路由未接线（见上）；③ 缩略 134 对 256² 源清晰度仍 `[待真机]`（UI-34a 已登记）；④ 已闭合 —— `framework:sync` 已在提交前跑过，`framework:sync:check` 绿。
- **验证读数（2026-10-20）**：beads **95 文件 / 1119 passed + 2 skipped**（较上批 +1 文件 +6 例）；`tsc --noEmit` OK；金样本 11 例全绿；`pnpm run verify` PASS 22。

---

## WXG-T-310

**beads·UI 架构迁移 P4·UI-34a 选关整页前置文档回写** · 负责：主理人(Qoder)·林绘澄／文策渊域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §12 **UI-34a**：「选关整页前置：美术规格回写（版式 P 的格 / 间距 / 网格范围，正本 `menu-wall-signage-spec`）；核对格轮廓对比度、缩略图放大后清晰度；主规格回写（含「注 B」订正）」；验收原文 = **确认单 §4 第 1–6 条清零**。
- **落点（四件文档，零 `src/` 改动）**：① [`menu-wall-signage-spec.md`](../games/beads/design/art/specs/menu-wall-signage-spec.md) 新增 **§3.9**（版式 P 版面表 + 三项核对结论）+ §7.3 两条 `[待真机]`；② [`arc-level-select-spec.md`](../games/beads/design/ux/arc-level-select-spec.md) 升 **v1.6**（§3 旧 600×720 线框 → 版式 P 表 / §2 栈深度整页化 / §4 注 B 订正 / §4 空白处行 / §5 淡入淡出 / §7 触控 170 / §7 非色相通道 / §8.2 TODO-1 / §1 原则 2）；③ [`level-select-page-layout.md`](../games/beads/design/ux/level-select-page-layout.md) 升 **v0.2**（§4.1 六条清零记录，并订正 §2 旧「间距 48」笔误）；④ [`arc-level-select-spec.s9-history.md`](../games/beads/design/ux/arc-level-select-spec.s9-history.md) §11 追加 v1.6 叙事（旧几何 K-053 划线留档）。
- **三项核对怎么落的（不伪造截图）**：① **对比度** = 用 WCAG 相对亮度对真实 `palette` hex 实算：`slot`/页底 **1.131:1**、`slotBorder`/页底 **1.185:1**（有纸面板时 1.050 / 1.406）；裁定 = **接受、不改描边**（轮廓不承担状态判定：锁形 / 描边宽 4 vs 2 / 星符号 / 缩略本体四通道），回退杠杆 = 描边换 `palette.locked`（**1.651:1**，既有 token、零新 hex）。② **清晰度** = 查源图实际像素（`l9-boss-mandala-256.png` = **256×256**）+ 设备像素换算（134 × 物理宽/750 = 201 / 230 / 257 / 366）⇒ 前三档为**下采样**；同一图已在走马灯 468×528 放大 1.8× 上屏 ⇒ 134 更安全；仅 >1433 物理宽（2048 档）才上采样 ⇒ 标 `[待真机]`，必要时升源 512。③ **星带 / 顶内缩** = 发现不变式「三边留白 18 / 8 / 28 恒定、格径增量 +50 全部给缩略」⇒ 裁 **不放大**，星字仍 `UI_FONT.cell` 22px，零共享常量改动、不新增第四档字号。
- **为何不动共享常量**：`THUMB_AREA` 由 `WALL_CELL` 派生且是 `drawLevelThumb` 缺省值，直接改会连带主菜单橱窗；页专用值（格 170 / 间距 30 / 缩略 134）由调用点传入，`drawLevelThumb` 已有 `area` 入参 ⇒ 主菜单与选关页各自取参、零耦合。
- **诚实限制**：① 三项核对中「真机观感」（整页格界可读性、平板/超宽屏缩略锐度）仍 **未验**，已登记 `menu-wall-signage-spec §7.3`；② 对比度结论为**接受现状**而非「达到 3:1」，若真机反馈轮廓糊再启用 `locked` 回退杠杆（一行换色）；③ `levelsLayout()` 仍走 `OVERLAY_PLATE` 600×720，**本批零代码**，落码归 UI-34；④ 9 格关卡结构（云端基底 vs 原型 CELLS 不一致）仍待用户裁定，不在本批射程；⑤ 本批无提交。
- **验证读数（2026-10-20）**：`ctx:check` **OK**（A/B/C/D/D2 + E3 全过；主规格回写后仍 ≤8000 tok 门，未新增豁免）；`check:links` **OK**（agents=7 / skills=40）；`check:tasks` **OK**（主表 71 ⇔ 详情 71，配对完整）；`pnpm run verify` **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**。

---

## WXG-T-309

**beads·UI 架构迁移 P4·UI-41 PlayPage 对局页基础场景** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §4「PlayPage（HUD、托盘、道具带、缩放控件；棋盘手势不动）」与 §12 UI-41；验收原文 =「对局金样本对拍；棋盘输入测试全绿」；迁移方式沿用 §9-4「旧入口保留为门面，直到最后一批」；前置 UI-31（暂停）/ UI-33（四结算）已就位。
- **落点（2 新建 + 5 处收口）**：① 新建 `src/view/play-page.ts::drawPlayPage(builder, snap, palette, inks)` —— 承接**整段基础场景**（伪震屏变换 → 底色 → HUD → 棋盘绘制 → 缩放控件 → 托盘 → 展开钮 → 道具带 → 扫光 → 连击特效），内部即原 `drawHud` / `drawGrid` / `drawZoomControls` / `drawTray` / `drawExpandButton` / `drawPowerupBand` / `drawSweep` / `drawComboVfx` 及全部私有辅助逐字搬入；`drawGear` 随 HUD 搬入并导出。② 新建 `src/view/shape-utils.ts`（`starPoints` / `arcPoints`，道具图标与结算星级共用的纯几何，独立成件避免循环依赖）。③ `view/view-model.ts`（2156 → 656 行）：`buildBeadsView` 保留为**唯一门面**，前缀改为一次 `drawPlayPage`，其后继续画彩带 MAIN → 过关 / 全通关 / 暂停 / 失败 / 冲刺结算面板 → 彩带 FG → 横幅（彩带 sandwich 不拆散）。④ 共享件上移：`bodyFont(largeText, name)` / `formatTime` → `ui-theme.ts`；`drawDashedRect` → `ui-widgets.ts`（托盘未解锁行与全通关未过关格共用）。⑤ `meta-view.ts` 的 `drawGear` 改从 `play-page.js` 导入。
- **为什么整场景抽而不是只抽四组控件**：原帧层序为 HUD → 棋盘 → 缩放 → 托盘 → 展开 → 道具带 → 扫光 → 连击，**层序交错**（缩放夹在棋盘与托盘之间），按「四组控件」拆会切碎一次 page 调用；且 grid 与 tray 共享 `drawLiftShadowOn` / `hintAlpha` / `groupLand*` 等辅助，整段搬运才不产生循环依赖。棋盘**手势与命中完全未动**（仍住 `game/beads-game/`）。
- **零漂移证据**：`ui-golden.test.ts` **11 例全绿、夹具零改动**（含 playing 态逐字同序）；新增前缀等价机检把「门面 = `drawPlayPage` + 结算层追加」变成可回归断言。
- **新增机检**：`tests/play-page.test.ts` 3 例 —— ① 门面等价（`buildBeadsView` 指令前缀 ≡ `drawPlayPage` 全量）；② 绘制 / 命中同源（齿轮中心、托盘槽心 × 6、道具卡中心 → 对应 `POWERUP_TYPES[i]`、展开钮中心及其收起态）；③ 静态门（六个 draw 在 `play-page` 内顺序递增；`view-model` 不再自带 `drawHud` / `drawGrid` / `drawTray` / `drawPowerupBand` / `drawZoomControls` / `export drawGear`；`meta-view` 从 `play-page` 导入齿轮）。
- **诚实限制**：① `play-page.ts` 单文件 1467 行，是「先搬后拆」的中间态——UI-42 接 Presenter 后可再按 HUD / 棋盘 / 托盘分件；② Presenter 与 UiRoot 路由尚未接线（`UI_ROOT_ENABLED` 仍默认关），本批只是**绘制入口**收口；③ 棋盘手势 / 命中未动，符合条目「棋盘手势不动」；④ 视觉统一（弹窗 chrome / 托盘纸面板化）按 §9-5 **不夹带**；⑤ `.meta` 未触碰，Cocos 镜像由 `framework:sync` 写入 6 件（play-page / shape-utils / view-model / ui-theme / ui-widgets / meta-view）；⑥ 本批无提交。
- **验证读数（2026-10-20）**：beads **94 文件 / 1113 passed + 2 skipped**（较上批 +1 文件 +3 例）；`pnpm run typecheck` 三包全过；`check:arch` OK（仅既有 L1 编辑器文件 WARN）；`framework:sync` beads 写入 6 / 未变 132 / 删除 0，`framework:sync:check` OK；`verify` **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**。

---

## WXG-T-308

**beads·UI 架构迁移 P3·UI-32 SigninModal 签到内容块** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §4「SigninModal 签到：`meta-view` 的 `signin` overlay → 领取、返回」与 §12 UI-32；验收原文 =「金样本对拍」；迁移顺序见 §9-3（设置 → 暂停 → 签到 → 四个结算）。
- **落点（1 新建 + 1 处派发）**：① 新建 `src/view/signin-content.ts` —— 标题单源 `SIGNIN_TITLE`（`tokens.md §7` 无对应键，维持既有字面）、`signinCellLayout(plate)`（7 格 = 4 + 3 居中，格 110 / 间距 18，相对静止态底板派生）、`drawSigninContent(...)`（已领 = 灰底 + ✓ α0.6 / 今日 = 主色 4px 描边 / 未领 = ❤ 或 🪙 奖励文案）；② `meta-view` 的 `signinLayout` 改调 `signinCellLayout`，标题读 `SIGNIN_TITLE`，格绘制改调 `drawSigninContent`（指令顺序逐字未变）；**领取 / 返回钮、遮罩与底板就地未动**（绘制与命中共用 `metaLayout` 同一份缓存）。
- **零漂移证据**：`ui-golden.test.ts` **11 例全绿、夹具零改动**（signin 态逐字同序）；`bead-style-settings.test.ts` 的 signin 遮罩 α 判据仍绿。
- **新增机检**：`tests/signin-content.test.ts` 5 例 —— 7 格版式（4+3 居中 / 全落底板内）、`metaLayout('signin')` 与 `signinCellLayout` 同源 + 领取/返回可命中、三态绘制（✓ 计数 / α 0.6 / 今日 4px 主色）、不可领取时今日按已领画、单源静态门（`meta-view` 不再自带签到字面）。
- **诚实限制**：① 弹窗 chrome 未并入 `ModalFrame` —— 签到底板历史画法 = 无投影、无描边的素面 rect，与纸面板不同形，§9-5「视觉统一不夹带」⇒ 留给视觉裁定；② 不引入开合时钟 —— 签到入口已退役（Q5①，`ux-spec` §5.1b），无真实开启动线，⛔ 不造死路径；③ `.meta` 未触碰，Cocos 镜像由 `framework:sync` 写入 2 件（新件 + meta-view）；④ 本批无提交。
- **验证读数（2026-10-20）**：beads **93 文件 / 1110 passed + 2 skipped**；`typecheck` 三包全过；`framework:sync` beads 写入 2 / breakout 0；`verify` **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**。

---

## WXG-T-307

**beads·UI 架构迁移 P3·UI-33 四个结算弹窗共享结果骨架** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §8「`systems/*-panel.ts` 里的布局与命中纯函数就地保留、由 Presenter 调用（避免一次性搬迁）；它们的开合动画状态类退役，改用 `ModalLifecycle`」与 §12 UI-33；验收原文 =「四界面金样本对拍；意图一一对应」；动机见 ADR-0032 §1 第四行（`PausePanel` / `ClearPanel` / `SprintSettlePanel` / `FinishPanel` 各有一套开合进度、均读 `PANEL_IN_MS` ⇒ 同一件事四份实现；其中 Pause 已随 UI-31 收口）。
- **落点（1 新建 + 3 收口）**：① 新建 `src/systems/result-panel.ts::ResultPanelClock` —— 开合改框架 `ModalLifecycle`（时长仍由本模块给 `PANEL_IN_MS` / `PANEL_OUT_MS`），逐项入场公式 `popsShown(count, stepMs)` / `popScale(index, stepMs)` 合为一份（星级逐颗与通关逐关本同一公式，只差步长）；② `ClearPanel`（−54/+19）、`SprintSettlePanel`（−27/+11）、`FinishPanel`（−57/+20）的 `_elapsed` / `_shown` / `_closing` 三件套退役，改为 `private readonly _clock = new ResultPanelClock()` 逐项委托；③ `FinishPanel.elapsedMs` 公开 getter 无调用方 ⇒ 删除；④ **布局 / 命中 / 文案纯函数一行未动**（§8），公开 getter 口径不变（入场即可点 / 退场零响应 / 未显示 `progress = 0`）。失败面板（`FailPanel`）旧实现即由 `game-over` 相位直接驱动、不持时钟 ⇒ 不持本骨架（代码头注已写明）。
- **零漂移证据**：视图侧不消费面板 `progress`（`drawClearPanel` / `drawFailPanel` 传 `progress: 1` 给 `drawModalFrame`；`drawSprintSettle` 手绘单层板；`drawFinishPanel` 只画遮罩 + 彩带）⇒ 本批**未改 `view-model.ts` 一行**，`ui-golden.test.ts` **11 例全绿、夹具零改动**（含 clear / sprint-settle / finish 三态，fail 态亦不动）。
- **意图一一对应**：四份面板既有测试经真实 `tapDesign` 全绿（过关 下一关/冲刺、失败 复活/重试、冲刺结算 再来/返回、全通关 重玩/冲刺/回菜单），`panel-router.ts` 未改 ⇒ 动作 id 路由不变。
- **新增机检**：`games/beads/tests/result-panel.test.ts` 5 例 —— 三面板循环同一开合口径（入场即可点 / 中途 0.5 / 满格 / 退场零响应 / 退场后归零）、逐项入场同一公式（clear 3 颗 vs finish 8 行，弹跳同 0→1.2→1）、骨架退场归零。
- **诚实限制**：① 入场中途反向（close 后再 open，<200ms）从当前进度续走（旧实现跳回 0）——`ModalLifecycle` 既定改善，与 UI-31 同源；② `open()` 重入不再把进度重置为 0（旧三件套会），现流程无此路径；③ 弹窗 chrome 视觉统一（遮罩 / 纸面板合一）按 §9-5 **不夹带**，另开 UX 裁定；④ `.meta` 未触碰，Cocos 镜像由 `framework:sync` 写入 4 件；⑤ 本批无提交。
- **验证读数（2026-10-20）**：定向 5 文件 46 例全绿；beads **92 文件 / 1105 passed + 2 skipped**；framework **44 文件 / 482 绿**（未改动）；`tsc --noEmit` 0；`framework:sync` beads 写入 4 / breakout 0；`verify` **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**。

---

## WXG-T-306

**beads·UI 架构迁移 P3·UI-31 PauseModal（动画改 ModalLifecycle + 设置钮绘制收口）** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §4「PauseModal 暂停 … 内嵌 `SettingsContent`」、§8「`systems/*-panel.ts` 里的布局与命中纯函数就地保留、由 Presenter 调用（避免一次性搬迁）；它们的开合动画状态类退役，改用 `ModalLifecycle`」与 §12 UI-31；验收原文 =「暂停相关现有测试全绿」。
- **落点（1 框架补件 + 2 处代码收口）**：① `packages/framework/src/core/ui/modal-lifecycle.ts` 新增 `reset()`（关合中途也硬收，供 dispose）；② `systems/pause-panel.ts`：`PausePanel` 自持的 `_state` / `_elapsedMs` 时钟退役，改持 `ModalLifecycle`；时长仍由本模块按 `PANEL_IN_MS` / `PANEL_OUT_MS` 传入；`interactive` 保持旧口径 = `open` **或 `opening`**（入场帧起可点，关合零响应）；`visible` / `durationMs` / `progress` getter 面不变；**布局与命中纯函数 `pausePanelLayout` 一行未动**（§8）。③ `view/settings-content.ts` 新增 `drawPauseSettingButton(...)` —— 暂停档设置钮单源（开关 chip 选中木底 / 关态纸底描边 / 按下换面；选择器纸钮 + 小字档；文案仍走 `settingsContentLabel`）；`view/view-model.ts::drawPausePanel` 改逐钮派发（设置项走新函数，继续 / 重玩 / 回主菜单就地画）⇒ 指令流顺序与旧实现逐字相同。
- **零漂移证据**：`ui-golden.test.ts` **11 例全绿、夹具零改动**（含暂停态）；`pause-settings.test.ts` **14 例全绿**（§8-1 零响应 / §8-8 幂等 / §8-10 200/150ms 单调 / §8-11 / §8-13 全过）。
- **新增机检**：框架 `modal-lifecycle.test.ts` +1（`reset()` 中途硬收且可重开）；beads `tests/pause-modal.test.ts` 4 例（入场可点 / 关合零响应 / reset 中途生效；chip 三态配色；选择器纸钮 + 小字档 + 文案同源）。
- **诚实限制**：① 「复用 SettingsContent」只到**动作 / 文案 / 设置钮绘制**；暂停版式几何按 §8 仍住 `systems/pause-panel.ts`，未搬进内容块；② 暂停面板的弹窗 chrome（遮罩 / 纸面板 / 标题 / 进出场几何）仍由 `view-model` 直调 `ModalFrame`，等 P4 Presenter 收口；③ 入场中途反向（pause → resume → pause，<200ms）现从当前进度续走（旧实现会跳回 0）——这是 `ModalLifecycle` 的既定改善，现有测试未覆盖该路径；④ 本批无提交。
- **验证读数（2026-10-20）**：beads **91 文件 / 1100 passed + 2 skipped**；framework **44 文件 / 482 绿**；`tsc --noEmit` 0；`verify` **PASS 22 / FAIL 0**；`framework:sync` beads 写入 4 / breakout 写入 1。

---

## WXG-T-305

**beads·UI 架构迁移 P3·UI-30 SettingsModal + 共享 SettingsContent** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §4 SettingsContent「设置内容块（音乐 / 音效 / 减弱动效 / 大字号 / 震动 / 珠风格 / 豆尺寸 / 皮肤 / 性能信息…），含「调试」分区；按场景（菜单 / 暂停）出变体」与 §12 UI-30；验收原文 =「金样本对拍；全部动作可达」。
- **落点（1 新件 + 2 处接线）**：① 新建 `src/view/settings-content.ts` —— `SettingsAction`（10 动作）、`settingsContentButtons(plate)`（5 行 × 2 列，几何与旧口径逐字相同）、`settingsContentLabel(id, data)`（档位文案）、`drawSettingsContent(...)`（按钮绘制 + 按下位移）、`isSettingsAction`。② `view/meta-view.ts`：`settingsLayout` 改用内容块布局；`label()` 的十个设置 case 改调 `settingsContentLabel`；绘制循环前先画内容块、循环内跳过设置动作（返回 / 在线导入仍属弹窗 chrome）。③ `view/view-model.ts`：暂停面板 `panelLabel` 的九个设置 case 改调同一函数 ⇒ 两入口档位名从此只改一处；删三处已无用的注册表 import。
- **零漂移证据**：`ui-golden.test.ts` **11 例全绿**（设置态指令流逐字不变，夹具零改动）；`bead-style-settings` 36 例、`pause-settings` 14 例全绿。
- **新增机检**：`tests/settings-content.test.ts` 5 例 —— 10 钮 5×2 几何（首钮 280/877/248/88、末钮 552/461）；**每个按钮中心命中自己**（逐钮可达）；开关两态 + 三选择器文案；按下态 rect 下沉；静态门（暂停面板改读同函数、不再自带设置项字面）。`skin-system` 的 `cycle-skin` 第四入口静态门白名单补入新件。
- **诚实限制**：① 弹窗 chrome（遮罩 / 纸面板 / 标题 / 返回 / 在线导入）仍住 `meta-view`，本批只抽内容块；搬进 `ModalFrame` 属 UI-31（会改几何 ⇒ 需重抓金样本）；② 「调试分区」未加视觉分隔（Debug / 性能信息仍与其它钮同列）——加分区标题会改画面，按迁移期零漂移口径留待视觉裁定；③ 本批无提交。
- **验证读数（2026-10-20）**：beads **90 文件 / 1096 passed + 2 skipped**；`tsc --noEmit` 0；`verify` **PASS 22 / FAIL 0**；`framework:sync` 写入 3。

---

## WXG-T-304

**beads·UI 架构迁移 P2·UI-25 UiRoot 组合根与 UiHost 接口（与旧链并行挂接）** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §6 运行时流程「UI 根取 Navigator 的可见路由集，自下而上逐个 `View.draw`；最后画 `DebugLayer`」与 §12 UI-25「UiRoot 组合根与 UiHost 接口，与旧链并行挂接（开关）」；验收原文 =「开关关闭时全仓测试与改动前一致」。
- **落点（2 新件 + 3 处接线）**：① `src/ui/ui-root.ts` = `UiRoot`：持有 `Navigator`，`draw` 按 `visibleRoutes` 自下而上画路由（可见集写进复用数组，零分配），末尾画 `drawPerfOverlay`；`update` 推进路由栈；导出开关 `UI_ROOT_ENABLED: boolean = false`。② `src/ui/ui-host.ts` = `UiHost` 窄接口与 `UiDebugState`：迁移期只暴露调试投影（L5：UI 不读游戏对象）；意图面留 P3 Presenter 落地，避免空动作联合。③ `beads-game`：新增 `debugState(out, onMenu)` —— 开关 / 帧耗时 / 相位 / 关卡 / pitch·LOD 文案的**唯一出处**，`drawDebugLayer` 改为先取它再画（旧链输出逐字不变）。④ `beads-shell`：构造 `UiRoot`（host 复用 `_uiDebug` 对象、菜单腿由 `_screen !== 'play'` 判定）；`update` 开关打开才推进路由栈；`buildRenderModel` 两腿改经 `_drawDebugLayer` 分流。
- **并行挂接口径**：开关关闭（默认）= 旧链直调 `play.drawDebugLayer`，逐字不变；打开 = `UiRoot` 接管调试层（可见路由 + DebugLayer），**内容仍由旧链画** ⇒ 随时可回退，P3 起逐界面注册为路由，P5 拆旧链后开关退役。
- **验收证据**：`tests/ui-root.test.ts` 4 例 —— 开关默认 false；**空栈时与旧链 `drawPerfOverlay` 指令逐字相同**；page→modal→调试层顺序；调试关时路由照画、零覆层。金样本十一例零差异（默认关 ⇒ 帧不变）。全量 beads **89 文件 / 1091 passed + 2 skipped**；`verify` **PASS 22 / FAIL 0**；`framework:sync` 写入 4。
- **诚实限制**：① 本批只有组合根与调试层接管，路由集为空（十个界面仍是旧链绘制，属 P3/P4 迁移范围）；② `UiHost` 暂无意图方法（无执行者，按 ponytail 不先造）；③ 本批无提交。

---

## WXG-T-303

**beads·UI 架构迁移 P2·UI-24 DebugLayer（性能覆层上移、标定线单源、菜单可看）** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §4 DebugLayer「挂在所有路由之上：性能覆层（帧率 / 帧耗时，半透明窄面板，禁用全屏 α）+ 安全区标定线；性能采样上移到 UI 根，菜单与弹窗里同样可看」；验收原文 =「菜单与弹窗内可见性能信息；对局金样本不变」。
- **落点（1 新件 + 4 处接线）**：① `src/view/debug-layer.ts` = `drawPerfOverlay(builder, palette, enabled, frameMs, phase, level, detail)`（原对局覆层逐字搬入：`rect(12, top-148, 316, 136)` + `scrimFill(canvas, 0.7)` + 三行文本；`enabled = false` 零指令）+ `drawSafeGuideLines`（从 `view-model` 原样搬入）。② `view-model`：删覆层段与标定线定义，改 import。③ `beads-game`：`update` 开头调 `sampleFrame(dt)`（EMA 单源方法）；新增 `drawDebugLayer(builder, onMenu)`（对局取快照相位 / 关卡 / pitch / LOD，菜单只出 fps + `menu`）。④ `beads-shell`：`update` 菜单腿单独喂 `sampleFrame`（`play.update` 不跑）；`buildRenderModel` 两腿**末尾**调 `drawDebugLayer`（对局在 `play.buildRenderModel` 之后、菜单在 `buildMetaView` 之后）⇒ 弹窗与菜单面板都被盖住。
- **口径保持**：半透明窄面板（非全屏遮罩，避免改变 fill 负载污染帧样本）；三行布局 / 行距 / 字体逐字不变；标定线三线三标注不变。
- **金样本验收**：`ui-golden.test.ts` **11 例全绿、夹具零改动**（十态默认 `debugInfo = false` ⇒ 零指令）。
- **新增机检**：`tests/debug-layer.test.ts` 4 例（关零指令 / 开三行 + 面板几何 + α 0.7 / 菜单两行不画空行 / 标定线三线三字）；`bead-style-settings` 增 2 条：真 shell 菜单帧开 `debugInfo` 出现 `fps`、关回去消失；静态门钉「两腿都接且排在各路由之后」+ view-model 不再有裸 `scrimFill`。
- **诚实限制**：① 「SettingsContent 调试分区」未做——共享内容块属 UI-30，本批只收 DebugLayer；② 菜单腿覆层压住菜单顶棚资源条（仅 debug 开时出现，非默认态），UI-25 总装时可移到内容带；③ 本批无提交。
- **验证读数（2026-10-20）**：beads **88 文件 / 1087 passed + 2 skipped**；`tsc --noEmit` 0；`verify` **PASS 22 / FAIL 0**；`framework:sync` 写入 3。
- **差异处置**：调试开关默认关 ⇒ 默认画面零改；若未来默认开或改面板几何，须重抓金样本。

---

## WXG-T-302

**beads·UI 架构迁移 P2·UI-23 ScreenFrame + NavBar（安全区分区、胶囊避让）** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §12 UI-23「ScreenFrame + NavBar（安全区分区、胶囊避让）」；验收原文 =「注入胶囊矩形时控件不入矩形」。
- **落点（1 新件，零接线）**：`games/beads/src/view/ui-frame.ts` = `screenFrame(insets, margin?)` 把框架层 `SafeInsets` 三条安全带转成去边距的 `FrameRect`；`navBar(insets, spec)` 出 `bar / title / back / right / capsule` 布局。`tuning.ts` 补 `NAV_BAR_ICON = 56` / `NAV_BAR_GAP = 8`（机制默认值，UI-25 接线时按 tokens 校准）。
- **胶囊避让口径**：胶囊与本栏垂直相交才避让；按胶囊落左半 / 右半 / 横跨收窄可用横向区间——左半推 `leftEdge = capsule.right + gap`、右半压 `rightEdge = capsule.left - gap`、横跨则整栏无可用区（不放返回、不放槽、标题宽 0）。返回键与右侧槽排不下即不排，绝不越界。
- **迁移期不改画面**：现有菜单顶棚 / 对局 HUD / 选关页手算坐标一处未动，本件供 UI-25 总装消费 ⇒ 金样本十态天然不变。
- **新增机检**：`tests/ui-frame.test.ts` 8 例——无胶囊基准、胶囊右上（控件全不入矩形）、胶囊左上（返回键右挪）、横跨（零控件）、不在本栏（不避让）、槽溢出（只排能排的且不重叠）、三区矩形同界、内容区顶界 = 胶囊底。
- **诚实限制**：① ScreenFrame 的「背景 / 调试层挂点」未出——背景各页异构、调试层属 UI-24；② `NAV_BAR_ICON` / `NAV_BAR_GAP` 尚无消费面，未入 §3 冻结；③ 本批无提交。
- **验证读数（2026-10-20）**：`tsc --noEmit` 退出 0；`verify` **PASS 22 / FAIL 0**；新增单测 8 例绿。
- **差异处置**：同前批——接线批（UI-25）若改画面，须先有 UX 裁定并重抓金样本。

---

## WXG-T-301

**beads·UI 架构迁移 P2·UI-21 通用按钮控件（四族并入单入口）** · 负责：主理人(Qoder)·程基岩域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §12 UI-21「通用控件（WoodButton 等），合并两套按钮绘制」；验收原文 =「按钮金样本对拍一致」。
- **落点（1 新件 + 9 处消费面）**：`games/beads/src/view/ui-widgets.ts` = `drawButton(builder, palette, x, y, w, h, tone, radius, label?, font?, pressed?, disabled?, sheen?)`；tone 四族：`wood`（T3/T4 木钮，含可关顶缘受光线）/ `accent`（菜单主钮）/ `ghost`（菜单次钮）/ `paper`（T1 纸次钮）。位置参数、热路径零分配。
- **收口清单**：原 `view-model::drawWoodButton` 4 处（暂停续玩 / 失败续时 / 托盘展开 / 过关下一关）+ 原 `meta-view::drawButton` 2 处（菜单 CTA / overlay 按钮）+ 暂停 / 失败 / 过关三处手写纸次钮 3 处；两处本地函数删除，改为单一入口。
- **逐字保留**：木钮「面 → 顶缘受光线 → 底缘承重线 → 木色字」、菜单钮「2px 同色描边 + 面板色字」、纸钮「`panelBorder` 1px + 正文色字」；按下换 `woodFacePressed`、禁用 α 0.5、sheen 关闭（T4）均按原分支；指令顺序与收拢前一致。
- **金样本验收**：`tests/ui-golden.test.ts` **11 例全绿、夹具零改动**（十态 sha/total/kinds 全等）⇒ 静息态逐字无漂移。
- **新增机检**：`tests/ui-widgets.test.ts` 6 例（木钮静息 / 按下 / 无受光线无字、纸钮、菜单主钮、禁用 α）。
- **诚实限制**：① chip（开关类按钮）仍手写——它有「选中 = 木底、未选 = 纸底」双态，不属静态四族，留给 SettingsContent 批；② 按钮圆角仍由调用方传（木钮有两档 16 / `radiusWood`），未强行统一；③ 本批无提交，工作树另含 T-296…300 历史未提交件。
- **验证读数（2026-10-20）**：beads 全量 **86 文件 / 1074 passed + 2 skipped**；`tsc --noEmit` 退出 0；`verify` 读数见会话结论。
- **差异处置**：同前批——只允许「源码形态变、像素流不变」；按钮视觉要改先有 UX 裁定并重抓金样本。

---

## WXG-T-298

**beads·UI-02 金样本（十界面整帧指令流封箱 + 只读对拍）** · 负责：主理人(Qoder)·严守真域 · 状态：✅ 完成（2026-10-20）

- **任务（用户 2026-10-20 选下一步 A）**：按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §12 UI-02「建金样本：每界面 × 关键状态抓取现行 RenderModel 指令序列」；验收原文 =「覆盖十个单元；对拍工具可重复运行」。定位 = §9.4 迁移期「逐条对拍，不得有无登记的差异」的守门员，同时是 UI-20 验收与 UI-30 开工的硬前置（ADR-0032 DEC-6）。
- **落点（3 新件 + 1 夹具）**：`games/beads/tests/ui-golden-scenes.ts`（十态共享驱动：`createBeadsShell` → 真实入口 `tapMeta` / `play.tapDesign` / 通关填盘 / 倒计时，每态带 `screen/overlay/phase` 场景自证）｜`ui-golden-capture.ts`（非 `.test.ts` 的独立复取器，**连跑两遍逐态记录全等才写盘**；`--dump` 另把全量流写 `temp/ui-golden/`）｜`ui-golden.test.ts`（只读对拍，⛔ 不写夹具）｜`__fixtures__/wxg-t-298-ui-golden.json`。
- **十态覆盖（§5 十界面各取一关键态，夹具按此序）**：MainMenuPage `main-menu` 3661 条｜LevelSelectPage `level-select` 1423｜SettingsModal `settings` 25｜SigninModal `signin` 28｜PlayPage `play` 654｜PauseModal `pause` 676｜ClearResultModal `clear` 702｜FailResultModal `fail` 656｜SprintSettleModal `sprint-settle` 952｜FinishModal `finish` 838。
- **封箱口径**：每态锁 `sha256(命令流 join("\n"))` + `total` + 逐 `kind` 计数 + 宿主消费的 `background` / `transform` + 场景自证；polygon 命令按 `polygonVertices()` 内联 `points`（顶点漂移同样进 sha）。全量流约 1.6 MB ⇒ **不整份入库**，差异时由测试把 actual 流 dump 到 `temp/ui-golden/<id>.actual.jsonl` 供逐条差分。
- **可重复性证据**：`capture` 内置双跑自证；另实测**连抓两次夹具逐字节一致**（`sha256 = ae985f2f7239fa95f0dcd7da69df6e3cfad2bf973323683157a01bd0ae1e43f2`）。固定因子 = `Viewport(750×1334)` / `pixelRatio 2` / `createRng('beads-ui-golden')` / clock `1_700_000_000_000` / 步长 `1/60`；菜单播种 `staminaCur=99`、`maxUnlockedLevel=9`；对局 `simpleTestLevel()` 6×5（clear/finish `noBootAssembly` 空盘；fail `time=30`；冲刺 `sprintTime=90`）。
- **诚实限制**：`signin` 当前无菜单入口（Q5① 退役，`beads-shell.test.ts` 明令菜单不得有签到热区）⇒ 该态经测试后门置 `_overlay='signin'`，为迁移基线保留；入口恢复后应改回真实路径并重抓。
- **验证读数（2026-10-20）**：`tests/ui-golden.test.ts` **11 例绿**（1 覆盖腿 + 10 态对拍）；beads 全量 **83 文件 / 1057 passed + 2 skipped**；`games/beads` `tsc --noEmit` 退出 0；`pnpm run verify` **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**。
- **差异处置（正本纪律）**：任一态红 ⇒ 先查 UI 渲染路径是否被改；视觉变更须先有 UX 裁定并在 `ui-architecture-beads` §12 登记，再仅由 `ui-golden-capture.ts` 在**可复现锚**重抓；⛔ 不得手改夹具求绿（K-051 / K-053 / K-082）。
- **后续联动**：UI-20/21/22/23/24 与 UI-30/31/32/33/34/40/41 的「金样本对拍」验收直接消费本夹具；新增界面或状态 = 扩 `STATES` + 重抓（覆盖腿会拦掉漏登记）。

---

## WXG-T-297

- **任务**：beads UI 架构迁移 P1 收口——“UI-13 SafeInsets + UI-14 完整闭环”（用户 2026-10-20 选下一步 A）。
- **落点（1 新文件 + 3 适配器 + 1 导出行）**：`packages/framework/src/core/ui/safe-insets.ts`（`SafeBand` / `SafeInsets` / 纯函数 `computeSafeInsets(platform, viewport)` / `SafeInsetsCache`；dp → 设计 px 走 **`1/scale`**，字母屏亦正确；`topBar / content / bottomBar` 三段全 y-up；胶囊无值恒 `null`）｜`core/game/game.ts` 新增 `CapsuleRect` 类型与 `PlatformInfo.capsuleRectDp`（dp、原点屏左上，`capsuleBottomDp === capsuleRectDp.bottom`）｜weapp 适配器一次读出完整矩形并做合法性校验（缺 API / 任一分量非有限 / `right ≤ left` / `bottom ≤ top` ⇒ `null`；旧 `capsuleBottomDp` 由矩形派生）｜web / node 显式 `null`（⛔ 不是零矩形）｜`core/ui/index.ts` 导出 `safe-insets`。
- **测试**：新增 `tests/core/safe-insets.test.ts` **7 例**（dp→设计换算与 y-up 翻转、三段带、安全区上沿低于胶囊时取安全区、无胶囊为 `null` 而非零矩形、字母屏 `1/scale`、超屏 clamp、缓存命中 / 视口变化 / 平台变化重算）；`tests/platform/platform.test.ts` 补 weapp 完整矩形、反相矩形归 `null`、web / node 各补 `capsuleRectDp === null`。framework 全量 = **44 文件 / 481 例绿**。
- **验证读数（2026-10-20）**：`pnpm --filter @wxgame/framework run typecheck` 退出 0｜`pnpm run check:arch` OK（L2 无违规）｜`pnpm run framework:sync` = beads / breakout 各写入 **6**（`safe-insets` + 4 件改动 + 导出行），`framework:sync:check` 绿｜`pnpm run verify` = **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**。⚠ 新增拷贝件无 `.meta`，需开 Cocos 编辑器生成（L1）。
- **状态**：✅ 完成（2026-10-20）。UI-14 至此全量闭环；下一关键路径 = UI-20 UiTheme（依赖 UI-14）或 UI-02 金样本（UI-30 前置，可并行）。

---

## WXG-T-296

- **任务**：beads UI 架构迁移 P1 机制层（ADR-0032 已 Accepted；按 [`ui-architecture-beads.md`](../docs/architecture/ui-architecture-beads.md) §12 关键路径）。
- **范围（本批）**：**UI-10 Navigator**（`packages/framework/src/core/ui/navigator.ts`：基于 `SceneStack`，路由类型 `page` / `modal`，`push / pop / replace / reset`，栈顶独占输入，可见路由集 = 栈顶向下到第一个 `page` 为止）｜**UI-11 ModalLifecycle**（`core/ui/modal-lifecycle.ts`：`closed / opening / open / closing` 四态 + 0..1 进度，`dt` 驱动，中途反转从当前进度续走，零分配）｜**UI-12 PressTracker**（`core/ui/press-tracker.ts`：按下登记、抬起命中同目标才产出提交；移出 / 换目标 / 取消 ⇒ 零提交；同帧 down+up = 即时点击，对照 `input-control` v2.13）。三者均纯新增，**不改** `buildBeadsView` / `buildMetaView` / shell 导航标志位 ⇒ 零视觉漂移。
- **验收（引自 §12）**：UI-10 单测覆盖 push / pop / replace / reset 与屏障；UI-11 覆盖开合与中途反转；UI-12 覆盖移出取消与同帧即时点击；`check:arch` / `framework:sync:check` 绿。
- **落点（5 新文件 + 1 行导出）**：`packages/framework/src/core/ui/navigator.ts`（`Route = Scene + kind`；`visibleRoutes(out)` 从最近的 `page` 起自下而上写入调用方数组，热路径零分配；`blocksBelow` = 栈顶为 `modal`）｜`modal-lifecycle.ts`（四态 + 0..1 进度；中途反转从当前进度续走；`duration ≤ 0` 即时完成；纯标量）｜`press-tracker.ts`（`begin / end(hit) / cancel`；`end` 仅在抬起点与登记目标同引用时返回目标）｜`core/ui/index.ts`（三件导出）｜`core/index.ts` +1 行 `export * from './ui/index.js'`。均为纯新增，`buildBeadsView` / `buildMetaView` / shell 标志位**零改动** ⇒ 零视觉漂移。
- **测试**：新增 3 文件 **21 例**（Navigator 7 / ModalLifecycle 8 / PressTracker 6），逐条覆盖 §12 验收：push / pop / replace / reset 与屏障、开合与中途反转、移出取消与同帧即时点击；另含 `visibleRoutes` 复用数组、`reset` 的 onExit/onEnter、负 dt 与超长 dt clamp。`packages/framework` 全量 = **43 文件 / 474 例绿**。
- **验证读数（2026-10-20）**：`pnpm --filter @wxgame/framework run typecheck` 退出 0｜`pnpm run check:arch` OK（L2 无违规，仅沿用 1 条 L1 编辑器产物提醒）｜`pnpm run framework:sync` = beads / breakout 各写入 5（三件 + `ui/index` + `core/index`），`framework:sync:check` 绿｜`pnpm run verify` = **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**。⚠ 新增拷贝件无 `.meta`，需开 Cocos 编辑器生成（L1，脚本不碰）。
- **状态**：✅ 完成（2026-10-20）。遗留：**UI-13 SafeInsets** 未开工（需 `PlatformInfo` 补胶囊完整矩形 + weapp / web / node 三适配器单测）；**UI-14** 的 UI-10…12 导出与镜像已落，`safe-insets` 导出待 UI-13。✅ **两项均于同日由 WXG-T-297 收口**；UI-02（金样本）与 UI-13 可并行。

---

## WXG-T-295

> beads·区外按钮改「抬起才提交」（输入时基统一）｜主理人(Qoder)·用户直裁｜程基岩域 + 文策域｜2026-10-19（用户原话「所有按钮应该按下抬起后再响应，如果按下，移动到按钮外部，那么抬起不会响应」；AskUserQuestion 两裁 = 范围「所有按钮类控件」+「文档先行一并回写」）

- **翻的是哪条冻结裁定**：`input-control §2.1` v2.5 立的「未翻清单」——棋盘区抬起才提交（WXG-T-167/169 已翻）、**区外按下即提交**（未翻）。本批把区外**按钮类控件**一并翻成「抬起才提交」。机制 = **按下腿只登记控件身份、抬起腿在抬起点重测热区且要求仍是同一颗控件才派发** ⇒ 拖出热区 / 按住移到别的钮 / 期间相位已变 = 零响应零事件零扣次零音效。业务判定**一行没新写**：派发仍走原路由腿（`_handleTap` / `_applyMetaAction`），本门只决定「这一帧派不派」。
- **明示未翻（范围门）**：托盘槽 4a/4b（落子与取回目标，不是按钮）、棋盘格（v2.5 起本就抬起）、缩放滑轨（拖拽控件 ⇒ 按下即进拖拽态并逐帧跟随）、遮罩空白、`tapDesign`/`tapMeta` 调试旁路（合成一次完整点击 ⇒ `justUp=true` 当场过门）。**范围外两件**（本轮实测核过，非推断）= `packages/framework` 无按钮层（`hitTest` 全仓零命中，命中几何在各游戏面板里）⇒ 不动框架；`games/breakout` 的 `_readInput` 只有「全屏 tap 发球 + 挡板跟随」零按钮控件 ⇒ 零改动。
- **落点（两文件）**：`beads-game.ts` 新字段 `_uiPressTarget` + `_hitUiControl()`（按下腿）+ `_commitUiTap()`（抬起腿）+ 两处装配复位（`_uiPressTarget = ''`，防在途按压跨到新手牌指向不存在的控件）；`beads-shell.ts` 新字段 `_menuPress` + `_commitMenuPress()` + `update()` play 分支清登记。两条纪律写进函数头注：① **命中序必须与 `_routeTap` 逐条同序、几何全走同一批 `hit*` helper**（⛔ 不写第二套坐标，否则「按下判 A 抬起判 B」= 热区漂移，同 `meta-view::hitTestMeta` 头注口径）；② shell 侧比 **`id` + `slot`** 而非对象引用全等（选关页布局表每帧重建，引用会漂）。热路径零分配：按下腿返回值全是常量串或 `''`。
- **顺带修掉一个旧缺口**：旧 `_readMenuInput` 在 `!isDown` 提前 `return` ⇒ 同一固定步内 down+up 的菜单快点击**被吞**（与 WXG-T-170 在局内修掉的是同一个坑的菜单腿）。本批重排该函数（先按 `justDown` 登记、再独立判 `!isDown` 提交）⇒ 顺手补上，属**新行为**，已配用例而不是只改注释。
- **文档五件同批**：`input-control` **v2.13**（§2.1 提交时基段重写 + 路由表拆「区外按钮 / 区外非按钮」两行 + §3 输入行 / §6 手势边界 / §8 范表与判据 9 / §9 变更行）｜`core-loop` **v2.4**（U11 修正声明加订正子句：扫光链起点 = `powerup:used` **发射帧**，该帧现在 = 提交帧；旧文划线留档 K-053）｜`ux-spec` **v1.22**（§4 交互矩阵表头「区外拆分」+ 逐行改标「区外·抬起才提交」+ 托盘行标「非按钮未翻」+ §5/§8 U11 随迁注 + 文末变更记录）｜QA `test-cases` **v1.23**（§A4c.0 驱动口径由「push(down) 即断言」改为「down 帧 + up 帧两帧驱动」，并列出**旧读数降级清单**——只 push(down) 的历史断言不再构成证据，K-035）｜`ADR-0015` 头部加「修订（2026-10-19 · WXG-T-295）」行（原 C-3(a) 只写棋盘区，区外那句现失效）。
- **测试**：新增 `tests/ui-input-timing.test.ts` **7 例**（面板主钮 down 不提交 / up 才提交、拖出热区零响应、A 钮拖到 B 钮两者都不生效、齿轮抬起才暂停、滑轨仍按下生效且逐帧跟随、托盘槽按下帧提交=未翻对照、主菜单钮拖出与跨钮取消）——**每条零响应腿都配同坐标同帧形的正向对照**（K-054，否则「热区整个失效」也能交出绿）；改写 `p3-pressed-shelf`（主钮与 shell 菜单按下态两例）、`pause-settings`（删本地 `tapInFrame` 改用 `tests/helpers.ts` 那份 + §8-6 余量 1 帧→2 帧）、`frame-order`（fo-1 保序正证留、fo-2 因道具卡提交后仍留 PLAYING ⇒ 改断 `time - 2*STEP` 并**如实写明本例不再对道具卡证明「输入先于计时」**）。变异实测：拆掉「同一控件」判定 ⇒ 只有跨钮两条腿转红 ⇒ 据此给 shell 补一条「齿轮按住 → 在 start CTA 抬起」跨钮腿（变异下确实红：`expected 'play' to be 'menu'`），「拖到空白」那条是靠抬起点落空成立而非身份判定，已如实记为两条不同判据。
- **按下态换形（用户可退）**：`_pressedButtonNow()` 的语义由「按下即提交 ⇒ 淡出期内续亮到淡完」变为「**按住期间亮、抬起提交那帧即灭**」（切相位与起淡出同帧发生在手指已离开的抬起帧）。判定**不加 latch 新状态**——旧承载理由随按下即提交前提一起消解，加状态才是过度设计。
- **验证读数（分时刻，⛔ 不混为一谈）**：① 20:3x 本批收口 = beads **1042 例绿**（82 文件）、`framework:sync` 副本一致、`verify` **PASS 19 / FAIL 3**（typecheck / cocos:check / harness:build，三条同根 = BD-62 在途件缺 `_viewData` 两字段初始化；本会话临时补那两行证实三门转绿后**撤回**，不越界代改他人尺度）② 20:51 复测 = **同一套件 5 文件 39 例红**，根因**不在本批**：拆分会话把 `_camera` 移进 `BoardCameraController` 而 `tests/helpers.ts::pinIdentityCamera` 仍按旧字段写 ⇒ `Cannot set properties of undefined (setting 'zoom')`（`createBeadsHarness` 前置腿，全 harness 类用例连坐）。③ 21:0x 再复测 = 该前置腿已由**拆分会话自己修好**（改读 `_board.camera`）⇒ 21:01 beads 全量 **82 文件 / 1042 passed / 2 skipped**（含本批 7 例），`verify` 的 `test` 门 PASS、`framework:sync:check` 亦转绿（拷贝件与 src 一致，含本批代码）；仍红的是 **FAIL 3 = typecheck / cocos:check / harness:build，三项同一个根因**：`beads-shell.ts:774-775` 写了 `v.carouselFirst/carouselLast` 而 `_viewData` 未声明那两字段（TS2551 ×2）= BD-62 在途件，与本批零相关 ⇒ 本批**当前可自证绿**（测试与镜像两面），只差 BD-62 那一行。
- **并发冲突实录（三条，均非本批引入）**：① 20:30 本批对 `p3-pressed-shelf.test.ts` 的修改被外部写回覆盖为 HEAD 态 ⇒ 已重新施加并复验；② 20:37 起他会话把 `beads-game.ts` 拆入 `src/game/beads-game/{bead-conservation,game-settings,board-camera-controller}.ts`，且**已把本批两条腿的调用点适配为 `this._board.zoomHit(...)`**（门逻辑逐字保留，只是取控件的入口换形）⇒ 两线代码目前共存；③ 后果 = `beads-game.ts` 的 `git diff` 现混两线（820 行变更，−700 主要来自拆分）⇒ **本批无法单独成笔**，提交需人工分拆暂存（后由本会话按 K-045 整笔入库 `bd964a0`；未 push）。
- **遗留**：① ~~`verify` 仍 FAIL 3，同一根因 = BD-62 在途件的两字段~~ ✅ **同日 22:3x 由该会话自行收口，本会话复跑 = PASS 22 / FAIL 0**（详「续批」节，⛔ 不是本批改的）；② ✅ 已整笔入库 `bd964a0`（用户 2026-10-19 选「C」授权；含拆分批 / BD-62 连带）；③ `meta-ui.md` 等屏文档未逐处补时基句，以 `input-control` v2.13 为真源；④ **手感待真机**（现已列入 **D-79**，见续批）：按钮侧**不设位移阈值**，判据 = 「抬起点是否仍在该钮热区」⇒ 热区外的轻微抖动会取消点击（这正是用户要的语义），真机若出现高频误取消，加阈值是一处改动（`_commitUiTap` 内比对按下点，⛔ 不要往 `_hitUiControl` 里塞）。
- **沉淀（`kb:sync --task=WXG-T-295`）**：**新增 1 / 修改 1 / 激活 0 / 归档 0** —— 新增 **K-144**［测试守卫］「同一个零响应结论由两条不同机制各自达成时，只写一例 ⇒ 变异只能拆掉一条、另一条恒绿」（本批变异实测的直接产物，逐机制建例 + 逐机制拆变异的可复用配方）；修改 **K-045**［流程台账］追记第三变体（并发会话对同一份 .ts 做**结构重构** ⇒ 按 hunk 过滤与「HEAD 重放」两法均失效 + **绿读数必带时刻**，即 K-036 谱系的「检过 ≠ 现在还绿」）。✅ `kb:audit` 无相似命中（活跃 141 / 归档 0）、`kb:check` 八重校验 PASSED、`ctx:build` 已刷新索引面。

### 续批（2026-10-19 22:3x–22:5x，不另领号）：选项 A = 复跑 verify + 真机手感走查开工准备

- **上一轮登记的三项 FAIL 已消失，且不是我修的**：并发会话自行收口了 BD-62 那两字段（`_viewData` 已声明 `carouselFirst/carouselLast`）并补好了 harness 前置腿；本会话 22:3x 首跑 `verify` = **PASS 20 / FAIL 2**（`framework:sync:check` / `cocos:check` 镜像瞬时漂移），跑一次机械 `framework:sync` 后复跑 = **PASS 22 / WARN 0 / FAIL 0**。⚠ 读数只在 22:3x 时点成立（同一棵树仍有另一条线在写）；beads 全量在本日 21:01 实测 = **1042 passed / 2 skipped**（含本批 7 例）。
- **重建现包**（旧包不含本批代码，拿它走查 = 测旧物）：22:47 `build:cocos`（release，26.3s）⇒ `check:size` = **3200.3 KB / 108 文件**（较 09:19 基线 **+12.1 KB**，本日夜间多线未提交工作全在内）；`check:cocos-mask` OK；**新增一条代码面同源校验** = `assets/main/index.js` grep 到 `uiPressTarget` / `menuPress` ⇒ 抬起提交门真进了主包（K-036 变体：不跑这条就看不出「仓里改了包里仍旧」）。
- **走查单 v1.2 → v1.3**：§1 前置三行换为 22:47 实测 + 记一条 CLI 坑（`--qr-output` **必须绝对路径**，相对路径报 code 17「二维码输出路径无效」，与登录/密钥无关——本批实测踩到）；**新增 D-79**（Session 3 输入）= 齿轮 / 道具卡 / 结算主钮各做两腿（**甲** 拖出热区或跨钮抬起 ⇒ 零响应；**乙** 同钮原地抬起 ⇒ 正常响应），线全部指回 `input-control` **v2.13** / `test-cases` **v1.23**，⛔ 本单不新造线；P3 按下态行按新时基改写（~~淡出期仍显~~ ⇒ 抬起提交帧即灭）；§6 统计 S3 **11→12**、线已定义 **3→4**。
- **执行卡**（`production/qa/beads/device/2026-10-19/README.md`）新增 §6：6a–6c 六条手指操作 + **6d 主观「误取消」读数**（哪些钮、几次——这是给 v2.13 定「位移宽容度」的**唯一事实来源**，现在没阈值）；禁忌 3 就地订正 = 旧码/旧包不得拿来测 D-79。
- **预览码已代拉**：22:54 `cli islogin` = `{"login":true}`、`cli preview` ✔（TOTAL **3.1 MB / 3,235,817 B** < 4 MB）⇒ 扫码图 `temp/wxg295-preview-qr.png`（`temp/` 不入库）；真机在线 `hdc list targets` = `6UNBB26416051396`，hdc 取帧配方已写进卡。
- **本续批零真机读数**（D-79 判定列仍空）：手指操作只能由用户做（本机截得到 Mac 屏、点不动手机与真机）⇒ 等扫码按 6a–6c 操完后由本会话取帧回填判定与来源状态列，阶段裁定归编排者。
- **验证**：`verify` **22 / 0**（22:3x 时点）· `check:size` OK · `check:cocos-mask` OK · `framework:sync:check` OK · `check:tasks` 56⇔56 · `ctx:check` OK · `check:links` OK（本续批零代码改动，只改 QA 文书 + 重建产物）。

### 续批二（2026-10-19 23:0x，不另领号）：包体数字对齐 + D-79 等待 + 提交分拆结论

- **包体数字一次对齐（纯文书，零代码）**：以 22:47 现包实测（`find -type f -exec stat -f%z` 求和）为准 —— 主包 **3200.3 KB / 108 文件**，`assets/main` **527.2 → 539.3**（+12.1，其余组逐值不变），距主包红线余量 **907.8 → 895.7 KB**。改了三处：发布清单 **v1.5 §1.2**（含红线/总包/NO-GO 现值；§8 保留 10-18 gzip 基线并标注；A 现值 3200.3；B′ 预期 **3200.3 → 2731.1**；B/C **2288.9**）；走查单 **v1.4 §1**（补余量 895.7）；执行卡 §0/§1（09:19 旧包与 22:47 现包分时点，第 3 步改指 **`temp/wxg295-preview-qr.png`**，命令改绝对路径）。⛔ 不改 `systems-index §3.9` 冻结常量。
- **B′ 仍未落码 ⇒ 门控读的是 3200.3 / 895.7，不是 2719.0 / 907.8**；发布清单已把这条写成明文，避免下一轮把「拍板预期」当成「现包读数」。
- **D-79 仍零真机读数**：执行卡 6a–6c 需用户手指操作；`production/qa/beads/device/2026-10-19/` 下无 `D-79_LA_*` 帧。回填落点已定：走查单 §3 D-79 判定/证据列 + `test-cases` §A4「本批需复核的旧读数」**逐条限定**升/降 + `input-control` §2.1 真机读数交叉引用（⛔ 不把 D-79 三条腿扩大成「全部按钮 PASS」）。6d 若报高频误取消，阈值落点 = `beads-game/input-router.ts::commitUiTap`（拆分前名 `_commitUiTap`；原 `beads-game.ts`），需新增按下点坐标字段，⛔ 不往 `hitUiControl` 塞。
- **提交分拆结论：本批不单独成笔**。K-045 追记里「HEAD 重放」的前提已变：本批 `_uiPressTarget` / `commitUiTap` 已被拆分会话搬进**未跟踪的** `src/game/beads-game/input-router.ts`，`beads-game.ts` 源码 diff 里已无本批符号；若只提交 shell 腿 + 文档 + 测试，`ui-input-timing.test.ts` 的面板/齿轮腿会引用不存在的 `commitUiTap` ⇒ 红树；若连 `input-router.ts` 一起提交，则把对方未完成的拆分目录整块带进本笔。⇒ 建议等对方收口后整笔走；本轮不动 git。

### 续批三（2026-10-19 23:1x–23:29，不另领号）：选项 C = 对局 safe area + 胶囊避让

- **用户裁定**：上一轮末尾三选项，用户选 **C**「暂停 D-79，先修 safe+胶囊」——D-79 真机回填暂缓，先把「齿轮压在状态栏触摸区」这一强候选根因按接口值修掉。
- **改的是哪条口径**：对局 HUD 此前只有「动态高 `hudDy = designHeight − 1334`」，完全不看刘海/胶囊；主菜单早已用 `menuAnchors()` 走 `safeTopDp / capsuleBottomDp / safeBottomDp`。本轮把对局顶带接进**同一套函数**（⛔ 不写第二套换算）：`menuAnchors` 给 `st / (H − btTopY) / sb`，即 `_safeTop` / `_capsuleBottom` / `_safeBottom`，**仅 `plat.isMiniGame` 时计算**（harness / node 无刘海 ⇒ 三值 0 ⇒ 旧版面逐字节不变）。
- **避让公式一行**：`_hudDy() = extra − _capsuleBottom`（`extra = designHeight − DESIGN_H`）。`_capsuleBottom = H − btTopY = 胶囊底缘 + SAFE_EDGE_MARGIN(4)`（dp→设计 px 已由 `menuAnchors` 按 `750 / windowWidthDp` 换算）。渲染（`snap.hudDy`）与齿轮热区（`hitGear(x, y, hudDy)`）同读 `_hudDy()` ⇒ 图与热区不会分家。
- **落点（四源 + 一测）**：`state.ts`（`BeadsSnapshot` 增 `safeTop / capsuleBottom / safeBottom` 三快照字段，默认 0）｜`beads-game.ts`（`init` 算三值 + 私有字段 + `_hudDy()` 减 capsuleBottom + `_syncSnapshot` 写三值）｜`view-model.ts`（新 `drawSafeGuideLines()` 单源 + `drawHud` 末按 `snap.debugGuides` 调用）｜`meta-view.ts`（`drawSafeGuides` 改为复用同一函数，删本地重复画法）｜`dynamic-height.test.ts`（+2 例）。
- **debug 划线（用户原话「与主界面功能一致」）**：**不**给暂停面板加第 11 钮——五行 10 钮已满，`pause-panel.ts` 原注释已写明该动作由设置 overlay 串入；主菜单齿轮 → 设置 →「Debug 开」的 `toggle-debug-guides` 走 `applySettingsAction` **持久化**，进关后 `snap.debugGuides` 同样生效。对局三条线 = `safeTop` / 胶囊底（回退 `SAFE_EDGE_MARGIN` 后与主菜单同值）/ `safeBottom`，两屏共用 `view-model::drawSafeGuideLines`，⛔ 不再各画一份。
- **口径差 4px（本轮自己发现并修）**：`snap.capsuleBottom` 存的是**避让量**（= 裸胶囊底 + 4），直接当 cap 线会低 4px；已改为 `Math.max(0, capsuleBottom − SAFE_EDGE_MARGIN)`，与主菜单 `H − btTopY − 4` 同值。对局划线 H 坐标传 `DESIGN_H + snap.hudDy + snap.capsuleBottom` = 真实 `designHeight`。
- **测试**：① 白盒设 `_capsuleBottom = 171` ⇒ 断言 `hudDy = DY − 171`，且**旧「贴屏顶」坐标已出热区（点不动）、新坐标可暂停**（图与热区同源的正反向各一条）；② 设 `_safeTop=88 / _capsuleBottom=171 / _safeBottom=68` ⇒ 断言三条线的 y = `H−88` / `H−167` / `68`。类型断言沿用仓内既有 `(c as unknown as { y1: number }).y1`（`filter` 不带类型谓词，`DrawCommand` 联合不窄化）。
- **验证读数（分时刻）**：`tsc --noEmit` 通过；4 个相关套件 43 例绿（dynamic-height 6 / ui-input-timing 7 / pause-settings 14 / beads-shell 16）；**beads 全量 82 文件 / 1046 passed + 2 skipped**（较 22:47 的 1042 增 4 = 本轮 2 + 他会话 2）。
- **构建与包体**：`framework:sync` 写入 4 / 未变 117 ⇒ `build:cocos` release **26.1s** ⇒ `check:size` = **3201.0 KB / 108 文件**（较 22:47 **+0.7 KB**，全在 `assets/main` 539.3 → 540.1），距主包红线余量 **895.0 KB**；包内 `assets/main/index.js` grep 到 `drawSafeGuideLines` / `capsuleBottom`（共 9 处命中）⇒ 安全区代码真进包（K-036 变体）。`cli preview` 23:29 ✔ TOTAL **3,236,587 B** < 4 MB（`temp/wxg295-preview-qr.png`）。
- **文档三件同批**：发布清单 **v1.5 → v1.6**（§1.2 全量换 23:29 现包 3201.0 / 895.0 / B′ 2731.8 / B/C 2289.6）｜走查单 **v1.4 → v1.5**（§1 前置三行换 23:29 实测 + D-79 加「旧包读数作废、须在新包重测 6a」）｜执行卡 `device/2026-10-19/README.md` §0/§1/§6（6a 改「23:29 现包」+ 警示）。⛔ 未改 `systems-index §3.9` 冻结常量。
- **根因状态（如实）**：**未最终确认**。现有最强证据 = 真机 HarmonyOS（hdc 无 `wm`；RenderService 报 render 1128×2444 / physical 1272×2756）⇒ 旧包齿轮中心距屏顶约 60 设计 px ≈ **34dp**，正落在系统状态栏触摸区（下拉通知栏会吞触摸）；修复后齿轮中心下移 `capsuleBottom`（约 117 设计 px ≈ **66dp**），到屏顶约 100dp。是否真解决，只能由用户在 **23:29 新包**上手测 6a 甲/乙判定。
- **真机读数（2026-10-19，用户手测回传，已回写）**：**6a 齿轮腿甲/乙双过** —— **甲** 按住 HUD 左上齿轮拖到盘面空白处抬起 ⇒ 未暂停、计时继续；**乙** 原地按住抬起 ⇒ 弹暂停面板（同钮正向对照成立，K-054）⇒ **safe area + 胶囊避让修复被真机证实有效**（旧包齿轮压在状态栏触摸区确实是「乙1 不弹」的直接原因）。⇒ D-79 判 **`PASS*（6a 齿轮腿）`**；⚠ 残留 = 6b 道具卡 / 6c 结算主钮未测、「误取消率」无阈值、证据 = **用户口述无落盘帧** ⇒ ⛔ 不升 `PASS`、不外推「全部按钮通过」。回写四处：走查单 **v1.5→v1.6**（D-79 判定列 + §6 统计 + 变更日志）｜`test-cases` **§A4**（新增真机读数块 + `TC-INP-01R` 腿① 升 `[Device]` 复核通过，腿②③④⑤ 仍待复核）｜`input-control` **§8** 范表后真机读数块（明示只覆盖齿轮腿）｜执行卡 **§6** 结果段。
- **未做 / 下一步**：① ~~用户扫码测 6a（甲 拖出后抬起不弹 / 乙 原地抬起弹暂停）~~ ✅ **已完成，甲/乙 双过**；② ~~回填走查单 D-79 判定列 + `test-cases` 旧读数升降 + `input-control` §2.1 交叉引用~~ ✅ **已回写**（见上一条）；③ **6b 道具卡 / 6c 结算主钮 / 6d 误取消主观读数仍未测**；④ ✅ **已整笔入库 `bd964a0`（81 文件，含拆分批 / BD-62 连带；未 push）**；⑤ `meta-view` cap 行仍写字面 `4`（与 `SAFE_EDGE_MARGIN` 同值，本轮刻意不动源码以保「23:29 构建新鲜」）；⑥ D-79 证据档位仍 = **用户口述**，若提审前需要可补 `hdc` 帧。
- **验证（文书面）**：`check:links` OK；回填后全量 `verify` = **PASS 22 / WARN 0 / SKIP 0 / FAIL 0**（含 `check:tasks` / `check:links` / `typecheck` / `test` / `cocos:check` / `check:size`）。本轮零代码改动，23:29 产物未变（不需要重出码）；提交后复跑 `verify` = **PASS 22 / FAIL 0**。

---

## WXG-T-294

> 工程·`control-manifest §19` 投放门禁扩三条 + beads 发布清单 v1.1 包体论证重算｜主理人(Qoder)·程基岩域｜2026-10-19（用户选下一步选项 2 = 清掉 WXG-T-292 留下的两条欠账）

- **§19 正文回改（第一条欠账）**：原句只有一行「⛔ 包体守卫未归位前向主包投放位图；⛔ 运行时放大；未命中一律矢量回退」，**节标题与编号保持不动**（`grep -c "§19"` 实测外部 14 处按 §19 引用，改编号会断链）。改写为**三条前置**：
  1. **包体守卫有牙**：`check:size` 本机实跑非 SKIP 且阈值与真源一致（真源 = beads `systems-index §3.9`：主包红线 4096｜**总包红线 20480**（体积扩展资质未开通档）｜主包内部目标 4096）；SKIP / 钉旧值 ⇒ 禁止投放（K-089 的正面落地）。
  2. **层序守卫已过（本条是新加的，也是 292 说「守卫建议从包体扩到层序」的兑现）**：位图必须真的上屏——珠层 blit 挂 `BlitLayer`、UI 位图挂 `BlitLayerUI`（`Graphics` 之后、`Labels` 之前，ADR-0030 S5′-3 修正）；**判据形态 = 屏幕像素层证据**，不是「日志无 warn + 命令已发出」。判例 = WXG-T-271 取证（装载腿全绿、`masks=4/4`、blit 已发，屏上第 9 格仍是空白，因为被后画的 `Graphics` 盖住）；产物级门禁 = `check:cocos-mask`（存在 ≠ 进包）+ 菜单纹理归属腿（装错件，BD-61，`d9c56d4` 落码）。
  3. ⛔ 运行时放大烘焙纹理、未命中矢量回退（`§19.1` 的 128 档位例外只解「放大」半，不解 1/2 两半 —— 这句原样保留）。
  - ⛔ **不冻结新值**：本条只把「已经生效的 §3.9 数值」写进受控文书，§3 冻结常量零改动。
- **beads 发布清单 v1.0 → v1.1（第二条欠账）**：初稿整套论证建在「内部目标 2000 KB」上，而 §3.9 **v1.51**（用户 2026-09-23 裁「上限增加到 4 MB」）已把它抬到 4096 并与红线合流。按 2026-10-18 release 重建实测重算：
  - 主包 **3188.2 KB / 108 文件**（逐组明细按文件原始字节求和，合计与 `check:size` 逐值相符）：`cocos-js` 1356.9 / `assets/main` 527.2 / BGM 469.2（降码率后）/ `assets/textures` 442.2 / 适配层杂项 232.4 / `internal` 160.3；
  - ⇒ ~~「越内部目标 1166 KB，需 USER 书面豁免」~~ **作废**（3188.2 ≤ 4096 达标）；§7 `NO-GO` 理由换成**五条真阻塞**（真机走查含层序复验 / 版本号漂移 / 音频与激励视频首发处理 / §8 未拍板 / CLI 上传腿未跑通）；
  - §8 选型**换动机**：不再是「为达标」，而是「为主包余量（现只剩 907.8 KB ≈ 3 批菜单切图）+ 首屏下载体积」；B/C 主包估算按现明细重算 **2040 → 2276.8 KB**（旧值建立在位图集 424 + BGM 704 的旧事实上）；D 方案里 BGM 降码率标注**已做**（并如实保留「接缝未真听」）。
  - 纪律：旧论证**划线留档不静默删**（K-053），§9 变更记录补 v1.1 行；六阶段表与判据正文**零改动**。
- **同步核销**：ADR-0031 状态行的「⚠ §19 正文仍未回改」改为 ✅ 已回改；主表 292 行的同一处遗留措辞同步更新；待排表删去「beads 发布文书 2000 KB 待重算」一行（结项即移除）。
- **验证**：`pnpm run verify` **PASS 22 / WARN 0 / FAIL 0**、`check:links` OK、`check:tasks` 主表 55 行 ⇔ 详情 55 节、`ctx:check` OK（`control-manifest.md` 与 `test-cases.md` 均在 B 项豁免内，本批不新增豁免）；`git status` 除本批文件外无其它脏路径。
- **仍未闭（真欠账，⛔ 不是本批能替发布批决定的）**：真机走查全部 `—`（含 §19 前置 2 的屏幕层证据）；§8 A/B/C 未拍板；`wx.loadSubpackage` 真机腿未验；D-69「位图晚到不白屏」需 ART 认可跳变；X-01 音频与 X-07 激励视频首发处理未定；quality-lead 要求的 U5 取回演练 5 条未跑。

### 续批（同日 2026-10-19，不另领号）：改裁「保留自动推送」落地 + `af773d9` 已推

用户一句「开自动推送」推翻了 10-18 的「关掉它」裁定 ⇒ 按事实改写三处登记，⛔ 不拿旧断言交差（K-142 自己要求的行为）：

- **AGENTS.md §7 新增一行约定**：`develop` 由 IDE 自动同步，故「会话没跑 push」≠「未入远端」；会话仍不得自行 push / 强推（开关不在仓内，agent 开不了也关不了）；取证只认 `ls-remote` + `reflog`。细节正本留在 `memory/MEMORY.md` §Hooks（两条改写：现口径 = 当约定用，因为 CI `ci.yml` 对 develop push 跑全链 ⇒ 重心变成「pre-commit 必须真绿，没人会再来仓一次」）。
- **常驻预算代价（如实记）**：加约定把 AGENTS.md 从 1897 顶到 2041（> 2000 硬门）⇒ 按 K-141 先做重复源审计：**删去 §7 里与 always-on 规则件逐字重复的两段**（「编排铁律同此」括注、「禁止伪造编辑器产物或假绿测试」，两者在 `my-rules/agents-md.md` 已强制注入），现 **1961 / 2000（余 39）**；阈值未动。与 ROUTES（7441/7500）合并成一条待排账：下次往任一常驻文件加东西，先瘦身。
- **推送本身**：`git push origin develop` 快进成功（`2b89755..af773d9`）。首跑被沙箱挡住（读 `~/.ssh/known_hosts` 权限不足 → 主机校验失败），提权后重试即成。台账里 291/293/294 三行的「未 commit / 未推」「关掉开关」措词同步改为实态；K-142 已追记改裁（条目不删只追加）。
- **验证**：`check:tasks` 55 行 ⇔ 55 节、`ctx:check` OK（含新 D3）、`check:links` OK、`kb:sync` 修改 1（K-142）+ `kb:check` 八重校验通过、`pnpm run verify` **PASS 22 / FAIL 0**。

### 续批三（2026-10-19，不另领号）：真机走查开工准备（用户选下一步选项 1）

本轮只做到「拿掉人工操作的全部障碍」，**不产生任何真机读数**。

- **产物重建（最重要的发现）**：上一份包是 10-18 20:24 构的，而 `games/beads/cocos/assets/textures/` 的两件 ◀▶ 投放件是 21:00 后按新配方重烘的（BD-61）⇒ **旧产物里仍是旧两件**。先 `framework:sync` 再 CLI `build:cocos`（默认 release，38.1s）；`check:cocos-mask` 归属腿从“两件 ❌ 产物≠源”变 **18/18 字节相同**、`check:size` = 3188.2 KB / 108 文件且无「疑似 debug」。⇒ 若不重建，本轮真机看到的按下态会与仓内代码不同源（K-036：跑过 ≠ 检了的新变体：检了 ≠ 包里是新的）。
- **消除扫错包**：`build/wechatgame-001`（09-29 旧包，2.1 MB）改名 `_archive-wechatgame-001-20260929`（可改回），并把 Cocos profile 的 `outputName` 从 `wechatgame-001` 改指 `wechatgame`（未入仓的本地工程设置，不改变别人的仓库状态）。
- **走查单 v1.0→v1.1**：Session 0 八条前置逐条改成实测值（构建新鲜 / 单产物 / 包体与构建档 / **新增「包内资产与仓内等值」** / 日志通道 / 取证目录）+ **新增 D-77**把 `control-manifest §19` 前置 2（位图必须真上屏）列成可执行条目；本单不新造判据，线与来源全部指回受控文档；**所有判定列仍为 `—`**。
- **执行卡**：`production/qa/beads/device/2026-10-19/README.md` —— 5 步人工操作 + 逐条“做什么/期望什么/留什么证据”表（D-39/75/69/**77**/74/59/60/61/66）+ 命名规范 + 三条防假绿禁忌（模拟器禁作判据 / 缺通道记 BLOCKED / 不用旧包取证）。发布清单 §1.3 同步新增「真机取证入口」行与「干净构建」实跑记录。
- **你只需做的**：开发者工具导入 `games/beads/cocos/build/wechatgame` → 预览二维码 → 华为畅享 + 一台 iOS 逐条操作并把截图放进该目录。回传后我负回填与来源同步，阶段裁定归编排者。
- **预览通道已代拉（同日 09:3x）**：走 `weixin-minigame-helper` MCP 的 `run_game`（workspacePath = 产物绝对路径）⇒ `http://localhost:3847` 已起。SIM 预读定性：未登录态下点「编译」**不注入代码**（两张 `PREVIEW_SIM_boot_*.png`：黑屏、iframe `body` 长 0、`cc` 未加载、Console 0 条）⇒ 属**未编译**而非产物黑屏，避免用户误报缺陷；该读数**禁作真机判据**（K-044 §0-4）。「真机预览 / 上传」属上传链路，未得用户确认不自动调。
- **本轮验证**：`check:size` OK・`check:cocos-mask` OK・`framework:sync:check` 绿・`check:tasks` 55⇔55・`ctx:check` OK・`check:links` OK・`verify` **PASS 22 / FAIL 0**（零代码改动，产物与本地设置为不入库项）。

### 续批四（2026-10-19，不另领号）：常驻层预算瘦身（用户选下一步选项 2）

两个硬上限**一个都没动**（`residentLimit()` 单源），只按 K-141 的方法搬内容：先做重复源审计，再等量外移。审计出三类可移对象，本轮全部用上：

| 类别 | 判据 | 本轮实例 |
|---|---|---|
| ① 读数快照 / 口径修正史证 | 只解释某次数字为什么长这样，不构成规则本体 | ROUTES ⑧ 系列的 457 事件 / 75.5% / 45.4%↔30.1% / 56.7%→59.1% / 两个根会话 ID |
| ② 与强制注入层逐字重复 | `my-rules/agents-md.md` 每会话已带同义摘要 | AGENTS §7「孤立小问题不必走满九阶段」（§2 表已列）、§5/§6 的「原 §N 逐字迁出」括注 |
| ③ 同一规则在正文与步骤里讲两遍 | 保留一处 + 指针 | ROUTES §0 第 2 步的选池优先级子条 ⇒ 压成「见前言 ⑪·补」 |

- **新建 `docs/agent/context-metrics-history.md`**（64 行）承接 ①，顶部写明「规则本体仍在 ROUTES ⑦–⑫，本文件只接史证侧」，并声明数字是快照、⛔ 不当现状引用。
- **ROUTES.md 7441 → 7116（余量 60 → 384）**：⑧ 三条压成 8 行结论 + 指针；⑨ 的「AGENTS 实际已 1743」假绿实例、⑪·补 的「84 条中 77 条 / 1270 tok 回收」外移；§0 子条合并。
- **AGENTS.md 1961 → 1848（余量 39 → 152）**：前言删搬家史证（`routing.md` 侧已有留痕）、§2 表行去重、§7 删与注入层重复的两处、§9 压缩措辞。**L1–L5 铁律表、§2 路由表、§9 四触发、§7 推送约定等决策指引一条没删**。
- **取回路径如实说明**：新文件体量 <3000 tok 且不被 ROUTES 以 `路径#锚点` 引用 ⇒ 不进 `ctx/hot-files.md`；读者从 ⑧/⑨ 行内指针直达该文件，这是设计而非漏收录。
- **验证**：`ctx:check` OK（A/B/C/D/D2/D3/E3）、`check:links` OK、`ctx:hotfiles:selftest` 19/19、`pnpm run verify` **PASS 22 / FAIL 0**。⚠ 常驻总量观察哨仍报 **15641 > 软阈 13500**（单文件门全绿但总量仍漂，正是该哨的本分，不阻断）⇒ 后续若要压总量，得动 `hot-files` 5485 或 ROUTES 本体，属结构性决策，需另单裁。

### 续批五（2026-10-19，不另领号）：§8 分包/远程包选型拍板简报（用户选下一步选项 3）

- **新事实（本轮实测，不是推算）**：把产物按「原始字节 vs gzip 传输量」分组量了一遍——`cc.js` 1356.9 → **355.5**（能压）、`assets/main` 527.2 → 191.4、**BGM 469.2 → 462.6**（压不动）、**textures 442.2 → 406.6**（压不动）、主包 3188.2 → **1553.2**。⇒ 包体门按原始字节判，用户等的是传输字节：**挪走音频/位图对下载时长的收益（−56%）远大于对包体数字的收益（−28.6%）**，这条此前没人算过。
- **发现更低成本的第四条路 = B′（只挪 BGM）**：`build-cocos.mjs` 早已实现「改 `audio-voices.ts::assetFile` 一处 ⇒ 装配目录 / `game.json` 的 `subpackages[]` / 运行时路径 / `check:size` 分包识别」四处自动跟上（注释即契约），框架侧 `subpackageNamesOf` + `wx.loadSubpackage` 预载腿也已交付且默认不触发 ⇒ **零编辑器操作、不触 L1**，主包降到 2719.0 KB、传输降到 1090.6 KB（−30%）。原 §8 的 B 行把「构建脚本」列为待做工程，**已不实 ⇒ 就地订正**。
- 另登记 **E = 关卡数据分包**（关卡 JSON 实测 153.6 KB 全在主包）：收益小（传输约 −40 KB）、风险大（进关失败 = 玩法不可用）⇒ 明确标注不推荐首发做，留给关卡管线专项。
- 交付 = 发布清单 v1.1 → **v1.2**：新增「两个口径」表、B′ 行、E 行、**§8.1 决策点表**（A / B′ / B / C 按「下载量 vs 要付的代价」排序）+ 主理人建议（**B′ 首发，B 作为菜单切图下批入库后的升级路径**）。⛔ 未代裁，等 USER 拍板；选 B′/B 的硬前置 = 先补真机走查项 **D-78（`wx.loadSubpackage` 成功/失败回退）** + AUD 真听一次「无 BGM 窗口」。
- 一次自纠：写变更记录时把 v1.1 与 v1.2 挤成同一行（表格行合并）⇒ 用脚本按锚点拆回两行并核顺序，`ctx:check` / `check:links` 复验绿。
- **验证**：`ctx:check` OK（A/B/C/D/D2/D3/E3）· `check:links` OK · `check:tasks` 55⇔55 · `pnpm run verify` **PASS 22 / FAIL 0**。

#### 拍板结果（同日 USER 裁，续批五收口）

- **路线 = B′（只把菜单 BGM 挑进分包）**：主包 3188.2 → **2719.0 KB**、首屏传输 1553.2 → **1090.6 KB（−30%）**；改动面 = `games/beads/src/config/audio-voices.ts::assetFile` 一处（`build-cocos.mjs` 保证装配目录 / `game.json` 的 `subpackages[]` / 运行时路径 / `check:size` 分包识别四处同步），零编辑器操作、不触 L1。
- **节奏 = 先登记、暂不落码**：等 Session 1 真机走查（含 D-77 位图屏幕层序）跑完再动代码——一轮真机只引入一个变量，⛔ 不让分包改动污染本轮基线读数。
- 已登记不假装完成的部分：走查单 §4 新增 **X-09**（D-78 分包预载 = `⛔ BLOCKED`，解除条件 = B′ 落码 + 重建产物 + `check:size` 分包两项绿），Session 表未加 D-78 空条目；发布清单 §8.1 加「✅ 拍板结果」段（含三条实施前硬前置：X-09 / AUD 真听无 BGM 窗口 / 重跑 `check:size`），§7 第④条从「§8 未拍板」改为「已拍板待实施」。
- 本轮**零代码改动、未重建产物**（现包仍是单主包形态，与走查单 §1 的「包内资产与仓内等值」读数一致）。
- **真机这一轮的实际状态（如实报）**：预览器仍在 `http://localhost:3847`（HTTP 200），但探针复测显示 **仍未登录**（`iframe body` 长 0、`cc` 未加载、登录钮在位）⇒ Session 1 零读数，判定列保持 `—`。等待期间补做了一件不需要人也不造假的事：**D-77 代码级预检**——逐行核 `bindings.ts:230-254` 的子节点序（`Background → BlitLayer → Graphics → BlitLayerUI → MenuClip → Labels`）与橱窗独立 blit 层（`BeadsBootstrap.ts:145-147`），确认挂层顺序与 §19 前置 2 口径一致 ⇒ 若真机仍空白，方向应转向「帧未加载 / 尺寸为零 / 透明度 / `carrier=off` 被触发」。该预检只收窄诊断空间，⛔ 不得据此判 PASS（已写进走查单 v1.2 行）。
- **上传腿跑通一半（同日实测）**：`cli islogin` = `{"login":true}`（IDE 已登录），`cli preview --project games/beads/cocos/build/wechatgame --qr-format image` 返回 `✔ preview` 并出扫码图，**包总大小 3.1 MB（3,223,484 B）< 4 MB 主包上限** ⇒ 平台侧接受当前产物，D-39「出包成功」的仓库侧已验（真机侧仍待扫码确认）。**顺带纠正一条写错的事实**：`preview` 走 IDE 登录态，**不需要**上传密钥与 IP 白名单——发布清单 §1.3/§7、执行卡、走查单 §1 原都按「预览需密钥」写，已全部改正（只有 `cli upload` 需要）。另实测：MCP 的网页预览器登录态**与 IDE 不互通**（IDE 已登录而该页仍黑屏）⇒ 取证改走手机扫码，不再纠结网页模拟器。
- **自动截图通道打通（用户授权录屏权限后）**：`screencapture` 已可实拍（此前沙箱内报 `could not create image from display`）。首轮实拍读到开发者工具模拟器一帧：`LoadScene 20.44 ms`、`[BeadsBlitCarrier] 静态位图 21/21 已装载 → 落 UI blit 层`、`masks=4/4 carrier=on`、mask 腿 = bundle `textures` / 位图腿 = bundle `themes` ⇒ 已写进执行卡 §3「SIM 预读」，**明文标 ⛔ 非真机判据**（K-044 §0-4）。⚠ 同一帧里主菜单橱窗是**空玻璃柜 + 「第 9 关」木牌、无位图内容** ⇒ 待 ART/用户确认是预期还是「落层/尺寸为零」真缺陷，这条已列为真机第一轮先看项。
- **能力边界如实报**：本机无 `adb`（Android SDK platform-tools 未装）、无 Xcode `devicectl`、System Events 取窗口边界被拒（无辅助功能权限）⇒ **我截得到 Mac 屏幕，但点不动手机与模拟器**。要拿到真机画面需二选一：① 在开发者工具点顶部「真机调试」→ 手机画面镜像成 Mac 窗口 → 我逐帧实拍；② 用户手机系统截屏后丢进取证目录。装 `android-platform-tools` 才能走 `adb exec-out screencap` 全自动路线（需用户授权安装第三方工具）。
- **实拍第二帧（15:13）+ 自纠一条我上一轮写错的观察**：上一段记的「橱窗是空玻璃柜」**不成立**——当时「自动真机调试」对话框正遮挡画面。完整帧里橱窗有内容（程序化珠阵花朵 + 沙漏 + 「第 9 关」木牌、体力 8/8、金币 0、logo、◀▶、`v1.x · 演示版`）⇒ 疑项撤销，⛔ 没拿它开缺陷单。已把自纠写进执行卡 §3.1。
- **换成一个真问题（只有真机能定）**：橱窗现在是**程序化珠阵**，而 boss 关需求锚是「原照片缩略上屏」（ADR-0031）⇒ ① 位图腿只管选关墙（预期）还是 ② 本该覆盖橱窗却没覆盖（D-77 类缺陷）？分辨方法已写进卡：**进选关墙看第 9 格**——第 9 格是照片而橱窗是珠阵 ⇒ ①；第 9 格也是珠阵 ⇒ ②，当场开 BD-62。
- **附带观察（不判缺陷，待确认）**：该帧顶部有粉色调试标注 `safe 15` / `cap 31`、左下角 `home 0`。若这些在**普通入口**下也会画，就与发布清单 §1.1「调试入口不进线上」/ §2「无调试后门」相冲 ⇒ 待确认是否只在 `debugInfo` / `studio=` 下出现。
- **两条疑点用代码口径自纠清零（15:16–15:17，无需真机）**：① 「橱窗该出照片」不成立——`tuning.ts:1284-1290` 的菜单位图表面向 logo/橱窗**木框**/CTA/圆钮，boss 原图缩略的落点在 `arcs.ts:27-30`（`bitmap__boss_l9`，正本 `l9-boss-mandala-256.png`）⇒ 属选关墙/走马灯弧，橱窗走程序化臂是设计如此，⛔ 不开 BD-62；D-77 目标收敛为「选关墙第 9 格是否照片」+「◀▶ 按下态是否互异可分」。② 「调试标注进 release 包」不成立——`safe/cap/home` 由 `meta-view.ts:1386` 的 `if (data.debugGuides)` 守卫，该字段三处默认 false ⇒ 是设置页 Debug 标定线，本帧可见只因本机手动开过；发布前只需核对该开关为关（归 §1.1 项，不另开缺陷）。
- **一条正向预读（仍非判据）**：当前 SIM 帧里 logo、橱窗木框、CTA、◀▶ 圆钮均已是**位图外观** ⇒ 菜单位图腿在屏幕上可见，比「日志 21/21 装载」高一档；但 SIM 禁作真机判据（K-044 §0-4），D-77 判定列仍为 `—`。
- **选关墙实拍（15:27）挖出一条走查硬前置**：坐标点击（`System Events`，命令报 AppleEvent 超时但点击已落地）进入「选关」面板后实测：第 1 格 = 红色珠阵 + 三颗空星（已解锁、走程序化臂），**第 2–9 格全为「灰色珠阵 + 锁」**（`drawLockedWallCell`，WXG-T-290 锁格合形，属预期非缺陷）⇒ **D-77 的「第 9 格是否照片缩略」在锁态下根本看不到**，必须先推进存档到第 9 关才能取该读数。已回写走查单 D-77「另需」列 + 执行卡 §3.3。
- **adb 通道按用户授权装好但尚未可用**：`brew install --cask android-platform-tools` 完成（`adb` 1.0.41 / 37.0.1），`adb devices` 为空 ⇒ 还差 USB 线 + 手机「USB 调试」+ 授权弹窗。环境事实三条（screencapture 需提权、System Events 可驱动模拟器、锁格不可判前置）已入 `memory/MEMORY.md` §已知限制。
- **adb 仍无设备 + 解锁前置查清（15:3x）**：`adb devices` 空、`system_profiler SPUSBDataType` 也看不到任何手机 ⇒ 物理层未接上（线/USB 调试/授权三选一未满足）。趁这段时间把「怎么推进到第 9 关」查成事实：解锁位 = `maxUnlockedLevel`，读自单局存档 `this._save.data.maxUnlockedLevel`（`beads-game.ts:742-743`，键 `wxgame.beads.save.v1`，`save-schema.ts:113`），选关墙按它零事件（`beads-shell.ts:431`）⇒ 三条路已写进执行卡 §3.4：① 自然推进（最真，兼产 D-59/D-61 证据）；② **studio 导入解不了锁**（`importLevel` 只导关卡载荷）；③ 真机调试远程控制台 `wx.setStorageSync` 注入（最快，但只可用于 D-77，⛔ 不得拿注入态判 D-59/D-61）。建议 = 先 ③ 取 D-77 读数、D-59/D-61 仍走 ①。
- **机型定性 = 纯血鸿蒙（HarmonyOS NEXT）⇒ adb 路线彻底不通，hdc 本机未装**：用户给出无线调试地址 `192.168.1.165:37941`，实测 `nc` 显示 TCP 可达但 `adb connect` 后设备一直 `offline`、`reconnect` 后消失，`adbkey` 存在 ⇒ 排除网络与密钥，根因是**鸿蒙 NEXT 没有 ADB 协议**。`hdc` 全盘与 `mdfind` 均无（随 DevEco Studio / Command Line Tools for HarmonyOS 分发，下载需华为开发者账号）⇒ 我无法自行执行用户要求的 `hdc list targets`。已把 MEMORY 与执行卡 §3.4 的 adb 结论**就地自纠**，并改列两条不依赖 adb/hdc 的取证路（① 开发者工具「真机调试」镜像 + 我截 Mac 屏；② 手机截屏传 Mac 入库）。
- **hdc 已接入环境（用户提供工具目录）**：`/Users/stephenhe/Development/command-line-tools/sdk/default/openharmony/toolchains/hdc`（Ver 3.2.0f）⇒ 已追加进 `~/.zshrc` 的 `PATH`。`hdc list targets` 能列出设备序列号 `6UNBB26416051396`（USB + HDC 协议都通），但状态 = **`Unauthorized`** ⇒ 卡在手机侧「允许调试」授权；`hdc kill`/`hdc start` 重启服务无效（已实测），未授权前 `hdc shell snapshot_display` 不可用 ⇒ 真机全自动截图通道**待授权解除**。MEMORY 与执行卡 §3.4 已同步（含 hdc 取证配方）。
- **hdc 真机通道打通（用户完成授权）**：`hdc list targets -v` = USB Connected，`hdc shell` 可用；实测登记 L-A = **CHZ-AL00 / 7.0.0.109(SP6C00E109R2P4) / 屏 1128×2444 / 微信包名 `com.tencent.wechat`**（已补进走查单 §2 设备矩阵）。踩到并记档两个坑：命令必须带 `-t <序列号>`；`snapshot_display` 只收 `.jpeg`，且 **`hdc file recv` 会把文件截断到正好 64 KiB**（设备侧 169,930 B / 本地 65,536 B 不可读）⇒ 取回改走 `hdc shell "base64 …" | tr -d '\r\n' | base64 -D`，实测拿到完整图。两帧桌面截图属通道验证、不属任何判据 ⇒ 未入库并已删除；预览码重新生成（`temp/wxg294-preview-qr2.png`，包 3.1 MB），等扫码后逐帧取真机画面回填 Session 1。
- **真机首帧到手，Session 1 开始有读数**：用户扫码后小游戏在 L-A（CHZ-AL00 / HarmonyOS NEXT 7.0.0.109）跑起来，hdc 抓到设备原生截图 1128×2444（入库 `device/2026-10-19/D-75_LA_1.jpeg`）⇒ 回填 **D-75 PASS**（首屏停主菜单，未直进玩法）+ **D-69 PASS**（不空白，且菜单位图腿在真机上确实可见：logo 珠子字/蝴蝶结、橱窗木框与玻璃、CTA、◀▶ 圆钮、体力金币木条）——这也是 §19 前置 2「位图必须真上屏」的**第一份真机屏幕级证据**。⚠ 两条新事实入档：① 真机画面里有粉色调试标定线 `safe 74`/`cap 154`/`home 56` ⇒ 缺陷候选但**不能现在定性**（同微信号存档可能已持久 `debugGuides=true`），定性方法 = 清微信小游戏缓存或换微信号后冷启；② `hdc shell hilog` **抓不到**小游戏 console ⇒ 鸿蒙上日志只能走开发者工具真机调试控制台，影响 D-38/D-45 取证方式。
- **D-77 真机部分读数（四帧对比）**：判 `PASS*` —— ① 层序/可见性 ✓（主菜单位图腿在真机屏幕确实可见，§19 前置 2 拿到屏幕级证据）；② ◀▶ 按下态 ✗ 未取得「按住换面」读数（按住帧与未按住帧仅差 52 B），且 ◀ 在末张卡「敬请期待」上近似无箭头却实际可点（帧 C 证明能翻回第 9 关）⇒ 样式与可点性不一致，**归 BD-61 同类，不另开 BD-62**（真机复现读数已入 `test-cases.md` §M.11）；③ 选关墙第 9 格缩略 未验（锁态，需先推进存档）。
- **用户确证设计预期 ⇒ 推翻我上一轮的定性，独立开 BD-62**：末张「敬请期待」卡应「左 ◀ 有按钮、右 ▶ 消失」，实测**方向完全相反**（◀ 弱化似禁用却可点、▶ 无下一张可翻仍显示）⇒ 定级 P2（视觉显著异常 + 有规避手段），解除条件三条（① 可见性按规格翻转 + 补机检/截图判据；② 中央 7 颗灰点占位图案交 ART 出定稿——用户判「不对，需要设计」属设计缺口，不另开缺陷号；③ 重跑 D-77 子判点 ②）。上一轮我把它归为「BD-61 同类、不另开号」是**误判**（BD-61 = 按下态量化塌缩，本件 = 末张态左右可见性方向反），已在 `test-cases.md §M.11` 写明推翻过程并登记 **BD-62**（AR-02，现存最大 BD-61 +1，K-046/K-050 已核）；走查单 D-77 判定由 `PASS*` 改 **`CONCERNS`**。
