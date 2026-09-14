# 《砖阵》(Breakout) 测试计划 · Test Plan

- 项目：微信小游戏矩阵 · 首款 demo《砖阵》
- 引擎：Cocos Creator 3.8 LTS ｜ 平台：微信小游戏（竖屏 750×1334，`FIXED_WIDTH`）
- 任务号：**WXG-T-004**（P1）｜ 作者：严守真（质量负责人）
- 版本：v1.0 ｜ 日期：2026-09-11
- 关联产物：`production/qa/smoke-tests.md`、`test-cases.md`、`bug-severity.md`、`playtest-plan.md`

> **数值真源**：本计划及所有用例中的数值**一律引用** `games/breakout/design/gdd/systems-index.md §3（❄️ 冻结令）` 及其派生文档；**不自行发明数值**。凡引用处均标注"来源"。

---

## 0. 本轮环境事实（决定"可执行 vs 阻塞"）

| 环境 | 本轮状态 | 说明 |
|---|---|---|
| **Node / vitest（纯逻辑）** | ✅ **可用** | 本机实测：`packages/framework` 24 文件 / 226 用例通过；`games/breakout` 7 文件 / 153 用例通过（合计 31 文件 / 379 用例，全绿）。命令为各包内 `./node_modules/.bin/vitest run`。 |
| **浏览器 dev harness** | ⚠️ **暂缺** | `dev/harness/` 为空目录；`package.json` 引用的 `tools/scripts/serve-harness.mjs` 不存在（`tools/scripts/` 仅有 `check-architecture.mjs`）。**需工程补齐后才能执行**。 |
| **微信开发者工具** | ⛔ **不可** | 需要 Cocos 编辑器（用户尚未安装）。`games/breakout/cocos/` 工程本体未创建。 |
| **真机（iOS/Android 微信）** | ⛔ **不可** | 需编辑器构建产物 + 真机预览。 |

> 结论：**本轮可执行的只有 Node/vitest 层**；浏览器 harness 层待工程补齐；开发者工具/真机层需编辑部就绪后补做。所有用例均以此标注适用环境（见图例）。

**命令（各包内执行）**
```bash
# 静态 + 单测（CI 可跑）
cd packages/framework && npm run typecheck && npm test
cd games/breakout   && npm run typecheck && npm test
node tools/scripts/check-architecture.mjs
```
> 注：根目录直接 `npx vitest` 会尝试联网安装 vitest@5 并进入交互确认（在非交互环境挂起），**必须**在 `packages/framework` / `games/breakout` 包内运行。

---

## 1. 测试目标与质量门

**目标**：把"感觉还行"变成"GDD 验收标准逐条通过"，并在无编辑器阶段**最大化可自动化覆盖率**，把无法自动化的部分明确移交真机专项。

**质量门（advisory，最终放行由用户决定）**

| 门 | 定义 | 判定 |
|---|---|---|
| **G1 静态门** | `tsc --noEmit` 两包零错误 + `check-architecture.mjs` 通过 | PASS/FAIL |
| **G2 单测门** | 两包 vitest 全绿；新增系统均有对应 `.test.ts`；物理/计分/状态机有边界断言 | PASS/FAIL |
| **G3 冒烟门** | `smoke-tests.md` 中标注"本轮可执行"的条目全过 | PASS/FAIL |
| **G4 硬判据门** | `test-cases.md §A` 8 组硬判据全部通过（含边界例） | PASS/FAIL |
| **G5 真机门** | 冷启动时长、帧率、触控、机型适配、减弱动效、真机存档（杀进程续进）全部签收 | 待真机环境 |

> **未过 G1~G3 即"未达 QA"，不得进入真机测试**；G4 未过可进入真机但须带缺陷清单。

---

## 2. 测试分层（Test Levels）

| 层 | 名称 | 环境 | 覆盖对象 | 本轮 |
|---|---|---|---|---|
| **L1** | 单元测试 | `[Node]` | 物理（圆-矩形/反弹/子步）、计分与连击公式、砖块命中扣血、存档校验与降级、状态机合法边、几何/AABB、RNG 确定性 | ✅ 可执行 |
| **L2** | 集成测试 | `[Node]` | 状态机端到端流转（READY→PLAYING→…→FINISH/GAME_OVER）、清关与失球同帧优先级、存档写读回环、事件派发契约（`brick:destroyed` / `ball:hitBrick`）、炸弹连锁、道具掉落与计时冻结、暂停冻结 | ✅ 可执行 |
| **L3** | 手动冒烟 | `[Harness]` | 冷启动链路、交互手感、UI 面板显隐、音效/震动、可访问性开关的实际观感 | ⚠️ 待补 harness |
| **L4** | 真机专项 | `[DevTools]`/`[Device]` | 冷启动 ≤1.5s、稳定 60fps（30fps 亦须正确）、触控热区 ≥88×88px、刘海/安全区/胶囊避让、杀进程续进、`onHide/onShow` 自动暂停、减弱动效、存储配额、包体 ≤2000KB | ⛔ 待编辑部 |

---

## 3. 测试范围

### 3.1 测（In Scope）
- S1 核心循环状态机（BOOT/PLAYING/PAUSED/LEVEL_CLEAR/GAME_OVER/FINISH，**无 MENU**）
- S2 输入与操控（挡板跟随、发球、暂停；绝对/相对拖拽）
- S3 挡板与球物理（反弹角度、防穿模子步、最大反弹角、最小竖直分量）
- S4 砖块类型 `N/T/S/B/G` 命中与特殊行为（含炸弹连锁、钢砖免疫）
- S5 计分与连击（阶梯倍率、重置条件、最高分）
- S6 生命与失败重开（失球扣命、GameOver、重玩本关/第 1 关）
- S7 道具（MVP 3 种：expand/multi/life 的掉落、拾取、计时、上限）
- S8 存档与进度（持久化、`currentLevel` 越界降级、版本降级、损坏回退）
- S9 暂停与设置（暂停冻结一切计时、四设置项持久化）
- 可访问性「减弱动效」关停/保留清单
- 关卡数据 `levels-01-05.json` 的加载校验与 5 关布局还原

### 3.2 不测（Out of Scope，本轮）
- 中后期美术替换（demo 全程序化绘制，外来位图 0 KB）
- 联网 / 排行榜 / 广告 / 分享 / 支付（架构预留，非本期）
- 慢放/磁吸/激光等"应有/可选"未实装道具的玩法（仅验"未启用时不出现"）
- 服务端权威与反作弊（无服务端）
- 商业化与审核合规话术（另属发布流程）

---

## 4. 入口 / 退出条件

**入口条件（Entry）**
1. Story/GDD 验收标准就绪（`design/gdd/*.md §8`）。
2. 被测量功能已有可运行实现（或已明确标注"未实现 → 记阻塞"）。
3. 测试环境可复现（固定 seed、固定 `dt` 注入）。
4. `G1 静态门` 通过（否则不进入功能测试）。

**退出条件（Exit）**
1. `G1~G4` 全部 PASS（或 FAIL 项已登记为缺陷并给出严重度）。
2. 本轮可执行用例通过率 **100%**（任何失败须有 Bug 单）。
3. 阻塞项（需真机）已列清单移交，附"编辑器就绪后的执行顺序"。
4. 冒烟报告与证据归档到 `production/qa/`。

**挂起条件（Suspend）**
- 若 §6 的"设计↔实现不同源"未裁定，则 **G4 硬判据无法判定**，本计划整体标记 **CONCERNS** 并挂起 G4。

---

## 5. 机型与基础库版本矩阵（建议）

> 目标：覆盖"低端机帧率 + 刘海安全区 + 微信胶囊避让 + 高屏锚点吸收"三条风险线。

| 维度 | 建议覆盖 | 关注点 | 来源/备注 |
|---|---|---|---|
| 微信基础库 | 当前稳定版**下限**至最新（具体下限待工程/发布侧确认，标 **待澄清**） | API 兼容、`wx.setStorageSync`/`vibrateShort` 可用性 | — |
| iOS | 一台刘海机（如 iPhone 14 系）+ 一台旧机（iOS 15 下限，**待澄清**） | 顶部安全区 `SAFE_TOP_H=120`、胶囊避让 `CAPSULE_AVOID` | `systems-index §3.1` |
| Android | 一台低端机（4 GB 级）+ 一台主流机 | 30fps 下限正确性、GC 抖动 | `core-loop §5` |
| 高屏 / 极窄屏 | 21:9 与 16:9 各一 | 锚点吸收：砖阵贴顶、HUD/挡板贴底 | `systems-index §3.1` |
| 分辨率基准 | 750×1334（设计）、1 设计 px ≈ 0.5 pt | 88px ≈ 44pt 触控目标 | `systems-index §3.1 / §3.7` |

> 机型清单的具体型号由用户/发布侧最终确认；本表给出**覆盖维度**（标 **待澄清** 处不臆造数值）。

---

## 6. ⚠️ 风险登记（风险驱动优先级依据）

> 以下为 QA 在既有产物中核出的**事实性发现**。主理人已于 2026-09-11 逐条裁定（见下"状态"列）。

| # | 发现 | 证据 | 状态 / 裁定 |
|---|---|---|---|
| **Q1** | **设计（GDD）与实现（`games/breakout/src`）不同源**，几乎全部数值不符 | `src/config/tuning.ts` 的 `DEFAULT_TUNING` vs `systems-index §3`：COLS 9↔10、BALL_R 16↔12、ball.speed 560↔480、maxSpeed 1000↔720、paddle.width 160↔140、paddle.y 150↔200、arena 0/750/1334↔30/720/1240、comboStep 4↔3、上限 ×4↔×5 | ✅ **已裁定**：以 GDD `systems-index §3` 为**唯一权威，实现向它对齐**。→ 转 `WXG-T-001` 实现范围 |
| **Q2** | **关卡数据两套** | `src/config/levels.ts`：6 关、字符 `1/2/3/X`、分值 10/25/50 ／ `design/levels/levels-01-05.json`：5 关、`.NTSBG`、分值 100/250/0/150/500 | ✅ **已裁定**：采用设计版 5 关 `.NTSBG`。→ `WXG-T-001` |
| **Q3** | **缺失系统**（GDD 承诺但无实现） | 炸弹连锁 68px、道具、`S/T/G` 语义、多球、`currentLevel` 续进、`reduceMotion`、BOOT；测试关键词命中 `powerup`=0、`bomb`=0、`currentLevel`=0、`reduceMotion`=0 | ✅ **已裁定**：**demo 全做**（5 类砖、道具 6 定义/3 实装、多球、续进、BOOT、减弱动效；连击 `COMBO_STEP=3`/上限 ×5）。→ `WXG-T-001` |
| **Q4** | ~~`levels-spec §3` 表 L3/L5 可破坏 HP 与 JSON 不符~~ | ~~表 44/58 vs 手工实算 46/62~~ | ✅ **已撤回（QA 计数错误）**：脚本校验 `levels-validation.md` 52/52 通过，**表正确（L3=44 / L5=58）**。数据侧无缺陷 |
| **Q5** | "MVP 只启用 N/T" 与关卡实际含 `S/B/G` 冲突；道具同理 | `bricks.md §2.1` vs `levels-01-05.json`；`powerups.md §2.2` vs L3/L4 pool 含 `slow`、L5 含 `sticky` | ✅ **已裁定**：5 类全做；道具只实装 `expand/multi/life`，其余静默忽略不掉落。→ `bricks.md §2.1` 待回写（design-strategist） |
| **Q6** | 存档键名与结构不符 | `save-schema.ts`：`wxgame.breakout.save` + `bestScore/bestCombo/highestLevelIndex/runs/bricksDestroyed/muted` ／ 设计版：`bp.save.v1` + `maxUnlockedLevel/allCleared/currentLevel/bestScore/settings{...}` | ✅ **已裁定**：**键用 `wxgame.breakout.save`**（设计版键名作废）、**字段结构以设计版为准**（含 `currentLevel/allCleared/settings`）。→ `WXG-T-001` |
| **Q7** | 事件名与文档不一致 | `systems-index §4` 规定 `ball:hitBrick`；实现派发 `brick:damaged`，无统一 `ball:lost` 载荷 | 🟡 **待回写**（文档自称"以最终实现为准，需回写"）——低优先，不阻断 |
| **Q8** | 暂停恢复**重置** READY 计时 | `state-machine.ts`：`transition()` 内 `_elapsed=0`；`pause-settings.md §6.2` 要求"从剩余时间继续" | 🟡 **待实现确认**：已列 `TC-PAUSE-03/04`，`WXG-T-001` 需按"保留剩余"实现 |
| **Q9** | harness / 构建脚本缺失 | `dev/harness/` 空；`serve-harness.mjs`、`build-wechat.mjs`、`check-bundle-size.mjs` 不存在 | 🟢 **大部分已收口**（WXG-T-047 更新）：`serve-harness.mjs`/`smoke-harness.mjs` 已就位（`harness:build` + `harness:smoke` 全绿）、`check-bundle-size.mjs` 已补（`pnpm run check:size`，阈值真源 `systems-index §3.8`）。**唯一未收口**：微信构建**结构上不可自动化**（见 `ADR-0009 §3.2` P2 实测推翻）⇒ 真机链路仍需人工点构建，L3 冒烟的人工前置不变 |

### 6.1 优先级排序（风险驱动，裁定后更新）
1. **P0 · 实现对齐**（Q1/Q2/Q3/Q6 → `WXG-T-001`）：一切功能判据依赖于此；**对齐后按 `test-cases.md §C` 最小验证集回归**。
2. **P0 · 硬判据**（G4）：炸弹波及边界、钢砖不灭、存档降级、暂停冻结、连击断连、减弱动效 —— 玩法承重墙。
3. **P1 · 全链路冒烟**（G3）：冷启动→续进→通关/失败→杀进程续进（依赖 Q9 的 harness 与真机）。
4. **P1 · 关卡数据校验**：✅ 已完成（`levels-validation.md` 52/52）。
5. **P2 · 视觉与音效反馈**：多为真机/人工。
6. **P3 · 包体与性能**：需构建产物。

---

## 7. 证据留存要求（Evidence）

| 类型 | 要求 | 归档位置 |
|---|---|---|
| 自动测试 | 每次运行保留 vitest 报告（用例数/通过数/耗时）；回归修复须附新增用例路径 | `production/qa/`（或 CI 产物） |
| 覆盖率 | 保留 `coverage-summary.json`；新增系统覆盖不得低于既有基线（framework 94.45% / breakout 97.2%） | 各包 `coverage/` |
| 冒烟 | 每条冒烟附：环境、构建号/commit、步骤截图或录屏（真机阶段）、PASS/FAIL | `production/qa/` |
| Bug | 每条 Bug 单含：严重度（见 `bug-severity.md`）、环境、前置、复现步骤、预期/实际、证据、`rngSeed`（确定性缺陷必须带 seed） | `production/qa/bugs/` |
| 确定性缺陷 | **必须**附可复现 seed 与固定 `dt` 注入序列 | Bug 单内 |
| 真机 | 附机型/系统版本/微信版本/基础库版本 | `production/qa/` |
| 设计缺口 | 本计划 §6、`test-cases.md` 待澄清项，形成清单交主理人 | 本文件 |

> **确定性铁律**：任何间歇性（flaky）失败**必须先隔离**（标注 `describe.skip` + `TODO`）并登记，不得污染 CI 信号（`control-manifest §11`）。发现的 flaky 模式（如依赖真实时钟/fake timers）按缺陷处理。

---

## 8. 本轮可执行 / 需真机 占比

> 明细见 `test-cases.md` 顶部统计与每条用例的环境标签。裁定后汇总：

| 桶 | 数量 | 占比 | 含义 |
|---|---|---|---|
| **可立即判定** | 13 | 14% | 数据/框架侧：`TC-LEVEL-01..05`、`TC-ARCH-01..03`、`TC-SAVE-01/02/06/07/10` |
| **`blocked-by: WXG-T-001`** | 73 | 78% | 环境具备（Node），依赖 GDD-对齐实现落地后回归 |
| **需 harness / 真机** | 8 | 9% | 纯环境依赖（减弱动效观感、触控热区、画布适配等） |
| 合计 | 94 | 100% | — |

> **注意**：73 条 `blocked-by: WXG-T-001` 是"**环境可执行但依赖实现**"——当前 `games/breakout/src` 是另一套实现，这些用例预计 **FAIL**，须待 Q1/Q2/Q3/Q6 的实现对齐后按 `test-cases.md §C` 最小验证集回归。**这与"环境不可执行（需真机）"是两个不同维度**，是本计划刻意区分的重点。

---

## 9. 变更记录

| 版本 | 日期 | 变更 | 作者 |
|---|---|---|---|
| v1.0 | 2026-09-11 | 初稿：分层/门控/范围/矩阵/风险登记（含 Q1~Q9 发现） | 严守真 |
| v1.1 | 2026-09-11 | 依主理人裁定更新：Q1/Q2/Q3/Q5/Q6 已裁定（GDD 权威、全系统均做）；**Q4 撤回（QA 计数错误，表 44/58 正确，见 `levels-validation.md`）**；§6.1 优先级重排；§8 占比改为"可立即判定 13 / blocked-by WXG-T-001 73 / 需真机 8" | 严守真 |

---

## 附：本次新增/关联产物

| 文件 | 说明 |
|---|---|
| `levels-validation.md` | 关卡数据静态校验报告（52/52 通过），含 Q4 自我更正 |
| `validate-levels.mjs` | 校验器（`node production/qa/validate-levels.mjs`，退出码 0=全过） |
| `test-cases.md §C` | WXG-T-001 落地后的「最小验证集」
