# IDE 能力迁移矩阵（docs/agent/ide-capability-matrix.md）

> **来源**：主理人盘点（2026-09-13，WXG-T-045）。**结论先行的分工**：开发在 CodeBuddy / Cursor / Qoder 进行；WorkBuddy 只做方案调研、制定与设计。本矩阵回答「WorkBuddy 上的开发辅助能力，哪些已转入三 IDE、哪些没有」。
> **总判定门**：`pnpm run check:links`（四 IDE skills/agents/rules 链接 + 正本完整性）与 `pnpm run check:mcp`（MCP 三产物与正本一致）全绿即为本矩阵「已迁移」的机器可验状态；两个门都接 pre-commit + CI。

## 1. 组件级迁移矩阵（✅=已完成且门禁可验 / ⏳=待办 / ❌=不迁移，留 WorkBuddy）

| 组件 | 正本 | CodeBuddy | Cursor | Qoder | WorkBuddy | 状态 |
|---|---|---|---|---|---|---|
| **Skills（17 个）** | `my-skills/<name>/` | `.codebuddy/skills/` 符号链接 ×17 | `.cursor/skills/` ×17 | `.qoder/skills/` ×17 | `.workbuddy/skills/` ×17 | ✅ 四侧全同（含 wxgame-* 全套 + 外来现役 6 个） |
| **Agents（7 个）** | `my-agents/*.md`（6 角色含 audio-director + orchestrator） | `.codebuddy/agents/` ×7 | `.cursor/agents/` ×7 | `.qoder/agents/` ×7 | `.workbuddy/agents/` ×7 | ✅ 四侧全同（符号链接） |
| **Rules（always-on）** | `my-rules/agents-md.md` | `.codebuddy/rules/agents-md` + 根 `AGENTS.md` | `.cursor/rules/agents-md.mdc` | `.qoder/rules/agents-md.md` | `.workbuddy/rules/agents-md` | ✅ 四侧全同（同一正本） |
| **MCP：weixin-minigame-helper** | `my-mcp/servers.json`（锚 0.1.13） | `.codebuddy/mcp.json` ✅ | `.cursor/mcp.json` ✅ | ✅ 项目级复用根 `.mcp.json`（零新文件，需 IDE 内批准）+ 用户级 `~/.qoder/mcp.json` 已同步 | 经 my-plugins 插件通道 | ✅ 四侧已通（WXG-T-046） |
| **MCP：cocos-creator** | 同上（http 127.0.0.1:3000） | ✅ | ✅ | ✅ 同上 | 同上 | ✅/⏳ 同行；另需 Cocos 编辑器在线（ADR-0009） |
| **MCP 配置生成/门禁** | `mcp:build` + `check:mcp`（C1–C5 漏登记拦截） | — | — | — | — | ✅ 已完成（WXG-T-043） |
| **插件 vendor 治理** | `my-plugins/weixin-minigame-helper/0.1.4` | ❌（注册表/缓存制，走 MCP 同源即可） | ❌ 同 | ❌ 同 | ✅ 宿主插件 | ✅ 按 ADR-0010 C+D′ 定案：能力靠 MCP 同源，vendor 仅留档 |
| **读埋点 hooks** | `docs/agent/context-instrumentation-survey.md` | ⏳ 需 settings + 用户信任 | ✅ log-only 探针已部署 | ⏳ 配置路径待实测 | ⏳ | 部分完成（计量装置对 Cursor 可测，CodeBuddy/Qoder 待授权） |
| **上下文膨胀治理五件套** | `ctx:rotate`/`check:mcp`/ROUTES 硬门/`tasks:archive`/`memory:distill` | 消费同一套 `ctx/` 产物 | 同 | 同 | 同 | ✅ 全部落库（WXG-T-037~041/044） |

## 2. WorkBuddy 保留项（按新分工，留在 WorkBuddy、不迁移）

| 能力 | 去留理由 |
|---|---|
| **专家团编排**（TeamCreate/spawn 六角色 + 质量门裁决） | 依赖 WorkBuddy 多智能体运行时；三 IDE 侧的 `my-agents/*.md` 是**同名角色定义**，可当 prompt/上下文用，但无 spawn/SendMessage 编排能力 → 系统设计/评审/汇编仍在 WorkBuddy 走完整流程，与用户分工一致 |
| **文档连接器**（tencent-docs/docx/pptx/xlsx、pdf）、**agent-mail**、**websearch/webfetch**、**cloud-service** | WorkBuddy 平台连接器，服务「调研 + 文档」分工；开发侧不需要 |
| **用户级技能**（`~/.workbuddy/skills`：a-stock-data、tdx-stock-analysis 等） | 金融/调研类，属 WorkBuddy 调研分工，与开发无关，不迁移 |
| **上下文计量/审计装置**（ctx:usage、reads-ledger 采集） | 分析与决策在 WorkBuddy 做（主理人职责），产物 `ctx/` 三 IDE 共享只读 |

## 3. 遗留缺口（转入 IDE 开发前建议处理）

1. **✅ Qoder MCP 已接入（WXG-T-046）**：官方文档实证项目级读根 `/.mcp.json`（与现有 explicit 方言字段兼容）→ **零新文件**；用户级 `~/.qoder/mcp.json` 已同步同语义两 server。注意用户级文件在仓库外，升级 MCP 版本时手动同步（README §5）。首次在 Qoder 使用项目级配置需 IDE 内批准。
2. **⏳ CodeBuddy/Qoder 读埋点**：需改 settings 并经用户信任（属改配置，须独立任务 + 授权）；不阻塞开发，仅影响计量覆盖面。
3. **⏳ Cocos Creator 编辑器未装**：`docs/agent/cocos-setup.md`（T-042）是安装引导真源；`cocos-creator` MCP 在编辑器插件启动前不可用——beads/breakout 的 Cocos 侧预览依赖它。
4. **⚠️ 用户级重复 skill**：`~/.workbuddy/skills/` 存在 skillhub 旧副本（game-material-precheck/numeric-design 等），与 `my-skills/` 正本同名不同源；WorkBuddy 侧项目级链接优先级更高（INDEX §3），但建议择机清理避免误用旧版。
5. **✅ 能力前置已就绪的部分**：微信小游戏 MCP（0.1.13 锚）三 IDE 配置就绪、冒烟通过；`wxgame-minigame-bridge` 使用前置=上条 Cocos 安装 + AppID/私钥/白名单（环境项）。

## 4. 分工对照速查

- **CodeBuddy/Cursor/Qoder（写代码 + 跑验证）**：17 skills + 7 agents + always-on rules + 2 MCP（Qoder 复用根 `.mcp.json` + 用户级同步，WXG-T-046）+ ctx 产物只读 —— 机器可验全绿。
- **WorkBuddy（调研 + 方案 + 设计 + 文档）**：专家团编排、文档连接器、调研类技能、计量分析 —— 保留不动。
- **跨 IDE 一致性保证**：`check:links` / `check:mcp` / `check:plugins` 三门禁随 pre-commit + CI 强制，正本单一，产物机器生成。
