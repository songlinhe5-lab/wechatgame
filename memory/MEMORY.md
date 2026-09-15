# wechatgame 项目长期笔记

> **正本路径**：仓库根 `memory/MEMORY.md`。  
> 四 IDE 索引：`.workbuddy/memory` · `.codebuddy/memory` · `.qoder/memory` 为目录符号链接；Cursor 为 `.cursor/memory/MEMORY.md` 入口指针（请读本文件）。  
> **分层**：常驻铁律与默认流程 → 根目录 `AGENTS.md`；本文件放**会随项目演进更新**的运行时约定、脚本备忘与已知限制。

## 日志蒸馏规程（R2 · WXG-T-041）
- `memory/YYYY-MM-DD.md` 满 30 天 → `pnpm run memory:distill`（dry-run 看候选）→ **AI/人工先把日志中长期有效的内容蒸馏进本文件相应章节** → `pnpm run memory:distill --write` 归档至 `memory/archive/`（原文逐字节保留、git 永久可查、不进 ctx 索引面）。脚本只做机械轮转，**蒸馏内容责任在人/会话**；完整规程见 `docs/agent/memory-distill.md`，归档待蒸馏项见文末「⏳ 归档待蒸馏提醒」段。
- **连座归档（WXG-T-106）**：归档某天 ⇒ 该天 `memory/details/<日期>-*` 一同进 `memory/archive/details/`；组内任一目标重名则**整组跳过**（日记与详情件同进同退，否则留孤儿）。
- **读日志先读 `memory/INDEX.md`**（摘要层，由 `pnpm run ctx:build` 生成）：它按「文件 → `##` 主题」列出**行区间 + 体量 + 「详情」列 + 节首句素描**；命中后先看「详情」列：为 `—` ⇒ `read_file('memory/YYYY-MM-DD.md', offset=行首, limit=行尾−行首+1)` 只读那一节；非 `—` ⇒ 日记只余骨架，**正文按该列路径读 `memory/details/<…>.md`**。别整读（历史单篇最大 12.6k tok ✗）。摘要是**节首句摘取**、非人工提要，只用来判断「要不要读」。
- **单节 >600 tok 即外移**（`node tools/scripts/split-memory-detail.mjs --date=<YYYY-MM-DD>`，默认 dry-run）：正文逐字节搬到 `memory/details/`、日记留「标题 + 指针」；详情件同受 B 门约束 ⇒ **机制自带防再膨胀，不得为其加豁免**（WXG-T-106）。

## 项目约定
- 仓库是 pnpm monorepo：`packages/framework`（共用框架）+ `games/breakout`（首款示例游戏）。
- Game 相关 Agent Skills 的**正本在项目根 `my-skills/`**：`.workbuddy/skills/`、`.codebuddy/skills/`、`.cursor/skills/`、`.qoder/skills/` 四处均为相对符号链接 `../../my-skills/<name>`，随仓库提交（用户明确要求不放全局目录）。新增 skill 时：正本放 `my-skills/<name>/`，四处各建链接。Qoder 官方支持标准 SKILL.md（.qoder/skills/，name 限小写字母数字连字符 ≤64 字符）。
- **项目长期笔记正本在 `memory/`**：同上四 IDE 索引；日记可放 `memory/YYYY-MM-DD.md`。
- git 仓库 2026-09-11 才初始化；首个提交 `8263e58` 只含 skill 路径，项目代码基线尚未提交。
- 框架核心 `packages/framework/src/core` 禁止依赖 DOM / `cc` / `wx`，保证能在 Node 里单元测试。
- Cocos 绑定 `packages/framework/src/adapters/cocos/bindings.ts` 不进入框架 barrel，不能由浏览器 harness 直接编译。
- 浏览器验证器：`dev/harness` 通过 `tsconfig.harness.json` 单独编译为 ESM，用 `<script type="importmap">` 解析 `@wxgame/framework`。
- 运行入口：`pnpm harness` 或 `node tools/scripts/serve-harness.mjs`。
- 关卡数据以 JSON 为准（`design/levels/levels-01-05.json`），生成到 `games/breakout/src/config/levels-data.ts`，由 `tools/scripts/sync-levels-data.mjs` 同步。
- 全量验证命令：`pnpm run verify`（架构守卫 + 关卡同步 + 类型检查 + 测试 + harness 编译 + 运行时冒烟）。

## 常用脚本
- `pnpm run harness` — 启动浏览器验证器。
- `pnpm run harness:build` / `pnpm run harness:smoke` — 编译产物 / 运行时冒烟。
- `pnpm run preview:frames` — 生成 5 个关卡的 SVG 预览。
- `pnpm run preview:clip --level 1 --seconds 8` — 生成该关卡的 MP4 实录（需要 ffmpeg + 隔离空间里的 @resvg/resvg-js）。
- `pnpm run memory:split` — 把日记里超阈的 `##` 节逐字节外移到 `memory/details/`（默认 dry-run，`--date=` 必填；桩自测 `memory:split:selftest`）。
- `pnpm run check:links` — 扫描 `my-agents`/`my-skills` 为真源；验 frontmatter、INDEX、编排路由表、四 IDE 符号链接；`.githooks/pre-commit` 强制。
- `pnpm run verify` — 完整门禁（含 check:links）。
- `node tools/scripts/install-githooks.mjs`（或 `pnpm install` 的 prepare）— 设置 `core.hooksPath=.githooks`。

## SubAgent
- 正本 `my-agents/`；Cursor 已实测跟随 agents symlink。勿在共享 frontmatter 加未验证的 `tools`/`permissionMode`/`skills`。
- 主理人触发条件见 `AGENTS.md` §2（条件式，非默认人格）。

## Rules
- 常驻规则正本：`my-rules/agents-md.md`；四 IDE `rules/` 为相对符号链接（见 `my-rules/INDEX.md`）。

## Hooks
- 实践正本：`docs/agent/hooks-best-practices.md`
- 跨 IDE 拦提交：`.githooks/pre-commit` → `check:links`；Cursor 另见 `.cursor/hooks.json`（Agent 侧禁 `--no-verify` / L1）。
- ⚠ **待提交里含被索引 .md 时，先不要跑默认 `pnpm run ctx:build`**（默认模式按 **HEAD** 索引）：它会把 pre-commit 已生成的 `memory/INDEX.md` 回退成 HEAD 基线，而钩子那轮 `--staged-blobs` 又按暂存 blob 记账 ⇒ `ctx:check --staged` 反复报「暂存与索引不一致」（判例：WXG-T-097 连编 2 次被拦）。做法：**连跑 2–3 轮 `node tools/scripts/build-context-index.mjs --staged-blobs` + `git add ctx/index.json ctx/BUDGET.md ctx/hot-files.md memory/INDEX.md`**，到 `check-context-budget.mjs --staged` 绿后再提交。

## Headless / CI
- 正本：`docs/agent/headless-ci-pr-review.md`
- Workflows：`.github/workflows/ci.yml`（`verify`）· `pr-review.yml`（`agent -p` → PR 评论；**必过门禁**）
- 门禁：`VERDICT: FAIL` / 无合法 VERDICT / 缺 `CURSOR_API_KEY` → job 失败；`PASS`/`CONCERNS` 通过
- 分支保护须勾选 required：`CI / verify`、`PR Review (Headless) / review`
- 本地预审：`./tools/scripts/ci-pr-review.sh origin/main`（需 `CURSOR_API_KEY`）
- Secret：`CURSOR_API_KEY`；可选 Variable：`CURSOR_REVIEW_MODEL`

## 已知限制
- 需要安装 `@resvg/resvg-js` 到 WorkBuddy 托管 Node workspace：`cd ~/.workbuddy/binaries/node/workspace && npm install @resvg/resvg-js`。
- 小游戏真机构建 `build:wx` 尚未接入 Cocos Creator CLI，目前由浏览器 harness 覆盖游戏逻辑与渲染验证。
