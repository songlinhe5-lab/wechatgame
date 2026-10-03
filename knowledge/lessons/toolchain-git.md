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
