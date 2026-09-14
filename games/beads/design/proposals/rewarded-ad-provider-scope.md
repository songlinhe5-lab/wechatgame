# 工程提案 · RewardedAdProvider 落地范围（失败页续时）· beads

- 项目：`games/beads` · 版本 **v0.1（全文未冻结）** · 任务号 WXG-T-057（P0，与文策渊广告产品方案并行）
- 性质：**proposal**，非冻结 GDD / 非 ADR 落盘——供用户批「文策渊方案 + 本范围」后再实现
- 本轮纪律：**不写** `packages/framework` 源码、**不调用** `wx.createRewardedVideoAd`、**不伪造**广告 API、**不 commit**
- 数值纪律：不发明 §3 未冻结续时常量；星级走 T-054 已登记的 `starRemaining` / `reviveBonusSec` / `revived`（§3.7 `[T-B / 待确认]`）
- 前置：D-04 回前台不解暂停已落地；S6 道具未实现；无真机可测广告
- **状态（2026-09-14）**：F1+F2+B1 已合入（WXG-T-058）。weapp 仍 Noop。W1 禁止合入直至用户明示批准 `wx.createRewardedVideoAd`。

---

## 0. 结论（给拍板用）

| 问题 | 结论 |
|---|---|
| ADR-0006 接口是否够「失败页续时」 | **够用**。`load / show / onClose / onRewarded / onError` 能表达「看完才发奖、未看完 / 加载失败不发奖」。需在 ADR-0006 上做**补记**（WeChat `onClose.isEnded` 映射、placement 增主位、hide/show 竞态），**不新开 ADR 号** |
| S1 六状态 | **不改冻结六状态**。广告期间留在 `GAME_OVER`；看完 → `remaining += N` → 已有边 `game-over → playing`。禁止第七态 |
| 倒计时 / 供料冻结 | **已满足**：只有 `playing.onUpdate` 走 `_stepPlaying`；`GAME_OVER` 表已停、不供料 |
| 是否依赖 S6 | **不必要**。失败页续时是独立 placement；S6 三道具 + 扩展位可后挂同一 Provider |
| 工作量（不含真机） | 接口 + Mock + beads 续时约 **2–3 人日**；weapp 真包装 **+0.5 人日且须用户批拉起后才写**；真机联调 `[Blocked]` |
| 新 ADR | **不新建** `docs/architecture/adr/`。ADR-0008 已预约每日挑战；局内快照提案已建议 ADR-0011。本决策 = ADR-0006 复评触发命中后的补记 |

---

## 1. 对 ADR-0006 的补充范围

### 1.1 既有决定（不推翻）

ADR-0006 选 **方案 A（MVP 角标占位）+ 预埋方案 B 接口形状**：

- `RewardedAdProvider`：`load(placement) / show() / onClose(cb) / onRewarded(cb) / onError(cb)`
- `MockRewardedAdProvider` 供 Node / harness
- weapp 实现包 `wx.createRewardedVideoAd`
- **接口落地须主理人批准**；本轮仍禁止改框架

读码复核（2026-09-14，与 ADR-0006 一致）：`packages/framework/src/platform/platform.ts` 仍无广告能力；`weapp.ts` 的 `WxApi` 未声明 `createRewardedVideoAd`；全仓无广告实现。`architecture.md` §7 预留「广告走 `platform/weapp`、与玩法隔离」仍然正确。

### 1.2 失败页续时对接口的需求映射

产品主位预计改为「失败页续时」（文策渊并行）。工程侧把发奖条件锁死为：

| 玩家行为 | Provider 回调 | 游戏发奖 |
|---|---|---|
| 看完（WeChat `onClose` 且 `isEnded === true`） | **先** `onRewarded`（每 `show` 至多 1 次）**再** `onClose({ reason: 'completed' })` | `remaining += N`，`GAME_OVER → PLAYING` |
| 中途关闭（`isEnded === false` / 缺字段当 false） | 只 `onClose({ reason: 'skipped' })`，**永不** `onRewarded` | 留在 `GAME_OVER`，`remaining` 仍为 0 |
| `load` / `show` 失败、无填充、无广告组件 | `onError`，不 `onRewarded` | 留在 `GAME_OVER`；按钮可再试或降级为仅「重试」 |
| `show` 前尚未 `load` 成功 | `show` 拒绝 → `onError` | 不发奖 |

微信基础库**没有**独立 `onRewarded`；它是对 `RewardedVideoAd.onClose(res)` 的封装。ADR-0006 拆成两个回调是对的，但必须写明合成规则，避免游戏侧把 `onClose` 也当成发奖。

**结论：形状够用。** 失败页不需要插屏/banner，不升级为通用 `AdsProvider`（ADR-0006 §5 第三条复评仍有效）。

### 1.3 建议补记（仍属 ADR-0006，不是新决策）

1. **placement 字符串**：接口已有 `load(placement)`，主位从「4 个角标」扩到失败页**不改方法签名**。建议枚举（键名归代码，提案用占位）：
   - `'fail-continue'` — **本轮产品主位**
   - `'powerup-region' | 'powerup-clearAll' | 'powerup-random' | 'tray-expand'` — S6/S4 后挂，可暂不接线
   - `AD_PLACEMENTS = 4`（§3.6）字面不含失败页；是否改常量 / 另立 `AD_PLACEMENTS_FAIL` 归文策渊回写 §3，工程不私定
2. **可选查询**：`isReady(): boolean`（`load` 成功且未销毁）。失败页可用来灰显「看广告续时」。没有它也能靠 `load` 的 `onError` 工作，**非阻塞**。
3. **单实例互斥**：同时只允许一次 `show`；第二次 `show` → `onError`，不发奖。
4. **注入点**（控制清单 §9：新能力 = Platform 方法 + 三个实现）：
   - `Platform.createRewardedAdProvider?(): RewardedAdProvider`（可选，缺省 = 无广告）
   - `App` 把它放进 `GameServices.rewardedAd?: RewardedAdProvider`（今日 `GameServices` 只有 `platform: PlatformInfo` 名字，**游戏拿不到完整 Platform**，必须经 services 注入，否则 beads 会去碰 `wx`，违反 L3）
   - Node：返回 `MockRewardedAdProvider`；web：Mock 或空实现；weapp：**用户批拉起之前**只返回 **Noop**（`show` → `onError`，**零 `wx` 广告 API**）；批之后才换真包装
5. **销毁**：`destroy()` 在 `App.dispose` 调用；热重载不留监听。

### 1.4 明确不够、但不在本 Provider 里解决的

| 缺口 | 归属 |
|---|---|
| 续时秒数 `N`、每局几次、冲刺开不开 | 文策渊 / §3 `[待确认]`，本提案不发明 |
| `starRemaining = remaining − reviveBonusSec`、续命局 2★ 封顶 | 已在 §3.7 T-B；beads `GameTimer.ratio` 实现时改口径，**禁止用 HUD remaining 算星**（`star-level-rebalance.md` §3.5） |
| 失败页按钮文案 / 线框 | 路远行（现行 UX：`GAME_OVER` 只有「重试本关」；实现上**整屏点击即 `retryLevel()`**） |
| 真机错误码 1000–1008 | EP-10 / 真机；Mock 用脚本化错误即可单测 |

---

## 2. 与 S1 GAME_OVER 状态机的挂接

### 2.1 现状（读码）

六状态与合法边（`games/beads/src/game/state.ts`）已冻结映射 core-loop §2.1：

```
boot → playing
playing ⇄ paused
playing → level-clear → playing | finish
playing → game-over → playing    ← 续时与重试用同一条边
finish → playing
```

`GAME_OVER` 今日出口只有 `retryLevel()`：五项整关重置再 `transition('playing')`。`onEnter` 立刻 `level:failed`；冲刺额外 `_recordSprintEnd()`。点任意处（非齿轮）即重试。

计时：`GameTimer.tick` 只在 `playing.onUpdate → _stepPlaying` 调用（ADR-0007）。`GAME_OVER` 无 `onUpdate` → **表已停、供料已停**。`GameTimer.addTime(seconds, cap)` 已为冲刺 C5 存在，续时**复用**，不新造加时 API。

### 2.2 推荐：方案 A — 留在 GAME_OVER，看完再回 PLAYING

不新增状态。

| 步骤 | 行为 |
|---|---|
| 归零 | 照旧 `playing → game-over`（S5 §8-4 仍成立） |
| 广告播放 | **phase 保持 `game-over`**；`load('fail-continue')`（可在进失败页或告急时预载）→ 玩家点「续时」→ `show()` |
| 看完 | `onRewarded`：`addTime(N, cap)`、累加 `reviveBonusSec`、`revived = true`、**不**五项重置、`transition('playing')` |
| 未看完 / 失败 | 留在 `game-over`，`remaining` 保持 0 |
| 放弃续时 | 现有 `retryLevel()`（五项重置） |

`cap`：冲刺已有 `_sprintCap`；普通关建议 `max(LEVEL_TIME, remaining + N)` 与 C5 同形，**具体 N / 是否允许 remaining > LEVEL_TIME 等文策渊**。未冻结前测试用注入秒数，不写进 `tuning.ts`。

**为什么不要第七态（`AD_WATCHING` / `REVIVING`）**

- 微信激励视频是原生遮罩，游戏循环即使还在跑，`GAME_OVER` 也没有步进
- 新状态要改冻结转移表、UX 矩阵、S2 门禁、全部「非 PLAYING 五态忽略」用例，收益只是给「正在看广告」一个名字
- 控制清单 §7：能用现有态表达就不要加旗标式新态

**为什么不要先切 PAUSED 再看广告**

- D-04：`onResume` 故意空操作，暂停面板是 PAUSED 唯一出口
- 激励视频会触发 `onHide` / `onShow`（见 §3）。若看广告前已经 `PLAYING` 或误进 `PAUSED`，回前台会停在暂停面板，玩家刚看完广告却要再点「继续」——体验与 D-04 语义打架

### 2.3 必须避开的时序（hide/show × 发奖）

`App.start` 现序（**不要拆**）：`onHide` → `game.onPause()`；`onShow` → `loop.reset()` + `game.onResume()`。

激励视频 `show()` 期间微信会把小游戏切到后台。

| 顺序 | 结果 |
|---|---|
| **正确**：`show` 时仍是 `GAME_OVER` → `onPause` 因非 PLAYING 被 `_requestPause` 忽略 → 看完 `onRewarded` 再进 PLAYING → `onShow` 的 `onResume` 空操作 | 回局即 PLAYING，表从 N 秒走 |
| **错误**：发奖前先 `transition('playing')` 再 `show` → `onHide` 把 PLAYING 切进 PAUSED → 看完后停在暂停面板 | 与「有意愿点广告、立刻续打」冲突 |

落码约束：`continueLevel()` **只允许**从 `game-over` 且 `onRewarded` 同步路径调用；禁止在 `show()` 成功时提前加时。

### 2.4 `level:failed` 与冲刺

`game-over.onEnter` 今日同步广播 `level:failed`。S8 常规档**尚未**在失败路径写连胜清零（`_persistProgress` 只在过关）；冲刺则会 `_recordSprintEnd()` 写最佳分。

续时若发生在「已经 failed」之后：

- 普通关：事件已发出但几乎无档可脏；**建议**把「提交失败」推迟到玩家点「重试 / 放弃」（或续时成功则本局 failed 作废）。是否改 S1 §8-4「恰 1 次 `level:failed`」归文策渊——续时成功后再过关应走 `level:cleared`，不应先有一次失败记账
- **冲刺：默认本切片不开续时。** 失败页一进就 `sprint:ended` 已落最佳分；再加时续爬会双计或改写「一局结束」。若产品坚持冲刺也可续，必须先改 `_recordSprintEnd` 时机（未结束不写），那是另一项，不塞进 Provider 切片

### 2.5 输入：整屏重试必须拆开

`_handleTap` 在 `game-over` 分支无条件 `retryLevel()`。续时落地后必须变成：

- 热区 A：「看广告续时」→ `show()`（未 ready 则忽略或 `onError` 提示）
- 热区 B：「重试本关」→ `retryLevel()`
- 热区外：忽略（对齐暂停面板「遮罩吞点击」）

热区几何与文案归 UX；工程只要求**两个公开命令**（`retryLevel` 已有，新增 `continueLevel` 仅由 `onRewarded` 调用，UI 不直接加时）。

---

## 3. 广告视频期间对倒计时 / 供料的冻结

**已是 GAME_OVER 时表已停**——这不是新工作，是现状：

- ADR-0007：S1 状态机是冻结单点；离开 PLAYING 即不 `tick()`、不 `spawner.step()`
- S5 §8-5 / S1 §8-7：PAUSED 与非 PLAYING 均不累计；`GAME_OVER` 同理
- D-04：回前台不解暂停；广告引起的 hide/show 在 GAME_OVER 上是空操作，**不会**把失败页变成 PLAYING

仍须单测锁死（Mock，不调 wx）：

1. `GAME_OVER` 中 `advance(60)` → `remaining === 0`、无新 `tray:spawned`
2. `show` 期间（Mock 延迟关闭）再 `advance` → 仍冻结
3. `onRewarded` 后 `remaining` 为注入的 N（误差 ≤ 1 帧 dt），随后 PLAYING 才递减
4. `onClose(skipped)` / `onError` 后仍 `game-over` 且 `remaining === 0`

---

## 4. 工作量拆解

口径：1 人日 ≈ 专注实现 + Node 单测；不含文策渊冻结 N、不含路远行线框、不含真机。ADR-0006 §4.3「S ≈ 150 行 + 测试」只覆盖 **Provider 本体**；beads 续时与星级口径是**额外**游戏侧工作。

| 切片 | 内容 | 人日 | 依赖 |
|---|---|---|---|
| **F1 框架接口 + Mock** | `RewardedAdProvider` 类型；`MockRewardedAdProvider`（可脚本 `complete` / `skip` / `fail`）；`packages/framework/tests`；Node `createRewardedAdProvider` 返回 Mock | **0.5** | 用户批本范围；**仍不写 wx** |
| **F2 注入** | `Platform` 可选工厂；`GameServices.rewardedAd?`；`App` 装配；web/weapp **Noop**（`show`→`onError`） | **0.5** | F1 |
| **B1 beads 续时** | `continueLevel`；`reviveBonusSec` / `revived`；`GameTimer.ratio` 改 `starRemaining`；失败页两热区命令；Mock 用例 | **1.0–1.5** | F2；§3 续时 N 可先测试注入 |
| **W1 weapp 真包装** | `weapp.ts` 存在性守卫 + `wx.createRewardedVideoAd` 映射 `isEnded` | **0.5** 编码 | **用户明示批准拉起** + 广告位 ID；此前 **禁止合入** |
| **W2 真机** | 错误码、无填充、中途关、与 D-04 hide/show | **0.5–1.0** | `[Blocked: 待真机 / EP-10]` |

**合计（可先做、零 wx）**：F1+F2+B1 = **2–3 人日**。  
**合计（批准拉起后）**：+W1；W2 阻塞。

### 4.1 不依赖 S6

S6 `powerups.ts` 不存在；EP06-S1/S2 仍是角标占位。失败页续时：

- 不消耗 `POWERUP_FREE_USES`
- 不清托盘、不改网格（续的是**同一局**）
- 用独立 placement `'fail-continue'`

S6 广告位是同一 Provider 的后挂消费者。若产品把 4 个角标降为辅位或暂不拉起，**不影响**本切片。

### 4.2 建议实施顺序（批准后）

1. F1 Mock + 契约测试（发奖 iff complete）
2. F2 Noop 注入（weapp 生产路径此时仍不拉起）
3. B1 游戏侧续时 + 星级口径（Node 全绿即可验收逻辑）
4. 用户批拉起 → W1 → W2

不要把 W1 与 B1 绑在同一 PR。

---

## 5. 审核风险：不调 wx 广告 API 直到用户批拉起

微信侧常见拒审 / 无填充原因（作为**已知成本**记下，不是实现步骤）：

- 未开通流量主 / 无激励视频广告位 ID 却调用 `wx.createRewardedVideoAd`
- 提审包里出现广告 API，但资质或场景不符
- 未看完发奖（会被判「诱导」——所以 `isEnded` 映射是合规面，不只是体验）

本仓控制：

| 阶段 | weapp 行为 |
|---|---|
| 现 MVP / 本提案批准前 | 维持 ADR-0006 方案 A：角标占位，**不声明、不调用**广告 API |
| F1–B1 合入后、批拉起前 | weapp = **NoopProvider**；`WxApi` **仍不**加 `createRewardedVideoAd` |
| 用户批拉起 + 有 adUnitId | 才改 `weapp.ts`，且必须存在性守卫（无 `wx` / 无该方法 → Noop） |

禁止：为了「接口完整」在 Noop 阶段写一个永远不走到的 `wx.createRewardedVideoAd(...)` 调用——打包器仍可能打进包，审核面不可控。

`adUnitId` 不进 `tuning.ts` / 不进 git 明文仓库外配置策略由发布域另定；本提案只要求**不要**把密钥或广告位写进 `games/*/src`。

---

## 6. ADR 编号与五节草稿

**不新开 ADR 文件。** 理由：平台抽象仍是「可选 RewardedAdProvider」，ADR-0006 §5 第一条复评触发（用户确认拉起与发奖）即本任务；失败页是 placement + S1 接线，不是新基础层决策。

编号占用：ADR-0008 每日挑战（预约）；0009/0010 已落盘；局内快照提案建议 0011。若主理人将来把「GAME_OVER 续时」升格为独立决策，下一空号为 **0012**——**本轮不写进 `docs/architecture/adr/`**。

以下为 **ADR-0006 补记草稿**（批准实现时由主理人合并进原文，不单独占号）：

```
# ADR-0006 补记 — 失败页续时消费 RewardedAdProvider（WXG-T-057）

## 1. 上下文（Context）
产品主位从「4 角标」转向失败页续时；S6 仍未实现。接口形状已在 0006 §3 预埋，
但未写 WeChat onClose.isEnded 合成规则、未写 hide/show 与 D-04 的次序。
GameServices 只有 PlatformInfo，游戏无法经 Platform 调广告。无真机。

## 2. 备选方案（Alternatives）
方案 A：补记 0006（placement + isEnded 映射 + services 注入 + GAME_OVER 内看广告）。
方案 B：新开第七态 AD_WATCHING + 新 ADR。
方案 C：广告能力放 games/beads，weapp 直接调 wx（违反 L3 / 控制清单 §9）。

## 3. 决定（Decision）
选方案 A。看完才 onRewarded；GAME_OVER 内 show；发奖后再 playing。
weapp 真包装延迟到用户批拉起。不新增基础层 ADR。

## 4. 后果（Consequences）
### 4.1 正面
- 六状态冻结不被打开；倒计时/供料零改冻结模型。
- Node 可用 Mock 验「未看完不发奖」；审核面可与实现分 PR。
### 4.2 负面（已知成本，不是风险）
- 微信无原生 onRewarded，封装层若漏 isEnded 会误发奖或重复发奖。
- 激励视频必走 onHide/onShow；接线顺序错会掉进 D-04 暂停面板。
- Noop 与真包装分阶段，weapp 在批拉起前失败页按钮只能降级。
- GameTimer.ratio 今日用 remaining/total，续时后若不改口径会把续命局做成 3★。
- 无真机则 1004 无填充等错误码无法在 CI 证明。
### 4.3 中性 / 待观察
- 失败页是否计入 AD_PLACEMENTS 常量，待 §3 回写。
- 冲刺失败页是否续时（默认否）。
- 是否给 isReady()；没有也能做。

## 5. 复评触发条件（Review Triggers）
- 用户批准 wx 拉起或要求插屏/banner（回到 0006 §5 第三条）。
- 基础库变更导致 onHide 不再随激励视频触发，或 isEnded 语义变化。
- 冲刺需要续时 → 重评 sprint:ended 写入时机。
- EP-10 真机得到与 Mock 不一致的关闭/错误行为。
```

---

## 7. 实现边界（批准后才动；本轮不落码）

| 做 | 不做 |
|---|---|
| 框架可选 Provider + Mock + Noop | 本轮改 `packages/framework/src` |
| beads `continueLevel` + 星级口径 | 伪造 `wx.createRewardedVideoAd` |
| 契约测试：complete / skip / error | 改冻结六状态；发明续时秒数 |
| 失败页两命令拆开 | 实现 S6 道具效果 |
| | 把广告 API 写进 `games/*/src` |
| | 新建 `docs/architecture/adr/ADR-00xx` |
| | git commit |

环境阻塞：无真机、无广告位 ID → W1/W2 不能验收「真视频」。Mock 可在 Node 把发奖语义测死。

---

## 8. 待拍板（2–4 项，回传主理人）

1. **续时是否仅普通关**（工程建议：冲刺本切片不开）？
2. **`level:failed` 是进 GAME_OVER 就发，还是点「重试」才提交**（续时成功则本局不当失败）？
3. **weapp 真包装是否与 F1–B1 分 PR**（工程建议：必须分；先 Noop）？
4. **失败页是否回写 §3.6 `AD_PLACEMENTS`**，抑或另列常量（文策渊）？

文策渊侧仍须冻结：N 秒、每局次数、按钮文案；工程消费，不发明。

---

## 9. 知识库候选（0–3，待主理人 `kb:sync`）

- **[平台微信] 激励视频 `show` 会走 `onHide`/`onShow`，必须在非 PLAYING 态看完再回 PLAYING**，否则与「回前台不解暂停」（D-04）叠成暂停面板。来源 WXG-T-057（提案，尚未踩真机）。
- 其余：无（本轮未实现、未踩坑）。

---

## 10. 变更记录

| 版本 | 日期 | 变更 | 依据 |
|---|---|---|---|
| v0.1 | 2026-09-14 | 初稿：ADR-0006 够用+补记、GAME_OVER 内看广告、不依赖 S6、2–3 人日、不调 wx 直到批拉起、不新开 ADR | WXG-T-057 程基岩 |
