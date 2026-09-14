# 验证与常用命令（docs/agent/commands.md）

> **来源**：自 `AGENTS.md` §6「验证与常用命令」**逐字迁出** · 日期 2026-09-13 · Task ID WXG-T-032（AGENTS.md 瘦身拆分）。
> 正文与迁出前完全一致（仅另加本指针与标题），语义未改动。AGENTS.md 中保留 1 行指针。

## 验证与常用命令

| 命令 | 用途 |
|---|---|
| `pnpm run verify` | 全量门禁：架构守卫 + 四 IDE 链接 + 关卡 check + typecheck + test + harness 编译 + 冒烟 |
| `pnpm run check:arch` | 架构守卫 |
| `pnpm run check:links` | 四 IDE agents/skills/memory/规则指针完整性（**pre-commit 必跑**） |
| `pnpm run harness` | 启动浏览器验证器 |
| `pnpm run harness:build` / `harness:smoke` | 只编译 / 运行时冒烟 |
| `pnpm run ctx:rotate` | 读账本 `ctx/reads-ledger.jsonl` 分窗轮转（WXG-T-037 R1；默认窗口 20 会话，溢出才落盘） |
| `pnpm run tasks:archive` | 任务台账 `production/TASKS.md` 完成 ≥30 天的 ✅ 行归档（WXG-T-040 R3；默认 dry-run，`--write` 落盘；头注号校准为「主表∪归档全局最大号+1」防并行重号；**成对搬运**（WXG-T-065）：行 → `archive/TASKS-archive.md`、详情节 → `archive/TASKS-DETAIL-archive.md`，**节数 == 行数**否则不落盘；自测 `archive-tasks-selftest.sh`） |
| `pnpm run check:tasks` | 台账格式门（WXG-T-064，已进 `verify`）：主表名称 ≤60 字符 / 任务行连续 / **行⇔详情小节配对** / 无残留已归档小节 / 详情归档不脱钩；`--prune` 把残留小节**搬入**详情归档（搬，不删） |
| `pnpm run memory:distill` | memory 日志满 30 天蒸馏轮转（WXG-T-041 R2；默认 dry-run，`--write` 移入 `memory/archive/` 并在 MEMORY.md 追加待蒸馏提醒；脚本只做机械轮转，蒸馏进 MEMORY.md 由人/会话负责，规程见 `docs/agent/memory-distill.md`） |
| `pnpm run preview:frames` | 关卡 SVG 预览 |
| `pnpm run preview:clip --level 1 --seconds 8` | MP4 实录（需 ffmpeg 与可用的 `@resvg/resvg-js`） |

Node ≥ 20；包管理器以根 `package.json` 的 `packageManager` 为准（pnpm）。
