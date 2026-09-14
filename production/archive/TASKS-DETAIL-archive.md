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
