name: wxgame-quality-gate
description: 运行/自验游戏工程质量门时使用：一键跑全量门禁（架构守卫、四 IDE 链接、关卡校验、typecheck、vitest、harness 冒烟）并产出标准化「工具调用报告表」。当用户要求跑测试、自验、质量门、verify、CI 检查，或实现任务收尾需自证质量时触发。边界：只执行与报告，不裁定阶段 PASS/CONCERNS/FAIL（属 wxgame-orchestration）；不产测试用例与判据（属 wxgame-qa-gates）。
---

# wxgame 质量门执行法（verify + 工具调用报告）

本 skill 属 wxgame 家族（管线顺序见 `my-skills/INDEX.md`）。核心原则：**自证质量，
不假绿**——失败必须定位并修复后重跑，禁止跳过、禁改断言凑绿、禁「与本次改动无关」式忽略。

## 1. 执行清单（按序，任一失败即停）

| # | 命令 | 覆盖 |
|---|---|---|
| 1 | `pnpm run check:arch` | 架构守卫（分层/依赖/硬编码色值等） |
| 2 | `pnpm run check:links` | 四 IDE agents/skills/memory/规则指针 + frontmatter |
| 3 | `pnpm run levels:check` | 关卡 JSON ↔ levels-data.ts 同源与合法性（per game） |
| 4 | `npx tsc --noEmit -p packages/framework && npx tsc --noEmit -p games/<game>` | 类型 |
| 5 | `npx vitest run`（在 `packages/framework` 与 `games/<game>` 各跑一次） | 单测全绿 |
| 6 | `pnpm run harness:smoke` | 浏览器验证器冒烟（环境不可用时声明阻塞，勿伪造） |
| 7 | `pnpm run verify` | 以上全量的官方一键入口（CI 同口径，最终以它为准） |

环境事实先行：无编辑器/无真机时在报告里声明哪几项被阻塞与解除条件。

## 2. 工具调用报告（强制产出格式）

**每次会话结论必须附「工具调用清单」**——凡本次会话调用过的 skill、子代理（spawn）、
脚本命令、外部能力（图像/音视频生成、web 检索等）逐条列出；用户可据此审计与复现。

```markdown
## 工具调用清单
| # | 工具/命令 | 作用 | 结果 | 关键输出 |
|---|---|---|---|---|
| 1 | pnpm run verify | 全量质量门 | ✅/❌ | 239 passed；check:links OK |
| 2 | Skill: wxgame-gdd-writer | 八节 GDD 产出 | ✅ | gdd/xxx.md |
| 3 | spawn: engineering-lead | 实现任务 WXG-T-xxx | ✅ | commit abc1234 |
```

规则：
- **失败项必须给原因与下一步**（修复中 / 需用户输入 / 环境阻塞），不许静默省略。
- 结果摘要给**数字与路径**（passed/failed、commit hash、产物路径），不给「一切正常」式空话。
- 子代理 spawn 记「成员名 + Task ID + 产物路径」；外部生成能力记「工具名 + 产物落盘路径」。

## 3. 与管线的关系

- 实现任务（Story/缺陷修复）收尾自验 = 本 skill 第 1 节清单，随 commit 回传报告表。
- 质量门**裁决**（G1–G4 的 PASS/CONCERNS/FAIL）由编排者依据本报告 + wxgame-qa-gates 判据作出。
- 任务收尾后按 `knowledge/INDEX.md` 写入协议沉淀条目（教训/模式），带 Task ID 可追溯。
