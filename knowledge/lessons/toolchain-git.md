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

- **[工具链Git][K-159] `git commit` / `git push` 的输出接 `head`、`tail` 会被 SIGPIPE 中断，留下「索引已暂存、HEAD 未动」的半态**（来源 WXG-T-349 / commit f4923f1，2026-10-22）
  现象：只想看提交输出的前几行，跑 `git commit -F msg.txt | head -6` ⇒ **提交根本没发生**：`git show HEAD` 仍是上一笔，`git status --short` 却显示 4 件已暂存。长得像「钩子拦了」或「静默失败」，实际是 `head` 读够 6 行就退出，git 往已关闭的管道写下一行时收到 SIGPIPE 被杀。
  根因：SIGPIPE 默认终止进程；`git commit` 在打钩子输出与摘要的中途被杀 ⇒ 对象可能已建、ref 未移动，比「提前失败」更难判读（同一条命令里只有写副作用的那一步会被杀，`git log | head` 无损）。
  规避：① 要截断就**先重定向到文件**（`git commit -F msg.txt > out.txt 2>&1`），再对那个文件 `grep`/`tail`；② 硬规则：**有副作用的 git 命令（commit / push / tag）一律不接管道截断器**，只读命令才可；③ 事后判「到底提上没有」只认 `git log -1 --format=%h` + `git status --short`（索引是否空），⛔ 靠管道里的输出行数推定。
  判例引用：K-045（提交 = 索引全集，半态的另一面）、K-142（推送取证认 `ls-remote` + `reflog`，同属「不靠界面残留推定终态」）、K-010（沙箱管道怪象——机制不同：那条是假阴性输出，本条是进程被信号终止）。
  追记（2026-10-23，WXG-T-359 · **同族反向：副作用已经发生，脚本却在之后抛错，看着像「被拦下」**）：原子提交脚本把 `execFileSync('git', ['commit', '-F', msg], { stdio: 'inherit' })` 套进一个统一包装（内部顺手做 `.replace(/\r/g, '')` 归一化）⇒ Node 在 `stdio: 'inherit'` 下**返回 null**，包装随即抛 `TypeError: Cannot read properties of null`，脚本退出码 **1**。而 `git commit` 早已跑完全部钩子并落出提交：`git log -1` 有新 hash、`git status` 索引已空。本批连踩两次（两次都真提交成功），若当成「门禁拦下」再重跑一次，就会在同一台账上叠出两笔只改自己读数的噪声提交。规避：① **有副作用的调用不套返回值加工**（另写一个不做加工的 `raw()` 专供 commit/push，或调用后立刻 `git log -1 --format=%h` 复测再决定是否重跑）；② 脚本断言段与提交段之间加「HEAD 是否已前进」的门 ⇒ 重跑幂等；③ 判「到底提上没有」的口径不变（本条 ③：`git log -1` + `git status --short`），⛔ 以脚本退出码推定。同型坑：包装函数会**摧毁被检属性** —— 本批同一脚本里用「统一去 CR」的取回函数去断言 HEAD 的 CR 计数，结果永远得 0（假绿），须留 `raw` 与归一化两条通道。
