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
