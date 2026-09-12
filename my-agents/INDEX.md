# my-agents — 工作室 SubAgent 正本

> 与 `my-skills/` 同级：角色执行者定义在此；方法论在 skill。  
> 四 IDE 经相对符号链接引用（见下）。新增 agent：正本放本目录，四处各建链接。

## 现役成员（6）+ 编排（1）

| name | 角色 | 职责 | Skill | 写权限 |
|---|---|---|---|---|
| `studio-orchestrator` | 主理人 | 阶段诊断 / spawn / 门控裁决 / 汇编 | `wxgame-orchestration` | **readonly**（只编排） |
| `design-strategist` | 文策渊 | 概念 / GDD / 评审 / UX | `wxgame-gdd-writer` → `wxgame-ux-spec` | 可写（经批准） |
| `engineering-lead` | 程基岩 | ADR / 架构 / Epic·Story | `wxgame-adr-arch` + `wxgame-epic-split` | 可写（经批准） |
| `art-director` | 林绘澄 | 美术三件套 / 可访问性 | `wxgame-art-spec-programmatic` | 可写（经批准） |
| `audio-director` | 阮和鸣 | 音频规格五件套 | `wxgame-audio-spec`（生成另派执行 pack） | 可写（经批准） |
| `quality-lead` | 严守真 | QA 五件套 / G1–G4 证据 | `wxgame-qa-gates` | **readonly** |
| `release-ops-lead` | 路远行 | 发布四件套 / 回滚 | `wxgame-release-checklist` | 可写（经批准） |

## 四 IDE 链接

| IDE | 路径 |
|---|---|
| Cursor | `.cursor/agents/<name>.md` → `../../my-agents/<name>.md` |
| CodeBuddy | `.codebuddy/agents/<name>.md` → `../../my-agents/<name>.md` |
| WorkBuddy | `.workbuddy/agents/<name>.md` → `../../my-agents/<name>.md` |
| Qoder | `.qoder/agents/<name>.md` → `../../my-agents/<name>.md` |

## 与编排的关系

- 主理人按 `my-skills/wxgame-orchestration/SKILL.md` spawn；Task prompt 必含**八要素**。
- SubAgent 文件 = 角色常驻设定；**不等于**一次任务单。
- 委派时 `subagent_type` / 文件名 = 上表 `name`。
- 执行层音频生成：`indie-game-ost-pack` / `game-ui-voice-pack`（经阮和鸣规格与主理人调度）。
- 主对话**不会**自动变成主理人；触发条件见 `AGENTS.md` §2「主理人触发条件」。需要编排人格时 `@studio-orchestrator`。

## Frontmatter 约定（共享正本）

Cursor 官方字段：`name` · `description` · `model` · `readonly` · `is_background`。  
**不要**在共享正本里加未经四 IDE 实测的 `tools:` / `permissionMode:` / `skills:`（Cursor 不认；其它家方言未验证）。Skill 加载靠 spawn prompt 必附路径 + `check:links` 校验。

`studio-orchestrator` / `quality-lead` 必须 `readonly: true`（由 `pnpm run check:links` 强制）。

## 符号链接

- **Cursor**：已实测跟随 `.cursor/agents/` 内指向 `my-agents/` 的 symlink（委派链路冒烟通过）。
- **CodeBuddy / WorkBuddy / Qoder**：尚未用各家 CLI 实测；若某 IDE 不认 symlink，再对该家改复制 + 同步命令（勿默认四家都改复制）。
