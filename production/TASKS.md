# WXG 任务台账（SSOT）

> 单号递增不回收。任何会话（WorkBuddy/Cursor/Qoder/CodeBuddy）开工前**先读本文件领号**，完成后回填状态——根治跨 IDE 撞号（教训：2026-09-12 CodeBuddy 独立会话撞用 T-013/T-014）。
> 建档：2026-09-12，主理人游承峰。当前已分配至 **WXG-T-032**，下一可用号 **WXG-T-033**。ADR-0008 编号已为「每日挑战本地确定性派生 ADR」预约（未落盘，每日挑战专项立项时使用，跳空合规）；ADR-0009 = Cocos MCP 编辑器接入（已落盘）。

| Task ID | 名称 | 负责 | 状态 | 产出 |
|---|---|---|---|---|
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
| WXG-T-032 | CI 解锁 + 拦截前移 + AGENTS.md 瘦身拆分：① 重建索引解锁 develop C 门 ② `memory/2026-09-12.md` 登记 B 门豁免（追加式日记）③ `ctx:check --staged`（校验暂存区内容）挂入 pre-commit（把「改 md 未重建索引」的拦截从 CI 前移到本地提交前）④ AGENTS.md 按章节拆分瘦身（§5/§6/§9 迁出至 docs/agent/，目标 ≤1700 估算 tokens） | 主理人 + 程基岩 | 🔄 进行中（2026-09-13 领号） | ctx/budget-exempt.json · ctx/{index.json,BUDGET.md} · tools/scripts/check-context-budget.mjs · .githooks/pre-commit · AGENTS.md · docs/agent/{repo-layout,commands}.md · ctx/ROUTES.md |

> 注 1：T-016/T-017 的产出实际由 CodeBuddy 侧会话完成（用户授权路径），本台账为跨 IDE 统一追认。
> 注 2（第二次撞号追认）：CodeBuddy 会话后续又将 CI/CD 与 ADR-0009 误编为 016/017，已按 T-021/T-022 归位；其提交信息与任务单内嵌旧号不回改，以本台账为准。
> 注 3：多会话并行时领号纪律——开工前读本文件取「下一可用号」并立即回填占位，完成后再更新状态行。

## 待排（backlog，无号，立项时领取）

| 事项 | 来源 | 说明 |
|---|---|---|
| **净收益口径** | WXG-T-026 复验提出（严守真） | 现节省率是**毛节省**——未计入装置自身开销（`ctx/ROUTES.md` ≈3352 估算 tokens 常驻 + `ctx/index.json`）。需补「净节省」口径再下结论 |
| **压缩整文件读** | WXG-T-026 实测结论 | 整文件读占 **259/457（56.7%）**、大文件（≥3000 估算 tokens）整文件读 **65 次** → 拉低 P10（30.0%）。手段：`ROUTES.md §0` 增设「大文件禁止整文件读」硬约束 + 采新样本复测 P10（阶段目标 ≥40%） |
| **「到达序」判据残留清理（core-loop §6）** | WXG-T-031 主理人核对发现 | `core-loop.md` §6 仍有两处以「事件到达序 / 先到」为判定基准，在单线程固定步长循环内**不可观测、不可测**：①「道具清除与落子同帧争用同一颗托盘珠：以先到事件为准」；②「`level:cleared` 与 `level:failed` 同帧 → cleared 优先」落在**玩法事件子段内**，需补「玩法事件段内序」。**不在 T-031 处理**（S6 未落地、S1 已声明串行序权威，强行改写会扩大面）。待 S6 落地或需动 S1 时，连同已确立的「输入段内序 = 状态指令 → 玩法事件」一并补齐子段序后统一改写 |
| **IDE 埋点接入** | `docs/agent/context-instrumentation-survey.md` | 四 IDE 均有 read 埋点能力（Cursor `beforeReadFile` / 其余 `PreToolUse`），**offset/limit 均 `[待实测]`**；建议先对 Cursor 写 log-only hook 实测粒度，再评估推广 |
