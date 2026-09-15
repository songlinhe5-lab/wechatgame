# 系统清单与依赖索引（Systems Index）· beads

- 项目：`games/beads`（拼豆填色消除）· 版本 v1.19 · 任务号 WXG-T-007（**版本号与 `systems-index-changelog.md` 末行同步维护**；旧版此行停在 v1.12 系 WXG-T-098 核对时发现的漂移）
- 用途：定义系统边界、依赖顺序、以及**全局数值基线**（所有 GDD 引用此处的常量，避免数值漂移）
- 数值纪律：本文数值全部依 `design/concept.md` 附录 A 提案定稿；标 `[待确认]` 者未冻结、不得据以实现。

---

## 1. 系统清单

| # | 系统 | 文件 | 优先级 | 一句话职责 |
|---|---|---|---|---|
| S1 | 核心循环 | `gdd/core-loop.md` | P0 | 定义游戏状态机与关内主循环时序，串起所有系统 |
| S2 | 输入与操控 | `gdd/input-control.md` | P0 | 托盘选珠、网格落子、道具/暂停等触摸路由与热区 |
| S3 | 拼图网格与填色 | `gdd/bead-grid.md` | P0 | 图案矩阵数据、颜色匹配校验、落座/锁定格、完成判定 |
| S4 | 供料与槽位托盘 | `gdd/tray-spawner.md` | P0 | 定时供料、容量管理、扩展行、满槽告警 |
| S5 | 倒计时与失败 | `gdd/timer-gameover.md` | P0 | 关卡倒计时、告急表现、归零判负、失败续时、重试 |
| S6 | 道具系统 | `gdd/powerups.md` | P1 | 区域消除/槽位清空/随机消除三道具 + 激励视频位 |
| S7 | 计分连击与结算 | `gdd/score-combo.md` | P1 | 过关星级判定、冲刺模式连击计分（WXG-T-015）、结算面板数据、关卡解锁推进 |
| S8 | 存档与进度 | `gdd/save-progress.md` | P1 | 本地持久化：进度/星级/设置（v1.1 追加字段提案见该文） |
| S9 | 暂停与设置 | `gdd/pause-settings.md` | P1 | 暂停状态、音乐/音效开关 |

> 说明：S1 为"编排层"，S2~S9 为"被编排系统"。关卡数据（图案矩阵 JSON + TypeScript 接口，含 `BEAD_CHARSET` 校验）作为**配置来源**被 S3 读取，不单独作为系统——形态沿用 breakout 的 `LEVEL_CHARSET` + `validateLevel()` 判例。

## 2. 依赖排序（Dependency Order）

依赖 = 箭头指向的对象必须先存在。**实现顺序即此拓扑序。**

```
S1 核心循环（状态机骨架）
      │
      ├─► S3 拼图网格与填色 ◄── S2 输入与操控（选珠→落子路由）
      │        ▲
      ├─► S4 供料与槽位托盘（供料与落子共享托盘状态）
      │        │
      │        └─► S6 道具系统（三道具均作用于托盘珠）
      │
      ├─► S5 倒计时与失败（倒计时归零 → S1 切 GAME_OVER）
      │
      └─► S7 星级与结算（消费 S3 完成事件 + S5 剩余时间）
                   │
                   └─► S8 存档与进度 ◄─ S9（设置项持久化走 S8）
S9 暂停与设置（控制 S1 状态 + 写 S8）
```

**关键依赖约束**
- S2 依赖 S3 + S4：落子校验需要"托盘选中珠 × 网格空位"两侧状态。
- S4 依赖 S3：供料颜色加权依赖 S3 提供的"仍需颜色集合"。
- S6 依赖 S4：三道具效果全部作用于托盘珠（concept 附录 A6）。
- S5 依赖 S1：倒计时由 PLAYING 状态驱动，暂停即冻结。
- S7 依赖 S3 + S5：星级 = f(完成事件, 剩余时间)；解锁推进写 S8。
- S8 依赖 S7 + S9：存档内容含星级/解锁（S7）与设置（S9）。
- S9 依赖 S1 + S8：暂停是 S1 的一个状态；设置持久化走 S8。

## 3. 全局数值基线（Global Constants）· ❄️ 冻结令

> **本项目唯一真源**（Single Source of Truth）——**适用范围：游戏数值与常量**（分辨率 / 安全区 / 网格 / 托盘 / 道具 / 规则量 / 包体 / 可访问性）。任何策划、美术、工程文档引用这些常量时，**只引用常量名，不重复定义数值**；发现不一致以本节为准并回写（经主理人中转）。
> **刻意例外（不属本真源）**：**存档键名与存档数据结构归代码**（命名空间约定 `wxgame.beads.*`），沿用 breakout 判例。
> **冻结状态**：未标 `[待确认]` 的条目自本版（v1.0）起冻结；改任何数值须经主理人确认并登记 §6 变更记录。
> 单位：px（设计逻辑像素）/ 秒 / 颗 / 槽。
>
> **使用约定（强制）**：
> 1. 后续各 GDD / UX / 关卡文档一律引用本节常量名，禁止重复写死数值；确需展示数值时标注"来源：`systems-index §3`"。
> 2. 发现任何文档或代码与本节不一致 → 以本节为准，并回写对应文档（经主理人中转）。
> 3. `games/beads/art/art-bible.md` 中标 `[待 systems-index §3 对齐]` 的网格/托盘常量，**以本节 §3.3 / §3.4 为准回写**（美术圣经 §4.3 纵向占位值同时作废，以 §3.1 布局带为准）。
> 4. **「帧」的定义（时基口径，WXG-T-098 / BD-27）**：本文件与各 GDD §8 判据中出现的「1 帧 / N 帧」一律指**模拟时基的固定步长** = 框架 `GameLoop.fixedDt` 默认值 `1/60 s ≈ 16.7 ms`（`packages/framework/src/core/loop/game-loop.ts:51`）。该值属**框架实现事实，不列入本节游戏数值真源**（否则一处改值两处漂移）；框架默认步长若变更，须全域同步引用「帧」的判据。帧量化只允许出现在**时刻轴**，不允许出现在**次数轴**——现文按此口径落地的判据见 `tray-spawner.md §8-1`。

### 3.1 画布、坐标、安全区与布局带
| 常量 | 值 | 说明 |
|---|---|---|
| `DESIGN_W` | 750 | 设计分辨率宽（px），与 breakout 一致（已裁定） |
| `DESIGN_H` | 1334 | 设计分辨率高（px），竖屏 |
| `ORIENTATION` | `portrait` | 屏幕方向 |
| `FIT_MODE` | `FIXED_WIDTH` | 适配策略：宽度铺满 750 |
| 坐标原点 | 画布**左下角** | x∈[0,750]，y∈[0,1334]，**y 轴向上** |
| `SAFE_TOP_H` | 120 px | 顶部安全区，y ∈ [1214, 1334]；命名沿用 breakout 判例（`SAFE_TOP_H` 唯一正确名） |
| `CAPSULE_AVOID` | x∈[560,750]，y∈[1214,1334] | 微信右上胶囊避让区 |
| `HUD_BAND` | y∈[1214,1334] | 顶部 HUD 带：左设置齿轮、中倒计时胶囊、右胶囊避让 |
| `PUZZLE_BAND` | y∈[480,1120] | 拼图区纵向带（图案矩阵在此带内**垂直+水平居中**） |
| `TRAY_BAND` | y∈[230,420] | 底部托盘带（白色圆角面板） |
| `POWERUP_BAND` | y∈[48,200] | 道具栏带（3 张白卡） |
| 高屏适配规则 | 锚点吸收 | 高于 750:1334 的设备：拼图带贴 HUD、托盘/道具贴底、中段留白延展 |

### 3.2 色板与图案字符集
| 常量 | 值 | 说明 |
|---|---|---|
| `BEAD_PALETTE` | 10 色 | 全量色板 HEX/符号/明度见 `art/art-bible.md` §3.2（奶白…炭黑）；**本文只引用不复制** |
| `BEAD_COLOR_MAX` | 8 | 单关颜色数上限（demo 关卡实际 3–8 色） |
| `DECOY_COLORS_MAX` | 0 | 单关杂色数上限。**v1.17 冻结为 0**（U8=D · 波次2 T-086）：供料侧不再注入不参与图案的杂色，配合 A′ 不变量 `held ≤ demand`（`spawner.ts`）根治尾部软锁死；原 A3 确认值 2 作废（关卡 JSON L1–L6 `decoys` 已清空）。`DECOY_WEIGHT`（下行）因无杂色可抽而失效但保留 |
| `NEEDED_WEIGHT` | 3 | 供料时"仍需颜色"的抽取权重（A3 已确认） |
| `DECOY_WEIGHT` | 1 | 供料时杂色抽取权重（A3 已确认） |
| `BEAD_CHARSET` | `.x1-9A` | 图案行字符集：`.`=空位（**无图案位**：不可填、不计完成、渲染为空白）、`x`=锁定格（不可填、不计完成，渲染为斜纹收边，见 levels-spec §6 图例）——`.` 与 `x` 运行时语义同为 `locked`，差异仅在表现层；`1-9`+`A`=色板索引 1–10；关卡 JSON 唯一合法字符集，校验函数形态沿用 breakout `validateLevel()` 判例 |

### 3.3 珠子网格（Bead Grid）
| 常量 | 值 | 说明 |
|---|---|---|
| `BEAD_CELL` | 50 | 珠子边长（正方形 1:1） |
| `BEAD_GAP` | 2 | 格间距 |
| 网格 pitch | **52 × 52** | = BEAD_CELL + BEAD_GAP |
| `GRID_MAX_COLS` | 13 | 单关列数上限（13×52−2 = 674 ≤ 可用宽 690） |
| `GRID_MAX_ROWS` | 12 | 单关行数上限（12×52−2 = 622 ≤ PUZZLE_BAND 高 640） |
| `GRID_MIN_COLS` / `GRID_MIN_ROWS` | 6 / 5 | demo 最小图案 |
| 网格定位 | 带**内居中** | 左右留边 ≥ (750−674)/2 ≈ 38；上下在 PUZZLE_BAND 内垂直居中 |

**派生公式**（关卡实际 cols×rows 定后）
- 列中心：`colCenterX(j) = gridLeft + BEAD_CELL/2 + 52 * j`
- 行中心：`rowCenterY(i) = gridTop − BEAD_CELL/2 − 52 * i`（第 0 行在最上）
- 约束：`gridLeft ≥ 30`，`gridTop ≤ 1120`，`gridBottom ≥ 480`。

### 3.4 槽位托盘（Tray）
| 常量 | 值 | 说明 |
|---|---|---|
| `TRAY_BASE_SLOTS` | 12 | 基线容量（1 行实线槽）（A1 已确认 2026-09-11） |
| `TRAY_EXPAND_SLOTS` | 12 | 扩展容量（1 行虚线槽，激励视频解锁，**本关内有效，重开重置**）（A1 已确认：不跨关保留） |
| `TRAY_COLS` | 12 | 每行槽数 |
| `TRAY_SLOT` | 48 | 槽位边长（内凹空槽） |
| `TRAY_GAP` | 6 | 槽间距 |
| 托盘槽定位 | 带**内居中** | 12×54−6 = 642 ≤ 可用宽 690 |
| `SPAWN_INTERVAL_DEFAULT` | 4.0 s | 供料间隔默认值；关卡可覆盖，合法区间 [2.0, 6.0]（A2 已确认） |
| 供料规则 | 每 tick 生成 1 颗入**随机空闲槽** | 无空闲槽 → 跳过本次 + 满槽告警（A2 已确认） |

### 3.5 倒计时与失败
| 常量 | 值 | 说明 |
|---|---|---|
| `LEVEL_TIME_DEFAULT` | 300 s | 关卡默认倒计时（≈参考图 04:55）；关卡可覆盖，合法区间 [180, 420] |
| `TIMER_URGENT_T` | 10 s | 告急阈值：数字与图标切 `danger` 色 + 1000ms 周期脉冲（表现参数以 art-bible §6 为准） |
| `TIMER_TICK` | 1.0 s | 倒计时刷新粒度（显示用；内部按 dt 累计） |
| 失败条件 | **唯一**：倒计时归零 | 托盘满不判负（决策 D7） |
| 失败重开 | 整关重置 | 倒计时回满、图案清空、托盘清空、扩展重置、道具免费次数重置、**续时记账清零**（`reviveBonusSec=0` / `revived=false`）。**续时成功不走本行**（§3.11） |

### 3.6 道具（Powerups）
| 常量 | 值 | 说明 |
|---|---|---|
| `POWERUP_TYPES` | `['region','clearAll','random']` | 区域消除 / 槽位清空 / 随机消除（命名对齐参考图） |
| `REGION_CLEAR_SLOTS` | 6 | 区域消除：框选托盘**连续 6 槽**清空（A6 已确认 2026-09-11：三道具均仅作用托盘） |
| `RANDOM_CLEAR_COUNT` | 5 | 随机消除：随机移除托盘 5 颗（A6 已确认） |
| `POWERUP_FREE_USES` | 1 | 每关每道具免费次数；超出拉激励视频（A5 已确认 2026-09-11） |
| `AD_PLACEMENTS` | 4 | 局内激励视频位：3 道具 + 托盘扩展。**布局 A（v1.11 / WXG-T-057）**：仅 `ad_badge` 角标，本轮不拉起；唯一 live 位 = 失败页续时（§3.11） |
| 道具目标 | 仅托盘珠 | 三道具均不清除网格已填格（已填格 = 玩家进度，不可回退） |

### 3.7 星级与结算
| 常量 | 值 | 说明 |
|---|---|---|
| `STAR3_RATIO` | 0.32 | 剩余时间 / 关卡总时长 ≥ 32% → 3★（A7 已确认 2026-09-11；v1.5 曾 0.50→0.40；**v1.10 用户 2026-09-14 拍板组 C：0.40→0.32**，交叉约束见 `proposals/star-level-rebalance.md`） |
| `STAR2_RATIO` | 0.12 | ≥ 12% → 2★，否则 1★；过关即至少 1★；扩展行不扣星（A7 已确认；**v1.10 0.20→0.12**） |
| `DEMO_LEVEL_COUNT` | 8 | demo 关卡数（用户拍板 5–10 区间取 8） |
| 解锁规则 | 线性 | 通过第 n 关解锁第 n+1 关；星级只记录不做门槛 |
| 星级 remaining 口径 | `starRemaining = max(0, remaining − reviveBonusSec)`；星级与 §3.10 C7 的 `ratio` 均用 `starRemaining / 关卡总时长`；`revived` 局 `stars = min(stars, 2)` | **v1.11 冻结**（WXG-T-057 / T-B）。HUD 倒计时显示 `remaining`（含续时），不显示 `starRemaining`。未续时时 `reviveBonusSec=0`、`revived=false`，与一命局 v1.10 等价 |

### 3.8 可访问性（对齐 art-bible §3.3 与工作室 Standard 级）
| 常量 | 值 | 说明 |
|---|---|---|
| 三重编码 | 颜色+符号+明度 | 珠子识别硬要求，见 `art/art-bible.md` §3.3；S3 校验只认索引、与颜色通道解耦 |
| `TOUCH_MIN` | 88 px | **UI 控件**（按钮/道具卡/设置等）最小可点热区（≈44pt）。**棋盘/托盘珠例外**：命中区 = 名义尺寸外扩 8px（网格珠 66²、托盘珠 62²），不扩至 88——防跨格误触，相邻重叠按格心最近命中（S2 `input-control.md` §2.2 定稿，对齐 art `accessibility.md` F2） |
| 闪烁红线 | ≤3 Hz | 无超过 3Hz 的闪烁、无全屏白闪 |
| 屏震 | 不使用 | 本作气质不需要（沿用 art-bible §7） |
| 告急表达 | 图标+颜色+脉冲 | 倒计时告急不单靠颜色通道 |
| 错误反馈 | 抖动+描边闪 ≤2 次/秒 | 对齐 art-bible §3.4 `wrong` 态 |
| `EMPTY_TINT_MIX` | 0.35 | 空槽 E1 目标色底混合权重：`mixWith(slot_fill, beadColor(colorIdx), 0.35)`——目标色占 35% 混入中性槽底产柔和粉彩（可访问性 A2b 色盲冗余通道；art `assets-spec §1.2` E1，WXG-T-080 裁定，**落码归 T-085**） |
| `EMPTY_GHOST_ALPHA` | 0.20 | 空槽 E4 幽灵符号不透明度：与 L5 同矢量 path、缩至 BEAD×0.32、α0.20 → 未填态即可对照符号找匹配槽（A2b Basic 层；`assets-spec §1.2` E4，WXG-T-080） |

### 3.9 包体预算
| 常量 | 值 | 说明 |
|---|---|---|
| 主包红线 | **4096 KB** | 微信主包平台红线，**不可逾越** |
| 主包内部目标 | **2000 KB** | 团队内部目标（沿用 breakout §3.8 口径） |
| 资产策略 | 程序化绘制 | 珠子 3D 感全程序化合成（art-bible §8），无贴图字体资产；关卡数据为 JSON 文本 |

### 3.10 冲刺模式（Sprint）· 2026-09-12 用户拍板冻结（WXG-T-020）
| 常量 | 值 | 说明 |
|---|---|---|
| `SPRINT_TIME_DEFAULT` | 120 s | 冲刺单局时长；合法区间 [90, 120]，越界回退默认（C1） |
| `COMBO_WINDOW_S` | 5.0 s | 连击窗口：两次正确落子最大间隔；超窗 = 犹豫断连（C2） |
| `COMBO_STREAK_TIERS` | [2, 4, 7] | streak 阈值 → 倍率 ×2/×3/×5；倍率上限 ×5（C3） |
| `SCORE_PER_BEAD` | 10 分 | 冲刺基础落子分（乘倍率前）（C4） |
| `STAGE_BONUS_TIME` | +15 s | 梯级 stage 完成加时（C5） |
| `STAGE_CLEAR_BONUS` | 200 + 50 × stageIndex 分 | 梯级 stage 完成得分（C5） |
| 梯级公式 | 色数 min(3+⌊n/2⌋, `BEAD_COLOR_MAX`)；格数 min(30+10n, 156)；供料间隔 max(6.0−0.5n, 2.0) | n=0 起；端点对齐 §3.2/§3.3/§3.4 冻结区间（C6）。**语义澄清（v1.9）**：色数与格数为该阶**上限预算**（用于选池与校验），实际棋盘取池图案本身；供料间隔公式为精确注入值 |
| `SETTLE_SCORE` 公式 | stars×1000 + round(ratio×1000) − powerupsUsed×50 + (未用扩展 ? 200 : 0) | 普通模式结算分，局内不显示，供排行/段位（C7） |
| 裁决条款 | stage 切换**不断连**；stage 加时与单局归零同帧 **stage 优先**；stage 切换**托盘清空**（新图新供料） | C8 三条；前两条已同步 core-loop §2.3 补记，第三条为 v1.9 补记（消解 score-combo §6 → C8 悬空引用，依据见 score-combo §9 C8） |
| 伪震屏 | scale 1.00→1.015→1.00，150ms | 连击 Lv2（×3）特效；**§3.8"屏震不使用"冻结令维持不改**（U3） |

> 冲刺模式细则（连击/特效分级/事件提案 `combo:*`、`sprint:*`）见 `gdd/score-combo.md`；元游戏框架（连胜礼盒/排行/签到）见 `proposals/meta-framework.md` v1.0——M4 大厅 Won't、M5 生命体力永不采纳（2026-09-12 用户定案）。**冲刺不续时**（§3.11）。

### 3.11 失败续时（Revive）· 2026-09-14 用户拍板冻结（WXG-T-057 / T-B）
| 常量 | 值 | 说明 |
|---|---|---|
| `REVIVE_BONUS_SEC` | 60 s | 失败页激励视频看完（`onRewarded`）后写入可玩钟的秒数 |
| `REVIVE_MAX_PER_LEVEL` | 1 | 同一次尝试（进关或重试起，至下一次整关重置）成功续时上限 |
| 激励主位 | 失败页续时 | **布局 A**：唯一 live 激励位。局内 `AD_PLACEMENTS=4`（3 道具+扩展）仅 `ad_badge`，本轮不拉起 |
| 续打语义 | 不走整关重置 | 保留网格 / 托盘 / 扩展 / 道具次数 / 供料累加器；仅 S5 写 `remaining += REVIVE_BONUS_SEC` 与续时记账（`reviveBonusSec` / `revived`） |
| 冲刺 | 不续时 | 冲刺归零走冲刺结算，不进失败续时面板 |
| Won't | 体力 / 强制插屏 / 未看完发奖 | M5 永不采纳；激励须玩家主动点失败主钮；仅 `onRewarded` 加时 |

### 3.12 音频（Audio）· 2026-09-14 波次1建档（WXG-T-083 / 阮和鸣）
| 常量 | 值 | 说明 |
|---|---|---|
| `AUDIO_SFX_MIN_INTERVAL` | 0.05 s | 高频短音（`sfx_place`/`sfx_select`）per-clip 最小重触发间隔默认档；`beads-game.ts` L1484 现状值转正 |
| `AUDIO_REJECT_MIN_INTERVAL` | 0.5 s | `sfx_reject` 最小重触发间隔 = §3.8「错误反馈 ≤2 次/秒」音频侧换算；**修正现状违约**（统一 0.05s 致 reject 达 20 次/秒）。分档表见 `design/audio/audio-events.md` §3.2 |
| `AUDIO_CLIP_TOTAL` | **19** | 18 SFX + 1 BGM；**新增音效应先改 `audio-events.md §1` 再改本表**（判据 A05-24：`tuning.ts` clip 集 ≡ §1 表，双向无孤儿） |
| `AUDIO_MAX_PER_FRAME` | **6** | 单帧派发上限 = `core/audio/audio.ts` 默认值的**显式冻结**（防无声漂移）。audio-events §3.1 同帧最坏情形核算均 ≤6 ⇒ MVP 不依赖抢占 |
| `AUDIO_URGENT_BEAT_PERIOD` | **1.0 s** | 告急心跳周期，**不新造数值** = `TIMER_TICK`；与 §5 视觉 1000ms 脉冲同周期同相（A05-11） |
| `AUDIO_URGENT_MIN_INTERVAL` | 0.9 s | 派生值 = `AUDIO_URGENT_BEAT_PERIOD − 0.1 s` 余量（吸收 fixedStep 尾差，防偶发双拍）；出处 `audio-events §3.2` |
| `AUDIO_TRAYFULL_MIN_INTERVAL` | 1.0 s | **防御档**（事件本身间隔 ≥ `SPAWN_INTERVAL` 下界 2.0 s，§3.4）；音只 1 次、视觉 500ms 循环互不驱动（A05-14） |
| `AUDIO_HEARABLE_FLASH_HZ` | ≤ **3 Hz** | 听觉闪烁红线，与 §3.8 视觉闪烁红线同源同界（常量名沿用 `audio-spec §7.2` 原文，不另改名）。实发 1 Hz，A05-13 可机验 |
| 音频选型 | 程序化合成（**0 KB 主包**） | Web Audio 运行时合成 SFX + 序列化 BGM，无音频文件进产物（audio-spec §4.1 / 判据 A05-25）；采样路线破内部目标（§3.9 实测余量 32 KB）已否 |
| 总线 | Music / SFX / UI 三条 | clip id 命名空间承载；`AUDIO_BUS_GAIN_BGM/SFX/UI`=`[TODO]`（后端可听 + 真机响度校准后定档，**不冻结伪 dB**）；19 clip 事件表见 `audio-events.md §1` |
| 音色实现参数（基频/包络/波形/噪声） | **不属于 §3** | 合成参数是**工程侧对 §5 文字描述的实现选择**（同「颜色不进 §3」判例），住在 `games/beads/src/config/audio-voices.ts`；**不得据此反填伪规格值**，听感达标由 A05-26 `[P]` 与 A05-03/09/15/16 的 `[B]` 道次验收 |

## 4. 事件总线约定（供程序落码参考）

沿用 breakout 的事件命名风格 `<域>:<事件>`，payload 一律带 `levelId`：

| 事件 | 载荷（要点） | 触发方 → 消费方 |
|---|---|---|
| `tray:spawned` | `{slot, colorIdx}` | S4 → S3/S7 |
| `tray:selected` | `{slot, colorIdx}` | S2 → 视觉层（`selected` 态） |
| `bead:placed` | `{row, col, colorIdx, slot}` | S3 → S7（完成判定）、音频 |
| `bead:rejected` | `{row, col, colorIdx}` | S3 → 视觉层（`wrong` 态） |
| `tray:full` | `{}` | S4 → 视觉层（告警） |
| `tray:expanded` | `{}` | S4 → 视觉层（**消歧 2026-09-12**：效果与广播归 S4，S6 只维护只读镜像，见 S6 GDD §2.4） |
| `powerup:used` | `{type, affectedSlots}` | S6 → S4、S7（结算统计） |
| `timer:tick` | `{remaining}` | S5 → HUD |
| `timer:urgent` | `{remaining}` | S5 → 视觉/音频 |
| `level:cleared` | `{levelId, remaining, ratio, stars}` | S1 → S7、S8 |
| `level:failed` | `{levelId}` | S1 → S8 |
| `game:paused` / `game:resumed` | `{}` | S9 → S1（冻结 dt） |
| `combo:up` | `{streak, multiplier, tier}` | S7 → 视觉/音频（特效按 tier 分级，§3.10 C3） |
| `combo:break` | `{reason: 'wrong'\|'timeout'}` | S7 → 视觉/音频（角标灰缩） |
| `sprint:stage` | `{stageIndex, nextParams}` | S7 → S3/S4/S5（换 stage 参数注入，跨 stage 不断连） |
| `sprint:ended` | `{score, bestStage, settleScore}` | S7 → S8（v1.1 字段写入） |

> 上方 4 个冲刺事件为 **v1.8 机械登记**（2026-09-12）：源自 score-combo §2.5 冻结设计与 §8 判据（core-loop §2.3 已引用 `sprint:stage`），payload 为登记时定稿；实现如需增删字段须走 §6 变更。

## 5. 与框架层的接口假设

- **引擎/平台**：Cocos Creator 3.8 LTS + 微信小游戏（`adapters/cocos` + `platform/weapp`）；开发期可经 `adapters/canvas2d` + `platform/web` 做浏览器验证（沿用 breakout 验证器思路）。
- **FSM**：`core/fsm` 提供状态机；S1 六状态（BOOT/PLAYING/PAUSED/LEVEL_CLEAR/GAME_OVER/FINISH）直接映射。
- **事件**：`core/events` 事件总线承载 §4 全部事件；系统间**禁止直接互调**，一律走事件。
- **存档**：`core/save` 同步本地存储；键名归代码（`wxgame.beads.*`），结构由 S8 GDD + `save-schema` 定义。
- **激励视频**：~~假设 `platform/weapp` 暴露 `createRewardedVideoAd` 适配接口~~ → **工程确认（WXG-T-010）不存在**。**WXG-T-058 Mock 已落地**：`RewardedAdProvider` + Node/Web Mock + weapp **Noop**；失败页续时走 `GameServices.rewardedAd`（`onRewarded` 后 +60s 同局续打）。**全仓仍无 `wx.createRewardedVideoAd`**（W1 须另批）。局内 `AD_PLACEMENTS=4` 仍角标不拉起。详见 `ADR-0006` §6。
- **音频**：`core/audio` 提供 bgm/sfx 开关，供 S9 设置直连。

## 6. 变更记录

> 本节的**全部内容已拆分为 `systems-index-changelog.md`**（WXG-T-062，因本文累积超过 `ctx:check` B 项单文件 8000 估算 tokens 硬门——拆分而非豁免）。
> 引用「systems-index §6」即指该文件；**变更记录的唯一真源在那边**，本节不再复述（复述必漂移，见 WXG-T-031/T-061 教训）。
