# ADR-0020 — 棋盘缩放/聚焦**调试件**（harness-only，旁路 clamp）+ B0 底图不随缩的缺陷登记

- **编号**：ADR-0020（0016–0019 已用；0008 跳空沿 ADR-0015 头注「合规」口径；号只分配不回收）
- **状态**：**Proposed（草案 · 未施工）** —— 本文只出设计与决策记录。**本轮零代码改动**（用户明确「先只出草案，先不实现」）；`games/`、`dev/`、`packages/` 下任何文件**未被本单触碰**，本文所有「方法签名/公式/常量落位」均为**拟增**，不是既存事实。
- **日期**：2026-09-24
- **维护人**：程基岩（engineering-lead）
- **任务号**：WXG-T-206（设计/ADR 草案阶段。⚠ 台账现状：`production/TASKS-DETAIL.md` 与 `production/TASKS.md` **查无 WXG-T-206 条目**，本文按主理人任务单为权威来源；批准后须补登记）
- **关联（交叉引用，逐条已在正文使用）**：
  - **ADR-0015**（棋盘双指缩放/单指平移，甲′ + **丁-3「布局即相机」** + C-3(a)，**Accepted 且已落码**）——本文的**上位约束**；关系裁定见 §1.5。
  - **ADR-0017**（zoom 自适应 LOD，甲案通道已落码两态）——阈值 `BEAD_LOD_CELL=45` / 滞回 `2.5` 会被本调试件的滑杆跨越，见 §1.2、§4.2-7。
  - **ADR-0018**（盘面可玩档位：MVP = 14×14 + 18×18；29×29 触控不可玩）——「32px」读数的判定基准盘面，见 §1.4。
  - **ADR-0013**（框架只认结构不认玩法）——调试方法归 `BeadsGame`，不进框架。
  - **ADR-0011 / `control-manifest` §17**（屏幕坐标空间契约、宿主归一化高危半）——本文**不新增任何坐标层**。
  - `control-manifest` **L5**（视图不持状态）、**§2**（热路径零分配）、**§3**（数值→tuning）、**§6**（无头驱动走公开方法，不伪造原生事件）、**§12** 自查表。
  - GDD `concept.md` **D13** / `input-control.md` v2.5 §2.1 / `ux-spec.md` §2 注②——「缩放**只做双指捏合，不提供滑轨/按钮控件**」的既有裁定（本文与该裁定的关系见 §1.5、§2.1）。
  - `systems-index.md` §3.3（`BEAD_CELL` / `BEAD_GAP` / `BEAD_PITCH` / `GRID_MAX_COLS=32`）、§3.8（`TOUCH_MIN` / `GRID_HIT_SIZE`）；`levels-spec.md` §3.1 v1.8「每颗像素标准 **32px**」。
  - 教训 **K-042**（探针不得与真源共用同一个错）、**K-036**（断言必须有判别力）、**K-054**（「未登记」≠「已证伪」）、**K-051**（估工数落码后须差分复算）。
- **数值真源声明（红线，先写在头部）**：本调试件携带的一切数字（滑杆端点 `0.1 / 1.0 / 4.0`、聚焦边距档 `N 珠`、步长、面板默认值）**一律不进 `systems-index §3`**（§3 = 玩法数值唯一真源，`AGENTS.md §4`）。落位方案见 §2.6 / §3.7：**留在 `dev/harness/`（唯一消费方）**，源码内以 `DEBUG_` 前缀 + 行内 `[非玩法冻结]` 标注。本文**不新增、不修改任何 §3 常量**，也**不修改** `BOARD_FIT_MARGIN` / `CAMERA_ZOOM_MAX_SPAN` / `BEAD_FIT` 相关的三个工程占位值（`tuning.ts:1034/1036/1038`，原文即标 `[待确认]` 与「QA 不得据本组占位数值造判据」）。
- **环境阻塞（诚实声明）**：Cocos 编辑器构建链未通（ADR-0009 P2）、无有效 AppID / 无真机 ⇒ 本文所有**观感结论**（露底色、重叠、不居中在真机上的实际读感）为 `[R]` 未执行；本文的**几何与算术结论**为纯设计空间推演，可在浏览器 harness 与 Node 单测中复核（复算式见附录 B）。

---

## 1. 上下文（Context）

### 1.1 直接动因与已锁定决策

用户为肉眼排查一个显示缺陷提出调试工具诉求：**缩放后盘面的 B0 底图（tile）与珠/槽错位 ⇒ 相邻 tile 互相重叠、珠体看起来不居中、底色（背景）露不出来**。已确认的四条决策（用户拍板，本文不重开）：

1. **落地形态 = harness 页面左下角的 DOM 控件**，不是游戏内画布控件。
2. **缩放夹取 = 旁路**：新增 `BeadsGame.setDebugCameraZoom(z)` 直写 `_camera.zoom` 并触发 `_recomputeLayout()`，**跳过 `clampCamera` 的 `[fit, fit×CAMERA_ZOOM_MAX_SPAN]`**；玩法正常路径的夹取**一字不动**。
3. **滑杆规格 = 中位 `1.0`、上端 `4.0`、下端 `0.1`**（bipolar，非线性中点）。
4. **聚焦按钮** = 把整体盘面缩放并**居中**，左右各留「N 个珠子宽度」边距。

用户对第 4 条的边距给了自定义口径（Other 答复），原文：**「实际格子边距是 32px，珠子宽度略小于格子宽度，以能漏出底色为准。」** 这句话同时做两件事：(a) 重新定义边距单位（以「格」为准），(b) 指向真正的显示缺陷根因。二者分开处理见 §1.4 与附录 A。

**本文的能力边界（必须先划清）**：调试件**不修玩法几何**，它只让人看见问题。根因与候选修法**单列于附录 A**，属**独立变更**，需另经用户拍板 + 真机复验，本 ADR 只登记方案与影响面，**不落码、不擅自改**。

### 1.2 现状实测（全部读自**工作树**，行号为据）

> ⚠ **取证口径澄清（诚实声明）**：本仓工作树当前**不干净**——上一轮的「调试虚线轮廓」同族件（`bead-render.ts` +63 / `view-model.ts` +13 / `beads-game.ts` +13 / `dev/harness/main.ts` +6，四文件**纯新增、无删改**）**尚未提交**，`git status` 另见 `state.ts` / `palette.ts` 及 cocos 镜像同步件。因此本文**所有行号以工作树为准，不等于 HEAD**；若要按提交态复核，须先让那笔轮廓改动落定（本单不动它）。已提交态可核的部分：`_camera` / `clampCamera` / `computeFitZoom` / `gridLayoutFor` / `hitGridCell` / `debugHitCell` / `debugCellCenter` / `debugGestureState` 均在 HEAD；**`setDebugOutlines` 与 `drawDebugCellOutline` 仅存在于工作树**（下文引用处已按此口径标注）。本文**未修改**上述任何文件。

| 常量 | 实测值 | 来源（`games/beads/src/`） | 是否 §3 冻结 |
|---|---|---|---|
| `BEAD_CELL` | **50** | `config/tuning.ts:121` | ✅ §3.3 |
| `BEAD_GAP` | **2** | `config/tuning.ts:123` | ✅ §3.3 |
| `BEAD_PITCH` | **52**（= `BEAD_CELL + BEAD_GAP`，`tuning.ts:125` 直接表达式派生） | `config/tuning.ts:125` | ✅ §3.3 |
| `BOARD_FIT_MARGIN` | **24**（`// [待确认]`，属 WXG-T-169 **工程占位**，占位段头注 L1029–1032 明写「未冻结 / QA 不得据以造判据」） | `config/tuning.ts:1036` | ❌ 非 §3 |
| `CAMERA_ZOOM_MAX_SPAN` | **2.5**（同上 `// [待确认]`） | `config/tuning.ts:1038` | ❌ 非 §3 |
| `DESIGN_W` / `DESIGN_H` | **750 / 1334** | `config/tuning.ts:17 / 19` | ✅ §3.1 |
| `PUZZLE_BAND` | **y∈[480, 1120]** ⇒ 视口窗 `WINDOW_H = 640`、`WINDOW_W = 750` | `config/tuning.ts:27`；`systems/board-camera.ts:33-34` | ✅ §3.1 |
| `BEAD_DRAW_INSET` | **6**（真机裁定乙档） | `config/tuning.ts:39` | ❌ 表现层（assets-spec 口径） |
| `GRID_HIT_SIZE` / `TOUCH_MIN` | 66 / 88 | `config/tuning.ts:442 / 436` | ✅ §3.8 |
| `BEAD_LOD_CELL` / `BEAD_LOD_HYST` | 45 / 2.5 | `config/tuning.ts:844 / 846` | ❌ 呈现层（ADR-0017） |
| `GRID_MAX_COLS/ROWS` | 32 / 32 | `config/tuning.ts:140 / 142` | ✅ §3.3 v1.45 |

**相机链现状（三处夹取，全部在 `systems/board-camera.ts`，本文零改动）**：

- `computeFitZoom(cols,rows)` = `min(1, (750−2·24)/(cols·52−2), (640−2·24)/(rows·52−2))` —— `board-camera.ts:87-93`（L90-91 两条边、L92 `Math.min(1,…)`）。**≤1 恒成立**（永不放大到设计尺寸之上）。
- `applyPinch` —— `board-camera.ts:122-147`，**L143-144**：`cam.zoom = clamp(g.zoom0·dist/pinchDist0, fit, fit×CAMERA_ZOOM_MAX_SPAN)`。
- `applyPan` —— `board-camera.ts:155-165`，**L164 每次平移都调 `clampCamera`**。
- `clampCamera` —— `board-camera.ts:174-182`，**L176 重夹 zoom**、L177-181 按内容边界夹 offset（板 ≤ 窗 ⇒ 锁死居中）。
- `fitCamera` —— `board-camera.ts:103-107`（`zoom = computeFitZoom`、offset 归 0），是**游戏内唯一复位档**，落点 `game/beads-game.ts:1765`（`_setupLevel`）与 `:1813`（`_loadStage`）—— 即 ADR-0015 §3.4「装配即复位」的两处。
- 「布局即相机」= `gridLayoutFor(cols,rows,camera)` —— `tuning.ts:1052-1075`：`pitch = BEAD_PITCH·z`（L1056）、`cell = BEAD_CELL·z`（L1057）、`left/top` 按带内居中 + offset（L1060-1063）。命中同源走 `hitGridCell(layout, zoom, x, y)`（`tuning.ts:1087-1110`，半径 `GRID_HIT_SIZE·z/2`）。
- 玩法层相机权威：`beads-game.ts:418` `private _camera: BoardCamera = { ...IDENTITY_CAMERA }`；`_recomputeLayout()` 为 **private**（`beads-game.ts:1943-1947`，内含 `nextBeadLod`）。

**渲染侧现状（关键，附录 A 的靶子）**：

- 逐格中心：`view/view-model.ts:759-760` 由 `snap.gridLeft + snap.gridCell/2 + snap.gridPitch·j` 给出（**已含缩放**）；可视窗逐格剔除 `:762-768`。
- 珠/槽：`view-model.ts:803`（`drawEmptySocket(…, snap.gridCell, …)`）、`:861`（`{ size: snap.gridCell }`）、`:902`（`drawFilledBead`）—— **吃缩放**。
- B0 底图：`view-model.ts:800`（空格分支）与 `:901`（已填分支）调用 `drawTargetTile(builder, bx, cy, colorIdx, inks)` —— **没有尺寸入参**；`view/bead-render.ts:290-301`，**L297** 硬用 `BEAD_PITCH` 绝对值画方。既有调试轮廓 `bead-render.ts:313-321` 的头注 L310-311 已**自证**此事：「tile 故意用 `BEAD_PITCH`（与 `drawTargetTile` 实画尺寸一致，**不吃相机缩放**）」。
- 快照下发：`beads-game.ts:3159-3164`（`gridLeft/gridTop/gridPitch/gridCell`）；只读调试口 `beads-game.ts:2782`（`setDebugOutlines`）、`:2793`（`debugHitCell`）、`:2798`（`debugCellCenter`）、`:2807-2830`（`debugGestureState`，L2825-2827 给 `zoom/offsetX/offsetY`）。
- harness：`dev/harness/main.ts:36-39` 读 query、`:42-48` 建 shell（`?meta=menu`）、`:53-58` `App({designWidth:750,…})`、`:220-240` DOM HUD、`:291-295` `?dbg=outline`、`:300-303` 暴露 `__beads = { app, game, shell, fitCanvas }`。`dev/harness/index.html`：`#hud`（左上，`pointer-events:none`）与 `#controls`（`top:56;left:10`）已占**左上**，**左下为空白**；L52-58 与 L59-70 两条注释是 WXG-T-113 判例——面板盒不得吞画布点击，只有真控件恢复 `pointer-events:auto`。

### 1.3 「32px」核实（正面处理用户答复 (a)）

我从代码读到的**设计空间格距是 52、格宽是 50，都不是 32**（`tuning.ts:121/123/125`）。因此「32px」必是另一义。三种读法全部算过：

| 读法 | 含义 | 复算 | 判定 |
|---|---|---|---|
| **A. 源图域标准** | `levels-spec §3.1` v1.8「每颗像素标准 **40→32px**」（用户 2026-09-22 原话「现在已经是 32px 的宽高为一个珠子」），`beads-studio` 的 `PER_BEAD_PX=32`；`systems-index §3.3` 的 `GRID_MAX_COLS=32` 行亦写「与每颗像素标准 32px 对齐」 | 属**导入/做图**口径（源图宽 ≈ 格数 × 32），与游戏内几何**无换算关系** | **文本巧合，须排除**。它解释不了「实际格子边距」这个说法（导入域没有"实际显示"） |
| **B. fit 档缩放后的设计空间格径/格距**（工作假设） | `layout.cell = BEAD_CELL·fit`、`layout.pitch = BEAD_PITCH·fit` | 18×18：`fit = min(702/934, 592/934) = 0.6338` ⇒ **pitch 32.96 / cell 31.69**；14×18（MVP 实盘档，高受限 ⇒ 同 `fit 0.6338`）⇒ 同数；22×18 ⇒ pitch **31.96** | **最吻合**（误差 <1px）。用户看到的正是「大盘被 fit 缩到 ~0.63 档时格子实际多大」 |
| **C. 设备屏幕像素** | `cssPitch = layout.pitch × viewport.fit.scale`（`scale` 见 `beads-game.ts:1914` 用法） | 18×18 fit 档在 390 CSS px 宽窗 ⇒ 32.96 × 0.52 = **17.1**；要读到 32 需窗宽 ≈ 750 CSS px（且 `dpr` 封顶 2，`main.ts:61`） | 可能但需另一次取证；若用户是从真机量的，B/C 差一个 `fit.scale` |

**判定（本文采用 B 为工作假设，且明确标注待确认）**：「32px」= **fit 档缩放后的有效格径 ≈ 32 设计 px**，不是常量、不是 `BEAD_PITCH`。推论直接对上用户的症状描述：底图仍按绝对 52 画，而格心只相距 32.96 ⇒ **每对相邻 tile 重叠 19.04 设计 px（= 格距的 58%）**，tile 单边伸出本格 9.52 px 压进邻格；后画的 tile 盖住先画的缝 ⇒ 底色被糊死、珠体（31.69−2×6 = 19.69 设计 px）只占所见底块的 38% ⇒ 「重叠 / 不居中 / 露不出底色」三条现象同源。

**零代码取证法（写进 §3.6 的面板职责，不需改任何源码）**：harness Console 现成可读三数 —— `__beads.game.snapshot.gridPitch`、`.gridCell`、`__beads.app.viewport.fit.scale`。三者一乘即能把 B/C 一次分开。（判例 **K-042**：读数的算式必须来自真源函数产物，探针不得自己重推一套 —— 本面板因此**只读快照与 `debugGestureState()`**，不在 harness 里重算格几何。）

### 1.4 与 ADR-0015 的关系（约束复述，不重开）

- **丁-3「布局即相机」是本调试件得以"零新坐标层"的前提**（ADR-0015 §3.3）：相机三标量烘进 `gridLayoutFor`，渲染与命中同源 ⇒ 调试件只要写 `_camera` 并 `_recomputeLayout()`，**命中盒（`GRID_HIT_SIZE·z/2`）、逐格剔除窗、LOD 档、快照下发**全部自动跟着走，不需要、也**禁止**新增第二套逆变换（`control-manifest §13` 末两行反模式）。
- **ADR-0015 §3.4 的复位不变式（「装配即复位」，实际 2 个触发点）** 意味着调试缩放**不粘**：换关 / 重试 / 跳关 / 冲刺换 stage 一律被 `fitCamera` 拉回 fit 档。这是**既有裁定的正确行为**，本文不改，只在 §4.2-5 记为使用成本。
- **ADR-0015 §3.4 的钳位口径（`[fit, fit×2.5]`）** 是本文唯一要"旁路"的对象；旁路的是**调用面**（不走 `clampCamera`），不是**被旁路函数的语义**（该函数零改动）。
- **ADR-0015 §3.5 C-5**（缩放后描边/缝隙/`BEAD_DRAW_INSET` 是否随缩 → art 轨未答）与本缺陷**相邻但不同一**：C-5 问的是"绝对值观感要素随不随缩"，而 B0 底图用的是**绝对尺寸**（不是线宽、不是内缩），它直接违反 §3.3-5 自己列出的"视图侧参数化面"清单（该清单含 `bead-render.ts` 的珠体尺寸与 `BEAD_DRAW_INSET`，但 `drawTargetTile` 的 **tile 边长**在 T-169 施工中未被参数化）。⇒ 本文按**施工漏项**登记（附录 A），不冒充 C-5 的答案。

### 1.5 「新增 ADR」还是「ADR-0015 增补节」——本文选**新增**，三条理由

选**新增 ADR-0020**，不改 ADR-0015 决策主体。理由：

1. **语义分层**：ADR-0015 是 **Accepted 且已落码**的**玩法能力** ADR，其 §1.1 与 §3 全部在服务一个玩家可感知的交互承诺。把「不进发布包体 UI 的调试工具」写进它，会让读者把调试控件误读为玩法承诺的一部分——而 `concept.md D13` / `input-control §2.1` / `ux-spec §2 注②` 三处**明确排除**「滑轨 / 按钮控件」形态（ADR-0015 §2.1 丙案正是因此被否，否因原文「按钮切档属被排除的控件形态」）。**调试件不受该裁定约束**（它的宿主是开发页，不是玩家屏幕），但这条分界**写进玩法 ADR 就是自相矛盾**，写在独立 ADR 里反而清楚。
2. **生命周期不同**：ADR-0015 的开放项（C-4 数值、C-5 art、pinch-focal）与本文的开放项（32px 含义、边距档、tile 修复是否另立单）**互不触发**；合并会让任一方的复评都要重读另一方。
3. **纪律允许且更干净**：skill 写法纪律「编号只分配不回收、废弃标 Superseded」⇒ 独立编号可废弃而不伤 ADR-0015 正文。

⇒ 本文件**不是** ADR-0015 的增补节；但批准后须在 **ADR-0015 头部「关联」行补一行指向本文**（属字面回写，不动 §1–§5 任何决策），列在 §3.9 待回写清单。

---

## 2. 备选方案（Alternatives）

### 2.1 落地形态

| 方案 | 事实 | 判定 |
|---|---|---|
| **甲：harness DOM 控件（页面左下角）** | 零包体 UI 增量（`dev/harness` 不进游戏构建图）；复用既有三件套：query 参数（`main.ts:36-39`）、DOM HUD（`:220-240`）、`__beads` 暴露（`:300-303`）；左下为**空白区**（`index.html` 现有面板均在左上），须沿用 `pointer-events:none` + 子元素 `auto` 的 WXG-T-113 纪律；同族先例 = `?dbg=outline`（`main.ts:291-295`） | ✅ **已选（用户拍板）** |
| 乙：游戏内画布控件（滑轨 / ± 钮） | 需在 `view-model` 增绘制点 + 在 `_readInput`（`beads-game.ts:1867-1938`）增路由 ⇒ 触 L5 争议、触 `control-manifest §6` 带级次序、**正面违反 D13**（被排除的控件形态）；且控件进**已发布包体** | ❌ |
| 丙：无 UI，纯 Console 调用 | 最省（一行 `__beads.game.setDebugCameraZoom(0.4)`），零 DOM。但用户已明确要控件；且连续取值（0.1↔4.0）逐次手打不现实 | ❌（作为**降级档**保留：若某次 harness 构建里 DOM 面板出问题，Console 是可用的后备路径） |

### 2.2 bipolar 滑杆映射（value `v ∈ [−1, 1]` → zoom）

**甲（已选，规格直译）**：

```
v < 0  ⇒  z = 1 + v × 0.9      // 下端点 v=−1 ⇒ z = 0.100 ✓
v ≥ 0  ⇒  z = 1 + v × 3.0      // 上端点 v=+1 ⇒ z = 4.000 ✓
中点   v=0  ⇒  z = 1.000 ✓（恒等档 = IDENTITY_CAMERA.zoom）
```

端点/中点验算：`1 + (−1)(0.9) = 0.1`；`1 + (1)(3) = 4`；两段在 `v=0` 都交出 `1`（连续，无跳变）。步长取 `step = 0.01` ⇒ 下半每格 Δz = 0.009（在 z≈0.63 处约等于 pitch 变 0.47 设计 px，读数足够细），上半每格 Δz = 0.03。

**诚实指出规格的两处不对称**：
1. **幅度不对称**：向下一档缩到 **1/10**，向上一档只放大 **4×**。这是用户给定的三个数直译，本文不"顺手修正"成对称形态。
2. **可用区偏置**：真正出 bug 的区间是 `z ∈ [0.36, 0.63]`（MVP 与 22/24/26 列盘的 fit 档），在甲映射下只占滑杆行程 `v ∈ [−0.71, −0.41]` = **30%**；而 `z ∈ [1,4]` 独占 50% 行程。

**乙（对数 bipolar，登记为备选，不采）**：`z = exp(v·ln(a))` 形式，或分段 `z = 10^(v·1)/4^…`——若取「下半 `z = 1·(0.1)^{−v}`、上半 `z = 1·4^{v}`」，中点仍是 1.0（满足"中位=1.0"字面），且**每等分行程对应等倍率**（下半 10×、上半 4×）。它的额外收益是对数中点 `√(0.1×4) = 0.632` **恰好落在 18×18 / 14×18 的 fit 档 0.6338 上**（差 0.3%）。**否因（本文）**：用户锁的是「0.1 / 1.0 / 4.0 + 中位 1.0 的 bipolar」线性形态，乙 属换规格不是换实现；改判须用户点头 ⇒ 登记到 §5-④ 复评触发（若实际操作中下半区明显不够细，直接切乙，公式一行）。

**丙（两段独立滑杆）**：把"缩到 fit 以下"与"放大到 4×"拆成两根轨。否因：两根轨要维护互斥语义（谁覆盖谁），比一根轨复杂且无额外信息。

### 2.3 聚焦按钮的边距单位（正面处理用户答复 (a)）

聚焦语义 = **横向铺满可视窗、左右各留 N 个"珠子宽度"、纵向居中**。

**甲（已选，单位 = 缩放后的格距）**：留白以**格（珠）为单位**，即 `margin = N × (BEAD_PITCH × z)`。整个式子对 `z` 齐次 ⇒ 闭式解：

```
z = DESIGN_W / ( (BEAD_PITCH·cols − BEAD_GAP) + 2·N·BEAD_PITCH )
  = 750 / (52·cols − 2 + 104·N)
```

**为什么这是唯一自洽的单位**：`BEAD_PITCH·z` 与板宽同源齐次，`N` 是**缩放不变量**——"左右各留一颗珠"在 14 列盘与 32 列盘、在 fit 档与 4× 档读起来是同一件事。对照 **乙**：绝对设计 px（沿 `BOARD_FIT_MARGIN=24` 口径）⇒ 在 z=0.42（32×32 fit）时 24 设计 px ≈ 1.1 格，在 z=1.03 时只有 0.23 格，**同样的数在不同盘面读出不同的留白感**；而且 24 是 `[待确认]` 的工程占位值，拿它当调试件基准等于把一个未冻结数当尺子。**丙（用户字面「以能漏出底色为准」）**：⚠ **现状下不可执行**——底色露不出来正是 `drawTargetTile` 绝对尺寸的产物（附录 A），**留白给多大都不会开始露底色**；把它当参数会造成"再大一点、还差一点"的死循环。⇒ 本文的处理：**「露底色」降级为修复后的验收判据（写进附录 A），不作为聚焦参数**；参数只认 `N`。这是对用户答复的直译冲突，已列 §5-②。

**N 的取值与实算**（默认档 `N = 1`，面板暴露 `0.5 / 1 / 1.5 / 2` 四档）：

| 盘面 | `fit` | `N=1` 聚焦 z | z 是否在玩法合法区 `[fit, fit×2.5]` | 板高 vs 窗高 640 | 纵向溢出 |
|---|---|---|---|---|---|
| 14×18（MVP 实盘） | 0.6338 | **0.9036** | ✅ 在 | 844 | +204（≈4.3 行被剔，`maxOffY=102`） |
| 18×18（ADR-0018 B1） | 0.6338 | **0.7225** | ✅ 在 | 675 | +35（≈0.9 行，`maxOffY=17.4`） |
| 14×14（ADR-0018 B3） | 0.8154 | **0.9036** | ✅ 在 | 656 | +16 |
| 22×18 | 0.6147 | **0.6019** | ❌ **低于 fit** | 562 | −78（不溢出） |
| 32×32 | 0.3562 | **0.4247** | ✅ 在 | 706 | +66 |

**关键实测结论（改变设计，不是纸面想当然）**：`N ≥ 1` 时聚焦档**可能跌破玩法 `fit` 下限**（22×18 即为一例，条件 = 宽度受限盘且 `N×pitch > BOARD_FIT_MARGIN=24`）。⇒ **聚焦按钮与滑杆必须走同一个旁路写入口**，不能"聚焦复用玩法 clamp、滑杆才旁路"。本文因此把 `debugFocusCamera` 也挂在旁路上（§3.3），并把「是否把聚焦档纳入玩法合法区」交设计轨（§5-③）——**它是数值问题，本文不代答**。

### 2.4 纵向处理

| 方案 | 事实 | 判定 |
|---|---|---|
| **甲：只 fit-to-width + 纵向居中 + 溢出靠平移** | 用户字面「左右各留 N 个珠子宽度」= 宽度驱动；纵向居中是**零实现**——`gridLayoutFor` 的 `top` 本来就按 `bandMidY` 居中（`tuning.ts:1061-1063`），聚焦只需 `offsetX = offsetY = 0`。溢出由既有两条机制兜住：逐格可视窗剔除（`view-model.ts:762-768`）+ 平移夹取（`clampCamera` L177-181，`maxOffY = (boardH − 640)/2`，永不露空白）。上表实算：最大溢出 4.3 行，靠拖拽可查全 | ✅ **已选** |
| 乙：双向 `min`（宽或高谁紧谁赢） | 等价于今天 `computeFitZoom` 换一套边距口径 ⇒ 大盘永远"左右留白远大于 N 珠"，与用户诉求字面冲突 | ❌（作为"看全盘"档保留：**`聚焦(全盘)` = 现成 `fitCamera`**，一个零算术的第二按钮即可） |

⇒ 面板因此拟出**两枚**聚焦钮：`聚焦(宽)`（走甲，旁路）与 `复位 fit`（直接调既有 `fitCamera`，不经任何新算术、不旁路）。后者是**逃生口**：一旦聚焦算错，一键回到已验证过的玩法档。

### 2.5 旁路 clamp 的实现切面

| 方案 | 事实 | 判定 |
|---|---|---|
| **甲：`BeadsGame` 增两个 debug 方法 + `board-camera.ts` 增一个纯函数** | ① `setDebugCameraZoom(z)`：数值有限性校验（`!Number.isFinite(z) || z <= 0` ⇒ **忽略**，不夹、不抛）→ 写 `_camera.zoom` → `_recomputeLayout()`；**不调 `clampCamera`**。② `debugFocusCamera(marginCells)`：读 `this._grid.cols/rows`（**相机算术留在持有 `_grid` 的一侧**）→ 调新纯函数 `debugFocusZoom(cols,rows,marginCells)` → 写 zoom、`offsetX=offsetY=0` → `_recomputeLayout()`。③ **玩法三函数 `applyPinch` / `applyPan` / `clampCamera` 与 `computeFitZoom` / `fitCamera` 一字不改**；`board-camera.ts` 只**加**一个不参与任何 clamp 的导出。`_recomputeLayout()` 顺带把 LOD 档算对（`beads-game.ts:1946`）⇒ 所见即真机档 | ✅ **已选** |
| 乙：给 `clampCamera` 加 `bypass?: boolean` 形参 | 一处签名改动 ⇒ 三个调用面（`:164` `applyPan` 每帧、`:143-144` `applyPinch`、外部）都要重新论证；**把调试语义种进玩法真源函数**，下一个改动者会读到"clamp 可以不做"这个选项——这是最容易被误用的形态 | ❌ |
| 丙：harness 里 `(game as any)._camera.zoom = z` | TS `private` 只挡编译期，运行时可写；**但 `_recomputeLayout` 是 private（`beads-game.ts:1943`）⇒ 布局 / 命中 / LOD / 快照全都不跟着变**。后果 = 画面上珠的位置与实际命中点脱钩，调试件本身在制造"探针与真源共用同一个错"（**K-042** 的镜像形态），得出的"缩放正确"是自证 | ❌（列出仅为诚实说明"为什么不能最省"） |
| 丁：聚焦算术也放 harness | 少一个 game 方法，但 harness 要自己重推板宽/边距公式 ⇒ 与 `boardPx`/`gridLayoutFor` **两份公式**（判例 = `tuning.ts:785-786`「单一真源函数……不得在两边各写一份公式」，以及 §1.6.4 初稿 `lodLayers` 6 vs 7 的实际漂移） | ❌ |

**必须诚实登记的旁路残余（"旁路不粘"）**：`setDebugCameraZoom` 写的值**不是持久态**。任何一次捏合（`applyPinch` L143-144）或平移（`applyPan` → `clampCamera` L176）都会把 zoom **拉回 `[fit, fit×2.5]`**；换关/重试/stage 切换经 `fitCamera`（`beads-game.ts:1765/1813`）整体复位。⇒ 交互上会表现为「调完倍率一拖就弹回去」。缓解（不加玩法门禁、不动 clamp）：面板 `input` 事件幂等重写 + 一枚「重放当前倍率」钮；文档化该行为（§4.2-5）。

**L5 / 热路径合规**：两个方法写的都是**玩法层权威态**（`_camera`/`_layout`，`beads-game.ts:418-419`），符合 L5「视图只读」；ADR-0015 §3.3-1 的相机权威位置不变。`_recomputeLayout()` 每次 `gridLayoutFor` 会返回新对象（既有 `ponytail` 注 L1940-1942 已承认）——只在**滑杆事件**上触发，**不得**接进 `update()` 每帧（否则从"手势期间偶发"变成"每帧一对象"）。

### 2.6 调试数值的落位（0.1 / 4.0 / N 档 / step）

| 方案 | 事实 | 判定 |
|---|---|---|
| **甲：住 `dev/harness/`（唯一消费方）** | `control-manifest §3`「数值 → `config/tuning.ts`」的适用域是**游戏源码**；harness 早有同形先例（`main.ts:55-56` 字面 `750/1334`、`:61` `dpr` 封顶 2、`:199` `SPEED = 900`）。放 harness ⇒ 零 `games/` 改动、零镜像同步面、零 §3 污染，删面板即删数值 | ✅ **已选** |
| 乙：`tuning.ts` 新开 `// ─── DEBUG（非玩法冻结）` 段 | 与 `WRONG_*` / `FILL_POP_*` / `BEAD_LOD_*` 的"表现层参数住 tuning"判例同族，**但**这些都有 `games/src` 内的**活消费方**；调试件没有 ⇒ 为一个 harness 值去改一个头部自述为「every constant below is a mirror of §3」（`tuning.ts:4-8`）的文件，是在该文件的契约上开第二个例外 | ❌（若将来出现"玩法代码必须读该值"再迁，届时走 §3 变更单口径登记） |
| 丙：写进 `systems-index §3`（新开 §3.15 调试段） | ❌ 直接违反 `AGENTS.md §4`（§3 = 玩法数值真源）与用户红线。**明确否决** | ❌ |

**纪律落地形式（本文承诺，不代做）**：常量名前缀 `DEBUG_`（如 `DEBUG_ZOOM_MIN/MAX/MID`、`DEBUG_FOCUS_MARGIN_CELLS_DEFAULT`），块注释首行写 **`[非玩法冻结]` + 理由 + 「harness-only，不进包体」**；并**不**出现在 `systems-index` 任何节。

---

## 3. 决定（Decision）

### 3.1 一句话

**harness 左下角 DOM 面板（甲）+ 线性 bipolar 滑杆 `v<0: 1+0.9v / v≥0: 1+3v`（端点 0.1 / 1.0 / 4.0，甲）+ 聚焦 = fit-to-width、边距以"格"为单位 `z = 750/(52·cols − 2 + 104·N)`、纵向 `offset=0` 居中、溢出靠平移（甲）+ 旁路走 `BeadsGame` 两个 debug 方法（甲）+ 数值住 `dev/harness/`（甲）。调试件不修任何玩法几何；`drawTargetTile` 的缺陷另案（附录 A）。**

### 3.2 范围与宿主

- 交付物 = `dev/harness` 内的一块 DOM 面板（左下角）+ `games/beads/src` 两个 public debug 方法 + `board-camera.ts` 一个纯函数导出 + 一行读数区。
- **不进已发布包体的部分**：面板 UI、滑杆常量、读数区（全在 `dev/harness/`）。
- **进包体的部分（诚实，勿写成"零包体"）**：两个 debug 方法与 `debugFocusZoom` 本身——它们住在 `games/beads/src`，被 `build:cocos` / `build:cocos:wx` 编入，只是**无 UI 入口、无调用方**。与既有同族完全一致（`debugHitCell :2793`、`debugCellCenter :2798`、`debugGestureState :2807` 已如此存在于 HEAD；`setDebugOutlines :2782` 同族但目前**仅在工作树、未提交**，口径见 §1.2 头注）。体积代价 = 数十行 minify 前逻辑；**包体归因须与 `check:size` 存量 FAIL 分开**（ADR-0015 §4.2-6 同口径）。

### 3.3 相机写入契约（拟增，文档级签名，**不落码**）

```
// board-camera.ts —— 纯函数，不参与任何 clamp（新增）
debugFocusZoom(cols: number, rows: number, marginCells: number): number
  = DESIGN_W / ((BEAD_PITCH * cols - BEAD_GAP) + 2 * marginCells * BEAD_PITCH)

// beads-game.ts —— DEBUG 专用（新增，紧邻 setDebugOutlines 一族）
setDebugCameraZoom(z: number): void   // !Number.isFinite(z) || z <= 0 ⇒ 忽略；直写 _camera.zoom；不调 clampCamera；调 _recomputeLayout()
debugFocusCamera(marginCells: number): void  // 写 zoom + offsetX = offsetY = 0；调 _recomputeLayout()；同样不调 clampCamera
```

- **隔离声明**：`applyPinch` / `applyPan` / `clampCamera` / `computeFitZoom` / `fitCamera` / `resetCamera` 与 `_readInput` 的玩法分支 **零改动**；玩法路径的 `[fit, fit×2.5]` 夹取行为**必须逐字节不变**（回归锚 = `games/beads/tests/board-camera.test.ts` 既有断言 L109-115「clamps to [fit, fit × CAMERA_ZOOM_MAX_SPAN]」与 L154「clampCamera 顺带把越界的 zoom 拉回区间」，二者不得放宽、不得改写）。
- 不引入新坐标层、不动 `InputSnapshot`、不动 `RenderModel.transform`（ADR-0014 通道与本单无关）、不动 `bindings.ts`。
- 聚焦结果的 `offsetX = offsetY = 0` 恒在玩法 offset 夹取合法区内（`clampCamera` 下界为 `−maxOff`、0 总合法）⇒ 旁路的只有 zoom 一档，不制造"拖不出来的居中态"。

### 3.4 滑杆（锁定甲）

`v ∈ [−1,1]`、`step 0.01`、`v=0` 为默认位（`z=1.0` 恒等档）；下半 `z = 1 + 0.9v`、上半 `z = 1 + 3v`；端点 0.1 / 4.0。**规格的两处不对称按 §2.2 如实保留**，不做静默修正；若要换成对数形态，须用户改判（§5-④）。

### 3.5 聚焦（锁定甲 + 逃生口）

- `聚焦(宽)`：`debugFocusCamera(N)`，N 默认 **1**，可选 `0.5 / 1 / 1.5 / 2`（档位在 harness 侧，非 §3）。
- `复位 fit`：调**既有** `fitCamera`（经 harness 侧一个 debug 方法或复用 `debugGestureState` 同族的只读口 + 后续增补；实现细节归施工，本文只锁语义）——不旁路、不新算术，作为唯一"回到已验证档位"的出口。
- 纵向：**居中即可**（`offsetY=0`），溢出**靠平移**（玩法 `applyPan` 原样可用）。
- 已知：`N ≥ 1` 时聚焦档可能低于玩法 `fit`（§2.3 实测 22×18）⇒ 走旁路是**必然要求**，不是风格选择；该数值是否应进玩法合法区 → §5-③（设计轨）。

### 3.6 读数区（顺带完成「32px」取证）

面板每帧（或滑杆事件）刷一行：`z=… · pitchD=… · cellD=… · css=… · lod=… · tile=52(abs)`。全部**只读现成源**：`beads.snapshot.gridPitch / gridCell / beadLodLayers / gridCols / gridRows`、`game.debugGestureState().zoom/offsetX/offsetY`、`app.viewport.fit.scale`。目的 = 一次性把 §1.4 的 B/C 两种读法分开（**零代码改动即可开始取证**）。⚠ 面板**不得**自己重推格几何（K-042）。

### 3.7 数值真源与冻结纪律（红线）

调试件参数一律**不入 §3**、不入 `tuning.ts`（§2.6 甲）；`BEAD_CELL/GAP/PITCH/DESIGN_W/PUZZLE_BAND/BOARD_FIT_MARGIN/CAMERA_ZOOM_MAX_SPAN/BEAD_DRAW_INSET` 全部**原样引用**，本文**零改动零新增**。§2.3 的 `N=1`、§2.2 的 `0.9/3` 只是**控件参数**，不得被任何 QA 判据引用为玩法断言。

### 3.8 验收口径（不编造 GDD §8）

`systems-index` / `input-control §8` **没有**、也不应有"调试面板"条款（调试件不是玩法）。本文因此**不新造玩法验收条**，只锁三条**回归不漂移**判据：① `board-camera.test.ts` 现有 clamp/fit 断言全绿且未被改写；② `debugOutlines=false` 且相机为 `fit` 初值时，beads 既有快照与命令流断言逐位不变（ADR-0015 §3.6-4 同口径）；③ `check:arch` + `framework:sync:check` + `cocos:check` 通过（§4.2-4 镜像面）。是否补 G1 冒烟判据 → 严守真定稿，见 §5-⑤。

### 3.9 本文**未**改动的文件（批准后待回写清单，由主理人串行落笔）

本 ADR 是 Proposed 草稿：**未动任何代码、未动其他 ADR/GDD**。批准后须回写：

1. `ADR-0015` 头部「关联」行补一行指向本文（字面回写，**不动 §1–§5 决策主体**）；
2. `production/TASKS-DETAIL.md` / `TASKS.md` 补 **WXG-T-206** 条目（现状查无）；顺带登记同族先例 `setDebugOutlines` **入台账**（该件目前**只在工作树、尚未提交**，且 `TASKS-DETAIL.md` / `memory/` **查无登记**，K-054 精神：未登记 ≠ 不存在，也别让它继续漂着；施工本单前应先确认那笔改动是否已合入）；
3. `docs/architecture/control-manifest.md` §13 反模式表加一行：**「把调试件的相机写入口接进玩法路径」**（正确做法 = 玩法只走 `clampCamera`，调试件走 `setDebugCameraZoom`）；
4. 若附录 A 的修复获拍板 → 另立 ADR/Story（**不在本文落码**）；
5. 本 ADR 状态 `Proposed → Accepted/Superseded` 与分叉结论回写本文头部。

---

## 4. 后果（Consequences）

### 4.1 正面

1. **零新坐标层、零契约扩张**：调试件复用丁-3 的"布局即相机"单点真源 ⇒ `InputSnapshot`、`RenderModel`、两 adapter、`bindings.ts` 全部不动，不扰动刚在真机走通一次的 ADR-0011/§17 链（K-054）。
2. **夹取旁路是"调用面旁路"，不是"真源加洞"**：`clampCamera` 保持单一语义，玩法路径零改动；回归锚（既有两条 clamp 断言）可原样守住。
3. **命中/LOD/剔除/快照自动跟随**：经 `_recomputeLayout()`，调试缩放下所见 = 真源所算，探针不自造第二套几何（避 K-042）。
4. **把"32px"从猜测变成一次读数**：读数区三个现成数值即可判定 B/C，不靠推演结案。
5. **既有虚线轮廓叠层已是"缺陷预览器"**：`drawDebugCellOutline`（`bead-render.ts:313-321`）故意一色画绝对 `BEAD_PITCH`、一色画缩放 `gridCell` ⇒ 两色一旦不等宽，错位根因**直接可见**；无需为"假想修复"再加开关（乙案的多余性由此成立）。
6. 包体：面板零增量（harness 不进构建图）；进包体的两方法体积可忽略且与既有 debug 口同族。
7. 聚焦公式对 `z` 齐次 ⇒ 「N 个珠子宽度」在任何盘面、任何倍率下语义一致，**不留第二把尺子**。
8. `复位 fit` 逃生口把"调试件自己算错"的风险封顶在可一键撤销的范围内。

### 4.2 负面（**已知成本，白纸黑字，不是"风险"**）

1. **没有编译期护栏挡住"调试件误用于玩法"**。方法必须 public 才能被 harness 调 ⇒ 任何人可以在玩法代码里 `game.setDebugCameraZoom(4)`，玩家将可越出 `[fit, fit×2.5]`，直接击穿 ADR-0015 §3.4 钳位口径与 `TOUCH_MIN=88` 的无障碍底线（`z<fit` ⇒ 珠径 < 设计 50×0.63 ≈ 32，§3.8 口径已不成立）。**代价 = 人工纪律**（只允许 `dev/harness` 调）+ 方法名/注释前缀 `DEBUG` + §13 反模式一行。**不得声称"已隔离"**。缓解：`framework:sync` 后 `check:arch` 之外，建议施工时补一条 grep 级守卫（`setDebugCameraZoom` 的调用点只允许出现在 `dev/harness/**`）——这是**可加的机器护栏**，写进 §5-⑥ 复评。
2. **数值污染 §3 的现实通道存在**：`0.1 / 4.0 / N / step` 一旦被 QA 或后续 Story 当成"缩放合法区"写进判据，就等于绕过 §3 变更单偷改玩法数值。缓解：本文与面板注释三处显式 `[非玩法冻结]`；QA 判据只准引用 §3.8 / `input-control §8` 字面值；`§3.6` 验收口径明写"不新造玩法条"。
3. **调试件可见性 > 玩法**：为排查需要，`setDebugCameraZoom` **不受** ADR-0015 §3.4「只在 `play` 屏 `playing` 相位生效」的门禁（那条门禁的适用对象是**手势路径**）。后果 = 在 `PAUSED / LEVEL_CLEAR / BOOT` 下也能改相机，观感与真机不符。这是**有意的**（就是要在面板遮着的时候看底图），但它使"调试截图"不能当作"玩家所见"证据 ⇒ 任何引本面板的取证须同帧记录 `snapshot.phase`。
4. **镜像漂移**：改 `games/beads/src` ⇒ 必须同批 `pnpm framework:sync`（该脚本遍历 `games/*`，见其头注 L8-14），否则 `games/beads/cocos/assets/scripts/game/**`（真实存在的拷贝件，含 `.meta`）与 `src` 分叉；`cocos:check` 在干净检出会**跳过**（缺编辑器产物，脚本 L40-49）⇒ **绿灯不等于镜像已同步**。缓解：`framework:sync:check` 硬门必须跑，且不得以 `cocos:check` 的跳过态代替。**L1 红线**：`.meta` 只能由既有同步流程产出，禁止手工编辑。
5. **旁路不粘（操作成本）**：写完 zoom 后任何捏合/平移都会把 zoom 弹回合法区（§2.3 残余），换关即被 `fitCamera` 复位。这是既有不变式的正确行为，但使用者第一次会遇到"我调的倍率没了" ⇒ 面板需自带「重放」并文档化。
6. **滑杆 `z=4.0` 端点与真实档位脱节**：`z=4` 对 14×14 盘是玩法合法区（`fit×2.5 = 2.039`）**之外**的 2× 区域，画面上只剩约 3–4 格可见 ⇒ 它是"看单个图元"的工具档，不是"看盘面"的档。诚实登记：这不是 bug，但**别把 4× 下的截图当关卡视图证据**。
7. **LOD 与滑杆耦合，读数会"跳质感"**：`BEAD_LOD_CELL=45 / 滞回 2.5`（`tuning.ts:844-846`）按 `layout.cell` 触发。18×18 fit 档 `cell=31.69 < 45` ⇒ **本来就降档**（7 层集）。所以「露不出底色」在 fit 档的成因里**混着 LOD 砍层**这一条独立变量；滑杆从 0.63→1.6 会跨过 45/47.5 阈值，观感跳变可能被误读为缩放问题。缓解：读数区必显 `lod`，或排查期先临时把两档对齐（属调试操作，不改码）。
8. **低 zoom + 大盘下，调试轮廓自己会卡**：`debugOutlines` 的第二遍循环（`view-model.ts:915-925`）**没有主循环的可视窗剔除**（对比 `:762-768`）。`z=0.1` + 32×32 ⇒ 1024 格全在窗内，每格两枚 `dashedRect`、每边 `dash = max(3, len/8)`（`bead-render.ts:356`）⇒ 粗算 1024 × 2 × 4 × ~4 ≈ **3.3 万条 `line`/帧**。这是**既有代码的已知成本**，只是被本次的下端点 0.1 第一次真正暴露。缓解（属后续小改，需拍板）：给该循环复用同一条格心剔除判据；或在面板上把「轮廓」与「低倍率」互斥提示。**禁止**把"打开轮廓后卡顿"读成缩放缺陷。
9. **`z < 0.24` 会让珠体尺寸为负**：`drawFilledBead` 的 `size = (cell − 2×6)·…`（`bead-render.ts:397-398`），`cell = 50z` ⇒ `z=0.2` 时 `size = −2`、`z=0.1` 时 `size = −7` ⇒ 负宽高矩形（canvas `rect` 行为= 反向，视觉上是不明色块）。**下端点 0.1 会稳定触发**（本次滑杆第一次让它可达）。这是**调试件把既有脆弱点亮出来**，不是调试件制造的 bug。处置：不在玩法侧加 clamp（那属附录 A 的修法域）；本文登记 + 面板在 `z < 0.26` 时把滑杆读数标为「⚠ 超出安全档」。是否给 `drawFilledBead` 加地板 → **附录 A 的候选修法丙一并裁定，本文不擅改**。
10. **估工数不得沿用**：本 ADR 未给行数估算。若主理人要排冲刺，按 **K-051** 要求由施工者落码后差分复算，不得引用纸面值。

### 4.3 中性 / 待观察

1. 「32px」的最终定性（§1.3 三读法）取决于一次读数，本文按 B 立论；若实测落在 C（屏幕 px），**聚焦公式与边距档不受影响**（单位是格，不是 px），只有 §1.3 的表述需改。
2. 调试件是否会催生"第二、第三个滑杆"（offsetX/Y、plate outset、扫光相位）——一旦超出"相机 + 底图几何"这一目的，本文的 harness-only 前提就松动，需复评形态（§5-①）。
3. 与 ADR-0014 全局变换通道**无交集**：本单不碰 `RenderModel.transform`。这条分界今日清楚，看下一条动效单会不会试图"顺手"用调试口改整屏缩放。
4. `safeArea` 仍未进坐标契约（ADR-0011 §4.3）：`WINDOW_H=640` 是按 `PUZZLE_BAND` 常量算的，高屏/刘海档下聚焦档的"左右留 N 珠"在真机上是否仍是 N 珠，未推演。
5. `debugFocusZoom` 不含 `min(1, …)` 与高度约束 ⇒ `N=0` 时对 14 列盘给出 `z=1.0331`（**比设计尺寸还大 3%**）。已把默认档锁在 `N=1`，`N=0` 仅作端点存在；是否要给它加"≤1"地板属算术口径，随 §5-③ 一起裁。

---

## 5. 复评触发条件与开放项（Review Triggers & Open Questions）

### 5.1 需用户/主理人拍板的开放项（本文不代答）

| # | 开放项 | 选项（2–4） |
|---|---|---|
| **①** | 「32px」定性 | 甲 = 接受本文工作假设 B（fit 档有效格径 ≈32 设计 px），直接开建面板 / 乙 = 先用现成 Console 三读数取证（**零代码**）再定 / 丙 = 用户直接给一句"我指的是源图 32px/颗 标准"⇒ §1.3 改写、结论不受影响 |
| **②** | 聚焦边距单位 | 甲 = `N 个格`（本文推荐，缩放不变）默认 `N=1` / 乙 = 绝对设计 px（沿用 `BOARD_FIT_MARGIN=24` 口径）/ 丙 = 用户坚持"以露底色为准"⇒ 必须先修附录 A，否则该判据现状不可达 |
| **③** | 聚焦档（尤其 `N≥1` 时低于 `fit`）是否应纳入玩法合法区 | 甲 = 保持现状（仅调试件旁路可达）/ 乙 = 设计轨把 `BOARD_FIT_MARGIN` 或 `CAMERA_ZOOM_MAX_SPAN` 的 `[待确认]` 值一并冻结，使聚焦档成为合法玩法档 / 丙 = 另立 §3 变更单专门谈"初始视图留白" |
| **④** | 滑杆形态 | 甲 = 锁定线性 bipolar（0.1/1.0/4.0，本文）/ 乙 = 换对数（对数中点 0.632 恰落在 MVP fit 档，下半区分辨率翻 3 倍）/ 丙 = 先用甲做，实测嫌粗再切乙（默认建议） |
| **⑤** | 是否补 QA 判据 | 甲 = 只要 §3.8 三条"不漂移"锚（本文默认）/ 乙 = 严守真补 G1 冒烟一条「调试缩放后面板可用 + 关后零漂移」/ 丙 = 连附录 A 修复合并成一张单再统一出五件套 |
| **⑥** | 机器护栏 | 甲 = 只靠命名 + 注释 + §13 反模式行 / 乙 = 同批加 `check-architecture.mjs` 级 grep 守卫（调试方法调用点只允许 `dev/harness/**`）/ 丙 = 等真出问题再加 |

### 5.2 复评触发条件

1. **调试件需要第 4 个以上控件**（如 offset、plate、扫光、命中盒可视化）⇒ 复评 §2.1 形态（是否升级为「harness 专用调试面板」独立模块，或反而说明需求已越界进玩法）。
2. **附录 A 的 tile 修复被拍板落码** ⇒ 本文 §1.3 的成因表述、§3.6 读数含义、`drawDebugCellOutline` 的两色对照语义**同时回写**（该调试件的存在理由一半消失，须决定是否收敛为"仅居中/缩放校验"）。
3. **`BOARD_FIT_MARGIN` / `CAMERA_ZOOM_MAX_SPAN` 被设计轨冻结**（解除 `[待确认]`）⇒ 重算 §2.3 聚焦档表，并复评"聚焦档是否天然落在合法区内"。
4. **playtest/真机反馈"下半区太粗"或"4× 无用"** ⇒ 换 §2.2 乙（对数），公式一行、端点仍锁 0.1/4.0/1.0。
5. **`drawFilledBead` 加了尺寸地板**（§4.2-9）⇒ 本文 `z<0.26 标警` 的临时约定可撤。
6. **出现第二个游戏要同一套调试件** ⇒ 复评归属：harness 侧（当前）／`dev/harness/**` 抽公共面板／游戏侧 debug 段（ADR-0013「框架不认玩法」边界需重判）。
7. **真机可得（AppID + `build:cocos:wx`，ADR-0009 P2 解除）** ⇒ 必须复核：C 读法（设备 CSS px）、`z<fit` 档的触控可用性（`TOUCH_MIN`）、LOD 跳档观感、`z=0.1` 大盘下的帧率；这四项是本文 `[R]` 的唯一解除路径。
8. **`setDebugCameraZoom` 在 `games/**` 或 `packages/**` 内出现任何调用点** ⇒ 立即复评并当作缺陷处理（§4.2-1 的人工纪律被破，直接进 §13 反模式命中态）。

---

## 附录 A —— B0 底图不随缩：根因与候选修法（**独立变更，本文不落码**）

> 本附录是**缺陷登记 + 方案目录**，不是决策。**任何修法都需要用户拍板 + 真机复验**，且多数会牵动 art 轨（ADR-0015 §3.5 C-5）。本文与调试件的唯一关系：调试件帮看见它。

**根因（一句话）**：`view/bead-render.ts:290-301` 的 `drawTargetTile` **没有尺寸入参**，`L297` 直接以绝对 `BEAD_PITCH = 52` 画方；而它必须服务的格心来自相机缩放后的 `BEAD_PITCH·z`（`tuning.ts:1056`，经 `view-model.ts:759-760`）。⇒ 其余全部网格图元都随缩（socket `view-model.ts:803`、bead `:861/:902`、容器板 `:573-574`、内凹环 `:608`），**只有底图不随缩**。

**后果的定量表述（fit 档 18×18 / 14×18，`z=0.6338`）**：格距 32.96，底图 52 ⇒ 相邻重叠 19.04（58%），单边外伸 9.52；珠体 `(50·z − 12) = 19.69`，仅占底图的 38% ⇒ 缝被后画的 tile 覆盖 ⇒ **"露不出底色"**；`z > 1` 时反向 ⇒ tile 间出现真实背景缝 ⇒ **"底图断开"**。

**施工归因（不掩饰）**：ADR-0015 §3.3-5 列出的"视图侧参数化面"包含 `bead-render.ts` 的珠体尺寸与 `BEAD_DRAW_INSET`，但 **T-169 施工未把 `drawTargetTile` 的 tile 边长纳入** ⇒ 属施工漏项，**不是**规格空白，**也不是** C-5 未答的那部分（C-5 问绝对观感要素随不随缩；本条是几何尺寸）。

**候选修法**：

| 修法 | 内容 | 影响面 | 判定 |
|---|---|---|---|
| **甲（推荐方向）** | `drawTargetTile` 增 `size` 入参，调用点（`view-model.ts:800 / :901`）传 `snap.gridPitch`（**缩放后的格距**，与 `hitGridCell`/格心同源）；默认值保持 `BEAD_PITCH` ⇒ `z=1` 恒等档**逐位不变**，旧快照与既有断言零漂移 | 命令**几何参数**变（尺寸从 52 → `52·z`），**图元数量零增减**、fill 色档与绘制序不变、不动 `tilePainted`（`:546` 的 B0 语义保持）；`bead-render.test.ts` 与 view-model 快照需重跑 | 最小、同源于丁-3；**须真机复验"露底色"是否即达标** |
| 乙 | 同 甲，但 tile 尺寸用 `cell`（`50·z`）而非 `pitch`（`52·z`） | 相邻 tile 之间**恒留 `2·z` 设计 px 缝**（随缩放趋 0）⇒ 大盘低倍率下缝 <1 px，仍可能"看不见底色" | ❌ 与用户"漏出底色为准"的判据冲突，除非同时重定 `BEAD_GAP`（那是 §3 数值，须变更单） |
| 丙 | 甲 + 给 `BEAD_DRAW_INSET` 与珠体加**尺寸地板**（解决 §4.2-9 的负尺寸） | 牵动 C-5（art 轨）——"内缩随不随缩"正是未答项 | ⏸ 与 C-5 一并裁，勿单走 |
| 丁 | 不改渲染，改**夹取下界**（不允许 `z < 0.75`，使重叠不可见） | 直接违反 ADR-0015 §3.4 与 §4.3-6（`CAMERA_ZOOM_MAX_SPAN` 对 29×29/32×32 本已不足）；**用藏 bug 代替修 bug** | ❌ |

**验收判据（修复后才可执行，回应用户 (b)）**：在 `fit` 档目视/取帧确认——相邻 tile 之间出现连续的 `BEAD_GAP·z` 缝、缝的颜色 = 盘面底色（`palette.panel` 容器板 / 背景），且珠体外缘与底图外缘的间距四向对称（居中）。**在此之前，"露底色"不能作为任何参数的判据**（§2.3 丙）。

**明确不在本 ADR 内做的事**：不改 `drawTargetTile`、不改 `BEAD_DRAW_INSET`、不改任何 §3 常量、不改 `clampCamera`/`computeFitZoom`、不动 `.meta`/场景。

---

## 附录 B —— 实测数字复算（可自证，无外部依赖）

```js
const CELL=50, GAP=2, PITCH=52, W=750, H=1120-480 /* 640 */, M=24 /* BOARD_FIT_MARGIN */, SPAN=2.5;
const fit = (c,r) => Math.min(1, (W-2*M)/(PITCH*c-GAP), (H-2*M)/(PITCH*r-GAP));   // board-camera.ts:87-93
const zFocus = (c,N) => W / ((PITCH*c-GAP) + 2*N*PITCH);                          // §2.3 甲
// fit@18x18 = 0.6338 -> pitch 32.96 / cell 31.69 / bead(=cell-12) 19.69 / tile 52(abs) -> overlap 19.04 (58%)
// focus N=1: 14x18 -> z 0.9036 (合法区内)   22x18 -> z 0.6019 < fit 0.6147 (需旁路)   32x32 -> z 0.4247
// slider 甲: v=-1 -> 0.1 | v=0 -> 1.0 | v=+1 -> 4.0（连续性：两段在 v=0 均交出 1）
```

**行号索引（本文全部事实性断言的出处）**：`tuning.ts` 17/19/27/39/121/123/125/140/142/436/442/844/846/1000-1003/1020-1027/1029-1038/1052-1075/1087-1110；`board-camera.ts` 33-34/75-80/87-93/96-107/122-147(143-144)/155-165(164)/174-182(176)；`bead-render.ts` 18/290-301(**297**)/310-311/313-321(319-320)/342-362(356)/372-398(379/397-398)/534-546；`view-model.ts` 573-574/608/759-768/790/800-803/861/901-902/915-925；`beads-game.ts` 418-419/441/1765/1770/1813/1818/1867-1938(1899/1917-1918/1914)/1943-1947/2772-2774/2782/2793/2798/2807-2830/3159-3164/3264；`dev/harness/main.ts` 36-39/42-48/53-58/61/100-112/220-240/291-295/300-303；`dev/harness/index.html` 43-70；`tools/scripts/sync-framework-to-cocos.mjs` 8-14；`tools/scripts/check-cocos-scripts.mjs` 30-49；`games/beads/tests/board-camera.test.ts` 59-73/109-115/133-154。
