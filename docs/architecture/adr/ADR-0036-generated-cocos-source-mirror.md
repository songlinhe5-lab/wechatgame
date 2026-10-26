# ADR-0036 · 镜像拷贝件（方案 C 物理拷贝）定档为「入库派生物」，检索/IDE 侧排除

- **状态**：**Accepted**（决策即本文 §2；检索排除已随本单落地并实测取证 §6）
- **日期**：2026-10-26
- **任务号**：WXG-T-420 **T10**（正本 = `docs/architecture/beads-arch-review-2026-10-26.md` §5 问题 7 + §6 T10 行）
- **负责域**：工程负责人（构建链 / 镜像脚本 / 检索配置）；⛔ 不改玩法与渲染，⛔ 不动 §3 冻结数值
- **权威来源（冲突以左列为准）**：`docs/architecture/control-manifest.md` §15（镜像与语言契约条文）＞ 本文 ＞ `docs/engine-reference/cocos/VERSION.md` §3 **G1**（方案 A/B/C/D 的原始登记处）＞ `tools/scripts/sync-framework-to-cocos.mjs` 头注
- **判例链**：K-120（镜像删资产须「正本 + 拷贝件 + `.meta`」三处成对）/ K-111（`build:cocos` 默认即 release 基线档）/ K-144（守卫须配阳性对照）/ K-106（新文件须被门禁实际看到）
- **关联**：ADR-0001（引擎选型，代价含「构建必须有编辑器」）/ ADR-0003（空场景 + 代码驱动）/ ADR-0009（Cocos MCP 接入）/ ADR-0012（构建层语言契约，同节条文）

---

## 0. 一句话结论

**物理拷贝进 Cocos 工程这条基线（方案 C）保留，不改；改的是它的「身份」——从「看起来像源码」降格为「入库的派生物」**，并在**检索面**（ripgrep / IDE 搜索 / 代码库索引）把它排除掉，让同名双命中不再污染阅读与评审。**排除只治「看得见」，治「不许手改」仍是硬门。**

## 1. 上下文（本会话实测取证，非引用）

| # | 事实 | 取证位置 |
|---|---|---|
| F1 | Cocos Creator **只编译自己工程 `assets/` 目录下的脚本**，框架与玩法源码住在 `packages/framework/src`、`games/<game>/src` ⇒ 要让编辑器出包，须把源码物理拷进 `games/<game>/cocos/assets/scripts/` | `tools/scripts/sync-framework-to-cocos.mjs` 头注「WHY THIS EXISTS」；`VERSION.md` §3 G1 |
| F2 | 镜像树实测规模：**262 个 `.ts` / 58,018 行 / 228 个 `.ts.meta`**（两游戏合计）； beads 侧拷贝 = framework 67 + game 106，breakout 侧 = framework 67 + game 16 | `find games/*/cocos/assets/scripts -name '*.ts' \| wc -l`、`pnpm run framework:sync` 输出 |
| F3 | 拷贝件在每次「同名符号」检索里都算一次命中：查 `buildMetaView` 命中 **43 个文件，其中 9 个（≈21%）是禁改拷贝件** | `rg -l buildMetaView`（本文 §6 复跑同一命令） |
| F4 | 本批 T9 一笔提交 **37 个变更文件里 8 个是镜像**（`git show --stat dc6a85cc` 同型）⇒ 评审面被派生物放大约 1/4 | `git status` 实测 |
| F5 | 一致性已有硬门：`framework:sync --check` 双向对账（多/少都红），`.githooks/pre-commit` 在暂存区含镜像源时自动跑 `--check` 且**只拦不写** | `control-manifest.md` §15；K-120 |
| F6 | 拷贝件里的 `.meta` 是**编辑器生成的 UUID**，被 `Main.scene` 的组件引用依赖 ⇒ 同步时保留既有 `.meta`，只清「源里已不存在」的孤儿 | `sync-framework-to-cocos.mjs` 头注「红线（L1）」；ADR-0003 |

## 2. 决策

1. **D1 保留方案 C**（物理拷贝 + 入库）。不用 npm 包依赖 / dist 产物 / tsconfig paths 替换 —— 三者在编辑器里的行为**未取证**（`VERSION.md` G1 的原文即「留待后续 ADR 评估」，本文就是那次评估：在拿到取证之前不换）。
2. **D2 身份降格**：`games/*/cocos/assets/scripts/{framework,game}/**` 一律视为**派生物**（等同构建产物），⛔ 人改、⛔ review 逐行读、⛔ 作为检索起点。唯一生产者 = `pnpm run framework:sync`；守卫 = `framework:sync:check` + pre-commit（F5，不变）。
3. **D3 检索/IDE 三处排除**（本单落地）：
   - 仓库根 `.ignore` → ripgrep 及基于 rg 的智能体检索；
   - `.vscode/settings.json` 的 `search.exclude` → VS Code 系四 IDE（Cursor / Trae / Qoder / CodeBuddy）面板搜索；
   - `.cursorignore` → Cursor 代码库索引（58,018 行派生码不再挤占索引）。
   三处**只排除 `{framework,game}` 两棵拷贝树**，⛔ 不排除 `assets/scripts/` 根下手写的 `BeadsBootstrap.ts` / `host/` / `spike/`（那是编辑器侧真源）。
4. **D4 排除不是安全边界**：`.ignore` 只影响「默认看得见什么」，不影响什么能提交。防手改仍靠 F5 的硬门；两者不可互相替代，⛔ 不得以「已加检索排除」为由放松 §15。
5. **D5 逃生阀写进配置注释**：需要显式查拷贝件（排障镜像漂移、比对改写后的 import 路径）时用 `rg -u --no-ignore <pattern> games/<game>/cocos/assets/scripts`，IDE 侧临时关掉该 `search.exclude` 项。

## 3. 为什么不改成「构建期生成、整树不入库」

被否决，**关键卡点是 `.meta`**：`.meta` 只能由编辑器生成且携带 UUID（F6），而本仓库**常态是无编辑器环境推进**（`AGENTS.md` §1 + K-111：⛔ 无编辑器禁止伪造 `.scene`/`.prefab`/`.meta`）。若把拷贝树连同 `.meta` 移出仓库，则新克隆的工作树开工程时编辑器会为每个脚本现生成**新 UUID**，`Main.scene` 里对 Bootstrap 组件的引用**当场断链** —— 这比「搜索多命中几个文件」贵得多。剩下的收益只有「少 262 个入库文件」，代价是发布链路可断 ⇒ 不换。

## 4. 负面后果（明码登记）

- **双源本身没消除**：同一份逻辑在盘上仍存两份，正本改完**必须**跑 `framework:sync`，否则镜像漂移（BD-20 已两次复发，靠人记不够 ⇒ 才有的 pre-commit 硬门）。
- **排除带来的新盲点**：默认检索看不见拷贝件 ⇒ 「镜像与正本不一致」这类问题不会从搜索里冒出来，只能由 `framework:sync:check` 报。接手人若不知道本 ADR，可能误判「仓里没有这份代码」。缓解：三处配置头注都回指本文，且 §15 有单向指针。
- **IDE 侧生效不等价**：`search.exclude` / `.cursorignore` 属各家实现约定，IDE 升级或换编辑器可能静默失效 ⇒ 判据回归 §6 的检索实验，别假设永久生效。
- **diff 噪声保留**：改一次源码仍产生镜像文件的成对变更（F4），靠 D2 的身份约定在评审时**略读**，不靠工具过滤。
- **残余风险沿用 G1**：`export * from` 等 ESM 语法在 Cocos 自有构建管线中的处理仍未真机确认；本文 ⛔ 不改变该风险面。

## 5. 复评触发（命中任一条即重开本 ADR）

1. **编辑器能力变化**：Cocos Creator 实测支持 `assets/` 外脚本引用、或直接编译 `node_modules` 内的裸 TS 包（G1 候选 a/d）⇒ 拷贝基线可撤，`.ignore` / `.cursorignore` / `search.exclude` 三件同步删。
2. **构建通道变化**：CI 能在无 GUI 环境产出微信小游戏包（ADR-0009 通道打通）⇒ 可改「构建期生成到不入库目录」，届时 §3 的 `.meta` 卡点需重新取证。
3. **检索排除失效或反噬**：§6 的复跑命令重新命中拷贝件（IDE/工具升级），或出现一次因「看不见拷贝件」而漏判的真实缺陷 ⇒ 机制换实现（如镜像目录改名 `__generated__/`）。
4. **漂移事故第三次复发**（BD-20 同型）⇒ 说明「硬门 + 身份约定」仍不足，需要重新评估镜像树是否该整体退出评审面（例如生成物打 tag / 独立提交）。
5. **新增一款游戏**（`games/*` 目录数 +1）：每多一个 Cocos 工程就多拷一份 framework（实测正本 189 个 `.ts` / 45,190 行 vs 镜像 262 个 / 58,018 行，多出的量主要就是 framework 的第二份拷贝 67 个文件）⇒ 先评估「多工程共享一份 framework 拷贝」是否可行（Cocos 每个工程需独立 `assets/`，预期不可行，拿取证再议）。

## 6. 本单验收（判据 = 「搜索不再命中禁改件」，实测）

```
# 排除前（HEAD = dc6a85cc，§1 F3）：rg -l buildMetaView → 43 个文件，9 个在拷贝树
rg -l buildMetaView | wc -l                                # → 34
rg -l buildMetaView | grep -c cocos/assets/scripts         # → 0
rg -u --no-ignore -l buildMetaView games/beads/cocos/assets/scripts | wc -l   # → 9（逃生阀仍在用）
```
智能体侧同判据：对本仓 Grep 检索 `buildMetaView` ⇒ 结果集已无拷贝树命中（与 rg 一致，因同一 `.ignore` 生效）。
**ADR 侧判据**（含负面后果与复评触发）= 本文 §4 / §5。

## 7. 落位清单

- 新增：`.ignore`、`.vscode/settings.json`、`.cursorignore`、本文。
- 指针：`control-manifest.md` §15 镜像条文补一句「身份与检索排除见 ADR-0036」；`docs/engine-reference/cocos/VERSION.md` §3 G1「留待后续 ADR 评估」改指本文。
- 登记：`production/TASKS-DETAIL.md` WXG-T-420 §5 T10 流水。
- ⛔ 本单不动：`sync-framework-to-cocos.mjs` 生成逻辑、`.gitignore`（拷贝件仍入库）、任何玩法源码与渲染层。
