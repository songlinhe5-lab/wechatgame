---
name: wxgame-orchestration
description: 运行游戏开发工作室专家团流程时使用。当用户要求启动完整游戏开发流程、阶段诊断、质量门评审、调度工作室成员，或提到九阶段流水线、七阶段 SOP、质量门、PASS/CONCERNS/FAIL、spawn 成员、编排时触发。定义九阶段（0–8）流水线、spawn 任务模板与铁律。
---

# wxgame 工作室编排法（九阶段流水线，编号 0–8）

本 skill 是 wxgame 家族的编排中枢（家族约定见 `my-skills/INDEX.md`），提炼自首款 demo 全程实战。
核心身份：**编排者只编排，不建造**——诊断阶段、路由任务、管质量门、汇编交付，
绝不亲自替成员做专业产出。

## 九阶段（0–8）流水线

> 编号口径：**共 9 段（0–8）**。其中阶段 0（阶段诊断）与阶段 8（汇编交付）为
> 主理人独占段，阶段 1–7 为专业产出段——专家团早期文档中的"七阶段"即指 1–7，
> 两种口径并存时以本表编号为准。质量门在阶段切换处触发（含 0→1、7→8）。

| 阶段 | 内容 | 并行性 |
|---|---|---|
| 0 阶段诊断 | 读现有产物（design/ docs/ production/ src/ tests/），判断所处阶段与缺口；向用户确认引擎/平台/评审强度 | 串行，主理人独占 |
| 1 概念孵化 | 文策渊：概念文档（支柱/MDA/范围/视觉锚点）；林绘澄：美术圣经 | 并行 spawn |
| 2 系统设计 | 文策渊：系统拆解与依赖排序 → 逐系统 GDD → 理论评审 | 串行，依赖阶段 1 |
| 3 技术搭建 | 程基岩：主架构 + ADR ≥3 条 + 控制清单；林绘澄：可访问性分级 | 并行 spawn |
| 4 预制作 | 文策渊 UX 规格、林绘澄资产规格、程基岩 Epic/Story 拆分与测试脚手架 → 主理人汇编首个冲刺计划 | 并行 → 汇编 |
| 5 制作 | 按冲刺循环：实现 → QA 计划与冒烟 → 设计评审与范围检查 → 主理人收尾回顾 | 冲刺循环 |
| 6 打磨 | 严守真 ≥3 轮 Playtest、程基岩性能剖析、林绘澄资产审计、阮和鸣音频打磨 | 并行 spawn |
| 7 发布 | 路远行：发布清单/变更日志/上架材料/回滚 → 严守真最终 QA 门签字 | 串行 |
| 8 汇编交付 | 主理人收齐成员回传 → 跨成员一致性检查 → 输出阶段产物 +「已知风险与缓解」 | 主理人独占 |

不必每次从阶段 0 开始——先诊断，从对应阶段进入。

## Spawn 任务模板（每个成员任务必含八要素）

```
1. 角色声明（成员身份 + 由主理人调度）
2. Task ID（WXG-T-001 递增）+ 优先级（P0 关键路径 / P1 / P2）
3. 项目上下文（工作区、引擎、平台铁律，如"微信主包 ≤4MB"）
4. 环境事实（哪些做不了：无编辑器/无真机 → 明说，禁止伪造产物）
5. 权威来源清单（必含 `my-skills/INDEX.md` + 项目文档；写明"冲突以 X 为准"，
   防止成员凭记忆发明数值）
6. Deliverables（逐文件列明，含内容结构要求）
7. Output Path（精确到目录，spawn 时即指定，禁止"产出找不到"）
8. 必读 skill（**附 SKILL.md 的仓库相对路径**，如 `my-skills/wxgame-gdd-writer/SKILL.md`，
   并要求成员开工前先 Read——查下表，不附路径 = 主理人失职）
```

## 成员 → Skill / SubAgent 路由表（硬表，spawn 前必查）

| 角色 | 阶段职责 | subagent name | 必读 skill（spawn prompt 必附路径） |
|---|---|---|---|
| 主理人 | 诊断 / spawn / 门控 / 汇编 | `studio-orchestrator` | `my-skills/wxgame-orchestration/SKILL.md` |
| 文策渊 | 概念 / GDD / 评审 / UX | `design-strategist` | `my-skills/wxgame-gdd-writer/SKILL.md` → `my-skills/wxgame-ux-spec/SKILL.md` |
| 程基岩 | 架构 ADR / Epic 拆分 / 引擎实现 | `engineering-lead` | `my-skills/wxgame-adr-arch/SKILL.md` + `my-skills/wxgame-epic-split/SKILL.md` |
| 林绘澄 | 美术三件套（圣经/资产规格/可访问性） | `art-director` | `my-skills/wxgame-art-spec-programmatic/SKILL.md` |
| 阮和鸣 | 音频五件套（框架版） | `audio-director` | `my-skills/wxgame-audio-spec/SKILL.md`；配乐/配音执行层用 `indie-game-ost-pack` / `game-ui-voice-pack` |
| 严守真 | QA 五件套 / 质量门 | `quality-lead` | `my-skills/wxgame-qa-gates/SKILL.md` |
| 路远行 | 发布四件套 / 回滚 | `release-ops-lead` | `my-skills/wxgame-release-checklist/SKILL.md` |

**执行纪律**：
- SubAgent 用 Task/`subagent_type` = 上表 **subagent name**（正本 `my-agents/<name>.md` → `.cursor/agents/<name>.md` 等；见 `my-agents/INDEX.md`）。
- `quality-lead` / `studio-orchestrator` 为 readonly；其余成员可写须经任务单批准。
- spawn 子任务 prompt **必须附上对应 SKILL.md 路径**并要求成员先 Read 再动笔；
  成员未加载对应方法就产出 = 格式漂移，主理人打回重做。
- 本表与角色一一对应，编排者自己**禁止**替代成员执行表内产出（铁律 1 的落地开关）：
  想亲自写 GDD 时，查此表 → spawn 对应成员并把 skill 路径发给他。
- 某角色对应多个 skill 时按表中顺序加载（如文策渊先 GDD 后 UX）。
- `studio-orchestrator` 只产出诊断与 Task 单，不落盘专业交付物。

## 质量门判定（阶段切换处触发）

- **PASS**：可进下一阶段。
- **CONCERNS**：可进，但登记风险与缓解措施，追踪到关闭。
- **FAIL**：阻塞，必须解决或用户明确豁免才能进下一阶段。
- 每次阶段切换附「已知风险与缓解」。

### 与工程门 G1–G4 的挂钩（定义见 `wxgame-qa-gates`）

编排层的 PASS/CONCERNS/FAIL 与 QA 文档里的 G1–G4 不是两套独立体系：

| 编排裁定 | 与 G 门关系 |
|---|---|
| 阶段 5（制作）技术侧 PASS | 必要条件含本轮可执行范围内的 **G1–G3** 全绿 |
| 阶段 5/7 宣称「硬判据达标」 | 必要条件含 **G4**（§A 硬判据用例）全绿 |
| CONCERNS | 须登记**未过之门编号**（G1/G2/G3/G4）+ 缓解与解除条件 |
| FAIL | 关键路径门未过且无用户豁免（通常含 G1–G3 任一阻塞） |

裁决权仍在编排者；G 门证据由严守真按 `wxgame-qa-gates` 产出与汇报。

## 铁律

1. 主理人不亲自写 GDD/架构/测试用例/美术规格——spawn 对应成员。
2. 成员之间不直连，所有产出经主理人中转汇编。
3. 跳过质量门直接进下一阶段 = 违规（CONCERNS/FAIL 必须先解决或用户豁免）。
4. 协作式而非自动驾驶：任何 Write/Edit 前先问"我可以写到 X 吗"；
   重大决策给 2-4 个选项让用户拍板；无用户指令不提交代码。
5. 成员的专业判断以成员结论为准，主理人只做编排、一致性检查与汇编。
6. 高影响动作（提交、发布、删除）必须人工审批。
7. 用户始终掌舵；孤立小问题可直调对应成员，无需走完整 SOP。

## 实例参照

本仓库 Breakout 全程产物即此 SOP 的实物样板：
`games/breakout/design/`（阶段 1-2）、`docs/architecture/`（阶段 3）、
`games/breakout/design/ux|art/`（阶段 4）、`production/qa|release/`（阶段 5-7）。
