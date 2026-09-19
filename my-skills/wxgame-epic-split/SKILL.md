---
name: wxgame-epic-split
description: 做游戏 Epic/Story 拆分、冲刺规划，以及**单个 Story 的实现与验收**时使用。当用户要求拆分任务、排冲刺、拆 Story、Epic 划分、垂直切片、最小可玩版本规划、开发某个 story、验收或关闭 story，或提到 epic、story、sprint、垂直切片、story ready/done 时触发。产出按依赖拓扑序的 Epic 列表 + Story 四要素拆分 + 第一冲刺建议，验收标准只准引用 GDD §8；并覆盖 Story 生命周期后半段（开工门禁 / 实现 / 收工验收）。
---

# wxgame Epic/Story 拆分法（拓扑序 + 引用式验收）

本 skill 属 wxgame 家族（见 `my-skills/INDEX.md`）；实例：`production/epics/epics-breakout.md`（10 Epic / 40 Story）。
跨域或全流程请求先交 `wxgame-orchestration`；本 skill 只处理单域交付物。
核心纪律：**Epic 顺序由依赖决定，验收标准由设计决定，拆分者不发明任何判据。**

## 1. 前置输入（缺一不拆）

1. `games/<game>/design/gdd/systems-index.md` —— **§2 依赖拓扑序**（Epic 顺序唯一依据）、§3 冻结常量
2. 各系统 GDD 的 **§1 目标、§7 依赖、§8 验收标准**（Story 验收的唯一来源）
3. `docs/architecture/`（架构 + ADR）—— Story 技术边界（哪些由框架承担，避免重复建设）
4. 框架现有能力清单 —— Story 只拆"增量"，不拆"框架已有"

## 2. 文档结构（六段固定，编号 0–5）

```
# <游戏> · Epic / Story 拆分
## 0. 阅读约定（拆分纪律：引用格式、估点定义、阻塞标注）
## 1. Epic 列表（按 §2 拓扑序，EP-01..EP-n）
## 2. Story 拆分（每 Epic 一节）
## 3. 第一个冲刺建议（最小可玩垂直切片）
## 4. 环境约束声明（无编辑器/无真机 → 标注阻塞）
## 5. 统计（Epic 数 / Story 数 / 各估点分布）
```

## 3. Epic 层规则

- **一 Epic 对应一/一组强内聚系统**（如 EP-02 挡板与球物理 ← S3），
  编号即拓扑序，依赖关系显式标注（"依赖 EP-01"）。
- 允许一个"工程交付"Epic 收拢非玩法任务（如引擎集成、构建、真机验证），
  并整体标注 `[Blocked: 待编辑器]` 之类的环境阻塞。
- 每个 Epic 一句话目标 + 覆盖的系统编号（S1..Sn）。

## 4. Story 层四要素（每个 Story 必含）

1. **一句话描述**：可独立实现、可独立验证。
2. **验收标准**：**只准引用 GDD §8 条目**，统一编号约定
   `S<n>§8-<k>`（§8 复选框自上而下第 k 条）；禁止发明新判据。
3. **估点**：S / M / L 三档（不要精确人时）。
4. **依赖**：依赖的 Story 编号 + 复用的框架能力。

## 5. 第一冲刺 = 最小可玩垂直切片

- 选 Story 的标准：走通**核心循环全链路**（如进 PLAYING → 操控 →
  碰撞 → 得分），且**全部不依赖被阻塞的工具**（可在 Node/vitest 验证）。
- 列出入选 Story 清单 + 入选理由；排除的 Story 不删，留给后续冲刺。

## 6. 环境约束声明

- 声明本轮环境限制（无 Cocos 编辑器 / 无真机等）。
- 凡依赖编辑器产物（.scene/.prefab/.meta、真机构建）的 Story 显式标注
  `[Blocked: 待编辑器]`，验收改为引用冻结常量核对单——**不得伪造产物**。

## 7. Story 生命周期后半段 · 实现（原 `wxgame-story-dev`，WXG-T-175 并入）

> 来源：Claude Code Game Studios `dev-story`（MIT）吸收改写。

### 7.1 找 Story（**本仓载体形态，与上游假设不同**）

⚠️ 本仓**不是一个 Story 一个文件**：Story = `production/epics/epics-<game>.md` 中
`### EP-<nn>` 章节下的加粗条目（编号 `EP<nn>-S<k>`），字段为行内列表
（描述 / 验收 / 复用框架 / 依赖 + 估点）；**状态以 `production/epics/epics-<game>-status.md`
对账为准**（正本内标记可能已过期，该文件明确声明）。

### 7.2 装载上下文（缺一即 STOP，不许边猜边写）

| 上下文 | 路径 | 缺失处置 |
|---|---|---|
| Story 条目 | `production/epics/epics-<game>.md` | 停；转本 skill §2 重拆 |
| 验收真源 | `games/<game>/design/gdd/<system>.md` **§8**（`S<n>§8-<k>`） | **STOP** —— 无 §8 即无判据 |
| governing ADR | `docs/architecture/adr/ADR-00NN-*.md` | **STOP** → `wxgame-adr-arch` |
| 控制清单 | `docs/architecture/control-manifest.md` | WARN 后继续（层规则无法核对） |

装载后核对三条：① 以 §8 **当前文本**为准，**不采信 Story 内嵌旧引用** ——
  ⚠️ 2026-09-19 实跑验证（`EP01-S3`）命中两处：Story 写「不供料 / 零 `tray:spawned`」，
  而 `core-loop §8-7` 现文本已是「零取回零归位」、`tray-spawner §8-8` 原文已标「随供料作废」
  ⇒ **必须回读 GDD 现文本，Story 内嵌引用只能当线索**；
② **控制清单版本漂移** → 三选项（更新并按现行规则 / 按旧规则+留痕 / 停下看 diff）。
  ⚠️ **本仓现状 = 跳过**：`control-manifest.md` **无版本字段**（实跑确认），本项暂不可判定；
  若日后为控制清单加 `版本:` 头，则本项自动生效（事件登记到 `systems-index §6`）；
③ **依赖门禁**：被依赖 Story 未完成 → 三选项（冒险继续并记 Deviations / 停下置 BLOCKED / 补标后继续）。

### 7.3 实现与测试证据

- 派工：`engineering-lead`（实现）/ `quality-lead`（测试）；**禁止派引擎专家**
  （本仓引擎唯一 = Cocos Creator + 微信小游戏）。
- 铁律：L1–L5（尤其 **L4 禁 `Math.random()`**）、热路径零分配、数值一律来自 `tuning.ts`。
- `Out of Scope` 是契约：越界文件一律停下问用户。
- 测试证据：Logic / Integration **必须**有 `games/<game>/tests/<name>.test.ts` 且通过（**BLOCKING**）；
  Visual/Feel · UI 需 `production/qa/evidence/<slug>-evidence.md`（ADVISORY，含截图 + 签署）。

## 8. Story 门禁 · ready / done（原 `wxgame-story-gate`，WXG-T-175 并入）

- **`ready`（只读，不改文件）**：§8 具体条目引用 / 验收自包含 / 可测无主观 / ADR 引用存在 /
  估点存在 / In-Out of Scope 边界 / 依赖非 DRAFT / 无 TBD·? / 类型可判定 / 证据落点可定位 /
  条数门槛（Logic·Integration ≥3，Visual·UI ≥2，Config/Data ≥1）。判定 READY / NEEDS WORK / BLOCKED。
  **本仓适配（实跑确认，勿按上游口径硬判）**：
  - **ADR 状态**：本仓 ADR **无 `Status:` 字段**（格式为 `# ADR-NNNN — 标题` + `## 1. 上下文…`）
    ⇒ 改为「ADR 文件**存在** + 正文无 `Proposed` 级未决声明」；上游「必须 Accepted」口径不适用。
  - **控制清单版本**：本仓无版本字段 ⇒ **本项 N/A**（见 §7.2 ②）。
  - **类型**：本仓 Story 无 `Type:` 字段 ⇒ 按验收条目性质**推断**并写明依据。
  - **证据落点**：本仓无 `## Test Evidence` 段 ⇒ 改为指出应落哪个
    `games/<game>/tests/<name>.test.ts`（扁平目录，无 unit/integration 分层）。
  - **Out of Scope**：本仓 Story 条目**普遍未写**该字段 ⇒ 缺失时标 NEEDS WORK 但**不阻断**
    （建议后续补一行），不得据此判 BLOCKED。
- **`done`（验收关闭）**：逐条验收（自动 / 人工 / `DEFERRED — 需真机 playtest`）
  + **测试↔判据追溯表**；**>50% 判据 UNTESTED ⇒ BLOCKING**；偏差检查（§8 现文本 /
  控制清单版本 / ADR 禁令 / 硬编码 / 越界）分 BLOCKING·ADVISORY·OUT OF SCOPE；
  先出完工报告 → **须用户同意**才写状态（写 `epics-<game>-status.md`，同步 `production/sprints/`）。

## 后续衔接

- 本文档是冲刺计划的输入：可据此直接生成 `production/sprints/sprint-01.md`。
- QA 据此对 Story 写 §A 硬判据用例（配合 wxgame-qa-gates）。
- Story 实现与验收走 §7 / §8；数值体检走 `wxgame-gdd-writer` §5。
