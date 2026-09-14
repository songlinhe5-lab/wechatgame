# ADR-0011 — 屏幕坐标空间契约 = CSS px，DPR 由 renderer 层承担（`App.start()` 不得覆盖宿主显式 viewport）

- **状态**：Accepted（裁决落码归 **WXG-T-087**，本 ADR 只定契约与验收断言）
- **日期**：2026-09-14
- **维护人**：程基岩
- **关联**：ADR-0002（框架/引擎解耦）· ADR-0003（空场景代码驱动）· ADR-0009（Cocos MCP）· `docs/architecture/control-manifest.md` L2/L5 · `games/beads/design/gdd/systems-index.md` §3（设计空间 750×1334 / 原点左下 / y 向上 / FIXED_WIDTH）
- **起因缺口**：GAP-07（harness 点击全不中）· GAP-08（harness 文字垂直镜像）

---

## 1. 上下文（Context）

### 1.1 契约原文早已写明，但只写在一处

框架对"屏幕坐标"的定义是**明确的**：

| 位置 | 原文 |
|---|---|
| `core/input/input-manager.ts` 文件头 | `Coordinates are always *screen* coordinates in CSS pixels; the Viewport converts them to design space.` |
| `PointerSample.x` JSDoc | `Raw screen-space position in CSS pixels.` |
| `adapters/cocos/bindings.ts` L204-213 | `RawPointerInput is screen CSS px (top-left origin) and getLocation() already delivers exactly that. Viewport.screenToDesign owns the screen→design conversion (incl. the y flip).` |

两个真实平台适配层都遵守它：

- `platform/web.ts::getScreenSize()` → `window.innerWidth/innerHeight`（**CSS px**）+ `devicePixelRatio`
- `platform/weapp.ts::getScreenSize()` → `wx.getWindowInfo().windowWidth/windowHeight`（微信的"逻辑像素"，即 **CSS px**）+ `pixelRatio`

⇒ **契约在平台层是一致的，harness 是唯一的越界者，这不是框架 bug。**

### 1.2 但 `App.start()` 的覆盖行为让"越界"变得不可见

`compose/app.ts` L102-105：

```ts
start(): void {
  if (this._running) return;
  const screen = this.platform.getScreenSize();
  this.viewport.resize(screen.width, screen.height);   // ← 无条件覆盖
```

`App.resize(w, h)`（L151-153）是公开的显式入口，但 `start()` **无条件**用平台值把它冲掉，且 `AppOptions`（L27-39）**没有** `screen` / `pixelRatio` 字段可供宿主声明意图。后果是宿主的正确性**依赖调用顺序**，而非依赖契约。

**这个坑 Cocos 路径早就踩过，并留下了 workaround**——`adapters/cocos/bindings.ts` L103-106：

```
// Must run AFTER the loop starts: CocosLoopBridge.start() calls App.start(),
// which re-fits the viewport to platform.getScreenSize(). Doing this any
// earlier gets silently overwritten (observed 2026-09-13).
```

即：Cocos 侧靠"把 `_fitToGameCanvas()` 排到 `start()` 之后"来抢回 viewport 所有权。**harness 是唯一没有绕开它的宿主**（`dev/harness/main.ts` L82 `fitCanvas()` 在前、L255 `app.start()` 在后）。

### 1.3 harness 的实际错配（2026-09-14 实测，DPR=2）

harness 的设计意图是**端到端 device px**：`fitCanvas()`（L67-79）把 `canvas.width` 设为 `cssW*dpr` 并 `app.resize(deviceW, deviceH)`；`pushPointer`（L92-93）送 `event.clientX * dpr`。这套自洽。但 `app.start()` 把 viewport 拉回 **CSS px**，于是只剩输入半边还是 device px：

| 实测项 | 值 |
|---|---|
| `window.innerWidth/innerHeight` | 754 × 456（CSS px） |
| `devicePixelRatio` | 2 |
| `canvas.width/height`（backing store） | **1508 × 912**（device px） |
| `app.viewport.fit.screenWidth/Height` | **754 × 456**（CSS px ← 被 `start()` 覆盖） |

**可执行断言（现场跑通，非推演）**——取盘面子格 (1,1) 中心为已知设计点：

| 步骤 | 结果 |
|---|---|
| 目标设计点 | `(297.5, 851.5)` |
| `viewport.designToScreen(...)` | `(350.5, 164.9)` CSS px |
| **A** 把该 CSS px 喂回 `screenToDesign` | `(297.5, 851.5)` ← **精确回环 ✓** |
| **B** 把 `CSS px × dpr` 喂回（= `main.ts` L92-93 的实际行为） | `(1322.9, 369)` ← **落在 750×1334 之外 ✗** |
| B 的偏差 | `dx = +1025`、`dy = −482`（设计 px） |
| `viewport.containsScreenPoint(350.5, 164.9)` | `true` |
| `viewport.containsScreenPoint(701.0, 329.8)` | **`false`** ← 框架自己就拒收 |

⇒ 托盘与格子**全部点不中**，且这不是"画面缩小"这种 cosmetic 问题。

### 1.4 GAP-08 是同一次取证里独立确诊的第二处（仅 harness）

`adapters/canvas2d/canvas2d-renderer.ts` L82 用 `setTransform(scale, 0, 0, -scale, offsetX, offsetY+viewHeight)` 实现设计空间 y-up 的期望翻转；但 L133-141 的 `case 'text'` 直接 `fillText(cmd.text, cmd.x, cmd.y)`，**未补偿该翻转** ⇒ 文字垂直镜像。

实测：harness 3 帧内 **24 次 `fillText`，每一次的 CTM 都是 `a = +0.3418 / d = −0.3418`**（负 `d` = 翻转生效中）。

**Cocos 路径不存在这条机制**：文字走 `CocosRender2D` + `label-pool.ts` 的原生 `Label` 节点，实测 8 个 Label 的位置是 `y = +607`（设计 y=1274）与 `y = −569`（设计 y=98）——**Canvas 中心原点、y 向上、全程无 2D context 变换**。

### 1.5 约束

- **L2**：core 禁 `cc` / DOM / `wx` ⇒ DPR 不能进 `Viewport`（它属 core）。
- **L5**：UI/渲染不持有状态 ⇒ DPR 不能作为渲染器的可变状态被游戏层读写。
- `bindings.ts` 是**真机输入路径**，改坏会污染微信侧 ⇒ 本决策不得要求修改它。
- 取证附带发现（不属本 ADR 主题，另立缺口）：Cocos 构建把 `[...非数组可迭代对象]` 转译为 `[].concat(x)`，导致 beads 在 web-mobile 产物里 BOOT 校验恒失败、冲刺模式硬崩溃。见 `docs/engine-reference/cocos/VERSION.md` §3 **G10**。

---

## 2. 备选方案（Alternatives）

### 方案 A：改框架契约为 device px（`Viewport`/`InputManager` 全面改口径）

- **事实对比**：需要同时改 `input-manager.ts` 契约文本、`bindings.ts` L117-139（`_fitToGameCanvas` 读的是 `#GameCanvas.clientWidth/clientHeight` = CSS px，须改成乘 DPR）、`bindings.ts` L204-213 的输入注释、`platform/weapp.ts`（`wx.getWindowInfo()` 给的是逻辑像素，须自行乘 `pixelRatio`）。
- **代价**：① 触碰真机输入路径，任何差错直接表现为"微信上点不中"，而**当前无 AppID、无真机**，改完无法验证；② `wx.getWindowInfo().pixelRatio` 在部分安卓机型上与实际 backing store 不一致的历史问题会把不确定性引进 core；③ 与 Web 平台惯例（`clientX` 天然是 CSS px）逆行，每个新宿主都要记得乘一次；④ `Viewport` 属 core，让它承载 DPR 语义违反 L2 的精神（core 不该知道"设备像素"这种宿主概念）。
- **结论**：**否决**。

### 方案 B：harness 全面改 CSS px，DPR 下沉到 `Canvas2DRenderer`，同时修 `App.start()` 的覆盖语义（**本 ADR 采用**）

- **事实对比**：三处改动，互不重叠——
  1. `app.ts::start()`：改为**不覆盖宿主已显式设置的 viewport**（平台值降级为兜底）；
  2. `dev/harness/main.ts`：`fitCanvas()` 调 `app.resize(cssW, cssH)`，`pushPointer` 送 `event.clientX/clientY`（**不乘 dpr**）；
  3. `adapters/canvas2d/canvas2d-renderer.ts`：自行按 `pixelRatio` 设 backing store 并在变换里前置 DPR 缩放；`case 'text'` 内做局部 y 补偿（GAP-08）。
- **代价**：见 §4.2。
- **结论**：**采用**。契约不变、真机路径零改动、harness 与 Cocos/weapp 三者口径统一。

### 方案 C：只改 harness 的 `pushPointer`（不乘 dpr），保留 `App.start()` 的覆盖行为

- **事实对比**：单点改动即可让点击立刻可用——因为 `start()` 恰好把 viewport 拉回了 CSS px，与"不乘 dpr 的 clientX"意外匹配。
- **代价**：① `fitCanvas()` 里的 `app.resize(deviceW, deviceH)` 变成**死代码兼定时炸弹**——它写着 device px，只因为后面有人覆盖才不出事；② `bindings.ts` L103-106 的"必须排在 loop 启动之后"的时序 workaround **必须永久保留**，且其成立理由（`start()` 会覆盖）被固化成契约的一部分；③ 任何宿主只要把 `resize()` 放到 `start()` 之后就静默错配，且**没有编译期或测试期信号**。
- **结论**：**否决**——它修好了症状，把病灶变成了依赖。

### 方案 D：`AppOptions` 增加 `screen?: ScreenSize`，由宿主在构造期声明尺寸与 DPR

- **事实对比**：把意图表达提前到构造期，`start()` 只在宿主未声明时才用平台值。
- **代价**：与方案 B 的 (1) 目标相同，但**表达力不足**——宿主尺寸是**可变的**（浏览器窗口 resize、微信 `onWindowResize`），构造期一次性声明无法覆盖；仍需要 `resize()` 作为运行时入口，于是变成两套并存的声明机制。
- **结论**：**否决**（其合理内核——"宿主意图优先"——由方案 B 的 (1) 以更小的接口面实现）。

---

## 3. 决定（Decision）

**屏幕坐标空间的唯一契约是 CSS px（top-left origin）；DPR 只由 renderer/adapter 层在 backing store 与绘制变换里承担，永不进入 `Viewport`、`InputManager` 或任何 core 类型。** 据此四项裁决：

### (a) `App.start()` 改为「宿主显式尺寸优先，平台值降级为兜底」

**不是**"干脆不 resize"。理由：weapp 侧没有 `document`，`bindings.ts::_fitToGameCanvas()` 会因取不到 `#GameCanvas` 而早退（L118-120 已有该守卫）；若删掉平台兜底，真机 viewport 会停在 750×1334 默认值上。

正确语义：`App` 记录"宿主是否显式调用过 `resize()`"；`start()` 仅在**从未显式设置**时才用 `platform.getScreenSize()` 兜底。这样：

- harness 的 `fitCanvas()` → `app.resize(cssW, cssH)` **成为生效值**，不再依赖调用顺序；
- `bindings.ts` 的时序 workaround 从"必需"降级为"冗余但无害"（本 ADR **不要求**改它，见 §4.2）；
- weapp 无宿主 resize 时行为与今天**完全一致**（零回归面）。

### (b) harness 改送 CSS px；框架契约不动

`pushPointer` 送 `event.clientX / event.clientY`（**去掉 `* dpr`**），`fitCanvas()` 送 `cssW / cssH`。DPR 由 `Canvas2DRenderer` 自行吸收（backing store = `css × dpr`，绘制变换前置 `dpr` 缩放）。**明确否决**"保留 device px 改框架契约"（方案 A）：它会波及 `bindings.ts` 与 `weapp.ts`，而当前无真机可验证。

### (c) `getScreenSize().pixelRatio` 的唯一合法消费者是 renderer/adapter 层

当前该字段**被所有调用方丢弃**，这是契约漏洞而不是"无用字段"。裁决：

- **消费者**：`Canvas2DRenderer`（backing store + 变换前置缩放）；Cocos 侧**由引擎自己消费**——实测 `#GameCanvas` CSS `754×456` 而 backing store `1508×912`（DPR=2），同时 `fit.screenWidth/Height` 仍是 `754×456`，即**引擎已经在 backing store 层吃掉了 DPR，viewport 与输入全程留在 CSS px**。这条实测是本裁决 (整条 ADR) 的最强证据。
- **禁止消费者**：`App`、`Viewport`、`InputManager`、任何 `games/*/src`（L2/L3）。
- **补文档**：`platform/platform.ts` 的 `ScreenSize.pixelRatio` 目前**无 JSDoc**（L20-24），T-087 须补一行"仅供 renderer/adapter 层设定 backing store 使用；不得用于换算坐标"，并同步收紧 `InputSnapshot.x/y/dx/dy` 的注释（现写 "in screen pixels"，未限定 CSS px）。

### (d) 回归防线：一条可执行断言，防再退化

**断言名**：`pointer round-trip hits the intended design cell at DPR=2`
**建议落点**：`packages/framework/tests/core/viewport-dpr-contract.test.ts`（新增；当前 `tests/core/` 下只有
`render-model.test.ts` 与 `input-manager.test.ts`，**无 viewport 测试文件**；落码归 **T-087**）
**形态**（§1.3 的表格已在浏览器里逐行跑通，此处固化为测试）：

```ts
// DPR must never leak into the screen↔design round-trip.
const vp = new Viewport(750, 1334);
vp.resize(754, 456);                      // CSS px — 契约口径，不是 1508×912
const scr = vp.designToScreen({ x: 0, y: 0 }, 297.5, 851.5);
expect(vp.containsScreenPoint(scr.x, scr.y)).toBe(true);
const back = vp.screenToDesign({ x: 0, y: 0 }, scr.x, scr.y);
expect(back.x).toBeCloseTo(297.5, 6);     // 精确回环
expect(back.y).toBeCloseTo(851.5, 6);
// 越界方向必须被拒收：device px 喂进来时框架要"说不"，而不是静默映射到别处
expect(vp.containsScreenPoint(scr.x * 2, scr.y * 2)).toBe(false);
```

配套第二条（宿主级，落点 `tools/scripts/smoke-harness.mjs`）：断言 harness 产物的 `viewport.fit.screenWidth === canvas.clientWidth`（**不是** `canvas.width`）——这一条直接钉死"viewport 用 CSS px、backing store 用 device px"的分层。

> ⚠️ **DPR 必须显式注入，不能读环境**：无头 CI 浏览器常见 `devicePixelRatio === 1`，届时"乘 dpr"与"不乘"结果相同，断言会退化为恒真而**静默失效**。测试须自建 `pixelRatio: 2` 的桩。

---

## 4. 后果（Consequences）

### 4.1 正面

1. **三个宿主口径统一**：harness / Cocos(web-mobile, wechatgame) / weapp 全部 CSS px，`bindings.ts` 与 `weapp.ts` **零改动**，真机路径零回归面。
2. **消除顺序依赖**：`resize()` 的生效不再取决于它排在 `start()` 前还是后——§1.2 那类"silently overwritten"注释不再需要存在。
3. **契约有了牙齿**：§3(d) 的两条断言把"CSS px"从注释升级为可执行判据，退化会红。
4. **DPR 归属明确**：`pixelRatio` 从"被丢弃的字段"变成"有唯一合法消费者的字段"，后人不会再去 `Viewport` 里找它。

### 4.2 负面（已知成本，不是风险）

1. **`bindings.ts` 的时序 workaround 会变成"冗余但仍在"的双真源。** L103-106 那段注释描述的行为（`start()` 会覆盖）在 (a) 落地后**不再成立**，但本 ADR 刻意不改 `bindings.ts`（真机输入路径 + 无真机可验证）。于是仓库里会同时存在"新语义"和"描述旧语义的注释"，**必须**由 T-087 在该注释上追加一行指向本 ADR，否则下一个人会照着旧注释推理。这是**已知的文档债**，不是意外。
2. **兜底路径与显式路径长期并存 ⇒ 两条 resize 语义各自都要测。** (a) 保留了平台兜底（weapp 需要它），于是 `start()` 有两个分支。分支覆盖不足时，"宿主忘了 resize"这类错误会表现为静默用平台值——**比今天更难发现**，因为今天至少是稳定的错。
3. **backing store 与 viewport 尺寸从此不相等 ⇒ 任何直接读 `canvas.width` 当 screen px 的代码会静默错位。** 现存嫌疑点：`dev/harness/main.ts` 的调试 HUD 绘制、`tools/scripts/smoke-harness.mjs` 的 Canvas 桩、`tools/scripts/render-harness-frame.mjs`（离屏出帧）。T-087 必须逐个核对，**这类错位不报错、只画歪**。
4. **GAP-08 的修法引入一条不可见耦合：`textBaseline` 语义随 y 翻转而变。** 局部补偿（`save → translate(x,y) → scale(1,-1) → fillText(text,0,0) → restore`）之后，`baseline: 'top'` 与 `'bottom'` **必须互换**，`'middle'` / `'alphabetic'` 不变。这条规则没有任何类型或测试会自动提醒；未来新增 baseline 取值、或改用 `measureText` 做垂直居中时会再踩一次。另有每次 `fillText` 一对 `save/restore` 的开销（实测约 8 次/帧，可忽略但非零）。
5. **修复面被刻意收窄，因此"看起来更简单的全局改法"被永久禁止。** 禁止改 L82 的全局 `setTransform`：▲/▽/♥/◐ 等矢量符号在 y-up 下形状自洽，翻转全局矩阵会破坏三重编码（形状 + 颜色 + 位置）中的形状那一重。这条禁令需要写进 `control-manifest.md`，否则会被当成"顺手优化"改掉。
6. **本 ADR 只出裁决不落码 ⇒ 存在一个"harness 人工验证结论全部不可信"的窗口期。** 从本 ADR 落盘到 T-087 合入之间，任何基于 harness 目视/点击的 QA 结论都必须标注 `[Harness-坐标未修]`（`production/TASKS-DETAIL.md` T-084 已如此约束）。窗口期长短由 T-087 的排期决定，**这是本决策的直接代价**。
7. **§3(d) 的断言在 DPR=1 环境下会静默失效**（见 §3(d) 末尾的 ⚠️）。若 T-087 图省事直接读 `window.devicePixelRatio`，防线等于没建。

### 4.3 中性 / 待观察

- **Cocos 侧 DPR 由引擎处理，我们无法干预也无需干预**——实测已确认分层正确。但若未来 Cocos 改变 `#GameCanvas` 的 backing store 策略（例如暴露 `macro.ENABLE_TRANSPARENT_CANVAS` 之外的缩放开关），(c) 的"引擎自己消费"前提需重新验证。
- **`safeArea` 未纳入本契约。** `weapp.ts` 已有 `safeArea` 计算（VERSION.md G8 仍未真机验证）。安全区是 CSS px 还是物理像素，本 ADR **不作裁决**——等真机可用时另议。
- **G10（`[].concat` 转译缺陷）与本 ADR 无因果关系**，但它使本轮 Cocos 取证必须靠运行时绕过 BOOT 门禁才能进行（见 §5 与 VERSION.md G10）。若 G10 的修复改变了 Cocos 的构建目标（例如提到 ES2015+），§1.4 的 Label 位置实测值需重跑确认。

---

## 5. 复评触发条件（Review Triggers）

出现以下任一情况，重新评估本决策：

1. **真机（微信开发者工具 + AppID 就绪后）出现点击偏移或文字镜像** ⇒ 说明"CSS px"契约在 weapp 侧的实际交付值与假设不符，(b) 的否决理由（方案 A）需重估。
2. **出现第三个宿主**（如 node/终端渲染器、或第二个引擎适配器）且它无法提供 CSS px 语义的指针坐标 ⇒ 评估是否需要在 `AppOptions` 引入显式坐标空间声明（方案 D 的内核）。
3. **`ScreenSize` 增加字段**（`safeArea` / `orientation` / `windowWidth` 与 `screenWidth` 分离）⇒ (c) 的"唯一消费者"边界需重新划。
4. **`Canvas2DRenderer` 出现 `_applyTransform = false` 的使用方**（离屏出帧、缩略图、`render-harness-frame.mjs`）⇒ §4.2(4) 的 baseline 互换规则在该路径下是否仍成立需单独验证。
5. **Cocos 构建目标从 ES5 提升**（关联 VERSION.md G10）⇒ §1.4 的 Label 实测坐标与 §1.3 的 canvas/backing 实测值全部需要重跑；本 ADR 的证据基线随之更新。
6. **`bindings.ts` L103-106 的时序注释被删除或改写** ⇒ 必须同时确认 §4.2(1) 的文档债已清偿。
7. **DPR ≠ 2 的目标设备成为主要机型**（例如 dpr=3 的安卓占比上升）⇒ §3(d) 断言的注入值需覆盖该档位，`Canvas2DRenderer` 的 backing store 上限策略（harness 现在 `min(dpr, 2)` 封顶）需重新评估。
