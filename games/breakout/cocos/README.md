# Breakout — Cocos Creator 工程落位与手工步骤

- **引擎**：Cocos Creator 3.8 LTS（3.8.8）
- **设计分辨率**：750 × 1334，竖屏，`Fit Height`
- **构建目标**：微信小游戏（`wechatgame`）
- **关联**：ADR-0001（选型）/ ADR-0002（解耦）/ ADR-0003（空场景）/ `docs/engine-reference/cocos/VERSION.md`

---

## ⚠️ 先读这一段

本目录**故意不含** `.scene` / `.prefab` / `.meta`。

原因（ADR-0003）：Cocos 的 `.scene` 里节点 `id` 是相对顺序索引，插入一个节点会导致数百处引用重排，多人/多 AI 并行时不可合并。因此本项目规定：

> **场景里只允许 `GameRoot` 一个节点 + `Bootstrap` 一个脚本。其余一切由代码在运行时创建。**

这些文件**必须由 Cocos Creator 编辑器生成**。手工编写它们（或由脚本伪造）会产出编辑器无法正确加载的破损工程。**不要伪造。**

好消息是：因为场景里没有内容，**重建它只需要 3 分钟**。

---

## 1. 目录落位约定

```
games/breakout/
├── src/                 # ✅ 玩法逻辑（引擎无关，纯 TS，可单测）
│   ├── config/          #    数值与关卡数据
│   ├── entities/        #    球 / 挡板
│   ├── systems/         #    物理 / 计分
│   ├── game/            #    状态机 / 存档 schema / BreakoutGame
│   └── view/            #    调色板 / 渲染模型构建（唯一知道"长什么样"的地方）
├── tests/               # ✅ vitest（纯 Node）
├── cocos/               # ← 本目录：Cocos Creator 工程根
│   ├── assets/
│   │   └── scripts/
│   │       ├── BreakoutBootstrap.ts     ← 需要你手工创建（见 §3）
│   │       └── framework/               ← 框架源码引入点（见 §2，方案待定）
│   ├── settings/                        # 编辑器生成
│   └── project.json                     # 编辑器生成
├── design/              # 策划（其他成员负责）
├── art/                 # 美术（其他成员负责）
└── build/               # 构建产物（微信小游戏包）
```

### 1.1 什么放 `assets/scripts`，什么不放

| 位置 | 放什么 | 理由 |
| --- | --- | --- |
| `cocos/assets/scripts/` | **只有** `BreakoutBootstrap.ts` 与框架引入目录 | 编辑器只编译 `assets/` 下的脚本 |
| `games/breakout/src/` | 全部玩法逻辑 | 必须能在 Node 下单测（L3 铁律） |
| `packages/framework/src/` | 框架 | 被多款游戏共享 |

`games/breakout/src/` 里的代码**不**放进 `cocos/assets/`——否则会被编辑器二次编译，且无法在 Node 下测试。

---

## 2. 如何引用 `packages/framework`（**待编辑器验证**）

**这是当前最高优先级的未知项**（`VERSION.md` 缺口 G1）。三种候选方案，按推荐顺序：

### 方案 A：npm 包依赖（推荐，若编辑器支持）

```jsonc
// games/breakout/cocos/package.json（如编辑器支持工程级 package.json）
{
  "dependencies": { "@wxgame/framework": "file:../../../../packages/framework" }
}
```

然后：

```ts
// cocos/assets/scripts/BreakoutBootstrap.ts
import { Bootstrap } from '@wxgame/framework/adapters/cocos';
import { createBreakoutGame } from '../../../../src/index';  // ← 同样待验证
```

- **未知**：Cocos 3.8 是否解析 `exports` map？是否编译 `node_modules` 里的 `.ts`？`type: "module"` 是否被接受？

### 方案 B：构建产物（`dist`）

先 `npm run build` 产出 `dist/*.js` + `.d.ts`，再让工程依赖产物。

- **代价**：多一步构建；调试时断点落在产物上。
- **未知**：编辑器的 sourcemap 支持程度。

### 方案 C：物理拷贝（最土，但**必然可行**）

```bash
# 由 tools/scripts/sync-framework-to-cocos.mjs 执行（占位脚本已提供）
rsync -a --delete packages/framework/src/ games/breakout/cocos/assets/scripts/framework/
```

- **优点**：零未知，肯定能编译。
- **代价**：源码有两份，容易不同步 → **必须**用脚本同步，禁止手工拷贝；并在 CI 里校验一致性。
- **注意**：拷贝进 `assets/` 后，`src/core/index.ts` 里 `export * from './x.js'` 的 `.js` 后缀是否被 Cocos 编译链解析，**仍需验证**（若不支持，需要改成无后缀导入——这会同时影响 Node 侧，需谨慎）。

> **建议路径**：先在编辑器里试 **方案 C**（保证能跑通），拿到基线后再回头验证 A / B 能否替代。
> 无论采用哪个方案，**框架源码本身不改一行**——这是 ADR-0002 分层带来的收益。

---

## 3. 在编辑器中手工完成的步骤清单

> 预计 5–10 分钟。**不涉及任何节点摆放。**

### 步骤 1：创建工程

1. Cocos Dashboard → **新建** → 选择 **Empty（3D）** 或 **Empty（2D）** 模板均可（我们不用模板内容）。
2. 工程路径指向 **`games/breakout/cocos/`**。
3. 工程名：`breakout`。

### 步骤 2：设置设计分辨率

`项目 → 项目设置 → 项目数据`：

| 项 | 值 |
| --- | --- |
| 设计宽度 | `750` |
| 设计高度 | `1334` |
| 适配模式 | `Fit Height`（竖屏游戏） |

`项目 → 项目设置 → 功能裁剪`：**只勾选**本项目用到的模块（详见 `VERSION.md` §2 能力清单）：
- `2D` → `Graphics`、`Label`、`UITransform`
- 取消未使用的：3D、物理、粒子、动画、Spine、DragonBones、视频、WebView、TiledMap

> 这一步直接决定主包能否 ≤ 4 MB（`architecture.md` §5）。

### 步骤 3：创建空场景

1. `assets/` 右键 → **创建 → 场景**，命名 `Main`。
2. 双击打开。**不要**添加任何节点。
3. 在层级管理器空白处右键 → **创建 → 空节点**，重命名为 `GameRoot`。
4. 选中 `GameRoot`，在**属性检查器**里：
   - 添加组件 → `UITransform`，内容尺寸设为 `750 × 1334`。
   - 添加组件 → `BreakoutBootstrap`（见步骤 4）。
5. 保存场景（`Ctrl/Cmd + S`）。

> **完成后场景里应当只有：`Main`（Scene）→ `GameRoot`（Node）→ `UITransform` + `BreakoutBootstrap`。**
> 出现任何其他节点 = 违反 ADR-0003。

### 步骤 4：创建 `BreakoutBootstrap.ts`

把下面的文件**原样**创建为 `games/breakout/cocos/assets/scripts/BreakoutBootstrap.ts`（用编辑器新建脚本后粘贴内容）：

```ts
import { _decorator } from 'cc';
import { Bootstrap } from './framework/adapters/cocos/bindings';   // ← 路径取决于 §2 采用的方案
import type { Game } from './framework/core/game/game';
import { createBreakoutGame } from '../../../../src/index';         // ← 路径取决于 §2 采用的方案

const { ccclass } = _decorator;

/**
 * Breakout 的 Cocos 入口。
 *
 * 这是整个 Cocos 工程里唯一"懂游戏"的文件：它只做一件事——把
 * BreakoutGame 交给框架的 Bootstrap。**没有任何游戏逻辑在这里。**
 */
@ccclass('BreakoutBootstrap')
export class BreakoutBootstrap extends Bootstrap {
  protected createGame(): Game {
    return createBreakoutGame();
  }
}
```

> ⚠️ 导入路径必须按 §2 最终选定的方案调整。这是**预期会出错**的地方之一（缺口 G1）。

### 步骤 5：把 `Main` 设为启动场景

`项目 → 项目设置 → 项目数据 → 起始场景` → 选择 `Main`。

### 步骤 6：构建为微信小游戏

1. `项目 → 构建发布`。
2. 平台选 **微信小游戏**。
3. 填写 AppID（用户提供）、构建输出目录 `games/breakout/build/wechatgame`。
4. 勾选 **MD5 缓存**、**压缩纹理**（如接入位图美术后）。
5. 构建 → 用**微信开发者工具**打开产物目录 → 真机预览。

### 步骤 7：体积校验

```bash
node tools/scripts/check-bundle-size.mjs games/breakout/build/wechatgame
```

主包 > 4 MB 或主包+分包 > 30 MB 会**失败退出**。

---

## 4. 预期会踩的坑（提前告知）

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `Cannot find module '@wxgame/framework'` 或路径爆红 | 缺口 G1：框架引入方式未定 | 改用 §2 方案 C（物理拷贝） |
| `Unexpected token 'export'` / `.js` 后缀解析失败 | Cocos 编译链不解析带 `.js` 后缀的 ESM 导入 | 需评估无后缀导入方案（会影响 Node 侧，改动前先讨论） |
| 画面上下颠倒 | 缺口 G2：`Graphics.rect` 的 y 方向与框架设计空间（左下原点）不一致 | 调整 `CocosRenderModelRenderer` 的坐标转换（`convertToCenteredOrigin` / y 翻转），**不要**改游戏逻辑 |
| 触摸位置上下颠倒 | 缺口 G4：`getUILocation()` 坐标系 | 修正 `bindings.ts` 里的 `mapPoint` |
| 文字跑偏 / 不居中 | 缺口 G3：`Label` 锚点与对齐枚举 | 用 `UITransform.width` 回填真实宽度，替换 `_anchorForText` 的估算 |
| 球速与预期不符（快/慢 60 倍） | 缺口 G5：`schedule` 的 dt 单位（秒 vs 毫秒） | 修正 `CocosLoopBridge` |
| 分数文字层级被砖块挡住 | `Label` 节点与 `Graphics` 节点的兄弟顺序 | 调整 `_buildGraph()` 里 `Labels` 节点的 `setSiblingIndex` |
| 帧率偏低 | draw call / 未裁剪引擎模块 | 见 G7；确认矢量图形都进**同一个** `Graphics` |

> 所有坑都已登记在 `docs/engine-reference/cocos/VERSION.md` §3。**踩到坑之后请回来更新该文件。**

---

## 5. 不需要编辑器就能做的事（先做这些）

```bash
# 玩法逻辑单测（153 用例，覆盖 97.2%）
cd games/breakout && npm test

# 类型检查
cd games/breakout && npm run typecheck

# 浏览器里真玩一遍（用 Canvas2D 适配器，不需要 Cocos）
npm run dev     # 打开 dev/harness/index.html
```

`dev/harness` 会加载**同一份** `BreakoutGame`，用 `Canvas2DRenderer` 绘制。它验证的是同一个 `RenderModel`，所以**玩法、手感、数值在浏览器里调好之后，Cocos 侧只需保证渲染适配器正确**——这正是 ADR-0002 分层的目的。

---

## 6. 检查表

```
[ ] cocos/ 工程已创建，设计分辨率 750×1334，Fit Height
[ ] 功能裁剪已按 VERSION.md §2 执行
[ ] Main.scene 里只有 GameRoot + UITransform + BreakoutBootstrap
[ ] BreakoutBootstrap.ts 已创建，createGame() 返回 createBreakoutGame()
[ ] 框架引入方案已选定（A / B / C），并回填到 VERSION.md G1
[ ] Main.scene 已设为起始场景
[ ] 构建 → 微信开发者工具打开 → 真机预览可玩
[ ] check-bundle-size.mjs 通过（主包 ≤ 4 MB）
[ ] VERSION.md §3 中已解决的缺口项已更新
[ ] assets/** 与其 .meta 已提交（library/ local/ temp/ build/ 不入库）
```
