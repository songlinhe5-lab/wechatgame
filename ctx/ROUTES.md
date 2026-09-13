# 上下文路由表（ctx/ROUTES.md）

> **给 agent 的第一跳**：开工前先读本表，命中锚点后用 `read_file(path, offset, limit)` 只取该节，
> **不要**再对大文件做无条件全文 Read。
> 锚点写法 = `路径#小节标题`，与 `ctx/index.json` 的 `anchor` **一一对应**（可 `pnpm run ctx:build` 重建）。
> **整文件（非锚点）引用**：指「只给路径、不给小节」的路由，须在该行**行尾**标注 `<!-- no-anchor -->`
> 显式豁免锚点校验；`pnpm run ctx:check` 的 **D 项**会逐条校验 `路径#锚点` 是否在索引中可命中，
> 未标注豁免的整文件引用会被判失败。
> 「估算 token」为**粗略值**（CJK≈1/字、ASCII≈1/4 字符），仅用于取舍；准确行区间以 `ctx/index.json` 为准。

### 量化与自证（本表的效果由「分层上下文节省装置」实测，WXG-T-026）

> ① **估算口径**：本表与装置涉及的 token 一律为**估算**（CJK≈1/字、ASCII≈1/4 字符，
> 见 `tools/scripts/lib/context-tokens.mjs`），**非**精确 tokenizer，仅用于排行与阈值护栏。
> ② **数据来源**：本机 IDE 会话转录（Cursor / WorkBuddy）→ 读事件账本 `ctx/reads-ledger.jsonl`
> （**仅元数据**：path/offset/limit/行数/字节/估算 token，**绝不落正文**；仓库外路径丢弃）。
> 采集需**本机会话文件**：`pnpm run ctx:reads`。
> ③ **如何复算**：`pnpm run ctx:usage` → 分布 `ctx/usage-distribution.json`（聚合指标）+ 人读报告
> `ctx/reads-summary.md`；报表 `ctx/BUDGET.md §4` 与门禁 `pnpm run ctx:check`（E 项）均消费该分布。
> ④ **基线如何更新**：`pnpm run ctx:check -- --update-baseline --reason="…" --task-id="WXG-T-…"`
> （更新 `ctx/savings-baseline.json`，**必须**写明 `reason` 与 `taskId`；缺字段视为配置错误）。
> ⑤ **去重口径限制**：账本按 `(ide,session,path,offset,limit)` **去重**——**抖动指标只反映不同区间的小读，
> 同区间重复读已被去重合并**；故 E2 抖动计数为**下界**，护栏强度弱于字面，读者勿高估。
> ⑥ **埋点能力与接入调研**：`docs/agent/context-instrumentation-survey.md`（四 IDE read 事件埋点能力矩阵；
> **本轮不改任何 IDE 配置**，接入属后续独立任务）。
> ⑦ **门禁语义分层（主理人裁定 WXG-T-026，2026-09-12）**：**结构门硬**——A 常驻预算 / B 单文件上限 /
> C 索引新鲜度 / D ROUTES 锚点 / **E3 基线回归**（劣于基线即 `FAIL` 阻断）；**行为门软（报告项）**——
> **E1 节省率**（局部读中位数 ≥70%、P10 ≥40%）与 **E2 护栏**（抖动组数、大文件整文件读次数）
> **如实展示 ❌ 与数字但不阻断 CI**，理由：行为指标取决于历史会话分布，不应作为无关 PR 的合并硬门。
> ⑧ **观察目标（非门）**：当前实测（457 读事件 / 20 会话，估算）为 E1 局部读中位数 **75.1% ✅**、
> **P10 30.0% ❌**、整体分布加权 **38.5%**、抖动 **9 组/26 次**、大文件整文件读 **65 次**；
> **阶段观察目标**：P10 ≥ 40%、抖动组 ≤ 5、大文件整文件读 ≤ 30（收敛手段见后续「压缩整文件读」任务）。
> ⑧·补 **样本代表性边界（WXG-T-026 复验 F-01/F-02）**：上述实测**仅来自 2 个根会话**——Cursor 根 `6f7a9a03…`（163 读 / 35.7%）+ WorkBuddy 根 `d2983589…`（294 读 / 64.3%），其余 18 条为**子代理**；且 **WorkBuddy 根为进行中的活动会话**（边写边采、样本非平稳、**重跑即漂移**，故 E2/E3 的抖动与大文件判定已改用**比率口径**）。**单仓库、非独立重复采样 → 不可外推**到「一般 agent 工作流」；明细见 `ctx/reads-summary.md`。
> ⑨ **索引新鲜度契约（WXG-T-026，2026-09-12）**：`ctx/index.json` 描述的是**已提交内容（HEAD）**——
> dirty（有未提交改动 / 未跟踪）文件按 **HEAD blob** 参与哈希与行数计算，未跟踪的**新文件不入索引**。
> 因此 CI（干净检出）恒绿；但**本地 dirty 文件的行号可能与索引漂移**（索引描述已提交内容，不描述你的
> 未提交改动），提交后重跑 `pnpm run ctx:build` 即对齐。逃生阀 `--working-tree`（生成器与门禁均支持）
> 强制按工作树内容，输出会标注「非默认模式」。

## 0. 上下文读取协议（强制）

1. 读本表 → 命中**精确锚点**（文件 + 小节标题）。
2. 到 `ctx/index.json` 查该锚点的 `startLine` / `endLine`。
3. `read_file(path, offset=startLine, limit=endLine-startLine+1)` —— **只取这一节**。
4. 仅当需「**逐字精确**」（改判据 / 抄常量 / 引用原文）时，才扩读相邻节；否则摘要足够。
5. 同一会话对同一文件反复小读 **超过 3 次** → 合并为**一次扩读**（连同命中节一起取整段）。

**反模式（禁止）**：
- ❌ 对 `systems-index.md` / `control-manifest.md` / `test-cases.md` / `architecture-beads.md` 等大文件无条件 `read_file(全文)`。
- ❌ 为找一句常量而整文件加载 —— 先查锚点。
- ❌ 同一文件边读边改、来回小读超过 3 次（上下文抖动）。
- ✅ 锚点命不中 → 索引可能漂移，重跑 `pnpm run ctx:build` 后再查。

## 1. 路由表

### 1.1 项目入口与铁律（AGENTS.md 骨架 + docs/agent/ 迁出文件，WXG-T-032）

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| 项目是什么 / 平台与引擎策略 | AGENTS.md#§1 项目是什么 | 173 | |
| 默认怎么干活（路由表 + 触发条件） | AGENTS.md#§2 默认怎么干活（路由表） | 351 | 细节见下行 routing.md |
| 工程铁律 L1–L5（摘要） | AGENTS.md#§3 不可违反的工程铁律 | 277 | 完整表见下 §1.4 |
| 冲突裁决与数值真源 | AGENTS.md#§4 冲突裁决与数值真源 | 139 | §3 冻结常量唯一真源 |
| 目录与产物落位 | docs/agent/repo-layout.md#§目录与产物落位 | 390 | 自 AGENTS.md §5 逐字迁出 |
| 验证与常用命令 | docs/agent/commands.md#§验证与常用命令 | 298 | verify 全量门禁 |
| 协作纪律 | AGENTS.md#§7 协作纪律 | 177 | 先问再写 |
| skill 优先级 / 四 IDE 路径细节 | docs/agent/routing.md#§Skill 优先级（冲突时高者胜） | 547 | 自 AGENTS.md §2 迁出（整文件） | <!-- no-anchor -->
| 知识库摘要（AGENTS 保留） | AGENTS.md#§9 知识库与调用透明（WXG-T-023 摘要） | 117 | kb:sync 统计必摘 |
| 知识库读取协议 | knowledge/INDEX.md#§1 读取协议（开发前期） | 109 | 开工前同域先读 |
| 知识库写入协议 | knowledge/INDEX.md#§2 写入协议（任务收尾） | 469 | 沉淀候选 0–3 条 |
| 知识库生命周期 | knowledge/INDEX.md#§5 生命周期（访问记账 → 归档 → 重新激活） | 674 | 含 5.1–5.3 |

### 1.2 冻结数值（hot · games/beads/design/gdd/systems-index.md）

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| 整个 §3 冻结令 | games/beads/design/gdd/systems-index.md#§3 全局数值基线（Global Constants）· ❄️ 冻结令 | 2871 | 只在需整组时取 |
| 画布 / 坐标 / 安全区 / 布局带 | games/beads/design/gdd/systems-index.md#§3.1 画布、坐标、安全区与布局带 | 316 | DESIGN_W/H、各带 |
| 色板与图案字符集 | games/beads/design/gdd/systems-index.md#§3.2 色板与图案字符集 | 235 | BEAD_CHARSET |
| 珠子网格 | games/beads/design/gdd/systems-index.md#§3.3 珠子网格（Bead Grid） | 229 | |
| 槽位托盘 | games/beads/design/gdd/systems-index.md#§3.4 槽位托盘（Tray） | 219 | |
| 倒计时与失败 | games/beads/design/gdd/systems-index.md#§3.5 倒计时与失败 | 182 | |
| 道具常量 | games/beads/design/gdd/systems-index.md#§3.6 道具（Powerups） | 230 | |
| **星级与结算** | games/beads/design/gdd/systems-index.md#§3.7 星级与结算 | 137 | STAR3/2_RATIO（最常用） |
| 可访问性 | games/beads/design/gdd/systems-index.md#§3.8 可访问性（对齐 art-bible §3.3 与工作室 Standard 级） | 256 | |
| 包体预算 | games/beads/design/gdd/systems-index.md#§3.9 包体预算 | 107 | |
| **冲刺常量组** | games/beads/design/gdd/systems-index.md#§3.10 冲刺模式（Sprint）· 2026-09-12 用户拍板冻结（WXG-T-020） | 440 | C1–C8 |
| 系统清单 | games/beads/design/gdd/systems-index.md#§1 系统清单 | 445 | S1–S9 |
| 依赖拓扑序 | games/beads/design/gdd/systems-index.md#§2 依赖排序（Dependency Order） | 408 | 实现顺序 |
| 事件总线约定 | games/beads/design/gdd/systems-index.md#§4 事件总线约定（供程序落码参考） | 465 | 13+4 事件 |
| 与框架层接口假设 | games/beads/design/gdd/systems-index.md#§5 与框架层的接口假设 | 320 | |
| 变更记录（值何时冻结） | games/beads/design/gdd/systems-index.md#§6 变更记录 | 1200 | 追溯依据 |

### 1.3 架构（hot）

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| 分层与依赖方向 | docs/architecture/architecture.md#§2 分层与依赖方向 | 1074 | 主架构 |
| core 模块职责表 | docs/architecture/architecture.md#§3 模块职责表（core） | 505 | |
| 数据流（一帧） | docs/architecture/architecture.md#§4 数据流（一帧） | 343 | |
| 包体预算分配 | docs/architecture/architecture.md#§5 包体预算分配（微信小游戏） | 498 | |
| 构建链 | docs/architecture/architecture.md#§6 构建链 | 516 | |
| 9 系统 → 模块映射 | docs/architecture/architecture-beads.md#§2 9 系统 → 框架模块映射（systems-index §5 逐条对账） | 723 | |
| beads 目录结构 | docs/architecture/architecture-beads.md#§3 `games/beads/src` 目录结构 | 541 | 锚点含反引号 |
| 渲染层方案 | docs/architecture/architecture-beads.md#§4 渲染层方案（ADR-0005 摘要） | 391 | |
| **事件装配图** | docs/architecture/architecture-beads.md#§5 事件装配图（systems-index §4 全部 13 事件） | 505 | 最常用 |
| BOOT 装配与关卡流 | docs/architecture/architecture-beads.md#§6 BOOT 装配与关卡加载流 | 371 | |
| 激励视频占位 | docs/architecture/architecture-beads.md#§7 激励视频占位（ADR-0006 摘要） | 249 | |
| beads 风险登记册 | docs/architecture/architecture-beads.md#§8 风险登记册（beads 增量） | 310 | |
| beads 实现状态 | docs/architecture/architecture-beads.md#§9 当前实现状态 | 119 | |

### 1.4 工程细则（hot · docs/architecture/control-manifest.md）

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| **五条铁律 L1–L5（完整）** | docs/architecture/control-manifest.md#§0 五条铁律（违反 = 直接打回） | 253 | 评审逐条打回 |
| 热路径零分配 | docs/architecture/control-manifest.md#§2 热路径零分配 | 261 | |
| 数据驱动，不硬编码 | docs/architecture/control-manifest.md#§3 数据驱动，不硬编码 | 155 | |
| 事件是通知，不是状态 | docs/architecture/control-manifest.md#§4 事件是通知，不是状态 | 164 | |
| 存档 | docs/architecture/control-manifest.md#§5 存档 | 134 | |
| 输入 | docs/architecture/control-manifest.md#§6 输入 | 102 | |
| 状态机 | docs/architecture/control-manifest.md#§7 状态机 | 115 | |
| 渲染 / 坐标系 | docs/architecture/control-manifest.md#§8 渲染 | 185 | 原点左下 |
| 平台差异 | docs/architecture/control-manifest.md#§9 平台差异 | 89 | |
| 提交前自查表 | docs/architecture/control-manifest.md#§12 提交前自查表 | 159 | |
| 反模式速查 | docs/architecture/control-manifest.md#§13 反模式速查（见到就打回） | 273 | |
| Cocos MCP 接入（ADR-0009） | docs/architecture/control-manifest.md#§14 Cocos MCP 编辑器接入（ADR-0009） | 448 | |

### 1.5 QA 判据（hot · production/qa/beads/test-cases.md）

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| 硬判据总表（50 条） | production/qa/beads/test-cases.md#§A 硬判据用例（50 条 = 5 组 × 10，判据 1:1 映射） | 2507 | |
| A1 核心循环判据 | production/qa/beads/test-cases.md#§A1 · 核心循环（S1）— 来源 `core-loop.md §8.1..10` | 526 | |
| A2 拼图网格判据 | production/qa/beads/test-cases.md#§A2 · 拼图网格与填色（S3）— 来源 `bead-grid.md §8.1..10` | 480 | |
| A3 供料托盘判据 | production/qa/beads/test-cases.md#§A3 · 供料与托盘（S4）— 来源 `tray-spawner.md §8.1..10` | 450 | |
| A4 输入操控判据 | production/qa/beads/test-cases.md#§A4 · 输入与操控（S2）— 来源 `input-control.md §8.1..10` | 449 | |
| A5 倒计时判据 | production/qa/beads/test-cases.md#§A5 · 倒计时与失败（S5）— 来源 `timer-gameover.md §8.1..10` | 502 | |
| **派生用例** | production/qa/beads/test-cases.md#§B 派生用例（来源 systems-index §3 / accessibility.md，无 §8 编号，标注来源） | 825 | 来源标注 |

### 1.6 任务台账与长期记忆（hot）

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| 领号 / 任务台账 | production/TASKS.md#§WXG 任务台账（SSOT） | 1439 | **开工先领号** |
| 已知限制 | memory/MEMORY.md#§已知限制 | 80 | |
| 常用脚本 | memory/MEMORY.md#§常用脚本 | 197 | |
| 项目约定 | memory/MEMORY.md#§项目约定 | 460 | |
| SubAgent 备忘 | memory/MEMORY.md#§SubAgent | 65 | |
| Headless / CI 备忘 | memory/MEMORY.md#§Headless / CI | 143 | |

### 1.7 Skill / Agent / 知识库 / 门禁

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| Skill 家族清单与优先级 | my-skills/INDEX.md#§1 清单（现役 17 个挂四 IDE 链接；存档 1 个仅本目录留档） | 631 | |
| Skill 优先级链 | my-skills/INDEX.md#§3 Skill 优先级（冲突时高者胜） | 63 | |
| 路径约定 | my-skills/INDEX.md#§4 路径约定 | 208 | |
| 九阶段（0–8）流水线 | my-skills/wxgame-orchestration/SKILL.md#§九阶段（0–8）流水线 | 528 | |
| spawn 八要素模板 | my-skills/wxgame-orchestration/SKILL.md#§Spawn 任务模板（每个成员任务必含八要素） | 244 | |
| 成员 → skill 路由表 | my-skills/wxgame-orchestration/SKILL.md#§成员 → Skill / SubAgent 路由表（硬表，spawn 前必查） | 544 | |
| 质量门判定 | my-skills/wxgame-orchestration/SKILL.md#§质量门判定（阶段切换处触发） | 284 | PASS/CONCERNS/FAIL |
| SubAgent 清单 | my-agents/INDEX.md#§现役成员（6）+ 编排（1） | 264 | |
| 跨 IDE 常驻规则摘要 | my-rules/agents-md.md（整文件，always-on） | 327 | | <!-- no-anchor -->
| Hooks / 提交门禁 | docs/agent/hooks-best-practices.md#§2 启用 Git hooks（每人 / 每 clone 一次） | 121 | |
| Cursor Hooks 实践清单 | docs/agent/hooks-best-practices.md#§4 Cursor Hooks 实践清单 | 357 | |
| Headless / PR 流水线拓扑 | docs/agent/headless-ci-pr-review.md#§3 流水线分层（推荐拓扑） | 261 | |
| PR 审查硬判据 | docs/agent/headless-ci-pr-review.md#§6 审查判据（写入 prompt 的硬约束） | 230 | |
| 教训库（同域先读） | knowledge/lessons.md（整文件） | 964 | 追加式 | <!-- no-anchor -->
| 可复用模式库 | knowledge/patterns.md（整文件） | 711 | 追加式 | <!-- no-anchor -->

## 2. 维护

- 本表锚点须与 `ctx/index.json` 的 `anchor` 一致；改任一被索引 `.md` 的标题后，重跑 `pnpm run ctx:build`
  并用 `pnpm run ctx:check` 验证（C 项会点名过期文件）。
- 只增补行、不删既有锚点；废弃锚点标 `[已过时]`。
- 单页约束：**≤150 行**（当前行数见文件末尾）。
