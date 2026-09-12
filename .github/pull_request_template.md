<!--
PR 规则 — WXG-T-016；完整规则文档：docs/ci/commit-and-review-rules.md
合并门禁：gate（CI 收口）+ review（Headless）+ lint（Commit Lint）均须通过
-->

## 变更类型（勾选全部适用项）

- [ ] `feat` 新功能
- [ ] `fix` 缺陷修复
- [ ] `design` 设计文档 / 数值生效
- [ ] `docs` 文档
- [ ] `refactor` 重构（不改行为）
- [ ] `perf` 性能
- [ ] `test` 测试
- [ ] `chore` / `ci` / `build` 基建
- [ ] `revert` 回滚

## Task ID（必填）

- Task ID：**WXG-T-\_\_\_**（或 issue 引用 #\_\_\_）
  > 提交信息拦截规则要求全文可追溯任务单（`WXG-T-<数字>` 或 `#<数字>`）。

## 影响范围

<!-- 勾选实际改动区域，并与 PR label 对照 -->

- [ ] `packages/framework/**`
- [ ] `games/breakout/**`
- [ ] `games/beads/**`
- [ ] `tools/**` / `.github/**` / `.githooks/**`
- [ ] `docs/**` / `production/**`

## G 门自检清单（涉及才勾，全部不涉及则勾 N/A）

- [ ] **N/A**（本次不涉及以下任何一项）
- [ ] **G1 架构守卫**：未违反 L1–L5（无手改 `.scene/.prefab/.meta`、core 无 cc/DOM/wx、玩法无 cc、无 `Math.random()`、UI 不持有状态）；`pnpm run check:arch` 通过
- [ ] **G2 关卡同步**：改动关卡 JSON 后已 `pnpm run levels:sync`，`levels:check` 通过，无漂移
- [ ] **G3 类型测试**：typecheck + test 全绿；新增 core/玩法模块配有对应测试
- [ ] **G4 硬判据**：涉及验收判据的改动已对照 QA 五件套用例回归

## 数值纪律自检

- [ ] 本次**未**改动任何 `systems-index.md` §3 冻结数值
- [ ] 或：已同步修改 §3 并在对应设计文档**登记变更记录**（注明裁定人与日期）

> 数值唯一真源是 `games/<game>/design/gdd/systems-index.md` §3；先改文档再改代码，漂移必须登记。

## 验证记录

<!-- 粘贴关键命令输出摘要；CI 上的 gate / review / lint 结果以最终 status 为准 -->

```
pnpm run verify 输出摘要：
```
