# beads GDD 漂移审计整改 Checklist

> 关联 spec：`spec.md` · 任务：`tasks.md`

- [x] `games/beads/src/view/debug-layer.ts` 内不再出现 `rgba(` / `rgb(` 字面量（调试热区填充改由 `ui-theme.ts::UI_DEBUG_HIT_FILL` 提供）。
- [x] `pnpm run check:arch` exit 0（§20-2 转 OK；仅剩 L1 编辑器产物 WARN）。
- [x] `systems-index.md §4` 六处载荷与代码一致：`powerup:used` 含可选 `traySlots`、`meta:overlay {open,name}`、`signin:claimed {day,coins,hearts}`、`stamina:changed {cur,max}`、`wallet:changed {coins}`、新增 `meta:studio-import {ok,detail}`。
- [x] `systems-index.md` 头部版本行 = v1.96 / 任务号 WXG-T-457；`systems-index-changelog.md` 末行 = v1.96 且内容对应。
- [x] §3 冻结常量零改动（`git diff` 中 `systems-index.md` 仅 §4 事件表与头部版本行变化）。
- [x] `check:frozen-values` 的 19 项非原子值 + 47 处不可解析文档式已在报告中逐组判读，且明确 `SKIP ≠ 已验`。
- [x] `games/beads/design/gdd/review-2026-10-27.md` 落盘，含基线 commit、输入清单、漂移表、命令表（命令/退出码/关键输出）、覆盖缺口、结论与 0–3 条沉淀候选。
- [x] `pnpm run check:arch` / `check:frozen-values` / `levels:check` / `palettes:check` / `check:a11y` / `check:links` / `typecheck` 全 exit 0。
- [x] `pnpm --filter @wxgame/beads test` exit 0 且 passed ≥ 1380。
- [x] `production/TASKS.md` 主表行与 `production/TASKS-DETAIL.md` 的 `## WXG-T-457` 小节成对存在，`check:tasks` 通过。
- [x] commit + push 完成，并以 `git ls-remote` + `git reflog show origin/develop` 取证。
- [x] `kb:sync --task=WXG-T-457` 已跑，新增/修改/激活/归档统计摘入结论与台账。
