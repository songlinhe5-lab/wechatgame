---
name: game-studio
description: 通用游戏开发工作室知识库（Godot/Unity/Unreal 引擎查漏，本仓库存档保留）。仅当用户明确点名「game-studio」，且任务超出本仓库 wxgame-* 系列覆盖范围时才使用。不要因「从零开发游戏」「写 GDD」「代码审查」「游戏设计」等泛化关键词自动触发——那些任务走 wxgame-* 系列。
disable-model-invocation: true
---

# Game Studio（本仓：引擎查漏知识库，非主流程）

> **本仓定位**：仅在用户**明确点名**本 skill，且需要 Godot/Unity/Unreal 等通用引擎知识时使用。
> 本仓默认管线、GDD/UX/ADR/Epic/QA/发布一律走 `my-skills/INDEX.md` 与 `wxgame-*`。
> 禁止把本 skill 当成「从零开发游戏」的主流程入口。

## References 按需索引（禁止整包读入）

references/ 共约 1800 行，按需 Read **单一文件**的对应小节，一次最多加载一个文件：

| 文件 | 主题 | 何时读 |
|---|---|---|
| `references/agents.md`（397 行） | 49 个代理分三层：管理/设计/开发/引擎专家 | 需要查「谁该做某事」时 |
| `references/brainstorm.md`（223 行） | 五阶段头脑风暴流程 | 用户明确要走通用头脑风暴时 |
| `references/code.md`（292 行） | 代码审查清单/常见问题/引擎最佳实践 | 通用引擎代码审查时 |
| `references/design.md`（265 行） | 通用 8 节 GDD 模板与设计流程 | 对照参考时（本仓以 `wxgame-gdd-writer` 为准） |
| `references/templates.md`（633 行） | 各类文档模板合辑 | 只读需要的那一节 |

## 概览

| 组件 | 数量 | 说明 |
|------|------|------|
| Agents（代理） | 49 个 | 专业开发角色索引，见 `references/agents.md` |
| 工作流条目 | 约 10 个核心主题 | 头脑风暴/设计/架构/冲刺/QA 等**概念索引**，非 Cursor slash 命令 |

本仓没有 `/start`、`/design-system` 等可执行 slash command；需要对应能力时：

- 本仓流程 → 查 `my-skills/INDEX.md`，用对应 `wxgame-*` skill
- 仅引擎通用知识 → 按上表 Read 单个 reference 文件

## Agent 索引（摘要）

完整列表与职责见 `references/agents.md`。常用入口：

- 管理层：`creative-director` / `technical-director` / `producer`
- 设计层：`game-designer` / `systems-designer` / `art-director` / `ux-designer` / `qa-lead` 等
- 引擎专家：`godot-*` / `unity-*` / `ue-*` 系列

## 与本仓 wxgame 的边界

| 需求 | 走哪里 |
|---|---|
| 八节 GDD / systems-index / 设计评审 | `wxgame-gdd-writer` |
| UX 规格 / 首屏留存 | `wxgame-ux-spec` |
| ADR / 架构 / 控制清单 | `wxgame-adr-arch` |
| Epic/Story | `wxgame-epic-split` |
| QA 五件套 / G1–G4 | `wxgame-qa-gates` |
| 微信发布 | `wxgame-release-checklist` |
| 全流程编排 | `wxgame-orchestration` |
| Godot/Unity/Unreal 具体 API/最佳实践 | 本 skill → 按需读 `references/` |

## 协作原则（若被点名启用）

1. 提问 → 理解需求与约束  
2. 选项 → 提供 2–4 个方案  
3. 决策 → 用户拍板  
4. 草稿 → 展示后再写入  
5. 本仓路径与冻结常量冲突时，以 `systems-index.md` §3 与 `wxgame-*` 为准  
