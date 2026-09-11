---
name: wxgame-adr-arch
description: 做游戏项目技术架构决策与架构文档时使用。当用户要求写 ADR、架构决策记录、引擎选型、技术架构文档、控制清单，或提到 ADR、architecture、引擎对比、架构评审时触发。产出「主架构文档 + ADR（五节结构）+ 控制清单」三件套，负面后果必须诚实记录。
---

# wxgame 架构决策法（ADR 三件套）

本 skill 属 wxgame 家族（管线顺序、优先级与冲突裁决见 `my-skills/INDEX.md`）；实例见文末「实例参照」。
跨域或全流程请求先交 `wxgame-orchestration`；本 skill 只处理单域交付物。

## 1. ADR 模板（`docs/architecture/adr/ADR-<编号>-<主题>.md`）

```
# ADR-<编号> — <一句话主题>
## 1. 上下文（Context）——为什么现在要做这个决策，约束是什么
## 2. 备选方案（Alternatives）
   方案 A..N：每个含事实性对比（版本/许可/能力/成本），不预设立场
## 3. 决定（Decision）——选了什么，一句话
## 4. 后果（Consequences）
   4.1 正面
   4.2 负面（必须诚实记录——这些是【已知成本】，不是风险）
   4.3 中性 / 待观察
## 5. 复评触发条件（Review Triggers）——什么情况出现时重新评估本决策
```

> 阶段 3 交付纪律：基础层 ADR **不少于 3 条**（对齐 `wxgame-orchestration` 九阶段表阶段 3 的交付要求）。

**写法纪律**：
- 编号递增（0001、0002…），编号只分配不回收，废弃的 ADR 标注 Superseded。
- 备选方案要真实对比过（版本号、发布日期等写具体），不写"稻草人"选项。
- §4.2 负面后果是本模板的灵魂：选型的已知代价必须白纸黑字，
  禁止把成本包装成"风险"或省略。
- §5 复评触发条件让决策可演化（如"上游 X 发布 Y 后复评"）。

## 2. 主架构文档（`docs/architecture/architecture.md`）

- 分层总览（core / adapters / 平台绑定）、目录结构约定、
  数据流、依赖规则（如 core 禁止依赖 DOM/引擎/平台 API）。
- 每个关键决策链接到对应 ADR，不重复论述。

## 3. 控制清单（`control-manifest.md`）

- 列出"哪些事被哪个 ADR/规则控制"：禁做清单、必须走的流程、
  产物与检查点（如引擎绑定不进框架 barrel、.meta 必须由编辑器生成等）。
- 程序/评审时按此清单核对，作为 CI 守卫脚本的依据来源。

## 实例参照

`docs/architecture/`（architecture.md、control-manifest.md、
adr/ADR-0001 引擎选型、ADR-0002 框架引擎解耦、ADR-0003 空场景代码驱动）。
