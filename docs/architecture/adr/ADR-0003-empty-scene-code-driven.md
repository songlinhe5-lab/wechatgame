# ADR-0003 — 空场景 + 全代码构建

- **状态**：已接受（Accepted）
- **日期**：2026-09-11
- **决策人**：程基岩（技术 + 引擎负责人）
- **关联**：ADR-0001、ADR-0002、`docs/architecture/control-manifest.md`

---

## 1. 上下文（Context）

Cocos Creator 的 `.scene` 文件是 JSON，但它的结构对"人工合并"极度不友好：

- 节点、组件、资源引用都用 **`id` 字符串**标识，而 `id` 是**相对顺序索引**（形如 `"a1Bc2"`, `"a1Bc3"` 这种由编辑器生成的短 ID，但节点在数组中的位置才是真正的顺序语义）。
- 在场景树中间插入一个节点，编辑器会重新编号其后的大量引用。结果：**一个"加了个空节点"的意图，变成几百行 diff**。
- 组件字段是位置相关的数组，重排即全变。
- `.scene` 与 `.meta` 成对出现，`.meta` 里也有 UUID 引用。

对本项目这意味着什么？我们的工作方式是**多成员 / 多 AI 会话并行**。如果多个会话同时改同一款游戏的场景：

```
会话 A：在 HUD 下加一个"连击提示"节点
会话 B：调整关卡根节点的位置
→ git merge：数百行冲突，且冲突内容是编辑器自动生成的 ID，人工几乎无法正确解决
```

这不是"偶尔麻烦"，而是**并行开发能力的直接损失**。对矩阵项目（多游戏同时推进）尤其致命。

此外还有第二层问题：**没有编辑器就无法产出场景**。用户本轮尚未安装 Cocos Creator，如果我们把结构放进 `.scene`，这一轮就什么都验证不了。

---

## 2. 备选方案（Alternatives）

### 方案 A：常规 Cocos 工作流（场景里搭节点树）

- 编辑器可视化编辑，美术/策划可自查，是 Cocos 的"标准用法"。
- **否决理由**：
  1. 并行合并必然冲突（见上）。
  2. 无编辑器 = 零可验证性（本轮直接卡死）。
  3. 场景成为"隐藏的权威状态"——逻辑分散在 `.ts` 与 `.scene` 两处，代码审查看不到全貌。

### 方案 B：Prefab 化——每类对象一个 `.prefab`，场景只做组装

- 比方案 A 好：单个 prefab 的改动范围小。
- **否决理由**：只是把冲突粒度从"场景级"降到"prefab 级"，**没解决**多人同时改同一个 prefab 的问题；而且 prefab 的覆写机制（override）在 diff 里同样难以判读。仍然需要编辑器才能创建。

### 方案 C：空场景 + 全代码构建（**采纳**）

`.scene` 里只有 **一个节点 + 一个脚本组件（`Bootstrap`）**。其余一切——渲染节点、Graphics、Label 池、UI——**全部在运行时由代码创建**。

```
Main.scene
└── GameRoot                     ← 唯一的节点（手工/编辑器创建一次，之后永不再改）
    └── (Bootstrap 组件)          ← 唯一的脚本挂载点
        └── 运行时创建：Graphics / Labels / 未来的粒子…
```

代码侧的主入口（见 `packages/framework/src/adapters/cocos/bindings.ts`）：

```ts
@ccclass('Bootstrap')
export class Bootstrap extends Component {
  start() { this._buildGraph(); if (this.autoStart) this.launch(this.createGame()); }

  private _buildGraph() {
    const root = new Node('GameRoot');
    this.node.addChild(root);
    root.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);

    const graphicsNode = new Node('Graphics');
    root.addChild(graphicsNode);
    this._graphics = graphicsNode.addComponent(Graphics);

    const labelRoot = new Node('Labels');
    root.addChild(labelRoot);
    this._labels = new PooledLabelSource({ /* 池化 Label，避免每帧 new Node */ });
  }
}
```

### 方案 D：完全不用 Cocos 编辑器，纯自定义构建

- 否决理由：等价于放弃 ADR-0001 选 Cocos 的全部理由（微信导出链路）。自相矛盾。

---

## 3. 决定（Decision）

**采用方案 C。** 并把它具体化为以下可执行约束：

### 3.1 场景文件的唯一合法状态

| 允许 | 禁止 |
| --- | --- |
| 一个空场景，含 1 个节点 + 1 个 `Bootstrap` 组件 | 在场景里摆放任何游戏节点 |
| 在该节点上设置设计分辨率（Canvas / UITransform） | 在场景里连任何信号（signal / event） |
| 引用字体、图集等**资源**（通过编辑器导入） | 手工用文本编辑器改 `.scene` / `.prefab` |
| | 在场景里配任何游戏数值（数值一律进代码或数据表） |

判定标准一句话：**打开 `Main.scene`，除了 `GameRoot` + `Bootstrap` 之外多出任何节点，就是架构违规。**

### 3.2 框架层要"直接支持"这种用法

这条决定了框架 API 的形状，不是事后补的：

- **`RenderModel` 是唯一绘制出口**（ADR-0002）。场景里没有节点，绘制只能靠代码，所以渲染必须是一份数据。
- **`CocosRenderModelRenderer` 只持有一个 `Graphics` + 一个 Label 池**。所有矢量图形进同一个 `Graphics`——这同时是**性能决策**：Cocos 里每个 `Graphics` 是一个 draw call，打砖块有 50+ 砖块，若每个砖一个节点会直接击穿低端机的 draw call 预算。
- **`PooledLabelSource`** 处理 Cocos 用 `Label` 节点画文字的事实：按帧借还，节点数稳定在"峰值用量"，之后零分配。
- **`CocosLoopBridge`** 用 `Component.schedule(cb, 0)` 把引擎帧驱动到框架的固定步长循环，而不是让游戏逻辑依赖 `update()`。
- **`Bootstrap` 是唯一需要 `cc` 的地方**，且已隔离（ADR-0002 §3.4）。

### 3.3 与"编辑器缺失"共存

因为场景里没有内容，**在编辑器里重建工程几乎是零成本**：

1. 新建空场景 → 加一个空节点 → 挂 `Bootstrap` → 保存。
2. 设置设计分辨率 750×1334。
3. 完成。

三分钟、零节点摆放、零冲突风险。这意味着即便 `.scene` 丢失或损坏，损失也极小——**场景文件从"不可再生的权威资产"降级为"可随时重建的引导文件"**，这是本 ADR 最大的收益。

---

## 4. 后果（Consequences）

### 4.1 正面

- **`.scene` 的合并冲突被根除**——因为它永远只有两个东西，且几乎不变。
- **无编辑器也可开发**：本轮在**没有 Cocos 编辑器**的前提下，写出了完整的游戏逻辑、跑通了 379 个测试、并用浏览器 Canvas2D 适配器实现了可视化（见下方"代价"中关于可视化的说明）。
- **单一权威状态**：所有结构都在 TypeScript 里，代码审查能看到全貌，`grep` 能找到一切。
- **性能可控**：draw call 数量由我们决定（1 个 Graphics），而不是由节点树决定。
- **场景可重建**：`.scene` 损坏/丢失不再是灾难。

### 4.2 负面 / 成本

- **失去可视化编辑**：美术/策划无法在编辑器里拖拽调版式。版式参数必须进代码或数据表（我们已把 HUD 布局常量集中在 `view/view-model.ts` 的 `HUD` 对象里，便于后续外提为配置）。
- **UI 迭代需要写代码**：调一个按钮位置要改代码 + 重新加载，而不是拖一下。对小游戏矩阵可接受（UI 简单），对重 UI 项目是负担。
- **新手不友好**：不熟悉 Cocos 代码 API 的成员上手更慢，且没有编辑器 UI 作为参照。
- **`Bootstrap` 必须由游戏项目继承**：`Bootstrap.createGame()` 抛异常，要求子类提供 `Game` 实现。这是刻意的——避免框架层反向依赖具体游戏。
- **缺少编辑器内的可视调试**：没有属性面板可以实时改值。对策是框架的 `BreakoutTuning` 全是纯数据，可在 dev harness 里做调参面板（见 `dev/harness`）。

### 4.3 这条决策的边界

当某款游戏确实需要大量可视化编辑（例如关卡编辑器、复杂 UI 流）时，正确做法**不是**回到方案 A，而是：

1. 做一个**数据驱动的编辑器**（导出 JSON / `.tres` 数据表），由代码在运行时构建节点；
2. 或者做一个**编辑器扩展**，从数据生成节点。

**数据表 + 代码构建**永远优于**场景文件**。这条原则不因游戏复杂度而改变。

---

## 5. 验证方式（How we know this works）

| 断言 | 证据 |
| --- | --- |
| 场景里只有一个节点 + 一个脚本 | `games/breakout/cocos/README.md` 中的手工步骤清单（仅 3 步） |
| 框架支持全代码构建 | `CocosRenderModelRenderer` / `PooledLabelSource` / `CocosLoopBridge`，见 `packages/framework/src/adapters/cocos/` |
| 无编辑器仍可验证玩法 | 379 个 Node 测试通过；`dev/harness` 可在浏览器里跑起真实游戏 |
| 无编辑器也能可视化 | `Canvas2DRenderer` + `dev/harness/index.html`（与 Cocos 消费同一份 `RenderModel`） |
| 禁止手工编辑场景 | `tools/scripts/check-architecture.mjs` 中的 `.scene`/`.prefab` 守卫检查（配合 code review） |
