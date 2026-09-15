# lessons · `cross-ide` 分片（标签 `跨IDE`）

> 由 `knowledge/lessons.md`（WXG-T-111 按行内标签分片）逐字节搬运而来；本片条目**按 ID 升序**。
> 引用一律写 **K-0NN**（可附任务号），不写路径：ID → 分片见 `knowledge/INDEX.md` 活跃表「分片」列。
> 本片同受 ctx B 门（8000 tok）约束，**不设豁免**；越阈 ⇒ 该标签内部按子标签再切。

## 跨IDE

- **[跨IDE][K-007] Qoder 把 `model: inherit` 当具体模型 ID 解析**（来源 commit 2665d10，2026-09-11）
  现象：Qoder 侧 spawn SubAgent 返回 code=40506 model not found，成员未启动。
  根因：Qoder 不支持 Cursor/CodeBuddy 的 `model: inherit` 方言，解析为模型名去查询。
  规避：my-agents 正本 frontmatter **省略 model 字段**（Cursor/CodeBuddy 省略即 inherit，三平台语义一致）；跨 IDE 方言字段只在实测确认后加入正本。

- **[跨IDE][K-008] 跨 IDE 并行会话会撞任务号与 §6 版本号**（来源 WXG-T-016，2026-09-12）
  现象：CodeBuddy 独立会话把新任务编为 WXG-T-013/014，与主会话已占号冲突；Qoder 侧曾抢登 §6 v1.3。
  根因：任务号与版本号活在会话记忆里，仓库无 SSOT。
  规避：`production/TASKS.md` 台账 = 任务号唯一来源（开工先读先领号）；§6 追加前先读最新 HEAD；多平台并行期由单一会话统一落账。

- **[跨IDE][K-009] 派单范围表述必须对照冻结真源复核**（来源 WXG-T-013，2026-09-12）
  现象：主理人派单称「slow/sticky 在 MVP 范围内（concept L94）」，实现者逐字核对四份定稿证明是 Should 层，及时拦截了一次按过期摘要实现冻结外功能的事故。
  根因：转述过期会话摘要，未回查 systems-index §3 真源。
  规避：派单涉及范围/数值时，引用一律以 §3 真源现文为准；实现者收到与冻结文档冲突的指令时**先回传裁决不先动手**（本次已正确执行）。
