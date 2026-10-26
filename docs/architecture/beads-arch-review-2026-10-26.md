# beads 现状结构图 + 架构评审与 TODO（Qoder 专项）

> - **日期**：2026-10-26　**任务**：WXG-T-420　**性质**：读码取证后的评审与拆分计划，逐项独立提交。
> - **用户拍板**：「P0 全做 + T5/T6」= 本文 TODO 的 T1–T6；后续续令「继续完成 T7～T10」。
>   **T7–T9 已收口**（拆片 / 快照分片 / 渲染绑定上移）；T10 见 §6。
> - **同域前作（不重复造结论）**：`production/plans/2026-10-26-arch-review-weapp-framework-and-beads.md`（WXG-T-401，WorkBuddy，
>   16 条 TODO + 拍板点 D1–D4）。本文是它的 **beads 专项补充**：401 已点名「beads-game 再拆 / tuning 按域拆 / spawner 死路径 /
>   视图三大件切分」，本文新增 **依赖方向门、存档→表现解耦、快照宽度实测、效果派发抽取、双源检索治理、事件投影清单**。
>   spawner 的「整删 vs 仅摘 barrel」仍是 401 的 **D3 未拍项** ⇒ 本批 T4 只做保留登记，不删不摘。
> - **规模口径**：本轮 `find/wc` 实测（beads `src` 85 个 ts / 28,274 行；`tests` 111 个 / 31,925 行；framework 63 个 / 10,813 行）。

## 1. 总体分层：同一套玩法核心，三种宿主

```
┌─ 宿主入口（同一个游戏核心，三种跑法）──────────────────────────────
│  浏览器 dev/harness      日常开发验证：canvas2d 渲染 + web 平台适配
│  Cocos BeadsBootstrap    真机/发布：cocos 适配层 + weapp 平台适配
│  Node + vitest           纯逻辑测试：无 DOM、无引擎，111 个测试文件
└───────────────────────────┬──────────────────────────────────────┘
                            │ 只依赖 Game 契约 init / update / buildRenderModel / dispose
┌───────────────────────────▼──────────────────────────────────────┐
│ packages/framework  共用框架（63 个 ts / 10,813 行）               │
│  core      游戏契约、事件总线、状态机、输入、存档、RNG、渲染指令模型 │
│  platform  web / weapp：存储、音频、激励广告、安全区、生命周期      │
│  adapters  canvas2d / cocos：渲染、输入桥、循环桥                   │
│  compose   app.ts：组装 services，再把 Game 交进去                 │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│ games/beads/src  拼豆游戏本体（85 个 ts / 28,274 行）              │
│  game/     权威状态 + 编排：BeadsShell、BeadsGame、快照、存档、元游戏│
│  systems/  纯玩法与面板几何：落子、取回、计时、道具、冲刺、消费序    │
│  entities/ 棋盘格三态、托盘槽位                                    │
│  config/   全部数值与布局真源、关卡数据、皮肤、音频配方             │
│  view/     只读快照出绘制指令：对局页、菜单页、珠子风格包、特效      │
│  ui/       导航栈、可见路由绘制、主菜单 Presenter                  │
└──────────────────────────────────────────────────────────────────┘
```

## 2. 一帧的数据流（对局内）

```
触摸 → InputManager 快照
        ▼
BeadsGame.update
  input-router ─► hud-router / panel-router / board-tap-router   （game/beads-game/ 11 个协作类）
        │              ▼
        │      systems 纯函数：placement / retrieve / timer / powerups / sprint
        │              │ 只返回结果，不持有全局状态
        │              ▼
        │      BeadsGame 写回权威状态（grid / tray / 倒计时 / 相位机）并发事件
        │              └─► 事件订阅：音频、震动、托盘颜色投影、广告回调
        ▼
_syncSnapshot()  权威状态原地拷进 BeadsSnapshot（state.ts 78–445 行，141 个字段）
        ▼
buildBeadsView()  view 只读快照 → RenderModel 绘制指令
        ▼
canvas2d / cocos 适配层真正画出来
```

**两条最值钱的不变式**（后续拆分不得破坏）：① 视图拿不到权威状态，只读快照（L5）；
② 纯玩法系统不依赖引擎/DOM，可在 Node 直接测（L2/L3）。

## 3. 构建链：源码物理拷贝进 Cocos 工程

```
games/beads/src + packages/framework/src
        │  pnpm run framework:sync（生成拷贝，禁止手改拷贝件）
        ▼
games/beads/cocos/assets/scripts/{game,framework}   ← 仓库里的第二份同名源码
        │  pnpm run build:cocos
        ▼
微信小游戏产物
```

漂移已由 `framework:sync:check`（在 `verify` 步骤表内）机械守住 ⇒ 这是**成本问题**不是正确性事故。

## 4. 组成部分与规模（实测）

| 部分 | 文件/行数 | 职责 | 最大单文件 |
|---|---|---|---|
| `game/` + `game/beads-game/` | 12 + 11 个 / 7,626 + 2,247 行 | 权威状态、相位机、输入路由、快照投影、存档、元游戏 | `beads-game.ts` ≈3,080 行、`beads-shell.ts` 1,038 行 |
| `view/` + `view/bead-styles/` | 18 + 7 个 / 7,859 + 1,209 行 | 快照 → 绘制指令 | `meta-view.ts` 1,604、`play-page.ts` 1,483、`bead-render.ts` 1,251 |
| `config/` | 11 + 3 个 / 5,496 行 | 数值、布局、关卡、皮肤、音频配方 | `tuning.ts` 3,289 行、489 个导出 |
| `systems/` | 16 个 / 2,889 行 | 纯玩法 + 面板布局/文案 | `spawner.ts` 197 行（已停用路径） |
| `entities/`、`ui/` | 2 + 4 个 / 910 行 | 棋盘与托盘数据结构、导航与菜单 Presenter | — |
| `tests/` | 111 个 / 31,925 行 | 测试行数 > 源码行数 | 渲染与存档类最厚 |

## 5. 问题清单（证据 → 影响）

1. **对局编排者仍是上帝类**：`BeadsGame` ≈3,080 行 / 121 私有字段 / ≈82 方法；已拆 11 个协作类，主类仍兼状态机、
   快照投影、事件装配、音频派发、广告体力、分享、关卡导入、冲刺 ⇒ 任何小需求都进同一文件，并行必撞。
2. **快照过宽**：`BeadsSnapshot` 367 行 / 141 字段，对局 + 面板 + 菜单 + 调试 + 特效混在一处，`createSnapshot` 157 行
   ⇒ 加一个字段动四层；「只读」守住了，「最小可见」没守住。
3. **配置大杂烩 + 全局可变**：`tuning.ts` 3,289 行 / 489 导出，玩法数值、布局、渲染质感、动画时长混在一起；
   `let liveDesignH` 为模块级可变状态 ⇒ 「配置是纯常量」的直觉不成立，多实例/并行测试有串扰面。
4. **游戏内部依赖方向三处反向，现有门禁管不到**：
   - `game/save-schema.ts` → `view/bead-styles/registry`（存档校验依赖表现层注册表）；
   - `BeadsGame.buildRenderModel` 直接调 `view/view-model.buildBeadsView`，另有多处 `game → view` 运行时导入；
   - `view/*` → `systems/*-panel` / `powerups`（布局与文案）。**这条有正当理由**（绘制与命中必须同一份几何），
     问题在「面板几何住在 systems 里」的归类，不在共享本身。
   `check:arch` 现守 L2/L3/L4/§3/§5/§20，**不管游戏内部方向、循环依赖、模块规模**。
5. **两处存量偏离无收敛期限**：`view/meta-view.ts`、`view/view-model.ts` 挂在 `UI_ARCH_EXCEPTIONS`。
6. **停用代码仍占运行时与快照**：`Spawner` 仍实例化、占快照字段（文档化死路径，401-D3 待拍）。
7. **双源拷贝的检索/误改成本**：同一文件在 `src/` 与 `cocos/assets/scripts/` 各命中一次。
8. **借事件做数据投影缺总清单**：如托盘颜色消费挂在 `bead:placed` 订阅上，正确性依赖事件顺序；
   属有意决策（architecture-beads §2 注意①），不推翻，只登记。

## 6. TODO（本批 = T1–T6；T7–T10 仅登记）

| # | 本批 | 做什么 | 验收判据 |
|---|---|---|---|
| T1 | ✅ | 游戏内部依赖方向门：允许 `view→game`（仅类型）、`game→systems/entities/config`，禁 `game/save*→view`、禁循环；存量白名单登记 | 探针反证：加一条反向 import 必红、删掉即绿；挂 `selftest:fast` |
| T2 | ✅ | 风格/皮肤「id 清单与校验」下沉 `config/`，view 只留渲染；存档层不再 import view | `grep` 零命中 `game/save*→view`；存档与换肤测试全绿；渲染金样本不变 |
| T3 | ✅ | `tuning.ts` 按域拆多文件，原入口桶再导出、调用方零改动；`liveDesignH` 归属只评估不偷改 | typecheck + 全量测试绿；对外导入路径不变；冻结数值逐字节不变 |
| T4 | ✅ | spawner 死路径**保留登记**（不删不摘 barrel，D3 仍待拍） | 文档写清保留理由与复活条件，可回查 |
| T5 | ✅ | 抽「效果派发」协作类：音频、震动、广告、分享、体力弹窗 | 行为不变：现有测试全绿；主类行数前后实测 |
| T6 | ✅ | 抽快照投影 `_syncSnapshot` → `game/beads-game/snapshot-projection.ts` | 快照逐字段对拍一致；每帧零新增分配 |
| T7 | ✅ | `meta-view` 按 overlay 拆 + 旧门面收尾，压缩豁免表 | **豁免条目减少**（2→1，余 `view-model.ts`）；金样本十态对拍一致 |
| T8 | ✅ | 快照分片（对局/面板/菜单/调试），预分配子对象 | 渲染指令逐字节一致；热路径分配不升 |
| T9 | ✅ | `buildBeadsView` 绑定上移到壳/组装层（新增 `ui/play-binding.ts`），Game 只出快照 | Node 下不加载 view 也能跑玩法测试：实探 SSR 模块图，`beads-game.ts` 入口 123 模块中 `view/` 只余登记例外 `view/palette.ts`（暖纸肤令牌直引，arch.md D1）⇒ 绘制链整片不可达；`GAME_VIEW_EXCEPTIONS` 7→3 |
| T10 | 后续 | 双源治理：检索/IDE 排除拷贝件 + 「构建期生成拷贝」ADR | 搜索不再命中禁改件；ADR 含负面后果与复评触发 |

**明确不做**：不引入新框架 / DI 容器 / 响应式库；不重写渲染层；不碰 §3 冻结数值；不为行数指标拆文件。
**测试风险**：拆分不能只靠现有金样本，须配「不依赖被测真源的不变量断言 + 正向对照」（K-042、K-152）。
