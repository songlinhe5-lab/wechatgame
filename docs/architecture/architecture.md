# 微信小游戏矩阵 — 主架构文档

- **版本**：0.1.0
- **日期**：2026-09-11
- **作者**：程基岩（技术 + 引擎负责人）
- **引擎**：Cocos Creator **3.8 LTS**（钉定 3.8.8，见 `docs/engine-reference/cocos/VERSION.md`）
- **关联决策**：ADR-0001（引擎选型）/ ADR-0002（框架解耦）/ ADR-0003（空场景）/ ADR-0009（Cocos MCP 编辑器接入，验证/构建/资源刷新闭环）

> 本文是技术侧的唯一入口。想立刻写代码 → 直接读 `control-manifest.md`。

---

## 1. 目标与约束

### 1.1 产品目标
一个**矩阵**：一套共用框架 + N 款独立微信小游戏。每款小游戏独立目录，各自拥有策划、程序、美术、构建产物。

### 1.2 硬约束

| 约束 | 数值 | 性质 |
| --- | --- | --- |
| 主包体积 | **≤ 4 MB** | 微信平台硬限制 |
| 主包 + 分包 | **≤ 30 MB** | 微信平台硬限制 |
| 运行时 | 微信小游戏 JS 运行时（无 DOM） | 平台硬限制 |
| 目标机型 | 低端 Android 优先 | 性能预算依据 |
| 帧率目标 | 60 FPS（低端机 ≥ 30 FPS） | 性能预算依据 |
| 协作方式 | 多成员 / 多 AI 会话并行同一仓库 | 架构的隐性主约束 |

### 1.3 非目标（本轮）
- 不做联网 / 排行榜 / 支付（但预留服务端权威的接口位置，见 §7）。
- 不做多语言、不做直播/视频号能力。
- 不引入第三方游戏框架（Egret/Laya/Pixi）——见 ADR-0001 方案 E 的否决理由。

---

## 2. 分层与依赖方向

```
┌─────────────────────────────────────────────────────────────────────────┐
│  games/<game>/                                                          │
│    src/        玩法逻辑（引擎无关）：实体 / 物理 / 计分 / 关卡 / 视图模型   │
│    tests/      vitest 单测（纯 Node）                                    │
│    cocos/      Cocos 工程（场景里只有一个 Bootstrap）                      │
│    design/ art/ build/   策划 / 美术 / 构建产物                            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  只依赖 core 的公开 API
┌───────────────────────────────▼─────────────────────────────────────────┐
│  packages/framework/                                                    │
│                                                                         │
│   ┌───────────────────────── src/core ──────────────────────────────┐   │
│   │  引擎无关。禁止出现 'cc' / window / wx / DOM。                     │   │
│   │  math · loop · events · fsm · scene · input · pool · save ·      │   │
│   │  config · audio · render(model+viewport) · game(App/Game)        │   │
│   └──────────────────────────────────────────────────────────────────┘  │
│                ▲                        ▲                               │
│                │ 实现/消费               │ 实现/消费                      │
│   ┌────────────┴──────────┐  ┌──────────┴───────────────────────────┐  │
│   │ src/adapters          │  │ src/platform                          │  │
│   │  canvas2d/  浏览器/测试 │  │  node.ts   测试 / CI / 校验脚本        │  │
│   │  cocos/     Cocos 3.8  │  │  web.ts    浏览器 dev harness          │  │
│   │    ├ renderer          │  │  weapp.ts  微信小游戏（wx.*）           │  │
│   │    ├ input-bridge      │  │  detectPlatform() 自动选择             │  │
│   │    ├ loop-bridge       │  │                                       │  │
│   │    ├ label-pool        │  │                                       │  │
│   │    └ bindings.ts ⚠     │  │                                       │  │
│   │      唯一 import 'cc'  │  │                                       │  │
│   └────────────────────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 依赖规则（可机械校验）

1. `core/**` **禁止** `import ... from 'cc'`、`from 'wx'`、`window.`、`document.`
2. `core/**` **禁止** import `adapters/**` 或 `platform/**` 的实现（只允许 `import type`）。
3. `games/<game>/src/**` **禁止** import `cc`、`adapters/**` 内部实现、`platform/*` 具体实现。
4. `adapters/**`、`platform/**` **禁止** import 任何具体游戏。
5. 依赖箭头永远指向 `core`，绝不反向。

> 校验脚本：`tools/scripts/check-architecture.mjs`（`npm run check:arch`）。

### 为什么这样切

`canvas2d` 适配器不是"玩具"，它是这套架构的**证明**：同一份 `RenderModel` 能同时喂给浏览器 Canvas2D 和 Cocos `Graphics`。如果玩法逻辑真的耦合了 Cocos，第二个适配器不可能只用一份渲染数据就实现出来。**它是架构约束的可执行证明，也是"没有编辑器也能看到画面"的逃生路径。**

---

## 3. 模块职责表（core）

| 模块 | 路径 | 职责 | 关键不变量 |
| --- | --- | --- | --- |
| 数学 | `core/math/` | `Vec2`、标量工具、缓动/曲线、确定性 RNG、AABB 与圆碰撞 | 热路径零分配（`out` 参数 / 可变向量） |
| 循环 | `core/loop/game-loop.ts` | 固定步长累加器 + 渲染插值 α | 相同帧序列必然产出相同结果 |
| 事件 | `core/events/event-bus.ts` | 类型化同步事件总线，支持优先级 / once / 中途退订 | 仅用于**通知**，不传状态 |
| 状态机 | `core/fsm/state-machine.ts` | 显式转移表，非法转移不可能发生 | 未声明的边永远不可达 |
| 场景栈 | `core/scene/scene-stack.ts` | 屏幕/图层栈：push/pop/replace + 生命周期 | 只有栈顶被 update |
| 输入 | `core/input/input-manager.ts` | 原生事件 → 逐帧不可变 `InputSnapshot` | 首指针独占手势；次指针忽略 |
| 对象池 | `core/pool/object-pool.ts` | 通用池，含 stats / maxIdle / maxSize | 双重归还被忽略而非腐蚀池 |
| 存档 | `core/save/` | `Storage` 接口 + 版本化 `SaveManager<T>` | 损坏 / 高版本存档回退默认值，**永不抛异常** |
| 数据 | `core/config/` | `DataRegistry` + 字符网格关卡编译与校验 | 坏数据在启动期报错，不在运行期 |
| 音频 | `core/audio/audio.ts` | 帧内批量派发 + 去重 + 限流 | 一次 flush 内同 clip 只响一次 |
| 渲染 | `core/render/` | `RenderModel`（绘制指令数据）+ `Viewport`（设计分辨率 + letterbox + 坐标互换） | `RenderModel` 是引擎唯一边界 |
| 游戏 | `core/game/game.ts` `app.ts` | `Game` 契约 + `App` 装配（平台→服务→循环→游戏） | `buildRenderModel()` 必须只读 |

---

## 4. 数据流（一帧）

```
平台 rAF/wx 帧回调
      │  dt(ms)
      ▼
   App.tick(dtSeconds)
      ├─ InputManager.beginFrame()          ← 上一帧状态转 previous
      ├─ FixedStepLoop.advance(dt)          ← 累加；可能跑 N 个固定步
      │     └─ 每个固定步 (1/60)：
      │           game.update(1/60)
      │              ├─ 读 InputSnapshot（不可变）
      │              ├─ 推进状态机（ready/playing/…）
      │              ├─ 物理：stepBall（子步进，防穿透）
      │              ├─ 计分：Scorer（连击 → 倍率）
      │              └─ emit 事件（brick:destroyed / paddle:hit / …）
      │                    ↓（订阅者）
      │                 AudioScheduler.play(clip)   ← 只入队
      ├─ 渲染：game.buildRenderModel(builder)  ← 只读快照 → RenderModel
      ├─ onRender(model, alpha) → 适配器绘制
      ├─ AudioScheduler.flush(dt)            ← 每帧一次真正派发
      └─ InputManager.endFrame(dt)
```

**关键点**：物理与玩法只跑在**固定步长**上；渲染拿插值 α。这保证了"120 Hz iPad 与 60 Hz Android 上球速一致"，也让单测可以一次 `advance(10)` 模拟 10 秒。

---

## 5. 包体预算分配（微信小游戏）

主包 ≤ **4 MB** 是硬红线，**在编码阶段就要预算**，不能等构建再优化。

| 分区 | 预算 | 说明 | 当前状态 |
| --- | --- | --- | --- |
| 引擎运行时（Cocos 裁剪后） | 1.2 – 1.8 MB | 3.8 的 `graphics` + `label` + `ui` + `2d` 模块；构建时**必须裁剪未用模块** | 待编辑器构建验证 |
| 框架层（清 minify 后） | ≤ 60 KB | 纯 TS，无资源 | 源码 ~5.5 kLOC；无运行时依赖 |
| 游戏逻辑（单款） | ≤ 40 KB | 玩法 + 关卡数据 | breakout 源码 ~2.3 kLOC |
| 首屏必要图片/字体 | ≤ 800 KB | **本作目前用矢量绘制（Graphics），首屏 0 图片** | ✅ 见 §5.1 |
| 首屏音频 | ≤ 300 KB | 短音效用压缩音频；BGM 走**远程包/分包** | 待接入 |
| 其他（manifest、适配层） | ≤ 100 KB | | |
| **主包合计预留** | **≤ 4 MB** | | |

超出主包的内容一律走**分包 / 远程包**：

| 内容 | 归属 |
| --- | --- |
| 关卡 2..N 的美术资源 | 分包 `levels` |
| 音乐 / 长音效 | 远程包（CDN），运行时下载 |
| 每款游戏的独有资源 | 各自分包，合计 ≤ 30 MB |

### 5.1 本项目的体积极简优势

打砖块目前**全部用矢量绘制**（矩形 / 圆 / 多边形 / 文本），首屏图片资源为 **0**。这不是偷懒，而是刻意让第一款游戏把包体基线压到最低，验证"主包 ≤ 4 MB 且不含任何图片"是可行的。后续游戏若要接入位图美术，预算表按上表逐项扣减。

**体积校验脚本**：`tools/scripts/check-bundle-size.mjs`（`pnpm run check:size`；产物不存在时自动跳过，故干净检出 / CI 均安全）。

- **判定基准 = 原始字节（raw）**：微信平台按上传文件的实际大小卡口；gzip 体积仅作参考展示（逐文件求和，属估算）。本行此前写作「做 **gzip 后**统计」，与实现不符，已按 raw 判定修正——按 raw 卡严格更安全（宁假红不假绿）。
- **阈值真源**：`games/<game>/design/gdd/systems-index.md` §3.8（红线 4096 / 30720 KB 与内部目标 2000 KB **分列不混用**）。本文件不复述数字，避免两处真源。
- **分包判定**：优先读产物 `game.json` 的 `subpackages[].root`，取不到回退 `subpackages/` 启发式，再取不到则**全部计入主包**（保守）。Cocos 产物真实目录结构见 `VERSION.md` G7（未实测）。

---

## 6. 构建链

```
                     ┌──────────────────────────────┐
   源码 (TS)          │ 1. 静态校验（纯 Node，可 CI）  │
   packages/          │    tsc --noEmit（两包各一次）  │
   games/*/src        │    check-architecture.mjs    │
        │             │    check-secrets.mjs         │
        ▼             │    vitest run（379 用例）      │
   ┌─────────┐        └──────────────────────────────┘
   │ 开发者   │
   └────┬────┘
        │
        ├──────────────► 2. 浏览器试玩（dev harness）
        │                   dev/harness/index.html
        │                   Canvas2DRenderer + WebPlatform
        │                   ← 无需 Cocos 编辑器，秒级迭代
        │
        └──────────────► 3. Cocos 构建（需要编辑器 ⚠）
                            games/<game>/cocos/  → 构建为微信小游戏
                            产物 → games/<game>/build/
                            → check-bundle-size.mjs
                            → 微信开发者工具真机预览
```

| 阶段 | 命令 | 需要编辑器 | 可在 CI |
| --- | --- | --- | --- |
| 类型检查 | `npm run typecheck` | ❌ | ✅ |
| 单测 | `npm test` | ❌ | ✅ |
| 架构守卫 | `npm run check:arch` | ❌ | ✅ |
| 密钥守卫 | `npm run check:secrets` | ❌ | ✅ |
| 体积校验 | `npm run check:size` | ❌（对已有产物；无产物自动跳过） | ✅ |
| 浏览器试玩 | `npm run dev` | ❌ | ❌ |
| Cocos 构建 | `pnpm run build:cocos`（默认 wechatgame）/ `build:cocos:web`（web-mobile，免 AppID） | ✅ | ⚠️ 非 CI（需装编辑器），但**可脚本化** |

> **诚实说明**：微信小游戏的最终构建**必须**有 Cocos 编辑器。CI 能做的是"在提交时拦下类型错误、单测失败、架构违规、密钥泄露"，而不是产出安装包。这是 ADR-0001 记录的核心代价之一。
>
> **2026-09-14 实测修正（WXG-T-047）**：曾寄望经 Cocos MCP（`ADR-0009` §3.2 **P2**）「从命令行驱动编辑器构建」。实测 **`cocos-mcp-server` v1.5.4 不成立**：`project_build_system` 只有 `get_build_settings` / `open_build_panel` / `check_builder_status` 三个 action（**无构建**），唯一含 `build` 的 `project_manage` 被白名单禁用，且其实现仅 `Editor.Message.request('builder','open')`——扩展源码注释原文：*Builder module only supports 'open' and 'query-worker-ready'. Building requires manual interaction through the build panel*。⇒ **MCP 通道**不能构建；智能体经 MCP 只能「读构建设置 / 查状态 / 回读编译日志（`debug_console`）」。
>
> **同日第二轮实测——上面那句被推翻了（WXG-T-049）**：Cocos Creator **自带 CLI 可以构建**。
> 官方手册《命令行发布项目》给出 `CocosCreator --project <proj> --build "platform=<p>;debug=true"`；
> 本机 `app-asar` 内含 `--project` / `--build` / `buildConfig`；实测 `platform=web-mobile`
> **3.9 秒构建成功**（产物含 `index.html` / `cocos-js/` / `assets/`，日志 `build Task (web-mobile) Finished in (3 s)`），
> 且**编辑器实例同时开着也不冲突**。
> ⇒ 正确表述是「**MCP 通道不可，编辑器 CLI 可**」。构建产物默认落**工程内** `cocos/build/<platform>/`
> （与本文件 §1/§5 约定的 `games/<game>/build/` 不同，故 `check:size` 两处都扫，避免「产物在、门禁说没有」的静默跳过）。
> G7 的**空体积基线**因此可通过 `pnpm run build:cocos` 直接取得，不再依赖人工点击。
> **教训**：这是「把一次通道失败写成能力结论」的典型代价——登记偏差时要写清**失败的是哪条通道**。

---

## 7. 扩展点（为矩阵后续游戏预留）

| 需求 | 预留位置 | 说明 |
| --- | --- | --- |
| 联网 / 排行榜 | `Platform` 增加 `http` 能力；新增 `core/net/` | 服务端**权威**：客户端只做预测与表现（见控制清单） |
| 广告 / 分享 / 支付 | `platform/weapp.ts` 暴露 `wx.*` 能力接口 | 与玩法逻辑隔离，通过事件驱动 |
| 关卡编辑器 | 数据表（JSON / `.tres`）→ 代码构建节点 | 绝不用 `.scene` 承载关卡（ADR-0003） |
| 新绘制原语（粒子/精灵） | `RenderModel` 增加 `DrawCommand` + 两处适配器 | 保持单向：游戏 → 适配器 → 引擎 |
| 换引擎 | 只改 `adapters/*` 与 `bindings.ts` | `core` 与 `games/*/src` 不动（ADR-0002 的收益） |

---

## 8. 风险登记册

| # | 风险 | 影响 | 概率 | 缓解措施 | 触发信号 |
| --- | --- | --- | --- | --- | --- |
| R1 | **Cocos `bindings.ts` 未经编辑器验证** | 首次在编辑器运行时可能编译失败 | 高 | 每个可疑点已标 `⚠` 并登记在 `VERSION.md`；建议编辑器就绪后 0.5 天内跑通 | 编辑器首次编译报错 |
| R2 | 框架源码如何被 Cocos 工程引用（npm 包 vs 拷贝）未定 | 阻塞 Cocos 工程搭建 | 高 | 三个候选方案已列在 `games/breakout/cocos/README.md`，标为待验证 | 编辑器就绪后第一步 |
| R3 | 引擎运行时裁剪不到 1.8 MB | 击穿主包 4 MB | 中 | 构建时按模块裁剪；首屏零图片已预留大量余量 | 首次构建产物超 3.2 MB |
| R4 | 低端机 draw call / 帧率不达标 | 体验崩坏 | 中 | 单 `Graphics` 设计 + 60 帧固定步长；`tools/scripts` 预留性能采样 | 真机帧率 < 30 |
| R5 | Cocos 4 迁移 | 重写适配层 | 低（短期） | ADR-0001 §5 复评触发条件；分层把成本压在 `adapters/*` | 官方发布 4.x 微信导出文档 |
| R6 | `.meta` 引用失效（资源目录调整） | 编辑器红字、构建失败 | 中 | 资源目录调整**只通过编辑器**；控制清单已列 | 编辑器出现红色感叹号 |

---

## 9. 当前实现状态（本轮）

| 交付物 | 状态 |
| --- | --- |
| 框架 core（12 模块） | ✅ 完成，226 单测通过，语句覆盖 94.45% |
| Canvas2D 适配器 | ✅ 完成，含 9 个渲染用例 |
| Cocos 适配器（纯逻辑部分） | ✅ 完成（renderer / input-bridge / loop-bridge / label-pool），11+6+5 用例 |
| Cocos `bindings.ts` | ⚠️ **已写但未验证**（无编辑器），缺口见 `VERSION.md` |
| 平台层（node / web / weapp） | ✅ 完成，16 用例 |
| 打砖块玩法 | ✅ 完成（6 关卡 / 物理 / 计分 / 连击 / 生命 / 存档），153 单测通过，覆盖 97.2% |
| 架构文档 + 3 份 ADR + 控制清单 | ✅ 完成 |
| 构建 / 校验脚本 | ✅ 完成（占位脚本已标注"需编辑器"） |
| Cocos 工程本体（`.scene` / `.meta`） | ❌ **刻意未创建**——必须由编辑器生成（ADR-0003） |
