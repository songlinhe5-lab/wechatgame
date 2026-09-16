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
- **状态更新（2026-09-16）**：🔄 进行中——**可测半 ✓ + 编辑器半「落码部分」✓（含产物截图验证）**；仅剩编辑器/PREVIEW **目视**一步（G3 维持不关闭直至目视通过）。
- **✅ 编辑器半「落码部分」完成（2026-09-16 · 主理人代行）**：**修正原认知 —— 落码不需要编辑器**（原「待编辑器落码」捆绑了「落码」与「目视」两件事）。本轮已落码 `bindings.ts wrapLabel`：
  - ① **`measureWidth(text, fontSize)` 已实现**：调用序保证 renderer 先 `setFontSize`/`setText`（cocos-renderer.ts :165-166），故直接 `updateRenderData(true)` 后回读 `UITransform.width`；返回 0 时 `_measureTextWidth` 自动退回 `FALLBACK_CHAR_WIDTH_RATIO` 估算（零风险，防御已内置）。
  - ② **`setAlign` 已实现**：映射 `HorizontalTextAlignment[align.toUpperCase()]`（T-050 纠正的枚举真名），未知值回退 CENTER。
  - ③ **编译验证**：`pnpm --filter @wxgame/beads run build:cocos:web` 无头构建通过 —— bindings.ts 的 `cc` 类型被真实编译，枚举名/属性合法性由构建器背书。
  - ④ **产物截图验证**（复用 T-099 B1 的 `cocos-vision-shot.mjs`，750×1334，`production/qa/beads/evidence/vision/raw.png`）：白胶囊 HUD 居中 ✓、`LV 1/8` 右对齐 ✓、全部 Label 文字无错位 ⇒ `setAlign`/`measureWidth` 上线零回归。已随 `d79d10c` 入库。
- **剩余 = 仅目视**：① 原验收「编辑器 PREVIEW 目视」；② 或用户认可「Cocos 产物截图替代编辑器目视」⇒ G3 可关（截图已附）。**待用户裁定目视形式后关单**。
