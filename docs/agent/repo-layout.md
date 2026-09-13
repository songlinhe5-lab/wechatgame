# 仓库目录与产物落位（docs/agent/repo-layout.md）

> **来源**：自 `AGENTS.md` §5「目录与产物落位」**逐字迁出** · 日期 2026-09-13 · Task ID WXG-T-032（AGENTS.md 瘦身拆分）。
> 正文与迁出前完全一致（仅另加本指针与标题），语义未改动。AGENTS.md 中保留 1 行指针。

## 目录与产物落位

```text
packages/framework/src/
  core/        引擎无关（默认可单测）
  adapters/    cocos / canvas2d 桥接
  platform/    node / web / weapp
games/<game>/
  design/      概念 · GDD · UX · 关卡 JSON
  art/         美术圣经 · 资产规格 · 可访问性
  src/         玩法（引擎无关）
  tests/       vitest（纯 Node）
  cocos/       仅 Bootstrap 壳
docs/architecture/   主架构 · ADR · 控制清单
production/qa|release|epics|sprints/
dev/harness/         浏览器验证器
my-skills/           Agent Skills 正本 + INDEX.md
my-agents/           SubAgent 正本 + INDEX.md
my-rules/            跨 IDE alwaysApply 规则正本 + INDEX.md
knowledge/           知识库（教训 lessons / 模式 patterns + INDEX 读写协议）
tools/scripts/       架构守卫 · 关卡同步 · harness · 预览
```

关卡：**JSON 为准**（如 `games/breakout/design/levels/levels-01-05.json`）→ 生成 `src/config/levels-data.ts`，用 `pnpm run levels:sync` / `levels:check`。
