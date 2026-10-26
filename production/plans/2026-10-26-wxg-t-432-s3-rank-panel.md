# WXG-T-432 · S-3 施工单：榜单面板占位 + 结算面板「好友这关榜」上下文入口

- **上位**：`docs/architecture/adr/ADR-0035-minigame-open-data-domain-friend-leaderboard.md` §3.1 协议 / §3.2 Q1=B（榜页唯一总榜 `settle-total`；分关榜 `settle` 只作结算面板上下文入口）/ §3.4 授权流程 / §5.2 **S-3**
- **状态**：✅ **已批准**（2026-10-26）。⚠ 任务号原拟 431，但 431 已被「§3.6 v1.95 道具落码批」占用（`f2c115a0` / `a53e52a3`，已在 origin）⇒ 本单按 TASKS 头注机械改用 **432**，施工内容不变。
- **前序**：S-1 `43b9a85c`（WXG-T-426，core 协议 + Noop/Mock）；S-2 `ce5363ad`（WXG-T-430，`Platform.createOpenDataProvider?()` + `GameServices.openData?` + `App.dispose`）
- **目标**：在两处入口（主菜单 + 结算面板）挂出榜单面板**占位**：路由、开合动画、空态 / 未授权 / 无能力 / 版本错位文案全部就位；**不接真宿主、不画好友行**（`rank:ready` 只回 `count`，主域拿不到名次与明细）。验收 = harness 截图。

---

## 0. 开工前状态（已解除）

原阻塞 = 工作区有一批 WXG-T-419/429 在途改动（12 个文件，道具换版）且基线 `typecheck` 红。开工前复查：

- 该批已由并发会话提交为 `f2c115a0` + `a53e52a3`（均已在 `origin/develop`）；
- 本地 `develop` 与远端一致，`pnpm run typecheck` **全绿**；
- 未执行任何 stash（`git stash push` 时已无可存改动）；
- 当前仅剩 `tools/scripts/*.mjs` 的**他人**未提交改动，与本单零重叠，⛔ 不纳入本单提交。

---

## 1. 范围（In / Out 一刀切）

**In**

| # | 交付 |
|---|---|
| 1 | 新 `games/beads/src/systems/rank-panel.ts`：面板状态机 + 布局/命中 + `ResultPanelClock` 开合 + Provider 收发 |
| 2 | 新 `games/beads/src/view/rank-view.ts`：`drawRankPanel()`（复用 `drawModalFrame`，零新 hex） |
| 3 | `state.ts`：`BeadsSnapshot.rankPanel?: RankPanelView` |
| 4 | `beads-game.ts`：持有面板、`init` attach / `dispose` detach、`update` 推进、`_routeTap` 最前模态拦截、公开命令、快照回填 |
| 5 | `clear-panel.ts` + `panel-router.ts` + `view-model.ts`：结算面板顶部动作行右侧加「好友 \n 这关榜」纸 chip；路由到 `openLevelRank()` |
| 6 | 主菜单底部 CTA 左侧「好友榜」纸钮（`meta-view.ts` 几何/热区/绘制三处同源）+ `MetaAction 'open-rank'` + shell 派发 |
| 7 | 菜单腿：`_readMenuInput` 模态门 + `updateRank` 推进 + `buildMetaView` 叠画 |
| 8 | 测试：`tests/rank-panel.test.ts`（新）、clear chip 命中、meta `open-rank` 命中 |
| 9 | 文档：ADR-0035 §5.2 S-3 标 ✅ + commit；§8 推进到 S-4；台账 432 行 |

**Out（明确不做）**

- ❌ `opendata/` 子域工程 / `game.json` 的 `openDataContext` → S-4
- ❌ weapp 真实现（`getOpenDataContext` / `setUserCloudStorage` / `sharedCanvas`）→ S-5
- ❌ `openSettings` 钩子（S-5）；S-3 无宿主钩子 ⇒ **不画「去设置开启」**，未授权态只显示主文案（避免死按钮）
- ❌ 好友头像 / 昵称 / 名次行（协议不回明细）；不写「第 N」
- ❌ 分享 / 邀请按钮（文案里的「去邀请一位」只是空态说明，不是按钮）
- ❌ 任何 §3 冻结常量、存档形状、`PANEL_SIZE` 560×480

---

## 2. 新文件签名

### 2.1 `games/beads/src/systems/rank-panel.ts`

```ts
export type RankPanelState =
  | 'unsupported'   // 宿主无 openData（services.openData === undefined）
  | 'loading'       // init 已发，等 ready/回执
  | 'ready'         // count > 0
  | 'empty'         // count === 0
  | 'no-auth' | 'fail' | 'incompatible';

export type RankPanelAction = 'back' | 'settings';

export interface RankButton { readonly id: RankPanelAction; readonly rect: PanelRect }
export interface RankPanelLayout {
  readonly panel: PanelRect;
  readonly buttons: readonly RankButton[];
  readonly titleY: number;
  readonly subtitleY: number;
  readonly statusY: number;
}

export interface RankPanelView {
  readonly visible: boolean;
  readonly progress: number;
  readonly interactive: boolean;
  readonly state: RankPanelState;
  readonly count: number;
  readonly board: RankBoard;
}

export function rankPanelLayout(hasSettings: boolean): RankPanelLayout; // 两份缓存
export function rankStatusText(state: RankPanelState, count: number): string;
export class RankPanel { /* 见 §2.1.1 */ }
```

**布局**（与结算面板同源：`(DESIGN_W-w)/2`、`(DESIGN_H-h)/2 + dialogShiftY()`）：

| 项 | 公式 |
|---|---|
| 底板 | `PANEL_SIZE` 560×480（⛔ 零改动） |
| `titleY` | `panel.yMin + PANEL_PADDING + 40` |
| `subtitleY` | `titleY + 52` |
| `statusY` | `panel.yMin + 236` |
| 按钮行 | `y = panel.yMax - PANEL_PADDING - PANEL_BUTTON_H`，高 `PANEL_BUTTON_H` |
| 单钮（无 settings） | `返回`，宽 `PANEL_PRIMARY_W` 居中 |
| 双钮（有 settings） | 两钮各 `(PANEL_SIZE.w - PANEL_PADDING*2 - PANEL_ROW_GAP)/2`，左 `返回` / 右 `去设置开启` |

**文案常量**（导出供测试断言）：

```
RANK_PANEL_TITLE = '好友榜'
副标：board === 'settle-total' ? '总榜' : '本关'
unsupported  '当前环境不支持好友榜'
loading      '正在加载…'
ready        `共 ${count} 位好友上榜`
empty        '还没有好友上榜，去邀请一位'
no-auth      '未授权，无法显示好友榜'
fail         '好友榜暂时打不开，稍后再试'
incompatible '好友榜版本不匹配，请更新后再试'
```

**状态机**：

1. `open(board, key)`：置 `loading` / `count=0` / `_clock.open()`；无 provider ⇒ `unsupported` 并返回；有 provider ⇒ `send({type:'render:visible',true})` + `send({type:'init',version:OPEN_DATA_VERSION,theme,board})`。
2. 收到 `ready`：`isCompatibleOpenDataVersion(version)` ⇒ `send({type:'rank:query',board,key,order:'desc',limit:10})`；否则 `incompatible`。**同一次 open 的 query 只发一次**（`_queried` 布尔）。
3. `rank:ready`：board 匹配 ⇒ `count>0 ? ready : empty`。
4. `rank:error`：board 匹配 ⇒ `no-auth | empty | fail`（`api-missing` 归 `fail`）。
5. `close()`：`_clock.close()` + `send({type:'render:visible',false})`；退场期 `interactive=false` 且点击仍被吞（模态）。
6. `attach(provider|null)` / `detach()`：退订旧回调；`detach` 幂等。`view()` 返回**复用对象**（热路径零分配）。
7. `tap('back')` ⇒ `close()`；`tap('settings')` ⇒ 仅当构造时给了 `openSettings` 才调用。

**Provider 订阅边界**：回调只读 `event.type`；不 `JSON.parse`、不保留事件对象。

**theme**（构造时从 `palette` 取，仅随 `init` 下行，S-3 不渲染）：

```
bg=palette.panel, rowBg=palette.slot, rowBgSelf=palette.woodFace,
text=palette.text, accent=palette.accentPrimary,
avatarSize=56, rowH=TOUCH_MIN, fontPx=26
```

### 2.2 `games/beads/src/view/rank-view.ts`

```ts
export function drawRankPanel(
  builder: RenderModelBuilder,
  palette: BeadsPalette,
  view: RankPanelView,
): void;
```

- `!view.visible` ⇒ 直接返回。
- `drawModalFrame({ panel, progress: clamp(view.progress), scrimRgb: UI_SCRIM.canvas, scrimAlpha: UI_SCRIM.alpha * progress, radius: UI_CONTAINER.radiusPanel, shadowAlpha: UI_CONTAINER.shadowAlphaPanel })`。
- 标题 `UI_FONT.panelTitle` / 副标 `palette.textDim` + `bodyFont(largeText,'sub')` / 状态行 `palette.text` + `bodyFont(...,'sub')`。
- `ready` 时状态行即计数文案（不另起行）；`loading` 不画假进度条。
- 按钮：`返回` = paper；`去设置开启` = wood。按 `layout.buttons` 逐钮用 `drawButton`。
- ⛔ 零 hex 字面量；⛔ 不自持计时（进度全从 `view.progress`）。

---

## 3. 修改点（逐文件精确接线）

| 文件 | 改动 |
|---|---|
| `games/beads/src/game/state.ts` | `BeadsSnapshot` 末尾加 `readonly rankPanel?: RankPanelView;`（**可选** ⇒ 既有测试字面量零改动）；`createSnapshot()` 加 `rankPanel: CLOSED_RANK_VIEW`（模块级冻结常量） |
| `games/beads/src/game/beads-game.ts` | ① 字段 `_rankPanel`（构造 `theme` 用 `rankTheme(this.palette)`）；② `init()`：`this._rankPanel.attach(services.openData ?? null)`；③ `update()`：在 `_sprintSettle.update` 后加 `this._rankPanel.update(dt*1000)`；④ `_routeTap()` **最前**（`_pendingBuy` 之前）：`if (this._rankPanel.visible) { this._consumedTap = true; const a = this._rankPanel.hitTest(x,y); if (a) this._rankPanel.tap(a); return; }`；⑤ 公开命令 `openRank(board,key)` / `openLevelRank()`（`board='settle'`, `key=this._levelKeys[this._levelIndex] ?? ''`）/ `closeRank()` / `get rankOpen()` / `rankView()` / `updateRank(dt)` / `hitRank(x,y)` / `tapRank(a)`；⑥ `dispose()` 加 `this._rankPanel.detach()`；⑦ `_syncSnapshot()` 加 `s.rankPanel = this._rankPanel.view()` |
| `games/beads/src/systems/clear-panel.ts` | `ClearPanelAction = 'next'|'sprint'|'rank'`；`ClearPanelLayout` 加 `readonly rankChip: PanelRect`；`build()` 内 `rankChip = rect(primary.xMax + CLEAR_BUTTON_GAP, rowY, CLEAR_RANK_CHIP_W, PANEL_BUTTON_H)`，`CLEAR_RANK_CHIP_W = 110`（右侧正好抵 `panel.xMax - PANEL_PADDING`）；`hitClearPanel` 先钮后 chip（chip ⇒ `'rank'`）；`clearPanelLabel('rank', _)` ⇒ `'好友这关榜'`（仅测试/无绘制消费，视图用两行） |
| `games/beads/src/game/beads-game/panel-router.ts` | `PanelRouterHost` 加 `openLevelRank(): void`；`level-clear` 分支 `action === 'rank'` ⇒ `h.sfx(AUDIO_CLIP_UI_TAP); h.openLevelRank(); return true`（仍先命中再派发） |
| `games/beads/src/view/view-model.ts` | `drawClearPanel` 在按钮循环后画 `layout.rankChip`：纸面（`palette.panel` + `palette.panelBorder` 1px + `UI_CONTAINER.radiusCard`）+ 两行字「好友」「这关榜」（`bodyFont(largeText,'hudSmall')`，`palette.text`，中心 `qualityY` 无关，`chip.yMin + 30 / +60`）；`pressDy` 若 `snap.pressedButton === 'rank'`。**布局/文案全来自 `clear-panel.ts`** |
| `games/beads/src/view/meta-view.ts` | ① `MetaAction` 加 `'open-rank'`；② `AnchoredMenuGeo` 加 `rankBox/rankHit`：`rankBox = box(24, ctaBox.y + (MENU_CTA_H-TOUCH_MIN)/2, 140, TOUCH_MIN)`，`rankHit = rankBox`；③ `menuLayoutAnchored` 加 `{ id:'open-rank', box:g.rankHit }`；④ 主菜单绘制（`drawMenuAnchored` 内 CTA 之后）画纸钮「好友榜」：`drawButton(...,'paper', UI_CONTAINER.radiusCard, '好友榜', bodyFont(...))`；⑤ `MetaViewData` 加 `readonly rank?: RankPanelView`；⑥ `buildMetaView` 的 `overlay==='none'` 分支在菜单绘制后、`return` 前：`if (data.rank) drawRankPanel(builder, palette, data.rank)` |
| `games/beads/src/game/beads-shell.ts` | ① `_viewData` 加 `rank: undefined as RankPanelView|undefined`；② `_metaViewData()` 末尾 `v.rank = this.play.rankOpen ? this.play.rankView() : undefined`；③ `update()` 菜单腿在 `play.sampleFrame(dt)` 后 `this.play.updateRank(dt)`；④ `_readMenuInput()` **在 `screenToDesign` 之后、任何菜单命中之前**：`if (this.play.rankOpen) { …只处理 rank 按下登记/抬起同点派发…; this._menuPress=null; this._viewData.pressed=null; return; }`（新增 `_rankPress: RankPanelAction|null` 字段）；⑤ `_applyMetaAction` 加 `case 'open-rank': this.play.openRank('settle-total',''); return true;` |
| `production/TASKS.md` / `production/TASKS-DETAIL.md` | 431 行 + 详情节（与代码同一笔提交，pre-commit K 项） |
| `docs/architecture/adr/ADR-0035-*.md` | §5.2 S-3 标 ✅ + commit；§8 推进到 S-4（单独 docs 提交） |

**⛔ 不碰**：`packages/framework/src/**`（S-1/S-2 已足够）、`config/tuning/**`、存档、`PANEL_SIZE`、`META_SAVE_VERSION`。

---

## 4. 测试（先红后绿）

### 4.1 新 `games/beads/tests/rank-panel.test.ts`

用 `MockOpenDataProvider`（`packages/framework/src/core/opendata/mock.ts`）：

1. 无 provider ⇒ `open` 后 `state==='unsupported'`、`visible===true`、`sent` 为空。
2. `rows:3` ⇒ `open('settle-total','')` 后 `state==='ready'`、`count===3`；`sent` 含 `render:visible{true}`、`init{version:1,board}`、`rank:query{board,key,order:'desc',limit:10}`（query 恰一条）。
3. `rows:0` ⇒ `empty`。
4. `failCode:'no-auth'` ⇒ `no-auth`；`api-missing` ⇒ `fail`。
5. `version:0` ⇒ `incompatible`，且**不发 query**。
6. `close()` ⇒ `sent` 末条 `render:visible{false}`；`update(200)` 后 `visible===false`。
7. `detach()` 后再 `emit` 不改状态。
8. `hitTest` 命中 `返回`；构造带 `openSettings` 时命中 `settings`，`tap('settings')` 调一次钩子。
9. 其它 board 的回执被忽略。

### 4.2 复用既有测试

- `games/beads/tests/clear-panel.test.ts`（若存在）：`hitClearPanel(rankChip 中心)` ⇒ `'rank'`；`clearPanelLayout().rankChip` 右缘 = `panel.xMax - PANEL_PADDING`。
- `games/beads/tests/meta-*.test.ts`：`metaLayout('none',…,anchors)` 含 `open-rank`，box 与 `anchoredGeo` 同源；`_dispatchMetaTap` 命中后 `play.openRank` 收到 `('settle-total','')`。
- `games/beads/tests/ui-golden.test.ts`：菜单 / 结算场景会变 ⇒ 先跑 `tests/ui-golden-capture.ts` 重抓 `__fixtures__/wxg-t-298-ui-golden.json`（**只准走 capture，⛔ 手改**，K-051/K-053），再复跑 golden。

---

## 5. 门禁与提交

1. 基线已绿（§0）→ 开工。
2. `pnpm --filter @wxgame/beads test` → `pnpm run typecheck` → `pnpm run check:arch` → `pnpm test` → `pnpm run check:links` → `pnpm run ctx:build && pnpm run ctx:check` → `pnpm run sync:check`。
3. 台账 + 代码同一笔：`feat(beads): 榜单面板占位与结算上下文入口（WXG-T-432 S-3）`。
4. 单独 docs 提交：`docs(architecture): 回填 S-3 完工读数与 commit（WXG-T-432）`（scope **architecture**，⛔ `adr`）。
5. `git fetch` → 落后则 `git merge origin/develop --no-edit`；`ctx/*` 冲突用 `pnpm run ctx:build` 重生成后 `git add`（⛔ `checkout --ours`）→ 重跑三门 → `git push origin HEAD:develop` → `git ls-remote` + `git reflog show origin/develop` + `merge-base --is-ancestor` 取证。
6. 收尾 `pnpm run kb:sync -- --task=WXG-T-432`，回报新增/修改/激活/归档统计 + 0–3 条沉淀候选。

---

## 6. 待批决策（请逐条拍板）

| # | 决策 | 建议 |
|---|---|---|
| D1 | 工作区 419/429 三个脏文件的处理 | **甲：stash → S-3 → pop** |
| D2 | 结算面板入口形态 = 顶部动作行右侧 110×88 两行纸 chip（「好友/这关榜」） | 采纳（几何刚好抵右边距，零新 token） |
| D3 | 主菜单入口 = 底部 CTA 左侧 140×88 纸钮「好友榜」 | 采纳 |
| D4 | S-3 是否渲染「去设置开启」 | **否**（无 `openSettings` 钩子 ⇒ 不画死按钮；S-5 再接） |
| D5 | 面板文案是否按 §2.1 定稿 | 采纳 |
