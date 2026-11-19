# Epic 拆分 · EP15 机器人玩家与过程回放（Bot & Replay）· beads

- 任务号 **WXG-T-984**（P1）· 2026-11-19 · 工程轨（架构决策 + 任务拆分；本单零业务代码）
- 裁定链：用户 2026-11-19 拍板「演示 + 托管都要；策略独立纯逻辑、可无头独立运行；首版贪心；回放仅本局内存；演示不计星、托管正常计星；入口仅 ClearPanel」+ 同日三项追加（回放入口 = 面板下方独立小钮 / 演示打最远解锁关且跑不完不生成 / 托管开关在暂停面板 + HUD 只显示徽标 / `BOT_STEP_INTERVAL_MS=450 [待 playtest]`）
- **权威来源（冲突以左列为准）**：
  - 设计与契约 = `games/beads/design/gdd/bot-replay.md` v1.0（下称 **bot-replay**）
  - UI 几何与流转 = `games/beads/design/ux/bot-replay-spec.md` v1.0（下称 **ux-bot**）
  - 数值真源 = `games/beads/design/gdd/systems-index.md` **§3.15**（v2.01，21 条）
  - 工程决策 = `docs/architecture/adr/ADR-0038-beads-bot-replay.md`（下称 **ADR-0038**）
  - 金样本 = `games/beads/design/forensics/g3/g3-lib.ts::runBot`
- 验收纪律：各 Story 的验收标准**只引用 `bot-replay §8` 的条目号**（写法 `bot §8-<k>`），⛔ 不新造判据、⛔ 不发明 §3.15 未冻结数值。

---

## 0. 环境事实（先说做不了什么）

- **无 Cocos 编辑器 / 无真机**：新增 `src/**` 的 Cocos 镜像 `.meta` 只能由编辑器生成（L1）⇒ 镜像/真机腿标 `[Blocked: 待编辑器]`；Node/vitest 与浏览器 harness 可先行，策略/回放/录制全部引擎无关（ADR-0002/0038）。
- **本单不做**：⛔ 写 `src/**` / `tests/**` / cocos；⛔ 改 `games/beads/design/**`；⛔ 跑 `verify`/`build`（工作树含他轨 WIP）。
- 动 `games/beads/src/**` 的落码批必须同批 `framework:sync:check`；热路径零分配；`Math.random` 禁用（L4）。
- **状态承载差（ADR-0038 DEC-4）**：GDD §2.1 的 `REPLAY` 在工程里落在壳层路由（`ShellScreen='replay'`）+ `ReplaySession`，⛔ 不进 `BeadsPhase`（避开 `level-clear` 二次结算）。GDD 文本同步归主对话合并，见 §6。

---

## 1. Epic 目标

让 beads 在不增加玩家操作负担的前提下同时获得**可看（演示）/ 可托管（代打）/ 可复盘（回放）**：策略是独立纯逻辑层（可无头运行、接口可插拔），回放是输入级确定性重演，UI 只消费只读产物。

**覆盖系统**：S11（bot-replay；**提案编号，`systems-index §1/§2` 尚未收录**，见 §6）。依赖已落地的 S1/S2/S3/S4/S5/S6/S7/S8/S9/S10。

**范围外**：跨设备/上传/录像文件导出；实时观战；最优策略求解；失败/冲刺/全通关面板入口；`systems-index §4` 新公共事件；§3.15 数值改判。

---

## 2. Story 列表

### EP15-S1 · 策略内核抽取 + 金样本回归 — **M · READY**

- **目标**：把 `g3-lib.ts::runBot` 的行为抽成生产纯逻辑策略 `'greedy-acb'`，`g3-lib` 只留薄包装；Node 下逐字复现金样本。
- **范围**：
  - `bot/types.ts` / `bot/observe.ts` / `bot/apply.ts` / `bot/policy-greedy-acb.ts` / `bot/registry.ts`；
  - 固定参数 `branchOrder='ACB'` / `reuseAnchor=false` / `retrieve='max'` / `allowDirectFill=true` / `usePowerups=false`；
  - `g3-lib.ts::runBot` 改为「构造策略 → decide/apply 循环 → 汇总」。
- **非目标**：托管节拍、演示生成、录像、UI、道具使用（首版 `usePowerups=false`）。
- **依赖**：无（可即刻开工）。
- **涉及文件（拟定）**：`games/beads/src/bot/{types,observe,apply,policy-greedy-acb,registry}.ts`；`games/beads/design/forensics/g3/g3-lib.ts`（薄包装）；`games/beads/tests/bot-policy.test.ts`。
- **验收标准**：`bot §8-1`（金样本逐字一致）· `bot §8-2`（无头确定性 N=3 + 无 RNG 消费）· `bot §8-13`（架构门：`bot/**` 无 cc/DOM/wx）。
- **风险**：`runBot` 的统计口径（`moves` / `retrieve` / `directFills`）迁移时被顺手改语义 ⇒ 金样本对拍会红但需定位；策略 `decide()` 分配策略（允许低频分配，⛔ 逐帧）。

### EP15-S2 · BotDriver：演示（无头预计算）+ 托管（实时 450ms） — **M · READY**

- **目标**：一个可纯 Node 测的 `BotDriver`，支撑两条腿：演示离线跑完整局产出 `bot-demo` 录像；托管在真实对局按 `BOT_STEP_INTERVAL_MS` 施加 `BotAction`，支持暂停面板开关、HUD 徽标、玩家接管。
- **范围**：
  - `bot/driver.ts`：`tick(dtMs, game)`，仅在 `phase==='playing' && assist==='bot'` 出手；`BOT_STUCK_LIMIT=1` 停机；
  - `BeadsGame` 增量：`assist` 标记 + `setAssist()` + `BeadsSnapshot.assist`；暂停面板 `'toggle-assist'` 动作；
  - 演示入口动作 `'bot-demo'`：打当前最远解锁关（`BOT_DEMO_LEVEL='farthest-unlocked'`），固定 seed 盐 `REPLAY_DEMO_SEED_SALT`；
    跑不完整局 ⇒ **不生成**、菜单轻提示、⛔ 展示半局、⛔ 回退第 1 关；
  - 接管：托管中玩家点棋盘/托盘/道具卡 ⇒ `assist='off'` 且吞掉该次点击（零玩法事件）；HUD 齿轮仍能暂停。
- **非目标**：回放页与回放入口（S4）；录像结构实现（S3，S2 只调用其 API）。
- **依赖**：**S1**（策略）+ **S3**（录制器 API / 演示录像产出）。S1/S3 可并行，S2 在两者之后。
- **涉及文件（拟定）**：`games/beads/src/bot/driver.ts`；`games/beads/src/game/beads-game.ts`（assist 标记/快照字段/动作）；`games/beads/src/game/state.ts` 与 `games/beads/src/game/snapshot-shards.ts` / `snapshot-projection.ts`（`BeadsSnapshot.assist` 五片登记）；`games/beads/src/systems/pause-panel.ts`（开关行动作）；`games/beads/src/game/beads-shell.ts`（driver 持有与 demo 生成调度）；`games/beads/tests/bot-driver.test.ts`。
- **验收标准**：`bot §8-2`（托管下动作序列确定性）· `bot §8-5`（计星/存档矩阵的托管半边：与手动局同调用、同结果；演示不扣心不发豆）· `bot §8-10`（无合法动作自动暂停 + 关闭托管 + 轻提示；玩家接管零玩法事件；HUD 齿轮可暂停）· `bot §8-11`（托管结算同手动局）· `bot §8-14`（演示录像生命周期：退出即释放）。
- **风险**：把 driver 写进 `BeadsGame.update` 会制造内核 → bot 反向依赖（ADR-0038 DEC-1 禁止）⇒ 必放壳层；450ms 节拍与暂停同帧的裁决必须「门禁先切 PAUSED」（`bot-replay §6`）；托管写档与手动局共用路径，若另开写档分支即违约。

### EP15-S3 · 回放设施：录制器 + 影子播放器 + seek/倍速/进度 + 上限降级 — **L · READY**

- **目标**：输入级录制与确定性重演；`ReplayPlayer` 支持播放/暂停/1x·2x·4x/进度 seek/结束；上限与降级按 ADR-0038 DEC-3。
- **范围**：
  - `replay/recorder.ts`：`ReplayRecording` v1、`step` 权威、起止/清理、`truncated` 整份作废；
    录制上下文 `{ levelIndex, starsBefore, revived }`（三档时钟/续时保底星）；续时不丢弃录制，
    加时以系统时间线事件 `{ cmd:'revive', args:{ bonusSec } }` 入录（ADR-0038 DEC-3）；
  - `replay/sandbox.ts` + `BeadsGameOptions.replaySandbox` + `onCommandApplied` 录制钩子；noop 服务边界；
    `PowerupSystem.requestAuthorized`（跳过免费额度门槛、不写 `_freeDepleted`）、`expandTray()` 纯机制；
  - `replay/player.ts`：影子实例、固定步、按 `step` 注入、seek = 从头重演、倍速只缩放呈现时钟、终局冻结；
  - `replay/level-hash.ts`：FNV-1a 规范化关卡指纹；
  - `packages/framework/src/core/math/rng.ts` 新增 `createRngFromState(state)`（ADR-0038 DEC-6）。
- **非目标**：关键帧（`REPLAY_KEYFRAME_INTERVAL_MS` 留 `[TODO]`）；回放页 UI（S4）；演示/托管的用户入口（S2/S4）。
- **依赖**：无（纯设施，可与 **S1** 并行开工；演示生成在 S2 消费其 API）。
- **涉及文件（拟定）**：`games/beads/src/replay/{recorder,player,sandbox,level-hash,view-model}.ts`；`games/beads/src/systems/powerups.ts`（授权通道）；`games/beads/src/game/beads-game.ts`（`replaySandbox` / `onCommandApplied` / `elapsedPlayingMs` / 沙箱短路）；`games/beads/src/game/beads-shell.ts`（录制器生命周期与 `services.rng.state` 取种）；`packages/framework/src/core/math/rng.ts`；`games/beads/tests/replay-*.test.ts`、`packages/framework/tests/core/rng-from-state.test.ts`。
- **验收标准**：`bot §8-3`（终局一致）· `bot §8-4`（seek/暂停/倍速不改变终局）· `bot §8-5`（演示/回放零副作用：spy 存档/钱包/体力/发豆零调用）· `bot §8-8`（超限 `truncated`、置灰、不播半局、不崩溃）· `bot §8-12`（数据防呆）· `bot §8-14`（内存与生命周期）· `bot §8-13`（`replay/**` 架构门）。
- **风险**：影子若直接共享 `services.storage` / 事件总线 ⇒ 静默写档与音频；**漏录 `starsBefore` 会让影子按 1 档时钟重演（`remainingMs` 必不一致）**；**续时局若按 `GAME_OVER` 丢弃录制或漏录加时事件 ⇒ 玩家「续时后过关」无回放/回放分叉**；`randomRestore` 的 RNG 流若不复位 ⇒ `§8-3` 偶发红；`onCommandApplied` 漏录 `expandTray/usePowerup` ⇒ 后续取回不可复现；字节上限口径未实测（`[TODO]`）。

### EP15-S4 · UI：ClearPanel 回放入口 + 全屏回放页 + 演示结束条 — **M · READY**

- **目标**：按 `ux-bot` v1 落三块 UI，零改动现有 ClearPanel 两钮与四段内容。
- **范围**：
  - `ClearPanelAction` 新增 `'replay'`；`FinishPanelAction` 的 `'replay'` → **`'restart'`**（同批消歧）；
  - 回放入口：木牌（545×585，底 y=393）下方居中独立小钮 **160×96**（x∈[295,455]，底 y=192），仅 `LEVEL_CLEAR && interactive`；
  - 全屏回放页：`ShellScreen='replay'`，复用玩法四带（HUD / PUZZLE / TRAY / 传输带），传输带替换道具带；
    退出 88×88、播放/暂停 96×96、进度条（轨道 8px + 热区 88px 高）、倍速 112×88（1x/2x/4x）；
  - 演示结束条 / 回放结束条（560×240）；「再看一遍/重播」= 同一份内存录像从头播，不重新生成；
  - 托管 HUD 徽标 132×56（静态、零热区、无脉冲）；暂停面板「托管」开关行（440×88）。
- **非目标**：三钮重排（留档 UX D3）；图标化入口（留待正式开放）；新音频 clip（尊重现有开关，无关键音效则静默）。
- **依赖**：**S2**（assist 标记与演示录像）、**S3**（`ReplayViewModel` / 播放器）。
- **涉及文件（拟定）**：`games/beads/src/systems/clear-panel.ts`、`finish-panel.ts`、`pause-panel.ts`；`games/beads/src/game/beads-game/panel-router.ts`；`games/beads/src/game/beads-shell.ts`；`games/beads/src/ui/phase-route-binder.ts`（`'replay'` 路由）；`games/beads/src/view/{view-model,replay-view}.ts`；`games/beads/src/config/tuning/menu.ts`（入口钮/回放页几何，⛔ 不进 §3）；`games/beads/tests/{clear-panel,replay-page,assist-ui}.test.ts`。
- **验收标准**：`bot §8-6`（入口唯一：仅 LEVEL_CLEAR；GAME_OVER/冲刺/FINISH 逐相位命中测试无入口）· `bot §8-7`（回放页零玩法输入：棋盘/托盘/道具位/相机手势注入 ⇒ 影子公开命令调用数 0）· `bot §8-9`（退出回源：ClearPanel 立即 interactive、星级/豆数不变、无二次结算；主菜单进演示退出回主菜单）· `bot §8-10`（HUD 齿轮仍能暂停）。
- **风险**：入口钮与彩带/安全区冲突（允许在「面板下方居中」内微调 x/y，⛔ 挤进木牌内部）；改名漏改字符串比较（用字面量单测锁）；回放页误接玩法输入路由（必须走独立整页路由，⛔ 复用 `PanelRouter`）。

### EP15-S5 · 测试 / QA 接线：§8 十四条判据 ↔ 用例追溯 — **S · READY（待 S1–S4 落码后收口）**

- **目标**：把 `bot §8-1…§8-14` 逐条映射到单测/集成/harness 证据，出追溯表；补机械门。
- **范围**：
  - 追溯表（判据号 → 测试文件/用例名 → 级别：自动/人工/`DEFERRED`）；
  - `check:arch` 新增 §21 规则（`bot/**`、`replay/**` 依赖与禁令；UI 不 import 策略）+ 负样本自测；
  - 金样本对拍、确定性 N=3、终局一致、seek 一致、矩阵 spy、入口唯一、零输入、溢出降级、退出回源、托管卡死/接管/结算、数据防呆、生命周期；
  - 真机腿（体感/内存/seek 停顿）标 `DEFERRED — 需真机 playtest`，⛔ 记 PASS。
- **非目标**：修业务代码（发现缺陷回开 S1–S4）；Playtest 计划正文（归 QA 域 `wxgame-qa-gates`）。
- **依赖**：**S1–S4**。
- **涉及文件（拟定）**：`games/beads/tests/**`（增量）；`tools/scripts/check-architecture.mjs`（§21 规则）；`production/qa/beads/bot-replay-*.md`（用例/证据，归 QA 域落位）。
- **验收标准**：`bot §8-13`（架构门全绿：`bot/**`、`replay/**` 无 cc/DOM/wx/window/document；UI 不 import 策略；`check:arch`/L3 扫描/单测全绿）+ **追溯表覆盖 `§8-1…§8-14` 共 14/14**（覆盖本身是流程要求，判据正文仍只引用这 14 条，⛔ 新造第 15 条）。
- **风险**：只跑「金样本 + 正常局」的快乐路径，漏 `invalid/truncated/接管` 反例 ⇒ 每条判据至少一个反例臂；把 `[Blocked: 待编辑器]` 的真机腿记成 PASS（K-036）。

---

## 3. 冲刺编排（第一冲刺 = 最小可验证垂直切片）

| 批次 | Story | 理由 / 垂直切片 |
|---|---|---|
| **冲刺 1（即刻）** | **S1 + S3** | 纯 Node 可验、零编辑器零真机：策略抽内核 + 金样本对拍（S1），录像/影子/seek/降级（S3）。切片终点 = **生成一段 `bot-demo` 风格录像并用 `ReplayPlayer` 播完，终局与录制一致**；覆盖 `§8-1/2/3/4/5/8/12/14`。S1 与 S3 可并行（S3 骨架不依赖策略）。 |
| 冲刺 2 | **S2** | 在 S1/S3 之上接 driver：托管 450ms + 暂停开关 + 接管 + 演示生成失败口径；覆盖 `§8-10/11`。 |
| 冲刺 2/3 | **S4** | UI 三块（入口钮/回放页/结束条/徽标）；可 harness 走查；覆盖 `§8-6/7/9`。与 S2 可部分并行（S4 的回放页只依赖 S3 的 view model）。 |
| 冲刺 3 | **S5** | 全量追溯表 + 机械门 + 反例臂；真机腿 DEFERRED。 |

> 不把 S4 放第一冲刺：入口与回放页依赖 S3 的 `ReplayViewModel`，且 UI 走查需要可播放的录像；先证内核与设施，再上界面。

---

## 4. 统计与状态

- **Epic × 1（5 Story）**：READY × 5（S5 依赖 S1–S4，状态为 READY/待收口）。
- **估点**：S×1（S5）· M×3（S1/S2/S4）· L×1（S3）。
- **新增冻结数值 0**：全部消费 `systems-index §3.15`（21 条）；UI 几何住 `ux-bot` 与 `tuning/menu.ts`，⛔ 不进 §3。
- **新增公共事件 0**：经 `BeadsSnapshot` / `ReplayViewModel` 只读投影。
- **存档结构变更 0**：回放仅内存（`REPLAY_RETENTION='memory-only'`）；演示/回放不写档，托管沿用既有写档路径。
- **状态账**：本文件为拆分正本；Story 状态对账以 `production/epics/epics-beads-status.md` 为准（本单未改写该文件）。

---

## 5. 风险与缓解

| # | 风险 | 缓解 |
|---|---|---|
| R-1 | 回放期间真实实例迁相位 ⇒ 重跑 `onEnter('level-clear')` 二次结算 | ADR-0038 DEC-4：真实实例停在源相位；`REPLAY` 落壳层；`§8-9` 反例臂锁「退出后豆数/星级不变」 |
| R-2 | 影子实例共享真实 `services` ⇒ 静默写档/发豆/拉广告 | `replaySandbox` + 隔离 noop 服务；`§8-5` 用 spy 断言零调用；`requestAuthorized` 不写 `_freeDepleted` |
| R-3 | 策略抽取后与 `g3-lib` 双实现漂移 | `g3-lib::runBot` 只留薄包装；`§8-1` 全关 `pricing.actions` 逐字对拍（⛔ 抽样） |
| R-4 | seek/倍速改变终局（`atMs` 浮点、事件跨步） | `step` 为唯一注入依据；seek 从头重演；`§8-4` 三目标 step 对拍 |
| R-5 | 长局 seek 卡顿 / 事件超限 | `REPLAY_MAX_EVENTS/BYTES` + `truncated` 整份作废；`[TODO]` 真机实测后定关键帧；`§8-8` 反例 |
| R-6 | 两个 `'replay'` 语义互撞（FinishPanel vs ClearPanel） | ADR-0038 DEC-7：`FinishPanelAction 'replay'→'restart'` 同批改名；字面量单测锁 id |
| R-7 | 新增 `src/**` 的 Cocos `.meta` 无法本环境生成 | 镜像/真机腿 `[Blocked: 待编辑器]`；先 Node/harness；⛔ 手写 `.meta`（L1） |
| R-8 | 托管被误当演示沙箱 ⇒ 玩家被真实扣资源后投诉 | UX 暂停面板二次确认（开→继续）；GDD §2.4 矩阵入档；`§8-11` 结算口径对拍 |
| R-9 | `BOT_STEP_INTERVAL_MS=450` 未经 playtest 冻结 | 标 `[待 playtest]`；只影响节奏不影响终局；`§8-2` 证明与节拍无关的确定性 |

---

## 6. 遗留与待确认项

1. **S11 未并入 systems-index §1/§2**（bot-replay 文首自述「提案编号」）：Epic 顺序暂按「依赖 S1–S10 已落地」排；正式并入时若 §2 拓扑变化，回写本文 §1 覆盖系统与依赖（⛔ 本文不抢先改 §2）。
2. **GDD §2.1「REPLAY 状态」的承载点差**：工程落壳层路由 + `ReplaySession`（ADR-0038 DEC-4），GDD 文本由主对话合并；同时 `core-loop §2.1/§8`、`input-control §2.3`、`ux-spec §3.4/§4/§5`、`pause-settings §2.2/§8` 的增补点见 `ux-bot` 附录 A–D（本单不改这些文件）。
3. **`BOT_STEP_INTERVAL_MS` / `REPLAY_MAX_BYTES` / seek 性能门槛**：`[TODO]`，解除条件 = 真机体感与内存实测。
4. **主菜单「演示」钮精确落位**：归 `meta-ui` / `menu-architecture`，本 Epic 只要求次级入口且 ≥88×88（`ux-bot §8.2-3`）。
5. **暂停面板托管开关行精确 y**：归 `tuning` 实测回填（`ux-bot §8.2-4`），本 Epic 只给 462 ≤ 480 预算。
6. **`REPLAY_KEYFRAME_INTERVAL_MS`**：v1 不落码；何时引入见 ADR-0038 §5 复评触发。
7. **`BotCommand.retrieveSelectedGroup.slot` 与现 API 签名差**：现公开方法无 `slot` 形参（固定入 `tray.firstFree()`）；
   S1 按 ADR-0038 §4.3 末条做适配（`slot` 必须等于 `firstFree()`，否则 `false`）。若要支持任意槽，需设计轨先改契约。
8. **`ReplayEvent` 需扩「系统时间线事件」**：续时加时（`cmd:'revive'`）超出 GDD §2.3.1 的 `BotCommand['type']` 值域；
   S3 按 ADR-0038 DEC-3 先实现，设计轨需同步 `ReplayEvent` 类型（登记为契约缺口，⛔ 由工程单方面改 GDD）。
