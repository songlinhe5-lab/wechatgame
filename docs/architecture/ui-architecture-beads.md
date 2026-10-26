# beads UI 架构（View / ViewModel / Presenter + 公共基础）

> 状态：**Accepted**（2026-10-20，[ADR-0032](adr/ADR-0032-beads-ui-architecture.md) §5 的 D1–D5 已裁定）。
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
| **NavBar** | 导航栏组件：标题、右侧槽，**返回键可选**（选关页只用标题，返回由底部 `back` 提供）；**自动避让胶囊**，不允许控件落进胶囊矩形 | 各处手算 `CAPSULE_AVOID` |
| **ModalFrame** | 弹窗基础：遮罩 + 纸面板 + 标题带 + 进出场（缩放与透明度随 `ModalLifecycle` 进度）+ **点击屏障**（遮罩及面板外全部吞掉，策略 `dismissOnScrim` 默认关，保持暂停面板「其余零响应」口径）+ 内容区插槽 | 四个结算 / 暂停面板各自的遮罩、面板、动画、屏障 |
| **通用控件** | `WoodButton`（合并 `drawWoodButton` 与 `drawButton`）、`PaperPanel`、`Chip`、`StarRow`、`ToggleRow`、`SelectorRow`、`ResourceBar` | 控件重复实现 |
| **DebugLayer** | 挂在**所有路由之上**：性能覆层（帧率 / 帧耗时，半透明窄面板，禁用全屏 α——保持「面板开合不丢帧样本」的测量口径）、安全区标定线；读取统一的调试开关状态。性能采样上移到 UI 根，菜单与弹窗里同样可看 | 性能覆层仅对局有；两份标定线 |
| **SettingsContent** | 设置内容块（音乐 / 音效 / 减弱动效 / 大字号 / 震动 / 珠风格 / 豆尺寸 / 皮肤 / 性能信息…），含「调试」分区；按场景（菜单 / 暂停）出变体 | 暂停面板与设置弹窗两处排版 |

## 5. 界面单元规范（View / ViewModel / Presenter）

三件契约：

- **ViewModel**：只含展示所需字段；View 侧类型为只读；**不得**含可被 View 回写的权威状态。按变化频率分两级（D2）：**持续型**（对局页、主界面、选关页、设置、暂停：数据每帧都可能变）由 Presenter 或宿主**每帧写入同一个预分配对象**，复用逻辑由公共基础提供；**快照型**（过关、失败、冲刺结算、全通关：打开时数据即定）**打开时新建一次、之后只读**，每帧不分配，也不套复用机制。
- **View**：`(builder, viewModel, theme, insets, 进度)` → 画。纯函数，无副作用，无状态，**不得读取游戏对象**，**不得出现 `overlay ===` / `phase ===` 这类导航判断**。
- **Presenter**：① 布局（纯函数，按安全区缓存，**绘制与命中共用同一份**——现有 `pausePanelLayout` 的原则，升为强制）；② 命中（经 `PressTracker`）；③ 产出 `UiIntent` 交给宿主。允许持有的**界面本地状态**仅限：按下目标、弹窗进度、走马灯偏移与翻页动画这类纯展示状态（现在放在 shell：`_carouselOffset` 等）；⛔ 不得持有任何玩法数据。

界面清单（现落点 → 目标）：

| 单元 | 类型 | 现落点 | 主要意图 |
|---|---|---|---|
| MainMenuPage 主界面 | 页 | `meta-view.ts` 菜单绘制 + shell 菜单输入 | 开始、开选关页 / 设置 / 签到、翻页 |
| PlayPage 对局页 | 页 | `buildBeadsView` 的 HUD、托盘、道具带、缩放控件 | 齿轮、道具卡、托盘槽、展开钮（棋盘手势不在内） |
| LevelSelectPage 选关（D5：整页，版式见 [确认单](../../games/beads/design/ux/level-select-page-layout.md)） | 页 | `meta-view` 的 `levels` overlay | 选关、返回（底部 `back`） |
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
3. **相位到路由**：新增一个 `PhaseRouteBinder`，唯一负责把对局相位（`paused / level-clear / game-over / finish`）映射为 Navigator 的 push / pop，取代 shell 的 `_screen` / `_overlay` 标志位，以及 `PanelRouter` / `HudRouter` 里按相位分支的弹窗路由。（[WXG-T-316 / UI-42] 壳标志位已退役；对局相位弹窗仍是 `PanelRouter` 的**点击分派**（不持导航状态），搬上路由要先让面板 View 注册 = 后续单（UI-50 只收口了绘制入口，面板 View 尚未注册））
4. **边界**：对局相位状态机、结算数据、棋盘手势仍归 `BeadsGame`；UI 只通过只读投影读、通过意图写。

## 7. 目标目录

```
packages/framework/src/core/ui/        navigator · modal-lifecycle · press-tracker · safe-insets
games/beads/src/ui/
  kit/        theme · screen-frame · nav-bar · modal-frame · widgets/ · debug-layer · settings-content
  screens/    main-menu/ · play/ · level-select/（页） · settings/ · signin/ · pause/ · result-clear/ ·
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
3. **先弹窗后页面、先易后难**：设置 → 暂停 → 签到 → 四个结算 → 选关页 → 主界面 → 对局页。
4. 每迁一个：金样本逐条对拍，**不得有无登记的差异**；旧入口 `buildBeadsView` / `buildMetaView` 保留为门面，直到最后一批才拆。
5. 有意的视觉统一（如两种遮罩合一）**不夹带**，另开 UX 裁定。

## 10. 验证口径

- 单测：`core/ui` 四件各自单测；每个 Presenter 的命中与意图单测。
- 回归：金样本对拍；全量 `pnpm run verify`；`check:arch`、`check:links`、`framework:sync:check` 全绿。
- 真机项（`[R]`，当前无法执行，须标注阻塞）：安全区与胶囊避让在刘海屏、灵动岛、安卓三键机型上的实测。

## 11. 风险与前置

| 风险 / 前置 | 应对 |
|---|---|
| ~~他会话在途改动~~（`meta-view.ts`、`view-model.ts`、`beads-shell.ts`、`ux-spec.md`）| **已解除（UI-00，2026-10-20）**：随提交 `bd964a0` 入库，四文件工作区干净；HEAD 实测 `tsc` 退出 0、测试 1046 通过、Cocos 镜像一致。注意该提交是混合提交（见 UI-00 备注），金样本（UI-02）以它为基线 |
| 现有测试直接依赖 `buildBeadsView` / `buildMetaView` / shell 内部访问器 | 门面保留到最后一批；测试随单元迁移逐步改指新入口 |
| 对局侧仍读冻结常量，菜单读平台实测 | 第一阶段并存（D4）；并入走 `§3` 变更单并登记漂移 |
| Cocos 镜像新增约 30 个文件，需编辑器生成 `.meta` | 集中在 UI-14 / UI-50 两个批次，提示用户开编辑器刷新 |
| 包体 | 纯 TS 增量很小；实测 3201.0 KB（余 895 KB） |

## 12. TODO 拆分

> 编号 `UI-NN` 为**本方案内部编号**（尚未在台账领号，避免撞 `WXG-T-`）。规模：S ≤ 半天，M ≈ 1 天，L ≈ 2–3 天。负责角色引自 `my-agents/`。

| 阶段 | 编号 | 任务 | 规模 | 依赖 | 验收 | 角色 |
|---|---|---|---|---|---|---|
| P0 准备 | UI-00 ✅ | 让他会话在途改动落地。**已完成（2026-10-20 核实）**：四文件已随 `bd964a0` 入库、工作区干净 | S | — | 相关文件工作区干净 ✔ | 用户 |
| | UI-01 ✅ | 评审并裁定 ADR-0032 §5 的 D1–D5，ADR 状态改 Accepted（2026-10-20 已 Accepted） | S | — | ADR 头部状态更新 | 工程负责人 |
| | UI-02 ✅ | 建金样本：每界面 × 关键状态抓取现行 RenderModel 指令序列（2026-10-20 随 WXG-T-298 落：`tests/ui-golden-{scenes,capture,test}.ts` + 十态封箱夹具；复取可重复、只读对拍进全量） | M | UI-00 | 覆盖十个单元；对拍工具可重复运行 | 质量负责人 |
| P1 机制层 | UI-10 ✅ | Navigator（基于 SceneStack，页 / 弹窗类型、输入屏障、可见集） | M | UI-01 | 单测覆盖 push / pop / replace / reset 与屏障 | 工程负责人 |
| | UI-11 ✅ | ModalLifecycle（四态 + 进度，`dt` 驱动） | S | UI-01 | 单测覆盖开合与中途反转 | 工程负责人 |
| | UI-12 ✅ | PressTracker，对照 `input-control` v2.13 判据 | S | UI-01 | 单测覆盖移出取消、同帧即时点击 | 工程负责人 |
| | UI-13 ✅ | SafeInsets 类型与求值函数；`PlatformInfo` 补胶囊完整矩形（weapp / web / node） | M | UI-01 | 三适配器单测；无胶囊时为空而非 0 | 工程负责人 |
| | UI-14 ✅ | `core/ui` 导出、L2 守卫、Cocos 镜像同步（UI-10…13 已随 WXG-T-296 / 297 全量闭环） | S | UI-10…13 | `check:arch`、`framework:sync:check` 绿 | 工程负责人 |
| P2 风格层 | UI-20 ✅ | UiTheme：收拢遮罩（保留双档名）、纸面板、字体、按下位移（`src/view/ui-theme.ts`；WXG-T-299，十态 sha 零差异） | M | UI-14 | 金样本中两种遮罩逐字一致 | 工程负责人 |
| | UI-21 ✅ | 通用控件（WoodButton 等），合并两套按钮绘制（2026-10-20 随 WXG-T-301 落：`view/ui-widgets.ts` 单入口四族 wood / accent / ghost / paper；金样本十态零差异 + 6 例分支单测） | M | UI-20 | 按钮金样本对拍一致 | 工程负责人 |
| | UI-22 ✅ | ModalFrame（遮罩、面板、标题带、进出场、屏障、内容插槽） | M | UI-11, UI-20 | 屏障单测；进出场与现行逐帧一致（2026-10-20 随 WXG-T-300 落：`view/modal-frame.ts` + 7 例；旧算式逐帧位级 oracle + 金样本十态零差异） | 工程负责人 |
| | UI-23 ✅ | ScreenFrame + NavBar（安全区分区、胶囊避让）（2026-10-20 随 WXG-T-302 落：`view/ui-frame.ts` 纯布局；胶囊左/右/横跨三态避让 + 8 例注入胶囊矩形单测；迁移期不接线、画面零改） | M | UI-13, UI-20 | 注入胶囊矩形时控件不入矩形 | 工程负责人 |
| | UI-24 ✅ | DebugLayer（性能覆层、标定线、调试开关状态）与 SettingsContent 的调试分区；性能采样上移（2026-10-20 随 WXG-T-303 落：`view/debug-layer.ts`；覆层挂 shell 两腿末尾、标定线搬入同源、菜单腿补采样；菜单帧开 debug 即出现 fps、金样本十态零差异。⚠ 「SettingsContent 调试分区」留 UI-30） | M | UI-20 | 菜单与弹窗内可见性能信息；对局金样本不变 | 工程负责人 |
| | UI-25 ✅ | UiRoot 组合根与 UiHost 接口，与旧链并行挂接（开关）（2026-10-20 随 WXG-T-304 落：`src/ui/ui-root.ts` + `ui-host.ts`；Navigator 可见集自下而上 + DebugLayer 最后；`debugState` 文案单源；开关默认关 ⇒ 旧链逐字不变、金样本 11 例零差异、beads 1091 绿） | L | UI-10, UI-22…24 | 开关关闭时全仓测试与改动前一致 | 工程负责人 |
| P3 弹窗 / 选关页 | UI-30 ✅ | SettingsModal + 共享 SettingsContent（过程明细见 `## WXG-T-305`；**视觉变更登记（2026-10-21 随 WXG-T-339 · K-051/K-053/ADR-0032 DEC-6）**：清零「标题压首行」（WXG-T-334 真机报，修前标题中心落进首行钮带、叠 28）——标题基线 −70→**−50** + 栅格 topY −150→**−170** + 行距 16→**12** ⇒ 标题对首行 / 行间 / 末行对返回钮三处净空各 12；金样本 `settings`/`signin` 两态重抓（sha `24b06b96…`→`d8b5c527…` / `a84f5b4c…`→`2a46500d…`），其余九态 sha 逐字未变；新增净空帧守卫 + 变异自证 1 例；过程明细见 `## WXG-T-339`） | M | UI-25 | 金样本对拍；全部动作可达 | 工程负责人 |
| | UI-31 ✅ | PauseModal（复用 SettingsContent，动画改 ModalLifecycle）（2026-10-20 随 WXG-T-306 落：`systems/pause-panel.ts` 自持动画时钟退役、改由框架 `ModalLifecycle` 驱动（入场合可点 / 关合零响应 / `reset()` 硬收，时长仍由本模块传入）；设置钮绘制收口 `view/settings-content.ts::drawPauseSettingButton`（chip / 纸钮 / 小字档 / 文案单源），非设置钮就地保留；布局与命中纯函数按 §8 就地未动。✅ 暂停 14 例 + 金样本 11 例零差异 + 新增 4 例 | M | UI-30 | 暂停相关现有测试全绿 | 工程负责人 |
| | UI-32 ✅ | SigninModal（2026-10-20 随 WXG-T-308 落：新建 `view/signin-content.ts` —— 标题「七日签到」/ 7 格 4+3 版式 / 已领·今日·未领三态绘制三件单源；`meta-view` 的 signin 分支改派发，领取/返回与弹窗 chrome 就地未动。⚠ 底板未并入 `ModalFrame`（素面 rect 与纸面板不同形，§9-5 不夹带）、无开合时钟（入口退役 Q5①）⇒ 均待视觉裁定 / 入口恢复；✅ 金样本 signin 态零差异 + 新增 5 例 | S | UI-25 | 金样本对拍 | 工程负责人 |
| | UI-33 ✅ | 过关 / 失败 / 冲刺结算 / 全通关四个弹窗（共享结果骨架）（2026-10-20 随 WXG-T-307 落：新建 `systems/result-panel.ts::ResultPanelClock` —— 开合改框架 `ModalLifecycle`，`popsShown` / `popScale` 把「星级逐颗」与「通关逐关」同一公式收为一份（步长由调用方传）；`ClearPanel` / `SprintSettlePanel` / `FinishPanel` 自持时钟与重复公式退役、改为委托，布局 / 命中 / 文案按 §8 就地未动；失败面板由相位直接驱动、本无开合时钟。✅ 四界面金样本 11 例零差异 + 三套面板测试全绿 + 新增 5 例 | L | UI-25 | 四界面金样本对拍；意图一一对应 | 工程负责人 |
| | UI-34a ✅ | 选关整页前置：美术规格回写（版式 P 的格 / 间距 / 网格范围，正本 `menu-wall-signage-spec`）；核对格轮廓对比度、缩略图放大后清晰度；主规格回写（含「注 B」订正）（2026-10-20 随 WXG-T-310 落：美术规格新增 **§3.9**（版面表 + 三项结论）+ §7.3 两条真机项；主规格升 **v1.6**（§3 旧 600×720 线框 → 版式 P 表 / §2 栈深度整页化 / §4 注 B 订正为抬起提交 / §5 页面淡入淡出 / §7 触控 170）；确认单升 **v0.2**（§4.1 六条清零）；分片 §11 追加 v1.6 叙事。三项核对：对比度 slot/bg **1.131**、slotBorder/bg **1.185**（纸面板在时 1.050/1.406）⇒ **接受不改描边**，回退杠杆 `palette.locked` 1.651；缩略 84→134 对 256² 源为下采样（仅 >1433 物理宽上采样 ⇒ `[待真机]`）；星带 28 / 顶内缩 8 **不放大**、增量全给缩略。⚠ 本批零代码（落码 = WXG-T-311）） | M | UI-01 | ✅ 确认单 §4 第 1–6 条清零 | 美术指导 + 设计策略 |
| | UI-34 ✅ | LevelSelectPage 整页（ScreenFrame + 仅标题 NavBar，从主界面 push 页面路由，无遮罩；**页专用常量，不改 `WALL_CELL`**）。⚠ 版式由弹窗板改整页，**不是零漂移**，验收版式 = [确认单](../../games/beads/design/ux/level-select-page-layout.md) §2（版式 P）（过程明细见 `## WXG-T-311`；转场见 WXG-T-314；**视觉变更登记（2026-10-21 随 WXG-T-340 · K-051/K-053/ADR-0032 DEC-6）**：空带 [822,1122] 新增页头大关名（`levels-spec §11.4` R1/R2：shell 塞 `ARCS[页].title`、R2 无值不建节点；带内 y/字号归 art 批 `[TODO]`，本批取带中心 + 页头同档字 `overlayTitle`）⇒ 金样本 `level-select`/`level-select-mid` 两态重抓（sha/total 变），其余九态逐字未变；过程明细见 `## WXG-T-340`） | M | UI-23, UI-25, UI-34a | 版式与确认单一致；选关意图正确；底部 `back` 回主界面；抬起才提交且同钮 | 工程负责人 |
| P4 页面 | UI-40 ✅ | MainMenuPage；走马灯状态从 shell 迁入 Presenter（2026-10-20 随 WXG-T-315 落：新建 `src/ui/main-menu-presenter.ts::MainMenuPresenter` —— 页位 / 拖动位移 / 透明度进度 / 页数 + 玻璃手势 + 吸附动画全部收口；壳删 10 字段 7 方法，松手结果 `open`/`page`/`none` 由 Presenter 判定，`overlay` / `meta:overlay` / 200ms 转场副作用仍归壳；绘制路径逐字未改 ⇒ 金样本十态 sha 零漂移、夹具未重抓；新增 6 例边界单测；beads 96 文件 1129。⚠ UiRoot 路由注册与开关翻转移交 UI-42） | L | UI-30, UI-32, UI-34 | ✅ 金样本对拍零漂移；走马灯边界行为 6 例全绿 | 工程负责人 |
| | UI-41 ✅ | PlayPage（HUD、托盘、道具带、缩放控件；棋盘手势不动）（2026-10-20 随 WXG-T-309 落：新建 `view/play-page.ts::drawPlayPage`，旧门面 `buildBeadsView` 保留为唯一入口（2156 → 656 行）；星弧原语 / 虚线矩形 / 字号 / mm:ss 上移单源。⚠ 单文件 1467 行 =「先搬后拆」中间态；Presenter/UiRoot 路由未接线、手势与命中未动 ⇒ 归 UI-50。✅ 对局金样本 11 例零差异 + 新增 3 例（过程明细见 `## WXG-T-309`） | L | UI-31, UI-33 | 对局金样本对拍；棋盘输入测试全绿 | 工程负责人 |
| | UI-42 ✅ | PhaseRouteBinder：相位 → 路由，取代 shell 标志位与 PanelRouter / HudRouter 的弹窗分支（2026-10-20 随 WXG-T-316 落：新建 `src/ui/phase-route-binder.ts` —— 栈底恒一个基础页（`menu` / `play`），`levels` 为页路由、`signin` / `settings` 为弹窗路由，`screen` / `overlay` 全由栈投影（DEC-3）；壳删 `_screen` / `_overlay` / `_overlayArc` 三标志位，与 `UiRoot` 共用同一 `Navigator`。⚠ 当时 `UI_ROOT_ENABLED` 仍默认关、对局相位弹窗仍归 `PanelRouter`（点击分派非导航状态）⇒ 拆旧链归 UI-50。✅ +6 例；金样本十态 sha 零漂移（过程明细见 `## WXG-T-316`） | M | UI-40, UI-41 | ✅ `_screen` / `_overlay` 已删除，全仓测试绿 | 工程负责人 |
| P5 收口 | UI-50 ✅ | 拆旧入口，Cocos 镜像同步并提示生成 `.meta`（过程明细见 `## WXG-T-317`；⚠ 逐单元路由绘制（弹窗下画菜单）需 UX 裁定 ⇒ 用户 2026-10-20 真机裁定「主界面设置页面，没有半透」后曾随 WXG-T-324 改为「先画底页再压遮罩」，**但真机再报「层级错乱」⇒ WXG-T-325 已回退**（金样本 settings / signin 复取回 25 / 28，sha 与 322/323 批逐字全等）；重开为 **UI-60 容器层**（见下行 + ADR-0033） | M | UI-42 | ✅ 唯一绘制入口 + 唯一调试数据出口；`framework:sync:check` 绿 | 工程负责人 |
| | UI-51 ✅ | 文档回写（WXG-T-318）：目录 / 路由表 / `control-manifest §20` / ROUTES 四处已落 | S | UI-50 | ✅ `check:links`、`ctx:check` 绿 | 设计策略 + 工程负责人 |
| | UI-52 ✅ | 机械守（WXG-T-319）：`check:arch` §20 五条 + 11 例负样本入 `selftest:fast` | M | UI-50 | ✅ 负样本全咬 | 工程负责人 |
| | UI-53 ✅ | 全量 `verify` 与 harness 验收；真机安全区项登记为 `[R]` 阻塞 | M | UI-50…52 | ✅ 2026-10-20（WXG-T-320）：`verify` PASS 22 + harness 双游 + 主包 3201.0 KB；`[R]` 见 `qa/beads/test-cases-m-gate.md §O` | 质量负责人 |
| | UI-61 ✅ | 结算面板「发豆行」（星级正下方 `rewardY = starsY + 56`，`PANEL_SIZE` 零改动）：`+N 🪙 · <原因>`——**原因整句由 `MetaState.grantClearCoins` 产出**（首通按星 / 复刷「今日 x/45」/「已达上限仅发安慰奖」），⛔ 面板侧不拼文案（WXG-T-398，2026-10-26 用户令「把获得奖励的原因说清楚，否则不清楚为什么多为什么少」） | M | UI-02 | 金样本 clear 态 **+1 条 text（619→620）** 已按 K-051/K-053 登记；夹具用 `ui-golden-capture.ts` 在提交锚重抓，⛔ 未手改 | 工程负责人 |
| P6 容器层 | UI-60 ◐（**P0 已落 WXG-T-327**：容器/段语法 + 两端映射 + DEC-5 sibling 定序 + `lastScopeCount`；**P1 可证部分已落 WXG-T-328**：引擎无关层树内核（懒建 / 容器出现序 / **段枚举序** / 段挂容器之下，9 例 + 三处定向变异全咬红），framework 500 绿；⚠ 仍未接：cc 薄壳 + 视图发命令 + 真机读数 ⇒ 层级缺陷未消）| **UI 容器层：容器内层有序 + 事件逆序**（用户 2026-10-20 裁定「每页面・每弹窗各是一个 UI 容器，按层级绘制、事件按层级透传；层级是顺序关系，不能错乱」）。方案正本 = [`ADR-0033`](adr/ADR-0033-ui-container-layer-ordering.md) DEC-1…9；根因 = Cocos 写死五段通道压掉指令相对序，canvas2d 为 immediate mode ⇒ Node 全绿真机错乱（K-030 同族） | L（P0 容器语法+两端层树 → P1 弹窗内容入容器 → P2 输入逆序 → P3 机械守+金样本重抓）。**Q1–Q3 已裁（2026-10-20）**：四批确认；段粒度含 `hud`/`toast` ⇒ 层树=容器×段×通道（scope 数 **P0 须实测**）；P1 前维持「没半透」止血观感 | UI-50；**硬前置**：他会话 UI 迁移 WIP 入库 | 解开 `dialog-center.test.ts` 中 skip 的层序例；新增机检「容器 A 命令全部早于容器 B，且遮罩先于本容器面板」；真机层序读数入 `qa/beads/device-walkthrough.md` | 工程负责人 |

**视觉变更登记（2026-10-22 · K-051 / K-053 / ADR-0032 DEC-6）**：**主菜单签到入口回归**（用户三点拍板：① `canClaim` 时信封右上画 1 枚小圆点 = 全局唯一提示位；② 已领当日仍可打开看进度；③ 不做开合动画、零新毫秒值）。改动 = 顶栏公告/信箱从「两颗均禁用空圆」收为「公告仍禁用、信箱实装」+ `open-signin` 热区注册 + 小圆点（`MENU_SIGNIN_DOT_R`，色读既有 `danger`）；旧 Q5①「签到入口退役」口径作废。**金样本影响**：`main-menu` / `level-select-mid` 两态各 **+1 命令**（小圆点），须由 `tests/ui-golden-capture.ts` 在可复现锚重抓，⛔ 不手改夹具。

**视觉变更登记（2026-10-22 · WXG-T-351 · §3.6 v1.80 豆子出口）**：① **道具卡角标**——免费次数内仍画白 ▶，用尽后改画**豆子价数字**（20/30/45，`UI_FONT.cell` 22 · `POWERUP_BADGE_GLYPH`）；免费分支表达式**逐字节不变** ⇒ 十态金样本与封箱 sha **零漂移**（实测 `ui-golden` / `bead-style-seal` 全绿）。② **新增模态**：道具购买确认弹窗（`systems/buy-confirm-panel.ts`，560×300 + 2×240×88，**静态无动画**），仅弹窗开启帧可见 ⇒ 同样不进既有十态。③ 文案 3 键经 `tokens.md §7` 新增并标 `[待 art 确认]`。

**视觉变更登记（2026-10-23 · WXG-T-351 续 · 心日限可见）**：菜单 L4 资源条**心端文案**在「未满心」时由 `n/n` 改为 `n/n ▶N`（N = 今日剩余广告加心次数，`HEART_AD_DAILY_LIMIT=5` 的余量；`▶0` = 今日额度用尽），**满心时不追加**（此时广告不可用，印次数会误导）；未接线（`heartAdsLeft` 缺省）退回旧文案。仍是每端 1 条 text ⇒ 命令数不变，**十态金样本与封箱 sha 零漂移**（默认态恒满心）。
⚠ 设计侧回写待办：`art/proposals/ui-style-redesign/menu-architecture.md §5.1b-2`（资源条「数值合为一条 text」那行）尚未记 `▶N` 后缀，归 art 批补。

**视觉变更登记（2026-10-23 · WXG-T-355 · UI-33 过关面板）**：**结算·过关面板增「判星对照」行**（用户 2026-10-22 选「把三档时钟做到玩家看得见」，2026-10-23 就形态裁 **甲 = 只补结算面板一行**；上位正本 = `ux-spec §3.4` v1.23）。改动 = `systems/clear-panel.ts` 新增 `criteriaY`（= `infoY + 41`）且**星级行中心由 `infoY + 70` 抬到 `infoY + 92`**（旧带净空 ~32 设计像素，容不下 art-bible 最小字号 28 的一行）+ `view/view-model.ts::drawClearPanel` 绘一行 `text_dim` 28px；**缎带 / 按钮 / 面板底板几何零改动**（`PANEL_SIZE` 560×480 不动，内容顶缘由 360 升到 382）。数据腿**零新快照字段**：门槛值由视图对 `snap.finishLevels[snap.levelIndex].time` 调 §3.7 的 `tierSecondsFor`（与 `computeClearStars` 同函数 ⇒ 不产生第二套判星口径）；`snap.revived` 为真 ⇒ 整行不印。**金样本影响**：`clear` 态 **+1 命令（702 → 703）**，由 `tests/ui-golden-capture.ts` 在可复现锚重抓（⛔ 不手改夹具，K-051 / K-053），其余十态逐字不变；判据 = `tests/clear-panel.test.ts` 新增一例。

**视觉变更登记（2026-10-23 · WXG-T-356 · UI-34 选关整页）**：**选关整页空带增一行「判星对照」**（用户 2026-10-23 在上一批遗留① 上选「把三档门槛也做进选关页」，初裁 = 星带左右分栏 ⇒ **落码前实测推翻该前提**：格内要合规就得 ≥ 28px（accessibility E1 floor，22px 已 v1.3 F7⑤ 作废），而 28px 下 `★★★` ≈ 84px + `≤03:30` ≈ 94px = **178 > 格宽 170** ⇒ 用户改裁 **A = 上移到章名空带**；上位正本 = [`level-select-page-layout.md`](../../games/beads/design/ux/level-select-page-layout.md) v0.6 §2）。改动面 = ① `view/ui-theme.ts` 新增 `starCriteriaText(levelTime)` = 判星对照串的**唯一真源**（门槛取 §3.7 同一个 `tierSecondsFor`，与 `computeClearStars` 同源 ⇒ ⛔ 第二套判星口径），`view-model.ts` 的结算面板那条由内联模板改为**调用它**（输出逐字不变）；② `view/meta-view.ts::drawLevelsPage` 空带增一枚 text 节点（y = 带中心 − `LEVELS_NAV_H` = **884**，字号 `bodyFont(largeText,'sub')` 28→E2 35、色 `palette.textDim` = `#6E7288`，与既有章名 972 / 进度件 928 同带同派生）。**格几何与星带零改动**（`LEVELS_CELL` 170 / `THUMB_TOP_INSET` 8 / `THUMB_STAR_BAND` 28 / `LEVELS_THUMB_AREA` 134 / `LEVELS_GAP` 30 全部不动；v0.5 那版星带分栏的代码改动已整体回退，含撤掉临时加的 `LEVELS_BAND_INSET`）。数据腿沿用 `MetaViewData.wallSlots` / `wallLevels` ⇒ **零新增快照字段**（不碰 `state.ts` / `beads-game.ts`）、零新 tuning 常量；取不到当前关引用 ⇒ **不建节点**（⛔ `--:--` 占位）。主菜单作品墙走 `drawShowcaseItem` 另一条路径 ⇒ **零影响**。**金样本影响** = `level-select` 与 `level-select-mid` 两态（空带 +1 text 命令）；`clear` 态串逐字不变。由 `tests/ui-golden-capture.ts` 在可复现锚重抓，⛔ 手改夹具。

**视觉变更登记（2026-10-24 · WXG-T-365 · UI-40 主菜单顶栏）**：**顶栏中档由「公告禁用态空圆」升格为装扮馆入口 `open-skins`**（提案 P4-甲 = `games/beads/design/proposals/main-menu-entry-strategy.md` §3；用户 2026-10-24 令「顶栏甲案批」，图标裁定「先用原入口图标代替，晚点再对 UI 设计」⇒ 暂复用该位原有 `MENU_TEXTURES.iconSound`，登 `[待 UI 设计]` 债）。改动面 = `config/tuning.ts::MENU_TOPBAR_X.notice`→`skins`（x=560 **坐标零改动、只换语义**）+ 删零消费者 `MENU_TOPBAR_RESERVED_ALPHA`；`view/meta-view.ts` 注册 `open-skins` 热区（`AnchoredMenuGeo.skinsHit`，绘制与命中读同一 geo）+ `drawTopbar` 预留禁用循环退场、该颗改画正常态圆（底圆 / 按下纹 / 40² 图标，与左右两颗同腿）；`view/settings-content.ts` 行5 左格逐字回退为 `cycle-skin`（`open-skins` 退出 `SettingsAction` ⇒ `isSettingsAction('open-skins')` 判 **false**）。**金样本影响** = `main-menu` 态该颗 circle 的 α/fill 参数变，而位图腿在 Node 捕获路径不就绪 ⇒ **指令条数不变**（改前后 total 同为 5636）而 **sha 变**；按用户裁定 **本批不复取、只登账**。**既存三笔红非本批造成**（本批落码前实测即同读数）：`main-menu` 5636（夹具 3662）/ `level-select` 1409（1423）/ `level-select-mid` 7046（5086）⇒〔**2026-10-24 随 WXG-T-367 订正**：原记「归并发会话在制品」**错** —— 在干净检出（`git worktree` @ `0733976`）逐 rev 实跑 `ui-golden-capture.ts` 测得拐点 = **`aa5c85e`（WXG-T-362，已入库）**，且并发会话的关卡在制品对十一态 sha/total **零影响**（三次复取逐字全等）；属 K-096 同型（把当日快照的推测当永久事实）。本条其余读数不变〕；复取锚点 = 三笔各自归因后与 menu 态在**同一 commit** 一并重抓（⛔ 手改夹具，K-051 / K-053）。判据 = `tests/beads-shell.test.ts` 入口例（顶栏三颗中心 x = 68/604/692 同一行 y、该列仅 1 枚圆且不带 alpha、单层 ⇒ 返回直回主菜单）+ `tests/meta-menu-wall.test.ts` 七枚动作集全域扫面。上位 UX 正本 = `ux-spec §3.8` v1.26。

**金样本复取前置登记（2026-10-24 · WXG-T-367 · 复取**未做**，判据已备齐）**：用户令「金样本三态复取」⇒ 复取前先做归因侦查（手段 = `git worktree add --detach temp/… HEAD` 开独立干净检出，手搭 `games/beads/node_modules/@wxgame/framework` 相对软链，裸 node + `tools/scripts/lib/ts-js-resolve.mjs` 直跑复取器；⛔ 不动主树脏文件、⛔ 不 `git add` 对方在制品）。**四条实测**：① 拐点单点 = `aa5c85e`（WXG-T-362）—— `09adcc7` 及以前 `main-menu` 3662 / `level-select` 1423 / phase `playing`，该笔起 5636 / 1409 / phase `boot`（`level-select-mid` 同理随 menu 腿 +1960）；② **视觉腿与关卡数据无关** = 干净 HEAD、HEAD+对方WIP、主树+WIP 三次复取十一态 sha **逐字全等** ⇒ 复取无时机风险的那一半已就绪；③ **但 `proof.phase` 是数据相关的** —— `beads-game.ts::_boot()` 对**每一关**跑 `validateBeadsLevel`，任一错误即 `console.warn('level validation failed — refusing PLAYING')` 并 return（其注释自陈 "Invalid level data keeps the game in BOOT forever"；`config/levels.ts:63` 有 "rejected all 8 levels and BOOT never finished" 的同形状先例注），HEAD 上 `L3` 14 行 / `L4` 12 行 misplaced 非字符串 ⇒ 打印 26 条错误、菜单族五态恒 `boot`；④ 故 **HEAD 权威读数 = beads 22 failed / 1239 passed / 3 skipped（1264）**：`pause-settings` 10（失败信息清一色 `expected 'boot' to be 'playing'` = 纯连锁）+ `ui-golden` **5**（不是先前所记的 3：`settings`/`signin` 两态仅 phase 腿红）+ `misplaced-assembler` 2 + `difficulty` 2 + `levels` 1（`accepts … every shipped level` 直判 L3）+ `board-camera` 1 + `beads-shell` 1；而主树（含对方未入库三件）= 6 failed ⇒ **差 16 条全由那件数据修复所致**。**裁定（用户选甲案）= 本批不复取**：在 BOOT 锁未修前复取会把「启动即卡死」的退化相位 `boot` 写进金标准，且数据修好后立即二次返工；夹具已还原为 HEAD 版，主树零污染。**解除条件** = `L3`/`L4` 的 misplaced 形状修复入库（357 批 b8dc136「改 pattern 必同改 misplaced」守恒规矩的欠账），在其 **同一 commit** 一次复取**五态**（`main-menu` / `level-select` / `level-select-mid` 视觉+相位、`settings` / `signin` 仅相位），⛔ 分批、⛔ 手改 sha/total/proof（K-051 / K-053 / ADR-0032 DEC-6）。**另记门禁缺口**：`pnpm run levels:check` 只校 `arcs.ts ↔ chapters/` 同步，不查 misplaced 行类型 ⇒ 此类数据缺陷入库时无门可拦，本次是被 `levels.test.ts` / `misplaced-assembler.test.ts` 的「全过 BOOT」判据与金样本 `proof.phase` 偶然捕获；是否给 `levels:check` 补一条形状判据 = `[待裁定]`（本批不扩门禁）。〔**2026-10-24 随 WXG-T-375 复取完毕** ⇒ 归因由单变量实验重做、三态记录已重写、`capturedFrom` 锚改回真实复取基，见本节末条〕

**预演订正（2026-10-24 同日 · WXG-T-368 · 承上条）**：上条有两处取错，一并订正。

① **「解除条件 = misplaced 形状修复入库」取小了**。用并发会话的三件在制品（`levels-data.ts` + `L00003/L00004.json`）在干净检出里预演「其入库之后」：`refusing PLAYING` 零出现 ⇒ BOOT 锁确随形状修复解除、菜单族五态相位回 `playing`、金样本五态可全绿；但 beads 全量仍 **3 failed / 1258 passed / 3 skipped（1264）**，三条红都不在金样本腿上 —— `misplaced-assembler.test.ts:346`「L3 全错」= 装配后错位格 **88** 而 L3 可填格 **108**（357 批「成片全错」不变式未满足，misplaced 只覆盖 88 格）；`difficulty.test.ts` 两条 = L3 难度指数实测 **42.2** vs §5.1 冻结表 **73.7**，且按 DI 升序得到的九关墙陈列序 `L6→L1→L8→L2→L3→L5→L4→L7→L9` 与 §5.2 冻结序在 L3/L5 两处换位。⇒ **复取的解除条件加严为：形状修复 + L3 全错覆盖率达标 + §5.1/§5.2 数值与关表同步**（数值真源 = `design/gdd/systems-index.md` 体系下的第一章表）。

② **「此类数据缺陷入库时无门可拦」措辞不准**。`levels:check` 确实只校 `arcs.ts ↔ chapters/` 同步、不查 misplaced 行形状，但**门并不缺失**：运行时 `_boot()` 的全表预校验，加 `levels.test.ts`「accepts … every shipped level」与 `misplaced-assembler.test.ts`「全部出货关全过 BOOT」两条判据，在 `aa5c85e` 提交当时**就会红**（本批实测 HEAD = 22 failed 即其证据）。失守点 = **提交前没跑 `pnpm run verify`**，属流程而非门缺失 ⇒ 上条末尾那个 `[待裁定] 是否给 levels:check 补形状判据` **撤销**，已有判据足够，再加一道同义门属冗余。

**③ 判定反转（同日 · WXG-T-369 实测）**：上条把「L3 错位格 88 < 可填格 108」记成数据欠账 —— **错**。数值真源 `systems-index §3.13`「错位档位」行（v1.56 生效，语义正本 = `levels-spec §2.3`）冻结的是 `max` 档极大错位式 **`M_max = min(N, 2(N − m))`**（N = 本宫可填格、m = 本宫主导色珠数），L3 代入 N = 108、m = 64 ⇒ **`M_max = 88`**，与装配实测逐字相等（强制原位 20 = `2m − N`）⇒ **88 就是正解，"整片全错"在该关的色分布下数学上不存在**。出货十关逐一算过：其余九关 `m ≤ ⌊N/2⌋` ⇒ `M_max = N` 且实测原位 0，即旧断言与真源式在这九关完全重合，改判不放宽任何东西。缺陷位置随之从数据面移到判据面：`misplaced-assembler.test.ts:341` 那条「错位格数 = 全可填格」是 MVP 时代（只有 `full` 一档）留下的 blanket 断言，正本 §3.2 批2 落地甲′ 时明写「删乙须**先改 QA 判据**」而该改一直欠着 ⇒ 本批按冻结式补齐。**复取的解除条件由三条回到两条：§5.1 DI 与 §5.2 墙序同步。**

**金样本三态复取（2026-10-24 · WXG-T-375 · 承 UI-34 / UI-40 与上三条前置登记，✅ 已执行）**：WXG-T-367 立「复取未做」并逐条收紧解除条件，本批按修订后的两条核到齐 —— ① `L3`/`L4` 的 misplaced 字符串行修复已入库（`d2aa7ab` · WXG-T-371）② §5.1 难度指数与 §5.2 陈列墙序已随关卡数据同步（`929f936` · WXG-T-374）；原第三条「L3 全错覆盖率」由 369 判定反转撤销（88 就是 §3.13 冻结式 `M_max = min(N, 2(N − m))` 的正解）。

**归因 = 本批单变量实验，不沿用 367 的拐点推测**：装置 = `git worktree add --detach temp/wxg375-cc cc8b52f` 开干净检出 + 手搭 `games/beads/node_modules/@wxgame/framework` 相对软链 + 裸 node 跑 `tests/ui-golden-capture.ts`（⛔ 不动主树脏文件、⛔ 不把并发在制品烘进夹具）。实验 = 在干净检出里**只**把 `games/beads/src/config/levels-data.ts` 回退到 `09adcc7`（362 的前一笔）、代码其余保持 HEAD ⇒ 三态 `total` 与 `kinds` **逐字回到旧夹具读数**（`main-menu` 5636→3662、`level-select` 1409→1423、`level-select-mid` 7046→5086，kinds 逐项全等）⇒ **三态漂移 100% 由 WXG-T-362 的关卡数据重建造成，既不是 UX 改版也不是代码改动**。格数侧佐证：362 唯一改格数的是 L9 曼陀罗 22×21 → 30×30（有珠格 328 → 612，**+284**），L3/L4 格数不变（只改配色与 misplaced 分布）；一颗豆在指令流里恒为 1 rect + 2 circle + 4 polygon = **7 条** ⇒ 主菜单腿 +282 组（+1974 条）、选关腿 −2 组（−14 条）、转场中点帧 = 两腿之和（+1960 条）。**sha 的第二贡献腿** = WXG-T-365 顶栏 `open-skins` 那颗由禁用态改画正常态（α/fill 参数变、条数不变）：实验里 `level-select` 的 sha 与旧夹具**逐字相等**（该态不画顶栏），另两态不等 ⇒ 与 365 自报形状吻合，属该批「按用户裁定不复取、只登账」的欠账一并结清。

**复取范围与读数**：夹具仅三态记录变（16 行 +/−），其余八态 `total`/`kinds`/`sha` 逐字未变 —— 含 367 预判的 `settings`/`signin`「仅相位腿红」，实测该两态夹具里本就记 `playing`、复取后仍 `playing`，无需改；相位腿 11 态全为预期（菜单族 `playing` / `pause` `paused` / `clear` `level-clear` / `fail`·`sprint-settle` `game-over` / `finish` `finish`）⇒ 367 担心的 BOOT 锁确已解除。复取器内建两遍确定性自证 = PASS；验收 = `npx vitest run tests/ui-golden.test.ts` **12 passed**（此前 3 failed）。

**provenance 订正（`capturedFrom` 锚字段失真）**：夹具该字段自 WXG-T-356 批复取（`3611904`）起写作 `dc60d54`（= 298 时代首提交），系复取时把旧值当 `WXG298_SOURCE_REV` 传入 ⇒ 锚与真实复取基不符，后来按锚取数会被误导（本批即因此重查过一次）。本批复取传 `$(git rev-parse --short HEAD)` ⇒ 现为 `cc8b52f · detached worktree 干净检出复取（WXG-T-375 金样本三态收口）`。**后续复取纪律** = 必须核对 `capturedFrom` 随 diff 一起变成当次 HEAD，先例 = WXG-T-312 把 311 的锚重锚到 `8e0d133`。

**视觉变更登记（2026-10-24 · WXG-T-376 · L00001 换图 + 数据代收口）**：并发会话在制品 `games/beads/design/levels/singles/L00001.json` 把图案中段 4 行重排（如 `..11111111...` → `.2222221111..` / `..22211111...`，另两行同形），真引擎重定价 ⇒ `steps` 10→27 / `time` 30→46（`pricing.clamped` true→false）、`misplaced` 随之重出 ⇒ `M` 102→**92**、`ρ` 1.000→**0.902**、`DI` 31.8→**28.7**；`contentVersion` 35→38。该件自 2026-10-24 停摆、逐字节未再变动（与本批预演所取 patch 的 sha-256 相同），经用户 2026-10-24 授权代收口后由本批入库。**金样本影响** = 选关墙缩略画 L00001 图案 ⇒ `level-select` / `level-select-mid` 两态 + 冲刺结算的示例盘 `sprint-settle` 一态，**三态均只变 `sha`、`total`/`kinds` 逐字未变**（L1 的 `N` = 102 未变，只是点阵颜色分布重排）；`main-menu` 与其他七态逐字未变（橱窗不画 L1 格点）。复取读数 = `level-select` `3597ed99…`→`ddce1f65…`、`level-select-mid` `185e17b6…`→`d7605e5e…`、`sprint-settle` `30252d5a…`→`e6401a99…`，共 **4 行 diff**（含 `capturedFrom` = `2c02565 · L00001 换图收口复取（WXG-T-376）`）；复取器两遍确定性自证 PASS、相位腿 11 态全为预期。验收 = `ui-golden` **12 passed**。判据 = `difficulty.test.ts` 三处（`EXPECT_DI` / DI 升序 / Spearman）+ `ui-golden.test.ts` 12 passed。数值真源回写 = `level-difficulty.md §5.1/§5.2/§5.3`（DI 28.7、首末比 14.87、Spearman 0.833）与 `menu-architecture.md §3.2/§3.3`。

**视觉变更登记（2026-10-26 · WXG-T-421 · UI-33 过关面板 · ADR-0035 §3.2.1 ②）**：**结算·过关面板增「品质分」行**（用户 2026-10-26 三项前置令②「结算面板加一行」，行位另裁 **面板顶部得分条**；上位正本 = `ux-spec §3.4` v1.27）。改动 = `systems/clear-panel.ts` 新增 `CLEAR_RIBBON_H = 84`（视图原硬编码收单源）+ `qualityY = (titleY + CLEAR_RIBBON_H/2 + panel.yMax) / 2`（缎带顶到面板顶缘 **98px 空带**中点）；`view/view-model.ts::drawClearPanel` 在缎带之后画一行 `text_dim` / `bodyFont(largeText,'sub')`，`snap.clearQualityScore > 0` 才建节点，历史最佳更高时追加 ` · 最佳 M`（首通 / 本局即最佳只印本局分）。**几何零改动**：`PANEL_SIZE` 560×480 不动、既有六行零挤压、缎带行距 +110 不动。**数据腿** = save v6 `settleBestByUid`（稀疏）+ 快照 `clearQualityScore` / `clearQualityBest`（两字段，`state.ts`）。**金样本影响**：`clear` 态 **+1 命令（620 → 621）**，由 `tests/ui-golden-capture.ts` 在可复现锚重抓（⛔ 不手改夹具，K-051 / K-053），其余十态逐字不变；判据 = `tests/clear-panel.test.ts` 新增一例（行位在缎带上方空带 + 首通只印本局分 + 破纪录后追加「最佳」）。

**关键路径**：UI-00 → UI-01 → UI-10…14 → UI-20 → UI-22 / UI-25 → UI-30 → UI-31 → UI-41 → UI-42 → UI-50 → UI-53。UI-02（金样本）与 P1 可并行，但必须在 UI-30 前完成。

## 13. 待你拍板

D1–D5 均已裁定（见 [ADR-0032 §5](adr/ADR-0032-beads-ui-architecture.md)）：两层 / 分级复用 / 遮罩保留双档名 / 常量第一阶段并存 / 选关整页；选关整页版式已裁为**版式 P**（[确认单](../../games/beads/design/ux/level-select-page-layout.md)）。UI-00 已完成。**UI-34a 六项待核已于 2026-10-20（WXG-T-310）清零**（确认单 v0.2 §4.1）；**UI-34 落码已于 2026-10-20（WXG-T-311）完成**；**UI-42 已于 2026-10-20（WXG-T-316）完成壳标志位退役**（屏幕 / 覆盖层改由 `PhaseRouteBinder` 的 Navigator 栈投影，与 `UiRoot` 共用同一栈）；**UI-50 已于 2026-10-20（WXG-T-317）完成绘制入口收口**（`UiRoot` 唯一入口、并行开关退役）；**UI-51 已于 2026-10-20（WXG-T-318）完成文档回写**（目录 / 路由表 / `control-manifest §20` / ROUTES）；**UI-52 机械守已于 2026-10-20（WXG-T-319）落码**（§20 五条 + 负样本入 `selftest:fast`）；**UI-53 已于 2026-10-20（WXG-T-320）验收闭合**（`verify` PASS 22 + harness 双游 + `[R]` 阻塞已登记）。
