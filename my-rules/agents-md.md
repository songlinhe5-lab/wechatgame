---
description: 项目常驻记忆层指针 — AGENTS.md + memory/MEMORY.md
alwaysApply: true
enabled: true
trigger: always_on
---

# 遵循项目 AGENTS.md 与 MEMORY

> **正本**：`my-rules/agents-md.md`。四 IDE 规则路径均为指向本文件的相对符号链接（见 `AGENTS.md` 文首表）。

1. **常驻指引**：根目录 `AGENTS.md` — 若上下文尚无要点，先 Read。
2. **长期笔记**：`memory/MEMORY.md`（约定/脚本/已知限制，可常读）。日记详情**按触发定向查**（改旧政 / 接续未完 / 追溯用户裁定 / 排障找确诊法）：先 `memory/INDEX.md` 定位，再读那一节。

摘要（细节以正本为准）：

- 全流程 / 跨域 / 新游戏或新系统 / 发布决策 → 先阶段 0 或 `@studio-orchestrator`（见 `AGENTS.md` §2 触发条件）；单域小改直调 `wxgame-*`
- 工程铁律 L1–L5 → `docs/architecture/control-manifest.md`
- 读文件协议 → **第一跳** `ctx/ROUTES.md` 命中锚点，**第二跳** `ctx/hot-files.md` 取 `offset`/`limit`；**禁止**对大文件无条件整读
- 数值真源 → `games/<game>/design/gdd/systems-index.md` §3
- 全量验证 → `pnpm run verify`；提交前链接门 → `pnpm run check:links`（见 `docs/agent/hooks-best-practices.md`）
- 先问再写；不伪造编辑器产物；不擅自 commit/push

不要把 `game-studio` / `game-dev-tool-free` 当默认入口。
