# GDD · S11 机器人玩家与过程回放（Bot & Replay）· beads

- 项目：`games/beads` · 版本 **v1.0** · 任务号 **WXG-T-983** · 日期 2026-11-19
- 范围：**仅 beads**；breakout 不做。本文只定义设计与接口契约，不落业务代码。
- 数值纪律：本文只引用 `gdd/systems-index.md` §3 常量名；本系统新增常量见 **§3.15**。UI 几何常量（面板/按钮/进度条）住 `ux/bot-replay-spec.md` 与 `tuning`，**不进 §3**（沿用「颜色与纯呈现几何不进数值真源」判例）。
- 术语消歧（硬口径）：
  - **回放 = replay**：对一局**已发生**对局按输入级事件重演；入口仅过关结算面板 `ClearPanel`。
  - **重玩 = restart**：既有 `FinishPanel` 的「重玩第 1 关」语义；本系统**不改其行为**，只要求设计口径与文案改称「重玩」，避免与 replay 混淆。⚠ 现有 `FinishPanelAction` 的成员名 `'replay'` 承载的正是 restart 语义，**建议工程侧改名 `'restart'`**；`ClearPanel` 新增的 `'replay'` 是过程回放，两者不得混用同一 id。
  - **演示 = bot demo**：机器人**预计算**一局完整对局，再以回放方式播放；不是实时机器人。
  - **托管 = bot assist**：机器人**实时**驱动当前 `PLAYING` 对局；正常计星、正常存档。
- 系统编号说明：`S11` 为本单提议编号；`systems-index §1/§2` 尚未收录，属待主对话并入项（见 `ux/bot-replay-spec.md` 附录）。

---

## 1. 目标

让 beads 在不增加玩家操作负担的前提下，同时获得三件事：**可看**（机器人演示降低理解门槛）、**可托管**（卡关时机器人代打，正常计入进度）、**可复盘**（玩家上一局可按输入级确定性重演）。三者共用一套**完全独立于 UI 的纯逻辑层 + 一套回放设施**，UI 只消费其只读产物。

非目标（明确不做）：

- 不联网、不训练、不上传、不导出录像文件；回放仅本局内存，**不写存档**。
- 不做实时观战/多人观战；演示是本地预计算结果。
- 不做机器人策略的最优化求解；首版只做可复现的贪心策略。
- 不改变既有失败续时、冲刺、全通关面板的入口；回放入口**仅 ClearPanel**。
- 不新增 `systems-index §4` 公共事件（避免事件总线扩张；UI 只读 snapshot / render model）。

---

## 2. 机制

### 2.1 状态机接入（与 `core-loop §4` 对接）

**定论：新增一个状态 `REPLAY`；机器人演示不是独立状态，而是 `REPLAY` 的 `source='bot-demo'` 变体；托管不是状态，而是 `PLAYING` 内的标记 `assist='bot'`。**

理由：

1. 演示与回放的**输入门禁、计时语义、计星/存档口径完全一致**（都只允许传输控件、都不写档），拆成两个状态会产生两套几乎相同的门禁与清理路径。
2. 演示既然采用「预计算再播放」，它天然就是一份 `bot-demo` 录像；与玩家上一局共用同一个 `ReplaySession` 播放器。
3. 托管必须正常计星/存档/失败，因此不能离开 `PLAYING`；用标记而非状态，避免复制计时、输入、结算链路。

```
BOOT ──► PLAYING(assist='off'|'bot') ⇄ PAUSED
           │  │
           │  ├─ 错位珠全部归位 ──► LEVEL_CLEAR ──「回放」──► REPLAY(source='own-last')
           │  │                                      ▲            │
           │  │                                      └──「退出」───┘
           │  └─ 倒计时归零 ──► GAME_OVER（无回放入口）
           │
           └─（主菜单「演示」──► REPLAY(source='bot-demo') ──「退出」──► 主菜单）

LEVEL_CLEAR ──「下一关 / 查看结果」──► PLAYING / FINISH（既有分支不变）
```

| 状态 | 职责 | 进入条件 | 退出条件 |
|---|---|---|---|
| `REPLAY` | 播放一份内存录像：影子引擎按固定步长重演，只响应传输控件 | `LEVEL_CLEAR` 点「回放」；主菜单点「演示」 | 「退出」→ 回进入源（`LEVEL_CLEAR` / 主菜单）；播放结束停留 |
| `PLAYING` + `assist='bot'` | 机器人按节奏驱动真实对局；玩家可随时接管 | `PAUSED` 面板打开「托管」开关并继续 | 关闭托管 / 玩家接管 / 通关 / 失败 / 退出 |

- `REPLAY` **不进入** `PAUSED`：回放的暂停是播放器自身的 `paused` 标记，不是游戏暂停；计时/存档/经济全不参与。
- `REPLAY` 期间**不 tick 真实 `BeadsGame`**；只 tick 影子实例。真实对局的 `LEVEL_CLEAR` 结算数据保持不变（回放不是二次结算）。
- `REPLAY` 退出到 `LEVEL_CLEAR` 时，`ClearPanel` **立即恢复为可点**，**不重播星级入场、不重新发豆、不重新写档**。
- `GAME_OVER` / 冲刺结算 / `FINISH` **不提供**回放或演示入口（用户拍板）。

### 2.2 机器人策略契约（纯逻辑层）

#### 2.2.1 分层与依赖方向

```
┌──────────────────────────────┐
│ UI（replay page / ClearPanel）│  只读：ReplayViewModel / render model
└──────────────▲───────────────┘
               │ 只读产物
┌──────────────┴───────────────┐
│ replay/（录制器 + 播放器）    │  依赖 bot/ 与 BeadsGame
└──────────────▲───────────────┘
               │
┌──────────────┴───────────────┐
│ bot/（策略 + observe/apply）  │  纯逻辑：无 cc / DOM / wx / Node API / UI
└──────────────▲───────────────┘
               │ 只走公开命令
┌──────────────┴───────────────┐
│ BeadsGame 公开命令与只读观测  │
└──────────────────────────────┘
```

硬约束：

- `bot/**` 与 `replay/**` **不得** import `view/**`、`ui/**`、`palette`、`tuning` 之外的呈现常量。
- `bot/**` **不得**消费 `services.rng` / `Math.random`；策略内一切平票用确定性 tie-break（行优先、槽号升序、组大小降序）。
- UI **不得** import 策略实现或 `decide()`；只消费 `ReplayViewModel` 与 `BeadsSnapshot`。
- 回放影子实例不得注入真实存档 / 钱包 / 体力 / 激励视频服务；用 noop 服务与 `replaySandbox` 选项。

#### 2.2.2 接口（observe → decide → command）

```ts
export interface BotObservation {
  readonly levelId: string;
  readonly seed: number;
  readonly remainingMs: number;
  readonly grid: {
    readonly cols: number; readonly rows: number;
    readonly cells: readonly {
      readonly row: number; readonly col: number;
      readonly state: 'empty' | 'filled' | 'locked';
      readonly colorIdx: number;        // filled 时有效，否则 -1
      readonly requiredColorIdx: number; // 底色；空位/锁定为 -1
    }[];
  };
  readonly tray: {
    readonly capacity: number;
    readonly slots: readonly {
      readonly index: number;
      readonly state: 'free' | 'holding';
      readonly colorIdx: number;
    }[];
  };
  readonly selection: { readonly kind: 'none' | 'board' | 'tray'; readonly row?: number; readonly col?: number; readonly slot?: number };
  readonly powerups: readonly { readonly type: 'windowRestore' | 'randomRestore' | 'trayRestore'; readonly usable: boolean }[];
}

export type BotCommand =
  | { readonly type: 'selectBoardBead'; readonly row: number; readonly col: number }
  | { readonly type: 'retrieveSelectedGroup'; readonly slot: number }
  | { readonly type: 'selectTraySlot'; readonly slot: number }
  | { readonly type: 'tapGridCell'; readonly row: number; readonly col: number }
  | { readonly type: 'usePowerup'; readonly powerup: 'windowRestore' | 'randomRestore' | 'trayRestore' }
  | { readonly type: 'expandTray' };

/** 一次「人类可感知的批量动作」= 1–2 条原语命令，按序在连续固定步执行。 */
export interface BotAction { readonly commands: readonly BotCommand[]; }

export interface BotPolicy {
  readonly id: string;
  readonly version: number;
  /** null = 当前观测下无合法动作（卡死）。纯函数：不得改写入参、不得读时钟/随机数。 */
  decide(obs: BotObservation): BotAction | null;
}

export function observeGame(game: BeadsGame): BotObservation; // 适配器
export function applyBotCommand(game: BeadsGame, cmd: BotCommand): boolean; // 适配器
```

- `decide()` 只返回**意图**，不直接改游戏；`applyBotCommand()` 只调用 `BeadsGame` 公开命令，返回该命令是否成功。
- 一条 `BotAction` 最多 2 条命令（选锚 + 执行），按序在**连续两个固定步**执行，满足 `core-loop §2.2.2`「每帧最多 1 条输入指令」；两次动作之间间隔 `BOT_STEP_INTERVAL_MS`。
- 策略注册表：

```ts
export const BOT_POLICY_DEFAULT = 'greedy-acb';
export function createBotPolicy(id = BOT_POLICY_DEFAULT): BotPolicy;
```

首版只承诺 `'greedy-acb'`；第二策略（如 `'greedy-bac'`）只作测试/实验注册，不进玩家入口。扩展点要求：新策略必须通过同一套契约测试（确定性、无 RNG、只读观测、不越权写状态）。

#### 2.2.3 首版贪心策略（逐条规则）

`'greedy-acb'` 必须**逐字复现** `games/beads/design/forensics/g3/g3-lib.ts::runBot` 在 `branchOrder='ACB'`、`reuseAnchor=false`、`retrieve='max'`、`allowDirectFill=true`、`usePowerups=false` 下的动作序：

1. **A：托盘归位**——找托盘持有珠的颜色中、棋盘仍有同色空穴者；取最小槽号；选中该槽；点该色第一个空穴（行优先）。成功即结束本轮。
2. **C：盘上直填**——找一颗错位珠，其珠色在棋盘有对应空穴；优先选「填完后能造出托盘当前持有色的空穴」的滑步（`useful` 优先），平票按行优先；选中该错位珠；点目标空穴。成功即结束本轮。
3. **B：整组取回**——取托盘第一个空槽；按同色错位连通块大小降序（同大小按行优先）选组；选中组锚珠；`retrieveSelectedGroup(start)`。成功即结束本轮。
4. 三分支按 **A → C → B** 顺序尝试，任一成功即停；全失败 → `decide()` 返回 `null`。
5. 不使用道具（`usePowerups=false`）；不消费 RNG；不依赖当前相机/缩放/UI 状态。
6. 终止性：归位/直填使错位数 −1，取回使空槽 −1，两者不回退；另设 `BOT_MAX_MOVES` 硬上限。

> 金样本判据见 §8-1。抽取内核时 `g3-lib.ts` 只保留薄包装（工具侧调用），生产策略住 `src/bot/**`，Node 与小游戏包共用同一份纯逻辑。

#### 2.2.4 演示与托管：两种驱动模式

| 维度 | 演示（bot demo） | 托管（bot assist） |
|---|---|---|
| 驱动方式 | **无头预计算**：影子引擎一次跑完，产出录像；UI 播放录像 | **实时**：每个 `BOT_STEP_INTERVAL_MS` 对真实 `BeadsGame` 施加一条 `BotAction` |
| 所在状态 | `REPLAY(source='bot-demo')` | `PLAYING(assist='bot')` |
| 计星 / 存档 | 不计星、不写档、不发豆、不扣心 | **正常计星、正常写档、正常发豆、正常扣心**（进局时已扣） |
| 失败处理 | 预计算失败/卡死 ⇒ 不生成演示，菜单轻提示；绝不展示半局 | 无合法动作 ⇒ **自动暂停 + 关闭托管 + 轻提示**；倒计时归零 ⇒ 正常 `GAME_OVER` |
| 节奏 | 可 1x/2x/4x、可暂停、可拖动 seek | 固定 1x 人类节奏，不可倍速；暂停即冻结 |
| 回放入口 | 演示结束条可「再看一遍」 | 无（走正常 ClearPanel） |

- 演示关卡 = **当前最远解锁关**（用户 2026-11-19 裁定）；机器人跑不完整局时按上表「失败处理」走：不生成演示、菜单轻提示、绝不展示半局，也不回退到第 1 关。

托管不改变任何结算语义：机器人只是「替玩家按命令」，`BeadsGame` 仍是唯一状态真源；L5 不被破坏。

### 2.3 回放契约

#### 2.3.1 录制结构

```ts
export interface ReplayRecording {
  readonly v: 1;
  readonly source: 'own-last' | 'bot-demo';
  readonly levelId: string;
  readonly levelHash: string;   // 关卡数据指纹；不一致 ⇒ 拒绝回放
  readonly seed: number;
  readonly fixedDtMs: number;   // = 框架固定步长，当前 1000/60
  readonly durationMs: number;  // 有效对局时长（不含暂停）
  readonly events: readonly ReplayEvent[];
  readonly final: ReplayFinal;
  readonly truncated: boolean;
  readonly policyId?: string;   // bot-demo 必填
}

export interface ReplayEvent {
  readonly atMs: number;        // 有效对局时间轴，量化到 fixedDtMs
  readonly step: number;        // 权威定位：round(atMs / fixedDtMs)
  readonly cmd: BotCommand['type'];
  readonly args: Readonly<Record<string, number | string>>;
}

export interface ReplayFinal {
  readonly cleared: boolean;
  readonly failed: boolean;
  readonly remainingMs: number;
  readonly actions: number;     // 有效动作数（与 ClearPanel clearActions 同口径）
  readonly misplacedLeft: number;
  readonly trayHolding: number;
  readonly stars?: number;      // 仅展示快照，永不写档
}
```

字段口径：

- `atMs` 是**有效对局时间**：`PAUSED`、后台挂起、回放自身暂停都不计入；因此暂停不会改变重演结果。
- `step` 是权威定位；`atMs` 仅供显示与 seek 输入，重演时一律用 `step`，避免浮点漂移。
- `levelHash` 用于防「关卡数据已更新、旧录像重演到另一张盘」；不一致时回放入口置灰并提示「关卡已更新，无法回放」。
- `expandTray` 必须被录制：扩容改变托盘容量，不录会导致后续取回不可复现。
- `usePowerup` 必须被录制；影子实例在 `replaySandbox` 下**不检查也不消耗**免费次数/豆子，只执行已授权意图，保证重演与当时一致。

#### 2.3.2 录制起止与清理

| 时机 | 行为 |
|---|---|
| 进入 `PLAYING`（BOOT 装配完成、开局扣心成功后） | 新建录制器；写入 `levelId / levelHash / seed / fixedDtMs`；`step=0` |
| 玩家/机器人每条公开命令成功 | 追加 `ReplayEvent`；同一 `step` 可有多条（一条 `BotAction` 的两条命令落在连续 step，不合并） |
| `PAUSED` | 暂停计时累计；**不写事件**；恢复后继续 |
| `LEVEL_CLEAR` | 停止录制；写入 `final`；标记为「上一局」可回放 |
| `GAME_OVER` | 停止录制；**丢弃**（失败局不提供回放入口） |
| 重试本关 / 下一关 / 回主菜单 / 重新冲刺 | 清理上一局录制器；新局重新开始 |
| 进入 `REPLAY` | **只读**当前录像；不新建、不修改 |
| 退出 `REPLAY` | 保留录像直到下一次 `PLAYING` 开始（允许反复观看） |
| `bot-demo` | 生成后驻留内存；退出演示页即丢弃（不占「上一局」槽位） |
| 应用重启 / 小游戏被杀 | 全部丢失（仅内存，符合用户裁定） |

#### 2.3.3 影子引擎重演

- 新建一个 `BeadsGame` 影子实例：同 `levelId`、同 `seed`、`replaySandbox=true`、服务用 noop（存档/钱包/体力/广告/音频可选静音）。
- 按 `fixedDtMs` 逐步 `step(dt)`；在每个 `step` 开始前注入该 step 的全部事件（按录制顺序）；不读真实输入。
- 每步只 `buildRenderModel(snapshot)` 供 UI 绘制；**不**调用任何结算写档、发豆、扣心、上报。
- 终局校验（测试/调试开启，生产可关）：比较 `grid` 每格 `colorIdx`、托盘每槽状态与颜色、`remainingMs` 量化值、`actions`；任何不一致 ⇒ 该录像标记 `invalid`，UI 禁用回放并提示。
- 重演必须与录制时**同一份关卡数据与同一套规则常量**；`levelHash` 不一致直接拒绝，不做兼容迁移。

#### 2.3.4 播放、暂停、倍速、seek 语义

| 操作 | 语义 |
|---|---|
| 播放 | 影子时钟按 `fixedDtMs × speed` 推进；到 `durationMs` 停 |
| 暂停 | 影子时钟停；画面停在当前 step；不写事件、不改终局 |
| 倍速 `1x/2x/4x` | 只改影子时钟推进倍率；**命令注入仍按 step 精确执行**；对应渲染动画时长按 `1/speed` 缩放（不新增毫秒常量） |
| 拖动进度条 | 拖动中自动暂停；只更新预览时间标签与滑块；**松手才提交** |
| seek 提交 | **销毁影子实例 → 从头新建 → 快进到目标 step**；到达后恢复到拖动前的播放/暂停状态 |
| seek 越界 | 钳到 `[0, durationMs]`；不报错 |
| 播放到尾 | 停在最终帧；弹「回放结束」条（重播 / 退出）；不自动循环 |
| 退出 | 停止影子实例；回到进入源（`LEVEL_CLEAR` 或主菜单） |

**v1 seek 策略 = 从头重演**，不做关键帧。理由：首版事件量小、实现最简、确定性最强；关键帧涉及影子状态可序列化，属后续优化。性能门槛与关键帧间隔标 `[TODO]`（见 §3.15），须真机实测后再冻结。

#### 2.3.5 内存上限与溢出降级

- 事件数上限 `REPLAY_MAX_EVENTS`、字节上限 `REPLAY_MAX_BYTES`。
- 达到任一上限：停止追加；`truncated=true`；**整份录像作废**（不允许只播前半段，否则终局与录制不一致）。
- `truncated` 时：`ClearPanel` 的「回放」钮置灰 + 轻提示「本局过长，回放不可用」；`bot-demo` 生成失败时菜单轻提示。
- 录制器不逐帧分配大对象；事件对象在录制时一次性建好，播放时只读。

### 2.4 计星与存档影响矩阵

| 模式 | 星级 | 存档 | 豆 / 心 | 结算面板 | 回放入口 |
|---|---|---|---|---|---|
| 正常 `PLAYING` | 正常判星 | 正常写档 | 正常发豆 / 进局扣心 | `ClearPanel`（现有） | 有（本局过关后） |
| 托管 `PLAYING(assist='bot')` | **正常判星** | **正常写档** | **正常** | `ClearPanel`（现有） | 有（本局过关后） |
| 演示 `REPLAY(source='bot-demo')` | **不计星** | **不写档** | **不发豆、不扣心** | 独立「演示结束条」 | 结束条内「再看一遍」 |
| 回放 `REPLAY(source='own-last')` | **不计星** | **不写档** | **不发豆、不扣心** | 退出后回 `ClearPanel`（不二次结算） | 可重复进入 |

补充口径：

- 演示不消耗体力：主菜单「演示」入口不扣心；不改变 `STAMINA_START_COST` 的既有语义（它管「开始游戏/选关进玩法」）。
- 托管是对**真实对局**的辅助，因此一切经济/进度副作用与手动玩完全一致；这是与演示/回放最关键的边界。
- 回放不发「品质分/最佳」等结算数据；`ReplayFinal.stars` 只作画面展示，不参与 `SETTLE_SCORE`，不写 `settleBestByUid`。

---

## 3. 输入

| 来源 | 内容 | 去向 |
|---|---|---|
| 玩家（`LEVEL_CLEAR`） | 点「回放」 | `ClearPanelAction='replay'` → S1 切 `REPLAY(source='own-last')` |
| 玩家（主菜单） | 点「演示」 | 菜单动作 → 生成 `bot-demo` 录像 → S1 切 `REPLAY(source='bot-demo')` |
| 玩家（`REPLAY`） | 播放/暂停、倍速、拖动/点击进度条、退出、结束条「重播/退出」 | 回放播放器；**不进入玩法输入路由** |
| 玩家（`PAUSED`） | 打开/关闭「托管」开关 | `assist` 标记切换；继续后生效 |
| 玩家（`PLAYING` 且 `assist='bot'`） | 点棋盘/托盘/道具卡 | **取消托管并消费该次点击**（不产生玩法指令）；HUD 齿轮仍正常暂停 |
| 系统 | 录制钩子（公开命令成功后） | 录制器追加事件 |
| 系统 | 托管节拍器 | 每个 `BOT_STEP_INTERVAL_MS` 调 `decide()` + `applyBotCommand()` |
| 系统 | 回放影子时钟 | 每帧推进影子实例并注入到点事件 |

禁止：`REPLAY` 下棋盘/托盘/道具卡/相机手势**一律零响应**；不得把回放页的点击转发给影子 `BeadsGame` 以外的地方。

---

## 4. 输出与反馈

- `LEVEL_CLEAR`：新增回放入口钮（v1 最小入口 = 面板下方独立小钮，**不重排现有两钮与四段内容**；几何见 UX 规格 §3.1）。
- `REPLAY`：全屏回放页；复用玩法四带（HUD / PUZZLE / TRAY / 底部传输带），底部传输带替换道具带；只读棋盘与托盘。
- `PLAYING(assist='bot')`：HUD 显示静态「托管中」徽标（非按钮、无热区、无脉冲）；暂停面板显示「托管」开关行。
- `bot-demo` 结束：独立「演示结束条」，不是无星版 `ClearPanel`（理由见 UX 规格 §8 D6）。
- 音频：不新增 clip；回放/演示尊重现有音乐/音效设置；无关键音效时静默，不伪造新音频事件。
- 事件总线：**不新增公共事件**；状态与播放进度经 `BeadsSnapshot` / `ReplayViewModel` 只读投影。调试遥测若需要，走 debug 通道另开变更单。

---

## 5. 数值

全部引用 `systems-index §3.15`（机器人 / 回放常量组）：

- 策略：`BOT_POLICY_DEFAULT`、`BOT_MAX_MOVES`、`BOT_STEP_INTERVAL_MS`、`BOT_STUCK_LIMIT`。
- 回放：`REPLAY_MAX_EVENTS`、`REPLAY_MAX_BYTES`、`REPLAY_SPEEDS`、`REPLAY_FIXED_DT_MS`、`REPLAY_SEEK_MAX_MS`、`REPLAY_KEYFRAME_INTERVAL_MS`、`REPLAY_RETENTION`、`REPLAY_ENTRY`、`REPLAY_DEMO_SEED_SALT`。
- 口径：`BOT_DEMO_SCORING`、`BOT_ASSIST_SCORING`、`BOT_DEMO_STAMINA_COST`、`BOT_DEMO_COIN`、`REPLAY_COIN`。

不复制数值；UI 几何常量（面板/按钮/进度条）见 `ux/bot-replay-spec.md`，住 `tuning`，不进 §3。

---

## 6. 边界条件

**极端值**

- 机器人无合法动作（托盘满 + 无可直填 + 无可取回组）：演示不生成；托管自动暂停并关闭。
- `BOT_MAX_MOVES` 触顶：按「策略未收敛」处理，绝不无限循环。
- 回放时长 0（进关即退出）：不产生可回放录像（`LEVEL_CLEAR` 必然有动作）。
- 事件数为 0 但 `LEVEL_CLEAR`：理论上仅测试夹具可达；按无效录像处理，禁用回放。
- 事件/字节超限：整份作废，不部分播放（§2.3.5）。

**并发 / 竞态**

- 回放中再次进入回放：拒绝；同一时刻只允许一个 `ReplaySession`。
- 回放生成（bot-demo）与玩家开局同帧：生成在影子世界完成，不读写真实对局；若玩家离开菜单则取消生成。
- 托管的机器人节拍与玩家暂停同帧：**门禁先切 `PAUSED`**，该拍不执行（沿用 `pause-settings §2.3` 同帧裁决）。
- 托管中玩家点棋盘/托盘：该点击只用于取消托管，**不产生** `board:selected` / `tray:selected` / 取回/归位；下一拍机器人恢复（若玩家未关闭）。
- 回放 seek 与倍速切换同帧：先停时钟、提交 seek、再按新倍速恢复；不并发推进两个影子实例。
- 应用切后台：回放暂停；托管同时暂停（等同 `PAUSED`），回前台不自动恢复，需玩家继续。

**非法输入 / 非法数据**

- `levelHash` 不一致、`seed` 缺失、`fixedDtMs` 非正、`events.step` 非单调：录像判 `invalid`，禁用入口并轻提示，不崩溃。
- `step` 与 `atMs` 不一致：以 `step` 为准；若 `step` 越界，钳到 `[0, duration]` 并记一次调试告警。
- 回放页拖动进度条到负值/超过总长：钳制，不报错。
- 托管开关在 `BOOT` / `LEVEL_CLEAR` / `GAME_OVER` / `FINISH` 点击：零响应（只出现在 `PAUSED`）。
- 演示入口在机器人不支持的关卡：不生成，菜单轻提示；不进入空回放页。

**确定性**

- 同一 `levelId + levelHash + seed + events` 在任何设备、任何倍速、任何 seek 路径下，终局摘要必须一致。
- 机器人不得消费 `services.rng`；若未来策略需要随机，必须把随机结果作为事件录制，禁止实时重建随机源。

---

## 7. 依赖

**上游**

- S1 `core-loop`：状态机新增 `REPLAY`；`PLAYING` 增加 `assist` 标记；`LEVEL_CLEAR` 增加回放出口。
- S2 `input-control`：`REPLAY` 输入门禁、托管取消规则、ClearPanel 回放入口钮路由。
- S3 `bead-grid` / S4 `tray-spawner` / S6 `powerups`：提供公开命令与只读观测；回放影子实例复用同一规则。
- S5 `timer-gameover`：回放/演示不驱动真实计时；托管正常计时与失败。
- S7 `score-combo` / S8 `save-progress`：托管正常结算/写档；演示/回放零写入。
- S9 `pause-settings`：暂停面板新增托管开关行。
- S10 `meta-ui`：主菜单新增演示入口。
- `g3-lib.ts::runBot`：首版策略的行为金样本；抽取后只保留工具侧薄包装。

**下游**

- UI：`ClearPanel` 回放入口钮、全屏回放页、演示结束条、托管 HUD 徽标。
- QA：§8 判据可直接转用例。

**接口清单（工程落码前置）**

1. `BeadsGame` 公开命令：`selectBoardBead` / `retrieveSelectedGroup` / `selectTraySlot` / `tapGridCell` / `usePowerup`（既有）+ `expandTray`（回放/托管需要，需确认可从公开面调用）。
2. 只读观测：`BeadsSnapshot` 或等价的纯数据视图（格、托盘、选择锚、剩余时间、动作数）。
3. `BeadsGameOptions.replaySandbox`：影子实例关闭存档/钱包/体力/广告副作用；道具与扩容按「已授权」执行、不扣资源。
4. 录制钩子：公开命令成功后回调（命令类型 + 参数 + 当前 step）；扩容与道具同样入录。
5. 影子步进：固定步 `step(dt)` 与 `buildRenderModel` 只读；不得依赖 UI/相机。
6. 菜单/`ClearPanel` 意图：`ClearPanelAction` 新增 `'replay'`；菜单新增 `'bot-demo'` 动作。
7. 命名消歧（工程侧）：`FinishPanelAction` 的 `'replay'` 实为 restart，建议改名为 `'restart'`；不得与本系统 `ClearPanelAction='replay'` 共用语义。

**分层红线**

- `bot/**`、`replay/**` 禁止 `cc` / DOM / `wx` / `window` / `document`（L2/L3 精神，便于 Node 无头运行）。
- 禁止 `Math.random()`；只用 `createRng(seed)`（L4）。
- UI 不持有回放/机器人状态；只读 view model（L5）。
- 录制器/播放器不得写 `save-manager` / `MetaSave` / 钱包。

---

## 8. 验收标准（可测试硬判据，QA 直接造用例）

1. **金样本逐字一致（抽内核回归）**：从 `g3-lib.ts` 抽出的生产策略，在 `branchOrder='ACB'`、`reuseAnchor=false`、`retrieve='max'`、`allowDirectFill=true`、`usePowerups=false` 下，对已入库全部关卡跑出的 `pricing.actions` 与现网金样本**逐字一致**（零差异；不一致即失败）。
2. **无头确定性**：同一 `levelId + seed` 连续跑 N=3 次，机器人动作序列、终局格色、托盘、剩余时间、动作数完全一致；全仓扫描 `bot/**` 无 `Math.random`、无 `services.rng` 消费。
3. **回放终局一致**：对每份有效录像，影子重演的 `grid` 每格 `colorIdx`、托盘每槽状态/颜色、`remainingMs`（量化）、`actions` 与 `ReplayFinal` 完全一致。
4. **seek 一致性**：任取 3 个目标 step，先 seek 再播到结尾，终局与「不 seek 直接播完」逐字段一致；暂停/倍速切换不改变终局。
5. **计星/存档矩阵**：演示与回放期间，spy 断言 `save-manager` / 钱包 / 体力 / 发豆零调用；托管期间与手动局同调用、同结果。演示不扣心、不发豆。
6. **入口唯一性**：`ClearPanel` 回放入口钮只在 `LEVEL_CLEAR` 出现；`GAME_OVER` / 冲刺结算 / `FINISH` 无回放/演示入口（逐相位命中测试）。
7. **回放页零玩法输入**：在回放页对棋盘、托盘、道具位、相机手势注入点击/拖拽，`BeadsGame` 影子实例的公开命令调用数为 0；只有传输控件改变播放状态。
8. **溢出降级**：构造超过 `REPLAY_MAX_EVENTS` 或 `REPLAY_MAX_BYTES` 的录像，`truncated=true`、回放钮置灰、不播放半局、不崩溃。
9. **退出回源**：从 `LEVEL_CLEAR` 进入回放，退出后 `ClearPanel` 立即 `interactive=true`，星级/豆数不变、无二次结算；从主菜单进入演示，退出回主菜单。
10. **托管卡死与接管**：机器人无合法动作时，下一拍自动切 `PAUSED` 且 `assist='off'`，有轻提示；托管中玩家点棋盘/托盘，取消托管且该次点击零玩法事件；HUD 齿轮仍能暂停。
11. **托管结算**：托管通关后星级、豆、存档与手动通关同口径；托管失败走正常 `GAME_OVER` / 续时，不特殊处理。
12. **数据防呆**：`levelHash` 不一致、`seed` 缺失、`step` 非单调、`fixedDtMs<=0` 的录像被判 `invalid`，入口禁用且不崩溃。
13. **架构门**：`bot/**`、`replay/**` 不含 `cc`/DOM/`wx`/`window`/`document`；UI 不 import 策略实现；`check:arch`、L3 扫描、单测全绿。
14. **内存与生命周期**：应用重启后无任何回放残留（仅内存）；进入下一局后「上一局」录像被替换；bot-demo 退出即释放。
