# ADR-0002 — 框架分层与引擎解耦

- **状态**：已接受（Accepted）
- **日期**：2026-09-11
- **决策人**：程基岩（技术 + 引擎负责人）
- **关联**：ADR-0001（引擎选型）、ADR-0003（空场景）、`docs/architecture/control-manifest.md`

---

## 1. 上下文（Context）

ADR-0001 选择了 Cocos Creator 3.8 LTS，并诚实记录了它的代价。其中最贵的一条是：

> **编辑器的强依赖 + `cc` 类型只在编辑器内可用**，导致"没有编辑器就无法验证任何代码"。

如果所有代码都直接依赖 `cc`，那么这个项目的现实就是：

- 用户没装编辑器 → **一行代码都跑不起来**（本轮的真实情况）。
- 多人/多 AI 并行 → 任何人想验证自己的改动，都必须排队等一台装好编辑器的机器。
- 换引擎 / 升级引擎 → 全仓库重写。
- 单测 → 只能跑在浏览器里手动点，无法进 CI。

这对一个**矩阵**项目是致命的。矩阵的价值在于"框架复用"，而框架如果被引擎焊死，复用的只是"复制粘贴"。

因此需要一条硬边界：**游戏逻辑不知道 Cocos 的存在**。

---

## 2. 备选方案（Alternatives）

### 方案 A：全部代码写在 Cocos 工程内，直接依赖 `cc`

- 最直接，初期最快。
- 否决理由：无编辑器 = 零可验证性；无法单测；框架无法真正复用；ADR-0001 列出的所有代价都会 100% 落在我们身上。

### 方案 B：DI 容器 / 抽象工厂式全解耦

- 引入 IoC 容器，所有服务通过接口注入，运行时决定实现。
- 否决理由：**过度设计**。小游戏矩阵的依赖图很浅（游戏 → 少量服务），手写构造函数注入足够。IoC 容器会带来"运行时才发现装配错误"的新问题，而我们要的是编译期错误。

### 方案 C：三层 + 显式构造函数注入（**采纳**）

把代码切成三层，依赖方向单向：

```
        ┌──────────────────────────────────────────────┐
        │  games/<game>/src        （玩法：球、挡板、砖块）│
        └───────────────────┬──────────────────────────┘
                            │ 只依赖
        ┌───────────────────▼──────────────────────────┐
        │  packages/framework/src/core （引擎无关）      │
        │  游戏循环 / 状态机 / 事件总线 / 输入 / 存档 /    │
        │  对象池 / 数值 / 关卡数据 / 渲染模型 / 音频调度   │
        └───────────────────▲──────────────────────────┘
                            │ 被实现 / 被消费
        ┌───────────────────┴──────────────────────────┐
        │  adapters（引擎相关）   platform（宿主相关）      │
        │  cocos / canvas2d      web / weapp / node      │
        └──────────────────────────────────────────────┘
```

**规则：依赖箭头永远从外指向 `core`，绝不反向。** `core` 目录里出现 `import ... from 'cc'`、`window`、`wx` 就是架构违规。

### 方案 D：只抽接口，运行时鸭子类型

- 否决理由：没有编译期保证，重构时容易静默失效。

---

## 3. 决定（Decision）

采用**方案 C**，并配套四个具体机制：

### 3.1 三层目录结构

| 层 | 路径 | 允许依赖 | 禁止依赖 |
| --- | --- | --- | --- |
| core | `packages/framework/src/core/**` | 仅 Node/ES 标准能力、同层模块 | `cc`、DOM、`wx`、任何适配器 |
| adapters | `packages/framework/src/adapters/{cocos,canvas2d}/**` | core | 具体游戏逻辑 |
| platform | `packages/framework/src/platform/**` | core（仅类型与接口） | 具体游戏逻辑 |
| game | `games/<game>/src/**` | core（公开 API） | `cc`、适配器内部实现 |

`canvas2d` 适配器是这套设计"能自我证明"的关键：**同一份 `RenderModel` 既喂给 Cocos `Graphics`，也喂给浏览器 Canvas2D**。如果游戏逻辑真的耦合了 Cocos，第二种适配器就不可能仅靠一份 `RenderModel` 实现出来。

### 3.2 用「渲染模型」而不是「渲染调用」作为引擎边界

游戏不调用任何绘制 API，而是每帧产出一份扁平的、纯数据的绘制指令列表：

```ts
interface RenderModel {
  readonly designWidth: number;
  readonly designHeight: number;
  readonly background?: string;
  readonly commands: readonly DrawCommand[];  // rect / circle / line / text / polygon
}
```

这一条同时解决了四个问题：
1. **引擎边界清晰**：适配器只认 `RenderModel`。
2. **UI 不持有游戏状态**：模型每帧由权威状态重新生成，用完即弃，UI 无从回写。
3. **可测试性**：测试可以断言"当前这一帧画了什么"，而不需要渲染器。
4. **确定性**：`buildRenderModel()` 被约定为**只读**，同样的状态必然产出同样的指令序列。

### 3.3 输入、平台、音频、存档全部走接口

- 引擎把原生事件翻译成 `PointerSample` 喂给 `InputManager`；游戏只读一份**逐帧不变快照** `InputSnapshot`。
- 平台差异（web / weapp / node）收敛在 `Platform` 接口：时钟、存储、帧回调、屏幕尺寸、前后台事件。
- 音频走 `AudioScheduler`（帧内批量、去重、限流），游戏只说"播放 `breakout.brick`"。
- 存档走 `SaveManager<T>`：带版本号与迁移链，`localStorage` 与 `wx.setStorageSync` 都是它的后端。

### 3.4 把"无法验证的部分"物理隔离

`packages/framework/src/adapters/cocos/bindings.ts` 是**唯一** `import ... from 'cc'` 的文件，并且：

- 被 `tsconfig.json` 的 `exclude` 排除，**不参与 Node 类型检查**；
- 不被 `src/index.ts` 导出；
- 文件头有显式警告 `UNVERIFIED — requires Cocos Creator 3.8 editor`；
- 每个可疑调用点用 `⚠` 标注，并在 `docs/engine-reference/cocos/VERSION.md` 逐条登记为知识缺口。

这样"不确定的代码"不会污染"确定的代码"的类型可信度——**宁可让一个文件不参与检查，也不要让整个仓库的类型检查变成谎言**。

---

## 4. 后果（Consequences）

### 4.1 正面

- **本轮的验收路径成立**：没有 Cocos 编辑器，仍然跑通了 **379 个测试**（框架 226 + 游戏 153）、`tsc --noEmit` 全绿、核心层语句覆盖率 94.45%、游戏层 97.2%。
- 游戏逻辑天然可测：确定性 RNG + 固定步长 + 纯函数物理，可写出"同一 seed 同一局面"的回放式断言。
- 换引擎的代价被限制在 `adapters/*` 与 `bindings.ts`，`core` 与 `games/*/src` 不动。
- 同一套游戏逻辑可以同时跑在 Cocos、浏览器 Canvas2D、以及未来的任何宿主上。
- 并行开发友好：游戏逻辑的单测不需要编辑器，任何成员（含 AI 会话）随时可验证。

### 4.2 负面 / 成本

- **多了一层间接**：新增一个绘制原语要改 `RenderModel` + 两个适配器，而不是直接调 API。对小项目是过度投入；对矩阵是划算的。
- **Cocos 的高级能力（动画、粒子、内置物理、Timeline）无法直接使用**，必须通过新的 `DrawCommand` 或适配器暴露。目前矩阵里的玩法不需要它们，但这是一条真实的上限（见下）。
- **`bindings.ts` 无法在 Node 侧被验证**——它的正确性只能在编辑器里确认。这是本设计**唯一**没有测试覆盖的文件，必须在编辑器就绪后第一时间补上手工验证清单。
- **`RenderModel` 的语义必须钉死**（例如 `rect` 的 `x,y` 是左下角、坐标系原点在左下、单位是设计空间），否则两个适配器会各自解读。我们把这条写进了类型注释与控制清单。

### 4.3 已知上限与后续演进

当某款小游戏确实需要 Cocos 的高级特性（骨骼动画、粒子、Tilemap）时，正确做法是：

1. 先在 ADR-0002 追加一条"逃生舱"设计（例如允许游戏注册一个 `CocosSceneContributor`，由适配器合并到渲染流程）；**而不是**让游戏逻辑直接 `import 'cc'`。
2. 逃生舱必须仍然是**单向**的：游戏 → 适配器 → 引擎。

---

## 5. 验证方式（How we know this works）

| 断言 | 证据 |
| --- | --- |
| core 不依赖引擎 | `tools/scripts/check-architecture.mjs` 扫描 `core/**` 中的 `from 'cc'` / `window` / `wx` |
| core 可脱离引擎运行 | `packages/framework/tests/**` 226 个用例在纯 Node 下通过 |
| 引擎边界只有一份 | 游戏逻辑通过 `RenderModel` 与 `PointerSample` 交互，`games/breakout/tests/view-model.test.ts` 断言指令序列 |
| 同一逻辑可跨引擎 | `Canvas2DRenderer` 与 `CocosRenderModelRenderer` 消费同一个 `RenderModel` |
| UI 不持有游戏状态 | `buildRenderModel()` 只读；`tests/view-model.test.ts`「never mutates the snapshot it is given」 |
