# WXG 任务台账 · 详情（标题制正文侧）

> **为什么拆开**：`production/TASKS.md` 曾**81% 的体积是任务行详情**（16 行 ≈ 5334 tok，中位行 389、最重 613），
> 而 `tasks:archive` 只清**已完成**行 ⇒ 每个新任务仍带入 400–600 tok ⇒ 反复撞 `ctx:check` **B 项单文件 8000**。
> 拆法：主表只留标题，正文落这里**一任务一节**（原文本原样搬，未改写）。
>
> **怎么读（协议，见 `ctx/ROUTES.md` 与主表头注）**：
> 1. **领号只读头注**：`grep -n '当前已分配至' production/TASKS.md` ⇒ 读那一行（≈30 tok）；要**看全部任务状态**才读主表（≈2.4k tok）；
> 2. 要某任务详情时，从 `ctx/index.json` 里**本文件该小节**的 `startLine`/`endLine` 取范围，
>    `read_file(path, offset, limit)` **只读那一节**（中位 ≈ 290 tok）——**不要整读本文件**。
>
> **配对纪律（由 `pnpm run check:tasks` 机械强制）**：主表有行 ⇔ 本文件有同名小节；
> 归档时**行与小节成对搬走** —— 由 `pnpm run tasks:archive` 机械执行（WXG-T-065：行进
> `archive/TASKS-archive.md`、节进 `archive/TASKS-DETAIL-archive.md`，节数 == 行数），故本文件只留在办 / 近期任务。

---

## WXG-T-077

- **名称**：**Cocos G3 遗留收口——`Label` 真实宽度替换 + `setAlign` 空实现补齐**（自 backlog「G3 遗留」正式立项；根因由 WXG-T-050 验收回填时登记为「不得记为已关闭」）：`packages/framework/src/adapters/cocos/cocos-renderer.ts:171` 的 `_anchorForText()` 仍用 `text.length × fontSize × 0.55` **估算**文本宽度做左右对齐偏移，VERSION.md G3 要求换成真实 `Label` 尺寸（建议 `UITransform`/`getBoundingClientRect` 回填）；`bindings.ts` 的 `wrapLabel.setAlign` 目前是**空实现占位**（对齐枚举真名 T-050 已纠正为 `HorizontalTextAlignment`/`VerticalTextAlignment`）。**拆两半执行**：① **可测半**（纯逻辑、Node 单测可验，守 L2——core 不碰 `cc`，仅 adapter）：`CocosLabelLike` 增测量出口（`measureWidth(text,fontSize): number` 或 `get width()`），`_anchorForText` 改为**消费注入的实测宽度**、删除 `0.55` 估算，补 fake-label 单测断言左/右对齐按真实宽度对称偏移；② **待编辑器半**（`[阻塞：无 Cocos Creator]`）：`bindings.ts` 真接 `cc.Label` 尺寸 + 落 `setAlign` 枚举，**运行时/目视验证无编辑器不可完成**，解除条件＝在 Cocos Creator 跑最小场景目视校正后方可回填关闭 G3。
- **负责**：主理人(Qoder)　**状态**：🔄 进行中——**可测半完成**，待编辑器半仍阻塞（G3 **保持不关闭**，符合下方验收）
- **验收**：G3 关闭须**两半都落**——可测半进 `pnpm run verify` 绿 + bindings 半在编辑器目视通过并更新 VERSION.md §G3/§4 矩阵；**只落可测半时 G3 保持不关闭**（禁止以「假绿」记关）。
- **实测（可测半，非假绿）**：`CocosLabelLike` 新增**可选** `measureWidth?(text,fontSize)` 出口（可选 ⇒ `bindings.ts` 本轮不动、不进 Node typecheck、Cocos 运行时不回归）；`_anchorForText(cmd, label)` 经 `_measureTextWidth` **优先消费注入实测宽**，无出口时退回显式常量 `FALLBACK_CHAR_WIDTH_RATIO=0.55`（即 G3 未关的降级根因）。vitest `cocos-renderer.test.ts` 新增 2 例（注入不同斜率测量证消费且左右严格对称 + 无出口证走降级），11→**13 全绿**；framework 全量 25 文件 **236 测试**绿；仓库 `typecheck` 3 项目 Done；harness `--build-only` OK。**未伪造**：`bindings.ts` 仅加 `[G3·待编辑器半]` 纯注释锚点（`setAlign` 枚举 + `measureWidth` 接 `UITransform` 接入点），未写任何 `cc` 代码。L2 合规（core 不碰 cc，仅 adapter）。
- **产出**：packages/framework/src/adapters/cocos/cocos-renderer.ts（已改）· tests/adapters/cocos-renderer.test.ts（已测）· bindings.ts（仅注释锚点，待编辑器落码）·【待编辑器半】cc.Label 实测接入 + setAlign 枚举 + 更新 VERSION.md §G3/§4（须真机
- **收口核验（2026-09-17，主理人）**：**编辑器半已在 `d79d10c` 落码**（`bindings.ts:423` `setAlign` → `HorizontalTextAlignment` 真实枚举（未知回退 CENTER）；`:433` `measureWidth` → `updateRenderData(true)` 后读 `UITransform.width` 真实文本宽，0/负由 `_measureTextWidth` 自动退 `FALLBACK_CHAR_WIDTH_RATIO` 估算 —— 与可测半契约对齐 ✅）。host-tests 绿 ✅；build-cocos 全程编译通过 ✅（bindings 不进 Node typecheck 的边界未破）。**⚠️ 验收所写「VERSION.md」文件已不存在**（文档重组未留迁移锚）—— §G3/§4 矩阵落点待定：建议并入 `g4-regression-report.md` 或补建 VERSION.md，挂 backlog。
- **G3 判定：保持不关闭（非假绿纪律）** —— 两半码齐、可测半绿，但**编辑器目视验证未做**（真机 ⛔ 无 AppID；浏览器预览目视待用户）。状态改「码齐待目视」。
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

---

## WXG-T-129

- **名称**：**微信真机触摸坐标归一化错误（BD-48）—— 真机点托盘/网格全部无响应，可玩性 P0**
- **负责**：程基岩(engineering-lead)　**状态**：📋 已立项（待施工）　**P0**（真机完全不可交互）
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

---

## WXG-T-128

**beads 美术 v1.4「动态质感章」风格单（G1–G9 动效欠账清偿）** · 负责：林绘澄(art) + 主理人(Qoder) · 状态：🔄 进行中

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

**美术规格侧未决项：零**（林绘澄回传 ⑤ 明述；三件文档内无条件句/待裁结构残留）。

## 真机首验包（待 AppID · 2026-09-16 登记 · 解除 DEV-01/B4）

> 前置：① 有效 AppID ② `pnpm --filter @wxgame/beads run build:cocos:wx` 出包 ③ 微信开发者工具 + 真机扫码 ④ 本包随包执行并回填。

- **P0-1 时基同源复核（BD-40 关单前提）**：真机跑 `production/qa/beads/beads-browser-probe.mjs` 的 CLK-01 等价面 —— 仿真/墙钟须 **≈1.00±0.10**（修复后 web 实测 1.002/0.997；**若真机 ≈2 ⇒ BD-40 复活升产品级 P1**）。
- **P0-2 光敏性观感**：wrong 态连点（观察单次脉冲非往复、无高频闪）+ 告急脉冲 + 满槽呼吸 —— 屏幕像素层 web 已验，真机亮度/刷新率差异须人眼复核。
- **P0-3 T-124 丙案视觉**：十层卡/冷底/F6 白字路由/NEW BEST 角标（T-127 修后 168 底衬）/STAGE 标签（T-127 修后 `DESIGN_W−30` 锚）—— 真机字体回退下不回溢（T-127 风险条款）。
- **P0-4 主包红线**：`build:cocos:wx` 实测包体 ≤4096 KB（§3 冻结；程序化合成 ⇒ 音频 0 KB 应天然满足）+ `check:size` 从 SKIP 转 OK。
- **P0-5 四相位真链**：暂停/结算/失败面板真指针可用（web 已验，微信 touch 语义须复验）。
- **P1-6 性能**：T-124 单帧最坏 +624 图元的帧率回退阀（林绘澄预授权条款）真机实测。
- **P1-7 音频**：A05-26 听感（`[P]`）+ 首次手势后出声（A05-27）。
- 以上全过 ⇒ G4 的 DEV-01 解除，可议升 PASS；任何一条红 ⇒ 按 BD-40 先例登记并回修。

---

## WXG-T-132


**G5 案 B：渲染管线全局变换通道（跨 `packages/framework`）** · 负责：程基岩(eng) · 状态：📋 已立项（待施工）

- 起因：WXG-T-128 美术 v1.4 缺口 **G5**——连击 Lv2「伪震屏」需**整屏 scale**，而渲染管线**无全局变换通道**（`RenderModelBuilder._commands` 为 `private readonly`，`RenderModel` 仅 `begin/build`、无变换字段；WXG-T-074 已登记）。视图侧现行处置 = **不假造替代画面**（`view-model.ts::drawComboVfx` 头注：`'pseudoShake'` 分支空实现，快照 `comboVfxProgress` 照常推进）。
- **用户裁定（2026-09-16）**：采**案 B（改框架）**，案 A（全场 filled 珠面齐脉冲 scale 1.00→1.015→1.00，约 15 行、不改框架、冲击感打约 6 折）**作废且不作降级预案**。
- 交付面：`RenderModelBuilder` 增全局变换通道（如 `setTransform({ scale, anchorX, anchorY })`）+ `RenderModel` 承载可选变换位 + **两个 adapter 各自实现**（web 2D context 变换 / `CocosRender2D` 节点缩放）。规格真源 = `art-bible §7.3.5`（v1.4-r2 定案段）+ `§7.1` Lv2 行「整屏 scale 1.00→1.015→1.00，150ms」（**措辞未改**，案 B 下规格与实现一致）。
- **前置验证项（不得当已解决）**：`FIXED_WIDTH` 下整屏放大 **1.015** 是否**露黑边**——设计空间 750×1334、`systems-index §3` 冻结「原点左下 / y 向上 / FIXED_WIDTH」，缩放锚点与视口填充策略须先给结论再动接口。
- 铁律与风险：跨 `packages/framework` 域 ⇒ **全矩阵回归**（framework + beads + breakout 三包测试 + `check:arch` L2「core 禁 cc/DOM/wx」不得因变换通道破例）；`sync-framework-to-cocos` 镜像须同批；**热路径零分配**（变换位不得逐帧 new）；L5「UI/渲染不持有游戏状态」不破。
- a11y 口径（`accessibility`，不随选案变）：D1 **整条关停**（`reduceMotion` 开 ⇒ 无缩放）；D2 单峰非周期 ⇒ 不构成闪烁；A5 峰值 50.75px < pitch 52 ⇒ 零重叠。**真机观察项**：整屏缩放会使 HUD 文字与 1px 描边产生**亚像素抖动**，影响 E1/B1 观感 ⇒ 落码后须真机抽检（现 Cocos 构建阻塞，ADR-0009 P2）。
- 图元：净 **+0**（变换不改图元数）。毫秒真源 = `ux-spec §5`「连击 ×3（Lv2）」行 **150ms**（冻结，不改）；幅度复用既有 `COMBO_SHAKE_SCALE_MAX`（**零新增冻结常量**）。
- **编号说明**：本单原拟领 `WXG-T-131`，但并发会话在主理人核查（表内最大号 130）与写入之间领走 T-131（beads 美术质感规格，林绘澄）⇒ **改领 T-132**。撞号由幂等守卫拦下（worktree 侧未误插状态行），已落盘详情内 2 处 T-131 引用同批修正；诚实登记不掩盖。
- **交叉依赖**：`art-bible §7.3.5`（v1.4-r2 定案段）现与并发会话的 **v1.5「纯色底 + 光影材质」**（T-131）叠加共存于同一文件，本单施工前须以**当时最新的 art-bible** 为准复核 §7.1 Lv2 行措辞是否仍为「整屏 scale 1.00→1.015→1.00，150ms」。
- **主理人复核（2026-09-16，抽查）**：art-bible/assets-spec **v1.5「纯色底+光影材质」**基调与四层凹陷卡（S1 暗缘/S2 内缩坑底/S3 上内阴影/S4 下受光亮线）已核，数值级可落码 ✅；能力边界遵守（无渐变原语 ⇒ 平涂+α 叠层，承 §1.7/§1.8 判例）✅；**端点表预烘焙**（10 色×3 端点模块级一次构建，热路径零新增字符串分配）—— 这条是成员主动识别的每帧分配风险，处理正确 ✅；凹凸区分「比原方案更强」复核结论 + 验收断言钉住 ✅；零外部资产 ✅。路径纠正（任务书写 design/art/**、实际 games/beads/art/**）属实且处理正确。四小未决裁定：L1 增项默认不做；L5 符号随工程单；`SOCKET_*`/`TRAY_PLATE_*` 常量并入 T-130 工程 Epic；托盘 3 段内阴影保留。

---

## WXG-T-133

- **名称**：**beads · Epic：错位归位工程实现（WXG-T-130 v2.0 规格的落地）**
- **负责**：主理人（编排）；Story 分派　**状态**：🔄 进行中　**P1**
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

## WXG-T-146

- **名称**：beads·落码② G3/G2′/G4（含面板延迟与 LOD 通道）—— 主表行照录；详情待归属会话落盘
- **⚠️ 代登记（2026-09-17，主理人 T-077 收口批次）**：该会话领号后未写本节致 `check:tasks` 红、阻断共享工作树提交。本节为**占位**，请归属会话收口时以实际内容**覆写本节**并追认。
