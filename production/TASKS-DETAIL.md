# WXG 任务台账 · 详情（标题制正文侧）

> **为什么拆开**：`production/TASKS.md` 曾**81% 的体积是任务行详情**（16 行 ≈ 5334 tok，中位行 389、最重 613），
> 而 `tasks:archive` 只清**已完成**行 ⇒ 每个新任务仍带入 400–600 tok ⇒ 反复撞 `ctx:check` **B 项单文件 8000**。
> 拆法：主表只留标题，正文落这里**一任务一节**（原文本原样搬，未改写）。
>
> **怎么读（协议，见 `ctx/ROUTES.md` 与主表头注）**：
> 1. 只读主表拿号 / 看状态（体量恒定 ≈ 2k tok）；
> 2. 要某任务详情时，从 `ctx/index.json` 里**本文件该小节**的 `startLine`/`endLine` 取范围，
>    `read_file(path, offset, limit)` **只读那一节**（中位 ≈ 290 tok）——**不要整读本文件**。
>
> **配对纪律（由 `pnpm run check:tasks` 机械强制）**：主表有行 ⇔ 本文件有同名小节；
> 归档时**行与小节成对搬走** —— 由 `pnpm run tasks:archive` 机械执行（WXG-T-065：行进
> `archive/TASKS-archive.md`、节进 `archive/TASKS-DETAIL-archive.md`，节数 == 行数），故本文件只留在办 / 近期任务。

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
- **产出**：games/beads/src/view/symbols.ts（10 符号矢量 path + L5 墨色规则）· games/beads/src/view/bead-render.ts（六层参数卡 L0–L5 + empty/locked 变体）· games/beads/src/view/palette.ts（luminance / contrastRatio / mixWith + 卡面常量）· games/beads/src/view/view-model.ts（接线 + 头注改写）· games/beads/tests/{symbols,bead-render,view-model,tuning,levels,save-schema}.test.ts（**+64 用例，43 → 107**；测试文件 6 → 12，与 breakout 持平）· games/beads/src/config/levels.ts（**修 `validateBeadsLevel` 放行 NaN 时长/供料间隔的缺陷**）· tools/scripts/smoke-harness.mjs 与 lib/harness-runtime.mjs（**参数化 game，`?game=beads` 分支首次进 CI**）· docs/architecture/architecture-beads.md §9 · production/epics/epics-beads.md · games/beads/art/accessibility.md · 本台账

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

## WXG-T-059

- **名称**：beads 局内崩溃快照**落码**（D-03 实现轮；用户裁定「局内崩溃快照（D-03）任务执行」）：T-055 的提案自身写明「本轮禁止落运行时写档」+ §7 标「落码时，非本轮」⇒ 本轮**开新轮次**，不推翻其条款。范围：① 新增 `src/game/crash-snapshot.ts`（**另键** `wxgame.beads.crash.v1`，`save-schema.ts` 一字未改、S8 version 未升；字段级校验/降级、永不抛异常）；② `Spawner` 暴露 `acc` / `fullReported` 存取（原私有；恢复须在热路径外写，且须**先设 interval 再设 acc**，因为 interval setter 会重置累加器）；③ `BeadsGame.onPause` 末尾写快照（含「已 PAUSED 又 onHide」）；结算/过关/失败/finish/重玩/换关 **删**快照；④ BOOT 读快照 → 校验 → 装配 → 进 PAUSED（走 `machine.reset('paused')`，**不动** `PHASE_TRANSITIONS` 冻结表）；⑤ `tests/in-level-snapshot.test.ts`（提案 §6 六条判据，本轮据用户裁定去 `[待冻结]`）。**对提案 §2 的必要增补 2 项**（均有既有冻结依据，非发明）：`reviveCount`（T-057 已冻结 `REVIVE_MAX_PER_LEVEL=1`；不存则恢复后可再续一次、绕过该规则）、`reviveBonusSec`（参与 `computeClearStars`；不存则恢复后过关多给星）
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：games/beads/src/game/crash-snapshot.ts · games/beads/src/systems/spawner.ts · games/beads/src/game/beads-game.ts · games/beads/tests/in-level-snapshot.test.ts · 本台账

---

## WXG-T-060

- **名称**：beads S6 道具系统落码（EP-06，用户裁定「beads 游戏继续规划任务执行」）：① `tuning.ts` 补 §3.6 常量（`POWERUP_TYPES` / `REGION_CLEAR_SLOTS=6` / `RANDOM_CLEAR_COUNT=5` / `POWERUP_FREE_USES=1` / `AD_PLACEMENTS=4`）+ 卡片几何真源 `powerupCardRects()`（视图与 S2 命中测试**共用**，消灭双份常量）；② 新增 `systems/powerups.ts` —— 只读镜像（`tray:spawned`/`bead:placed`/`tray:expanded` + 选中锚点）、三道具效果（region 恒长窗口 + 两端钳制、clearAll 全容量、random 等概率无放回）、三计数独立、**点名归 S6、清槽归 S4**；③ `beads-game` 接线（S2 路由优先级 2 + `usePowerup` + 整关重置 + 崩溃档读写 + 快照字段）；④ 崩溃档 `powerupUses` **上限钳制**关闭（T-059 留的「待 S6 落地补」）；⑤ 视图落 **A4 三图标**（魔法棒/扫帚/磁铁，§1.4 程序化 path）+ 用尽变灰 + `×N` + 占位轻提示。**测试**：新增 `tests/powerups.test.ts` **16 条**（§8 十条判据 1:1 + 常量镜像），beads **129 → 145**。**顺带修两处假绿/失配**：A4 此前标「✅ 落地」而实现是 3 张空白卡（无图标无标签）；A1/A3 符号特征计数被新增图标同原语污染（断言限定进拼图带）。**未闭环**：① §8-4 判据（200 次 ±20%）统计上偏紧（12 槽族极大偏差期望 ≈22%，实测 6 seed 落在 0.104–0.256）⇒ 测试固定 seed 并登记修订建议；② §1.4 卡片几何（176×150 + 卡下方标签）与 §3.1 带高 152 **互相矛盾**，未擅自改尺寸，登记待裁定；③ 图标文字标签未落码
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：games/beads/src/systems/powerups.ts · src/config/tuning.ts · src/game/{beads-game,state,crash-snapshot}.ts · src/view/{view-model,palette}.ts · tests/powerups.test.ts · games/beads/art/accessibility.md（A4 改真）· 本台账

---

## WXG-T-061

- **名称**：**「到达序」判据清理**（用户裁定，承接 WXG-T-031 已确立基准）：把 beads 各 GDD 里以「事件到达序 / 以先到为准」为基准的「同帧」条款**统一换基准**为可观测的**帧内执行序**——`core-loop §2.2` 拆为「**玩法叙事序**（玩家感知的因果链，非执行序）」+「**帧内执行序**（规范，唯一真源）：输入（段内序：状态指令 → 玩法事件）→ 连击窗（仅冲刺）→ 供料 → 计时」，并**补齐玩法事件段内序**（落子回执 → 通关判定；`level:cleared`（输入段）恒先于 `level:failed`（计时段））与「cleared 优先」的**可观测机制**（输入段处理完已离开 PLAYING ⇒ 本帧直接返回，供料与计时都不执行）。改 `tray-spawner §6` / `powerups §6` / `score-combo §6` / `bead-grid §6` / `input-control §6` 共 **14 处**（**outcome 一一对应，非改判据、仅换基准**），并把 `pause-settings §6` / `timer-gameover §6` 的复述改为对 `core-loop §2.2.2` 的**归口引用**（两处各自复述正是 WXG-T-031 漂移的成因）。**顺带更正文档级错误**：`epics-beads.md` EP01-S2 把叙事序误读成「update 顺序」（原文「供料心跳 → 输入快照 → …」）——实现与基准都是**输入在前**（`_stepPlaying`）。**新增可执行证明**：`tests/frame-order.test.ts` **4 条**（真·同帧注入 + 探针实测供料帧号 + 对照组），钉住「暂停抑制同帧供料」「道具恒先于供料（新珠存活）」「最后一格 vs 同帧归零（仅 cleared、零 `timer:tick`）」与段序。**新发现**：`score-combo §6` 的「placed 与 rejected 同帧」、`input-control §6` 的「同帧先选珠后落子」等条款在「每帧最多 1 条输入指令」下**不可达**，已如实改为「不可能同帧」，不留假想分支
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：games/beads/design/gdd/core-loop.md（§2.2.2 规范真源 + §6 + §9 变更记录）· tray-spawner / powerups / score-combo / bead-grid / input-control / pause-settings / timer-gameover 各 §6 · production/epics/epics-beads.md · games/beads/tests/frame-order.test.ts · tests/helpers.ts（共享 `tapInFrame`）· systems-index §6 变更记录 · 本台账

---

## WXG-T-062

- **名称**：**三项待裁定落地**（用户裁定「按推荐」）：① **卡几何（方案 A：改卡高、不动带位）** —— `assets-spec §1.4` 原「卡 176×150 + 卡下方标签 28」与 `systems-index §3.1` 的 `POWERUP_BAND` 高 **152** 无法同时成立（150+4+28 = 182 > 152）⇒ 卡改 **176×116**（+ 间隔 4 + 标签 28 = 148 ≤ 152），**§3.1 与底部留白 48 一字不动**；视图按 §1.4 补齐**角标 28×28 贴右上内缩 (8,8) + 白 ▶ 边 10、圆角 20、描边 1px、投影 α0.10、卡下方 28px 标签**，几何常量与 S2 命中测试共用 `powerupCardRects()` / `powerupLabelY()`；**A4 由此转真**（「形状唯一」+「文字标签并列」两半都在）。② **§8-4 判据改卡方检验** —— 原「各槽偏差 ≤ ±20%」在 n=200 / 12 槽下约一半概率误报（12 槽族极大偏差期望本身 ≈20–24%，单槽 σ ≈ 11%）⇒ 改为 **χ²（df=11、α=0.01、临界 24.725）**，与 seed 无关、误报率恒定 1%。③ **`region` 偶数窗口偏向升格明文** —— 原 §6「实现约定」升为 §2.2 表格内规定（含锚点在内、左 2 右 3），§6 改为指引以免两处漂移。**测试**：`view-model.test.ts` 新增 A4 几何/形状/标签判据、`powerups.test.ts` §8-4 改 χ²，beads **149 → 150**。**新增常量**：`POWERUP_CARD_W/H/RADIUS`、`POWERUP_LABEL_H/GAP`、`POWERUP_BADGE_*`（§1.4 的资产几何，非 §3 数值；**§3 全表零改动**）
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **产出**：games/beads/art/assets-spec.md（§1.4 + 裁定注）· art/accessibility.md（A4 转真 + 落地计数 13）· design/gdd/powerups.md（§2.2 明文 + §6 指引 + §8-4 卡方 + §9 变更记录）· src/config/tuning.ts · src/view/{view-model,palette}.ts · src/systems/powerups.ts（`POWERUP_LABELS`）· tests/{powerups,view-model}.test.ts · systems-index §6 变更记录 · 本台账。**观感复核追加**（同日）：三卡间距 **30 → 60**（三卡总宽 648、两侧余量 51），A4 判据补「整组不贴屏边」断言

---

## WXG-T-063

- **名称**：**EP-07 结算·过关面板落地**（用户裁定「开始 EP-07 结算面板」）：`ux-spec §4` 流转表要求 `LEVEL_CLEAR` **等按钮**（下一关 / 去冲刺 U1），而实现一直是「1.4s 自动进下一关」的占位 ⇒ 新增 `systems/clear-panel.ts`（纯布局 + 命中 + 入/出 200/150ms + **星入场逐颗 150ms**，同 PausePanel 范式），按 §3.4 画遮罩 + `panel_dialog` 底板 + 金色缎带标题 + 逐颗弹跳星级 + 「剩余 mm:ss ｜ 道具 n/3」+ 主/副双钮；`LEVEL_CLEAR` 改为**等按钮**，`LEVEL_CLEAR_DELAY_S` 与 `tuning.levelClearDelay` **退休**（留墓碑注）；面板开时压掉相位横幅；C7 结算分在 `level:cleared` 当帧装配（`lastSettleScore`，§8-2）；星入场各触发一次 `sfx_star`。**测试**：新增 `tests/clear-panel.test.ts` **7 条**（含「3s 内不自动推进」回归闸门 + 两条按钮出口 + C7 精确值 4200 + §8-2 数据装配），另改两处依赖自动推进的旧用例（改点面板主钮）；beads **150 → 157**。**EP-07 未完**：冲刺结算面板（`ux-spec §3.5` 左列）+ FINISH 通关画面（§3.6）+ 连击特效三档（§2.5，判据 `score-combo §8-9` 属 DevTools）
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成（EP07-S1 关面完成）
- **产出**：games/beads/src/systems/clear-panel.ts · src/game/{beads-game,state}.ts · src/view/view-model.ts · src/config/tuning.ts · tests/clear-panel.test.ts · 本台账

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
