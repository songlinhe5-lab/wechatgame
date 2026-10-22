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
| | UI-53 ✅ | 全量 `verify` 与 harness 验收；真机安全区项登记为 `[R]` 阻塞 | M | UI-50…52 | ✅ 2026-10-20（WXG-T-320）：`verify` PASS 22 + harness 双游 + 主包 3201.0 KB；`[R]` 见 `qa/beads/test-cases.md §O` | 质量负责人 |
| P6 容器层 | UI-60 ◐（**P0 已落 WXG-T-327**：容器/段语法 + 两端映射 + DEC-5 sibling 定序 + `lastScopeCount`；**P1 可证部分已落 WXG-T-328**：引擎无关层树内核（懒建 / 容器出现序 / **段枚举序** / 段挂容器之下，9 例 + 三处定向变异全咬红），framework 500 绿；⚠ 仍未接：cc 薄壳 + 视图发命令 + 真机读数 ⇒ 层级缺陷未消）| **UI 容器层：容器内层有序 + 事件逆序**（用户 2026-10-20 裁定「每页面・每弹窗各是一个 UI 容器，按层级绘制、事件按层级透传；层级是顺序关系，不能错乱」）。方案正本 = [`ADR-0033`](adr/ADR-0033-ui-container-layer-ordering.md) DEC-1…9；根因 = Cocos 写死五段通道压掉指令相对序，canvas2d 为 immediate mode ⇒ Node 全绿真机错乱（K-030 同族） | L（P0 容器语法+两端层树 → P1 弹窗内容入容器 → P2 输入逆序 → P3 机械守+金样本重抓）。**Q1–Q3 已裁（2026-10-20）**：四批确认；段粒度含 `hud`/`toast` ⇒ 层树=容器×段×通道（scope 数 **P0 须实测**）；P1 前维持「没半透」止血观感 | UI-50；**硬前置**：他会话 UI 迁移 WIP 入库 | 解开 `dialog-center.test.ts` 中 skip 的层序例；新增机检「容器 A 命令全部早于容器 B，且遮罩先于本容器面板」；真机层序读数入 `qa/beads/device-walkthrough.md` | 工程负责人 |

**视觉变更登记（2026-10-22 · K-051 / K-053 / ADR-0032 DEC-6）**：**主菜单签到入口回归**（用户三点拍板：① `canClaim` 时信封右上画 1 枚小圆点 = 全局唯一提示位；② 已领当日仍可打开看进度；③ 不做开合动画、零新毫秒值）。改动 = 顶栏公告/信箱从「两颗均禁用空圆」收为「公告仍禁用、信箱实装」+ `open-signin` 热区注册 + 小圆点（`MENU_SIGNIN_DOT_R`，色读既有 `danger`）；旧 Q5①「签到入口退役」口径作废。**金样本影响**：`main-menu` / `level-select-mid` 两态各 **+1 命令**（小圆点），须由 `tests/ui-golden-capture.ts` 在可复现锚重抓，⛔ 不手改夹具。

**视觉变更登记（2026-10-22 · WXG-T-351 · §3.6 v1.80 豆子出口）**：① **道具卡角标**——免费次数内仍画白 ▶，用尽后改画**豆子价数字**（20/30/45，`UI_FONT.cell` 22 · `POWERUP_BADGE_GLYPH`）；免费分支表达式**逐字节不变** ⇒ 十态金样本与封箱 sha **零漂移**（实测 `ui-golden` / `bead-style-seal` 全绿）。② **新增模态**：道具购买确认弹窗（`systems/buy-confirm-panel.ts`，560×300 + 2×240×88，**静态无动画**），仅弹窗开启帧可见 ⇒ 同样不进既有十态。③ 文案 3 键经 `tokens.md §7` 新增并标 `[待 art 确认]`。

**关键路径**：UI-00 → UI-01 → UI-10…14 → UI-20 → UI-22 / UI-25 → UI-30 → UI-31 → UI-41 → UI-42 → UI-50 → UI-53。UI-02（金样本）与 P1 可并行，但必须在 UI-30 前完成。

## 13. 待你拍板

D1–D5 均已裁定（见 [ADR-0032 §5](adr/ADR-0032-beads-ui-architecture.md)）：两层 / 分级复用 / 遮罩保留双档名 / 常量第一阶段并存 / 选关整页；选关整页版式已裁为**版式 P**（[确认单](../../games/beads/design/ux/level-select-page-layout.md)）。UI-00 已完成。**UI-34a 六项待核已于 2026-10-20（WXG-T-310）清零**（确认单 v0.2 §4.1）；**UI-34 落码已于 2026-10-20（WXG-T-311）完成**；**UI-42 已于 2026-10-20（WXG-T-316）完成壳标志位退役**（屏幕 / 覆盖层改由 `PhaseRouteBinder` 的 Navigator 栈投影，与 `UiRoot` 共用同一栈）；**UI-50 已于 2026-10-20（WXG-T-317）完成绘制入口收口**（`UiRoot` 唯一入口、并行开关退役）；**UI-51 已于 2026-10-20（WXG-T-318）完成文档回写**（目录 / 路由表 / `control-manifest §20` / ROUTES）；**UI-52 机械守已于 2026-10-20（WXG-T-319）落码**（§20 五条 + 负样本入 `selftest:fast`）；**UI-53 已于 2026-10-20（WXG-T-320）验收闭合**（`verify` PASS 22 + harness 双游 + `[R]` 阻塞已登记）。
