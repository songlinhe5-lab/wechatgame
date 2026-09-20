# 微信小游戏矩阵 — beads（拼豆填色消除）架构文档

- **版本**：0.1.0
- **日期**：2026-09-11
- **作者**：程基岩（技术 + 引擎负责人）
- **任务**：WXG-T-010（阶段 3 技术搭建）
- **引擎**：Cocos Creator 3.8 LTS（矩阵级决策，见 `architecture.md` + ADR-0001）
- **关联决策**：ADR-0004（关卡数据形态）/ ADR-0005（程序化渲染）/ ADR-0006（激励视频适配）/ ADR-0007（计时与冻结归属）
- **复用基座**：`packages/framework`（WXG-T-001 交付，226 单测 / core 覆盖 94.45%）——**本文不修改框架与 breakout 任何代码**；矩阵级架构（分层/依赖规则/构建链/包体预算）见 `architecture.md`，本文只写 beads 增量。

---

## 1. beads 特有约束（在矩阵约束之上）

| 约束 | 值 | 来源 |
| --- | --- | --- |
| 数值真源 | `games/beads/design/gdd/systems-index.md` §3（v1.2 冻结） | 唯一真源 |
| 渲染 | Cocos `Graphics` + 纯色 Sprite，**零贴图**；珠子六层参数卡（assets-spec §1.1） | art/assets-spec §0 |
| 包体 | 主包内部目标 ≤ 2000 KB（红线 4096 KB），美术位图 0 KB | systems-index §3.9 |
| 触控 | UI 控件 ≥ 88px；**棋盘/托盘珠例外**：命中区 = 名义尺寸外扩 8px（66²/62²），重叠按格心最近 | systems-index §3.8 |
| 交互形态 | 单指 tap、无拖拽/长按——输入比 breakout 简单，**复用 InputManager 的快照模式** | input-control §2.1 |
| 失败条件 | **唯一**：倒计时归零（托盘满不判负） | systems-index §3.5 |
| 激励视频 | 4 个广告位（3 道具 + 托盘扩展），MVP **仅角标占位** | systems-index §3.6 |

---

## 2. 9 系统 → 框架模块映射（systems-index §5 逐条对账）

> 对账结论：§5 六条假设 **4 条成立、1 条部分成立、1 条不成立**（激励视频），无一条需要改动框架既有行为；框架改动仅 ADR-0006 的**新增可选能力**（待批准）。

| §5 假设 | 框架现实（已读码核对） | 结论 | 落位 |
| --- | --- | --- | --- |
| Cocos 3.8 + weapp，开发期 canvas2d + web 验证 | `adapters/cocos`（renderer/input-bridge/loop-bridge，bindings.ts ⚠ 未验证，缺口 G1–G9）+ `adapters/canvas2d` + dev harness 均已交付 | ✅ 成立 | 沿用矩阵判例 |
| FSM 六状态直接映射 | `core/fsm` StateMachine：显式转移表、非法边不可达 | ✅ 成立 | S1 `game/state.ts` |
| `core/events` 承载 §4 全部 13 事件；系统间禁止直接互调 | `core/events` EventBus：类型化、仅通知不传状态、中途退订安全 | ✅ 成立（附使用注意①②） | §5 事件装配表 |
| `core/save` 同步本地存储，键名归代码 | `core/save` SaveManager\<T\>：版本化、迁移、校验、**永不抛异常** | ✅ 成立 | S8 `save-schema.ts`，键 `wxgame.beads.save.v1` |
| **激励视频**：假设 weapp 暴露 `createRewardedVideoAd` | **不成立**：`Platform` 接口无任何 ad 能力；`weapp.ts` 仅封装 storage / audio backend / screen / 生命周期 / 日志，全仓 grep 无 `createRewardedVideoAd` | ❌ **不成立** | **ADR-0006**：MVP 角标占位 + 可选 `RewardedAdProvider` 能力（待批准后补） |
| `core/audio` 提供 bgm/sfx 开关 | `AudioScheduler`：帧批量派发 + 去重限流 + `setMuted()`（单通道） | ⚠️ **部分成立**：sfx 开关 = `setMuted` 直接可用；**无 bgm/sfx 分通道**——方案：游戏侧组合**两个 AudioScheduler 实例**（sfx / bgm 各一，共享同一 AudioBackend），`loop: true` 播 BGM，设置页分别 setMuted | S9 设置直连，无需改框架 |

**使用注意（事件总线）**

1. **"仍需颜色集合"是数据流不是事件**：GDD 定为"经 `bead:placed` 间接同步"。落位为**投影模式**——S4 持有"仍需颜色集合"缓存，初值来自关卡数据（BOOT 装配），每次消费 `bead:placed` 事件自行扣减；S3 与 S4 零直接调用。
2. **同帧多事件到达序**：EventBus 同步派发按订阅/发布顺序；GDD 的竞态裁决（cleared 优先、先到事件为准）一律由**订阅方按事件序处理**实现，S1 状态机是最终裁决者。

---

## 3. `games/beads/src` 目录结构

```
games/beads/src/
├── index.ts                 # 公开导出（Game 实现 + 类型）
├── config/
│   ├── tuning.ts            # 引用 systems-index §3 常量（只引常量名，不复制数值）
│   ├── levels.ts            # BEAD_CHARS / LEGEND / 关卡元数据接口
│   └── levels-data.ts       # 8 关行字符串数据（ADR-0004）
├── entities/
│   ├── grid.ts              # S3 运行时矩阵：格子三态 empty|filled|locked + colorIdx
│   └── tray.ts              # S4 槽位数组：free|holding|selected + 仍需颜色集合投影
├── systems/
│   ├── placement.ts         # S3 落子裁决（匹配/拒绝/忽略/完成判定）
│   ├── spawner.ts           # S4 供料节律 + 3:1 加权抽色 + 随机空闲槽
│   ├── timer.ts             # S5 dt 累计 + 告急 + 归零（ADR-0007：游戏侧持有）
│   └── powerups.ts          # S6 三道具（P1，已落码 WXG-T-060）
├── game/
│   ├── beads-game.ts        # Game 实现：S1 编排 + 事件订阅装配
│   ├── state.ts             # 六状态转移表 + Snapshot + 同帧裁决（cleared 优先）
│   └── save-schema.ts       # S8 存档结构（键名归代码）
└── view/
    ├── palette.ts           # 10 色 HEX + mix()（art-bible §3.2 唯一颜色出处）
    ├── symbols.ts           # 10 符号矢量 path（assets-spec §1.1，polygon 指令）
    ├── bead-render.ts       # 六层参数卡 → DrawCommand 序列（纯函数、可快照测试）
    └── view-model.ts        # buildBeadsView()：网格/托盘/HUD/面板 → RenderModel
```

**分层纪律**（沿用矩阵 control-manifest，不重复展开）：`src/**` 禁 `cc`/`wx`/DOM/`Math.random`；事件只通知不传状态；`buildRenderModel()` 只读；确定性 RNG 由 `services.rng` 注入（供料随机槽、加权抽色全部走它，测试可复现）。

---

## 4. 渲染层方案（ADR-0005 摘要）

**决定**：demo 阶段**全程序化、每帧重建 RenderModel**，零框架改动。

| 参数卡元素 | RenderModel 落位 | 说明 |
| --- | --- | --- |
| L0 投影 / L1 主体 | `rect { radius, alpha }` | RenderModel 的 rect **已支持圆角与透明度**，roundRect 无需新指令 |
| L2/L3 暗亮倒角 | `line` ×4（内缩描边） | 沿边内缘直线段 |
| L4 高光条 | `rect { radius, alpha }` | — |
| L5 符号（○★●■♥◐▽▲◆✚） | `circle` + `polygon` | `symbols.ts` 逐符号给出顶点表；线宽 ≥2px 约束在指令生成时断言 |
| `locked` 斜纹 | `line` 45° ×N（间距 10） | — |
| 扩展槽虚线（dash 6/4） | **短线段合成** | RenderModel 无 dash 描边——view 层按 6/4 周期切成 line 序列，纯游戏侧实现 |
| `hint` 呼吸 / `wrong` 抖动 | 每帧重算 α / 位移 | 表现层态不改逻辑态（S3 §2.2），参数由 Game 的表现状态表驱动 |

**规模账**：满格 13×12=156 珠 × 6 层 ≈ **900+ 指令/帧**（含托盘/HUD）。Canvas2D harness 无压力；Cocos 单 Graphics 重建的真机开销**未验证**（依赖 EP-10 真机步）。复评触发（ADR-0005 §5）：真机 <30fps 或业务代码 >400KB → 切 assets-spec §3 预留的图集方案，成本被压在 `view/` 目录内，玩法逻辑零改动。

---

## 5. 事件装配图（systems-index §4 全部 13 事件）

```
                    ┌─────────────── S1 beads-game（状态机 + 最终裁决）───────────────┐
                    │  BOOT→PLAYING / PAUSED / LEVEL_CLEAR / GAME_OVER / FINISH       │
                    └──────────────────────────────────────────────────────────────────┘
   发布方                     事件                    消费方
   S4 spawner   ──► tray:spawned {slot,colorIdx} ─► S7 统计 / view 新珠动效 / S4 内部(仍需集合无关)
   S2 input     ──► tray:selected {slot,colorIdx} ─► view selected 态
   S3 placement ──► bead:placed {row,col,colorIdx,slot} ► S4(槽置 free+仍需集合扣减) / S7 / S1(完成判定) / 音频
   S3 placement ──► bead:rejected {row,col,colorIdx} ──► view wrong 态 / 音频
   S4 spawner   ──► tray:full {}                     ──► view 告警（满槽期间去重）
   S4 spawner   ──► tray:expanded {}                 ──► view 虚线→实线过渡
   S6 powerups  ──► powerup:used {type,affectedSlots}► S4 清槽 / S7 结算统计
   S5 timer     ──► timer:tick {remaining}           ──► HUD 数字
   S5 timer     ──► timer:urgent {remaining}         ──► view danger 脉冲 / 音频节拍
   S1           ──► level:cleared {levelId,remaining,ratio,stars} ► S7 / S8 / view 庆祝
   S1           ──► level:failed {levelId}           ──► S8 / view 失败面板
   S9 pause     ──► game:paused / game:resumed {}    ──► S1(状态) / S4(心跳冻结) / S5(计时冻结)
```

订阅装配集中在 `beads-game.ts` 的 `_subscribe()`（breakout 同款模式）：Game 构造期订阅、`dispose()` 统一退订；S4 的"仍需颜色集合"投影、S5 的冻结语义都实现为**事件订阅侧**，系统间零直接调用。

---

## 6. BOOT 装配与关卡加载流

```
compose/createApp(platform)                    # compose/app.ts（矩阵级，复用）
  └─ BeadsGame.init(services)
       ├─ 1. SaveManager 加载 wxgame.beads.save.v1   # 损坏/越界/高版本 → 降级第 1 关（S1§8-10）
       ├─ 2. 入口分流：runs==0→L1；有进度→续进 unlockedLevel 最远关
       ├─ 3. 装配关卡（levels-data.ts 行字符串，ADR-0004）
       │     └─ validateLevel()（breakout 判例，启动期一次性）：
       │          · 字符 ∈ BEAD_CHARSET（`.` x 1-9 A）
       │          · 行宽 === cols；行数 ≤ GRID_MAX_ROWS(12)；cols ≤ 13
       │          · ≥1 可填格（全锁定/预填 → 拒绝，S1§8-9）
       │          · LEVEL_TIME ∈ [180,420]（S5§8-7）；SPAWN_INTERVAL ∈ [2.0,6.0]
       │          · 杂色数 ≤ DECOY_COLORS_MAX(2)；引用色索引 ≤ BEAD_COLOR_MAX(8)
       │          · 失败 → BOOT 错误占位，**不允许带病进入 PLAYING**（core-loop §2.1）
       ├─ 4. 装配转移表（state.ts）→ StateMachine
       ├─ 5. _subscribe()：§5 全部事件订阅 + AudioScheduler×2（sfx/bgm）
       └─ 6. 装配完成 → 状态机 BOOT → PLAYING
```

校验器**只做启动期把关**，运行期 S3 保留防御性断言（bead-grid §2.1），双层不重复。

---

## 7. 激励视频占位（ADR-0006 摘要）

- **读码结论**：`packages/framework/src/platform/` 无任何广告能力；`createRewardedVideoAd` 在仓库中不存在。§5 假设**不成立**，已如实登记。
- **MVP 落位**：`AD_PLACEMENTS=4` 全部只渲染 `ad_badge` 角标（assets-spec §1.4）；点击 → 轻提示"即将开放"，**不调用任何 wx API、不引入审核风险**。
- **补齐路径**：框架新增可选能力 `RewardedAdProvider`（load/show/onClose/onRewarded + MockProvider），weapp 实现包 `wx.createRewardedVideoAd`；工作量级 **S**（≈150 行 + 测试）。**待用户确认拉起与发奖逻辑后再开工**（systems-index §3.6 `[待用户确认]`）。
- **状态预留**：S4 扩展行与 S6 免费次数的数据结构预留 `unlockedBy: 'free' | 'ad'` 语义字段，避免后补时改存档/重置语义。

---

## 8. 风险登记册（beads 增量）

| # | 风险 | 影响 | 概率 | 缓解 | 触发信号 |
| --- | --- | --- | --- | --- | --- |
| R1 | 满格 900+ 指令/帧，Cocos Graphics 真机重建开销未知 | 低端机 <30fps | 中 | ADR-0005 复评触发 + 图集预案压在 view/ 层 | 真机帧率 <30（EP-10） |
| R2 | 激励视频适配缺失（§5 假设不成立） | 广告位无功能 | **确定（MVP）** | 角标占位 + ADR-0006 补齐路径；状态字段已预留 | 用户确认拉起逻辑 |
| R3 | S6–S9 GDD 未产出，P1 系统无 §8 判据 | 拆分验收悬空 | 确定 | Epic 文档显式标 `[待 GDD §8]`，判据到位后回填；不发明数值 | GDD 交付 |
| R4 | 暂停冻结语义跨 3 系统（S4 心跳/S5 计时/表现层）漏冻结 | 暂停后世界仍在动 | 中 | ADR-0007：S1 状态机门禁单点裁决 + S4§8-8/S5§8-5 判据覆盖 | QA 用例 |
| R5 | bindings.ts 未验证（矩阵级 G1–G9 沿用） | 编辑器首编译失败 | 高 | breakout 同一缓解路径；EP-10 首步验证 | 编辑器就绪 |

---

## 9. 当前实现状态

| 交付物 | 状态 |
| --- | --- |
| 本架构文档 + ADR-0004…0007 | ✅ 完成 |
| §5 假设对账（含激励视频读码确认） | ✅ 完成（1 条不成立已上报） |
| Epic/Story 拆分 | ✅ `production/epics/epics-beads.md` |
| games/beads/src 实现 | ✅ S1–S5 / S6 / S8 / S9 / 冲刺模式已交付（15 个测试文件 / 145 用例；S6 于 WXG-T-060 落码，`systems/powerups.ts`）|
| Cocos 工程 | ❌ 仍未创建（ADR-0003 判例）——**编辑器已就绪**（Cocos 3.8.8 + 预览/构建链实测通过，见 `VERSION.md`），且**仓库侧前置已就绪**：`framework:sync` 已泛化为多游戏、`build:cocos` 已按 per-package 声明、逐步清单见 `docs/agent/cocos-setup.md §13`。剩余动作只有一项：**在编辑器 GUI 里创建工程**（L1 禁止伪造 `.scene`/`.meta`） |

> **截至 2026-09-14 的与实现出入（WXG-T-052 对账，逐条已修正或登记）**
>
> 1. **§3 目录结构的落地差异**：规划中的 `view/symbols.ts` 与 `view/bead-render.ts` **曾长期缺失**
>    （本页 §4 的「渲染层方案」因此只落地了一半 —— 珠子只有色块，无 L5 符号），现已补齐；
>    规划中的 `systems/powerups.ts`（S6）**已于 WXG-T-060 落码**（`powerups.md §8` 十条判据全部有测试）；
>    实际另交付了规划外的 `systems/sprint.ts`
>    与 `systems/pause-panel.ts`（冲刺模式与 S9 面板）。
> 2. **§4「每帧重建 RenderModel」的规模账已可实测**：满格 13×12 时 `view-model` 产出
>    **≥ 8 条指令/珠**（L0/L1/L2×2/L3×2/L4 + L5），总量与 §4 的「900+ 指令/帧」一致，
>    由 `tests/view-model.test.ts` 断言。R1（真机帧率）仍待 EP-10 实测。
> 3. **`view-model.ts` 头注已更新**：原注释称符号通道「deliberately deferred」，现已改为指向
>    `view/symbols.ts` + `view/bead-render.ts`。
> 4. **可达性偏差与 BOOT 校验缺陷已分别登记**：见 `art/accessibility.md` 的「落地状态复核」
>    （草绿墨色按 B2 地板翻转、locked 混色不可实现、斜纹密度）与本台账的 T-052 行
>    （`validateBeadsLevel` 曾放行 `NaN` 时长/供料间隔，已修）。
