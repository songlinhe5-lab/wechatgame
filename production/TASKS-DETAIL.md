# WXG 任务台账 · 详情（标题制正文侧）

> **为什么拆开**：`production/TASKS.md` 曾**81% 的体积是任务行详情**（16 行 ≈ 5334 tok，中位行 389、最重 613），
> 而 `tasks:archive` 只清**已完成**行 ⇒ 每个新任务仍带入 400–600 tok ⇒ 反复撞 `ctx:check` **B 项单文件 8000**。
> 拆法：主表只留标题，正文落这里**一任务一节**（原文本原样搬，未改写）。
>
> **怎么读（协议，见 `ctx/ROUTES.md` 与主表头注）**：
> 1. **领号只读头注**：`grep -n '当前已分配至' production/TASKS.md` ⇒ 读那一行（≈30 tok）；要**看全部任务状态**才读主表（≈2.4k tok）；
> 2. 要某任务详情时，从 `ctx/index.json` 里**本文件该小节**的 `startLine`/`endLine` 取范围，
>    `read_file(path, offset, limit)` **只读那一节**（中位 ≈ 290 tok）——**不要整读本文件**。
>
> **配对纪律（由 `pnpm run check:tasks` 机械强制）**：主表有行 ⇔ 本文件有同名小节；
> 归档时**行与小节成对搬走** —— 由 `pnpm run tasks:archive` 机械执行（WXG-T-065：行进
> `archive/TASKS-archive.md`、节进 `archive/TASKS-DETAIL-archive.md`，节数 == 行数），故本文件只留在办 / 近期任务。

---

## WXG-T-069

- **名称**：把 `knowledge/` 与 `memory/` 的**使用触发协议**写进文档（回答「memory 该什么时候用」）。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **背景**：用户提问「每次新窗口加载 knowledge 确认经验教训，那 memory 什么时候用？」。查证后发现**用户的前提与现协议相反**：`AGENTS.md:118` 的 knowledge 读法是「**实现/修复/接入/发布类任务开工前**读 `lessons.md` **同域**条目」（按任务触发，非每窗口无条件）；而**被挂进四个 IDE** 的（三个符号链接 + Cursor 指针，`AGENTS.md:21-25`）是 `memory/MEMORY.md`。真正的缺口是 `my-rules/agents-md.md:13` 把 memory 的用法写成含糊的「需要活上下文时 Read」✗。
- **落地（四处，各司其职、不重复）**：① `my-rules/agents-md.md`（常驻，最省字）只放**四个触发词**；② `AGENTS.md` 在 knowledge 段旁补**对称的 memory 段**（此前只有 knowledge 半边 ✗）；③ `memory/INDEX.md §1` 放**完整协议**（四触发 + grep 查法 + 例行用途 + 与 knowledge 的分工口诀）；④ `knowledge/INDEX.md §1` 加镜像一句分工。
- **协议要点**：`MEMORY.md` 可常读；日记**只在四触发下查** —— **改旧政之前**（查当初为什么这么定）/ **接续未完成工作** / **追溯用户原话与裁定**（本层**独有**的权威记录）/ **排障找当初的确诊法**。查法 = `grep -n '<任务号或关键词>' memory/INDEX.md` 定位到「哪一天 / 哪一节 / 行区间」→ `read_file` **只读那一节**（几百 tok，而非 3.2 万）。例行用途只有一条：满 30 天蒸馏时重读那一天的节。
- **预算纪律（本任务的主要约束）**：`AGENTS.md` 1743 → **1859 / 2000** ✅、`my-rules/agents-md.md` 374 → **413 / 500** ✅ —— 常驻层每个字**每次会话都付费** ⇒ **触发词进常驻、完整协议进按需层**；`memory/INDEX.md` 3811 → 4248、`knowledge/INDEX.md` 3170 → 3319（皆按需层、无硬门）。
- **顺带验证机制**：改完 §1 后重跑 `ctx:build` ⇒ **手写前言原样保住、生成块完好** ⇒ WXG-T-068 的「手写协议在外、生成表在内」规格成立（这条不是推理，是跑出来的）。
- **产出**：my-rules/agents-md.md · AGENTS.md · memory/INDEX.md · knowledge/INDEX.md · 本台账

---

## WXG-T-070

- **名称**：台账头注**落后**的机械门禁（F 项）——`check-tasks.mjs` 断言头注号 **≥** 主表 ∪ 归档全局最大号。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **动机（真事，非假想）**：本次 T-067…T-069 三笔登记里，我用 `str.replace` 改台账头注**静默没匹配上**（真实文案是「…建档：2026-09-12，主理人游承峰。当前已分配至 **WXG-T-066**，下一可用号…」，不含我假设的「（已完成）」✗；且那三处我**漏了 `assert`** ✗，别处却用了 ✓）⇒ 头注停在 **T-066** 而表内已到 **T-069**。唯一的告警方 `tasks:archive` **平时不跑** ⇒ 直到本次归档才暴露 —— 差一点就带着一个「已释放的号」继续领号（并行会话重号的经典成因）。
- **落地**：`check-tasks.mjs` 新增 **F 项**：头注号**落后**于全局最大号即 FAIL；**领先合法**（`tasks:archive` 明写「头注只进不退」，某会话先推进头注而对应行未落盘是正常态）⇒ 领先只出一条 note。
- **双向实测**：把头注改回 `WXG-T-066`（模拟落后）⇒ `check:tasks` FAILED 并给出修复命令；改回 ⇒ OK。
- **为什么值得单独立项**：这是一次「**修自己**」——同一类错（脚本化改文档时 `replace` 静默 no-op）本任务之前已犯过 ✗，光说「下次注意」不算修复；把它变成门禁，下次它在**提交前**就会响。
- **产出**：tools/scripts/check-tasks.mjs · 本台账

---

## WXG-T-071

- **名称**：星级表持久化 —— 实现 S8 GDD §2.2 **早已冻结**的 `stars` 字段（每关历史最高星），通关画面总览从此**跨重启保持**。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **侦察结论（纠正了我自己在 T-066 登记的第一步）**：backlog 那行写的是「① 回写 `save-progress` GDD 增字段」✗ —— 实测该 GDD **§2.2 早就冻结了** `stars | number[DEMO_LEVEL_COUNT] | 每关历史最高星（1–3；未过=0）| 过关结算时 max(旧,新)`，§2.4 给了降级规则、§6 给了小数口径、§8-2/§8-3 给了判据 ⇒ **GDD 不需要回写**，缺的是**实现**（「文档有、代码没有」，与 A4 道具图标同一类）。故本任务只做后两步。
- **落地（逐条对着 GDD，不发明规则）**：① `save-schema.ts` 增 `starsByLevel`（= GDD 的 `stars`；键名与结构归代码）+ `normalizeStars`：**长度不符 → 重置全 0**（§2.4 明文）、单值非有限 → 0、**小数向下取整**（§6）、再钳 `[0, STAR_MAX]`；**绝不弃整档**（与 `settings` 同判例），并把该字段纳入 `changed` 判定（缺字段 ⇒ 写回一次）② `tuning.ts` 增 `STAR_MAX = 3`（§3.7），`finish-panel.ts` 的 `FINISH_MAX_STARS_PER_LEVEL` 改为引用它 ⇒ 同一事实只有一个常量 ③ `beads-game.ts`：BOOT 从存档装载为内存**镜像**（与 `_sprintBestScore` 同判例）、过关时随 `_persistProgress()` 写回（§2.5「结算写」）。
- **max 语义的归属（刻意划分）**：`max(旧, 新)` 由**游戏侧**在过关时取（§8-2），schema **只钳制、不取大** —— 并有专门用例钉住「schema 不发明 max」，防两处各取一次。
- **判据**：§8-2「`stars[n-1] = max(旧,新)`；**重启保留**」用共享 storage 的两个 harness 实测（真重启语义）；§2.4/§6 降级矩阵逐条断言（长度不符、越界、小数、非有限、非数组）。新增用例 3 条 ⇒ beads **176 → 179 全过**；`save-schema.test.ts` 的「合法文档」夹具随字段新增而更新（否则它不再是合法文档）。
- **顺带清理（台账卫生）**：backlog 移除本项；另发现「台账随任务数线性膨胀」那行**其实已由 T-064/065/068 结项却仍挂在 backlog、数字也已过期** ✗ ⇒ 一并标注结项。
- **产出**：game/save-schema.ts · config/tuning.ts · systems/finish-panel.ts · game/beads-game.ts · game/state.ts · tests/save-schema.test.ts · tests/finish-panel.test.ts · cocos 拷贝件 · 本台账

---

## WXG-T-072

- **名称**：`ctx:build` 的**写入顺序闭环** —— 消除「每次提交都要手工重建一轮才过」的假失败。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **真因（读代码定位，非猜测）**：WXG-T-068 新加 `memory/INDEX.md` 产物时，我把它写在 `serializeIndex()` **之后** ✗ ⇒ `ctx/index.json` 记录的是**上一轮**的 `memory/INDEX.md` 哈希 ⇒ pre-commit 的 `C(--staged)` 每次都判「暂存与索引不一致」⇒ 当天连踩**四次**（每次都要手工 `ctx:build` + 重暂存一轮才过）。
- **修法**：改成显式三步闭环 —— ① 先以最终内容落盘 `memory/INDEX.md`（它自己也是被索引的 .md）② **再**建一次索引把它纳入 ③ 最后才 `serializeIndex()` ⇒ 磁盘上的 INDEX.md 与 index.json 记的哈希必然同源。`hot-files.md` 用「写两遍」绕开了同一问题，本处不再依赖重试。
- **实测**：修后本笔提交**首次即过**（此前连续四笔都需手工重试）。
- **如实保留的不确定性**：手工逐步复现该序列时仍能造出一次不一致 ⇒ 除「写入顺序致哈希滞后」外**可能还有第二因子**，本次未穷尽。已记录，不宣称已彻底根治（下次再遇同类拦截时应先看是否仍是 `memory/INDEX.md`）。
- **产出**：tools/scripts/build-context-index.mjs · 本台账

---

## WXG-T-073

- **名称**：归档器新增 `--detail-until-under=<N>`（体积驱动 · **详情侧**），并抽出口径唯一的 `eligibleRows()`。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **动机（同一错位当天咬人两次）**：`--until-under` 量的是**台账**，而标题制（T-064）之后台账只剩 ~2.4k，B 项压力却在**详情文件**（8274）⇒ 用台账阈值去压详情只能「凭感觉挑一个很低的数」✗（第一次在 T-065 手挑 2400；这次 `--until-under=2500` 直接**空转** ✗）。本旋钮直接量详情文件，意图与手段一致。
- **附带抽出的口径**：三条策略（默认 30 天 / `--until-under` / `--detail-until-under`）原本各自内联「可归档行」的筛选 ⇒ 我把新旋钮接到了**已被年龄筛过**的 `candidates` 上 ⇒ 默认口径下它是空的，**新旋钮静默什么都不搬** ✗。现抽成 `eligibleRows()` 单一出处，策略只负责「选多少」。
- **另一处顺序教训**：候选重算必须在 `toArchive` **派生之前**，否则「报告列了候选、计划 0 行」——与本笔的 `ctx:build` 写入顺序（T-072）是**同一类**缺陷 ✗，一日内两次 ⇒ 已同时写进两处代码注释防复发。
- **实测**：`--detail-until-under=7000` ⇒ 候选 2 行与「计划归档 2 行 + 详情节 2 节」一致（此前为 0 行）；本次即用它把详情压回 B 门内。
- **产出**：tools/scripts/archive-tasks.mjs · 本台账

---

## WXG-T-074

- **名称**：EP-07 最后一项 —— 连击特效三档（`score-combo §2.5`）的**可测半边**落码：档位↔特效一一对应 + `§3.8` 红线的结构性落实。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **规格**：形态与触发 = `score-combo §2.5`（Lv1 ×2 珠面星光粒子 / Lv2 ×3 **伪**震屏：整屏 scale 1.00→1.015→1.00、**无位移抖动** / Lv3 ×5 边缘径向光 + 珠面波浪）；**毫秒值全部来自 `ux-spec §5`**（§2.5 明写「本篇不自写」）＝ 200 / 150 / 350；`combo:up` 事件**早已登记并在发** ✓，缺的是任何消费方 ✗。
- **落地**：① 新增 `view/combo-vfx.ts`（**纯逻辑**：`tier → spec`、各档「已播毫秒 → 呈现参数」；无状态、不绘制）② `tuning.ts` 镜像 §5 三档时长 + `COMBO_SHAKE_SCALE_MAX` + `COMBO_PARTICLE_COUNT` ③ `beads-game.ts`：`combo:up` 处设 VFX（**同时只播最高档**——派生项，防叠加成闪烁）、表现层推进（PAUSED 只冻玩法不冻表现，与面板同判例）、播完即清 ④ 视图 `drawComboVfx`：Lv1 粒子锚在**落子格心**（复用 `drawGrid` 同一套格心公式 ⇒ 画在哪与判定在哪一致）、Lv3 四边径向光带 + 扫过波浪。
- **两条红线的「结构性」落实**（比注释提醒可靠）：① Lv2 的呈现类型 `ComboPseudoShake` **只有 `screenScale`、没有 dx/dy** ⇒「用位移伪造震屏」在类型层写不出来；② 三档都是**单次循环**（0→峰→0，播完即清）⇒ 本模块无任何自重复周期量 ⇒ ≤3Hz 闪烁的来源**不存在**。
- **平台缺口（如实登记，不假造）**：Lv2 需要整屏 scale，而 `RenderModelBuilder` 只产出逐图元命令、**无全局变换**（`_commands` 私有）⇒ 视图**不为它画替代物**；快照照常推进，等 Canvas/Cocos 宿主提供变换即生效。`§8-9` 的「档位一一对应」半边由此完整可测；**DevTools 帧检半边**（真闪烁 / 真位移）属真机。
- **派生项（已登记）**：粒子数取 4（§2.5 是 3–5 区间、无 RNG ⇒ 取中值）；多档重叠只播最高档。
- **判据**：新用例 5 条 ⇒ beads **179 → 184 全过**（一一对应 / 红线结构性 / 单次循环 / 游戏级起止与锚点 / 重叠取最高）。
- **EP-07 至此全部闭环**（结算·过关面板 T-063、FINISH T-066、冲刺结算 T-067、连击特效本笔）；留待真机/后续：§8-9 帧检半边、连击升档与断连的**音效**（`§4` 输出表有列、不在 §8 判据内，如实登记）。
- **产出**：view/combo-vfx.ts（**新增**）· config/tuning.ts · game/beads-game.ts · game/state.ts · view/view-model.ts · src/index.ts · tests/combo-vfx.test.ts（**新增**）· cocos 拷贝件 · 本台账

---

## WXG-T-075

- **名称**：领号协议精化 —— 「**领号只读头注**」写进 `ctx/ROUTES.md` 与本文件前言。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **动机**：领号只需要头注里那一行（**≈30 tok**），而旧读法写的是「只读主表拿号」（≈2.4k）——每次领号多付约 80 倍。且头注所在**行号会随编辑漂移**，硬编码行号必错 ✗ ⇒ 用 `grep -n '当前已分配至'` 定位（与本仓 `memory/INDEX.md §1` 的 grep 法同判例）。
- **落地**：① `ctx/ROUTES.md`「领号 / 任务台账」行改写（「看全部状态」仍保留整表读法）② 本文件前言条目 1 同步。
- **产出**：ctx/ROUTES.md · production/TASKS-DETAIL.md · 本台账

---

## WXG-T-076

- **名称**：台账 backlog 卫生门（`check-tasks` **G 项**）+ 主表行数观察哨（**H 项**，report-only）。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **动机（用户问出来的架构账）**：「分级读取后还需要 archive 吗？TASKS.md 还会膨胀吗？」——按段量化回答：头注 485（有界）/ 主表标题行 526（≈48/行、行数无门）/ **backlog 1,399（占全文 57%，唯一没有门的段）** ✗，其中一条**已结项**的删除线占位行就占 **383 tok（全文 16%）**。
- **落地**：① backlog 段重写——结项行移除、7 行全部压到 ≤160 字符、**顺带修一处坏表**（原表头后缺 `|---|` 分隔 ⇒ 30–32 与 34–38 是两张断开的表 ✗）② `check-tasks.mjs` 新增 **G 项**：backlog 行**不得用删除线占位**（结项即移除）+ **行 ≤160 字符**（只写「是什么 / 谁发现 / 下一步动作」，长分析开任务再写）③ 新增 **H 项观察哨**：主表行数 >20 只 WARN 不阻断（对齐「结构门硬、行为门软」惯例，WXG-T-026）④ backlog 段头部写纪律——闸的「立法」与「执法」放在同一处。
- **实测（双向，非假绿）**：正常态 OK；注入 246 字符行 + 删除线行 ⇒ **恰好两条 G 失败**（行长 / 删除线各一）、退出码 1；回滚 ⇒ OK。
- **口径说明（会话中已向主理人说明）**：分级读取之后，B 项「单文件 8000」对这类文件的原初理由（整读读不起）已变弱；它现在的价值是兜底。是否降级为「节数门」属独立架构决定，本次不动。
- **产出**：tools/scripts/check-tasks.mjs · production/TASKS.md（backlog 2,410 → 1,565 tok）· 本台账

---

## WXG-T-077

- **名称**：**Cocos G3 遗留收口——`Label` 真实宽度替换 + `setAlign` 空实现补齐**（自 backlog「G3 遗留」正式立项；根因由 WXG-T-050 验收回填时登记为「不得记为已关闭」）：`packages/framework/src/adapters/cocos/cocos-renderer.ts:171` 的 `_anchorForText()` 仍用 `text.length × fontSize × 0.55` **估算**文本宽度做左右对齐偏移，VERSION.md G3 要求换成真实 `Label` 尺寸（建议 `UITransform`/`getBoundingClientRect` 回填）；`bindings.ts` 的 `wrapLabel.setAlign` 目前是**空实现占位**（对齐枚举真名 T-050 已纠正为 `HorizontalTextAlignment`/`VerticalTextAlignment`）。**拆两半执行**：① **可测半**（纯逻辑、Node 单测可验，守 L2——core 不碰 `cc`，仅 adapter）：`CocosLabelLike` 增测量出口（`measureWidth(text,fontSize): number` 或 `get width()`），`_anchorForText` 改为**消费注入的实测宽度**、删除 `0.55` 估算，补 fake-label 单测断言左/右对齐按真实宽度对称偏移；② **待编辑器半**（`[阻塞：无 Cocos Creator]`）：`bindings.ts` 真接 `cc.Label` 尺寸 + 落 `setAlign` 枚举，**运行时/目视验证无编辑器不可完成**，解除条件＝在 Cocos Creator 跑最小场景目视校正后方可回填关闭 G3。
- **负责**：主理人(Qoder)　**状态**：🔄 进行中——**可测半完成**，待编辑器半仍阻塞（G3 **保持不关闭**，符合下方验收）
- **验收**：G3 关闭须**两半都落**——可测半进 `pnpm run verify` 绿 + bindings 半在编辑器目视通过并更新 VERSION.md §G3/§4 矩阵；**只落可测半时 G3 保持不关闭**（禁止以「假绿」记关）。
- **实测（可测半，非假绿）**：`CocosLabelLike` 新增**可选** `measureWidth?(text,fontSize)` 出口（可选 ⇒ `bindings.ts` 本轮不动、不进 Node typecheck、Cocos 运行时不回归）；`_anchorForText(cmd, label)` 经 `_measureTextWidth` **优先消费注入实测宽**，无出口时退回显式常量 `FALLBACK_CHAR_WIDTH_RATIO=0.55`（即 G3 未关的降级根因）。vitest `cocos-renderer.test.ts` 新增 2 例（注入不同斜率测量证消费且左右严格对称 + 无出口证走降级），11→**13 全绿**；framework 全量 25 文件 **236 测试**绿；仓库 `typecheck` 3 项目 Done；harness `--build-only` OK。**未伪造**：`bindings.ts` 仅加 `[G3·待编辑器半]` 纯注释锚点（`setAlign` 枚举 + `measureWidth` 接 `UITransform` 接入点），未写任何 `cc` 代码。L2 合规（core 不碰 cc，仅 adapter）。
- **产出**：packages/framework/src/adapters/cocos/cocos-renderer.ts（已改）· tests/adapters/cocos-renderer.test.ts（已测）· bindings.ts（仅注释锚点，待编辑器落码）·【待编辑器半】cc.Label 实测接入 + setAlign 枚举 + 更新 VERSION.md §G3/§4（须真机目视校正）· 本台账

---

## WXG-T-078

- **名称**：**`tasks:archive` 同号守卫**（自 backlog「归档器缺同号守卫」立项； WXG-T-061 归档复核发现、T-032 曾重号）：归档器此前只防「候选已在归档」（跨批次去重），**不防主表内部同号** ⇒ 两会话撞用的同号两行会被当独立候选各自搬进归档、制造重复行。本任务补齐：**① 写盘前扫「主表 ∪ 归档」号频次**，凡出现 ≥2 次即打 **告警横幅**（列出号 + 出现位置如 `主表 + 主表` / `主表 + 归档`），**dry-run 与 --write 都报**、独立于能否归档；**② 批次内同号只归档首份**，其余同号行**保留主表**。**只警告不自动合并**（合并语义需人判，符合台账纪律）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成
- **位置与约束**：新增两段均在**报告/早退分支之前**，保证 0 候选与 dry-run 也能看到告警；批次去重放在 `toArchive` 定稿后、守恒校验前，守恒（行数 == 节数）自然成立。不改行内容、不删信息（宁漏勿错）。
- **实测（双向，非假绿）**：`archive-tasks-selftest.sh` **PASS 67 → 75**（新 [8a]/[8b]）——[8a] 主表两行同号 ⇒ dry-run 出「同号守卫」横幅且台账字节不变；[8b] `--write` ⇒ 归档中 `WXG-T-001` 仅 1 份（未放大）、主表保留 1 份（不自动合并）。真实台账 dry-run：**无同号误报**（健康数据全部唯一），头注与全局最大号一致、空转不落盘。
- **产出**：tools/scripts/archive-tasks.mjs（同号检测 + 批次去重 + doc/help）· tools/scripts/archive-tasks-selftest.sh（[8] 两例）· 本台账

---

## WXG-T-079

- **名称**：beads 工程接入 Cocos MCP —— 补齐 `games/beads/cocos/settings/` 缺失的两件扩展设置（cocos-setup.md §13.3 B2 当时未做）。
- **负责**：主理人(CodeBuddy)　**状态**：✅ 完成
- **现状核查**：链路其余各环**早已就位**——编辑器 3.8.8 + Dashboard ✓、全局扩展 `cocos-mcp-server` v1.5.4（dist 已构建）✓、三份 IDE 配置含 `cocos-creator`（WXG-T-043 生成物）✓、beads 工程已创建且编辑器正开着 ✓。唯二缺口都在 beads 工程的 `settings/`。
- **落地**：① `settings/mcp-server.json`——`port 3000 / autoStart true / enableDebugLog false / maxConnections 10`（`autoStart` 用 **true**，与 breakout 的 false 不同：实测可免「重启后手点 Start」，§12.2）② `settings/tool-manager.json`——照抄 breakout 的 **L1 白名单**（50 工具，21 启用 / 29 禁用；写类全禁）③ 顺带提交编辑器为 T-067 `combo-vfx.ts` 生成的 `.meta`。
- **拦下一个回归**：编辑器把 beads `project.json` 的 `fitHeight: true` **删了**——breakout 有 ✓、框架代码不自设分辨率（grep 无 `setDesignResolutionSize`）⇒ 该键是 Fit Height 的**唯一落点**，提交即静默破坏竖屏适配 ✗。已恢复，**不跟随编辑器提交**；若反复被重写需查 GUI 是否有人动过分辨率设置。
- **剩一步（GUI，无法代点）**：重启编辑器（`autoStart` 生效）或 扩展 → Cocos MCP Server → 启动服务器；探活 `GET http://127.0.0.1:3000/health`（**勿用 /mcp**，恒 404 会误判）。

---

## WXG-T-080

- **名称**：beads 可玩性 P0·**GAP-01 空槽目标色美术规格裁定**（阶段0全面复盘立项；用户拍板路线C「先修可玩性P0」+全部并行派波次1）。根因：空槽不显示目标色 →「同色入格」玩法无从下手；定性=**设计规格缺口**（数据层 `grid.ts::GridCell.colorIdx`「required colour for fillable empty」已就绪、快照层已照抄，渲染层 `drawGrid`/`drawEmptySocket` 丢弃；源头＝`assets-spec §1.2` + `art-bible` L47-49/L93/L145 同源漏写参考作 §2.1「槽位着色」）。
- **负责**：林绘澄(art-director)　**状态**：✅ 完成（波次1）。产出：`assets-spec §1.2` empty 目标色底 E1/E4 + locked 偏差追认、`art-bible` 三处同源、`accessibility` A2 三重编码重算+B3 假绿订正；回传常量 `EMPTY_TINT_MIX=0.35`/`EMPTY_GHOST_ALPHA=0.20` 由主对话 v1.16 串行落 §3.8。落码接口契约交 T-085。
- **Deliverables**：`art/assets-spec.md` §1.2 `empty`（目标色底+明度/饱和衰减系数+保留「不可读作已填珠」凹陷感+色盲冗余通道+与 `hint` 态叠加优先级）、§1.2 `locked` 偏差追认；`art/art-bible.md` 三处同源；`art/accessibility.md` A2 三重编码重算+B3 假绿订正；回传「落码接口契约」(drawEmptySocket 新签名)+「QA 可感知判据」供 T-085/T-084 引用。
- **约束**：**禁止直接写 `systems-index §3`**（与 T-081/T-083 并发竞写）——拟增常量（目标色衰减系数等）**回传主对话串行落盘**走 §6 变更记录。
- **依赖**：无前置；T-085（GAP-01 落码）硬前置。必读 `my-skills/wxgame-art-spec-programmatic/SKILL.md`。

---

## WXG-T-081

- **名称**：beads 可玩性 P0·**GAP-02/03/06 设计裁定 + ux-spec 内部矛盾消解**（路线C，波次1）。三裁定：①GAP-03 `ux-spec §1「0文字教学」vs §6「教学气泡」自相矛盾`+气泡零实现；②GAP-02 §6「1.5s珠已在托盘」但 `_setupLevel` 无立即 feed→开局空托盘；③GAP-06 杂色无终局出口→尾部软锁死（§4「玩家不会卡死」是假承诺），出泄压阀4方案(A供料过滤/B丢弃珠出口/C满槽自动清/D杂色置0)推荐+影响面（**最终用户拍板**）。
- **负责**：文策渊(design-strategist)　**状态**：✅ 完成（波次1）。产出：`ux-spec` §1/§4/§6 冲突裁定与首屏留存可执行化、`tray-spawner §2.4` 出口表、`levels-spec §5` L7/L8 尾盘校验；泄压阀 4 方案推荐回传 → **用户拍板 U8=A′+D**（供料侧 held≤demand 不变量 + 杂色置0）。落码归 T-086。
- **Deliverables**：`ux-spec.md` §1/§4/§6 冲突裁定（写成不可两读条文）+首屏留存路径可执行化；`gdd/tray-spawner.md` §2.4 出口表补行；参考作 §6「错豆挪移」立项裁决**建议**（路线C本轮不做，出预案不拍板）；`levels-spec.md` §5 L7/L8 尾盘满槽定性校验；泄压阀4方案推荐回传。
- **约束**：**禁止直接写 `systems-index §3`**——泄压阀若触及冻结常量，**回传拟改**由主对话串行落盘走 §6。
- **依赖**：无前置；T-086（GAP-02/03/04/10 落码）硬前置。必读 `my-skills/wxgame-ux-spec/SKILL.md`→`wxgame-gdd-writer/SKILL.md`。

---

## WXG-T-082

- **名称**：beads **GAP-07/08 坐标空间契约 ADR + Cocos 双路径取证**（路线C，波次1）。GAP-07 真凶＝`compose/app.ts` L104-105 `start()` 用 `getScreenSize()`(CSS px) 覆盖 harness device-px fit，且输入送 device px→点击映射出设计空间→**托盘/格子全点不中**（契约本为 CSS px，harness 越界）；GAP-08＝`canvas2d-renderer.ts` L82 y-flip 下 L133-141 `fillText` 未补偿→文字镜像（仅 harness）。
- **负责**：程基岩(engineering-lead)　**状态**：✅ 完成（波次1）。产出：`ADR-0011`（坐标契约=CSS px，DPR 由 renderer 承担，状态 Accepted）、`VERSION.md` 据实修订（Cocos 3.8.8 已装/MCP 在线/§2 能力 9 行 ⚠️→✅）、`epics-beads.md` 状态声明修订、`dev/harness/README.md` beads 章节 + `main.ts` L276；**Cocos 双路径取证**反证 GAP-07/08 仅 harness，并**新登 G10【P0】：真机路径 ES5 转译击穿 `patternColors()`→8 关 BOOT 全失败**（→ T-090）。执行 `framework:sync` 解除 BD-20 漂移、G1 转绿。
- **Deliverables**：新增 ADR「屏幕坐标空间契约=CSS px，DPR 由 renderer 承担」（五节，编号顺延既有集；**0008 已预约未落盘、0009 已用→本 ADR 拟用 0010**，请查 `adr/` 确认）；据实修订 `docs/engine-reference/cocos/VERSION.md`（Cocos 3.8.8 已装/工程已建/web-mobile 已通，⚠️→✅）+ `epics-beads.md` 状态声明#2 错误证据引用；**Cocos 双路径取证报告**（`build:cocos:web` 产物+浏览器，实测 GAP-01/02/04/06 是否真机复现、反证 GAP-07/08 仅 harness）；`dev/harness/README.md` 补 beads 章节 + main.ts L276 提示对齐。
- **约束**：**协调 WXG-T-077**（Cocos Label 进行中）——**不得改** `cocos-renderer.ts`/`label-pool.ts`（T-077 工作面）；坐标修复本体归波次2 T-087，本单只出 ADR+取证。MCP 编辑器预览需用户手动重启（T-079 遗留 GUI 步），取证优先走 `build:cocos:web`+浏览器。
- **依赖**：无前置（先与 T-077 定先后序）；T-087（harness 落码）硬前置。必读 `my-skills/wxgame-adr-arch/SKILL.md`+`wxgame-minigame-bridge/SKILL.md`。

---

## WXG-T-083

- **名称**：beads **GAP-05 音频规格从零建档**（路线C，波次1；beads 首次派工阮和鸣）。现状：`design/` 无 `audio/` 目录、`tuning.ts` 仅3 clip 引用而 ux-spec §5 隐含13类音效、`web.ts` 为 `NullAudioBackend`→harness 恒静音→「解压」支柱无法评估、阶段6 Playtest 会系统性失真。
- **负责**：阮和鸣(audio-director)　**状态**：✅ 完成（波次1）。产出：`design/audio/audio-spec.md` + `audio-events.md`（19 clip 三总线事件表、`minInterval` 分档修正 reject 违约、包体实测 web-mobile 1968 KB/内部目标 2000→余量 32 KB、选型=程序化合成 0 KB）；回传常量 `AUDIO_SFX_MIN_INTERVAL=0.05s`/`AUDIO_REJECT_MIN_INTERVAL=0.5s` 主对话 v1.16 落 §3.12；发现 `assets-spec §5` 音频预算表自相矛盾（→ R5 重算）；Web Audio 后端需求单路由波次4。
- **Deliverables**：`design/audio/audio-spec.md`（音频事件表 事件ID↔触发源↔时长↔与§5动效对齐↔优先级/抢占；混音规范 SFX/BGM/UI 总线+同时发声上限+voice-stealing；BGM 结构；实现策略 程序化合成vs采样+**包体预算数字+依据**；验证手段矩阵）+逐事件可执行验收判据；Web Audio 后端落地**需求单**（回传，不落码，路由给程基岩）。**框架版未定值标 `[TODO]`，不产伪数值**。
- **约束**：**禁止直接写 `systems-index §3`**——音频冻结常量回传主对话串行落盘。本单**只出规格不生成音频文件**（文件走 `indie-game-ost-pack`/`game-ui-voice-pack` 执行层，后续另派）。
- **依赖**：无前置（可与 T-080/081/082/084 全并行）；阶段6 Playtest 有效的必要条件。必读 `my-skills/wxgame-audio-spec/SKILL.md`。

---

## WXG-T-084

- **名称**：beads **GAP-14 G4 首次执行 + 可感知判据补编 + GAP-09 假绿复核**（路线C，波次1；G门证据唯一合法来源）。根因：`qa/beads/test-cases.md` 61条判据全「待实现」且**无一条可感知型**→表现层缺陷结构上无法被门禁捕获；beads G4 从未执行（`production/qa/` 只有 breakout 报告）；GAP-09 accessibility D1/E2 第三次假绿（同 breakout D-01）。
- **负责**：严守真(quality-lead)　**状态**：✅ 完成（波次1）。产出：新建 `qa/beads/g4-regression-report.md`（450 行/19 探针）+ `g4-probe.mjs`、`test-cases.md` v1.3 可感知判据补编、`bug-severity`/`playtest-plan`/`smoke-tests`/`test-plan` 修订。**裁定：G4=FAIL**（11 FAIL/5 PASS*/2 PASS/1⛔）、**G1=FAIL**（sync 漂移短路，程基岩 sync 后转绿）、G2=PASS 有缺口、G3 部分、G5 未执行。6 项 P0（BD-01/02/03/04/06/14）+ 关键 BD-20 漂移解除条件。未标任何假绿。
- **Deliverables**：新建 `qa/beads/g4-regression-report.md`（沿 breakout 格式，逐条 PASS/⛔不可测/FAIL+证据+缺陷号，**给 beads G4 明确裁定**，不可测项写原因禁标绿）；`test-cases.md` 补「可感知性判据」章节（覆盖 GAP-01/02/03/04/05/06/10，每条标取证手段+前置依赖，v1.3）；G1–G3 全量证据（实跑 `pnpm run verify`/`harness:smoke`/`preview:frames`/`build:cocos:web`）；GAP-09 假绿复核（列全部「文档✅但代码零命中」+与 breakout D-01 同款性归因+防再犯）；14缺口按缺陷分级登记。
- **约束**：harness 带 GAP-07(点不中)/GAP-08(镜像)→ T-087 修好前 `[Harness]` 结论不可信须标注；无真机/无音频后端→`[Device]`/音频判据**如实标不可测禁标绿**；裁定权属主理人，你出证据+建议裁定。
- **依赖**：无前置（可立即出「现状基线 G4」=FAIL/CONCERNS）；可感知判据**执行**依赖波次2落地→建议分两次（现状基线+修复后复验）。必读 `my-skills/wxgame-qa-gates/SKILL.md`。

---

## WXG-T-085

- **名称**：beads P0·**GAP-01 空槽目标色落码**（波次2，路线C 首单）。承接 T-080 美术规格裁定：把 `EMPTY_TINT_MIX=0.35`（E1 目标色底）+ `EMPTY_GHOST_ALPHA=0.20`（E4 幽灵符号）从规格落到渲染层。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（3abb4dc）
- **落地证据**：`bead-render.ts::drawEmptySocket` 扩末位可选 `colorIdx`→E1 色底 `mixWith(slot,beadColor,EMPTY_TINT_MIX=0.35)` + E4 幽灵符号 `emitSymbol(size*0.8, withAlpha(beadColor,EMPTY_GHOST_ALPHA=0.20))`；`palette.ts` 落 §3.8 两常量；`view-model.ts::drawGrid` 透传 `cell.colorIdx`（托盘 `drawEmptySocket` 不传保持中性）。ghost dot 因 size×0.8 不被旧精确-r 校验命中→`isDotSymbol` 放宽为 band 内填充圆，A3 反向断言改正向。beads 187 全绿 tsc 干净；harness smoke 136 draw cmds。守 L5（渲染只读）、§3.8 冻结常量无魔法数。
- **约束**：守 L5（渲染不持状态，只读 `buildRenderModel`）+ 热路径零分配（混色复用暂存）；颜色系数走 §3.8 冻结常量，禁魔法数。**不改 `systems-index §3`**——常量已由主对话 v1.16 落盘。
- **依赖**：硬前置 T-080（规格）+ t7（§3.8 常量已落）。GAP-01 是「同色入格」可玩性的第一道解锁。

---

## WXG-T-086

- **名称**：beads P0·**GAP-02 首供提速 + GAP-06 尾部泄压阀落码（U8=A′+D）**（波次2）。承接 T-081 设计裁定 + 用户拍板 U8=A′+D。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（c2ab5eb，镜像漂移 ac74b5c）
- **落地偏差（诚实登记）**：GAP-02 首供实际落在 `spawner.ts`（`_firstFeed` 标记于 `reset()` 置位、首 tick 消费后 early-return，不预先 `_acc+=dt`）而非详情初稿写于 `beads-game._setupLevel`——供料逻辑内聚于 Spawner，且恢复路径（直接设 interval/acc 不调 reset）不误触首供（内聚供料逻辑于 Spawner）。GAP-06 A′：`_drawColor` needed 循环加 `held < needed` 过滤（`Tray.heldCount`），decoy 循环保留。U8=D：§3.2 `DECOY_COLORS_MAX` 2→0（`tuning.ts` + `levels-01-08.json` 清空 L1–L6 `decoys` + `levels:sync` 重生）；已登记 `systems-index v1.17`（changelog §6）。同批落保 `levels:check` 绿；beads 187 全绿，新增 tray-spawner 首供+A′ 锁定测试。
- **约束**：A′ 与 D 耦合 `levels.json`/`spawner.ts`，必须同批落否则 `levels:check` 红；改冻结常量走 §6 变更记录（本单由主对话串行落，非成员并发）；守 L4（RNG 走 `services.rng`）。
- **依赖**：硬前置 T-081（泄压阀裁定）。与 T-085 无冲突（不同文件面）。

---

## WXG-T-087

- **名称**：beads P0·**GAP-04 四类 VFX + wrong/hint 态 + GAP-03 引导三通道 + GAP-10 告警脉冲落码**（波次2）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2291203）
- **Deliverables**：① GAP-04：落 `filled/empty/locked/hint/wrong/selected` 六态中缺失的视觉反馈（错误抖动+描边闪 ≤2 次/秒按 §3.8、hint 高亮、combo 连击 VFX）；② GAP-03：首屏引导三通道（0 文字教学按 T-081 裁定后的条文落地——视觉演示/手势/箭头，消解 ux-spec §1 vs §6 矛盾）；③ GAP-10：倒计时告急脉冲（图标+颜色+脉冲三通道，§3.8「告急表达」）。
- **约束**：VFX 走命令层 emit、渲染层只读（L5）；时长走 ux-spec §5 动效毫秒表冻结值；BD-04 已由 R2 升 P0（关键反馈零通道）。可访问性 D1/E2 开关归 T-088，本单只做默认视觉反馈本体。
- **依赖**：硬前置 T-081（引导裁定）+ T-084（可感知判据）。与 T-085 共享 `view-model.ts`/`bead-render.ts` → **须与 T-085 串行**（先 T-085 后 T-087，避同文件竞写）。
- **落地证据**：相位循 `_comboVfx` 判例—game 层 `_pulseClock`/`_wrongFx` 计相位→snapshot→view 只读（守 L5）。GAP-04 wrong：`_placeSelected` mismatch 拒绝→`_wrongFx`（±3px 抖动+danger 闪 2 次，`WRONG_FX_MS`=200）；invalid-color 仍静默。GAP-04 hint / GAP-03 引导：`drawStateRing` 蓝环呼吸（accent_blue #3D7BF5，`palette.hintBlue`），`runs==0` 首玩（BOOT 自增前捕获）时首珠槽脉冲 + 行主序单一目标格 hint，首次落子即清永不再现。GAP-10：urgent 时钟图标（stroke-only circle+两指针）+ 数字/图标 α 0.6↔1.0 @`DANGER_PULSE_MS`=1000 脉冲。tuning 新增 ux-spec §5 时长常量（WRONG/HINT/DANGER_PULSE），非 §3 冻结→不动 systems-index。combo VFX（GAP-04 一类）已前序存在（`combo-vfx.ts`），本单未重复。**未接线项**：满槽告警（art §7 500ms 描边呼吸）不属 GAP-04/03/10 核心三通道，本单未做（待后续评估）。测试：`feedback-vfx.test.ts` 5 例（相位契约+命令级环断言），beads 192 全绿、verify 全绿。

---

## WXG-T-088

- **名称**：beads·**R1=甲 D1/E2 可访问性开关落码**（波次2，用户拍板 R1 全做）。根治 accessibility D1/E2 第三次假绿：三文档冲突消解 + 真实装设置字段。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（save-schema 0ccba7a + 面板/view/文档同批）
- **Deliverables**：① `BeadsSettings` 落 `reduceMotion` + `largeText` 字段（`save-schema.ts` + version 升位迁移）；② 回写 `pause-settings §2.2` 冻结清单 + `ux-spec §3.3` 线框使三文档一致；③ `accessibility.md` D1/E2 由假绿 ✅ 改为真实落地后 ✅；④ 消费端接线：`reduceMotion`→抑制 T-087 的 VFX/脉冲，`largeText`→字号放大系数。
- **依赖**：软前置 T-087（`reduceMotion` 要有可抑制的 VFX）。与 T-085/086 文件面不冲突。
- **落地证据**：① `save-schema.ts` BeadsSettings 加 `reduceMotion`/`largeText`，SAVE_VERSION 1→2，`migrateV1ToV2` 只升版本号透传旧字段 + `normalizeSettings` 逐字段降级 false（旧档不炸）；beads-game SaveManager 改 `version: SAVE_VERSION` + `migrations{1}`。② `pause-panel.ts` 行3 由单居中去冲刺改为三格 `[减弱动效|大字号|去冲刺]`（复用行2 cellW≈160≥TOUCH_MIN，面板维持 560×480，§8-5 不变量不破；sprint 下去冲刺退场、两开关常驻）；beads-game 接 两 setter + `_applyPanelAction` 两 case + 镜像/getters/_persistSettings/_syncSnapshot；state 快照加两字段。③ view-model：panelLabel 两标签（次要小字号 panelToggle），reduceMotion 令 dangerAlpha/hintAlpha/wrong 抖动dx/wrong flash/clearStarPopScale/finishRowPopScale 全退静态，largeText 经 `bodyFont` 放大 `sub`(28→35)/`hudSmall`(22→27)。④ 三文档回写：pause§2.2 两行 / ux§3.3 行3 线框 / accessibility D1、E2 由假绿改 ✅+§2 复核（诚实标「落座回弹/消除溶解」本作无对应动画=N/A）。测：save-schema v1→v2 迁移保进度牙 + feedback-vfx 4 消费牙 + pause §8-1/§8-5/§8-11。**未触 §3 冻结常量**（FONT 为 view 局部项，非 systems-index §3）。beads 198 全绿、framework:sync 镜像 5 文件、verify exit 0。

---

## WXG-T-089

- **名称**：beads P0·**GAP-07/08 harness 坐标契约落码（ADR-0011 裁决落地）**（波次2）。承接 T-082 ADR-0011（坐标契约=CSS px，DPR 由 renderer 承担）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（framework 0e673d1 + harness eb0572d）
- **Deliverables**：① GAP-07：`dev/harness/main.ts` `fitCanvas`/`pushPointer` 对齐 CSS px 契约（harness 是唯一越界者——框架 `compose/app.ts` L104-105 用 CSS px 正确，改 harness 送 CSS px 坐标，使点击映射回设计空间）；② GAP-08：`canvas2d-renderer.ts` L133-141 `fillText` 在 y-flip 下补偿（**收窄到 text case 内部**，禁改全局变换——矢量符号 ▲▽♥◐ 在 y-up 下自洽）。
- **约束**：GAP-07 真凶定位经主理人纠正＝harness 越界非框架 bug ⇒ **只改 `dev/harness/`，不改 `packages/framework/src/compose/app.ts`**（框架契约正确）；GAP-08 修复禁全局 transform 改动（否则符号镜像）。改框架源后须 `framework:sync` 同步 cocos 镜像（BD-20 教训）。
- **依赖**：硬前置 T-082（ADR-0011 + 取证）。仅影响 harness 路径（真机 Cocos 路径 GAP-07/08 结构上不复现，T-082 已反证）。
- **落地证据**：GAP-07（harness 唯一越界者，框架契约正确→未改 `app.ts`）：`dev/harness/main.ts` `pushPointer` 改送 `event.clientX/clientY`（去 `* dpr`），`fitCanvas` 改 `app.resize(cssW, cssH)`，DPR 只留 `canvas.width = css×dpr` 交 `Canvas2DRenderer` 新 `pixelRatio` 选项吸收（整个 `setTransform` 缩放+两平移项按 dpr 前置，dpr=1 保持旧行为）。GAP-08：text 在 y-up 全局翻转下局部 `save/translate/scale(1,-1)` 复原，垂直 baseline `top↔bottom` 互换、`middle/alphabetic` 不变，`applyViewportTransform=false` 不补偿；禁改全局变换（符号 ▲▽♥◐ 依赖 y-up）。§3(d) 双牙：`viewport.test.ts` DPR=2 device-px 样本被 `containsScreenPoint` 拒收；`smoke-harness` 断言 `fit.screenWidth === canvas.clientWidth`（stub `devicePixelRatio`→2 + 镜像 `globalThis.innerWidth` 修正 `window!==globalThis` 致 `getScreenSize()` 落 1280 的旧失真）。canvas2d-renderer cocos 双镜像已 `framework:sync`。beads 192+framework 全绿、verify exit 0。

---

## WXG-T-090

- **名称**：**G10 ES5 转译致命缺陷修复**（波次2·spike 先行；用户拍板「先验证 spike 再裁 ADR-0012」）。T-082 Cocos 取证新发现——**beads 在真机路径也不可玩**：Cocos 构建 Babel 降 ES5 把 `[...seen]`（Set）编成 `[].concat(seen)` 不展开 → `patternColors()` 长度恒 1 → **8 关 BOOT 校验全失败、永远停在启动画面**。
- **负责**：程基岩(engineering-lead)　**状态**：✅ 完成（本环境可验面全绿；真机 runtime/微信 AppID 复验随 G4，未记假绿）
- **实测（修法甲）**：Spike 产物字节实锤 `[].concat(seen)`（Set 不展开→长度恒 1）；产物 `new Set()` 原生无 polyfill → 推翻「Array.from 需 polyfill」顾虑、`Array.from` 可行；`builder.json`/`program.json` 仅剩 `__version__` → 修法丙（提 target）无工程级开关不可控→已否。**6 处**（framework `storage.ts:40`/`object-pool.ts:112` + beads `levels.ts:78/:245`/`powerups.ts:106/130`）改 `Array.from`，类型级 AST 全仓复扫 78 文件零第 7 处，安全展开未动。CI 守卫 `check-es5-spread.mjs`（TS 类型+AST，fail-closed，不依赖 Cocos）入 `verify` 链，selftest 红→绿双向。**复验**：`verify` exit 0（659）、`sync:check` 绿、重建 web-mobile `[].concat(seen)`=0/`Array.from(`=6；从 bundle 切出转译后 `patternColors` 在 Node eval 喂 L1–L8→色数 ∈[3,10]（BOOT 判据可过），反证换回 concat→`[object Set]` 长度 1。**未跑**浏览器加载（沙箱禁监听 socket）与真机 runtime → 归 G4/AppID（EP-10 保持环境阻塞）。
- **Deliverables**：① **Spike**（先验证不裁 ADR）：确认目标平台最低 ES 版本、复现 `patternColors()` 降级失效、对比 `Array.from`/显式循环两种改法的转译产物；② 据 spike 结论**裁 ADR-0012**（转译目标 vs 源码规避 Set 展开）；③ 修复落码：`core`/`levels`/`powerups` 内所有 `[...set]`/`Set` 展开模式统一改法；④ **CI 守卫**：加检查（grep/lint）防 `[...Set]` 展开回归；⑤ `framework:sync` + 真机 `build:cocos:web` 复验 8 关 BOOT 通过。
- **约束**：**spike 结论出来前不裁 ADR-0012、不落修复码**（用户明确「先验证再裁」）；改 core 守 L2（不碰 cc/DOM/wx）；修复须覆盖全部 Set 展开点（非仅 `patternColors`），否则漏点仍锁死。
- **依赖**：硬前置 T-082（G10 发现 + 取证）。**优先级最高**——这是真机路径的第一道锁，早于 GAP-01（harness 路径）。

## WXG-T-091

- **名称**：**beads 波次1 汇编 R4/R5/R6 文档回写销项**（用户拍板「R4 全按 QA 改 / R5+R6 都做」；波次2 代码单基后的收尾项，无新代码，纯文档一致性闭环）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成
- **背景**：T-084 G4 回归报告 §8 登记 8 项「判据冲突/不可构造」移交策划；T-082 音频建档时发现 `assets-spec §5` 预算表自相矛盾（→ R5）；§6.5 拟沉淀 a11y 假绿教训按硬约束未落盘（→ R6）。R4-5（D1/E2 三文档冲突 = 甲）已随 T-088 落地，本单不重复。
- **落地（R4 全按 QA 建议回写）**：① `input-control §8-2` 补「重叠区以 §8-4 为准」（BD-23）；② `tray-spawner §8-2` ±20% 容差→卡方拟合优度（BD-22）；③ `save-progress §8-9`「200 次落子」→「≤ 最大可构造量 156」（BD-24）且结算帧明定 = `level:cleared`（P18③）；④ `tray-spawner §8-1` / `core-loop §8-2` 期望显式改 **16（±0）**含首供（BD-25，与 T-086 已落的首供语义对齐）；⑦ `assets-spec §1.2` hint 行删 `[待 ux-spec 对齐]` 占位（毫秒归 ux-spec §5）；⑧ `accessibility C2` 32px → 实现 `POWERUP_CARD_GAP=60`（648 ≤ 750）（BD-26）。
- **落地（R5）**：`assets-spec §5` 包体预算表按 `audio-spec §4.2` 实测重算——引擎 1500 + 业务/资源 452 + 美术 0 + 音频 0 = **实测合计 1968 KB**，内部目标 2000 KB ⇒ 安全余量 32 KB；废弃原「音频≤400预留 + 安全≥2000」（分项和 2600/4600 KB 超目标超红线）的自相矛盾行。
- **落地（R6）**：`knowledge/lessons.md` 新增 **[流程][K-035]** 「文档状态列混淆『规格已写』与『代码已实现』= 可访问性假绿温床」（四轮谱系 + 3 条防再犯，① check:a11y 机械守卫**待立项未落码**、诚实标注）；经 `kb:sync` 入 `ledger.json`。
- **约束**：均为文档回写，**未触 systems-index §3 冻结常量**（4096/2000/音频0KB 均沿 §3.9 现值），无需 §6 变更记录；不擅改代码，判据冲突只按 QA 建议同步文档。
- **依赖**：前置 T-084（冲突清单）、T-082（R5 预算发现）、T-088（R4-5 已落）。

## WXG-T-092

- **名称**：**beads G4 复验——探针重跑 + 回归报告 v1.1**（波次3·甲路线；用户拍板「先复验拿真相再定音频/Playtest 排期」）。现状：g4-regression-report v1.0 为 2026-09-14 **修复前基线**（建议 G4=FAIL）；波次2（T-085~090）已把 GAP-01~10 修复全部落码且 verify 全绿，但**至今只有代码/单测级自证，无复验他证**。
- **负责**：严守真(quality-lead)　**状态**：✅ 完成（2026-09-15）
- **复验结果（v1.1，26 组探针）**：改判 PASS 2→13 / PASS* 5→8 / FAIL 11→**4** / ⛔ 1；零新回归（4 FAIL 与 v1.0 严格同集：P5 音频、P8/BD-15 扩展路由、P10/BD-16 轻提示、P17/BD-12 meta 字段）。波次2 修复经探针他证：首供第 1 帧、空槽 22/22、告急 1Hz 三通道、A′ 不变量 7933 采样死珠 0、χ²=5.32、harness 往返误差 ≤2.3e-13、§8-9 156/156 写档 0/1。新登 **BD-27~32**（含实现缺陷 BD-32：每次 BOOT `runs+1` ⇒ 开局即杀进程永久失引导）。G1 PASS（BD-20 关）、G2 PASS、G3 未执行（BD-17/18 结构假绿仍在）。建议裁定 **CONCERNS**（五条限制声明见报告 §18）。
- **产出**：`g4-probe-v1.1.mjs`、报告 v1.1（§12–§18 追加式）、`evidence/g4-reverify-v1.1.log` + 诊断夹具×2、`test-plan.md` v1.2、`test-cases.md` v1.4；未动 src/设计文档，未 commit（主对话收口）。
- **Deliverables**：① `g4-probe.mjs` 适配后重跑（预期值按已裁判据更新：BD-22 卡方 / BD-24 156 / BD-25 16±0 等，探针自身缺陷必须区分于实现缺陷）；② 逐探针 v1.0→v1.1 改判表（19 组 P1–P19）+ BD-01~26 处置状更新；③ §8 八项冲突关闭标记（已随 T-091 回写 7 项）；④ test-plan §R6/R7/R9 状态行同步；⑤ 向主理人报 G4 复验结论（PASS/CONCERNS/FAIL 裁定权属主理人）。
- **环境事实**：无真机/无微信 AppID ⇒ `[Cocos]/[Device]/[R]` 道次仍标 ⛔ 不得假验；沙箱禁监听 socket ⇒ 浏览器道次走离屏渲染脚本（render-harness-frame/clip），同 v1.0 口径。
- **硬约束**：readonly 面 = 不改 src/设计文档；只写 `production/qa/beads/**`；判据不变（从 GDD §8 导出），改探针断言必须引 T-091 回写后的 §8 现文；禁止以「代码已落」代替实测改判。
- **依赖**：前置 T-085~091 全部；后继（据本报告裁）：音频后端排期、M2 降级 Playtest、BD-21 测试补全。

## WXG-T-093

- **名称**：**beads 文档漂移回写（ux-spec U8 / accessibility B3）+ 守卫登记**（波次3·C 组；小单，回写已生效裁定，无新设计决策）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成
- **背景**：阶段0诊断（2026-09-15）发现两处「状态列=实现事实」漂移，同 K-035 病根家族：① ux-spec §8 U8 仍标「⏳ 待用户拍板」，实际 2026-09-14 已拍板 A′+D 并随 T-086 落码、§3 已 v1.17 冻结；② accessibility B3 仍标「脉冲未实现移交 T-086」，实际 GAP-10 告急三通道（色切+图标切+1000ms α 脉冲）已随 T-087 落地（`view-model.ts` L418–424，dangerAlpha；D1 联动退静态）。
- **落地**：① `ux-spec §8` U8 行改 ✅（引 v1.17/T-086 事实）+ 尾注「待确认项归零」；② `accessibility §2` B3 行改 ✅ 附判定位置、§3 小结 14→15 项、部分落地行清空；③ `TASKS.md` backlog 新增「check:a11y 机械守卫（待立项）」行（来源 K-035，本单不实施只登记）。
- **约束**：不改 §3、不改判据文本、不新增设计语义；纯事实同步。
- **依赖**：前置 T-086/T-087/T-091；守卫实施工单待后续波次领号。

## WXG-T-094

- **名称**：**波次3 汇编——G4 主理人裁决 + 波次4 立项排期**（阶段 8 汇编段，编排者独占）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-15）
- **输入**：用户两度拍板「甲」（阶段0 推荐路线 = 先复验拿真相再定音频/Playtest 排期）⇒ T-092 他证 + T-093 回写。
- **裁决**：**G4 = CONCERNS**（全文见 `production/qa/beads/g4-regression-report.md` **§18.5**）。放行：波次4 全部单 + M2 降级 Playtest + 波次2/3 修复的代码级冻结；**不放行**：阶段7 发布（包体无数据 + `[Cocos]/[Device]/[R]` 未验）、每日挑战评审（既定「PASS 前不评」）、对「解压/治愈」下 PASS。五条限制声明入档，任一未解除不得升 PASS。
- **事实修正（重要）**：§18.2 **B2** 的解除条件不是「主理人授权代跑 `build:cocos`」——`tools/scripts/build-cocos.mjs` 头注明载 `wechatgame` 平台**需有效 AppID**；本环境只能产 `web-mobile`（beads 已有，1968 KB 代理值即出自它）⇒ B2 挂 B4（用户侧）。
- **波次4 立项（一次占位防跨 IDE 撞号，见主表注 4 教训）**：T-095 门禁可信度 / T-096 音频后端 / T-097 P1 反馈缺口 / T-098 裁定包回写 / T-099 取证通路。**施工顺序**：T-095 →（T-096 ∥ T-098）→ T-097 → T-099 → Playtest 降级轮（领号待 T-096 后）。
- **升 PASS 最小集**：T-095 + T-098（⇒ BD-25 关单）+ T-099 + AppID 到位后的 `wechatgame` 包体实测。
- **约束**：本单零代码零设计交付物（裁决与立项属主理人独占段，不代成员产出）。

## WXG-T-095

- **名称**：**门禁自身可信度修复（BD-17 verify 短路 + BD-18 check:size 静默 ✅）**——波次4 首位，P0（成本最低、收益最大）。
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-15）
- **背景（仓库现物已核）**：`package.json:51` `verify` 仍以 `&&` 串 **14** 项 ⇒ 任一项失败后续门静默不跑（v1.0 轮在第 8/13 项即短路，9–13 项从未执行）；`check-bundle-size.mjs:82` 对缺产物只 `status:'skipped'` 打印后整体报 ✅ ⇒ 包体门只测到 breakout 1815.1KB。
- **Deliverables**：① `verify` 改「**逐项收集 + 汇总退出码**」，尾部打印未通过/未执行清单（若保留现 `verify` 语义则新增 `verify:all`，**不得两套口径不一致**）；② `check:size` 遍历 `games/*`，缺 `wechatgame` 产物时**显式 SKIP + WARN 计数**，禁止静默 ✅；③ 两脚本各自 selftest 补例（沿用 `tools/scripts/*-selftest.sh` 惯例）+ `pnpm run verify` 全绿复跑；④ 回写：报告 §14 BD-17/18 状态行、`docs/agent/commands.md` verify 口径、`knowledge/lessons.md` 候选（门禁假绿谱系）。
- **约束**：不改任何判据数值与 §3 冻结常量；门禁改动必须能被门禁自己验证；**禁**为凑绿而放宽阈值。
- **依赖**：无前置（本环境可全验）；后继 T-099/T-100 的「绿」才可信。
- **完成记录（2026-09-15）**：① 新增 `tools/scripts/verify-all.mjs`——**14 项逐项执行永不短路**，取子命令 stdout 末次 `STATUS: OK\|SKIP\|FAIL` 定性，尾打 `PASS/SKIP/FAIL` 汇总 + 未通过清单并据汇总定退出码；`--validate` 防步骤表与 `package.json` 脱钩并**拦住 `verify` 回退成 `&&`**。② `check-bundle-size.mjs` 按 `games/*` 算覆盖面 + `overallStatus()`，缺产物打 **SKIP（非 OK）**+ WARN 清单，新增 `--strict`。③ 自测：`verify:selftest`（新，5 段红→绿实测含「注入失败项后 `[2/2]` 仍执行」）、`check:size:selftest`（§C1–C6，**19/19**）、`verify-all --selftest` **9/9**；全量 `pnpm run verify` = **PASS 13｜SKIP 1｜FAIL 0**。④ 回写：`docs/agent/commands.md`、报告 §14 BD-17/18 + §18.2 B3 + §18.5 裁决后续更新、`test-plan.md` R8、`lessons.md` K-036 落地行。**未改判据与 §3；未因本单升 G4**（beads 红线仍无数据，挂 B4/AppID）。

## WXG-T-096

- **名称**：**beads 音频后端落码（BD-05 clip 派发 + BD-05b 三平台 backend）**——支柱内最后一个零实现，P0。
- **负责**：程基岩(eng)+主理人(Qoder)　**状态**：✅ 完成（2026-09-15；**Deliverable ① 部分交付**，见下方偏离①）
- **背景（现物已核）**：`packages/framework/src/platform/{web,weapp}.ts` 的 `createAudioBackend()` 均 `return new NullAudioBackend()`（注释自认「待首个带音频的游戏」）⇒ harness 恒静音；G4 探针 P5 因此维持 FAIL，Playtest「解压/治愈」维度结构性不可评。现 `games/beads/src` 仅 3 个 clip 常量（`AUDIO_CLIP_BGM/UI_TAP/STAR`）。
- **权威来源**：`games/beads/design/audio/audio-spec.md` **§6.2 后端需求单（6 项）** + `audio-events.md §1/§4`（A05-01..27）+ `systems-index §3` `AUDIO_*`（v1.16 已冻结）。
- **Deliverables**：① 框架侧 WebAudio 程序化合成 backend（**零外部音频文件** ⇒ 守包体音频 0 KB 承诺）+ InnerAudioContext 池（weapp）+ node 侧保持 Null 以护单测；② 游戏侧 19 项事件→clip 映射与**同帧多事件**策略（BD-05）；③ 单测（L2：core 不碰 `cc`/DOM/`wx`）+ 热路径零分配；④ `framework:sync` 镜像 + `verify` 全绿；⑤ 交严守真复跑 P5（探针预期值先改再跑）。
- **约束**：不产伪数值（音量/时长一律引 §3 与 audio-events）；配乐/口播**文件**生成走 `indie-game-ost-pack`/`game-ui-voice-pack`，本单只做后端与派发。
- **依赖**：T-095（需可信门禁）；后继 Playtest 降级轮。
- **完成记录（2026-09-15）**：
  - ① **框架侧合成 backend**：新增 `packages/framework/src/platform/audio-synth.ts`（`SynthAudioBackend`，最小 Web Audio 结构面编程 ⇒ web 与 `wx.createWebAudioContext()` 共用）；三平台适配器按能力探测建 context 并以工厂回调注入，缺能力 ⇒ `NullAudioBackend`（node 恒 Null 以护单测）。归属与理由 = **ADR-0013**（新增）；反模式两行 + **§16 音频后端契约** 入 `control-manifest.md`。
  - ② **游戏侧 19 clip**：`games/beads/src/config/audio-voices.ts`（音色表，数值一律标**工程占位**，不回引为规格）+ `beads-game.ts _subscribe()` 的 13 条事件→clip 派发 + `_sfx()` 双通道门控；同帧策略 = 入队序 + per-clip 限流（`AUDIO_MAX_PER_FRAME=6`，§1 已核算最坏 4 条）；`priority/steal` 与三总线**增益数值**按 §3.12 `[TODO]` 不发明。
  - ③ **测试**：`framework/tests/platform/audio-synth.test.ts` **15 例**（假 Web Audio 记录型夹具：构造期不建 context / 未登记静默 / 三总线一次 / notes / buffer 复用 / loop 幂等 / suspend-resume 期望态 / setVolume 当场生效 / `usesExternalFiles()===false`）+ `beads/tests/audio-dispatch.test.ts` **27 例**（A05-01..24 中 `[N]` 可证面 + 清单闭合 + bus 前缀派生守卫）。全量 **framework 255 / beads 225** 例绿，L2 面由 `check:arch` 守。
  - ④ **镜像与门禁**：`framework:sync` 已产（含 breakout 侧共用件），`pnpm run verify` = **PASS 13｜SKIP 1（`check:size`，无 `wechatgame` 产物）｜FAIL 0**。
  - ⑤ **严守真复跑 P5**：报告升 **v1.2 §19**，预期值先改后跑 ⇒ **PASS 12 / PASS\* 8 / FAIL 0 / ⛔ 8**（⛔ = `[B]/[C]/[R]/[P]` 道次）；BD-05 → 部分关闭（仅 `[N]` 派发层）降 P2 不关单，BD-05b → 关闭（仅 `[N]` 结构层）；**G4 仍 = CONCERNS，不因 P5 转绿升 PASS**。
- **偏离任务书三项（不冒充交付）**：
  - **①（对 Deliverable ①）weapp `InnerAudioContext` 池未实现**——与 §3.12 冻结的「主包音频 0 KB」正面冲突（`audio-spec §4.1` 回退需主理人先解除内部目标余量冲突，本轮不成立）⇒ 采 ADR-0013 §2 丁之否因，记为部分交付；真机若证 `createWebAudioContext` 不可用，weapp 侧**无第二方案**。
  - **② `sfx_ui_tap` 时长 40 ms 为占位**——`ux-spec §5` 无该行（Q-A05-1 未裁）⇒ 不参与 `[B]` 验收。
  - **③ 听感未成立**——全部 Hz/ms/增益属占位（`BGM_LOOP_MS=8000` 系内存权衡而非规格）；三总线增益 1.0 ⇒ 真机可能削顶。解除条件：`AUDIO_BUS_GAIN_*` 冻结 + `[B]/[P]` 道次。
- **QA 本轮附带发现（移交，不在本单修）**：**BD-33**（3 个新增镜像脚本缺 `.ts.meta`，`cocos:check` 不覆盖 ⇒ 静默漏报；`.meta` 只能由编辑器生成，§14 红线，本环境无编辑器 = 阻塞写明不伪造）；**BD-34**（`_readInput()` 唯一调用点在 `_stepPlaying` ⇒ PAUSED/LEVEL_CLEAR/GAME_OVER/FINISH 四相位在**真输入链**（harness 鼠标 / Cocos touch）下收不到点击，面板按钮点不动；`App.tick` = `beginFrame → game.update → endFrame`，一次性标志被 `endFrame` 清 ⇒ 是丢弃不是延后。QA 定级「需 `[B]/[R]`」偏保守——**本环境 harness 即可复现**，现有自动化全走 `tapDesign()` 旁路故长期无人测到）。⇒ 建议另立 **WXG-T-100**，不由本单顺带改玩法输入。
- **BD-20 复发核实（结论：流程性，非工具 bug）**：v1.2 实跑 `framework:sync:check` EXIT=1（12 处 differs）为**真**——成因 = 我在末次 sync 之后又改了 `platform/{audio-synth,platform,weapp,web}.ts` 与 `core/audio/audio.ts`，未重跑 sync 就报了「verify 13 PASS」（该自述在当时为真、随后失效，**QA 限制声明 ⑥ 成立**）。已 `framework:sync` 复绿并**在同一状态下**重跑 verify 取证；`sync` 的拷贝是逐字复制，不存在 `{ }`→`{}` 规范化（既有 `{ }` 样式件反证），故不改工具。防复发建议（**待拍板，不擅自加门禁**）：pre-commit 增「暂存含 `packages/framework/src/**` 才跑 `framework:sync:check`」的条件步骤。

## WXG-T-097

- **名称**：**beads P1/P2 反馈与路由缺口工程单（BD-15/16 + BD-04 余类 + BD-10 半边 + BD-32）**
- **负责**：主理人(Qoder)　**状态**：🔶 进行中（BD-16 / BD-15 已关；BD-10 视觉半边已关；余 BD-32 / BD-04 余类）
- **进度（2026-09-15）**：**BD-16**（无选中点格轻提示）= `0b5dc79`；**BD-15**（`btn_expand` 入口）= `ffb8bd3` §3.4 **v1.20** + `88bd091` 代码 + `2acafc9` 测试 + `61af856` 文档回写 + `66c0216` 探针改判。方案取 **丙-A**（`TRAY_BAND` 上沿 420→450、托盘面板改贴带上沿）：用户约束「不影响核心区域玩法」⇒ `PUZZLE_BAND` / `gridLayoutFor()` / 关卡数据 / 托盘容量零改动；甲（跨带上沿间隙，净空仅 3px）与丙-B（`TRAY_COLS` 12→8 改根容量）均作废。同轮修两处工具缺陷：`pause-settings.test.ts` 自推带中线公式致「PAUSED 点托盘零响应」永真断言（改 `trayLayout()` + 正向对照）；探针 P10 只查旧字段且 `sig()` 剔 text 致已实现反判 FAIL（补 textSig 配对差分 + 锚点校验）。旧夹具 `g4-probe.mjs` 误当现役已全量回退，只加冻结声明。**BD-37** 新判据冲突已登记（见 backlog）并写进 `input-control §8-1`。verify 13P/1S；探针 v1.1 = PASS 28 / PASS\* 15 / FAIL 2（P4→T-102、P17→BD-12）/ ⛔ 9。
- **进度（2026-09-15·BD-10 满槽告警视觉通道）**：**「零通道」半边关闭** = `83be050` 规格（assets-spec §1.5 新增 `tray_panel_danger` + accessibility D1 关停/保留清单）→ `1654bdc` 代码（`tuning.ts:TRAY_FULL_PULSE_MS=500` + `view-model.ts::trayFullAlpha()`，`drawTray` 末尾下发 2px `palette.danger` 呼吸描边；`reduceMotion` 退静态描边）→ `4efe5a6` 测试 5 条 → `c39ebac` + `cc8065e` 探针修订 **40**。**真源**：周期 = `ux-spec §5`「满槽告警」行现文（500ms/循环），与 `DANGER_PULSE_MS`/`HINT_PULSE_MS` 同族先例一致 ⇒ **§3 冻结常量零改动**；α 幅度 0.6↔1.0 系沿用告急同族**现有实现值**，表内已声明「不构成判据」。
  - **两项实测收获**：① `timer-gameover §8-10`「与满槽告警同屏叠加」由 **⛔ 不可测转可测**（主实例本就是满槽 + 告急双主体同场）——按 `ux-spec §5:174` 口径正本「闪烁 = 同一区域内 α 的往复」分区读 ⇒ 托盘带 2.00Hz / HUD 带 1.00Hz 各自 ≤3Hz（两带不重叠：`TRAY_BAND.yMax=450 < HUD_BAND.yMin=1214`）；跨区域合成 3.00/s **不属该红线口径**但照实披露（不据此判 FAIL，也不据此宣称在红线内）。② **P7 维持 PASS\* 未升 PASS**：卡点由「缺通道」换成 **BD-35「判据缺 α 幅度」**（报告明文 QA/美术均不自造常量）⇒ 部分关闭只改「残留描述」不改整条判定（上一笔越界升格已自纠，沉淀 **K-044**）。
  - **两处探针自身缺陷（首跑造出假 FAIL，已修，沉淀 K-043）**：(a) `loadHarness()` 内部才 `stageDist()`，而它写在模块 import **之后** ⇒ 命名空间拿到上一轮旧 `.smoke`，新常量读成 `undefined`、新图元永远找不到；已前置并加「新常量不在内存就硬抛」防呆（修订 34 的 dist↔src mtime 自证**覆盖不到**装载顺序）。(b) `tray:full` 不在满槽那帧发，而在**下一次供料尝试**发现无空位时才发（`spawner.ts:_feedOnce` + `_fullReported`）⇒ 夹具未等首次广播会把「首次广播」误读成「重复广播」（看似违反 `tray-spawner §8-4`）；`fullTrayHarness()` 已改为等到广播。
  - **改的是驱动口径不是判据**：D1 测试条原走真 `InputManager` 链点面板——`_readInput()` 唯一调用点在 `_stepPlaying` ⇒ PAUSED/level-clear/game-over/finish 四相收不到任何点击（= **BD-34**，用户裁定只立 WXG-T-100 占位、本单不动码）⇒ 面板动作改 `tapDesign` 驱动（与 `pause-settings.test.ts`/探针 P22 同口径）并在用例内写明「不得据此判面板真机可点」。
  - **本轮读数**：beads **238 passed**（22 文件）；探针整轮 54 组 = **PASS 29 / PASS\* 14 / FAIL 2（P4→T-102、P17→BD-12）/ ⛔ 9**，P5 段 FAIL 归零（A05-14 音↔视三方向解耦转 PASS）；证据 `production/qa/beads/evidence/g4-probe-v1.4-t097bd10.log`（`*.log` 被 `.gitignore` 排除，不入库）。**`pnpm run verify` = PASS 12｜SKIP 1（check:size）｜FAIL 1**：唯一红**与本单无关**——仓内**未跟踪**的 `packages/framework/tests/adapters/cocos-touch-origin-contract.test.ts`（**WXG-T-104 阶段 A 自标「今日必红」**的语义锁定用例，另一条线产物，2 failed/258 passed）⇒ 未动不删；BD-10 自身口径由 typecheck 干净 + beads 全量绿 + `framework:sync:check` ✅ 三处自证。
  - **收尾与沉淀**：本轮入 `knowledge/lessons.md` 三条 —— **K-043**（取证脚本装载必在模块 import 之前）、**K-044**（判定上限由判据完备性决定）、**K-045**（并发会话下共享台账禁文件级 `git add`，改 `git diff -U3` → 按 hunk/行过滤 → `git apply --cached` 单挑自己 hunk，并对被剔对象做**计数断言**）。`kb:sync` 沉淀统计 = **新增 1（K-045）｜修改 1（去重 `[K-xxx]` 残留占位——该脚本插号不删占位，本轮第二次遇到）｜激活 0｜归档 0**；`kb:check` 八重通过。**memory 越阈处置（用户拍板「乙」）**：`memory/2026-09-15.md` 本轮段由 1398 tok 压为**「摘要 + 指针」**至 7876 tok（原 8693），**未新增 budget-exempt 豁免条**；细节正本即本节。**遗留机制债**：单日期文件仍会随轮次反复越阈，已按用户要求立项「memory 二级详情文件索引」（下一轮领号；本轮不动并发会话正在写的 `TASKS.md` 头注，以免撞号）。本单提交面：`83be050` → `1654bdc` → `4efe5a6` → `c39ebac` → `cc8065e` → 本笔台账回填（共 6 笔，均含 `WXG-T-097`）。
- **范围（四项 FAIL/开放项）**：① **BD-15** 扩展入口（`input-control §8-1` 一类路由缺；连带让 `accessibility C1` 有对象）；② **BD-16** 拒绝轻提示（`input-control §8-7` 零反馈；hint 通道 T-087 已就绪，改动极小）；③ **BD-04** 余两类 VFX；④ **BD-10** 满槽告警多通道半边；⑤ **BD-32** 引导判定：`beads-game.ts:947` 以 `runs > 0` 判老玩家而每次 BOOT 自增 ⇒ 开局即杀进程永久失引导，改「首次 `bead:placed`」或显式 `onboarded` 标记。
- **约束**：BD-32 若改 `runs` 语义/新增字段 ⇒ 走 `save-schema` 版本升位向后兼容（判例 T-088 v1→v2）；**禁**手改 §3，需动常量回传主对话串行落盘 §6；每子项一条细粒度提交含 `WXG-T-097`。
- **依赖**：T-096（音效与 VFX 同批验收更省一轮）；完成后由 QA 复跑 P8/P10/P4。

## WXG-T-098

- **名称**：**B7 裁定包一次性回写（BD-27/28/29/30/31）**——解除 BD-25 关单阻塞
- **负责**：文策渊(design-strategist) + 林绘澄(art-director)　**状态**：✅ 完成（2026-09-15，回写 + QA 改判复跑闭环；主理人裁决见报告 **§21**）
- **范围**：① **BD-27** `tray-spawner §8-1` 补「60s 窗口开/闭区间 + 帧量化容差」二句（现 ±0 在闭区间下=15 次）；② **BD-28** `§8-3` 标「作废（v1.17 D 方案）」或改写为平凡真；③ **BD-29** `ux-spec §5` 红线「无 >3Hz 闪烁」与 wrong 描边「2 次/200ms」(=10Hz) 互斥 ⇒ 二择一（改豁免或降频 ≤1.5Hz）；④ **BD-30** `ux-spec §6.2` 补注 `_firstFeed` 等价实现措辞；⑤ **BD-31** `assets-spec:106` 同类占位与 `:187` 过期尾注。
- **约束**：成员**禁写** `systems-index §3`（BD-27 若需新容差 ⇒ 回传拟改，主对话串行落盘）；回写后**先改探针再跑**（报告 §18.3-6 惯例），由主理人中转 QA。
- **依赖**：前置 T-092（登记来源）；后继 = BD-25 关单 + P20/P26 转判。
- **回写记录（2026-09-15，并行 spawn 文策渊 / 林绘澄，均直接落盘）**：
  - **BD-27** `tray-spawner §8-1`（文策渊）：定**闭区间 `t∈[0,60]`** + 次数轴维持 **±0 不放宽** + 时刻轴**单列**：`0 ≤ t_actual − 4×(i−1) ≤ 2 帧（33.4ms）`（非负硬要求，上界 2 帧 = 首供分支不累计 `_acc` 1 帧 + `_acc≥interval` 向上取整 1 帧，恰等于 P20 实测 60.033s）；邻间隔维持 ±0.1s；并补「用例前提：供料不得被满槽截断」以免与 §8-4 混测。**否因**：采「15 周期 + 1 首供、周期取 `[0,60)`」（改数值掩盖歧义，且与 §6.2/§2.4.6 的「16 颗」语义撞车）与「帧序窗口」（脱离 60 秒语义、dt 被覆盖即失效）两种候补。
  - **主理人裁定（不采）**：成员呈请新增 `SIM_FIXED_STEP=1/60s` 与 `SPAWN_WINDOW_SLACK=2帧` 入 §3 ⇒ **否**——时基属框架 `GameLoop` 实现事实，进游戏 §3 必造两处漂移；改为在 §3 前言「使用约定」新增第 4 条作**划界定义**（§3 数值零改动，随 **v1.19** 登记）。
  - **BD-28** `§8-3`（文策渊）：取**「作废（v1.17 D 方案）」**而非「平凡真」，理由 = 本条主体是 3:1 比例，杂色集恒空时不可观测，记 PASS 即伪绿；附**复活条件**（`DECOY_COLORS_MAX` 改回 ≥1 即恢复为硬判据）。**QA P26 改判口径 = ⛔ 不可验**（撤销 3:1 判据，不记 PASS；若要保留只作 `decoys` 非空 → BOOT 拒收的负向用例）。
  - **BD-29** `ux-spec §5`（文策渊）：**不开豁免、改视觉列**——放错拒绝改**单次脉冲**（淡入 60 + 保持 80 + 淡出 60 = 200ms，一个 fx 窗口内 α 极值点 ≤1）+ 连续拒绝**重启门 500ms** ⇒ 有效 ≤2 次/秒（= §3.8 冻结值，对 3Hz 红线留余量）；`reduceMotion` 退静态红描边（与 WXG-T-088 R1甲 一致）；「≤2 次/秒」正本**移回视觉列**并澄清它约束**事件重触发频次**。**实现落差已就地登记**（现码仍 10Hz，P4 实测 α 4 档）⇒ 改码拆 **WXG-T-102**。
  - **BD-30** `ux-spec §6.2`/§8 U7 + `tray-spawner §2.4.6`（文策渊）：补「等价口径」行——判据只锁可观测语义（`reset()` 后 PLAYING 第 1 个 tick 即首供，≤1 帧），`_acc` 后置与 `_firstFeed` 标志位两型均合法，**以 (ii) 为准据名**；并写明两型唯一差异（周期滞后 1 帧 vs 2 帧）正是 §8-1 取 2 帧上界之因。
  - **BD-31** `assets-spec.md:106/:187`（林绘澄）：删 `hud_timer_danger` 的 `[待 ux-spec 对齐]` 占位，改指 `ux-spec §5`/§3.1 为权威（四处互核一致，**零数值改动**，1Hz 不触 BD-29 争点）；尾注按事实重写（§3 现版 **v1.18**、真源 changelog；v1.1→v1.18 网格/托盘/告急三组零改动；「待 UX 规格产出」之说作废）。残留清单：`:7`/`:73`/`:93` 均为元纪律或历史注记非占位；`:81 tray_panel` 属 §3 未冻面板几何，仍待 GDD。
  - **新发现（移交主理人，本轮未动）**：① `ux-spec §5` 告急行只给周期未给 **α 幅度**（hint 行有 0.5↔1.0）⇒ 已入 **T-102** 前置补句；② `assets-spec §5` 包体分项 1952 vs 实测 1968（Δ16 KB，`audio-spec §4.2` 同表述）⇒ 登 backlog **BD-36**；③ `systems-index.md:3` 版本行停在 v1.12（实际 v1.18）⇒ 主对话已随 v1.19 修正。
  - **QA 侧收尾（严守真，先改预期值后实跑，顺序自证 = mtime 硬记录）**：探针修订 **38** 三处 ⇒ **P20 PASS\* → PASS**（16/16、最大滞后 **2.00 帧压线**、零负偏差；**旧字面严格读法仍 15≠16 ⇒ 两读并列呈报**）、**P26 → ⛔**（3:1 断言从脚本删除，不产绿；新增负向 **P26-N PASS**）、**P4 收紧后 FAIL**（峰点 2 = 10Hz、起点间隔 100ms）。整轮 **54 组 = PASS 27 / PASS\* 14 / FAIL 4 / ⛔ 9**；非本单 50 组判定零翻转。证据 `production/qa/beads/evidence/g4-reverify-v1.3-t098.log`，报告 **v1.3 §20**（§12–§19 与 §18.5 未动），`test-cases.md` **v1.5** §G.5。
  - **主理人裁决（报告 §21，本对话独立重跑探针复现计数）**：**BD-25 / BD-27 / BD-28 / BD-30 / BD-31 关闭**（BD-25 效力只到 `[N]` 层）；**BD-29 不关闭→转态「实现落差」**，下家 **WXG-T-102**；新赋号 **BD-35**（α 幅度，归 T-102 前置）、**BD-36**（包体分项 Δ16 KB，登 backlog）；**O4 已处理**（主对话直改 `levels-spec.md:23/:42` 的 `DECOY_COLORS_MAX` 旧值 2→**0** + 文首 §3 版本引用 v1.5→v1.19）；**G4 仍 = CONCERNS**（不因 P20 转绿升级；P4 变红 = 判据变严而非新回归）。本单收尾 `pnpm run verify` = **PASS 13 ｜ SKIP 1 ｜ FAIL 0**。
  - **提交时新撞到的门禁（非成员产出问题）**：§5 两条新注使 `ux-spec.md` = **8683 tok > 单文件上限 8000** ⇒ `pre-commit` 的 `ctx:check` 真实拦下（不是一次性竞态，首两次提交均被阻）。处置：**登记豁免 + 写可执行到期条**（`ctx/budget-exempt.json` 新增条：reason = §4 矩阵与 §5 动效表互为镜像不可割；note = 下次单次增幅 >500 tok 先评 §3 ASCII 线框外移为 `design/ux/wireframes.md` 并同步 ROUTES 锚点），取向对齐 backlog 里 `epics-beads.md 贴 B 门（结构性）` 条的「不适用豁免、不得删信息凑体积」声明。**同批第二个越界：本单自己的沉淀 `knowledge/lessons.md` = 9021 tok** ⇒ 先跑 `kb:audit` 看能否走设计内的减压阀（结果：**无归档候选**，41 条全 ≤90 天，沉淀面太年轻），因此同样只能登记豁免，但写了**硬到期条**（2026-10-15 或再增 >800 tok 先到 ⇒ 必评「按标签分片 + 同步 `tools/scripts/lib` 的 `ACTIVE_FILES`」，禁续期、禁删正文凑体积）。**口径：连续两个文件撞同一上限 ⇒ 上限该被结构性回应，逐文件放行只是延后。**同批发现另一条仓库事实：**`production/qa/beads/evidence/*.log` 被 `.gitignore:55` 排除**，只跟踪 `diag-*.mjs` ⇒ 本轮 v1.3 证据日志以路径 + mtime 被报告引用，**不入库**（已据此修正 T-099 第 ④ 条的错误表述）。

## WXG-T-099

- **名称**：**取证通路补全（`[Cocos]` 像素/色盲滤镜 + `preview:frames` 支持 beads + §H 缺口进探针）**
- **负责**：程基岩(eng) + 严守真(qa)　**状态**：📋 已立项（待施工）
- **范围**：① **B1** 无头截图 + 色盲/灰度滤镜脚本（§G 10 条像素半边、TC-PER-13/14 整条、P15 真实栅格化）；② **B8/BD-19** `render-harness-frame|clip` 去 breakout 硬编码 + `--game` 透传（现「不支持 beads」）；③ **BD-21 执行层剩余**：`test-cases §H` 中 `pause-settings §8` 10 条 + `timer §8-11/12` 2 条进探针；④ 证据入 `production/qa/beads/evidence/`——**⚠️ 该目录仅跟踪 `diag-*.mjs` 夹具，`*.log` 被 `.gitignore:55` 排除**（WXG-T-098 轮核得，原写「本轮起已入库」为误）⇒ 要么改成报告内引用路径 + mtime（现行做法），要么显式定入库形式（`git add -f` 或转 `.md` 摘要），**不得口头声称证据已随单入库**。
- **约束**：**不得**因 Node 全绿而抬升 `[Cocos]/[Device]/[R]` 综合结论；真机面仍卡 B4（AppID），解除条件写明不伪验。
- **依赖**：T-095（可信门禁）、T-096（音频取证一并跑）；产出即 G4 升 PASS 的取证面。

## WXG-T-100

- **名称**：**beads 面板相位真输入断链（BD-34）**——四相位收不到真链点击，可玩性硬断点
- **负责**：主理人(Qoder)　**状态**：📋 已占位（**用户 2026-09-15 拍板：本轮只立项不动码**，排在音频单之后）
- **现象（WXG-T-096 附带发现，QA v1.2 §15.2）**：`_readInput()` 全仓唯一调用点在 `_stepPlaying()` 内 ⇒ `paused` / `level-clear` / `game-over` / `finish` 四相位不读输入；`App.tick` 为 `beginFrame → game.update → endFrame`，`endFrame()` 清一次性标志 ⇒ 面板相位的点击是**丢弃**而非延后。harness（`dev/harness/main.ts:95` `app.input.push`）与 Cocos（`adapters/cocos/bindings.ts` 的 `onTouchStart` 桥）**同走这条真链** ⇒ 真人在浏览器里过第一关后点不动结算面板。
- **为什么三轮回归没测到**：面板相关单测与探针 P22 一律用 `game.tapDesign()`（便捷旁路，直连 `_handleTap`）⇒ 旁路恒绿、真链恒断（沉淀 **K-038**）。
- **范围（建议施工序）**：① **先加红例**：经 `input.beginFrame()/push(down,up)/game.update()/input.endFrame()` 真链点面板按钮中心，断言四相位各自生效（与同坐标 `tapDesign()` 结果一致）；② 再改接线：把输入读取上提到 `update()` 的相位路由前（或给四面板态补 `onUpdate`），**语义须守** `input-control §2.3`「面板只认自己的按钮、面板外零响应」与 `pause-settings §2.2`「遮罩吃掉其余一切」；③ 保留旁路例做双口径对照（旁路只用于装配前置）；④ 回写 `input-control §8` 判据行与 QA 探针（改判据先改探针，报告 §18.3-6 惯例）。
- **约束**：**禁**为凑绿删旁路例；`_handleTap` 的路由表是唯一裁决面，不得在 `App`/适配器侧另起一套命中逻辑；改动若触到 `§8` 判据 ⇒ 先改文档再改码。
- **依赖**：无前置；后继 = QA 复跑 P8/P10/P22 与 Playtest M2 降级轮（本轮之前音频与面板交互维度均记 BLOCKED）。
- **阶段 0 诊断（2026-09-15，主理人）——原登记的「需工程侧裁定口径」前置可关闭**：① **设计口径不需要裁定** —— `input-control §2.3 状态门禁` 已明文规定四相位有效输入（`PAUSED` 仅暂停面板按钮；`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 仅结算/失败面板按钮；`BOOT` 全部忽略），且 §8 判据 8 写明「PAUSED…**仅面板按钮响应**」⇒ 设计意图是「面板按钮**必须**响应」，当前完全不响应 = **纯实现缺陷**，无需请文策渊裁定。② **`_handleTap` 的相位路由表早已写全**：`beads-game.ts:1250 case 'game-over'` / `:1277 case 'level-clear'` / `:1288 case 'finish'` / `:1304 case 'paused'` 四分支均已正确实现「只认自己的面板按钮、面板外零响应」并逐条引条款；齿轮亦在相位路由**之前**被吞（合 `pause-settings §2.1`）。③ **唯一缺口 = `_readInput()` 仅在 `_stepPlaying` 内调用**（`:1191` 定义、`:1155` 唯一调用点）⇒ 上述四分支在现网是**死代码**。⇒ 修法是「把一个调用点挪出 playing」，**不是**重新设计输入路由；`input-control §2.3/§8` 判据**不需要改** ⇒「先改文档再改码」前置**不触发**。
- **判据侧覆盖事实（供后续 QA 单用）**：§8 十条中**仅判据 8** 覆盖 `PAUSED`；`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 三相位**仅由 §2.3 状态门禁表覆盖，§8 无独立可测条目** ⇒ 判据回写有真实空间，但**不阻塞改码**。
- **用户裁定（2026-09-15，两项全采推荐项）**：**修法 = A** —— 把 `_readInput()` 从 `_stepPlaying` **上提到 `update()`**（一处改动、全部相位覆盖、路由表原样复用）；须保留原语义「playing 内读输入后若离开 PLAYING ⇒ 本帧不再跑供料/倒计时」。**范围/顺序 = A 先工程后 QA** —— 第一单只派工程（**先加真链红例 → 再改接线 → 保留 `tapDesign` 旁路例做双口径对照**）；修完再由主理人另派 QA 复跑 P8/P10/P22 并把真链口径回写判据/探针。
- **派工（2026-09-15，负责人由 主理人(Qoder) 改为 程基岩(eng)）**：施工序严格按上文「范围/顺序 = A」；**禁止**为凑绿删旁路例；`_handleTap` 是唯一裁决面，**不得**在 `App`/适配器侧另起一套命中逻辑；判据回写**不在本单**（留后继 QA 单）。
- **⚠️ 与缺陷 C1（WXG-T-104）的关系**：两者**独立**且**观感相似**（都表现为「点了没反应」）。C1 = 全局 y 轴镜像（已在 T-104 修复并复证）；BD-34 = 非 `playing` 相位不读输入。排查时勿互相归因。T-104 实测中「`game-over` 相位 `_readInput` 调用数 = 0 / `playing` = 260」即本缺陷现象，**未并入 T-104 结论**。

- **完成记录（2026-09-15，程基岩(eng)）**：修法按用户裁定 **A** 落地 —— `_readInput()` 由 `_stepPlaying()` **上提到 `update()`**（一处改动、四相位全覆盖、`_handleTap` 路由表原样复用）。
  - **时序位置选「`machine.update(dt)` 之前」**：冻结帧内序为「输入（段内序：状态指令 → 玩法事件）→ 连击窗 → 供料 → 计时」（`core-loop §2.2.2` / `pause-settings §6`），放之后会把输入挤到计时之后 ⇒ 破坏该序。**原语义「读输入后若已离开 PLAYING ⇒ 本帧不再跑供料/连击窗/倒计时」保留**：上提后由**调用点**结构性保证（`_readInput()` 若切走相位，`machine.update` 直接派发新相位的 `onUpdate`，`_stepPlaying` 根本不被调用）；守卫原样留作该语义的显式锚点 + 防未来新增调用点静默破约。
  - ① **真链红例（先跑，证断链）**：新增 `games/beads/tests/phase-input-realchain.test.ts`（9 例）。用真链 `input.beginFrame()` → `push({phase:'down'|'up'})` → `game.update(dt)` → `input.endFrame(dt)`（与 `App._fixedUpdate` 同形）在 `paused` / `game-over` / `level-clear` / `finish` 各点该面板按钮中心，与**同坐标 `game.tapDesign()`** 双口径对照。**改码前：5 条真链正面断言全红、4 条负向闸门（面板外零响应）恒绿**；改码后 **23 文件 / 247 例全绿**。
  - ② **改码**：`games/beads/src/game/beads-game.ts` 唯一 src 改动点（`update()` 头部 + `_stepPlaying()` 注释）；**`_handleTap` 一字未动**（仍为唯一裁决面，未在 App/适配器侧另起命中逻辑）。
  - ③ **旁路例全保留**：既有 `tapDesign()` 单测零删除（`pause-settings`/`clear-panel`/`finish-panel`/`sprint-settle`/`revive`/`in-level-snapshot`/`audio-dispatch`/`powerups`/`timer`/`feedback-vfx`/`sprint` 等）；形成「旁路 + 真链」双口径。仅订正 `tests/helpers.ts::tapInFrame` 一处**陈旧注释**（`_stepPlaying` → `update()`），行为未变。
  - ④ **端到端浏览器复证（决定性验收，真指针 / headless Chrome / 1280×720）**：① 过一关（`level-clear`）→ 真指针点「下一关」screen(567.1,455)=设计(240,491) → **`playing` 且 `levelIndex 0→1`**（ADVANCED，两轮一致）；② 真指针点齿轮 screen(461.3,57.3)=设计(44,1227.8) → **`paused`** → 真指针点「继续」screen(640,308.2)=设计(375,763) → **`playing`**（UNSTUCK，两轮一致，即「永久卡死」场景已解）。每次点击前 `elementFromPoint` 校验落点元素 = canvas。旁路对照：独立 context 同坐标 `tapDesign()` = ADVANCED / UNSTUCK。复证脚本落在 `/tmp/bd34-e2e.mjs`（**未入库**：落盘面越出本单 §7）。
  - ⑤ **镜像同步**：`pnpm run framework:sync` 写入 1（beads-game 镜像件）→ `pnpm run framework:sync:check` ✅（beads framework 40 + game 26；无他人残留漂移）。
  - ⑥ **自证**：`pnpm -F @wxgame/beads test` **247/247 ✅**；`pnpm run check:arch` **OK**（仅 1 条既有 L1 编辑器产物 WARN）；`pnpm run verify` = **PASS 14 ｜ WARN 0 ｜ SKIP 1（`check:size` 未覆盖）｜ FAIL 0**。
  - ⚠️ **harness 侧附带发现（非本单范围，未改 `dev/harness/**`）**：`dev/harness/index.html` 的三个固定 DOM 面板遮挡画布对应屏幕区 —— 1280×720 下**齿轮中心 screen(461.3,32.4) 恰在 `#hud`（y∈[10,46]）之下**（实测 `elementFromPoint='hud'`），同一 x 带 `#controls`（`top:56px`，含 `<a href="./index.html">` 切换链接）会吞掉点击并**触发导航**（实测）。真人点齿轮仍可行（用齿轮热区内 screen y∈(46,56] 那条窄带），但 harness 里齿轮可点面积被压得很窄 ⇒ 建议后续单给 `#hud`/`#controls` 加 `pointer-events:none`。
  - ⚠️ **观察（未定级，交主理人）**：`App._fixedUpdate` 每个 tick 可跑多个固定子步，而 `InputManager.beginFrame()` 按设计**不清**一次性标志、`endFrame()` 每 tick 才清一次 ⇒ 一次物理 tap 在**同一 tick 的每个子步**都会被 `_readInput()` 读到（实测浏览器单次点击触发多次 `_handleTap`）。Node 单测（`advance` 每步 1 次 begin/update/end）与正常 60fps 单子步下不可见，故 `input-control §8-3/§8-10`「一次触摸仅一条指令」在浏览器多子步下**未锁**。**本单未改**，仅登记。
  - **`[R]` 阻塞**：无真机 / 无 AppID ⇒ 微信侧真链未验（与 `control-manifest §17` 同口径），**不得记 PASS**。
  - **未 commit、未 push**。判据回写（`input-control §8` 三相位可测条目 + QA 探针真链口径）**不在本单**，留后继 QA 单。
  - **⑦ 主理人独立复核（2026-09-15）**：① `pnpm -F @wxgame/beads test` = **23 文件 / 247 例全绿**（新真链文件 9/9）；`pnpm run verify` = **PASS 14 ｜ WARN 0 ｜ SKIP 1 ｜ FAIL 0**；`git diff --stat -- games/beads/src/` = **恰 1 个文件**（`beads-game.ts` +17/−5），符合「唯一 src 改动点」。② **主理人自跑真指针复证**（harness + Chrome 1280×720，先隐藏 `#hud`/`#controls`/`#help` 以避开 DOM 遮挡，全程 `mousemove`+`mousedown`+`mouseup`，未用 `tapDesign` 做验收）：
    - **[8] 失败页路径**：真指针点「重试」screen(640,412) ⇒ `playing`、`remaining=299/300`、`filled=0`（整关重置）✅
    - **[9] 负向语义保留**：`paused` 相位真指针点**面板外** screen(454,704) ⇒ **仍 `paused`**（零响应，合 `input-control §2.3` / `pause-settings §2.2`）✅
    - 另独立复现两次决定性路径：真指针点「继续」screen(640,308) ⇒ `playing`/面板关闭（**「永久卡死」解除**）；旁路铺场至 `level-clear`（3★）后真指针点「下一关」screen(567,455) ⇒ `playing`、`levelIndex 0→1`、`l2`「小屋」8×6 ✅
    - **结论：四相位真链均已接通，且面板外零响应语义未被破坏。**
  - **⑧ 对「1 帧 dt 差异」的裁定**：上提至 `machine.update(dt)` **之前** ⇒ 帧内切换相位后本帧照常跑计时段，`game-over` 重试后 `remaining = 300 − 1/60 ≈ 299.983`（帧外 `tapDesign` 为 300）。主理人在复证中实测到 `remaining=299`（`Math.ceil` 后显示值）。**接受**：与 `pause-settings §8-2`「≤1 帧 dt 可由 resume 帧自身消耗」同口径，且时序选择理由（保 `core-loop §2.2.2` 帧内序「输入 → 连击窗 → 供料 → 计时」）成立 —— 放 `machine.update` 之后会把输入挤到计时段之后，破坏该序。**登记为已裁定的取舍，不列缺陷。**
  - **⑨ 未决问题裁定（主理人）**：**① harness DOM 遮挡齿轮 = A**（另立小单给 `#hud`/`#controls` 加 `pointer-events:none`；本单不越界改 `dev/harness/**` —— 该发现登记价值高：它同时解释了「真人点齿轮可点面积被压窄」与「同 x 带 `#controls` 的 `<a href>` 会吞点击并触发导航」）；**② 多子步一次触摸多指令 = A 另立单核实**（`App._fixedUpdate` 每 tick 多子步 ⇒ 同一 tick 内每个子步都读到了一次性标志 ⇒ 一次物理 tap 触发多次 `_handleTap`；Node 单测与正常 60fps 单子步下不可见，故 `input-control §8-3/§8-10` 在浏览器多子步下**未锁**。**注意：该现象在本单改码前同样存在**（`_readInput` 当时也按子步调用），**不是本单引入的回归**；但既然现在四相位都读输入，影响面变大 ⇒ 应立项核实）；**③ `[R]` 真机 = A**（接受现状并列为真机首验 **P0**，与 `control-manifest §17` / ADR-0011 §4.2(10) 同口径）。
  - **⑩ 后继单（用户已裁定「先工程后 QA」）**：派 QA 复跑 **P8/P10/P22** 并把口径从 `tapDesign` 旁路切到**真链**；**判据回写** —— `input-control §8` 目前仅**判据 8** 覆盖 `PAUSED`，`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 三相位仅由 §2.3 门禁表覆盖、**无独立可测条目** ⇒ 有真实回写空间（**先改探针后改报告**，g4 报告 §18.3-6 惯例）。= **WXG-T-114**（已领号）。
  - **⑪ 主理人裁定（2026-09-15，三项全采推荐项）**：**① 丢帧重复投递 = A 立新单核实并修**（= **WXG-T-113**）；**② 后继 QA 单 = A 现在派**（= **WXG-T-114**）；**③ harness DOM 遮挡 = A 收编进①**（不单独立号，随 T-113 一并处理）。

## WXG-T-113

- **名称**：**框架 · 丢帧重复投递（一次 touch 多指令）+ harness DOM 遮挡齿轮**
- **负责**：程基岩(engineering-lead)　**状态**：✅ 完成（2026-09-15，程基岩）　**P1**
- **背景（WXG-T-100 附带发现，主理人已用代码锚点坐实）**：`App.tick()` = `loop.advance(frameDt)` + `input.endFrame(frameDt)`（`packages/framework/src/compose/app.ts:147-152`）；而 `_fixedUpdate(dt)` = `input.beginFrame()` + `game.update(dt)`（`:172-175`）。`advance()` 一个 tick 可跑 **N 个子步**（丢帧 / 帧 dt > `fixedDt` 时 N>1），**每子步**都 `beginFrame + game.update`；而一次性标志（`_downThisFrame` / `_upThisFrame`）按 `memory/2026-09-13.md:146` 的修复是 **`endFrame` 独占生命周期** ⇒ **同一 tick 内每个子步都读到同一次按下** ⇒ 一次物理 tap 触发 N 次 `_handleTap`。违反 `input-control §8-3`（一次触摸仅触发一条指令）与 §8-10（每帧指令上限）。
- **⚠️ 不是 WXG-T-100 引入的回归**：改码前 `_readInput` 也在每子步被调用（当时只在 `playing`）。但 T-100 后四相位都读输入 ⇒ **影响面变大**。Node 单测（每步 1 次 begin/update/end）与正常 60fps 单子步下**均不可见** ⇒ §8-3/§8-10 在浏览器多子步下**从未被锁**（K-038「旁路恒绿」同族病）。
- **Deliverables（严格按序）**：
  - ① **先写多子步复现红例**（Node 即可，不需要浏览器）：一次 `input.push(down)` 后跑一个**多子步**帧（如 `app.tick(fixedDt × 3)`），断言 `_handleTap` / 落子事件**恰 1 次**。**改码前必须真的红**。
  - ② **定级**：确认丢帧下是否真的会**连落子 / 连换选**（即危害是否可达），给出定级建议（P1/P2）与依据。
  - ③ **再改**。**修法硬约束**：**不得**破坏「**事件到达早于帧仍可见**」这一属性 —— 它是 2026-09-13 为修「Cocos 事件驱动宿主下 `justDown` 永远不可见」而**刻意建立**的（当时把一次性标志的生命周期从 `beginFrame` 移到 `endFrame`）。因此「读完即清」或「把清移回 `beginFrame`」这两种朴素修法**都会踩回原坑**，必须先论证再动手；若你判断需要动 `InputManager` 语义，请在回传中给出**备选方案比较**与对 `packages/framework/tests/**` 既有输入测试的影响面。
  - ④ **收编项（用户裁定：随本单处理，不单独立号）**：`dev/harness/index.html` 三个固定 DOM 面板遮挡画布 —— 1280×720 下**齿轮中心 screen(461.3,32.4) 恰在 `#hud`（y∈[10,46]）之下**（实测 `elementFromPoint='hud'`），同一 x 带的 `#controls`（`top:56px`，含 `<a href="./index.html">` 切换链接）会吞掉点击**并触发导航**（实测）。修法：给 `#hud` / `#controls` 加 `pointer-events:none`（或抬到不遮挡画布热区的位置），使 e2e/QA 探针能直接点齿轮中心。**改完须复核 `#controls` 的切换链接仍可点**（必要时只对 `#hud` 加 `pointer-events:none`、给 `#controls` 加内边距/避让而非整体禁用）。
  - ⑤ **自证**：新红例改码前红 / 改码后绿；`pnpm -F @wxgame/framework test` 与 `pnpm -F @wxgame/beads test` 全绿；`pnpm run verify` 汇总；若改了 `packages/framework/src/**` 须跑 `pnpm run framework:sync` + `framework:sync:check`。
- **权威来源**：`packages/framework/src/compose/app.ts`（`:147-152` / `:172-175`，权威实现）> `packages/framework/src/core/input/input-manager.ts`（一次性标志生命周期）> `memory/2026-09-13.md:140-149`（修复 4 的原始动机与验证手法）> `games/beads/design/gdd/input-control.md` §8 判据 3 / 10 > `production/TASKS-DETAIL.md` 的 `## WXG-T-100` 小节 ⑦ 段末尾的观察登记。
- **Output Path**：`packages/framework/src/core/input/**`、`packages/framework/src/compose/app.ts`、`packages/framework/tests/**`、`dev/harness/index.html`，以及 `production/TASKS-DETAIL.md` 的 `## WXG-T-113` 小节（**追加**）。**禁改**：`games/beads/src/**`（T-100 刚改完，本单若确需动须先回传请示）、`systems-index §3`、`production/qa/**`（QA 域）。
- **必读 skill**：`my-skills/wxgame-adr-arch/SKILL.md`；另读 `AGENTS.md`、`docs/architecture/control-manifest.md`（§4「事件是通知，不是状态」、§6 输入）、`memory/2026-09-13.md:140-149`。
- **约束**：热路径零分配（`tick` / `_fixedUpdate` 是每帧路径）；须补红例而非只改码；不 commit/push。
- **完成记录（2026-09-15，程基岩(engineering-lead)·CodeBuddy）**：缺陷坐实 + 修复 + harness 收编，三项全落地。
  - ① **多子步红例（先跑，证缺陷）**：新增 `packages/framework/tests/compose/input-multistep.test.ts`（6 例；`InputObserver` 观测型假游戏，在每个 `game.update()` 内统计读到 `justDown`/`justUp` 的**固定步数**，不碰旁路）。**改码前：4 红 2 绿** —— `app.tick(3×fixedDt)` 下一次 `down` 读到 **3** 次、一次 `up` 读到 **3** 次、5 子步帧读到 **5** 次、0 子步帧到达的 down 被 `endFrame` 丢弃（读到 **0** 次）；两条恒绿哨兵 = 「帧间到达仍可见」与「单子步不回归」。**改码后：6/6 全绿**。
  - ② **定级 = P1**。**危害可达、已实证**：临时探针（Node，跑完即删）在 **`paused`→真指针点「继续」** 场景实测 —— 缺陷版投影 `["game:resumed","tray:spawned","bead:placed"]`（**同一 tick 的后续子步在新相位里又落了一颗子**），修复版 `["game:resumed","tray:spawned"]`。⇒ 一次「继续」点击会**顺手落子**（玩家非预期动作、可改盘面）。**但「连落子 / 连换选」在 `playing` 相位不可达**：同坐标重放被玩法侧幂等吸收 —— `Tray.select` 同槽重复 = `already-selected`（零事件）、`_placeSelected` 首次落子即 `takeBead` 清选中 ⇒ 第 2 子步零事件；齿轮仅 `playing` 生效（第 2 子步已 `paused` ⇒ 吞掉）；道具卡首用即清槽 ⇒ 再请求落 `empty`、零扣次。⇒ **可观测危害集中在「相位切换的落穿」**（面板按钮 → 目标相位同 tick 再动作），且**须丢帧**（多子步）才触发，正常 60fps 单子步不可见。**P1 依据**：a) 违反**冻结判据** `input-control §8-3/§8-10`；b) 危害可达且玩家可见（非预期落子）；c) 属**输入层契约**缺陷，未来任何非幂等处理器都会被放大；d) 丢帧在低端机 / GC / 回前台后是常态。**诚实降权项**：`playing` 侧「连落子/连换选」当前被玩法幂等吸收 ⇒ 实际爆发面窄于字面。
  - ③ **修法**：采用「**`endFrame` 下移到 `_fixedUpdate`（每固定子步一次）**」—— `App.tick()` 去掉 `this.input.endFrame(frameDt)`；`_fixedUpdate` 改为 `beginFrame → game.update → endFrame(dt)`。语义 = **每个固定步就是一次输入帧**，与仓库既有全链辅助（各游戏 `tests/helpers.ts::advance`、QA 探针 `tickFrame`）的对称口径一致。**备选否决**：(B)「读完即清」（`snapshot` getter 消费一次性标志）**踩回原坑** —— 任何先于 `game.update` 的读 / 单帧多次读都会吞掉 tap；(C)「把清移回 `beginFrame`」**正是 2026-09-13 修复 4 修掉的 bug**（Cocos 帧间到达的 tap 永不可见）；(D) 子步仅首个读输入（`_fixedUpdate` 加子步序号）⇒ 破坏 `dx/dy` 与 holdTime，且需改 `LoopCallbacks`，过度设计。**InputManager 语义零改动**（`beginFrame` 仍不清、`endFrame` 仍独占清）；仅更新两处 doc 注释。**「事件到达早于帧仍可见」属性保住**：帧间到达的事件跨 `beginFrame` 存活、被首个 `game.update` 消费后由 `endFrame` 清除；**0 子步帧不再误丢该事件**（原 `tick` 级 `endFrame` 会丢）。**热路径零分配**：未引入任何分配。
  - ④ **harness DOM 遮挡（收编项）**：`dev/harness/index.html` —— `#hud`/`#help` 加 `pointer-events:none`（纯信息/说明，无控件）；`#controls` 面板盒加 `pointer-events:none` + `#controls > * { pointer-events: auto }`（面板背景/内边距/flex 间隙不再吞画布点击，`<a>`/`<button>` 照常可点）。**浏览器复核（playwright-cli / headless Chrome / 1280×720）**：① 齿轮中心 `elementFromPoint(461.3,32.4)` = `CANVAS#stage`（原为 `hud`）；② **真指针** `mousemove→mousedown→mouseup` 点齿轮中心 ⇒ `phase playing→paused`（端到端）；③ `#controls` 两个切换链接中心 `elementFromPoint` = 对应 `<a>`，真指针点击 breakout 链接 ⇒ `search=""`、beads 链接 ⇒ `search="?game=beads"`（**导航正常**）；④ 六个 `#controls button`（L1–L5 / 重新开始）命中自检全部 `true`；⑤ 底部 `#help` 带 `elementFromPoint` = `CANVAS#stage`。
  - ⑤ **自证**：`pnpm -F @wxgame/framework test` = **29 文件 / 273 例全绿**（新文件 6/6）；`pnpm -F @wxgame/beads test` = **23 文件 / 247 例全绿**（与 T-100 同数，无回归）；`pnpm run verify` = **PASS 14 ｜ WARN 0 ｜ SKIP 1（`check:size` 未覆盖）｜ FAIL 0**；`pnpm run framework:sync` 写入 2×2 件（`beads`/`breakout` 的 `compose/app.ts` + `core/input/input-manager.ts`）→ `framework:sync:check` ✅。
  - ⚠️ **`[R]` 阻塞**：无真机 / 无 AppID ⇒ 微信侧真链未验（与 `control-manifest §17` 同口径），**不得记 PASS**。
  - **未 commit、未 push**。**判据回写不在本单**（`input-control §8` 属设计域；§8-3/§8-10 的**多子步**口径回写留后继 QA 单 **WXG-T-114** 一并处理）。
  - **⑥ 主理人独立复核（2026-09-15）**：
    - **修法实质已核**：`tick()` 中的 tick 级 `input.endFrame` **已移除**；`_fixedUpdate()` 末尾新增 `this.input.endFrame(dt)`（`app.ts:184`），即「**一个固定步 = 一次输入帧**」，**`InputManager` 行为零改动**（改动仅限 `app.ts` + 一处 doc 注释）。`app.ts:174-183` 的注释完整交代了理由，并**显式声明保住了 2026-09-13 的属性**（事件帧间到达仍可见）+ **0 子步帧不再丢标志**（比修前更强）。语义判定：**该修法不是「读完即清」，也不是「把清移回 `beginFrame`」，因此未踩回原坑** —— 与 2026-09-13 修复 4 的动机不冲突。
    - **红例独立复跑**：`pnpm -F @wxgame/framework test tests/compose/input-multistep.test.ts` ⇒ **6/6 绿**。
    - **门禁**：`pnpm run verify` ⇒ **PASS 14 ｜ WARN 0 ｜ SKIP 1 ｜ FAIL 0**。
    - **harness CSS 改动已核**（`git diff -- dev/harness/index.html`）：`#hud` 加 `pointer-events: none`（注释写明齿轮中心 screen(461.3,32.4) 正落在其 y∈[10,46] 内）；`#controls` **面板盒**关命中 + `#controls > * { pointer-events: auto }` ⇒ **面板内边距与 flex 间隙不再吞画布点击，但切换链接与 L1–L5 按钮照常可点** —— 正是任务书要求的「避让而非整体禁用」。`#help` 同处理。
  - **⑦ 主理人裁定（成员未决四问）**：**① 定级 = P1（确认成员建议）** —— 理由采纳其诚实陈述：违反**冻结判据** `§8-3/§8-10`、危害玩家可见（`paused` 点「继续」会在新相位**多落一颗子**）、属输入层契约缺陷（未来任何非幂等处理器都会被放大）；同时**保留其诚实降权项**（`playing` 侧连落子被玩法幂等吸收 ⇒ 实际爆发面窄于字面，且须丢帧才触发）。**② 多子步口径回写 = 随 T-114（B）** —— 不另开工程单改 `control-manifest §6`；理由：该口径本质是 `input-control §8-3/§8-10` 的实现契约，归设计域条文（`8b/8c/8d` 同批）+ QA 用例即可，避免同一语义三处落。**③ holdTime 语义微变 = A 登记** —— `endFrame` 现按 `fixedDt`（非 `frameDt`）累计、0 子步帧不再累计；当前**无任何消费方**（全仓仅 framework 一处直接测），风险低，但**必须登记**（已由本段代为登记，不另开单）。**④ 游戏层真链多子步回归例 = 交 T-114** —— `games/beads/tests/**` 不在本单 Output Path，且 T-114 的真链探针已覆盖四相位；不另开单。
  - **⑧ `[R]` 真机**：无真机 / 无 AppID ⇒ 微信侧真链未验，**不得记 PASS**；与 `control-manifest §17` 同口径，真机首验列 **P0**。

## WXG-T-114

- **名称**：**QA · 真链口径切换（P8/P10/P22）+ input-control §8 三相位判据回写**
- **负责**：严守真(quality-lead)　**状态**：📋 已立项（待施工；**用户已批准写入 `production/qa/beads/`**）　**P1**
- **背景**：`WXG-T-100` 已修掉 **BD-34**（`_readInput()` 仅在 `_stepPlaying` 内 ⇒ `paused`/`level-clear`/`game-over`/`finish` 四相位真链点击全失效）。但 QA 侧的探针 **P8 / P10 / P22 至今仍用 `game.tapDesign()` 旁路**驱动面板 ⇒ **旁路恒绿、真链恒断**（沉淀 **K-038**；这正是三轮回归都没测到 BD-34 的原因）。另：`input-control §8` 十条中**仅判据 8** 覆盖 `PAUSED`，`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 三相位**仅由 §2.3 状态门禁表覆盖、无独立可测条目**。
- **Deliverables**：
  - ① **口径切换**：把 P8 / P10 / P22 从 `tapDesign()` 旁路改为**真链**（`input.beginFrame()` → `push({phase:'down'|'up'})` → `game.update(dt)` → `input.endFrame(dt)`，与 `App._fixedUpdate` 同形），并**保留旁路例做双口径对照**（旁路仍是合法的装配前置，**不得删除**）。复跑并逐条回填结果。
  - ② **§8 三相位判据回写**：为 `LEVEL_CLEAR` / `GAME_OVER` / `FINISH` 三相位补**独立可测条目**（现仅 `PAUSED` 有判据 8）。⚠️ **域边界**：`games/beads/design/gdd/input-control.md §8` 属**设计域（文策渊）**，**你不得直接改笔** —— 请产出**拟改条文**（含判据原文、环境道次、可测形式）并在回传中交主理人中转；你在 `production/qa/beads/test-cases.md` 侧落**对应用例**。
  - ③ **顺序纪律**：**先改探针、后改报告**（`g4-regression-report.md` §18.3-6 惯例）；**先写预期、后跑**（禁止先看输出再回填预期 = 假绿）。
  - ④ **诚实标注**：`[R]` 真机（无 AppID / 无真机）一律 **⛔ + 解除条件**，**不得记 PASS 亦不得记 FAIL**；本单跑不到的相位（如 `runtime` 与 `playing` 下 T-113 尚未修完的**多子步重复投递**）须显式登记为未覆盖。
  - ⑤ **与 T-113 的关系（必须写清）**：**丢帧多子步下「一次 touch 多指令」属 WXG-T-113，不在本单**。若你的真链用例在正常 60fps 下为绿、但在多子步下为红，**如实分别登记**，不要把它并进 BD-34 的结论、也不要为凑绿放宽断言。
- **权威来源**：`production/TASKS-DETAIL.md` 的 `## WXG-T-100` 小节（含四相位真链实测与主理人复证数字）> `production/qa/beads/g4-probe*.mjs` 与 `test-cases.md` 现行体系 > `games/beads/design/gdd/input-control.md` §2.3 + §8 > `packages/framework/src/core/input/input-manager.ts`（真链语义）。
- **Output Path**：`production/qa/beads/**`（探针、`test-cases.md`、`evidence/`）+ `production/TASKS-DETAIL.md` 的 `## WXG-T-114` 小节（**追加**）。**禁改**：`games/beads/design/**`（§8 条文须回传拟稿）、`packages/**`、`games/**/src/**`、`systems-index §3`、`production/qa/beads/` 之外的 `production/**`（台账主表与状态回填由主理人执笔）。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`（**必须**）；另读 `AGENTS.md`、`production/qa/beads/test-cases.md`、`knowledge/lessons.md`（查 K-038 同域教训）。
- **约束**：严守真默认 readonly，本单**已获用户批准**写入上列路径；不 commit/push；**不得为凑绿删旁路例或放宽断言**。
- **完成记录（2026-09-15，严守真）**：
  - ① **探针真链口径**（`production/qa/beads/g4-probe-v1.1.mjs`，头注**修订 41**）：`mk()` 增 `tapChain(dx,dy)` = `input.beginFrame()` → `push({phase:'down'})` → `push({phase:'up'})` → `game.update(dt)` → `input.endFrame(dt)`（与 `App._fixedUpdate` 同形；坐标 `designToScreen` → `push` → 游戏内 `screenToDesign` 读回）。
  - ② **三组口径切换（P8/P10/P22 → 真链）**：新增 **`P8R`/`P10R`/`P22R`** 真链重跑（断言子集合与旁路口径一致）；**旁路例一条未删**——`P8`/`P10`/`P22` 原样保留，仅标题加「【旁路口径 tapDesign】」并互指真链对照组。**判定/阈值零改动**。双口径对照：**差异 = 0**（`P8`=PASS\* ↔ `P8R`=PASS\*；`P10`=PASS ↔ `P10R`=PASS；`P22`=PASS\* ↔ `P22R`=PASS\*）。除口径切换外，`P22R` 额外补证「**D1 开关本身经真链可达**」（PLAYING 真链点齿轮 → PAUSED 真链点面板行 3 → `reduceMotion` 翻转 + 落档 + 回显）——这正是 BD-34 曾打断的那一步。
  - ③ **四相位真链门禁矩阵（新增 `P27a..d` · BD-34 回归闸门）**：`PAUSED`/`LEVEL_CLEAR`/`GAME_OVER`/`FINISH` 每相位**正向（真链点面板按钮 ⇒ 相位迁移/整关重置）+ 负向（真链点面板外死区 `(30,53)` ⇒ 事件增量 0、相位不变）**并列 ⇒ 负向**非平凡真**（点击确已到达 `_handleTap`）。**`P27a..d` 4 条全绿**，与 `## WXG-T-100` 小节 ⑦ 段主理人真指针复证**逐条吻合**（Node 真链 + 浏览器真指针两条独立取证链互印）。这就是 §8 三相位「无独立可测条目」空缺的 QA 侧落码。
  - ④ **`§8` 三相位判据回写（拟稿，**未越界改笔**）**：产出 **拟增条文 8b/8c/8d** 全文（含判据原文、环境道次、可测形式、来源标注、编号理由）于 `g4-regression-report.md §22.5`，**交主理人中转设计侧（文策渊）**；QA 侧对应用例落 `test-cases.md §A4b`（`TC-INP-11/12/13`，标「条文待设计侧确认」）。**`games/beads/design/**` 一字未改。**
  - ⑤ **顺序纪律**：**先改探针、后改报告**；**先写预期、后跑**（预期取自 `input-control §8`/§2.3 现文与 T-100 实测数字）。两口径在**同一次运行、同一 `.smoke` 产物**下并列产出 ⇒ 对照自洽。确定性自证：连跑两次判定**逐条一致**。
  - ⑥ **自证与计数**：`node production/qa/beads/g4-probe-v1.1.mjs` ⇒ **EXIT=0**；全量 **PASS 34 ｜ PASS\* 16 ｜ FAIL 2 ｜ ⛔ 9（61 组）**；**T-114 修订面 7 条 = PASS 5 ｜ PASS\* 2 ｜ FAIL 0 ｜ ⛔ 0**。证据：`evidence/g4-probe-v1.1-t114.log`（正式）/ `…-t114-rerun.log`（确定性）/ `…-t114-baseline.log`（改动前旁路基线）。**未改** `games/beads/src/**`、`packages/**`、`design/**`、`systems-index §3`、`cocos-input-probe.mjs`；未 commit / push。
  - ⑦ **探针自身缺陷自查（+1，诚实登记）**：`P27a`/`P22R` 证据串原直接嵌 `${h.game.phase}`，在 `rec()` 时才求值 ⇒ 打印**后续帧**相位（P27a 曾打印 `phase=playing` 与其断言 `phase=paused` 自相矛盾；与修订 15bis(a)「活快照晚读」同族）。改为**当场拷标量**后重跑；判定不受影响（判定用当场捕获的布尔）。
  - ⑧ **外部变量（非本单，已核实）**：基线 log 跑时 `dev/harness/dist`=14:26:04Z（早于被测源 `compose/app.ts` 14:39:07Z）⇒ `P5/S` 的**新鲜度门**判 FAIL；其后**并发会话（WXG-T-113）重建 dist**（→14:43:12Z）⇒ 正式轮 `P5/S` 转 PASS\*。**两轮唯一差异就是该新鲜度门那一行**，与本单改动无关；本单结论一律以正式轮 log 为准。
  - ⑨ **⚠️ 已知遗留（非本单、建议后续小改）**：`P5/S` 证据串末句「本轮探针开跑前 dist 曾早于 src 38 分钟，已用 `pnpm run harness:build` 重建」是 **T-096 轮遗留的静态文案**，对「由并发会话重建」的本次运行**不成立**（freshness 数字行本身是实时计算的、为真）。属证据文本陈旧，未在本单改笔。
  - ⑩ **`[R]` 阻塞**：无真机 / 无 AppID ⇒ 微信宿主真链 **⛔**（解除条件：有效 AppID → `build:cocos:wx` 出包 → 微信开发者工具/真机可跑 → 同一真链探针在 `wx` 宿主复取按钮命中）；**不记 PASS 亦不记 FAIL**，真机首验须把「四相位面板按钮可点」列 **P0**。
  - ⑪ **与 WXG-T-113 的边界（不得合并）**：丢帧多子步「一次 touch 多指令」属 **T-113**（框架 `App.tick` 子步 × `endFrame` 独占标志生命周期）；本单真链用例一律在**正常 60fps 单步**（直接 `game.update(dt)`，不经 `app.tick` 多子步）下取证 ⇒ **互不覆盖**；若多子步下为红**如实分别登记**，不并入 BD-34 结论、不为凑绿放宽断言。
  - ⑫ **门禁建议（裁决权归主理人）**：**G4 建议维持 CONCERNS**（本单未触及 §21.3 三条未闭项）；**BD-34 建议关闭**（T-100 已修 + 本单真链回归闸门全绿）。
- **依赖**：无前置；后继 = `§8` 三相位拟增条文经设计中转确认后回写（QA 侧用例已挂好，确认后去「拟」）；Playtest M2 降级轮可就绪。
- **⑬ 主理人独立复核（2026-09-15）**：
  - **探针独立复跑**：`node production/qa/beads/g4-probe-v1.1.mjs` ⇒ **EXIT=0**；【T-114 修订面】= **PASS 5 ｜ PASS\* 2 ｜ FAIL 0 ｜ ⛔ 0**（7 条）。全量 61 组：PASS 34 ｜ PASS\* 16 ｜ FAIL 2 ｜ ⛔ 9（FAIL 2 为既有的 P4 / 另一条，**与本单无关**）。
  - **真链口径已验证落地**：输出中可见 `PASS* P8R`、`PASS P10R`、`PASS* P22R`、`PASS P27a/b/c/d`，且旧的 `P8 / P10 / P22` **原样保留并标注「【旁路口径 tapDesign】」** ⇒ 双口径并存、**旁路例零删除**属实。
  - **关键价值确认**：**旧口径 vs 真链口径差异 = 0**（三条逐条一致）。这正是 **K-038「旁路恒绿、真链恒断」的缺口** —— 三轮回归都没测到 BD-34，就是因为缺这条「旁路 ≡ 真链」断言；本单把它补上了。
  - **判据落盘已核**：`test-cases.md` 新增 **§A4b**（`TC-INP-01R/07R/08R` 真链孪生 + `TC-INP-11/12/13` 三相位拟增，**加 `R` 后缀 / 续号不重排**，§A4b 声明**不计入**「5 组×10=50」）；版本 **v1.6→v1.7**、总用例 **140→146**（`:17` / `:130` / `:133-135` / `:481`）。
  - **§8 拟改条文已成稿**（报告 `§22.5`）：**8b（LEVEL_CLEAR）/ 8c（GAME_OVER）/ 8d（FINISH）** 三条，含判据原文、环境道次、可测形式、来源标注、编号理由 ⇒ 具备**设计中转**条件。
- **⑭ 主理人裁定（成员未决四问）**：**① §8 条文形态 = A（`8b/8c/8d` 后缀，不整体重排）** —— 与 `A05-09b` 判例同形，改动最小且不牵动既有引用；**② `P5/S` 陈旧文案 = A（本单不碰，登记待订正）** —— 避免跨任务改笔；**③ 基线 log = A（保留为旁路口径参照）** —— 其 dist 口径已在 `§22.2` 标清；**④ 真机首验 P0 = 随本单排**（与 `control-manifest §17` 同口径，不另立单）。
- **⑮ 主理人裁定：BD-34 关单** ✅ —— 判据：① 实现已修（`WXG-T-100`，四相位接通，主理人真指针复证三条真人路径 + 负向语义全过）；② **回归闸门已建**（本单 `P27a..d` 四相位真链 + 面板外负向，全绿）；③ 真链口径已从旁路切换并与旁路**逐条一致（差异=0）**。**限定**：效力只到 `[Node]` 真链 + `[Harness]` 真指针层；**`[R]` 真机仍 ⛔ 未验**，真机首验须把「四相位面板按钮可点」列 **P0**。**`G4` 建议维持 CONCERNS**（§21.3 三条未闭项本单未触及）。
- **⑯ 设计中转待办（主理人执行）**：把 `§22.5` 的 `8b/8c/8d` 拟改条文 + 编号理由转 **文策渊**（`input-control §8` 属设计域，QA 与主理人**均不代改笔**）；确认后 QA 侧把 `TC-INP-11/12/13` 的「拟」字去掉。
- **⑰ 沉淀候选（成员报 1 条，主理人认可）**：*重跑轮必须记录**产物/夹具 mtime** —— 跨会话重建 dist 会把「外部变量」误读成「本轮变化」*（本轮 `P5/S` 由 FAIL→PASS\* 即为实例，唯一差异是其新鲜度门行 `dist 14:26:04Z 早于 src 14:39:07Z`，而并发会话 `WXG-T-113` 于 22:41 重建 dist 后转绿）。与 **K-039「时点性」同族，可补其「跨会话」维度** —— 交 `kb:sync` 收尾时入 `knowledge/lessons.md`。

## WXG-T-115

- **名称**：**beads · `input-control §8` 三相位门禁 + 多子步口径回写（设计域落笔）**
- **负责**：文策渊(design-strategist)　**状态**：📋 已立项（待施工）　**P1**
- **背景（两笔判据欠账，同一文件、同一批处理）**：
  1. **三相位门禁条文缺失**：`input-control §8` 十条中**仅判据 8** 覆盖 `PAUSED`；`LEVEL_CLEAR` / `GAME_OVER` / `FINISH` 三相位**仅由 §2.3 状态门禁表覆盖、§8 无独立可测条目**。上游 **`WXG-T-100`** 已修掉 BD-34（`_readInput()` 原先只挂在 `_stepPlaying` ⇒ 四相位真链点击失效、真人过第一关后点不动结算面板且点齿轮进暂停后**永久卡死**）；**`WXG-T-114`** 已把拟改条文成稿于 `production/qa/beads/g4-regression-report.md` **§22.5**（含判据原文 / 环境道次 / 可测形式 / 来源标注 / 编号理由），QA 侧用例已挂好（`test-cases.md §A4b` 的 `TC-INP-11/12/13`，**标「条文待设计侧确认」**）。
  2. **多子步口径未落到条文**：上游 **`WXG-T-113`** 修了「丢帧重复投递」（`loop.advance()` 一个 tick 可跑 N 个子步，而一次性标志由 `endFrame` 独占生命周期 ⇒ **一次触摸触发 N 次指令**）。主理人裁定该口径**归设计域条文**（不另开工程单改 `control-manifest §6`）⇒ `input-control §8-3` / `§8-10` 需补澄清：**「一次触摸 → 一条指令」的时基是「固定步」而非「tick」；丢帧不得重复投递**。否则判据字面与实现口径仍对不上，下次回归会再次误判。
- **用户裁定（2026-09-15）**：条文形态采 **A —— `8b/8c/8d` 后缀，不整体重排 §8**（同 `A05-09b` 判例：重排会牵动台账与既有证据引用，成本更高）。
- **Deliverables**：
  1. **审阅 `§22.5` 拟稿并逐条确认或修正**。你是设计口径的裁决者：若拟稿与你对设计意图的判断不符，**按设计意图改写并说明理由**（不得为迁就实现而降低判据）。
  2. 回写 `games/beads/design/gdd/input-control.md §8`：新增 **8b（LEVEL_CLEAR）/ 8c（GAME_OVER）/ 8d（FINISH）** 三条门禁判据（每条须含：判据原文 / 环境道次 / 可测形式 / 来源标注）。
  3. 同批在 **§8-3 / §8-10** 补「**多子步 / 丢帧**」口径澄清（时基 = 固定步；丢帧不得重复投递）。
  4. 若 **§2.3 状态门禁表**措辞需与新条文对齐，一并**对齐**（**只对齐、不改变语义**）。
  5. 按该文件既有惯例更新**文首版本号 + 变更记录**。
- **权威来源（冲突以 A 为准）**：
  - **A**：`production/qa/beads/g4-regression-report.md` **§22.5**（拟稿全文）
  - **B**：`games/beads/design/gdd/input-control.md` §2.1 / §2.3 / §8 现行文本
  - **C**：`production/TASKS-DETAIL.md` 的 `## WXG-T-114`（上游产出）／`## WXG-T-100`（BD-34 修复与四相位真链实测）／`## WXG-T-113`（多子步缺失与修法）
  - **D**：`games/beads/design/ux/ux-spec.md` §4 流转表（`LEVEL_CLEAR` / `FINISH` 行）
  - **E**：实现锚点 `games/beads/src/game/beads-game.ts` 的 `_handleTap` 四相位分支（**只读**，用于核对可行性；**不得据此改设计**）
  - 不发明 `systems-index §3` 未冻结数值；本单**不应需要**任何新游戏数值。
- **Output Path**：`games/beads/design/gdd/input-control.md`（**主产物**）+ `production/TASKS-DETAIL.md` 的 `## WXG-T-115` 小节（**追加**完成记录）。
  **禁改**：`packages/**`、`games/**/src/**`、`systems-index §3`、`production/qa/**`（QA 用例去「拟」是严守真的活，不在本单）、`ux-spec.md`（若你判断必须同改，**先回传请示**）、`production/**` 除上列小节外的一切。
- **必读 skill（开工前先 Read）**：`my-skills/wxgame-gdd-writer/SKILL.md`；若行文涉及 UX 流转表述，续读 `my-skills/wxgame-ux-spec/SKILL.md`。另读 `AGENTS.md`、`games/beads/design/gdd/input-control.md`（**先摸清 §2.1/§2.3/§8 现行体系再落笔**）。
- **约束**：**不整体重排 §8**（裁定 A）；**不得为迁就实现而降低判据**；若发现实现与设计不符（除已在册的已知残留）⇒ **如实登记、回传**，不改设计迁就代码；先问再写；不 commit/push。
- **后继（不在本单）**：本条落地后由 **严守真** 把 `test-cases.md §A4b` 的 `TC-INP-11/12/13` 去掉「拟」字（`production/**` 写权限在其侧）。
- **完成记录（2026-09-15，文策渊(design-strategist)）**：主产物 `games/beads/design/gdd/input-control.md` **v1.0 → v1.1**（新增 §9 变更记录），三笔一次落盘。
  - ① **§8 新增三相位门禁判据 `8b/8c/8d`**（插在判据 8 与 9 之间；**采后缀、不重排判据 1–10**，用户裁定 A）。每条含**四要素**（判据原文 / 环境道次 / 可测形式 / 来源标注），并附「编号理由」。
    - `8b`（LEVEL_CLEAR）：点棋盘/托盘/道具卡/齿轮全忽略；**仅过关面板按钮响应（下一关 / 去冲刺）**；面板外零命中、不推进（不误触下一关、不误开冲刺）。可测：真链点「下一关」⇒ `level-clear→playing`、`levelIndex n→n+1`；点面板外 ⇒ 事件增量 0、相位与关卡号不变。
    - `8c`（GAME_OVER）：点棋盘/托盘/道具卡/齿轮全忽略；**仅失败面板按钮响应**——普通局 续时 / 重试本关，**冲刺局 再来一局 / 返回关卡**；面板外零命中、不重开。可测：真链点「重试本关」⇒ `game-over→playing`、`filled=0`（整关重置）；面板外 ⇒ 事件增量 0、相位不变。
    - `8d`（FINISH）：点棋盘/托盘/道具卡/齿轮全忽略；**仅通关面板按钮响应（去冲刺 / 重玩第 1 关）**；面板外零命中、不误触。可测：真链点「重玩第 1 关」⇒ `finish→playing`、`levelIndex=0`；面板外 ⇒ 事件增量 0、相位不变。
    - 环境道次三条同口径：`[Node]/[Probe]` 真链 ✅ ＋ `[Harness]` 真指针 ✅ ＋ `[Device]/[R]` 真机 **⛔**（无 AppID/无真机；解除条件 = 有 AppID → `build:cocos:wx` 出包 → 开发者工具/真机可跑 → 同一真链探针在 `wx` 宿主复取按钮命中）。
  - ② **对 `g4-regression-report §22.5` 拟稿的审阅结论：核心采纳，另作 3 处修正/加强**（**均未降低判据**）——
    - **修正 1（按钮集补齐，据 `ux-spec §4`/§3.3/§3.5/§3.6 与实现锚点只读核对）**：拟稿 `8b` 仅列「下一关/去冲刺」（已含）、`8c` 仅列「重试/续时」。**裁决**：`8c` 补**冲刺局子分支**（`_mode==='sprint'`：再来一局 / 返回关卡）——`game-over` 相位在冲刺局呈现的是冲刺结算面板（`ux-spec §3.5`/§4），按钮集不同，漏列即留下「有规范、无可测条目」的新型缺口（本单正是治此病）；`8b`/`8d` 的「去冲刺」保留。
    - **修正 2（形态）**：拟稿把「判据原文」用 blockquote、「环境道次/可测形式/来源标注」用合并表。**裁决**：改为**逐条四要素清单**（每条自带四槽），严格满足任务书「每条须含四要素」，也便于 QA 1:1 挂用例。
    - **修正 3（来源锚点精确化）**：实现锚点行号随码漂移，改为**符号锚**（`case 'level-clear'` / `case 'game-over'` / `case 'finish'`）并显式标注「只读核对、不据以实现改判据」（守 §10 硬约束）。
    - **未降低判据的声明**：三条均**未**因实现现状放宽（`[R]` 真机诚实标 ⛔ 且写解除条件，未记 PASS）。
  - ③ **§8-3 / §8-10 补「多子步 / 丢帧」时基口径**：判据「一次触摸 = 一条指令」的时基 = **固定步**（`GameLoop.fixedDt`，即「一个固定步 = 一次输入帧」），**非渲染 tick**；一 tick 承载 N 个固定步时**同一次触摸仍只准投递一条指令，不得因子步重放重复触发**；并加「相位切换落穿」子句（点「继续」不得顺手落子）。§8-10 同口径（N 子步注入 1 触摸 ⇒ 路由计数 =1）。
  - ④ **§2.3 状态门禁表第 3 行对齐**（**只对齐、不改语义**）：按钮集由不完整的「（下一关/重试/重玩第 1 关）」改为**逐相位准确枚举**（过关：下一关/去冲刺；失败：续时/重试本关；通关：去冲刺/重玩第 1 关）并加 §8-8b/8c/8d 交叉引用。
  - ⑤ **附带对齐（超 Deliverables 清单，已在文首/§9 登记）**：`§2.4` / `§6` 原用「帧」指输入帧，与 §8-3 新口径同义但未显式化 ⇒ 仅加「（帧 = 固定步，见 §8-3）」**透明标注，零语义/数值改动**。理由：不改则同文件内「帧」歧义正是本单要治的误判源；如需回退，删括号即可。
  - ⑥ **产出与边界**：只写 `input-control.md` 与本节。**未改** `ux-spec.md`（判断无需同改：UX 侧 §4/§3.x 与条文一致，仅作来源引用）、`systems-index §3`（**零新数值**）、`packages/**`、`games/**/src/**`、`production/qa/**`（QA 用例去「拟」= 严守真的活）。
  - ⑦ **门禁自检**：`pnpm run check:links` **OK**（agents=7 / skills=17）；`pnpm run check:tasks` **OK**（主表 46 行 / 详情 46 节配对完整）。
  - ⑧ **未 commit、未 push**。
  - **交接（经主理人中转）**：① **后继 = 严守真** 把 `test-cases.md §A4b` 的 `TC-INP-11/12/13` 去「拟」（本单未越界改 QA 文档）；② 条文新增的**次按钮**子句（`8b`「去冲刺」/ `8c`「续时」与冲刺局子分支 / `8d`「去冲刺」）**真链孪生用例待 QA 补**——现 `TC-INP-11/12/13` 仅覆盖各相位**主按钮** + 面板外负向（**本条如实登记，不为凑覆盖而删子句**）。
- **⑨ 主理人独立复核（2026-09-15）**：逐项 `grep` / `sed` 已核 —— **`8b/8c/8d` 落盘**（`:109 / :115 / :121`，**逐条四要素齐备**）；**§8-3 时基口径落盘**（`:100`，含「时基 = 固定步（`GameLoop.fixedDt`），**非渲染 tick**」+「**丢帧 / N 子步下同一次触摸仍只准投递一条指令**」+ **相位切换落穿子句**（点「继续」不得顺手落子）+ 明写「该口径由 `App._fixedUpdate` 每固定子步一次 `beginFrame`/`endFrame` 保证」）；**§8-10 多子步口径落盘**（`:130`，N 固定步注入 1 触摸 ⇒ 路由计数 =1；单固定步注入 20 触摸 ⇒ 仅 1 条入路由）；**`§2.4`/`§6` 的「帧」标注「= 固定步」**（`:50 / :79 / :82`）；**§2.3 第 3 行对齐**（按钮集逐相位枚举 + 交叉引用 `§8-8b/8c/8d`，**只对齐未改语义**）；**文首 v1.1 + `## 9. 变更记录`**（`:3 / :134 / :139`）。**判定：落盘属实、无虚报。**
- **⑩ 主理人特别肯定一处写法**：`§8-3` 末句「**若实现在丢帧多子步下未达此口径，须如实登记为缺陷，不得放宽本条**」—— 这是**判据不迁就实现**的正确兜底，正是本仓反复强调的纪律（对照：C1 与 BD-34 的成因都是「判据没写清 → 实现绕过去 → 无人发现」）。**该句予以保留，不得删。**
- **⑪ 对成员三处修正的裁定（予以采纳）**：**修正 1（`8c` 补齐冲刺局子分支按钮集「再来一局/返回关卡」）** —— **实质增益**，采纳。若不补，本单刚填的三相位缺口会因「冲刺局走同一 `case 'game-over'` 但按钮集不同」而立刻留下新缺口。**修正 2（拆成逐条四要素清单）** —— 采纳（满足可测性与 QA 1:1 挂用例）。**修正 3（行号锚 → 符号锚 `case 'level-clear'`）** —— 采纳，防「随码漂移的行号」再次失效（本仓已有该类事故）。
- **⑫ 主理人裁定（成员未决三问）**：**A｜`§2.4`/`§6` 顺带对齐 = 保留** —— 零语义 / 零数值改动，且是给「帧」一词消歧（与 §8-3 时基口径同源），属正当同步；**不采 ③ 整句改写**（避免扩大改动面）。**B｜次按钮取证缺口 = 并入后继 QA 单**（去「拟」时同批补），**不另开单** —— 同一文件同一批，拆单只会增加交接成本。**C｜道次用词 = 保持 `[Device]/[R]` 并列** —— 兼容 `test-cases` 图例与 QA 报告两套既有用法。
- **⑬ 后继（需领号，不在本单）**：派 **严守真** 做两件事 —— ① 把 `test-cases.md §A4b` 的 `TC-INP-11/12/13` **去「拟」**；② 按 `8b/8c/8d` 新增的**次按钮子句**补**真链孪生用例**（含 `8c` 冲刺局子分支；若该路径在本环境不可达，**如实标 ⛔ 并写解除条件**）。= **WXG-T-116**（已领号）。

## WXG-T-116

- **名称**：**QA · `§A4b` 去「拟」+ 次按钮真链孪生用例（含冲刺局子分支）**
- **负责**：严守真(quality-lead)　**状态**：📋 已立项（待施工；**用户已批准写入 `production/qa/beads/`**）　**P2**
- **背景**：上游 **`WXG-T-115`** 已把设计侧条文回写完毕 —— `games/beads/design/gdd/input-control.md` 新增 **§8 的 `8b`（LEVEL_CLEAR）/ `8c`（GAME_OVER）/ `8d`（FINISH）** 三条门禁判据（每条含判据原文 / 环境道次 / 可测形式 / 来源标注），并在 **§8-3 / §8-10** 补了「多子步 / 丢帧」时基口径（时基 = **固定步**，非渲染 tick；丢帧不得重复投递；含相位切换落穿子句）。但 QA 侧尚有两笔收尾：
  1. **`production/qa/beads/test-cases.md §A4b`** 的 `TC-INP-11/12/13` 仍标「**条文待设计侧确认**」（`§8-8b/8c/8d` 写作「**拟增**」）⇒ 条文已定稿，**该去「拟」**。
  2. **次按钮子句尚无真链孪生用例**。`WXG-T-114` 的 `P27a..d` 与 `TC-INP-11/12/13` 只覆盖各相位**主按钮** + 面板外负向；而 `8b/8c/8d` 的按钮集**不止主按钮**，且 `8c` 还含**冲刺局子分支**（`XWXG-T-115` 修正 1 补齐，见 `## WXG-T-115` ⑪）。**该缺口由 文策渊 主动登记、主理人裁定并入本单**。
- **Deliverables**：
  1. **去「拟」**：把 `TC-INP-11/12/13` 的判据引用从「`§8-8b/8c/8d`（**拟增**）」改为正式编号 **`input-control §8-8b / 8c / 8d`**；`§A4b` 节首与变更记录同步（判据/阈值**零改动**，本条只改引用与状态）。
  2. **补次按钮真链孪生用例**（逐条对应条文新增的次按钮子句）：
     - `8b`「**去冲刺**」⇒ 进冲刺模式（相位 / 模式断言）
     - `8c` 普通局「**续时**」（⚠️ 依赖激励视频 `onRewarded` 路径；harness 侧是 `MockRewardedAdProvider`，可达性由你实测判定）
     - `8c` **冲刺局子分支**「**再来一局**」「**返回关卡**」（冲刺结算面板，与普通局按钮集不同）
     - `8d`「**去冲刺**」
  3. **探针同步**：在 `production/qa/beads/g4-probe-v1.1.mjs` 加对应用例（编号自定，建议沿 `P27` 族续号并在输出中说明映射），**先改探针、后改报告**。
  4. **不可达者如实标 ⛔**：任一路径若在本环境不可达（如「续时」需真实激励视频、冲刺子分支受前置约束），记 **⛔ + 解除条件** —— **不得记 PASS，亦不得记 FAIL**。
  5. **顺序与诚实纪律**：**先写预期、后跑**（禁止先看输出再回填预期 = 假绿）；**旁路例一条不得删**；**不得为凑绿放宽断言**。
- **权威来源（冲突以 A 为准）**：
  - **A**：`games/beads/design/gdd/input-control.md` **§8-8b/8c/8d**（**已定稿的条文**，含按钮集与可测形式）与 **§8-3 / §8-10**
  - **B**：`production/TASKS-DETAIL.md` 的 `## WXG-T-115`（条文回写与三处修正）／`## WXG-T-114`（真链口径与 `P27a..d`）／`## WXG-T-100`（四相位真链实测）
  - **C**：`production/qa/beads/test-cases.md §A4b` 与 `g4-probe-v1.1.mjs` 现行体系（**先摸清再落笔**）
  - **D**：`games/beads/design/ux/ux-spec.md` §4 流转表 / §3.3 / §3.5 / §3.6（按钮集来源）
  - 不引用你未实际执行过的结果。
- **Output Path**：`production/qa/beads/**`（探针、`test-cases.md`、`evidence/`）+ `production/TASKS-DETAIL.md` 的 `## WXG-T-116` 小节（**追加**）。
  **禁改**：`games/beads/design/**`（条文已定稿，本单**只读引用** —— 若你认为条文有误，**回传登记、不得代改笔**）、`packages/**`、`games/**/src/**`、`systems-index §3`、`production/qa/beads/` 之外的 `production/**`（台账主表与状态回填由主理人执笔）。
- **环境事实**：✅ Node ≥20 + `node production/qa/beads/g4-probe-v1.1.mjs`（依赖 `dev/harness/.smoke` 暂存产物，必要时先 `harness:build`／`harness:smoke`）；✅ 浏览器真链可用（`playwright-cli` + 本机 Chrome，`export PATH="$HOME/.workbuddy/binaries/node/workspace/node_modules/.bin:$PATH"`）。⚠️ 已知坑：**须在 `phase=playing` 下取状态**、**`mousemove` 不要放进 for 循环**（harness 顶层 DOM 遮挡已由 WXG-T-113 修掉）。⛔ 无真机 / 无 AppID ⇒ `[R]` 一律 ⛔。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`（**必须**）；另读 `AGENTS.md`、`production/qa/beads/test-cases.md`、`games/beads/design/gdd/input-control.md` §8、`production/TASKS-DETAIL.md` 的 `## WXG-T-116` 与 `## WXG-T-115` 小节。
- **约束**：严守真默认 readonly，本单**已获用户批准**写入 §Output Path 上列路径；不 commit/push；**不得为凑绿删旁路例或放宽断言**；**不得代改设计条文**。
- **完成记录（2026-09-15，严守真）**：
  - ① **去「拟」**（`test-cases.md §A4b`）：`TC-INP-11/12/13` 的判据引用由「`§8-8b/8c/8d`（**拟增**，待设计侧确认）」改为正式编号 **`input-control §8-8b / 8c / 8d`**（WXG-T-115 已定稿），状态串同步；§A4b 节首、口径注、合计表、变更记录同步。**判据 / 阈值零改动**（只改引用与状态）。探针侧 P27b/c/d 标题/归属串同步去「拟」。
  - ② **补 5 条次按钮真链孪生**（探针 `P27e..i`，逐条对应 `8b/8c/8d` 新增的次按钮子句）：
    - `P27e`/`TC-INP-11b` = `8b`「**去冲刺**」：LEVEL_CLEAR 真链点副钮 ⇒ `mode normal→sprint`、`playing`。
    - `P27f`/`TC-INP-12b` = `8c` 普通局「**续时**」：真链点钮 ⇒ `watchingAd=true`、相位仍 `game-over`（等回调）；`MockRewardedAdProvider.settle('complete')` 发奖腿 ⇒ `playing`、`remaining += REVIVE_BONUS_SEC`、`revived=true`。
    - `P27g`/`TC-INP-12c` = `8c` **冲刺局子分支「再来一局」**：冲刺结算真链点主钮 ⇒ `mode=sprint`、`playing`。
    - `P27h`/`TC-INP-12d` = `8c` **冲刺局子分支「返回关卡」**：冲刺结算真链点副钮 ⇒ `mode=normal`、`playing`。
    - `P27i`/`TC-INP-13b` = `8d`「**去冲刺**」：FINISH 真链点副钮 ⇒ `mode normal→sprint`、`playing`。
    - 每条**正负并列**（同相位真链点面板外死区 `(30,53)` ⇒ 事件增量 0 ⇒ 负向非平凡真）。装配前置用**合法公开 API**（`fillBoard` / `startSprint`），判据主体 = 面板按钮真链点击。
  - ③ **实测结果**：`node production/qa/beads/g4-probe-v1.1.mjs` ⇒ **EXIT=0**；全量 **66 组：PASS 38 ｜ PASS\* 17 ｜ FAIL 2 ｜ ⛔ 9**（较 T-114 轮 61 组 **+5**）；**T-116 修订面 5 条 = PASS 4 ｜ PASS\* 1 ｜ FAIL 0 ｜ ⛔ 0**。确定性自证：连跑两次判定**逐条一致**。证据：`evidence/g4-probe-v1.1-t116.log`（正式）/ `…-t116-rerun.log`（确定性）。
  - ④ **⛔ 边界（不记 PASS 亦不记 FAIL）**：`P27f` 的**发奖腿由 harness 替身驱动**（`MockRewardedAdProvider(null)`，autoSettle 关 ⇒ 须显式 `settle()`）⇒ 只证「按钮→请求→发奖→续打」**结构链路**；真机激励视频**拉起/发奖/「未看完·skip·error」三分支**属 `[R]`（无 AppID/无真机）⇒ **⛔**（解除条件：有效 AppID → `build:cocos:wx` 出包 → 开发者工具/真机可跑 → 同一真链探针在 `wx` 宿主复取）。故 `TC-INP-12b` 记 **PASS\*** 而非 PASS。
  - ⑤ **纪律**：**先改探针、后改报告**（报告 §23）；**先写预期、后跑**（预期取自 `input-control §8-8b/8c/8d` 现文 + `ux-spec §4`/§3.4/§3.5/§3.6）；**旁路例一条未删**；**未放宽任何断言**；**未改条文与阈值**；**`games/beads/design/**` 一字未改**（只读引用）。
  - ⑥ **产物新鲜度（自证）**：跑前 `dev/harness/dist/games/beads/src/game/beads-game.js` mtime = **2026-09-15 22:53:12**、`.smoke` 对应件 = **22:56:51**（晚于被测源 ⇒ 未报新鲜度门失败）；已按 T-114 教训**记 mtime 入证据 log 头部**。
  - ⑦ **探针自身改动自查**：P27b/c/d 去「拟」；新增 `T116_PREFIXES` **独立分桶**（不并入 T-114，六段计数不得合并解读）；修两处证据串笔误（多余反引号，判定不受影响）；未新增探针自身缺陷。
  - ⑧ **门禁建议（裁决权归主理人）**：**G4 建议维持 `CONCERNS`**（未触及 §21.3 三条未闭项）；**`8b/8c/8d` 次按钮子句在 `[Node]/[Probe]` 真链层已可测且成立**；**去「拟」收尾完成**。
  - ⑨ **文档产出**：`production/qa/beads/{g4-probe-v1.1.mjs, test-cases.md(v1.7→v1.8), g4-regression-report.md(v1.5→v1.6 §23)}` + `evidence/g4-probe-v1.1-t116{,-rerun}.log`。**未改** `games/beads/design/**`、`packages/**`、`games/**/src/**`、`systems-index §3`、`production/qa/beads/` 之外的 `production/**`；未 commit / push。
- **⑩ 主理人独立复核（2026-09-15）**：
  - **探针独立复跑**：`node production/qa/beads/g4-probe-v1.1.mjs` ⇒ **EXIT=0**；【T-116 修订面】= **PASS 4 ｜ PASS\* 1 ｜ FAIL 0 ｜ ⛔ 0**（5 条：`P27e/f/g/h/i`）。全量 **66 组**（较 T-114 轮 61 组 +5）：**PASS 38 ｜ PASS\* 17 ｜ FAIL 2 ｜ ⛔ 9**（FAIL 2 = 既有 P4/BD-29 + 另一条，**与本单无关**）。
  - **去「拟」已核**：`test-cases.md` 的 `TC-INP-11/12/13` 判据列已由「`§8-8b`（**拟增**）」改为正式 **`§8-8b/8c/8d`**，状态串改为「**条文已定稿（WXG-T-115）**」（`:137-139`）；新增 **5 条** `TC-INP-11b/12b/12c/12d/13b`（`:140-144`）；版本 **v1.7→v1.8**、总用例 **146→151**（`:496`）。**判据/阈值零改动属实。**
  - **⚠️ 一处需说明的「残留」已澄清**：`grep "拟增\|条文待设计侧确认"` 仍有 **3 处**（`:125 / :495 / :496`）—— 逐条读过，**全部是合法的历史/动作引用**：`:125` 是 §A4b 节首叙述 T-114 当时的产出状态；`:495` 是 **v1.7 变更记录的历史条目**；`:496` 是 **v1.8 条目在描述「去拟」这个动作本身**（须引用旧串才能说明改了什么）。**非漏改，不作缺陷。**
  - **旁路例保留已核**：`P8/P10/P22` 与 `tapDesign` 前置**一条未删**。
  - **特别肯定一处取证质量**：`P27f`（「续时」）**把两个替身分支的证据分开呈现** —— `Noop`（weapp）⇒「即将开放」轻提示、`Mock`（harness）⇒ 等回调 + `settle('complete')` 发奖（`remaining 0→60`、`revived=true`、revive 音 =1）。这恰好证明了**同一 UI 在两个宿主下的差异化行为都在设计预期内**，比只跑一条更有说服力。
- **⑪ 主理人裁定（成员未决四问）**：**① `TC-INP-12b` 记 `PASS\*` = 接受** —— 按钮腿（真链点「续时」⇒ `watchingAd=true`、相位仍 `game-over`）是**真实可测且已成立**的，改记 ⛔ 会**低估**已证部分；`PASS\*` + 显式边界（真机激励视频维度 ⛔）正是该语义的正确用法。**限定**：真机广告拉起 / 发奖 / 「未看完·skip·error」三分支仍 **⛔**。**② 主/次按钮腿计入口径 = 维持并入 §A4b 行、不单开行** —— 与用户「采后缀、不重排」的裁定同口径；单开行会割裂「同判据的不同腿」这一语义。已要求（且成员已写）节首「主/次按钮孪生」注说清口径。**③ `8c` 冲刺局「续时主钮不出现」的可测句 = 登记待办、不在本单** —— 现条文已有规范、只是可测化程度不足，本轮以 `mode=sprint` 断言**间接覆盖**；属**设计域条文补句**，并入下次 `input-control` / `ux-spec` 修订即可。**不记为缺陷**（避免为一句开一单）。**④「产物 mtime 入证据」升格为探针默认输出 = 方向接受，登记为探针维护待办** —— 这正对应成员自己在 T-114 登记的沉淀候选（K-039「时点性」的「跨会话」维度），机械化为默认输出能结构性防「把外部变量误读成本轮变化」；但**本单已产出正式轮证据，中途改探针会让证据与代码版本错位** ⇒ 不追改、留下次探针维护一并做，**不另开单**。
- **⑫ 门禁**：**G4 维持 `CONCERNS`**（本单只补「次按钮腿」取证维度，**未触及 §21.3 三条未闭项**：P4/BD-29 实现落差仍在、`[B]/[C]/[R]/[P]` 道次未执行、包体红线无数据）。**本单 PASS**。
- **⑬ 至此 BD-34 全链收口**：实现修复（T-100）→ 真链回归闸门（T-114 `P27a..d`）→ 设计判据条文（T-115 `8b/8c/8d` + §8-3/§8-10）→ **次按钮腿孪生取证 + 判据去「拟」（本单）**。四相位**主/次按钮**在 `[Node]/[Probe]` 真链层均已可测且成立；`[R]` 真机层 ⛔（首验 P0 项：四相位面板**主/次按钮**可点 + 点击落点 + dpr 缩放）。

## WXG-T-101

- **名称**：**pre-commit 增 Cocos 镜像漂移条件守卫（防 BD-20 再复发）**
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-15，用户拍板「加条件步骤」）
- **背景**：BD-20 已两次复发（v1.0 轮 4 处漂移入 HEAD ⇒ G1 FAIL + 全链路 Cocos 取证阻塞；WXG-T-096 轮 12 处）。成因固定：改了 `packages/framework/src/**` 忘记跑 `framework:sync`，而 `.githooks/pre-commit` 现只跑 secrets / links / plugins / mcp / ctx，**没有** `framework:sync:check` ⇒ 漂移可以顺利入 HEAD，等下一轮独立复验才发现（沉淀 **K-039**）。
- **Deliverables**：① pre-commit 新增**条件步**：`git diff --cached` 含 `packages/framework/src/**/*.ts` 时才跑 `sync-framework-to-cocos.mjs --check`（无框架改动的提交零开销）；② **只拦不写**——理由与 `check:mcp` 同取向，且技术上必须如此：`git commit` 提交的是**索引**，钩子改写工作区不会进本次提交，静默重写只会造出「钩子说绿了但镜像仍漏在 HEAD 之外」的新坑；③ 失败提示须写清修复动作（`pnpm run framework:sync` + 重新暂存镜像）与「勿用 `--no-verify`」；④ 回写 `docs/agent/hooks-best-practices.md` 步骤表 + `control-manifest.md §15` 镜像条（把「靠人记得跑」升级为硬门）。
- **验收**：红→绿双向手工实测——(a) 只暂存框架源码改动 ⇒ 钩子 exit=1 且点名 ①⁷⁄₈ 步；(b) 补跑 sync 并暂存镜像 ⇒ 同一步通过；(c) 不含框架源码的提交 ⇒ 该步整体不触发（零开销）。
- **约束**：不改 `sync:check` 的比对口径；不为通过而放宽任何阈值。
- **完成记录（2026-09-15）**：① `.githooks/pre-commit` 新增步骤 **①⁷⁄₈**（插在 ①¾ `check:mcp` 与 ② ctx 重建之间），`STAGED_FW` 命中才跑；头注步骤表同步。② **只拦不写**（技术上必需：提交的是索引，钩子改工作区不会入本次提交），失败提示写明 `pnpm run framework:sync` + 重暂存镜像 + 勿用 `--no-verify`。③ 回写：`docs/agent/hooks-best-practices.md` §1 表格行 + 新增取向注（含红→绿复现命令）、`control-manifest.md §15` 镜像条升为硬门。④ **验收实测**：(a) 只暂存 `core/audio/audio.ts` 换行改动 → `sh .githooks/pre-commit` **EXIT=1** 并点名四处 differs；(b) 补跑 sync 并暂存两份镜像 → **EXIT=0** 且步骤行正常打印；(c) 本单提交（仅 hook + .md，无框架源码）→ 日志中无 `sync-framework-to-cocos` 行，零开销成立。测试产生的临时改动已 `git checkout` 复位，事后 `framework:sync:check` ✅。⑤ **未做**：未脚本化自测（无 `*-selftest.sh`，靠文档里的复现命令），因为钩子依赖真实索引态，脚本化需临时仓库夹具，性价比待评。
- **追加修正（2026-09-15，WXG-T-098 轮发现，归本单）**：初版 `STAGED_FW` 只匹配 `^packages/framework/src/.*\.ts$`，**但 `sync-framework-to-cocos.mjs` 同时镜像 `games/<game>/src/**`**（一次 sync 报「beads framework 39 + game 26」）⇒ 只改玩法源码的提交不触发核镜像，守卫漏一半（与 `control-manifest §15` 上方「ES5 适用面 = 入库源码（框架 + `games/*/src`）」口径也不一致）。已改为 `grep -E` 并列两条前缀，并手工复现两类源的红→绿：(a) 改 `games/beads/src/config/tuning.ts` 不 sync → `--check` **EXIT=1**（报 `game/config/tuning.ts differs`）且新 grep 命中该文件；(b) 补跑 sync → **EXIT=0**；测试临时改动已复位（源与镜像均回 HEAD）。`docs/agent/hooks-best-practices.md` 取向注与 `control-manifest.md §15` 镜像条同步改写。

## WXG-T-102

- **名称**：**beads 放错拒绝描边改码（BD-29 下家）**
- **负责**：主理人(Qoder)　**状态**：📋 已立项（待排期；由 WXG-T-098/BD-29 派生）
- **背景**：`ux-spec §5` 已（WXG-T-098）把「放错拒绝」重写为**单次脉冲 + 500ms 重启门**，但现实现仍按旧表——QA P4 实测 wrong 态 danger α **4 档起伏 / 200ms = 10Hz**，既违新表亦违 §3.8 冻结的「错误反馈 ≤2 次/秒」，并与 >3Hz 硬红线相抵（光敏性安全面，**不开豁免**）。⇒ 文档已一致，**代码未一致**；不得把「文档已改」读成「已修」。
- **Deliverables**：① **先补文档**：`ux-spec §5` 告急行补 **α 幅度**（林绘澄 BD-31 核对时发现只给周期未给幅度；参照 hint 行 0.5↔1.0 口径，由 UX 定值，不得发明为 §3 常量）；② 改码：`buildRenderModel`/view-model 侧 wrong 态描边由「200ms 内 2 次闪」改为「单次淡入 60 / 保持 80 / 淡出 60」，并加**连续拒绝 500ms 重启门**（与 `AUDIO_REJECT_MIN_INTERVAL=0.5s` 同拍，双通道一致）；③ `reduceMotion` 开启时退**静态红描边 + 抖动位移归零**（沿用 WXG-T-088 R1甲 现有分支，不新增开关）；④ 单测：断言一次 fx 窗口内 α 极值点数 ≤1 与 500ms 门限（**热路径零分配**纪律照常：不新增每帧集合分配）；⑤ 回写 `ux-spec §5` 的「实现落差登记」行为已一致，并**先改探针 P4 预期再跑**（报告 §18.3-6 惯例）。
- **约束**：**禁**手改 `systems-index §3`（本单无需新常量；若施工中发现必需 ⇒ 回传拟改串行落盘）；**禁**为凑绿删旧断言而不登记改判；渲染层不持有状态（L5）。
- **依赖**：前置 T-098（规格已回写）；可与 T-097 并行（不同文件：T-097 触 view-model 的扩展入口/轻提示，本单触 wrong 态描边时序 ⇒ **同文件需串行**，排期时二选一先或拆开改）。
- **阶段 0 诊断（2026-09-15，主理人）**：
  - **①「先补文档再改码」前置已满足** —— （原登记 ① 要求先补 `ux-spec §5` **告急行** α 幅度）。核对后确认：**告急行 α 幅度属 BD-35，与 wrong 描边改码无依赖**（告急脉冲 ≠ 放错拒绝描边，两个不同视觉）。而 **wrong 描边的规格早在 WXG-T-098 已定稿**（`ux-spec §5:180`：单次脉冲 淡入 60 / 保持 80 / 淡出 60＝200ms、**α 极值点 ≤1**、连续拒绝**重启门 500ms**、`reduceMotion` 退静态红描边 + 抖动归零），同文件 `:203` 亦明写「**本条回写后由工程侧跟进**」⇒ **工程侧已被放行，可立即改码**，不必等 BD-35。⇒ BD-35 拆出为 **WXG-T-117**（文策渊）**并行**推进。
  - **② 根因两处已精确定位**：
    - **α 往复（实测 10Hz）**：`games/beads/src/view/view-model.ts:539` —— `const flash = snap.reduceMotion ? 1 : 0.4 + 0.6 * Math.abs(Math.sin(snap.wrongProgress * Math.PI * 2));`，`|sin(2πp)|` 在 p=0.25/0.75 各一个极值 ⇒ **2 极值点 / 200ms = 10Hz**（设计要求 ≤1）。
    - **无 500ms 重启门**：`games/beads/src/game/beads-game.ts:1569` —— `this._wrongFx = { row, col, elapsedMs: 0 }` 每次 mismatch **无条件重置** ⇒ 100ms 连点即 100ms 一次脉冲 = **10 次/秒**（设计要求 ≤2 次/秒）。
  - **③ 同文件冲突风险已解除**：原登记警告「与 T-097 同文件需串行」。实测 `view-model.ts` **已提交、工作树无未提交改动** ⇒ 可安全改动。
  - **④ 新增常量归属已定**：`WRONG_FX_MS = 200`、`WRONG_SHAKE_PX = 3` 现位于 `games/beads/src/config/tuning.ts:376/378`（属「反馈态动效」组，来源 `ux-spec §5`）。新增的 **60 / 80 / 60 / 500** 属**同组同源**，**应进 `tuning.ts`**，**不触 `systems-index §3`**（与 `WRONG_FX_MS` / `HINT_PULSE_MS` 同判例）⇒ 符合本单「禁手改 §3」约束。
- **用户裁定（2026-09-15）**：**BD-35 并行另开单（= WXG-T-117，不阻塞本单）**；**本单负责改为 程基岩(eng)**，范围 = **原 Deliverable ②③④**（改码 + `reduceMotion` 静态分支沿用 + 单测）；**Deliverable ①（告急 α 幅度）已移交 WXG-T-117**；**修完再由主理人另派 QA「先改探针 P4 预期再跑」**（报告 §18.3-6 惯例）。
- **派工（2026-09-15）**：负责由 主理人(Qoder) 改为 **程基岩(engineering-lead)**；Output Path = `games/beads/src/view/view-model.ts`、`games/beads/src/game/beads-game.ts`、`games/beads/src/config/tuning.ts`、`games/beads/tests/**`。**禁改** `systems-index §3`、`ux-spec.md`（属 WXG-T-117）、`production/qa/**`（QA 域）。
- **完成记录（2026-09-15，程基岩 engineering-lead）** —— 范围 = 原 Deliverable **②③④**（① 告急 α 幅度已移交 WXG-T-117）：
  - **① α 包络（改码，`view-model.ts`）**：`wrong` 描边由 `0.4 + 0.6·|sin(2πp)|`（200ms 内 **2** 极值点 = 10Hz）改为**单次脉冲包络** `wrongFlashAlpha(p)`：`ms = p·WRONG_FX_MS`；`<60ms` ease-out 淡入（`t(2−t)`，t=ms/60）→ `60..140ms` 保持 1 → `≥140ms` ease-in 淡出（`1−t²`，t=(ms−140)/60）。分段常量 `WRONG_FADE_IN_MS=60` / `WRONG_HOLD_MS=80` / `WRONG_FADE_OUT_MS=60` 落 `tuning.ts`「反馈态动效」组（同 `WRONG_FX_MS` 判例，**不触 §3**）。`wrongFlashAlpha` 为**纯函数、零分配**（无闭包/无中间集合）——在 `buildRenderModel` 每帧可达路径上。
  - **② 500ms 重启门（改码，`beads-game.ts`）**：新增 `_armWrongFx(row,col)` + 时基字段 `_wrongFxArmedAtMs`（基准 `_pulseClock` 单调 ms）；`rejected/mismatch` 分支由「无条件 `this._wrongFx = {…}`」改为调 `_armWrongFx` ⇒ 自上次起播未满 `WRONG_FX_RESTART_GATE_MS=500` 的新 mismatch **不重启**（门内且 fx 在播 ⇒ 沿用相位不重置 elapsedMs；门内但 fx 已自然结束 ⇒ **本次不给视觉反馈**）。**非每帧路径**（仅拒绝帧调用）。
    - **门语义判断（任务书要求回传，未静默选）**：§5:180 字面把门写成「**视觉脉冲**重启门」（仅直提描边），但 §3.8 冻结值是「**抖动+描边闪** ≤2 次/秒」——「错误反馈」是**两通道一体的事件上限**。若只门禁描边、放抖动自由重启，则 100ms 连点可把抖动刷到 **10 次/秒**，按字面即违 §3.8。故本实现**按 §3.8 从严**：门禁**整个 wrong-fx 事件**（抖动与描边同进同退）。理由：① §3.8 为数值真源且 P1 红线不开豁免，从严读；② 抖动相位与描边同源于单一 `_wrongFx`，只门禁其一会让两通道相位失配。**若裁定只门禁描边 ⇒ 一行放宽**（在 `_armWrongFx` 内仅抑制描边重启、抖动态另存）。
  - **③ `reduceMotion` 分支核对（未改）**：沿用 WXG-T-088 R1甲 现有 `snap.reduceMotion ? 1 : …`，**未新增开关**。核对结论：`? 1` 满足「静态红描边、α 恒 1、**0 往复**、200ms 后由 game 侧清除」；抖动位移在 `!snap.reduceMotion` 分支 ⇒ `reduceMotion=true` 时 `dx=0`（**位移归零**）。**已达标，无需改动。**
  - **④ 单测（`tests/feedback-vfx.test.ts` 新增 describe）**：① 分段锚点 α（淡入中 **0.75** / 保持 **1** / 淡出中 **0.75** / 两端→**0**）+ 全窗 **400** 点采样**极值点计数 = 1**（旧实现为 **3** ⇒ 断言有判别力）且峰值 = 1；② `reduceMotion` 5 相位 α 恒 1 + 位移归零（`shaken.x − still.x = WRONG_SHAKE_PX`）；③ 500ms 门三况：门内连点**不重启**（相位继续推进 >0.5）、门内且 fx 已结束**不给反馈**（`wrongProgress=0` / `wrongRow=−1`）、门外**重启**（相位 <0.25）。**热路径零分配**：`wrongFlashAlpha` 无每帧分配；`_armWrongFx` 仅拒绝帧 new 一个 fx 对象（与旧实现同）。
  - **自证**：`pnpm -F @wxgame/beads test` **250 PASS**（22→25 例）；`pnpm run check:arch` **OK**（1 pre-existing WARN：编辑器产物文件存在性提示）；`framework:sync` 写入 **3**（三源文件镜像）+ `framework:sync:check` **OK**；`pnpm run verify` **PASS 14 / WARN 0 / SKIP 1（check:size 未覆盖）/ FAIL 0**。
  - **未决 / 风险**：见回传。本题**不 commit / 不 push**。后继 = **QA（严守真）先改探针 P4 预期再跑**（报告 §18.3-6 惯例）；探针 P4 属 `production/qa/**`（本单禁改）。
  - **并发注意**：`beads-game.ts` / `tests/helpers.ts` / `TASKS-DETAIL.md` 工作树内含**并发会话 WXG-T-100/BD-34** 未提交改动。本单改动落在**不同 hunk**（`_wrongFx` 区 / `_stepWrongFx` 区），二者可并存；**提交时同文件两单改动随行**（勿按文件级拆，否则拆不出干净的 T-102 笔）。
- **⑤ 主理人独立复核（2026-09-15）**：
  - **常量落盘已核**：`games/beads/src/config/tuning.ts:391` 起新增 `WRONG_FADE_IN_MS=60` / `WRONG_HOLD_MS=80` / `WRONG_FADE_OUT_MS=60` / `WRONG_FX_RESTART_GATE_MS=500`，且 `WRONG_FX_MS` 注释已同步订正（旧注「描边闪 2 次」已过时）。**不触 `systems-index §3`** ✅（符合约束）。
  - **包络实现逐段验过**（`view-model.ts:435-445`）：`ms = p·WRONG_FX_MS`；`ms ≤ 0 → 0`；`ms < 60 → t(2−t)`（ease-out 淡入，t=ms/60）；`60 ≤ ms < 140 → 1`（峰值保持）；`≥140 → 1−t²`（ease-in 淡出，t=(ms−140)/60），`t ≥ 1 → 0`。**单峰、α 极值点 = 1** ✅；纯函数、无闭包无中间集合 ⇒ **零分配** ✅；**分段常量取自 `tuning.ts`**（未把 0.3/0.7 之类归一化切点硬编码）✅ —— 这一点做对了，否则后续调 60/80/60 就要动视图层。
  - **500ms 门已核**（`beads-game.ts:265` `_wrongFxArmedAtMs`、`:1850-1851` `if (this._pulseClock - this._wrongFxArmedAtMs < WRONG_FX_RESTART_GATE_MS) return;`）✅；`reduceMotion` 分支沿用既有 `? 1`、未新增开关 ✅。
  - **门禁**：`pnpm -F @wxgame/beads test` ⇒ **250/250 全绿**（较修前 +3）；`pnpm run verify` ⇒ **PASS 14 ｜ WARN 0 ｜ SKIP 1（`check:size` 未覆盖，非本单）｜ FAIL 0**。
  - **特别肯定**：单测用**全窗 400 点采样断言极值点计数 = 1**，并把旧实现计数 **3** 一并记下作对照 ⇒ **断言有判别力**（不是「跑绿就算」）；门的三况（门内不重启 / 门内且 fx 已结束不给反馈 / 门外重启）也把边界都覆盖到了。
- **⑥ 主理人裁定（成员未决两问）**：
  - **① 门禁范围 = A（从严：门禁整个 wrong-fx 事件，抖动与描边同进同退）** —— 理由：**`systems-index §3.8` 是冻结常量真源**，其口径是「**错误反馈** 抖动+描边闪 **≤2 次/秒**」，这是一个**事件级**上限；而 `ux-spec §5:180` 的「**视觉脉冲**重启门 500ms」是实现规格的**措辞**。二者冲突时**以 §3 为准**（AGENTS §4）。若按 B 只门禁描边，100ms 连点会把**抖动**刷到 10 次/秒 ⇒ **按 §3.8 字面即违**。⇒ **A 正确，维持现状**。
  - **⚠️ 随之登记一处待对齐（非缺陷）**：`ux-spec §5:180` 的「视觉脉冲重启门」**措辞易被读成只门禁描边** ⇒ 应改为「**错误反馈（抖动+描边）重启门 500ms**」。属 ux-spec 域，与下面 ② 同批处理，**不单独开单**。
  - **② 原 Deliverable ⑤（回写 `ux-spec :203` 的「待工程侧跟进」）** = **并入下一个 ux-spec 小追加**（与上条措辞对齐、以及 T-117 的残留一并做），**不为一行单独开单**。**:203 那句现在已与实际脱节**（实现已一致），属**活跃文档漂移**，须尽快处理而非长期挂账。
- **⑦ 光敏性红线的效力边界**：本单只证 **`[N]`（Node/单测）层的 α 序列与门限**；**`[B]` 屏幕像素发光序列**与 **`[R]` 真机观感均未取证**（无 AppID / 无真机）⇒ **不得宣称「光敏性红线已达标」**，只可宣称「代码层已符合 §3.8 的时序口径」。真机首验须把「wrong 态观感」列 P0。

## WXG-T-117

- **名称**：**beads · `ux-spec §5` 告急行 α 幅度补全（BD-35）**
- **负责**：文策渊(design-strategist)　**状态**：✅ 完成（2026-09-15）　**P2**
- **背景（报告 §21.1 BD-35）**：`games/beads/design/ux/ux-spec.md` **§5** 的**倒计时告急行**（`:187`）写的是「`danger` + 1000ms **α 脉冲循环**」—— **只给了周期、没给 α 幅度**。同表其余同类行都写了幅度（如 `:189`/`:190` 教学引导行均写 **`α 0.5↔1.0`**）。该缺口由 林绘澄 在 BD-31 核对时发现。
- **影响**：此行**不可判定** ⇒ QA 探针 **P7 维持 `PASS\*`**；且**QA 与美术侧均不猜值**（报告 §21.1 明文）。补齐后 P7 该子句可转正。
- **用户裁定（2026-09-15）**：与 `WXG-T-102`（wrong 描边改码）**无依赖**，**并行另开本单**，不阻塞改码。
- **Deliverables**：
  1. 给 `ux-spec §5` **告急行补 α 幅度**（**由 UX 定值**，参照同表 hint 行的 `0.5↔1.0` 口径）。
  2. **同表同类缺口一次扫干净**：逐行核对是否还有其他「只给周期未给幅度」（或反之）的条目，一并补或显式登记。
  3. 若告急行还有其他未定值（颜色 / 图标 / 时长），一并处理或**显式登记为待定**。
  4. 按该文件惯例更新**版本号 + 变更记录**。
  5. **不触** `systems-index §3` —— α 幅度属**反馈态动效参数**，**不是 gameplay 冻结常量**（同 `WRONG_FX_MS` / `HINT_PULSE_MS` 判例：工程侧落在 `tuning.ts`，不进 §3）。
- **权威来源（冲突以 A 为准）**：**A** `games/beads/design/ux/ux-spec.md` §5 现行表格（**先摸清同行 hint 行的写法与全表惯例再落笔**）＞ **B** `production/TASKS-DETAIL.md` 的 `## WXG-T-117` / `## WXG-T-102` 小节 ＞ **C** `production/qa/beads/g4-regression-report.md` §21.1（BD-35 裁定原文）与 P7 现状 ＞ **D** `games/beads/design/gdd/systems-index.md §3.8`（**≤3Hz 红线**——新增幅度须仍在红线内，且红线本身**不得改**）。不发明 §3 未冻结数值。
- **Output Path**：`games/beads/design/ux/ux-spec.md`（**主产物**）+ `production/TASKS-DETAIL.md` 的 `## WXG-T-117` 小节（**追加**）。
  **禁改**：`systems-index §3`、`packages/**`、`games/**/src/**`、`production/qa/**`（QA 域）、`games/beads/design/gdd/input-control.md`（属 T-115，已定稿）。
- **⚠️ 体积注意**：`ux-spec.md` 现 ≈8683 tok，**已超 8000 单文件上限并在豁免中**（见台账 backlog「ux-spec 预算豁免到期条」）⇒ 本次增补须**克制**（补幅度、不重写段落、不搬动既有表格），并在回传中报告增补后的 token 估算；若预计增幅 >500 tok，**先回传请示**。
- **必读 skill**：`my-skills/wxgame-ux-spec/SKILL.md`（**必须**）；另按文策渊路由表先读 `my-skills/wxgame-gdd-writer/SKILL.md`。另读 `AGENTS.md`、`games/beads/design/ux/ux-spec.md` §5。
- **约束**：**不得发明 §3 常量**；**不得改 ≤3Hz 红线**；先问再写；不 commit/push。
- **后继（不在本单）**：条文落地后由 **QA**（严守真）把探针 **P7** 的该子句从 `PASS\*` 转正 —— 需主理人另派。
- **完成记录（2026-09-15）**：
  1. **告急行补 α 幅度**：`ux-spec §5:187`「倒计时告急」视觉列由「danger + 1000ms α 脉冲循环」补为「`danger` + 1000ms **α 0.6↔1.0** 脉冲循环」（附「恰 **1.0Hz** 往复，§3.8 ≤3Hz 内」）；并同格补两项未定值——**③ 图标**（时钟图标同步切 `danger`，坐实 §3.8「图标+颜色+脉冲」三通道）、**④ reduceMotion**（开 ⇒ 静态 `danger`，α=1，脉冲停）。**定值理由**：取**已落地实现同值**（`src/config/tuning.ts` `DANGER_PULSE_MS` 注释「1→0.6→1」/ `src/view/view-model.ts::dangerAlpha` = `breathe(clock,1000,0.6,1)`）⇒ **无实现落差**；0.6 地板略高于同表 hint 行的 0.5，系「持续 1Hz 警告应比短时引导更克制」之设计取舍（hint 的 0.5 保留不动）。
  2. **同表同类缺口扫净**：逐行核 `ux-spec §5` 全表（「只给周期未给幅度」/「有幅度无周期」双轴）⇒ 除告急行外另查出 **2 行**同类缺并就地补齐：`§5:188` 满槽告警 **0.6↔1.0**@500ms、`§5:190` 目标格 `hint` **0.5↔1.0**@600ms（与 `§5:189` 首珠脉冲同族）。其余行无同类缺——`§5:189` 原已给值；`§5:180` 放错拒绝 = 单次 `α 0→1→0` 淡入淡出 = 1 峰 0 往复（不属「往复」类）；「有幅度无周期」类**零命中**。
  3. **版本/变更记录**：`ux-spec` 文首版本 **v1.2 → v1.3**、任务号尾追加「§5 α 幅度补全：WXG-T-117，BD-35」；并在 §5 表下（BD-29 注后）追加「α 幅度补全」注一段（该文件无独立变更记录节，沿其「文首版本行」惯例）。
  4. **不触 §3**：α 幅度属**反馈态动效参数**，落 `tuning.ts`（`DANGER_PULSE_MS`/`TRAY_FULL_PULSE_MS`/`HINT_PULSE_MS`），**不进 `systems-index §3`**（同 `WRONG_FX_MS`/`HINT_PULSE_MS` 判例）；§3.8 **≤3Hz 红线未改**（告急 1.0Hz、满槽 2.0Hz 均在内）。
  5. **体积**：`ux-spec.md` **30781 → 31868 B**（**+1087 B ≈ +307 tok**，<500 阈值，未越「先请示」线）；版式与既有表格结构未动。
  6. **禁改项未碰**：未改 `systems-index §3`、`input-control.md`、`packages/**`、`games/**/src/**`、`production/qa/**`；未 commit/push（T-098 首次把本行 BD-35 判据留给 UX，本节即其闭合）。
- **主理人独立复核（2026-09-15）**：
  - **告急行已落盘**：`ux-spec.md:187` = 「`danger` + 1000ms **α 0.6↔1.0** 脉冲循环（恰 **1.0Hz** 往复，§3.8 ≤3Hz 内）+ **时钟图标同步切 danger**（§3.8「图标+颜色+脉冲」三通道）；`reduceMotion` 开 ⇒ 静态 danger（α=1，脉冲停）」✅ —— 幅度、周期、图标、`reduceMotion` 四项齐备（比只补一个幅度更完整）。
  - **同表扫描已核**：另查出并就地补齐 **2 行**同类缺 —— `:188` 满槽告警 → `α 0.6↔1.0`@500ms（2.0Hz）、`:190` 目标格 `hint` → `α 0.5↔1.0`@600ms；`:189` 首珠脉冲原本已有值。`:205` 新增注记说明本轮补齐 3 行与定值理由 ✅。**双轴扫描（只给周期未给幅度 / 有幅度无周期）已覆盖**。
  - **体积已核**：`wc -c` = **31868 B**，与成员报的 `30781 → 31868`（+1087 B ≈ +307 tok）**一致**，未越 500 tok 请示线 ✅。
  - **特别肯定一处定值策略**：告急 α **取已落地实现的同值（0.6↔1.0）**，而非任务书字面提示的 hint 口径（0.5↔1.0）。这一选择是对的 —— 本行原本**只缺文档**、实现早已按 0.6 跑，取同值 ⇒ **零实现落差、P7 可无代价转正**；若取 0.5，反而要开一张改码单去改 `tuning.ts`，把「补文档」变成「先改文档再改码」的无谓往返。成员在回传中把两条路的代价都写清了，没有静默选择。
- **主理人裁定（成员未决三问）**：**① α 地板 = 维持 `0.6↔1.0`** —— 采纳其三条理由（零落差 / 持续 1Hz 警告比短时引导更克制 / 红线内），且 `DANGER_PULSE_MS` 与 `trayFullAlpha` 已是同值，自洽。**② 版本号 = 维持 v1.3** —— 本次是**实质规格补全**（补一个此前缺失的判据数值 + 3 行同类缺），与 T-093/097/098 那些「只追加任务号尾」的记录性改动不同性质，值得抬号；抬高成本为零（无外部按版本号硬引用）。**③ 满槽告警的 `reduceMotion` 静态化半句 = 保留** —— 与 `trayFullAlpha` 实现一致，同属 accessibility D1「减弱动效保留通道」口径，非扩范围。
- **⚠️ 登记残留（与 T-102 ⑥ 同批，不单开单）**：`ux-spec.md` 有**两处活跃漂移**待处理 —— ① `:203` 的「**待工程侧跟进**」：T-102 已完成改码 ⇒ 该句与实际脱节，应改为「已一致」；② `:180` 的「**视觉脉冲**重启门」措辞：T-102 裁定按 §3.8 从严**门禁整个错误反馈（抖动+描边）** ⇒ 措辞应改为「错误反馈重启门」，否则后人会再读成「只门禁描边」。两处同文件、同性质 ⇒ **合并为一次 ux-spec 小追加**（文策渊）。

## WXG-T-118

- **名称**：**QA 复跑 P4 + P7（T-102 改码验证 + T-117 判据补齐后转正）**
- **负责**：严守真(qa)　**状态**：✅ 完成（2026-09-15；P4 **FAIL→PASS\***、P7 **PASS\*→PASS**；只重跑 P4/P7，未改 P4 预期、未放宽阈值）　**P2**
- **背景**：上游两单已闭合 —— **WXG-T-102**（BD-29 改码：wrong 描边单次脉冲 + 500ms 门，`α 极值点=1`、250 例全绿）、**WXG-T-117**（BD-35 文档：`ux-spec §5:187` 告急行补 `α 0.6↔1.0`@1000ms + 图标通道 + `reduceMotion`）。本单是**其下游取证**，按报告 §18.3-6 惯例「**先改探针、后改报告**」。
- **❗ 范围铁声明**：本轮**只重跑 P4 段 + P7 段**。其余段（P1–P3、P5–P6、P8–P26 等）**不重跑**，判定与预期值沿用现行轮次，**不得合并计数解读**（同 v1.2/v1.3/v1.4/v1.5/v1.6 的范围铁声明体例）。
- **阶段 0 诊断（主理人已核，直接采用）**：
  - **① P4 的预期值「无需再改」—— 这一点必须核准，否则会白改一轮甚至改错**：`g4-probe-v1.1.mjs` 的 **修订 38③（WXG-T-098 轮）** 已把这条例的预期值改成**现文新口径**并「先改后跑」。现行断言面（`:749` 标题即 `P4 (v1.3 改判) / BD-04 · BD-29 转态 · 拒绝反馈「单次脉冲 + 500ms 重启门」`，`:744-748`）：
    ```js
    const pulseStructOk = pk.peaks <= 1;                              // 一个 fx 窗口内 α 极值点 ≤1
    const gateStructOk  = minGapMs === null || minGapMs >= 500 - 1e-9; // 连续拒绝重启门 500ms
    const wrongOk = rejected === 1 && ... && shakeDir === 2 && pk.peaks >= 1;
    const v = wrongOk && pulseStructOk && gateStructOk && residual.length === 0 ? 'PASS'
            : (wrongOk && pulseStructOk && gateStructOk) ? 'PASS*' : 'FAIL';
    ```
    ⇒ 本轮**只重跑**，**不改 P4 预期**。预期结论：`v` 由 **FAIL → `PASS*`**（BD-29 三条件过，但 `residual` 大概率非空）。
  - **② P4 是复合条 ⇒ 两半边必须分列，别让 `PASS*` 把 BD-04 的残留盖掉**：`residual`（`:740-743`）承载 **BD-04 其余三行**（`vfx_fill_pop` / `vfx_clear_dissolve` / `vfx_complete_wave`，沿用 v1.1 读数、本单未复核该半边预期值）。**BD-29 半边本轮闭合；BD-04 半边维持「降级不关闭」** —— 报告须分列写明，并如实报 `residual` 的实测项（若恰为空则整条记 `PASS`，同样照实）。
  - **③ P7 必须改预期（收紧方向）** —— 探针自己钉着上限（`:1785-1788` 注释原文）：
    > 【BD-35 钉住上限】`ux-spec §5` 告急行**未定义 α 幅度**（报告 §BD-35：「QA 与美术侧均不自造常量」）⇒ 「脉冲到不到 1.0」无判据可验。因此即使可判定子句全过（含本轮新落地的满槽呼吸），本条**仍是 PASS\* 而非 PASS**；升 PASS 的前置 = BD-35 由 UX 侧在 §5 告急行补 α 数值。
    **该前置已由 WXG-T-117 满足** ⇒ 本轮须：**(a)** 新增**告急 α 幅度断言**（须覆盖 `[0.6, 1.0]`，真源 `ux-spec §5:187` + `tuning.ts:DANGER_PULSE_MS`「1→0.6→1」）；**(b)** 顺带为 **④ 满槽半边**加幅度断言（`:188` 现文亦已补 `α 0.6↔1.0`@500ms；此前该腿**只验周期未验幅度**）；**(c)** 删去「BD-35 钉住上限」注释与该 `v` 的强制 `PASS*` 分支 ⇒ 满足则记 **PASS**。
    **⚠️ 容差口径由 QA 定并写明理由**：130 帧采样 @60fps、告急周期 1000ms ⇒ 一个周期仅 60 帧，**端点未必采满**。容差须给出依据，**不得为凑绿放宽**（这是本单最容易被自己糊弄过去的一处，请把容差推导写进证据）。
  - **④ 顺带核查（不扩大范围）**：`:190` 目标格 `hint` 行现文亦补了 `α 0.5↔1.0`@600ms ⇒ 看一眼 **P19 / P3** 的 hint 相关断言是否因此可加／受影响（若 hint 态仍未实装则**不受影响，照实记**，不得借机改判）。
- **硬要求**：
  1. **先改探针、后改报告**（§18.3-6）—— 顺序不可倒置，不得留「先看输出再回填预期」的窗口。
  2. 探针头注**续号 = 修订 42**（现到 41），并写清「哪些是预期值改动（P7）、哪些只是重跑（P4）」。
  3. 证据落 `production/qa/beads/evidence/`（新日志），含 §0 范围声明 / 探针 stdout / 命令与计数 / P4·P7 逐条判定索引 / 未执行・⛔ 清单 / 汇总核对。
  4. **不得**把 ⛔ 写成 PASS；**不得**因数字好看而放宽阈值；**不得**为凑绿删旧断言而不登记改判。
  5. **效力边界（必须写进报告）**：本轮 P4 取证在**指令流层**（`RenderModel` 指令 α 序列），T-102 的单测在 **`[N]` 层**，二者**互补但不可互相替代**；**`[B]` 屏幕像素发光序列**与 **`[R]` 真机观感**（光敏性观感）**仍未取证** ⇒ 光敏性红线**不得据本轮宣称达标**。
- **权威来源（冲突以 A 为准）**：**A** `production/qa/beads/g4-probe-v1.1.mjs` 现行 P4/P7 段与头注修订体例 ＞ **B** `games/beads/design/ux/ux-spec.md` **§5:187/188/190/203**（T-117 回写后的现文）+ **§5:174**（闪烁口径正本「同一区域内 α 往复」）＞ **C** `games/beads/design/gdd/systems-index.md §3.8`（**≤2 次/秒 / ≤3Hz 红线**，只读）+ `timer-gameover §8-10` ＞ **D** 报告 `g4-regression-report.md` §18.3-6（惯例）、BD-29/BD-35 段、P4/P7 历史判定 ＞ **E** `production/TASKS-DETAIL.md` 的 `## WXG-T-102` / `## WXG-T-117` / `## WXG-T-118`。
- **Output Path**：`production/qa/beads/g4-probe-v1.1.mjs`、`production/qa/beads/g4-regression-report.md`、`production/qa/beads/evidence/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-118` 小节（**追加**）。
  **禁改**：`games/**`（含 `src/**` 与 `design/**`）、`packages/**`、`systems-index §3`、其他成员的台账小节。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`；另读 `AGENTS.md`、`production/qa/beads/g4-probe-v1.1.mjs`（头注修订体例 + P4/P7 段）、`games/beads/design/ux/ux-spec.md` §5。
- **约束**：只跑 P4/P7、不合并计数、不放宽阈值、不把 ⛔ 写绿；先问再写；不 commit/push。
- **后继（不在本单）**：若 P4/P7 均如预期转正，可另派一单做**本轮口径的收口**（是否具备把 G4 的 CONCERNS 升级、或仍需等 `[C]`/`[R]` 道次）。
- **完成记录（2026-09-15 · 严守真）**：
  1. **结果：P4 `FAIL → PASS*`；P7 `PASS* → PASS`**（两条**全如预期**转正，无意外卡点）。只重跑 P4+P7 两条 ⇒
     **范围铁声明成立**；与 T-116 轮 log 机验比对：**判定串 diff 仅 2 行**（P4/P7）、其余 **64 组逐字未变**，
     全文 diff 仅 16 行且全落在 P4/P7 小节内。
  2. **P4 实测**：`pk.peaks = 1`（判据 ≤1 ✓）、连续 9 次误点只起 2 次脉冲、`minGapMs = 500 ms`（判据 ≥500 ✓）、
     位移 max 2.6px ≤±3px、换号 2 ✓ ⇒ **BD-29 半边闭合**；`residual` 实测 **2 项**
     （`vfx_clear_dissolve` / `vfx_complete_wave`；`FILL_POP` 因签名去重=2>1 **未入 residual**）
     ⇒ 整条按既定判据记 **`PASS*`**、**BD-04 维持「降级不关闭」**（**两半边分列**，不得互相稀释）。
  3. **P4 预期值未改（核准）**：现行断言面即修订 38③ 的 T-098 现文口径（`pk.peaks<=1` / `minGapMs>=500-1e-9`），
     本轮**只重跑**；唯一文字订正是把**随 T-102 失效的旧代码锚点**（`view-model.ts:521` / `beads-game.ts:1524`）
     换成现锚点（`view-model.ts:435-445 wrongFlashAlpha` / `beads-game.ts:1850-1854 _armWrongFx`），
     并把 v1.3 轮对「α 下限≠0」的旧归因改述为**采样相位**（判定逻辑零改动，否则证据正文与实测自相矛盾）。
  4. **P7 实测（预期值收紧，唯一一处改动）**：删旧「BD-35 钉住上限」注释与强制 `PASS*` 分支；
     新增**告急 α 端点覆盖断言**（真实测 **min=0.600000 / max=1.000000**、偏差 0/0，tol **0.006667**）+
     **满槽半边端点覆盖断言**（同为 0.6/1.0、tol **0.013333**）；周期 1000ms（1.00Hz）/ 500ms；
     ⑤ 分区读法沿用（托盘 2.00Hz / HUD 1.00Hz，跨区合成 3.00/s 照实披露不判 FAIL）⇒ **P7 转 PASS**。
  5. **容差推导（QA 侧定，禁止为凑绿放宽）**：三角波半周期单调 ⇒ 幅度斜率 =(hi−lo)·2/T；采样步长
     Δt = 1/60 s ⇒ 最大相位偏差 Δt/2 ⇒ **tol =(hi−lo)·Δt/T**（与相位起点无关的**严格上界**）；
     判据 `abs(min−lo) ≤ tol` **且** `abs(max−hi) ≤ tol`（**两侧都断** ⇒ 欠幅/超幅均 FAIL）。
     结构旁证（不替代上界）：1000ms = 恰 60 帧、500ms = 恰 30 帧，采样窗 130/120 帧均 ≥1 整周期。
  6. **命令与计数**：`pnpm run harness:build` **EXIT=0** → `node production/qa/beads/g4-probe-v1.1.mjs` **EXIT=0**；
     全量 66 组 **PASS 39 ｜ PASS\* 17 ｜ FAIL 1 ｜ ⛔ 9**；**T-118 修订面（2 条）= PASS 1 ｜ PASS\* 1 ｜ FAIL 0 ｜ ⛔ 0**；
     唯一 FAIL = **P17**（既有欠账，非本单产生）。汇总段新增 **T-118 分桶**（P4 移出 T-098 桶、P7 移出 T-097 桶
     ⇒ 两桶条数 4→3，**非判定变化**）；七段计数**不得合并解读**（桶条数相加 94 > 66 系故意重叠口径）。
  7. **顺序自证（mtime 链，四步严格递增）**：上游现文 `ux-spec.md` 23:17:32 / `view-model.ts` 23:17:28 /
     `beads-game.ts` 23:17:37（**均非本 agent 改动**）→ 探针 **23:26:59**（改完 + `node --check` 通过）→
     `harness:build` dist **23:27:06** → 首跑结束 **15:27:09.563Z**、重跑结束 **15:27:31.176Z** → 报告 §24。
     两次运行**逐字节一致**（仅时间戳行不同）⇒ 确定性自证成立。
  8. **只读边界**：只写 `production/qa/beads/**`（探针 / 报告 §24 / 证据 2 份）与本小节；**未改** `games/**`
     （含 `src/**` 与 `design/**`）、`packages/**`、`systems-index §3`；未 commit / push；未跑 `pnpm run verify`
     （G1–G3 未复核，口径同前几轮，不得据本单改判）。
  9. **⛔ 未执行（原样在册）**：`pnpm run verify`（G1–G3）、`[B]` 像素层、`[C]` Cocos 产物、`[R]` 真机（无 AppID/无真机）、
     `[P]` Playtest；`A05-09` 本体仍 ⛔（**WXG-T-103 残留**：判据主体已更正为 `sfx_combo_t2`，探针/台账未同步）。
     **不得据本轮宣称「光敏性红线已达标」**，只能宣称「指令流层已符合 §3.8 时序口径」。
  10. **建议（裁决权归主理人）**：BD-29 **建议关闭**（限指令流层）、BD-35 **建议关闭**、
      **BD-04 维持「降级不关闭」**；**G4 维持 `CONCERNS`**（§21.3 第 ① 条具备解除条件，②③ 仍成立）。
      新增观察（不占 BD 号）：P4 证据串「折算峰频 ≈ 5.0 Hz」是窗口折算量、**非有效频率**（有效 = 2 次/秒），建议下轮改名。
  11. **产物**：`production/qa/beads/g4-probe-v1.1.mjs`（修订 43）、`production/qa/beads/g4-regression-report.md` §24、
      `production/qa/beads/evidence/g4-probe-v1.1-t118.log`（正式轮：§0–§6）、
      `evidence/g4-probe-v1.1-t118-rerun.log`（确定性自证）。
  12. **后继（本单已收尾；建议下一动作）**：① 由主理人裁 **BD-29 / BD-35 关单**（**BD-04 不关**）；
      ② `production/TASKS.md` 主表状态更新由主理人执行（**本单 Output Path 不含该文件**）；
      ③ 升级路径：`[B]` 浏览器逐帧取证（覆盖 P4 屏幕发光序列 + A05 时长族）→ AppID 到位后实测包体 → 同步 `A05-09` 清 T-103 残留。
- **主理人独立复核（2026-09-15，事后非采信自述）**：
  - **P7 判定面已核**（`:1857`）：`const v = okPulse && okFull && okAmpUrgent && okAmpFull ? 'PASS' : 'FAIL';` —— **无强制 `PASS*` 残留** ✅；标题改 `P7 (v1.7 改判) / BD-10 · BD-35 闭合`，正文注释明写「旧『BD-35 未定义幅度 ⇒ 强制 PASS\*』已删」。
  - **容差实现已核**（`:1847-1848`）：`const tolUrgent = ampTol(0.6, 1.0, T.DANGER_PULSE_MS);` / `ampTol(0.6, 1.0, T.TRAY_FULL_PULSE_MS)` —— **由 §5 现文值与 `tuning` 周期算出，未硬编码** ✅。推导 `tol = (hi−lo)·Δt/T`（`:265-271`）是**与相位起点无关的严格上界**，且**两侧都断**（欠幅与超幅均 FAIL）✅ —— 这个推导是硬功夫，不是「拍个余量」。
  - **分桶已核**（`:2912-2914`、`:2922`）：`inT118` 含 P4/P7；**T-098 桶已剔除 P4、T-097 桶已剔除 P7** ⇒ **无重复计数** ✅（分桶迁移容易漏，这里做对了）。
  - **报告结构已核**：§24（`:1328-1493`）含 24.3 P4 **两半边分列**、24.4 P7、24.5 顺带核查、24.6 效力边界、24.7 探针自身改动自查、24.8 ⛔、24.9 建议裁定 ✅。
  - **门禁**：beads 单测全绿；`pnpm run verify` = **PASS 14 ｜ WARN 0 ｜ SKIP 1 ｜ FAIL 0** ✅。
  - **❗ 发起方（主理人）错误登记**：本单工单写「探针现到修订 41 ⇒ 续号 **42**」，但工作树 `:222` 的 **42 已由 WXG-T-116 占用** ⇒ 我的前提**读错了**（只读了头注末条，未 grep 实际占用）。成员**未照单硬塞重号**，改用 **43**（`:243`）且确未重号 ⇒ **处理正确，不追认偏离**。**教训入册：工单里的「现到第 N 条」类前提，必须用 `grep` 核实实际占用，不能只读头注末条。**
  - **两处值得记录的正面之处**：① **P4 证据正文的订正属必要且未触判定** —— 旧锚点（`view-model.ts:521` / `beads-game.ts:1524`）随 T-102 失效，若不订正，正文会与实测（峰点数=1、门=500ms）**自相矛盾**，后人会读成「探针自证假绿」；成员**主动**处理并明确声明「判定逻辑零改动」，分寸对。② **主动纠正发起方错误**（42→43），没有照单执行 —— 这正是「先核再写」要的行为。
- **主理人裁定（成员四项未决）**：
  1. **BD 关单 = ①**：**BD-29 关闭**（**限指令流层**，效力边界须随关单声明一并保留）、**BD-35 关闭**、**BD-04 维持「降级不关闭」**（`residual` 实测 2 项：`vfx_clear_dissolve(200ms)` + `vfx_complete_wave(逐列20ms/800ms)`）。**明确不采纳 ③**（连 BD-04 一并关）—— 残留实测非空，关掉即假绿。
  2. **P4「折算峰频 ≈5.0 Hz」字段 = ① 下一轮改名/删除**（**本单不改**）。理由：该值是窗口**折算量**（峰点数×1000/`WRONG_FX_MS`），**不是有效闪烁频率**；有效频率来自 500ms 门 = **2 次/秒**，那才是 §3.8 红线的口径。字段名带「Hz」会让后人误读成「有效频率 5Hz ⇒ 超红线」。登记为**下一轮探针小改**（与 `A05-09` 同批）——本单不改是为避免打断已落定的 mtime 顺序自证。
  3. **`A05-09` 探针/台账同步 = ① 并入下一轮 QA**（与 `[B]` 道次同批）。
  4. **主表状态由主理人更新** ⇒ 本回复已完成（`TASKS.md` 行已回填）。
- **关单后果（必须写进各自的缺陷记录，不得只改状态）**：BD-29 与 BD-35 的关闭均**仅覆盖指令流层的可判定结论**；**`[B]` 屏幕像素发光序列**与 **`[R]` 真机观感**仍**零证据** ⇒ 光敏性安全**不得据本轮声称达标**。真机首验须把「wrong 态观感 + 告急脉冲观感」列 P0。

## WXG-T-119

- **名称**：**beads · `[B]` 浏览器逐帧取证（P4 屏幕发光序列 + A05 时长/包络族）**
- **负责**：严守真(qa)　**状态**：📋 已立项（待施工）　**P1**
- **背景**：WXG-T-102 / T-117 / T-118 三条改判共同的**天花板**就是 `[B]` 道次。T-118 后 P4 在**指令流层**转 `PASS*`、P7 转 `PASS`，但**屏幕像素层**与**真实合成音频层**仍是零证据（T-118 报告 §24.6 已把这条边界写死）。本单即补这一层。
- **道次口径（先钉死，勿混用）**：`production/qa/beads/test-cases.md:10` 图例 —— `[N]` 无头浏览器**逻辑层** / **`[B]` 浏览器真实渲染·像素级**（≈ `[Cocos]` 已解锁像素道次）/ `[R]` 真机·微信宿主 / `[P]` 人（听感·Playtest）。**T-118 是 `[N]`（指令流），本单要 `[B]`（真实渲染像素 / 真实合成音频）**，两者结论不得互相顶替。
- **成熟范式先例（强烈建议照做，不要另发明骨架）**：`production/qa/beads/cocos-input-probe.mjs`（**WXG-T-108**，同作者）已经是本仓一枚跑通的 `[B]` 探针，具备本单需要的一整套纪律，其文件头明确写了本仓吃过「判别力为零的探针」的亏：
  1. **预期值先写后跑**（判据的算术推论**先落盘**，不是看输出回填）—— 反假绿；
  2. **判据自检 `SELF-xx`**：把**修复前**的实测数字喂给同一批判定函数，断言它们**必须判 FAIL** ⇒ 用反例证明探针**有判别力**；
  3. **退出码契约**：`0` = 可执行全 PASS ｜ `1` = 存在 FAIL（真回归）｜ `2` = 无 FAIL 但**有未预期阻塞 / 探针无效**（**不得当绿**）｜ `3` = 脚本级环境错误；
  4. **道次诚实**：`⛔` 显式登记「阻塞 + 解除条件」，**不记 PASS 也不记 FAIL**；
  5. **新鲜度自查**：入口/产物须为当前代码所构建，并自查镜像一致性。
- **Deliverables**：
  1. **新建 `[B]` 探针**（落 `production/qa/beads/`，命名自定，如 `beads-browser-probe.mjs`），对齐上条骨架；**自带断言 + 退出码**，可复跑。
  2. **P4 屏幕发光序列**（覆盖 T-118 未覆盖的那一层）：真渲染后**逐帧**取屏幕像素/画布，量
     - wrong 描边在**屏幕上的发光强度时间序** ⇒ **α 极值点 ≤1**（单次脉冲，非往复）；
     - 连续拒绝时 **500ms 起播间隔在屏幕层成立**（⇒ 有效闪烁 ≤2 次/秒）。
     判据正本：`ux-spec §5:180` + `systems-index §3.8`（冻结值）。
  3. **A05 时长 / 包络族**（T-118 报告里那批 `⛔` 条目）：在**真 WebAudio** 上取**真实合成输出**量时长与包络。**哪些条可测、哪些仍 ⛔ 由你逐条判定并写清原因**；**听感（A05-26）留 `[P]` ⛔**，不得代判。
  4. 报告**追加一节**（v1.8），结构对齐既有体例（含**效力边界**与 ⛔ 清单 + 解除条件）。
  5. **顺带夹带（T-118 主理人裁定的两项小额项，同批做掉）**：
     - **`A05-09` 探针/台账同步**（清 **T-103 残留**：主体已改 `sfx_combo_t3 → sfx_combo_t2`，探针/台账未同步）；
     - **P4「折算峰频 ≈5.0 Hz」字段改名/删除** —— 该值是窗口**折算量**（峰点数×1000/`WRONG_FX_MS`），**不是有效闪烁频率**（有效频率 = 500ms 门 ⇒ **2 次/秒**）；字段名带「Hz」会让后人误读成「有效 5Hz ⇒ 超红线」。
- **⚠️ 阶段 0 必须先判清的障碍（先回传，别硬上）**：
  1. **substrate 选哪条？** `[B]` 可用 (a) **Cocos web-mobile 产物**（真机同源渲染路径，`pnpm --filter @wxgame/beads run build:cocos:web` 无需 AppID，产物已存在）或 (b) **harness 页面**（`dev/harness`，Canvas2D 渲染器，**渲染器与真机不同源**）。**优先 (a)**；若因故改选 (b)，须在报告里**披露渲染器不同源**这一限制。**选哪条、理由是什么，写进报告。**
  2. **真出声通路在哪条 substrate 上成立？** 已核事实：beads **确实**把 `BEADS_AUDIO_VOICES` 交给 App ⇒ `Platform.createAudioBackend({ voices })`（`games/beads/src/game/beads-game.ts:82/199-200/1678-1681`），而 `packages/framework/src/platform/web.ts` 在**有 `AudioContext` 且有 `voices`** 时返回 `SynthAudioBackend`（否则诚实退 `NullAudioBackend`）⇒ **浏览器侧真出声通路存在**。但**该通路在 Cocos 产物上是否同样接上，须现场核实**（`BeadsBootstrap.ts` 侧）。
  3. **无头 Chrome 的 WebAudio 时序**：无头环境可能无音频设备 ⇒ `AudioContext.currentTime` 未必推进。**`OfflineAudioContext` 可离线渲染真实 PCM、不依赖设备**（这是一条提示，不是指定方案）；若采用，须说明「离线渲染的真实性边界」（它证的是**合成器输出**，不是**声卡输出**）。**方法由你定，但须写明其效力边界。**
  4. **`tools/scripts/**` 不可用**：`render-harness-frame.mjs` / `render-harness-clip.mjs` 是 **breakout 硬编码**（`game.movePaddleTo(...)`）⇒ **不支持 beads**（= §18.2 **B8**，BD-19/BD-13 残留，属**工程域**）⇒ **本单不得指望它，也不要改它**；走自建探针。
- **硬要求**：
  1. **预期值先写、后跑**（顺序不可倒置），新探针头注写清判据来源与「先写后跑」自证。
  2. **判据自检必做**：用**修复前**的读数（P4：`pk.peaks=2` / 无 500ms 门；A05：声明值 vs 实测包络的差异）喂同一批判定函数，**断言必判 FAIL**。
  3. **不得**把 ⛔ 写成 PASS；**不得**把 `[P]`（听感）代判；**不得**为好看放宽阈值。
  4. **效力边界（必须写进报告）**：本轮即使全绿，也只到 **屏幕像素层 + 合成器输出层**；**真机硬件/观感（`[R]`）与人耳听感（`[P]`）仍零证据** ⇒ 光敏性安全可据本轮从「指令流层」升到「**屏幕像素层**」，但**仍不得宣称「真机不闪 / 同屏不刺眼 / 听感达标」**（屏幕像素 ≠ 人眼感知：还差屏幕亮度、环境光、硬件差异）。
  5. 证据落 `production/qa/beads/evidence/`（含新探针 stdout 全文 + 确定性重跑自证 + 截图/像素取样物）。
- **权威来源（冲突以 A 为准）**：**A** `production/qa/beads/cocos-input-probe.mjs` 文件头（**范式与纪律**）+ `test-cases.md:10`（**道次图例**）＞ **B** `ux-spec §5:180/187/188` + `systems-index §3.8`（P4/P7 判据与冻结红线）+ `audio-events §4`（A05 各条时长/包络判据）＞ **C** `g4-regression-report.md` §18.2（B1/B5/B8 阻塞项）、§24.6（T-118 效力边界）、§19.3（A05 ⛔ 清单）、§21.3 ＞ **D** `production/TASKS-DETAIL.md` 的 `## WXG-T-118`（裁定 ① 关单口径 / 裁定 ② 峰频字段）与 `## WXG-T-102`。
- **Output Path**：`production/qa/beads/beads-browser-probe.mjs`（新建，名可自定）、`production/qa/beads/g4-probe-v1.1.mjs`（**仅** P4 峰频字段改名 + A05-09 同步；其余不动）、`production/qa/beads/g4-regression-report.md`、`production/qa/beads/evidence/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-119` 小节（**追加**）。
  **禁改**：`games/**`、`packages/**`、`tools/scripts/**`、`systems-index §3`、`ux-spec.md`、其他成员的台账小节。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`；另读 `AGENTS.md`、`production/qa/beads/cocos-input-probe.mjs`（**头注全文**）、`production/qa/beads/test-cases.md` §I 节首（道次等价关系）。
- **约束**：不代判 `[P]`/`[R]`、不把 ⛔ 写绿、不放宽阈值、不动工程域文件；先问再写；不 commit/push。
- **后继（不在本单）**：① `[R]` 真机首验（需 AppID + 真机，P0 检查项含 wrong/告急观感）；② §18.2 **B8**（`preview:frames` 支持 beads）属**工程域**，需另立工程单；③ 若本轮 `[B]` 全绿，G4 的 CONCERNS 是否可升，另派收口单裁。
- **完成记录（首轮 · 2026-09-15 · 严守真）—— 状态：🔄 部分完成（`[B]` 通路已建立；A05 段未执行）**：
  - **产物**：① 新建 `production/qa/beads/beads-browser-probe.mjs`（1148 行、`node --check` 通过；含判据来源 / 道次 / **预期值先写后跑** / 退出码契约 / `SELF-01`·`SELF-02` 判据自检）；② 报告**追加 §25**（v1.8）；③ 证据 `evidence/beads-browser-probe.log`（10541 B）+ `evidence/beads-browser-p4-screen.json`（逐帧像素取样物）+ `beads-p4screen-{base,peak}.png`（目视留证，不作判据）。
  - **substrate 选型（§7.1 要求写明）**：**(a) Cocos web-mobile 产物**（真机同源渲染路径）；**未**选 (b) harness（Canvas2D 渲染器，**与真机不同源**）。**未重跑** `build:cocos:web`（产物 mtime 15:36:43Z 晚于源最新 15:18:12Z；`framework:sync:check` exit=0）。
  - **结果**：`PASS 6 ｜ PASS* 0 ｜ FAIL 5 ｜ ⛔ 4`，脚本退出码 **1**（**建议按契约记 `2`**，见下「D0」）。
  - **❗ 5 个 FAIL 逐条定性（本单最高价值一问答毕）**：
    1. **ENV-04 = 探针缺陷**（交叉验证方法不成立）：`readPixels` ↔ 同帧 `toDataURL()` 平均 `|Δ| = 36.382`（判据 ≤2）、最大 235 ⇒ 两条取数路径本非同物，**不能**反推「钩内读回非真实帧」。
    2. **ENV-03 = 派生 FAIL**（判定式 = `env04ok===false`）⇒ 随 ENV-04 不可采信；但其「钩外读回不可依赖」的**前提订正有效并保留**（原写「钩外恒 0」，实测全画布求和 **453900000** 否证之）。
    3. **CLK-01 = 真实偏差，落在宿主集成层** ⇒ 登记 **BD-40**：墙钟 2.510s 内仿真推进 5.017s、固定步 301 / 渲染帧 150 ⇒ **仿真/墙钟 = 1.999（双驱动）**；真机有同源风险（`WeappPlatform.requestFrame` 同样优先 `requestAnimationFrame`）。
    4. **P4S-01 = 探针缺陷（测度不纯 + 显著度算法）**：见下条「2 个像素极值」。
    5. **P4S-03 = 读数真实、成因 = CLK-01**：墙钟最小起点间距 299ms ⇒ 3.35 次/秒 > 2；但实现自身 game 时基口径 **P4S-02 ✅（600ms ≥ 500ms）**。
  - **❗「2 个像素极值」定性（主理人点名的一问）= 测度不纯，非屏幕层真 2 峰**：① **`m` 不是 α 的纯函数** —— f7/f8 的 α **完全相同（都 =1.000，保持段）**，`m` 却由 **27372 掉到 22268（−19%）**；而 `dx=0` 的两帧（f6/f9）α 相同且 `m` **逐位相同（24995）** ⇒ `m` 与**位移通道**强相关。② **机制**：box 半宽 43 device px、格间距 52 设计 px ⇒ box **跨骑相邻格**，而抖动 ±3 设计 px **超过 2 设计 px 格间隙** ⇒ 位移改变遮挡关系（行主序绘制 ⇒ 右移被邻格盖更多）⇒ `m` 对位移**符号不对称**（+2.6px ⇒ 22268 ＜ 0 ⇒ 24995 ＜ −2.6px ⇒ 27372）。而 `ux-spec §5:180` 明文把 ±3px 抖动定为**位移、不在闪烁通道内**。③ **另有独立算法缺陷**：显著度取 `min(左基,右基)`，标准地形显著度应取 **`max`** ⇒ 以正确口径复算次峰显著度 = **2727 < 门槛 5474** ⇒ **峰点数 = 1**（与 T-118 §24.3 的 `pk.peaks=1` 一致）。⇒ **不得**据此判「屏幕层真 2 峰」（不开新 BD 号、不改实现），**也不得**改判 PASS（该测度不可用）。
  - **A05 段：未执行（如实登记）** —— `RUN_AUDIO` 在页面侧跑完且**无页面错误**，但 `pg.evaluate()` **返回 `undefined`**（log 第 62 行 `[DBG] audio typeof=undefined`）⇒ `if (audio)` 不成立而 `record('AUD-00'…)` 写在该分支内部 ⇒ **静默跳过整段 A05**（`wxgame-qa-gates` 明文禁止静默跳过）⇒ 登记探针缺陷 **D4**。`AUD-00`（§7.2 现场核实）亦未完成。**⛔ 不记 PASS 也不记 FAIL**；报告 §25.6 已逐条给出「可测 / 仍 ⛔」判定与解除条件。`A05-26` 听感留 `[P]` ⛔ **不代判**。
  - **顺带两项（T-118 裁定）**：`A05-09` 探针同步与 `g4-probe-v1.1.mjs:802` 的「折算峰频 ≈5.0 Hz」字段**上轮均未落**（已 `grep` 核实）⇒ 本轮处理，改动面见报告 §25.7。
  - **判据自检判别力**：`SELF-01` **PASS**（喂「修复前形态」反例：200ms 内 2 峰 → 峰数判定 `FAIL(对)`；无门、起点间隔 100 game ms → 门限判定 `FAIL(对)`）；`SELF-02` **PASS**（130% 超长 ⇒ FAIL；恰 120 ⇒ PASS；`=`195 ⇒ FAIL；**瞬时起音 ⇒ FAIL**；线性 4ms 起音 ⇒ PASS）⇒ 判定函数**有判别力**。**缺口**：自检**不覆盖**「测度纯净性」——正是本轮翻车处 ⇒ 登记 **D3**。
  - **探针自身缺陷 5 处**：`D0` 退出码分支（FAIL 无条件优先于「探针无效」⇒ 本轮应为 2 实落 1）；`D1` ENV-04 判据形式；`D2` box 跨骑邻格；`D3` 显著度 `min`→`max` + 自检缺测度纯净性；`D4` A05 静默跳过。**均为探针缺陷，与实现缺陷严格分开**；实现侧**零新增 BD**（唯一新增 = `BD-40`，落宿主集成层）。
  - **G4 建议：维持 `CONCERNS`**（§18.5 / §21.3 / §24.9 同口径）——① 本单**无被测实现的真回归**；② 第 ② 条「`[B]/[C]/[R]/[P]` 四道次」**动了但未通**（`[B]` 通路建立 ≠ `[B]` 取证完成）；③ 第 ③ 条（beads 主包红线无实测数据）**依旧成立** ⇒ **不得据本单升 PASS**。
  - **效力边界（写进报告 §25.8，一句不可省）**：本轮即使全绿也只到**屏幕像素层 + 合成器输出层**；而实际**这两层都未取证**。`[R]` 真机观感与 `[P]` 人耳听感**零证据** ⇒ **不得**宣称「真机不闪 / 同屏不刺眼 / 听感达标」。⛔ 不记 PASS 也不记 FAIL；`[P]`/`[R]` 不代判。
  - **约束遵守**：只写 §Output Path 内文件与本节；**未改** `games/**`（源码）/`packages/**`/`tools/**`/`systems-index §3`/`ux-spec.md`/其他成员台账；**未 commit / push**。
- **复跑补记 + 勘误（2026-09-16 追记 · 覆盖上文与之冲突的表述）**：
  - **以上「完成记录（首轮）」写的是首轮**（日志时间戳 `15:46:55Z`）。此后同一探针又跑了**两轮**（`18:03:53Z` / `18:59:35Z`）⇒ **以第三轮为准**；报告已追加 **§25.12 勘误节**（不改写 §25 正文）。
  - **最新计数（第三轮 `18:59:35Z`）**：`PASS 13 ｜ PASS* 10 ｜ FAIL 1 ｜ ⛔ 4` ⇒ **唯一 FAIL = `CLK-01`**（仿真/墙钟比值 **2.005**；三轮 1.999 / 2.029 / 2.005 **稳定复现**）⇒ **退出码记 `1`**（**不是 `2`**——我原先「应记 2」的答案已在 §25.12.3 更正；契约里 `2` 的定义以「**无 FAIL**」为前提，本轮不适用）。
  - **勘误 · 我错了**：`ENV-04` 的 `平均|Δ| = 36.382` 真根因 = **我的比对代码漏了 GL 行序 `bh-1-y`**（把同一 box 上下颠倒地比），**并非**我原判的「预乘 α / 取数路径不同」。修后 **平均|Δ| = 0.0000**、负向反证（故意错位）**68.41** ⇒ `ENV-04`/`ENV-03` **转 PASS**，原结论**撤回**。
  - **❗新增关键结论 —— 屏幕层 `P4S-01/02/03` 的 PASS 不得采信**：① `onset` 阈值由**几何先验** `RING_FULL_EST = 25049` 折算，而**实测窗口 max 仅 2023（= 先验的 8.1%）** ⇒ 阈值**正好压在峰上** ⇒ 「峰点数 = 1」**平凡为真**，且「非零支撑 = **33.3 game ms**」自证**欠采样**（判据对标的包络是 200ms）；② **三轮回异**：`P4S-03` = **3.35 / 3.95 / 1.67 次/秒**（FAIL / FAIL / **PASS**）、`P4S-02` 的 game 起点间距 = **600 / 500 / 1200 ms** ⇒ **同一判据面给出相反结论**。⇒ **屏幕像素层仍属「未取证」**（不是没通路，是**判据面与采样栅格不达标**）。修法（下轮 P0）：阈值改数据相对口径 + 支撑加下限 + **采样与 rAF 解耦**（`app.update(1/60)` 定步），做不到则须声明栅格并**拒绝判定**。
  - **A05 段状态更正（已执行，非「未执行」）**：`AUD-00 PASS`（`SynthAudioBackend` / voices = **19** ⇒ **§7.2 现场核实完成**）；10 条 A05 有真 WebAudio 实测（`PASS*`）：**03** 119.61ms + 起音 3.107ms、**04** 99.82、**09(t2)** 149.93、**15** 499.55 + 双段（谷 0.4% / 回升 100%）、**16** 799.59、**18** 199.68/149.86、**19** 249.98、**21** 8000ms + 接缝 0.0004 ≤ 环内最大 0.0011、**22** `activeLoops` 恒 1、**25** 0 KB。**`A05-09b` 两轮不一致（348.39 → FAIL / 通过）⇒ 待裁；QA 不放宽 ±1ms**。量规迭代（−40dB→−60dB、窗级→**样本级**）**只改量规、判据一字未改**。`A05-26`（`[P]`）/ `A05-27`（`[R]`）**仍 ⛔ 不代判**。
  - **顺带两项：本轮已落盘（动手前已 grep 确认此前确实未做）**：① `g4-probe-v1.1.mjs` 的 `A05-09` 主体 `sfx_combo_t3` → **`sfx_combo_t2`**，t3 另立 **`A05-09b`**（**条数 66 → 67**，判据真源 = `audio-events §4` WXG-T-103 现文，非新造判据 ⇒ **T-103 残留清零**）；② 删去 P4 证据串的「折算峰频 **≈X Hz**」字段，改注为**窗口折算量**口径（**不是有效闪烁频率**；有效 = 500ms 重启门 ⇒ **2 次/秒**）。两处均 `node --check` 通过；**只改未复跑**（该探针**无 `--log` 开关**，复跑会覆盖 T-118 证据）⇒ 报告 §24.1 的计数仍为**改前口径**（已在探针头注与报告 §25.12.7 声明）。
  - **新增探针自身缺陷（与实现缺陷严格分开）**：`D5` `onset` 阈值随视口漂移（44.8% ↔ 8.1%）；`D6` 采样栅格未与 rAF 解耦（33.33–83.33 game ms）；`D7` `SELF-01` 用**实测帧长**构造反例（6 帧 × 83.33 = 500ms）⇒ **异常帧长下自检失效**（第二轮 FAIL / 第三轮 PASS ⇒ 自检本身不稳定）；`D8` `AUD-01` 的「预期（先写）」栏写成「（见正文）」= **无先验预期**（违反「先写后跑」纪律）。`D1` 真根因已更正；`D3` 已由我修（显著度 `min(左基,右基) → max`，影响面已核：**不改变第三轮任何 PASS/FAIL**）；`D4` 随 A05 段落地而消除。
  - **新增缺陷（唯一，落点在宿主侧）：`BD-40`** = 宿主双驱动（App 自驱 + `CocosLoopBridge.schedule` 同时推进 `app.tick`，实测 ≈2 倍帧步，**三轮复现**）⇒ **真机有同源风险**（`WeappPlatform.requestFrame` 同样优先 `requestAnimationFrame`）⇒ 列入真机首验 **P0**；**若真机同样 ≈2×，则升级为产品级 P1**。
  - **G4 建议：仍 `CONCERNS`**（不得升 PASS）—— ② 「`[B]` 道次」**动了但判据面不达标 ⇒ 仍未通**；③ beads 主包红线**无实测数据**。**不得宣称**「屏幕层不闪 / 真机不闪 / 同屏不刺眼 / 听感达标 / `[B]` 道次已覆盖」。
  - **⚠️ 并发声明**：本轮工作树有**并发会话在同一单上作业**（`evidence/*` 于 `02:59:41–46` 被其重写、探针被其扩充 A05 段）。我为免覆盖其新鲜证据**未再复跑**。若本节的「§25 正文」与并发会话产出的版本冲突，**以 §25.12 勘误为准**，并请主理人收口（含 `g4-regression-report.md` 是否出现重复 §25 的检查）。
- **主理人复核 + 裁定 + 收口（2026-09-16）**：
  - **事实复核（非采信自述）**：① 探针 `beads-browser-probe.mjs` **75502 B、`node --check` 通过**；② **`BD-40` 主理人已做代码级确证** —— `packages/framework/src/compose/app.ts:121`（`start()` 无条件 `_schedule()`）→ `:158-169`（`platform.requestFrame` **自驱** `tick`）**与** `packages/framework/src/adapters/cocos/loop-bridge.ts:32/42`（`schedule(_tick, 0)` → `app.tick(dt)`）**同时驱动**，而 `adapters/cocos/bindings.ts:106-108` **两者都接**（`new CocosLoopBridge(app)` + `start()`，其内部又调 `App.start()`）⇒ **双驱动成立**，与实测 1.999/2.029/2.005 **三轮复现吻合**；③ **无重复 §25**（仅一处 `## 25.` + 一处追加节 `## 25.12`，且后者自声明「覆盖 §25.0–§25.11 中与之冲突的表述」）；④ `check:tasks` / `check:links` 均 OK。
  - **裁定 ①：G4 维持 `CONCERNS`（不得升 PASS）** —— 采纳 QA 建议。`[B]` 道次**动了但判据面不达标**，屏幕像素层**仍属未取证**；`beads` 主包红线仍无实测数据（无 AppID）。
  - **裁定 ②：屏幕像素层结论「不采信」，且这不是失败而是判据面不合格** —— 采纳 QA 自判：`onset` 阈值由**几何先验** `RING_FULL_EST` 折算，而实测窗口 max 仅为其 **8.1%↔44.8%**（**随视口漂移**）⇒ 阈值压在峰上 ⇒「峰点数=1」**平凡为真**；且「非零支撑 33.3 game ms」自证**欠采样**（对标包络是 200ms）；**4 次运行 `P4S-03` = FAIL/FAIL/PASS/FAIL** ⇒ 同一判据面跨轮给出**相反结论**。⇒ **下轮 P0 修法**：阈值改**数据相对口径** + 支撑加下限 + **采样与 rAF 解耦**（定步 `app.update(1/60)`）；做不到则须声明栅格并**拒绝判定**。
  - **裁定 ③：本轮唯一实质推进 = `[B]` 通路建立 + A05 时长/包络族实测** —— `AUD-00 PASS`（**§7.2 现场核实完成**：Cocos 产物上 `SynthAudioBackend` + voices=19）；10 条 A05 有真实合成输出实测（`PASS*`）；`A05-09` 清 **T-103 残留**（主体 `sfx_combo_t2` + 另立 `A05-09b`，**条数 66→67**）；顺带项 ② 删去「折算峰频 ≈X Hz」误读字段。**`A05-09b` 两轮不一致（348.39 FAIL ↔ 通过）⇒ 挂「待裁」**；**QA 拒绝放宽 ±1ms 是正确的** —— 交给设计侧裁「该量规下的固有截断是否属容差」。
  - **裁定 ④：`BD-40` 定级 `P1`**（**若真机同样 ≈2× ⇒ 升产品级 P1**）。**后果必须写足**：仿真/墙钟 ≈**2×** ⇒ 倒计时/动效/音频时长相对墙钟**减半**，且 **wrong 闪烁在墙钟口径 3.35–4.49 次/秒 > `systems-index §3.8` 的 2 次/秒** ⇒ **光敏性红线在宿主层被违反**（`T-102` 的游戏时基逻辑本身正确）。**真机有同源风险**（`WeappPlatform.requestFrame` 同样优先 `requestAnimationFrame`）⇒ 列出真机首验 **P0**。**注意 `WXG-T-121` 已把 BD-40 挂进门禁**（另一会话），该线只解决**检测**；**BD-40 的修复本身仍无工程单**，需另立。
  - **裁定 ⑤：并发收口完成** —— 无重复 §25；探针以 `mtime` 最新者为唯一真源；`D3` 修正（显著度 `max`）保留、`D5` 发现（几何先验阈值面不成立）**已被并发作业采纳并写入探针注记**。
  - **❗ 发起方（主理人）错误登记**：我把工具返回的两次 **「Execution Cancelled: Idle timeout」当作「代理已死」**，第二次**险些据此重复派工**；实测该消息**不可信** —— 第一次报 cancelled 后代理**仍继续跑了 40+ 分钟**并产出次轮成果，第二次同样续跑至收工。⇒ **教训入册：该 cancelled 消息不得作为「已停止」的判据，必须以文件 `mtime` / 进程表核实后再动作。**
  - **残留（不阻断，留档）**：① 报告 `## 25.12` 是**二级标题却用子节式编号**（`25.12`），格式微瑕；② `evidence/*.log` 被根 `.gitignore:55` 的 `*.log` 覆盖 ⇒ **不入 git**（沿用既有体例，复核请读盘）；③ `pnpm run verify` 未随本单跑（口径同前几轮）。

- **终轮复跑记录（2026-09-16 · 严守真=并发 QA 会话；**执行主理人 §25.12.2 列为「下轮 P0」的修法**）**：
  - **做了什么**：把 §25.12.2 的三条修法（＋§25.12 缺陷表 D7/D8）在探针里落盘，**只改探针、判据数值一字未改**：
    **D5** 起播门限改**数据相对**（`0.15 × 本序列 max`，滞回下界 `0.02×max`；`RING_FULL_EST` 不再参与判定）；
    **D5②** 支撑判据改**两端都断** `[80, 233.3] game ms`（下限 80ms **由指标自身仿射律推出**：`metric(α) ∝ max(0,141α−55)` ⇒ α<0.39 恒 0 ⇒ 以 0.15·max 为界 ⇒ α≥0.48 ⇒ 200ms 梯形包络预期支撑 ≈134ms）；
    **D6** 采样与 rAF **解耦**：新建**精栅格上下文** —— `comp._loop.stop()`（撤 Cocos schedule ＋ `app.stop()` 撤自驱）后由探针每帧 `app.loop.advance(1/60)` ⇒ **每样本恰 1 固定步（16.67 game ms）**；
    **D6′（本轮新发现）** 间距/支撑改取**逐样本真实时钟**（`pulseClock` 差 / `performance.now()` 差）—— 首版用「帧号 × 中位栅格」，而**每帧推进的固定步数并非常数**（实测 16.67/33.33/50ms 混布）⇒ 把 583ms 的间距误算成 433ms，**这才是 §25.12「三轮回异」的直接成因**；
    **D7** `SELF-01` 反例改用**标称固定步** `1000/60` 折算；**D8** `AUD-01` 补先验预期；**D9** 支撑下限改由仿射律推出（首版直接取 0.6×200=120ms ⇒ 把 100–150ms 的**正确**读数伪判不通过）；
    **D0**（§25.12.3 建议）新增第三态 **`⊘` = 判据面不成立（拒绝判定）**，与 `⛔` 同级、**不影响退出码**。
  - **终轮结果（两轮判定串逐字一致 ⇒ 确定性自证成立）**：`PASS 12 ｜ PASS* 10 ｜ FAIL 1 ｜ ⛔ 4 ｜ ⊘ 2` ⇒ **退出码 `1`**，**唯一 FAIL = `CLK-01`**（仿真/墙钟 **2.003**）。
    - `P4S-00` 21 个候选无环帧 `ringMetric` **全 0**；`P4S-01` 峰点数 **1**、**非零支撑 150.0 game ms ∈ [80,233.3]**；
      `P4S-01b` 连续拒绝下 **6 次脉冲逐次数峰 = 全 1**（两轮中一轮出现 1 次 2 峰 ⇒ 记 `⊘`）；
      `P4S-02` 起播间距（game）**[617,600,583,617,583] ms ⇒ 最小 583 ≥ 500**（判据含 1 栅格容差 483.3）⇒ **§25.12.2 的「不得采信」已在 game 时基上解除**。
    - `P4S-03` 记 **`⊘`**：直测墙钟 2.22 次/秒 vs 由 `CLK-01` 比值换算 3.88 次/秒 ⇒ **两法差 1.75 倍** ⇒ **双驱动宿主上「墙钟」这一个量本身不稳定** ⇒ 拒绝判定（不给 PASS 也不给 FAIL）。
  - **A05 段最终口径**：判据面 = **1ms 窗峰值包络**（不是样本级 —— 多音叠加如 `sfx_combo_t3` 的瞬时和**拍频到零**，样本级会系统性提前 348.39 vs 窗级 349.21）；容差 = **1 窗 = 1ms**（由量规几何推出）。`A05-09b` 终轮 **349.21ms** ⇒ 通过（**未放宽 ±1ms**，改的是量规口径）⇒ §25.12.5 的「待裁」建议**按量规收敛关闭**，仍请设计侧确认口径。
  - **效力边界（不因转绿而放宽）**：可宣称「**一次拒绝 = 一次可见脉冲事件**（game 时基 ≥500ms、像素支撑 133–150ms）」＋「合成器输出层 10 条 A05 实测」＋「`[C]` 音频资产 0」；
    **不可宣称**「真机不闪／同屏不刺眼」（`[R]` 零证据）、「听感达标」（`[P]` 零证据）、「`[B]` 道次已覆盖」、「α 极值点 ≤1 已在屏幕层证实」（严格判据面仍是指令流层 T-118 §24.3；屏幕度量混有 ±3px 位移通道）。
  - **`BD-40` 的可复核事实已加强**：仿真/墙钟 = **2.003** ⇒ 同一「game 500ms」的门在墙钟上只值 ≈ **250ms** ⇒ **若真机同为双驱动，墙钟有效闪烁 ≈ 4 次/秒 > §3.8 的 2 次/秒**（真机同源风险，`WeappPlatform.requestFrame` 同样优先 rAF）⇒ 真机首验 P0。**修复建议**：`App.start()` 加 `{ selfDrive:false }` 或宿主改用「只初始化不自驱」变体。
  - **产物**：探针 `production/qa/beads/beads-browser-probe.mjs`（`node --check` 通过，唯一真源以 `mtime` 最新者为准）；证据
    `evidence/beads-browser-probe-t119.log`（EXIT=1）、`beads-browser-probe-t119-rerun.log`（**判定串逐字一致**）、
    `beads-browser-p4-screen.json`（原生＋精栅格两套序列）、`beads-browser-crosscheck.json`（`|Δ|=0.0000` ＋ 反向 68.41）、
    `beads-browser-a05-envelope.json`（19 clip）、`beads-p4screen-{base,peak,fine-base,fine-peak}.png`；报告 **§25.13**。
  - **只读边界**：只写 `production/qa/beads/**` 与本小节后半段；**未改** `games/**` 源码、`packages/**`、`tools/**`、`systems-index §3`、`ux-spec.md`、其他成员台账；**未 commit / push**（`cocos/build/**` 与 `dev/harness/dist` 已被 `.gitignore` 覆盖）。
  - **⚠️ 并发合并说明（供收口）**：本轮与主理人/另一会话**同文件并发作业**（探针被双方编辑过；`D3` 显著度 `max` 修正保留；我另修了其引入的**切片边界**问题——`countPeaksSignificant` 用 `max(左基,右基)` 时，**位于切片首样本的峰显著度为 0** ⇒ 多脉冲复验里每次脉冲的首峰被漏计）。**建议收口动作**：① 以 `mtime` 最新探针为唯一真源；② 检查报告是否出现重复 §25（本次检查：仅 `## 25.` / `## 25.12` / `## 25.13` 三处，无重复）；③ `pnpm run verify` 仍未随本单跑（口径同前几轮）。

## WXG-T-103

- **名称**：**音频裁定包补做（冲突 C1 / C3）——T-098 漏列项**
- **负责**：文策渊(design-strategist)　**状态**：✅ 完成（2026-09-15；**A05-09 本体仍记 ⛔**，因探针未同步）
- **背景（主理人认错）**：`g4-regression-report.md §19`（T-096 轮）建议第 4 条已明文「C1/C3 随 T-098 一次性打包给文策渊」，但主理人写 T-098 任务书时**漏列**该两项 ⇒ 另号补做，不把范围 retroactively 扣到 T-098 头上。**C1** = `A05-09` 把「伪震屏 scale 1.015」写成 `sfx_combo_t3` 的同帧主体，而 §1 行 7 与 `combo-vfx.ts:46-50`（tier=2→pseudoShake、tier=3→burst）均表明**伪震屏属 Lv2** ⇒ 子句不可判定（QA 记 ⛔）。**C3** = `audio-events §1` 时长列 7 处非纯数字 ⇒ `[B]` 实测无期望值可比。
- **Deliverables**：① C1 —— `audio-events §4` 判据主体改到正确梯级（t2）+ t3 侧另立子判据，并逐行核 §1 全部 combo 梯级有无同类错置；② C3 —— 7 处逐条分流（**甲** = 可凭 §3.12 / `ux-spec §5` 现有值定写；**乙** = 保持 `[TODO]` 但写成**可解除**的 `[TODO]`，标解除条件与「实现占位值不得回引为规格」）；③ 两篇各补总口径一句；④ 零新拟增常量（`audio-spec §7.2` 复核确认）。
- **完成记录（2026-09-15）**：① **C1**：`A05-09` 主体 `sfx_combo_t3` → **`sfx_combo_t2`**，t3 的「350ms + 同帧」另立 **A05-09b**（挂 `burst`）；§1 全部 combo 梯级逐行核过，**同类错置仅此一处**。主对话顺带清掉同源错置注释 `src/config/audio-voices.ts` T2/T3 两行（纯注释，无行为变更）⇒ `framework:sync` 已重镜像。**编号采 `b` 后缀，不做整体重排**（重排会牵动台账与已有证据引用）。② **C3**：**5 甲**（`urgent_beat ≤1000` 周期窗口、`tray_full ≤500`【主理人裁甲：沿用 §5 500ms 上限，非期望值】、`stage 500`、`star 150`、`revive_ok ≤400`）/ **2 乙**（`ui_tap` 解除条件 = Q-A05-1 裁决；`bgm_main` 循环点 = A05-21/22 `[B]+[R]`）。总口径入两篇文首与 §4.3。③ 零 §3 改动、零伪数值。
- **约束**：成员只允许写 `design/audio/audio-events.md` 与 `audio-spec.md`；**禁改** `src/**`、§3、`production/**`（含 QA 文档）。

## WXG-T-106

- **名称**：**memory 二级详情文件索引（`memory/details/`）——治单日期文件反复越 B 门**
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-15；桩自测 36 + 56 全绿，16 节逐字节外移且还原比对通过）
- **动机（实测，非猜）**：`memory/2026-09-15.md` 在 WXG-T-097/BD-10 轮冲到 **8693 tok**（B 门 8000）被 pre-commit 真拦；本轮按用户拍板「乙」压成摘要+指针勉强降到 **7876**，**余量仅 124 tok**，而同日还有 ≥2 轮待写 ⇒ 压缩不是可持续解。另：`2026-09-12.md` 10141 / `2026-09-14.md` 12586 全靠 **WXG-T-030 / WXG-T-065** 两条豁免挂着，而 **T-041 收窄裁决**原文是「到期不得靠 B 门豁免硬扛」。
- **设计（用户两项拍板：① `memory/details/` 单层；② 批次2 本轮一并做完并撤销那两条豁免）**：
  - **分层**：`memory/YYYY-MM-DD.md` 降为**当日骨架层**（逐轮一节：摘要要点 + 指针）；长正文逐节外移至 `memory/details/<YYYY-MM-DD>-<slug>.md`（**一节一文件**）。外移触发口径（机械可判）：**单节 > 600 tok** 即外移；未达阈值的短节留在日记。
  - **隶属标记**（详情文件首行，唯一真源）：~~`> 隶属日记：\`<YYYY-MM-DD>#<节锚点>\``~~ ⇒ **实现改为详情件 H1**：`# 隶属 · <YYYY-MM-DD> · §<日记节 anchor>`。理由：任务书原口径把标记放 blockquote，而生成器**只能从 `index.sections` 派生**（不读正文 ⇒ 避开 `--staged-blobs`/HEAD 契约不同源，判例 K-042/K-043），H1 天然是可靠可解析的唯一入口；且 anchor 串必与日记节**同口径**（含以数字开头时的改写与重复后缀），手写 `#<锚点>` 反而易错。**已按实现回写本节与 `memory/INDEX.md §1.1`**（先文档后代码不得反着干，但此处是发现漂移 ⇒ 订正文档而非伪造成 just-in-time 口径）。
    **故意不带目录前缀**——满 30 天连座归档后日记本体在 `memory/archive/`，该标记仍成立（distill 铁律是逐字节保留，**不得**改写归档件内容）。
  - **二级索引**：`memory/INDEX.md` 生成表的每篇日记节表**新增一列「详情」**（由生成器扫 `memory/details/` 的隶属标记派生，**不手维护第二份表**）；详情文件自身进 ctx 索引面 ⇒ 受同一道 8000 B 门约束（**机制自带防再膨胀**）。
  - **断链硬拦**：日记里有指针而详情文件不存在 = 证据已丢 ⇒ 新增一道**断链/孤儿**检查入 `ctx:check`（不静默降级为 note，否则就是假绿）。
  - **30 天轮转连座**：`memory:distill` 归档某天时必一并归档该天的 `details/<date>-*`（否则留孤儿 + 指针悬空），同样逐字节回读校验。
- **Deliverables**：① 生成器 `lib/memory-index.mjs`（`isMemoryDetail` / 隶属解析 / 「详情」列 / preamble）；② 断链检查入 `ctx:check`；③ `distill-memory.mjs` 连座归档 + `distill-memory-selftest.sh` 补用例；④ 迁移批次1（09-15 三节）+ 批次2（09-12 / 09-14）；⑤ 撤销 `budget-exempt.json` 两条（WXG-T-030 / WXG-T-065）；⑥ 协议回写（`memory/INDEX.md` 手写节·`MEMORY.md`·`docs/agent/memory-distill.md §8`·`ctx/ROUTES.md:193` 描述行）。
- **追加交付（任务书未列，但不做就是半个机制）**：⑦ 可复用外移器 `tools/scripts/split-memory-detail.mjs`（默认 dry-run，`--date=` 必填；节解析**复用** `lib/context-index.mjs::makeFileRecord`（该函数由私有改 export）⇒ 与门禁同口径，杜绝两套实现漂移）+ 其桩自测 `split-memory-detail-selftest.sh`（6 组 / 36 断言，含**跨脚本契约**：产物用 `makeFileRecord` + `parseMemoryDetailLink` + `memoryDetailLinks` 复核，并反向造孤儿证明硬拦有效）；⑧ 入口 `pnpm run memory:split` / `memory:split:selftest` / `memory:distill:selftest`（已核 `verify-all.mjs` STEPS 为显式列表，不误挂进 `verify`）。
- **约束**：**不新增任何豁免条**；日记原「逐字节不动」口径必同步改掉（不能只改代码不改协议）；详情文件不自动进 `ctx/hot-files.md`（`HOT_FILES` 为固定 6 文件集合，而该产物已 3992/4000 贴顶）；不代写/不伪造已丢内容（外移 = 逐字节搬运）；**不碰并发会话（T-104）未提交内容**，台账两份共享文件走「索引 blob 重建」而非文件级 `git add`（K-045）。
- **跳空说明**：取 106 而非 105——并发会话的 T-104 详情节里写有「dpr 另开单（建议 WXG-T-105）」，尽管其状态行已改「阶段 B 含 ×dpr」，仍**让号 105** 不跨会话抢号（注 4 同族教训；单号递增不回收，跳空合规）。
- **依赖**：无前置；后继 = 满 30 天蒸馏轮必用连座归档（T-041 口径）。
- **完成记录（2026-09-15）**：
  - ① **生成器**：`memoryDetails` / `memoryDetailLinks`（`byDaily` + `orphans`）、「详情」列、孤儿清单、preamble 四层化 + §1.1 外移口径 + 连座归档条。另修一处自毁导航价值的细节：**已外移行的「摘要」列改取详情件里的**原节首句（`orig = det.sections.find(level===2 && anchor===s.anchor)`），否则摘要列只会抽出骨架指针句并被截成半截括号。
  - ② **双向硬拦**：`check-context-budget.mjs::checkMemoryIndex()` 新增 **C-③**（孤儿：缺 H1 标记 / 指不到现存节；断链：骨架指向不在索引面的详情件），两者均 push 入 `failures`（不降级为 note ⇒ 不留假绿）。未跟踪新日记按 `resolveContent` 返回 `null` 处理为**不据此判红**（三分支契约，WXG-T-026/032⑤）。
  - ③ **连座归档**：`distill-memory.mjs` 新增 `DETAILS_DIR`/`ARCHIVE_DETAILS_DIR`、`orphanDetails` 报告、**组内任一目标重名则整组跳过**（日记与详情件同进同退），`--write` 改为**全量 read → 全量 write+回读校验 → 统一 rm**（中途失败不拆散两边）；`distill-memory-selftest.sh` 补连座夹具与 [7] 整组跳过用例 → **56 PASS / 0 FAIL**。
  - ④ **迁移**：共 **15 节**逐字节外移至 `memory/details/`（单层，用户拍板）：09-12 4 节（10141→**3132** tok）、09-14 7 节（12586→**6911**）、09-15 4 节（7876→**2674**）。**还原性自证**：一次性脚本把「骨架 + 详情件正文」回拼与 `git show HEAD:` 比对，**三篇全部逐字节一致**。
  - ⑤ **两条豁免已撤销**（`ctx/budget-exempt.json` 删 WXG-T-030 / WXG-T-065 整块）⇒ 本轮**零新增豁免**，且机制自带防再膨胀（详情件同受 B 门）。
  - ⑥ **协议回写已完成**：`memory/INDEX.md` 手写节（标题 / 四层 / 与 preamble 同口径的 §1.1 外移口径 / §2 文件分工新增 `details/` 行 / §3 连座归档）—— preamble **只在首次创建时生效**，既有文件必手改（否则代码改了协议没改 ⇒ 下一轮会话照旧口径写）；`MEMORY.md`（蒸馏规程三条 + 常用脚本一行）；`ctx/ROUTES.md` 摘要行描述与估算；`AGENTS.md §9` 读（memory）条的分流口径；`docs/agent/memory-distill.md` 新增 **§9** 并在 **§5** 补「两条豁免已撤销」现状条；`docs/agent/commands.md` 新增 `memory:split` 行与 `memory:distill` 的连座口径（任务书原写 §8，实现因 §8 已有内容而新增 §9，**以 §9 为准**）。
  - ⑦ **当场撞上的真 bug（幂等判据误伤）**：`split-memory-detail.mjs` 原用「节正文里出现过 `memory/details/`」当「已外移」判据 ⇒ **一节只是在讨论本机制本身**就被静默跳过（写本单当日日志时现形：刚写的 T-106 轮记录 1022 tok 却被判「已外移」）。现只匹配**本脚本自己发出的骨架行固定开头**（`SKELETON_RE` 与 `skeletonLine()` 同字形）；自测新增 **[6] 组**（反向：正文提及仍须被选中；正向：`--min-tokens=10` 降阈让真骨架也超阈，确认是靠指针判据而跳过、不新建件）⇒ **36 PASS / 0 FAIL**。另修两处同源缺陷：头注与 `--help` 写「整节跳过」而实现是 fail loud ⇒ 订正；重建自检只查首节标题 ⇒ 改为逐节查。可复用同构教训入 `knowledge/lessons.md`：**幂等判据必锁「自己写出的产物字形」，不得锁「正文里出现过某个关键词」**。
  - ⑧ **本机制吃自己的狗食**：本单自己的当日日志节（1022 tok）即用本工具外移为第 **16** 件 `memory/details/2026-09-15-s10-t106.md`，日记降到 **2745 tok**；全仓复扫（含 `09-11`/`09-13`）确认早前迁移**无漏移**（`09-12`/`09-14` 现均无 > 600 tok 的 `##` 节），且两篇未越阈历史日记按存量口径**不预先切**（工具会列出它们为候选，此为人为不执行，已写进 §1.1 口径）。
  - 门禁复验：`ctx:build --working-tree` → `ctx:check --working-tree`（**必成对**：默认 committed 模式会 skip 未跟踪详情件）⇒ C 项「✅ memory 二级详情层（WXG-T-106）：**16** 个详情文件，隶属/指针双向可解析」；B 门已无 `09-12`/`09-14` 两行（豁免已撤且自然降回阈下）。**唯一红**：`ADR-0011` 8446 tok > 8000 —— 属**并发会话 T-104 未提交改动**，不由本单代拆、**不为其新增豁免**。
  - **代价诚实记录**：`memory/INDEX.md` 本体 5513 → **6777 tok**（+23%：手写协议加长 + 新增一列），仍 <8000 且随 30 天归档自然回落；若后续日报继续追加，本文件自己也会需要拆（它不在本单范围，已登记）。
  - ⑨ **实际落库四笔与「为何不能再拆」**（`742752c` / `2e6ca7f` / `b7ae82d` / `3fa8c27`）：第一笔必为「生成器 + 门禁硬拦 + 三篇骨架 + 16 详情件 + 撤两条豁免」**同笔**——拆开必红：`ctx:check` 的豁免表是**读磁盘**，只要撤豁免这件事已在工作树里，未暂存的骨架就会让 B 门按 `HEAD:` blob 量到旧巨型日记（实测 10141 / 12586 tok 双红）；工具单独一笔亦不成立（理由同上）。剩下三笔按关心点拆：外移器+自测、连座归档、协议回写。
  - ⑩ **撞上一处既存门禁缺陷（非本单引入，已登 backlog）**：`memory/INDEX.md` 是**生成物又被索引**，但不在 `lib/context-index.mjs:127` 的 `WORKTREE_AUTHORITATIVE` 集合里 ⇒ `--staged-blobs` 下它的索引记录取的是**暂存旧字节**，而磁盘已被重写成新字节 ⇒ pre-commit 单遍「重建 → add → 校」对不上 `sha256`，报 `C(--staged): 暂存内容与索引不一致 — memory/INDEX.md`，**需再跑一遍 build+add 才收敛**（钩子提示的「直接重新提交即可」同源于此，但字面未解释为何）⇒ 登 **BD-38**（修法建议：把 `memory/INDEX.md` 加入 `WORKTREE_AUTHORITATIVE`，与 `ctx/BUDGET.md` 同处理）。
- **本号归属声明（防跨会话歧义）**：并发会话 T-104 的「收尾裁定」文内写有「④ 派严守真固化 R1/R2/R3 取证 = **WXG-T-106**」，但该派单**实际已落在 `## WXG-T-108`**（同一会话另写的 control-manifest 单落 107）⇒ 那句是未订正的旧字面，**不构成本号冲突**。本号 106 的唯一归属 = memory 二级详情层（占位已随 `1f73e2b` 入库）。根因已入沉淀候选：**领号只看了 HEAD 的头注，而并发会话占的 105–108 当时仍全在工作树未提交** ⇒ 领号必以**工作树全文**（`grep '^## WXG-T-' TASKS-DETAIL.md` ∪ 主表行）全局最大号为准，不能只信已提交头注（与 K-045 同族）。

## WXG-T-111

- **名称**：**knowledge 沉淀库按行内标签分片（`knowledge/lessons/<tag>.md`）——结掉 WXG-T-098 豁免的硬到期条**
- **负责**：主理人(Qoder)　**状态**：✅ 完成（2026-09-15 当日开工当日收口；用户两项拍板：粒度＝**按行内标签切 6 片**；旧路径＝**保留 `lessons.md` 作指针页**）
- **动机（实测）**：`knowledge/lessons.md` = **10768 tok**，而 WXG-T-098 豁免 note 的硬到期条件是「自登记基线 **9021** 起再增长 **>800 tok**」⇒ 已 **+1747 越线**（且本轮开工前就已越，不是本轮写进去的）。协议明写到期**不得续期豁免**，只许做结构性拆分评估；用户裁定「本轮就地做」⇒ 本单 = 评估 + 实施一体。
- **实测结构（分片依据，不靠猜）**：条目**行内标签**与 `##` 小节**不一致**（`## 流程` 里挂着 `[测试]` / `[判据]` / `[工具链]` 条目），故按 `##` 切不干净。按行内标签统计：**工具链 15 条 4789 tok ／ 流程 6 条 2774 ／ 判据 3 条 1516 ／ 测试 2 条 1033 ／ 跨 IDE 3 条 483 ／ 环境 1 条 136**（条正文合计 10731，30 条）。⇒ 最片 4789，对 8000 余量 3.2k。
- **布局口径（冻结）**：
  - 一标签一文件：`knowledge/lessons/{toolchain,process,criteria,testing,cross-ide,environment}.md`；**条目正文逐字节搬运**（标题行 + 缩进子行 + 归档元信息行原样），`## <标签>` 行随条目进对应分片。
  - **`knowledge/lessons.md` 保留为指针页**（≈250 tok，**不再放条目**）：布告「已分片 + 标签→文件表 + 引用口径」。理由：全仓 20+ 处脚本注释以「`knowledge/lessons.md` K-0NN」形式引用，保留指针页 ⇒ 旧引用仍解得出，**零无关文件搅动**。
  - **引用口径**：引用一律写 **K-0NN**（可附任务号），**不写文件路径**；ID→分片由 `knowledge/INDEX.md` 活跃表的「分片」列机械解析。
  - **K-0NN 命名空间 = 全局单一**（`ledger.nextId` 不变）：分片只改正文落位，**不改编号语义、不回收旧号**。
  - **归档仍单份**：各分片共用 `knowledge/archive/lessons-archived.md`（`kb:archive` 按条目 `file` 反查所属 ACTIVE_FILES 项，**不得再写 `file === 'knowledge/lessons.md'` 硬编码三元**）。
  - **防再膨胀**：分片同受 B 门（8000）约束，**不为其新增豁免**；某分片再越阈 ⇒ 该标签内部再按子标签切（口径入 `knowledge/INDEX.md`）。
- **连动面（必改，逐项验收）**：① `lib/knowledge-ledger.mjs::ACTIVE_FILES` 改为**动态枚举** `knowledge/lessons/*.md` ∪ `patterns.md`（目录不存在 ⇒ 回退到单文件旧布局，**不假绿亦不砸错**）；② `kb-sync` / `kb-check` / `kb-collect` / `kb-audit` / `kb-archive` / `kb-reactivate` 六脚本（均 import 同一常量 ⇒ 预期只改 lib 与 archive 硬编码一处）；③ `ledger.json` 条目 `file` 改指分片（**`contentHash` 不含 `file`** ⇒ 不算「修改」，不造 30 条伪 updated）；④ `INDEX.md` 活跃表新增「分片」列；⑤ `ctx/budget-exempt.json` **删 WXG-T-098 对 lessons.md 的豁免条**；⑥ 协议回写：`knowledge/INDEX.md` 读取协议、`ctx/ROUTES.md`、`AGENTS.md §9`、`memory/MEMORY.md`、`docs/agent/*` 同族口径。
- **Deliverables**：① 一次性迁移脚本（**dry-run 默认**，逐字节搬运 + 回读自证：拼回与 `git show HEAD:` 逐字节一致）；② `ACTIVE_FILES` 动态化 + `kb-archive` 硬编码修正；③ 分片桩自测（新标签/未知标签 fail loud、跨分片补号单调、归档同进同退）；④ 6 个分片文件 + 指针页；⑤ 写入 **K-046**（领号必以**工作树**全文全局最大号为准，不能只读已提交头注）与 **K-047**（幂等判据必锁「自己写出的产物字形」）；⑥ 撤销 WXG-T-098 豁免条（本轮**零新增豁免**）；⑦ 协议回写六处；⑧ `kb:sync` + `kb:audit` + `ctx:build` + `pnpm run verify` 全绿并沉淀统计入库。
- **验收**：`pnpm run kb:check` 绿；`kb:audit` 条目总数 = **32**（原 30 + 新 2）无丢失；`ctx:check` B 门不再含 `knowledge/lessons.md` 行且无新增豁免；全仓 `grep -rn 'lessons.md'` 无断链（指针页存在）；`verify` 不短路全绿；迁移前后条目正文逐字节一致（自证脚本输出为准）。
- **约束**：不动 `patterns.md`（1452 tok）；不靠删信息凑体积；不伪造分片后的旧引用校验；**不碰并发会话未提交内容**（台账两份仍走 blob 重建 + `update-index`，K-045）。
- **代价诚实记录（预期）**：指针页 + 6 片头注 ≈ 新增常驻 200–300 tok；`INDEX.md` 活跃表多一列×32 行；分片后「跨标签同族互引」（如 K-035↔K-038↔K-039）需跳文件读，靠活跃表定位（WXG-T-098 当时以此为由不拆，本轮拆 = 用户裁定优先，代价在此登记）。

- **完成记录（2026-09-15 当日开工当日收口）**：
  - ① **迁移**：一次性工具 `tools/scripts/split-knowledge-lessons.mjs`（默认 dry-run，`--write` 才落盘）把 30 条正文按**行内标签**逐字节搬入 6 片（toolchain 15 / process 6 / criteria 3 / testing 2 / cross-ide 3 / environment 1），`## <标签>` 小标题随片保留（`kb:reactivate` 靠它定位）。**还原性自证不沿用旧结论**：头注收紧后**复跑**独立脚本，以 `git show dd02a6f:knowledge/lessons.md`（分片前的 30 条源）为对照重解析回拼 ⇒ 「源 30 块 ↔ 现 32 块，**逐字节差异 0**，新增号 K-046 / K-047」（判例 K-047③：自证要拿 `git show HEAD:` 而非内存自比）。
  - ② **装置连动**：`ACTIVE_FILES` 由固定两文件改**运行时枚举** `knowledge/lessons/*.md`（目录缺失 ⇒ 回退旧布局单文件，**不砸错亦不假绿**；已知片按 `LESSONS_SHARD_ORDER` 稳定序、未知片按名序追加），新增 `shardOf` / `shardCellOf`，`INDEX.md` 活跃表加「分片」列；`kb-archive.mjs` 归档目的地由硬编码三元改**按条目 `file` 反查**。实测「改落位不算修改」成立：`ledger.json` 仅 30 处 `file` 变化、`contentHash` **全等**、`events` 零新增、`CHANGELOG.md` 未被改写。
  - ③ **撤豁免且零新增**：删 `ctx/budget-exempt.json` 中 `knowledge/lessons.md` 条（WXG-T-098 登记的硬到期条已越 +1747 tok），现存 **22** 条豁免全属既存、本单**未加任何一条**；`ctx:check` B 门已无该文件行。**撤豁免与分片必同笔**（`f88666c`）——豁免表**读磁盘**，拆成两笔时未暂存的旧巨型文件会被按 `HEAD:` blob 量到判红（同 T-106 ⑨ 的谱系）。
  - ④ **桩自测**：新增 `split-knowledge-lessons-selftest.sh` **9 组 / 45 断言**（dry-run 不落盘、回拼用**第二套实现**而非自比、指针页零正文、未知标签 / 缺号 fail loud 且零产物、`ACTIVE_FILES` 两分支、跨分片补号单调、两片共用单份归档、二跑守卫 + 注释符号真实性）。另撞出**既存**缺陷：`knowledge-selftest.sh` 此前**既无 pnpm 入口也不在 verify** ⇒ 首跑 **4 FAIL**（根因 = `build-context-index.mjs` 自 WXG-T-068 起无条件写 `memory/INDEX.md`，桩仓库无 `memory/` ⇒ ENOENT 连带 [9]/[16] 两组失真）；已补 `pnpm run kb:selftest` 入口 + 夹具建目录 ⇒ **190 PASS / 0 FAIL**。「与本单改动无关」是**临时 checkout HEAD 版 lib 再跑**证出来的，不是推测；未挂进 verify 的债登 **BD-39**。
  - ⑤ **沉淀**：**K-046**（领号认工作树全局最大号，不止已提交头注）、**K-047**（幂等 / 重复执行判据必锁自己写出的产物字形；收尾追加 ⑤ = 一次性工具必带「已完成」判定 + `--force` 出口）。`kb:sync` 沉淀统计：分片段**新增 2｜修改 0**、K-047 ⑤ 段**新增 0｜修改 1**；`kb:check` 八重 exit 0。附带修一处枚举漏项：`INDEX.md §2` 类别表原本没有 `判据`，而库里已有 3 条 `[判据]` 条目（K-031「人写的枚举必漏项」同族）。
  - ⑥ **协议回写六处**：`knowledge/INDEX.md`（§1 读取按活跃表定位 / §2 类别与「新标签 = 新建一片」 / §3 文件分工 / §4 分片不越 B 门不得加豁免 + K-0NN 全局单一命名空间）、`AGENTS.md §9`、`ctx/ROUTES.md`（教训库行改指针页 + **订正领号行**——旧文「领号只读头注」正是本轮撞号成因）、`memory/MEMORY.md`、`docs/agent/repo-layout.md`、`docs/agent/commands.md`（登记 `knowledge:split` / `knowledge:split:selftest` / `kb:selftest`）。`kb-sync.mjs` 头注仍写「解析 `knowledge/lessons.md` + patterns.md」⇒ 一并订正为分片集（`190950b`，纯注释、重跑产物字节不变）。
  - ⑦ **实测代价（预估口径写错，据实订正）**：任务书「常驻 +200–300 tok」把「按片读」与「常驻」混了。实测结构开销 = 指针页 **350** + 6 片头注 **545**（首版 791，随后把每片 3 条 `>` 并为 2 条并把重复口径指向 `INDEX.md` 正本 ⇒ −246；`shardHeader()` 模板同步改，工具与产物不分叉），**单次读一个片 ≈ 350 + 91**。各片现状：toolchain 4925 / process 3500 / criteria 2275 / testing 1165 / cross-ide 615 / environment 269 tok ⇒ 下一越阈的大概率是 **toolchain**，届时按子标签再切（口径已写进 `INDEX.md §4`）。另：任务书「全仓 20+ 处脚本注释」实测 = **6 处**代码注释 + 2 处活文档以「`lessons.md` K-0NN」形式引用 ⇒ 按本单「零无关文件搅动」口径**不扫**，旧引用靠指针页仍可解出；新增引用一律只写 K-0NN。
  - ⑧ **本单自查撞出的三处自身缺陷（都已修，不藏）**：`split-knowledge-lessons.mjs` 注释引用的 `lib::LESSONS_TAG_ORDER` **符号不存在**（真名 `LESSONS_SHARD_ORDER`，K-035 族）⇒ 订正 + 自测加「注释里的 `lib::<NAME>` 必须是 lib 真实导出」断言；一次性工具**无「已完成」判定** ⇒ 二跑把指针页的 `- **…**` 排版行报成「缺 [K-0NN] 先跑 kb:sync」假故障 ⇒ 加守卫 + `--force` 出口（`9652f94`）；`fca7bd8` 正文写「`knowledge/INDEX.md` 上一笔已随分片改」**说早了**（协议改动当时仍在工作树）⇒ `0ee8bf4` 据实补入库并在本处订正。
  - ⑨ **验收逐条对照**：`kb:check` ✅ exit 0｜lessons 条目 30 → **32 无丢失**、逐字节差异 0 ✅｜B 门无 `knowledge/lessons.md` 行且**零新增豁免** ✅｜全仓无断链（指针页在，`check:links` OK）✅｜`verify` **PASS 14｜SKIP 1（check:size 缺 wechatgame 产物）｜FAIL 0**（逐项未短路）✅｜桩自测 45/0 + 190/0 ✅。**遗留**：BD-39（装置自测未挂 verify）；「生成物又被索引」单遍不收敛一族 —— 本轮新数据点：**手工跑 committed 模式 `ctx:build` 并把产物 add 后再提交 ⇒ pre-commit 连拦两遍，改为不手跑、让钩子按暂存 blob 自建即一次通过**（`memory/2026-09-15.md` 入库时实测），与 **BD-38** 同族 ⇒ 交 **WXG-T-112** 评估，本单不扩面。
  - ⑩ **提交面（12 笔，均带 WXG-T-111）**：`be58dbe` 占位 → `c000f62` 夹具修复 → `83fa2bd` 分片器 + 自测 → `dd02a6f` lib 动态化 + 归档反查 → `f88666c` 分片 + 指针页 + 撤豁免 → `4fbbb66` K-046/047 → `fca7bd8` 协议回写 → `0ee8bf4` INDEX 协议正文补入库 → `9652f94` 二跑守卫 + 符号订正 → `9e606c9` K-047⑤ + 头注收紧 → `3f2e361` 当日日志 → `190950b` kb-sync 头注 → 本笔台账回填。
## WXG-T-112

- **名称**：**装置自指类门禁缺陷评估（含 BD-38：`memory/INDEX.md` 单遍不收敛）**
- **负责**：主理人(Qoder)　**状态**：✅ **完成**（2026-09-15 收口；BD-38 关单）
- **动机**：凡「**自身被索引的生成物**」都有同一类时序坑：重建时它自己的索引记录取的是**旧字节**，写盘后又是**新字节** ⇒ 单遍「重建 → add → 校」必不一致。实测判例：① **BD-38** `memory/INDEX.md` 不在 `lib/context-index.mjs:127` 的 `WORKTREE_AUTHORITATIVE` 集合 ⇒ pre-commit 需跑**两遍**才收敛（本轮 2026-09-15 撞上，已登 backlog，钩子提示「直接重新提交即可」同源于此但未解释为何）；② `ctx/BUDGET.md` / `ctx/hot-files.md` 已靠该集合规避；③ WXG-T-111 新引入的 `knowledge/lessons.md` **指针页 + `INDEX.md` 生成块**属同一形态 ⇒ 本单必评估其暂存区语义。
- **Deliverables**：① 判定三类形态是否应统一收口（候选修法：把生成物一律加入 `WORKTREE_AUTHORITATIVE`，或 pre-commit 改为「重建 → add → **再重建** → 校」双遍并写进钩子注释）；② 桩自测：暂存区模式下生成物与索引**单遍必收敛**；③ 按结论回写 `.githooks/pre-commit` 与 `docs/agent/hooks-best-practices.md`。
- **约束**：不用 `--no-verify` 规避；不得为了「绿」把 C 项降级为 note。
- **完成记录（2026-09-15，主理人自证：隔离 `git worktree` 实测，不动在飞工作树）**：
  - ① **判定（Deliverable ①）**：任务书列的三类形态里只有**类①成立**——`memory/INDEX.md` 与 `ctx/BUDGET.md` / `ctx/hot-files.md`
    同根因（`ctx:build` 自产 .md 又被索引，而索引对它取的是**改写前**的 HEAD / 旧暂存 blob 字节），差别只在**是否登记进**
    `lib/context-index.mjs::WORKTREE_AUTHORITATIVE` ⇒ 统一收口 = 补登记，**不需要**改钩子为双遍重建。
  - ② **类③ 假设不成立（订正任务书）**：`knowledge/INDEX.md` 活跃块由 `kb:sync` 写、`knowledge/lessons.md` 指针页由一次性分片器写，
    二者**都不在 `ctx:build` 写盘链内** ⇒ 无「build 期间被本进程改写」这一时序条件，其一致性已由 `kb:check` ④ 守护。实测（改 `knowledge/INDEX.md`
    并暂存 → 跑 pre-commit）**第一遍即绿**，反证其不属本族 ⇒ 不收口、不扩面。
  - ③ **取证数据**（基线 = `3fa3be4`，改日记一行 + 只 `add` 该日记 + 跑真 `.githooks/pre-commit`）：基线**三种起手第一遍全部 exit 1**，
    诊断只点名一个文件 —— A 只暂存自有改动 / B 手跑 committed 模式 build 并 add 四产物 / C 手跑 build 不 add 产物；三方 sha 对账：
    `idx=e6c82d12 == head` 而 `staged == worktree == 694e63d8`（另两个产物则 `idx == staged == worktree` 全等）⇒ 根因坐实到取源分支。
    补登记后**同三起手第一遍全部 exit 0**。
  - ④ **推翻两条既有认知（诚实）**：a) 本轮早先记的「不手跑 `ctx:build`、让钩子按暂存 blob 自建即一次通过」是**错的**——那次一次通过
     因为前两遍失败时钩子已把产物 add 过；b) WXG-T-072 的「先落盘产物 → 再建索引 → 最后序列化，三步同源」在 committed / staged-blobs 模式
     下**并不成立**（第二步取源仍走 HEAD/暂存分支），顺序调整只是必要条件 ⇒ 两处注释均已按实测订正，不留误导后人的错论。
  - ⑤ **落码**：集合补 `memory/INDEX.md` 并 `export`（连带导出 `BUDGET_MD_REL` / `HOT_FILES_MD_REL`，消掉 `check-context-budget.mjs` 内
    重复字面量）；`ctx:check` 新增**装置自指对账**项（`C:` 级 failure，**非 note**：生成物集合 ⊄ 工作树权威集合即拦，并直接给修法位置）；
    新增 `tools/scripts/worktree-authoritative-selftest.sh`（入口 `pnpm run ctx:selftest`，**9/0**）；回写 `.githooks/pre-commit` ② 段与
    `docs/agent/hooks-best-practices.md §7`；沉淀 **K-048**。
  - ⑥ **自测为何可信**：含**判别力对照**（同一 gate 下普通 dirty 文件 → `head`、已暂存 → `staged`，否则「全部 worktree」的断言恒真）与
    **红绿双向端到端**（在隔离 worktree 里把登记行删掉 → 同一流程必须 `exit 1` 且诊断点名；`ctx:check` 对账门亦须报红）⇒ 绿灯是被本修法挣来的。
  - ⑦ **自查两处（本轮自犯）**：a) 新门注释初稿写「跑在 verify / CI / pre-commit 三处」—— 实测 `verify` 的 15 项里**没有** `ctx:check`
     （grep 零命中），真实覆盖只有 CI（`ci.yml` ctx:check 步）+ 钩子兜底两处 ⇒ 三处措辞已全部订正，并另登 **BD-40**；b) 自测脚本初稿两处
     假绿风险：红测那遍的补丁被 `run_hook_once` 每次拷回正确版冲掉、`String.replace` 替换串里 `$` 开头序列被特殊解释 ⇒ 改为显式传缺项源 +
     函数型替换。
  - ⑧ **代价（如实登记，不隐藏）**：集合内产物的索引记录跟随**工作树** ⇒ 钩子 `git add <产物>` 会把工作树中**未暂存**的产物改动一并纳入本次
     提交（三产物同语义，且属既存行为，非本单新增）；`memory/INDEX.md` 标记块**外**允许手写协议正文 ⇒ 手写后须与改动同次暂存。**未削弱既有守卫**：
     实测「手改 INDEX.md + 暂存」在基线与修法下都为绿（钩子本就会重建吸收），非本单引入的松动。
  - ⑨ **验收**：`ctx:check` exit 0 且打印「装置自指：3 个生成物全部在工作树权威集合内」｜`ctx:selftest` **9/0**｜`pnpm run verify` **PASS 14 ｜ SKIP 1（check:size）｜ FAIL 0**｜`kb:check` 八重 ✅（活跃 48）。

## WXG-T-104

- **名称**：**beads · P0 · Cocos 宿主输入 y 轴镜像（缺陷 C1）——「先锁语义，再改码」**
- **负责**：程基岩(engineering-lead)　**状态**：📋 已立项（待施工；2026-09-15 主理人实测发现并派单，用户拍板「先锁语义再改码」）
- **背景（主理人 2026-09-15 实测，Cocos web-mobile 产物 + 桌面 Chrome）**：在 Cocos 产物上**每一次点击都落在上下镜像的位置** ⇒ 玩法不可用。三层证据：① 页面点 (700,100)（窗口 1280×720）时 `e.getLocation()` 返回 **(700, 620)** = `720 − 100`，`e.getUILocation()` 返回 (1296.94, 1148.72) ⇒ **两者均为左下原点**；三坐标点全符合同一关系 `(480,545)→175`、`(480,175)→545`、`(700,100)→620`。② 给 `app.input.push` 打桩 ⇒ 该值**原样**进入 `InputManager`。③ 端到端反证：托盘槽 0 在页面可见位置 y≈545，但**点页面 (480,175) 才选中它**（`traySelected=0`、`slot0='selected'`），点可见位置 (480,545) 无任何反应。
- **根因定位**：`packages/framework/src/adapters/cocos/bindings.ts` 的 `readTouch()`（L264-268）直接透传 `getLocation()`，而 `_bindInput()` L205-212 的注释断言「`getLocation()` 是 top-left origin」。实际 `getLocation()` 是**左下原点**，而 `Viewport.screenToDesign` 自身还做一次 y 翻转 ⇒ 两次假设叠加成镜像。
- **历史归因（不得回避）**：`memory/2026-09-13.md:144` 记录当时「readTouch 弃用 getUILocation 改用 getLocation（符合 RawPointerInput **左上**原点契约）；**删 mapPoint 的 y 翻转**」。该结论的验证只用了 breakout 的**挡板跟手——挡板只吃 x，x 对 y 翻转不敏感** ⇒ 语义从未被 y 敏感场景锁过。`docs/engine-reference/cocos/VERSION.md:130` 曾把该翻转标为「猜测性，必须验证后修正」，该验证欠账即本单。
- **连带**：`docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md` 把 `bindings.ts L204-213` 那句错误断言作为**坐标契约的引用依据之一** ⇒ 与实测直接矛盾，本单须一并订正。
- **Deliverables（严格两阶段，A 未完成不得进 B）**：
  - **A 阶段（锁语义，先做）**：① 给出 `getLocation()` / `getUILocation()` / `getStartLocation()` 在 **Cocos web-mobile（浏览器）** 宿主的原点语义结论（有实测支撑，非引文档猜）；② 写明**微信小游戏 runtime** 宿主的语义——**无真机 ⇒ 如实标阻塞，禁止凭推测定写**；③ 产出**一条可机械执行的断言/测试**锁死该语义，且该断言**在今日代码下必须失败**（否则等于没锁）；④ 给出「修好」的判据（点可见位置即命中、y 不再镜像）；⑤ **解释** 2026-09-13 那条「删翻转 ⇒ 与 screenToDesign 双重翻转相消」的结论为何与本次实测矛盾（二者必有一误，须给出证据与理由，不得含糊带过）。
  - **B 阶段（改码，A 通过后才动）**：⑥ 修 `readTouch` / `_bindInput`（或程基岩判断的等价位置），使 Cocos 宿主落点正确；⑦ 补/改测试锁死，防回退；⑧ 订正 **ADR-0011**（按其 ADR 写作规范判断是修订正文还是另立 ADR，诚实写负面后果）；⑨ 回传时附**重建产物后的复跑证据**（见下）。
- **复现 / 验证通路（主理人已跑通，直接复用）**：`pnpm --filter @wxgame/beads run build:cocos:web` → `python3 -m http.server 8091 --directory games/beads/cocos/build/web-mobile` → `playwright-cli` 开 `http://127.0.0.1:8091/`；句柄 = `cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot').getComponent(cc.js.getClassByName('BeadsBootstrap'))._app`（`App.game` / `App.viewport` 均 public）。**注意**：现有产物 mtime `2026-09-15 08:48`，改码后**必须先重建产物再取证**，否则验的是旧产物。
- **Output Path（只准写这些）**：`packages/framework/src/adapters/cocos/bindings.ts`（及 `input-bridge.ts` 如需）、`packages/framework/tests/**`、`docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md`（及如另立新 ADR 则新文件）。
- **禁改**：`games/beads/src/**` 玩法逻辑、`systems-index §3` 冻结常量、`production/**`（台账回填由主理人执笔）、`dev/harness/**` 坐标（harness 侧映射实测正确，不是本单范围）。
- **范围边界（重要）**：本单**只修 y 镜像**，**不修** BD-34（`_readInput` 仅在 `_stepPlaying` 内、面板相位不读输入 —— 已占位 **WXG-T-100**，用户此前拍板本轮不动码）。两者观感相似（都是「点了没反应」）但**相互独立**；本单实测中 `_readInput` 调用数在 `playing`=260 / `game-over`=0 属 BD-34 现象，**不得并入本单结论**。
- **约束**：遵守 L1–L5；`packages/framework/src/core/**` 禁 `cc`/DOM（本单改动在 `adapters/` 层，注意别把 `cc` 依赖漏进 core）；禁 `Math.random()`；**先问再写**——落盘前确认路径，无用户指令不 commit/push。
- **必读 skill（开工前先 Read）**：`my-skills/wxgame-adr-arch/SKILL.md`（本单含 ADR 订正，必须）；若需拆 Story 则加 `my-skills/wxgame-epic-split/SKILL.md`。另读 `docs/architecture/control-manifest.md`（L1–L5）与 `docs/agent/cocos-setup.md §13`。
- **阶段 A 完成记录（2026-09-15，程基岩回传 + 主理人独立复核）**：落盘 `packages/framework/tests/adapters/cocos-touch-origin-contract.test.ts`（5 例；**3 绿 / 2 红，红灯为刻意**——主理人已独立复跑确认）。五条结论：① `getLocation()` = 画布相对 · **device px（× min(dpr,2)）· 左下原点**（`x=(clientX−rect.x)×dpr`、`y=(rect.y+rect.height−clientY)×dpr`）；`getStartLocation()` 同空间；`getUILocation()` = 设计单位 · 左下原点 · 量纲 dpr 无关但**不减信箱偏移**（引擎 FIXED_HEIGHT ≠ 框架 contain）⇒ 不可当设计坐标用。② 微信 minigame 宿主源码 `pal/input/minigame/touch-input.ts:86-90` 同形，但**无真机 ⇒ 标 `[R]` 阻塞，未定写**。③ 机械断言已落盘且今日必红。④ 修复判据 R1–R5 已写。⑤ 2026-09-13「删翻转」结论的误因 = 把「画布相对（真）」外推成「左上原点（假）」，挡板只吃 x ⇒ 判别力为零，且当时 dpr=1 使 ×dpr 同时隐身。
- **⚠️ 阶段 A 连带发现（升级本单严重度）**：`getLocation()` 还 **×dpr**，而 `Viewport` 是 CSS px ⇒ **真机（dpr≥2）上 x 也被放大 2 倍**，点屏幕右侧即越界出屏。`page(200,300)@393×659/dpr3→封顶2` 实测 `getLocation=(400,718)`。即真机**两轴全错**，不止 y 镜像。与当年 harness 的 GAP-07 同类（`clientX*dpr` 送进 CSS px viewport）。
- **用户裁定（2026-09-15，四项全采推荐项）**：**Q1 = A** y 与 ×dpr **一起修**（同一处代码；只修 y 则真机仍不可用）；**Q2 = A 甲** 抽纯函数 `normalizeCocosTouch`（可在 Node 做真正的行为测试，根治「判别力为零」）；**Q3 = A** **修订 ADR-0011 正文**（决策主体「屏幕坐标 = CSS px」未被推翻，仅事实断言错；新增「宿主归一化契约」一节）；**Q4 = A** **接受那两条红灯到阶段 B 结束**（最诚实；代价是 framework 包测试在此期间红，牵动 CI/verify 汇总，须在回传中点名）。
- **阶段 B 派发（2026-09-15 放行）**：范围 = 归一化同时处理 **y 翻转** 与 **÷dpr**；改 `bindings.ts` / 新增纯函数模块；把源码级断言换成 **Node 行为测试**；阶段 B 结束时**两条红灯必须转绿**；修订 ADR-0011；重建 web-mobile 产物后复跑 R1/R2/R3 取证。仍**禁改** `games/beads/src/**` 与 `systems-index §3`；仍**不含** BD-34（WXG-T-100）。
- **阶段 B 完成记录（2026-09-15，程基岩回传 + 主理人独立复核）**：新增 `packages/framework/src/adapters/cocos/touch-normalize.ts`（纯函数、零 `cc` 依赖、`x/dpr` 与 `canvasHeightCss − y/dpr`）；`bindings.ts` 的 `readTouch()` 改调纯函数并订正三处错误注释（含**超出派单列举的第三处** `_fitToGameCanvas()` 头注释 —— 主理人认可，留着就是下一个陷阱）；新增 `tests/adapters/cocos-touch-normalize.test.ts`（9 例 Node 行为测试）并让 `cocos-touch-origin-contract.test.ts` 的两条源码级红灯**退役**；ADR-0011 订正正文 + 新增 **§3(e) 宿主归一化契约** + §4.2 负面后果。**主理人独立复核**：framework **28 文件 / 267 例全绿**；`check:arch` OK；`pnpm run verify` = **PASS 13 ｜ SKIP 1（check:size 未覆盖）｜ FAIL 0**；产物含新模块。**端到端 R1 复证（主理人自跑，修复前后完全反转）**：点可见位置 (479,497) ⇒ `_pointer=(76.7,413.2)`、`traySelected=0`、`slot0='selected'`；点镜像位置 (479,223) ⇒ `_pointer=(76.7,920.8)` 落进拼图区、不命中。数据流同反转（push y = pageY）。
- **主理人探针缺陷 s4（诚实自查）**：首次复证用坐标 (78,325) 得「仍不命中」，实为**托盘已被并行会话上移** —— `tuning.ts:29` 现为 `TRAY_BAND={230,450}`、槽心改**贴带上沿** `450−12−24=414`。已核对**非漂移**：`systems-index.md:80` 已是 `y∈[230,450]`（**v1.20 上沿 420→450**）、`:118` 注明「垂直贴上沿」，均已提交 ⇒ §3 真源与代码一致、程序合规；是我的常量陈旧。
- **收尾裁定（2026-09-15，四项全采推荐项）**：**① `[R]` 真机 = A** 接受现状（web 实测 + minigame 源码同形），真机首验须把「点击落点 / 托盘选中 / dpr 缩放」列为 **P0 检查项**并附打屏日志；**② BD-33 = A 不关闭**，只登记本轮新事实（CLI 构建会自动补 `.ts.meta`，但只跑 `framework:sync` 不构建仍缺 ⇒ 原场景未消除）；**③ = A** 另派单给程基岩把宿主归一化契约加进 `control-manifest`（= **WXG-T-105**）；**④ = A** 派严守真固化 R1/R2/R3 取证 + breakout `[B]` 目视（= **WXG-T-106**）。
- **本单收尾状态**：✅ 阶段 A + B 全部完成并复核；**红灯期已结束**（2026-09-15 起 framework 包测试曾为红，期间 CI/verify 汇总不可作回归信号，现已转绿）。残余：`[R]` 真机未验（已按 ① 接受 + 列 P0）；BD-34 不属本单。未 commit、未 push。

## WXG-T-107

- **名称**：**宿主归一化契约入控制清单（control-manifest §17）**
- **负责**：程基岩(engineering-lead)　**状态**：📋 已立项（待施工）
- **背景**：WXG-T-104 把「宿主必须把原始触摸事件归一化成 **CSS px + 左上原点** 再交给 `Viewport`」写进了 `ADR-0011 §3(e)`，但**没有进 `docs/architecture/control-manifest.md`**。控制清单是 L1–L5 工程铁律的落点，新契约不进去就会重演「注释对了、清单没写 ⇒ 后人照旧踩」的坑 —— 本单缺陷 C1 本身就是这个模式的产物（2026-09-13 那条错误断言只活在代码注释与 ADR 引用里）。
- **Deliverables**：① 在 `docs/architecture/control-manifest.md` 新增 **§17 宿主输入归一化**（编号若已被占用则顺延并回传说明）；② 内容须覆盖：宿主 adapter 负责 ÷dpr 与 y 翻转、**不得**把引擎原生事件坐标直接喂 `InputManager`、`Viewport` 只接受 CSS px + 左上原点、新宿主接入时必须补一条**行为测试**（禁止只写源码级正则断言）；③ 与既有 L1–L5 编号体系不冲突，并在文中指回 ADR-0011 §3(e)；④ 诚实写入该约束的**负面后果**（如：新增宿主漏做归一化时症状是「点击整体偏移/镜像」，不易第一时间定位）。
- **Output Path**：`docs/architecture/control-manifest.md`（**唯一落盘文件**）。禁改 `packages/framework/src/**`、`games/**/src/**`、`systems-index §3`、`production/**` 除本小节外的一切。
- **权威来源**：`docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md`（尤其 §3(e)）> `production/TASKS-DETAIL.md` 的 `## WXG-T-104` 小节 > `packages/framework/src/adapters/cocos/touch-normalize.ts`。
- **必读 skill**：`my-skills/wxgame-adr-arch/SKILL.md`；另读 `AGENTS.md`、`docs/architecture/control-manifest.md`。
- **约束**：先问再写；不发明 §3 未冻结数值；不 commit/push。
- **完成记录（2026-09-15，程基岩落盘 + 主理人独立复核）**：`docs/architecture/control-manifest.md` 新增 **`## 17. 宿主输入归一化（ADR-0011 §3(e)，根因 缺陷 C1）`**（L251–305），四条硬要求（禁原生坐标直喂 / 归一化归 adapter 且 ÷dpr+翻 y 必须同时做 / `Viewport` 只吃 CSS px·左上原点且 `screenToDesign` 翻转非"重复" / 纯函数 + Node 行为测试且新宿主同形态复刻）+ 两条 ⚠️（DPR 须显式注入否则无头 CI 断言恒真失效；微信 `[R]` 未实测、真机首验列 P0）+ 四条负面后果，全部可追溯 ADR-0011 §3(e)/§4.2。**交叉引用 4 处**（原计划 3 处，程基岩顺带补第 4 条同类反模式）：§6 输入（L94）、§12 自查表（L170）、§13 反模式两行（L193 直喂 `getLocation()`、L194 用正则锁 y 翻转语义）。**主理人复核**：`grep` 确认 §17 与 4 处引用均在；`check:arch` = OK — no violations；成员自证 `check:links` OK（agents=7 skills=17）、framework 行为测试 9 例通过。**未 commit / 未 push。**
- **⚠️ 本轮真实发生的工程事故（须沉淀）**：程基岩在**同一文件**做多处改动时，§6 那行交叉引用**首次写入被同文件后续写入覆盖**，落盘后 `grep` 才发现并补回。⇒ 同文件多处改动须**串行编辑 + 落盘后逐条 grep 校验**（本次已执行，4 处全在）。该现象与 `memory/2026-09-13.md:100` 记录的「Edit 报成功但未落盘（并行写竞争）」同族。
- **主理人疏漏（认错）**：首轮派单只给了 Output Path、**漏写「用户已批准写入」这句授权**，导致程基岩按「先问再写」停住未落盘（多花一轮）。纪律：派单给非 readonly 成员时，若期望其落盘，**必须显式写授权句**。
- **成员遗留未决问题（待拍板）**：**Q1** §17 是否升格（推荐 A 维持：独立节 + 交叉引用；B 补进 §0 铁律表下；C 进 `AGENTS.md §3` 摘要表）；**Q2** 是否把「新宿主必须有行为测试」做成 CI 守卫（推荐 **C**：先做 warn 级观察一轮，第二个宿主出现前 fail-closed 易成噪声）；**Q3** minigame 侧 `[R]` 处理（推荐 A 不立新单，等真机并入首验 P0；备选 B 派单做 `pal/input/minigame/touch-input.ts` 源码级同形比对，约半日，**不解除 `[R]`**）；**Q4** 索引同步（推荐 A：`pnpm run ctx:build` 自动吸收）。

## WXG-T-108

- **名称**：**Cocos 输入取证固化：R1/R2/R3 可复跑 + breakout `[B]` 目视**
- **负责**：严守真(quality-lead)　**状态**：📋 已立项（待施工；**用户已批准写入 `production/qa/beads/`**）
- **背景**：WXG-T-104 修掉了 Cocos 宿主的 **y 轴镜像 + ×dpr**（缺陷 C1），判据 R1（点可见位置命中托盘槽）/ R2（`InputManager.push` 收到的 y ≈ 页面 pageY）/ R3（dpr=1/2/3 封顶 2 下同一可见点均命中）由主理人**临时**跑通并复证，但目前**没有可复跑的固化脚本**；breakout 侧只到数据流层，**`[B]` 目视（挡板跟手）未做**。⇒ 下次回归仍靠人肉，同类缺陷还会漏。
- **Deliverables**：① 把 R1/R2/R3 做成**可复跑脚本**（落 `production/qa/beads/`，同目录既有 `g4-probe*.mjs` 可参考其证据落盘与自证风格）；② 脚本须**自带断言与退出码**（红=失败，禁止「跑了但没判」）；③ 补 breakout 的 `[B]` 浏览器目视道次（挡板跟手 + 点击落点），记录取证方式与截图；④ 明确标注**哪些道次本环境做不了**（`[R]` 真机需 AppID + 真机），不得记为通过。
- **环境事实**：✅ Cocos 3.8.8 CLI 与 web-mobile 构建可用、playwright-cli 可用；⛔ 无 AppID（wechatgame 平台构建阻塞）、⛔ 无真机 ⇒ `[R]` 一律标阻塞。
- **Output Path**：`production/qa/beads/`（脚本 + 证据日志 + 截图）。禁改 `packages/framework/src/**`、`games/**/src/**`、`systems-index §3`、`docs/**`。
- **权威来源**：`production/TASKS-DETAIL.md` 的 `## WXG-T-104` 小节（含 R1/R2/R3 原始判据与主理人复证实测数字）> `packages/framework/src/adapters/cocos/touch-normalize.ts` > `docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md`。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`；另读 `AGENTS.md`、`production/qa/beads/smoke-tests.md`。
- **约束**：严守真默认 **readonly**，本单**已获用户批准**写入 `production/qa/beads/`，不得越界写其他目录；不 commit/push；不得把 ⛔ 记为 PASS。
- **残留（不得归零）**：① **A05-09 本体仍 ⛔** —— 探针与 `test-cases` 需按新主体同改后复跑（成员无 `production/**` 写权限），已登 backlog，与 T-102 的 P4 复跑同批；② `audio-spec §9` 判据总数 27→28（含 A05-09b），QA 侧若不接受 `b` 后缀需整体重排（成本高，已否）。

### 完成记录（严守真 quality-lead，2026-09-15 · 证据已固化 · **未 commit / 未 push**；状态行与台账主表由主理人回填）

**① 落盘清单**（全部在已批准的 Output Path `production/qa/beads/` 内，未越界）

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `production/qa/beads/cocos-input-probe.mjs` | **新增** | 可复跑探针（R1/R2/R3 + 宿主语义 + breakout `[B]`）。**自带断言与退出码**：`0` 全绿 ｜ `1` FAIL ｜ `2` 无 FAIL 但有未预期阻塞/探针无效 ｜ `3` 脚本级环境错误。预期值写在文件头（**先写后跑**），含 `SELF-01` 判据自检 |
| `production/qa/beads/evidence/cocos-input-probe.log` | **新增** | 本轮实跑证据日志，每条含「预期（先写）/ 实测」 |
| `production/qa/beads/evidence/cocos-input-beads-{base,dsf2,dsf3}-{A-base,C-mirror,B-visible}.png`（9 张）+ `cocos-input-beads-dsf1-500x1000-*.png`（3 张） | **新增** | beads `[B]` 目视：三档 dpr × 三态（基态 / 点镜像 / 点可见）+ 500×1000 信箱档 |
| `production/qa/beads/evidence/cocos-input-breakout-dsf{1,2}-x{300,600}.png`（4 张） | **新增** | breakout `[B]` 目视：挡板跟手两位置 × 两 dpr |
| `production/qa/beads/evidence/cocos-input-probe-g1g2-subset.log` | **新增** | 支撑证据（见 ③） |

**② 实跑结果（第 5 次复跑，本地 2026-09-15 21:50；**退出码 0**；PASS 18 ｜ FAIL 0 ｜ ⛔ 2（已声明阻塞道次））**

| 用例 | 道次 | 结果 | 实测数字（节选） |
| --- | --- | --- | --- |
| ENV-01/02 产物新鲜度 + 镜像一致 + 产物含归一化函数 | `[N]` | ✅ | 产物 `assets/main/index.js` mtime `21:01:42.656`（beads）/ `21:14:29.535`（breakout）均晚于源最新 `21:01:16`；`framework:sync:check` exit=0；产物内 `normalizeCocosTouch` 命中 **9** 次 ⇒ 验的确实是**修复后**产物 |
| SELF-01 判据自检（反假绿） | `[N]` | ✅ | 把 T-104 A4 记录的**修复前**数字喂同一批判定函数 ⇒ `judgeHost/judgeR1/judgeR2/judgeR3` **全部返回不通过** ⇒ 探针有判别力，非「跑了但没判」 |
| HOST-01/02/03 宿主语义（dsf 1/2/3） | `[N]` | ✅ | `getLocation()`：dsf1 `raw=(479,223)` = 式 `(479,223)`；dsf2 `raw=(958,446)`；dsf3（window dpr **3** / 引擎封顶 **2**）`raw=(958,446)`；三档 Δ=(0,0)。反证：与「左上原点」式差 **274 / 548 / 548 px** ⇒ 左下原点 + device px 成立 |
| HOST-03b 封顶口径反证 | `[N]` | ✅ | 用**未封顶** window dpr=3 套同一恒等式 ⇒ Δy=**223px**，判定函数**正确否决** ⇒ 「dpr 必须与输入源同源」被锁死 |
| R1-01 + R1-02（端到端 + 反证） | `[N]` | ✅ | 点可见点 `(478.6,496.6)` ⇒ `traySelected=0`、`slot0='selected'`、`_pointer=(76.70,413.17)` vs 槽心 `(76,414)`；点**镜像点** `(478.6,223.4)` ⇒ `traySelected=-1`、`_pointer=(76.70,920.83)`（离槽心 **506.8** 设计 px）⇒ 修复前后行为完全反转 |
| R2-01 数据流 | `[N]` | ✅ | 两次点击 `push(down)=(479,223)` / `(479,497)` vs 页面相对 Δ=**(0.4,0.4)**；反镜像 guard：与旧式 `canvasH−pageY` 相差 **273.6px** |
| R1-03 + R1-04（500×1000 信箱） | `[N]` | ✅ | `scale=0.6667`、`offsetY=55.33`（>0）；可见点 `(50.7,668.7)` ⇒ 命中；镜像点 `(50.7,331.3)` ⇒ `-1` |
| R3-01 dpr 不变性 | `[N]` | ✅ | 三档同一页面点 ⇒ `push=(479,497)` **完全一致**（两两差 **0.0px**）；`raw.x` = 479 / 958 / 958 = `page×dpr` ⇒ ÷dpr 真被行使（修前 dsf≥2 为 `(958,994)`） |
| R3-02 / R3-03（R1 端到端 @ dsf2 / dsf3） | `[N]` | ✅ | 两档均「可见点命中 / 镜像点不命中」 |
| B-01 `[B]` 镜像点像素反证 | `[B]` | ✅ | 托盘槽行（屏幕行 `487..507`）内点镜像点前后 **changedPixels=0** |
| B-02 `[B]` 可见点像素命中 | `[B]` | ✅ | changedPixels=**181**，变化簇 `x∈[467,491]`（宽 25，**簇心 479.0**）vs 点击点屏幕 x=478.6 ⇒ 渲染层与命中层同位 |
| BR-01 breakout 数据流 | `[N]` | ✅ | dsf1 / dsf2 均 `push=(366,510)` = 页面坐标，两档差 **0.0px**（修前 dsf2 应为 `(732,510)`） |
| B-03 `[B]` 挡板跟手（模型） | `[B]` | ✅ | 点设计 x=300 / 600 ⇒ `paddle.x=299.41 / 599.56`（Δ=0.59 / 0.44 设计 px）、`phase=playing` |
| B-04 `[B]` 挡板像素级 | `[B]` | ✅ | 挡板带（行 `502..518`）亮像素簇心 **365.5 / 500.5** vs 期望 366.3 / 501.2（Δ=0.7 / 0.7）；位移 **135.0px** vs 期望 设计位移×scale=**134.9px** |
| DEV-01 `[R]` 微信小游戏宿主 | ⛔ | ⛔ | **未实测**（无 AppID、无真机）。解除条件：① 有效 AppID；② `build:cocos:wx` 出包；③ 微信开发者工具/真机；④ 用同款探针在 `wx` 宿主复取三 accessor 与 push 值。真机首验须把「点击落点 / 托盘选中 / dpr 缩放」列 **P0**（ADR-0011 §4.2(10)） |
| DEV-02 wechatgame 平台构建 | ⛔ | ⛔ | 缺 AppID ⇒ 上条前置不成立 |

**③ 支撑证据（G1/G2，只读子集）**：`node tools/scripts/verify-all.mjs --steps=check:arch,typecheck,framework:sync:check,test` ⇒ **PASS 4 ｜ SKIP 0 ｜ FAIL 0**；单测 framework **267** + breakout **239** + beads **238** = **744 例全绿**（62 文件）。
⚠ **未跑**全量 `pnpm run verify`（14 项）：其 `harness:build` / `check:size` 等会写 `dev/harness/dist` 等**本单 Output Path 之外**的路径 ⇒ 按只读纪律不跑，全量门由主理人/工程侧复跑。

**④ 探针口径与踩坑（供复用）**
- 槽心**不硬编码**：用游戏自身 `_hitTraySlot` 在 4px/2px 网格扫 bbox 现算（槽 0 实测 bbox `x[48,104] y[384,444]` ⇒ 槽心 `(76,414)`），再经 `viewport.designToScreen` 得屏幕点 —— 托盘位置若再变（v1.20 已上移过一次）不会脱靶。
- 前置两条：必须 `phase==='playing'`；**槽 0 必须持珠**（空槽 `select()` 恒 `'invalid'`，T-104 已记录的坑）。探针用 `giveTrayBead(1)` 补珠（只影响槽内容，不碰坐标逻辑）。
- `mousemove` **不放进 for 循环**；每次点击独立 `move→down→up`。`[B]` 像素分析**在浏览器内解码 PNG**（`createImageBitmap` + `OffscreenCanvas`），不引第三方依赖。
- 改码后必须**先重建产物**：`ENV-*` 门会拦陈旧产物 / 镜像未同步 / 产物不含归一化函数（本轮两次实跑都因此挡住过，属设计内行为）。
- 复跑命令：`node production/qa/beads/cocos-input-probe.mjs`（自带启停 `python3 -m http.server`；端口被占用且标记不符时会换端口，不会验错对象）。
- 未覆盖：① **画布不铺满窗口**的 CSS 布局（本产物 canvas 恒 100% 铺满，`rect=(0,0)`）；② 触屏事件序（`hasTouch`，本探针走真实 **mouse** 事件；Cocos mouse 源同样 ×dpr，已在 HOST 用例中实证）；③ 真机 dpr 无 2 封顶这条差异（见 DEV-01）。

**⑤ 残留 / 不得归零**：⛔ `[R]` 真机（DEV-01/DEV-02）仍为阻塞，**不得记 PASS**；本单零 `src/**` 改动、零 `systems-index §3` 改动。

---

### 阶段 A 交付（程基岩 engineering-lead，2026-09-15，实测取证完成 · **未落任何 `src/**` 改动**）

> 权威说明：以下全部数字来自**本人在真实 Cocos web-mobile 产物上跑出来的实测**（不是文档推断）。
> 产物沿用 `games/beads/cocos/build/web-mobile`（mtime `2026-09-15 08:48`）而非重建：本阶段**零 `src/**` 改动**，
> 且已用 mtime 比对该产物晚于全部输入链路镜像源（最新 `bindings.ts` = `2026-09-14 20:40`）⇒ 产物含当前代码。
> ⚠ 现有工作树有 T-102 等在改的 `games/beads/src/{config/tuning.ts,view/view-model.ts}`，
> `framework:sync:check` 现为红 ⇒ `build:cocos:web` 被前置检查拦住（见 A6 注意事项）。

#### A1 · 语义结论（Cocos web-mobile / 浏览器宿主，**实测**）

**`getLocation()` = 画布相对 · device px（× dpr）· 左下原点**；`getStartLocation()` 同空间（touch-start 时数值与 `getLocation()` 相同）；
`getUILocation()` = 设计单位 · 左下原点 · dpr 无关，但**不减信箱偏移**，且属**引擎 FIXED_HEIGHT 空间**（≠ 框架 `Viewport` 的 contain 空间）。

三组宿主配置、7 个采样点（页面坐标 = 原生 `pointerdown` 的 clientX/clientY，与 Cocos accessor 同帧对照）：

| 宿主配置 | dpr(引擎) | fit(scale/offsetX/offsetY) | page | `getLocation()` | `getUILocation()` | 到达 `InputManager` |
| --- | --- | --- | --- | --- | --- | --- |
| 1280×720 canvas 铺满 | 1 | 0.539730 / 437.601 / 0 | 700,100 | **700,620** | 1296.94,1148.72 | 700,620 |
| 〃 | 1 | 〃 | 480,545 | **480,175** | 889.33,324.24 | 480,175 |
| 〃 | 1 | 〃 | 480,175 | **480,545** | 889.33,1009.76 | 480,545 |
| 〃 | 1 | 〃 | 200,300 | **200,420** | 370.56,778.17 | 200,420 |
| 〃 | 1 | 〃 | 900,650 | **900,70** | 1667.50,129.69 | 900,70 |
| 500×1000（offsetY>0） | 1 | 0.666667 / 0 / **55.333** | 250,150 | **250,850** | 333.50,1133.90 | 250,850 |
| iPhone15 模拟 393×659 | 3（引擎封顶 **2**） | 0.494003 / 11.249 / 0 | 200,300 | **400,718** | 404.86,726.72 | 400,718 |

恒等式（全部样本吻合，容差 ≤1 px，Cocos 取整）：
`x = (clientX − rect.x) × dpr`、`y = (rect.y + rect.height − clientY) × dpr`，其中 `dpr = min(window.devicePixelRatio ?? 1, 2)`。
⇒ **左上原点假设与本式相差整屏高度**，判别力为满屏，非边缘差。

引擎源码互证（Cocos 3.8.8，本机 `/Applications/Cocos/Creator/3.8.8/.../resources/3d/engine` 与产物 `cocos-js/cc.js`）：

- web 触摸源（`cc.js` L40348-40359）：`x = touch.clientX - canvasRect.x; y = canvasRect.y + canvasRect.height - touch.clientY; … x *= dpr; y *= dpr;`
- `Touch.getLocation()` 直返 `_point`；`getUILocation()` = `_point` 再经 `view._convertToUISpace()`。
- 实测 `view`：设计分辨率 750×1334，但 500×1000 下 `getScaleX/Y = 0.749625`、`visibleSize = 667×1334` ⇒ 引擎按 **FIXED_HEIGHT** 适配，与框架 `Viewport` 的 contain（`scale 0.6667` + offsetY 55.33）**不等价** ⇒ `getUILocation()` **不可当作框架设计坐标使用**。

**⚠ 连带发现（超出 y 镜像的第二处偏离，见 Q1）**：`getLocation()` 还是 **device px**（×dpr），而 `Viewport` 屏幕空间是 CSS px（`_fitToGameCanvas()` 用 `canvas.clientWidth/Height`）。实测：同一页面点在 dpr=1 下 push `(478,175)`，dpr=2/3 下 push `(956,350)/(400,718)` ⇒ **真机（dpr≥2）上即使修好 y，x/y 仍整体放大 2 倍，玩法照样不可用**。

#### A2 · 微信小游戏 runtime 宿主（**阻塞，禁止定写**）

- **已读源码（非实测）**：`pal/input/minigame/touch-input.ts:86-90` = `x = touch.clientX * dpr; y = windowSize.height - touch.clientY * dpr;` —— 与 web **同形**（左下原点 + ×dpr）；`pal/screen-adapter/minigame/screen-adapter.ts:71-78`：`dpr = minigame.getWindowInfo().pixelRatio`（**无 web 侧的 2 封顶**）。
- **结论**：预期同为「左下原点 + device px」，但 **⛔ `[R]` 阻塞 —— 无 AppID、无真机，未实测，不得写为已验证**。
- **解除条件**：① 有效 AppID 且 `pnpm --filter @wxgame/beads run build:cocos:wx` 出包；② 微信开发者工具或真机可跑；③ 用 A6 同款探针在 `wx` 宿主复取三个 accessor 与 push 值。

#### A3 · 机械断言（已落盘，**今日必红**）

文件：`packages/framework/tests/adapters/cocos-touch-origin-contract.test.ts`（新增，vitest，Node，不 import `cc`）
实测结果：`Tests 2 failed | 3 passed (5)`；`pnpm -F @wxgame/framework test` 全量 `2 failed | 258 passed`（**只有本单刻意红灯，无其他回归**）；`npx tsc --noEmit` 绿。

- 绿（今日通过）：① 7 个样本逐点校验 `x=(page.x)·dpr`、`y=(canvasH−page.y)·dpr`，并断言**不是**左上原点；② y 与页面坐标反向 / x 同向（左下原点定向判据）；③ 镜像算术（真值 1148.72 与透传值 185.28 之和 = 1334）。
- **红（今日必红 = 锁住语义）**：④ `readTouch()` 不得再 `y: p.y` 原样透传，且必须显式引用可翻转 y 的高度量；⑤ 源码不得再断言 `getLocation()` 为 top-left origin（现 L206-212 / L258-262 两处均命中）。
- ⚠ ④⑤ 是**源码级契约测试**（`bindings.ts` 静态 import `cc`，Node 不可编译，只能扫源码），属临时形态；阶段 B 若采 B1 甲（抽纯函数），应被真行为测试取代。

#### A4 · 修复判据（可机验）

- **R1 端到端（决定性）**：取托盘槽 i 的设计中心 P（用游戏自身 `_hitTraySlot` 在 4px 网格扫 bbox 取中），`S = viewport.designToScreen(P)`；在页面点 **S** ⇒ 必须 `traySelected === i`。**今日实测（槽 0，P=(76,324)，S=(478.62,545.13)）：点 S ⇒ `traySelected = -1`、`_pointer = (74.85,1009.76)`（镜像值）；点 (478.62,174.87) ⇒ `traySelected = 0`、`slot0.state = 'selected'`。**
- **R2 数据流**：`app.input.push` 记录到的 `y ≈ pageY − rect.y`（±1.5 px）。今日 = `canvasH − pageY`。
- **R3 dpr 不变性**（若 Q1 选一起修）：dpr=1 与 dpr=2/3 上下文点同一页面点 ⇒ push 值相同（±1.5 px）。今日 dpr=2 时翻倍。
- **R4 单测**：A3 的两条红灯转绿；若采 B1 甲则新增纯函数行为测试全绿。
- **R5 无回归**：`pnpm run verify` 全绿；harness（`dev/harness/**`）不经 `bindings.ts`，不受影响，须复跑确认。

#### A5 · 2026-09-13 结论为何与本次实测矛盾（二者必有一误 ⇒ 误在前者）

1. 那次结论由两句话组成：(i)「getLocation 是**画布相对**（页面 600 → 335）」—— **真**（引擎源码 `clientX − canvasRect.x` 佐证，本单三配置的 canvas 恰好铺满窗口故不可再区分）；(ii)「因此符合 RawPointerInput **左上原点**契约」—— **假**。
2. (i) 的证据是一个**平移**偏移，(ii) 需要的是**定向**证据。**平移证据对 y 翻转完全不敏感**，用它推出定向结论属越界外推。
3. 当时唯一验证手段是 breakout 挡板跟手，而**挡板只吃 x**；实测 x 在两种假设下完全相同（`page.x 480→480`、`700→700`、`200→200`）⇒ 该验证对 (ii) 的**判别力为零**。且当时是桌面 Chrome dpr=1 ⇒ 连 ×dpr 那一半偏差也同时隐身。
4. 「删 mapPoint 的 y 翻转」在借来的假设下自洽，而 `VERSION.md:130` 自己标过该翻转是「猜测性，必须验证后修正」⇒ 一次猜测被固化进**代码 → 注释 → ADR-0011 引用依据**三级放大。
5. 判据：本次 3 配置 7 采样点全部满足 `y = (canvasH − pageY) × dpr`，与左上原点假设差**整屏高度**；并在 `playing` 相位端到端复现「点可见位置不中、点镜像位置中」。⇒ **误在 2026-09-13 那条结论及引用它的注释/ADR 依据**，本单不为其圆场。
6. 沉淀候选（供主理人决定是否入 `knowledge/`）：**「平移证据不能外推定向结论；锁坐标语义必须用 y 敏感场景 + 至少两个 dpr 档位」**。

#### A6 · 最小复现法（已跑通）

```bash
# 0) 前置：镜像必须与源码一致，否则构建被拦（当前工作树因 T-102 在改 beads src 而是红的）
pnpm run framework:sync:check          # 红则先 sync 或等镜像干净
# 1) 构建（已有产物且本阶段零 src 改动时可跳过，但须先核 mtime：产物须晚于镜像源）
pnpm --filter @wxgame/beads run build:cocos:web
# 2) 静态服务
python3 -m http.server 8091 --directory games/beads/cocos/build/web-mobile
# 3) 打开（playwright-cli 在受管 workspace）
export PATH="$HOME/.workbuddy/binaries/node/workspace/node_modules/.bin:$PATH"
playwright-cli -s=c1 open --browser=chrome http://127.0.0.1:8091/    # 桌面 dpr=1
playwright-cli -s=c1d open --browser=chrome --device="iPhone 15" http://127.0.0.1:8091/   # 真 dpr=3
# 4) 注入探针（取句柄 + 打桩 push + 同帧记录 accessor）
#    app = cc.director.getScene().getChildByName('Canvas').getChildByName('GameRoot')
#           .getComponent(cc.js.getClassByName('BeadsBootstrap'))._app
#    a) canvasNode.on('touch-start', e => 记 getLocation/getUILocation/getStartLocation/getUIStartLocation)
#    b) window.addEventListener('pointerdown', e => 记 clientX/clientY, true)
#    c) const orig = app.input.push.bind(app.input); app.input.push = ev => { log(ev); return orig(ev); };
# 5) 点击并读数：mousemove X Y → mousedown → mouseup（勿放进 for 循环，实测会退化成 (0,0)）
#    end-to-end：先用 g._hitTraySlot(x,y) 在 4px 网格扫出槽 0 的 bbox 取中 ⇒ designToScreen ⇒ 点它
#    读：g._snapshot.traySelected / g._tray._slots[0].state / g._pointer / g._machine.current
# ⚠ 必须 phase == 'playing' 才有输入（game-over/paused 属 BD-34，WXG-T-100，不得并入本单结论）
```

取证痕迹：全部探针只存在于浏览器会话与 `/tmp`（`/tmp/wxg-probe-*.js`），**仓库零改动**；临时静态服务已停。

---

### 阶段 B 方案（**本轮只给方案，严禁落码**，等主理人放行）

#### B1 · 改法与备选比较

- **甲（推荐）· 抽纯函数 + Node 可测**：新增 `packages/framework/src/adapters/cocos/touch-normalize.ts`（**不 import `cc`**）：
  `normalizeCocosTouch(p, canvasCssHeight, dpr, out)` → `out.x = p.x / dpr; out.y = canvasCssHeight − p.y / dpr;`
  `readTouch()` 调它；`dpr` 取**引擎口径** `cc.view.devicePixelRatio`（web 封顶 2 / 小游戏取 `wx` pixelRatio，免得自己复刻封顶规则），高度取 `#GameCanvas.clientHeight`（== `viewport.fit.screenHeight`，因 `_fitToGameCanvas()` 已按它 resize）。
  优点：可真行为单测（取代 A3 的源码级断言）、dpr 口径与引擎同源、零 core 侵入（L2 合规，改动只在 `adapters/`）。缺点：多一个文件。
- **乙 · 改用 `getUILocation()` 反算**：`cssX = uiX · canvasH / designH`、`cssY = canvasH − uiY · canvasH / designH`（实测 dpr 无关）。优点：不碰 dpr。缺点：依赖「引擎设计单位 == 框架 designHeight」的隐式耦合；引擎为 FIXED_HEIGHT 而框架为 contain，窄屏下二者不等价，语义随引擎适配策略演化 ⇒ 脆弱；且 `designHeight` 常量分处两处需同步。**不推荐**。
- **丙 · 最小改动**：`_bindInput()` 里给 `CocosInputBridge` 传 `mapPoint`（该选项已存在且已有测试先例）：`mapPoint: (x,y) => ({x: x/dpr, y: canvasH − y/dpr})`。优点：一行。缺点：映射函数仍不可在 Node 单测；`readTouch` 错误注释仍在需另改；测试只能停在源码级。**次选**。
- 三者都**必须**顺带订正 `bindings.ts` L206-212 与 L258-262 两处错误注释（否则 A3 ⑤ 不转绿）。
- 宿主差异：不打算为 wechat 分叉；甲/丙按引擎同源 dpr 取值即可，真机可得后按 A2 解除条件复验。

#### B2 · 影响面清单

- **宿主**：Cocos **web-mobile**（实测确认）+ Cocos **wechatgame**（源码同形，⛔ 未实测）。`canvas2d` / Node 平台 / `dev/harness/**` **不经 `bindings.ts` ⇒ 不受影响**（harness 映射实测正确，不属本单）。
- **游戏**：`beads` ⇒ **P0**（托盘 / 棋盘 / 按钮全部 y 敏感，今日玩法整体不可用）。`breakout` ⇒ 对 **y 镜像免疫**（挡板只吃 x —— 这正是 2026-09-13 漏检的成因），**但对 ×dpr 不免疫**（x 同样翻倍）；若 Q1 选「一起修 dpr」，breakout 需一并复验。
- **不受影响**：`packages/framework/src/core/**`、`games/*/src`（零玩法改动）、`systems-index §3`（本单**不需要任何新数值**，已确认）。

#### B3 · ADR-0011 处置建议：**修订正文，不另立新 ADR**（理由 + 负面后果预写）

- 理由：被推翻的是 ADR-0011 的**引用依据与一句旁证**，不是**决策主体**。决策主体（屏幕坐标唯一契约 = CSS px top-left；DPR 由 renderer/adapter 承担）不但未倒，反而被本单实测**加强**——正因为输入源给的是 device px，才更需要在 adapter 层归一回 CSS px。另立 ADR 会把「实现违约」讲成「契约变更」，误导后人。
- 拟修订点：① §1.1 表格里 `bindings.ts L204-213` 那条：改注为「该注释为**当时的错误断言**，已被 WXG-T-104 实测推翻（getLocation = 左下原点 device px）；契约不变，违约方是 `readTouch`」；② §3(c) 末「输入全程留在 CSS px」改为「viewport 在 CSS px；**Cocos 输入源在 device px，必须由 adapters 层除以 dpr 归一**」；③ §4.2 增一条负面：ADR-0011 写作时「引擎已在输入侧消化 DPR」属**误判**，代价是真到 WXG-T-104 才暴露；④ §5 增触发条件：真机可得时复核 minigame 的 dpr 口径（无 2 封顶）。
- **负面后果预写**：① ADR-0011 已 Accepted，改正文会让「已冻结裁决」的可信度受损，须在文首加「2026-09-15 修订（WXG-T-104）」时间戳以保留可审计性；② 修订后 ADR-0011 同时含「原判断」与「推翻后的事实」两层叙述，读者需自行分辨哪层有效（用时间戳 + 显式「已推翻」措辞缓解，不能消除）；③ §4.2(1) 那种「明知注释过期却不改」的文档债模式重演风险——故**必须**与改码同批改 `bindings.ts` 注释，不得只改 ADR。
- 备选（若主理人裁定「Accepted 正文不动」）：另立 **ADR-0014「Cocos 输入坐标归一化」** + 在 ADR-0011 顶部加一行指针。负面：坐标契约出现两处真源，后人难判孰为准；且 ADR-0011 §1.1 那条错误依据仍在正文里继续误导（只能靠顶部一行指针，弱）。

#### B4 · 需要补/改的测试清单

1. **新增** `packages/framework/tests/adapters/cocos-touch-normalize.test.ts`（采甲时）：dpr=1/2/3、`offsetY>0`、画布非全屏（`rect.x/y ≠ 0` 构造值）、取整容差；与 `Viewport` 往返（设计点 → `designToScreen` → 归一化反推，误差 <1e-6）。
2. **改** 本单 `cocos-touch-origin-contract.test.ts`：④⑤ 转绿；采甲后把 ④ 换成对 `normalizeCocosTouch` 的行为断言（源码级断言降级或删除），⑤ 保留为「注释不得回退」的守门。
3. **保留** `cocos-input-bridge.test.ts` 现有 `mapPoint` 用例（bridge 本身不做坐标假设，未被本单推翻）；可补一条「bridge 不改写未映射值」。
4. **端到端 `[B]` 道次**：R1/R2/R3 三条做成可复跑脚本（建议落 `production/qa/beads/` 或 `tools/scripts/`，属 QA/主理人域，需另派单）；须附**重建产物后**的复跑证据。
5. **回归**：`pnpm run verify` 全绿 + `node tools/scripts/check-architecture.mjs` + harness 冒烟（证明 canvas2d 路径未受影响）。

#### 阶段 B 未决问题（供用户拍板，2–4 项）

- **Q1（范围）**：是否**顺带修 ×dpr**？ **A)** 一起修（真机 dpr≥2 必坏，推荐，成本≈同一处代码） / **B)** 本单只修 y，dpr 另开单（建议 WXG-T-105） / **C)** 只修 y，dpr 记为已知缺陷直到真机可得（风险：真机出货仍不可用）。
- **Q2（改法）**：甲（抽纯函数，可行为单测，推荐） / 丙（mapPoint 一行，最小面） / 乙（getUILocation 反算，不推荐）。
- **Q3（ADR）**：修订 ADR-0011 正文（推荐） / 另立 ADR-0014 + 顶部指针。
- **Q4（红灯期）**：A3 的两条刻意红灯会让 `pnpm -F @wxgame/framework test` 保持红到阶段 B 结束。**A)** 接受（红灯即欠账，最诚实，推荐） / **B)** 改 `it.fails` 标记（绿但需阶段 B 同步移除，易忘） / **C)** 加 `skip` + TODO（最省事但最易被遗忘）。

---

#### 阶段 B 完成记录（程基岩 engineering-lead，2026-09-15 · 用户四项裁定全采推荐项：Q1=A / Q2=甲 / Q3=修订 ADR-0011 / Q4=接受红灯到本阶段结束）

**① 落盘清单**（全部在放行 Output Path 内）

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `packages/framework/src/adapters/cocos/touch-normalize.ts` | **新增** | 纯函数 `normalizeCocosTouch(raw, {canvasHeightCss, dpr}, out?)`：**同时**做 y 翻转与 ÷dpr；**不 import `cc`**、不碰 DOM/全局 ⇒ Node 可行为测试（甲案的唯一理由） |
| `packages/framework/src/adapters/cocos/bindings.ts` | 改 | `readTouch(e, space)` 调纯函数；`_bindInput` L205-212 与 `readTouch` 头注释 L255-262 两处错误断言**就地订正**；另**顺带**订正第三处同型错误（`_fitToGameCanvas` 头注释称 getLocation 为 CSS px，实为 device px）；新增 `_touchSpace()` 与 `engineDpr()`（取 `cc.screen.devicePixelRatio`） |
| `packages/framework/tests/adapters/cocos-touch-normalize.test.ts` | **新增** | Node 行为测试 **9 例**（见下） |
| `packages/framework/tests/adapters/cocos-touch-origin-contract.test.ts` | 改 | 两条源码级红灯**退役**（行为测试已覆盖）；保留 ①③ 宿主实测台账断言（锁"宿主到底给了什么"，与代码无关） |
| `docs/architecture/adr/ADR-0011-*.md` | 改 | 修订正文（不另立 ADR）：文首修订戳 + §1.1 订正表 + §1.1/§1.5 两处"唯一越界者/不得改 bindings"勘误 + §3(c) 半句订正 + **新增 §3(e) 宿主归一化契约** + §4.1(5) + §4.2(0)(8)(9)(10) + §5(8)(9)(10)(11) |
| 镜像拷贝件 | 由 `framework:sync` 产出 | `games/{beads,breakout}/cocos/assets/scripts/framework/adapters/cocos/touch-normalize.ts`（**未手改**）；`.ts.meta` 由 **Cocos CLI 构建时自动生成**（见 ⑤ 备注） |

**② 红灯期结束声明（Q4=A 的收口）**：阶段 A 的两条刻意红灯**已转绿并退役** ⇒
`pnpm -F @wxgame/framework test` = **28 files / 267 tests 全绿**（改码前 258 passed / 2 failed）；
全仓 `pnpm -r run test` = framework 267 + breakout 239 + beads 238 全绿；
`pnpm run verify` = **PASS 13 ｜ SKIP 1（check:size，未覆盖非失败）｜ FAIL 0**。
⇒ 红灯期自 2026-09-15 起结束，**此前受其牵动的 CI / `verify` 汇总恢复为可信信号**；
且红灯已由"源码级正则"升级为"9 例 Node 行为测试"，不再是判别力为零的守门。

**③ 复跑取证（**先 `pnpm --filter @wxgame/beads run build:cocos:web` 重建产物**，mtime 2026-09-15 21:0x，非旧产物）**
探针 = `cc.director.getScene()→Canvas→GameRoot→getComponent('BeadsBootstrap')._app`，打桩 `app.input.push`；
前置 = `phase === 'playing'` **且** 槽 0 `state === 'holding'`（空槽 `select()` 恒 `'invalid'`，这是本轮踩到的第二个坑，不属本单缺陷）。
同一会话内 A/B：**先点镜像点、再点可见点**。

| 判据 | 1280×720 dsf=1 | 393×659 dsf=1 | 393×659 dsf=2 | 393×659 dsf=3（引擎封顶 2） |
| --- | --- | --- | --- | --- |
| `window.devicePixelRatio` / `screen.devicePixelRatio` | 1 / 1 | 1 / 1 | 2 / 2 | **3 / 2** |
| canvas CSS / backing | 1280×720 / 1280×720 | 393×659 / 393×659 | 393×659 / **786×1318** | 393×659 / **786×1318** |
| 槽 0 设计中心 → `designToScreen` | (76,414) → (478.62, **496.55**) | (76,414) → (48.79, **454.48**) | 同左 | 同左 |
| **R1 点可见位置** | push (478,496) ⇒ `traySelected=0`、`slot0='selected'` | push (48,454) ⇒ `traySelected=0` | push (48,454) ⇒ `traySelected=0` | push (48,454) ⇒ `traySelected=0` |
| **R1 反证：点镜像位置** (`h−S.y`) | 点 (478.6, 223.4) ⇒ `traySelected=-1`（旧行为此处才命中） | 点 (48.8, 204.5) ⇒ -1 | ⇒ -1 | ⇒ -1 |
| **R2 数据流** | push y=496 vs pageY=496.55（Δ≤0.6px；今日之前 = 720−496.55=223.45） | 454 vs 454.48 | 454 vs 454.48 | 454 vs 454.48 |
| **R3 dpr 不变性** | — | (48,454) | (48,454) **一致** | (48,454) **一致**（今日之前 dsf≥2 会翻倍） |
| `_pointer`（设计空间回读） | (74.85, 415.02) ≈ 槽心 (76,414) | (74.39, 414.98) | 同 | 同 |
| 页面错误 | 无 | 无 | 无 | 无 |

⇒ **R1 / R2 / R3 三条全过**；且"点镜像位置不再命中"反证成立（阶段 A 时点镜像才命中）。

**④ 新增行为测试 9 例**（`pnpm -F @wxgame/framework test tests/adapters/cocos-touch-normalize.test.ts`）：
① dpr=1 五个实测样本翻转回页面坐标；② ÷dpr 含 **window dpr=3 / 引擎封顶 2**，并反向锁"用未封顶 dpr=3 必偏离 >60px"；
③ 纵向信箱 `offsetY=55.33` 样本（归一化与信箱偏移无关，`containsScreenPoint` 为真）；④ 边界（左下→屏幕底、左上→屏幕顶）；
⑤ 画布不铺满窗口时只取决于画布内相对位置；⑥ `out` 复用同一实例（热路径零分配）；⑦ dpr 非法（0/NaN/负）退化按 1、不产 NaN；
⑧ 与 `Viewport` 往返（设计点→`designToScreen`→模拟宿主 device px→归一化→`screenToDesign` 回到原点，dpr=1/2 各一遍）；
⑨ 镜像反证（透传值经 `screenToDesign` 后 = 真值关于设计中线的镜像：1148.72 + 185.28 = 1334；归一化后二者重合）。

**⑤ 对本单相关"坑"的补充实测（供后续复用）**
- **BD-33（镜像脚本缺 `.ts.meta`）本轮**未构成阻塞**：`framework:sync` 后新文件无 meta，但 **Cocos CLI 构建时自动生成了**
  `touch-normalize.ts.meta`（mtime 21:01，171B，编辑器产物，**非手编**），产物 `assets/main/index.js` 内 `normalizeCocosTouch` 命中 7 处。
  ⚠ 该结论只对"跑过一次 CLI 构建"的路径成立；若某游戏只 sync 不构建，仍缺 meta —— **BD-33 不因本单关闭**。
- **`screen.devicePixelRatio` 是本轮实测确认过的取值**：web 侧 = `min(window.devicePixelRatio, 2)`（dsf=3 → 2，与 `pal/screen-adapter/web` 源码一致）；
  backing store 比 `786/393 = 2` 与之相等（即"由 canvas `width/clientWidth` 反推 dpr"这条备选在本产物上也成立）。
- **`framework:sync:check` 现状为绿**：本轮 sync 时工作树的并行改动已不在 `games/beads/src/**`（`git status` 仅 ctx/knowledge/memory/production 在改）⇒ **未出现"因他人改动而红"**，无需代为修复。
- **breakout 附带复验（B2 要求：Q1=A 时需一并复验）**：同样**重建产物**后探针（800×600，打桩 `app.input.push`，点页面 (300,400)）
  ⇒ dsf=1 push **(300,400)**、dsf=2 push **(300,400)**（修前 dsf=2 应为 (600,400)）；两档均无页面错误；
  `touch-normalize.ts.meta` 亦由 CLI 构建自动生成，产物内 `normalizeCocosTouch` 命中 7 处。
  ⚠ 只验到**数据流**这一层，**未**验 breakout 玩法手感（挡板跟手 `[B]` 目视道次未做，本单不做）。

**⑥ 残留 / 不得归零**
- ⛔ **`[R]` 微信小游戏宿主未验**：`pal/input/minigame/touch-input.ts` 源码同形（左下原点 + ×pixelRatio，**无 2 封顶**），
  但无 AppID、无真机 ⇒ 未实测。解除条件同 A2（AppID + `build:cocos:wx` 出包 + 用 A6 探针在 `wx` 宿主复取三 accessor 与 push 值）。
  **真机首验必须把"点击落点 / 托盘选中"列为 P0 检查项**（ADR-0011 §4.2(10)）。
- ⛔ **BD-34（`_readInput` 仅在 `_stepPlaying` 内）不在本单**：`game-over` 下 `_readInput` 调用数仍为 0，属 **WXG-T-100**，用户已拍板本轮不动码。
- ⛔ **A05-09 本体仍 ⛔**（探针与 `test-cases` 需按新主体同改后复跑，成员无 `production/**` 写权限）。
- 本单**未引入任何新游戏数值**，`systems-index §3` 零改动；`games/beads/src/**`、`dev/harness/**` 零改动。
- **主理人独立复核（2026-09-15）**：`node production/qa/beads/cocos-input-probe.mjs` ⇒ **退出码 0**，汇总 **PASS 18 ｜ FAIL 0 ｜ ⛔ 2**（DEV-01 微信宿主、DEV-02 wechatgame 构建缺 AppID，**未记 PASS 亦未记 FAIL**），耗时 23.3s，**可复跑**。探针自带 `SELF-01` 判据自检（把 T-104 记录的**修复前**数字喂同一批判定函数，四个判定函数全部返回不通过）⇒ 判别力有反例证明，非恒真。落盘：`production/qa/beads/cocos-input-probe.mjs`、`evidence/cocos-input-probe.log`、`evidence/cocos-input-*.png`（beads 12 张 + breakout 4 张）、`evidence/cocos-input-probe-g1g2-subset.log`。**关键实测**：R1 点可见 (478.6,496.6) ⇒ `traySelected=0`、`_pointer=(76.70,413.17)`；点镜像 (478.6,223.4) ⇒ `-1`、`_pointer=(76.70,920.83)`；R2 push 与页面坐标 Δ=(0.4,0.4)（旧式差 273.6px）；R3 dsf 1/2/3 三档 push 完全一致（两两差 0.0px），`raw.x`=479/958/958 证明 ÷dpr 真被行使；`[B]` 像素级 beads 亮像素簇心 479.0 vs 点击 478.6、breakout 位移 135.0px vs 期望 134.9px。**未 commit / 未 push。**
- **成员遗留未决问题（待拍板）**：**① 是否纳入 CI/`verify`**（推荐 A：不纳入，依赖 Cocos 产物 + 浏览器，全量 verify 会变重；B 只文档登记命令；C 纳入 `verify-all.mjs` STEPS 需工程侧）；**② 判据是否回写 `production/qa/beads/test-cases.md §A`**（推荐 **B 倾向**：把 R1/R2/R3 升为三条硬判据用例，避免只活在本单日志里；A 维持现状；C 连 `smoke-tests.md` 图例加 `[B]` 道次）；**③ 真机首验 DEV-01 挂哪张单**（推荐 A 维持随 T-104 残留，真机可得时列 P0；B 另立单但前置不可执行；C 合入发布前 checklist）；**④ 是否接受「探针不覆盖画布非铺满窗口」边界**（本产物 canvas 恒 100% 铺满；推荐 A 接受并登记，B 另派工程侧加 viewport 非全屏测试）。
- **成员门禁建议（转呈编排者裁决）**：本单（证据固化）**PASS**；若把「宿主输入正确性」整体视作一道门，建议 **CONCERNS** —— G1 ✅（只读子集）／G2 ✅（744 例全绿）／**G3 未执行**（不属本单，且 `harness:build` 会写 `dev/harness/dist`，越出本单 Output Path 故未跑全量 verify）／G4 = 已执行硬判据全过 + `[R]` 真机一条 ⛔ 未测。
- **用户裁定（2026-09-15）**：本单未决 ② 采 **B 倾向** ⇒ 判据回写另立 **WXG-T-109**（派严守真）；①③④ 维持现状不立新单。

## WXG-T-109

- **名称**：**Cocos 输入 R1/R2/R3 回写为 `test-cases.md` 硬判据**
- **负责**：严守真(quality-lead)　**状态**：📋 已立项（待施工；**用户已批准写入 `production/qa/beads/test-cases.md`**）　**P2**
- **背景**：WXG-T-108 已把 R1（点可见位置命中 / 点镜像位置不命中）、R2（`InputManager.push` 的 y ≈ 页面 pageY）、R3（dpr=1/2/3 封顶 2 下同一可见点落点一致）固化成**可复跑探针** `production/qa/beads/cocos-input-probe.mjs`（PASS 18 ｜ FAIL 0 ｜ ⛔ 2，主理人独立复跑退出码 0）。但**这三条只活在本单的探针与日志里，QA 五件套的 `test-cases.md` 未收录** ⇒ 下轮回归若只跑用例表，仍会漏掉这一类缺陷（本仓已因此重复踩过四次同类坑）。
- **Deliverables**：① 在 `production/qa/beads/test-cases.md` **新增三条硬判据**（编号/分组按该文件既有体系，由你按 `wxgame-qa-gates` 规范决定并**在回传中说明选号理由**）；② 每条须写明：**判据原文** / 环境标签（`[N]`·`[B]`·`[R]`）/ **预期值来源**（指向 WXG-T-104 实测、`ADR-0011 §3(e)`、以及探针 `cocos-input-probe.mjs` 的对应用例 ID）/ 当前状态；③ 同步该文件顶部 **§A.0 实测状态回填表**（若存在此表）；④ **不得把 ⛔ 记为 PASS** —— DEV-01（微信宿主）、DEV-02（wechatgame 构建缺 AppID）须记 ⛔ 并写解除条件；⑤ 回写后**自证**：三条判据均能在探针里找到对应可执行用例。
- **权威来源**：`production/TASKS-DETAIL.md` 的 `## WXG-T-108` 小节（含主理人复核的实测数字）> `production/qa/beads/cocos-input-probe.mjs` > `docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md` §3(e) > `packages/framework/src/adapters/cocos/touch-normalize.ts`。
- **Output Path**：`production/qa/beads/test-cases.md`（**主产物**）；如需补证据放 `production/qa/beads/evidence/`。**禁改**：`packages/**`、`games/**`、`docs/**`、`systems-index §3`、`production/qa/beads/` 之外的 `production/**`（台账主表与状态回填由主理人执笔）。
- **必读 skill**：`my-skills/wxgame-qa-gates/SKILL.md`（**必须**）；另读 `AGENTS.md`、`production/qa/beads/test-cases.md`（先摸清其编号与分组体系再落笔）。
- **约束**：严守真默认 readonly，本单**已获用户批准**写入上列路径，不得越界；不 commit/push；不把未执行项记为通过。

### 完成记录（严守真 quality-lead，2026-09-15 · 已落盘 · **未 commit / 未 push**；状态行与台账主表由主理人回填）

**① 落盘清单**（全部在已批准的 Output Path 内，未越界）

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `production/qa/beads/test-cases.md` | **改**（v1.5 → **v1.6**） | 新增 **§I 宿主坐标归一化判据**（3 条硬判据 `TC-COORD-01..03`）+ **§I.2 ⛔ 未测道次** + **§I.3 自证映射表**；同步 §A.0（新增 `A.0b` 增量块）+ 文首图例 + 分组汇总表 + 变更记录 |
| `production/qa/beads/evidence/t109/cocos-input-probe-t109.log` | **新增** | 本轮复跑探针证据（每条含「预期（先写）/ 实测」） |
| `production/qa/beads/evidence/t109/cocos-input-*.png`（16 张） | **新增** | 本轮 `[B]` 目视截图（独立目录，**不覆盖** T-108 冻结证据） |

**② 新增用例编号与选号理由**：**新开 §I 一节，三条用例编号 `TC-COORD-01 / 02 / 03`**（= T-104 A4 的 R1 / R2 / R3）。

- **为何单开一节**：本文件组织法 = 「每一节 = 一个判据来源家族」（§A=GDD §8 / §B=systems-index/accesibility / §C=score-combo §8 / §D=powerups §8 / §E=core-loop §2.2.2 帧内序 / §F=ux-spec / §G=可感知规格层 / §H=未映射 §8 补编）。R1/R2/R3 来源是 **`ADR-0011 §3(e)` + `T-104·A4`**，**既非 §8、也非 §G 的规格层** ⇒ 并入 §A 会破坏「50 条 = 5 组 × 10」的 1:1 计数、并入 §G 会污染其来源谱系 ⇒ **新开 §I**。
- **为何取 `TC-COORD-*` 而非 `TC-HOST-*`**：探针里 `HOST-01/02/03` 是「宿主 **accessor 级**」断言的另一组 ID，同名会混。`R1/R2/R3` 保留在「判据代号」列，与 `judgeR1/2/3` 同名，使 `T-104 A4 ↔ 探针用例 ID ↔ 本表` 三向可对。

**③ 三条判据 ↔ 探针用例 ID 映射（自证，一一对上）**

| 本节用例 | 判据原文（来源） | 环境 | 探针 `cocos-input-probe.mjs` 用例 ID | 判定函数 | 本轮结论 |
| --- | --- | --- | --- | --- | --- |
| TC-COORD-01 | R1 端到端命中 + 镜像反证（`T-104·A4-R1` / `ADR-0011 §3(e)-1`） | `[N]` | `R1-01+R1-02`（+`R1-03+R1-04` 信箱 / `R3-02`+`R3-03` dsf2-3 端到端） | `judgeR1` | ✅ PASS |
| TC-COORD-02 | R2 `InputManager.push` 的 y ≈ pageY（`T-104·A4-R2` / `§3(e)-2`） | `[N]` | `R2-01`（同族 `HOST-01/02/03`+`HOST-03b`；`BR-01`） | `judgeR2` / `judgeHost` | ✅ PASS |
| TC-COORD-03 | R3 dpr=1/2/3（封顶 2）落点一致（`T-104·A4-R3` / `§3(e)-3` / `§4.2(0)`） | `[N]` | `R3-01` | `judgeR3` | ✅ PASS |
| DEV-01 / DEV-02 | 微信宿主 / wechatgame 构建 | `[R]` / `[⛔]` | `DEV-01` / `DEV-02`（脚本内 `DECLARED_BLOCKED`） | —（仅登记，不判定） | **⛔ 未测**（**不记 PASS、不记 FAIL**） |

**④ 本轮实跑（第一手，非引 T-108 日志）**：`node production/qa/beads/cocos-input-probe.mjs --out=production/qa/beads/evidence/t109 --log=…/t109/cocos-input-probe-t109.log` ⇒ **退出码 0 ｜ PASS 18 ｜ FAIL 0 ｜ ⛔ 2**（2026-09-15T14:03:12Z，耗时 23.2s）。关键实测与 T-108 记录**逐字一致**：R1 可见点 `(478.6,496.6)`⇒`traySelected=0`/`_pointer=(76.70,413.17)`、镜像点 `(478.6,223.4)`⇒`-1`/`_pointer=(76.70,920.83)`（guard 273.1px）；R2 push vs 页面坐标 Δ=(0.4,0.4)、反镜像 guard 273.6px；R3 三档 `push=(479,497)` 两两差 **0.0px**、`raw.x`=479/958/958。探针 `SELF-01` 以 T-104 **修复前**数字为反例，`judgeHost/judgeR1/judgeR2/judgeR3` 全返回不通过 ⇒ 判别力有反例证明。
> **踩坑登记（供复用）**：① 探针**不自建 OUT_DIR**（在 `finally` 才 `mkdirSync`）⇒ 用非默认 `--out` 须**先手动建目录**，否则每条 `[B]`/截图用例 `ENOENT` 全 ⛔、退出码 2（本例首次复跑即撞此坑，二次建目录后复跑得 0）。② 用独立 `--out=evidence/t109` 落盘以**避免覆盖 T-108 冻结证据** `evidence/cocos-input-probe.log` 与同名 png。

**⑤ §A.0 是否同步**：**已同步**——新增 `### A.0b WXG-T-109 轮回填（增量）` 块，只列**本轮真正执行过**的 5 行（TC-COORD-01/02/03 ✅ + DEV-01/02 ⛔）；上方 16 行 WXG-T-084 轮**未改**（追加不覆盖）。另更新：文首图例（追加 `[N]/[B]/[R]` lane 映射）、分组汇总表（新增 §I 行、**合计用例数 137 → 140**）、变更记录（v1.6 行）。

**⑥ 未决问题（转呈主理人）**

- **Q1 §I 是否纳入 CI/`verify`**（推荐 **A** 维持 T-108 决定：不纳入——依赖 Cocos 产物 + 浏览器，全量 verify 变重；B 只文档登记复跑命令；C 纳入 `verify-all.mjs` 需工程侧）。
- **Q2 §I 的道次标记是否与文首图例彻底统一**（推荐 **A** 保留探针 lane `[N]/[B]/[R]` 并在 §I 节首给等价表，因这些用例**必须在探针语境**下读；B 全部改写为 `[Node]/[Cocos]/[Device]` 会与探针输出对不上）。
- **Q3 真机首验（DEV-01）挂哪张单**（推荐 **A** 维持随 T-104/T-108 残留、真机可得时列 P0，与本单落盘口径一致；B 另立单但前置不可执行）。
- **Q4 是否顺手把 `smoke-tests.md` 也加 §I 对应冒烟条**（推荐 **A** 本单不动——已超本单 Deliverable；B 另立小单把「宿主输入落点」加进冒烟主链路）。

**⑦ 门禁建议（转呈编排者裁决）**：本单（判据回写）**PASS** —— 三条判据已回写、可与探针用例一一对上、⛔ 如实标注、§A.0 已同步。若把「宿主输入正确性」整体视作一道门，建议 **CONCERNS**：**G1 ✅**（未跑静态门，属只读文档单；探针自身过 `framework:sync:check`=exit 0）／**G2 未执行**（不属本单）／**G3 未执行**／**G4 = 本轮 `[N]/[B]` 硬判据全过（18/18）+ `[R]` 真机 2 道 ⛔ 未测**。

**⑧ 已知风险与缓解**：① `[R]` 真机未验（`DEV-01`）——缓解=源码同形已读 + 真机首验 P0 清单（解除条件见 §I.2）；② §I 三条用例依赖 Cocos 产物 + 浏览器 ⇒ **不能进 `[CI]`**，须人工/主理人按命令复跑——缓解=探针自带退出码与 `SELF-01` 判别力自检；③ 本节结论**不含**画布非铺满窗口的 CSS 布局（本产物 canvas 恒 100% 铺满）与触屏事件序（探针走真实 mouse）——已随 T-108 登记，不属本单范围。

**⑨ 下一 Task / 下游角色建议**：下游 = **主理人**（回填台账主表与状态行、裁定 Q1–Q4）；若后续要闭环真机，责任人 = **主理人/工程侧**（挂 `DEV-01` 首验 P0）。本单零 `src/**`、零 `systems-index §3`、零 `docs/**` 改动，未 commit、未 push。

**⑩ 主理人独立复核（2026-09-15）**：`grep` 确认 **§I 已落盘**（`test-cases.md:396`，节标题含「缺陷 C1 回归闸门」）、**TC-COORD-01/02/03 在 §I.1**（`:408` 起，每条含判据原文 / 环境道次 / 预期值来源 / 探针用例 ID 映射三向可对）、**§A.0b 回填表**（`:46–48`，只列本轮真跑过的 5 行且未覆盖上方 T-084 轮原文）、**分组汇总表新增 §I 行**（`:183`，合计 137→140）。⛔ 标注如实（DEV-01/DEV-02 未记 PASS、亦未记 FAIL）。**审定：本单 PASS。**
- **观察项（成员已报，不擅铸缺陷号，待裁）**：探针 `cocos-input-probe.mjs` **不自建 `OUT_DIR`**（在 `finally` 才 `mkdirSync`）⇒ 用非默认 `--out` 时须先手建目录，否则截图用例 `ENOENT` 全 ⛔、退出码 2（首次复跑即中招）。探针已冻结为 T-108 证据，**成员未擅改** —— 处置建议：随 T-108 的后续维护一并修（**一行级**），**不另立单、不铸 BD 号**。
- **主理人裁定（Q1–Q4）**：**Q1 = A**（维持不纳入 `verify`／CI —— 依赖 Cocos 产物 + 浏览器，全量 verify 会变重）；**Q2 = A**（**保留探针 lane `[N]/[B]/[R]`** 并在 §I 节首给等价表 —— 与探针输出对得上比「统一 + 文首图例」更重要）；**Q3 = A**（真机首验维持随 T-104/T-108 残留，真机可得时列 P0）；**Q4 = A**（本单不动 `smoke-tests.md`，超 Deliverable）。

## WXG-T-110

- **名称**：**宿主行为测试守卫（warn 级，非 fail-closed）**
- **负责**：程基岩(engineering-lead)　**状态**：📋 已立项（待施工）　**P2**
- **背景**：`control-manifest §17`（WXG-T-107 落盘）要求「新宿主 / 新引擎适配器接入必须有 Node **行为测试**」，但该约束目前**只能靠 §12 提交前自查表人工执行**，无机械守卫 ⇒ 会重演「清单写了但无人对照」的老问题。
- **⚠️ 用户裁定（2026-09-15，重要）**：先做 **warn 级**观察一轮，**不做 fail-closed**。理由：当前只有 Cocos 一个宿主适配器，fail-closed 无真阳性、易成噪声。**不得擅自升级为阻断。**
- **Deliverables**：① **守卫脚本**：扫 `packages/framework/src/adapters/*/`，对每个含输入归一化 / 触摸归一化模块的引擎适配器，检查是否配对 `packages/framework/tests/adapters/<引擎>-touch-normalize.test.ts`（或等价**行为**测试文件）；② 输出为 **WARN 且不阻断**（退出码 0），并在输出中写明**何时可升 fail-closed**（建议条件：出现**第二个**宿主适配器时）；③ **明确排除源码级正则断言** —— 只扫源码文本不算配对（§17 明令禁止其当交付），需识别出真正的可执行行为测试；④ 挂载位置由你判断（独立脚本 + `package.json` script，或并入 `verify-all.mjs` STEPS），但**不得破坏 `verify` 的「逐项执行、永不短路」语义**（WXG-T-095 / BD-17 硬约束，禁止改回 `&&` 串链）；⑤ **自证双向实测**：有配对 ⇒ 静默/绿；人为移除或改名 ⇒ 报 WARN 且退出码仍为 0。
- **权威来源**：`docs/architecture/control-manifest.md` **§17**（含 4 处交叉引用：§6 / §12 / §13×2）> `production/TASKS-DETAIL.md` 的 `## WXG-T-107` 与 `## WXG-T-104` 小节 > `packages/framework/tests/adapters/cocos-touch-normalize.test.ts`（现有正例）。
- **Output Path**：`tools/scripts/` 或 `packages/framework/`（你判断并回传）；如需改 `package.json` / `tools/scripts/verify-all.mjs` 一并包含。**禁改**：`games/**/src/**`、`systems-index §3`、`docs/architecture/control-manifest.md`（已落盘，本单不动）、`docs/architecture/adr/**`、`production/**` 除 `TASKS-DETAIL.md` 的 `## WXG-T-110` 小节外的一切。
- **必读 skill**：`my-skills/wxgame-adr-arch/SKILL.md`；另读 `AGENTS.md`、`docs/architecture/control-manifest.md`、`docs/agent/commands.md`（`verify` 语义）。
- **约束**：先问再写；本单**已授权**你落上列 Output Path；不 commit/push；**不得把守卫升级为阻断**。

### 完成记录（程基岩 engineering-lead，2026-09-15 · 已落盘 · **未 commit / 未 push**；状态行与台账主表由主理人回填）

**① 落盘清单**（全部在已批准 Output Path 内；`docs/**`、`games/**/src/**`、`systems-index §3`、`production/**`（除本小节）零改动）

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `tools/scripts/check-host-behavior-tests.mjs` | **新增** | §17 守卫：按宿主适配器扫「输入/触摸归一化模块」↔「行为测试」配对；默认 **WARN + 退出 0**；自带 `--selftest`（9 例，含反例判别力）与预留升级开关 `--fail-on-gap` |
| `package.json` | **改** | 新增 `check:host-tests`、`check:host-tests:selftest` |
| `tools/scripts/verify-all.mjs` | **改** | ①支持第 4 种状态 **`WARN`**（观察项：**不记 PASS**、**不影响退出码**，`--strict` 亦然 —— 不违反「不得升级为阻断」）；②`STEPS` **追加** `check:host-tests`（15 项，仍**逐项执行、永不短路**，未动 `&&`）；③合成自测 9 → **12** 例；④去掉硬编码「14 项」措辞（防脱钩） |
| `production/TASKS-DETAIL.md` | **改** | 本小节（追加，未删改既有内容） |

**② 守卫判定口径**（脚本头注 + 运行输出「② 判定口径」双份可查）

- **检查面**：`packages/framework/src/adapters/<引擎>/` 下任一 `.ts`（非测试）满足其一即视为归一化模块：**(a)** 文件名含 `normaliz`（§17 自己规定的命名约定）；**(b)** AST 判定文件**导出了名字含 `normaliz` 的函数**（`export function` / `export const`）。注：这里只是**探测「有没有这类模块」**，不充当语义断言 —— §17 禁止的是「拿正则当语义交付的证据」，不是禁止守卫识别文件（此点已在头注写明，避免自相矛盾）。
- **配对 = 行为测试**（四条同时成立）：① 测试文件的 `import` 路径**解析到**该模块（支持 `./x.js`→`x.ts` 的 NodeNext 写法）；② 导入了至少一个**值绑定**（`import type` 不算）；③ 在测试体里**真的调用了**该绑定（`fn(...)` 或 `ns.fn(...)`）；④ 文件里有 `it(`/`test(` 用例。
- **明确不算**（三类，均报缺口）：`MISSING_TEST`（无人 import）／`NOT_BEHAVIOR_TEST`（只 `import type`、或值导入却从不调用）／`SOURCE_REGEX_ONLY`（只 `readFileSync(源码)` + `toMatch(/…/)` 这类**源码级正则/文本断言**，§17 明令其不能当交付，输出单独点名）。
- 实现手段：用 **TypeScript 编译器 API 的 AST**（非正则）判定 import/调用形态；正则只用于**识别**「疑似源码级断言」（仅作输出说明，不参与判定）。
- **诚实边界（已知成本，非「已解决」）**：②③ 是**静态近似** —— 「import 且调用」不等于「断言真的覆盖了 ÷dpr 与 y 翻转」；真正的判别力仍在配对测试的**反例用例**（`cocos-touch-normalize.test.ts` 的 ②反向锁 / ⑨镜像反证；探针 `SELF-01`）。本守卫不检查归一化模块的**纯度**（不 import `cc` / 不碰 DOM）—— 那属 §17 另一条，L2/L3 与 `check:arch` 另有覆盖面，本守卫不越界。

**③ 挂载位置与理由**：**并入 `verify-all.mjs` 的 `STEPS`（第 15 项）+ 独立脚本**。理由：§17 的痛点正是「约束只活在自查表里没人跑」⇒ 独立脚本单放等于重演该痛点；而并入 STEPS 若沿用既有三态，会**要么伪装成 PASS、要么在 `--strict` 下变成阻断**（两者都违反用户裁定）⇒ 故为聚合器新增语义自洽的第 4 态 **`WARN`**（🔶，不计 PASS、不改退出码）。`verify` 的「逐项执行、永不短路」语义**未动**（`--validate` 仍绿；`verify-all-selftest.sh` 全绿，含「注入失败项后后续仍执行」）。

**④ 自证双向实测（2026-09-15，本机实跑）**

| 场景 | 命令 | 结果 |
| --- | --- | --- |
| ① 有配对（现状） | `node tools/scripts/check-host-behavior-tests.mjs` | `STATUS: OK`、**exit 0**；cocos 配对 `tests/adapters/cocos-touch-normalize.test.ts`（值导入绑定被实际调用 1 个、9 个 it 用例） |
| ① 经聚合器 | `verify-all.mjs --steps=check:host-tests --strict` | `✅ PASS check:host-tests`、**exit 0** |
| ② 人为移除配对测试 | 同上（测试文件暂移出） | 守卫 `STATUS: **WARN**`、**exit 0**（缺口 `MISSING_TEST`）；经聚合器变 🔶 `WARN check:host-tests`、**exit 0**（`--strict` 下亦然） |
| ② 升级开关（预留） | `… --fail-on-gap` | `STATUS: FAIL`、exit 1 —— 证明「升级 = 一步」真实可用，但**默认与 verify 均不使用** |
| 守卫自测 | `pnpm run check:host-tests:selftest` | **9/9**（正例静默 + 6 个反例必报：改名/源码级正则/只 import type/值导入不调用/第二宿主/第二模块） |
| 聚合器自测 | `pnpm run verify:selftest` | **全绿**（含合成 12/12、`--validate` 15 项、不短路、SKIP≠PASS 五步） |

> 自证后**已还原**：目标文件 `cp` 回原位、`git status --porcelain -- <该路径>` 与改动前一致（该文件本就未跟踪 `??`，属 T-104/T-108 未提交产物，**未动他人改动**）。

**⑤ 升级 fail-closed 的条件**（写进守卫运行输出「④」，且主判据**已机械化**、自报是否满足）

1. **主判据**：**含输入归一化模块的宿主适配器数 ≥ 2**。现状 = **1**（cocos）⇒ 条件**未满足**，仍是观察期。（`canvas2d` 是第 2 个适配器目录，但**无**输入归一化模块 ⇒ 不计入本判据；这正是「只在第二个宿主出现时才有真阳性」的机械化表达。）
2. 同一宿主在 CI 上出现过一次真实的「漏写行为测试」回归。
3. §17 复评（ADR-0011 §5）结论要求收紧。
   **升级方式（一行）**：`verify-all.mjs` 的 `STEPS` 把该项改为 `check:host-tests --fail-on-gap`，并把脚本 WARN 语义改判 FAIL。

**⑥ 未决问题（转呈主理人，2–4 选项）**

- **Q1 `docs/agent/commands.md` 出现措辞漂移**：该文件写「`verify` 全量门禁聚合器 …… **14 项**」，现为 **15 项**（本单新增 `check:host-tests`）。`commands.md` **不在本单 Output Path**，我未改。**推荐 A**：主理人另开小单（或随本单收尾）把该行改为「步骤表见 `--list`」的**非硬编码**写法，并补一行 `check:host-tests` 的用途/口径；**B** 就地只改数字 14→15（仍会再次漂移）；**C** 暂不动，登记为已知漂移。
- **Q2 `WARN` 是否要推广到其它「观察项」**：本单为聚合器引入第 4 态。**推荐 A** 先只服务 `check:host-tests`，观察一轮再谈复用；**B** 立刻把 `check:tasks` 的 report-only 观察哨（H 项）也迁到 WARN 通道（统一语义，但扩大改动面）；**C** 不给 WARN 落文档（不推荐，会变成隐性约定）。
- **Q3 守卫是否纳入 pre-commit**：本单只进 `verify`。**推荐 A** 维持（pre-commit 已被 BD-20 教训要求「只拦不写」，warn 级项进 pre-commit 收益低）；**B** 在 `.githooks/pre-commit` 加一条 warn-only 提示（需改 `.githooks/**`，超本单 Output Path）。
- **Q4 第二个宿主的机械预警**：**推荐 A** 维持本守卫每次 `verify` 自报「含归一化模块的适配器数」（现状 1/2），升到 2 时自动提示「已达升级条件」；**B** 另立单在 `systems-index`/Epic 层登记「新宿主接入 checklist 含运行本守卫」。

**⑦ 已知风险与缓解**

1. **静态近似的误判面**（风险：把「import 且调用」误当「真行为测试」）—— 缓解：③ 的诚实边界已写在脚本头注与输出；真正的判别力靠配对测试的反例用例，且 §17/§12 仍保留人工项（机械守卫**不替代**自查表）。
2. **`WARN` 第 4 态影响面**（风险：改动共享工具 `verify-all.mjs`）—— 缓解：不改退出码、`--strict` 不判红、原 9 条自测断言全部保留并**新增 3 条**专测 WARN；`verify-all-selftest.sh` 五步全绿；`--validate` 绿（防 `&&` 回退仍生效）。
3. **升级条件依赖「适配器目录数」**（风险：新宿主若把归一化写进 `src/platform/**` 而非 `adapters/`，守卫扫不到）—— 缓解：本守卫会在输出里点明检查面路径；若新宿主选非 `adapters/` 落位，须同批扩检查面并复评（已列为 Q4 备选）。
4. **无真机 / 无 AppID** 对本单**无影响**（纯静态守卫）。

**⑧ 建议下一 Task / 下游角色**

- 下游 = **主理人**：回填台账主表与状态行；裁定 Q1（`commands.md` 漂移，**建议就本单内一次改掉**，因它会立刻误导读者）。
- 若 Q1 选 A：责任人 = **程基岩**（工程侧，`tools/scripts` + `docs/agent/commands.md` 小改单）。
- 新宿主接入时（触发条件 1 达成）：责任人 = **程基岩**（升 fail-closed + 同批复刻 `<引擎>-touch-normalize.test.ts`），QA 侧由 **严守真** 把该判据收进 `production/qa/beads/test-cases.md`。

**⑨ 明确回答主理人**：**守卫已落盘**（`tools/scripts/check-host-behavior-tests.mjs`，并已挂进 `verify` 第 15 项）；**默认退出码为 0（不阻断）**，含发现缺口时（`--strict` 亦然）；**已自证双向**（有配对 ⇒ `STATUS: OK` / exit 0；移除配对 ⇒ `STATUS: WARN` / exit 0；预留 `--fail-on-gap` ⇒ exit 1，未接入 verify）。未 commit、未 push。

**⑩ 主理人独立复核（2026-09-15）**：本单动过**共享门禁聚合器** `verify-all.mjs`（新增第 4 态 `WARN`），属高风险改动，故逐项实跑：
1. `pnpm run check:host-tests` ⇒ **`STATUS: OK`、EXIT=0**；输出自报「适配器 2 个 ｜ 含归一化模块 1 个 ｜ 缺口 0 ｜ PASS 1 ｜ WARN 0」，并把**升级 fail-closed 的触发条件**（含归一化模块的宿主适配器 **≥2** 个）机械写进结论。
2. **「有缺口不阻断」独立复现**（把 `tests/adapters/cocos-touch-normalize.test.ts` 临时改名）⇒ **`STATUS: WARN`、缺口 1 项、EXIT=0**（不阻断成立）；**已还原并 `diff` 内容一致**，未留残迹。
3. `pnpm run verify -- --validate` ⇒ **步骤表 15 项全部存在于 `package.json` 且 `verify` 仍指向本聚合器**（WXG-T-095 的「反 `&&` 串链回退」守卫仍生效）。
4. `pnpm run verify` 全量 ⇒ **PASS 14 ｜ WARN 0 ｜ SKIP 1（check:size 未覆盖）｜ FAIL 0**（15 项），旧 14 项无回归。
**审定：本单 PASS。** 判定口径（AST 识别而非正则、配对＝解析到模块 + **值导入** + **实际调用** + 有 `it(`、`SOURCE_REGEX_ONLY` 单独点名）与 §17 的「禁正则当交付」自洽，未自相矛盾。
- **主理人追正 `docs/agent/commands.md` 漂移（成员 Q1）**：该文件仍写「verify …… **14 项**」且汇总表缺 `WARN` 态 ⇒ 由主理人执笔追正（同 T-098 · O4 先例，**成员 Output Path 不含该文件，守纪律未擅改**）：① 计数改为「**以 `--list` 为准，勿硬编码计数**」并去掉「后面 13 项」的硬编码；② 汇总表补 `PASS/WARN/SKIP/FAIL` 且写明 `WARN` = **观察期守卫（不计通过、不影响退出码、`--strict` 亦不判红）**；③ 新增 `check:host-tests` 一行（含判定口径与升级条件）。
- **主理人裁定（Q2–Q4）**：**Q2 = A**（`WARN` 先只服务 `check:host-tests` 观察一轮，不外推）；**Q3 = A**（维持只进 `verify`，不进 pre-commit）；**Q4 = A**（维持每次 `verify` 自报「含归一化模块适配器 1/2」，达 2 时自动提示升级）。
- **⚠️ 收尾时发现的既有红（非本单引入）**：`pnpm run ctx:check` 的 **C 项**（索引过期 19 个变更）已由主理人 `pnpm run ctx:build` 修复；重建后仅剩 **B 项单文件上限** 红 —— `memory/2026-09-12.md`(10141) 与 `memory/2026-09-14.md`(12586)，**属并行会话 WXG-T-106（memory 二级详情拆分）的在途工作**，非本单亦非本会话产物，主理人未越界处理。

## WXG-T-123

- **名称**：**QA 复测 `CLK-01`（BD-40 修复后产物）+ 勘误 §25.13 的 CLK-01 行 + 判据测量分辨率口径**
- **负责**：严守真(qa)　**状态**：📋 已立项（待施工）　**P1**
- **❗范围说明（先读，避免重复劳动）**：本单原拟两件事 —— ① 复测 `CLK-01`、② 屏幕层判据面修复（`§25.12.2` 的 P0 清单）。**② 已由并发 QA 会话完成并落盘为报告 `§25.13`（终轮：探针口径收敛后复跑）**，本单**只做 ① + 勘误 + 分辨率口径**，**不得重做 ②**、不得动已收敛的判据面。
- **时间线（主理人已厘清）**：① `§25.12` 发现 BD-40 并列屏幕层 P0 修法；② **并发 QA 会话执行了该清单**（D5 阈值数据相对 / D5② 支撑上下限 / D6 采样与 rAF 解耦 / D6′ 逐样本真实时钟 / D7 自检不依赖本机帧长 / D8 补先验预期 / **D0 新增第三态 `⊘`**）⇒ 屏幕层判据面**已达标且跨轮稳定**（`P4S-00/01/02` 全绿；`P4S-03`/`P4S-01b` 记 **⊘** 拒绝判定）—— **但其 `CLK-01 = 2.003` 是在 `WXG-T-122` 修复**前**的 Cocos 产物上跑的**；③ **`WXG-T-122` 已修 BD-40**（`App.startHostDriven()` + 三道互斥守卫），工程自证 `CLK-01 = 0.999`（1.999 → 0.999），但该自证**被后续运行覆盖**、不在盘上，且**不替代 QA 复测**。
- **Deliverables**：
  1. **确认产物新鲜度**（`ENV-01` 自查须过：产物 mtime ≥ `packages/framework/src/**` 最新；`framework:sync:check` exit=0）—— `T-122` 已重建 `build:cocos:web`，预期直接过；若不过，**先回传**再重建。
  2. **复跑 `production/qa/beads/beads-browser-probe.mjs`** ⇒ 预期 **`CLK-01` = 仿真/墙钟 ≈ 1.00（±0.10）⇒ PASS**（真源 `T-122` 工程自证 0.999）。**若仍 ≈2 ⇒ 那是重大发现（修复未生效或产物陈旧），立即停手回传，不得自行解读**。
  3. **勘误报告 `§25.13` 的 `CLK-01` 行**（`2.003`）—— 加【`WXG-T-123` 注】：该读数系 **`WXG-T-122` 修复前产物**所测，**已被复测取代**；沿用「追加不覆盖」纪律，不改写原文。**同时**：`P4S-03` 在修复后产物的读数须重新取（修后墙钟口径 ≈2.01 次/秒，见 `T-122` 工程自证）⇒ 据实记（`PASS`/`⊘` 由判据面定，**不得因贴线而放宽**）。
  4. **把「判据测量分辨率」写进判据口径**（`T-122` 主理人裁定 ①）：墙钟闪烁率类判据须声明**帧量化分辨率** —— 一帧 ≈16.7ms ⇒ 500ms 门的实测起点间距落在 500±8ms ⇒ 折算 **1.97–2.03 次/秒**；**2.01 属分辨率噪声，非真超线**。**只写口径，不改任何阈值**。
  5. 证据落 `production/qa/beads/evidence/`（新 log + 确定性重跑自证）。
- **权威来源（冲突以 A 为准）**：**A** `production/qa/beads/g4-regression-report.md` **§25.13**（判据面现行口径与 `⊘` 语义）+ **§25.12.3**（退出码契约）＞ **B** `production/TASKS-DETAIL.md` 的 `## WXG-T-122`（修复内容 + **CLK-01 自证 0.999** + 裁定 ① 分辨率口径）＞ **C** `production/qa/beads/beads-browser-probe.mjs`（**只读**，本轮不改判据面）＞ **D** `games/beads/design/gdd/systems-index.md §3.8`（≤2 次/秒，只读）。
- **Output Path**：`production/qa/beads/g4-regression-report.md`、`production/qa/beads/evidence/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-123` 小节（**追加**）。**禁改**：`beads-browser-probe.mjs`（判据面已收敛）、`g4-probe-v1.1.mjs`、`games/**`、`packages/**`、`tools/**`、`systems-index §3`、其他成员台账小节。
- **硬要求**：不把 ⛔/⊘ 写成 PASS；不放宽阈值；**判据面一字不改**；`[R]`（真机 1×）与 `[P]`（听感）仍 ⛔ 不代判；先问再写；不 commit/push。
- **必读**：`my-skills/wxgame-qa-gates/SKILL.md`；`g4-regression-report.md` §25.13；`TASKS-DETAIL.md` 的 `## WXG-T-122` / `## WXG-T-123`。
- **⚠️ 防超时纪律**：任何可能 >60s 静默的命令用重定向 + `tail` 或后台 + 轮询；先落盘台账与报告、再补证据。
- **回传（固定结构）**：① 文件列表；② 摘要（产物新鲜度、`CLK-01` 实测、`P4S-03` 修后读数与判定、勘误内容、分辨率口径落点）；③ 未决问题；④ 风险与缓解（含 `[R]`/`[P]` 边界）；⑤ 建议下一 Task；⑥ **明确回答**：`CLK-01` 是否 ≈1.00、`§25.13` 勘误是否落盘、分辨率口径是否写入且未改阈值、有无放宽。
- **完成记录（2026-09-16 · 严守真）—— 状态：✅ 交付完成（三项 Deliverables 全部落地，未动判据面）**：
  - **Deliverable 1 产物新鲜度 ✅**：产物最新 mtime `1789515802`（web-mobile）≥ `packages/framework/src` 最新 `1789515641`（`bindings.ts`）；`framework:sync:check` **exit=0**；探针自证 `ENV-01 = PASS`（产物 mtime 晚于全源链 + 镜像守卫 OK）。**未重建**（T-122 已重建，预期直接过 ⇒ 事实过）。
  - **Deliverable 2 `CLK-01` 复测 ✅ PASS**：修复后产物两轮 **1.002 / 0.997**（判据 ≈1.00±0.10；与 T-122 工程自证 0.999 一致）；**退出码 `1 → 0`、FAIL 0**；判定串两轮除 `P4S-01b`（⊘↔PASS 条件性翻转，§25.13 已声明）外逐字一致。正式轮计数 `PASS 13 ｜ PASS* 10 ｜ FAIL 0 ｜ ⛔ 4 ｜ ⊘ 2`。
  - **Deliverable 3 勘误 ✅（追加不覆盖）**：`g4-regression-report.md` §25.13.0 末尾追加【WXG-T-123 注】——`CLK-01 = 2.003` 系 **T-122 修复前产物**所测，已被复测取代；原文一字未动；完整记录落新节 **§25.14**。
  - **Deliverable 4 `P4S-03` 修后读数 ✅ 记 `⊘`**：判据面（探针 `DECLARED_INVALID`）硬编码无条件 `⊘`，本轮不改；读数据实登记 —— 直测 **2.02 次/秒**（正式轮，最小墙钟间距 495ms）/ **2.38 次/秒**（重跑轮，420ms，超出纯帧量化带宽，系起播检测对位移通道肩峰的敏感度所致）；换算交叉校验 ≈2.00 / ≈2.06。**既不因 2.02 贴线记 PASS，也不因 2.38 漂移改判 FAIL**。产品侧结论仍以 `P4S-02`（game 时基 ≥500ms ✓）与指令流层为准。
  - **Deliverable 4b 分辨率口径 ✅（只写文字、未改阈值）**：§25.14.4 落档 T-122 裁定 ① —— 一帧 ≈16.7ms ⇒ 500ms 门实测起点间距 500±8ms ⇒ 折算 **1.97–2.03 次/秒**；带宽内读数（2.01/2.02）属分辨率噪声、非真超线，**不得据此放宽或收紧门限**；`§3.8` 冻结值与探针判据**一字未动**。带宽边界声明：只覆盖纯帧量化，重跑轮 2.38 超带宽属检测敏感度，不得读作判定。
  - **顺带登记（探针文案滞留，不在本单修）**：§25.14.5 —— D12：`P4S-03` 正文仍硬编码「双驱动宿主不可测」理由（修后已单驱动，文案过时）；D13：重跑轮计数行「⊘ 1」与括注「P4S-01b, P4S-03」不符。均为文案/展示，不影响判定与退出码，建议并入下轮探针维护单。
  - **改动文件**：`production/qa/beads/g4-regression-report.md`（§25.13.0 追加勘误注 + 新增 §25.14，共 +102 行）、`production/qa/beads/evidence/beads-browser-probe-t123.log`（新）、`evidence/beads-browser-probe-t123-rerun.log`（新）；截图/JSON 取样物由探针每轮覆写（盘上版本对应重跑轮）。**未改** `beads-browser-probe.mjs`、`games/**`、`packages/**`、`tools/**`、`systems-index §3`。**未 commit / 未 push**。
  - **G4 建议（裁决权归主理人）**：维持 **CONCERNS** —— `CLK-01` 已闭合，剩余阻塞全部收束到真机首验（DEV-01）与探针维护单，无新实现缺陷。
- **主理人独立复核（2026-09-16，事后非采信自述）**：
  - **`CLK-01` 已核**（`beads-browser-probe-t123.log`）：**仿真/墙钟 = 1.002**（墙钟 2.513s / 仿真 2.517s / 151 固定步）⇒ **PASS** ✅；重跑轮 **0.997** ⇒ 两点与 `T-122` 自证 0.999 **三点一致**。**退出码 1 → 0，FAIL 0** ⇒ **BD-40 至此 `[B]` 道次闭合**。
  - **勘误与口径已核**：§25.13.0 的【`WXG-T-123` 注】（`:1951`，**追加不覆盖**、原文零改动）✅；**§25.14**（`:2028`）+ **判据测量分辨率口径**（`:2080-2084`，折算带宽 **1.97–2.03 次/秒**）✅ —— **只写文字、阈值与 `§3.8` 冻结值一字未动** ✅。
  - **特别肯定一处纪律**：`P4S-03` 直测读数**跨轮漂移 2.02 → 2.38**，**超出其自己刚写的纯帧量化带宽（1.97–2.03）** ⇒ 成员**没有**拿 2.02 贴线记 PASS，也**没有**因 2.38 改判 FAIL，而是**据实登记漂移 + 维持 `⊘`（拒绝判定）**，并把漂移成因指到「起播检测对位移通道肩峰的敏感度」。**带宽判据被自己的新数据顶穿时，正确动作是拒绝判定并追因，不是挑一个好看的数** —— 这是本单最值得留档的一笔。
  - **门禁**：`check:tasks` **52 行 ⇔ 52 节**、`check:links` OK、`verify` PASS 14 / WARN 0 / SKIP 1 / FAIL 0 ✅。
- **主理人裁定（成员四项未决）**：
  1. **`P4S-03` ⊘ 的后续 = A（维持 ⊘，至真机首验一并复核）** —— 采纳其建议。理由：① 判据面本轮**禁改**（`§25.13` D10 裁定）；② 直测读数**跨轮漂移超出分辨率带宽** ⇒ 该测度对该宿主形态**本身不稳定**，此时重设判据面（B）是过早优化，**真机上拿同源读数再定才有意义**；C（拿 2.02 记 PASS）**否**。
  2. **`D12`/`D13` 探针文案** = **并入下轮探针维护单**（与 §25.13.6-4 的 `P4S-01b` 测度纯净度增强同批），**不挂 backlog** —— 它们是「文案与展示失实」（会误导后人），属**活跃漂移**而非低优先欠账。
  3. **G4 裁决 = 维持 `CONCERNS`** —— 采纳。`CLK-01` 闭合后剩余阻塞收束为：**DEV-01 真机首验（需 AppID，P0 含 `CLK-01` 同源复核 + wrong/告急观感）**、探针维护单、`beads` 主包红线仍无实测数据。**不得升 PASS**。
  4. **主表状态行** ⇒ 本条已由主理人更新。
  - **沉淀**：QA 提出的两条 K 候选（①判据读数须声明测量分辨率带宽，带宽内不判超线也不据此放宽；②修后复测先核产物新鲜度，防在陈旧产物上测出假 FAIL）**均采纳**，已入主理人经验库；建议下次 `tasks:archive` 时一并沉淀进仓内 memory。
- **📥 待入库清单（2026-09-16 盘点 · 61 项 · 用户裁定：等并发入库会话收口后由主理人按序提交）**：
  - **触发条件**：并发入库会话（HEAD `7e2565d` @ 08:21:43，正入库 WXG-T-119 的 docs/memory/knowledge）**停止产出 ≥30 分钟**方可动手。**⚠️ 该会话在 08:39–08:41 仍在 `temp/` 产出 beads 截图 ⇒ 截至本条登记时仍未收口**；`temp/` 系其在途产物，**勿清理**。
  - **已随盘点完成**：`.gitignore` 已补 `production/qa/beads/evidence/**/*.json|*.png`（82 → 61 项噪音）；`/tmp/beads-evidence` 已清；残留 `serve-harness` 进程已终止。
  - **提交分组（⚠️ 混笔文件须随行，勿按文件级拆）**：
    1. **T-104**（C1 坐标归一化）：`packages/framework/src/adapters/cocos/touch-normalize.ts`(新)、`tests/adapters/cocos-touch-*.test.ts`×2(新)、`src/core/input/input-manager.ts`、`docs/architecture/adr/ADR-0011…md`、`docs/architecture/control-manifest.md`
    2. **T-122**（BD-40 修复）：`src/compose/app.ts`、`src/adapters/cocos/loop-bridge.ts`、`tests/compose/app-host-driven.test.ts`(新)、`tests/adapters/cocos-loop-bridge.test.ts` —— ⚠️ **与 1 在 `bindings.ts` 混笔**（本单 4 行注释 + T-104 大半 diff）⇒ **1+2 同一笔提交**，message 双任务号
    3. **T-102 + T-100/T-114**（beads BD-29 改码 + 真链）：`games/beads/src/{config/tuning,game/beads-game,view/view-model}.ts`、`tests/{feedback-vfx,helpers,phase-input-realchain}.ts` —— ⚠️ `beads-game.ts` 混笔随行
    4. **T-115/T-117**（设计文档）：`games/beads/design/gdd/input-control.md`、`games/beads/design/ux/ux-spec.md`
    5. **T-118/119/123**（QA 探针与报告）：`g4-probe-v1.1.mjs`、`g4-regression-report.md`、`test-cases.md`、`beads-browser-probe.mjs`(新)、`cocos-input-probe.mjs`(新)、`evidence/diag-t119-a05.mjs`(新，**按体例 .mjs 入库**；其 json/png 已忽略)
    6. **T-121/T-110**（工具/门禁）：`tools/scripts/{selftests,verify-all,check-host-behavior-tests}.mjs`、`dev/harness/index.html`
    7. **台账**（**最后**）：`production/TASKS.md`、`production/TASKS-DETAIL.md` —— ⚠️ 并发会话若也动台账，须先 `git add` 前复查其最新状态
  - **镜像/meta 随行**：两游戏 `cocos/**/framework/**` 拷贝件由 `framework:sync` 产出，随组 1/2/3 对应任务走；各 `.meta`（Cocos 编辑器补生成，含 T-058 遗漏的 `ads.meta`）随最近一次涉及该目录的任务走。
  - **✅ 已处置：`dev/harness/preview/*.svg` —— 判定「不需要记录」并已还原**（2026-09-16）。依据：报告 §BD-19（`:232`）明文登记 `preview:frames`「**不识别 `--help`、直接执行并覆写 `dev/harness/preview/level-{1..5}.svg`**」⇒ 该 +54/−14 是 **BD-19 已登记缺陷的副作用覆写**（跑 `preview:frames` 想看 help 却被脚本直接执行），**非任何任务的有意产出**；svg 本身是 `render-harness-frame.mjs` 的纯再生成产物。处置 = `git checkout -- dev/harness/preview/` 回到 HEAD 有意入库版。**防复发提示**：在 BD-19/B8 修复（`preview:frames` 支持 beads + 识别 `--help`）落地前，任何「想看 help」的调用都会再次覆写这 5 个文件。
  - **体例提醒**（K-050 教训）：**提交不带 pathspec、逐组确认 staged 清单**；台账与归档收口须双向对账。

## WXG-T-122

- **名称**：**框架 · 宿主驱动权互斥（BD-40 宿主双驱动修复）**
- **负责**：程基岩(engineering-lead)　**状态**：📋 已立项（待施工）　**P1**
- **背景**：**BD-40** 由 `WXG-T-119`（`[B]` 道次探针）发现、主理人**代码级确证**：Cocos 宿主下 **仿真/墙钟 ≈ 2×**（实测 **1.999 / 2.029 / 2.005 / 2.003**，四轮稳定复现）。**`WXG-T-121` 只把 BD-40 挂上了检测门禁，修复本身此前无单** ⇒ 本单即修复单。
- **根因（已确证，可直接采用）**：
  - `packages/framework/src/compose/app.ts:121` —— `start()` **无条件** `this._schedule()`；`:158-169` `_schedule()` 用 `platform.requestFrame` **自驱** `tick`；
  - `packages/framework/src/adapters/cocos/loop-bridge.ts:38-43` —— `CocosLoopBridge.start()` **先** `this._app.start()`（⇒ 触发自驱）**再** `this._scheduler.schedule(this._tick, 0)`（⇒ Cocos 又驱动一次）；
  - `packages/framework/src/adapters/cocos/bindings.ts:105-108` —— 宿主**两者都接**。
  - ⇒ `app.tick` 每墙钟帧被调 **2 次** ⇒ 游戏跑 ≈2 倍速。
- **定性：设计意图与实现的脱节，不是宿主误用** —— `app.ts:141-146` 的 `tick()` docstring **明写**「Used by tests and by hosts whose engine owns the tick (e.g. a Cocos `Component.update`)」⇒ 框架**本就打算**让宿主自 tick，但 `start()` 没有提供关闭自驱的开关。
- **后果（必须随修复一并声明）**：仿真/墙钟 ≈2× ⇒ 倒计时/动效/音频时长相对墙钟**减半**；**wrong 闪烁在墙钟口径 3.35–4.49 次/秒 > `systems-index §3.8` 的 2 次/秒** ⇒ **光敏性红线在宿主层被违反**（`T-102` 的游戏时基逻辑本身正确）。**真机同源风险**：`packages/framework/src/platform/weapp.ts:197` 亦有 `requestFrame` ⇒ **weapp 宿主的驱动权须在本单一并核实并写清结论**（若 weapp 无 bridge 则 `App.start()` 自驱是唯一驱动 ⇒ 单驱正确；若有同类 bridge 则同样双驱）。
- **⚠️ 已知陷阱（修复时最易踩）**：`bindings.ts:108-110` 注释**明说** `CocosLoopBridge.start()` 调 `App.start()` 是**有意依赖** —— 为了让它做 **viewport re-fit**（`platform.getScreenSize()`），且「Doing this any earlier gets silently overwritten (observed 2026-09-13)」。⇒ **不能简单删掉 `app.start()` 调用**，否则 viewport fit 静默失效。修复必须**保住初始化语义**（`game.init` / `onHide/onShow` 挂接 / viewport re-fit），只把「**驱动权**」从初始化里**解耦**出来。
- **修复方向（选型权归你，但须满足以下约束）**：
  1. **向后兼容**：`App.start()` 的**默认**行为（无人声明宿主驱动）**保持自驱** —— harness、Node 单测、`render-harness-*.mjs` 全靠它，**不得破坏**。
  2. **显式宿主驱动**：提供一种**显式**声明「驱动权归宿主」的方式（构造选项 / `start()` 选项 / 独立方法，**由你定**），宿主驱动模式下 `start()` 做**全部初始化**但**不 `_schedule()`**；`stop()` 在该模式下须安全（`_frameHandle` 为 null 时不得抛）。
  3. **互斥防护（强烈建议）**：两种驱动**同时生效**时应**硬失败**（抛错或显式 WARN + 拒绝第二路），**不得静默双驱** —— 本缺陷能存活到今天，正是因为双驱是静默的。`CocosLoopBridge` 改用宿主驱动路径。
  4. **行为测试**：`packages/framework/tests/compose/**`（已存在该目录）新增断言：宿主驱动模式下 ① `_schedule` 未启动（无 `requestFrame` 调用）；② 外部每墙钟秒调一次 `tick` ⇒ `loop.advance` 的固定步数 ≈ 预期（**1×**）；③ 双驱时**硬失败**。**用假 platform / 假 scheduler**（沿用 `tests/adapters` 现有假件风格）。
  5. **`framework:sync`**：改 `packages/framework/src/**` ⇒ 必跑 `pnpm run framework:sync` + `framework:sync:check`（两游戏拷贝件同步）。
- **验收标准**：
  1. framework 行为测试全绿（含新增 3 条）；
  2. `pnpm run framework:sync:check` OK；
  3. `pnpm run verify` FAIL 0；
  4. **Cocos web 产物重跑 `production/qa/beads/beads-browser-probe.mjs` 的 `CLK-01` ⇒ 仿真/墙钟 ≈ 1.00（±0.10）** —— 此项属 **QA 域复测**，工程侧**先自证单测**，复测由主理人另派；若你本地能顺带跑（`node production/qa/beads/beads-browser-probe.mjs`，**产物须重建**：`pnpm --filter @wxgame/beads run build:cocos:web`），可作为自证附在回传，但**不得替代 QA 复测**。
  5. **`breakout` 同受影响**（共用 framework 拷贝件）⇒ 修复后其 Cocos 产物同样回到 1×；**不得顺手改游戏侧 src**（如确需，先回传）。
- **权威来源（冲突以 A 为准）**：**A** `packages/framework/src/compose/app.ts`（`start`/`tick`/`_schedule`/`stop` 现实现 + `:141-146` docstring 的**设计意图**）＞ **B** `packages/framework/src/adapters/cocos/loop-bridge.ts`（全文 55 行，已确证）+ `bindings.ts:105-118`（**含 viewport 陷阱注释**）＞ **C** `production/TASKS-DETAIL.md` 的 `## WXG-T-119`（BD-40 四轮实测 + 效力边界）与 `## WXG-T-121`（**只挂了门禁，非修复**）＞ **D** `docs/architecture/adr/ADR-0011-screen-coordinate-space-contract.md`（**不得**与本修复耦合；viewport re-fit 语义仍归它管）。
- **Output Path**：`packages/framework/src/compose/app.ts`、`packages/framework/src/adapters/cocos/loop-bridge.ts`（如需）、`packages/framework/src/adapters/cocos/bindings.ts`（**仅**适配新驱动权 API；**若需动它须在回传说明为何**）、`packages/framework/tests/**`、`production/TASKS-DETAIL.md` 的 `## WXG-T-122` 小节（**追加**）。
  **禁改**：`games/**/src/**`、`games/**/cocos/assets/scripts/**`、`production/qa/**`、`tools/scripts/**`、`systems-index §3`、其他成员台账小节。镜像拷贝件由 `framework:sync` 产出，**禁手改**。
- **必读 skill**：`my-skills/wxgame-adr-arch/SKILL.md`；另读 `AGENTS.md`、`docs/architecture/control-manifest.md`（L4/L5）、`packages/framework/src/compose/app.ts` 全文、`loop-bridge.ts` 全文、`production/TASKS-DETAIL.md` 的 `## WXG-T-119` / `## WXG-T-121`。
- **约束**：渲染层不持有状态（L5）；先问再写；不 commit/push；**若发现 weapp 宿主同样双驱，须如实登记并评估是否需同修，不得静默只修 Cocos**。
- **后继（不在本单）**：① QA 复测 `CLK-01`（主理人另派）；② weapp/真机道次复核（需 AppID）；③ 屏幕层探针 P0 修法（T-119 裁定 ②，另单）。
- **完成记录（2026-09-16 · 程基岩）—— 状态：✅ 工程侧交付完成（QA 复测 `CLK-01` 待另派）**：
  - **驱动权 API 选型**：**独立显式方法 `App.startHostDriven()`**（备选：构造选项 / `start()` 选项）。理由：① `start()` 签名与默认行为**逐字节不变**（向后兼容硬约束零风险）；② 语义在调用点自解释；③ **`bindings.ts` 无需行为改动**（宿主仍只 `new CocosLoopBridge(app, this)`，驱动权改由 bridge 内部声明），避免触碰 `cc` 依赖的未验证文件。模式为**实例生命周期粘性**（`_hostDriven` 一经置位不复位）。
  - **初始化语义保全（viewport 陷阱）**：两路 start 共用抽出的 `_init()`（`getScreenSize` → `viewport.resize` → `game.init` → `onHide/onShow` 挂接 → `_running/_lastFrameMs`）；`startHostDriven()` 只是**不调 `_schedule()`**。bindings.ts 的「必须 loop start 之后 `_fitToGameCanvas()`」时序前提原样成立（仅订正注释措辞：`App.start()` → `App.startHostDriven()`，行为零改动）。`stop()` 在宿主驱动下 `_frameHandle` 恒 null，原实现本就安全，新增测试钉死。
  - **互斥防护（三道，全部硬失败，无静默双驱）**：① 自驱 App 上调 `startHostDriven()` → 抛错（正是 BD-40 接线形态）；② 宿主驱动 App 上调 `start()`（含 stop 后重启）→ 抛错（粘性驱动权，拒绝静默翻转）；③ `_schedule()` 内防御守卫 → 抛错（兜未来新调用路径）。自驱模式下手工 `tick()` **保持允许**（harness / 既有 13 例 app 测试依赖），互斥守卫放在**接线点**而非 tick 点 —— 这是与「向后兼容」约束的明确折衷，已在 `tick()` docstring 写明。
  - **`CocosLoopBridge.start()` 改走 `app.startHostDriven()`**；对其余宿主零影响。
  - **weapp 侧核实结论（`[R]` 未取证，代码级）**：微信真机产物（`games/breakout/cocos/build/wechatgame/game.js`）就是 **Cocos 壳** —— 真机宿主 = 同一套 `Bootstrap` + `CocosLoopBridge`，`detectPlatform()` 因 `wx` 存在返回 `WeappPlatform`（其 `requestFrame:197` 优先 `requestAnimationFrame`）⇒ **weapp 同样双驱**（T-119 探针的「同源风险」判断成立）。但**双驱源头是 framework 正本**（App 自驱 + bridge），不存在独立的 weapp bridge ⇒ 本修复经 `framework:sync` **自动同修 weapp 路径**，无需（也不得）改游戏侧。真机 1× 仍须 `[R]` 复核。
  - **测试（`tests/compose/app-host-driven.test.ts` 新增 7 例 + `tests/adapters/cocos-loop-bridge.test.ts` 增 1 例）**：① 宿主驱动 start 后 `platform.hasPendingFrame === false` 且 pump 1000ms 零 update、init/viewport 全部完成；② 64 次 `tick(1/64)` ⇒ 64 固定步、`loop.time` = 1.0（1/64 二进制精确，期望值非容差游戏）；③ 自驱上 `startHostDriven` 抛错且第二路被拒（`scheduler.scheduled === false`）；另钉：粘性拒绝、幂等、`stop()` 安全、默认 `start()` 仍自驱 64 步/墙钟秒（向后兼容）。
  - **验证数字**：framework vitest **281/281 绿**（30 文件）；`tsc --noEmit` OK；`framework:sync` 写入 3 文件/游戏 + `:check` OK；`pnpm run verify` **PASS 14 ｜ WARN 0 ｜ SKIP 1（既有 `check:size` 未覆盖项，非本单引入）｜ FAIL 0**。
  - **CLK-01 工程自证（不替代 QA 复测）**：重建 `build:cocos:web` 后跑探针 ⇒ **CLK-01 PASS，仿真/墙钟 = 0.999**（墙钟 2.503s / 仿真 2.500s / 150 固定步；修复前 1.999）。顺带观察：P4S-03 墙钟有效闪烁 **2.01 次/秒**（修复前 3.35–4.49；§3.8 判据 ≤2）—— 已回到**贴线**量级，是否须为红线留余量归 QA/策划裁定，本单不判。
  - **改动文件**：`packages/framework/src/compose/app.ts`、`src/adapters/cocos/loop-bridge.ts`、`src/adapters/cocos/bindings.ts`（**仅注释订正**，理由见上）、`tests/compose/app-host-driven.test.ts`（新）、`tests/adapters/cocos-loop-bridge.test.ts`（+1 例）；镜像拷贝件由 `framework:sync` 产出。**未 commit / 未 push**；主表 `TASKS.md` 状态行更新归主理人。
- **主理人独立复核（2026-09-16，事后非采信自述）**：
  - **API 已核**（`app.ts:62-66` `_hostDriven` 粘性标志、`:112-114` getter、`:120-131` `start()` 在宿主驱动态**抛错**）：两路 start **共用抽出的 `_init()`** ⇒ **viewport re-fit / `game.init` / onHide/onShow 全量保留** ✅ —— `bindings.ts:108-110` 那条「loop start 之后 `_fitToGameCanvas()`」的时序前提**原样成立**，陷阱避开了。
  - **`loop-bridge.ts:49-50`** 已改走 `startHostDriven()` + `schedule(_tick, 0)` ⇒ **单驱** ✅。
  - **CLK-01 自证已核**（`beads-browser-probe.log`）：**仿真/墙钟 = 0.999**（墙钟 2.503s / 仿真 2.500s / 150 固定步 ≈ 59.9 步/秒）✅ —— **1.999 → 0.999，BD-40 修复生效**。⚠️ 此项是**工程自证**，**QA 复测仍须另派**（不替代）。
  - **❗`bindings.ts` 的「仅注释订正」属实，但有一处须补记**：该文件工作树 diff 为 **+89/−24**，**绝大部分是 `WXG-T-104` 的未提交笔**（`touch-normalize.ts` **不在 HEAD** ⇒ T-104 笔未提交；`normalizeCocosTouch` / `_touchSpace()` / C1 注释订正皆其产物）；**本单改动确实只有 4 行注释**（`App.start()` → `App.startHostDriven()`）。⇒ **提交时同文件两单笔随行，勿按文件级拆**（同 `WXG-T-102` 的教训）。**成员回传未声明此点，属回传完整性缺口**（非行为问题，已代为补记）。
  - **门禁**：framework vitest **281/281**；`framework:sync:check` OK；`pnpm run verify` = **PASS 14 ｜ WARN 0 ｜ SKIP 1 ｜ FAIL 0** ✅。
- **主理人裁定（成员四项未决）**：
  1. **光敏红线贴线（`P4S-03` 墙钟 ≈2.01 次/秒）= 不改 500ms 门**。**理由**：2.01 与 2.00 之差在**帧量化分辨率内** —— 一帧 ≈16.7ms ⇒ 500ms 门的实测起点间距落在 500±8ms ⇒ 折算 **1.97–2.03 次/秒**，**2.01 属测量分辨率噪声，非真超线**。⇒ **登记**：下轮 QA 须把「**判据的测量分辨率**」写进判据口径（否则后人会拿 2.01 当超线、或据此反向放宽）；**不得**为过线而调门限 —— 那是 `§3.8` 冻结值（≤2 次/秒）的实现参数，**改它 = 改光敏性安全余量的设计**，须文策渊裁定并走 §3 流程，工程/QA 都无权自裁。
  2. **`check:size` SKIP** → **backlog**（另议，不并入本单）。
  3. **主表状态行** ⇒ 本条已由主理人更新。
  4. **主表归档**（52 行 > 观察哨 20）→ **另议**；建议下轮跑 `pnpm run tasks:archive -- --detail-until-under=7000 --write`。
- **BD-40 关单口径**：**限 `[N]`/`[B]` 已验**（CLK-01 = 0.999）；**真机 1× 留 `[R]` 复核** —— weapp 真机 = **同一 Cocos 壳** + `WeappPlatform` 自驱 ⇒ 本修复经 `framework:sync` **同修**（成员已核实「真机宿主即 Cocos 壳」），但无 AppID 未实测 ⇒ **不得据本单宣称「真机时长正确 / 真机不闪」**；真机首验 **P0** 须含 `CLK-01` 同源复核（`T-119` DEV-01 口径）。

## WXG-T-121

- **名称**：**装置自测分档挂门禁（BD-39 · BD-40 并单）**
- **负责**：主理人(Qoder)　**状态**：🔄 **部分交付**（2026-09-16：CI 侧两条已闭合；`verify` 本地半边受 WXG-T-110 在飞阻塞）
- **并单依据（先取证再裁定）**：两条缺陷同根因（「门存在、但不跑」）、同处改（`verify` 步骤表 / CI）、同验收 ⇒ 并成一单。实测代价：
  11 件装置自测合计 **29.4s**、`ctx:check` **0.51s**、`verify` 现有各项相加 **13.8s**；`grep selftest .github/workflows/ci.yml` **零命中**
  ⇒ 本地与 CI **两条链都零覆盖**。全挂进 `verify` ⇒ 14s → 43s（+213%），反而诱发绕开门禁 ⇒ 结论 = **按实测耗时分两档**。
- **动手前抓到一条正在腐烂的自测（本单的直接证据）**：`context-usage-selftest.sh` 在 `3fa3be4`（改动前）与 `e9664da`（改动后）
  两个点同测都是 **FAIL=63** ⇒ 以「隔离 worktree 跑历史点」判定为**存量腐烂**，非本轮引入。两处根因同一形状「手写清单追不上正本扩张」：
  ① 桩只 `cp` `lib/` 两件，而 `check-context-budget.mjs` 后来 import 了 `lib/memory-index.mjs` ⇒ 桩里 `ctx:check` 崩在 `ERR_MODULE_NOT_FOUND`；
  ② 桩**手写** `ctx/index.json`（固定 5 文件）追不上生成物集合扩张（`ctx/BUDGET.md` 须入索引、`memory/INDEX.md` 须同源存在），且桩仓库无 `memory/`
  时 `ctx:build` 写生成物直接 ENOENT。修法 = 依赖**整目录通配** + **索引由被测生成器播种**（跑一次桩 build 再注入本轮度量文件）+ 预置写盘目录 ⇒ **63 → 0**（172 断言全绿）。
- **落码**：① 新增 `tools/scripts/selftests.mjs` 分档执行器 —— 三条规矩：**逐项执行永不短路**（K-036）、打 `STATUS: OK|SKIP|FAIL` 机读行
  （⇒ `verify` 接入只需往 `STEPS` 加一项）、**完整性守卫**（磁盘上未入档的 `*-selftest.sh` / package.json 里未入档的 `*:selftest` 入口 / 档位项脱钩 ⇒ 当场红；
  确实挂不上的须写进源码 `AWAITING` 并给理由 ⇒ 降为 SKIP，**不是通过而是没测**，`--strict` 判失败）。② `fast` 档 = 六件自测 **+ `ctx:check`**（BD-40 本体 0.3s，
  并入而非另挂一项 ⇒ 将来补 `STEPS` 一行同时闭合两条缺陷）。③ `package.json` 补 5 个入口（`ctx:usage:selftest`、`tasks:archive:selftest`、`ci:review:selftest`、
  `selftest:fast`、`selftest:heavy`）。④ CI `unit` job 加 fast+heavy 两步 ⇒ 自测覆盖 **11/11**。⑤ `worktree-authoritative-selftest.sh` 在 worktree 里播种
  `node_modules` 软链（兜 pnpm 10 对未安装 worktree 拒执；本机 pnpm 9.15.9 容忍 ⇒ 该风险本地**未能复现**，如实标注）。⑥ 回写 `docs/agent/commands.md`。
- **未改 `verify-all.mjs`（串行纪律）**：该文件正被并发 WXG-T-110 在飞改动（+43 行 `WARN` 态与新步骤）⇒ 同文件不抢改；
  改为在执行器里 `noteVerifyCoverage()` **每次运行点名**该缺口，免得又变成一件「只有 CI 跑、本地腐烂无人见」的事。
- **半入库登记**：HEAD 的 `package.json` 里 `check:host-tests` 入口指向**未跟踪**脚本（`git ls-files --error-unmatch` 证实）⇒
  它的 `:selftest` 留在 `AWAITING`（SKIP），待 WXG-T-110 收口后并入 fast 档。
- **验收（现场复跑）**：`selftest:fast` **PASS 7 ｜ FAIL 0**（≈6.5s）｜`selftest:heavy` **PASS 5 ｜ FAIL 0**（≈26s，断言 22/172/9/190）｜
  `ctx:usage:selftest` **172 断言 0 红**（HEAD 存量 63 红）｜`ctx:selftest` 仍 **9/0**｜`--strict` 正确因 `AWAITING` 判失败｜`pnpm run verify` **PASS 14 ｜ SKIP 1（check:size）｜ FAIL 0**｜`kb:check` 八重 ✅（活跃 49）。
- **沉淀 K-049**：自测夹具须由**被测生成器播种**、依赖按**整目录拷贝**，否则门禁一扩就整片假红；判「我改坏 vs 早就红」一律先取**历史点同测**证据。
- **余项**：① `verify` STEPS 加 `selftest:fast`（待 T-110）；② `check:host-tests:selftest` 入档（同前）；③ CI 首跑观察 pnpm 10 环境下 `ctx:selftest` 的 worktree 执行。

## WXG-T-124

**beads 美术 v1.3「丙案·双色温对撞」风格单（三件套 + 落码）** · 负责：林绘澄(art) + 主理人(Qoder) · 状态：✅ 完成（2026-09-16，真机截图待补）

- 起因：用户「review 美术设计，对标行业领先，需独立风格与质感」。主理人三方对账（规格×代码×真机帧）得 F1–F8；用户裁定风格=丙（双色温对撞）、落地=派林绘澄出草案、F5=独立立项。
- 本轮交付：
  - art/ 三件套升 v1.3：art-bible §3.1 UI token 冷底真源(F1)/§3.5 强调色纪律(F6)/§4.3+§6 拼图容器板+暖光 band(F2/F3/丙案)/§6+§8 珠子十层质感(F4)/§6 HUD 白胶囊+8齿齿轮+图标笔画+标签字号色(F7)/§6+§8 背景层次解锁(F8)；assets-spec §1.1 十层卡/§1.7 容器板+band/§1.8 背景层次；accessibility A5 新增 + B1/E1 F7④ a11y 假绿根治。
  - 落码（不撞并发两文件）：palette.ts DEFAULT_PALETTE 7 值换丙案冷底 token(F1) + 十层卡常量；bead-render.ts 六层→十层(L0a 接触阴影/L3b rim/L4a-c 软高光)；bead-render.test 重钉 13/13；framework:sync 镜像 2 件；beads 全量 typecheck 0 + 251 测试绿。
- view-model 落码补全（2026-09-16，排并发后）：view-model.ts 消费面全量——F6 textAccent 字段删除并由编译器找漏网逐处路由(五面板主钮+NEW BEST 角标→accent_primary 白字、选中点→hintBlue ≤8px、连击光/爆发光条→白、缎带/结算星→STAR_GOLD、finish 色带→accent_primary/adBadge)、F2/F3 容器板+暖光 band(B1-B6 全程态常驻)、F7 HUD 白胶囊+8齿齿轮+最小字号 28px(F7⑤ 22px 作废)、F8 背景三层冷色叠层；tuning.ts +24 几何常量(§1.7/§1.8/F7)；feedback-vfx 重钉 22/27→28/35px；beads typecheck 0 + 251 绿 + verify 14 PASS/0 FAIL + framework:sync 镜像 3 件。ux-spec §3 HUD 条款对齐(文策渊)待后续单。
- F1 过渡处置：textDim 值 #8B8578→#6E7288(严格更暗，闭合 F7④ 白底标签 4.74:1)；token 改名(text_secondary)与图标 re-route 留 view-model 阶段。textAccent 值本轮不动(语义混杂，盲改会误染选中点/连击光/星)。
- 未决(待用户/后续)：① success #3FBF6B 与珠色4同值是否走冻结变更；② 十层卡真机性能回退阀(合并 L4a+b 降 8 层)是否预授权；③ 单帧最坏 +624 图元。

## WXG-T-125

**beads §3.8 幽灵符号可见性冻结变更单（F5，独立于风格单）** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-16，真机截图待补）

- 起因：art 评审 F5——EMPTY_GHOST_ALPHA=0.20 + EMPTY_TINT_MIX=0.35(§3.8 冻结常量)真机上空槽目标色/幽灵符号几乎不可读，削弱「同色入格」第一道解锁。
- 拟变更：EMPTY_GHOST_ALPHA 0.20→0.32、EMPTY_TINT_MIX 0.35→0.42。
- 流程(§6 冻结变更)：用户确认改值 → 主理人评估连带影响 → 落 systems-index §3.8 值 + §6 变更记录行 → palette.ts 两常量同步 → 探针 A2b 复验(幽灵符号可见性) → 下游(QA 判据/assets-spec §1.2 引用)对齐。
- 与 T-124 解耦：本单只动两个 §3.8 冻结常量，不涉丙案风格；风格单 v1.3 文档已注明「幽灵符号可见性由本独立变更单处理」，不改值。
- 施工记录（2026-09-16，用户拍板甲=按拟定值）：① systems-index §3.8 两值 + 文首版本行 v1.21；② changelog v1.21 行；③ palette.ts 两常量 + framework:sync 镜像；④ assets-spec §1.2 E1/E4 数值 + [v1.3·F5] 声明闭合；⑤ beads 全量 251 绿 + typecheck 0（断言全引常量零改动）；⑥ A2b 指令流探针 2/2（TC-PER-01 [Probe]：全关卡 E1 去重数 ≥ 关色数 + E4 ink α=0.32），探针临用临删。
- 待补：Cocos 产物截图肉眼比对（R1+R2 道次）受构建阻塞，真机可达后补验（changelog v1.21 已诚实记录）。

## WXG-T-126

**beads ux-spec §3/§5/§7 HUD 条款对齐（v1.3 落码事实回写，F7①②⑤/F6）** · 负责：主理人(Qoder) · 状态：✅ 完成（2026-09-16）

- 起因：WXG-T-124 遗留项——view-model 落码后 ux-spec 侧 HUD 条款仍停在 v1.2 事实（无白胶囊/齿轮样式/字号 floor；§5 选中圆点未锁色，原实装暖橙已随 F6 作废）。并发热写已停（ux-spec.md mtime 隔夜）后施工。
- 对齐五处（引用真源不复制数值）：① §3.1 补 HUD 视觉落地条（白胶囊 220×64 + 时钟 Ø36 accent_blue + 8 齿 Ø48 accent_purple，几何/色彩真源 assets-spec §1.5，本表只锁信息分区与热区；线框 ⚙88×88 澄清为热区）；② §3.1 补 F7⑤ HUD 小字 28px floor（v1.2 22px 作废）+ 冷底小字 text_primary；③ §5 托盘选中圆点锁 accent_blue ≤8px（F6 环状提示纪律）；④ §3.3 E2 大字号基准写明 28×1.25=35px；⑤ §7 可访问性表新增「字号」行。版本行挂 WXG-T-126 变更记录。
- 边界裁决（诚实口径）：§3.2 冲刺 HUD 差异仍标「提案」——代码已落码（SCORE / ×multiplier / COMBO，view-model.ts 冲刺 HUD 块）但布局与提案线框有差（连击窗口进度条/梯级进度点未核）⇒ 提案转正需设计侧比对落码几何，**另立单**，本单不越界。
- 验证：纯文档单（仅 ux-spec.md），零代码改动；check:links 过。
