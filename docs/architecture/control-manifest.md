# 控制清单 — 可立即执行的一页规则

> 给程序员的单页速查。**评审时逐条对照，违反即打回。**
> 完整理由见 `docs/architecture/architecture.md` 与三份 ADR。

---

## 0. 五条铁律（违反 = 直接打回）

| # | 规则 | 为什么 |
| --- | --- | --- |
| **L1** | **禁止手工编辑 `.scene` / `.prefab` / `.meta`。** 场景里只允许 `GameRoot` + `Bootstrap`。 | ADR-0003：插入一个节点会导致数百行 ID 重排，多人并行必然冲突 |
| **L2** | **`packages/framework/src/core/**` 禁止 import `cc` / 访问 `window` / `document` / `wx` / DOM。** | ADR-0002：core 必须能在纯 Node 下跑测试 |
| **L3** | **游戏逻辑（`games/*/src`）禁止 import `cc`。** | 游戏必须能脱离编辑器被验证 |
| **L4** | **禁止 `Math.random()`。** 一律用 `services.rng`（`createRng(seed)`）。 | 确定性与可回放；测试与反作弊的基础 |
| **L5** | **UI / 渲染层不持有游戏状态。** `buildRenderModel()` 只读，不得写游戏状态。 | 唯一权威状态在游戏对象里；防止 UI 与逻辑双写 |

---

## 1. 目录与落位

```
packages/framework/src/
  core/        引擎无关（可单测）        ← 新代码默认放这里
  adapters/    cocos/ canvas2d/          ← 只有绘制/输入/循环的桥接
  platform/    node web weapp            ← 只有宿主差异
games/<game>/
  src/         玩法（引擎无关）           ← 所有玩法代码
  tests/       vitest（纯 Node）
  cocos/       Cocos 工程（只有 Bootstrap）
  design/ art/ build/                     ← 由策划/美术/构建产出
```

---

## 2. 热路径零分配

`update()` / `stepBall()` / `buildRenderModel()` 里**每帧执行**的代码：

- ❌ 不 `new` 对象/数组/闭包（每帧几百次 `new` = GC 抖动 = 低端机掉帧）
- ❌ 不用 `map` / `filter` / `reduce` / 展开运算符 `[...]` / `{...x}` 创建新集合
- ✅ 用**预分配的 scratch 对象**（`const _hit = {...}`）并通过 `reuse` 参数复用
- ✅ 用 `ObjectPool<T>` 管理粒子/飘字/闪白等生命周期对象
- ✅ 需要 `out` 参数时，用 `Vec2.add(a, b, out)` 这类静态方法，而不是返回新向量
- ✅ 每帧的 `RenderModelBuilder` **一个实例复用**，`begin()` 清空、`end()` 冻结视图

> 例外：**关卡加载、存档读写、初始化**不在热路径，可以自由分配。

**自查**：在 `core/` 与 `games/*/src` 里 `grep -n "new " <file>`，出现在 `update`/`step`/`build` 函数体内就是可疑点。

---

## 3. 数据驱动，不硬编码

- ❌ 系统文件里出现魔法数字（`if (levelIndex === 3) speed = 620`）
- ❌ 关卡结构写在 `if/else` 或 `switch` 里
- ✅ 数值 → `config/tuning.ts`（纯数据，单一来源）
- ✅ 关卡 → `config/levels.ts` 的字符网格 + `legend`，由框架 `compileLevels()` 校验
- ✅ 内容注册 → `DataRegistry<T>`，运行时按 id 查
- ✅ 颜色 → `view/palette.ts`，代码里不出现 `#rrggbb` 字面量

**自查**：`grep -nE '#[0-9a-fA-F]{6}' games/*/src/**/*.ts`，除 `palette.ts` 外都应无命中。

---

## 4. 事件是通知，不是状态

- ✅ 事件总线只用来广播"发生了什么"：`brick:destroyed` / `paddle:hit` / `ball:lost`
- ❌ 不用事件**传递**权威状态，不用 `event.payload` 回写游戏
- ❌ 不在事件处理器里修改玩法状态（音频、遥测、美术表现可以）
- ✅ 处理器可以在事件中退订（EventBus 已验证安全）
- ✅ 派生表现（音效、粒子）走事件；**判定与计分留在 `update()` 里同步完成**

**理由**：事件顺序一旦参与判定，回放与测试就不可复现。

---

## 5. 存档

- ✅ 一律走 `SaveManager<T>`：带 `version` + `migrations` + `validate`
- ✅ 每次 schema 变更：**升版本 + 写迁移**，不直接改默认值
- ✅ 存档只存**长期进度**（最高分、解锁关卡、设置），**不存对局中间态**
- ❌ 不用裸 `localStorage` / `wx.setStorageSync`（那是平台实现的事）
- ✅ 读写失败**永不抛异常**——`SaveManager` 已保证，调用方不要再包 try/catch 冗余

---

## 6. 输入

- ✅ 游戏只读 `InputManager.snapshot`（逐帧不可变）
- ✅ 坐标一律经 `Viewport.screenToDesign()` 转换；游戏里不存在"屏幕坐标"
- ✅ 需要测试/无头驱动时，用公开方法（如 `game.movePaddleTo(x)`）而不是伪造原生事件
- ❌ 不在游戏里读 `window`、`wx`、`TouchEvent`、`MouseEvent`
- ✅ 宿主归一化见 **§17**（引擎原生事件坐标必须经 adapter 变成 CSS px + 左上原点，不得直接喂 `InputManager`）
- ✅ 棋盘区缩放/平移走「布局即相机」（`gridLayoutFor` 烘相机，渲染与命中同源）；多点输入 = `InputSnapshot` 第二指针槽（`isDown2/x2/y2`），手势解算留游戏侧 `board-camera.ts`（ADR-0015 甲′/丁-3）

---

## 7. 状态机

- ✅ 用 `StateMachine<S>` 的**转移表**声明合法边；非法转移自动失败
- ✅ `transition()` 返回 `bool`，调用方可以无视重复触发（幂等）
- ❌ 不用散落的 `boolean` 标志模拟状态（`isPlaying && !isPaused && !isDead` 是 bug 温床）
- ✅ 一次性/延时逻辑放 `onUpdate` 里判断 `machine.elapsed`，不要在 `onEnter` 里 `setTimeout`

---

## 8. 渲染

- ✅ 游戏只产出 `RenderModel`（`rect` / `circle` / `line` / `text` / `polygon`）
- ✅ **坐标系约定（必须遵守）**：设计空间原点在**左下**，`rect` 的 `x,y` 是**左下角**，`circle` 的 `x,y` 是**圆心**，单位是设计空间单位
- ✅ 适配器负责一切引擎差异（Cocos 的中心原点、Canvas2D 的 y 翻转）
- ❌ 不在游戏逻辑里出现 `Graphics`、`Label`、`ctx`、`Node`
- ✅ 文字走 `RenderModel` 的 `text` 指令；Cocos 侧由 `PooledLabelSource` 池化 `Label` 节点
- ✅ 尽量合并 draw call（Cocos 下所有矢量图形进**同一个** `Graphics`）

---

## 9. 平台差异

- ✅ 一切宿主差异写在 `platform/{node,web,weapp}.ts` 里，通过 `Platform` 接口暴露
- ✅ `wx.*` 只在 `weapp.ts` 出现，且**必须**做存在性守卫（Node 下没有 `wx`）
- ✅ 新能力 = 在 `Platform` 接口加方法 + 三个实现各补一份（Node 实现可空）

---

## 10. 网络与安全（后续游戏适用）

- ✅ **服务端权威**：客户端只做本地预测与表现，判定结果以服务端为准
- ✅ 输入在服务端**校验**（速度上限、频率上限），不信任客户端上报的分数
- ✅ 存档加密/校验和：本地存档视为"用户可改"，关键进度以服务端为准
- ❌ 不把任何密钥、AppSecret、CDN 私有地址写进客户端代码
- ✅ 校验脚本：`tools/scripts/check-secrets.mjs`

---

## 11. 测试

- ✅ **验证驱动**：先写测试，再实现
- ✅ 新增 `core/` 模块必须有 `packages/framework/tests/core/<模块>.test.ts`
- ✅ 新增玩法系统必须有 `games/<game>/tests/<系统>.test.ts`
- ✅ 物理/计分/状态机必须断言**边界**（0、负数、极限值、退化输入）
- ✅ 涉及时序的逻辑：用 `advance(seconds)` 手动推进，**不要**依赖真实时钟 / fake timers
- ✅ 确定性：同一 seed 同一输入序列 → 相同结果（至少一条这样的断言）

**提交前必跑**：

```bash
cd packages/framework && npm run typecheck && npm test
cd games/breakout   && npm run typecheck && npm test
node tools/scripts/check-architecture.mjs
```

---

## 12. 提交前自查表

```
[ ] L1  没有改过 .scene / .prefab / .meta
[ ] L2  core/ 里没有 cc / window / wx / document
[ ] L3  游戏逻辑里没有 cc
[ ] L4  没有 Math.random()
[ ] L5  buildRenderModel() 没有写游戏状态
[ ] §2  热路径没有 new / map / filter / 展开
[ ] §3  没有魔法数字与颜色字面量（已进 tuning / palette）
[ ] §4  事件只做通知，判定仍在 update() 里
[ ] §5  存档变更带版本与迁移
[ ] §11 新增代码有测试，且 tsc --noEmit 与 vitest 全绿
[ ] §11 check-architecture.mjs 通过
[ ] §15 没有对 Set / Map / 迭代器 / 字符串用展开语法（一律 Array.from）；check-es5-spread.mjs 通过
[ ] §17 宿主输入已 ÷dpr + 翻 y，且有 Node 行为测试（不是源码级正则断言）
```

---

## 13. 反模式速查（见到就打回）

| 反模式 | 正确做法 |
| --- | --- |
| 在 `update()` 里 `arr.filter(...)` | 原地遍历 + `for` 循环；池化临时数组 |
| `if (phase === 'playing' && !dead && !paused)` | `StateMachine` |
| 游戏里 `import { Node } from 'cc'` | 产出 `RenderModel`，引擎差异交给适配器 |
| 把分数直接写进 UI 组件 | UI 只读快照；权威状态在游戏对象 |
| `Math.random() < 0.1` 掉宝 | `services.rng.bool(0.1)` |
| 关卡配置写在 `switch (levelId)` | `config/levels.ts` 数据表 |
| 新增字段直接改 `defaults()` 不升版本 | 升 `version` + 写 `migrations[n]` |
| 在 `onEnter` 里 `setTimeout` | `onUpdate` 里判 `machine.elapsed` |
| 手改场景文件"就调一个位置" | 位置进代码 / 数据表 |
| 为通过评审而跳过测试 | 先写测试，再实现 |
| 经 MCP 的 `scene_*` / `node_*` 写操作改场景 | 白名单禁用；验证走 `debug_*` / `validation_*`（ADR-0009） |
| `[...someSet]` / `[...map.keys()]` / `[...str]` | `Array.from(someSet)`——Cocos ES5 构建会把非数组展开压成不展开的 concat 形式（ADR-0012） |
| 框架里写 `sfx_place` 这类玩法 clip id | 音色表由游戏侧 `Game.audioVoices` 注入，框架只认结构不认玩法（ADR-0013） |
| backend 遇到未登记 clip 就「随便发个声」 | **不发声** + 一次性 warn；音色是设计产出，不是引擎兜底项（ADR-0013 §3.3） |
| 把 `getLocation()` 直接喂 `InputManager` | 经 adapter 归一化成 **CSS px + 左上原点**（÷dpr + 翻 y）再喂（**§17**，ADR-0011 §3(e)） |
| 整屏级缩放需求在视图侧逐图元乘坐标系数（绕开变换通道） | 用 `RenderModelBuilder.setTransform` + `RenderModel.transform`（背景参与变换 ⇒ 零黑边；Cocos 走节点缩放宿主；ADR-0014） |
| 用源码级正则断言锁「y 翻转」语义 | 正则判别力为零（缺陷 C1 就是这么漏的）；写 Node **行为测试**（§17） |
| 把 ADR-0014 整屏 `RenderModel.transform` 通道挪用做棋盘区相机（区域缩放/平移） | 区域相机走「布局即相机」：zoom/offset 烘进 `gridLayoutFor`（渲染与命中同源）；整屏通道只给 uniform scale + 锚点、G5 红线无位移，不扩 dx/dy（ADR-0015 丁-3） |
| 绕开 `gridLayoutFor` 真源手写第二套坐标逆变换做缩放命中 | 触摸→格子仍走 ADR-0011 那一段（`screenToDesign` → 已含相机的格心距离）；第二套坐标系 = 画出的框 ≠ 点击落点（K-054 / ADR-0015） |

---

## 14. Cocos MCP 编辑器接入（ADR-0009）

> 接入定位：**验证 / 构建 / 资源刷新闭环**——不是"用 AI 搭场景"。插件在编辑器侧，运行时包体零影响。

- ✅ **L1 工具级防线**：MCP 插件工具管理面板中，`scene_*` / `node_*` / `component_*` / `prefab_*` 的**写操作工具默认禁用**；任何经 MCP 发生的场景/节点变更**视同手编 `.scene`，违反 L1**，评审打回。
- ✅ **`.meta` 只能由编辑器生成**：智能体新增资产后，经 MCP 的 `asset_*` 工具触发编辑器刷新/重导入，由编辑器生成 `.meta` 后提交；禁止手写 `.meta`，禁止用任何手段伪造。
- ✅ **HTTP 端点仅限本机回环**：`127.0.0.1:3000/mcp` 无鉴权，**禁止暴露到非回环地址**（改端口/改绑定即违反本条）。
- ✅ **许可证红线**：开源版（DaxianLee v1.5.4）自定义许可**禁止商用**。项目启动商业化（对外发布 / 产生收入）前，必须先按 ADR-0009 §5 完成复评（作者授权 / 方案 B 采购 / 方案 C 自研），否则**不得**在商业发布流程中使用该插件。
- ✅ **临时开权限要登记**：P0 验证确需只读查询而临时开启被禁前缀时，须在 ADR 复评记录中登记工具名与原因，用完关闭；严禁开启写 action。
- ✅ **升级流程**：插件升级 = 删除编辑器 settings 两个配置文件 + 重配 + 重核白名单映射，升级后先跑 P0 冒烟再继续使用。

---

## 15. 构建层语言契约（ADR-0012，根因 G10）

> Cocos 脚本打包把所有平台降到 ES5，且 **built-in 不 polyfill、语法照旧降级**。其中一条不对称会静默改变语义：
> `for-of` 走带 `Symbol.iterator` 分支的 helper（安全），而**展开语法**被压成不展开的 concat 调用（不安全）。
> 后果曾在真机路径上让 beads **8 关全卡 `phase = "boot"`**（Node / vitest / harness 三路径均绿，故必须靠守卫拦）。

- ❌ **禁止对非数组可迭代对象使用展开语法**：`[...set]`、`[...map]`、`[...map.keys()]`、`[...str]`、`f(...set)`、`const [a, ...r] = set` 全部禁止。
- ✅ 统一改写 **`Array.from(x)`**（ES2015 built-in static，Babel 不转译；产物已实证原样保留）。
- ✅ **展开一个真数组是安全的，不要“顺手清理”**（改它是噪声）：如 `[...rows]`（`string[]` 浅拷贝）、`[...this._commands]`。
- ✅ 适用面 = **入库源码**（`packages/framework/src/**` + `games/*/src/**`）；tests / harness / 镜像拷贝件不进构建包。
- ✅ 镜像副本只由 `pnpm run framework:sync` 产出，**绝不手改**；一致性由 `framework:sync:check` 保证，**且已升级为提交前硬门**：`.githooks/pre-commit` 步骤 ①⁷⁄₈ 在暂存区含**镜像源**（`packages/framework/src/**/*.ts` **或** `games/*/src/**/*.ts`）时自动跑 `--check` 并**只拦不写**（守卫 WXG-T-101；覆盖面修正 WXG-T-098——sync 实际镜像「framework 39 + game 26」两类源，初版只匹配框架路径时改玩法源码不触发，与本节上方「适用面 = 入库源码」的口径本应一致）。BD-20 已两次复发，靠人记 sync 不够。
- ✅ **守卫**：`node tools/scripts/check-es5-spread.mjs`（已进 `pnpm run verify`）。用 TypeScript **类型检查器 + AST** 而非正则，
  三类展开位（数组展开 / 调用展开 / rest 解构）全覆盖；**不可证明为数组即红（fail-closed）**，`any`/`unknown`/`ArrayLike` 同样红。
- ⚠️ 逃生阀：行内 `// es5-spread: allow <原因>`（可 grep）。使用需在设计/评审记录里说明，不得为“让守卫绿”而滥用。
- ⚠️ **入库源码的注释里不得写上述字面形式**（`[...x]` / `[].concat(x)`）：注释会随 debug 构建进产物，**污染产物 grep 取证**；要引用回 ADR-0012 / 本清单。
- ⚠️ **本契约只规避“展开”一个触发面**，不消除构建层的降级不对称；`Array.from` 在目标 runtime 是否真存在，靠产物旁证 + 守卫兜底，**非配置保证**（ADR-0012 §4.2）。

**自查**：`node tools/scripts/check-es5-spread.mjs`；**守卫有效性自测**（红→绿双向可复现）`pnpm run check:es5spread:selftest`；产物旁证 `grep -o '\[\]\.concat(' games/<game>/cocos/build/web-mobile/assets/main/index.js | wc -l`（每一个命中都得确认展开对象就是数组；修好后 beads 侧应为 8 且全为真数组展开）。

---

## 16. 音频后端契约（ADR-0013，根因 BD-05b）

> 选型已冻结：`systems-index §3.12` = **程序化合成、主包音频 0 KB**（判据 A05-25）。要出声只能运行时合成，
> 而合成必须碰 `AudioContext` ⇒ 受 L2/L3 双层约束，归属不可摇。

- ✅ **引擎位置唯一**：`packages/framework/src/platform/audio-synth.ts`（`SynthAudioBackend`）。**不得**进 `core/**`（L2：要触 DOM/runtime API），**不得**进 `games/*/src`（L3：纯 Node 可测面）。
- ✅ **音色表归游戏侧**：`Game.audioVoices`（纯数据）→ `App` 透传 → `Platform.createAudioBackend({ voices })`。框架内搜不到一个 `sfx_*` / `bgm_*` id。
- ✅ **能力缺失就静音**：web 缺 `AudioContext`、weapp 缺 `wx.createWebAudioContext`、或无 voice 表 ⇒ 回 `NullAudioBackend`（+ 一次性 warn）。**禁止**伪造「iOS 已能出声」。
- ✅ **Node 平台恒 `NullAudioBackend`**（签名接受但忽略 `options`）⇒ 单测不依赖真实时钟与音频设备。
- ✅ **context 延迟到首次手势**（`audio-spec §4.4`）；一次性音在解锁前丢弃，loop 走**期望态** `_wantedLoops`（解锁/回前台补起）⇒ BOOT 期 `bgm_main` 不丢。
- ⚠️ **未登记 clip 静默失效**：唯一线索是一条一次性 warn，而 CI 跑在 Node（恒 Null）⇒ 永远绿。兜底靠**清单闭合测试**（A05-24：`tuning.ts` clip 集 ≡ `audio-events §1` ≡ voice 表 key 集）——新增音效必须同批改三处。
- ⚠️ **数值不得回引为规格**：`audio-voices.ts` 里的 Hz / ms / 增益全属**工程占位**（`audio-spec §4.3` 数值一律 `[TODO]`；硬数值只有 `ux-spec §5` 时长上限）。总线增益 = 1.0（`AUDIO_BUS_GAIN_* = [TODO]`，不冻伪 dB）。
- ⚠️ **热路径零分配在本层只能有界做到**：Web Audio 源节点一次性 ⇒ 最坏 ~24 个短命节点/帧（受 `AUDIO_MAX_PER_FRAME` 与每 clip 音数限界）；可复用面 = bus gain / per-clip filter / 噪声 buffer / 循环 buffer。**不得**拿“零分配”口号当已证结论，CPU 归 `[R]`（A05-27）。
- ⚠️ **本轮不做**（不冒充交付）：`priority/steal`（需求单第 5 项）、weapp `InnerAudioContext` 文件池（与 0 KB 选型冲突，回退需先解除主包余量冲突，ADR-0013 §2 丁）。

**自查**：`pnpm -F @wxgame/framework test tests/platform/audio-synth.test.ts`（引擎结构与契约 15 例）+ `pnpm -F @wxgame/beads test tests/audio-dispatch.test.ts`（19 clip 清单闭合与派发分档 26 例）。二者均只证 `[N]`；时长/响度/真机听感一律另计 `[B]/[C]/[R]/[P]`。

---

## 17. 宿主输入归一化（ADR-0011 §3(e)，根因 缺陷 C1）

> 屏幕坐标的唯一契约 = **屏幕 CSS px · 左上原点**；**DPR 永不进 `Viewport` / `InputManager` / 任何 core 类型**。
> ADR-0011 §3(a)–(d) 定的是**消费端**口径，本条定的是**生产端**：谁负责把引擎原生事件变成这个契约。
> 缺陷 C1 正是"只把断言写进代码注释与 ADR 引用、没进本清单"的产物 —— 后果是 beads 在 web 产物上
> **每一次点击都落在上下镜像位置**、真机（dpr≥2）上**两轴全错**，玩法整体不可用（WXG-T-104 修复）。

- ❌ **禁止把引擎原生事件坐标直接喂 `InputManager` / `RawPointerInput`。** Cocos 3.8.8 实测
  （web-mobile + Chrome，3 宿主配置 / 7 采样点）：`getLocation()` / `getStartLocation()` =
  画布相对 · **device px（× dpr）** · **左下原点**（`x = (clientX − rect.x) × dpr`、
  `y = (rect.y + rect.height − clientY) × dpr`）。与契约相差**整屏高度 + 一个 dpr 因子**。
  `getUILocation()` 同样不可用（设计单位 · 左下原点 · 引擎按 FIXED_HEIGHT 适配 ⇒ **不减信箱偏移**）。
- ✅ **归一化全权归宿主 adapter**：写在 `adapters/<引擎>/` 层 —— **不在** `core/**`（L2）、
  **不在** `games/*/src`（L3）、**不在** `Viewport`。且**必须同时做两件事**：
  ① ÷dpr（device px → CSS px）② y 翻转（`y' = canvasHeightCss − y/dpr`，左下 → 左上）。
  **只做一半是错的**：只翻 y ⇒ dpr≥2 时整屏放大 2 倍，点屏幕右侧即越界出屏。
- ✅ `Viewport` / `InputManager` 只接受「屏幕 CSS px · 左上原点」；**DPR 永不进 `Viewport` 或任何 core 类型**。
  `Viewport.screenToDesign()` 自身那次 y 翻转（设计空间 y 向上）**不是"重复翻转"** ——
  早期正是把这句话理解反了，才产生缺陷 C1。
- ✅ 归一化必须是 **Node 下可测的纯函数**（不 `import 'cc'`、不读 DOM / 全局）。
  参照 `packages/framework/src/adapters/cocos/touch-normalize.ts::normalizeCocosTouch(raw, { canvasHeightCss, dpr }, out?)`。
- ✅ **新宿主 / 新引擎适配器接入必须同形态复刻**：纯函数 + `packages/framework/tests/adapters/<引擎>-touch-normalize.test.ts` 的 **Node 行为测试**。
- ❌ **禁止只用源码级正则 / 文本断言锁语义**：正则对"y 翻转"这类问题的**判别力近似为零**，
  C1 就是这么漏过去的。源码级断言只能作**过渡形态**，行为测试落地后必须退役（T-104 阶段 B 已退役两条）。
- ✅ **宿主量必须与 `platform.getScreenSize()` 的 CSS px 口径同源**：`canvasHeightCss` 取
  `viewport.fit.screenHeight`（由 `_fitToGameCanvas()` 用 `#GameCanvas.clientHeight` 设置）；
  **不要**用 `getBoundingClientRect().height`。
- ✅ **dpr 必须与输入源同源**：取引擎生效值 **`cc.screen.devicePixelRatio`**（web 封顶 2；小游戏**无封顶**）。
  **禁止**用平台层 `getScreenSize().pixelRatio`（web 侧未封顶，dpr=3 机上留 1.5 倍误差），
  **禁止**在 adapter 里自行复刻封顶规则（引擎改规则即静默失配）。
- ⚠️ **DPR 必须显式注入，不能读环境**：无头 CI 常见 `devicePixelRatio === 1`，届时"÷dpr"与"不除"结果相同
  ⇒ 断言退化为**恒真而静默失效**。行为测试须自建 **dpr: 2 / 3 桩**并覆盖三档。
- ⚠️ **微信小游戏侧 `[R]` 阻塞**：`pal/input/minigame/touch-input.ts` 与 web 源码**同形**，但
  **无 AppID / 无真机 ⇒ 未实测**，**不得当已验证**写进结论；真机首验须把「点击落点 / 托盘选中 / dpr 缩放」
  列 **P0 检查项**（与 ADR-0011 §4.2(10) 同口径）。

**负面后果（已知成本，不是风险）**：

1. **漏做归一化的症状是"点击整体偏移 / 上下镜像"，不报错、不红测试** ⇒ 第一现场常被误判成玩法 bug 或命中盒 bug
   （C1 存活到 2026-09-15 才暴露，P0 排查成本发生在发布前夕），定位成本高；且**桌面 dpr=1 会让 ×dpr 那一半完全隐身**
   （只吃 x 的挡板验证对 y 翻转判别力为零）。这是本条已付出的真实成本。
2. **强制"纯函数 + 行为测试"抬高接入成本**：每个新宿主多一个模块 + 一个测试文件。收益只在**第二次接入**时才体现，
   第一次接入时它看起来是纯开销 ⇒ 需要有评审清单（§12 已列一项）兜着，否则会被"先上线再说"绕过。
3. **引入 `cc.screen.devicePixelRatio` 这条静态引擎依赖**：引擎改名 / 移除会在 `cocos:check` **构建期**红（可发现），
   但**微信侧该 API 的运行时取值无人验过**；退化分支（取到非正数 → 按 1 处理 + 一次 `warn`）在 Node 下**不可测**
   （`bindings.ts` 被 `tsconfig` 与 vitest 排除），只能靠日志发现。
4. **`canvasHeightCss` 用整数 CSS px，而引擎输入源用可为小数的 `rect.height`** ⇒ ≤1px 亚像素偏差，
   **刻意接受**（选前者的理由是它与 `screenToDesign` 同口径；量级远小于最小命中盒 —— beads 托盘 62² 设计单位 ≈ 33 CSS px）。
   未登记为缺陷，见 ADR-0011 §4.2(9)。

**自查**：`pnpm -F @wxgame/framework test tests/adapters/cocos-touch-normalize.test.ts`（9 例 Node 行为测试：
dpr=1/2/3 封顶、信箱、边界、非法 dpr、Viewport 往返）。端到端复跑探针：
`node production/qa/beads/cocos-input-probe.mjs`（WXG-T-108 落盘；自带断言与退出码 + **反例自检** ——
它正是"新宿主必须补行为测试"这条要求的机械样例，**新宿主/新引擎适配器照它的形态复刻一份**）。
二者均只证 `[N]`（web-mobile）；微信真机侧为 ⛔ `[R]`，不得记 PASS。

---

## 18. 外来吸收四条（CCGS `gameplay-code`，WXG-T-175）

> **来源**：Claude Code Game Studios（MIT）`.claude/rules/gameplay-code.md`，与本章
> L1–L5 逐条对账后**只吸收本仓没有的 4 条**。上游其余条款（数据驱动、delta time、
> 热路径零分配、UI 不持状态）本仓 §0/§2/§3/§8 已覆盖且更严，不重复引入。
> **层级**：本节属**工程细则**，不是 L1–L5 铁律 —— 违反走评审打回，不按红线处理。

1. **状态机必须有显式转换表**（并入 §7）：状态 / 事件 / 目标状态三列表格落在代码注释或
   设计文档；禁止用散落的 `if` 表达状态迁移（后者无法评审、无法穷举边界）。
2. **禁止静态单例持有游戏状态**（改用依赖注入）：模块间经构造参数或 `services` 传入，
   不得 `SomeManager.instance` 全局取用 —— 单例使测试无法隔离，也是**顺序依赖型 flaky**
   的温床（见 `my-skills/wxgame-qa-gates/SKILL.md` §6）。
3. **公开 API 注释须标注设计文档出处**：格式 `设计真源：<路径>#<小节>` 或 `S<n>§8-<k>`，
   便于设计变更时反向定位受影响代码（配合 `wxgame-story-gate` 的偏差检查）。
4. **`TODO` 必须带归属**：`TODO(<人名或任务号>)`，禁止裸 `TODO/FIXME/HACK` —— 裸标记
   无法追责，并会在提交门禁里退化成噪声。

**未吸收的上游条款（登记以免重复引入）**：delta time 口径（本仓固定步 `GameLoop.fixedDt`，
§2 已钉）、每系统显式接口、逻辑与表现分离（L5 已钉）。

**未引入的 CCGS 组件**：12 个 hooks（路径 `^src/gameplay/`、`^design/gdd/`、
`^assets/data/*.json` 在本仓**全不命中**，且强度低于本仓 pre-commit）、15 个引擎专家
agent（Godot/Unity/Unreal，本仓引擎唯一 = Cocos Creator + 微信小游戏）、
`systems-index.md` 模板（与本仓同名**冻结真源**冲突，只借鉴其"高风险系统/进度跟踪"章节）。
