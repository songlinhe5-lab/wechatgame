# my-mcp — MCP 服务器配置的单一正本（WXG-T-043）

> **改 MCP 服务器，只改这里**：`my-mcp/servers.json` → `pnpm run mcp:build` → 提交。
> 三份 IDE 配置文件（`.mcp.json` / `.cursor/mcp.json` / `.codebuddy/mcp.json`）都是**机器生成物，勿手改**。

## 1. 为什么不学 `my-skills` 用符号链接

`my-skills` 能"一处正本 + 四 IDE 链接"，是因为四个 IDE 消费的是**内容完全相同**的目录。MCP 配置做不到，因为**各 IDE 方言不同**：

| | Cursor 官方文档 | CodeBuddy 官方文档 | 交集 |
|---|---|---|---|
| stdio 条目 | `type` 标注**必填**（示例 `"stdio"`）+ `command`/`args` | 建议显式 `type` | **`"type":"stdio"`** ✅ 两侧都认 |
| 远程 HTTP 条目 | 示例**只有 `url`**；`type:"http"` **无文档依据** | 建议显式 `"type":"http"`（未指定时按字段推断） | **只写 `url`** ✅ 两侧都安全 |

若强行用一份内容 symlink 给三处，必然在**某一侧**偏离其文档（给 Cursor 塞 `type:"http"` 有解析风险；给 CodeBuddy 省 `type` 则背离其"建议显式"）。

故本目录采用 **语义正本 + 方言序列化**：`servers.json` 只描述**语义**（这个 server 是 stdio 还是 http、命令/URL 是什么），由生成器按各 IDE 方言渲染。

## 2. 分层职责

| 层 | 路径 | 职责 |
|---|---|---|
| **正本（语义）** | `my-mcp/servers.json` | servers 语义 + targets 清单（哪些 IDE 文件、用什么方言） |
| **生成器** | `tools/scripts/build-mcp-configs.mjs` | 渲染方言；`--check` 校验漂移；`--selftest` 自测 |
| **产物** | `targets[].path` 三份配置 | IDE 实际读取；**机器生成，勿手改** |
| **门禁（本目录）** | `pnpm run check:mcp` | C1–C5：正本合法 / targets 合法 / 语义与**回环红线** / 产物漂移 / **漏登记** |
| **门禁（版本锚）** | `pnpm run check:plugins`（WXG-T-035） | 包 spec 为确定 semver、与 `my-plugins` vendor 对账 |

**边界与已知冗余（诚实记录）**：`check:plugins` 的"两配置锚一致"（`.mcp.json` + `.cursor/mcp.json`）在语义上已被 `check:mcp` 的"产物 == 正本渲染"覆盖（同源渲染必然一致）。保留它是为它**独有**的两件事：vendor 对账与 semver 格式（禁止 `@latest`）。两个门禁都只读、不写，不冲突。

## 3. 方言表（生成器实现）

| dialect | stdio 渲染 | http 渲染 | 依据 |
|---|---|---|---|
| `explicit` | `{type:"stdio", command, args}` | `{type:"http", url}` | CodeBuddy 文档"建议显式指定" |
| `cursor` | `{type:"stdio", command, args}` | `{url}`（**不写 type**） | Cursor 文档：stdio 的 `type` 必填；远程示例只给 `url` |

## 4. 改一条 MCP 服务器

```bash
# 1. 改正本（唯一改动点）
$EDITOR my-mcp/servers.json
# 2. 重新生成三份
pnpm run mcp:build
# 3. 校验（pre-commit 与 CI 也会跑）
pnpm run check:mcp
```

`check:mcp` 的 **C5** 会拦"存在但未登记"的 MCP 配置——将来新增 `.qoder/mcp.json` / `.workbuddy/mcp.json` 时，**必须**先在 `targets` 登记，否则门禁 FAIL（防止"清单是人写的枚举、漏项静默失效"，`knowledge/lessons.md` K-031）。

## 5. Qoder 接入（WXG-T-046：零新文件方案）

Qoder 官方文档（docs.qoder.com/cli/mcp-reference）明确项目级支持读 **`/.mcp.json`**（要求顶层 `mcpServers` 键，首次使用需 IDE 内批准）——与 CodeBuddy `explicit` 方言的现有产物**字段完全兼容**（stdio 显式 `type:"stdio"`、http `type:"http"` 均为 Qoder 文档支持的写法），故**不新增 target、不新增方言**，复用根 `.mcp.json` 即可。三条路径按优先级：

1. **项目级（零改动）**：Qoder 打开本仓库 → Agent 内发起 MCP 调用 → IDE 弹出项目 `.mcp.json` 批准提示 → 批准后两个 server 生效。
2. **用户级（已同步）**：`~/.qoder/mcp.json` 已由主理会话写入同语义两 server（与正本 `servers.json` 一致，2026-09-13）——用户级对所有项目生效，无需批准。**注意**：此文件在仓库外，正本仍是 `my-mcp/servers.json`；升级 MCP 包版本时需手动同步此处（`check:plugins` 只管仓库内锚，管不到用户级文件）。
3. **兜底（UI 添加）**：Qoder 设置 → MCP → My Servers → 粘贴同 JSON。

格式依据：Qoder CLI 参考的 `mcpServers` 字段表（`command`/`args`/`env`/`cwd` + 可选 `type`；http 用 `{"type":"http","url":...}`）。本机实证：`~/.qoder/mcp.json` 原为 `{"mcpServers":{}}` 空壳（IDE 级文件即此路径）。

## 6. 红线：HTTP 仅回环（C3 机械化）

`control-manifest.md §14` 红线 2「HTTP 仅回环」已由门禁 **C3** 机械执行：`transport:"http"` 的 `url` 主机非 `127.0.0.1` / `localhost` / `::1` 即 FAIL。改端口或改绑定会被拦。

## 7. 本次已知未验证项（诚实记录）

1. **Cursor 侧 `type` 写法未经真机实测**：本文档依据 Cursor 官方 MCP 文档的字段说明（stdio 的 `type` 标注必填、远程示例只给 `url`）。落地后须在 Cursor 的 **MCP 面板**确认两个服务器均列出。
2. **Qoder 已收口**（WXG-T-046，见 §5）：项目级复用根 `.mcp.json`，**未新增 targets**。**WorkBuddy 位置仍未核实**——但本仓 WorkBuddy 定位为纯文档/设计，**判定为不追求 MCP 接入**（Not Planned），若将来改变分工须回填本节。核实新位置时**必须先登记 `targets` 再 `mcp:build`**（C5 会要求）。
3. 安装与验证顺序见 `docs/agent/cocos-setup.md`；决策依据见 `docs/architecture/adr/ADR-0009`。
4. **`cocos-creator`（HTTP）服务的可用性依赖编辑器进程 + 面板打开**（2026-09-14 实测）：MCP 服务随扩展 `unload()` 停止，编辑器没开或面板被关时该 server 连接失败——IDE 侧显示"连接失败"属**预期**，不是配置错。探活用 `GET http://127.0.0.1:3000/health`（**不要用 `/mcp`**，GET 恒 404 会误判）。

## 8. `headroom` server —— 本地上下文压缩（WXG-T-330）

[Headroom](https://github.com/headroomlabs-ai/headroom) 是跑在本机的**上下文压缩层**：把喂给模型的巨型工具输出（JSON / 日志 / git diff / RAG）压小再进 LLM，原文本地留档可逆（CCR）。注册为 MCP server 后，Agent 显式调 `headroom_compress` 压大块、`headroom_retrieve` 取原文、`headroom_stats` 看省幅。

- **它压的是「工具 stdout 回灌」，不是本仓 `ctx/` 读侧预算体系**：两者互补——`ctx/ROUTES.md` + `hot-files.md` + `check:context-budget` 管「别整读大文件」，headroom 管「回灌给模型的大输出」。⛔ 别指望它替掉 ctx 门。
- **前置（本机一次性，仓库外）**：`uv tool install --python 3.13 "headroom-ai[mcp,code]"`，装完 `headroom --version` 的读数写进此处/台账做**确定版本锚**（禁裸 `latest`，同 §15 精神）。
- **PATH 说明**：`command: "headroom"` 与 `npx` 同走 PATH。GUI 启动的 IDE 若不继承 shell PATH、spawn 报「找不到 headroom」，把正本此处 `command` 改为绝对路径（`uv tool` 默认落 `~/.local/bin/headroom`）再 `pnpm run mcp:build`。
- **缺件即连接失败属预期**（同 §7-4 的 cocos）：未装 headroom 前该 server 启动失败不影响其余两个，装上即恢复。
- **字面「减少输出」在 proxy 侧、非本 server**：`HEADROOM_OUTPUT_SHAPER=1` 的 verbosity/effort 削减要把 Agent 出网指向 `headroom proxy` 才生效（Harness 级），MCP 模式只做「显式压缩大块输入」。默认遥测可用 `HEADROOM_BEACON=off` 关。
