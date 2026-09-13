# 热门大文件行号速查（自动生成，勿手改；重建 `pnpm run ctx:build`）

> **协议第二跳**：`ctx/ROUTES.md` 给「意图 → `文件#锚点`」，本表把锚点换算成可直接用的 `offset` / `limit`。
> 读法：`read_file(path, offset, limit)` —— **只取该节**，勿对大文件无条件整读。
> 行内格式：`锚点=offset+limit`（`limit` 已算好）；` · ` 分隔小节。
> 只收录**热文件与大文件**；查不到 → `ctx/index.json`（全量，机器读更划算）。token 为**估算**（CJK≈1/字、ASCII≈1/4 字符）。

> 体积预算 ≤ 4000 估算 tokens（当前 12 个文件）：本表是协议常驻开销，会**直接扣减净收益**（`ctx/reads-summary.md §②.1`），故超预算候选不进本表。

## `docs/architecture/architecture-beads.md` — 175 行 / 3819 tok / 实测读 35 次

§微信小游戏矩阵 — beads（拼豆填色消除）架构文档=1+176 · §1 beads 特有约束（在矩阵约束之上）=13+14 · §2 9 系统 → 框架模块映射（systems-index §5 逐条对账）=27+20 · §3 `games/beads/src` 目录结构=47+32 · §4 渲染层方案（ADR-0005 摘要）=79+18 · §5 事件装配图（systems-index §4 全部 13 事件）=97+25 · §6 BOOT 装配与关卡加载流=122+24 · §7 激励视频占位（ADR-0006 摘要）=146+9 · §8 风险登记册（beads 增量）=155+12 · §9 当前实现状态=167+10

## `docs/architecture/control-manifest.md` — 199 行 / 3013 tok / 实测读 42 次

§控制清单 — 可立即执行的一页规则=1+200 · §0 五条铁律（违反 = 直接打回）=8+12 · §1 目录与落位=20+16 · §2 热路径零分配=36+17 · §3 数据驱动，不硬编码=53+13 · §4 事件是通知，不是状态=66+12 · §5 存档=78+10 · §6 输入=88+9 · §7 状态机=97+9 · §8 渲染=106+11 · §9 平台差异=117+8 · §10 网络与安全（后续游戏适用）=125+10 · §11 测试=135+19 · §12 提交前自查表=154+18 · §13 反模式速查（见到就打回）=172+18 · §14 Cocos MCP 编辑器接入（ADR-0009）=190+11

## `games/beads/design/gdd/systems-index.md` — 228 行 / 6321 tok / 实测读 170 次

§系统清单与依赖索引（Systems Index）· beads=1+229 · §1 系统清单=9+16 · §2 依赖排序（Dependency Order）=25+30 · §3 全局数值基线（Global Constants）· ❄️ 冻结令=55+126 · §3.1 画布、坐标、安全区与布局带=67+16 · §3.2 色板与图案字符集=83+10 · §3.3 珠子网格（Bead Grid）=93+16 · §3.4 槽位托盘（Tray）=109+12 · §3.5 倒计时与失败=121+9 · §3.6 道具（Powerups）=130+10 · §3.7 星级与结算=140+8 · §3.8 可访问性（对齐 art-bible §3.3 与工作室 Standard 级）=148+10 · §3.9 包体预算=158+7 · §3.10 冲刺模式（Sprint）· 2026-09-12 用户拍板冻结（WXG-T-020）=165+16 · §4 事件总线约定（供程序落码参考）=181+25 · §5 与框架层的接口假设=206+9 · §6 变更记录=215+15

## `memory/MEMORY.md` — 49 行 / 1190 tok / 实测读 16 次

§wechatgame 项目长期笔记=1+50 · §项目约定=7+12 · §常用脚本=19+9 · §SubAgent=28+4 · §Rules=32+3 · §Hooks=35+4 · §Headless / CI=39+8 · §已知限制=47+4

## `production/TASKS.md` — 59 行 / 5227 tok / 实测读 4 次

§WXG 任务台账（SSOT）=1+60 · §待排（backlog，无号，立项时领取）=51+10

## `production/qa/beads/test-cases.md` — 146 行 / 5372 tok / 实测读 15 次

§《拼豆填色消除》(beads) 测试用例 · Test Cases=1+12 · §A 硬判据用例（50 条 = 5 组 × 10，判据 1:1 映射）=13+79 · §A1 · 核心循环（S1）— 来源 `core-loop.md §8.1..10`=15+15 · §A2 · 拼图网格与填色（S3）— 来源 `bead-grid.md §8.1..10`=30+15 · §A3 · 供料与托盘（S4）— 来源 `tray-spawner.md §8.1..10`=45+15 · §A4 · 输入与操控（S2）— 来源 `input-control.md §8.1..10`=60+15 · §A5 · 倒计时与失败（S5）— 来源 `timer-gameover.md §8.1..10`=75+17 · §B 派生用例（来源 systems-index §3 / accessibility.md，无 §8 编号，标注来源）=92+19 · §C 冲刺模式判据用例（11 条，判据 1:1 映射）— 来源 `score-combo.md §8.1..11`（v1.2 新增，WXG-T-028）=111+37

## `games/breakout/design/concept.md` — 143 行 / 3110 tok / 实测读 217 次

§《弹球打砖块》一页纸概念（Concept One-Pager）=1+144 · §1 一句话定位=11+4 · §2 为什么是它（Demo 验证价值）=15+16 · §3 设计支柱（Design Pillars）=31+8 · §4 MDA 分析（Mechanics → Dynamics → Aesthetics）=39+23 · §Mechanics（机制 · 系统做了什么）=41+7 · §Dynamics（动态 · 玩家实际产生的行为）=48+6 · §Aesthetics（美学 · 玩家获得的情感）=54+8 · §5 目标玩家（Bartle 类型）=62+8 · §6 心流与难度曲线思路=70+14 · §7 范围分层（Scope Layering）=84+34 · §MVP（必须，Demo 验收线）=86+12 · §应有（Should，时间允许则做）=98+6 · §可选（Could，锦上添花）=104+3 · §明确砍掉（Won't · 本期不做，附理由）=107+11 · §8 视觉锚点（一句话）=118+6 · §9 决策记录（已裁定）=124+15 · §10 下一步=139+6

## `games/breakout/design/gdd/systems-index.md` — 232 行 / 4600 tok / 实测读 171 次

§系统清单与依赖索引（Systems Index）=1+233 · §1 系统清单=8+16 · §2 依赖排序（Dependency Order）=24+28 · §3 全局数值基线（Global Constants）· ❄️ 冻结令=52+140 · §3.1 画布、坐标与安全区=64+16 · §3.2 场地（Playfield）=80+9 · §3.3 砖块网格（Brick Grid）=89+19 · §3.4 挡板与球=108+14 · §3.5 通用规则量=122+11 · §3.6 道具规格（定义 6 / 实装 3）=133+13 · §3.7 可访问性（承诺等级 Standard）=146+13 · §3.8 包体预算（⚠️ 区分「平台红线」与「内部目标」，勿混用）=159+20 · §3.9 砖块分值表（**权威**；代码若不符以此为准）=179+13 · §4 事件总线约定（供程序落码参考）=192+18 · §5 与框架层的接口假设（待程基岩确认）=210+13 · §6 变更记录=223+11

## `games/breakout/design/levels/levels-spec.md` — 244 行 / 3964 tok / 实测读 104 次

§关卡数据规范（Levels Spec）=1+245 · §1 文件结构总览=10+14 · §2 字段说明=24+65 · §2.1 `grid`（网格 → 像素坐标）=26+19 · §2.2 `brickTypes`（砖块类型目录）=45+17 · §2.3 `powerupPool`（道具目录）=62+13 · §2.4 `levels[]`（单关）=75+14 · §3 前 5 关参数总表=89+39 · §4 各关布局可视化=128+53 · §L1 热身（3×10，全普通）=132+7 · §L2 硬骨头（4×10，顶行全硬砖）=139+8 · §L3 钢之回廊（5×10，钢砖封角 + 阶梯空位）=147+10 · §L4 连锁爆破（4×10，炸弹砖成对 · R1-C）=157+10 · §L5 霓虹终章（5×10，全类型综合 · R1-C）=167+14 · §5 关卡设计约束（新增关卡时必须遵守）=181+24 · §5.1 校验分工（validateLevel vs QA validate-levels.mjs）=193+12 · §6 程序消费伪代码（供程基岩参考）=205+35 · §7 扩展预留（v2 方向，本期不实现）=240+6

## `my-skills/wxgame-gdd-writer/SKILL.md` — 83 行 / 1274 tok / 实测读 82 次

§wxgame GDD 编写法（工作室验证过的四件套流程）=6+79 · §总流程（顺序执行，前一步是后一步的输入）=11+7 · §1 一页纸概念模板（十节）=18+16 · §2 系统索引模板（核心是 §3 冻结令）=34+18 · §3 逐系统 GDD 八节模板（每系统一份，一节不多一节不少）=52+14 · §4 设计评审十查（design-review 模板）=66+13 · §工作方式=79+6

## `games/breakout/design/ux/ux-spec.md` — 225 行 / 3836 tok / 实测读 75 次

§UX 规格（UX Spec）=1+226 · §1 设计原则（UX）=9+7 · §2 界面流程（Screen Flow）=16+27 · §3 关键界面线框（ASCII）=43+79 · §3.1 通关画面 FINISH（唯一「新增」界面；主菜单已移除）=45+18 · §3.2 游戏中 HUD（叠加在 PLAYING 上）=63+22 · §3.3 暂停面板 PAUSED（设置的唯一入口）=85+20 · §3.4 结算面板 GAME_OVER（命尽）=105+17 · §4 状态流转与输入响应矩阵=122+21 · §5 交互反馈与动效时长建议=143+30 · §6 首屏与新手引导策略（微信首 10 秒留存）=173+33 · §6.1 首 10 秒时间轴=177+12 · §6.2 新手引导原则=189+8 · §6.3 启动路径（仅 2 条 + 通关画面）=197+9 · §7 可访问性（Accessibility）=206+11 · §8 决策记录与待确认项=217+10

## `games/beads/design/gdd/core-loop.md` — 119 行 / 2425 tok / 实测读 70 次

§GDD · S1 核心循环（Core Loop）· beads=1+120 · §1 目标=8+4 · §2 机制=12+44 · §2.1 游戏级状态机（六状态，沿用 breakout 判例，无主菜单）=14+23 · §2.2 关内微循环（PLAYING 的每秒心跳）=37+13 · §2.3 冲刺模式补记（2026-09-12 用户拍板，C8 条款；细则见 `gdd/score-combo.md` 与 systems-index §3.10）=50+6 · §3 输入=56+9 · §4 输出与反馈=65+12 · §5 数值=77+9 · §6 边界条件=86+17 · §7 依赖=103+5 · §8 验收标准（可测试硬判据，QA 直接造用例）=108+13

## 未收录（超出体积预算或未命中热度 / 体积门槛）

> 这些文件的锚点 → 行号请查 `ctx/index.json`（全量索引；机器读更划算）。

- `games/breakout/art/assets-spec.md`（4993 tok）
- `games/beads/design/gdd/bead-grid.md`（2073 tok）
- `AGENTS.md`（1743 tok）
- `my-skills/INDEX.md`（1701 tok）
- `games/breakout/design/gdd/powerups.md`（1501 tok）
- `games/beads/art/art-bible.md`（4511 tok）
- `games/beads/design/gdd/tray-spawner.md`（1939 tok）
- `games/beads/design/gdd/input-control.md`（1793 tok）
- `my-skills/wxgame-qa-gates/SKILL.md`（1299 tok）
- `games/breakout/design/gdd/bricks.md`（2914 tok）
- `games/breakout/design/gdd/save-progress.md`（2476 tok）
- `my-skills/game-dev-tool-free/SKILL.md`（4153 tok）
- `games/beads/design/gdd/score-combo.md`（4248 tok）
- `games/beads/art/assets-spec.md`（2861 tok）
- `games/beads/design/gdd/timer-gameover.md`（2190 tok）
- `games/breakout/design/gdd/pause-settings.md`（1460 tok）
- `games/breakout/design/design-review.md`（5081 tok）
- `games/beads/design/concept.md`（2796 tok）
- `games/beads/design/gdd/powerups.md`（5036 tok）
- `my-skills/wxgame-orchestration/SKILL.md`（2194 tok）
- `games/breakout/design/gdd/core-loop.md`（1781 tok）
- `games/breakout/design/gdd/life-gameover.md`（1175 tok）
- `production/epics/epics-beads.md`（7034 tok）
- `games/breakout/art/art-bible.md`（4852 tok）
- `production/qa/playtest-plan.md`（2872 tok）
- `my-agents/quality-lead.md`（772 tok）
- `my-agents/design-strategist.md`（674 tok）
- `games/breakout/design/gdd/paddle-ball-physics.md`（1525 tok）
- `games/breakout/design/gdd/score-combo.md`（1107 tok）
- `games/beads/design/levels/levels-spec.md`（2707 tok）
- `docs/architecture/architecture.md`（4322 tok）
- `my-skills/wxgame-ux-spec/SKILL.md`（1340 tok）
- `my-skills/wxgame-epic-split/SKILL.md`（1024 tok）
- `games/breakout/art/accessibility.md`（1838 tok）
- `production/qa/beads/smoke-tests.md`（2255 tok）
- `my-skills/game-studio/SKILL.md`（954 tok）
- `my-agents/INDEX.md`（877 tok）
- `my-skills/wxgame-adr-arch/SKILL.md`（818 tok）
- `production/qa/test-cases.md`（7097 tok）
- `my-skills/game-ui-voice-pack/SKILL.md`（2451 tok）
- `docs/reference/popit-pindou-gameplay-ui-analysis.md`（2511 tok）
- `my-skills/indie-game-ost-pack/SKILL.md`（2026 tok）
- `my-skills/wxgame-audio-spec/SKILL.md`（1209 tok）
- `docs/architecture/adr/ADR-0004-beads-level-data-rowstrings.md`（1088 tok）
- `my-skills/wxgame-art-spec-programmatic/SKILL.md`（986 tok）
- `games/beads/art/accessibility.md`（1763 tok）
- `production/qa/test-plan.md`（4334 tok）
- `games/beads/design/ux/ux-spec.md`（3602 tok）
- `my-skills/game-dev-tool-free/skill-card.md`（543 tok）
- `games/breakout/design/gdd/input-control.md`（1147 tok）
- `docs/agent/headless-ci-pr-review.md`（2747 tok）
- `my-skills/game-studio/references/agents.md`（2605 tok）
- `my-skills/wxgame-release-checklist/SKILL.md`（1089 tok）
- `production/qa/beads/test-plan.md`（2262 tok）
- `production/qa/g4-regression-report.md`（1762 tok）
- `docs/agent/hooks-best-practices.md`（1581 tok）
- `docs/architecture/adr/ADR-0007-beads-timer-dt-ownership.md`（1404 tok）
- `my-agents/studio-orchestrator.md`（747 tok）
- `memory/2026-09-12.md`（10141 tok）
- `games/breakout/art/runtime/README.md`（1064 tok）
- `my-agents/audio-director.md`（670 tok）
- `my-agents/art-director.md`（650 tok）
- `my-agents/engineering-lead.md`（640 tok）
- `my-agents/release-ops-lead.md`（624 tok）
- `docs/architecture/adr/ADR-0010-weixin-minigame-helper-integration.md`（7166 tok）
- `production/epics/epics-breakout.md`（7135 tok）
- `memory/2026-09-11.md`（5617 tok）
- `memory/2026-09-13.md`（4865 tok）
- `games/beads/design/proposals/daily-challenge.md`（4657 tok）
- `my-plugins/weixin-minigame-helper/0.1.4/SKILL.md`（4543 tok）
- `my-skills/wxgame-minigame-bridge/references/official-skill-0.1.4.md`（4543 tok）
- `docs/agent/context-instrumentation-survey.md`（4311 tok）
- `docs/architecture/adr/ADR-0009-cocos-mcp-editor-integration.md`（4220 tok）
- `my-skills/game-material-precheck/references/knowledge-baseline.md`（4188 tok）
- `my-skills/game-material-precheck/SKILL.md`（3878 tok）
- `production/release/release-checklist.md`（3853 tok）
- `knowledge/lessons.md`（3810 tok）
- `games/beads/design/gdd/pause-settings.md`（3807 tok）
- `my-skills/game-studio/references/templates.md`（3604 tok）
- `docs/engine-reference/cocos/VERSION.md`（3596 tok）
- `production/release/wechat-submission.md`（3409 tok）
- `games/breakout/cocos/README.md`（3114 tok）
- `production/release/rollback.md`（3088 tok）
- `my-skills/game-material-precheck/references/source-docs-global-cultural-risk.md`（3013 tok）
