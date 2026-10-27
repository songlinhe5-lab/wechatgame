---
name: wxgame-arch-review
description: 定期 review 小游戏架构是否跑偏（ADR、控制清单、铁律与依赖/目录现状比对）。触发：架构 review、架构漂移、控制清单核对、ADR 覆盖审计、防跑偏。写 ADR 走 wxgame-adr-arch。
---

# wxgame 架构定期 review（控制清单核对，只读）

本 skill 属 wxgame 家族（管线顺序、优先级与冲突裁决见 `my-skills/INDEX.md`）。
跨域或全流程请求先交 `wxgame-orchestration`；本 skill 只出评审报告，**不改 ADR、不改架构文档、不改代码**
（新增或修改 ADR 走 `wxgame-adr-arch`，铁律破坏另开施工单）。

核心原则：**每条架构规则都要有对应的机械守卫或明确的人工核对项**；没有守卫的规则只是纸面规则。

## 0. 什么时候跑（触发节奏）

- 新增依赖 / 新建包 / 新增平台适配层后
- 某个 ADR 从 Proposed 转 Accepted 之前
- 月度体检 / 里程碑收口
- 用户说「review 架构」「防止跑偏」「查架构漂移」

## 1. 输入（只读）

| 层 | 真源 |
|---|---|
| 控制清单 | `docs/architecture/control-manifest.md` |
| 主架构 | `docs/architecture/architecture.md` |
| 决策 | `docs/architecture/adr/*.md`（含 §5 复评触发条件） |
| 铁律 | `AGENTS.md` §3（L1–L5、热路径零分配、数据驱动、Cocos bindings 不进 barrel） |
| 现状 | `packages/framework/src/**`、`adapters/**`、`games/*/src/**`、`games/*/cocos/**` |

## 2. 审计步骤（顺序执行）

1. **规则清单化**：把 `control-manifest.md` 与 L1–L5 逐条抄成核对表（规则 / 来源 ADR / 守卫脚本）。
2. **先跑机械门禁**（只记录，不修）：`pnpm run check:arch`、`framework:sync:check`、`cocos:check`、
   `check:es5spread`、`check:frozen-values`（§3 冻结值 ⇔ 落码 ⇔ 下游文档，WXG-T-456）、`typecheck`；记录退出码与关键输出。
3. **依赖方向**：`core/**` 是否出现 `cc` / DOM / `wx` / `window` / `document`（L2）；
   `games/*/src` 是否 `import 'cc'`（L3）；`adapters/cocos/bindings.ts` 是否漏进框架 barrel、是否被 harness 直接编译。
4. **状态与渲染**：UI/渲染是否持有游戏状态；`buildRenderModel()` 是否只读；`update` / `step` /
   `buildRenderModel` 是否在热路径 `new` / `map` / `filter` 造集合（L5 与零分配）。
5. **随机与数据驱动**：是否出现 `Math.random()`（L4）；玩法魔法数字是否进 `tuning` / 关卡 JSON；
   颜色是否进 `palette.ts`。
6. **场景资产**：是否有手工改过的 `.scene` / `.prefab` / `.meta`（L1）；场景是否只剩 `GameRoot` + `Bootstrap`。
7. **ADR 覆盖**：代码里新出现的架构决策（新依赖、新抽象、新适配层、新包）是否有 ADR；
   ADR §5 的复评触发条件是否已被触发；Superseded 是否双向回链。
8. **文档一致性**：`architecture.md` 的分层、目录、数据流描述与现状是否一致；
   控制清单里每条规则是否真的有 CI 守卫或人工核对项（无守卫 = 记为纸上规则）。
9. **重复与废弃抽象**：同名双实现、跨包复制的代码、已废弃但仍在用的接口；
   `framework:sync:check` 报镜像不一致时视为 P1。
10. **边界与包体**：主包 / 分包归属是否越界（`check:size`）；vendor 或编辑器产物是否被运行时代码引用；
    Cocos 镜像目录与正本是否一一对应。

## 3. 漂移表（报告主体）

| # | 规则 / 决策 | 文档要求 | 现状证据 `file:line` | 级别 | 建议与归属 |
|---|---|---|---|---|---|

- 级别：P0 = 铁律破坏或可导致线上事故（L1–L5、bindings 越界）；P1 = 架构方向偏离、ADR 缺失、
  镜像不一致；P2 = 文档陈旧、命名不一致、死代码
- 级别不写「待定」：判不了就降级并写清缺什么证据

## 4. 结论与报告落位

- 结论三选一：PASS（0 个 P0/P1）/ CONCERNS（有 P1 但有明确修复计划）/ FAIL（有 P0，或 P1 无计划）。
  阶段裁决权在 `wxgame-orchestration`，本 skill 只给建议结论。
- 报告默认写 `docs/architecture/reviews/arch-review-YYYY-MM-DD.md`；**写前先与用户确认路径**
  （`AGENTS.md` 先问再写），并沿用上次 review 的路径保持可比。
- 报告必含：基线 commit、跑过的命令表（命令 / 退出码 / 关键输出）、漂移表、ADR 缺口清单、
  0–3 条沉淀候选。
- 修复纪律：新增或修改 ADR 走 `wxgame-adr-arch`；铁律破坏先开 P0 施工单，不在 review 里顺手改。

## 5. 纪律

- 只读：不擅自改 ADR、架构文档或代码。
- 每条结论必须可执行：给 `file:line`、级别、建议归属。
- 同一个漂移连续两轮未修：升级为 P0，并在 `production/TASKS.md` 登记，避免"记录即遗忘"。
- 收尾跑 `kb:sync --task=<任务号>`，把新增 / 修改 / 激活 / 归档统计摘进会话结论。
