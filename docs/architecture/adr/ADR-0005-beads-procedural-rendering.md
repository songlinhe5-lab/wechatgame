# ADR-0005 — beads 渲染：全程序化每帧 RenderModel，离屏缓存延后

## 1. 上下文（Context）

assets-spec §0 冻结"渲染方式 = Cocos `Graphics` + 纯色 Sprite，不加载任何外部图片"；§1.1 定义单颗珠 = 6 层矢量绘制（投影/主体/暗倒角/亮倒角/高光/符号），10 色 × 6 状态矩阵，全程序化。矩阵级架构（ADR-0002）规定玩法层只产出 RenderModel 绘制指令、由适配器消费。最坏规模：13×12=156 珠 × 6 层 ≈ 900+ 指令/帧，加上托盘/HUD/面板。需决定指令生成策略：每帧全量重建，还是对静态珠子做离屏缓存（预渲染为纹理再 blit）。

## 2. 备选方案（Alternatives）

**方案 A：全程序化、每帧重建 RenderModel（现状能力直用）**
- 事实核对（已读码）：`core/render/render-model.ts` 的 `RectCommand` **已含 `radius`（圆角）与 `alpha`**，`CircleCommand`/`LineCommand`/`PolygonCommand` 齐备——六层参数卡逐层映射无缺口；唯一缺口是虚线描边（扩展槽 dash 6/4），可由 view 层按周期切成短线段合成，零框架改动。
- 代价：每帧 ~900+ 指令的对象构建与 GC 压力（RenderModelBuilder 支持 scratch 复用，可控）；Cocos 侧单 Graphics 每帧 clear+重画的开销**未在真机验证**。

**方案 B：离屏缓存（每 (色,状态) 组合预渲染一次到纹理，运行期只 blit）**
- 事实对比：运行期指令数骤降到 ~200（156 blit + HUD）；但 60 组合 × 首帧预渲染引入启动耗时与纹理内存（60 × 66² px ≈ 0.5MB，可接受）；需要 Cocos `RenderTexture`/离屏 Canvas 支持——canvas2d 适配器易做，Cocos 适配器需新增能力（动 bindings.ts，验证风险叠加 G1–G9）；动画态（hint 呼吸、wrong 抖动、落座 pop）仍需每帧叠加动态层，缓存只覆盖静态部分。

**方案 C：混合（静态层缓存 + 动态层每帧）**
- 事实对比：性能上限最好；复杂度最高（两层合成、脏矩形管理），demo 阶段 8 关 × 156 格规模下**收益未经测量**，属过早优化。

## 3. 决定（Decision）

选**方案 A**：demo 全程序化、每帧重建 RenderModel；dash 描边在 view 层用线段合成；不改框架任何代码。真机性能不达标时再按 §5 触发条件升级到方案 C（方案 B 单独不完整，动画态仍需动态层）。

## 4. 后果（Consequences）

**4.1 正面**
- **零框架改动、零适配器改动**：canvas2d harness 与 Cocos 走同一条已验证路径，dev harness 即刻可视化（无编辑器也能看画面）。
- 六层参数卡是**纯函数**（bead-render.ts：输入 (colorIdx, state, 几何) → DrawCommand[]），可快照测试、可逐层断言（线宽 ≥2px、高光 ≥0.26×BEAD 等美术红线在生成时断言）。
- 表现层态（hint/wrong/selected）与逻辑态解耦自然成立（每帧重算即天然只读）。

**4.2 负面（已知成本，如实记录）**
- 满格最坏 ~900+ 指令/帧，低端 Android 的 Graphics 重建开销**未知**——这是本决策买"简单"付出的明确代价，不是风险。
- 每帧构建指令列表的 GC 压力依赖 RenderModelBuilder 的 scratch 复用纪律（控制清单热路径零分配），漏用即抖动。
- 将来切图集（assets-spec §3 v1.1 预留）时，bead-render.ts 整层重写（约 200 行），玩法层不动。

**4.3 中性 / 待观察**
- RenderTexture 方案 C 的真实收益需真机 profile 数据支撑；canvas2d 与 Cocos 的缓存实现不共享，届时是两份适配器工作。

## 5. 复评触发条件（Review Triggers）

- 真机（低端 Android）帧率 < 30fps，且 profile 指向 Graphics 重建 → 启动方案 C（静态层缓存）。
- 业务代码（含程序化绘制）超包体预算 400KB（systems-index §3.9）→ 复评绘制代码密度。
- 引入粒子/拖尾类新 VFX 使指令数倍增 → 提前触发复评。
- Cocos 适配器验证完成（EP-10）后如 G2（Graphics 签名）缺口与方案冲突，优先保 ADR-0003 空场景路径，再议缓存。
