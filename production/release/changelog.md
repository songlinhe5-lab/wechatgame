# 变更日志（Changelog）· 《砖阵》Breakout

> 格式遵循 `version-strategy.md §6`。面向团队（内部语言）。
> 本文件记录**可追溯的版本变更**；面向玩家的补丁说明另见发布时的公告。

---

## [Unreleased]

### 新增 Added
- （待填）构建管线落地后，将登记 `build:wx` / `check:size` 相关变更。

### 已知问题 Known Issues
- 见 `[0.1.0] → 已知问题`（尚未修复，延续至今）。

---

## [0.1.0] - 2026-09-11

> **里程碑性质**：这是**首个内部里程碑（框架 + 游戏逻辑）**，**不等于"可提审发布版本"**。
> 标记 `⛔ 未就绪` 的部分说明：当前仓库尚不具备"构建出微信产物"的能力，故 `0.1.0` 是**开发里程碑**，而非可上架版本。

### 新增 Added — 共用框架（`@wxgame/framework`）
- **三层架构落地**：`core`（引擎无关）← `adapters`（引擎相关）← `platform`（宿主相关），依赖箭头单向。
- **core 层**（引擎无关）：
  - 数学：`vec2` / `geometry` / `curve` / `scalar` / `rng`
  - 状态机 `state-machine`、事件总线 `event-bus`、对象池 `object-pool`
  - 主循环 `game-loop`、游戏外壳 `game` / `app`
  - 存档 `storage` + **带版本迁移的 `save-manager`**
  - 音频 `audio`、输入 `input-manager`、渲染模型 `render-model` + `viewport`
  - 关卡配置 `level` + 注册表 `registry`、场景栈 `scene-stack`
- **adapters 层**：Canvas2D 渲染器、Cocos 渲染器、Cocos 输入桥接、Cocos 主循环桥接、Label 池、绑定层。
- **platform 层**：Node（测试）、Web（浏览器调试）、**微信小游戏 `weapp`**（`wx.*StorageSync`、`getWindowInfo`/`getSystemInfoSync` 兼容、生命周期 onHide/onShow）。
  - `wx` 全局被完全守卫：**无微信环境时不崩溃**，可在 Node 中类型检查与测试。

### 新增 Added — 游戏《砖阵》（`@wxgame/breakout`）
- **数据驱动关卡**：`src/config/levels.ts` 以字符编码网格定义关卡，含 4 种砖型（普通/2 血/3 血/不可破坏墙），每关可覆盖 `ballSpeed` / `paddleWidth`。
  - **当前已落地 6 关**（`l1-flatline` … `l6-bossboard`），难度递进：平面墙 → 2 血砖 → 门形墙 → 金字塔 → 迷宫 → Boss 阵。
  - ⚠️ 与 `concept.md §7`（规划 5 关）存在数量漂移，见下方「已知问题 K1」。
- **集中式数值**：`src/config/tuning.ts` 收拢全部玩法数值，改数值不需动系统代码（数据驱动规则）。
- **实体与系统**：球 `ball` / 挡板 `paddle`；物理 `physics`（子步进防穿模）；计分与连击 `scoring`。
- **游戏外壳**：`game/breakout-game.ts` 编排状态机；`game/state.ts`；`game/save-schema.ts` 定义版本化存档（`version: 1`）。
- **视图模型**：`view/view-model.ts` + `view/palette.ts`，供渲染层消费（玩家不可见内部状态）。
- **版本化存档**：键 `wxgame.breakout.save`，`version = 1`，含 `bestScore` / `bestCombo` / `highestLevelIndex` / `runs` / `bricksDestroyed` / `muted`；损坏/非法存档**回退默认值而非崩溃**（`validateBreakoutSave`）。

### 新增 Added — 工程与质量
- **monorepo**：pnpm workspace（`packages/*` + `games/*`），TypeScript 严格模式。
- **测试**：`vitest`，全仓 **31 个测试文件**。
  - 框架覆盖率：行 **94.45%** / 语句 94.45% / 函数 91.6% / 分支 91.59%。
  - 游戏覆盖率：行 **97.2%** / 函数 92.24% / 分支 88.29%。
- **设计资产**：概念一页纸、9 系统 GDD、UX 规格、关卡数据、美术规格与可访问性文档、设计评审。

### 存档兼容性 Save Compatibility
- **初始版本**：`version = 1`，无历史版本需迁移。
- **前向兼容**：`SaveManager` 已支持 `version → migration` 注册表；未来新增字段走迁移，不丢档。
- **降级策略**：存档 `version` 高于当前支持 / 损坏 / 非法 → **回退默认值**，不抛异常（对齐 `save-progress.md §6` 的"降级优先于报错"）。

### 已知问题 Known Issues
| # | 问题 | 影响 | 状态 |
|---|---|---|---|
| K1 | 关卡数量漂移：设计 5 关 vs 代码 6 关 | 发布范围口径不一 | ⚠️ 待 QA/ENG 裁定 |
| K2 | 砖列数 / 球半径 / 挡板宽 与 `systems-index §3` 数值不一致 | 数值真源可能失真 | ⚠️ 待裁定 |
| K3 | 存档键名/字段与 `save-progress.md` 不一致（代码 `wxgame.breakout.save` vs 文档 `bp.save.v1`） | 影响回滚兼容性结论 | ⚠️ 待裁定 |
| K4 | ⛔ 构建工具未落地：`tools/scripts/` 为空（`build:wx` / `check:size` / `harness` 已声明未实现） | **无法构建微信产物** | 未就绪 |
| K5 | ⛔ Cocos 引导脚本缺失：`cocos/assets/scripts/` 为空 | 无法在 Creator 中启动 | 未就绪 |
| K6 | ⛔ dev harness 未落地：`dev/harness/` 为空（`src/index.ts` 注释中的消费者之一） | 浏览器调试入口缺失 | 未就绪 |
| K7 | 无 git 仓库 / 无提交历史 | 变更日志无法用提交自动生成，暂为手工维护 | 环境限制 |
| K8 | 微信开发者工具未安装 | 无法真机预览 / 上传 / 提审 | 环境限制 |

### 未包含（Not Included · 本轮明确不做）
- 内购、广告、排行榜、账号、云存档、多人（`concept.md §7 Won't`）。
- 资源热更新通道（`version-strategy.md §5`：无远程资源、无服务端 → 不建）。
- 音频资产（阮和鸣范围，demo 阶段空）。
- 图片资产（全程序化绘制，美术位图 0 KB）。

### 备注 Notes
- 本次**未使用 git 提交**（用户要求）。K7 记录此限制。
- 版本号 `0.1.0` 取自 `package.json`，为 `0.x` 开发里程碑，未达正式稳定版。

---

## 变更记录（本文件）

| 版本 | 日期 | 变更 | 作者 |
|---|---|---|---|
| v1.0 | 2026-09-11 | 建立 changelog；登记首个里程碑 `0.1.0` | 路远行 |
