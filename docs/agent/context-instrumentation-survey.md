# 四 IDE「read 事件埋点」能力调研（WXG-T-026 ⑤）

> **范围声明**：本文**只调研、不改配置**。四 IDE 的 hook 事件名、能否拿到 `path + offset/limit`、
> 配置位置、是否需用户授权、跨平台限制，逐项给出**取证来源**；无法确认者一律标 `[待实测]`，
> **禁止编造 hook 名**。埋点接入是**后续独立任务**的决策，本轮**不修改任何 IDE 配置**。
>
> 取证方式：只读本机配置目录（`~/.cursor/`、`~/.codebuddy/`、`~/.workbuddy/`、`~/.qoder/`）
> 与仓库内 `.cursor/`，以及随 IDE 分发的官方 hook 文档/技能。
>
> 关联：采集器 `tools/scripts/collect-context-reads.mjs`（现采 Cursor / WorkBuddy **转录**，
> 非 hook）；协议说明见 `ctx/ROUTES.md` 头部。

---

## 1. 能力矩阵（速览）

| 维度 | Cursor | CodeBuddy | WorkBuddy | Qoder |
|---|---|---|---|---|
| 支持 agent 生命周期 hooks | ✅ | ✅ | ✅（同源引擎，见注） | ✅ |
| 配置文件位置 | 项目 `.cursor/hooks.json` / 用户 `~/.cursor/hooks.json` | 用户/项目 `.codebuddy/settings.json`（直写）或插件 `hooks/hooks.json`（包裹 `{"hooks":{…}}`） | `.workbuddy/settings.json`（格式同 CodeBuddy）`[待实测]` | settings 文件注册（官方 `hooks` 段）`[待实测]` 具体文件 |
| 读文件事件 | ✅ `beforeReadFile`（matcher `Read`/`TabRead`）；或 `preToolUse`/`postToolUse` matcher=`Read` | ✅ `PreToolUse`/`PostToolUse` matcher=`Read` | ✅ 同 CodeBuddy | ✅ `PreToolUse` matcher=`Read` |
| 能拿到 **path** | ✅（hook 载荷含 tool input 路径） | ✅（`.tool_input.file_path`） | ✅（同 CodeBuddy）`[待实测]` | ✅（`.tool_input`）`[待实测]` 键名 |
| 能拿到 **offset/limit** | 🔬 **探针已部署、待一次实测**（`beforeReadFile` 载荷字段未在随附文档列明；log-only 探针见 §3.1 末） | `[待实测]`（Read 工具 input 是否含 offset/limit） | `[待实测]` | `[待实测]` |
| 需用户授权/信任 | ✅ hooks 受信任管理；`failClosed` 可选 | ✅ 插件 hook 随插件启用；用户设置 hook 需信任 | ✅（同 CodeBuddy） | ✅（官方 hook 需在设置注册） |
| 跨平台 | ✅（命令 hook；用 node 脚本即可） | ✅（node/python/bash；$CODEBUDDY_PLUGIN_ROOT） | ✅（同 CodeBuddy） | ✅（官方建议 node/python 替代 bash+jq） |
| 仓库现状 | `.cursor/hooks.json` **已启用**（`beforeShellExecution` + `preToolUse`；**读事件探针** `beforeReadFile` 已于 WXG-T-036 q-3 加装，log-only） | 无 hooks | 无 hooks | 无 hooks |
| 本单现有采集 | 转录 `agent-transcripts/**/*.jsonl`（tool_use Read，含 offset/limit） | 无 | 转录 `<slug>/**/*.jsonl`（function_call Read） | 转录无工具级细节（故未采集） |

> 注：WorkBuddy 与 CodeBuddy 共用插件市场 `codebuddy-plugins-official`，且插件 hooks 使用同一
> `hooks.json` 形态与 `${CODEBUDDY_PLUGIN_ROOT}` 变量（见 §3.3 取证），故判定为**同源 hook 引擎**。

---

## 2. 需求对齐：装置要什么

分层上下文节省装置（WXG-T-026）需要「**每次读文件的 path + 行区间**」来算
「锚点式局部读占比 / 单次节省率 / 抖动 / 大文件整文件读」。其中 **offset/limit 是关键**——
没有它就分不清「整文件读」与「锚点局部读」。这就是本调研的验收焦点。

---

## 3. 逐家取证

### 3.1 Cursor

- **事件清单**（权威，取自本机 `~/.cursor/skills-cursor/create-hook/SKILL.md`）：
  `sessionStart` / `sessionEnd` / `preToolUse` / `postToolUse` / `postToolUseFailure` /
  `subagentStart` / `subagentStop` / `beforeShellExecution` / `afterShellExecution` /
  `beforeMCPExecution` / `afterMCPExecution` / **`beforeReadFile`** / `afterFileEdit` /
  `beforeSubmitPrompt` / `preCompact` / `stop` / `afterAgentResponse` / `afterAgentThought`；
  Tab 事件：`beforeTabFileRead` / `afterTabFileEdit`。
- **读埋点最优解**：`beforeReadFile`，文档明确其 matcher 匹配 `Read` 或 `TabRead`。次选
  `preToolUse` / `postToolUse`，matcher 匹配工具类型（含 `Read`）。
- **path**：仓库既有 `.cursor/hooks/pre-tool-use.mjs` 从 stdin JSON 的
  `input.tool_input ?? input.arguments ?? input.input` 提取 `path/file_path/filePath/target_file`
  ——证明 **preToolUse 载荷可拿到路径**。`beforeReadFile` 的载荷字段 `[待实测]`。
- **offset/limit**：`[待实测]`（随附文档只列 matcher，不列载荷字段；需写一个 log-only hook 跑一次读，
  观察 stdin JSON 是否含 `offset`/`limit`）。
  - **🔬 探针已部署（WXG-T-036 q-3，2026-09-13）**：`.cursor/hooks/before-read-file.mjs`，
    已注册进 `.cursor/hooks.json` 的 `beforeReadFile`（matcher `Read|TabRead`，`failClosed:false`）。
    设计为**零风险 log-only**：恒返回 `{"permission":"allow"}`（坏 JSON / 异常也放行）、
    **不写** `ctx/reads-ledger.jsonl`（不碰采集口径）、日志只记**键名/类型/长度**且正文键一律
    `<redacted>`、超 1MB 自动截断，落 `.cursor/hooks/.read-probe.jsonl`（已 gitignore）。
    自测（注入三组合成载荷）已通过：区间字段识别 ✅ / 坏 JSON 仍放行 ✅ / 正文未落盘 ✅。
    **待办**：在 Cursor 发起一次**带 offset 的读**后读该日志——
    `hasRange:true` → 可拿精确区间；`hasRange:false` → 只能拿 `path`（结论回填本表与 §4）。
- **配置位置**：项目 `.cursor/hooks.json`（本仓已存在）+ `.cursor/hooks/*`；用户 `~/.cursor/hooks.json`
  （本机**不存在**）。项目 hook 相对项目根、用户 hook 相对 `~/.cursor/`。
- **授权**：hook 有信任管理；`failClosed: true` 可在崩溃/超时/坏 JSON 时阻断。改 `hooks.json` 自动热载。
- **跨平台**：命令 hook 由 shell 执行；用 `node` 脚本可 macOS/Linux/Windows 一致。

### 3.2 CodeBuddy

- **事件清单**（随附文档 `…/plugin-dev/skills/hook-development/SKILL.md`）：
  `PreToolUse` / `PostToolUse` / `Stop` / `SubagentStop` / `SessionStart` / `SessionEnd` /
  `UserPromptSubmit` / `PreCompact` / `Notification`。
- **配置格式**：用户/项目 `.codebuddy/settings.json` 用**直写**格式（事件在顶层）；
  插件 `hooks/hooks.json` 用**包裹**格式 `{ "hooks": { … } }`。
- **载荷**（取自同目录 `references/advanced.md` / `patterns.md` 的官方示例）：
  stdin JSON，字段如 `.tool_input.command`、`.tool_input.file_path`、`.tool_input.content`；
  另有 `$TRANSCRIPT_PATH`、`$TOOL_INPUT` 变量。**⇒ path 可得**。
- **读埋点**：`PreToolUse`/`PostToolUse` matcher 设为读工具名（`Read` / `read_file` `[待实测]` 具体名）。
- **offset/limit**：`[待实测]`（需实测 Read 工具 input 是否带 offset/limit）。
- **现状**：本机 `.codebuddy/settings.json` 只有 `enabledPlugins`，**未配置任何 hooks**。

### 3.3 WorkBuddy

- **判定：与 CodeBuddy 同源 hook 引擎**。取证：
  `~/.workbuddy/plugins/marketplaces/codebuddy-plugins-official/plugins/security-guidance/hooks/hooks.json`
  使用 `{"hooks":{"PreToolUse":[{"matcher":"Edit|Write|MultiEdit", …}]}}` 形态，
  且命令用 `${CODEBUDDY_PLUGIN_ROOT}` 变量——与 CodeBuddy 插件 hooks **逐字同形**。
- **事件/载荷**：沿用 CodeBuddy 事件集与 `.tool_input.*` 载荷 `[待实测]`（未直接观察 WorkBuddy 运行时）。
- **配置位置**：`.workbuddy/settings.json`（本机存在，但仅含 `enabledPlugins`/`sandbox`/`claw`/`env`/`subagents`，
  **未配置 hooks**）；是否在该文件接受 hooks 段 `[待实测]`。
- **既有采集**：转录 `<slug>/**/*.jsonl` 的 `function_call`（name=`Read`，`arguments` 为 JSON 字符串，
  键 `file_path`）已被 `collect-context-reads.mjs` 采到——**当前 WorkBuddy 的数据来自转录，非 hook**。

### 3.4 Qoder

- **事件清单**（官方副本，取自 `~/.qoder/plugins/cache/qoder-bundler/better-harness/references/agent-customize/platforms/qoder.md`）：
  `PreToolUse`（matcher 如 `Bash`、`mcp__.*`）/ `PostToolUse`（matcher 如 `Write | Edit`）/
  `PostToolUseFailure` / `UserPromptSubmit` / `Stop`。官方文档：https://docs.qoder.com/extensions/hooks 。
- **载荷**：stdin JSON，示例取 `.tool_name`、`.tool_input.command`；输出 `hookSpecificOutput`
  （`hookEventName`/`permissionDecision`/`permissionDecisionReason`）。**⇒ path 可得（`.tool_input`）**，键名 `[待实测]`。
- **读埋点**：`PreToolUse` matcher 设为读工具名（Qoder Custom Agent 的工具集含 `Read`，见同文档
  `tools: Read, Grep, Glob, Bash`）`[待实测]`。
- **配置位置**：官方例子称「在 settings 文件注册」；`.qoder/settings.json` 当前仅含插件开关。
  本机另有 `~/.qoder/session-env/<id>/sessionstart-hook-0.sh`（**0 字节占位**）与 `security-scan` 插件的
  `qoder-hooks.json`（含 `SessionStart`/`PostToolUse`）→ 佐证 Qoder 确有 hook 机制。
  用户级 hook 的**确切配置文件路径** `[待实测]`。
- **跨平台**：官方建议优先 node/python 入口而非 bash + `jq`（Windows 兼容）。
- **既有采集**：Qoder 转录**无工具级（path/offset）细节**，故本装置**未采集 Qoder**（见采集器 `--help`）。

---

## 4. 可行性结论

| IDE | 能否做 read 行为埋点 | 预期可拿粒度 | 置信度 |
|---|---|---|---|
| **Cursor** | ✅ 能（`beforeReadFile` 或 `preToolUse` matcher=Read） | path 可得；**offset/limit `[待实测]`** | 高（事件名权威；载荷字段待实测） |
| **CodeBuddy** | ✅ 能（`PreToolUse`/`PostToolUse` matcher=Read） | path 可得（`.tool_input.file_path`）；offset/limit `[待实测]` | 高（载荷文档权威） |
| **WorkBuddy** | ✅ 大概率能（同源 CodeBuddy 引擎） | 同 CodeBuddy；运行时确认 `[待实测]` | 中（同形配置佐证） |
| **Qoder** | ✅ 能（`PreToolUse` matcher=Read） | path 可得（`.tool_input`）；offset/limit `[待实测]` | 中（事件名权威；配置路径待实测） |

**共同缺口**：**offset/limit** 在四家的随附文档中均未列明 → 若 hook 只能拿到 `path`（无行区间），
则 hook 埋点**只能补「整文件 vs 局部」的一阶信号**，拿不到精确区间——精确区间仍以**转录解析**（现状）为准。
**建议后续接入任务的第一步：写一个 log-only hook，对一次「带 offset 的读」打印 stdin JSON，实测是否含区间字段。**
→ **已执行（WXG-T-036 q-3，2026-09-13）**：Cursor 侧 log-only 探针已部署并自测通过（见 §3.1 末），
   只差**在 Cursor 里发起一次带 offset 的真实读**即可回填本表 `[待实测]`。
   注意：探针**只写独立日志**（`.cursor/hooks/.read-probe.jsonl`），**不写** `ctx/reads-ledger.jsonl`
   ——即本轮**不引入双源**，故 §5「双源冲突」风险仍未被触发。

---

## 5. 接入建议（**本轮不实施**，供后续任务决策）

- **推荐（首选）Cursor**：本仓**已启用** `.cursor/hooks.json`，追加一条读事件 hook 成本最低、风险最小；
  落点示例 `.cursor/hooks/read-audit.mjs`（log-only、fail-open），把 `path + offset/limit`
  追加到 `ctx/reads-instrumented.jsonl`（**只记元数据、无正文**，与既有账本同口径）。
  - 但**先实测 offset/limit**；若拿不到，则该 hook 只作「整文件/局部」计数补充，**不与转录账本直接混算**。
- **推荐（次选）CodeBuddy / Qoder**：事件与载荷更完整（`.tool_input`），但需新增 `.codebuddy/settings.json`
  或 Qoder settings 的 hooks 段**并做用户信任**——属**改配置**，须独立任务 + 用户授权。
- **不推荐（当前）**：把四家 hook 一次性全接。
  - 理由：① 四家事件名/载荷/settings 形态各异，维护面大；② offset/limit 未实测，接了也可能拿不到区间；
    ③ 与本装置的**转录采集**存在**双源冲突**（可能双计）。应先单家（Cursor）验证，再评估是否推广。
- **安全红线**（沿用既有 hook 实践）：读事件 hook 必须 **log-only / fail-open**，**禁止**改写读内容或阻断；
  只落 `path/offset/limit/行数/估算 token`，**绝不落正文**（对齐 `reads-ledger.mjs` 白名单）。

---

## 6. 本轮未做（明确声明）

> **口径变更（WXG-T-036 q-3，2026-09-13）**：本节描述的是**本调研任务（WXG-T-025/026 一轮）**的边界，
> 那一轮确实零改动。随后的 **q-3 试点**已在**用户拍板后**新增了一条 **log-only 探针**（见 §3.1 末）：
> 仅改 `.cursor/hooks.json` 加 `beforeReadFile` 项 + 新增 `.cursor/hooks/before-read-file.mjs`（恒放行、
> 不碰账本、不落正文）。以下三条**仍然成立**：未动 CodeBuddy/WorkBuddy/Qoder 任何配置，
> 未使用户级配置，**未接入任何真实埋点**（探针只记自有日志，与转录账本**无混算**）。

- ❌ 未修改 `.cursor/hooks.json` / `.codebuddy/settings.json` / `.workbuddy/settings.json` / `.qoder/settings.json`
  或任何用户级 hook 配置。
- ❌ 未新增任何 hook 脚本。
- ✅ 仅只读本机配置目录与随附文档，形成本调研。

---

## 7. 证据来源

| 来源 | 路径 / 链接 |
|---|---|
| Cursor 事件权威表 | `~/.cursor/skills-cursor/create-hook/SKILL.md` |
| Cursor 仓库现状 | `.cursor/hooks.json`、`.cursor/hooks/{before-shell,pre-tool-use}.mjs` |
| CodeBuddy 事件/载荷 | `~/.codebuddy/plugins/marketplaces/codebuddy-plugins-official/plugins/plugin-dev/skills/hook-development/{SKILL.md,references/advanced.md,references/patterns.md}` |
| CodeBuddy 插件 hooks 实例 | `…/edgeone-makers-tools/hooks/hooks.json`、`…/weixin-minigame-helper/hooks/hooks.json` |
| WorkBuddy 同源佐证 | `~/.workbuddy/plugins/marketplaces/codebuddy-plugins-official/plugins/security-guidance/hooks/hooks.json` |
| Qoder 事件/载荷 | `~/.qoder/plugins/cache/qoder-bundler/better-harness/references/agent-customize/platforms/qoder.md`、`…/agent-hooks.md` |
| Qoder hook 佐证 | `~/.qoder/plugins/cache/qoder-bundler/security-scan/.qoder-plugin/qoder-hooks.json`、`~/.qoder/session-env/*/sessionstart-hook-0.sh` |
| 官方文档 | Cursor Hooks · https://cursor.com/docs/hooks.md ；Qoder Hooks · https://docs.qoder.com/extensions/hooks |

## 8. `[待实测]` 清单（后续接入任务的第一步）

1. 四家 hook 的读事件**载荷是否含 `offset` / `limit`**（决定能否做区间级埋点）。
2. 各家的**读工具名**（matcher 用）：`Read` / `read_file` / …。
3. Qoder 用户级 hook 的**确切配置文件路径**；WorkBuddy 是否在 `.workbuddy/settings.json` 接受 hooks 段。
4. hook 埋点与转录采集**双源并存**时的去重/合并口径（当前账本按 `(ide,session,path,offset,limit)` 去重）。

## 9. 账本分窗轮转（WXG-T-037 R1，2026-09-13）

> 背景：2026-09-13 上下文膨胀审计判定 `ctx/reads-ledger.jsonl` 为「只增不减」的真雷
> （当时 457 条读事件 / 20 会话），随时间无限增长，拖慢分析且使分布统计被远古会话主导。

### 9.1 机制

- **`pnpm run ctx:rotate`**（`tools/scripts/rotate-reads-ledger.mjs`）：按会话分窗轮转账本。
  - **窗口预算 N = 20 会话**（含子代理会话，与 F-03 的 `sessionsInLedger` 同口径；可用
    `--window-sessions` 覆盖）。取 20 的理由：与审计时点量级对齐（457 行 / 20 会话 / 2 根会话树）。
  - **轮转原子单位 = 根会话树**（session id 首段，同分析器 `rootOf`）：整树同进同出，
    满足「窗口边界会话不截断」且保持会话谱系（F-01）完整；预算按树内会话数贪心占用，
    最新树优先保留，最新树自身超预算时至少保留该树（窗口恒非空）。
  - **会话新近度**：账本为字节稳定、无时间戳设计，唯一可靠时间信号是转录文件 mtime——
    采集器（WXG-T-037 起）写进侧车 `ctx/reads-ledger.meta.json` 的 `bySession[s].lastMtime`；
    树的新近度 = 树内最大值；侧车缺失/无该字段 → 按 0 处理（视为最旧，先轮转），同值按根 id 字典序。
- **历史聚合**：窗口外条目移出账本，其统计价值冻结进 **`ctx/savings-history.json`**：
  - 节省率类保留**原始样本数组**（`allSavings` / `partialSavings`，每事件一个 float、6 位小数）
    ——E1 的中位数/P10 与 E3 的基线回归依赖分布，纯摘要统计量不可合并出分位数；
  - 计数类（抖动组/超限、大文件整读、总读数、会话数）照常求和；
  - `archivedRootSessions` 为冻结根注册表；`rotations[]` 逐轮留痕（reason/taskId 强制）。
- **累计口径**：`ctx:usage` 在历史存在时输出 `usage-distribution.json` 的
  `metrics.cumulative`（窗口 ⊕ 历史）；`ctx:check` 的 **E1/E3 判定与样本充足性取累计口径**
  （窗口口径数字仍如实并列展示）。轮转只搬移样本、不改累计集合，故 **E3 基线回归不因
  窗口滑动假绿/假红**。`--update-baseline` 同样按累计口径写基线。

### 9.2 冻结语义与幂等（如实声明）

- 轮转出的会话**冻结在轮转时刻**：样本值按当时文件内容计算并固化；其后同根会话的新读
  事件不再入账（重采带回的行在再次轮转时**丢弃而不重复聚合**）。冻结后文件内容变化引起
  的口径漂移如实接受（与分析器「stale / 重算即漂移」同一量级）。
- 重复运行轮转器不丢数据、不重复聚合：窗口未超预算且无冻结重采行时**空转不落盘**。
- E4 净收益、§① 样本量等仍为**窗口口径**（历史计数在累计行单独展示）。

### 9.3 触发时机（裁决）

**手动命令**，不自动挂进 `ctx:usage` / pre-commit：分析器保持纯读（字节稳定输出、桩自测
不隐式改文件）。约定：**每次 `pnpm run ctx:reads` 之后、`ctx:usage` 之前按需运行
`pnpm run ctx:rotate`**——空转零成本，溢出才落盘（真实轮转须带 `--reason` / `--task-id`）。

### 9.4 自测

`tools/scripts/context-usage-selftest.sh` §[10]（⑬A–⑬H）：树原子轮转与窗口边界不截断、
历史聚合与手工计算逐位一致、幂等、冻结重采丢弃、留痕强制、`metrics.cumulative` 分位数
与手工合并一致、`ctx:check` 累计口径 E1/E3 判定语义（基线一致 exit 0 / 劣化 exit 1 /
窗口小样本不误报「样本不足」）。同轮顺带修复该自测在 HEAD 上既有的 4 个 FAIL
（[6] 桩缺 `ctx/hot-files.md`，WXG-T-036 A 门要求）。
