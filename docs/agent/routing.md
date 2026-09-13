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

## Skill 正本与四 IDE 链接

**Skill 正本**：`my-skills/<name>/`。四处 IDE 链接（相对符号链接，随仓库提交）：

- `.cursor/skills/` · `.codebuddy/skills/` · `.workbuddy/skills/` · `.qoder/skills/`

新增 skill：正本进 `my-skills/`，四处各建 `../../my-skills/<name>` 链接。

## SubAgent 四 IDE 路径

工作室成员委派：正本 `my-agents/`（6 成员 + `studio-orchestrator`）；委派时 `subagent_type` = `<name>`。
四 IDE：`.cursor|.codebuddy|.workbuddy|.qoder/agents/<name>.md` → `../../my-agents/<name>.md`。清单见 `my-agents/INDEX.md`。

## 跨域先交编排

跨域或「整款游戏从哪开始」→ 先交编排，不要自己跳着写全套文档。

`studio-orchestrator` 是**可召唤的 SubAgent**，不会自动占据主对话。主对话遵守上表即可；需要完整编排人格时再显式委派。

> 注：上句「上表」指 `AGENTS.md` §2 的主理人触发条件表（原文逐字保留于此，WXG-T-032）。
