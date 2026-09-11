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
