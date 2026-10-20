# ADR-0033 · UI 容器层：每页面 / 每弹窗一个渲染容器，容器内层有序、事件按层逆序透传

- **状态**：Accepted（原则由用户 2026-10-20 真机裁定：「每个页面和对话框是一个 UI 容器，里面按照层级绘制，事件按照层级透传；层级是一个顺序关系，不能错乱」）；**Q1–Q3 已由用户 2026-10-20 裁定（§5）⇒ 方案定稿；P0 框架腿已入库（WXG-T-327，交付面见 §5 P0 记录），P1 / P2 受 §4 前置约束**
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

### 尚待后续定的小项（不阻塞 P0）

- **S1 段枚举是否需再加 `debug`**：安全区标定线与性能覆层现走 `DebugLayer`，它必须永远在最顶。推荐复用 `toast` 之上的隐式末位，P0 定稿。
- **S2 跨容器段序**：段只在容器内起作用、容器序优先（DEC-1/3 已定）；HUD 若需被另一容器的 toast 压住，只能靠「toast 所在容器在栈顶」实现 ⇒ P1 接线时逐个验证，不在 P0 提前扩语义。
