# Beads — Cocos Creator 工程

- **引擎**：Cocos Creator 3.8 LTS（3.8.8）
- **设计分辨率**：750 × 1334，竖屏，`Fit Height`（`settings/v2/packages/project.json`）
- **构建目标**：微信小游戏（`wechatgame`）
- **关联**：ADR-0001（选型）/ ADR-0002（解耦）/ ADR-0003（空场景）· `docs/agent/cocos-setup.md §13`（逐步落地清单）· `docs/engine-reference/cocos/VERSION.md`（缺口 G1–G9）

> **本文件不复述通用说明。** 工程落位约定「什么放 `assets/scripts`、什么不放」、方案 C（物理拷贝）
> 的理由与红线、编辑器逐步清单、预期会踩的坑——权威出处是 **`games/breakout/cocos/README.md`**
> 与 **`docs/agent/cocos-setup.md §13`**。本文只记 beads 特有的东西，**避免两处真源漂移**。

---

## 1. beads 特有事实

| 项 | 值 | 依据 |
|---|---|---|
| 入口脚本 | `assets/scripts/BeadsBootstrap.ts`（`createGame()` → `createBeadsGame()`） | 照 breakout `BreakoutBootstrap.ts` 范式 |
| 场景 | `assets/Main.scene`，节点 = 模板默认（`Canvas` / `Camera`）+ `GameRoot` | 与 breakout **节点集完全相同** |
| 场景 uuid | `9683d2dd-7e97-4fe3-a54d-3e2ef554406a`（`assets/Main.scene.meta`） | 编辑器生成 |
| 引擎模块集 | `settings/v2/packages/engine.json`：55 项中 **11 项 true**，与 breakout **逐项相同** | beads 的 `src/**` 按 L3 **不 import `cc`**；用到引擎能力的只有 `framework/adapters/cocos/**`，与 breakout **同一份适配器** |
| 包体阈值 | 主包 ≤ 4096 / 合计 ≤ 30720 KB（红线）；主包 ≤ **2000 KB**（内部目标）；美术位图 **0 KB** | `games/beads/design/gdd/systems-index.md` §3.8/§3.9（**beads 自己的真源，勿套用 breakout 的数字**） |
| 玩法逻辑 | 住在 `games/beads/src/`，**不在** `assets/` | L3 铁律：必须能在纯 Node 下单测 |

---

## 2. 命令（均在 monorepo 根执行）

```bash
pnpm run framework:sync            # 同步 packages/framework/src + games/beads/src → assets/scripts/
pnpm run framework:sync:check      # 漂移校验（CI 跑；应报 breakout 与 beads 两款一致）
pnpm run cocos:check               # Cocos 脚本类型检查（需先开过编辑器，才有 temp/declarations）
pnpm run build:cocos:web           # web-mobile，**免 AppID**——先看渲染/手感
pnpm run build:cocos --release     # 微信小游戏；包体基线**必须** release
pnpm run check:size                # 主包/分包体积门禁（自动发现 games/*/build/wechatgame 与 cocos/build/）
```

单款指定（任意 cwd）：`node tools/scripts/build-cocos.mjs --game=beads --platform=web-mobile`

> ⚠️ `assets/scripts/{framework,game}/**` 是**拷贝件**，由 `framework:sync` 生成，**禁止手工编辑**。
> 改玩法请改 `games/beads/src/` 再重跑同步。`.meta` 只由编辑器生成（L1），脚本永不触碰。

---

## 3. 编辑器里仍需人工完成的两步

工程已创建，以下两步**只能在 GUI 里做**（L1：`.scene` 不许手编）：

1. **把 `BeadsBootstrap` 挂到 `GameRoot`**
   选中 `GameRoot` → 属性检查器 → 添加组件 → `BeadsBootstrap`
   （该脚本已在 `assets/scripts/`，编辑器导入后应出现在组件列表里）
   完成后场景应是：`Main`(Scene) → `Canvas` → `Camera` / `GameRoot`(UITransform + BeadsBootstrap)
2. **固定预览起始场景**：项目设置 → 项目数据 → **起始场景 = `Main`**
   不要留「当前场景」——留它时预览依赖"编辑器此刻开着哪个场景"，编辑器刚重启、场景未恢复时
   会报 `无法查到当前场景 JSON 数据(start_scene) = current_scene`（2026-09-14 实测复现）。

---

## 4. 检查表

```
[ ] GameRoot 已挂 BeadsBootstrap
[ ] 预览起始场景已固定为 Main
[ ] pnpm run framework:sync:check → breakout 与 beads 均报一致
[ ] pnpm run cocos:check → 报「检查 2、跳过 0」
[ ] pnpm run build:cocos:web 成功 → 浏览器/手机能玩
[ ] pnpm run build:cocos --release 成功 → pnpm run check:size 通过
[ ] 真机跑一次，记录 R1（满格 ≥1248 指令/帧）的实测帧率并回填 architecture-beads.md §8
[ ] assets/** 与其 .meta 已提交（library/ temp/ local/ profiles/ build/ .creator/ 不入库）
```
