---
name: wxgame-qa-gates
description: 产出游戏 QA 五件套文档（测试计划/硬判据用例/冒烟清单/缺陷分级/Playtest 计划）与测试工程三节（不稳定性/证据评审/长跑）时使用，判据一律从 GDD §8 验收标准导出。当用户要求写测试计划、测试用例、冒烟测试、Bug 分级、Playtest 计划、查 flaky 测试、评审测试证据、做长跑/耐久测试，或提到 QA、test plan、smoke test、bug severity、flaky、soak 时触发。边界：质量门的 PASS/CONCERNS/FAIL 裁定属 wxgame-orchestration，本 skill 只产文档与判据。
---

# wxgame QA 门禁法（风险驱动五件套）

本 skill 属 wxgame 家族（管线顺序、优先级与冲突裁决见 `my-skills/INDEX.md`）；实例见 `production/qa/`。
跨域或全流程请求先交 `wxgame-orchestration`；本 skill 只产 QA 文档与判据，不裁定阶段 PASS/CONCERNS/FAIL。
核心原则：**判据不发明，全部从 `games/<game>/design/gdd/*.md` §8 验收标准导出**；
环境决定范围——先声明本轮哪些测试可执行、哪些被环境阻塞。

## 1. 测试计划（`production/qa/test-plan.md`）

```
## 0. 本轮环境事实（决定"可执行 vs 阻塞"——如无真机/无编辑器，先写明）
## 1. 测试目标与质量门（明确 Go/No-Go 判据）
## 2. 测试分层（CI 静态+单测 / Harness 冒烟 / 真机适配）
## 3. 测试范围（In Scope / Out of Scope）
## 4. 入口 / 退出条件
## 5. 机型与基础库版本矩阵（建议）
## 6. ⚠️ 风险登记（风险驱动优先级：先列风险，再排序，不定虚优先级）
## 7. 证据留存要求（截图/日志/录像，每条 Bug 必附）
## 8. 本轮可执行 / 需真机占比
## 9. 变更记录
```

## 2. 测试用例（`test-cases.md`）——两段式

- **§A 硬判据用例（门控核心）**：每条直接标注来源
  （如"来源 `core-loop.md §5/§8`"），只测冻结常量与验收标准覆盖的判据。
- **§B 其余功能用例**：按系统组织，同样标注 GDD 来源节。
- 图例标注执行环境：`[CI]` `[Harness]` `[Node]` `[Device]`。

## 3. 冒烟测试清单（`smoke-tests.md`）

- **冒烟主链路顺序执行，任一步 FAIL 即停并开 Bug**（SC-01..SC-n 编号）。
- 覆盖：冷启动→零点击进入→核心循环→暂停/继续→重开→过关→失败→
  杀进程重启续进（核心承诺）→存档降级→后台切换。
- 每条标注执行环境与期望结果；末尾附冒烟汇总表。

## 4. 缺陷分级（`bug-severity.md`）

| 级别 | 定义 |
|---|---|
| P0 Blocker | 主链路不可用/崩溃/数据损坏，立即升级决策 |
| P1 Critical | 核心功能错误，无可用绕过 |
| P2 Major | 功能错误但有绕过，或非核心体验受损 |
| P3 Minor | 轻微问题，不影响验收 |
| P4 Trivial | 文案/外观瑕疵 |

**报告模板（每条 Bug 必含）**：`[P?] 一句话标题（现象，不写猜测）` +
复现步骤 / 期望 vs 实际 / 环境 / 证据链接。分级要落到本项目风险登记表对应条目。

## 5. Playtest 计划（`playtest-plan.md`）

- **三轮框架**：① 新玩家首次体验（FTUE）→ ② 中盘与难度曲线 →
  ③ 韧性/中断恢复/可访问性。
- 每轮定义观察框架与**时长判定线**（来源：关卡规格，不拍脑袋）。
- 附单场记录表 + 每轮汇总分析表；判定线汇总写明"什么算通过 / 需调参"。

## 6. 测试不稳定性（flaky）——**外来吸收**（CCGS `test-flakiness`，WXG-T-175）

不稳定测试 = 无代码变更却时绿时红。**它比没测试更糟**：会训练团队忽略红灯。

- **数据源**：`pnpm run test` / `verify` 的多次输出、CI（`.github/workflows/`）日志。
  < 3 次运行结果 ⇒ 结论只能标"suspected"，不得标"confirmed"。
- **阈值**：失败率 >25% ⇒ **立即隔离**；5–25% ⇒ 近期修复；1–5% ⇒ 观察。
- **本仓特因排序**（L4 确定性要求下，随机不是主因）：
  ① 时间依赖（wallClock / 帧数假设）② 顺序依赖（共享 harness 状态）
  ③ 浮点相等比较（应改 epsilon）④ 外部状态（存档 sidecar / 临时文件残留）
  ⑤ 真机与 Node 差异（宿主 API 在 Node 下为 mock）。
- **隔离 = 标注 + 登记，绝不删测试文件**：`it.skip`/`describe.skip` 并写明原因与修复方向，
  登记到 `production/qa/` 的隔离清单；修完根因才解除。
- 输出：`production/qa/flakiness-report-<日期>.md`（可选，需用户同意才写）。

## 7. 测试证据评审（evidence review）——**外来吸收**（CCGS `test-evidence-review`，WXG-T-175）

冒烟只验"存在且通过"，本节验**质量**：存在且绿的测试仍可能什么都没覆盖。

- **断言密度**：每测试函数 ≥3 断言为正常；1–2 为"偏薄"；**0 断言 = BLOCKING**（空过）。
- **边界覆盖**：Grep 测试文件是否触及 `zero/max/empty/null/boundary` 与 GDD §7 公式的极值。
- **命名**：`test_<场景>_<预期结果>`；`test_1`、`test_run` 之类记入命名问题。
- **判据可追溯**：测试须能对应到 `S<n>§8-<k>`；否则视为未覆盖。
- **人工证据（Visual/Feel / UI）**：证据文档须逐条对应验收标准 + 有截图/走查 + 有签署；
  截图可用 `pnpm run preview:frames:beads`（SVG 帧）或 `cocos-vision-shot`（真机截图）。
- **判定**：`ADEQUATE` / `INCOMPLETE` / `MISSING`；整体取最差。
  与 `wxgame-story-gate done` 联动：**>50% 判据 UNTESTED ⇒ BLOCKING**。
- 输出：`production/qa/evidence-review-<日期>.md`（可选）。

## 8. 长跑 / 耐久测试（soak）——**外来吸收**（CCGS `soak-test`，WXG-T-175）

长跑是**人跑的**：本 skill 只出协议文档，不自动执行。

- **时长按本仓单局量级定**（beads 一关 60s 级，非 RPG）：`30m`（单机制）/ `1h`（标准，推荐首次）/ `2h`（发布前）。
  焦点：`memory` / `stability` / `balance` / `all`。
- **微信宿主特化**（替换原版 Godot/Unity/Unreal 内存段）：
  - 内存：开发者工具 Memory 面板 + `wx.onMemoryWarning`（真机告警必记录）。
  - 帧率：`pnpm run preview:frames` 与真机各记一次；帧时间漂移 > 20% 记关注。
  - **本仓核心承诺必测**：杀进程重启续进、后台切换、存档降级（见 §3 冒烟主链路）。
  - 音频：iOS 长跑后 SFX 是否失声（历史缺陷 BD-51 复发面）。
- **检查点**：`1h` ⇒ T+0/15/30/45/60；每点记内存、帧率、崩溃/卡死、HUD、输入、主观疲劳。
- **分析**：内存趋势（是否单调增长 = 泄漏）、稳定性汇总、**乐趣疲劳与内容枯竭点**。
- **判定**：PASS / PASS WITH CONCERNS / FAIL（FAIL = 确认泄漏、稳定性破线或严重疲劳）。
- 输出：`production/qa/soak-test-<日期>-<时长>.md`（需用户同意才写）。

## 门编号（G1–G4，定义与源文档 `test-plan.md` 门控表一致）

| 门 | 判据 | 判定 |
|---|---|---|
| G1 静态门 | 类型检查零错误 + 架构守卫通过 | PASS/FAIL |
| G2 单测门 | 全部单测绿；新增系统均有对应测试；物理/计分/状态机有边界断言 | PASS/FAIL |
| G3 冒烟门 | 冒烟清单中标注"本轮可执行"的条目全过 | PASS/FAIL |
| G4 硬判据门 | 硬判据用例（§A）全部通过（含边界例） | PASS/FAIL |

纪律：**未过 G1–G3 即"未达 QA"，不得进入真机测试**；G4 未过可进真机但须带缺陷清单。

## 门禁纪律

- G4 门控以 §A 硬判据用例全绿为必要条件。
- 环境阻塞的测试要显式登记"阻塞原因 + 解除条件"，不许静默跳过。
- 实例参照：`production/qa/`（test-plan / test-cases / smoke-tests /
  bug-severity / playtest-plan / levels-validation）。
