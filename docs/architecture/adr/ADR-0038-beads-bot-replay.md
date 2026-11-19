# ADR-0038 · beads 机器人玩家与过程回放：纯逻辑策略层 + 输入级录制与影子重演

- **状态**：**Accepted**（用户 2026-11-19 拍板：演示 + 托管都要；策略独立纯逻辑、可无头独立运行；首版贪心；回放仅本局内存；演示不计星、托管正常计星；回放入口仅 `ClearPanel`；附三项 UI 追加裁定）
- **日期**：2026-11-19
- **任务号**：**WXG-T-984**（ADR + 控制清单增补 + Epic/Story 拆分；本单零业务代码）
- **负责域**：工程负责人（分层 / 沙箱 / 回放设施 / 状态承载 / 命名消歧）· 设计策略（GDD 契约与数值）
- **权威来源（冲突以左列为准）**：`games/beads/design/gdd/bot-replay.md` v1.0 ＞ `games/beads/design/ux/bot-replay-spec.md` v1.0 ＞ `games/beads/design/gdd/systems-index.md` **§3.15**（21 条新常量）＞ 本文。数值一律引用 §3.15，⛔ 本文不复制、不改写冻结值。
- **关联**：ADR-0002（core 引擎无关）· ADR-0007（计时与冻结归属）· ADR-0011（屏幕坐标契约）· ADR-0032（beads UI 架构）· ADR-0036（Cocos 镜像）· `control-manifest.md` L2/L3/L4/L5 与 §2/§8/§11
- **判例链**：K-036（全绿不等于已证）· K-053（改判留痕，⛔ 不静默改史）· K-057（ADR 状态行与实施单不会自动互相收口）· K-137（拆分件写好的「待粘贴」不会自动落地）
- **冻结常量**：本 ADR **零新增、零改动** §3 数值；新增常量组已由 `systems-index §3.15`（v2.01）登记，本文只消费。

---

## 1. 上下文

### 1.1 要解决什么

beads 同时要三件事（用户 2026-11-19 拍板）：

1. **可看**：主菜单「演示」——机器人把当前最远解锁关打一遍给玩家看；
2. **可托管**：暂停面板开关，机器人实时代打当前对局，玩家随时接管，**正常计星/存档**；
3. **可复盘**：过关结算面板（`ClearPanel`）提供「回放」，把玩家上一局按输入级事件重演。

三者共用一套**完全独立于 UI 的纯逻辑层 + 一套回放设施**；UI 只消费只读产物。回放仅本局内存，不写存档。

上游设计已冻结（提交 `cb721101`）：`design/gdd/bot-replay.md` v1.0 给出状态、策略契约、录制结构、§8 十四条判据；`design/ux/bot-replay-spec.md` v1.0 给出入口/全屏页/托管态与动效；`systems-index §3.15` 给出 21 条常量。本 ADR 只回答**工程怎么落**，不重述设计。

### 1.2 现有实现事实（2026-11-19 快照，只读核对）

| 事实 | 证据 | 对本决策的约束 |
|---|---|---|
| `runBot` 是贪心三段式 A→C→B 金样本，只走 `BeadsGame` 公开命令 | `games/beads/design/forensics/g3/g3-lib.ts:431-558`；固定参数 `branchOrder='ACB'` / `reuseAnchor=false` / `retrieve='max'` / `allowDirectFill=true` / `usePowerups=false` | 生产策略必须**逐字复现**其 `pricing.actions`（`bot-replay §8-1`）；`g3-lib` 抽取后只留薄包装 |
| `BeadsGame` 公开玩法命令齐备 | `selectTraySlot` / `selectBoardBead` / `tapGridCell` / `retrieveSelectedGroup()` / `usePowerup` / `expandTray`（`games/beads/src/game/beads-game.ts:1181/1207/1278/1336/1382/1654`） | 策略与影子重演只走这些入口，不碰内部字段 |
| 只读观测可直接取 | `get grid` / `get tray` / `get boardSelected` / `get remaining` / `get actionsThisLevel`（同文件 `:865/870/886/892/1716`） | `observeGame()` 可无快照、无 UI 依赖地构造 `BotObservation` |
| `LEVEL_CLEAR` 的 `onEnter` 内含结算链 | 发豆回调、写星、品质分、`_persistProgress()`、`_crashIO.clear()`（`beads-game.ts:2016-2059`） | ⛔ 真实实例在回放期间**不得迁出再迁回 `level-clear`**，否则会二次结算，违反 `bot-replay §2.3.2/§8-9` |
| 状态机为六相位 + 显式转移表 | `BeadsPhase`、`PHASE_TRANSITIONS`（`games/beads/src/game/state.ts:40-66`） | 「REPLAY」的承载点必须显式裁定（见 DEC-4） |
| `ClearPanelAction = 'next' \| 'menu'` | `games/beads/src/systems/clear-panel.ts:53` | 需新增 `'replay'`，且不得复用 `FinishPanelAction` 的同名成员 |
| `FinishPanelAction = 'replay' \| 'sprint' \| 'menu' \| 'share'`，其中 `'replay'` 实为「重玩第 1 关」 | `games/beads/src/systems/finish-panel.ts:52`；`panel-router.ts:117` 把 `'replay'` 接到 `restartRun()` | 必须先改名消歧，否则两处 `'replay'` 语义互撞 |
| 道具免费额度是账号级且「用掉即置位」 | `PowerupSystem.request()` 成功后写 `_freeDepleted[type]=true`（`games/beads/src/systems/powerups.ts:304-324`） | 影子重演若复用 `request()`，同一局第二次同类道具会变 `exhausted` ⇒ 必须提供「已授权」通道 |
| `expandTray()` 是纯机制（不发广告、不判相位） | `beads-game.ts:1654-1658`；广告腿在 `requestTrayExpand()` | 影子实例只调 `expandTray()`；⛔ 不调 `requestTrayExpand()` |
| 壳层导航 = `ShellScreen='play'\|'menu'` + 相位面板 modal | `games/beads/src/ui/phase-route-binder.ts:27/44-60` | 回放页是**整页**，应落在壳层路由而非相位面板栈 |
| 框架 RNG 有 `state` 只读、无「按状态重建」入口 | `packages/framework/src/core/math/rng.ts:12-29/53` | 录像要能重演随机道具，需补一个**按状态重建**的确定性入口（见 DEC-6） |
| 无 Cocos 编辑器 / 无真机 | 环境事实 | 新增 `src/**` 的镜像 `.meta` 只能由编辑器生成（L1）；真机腿一律 `[Blocked]` |

### 1.3 不能做什么

- 不联网、不训练、不上传、不导出录像文件；回放仅内存（`REPLAY_RETENTION='memory-only'`）。
- 不做实时观战/多人；演示是本地预计算结果。
- 不做策略最优解；首版只做可复现贪心（`BOT_POLICY_DEFAULT='greedy-acb'`）。
- 不改失败/冲刺/全通关面板入口；回放入口**仅 `ClearPanel`**（`REPLAY_ENTRY='clear-panel-only'`）。
- 不新增 §4 公共事件；状态与进度经只读投影。

---

## 2. 备选方案

> 只列真实对比过的选项，不设稻草人。

### 2.1 回放设施形态

| 案 | 内容 | 事实性对比 | 结论 |
|---|---|---|---|
| **A 实时影子 + 实时驱动** | 演示与回放都在实时时钟下边算边播 | 实现最直；但**无法 seek/倍速**（要回到过去只能重算，等于从头），演示失败会暴露半局，录制器与播放器仍要写 | 否 |
| **B 预计算录像 + 共用播放器**（采用） | 演示先用无头影子把整局跑完产出录像；演示/玩家上一局共用同一个 `ReplayPlayer`（从头重演 + 倍速 + seek） | 可 seek/倍速/暂停；生成失败不暴露半局；与「策略纯逻辑可无头跑」同构；代价是多一份内存录像与一次预计算 | **采用** |
| C 状态快照关键帧 seek | 每 N 步序列化影子全状态，seek 从最近关键帧恢复 | seek O(1)~O(N/k)；但影子状态可序列化成本高（网格/托盘/计时/道具/特效队列），且序列化漏字段 = 静默分叉 | v1 否；`REPLAY_KEYFRAME_INTERVAL_MS` 留 `[TODO]` 作后续 |
| D 演示/回放各写一套播放器 | 演示实时播放，回放单独做 | 两套输入门禁、两套清理路径、两套终局判定，必然漂移 | 否 |

### 2.2 「REPLAY」状态承载点

| 案 | 内容 | 事实性对比 | 结论 |
|---|---|---|---|
| 甲 新增 `BeadsPhase='replay'`，真实实例迁出 `level-clear` | 回放时真实游戏进 `replay`，退出迁回 `level-clear` | 迁回会重跑 `onEnter('level-clear')` 的结算链（发豆/写档/品质分）⇒ 直接违反 `§8-9`「无二次结算」；要豁免就得在结算链里加「回放回归」特判，污染主路径 | 否 |
| **乙 壳层路由 `ShellScreen='replay'` + `ReplaySession`**（采用） | 真实实例**停在源相位**（own-last 停 `level-clear`、demo 停 `boot`）；回放是壳层整页路由 + 会话状态；影子实例独立 | 不碰真实实例结算链；`REPLAY` 不进 `PAUSED`、不 tick 真实 `BeadsGame` 自然成立；UI 只读 `ReplayViewModel`；代价 = GDD §2.1 的「状态」在代码里落在壳层而非 `BeadsPhase`（登记为命名差，见 §4.2-1） | **采用** |
| 丙 独立第三套状态机 | 回放自建一套与游戏/壳层无交的状态机 | 多一层同步，且路由仍要落到壳层绘制；过度设计 | 否 |

### 2.3 托管驱动位置

| 案 | 内容 | 对比 | 结论 |
|---|---|---|---|
| A 写进 `BeadsGame.update()` | 游戏内部每 450ms 调 `decide` | 游戏类反向依赖 `bot/**`，且 headless 生成/单测要绕过 update；职责不清 | 否 |
| **B 壳层持有 `BotDriver`**（采用） | 壳在 `game.update(dt)` 之后调 `driver.tick(dtMs, game)`；driver 只在 `phase==='playing' && assist==='bot'` 时出手 | 游戏内核零 bot 依赖；driver 可纯 Node 单测；暂停/接管门禁复用相位与 `assist` 标记 | **采用** |
| C 事件总线定时器 | 用事件/定时器驱动 | 事件只作通知（§4），且定时器破坏固定步确定性 | 否 |

### 2.4 策略落地位置

| 案 | 内容 | 对比 | 结论 |
|---|---|---|---|
| A 直接把 `g3-lib.ts` 搬进 `src/bot` | 生产与取证共用一份源码 | 取证目录含 Node-only 工具代码（harness/文件 IO），拖进构建面会违反 L3/包体纪律 | 否 |
| **B 抽内核到 `src/bot/**`，`g3-lib` 变薄包装**（采用） | 生产策略纯逻辑；取证工具只做「读关卡 → 喂策略 → 打印」 | 金样本回归直接对拍；Node 与构建共用同一份纯逻辑 | **采用** |
| C 策略写在 view/UI 侧 | 复用现有渲染数据 | 违反「策略完全不依赖 UI」用户原话与 L5 | 否 |

---

## 3. 决定（DEC）

### DEC-1 · 分层与依赖方向

```
UI（ClearPanel / 回放页 / HUD 徽标）
  │  只读：ReplayViewModel、ReplayPageModel、只读 snapshot
  ▼
src/replay/**（录制器 + 影子播放器 + 沙箱 + 视图模型）
  │  依赖 bot/** 与 BeadsGame 公开命令
  ▼
src/bot/**（策略 + observe/apply + driver）
  │  只走 BeadsGame 公开命令与只读 getter
  ▼
BeadsGame（唯一玩法状态真源）
```

硬约束（进 `control-manifest §21`）：

- `src/bot/**`、`src/replay/**` **禁止** import `cc` / DOM / `wx` / `window` / `document` / `view/**` / `ui/**` / `palette`。
- `src/bot/**` 对 `BeadsGame` 只做 `import type`（不构造、不持有实例；由 driver/player 传入）；`src/replay/**` 允许运行时
  `import { createBeadsGame }` 以装配影子实例（影子装配只住 `replay/**`，⛔ 住 `bot/**`）。
- `src/bot/**` 禁止消费 `services.rng` / `Math.random`；平票 tie-break 固定为「行优先 → 槽号升序 → 组大小降序」。
- UI **禁止** import `bot/**` 的 `decide()` 或策略实现；只消费 `src/replay/view-model.ts` 的类型与只读数据。
- `beads-game.ts` **不** import `bot/**` / `replay/**`（托管驱动与回放会话都在壳层）；`BeadsGame` 只通过新增的**中性回调/选项**暴露录制钩子与沙箱开关。

拟定落位：

| 路径 | 职责 |
|---|---|
| `games/beads/src/bot/types.ts` | `BotObservation` / `BotCommand` / `BotAction` / `BotPolicy`（与 GDD §2.2.2 逐字对齐） |
| `games/beads/src/bot/observe.ts` | `observeGame(game): BotObservation`（只读 getter，无快照分配依赖） |
| `games/beads/src/bot/apply.ts` | `applyBotCommand(game, cmd): boolean`（只调公开命令） |
| `games/beads/src/bot/policy-greedy-acb.ts` | 首版 A→C→B 贪心（固定参数） |
| `games/beads/src/bot/registry.ts` | `BOT_POLICY_DEFAULT` + `createBotPolicy(id)` |
| `games/beads/src/bot/driver.ts` | `BotDriver.tick(dtMs, game)`：托管节拍、`BOT_STUCK_LIMIT`、无合法动作停机 |
| `games/beads/src/replay/recorder.ts` | `ReplayRecorder`：开始/追加/结束/作废、上限与 `truncated` |
| `games/beads/src/replay/player.ts` | `ReplayPlayer`：影子实例、固定步注入、播放/暂停/倍速/seek、终局冻结 |
| `games/beads/src/replay/sandbox.ts` | `createReplaySandboxGame()`：noop 服务装配与 `replaySandbox` 选项 |
| `games/beads/src/replay/level-hash.ts` | `levelHash(level): string`（FNV-1a 规范化指纹） |
| `games/beads/src/replay/view-model.ts` | `ReplayViewModel` / 页面只读模型（UI 唯一入口） |

### DEC-2 · `replaySandbox` 契约（影子实例）

`BeadsGameOptions` 新增 `replaySandbox?: boolean`（缺省 false，后向兼容），语义固定为：

1. **服务边界**：影子实例 `init()` 注入的 `GameServices` 必须是隔离 noop 集合——
   `storage` = 进程内内存实现（读写不出实例）、`rng` = 按录像种子重建的确定性实例、
   `events` = 影子私有总线（不接全局、不接音频）、`rewardedAd` / `openData` / `haptic` / `httpGet` / `getPerformance` = 缺省。
   ⛔ 不传真实存档键、不共享真实 `storage`。
2. **零副作用清单**：存档（`SaveManager` 写入）、钱包（`onClearCoins`）、体力（`canStartRun` / `onStaminaRefill`）、
   激励视频（`requestTrayExpand`）、结算上报（`settleBestByUid`）、崩溃快照（`_crashIO`）——
   沙箱下**一律不得产生外部可观测副作用**；`_persistProgress()` 在沙箱短路。
3. **道具与扩容按「已授权」执行**：`usePowerup` 在沙箱走 `PowerupSystem.requestAuthorized(type, pool, inputs)`
   （与 `request()` 同选择规则，但**跳过** `freeUses` 门槛、**不写** `_freeDepleted`；仍累计本关使用数，
   保证与录制当时的内部计数一致）；`expandTray()` 直接调用（纯机制），⛔ 走广告腿。
4. **生命周期**：影子实例随 `ReplaySession` 创建，随会话退出/seek 重建销毁；**同一时刻最多一个**；
   投影只读，不写渲染层、不订阅 UI。
5. **相位**：影子实例始终为 `BeadsPhase='playing'`（GDD 绑定判据里的「REPLAY」由会话/壳层承载，见 DEC-4）；
   影子到达 `level-clear` / `game-over` 只被会话当作「播放到头」信号，终局摘要从**结算前**的网格/托盘/剩余时间/动作数取。
6. **上下文注入**：影子装配按录像 `context` 在**内存镜像**设置 `_starsByLevel[levelIndex]=starsBefore` 与 `revived`
   （仅影响 `nextTierFor` 三档时钟与续时保底星），⛔ 写档、⛔ 影响真实账号星账。

> 实现注：`PowerupSystem.requestAuthorized` 与 `BeadsGame` 沙箱短路由 S1/S3 落码；本 ADR 只钉契约名与语义。
> ⛔ 不得用「把免费额度重置成可用」冒充授权——那会污染真实账号额度语义。

### DEC-3 · 录制 / 重演契约

录制结构按 `bot-replay §2.3.1` 逐字实现：

```ts
interface ReplayRecording {
  v: 1;
  source: 'own-last' | 'bot-demo';
  levelId: string;
  levelHash: string;
  seed: number;          // 见 DEC-6：开局时 services.rng.state 快照
  fixedDtMs: number;     // = REPLAY_FIXED_DT_MS
  durationMs: number;    // 有效对局时长（不含暂停）
  context: { levelIndex: number; starsBefore: number; revived: boolean };
  events: ReplayEvent[]; // { step, atMs, cmd, args }；cmd = BotCommand['type'] | 'revive'（见下）
  final: ReplayFinal;
  truncated: boolean;
  policyId?: string;     // bot-demo 必填
}
```

- **`step` 权威、`atMs` 仅显示**：`step = round(有效对局毫秒 / fixedDtMs)`；重演一律按 `step` 注入，
  `atMs` 只服务进度条与时间标签。暂停/后台挂起不计入有效时长（`REPLAY_FIXED_DT_MS` 派生自框架 `GameLoop.fixedDt`）。
- **录制上下文（非命令但影响重演的装配态）**：影子要复现同一局，除命令序列外还必须在录像里带上
  `context: { levelIndex, starsBefore, revived }`（`starsBefore` 决定 `nextTierFor` 与三档时钟 ⇒ 影响 `remainingMs`；
  `revived` 决定续时保底星，至少影响 `ReplayFinal.stars`）。续时（`GAME_OVER → 续时 → PLAYING`）**不丢弃录制**，
  其加时以 **系统时间线事件** `{ step, cmd:'revive', args:{ bonusSec } }` 入录并在该 `step` 注入；
  `GAME_OVER` 只有在**未续时**时才丢弃。⚠ 该 `'revive'` 事件超出 GDD §2.3.1 的 `BotCommand['type']` 值域 ⇒
  作为**契约缺口**登记（Epic §6），S3 实现按本节扩展，设计轨后续同步 `ReplayEvent` 类型。
- **录制起止**：进入 `PLAYING`（开局扣心成功后）建录制器；每条公开命令**成功后**追加事件；
  `PAUSED` 不写事件；`LEVEL_CLEAR` 写 `final` 并标记「上一局」；`GAME_OVER` 丢弃；重试/下一关/回主菜单/再冲刺清理。
  录制钩子由 `BeadsGameOptions.onCommandApplied?: (cmd, args) => void` 提供，`BeadsGame` 只上报、
  不依赖 `replay/**`。`expandTray` 与 `usePowerup` 必须入录（否则后续取回/随机不可复现）。
- **seek = 从头重演**（v1 无关键帧）：销毁影子 → 按 `levelId/seed` 重建 → 空跑到目标 `step`；
  钳制到 `[0, durationMs]`；拖动中暂停、松手才提交；恢复拖动前播放/暂停态。
- **倍速只缩放呈现时钟**：`REPLAY_SPEEDS=[1,2,4]`；命令注入仍按 `step` 精确执行；
  动画时长按 `1/speed` 缩放，不改任何 §3.5 权威毫秒。
- **内存上限与降级**：`REPLAY_MAX_EVENTS=8192`、`REPLAY_MAX_BYTES=262144`（§3.15）；
  任一超限 ⇒ 停止追加、`truncated=true`、**整份作废**（不允许半局播放）；
  入口置灰 + 轻提示；`bot-demo` 生成失败时菜单轻提示。字节口径 = 逐事件确定性估算（实现常量随 S3 落码，
  `REPLAY_MAX_BYTES` 仍 `[TODO]`，须真机实测后冻结）。
- **数据防呆**：`levelHash` 不一致、`seed` 缺失、`fixedDtMs<=0`、`step` 非单调 ⇒ 录像 `invalid`，
  入口禁用、不崩溃；`step` 越界钳制 + 一次调试告警。
- **终局校验**：比较每格 `colorIdx`、托盘每槽状态/颜色、`remainingMs` 量化值、`actions` 与 `ReplayFinal`；
  不一致 ⇒ `invalid`（生产可只告警，测试必断言）。

### DEC-4 · 状态承载：只新增 `REPLAY`，但落在壳层

- **新增**：`ShellScreen` 增加 `'replay'`（整页路由）；`ReplaySession` 持有播放器状态
  （`playing | paused | ended` 与 `speed`/`step`）。**这就是本系统唯一新增的「REPLAY 状态」**。
- **`BeadsPhase` 不新增 `'replay'`**：真实实例在回放期间**停在源相位**（own-last = `level-clear`，
  demo = `boot`），⛔ 不迁出、不迁回，故 `onEnter('level-clear')` 的结算链只跑一次（`§8-9`）。
  影子实例固定 `playing`；到达终局只作为「播放到头」信号。
- **托管**：`PLAYING` 内的标记 `assist: 'off' | 'bot'`，由 `BeadsGame` 持有并投影进 `BeadsSnapshot.assist`；
  暂停面板只改标记，不切相位；玩家点棋盘/托盘/道具卡 ⇒ 先 `assist='off'` 且**吞掉该次点击**（零玩法事件）。
- `REPLAY` **不进 `PAUSED`**：回放暂停是播放器自身标记；计时/存档/经济全不参与。
- `REPLAY` 期间**不 tick 真实 `BeadsGame`**；只 tick 影子实例。
- 退出 `REPLAY`：停止并销毁影子实例，壳层路由回进入源；`ClearPanel` 恢复 `interactive=true`，
  ⛔ 不重播星级入场、不二次发豆/写档。

> 命名差登记：GDD §2.1 把 `REPLAY` 写在核心循环状态机图上；工程承载点在壳层路由 + `ReplaySession`。
> 语义（输入门禁/计时/计星/存档口径）逐条不变，差异只在「由谁持有状态」。⛔ 本文不改 GDD；
> 由主对话合并 `core-loop §2.1` 时按本节口径改写（登记于 Epic §6 待确认项）。

### DEC-5 · 金样本回归（策略内核抽取）

- 生产策略 `'greedy-acb'` 固定：`branchOrder='ACB'`、`reuseAnchor=false`、`retrieve='max'`、
  `allowDirectFill=true`、`usePowerups=false`；对已入库全部关卡产出的 `pricing.actions` 必须与现网金样本**逐字一致**。
- `g3-lib.ts::runBot` 改为**薄包装**：构造生产策略 → 循环 `decide/apply` → 汇总统计；
  ⛔ 不得保留第二套独立判定逻辑（否则两套实现漂移且无人发现）。
- 策略**不消费 RNG**；若未来策略需要随机，随机结果必须**作为事件录制**，⛔ 实时重建随机源。
- 策略代码不依赖相机/缩放/UI/时钟；`decide()` 入参不可变。

### DEC-6 · 随机性与种子（录像可重演）

- 现网玩法里唯一的 RNG 消费点是随机型道具（`randomRestore` / `trayRestore` 的换出珠）；
  策略首版不用道具。
- 录像的 `seed` 字段 = **开局时 `services.rng.state` 快照**（不是 App 初始 seed），
  这样「玩家上一局」中的随机道具可在影子实例里逐位复现。
- 框架补一个确定性入口：`packages/framework/src/core/math/rng.ts` 新增
  `createRngFromState(state: number): Rng`（与 `createRng` 同算法，仅跳过 hash）。
  影子装配用 `createRngFromState(rec.seed)`；⛔ 不改 `createRng` 既有行为。
- **纪律**：任何新增的 RNG 消费点都必须把抽取结果作为事件录制，或在 `§8-3` 终局校验中显式排除；
  否则回放会静默分叉。此条进 `control-manifest §21`。

### DEC-7 · 命名消歧（必须与落码同批）

- `FinishPanelAction` 的 `'replay'` → **`'restart'`**（语义 = 重玩第 1 关，文案不变）；
  `panel-router.ts` 的 `if (action === 'replay') h.restartRun()` 同步改 `'restart'`。
- `ClearPanelAction` 新增 **`'replay'`**（过程回放）；`PanelRouter` 在 `level-clear` 分支把 `'replay'`
  交给壳层启动 `ReplaySession(source='own-last')`。
- 菜单新增动作 **`'bot-demo'`**（主菜单次级入口）；生成演示录像后进 `REPLAY(source='bot-demo')`。
- 两个 `'replay'` **不得混用**：`ClearPanelAction.replay` 只进回放页；`FinishPanelAction.restart` 只重开。
  加一条单测锁 id 字面量（防未来改名回退）。

### DEC-8 · 性能与热路径

- `ReplayPlayer.tick(dtMs)` 每帧运行：**零分配**——`ReplayViewModel` 预分配并原地写入；
  只在「当前 `step` 有事件」时注入，不逐帧遍历事件表。
- `decide()` 不在逐帧路径（托管 450ms/次、演示离线预计算）；允许每次调用构造只读观测视图，
  但**禁止**在 `BeadsGame.update` / `buildRenderModel` 内调用 `decide()`。
- 影子重演**不得写渲染层**：`replay/**` 只产出**只读 snapshot** 与 `ReplayViewModel`；
  `RenderModel` 由 UI 侧（`ui/play-binding.ts` 同序同参）从该只读 snapshot 构建，⛔ `replay/**` import `view/**`。
- 事件表只追加、播放只读；seek 重建实例是 O(n) 重演，v1 接受（见 §4.2-2）。

---

## 4. 后果

### 4.1 正面

- 三件事共用一套纯逻辑 + 一套回放设施：演示、托管、回放不产生三套门禁与清理路径。
- 策略可无头独立运行：金样本回归、确定性、终局一致全部可在 Node/vitest 验证，不依赖编辑器与真机。
- 回放不动真实结算链：`level-clear` 只进一次，`§8-9`「无二次结算」由结构保证而非特判。
- UI 只能消费只读模型：L5 与「策略不依赖 UI」同时成立。
- 录制/重演用 `step` 权威：暂停、倍速、seek 都不改变终局，与帧率解耦。

### 4.2 负面后果（已知成本，不是风险）

1. **文档命名与代码承载点存在一层差**：GDD §2.1 写「新增 `REPLAY` 状态」，代码里它是 `ShellScreen='replay'` + `ReplaySession`。
   后续读者若按 `BeadsPhase` 找会落空，必须靠 `control-manifest §21` 与 Epic 注记兜住。这是为避开
   `level-clear` 二次结算而**刻意**付的成本（§3 DEC-4）。
2. **v1 seek 是从头重演，长局 seek 是 O(n)**：`REPLAY_MAX_EVENTS=8192` 时一次拖动松手可能造成明显停顿；
   `REPLAY_SEEK_MAX_MS=2500000` 只是钳制上界，不是性能保证。关键帧 `[TODO]`，须真机实测后决定。
3. **录像仅内存、进程即丢**：小游戏被杀/切后台过久全部丢失（用户裁定）；无法跨设备复盘、无法客服取证。
4. **随机可重演依赖新增框架入口**：`createRngFromState` 是为一局录像而加的通用能力；若未来有其他 RNG 消费点
   未入录，回放会静默分叉，且 Node 测试可能只覆盖「不用道具」的路径 ⇒ 需 §8-3 终局校验与审查兜底。
5. **`levelHash` 无迁移**：关卡内容一改，旧录像全部失效（设计选择：拒绝而不是「尽力重演」），
   开发期频繁改关会让回放功能看起来「时好时坏」。
6. **影子实例是完整 `BeadsGame`**：演示生成时仍跑完整循环与特效事件，CPU 与内存峰值高于「纯算法 bot」；
   静音与不接 UI 只能缓解，不能消除。`REPLAY_MAX_BYTES` 与生成耗时为 `[TODO]`。
7. **`FinishPanelAction` 改名是破坏性 API 变更**：漏改同批调用点会编译红（可发现），但若有人按字符串
   比较 `'replay'` 绕过类型，则语义错用**不可发现** ⇒ 用字面量单测锁死。
8. **新模块进 Cocos 镜像需要编辑器 `.meta`**：本环境无编辑器 ⇒ 镜像腿 `[Blocked: 待编辑器]`，
   只能先验 Node/harness；⛔ 不得手写 `.meta`（L1）。
9. **托管是「真打」**：机器人失误会真实消耗玩家时间/道具/生命，并正常写档；它不是演示的安全沙箱。
   首版贪心不保证最优，卡关玩家可能看到机器人也过不了（`BOT_STUCK_LIMIT=1` 立即停机并提示）。
10. **重演正确性依赖「上下文 + 时间线事件」完整**：`starsBefore`（三档时钟）与续时（`revive`）任何一项漏录，
    回放会在 `remainingMs` / 计时上静默分叉；`§8-3` 终局校验能兜住「已发生」的分叉，但兜不住「录像生成时就没录」的缺陷
    ⇒ 录制完备性（`control-manifest §21-7`）必须由测试与评审双守。

### 4.3 中性 / 待观察

- `BOT_STEP_INTERVAL_MS=450 [待 playtest]`：只影响体感与节奏，不影响动作序与终局。
- `REPLAY_MAX_BYTES=262144 [TODO]`：按 8192 事件估算，真实占用与低端机表现待实测。
- `REPLAY_SPEEDS=[1,2,4]` 在 4x 下每帧注入多步，CPU 峰值与动效观感待 harness 走查。
- 演示打「当前最远解锁关」：大盘/boss 关机器人可能跑不完 ⇒ 不生成演示（不展示半局）；
  是否回退到较低关由后续 playtest 再评（当前裁定不回退）。
- 回放入口 v1 = 面板下方独立小钮（160×96），三钮重排留档；正式开放时按 Figma 重评。
- `BotCommand.retrieveSelectedGroup` 带 `slot`，而现公开 API 是 `retrieveSelectedGroup()`（固定入 `tray.firstFree()`）：
  S1 的 `applyBotCommand` 采用「`args.slot` 必须等于 `game.tray.firstFree()`，否则返回 `false`」的适配，⛔ 为此新增公开方法；
  若未来需要任意槽取回，须先改 GDD 契约（登记于 Epic §6）。

---

## 5. 复评触发条件

命中任一条即重开本 ADR：

1. **真机 playtest 定档**：`BOT_STEP_INTERVAL_MS` / `REPLAY_MAX_BYTES` / seek 停顿 / 4x 观感 —— 任一项拿到实测值。
2. **新增 RNG 消费点**或**新增策略**（`createBotPolicy` 注册表扩张）—— 必须复核 DEC-6 的「抽取结果入录」纪律。
3. 录像事件量常态接近 `REPLAY_MAX_EVENTS`（>50%）或出现真实 `truncated` 投诉 —— 复核上限与关键帧。
4. 需要**跨设备/上传/客服取证**（改变 `REPLAY_RETENTION='memory-only'`）—— 需重新做隐私与包体评估。
5. **关卡数据格式变更**（`levelHash` 失效面扩大）或关表频繁改动 —— 复核「拒绝旧录像」策略。
6. `POWERUP_TYPES` / 结算链（`onEnter('level-clear')`）/ 存档 schema 变更 —— 复核沙箱边界与 `§8-5`。
7. Cocos 构建/真机链可用（`.meta` 可生成）—— 补齐镜像与真机腿，复核 `[Blocked]` 项。
8. UI 正式开放「三钮重排」（UX D3）或回放入口改为图标 —— 复核 `ClearPanelAction='replay'` 的路由与命中。
9. 若上游决定把 `REPLAY` 真正纳入 `BeadsPhase` —— 必须先解决「退出 `level-clear` 不重跑结算」，否则本 ADR 的 DEC-4 不得推翻。
