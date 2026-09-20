# ADR-0014 — RenderModel 全局变换通道：builder 扩接口，adapter 各自落地，视图不 workaround

- 编号：ADR-0014（0008 跳空合规沿 ADR-0013 注；0009–0013 已用）
- 状态：**Accepted**（2026-09-17，WXG-T-132 · T-128 拆分⑤「G5 连击 Lv2 伪震屏」；授权来源 = **用户裁定 2026-09-16 案 B**，登记于 `art-bible §7.3.5`，案 A 作废且不作降级预案）
- 关联：`art-bible §7.1` Lv2 行 / `§7.3.5`（规格正本）、`ux-spec §5`「连击 ×3（Lv2）」150ms（毫秒真源）、`systems-index §3.8` 红线（无真位移震屏、≤3Hz）、`score-combo §2.5`、WXG-T-074（历史缺口登记，本单收口）、ADR-0002（core 引擎无关）、ADR-0011（屏幕坐标契约）
- 冻结常量：**零改动零新增**——幅度峰值 `COMBO_SHAKE_SCALE_MAX = 1.015`、时长 `COMBO_VFX_LV2_MS = 150` 均为既有值；本 ADR 不携带任何数值规格。

## 1. 上下文（Context）

beads G5（连击 Lv2「伪震屏」= 整屏 scale 1.00→1.015→1.00，锚点=屏幕中心，150ms，无位移无旋转）**值已算对并单测覆盖**（`combo-vfx.ts::comboPseudoShake`），但呈现层写不出来：`RenderModelBuilder` 只暴露逐图元 push（`_commands` 私有），`RenderModel` 仅 `{ background?, commands }`、**无变换语义位**（WXG-T-074 登记）。视图侧的处置是 `'pseudoShake'` 分支显式空实现——**不假造替代画面**。案 A（全场 filled 珠齐脉冲）已被用户裁定作废，理由是冲击感打 6 折、与 G4 撞形态、且埋下「规格写整屏、实现做珠面」的假绿种子。

**落码前置验证项（任务书明令「先给结论再动接口」）**：`FIXED_WIDTH` 下整屏放大 1.015 是否露黑边？结论（纸面可证部分）：

1. **锚点必然 = 屏幕中心**：两 adapter 的内容都经「设计矩形居中」映射——canvas2d 走 `Viewport` letterbox（`offset = (screen − view)/2` ⇒ 设计矩形中心 ≡ 屏幕中心）；Cocos 走 `−designW/2, −designH/2` 居中换算 + `GameRoot` 节点原点恒在 Canvas 中心（Bootstrap 有 (0,0) 校验）。故设计中心 (375, 667) 在两处都精确落在屏幕中心。
2. **scale > 1 关于屏幕中心 ⇒ 覆盖单调不减**：`p' = a + (p − a)·s`，`s = 1.015` 时设计矩形四边全部**径向向外**移动（半宽 375→380.6、半高 667→676.9），任何原本被内容覆盖的像素仍被覆盖；溢出部分由画布/引擎视口裁剪。**露黑边 = 0，且无需外扩补边**——前提是**背景层参与全局变换**（本决定采纳：变换先于 background 下发，见 §3）。
3. **高屏（可见高 > 1334）下上/下沿原有无内容带**：属既有现状（视图只画设计矩形），变换只会让内容带**变宽**（例：20:9 底部空带 83px → 峰值 73px），不产生新黑边。
4. **不可纸面闭合的部分（诚实登记，不写成已解决）**：真机（Cocos 构建阻塞，ADR-0009 P2）下 1.015 缩放引入 HUD 文字与 1px 描边**亚像素抖动**（`art-bible §7.3.5` 观察项，非闪烁、D2 不计）⇒ 落码后真机抽检 B1/E1 观感仍是未执行项；横屏/平板等可见高 < 设计高的非目标场景不在验收面内。

## 2. 备选方案（Alternatives）

**方案甲（采用）：`RenderModelBuilder` 加全局变换通道，`RenderModel` 承载可选变换位，两 adapter 各自实现**
- 事实：接口扩张一处、语义单一（**只给 uniform scale + 设计空间锚点，不给位移/旋转**——G5 红线「无位移」在类型层落实，沿 `ComboPseudoShake` 无 dx/dy 字段的判例）；canvas2d 用 ctx 矩阵复合（`translate→scale→translate`，叠在 fit 矩阵之后 ⇒ 与设计坐标语义无关）；Cocos 用 **GameRoot 节点缩放**（`bindings.ts` 宿主：`p' = p·s + a'(1−s)` ⇒ `setScale(s)` + `setPosition(a'(1−s))`）。
- 成本：公共接口变更 ⇒ 全矩阵回归（framework + beads + breakout + harness）；Cocos 半为编辑器外不可验证代码（⚠ 标注）。

**方案乙：视图侧逐图元坐标映射（不改框架）**
- 事实：`buildBeadsView` 里把每条命令的 x/y/w/h/r 手动乘 scale——1620 行视图、20+ 绘制函数、命令字段各异，且 polygon 点列、文本 anchor、lineWidth 都要各自处理。
- 否因：这正是 WXG-T-074 明令禁止的 workaround（「工程单须以**扩接口**收口，否则同一缺口会在下一条整屏动效上复发」）；散布 20 处的乘法是长期错漏面，且 Cocos Label 位置/字号仍需第二套。

**方案丙：Cocos 侧渲染器内做坐标级变换（不碰 bindings）**
- 事实：`cocos-renderer.ts` 内对所有命令做 `a + (p−a)s` 坐标映射可绕开编辑器半。
- 否因：text 命令必须逐帧 `setFontSize(size·s)` ⇒ cc.Label TTF 重排版开销与闪烁风险；`w/h/r/lineWidth` 逐字段乘系数使「视觉整屏 scale」与命令数据不一致（快照差分测试会被污染）；且 canvas2d 走矩阵、cocos 走坐标 ⇒ 两 adapter 语义漂移。节点缩放一处生效、全内容忠实。

**方案丁：用户已裁废的案 A（全场珠齐脉冲）**：不再评估，留档于 `art-bible §7.3.5`；若案 B 被驳，Lv2 **维持不呈现**，不得回落案 A。

## 3. 决定（Decision）

1. `packages/framework/src/core/render/render-model.ts`：
   - `RenderModel` 增可选字段 `transform?: RenderTransform`（`{ scale, anchorX, anchorY }`，设计空间、均匀缩放、语义 = `p' = a + (p−a)·s`）；缺省 = 恒等，**旧模型逐字节不变**。
   - `RenderModelBuilder` 增 `setTransform(scale, anchorX, anchorY)`——**标量入参**（任务书「如 `setTransform({…})`」的「如」按零分配原则落为标量，对象入参在激活帧每帧多分配一个参数对象）；`begin()` 复位恒等；`end()` 仅当 `scale !== 1` 时产出一个冻结小对象 ⇒ 恒等帧零新增分配，激活帧的分配与 `end()` 既有模型对象同生命周期。
2. **背景层参与全局变换**（先变换、后画 background）：由 §1 证明 2，这是「零露黑边、无补边」成立的承重前提，写进 renderer 注释防后改。
3. canvas2d adapter：fit 矩阵之后复合三次 ctx 调用；无 `transform` ⇒ 路径与旧完全一致。
4. Cocos adapter：纯渲染器加 `CocosRendererOptions.transformHost`（结构接口 `applyFrameTransform/resetFrameTransform`，逐帧幂等分派）；宿主实现住 `bindings.ts`（编辑器半，⚠ 标注沿该文件纪律）。未接宿主的调用方（breakout）行为不变。
5. beads 消费：`buildBeadsView` 头部——`comboVfxKind === 'pseudoShake' && progress > 0 && !reduceMotion` 时以 `comboPseudoShake(p).screenScale` 设变换，锚点 `(DESIGN_W/2, DESIGN_H/2)`；**L5 不破**（scale 由快照标量经纯函数推导，view 不持状态；game 侧时序零改动）。D1 = 整条关停（不设变换）。
6. 铁律合规：L2 保持——core 只加纯数据字段，`cc` 仍只在 `bindings.ts`；热路径零分配按第 1 条执行；图元增量 +0（`art-bible §7.3.5`）。

## 4. 后果（Consequences）

**正面**：G5 规格原样落地（1.5% 真·整屏脉动，视觉损失零）；WXG-T-074 收口，后续整屏级动效（如 G8/G9 类需求）有正规通道，不再攒 workaround。

**负面（必须诚实）**：
1. **输入不随变换走**：震屏 150ms 窗口内点击坐标按未变换设计空间路由 ⇒ 目标最多偏移 1.5%（格宽 52 的 0.78px）。接受，但这是实装语义不是「无副作用」。
2. **`RenderModel` 是 breakout 共用契约**：字段可选、旧路径逐字节不变，但回归面 = 三包测试 + harness，跑绿前本单不算完。
3. **Cocos 半不可本地验证**：`bindings.ts` 变换宿主与真机亚像素抖动一样，卡在 Cocos 构建（ADR-0009 P2）⇒ `[Cocos]` 项不得判 PASS，TC-PER-27 整条挂「真机待执行」。
4. **harness 视觉差分口径变化**：命令序列断言不受影响（变换不是命令），但任何未来做像素级快照的门禁须感知 150ms 震屏窗口。
5. 恒等帧与激活帧走两条 `end()` 分支（`scale !== 1` 判断）——若未来出现 scale<1 需求（内缩），本接口能承载，但「背景参与 ⇒ 零黑边」证明不再适用（s<1 会露边），届时须重开 ADR。

## 5. 复评（Review）

- 触发复评的条件：① 出现 scale<1 或位移/旋转需求；② 真机亚像素抖动被裁定不可接受（备选 = 震屏窗口内隐藏 1px 描边类元素，属规格变更归 art）；③ breakout 需要整屏变换时复核宿主接线；④ 输入偏移若在 playtest 中被感知（当前估算 <1 格宽，预期无感）。
- 定期回看：下一次动效类工程单立项时检查是否复用了本通道（复用 = 成例生效）。
