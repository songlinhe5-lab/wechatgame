# 架构评审 TODO：微信小游戏框架能力补齐 + beads 架构优化

- **日期**：2026-10-26
- **范围**：`packages/framework`（微信平台适配）+ `games/beads`
- **性质**：提案计划（**未领号、未开工**）。执行时逐条去 `production/TASKS.md` 领 WXG-T-401+ 并回填。
- **取证方式**：全量读码 + grep 验证（铁律合规见 §4）

---

## 0. 评审结论总览

架构主体健康：core 引擎无关、`buildRenderModel` 只读快照、平台抽象边界干净
（`compose/app.ts` 是唯一知道平台的地方）、脏帧门控（dirtyGate）已实测省下
3.0–3.9ms/帧的重放开销。**铁律 L3/L4 全仓 grep 零违规**；beads 测试
106 文件 / ≈1312 用例护体，重构安全网充足。

短板集中在两处：**微信平台能力面**（对"上线运营一款小游戏"而言缺口明显，
其中两项已在游戏侧挂了 UI 却无真机实现），以及 **beads 侧 4 个巨型文件**
（编排/配置/菜单视图/壳）持续膨胀。

---

## P0 — 发布阻断级（需用户拍板后执行）

### TODO-1 激励视频 weapp Provider 缺失（真机全 Noop）
- **证据**：
  - [weapp.ts:279-282](file:///Users/stephenhe/Development/workspace/wechatgame/packages/framework/src/platform/weapp.ts#L279-L282) `createRewardedAdProvider()` 恒返回 `NoopRewardedAdProvider`（注释：待 WXG-T-058 用户确认）
  - 全仓 grep 无 `createRewardedVideoAd` 包装
  - 游戏侧闭环**已经建好并在等它**：[beads-shell.ts:455-462](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/game/beads-shell.ts#L455-L462)（0 心 → `ad.load`+`ad.show` → `onRewarded` → `grantAdHearts`）；`REWARDED_PLACEMENT` 已定义 5 个位（3 道具 + 托盘扩展 + 加心）
  - 接口契约已就位：[rewarded-ad.ts:25-38](file:///Users/stephenhe/Development/workspace/wechatgame/packages/framework/src/core/ads/rewarded-ad.ts#L25-L38)，ADR-0006 预留路径 ≈150 行
- **后果**：真机上点「看广告加心」永远无效——0 心玩家被死路卡死（体力恢复只有等待）。
- **方案**：`WeappRewardedAdProvider` 包装 `wx.createRewardedVideoAd`（load/show/close/reward 事件桥接），Mock/Noop 保留给 Node/harness；真机验收按 ADR-0006。
- **规模**：S（~150 行 + 单测）。
- **拍板**：见 D1。

### TODO-2 振动能力是空设置（有开关、无实现）
- **证据**：
  - 设置页有「震动」开关并持久化（[save-schema.ts:216](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/game/save-schema.ts#L216)、[game-settings.ts:123-127](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/game/beads-game/beads-game/game-settings.ts#L123-L127) 发 `settings:vibrate` 事件）
  - 但 [beads-game.ts:2118-2124](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/game/beads-game.ts#L2118-L2124) 注释明说「真机 vibrateShort 属平台适配层，批0 不接」
  - 框架 `Platform` 接口（[platform.ts:32-57](file:///Users/stephenhe/Development/workspace/wechatgame/packages/framework/src/platform/platform.ts#L32-L57)）无任何 haptics 能力；weapp.ts 无 `vibrateShort`
- **后果**：玩家开着震动开关，真机零效果——半成品功能上线即体验缺陷。
- **方案 A（推荐）**：`Platform` 增可选 `haptic?(kind)`；weapp 实现 `wx.vibrateShort({type})`；beads 订阅 `settings:vibrate` + 关键反馈事件（放珠/连击/结算）接线。
- **方案 B**：本版移除设置项（存档字段保留，UI 隐藏）。
- **规模**：S-M。**拍板**：见 D2。

---

## P1 — 平台能力补齐（框架新增可选能力，均不破坏 L1–L5）

### TODO-3 分享能力缺失
- **证据**：全仓 grep 无 `shareAppMessage` / `onShareAppMessage`。
- **方案**：`Platform.share`（主动）+ `onShare`（被动默认卡片，标题/图可用现成 boss 缩略烘焙图）；结算面板加「炫耀」位（属 beads 增量）。
- **规模**：M（框架 S + 游戏侧 UI 接线 S）。

### TODO-4 热更提示（UpdateManager）缺失
- **证据**：无 `getUpdateManager`。小游戏标准实践：启动检查新版本 → 提示重启。
- **方案**：weapp 平台启动期接入，经事件总线通知；UI 用现有 modal-frame 出提示条。
- **规模**：S。

### TODO-5 内存告警降档（onMemoryWarning → bake LRU 收缩）
- **证据**：bake 缓存已就位（[bake-lru.ts](file:///Users/stephenhe/Development/workspace/wechatgame/packages/framework/src/core/bake/bake-lru.ts)），但无 `onMemoryWarning` 挂接——低端机长局下 JS 堆无保护。
- **方案**：weapp `onMemoryWarning` → 事件 → bake LRU 收缩档位 + 必要时关渲染特效（`reduceMotion` 已有持久化开关可联动）。
- **规模**：S。

### TODO-6 HTTP 通道平台抽象
- **证据**：[beads-shell.ts:85-90](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/game/beads-shell.ts#L85-L90) `HttpGet` 靠宿主手工注入（注释：微信 = `wx.request` 包装——但框架没提供，正式环境微信**无全局 fetch**，当前 studio 导入通道真机不可用）。
- **方案**：`Platform.httpGet`（weapp = `wx.request` / web+node = `fetch`）；shell 的 `studio.get` 缺省腿改走平台。
- **规模**：S。

### TODO-7 帧率档 + 性能上报
- **证据**：无 `setPreferredFramesPerSecond` / `wx.getPerformance` 消费。低端机（R1 风险机型）无降帧策略与量化上报。
- **方案**：weapp 平台档位 API（60/30 切换，接 `debugInfo` 面板）+ `reportPerformance` 上报真机帧数据，为 TODO-14 提供数据腿。
- **规模**：S-M。

### TODO-8 开放数据域（好友榜）——先挂 backlog
- **证据**：无 `getOpenDataContext`。架构影响大（主域/子域 postMessage 协议 + 渲染层预留），非独立小改。
- **建议**：不排期，立项时单开 ADR。**规模**：L。
- **进展（2026-10-26 · WXG-T-418）**：已单开 [ADR-0035](../../docs/architecture/adr/ADR-0035-minigame-open-data-domain-friend-leaderboard.md)（Proposed）。结论 = **好友榜零后端**（微信托管云存储 `setUserCloudStorage` + 子域 `getFriendCloudStorage`，需 `scope.WxFriendInteraction` 授权）；**仅全服/赛季/运营榜才需后端**，触发条件见该 ADR §6。待拍板 Q1–Q4。

---

## P2 — beads 架构优化（重构，逐字节保行为）

### TODO-9 `beads-game.ts` 瘦身第三批（现 3022 行）
- **证据**：[beads-game.ts:23-37](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/game/beads-game.ts#L23-L37) 模块地图——已拆 10 个子模块，但本类仍持状态机、托盘锚裁决、解环器表现、快照投影（`_syncSnapshot`）、BOOT 装配。
- **方案**：拆 `snapshot-projector.ts`（纯投影）与 `level-boot.ts`（校验装配）；编排类只留状态机裁决 + 订阅。测试全部只绿不红。
- **规模**：M。

### TODO-10 `tuning.ts` 拆分（现 3283 行）
- **证据**：[tuning.ts:2-13](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/config/tuning.ts#L2-L13) 自述为 §3 镜像唯一真源。大文件本身不改数值，但可维护性差、review 冲突面大。
- **方案**：按域拆 `config/tuning/`（menu / solver / powerups / …）+ barrel 聚合，**对外 API 与数值逐字节不变**（`tuning.test.ts` 作金样本）；§3 冻结纪律不受影响（真源仍是 §3，落位只是文件组织）。
- **规模**：M。

### TODO-11 菜单投影从 shell 下沉（现 987 行）
- **证据**：[beads-shell.ts:899-971](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/game/beads-shell.ts#L899-L971) `_metaViewData` 每帧覆写 50+ 字段；墙表缓存（`_wallSlotsFor`）、门票闸门（`_refreshArcGate`）、走马灯投影全混在路由壳里。
- **方案**：提取 `MenuProjection` 服务对象（墙表/门票/走马灯三组缓存与投影），shell 只留路由与扣心闸门。行为零变化（`meta-menu-wall` / `arc-*` 测试护体）。
- **规模**：M。

### TODO-12 死代码清理：`spawner.ts`
- **证据**：[beads-game.ts:17-21](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/game/beads-game.ts#L17-L21) 注释明示「dead since v2.0、事件永不发」；但 [index.ts:19](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/index.ts#L19) 仍从公开 barrel 导出，且 `tray-spawner.test.ts` 在维护它。
- **方案**：至少从公开 barrel 摘除 export；是否整删（类/测试/snapshot 字段）见 D3。
- **规模**：S。

### TODO-13 事件总线类型扩展点
- **证据**：[beads-shell.ts:351](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/game/beads-shell.ts#L351)、[beads-shell.ts:976](file:///Users/stephenhe/Development/workspace/wechatgame/games/beads/src/game/beads-shell.ts#L976) 两处 `services.events as unknown as { emit }` 强转——框架 `EventMap` 是封闭类型映射，游戏自定义事件（`meta:overlay`、`settings:vibrate` 等）无法类型安全注册。
- **方案**：framework `EventMap` 开放 `declare module` 合并点（或 `App` 选项泛型）；游戏侧删强转。
- **规模**：S-M（framework 小改，全矩阵受益）。

### TODO-14 视图大文件拆分（次优先）
- **证据**：`meta-view.ts` 1604 行 / `play-page.ts` 1483 / `bead-render.ts` 1244。meta-view 本就按 overlay 分支组织，切分自然。
- **方案**：按 overlay 拆 `view/meta/`（menu / levels / settings / signin），金样本测试（`ui-golden.test.ts`）锁定像素级回归。
- **规模**：M（可与功能需求穿插做，不单开）。

---

## P3 — 性能 / 真机验证

### TODO-15 真机帧率实测（关闭 R1 风险）
- **证据**：[architecture-beads.md §8 R1](file:///Users/stephenhe/Development/workspace/wechatgame/docs/architecture/architecture-beads.md#L160-L168)——满格 900+ 指令/帧经 Cocos Graphics 重建，真机开销**从未实测**；ADR-0005 复评触发（<30fps 切图集/bake 预案）。
- **前置**：Cocos 工程创建（架构文档 §9：剩余动作仅编辑器 GUI 建工程）。
- **方案**：真机/预览版采样（配合 TODO-7 的上报腿）；不达标则启用 bake/blit 预案（架构已就位：`core/bake` + `createBlitCarrier`，`bead-render-baked.test.ts` 在测）。
- **规模**：M（含真机协调）。

### TODO-16 菜单静止帧构建短路（可选，先量化再决定）
- **证据**：[app.ts:299-314](file:///Users/stephenhe/Development/workspace/wechatgame/packages/framework/src/compose/app.ts#L299-L314) dirtyGate 只省 **draw 重放**；`buildRenderModel` + hash 每帧仍全量跑（菜单静止时 ≈146/150 帧是全构建+跳绘）。
- **方案**：`Game` 增可选 `wantsFrame()` 门（菜单无动画/无输入/无计时变化时跳过整帧构建）。**先在 harness 量化 idle 帧的 build+hash 成本**，值回票再动工；否则挂起。
- **规模**：M，收益不确定。

---

## 需用户拍板的决策点（✅ 已拍板 2026-10-26）

| # | 决策 | 选项 | 拍板 |
|---|---|---|---|
| D1 | 激励视频（TODO-1） | ① 本版实现 weapp wrapper ② MVP 继续占位 | ✅ **① 实现**（游戏闭环已在等它） |
| D2 | 振动（TODO-2） | ① 接通平台 haptics ② 移除设置项 | ✅ **① 接通** |
| D3 | spawner 死代码（TODO-12） | ① 整删（类+测试+快照字段） ② 仅摘 barrel export | 📋 **待用户再确认**（解释：整删 = M 级，跨崩溃快照协议/事件类型/tray 死路径；建议先仅摘 barrel，等 E5 批次统一清关卡 JSON） |
| D4 | 开放数据域（TODO-8） | ① backlog 挂起 ② 本里程碑立项 | ✅ **① backlog** |

## 建议执行顺序（拍板后）

1. **第一批（P0）**：TODO-1（WXG-T-402）→ TODO-2（WXG-T-403）—— framework 平台层各一小刀，beads 接线；每任务独立 commit + push。
2. **第二批（P1 发布面）**：TODO-4 → 5 → 6 → 3 → 7（均可独立交付，逐领号）。
3. **穿插（P2）**：与功能开发同迭代逐批做（TODO-9/10/11 各一个 PR；TODO-12/13 顺手批）。
4. **真机步（P3）**：Cocos 工程就绪后 TODO-15（含 TODO-16 的量化）。

> 验证纪律：每批走 `pnpm run check`（typecheck + 全量 vitest + link/tasks 机械守）；发布相关批次过 `wxgame-qa-gates` G1–G3；真机步属 G4/EP-10。

---

## 附：取证摘要（2026-10-26 读码）

- 铁律合规：`games/beads/src` grep `Math.random` / `import 'cc'` / 裸 `wx.` —— **零违规**（wx 经 shell 注入，L3/L4 全绿）。
- 测试资产：beads 106 个测试文件 / ≈1312 用例；framework 47 个测试文件。
- 平台抽象：`Platform` 接口 10 能力（clock/storage/audio/assets/screen/frame/lifecycle/log/ad/undo 语义），weapp 已实现 storage / audio(WebAudio 合成+InnerAudio BGM 回退+分包预载) / screen(胶囊+安全区) / lifecycle；**缺** haptics / share / open-data / update / memory-warning / http / fps 档。
- 渲染链：App(dirtyGate) → Cocos `Graphics` 三层（底图/BlitLayer/矢量 UI）+ Label 池；bake/blit 预案已就位未启用真机。
- 包体：主包红线 4096KB / beads 内部目标 ≤2000KB，`check:size` 机械守在；当前零贴图路线，风险主要在真机帧率而非体积。
