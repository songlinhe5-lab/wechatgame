# Cocos 3.8.8 API 取证 —— 已验证结论（G2–G6）

> **定位**：本文是 `VERSION.md` §3 知识缺口清单的**详细取证附录**。
> `VERSION.md` 保持「版本钉定 + 缺口清单 + 结论摘要」，逐条证据与行号引用放这里
> （2026-09-14 拆分，起因：回填后 `VERSION.md` 越过 `ctx:check` B 项 8000 tokens 上限）。
>
> **证据真身路径（重要）**：`games/breakout/cocos/temp/declarations/cc.d.ts` 只是**壳文件**
> （仅一行 `/// <reference>`），真正的 3.8.8 声明在
> `/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/bin/.declarations/cc.d.ts`
> （含 JSDoc，约 3.3 MB）。**下文行号均指该文件**。
>
> **判据分层**（本文全程遵守）：
> ① 能由声明回答的 → 给行号；② 声明回答不了的 → 如实标「声明未明说」，改由**实测**闭环；
> ③ 真未闭环的 → **单独登记，不得记为已关闭**。

---

## G2 — `Graphics` API

| 问题 | 结论（行号） |
|---|---|
| `rect(x,y,w,h)` 的 `x,y` 是哪个角 | **矩形左上角**。JSDoc：`@en The x-axis coordinate of the **top left** point of the rectangle.`（L3286-3293）⇒ 框架左下设计空间**确实需要 y 翻转**；预览实测渲染正确 ⇒ 现有翻转实现**是对的** |
| `roundRect` 是否存在／参数顺序 | **存在**：`roundRect(x, y, w, h, r)`（L3313）⇒ 代码里可选 `roundRect?` + 直角降级**不再是必需** |
| `circle` 参数语义 | `circle(cx, cy, r)`（L3277）⇒ 前两参为**圆心**，第三为半径 |
| `close()` 是否需显式调用 | `close()`（L3347）、`stroke()`（L3355）、`fill()`（L3363）三者**并列存在** |
| `lineWidth`／`fillColor`／`strokeColor` 是属性还是 setter | **属性访问器**（`get`），非 `setXxx()`：`get lineWidth(): number`（L3086）、`get strokeColor(): Readonly<Color>`（L3113）、`get fillColor(): Readonly<Color>`（L3122）⇒ `g.lineWidth = n` / `g.fillColor = c` 写法正确 |
| `moveTo/lineTo` 之外 | 已见 `moveTo`(L3172) / `lineTo`(L3185)；`bezierCurveTo` 等**本作未使用**，登记为「未使用」而非「未知」 |

**⚠️ 由此得到的新约束（代码评审要点）**：`strokeColor` / `fillColor` 的 getter 返回 **`Readonly<Color>`**
⇒ **只能整体赋值**；`g.fillColor.r = 1` 这类原地修改**不合法**（且类型系统不会拦住"我本意是改颜色"）。

---

## G3 — `Label` 行为与对齐

| 问题 | 结论（行号） |
|---|---|
| 对齐枚举的**确切名** | ❌ 此前写作 `Label.HorizontalAlign`，**该名称不存在**。真名是两个**独立枚举**：`HorizontalTextAlignment { LEFT=0, CENTER=1, RIGHT=2 }`（L2255-2267）、`VerticalTextAlignment { TOP=0, CENTER=1, BOTTOM=2 }`（L2280-2292）。`Label` 上对应属性：`get horizontalAlign(): HorizontalTextAlignment`（L2406）、`get verticalAlign(): VerticalTextAlignment`（L2415） |
| `baseline`（top/middle/bottom）如何映射 | 不存在名为 `baseline` 的 API；**它就是 `VerticalTextAlignment.TOP / CENTER / BOTTOM`** |
| `Label.color` 是对象赋值还是 setter | **属性访问器**，getter 返回 **`Readonly<Color>`**（L1368 / L2103 / L2146 / L2187）⇒ `label.color = new Color(...)` 正确；**不可原地改** |
| 其它已确认属性 | `get string()`（L2397）、`get fontSize(): number`（L2433）、`get lineHeight()`（L2442）、`get overflow(): Overflow`（L2460；`enum Overflow` L2299） |
| **锚点默认值** | ⚠️ **声明不给默认值**（`UITransform.get anchorPoint(): Readonly<Vec2>` 仅给类型，L1543）⇒ 只能由**实测**回答 |
| `Label` 是否需要 `UITransform` | 声明不直接回答；**实测**：HUD 文字正常渲染 ⇒ 当前用法下成立 |

**实测闭环（预览全链路验收，2026-09-14 08:31）**：分数 / 连击 / 横幅文字**位置正确、未跑偏** ⇒
锚点默认值与对齐行为在当前用法下**已目视验证通过**。

**⚠️ 真未闭环项（≠「未验证」）**：`_anchorForText()` **仍用 `字符数 × 字号 × 0.55` 估算宽度**
（`packages/framework/src/adapters/cocos/cocos-renderer.ts:171`）。`VERSION.md` G3 明确要求
「**必须**用真实 `Label` 尺寸替换（建议用 `UITransform.width` 回填）」——**尚未执行**。
⇒ 当前目视通过，但换文本长度 / 字号 / 字体时存在跑偏风险。已在 `production/TASKS.md` backlog 登记。

---

## G4 — 触摸事件与坐标系

| 问题 | 结论（行号） |
|---|---|
| `Node.EventType.TOUCH_*` 的准确拼写 | 官方常量值**就是字符串**：`TOUCH_START = "touch-start"`（L26163 / L32531）⇒ 代码里的字符串 `'touch-start'` 与官方常量值**逐字一致**，不是"暂时将就" |
| `EventTouch.getUILocation()` 坐标系 | 存在且返回 `math.Vec2`（L33131）；JSDoc 仅称 *"Returns the current cursor location in **ui coordinates**"* ⇒ **原点在左下还是左上，声明未明说** |
| `EventTouch.getID()` | **存在**：`getID(): number \| null`（L33321）——注意**可为 `null`**，消费方须处理 |
| 节点需要多大 `UITransform` 才能接住全屏触摸 | 声明不涉及；**实测**：`GameRoot` 内容尺寸 750×1334 且拖拽正常 ⇒ 当前设置成立 |
| `mapPoint` 的猜测性 y 翻转 | ✅ **实测已证明正确**（见下） |

**实测闭环（预览全链路验收，2026-09-14 08:31）**：信箱区（letterbox）拖挡板时，画布相对 x=495 → 设计空间 608，
**与 letterbox 公式精确吻合** ⇒ 触摸坐标系与 y 翻转**已由实测验证**，不再是"猜测"。
（该吻合同时间接证实：`getUILocation` 返回的是 **UI 坐标**而非物理像素。）**G4 关闭。**

---

## G5 — 帧驱动与调度

| 问题 | 结论（行号） |
|---|---|
| `schedule(cb, interval)` 签名 | `schedule(callback: any, interval?: number, repeat?: number, delay?: number): void`（L25696）——**四参皆可选** |
| 回调首参是**秒**还是毫秒 | 回调形如 `(dt) => …`（官方 JSDoc 示例 `this.schedule((dt) => void log(...), 1)`）；同段 JSDoc 明写 `@param delay The delay time for the first invocation, **Unit: s**` ⇒ **整套调度单位为秒** |
| `interval = 0` 是否表示"每帧" | ⚠️ **声明未明说**（`@param interval` 仅称 "The time interval between each invocation"）⇒ 由**实测**回答。旁证：`repeat` 的 JSDoc 提到 `macro.REPEAT_FOREVER` 用于一直循环（L22308-22309） |
| `unschedule` 是否要求**同一函数引用** | `unschedule(callback_fn: any): void`（L25720），JSDoc 示例 `this.unschedule(_callback)` ⇒ 需同一引用；代码用闭包引用成立（纯逻辑单测已覆盖） |
| 与 `director.getDeltaTime()` 的差异 | `getDeltaTime(): number` 存在（L27754）；**未做两者数值对比**（本作只用 `schedule`）⇒ 登记为**未比较**，非「未知」 |

**实测闭环（预览全链路验收，2026-09-14 08:31）**：球速与预期一致、三项验收全绿 ⇒
「`schedule(cb, 0)` 每帧触发 + `dt` 按**秒**传入」**已被实测证实**——
若 `dt` 是毫秒，球速会快约 1000 倍；若 `interval=0` 不表示每帧，游戏根本不会推进。**G5 关闭。**

---

## G6 — 装饰器与脚本注册

> 本条以**运行时实测**为准（声明侧未取到 `ccclass` 的独立声明）。

- **`@ccclass('BreakoutBootstrap')` 名称注册**：**实测**——`Main.scene` 挂载该组件，场景加载后组件被实例化并运行
  （游戏可玩）⇒ 注册成功。**未测**"重名会怎样"，登记为**未测**（非未知）。
- **`@property` 可见性 / 序列化**：`_decorator.property` 声明存在**三种重载**（`property(options?)` /
  `property(type)` / `property(...args)`，L21043 / L21050 / L21056）。**本作未使用 `@property`**
  （无编辑器可配字段，符合 ADR-0003「场景里只有 GameRoot + 一个脚本」）⇒ 登记为**未使用**，不阻塞。
- **脚本必须放在哪个目录才会被编译**：**答案 = 在 `assets/` 下即可，不限子目录**。实测
  `assets/scripts/{BreakoutBootstrap.ts, framework/**, game/**}` **全部进入构建产物**
  （`build/wechatgame/assets/main/index.js` 命中 `BreakoutBootstrap`）。**G6 实质关闭。**

---

## 与方法论相关的两条经验（供后续回填复用）

1. **先分层再动笔**：能由声明回答的**绝不用推测**；声明回答不了的**明确写「未明说」**并交给实测；
   两者都不成立的**登记为真未闭环**，不许记成"已验证"以让文档好看（`VERSION.md` §6）。
2. **按关键词裁剪/回填前先看命中上下文**：本轮裁引擎时，`Animation` 的 4 处匹配实为
   **`requestAnimationFrame`**（浏览器 API），**不是**引擎 `Animation` 模块——只按关键词下结论会误裁。
