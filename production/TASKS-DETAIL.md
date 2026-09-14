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
- **负责**：主理人(Qoder)　**状态**：⏳ 待启动
- **Deliverables**：① GAP-04：落 `filled/empty/locked/hint/wrong/selected` 六态中缺失的视觉反馈（错误抖动+描边闪 ≤2 次/秒按 §3.8、hint 高亮、combo 连击 VFX）；② GAP-03：首屏引导三通道（0 文字教学按 T-081 裁定后的条文落地——视觉演示/手势/箭头，消解 ux-spec §1 vs §6 矛盾）；③ GAP-10：倒计时告急脉冲（图标+颜色+脉冲三通道，§3.8「告急表达」）。
- **约束**：VFX 走命令层 emit、渲染层只读（L5）；时长走 ux-spec §5 动效毫秒表冻结值；BD-04 已由 R2 升 P0（关键反馈零通道）。可访问性 D1/E2 开关归 T-088，本单只做默认视觉反馈本体。
- **依赖**：硬前置 T-081（引导裁定）+ T-084（可感知判据）。与 T-085 共享 `view-model.ts`/`bead-render.ts` → **须与 T-085 串行**（先 T-085 后 T-087，避同文件竞写）。

---

## WXG-T-088

- **名称**：beads·**R1=甲 D1/E2 可访问性开关落码**（波次2，用户拍板 R1 全做）。根治 accessibility D1/E2 第三次假绿：三文档冲突消解 + 真实装设置字段。
- **负责**：主理人(Qoder)　**状态**：⏳ 待启动
- **Deliverables**：① `BeadsSettings` 落 `reduceMotion` + `largeText` 字段（`save-schema.ts` + version 升位迁移）；② 回写 `pause-settings §2.2` 冻结清单 + `ux-spec §3.3` 线框使三文档一致；③ `accessibility.md` D1/E2 由假绿 ✅ 改为真实落地后 ✅；④ 消费端接线：`reduceMotion`→抑制 T-087 的 VFX/脉冲，`largeText`→字号放大系数。
- **约束**：`save-schema` version 升位须带向后兼容迁移（旧档不炸）；E2 字号若触 §3 冻结常量走 §6 变更记录串行落。**不改** cocos bindings.ts（T-077 工作面）。
- **依赖**：软前置 T-087（`reduceMotion` 要有可抑制的 VFX）。与 T-085/086 文件面不冲突。

---

## WXG-T-089

- **名称**：beads P0·**GAP-07/08 harness 坐标契约落码（ADR-0011 裁决落地）**（波次2）。承接 T-082 ADR-0011（坐标契约=CSS px，DPR 由 renderer 承担）。
- **负责**：主理人(Qoder)　**状态**：⏳ 待启动
- **Deliverables**：① GAP-07：`dev/harness/main.ts` `fitCanvas`/`pushPointer` 对齐 CSS px 契约（harness 是唯一越界者——框架 `compose/app.ts` L104-105 用 CSS px 正确，改 harness 送 CSS px 坐标，使点击映射回设计空间）；② GAP-08：`canvas2d-renderer.ts` L133-141 `fillText` 在 y-flip 下补偿（**收窄到 text case 内部**，禁改全局变换——矢量符号 ▲▽♥◐ 在 y-up 下自洽）。
- **约束**：GAP-07 真凶定位经主理人纠正＝harness 越界非框架 bug ⇒ **只改 `dev/harness/`，不改 `packages/framework/src/compose/app.ts`**（框架契约正确）；GAP-08 修复禁全局 transform 改动（否则符号镜像）。改框架源后须 `framework:sync` 同步 cocos 镜像（BD-20 教训）。
- **依赖**：硬前置 T-082（ADR-0011 + 取证）。仅影响 harness 路径（真机 Cocos 路径 GAP-07/08 结构上不复现，T-082 已反证）。

---

## WXG-T-090

- **名称**：**G10 ES5 转译致命缺陷修复**（波次2·spike 先行；用户拍板「先验证 spike 再裁 ADR-0012」）。T-082 Cocos 取证新发现——**beads 在真机路径也不可玩**：Cocos 构建 Babel 降 ES5 把 `[...seen]`（Set）编成 `[].concat(seen)` 不展开 → `patternColors()` 长度恒 1 → **8 关 BOOT 校验全失败、永远停在启动画面**。
- **负责**：程基岩(engineering-lead)　**状态**：✅ 完成（本环境可验面全绿；真机 runtime/微信 AppID 复验随 G4，未记假绿）
- **实测（修法甲）**：Spike 产物字节实锤 `[].concat(seen)`（Set 不展开→长度恒 1）；产物 `new Set()` 原生无 polyfill → 推翻「Array.from 需 polyfill」顾虑、`Array.from` 可行；`builder.json`/`program.json` 仅剩 `__version__` → 修法丙（提 target）无工程级开关不可控→已否。**6 处**（framework `storage.ts:40`/`object-pool.ts:112` + beads `levels.ts:78/:245`/`powerups.ts:106/130`）改 `Array.from`，类型级 AST 全仓复扫 78 文件零第 7 处，安全展开未动。CI 守卫 `check-es5-spread.mjs`（TS 类型+AST，fail-closed，不依赖 Cocos）入 `verify` 链，selftest 红→绿双向。**复验**：`verify` exit 0（659）、`sync:check` 绿、重建 web-mobile `[].concat(seen)`=0/`Array.from(`=6；从 bundle 切出转译后 `patternColors` 在 Node eval 喂 L1–L8→色数 ∈[3,10]（BOOT 判据可过），反证换回 concat→`[object Set]` 长度 1。**未跑**浏览器加载（沙箱禁监听 socket）与真机 runtime → 归 G4/AppID（EP-10 保持环境阻塞）。
- **Deliverables**：① **Spike**（先验证不裁 ADR）：确认目标平台最低 ES 版本、复现 `patternColors()` 降级失效、对比 `Array.from`/显式循环两种改法的转译产物；② 据 spike 结论**裁 ADR-0012**（转译目标 vs 源码规避 Set 展开）；③ 修复落码：`core`/`levels`/`powerups` 内所有 `[...set]`/`Set` 展开模式统一改法；④ **CI 守卫**：加检查（grep/lint）防 `[...Set]` 展开回归；⑤ `framework:sync` + 真机 `build:cocos:web` 复验 8 关 BOOT 通过。
- **约束**：**spike 结论出来前不裁 ADR-0012、不落修复码**（用户明确「先验证再裁」）；改 core 守 L2（不碰 cc/DOM/wx）；修复须覆盖全部 Set 展开点（非仅 `patternColors`），否则漏点仍锁死。
- **依赖**：硬前置 T-082（G10 发现 + 取证）。**优先级最高**——这是真机路径的第一道锁，早于 GAP-01（harness 路径）。
