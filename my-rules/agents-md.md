---
description: 项目常驻记忆层指针 — AGENTS.md + memory/MEMORY.md
alwaysApply: true
enabled: true
trigger: always_on
---

# 遵循项目 AGENTS.md 与 MEMORY

> **正本**：`my-rules/agents-md.md`。四 IDE 规则路径均为指向本文件的相对符号链接。

1. **常驻指引**：`AGENTS.md` — 无要点先 Read。
2. **长期笔记**：`memory/MEMORY.md`（约定/脚本/限制，可常读）。日记**定向查**（改旧政/接续未完/追溯裁定/排障）：先 `memory/INDEX.md` 定位再读那一节。

摘要（细节以正本为准）：

- 全流程 / 跨域 / 新游戏或新系统 / 发布决策 → 先阶段 0 或 `@studio-orchestrator`；单域小改直调 `wxgame-*`
- 工程铁律 L1–L5 → `docs/architecture/control-manifest.md`
- 读文件协议 → **第一跳** `ctx/ROUTES.md` 锚点，**第二跳** `ctx/hot-files.md` 取 offset/limit；**禁止**大文件整读
- 数值真源 → `games/<game>/design/gdd/systems-index.md` §3
- 全量验证 → `pnpm run verify`；提交前链接门 → `pnpm run check:links`
- 先问再写；不伪造编辑器产物；不擅自 commit/push
- **ponytail 必触发（编码类）**：写/改/重构/修复代码开工前调用，按规模定档——小改 `lite`、常规 `full`（默认）、选型/重构 `full`＋最简对比；非编码不用
- **本轮触发分析**：每轮回复末尾一行列**本轮**触发的 skill（名称 + 次数 + 方式：自动/手动）；无则写「无」；不累计全会话

不要把 `game-studio` / `game-dev-tool-free` 当默认入口。
