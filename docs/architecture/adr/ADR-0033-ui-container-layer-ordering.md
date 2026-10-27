# ADR-0033 · UI 容器层：每页面 / 每弹窗一个渲染容器，容器内层有序、事件按层逆序透传

- **状态**：Accepted（原则由用户 2026-10-20 真机裁定：「每个页面和对话框是一个 UI 容器，里面按照层级绘制，事件按照层级透传；层级是一个顺序关系，不能错乱」）；**Q1–Q3 已由用户 2026-10-20 裁定（§5）⇒ 方案定稿；P0 框架腿已入库（WXG-T-327，交付面见 §5 P0 记录），P1 / P2 受 §4 前置约束**；**DEC-8① Node 层序守门轨已入库（WXG-T-329，见 §DEC-8① 记录）**；**P1 设备腿已入库（WXG-T-437，见 §P1 设备腿交付记录）**；**三项显式未做已收口（WXG-T-438，见 §三项显式未做收口记录）：位图腿按作用域递 + 调试层恒置顶（§S1 定稿）+ 对局面板容器化**；⚠ 真机层序 / draw call 读数 `[R]` 未取 ⇒ 缺陷「已修待设备证」**
- **日期**：2026-10-20
- **关联**：ADR-0032（beads UI 架构，§6 路由 / §8 五条守则）、ADR-0030（Cocos 生产 blit 载体）、ADR-0031（blit 静态位图腿）、ADR-0026（`blit` kind）、ADR-0014（全局变换通道）
- **判例链**：WXG-T-322（遮罩未铺满）→ WXG-T-323（弹窗居中）→ **WXG-T-324（弹窗补画底页 ⇒ 真机层级错乱）→ WXG-T-325（回退止血 + 本 ADR）**
- **负责域**：工程负责人（框架 + adapter）· 设计策略（容器边界与视觉层序）· 质量负责人（设备侧层序判据）

---

## 1. 上下文

**现象**：主菜单打开「设置」弹窗后，主菜单的文字与位图浮在弹窗之上，弹窗不在最上层（用户真机原话「设置页不在最上面……绘制错乱了」）。

**为什么只有真机出**：两端渲染语义不同。

| 端 | 指令流 → 画面的映射 | 结果 |
|---|---|---|
| canvas2d（harness / Node 单测 / 金样本对拍） | immediate mode，**指令序 = 层序** | 遮罩压住先画的底页 ⇒ 看起来正确 |
| Cocos（真机） | **五段写死通道**：`Background` Graphics → `BlitLayer`（珠） → `Graphics`（全部矢量） → `BlitLayerUI`（静态位图腿） → `Labels`（全部文字），子节点序固定（`adapters/cocos/bindings.ts` 层序三叠注） | 跨通道的相对序**丢失**：底页的位图腿与文字永远画在遮罩（`Graphics` 里的 rect）之上 |

**已有设施与缺口**：`Navigator` 已把路由分成 `page`（不透明，盖住下方）与 `modal`（透明，`blocksBelow` 阻断下方输入），`UiRoot.draw` 已自下而上遍历可见路由 —— 容器概念**在导航侧存在，在渲染侧不存在**：两条弹窗路由（`signin` / `settings`）的 `draw` 是空函数，内容仍由底下的 page 视图分支（`meta-view` 的 `overlay` 分支）画出。因此渲染侧没有可用的容器边界，通道也无法按容器分配。

**附带缺陷（同批必修）**：`CocosRenderer._drawText` 只 `acquire()` + `setPosition()`，**不按帧重排 sibling** ⇒ 同一 `Labels` 层内文字叠序取决于池节点创建历史（上一帧借用了几个 Label），跨帧可变。这是「层级是顺序关系，不能错乱」的第二处违反。

**验收面缺口**：`verify` / 金样本 / harness 全绿而真机错乱 ⇒ 现有门**没有设备侧层序这一维**（K-030「两端不一致」同族）。本 ADR 的 DEC-8 补这一维，否则同类缺陷会第三次出现。

## 2. 决策（DEC）

- **DEC-1 容器 = 渲染单元**。每个可见 Route（`page` / `modal`）对应一个渲染容器；容器拥有完整保序的命令段；容器之间严格按栈序自下而上叠放。弹窗内容必须由弹窗容器自己画，不再由底下的 page 视图分支代画（撤掉 `meta-view` 的 `overlay` 分支代职）。
- **DEC-2 RenderModel 增加「容器 + 段」两级语法**（用户 Q2 裁定：粒度要含 `hud` / `toast` 段）：`beginContainer(id)` / `endContainer()` 外层，容器内可再开 `beginSegment(seg)` / `endSegment()`，段为**枚举**而非自由字符串：`'page' | 'hud' | 'modal' | 'toast'`（新增值需改枚举并过评审）。两者均与既有 `clip` / `unclip` 同族（成对出现；容器嵌套 ≤ 1 层，段在容器内不叠套）。**未标段的命令归默认段**：`page` 容器 = `page`，`modal` 容器 = `modal` ⇒ 视图层改动量从「逐命令标」降到「只在真需跨通道叠序处开一段」，漏标不致错乱（默认段语义与现行为一致）。未知这些 kind 的 adapter **忽略即可** ⇒ 向后兼容，breakout 与既有场景不受影响。
- **DEC-3 Cocos 映射**：层树 = **容器 × 段 × 通道三件套**：`Container_i` 下每个出现的段一个子树，内含 `Graphics_ij`（+ 可选 `back Graphics_ij`）、`BlitLayerUI_ij`、`Labels_ij`；段间按枚举固定序（`page < hud < modal < toast`）排列而非指令序，容器间按栈序。**段为什么要拆通道而不只拆 Labels**：同一容器内若先画 HUD（矢量 + 文字）再压一道遮罩，`Labels` 必须能被后面的 `Graphics` 盖住 ⇒ 单 `Graphics` 十单层做不到（同 ADR-0030 为 `model.background` 碰过的坑）。珠层（`BlitLayer`）**保持全局单层**，见 DEC-7。**draw call 预算口径**：可见容器 ≤ 3 × 每容器实开段 ≤ 2 ⇒ `Graphics` ≤ 6（对比现状 2）；每段另加 1 个 Label 父节点 + 1 个 BlitUI 父节点（节点不增 draw call）。**本数为预估、不是读数**⇒ P0 验收必须实测（harness 计数 + 真机 DG 基线），不达则用 DEC-9 降级杆。
- **DEC-4 层序 = 容器序 + 容器内指令序，⛔ 不引入 zIndex**。沿用现有约定「子节点序 = Cocos UI 绘制序」；zIndex 会成为第二份真源。
- **DEC-5 同层文字叠序确定化**：`_drawText` 每次 acquire 后按「帧内第 n 条 text」设 sibling 序；池复用只影响节点身份，不影响叠序。
- **DEC-6 事件按层逆序透传**。输入自栈顶向下遍历容器：命中 modal 容器内 ⇒ 消费并阻断；容器外（遮罩区）按该弹窗的 `dismissOnScrim` 策略决定 `dismiss` 或 `block`（`modalHitTest` 现有语义保留）。落地前提是导航侧已是真源（ADR-0032 DEC-3「栈即导航状态」），本批把 `blocksBelow` 真正接到输入腿。
- **DEC-7 珠 / 对局世界层不容器化**：棋盘 tile 与珠位图属世界层，恒在 UI 容器之下（保留 WXG-T-256 / ADR-0030 层序）。这也是局内暂停面板一直正常的原因。
- **DEC-8 验收必须含设备侧层序**：① Node 侧新增机检 —— 对 RenderModel 断言「容器 A 的全部命令索引 < 容器 B」且「遮罩在容器内先于面板与文字」，纳入 `check:arch`；② 真机判据写入 `production/qa/beads/device-walkthrough.md`（同层文字与位图必须被遮罩压住），`[R]` 未取读数不得关单。金样本按容器重抓（指令流多出容器边界），sha 变化须先登记（K-053）。

- **DEC-9 预算不达的降级杆（按序）**：① 只给真需跨通道叠序的段拆全通道，其余段共用容器级 `Graphics`（拆半）；② 弹窗容器与底下 page 容器合一个 `Container`（靠段保住叠序）；③ 丙案剪影底。⛔ 不得用「删段」换预算——那是把本 ADR 要修的缺陷改回去。

## 3. 备选与取舍

| 案 | 内容 | 拒因 |
|---|---|---|
| 甲 | 只加一条 `barrier` 指令（把 `Labels` / `BlitLayerUI` 拆成 Base/Modal 两层） | 只救「遮罩 vs 顶部两通道」这一处；容器仍不是渲染单元、事件仍靠标志位 ⇒ 不满足「层级是顺序关系」这条原则，同类缺陷会在 HUD / toast / 转场处再冒 |
| 乙 | 每条命令带 `layer` 字段（`page` / `modal` / `hud` / `toast`） | 表达力最强，但视图层每一处都要标 ⇒ 漏标即错乱、机检难覆盖。**⚠ 用户 Q2 裁定「粒度要含 hud / toast 段」后，本维已被 DEC-2/3 吸收**：采纳「段」这一概念，但收口方式改为**容器内成对的 `beginSegment`**（只在真需跨通道叠序处开段）而非逐命令字段 ⇒ 抖掉「漏标即错乱」那一否因 |
| 丙 | 弹窗期底页只发矢量（不发 text / blit），做「剪影底」 | 零框架改动、观感是假半透（菜单缺字缺图），违背「层级清晰」；留作 P1 万一 draw call 不达预算时的降级杆 |
| 丁 | 只回退不重构（= 当前 WXG-T-325 过渡态） | 设备恢复「没半透但不错乱」，缺陷仍开 ⇒ 只作为过渡态，不是终态 |

## 4. 后果

- **改动面四件同批**：`packages/framework/src/core/render/render-model.ts`（容器 kind + builder 方法）→ `adapters/canvas2d/canvas2d-renderer.ts`（忽略或分组）→ `adapters/cocos/{bindings,cocos-renderer}.ts`（按容器建层树 + sibling 序）→ `games/beads/src/ui/*` 与 `view/meta-view.ts`（弹窗内容搬进容器）。
- **成本**：节点与 draw call 增加，需读数（harness 计数 + 真机 DG 性能基线）；不达则用降级杆（丙 或 容器合并）。
- **金样本**：容器边界进入指令流 ⇒ 十态 sha 预期变化，先登记再重抓；`dialog-center.test.ts` 里 `skip` 的层序例在 P1 完成后解开。
- **守则扩条**：`control-manifest §20` 与 `ui-architecture-beads §8` 需加一条「**容器即渲染单元**：`modal` 路由必须自持 `draw`；⛔ 页面视图分支不得代画弹窗」。
- **⚠ 并发前置（已按实测改窄，WXG-T-327）**：原登记「等他会话 UI 迁移 WIP 全部入库」过硬——本轮实测脏件集中在 `framework/src/core/ui`（4）与 `games/beads/src/{ui,view}`（+镜像），而 **`core/render/**` 与 `adapters/**` 一个未被触碰** ⇒ **P0 框架腿不撞车，已开工并入库（WXG-T-327）**；**P1（弹窗内容搬进容器）与 P2（输入逆序）仍须等其 WIP 入库**，否则同层双写。

## 5. 用户裁定（2026-10-20，原话存档）

- **Q1 分期 = 确认**。四批不变：P0 框架容器语法 + 两端层树映射 → P1 弹窗内容搬进容器（解开 `dialog-center.test.ts` 里 skip 的层序例）→ P2 输入按容器逆序透传（接 `blocksBelow`）→ P3 机械守 + 设备层序判据 + 金样本重抓登记。
- **Q2 容器粒度 = 含 `hud` / `toast` 段**。⇒ 已重写 DEC-2（段为枚举 + 默认段兜底）与 DEC-3（层树 = 容器 × 段 × 通道，`Graphics` 预估 ≤ 6），并新增 DEC-9 降级杆。⚠ 代价登记：比「只到 page/modal」多一层通道拆分 ⇒ draw call 预估由 2 升至 ≤6，**P0 必须实测而非按预估过关**（真机低端机由 Fill Rate 主导，K-030 同族旧训）。
- **Q3 过渡态 = 维持止血观感**。P1 完成前菜单侧弹窗保持「不透明底（没半透）」，⛔ 不得用任何补画糊它（`meta-view` 弹窗分支注释已写明）。

### P0 交付记录（WXG-T-327）

**已落（均有反证，可单测）**：

- 语法（`core/render/render-model.ts`）：`UiSegment` + `UI_SEGMENT_ORDER`（唯一序表，⛔ 不得在 adapter/视图再抄一份）+ 四个 kind（`container` / `containerEnd` / `segment` / `segmentEnd`）+ 四条 builder 方法；新 kind 自动进 `signature()`（它逐字段遍历）⇒ 脏帧门控看不见层级变化这类坑已堵。命令体不带几何 ⇒ 不进顶点归区。
- 两端映射（`adapters/cocos/cocos-renderer.ts`）：新增 `CocosUiScopeLike` / `CocosUiScopeHostLike` 与 `options.scopeHost`；**未注入宿主 ⇒ 四 kind 静默忽略、旧单层路径逐字不变**（breakout 与一切未接线宿主零漂移）；矢量与文字按当前作用域落笔；段命令只切层不产像素。
- DEC-5：`CocosLabelLike.setSiblingIndex?`（可选，不提供则行为同旧）+ 帧内计数，**换作用域重新归零**。
- 预算实测出口：`lastScopeCount` = 本帧**真正落过笔**的作用域数（只 `enter` 而未画东西的不计 ⇒ 不虚报）；无宿主恒 1。

**故意未落（收窄项，归 P1）**：`bindings.ts` 的 cc 节点树（容器×段子树 + 位图腿归属）。理由：这条腿的真伪只能由设备证（画布叠序、节点序、draw call 实数），无编辑器时写它 = 交不行也证不行的代码；P0 因此对真机 **零行为变化**（连宿主都未注入）。⇒ ⛔ 不得把本 ADR 标为已实施：设备侧层级仍未修（P3 读数前），只是现在有了能表达层级的语法。

**测数**：framework 45 文件 **491 passed**（新增 6 例）；反证 = 把作用域解析置空 ⇒ 路由 / DEC-5 / scope 计数 3 例全红（按 sha 逐字节还原）；beads 1137 + 3 skip（金样本十态零漂移）、breakout 239、三包 typecheck 0。

### P1 可证部分交付记录（WXG-T-328）

- 新增 `adapters/cocos/ui-scope-tree.ts`（**无 `cc` ⇒ Node 可测**，进 barrel）：`UiScopeTree implements CocosUiScopeHostLike`，宿主只注入 `UiScopeTreeHooks`（`root` / `defaultScope` / `defaultBlitParent` / `create(key, parent, siblingIndex)`），`siblingIndex` 由内核算定 ⇒ ⛔ 宿主不得自行决定序（否则两处真源）。
- 内核把本 ADR 的四条排序规则变成可执行（各带单测，共 9 例）：**懒建**（`enter` 不落笔不建层，与 `lastScopeCount` 同口径；唯一例外 = 建段须先有父容器层）、**容器序 = 出现序**（首次出现定兄弟位、跨帧复用不重排）、**段序 = `UI_SEGMENT_ORDER` 枚举序而非绘制先后**（DEC-3 的核心，也是 Cocos 把指令序压成通道序那类缺陷的反面）、**段挂在容器之下**（用父子序代替 zIndex，DEC-4）；越界与不配对不抛、不误建层。
- **接口修订**：`CocosUiScopeHostLike.exitScope()` 拆为 `exitContainer()` / `exitSegment()`——单一出栈分不开「出段→回本容器默认段」与「出容器」，P0 合一写法会把退出语义埋错；彼时宿主接口尚无生产消费者 ⇒ 零外溢。
- ⛔ 仍未接（P1 剩余半段）：`bindings.ts` 的 cc 工厂薄壳 + 视图发层级命令 + 真机层序读数。故本行不代表缺陷已修。

### DEC-8① Node 侧层序守门轨（WXG-T-329 · 战线一接线前铺好）

- 新增 `core/render/ui-container-order.ts`（**无 `cc` ⇒ Node 可测**，进 barrel）：`checkUiContainerOrder(commands) → string[]`，单次线性扫描校验容器 / 段命令流的**结构良构**——begin/end 配对、**容器不重叠/不嵌套**（⇒ 每容器连续成块 ⇔ DEC-8① 第一句「容器 A 全部命令索引 < 容器 B」）、段只在容器内且不叠套（DEC-2）、退出不悬空。8 例单测（正 + 空流 + 6 反证，逐条钉具体违规串）。
- **与内核分工**（不重复）：`UiScopeTree`（WXG-T-328）管 enter/exit 的**排序行为**（兄弟位怎么算）；本门管视图**吐出的命令流是否良构**（前提不成立则内核再对也白搭）。二者合起来才是 DEC-8① 要的设备无关替身。
- ⚠ **诚实边界**：视图现在还不发容器命令（战线一未做）⇒ 本门当前只咬人造样本；战线一把弹窗内容搬进容器后，把它指向真帧（金样本 / 采样帧）即自动生效，无需改门。**本门单独不消缺陷**。
- ⛔ 战线一（排期中，需真机取证）= 弹窗视图发 `beginContainer`/`beginSegment` + `bindings.ts` cc 节点层树薄壳 + `build:cocos` 发到在线鸿蒙真机实拍层序 + 金样本按容器重抓（先登记 sha）+ 解开 `dialog-center.test.ts` 那条 skip。见 TASKS `## WXG-T-329` 遗留。


### P1 设备腿交付记录（WXG-T-437 · 2026-10-27）

**已落（`build:cocos` 两游戏 CLI 构建绿 = cc 侧可编译；真机读数仍缺）**：

- **cc 薄壳（`adapters/cocos/bindings.ts`）**：`_buildGraph` 末尾建 `UiContainers` 节点（root **最后一个**子节点）并 `new UiScopeTree({ root: UiContainers, defaultScope: 主 Graphics + 主标签池, defaultBlitParent, create })`，`_bindRenderer` 注入 `options.scopeHost`。⇒ 整棵容器树恒在默认五通道（含 `Labels`）之后，弹窗容器自带三通道压住底页文字/位图腿。
- **节点结构（`_createScope`）**：`UI:<key>` → `Graphics`（父自身组件，先于子节点）+ `BlitLayerUI` + `Labels` + **`Segments`**。`Segments` 必须是独立子节点并作为内核 `handle` 返回：段按 `UI_SEGMENT_ORDER` 用 `setSiblingIndex(0..3)` 落位，若与上面三条通道同父，`setSiblingIndex(0)` 会把段插到自己默认段的通道**之前**（段被自己的默认段盖住，DEC-4 反例）。兄弟位仍全由内核算（⛔ 宿主不自行决定序）。
- **视图腿（`UiRoot.draw`）**：只对 `route.kind === 'modal'` 发 `beginContainer(route.name)` / `endContainer()`。页面路由**不进容器**（默认五通道恒在容器树之下 ⇒ 语义等价 DEC-9② 「弹窗与页面合一个容器」的降级杆，但零改动菜单页 19 处位图腿归属与裁切蒙版）。
- **弹窗自持绘制（DEC-1 撤代职）**：`phase-route-binder` 的三条 modal 路由改为 `draw: (b) => drawers.modal(b, name)`（不再 `noop`）；新增 `meta-view::buildMetaModal`（非弹窗态早退）；`buildMetaView` 改为只画**底页**（弹窗态 ⇒ 主菜单）⇒ WXG-T-324 的半透观感随容器层正式恢复（不再是「补画底页」那种赌通道序的做法）。⚠ `BASE_PAGE` 用表查而非 `overlay ===` 串判（`check:arch` §20-3 硬门，K-144）。
- **验收**：`dialog-center.test.ts` 的层序例**解 skip**（遮罩之前主菜单图元 > 100）+ 新增 1 例（容器在册 / 遮罩落在容器内 / `checkUiContainerOrder(cmds)` 为空）；`ui-root` 与 `phase-route-binder` 的 mock 断言改为验证「只对 modal 包容器」与「弹窗自持绘制」。framework 538 绿、beads 除金样本外全绿、`check:arch` OK、`framework:sync:check` 绿、`build:cocos` 两游戏绿。
- **金样本**：`settings` 25→**5665**、`signin` 28→**5668**（底页入流 + 2 条容器命令），其余九态 sha 逐字未变；按 K-051 / K-053 先登记再重抓（`ui-golden-capture.ts`，提交锚）。
- **⛔ 仍未取（`[R]`）**：真机层序实拍（同层文字与位图腿必须被遮罩压住）+ draw call 实测（DEC-3 预估 `Graphics ≤ 6`）。⇒ 本 ADR ⛔ 仍不得标「已实施」；缺陷状态 = 「已修待设备证」。
- **已知边界（本轮显式不做）**：① 容器内的 `blit` 仍由载体按自身白名单挂 `BlitLayerUI`（`UiScopeTree.blitParent` 已按作用域给出，但 `CocosBlitCarrierLike` 尚无该形参）—— 现网弹窗内容 0 处 `blit`，故无影响；② 调试层（`drawPerfOverlay`）仍落默认层 ⇒ 会被后出现的弹窗容器盖住，属上文 S1「DebugLayer 必须永远在最顶」待定项。

### 三项显式未做收口记录（WXG-T-438 · 2026-10-27）

承接 §P1 设备腿交付记录里登记的「已知边界 ①②③」，三条全部收口：

1. **位图腿按作用域递（补 DEC-3 缺口）**：`CocosBlitCarrierLike.accept(cmd, x, y, blitParent?)` 加**可选**第 4 参（`unknown`，框架不解读），`CocosUiScopeHostLike` 加可选 `blitParent`，`draw()` 的 `blit` 分支传 `scopeHost.blitParent`。宿主（`beads-blit-carrier`）：静态位图腿（above）用 `scoped ?? _uiLayer`；**珠腿（below）仍恒留全局 `BlitLayer`**（DEC-7 世界层不容器化）；clip 态仍优先 `_clipLayer`。形参可选 ⇒ 未接作用域的宿主（breakout）逐字节不变。
2. **调试层恒在最顶（§S1 定稿）**：`UiScopeTree` 加 `topMost?: string` + `raise?(scope)` —— 该容器建层时兄弟位取哨兵 `UI_SCOPE_TOP_MOST_SIBLING`（宿主**必须 clamp 到末位**），并每次 `enterContainer` 重压末位（后来新建的容器是 `addChild` 追加）。**⛔ 不采用「谁后出现谁在上」的做法**：容器序是首次出现序、跨帧不重排，做不到「永远最后」。序仍由内核决定，宿主只按给定值落位。接线：`bindings` 登记 `topMost = UI_DEBUG_SCOPE_ID`（`'__debug'`，新增导出常量，视图只发这一个 id）；`UiRoot.draw` 在 `d.enabled` 时包 `__debug`；`meta-view` 的 `drawSafeGuides` 同样包 `__debug`。关闭时零命令 ⇒ 生产零开销、金样本零漂移。
3. **对局面板层容器化（DEC-1 覆盖对局腿）**：`view-model::buildBeadsView` 用 `hasPanelOverlay(snap)`（**保守上界**：宁可多开空容器，不可漏开 —— 空容器懒建、不落笔就不建层）决定是否发 `panel` 容器边界，把彩带/面板整串包进去。⇒ 暂停与结算遮罩连同面板文字整体压在玩法页之上，**HUD 文字不再浮在遮罩上**（`WXG-T-325` 同族缺陷的对局腿）。容器内通道序与旧默认层同构，故容器内部逐字等价。
   - **验收坑**：首版谓词写 `snap.rankPanel !== undefined` ⇒ 恒真（`snapshot-projection` 每帧赋 `rankPanel.view()`，关闭态是 `CLOSED_RANK_VIEW`）⇒ play 态也开容器、封箱基准 `frame0` Δtotal=2 报警。改用 `snap.rankPanel?.visible === true`（= `drawRankPanel` 的早退条件）后 play 与封箱基准零漂移。
- **读数**：framework 540 绿（+2 例 `topMost`）；beads 1351 绿（除金样本五态）；`check:arch` OK；`build:cocos` 双绿；金样本 `pause`/`clear`/`fail`/`sprint-settle`/`finish` 各 +2，`play` 零漂移。
- **⛔ 仍 `[R]`**：真机层序（对局暂停遮罩压住 HUD 文字）+ 容器内位图腿落位 + draw call 实测 ⇒ ADR 仍不得标「已实施」。

### 尚待后续定的小项（不阻塞 P0）

- **S1 段枚举是否需再加 `debug`**：安全区标定线与性能覆层现走 `DebugLayer`，它必须永远在最顶。推荐复用 `toast` 之上的隐式末位，P0 定稿。
- **S2 跨容器段序**：段只在容器内起作用、容器序优先（DEC-1/3 已定）；HUD 若需被另一容器的 toast 压住，只能靠「toast 所在容器在栈顶」实现 ⇒ P1 接线时逐个验证，不在 P0 提前扩语义。
