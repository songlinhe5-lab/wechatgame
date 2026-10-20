---
name: headroom
description: >
  在本机用 Headroom（https://github.com/headroomlabs-ai/headroom，Apache-2.0）把喂给
  LLM 的上下文压小——工具输出、日志、JSON、git diff、RAG 块、文件与会话历史——同时
  可选削减模型写回的输出 token。压缩跑在本机、原文本地留档可逆（CCR）。当用户提到
  「省 token / 压缩上下文 / 工具输出太大 / headroom / 长会话成本 / 减少模型输出」时使用。
  不用于：替代本仓 ctx/ 读侧预算体系（互补）；也不进游戏运行时（游戏不调 LLM）。
license: Apache-2.0（上游；本 SKILL 仅为接入配方，不含上游代码）
---

# Headroom — 本机上下文压缩

Headroom 是夹在「Agent/应用」与「LLM」之间的一层本地压缩器：**同答案、少 token**，
数据不外传、可逆（`headroom_retrieve` 取原文）。它压的是**回灌给模型的巨型 stdout**
（JSON / 日志 / git diff / RAG），与本仓 `ctx/ROUTES.md` + `check-context-budget` 的
「别整读大文件」读侧纪律**互补、不替代**。

## 何时用 / 何时不用

- **用**：长 Agent 会话、反复灌大工具输出（本仓典型 = `git commit` 钩子 dump、
  `verify`/`ctx:check` 长报告、大 `grep`/JSON、真机取证日志）。重复度越高省越多。
- **不用 / 收益极小**：短问答、纯 prose、已经很密的输出；低于 `min_input_words` 的块
  会原样返回。⛔ 别用它替掉 ctx 读侧预算门。游戏运行时不调 LLM ⇒ 不进包、不影响包体红线。

## 安装（本机一次性，仓库外）

```bash
uv tool install --python 3.13 "headroom-ai[mcp,code]"   # 装完 headroom --version 读数写进台账做确定版本锚（禁裸 latest）
# 全量核心栈：pip install "headroom-ai[all]"（含 Kompress-v2-base 文本模型，较重）
```

## 四种接入

1. **Library**：`from headroom import compress`（Python）/ `import { compress } from 'headroom-ai'`（TS，SDK-only 无 CLI）。适合自研脚本/服务。
2. **Proxy（零改码，唯一能做「削减输出」）**：`headroom proxy --port 8787`，把 Agent 出网指过去。**属 Harness/IDE 级**，不改本仓代码；第三方 provider 必须 `--openai-api-url <你的兼容端点>`，否则 key 被发去 OpenAI 报 401。
   ⚠ **宿主必须允许自定义模型 base URL 才能用**。CLI 宿主（Claude Code / Codex / Copilot CLI，含 `headroom wrap <agent>`）可以；**闭源 GUI IDE（本仓实际用的 Qoder 等）不行**——模型端点不对用户开放，流量改不了道 ⇒ **该形态在本仓日常环境直接不可用**（用户 2026-10-21 指出；本仓未实测，因端点不可改而无从测）。
3. **Agent wrap**：`headroom wrap claude|codex|copilot|cursor|...`（起 proxy + 配好 Agent 走它）。同 2 的前提：只覆盖允许改端点的宿主。
4. **MCP server（本仓已接，见下）**：`headroom mcp serve`，Agent 显式 `headroom_compress` / `headroom_retrieve` / `headroom_stats`。

## 本仓接入现状

- MCP server 已登记进 `my-mcp/servers.json` 正本（`headroom` stdio，`headroom mcp serve`），
  `mcp:build` 扇出到 `.mcp.json`/`.cursor`/`.codebuddy`；边界与 PATH/缺件说明见
  [`my-mcp/README.md` §8](../../my-mcp/README.md)。未装二进制前该 server 连接失败属**预期**（同 cocos-creator 编辑器没开），装上即恢复。

## 削减「模型输出」（字面「减少输出 token」）

⛔ **本节在 Qoder 一类的 GUI IDE 里用不上**：下面两个开关只在 proxy / wrap 宿主生效，
而这类宿主需要能改模型 base URL（见上「四种接入」的第 2 条）。本仓日常环境的真实省幅
靠 `ctx/` 读侧预算体系与命令产出控制（少 `tail`、别整读大文件），**不靠 headroom**。

```bash
export HEADROOM_OUTPUT_SHAPER=1   # 默认关；仅 proxy 模式生效
export HEADROOM_BEACON=off        # 关匿名遥测
```
- Verbosity steering：系统提示尾部加「简短、别复述」，命中 prompt cache。
- Effort routing：例行回合（读完文件/测过的续跑）降思考档；新问题和报错保持满档。

## 收益口径（上游 benchmark，离线可复现）

coding agent ~20%、JSON/log 60–95%、prose/密输出极少；压缩开销 <1ms。准确性在
GSM8K/SQuAD/BFCL 上无可测退化。**以自己真实流量跑 `headroom savings` 为准**。
