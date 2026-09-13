---
name: wxgame-minigame-bridge
description: >
  本仓库（wechatgame monorepo）的微信小游戏 MCP 适配层：把 weixin-minigame-helper
  MCP 工具与本仓库真实结构（Cocos 构建产物入口、逐游戏目录、四 IDE 配置）对接。
  当用户要在本仓库预览/运行/调试已构建的小游戏、热重载、看运行日志、真机扫码、
  上传开发版，或提到「预览游戏」「跑一下」「真机测试」「上传微信」时触发。
  与 CodeBuddy 插件内置 skill（weixin-minigame-helper）触发词错开：本 skill 强调
  Cocos 构建前置、构建产物预览与四 IDE 一致用法；从零生成小游戏代码不归本 skill。
version: 1.0.0
---

# wxgame-minigame-bridge — 微信小游戏 MCP 仓库适配层

> 定位：**适配层，不是工具手册**。工具能力全部来自 MCP server
> `@weadmin/weixin-minigame-helper-mcp@0.1.13`（经根 `.mcp.json` / `.cursor/mcp.json`
> 注入四 IDE；WorkBuddy 经用户级插件）。本 skill 只回答三件事：
> **路径怎么填、前置是什么、流程怎么走**。
> 官方原文留档：`references/official-skill-0.1.4.md`（v0.1.4 快照，逐字节留档，
> 来源 `~/.workbuddy/plugins/cache/codebuddy-plugins-official/weixin-minigame-helper/0.1.4/`）。
> 决策与控制纪律：`docs/architecture/adr/ADR-0010-weixin-minigame-helper-integration.md`、
> `docs/architecture/control-manifest.md` §15。

## 1. 仓库适配三件事（官方文档与本仓库不匹配处，以本节为准）

### ① 入口路径映射——`workspacePath` 一律指构建产物

官方假设游戏目录含 `game.js`。本仓库是 monorepo，**仓库根与 Cocos 工程根都没有 `game.js`**，
入口在 Cocos Creator 构建产物里：

```
games/<game>/build/wechatgame/     ← workspacePath 填这里（含 game.js / game.json）
games/<game>/                      ← 源码与工程，不喂给 MCP
dev/harness/                       ← 浏览器 dev harness，只做逻辑/渲染验证，
                                     不适用真机与上传链路
```

- `run_game` / `real_device_preview` / `publish` 的 `workspacePath` 均填
  `games/<game>/build/wechatgame/` 的**绝对路径**。
- 多游戏并行时逐游戏指定，不做"猜目录"。
- 产物目录不存在 → 说明该游戏尚未构建，见②，**禁止**改喂源码目录。

### ② Cocos 构建前置（当前未通）

MCP 能力链起点是构建产物，而构建链依赖 Cocos Creator 编辑器（ADR-0009 P2）。
**现状：编辑器未安装，`build/wechatgame/` 不存在 → 本 skill 全部场景均不可用**，
只能等构建链打通后启用。构建由 Cocos MCP 通道负责（ADR-0009），两个 MCP 通道分工：

| 通道 | 覆盖段 | ADR |
| --- | --- | --- |
| Cocos MCP（编辑器内） | 源码 → 编辑器验证/构建 → 产出 `build/wechatgame/` | ADR-0009 |
| weixin MCP（本 skill） | 构建产物 → 浏览器预览/日志/截图 → 真机二维码/上传 | ADR-0010 |

### ③ WorkBuddy 例外

四 IDE 中 CodeBuddy / Cursor / Qoder 的能力来自仓库内 MCP 配置（根 `.mcp.json` 与
`.cursor/mcp.json`，锚定 `0.1.13`）。**WorkBuddy 无项目级插件/MCP 声明机制**，能力来自
用户级插件 `weixin-minigame-helper@codebuddy-plugins-official`（已启用，一次性手工步骤）。
新机器接入 WorkBuddy 时须手工启用该插件；版本以宿主插件市场为准，可能与仓库锚定版本
不同——工具面差异以 MCP server 实际暴露为准（见 §2）。

## 2. 工具面（不复制清单，防漂移）

约 10 个工具由 MCP 配置自动注入，前缀因宿主而异（CodeBuddy/Qoder/Cursor/WorkBuddy
各自的 `mcp__` 方言）。核心五个（与官方一致）：

`run_game`（启动/幂等热重载预览）· `reload_game`（热重载）· `get_logs`（日志，支持
正则 filter）· `real_device_preview`（真机二维码）· `publish`（上传开发版）。
另有截图类（`capture_screenshot` / burst）等，以 IDE 的 MCP 工具列表实际显示为准，
不在此维护逐工具参数表——**工具参数疑问时直接查 IDE 的 MCP 面板或官方留档**。

## 3. 四场景工作流（沿用官方，路径已按①修正）

### 场景一：构建产物更新后预览 + 日志循环（最常用）

1. 确认 `games/<game>/build/wechatgame/` 存在（不存在 → 走 ADR-0009 构建链，停下）
2. 未启动 → `run_game`（workspacePath = 构建产物绝对路径）；已启动 → `reload_game`
3. 打开返回的预览 URL；等约 2 秒 → `get_logs`（filter 如 `"error|warn|Uncaught"`）
4. 有错 → 修源码 → **重新构建**（MCP 只服务产物，源码改动不自动进产物！）→ `reload_game`
   → 回 3，循环至无错
5. 退出机制：同一错误修复 >5 次或累计 >15 次 → 暂停，汇总已试方案询问用户
6. 多文件改动：全部改完 + 重建后只 reload 一次，不要逐文件重载

> 与官方差异的关键点：**本仓库改源码 ≠ 产物更新**。热重载只重打包产物目录；
> 源码级修改必须先经 Cocos 构建链（ADR-0009），否则预览的是旧代码。

### 场景二：看日志调试

`get_logs` + filter 正则；日志格式 `[时间戳] [级别] 消息`。配合截图类工具可取证画面。

### 场景三：真机预览

1. `real_device_preview`（workspacePath = 构建产物）
2. 返回 `configMissing` → 引导用户在预览页 ⚙️ 填 AppID + 上传密钥（或环境变量
   `WECHAT_APPID` / `WECHAT_PRIVATE_KEY_PATH`），**禁止跳过/测试账号/模拟数据**
3. 返回 `ipWhitelistError`（-10008）→ 引导用户在微信公众平台 → 开发设置 → 小程序代码
   上传 → IP 白名单添加预览页右上角显示的本机公网 IP，然后重试
4. 成功弹出二维码 → **禁止刷新网页/再调 run_game**（二维码会消失）

### 场景四：上传开发版

1. **高影响动作（control-manifest §15）**：调 `publish` 前必须用户人工确认版本号与描述；
   **禁止在 CI / 自动化循环 / 无人值守流程中调用**
2. `publish`（workspacePath、version 语义化版本、desc）
3. `configMissing` / `ipWhitelistError` 处理同场景三
4. 成功后告知：已上传为**开发版**；升体验版/正式版走微信公众平台管理后台（人工）

## 4. 纪律速查（详见 control-manifest §15）

- MCP 配置中包版本**锚定**（当前 `0.1.13`），禁止 `@latest`；升级 = 改锚 +
  `my-plugins/` vendor 同步 + 冒烟，一次提交
- AppID / 上传私钥**严禁入仓**；`check-secrets.mjs` 覆盖
- `my-plugins/` 是 vendor 留档真源，整进整出，禁止手改内容
- 与 Cocos MCP（`127.0.0.1:3000`，ADR-0009）端口冲突待实测登记

## 5. 跨域与升级

- 跨域或全流程请求先交 `wxgame-orchestration`（本 skill 属域·平台执行层）
- 构建链问题 → ADR-0009 / Cocos MCP 通道；发布流程 → `wxgame-release-checklist`
- 上游升级复评条件见 ADR-0010 §5
