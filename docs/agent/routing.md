# 默认路由细节（docs/agent/routing.md）

> **来源**：自 `AGENTS.md` §2「默认怎么干活」迁出的**细节部分**（skill 优先级、四 IDE 路径、新增 skill 步骤等）
> · 日期 2026-09-13 · Task ID WXG-T-032（AGENTS.md 瘦身拆分）。AGENTS.md 保留精简路由表与主理人触发条件（原文未动）。
> 各小节正文逐字保留自迁出前文本，仅另加本指针、标题与少量过渡句，语义未改动。

## Hooks / 提交门禁 / Headless 指针

- **Hooks / 提交门禁**：`docs/agent/hooks-best-practices.md`（自原 §8 分层阅读指引，AGENTS.md 现 1 行指针）
- **Headless / PR 流水线**：`docs/agent/headless-ci-pr-review.md`

## Skill 优先级（冲突时高者胜）

```text
orchestration > wxgame-* 域 skill > 执行 pack > 外来通用（仅点名）
```

## Skill 正本与 IDE 链接（四 IDE 入库 + Trae 本地）

**Skill 正本**：`my-skills/<name>/`。四处入库 IDE 链接（相对符号链接，随仓库提交）：

- `.cursor/skills/` · `.codebuddy/skills/` · `.workbuddy/skills/` · `.qoder/skills/`
- Trae（本地可选，不入库）：`.trae/skills/`（存在时 `check:links` 按同一规则校验）

新增 skill：正本进 `my-skills/`，四处各建 `../../my-skills/<name>` 链接；Trae 本地另建同目标链接。

## SubAgent IDE 路径（四 IDE 入库 + Trae 本地）

工作室成员委派：正本 `my-agents/`（6 成员 + `studio-orchestrator`）；委派时 `subagent_type` = `<name>`。
四 IDE：`.cursor|.codebuddy|.workbuddy|.qoder/agents/<name>.md` → `../../my-agents/<name>.md`；Trae 本地 `.trae/agents/<name>.md` 同目标（不入库）。清单见 `my-agents/INDEX.md`。

## 跨域先交编排

跨域或「整款游戏从哪开始」→ 先交编排，不要自己跳着写全套文档。

`studio-orchestrator` 是**可召唤的 SubAgent**，不会自动占据主对话。主对话遵守上表即可；需要完整编排人格时再显式委派。

> 注：上句「上表」指 `AGENTS.md` §2 的主理人触发条件表（原文逐字保留于此，WXG-T-032）。

## 规则件与 MEMORY 件的四 IDE 落位（+ Trae 本地）

> **迁出缘由**（2026-10-18 · WXG-T-292 瘦身续批）：`AGENTS.md` 受 `ctx:check` **A 项常驻硬上限**（见 `ctx/BUDGET.md` §1）约束，而这两张表是**逐条路径清单**：① always-on 规则件 `my-rules/agents-md.md` 已写明「四 IDE 规则路径均为指向本文件的相对符号链接」；② 链接存在性由 `pnpm run check:links` **机械守**（断链即红）。⇒ 常驻层只留结论与指针，路径表以本文为正本。（⚠ 本节故意不再开三级小标题：每个标题都会变成 `ctx/hot-files.md` 的一行锚点，而那张贴纸式的速查表也有体积硬门。）

**一、提示词（always-on 规则件）** —— 正文正本 `my-rules/agents-md.md`（并集 frontmatter），**不要**在 `.cursor/rules` 等处改摘要：

| IDE | 链接路径 |
|---|---|
| Cursor | `.cursor/rules/agents-md.mdc` → `../../my-rules/agents-md.md` |
| CodeBuddy | `.codebuddy/rules/agents-md/RULE.mdc` → `../../../my-rules/agents-md.md` |
| WorkBuddy | `.workbuddy/rules/agents-md/RULE.mdc` → `../../../my-rules/agents-md.md` |
| Qoder | `.qoder/rules/agents-md.md` → `../../my-rules/agents-md.md` |
| Trae | `.trae/rules/agents-md.md` → `../../my-rules/agents-md.md`（本地可选、不入库；`alwaysApply: true`；同目录递归 ≤3 层） |

**二、长期笔记 MEMORY（四 IDE 可索引 + Trae 直读）**

| 角色 | 路径 |
|---|---|
| **正本** | `memory/MEMORY.md`（日记：`memory/YYYY-MM-DD.md`） |
| WorkBuddy | `.workbuddy/memory` → `../memory` |
| CodeBuddy | `.codebuddy/memory` → `../memory` |
| Qoder | `.qoder/memory` → `../memory` |
| Cursor | `.cursor/memory/MEMORY.md`（入口指针；内容请读正本） |
| Trae | 无独立链接；`.trae/rules/agents-md.md` 指向正本，按其中协议直读 `memory/` + `knowledge/` |

