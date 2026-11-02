# beads GDD 漂移审计整改 Spec（2026-10-27）

> 来源 = `wxgame-gdd-review` 只读审计（用户令「直接开始 review 小游戏 GDD」）。
> 本 spec 只处理审计发现的**整改**；§3 冻结常量零改动。
> 基线 commit：`723b50d9`（工作树仅 `?? .trae/`）。

## 0. 审计结论

- 建议结论：**CONCERNS**（1 × P1 机械门禁红 + 6 × P2 文档漂移；无 P0，无冻结常量漂移）。
- 系统覆盖三角 PASS：S1–S10 全部有 GDD 分册与 `src/` 实现。
- `rank:*` 属开放数据子域消息通道（`ADR-0035`），**不属** `systems-index §4` 游戏事件总线 ⇒ 不计漂移。

## 1. 目标 / 非目标

**目标**

1. 修掉 `check:arch` §20-2 红（P1）。
2. 把 `systems-index §4` 事件表对齐代码现状（P2 ×6）。
3. 产出 `check:frozen-values` SKIP 清单的人工判读结论（覆盖缺口，非漂移）。
4. 落盘本轮 review 报告。

**非目标**

- ⛔ 不改 §3 任何冻结常量（改值须用户裁定并走 §3 变更单）。
- ⛔ 不改玩法行为、不改 `tuning.ts` 数值、不新增系统。
- ⛔ 不为 §4 漂移改代码（除 P1 的常量搬家外）。

## 2. 漂移表（审计发现）

| # | 类型 | 真源 | 现状 | 证据 `file:line` | 级别 | 归属 |
|---|---|---|---|---|---|---|
| 1 | 架构门禁 §20-2 | `rgba()/rgb()` 只许住 `ui-theme.ts` / `palette.ts` | `debug-layer.ts` 本地常量就地写 `rgba(255,60,230,0.14)` | `games/beads/src/view/debug-layer.ts:23`；门禁报 `:11`（`stripComments` 后行号偏移） | **P1** | 代码修复（本 spec T1） |
| 2 | 事件不符 | §4 事件表 | `meta:studio-import` 未登记（studio 导入回执，调试通道） | `games/beads/src/game/beads-shell.ts:756` | P2 | GDD 文档（T2） |
| 3 | 事件载荷 | §4 `meta:overlay {id, open}` | 代码 `{open, name}`；取值 `none\|signin\|settings\|levels\|skins`（非文档所列 profile/stamina/collection/leaderboard） | `beads-shell.ts:1143`；`games/beads/src/view/meta-types.ts:18` | P2 | GDD 文档（T2） |
| 4 | 事件载荷 | §4 `signin:claimed {day, coins, stamina}` | 代码 `{day, coins, hearts}` | `games/beads/src/game/meta-state.ts:433` | P2 | GDD 文档（T2） |
| 5 | 事件载荷 | §4 `wallet:changed {coins, delta}` | 代码 `{coins}` | `meta-state.ts:401` / `:466` / `:487` / `:498` | P2 | GDD 文档（T2） |
| 6 | 事件载荷 | §4 `stamina:changed {cur}` | 代码 `{cur, max}` | `meta-state.ts:297` / `:467` / `:481` | P2 | GDD 文档（T2） |
| 7 | 事件载荷 | §4 `powerup:used {type, affectedCells}` | 代码多一个可选 `traySlots`（v1.95 托盘修复器） | `games/beads/src/game/beads-game.ts:1434-1438` | P2 | GDD 文档（T2） |

覆盖缺口（**不判漂移**）：

- `check:frozen-values` SKIP：19 项非原子值 + 47 处文档值不可解析（示例 `LOD=0.9·CELL=27`、`HIT=CELL+2·PAD=46`、`TRAY_BEAD_SIZE=TRAY_SLOT−4`）⇒ 机械门看不见 ≠ 已验，需人工判读（T3）。
- 验收可测性：11 个 GDD 分册均有 §8、115 个测试文件；本轮只做分册级覆盖核对，未逐条复验每条判据（报告如实标注）。

## 3. 方案

### T1 · P1 修复：调试层颜色搬进 UiTheme（唯一允许住 rgba 的层）

1. `games/beads/src/view/ui-theme.ts`：在 `UI_SCRIM` 附近新增

   ```ts
   /** `[WXG-T-4xx]` 调试层热区框填充（半透明品红；⛔ 不进 palette 正式调色板）。 */
   export const UI_DEBUG_HIT_FILL = 'rgba(255,60,230,0.14)';
   ```

2. `games/beads/src/view/debug-layer.ts`：
   - 删除本地 `const HIT_BOX_FILL_HEX = 'rgba(255, 60, 230, 0.14)';`（`:22-23`）；
   - 从 `./ui-theme.js` 导入 `UI_DEBUG_HIT_FILL`，`drawHitBox` 默认参数改用它。
   - 视觉零变化：字面量与 α 逐字不变 ⇒ 金样本零漂移。
3. 跑 `pnpm run framework:sync`，同步 Cocos 镜像
   `games/beads/cocos/assets/scripts/game/view/{ui-theme,debug-layer}.ts`。

**否决的替代方案**：给 `debug-layer.ts` 开 §20-2 豁免——豁免表是「登记偏离、只减不增」，为一个调试色开新口子不如一行搬到 UiTheme。

### T2 · §4 事件表对齐（文档跟随代码）

**决策：以代码现状为准改文档。** 依据：代码为 v1.95 后现行实现、beads 1380 绿；所列载荷字段无下游消费者依赖（`wallet:changed` 的 `delta`、`signin:claimed` 的 `stamina` 均无消费点）。逐项改 `games/beads/design/gdd/systems-index.md §4`：

| 行 | 现在 | 改为 |
|---|---|---|
| `:302` `meta:overlay` | `{id, open}`；overlay 取值列 profile/stamina/collection/leaderboard | `{open, name}`；取值 `none\|signin\|settings\|levels\|skins`；补注「对局侧好友榜面板不属 meta overlay」 |
| `:303` `signin:claimed` | `{day, coins, stamina}` | `{day, coins, hearts}`（另由 `wallet:changed` / `stamina:changed` 分别广播） |
| `:305` `wallet:changed` | `{coins, delta}` | `{coins}` |
| `:304` `stamina:changed` | `{cur}` | `{cur, max}` |
| `:292` `powerup:used` | `{type, affectedCells}` | `{type, affectedCells, traySlots?}`（v1.95 `trayRestore` 路径带） |
| 新增行 | — | `meta:studio-import` `{ok, detail}`：studio 导入回执，调试通道，meta 域不带 `levelId` |

同批：`games/beads/design/gdd/systems-index-changelog.md` 追加 **v1.96** 条目（§4 事件表对齐，零冻结值改动），`systems-index.md` 头部版本行改 v1.96 + 任务号。

### T3 · SKIP 清单人工判读（只判不改值）

- 逐条读 `check:frozen-values` 的 19 项非原子值 + 47 处不可解析文档式；
- 每条标：`派生可证` / `需设计复核` / `文档式应改写法`；
- 结论写进 review 报告；**不改任何数值**，需改值的另开 §3 变更单。

### T4 · review 报告落盘

- 路径：`games/beads/design/gdd/review-2026-10-27.md`（本 spec 批准即视为路径批准）；
- 必含：基线 commit、输入清单、漂移表、命令表（命令 / 退出码 / 关键输出）、覆盖缺口、结论、0–3 条沉淀候选。

## 4. 文件清单

| 文件 | 动作 |
|---|---|
| `games/beads/src/view/ui-theme.ts` | 新增 `UI_DEBUG_HIT_FILL` |
| `games/beads/src/view/debug-layer.ts` | 删本地常量、改导入 |
| `games/beads/cocos/assets/scripts/game/view/ui-theme.ts` | `framework:sync` 生成 |
| `games/beads/cocos/assets/scripts/game/view/debug-layer.ts` | `framework:sync` 生成 |
| `games/beads/design/gdd/systems-index.md` | 仅 §4 六处 + 头部版本 |
| `games/beads/design/gdd/systems-index-changelog.md` | v1.96 条目 |
| `games/beads/design/gdd/review-2026-10-27.md` | 新建（报告） |
| `production/TASKS.md` / `production/TASKS-DETAIL.md` | 领号 + 详情节 |
| `ctx/index.json` | pre-commit 自动重建 |

## 5. 验证（完成判据）

| 命令 | 期望 |
|---|---|
| `pnpm run check:arch` | exit 0（§20-2 消失；L1 WARN 保留） |
| `pnpm run check:frozen-values` | exit 0（49 可比 / 42 A 面 / 125 B 面不变） |
| `pnpm --filter @wxgame/beads test` | exit 0（≥1380 passed） |
| `pnpm run check:links` | exit 0 |
| `pnpm run typecheck` | exit 0 |
| `git ls-remote` + `git reflog show origin/develop` | 推送取证一致（K-142） |

## 6. 风险与回滚

- T1 为纯常量搬家，字面量逐字不变 ⇒ 视觉/金样本零漂移；回滚 = revert 提交。
- T2 纯文档；若用户不认可「文档跟随代码」，改回旧载荷字段即可，无代码影响。
- T3 只读；若发现需改值，**停止**并另开 §3 变更单（须用户裁定 + §6 变更记录）。

## 7. 审批点

1. 是否批准本 spec（含 T2「文档跟随代码」决策）。
2. 是否批准 review 报告落盘到 `games/beads/design/gdd/review-2026-10-27.md`。
3. 执行前重新读 `production/TASKS.md` 领号锚（当前下一可用号 `WXG-T-457`，并发可能推进）。
