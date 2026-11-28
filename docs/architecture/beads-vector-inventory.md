# Beads 矢量负载清单

> 附属于拖动掉帧归因（WXG-T-1122）。用途：回答「矢量绘制是否比位图绘制更费时」「哪些矢量逻辑值得换轨」。
> 本件是**责任边界清单与判据索引**，不是新验收判据；不改冻结常量，不替代设计裁定。

## 1. 结论摘要

- 在同一帧的宿主墙钟里，矢量段确实更贵：放大拖动样本为 `矢 11.2ms / 位 2.3ms / 文 0.4ms / 余 0.7ms`，`drawMs 15.0ms`，矢量约为位图的 4.9 倍。
- 但这只说明**当前场景、当前宿主实现**的矢量段更贵，不能推出「所有矢量都该换位图」。渲染架构文档早已登记两个未裁假设：填充面积与 alpha 层数为主瓶颈（H-FILL），还是每帧重建矢量几何为主瓶颈（H-CPU）；单变量臂矩阵从未执行（见 [`ADR-0030 §5.0`](adr/ADR-0030-beads-cocos-production-blit-carrier.md#50-s0性能评估先行批2026-10-05-用户裁定新增-前置于-dec-1)）。
- 另有两笔更便宜的账：静置 150 帧里只有 3–4 帧模型发生变化，其余都在重放同一份几何（K-100）；放大后 `camZoom` 并不进入视图几何，代价来自同一批矢量覆盖面积变大，而不是顶点变多（见 [`play-page.ts:267`](../../games/beads/src/view/play-page.ts#L267) 与 `:486` 起的格循环）。
- 因此优先级是：先砍无效重放，再复用已有的描边静态层，最后才按 A/B 结果做局部资产换轨。

## 2. 读数口径与量级锚点

| 段 | 宿主实际计时的内容 | 出处 |
|---|---|---|
| 矢（`vectorMs`） | `rect` / `circle` / `line` / `polygon` 的路径写入 + `fill()` / `stroke()`，逐命令累加 | [`performance.ts:337-349`](../../packages/framework/src/core/performance/performance.ts#L337-L349)、[`cocos-renderer.ts:419-425`](../../packages/framework/src/adapters/cocos/cocos-renderer.ts#L419-L425) |
| 位（`blitMs`） | 位图载体 `accept(...)` 内的节点属性更新 / 纹理绑定 / 上传 | 同上 |
| 文 / 余 | 文字借用与测宽；帧首清屏、容器/段/裁切切换、变换、底图提交体 | 同上 |

四个数字是**同帧墙钟毫秒**，不是 GPU 片元耗时；K-225 另提醒「帧耗时稳定」不能证伪卡顿，卡顿来自位移在时间轴上的分布。

量级锚点：

- 架构文档 S0 表：矢量基线约 2031 命令、21917 三角、3.0–3.5ms；位图臂约 479 命令、182 三角、0.9–1.6ms。两臂**命令数不同**，混有「换模型」收益，不能当纯载体对比（K-100③）。
- 金样夹具一帧：对局态 578 条矢量命令（`rect 258 / polygon 156 / line 101 / circle 63`）、0 条位图；选关态 4832 条矢量命令。夹具**未注入** tint 运行时，因此读的是矢量回退臂，不代表生产命令数。
- 生产侧确实注入了 tint 运行时（[`beads-blit-carrier.ts:420`](../../games/beads/cocos/assets/scripts/host/beads-blit-carrier.ts#L420)），珠、格底、空槽常态走位图；对局页剩余矢量以轮廓、反馈、HUD、面板为主。

## 3. 对局页矢量发出点（按每帧量级粗排）

| 层 | 位置与画的内容 | 频率 | 已有位图路径 / 换轨阻碍 |
|---|---|---|---|
| 格循环 | [`play-page.ts:561-889`](../../games/beads/src/view/play-page.ts#L561-L889)：每格状态、锁珠、反馈环、闪罩、幽灵符号 | 每帧，命令量最大 | 珠、格底、空槽已走 tint blit（[`bead-render.ts:864-890`](../../games/beads/src/view/bead-render.ts#L864-L890)、`:1183-1222`）；残留锁珠每格 1 rect + 2 斜纹（[`bead-render.ts:1326`](../../games/beads/src/view/bead-render.ts#L1326)）无 mask，因锁格无目标色可供 tint |
| 盘面剪影 | [`bead-outline.ts:129-192`](../../games/beads/src/view/bead-outline.ts#L129-L192)，经 [`play-page.ts:560`](../../games/beads/src/view/play-page.ts#L560) 调用，逐边界 polygon，`back:true` | 每帧；宿主有按签名缓存与冻结跳画（[`cocos-renderer.ts:651-652`](../../packages/framework/src/adapters/cocos/cocos-renderer.ts#L651-L652)） | 无现成位图资产；但它必须沉在珠底之下，正适合复用静态描边层，而非烘焙进珠面 |
| 托盘 | [`play-page.ts:1031-1320`](../../games/beads/src/view/play-page.ts#L1031-L1320)：面板 2 rect、3 条内阴影、每槽底 rect、槽沿 rect、虚线预览行约 12 line/槽 | 每帧 | 槽与珠已走 tint；面板与槽沿受层序互斥约束：既要压住盘面珠，又不能盖住自己的珠（T-1088 / T-1096，见 `:1069-1084`）。RenderModel 没有虚线通道，虚线只能逐段画 |
| HUD | [`play-page.ts:336-482`](../../games/beads/src/view/play-page.ts#L336-L482)：计时胶囊、齿轮、等级徽标 | 每帧 | 无替代；程序化绘制、零资产，收益不足以覆盖引入资产的判据成本 |
| 道具卡 | [`play-page.ts:1476-1638`](../../games/beads/src/view/play-page.ts#L1476-L1638)：三张卡面、角标、图标 | 每帧 | 无替代；形状是识别通道，与文字标签并列 |
| VFX | [`play-page.ts:1397-1459`](../../games/beads/src/view/play-page.ts#L1397-L1459)：连击粒子/光条、扫光三层四边形 | 仅特效窗口 | 无替代，持续时间短 |
| 缩放控件 | [`play-page.ts:214-273`](../../games/beads/src/view/play-page.ts#L214-L273) | **恒不执行**：`ZOOM_CONTROLS_VISIBLE = false`（[`board.ts:458`](../../games/beads/src/config/tuning/board.ts#L458)） | 不是负载 |
| 调试覆层 | [`debug-layer.ts:57-165`](../../games/beads/src/view/debug-layer.ts#L57-L165)、`drawGrid` 的调试虚线 | 仅调试开关打开 | 生产路径零指令，不纳入优化面 |

相位面板（通关、失败、结算等）在 [`view-model.ts:214-870`](../../games/beads/src/view/view-model.ts#L214-L870) 中多数已有位图臂（木牌、星、按钮）；仍为矢量的主要是色带、星表与缺图降级腿。庆贺纸屑最多 44 条多边形，仅结算后 800ms 出现。

## 4. 非对局页

- 主菜单整屏背板、选关格底与编号牌、通用弹窗木板已有位图臂（[`meta-menu.ts:544-597`](../../games/beads/src/view/meta-menu.ts#L544-L597)、[`meta-widgets.ts:165-333`](../../games/beads/src/view/meta-widgets.ts#L165-L333)）；对应矢量是**缺图降级腿**，常态不命中。
- 关卡缩略珠刻意保持程序化矢量，因为位图缩略看不清（[`menu-signage.ts:579-581`](../../games/beads/src/view/menu-signage.ts#L579-L581)）；这是观感裁定，不是性能疏漏。
- 旧十层珠体（[`bead-styles/legacy-ten.ts`](../../games/beads/src/view/bead-styles/legacy-ten.ts)）不在生产风格注册表，仅作回退阀对照；符号层（[`symbols.ts`](../../games/beads/src/view/symbols.ts)）只服务默认关闭的幽灵提示。两者每帧矢量负载为零。

## 5. 替代方案与门禁次序

1. **脏帧门控（优先）**：在载体之外先砍掉「模型没变却整帧重放」，对所有通道同时生效，不动美术与夹具。已知判据：签名计数必须放在计时段之外（K-100）。
2. **复用描边静态层**：盘面剪影已有宿主静态层与冻结跳画，先确认它在真实拖动中是否持续冻结生效；若有效，无需新增 mask 资产。
3. **锁珠位图化（条件性）**：只有三向 A/B 显示关掉盘面珠后矢量段显著下降才做；需要美术定稿 mask、孔底判据口径同步（现役判据在 tint 臂下已不逐字成立）并用官方脚本重抓夹具，⛔ 不手改 sha。
4. **不建议换轨**：托盘面板/槽沿（层序死结先行）、HUD/道具卡/VFX（程序化零资产，替换成本高于收益）。

任何换轨结论必须有机械见证：关层前后绘制命令数按预期变化，同一手势重复至少两次；短于 0.4 秒的样本不进判据。真机构建与验证由用户执行，AI 只跑本地门。

## 6. 关联变更与出处

- 现役托盘珠已撤 `forceVector`，与空槽同走 tint 位图臂（[`play-page.ts:1260`](../../games/beads/src/view/play-page.ts#L1260)）。代价是抬起放大的缩放部分消失，只剩位移；夹具未注入 tint 运行时，命令流不变。
- 依据：K-100（先量脏帧再比载体）、K-104（停用组件才等于缺席上界）、K-088（换轨先重设判据）、K-225（帧耗时不等于卡顿）；架构文档 [`ADR-0030`](adr/ADR-0030-beads-cocos-production-blit-carrier.md) §5.0；控制清单 [`control-manifest.md`](control-manifest.md)。
