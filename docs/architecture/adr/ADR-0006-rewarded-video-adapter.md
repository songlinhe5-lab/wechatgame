# ADR-0006 — 激励视频适配：MVP 角标占位，框架新增可选 RewardedAdProvider 能力（待批准）

## 1. 上下文（Context）

systems-index §3.6 冻结 `AD_PLACEMENTS = 4`（3 道具 + 托盘扩展），MVP"仅角标占位，拉起与发奖逻辑 `[待用户确认]`"；§5 假设 `platform/weapp` 暴露 `createRewardedVideoAd` 适配接口，并显式标注"该接口是否存在需工程确认，存在前 AD_PLACEMENTS 只做占位 `[待工程对齐]`"。

**读码确认结论（WXG-T-010）**：`packages/framework/src/platform/platform.ts` 的 `Platform` 接口仅含 clock/storage/audio/assets/screen/frame/lifecycle/log 能力；`weapp.ts`（180 行）只封装 `wx.*StorageSync`、`InnerAudioContext` 系（经 AudioBackend）、`getWindowInfo/getSystemInfoSync`、`onHide/onShow`。**全仓 grep 无 `createRewardedVideoAd`、无任何 ad 相关代码。§5 假设不成立。**

## 2. 备选方案（Alternatives）

**方案 A：MVP 零广告代码——角标纯视觉占位**
- 事实对比：4 个广告位只渲染 `ad_badge`（assets-spec §1.4，28×28 圆角 + ▶）；点击给"即将开放"轻提示；不 import 任何 wx 广告 API。
- 代价：玩家点击无实际功能；道具免费次数用尽与托盘扩展在 MVP 阶段只有免费路径。

**方案 B：现在就补齐框架 `RewardedAdProvider` 能力（接口 + weapp 实现 + Mock）**
- 事实对比：`Platform` 增加可选能力（或独立 provider 接口：`load/show/onClose/onRewarded/onError`）；weapp 实现包 `wx.createRewardedVideoAd`；Mock 供 Node 测试与 canvas2d harness。
- 代价：拉起时机/发奖回调语义**用户尚未确认**（§3.6 `[待用户确认]`），先实现大概率返工；`wx.createRewardedVideoAd` 的错误码与拉起失败降级行为需真机验证，当前无编辑器无真机——**写了也无法验证**，违反本轮验证纪律。

**方案 C：只在游戏侧定义 ad 事件位（`ad:reward` 事件约定），框架不动**
- 事实对比：S6/S4 留好事件消费点；但 weapp 拉起实现仍无处安放，最终还得进 platform 层——分期做同一件事，接口被游戏侧先占形，框架层后补时易返工。

## 3. 决定（Decision）

选**方案 A**（MVP 角标占位）+ **预埋方案 B 的接口形状**：

1. MVP 阶段不写任何广告实现代码（方案 A 全量生效）。
2. 游戏侧数据结构预留 `unlockedBy: 'free' | 'ad'` 语义字段（S4 扩展行、S6 免费次数），后补时不改存档/重置语义。
3. 框架侧**规划**（不在本轮实现）可选能力 `RewardedAdProvider`：`load(placement) / show() / onClose(cb) / onRewarded(cb) / onError(cb)` + `MockRewardedAdProvider`（测试/harness 用）；weapp 实现包 `wx.createRewardedVideoAd`。**接口落地需主理人批准后实施**——属框架改动，本轮纪律禁止修改框架。

## 4. 后果（Consequences）

**4.1 正面**
- 不触碰 `wx` 广告 API：无审核合规面（微信对未接入广告组件的游戏调用广告 API 有拒审风险）、无包体增量、无未验证代码。
- 4 个广告位的**位置、视觉、事件消费点**全部就位，后补时只填"拉起与发奖"一段。

**4.2 负面（已知成本，如实记录）**
- MVP 玩家点击角标无真实功能，"即将开放"提示是**体验上的诚实妥协**，可能被理解为功能残缺。
- `unlockedBy` 字段在 MVP 只有 `'free'` 一个取值，属"为未来写的死代码"，有 YAGNI 成本。
- 接口形状（方案 B）在无真机情况下设计，`wx.createRewardedVideoAd` 的真实错误行为（拉起失败/中途关闭）可能迫使接口调整。

**4.3 中性 / 待观察**
- 工作量级估计：`RewardedAdProvider` 接口 + weapp 实现 + Mock + 测试 ≈ **S**（约 150 行 + 用例）；真机联调另计（依赖 EP-10）。

## 5. 复评触发条件（Review Triggers）

- 用户确认拉起与发奖逻辑（§3.6 `[待用户确认]` 解除）→ 立即按 §3.3 规划实施方案 B，走框架改动审批。
- EP-10 真机验证就绪 → 补 `wx.createRewardedVideoAd` 真机错误行为核实，再定稿接口。
- 商业化需求提前（如需要插屏/banner）→ 复评是否扩充为通用 `AdsProvider` 而非仅激励视频。
