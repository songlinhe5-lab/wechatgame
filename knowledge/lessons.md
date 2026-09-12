# lessons.md — 教训库（追加式，最新在后）

## 工具链

- **[工具链] commitlint 自定义规则必须经 plugins 数组注册**（来源 WXG-T-021 / 修复 commitlint.config.mjs，2026-09-12）
  现象：任何提交都失败，commitlint 崩溃 `RangeError: Found rules without implementation: subject-no-cn-stop, task-id-required`。
  根因：把自定义规则函数直接内联进 `rules` 表——commitlint 不支持，只认配置项；自定义规则实现必须经 `plugins: [{ rules: {...} }]` 注册，`rules` 表只写 `[级别, 'always']`。
  规避：新装 lint 类钩子后，先用一条正常消息 + 一条违规消息双测再投入使用；「实测可用」的注释要能复现。

## 跨 IDE

- **[跨IDE] Qoder 把 `model: inherit` 当具体模型 ID 解析**（来源 commit 2665d10，2026-09-11）
  现象：Qoder 侧 spawn SubAgent 返回 code=40506 model not found，成员未启动。
  根因：Qoder 不支持 Cursor/CodeBuddy 的 `model: inherit` 方言，解析为模型名去查询。
  规避：my-agents 正本 frontmatter **省略 model 字段**（Cursor/CodeBuddy 省略即 inherit，三平台语义一致）；跨 IDE 方言字段只在实测确认后加入正本。

- **[跨IDE] 跨 IDE 并行会话会撞任务号与 §6 版本号**（来源 WXG-T-016，2026-09-12）
  现象：CodeBuddy 独立会话把新任务编为 WXG-T-013/014，与主会话已占号冲突；Qoder 侧曾抢登 §6 v1.3。
  根因：任务号与版本号活在会话记忆里，仓库无 SSOT。
  规避：`production/TASKS.md` 台账 = 任务号唯一来源（开工先读先领号）；§6 追加前先读最新 HEAD；多平台并行期由单一会话统一落账。

- **[跨IDE] 派单范围表述必须对照冻结真源复核**（来源 WXG-T-013，2026-09-12）
  现象：主理人派单称「slow/sticky 在 MVP 范围内（concept L94）」，实现者逐字核对四份定稿证明是 Should 层，及时拦截了一次按过期摘要实现冻结外功能的事故。
  根因：转述过期会话摘要，未回查 systems-index §3 真源。
  规避：派单涉及范围/数值时，引用一律以 §3 真源现文为准；实现者收到与冻结文档冲突的指令时**先回传裁决不先动手**（本次已正确执行）。

## 环境

- **[环境] WorkBuddy 沙箱内 bash grep/链式命令会假阴性（空输出 + exit 1）**（来源 WXG-T-020 验收，2026-09-12）
  现象：bash 里 `grep` 明明有匹配却返回空输出，差点误判「成员交付未落盘」。
  根因：沙箱对管道/链式命令的执行怪象（本会话出现 ≥3 次）。
  规避：核验文件内容一律用专用 Grep/Read 工具；bash 只用于跑构建/测试/git。

## 流程

- **[流程] 质量门复验者 ≠ 实现者**（来源 WXG-T-019，2026-09-12）
  现象：G4 复验由严守真（非实现者程基岩）独立执行，抓到 F-01 恒真断言——实现者自验 465 全绿也测不出自己写的自比较断言。
  规避：门级验证固定换人（fresh eyes）；自验（实现者）+ 复验（独立成员）双层是标配，缺一不可。
