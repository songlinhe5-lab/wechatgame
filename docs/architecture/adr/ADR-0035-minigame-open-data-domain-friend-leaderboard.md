# ADR-0035 · 好友排行榜走微信开放数据域（零后端），主域/子域协议与渲染预留

- **状态**：**Proposed（Q2 授权时机 / Q3 协议形状已拍板 2026-10-26；Q1 指标重开待拍（星榜饱和被用户否决）；Q4 渲染预留待拍。⛔ 本批零落码，纯提案）**
- **日期**：2026-10-26
- **任务号**：WXG-T-418（架构评审提案 `production/plans/2026-10-26-arch-review-weapp-framework-and-beads.md` **TODO-8** 立项）
- **负责域**：工程负责人（protocol 形状 / Platform 接口 / 渲染预留 / 分包与包体）；**「榜什么指标」= 文策渊**（本文 ⛔ 不代定玩家可见规则，见 Q1）
- **权威来源（冲突以左列为准）**：`games/beads/design/gdd/systems-index.md` §3（本文 ⛔ 零数值改动）＞ `docs/architecture/control-manifest.md` ＞ 微信官方文档（见 §1.3 逐条链接）＞ `production/plans/2026-10-26-arch-review-weapp-framework-and-beads.md` TODO-8
- **判例链**：K-035（无规格不落码）/ K-046（领号）/ K-111（`build:cocos` 默认 release 基线档）/ K-179 ③（待拍板项由主理人落地）
- **关联**：ADR-0006（激励视频先 ADR 后落码的同一节奏）、ADR-0002/0003（引擎解耦 / 代码驱动）、ADR-0032（beads UI 架构）

---

## 0. 一句话结论（回答「要不要后端」）

**好友排行榜不需要自建后端**。微信为小游戏提供**开放数据域**（Open Data Context）：主域 `wx.setUserCloudStorage()` 把玩家成绩写进微信托管的云存储，子域 `wx.getFriendCloudStorage()` 读回**同玩好友**的成绩，再由子域 Canvas 画榜。全流程零服务器、零账号体系、零防作弊投入。

**只有「全服榜 / 赛季榜 / 跨好友圈榜 / 运营后台可查」才需要后端**——那是另一个产品（P2 提案，本文 §6 给了触发条件与能力清单）。

⇒ 按用户 2026-10-26 指令「不需要后端就完成数据域提案」，本文即为**数据域提案**，而非后端提案。

## 1. 上下文（Context）

### 1.1 现状取证（本会话实跑，非引用）

| # | 事实 | 取证位置 |
|---|---|---|
| F1 | 全仓无 `getOpenDataContext` / 无 `openDataContext` 配置 / 无 `sharedCanvas` 消费 | 全树 grep 零命中 |
| F2 | `Platform` 接口当前能力面 = clock / storage / audio / assets / screen / frame / lifecycle / log + WXG-T-405/408/410/411/414 新增的 share / update / memory / http / perf | `packages/framework/src/platform/platform.ts` |
| F3 | beads 渲染为自绘 blit（非 Cocos Sprite 直出） | ADR-0026 / ADR-0030 / ADR-0031 |
| F4 | `game.json` 当前**无** `openDataContext` 字段 | `games/*/cocos` 与构建产物配置 |

### 1.2 提案原判

TODO-8 原文：**「先挂 backlog。证据：无 `getOpenDataContext`。架构影响大（主域/子域 postMessage 协议 + 渲染层预留），非独立小改。建议：不排期，立项时单开 ADR。规模：L。」** 本文即该 ADR，保持「先定协议形状、再落码」的节奏（与 ADR-0006 同构）。

### 1.3 微信侧能力与硬限制（外部事实）

| # | 事实 | 影响 |
|---|---|---|
| W1 | **数据托管**：`wx.setUserCloudStorage({ KVDataList })`（**主域**调用，基础库 1.9.9+）写入微信云存储 | 零后端存储 |
| W2 | **好友读取**：`wx.getFriendCloudStorage({ keyList })` **仅在开放数据域可用**，返回同玩好友托管数据 | 零后端查询 |
| W3 | **新增授权门槛**：`getFriendCloudStorage` **需用户授权 `scope.WxFriendInteraction`** | 必须先做授权引导（Q2） |
| W4 | **容量上限**：每 openid 每游戏 **≤128 个 KV 对**；每项 `key + value` **≤1KB**；`key` **≤128 字节** | 榜单只需 1–3 个 key，余量充足 |
| W5 | **子域受限**：开放数据域**只能**用 canvas / 触摸 / 定时器（`setTimeout`、`setInterval`、`requestAnimationFrame`）/ `wx.getSystemInfo*` 等极少 API，**不能**跑 Cocos、不能 import 主域框架代码 | 子域必须**独立极简渲染**，不能复用 beads 渲染栈 |
| W6 | **接入方式**：`game.json` 增 `openDataContext: "<子域目录>"`；主域 `wx.getOpenDataContext()` 拿子域上下文，`postMessage` 单向发消息，子域 `onMessage` 收 | 需要协议层（§3） |
| W7 | **呈现方式**：子域把内容画到 `sharedCanvas`，主域把该 canvas 当**纹理**贴到自己的画布上 | 渲染预留的难点所在（§3.3 方案对比） |
| W8 | **新好友延迟**：加好友后 2 小时内可能取不到该好友数据 | 文案需容忍（不承诺「立刻可见」） |
| W9 | **仅好友维度**：开放数据域拿不到全服 / 陌生人数据 | 全服榜 = 后端（§6） |

### 1.4 与既有平台的差异

TODO-3~7 的五件全是「Platform 加一个可选方法 + 三端实现 + beads 接线」的 **S 级**切法。开放数据域**不满足**这个形状：它引入**第二个 JS 运行时**（子域）、**跨域消息协议**、**跨画布纹理通道**，且子域代码不能用主域框架。因此本文不套用「加个方法就完事」的模板。

## 2. 备选方案（Alternatives）

### 方案 A：全走微信开放数据域（**推荐**，零后端）

- 内容：主域记成绩 → `setUserCloudStorage` → 面板打开时 `postMessage({type:'rank:query'})` → 子域 `getFriendCloudStorage` 排序 → 子域画 `sharedCanvas` → 主域贴纹理。
- 覆盖：好友榜（同玩好友范围）。
- 代价：需授权引导；榜单视觉只能子域自绘（与 beads 美术风格需手工对齐）；真机才能验证（§5 验证纪律）。
- 体量：**L**（协议 + 子域渲染器 + 平台适配 + 面板接入 + 授权流程）。

### 方案 B：自建后端榜单

- 内容：登录态（openid/unionid）→ 成绩上报 → 服务端排序/分页 → 拉取 TOP N。
- 覆盖：全服 / 赛季 / 分段 / 运营可查。
- 代价：账号体系、防作弊（成绩校验）、存储、CDN、运营后台、合规（隐私政策）+ **当前无服务器/无域名/无资质**（AGENTS.md §1 已知限制：缺 AppID + 密钥，上传都未通）。
- 体量：**XL**，且**不是本里程碑能消化的**。

### 方案 C：先 A 后 B（混合分期）

- 内容：MVP 只做好友榜（A）；后端榜单待商业化/运营需求成立时另行立项。
- 与 A 的差别只是**接口预留**：`Platform` 暴露的是「榜单 provider」抽象，未来 B 可另实现一个 provider 而不动游戏侧。
- 代价：为一个尚未存在的需求做抽象（YAGNI 风险）。

## 3. 决定（Decision，推荐档 + 待拍板项）

**推荐 = 方案 A（MVP 好友榜零后端），并按方案 C 的精神只做「一层薄预留」**：

1. **不碰后端**：本里程碑零服务器、零账号体系、零成绩校验（微信托管数据本身不可被玩家伪造成他人成绩——写的是自己那份）。
2. **协议先行**：主域 ⇄ 子域消息形状定死在 core 层（`OpenDataMessage` 判别联合），主域只发、子域只收，**不做双向 RPC**（W6 的 `postMessage` 本身就是单向）。
3. **平台能力按 ADR-0006 范式落位**：`core/opendata/`（协议类型 + Noop/Mock provider）↔ `platform/opendata-weapp.ts`（真实现）；`Platform.createOpenDataProvider?()` 可选（Node/Web = Noop/Mock，与激励视频一致），**绝不**让 `core` 反向 import `platform`（WXG-T-406 教训）。
4. **渲染走「纹理通道」**：主域只认「一张可贴图的 canvas 纹理」，不认子域内部结构；beads 侧留一个**榜单面板占位**（先空面板 + "好友榜即将开放"，后接纹理）。
5. **子域代码独立**：单列 `opendata/` 子目录（独立 tsconfig、独立构建产物、**禁止** import 主域框架/beads 代码），满足 W5。

### 3.1 协议形状（**Q3 已拍板 2026-10-26：采纳本形状**）

```ts
// 主域 → 子域
type HostToOpenData =
  // 握手：子域独立打包，热更后可能与主域版本错位 ⇒ 必须带版本；主题随握手下发
  | { type: 'init'; version: 1; theme: OpenDataTheme; board: RankBoard }
  | { type: 'rank:query'; board: RankBoard; key: string; order: 'asc' | 'desc'; limit: number }
  | { type: 'rank:refresh'; board: RankBoard }
  | { type: 'render:resize'; width: number; height: number; dpr: number }
  | { type: 'render:visible'; visible: boolean };   // 面板开合 ⇒ 子域可停帧（省电）

// 子域 → 主域（只回状态，不回传成绩明细，隐私面最小）
type OpenDataToHost =
  | { type: 'ready'; version: 1 }                    // 握手回执，版本不符主域走降级
  | { type: 'rank:ready'; board: RankBoard; count: number }
  | { type: 'rank:error'; board: RankBoard; code: 'no-auth' | 'empty' | 'api-missing' | 'fail' };
```

```ts
type RankBoard = 'stars' | 'sprint';   // 本期只启用 'stars'；'sprint' 预留（冲刺落码后开）
type OpenDataTheme = {
  bg: string; rowBg: string; rowBgSelf: string;
  text: string; accent: string;
  avatarSize: number; rowH: number; fontPx: number;
};  // 值源 = src/view/palette.ts（主域取，随 init 下发；子域不 import）
```

四条设计约束（逐条对应外部限制，不是加戏）：

1. **`version` 必备**：子域是**独立工程/独立产物**（W3），热更可能只更新主域 ⇒ 版本错位时主域必须走「敬请期待」降级而非崩溃。
2. **`theme` 随 `init` 下发**：子域**不能** import `src/view/palette.ts`（W3），颜色/字号只能靠消息传，否则美术双轨必然跑偏（§4.2）。
3. **`render:visible`**：面板不开时子域停 `requestAnimationFrame`，否则白烧帧与电。
4. **不回传明细**：好友昵称/头像/分数一律不过界，主域只拿「有没有数据、几条」⇒ 隐私面最小，也避免主域二次真源。

**「我在榜上高亮」怎么定**：⛔ 不用 `viewerUid`——主域无后端拿不到 openid（`wx.login` 只给 code）。子域内用 `wx.getUserInfo()` 的昵称+头像与好友条目匹配即可（同 `wx.getFriendCloudStorage` 返回项自带 nickname/avatarUrl）。

### 3.2 榜单指标（**Q1 重开：2026-10-26 用户复核后撤回「单榜总星数」裁定，待重拍**）

**撤回理由（用户当场指出）**：总星数上限 = 总关数 × 3，全通关即全员并列 ⇒ 静态、零重刷动力，不适合排名，只适合「进度徽章」。

**⛔ 纠错（本 ADR 上一版的事实错误）**：上一版称「冲刺模式未落码、主榜无数据源」——**错**。取证：`games/beads/src/systems/sprint.ts`、`sprint-settle.ts` 均在，`sprint:ended` 在 `beads-game.ts` 发射，`sprintBestScore` / `sprintBestStage` 已持久化于 `save-schema.ts` v5（S8 v1.1 字段）。**MF4 主榜数据源已就绪**。

三条候选的数据就绪度（实测）：

| 候选 | 计算/字段 | 就绪度 | 饱和性 | 玩家可见性 |
|---|---|---|---|---|
| **冲刺最佳分**（MF4 主榜） | `sprintBestScore`（save v5） | ✅ **零新增** | 低（跑分无上限） | ✅ 冲刺结算面板已显示 score / bestStage / bestStreak，破纪录有角标 |
| **品质分**（`SETTLE_SCORE`） | `normalSettleScore()` 已在 `tuning.ts`；通关帧 `beads-game.ts` 算 `_lastSettleScore`（`stars/ratio/powerupsUsed/expandUsed` 四因子当帧全可得） | ⚠ 计算现成、**未持久化**（save v5 无该字段）⇒ 需加 `settleBestByUid` + 存档 bump v6 | 低（`ratio` 连续） | ❌ **三处都不显示**（局内不显示是既有条款；结算面板只画星级总览与「共 N/M ★」；关卡页只画星） |
| 总星数（MF4 副榜） | `starsByUid`（save v5） | ✅ 零新增 | **高（硬顶并列）** | ✅ 关卡页与结算页均显示 |

公式（已冻结 + 已实现）：

```
SETTLE_SCORE = stars×1000 + round(ratio×1000) − powerupsUsed×50 + (未用扩展 ? 200 : 0)
```

权重常量已在 `tuning.ts`：`SETTLE_STAR_WEIGHT=1000` / `SETTLE_RATIO_SCALE=1000` / `SETTLE_POWERUP_PENALTY=50` / `SETTLE_NO_EXPAND_BONUS=200`。区间 0–4200。

**待重拍（用户）**：

| 选项 | 内容 | 代价 |
|---|---|---|
| A | 双榜：冲刺最佳分（主）+ 品质分 Σ 各关最佳（副） | 需 save v6 + **普通关结算面板补一行「品质分」**（否则榜上数字无出处） |
| B | 单榜：品质分 Σ 各关最佳 | 同上，且冲刺玩法不上榜 |
| C | MF4 原双榜：冲刺最佳分 + 总星数 | 零新增、零 UI 改动，但副榜饱和 |
| D | 双榜：冲刺最佳分 + 单关最省步数达成率 | 需新增运行时步数计数器（`state` 现无步数）+ 关卡最优步数入库 |

⛔ 已否决：单关最少步数（跨关不可比）、已通关数（与星数高相关）、金币/皮肤数（可购买 ⇒ 氪金榜）。

### 3.3 渲染预留的三条路（**Q4，归工程**）

| 路 | 做法 | 风险 |
|---|---|---|
| R1 | 主域把 `sharedCanvas` 每帧贴成纹理（WebGL `texImage2D`） | 每帧上传有带宽成本；Cocos 侧需自管 `Texture2D`（ADR-0030 已有 blit 载体经验可复用） |
| R2 | 只在面板打开时贴一次 + 变更时重贴 | 省带宽；需 `rank:ready` 触发重贴（协议已留） |
| R3 | 子域 `requestAnimationFrame` 自绘，主域**不**中转，直接把子域 canvas 作为独立 DOM canvas 覆盖层 | **不可行**：小游戏无 DOM 覆盖层 |

⇒ 推荐 **R2**（打开贴一次 + `rank:ready` 时重贴），成本最低且与 §3.1 协议天然契合。

### 3.4 授权与降级路径（**Q2 已拍板 2026-10-26：首次打开榜单时弹**）

**裁定：只在「玩家主动点开好友榜」这一刻请求授权；通关后不弹。**

理由：
1. **合规**：微信要求授权须由用户可感知的行为触发，禁止无预期弹窗与强制授权；点开榜 = 唯一意图明确时刻。
2. **转化**：此刻用户就是想看好友数据，授权理由自明；通关瞬间属情绪峰值但**没有看榜意图**，弹窗突兀且易被拒。
3. **可拒绝**：拒绝后不得反复打扰，须给可回流入口。

落地流程（S-3 实现）：

| 步 | 行为 |
|---|---|
| 1 | 榜单入口常驻（结算面板「炫耀一下」旁 / 主菜单），未授权时**不**弹任何东西 |
| 2 | 玩家点击 → 面板先出**说明页**（「好友榜需要读取同玩好友成绩」）→ 按钮触发 `wx.authorize({scope:'scope.WxFriendInteraction'})` |
| 3 | 授权通过 → `postMessage({type:'rank:query'})` → 子域读数据画榜 → `rank:ready` 贴纹理 |
| 4 | 授权拒绝 → 面板显示**空态**「未授权，无法显示好友榜」+「去设置开启」按钮（`wx.openSetting()` 回流）；本次会话**不再弹** |
| 5 | 好友数据为空（新号 / 好友未玩过）→ 空态「还没有好友上榜，去邀请一位」，不报错（协议 `rank:error: empty`） |
| 6 | 面板再次打开 → 不缓存授权结果断言，每次进入重查 `wx.getSetting` 的 `scope.WxFriendInteraction` 真值 |

## 4. 后果（Consequences）

### 4.1 正面

- **零后端成本**：无服务器、无域名、无备案、无防作弊；与 AGENTS.md §1「缺 AppID + 密钥」的现状**不冲突**（不需要先解决上传资质就能开发与 harness 验证协议）。
- **隐私合规最省**：好友数据不出微信域（子域内闭环），主域拿不到好友明细，降低隐私风险面。
- **包体可控**：子域代码极简（数百行），远低于主包 4MB 红线。

### 4.2 负面（如实记录）

- **真机才可终验**：`sharedCanvas` 纹理、授权弹窗、好友数据均为真机行为；无真机前只能验证**协议 + Mock**，不能宣布「榜单可用」。
- **新增授权面**：`scope.WxFriendInteraction` 属用户授权，拒绝率高时榜单面板会是空的——必须有「未授权」降级文案（协议已留 `no-auth`）。
- **美术双轨**：子域不能复用 beads 渲染栈（W5），榜单视觉要么手工对齐风格、要么接受「微信原生风」。
- **好友规模小**：新号好友少 → 榜可能只有 1–2 人，需产品侧文案兜底（W8/W9）。

### 4.3 中性 / 待观察

- 工作量级：协议层 + provider + 子域渲染器 + 面板接入 + 授权引导 ≈ **L**（与提案原判一致），**必须分片落地**（见 §5.2）。
- 分包：子域是否需要独立分包、是否计入 20MB 总和——按平台规则后续核对。

## 5. 落码分期与验证纪律（ADR 批准后才执行）

### 5.1 不做的（本 ADR 范围外）

- ⛔ 后端榜单（§6 触发条件未成立）
- ⛔ 群排行榜（`getGroupCloudStorage` + shareTicket 链路，另案）
- ⛔ 任何「全服 TOP100」类需求

### 5.2 分片（建议顺序，需主理人另发落码单）

| 片 | 内容 | 可验证性 |
|---|---|---|
| S-1 | `core/opendata/`：协议判别联合 + `NoopOpenDataProvider` + `MockOpenDataProvider`（harness 可跑） | ✅ 纯 Node 单测 |
| S-2 | `Platform.createOpenDataProvider?()` + `GameServices.openData?` 透传 | ✅ 单测 |
| S-3 | beads 榜单面板占位（路由 + 空态文案 + 未授权态） | ✅ harness 截图 |
| S-4 | `opendata/` 子域骨架（独立 tsconfig，`onMessage` 收协议，Mock 数据自绘） | ✅ 子域单测（纯函数化排序/布局） |
| S-5 | weapp 真实现：`getOpenDataContext` + `setUserCloudStorage` + `sharedCanvas` 纹理贴图 + 授权引导 | ❌ **仅真机**（EP-10） |

**上报点（Q1 落地口径）**：普通关**通关结算帧**写一次 `wx.setUserCloudStorage({ KVDataList: [{ key: 'beads_total_stars', value: String(总星数) }] })`——值取 `starsByUid` 求和；失败静默（不阻断结算）。冲刺榜待冲刺模式落码后再补 `beads_sprint_best`。

### 5.3 验证纪律

- S-1~S-4 必过：`typecheck` + framework/beads 全量测试 + `pnpm run framework:sync` + harness 视觉。
- S-5 在无真机环境**只能交付代码 + 明确标注「未真机验证」**，⛔ 不得写入「已完成可用」。

## 6. 复评触发条件（何时才需要 P2 后端提案）

任一成立即单开后端提案（P2）：

1. 产品要求**全服 / 赛季 / 分段**榜，或「非好友也能比」。
2. 需要**运营后台**查数据、发奖、做活动。
3. 需要**防作弊**（微信托管数据只保证「自己写自己那份」，不校验真实性——改包即可刷高）。
4. 需要**跨游戏/跨端**成绩聚合。
5. 好友榜因授权拒绝率过高而实际不可用，需要无授权也能展示的榜单。

后端提案能力清单（届时展开）：账号体系（openid/unionid 登录）、成绩上报与校验、存储与排序、分页拉取、运营后台、隐私合规与域名备案。

## 7. 待拍板（Q1–Q4）

| # | 问题 | 归属 | 推荐 |
|---|---|---|---|
| Q1 | 榜单指标 | 文策渊 | ⏸ **重开待拍**（2026-10-26 用户复核：星榜饱和无意义 ⇒ 撤回原裁定）。候选 A 冲刺分+品质分 / B 品质分单榜 / C MF4 原双榜（星）/ D 冲刺分+步数达成率，见 §3.2 |
| Q2 | 授权时机 | 产品 + 工程 | ✅ **已拍板 2026-10-26：首次打开榜单时弹**（通关后不弹；拒绝后空态 + `wx.openSetting` 回流，详见 §3.4） |
| Q3 | 协议形状是否采纳 §3.1 | 工程 | ✅ **已拍板 2026-10-26：采纳**（单向 + `version` 握手 + `theme` 下发 + `render:visible`；不回传明细） |
| Q4 | 渲染预留选 R1 / R2 / R3 | 工程 | **R2**（打开贴一次 + `rank:ready` 重贴） |

## 8. 与提案批次的衔接

- 架构评审 P1 批次（TODO-3~7）已全部落地：WXG-T-405 / 408 / 410 / 411 / 414。
- TODO-8 由「backlog」升级为**本 ADR（Proposed）**：结论 = **好友榜零后端**，本里程碑不写后端。
- 后续：Q1–Q4 拍板 → 主理人发落码单（S-1 起）→ 按 §5.3 验证纪律推进。
