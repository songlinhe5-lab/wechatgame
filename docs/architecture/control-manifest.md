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

---

## 14. Cocos MCP 编辑器接入（ADR-0009）

> 接入定位：**验证 / 构建 / 资源刷新闭环**——不是"用 AI 搭场景"。插件在编辑器侧，运行时包体零影响。

- ✅ **L1 工具级防线**：MCP 插件工具管理面板中，`scene_*` / `node_*` / `component_*` / `prefab_*` 的**写操作工具默认禁用**；任何经 MCP 发生的场景/节点变更**视同手编 `.scene`，违反 L1**，评审打回。
- ✅ **`.meta` 只能由编辑器生成**：智能体新增资产后，经 MCP 的 `asset_*` 工具触发编辑器刷新/重导入，由编辑器生成 `.meta` 后提交；禁止手写 `.meta`，禁止用任何手段伪造。
- ✅ **HTTP 端点仅限本机回环**：`127.0.0.1:3000/mcp` 无鉴权，**禁止暴露到非回环地址**（改端口/改绑定即违反本条）。
- ✅ **许可证红线**：开源版（DaxianLee v1.5.4）自定义许可**禁止商用**。项目启动商业化（对外发布 / 产生收入）前，必须先按 ADR-0009 §5 完成复评（作者授权 / 方案 B 采购 / 方案 C 自研），否则**不得**在商业发布流程中使用该插件。
- ✅ **临时开权限要登记**：P0 验证确需只读查询而临时开启被禁前缀时，须在 ADR 复评记录中登记工具名与原因，用完关闭；严禁开启写 action。
- ✅ **升级流程**：插件升级 = 删除编辑器 settings 两个配置文件 + 重配 + 重核白名单映射，升级后先跑 P0 冒烟再继续使用。
