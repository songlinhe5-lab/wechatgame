# 提交与 Code Review 拦截规则 — WXG-T-016

> 目标：**每个提交可追溯到任务单**，且 type/scope 粒度与仓库分区一致；PR 有模板、责任人与标签；合并由分支保护统一收口。
> 本文是规则的权威说明；拦截实现见下文「双层拦截架构」。

---

## 1. 双层拦截架构

| 层 | 实现 | 触发时机 | 兜底 |
|---|---|---|---|
| **本地** | `.githooks/commit-msg`（经 `core.hooksPath=.githooks` 全 IDE 生效，`pnpm install` 的 `prepare` 钩子自动安装） | 每次本机 `git commit` | `pnpm` 缺失或依赖不全 → 明确报错要求先 `pnpm install` |
| **CI** | `.github/workflows/commit-lint.yml`（check 名 `lint`） | PR：lint `base..HEAD` 全部新增提交；push 到 `master`/`develop`：lint 推送区间（首推/强推基点缺失时回退只 lint HEAD） | 无 |

**已知豁免**：CI 只查**新增**提交，**不回溯历史**。仓库历史提交可能不完全符合新规（如旧提交未带 `WXG-T-` 号），属预期行为，不构成 CI 失败。

---

## 2. 提交信息规则（commitlint，`commitlint.config.mjs`）

Header 形如：

```
<type>(<scope>): <subject>
```

### 2.1 type 对照表

| type | 用途 | 仓库实例 |
|---|---|---|
| `feat` | 新功能 / 新系统落地 | `feat(beads): S6 道具系统八节 GDD…` |
| `fix` | 缺陷修复 | `fix(agents): 移除 model: inherit…` |
| `docs` | 纯文档（含 memory 记账） | `docs(memory): Qoder L5 PASS…` |
| `design` | 设计裁定 / 数值生效 | `design(beads): STAR3_RATIO 0.50→0.40 生效…` |
| `refactor` | 重构（不改行为） | — |
| `perf` | 性能优化 | — |
| `test` | 测试补充 / 回归 | `test(breakout): G4 正式回归…` |
| `chore` | 杂项维护 | — |
| `ci` | CI / workflow 改动 | 本任务的提交即用 `ci(tools): …` |
| `build` | 构建体系 / 依赖 | — |
| `revert` | 回滚 | — |

### 2.2 scope 对照表（适用路径）

| scope | 适用路径 |
|---|---|
| `framework` | `packages/framework/**` |
| `breakout` | `games/breakout/**` |
| `beads` | `games/beads/**`（设计文档可细用 `design` type 区分） |
| `harness` | `dev/harness/**`（验证器本体） |
| `levels` | `games/*/design/levels/**`、`src/config/levels-data.ts` |
| `qa` | `production/qa/**` |
| `epics` | `production/epics/**`、`production/sprints/**` |
| `architecture` | `docs/architecture/**`（架构 / ADR / 控制清单） |
| `art` | `games/*/art/**` |
| `ux` | `games/*/design/ux/**` |
| `audio` | 音频规格 / 音频产物 |
| `memory` | `memory/**` |
| `release` | `production/release/**` |
| `tools` | `tools/**` |
| `agents` | `my-agents/**`、`.codebuddy/agents/**` 等智能体定义分区 |
| `ci` | `.github/**`、`.githooks/**` |
| `deps` | `package.json`、`pnpm-lock.yaml` 等依赖变更 |

**强制规则**：`scope-empty: never`——不允许裸 type（`fix: xxx` ❌）。粒度要求：scope 必须指明分区。

### 2.3 其他 header 规则

- `header-max-length: 100`
- subject **不允许句号结尾**（`subject-full-stop`）
- `subject-case` 类规则**全部关闭**（中文 subject 兼容）
- `type-empty` / `subject-empty`：禁止

### 2.4 task-id-required（自定义规则）

整条提交信息（header + body + footer 任意位置）必须包含：

- `WXG-T-<数字>`（任务单号），或
- `#<数字>`（issue 引用）

目的：每个提交可追溯到任务单或 issue。

### 2.5 正例 / 反例

**正例**（沿用仓库既有风格）：

```
design(beads): STAR3_RATIO 0.50→0.40 生效（WXG-T-014，用户 2026-09-12 裁定）
feat(breakout): D-01 减弱动效开关全链路落地（WXG-T-013）
docs(memory): Qoder L5 PASS——L0-L5 双平台全绿（WXG-T-012）
```

**反例**（均为既有风格改错位的演示）：

| 反例 | 违反规则 |
|---|---|
| `更新 STAR3_RATIO` | 无 type、无 scope、无 task-id |
| `fix: STAR3_RATIO 修正（WXG-T-014）` | `scope-empty: never`——裸 type |
| `design(beads): STAR3_RATIO 0.50→0.40 生效（WXG-T-014）。` | subject 句号结尾 |
| `feat(beads): 这是一条故意写得非常非常非常非常非常非常非常非常长的 subject 用来演示 header 超长被拦（WXG-T-014）` | header 超 100 字符 |
| `feat(beads): 道具系统落地` | 缺 task-id（`WXG-T-` 或 `#`） |
| `feature(beads): 道具系统（WXG-T-014）` | type 不在 type-enum |

---

## 3. PR 规则

### 3.1 PR 模板（`.github/pull_request_template.md`）

新建 PR 自动带出，含：变更类型勾选、**Task ID 必填**、影响范围、G 门自检（G1 架构守卫 / G2 关卡同步 / G3 类型测试 / G4 硬判据）、数值纪律自检（改 §3 冻结数值必须同步 systems-index §3 并登记变更记录）、验证记录。

### 3.2 CODEOWNERS（`.github/CODEOWNERS`）

按路径细粒度，当前 owner 统一 `@stephenhe`（为未来协作者预留结构）。覆盖：`/packages/framework/`、`/games/breakout/`、`/games/beads/`、`/games/beads/design/`、`/production/qa/`、`/production/epics/`、`/docs/`、`/.github/`、`/tools/`。

### 3.3 自动标签（`.github/labeler.yml` + `.github/workflows/labeler.yml`）

PR 按变更路径自动打标签：`framework`、`game:breakout`、`game:beads`、`design`、`qa`、`epics`、`docs`、`ci`。
> 若仓库中标签不存在，labeler 在具备 `pull-requests: write` 权限时会创建；首次运行后建议到 Labels 页核对一次。

---

## 4. 分支保护（`tools/scripts/setup-branch-protection.sh`）

脚本用 `gh api` 幂等写入 `master` 保护规则（自动从 `git remote get-url origin` 解析仓库名，需 `gh auth login`）。逐项说明：

| 配置项 | 值 | 说明 |
|---|---|---|
| required status checks | `gate` / `review` / `lint`，`strict: true` | 三个合并门：CI 收口 / Headless 评审 / 提交 lint；strict = 合并前必须基于最新 base |
| Require pull request | 是，0 approval | 直接 push master 被拒；单人仓库不设人工 approval（1 个 approval 即自批死锁），评审拦截由 required check `review`（Headless）承担 |
| Require linear history | 是 | 禁 merge commit，保持可回放 |
| Allow force pushes / deletions | 否 / 否 | 防误操作 |
| Require conversation resolution | 是 | 评审意见未解决不能合并 |
| enforce_admins | 否 | 管理员保留紧急处置通道（WXG-T-016 裁定：单人仓库若对管理员同样生效，check 故障 / 规则误配会把自己锁死且无第二人可解锁；见 §6 已知限制） |

**check 名核对提示**：GitHub required check 匹配的是 **check run 名（job 名）**。本仓库三个门的名字分别来自：`ci.yml` 的 job `gate`、`pr-review.yml` 的 job `review`、`commit-lint.yml` 的 job `lint`。若 PR Checks 页显示的实际名字与此不符（如带 workflow 名前缀），**先跑一次 CI 核对实际名字**，再修正脚本中的 `CONTEXTS` 后重跑（脚本幂等）。

**执行纪律**：本脚本改动远端保护属高影响动作，须由主理人带用户执行，勿在 CI 中自动运行。

### 4.1 分支模型（WXG-T-024 裁定 A 方案）

| 分支 | 保护 | CI 触发 | 用途 |
|---|---|---|---|
| `master` | ✅ 三 required check + 必须走 PR + 线性历史 | push + PR | 唯一受保护主线，合并即受门禁 |
| `develop` | ❌ 未保护（可直推） | **push + PR（本次裁定新增）** | 日常集成分支：在长驻分支上就拦截，避免未过验证的提交堆积到 PR 才暴露 |
| `feat/*` 等临时分支 | ❌ | PR | 短期特性分支 |

**纪律**：直推 `develop` 虽无保护，但 CI（含 `gate`、`lint`）会跑——**红了就地修，不要带着红状态往 master 提 PR**；`master` 的合并一律走 PR。

---

## 5. CI 粒度细化（`.github/workflows/ci.yml`）

- `dorny/paths-filter@v3` 检测变更组：`framework` / `game` / `tools` / `ctx`（filter 定义见 workflow 头注释；`docs` 组已删——文档变更由常驻 `arch-guard` 的 `check:links` 覆盖）
- Job 拆分：`arch-guard`（始终跑，纯 Node 零依赖）→ `levels` / `unit`（framework/game/tools 触发）→ `harness`（framework/game 触发）→ `ctx`（`**/*.md` / `package.json` / `tools/scripts/**` / `ctx/**` 触发）
- 收口 job `gate`：`needs` 全部 + `if: always()` 汇总——任一被触发且失败则 gate 失败；`skipped`（未触发）不算失败
- **分支保护只需挂 `gate` 一个 required check**（CI 内部粒度变化不影响保护配置）
- 本地语义不变：`pnpm run verify` 仍是全量门禁唯一入口
