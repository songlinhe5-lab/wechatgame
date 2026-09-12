# my-rules — 跨 IDE 常驻规则正本

> 与 `my-agents/` / `my-skills/` 同级：**提示词正文只维护此处**；各 IDE `rules/` 下为相对符号链接。

| 正本 | 用途 |
|---|---|
| `agents-md.md` | alwaysApply 短指针 → 引导读 `AGENTS.md` / `memory/MEMORY.md` |

## 四 IDE 链接

| IDE | 链接路径 | 相对目标 |
|---|---|---|
| Cursor | `.cursor/rules/agents-md.mdc` | `../../my-rules/agents-md.md` |
| CodeBuddy | `.codebuddy/rules/agents-md/RULE.mdc` | `../../../my-rules/agents-md.md` |
| WorkBuddy | `.workbuddy/rules/agents-md/RULE.mdc` | `../../../my-rules/agents-md.md` |
| Qoder | `.qoder/rules/agents-md.md` | `../../my-rules/agents-md.md` |

Frontmatter 使用**并集**（`alwaysApply` + `enabled` + `trigger: always_on`），以便四家各自认自己的键、忽略未知键。改摘要只改 `my-rules/agents-md.md`。

`pnpm run check:links` 校验上述链接无断链。
