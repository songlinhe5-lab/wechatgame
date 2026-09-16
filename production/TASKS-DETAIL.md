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

## WXG-T-103

- **名称**：**音频裁定包补做（冲突 C1 / C3）——T-098 漏列项**
- **负责**：文策渊(design-strategist)　**状态**：✅ 完成（2026-09-15；**A05-09 本体仍记 ⛔**，因探针未同步）
- **背景（主理人认错）**：`g4-regression-report.md §19`（T-096 轮）建议第 4 条已明文「C1/C3 随 T-098 一次性打包给文策渊」，但主理人写 T-098 任务书时**漏列**该两项 ⇒ 另号补做，不把范围 retroactively 扣到 T-098 头上。**C1** = `A05-09` 把「伪震屏 scale 1.015」写成 `sfx_combo_t3` 的同帧主体，而 §1 行 7 与 `combo-vfx.ts:46-50`（tier=2→pseudoShake、tier=3→burst）均表明**伪震屏属 Lv2** ⇒ 子句不可判定（QA 记 ⛔）。**C3** = `audio-events §1` 时长列 7 处非纯数字 ⇒ `[B]` 实测无期望值可比。
- **Deliverables**：① C1 —— `audio-events §4` 判据主体改到正确梯级（t2）+ t3 侧另立子判据，并逐行核 §1 全部 combo 梯级有无同类错置；② C3 —— 7 处逐条分流（**甲** = 可凭 §3.12 / `ux-spec §5` 现有值定写；**乙** = 保持 `[TODO]` 但写成**可解除**的 `[TODO]`，标解除条件与「实现占位值不得回引为规格」）；③ 两篇各补总口径一句；④ 零新拟增常量（`audio-spec §7.2` 复核确认）。
- **完成记录（2026-09-15）**：① **C1**：`A05-09` 主体 `sfx_combo_t3` → **`sfx_combo_t2`**，t3 的「350ms + 同帧」另立 **A05-09b**（挂 `burst`）；§1 全部 combo 梯级逐行核过，**同类错置仅此一处**。主对话顺带清掉同源错置注释 `src/config/audio-voices.ts` T2/T3 两行（纯注释，无行为变更）⇒ `framework:sync` 已重镜像。**编号采 `b` 后缀，不做整体重排**（重排会牵动台账与已有证据引用）。② **C3**：**5 甲**（`urgent_beat ≤1000` 周期窗口、`tray_full ≤500`【主理人裁甲：沿用 §5 500ms 上限，非期望值】、`stage 500`、`star 150`、`revive_ok ≤400`）/ **2 乙**（`ui_tap` 解除条件 = Q-A05-1 裁决；`bgm_main` 循环点 = A05-21/22 `[B]+[R]`）。总口径入两篇文首与 §4.3。③ 零 §3 改动、零伪数值。
- **约束**：成员只允许写 `design/audio/audio-events.md` 与 `audio-spec.md`；**禁改** `src/**`、§3、`production/**`（含 QA 文档）。
- **残留（不得归零）**：① **A05-09 本体仍 ⛔** —— 探针与 `test-cases` 需按新主体同改后复跑（成员无 `production/**` 写权限），已登 backlog，与 T-102 的 P4 复跑同批；② `audio-spec §9` 判据总数 27→28（含 A05-09b），QA 侧若不接受 `b` 后缀需整体重排（成本高，已否）。

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
