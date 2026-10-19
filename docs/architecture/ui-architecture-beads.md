# beads UI 架构（View / ViewModel / Presenter + 公共基础）

> 状态：**Proposed**（2026-10-19，待裁定 [ADR-0032](adr/ADR-0032-beads-ui-architecture.md) §5 的五个决策点）。
> **本文零代码、零常量改动**；现状证据与取舍见 ADR-0032，本文给落地设计、迁移顺序和 TODO。行号均为 2026-10-19 快照。
> 本文用到的「界面单元」= 一个页面或一个弹窗。

## 1. 目标与非目标

**目标**：① 每个界面单元独立成 View + ViewModel（+ Presenter）；② 弹窗共用一个基础（风格、遮罩、进出场、点击屏障）；③ 导航器、安全区、胶囊、调试层（性能信息与调试开关）作为全局公共部分独立处理；④ 加新弹窗只写内容区。

**非目标**：不改玩法与状态机；不动棋盘手势与相机（归 `game/beads-game/` 的棋盘相机与棋盘点击路由，是另一条输入链）；不改任何冻结常量；不迁移 breakout（但框架机制层按可复用设计）；迁移期不改变任何画面。

## 2. 总体分层

```
宿主（beads-shell / beads-game）── 权威状态：元游戏、对局、设置
        │ 只读投影（每帧，复用对象）                 ▲ 意图（继续/重玩/开选关…）
        ▼                                            │
┌─ UiRoot（组合根，beads）──────────────────────────┴───┐
│ Navigator 路由栈 │ SafeInsets │ UiTheme │ DebugLayer      │
│ 渲染：栈内可见路由自下而上 View.draw，最后画 DebugLayer │
│ 输入：栈顶 Presenter 命中 → UiIntent → UiHost（宿主）   │
└───────────────────────────────────────────────────────┘
   ▲ 框架机制层 core/ui：Navigator · ModalLifecycle · PressTracker · SafeInsets 类型
   ▲ beads 风格层 ui/kit：Theme · ScreenFrame · NavBar · ModalFrame · 控件 · DebugLayer
   ▲ 界面单元 ui/screens/*：每个 = view + view-model + presenter
```

## 3. 框架机制层（`packages/framework/src/core/ui`，引擎无关、无颜色）

| 件 | 职责 | 关键契约 |
|---|---|---|
| **Navigator** | 路由栈，基于现有 [`SceneStack`](../../packages/framework/src/core/scene/scene-stack.ts) | 路由有类型：`page`（不透明，压住下面所有）/ `modal`（透明，下面仍绘制）。`push / pop / replace / reset`；栈顶独占输入；派生「可见路由集」供渲染遍历；**不用标志位表达导航**（取代 `_screen` + `_overlay`） |
| **ModalLifecycle** | 弹窗开合状态机 | `closed → opening → open → closing → closed`，输出 0..1 进度，由 `dt` 驱动；开合时长由调用方传入（取代各面板自带的 `PANEL_IN_MS` 计时）；零分配 |
| **PressTracker** | 「按下—抬起才提交」通用化（`input-control` v2.13） | 记录按下目标；抬起时仍在同一目标内才产生「提交」；移出目标即取消；同帧按下抬起视为即时点击（WXG-T-170 口径）；全部页面与弹窗共用，不再各写 |
| **SafeInsets 类型** | 设计空间下的安全区数值对象 | 字段含上 / 下安全边距、**胶囊矩形（可为空）**、由此推出的「顶栏可用区 / 内容区 / 底部区」；由一个纯函数从 `PlatformInfo` + 视口算出，**每次设备或视口变化只算一次并缓存** |

约束：该目录守 L2（禁 `cc` / DOM / `wx`），由 `check:arch` 机械守；`PlatformInfo` 需补出胶囊**完整矩形**（现仅 `capsuleBottomDp`，见 [`weapp.ts`](../../packages/framework/src/platform/weapp.ts) 第 49–52、165–170 行；微信接口本就返回左右边界）。

## 4. beads 风格层（`games/beads/src/ui/kit`）

| 件 | 职责 | 收口掉的重复 |
|---|---|---|
| **UiTheme** | 风格令牌唯一出处：遮罩（色、α，保留「菜单档 / 对局档」两个**档名**，D3）、纸面板（圆角、投影、描边）、字体、按下位移 | 两处遮罩字面量；两个 `pressDy` |
| **ScreenFrame** | 页面基础：背景、按安全区切分的三个区（顶栏 / 内容 / 底部）、调试层挂点 | 菜单锚定几何与对局常量两套来源 |
| **NavBar** | 导航栏组件：返回键、标题、右侧槽；**自动避让胶囊**，不允许控件落进胶囊矩形 | 各处手算 `CAPSULE_AVOID` |
| **ModalFrame** | 弹窗基础：遮罩 + 纸面板 + 标题带 + 进出场（缩放与透明度随 `ModalLifecycle` 进度）+ **点击屏障**（遮罩及面板外全部吞掉，策略 `dismissOnScrim` 默认关，保持暂停面板「其余零响应」口径）+ 内容区插槽 | 四个结算 / 暂停面板各自的遮罩、面板、动画、屏障 |
| **通用控件** | `WoodButton`（合并 `drawWoodButton` 与 `drawButton`）、`PaperPanel`、`Chip`、`StarRow`、`ToggleRow`、`SelectorRow`、`ResourceBar` | 控件重复实现 |
| **DebugLayer** | 挂在**所有路由之上**：性能覆层（帧率 / 帧耗时，半透明窄面板，禁用全屏 α——保持「面板开合不丢帧样本」的测量口径）、安全区标定线；读取统一的调试开关状态。性能采样上移到 UI 根，菜单与弹窗里同样可看 | 性能覆层仅对局有；两份标定线 |
| **SettingsContent** | 设置内容块（音乐 / 音效 / 减弱动效 / 大字号 / 震动 / 珠风格 / 豆尺寸 / 皮肤 / 性能信息…），含「调试」分区；按场景（菜单 / 暂停）出变体 | 暂停面板与设置弹窗两处排版 |

## 5. 界面单元规范（View / ViewModel / Presenter）

三件契约：

- **ViewModel**：只含展示所需字段；由 Presenter 或宿主**每帧写入同一个预分配对象**，View 侧类型为只读；**不得**含可被 View 回写的权威状态。
- **View**：`(builder, viewModel, theme, insets, 进度)` → 画。纯函数，无副作用，无状态，**不得读取游戏对象**，**不得出现 `overlay ===` / `phase ===` 这类导航判断**。
- **Presenter**：① 布局（纯函数，按安全区缓存，**绘制与命中共用同一份**——现有 `pausePanelLayout` 的原则，升为强制）；② 命中（经 `PressTracker`）；③ 产出 `UiIntent` 交给宿主。允许持有的**界面本地状态**仅限：按下目标、弹窗进度、走马灯偏移与翻页动画这类纯展示状态（现在放在 shell：`_carouselOffset` 等）；⛔ 不得持有任何玩法数据。

界面清单（现落点 → 目标）：

| 单元 | 类型 | 现落点 | 主要意图 |
|---|---|---|---|
| MainMenuPage 主界面 | 页 | `meta-view.ts` 菜单绘制 + shell 菜单输入 | 开始、开选关 / 设置 / 签到、翻页 |
| PlayPage 对局页 | 页 | `buildBeadsView` 的 HUD、托盘、道具带、缩放控件 | 齿轮、道具卡、托盘槽、展开钮（棋盘手势不在内） |
| LevelSelectModal 选关 | 弹窗 | `meta-view` 的 `levels` overlay | 选关、返回 |
| SettingsModal 设置 | 弹窗 | `meta-view` 的 `settings` overlay | 各开关、选择器、在线导入、返回 |
| SigninModal 签到 | 弹窗 | `meta-view` 的 `signin` overlay | 领取、返回 |
| PauseModal 暂停 | 弹窗 | `drawPausePanel` + [`pause-panel.ts`](../../games/beads/src/systems/pause-panel.ts) | 继续、重玩、回主菜单，内嵌 `SettingsContent` |
| ClearResultModal 过关 | 弹窗 | `drawClearPanel` + `clear-panel.ts` | 下一关、冲刺 |
| FailResultModal 失败 | 弹窗 | `drawFailPanel` + `fail-panel.ts` | 复活、重试 |
| SprintSettleModal 冲刺结算 | 弹窗 | `drawSprintSettle` + `sprint-settle.ts` | 再来、返回 |
| FinishModal 全通关 | 弹窗 | `drawFinishPanel` + `finish-panel.ts` | 重玩、冲刺、回菜单 |

`systems/*-panel.ts` 里的**布局与命中纯函数就地保留、由 Presenter 调用**（避免一次性搬迁）；它们的开合动画状态类退役，改用 `ModalLifecycle`。

## 6. 运行时流程

1. **渲染**：UI 根取 Navigator 的可见路由集，自下而上逐个 `View.draw`；最后画 `DebugLayer`。遮罩由 `ModalFrame` 在对应弹窗内部画，不再各面板各画。
2. **输入**：宿主指针协议（`InputRouter`）把非棋盘区的按下 / 抬起交给 UI 根 → 栈顶 Presenter 经 `PressTracker` 命中 → 产出 `UiIntent` → 宿主 `UiHost` 接口执行（如 `applyPanelAction`、`usePowerup`）。栈顶是弹窗时，**其面板外一切点击被屏障吞掉**。
3. **相位到路由**：新增一个 `PhaseRouteBinder`，唯一负责把对局相位（`paused / level-clear / game-over / finish`）映射为 Navigator 的 push / pop，取代 shell 的 `_screen` / `_overlay` 标志位，以及 `PanelRouter` / `HudRouter` 里按相位分支的弹窗路由。
4. **边界**：对局相位状态机、结算数据、棋盘手势仍归 `BeadsGame`；UI 只通过只读投影读、通过意图写。

## 7. 目标目录

```
packages/framework/src/core/ui/        navigator · modal-lifecycle · press-tracker · safe-insets
games/beads/src/ui/
  kit/        theme · screen-frame · nav-bar · modal-frame · widgets/ · debug-layer · settings-content
  screens/    main-menu/ · play/ · level-select/ · settings/ · signin/ · pause/ · result-clear/ ·
              result-fail/ · sprint-settle/ · finish/        （每个含 view · view-model · presenter）
  ui-root · ui-host · phase-route-binder
```

## 8. 铁律映射与新增守则

| 铁律 | 落点 |
|---|---|
| L2 框架 core 无 `cc` / DOM | `core/ui` 纯机制，`check:arch` 机械守 |
| L3 `games/*/src` 无 `import 'cc'` | `ui/**` 只经 `RenderModelBuilder` 出绘制指令 |
| L5 UI 不持有游戏状态 | View / ViewModel 只读；Presenter 本地状态白名单见 §5 |
| 热路径零分配 | ViewModel 复用；布局按安全区缓存；意图复用预分配对象 |
| 数据驱动 | 颜色进 `palette.ts`，数值进 `tuning`，文案进 `copy-tokens`；遮罩只由 `UiTheme` 出 |
| L1 不手写 `.scene` / `.prefab` / `.meta` | 新文件的 `.meta` 由 Cocos 编辑器生成 |

**拟新增守则（落 `control-manifest` 新节，并加 `check:arch` 规则，见 UI-52）**：① 弹窗必经 `ModalFrame`；② 遮罩色与 α 只在 `UiTheme`；③ View 文件禁止出现导航判断与游戏对象读取；④ 绘制与命中必须共用同一布局函数；⑤ 路由变化只经 Navigator。

## 9. 迁移策略（绞杀式）

1. 先建**金样本**：对每个界面在关键状态下抓取现行 RenderModel 指令序列，作为回归门。
2. 先建框架机制层与风格层，`UiRoot` 与旧链**并行挂接**（开关，默认走旧路径），可随时回退。
3. **先弹窗后页面、先易后难**：设置 → 暂停 → 签到 → 四个结算 → 选关 → 主界面 → 对局页。
4. 每迁一个：金样本逐条对拍，**不得有无登记的差异**；旧入口 `buildBeadsView` / `buildMetaView` 保留为门面，直到最后一批才拆。
5. 有意的视觉统一（如两种遮罩合一）**不夹带**，另开 UX 裁定。

## 10. 验证口径

- 单测：`core/ui` 四件各自单测；每个 Presenter 的命中与意图单测。
- 回归：金样本对拍；全量 `pnpm run verify`；`check:arch`、`check:links`、`framework:sync:check` 全绿。
- 真机项（`[R]`，当前无法执行，须标注阻塞）：安全区与胶囊避让在刘海屏、灵动岛、安卓三键机型上的实测。

## 11. 风险与前置

| 风险 / 前置 | 应对 |
|---|---|
| **他会话在途改动**：`meta-view.ts`、`view-model.ts`、`beads-shell.ts`、`ux-spec.md` 现为未提交状态（含走马灯边界与抬起提交批） | **开工前先让这些改动落地**（UI-00）；否则迁移与它们冲突 |
| 现有测试直接依赖 `buildBeadsView` / `buildMetaView` / shell 内部访问器 | 门面保留到最后一批；测试随单元迁移逐步改指新入口 |
| 对局侧仍读冻结常量，菜单读平台实测 | 第一阶段并存（D4）；并入走 `§3` 变更单并登记漂移 |
| Cocos 镜像新增约 30 个文件，需编辑器生成 `.meta` | 集中在 UI-14 / UI-50 两个批次，提示用户开编辑器刷新 |
| 包体 | 纯 TS 增量预计很小；UI-53 实测主包体积 |

## 12. TODO 拆分

> 编号 `UI-NN` 为**本方案内部编号**（尚未在台账领号，避免撞 `WXG-T-`）。规模：S ≤ 半天，M ≈ 1 天，L ≈ 2–3 天。负责角色引自 `my-agents/`。

| 阶段 | 编号 | 任务 | 规模 | 依赖 | 验收 | 角色 |
|---|---|---|---|---|---|---|
| P0 准备 | UI-00 | 让他会话在途改动落地（用户提交或明确搁置） | S | — | 相关文件工作区干净 | 用户 |
| | UI-01 | 评审并裁定 ADR-0032 §5 的 D1–D5，ADR 状态改 Accepted | S | — | ADR 头部状态更新 | 工程负责人 |
| | UI-02 | 建金样本：每界面 × 关键状态抓取现行 RenderModel 指令序列 | M | UI-00 | 覆盖十个单元；对拍工具可重复运行 | 质量负责人 |
| P1 机制层 | UI-10 | Navigator（基于 SceneStack，页 / 弹窗类型、输入屏障、可见集） | M | UI-01 | 单测覆盖 push / pop / replace / reset 与屏障 | 工程负责人 |
| | UI-11 | ModalLifecycle（四态 + 进度，`dt` 驱动） | S | UI-01 | 单测覆盖开合与中途反转 | 工程负责人 |
| | UI-12 | PressTracker，对照 `input-control` v2.13 判据 | S | UI-01 | 单测覆盖移出取消、同帧即时点击 | 工程负责人 |
| | UI-13 | SafeInsets 类型与求值函数；`PlatformInfo` 补胶囊完整矩形（weapp / web / node） | M | UI-01 | 三适配器单测；无胶囊时为空而非 0 | 工程负责人 |
| | UI-14 | `core/ui` 导出、L2 守卫、Cocos 镜像同步 | S | UI-10…13 | `check:arch`、`framework:sync:check` 绿 | 工程负责人 |
| P2 风格层 | UI-20 | UiTheme：收拢遮罩（保留双档名）、纸面板、字体、按下位移 | M | UI-14 | 金样本中两种遮罩逐字一致 | 工程负责人 |
| | UI-21 | 通用控件（WoodButton 等），合并两套按钮绘制 | M | UI-20 | 按钮金样本对拍一致 | 工程负责人 |
| | UI-22 | ModalFrame（遮罩、面板、标题带、进出场、屏障、内容插槽） | M | UI-11, UI-20 | 屏障单测；进出场与现行逐帧一致 | 工程负责人 |
| | UI-23 | ScreenFrame + NavBar（安全区分区、胶囊避让） | M | UI-13, UI-20 | 注入胶囊矩形时控件不入矩形 | 工程负责人 |
| | UI-24 | DebugLayer（性能覆层、标定线、调试开关状态）与 SettingsContent 的调试分区；性能采样上移 | M | UI-20 | 菜单与弹窗内可见性能信息；对局金样本不变 | 工程负责人 |
| | UI-25 | UiRoot 组合根与 UiHost 接口，与旧链并行挂接（开关） | L | UI-10, UI-22…24 | 开关关闭时全仓测试与改动前一致 | 工程负责人 |
| P3 弹窗 | UI-30 | SettingsModal + 共享 SettingsContent | M | UI-25 | 金样本对拍；全部动作可达 | 工程负责人 |
| | UI-31 | PauseModal（复用 SettingsContent，动画改 ModalLifecycle） | M | UI-30 | 暂停相关现有测试全绿 | 工程负责人 |
| | UI-32 | SigninModal | S | UI-25 | 金样本对拍 | 工程负责人 |
| | UI-33 | 过关 / 失败 / 冲刺结算 / 全通关四个弹窗（共享结果骨架） | L | UI-25 | 四界面金样本对拍；意图一一对应 | 工程负责人 |
| | UI-34 | LevelSelectModal（墙格、缩略、星级） | M | UI-25 | 金样本对拍；选关意图正确 | 工程负责人 |
| P4 页面 | UI-40 | MainMenuPage；走马灯状态从 shell 迁入 Presenter | L | UI-30, UI-32, UI-34 | 金样本对拍；走马灯边界行为不变 | 工程负责人 |
| | UI-41 | PlayPage（HUD、托盘、道具带、缩放控件；棋盘手势不动） | L | UI-31, UI-33 | 对局金样本对拍；棋盘输入测试全绿 | 工程负责人 |
| | UI-42 | PhaseRouteBinder：相位 → 路由，取代 shell 标志位与 PanelRouter / HudRouter 的弹窗分支 | M | UI-40, UI-41 | `_screen` / `_overlay` 删除后全仓测试绿 | 工程负责人 |
| P5 收口 | UI-50 | 拆旧入口（门面、重复遮罩 / 按钮 / 标定线实现），Cocos 镜像同步并提示生成 `.meta` | M | UI-42 | 无重复实现残留；`framework:sync:check` 绿 | 工程负责人 |
| | UI-51 | 文档回写：`architecture-beads` §3 目录、`ux-spec` 界面到路由表、`control-manifest` 新节、`ctx/ROUTES` | S | UI-50 | `check:links`、`ctx:check` 绿 | 设计策略 + 工程负责人 |
| | UI-52 | `check:arch` 新增 §8 五条守则的机械检查 | M | UI-50 | 故意违规用例能被拦下 | 工程负责人 |
| | UI-53 | 全量 `verify` 与 harness 验收；真机安全区项登记为 `[R]` 阻塞 | M | UI-50…52 | `verify` 全绿；真机项有明确阻塞说明 | 质量负责人 |

**关键路径**：UI-00 → UI-01 → UI-10…14 → UI-20 → UI-22 / UI-25 → UI-30 → UI-31 → UI-41 → UI-42 → UI-50 → UI-53。UI-02（金样本）与 P1 可并行，但必须在 UI-30 前完成。

## 13. 待你拍板

见 [ADR-0032 §5](adr/ADR-0032-beads-ui-architecture.md)：D2（ViewModel 复用对象）、D3（遮罩保留双档名）、D4（常量并入时机）、D5（选关弹窗 / 整页）；D1 已选两层。最先要定的是 **UI-00**：他会话在途改动由谁、何时落地。
