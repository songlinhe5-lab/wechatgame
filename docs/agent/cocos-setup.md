# Cocos Creator + MCP 安装引导（docs/agent/cocos-setup.md）

> **来源**：ADR-0009 §3.4「四 IDE 接入方式」的可执行展开 · 2026-09-13 · Task ID WXG-T-042。
> **适用**：用户本机（macOS）首次安装 Cocos Creator 与 `cocos-mcp-server` 插件。
> **不适用**：CI / headless（ADR-0009 §4.2-2：MCP 跑在编辑器进程内，没有 CI 形态）。
> **边界**：本文件只讲**怎么装**；装完后的验证顺序与缺口回填见 `docs/engine-reference/cocos/VERSION.md` §5 与 §3。

---

## 1. 前置事实与红线

| 项 | 值 | 真源 |
|---|---|---|
| 钉定版本 | Cocos Creator **3.8.8**（`3.8.x` 内可跟随，跨大版本需 ADR 复评） | `VERSION.md` §1 |
| 插件 | DaxianLee/cocos-mcp-server 开源版 **v1.5.4** | ADR-0009 §2 方案 A |
| 端点 | `http://127.0.0.1:3000/mcp`（**无鉴权**） | ADR-0009 §3.4 / `control-manifest.md` §14 |
| 工程落位 | `games/<game>/cocos/` | `docs/agent/repo-layout.md` |
| 插件装法 | **全局扩展目录**（不进仓库、跨游戏复用） | 本文件 §5 |
| 构建产物 | `games/<game>/build/wechatgame/` | `architecture.md` §6 |

**四条红线**（逐条对应 `control-manifest.md` §14）：

1. **L1 工具级防线**：`scene_*` / `node_*` / `component_*` / `prefab_*` 的**写操作默认禁用**；经 MCP 发生的场景/节点变更**视同手编 `.scene`，评审打回**。
2. **HTTP 仅回环**：禁止暴露到非回环地址；**改端口或改绑定即违反本条**。
3. **非商用许可**：开源版自定义许可**禁止商用**；商业化前须按 ADR-0009 §5 完成复评。
4. **临时开权限要登记**：确需只读查询而临时开启被禁前缀时，在 ADR 复评记录登记工具名与原因，用完关闭，**严禁开启写 action**。

---

## 2. 七步总览（速查）

| # | 步骤 | 谁做 | 卡点 |
|---|---|---|---|
| A | 装 Cocos Dashboard → 装 Creator 3.8.8 | 用户（GUI） | 官网**只发 Dashboard** |
| B | 新建工程到 `games/<game>/cocos/` | 用户（GUI） | 分辨率 / 功能裁剪 / 空场景 |
| C | 克隆插件到**全局扩展目录** + 构建 | 用户（终端） | 路径放错 = 插件不生效 |
| D | 编辑器内启动 MCP 服务 | 用户（GUI） | 端口 `3000` 勿改 |
| E | 四 IDE 登记端点 | ✅ 已落盘（§7） | 已收口为单一正本，产物勿手改 |
| F | 工具白名单禁用写操作前缀 | 用户（GUI） | **L1 机械防线，最容易漏** |
| G | 按依赖顺序验证并回填 `VERSION.md` | 智能体 + 用户 | 顺序错会白跑 |

---

## 3. 阶段 A — 安装 Cocos Creator 3.8.8

1. 打开 <https://www.cocos.com/creator-download> → 点 **「下载 Cocos Dashboard」**。
   > 官网**不**直接提供编辑器安装包；版本右侧按钮文案是「从 Dashboard 安装」。
2. 安装 Dashboard → 登录 → 切到 **Cocos Creator 3.x** 页签。
3. 找到 **3.8.8**（2025-12-16 发布，当前 3.8.x 最末补丁）→ 安装。
4. 编辑器**装默认目录即可，不要装进仓库**（`.gitignore` 兜不住 GB 级安装目录）。

```bash
ls -d /Applications/Cocos* ~/.CocosCreator 2>/dev/null || echo "未安装"
```

---

## 4. 阶段 B — 创建工程

**严格照 `games/breakout/cocos/README.md` §3 执行**（已写逐步清单），要点复述：

- 工程路径必须指向 **`games/<game>/cocos/`**。当前仓库只有 `games/breakout/cocos/` 存在；beads 的 Cocos 工程尚未创建。
- 设计分辨率 **750 × 1334**，适配 **Fit Height**（竖屏）。
- 功能裁剪**只勾**真正用到的模块（`Graphics` / `Label` / `UITransform`）——**这一步直接决定主包能否 ≤ 4 MB**。
- 场景里**只允许** `GameRoot` 一个节点 + `UITransform` + `Bootstrap` 一个脚本（ADR-0003）。

> ⚠️ `.scene` / `.prefab` / `.meta` **必须由编辑器生成**。手工编写或脚本伪造会产出编辑器无法加载的破损工程（L1）。本仓 `games/*/cocos/` 下**故意不含**这些文件。

---

## 5. 阶段 C — 安装 MCP 插件（全局扩展目录）

### 5.1 为什么装全局而非项目级

| | **全局**（本项目采用） | 项目级 |
|---|---|---|
| 路径 | `~/.CocosCreator/extensions/` | `games/<game>/cocos/extensions/` |
| 进 git | ✅ 不进仓库，无需新增 `.gitignore` 规则 | ❌ 会带进插件自带 `.git`、`node_modules`、`dist` |
| 跨游戏复用 | ✅ 一套插件服务所有 `games/*/cocos/` | ❌ 每款游戏各装一份 |
| 官方文档 | ⚠️ **3.8 手册「安装与分享」只记载项目级**，未提全局目录 | ✅ 官方明确记载 |

> **诚实标注**：全局扩展目录 `~/.CocosCreator/extensions` 是**社区通行约定**——Cocos 官方 3.8 手册「扩展编辑器 → 安装与分享」全文未提及用户级扩展目录。装后**以编辑器「扩展管理器」实际显示为准**；若你的编辑器不认该目录，退回项目级（并给 `.gitignore` 加 `games/*/cocos/extensions/`）。

理由：本仓是**多游戏 monorepo**，插件属"编辑器侧工具"而非某款游戏的产物；装全局可避免把第三方仓库的 `.git` 与 `node_modules` 混进版本控制。

### 5.2 安装命令

```bash
git clone https://github.com/DaxianLee/cocos-mcp-server.git ~/.CocosCreator/extensions/cocos-mcp-server
cd ~/.CocosCreator/extensions/cocos-mcp-server && npm install && npm run build
```

- 用 `npm`（不是 `pnpm`）：插件是独立仓库，不在本仓 pnpm workspace 内。
- 插件要求 **Cocos Creator 3.8.6+**（3.8.8 满足）；其简介 "3.8.0+" 与系统要求 "3.8.6+" **互相矛盾**，该歧义登记在 ADR-0009 §2 / §4.2-6，**以实测为准**。

### 5.3 启用

重启 Cocos Creator → **扩展 → 扩展管理器** → 找到 `cocos-mcp-server` → **启用**。

> 插件不生效的**最常见原因不是代码写错，而是目录放错**。改源码后必须重新 `npm run build` 并在扩展管理器**重新载入**。

---

## 6. 阶段 D — 启动 MCP 服务

`扩展 → Cocos MCP Server` → 面板内：**端口** `3000`（默认，勿改）→ **自动启动** ✅ → **「启动服务器」**。

```bash
curl -sS --noproxy '*' -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/mcp
```

返回码非 `000` 即服务已起（无鉴权，4xx 也算可达）。

> ⚠️ **代理陷阱（2026-09-13 实测）**：本机设了全局代理（`HTTP_PROXY/HTTPS_PROXY` 指向 `127.0.0.1:<port>`）时，**不带 `--noproxy '*'` 的 curl 会把回环请求也发给代理**，返回 502 假象（服务明明没起却"有响应"）。同理建议给 shell 加 `export NO_PROXY=127.0.0.1,localhost`——否则任何走代理感知 HTTP 客户端的 MCP http 连接都可能被劫持。

---

## 7. 阶段 E — 四 IDE 端点登记（已落盘，且已收口为单一正本）

ADR-0009 §3.4 的「一份配置，四处生效」指 **URL 统一**；实际落地时各 IDE 的**文件位置与字段写法不同**。自 **WXG-T-043** 起**不再手写三份**，改为「语义正本 → 各 IDE 方言」生成：

| 层 | 路径 | 说明 |
|---|---|---|
| **正本（唯一改动点）** | `my-mcp/servers.json` | 只描述语义（stdio/http + 命令 / URL）与 targets 清单 |
| 生成器 | `tools/scripts/build-mcp-configs.mjs` | `pnpm run mcp:build` 重新生成全部产物 |
| 产物（**机器生成，勿手改**） | `.mcp.json` · `.cursor/mcp.json` · `.codebuddy/mcp.json` | 手改会被 `check:mcp` 的 C4 判为漂移并拦在提交前 |
| 门禁 | `pnpm run check:mcp` | pre-commit · CI `arch-guard` · `pnpm run verify` 三处都跑 |

方言差异只存在于**生成器的渲染策略**里（取舍依据与两侧官方文档对照见 `my-mcp/README.md`）：

| IDE | 文件 | 状态 | stdio 条目 | 远程 http 条目 |
|---|---|---|---|---|
| CodeBuddy Code / 通用 | `.mcp.json`（项目根） | ✅ 生成 | `"type":"stdio"` | `"type":"http"`（**建议显式**） |
| CodeBuddy IDE | `.codebuddy/mcp.json` | ✅ 生成 | `"type":"stdio"` | `"type":"http"` |
| Cursor | `.cursor/mcp.json` | ✅ 生成 | `"type":"stdio"`（**文档标必填**） | 只写 `"url"`（官方示例即如此） |
| Qoder / WorkBuddy | 待核实 | ⚠️ **未登记 targets** | — | — |

> **本任务顺带修掉的一个真实缺陷**：此前 `.cursor/mcp.json` 里 `weixin-minigame-helper`（stdio）**漏了 `"type"`**，而 Cursor 文档把 stdio 的 `type` 标为**必填** —— 该服务器在 Cursor 侧**可能一直没被加载**。现已由生成器统一补上。**请在 Cursor 的「MCP」面板确认两个服务器都在列表里**（本机无 Cursor 会话，未实测）。

产物长这样（由 `my-mcp/servers.json` 决定，此处仅示意）：

```jsonc
// .mcp.json 与 .codebuddy/mcp.json（dialect: explicit）
{
  "mcpServers": {
    "weixin-minigame-helper": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@weadmin/weixin-minigame-helper-mcp@0.1.13"]
    },
    "cocos-creator": { "type": "http", "url": "http://127.0.0.1:3000/mcp" }
  }
}
```

```jsonc
// .cursor/mcp.json（dialect: cursor）—— 远程服务器官方示例只给 url
{
  "mcpServers": {
    "weixin-minigame-helper": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@weadmin/weixin-minigame-helper-mcp@0.1.13"]
    },
    "cocos-creator": { "url": "http://127.0.0.1:3000/mcp" }
  }
}
```

依据与注意事项：

- CodeBuddy 官方文档 <https://www.codebuddy.ai/docs/cli/mcp>：`type` 固定值 `"http"`；未指定时按字段推断（有 `url` → `http`，有 `command` → `stdio`），**建议显式指定**。
- 项目作用域（`<项目根>/.mcp.json`）**首次连接需用户在 IDE 内批准**；同一作用域**只读第一个存在的文件、不合并**。
- `.codebuddy/mcp.json` 见腾讯云 CodeBuddy 集成文档，而 **codebuddy.ai 官方 CLI 文档记载的 PROJECT 位置是 `.mcp.json`**；两者是 IDE 与 CLI 两套入口，故**两处都登记**。
- 与既有 `weixin-minigame-helper`（stdio / npx 拉本地进程）**并存不冲突**：一个走进程、一个走 HTTP。
- 服务未启动时 IDE 显示该服务器**连接失败**属**预期**——编辑器没开就没有 MCP。
- 改正本即可：`$EDITOR my-mcp/servers.json` → `pnpm run mcp:build` → 提交；**不要手改产物**。
- 新增登记位置（如将来核实 Qoder / WorkBuddy）**必须先登记 `targets` 再 `mcp:build`**：`check:mcp` 的 **C5** 会拦「存在但未登记」的配置，防清单漏项静默失效（`knowledge/lessons.md` K-031）。
- **HTTP 仅回环**红线（§1 红线 2）已由 `check:mcp` 的 **C3** 机械执行：`transport:"http"` 的 URL 主机非 `127.0.0.1` / `localhost` / `::1` 即 FAIL。

---

## 8. 阶段 F — 工具白名单（L1 机械防线）

在插件面板**工具管理**标签页按**前缀**设置（ADR-0009 §3.3；实测后按 v1.5.4 实际工具名微调）：

| 状态 | 前缀 | 理由 |
|---|---|---|
| ✅ 保留 | `project_*` | 运行 / 构建 / 项目信息 |
| ✅ 保留 | `debug_*` | 控制台日志与日志分析（回读编译错误） |
| ✅ 保留 | `asset_*` | 导入 / 刷新 / 重导入 / 依赖分析（`.meta` 闭环） |
| ✅ 保留 | `validation_*` | 场景完整性 / 资源引用验证 |
| ✅ 保留 | `server_*` / `broadcast_*` | 连接状态与消息监听 |
| ❌ 禁用 | `scene_*` / `node_*` / `component_*` / `prefab_*` | **写入场景图的破坏性接口**——L1 代偿点 |
| ❌ 禁用 | `sceneView_*` / `referenceImage_*` / `preferences_*` | 视图 / 参考图 / 编辑器偏好——与工程产物无关，徒增风险 |

> 白名单是**机械保证**：即使智能体误判，被禁前缀的工具**根本不会出现在工具列表里**。

---

## 9. 阶段 G — 验证顺序与回填

按 `VERSION.md` §5 的**依赖顺序**跑（前一步失败会阻塞后一步）：

1. **先做 G7 空工程包体基线**——最早暴露包体风险。
2. 再 G1 框架引用 → G2/G3 渲染 → G4 输入 → G5 循环。

每关掉一个缺口就**回填** `VERSION.md` §3 矩阵，并在 `production/TASKS.md` 记一笔。**禁止**为好看而删缺口项——该项明确"诚实记录不达标状态"。

---

## 10. 升级流程

1. `cd ~/.CocosCreator/extensions/cocos-mcp-server && git pull`
2. **先删**编辑器工程下的 `settings/mcp-server.json` 与 `settings/tool-manager.json`（旧配置结构可能不兼容新版本）
3. `npm install && npm run build` → 扩展管理器**重新载入** → 重新执行 §6 与 §8（**白名单会重置，必须重设**）

---

## 11. 排错

| 症状 | 处置 |
|---|---|
| 扩展管理器里看不到插件 | 目录放错（应在 `extensions/<插件名>/` 下，且该目录内含 `package.json`）；确认已 `npm run build` |
| IDE 报 MCP 连接失败 | 编辑器是否开着、服务是否已启动、端口是否 `3000`（先跑 §6 的 curl） |
| `npm run build` 报错 | 插件要求 Node 版本与系统 ESLint 栈；先 `node -v` 对齐 README 要求 |
| 工具列表里没有 `scene_*` | **正常**，是你按 §8 禁用的结果 |
| 改了场景但评审打回 | 预期行为——`.scene` 不许经 MCP 改，见 §1 红线 1 |

---

## 12. 本次已知未完成项（诚实记录）

1. **Qoder / WorkBuddy 的 MCP 配置文件位置未核实**，故 §7 只登记了三处。
2. **插件未实际安装**（本机此前无 Cocos）——本文件是**引导**，§5–§8 的路径与工具名**未经本机实测**，装完须以实际界面为准并回填本文件。
3. **构建脚本缺口**：`games/breakout/cocos/README.md` §3 步骤 7 引用的 `tools/scripts/check-bundle-size.mjs`、§2 方案 C 的 `sync-framework-to-cocos.mjs`，以及 `architecture.md` §6 的 `npm run build:cocos` —— **在仓库中均不存在**。此为独立缺陷，未在本任务范围内修复。
