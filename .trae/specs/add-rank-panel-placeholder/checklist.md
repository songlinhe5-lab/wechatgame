# Checklist

- [x] `rank-view.ts` 实现 `drawRankPanel`（复用 `drawModalFrame`，无 hex 字面量）；`rankTheme` 落 `systems/rank-panel.ts`（结构入参 `RankThemeSource`，避免 game→view 新增 L6 边）
- [x] 面板七态文案与施工单 §2.1 逐字一致，`ready` 只显示人数
- [x] `BeadsSnapshot.rankPanel` 可选且默认 `CLOSED_RANK_VIEW`，既有测试字面量零改动
- [x] `BeadsGame` 完成 attach / update / `_routeTap` 模态拦截 / dispose / 快照回填
- [x] 无 `services.openData` 时打开面板落 `unsupported` 且不发送任何消息
- [x] 收到兼容 `ready` 后只发一条 `rank:query{limit:10}`；版本不兼容时不发 query
- [x] 关闭时发送恰一条 `render:visible{false}`，退场期点击被吞
- [x] 结算面板 chip 命中返回 `'rank'`，右缘与 `panel.xMax - PANEL_PADDING` 对齐，主钮几何不变
- [x] 主菜单「好友榜」钮命中 `open-rank`，派发 `openRank('settle-total','')`
- [x] 榜单面板在主菜单上绘制于菜单之上，输入被模态拦截
- [x] 新增测试覆盖 9 条用例并全绿；clear chip 与 meta `open-rank` 命中用例全绿
- [x] 金样本经 `ui-golden-capture.ts` 重抓，无手改
- [x] `pnpm run typecheck`、`check:arch`、`pnpm test`、`check:links`、`ctx:check`、`sync:check` 全绿
- [x] 台账 WXG-T-432 与代码同笔提交并推送取证；ADR-0035 S-3 单独 docs 提交
- [x] `kb:sync -- --task=WXG-T-432` 完成并回报沉淀统计
- [x] 未改动 §3 冻结常量、存档形状、`PANEL_SIZE` 与 `packages/framework/src/**`
- [x] `tools/scripts/*.mjs` 的他人未提交改动未被纳入本批提交
