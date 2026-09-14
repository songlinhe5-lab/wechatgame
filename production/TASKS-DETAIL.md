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
