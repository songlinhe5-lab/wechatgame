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
- **项目长期笔记正本在 `memory/`**：同上四 IDE 索引；日记可放 `memory/YYYY-MM-DD.md`；单节 >600 tok 走 `memory:split` 外移到 `memory/details/`（WXG-T-106）。
- **知识沉淀正本已分片**（WXG-T-111）：条目正文在 `knowledge/lessons/<标签>.md`（工具链/流程/判据/测试/跨IDE/环境），`knowledge/lessons.md` 只是**指针页**；`ACTIVE_FILES` 动态枚举该目录 ⇒ 新标签建片即被采集，无需改码。引用条目**只写 K-0NN**（路径会跟布局漂），ID → 分片查 `knowledge/INDEX.md` 活跃表「分片」列；各片共用单份归档面，且同受 B 门约束、**不得加豁免**。
- **领号认工作树，不认已提交头注**（K-046）：号池真身 = 工作树 ∪ HEAD ∪ 归档的全局最大号 +1；并发会话未提交的号段只在树里，照 `TASKS.md` 头注领号必撞。
- git 仓库 2026-09-11 才初始化；首个提交 `8263e58` 只含 skill 路径，项目代码基线尚未提交。
- **设计图 / 资源图格式统一 PNG**（2026-10-17 用户令）：小程序不支持 WebP。之后所有设计图到资源图的生成与落盘一律 `.png`（脚本输出、final 台账、交付清单）；已存在的 `.webp` 原件不回溯转换，除非用户另令。
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
- `pnpm run knowledge:split` — lessons 按行内标签分片（一次性迁移；默认 dry-run；自测 `knowledge:split:selftest`，生命周期桩自测 `kb:selftest`）。
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
- ⚠ **IDE 侧存在「commit 后自动 push」（2026-10-18 实测；裁定演化：10-18 关掉 → 2026-10-19 用户改裁 = **保留（开自动推送）**）**：本仓 11 笔提交在**未跑过 `git push`** 的情况下已全部落到 `origin/develop`——`git reflog show origin/develop` 有 `update by push` 多跳（时机在每次 commit 后 30–60 s），`git ls-remote origin refs/heads/develop` 直查 = 本地 HEAD，而仓内 `.githooks` 只有 pre-commit / commit-msg（`grep "git push" .githooks/` 零命中）⇒ 推送既不来自仓内也不来自 agent。现口径：把它当**约定**用（提交即入远端 ⇒ pre-commit 质门必须真绿，CI `ci.yml` 对 develop push 跑全链），而不是当事故。
- **两条仍然成立的约束**（改裁不削弱它们）：① 会话不得自行 `git push` / 强推 / 发布（用户除名要求除外）——开关不在仓内，agent 既不能开也不能关；② 任何“未 push”式状态句必须带取证命令与时间：`git ls-remote <remote> <branch>`（远端真值）+ `git reflog show origin/<branch> --date=iso`，⛔ 靠 `git status` 推定（它不报未推数，只给“clean”的错觉）。开关行为变了就回本行订正（沉淀 K-142 同族）。

## Headless / CI
- 正本：`docs/agent/headless-ci-pr-review.md`
- Workflows：`.github/workflows/ci.yml`（`verify`）· `pr-review.yml`（`agent -p` → PR 评论；**必过门禁**）
- 门禁：`VERDICT: FAIL` / 无合法 VERDICT / 缺 `CURSOR_API_KEY` → job 失败；`PASS`/`CONCERNS` 通过
- 分支保护须勾选 required：`CI / verify`、`PR Review (Headless) / review`
- 本地预审：`./tools/scripts/ci-pr-review.sh origin/main`（需 `CURSOR_API_KEY`）
- Secret：`CURSOR_API_KEY`；可选 Variable：`CURSOR_REVIEW_MODEL`

## 已知限制
- 需要安装 `@resvg/resvg-js` 到 WorkBuddy 托管 Node workspace：`cd ~/.workbuddy/binaries/node/workspace && npm install @resvg/resvg-js`。
- **构建可用，上真机不可**（2026-10-18 订正本条旧文）：Cocos 构建走 `pnpm run build:cocos`（编辑器自带 CLI；默认 wechatgame，**默认即 release 基线档**（旧默认 debug 会覆盖在册基线产物，判例 K-111；2026-10-18 WXG-T-292 翻面，排错显式 `--debug`），2026-10-18 实测 17.1s）；缺的是**真机预览 / 上传**（微信开发者工具侧 AppID + 上传密钥，密钥严禁入仓）。旧文两个坑（留此作史证）：① 它引用的 `build:wx` 脚本已于 2026-09-11 删除，现役名 = `build:cocos`；② 「Cocos Creator CLI 尚未接入」是误记，2026-09-14（WXG-T-049）已实测推翻——**只有 MCP 通道不可**。环境事实真源 = `docs/engine-reference/cocos/VERSION.md`（带 2026-10-05 复核块；引用前先跑一次廉价复核，判例 K-096）。浏览器 harness 仍是不依赖真机的平常验证通道。**构建档定义**：release = minify on / sourcemap off（= 包体基线档）；**关卡不加密**（裁定 = `games/beads/design/levels/levels-spec.md` §5.0.3；本条自 AGENTS.md §1 因常驻预算外移至此，2026-10-18 WXG-T-292）。
- **真机取证通道（2026-10-19）**：`brew install --cask android-platform-tools` 已装 ⇒ `adb` = 1.0.41 / 37.0.1（`/opt/homebrew/bin/adb`）。⚠ 但**对本项目的 L-A 机无效**（纯血鸿蒙无 ADB，见下条）⇒ adb 只作将来接安卓机时的备用通道，⛔ 不要默认它能用于这台机。
- **Mac 侧截图与点击（同日实测）**：`screencapture -x` 需 macOS 录屏权限，且**沙箱内会报 `could not create image from display`** ⇒ 必须走提权执行。`osascript -e 'tell application "System Events" to click at {x,y}'` 能驱动微信开发者工具的**模拟器**（命令本身可能报 AppleEvent 超时 -1712，但点击已落地 ⇒ 判据 = 之后那一帧画面，不是命令退出码）。⛔ 模拟器读数一律禁作真机判据（K-044 §0-4）。
- **选关墙锁格不可判（走查前置）**：默认存档只到第 1 关 ⇒ 第 2–9 格走 `drawLockedWallCell` 的「灰色珠阵 + 锁」合形（WXG-T-290 预期），**boss 第 9 关的照片缩略在锁态下看不到** ⇒ 验 D-77 前必须先把存档推进到第 9 关。
- **本机 USB 探针有坑（2026-10-19 实测）**：`system_profiler SPUSBDataType` 在本机输出 **0 行**（不可信，⛔ 不要拿它的空输出断言"没插设备"）⇒ 看 USB 请用 `ioreg -p IOUSB -l -w0 | grep "USB Product Name"`。华为/鸿蒙机插 USB 时枚举为 **`HDC Device`（vendor HUAWEI）**，不是 ADB 设备 ⇒ `adb devices` 必空；该机走无线调试：`adb connect <IP>:<主界面端口>`（**配对端口 ≠ 连接端口**，用错就一直 `offline`）。
- **L-A 机 = 纯血鸿蒙（HarmonyOS NEXT）⇒ 没有 ADB，只有 HDC**（用户 2026-10-19 确认）：`adb connect` 会一直 `offline`（实测 TCP 可达但握手不完成），⛔ 别再在 adb 路线上耗轮次。**hdc 已定位并接入环境**：`/Users/stephenhe/Development/command-line-tools/sdk/default/openharmony/toolchains/hdc`（Ver 3.2.0f，同目录还有 `hvigor` / `ohpm` / `codelinter` / `emulator`），已写入 `~/.zshrc` 的 `PATH`。取证配方：`hdc list targets` → `hdc shell snapshot_display -f /data/local/tmp/s.png` → `hdc file recv /data/local/tmp/s.png <本地路径>`；无线则 `hdc tconn <ip>:<port>`。
- **HDC 授权坑（2026-10-19 实测，尚未解除）**：USB 枚举正常（`ioreg` 见 `HDC Device`，`hdc list targets` 能看到序列号 `6UNBB…`）但状态一直是 **`Unauthorized`** ⇒ 需在手机弹出的「是否允许调试」里勾选并确认（HarmonyOS 开发者选项里可能还需登华为账号并开「USB 调试（安全设置）」）。`hdc kill` + `hdc start` 重启服务不会改变未授权状态，⛔ 不要靠重试磨。未授权前任何 `hdc shell` 均不可用 ⇒ 真机截图通道要等授权完成。
