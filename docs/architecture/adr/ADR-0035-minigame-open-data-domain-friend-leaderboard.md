# ADR-0035 · 好友排行榜走微信开放数据域（零后端），主域/子域协议与渲染预留

- **状态**：**Proposed（Q1 指标 = B 品质分榜（分关 + 总榜）/ Q2 授权时机 / Q3 协议形状 已拍板 2026-10-26；**冲刺榜 = 二期需求**（用户 2026-10-26 追裁「冲刺模式作为二期需求，先上普通模式」，登 WXG-T-422）；Q4 渲染预留待拍。S-1 前置三件 ① 存档字段 + ② 结算面板品质分行 **已落码**（WXG-T-421，save v6），③ 榜单说明行随 S-4 子域 UI；⛔ 子域 / 排行榜代码本阶段仍未落，见 §3.2.1）**
- **日期**：2026-10-26
- **任务号**：WXG-T-418（架构评审提案 `production/plans/2026-10-26-arch-review-weapp-framework-and-beads.md` **TODO-8** 立项）；§3.2.1 ① ② 落码 = **WXG-T-421**（save v6 + 结算面板品质分行）
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
type RankBoard = 'settle' | 'settle-total' | 'sprint';
// Q1=B：本期启用 'settle'（`key` = 关卡 uid）+ 'settle-total'（总榜，Σ 各关历史最佳，无需额外 KV）；
// 'sprint' 预留（入口复建后再开）
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

### 3.2 榜单指标（**Q1 已拍板 2026-10-26：选 B = 品质分榜，口径 = 分关 + 总榜**）

**裁定**：榜 = **品质分（`SETTLE_SCORE`）**，**主榜为分关榜**（选中关卡后看好友在该关的历史最佳品质分）；**另加总榜**（Σ 各关历史最佳，未通关关计 0）。两榜共用同一份 KV，**总榜不额外存储**（子域对 `settleBestByUid` 各字段求和即可）。冲刺分**本期不上榜，定为二期需求**（用户 2026-10-26 追裁：「冲刺模式作为二期需求，先上普通模式」⇒ 一期只上普通模式的分关榜 + 总榜，冲刺榜见 WXG-T-422）。

**总榜可比性口径**：Σ 只在**同一关集**内可比——现池关数取 `DEMO_LEVEL_COUNT`（现值 9），换盘 / 扩容后需按新关集重算（旧分不折算）。总榜是「覆盖广度 × 单关质量」的合成，分关榜是「单关极限」，两者并列展示、榜单页默认停在**分关榜**。

**为什么不是冲刺分**：冲刺是完整可玩的独立模式（`mode:'sprint'`，120s 无尽梯、图案池循环、连击 ×2/×3/×5、每梯 `+200+50×梯`），但 **U1 三处入口当前全部隐藏**（WXG-T-177，用户 2026-09-19「去冲刺按钮先隐藏」：过关面板只剩「下一关」、通关画面不产冲刺钮、暂停面板左格换成「性能信息」）⇒ 玩家**没有任何路径进入冲刺**。榜上线时若指标指向进不去的模式，不成立。恢复冲刺入口属产品决策，另案；**用户 2026-10-26 已定「冲刺模式 = 二期需求」⇒ 一期只上普通模式**，二期恢复入口后再按 MF4 补第二榜（WXG-T-422）。

**为什么不是总星数**：上限 = 总关数 × 3，全通关即全员并列 ⇒ 静态、零重刷动力（用户当场否决）。

**公式（已冻结 + 已实现）**：

```
SETTLE_SCORE = stars×1000 + round(ratio×1000) − powerupsUsed×50 + (未用扩展 ? 200 : 0)
```

`ratio` = 剩余时间 / 总时长（[tuning.ts](../../../games/beads/src/config/tuning.ts) L1102），即「快慢」连续分量；权重常量 `SETTLE_STAR_WEIGHT=1000` / `SETTLE_RATIO_SCALE=1000` / `SETTLE_POWERUP_PENALTY=50` / `SETTLE_NO_EXPAND_BONUS=200`，区间 **0–4200**。四因子在通关帧全部可得（`beads-game.ts` `_lastSettleScore`），但**当前只写内存**。

#### 3.2.1 S-1 前置三件（用户 2026-10-26 指定）

| # | 事项 | 具体口径 | 现状 |
|---|---|---|---|
| ① | **存档新增字段** | `settleBestByUid: Record<string, number>`（逐关历史最佳品质分，键 = 关卡身份 token，与 `starsByLevel` 同族）；存档 **v5 → v6**，旧档默认 `{}`；通关帧 `Math.max` 写入并持久化 | ✅ **已落码（WXG-T-421）**：`save-schema.ts` v6 + `migrateV5ToV6`；**稀疏账**（0 = 无记录）；`SETTLE_SCORE_MAX` 派生的钳制上界；`beads-game.ts` 通关帧 `Math.max` + `_persistProgress` 落盘 |
| ② | **结算面板加一行** | 普通关 `LEVEL_CLEAR` 面板显示「品质分 N · 最佳 M」。⚠️ `PANEL_SIZE` = 560×480 为 `ux-spec §3.4` 冻结且被结算/失败/通关面板共用 ⇒ **落位需 UI 拍板**（新增行会挤压既有 5 行；候选：面板仅结算加高 / 并入发豆行 / 用面板顶部留白），⛔ 不擅自改共享 `PANEL_SIZE` | ✅ **已落码（WXG-T-421）**：落位 = **面板顶部得分条**（缎带上方空带 `clear-panel.ts::qualityY`），`PANEL_SIZE` 零改动、既有六行零挤压；串 = `品质分 N`，历史更高时附 ` · 最佳 M`；`ux-spec §3.4` v1.27；金样本 `clear` 态 620 → 621 |
| ③ | **说明榜单上的数值** | 子域榜单顶部固定说明行：「品质分 = 星级×1000 + 剩余时间×1000 − 道具×50 + 未扩容200（满分 4200）」+ 副行「同关历史最佳」；总榜副行「Σ 各关历史最佳」。文案随协议 `theme` 下发（子域不 import 主域文案），主域结算页用同一句 → 玩家在榜上看到的数字**能在结算页对上** | ⏳ **待 S-4 子域 UI 落码**（文案口径已定；主域结算页 `品质分 N` 与榜值同源 = `settleBestByUid`） |

**候选就绪度（保留，供回溯）**：

| 候选 | 数据源 | 就绪度 | 饱和性 | 结论 |
|---|---|---|---|---|
| 冲刺最佳分 | `sprintBestScore`（save v5） | 零新增 | 低 | 代码就绪，但**入口隐藏** ⇒ **二期用**（用户 2026-10-26 定为二期需求） |
| **品质分 B（选中）** | `normalSettleScore()` 现成；需 ① 持久化 | ① + ② + ③ | 低（ratio 连续） | ✅ 本期单榜 |
| 总星数 | `starsByUid`（save v5） | 零新增 | 高（硬顶并列） | ❌ 已否决 |

⛔ 已否决：单关最少步数（跨关不可比，且运行时无步数计数）、已通关数（与星数高相关）、金币/皮肤数（可购买 ⇒ 氪金榜）、单关最短时间（三档时钟制下跨关不可比）。

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

**上报点（Q1=B 落地口径）**：普通关**通关结算帧**写一次 `wx.setUserCloudStorage({ KVDataList: [{ key: 'beads_settle', value: JSON.stringify({ v: 1, best: settleBestByUid }) }] })`。逐关最佳打包进**一个** KV（现池关数 × ~12 字节，远低于 1KB / 128 KV 上限）⇒ 子域按 `key = 关卡 uid` 取字段排序；失败静默（不阻断结算）。

**总榜（`settle-total`）不另存**：子域对同一 KV 的 `settleBestByUid` 各字段求和得到 Σ（未通关关 = 0）⇒ 零额外 KV、零额外上报。冲刺榜 `beads_sprint_best` **二期再补**（用户 2026-10-26 裁定；前置 = 冲刺入口复建，WXG-T-422）。

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
| Q1 | 榜单指标 | 文策渊 | ✅ **已拍板 2026-10-26：B = 品质分榜，口径 = 分关榜 + 总榜（Σ 各关历史最佳）**（总星数已否决）。**冲刺榜 = 二期需求**（同日追裁「先上普通模式」⇒ 一期不排；WXG-T-422）。S-1 前置三件 ①② 已落码（WXG-T-421）、③ 随 S-4，见 §3.2.1 |
| Q2 | 授权时机 | 产品 + 工程 | ✅ **已拍板 2026-10-26：首次打开榜单时弹**（通关后不弹；拒绝后空态 + `wx.openSetting` 回流，详见 §3.4） |
| Q3 | 协议形状是否采纳 §3.1 | 工程 | ✅ **已拍板 2026-10-26：采纳**（单向 + `version` 握手 + `theme` 下发 + `render:visible`；不回传明细） |
| Q4 | 渲染预留选 R1 / R2 / R3 | 工程 | **R2**（打开贴一次 + `rank:ready` 重贴） |

## 8. 与提案批次的衔接

- 架构评审 P1 批次（TODO-3~7）已全部落地：WXG-T-405 / 408 / 410 / 411 / 414。
- TODO-8 由「backlog」升级为**本 ADR（Proposed）**：结论 = **好友榜零后端**，本里程碑不写后端。
- 后续：Q1=B（分关 + 总榜）已定 + Q2/Q3 已拍 + §3.2.1 ① ② **已落码**（WXG-T-421：save v6 / 结算面板品质分行）→ 待 Q4 拍板 → 主理人发 S-1 落码单（协议 + Provider）→ S-3/S-4 补 ③ 榜单说明行 → 按 §5.3 验证纪律推进。**二期**（不在一期范围）= 冲刺模式恢复 + 冲刺榜（WXG-T-422）。
