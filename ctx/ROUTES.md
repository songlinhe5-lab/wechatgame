# 上下文路由表（ctx/ROUTES.md）

> **给 agent 的第一跳**：开工前先读本表，命中锚点后用 `read_file(path, offset, limit)` 只取该节，
> **不要**再对大文件做无条件全文 Read。
> **第二跳**：锚点 → `offset`/`limit` 换算查 `ctx/hot-files.md`（**热文件 + 本表引用到的文件 + 实测
> 热读/大文件**，人/agent 可直读；由 `pnpm run ctx:build` 生成）。本表引用到的文件**保证可查**
>（覆盖率硬门 D2）→ 少数落选者见该表末「未收录」小节 → 再退 `ctx/index.json`（全量，机器读）。
> 锚点写法 = `路径#小节标题`，与 `ctx/index.json` 的 `anchor` **一一对应**（可 `pnpm run ctx:build` 重建）。
> **整文件（非锚点）引用**：指「只给路径、不给小节」的路由，须在该行**行尾**标注 `<!-- no-anchor -->`
> 显式豁免锚点校验；`pnpm run ctx:check` 的 **D 项**会逐条校验 `路径#锚点` 是否在索引中可命中，
> 未标注豁免的整文件引用会被判失败。**估算口径与准确行区间**见下行摘要与 `ctx/index.json`。

### 装置契约摘要（全文 = 原 ①–⑫，见 `docs/agent/context-metrics-history.md` §5，WXG-T-379 迁出）

> **估算口径**：本表与装置 token 一律估算（CJK≈1/字、ASCII≈1/4；`tools/scripts/lib/context-tokens.mjs`），非精确 tokenizer。
> **索引新鲜度**：`ctx/index.json` 描述**已提交内容（HEAD）**——dirty 文件按 HEAD blob 算、未跟踪新文件不入索引，
> 故本地 dirty 时行号可能漂移；逃生阀 `--working-tree` 与暂存区 `--staged-blobs` **必须生成器与门禁成对使用**。
> **pre-commit 自动重建**：改被索引 `.md` 后直接提交即可（按暂存 blob 重建三产物并重新暂存，再 `ctx:check --staged` 兜底）；⛔ 不需要也禁止 `--no-verify`。手动 `ctx:build` 仅供本地预览（默认 = HEAD 锚定）。
> **门禁分层**：**结构门硬**——A 常驻预算 / B 单文件上限 / C 索引新鲜度 / D 锚点可命中 / **D2** 引用面覆盖 / **D3** 二跳可寻（U1–U3）/ E3 基线回归，断即 FAIL；**行为门软**——E1 节省率 / E2 抖动 / E4 净收益只报数不阻断（E1 须严格·宽松双列、零和两侧并报；`ctx/` 读事件为 0 时须出归因声明）。
> **三个上限**（单一真源 `tools/scripts/lib/context-index.mjs` 的 `residentLimit()`）：本表 `routesMd` **7500** / 第二跳 `hotFilesMaxTokens` **5600** / 常驻总量软阈 `residentTotalSoft` **13500**（观察哨，不阻断）。
> **超限处置 = 瘦身**（合并重复路由 / 删失效锚点 / 长说明移 docs）；⛔ 勿直接调大阈值（调阈须按程序留痕并同步文档）。

## 0. 上下文读取协议（强制）

1. 读本表 → 命中**精确锚点**（文件 + 小节标题）。
2. 到 `ctx/hot-files.md` 查该锚点的 `offset`/`limit`（行内格式 `锚点=offset+limit`，已算好）。
  - 本表引用的文件**保证可查**（**D2 硬门**）；只有「未收录」小节列出的才退 `ctx/index.json` 查 `startLine`/`endLine`（**勿**整读）。
3. `read_file(path, offset, limit)` —— **只取这一节**。
4. 仅当需「**逐字精确**」（改判据 / 抄常量 / 引用原文）时，才扩读相邻节；否则摘要足够。
5. 同一会话对同一文件反复小读 **超过 3 次** → 合并为**一次扩读**（连同命中节一起取整段）。

**反模式（禁止）**：
- ❌ 对 `systems-index.md` / `control-manifest.md` / `test-cases*.md` / `architecture-beads.md` 等大文件无条件 `read_file(全文)`。
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
| Cocos + MCP 安装引导（编辑器就绪前置） | docs/agent/cocos-setup.md#§2 七步总览（速查） | 232 | ADR-0009 落地；插件装全局（WXG-T-042） |

### 1.2 冻结数值（hot · games/beads/design/gdd/systems-index.md）

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| 整个 §3 冻结令 | games/beads/design/gdd/systems-index.md#§3 全局数值基线（Global Constants）· ❄️ 冻结令 | 2871 | 只在需整组时取 |
| 画布 / 坐标 / 安全区 / 布局带 | games/beads/design/gdd/systems-index.md#§3.1 画布、坐标、安全区与布局带 | 316 | DESIGN_W/H、各带 |
| 色板与图案字符集 | games/beads/design/gdd/systems-index.md#§3.2 色板与图案字符集 | 235 | BEAD_CHARSET |
| 珠子网格 | games/beads/design/gdd/systems-index.md#§3.3 珠子网格（Bead Grid） | 229 | |
| 槽位托盘 | games/beads/design/gdd/systems-index.md#§3.4 槽位托盘（Tray） | 219 | |
| 倒计时与失败 | games/beads/design/gdd/systems-index.md#§3.5 倒计时与失败 | 182 | |
| 道具常量 | games/beads/design/gdd/systems-index.md#§3.6 道具（Powerups）· v1.22 反转为解环器 | 230 | |
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
| **六条铁律 L1–L6（完整）** | docs/architecture/control-manifest.md#§0 六条铁律（违反 = 直接打回） | 352 | 评审逐条打回；L6 为 beads 内部依赖方向 |
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
| **UI 架构五条守则** | docs/architecture/control-manifest.md#§20 UI 架构守则（ADR-0032 §8；WXG-T-318 落表） | 400 | 弹窗 / 遮罩 / View / 布局 / 路由 |

### 1.5 QA 判据（hot · production/qa/beads/test-cases*.md，13 片；总索引 = `test-cases.md`）

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| 硬判据总表（50 条） | production/qa/beads/test-cases-a-core.md#§A 硬判据用例（50 条 = 5 组 × 10，判据 1:1 映射） | 2507 | ⚠ 锚点**不按条数裁**（裁即削掉判据/结论态节，WXG-T-293），控量走标题截断、D3-U1 保命中。**13 片总索引 = `production/qa/beads/test-cases.md` 的 §分片索引（WXG-T-225）** |
| A1 核心循环判据 | production/qa/beads/test-cases-a-core.md#§A1 · 核心循环（S1）— 来源 `core-loop.md §8.1..10` | 526 | |
| A2 拼图网格判据 | production/qa/beads/test-cases-a-core.md#§A2 · 拼图网格与填色（S3）— 来源 `bead-grid.md §8.1..10` | 480 | |
| A3 供料托盘判据 | production/qa/beads/test-cases-a-core.md#§A3 · 供料与托盘（S4）— 来源 `tray-spawner.md §8.1..10` | 450 | |
| A4 输入操控判据 | production/qa/beads/test-cases-a-input.md#§A4 · 输入与操控（S2）— 来源 `input-control.md §8.1..10` | 449 | |
| A5 倒计时判据 | production/qa/beads/test-cases-a-input.md#§A5 · 倒计时与失败（S5）— 来源 `timer-gameover.md §8.1..10` | 502 | |
| **派生用例** | production/qa/beads/test-cases-b-f.md#§B 派生用例（来源 systems-index §3 / accessibility.md，无 §8 编号，标注来源） | 825 | 来源标注 |

### 1.6 任务台账与长期记忆（hot）

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| 领号 / 任务台账 | production/TASKS.md#§WXG 任务台账（SSOT） | 2220 | **领号认工作树全局最大号，不止已提交头注**（K-046：并发号段只在工作树，照头注必撞）：`grep -oh 'WXG-T-[0-9]\{3\}' production/TASKS.md production/TASKS-DETAIL.md \| sed 's/.*WXG-T-//' \| sort -n \| tail -1` ⇒ +1；看**全部状态**才读主表（≈2.4k tok），详情只读命中节 |
| 任务**详情**（按需，勿整读） | production/TASKS-DETAIL.md#§WXG 任务台账 · 详情（标题制正文侧） | 单节 ≈ 290 | 一任务一节（`## WXG-T-0NN`）；**先用 `ctx/index.json` 查该节 `startLine`/`endLine`**，再 `read_file(path, offset, limit)` |
| **memory 日志摘要（先读这个）** | memory/INDEX.md | 6777 | 分级加载入口：主题行区间 + 体量 + **「详情」列** + 节首句摘要；`—` ⇒ 按行区间读日记那一节，非 `—` ⇒ 正文已外移，改读 `memory/details/<…>.md`（WXG-T-068 · 二级层 WXG-T-106） | <!-- no-anchor -->
| 已知限制 | memory/MEMORY.md#§已知限制 | 80 | |
| 常用脚本 | memory/MEMORY.md#§常用脚本 | 197 | |
| 项目约定 | memory/MEMORY.md#§项目约定 | 460 | |
| SubAgent 备忘 | memory/MEMORY.md#§SubAgent | 65 | |
| Headless / CI 备忘 | memory/MEMORY.md#§Headless / CI | 143 | |

### 1.7 Skill / Agent / 知识库 / 门禁

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| Skill 家族清单与优先级 | my-skills/INDEX.md#§1 清单（现役 38 个挂四 IDE 链接；存档 1 个仅本目录留档） | 631 | |
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
| 教训库（同域先读） | knowledge/lessons.md（**指针页**：标签 → 分片表） | 350 | 条目正文在 `knowledge/lessons/<标签>.md`；ID → 分片查 `knowledge/INDEX.md` 活跃表「分片」列；引用只写 K-0NN <!-- no-anchor --> |
| 可复用模式库 | knowledge/patterns.md（整文件） | 711 | 追加式 | <!-- no-anchor -->

### 1.8 AI 生图选型（hot · games/beads/design/ai-workflows/model-matrix.md）

| 意图 / 需要什么 | 精确锚点（文件#章节） | 估算 token | 备注 |
|---|---|---:|---|
| 四方向用哪个模型 / 云还是本地 | games/beads/design/ai-workflows/model-matrix.md#§1 四方向首选矩阵 | 679 | 选型裁定正本；数值仍服从 systems-index §3 |
| 这条路能不能走（排除项） | games/beads/design/ai-workflows/model-matrix.md#§3 排除项（含理由，勿重走） | 204 | 含价目 §2 |
| 判据能用哪些 / 已作废哪些 | games/beads/design/ai-workflows/model-matrix.md#§4 判据纪律（哪些能排序，哪些不能） | 319 | 种子噪声洗牌类判据禁用 |
| 本地 ComfyUI 能力边界 | games/beads/design/ai-workflows/model-matrix.md#§5 本地 ComfyUI 能力边界（2026-10-12 权重清单实证） | 1640 | 节点存在 ≠ 权重存在；分割/抠图三路不合用；现有底座 RGBA 但 alpha 无语义 |
| 要下哪些权重（待授权清单） | games/beads/design/ai-workflows/model-matrix.md#§6 未决与下一步 | 1985 | §6.1：只建议 SAM3.1 fp16 <2GB（`CheckpointLoaderSimple` 驱动）；GD/ControlNet/Layered/超分 均不下；显存顶 11.8GB |

## 2. 维护

- 本表锚点须与 `ctx/index.json` 的 `anchor` 一致；改任一被索引 `.md` 的标题后，重跑 `pnpm run ctx:build`
  并用 `pnpm run ctx:check` 验证（C 项会点名过期文件）。
- 只增补行、不删既有锚点；废弃锚点标 `[已过时]`。
- 体积约束：本表是**协议常驻开销**（计入应然净收益）；其体积由 `ctx:usage` 如实计入报表，
  **不再单独卡行数**（原「≤150 行」目标已让位给**引用面完整性**——由硬门 D2 守住）；
  **token 硬上限 `LIMITS.routesMd` = 7500**（`ctx:check` A 项守住；沿革见 `docs/agent/context-metrics-history.md` §5 ⑫）。
