# lessons · `toolchain` 分片（标签 `工具链`）

> 由 `knowledge/lessons.md`（WXG-T-111 按行内标签分片）逐字节搬运而来；本片条目**按 ID 升序**。
> 引用只写 **K-0NN**；口径正本（B 门不豁免 / 新标签 = 新片）见 `knowledge/INDEX.md` §1–§4。

## 工具链

- **[工具链][K-001] commitlint 自定义规则必须经 plugins 数组注册**（来源 WXG-T-021 / 修复 commitlint.config.mjs，2026-09-12）
  现象：任何提交都失败，commitlint 崩溃 `RangeError: Found rules without implementation: subject-no-cn-stop, task-id-required`。
  根因：把自定义规则函数直接内联进 `rules` 表——commitlint 不支持，只认配置项；自定义规则实现必须经 `plugins: [{ rules: {...} }]` 注册，`rules` 表只写 `[级别, 'always']`。
  规避：新装 lint 类钩子后，先用一条正常消息 + 一条违规消息双测再投入使用；「实测可用」的注释要能复现。

- **[工具链][K-002] bash heredoc 定界符未加引号 + JSON 内写注释 = 双重坑**（来源 WXG-T-021 / 修复 `tools/scripts/setup-branch-protection.sh`，2026-09-12）
  现象：分支保护脚本报 `review: command not found` 且 `gh api` 返回 HTTP 400（Problems parsing JSON）。
  根因：① `<<JSON` 定界符**未加引号** → heredoc 正文里的反引号 `` `review` `` 被当命令替换执行；② JSON 规范不支持注释，说明文字写进了 payload 体内。
  规避：payload heredoc 一律用 `<<'JSON'`；注释/裁定依据一律写进 heredoc **之外**的 bash 注释；写脚本后先 `bash -n` 再实跑一次。

- **[工具链][K-003] 常驻上下文预算阈值必须与 token 估算公式同口径**（来源 WXG-T-024 / `ctx:check`，2026-09-12）
  现象：新加常驻预算守卫首跑即报 `AGENTS.md` 超限（3167 > 3000），但该文件此前被认为"很克制"。
  根因：阈值 3000 是按 `bytes/4` 口径拍的，而守卫用的是 CJK≈1 token/字公式——口径不一致产生**假性超限**。
  规避：阈值常量处必须注释「口径 + 裁定依据 + Task ID」；引入体积类守卫时先用真实样本校准阈值再上线。

- **[工具链][K-004] 改过被索引的 `.md` 后必须重跑 `ctx:build`，否则 C 门必红**（来源 WXG-T-026 复验 D-01，2026-09-12）
  现象：交付报告称"已完成"，但交付态 `pnpm run ctx:check` **exit 1**（`C: 索引过期 — ctx/ROUTES.md（sha256 不符）`）→ 接入 CI 后该 PR 的 `ctx` job 必红。
  根因：`ctx/ROUTES.md` 末次编辑晚于最后一次 `ctx:build`（mtime 21:36 > 21:29）。
  规避：**任何对 `.md` 的编辑都算"改索引源"**，收尾顺序固定为 `ctx:build` → `ctx:check`；实现者自验清单里必须含这一条（本次由独立复验者捕获，非实现者自测发现）。
  **2026-09-13 更新（WXG-T-032 ⑤）**：该坑的「拦截式」治理被证实**结构性不可通过**——索引契约描述已提交内容（HEAD），任何改被索引 `.md` 的提交其暂存内容必然 ≠ 旧索引，pre-commit 拦截只能靠 `--no-verify` 绕过（本任务实测被迫使用）。现 pre-commit 已改为「**自动重建 + 重新暂存**」：暂存 `.md` 存在即以 `--staged-blobs` 模式（按暂存 blob 内容）重建 `ctx/index.json`/`ctx/BUDGET.md` 并重新暂存，`ctx:check --staged` 降为兜底终校验；「改 md 后必须先 ctx:build」不再是提交前置条件（教训保留作历史；手动复算 / 本地预览仍走 `ctx:build`）。

- **[工具链][K-005] 含「活动会话」的采集型基线必须用比率口径，计数容忍带必然误报**（来源 WXG-T-026 复验 F-02，2026-09-12）
  现象：基线快照含仍在写入的根会话（WorkBuddy `d2983589`，占 64.3%），重采即漂移（457→460 行、P10 30.0%→30.9%）；计数容忍带 `max(2, 基线×20%)` 很快越界 → **假回归 FAIL**。
  规避：判定量改用「分子分母同步增长」的**比率**（抖动率 9/107=8.4%、大文件整文件读率 65/457=14.2%），原始计数只作展示；容忍带按比率百分点设（5pt）。

- **[工具链][K-006] 冻结样本做 schema 升级，用「侧车重算」而不是全量重采**（来源 WXG-T-026 复验 F-01/F-03，2026-09-12）
  现象：为给既有账本补字段而重跑采集，样本立即漂移（457→460 行），历史结论不可复现。
  规避：采集器提供 `--sidecar-only`（读现有账本 + 侧车补字段，**不扫描转录、不改账本**）；重采前先备份并 diff 漂移量；**账本视作冻结样本入库**。

- **[工具链][K-025] 门禁里的「特殊豁免」要早删——它会把真实数据不一致静默吞掉**（来源 WXG-T-029，2026-09-12）
  现象：`kb:check` 第 ⑥ 条（`accessCount === seen.length`）曾对「含 `touch:` / `reactivate:` 来源」的条目开豁免——看似保护正常补录，实为漏洞温床。
  根因：把「写入方不完整」的锅甩给门禁侧开口子（写入方 `kb:touch`/`kb:reactivate` 当时确实没写 `seen`）。
  规避：正确做法是**让写入方补齐留痕**（两个命令 `+accessCount` 时同步 append `seen`），使门禁对**所有条目**严格成立；豁免一旦存在，后续真实不一致会被它放过。

- **[工具链][K-026] 留痕日志混装多来源主体时，去重键必须按「主体类型」分流**（来源 WXG-T-029，2026-09-12）
  现象：`seen` 同时承载「采集会话主体」（`<session>`）与「显式动作主体」（`touch:<task>` / `reactivate:<date>`）后，若去重直接比对全串，一条触碰留痕可能被误判成「某会话已计过」→ **真实访问被漏计**。
  根因：单一 `seen` 数组承担两种语义，消费方（采集去重）未区分主体类型。
  规避：lib 显式定义 `isExplicitSeenSubject()` 前缀白名单，去重只认采集主体；主体串沿用既有 `accessSources` 标签（不新造字面量），并用「touch → collect」交叉回归断言锁死。

- **[工具链][K-029] 自增 ID 的下界必须取自既有数据，不能只看计数器**（来源 WXG-T-029，2026-09-12）
  现象：`ledger.json` 缺失（新克隆/被清理）而 md 条目**已带**行内 ID 时，`nextId` 从 1 重发 → 撞号，撞号还会把「新增」误判成「修改」，污染变更统计与 CHANGELOG。
  根因：ID 下界只依赖一个易失的计数器，没扫描「已带 ID 的存量文本」。
  规避：`nextId = max(台账最大 ID, 活跃 md 最大 ID, 归档 md 最大 ID) + 1`；并用自测锁死"新条目不得复用既有 ID"。

- **[工具链][K-030] 产物进索引前先确认「新鲜度契约」——脚本自测会假绿**（来源 WXG-T-029，2026-09-12）
  现象：锚定**已提交内容**的索引（`ctx:build`，WXG-T-026）**不收录未提交的新产物**；但无 git 的假仓库自测会回退纯工作树语义 → 断言"已入索引"假绿，真库却查不到。
  根因：契约的两条分支在自测环境里只跑到了宽松那条。
  规避：此类断言必须在**真库 + 默认模式**下复核一次，不能只看自测结果；并在文档写明"提交后自动收录"。

- **[工具链][K-031] 多产物生成器新增产物时，必须同任务登记 pre-commit 的 `git add` 清单**（来源 WXG-T-036 / 修复 `.githooks/pre-commit`，2026-09-13）
  现象：`ctx:build` 新增第二产物 `ctx/hot-files.md`（协议第二跳，WXG-T-036 q-1），但 pre-commit 仍只 `git add ctx/index.json ctx/BUDGET.md` → 该文件**永不入库**：CI 干净检出无此文件、`ctx/ROUTES.md §0` 第二跳指向空、A 项预算表缺行，且每次提交都被重建却始终停留在工作区。
  根因：pre-commit 的暂存清单是**硬编码枚举**，与生成器实际落盘产物之间**无任何联动校验**；漏 add 完全静默（无报错、无告警、本地 `ctx:check` 因工作树存在该文件而**假绿**），只在另一台机器 / CI 才暴露。
  规避：① 生成器每新增一个落盘产物，**必须在本任务内**同步改 `.githooks/pre-commit` 的 `git add` 行，并跑一次真实提交验证入库；② `ctx:check` FAILED 段的修复提示文案同样枚举产物（`check-context-budget.mjs` 三处），须一并更新；③ 根治形态 = 产物清单常量化（单一真源）+ 门禁断言「生成器产出集 == 暂存清单」，当前以人工纪律替代。
  同类：与 `ctx/reads-ledger.jsonl` 的 commit 清单、记忆层「固定 tag + `compose pull` = 永不更新」同属**枚举清单漏项 → 静默失效**族，判据是「清单是人写的枚举，且没有断言会因漏项而红」。

- **[工具链][K-032]「逃生阀」两侧都支持时，文档必须写成**成对命令**，否则用户困在错误恢复路径**（来源 WXG-T-036 复验 / 修 `check-context-budget.mjs` 提示与 `ctx/ROUTES.md ⑨`，2026-09-13）
  现象：`--working-tree` 在 ROUTES ⑨ 被写成「生成器与门禁**均支持**」，读者理解为「任选其一」；实际只切校验侧时 C 项对**全部 10 个 dirty 文件**报「索引过期」，且同一段 FAILED 提示让人去跑**默认** `ctx:build` —— 跑多少次都不消除（默认索引描述 HEAD，与工作树校验语义必然不符）。
  根因：`--working-tree` 是**模式开关**而非独立功能，索引端与校验端**必须同模式**才有意义；「均支持」这类并列措辞丢掉了「成对」这一必要条件。索引里也未记录构建模式（无 `mode` 字段），事后无法自证。
  规避：① 模式类开关的文档一律写成**成对命令**（`ctx:build --working-tree && ctx:check --working-tree`），不写「均可」；② 门禁检测到「dirty 文件全量 stale」这一特征时**主动改判**为「索引模式不匹配」并给成对命令（本轮已实现 C 项 💡 诊断），不要只报「索引过期」把用户推回错误路径；③ 顺带说明附带收益——成对模式暴露**工作树真实体积**（默认模式 A/B 项显示 HEAD 值，本地已超标时会**假绿**）。

- **[工具链][K-033] 能否用符号链接做「一处正本」，判据是**消费方读取内容是否逐字相同**，不是文件长得像**（来源 WXG-T-043 / 收口 Cocos MCP 配置，2026-09-13）
  现象：一条 MCP 服务器要在 3 份文件（`.mcp.json` / `.cursor/mcp.json` / `.codebuddy/mcp.json`）各手写一遍，改造中实测出漂移——同一个 stdio 条目在 `.cursor/mcp.json` **漏了 `"type"`**（而 Cursor 官方文档把 stdio 的 `type` 标为**必填**）→ 该服务器在 Cursor 侧可能**一直没被加载**，且无任何报错。惯性做法是照搬 `my-skills` 的相对符号链接（四 IDE 共享 `my-skills/<name>` 正本），但直接 symlink 一份内容会把**某一侧的方言强加给所有 IDE**：远程 HTTP 条目 Cursor 官方示例**只给 `url`**（`type:"http"` 无文档依据），CodeBuddy 文档则**建议显式 `type`**。
  根因：`my-skills` 能"一处正本"的前提是**四 IDE 消费的是内容完全相同的目录**（同一份 `SKILL.md`）；MCP 配置是**多个 IDE、同一语义、各方言**——「正本」指的是**语义**，不是「文件字节」。把"文件长得像"当成"可以共享"，会把方言冲突和漂移一起藏进链接里。
  规避：① 判断能否 symlink 共享，只看「消费方读取内容是否逐字相同」；不相同就该用**语义正本 + 方言序列化生成器**（`my-mcp/servers.json` → `build-mcp-configs.mjs`，方言差异集中在渲染策略里且逐条标注官方文档依据）。② 顺手把「红线」机械化：`control-manifest §14`「HTTP 仅回环」做成门禁 C3（URL 主机非回环即 FAIL）——红线写在文档里靠自觉，写成门禁才是真的。③ 对"已知 IDE 配置位置"加 C5「存在但未登记 targets → FAIL」，落 K-031 的根治形态（清单漏项会因断言而红，而非静默失效）。④ 生成器**默认拦截、不静默重写**产物：错误 MCP 配置的后果是 IDE 侧静默失效，静默重建会掩盖"有人手改了产物"这一事实。
  同类：K-031（枚举清单漏项 → 静默失效）；判据同为「清单是人写的枚举，且没有断言会因漏项而红」。

- **[工具链][K-034] 协议第二跳的准入条件不能沿用「热度 + 体积」——引用面覆盖率必须独立成硬门（D2）**（来源 WXG-T-044 / 修 `tools/scripts/lib/context-index.mjs` 选池 + `check-context-budget.mjs` 新增 D2，2026-09-13）
  现象：三层阅读协议名义上已落地，但第二跳 `ctx/hot-files.md` 的实测覆盖率只有 **94.1%**——`ctx/ROUTES.md` 引用到的 10 个中/小文件（`docs/agent/repo-layout.md`、`docs/agent/commands.md`、`docs/agent/routing.md`、`my-agents/INDEX.md` 等）**全部落选**，读者按第一跳命中锚点后，第二跳查不到 `offset`/`limit`，协议恰在最需要它的地方断链。
  根因：选池准入条件被写死为「实测读过 ∨ ≥3000 tok」，即**热度 + 体积**两个维度——而被引用文件恰恰多是低频中/小文件（仓库布局、命令速查），两条都沾不上；门禁侧也只有 A（常驻预算）/B（单文件上限）/C（新鲜度）/D（ROUTES 锚点存在性）四项，**「D 指向的锚点是否真的可达」无人断言** → 结构性缺陷可长期静默存在。
  规避：① 引用面覆盖率与热度/体积**正交**：它衡量的是「产物之间能否衔接」，不依赖任何历史会话分布，故不进 E1/E4 那类行为类指标（受 T-026 行为类裁定约束），直接设**硬门 D2**；② D2 分母 = ROUTES 引用过的路径 − 常驻层（`ALWAYS_FILES`）− `ctx/` 自身产物 − **尚未入索引的新文件**（否则工作树新增文件会制造本地假 FAIL），阈值 `LIMITS.hotFilesCoverageMin = 0.9`；③ 选池排序改**引用优先**（ROUTES 引用 > 实测读过 > tokens 升序），小文件先入选才能在既定预算内覆盖更多引用面；④ 修完实测覆盖率 **94.1% → 100%**（入索引文件 12 → 22），`hot-files.md` 体积几乎不变（约 **3943 tok**）——腾出的预算来自同步瘦身的「未收录」清单，该节现已**完全清空**（原 ~1190 tok 用于支付新收录的 10 条路由）。
  判据推广：**只要某产物「承诺可达」某个集合，就必须有一条门禁去数它的覆盖比例**，不能只验证「被引用的锚点是否存在」——存在性门（D）与可达性门（D2）缺一不可。

- **[工具链][K-043] 取证脚本里「装载动作」必须写在模块 import 之前，否则拿到上一轮旧产物造出假 FAIL**（来源 WXG-T-097/BD-10，2026-09-15）
  现象：探针本轮新增一个常量与一个新图元，实跑读成 `undefined` / 图元永远找不到 ⇒ 两条假 FAIL；而产物目录里 grep 得到该常量，mtime 自证（dist 不早于 src）也是绿的，看似“代码不对”。
  根因：装载函数内部才做「rm -rf 暂存 dir + 重拷编译产物」，而它写在 `await import(...)` **之后**；ESM 命名空间在 import 那一刻已固定，拿到的是**上一轮旧暂存 dir**；“产物↔源码 mtime 自证”只覆盖 dist↔src，**不覆盖装载顺序**。
  规避：① 脚本内先把 harness/暂存装起再 import 被测模块；② 每轮新增依赖时加一道「新符号不在内存就硬抛」防呆（只探存在性，不判数值）；③ 假 FAIL 的第一手排查应是“内存模块 vs 磁盘产物 版本差”，而非先改被测代码。
  判例引用：`production/qa/beads/g4-probe-v1.1.mjs` 修订 40③(a)（`loadHarness` 前置 + 硬抛防呆）；同族 K-036（门禁可信度）。

- **[工具链][K-048] 装置自指文件必须让索引取工作树字节，否则重建-add-校单遍不收敛**（来源 WXG-T-112 / BD-38，改 `tools/scripts/lib/context-index.mjs::WORKTREE_AUTHORITATIVE` + `check-context-budget.mjs` 新增装置自指对账门，2026-09-15）
  现象：pre-commit 的 ctx 段是「`ctx:build --staged-blobs` → `git add` 四个产物 → `ctx:check --staged` 兜底」。只要提交会让 `memory/INDEX.md` 换字节（改日记即触发），**第一遍必报**「暂存内容与刚重建的索引仍不一致 — memory/INDEX.md」，原样再提交一次才绿。
  根因：`memory/INDEX.md` 与 `ctx/BUDGET.md` / `ctx/hot-files.md` 同为 `ctx:build` 自己的产物，但只有后两个列进了 `WORKTREE_AUTHORITATIVE`。未登记的那个在 build 期间被本进程改写成新字节，而 `buildIndex()` 对它取源仍走 committed / staged-blobs 分支（dirty → HEAD blob、已暂存 → 暂存 blob）⇒ 索引记**上一轮字节**；钩子随后 `git add` 把**新字节**送进暂存区 ⇒ 终校验必红。取证一眼可辨：`ctx/index.json` 里该文件的 sha 等于 `git show HEAD:<path>`，却不等于暂存 / 工作树的 sha。
  规避：① 新增 `ctx:build` 写盘的 .md 时，**同时**登记进 `WORKTREE_AUTHORITATIVE` 与钩子的 `git add` 清单，两处缺一不可；② 别指望「先写产物、后建索引」的顺序调整能修好（WXG-T-072 当时只做了这件事，实测仍需两遍）——决定项是**取源分支**，不是写入顺序；③ 也别归因成「作者手跑了 `ctx:build` 才脏」：隔离 worktree 实测三种起手（只暂存自有 .md / 手跑 build 并 add 产物 / 手跑 build 不 add 产物）**第一遍全红**，最规范的用法一样中招；④ 把不变式机械化——`ctx:check` 的「装置自指对账」`C:` 级项断言生成物集合 ⊆ 工作树权威集合，漏登记当场报红并直接给出修法位置，而不是留给下一个提交的人去撞。
  判据推广：生成器注释里任何「我这一步写完就与磁盘同源了」的断言，都必须有**跨模式**（committed / staged-blobs / working-tree）的取源断言背书，否则它就是下一个 BD-38；自测里要配一条**同流程的红灯**（删掉登记 ⇒ 必须变红），否则绿灯只是巧合。
  判例引用：BD-38（本条即其关单结论）；同族判例 = `ctx/BUDGET.md` 的 Top-20 自指导致两遍才达不动点（`build-context-index.mjs` 收敛循环注释）。

- **[工具链][K-049] 自测夹具必须由被测生成器播种、依赖按整目录拷贝，否则门禁一扩就整片假红**（来源 WXG-T-121 / BD-39，改 `tools/scripts/context-usage-selftest.sh`，2026-09-16）
  现象：`context-usage-selftest.sh` 在 `3fa3be4`（改动前）与 `e9664da`（改动后）两个点上都测出 **FAIL=63**（组 [6]~[11] 整片红），而它既不在 `verify` 步骤表也不在 CI ⇒ 红了很久无人知晓；BD-39 记的「`kb:selftest` 首跑即 4 FAIL」是同族第二例 ⇒ 判定为**存量腐烂**，不是本轮引入。
  根因（两处，同一形状：**手写清单追不上正本扩张**）：① 桩只 `cp` 了 `lib/` 里两个模块，而 `check-context-budget.mjs` 后来 import 了 `lib/memory-index.mjs` ⇒ 桩里 `ctx:check` 直接 `ERR_MODULE_NOT_FOUND` 崩；② 桩**手写** `ctx/index.json`（固定列 5 个文件），而 ctx 门禁的「生成物集合」后来扩到 `ctx/BUDGET.md` + `memory/INDEX.md`，且 `ctx:check` 自身会回写 BUDGET/hot-files ⇒ C 门恒报「索引过期 / 未收录的新 .md / memory/INDEX.md 缺失」。附带一条：桩仓库没有 `memory/` 目录时 `ctx:build` 写生成物直接 ENOENT 崩。
  规避：① 拷依赖用**整目录通配**（`cp "$SCRIPT_DIR"/lib/*.mjs`），不要手写文件清单——清单不会跟着 import 长；② 夹具里的**索引与产物不要手写**，跑一次被测生成器播种（build 之后再注入本轮要改的度量文件），门禁扩容时夹具自动跟上；③ 桩仓库必须预置生成器的**写盘目录**（`memory/` 等），缺目录会让被测工具崩在 ENOENT 上、把夹具问题伪装成工具缺陷；④ 修完 ①② 后 **63 → 0**（172 条断言全绿）；且动手前先取「历史点同测」证据（`git worktree` 跑同一自测），否则无法区分「我改坏了」与「早就红了」。
  判例引用：BD-39（本条即其修法）；同族 K-036（短路后的 ✅ 不构成证据）、K-048（装置自指须取工作树字节）。

- **[工具链][K-058] 「已写进 .gitignore」不等于「已排除出索引产物」——枚举型走盘生成器只认自己的硬编码跳过集**（来源 WXG-T-176，改 `tools/scripts/lib/context-index.mjs`，2026-09-19）
  现象：`my-skills/_repos/**`（外来 skill 上游 git 克隆）**早已在 `.gitignore` 里**，但 `pnpm run ctx:build` 仍把它的几百个 `.md` 写进受跟踪的产物 `ctx/index.json`；一次重建 **+4.6 万行 / +1.17 MB**，并随一次无关提交被固化。更糟的是**门禁全绿**（`ctx:check` A/B/C/D/E3 全过）⇒ 体积漂移在无任何告警的情况下发生。
  根因：`listMarkdown()` 用 `readdirSync` 递归走**磁盘**，跳过条件只有「点目录」与硬编码 `SKIP_DIRS`（逐段 `entry.name` 匹配），**既不读 `.gitignore` 也不问 git**。`.gitignore` 与「索引面」是两套互不相知的口径：前者管 git 看不看，后者管装置读不读。凡是「产物由走盘生成器写出且被跟踪」的装置，都会有这个缝。
  规避：① 排除一个目录要改**生成器的跳过集**（本仓 = `SKIP_DIRS`，与 `archive`/`temp`/`library` 同处），别只改 `.gitignore`；② 判定口径先看代码再看直觉：`grep -n "readdirSync\|SKIP_DIRS" <生成器>` 两行就能确认它读不读 git；③ 提交受跟踪的**生成物**前比一次**体积/行数差**（`wc -l`、`du -h`、`git show HEAD:<产物> | wc -l`）——门禁不报的量级跳变，就是靠这一步抓出来的；④ 若生成器与校验器**共用同一常量**（本仓 `check-context-budget.mjs` 复用 `SKIP_DIRS`），改一处两边同口径；若各写一份，就必须两处同改（同族 K-047 路径写死会漂移）。
  判例引用：同族 K-048（装置自指须取工作树字节，别信报告值）、K-036（门禁全绿不构成证据）、K-051（纸面推论须实测复算）。

- **[工具链][K-066] 长期分支间用 squash 同步 ⇒ 下次同步「全域冲突」，且 3-way 会静默产出重复定义**（来源 WXG-T-179 beads-studio 发布，2026-09-20）
  现象：`develop → master` 首次开 PR 即 `mergeable_state=dirty`，一次列出 `.gitignore` / `AGENTS.md` / `ctx/*` / `package.json` 等几十个「早该一致」的文件。更险的是 `-X ours` 强合后**非冲突块静默带入 master 旧版**：`tools/scripts/check-context-budget.mjs` 出现**两个同名 `checkStagedFreshness()`**（ESM 下函数声明可重复、后者覆盖前者 ⇒ 不报错但行为漂移），`ctx/index.json` 被灌进 447 行陈旧内容。
  根因：上次同步（PR #3）用了 squash —— squash 造出与 develop **无血缘**的新提交，两条分支各自携带「同内容、不同祖先」的历史，之后任意方向的合并都被判成全量互改；而 3-way 只对「两侧都改且行重叠」的块报冲突，行不重叠时双方都留 ⇒ **语法合法、语义错误**的重复定义不触发任何提示。
  规避：① 长期主干间同步**只用 merge commit**（或 rebase），squash 只留给单 PR 内的细碎提交；② 历史已被污染时先**反向吸收**（develop 上 `git merge -X ours origin/master`）让 master 成祖先，再开正向 PR；③ `-X ours/theirs` 后**必核合并树** —— `git diff <合并前 develop 顶点> HEAD` 应为空，非空的每个文件逐个判「真缺功能」还是「历史重复」（本例靠这条抓到重复函数）；④ 生成物（`ctx/*`、`*-data.ts`）冲突后一律**重新生成**再比，不手工挑块；⑤ 合并完跑全量 `verify`，别只看「没有冲突标记」。
  判例引用：合并提交 `4efc511`（develop 反向吸收 master）、`tools/scripts/check-context-budget.mjs`（重复函数案）；同族 K-030（产物新鲜度假绿）、K-046（工作树与主表错位）。
  追记（同日）：**收紧一条已生效的阈值前必须先普查存量数据**。本轮一度把 `header-max-length` 100→96（躲 `* ` 前缀），差一步提交——实测 develop 上仍有 98 / 99 字符的历史标题，而 PR 阶段是**逐条**校 `base..HEAD` 全部提交 ⇒ 新阈值会把下一次 `develop → master` 的 PR 直接判红且历史不可追修。规避：改上限/加严规则前，先跑一次「存量有多少条会立刻违规」的计数（`git log --format=%s | awk 'length>96'` 一类），非零则改走「对新数据生效、对旧数据兜底」（此处 = 工作流按提交类型收窄校验范围），而不是硬收紧。

- **[工具链][K-081] 台账详情节的节标题只认「整行形状」：`## WXG-T-0NN` 后带文字 = 节静默丢失**（来源 WXG-T-214，2026-09-26）
  现象：补 `WXG-T-214` 详情节时标题写成 `## WXG-T-214 beads·…`（id 后带描述），`check:tasks` 立即红「详情里没有 ## WXG-T-214 小节」——节就写在文件末尾。
  根因：解析器 `tasks-detail.mjs::HEADING_RE = /^##\s+(WXG-T-\d+)\s*$/` 只认**纯 token 整行**（防误切正文 `##`），id 后带文字即不匹配；配对检查（C 项）是唯一拦截点。
  规避：① 机器解析的 Markdown，**标题行必须是纯 token**，描述另起一行；② 补完详情节必跑 `check:tasks`；③ 解析器形状变更时同步自查脚本。
  判例引用：`tools/scripts/lib/tasks-detail.mjs`、`check-tasks.mjs` C 项；同族 K-035。
