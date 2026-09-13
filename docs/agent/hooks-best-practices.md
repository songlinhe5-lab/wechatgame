# Cursor Hooks 与跨 IDE Git 门禁 — 最佳实践

> 本仓约定：Hooks **加固** `AGENTS.md` / L1–L5，不替代编排与 SubAgent。  
> 官方参考：[Cursor Hooks](https://cursor.com/docs/hooks.md)

## 1. 分层：谁拦什么

| 层 | 路径 | 覆盖面 | 职责 |
|---|---|---|---|
| **Git pre-commit** | `.githooks/pre-commit` | 任意 IDE / 终端的 `git commit` | ① **`pnpm run check:links`** → ①½ **`check:plugins`**（T-035 版本锚）→ ①¾ **`check:mcp`**（T-043 MCP 配置漂移，**拦截式不自动重建**）；② 暂存区含 `.md` 时**自动重建上下文索引并重新暂存**（`ctx:build --staged-blobs` → `git add ctx/index.json ctx/BUDGET.md` → `ctx:check --staged` 兜底终校验；WXG-T-032 ⑤，无暂存 .md 零开销跳过）；兜底校验失败 → 非 0 退出 → **阻止提交** |
| **Cursor Hooks** | `.cursor/hooks.json` + `.cursor/hooks/*` | Cursor Agent / Shell | Agent 侧再跑 links；禁 `--no-verify` / force-push / hard reset；L1 拦 `.scene`/`.prefab`/`.meta` |
| **Rules / AGENTS** | `.cursor/rules` · `AGENTS.md` | 常驻提示 | 叙事与铁律；不保证机械拦截 |

跨 IDE（Cursor / CodeBuddy / WorkBuddy / Qoder）统一拦提交 → **只靠 Git hooks**，不要指望各 IDE 各自实现一套 Cursor Hooks。

> ② 的自动重建语义（WXG-T-032 ⑤，2026-09-13）：`ctx/index.json` 描述**已提交内容（HEAD）**，而任何
> 「改 `.md` 的提交」其暂存内容必然 ≠ HEAD 锚定的旧索引 → 旧的拦截式 `ctx:check --staged`
> **结构性不可通过**（实测只能靠 `--no-verify` 绕过）。故 ② 不再拦截，改为：pre-commit 先探测暂存区
> 是否含 `.md`（无则零开销跳过），有则以 `--staged-blobs` 重建（暂存 .md 按**暂存 blob** 内容索引，
> 暂存新文件一并纳入）→ `git add` 重新暂存 `ctx/index.json` / `ctx/BUDGET.md` → `ctx:check --staged`
> 兜底终校验（正常路径恒绿，仅竞态 / 意外时拦截）。**改 `.md` 后直接提交即可**，无需先 `ctx:build`；
> 手动 `pnpm run ctx:build` 仍用于本地预览 / 复算。

## 2. 启用 Git hooks（每人 / 每 clone 一次）

仓库已提交 `.githooks/`。本地必须把 hooks 路径指过去：

```bash
pnpm install          # prepare → install-githooks.mjs
# 或
node tools/scripts/install-githooks.mjs
# 等价
git config core.hooksPath .githooks
```

检查：

```bash
git config core.hooksPath   # 应输出 .githooks
pnpm run check:links        # 应 OK
```

未设置 `core.hooksPath` 时，**提交不会跑检查**——这是 clone 后必做项。

## 3. `check:links` 查什么

脚本：`tools/scripts/check-ide-links.mjs`（**清单由扫描得出，勿在脚本内硬编码成员名**）

- 扫描 `my-agents/*.md`（除 INDEX）与 `my-skills/*/SKILL.md`（除 `_` 前缀与存档 `game-dev-tool-free`）
- frontmatter：`name`=文件名、`description` 非空；`studio-orchestrator` / `quality-lead` 必须 `readonly: true`
- `my-agents/INDEX.md` 表名与正本一致；`wxgame-orchestration` 路由表覆盖全部 subagent name
- 四 IDE `agents/<name>.md` → `../../my-agents/<name>.md`（无断链、无多余项）
- 四 IDE `skills/<name>` → `../../my-skills/<name>`；**禁止**挂存档 skill
- `.codebuddy|.workbuddy|.qoder/memory` → `../memory`；`.cursor/memory/MEMORY.md` 入口存在
- 四 IDE 规则路径 → `my-rules/agents-md.md`（相对符号链接）
- 根目录 `AGENTS.md` 存在

新增 agent/skill：正本进 `my-agents/` / `my-skills/`，四处建相对符号链接，并更新 `INDEX.md` / 编排路由表（脚本会验）。  
新增 / 改 alwaysApply 摘要：只改 `my-rules/agents-md.md`。

### 3.1 `check:mcp` 查什么（WXG-T-043）

脚本：`tools/scripts/build-mcp-configs.mjs --check`（MCP 配置的**单一正本**是 `my-mcp/servers.json`，三份 IDE 配置均为**机器生成物，勿手改**）：

- **C1** 正本存在且为合法 JSON
- **C2** `targets` 非空、`path` 唯一、`dialect` 已实现（`explicit` / `cursor`）
- **C3** `servers` 语义合法；且 `transport:"http"` 的 URL 主机**必须回环** —— `control-manifest §14` 红线「HTTP 仅回环」的**机械化**
- **C4** 每份产物内容 == 正本渲染结果（漂移 → FAIL，提示跑 `pnpm run mcp:build`）
- **C5** 「存在但未登记 targets」的已知 MCP 配置位置 → FAIL（防清单漏项静默失效，`K-031`）

改动流程：`$EDITOR my-mcp/servers.json` → `pnpm run mcp:build` → 提交。理由与方言依据见 `my-mcp/README.md`。

## 4. Cursor Hooks 实践清单

1. **项目级优先**：政策进 `.cursor/hooks.json`（可进云 Agent）；个人实验放 `~/.cursor/`。
2. **命令钩优先于 prompt 钩**：L1 / links / 危险 shell 要可审计、可云端；prompt 钩云端不可用。
3. **窄事件 + failClosed 仅用于门禁**：安全/架构门用 `failClosed: true`；格式化/审计可 fail-open。
4. **Matcher 先松后紧**：先无 matcher 确认开火，再加 JS 正则；复杂过滤放脚本内。
5. **脚本依赖自检**：`node` 可用即可；勿默认依赖 `jq`。
6. **勿用 hooks 替代 SubAgent 编排**：不要在 `subagentStop` 上自动连环 spawn（loop 风险）。
7. **勿伪造编辑器产物**：hooks 应 **拦截** `.scene`/`.prefab`/`.meta`，不要「帮写」。

### 本仓已启用

| 事件 | 脚本 | 行为 |
|---|---|---|
| `beforeShellExecution` | `.cursor/hooks/before-shell.mjs` | `git commit` 前 `check:links`；禁 `--no-verify`、force push、`reset --hard`、粗暴 `rm -rf` |
| `preToolUse`（Write/Delete/StrReplace） | `.cursor/hooks/pre-tool-use.mjs` | 路径匹配 L1 后缀则 deny |

调试：Cursor **Settings → Hooks** 或 Hooks 输出通道；改 `hooks.json` 后自动热载，异常时重启 Cursor。

## 5. 与 `verify` 的关系

| 命令 | 何时 |
|---|---|
| `pnpm run check:links` | **每次 commit**（快） |
| `pnpm run check:arch` | 改框架/玩法后；全量 `verify` 含此步 |
| `pnpm run check:mcp` | 改 MCP 服务器后（先 `pnpm run mcp:build`）；**每次 commit 也跑**（pre-commit）；CI `arch-guard` 与全量 `verify` 均含此步 |
| `pnpm run verify` | 里程碑 / PR 前；**不要**塞进每次 commit |

## 6. 失败怎么修

```text
check:links FAILED
  - .cursor/skills/foo: 缺失 …
```

1. 确认正本在 `my-skills/<name>/` 或 `my-agents/<name>.md`
2. 四处补相对符号链接（与现有 agents/skills 同形）
3. 若新增清单项：改 `tools/scripts/check-ide-links.mjs` 内数组
4. 再跑 `pnpm run check:links` → 通过后再 commit

**禁止** `git commit --no-verify`（Cursor shell hook 也会拦）。
