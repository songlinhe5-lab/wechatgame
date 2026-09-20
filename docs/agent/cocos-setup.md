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

1. **Qoder 已实证收口**（WXG-T-046）：官方文档确认项目级读根 `/.mcp.json`，字段与 `explicit` 方言兼容 ⇒ **未新增 targets**（零新文件零代码）。**WorkBuddy 侧位置仍未核实**，但本仓 WorkBuddy 定位为纯文档/设计 ⇒ **不追求** MCP 接入（见 `docs/agent/ide-capability-matrix.md`）。
2. **插件已实际安装并实测可用**（本机 Cocos Creator 3.8.8 + `cocos-mcp-server` v1.5.4）：`POST http://127.0.0.1:3000/mcp` 返回 `serverInfo: cocos-mcp-server v1.5.4`；`GET /health` 返回 `{"status":"ok","tools":21}`；日志有 `✅ HTTP server started successfully on http://127.0.0.1:3000`。
   - **§5–§8 已实测回填**：全局扩展目录可用；工具白名单实测为 **21/50 启用**（只读 + 构建类），写类（`scene_management` / 节点 / 组件 / prefab 写入）全部禁用——与 §8 的 L1 代偿设计一致。
   - **⚠️ 新增实测约束：MCP 服务随扩展 `unload()` 停止** ⇒ **面板必须保持打开**（`main.ts` 的 `unload()` 调 `mcpServer.stop()`）。`autoStart:true` 只能解决「编辑器重启后需手点 Start」，**不解决「关面板即停」**。
   - `settings/mcp-server.json` 已被 git 跟踪但**含未提交改动**：编辑器把键名 `debugLog` 改写成 `enableDebugLog`（与扩展 `settings.ts` 的 `DEFAULT_SETTINGS` 一致）——即**已提交版本用了扩展不认的键名**，该开关此前一直是失效的。
   - **探活取 `/health` 而非 `/mcp`**：`GET /mcp` 本来就返回 404（MCP 的 initialize 只收 POST），拿它探活会误判成"服务没起"。
3. **构建脚本缺口（WXG-T-047 / T-048 / T-049 收口）**：`sync-framework-to-cocos.mjs` 已存在；`check-bundle-size.mjs` 已补（`pnpm run check:size`，阈值真源 `systems-index §3.8`）；`build:cocos` 已实现（`tools/scripts/build-cocos.mjs`）= **前置检查 + 命令行构建 + 产物校验**。
   - **构建能力来源（两轮实测，结论修正过一次）**：MCP 的 `project_build_system` **无构建 action**（`ADR-0009 §3.2` P2 偏差成立）；但 Cocos Creator **自带 CLI 可以构建**——`CocosCreator --project <proj> --build "platform=<p>;debug=true"`，实测 `platform=web-mobile` **3.9s 成功**，且**编辑器开着也能并存**。⇒ 正确表述是「**MCP 不可，编辑器 CLI 可**」，不是"构建不可自动化"。
   - 产物默认落**工程内** `games/<game>/cocos/build/<platform>/`（与 `architecture.md §1/§5` 的 `games/<game>/build/` 不同）；`check:size` 两处都扫，避免"产物在、门禁说没有"的静默跳过。
   - 仅看渲染/手感用 `pnpm run build:cocos:web`（web-mobile，**免 AppID**）；微信目标用 `pnpm run build:cocos`（需有效 AppID）。
   - **多游戏调用约定**（WXG-T-048）：`build:cocos` 声明在**各游戏自己的 `package.json`**，根层用 `pnpm -r` 聚合（与既有 `test` / `typecheck` 同构）。理由：`games/<game>/cocos/` 是**每款游戏都有**的目录，根层裸 `build:cocos` 无法表达"构建哪一款"；per-package 声明让 cwd 自带 game 身份，且**新增游戏零改根脚本**。

---

## 13. beads 工程落地清单（WXG-T-053）

> 背景：`games/breakout/cocos/` 已存在并跑通预览/构建；**beads 的 Cocos 工程尚未创建**。
> 本节是 beads 版的逐步清单。除「步骤 A」必须在编辑器 GUI 里做，其余全部可在仓库侧完成。

### 13.1 顺序约定（**先读这条，否则会撞目录**）

**仓库侧不预建 `games/beads/cocos/`。** 原因：编辑器「新建工程」会在目标路径下创建工程目录，
若该目录已存在且非空，创建很可能直接失败。因此顺序是：

```
① 你在编辑器里建工程（步骤 A）  →  ② 仓库侧补齐其余文件（步骤 B）  →  ③ 同步 → 构建（步骤 C）
```

`tools/scripts/sync-framework-to-cocos.mjs` 与 `tools/scripts/check-cocos-scripts.mjs` 都已按
`games/*` 遍历：**没有 `cocos/` 的游戏会被明确跳过并打印**（不静默当作"同步成功"）。

### 13.2 步骤 A — 编辑器 GUI（唯一必须人工的一步，约 5 分钟）

| # | 动作 | 值 |
|---|---|---|
| A1 | Cocos Dashboard → **新建** → Empty（2D）模板 | 工程落点 **`games/beads/cocos/`**（照 `games/breakout/cocos/README.md` §3） |
| A2 | 项目设置 → 项目数据 | 设计宽度 `750`、设计高度 `1334`、适配 **Fit Height**（竖屏） |
| A3 | 项目设置 → 功能裁剪 | **照抄 `games/breakout/cocos/settings/v2/packages/engine.json` 的 `includeModules`**（10 个模块：`2d`/`affine-transform`/`base`/`custom-pipeline`/`gfx-webgl`/`gfx-webgl2`/`graphics`/`intersection-2d`/`profiler`/`ui`）。<br>**依据**：beads 的 `games/beads/src/**` 按 L3 铁律**不 import `cc`**，实际用到的引擎能力全部来自 `packages/framework/src/adapters/cocos/**` —— 与 breakout **同一份适配器** ⇒ 模块集应当**完全相同**，不存在 beads 特有模块 |
| A4 | `assets/` 右键 → 创建 → 场景，命名 `Main`；双击打开 | **不要**添加任何节点 |
| A5 | 层级空白处右键 → 创建 → 空节点，命名 `GameRoot` | 选中后加组件 `UITransform`（内容尺寸 `750 × 1334`）+ `BeadsBootstrap`（见 13.3） |
| A6 | 保存场景，然后**设为起始场景** | 编辑器里「项目设置 → **预览** → 起始场景」选 `Main`。<br>**可校验判据**（不依赖菜单措辞）：`games/beads/cocos/profiles/v2/packages/preview.json` 的 **`start_scene`** 应等于 `assets/Main.scene.meta` 的 uuid |
| A7 | 构建面板：平台 **微信小游戏**；**输出目录改成 `games/beads/build/wechatgame`** | Cocos 默认落在工程内 `cocos/build/wechatgame`，与 `architecture.md §1/§5` 约定不同。（`pnpm run check:size` 两处都扫，故不改也不静默漏检，但建议改） |

> ⚠️ **A6 不是可选项。** 起始场景若留「当前场景」，预览会依赖"编辑器此刻开着哪个场景"；
> 编辑器刚重启、场景尚未恢复时收到预览请求 → `无法查到当前场景 JSON 数据(start_scene) = current_scene`
> （2026-09-14 实测复现，见 `memory/2026-09-14.md`）。固定成 `Main` 后该竞态消失。
>
> ⚠️ **但这条设置不随仓库共享**：落点在 `games/<game>/cocos/profiles/`，而 `games/*/cocos/profiles/`
> 在 `.gitignore` 内 ⇒ **新检出 / 新机器必须重设一次**，否则竞态复发。
> **已实测的权威格式（2026-09-14，WXG-T-053）**：键名 **`start_scene`**（snake_case），位于
> **工程级** `profiles/v2/packages/preview.json`；两款游戏现均已设置
> （beads = `9683d2dd-7e97-4fe3-a54d-3e2ef554406a`，breakout = `d6736ca4-…`）。
> 注意**用户级** `~/.CocosCreator/profiles/v2/packages/preview.json` 是**另一个文件**，
> 里面**没有** `start_scene`（只有 `rotate` / `debugMode` / `showFps`）—— 初次诊断时曾误读它。
>
> ⚠️ **`.scene` / `.prefab` / `.meta` 必须由编辑器生成**（L1）。A4/A5 请在 GUI 里点出来，不要让我或脚本伪造。

### 13.3 步骤 B — 仓库侧补齐（工程建好后**一次做完**）

**B1 · `games/beads/cocos/assets/scripts/BeadsBootstrap.ts`**（照 breakout 范式，`ccclass` 名唯一）：

```ts
import { _decorator } from 'cc';

import { Bootstrap } from './framework/adapters/cocos/bindings';
import type { Game } from './framework/core/game/game';
import { createBeadsGame } from './game/index';

const { ccclass } = _decorator;

@ccclass('BeadsBootstrap')
export class BeadsBootstrap extends Bootstrap {
  protected createGame(): Game {
    return createBeadsGame();
  }
}
```

> 导入指向 `assets/scripts/` 内的**拷贝件**（`framework/**` 与 `game/**` 由 `framework:sync` 生成，
> 禁止手改）。相对导入**无 `.js` 后缀**——Cocos 3.8.8 执行期模块加载器不解析 `.js` 后缀
> （编译期 tsc 可解析，两回事）。

**B2 · `games/beads/cocos/settings/`**：`mcp-server.json`、`tool-manager.json` 照 breakout 抄
（编辑器也会写；键名以扩展 `settings.ts` 的 `DEFAULT_SETTINGS` 为准，`debugLog` 是**失效旧键**）。

**B3 · `games/beads/cocos/README.md`** —— 照 `games/breakout/cocos/README.md` 改路径/命令，
`build-cocos.mjs` 的前置检查提示会指向它。

**B4 · 不在本步做的事**：不要复制 breakout 的 `assets/Main.scene`。场景里的节点 `id` 是相对顺序索引，
带过来的是**另一个工程的引用**，必然断裂（ADR-0003）。

### 13.4 步骤 C — 同步、检查、构建（命令）

```bash
# 1) 同步拷贝件（这一次会首次为 beads 生成 framework/** 与 game/**）
pnpm run framework:sync
pnpm run framework:sync:check       # 应变成「breakout…；beads…」两句一致

# 2) Cocos 脚本类型检查（依赖编辑器生成的 temp/declarations，故必须在打开过工程之后）
pnpm run cocos:check                # 应报「检查 2、跳过 0」

# 3) 免 AppID 的落地路径：web-mobile（可同 Wi-Fi 手机浏览器看手感）
pnpm run build:cocos:web            # 注意：beads 也已声明 build:cocos，根层 pnpm -r 会两款都跑

# 4) 微信目标（需有效 AppID）
pnpm run build:cocos --release      # 包体基线**必须** release，debug 含 sourcemap 且不压缩
pnpm run check:size                 # 阈值真源：games/beads/design/gdd/systems-index.md §3.8
```

> `build-cocos.mjs` 的 `--game=` 可显式指定单款（任意 cwd）：
> `node tools/scripts/build-cocos.mjs --game=beads --platform=web-mobile`。

### 13.5 beads 的预期与特有风险

| 项 | 预期 | 依据 / 风险 |
|---|---|---|
| 主包体积 | 与 breakout **同量级**（≈1815 KB 的引擎 + 更小的业务代码） | 引擎模块集相同 ⇒ `cocos-js/` 应接近；beads 零位图美术（`assets-spec §3`：主包美术位图 0 KB）。**这是预测，不是实测** |
| 内部目标 | 主包 ≤ **2000 KB**（红线 4096 / 合计 30720） | `games/beads/design/gdd/systems-index.md` §3.8/§3.9（beads 自己的真源，勿套用了 breakout 的数字） |
| **真机帧率** | **未知，且这次比 breakout 更重** | `architecture-beads.md` §8 **R1**。满格 13×12 时 `view-model` 产出 **≥1248 条指令/帧**（每珠 8 条：L0/L1/L2×2/L3×2/L4 + L5 符号）。**符号通道落地前每珠只有 2 条**，即 R1 的暴露面在 WXG-T-052 才真正变大 —— 这是本节最需要实测的一项，触发信号「真机 <30fps」 |
| 文字居中 | 可能偏 | 缺口 G3（`_anchorForText` 用 `0.55` 估算宽度）在 breakout 侧**未闭环**；beads 的 HUD/面板文字同样走该路径 |
| 玩法/手感 | 应无偏差 | 同一份 `RenderModel` 已在浏览器 harness 跑通（`?game=beads`），且 `harness:smoke` 已纳入 CI |

### 13.6 检查表

```
[ ] A1 工程已创建于 games/beads/cocos/（设计分辨率 750×1334，Fit Height）
[ ] A3 功能裁剪已与 breakout 的 engine.json 完全一致
[ ] A4/A5 Main.scene 里只有 GameRoot + UITransform + BeadsBootstrap
[ ] A6 起始场景已固定为 Main —— `cocos/profiles/v2/packages/preview.json` 的 `start_scene` === Main.scene 的 uuid（注意 profiles/ 不入库，新机器要重设）
[ ] A7 构建输出目录已改为 games/beads/build/wechatgame
[ ] B1 BeadsBootstrap.ts 已落盘，createGame() 返回 createBeadsGame()
[ ] B3 games/beads/cocos/README.md 已落盘
[ ] C  pnpm run framework:sync → framework:sync:check 两款游戏均一致
[ ] C  pnpm run cocos:check 报「检查 2、跳过 0」
[ ] C  pnpm run build:cocos --release 成功 → pnpm run check:size 通过
[ ] C  真机跑一次，记录 R1 的实测帧率并回填 architecture-beads.md §8
[ ] C  assets/** 与其 .meta 已提交（library/ temp/ local/ profiles/ build/ .creator/ 不入库）
```

