# 好友榜面板占位（S-3）Spec

## Why

ADR-0035 把微信小游戏开放数据域的好友榜拆成三片：S-1 协议与 Provider（已交付 `43b9a85c`）、S-2 平台透传（已交付 `ce5363ad`）、S-3 游戏侧占位。S-1/S-2 之后，玩家在主菜单与结算面板仍看不到任何榜单入口，协议虽已存在却无消费方。S-3 负责把面板外壳、路由、开合动画和全部状态文案落码，用 harness 截图完成验收；真宿主与好友明细留给 S-4/S-5。

## What Changes

- 新增 `games/beads/src/systems/rank-panel.ts`（已落盘）：`RankPanel` 状态机、`rankPanelLayout()` / `hitRankPanel()`、`RankPanelView`、`ResultPanelClock` 开合、Provider 收发。
- 新增 `games/beads/src/view/rank-view.ts`：`rankTheme()` + `drawRankPanel()`，复用 `drawModalFrame`，零新 hex 字面量。
- `games/beads/src/game/state.ts`：`BeadsSnapshot` 增可选 `rankPanel`，`createSnapshot()` 填 `CLOSED_RANK_VIEW`。
- `games/beads/src/game/beads-game.ts`：持有 `_rankPanel`，接线 `init` attach / `update` / `_routeTap` 最前模态拦截 / `dispose` detach / `_syncSnapshot`，并暴露 `openRank` / `openLevelRank` / `closeRank` / `rankOpen` / `rankView` / `updateRank` / `hitRank` / `tapRank`。
- `games/beads/src/systems/clear-panel.ts`：`ClearPanelAction` 增 `'rank'`，布局增 `rankChip`（110×88，与主钮同排），`hitClearPanel` 先钮后 chip。
- `games/beads/src/game/beads-game/panel-router.ts`：`PanelRouterHost` 增 `openLevelRank()`，`level-clear` 的 `'rank'` 动作派发。
- `games/beads/src/view/view-model.ts`：`drawClearPanel` 在按钮行后绘「好友 / 这关榜」两行纸 chip。
- `games/beads/src/view/meta-view.ts`：`MetaAction` 增 `'open-rank'`，主菜单 CTA 左侧新增「好友榜」纸钮（几何/热区/绘制同源），`buildMetaView` 在主菜单后叠画榜单面板。
- `games/beads/src/game/beads-shell.ts`：`_viewData.rank`、菜单腿 `updateRank`、`_readMenuInput` 模态门、`_applyMetaAction` 派发 `'open-rank'`。
- 测试：新增 `rank-panel.test.ts`，补 clear chip 与 meta `open-rank` 命中用例；重抓金样本。
- 台账 `production/TASKS.md` / `TASKS-DETAIL.md` 记 WXG-T-432；ADR-0035 §5.2 S-3 标 ✅。

**明确不做（Out of scope）**

- ❌ `opendata/` 子域工程与 `game.json` 的 `openDataContext`（S-4）
- ❌ weapp 真实现（`getOpenDataContext` / `setUserCloudStorage` / `sharedCanvas`，S-5）
- ❌ `openSettings` 钩子（S-5）⇒ S-3 不渲染「去设置开启」，未授权态只显示主文案，避免死按钮
- ❌ 好友头像 / 昵称 / 名次行（协议只回 `count`）
- ❌ 分享 / 邀请按钮（空态文案里的「去邀请一位」只是说明）
- ❌ 改动任何 §3 冻结常量、存档形状、`PANEL_SIZE` 560×480

## Impact

- Affected specs：ADR-0035 §5.2 S-3
- Affected code：`games/beads/src/systems/rank-panel.ts`、`games/beads/src/view/rank-view.ts`、`games/beads/src/game/state.ts`、`games/beads/src/game/beads-game.ts`、`games/beads/src/systems/clear-panel.ts`、`games/beads/src/game/beads-game/panel-router.ts`、`games/beads/src/view/view-model.ts`、`games/beads/src/view/meta-view.ts`、`games/beads/src/game/beads-shell.ts`、`games/beads/tests/**`、`production/TASKS*.md`、`docs/architecture/adr/ADR-0035-*.md`
- 施工细则：`production/plans/2026-10-26-wxg-t-432-s3-rank-panel.md`

## ADDED Requirements

### Requirement: 榜单面板占位

系统 SHALL 提供一个可开合的榜单面板，覆盖 `unsupported / loading / ready / empty / no-auth / fail / incompatible` 七种状态，并在 `ready` 时只显示好友上榜**人数**，不显示名次与好友明细。

#### Scenario: 宿主具备开放数据能力

- **WHEN** `services.openData` 存在且面板被打开
- **THEN** 面板进入 `loading`，向 Provider 发送 `render:visible{true}` 与 `init{version:1,theme,board}`
- **AND** 收到版本兼容的 `ready` 后发送恰好一条 `rank:query{board,key,order:'desc',limit:10}`
- **AND** 收到 `rank:ready{count>0}` 后状态为 `ready`，状态行显示 `共 N 位好友上榜`

#### Scenario: 宿主无开放数据能力

- **WHEN** `services.openData` 为 `undefined` 时打开面板
- **THEN** 状态为 `unsupported`，显示「当前环境不支持好友榜」
- **AND** 不向任何 Provider 发送消息

#### Scenario: 空态与失败态

- **WHEN** `rank:ready` 的 `count === 0`
- **THEN** 状态为 `empty`，显示「还没有好友上榜，去邀请一位」
- **WHEN** `rank:error` 的 `code === 'no-auth'`
- **THEN** 状态为 `no-auth`，显示「未授权，无法显示好友榜」
- **WHEN** `rank:error` 的 `code` 为 `api-missing` 或其它
- **THEN** 状态为 `fail`，显示「好友榜暂时打不开，稍后再试」

#### Scenario: 版本错位

- **WHEN** 收到 `ready` 且 `version` 与 `OPEN_DATA_VERSION` 不兼容
- **THEN** 状态为 `incompatible`，显示「好友榜版本不匹配，请更新后再试」
- **AND** 不发送 `rank:query`

#### Scenario: 关闭

- **WHEN** 玩家点击「返回」
- **THEN** 面板播放退场动画，向 Provider 发送一次 `render:visible{false}`
- **AND** 退场期点击被吞掉（模态），动画结束后 `visible === false`

#### Scenario: 退订后隔离

- **WHEN** 面板已 `detach()`
- **THEN** 后续 Provider 事件不改变面板状态

### Requirement: 结算面板「好友这关榜」上下文入口

系统 SHALL 在过关结算面板的按钮行右侧提供「好友这关榜」纸 chip，点击后打开 `board='settle'`、`key=当前关` 的榜单面板。

#### Scenario: 命中与派发

- **WHEN** 玩家点击 chip 区域
- **THEN** `hitClearPanel` 返回 `'rank'`，播放 UI 点击音，调用 `openLevelRank()`
- **AND** chip 右缘与面板内边距对齐，不与主钮重叠

### Requirement: 主菜单「好友榜」入口

系统 SHALL 在主菜单底部 CTA 左侧提供一个「好友榜」纸钮，点击后打开 `board='settle-total'` 的榜单面板。

#### Scenario: 命中与派发

- **WHEN** 玩家点击该钮
- **THEN** `hitTestMeta` 返回 `open-rank`，shell 派发 `play.openRank('settle-total','')`

#### Scenario: 面板覆盖与输入模态

- **WHEN** 榜单面板在主菜单上可见
- **THEN** 菜单输入被拦截，只处理面板按钮的按下/抬起
- **AND** 面板绘制在菜单之上，开合进度来自 `RankPanelView.progress`

## MODIFIED Requirements

### Requirement: 结算面板按钮行

原按钮行只有主钮（下一关 / 冲刺）与次钮；SHALL 在主钮右侧新增 `rankChip`，主钮宽度与位置保持不变，`PANEL_SIZE` 与既有 `CLEAR_BUTTON_W` 零改动。

## REMOVED Requirements

None
