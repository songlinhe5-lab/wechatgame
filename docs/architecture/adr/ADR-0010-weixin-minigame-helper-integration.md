# ADR-0010 — weixin-minigame-helper 插件集成（四 IDE 能力同源与共享正本形态）

- **状态**：提议（Proposed，待用户批准）
- **日期**：2026-09-13
- **作者**：程基岩（技术 + 引擎负责人）
- **任务号**：WXG-T-034
- **关联决策**：ADR-0009（Cocos MCP 编辑器接入——本 ADR 补上"编辑器构建产物 → 微信预览/真机/上传"这一段；Cocos MCP 止步于编辑器，不到真机）
- **关联文档**：`docs/architecture/control-manifest.md`（§15 条目草案见本 ADR §6）、`my-skills/INDEX.md`（第 22 行 weixin-minigame-helper 条目需随实施更新）、`memory/MEMORY.md`（build:wx 已知限制）

---

## 1. 上下文（Context）——为什么现在要做这个决策，约束是什么

### 1.1 需求与用户问题

腾讯官方 CodeBuddy 插件 **weixin-minigame-helper**（v0.1.4，MIT，源 `git.woa.com/weadmin/ai-minigame-engine`）提供微信小游戏的预览 / 热重载 / 日志 / 真机二维码 / 上传能力。用户拍板"先出 ADR 再实施"，核心待决问题：

> 能否把插件集成到仓库内公共 `my-plugins/` 目录（类似既有 my-skills / my-agents / my-rules 的「正本 + 四 IDE 符号链接」模式），四个 IDE（Cursor / CodeBuddy / WorkBuddy / Qoder）分别引用使用？要求：完整能力在 CodeBuddy 可用，且与现有 skills 不冲突。

### 1.2 仓库现状（事实）

- 既有共享正本体系：`my-skills/`、`my-agents/`、`my-rules/` 为正本，`.cursor` / `.codebuddy` / `.workbuddy` / `.qoder` 四目录内用 `../../my-*/<name>` 相对符号链接引用；`tools/scripts/check-ide-links.mjs` 做 pre-commit 强校验。**skill 正本只要有 SKILL.md 即计现役**（排除 `_*` 与存档集），四 IDE 的 `skills/` / `agents/` 目录做「缺失 + 多余条目」双向校验——正本改名/删除时，旧符号链接会以"多余条目"失败，**校验脚本自动把改名变成强制迁移**。
- `my-skills/weixin-minigame-helper/` 已存在（SKILL.md + README.md，v0.1.4 快照）。**已实测**：`diff` 与插件缓存内 SKILL.md 逐字节一致——它是快照不是跟随，且与 CodeBuddy 插件内置 skill **同名同触发词**，双注册二义。
- 仓库根目录无 `game.js`（游戏在 `games/<g>/`，入口在 Cocos 构建产物 `games/<g>/build/wechatgame/`）。插件 `hooks/session-start.sh` 检测**当前目录**有无 `game.js` / `src/game.js` → **此 hook 在本仓库不生效**（已实测 hook 逻辑）。
- 插件 `agents/weixin-minigame-helper.md` 的 tools 列表用方言前缀 `mcp__plugin_weixin-minigame-helper_minigame__*`——该前缀只在 CodeBuddy 插件加载路径存在；**本会话（WorkBuddy 插件加载路径）实测工具前缀为 `mcp__weixin-minigame-helper__*`**，证明 agent 文件的工具前缀跨宿主不可移植。
- 用户尚未安装 Cocos Creator 编辑器，构建链路未通（ADR-0009 P2 未启动）——`run_game` 所需的含 `game.js` 目录尚不存在。

### 1.3 插件本体构成（8 文件解剖）

| 组件 | 内容 | 对本仓库的实际价值 |
| --- | --- | --- |
| `.codebuddy-plugin/plugin.json` | 声明 skills/agents/commands/hooks + **`mcpServers`（npx 拉起公网包 `@weadmin/weixin-minigame-helper-mcp@latest`）** | **唯一有实质逻辑的是 MCP server**；其余是 Markdown/薄 bash |
| SKILL.md（14.6 KB） | 使用指南 | 与本仓库不匹配处 ≥3：①假设 cwd 含 `game.js`；②hook 检测在 monorepo 根失效；③无 Cocos 构建前置说明 |
| agents/…md | 调试专用 agent | 工具前缀方言（§1.2），跨宿主失效 |
| commands/（3 条 slash） | preview / device-test / publish 薄包装 | 离开插件加载路径即不存在 |
| hooks/ | SessionStart 注入 | 本仓库不生效（§1.2） |

**结论**：插件的全部实质能力 = 一个 stdio MCP server，它从公网 npm 拉取、与插件加载机制无关——这直接决定 §2 各方案的天平。

### 1.4 事实勘误（对任务简报的一处修正）

任务简报提到验证 "Cursor / Qoder / **Windsurf**" 的 MCP 配置。本仓库四 IDE 体系是 **Cursor / CodeBuddy / WorkBuddy / Qoder**（`check-ide-links.mjs` 的 `IDE_DIRS`），无 Windsurf。本 ADR 按仓库真实四 IDE 展开验证；Windsurf 配置路径未验证，列入知识缺口（§4.3）。

### 1.5 验证记录（关键可行性，逐条带证据）

| # | 问题 | 结论 | 证据 |
| --- | --- | --- | --- |
| V1 | MCP 公网包是否存在、是否活跃 | **存在，MIT，latest 0.1.13**（2026-04-23 发布，持续更新中）；要求 Node ≥16、目标目录含 `game.js`；工具含 `run_game` / `get_logs` / `capture_screenshot(_burst)` / `real_device_preview` / `publish` 等 | npmjs.com / deps.dev / snyk.io 检索 `@weadmin/weixin-minigame-helper-mcp`（2026-09-13） |
| V2 | CodeBuddy 是否支持项目级 MCP 声明 | **支持**：`codebuddy mcp add -s project` 写入 `<project>/.mcp.json`；作用域 user/local/project | Tencent Cloud 官方接入文档（tcb.cloud.tencent.com，"方式二：手动写入 .mcp.json"）；CodeBuddy wiki（ima.qq.com，作用域表） |
| V3 | CodeBuddy 是否支持本地插件源 | **支持本地目录 marketplace**：`codebuddy plugin marketplace add /path/to/marketplace`，再 `codebuddy plugin install <name>@<marketplace> --scope project`（写入 `.codebuddy/settings.json` 的 `enabledPlugins`，随仓库共享）。**但 marketplace 注册本身是机器级一次性操作**（绝对路径），且插件安装仍走宿主缓存 | codebuddy.ai/docs/cli/plugins-reference §VI（2026-09-13 检索） |
| V4 | Qoder 项目级 MCP | **支持**：`${project}/.mcp.json`（随项目提交，需批准）；或 `.qoder/settings.json` → `mcpServers`。**Qoder 与 CodeBuddy 读同一个根 `.mcp.json`** | docs.qoder.com/cli/mcp-servers 与 /cli/mcp-reference（2026-09-13 检索） |
| V5 | Cursor 项目级 MCP | **支持**：项目根 `.cursor/mcp.json`（官方推荐提交 Git 共享；支持 `${workspaceFolder}` 变量） | cursor.com/docs/mcp（2026-09-13 检索） |
| V6 | WorkBuddy 项目级插件/MCP 声明 | **未发现项目级机制**：插件启停是用户级 `~/.workbuddy/settings.json` 的 `enabledPlugins`（键 `name@marketplace`），插件实体在 `~/.workbuddy/plugins/cache/<marketplace>/<name>/<版本>/`（带版本目录与 `.in_use` 锁文件）。本机已启用 `weixin-minigame-helper@codebuddy-plugins-official`（实测该 settings.json），本会话 MCP 工具实际可用（`mcp__weixin-minigame-helper__*`） | 本机 `~/.workbuddy/settings.json` 与插件缓存目录实测（2026-09-13）；无官方项目级文档佐证 |
| V7 | 四 IDE 能否"符号链接共享插件目录、各自加载" | **不能**。四家插件加载机制互不兼容且均为注册表/缓存制：CodeBuddy=plugin.json 清单+marketplace 注册；WorkBuddy=marketplace 键控的用户级缓存；Qoder=随**已安装**插件目录读 `.mcp.json`；Cursor=无本地目录插件加载的文档化机制。**把 `my-plugins/` 符号链接进 `.cursor/` / `.qoder/` 等目录不会让任何一家"加载插件"** | V3–V6 交叉；插件缓存目录结构实测 |
| V8 | 根 `.mcp.json` 一份配置能覆盖几家 | **CodeBuddy + Qoder 两家共读根 `.mcp.json`**；Cursor 一份 `.cursor/mcp.json`；WorkBuddy 靠用户级插件（已装） | V2/V4/V5/V6 |

### 1.6 约束

- 不自研 MCP server（用户倾向 + 造价评估见方案 B）。
- 与现有 skills 不冲突（同名双注册必须消解）。
- 仓库纪律：`check-ide-links.mjs` 与 `my-skills/INDEX.md` 是 pre-commit 真源，任何 skill 增删改名必须连带。
- 运行时影响约束：本决策全部发生在**开发机工具链侧**，不进微信小游戏构建产物，对主包 ≤4 MB 红线零影响（同 ADR-0009 §1.4 逻辑）。

---

## 2. 备选方案（Alternatives）

> 版本号为 2026-09-13 核实值。对比围绕四个裁决点展开：①同名冲突消解；②版本漂移治理；③四 IDE 能力同源；④是否自研 MCP。

### 方案 A：纯 CodeBuddy 插件集成（my-skills 副本摘除）

- **做法**：依赖宿主用户级安装的插件（本机已启用），删除 `my-skills/weixin-minigame-helper/`。其他 IDE 不做任何事。
- **能力同源**：❌ 仅 CodeBuddy（及 WorkBuddy——它恰好也能吃同一插件源）有 MCP；Cursor / Qoder 零能力。
- **冲突消解**：✅（摘除副本即消解）。
- **版本漂移**：⚠️ 受 marketplace 发布节奏摆布，仓库内无锚。
- **失去的**：插件 skill 文档对本仓库三处不匹配原样保留（§1.2）；hook / agent / commands 在 monorepo 的失效与方言问题不解决；四 IDE 中两家裸奔。
- **成本**：最低（删一个目录）。

### 方案 B：全拆分自研 MCP server

- **做法**：不用官方包，自研等价 MCP（预览 dev server + miniprogram-ci 上传 + 截图 + 日志采集）。
- **工作量**：重造 ≈10 个工具，其中 `run_game` 的"源码预打包 IIFE + 本地 Express 热重载 dev server"与 `miniprogram-ci` 上传链路是两块有分量的工程；且上游持续迭代（0.1.3→0.1.13，3 个月 8 个版本），跟随成本长期自担。
- **收益**：唯一彻底的自主可控；许可/供应链零外部依赖。
- **裁决**：**否决（预期内）**。官方包 MIT、活跃、能力正中需求；自研是"在闭环价值未验证前下最大赌注"——与 ADR-0009 否决自研 Cocos MCP 的同一逻辑。留档为复评触发条件（§5-3）的接盘方案。

### 方案 C：混合——官方 MCP 包 + my-skills 副本改造为仓库适配层 skill

- **做法**：
  1. 能力层：官方 npm 包经**项目级 MCP 配置**接入——根 `.mcp.json`（CodeBuddy + Qoder 共读）+ `.cursor/mcp.json`（Cursor），版本**锚定**（如 `@0.1.13`，不用 `@latest`）；WorkBuddy 沿用用户级插件（已装，覆盖）。
  2. 知识层：`my-skills/weixin-minigame-helper` **改名改造**为 `wxgame-minigame-bridge`——重写为本仓库适配层：入口路径真实化（`games/<g>/build/wechatgame/`）、Cocos 构建前置说明（接 ADR-0009 P2）、MCP-first 用法（不依赖插件 agent/commands/hook）、**不复制 MCP 工具表**（工具以 MCP server 实际暴露为准，防止文档漂移）。
- **能力同源**：✅ 同一 npm 包，四 IDE 同一工具集（WorkBuddy 靠用户级插件内的同版本包）。
- **冲突消解**：✅ 改名后不再与插件内置 skill 同名同触发词。
- **版本漂移**：✅ 配置里版本号锚定 + vendor 留档（可与 D' 叠加）。
- **成本**：中（两份 MCP 配置 + 一个 skill 重写 + INDEX/链接迁移）。

### 方案 D：用户原案——`my-plugins/` 公共正本 + 四 IDE 符号链接引用

- **可行性如实评估**：**按字面不可行（V7）**。四家 IDE 的插件加载均为注册表/缓存制，符号链接无法让任一家把仓库目录当作插件加载；且四家插件清单格式互不兼容（CodeBuddy `plugin.json` / WorkBuddy marketplace 键 / Qoder 安装目录 / Cursor 无此机制）。「正本 + 四 IDE 链接」模式之所以对 skills/agents/rules 成立，是因为那三家（以及四家）读的是**明文 Markdown 文件目录**，不存在加载注册表——插件不存在这个前提。
- **降级变体 D'（成立的最小形态）**——`my-plugins/` 承载三件事，均不依赖"被 IDE 直接加载"：
  1. **vendor 留档 + 版本锚定**：插件 v0.1.4 完整快照入库（MIT 允许），`marketplace.json` 声明版本锚；作为审计与断网兜底，并作为"当时的插件长什么样"的真源。
  2. **CodeBuddy 本地 marketplace 源**：`my-plugins/`（含 `marketplace.json`）可作为 `codebuddy plugin marketplace add <abs-path>` 的本地源，`--scope project` 安装后随仓库共享启用状态。**定位为可选通道**（补齐 CodeBuddy 的 slash commands / 官方 agent 体验），不作为能力依赖——能力主通道是 MCP 配置。
  3. **配置生成源**：根 `.mcp.json` 与 `.cursor/mcp.json` 的内容注释指回 `my-plugins/` 的版本锚，作为"这份配置为什么是这个版本"的解释真源。
- **成本**：低–中（vendor 拷贝 + marketplace.json + 说明文档）；**注意**：`my-plugins/` 不在 `check-ide-links.mjs` 管辖内，需要新的守护（§6 控制项）。

### 对比总表

| 维度 | A 纯插件 | B 自研 MCP | C 混合 | D 字面原案 | D' 最小形态 |
| --- | --- | --- | --- | --- | --- |
| 四 IDE 能力同源 | ❌ 两家裸奔 | ✅ | ✅ | ✅（但加载机制不存在） | ✅（借 C 的接线） |
| 同名冲突消解 | ✅ | ✅ | ✅ 改名 | ⚠️ 未处理 | ⚠️ 需叠加 C |
| 版本漂移治理 | ❌ | ✅ 自控 | ✅ 锚定 | — | ✅ 锚定+留档 |
| 依赖公网 npm | 是（插件内 @latest） | 否 | 是（锚定版本） | 是 | 是 |
| 重造/维护成本 | 极低 | **极高**（持续） | 中 | 中（且路径不通） | 低 |
| 独立成立 | 是（残缺） | 是 | **是** | **否** | 否（配 C） |

---

## 3. 决定（Decision）

### 3.1 一句话

> **采用方案 C，叠加 D' 最小形态：能力层以官方 `@weadmin/weixin-minigame-helper-mcp`（版本锚定）经项目级 MCP 配置接入四 IDE（根 `.mcp.json` 覆盖 CodeBuddy+Qoder、`.cursor/mcp.json` 覆盖 Cursor、WorkBuddy 沿用用户级插件）；知识层将 `my-skills/weixin-minigame-helper` 改名改造为 `wxgame-minigame-bridge` 仓库适配层；新建 `my-plugins/` 作为 vendor 留档 + 版本锚定 + CodeBuddy 本地 marketplace 可选通道，不做也不依赖"符号链接即加载"。**

### 3.2 要点

1. **不自研 MCP**（裁决点④）：方案 B 的造价/收益比在闭环价值验证前不成立，理由留档于 §2-B；复评触发见 §5。
2. **同名冲突消解**（裁决点①）：仓库 skill 与插件内置 skill 不再同名——`wxgame-minigame-bridge` 只做"本仓库怎么用这些 MCP 工具"的适配知识，不复制工具清单。
3. **版本漂移治理**（裁决点②）：MCP 配置中的包版本**禁止 `@latest`**，锚定具体版本（建议 `0.1.13`）；升级 = 改锚 + vendor 快照更新 + 冒烟，一次提交完成。插件副本从"假装是跟随的快照"改为"明确标注版本的 vendor 留档"。
4. **四 IDE 能力同源**（裁决点③）：同一 npm 包，同一份工具面。CodeBuddy/Qoder 共读根 `.mcp.json` 是本仓库"一份配置多处生效"设计逻辑（`.githooks`、ADR-0009 HTTP 端点）的延续；WorkBuddy 的例外与一次性手工步骤如实记录（§4.2-2）。
5. **D 原案的诚实结论**：符号链接共享插件目录不可行（V7），但用户诉求的实质——"仓库内有一个公共正本，四 IDE 都能用上同一能力"——由 C+D' 完整满足，只是"正本"承载的从"可加载的插件实体"降级为"vendor 留档 + 版本锚 + marketplace 源"。

---

## 4. 后果（Consequences）

### 4.1 正面

- Cursor / Qoder 从零能力变为与 CodeBuddy 同源的微信小游戏预览/日志/截图/真机/上传工具面，两份 JSON 搞定。
- 适配层 skill 让 MCP 用法与本仓库真实结构对齐（入口路径、Cocos 构建前置、逐游戏 `workspacePath`），消除官方文档三处不匹配带来的误导。
- 版本锚定 + vendor 留档使"我们现在依赖的是什么版本"随时可审计，升级成为显式、可评审的动作。
- `check-ide-links.mjs` 的既有双向校验会自动强制旧 skill 名的链接迁移，改名不易漏。
- 开发工具链侧决策，运行时包体零影响（§1.6）。
- MIT 许可，无 ADR-0009 那样的商用红线。

### 4.2 负面（已知成本，不是风险——白纸黑字）

1. **依赖公网 npm 包（供应链暴露）**：能力主通道锚定在 `@weadmin/weixin-minigame-helper-mcp` 上。锚定版本只防"无意漂移"，不防"该版本被投毒/被撤包"。vendor 留档可审计但不可运行时兜底（npx 仍从 registry 拉取）。npm 元数据无 repository 链接（npmscan 实测），上游可追溯性弱一档。
2. **WorkBuddy 不是仓库内自足的**：无项目级插件/MCP 声明机制（V6），新机器/新成员要在 WorkBuddy 侧手工启用一次用户级插件。这是四 IDE 中唯一的"仓库配置覆盖不到"的例外，须写进适配层 skill 的安装清单。
3. **插件周边组件在 monorepo 中全部弃用**：hook（本仓库不生效）、官方 agent（工具前缀方言）、三条 slash commands（仅插件加载路径存在）——即 CodeBuddy 本地 marketplace 通道（D'-2）提供的主要是体验补齐，不承担能力。这些组件的价值损失是接受方案 C 的直接代价。
4. **真机/上传能力被双重前置卡住**：`real_device_preview` / `publish` 需要 AppID + 上传私钥 + 微信 MP 后台 IP 白名单；`run_game` 需要含 `game.js` 的构建产物——而 Cocos 编辑器未装、构建链未通（ADR-0009 P2）。**集成完成后到能力可用之间还有真实距离**，本 ADR 不解决其中任何一环。
5. **密钥管理新面**：AppID/私钥走环境变量或浏览器 UI（npm 包文档），**严禁入仓**；`publish` 是直通微信平台的高影响动作。
6. **skill 改名的连带迁移成本**：`my-skills/INDEX.md`（含"执行层"描述与编排引用）、四 IDE 旧符号链接清理、潜在的其他 skill 交叉引用，一次提交内完成，漏一处 pre-commit 即失败（这既是保障也是摩擦）。
7. **vendor 快照仍会过时**：`my-plugins/` 的 v0.1.4 留档与上游演进（已到 0.1.13）天然脱节；留档不是跟随，需要靠 §6 的版本一致性控制项维持"留档版本 = 配置锚定版本"。

### 4.3 中性 / 待观察

- **知识缺口：WorkBuddy 项目级 MCP/插件机制**——未找到文档，也未在 settings schema 中观察到；若宿主后续提供，WorkBuddy 例外即可消除（§5-4 复评）。
- **知识缺口：Windsurf**——不在本仓库四 IDE 体系内，配置路径未验证；若未来接入按 V5 同类方法实测定案（§1.4 勘误）。
- weixin MCP 自带本地 dev server 的**端口未知**，与 Cocos MCP 的 `127.0.0.1:3000` 是否冲突待首次共现实测；冲突则登记端口错开。
- CodeBuddy 本地 marketplace 的相对路径支持情况未实测（文档示例为绝对路径），实施时按绝对路径走。
- 官方 agent 是否值得经 marketplace 通道启用（其方言前缀问题在 CodeBuddy 插件路径内反而是"正确方言"）：待实施后按实际体验决定，不预设。

---

## 5. 复评触发条件（Review Triggers）

1. **上游包断维护或行为劣化**（≥6 个月无更新 / 某锚定版本出现破坏性 bug 且无新版）→ 复评方案 B（自研接管），接盘范围按实际使用的工具子集收缩（不必全量 10 工具）。
2. **npm 包出现安全通告**（投毒/依赖漏洞）→ 立即复评锚定版本，必要时回退 vendor 快照对应的旧版本或暂停 MCP 通道。
3. **闭环价值验证后**（Cocos 构建链通、run_game/真机跑通 ≥1 个游戏）：若证实上传/预览链路是项目长期刚需且上游响应慢，重新权衡方案 B 的自研成本。
4. **任一宿主提供项目级插件声明机制**（尤其 WorkBuddy）→ 复评 D' 形态是否升级（vendor 留档 → 可加载正本）。
5. **商业化或对外发布启动**→ 复审供应链依赖面（MIT 无许可风险，但外部 npm 依赖需进入发布评审清单）。
6. **四 IDE 体系扩容**（如接入 Windsurf/新宿主）→ 按 §1.5 V5 的方法补该宿主的 MCP 配置验证，扩展根 `.mcp.json` 等价物。

---

## 6. 控制清单条目草案（供合入 control-manifest.md，不直接修改）

> 建议新增 §15，并在 §13 反模式速查表追加两行。

### §15 微信小游戏 MCP 接入（ADR-0010）

| 状态 | 控制项 | 理由 |
| --- | --- | --- |
| ✅ | **MCP 包版本必须锚定**：根 `.mcp.json` 与 `.cursor/mcp.json` 中 `@weadmin/weixin-minigame-helper-mcp` 必须带确定版本号（当前 `0.1.13`），**禁止 `@latest`**。升级 = 改锚 + `my-plugins/` vendor 快照同步 + 冒烟，一次提交。 | 防漂移；升级可审计（ADR-0010 §3.2-3） |
| ✅ | **vendor 锚一致**：`my-plugins/` 内留档快照的版本必须等于 MCP 配置锚定版本，不等即 pre-commit 失败（新增脚本 `tools/scripts/check-minigame-mcp.mjs` 或并入既有检查）。 | §4.2-7；留档与实际依赖不得说两套话 |
| ✅ | **仓库适配层 skill 统一命名 `wxgame-minigame-bridge`**：禁止在 my-skills 重建与插件内置 skill 同名（`weixin-minigame-helper`）的目录；适配层内容**不复制 MCP 工具清单**，只引用锚定配置与用法。 | 裁决点①同名消解；工具表随上游漂移不可维护 |
| ✅ | **`run_game` 等工具的 `workspacePath` 必须指向含 `game.js` 的构建产物目录**（`games/<g>/build/wechatgame/`），禁止指向仓库根或 Cocos 工程根。 | npm 包硬性要求；monorepo 结构与官方假设相反 |
| ✅ | **AppID / 上传私钥严禁入仓**：只经环境变量（`WECHAT_APPID` / `WECHAT_PRIVATE_KEY(_PATH)`）或预览页 UI 提供；`check-secrets.mjs` 覆盖相关模式。 | §4.2-5；沿用 §10 密钥红线 |
| ✅ | **`publish` / `real_device_preview` 为高影响动作**：上传微信平台前必须用户人工确认；**禁止**在 CI / 自动化循环 / 无人值守流程中调用 `publish`。 | 直通发布平台；用户掌舵纪律 |
| ✅ | **`my-plugins/` 变更纪律**：vendor 目录整进整出（替换 = 整目录替换 + marketplace.json 版本号同步更新），禁止手改 vendor 内容；新增插件须在 marketplace.json 登记。 | vendor 是审计真源，不是 playground |
| ⚠️ | **端口登记**：weixin MCP dev server 端口首次实测后登记到本清单；与 Cocos MCP（`127.0.0.1:3000`，ADR-0009）冲突则错开。 | 待观察项落为控制项 |
| ℹ️ | **WorkBuddy 例外记录**：WorkBuddy 侧能力依赖用户级插件启用（一次性手工步骤），适配层 skill 安装清单必须包含此步。 | §4.2-2 例外显式化 |

### §13 反模式速查追加

| 反模式 | 正确做法 |
| --- | --- |
| MCP 配置里写 `@weadmin/...-mcp@latest` | 版本锚定（如 `@0.1.13`），升级走显式提交 |
| 把 `workspacePath` 指向仓库根"反正 AI 会找" | 指向 `games/<g>/build/wechatgame/`（含 `game.js`） |
| 自动化里顺手调 `publish` 上传 | `publish` 必须人工确认，禁止无人值守 |

---

## 7. 实施清单概览（供下轮派工，本 ADR 不实施）

1. `my-skills/weixin-minigame-helper` → 改名 `wxgame-minigame-bridge` 并重写内容（入口路径 / Cocos 构建前置 / MCP-first / WorkBuddy 手工步 / 逐游戏 workspacePath 表）。
2. 同一提交内：删除四 IDE 旧符号链接、建立新链接（`check-ide-links.mjs` 会强制）、更新 `my-skills/INDEX.md` 两处引用与编排交叉引用。
3. 新建根 `.mcp.json`（CodeBuddy+Qoder，锚定 `0.1.13`）与 `.cursor/mcp.json`（同锚）。
4. 新建 `my-plugins/`：v0.1.4 vendor 快照 + `marketplace.json`（版本锚）+ README（D' 三职能说明）。
5. （可选）CodeBuddy 本地 marketplace 通道：`codebuddy plugin marketplace add <abs>/my-plugins` + `plugin install --scope project`，实测后回填 ADR 验证记录。
6. 新增/扩展校验脚本（§6 vendor 锚一致），并接入 pre-commit。
7. 冒烟前置登记：Cocos 编辑器安装 + 首次构建（ADR-0009 P2）完成后，跑 `run_game`/`get_logs` 冒烟并回填端口登记与 §4.3 待观察项。
