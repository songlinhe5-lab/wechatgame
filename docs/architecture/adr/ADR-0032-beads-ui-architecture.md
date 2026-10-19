# ADR-0032 · beads UI 架构：页面 / 弹窗拆成独立 View + ViewModel，公共基础收口为「框架机制层 + beads 风格层」

- **编号 / 命名**：接 `ADR-0031`；号只分配不回收。
- **日期 / 作者**：2026-10-19 · 起草 = Cursor 会话（待工程负责人程基岩评审）
- **任务号**：**尚未登记**（2026-10-19 用户裁「本批不动 `production/TASKS.md`」；开工前需在台账领号，下一可用号见 [`production/TASKS.md`](../../../production/TASKS.md) 头注）。
- **状态**：**Proposed（待用户裁定 §5 的五个决策点）**。⛔ 本文是**零代码、零常量改动**的设计文书；实施顺序与任务拆分见正文 [`ui-architecture-beads.md`](../ui-architecture-beads.md) §12。
- **关联**：ADR-0002（core 引擎无关）· ADR-0011（屏幕坐标空间契约）· ADR-0014（RenderModel 变换通道）· ADR-0015（棋盘缩放平移与「抬起才提交」）· [`control-manifest.md`](../control-manifest.md) L2/L3/L5 · [`input-control.md`](../../../games/beads/design/gdd/input-control.md) v2.13 · [`ux-spec.md`](../../../games/beads/design/ux/ux-spec.md)
- **冻结常量**：**零改动零新增**。`SAFE_TOP_H` / `HUD_BAND` / `CAPSULE_AVOID` 等仍以 `systems-index §3` 为真源，本文只规定「谁来读、怎么读」，不改数值。

---

## 1. 上下文

beads 现在有主界面、选关、设置、签到、暂停、过关、失败、冲刺结算、全通关等十个界面单元，但它们**没有统一的 UI 层**，而是挤在两条互不相通的渲染链里（行号为 2026-10-19 快照）：

| 现状 | 证据 | 后果 |
|---|---|---|
| 两套并行实现：对局走 `buildBeadsView`，菜单走 `buildMetaView` | [`view-model.ts`](../../../games/beads/src/view/view-model.ts)（2373 行）· [`meta-view.ts`](../../../games/beads/src/view/meta-view.ts)（1406 行）· [`beads-shell.ts`](../../../games/beads/src/game/beads-shell.ts) 第 71、112–113 行用 `_screen` 加 `_overlay` 两个标志位当「导航」 | 每加一个弹窗都要在两边各改一次，导航没有栈、没有「返回」语义 |
| 遮罩、纸面板、按钮、按下位移、安全区标定线**各写了两份** | 遮罩：`view-model.ts` 第 363/484/578 行读 `PANEL_SCRIM_*`，`meta-view.ts` 第 1326–1331 行用字面量 `0,0,0`（代码注释自认「不同源」）；按钮：`drawWoodButton`（第 1396 行）与 `drawButton`（`meta-view.ts` 第 694 行）；标定线：`drawSafeGuideLines`（第 719 行）与 `drawSafeGuides`（第 1403 行） | 风格改一处漏一处，已出现过漂移 |
| 性能覆层只存在于对局 | `view-model.ts` 第 1280–1299 行 | 菜单与弹窗里无法看帧率 |
| 安全区、胶囊有两个来源 | 菜单读平台实测：`beads-shell.ts` 第 273–275 行传给 `menuAnchors`；对局读冻结常量 [`tuning.ts`](../../../games/beads/src/config/tuning.ts) 第 28–32 行 | 同一台机器上菜单与对局避让结果可以不一致 |
| 设置内容重复 | `PausePanelAction` 与设置弹窗共用同一批动作（[`pause-panel.ts`](../../../games/beads/src/systems/pause-panel.ts) 第 40–58 行） | 两处各自排版 |
| 弹窗动画与命中各面板自带 | `PausePanel` / `ClearPanel` / `SprintSettlePanel` / `FinishPanel` 各有一套开合进度（均读 `PANEL_IN_MS`） | 同一件事四份实现 |
| 框架已有页面栈却没人用 | [`scene-stack.ts`](../../../packages/framework/src/core/scene/scene-stack.ts)（注释即写着「HUD → 关卡 → 暂停 → 结果」）；全仓只有它自己和单测引用 | 白白重复造导航 |

## 2. 决策（DEC）

- **DEC-1 · 一个界面单元 = View + ViewModel + Presenter 三件**。View 只负责画（纯函数，只读 ViewModel）；ViewModel 是每帧由游戏/元游戏状态投影出的**复用对象**（零分配，沿用现有 `_viewData` 做法）；Presenter 负责布局、命中与把点击翻译成「意图」（如继续、重玩），意图交给宿主去改状态。View 与 ViewModel 不持有任何权威游戏状态（守 L5）。
- **DEC-2 · 公共基础分两层**。**框架机制层**（`packages/framework/src/core/ui`，引擎无关、不含颜色与风格）放导航器、弹窗生命周期、抬起提交门、安全区数值类型；**beads 风格层**（`games/beads/src/ui/kit`）放主题、页面框架、弹窗框架、导航栏、通用控件与调试层。
- **DEC-3 · 导航底座复用 `SceneStack`**，在其上加「页面 / 弹窗」两种路由类型与输入屏障，不另起第二个栈。
- **DEC-4 · 弹窗必经唯一的弹窗框架**：遮罩、纸面板、标题带、进出场动画、点击屏障只在框架里实现一次；具体弹窗只提供「内容区」。
- **DEC-5 · 安全区、胶囊只有一个出口**（安全区数值对象），导航栏与顶部控件自动避让胶囊；调试层（性能覆层、标定线、调试开关状态）由 UI 根统一挂在所有路由之上，菜单与对局共用。
- **DEC-6 · 迁移期零视觉漂移**：逐界面「绞杀式」迁移，以现行 RenderModel 指令序列的金样本做回归门；统一遮罩色等**有意的视觉变化**另走 UX 裁定，不夹带在迁移里。

## 3. 备选与取舍

| 方案 | 取舍 |
|---|---|
| A 保持现状，只把 `view-model.ts` / `meta-view.ts` 按函数切文件 | 工作量小，但两套实现、两套遮罩、两个安全区来源都留着，等于没解决（否决） |
| B 全部放 framework，含风格组件 | 风格与 beads 调色板耦合，破坏框架「只认结构不认玩法」归属判例（ADR-0013）（否决） |
| C 全部放 `games/beads/src/ui`，不提框架 | 可行，但导航器、弹窗生命周期、抬起提交门、安全区类型本身与游戏无关，breakout 同样会重复造（备选，决策点 D1） |
| **D 两层（本文推荐）** | 机制可复用、风格留在游戏内；多一次框架改动与镜像同步 |

## 4. 后果

- 好处：加弹窗只写内容区；风格、遮罩、安全区、调试各只有一处；`BeadsShell` 退回「接线」角色，导航由栈派生，不再靠标志位。
- 代价：十个界面单元要逐个迁移；新增约 30 个 `.ts` 文件，Cocos 镜像里每个新文件都需要编辑器生成 `.meta`（L1，⛔ 不手写）；迁移期间旧入口 `buildBeadsView` / `buildMetaView` 需保留为门面，直到最后一批。
- 风险与前置见正文 §11，其中**他会话在途改动**（`meta-view.ts` / `view-model.ts` / `beads-shell.ts` / `ux-spec.md` 当前均为未提交状态）必须先落地再开工。

## 5. 待用户裁定的决策点

| # | 问题 | 推荐 |
|---|---|---|
| D1 | 公共层放哪：两层 / 只放 beads / 全放 framework | 两层（用户已于 2026-10-19 选定，仍列此处便于留痕） |
| D2 | ViewModel 形态：复用对象 + 只读类型 / 每帧新建 | 复用对象（热路径零分配铁律） |
| D3 | 两种遮罩（菜单 α0.5 黑 / 对局 `PANEL_SCRIM_RGB`）：迁移期保留双档名 / 立即统一 | 保留双档名，统一另走 UX 裁定 |
| D4 | 对局侧 `HUD_BAND` / `CAPSULE_AVOID` 常量何时并入安全区数值对象 | 第一阶段并存，并入需走 `§3` 变更单 |
| D5 | 选关是弹窗还是整页 | 先按弹窗（沿用你的称呼），导航器预留「不透明整页」类型 |
