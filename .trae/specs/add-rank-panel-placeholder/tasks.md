# Tasks

- [x] Task 1: 完成榜单面板视图层 `rank-view.ts`
  - [x] SubTask 1.1: 实现 `rankTheme(palette)`，字段值按施工单 §2.1（bg/rowBg/rowBgSelf/text/accent/avatarSize 56/rowH `TOUCH_MIN`/fontPx 26）
  - [x] SubTask 1.2: 实现 `drawRankPanel(builder, palette, view)`：`!visible` 直接返回；`drawModalFrame` 复用遮罩与纸面板；标题 / 副标 / 状态行按 `UI_FONT.panelTitle` 与 `bodyFont(largeText,'sub')`
  - [x] SubTask 1.3: 按 `rankPanelLayout(view.settings).buttons` 逐钮 `drawButton`（返回=paper，去设置开启=wood），零 hex 字面量

- [x] Task 2: 接线 `BeadsGame` 与快照
  - [x] SubTask 2.1: `state.ts` 增 `rankPanel?: RankPanelView`，`createSnapshot()` 填 `CLOSED_RANK_VIEW`
  - [x] SubTask 2.2: `beads-game.ts` 增 `_rankPanel` 字段（`theme: rankTheme(this.palette)`），`init` attach、`dispose` detach、`update` 推进
  - [x] SubTask 2.3: `_routeTap` 最前加模态拦截（面板可见即吞点击并派发面板按钮）
  - [x] SubTask 2.4: 暴露 `openRank` / `openLevelRank` / `closeRank` / `rankOpen` / `rankView` / `updateRank` / `hitRank` / `tapRank`
  - [x] SubTask 2.5: `_syncSnapshot()` 回填 `s.rankPanel = this._rankPanel.view()`

- [x] Task 3: 结算面板「好友这关榜」入口
  - [x] SubTask 3.1: `clear-panel.ts` 增 `'rank'` 动作、`rankChip`（110×88，`x = primary.xMax + CLEAR_BUTTON_GAP`）、命中与标签
  - [x] SubTask 3.2: `panel-router.ts` 增 `openLevelRank()`，`level-clear` 的 `'rank'` 派发
  - [x] SubTask 3.3: `view-model.ts` 的 `drawClearPanel` 绘两行纸 chip 与按下位移

- [x] Task 4: 主菜单「好友榜」入口与 shell 菜单腿
  - [x] SubTask 4.1: `meta-view.ts` 增 `MetaAction 'open-rank'`、`rankBox/rankHit`、热区项与纸钮绘制
  - [x] SubTask 4.2: `MetaViewData.rank` 与 `buildMetaView` 叠画 `drawRankPanel`
  - [x] SubTask 4.3: `beads-shell.ts` 增 `_viewData.rank`、`_metaViewData` 回填、菜单腿 `updateRank`、`_readMenuInput` 模态门、`_applyMetaAction` 派发

- [x] Task 5: 测试与金样本
  - [x] SubTask 5.1: 新增 `games/beads/tests/rank-panel.test.ts`，覆盖施工单 §4.1 的 9 条用例
  - [x] SubTask 5.2: 补 clear chip 命中（`hitClearPanel` 返回 `'rank'`、chip 右缘对齐）与 meta `open-rank` 命中
  - [x] SubTask 5.3: 用 `tests/ui-golden-capture.ts` 重抓金样本（禁止手改）
  - [x] SubTask 5.4: 跑 beads 测试 + `pnpm run typecheck` + `check:arch`

- [x] Task 6: 文档与台账
  - [x] SubTask 6.1: `production/TASKS.md` / `TASKS-DETAIL.md` 记 WXG-T-432
  - [x] SubTask 6.2: ADR-0035 §5.2 S-3 标 ✅ 并把 §8 推进到 S-4（含 `ui-architecture-beads.md` §12 视觉变更登记 + harness 截图证据）

- [x] Task 7: 门禁与提交
  - [x] SubTask 7.1: 全量门禁 `pnpm test` / `check:links` / `ctx:build && ctx:check` / `sync:check`
  - [x] SubTask 7.2: 台账与代码同笔提交并推送，`git ls-remote` + `reflog` 取证
  - [x] SubTask 7.3: ADR 单独 docs 提交（scope `architecture`）
  - [x] SubTask 7.4: `kb:sync -- --task=WXG-T-432` 并回报沉淀统计

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 and Task 4 can run in parallel after Task 2
- Task 5 depends on Tasks 3 and 4
- Task 6 depends on Task 5
- Task 7 depends on Task 6
