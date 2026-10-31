# 领域决策模型标定报告 · decision-model-preview

- 任务背景：用户 2026-10-31 接入阿里云 **Token Plan**，要求把可用能力集成进 skill，
  **着重看领域模型如何接进本系统**。本报告是那一轮的实测产物。
- 被测：`decision-model-preview`（协议 TypeSafe System One，`POST {BASE}/systemone`）
- 入口脚本：`tools/scripts/decision-model.py`（`--check` 离线自检已过）
- 用例真源：`production/qa/bug-severity.md` 的 P0–P4 定义与**逐级真实场景**（该文档自注
  「所有示例均为本项目真实场景」⇒ 期望值直接取文档已裁定的级别，非人为编造）
- 用例文件：`production/qa/decision-model-cases.jsonl`（18 条 × 3 问题，C 版口径）

## 1. 为什么是它 · 三条实测性质

| 性质 | 实测值 | 对接线的意义 |
|---|---|---|
| **不生成文本** | `input_tokens` 262–275，零输出 token | 延迟与输出长度无关 ⇒ 可高频调 |
| **快** | 服务端 46–75 ms；18 条整轮墙钟 < 4 s | 当"预分类粗筛"完全不卡手 |
| **限时免费** | 本轮零计费（套餐 Credits 计量，非按量付费） | 可放开批量标定 |

一次前向同时出三类判定：`choice`（多选一）、`noul`（是否 + P(yes)）、`score`（有序量表的
概率加权等级索引）。**这就是它与聊天模型的全部区别** —— 它是结构化决策器，不是对话端点。

## 2. 三版对照（同一问题表，只改输入口径）

| 版 | state 口径 | `owner` choice | `severity` score | `blocks_release` noul |
|---|---|---|---|---|
| A | 仅缺陷标题；选项**带 `other` 兜底** | **9/18**（9 条被吸进 `other`） | 10/18，MAE 1.25 档 | 10/18（`true` 侧 0/5 全错） |
| B | 同 A，**去掉 `other`** | **18/18** | 同上 | 同上 |
| C | **标题 + 后果**；无 `other` | 17/18，判定可分 | 11/18，MAE **1.00 档** | 15/18，仍不可分 |

## 3. 三条硬结论（均已 ≥2 版复现）

1. **`choice` 补 `other` 兜底项会把样本吸走** —— A→B 唯一变量就是有没有 `other`，命中从
   9/18 跳到 18/18。**这与官方文档「建议给全量选项并补 `other` 兜底」直接冲突**。
   裁定：选项本身是**穷举分类**时不补 `other`；只在"确实存在类外情况"时补，且补完必须重标。
2. **`score` 返回概率加权等级索引（浮点，实测如 `3.75`），不是整数** —— 首轮拿字符串与
   标注比，报出假的 `0/18 全错`。正确口径是最近邻取整，且**有序量表应看 MAE 而非命中率**
   （差一档算错太窄）。判据写进了 `pick()` 与 `--check`。
3. **`confidence` 与正确性脱钩** —— C 版 `severity` 错样的最高置信达 **0.94**，
   而 `blocks_release` 错样 0.89。⇒ **不得把置信度阈值当自动放行依据**。文档警示的
   「阈值要用自有样本标定」在这里是更弱的表述：本场景**标定不出可分离的阈值**。

## 4. 接线裁定（本报告只给结论，不擅自改分级真源）

| 落点 | 接法 | 依据 |
|---|---|---|
| **QA 缺陷归口**（`owner`） | ✅ **可接**：模型给建议归口，人可改；命中率 17/18、可分阈值 0.51 | §2 C 版 |
| **缺陷分级**（P0–P4） | ⚠ **只当预分类提示**：MAE 1.00 档 ⇒ 它给的级别必须人复核一档；**`bug-severity.md` 的裁定权不外包** | §3 判据 3 |
| **是否阻断发布** | ⛔ **不接**：`true` 侧在 A/B 版 0/5 全错，C 版仍不可分；漏判 P0 的代价不可逆 | §2 |
| **游戏运行时 DDA** | ⛔ **不接**（见 §5） | — |

## 5. 为什么不进游戏运行时（四条，任一即否）

1. **`state` 只吃文本/结构化对象，不吃图** —— 「看一张出图判版面」要先由视觉模型
   （`qwen3.8-max`）转文字描述，那是另一条另算钱的腿。
2. 玩家侧网络依赖 + 套餐配额共享（同一 key 被运行时消耗，开发管线会饿死）。
3. 玩家行为数据上报 = 隐私与微信审核面。
4. weapp 需 request 域名白名单；且违反本仓「玩法与框架 core 引擎无关、可纯 Node 单测」的
   既有取向（`AGENTS.md` §1、铁律 L2/L3 精神）。

⇒ 定位：**开发管线离线判定**。运行时若要做 DDA，仍走 `tuning` 里的确定性规则。

## 6. 复现命令

```bash
python3 tools/scripts/decision-model.py --check                              # 离线自检，不联网
python3 tools/scripts/decision-model.py \
  --cases production/qa/decision-model-cases.jsonl \
  --questions production/qa/decision-model-questions.json     # C 版（当前口径）
```

A/B 版由 C 版派生：A＝往 `owner.criteria` 加回 `"other": "以上都不是"`；
B＝state 只留 `现象` 字段（删 `后果`）。改过 `pick/advice/report` 必重跑 `--check`。

## 7. 家底（本轮 Token Plan 实测汇总）

在册 21 个模型（`GET {BASE}/models`）。**与按量付费通路的 key / base_url 完全隔离，
混用会 401 或走错计费通道。** 图／音的实测细节见
`games/beads/design/ai-workflows/backend-token-plan.md`；视频与 ASR **未实跑**。
