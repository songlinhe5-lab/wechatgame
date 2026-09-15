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
