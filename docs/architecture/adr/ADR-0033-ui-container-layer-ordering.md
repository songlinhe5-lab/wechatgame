# ADR-0033 · UI 容器层：每页面 / 每弹窗一个渲染容器，容器内层有序、事件按层逆序透传

- **状态**：Accepted（原则由用户 2026-10-20 真机裁定：「每个页面和对话框是一个 UI 容器，里面按照层级绘制，事件按照层级透传；层级是一个顺序关系，不能错乱」）；**实施分批待裁**（见 §5 Q1–Q3）
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
- **DEC-2 RenderModel 增加容器语法**：`beginContainer(id)` / `endContainer()`，与既有 `clip` / `unclip` 同族（成对出现、允许嵌套但本批只嵌套一层）。未知该 kind 的 adapter **忽略即可** ⇒ 向后兼容，breakout 与既有场景不受影响。
- **DEC-3 Cocos 映射**：每容器一个子树 `Container_i`，内含 `Graphics_i`（+ 可选 `back Graphics_i`）、`BlitLayerUI_i`、`Labels_i`，顺序即 DEC-1 的容器序。珠层（`BlitLayer`）**保持全局单层**，见 DEC-7。预算口径：可见容器 ≤ 3 ⇒ `Graphics` draw call ≤ 3（每容器再加 1 个 Label 父节点），不会出现「逐图元一节点」的 draw call 爆炸（这正是当年单 `Graphics` 决策的理由，`cocos-renderer.ts` 头注）。
- **DEC-4 层序 = 容器序 + 容器内指令序，⛔ 不引入 zIndex**。沿用现有约定「子节点序 = Cocos UI 绘制序」；zIndex 会成为第二份真源。
- **DEC-5 同层文字叠序确定化**：`_drawText` 每次 acquire 后按「帧内第 n 条 text」设 sibling 序；池复用只影响节点身份，不影响叠序。
- **DEC-6 事件按层逆序透传**。输入自栈顶向下遍历容器：命中 modal 容器内 ⇒ 消费并阻断；容器外（遮罩区）按该弹窗的 `dismissOnScrim` 策略决定 `dismiss` 或 `block`（`modalHitTest` 现有语义保留）。落地前提是导航侧已是真源（ADR-0032 DEC-3「栈即导航状态」），本批把 `blocksBelow` 真正接到输入腿。
- **DEC-7 珠 / 对局世界层不容器化**：棋盘 tile 与珠位图属世界层，恒在 UI 容器之下（保留 WXG-T-256 / ADR-0030 层序）。这也是局内暂停面板一直正常的原因。
- **DEC-8 验收必须含设备侧层序**：① Node 侧新增机检 —— 对 RenderModel 断言「容器 A 的全部命令索引 < 容器 B」且「遮罩在容器内先于面板与文字」，纳入 `check:arch`；② 真机判据写入 `production/qa/beads/device-walkthrough.md`（同层文字与位图必须被遮罩压住），`[R]` 未取读数不得关单。金样本按容器重抓（指令流多出容器边界），sha 变化须先登记（K-053）。

## 3. 备选与取舍

| 案 | 内容 | 拒因 |
|---|---|---|
| 甲 | 只加一条 `barrier` 指令（把 `Labels` / `BlitLayerUI` 拆成 Base/Modal 两层） | 只救「遮罩 vs 顶部两通道」这一处；容器仍不是渲染单元、事件仍靠标志位 ⇒ 不满足「层级是顺序关系」这条原则，同类缺陷会在 HUD / toast / 转场处再冒 |
| 乙 | 每条命令带 `layer` 字段（`page` / `modal` / `hud` / `toast`） | 表达力最强，但 `Graphics` 也得按 layer 拆（每层一个 draw call），且视图层每一处都要标 —— 漏标即错乱，机检难覆盖 ⇒ 改动面与风险最大 |
| 丙 | 弹窗期底页只发矢量（不发 text / blit），做「剪影底」 | 零框架改动、观感是假半透（菜单缺字缺图），违背「层级清晰」；留作 P1 万一 draw call 不达预算时的降级杆 |
| 丁 | 只回退不重构（= 当前 WXG-T-325 过渡态） | 设备恢复「没半透但不错乱」，缺陷仍开 ⇒ 只作为过渡态，不是终态 |

## 4. 后果

- **改动面四件同批**：`packages/framework/src/core/render/render-model.ts`（容器 kind + builder 方法）→ `adapters/canvas2d/canvas2d-renderer.ts`（忽略或分组）→ `adapters/cocos/{bindings,cocos-renderer}.ts`（按容器建层树 + sibling 序）→ `games/beads/src/ui/*` 与 `view/meta-view.ts`（弹窗内容搬进容器）。
- **成本**：节点与 draw call 增加，需读数（harness 计数 + 真机 DG 性能基线）；不达则用降级杆（丙 或 容器合并）。
- **金样本**：容器边界进入指令流 ⇒ 十态 sha 预期变化，先登记再重抓；`dialog-center.test.ts` 里 `skip` 的层序例在 P1 完成后解开。
- **守则扩条**：`control-manifest §20` 与 `ui-architecture-beads §8` 需加一条「**容器即渲染单元**：`modal` 路由必须自持 `draw`；⛔ 页面视图分支不得代画弹窗」。
- **⚠ 并发前置（硬）**：`src/ui/ui-root.ts` / `ui-host.ts` / `view/modal-frame.ts` / `play-page.ts` 等 **44 个文件正被另一会话改写**（UI 架构迁移在途）。本批 **必须等其 WIP 入库后再开工**，否则同一层双写；开工前先跑 `check:arch` + `framework:sync:check` 确认落点未漂移。

## 5. 待用户裁定

- **Q1 分期**（建议四批）：P0 框架容器语法 + 两端层树映射（可独立验收：容器边界进 RenderModel、Cocos 建层）→ P1 弹窗内容搬进容器（`meta-view` 拆分，解开 skip 的层序例）→ P2 输入按容器逆序透传（接 `blocksBelow`）→ P3 机械守 + 设备层序判据 + 金样本重抓登记。是否按此拆？
- **Q2 容器粒度**：只到 `page` / `modal`（推荐，够用且 draw call 可控），还是要到容器内的 z 段（`page` / `hud` / `modal` / `toast`）？后者即「乙案」的一部分，要付 Graphics 拆层代价。
- **Q3 过渡态**：P1 完成前，菜单侧弹窗维持「不透明底（没半透）」这一止血观感，还是宁可先接受「层级错乱但能透」换一次真机验证？（推荐前者：错乱比不半透更伤。）
