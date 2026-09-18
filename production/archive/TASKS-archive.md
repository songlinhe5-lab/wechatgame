# WXG 任务台账归档（tasks:archive 维护，勿手工领号）

> 由 `pnpm run tasks:archive`（tools/scripts/archive-tasks.mjs）从 `production/TASKS.md` 移入：完成 ≥30 天的 ✅ 行，保留原行全部内容。
> 本文件**不进 ctx 索引面**（`production/archive/` 命中 `lib/context-index.mjs` SKIP_DIRS，WXG-T-029 先例）。
> ⚠️ 全局最大号**含本文件**——领号认 `production/TASKS.md` 头注（由 tasks:archive 校准为全局最大号 + 1）。
> 勘误（2026-09-14，WXG-T-061 归档复核）：`WXG-T-032` 曾在本文件**有两行**——根因是两个会话各自建了一行同号任务，归档器原样搬入（残行只写了句「并入下方同号完整行」）。已合并为一行（尾批随 `263533b`/`c7ae9a7` 落库的说明并入行内）并删除残行；**归档器缺「同号守卫」的根因已登记 `TASKS.md` backlog**，防复发。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
> 归档批次 2026-09-14 10:30 +08:00 — 37 行（WXG-T-1、WXG-T-2、WXG-T-3、WXG-T-4、WXG-T-5、WXG-T-6、WXG-T-7、WXG-T-8、WXG-T-9、WXG-T-10、WXG-T-11、WXG-T-12、WXG-T-13、WXG-T-14、WXG-T-15、WXG-T-16、WXG-T-17、WXG-T-18、WXG-T-19、WXG-T-20、WXG-T-21、WXG-T-22、WXG-T-23、WXG-T-24、WXG-T-25、WXG-T-29、WXG-T-26、WXG-T-27、WXG-T-28、WXG-T-30、WXG-T-31、WXG-T-32、WXG-T-33、WXG-T-34、WXG-T-35、WXG-T-32、WXG-T-36）｜判定：git blame committer-time ≥ 1 天
| WXG-T-001 | breakout 框架搭建 | 程基岩 | ✅ 完成 | packages/framework 24 模块 + games/breakout |
| WXG-T-002 | breakout 概念+设计文档 | 文策渊 | ✅ 完成 | games/breakout/design/* |
| WXG-T-003 | breakout 美术三件套 | 林绘澄 | ✅ 完成 | games/breakout/art/* |
| WXG-T-004 | breakout QA 五件套 | 严守真 | ✅ 完成 | games/breakout/../production/qa（月度 G4 门） |
| WXG-T-005 | breakout 发布清单 | 路远行 | ✅ 完成 | 发布四件套 |
| WXG-T-006 | beads 概念+美术+GDD 首批 | 文策渊/林绘澄 | ✅ 完成 | concept / art-bible / systems-index 等 |
| WXG-T-007 | beads systems-index 冻结 | 文策渊 | ✅ 完成 | §3 冻结常量（现 v1.5） |
| WXG-T-008 | beads 美术回写冻结常量 | 林绘澄 | ✅ 完成 | art-bible/assets-spec/accessibility v1.2 |
| WXG-T-009 | beads 架构+ADR+QA+发布 | 程基岩/严守真/路远行 | ✅ 完成 | architecture-beads / ADR-0004~0007 / qa / release |
| WXG-T-010 | beads 架构三件套 | 程基岩 | ✅ 完成 | 同上（归并记账） |
| WXG-T-011 | beads QA 五件套 | 严守真 | ✅ 完成 | 62 用例覆盖 50/50 判据 |
| WXG-T-012 | breakout G4 回归测试 | 程基岩 | ✅ 完成 | g4-regression.test.ts（13 P0 判据） |
| WXG-T-013 | breakout D-01/D-02 修复 | 程基岩(2) | ✅ 完成 | 3 commits（afc5d6b/7284dc9/407da28 含 F-01），G4 门 PASS |
| WXG-T-014 | beads S6 道具系统 GDD | 文策渊 | ✅ 完成 | gdd/powerups.md（Q1–Q5 已裁决） |
| WXG-T-015 | beads S7 计分连击/S8 存档/S9 暂停 GDD + levels-spec + 8 关 JSON + UX 规格（A+ 扩容：冲刺模式/连击并入 S7，元游戏框架提案另立） | 文策渊 | ✅ 完成 | 七件套交付验收（score-combo/save-progress/pause-settings/levels-spec/8关JSON/ux-spec/meta-framework） |
| WXG-T-016 | beads 每日挑战设计草案（原 CodeBuddy 侧误编 013，改名） | 文策渊 | ✅ 完成（v0.1 挂起） | proposals/daily-challenge.md |
| WXG-T-017 | beads STAR3_RATIO 0.50→0.40 改值（原 CodeBuddy 侧误编 014，改名） | 文策渊/程基岩/严守真 | ✅ 完成 | systems-index §6 v1.5（commit ae11106） |
| WXG-T-018 | beads art-bible §7 动效对齐 ux-spec §5 + 连击三档特效增补 | 林绘澄 | ✅ 完成 | art-bible.md v1.1 |
| WXG-T-019 | breakout G4 门独立复验（D-01/D-02 修复后） | 严守真 | ✅ 完成 | G4 正式 PASS（F-01 Minor 已闭环 407da28） |
| WXG-T-020 | beads 30 项决策点冻结回写（用户 2026-09-12 全按推荐拍板） | 文策渊 | ✅ 完成 | systems-index v1.7（§3.10 冲刺常量组）+ §6 v1.8 事件登记 + 六文档冻结标注 |
| WXG-T-021 | CI/CD 拦截体系：commitlint + commit-msg hook + 细粒度 CI + PR 规范 + 分支保护脚本 | 程基岩 | ✅ 完成 | commitlint.config.mjs / .githooks/commit-msg / workflows×3 / CODEOWNERS / TASKS 修正（commits 084fa04+ca4f508；**提交信息内嵌号误编 016，以本行 021 为准**）；评审脚本 merge-base 修复（7caafa7，develop） |
| WXG-T-022 | ADR-0009 Cocos MCP 编辑器接入决策 | 程基岩 | ✅ 完成 | adr/ADR-0009（方案 A + P0–P2 用例分层 + 工具白名单）+ control-manifest §14 + architecture.md 链接（**任务单误编 017，以本行 022 为准**） |
| WXG-T-023 | 系统工程化：质量门 skill（含工具调用报告格式）+ knowledge/ 知识库 + AGENTS.md §9 协议 | 主理人 | ✅ 完成 | wxgame-quality-gate（四 IDE 链接，skills=13）+ knowledge/INDEX+lessons+patterns + AGENTS.md §9（**任务号误编 021，以本行 023 为准**） |
| WXG-T-024 | 上下文分级索引 P0：ctx:build 章节索引 + ctx:check 四重守卫（常驻预算/单文件上限/索引新鲜度/ROUTES 锚点）+ CI 接入 | 程基岩 | ✅ 完成 | ctx/{index.json,ROUTES.md,BUDGET.md,budget-exempt.json} · tools/scripts/{build-context-index,check-context-budget}.mjs · tools/scripts/lib/context-{tokens,index}.mjs · ci.yml 新增 ctx job（并入 gate） · AGENTS.md §8 +1 行（去重后 203→196 行/2980 tokens，阈值 3200） · **附：`develop` 纳入 CI 与 commit-lint 触发（裁定 A 方案）+ push 区间 lint** |
| WXG-T-025 | 修复 headless review 门 ARG_MAX 崩溃（大 diff 传参）+ diff 排除生成物 + 体积兜底 | 程基岩 | ✅ 完成（端到端待 CI 验证） | tools/scripts/ci-pr-review.sh（diff 落 .review/ + argv 与 diff 体积解耦 + 7 项排除 + 300KB 截断）· ci-pr-review-selftest.sh（桩自测 22/22 PASS）· docs/agent/headless-ci-pr-review.md §7 · .gitignore；裁定：保留 `--trust`、阈值 300KB、空 diff fail-open + 透明化 |
| WXG-T-029 | 知识库生命周期治理：行内 ID `[K-xxx]` + 访问记账（自动采集 + `kb:touch`）+ 90 天/≤1 次归档候选（人工确认）+ 归档相似命中重新激活 + 归档区排除索引面 | 程基岩 | ✅ 完成 | `tools/scripts/{kb-sync,kb-collect,kb-touch,kb-audit,kb-archive,kb-reactivate,kb-check}.mjs` + `lib/knowledge-ledger.mjs` + `knowledge/ledger.json`（24→28 条，`accessCount↔seen` 严格一致）+ `knowledge/archive/` + `knowledge/INDEX.md §5` 生命周期协议 + `AGENTS.md §9-4` + selftest **PASS=103**；`SKIP_DIRS` 加 `archive`（归档不进 ctx 索引） · **追加：沉淀变更统计**——`contentHash` + `events[]`（added/updated/reactivated/archived）+ `kb:sync` 打印「新增/修改/激活/归档」统计 + `knowledge/CHANGELOG.md` 生成物 + `kb:check` 升**八重**；实测统计：新增 K-029/K-030、修改 0、激活 0、归档 0（selftest PASS=172） |
| WXG-T-026 | 分层上下文节省效果验证装置：读入账本采集 + 真实使用分布分析 + 替换硬编码前缀 + E 项节省率/返工护栏守卫 + 四 IDE 埋点调研（含复验缺陷修复轮） | 程基岩 + 严守真（独立复验） | ✅ 完成 | 采集/分析器 + `lib/reads-ledger.mjs` + `ctx/{reads-ledger.jsonl(457),usage-distribution.json,reads-summary.md,savings-baseline.json v2}` + E 项（E1/E2 报告项、E3 硬门）+ `context-instrumentation-survey.md` + selftest **PASS=64**；**实测结论**：局部读节省率中位数 **75.1% ✅** / P10 **30.0% ❌** / 整体加权 **38.5%**（整文件读占 56.7%）→ **策略局部有效、整体未达标**；复验 D-01（改 ROUTES 未重跑 ctx:build 致 C 门红）已闭环，F-01~F-04 全修 |
| WXG-T-027 | beads 冲刺模式垂直切片工程实现（beads src 首个实现冲刺：P0 骨架 S1/S2/S3/S4/S5 + S7 冲刺连击/爬梯/计分 + Game 装配 + harness 接入 + vitest） | 程基岩 | ✅ 完成 | games/beads/{package.json,tsconfig.json,vitest.config.ts} · src/{config,entities,systems,game,view}（15 文件） · tests/**（6 文件，30/30） · dev/harness 接入；提交 `1c83776` + `a98b01a`（pnpm-lock 补 beads 工作区，修 CI frozen-lockfile） |
| WXG-T-028 | beads 冲刺模式测试用例与冒烟清单扩展（S7 §8 十一条判据 + C1–C8 常量 + 四枚冲刺事件；docs-only） | 严守真 | ✅ 完成 | production/qa/beads/{test-cases.md v1.2 §C（TC-SPRINT-01..11，判据 50→61）,smoke-tests.md v1.1（SC-SP-01）}；提交 `519cc9c` |
| WXG-T-030 | beads S9 暂停与设置：暂停面板（继续/重玩/重新冲刺/音乐/音效）+ 齿轮热区路由 + 单调度器双逻辑音频通道（架构缺口已登记：GameServices 未暴露 audioBackend）+ settings 持久化 + §8 十条判据测试 | 程基岩 | ✅ 完成 | games/beads/src/{systems/pause-panel.ts（面板纯逻辑）,view/view-model.ts（遮罩+面板+按钮文案）,game/beads-game.ts（齿轮路由前置+五按钮）,game/save-schema.ts（settings 字段）,config/tuning.ts（S9 表现常量）,game/state.ts,index.ts} · tests/pause-settings.test.ts（§8 十条）· 提交 `62ad9c5`（工程侧）+ 本笔（文档侧）· 验证：beads 40/40、breakout 239/239、check:arch OK、tsc 0 |
| WXG-T-031 | beads 暂停/归零「同帧裁决」真源对齐（docs-only）：timer-gameover §6 对齐 pause-settings §6 帧内序 + pause-settings §8-6 措辞可观测化 + §2.3 注记更新 | 文策渊 | ✅ 完成 | games/beads/design/gdd/{timer-gameover.md §6+§9,pause-settings.md §2.3/§6/§8-6/§9} · 确立**帧内序 = 输入（段内序：状态指令 → 玩法事件）→ 连击窗 → 供料 → 计时**、同帧暂停优先；timer-gameover §6 由「先结算归零再暂停」对齐 · 附：core-loop §6 两处同类「到达序」残留已登记 backlog（S6 未落地、S1 已声明串行序权威）· 本笔提交 |
| WXG-T-033 | my-skills 补缺：纳入 4 个外来现役 skill（weixin-minigame-helper / game-numeric-design / game-material-precheck / game-ai-design）+ 四 IDE 链接 + INDEX 优先级链 + gitignore 排除 .codebuddy/plans | 主理人 | ✅ 完成 | my-skills/{weixin-minigame-helper,game-numeric-design,game-material-precheck,game-ai-design} · my-skills/INDEX.md（13→17 + §3「外来现役」层）· 四 IDE skills/ 共 16 条相对符号链接 · .gitignore · 验证 check:links OK agents=7 skills=17 · 提交 `671e0ad`+`02c8c87` · **撞号追认：两笔提交信息误嵌 032（与 28905d5 的 ctx 解锁撞号），以本行 033 为准，提交信息不回改（沿用注 2 惯例）** |
| WXG-T-034 | ADR-0010：weixin-minigame-helper 插件集成决策——用户方案 D（my-plugins 符号链接直载）实测字面不可行（四 IDE 插件均为注册表/缓存制），裁决 C+D′：MCP 能力同源锚 0.1.13 + bridge 适配层 + my-plugins vendor 治理层 | 程基岩 | ✅ 完成 | docs/architecture/adr/ADR-0010-weixin-minigame-helper-integration.md（五节 + 控制清单 §15 草案 + 实施清单，Proposed→用户批准）· 本笔提交 |
| WXG-T-035 | ADR-0010 实施（组件矩阵）：my-skills 副本改名改造 wxgame-minigame-bridge（触发词与插件版隔离）+ 四 IDE 链接迁移 + 根/.cursor mcp.json（锚 0.1.13 禁 @latest）+ my-plugins vendor 快照（diff 逐字节一致）+ check-plugin-anchor 校验 | 程基岩 | ✅ 完成 | my-skills/wxgame-minigame-bridge/** · .mcp.json · .cursor/mcp.json · my-plugins/** · tools/scripts/check-plugin-anchor.mjs（selftest 6/6）· package.json(check:plugins) · my-skills/INDEX.md · 验证 check:links skills=17 · 本笔提交 |
| WXG-T-032 | CI 解锁 + 拦截前移 + AGENTS.md 瘦身拆分：① 重建索引解锁 develop C 门 ② `memory/2026-09-12.md` 登记 B 门豁免（追加式日记）③ `ctx:check --staged` + pre-commit（**最终语义：自动重建 `--staged-blobs` + 重新暂存 + 兜底终校验**，替代拦截式——拦截式被证实结构上不可通过）④ AGENTS.md 拆分瘦身（3199→**1699** 估算 tokens，§5/§6/§9 迁出 docs/agent/，`LIMITS.agentsMd` 3200→2000）⑤ BUDGET 两遍式构建改**循环至字节不动点**（自引用收敛） | 主理人 + 程基岩 | ✅ 完成 | ctx/budget-exempt.json · ctx/{index.json,BUDGET.md} · tools/scripts/{check-context-budget,build-context-index}.mjs · lib/context-index.mjs · .githooks/pre-commit · AGENTS.md · docs/agent/{repo-layout,commands,routing,hooks-best-practices}.md · ctx/ROUTES.md · selftest **PASS=111**；K-004 追加 2026-09-13 更新段 ；WXG-T-032 曾有两行（CodeBuddy 会话独立建行撞号，2026-09-14 归档一并搬入）——尾批随 `263533b`/`c7ae9a7` 落库，本轮并入本行、删除同号残行 |
| WXG-T-036 | 上下文装置口径精修三项 + 试点（CodeBuddy 会话）：① **E1 口径收紧为三分法**（`full`/`implicitFull`（无 offset 且行覆盖≥95%）/`partial`）+ **双列如实**（严格 P10 45.4% ✅／宽松 30.1% ❌），整读占比随口径由 56.7%→59.1%（**零和纠正、非行为改善**，两侧同时报）② 新增 `ctx/hot-files.md` 行号速查（协议缺失的「锚点→offset/limit」一跳，随 `ctx:build` 生成、按预算贪心控量）③ **净收益三行**（实测 39.0%／应然·协议基线 28.9%／应然·含速查 22.0%，**随 ROUTES/hot-files 体积变动，以 `pnpm run ctx:check` E4 现值为准**），并以 `attributable` 驱动**归因声明**（实测 `ctx/` 读事件为 **0** → 毛节省**不可归因于本装置**）④ Cursor `beforeReadFile` **log-only 探针**（不写账本、零风险） | 程基岩(CodeBuddy) | ✅ 完成 | tools/scripts/lib/{reads-ledger,context-index}.mjs · tools/scripts/{analyze-context-usage,build-context-index,check-context-budget}.mjs · ctx/{hot-files.md,reads-summary.md,usage-distribution.json,index.json,BUDGET.md,ROUTES.md} · ctx/savings-baseline.json（**口径变更重建**：p10Partial 0.300→0.454，防旧口径假绿）· **协议第二跳**：AGENTS.md §8 · my-rules/agents-md.md（always-on）· **⑤ 附带修复（本任务抓出的真实缺陷）**：`.githooks/pre-commit` 漏 `git add ctx/hot-files.md` → 新产物永不入库（CI 干净检出断链、A 项缺行），已修 hook + `check-context-budget.mjs` 四处修复文案同步；沉淀 **K-031** · **⑥ `--working-tree` 成对契约修正（复验抓出）**：该逃生阀两侧（生成器/门禁）原文档写「**均支持**」→ 只切校验侧即对**全部 dirty 文件**报「索引过期」，且照同段提示重跑**默认** `ctx:build` 无法恢复（索引模式 ≠ 校验模式）；已补 C 项**主动诊断**（dirty 文件全量 stale → 改判「索引模式不匹配」+ 成对命令）、FAILED 文案与两脚本头注释成对化、ROUTES ⑨ 补成对契约与「成对模式可暴露工作树真实体积」附带收益，沉淀 **K-032** · Cursor 探针：.cursor/hooks.json + .cursor/hooks/before-read-file.mjs（+ .gitignore）· docs/agent/context-instrumentation-survey.md（§3.1 探针已部署 / §6 边界更新）· knowledge/lessons.md(K-031) · knowledge/{ledger.json,INDEX.md,CHANGELOG.md} · memory/2026-09-13.md · production/TASKS.md · 验证 `check:links` OK · `ctx:build` 157 文件/1741 章节 · `ctx:usage` 457 读/20 会话 · `ctx:check` 全绿（A/B/C/D + E3 + E4 三行与归因声明）· `kb:sync` nextId=32 |
> 归档批次 2026-09-14 11:15 +08:00 — 7 行（WXG-T-37、WXG-T-38、WXG-T-39、WXG-T-40、WXG-T-41、WXG-T-42、WXG-T-43）｜判定：git blame committer-time ≥ 30 天
| WXG-T-037 | 上下文膨胀治理 R1：`ctx/reads-ledger.jsonl` 按会话分窗轮转 + 历史聚合进 baseline | 程基岩 | ✅ 完成 | `ctx:rotate`（tools/scripts/rotate-reads-ledger.mjs，窗口 N=20 会话、根会话树原子轮转、lastMtime 定新近度、幂等）· 历史聚合 `ctx/savings-history.json`（原始节省率样本数组 + 计数，archivedRootSessions 冻结注册表 + rotations 留痕）· lib/savings-history.mjs（样本口径/分位数/累计合并统一出处）· ctx:usage 新增 `metrics.cumulative`（窗口⊕历史）· ctx:check E1/E3 判定与样本充足性改累计口径（E3 不因窗口滑动假绿/假红），--update-baseline 同口径 · ctx:reads 侧车新增 bySession[s].lastMtime · context-usage-selftest §[10]（⑬A–⑬H）+ 修复 [6] 桩缺 hot-files 的 4 个既有 FAIL · survey 文档 §9 · 本笔提交 |
| WXG-T-038 | 上下文膨胀治理 R4：`knowledge/ledger.json` accessSources 截断保留近 N 个 | 程基岩 | ✅ 完成 | lib 层统一收口：`lib/knowledge-ledger.mjs` 新增 `ACCESS_SOURCES_MAX=12` + `trimAccessSources` / `appendAccessSource`，`normalizeLedgerEntry`（serializeLedger 必经点）统一截断（保尾部最新 12 个；`accessCount`/`seen`/`lastAccess` 语义不变，seen 不截断保 ⑥ 严格一致）· 写入方 kb-collect / kb-touch / kb-reactivate 改走 `appendAccessSource`（去重语义不变）· **存量回填**：`kb:sync` 幂等收敛 + 「R4 accessSources 收敛：截断 X 条｜去除 Y 个最旧标签｜瘦身约 Z 字节」数字报告；真库实测 34 条全部未超限 → 截断 0 条 / 0 字节（机制生效、无存量雷）· selftest 新增 [18]（18a 存量回填保尾弃头 / accessCount·seen 不变 / kb:check 绿，18b 幂等字节稳定，18c touch 写入时截断尾部新标签）→ **PASS=190 FAIL=0**（172→190）· `knowledge/INDEX.md §5.4` 截断语义 · 本笔提交 |
| WXG-T-039 | 上下文膨胀治理 R5：`ctx/ROUTES.md` 常驻体积定上限（含常驻产物总量预算评估） | 程基岩 | ✅ 完成 | `lib/context-index.mjs`：`LIMITS.routesMd = 7500`（现值 6235 +20.3%，低于 B 项通用 8000，保证 ROUTES 先于通用门被拦下）+ `LIMITS.residentTotalSoft = 13500`（现值 ≈12553 的 ≈+9%、各单文件上限合计 14500 的 ≈−7%）+ `residentLimit()` 单一真源（门禁 A 项判定与 BUDGET.md §1「上限」列共用，无两处硬编码）+ `RESIDENT_PROTOCOL_FILES` · `check-context-budget.mjs`：A 项新增 ROUTES 硬门（超限 FAIL + exit 1，诊断给瘦身指引、明示勿调阈了事）+ **常驻总量观察哨行**（报告项：超软阈仅 ⚠️ 不阻断，硬阻断只挂单文件门）· `build-context-index.mjs`：BUDGET.md §1 表补 hot-files / ROUTES 行 + 常驻总量行 + 阈值注 · `ctx/ROUTES.md` ⑫ 注（上限语义）· `docs/agent/context-instrumentation-survey.md` §10 · selftest §[11]（⑭A–⑭C：低于上限 exit 0 + A 表/BUDGET 同源、超限 exit 1 + 瘦身指引、总量超软阈不阻断）→ **PASS=170 FAIL=0**（154→170）· 验证 `ctx:build && ctx:check` 全绿（A 含 ROUTES 6235/7500 ✅、常驻总量 12372/13500 ✅、D2 17/17、E3 未劣化）· 本笔提交 |
| WXG-T-040 | 上下文膨胀治理 R3：TASKS.md 完成行 30 天后移 `TASKS-archive.md` | 程基岩 | ✅ 完成 | `tasks:archive`（tools/scripts/archive-tasks.mjs：默认 dry-run、--write 落盘、幂等、行数守恒 fail loud）· **完成判定裁决** = git blame committer-time（行级最后修改提交时间，一次调用取全文件；后续勘误只会推后日期 → 宁漏勿错；无日期证据不动）· **核心验收（防并行重号）**：真实归档时头注重写为「当前已分配至/下一可用号 = 主表∪归档**全局最大号**（+1）」，勘误行改「领号认本注，本注由 tasks:archive 校准」（上方已落新纪律；0 行时空转不落盘、头注不符只告警）· **归档路径裁决**：`production/archive/TASKS-archive.md`（**偏离任务书原名** production/TASKS-archive.md）——归档是只增冷数据，TASKS.md 是 tier:hot，若进索引面无限增长必撞 B 门 8000；置于 `archive/` 目录命中 `lib/context-index.mjs` SKIP_DIRS **零代码改动**排除索引（WXG-T-029 先例），且不触碰 R1/R4/R5 产物 · selftest `archive-tasks-selftest.sh` 6 组桩用例（dry-run 不落盘 / ≥30 天归档保原行+批次留痕 / 新完成·🔄·⏸·未提交行不动 / 头注校准不回退 / 勘误改写 / 幂等重跑 / 0 行空转 / 头注缺失 fail loud / 重复号不重复入档）**PASS=41 FAIL=0** · **首轮实测**：台账建档 2026-09-12 距今 1 天 → **0 行满足 30 天 → 空转不落盘**（0 行行为验收 ✅，归档文件未创建）· package.json(tasks:archive) · docs/agent/commands.md +1 行 · **不挂 pre-commit/CI**（可选治理，手工编辑路径不受影响）· 本笔提交 |
| WXG-T-041 | 上下文膨胀治理 R2：memory 日志 30 天蒸馏脚本化/按月分文件 | 程基岩 | ✅ 完成 | `memory:distill`（tools/scripts/distill-memory.mjs：默认 dry-run 列候选+MEMORY.md 近期更新作「已蒸馏」弱证据；`--write` 移入 memory/archive/ **移动即归档、原文逐字节保留**（回读校验，不等 fail loud 不删原件）+ MEMORY.md 末尾追加「⏳ 待蒸馏」占位；日期取自文件名，命名不符/日期非法/归档重名/无候选不动；幂等空转不落盘）· **核心裁决：脚本只做机械轮转，蒸馏内容责任在人/会话**（规程 docs/agent/memory-distill.md + MEMORY.md 头部段）· **归档路径裁决**：memory/archive/ 命中 lib/context-index.mjs SKIP_DIRS（WXG-T-029 先例）**零代码改动**排除索引面，不碰 R1/R4/R5 产物 · **B 门豁免收窄裁决**：budget-exempt.json 该条目新增 note——豁免仅对 ≤30 天日志生效，满 30 天应蒸馏+归档而非靠豁免硬扛；本轮不改豁免行为（09-12 日志仅 1 天）· selftest distill-memory-selftest.sh **PASS=41 FAIL=0**（dry-run 不落盘 / --write 逐字节归档+占位 / <30 天·非日期命名·日期非法·重名不动 / 幂等 / MEMORY.md 缺失 fail loud）· **首轮实测**：真实日志均 <30 天 → dry-run 与 --write 均 0 候选空转（<30 天文件只读，并发安全）· package.json(memory:distill) · docs/agent/commands.md +1 行 · 不挂 pre-commit/CI · 并行纪律：未 add memory/2026-09-13.md（有外来未提交改动）· 本笔提交 |
| WXG-T-042 | Cocos Creator + MCP 安装引导落盘（插件装**全局扩展目录** + 三处 IDE 端点登记） | 程基岩 | ✅ 完成 | docs/agent/cocos-setup.md · .mcp.json · .cursor/mcp.json · .codebuddy/mcp.json（新建）· ctx/ROUTES.md 锚点 · 本台账 |
| WXG-T-043 | Cocos MCP 配置收口：三处手写 → **单一正本** + 生成器 + 漂移门禁（用户裁定方案 C）。正本 `my-mcp/servers.json`（语义 + targets）→ 生成器 `build-mcp-configs.mjs`（方言 `explicit`/`cursor`，因两侧官方文档字段写法不同，**不可**用 my-skills 式 symlink 共享）+ `check:mcp` 五重校验（C1 正本 / C2 targets / C3 语义 + **回环红线机械化** / C4 产物漂移 / C5 **漏登记**，K-031 根治形态）+ 接入 pre-commit · CI `arch-guard` · `verify`；顺带修两个现存缺陷：`.cursor/mcp.json` stdio 条目缺 `type`、`docs/agent/cocos-setup.md` §7 关于 Cursor `type` 的错误结论 | 程基岩 | ✅ 完成 | my-mcp/{servers.json,README.md} · tools/scripts/build-mcp-configs.mjs（selftest 6/6）· .mcp.json · .cursor/mcp.json · .codebuddy/mcp.json（三份转为生成物）· package.json(mcp:build / check:mcp / verify 追加) · .githooks/pre-commit · .github/workflows/ci.yml · docs/agent/cocos-setup.md §2+§7 · docs/agent/hooks-best-practices.md · 本台账 |
> 归档批次 2026-09-14 13:36 +08:00 — 4 行（WXG-T-44、WXG-T-45、WXG-T-46、WXG-T-47）｜判定：git blame committer-time ≥ 30 天
| WXG-T-044 | ctx 多层加载收口 R6：第二跳覆盖 ROUTES 引用面（D2 口径 6/16=37.5% → 16/16=100%）+ 未收录清单瘦身（回收 ≈1190 tok）+ D2 覆盖率硬门（结构门） | 程基岩(CodeBuddy) | ✅ 已完成 | `tools/scripts/lib/context-index.mjs`（新增 `routesReferencedPaths()`；选池加「ROUTES 引用优先」、排序改「引用 ↓/读次数 ↓/体积 ↑」；未收录段只列路由落选者）· `tools/scripts/check-context-budget.mjs`（新增 D2 硬门 + 报告）· `ctx/ROUTES.md`（⑪·补协议文案）· 验证：`ctx:check --working-tree` 全绿、D2 17/17=100%；默认模式仅剩 D 项 1/79（`cocos-setup.md` 未入库，提交即绿）· 代价：ROUTES 常驻 5881→6235 tok，应然净收益 28.9%→28.3%（-0.6pt）· 知识沉淀：K-034（`kb:sync --task=WXG-T-044`；新增 1 / 修改 0 / 激活 0 / 归档 0；`kb:audit` 无候选、无相似命中）· 勘误：本行原记「62%→100%」不可复现，已按 D2 分母口径复算更正为 6/16→16/16 |
| WXG-T-045 | IDE 能力迁移矩阵盘点（分工拍板：开发=CodeBuddy/Cursor/Qoder，WorkBuddy=调研/方案/设计/文档） | 主理人 | ✅ 完成 | docs/agent/ide-capability-matrix.md（组件×四 IDE 矩阵，✅ 项有 check:links + check:mcp 门禁背书；WorkBuddy 保留项；缺口 4 项见文档 §3）· 本笔提交 |
| WXG-T-046 | Qoder MCP 接入：官方实证项目级读根 `/.mcp.json`（字段与 explicit 方言兼容）→ **零新文件零代码** | 主理人 | ✅ 完成 | my-mcp/README.md §5（项目级复用 + 用户级 ~/.qoder/mcp.json 已同步同语义两 server + UI 兜底；用户级在仓库外，升级版本需手动同步）· 矩阵文档 Qoder 行 ⏳→✅ · 本笔提交 |
| WXG-T-047 | 微信构建链前置补洞 + 两处文档漂移修正：① 补 `check-bundle-size.mjs`（阈值真源 `systems-index §3.8` 双口径：红线 4096/30720 KB、内部目标 2000 KB 分列不混用；分包判定三级回退 game.json→`subpackages/`→全计入主包；干净检出自动跳过）+ `check:size` 接入 `verify` ② 补 `check-secrets.mjs`——把 `control-manifest §10`/`ADR-0010 §4.2-5` 两条**只写在文档里、脚本却不存在**的红线机械化（扫描面 = `git ls-files --cached --others --exclude-standard`，即「会不会入仓」而非「磁盘上有没有」；故无需 `--staged` 模式）+ 接 pre-commit ⓪ 步 / CI `arch-guard` / `verify` + `.gitignore` 补密钥规则 ③ **实测推翻 ADR-0009 §3.2 P2**：`project_build_system` 仅 3 个只读 action、唯一含 `build` 的 `project_manage` 被禁用且实现只 `builder:open` ⇒ 「MCP 驱动构建」在 v1.5.4 **不成立**，G7 只能「人工构建 + 智能体回读日志/校验体积」 ④ 文档回填 6 处漂移（`cocos-setup §12`、`architecture §5/§6`、`ADR-0009 §3.2`、`test-plan Q9`、`cocos/README §2.1/§4`、`VERSION.md G1`） | 主理人(CodeBuddy) | ✅ 完成 | tools/scripts/{check-bundle-size,check-secrets}.mjs（自测 13+18 全绿）· package.json（`check:size`/`check:secrets`/`verify`）· .githooks/pre-commit（⓪ 步）· .github/workflows/ci.yml（arch-guard 加 step）· .gitignore（密钥与凭证段）· 上述 6 处文档 · 本台账 |
> 归档批次 2026-09-14 14:33 +08:00 — 8 行（WXG-T-048、WXG-T-049、WXG-T-050、WXG-T-051、WXG-T-052、WXG-T-053、WXG-T-054、WXG-T-057）｜判定：git blame committer-time ≥ 30 天｜详情节同批搬入 production/archive/TASKS-DETAIL-archive.md
| WXG-T-048 | 多游戏粒度修正 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-049 | 构建自动化能力修正 + CLI 构建落地 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-050 | 里程碑验收回填 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-051 | 引擎功能裁剪 + 包体内部目标达标 | 主理人(CodeBuddy) | ✅ 完成（实玩验收待补） | 见详情 |
| WXG-T-052 | beads 工程化对齐 breakout | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-053 | beads Cocos 宿主落地 | 主理人(CodeBuddy) | ✅ 完成（工程创建待人工 GUI） | 见详情 |
| WXG-T-054 | beads 星级×关卡数值整组返工 | 文策渊 | ✅ 完成（组 C 已冻结） | 见详情 |
| WXG-T-057 | beads 广告位重排 + 失败页续时裁决 | 文策渊 + 程基岩 | ✅ 完成（规则已冻结，实现另排） | 见详情 |
> 归档批次 2026-09-14 15:02 +08:00 — 5 行（WXG-T-058、WXG-T-055、WXG-T-056、WXG-T-060、WXG-T-061）｜判定：git blame committer-time ≥ 30 天｜详情节同批搬入 production/archive/TASKS-DETAIL-archive.md
| WXG-T-058 | beads Mock 续时实现 | 程基岩 | ✅ 完成 | 见详情 |
| WXG-T-055 | beads 打断留存 | 程基岩 | ✅ 完成（快照未落码） | 见详情 |
| WXG-T-056 | G4 复核：星级可达性用例缺口（注入 ratio 假绿） | 严守真 | ✅ 完成（readonly） | 见详情 |
| WXG-T-060 | beads S6 道具系统落码 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-061 | 「到达序」判据清理 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
> 归档批次 2026-09-14 15:13 +08:00 — 2 行（WXG-T-062、WXG-T-064）｜判定：git blame committer-time ≥ 30 天｜详情节同批搬入 production/archive/TASKS-DETAIL-archive.md
| WXG-T-062 | 三项待裁定落地 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-064 | 台账标题制 + 详情分片（治膨胀） | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
> 归档批次 2026-09-14 15:23 +08:00 — 1 行（WXG-T-065）｜判定：git blame committer-time ≥ 30 天｜详情节同批搬入 production/archive/TASKS-DETAIL-archive.md
| WXG-T-065 | 归档器成对搬运（行+详情节） | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
> 归档批次 2026-09-14 18:19 +08:00 — 2 行（WXG-T-066、WXG-T-067）｜判定：git blame committer-time ≥ 30 天｜详情节同批搬入 production/archive/TASKS-DETAIL-archive.md
| WXG-T-066 | EP-07 通关画面（FINISH） | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-067 | 冲刺结算面板（§3.5 左列） | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
> 归档批次 2026-09-14 19:58 +08:00 — 3 行（WXG-T-059、WXG-T-063、WXG-T-068）｜判定：git blame committer-time ≥ 30 天｜详情节同批搬入 production/archive/TASKS-DETAIL-archive.md
| WXG-T-059 | beads 局内崩溃快照落码 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-063 | EP-07 结算·过关面板落地 | 主理人(CodeBuddy) | ✅ 完成（EP07-S1 关面完成） | 见详情 |
| WXG-T-068 | memory 日志分级加载（摘要层） | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
> 归档批次 2026-09-17 14:51 +08:00 — 65 行（WXG-T-069、WXG-T-070、WXG-T-071、WXG-T-072、WXG-T-073、WXG-T-074、WXG-T-075、WXG-T-076、WXG-T-078、WXG-T-079、WXG-T-080、WXG-T-081、WXG-T-082、WXG-T-083、WXG-T-084、WXG-T-085、WXG-T-086、WXG-T-087、WXG-T-088、WXG-T-089、WXG-T-090、WXG-T-091、WXG-T-092、WXG-T-093、WXG-T-094、WXG-T-095、WXG-T-096、WXG-T-098、WXG-T-100、WXG-T-101、WXG-T-102、WXG-T-103、WXG-T-104、WXG-T-106、WXG-T-107、WXG-T-108、WXG-T-109、WXG-T-110、WXG-T-111、WXG-T-112、WXG-T-113、WXG-T-114、WXG-T-115、WXG-T-116、WXG-T-117、WXG-T-118、WXG-T-119、WXG-T-121、WXG-T-122、WXG-T-123、WXG-T-124、WXG-T-125、WXG-T-126、WXG-T-130、WXG-T-131、WXG-T-134、WXG-T-135、WXG-T-136、WXG-T-137、WXG-T-138、WXG-T-139、WXG-T-140、WXG-T-141、WXG-T-142、WXG-T-143）｜判定：git blame committer-time ≥ 30 天｜详情节同批搬入 production/archive/TASKS-DETAIL-archive.md
| WXG-T-069 | 两库使用触发协议入档 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-070 | 台账头注落后的机械门禁 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-071 | 星级表持久化（S8 §2.2 stars） | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-072 | ctx:build 写入顺序闭环 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-073 | 归档器详情侧体积旋钮 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-074 | EP-07 连击特效三档（可测半） | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-075 | 领号只读头注（协议精化） | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-076 | 台账 backlog 卫生门+行数哨 | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-078 | 归档器同号守卫（主表∪归档去重告警） | 主理人(Qoder) | ✅ 完成 | 见详情 |
| WXG-T-079 | beads 工程接入 Cocos MCP（补两件设置） | 主理人(CodeBuddy) | ✅ 完成 | 见详情 |
| WXG-T-080 | beads P0·空槽目标色美术规格裁定(GAP-01) | 林绘澄(art) | ✅ 完成 | 见详情 |
| WXG-T-081 | beads P0·ux矛盾消解+泄压阀设计裁定(GAP-02/03/06) | 文策渊(design) | ✅ 完成 | 见详情 |
| WXG-T-082 | beads 坐标空间契约ADR+Cocos双路径取证(GAP-07/08) | 程基岩(eng) | ✅ 完成 | 见详情 |
| WXG-T-083 | beads 音频规格从零建档(GAP-05) | 阮和鸣(audio) | ✅ 完成 | 见详情 |
| WXG-T-084 | beads G4首执行+可感知判据补编(GAP-14) | 严守真(qa) | ✅ 完成 | 见详情 |
| WXG-T-085 | beads P0·GAP-01空槽目标色落码 | 主理人(Qoder) | ✅ 完成 | 见详情 |
| WXG-T-086 | beads P0·GAP-02首供+GAP-06泄压阀A′+D落码 | 主理人(Qoder) | ✅ 完成 | 见详情 |
| WXG-T-087 | beads P0·GAP-04VFX+wrong/hint态+GAP-03引导+GAP-10告警 | 主理人(Qoder) | ✅ 完成 | 见详情 |
| WXG-T-088 | beads·R1甲 D1/E2可访问性开关落码 | 主理人(Qoder) | ✅ 完成 | 见详情 |
| WXG-T-089 | beads P0·GAP-07/08 harness坐标落码(ADR-0011) | 主理人(Qoder) | ✅ 完成 | 见详情 |
| WXG-T-090 | G10 ES5转译修复(spike+ADR-0012+CI守卫) | 程基岩(eng) | ✅ 完成（本环境可验面全绿；真机 runtime 随 G4/AppID） | 见详情 |
| WXG-T-091 | beads·R4判据冲突回写+R5包体重算+R6 lessons沉淀 | 主理人(Qoder) | ✅ 完成 | 见详情 |
| WXG-T-092 | beads·G4复验探针重跑+报告v1.1(波次3) | 严守真(qa) | ✅ 完成（11 FAIL→4，零回归；主理人已裁 **G4=CONCERNS**，见 T-094） | 见详情 |
| WXG-T-093 | beads·U8/B3文档漂移回写+守卫登记 | 主理人(Qoder) | ✅ 完成 | 见详情 |
| WXG-T-094 | beads·波次3汇编G4主理人裁决CONCERNS+波次4立项 | 主理人(Qoder) | ✅ 完成 | 见详情 |
| WXG-T-095 | 门禁可信度·verify逐项汇总+check:size显式SKIP | 主理人(Qoder) | ✅ 完成（verify 不再短路；beads 缺产物现报 SKIP 非 ✅） | 见详情 |
| WXG-T-096 | beads·音频后端落码(BD-05/05b 三平台+19clip) | 程基岩(eng)+主理人 | ✅ 完成（①部分交付：weapp音频池未做） | 见详情 |
| WXG-T-098 | beads·B7裁定包回写(BD-27/28/29/30/31) | 文策渊+林绘澄 | ✅ 完成（四条关闭；BD-29 转态→T-102） | 见详情 |
| WXG-T-100 | beads·面板相位真输入断链(BD-34) | 程基岩(eng) | ✅ 完成（四相位真链接通；主理人真指针复证三条真人路径全过） | 见详情 |
| WXG-T-101 | 门禁·pre-commit 镜像漂移条件守卫 | 主理人(Qoder) | ✅ 完成（红→绿双向实测） | 见详情 |
| WXG-T-102 | beads·BD-29 改码：wrong 描边单次脉冲 | 程基岩(eng) | ✅ 完成（α 极值点=1、500ms 门生效、250 例全绿；主理人复核通过） | 见详情 |
| WXG-T-103 | beads·音频裁定包(冲突 C1/C3 补做) | 文策渊 | ✅ 完成（A05-09 仍 ⛔：待探针同步） | 见详情 |
| WXG-T-104 | beads·P0 Cocos 输入y轴镜像(C1)：锁语义+改码+ADR-0011订正 | 程基岩(eng) | ✅ 完成（A+B 均经主理人复核；R1 端到端反转已证；红灯期结束） | 见详情 |
| WXG-T-106 | memory 二级详情文件索引（memory/details/） | 主理人(Qoder) | ✅ 完成 | 见详情 |
| WXG-T-107 | 宿主归一化契约入控制清单(control-manifest §17) | 程基岩(eng) | ✅ 完成（§17 + 4 处交叉引用已落盘并经主理人复核） | 见详情 |
| WXG-T-108 | Cocos 输入取证固化：R1/R2/R3可复跑+breakout[B]目视 | 严守真(qa) | ✅ 完成（PASS 18 ｜ FAIL 0 ｜ ⛔ 2；主理人独立复跑退出码 0） | 见详情 |
| WXG-T-109 | Cocos 输入 R1/R2/R3 回写 test-cases 硬判据 | 严守真(qa) | ✅ 完成（§I + TC-COORD-01..03；⛔ 如实标注） | 见详情 |
| WXG-T-110 | 宿主行为测试守卫（warn 级，非 fail-closed） | 程基岩(eng) | ✅ 完成（verify 第 15 项；缺口时不阻断已独立复核） | 见详情 |
| WXG-T-111 | knowledge 按标签分片＋撤到期豁免 | 主理人(Qoder) | ✅ 完成（30→32 条逐字节差异 0；撤 1 豁免·零新增） | 见详情 |
| WXG-T-112 | 装置自指类门禁评估（含 BD-38） | 主理人(Qoder) | ✅ 完成（三起手单遍收敛实测；对账门 + ctx:selftest 9/0） | 见详情 |
| WXG-T-113 | 框架·丢帧重复投递(一次touch多指令)+harness遮挡齿轮 | 程基岩(eng) | ✅ 完成（endFrame 改 per-substep；红例 6/6；主理人复核通过） | 见详情 |
| WXG-T-114 | QA·真链口径切换(P8/P10/P22)+input-control §8三相位判据回写 | 严守真(qa) | ✅ 完成（P8R/P10R/P22R + P27a..d 全绿；§8 拟稿待设计中转） | 见详情 |
| WXG-T-115 | beads·input-control §8 三相位门禁+多子步口径回写 | 文策渊(design) | ✅ 完成（8b/8c/8d + §8-3/§8-10 口径 + §2.3 对齐；v1.1） | 见详情 |
| WXG-T-116 | QA·§A4b去「拟」+次按钮真链孪生用例 | 严守真(qa) | ✅ 完成（5 条次按钮腿全绿；探针 66 组；判据去「拟」） | 见详情 |
| WXG-T-117 | beads·ux-spec §5 告急行 α 幅度补全(BD-35) | 文策渊(design) | ✅ 完成（告急 0.6↔1.0@1000ms；另补 2 行同类缺；+307 tok） | 见详情 |
| WXG-T-118 | QA 复跑 P4+P7（T-102 改码 + T-117 判据转正） | 严守真(qa) | ✅ 完成（P4→PASS\*、P7→PASS；全量 39/17/1/9；修订 43） | 见详情 |
| WXG-T-119 | beads·[B] 浏览器逐帧取证（P4 发光序列 + A05 时长/包络） | 严守真(qa) | ✅ 完成（`[B]` 通路建立 + A05 族实测；**屏幕层判据面不达标 ⇒ 仍未取证**；新增 **BD-40**） | 见详情 |
| WXG-T-121 | 装置自测分档挂门禁（BD-39 · BD-40） | 主理人(Qoder) | ✅ 完成（verify STEPS +2 ⇒ PASS 16；余 CI 首跑观察） | 见详情 |
| WXG-T-122 | 框架·宿主驱动权互斥（BD-40 宿主双驱动修复） | 程基岩(eng) | ✅ 完成（`startHostDriven()` + 三道互斥守卫；CLK-01 1.999→**0.999**；weapp 同修；主理人复核通过） | 见详情 |
| WXG-T-123 | QA 复测 CLK-01（BD-40 修复后产物）+ 勘误 §25.13 | 严守真(qa) | ✅ 完成（CLK-01 **1.002/0.997** ⇒ PASS，退出码 **0**、FAIL 0；§25.13 勘误 + §25.14 分辨率口径） | 见详情 |
| WXG-T-124 | beads 美术 v1.3 丙案双色温对撞风格单(三件套+落码) | 林绘澄(art)+主理人(Qoder) | ✅ 完成（v1.3 全量落码：十层卡+冷底+view-model F6/F2/F3/F7/F8；真机截图待补） | 见详情 |
| WXG-T-125 | beads §3.8 幽灵符号可见性冻结变更单(F5) | 主理人(Qoder) | ✅ 完成（0.42/0.32 落 §3.8 v1.21 + palette/镜像/assets-spec 回写 + A2b 探针 2/2；真机截图待补） | 见详情 |
| WXG-T-126 | beads ux-spec §3/§5/§7 HUD 条款对齐 v1.3 落码事实(F7①②⑤/F6) | 主理人(Qoder) | ✅ 完成（白胶囊/8齿齿轮/28px floor/选中点 accent_blue/§7 字号行；§3.2 冲刺 HUD 提案转正另立单） | 见详情 |
| WXG-T-130 | beads·玩法细化文案：错位归位循环 + 格底纯色（用户裁定） | 文策渊(design) | ✅ 完成（12 文落盘：GDD 4 文升 v2.0、§3 冻结变更 8 条、a11y 降档签字登记；工程 Epic 待拆） | 见详情 |
| WXG-T-131 | beads·美术质感规格：珠/托盘/棋盘材质感（用户裁定） | 林绘澄(art) | ✅ 完成（art-bible/assets-spec v1.5「纯色+光影」；四层凹陷卡数值级可落码；零外部资产） | 见详情 |
| WXG-T-134 | beads·E1 网格错位状态机+取回/归位裁决 | 程基岩(eng) | ✅ 完成（266/266 全绿；E2–E5 消费口就绪；check:size 存量漂移交发布域） | 见详情 |
| WXG-T-135 | beads·E2 输入路由选择锚化（锚互斥+路由分支化） | 程基岩(eng) | ✅ 完成（284/284 全绿；取回/归位全链单测贯通；Epic 2/7） | 见详情 |
| WXG-T-136 | beads·E3 供料摘除+托盘纯缓冲收尾 | 程基岩(eng) | ✅ 完成（286/286 全绿；三重死路径标注；联动面零静默改动；Epic 3/7） | 见详情 |
| WXG-T-137 | beads·E4 解环器三型（powerups 反转） | 程基岩(eng) | ✅ 完成（S6 无状态化+归位闭环；284/284 全绿；Epic 4/7） | 见详情 |
| WXG-T-138 | beads·v1.23 大胆重制落盘（托盘6槽/时间按k定价/星级主题语义/swap禁/冲刺k爬梯） | 主理人(WorkBuddy) | ✅ 完成（5 文落盘：systems-index v1.23 七处 + changelog + input-control v2.1 + concept v1.2 + 提案正本；工程落码另排） | 见详情 |
| WXG-T-139 | beads·E5 错位装配器+BOOT 校验+levels JSON v2 | 程基岩(eng) | ✅ 完成（314/314 全绿；修 NaN 死循环；按 v1.23 对齐；Epic 5/7） | 见详情 |
| WXG-T-140 | beads·谜面可读性裁定 (b)「L11 目标色环」落盘 | 主理人(WorkBuddy) | ✅ 完成（accessibility §5.4 关项 + assets-spec §1.1/§1.2/§1.8 基线④ + bead-grid L74 循环论证改正 + 草稿图同步；零 §3 变更） | 见详情 |
| WXG-T-141 | beads·参考竞品四项裁定落盘（托盘 24 槽 / 缩放手势 / HUD / 失败页确认） | 主理人(WorkBuddy) | ✅ 完成（systems-index v1.24：TRAY_BASE/EXPAND 6→24 + 4 行态几何重验注记；tray-spawner v2.1；concept v1.3 D13；input-control v2.2；ux-spec v1.6；参考文档 §8 回填；§3.5/§3.11 零变更） | 见详情 |
| WXG-T-142 | beads·谜面可读性载体切换 B′「目标色垫·垫色显缝」 | 主理人(WorkBuddy) | ✅ 完成（assets-spec v1.5-r5：L11 垫 + BEAD_DRAW_INSET=2；accessibility §5.4 终裁；bead-grid L74；基线 1828 不变；零 §3 变更） | 见详情 |
| WXG-T-143 | beads·E6 渲染改造（四层凹陷卡+L11 垫+端点表） | 程基岩(eng) | ✅ 完成（315/315 全绿；端点表预烘焙零分配；托盘 24 槽布局待设计定尺寸） | 见详情 |
> 归档批次 2026-09-18 23:10 +08:00 — 29 行（WXG-T-077、WXG-T-097、WXG-T-099、WXG-T-129、WXG-T-127、WXG-T-132、WXG-T-133、WXG-T-144、WXG-T-145、WXG-T-146、WXG-T-147、WXG-T-148、WXG-T-149、WXG-T-150、WXG-T-151、WXG-T-152、WXG-T-153、WXG-T-154、WXG-T-155、WXG-T-157、WXG-T-161、WXG-T-158、WXG-T-159、WXG-T-160、WXG-T-162、WXG-T-163、WXG-T-165、WXG-T-156、WXG-T-168）｜判定：git blame committer-time ≥ 30 天｜详情节同批搬入 production/archive/TASKS-DETAIL-archive.md
| WXG-T-077 | Cocos G3：Label 真实宽度替换 | 主理人(Qoder) | ✅ 完成（两半码齐 + 预览目视 PASS，G3 关闭；截图存证） | 见详情 |
| WXG-T-097 | beads·P1反馈缺口(BD-15/16+BD-04余类+BD-32) | 主理人(Qoder) | ✅ 完成（四项全关：BD-15/16/10/32/04；探针复跑归 QA） | 见详情 |
| WXG-T-099 | beads·取证通路补全(像素滤镜+frames+§H缺口) | 程基岩+严守真 | ✅ 完成（③ §H 12 条**进探针**已落地并判读；④ 证据形式裁定 = 报告内引用路径 + mtime，**不入仓**） | 见详情 |
| WXG-T-129 | 微信真机触摸坐标归一化错误(BD-48) 可玩性 P0 | 程基岩(eng) | ✅ 真机复验通过（wx 分支落码；真因经 T-161 勘误修正随 `706e99f` 入库；**2026-09-18 用户真机首验 P0-A 点击命中 ✅**、SHOW_ALL 重开（产物 policy:2）后十字与手指重合；可玩性 P0 闭） | 见详情 |
| WXG-T-127 | beads 可玩性实测差距修复(BD-43 热区错位 P1 等) | 程基岩(eng) | ✅ 完成（BD-45/46/47 修复 + BD-43 不复现补同源断言 + BD-44 非缺陷勘误；随 `ec49da8` 入库；复测项见详情） | 见详情 |
| WXG-T-132 | G5案B：渲染管线全局变换通道（跨 framework） | 主理人(Qoder) | ✅ 完成（随 `ede72d5` 入库；三包矩阵 295/409/239 绿；⚠️ Cocos 节点缩放系编辑器半，真机抖动观察项未关） | 见详情 |
| WXG-T-133 | beads·Epic：错位归位工程实现（E1–E7 拆分） | 主理人(Qoder) | ✅ 完成（E1–E7 **7/7 收官**：T-134~137 / T-139 / T-143 / T-144；收口复核 verify 14/15，三包 295/409/239 全绿，唯一 FAIL=check:size 存量漂移归发布域；G4 探针复跑另单 T-151，真机 `[R]` 仍 ⛔） | 见详情 |
| WXG-T-144 | beads·E7 QA 判据迁移（四族⛔+新玩法用例+G4 收口） | 严守真(qa) | ✅ 完成（test-cases §J + 报告 v1.9；探针 v2 数据下 ⛔ 待重写；**Epic T-133 收官 7/7**） | 见详情 |
| WXG-T-145 | beads·G1 落座回弹落码（vfx_fill_pop，T-128 落码①） | 主理人(Qoder) | ✅ 完成（328/328 绿；代码随并发会话 `dbb3c1c` 进 HEAD，**未经真机验证**） | 见详情 |
| WXG-T-146 | beads·落码②G3/G4 VFX+24槽托盘适配 | 并发会话+主理人收口 | ✅ 完成（369/369 全绿；G2′ 拆 T-149） | 见详情 |
| WXG-T-147 | beads·连通选取+整组收进（错位玩法组语义，用户裁定） | 主理人(Qoder) | ✅ 完成（335/335 全绿；8 邻接 flood fill 锚 + 组化取回；规格回填待 GDD 批。⚠️ **全绿串经复核不成立于其自身提交**，见详情节「收口后复核注」） | 见详情 |
| WXG-T-148 | beads·错位珠恒亮白环+锚珠抬起（用户反馈①②） | 并发会话(Qoder)，本会话代登记 | ✅ 完成（随 `667d2c5` 落码；⚠️ **领号未登记**——主表/头注均无此号，本行为事后补登） | 见详情 |
| WXG-T-149 | beads·失败续时 60→180 落码 + ref-video §10.7 勘误（用户 2026-09-17 拍板） | WorkBuddy 主会话 | ✅ 完成（systems-index v1.25 + tuning.ts src/cocos 双落 + 勘误；revive/timer 15/15 绿；⚠️ 全包另有 4 例存量红与本次无关，见详情） | 见详情 |
| WXG-T-150 | beads·G2′ 解环器归位落码（solver 归位动效三相） | 主理人(Qoder) | ✅ 完成（代码随 3ab5457 入库；369/369 绿；三裁定追认） | 见详情 |
| WXG-T-151 | beads·G4 探针 v2.0 适配复跑（满盘/24槽/组语义 54 组） | 严守真(qa) | ✅ 完成（终跑 79 组零崩溃 PASS 38/PASS* 23/FAIL 2/⛔16；BD-49 登记+报告 v2.0 §27；FAIL 均移交：BD-49 落码单待立、§8-9 回写待裁定） | 见详情 |
| WXG-T-152 | beads·G7 不可填格轻压+sfx_denied 音频原子批落码（T-128 ③） | 主理人(Qoder) | ✅ 完成（随 `7fc1c8a` 入库；⚠️ 初误占 151 撞 QA 号已改领；387/387 绿） | 见详情 |
| WXG-T-153 | beads·G6 结算彩带落码（零 RNG 44 枚 sandwich，T-128 ④） | 主理人(Qoder) | ✅ 完成（随 `7fc1c8a` 入库；401/401 绿；⚠️ scratch 契约 + 公式方向「飘落」矛盾两项登记待 art 复验，见 §1.6.6 回写注） | 见详情 |
| WXG-T-154 | beads·BD-49 道具音频断链修复（T-151 移交） | 主理人(Qoder) | ✅ 完成（handler 改读 affectedCells+夹具订正；409/409 绿；探针复跑 A05-07→PASS 无新回归；未 commit） | 见详情 |
| WXG-T-155 | 工具·check:a11y 锚点机械守卫（防假绿） | 主理人(Qoder) | ✅ 完成（锚点表×2+脚本挂 verify；正/反向实测均成立；B2 漂移新登 backlog；未 commit） | 见详情 |
| WXG-T-157 | beads·组选收窄 + board 锚直填落码（8向两步同色/逐颗续填，用户三项裁定） | 主理人(CodeBuddy) | ✅ 完成（415/415 绿；verify PASS 16/FAIL 0；GDD input-control v2.2 + bead-grid 代落盘待正主复验；未 commit） | 见详情 |
| WXG-T-161 | 框架·微信触摸逆变换公式勘误（BD-48 真因） | 主理人(CodeBuddy) | ✅ 落码（framework 299/299 绿；sync 一致；随 `706e99f` 入库；**待真机复测**；根配置 AppID 待处置项已随 `2f62027` 闭合） | 见详情 |
| WXG-T-158 | beads·托盘同色归类+组选+批量填充落码（用户四项裁定） | 主理人(Qoder) | ✅ 完成（落码+测试+GDD 回写；verify 16 项 PASS 2026-09-18） | 见详情 |
| WXG-T-159 | breakout 配色双轨漂移定性对账（backlog B2 项） | 主理人(CodeBuddy) | ✅ 完成（对账完成：砖块色全对齐 / UI 场景色零重合；用户裁定 **C 维持登记 ⛔**，两侧不动） | 见详情 |
| WXG-T-160 | 装置自测 fast 档挂 verify（BD-39/BD-40 本地半边） | 主理人(CodeBuddy) | ✅ 完成（两处根因定位并修：`verify:selftest` 第 5 步 SKIP 子串误判 + `ctx:check` vendor 环境缺失误判红；隔离 worktree 实测 8/8 绿；verify 17 项 PASS） | 见详情 |
| WXG-T-162 | beads+框架·真机五项修复（SFX 离线渲染/组选全连通/直填放距/乙档缝宽/同心圆角） | 主理人(Qoder) | ✅ 落码（随 `79f217a` 入库，与 T-164 交织文件合笔；**待真机复验**） | 见详情 |
| WXG-T-163 | beads·主菜单+元游戏页族程序结构设计（B 壳双对象/分批 0-1-2，用户四项拍板） | 主理人(Qoder)+程基岩 | ✅ 完成（草稿零落盘、结构拍板；反转冻结与实现归 T-164） | 见详情 |
| WXG-T-165 | beads·真机首验反馈修复批（白环移除 + 回主菜单弃本局棋盘，§3.14 反转） | 主理人(Qoder) | ✅ 已落码待重建复验（代码+文档同批，beads 455 绿，sync/links 绿；待 build:cocos 重建进真机） | 见详情 |
| WXG-T-156 | beads·BD-50 Cocos rgba 色彩解析纯黑缺陷修复 | 主理人(Qoder) | ✅ 完成（随 `b177151` 入库；parseColorLiteral 收口+burst v2.1 重拍 G6 8/8+G3 5/5；差异②已裁定关闭见 §1.6.6） | 见详情 |
| WXG-T-168 | beads·取回落槽口径改写（点槽定落位 + 部分收纳·就近优先，推翻 WXG-T-158 裁定①） | 主理人(CodeBuddy) | ✅ 落码（代码+三文回写+判据；beads 460/460 绿、verify 17/17 PASS；待真机复验） | 见详情 |
