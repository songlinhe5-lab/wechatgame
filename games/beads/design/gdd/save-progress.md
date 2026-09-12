# GDD · S8 存档与进度（Save & Progress）· beads

- 项目：`games/beads` · 版本 v1.0 · 任务号 WXG-T-015
- 数值纪律：冻结常量只引用 `systems-index §3`（§3.7 星级/关卡数、§3.5 重置）；**存档键名与数据结构归代码**（真源刻意例外，沿用 breakout 判例）——本篇定义**字段语义提案**，落码以 `game/save-schema.ts` 为准。
- 依赖锚点：`core-loop.md` §2.1 BOOT 降级边界（损坏→安全降级第 1 关，不中断启动）；`timer-gameover.md` §2.4（整关重置不入档项）；architecture-beads §2（`core/save` SaveManager：版本化、迁移、校验、**永不抛异常**；键 `wxgame.beads.save.v1`）。
- 交付形态：纯设计文档——beads 无 src/，§8 是待实现判据。

---

## 1. 目标

用一份**版本化本地存档**承载"进度 + 成绩 + 设置"三类状态：下次启动直接续进、星级与冲刺最佳分留痕、音乐音效记忆；任何损坏/越界/高版本数据都**安全降级、绝不中断启动**。

## 2. 机制

### 2.1 键与版本（代码所有权，本篇只提案语义）

- 键名：`wxgame.beads.save.v1`（architecture-beads §2 已定；**归代码**，`v1` 后缀即版本号——版本演进通过新键 + 一次性迁移实现，不改旧键）。
- 版本纪律：`version` 字段为**存档自描述**；SaveManager 加载时：`version ≤ 当前` → 逐级迁移至当前；`version > 当前`（来自更高版本 App）→ **降级处理**（见 §2.4）；校验失败/解析异常 → 降级，**零异常外泄**（core-loop §2.1 BOOT 降级边界）。

### 2.2 字段集 v1（既有冻结语义，随 WXG-T-007/009 既定设计）

| 字段 | 类型 | 语义 | 写入时机 | 降级默认 |
|---|---|---|---|---|
| `version` | number | 存档版本，恒 1 | 每次写档 | — |
| `runs` | number | 启动次数（累计，不封顶） | BOOT +1 | 0 → 首次进 L1（architecture §6 分流） |
| `unlockedLevel` | number | 已解锁最远关，∈ [1, `DEMO_LEVEL_COUNT`] | `level:cleared` 后推进（线性解锁，§3.7） | 1 |
| `stars` | number[`DEMO_LEVEL_COUNT`] | 每关历史最高星（1–3；未过=0） | 过关结算时 max(旧,新) | 全 0 |
| `settings.bgmMuted` / `settings.sfxMuted` | boolean | 音乐/音效开关（S9 直连，两个 AudioScheduler 通道） | 开关切换即写 | false / false |

### 2.3 字段集 v1.1（路线 A+ 新增，**❄️ 已冻结**：2026-09-12 用户拍板，WXG-T-020 回写；可入 `save-schema.ts`）

> 新增策略：v1.1 = v1 字段**纯追加**，全部带默认值——旧档读到 v1.1 代码无需迁移即可运行（缺省补默认）；新档写 v1.1。不破坏 §2.2。

| 字段 | 类型 | 语义 | 写入时机 | 推荐默认 | 依据 |
|---|---|---|---|---|---|
| `sprint.bestScore` | number | 冲刺模式历史最高单局分 | `sprint:ended` 时 max | 0 | S7 §2.1/§8-11 |
| `sprint.bestStage` | number | 历史最高梯位（无尽爬梯深度） | 同上 | 0 | S7 §2.3 |
| `meta.winStreakCurrent` | number | 当前连胜数（普通关连续过关；失败清零） | 过关 +1 / 失败清零 | 0 | meta-framework 提案 §2 |
| `meta.winStreakBest` | number | 历史最高连胜 | 连胜更新时 max | 0 | 同上 |
| `meta.lastPlayDate` | string(ISO date) | 最近游玩日（**签到判定的唯一依据**，按自然日） | BOOT 写入 | '' | meta-framework 提案 §4 |
| `meta.signin` | Record&lt;date, tier&gt; | 签到领取记录（键=日期） | 签到领取时 | {} | 同上 |

- **明确不入档**：道具免费次数、扩展态、托盘/网格局内态（关内态，§3.5 重置语义）；`combo` 运行时态；任何可由上表派生的值（防双真源）。

### 2.4 降级矩阵（沿用 S1 §8-10 判据，逐条落字段）

| 异常 | 处理 |
|---|---|
| 解析失败 / 非对象 / `version` 缺失 | 全档弃用 → 出厂默认（runs=0 → 进 L1） |
| `version > 1`（或未来 >1.1） | 保留可读字段、未知字段丢弃 → 按当前版本默认补齐 → **照常启动**（高版本档不锁死旧包） |
| `unlockedLevel` 越界（<1 或 >`DEMO_LEVEL_COUNT`） | 钳到 1（沿 breakout 判例"安全降级优先于报错"） |
| `stars` 长度不符 / 含非 1–3 值 | 逐项钳正：长度不符重置全 0；单值越界钳 0 |
| `settings` 缺字段 | 单字段默认 false，不弃整档 |
| v1.1 字段异常（bestScore<0 等） | 钳默认，**不影响 v1 字段加载**（字段级隔离） |

### 2.5 写入时机与频控

- **即写**：设置开关（低频，玩家可感知预期）。
- **结算写**：过关/失败/sprint 结束（每局 ≤1 次写档）。
- **BOOT 写**：runs+1、lastPlayDate。
- 同帧多次写合并为最后一次（SaveManager 幂等）；**绝不**在 PLAYING 每帧/每落子写档（性能 + 生命周期纪律）。

## 3. 输入

| 来源 | 内容 |
|---|---|
| S1 | `level:cleared` / `level:failed`（星级、解锁推进、连胜清零）；BOOT 请求读档 + 分流依据 |
| S7 | `sprint:ended`（提案事件，S7 §2.5）→ bestScore/bestStage |
| S9 | 设置开关切换 → `settings.*` 即写 |
| meta 提案层 | 签到领取 → `meta.signin`（**提案层，冻结前零实现**） |

## 4. 输出与反馈

| 输出 | 消费方 | 说明 |
|---|---|---|
| 读档快照（version 化） | S1（BOOT 分流）、S9（设置初值）、S7（NEW BEST 判定） | 只读快照，写回走 §2.5 时机 |
| `level:cleared` 星级落档 | S7 结算面板历史星显示 | max(旧,新) 语义 |
| 降级静默 | S1 | 降级**不弹错误**、不中断；如需调试日志走 logger，不出玩家可见反馈 |
| 写档回执 | 无 UI | 本地同步写（`core/save`），无进度条/无"保存中"提示 |

## 5. 数值

- 引用 §3.7：`DEMO_LEVEL_COUNT`（stars 数组长度、unlockedLevel 上界）、星级 1–3 语义、线性解锁。
- 引用 §3.5：整关重置五项**均不入档**（重置是局内态回滚，非存档回滚）。
- 引用 architecture-beads §2：键名 `wxgame.beads.save.v1`、SaveManager"永不抛异常"契约。
- v1.1 字段默认值即上表（**已冻结：2026-09-12 用户拍板**；存档字段非 §3 常量，不入 §3——键名与 schema 终稿归代码，见文首例外声明）。

## 6. 边界条件

**极端值**
- 存档超长（被外部塞入巨量字段）：加载时白名单字段裁剪，体积上限兜底，不崩溃。
- `runs` 为负 / 非整数：钳 0。
- `meta.signin` 记录跨版本日历变更：按 `lastPlayDate` 字符串比较，解析失败视为未签到（不阻塞）。
- 写档时存储满（weapp storage 配额）：SaveManager 捕获失败 → 本局内内存态继续用，下次 BOOT 重试；**不向玩家报错**（解压定位，丢失容忍 > 中断）。

**并发 / 竞态**
- 同帧过关 + 失败（不可能同时，S1 cleared 优先裁决保证）——防御上仍按"后写覆盖、字段 max 保护星级"。
- 结算写与设置写同帧：合并为一次整档写入（§2.5 幂等）。
- BOOT 读档与 runs+1 写同帧：读完成后自增写回，无脏读（同步 API，architecture §2）。

**非法输入**
- 外部篡改（debugger 改 storage）：按 §2.4 降级矩阵逐字段钳正，全档无效则出厂默认——**玩家视角永远可玩**。
- `stars` 数组含小数：向下取整后钳 [0,3]。

## 7. 依赖

- **上游**：S1（读写时机与分流）、S7（sprint 成绩与星级终值）、S9（设置）、meta 提案层（冻结后接入）。
- **下游**：S1（BOOT 分流）、S9（设置回显）、S7（NEW BEST）、未来排行（开放数据域提交，meta-framework §3——提案层）。
- **明确边界**：**键名与 schema 终稿归代码**（真源例外）；无云存档、无账号（concept §7 Won't）；不依赖网络（纯本地，与 meta 提案的"免服务器"约束同源）。

## 8. 验收标准（可测试硬判据，QA 直接造用例）

1. 首启（无存档）→ runs=1、unlockedLevel=1、进 L1；二次启动 runs=2、续进 unlockedLevel 最远关。
2. 通过第 n 关（n<8）→ unlockedLevel=n+1 落档且重启保留；stars[n-1] = max(旧, 新)，历史最高星不被低星覆盖。
3. 存档篡改矩阵逐条复现 §2.4：解析失败→出厂默认进 L1；unlockedLevel=99→钳 8、=0→钳 1；stars 长度 3→重置全 0——全部**不中断启动**（联合 core-loop §8-10）。
4. 高版本档（version=2）→ 可读字段保留、照常启动，无异常抛出（SaveManager 永不抛异常契约）。
5. v1.1 字段冻结（2026-09-12）后：旧 v1 档直接升级读取，sprint/meta 字段取默认值，v1 字段值无损；新档写 v1.1 完整字段。
6. `sprint.bestScore`：构造新分 > 旧最佳 → 写入 + S7 NEW BEST 显示；≤ → 不写（联合 S7 §8-11）。
7. 连胜：连续过关 3 次 → winStreakCurrent=3、Best=3；第 4 关失败 → Current=0、Best 仍 3（v1.1 字段已冻结 2026-09-12，判据生效）。
8. 设置开关：切换音乐/音效 → 即档、重启回显一致；两通道互不影响（双 AudioScheduler，architecture §2）。
9. PLAYING 全程（注入 200 次落子）写档次数 = 0；结算帧写档恰 1 次。
10. 整关重置后读档：五项重置（S5 §2.4）**均未**写档（关内态不入档断言）。
