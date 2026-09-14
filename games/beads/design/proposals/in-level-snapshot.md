# 设计提案 · 局内崩溃恢复快照（In-level Snapshot）· beads

- 项目：`games/beads` · 版本 **v0.1（全文未冻结）** · 任务号 WXG-T-055（D-03）
- 性质：**proposal**，非冻结 GDD——供后续立项；**本轮禁止改 `save-schema.ts`、禁止改 `save-progress.md` 冻结段、禁止落运行时写档**
- 裁决方向（主理人已记录）：把 S8 §2.3「局内态不入档」收窄为「**局内态不入常规档，但允许 `onHide` 崩溃恢复档**」
- 用户目标：沉浸打关、减少微信打断（切出 / 杀进程）造成的流失
- 数值纪律：不发明 §3 未冻结数值；键名与 schema 终稿归代码（systems-index 文首例外）
- 前置：D-04 已改 `BeadsGame.onResume`——回前台无论系统/手动暂停，都停在暂停面板，等「继续」

---

## 1. 问题与范围

**冲突**：`save-progress.md` §2.3 为防双真源，明确不入档「道具免费次数、扩展态、托盘/网格局内态、`combo` 运行时态」；§2.5 禁止 PLAYING 每帧/每落子写档。微信小游戏切到后台后进程可被杀，回前台等于冷启动——D-04 只能保住**仍活着的**会话，保不住杀进程。

**本提案范围**

| 做 | 不做 |
|---|---|
| 字段语义、写入时机、BOOT 恢复优先级与降级 | 改 `save-schema.ts` / 升 S8 `version` |
| 与 S8 现有字段隔离的 2 选项 + 推荐 | 实现 `SaveManager` 第二份文档 |
| 待实现判据草稿（归未来 save-progress §8，标 `[待冻结]`） | 广告 API / 激励视频发奖（T-B） |
| ADR 五节**草稿**（编号由主理人领；**不新建** `docs/architecture/adr/`） | 把局内态写进常规进度档的结算/设置路径 |

**成功标准（产品）**：玩家在 PLAYING/PAUSED 被系统杀掉后，下次启动能回到**同一局**（网格进度、托盘、倒计时、冲刺运行时态），并停在暂停面板等「继续」——与 D-04 回前台语义一致。

---

## 2. 字段语义（崩溃恢复档，非 S8 常规档）

权威状态在 `BeadsGame`（网格 / 托盘 / 计时 / 供料累加器 / 冲刺 tracker / 暂停意图）。快照是这份状态的**可序列化子集**。图案字符、关卡表、调参一律**不入快照**——BOOT 用 `levelIndex` + 现行关卡表重建，再把 filled 位图盖回去。

建议 `version: 1` 自描述；键名归代码，提案用占位 `wxgame.beads.crash.v1`（见 §5 推荐方案 A）。

| 字段 | 类型（语义） | 写入内容 | 恢复时 | 不存 / 重算 |
|---|---|---|---|---|
| `version` | number | 快照 schema，恒 1 | `≠ 1` → 丢快照 | — |
| `writtenAtMs` | number | `platform.now()` 毫秒（可选 TTL） | 过期 → 丢快照 `[待冻结]` | — |
| `mode` | `'normal' \| 'sprint'` | 当前模式 | 非法 → 丢 | — |
| `levelIndex` | number，**0-based**（对齐 `BeadsGame.levelIndex`） | 普通关；sprint 也记当时梯位所用的生成种子输入（见下） | 越界 / 关卡表对不上 → 丢 | 不存图案行字符串 |
| `pauseIntent` | `'manual' \| 'system'` | D-04 助手字段；杀进程后一律按「系统打断」展示面板即可 | 缺省当 `'system'` | 不驱动玩法 |
| **网格 filled 位图** `gridFilled` | 只覆盖**可填格**的 bit 串（行主序，`empty=0 / filled=1`） | `BeadGrid` 可填格的 `state === 'filled'` | 长度 ≠ 该关可填格数 → 丢；按位 `fill()` | `locked` / `.` void 由图案重建，禁止另存 |
| **托盘** `traySlots` | `{ colorIdx: number }[]`（`colorIdx=0` 表示 free） | 生效容量内每槽持有色；`selected` 另字段 | 长度须 ∈ {`TRAY_BASE_SLOTS`, `TRAY_BASE_SLOTS+TRAY_EXPAND_SLOTS`} | `needed[]` **重算**（图案 − filled），防双真源 |
| `trayExpanded` | boolean | 扩展行是否已解锁 | 与 `traySlots.length` 不一致 → 丢 | — |
| `traySelected` | number | `-1` 或合法槽下标 | 越界钳 `-1` | — |
| **remaining** | number（秒，连续值） | `GameTimer.remaining` | 非有限 / `<0` / `> timeTotal` → 丢 | 不存 display 字符串 |
| `timeTotal` | number | 本局/本梯 `total`（冲刺可被阶段奖励抬过初始） | 非法 → 丢 | — |
| `spawnAcc` | number | `Spawner` dt 累加器（落码须暴露 get/set；现私有 `_acc`） | 钳到 `[0, interval)` | — |
| `spawnInterval` | number | 当前心跳（冲刺阶段会改） | 普通关可与关卡表核对，不一致 → 丢；冲刺以快照为准 | decoy 列表由关卡表重算 |
| `spawnFullReported` | boolean | 满槽告警去重闩 | 缺省 `false` | — |
| **道具次数** `powerupUses` | `{ region, clearAll, random }` 各 ∈ [0, `POWERUP_FREE_USES`] | S6 三计数；**S6 未入 src 前字段可缺省，缺省 = 初值** | 越界钳初值，不丢整份快照 | 不入 S8（仍遵守「不跨关累积」） |
| **扩展态** | = `trayExpanded` | 不另开字段 | — | 与 §3.5 五项里的扩展同一事实 |
| **sprint 运行时态** `sprint` | `null`（普通）或 `{ streak, multiplier, tier, score, stageIndex, bestStage, windowRemaining }` | 仅 `mode==='sprint'` | 普通关出现非 null → 丢；冲刺缺字段 → 丢 | `sprintBestScore` **不写这里**（那是 S8 长期最佳） |

**明确永不入快照**

- S8 常规字段：`runs` / `maxUnlockedLevel` / `stars` / `settings.*` / `sprint.bestScore` / meta 签到
- 图案矩阵、色盘、调参、RNG 内部状态（恢复后供料随机序列允许分叉——见 ADR 草稿 §4.2）
- `combo` 的可派生量（multiplier/tier 可从 streak 重算；为免恢复当帧闪一下，提案仍**直存** streak + window，multiplier/tier 作冗余校验，冲突以 streak 为准）

体积上界（估算，非 §3）：`GRID_MAX_COLS × GRID_MAX_ROWS = 156` bit ≈ 20 字节位图 + 托盘最多 24 槽 + 冲刺十余个 number，整份 JSON ≪ 4 KB，远低于微信 storage 单 key 上限。

---

## 3. 写入时机（只挂 `onHide`，不破 §2.5）

`App` 现有顺序（**不要拆**）：`platform.onHide` → `game.onPause()`；`onShow` → `loop.reset()` + `game.onResume()`。D-04 之后 `onPause` 把 PLAYING 切进 PAUSED，`onResume` 状态机空操作。

**只在 `BeadsGame.onPause()` 末尾写快照**（含「已经是 PAUSED 又 onHide」——手动暂停后再切出也必须写，否则杀进程丢手动暂停局）。

| 调用时 phase | 写什么 |
|---|---|
| PLAYING（随后切 PAUSED） | 写完整局内快照 |
| 已是 PAUSED | **仍写**（覆盖上一份） |
| BOOT / LEVEL_CLEAR / GAME_OVER / FINISH | **不写**；并 **删除** 既有快照（避免用过关前的残局覆盖下次启动） |

**禁止的时机**（对齐 §2.5）

- PLAYING 每帧 / 每落子 / 供料心跳
- 结算帧（过关/失败走 S8 常规写；同时**清**崩溃档，见上表）
- `onShow` / `onResume`（回前台进程还在，D-04 面板即可）
- 设置开关即写（仍只写 S8）

同帧多次 `onHide`：最后一次覆盖；写失败（配额）→ 静默，本局内存态继续，与 S8 §6「存储满不向玩家报错」同口径。

落码挂钩提示（不本轮实现）：`onPause` 在 `_requestPause('system')` **之后**序列化——此时 phase 已是 PAUSED，倒计时已冻。手动暂停后再 hide 时 `_requestPause` 早退，序列化仍要执行。

---

## 4. BOOT 恢复优先级与降级

沿用 core-loop §2.1 / S8 §2.4：**损坏不中断启动**。崩溃档是可丢的；S8 常规档是进度真源。

```
init
  ├─ 1. 读 S8 常规档（现有 normalizeBeadsSave；失败 → 出厂默认，不中断）
  ├─ 2. 关卡表 BOOT 校验失败 → 停 BOOT 错误占位（现有；此时不消费快照）
  ├─ 3. 读崩溃档
  │     ├─ 缺失 / 解析失败 / version 不符 / 字段校验失败
  │     │     → 删除崩溃档，走现有 _boot()（进 currentLevel 的**新局** PLAYING）
  │     ├─ 校验通过
  │     │     → 按 mode 装配关卡或冲刺舞台
  │     │     → 盖 filled 位图 / 托盘 / remaining / spawnAcc / 道具次数 / sprint 态
  │     │     → 删或保留崩溃档：推荐「恢复成功后保留，直到 继续/结算/重玩 再删」
  │     │       （若恢复后、点继续前再次被杀，还能再恢复）
  │     │     → **进 PAUSED**（pauseIntent='system'），面板「继续」才回 PLAYING
  │     │       （与 D-04 回前台语义一致，避免 BOOT 当帧 dt 吃掉 remaining）
  └─ 4. runs+1、lastPlayDate 等 S8 BOOT 写照旧；**不**把崩溃档字段 merge 进 S8
```

**降级矩阵（快照专用，不影响 S8）**

| 异常 | 处理 |
|---|---|
| 非对象 / JSON 坏 / `version` 缺失或 `> 1` | 丢快照 |
| `levelIndex` 越界，或该关图案可填格数 ≠ 位图长度 | 丢快照 |
| `mode` 非法；普通关带了非空 `sprint` | 丢快照 |
| `remaining` 非有限、`< 0`、`> timeTotal` | 丢快照 |
| `traySlots` 长度与 `trayExpanded` 矛盾 | 丢快照 |
| 位图把 `locked` 格标成 filled（防御：位图只含可填格，按图案 zip，对不上就丢） | 丢快照 |
| `powerupUses` 单字段越界 | **钳**到 `[0, POWERUP_FREE_USES]`，其余字段仍恢复 |
| 读/写抛错 | 捕获，当缺失 |

玩家可见反馈：**无**。丢快照 = 静默进该关新局（或冲刺新 run）。调试可走 logger。

---

## 5. 与 S8 现有字段隔离：2 选项 + 推荐

S8 键已冻结语义为 `wxgame.beads.save.v1`（architecture-beads / `SAVE_KEY`）。控制清单 §5：「存档只存长期进度，不存对局中间态」。主理人收窄后，例外只覆盖**崩溃恢复档**，不应污染常规档。

### 方案 A — 另键（推荐）

- 新键占位：`wxgame.beads.crash.v1`（终稿归代码）
- 独立 `SaveManager`（或更瘦的 JSON 读写），`validate` 失败只 `remove` 该键
- S8 `version` / `migrations` / `normalizeBeadsSave` **零改动**即可立项（符合本轮「不落实存档 schema」）
- 微信 storage 多一个小 key；BOOT 两次 `get`；`onHide` 只写崩溃键，**不**碰 S8，§2.5 结算/设置/BOOT 写路径保持原样

### 方案 B — 同档子对象

- 在 `BeadsSave` 上追加 `inLevel?: … | null`，升 S8 version + 迁移
- 单次 `setStorageSync` 原子性略好；但 `onHide` 为写子对象必须读改写**整份**常规档，和「PLAYING 不写档」精神更近距离摩擦
- 快照损坏若走整档 `validate()` 失败，有误伤 `runs`/星级/设置的风险（必须把校验做成字段级，增加复杂度）
- 直接违反本轮「不改 save-schema」；也更难向控制清单 §5 解释

### 推荐

**方案 A**。理由：① 对齐「局内态不入**常规档**」的收窄口径；② 损坏隔离（丢局内、不中断、不动进度）；③ 不迫使 S8 升版本；④ `onHide` 写路径与 §2.5 三条合法写（即写设置 / 结算 / BOOT）物理分开。

方案 B 仅当出现「必须与 S8 同一事务提交」的证据时复评（见 ADR 草稿 §5）。目前没有：崩溃档丢了最坏是重打本关，S8 丢了才是进度事故。

落码时控制清单 §5 应加脚注（**不本轮改**）：「beads 崩溃恢复档是另键例外；常规档仍禁止局内态。」

---

## 6. 待实现判据草稿（未来归 save-progress §8）

> 以下 **不是** 现行验收。QA 不得据以开 G1 用例。主理人冻结并回写 GDD 后方可去标。编号预留为 `S8§8-11` 起（现 §8 已有 1–10）。

1. `[待冻结]` PLAYING 中 `onPause`（模拟 `onHide`）→ 崩溃键存在且 `gridFilled` / `traySlots` / `remaining` / `mode` / `levelIndex` 与内存一致；随后 200 次落子 **S8 常规键写次数仍为 0**（联合现 §8-9）。
2. `[待冻结]` PAUSED（手动齿轮）后再 `onPause` → 崩溃键被覆盖写入；`onResume` 不删不改崩溃键；点「继续」前杀进程再 BOOT → 恢复为 PAUSED，remaining 误差 ≤ 1 帧 dt。
3. `[待冻结]` BOOT 时崩溃档 JSON 损坏 / `gridFilled` 长度不符 / `levelIndex` 越界 → 启动进常规 `_boot()` 新局，S8 字段无损，无异常抛出（联合 core-loop §8-10）。
4. `[待冻结]` LEVEL_CLEAR / GAME_OVER / FINISH 路径结束时崩溃键被删除；再 BOOT 不得恢复已结束的那一局。
5. `[待冻结]` sprint 模式：恢复后 `streak` / `windowRemaining` / `stageIndex` / `score` 与 hide 前一致；PAUSED 期间窗口继续冻结（联合 S7 §8-10、S9 §8-9）。
6. `[待冻结]` 道具次数：有 S6 状态时三计数按快照恢复且不写进 S8；S6 未落地时缺省字段不导致丢快照。

---

## 7. 工程增量（落码时，非本轮）

- `Spawner` / 未来 S6 计数器暴露 get/set（热路径外；关卡加载与 hide 序列化）
- `BeadsGame.onPause` 在 intent 处理之后接写档；已 PAUSED 的 hide 不得因 `_requestPause` 早退而跳过写
- BOOT 恢复成功 → `reset('paused')`（或 `transition` 合法边：需在 `PHASE_TRANSITIONS` 增加 `boot → paused`，否则只能 `reset`）
- **禁止**改 `compose/app.ts` 的 `loop.reset()` 绑定
- 不实现 `createRewardedVideoAd`
- 测试：新文件 `games/beads/tests/in-level-snapshot.test.ts`，不把崩溃档断言塞进 S8 常规用例

环境阻塞：无真机，杀进程只能用「写快照 → 新 harness 读同一 storage」模拟；真机 `onHide` 杀进程验证标 `[Blocked: 待真机]`。

---

## 8. ADR 五节草稿（请主理人领号；勿占用 ADR-0008）

> ADR-0008 已预约给「每日挑战本地确定性派生」。0009 / 0010 已落盘。建议本决策领 **ADR-0011**。本稿不得单独落盘到 `docs/architecture/adr/`。

```
# ADR-0011 — beads 局内崩溃恢复：另键 onHide 快照，不进 S8 常规档

## 1. 上下文（Context）
微信小游戏 `onHide` 后进程可被回收；D-04 只解决「会话仍活着时回前台误解除手动暂停」。
S8 §2.3 为防双真源排除局内态；§2.5 禁止 PLAYING 热写。控制清单 §5 同样禁止对局中间态进常规档。
产品目标是减少打断流失，需要「杀进程后仍能续局」，同时不能把网格/托盘变成进度真源。

## 2. 备选方案（Alternatives）
方案 A：另键崩溃档（`wxgame.beads.crash.v1`），只在 onHide 写，BOOT 校验失败即丢。
方案 B：S8 同档子对象 `inLevel`，升 version + 迁移，onHide 读改写整档。
方案 C：不做持久化，只靠 D-04 面板（现状；杀进程必丢局）。

## 3. 决定（Decision）
选方案 A（本提案 §5 推荐）。常规档继续只存长期进度；崩溃档是可丢的 sidecar。

## 4. 后果（Consequences）
### 4.1 正面
- 损坏隔离：快照坏了只丢本局，星级/解锁/设置不受牵连。
- 不破 §2.5：onHide 不是每帧/每落子；写的不是 S8 键。
- 与 D-04 同构：恢复进 PAUSED，继续按钮仍是唯一出口。
### 4.2 负面（已知成本，不是风险）
- BOOT 两次读、多一个 storage key；微信配额紧张时崩溃档可能写失败 → 该次打断仍丢局。
- 不持久化 RNG：恢复后供料颜色序列与死前分叉，同一「续局」不可当回放。
- `needed[]` 重算 vs 托盘占用若实现漏一步会短暂不一致，必须单测锁死。
- 控制清单 §5 字面与例外并存，新成员可能把局内态写进 S8——须靠脚注 + 代码注释。
- 真机杀进程时序（onHide 是否总能写完）无法在 Node 单测证明。
### 4.3 中性 / 待观察
- 快照 TTL（例如 7 日丢弃）是否伤害「隔天回来继续」；默认建议无 TTL，靠新局覆盖。
- 第三款游戏若同样要崩溃续局，再考虑升到框架 SaveManager 的 sidecar 约定。

## 5. 复评触发条件（Review Triggers）
- 微信基础库变更导致 onHide 不再保证同步 storage 写完。
- 出现必须与 S8 同一事务提交的证据（方案 B）。
- 快照体积或校验失败率在真机上不可接受。
- 每日挑战（ADR-0008）若要求「进行中的每日局」跨天续打，与 `writtenAtMs` / 日期键冲突时复评。
```

---

## 9. 变更记录

| 版本 | 日期 | 变更 | 依据 |
|---|---|---|---|
| v0.1 | 2026-09-14 | 初稿：字段语义、仅 onHide 写、BOOT 降级、另键 vs 同档子对象、6 条 `[待冻结]` 判据、ADR-0011 五节草稿 | WXG-T-055 D-03；主理人收窄 §2.3 |
