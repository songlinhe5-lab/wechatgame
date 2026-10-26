# lessons · `toolchain-git` 分片（标签 `工具链Git`）

> `工具链` 片越 ctx B 门（8000 tok，WXG-T-235 沉淀批 8411）⇒ 按 `knowledge/INDEX.md` §4
> 「该标签内部再切」取向，把**版本控制 / 钩子 / 提交信息**类条目（K-001/031/048/093）子切为
> `工具链Git` 新标签新片；条目正文逐字节搬运，仅行内标签换名。
> ⛔ 本片**不新增任何豁免**（判例 WXG-T-041 + K-025「特殊豁免要早删」）。
> 引用只写 **K-0NN**；口径正本见 `knowledge/INDEX.md` §1–§4。

## 工具链Git

- **[工具链Git][K-001] commitlint 自定义规则必须经 plugins 数组注册**（来源 WXG-T-021 / 修复 commitlint.config.mjs，2026-09-12）
  现象：任何提交都失败，commitlint 崩溃 `RangeError: Found rules without implementation: subject-no-cn-stop, task-id-required`。
  根因：把自定义规则函数直接内联进 `rules` 表——commitlint 不支持，只认配置项；自定义规则实现必须经 `plugins: [{ rules: {...} }]` 注册，`rules` 表只写 `[级别, 'always']`。
  规避：新装 lint 类钩子后，先用一条正常消息 + 一条违规消息双测再投入使用；「实测可用」的注释要能复现。

- **[工具链Git][K-031] 多产物生成器新增产物时，必须同任务登记 pre-commit 的 `git add` 清单**（来源 WXG-T-036 / 修复 `.githooks/pre-commit`，2026-09-13）
  现象：`ctx:build` 新增第二产物 `ctx/hot-files.md`（协议第二跳，WXG-T-036 q-1），但 pre-commit 仍只 `git add ctx/index.json ctx/BUDGET.md` → 该文件**永不入库**：CI 干净检出无此文件、`ctx/ROUTES.md §0` 第二跳指向空、A 项预算表缺行，且每次提交都被重建却始终停留在工作区。
  根因：pre-commit 的暂存清单是**硬编码枚举**，与生成器实际落盘产物之间**无任何联动校验**；漏 add 完全静默（无报错、无告警、本地 `ctx:check` 因工作树存在该文件而**假绿**），只在另一台机器 / CI 才暴露。
  规避：① 生成器每新增一个落盘产物，**必须在本任务内**同步改 `.githooks/pre-commit` 的 `git add` 行，并跑一次真实提交验证入库；② `ctx:check` FAILED 段的修复提示文案同样枚举产物（`check-context-budget.mjs` 三处），须一并更新；③ 根治形态 = 产物清单常量化（单一真源）+ 门禁断言「生成器产出集 == 暂存清单」，当前以人工纪律替代。
  同类：与 `ctx/reads-ledger.jsonl` 的 commit 清单、记忆层「固定 tag + `compose pull` = 永不更新」同属**枚举清单漏项 → 静默失效**族，判据是「清单是人写的枚举，且没有断言会因漏项而红」。

- **[工具链Git][K-048] 装置自指文件必须让索引取工作树字节，否则重建-add-校单遍不收敛**（来源 WXG-T-112 / BD-38，改 `tools/scripts/lib/context-index.mjs::WORKTREE_AUTHORITATIVE` + `check-context-budget.mjs` 新增装置自指对账门，2026-09-15）
  现象：pre-commit 的 ctx 段是「`ctx:build --staged-blobs` → `git add` 四个产物 → `ctx:check --staged` 兜底」。只要提交会让 `memory/INDEX.md` 换字节（改日记即触发），**第一遍必报**「暂存内容与刚重建的索引仍不一致 — memory/INDEX.md」，原样再提交一次才绿。
  根因：`memory/INDEX.md` 与 `ctx/BUDGET.md` / `ctx/hot-files.md` 同为 `ctx:build` 自己的产物，但只有后两个列进了 `WORKTREE_AUTHORITATIVE`。未登记的那个在 build 期间被本进程改写成新字节，而 `buildIndex()` 对它取源仍走 committed / staged-blobs 分支（dirty → HEAD blob、已暂存 → 暂存 blob）⇒ 索引记**上一轮字节**；钩子随后 `git add` 把**新字节**送进暂存区 ⇒ 终校验必红。取证一眼可辨：`ctx/index.json` 里该文件的 sha 等于 `git show HEAD:<path>`，却不等于暂存 / 工作树的 sha。
  规避：① 新增 `ctx:build` 写盘的 .md 时，**同时**登记进 `WORKTREE_AUTHORITATIVE` 与钩子的 `git add` 清单，两处缺一不可；② 别指望「先写产物、后建索引」的顺序调整能修好（WXG-T-072 当时只做了这件事，实测仍需两遍）——决定项是**取源分支**，不是写入顺序；③ 也别归因成「作者手跑了 `ctx:build` 才脏」：隔离 worktree 实测三种起手（只暂存自有 .md / 手跑 build 并 add 产物 / 手跑 build 不 add 产物）**第一遍全红**，最规范的用法一样中招；④ 把不变式机械化——`ctx:check` 的「装置自指对账」`C:` 级项断言生成物集合 ⊆ 工作树权威集合，漏登记当场报红并直接给出修法位置，而不是留给下一个提交的人去撞。
  判据推广：生成器注释里任何「我这一步写完就与磁盘同源了」的断言，都必须有**跨模式**（committed / staged-blobs / working-tree）的取源断言背书，否则它就是下一个 BD-38；自测里要配一条**同流程的红灯**（删掉登记 ⇒ 必须变红），否则绿灯只是巧合。
  判例引用：BD-38（本条即其关单结论）；同族判例 = `ctx/BUDGET.md` 的 Top-20 自指导致两遍才达不动点（`build-context-index.mjs` 收敛循环注释）。

- **[工具链Git][K-093] 提交信息 body 里的 markdown 表格会被 commit-msg 钩子拦下，且报错文案指向的规则清单是误导**（来源 WXG-T-235，2026-10-03）
  现象：用 `git commit -F -` 提交带 markdown 表格（`| … |`）的长说明 ⇒ `[commit-msg] ❌ 提交信息不符合仓库规则（type / scope / header 长度 / 句号 / task-id）`。但这五项**逐一核对全部合规**（type/scope 齐备、header 远短于 100、无句号结尾、正文含 `WXG-T-` 号）；把 body 换成**无表格的纯文本**（保留同样的信息量）⇒ 一次通过。
  根因：commitlint 解析提交信息时，表格行与注释/脚注块的解析互相干扰，导致判定失真；而报错文案给的是**通用规则清单**（哪条都可能），不是定位信息 ⇒ 容易误判成「某条规则没满足」，于是反复去改 header（越改越坏）。
  规避：① 提交信息**只用纯文本**（`·` / `-` / 缩进列表；不用 `|` 表格）——本仓的 `kb:*` 工具与 `memory/` 记账同样按这个口径写。② 钩子报错时**先做二分**：同一 header 换纯文本 body 试一次；能过就说明问题在 body 而非 header。③ 报错文案里的规则清单是**提示不是定位**，不要照着它逐条改 header。
  判例引用：`.githooks/commit-msg`、`docs/ci/commit-and-review-rules.md` §2、`commitlint.config.mjs`（`localRules`：`subject-no-cn-stop` / `task-id-required` 均经 `plugins` 注册）；同族 K-001（自定义规则须经 `plugins` 数组注册——两条都属"钩子报错文案 ≠ 真实触发项"）。

- **[工具链Git][K-136] 文档批「本地门全绿」可以是假绿：`ctx:check` 默认校验 HEAD，暂存态超限只有 pre-commit 看得到**（来源 WXG-T-289 续批 / commit 4f14028，2026-10-17）
  现象：给 `games/beads/design/ux/arc-level-select-spec.md` 回写七处自陈句后 `pnpm run ctx:check` 报「结构门 A/B/C/D/D2 全部通过」，会话结论据此写下「未超限」；同一内容 `git commit` 被 pre-commit 拦停 —— B 项实测**暂存态 8105 > 单文件上限 8000**。同一条命令两次结论相反。
  根因：`ctx:check` 的默认口径 = **已提交内容（HEAD）**（索引服务于跳会话读取，描述的是 HEAD 的文件与行号），尚未提交的正文增补完全不在它的视野里；只有 pre-commit 走的 `--staged` 分支才量暂存 blob ⇒ 「本地跑过门」对**未提交**的文档改动无效。
  规避：① 文档批自检固定**成对**跑：`pnpm run ctx:build -- --working-tree && pnpm run ctx:check -- --working-tree`（只切校验侧 ⇒ C 项对每个 dirty 文件必 FAIL），提交前再由 pre-commit 的 `--staged` 兜一次。② 越 8000 门的处置按 `knowledge/INDEX.md §4`「该标签内部再切」/ 压缩措词（只保留一份批号、叙事归分片），⛔ 不新增豁免（本批即由 8105 压回 7960，余量 40）。③ 汇报「门绿」必须写明**校验对象是 HEAD 还是工作树/暂存**，否则结论对下一会话不可复现。
  判例引用：K-036/K-037（门禁可信度与取证层次）、K-093（钩子报错文案 ≠ 真实触发项）——三条同属「工具结论要能复现」。
  追记（2026-10-24，WXG-T-375 续批 · **同族反向：同一时点错位造成的假 FAIL**）：台账回写与全量 `verify` 并行推进时，`verify` 里的 `check:tasks` 会拿到**假 FAIL** —— 本批先启动 `verify`、随后才写 375 的主表行与详情节，得 `PASS 21 / FAIL 1`，唯一红项就是 `check:tasks`（A/C 门：主表行数 ↔ `## WXG-T-###` 节数配对不上），而台账补齐后单跑 `pnpm run check:tasks` 即刻 OK，且当时 `test` 等其余 21 项已 PASS ⇒ 红项不是代码问题。根因与上一条相同：门禁校验的是**它运行那一刻的文件状态**，没有「你验早了」这个判据，只会把中间态报成形状不符；方向相反（K-136 是漏检未提交内容 ⇒ 假绿，本条是读到写了一半的台账 ⇒ 假红）。规避：① 长跑门禁（`verify` / `selftest:fast`）一律排在**台账与文档回写完成之后**启动，⛔ 与编辑并行；② 拿到 FAIL 先看红项归属：形如「主表行数 ≠ 节数」「头注号 < 全局最大号」这类**结构性配对**红，先确认自己最后一次编辑是否已保存，再怀疑代码；③ 推翻结论要两条一起给——「单跑该门 OK」+「全量复跑 PASS 22 / FAIL 0」，⛔ 只凭单跑推翻全量，也⛔ 凭一次全量红就改代码。
  追记（2026-10-25，WXG-T-378 · **假红面扩到 `selftest:fast` 内部，且与真红同批出现**）：把 `verify` 起在后台、**同时**开始写台账，结果 `selftest:fast` 里 `tasks:archive:selftest` 掉到断言 **64/75**——它读的是活文件 `production/TASKS.md` / `TASKS-DETAIL.md`，「主表行已加、详情节未加」就是它眼里的行节不配对。同一轮里 `verify:selftest` exit 1 则是**真问题**（主表行内命令的竖线被当列分隔符 ⇒ `check:tasks` 列数溢出，见同批 WXG-T-378 的流程台账条）。两条红混在一起，最容易的错结论是「装置自测坏了，忽略它」。规避：① 「verify 排在台账回写之后」再收紧为「**台账写入期间不跑 verify 及其装置自测**」；② `tasks:archive:selftest` 这类 **64/75 部分失败**先问自己是否正在改台账，再看是否真回归；③ 同批多红必须逐条归因（哪条是中间态、哪条是代码/文档真错），⛔ 一律当假红刷掉。

- **[工具链Git][K-159] `git commit` / `git push` 的输出接 `head`、`tail` 会被 SIGPIPE 中断，留下「索引已暂存、HEAD 未动」的半态**（来源 WXG-T-349 / commit f4923f1，2026-10-22）
  现象：只想看提交输出的前几行，跑 `git commit -F msg.txt | head -6` ⇒ **提交根本没发生**：`git show HEAD` 仍是上一笔，`git status --short` 却显示 4 件已暂存。长得像「钩子拦了」或「静默失败」，实际是 `head` 读够 6 行就退出，git 往已关闭的管道写下一行时收到 SIGPIPE 被杀。
  根因：SIGPIPE 默认终止进程；`git commit` 在打钩子输出与摘要的中途被杀 ⇒ 对象可能已建、ref 未移动，比「提前失败」更难判读（同一条命令里只有写副作用的那一步会被杀，`git log | head` 无损）。
  规避：① 要截断就**先重定向到文件**（`git commit -F msg.txt > out.txt 2>&1`），再对那个文件 `grep`/`tail`；② 硬规则：**有副作用的 git 命令（commit / push / tag）一律不接管道截断器**，只读命令才可；③ 事后判「到底提上没有」只认 `git log -1 --format=%h` + `git status --short`（索引是否空），⛔ 靠管道里的输出行数推定。
  判例引用：K-045（提交 = 索引全集，半态的另一面）、K-142（推送取证认 `ls-remote` + `reflog`，同属「不靠界面残留推定终态」）、K-010（沙箱管道怪象——机制不同：那条是假阴性输出，本条是进程被信号终止）。
  追记（2026-10-23，WXG-T-359 · **同族反向：副作用已经发生，脚本却在之后抛错，看着像「被拦下」**）：原子提交脚本把 `execFileSync('git', ['commit', '-F', msg], { stdio: 'inherit' })` 套进一个统一包装（内部顺手做 `.replace(/\r/g, '')` 归一化）⇒ Node 在 `stdio: 'inherit'` 下**返回 null**，包装随即抛 `TypeError: Cannot read properties of null`，脚本退出码 **1**。而 `git commit` 早已跑完全部钩子并落出提交：`git log -1` 有新 hash、`git status` 索引已空。本批连踩两次（两次都真提交成功），若当成「门禁拦下」再重跑一次，就会在同一台账上叠出两笔只改自己读数的噪声提交。规避：① **有副作用的调用不套返回值加工**（另写一个不做加工的 `raw()` 专供 commit/push，或调用后立刻 `git log -1 --format=%h` 复测再决定是否重跑）；② 脚本断言段与提交段之间加「HEAD 是否已前进」的门 ⇒ 重跑幂等；③ 判「到底提上没有」的口径不变（本条 ③：`git log -1` + `git status --short`），⛔ 以脚本退出码推定。同型坑：包装函数会**摧毁被检属性** —— 本批同一脚本里用「统一去 CR」的取回函数去断言 HEAD 的 CR 计数，结果永远得 0（假绿），须留 `raw` 与归一化两条通道。

- **[工具链Git][K-168] 查「某个字段的值被谁改过」⛔ 拿 `git log -S` 搜键名（pickaxe 数的是出现次数 ⇒ 同行换值不命中，会得到假的「从未改过」），须改 `-G` 正则或搜旧值**（来源 WXG-T-375 / commit 2b03de4，2026-10-24）
  现象：金样本夹具里记录「这批从哪个提交复取」的锚字段被从旧值改成了另一个旧 hash，想查是谁改的。先跑 `git log -S"capturedFrom" -- <夹具>` ⇒ **只列 1 笔**（该键首次引入的那一笔），真凶完全不出现，看上去像「锚字段自入库以来从未被动」；本批据此误判过一次，换 `git show <可疑 rev> -- <夹具>` 直读 diff 才看到同一行 `-…"df2eeee…"` / `+…"dc60d54…"`。
  根因：`-S` 的判据是**目标串在该文件版本两侧的「出现次数差」**（pickaxe），不是「该行内容变过」⇒ 同行只换值时键名计数不变，天然不命中；`-G` 则是对 diff 文本做正则匹配，行有增删即命中，两者不可互替。
  规避/做法：按问题分三档选口径（本批在同一文件上实跑对照）——① 问「这个键何时引入/删除」→ `-S"<键名>"`；② 问「这一行的值被谁改过」→ `-G'<键名正则>'`（实测命中 11 笔，含真凶与本批收口笔）或 `-S"<旧值>"`（搜值而非搜键 ⇒ 删除侧计数下降即命中，实测命中 2 笔且含真凶）；③ **空结果 / 少结果不得直接当结论**，必须换一条不同判据复核（两条口径给同一个答案才叫证据）；生成物里的 provenance / 时间戳 / 来源锚这类「同行换值」字段一律走 ②。
  判例引用：`games/beads/tests/__fixtures__/wxg-t-298-ui-golden.json` 的 `capturedFrom`（356 批 `3611904` 起失真、WXG-T-375 批 `2b03de4` 改回真实基）、登记正本 `docs/architecture/ui-architecture-beads.md §12`；同族 K-096（把当日推测当永久事实）、K-051（推论须差分复算）、K-159（同页：git 命令的半态与取证口径）。

- **[工具链Git][K-178] `.gitignore` 的目录型规则（带尾斜杠）不匹配同名软链 ⇒ 隔离工作树里软链的 `node_modules` 漏成未跟踪**（来源 WXG-T-412，2026-10-26）
  现象：按 `using-git-worktrees` 建隔离工作树后把主仓依赖软链进来，树内 `git status --porcelain` 立刻露出 4 条 `?? node_modules` / `?? packages/framework/node_modules` / `?? games/{beads,breakout}/node_modules`；同一 `.gitignore` 在主仓跑却干净 ⇒ 看上去像「worktree 不继承忽略规则」（其实继承了）。
  根因：`node_modules/` 是**目录型规则**，git 匹配时要求该路径自身是目录；软链在 git 眼里是 symlink 而非 dir ⇒ 规则不命中。主仓里 `node_modules` 恰是真目录，所以这条自建仓就在的规则一直没被软链场景考验过。
  规避/做法：① 给「可能是软链」的路径写忽略一律用**无尾斜杠**形式（`node_modules` 同覆盖目录与软链，代价仅「也匹配同名普通文件」）；② 定性靠最小 repo 差分而⛔不在 worktree 现场猜：`git init` 空仓 + `mkdir real` + `ln -s real node_modules`，把两种写法各跑一次 `git status --porcelain` ⇒ 带斜杠那条列出 `?? node_modules`、无斜杠那条不列，一次坐实；③ 反向坑同批出现：目录型规则用 `git check-ignore -v <路径>` 能看到**命中哪一行**，⛔ 只凭 `-q` 的退出码下结论——本会话据此误判 `.worktrees/`「未被忽略」并加了重复规则，实测 `check-ignore -v .worktrees/x` = 命中 `.gitignore:129:.worktrees/`（WXG-T-160 `76392174`，2026-09-18 已入库），重复块已撤。
  让位注（2026-10-26 同日）：本仓那条**无斜杠写法的入库者是对方 WXG-T-411 批**（`467aa574`，注释亦标「WXG-T-411 用最小 repo 复现」）⇒ 本会话（WXG-T-412）rebase 时撤下自己那版，不占第二次 diff，判据面只留本条。同批教训：并发会话会与你独立找到同一个根因，**先 grep 再写**（K-046 的精神同样适用于修法）。
  判例引用：K-058（同族另一向：走盘生成器不读 `.gitignore`，排除面要看生成器枚举）、K-168（同一问题必须换第二条口径复核才叫证据）、K-179（同一批 rebase 撞出的标记残留）；正本 `memory/MEMORY.md` §项目约定「会话隔离工作树」。


- **[工具链Git][K-179] 解完 merge ≠ 解对：冲突标记能整块提交入库，本仓五道门无一拦**（来源 WXG-T-412，2026-10-26）
  现象：`origin/develop` 的 `467aa574`（提交信息 `wip: merge resolution done`）里 `production/TASKS.md` 第 5–9 行仍是 `<<<<<<< HEAD` / `=======` / `>>>>>>> f871ad88` 三段标记，中间夹着**两条各 49,203 字符的重复头注行**；`SequenceMatcher` 实测两条只差「411/412」与「410/411」两个数字 ⇒ 删一条不丢内容。该笔已推送成功，下一会话直到 rebase 才撞见。
  根因：pre-commit 五道门（`check:secrets` / `check:links` / `check:plugins` / `check:mcp` / `check-tasks --staged`）判的都是结构面（列数、配对、头注号、锚点），**没有任何一腿 grep 冲突标记**；而 `check-tasks` 头注判据按 `当前已分配至` 取命中值，重复行与标记活在「一条合法头注的两侧」，F 项照样绿。
  规避/做法：① 解完冲突、提交前跑一次 `git grep -nE '^(<<<<<<< |>>>>>>> )' -- .`（一条命令、零判据漂移）；② 接手他人留下的冲突面时先做**字符差分**再决定删哪条，⛔ 凭「看起来一样」删行；③ 机械门已落地（WXG-T-415，2026-10-26）：`check-secrets.mjs` 的 `CONTENT_RULES` 加 `CONFLICT-MARKER` 一腿，判据 = **行首** 7 个 `<` 或 `>`（`=` 那一段刻意不查——markdown setext 标题的下划线正是行首一串 `=`，查它就是把门禁变成噪声源；而未解冲突必然成对带 `<<<<<<<` 与 `>>>>>>>`，任一条命中即可拦下）⇒ 复用该脚本既有扫描面与 pre-commit ⓪ / `verify` / CI 三处接线，零新脚本、零改钩子；负样本复取 = 拿事故原文 `467aa574:production/TASKS.md` 喂 `--root` 桩，实测 FAIL 命中 L5。
  判例引用：K-045（共享工作树协作损伤谱系，本条属「他人解冲突解不净」那一面）、K-168（同一问题换第二条口径）、K-181（补这条腿时发现它自己的自测也没挂档）；正本 `production/TASKS-DETAIL.md` `## WXG-T-412` §4/§6/§7、`## WXG-T-415`。

- **[工具链Git][K-180] `git rebase --continue` 不跑 pre-commit ⇒ 钩子里「自动重建并 re-add」的产物（ctx 三件 + `memory/INDEX.md`）不会进结果提交**（来源 WXG-T-412，2026-10-26）
  现象：同一隔离树内两次建同内容提交做 A/B —— 手工 `git commit` 打印全套钩子回显（secrets / links / plugins / mcp / tasks / ctx:build / ctx:check）且结果含 ctx；`GIT_EDITOR=true git rebase --continue` 只回显 `[分离头指针 …] …` **零钩子输出**，结果提交 8 件、ctx 三件不在其中，而 `production/TASKS{,-DETAIL}.md` 已改 ⇒ HEAD 里索引相对文档是**过期**的。
  根因：git 对 rebase / cherry-pick 的重放提交不执行 pre-commit（本仓实测；`core.hooksPath` 也救不了，这是调用面而非配置面）。本仓把「重建索引 → re-add → 终校验」整段写在 pre-commit 钩子里（WXG-T-032 ⑤），所以凡走 rebase 入库的提交都绕过了它。
  规避/做法：① rebase 完不要直接把结果当成品：`pnpm run ctx:build` → `git add ctx/index.json ctx/BUDGET.md ctx/hot-files.md memory/INDEX.md` → `git commit --amend`（amend 走正常 `git commit` 路径，钩子会再跑一遍并终校验）；② 判据别只看 `git status` 干净——用 `pnpm run ctx:check`（默认 HEAD 口径）核一次；③ 这也解释了「本地提交绿、CI 干净检出红」的一类偶发。
  判例引用：K-136（暂存态与 HEAD 态两套口径的假红/假绿家族）、K-168（同一问题换第二条口径）；与 `memory/MEMORY.md` §项目约定「会话隔离工作树」的 rebase 子条同源。

- **[工具链Git][K-181] 裸 `--selftest` 模式没有 package.json 入口时，就落在自测完整性守卫的枚举面之外 ⇒ 装置自测可以长期零执行而无人知**（来源 WXG-T-415，2026-10-26）
  现象：`check-secrets.mjs` 的 `--selftest` 自 WXG-T-047 起就有 18 条腿，但 `package.json` 无 `check:secrets:selftest` 入口、`selftests.mjs::TIERS` 里也没有它 ⇒ `verify` 与 CI 的 `selftest:fast` **从未跑过**（`git log -S'"check:secrets:selftest"' -- package.json` 零命中）。本轮给它加 6 条冲突标记腿时才实测确认。
  根因：`selftests.mjs::guardCoverage()` 只枚举两类线索——`package.json` 里以 `:selftest` 结尾的脚本名、`tools/scripts/*-selftest.sh` 文件名；**脚本内的 `--selftest` 选项不在枚举面**。⇒ BD-39 那一族「有门、但没人跑自测」在 `*.mjs` 上换了形态复现（`.sh` 形态反被守得住，因为它有文件名线索）。
  规避/做法：① 新写 `*.mjs --selftest` 时**同批**补 package.json 入口 + `TIERS` 档位项，两者名字须一字不差（守卫按脚本名比对）；② 盘点未挂档的自测用差集而非印象：`grep -l "selftest" tools/scripts/*.mjs` 减去 package.json `*:selftest` 指向的脚本 —— 本仓实测三件命中：`check-secrets.mjs`（本单已挂档）、`build-mcp-configs.mjs`、`check-plugin-anchor.mjs`（后两件登记遗留，见 `## WXG-T-415` §7）。
  判例引用：K-025（豁免一旦存在，真实问题会被一起放过）、K-036（短路后的 ✅ 不构成证据）、K-168（同一问题换第二条口径）；正本 `production/TASKS-DETAIL.md` `## WXG-T-415` §2/§4。
