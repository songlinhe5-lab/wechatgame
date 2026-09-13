# wxgame-minigame-bridge

微信小游戏 MCP 的**仓库适配层** skill。使用指南见 [SKILL.md](./SKILL.md)。

## 目录

```
SKILL.md                                适配层正文（触发词 / 路径适配 / 工作流）
references/official-skill-0.1.4.md      官方 SKILL.md v0.1.4 逐字节留档
references/official-readme-0.1.4.md     官方 README v0.1.4 逐字节留档
```

## 留档来源

`references/` 两文件为 2026-09-13 从 CodeBuddy 插件
`weixin-minigame-helper@0.1.4` 缓存副本（源 `git.woa.com/weadmin/ai-minigame-engine`，
MIT）原样复制，**未做任何修改**。插件 8+ 文件的完整 vendor 正本在
`my-plugins/weixin-minigame-helper/0.1.4/`（见 `my-plugins/README.md`）。

> 注意：留档是 v0.1.4 时代的官方文档快照，其中 MCP 工具表、路径假设等可能随上游
> 演进（MCP 包已至 0.1.13）过时。与 `SKILL.md` 冲突时，**以 SKILL.md（本仓适配层）为准**。

## 演进

- 原 `my-skills/weixin-minigame-helper`（v0.1.4 快照副本）于 WXG-T-035 改名改造为本目录，
  消解与 CodeBuddy 插件内置 skill 的同名双注册。决策链：ADR-0010 → 本目录。
