# my-plugins — 外部插件 vendor 留档正本

> 定位（ADR-0010 §2 方案 D′ 最小形态）：本目录是**留档 + 版本锚 + CodeBuddy 本地
> marketplace 可选源**，**不是**「四 IDE 符号链接即可加载的插件」——四家 IDE 的插件
> 加载均为注册表/缓存制，符号链接对它们无效（ADR-0010 §1.5 V7）。
> 决策全文：`docs/architecture/adr/ADR-0010-weixin-minigame-helper-integration.md`。

## 1. 版本锚定关系（vendor ≠ 运行版本，两者都受控）

| 项 | 版本 | 角色 | 变更方式 |
| --- | --- | --- | --- |
| `my-plugins/weixin-minigame-helper/0.1.4/` | **0.1.4** | 插件完整快照（vendor 留档 + CodeBuddy 本地 marketplace 源） | 整目录替换 + 本 README 版本行同步 |
| 根 `.mcp.json` / `.cursor/mcp.json` 锚定的 `@weadmin/weixin-minigame-helper-mcp` | **0.1.13** | **运行时实际执行的 MCP server**（能力主通道） | 改两份 mcp.json 的锚 + vendor 同步评估 + 冒烟，一次提交 |

- vendor 快照（0.1.4）与 MCP 运行版本（0.1.13）**有意不同且各自锚定**：前者留档
  "插件当时长什么样"，后者控制"能力实际用什么版本"。两者一致性由
  `tools/scripts/check-plugin-anchor.mjs` 校验（见 §4）。
- 禁止 `@latest`：升级必须是显式、可评审的提交动作（control-manifest §15）。

## 2. 组件矩阵裁决记录（ADR-0010 §3）

| 插件组件 | 裁决 | 理由 |
| --- | --- | --- |
| **MCP server**（`plugin.json` 的 `mcpServers` → npm 包） | ✅ **接入**（能力主通道） | 唯一有实质逻辑的组件；经项目级 mcp.json 注入四 IDE（WorkBuddy 经用户级插件） |
| **SKILL.md** | ✅ **接入**（改造形态） | 原文留档于 `my-skills/wxgame-minigame-bridge/references/`；适配层重写为 `wxgame-minigame-bridge`，消解与插件内置 skill 的同名双注册 |
| agents/weixin-minigame-helper.md | ❌ 弃用 | 工具前缀 `mcp__plugin_weixin-minigame-helper_minigame__*` 是 CodeBuddy 插件路径方言，其他宿主前缀不同（实测 WorkBuddy 为 `mcp__weixin-minigame-helper__*`），跨宿主不可移植 |
| commands/（preview/device-test/publish） | ❌ 弃用 | 仅存在于插件加载路径；能力等价物已由 MCP 工具 + bridge skill 工作流覆盖 |
| hooks/session-start.sh | ❌ 弃用 | 检测当前目录 `game.js`——monorepo 根无 `game.js`（入口在 `games/<g>/build/wechatgame/`），本仓库必然不生效 |

## 3. 四 IDE 能力来源表

| IDE | 能力来源 | 配置位置 | 备注 |
| --- | --- | --- | --- |
| CodeBuddy | 项目级 MCP | 根 `.mcp.json` | 与 Qoder 共读同一文件 |
| Qoder | 项目级 MCP | 根 `.mcp.json` | 需在 Qoder 内批准项目级 server |
| Cursor | 项目级 MCP | `.cursor/mcp.json` | 支持提交共享 |
| WorkBuddy | **用户级插件** `weixin-minigame-helper@codebuddy-plugins-official` | `~/.workbuddy/settings.json` enabledPlugins | **无项目级机制**；新机器需一次性手工启用，版本随宿主市场（可能与 0.1.13 锚不同） |

JSON 不支持注释，配置语义说明统一落在本 README（此为约定真源）：
`.mcp.json` / `.cursor/mcp.json` 中 `args` 使用**带版本号的包名**是刻意的锚定，
去掉 `--prefer-online` 亦是（锚定语义 = 允许 npx 缓存，版本由包名钉死）。

## 4. CodeBuddy 本地 marketplace 可选通道

`my-plugins/` 可注册为 CodeBuddy 本地 marketplace（`codebuddy plugin marketplace add
<本目录绝对路径>`，需 marketplace.json 索引，**当前未创建**——首次启用该通道时随启用
提交），再 `codebuddy plugin install weixin-minigame-helper@<marketplace> --scope project`。
定位：补齐 CodeBuddy 侧 slash commands / 官方 agent 体验，**不承担能力**（矩阵见 §2）。

## 5. 刻意的边界

- 本目录**不挂进** `check-ide-links.mjs` 扫描范围：目录无 `SKILL.md` 正本（SKILL.md 在
  版本子目录内，不满足 `my-skills` 式 `my-plugins/<name>/SKILL.md` 布局），天然不计现役，
  不会触发四 IDE 链接校验——这是刻意的，不要把本目录改造成会被误扫描的形状。
- 本目录变更纪律：**整进整出**（替换 = 整目录替换 + 本 README 版本行同步），
  禁止手改 vendor 内容（control-manifest §15 草案）。
