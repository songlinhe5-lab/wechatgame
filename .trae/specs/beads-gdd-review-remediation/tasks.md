# beads GDD 漂移审计整改 Tasks（2026-10-27）

> 关联 spec：`.trae/specs/beads-gdd-review-remediation/spec.md`
> 开工前：重新读 `production/TASKS.md` 领号锚（当前下一可用号 `WXG-T-457`），领号后回填主表 + 详情节。

## T1 · P1 修复：调试层 rgba 搬进 UiTheme

- [x] `games/beads/src/view/ui-theme.ts` 新增 `UI_DEBUG_HIT_FILL = 'rgba(255,60,230,0.14)'`（注释标明调试层专用、⛔ 不进 palette）。
- [x] `games/beads/src/view/debug-layer.ts` 删除本地 `HIT_BOX_FILL_HEX`，改从 `./ui-theme.js` 导入。
- [x] `pnpm run framework:sync` 同步 Cocos 镜像两文件。
- [x] 验证：`pnpm run check:arch` exit 0。

## T2 · §4 事件表对齐（文档跟随代码）

- [x] `systems-index.md §4`：`meta:overlay` 改 `{open, name}` + 取值 `none|signin|settings|levels|skins`。
- [x] `systems-index.md §4`：`signin:claimed` 改 `{day, coins, hearts}`。
- [x] `systems-index.md §4`：`wallet:changed` 改 `{coins}`（删 delta）。
- [x] `systems-index.md §4`：`stamina:changed` 改 `{cur, max}`。
- [x] `systems-index.md §4`：`powerup:used` 补可选 `traySlots`。
- [x] `systems-index.md §4`：新增 `meta:studio-import {ok, detail}`（调试通道）。
- [x] `systems-index-changelog.md` 追加 v1.96；`systems-index.md` 头部版本行同步 v1.96 + 任务号。
- [x] 验证：`pnpm run check:frozen-values` exit 0。

## T3 · SKIP 清单人工判读（只读）

- [x] 取 `check:frozen-values` 的 19 项非原子值，逐条标 `派生可证 / 需设计复核 / 文档式应改写`。
- [x] 取 47 处不可解析文档式，同上标注。
- [x] 结论写入 review 报告；如需改值 → 停止并另开 §3 变更单（**新发现 `TRAY_BAND` 216 vs 230，只登记未改**）。

## T4 · review 报告落盘

- [x] 新建 `games/beads/design/gdd/review-2026-10-27.md`。
- [x] 内容含：基线 `723b50d9`、输入清单、漂移表（8 行）、命令表、覆盖缺口、结论 CONCERNS、3 条沉淀候选。

## T5 · 全量验证、提交与沉淀

- [x] `pnpm run check:arch` / `check:frozen-values` / `check:links` / `typecheck` 全 exit 0。
- [x] `pnpm --filter @wxgame/beads test` exit 0（1380 passed / 2 skipped）。
- [x] commit + push；以 `git ls-remote` + `git reflog show origin/develop` 取证（`ce4c6370`，远程 develop 指针已确认）。
- [x] `kb:sync --task=WXG-T-457`，统计摘入结论（新增 K-190 / K-191 / K-192，修改 0，激活 0，归档 0）。

## 验收汇总

- [x] 漂移表 8 行全部关闭或登记归属（T3 新增 `TRAY_BAND` 实漂，归属 = 待用户裁定后另开 §3 变更单）。
- [x] §3 冻结常量零改动（`git diff` 证明）。
- [x] review 报告落盘且路径经用户批准。
