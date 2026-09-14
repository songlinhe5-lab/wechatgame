# Cocos Creator — 引擎版本钉定与知识缺口清单

- **钉定版本**：Cocos Creator **3.8 LTS**（当前最新 3.8.8，2025-12 发布）
- **参考版本（不采用，仅观察）**：Cocos Creator 4（2025-11 开源）
- **更新日期**：2026-09-14（WXG-T-082 据实修订）
- **维护人**：程基岩
- **对应决策**：ADR-0001 / ADR-0002 / ADR-0003 / ADR-0009（编辑器 MCP）/ ADR-0011（坐标空间契约）

> ⚠️ **本文档的核心是第 3 节「知识缺口清单」。**
> 凡是无法确认的 API 与步骤，一律登记在此，**不臆造、不猜测、不写进代码当作已验证**。

> ✅ **2026-09-14 环境事实修订（WXG-T-082）——本文档开篇此前写作「本轮开发环境没有安装 Cocos Creator
> 编辑器，因此无法编译、无法运行、无法生成 `.scene` / `.prefab` / `.meta`」，该陈述已过时，据实更正为：**
>
> | 项 | 实测事实（2026-09-14） | 取证方式 |
> |---|---|---|
> | Cocos Creator | **3.8.8 已安装**，`/Applications/Cocos/Creator/3.8.8/` | `tools/scripts/build-cocos.mjs` L51 硬编码该路径且构建成功；运行时 `cc.ENGINE_VERSION === "3.8.8"` |
> | 编译 / 构建 | **可** | `pnpm run build:cocos:web`（beads，**17.1s** 成功）／`build:cocos --release`（wechatgame，breakout 已实测） |
> | 运行 | **可**（web-mobile 产物 + 浏览器） | `python3 -m http.server 8090` 服务 `games/beads/cocos/build/web-mobile/`，浏览器加载后场景图、`Label.string`、`viewport.fit`、`snapshot` 全部读出 |
> | `.scene` / `.meta` 生成 | **可**（由编辑器生成，L1 禁手编） | `games/beads/cocos/assets/Main.scene` + `.meta`，uuid `9683d2dd-7e97-4fe3-a54d-3e2ef554406a` |
> | beads Cocos 工程 | **已建**（不再是「未立项建工程」） | `games/beads/cocos/`：`assets/Main.scene`、`assets/scripts/BeadsBootstrap.ts`、`engine.json` 11 项 true（与 breakout 逐项相同） |
> | 编辑器 MCP 服务 | **在线** | `curl http://127.0.0.1:3000/health` → `{"status":"ok","tools":21}`；`build:cocos:web` 日志亦探测到「编辑器 MCP 在线」⇒ **T-079 遗留的那一步 GUI 已完成** |
> | `.prefab` | **仍未生成任何 prefab**（ADR-0003 空场景路线刻意不用） | 仓库内无 `.prefab` 文件 |
> | **微信开发者工具** | ❌ **未安装** | 无法真机预览 / 扫码 / 上传 |
> | **AppID + 上传私钥** | ❌ **仍缺** | `wechatgame` 产物可构建（CLI 不需要 AppID），但**无法上真机**；G8 / R4 因此仍未闭环 |
>
> **⇒ 阻塞面已从「无编辑器」收窄为「无微信开发者工具 + 无 AppID」。** 依赖编辑器产物的工作不再受阻；
> 依赖**真机**的工作（G8 平台层、R4 性能、§8-9 DevTools 帧检）仍然受阻。

---

## 1. 版本策略

| 项 | 数值 / 策略 |
| --- | --- |
| 钉定大版本 | `3.8` LTS |
| 钉定具体版本 | `3.8.8`（当前最新 LTS 补丁） |
| 补丁升级策略 | 允许 `3.8.x` 内自动跟随；`x` 升级后需回归真机测试 |
| 跨大版本 | **禁止**未经 ADR 复评升级到 4.x |
| 微信基础库 | 待定——需在微信开发者工具里选定"最低基础库版本"后回填本节 |
| 微信导出目标 | 微信小游戏（`wechatgame` build target） |
| 设计分辨率 | 750 × 1334（竖屏，`Canvas` + `UITransform`，`Fit Height`） |

### 为什么是 3.8 LTS 而不是 4

Cocos 4 于 2025-11 开源，距本决策不足一个月；其微信小游戏导出链路、真机表现、第三方插件生态**均未经验证**。把矩阵的地基压在一个刚开源的版本上是不可接受的风险。详见 ADR-0001 §2 方案 B 与 §5 复评触发条件。

---

## 2. 引擎能力清单（本项目实际依赖）

只列我们**真的会用**的 API。构建时应据此裁剪模块。

| 能力 | 使用的 API | 用途 | 状态 | 取证方式（2026-09-14 修订） |
| --- | --- | --- | --- | --- |
| 组件与节点 | `Component`, `Node`, `Node.addChild`, `Node.addComponent`, `Node.setPosition` | 代码构建节点树（ADR-0003） | ✅ 已实测 | 浏览器内遍历 `cc.director.getScene()`，得 `Main → Canvas(UITransform/Canvas/Widget) → Camera + GameRoot(UITransform + BeadsBootstrap) → Graphics + Labels(×8)` |
| UI 变换 | `UITransform.setContentSize` | 设置设计分辨率与命中区域 | ✅ 已实测 | 同上遍历读到 `UITransform` 组件；`#GameCanvas` CSS 754×456 与 `viewport.fit` 逐项吻合 |
| 矢量绘制 | `Graphics.clear/rect/roundRect/circle/moveTo/lineTo/close/fill/stroke`, `fillColor`, `strokeColor`, `lineWidth` | 全部矢量图形（砖块/球/挡板/HUD） | ✅ 签名已验证<br>⚠️ **像素级目视未取证** | 签名由官方声明回填（见 §3 G2）。**运行时像素未取证**：浏览器视图 `visibilityState=hidden`，截图接口返回 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`；仅取到「`Graphics` 节点存在且被渲染器持有」这一层 |
| 颜色 | `Color(r,g,b,a)` | 把 `#rrggbb` 转成引擎颜色 | ✅ 已验证 | 官方声明（§3 G2）：`fillColor`/`strokeColor` getter 返回 `Readonly<Color>` ⇒ 只能整体赋值；构建与运行均无相关报错 |
| 文本 | `Label.string`, `Label.fontSize`, `Label.color`, `Label.node.active` | 分数 / 连击 / 横幅 | ✅ 已实测 | 读出 8 个池化 `Label` 的真实内容：`"05:00"` fs44 @(0,607)、`"LV 1/8"` fs22 @(119,607)、`"×1"`/`"区域消除"` fs28 @(−236,−569)/(−236,−603) 等。**y 为正=上**（设计 y=1274 → 节点 y=+607），确证原生左下原点、无 2D context 变换 |
| 触摸输入 | `Node.on('touch-start'/'touch-move'/'touch-end'/'touch-cancel')`, `EventTouch.getID/getUILocation` | 拖拽挡板、点击发射 | ✅ 已实测（breakout）<br>⚠️ beads 未单独实测 | §3 G4 已关闭：信箱区拖挡板（画布相对 495 → 设计 608）与 letterbox 公式精确吻合。beads 侧本轮**未做点击实测**（GAP-07 反证走的是 `viewport` 数值对照，非真实触摸） |
| 帧驱动 | `Component.schedule(cb, 0)`, `Component.unschedule(cb)` | 把引擎帧接进框架固定步长循环 | ✅ 已实测 | §3 G5 已关闭（球速与预期一致）。本轮另证：页面 `hidden` 时 `rAF` 不触发 ⇒ 导演停摆，改用 `app.tick(1/60)` **手动驱动**可正常推进状态机（`boot → playing`） |
| 生命周期 | `start()`, `onDestroy()` | Bootstrap 入口与清理 | ✅ 已实测 | `BeadsBootstrap` 被实例化并运行：`GameRoot` 上可读到组件实例、其 `_app` 存在、游戏进入 `boot` 相 |
| 装饰器 | `_decorator.ccclass`, `_decorator.property` | 脚本注册与编辑器属性 | ✅ 已实测 | §3 G6 已关闭：`Main.scene` 挂载的组件被实例化；`property` 本作未使用（符合 ADR-0003） |

**未使用（刻意不用）**：内置 2D 物理、动画系统（`Animation`/`Tween`）、粒子、`Timeline`、`Widget` 布局、`ScrollView`、Asset Bundle（暂未接入）。理由：这些能力都被框架的 `RenderModel` / 数据驱动方案替代，且它们会引入新的场景文件依赖（ADR-0003）。

---

## 3. 知识缺口清单（**必须在编辑器里逐条验证**）

> 每一条都是"我**无法**在无编辑器环境下确认"的事实。请在 Cocos Creator 3.8.8 就绪后按序验证并回填结论。

### G1 — 框架源码如何被 Cocos 工程引用【基线已落地（方案 C），残余风险见下】

- **问题**：`packages/framework` 是独立 npm 包（`@wxgame/framework`，`exports` 指向 `.ts` 源码）。Cocos 3.8 的工程**能否**直接 import 工作区内的 TS 源码包？`node_modules` 中的裸 TS 是否会被编辑器编译？
- **✅ 已实施基线（2026-09-13）——候选方案 (c) 物理拷贝**：
  - `tools/scripts/sync-framework-to-cocos.mjs`（`pnpm run framework:sync` / `framework:sync:check`）把 `packages/framework/src` 拷到 `cocos/assets/scripts/framework/`、`games/breakout/src` 拷到 `cocos/assets/scripts/game/`；拷贝时把裸包名 `'@wxgame/framework'` 改写为指向框架拷贝目录的相对路径。
  - 入口 `cocos/assets/scripts/BreakoutBootstrap.ts` 已创建，导入拷贝件真实路径。
  - **类型检查已通过**：`cocos/tsconfig.check.json`（extends 编辑器生成的 `temp/tsconfig.cocos.json`，用真实 `cc` 声明）`tsc --noEmit` 全量通过，含唯一 import `cc` 的 `bindings.ts`。
  - **`.js` 后缀实证（Node 侧）**：TS 5.6/5.9 在 `moduleResolution: "node"`（temp 配置取值）下能解析 `.js` → `.ts` 映射。
    **⚠️ 2026-09-14 更正（WXG-T-047）**：拷贝件**默认已剥除** `.js` 后缀（`sync-framework-to-cocos.mjs` 实现为
    `stripSuffix = !includes('--keep-suffix')`，**strip 是默认**）。本行此前写作「拷贝件**保留** `.js` 后缀」，与实现**相反**。
- **未确认（残余风险，编辑器实测时逐项回填）**：
  - Cocos **自有构建管线**（编辑器内编译 / 微信小游戏构建）是否解析 `.js` 后缀导入——**该风险对本工程已不适用**（拷贝件默认无后缀，见上一条更正）；保留后缀的开关名是 `--keep-suffix`，**仓库中不存在 `--strip-suffix`**。
  - **收窄后的真实残余风险**：`export * from …` 这类 **ESM 语法本身**在 Cocos 构建管线中的处理——需一次真实构建确认。
  - 候选方案 (a) npm 包依赖、(b) dist 构建产物、(d) tsconfig paths 是否被编辑器支持——留待后续 ADR 评估能否替代拷贝基线。
- **当前做法**：源码用 `.js` 后缀导入（ESM 规范），vitest 侧通过 alias 指向 `src/index.ts`；Cocos 侧读拷贝件。

### G2 — `Graphics` API 的确切签名

- `Graphics.rect(x, y, w, h)`：**`x,y` 是左下角还是左上角？** 框架设计空间是左下，若 Cocos 是左上则需要在适配器里额外翻转。
- `Graphics.roundRect(x, y, w, h, r)`：**3.8.8 是否存在？参数顺序？**（代码里已写成可选 `roundRect?`，缺失时降级为直角矩形）
- `Graphics.circle(x, y, r)`：圆心？
- `Graphics.close()`：是否需要显式调用？`fill()` 后是否自动闭合？
- `Graphics.lineWidth` / `fillColor` / `strokeColor` 是**属性**还是 setter 方法？
- 是否存在 `Graphics.moveTo/lineTo` 之外需要的路径 API（`bezierCurveTo` 等）？
- **影响文件**：`packages/framework/src/adapters/cocos/cocos-renderer.ts`、`bindings.ts`

**✅ 2026-09-14 回填（WXG-T-050）**：`rect(x,y,w,h)` 的 `x,y` 是**矩形左上角**
（JSDoc 原文 `top left point`）⇒ 框架左下设计空间**确实需要 y 翻转**，预览实测渲染正确说明现有实现是对的；
`roundRect(x,y,w,h,r)` **存在**；`circle(cx,cy,r)` 为圆心+半径；`lineWidth`/`strokeColor`/`fillColor` 是
**属性访问器**，且颜色 getter 返回 **`Readonly<Color>`** ⇒ **只能整体赋值**。
逐条行号引用与完整表格见 **`api-verified.md` §G2**。

### G3 — `Label` 的行为与对齐

- `Label` 的锚点默认值？（代码假设居中，并按估算文本宽度做偏移 —— **需要目视校正**）
- `Label.color` 是 `Color` 对象赋值还是 setter？（代码用 `label.color = new Color(...)`）
- 水平对齐枚举（`Label.HorizontalAlign`）的确切成员名与赋值方式（代码里目前是**空实现**占位）。
- 垂直对齐如何设置？`baseline`（top/middle/bottom）如何映射？
- `Label` 渲染需要 `UITransform` 吗？字号与 `overflow` 设置如何影响布局？
- **影响文件**：`cocos-renderer.ts` 的 `_anchorForText()`、`bindings.ts` 的 `wrapLabel()`
- **已知局限**：`_anchorForText()` 用 `字符数 × 字号 × 0.55` 估算文本宽度 —— 这是**估算**，必须用真实 `Label` 尺寸替换（建议用 `UITransform.width` 回填）。

**✅ 2026-09-14 回填（WXG-T-050）**：对齐枚举真名是 **`HorizontalTextAlignment` / `VerticalTextAlignment`**
——**本文件此前写的 `Label.HorizontalAlign` 名称不存在**，这正是代码里留"空实现占位"的原因；
不存在 `baseline` API（用它即 `VerticalTextAlignment.TOP/CENTER/BOTTOM`）；`Label.color` 亦为
**只读属性访问器**。锚点默认值与 `UITransform` 依赖**声明不给答案**，由**实测**闭环（HUD 文字位置正确）。
**⚠️ 真未闭环项**：`_anchorForText()` 仍用 `字符数 × 字号 × 0.55` 估算宽度（`cocos-renderer.ts:171`），
本文件要求的真实 `Label` 尺寸替换**尚未执行** —— 目视通过但换字号/文本长度会跑偏，**不得记为已关闭**。
完整表格与行号见 **`api-verified.md` §G3**。

### G4 — 触摸事件与坐标系

- `Node.EventType.TOUCH_START` 等常量的**准确拼写**（代码里暂时用字符串 `'touch-start'`）。
- `EventTouch.getUILocation()` 返回的坐标系：**原点在左下还是左上？单位是设计空间还是物理像素？**
- `EventTouch.getID()` 是否存在？多点触摸 id 语义？
- Node 需要多大的 `UITransform` 才能接住全屏触摸？（代码假设 = 设计分辨率）
- 代码中的 `mapPoint: (x, y) => ({ x, y: DESIGN_HEIGHT - y })` 是一次**猜测性的 y 翻转**，必须验证后修正。
- **影响文件**：`input-bridge.ts`（纯逻辑已测）、`bindings.ts` 的 `_bindInput()` / `readTouch()`

**✅ 2026-09-14 回填（WXG-T-050）**：`Node.EventType.TOUCH_START` 的官方常量值**就是字符串 `"touch-start"`**
（与代码里的字符串逐字一致，不是"暂时将就"）；`getUILocation()` 存在且返回 `Vec2`，但 JSDoc **未明说原点**；
`getID(): number | null`（**可为 null**，消费方须处理）。坐标系原点由**实测**闭环——信箱区拖挡板
（画布相对 495 → 设计 608）**与 letterbox 公式精确吻合**，同时间接证实返回的是 UI 坐标而非物理像素。
**G4 关闭。** 完整表格与行号见 **`api-verified.md` §G4**。

### G5 — 帧驱动与调度

- `Component.schedule(cb, interval)` 中 `interval = 0` 是否表示"每帧"？
- 回调的第一个参数是**秒**还是毫秒？（框架 `App.tick()` 期望秒；`CocosLoopBridge` 按秒传参）
- `unschedule(cb)` 是否要求传入**同一个函数引用**？（代码用闭包引用，应满足，但需确认）
- 与 `director.getDeltaTime()` 相比，`schedule` 的 dt 是否有差异？
- **影响文件**：`loop-bridge.ts`（纯逻辑已测）、`bindings.ts`

**✅ 2026-09-14 回填（WXG-T-050）**：`schedule(callback, interval?, repeat?, delay?)`——**四参皆可选**；
JSDoc 明写 `@param delay … **Unit: s**` ⇒ **整套调度单位为秒**；`interval = 0` 的语义**声明未明说**，
由**实测**闭环（球速与预期一致 ⇒ "每帧触发 + dt 按秒"成立；若 dt 是毫秒球速会快约 1000 倍）。
`unschedule` 需传**同一函数引用**（代码用闭包成立）。**G5 关闭。** 完整表格与行号见 **`api-verified.md` §G5**。

### G6 — 装饰器与脚本注册

- `@ccclass('Bootstrap')` 的名称是否需要全局唯一？与文件名/类名的关系？
- `@property` 的可见性要求（`public`？）与编辑器序列化行为。
- 脚本必须放在 `assets/` 下的哪个目录才会被编译？（`assets/scripts/**` 是惯例，需确认）
- **影响文件**：`bindings.ts`

**✅ 2026-09-14 回填（WXG-T-050）**：`@ccclass` 注册由**实测**确认（`Main.scene` 挂载的组件被实例化并运行）；
`property` 声明存在三重载但**本作未使用**（符合 ADR-0003 无编辑器可配字段）；
**脚本放在 `assets/` 下即可被编译、不限子目录**——实测拷贝件（`framework/**` + `game/**`）全部进入产物。
**G6 实质关闭。** 详见 **`api-verified.md` §G6**。

### G7 — 构建与包体

- 构建产物（`build/wechatgame/`）的目录结构、主包/分包划分方式。
- 如何裁剪引擎模块？（编辑器"项目设置 → 功能裁剪"是否有 `graphics` / `label` 之外的被动依赖？）
- 构建后主包实际体积基线（**空场景 + 一个 Bootstrap 脚本**）是多少？这是我们唯一的"零成本基线"数据点。
- 微信开发者工具的最低基础库版本与我们用到的 API 是否兼容。
- **影响文件**：`tools/scripts/build-cocos.mjs`、`check-bundle-size.mjs`

**✅ 2026-09-14 实测回填（WXG-T-049）——G7 的包体基线部分关闭**

构建方式（**已脚本化**）：`pnpm run build:cocos`（wechatgame）/ `build:cocos:web`（web-mobile）。
两者都走 **Cocos 自带 CLI**：`CocosCreator --project <proj> --build "platform=<p>;debug=<bool>"`——
实测 **无 AppID 也能构建出 wechatgame 产物**，且编辑器实例开着可并存。

| 项 | 实测值 |
|---|---|
| 产物路径 | `games/<game>/cocos/build/wechatgame/`（**CLI 默认落工程内**，与 `architecture.md §1/§5` 的 `games/<game>/build/` 不同；`check:size` 两处都扫） |
| 构建耗时 | debug 30.4s ／ **release 40.4s** ／ web-mobile 12.5s（首次） |
| **主包基线（release）** | **3008.3 KB**（gzip 参考 809.0 KB，30 个文件） |
| debug 对照 | 6332.2 KB ⇒ **release 约减半**。**包体数字只对 release 有意义**（debug 含 sourcemap 且不压缩） |
| 判定 | 红线 4096 KB ✅ 通过（余量 1087.7 KB / 26.6%）；内部目标 2000 KB ⚠️ 超 1008 KB |
| `architecture.md` R3 复评触发（>3.2 MB） | ✅ 未触发（2.94 MB） |
| 分包 | `game.json` **无 `subpackages` 字段** ⇒ 当前无分包，全部计入主包 |

**体积构成（release，顶层）：**

| 分区 | 体积 | 说明 |
|---|---|---|
| `cocos-js/` | **2560 KB** | 引擎。**占主包 85%**，超 §3.8② 引擎预算（≤1800 KB）**760 KB** |
| `assets/` | 308 KB | 业务与资源（其中 `assets/main/index.js` 112.2 KB = 我们的游戏代码） |
| `src/` | 44 KB | settings/import-map 等 |
| 根文件 | ~158 KB | `web-adapter.js` 87.9 / `engine-adapter.js` 19.9 / `first-screen.js` 17.9 / `logo.png` 14.2 / `slogan.png` 11.2 / … |

**⚠️ 由此暴露的真实缺陷（已登记 backlog）：功能裁剪未执行。**
`cocos/settings/v2/packages/engine.json` 的模块开关（`modules.configs.defaultConfig.cache[*]._value`，与构建日志的 `features=[…]` 逐个吻合）
仍含 `spine-3.8`（**`assets/spine-*.wasm` 实测 200.4 KB**）、`dragon-bones`、`tiled-map`、`video`、
`webview`、`particle-2d`、`physics-2d-box2d`、`mask`、`rich-text`、`animation` 等本作**未使用**的模块——
而 `games/breakout/cocos/README.md` §3 步骤 2 明确要求取消它们。
该配置**在版本控制内、可脚本化修改**（非 `.scene`/`.meta`，不受 L1 约束），
但**禁用模块后必须回归实玩验收**（不排除误禁被动依赖）。

**✅ 2026-09-14 裁剪已执行（WXG-T-051）——内部目标首次达成**

**证据前置（先证"真的没用到"，再裁）**：全量 `cc` 导入符号实测**只有 7 个**——
`Color` / `Component` / `Graphics` / `Label` / `Node` / `UITransform` / `_decorator`；
待裁模块在 `packages/framework/src` + `games/breakout/src` + `cocos/assets/scripts` 中引用数 **全为 0**。
（注意一个假命中：`Animation` 的 4 处匹配实为 **`requestAnimationFrame`**（浏览器 API），**不是**引擎 `Animation` 模块。）

**改动**：`cocos/settings/v2/packages/engine.json` 的模块开关 **24 → 11 项 `_value: true`**，关闭 **13 个**：
`animation` / `audio` / `dragon-bones` / `mask` / `particle-2d` / `physics-2d` / `rich-text` /
`spine` / `spine-3.8` / `tiled-map` / `tween` / `video` / `webview`。
保留（11 项）：`2d` / `affine-transform` / `base` / `custom-pipeline` / `gfx-webgl` / `gfx-webgl2` /
`graphics` / `intersection-2d` / `profiler` / `render-pipeline` / `ui`。

> **本段更正（2026-09-14，WXG-T-053 复核）**：本节此前写作「`includeModules` **22 → 10** / 关闭 **14 个**」，
> 三处与事实不符 —— ① **`includeModules` 这个键在该文件里根本不存在**，真实结构是
> `modules.configs.defaultConfig.cache[<模块>]._value`（`globalConfigKey = "defaultConfig"`，共 **55 项**）；
> ② 计数是 **24 → 11**（不是 22 → 10）；③ 保留清单**漏了 `render-pipeline`**，关闭清单**多列了
> `physics-2d-box2d`**（它首版即为 false，实际关闭的是 `physics-2d`）。
> **证据来源**：`git log --follow` 该文件 + **首个版本**（`70c667f`，Dashboard 生成物）与现值的逐项 diff。
>
> **归因已复核（曾怀疑，已排除）**：同平台实测 web-mobile **debug 4436 KB vs release 1948 KB（2.28×）**，
> 口径差确实足以解释「3008 → 1815」，故一度怀疑那笔降幅来自口径而非裁剪 —— 但 `engine.json` 的改动在
> git 历史里**真实存在**（`1b69b00`：14 insertions / 26 deletions），**T-051 的因果成立**，怀疑撤回。
>
> **矩阵级推论（beads 复用）**：`games/beads/cocos/settings/v2/packages/engine.json` 现值也是
> **11 项 true，且与 breakout 裁剪后逐项相同** ⇒ **beads 无需再做功能裁剪**。理由不是"模板默认就裁好"
> （breakout 首版是 24 项，两个工程的模板**并不相同**），而是**恰好已落在同一模块集**上。
改写方式为 **parse → set → serialize + 解析校验**，**不是手改文本**（对齐"编辑器拥有的状态文件入库前必须按 JSON 解析核对语义"的教训）。

**效果（release，同口径对比）**：

| | 裁剪前 | 裁剪后 | 变化 |
|---|---|---|---|
| 主包 | 3008.3 KB | **1815.1 KB** | **−1193.2 KB（−39.7%）** |
| `cocos-js/`（引擎） | 2560 KB | **1356 KB** | **−1204 KB（−47%）** |
| gzip 参考 | 809.0 KB | 490.1 KB | −318.9 KB |
| 文件数 | 30 | 24 | −6 |
| 判定 | ⚠️ 超内部目标 1008 KB | ✅ **达标**（1815.1 ≤ 2000） | 引擎亦回到预算内（1356 ≤ 1800） |

红线 4096 KB 余量由 1087.7 KB 提升至 **2280.9 KB（55.7%）**；`architecture.md` R3 复评触发（>3.2 MB）更远。
`pnpm run cocos:check`（对真实 `cc` 声明跑 tsc）**通过**。

**⚠️ 未完成的一步（不得记为已关闭）**：**运行时实玩验收**。
类型检查只覆盖编译期；禁模块的**运行时**行为（如被动依赖被裁）**类型检查抓不到**。
按本文件 §6「缺口是资产」的精神，本条在实玩确认前保持**未完全关闭**。

- 仍**未验证**：微信开发者工具的最低基础库版本兼容性（需真机 + AppID）。

### G8 — `wx` 适配层

- Cocos 的微信小游戏导出是否自带 `wx` 的 `requestAnimationFrame` 注入？（我们的 `weapp.ts` 假设全局有 `rAF`，否则回退 `setTimeout`）
- `wx.getWindowInfo()` / `getSystemInfoSync()` 在目标基础库版本上的可用性；`safeArea` 字段的**确切语义**（代码按 `top` / `screenHeight - bottom` 计算底部安全区）。
- `wx.createInnerAudioContext()` 的池化上限（我们目前用 `NullAudioBackend`，音频接入时需验证）。
- **影响文件**：`packages/framework/src/platform/weapp.ts`（已做存在性守卫，Node 下已测）

### G9 — `.meta` 与资源

- `.meta` 的 UUID 生成规则；手工新增 `assets` 下的文件是否会被编辑器自动补 `.meta`。
- 资源目录移动会破坏引用（红色感叹号）→ 只能通过编辑器移动。
- `.gitignore` 应忽略哪些（建议：`library/`, `local/`, `temp/`, `build/`, `profiles/`；**必须提交** `assets/**` 与其 `.meta`）。← 根 `.gitignore` 由主理人维护。

**✅ 2026-09-14 部分回填（WXG-T-082）**：UUID 由编辑器生成并可读出——beads 的 `assets/Main.scene.meta`
uuid = `9683d2dd-7e97-4fe3-a54d-3e2ef554406a`（breakout 同理），`.gitignore` 已按上述建议生效
（`build/` 不入库，本轮重建产物未污染 `git status`）。
**⚠️ 仍未验证**：「手工新增 `assets` 下文件是否被自动补 `.meta`」与「资源目录移动的红色感叹号」——
两者都需要在编辑器 GUI 里手动操作，本轮未做（L1：`.meta` 不许手编，也不许脚本伪造）。

### G10 — 【P0 · 已修 2026-09-14（WXG-T-090 / ADR-0012）】Cocos 构建的 ES5 转译把 `[...非数组可迭代对象]` 编成 `[].concat(x)`，导致 beads 在真机路径上不可玩

> ✅ **修复状态（WXG-T-090，2026-09-14）**：采用**方案甲 = 源码层 `Array.from(x)` + 类型级 CI 守卫**，6 处真伤点已全部改造完毕。
> 决策与负面后果见 **ADR-0012**（`docs/architecture/adr/ADR-0012-es5-spread-language-contract.md`）；守卫 =
> `tools/scripts/check-es5-spread.mjs`，已进 `pnpm run verify` 链（`check:es5spread`）。下文 2026-09-14 取证原文**按原文保留**，
> 其中「候选修法均未验证」一句已被 §G10-FIX 推翻。**遗留**：微信真机 runtime 与 web-mobile 浏览器加载复验仍未做（见 §4 表末行）。

> 本节由 **WXG-T-082 取证过程意外撞到**。它**不是**坐标契约问题（那属 ADR-0011），而是**构建管线的语言层契约缺口**。

- **现象（实测）**：beads 的 `web-mobile` 产物在浏览器里**永远停在 `phase = "boot"`**，控制台报
  `[beads] level validation failed — refusing PLAYING: L1: pattern colour count 1 < 3; … L8: …`（**8 关全中**）。
  另：`startSprint()` **硬崩溃** `TypeError: Cannot read properties of undefined (reading 'charCodeAt')`。
- **真因（已定位到产物字节）**：Cocos 构建用 Babel 降到 ES5，把
  ```js
  return [...seen].sort((a, b) => a - b);          // 源码：levels.ts:78
  ```
  编成
  ```js
  return [].concat(seen).sort(function (a, b) { return a - b; });   // 产物原文（已 grep 确认）
  ```
  **`[].concat(aSet)` 不展开 Set**，结果是 `[Set]`——长度恒为 **1**。于是 `patternColors()` 对任何关卡都返回
  长度 1 ⇒ `validateBeadsLevel` 的「色数 ∈ [3, BEAD_COLOR_MAX]」全部失败 ⇒ `_boot()`（`beads-game.ts:903-906`）早退。
- **崩溃链（sprint）**：`buildStagePattern`（`levels.ts:245`）的 `[...row]` 同理变成 `[].concat(row)`。对字符串：
  以**数字**开头的行（如 `"555555"`）会塌成 **1 字符**（`"555555" >= '1' && "555555" <= '9'` 为真 ⇒ 取首字符色），
  以 **`.`** 开头的行（如 `".55.55"`）则原样保留 6 字符 ⇒ **锯齿 pattern**；`cols` 取 `pattern[0].length = 6`，
  而短行只有 1 字符 ⇒ `grid.ts:50` 读 `row[col]` 得 `undefined` ⇒ `charCodeAt` 抛错。
- **三点定论：这是构建特有，不是游戏层缺陷**：
  | 路径 | 结果 |
  |---|---|
  | Node / vitest（`games/beads`） | ✅ **184 用例全绿**（含 `levels.test.ts` 18 项） |
  | harness（`tsc` 编译，ES2020+） | ✅ `phase = "playing"`、`bootError = ""`、格子色 `[0,5,1,6]` 全对 |
  | **Cocos web-mobile 产物** | ❌ 卡 `boot`；`startSprint()` 崩溃 |
- **受影响面（已全量排查，14 处 `[].concat(` 中 **6 处真伤**）**：
  | # | 位置 | 展开对象 | 真机后果 |
  |---|---|---|---|
  | 1 | `framework/src/core/save/storage.ts:40` | `Map.keys()` 迭代器 | `keys()` 返回 `[迭代器]` ⇒ **存档键枚举全废** |
  | 2 | `framework/src/core/pool/object-pool.ts:112` | `Set`（`_inUse`） | `releaseAll()` 只拿到一个 Set 对象 ⇒ **池永不回收** |
  | 3 | `beads/src/config/levels.ts:78` | `Set`（`seen`） | **全关 BOOT 校验失败 ⇒ 拒进 PLAYING**（已实测） |
  | 4 | `beads/src/config/levels.ts:245` | `string`（`row`） | **冲刺模式硬崩溃**（已实测）+ 色数压缩模式产出锯齿 pattern |
  | 5 | `beads/src/systems/powerups.ts:106` | `Set`（`_holding`） | `holding` getter 返回 `[Set].filter(…)` ⇒ **持有道具列表恒空** |
  | 6 | `beads/src/systems/powerups.ts:130` | `Set`（`_holding`） | 迭代 1 次且值为 Set ⇒ **道具到期清理失效** |

  安全（展开对象本就是数组，`[].concat(array)` 语义正确）：`render-model.ts:163`、`curve.ts:75`、
  `levels.ts:209`、`beads-game.ts:402/1497`、`powerups.ts:200/211`。
  **breakout 同样携带 #1 #2**（框架 core 共用），只是其游玩路径未调到 `storage.keys()` / `releaseAll()`，故未暴露。
- **影响文件**：`cocos/settings/v2/packages/*`（构建目标 / Babel 配置）、`tsconfig`、上述 6 处源码
- **⚠️ 本轮未修（越出面）**：WXG-T-082 的硬约束是「不改 `games/beads/src`」（属 T-085/086），且 `object-pool.ts`
  属框架 core、`label-pool.ts` 相邻面属 T-077。**需主理人插单**。
- **候选修法（仅登记，未裁决——需独立 ADR）**：(i) 把 Cocos 构建目标提到 ES2015+（保留原生迭代器）；
  (ii) 源码层禁用 `[...非数组]`，改写为 `Array.from(x)`（**`Array.from` 在 ES5 转译下仍需 polyfill，需先实测**）；
  (iii) 加一条 **CI 守卫**：扫产物里的 `[].concat(` 实参是否为非数组可迭代对象。
  ⚠️ 三个候选都**未验证**，不得当结论引用。
- **取证可重复命令**：
  ```bash
  pnpm run framework:sync && cd games/beads && pnpm run build:cocos:web
  node -e "const s=require('fs').readFileSync('games/beads/cocos/build/web-mobile/assets/main/index.js','utf8');\
           const i=s.indexOf('function patternColors'); console.log(s.slice(i,i+420))"
  ```

#### G10-FIX — 2026-09-14 修复回填（WXG-T-090，裁决 = 方案甲）

**机制定性（比取证原文更精确的一处）**：降到 ES5 本身不是 bug，bug 是构建层**同一份 Babel 里两条路径不对称**——

| 构造 | 产物 | 对 Set/Map/迭代器/字符串 |
|---|---|---|
| `for (const x of it)` | `_createForOfIteratorHelperLoose(o)`，**先查 `o[Symbol.iterator]`**（真身在 `cocos-js/cc.js`，已核对） | ✅ 保语义 |
| `[...it]` / `f(...it)` | 直接 `[].concat(x)`（loose 展开；产物里**根本没有 `_toConsumableArray`** 助手，实测 grep = 0 命中） | ❌ 不展开 ⇒ 长度恒 1 |

**被否方案**：丙（提构建 target ES2015+）——`builder.json` / `program.json` 实测只剩 `__version__`，**无工程级开关**，
ES5 降级烧在 packer-driver 内部按平台固定 ⇒ 不可控，且属编辑器产物面（不得改 `games/*/cocos/settings/**`）。乙（纯显式循环）——
改动面膨胀且不消除契约缺口。详见 ADR-0012 §2。
**「`Array.from` 也许需 polyfill」的顾虑已被产物字节排除**：产物内 `new Set()` / `new Map()` 原生、全 bundle 无 core-js ⇒
runtime 具备 ES2015 built-ins；`Array.from` 同级，Babel 不转译 built-in static（修复后产物内 `Array.from(` 原样命中 6 次，恰等 6 处真伤点）。

**改动（6 处真伤点，数量未变）**：`storage.ts` `keys()` / `object-pool.ts` `releaseAll()` / `levels.ts` `patternColors()` 与
`buildStagePattern()` / `powerups.ts` `get holding()` 与 `noteCapacity()` ⇒ 全改 `Array.from(x)`。**安全展开刻意不动**
（展开对象本就多数组）：`render-model.ts` / `curve.ts` / `levels.ts` 的 `STAGE_PATTERN_POOL` / `beads-game.ts` 两处 /
`powerups.ts` 两处 / `view-model.ts` 的 `arcPoints` 调用展开。守卫改用**类型级 AST 判定**（而非正则）复扫全量入库源码，
含调用展开与 rest 解构，无第 7 处。

**复验证据（重建产物，13.3s）**：下列比对由只读产物的临时脚本完成（未改仓库任何文件）：

```text
修复前：[].concat( 命中 14 次、Array.from( 0 次；patternColors 尾部 = return [].concat(seen).sort(...)
修复后：[].concat( 命中  8 次（全为安全数组展开）、Array.from( 命中 6 次
        已出现：return Array.from(seen).sort(...)   /  Array.from(row).map(...)
                _Array$from = Array.from(this._inUse)  /  Array.from(this._holding)
                Array.from(this._map.keys())
        已消失：[].concat(seen)、[].concat(row)、[].concat(this._inUse)、
                [].concat(this._holding)、[].concat(this._map.keys
```
取证面洁净度：注释会随 debug 构建进产物，故已把四处注释改写为不含展开语法与 concat 字面形式（否则 `Array.from(seen)` 会多一处
注释命中、`[].concat(` 会多四条注释假阳性）——本轮实测踩过该坑，详见 ADR-0012 §4.2。
**最强证据（直接执行产物字节）**：从 `build/web-mobile/assets/main/index.js` 里切出**转译后的** `patternColors` + `colorIndexOfChar`
在 Node 里 eval，喂 `design/levels/levels-01-08.json` 真实关卡：L1–L8 依次得 `[1,5,6]` `[1,2,3,8]` `[1,2,5,7]` `[1,2,4,5,8]`
`[1,3,5,6,7,8]` `[1,2,4,5,6,7,8]` `[1,2,3,4,5,6,7,8]` `[1,2,3,4,5,6,7,8]` ⇒ 全部 length ∈ [3,10]，BOOT 色数判据可过。
**反证同法成立**：把切出的同一段手工换回 `[].concat(seen)` ⇒ 得 `[object Set]`、length = 1（G10 精确复现）。

**⚠️ 仍欠的两级证据（不得当作已完成）**：① **浏览器加载产物**看 `phase` 真的离开 `boot` ——本轮沙箱**禁监听 socket**
（`python3 -m http.server` 起不来，curl 超时）⇒ 未做；② **微信真机（iOS JSC / Android V8）**确认 `Array.from` 与可迭代
`Set`/`Map` 原生可用——需 AppID + 真机。二者属发布/QA 阶段关闭项（ADR-0012 §4.3）。

**breakout 侧同步（框架 #1/#2 共用）**：`games/breakout` 的 web-mobile 产物已一并重建（13.8s），
`Array.from(this._inUse)` / `Array.from(this._map.keys())` 各命中 1、塌缩形态命中 0，剩余 `[].concat(` = 2（`curve.ts` 的 `keys`、
`render-model.ts` 的 `_commands`，均为真数组）。**唯一未刷新项**：`games/breakout/cocos/build/wechatgame/`（release、已压缩）
仍是旧产物，内含一处 `[].concat(n)` 无法静态判定——**重建需 AppID**（`build:cocos` 默认平台），待发布阶段一并重建后复核。

---

## 4. 已完成的部分（标题于 2026-09-14 修订：原标题为「已在本轮‘无编辑器’条件下完成的部分」，该前提已不成立）

明确区分**已验证**与**未验证**，避免后续误判。

| 内容 | 验证方式 | 结论 |
| --- | --- | --- |
| 框架 core（12 模块） | `vitest run`，226 用例 | ✅ 已验证 |
| Canvas2D 适配器 | `vitest run`，9 用例（含 mock ctx 记录调用） | ✅ 已验证 |
| Cocos 渲染适配器**纯逻辑** | `vitest run`，11 用例（fake Graphics/Label） | ✅ 已验证 |
| Cocos 输入桥**纯逻辑** | `vitest run`，6 用例 | ✅ 已验证 |
| Cocos 循环桥**纯逻辑** | `vitest run`，5 用例（fake Scheduler） | ✅ 已验证 |
| 平台层 node/web/weapp | `vitest run`，16 用例（含 fake `wx`） | ✅ 已验证 |
| 打砖块玩法全部逻辑 | `vitest run`，153 用例，覆盖 97.2% | ✅ 已验证 |
| 类型检查（Node 侧） | `tsc --noEmit`（两个包） | ✅ 已验证 |
| **`bindings.ts` 能否在编辑器里编译** | 编辑器编译 + `pnpm run cocos:check`（对真实 `cc` 声明跑 tsc） | ✅ **已验证** |
| **Cocos 工程能否 import 框架包** | wechatgame **release 构建成功**，产物 `assets/main/index.js` 命中 `BreakoutBootstrap` | ✅ **已验证**（G1 关闭） |
| **包体** | `pnpm run build:cocos --release` + `pnpm run check:size` | ✅ **已验证**：主包 **3008.3 KB**（红线 4096 ✅ 通过；内部目标 2000 ⚠️ 超 1008 KB） |
| **真机帧率 / draw call** | — | ❌ **未验证**（需 AppID + 真机） |
| **beads Cocos 工程可构建** | `pnpm run build:cocos:web`（**17.1s** 成功）+ 产物 grep 命中 `BeadsBootstrap`×8 / `drawComboVfx`×2 / `COMBO_PARTICLE_COUNT`×8 | ✅ **已验证**（2026-09-14） |
| **beads web-mobile 可运行** | 浏览器加载产物：`cc.ENGINE_VERSION === "3.8.8"`、场景图读出 8 个池化 `Label`、`viewport.fit` = CSS px 754×456（backing 1508×912） | ✅ **已验证** |
| **beads web-mobile 可玩** | 源码层修复（WXG-T-090 / ADR-0012）后重建产物，**直接执行产物字节的 `patternColors`**：L1–L8 得 3–8 个色（均 ∈ [3,10]）；反证换回 concat 形态则恒 length=1 | ⚠️ **根因已消除，但本行不得记为验收通过**：尚缺「浏览器加载产物看到 `phase` 离开 boot」（本轮沙箱禁监听 socket，未做）与真机复验；此前记录：卡 `boot`（见 §3 **G10** / G10-FIX），绕过门禁后 normal 可落子供料满槽、sprint 硬崩溃——两者均已在源码层修，待运行时复验关闭 |
| **beads 包体** | — | ❌ **未测**：本轮只构建 web-mobile（免 AppID，用于看渲染/手感）；`build:cocos --release`（wechatgame）+ `check:size` **未跑** |

---

## 5. 编辑器就绪后的验证顺序（建议）

按**依赖顺序**执行，前一步失败会阻塞后一步：

1. **G7 基线**：建一个空工程，构建微信小游戏，记录**主包空体积**。→ 这个数字决定后续所有预算。
2. **G1 引用**：把 `packages/framework` 接进工程，验证 `import '@wxgame/framework'` 能否编译。
3. **G2/G3 渲染**：跑通一个最小场景，把 `CocosRenderModelRenderer` 接上，目视校正 `rect` 原点、`roundRect`、文本锚点。
4. **G4 输入**：验证触摸坐标系，修正 `mapPoint` 的 y 翻转；确认 `Node.EventType` 常量名。
5. **G5 循环**：确认 `schedule(cb, 0)` 的 dt 单位，接入 `CocosLoopBridge`，目视确认球速与 60 FPS 一致。
6. **G8 平台**：在真机上验证 `weapp.ts` 的屏幕尺寸与安全区。
7. **R3 包体**：构建并跑 `check-bundle-size.mjs`，确认主包 ≤ 4 MB。
8. **R4 性能**：低端真机跑 5 分钟，记录帧率与内存；必要时调 `DEFAULT_TUNING`。

**执行状态（2026-09-14 更新，WXG-T-049 / T-050）：**

| # | 步骤 | 状态 |
|---|---|---|
| 1 | G7 基线 | ✅ 已取：release 主包 **3008.3 KB**。**注意**：这不是"空工程"基线，而是**含完整玩法**的真实产物——比原计划的空体积基线更有价值（它已包含业务代码与全部资源） |
| 2 | G1 引用 | ✅ **关闭**：wechatgame release 构建成功，产物 `assets/main/index.js` 命中 `BreakoutBootstrap` |
| 3 | G2 / G3 渲染 | ✅ 渲染目视通过；G2 由官方声明回填、G3 由声明 + 实测回填。**遗留一项**：`_anchorForText()` 的估算宽度未替换（见 G3 与 backlog） |
| 4 | G4 输入 | ✅ **关闭**：信箱区换算精确吻合（495 → 608） |
| 5 | G5 循环 | ✅ **关闭**：球速与预期一致 |
| 6 | G8 平台 | ❌ **未做**（需 AppID + 真机） |
| 7 | R3 包体 | ✅ 已跑：红线 4096 KB **通过**；⚠️ 内部目标 2000 KB **未达**（3008.3 KB）→ 见 backlog「引擎功能裁剪」 |
| 8 | R4 性能 | ❌ **未做**（需真机） |

**⚠️ 2026-09-14 补注（WXG-T-082）：本节标题「编辑器就绪后的验证顺序」的前提已满足。**
编辑器已装、MCP 已在线（`127.0.0.1:3000/health` → `{"status":"ok","tools":21}`），因此上表 1–5 项已不再是
「待编辑器就绪」而是「已做完（breakout）」；本轮另在 **beads** 上重跑了第 3 项（渲染）并得到两条新结论：

1. **坐标分层在 Cocos 路径上是对的**（⇒ ADR-0011 的反证）：`#GameCanvas` CSS `754×456`、backing store `1508×912`
   （DPR=2 被引擎在 backing 层吃掉），而 `viewport.fit.screenWidth/Height` 仍为 `754×456`（CSS px）。
   文字走 8 个原生 `Label` 节点（y 为正=上），**不存在 canvas2d 的 y 翻转路径** ⇒ harness 的 GAP-07/GAP-08
   在本路径**结构上不可能复现**。
2. **新的阻塞不是坐标，而是 G10（转译）**：第 3 项的「目视校正」在 beads 上**无法按原计划完成**，
   因为游戏根本进不了 PLAYING。本轮靠**运行时清空 `_bootErrors` 并重调 `_boot()`** 绕过门禁才取到渲染证据
   （仅作用于构建产物，**未修改仓库任何文件**）。这是一个取证手段，**不是修复**；G10 未修前，
   beads 的 Cocos 侧验收不得记为通过。
   **→ 2026-09-14 更新（WXG-T-090）**：绕过手段已不再需要——G10 的**源码层根因已修**（`Array.from` + 守卫，见 §3 G10-FIX），
   产物字节级复验通过；但本条的「Cocos 侧验收通过」仍需一次**真实的浏览器/真机加载**才能记，**未做**（环境阻塞：沙箱禁监听 socket）。

---

## 6. 维护约定

- **任何**在编辑器里发现与本文记载不符的地方，**必须**回来更新本文件（含"实际行为"与"受影响文件"）。
- 新增对引擎 API 的依赖 → 同步更新 §2 能力清单。
- 本文件中的 ⚠️ 未验证标记，只有在编辑器里实际跑通后才能移除，且需附上验证方式。
- **禁止**为了"让文档好看"而删除本清单中的缺口项。缺口是资产，不是羞耻。
