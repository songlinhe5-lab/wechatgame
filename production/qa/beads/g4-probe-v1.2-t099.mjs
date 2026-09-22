/**
 * beads G4 复验探针 · **WXG-T-099 专用切片** v1.2-t099
 *
 * 来源：由 `g4-probe-v1.1.mjs` **按行切片**拼接 —— 「头注 + imports + helpers」段 + 三个被前序段
 * 夹住但仍需的 helper（`panelCenter` / `fillBoard` / `enterSprintGameOver`，按 v1.1 行号整块搬移）
 * + 「P28a..j / P29a/b 段 + 汇总」段。**不手抄**，切片锚点 = `P1 · 空槽目标色` / `// ═══ P28a`。
 * v1.1 的 helpers 若有变更，本切片需**重新生成**，否则两端口径会漂移。
 *
 * 为什么要切片（**诚实登记，非省事**）：v2.0 玩法反转（WXG-T-133 / `test-cases §J`）后，v1.1 的
 * **P1..P27 前序段已大面积不可跑** —— ① 自定义关卡缺 `swaps`（`levels-spec v1.2` 必需字段）
 * ⇒ BOOT 拒收（`L{id}: swaps 缺失或非数组`）；② **供料关停**（用户 2026-09-16 案 A）⇒ 开局托盘
 * 恒空，凡依赖「首供 / 托盘有珠」的段直接崩溃（实测崩在 P4 `s.traySlots[held].colorIdx`，
 * held=-1）。**修前序 27 段不在 WXG-T-099 范围内** ⇒ 本切片只跑本单新增的 12 条；前序段
 * **不修、不判**，其失效已作为待办登记（不得读作「前序段仍绿」）。
 *
 * 运行：node production/qa/beads/g4-probe-v1.2-t099.mjs
 * 产出：production/qa/beads/evidence/g4-probe-v1.2-t099.log
 */
/**
 * beads G4 复验探针 v1.1（严守真 / WXG-T-092，波次 3）
 *
 * 定位：`g4-probe.mjs` v3 是**修复前基线**（报告 v1.0）。本文件把「波次 2 代码级自证」
 * 升级为「探针他证」，逐条 P1–P19 重判 + 新增 P20–P26 补测。
 * 判据来源一律取 **回写后的 GDD §8 / UX §5 现文**（不是上一轮报告里的旧预期值）。
 * v1.1 取 T-091 回写后的 §8 现文；**WXG-T-098 起：P4 / P20 / P26 三条改取 T-098 回写后的
 * `tray-spawner §8-1 / §8-3` 与 `ux-spec §5` 现文**（其余各组仍沿用各自最近一次复核的现文），见修订 38。
 *
 * 只读纪律：不改 `games/beads/src/**`、`design/**`、`art/**`；复用 `harness:build` 产物。
 * 运行：node production/qa/beads/g4-probe-v1.1.mjs
 * 产出：production/qa/beads/evidence/g4-reverify-v1.1.log
 *       （WXG-T-096 复跑轮：整轮 evidence/g4-reverify-v1.2.log + P5 段摘录
 *        evidence/g4-reverify-v1.2-p5-excerpt.log；**该轮只修订 P5 段预期值**，见修订 28）
 *       （WXG-T-098 改判轮：evidence/g4-reverify-v1.3-t098.log；**该轮只改 P4/P20/P26 三条
 *        预期值后整轮重跑**，见修订 38）
 *       （WXG-T-097 轮：P8/P10（BD-15/BD-16，修订 39，evidence/g4-probe-v1.2-t097bd15.log）与
 *        P7/P5·A05-14（BD-10，修订 40，evidence/g4-probe-v1.4-t097bd10.log）
 *        四条改取回写后现文重建预期值后整轮重跑）
 *
 * ── v1.1 修订（承接 v3 的 1–13；本轮新增 **14–27**，全部为**探针自身**预期值/口径修正）──
 *  14. 【严防假 FAIL】P9/P12/P18 的期望值改取回写后 §8 现文：
 *      `tray-spawner §8-2` 已由「±20%」改判为**卡方拟合优度 α=0.05**（临界 19.675，df=11）——
 *      沿用旧 ±20% 会把「判据更新」做成假 FAIL；`input-control §8-2` 已裁定重叠区以 §8-4 为准
 *      （BD-23 关闭 ⇒ 不再记 PASS*）；`save-progress §8-9` 已改「156 落子 + 结算帧 = `level:cleared`」。
 *  15. 【严防假 PASS】P1 不再用「空槽填充色去重 > 1 种」这种**弱断言**（同色两档也会过）——
 *      改为**逐色独立复算** `mixWith(slot, beadColor(c), EMPTY_TINT_MIX)` 并逐格比对，
 *      另断言 E4 幽灵符号 α == `EMPTY_GHOST_ALPHA`；缺任一层即 FAIL。
 *  15bis. 【本轮实测才抓到的探针缺陷，5 处；旧版会造出假 FAIL/假 PASS】
 *      (a) `game.snapshot` 是**每帧复用的活对象**：P3/P4 原先把 `s0/sn` 引用留到 rec() 才读，
 *          读完已是 200ms 之后的态（wrongProgress=0、hint=(-1,-1)）⇒ 改为**当场拷标量**。
 *      (b) P9 热区探针**忘了先选珠** ⇒ 命中 `beads-game.ts:1371`「无选中直接 return」⇒ 全 none 假 FAIL。
 *      (c) P11 §8-9 的 `routed` 原先统计**全部**已订阅事件（含 tray:spawned）⇒ 双指断言恒 >1（假 FAIL）；
 *          改为只计输入路由产物（tray:selected / bead:placed / bead:rejected）。
 *      (d) P12 卡方原先事件游标写错（`slice(got)`）且**不排水** ⇒ 样本被「空闲槽集变化」污染，
 *          χ² 被伪做到 760（假 FAIL）；沿用 v3 修订 3 的白盒排水夹具（spawner.ts:176-186 路径不变）。
 *      (e) P22 D1 三个通道实例原先**未开 reduceMotion**（默认实例）⇒ 测的是「动画态是否为静态」，
 *          假 FAIL 与假 PASS 双向风险；本轮每通道实例均预置 `settings.reduceMotion=true`（读档回显路径）。
 *      (f) P22 wrong 描边在 **fx 窗口后**才取（WRONG_FX_MS=200ms 已过）⇒ 恒 0；改为窗口内取最大。
 *      (g) P10 以「点击前一帧 vs 后一帧的非文本签名不等」判“有轻提示”⇒ 被 hint 呼吸/首珠脉冲的
 *          **常态动画**伪满足（实测恒 true = **假 PASS**）；修订 25 改用同 seed 配对差分。
 *  16. 【严防假 FAIL】P3/P19 不再以「`CellState` 无 hint/wrong」为实现缺失——
 *      T-087 的实现载体是 **snapshot 覆盖层**（`hintRow/hintCol/wrongRow/wrongCol/pulseClock`），
 *      数据模型未扩态属**规格措辞与实现分层偏差**（登记报告，不判缺陷）。判据改为**渲染指令层**断言。
 *  17. 【严防假 PASS】P4/P7 的动效断言一律**剔除 text 指令**并逐帧取相位样本，
 *      断「α 极值/过零点 ⇒ 周期 ms」而不是「签名种数 ≥2」（后者会被倒计时秒数、抖动位移伪满足）。
 *      注：HUD 图标 α 在 `stroke` 的 rgba 里，`drawStateRing` 的 α 在 `rect.alpha` 字段——两处不得混取。
 *  18. 【探针口径修正】v1.0 P13 把 `screenToDesign(297,904)→(297,430)` 读作「y 轴折叠 = 缺陷征候」。
 *      复核：设计系 y 向上，**该翻转本身是正确行为**；GAP-07 的真根因是 harness `pushPointer`
 *      把 `clientX*dpr`（device px）喂给了按 CSS px 拟合的 viewport（见 ADR-0011 / eb0572d）。
 *      本轮判据改为①双向往返一致（含非 1:1 长宽比 letterbox）②device-px 当屏幕坐标喂入必**错位**
 *      （落点偏离 >50px；原「containsScreenPoint 拒收」在 screen=design 的 harness stub 下恒不成立，属**新探针缺陷**）
 *      ③**端到端**：以 CSS px 坐标经真实 `InputManager` 点击 → 命中预期槽/格。
 *  19. 【新增道次】P11/§8-9/§8-10 从「`tapDesign` 绕过 InputManager 的弱化通过」升级为
 *      **真实 `InputManager` + `Viewport` 路由**（同帧 20 压 / 双指同帧仅首触点）；
 *      `[Device]` 的真实触摸事件序仍 ⛔ 不作证据。
 *  20. 【白盒隔离】A′ 不变量探针（P21）只走**合法供料路径**计数，不使用 `giveTrayBead`；
 *      `giveTrayBead` 会绕过 `held ≤ demand` 而入盘死珠 ⇒ 用它测「死局不可达」是**假 FAIL**，
 *      仅在 P18（存档写入次数）与 P9（建立「有选中」前置）作为夹具使用并注明。
 *  21. 【陷阱复刻防护】P7 满槽态改由「不落子、让供料自然灌满」构造（A′ 下满槽仍可达，
 *      每颗都可落子），不再用 `giveTrayBead` 灌假满槽。
 *  22. 【统计功效】P20 的 60s 首供语义测量改在**自动落子循环**下做（保持 demand>0），
 *      避免「托盘满 ⇒ 供料被跳过」把 16 次压成 12 次造成假 FAIL；时基从「进入 PLAYING 那一帧」起算。
 *  23. 【暂停面板几何】`PanelRect = {xMin,yMin,xMax,yMax}`（pause-panel.ts:67-69），
 *      **不是** `{x,y,w,h}`；旧版按 `rect.x + rect.w/2` 取中心 ⇒ NaN 点击，开关永远打不开（假 FAIL）。
 *  24. 【判据不可构造 ≠ 实现缺陷】P26（§8-3 3:1 抽色在 D 下不可构造）记 **⛔**（本轮不可验，移交裁定），
 *      不记 FAIL；P20 的 60s 窗口开/闭区间歧义记 **PASS\*** 并登记 BD-27，不把判据缺陷算成实现缺陷。
 *  25. 【反馈类断言须排除常态动画干扰】一切「有没有反馈帧」类断言一律用**配对差分**
 *      （同 seed 两实例、同一帧号，一个做事一个不做事），不得拿相邻两帧自比（P10）；
 *      P3 因附带发现 BD-32（引导可达性缺口，非 §8 违约）由 PASS 降为 **PASS\***。
 *  26. 【一次一事：夹具不得复用可变态】P9 早期版本在同一实例上连测 11 个偏移 ⇒ 第一次落子后
 *      目标格已被占（后续帧变 filled）且 fixture 珠灌满托盘（giveTrayBead 返回 -1），
 *      导致「仅首偏移命中、其余 none」的**假 FAIL**；本轮改为每个偏移一个干净实例。
 *      同条另记：dx = BEAD_PITCH/2 为两格**等距并列点**，§8-4「最近格心」在此无定义，
 *      本轮只记录实际归属（实测归左格）而不判 FAIL。
 *  27. 【前置不足不得当作“缺失”】P6/P7 早期版本在满槽当帧就停采样，后续未再跨过供料间隔，
 *      导致 tray:full=0 被误读为「事件缺失」。本轮 P7 的满槽告警子例程改为**满槽后再推 1 个间隔**，
 *      使去重语义真正发生；P6 则删掉对该子句的断言并明示由 P12 取证（一处一事）。
 *  28. 【严防假 FAIL · WXG-T-096 复跑 P5】P5 段**预期值整体重建**（旧版 `rec()` 第二参写死
 *      `'FAIL'`，那是探针缺陷而非实测结论）。旧预期值的四点前提本轮已逐条读码 + 实测复核为**失效**：
 *      ① 框架侧已有真合成引擎 `platform/audio-synth.ts::SynthAudioBackend`；`web.ts:68-79` / `weapp.ts:155-179`
 *        在具备能力时（runtime 有 `AudioContext`/`wx.createWebAudioContext` **且** 游戏注入 `voices`）返回它，
 *        只有 `node.ts:64` 仍返回 `NullAudioBackend`（护单测）⇒ 旧文「三平台 backend 仍 NullAudioBackend」
 *        不成立，BD-05b 须按平台分别重判（见 `P5·S`）。
 *      ② 玩法音色表改由游戏侧注入：`Game.audioVoices` → `App`(`compose/app.ts:76-80`) →
 *        `Platform.createAudioBackend({ voices })`（ADR-0013）⇒ 「框架不持有 clip 库」这一批评的对象已换位，
 *        不得再据此判 FAIL。
 *      ③ `tuning.ts` clip 常量 3 → 19，`beads-game.ts:_subscribe()`(1054-1089) 已按 §1 触发源逐事件派发
 *        ⇒ 旧文「玩法事件音效**零派发**」与**同一条证据自己打印出的**
 *        `clip 去重=[bgm_main, sfx_select, sfx_place, sfx_ui_tap]`（evidence/g4-reverify-v1.1.log:20）**自相矛盾**。
 *      ④ 旧夹具 `mk().frame()` **从不调 `audio.flush()`**，而 `AudioScheduler` 的 `_time`/`_lastPlayed`
 *        只在 `flush()` 里推进（`core/audio/audio.ts:169-187`）⇒ 限流分档、心跳周期、同帧去重
 *        在这一轮之前**物理上不可测**；且包在 `audio.play` 外的 `played` 记的是**请求层**
 *        （含被限流丢弃的项），不是派发层——拿它数「≤2 次/秒」会恒偏大。
 *        本轮 `mk()` 增 `opts.flushAudio`（默认关 ⇒ 其余 25 组行为逐字不变）+ 派发层 `dispatched`
 *        + 请求层 `requests{id,minInterval,loop}` + `stops`，帧内序复刻 `App.tick`（见修订 30）。
 *  29. 【探针口径 bug】clip 常量统计 `startsWith('AUDIO_CLIP_')` 把**数字**常量 `AUDIO_CLIP_TOTAL=19`
 *      当 clip id 计入（v1.1 实跑打印出「20 个」、清单里赫然一个 `19`）⇒ 本轮加 `typeof === 'string'` 过滤，
 *      并把「三方集合相等」的账交给实测对账（A05-24），不再由探针自报数字。
 *  30. 【「同帧」定义落地】按 `audio-events §0` + `compose/app.ts:147-151`：
 *      `input.beginFrame() → game.update(dt) → audio.flush(dt) → input.endFrame(dt)` = **一个 tick**。
 *      限流/周期类判据（A05-05/11/14/20）一律数**派发层**，参数类判据（A05-06 的 minInterval、
 *      A05-14/21 的 loop）数**请求层**——两层混用正是改判前后的口径断裂处，正文逐条注明用的是哪层。
 *  31. 【道次纪律】P5 只测 `[N]`：被 `[B]/[C]/[R]/[P]` 覆盖的条目（A05-03/09/15/16/22/25/26/27）一律记
 *      **⛔（本轮不可验）**，正文写明缺的是哪一道、缺的**主体**是什么（例：A05-09 的伪震屏在
 *      `view-model.ts:711` 明文未实现；A05-25 的 `[C]` 需重跑构建、本轮未跑）。混合道次条目
 *      （A05-01/04/13/14/18/19/21，另 P5·S）只在 `[N]` 子句实测通过时记 **PASS\***，并显式声明
 *      「**不**等于能出声／听感达标」（AGENTS §7 反假绿）。
 *      **【修订 44 · WXG-T-119 顺带项 ①】** `A05-09` 的同帧主体已按 `audio-events §4`
 *      **WXG-T-103 追正后**的现文，由 `sfx_combo_t3` 改为 **`sfx_combo_t2`**（伪震屏属 Lv2）；
 *      t3 的「350ms + 同帧 `burst`」另立 **`A05-09b`**（编号采 `b` 后缀、**不做整体重排**）。
 *      ⇒ 本条**不再是「判据主体待裁」**，T-103 的探针/台账残留**至此清零**。
 *  32. 【结构证据与出声证据分开记账】新增 `P5·S` 记录：注入假 `AudioContext` 只能证「装配正确 +
 *      节点确实被创建 + 未登记 clip 静默跳过 + loop 幂等走的是代码路径」，标题与正文均标
 *      **结构证据 ≠ 出声**，其结论不计入任何 A05 条目的验收。
 *  33. 【判据更新不得做成缺陷（沿用修订 14）】P5 改判源自**前提变化**，本身不算新缺陷；反过来，
 *      实测真没做到的事（漏事件、限流违 §3.8、清单不闭合）照实 FAIL，且**不因**「T-096 已交
 *      `audio-synth.test.ts` 15 例 + `audio-dispatch.test.ts` 26 例全绿」而替代探针他证（两条证据链分开记账）。
 *  34. 【夹具新鲜度自证 + 本轮实测到的不新鲜】`P5·S` 末段实测 `dev/harness/dist` 与
 *      `packages/framework/src/**`、`games/beads/src/**` 的 mtime。事实：本轮开跑前 dist 构于
 *      11:27:14，而 T-096 的 12 个源文件 mtime 为 12:05:18 ⇒ **不重建则探针量的是 T-096 之前的字节**（假绿风险）。
 *      因此本轮跑了一次 `pnpm run harness:build`（只写 gitignored 的 `dev/harness/dist`，不改任何跟踪文件），
 *      重建后由 `sRes.fresh.ok` 机验「dist 不早于 src」。`framework:sync:check` 实跑 EXIT=1（镜像不同步）
 *      与「新增镜像脚本无 .meta」两项**不自行修复**（越只读面），登记入报告 §15 建议 BD-33/BD-34。
 *  35. 【首跑自曝：三处**夹具缺陷**不得转判为实现缺陷】本单首跑（evidence/g4-reverify-v1.2.log 存档于
 *      `g4-reverify-v1.2-run1-fixturebugs.log`）除 P5·S 因变量作用域崩溃外，A05-11/12/13/17/18/19/20/21/23
 *      全片红。逐条回到代码/实测定位，**根因全在探针侧**：
 *      ① 自造关卡 5×4 + 2 色被 BOOT 校验拒收（实测三条 error，`levels.ts:120-158`）⇒ 实例永停 boot；
 *        修＝6×5 + 3 色（`validateBeadsLevel → []`，见 evidence/diag-p5-fixtures.mjs）。
 *      ② `clearAudio()` 内部 `flush(0)` 会把待账派发推上去**后又清空** ⇒ A05-21 的 BOOT bgm 派发恒 0；
 *        修＝先读账再清。
 *      ③ 面板按钮经 `InputManager` 链**收不到**：`_readInput()` 唯一调用点在 `playing` 的 onUpdate
 *        （`beads-game.ts:1147`），`paused`/`game-over` 无 onUpdate，而 `input.endFrame()` 会清 `justDown`
 *        ⇒ 齿轮后的 toggle-bgm / resume / 面板推进全部丢帧（实测：同坐标同帧下 `tapDesign()` 生效、
 *        输入链零派发零变更）。修＝本段面板驱动改回 `tapDesign()`（= 真 `_handleTap` 优先级路由，
 *        与报告 §3 驱动约定、与单测 `pause-settings.test.ts:69-71` 同口径）。
 *        ⇒ 这**不是** P5 的判据主体，不据此判任何 A05 条目 FAIL；作为附带发现登记 **BD-34**（若宿主按
 *        `input.push` 接线，四个面板态按钮均点不动；当前 `BeadsBootstrap.ts` 未接任何输入 ⇒ 需 [B]/[R] 定级）。
 *        同时写明：A05-18「遮罩零发声」子句**不得**走输入链——否则会因「根本没读输入」而平凡为真（假绿）。
 *  36. 【T-096 对本探针其他段的**反向污染**（P4 假绿，已修）】P4/BD-04 用 `/DISSOLVE/` 子串数「消除溶解动效常量
 *      是否已落 tuning」，而 T-096 新增的 `AUDIO_CLIP_DISSOLVE = 'sfx_dissolve'` 被同一个正则命中：
 *      实跑对比——v1.1 轮 `DISSOLVE=0`、本单首跑（未改 P4、仅重建夹具）变成 `DISSOLVE=1` 且「仍缺行」从两项
 *      没成一项 ⇒ 这是**音频 clip id 冒充动效常量**的假绿，不是实现的进步。现统一排除 `AUDIO_` 前缀
 *      （P5 自身两处正则一开始就带了 `!startsWith('AUDIO_CLIP_')`，本条是补上 P4 的遗漏）。
 *      同轮附带事实：其余 25 组**判定与 v1.1 逐条一致**（25/25），但 v1.1 日志是旧夹具（dist 早于 T-096）跑的
 *      ⇒ 本单重建夹具后 P4/P19 两处**证据文本**有差（P19：hint 目标格坐标 r0,c1→r3,c4，属关卡/供料时序变化，
 *      判定不变）；两者均不等于「重做过预期值复核」，报告 §4 仍需标「仅 P5 段随 T-096 复核」。
 *  37. 【终跑自检：判定与正文自相矛盾的一处，已收紧而不放宽】A05-14 在 `audio-events §4` 里**标签为
 *      `[N]`**，但判据**正文**含第二主体「托盘描边呼吸视觉独立按 500ms 循环，两者互不驱动」；该视觉
 *      半边同一轮由 P7 实测为「无呼吸时间轴」（= 已登记的 **BD-10**）⇒ 「互不驱动」无法双向成立。
 *      首跑该条只按音频半边算了 PASS，而正文却自陈「记 PASS*」——属探针**自身**的判定/叙述不一致。
 *      现按正文不按标签补 `partial` ⇒ 记 **PASS\***（P5 段计数随之变 PASS 12 / PASS* 8）；**不**把该
 *      视觉半边另算新缺陷，也不反过来为了维持 PASS 而删掉正文那句叙述。
 *      同轮自检：修订 31 原先把 A05-17/23 也列为「混合道次」，实核 §4 原文两条均为纯 `[N]`（星数由
 *      冻结阈值独立复算、静音可玩只断 pendingCount 与通关链路）⇒ 维持 PASS，并把 31 的清单改成与实判一致。
 *  38. 【**预期值取自 WXG-T-098 回写后的 §8 / §5 现文 · 三条改判 P20/P26/P4**】本轮**先改预期值、后重跑**
 *      （顺序不可倒置——报告 §18.3-6 惯例；先跑再凑预期 = 假绿）。三条改判**全部来自判据现文变化**，
 *      QA 不自加也不放宽任何阈值；实现未跟上的部分照实 FAIL。
 *      ① **P20 / BD-27**：`tray-spawner §8-1` 现文已把**窗口**与**容差**按两轴分列——
 *        **次数轴 ±0**（把窗口内事件按到达序一一映射到名义序号 i=1..16，第 i 次**名义时刻** = `4×(i−1)` s；
 *        缺一次 = FAIL、出现名义第 17 次 = FAIL）与**时刻轴单列**（`0 ≤ t_actual − 4×(i−1) ≤ 2 帧`，
 *        帧 = `GameLoop.fixedDt` 默认 `1/60 s ≈ 16.7 ms`，「帧」的定义正本 `systems-index §3 使用约定第 4 条`；
 *        **负偏差（提前）= FAIL**）。窗口 **t ∈ [0,60] 闭区间**按**名义时刻**计 ⇒ 第 16 次（名义 60.0 s）**计入**，
 *        其实际落点 60.033 s（滞后 2 帧）在新口径下合法 ⇒ v1.1 的 PASS\* 呈请随本条关闭。
 *        **旧字面严格读法（按实际时刻截断）在同一样本上仍是 15≠16 ⇒ FAIL** ⇒ 证据两读并列，
 *        避免把「口径变更」读成「数字变好看」。相邻间隔 `4.0 s ±0.1 s` 与「前提 = 供料不被满槽截断」（修订 22）沿用。
 *      ② **P26 / BD-28**：`§8-3` 现文判为**作废**而非「平凡真」（理由正本在该条第 3 子文：杂色集恒空 ⇒
 *        3:1 比例**不可观测**，给不可执行的断言盖章 = 伪绿）⇒ 探针侧**删除 3:1 断言**（脚本内不再有任何
 *        占比/权重统计），主记录记 **⛔ 不可验**（不记 PASS、不记 FAIL）；另开**负向用例 `P26-N`**
 *        （`decoys` 非空关卡 ⇒ 期望 BOOT 拒收、`phase=boot`、不进 PLAYING）。`P26-N` 属
 *        `levels-spec §2 / src/config/levels.ts` 校验判据，**不属 S4 §8-3** ⇒ 不得回填成 S4 的绿。
 *      ③ **P4 / BD-29**：`ux-spec §5`「放错拒绝」视觉列现文 = **单次脉冲**（α 0→1 淡入 60 / 峰值保持 80 /
 *        淡出 60 = 200ms，**一个 fx 窗口内 α 极值点 ≤1、不往复**）+ 连续拒绝 **重启门 500ms** ⇒ 有效 ≤2 次/秒。
 *        故把 v1.1 的成立条件「danger α 出现 ≥2 档（只证在闪）」升为两条**结构断言**：
 *        (a) 一个 fx 窗口内 α **峰点数 ≤1**（plateau 合并后计，新增 helper `countPeaks`）；
 *        (b) 连续拒绝时**两次脉冲起点间隔 ≥500 ms**（起点由 `snapshot.wrongProgress` 回零/回落判定，α 序列同帧并列）。
 *        实测仍为「2 次闪 / 200 ms」（`view-model.ts:521` `0.4+0.6·|sin(progress·2π)|` ⇒ 2 峰 = 10 Hz；
 *        `beads-game.ts:1524` 每次 mismatch 无条件重置 `_wrongFx.elapsedMs=0` ⇒ 无重启门）⇒ 本条**照实记 FAIL**，
 *        并按 §5 表下「实现落差登记」（:201）写明 **非新回归**：BD-29 由「规格互斥」**转态为「实现落差」**，
 *        改码已立项 **WXG-T-102**；`reduceMotion` 退静态半边（P22）已与新措辞一致 ⇒ **不重复开缺陷**。
 *      同轮口径自查：本轮**未**因数字难看而放宽（P4 是收紧后 FAIL），也**未**因数字好看而把 ⛔ 写成 PASS；
 *      未跑的门（G1–G3 全量、`[Cocos]/[Device]/[B]/[P]` 道次）继续按报告 §18.2 登记为未执行，不因本单改判。
 *  39. 【WXG-T-097/BD-15·BD-16 · P8/P10 改判（证据 evidence/g4-probe-v1.2-t097bd15.log）】
 *      P8 的「扩展」腿拆为「入口存在（已验）+ S4 出口（按 powerups §2.6 布局 A 不可达 = **BD-37**）」
 *      ⇒ 整条 4/5 可验且通过 = PASS*，不因占位实装而打 PASS；P10 改认新轻提示通道并对 **text 签名**
 *      差分（旧版只看旧字段与非文本签名 ⇒ BD-16 已落地仍报假 FAIL）。同轮另有**夹具改动**（非预期值
 *      改动）：`slotXY()` 改取 §3.4 v1.20 单一真源 `trayLayout()` ⇒ 所有「点槽」用例坐标整体上移。
 *  40. 【WXG-T-097/BD-10 · P7 + P5/A05-14 改判（第二主体 = 满槽描边呼吸已实装）】先改预期后重跑；
 *      两条改判均源于**实现变化**，不放宽阈值：
 *      ① **P7**：旧④以「托盘带非文本签名去重种数 uniq≤1 才算 PASS*」为成立条件 = **把缺失当预期**，已删；
 *        改为在主实例（本就是满槽 + 告急双主体同场）逐帧取 `tray_panel_danger` 描边 α，按
 *        `ux-spec §5`「2px danger 描边呼吸 500ms」量周期（±50ms，与 §8-10 现文同界）⇒ 实测 500ms / 2.00Hz；
 *        并新增⑤：`timer-gameover §8-10`「与满槽告警同屏叠加」由 **⛔ 不可测转可测**，按 `ux-spec §5:174`
 *        口径正本「闪烁 = **同一区域内** α 的往复」分区读（托盘 2.00Hz / HUD 1.00Hz各自 ≤3Hz），
 *        跨区域合成 3.00/s **不属该红线口径**但照实披露（既不据此判 FAIL、也不据此宣称在红线内）。
 *      ② **P5/A05-14**：修订 37 记的 partial（「互不驱动」只能单向成立）随第二主体到位而解除——
 *        补量ⓐ呼吸周期、ⓑ音不跟视觉循环（满槽期事件/请求增量均为 0，去重锁正本 `tray-spawner §8-4`）、
 *        ⓒ视觉不跟音（经真路由面板 mute 后呼吸仍在）⇒ 三方向同周期 = PASS。
 *      ③ 【首跑自曝：两处**探针自身缺陷**，不得转判为实现缺陷】(a) **装载顺序**：`loadHarness()` 内部才
 *        `stageDist()`（rm -rf `.smoke` 后重拷 `dist`），而它写在模块 import **之后** ⇒ `T`/`buildBeadsView`
 *        拿到上一轮旧 `.smoke`，新常量读成 `undefined`、新图元找不到（P7/A05-14 假 FAIL 直接根因）；
 *        已把 `loadHarness` 前置到 import 之前，并加一道「新常量不在内存模块就硬抛」防呆（修订 34 的
 *        dist↔src mtime 自证**不能**覆盖这个顺序问题）。(b) **夹具基线**：`tray:full` 不在满槽那帧发，
 *        而在下一次供料尝试发现无空位时才发 ⇒ 不等首次广播就会把「首次广播」误读成「重复广播」（事件增量
 *        0/1 看似违反 §8-4）；`fullTrayHarness()` 已改为等到首次广播，基线写进证据文案。
 *
 *  41. 【**真链口径**（WXG-T-114 · BD-34 回归闸门 · K-038）】P8/P10/P22 原本一律经
 *      `game.tapDesign()` 旁路（直调 `_handleTap`）驱动 ⇒ **旁路恒绿、真链恒断**；`_readInput()`
 *      只在 `_stepPlaying()` 内被调时，`paused`/`level-clear`/`game-over`/`finish` 四相位的真链点击
 *      **全部收不到**（BD-34，已由 WXG-T-100 修：上提到 `update()` 头部）。本轮**不删任何旁路例**，
 *      而是**新增真链口径**并用同一批交互断言同一结果：
 *      ① `mk()` 增 `tapChain(dx,dy)`：`beginFrame → push(down) → push(up) → game.update(dt) → endFrame(dt)`
 *        （与 `App._fixedUpdate` 同形；坐标 designToScreen→push→游戏内 screenToDesign 读回）。
 *      ② **P8R**（五类路由）/ **P10R**（无选中点网格）/ **P22R**（D1 开关，含 PAUSED 面板按钮）
 *        = P8/P10/P22 的**真链重跑**，逐条与旁路口径并列呈报（差异必须显式）。
 *      ③ **P27a..d** = **四相位真链门禁矩阵**（PAUSED / LEVEL_CLEAR / GAME_OVER / FINISH）：每相位
 *        一条「面板外零响应（负向）」+ 一条「面板按钮生效（正向）」；正负同相位并列 ⇒ 负向**非平凡真**
 *        （点击确实到达 `_handleTap`）。这正对 §8 现文「仅判据 8 覆盖 PAUSED，另三相位仅 §2.3 覆盖、
 *        无独立可测条目」的空缺，QA 侧拟增判据见 `production/qa/beads/test-cases.md §A4b`（**待设计侧
 *        文策渊确认**；`games/beads/design/**` 本单不改笔）。
 *      ④ 判定**不放宽**：真链断链即 FAIL。扩展 S4 出口按 BD-37 仍 ⛔ ⇒ P8R 记 PASS*（与 P8 同口径）。
 *      ⑤ **与 WXG-T-113 的边界（不得合并）**：丢帧「多子步下一次 touch 多指令」属 T-113（框架
 *        `App.tick` 子步 × `endFrame` 独占标志组合）；本组一律在**正常 60fps 单步**（直接
 *        `game.update(dt)`，不经 `app.tick` 多子步）下取证 ⇒ 与 T-113 互不覆盖，不得并入 BD-34 结论。
 *
 *  42. 【**次按钮真链孪生 + 去「拟」**（WXG-T-116）】上游 `WXG-T-115` 已把 `input-control §8` 的
 *      `8b/8c/8d` 三条门禁判据**定稿落盘**（含各自完整按钮集与可测形式），并把 `8c` 补齐**冲刺局子分支**
 *      （`_mode==='sprint'`：再来一局 / 返回关卡——与普通局按钮集不同）。本单做两件事：
 *      ① **去「拟」**：P27b/c/d 的标题与归属串由「TC-INP-11/12/13(拟) + 仅 §2.3 覆盖」改为正式编号
 *         **`input-control §8-8b / 8c / 8d`**（判据/阈值**一字未改**，只改引用与状态）。
 *      ② **补次按钮真链孪生**（本节新增 `P27e..i` 5 条，逐条对应条文新按钮子句）：
 *         - `P27e` = `8b` 次按钮「**去冲刺**」：LEVEL_CLEAR 真链点副钮 `sprint` ⇒ `mode=normal→sprint`、`playing`；
 *         - `P27f` = `8c` 普通局次按钮「**续时**」：GAME_OVER 真链点 `revive` ⇒ `watchingAd=true`（等回调），
 *           再经 **`MockRewardedAdProvider.settle('complete')`** 驱动发奖腿 ⇒ `playing`、`remaining += REVIVE_BONUS_SEC`、
 *           `revived=true`。**可达性判定**：按钮腿（真链）✅ 可达；发奖腿由 harness 替身（mock）驱动 ⇒
 *           结构链路成立，**不等于真机广告行为**（`[R]` ⛔；「未看完/失败」分支未测）⇒ 记 **PASS\*** 并显式声明边界；
 *         - `P27g` = `8c` 冲刺局子分支「**再来一局**」（`again` ⇒ `retryLevel()` ⇒ `mode=sprint`、`playing`）；
 *         - `P27h` = `8c` 冲刺局子分支「**返回关卡**」（`back` ⇒ `startNormal()` ⇒ `mode=normal`、`playing`）；
 *         - `P27i` = `8d` 次按钮「**去冲刺**」：FINISH 真链点副钮 `sprint` ⇒ `mode=normal→sprint`、`playing`。
 *        每条**正负并列**（同相位真链点面板外死区 `(30,53)` ⇒ 事件增量 0、相位不变）⇒ 负向非平凡真。
 *        **编号逻辑**：沿 `P27` 族续号（a..d 已占），`P27e..i` = 判据子按钮 1:1；`test-cases.md §A4b`
 *        侧对应 `TC-INP-11b / 12b / 12c / 12d / 13b`（后缀式，不重排既有 11/12/13）。
 *      ③ **纪律**：**先改探针、后改报告**；**先写预期、后跑**（预期取自 `input-control §8-8b/8c/8d` 现文
 *        与 `ux-spec §4/§3.4/§3.5/§3.6` 按钮集，非看输出回填）；**旁路例一条不删**；**不为凑绿放宽断言**。
 *      ④ **与 WXG-T-113 的边界同 §41⑤**（正常 60fps 单步，不经 `app.tick` 多子步）。
 *
 *  43. 【**WXG-T-118 · 只重跑 P4 + P7；P7 预期值收紧（BD-35 闭合）**】
 *      上游两单已闭合：**WXG-T-102**（BD-29 改码：wrong 描边改**单次脉冲** α 淡入 60 / 保持 80 / 淡出 60 = 200ms，
 *      `α 极值点 = 1`，加 **500ms 重启门**）与 **WXG-T-117**（BD-35 文档：`ux-spec §5:187` 告急行补
 *      `α 0.6↔1.0`@1000ms + 时钟图标同步切 danger + `reduceMotion` 静态化；并**顺带补齐 2 行同类缺** ——
 *      `:188` 满槽告警 `α 0.6↔1.0`@500ms、`:190` 目标格 `hint` `α 0.5↔1.0`@600ms；版本 v1.2 → v1.3）。
 *      纪律：**先改探针、后改报告**（报告 §18.3-6 惯例）；**先写预期、后跑**（本轮首跑即正式轮，无回填窗口）。
 *      ① **P4 = 纯重跑，预期值一字未改**：现行断言面（修订 38③）已在 WXG-T-098 落定的现文口径上
 *         （`pulseStructOk = pk.peaks <= 1` / `gateStructOk = minGapMs === null || minGapMs >= 500 - 1e-9`）
 *         ⇒ T-102 落地后实跑应为 **PASS\***（BD-04 三行残留照实，若残空则整条 PASS）。**故本条断言与阈值本次不动**；
 *         仅订正 P4 证据串中**随 T-102 已失效的代码锚点**（旧 `view-model.ts:521` / `beads-game.ts:1524`
 *         → 现 `view-model.ts:435-445 wrongFlashAlpha` / `beads-game.ts:1850-1854 _armWrongFx`），
 *         否则证据正文会与实测（峰点数 = 1、门 = 500ms）**自相矛盾**。**这不是预期值改动**，见 §汇总段分桶备注。
 *      ② **P7 = 预期值收紧（本轮唯一一处预期值改动，方向 = 收紧）**：
 *         (a) **删**「BD-35 钉住上限」注释与该 `v` 的**强制 `PASS*` 分支**（旧 `:1783-1790`）——
 *             BD-35 的升 PASS 前置（UX 侧在 §5 告急行补 α 数值）**已由 WXG-T-117 满足**；
 *         (b) **新增告急 α 幅度断言**：α 序列须**覆盖 `[0.6, 1.0]` 两端点**（真源 `ux-spec §5:187` +
 *             `tuning.ts:DANGER_PULSE_MS` 注「1→0.6→1」+ `view-model.ts:421-423 dangerAlpha = breathe(clock,1000,0.6,1)`）；
 *         (c) **顺带为满槽半边加幅度断言**：`:188` 现文亦已补 `α 0.6↔1.0`@500ms，该腿此前**只验周期、未验幅度**
 *             （真源 `view-model.ts:452-454 trayFullAlpha = breathe(clock,500,0.6,1)`）。
 *         **容差推导（唯一真源 = 波形几何 + 采样步长，禁止为凑绿放宽）**：源波形是**三角波**
 *         （`view-model.ts:409-413 breathe`：`α = lo + (hi−lo)·tri`），在半个周期内 α 单调 ⇒
 *         幅度斜率 |dα/dclock| = (hi−lo)·2/T；采样步长 Δt = `GameLoop.fixedDt` = 1/60 s = **16.667ms** 固定；
 *         采样点与真极值的**最大相位偏差 = Δt/2** ⇒ **读数对端点的最大偏差 tol = (hi−lo)·(Δt/T)**
 *         （**与相位起点无关的严格上界**）：
 *           · 告急 T = 1000ms ⇒ tol = 0.4 × 16.667/1000 = **0.006667**；
 *           · 满槽 T = 500ms  ⇒ tol = 0.4 × 16.667/500  = **0.013333**。
 *         结构旁证（**不替代**上界）：1000ms = **恰 60 帧**、500ms = **恰 30 帧**，采样窗（130 / 120 帧）均 ≥1 周期
 *         ⇒ 采样栅格覆盖全部相位点 ⇒ 实测偏差只应来自浮点累加（~1e-6 量级）。**tol 取上式上界，不反向调参**。
 *         判定：`|min − lo| ≤ tol` **且** `|max − hi| ≤ tol`（**两侧都断** ⇒ 欠幅与超幅都会 FAIL）。
 *         采样源 = HUD 时钟图标描边 α（`view-model.ts:465,471-472`：告急时 `withAlpha(danger, dangerAlpha)`）/ 满槽面板描边 α。
 *      ③ **范围铁声明**：本轮**只重跑 P4 段 + P7 段**。其余段（P1–P3、P5–P6、P8–P26、P27a..i 等）**不重跑**，
 *         判定与预期值一律沿用现行轮次 ⇒ **分桶计数不得合并解读**（同 v1.2/v1.3/v1.4/v1.5/v1.6 体例）。
 *      ④ **效力边界（必须随结论一起读）**：P4 本轮取证在**指令流层**（`RenderModel` 指令 α 序列），
 *         WXG-T-102 的 beads 单测在 **`[N]` 层**，二者**互补但不可互相替代**；**`[B]` 屏幕像素发光序列**与
 *         **`[R]` 真机观感（光敏性观感）仍未取证** ⇒ **不得据本轮宣称「光敏性红线已达标」**，
 *         只能宣称「**指令流层已符合 §3.8 的时序口径**」。
 *      ⑤ **只读顺带核查（不扩大范围、不改判）**：`:190` 目标格 `hint` 行现文补 `α 0.5↔1.0`@600ms ⇒
 *         仅查看 **P19 / P3** 的 hint 断言面：两者分别只断「环存在 + `lineWidth=2`」与「呼吸周期」，
 *         **均不含 α 幅度断言** ⇒ **不受本行改动影响**；实现 `view-model.ts:415-418 hintAlpha` 取
 *         `breathe(clock, HINT_PULSE_MS, 0.5, 1)` 与现文一致（无漂移）。幅度断言**可加但本轮不加**（属扩范围）。
 *
 *  44. 【**WXG-T-128 · P10 证据串叙述镜像（非预期值改动、本轮不重跑）**】上游 GDD/UX 已同批改写：
 *      `bead-grid §8-4` 与 `input-control §8-5` 的「锁定格/已填格 → 零事件、**零反馈**」判据，
 *      后半已由**用户 2026-09-16 裁定推翻**为「**零事件 + 极轻非惩罚反馈**」（被点格 scale 1.00→0.96→1.00 / 120ms；
 *      `reduceMotion` 开 ⇒ 1px `slot_border` 静态描边环）。P10 证据串末段原写「锁定格/已填格仍按 §8-5
 *      **零反馈帧**」⇒ 本条只把该叙述改为新口径，**不动任何断言、阈值、判定分支**：
 *      (a) P10 本体测的是 §8-7「无选中珠点 empty 格 → 零请求 + 文字气泡轻提示」，与 §8-5 的
 *          「锁定/已填格」是**互斥的两类被点格**（判据改写后仍互斥于该维度，只是反馈通道不同：
 *          文字气泡 vs scale 形变）⇒ **P10 的断言面不受影响、既有证据不失效、无需重跑**。
 *      (b) 现无 §8-5 的独立探针用例（`test-cases.md` TC-GRID-04 / TC-INP-05 均标「待实现」，两条已同批改写）；
 *          **G7 落码单须新增该探针用例**（断言 = 事件增量 0 **且** 命令流出现 scale 覆写），
 *          并按修订 25 的纪律用**配对差分**（同 seed、同帧号，ctl 不点 / tst 点）取反馈帧，
 *          不得拿相邻两帧自比（会被 hint 呼吸/首珠脉冲的常态动画伪满足）。
 *      (c) 本条属**证据文案与新判据的一致性维护**，与修订 43① 同型（订正已失效锚点/叙述，非预期值改动）；
 *          若沿用旧叙述，下一轮跑 P10 会产出「探针正文自述零反馈、而 GDD 已要求有反馈」的**自相矛盾证据**。
 *
 * 环境事实（禁止伪造）：无 AppID / 无真机 ⇒ `[Device]/[R]` 一律 ⛔；`[Cocos]` 像素级判据——
 * 波次 3（v1.1）当时 `framework:sync:check` 为✅、web-mobile 产物 mtime 2026-09-15 08:48；
 * **本单（WXG-T-096 后）复跑同一命令得 EXIT=1**（12 处 differs，evidence/framework-sync-check-v1.2.log）
 * 且构建产物未重跑（`cocos/build` 最新 mtime 仍 2026-09-15T00:48:40Z，早于音频实现）⇒ A05-25 仍记 **⛔**；
 * 沙箱禁监听 socket、无浏览器截图通路 ⇒ 像素/色盲模拟同样维持 ⛔，不得改判。
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const { loadHarness, STAGE } = await import(`${ROOT}/tools/scripts/lib/harness-runtime.mjs`);

// 【修订 40 新增·探针自身缺陷】`loadHarness()` 内部才 `stageDist()`（rm -rf .smoke 后重拷 dist）。
// 上一版把 `loadHarness` 放在下面的模块 import **之后** ⇒ `T`/`buildBeadsView` 等命名空间拿到的是
// **上一轮旧 `.smoke`**，新常量读成 `undefined`、新图元找不到（P7/A05-14 假 FAIL 的直接根因）。
// 修正：先把 harness 装起（⇒ `.smoke` 与 `dist` 同步），再 import 被测模块。
const boot = await loadHarness({ game: 'beads' });

const fw = await import(`${STAGE}/packages/framework/src/index.js`);
const { NodePlatform } = await import(`${STAGE}/packages/framework/src/platform/node.js`);
const { BeadsGame } = await import(`${STAGE}/games/beads/src/game/beads-game.js`);
const { buildBeadsView } = await import(`${STAGE}/games/beads/src/view/view-model.js`);
const P = await import(`${STAGE}/games/beads/src/view/palette.js`);
const { DEFAULT_PALETTE } = P;
const T = await import(`${STAGE}/games/beads/src/config/tuning.js`);
// 【修订 40】假 FAIL 防呆：只钉「本轮新依赖的常量已在内存模块里」，不判数值。
// 若不满足，一律是「忘先 `pnpm run harness:build`」或上面那条装载顺序问题，而非被测代码缺陷。
if (T.TRAY_FULL_PULSE_MS === undefined || T.trayLayout === undefined) {
    throw new Error('[probe] .smoke 模块早于被测源码（TRAY_FULL_PULSE_MS/trayLayout 缺失）⇒ 先跑 pnpm run harness:build 再重跑探针');
}
const { LEVELS } = await import(`${STAGE}/games/beads/src/config/levels.js`);
const { BEADS_AUDIO_VOICES } = await import(`${STAGE}/games/beads/src/config/audio-voices.js`);
// 【修订 45 · WXG-T-099】`rectsOverlap` 一并取出（§8-5 齿轮/面板与 `CAPSULE_AVOID` 的几何断言
//   走**实现侧同一函数**，探针不自写重叠公式——自写会把「胶囊判据」变成另一套口径）。
const { pausePanelLayout, rectsOverlap } = await import(`${STAGE}/games/beads/src/systems/pause-panel.js`);
const { clearPanelLayout } = await import(`${STAGE}/games/beads/src/systems/clear-panel.js`);
const { failPanelLayout } = await import(`${STAGE}/games/beads/src/systems/fail-panel.js`);
const { finishPanelLayout } = await import(`${STAGE}/games/beads/src/systems/finish-panel.js`);
// 【WXG-T-116】冲刺结算面板（`8c` 冲刺局子分支按钮集「再来一局 / 返回关卡」的来源）
const { sprintSettleLayout } = await import(`${STAGE}/games/beads/src/systems/sprint-settle.js`);
const { TRAY_BEAD_SIZE } = await import(`${STAGE}/games/beads/src/view/bead-render.js`);

const bootModel = boot.render(5);
console.log(`[boot] harness beads OK — draw cmds=${bootModel?.commands?.length ?? 0}`);

const TRACKED = [
    'tray:spawned', 'tray:selected', 'bead:placed', 'bead:rejected', 'tray:full', 'tray:expanded',
    'powerup:used', 'timer:tick', 'timer:urgent', 'level:cleared', 'level:failed',
    'game:paused', 'game:resumed', 'combo:up', 'combo:break',
];

// ───────────────────────────────────────────────────────── 装配 / 驱动 helpers
let probeNo = 0;
/**
 * 修订 28④/30：音频派发层的可观测面。默认 `opts.backend` = `NullAudioBackend`、
 * `opts.flushAudio` 不传 = **不 flush**⇒ 其余 25 组探针行为与 v1.1 逐字一致；
 * 只有 P5 显式传 `flushAudio: true`，按 `App.tick` 的帧内序驱动。
 */
function mkBackend(opts, probe) {
    const raw = opts.backend ?? new fw.NullAudioBackend();
    probe.raw = raw;
    return {
        play: (id, o) => { probe.dispatched.push(id); raw.play(id, o); },
        stop: (id) => { probe.stops.push(id); raw.stop(id); },
        stopAll: () => { probe.stops.push('*ALL*'); raw.stopAll(); },
    };
}
function mk(opts = {}) {
    const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: opts.pixelRatio ?? 2 });
    const storage = opts.storage ?? platform.createStorage();
    const events = new fw.EventBus();
    const input = new fw.InputManager();
    const audioProbe = { dispatched: [], stops: [] };
    const audio = new fw.AudioScheduler(mkBackend(opts, audioProbe));
    // 修订 28④：音频取证**分三层记账，不得混用**——
    //   requests   = 玩法侧**请求**（含被限流丢抛的）⇒ 证「哪个事件要求放哪个 clip、传了什么参数」
    //   dispatched = backend 实际收到的**派发**（帧末 flush 之后）⇒ 限流/去重后的真相
    //   stops      = backend.stop() 调用（BGM 静音通道判据 A05-21）
    const played = [], requests = [];
    const origPlay = audio.play.bind(audio);
    audio.play = (id, o) => {
        played.push(id);
        requests.push({ id, minInterval: o?.minInterval ?? 0, loop: o?.loop ?? false, volume: o?.volume ?? 1 });
        return origPlay(id, o);
    };
    const services = {
        events, input, audio, storage,
        rng: fw.createRng(opts.seed ?? `probe11-${++probeNo}`),
        viewport: new fw.Viewport(750, 1334),
        assets: new fw.NullAssetProvider(),
        platform: platform.info,
        rewardedAd: opts.rewardedAd ?? platform.createRewardedAdProvider(),
    };
    const saveKey = opts.saveKey ?? `wxgame.beads.probe11.${probeNo}`;
    if (opts.preSave) storage.set(saveKey, JSON.stringify(opts.preSave));   // 预置存档（设置开关/老玩家）
    const game = new BeadsGame({
        saveKey, ...(opts.levels ? { levels: opts.levels } : {}),
        ...(opts.sprintTime !== undefined ? { sprintTime: opts.sprintTime } : {}),
    });
    const emitted = [];
    for (const type of TRACKED) events.on(type, (p) => emitted.push({ type, p }));
    let writeCount = 0;
    const origSet = storage.set.bind(storage);
    storage.set = (k, v) => { if (k === saveKey) writeCount++; return origSet(k, v); };
    game.init(services);
    const baseline = writeCount;              // 修订 13：扣 init 期 normalize 写档
    const pt = { x: 0, y: 0 };
    let pointerId = 0;
    const step = 1 / 60;
    return {
        game, services, events, input, storage, audio, played, emitted, saveKey,
        dispatched: audioProbe.dispatched, stops: audioProbe.stops, requests,
        get rawBackend() { return audioProbe.raw; },
        get writes() { return writeCount - baseline; },
        advance(seconds) { const n = Math.max(1, Math.round(seconds / step)); for (let i = 0; i < n; i++) this.frame(); },
        /** 一个 tick = `App.tick` 的帧内序（修订 30）；仅 `opts.flushAudio` 时接音频派发。 */
        tickFrame(dt) { input.beginFrame(); game.update(dt); if (opts.flushAudio) audio.flush(dt); input.endFrame(dt); },
        frame() { this.tickFrame(step); },
        /** 排空 + 清零（`flush(0)` 不推 `_time` ⇒ 不打扰限流时钟）。 */
        clearAudio() { audio.flush(0); played.length = 0; requests.length = 0; audioProbe.dispatched.length = 0; audioProbe.stops.length = 0; },
        /** 真实输入链路：设计坐标 → CSS 屏幕坐标 → InputManager（修订 19）。 */
        tapScreen(dx, dy, id = ++pointerId) {
            services.viewport.designToScreen(pt, dx, dy);
            input.push({ id, x: pt.x, y: pt.y, phase: 'down', time: probeNo * 1000 + pointerId });
            this.frame();
            input.push({ id, x: pt.x, y: pt.y, phase: 'up', time: probeNo * 1000 + pointerId });
        },
        tapMany(dx, dy, n) {
            for (let i = 0; i < n; i++) {
                services.viewport.designToScreen(pt, dx, dy);
                input.push({ id: 100 + i, x: pt.x, y: pt.y, phase: 'down', time: 1000 + i });
            }
            this.frame();
        },
        /**
         * 【WXG-T-114 / BD-34】真链点击 —— 与 `App._fixedUpdate` 同形：
         *   `input.beginFrame()` → `push(down)` → `push(up)` → `game.update(dt)` → `input.endFrame(dt)`。
         * down/up 在**同一帧**内喂入（一次触摸占一帧；宿主把原生指针转成 `PointerSample` 的形状），
         * 坐标经 `designToScreen` 后**由游戏在 `update()` 里 `screenToDesign` 读回**——这正是
         * `game.tapDesign()` 旁路跳过的整段（旁路直调 `_handleTap`，恒绿而真链可整段断链，K-038）。
         */
        tapChain(dx, dy, id = ++pointerId) {
            services.viewport.designToScreen(pt, dx, dy);
            input.beginFrame();
            input.push({ id, x: pt.x, y: pt.y, phase: 'down', time: probeNo * 1000 + id });
            input.push({ id, x: pt.x, y: pt.y, phase: 'up', time: probeNo * 1000 + id });
            game.update(step);
            input.endFrame(step);
        },
        count: (t) => emitted.filter((e) => e.type === t).length,
        last: (t) => { for (let i = emitted.length - 1; i >= 0; i--) if (emitted[i].type === t) return emitted[i].p; return undefined; },
        reset() { emitted.length = 0; },
        hold() { return game.snapshot.traySlots.filter((s) => s.state !== 'free').length; },
        drain() {
            const idx = []; const slots = game.snapshot.traySlots;
            for (let i = 0; i < slots.length; i++) if (slots[i].state !== 'free') idx.push(i);
            return idx.length ? game.tray.clearSlots(idx).length : 0;
        },
        /** 合法自动玩家：每帧最多 1 条指令（选中 → 下一帧落子）。 */
        autoFrame() {
            this.frame();
            const s = game.snapshot;
            if (s.phase !== 'playing') return;
            if (s.traySelected >= 0) {
                const c = s.traySlots[s.traySelected].colorIdx;
                const i = firstEmptyOf(s, c);
                if (i >= 0) game.tapDesign(...cellXY(s, i));
                else game.selectTraySlot(-1);
                return;
            }
            for (let i = 0; i < s.traySlots.length; i++) {
                const sl = s.traySlots[i];
                if (sl.state === 'free') continue;
                if (firstEmptyOf(s, sl.colorIdx) >= 0) { game.tapDesign(...slotXY(i)); return; }
            }
        },
        autoPlay(seconds) { const n = Math.max(1, Math.round(seconds / step)); for (let i = 0; i < n; i++) this.autoFrame(); },
    };
}

function cmds(h) {
    const b = new fw.RenderModelBuilder(T.DESIGN_W, T.DESIGN_H);
    b.begin();
    buildBeadsView(b, h.game.snapshot, DEFAULT_PALETTE);
    return b.end().commands;
}
const cellXY = (s, i) => [
    s.gridLeft + T.BEAD_CELL / 2 + T.BEAD_PITCH * (i % s.gridCols),
    s.gridTop - T.BEAD_CELL / 2 - T.BEAD_PITCH * Math.floor(i / s.gridCols),
];
const TRAY_PITCH = T.TRAY_SLOT + T.TRAY_GAP;
const TRAY_LEFT = (T.DESIGN_W - (T.TRAY_COLS * TRAY_PITCH - T.TRAY_GAP)) / 2;
// v1.20（WXG-T-097/BD-15）：`TRAY_BAND` 上沿 420→450、托盘面板改**贴带上沿**，
// 槽心不再在带中线。探针不在此重推公式，直接取单一真源 `trayLayout()`：
// 旧版 `(yMin+yMax)/2` 在带加高后会整组脱靶 ⇒ 所有「点槽」类用例要么假 FAIL、
// 要么退化为永真断言（点了个空处）。
const slotXY = (i, rows = 1) => {
    const lay = T.trayLayout(rows);
    return [lay.slotCenterX(i % T.TRAY_COLS), lay.slotCenterY(Math.floor(i / T.TRAY_COLS))];
};
const GEAR_XY = [T.GEAR_HIT_SIZE / 2, (T.HUD_BAND.yMin + T.HUD_BAND.yMax) / 2];
const CARD_XY = (i) => { const r = T.powerupCardRects()[i]; return [r.x + r.w / 2, r.bottom + r.h / 2]; };

function firstEmptyOf(s, colorIdx) {
    for (let i = 0; i < s.cells.length; i++) {
        const c = s.cells[i];
        if (!c.void && c.state === 'empty' && c.colorIdx === colorIdx) return i;
    }
    return -1;
}
/** 首个可填且带目标色的格（colorIdx>0）；无则 -1。 */
function findEmpty(s) {
    for (let i = 0; i < s.cells.length; i++) {
        const c = s.cells[i];
        if (!c.void && c.state === 'empty' && c.colorIdx > 0) return i;
    }
    return -1;
}
const demandOf = (s, c) => s.cells.reduce((n, x) => n + (!x.void && x.state === 'empty' && x.colorIdx === c ? 1 : 0), 0);
const patternColors = (s) => new Set(s.cells.filter((c) => !c.void && c.colorIdx > 0).map((c) => c.colorIdx));

/**
 * 【修订 45 · WXG-T-099 · **夹具可构造性修复**，不是预期值改动】`levels-spec v1.2`（v2.0 错位装配）起
 * `swaps` 为**必需字段**：缺则 BOOT 拒收（`L{id}: swaps 缺失或非数组`）⇒ 本夹具造出的关卡在 v2.0 后
 * **全部进不了 PLAYING**，凡依赖自定义关卡的段会**假 FAIL 或直接崩溃**。修复 = 依 pattern 现文造出
 * 合法 swaps：取「**可填**（非 `.`/`x`）且**互不同色**（同色交换无效）」的格对，并给
 * `cycleProfile='short'` 与环长自洽（`misplaced 数 = swaps 数 + 环数` 恒等式自洽）。
 * 旧对象语义不变 —— `pattern/time/decoys/spawnInterval` 逐字保留，`swaps` 为**新增必需字段**。
 */
function probeSwaps(pattern, pairs = 1) {
    const rows = pattern.length, cols = pattern[0]?.length ?? 0;
    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const ch = pattern[r]?.[c];
            if (!ch || ch === '.' || ch === 'x' || !Number.isInteger(Number(ch))) continue;
            cells.push([r, c, Number(ch)]);
        }
    }
    const swaps = [], used = new Set();
    for (let i = 0; i < cells.length && swaps.length < pairs; i++) {
        if (used.has(i)) continue;
        for (let j = i + 1; j < cells.length; j++) {
            if (used.has(j)) continue;
            if (cells[i][2] === cells[j][2]) continue;   // 同色 ⇒ 「交换无效」，校验会拒收
            swaps.push([cells[i][0], cells[i][1], cells[j][0], cells[j][1]]);
            used.add(i); used.add(j);
            break;
        }
    }
    return swaps;
}
function probeLevel(id, cols, rows, time, spawnInterval, fill, decoys = [], pairs = 1) {
    const pattern = [];
    for (let i = 0; i < rows; i++) { let line = ''; for (let j = 0; j < cols; j++) line += fill(i, j); pattern.push(line); }
    return { id, name: `probe-${id}`, cols, rows, time, spawnInterval, decoys, pattern, swaps: probeSwaps(pattern, pairs), cycleProfile: 'short' };
}

// ───────────────────────────────────────────────────────── 渲染指令取证 helpers
const alphaOf = (c) => { const m = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/.exec(String(c ?? '')); return m ? Number(m[1]) : 1; };
const hex2 = (c) => { const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(String(c ?? '')); if (m) return '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('').toLowerCase(); return String(c ?? '').toLowerCase(); };
const inBand = (c, band, pad = 0) => (c.y ?? 0) + (c.h ?? 0) >= band.yMin - pad && (c.y ?? 0) <= band.yMax + pad;
/** 非文本指令签名（剔除 text，防 mm:ss 伪满足——修订 7/17）。 */
const sig = (cs, band, pad = 0) => cs.filter((c) => c.kind !== 'text' && (!band || inBand(c, band, pad)))
    .map((c) => `${c.kind}:${Math.round((c.x ?? c.x1 ?? 0) * 10)}_${Math.round((c.y ?? c.y1 ?? 0) * 10)}:${c.fill ?? ''}:${c.stroke ?? ''}:${c.alpha ?? ''}:${Math.round((c.w ?? 0) * 10)}x${Math.round((c.h ?? 0) * 10)}`).join('|');
/** 某色描边环（`drawStateRing` = rect，无 fill、有 stroke+alpha）。 */
const rings = (cs, strokeHex, band = null) => cs.filter((c) => c.kind === 'rect' && !c.fill && c.stroke
    && hex2(c.stroke) === strokeHex.toLowerCase() && (!band || inBand(c, band)));
/**
 * 三角波周期测量：取 α 序列的波谷（plateau 合并）间距均值。
 * 【修订 43 新增·纯增量】另返回端点读数 `min`/`max`（仅统计有限值），供 P7 的 **α 幅度断言**使用。
 * 既有调用方只读 `periodMs`/`periods`/`distinct` ⇒ 行为不受影响（七段计数不因本改动变动）。
 *
 * 【修订 44 · WXG-T-119】两处**顺带项**（T-118 §24.9 主理人裁定；**均不改判定逻辑**）：
 *   ① `A05-09` 主体 `sfx_combo_t3` → **`sfx_combo_t2`**，t3 另立 **`A05-09b`**（清 T-103 残留）
 *      ⇒ 全量条数 **66 → 67**（新增的 `A05-09b` 判据真源 = `audio-events §4` **WXG-T-103 现文**，
 *      **不是新造判据**；T-103 生效时台账即少了这一条，本轮补齐）。
 *   ② 删除 P4 证据串里的「折算峰频 **≈X Hz**」字段 —— 那是窗口**折算量**
 *      （= 峰点数 × 1000 / `WRONG_FX_MS`），**不是有效闪烁频率**；有效频率由 **500ms 重启门**
 *      给出 = **2 次/秒**（`systems-index §3.8`）。删字段是为防后人误读成「有效 5Hz ⇒ 超红线」。
 *   ⚠️ **本轮只改、未复跑**（本探针无 `--log`/`--out` 开关，复跑会**覆盖** T-118 的证据日志）
 *      ⇒ 报告 §24.1 的计数仍是**改前口径**；`g4-probe-v1.1.mjs` 的 `mtime` 晚于 `g4-probe-v1.1-t118.log`
 *      即本次改动的时间证据。改动面经 `node --check` 通过。
 */
function pulsePeriodMs(samples) {
    const uniq = samples.filter((v, i) => i === 0 || v !== samples[i - 1]);
    const troughs = [];
    for (let i = 1; i < uniq.length - 1; i++) if (uniq[i] <= uniq[i - 1] && uniq[i] <= uniq[i + 1]) troughs.push(i);
    const fin = samples.filter((v) => Number.isFinite(v));
    const min = fin.length ? Math.min(...fin) : null;
    const max = fin.length ? Math.max(...fin) : null;
    if (troughs.length < 2) return { periods: troughs.length, periodMs: null, distinct: new Set(samples.map((v) => v.toFixed(3))).size, min, max, n: fin.length };
    const gaps = []; for (let i = 1; i < troughs.length; i++) gaps.push(troughs[i] - troughs[i - 1]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    return { periods: troughs.length - 1, periodMs: mean * (1000 / 60), distinct: new Set(samples.map((v) => v.toFixed(3))).size, min, max, n: fin.length };
}
/**
 * 【修订 40 新增 · WXG-T-097/BD-10】真**满槽**夹具（供 P5·A05-14 与 P7④⑤ 共用）。
 * 满槽由 **A′ 合法供料自然灌满**（12 行×13 列 = §3.5 最大棋盘 ⇒ demand 足够；不落子 ⇒ 只进不出），
 * 不用 `giveTrayBead`（修订 21 同口径：白盒强灌会绕过供料不变量）。约 48s 满（`TRAY_BASE_SLOTS=24` × 2.0s；v1.42 丙档前为 12 槽 24s）。
 * `time` 由调用方定：只量呼吸选 420（不会被到期打断）；需「告急 + 满槽」同屏选 180。
 * 【为何还要等到首次广播】`tray:full` 不在满槽那帧发，而是在**下一次供料尝试**发现无空位时才发
 *   （spawner.ts:_feedOnce + _fullReported）⇒ 不等就会把「首次广播」误读成「重复广播」（本轮实测
 *   踩到：事件增量 0/1 看似违反 §8-4）。两处周期数字来自同一几何与同一 `pulseClock` ⇒ 必须一致。
 */
function fullTrayHarness(id, time, opts = {}) {
    const h = mk({
        ...opts,
        levels: [probeLevel(id, 13, 12, time, 2.0, (i, j) => String(((i + j) % 3) + 1))],
    });
    for (let f = 0; f < 60 * 60 && h.hold() < T.TRAY_BASE_SLOTS; f++) h.frame();
    for (let f = 0; f < 60 * 5 && h.count('tray:full') === 0; f++) h.frame();
    return h;
}
/** `tray_panel_danger`（BD-10）= 面板尺寸、无 fill、stroke=danger 的 rect；取其 α。 */
function trayDangerRing(cs) {
    const lay = T.trayLayout(1); // 几何单一真源（WXG-T-062）⇒ 探针不重推公式
    return cs.find((c) => c.kind === 'rect' && !c.fill && c.stroke
        && hex2(c.stroke) === hex2(DEFAULT_PALETTE.danger)
        && Math.abs((c.w ?? 0) - lay.panelW) < 1e-6 && Math.abs((c.h ?? 0) - lay.panelH) < 1e-6);
}
/** 连续 `n` 帧的满槽描边 α 序列（缺描边 ⇒ NaN，由调用方按「零通道」计）。 */
function trayBreathSeq(h, n) {
    const seq = [];
    for (let f = 0; f < n; f++) {
        const ring = trayDangerRing(cmds(h));
        seq.push(ring ? (ring.alpha ?? 1) : NaN);
        h.frame();
    }
    return seq;
}
const chi2 = (obs, exp) => obs.reduce((a, o) => a + ((o - exp) ** 2) / exp, 0);
/**
 * 【修订 38③ 新增】把一个逐帧量（此处 = danger 描边 α）压缩成「平台合并后的折线」再数**峰点**。
 * 用于 `ux-spec §5` 现文的结构性判据「一次 fx 窗口内 **α 极值点 ≤1（不往复）**」：
 * 单次脉冲（淡入→保持→淡出）⇒ 峰数 1；旧实现「200ms 内闪 2 次」⇒ 峰数 2 ⇒ FAIL。
 * 边界约定：序列首/尾视为基线（与 `-Infinity` 比较），故「从基线抬起再落回基线」恰计 1 峰；
 * 峰值平台（连续多帧等值，对应现文「保持 80ms」）经去重后只计 1 峰——**这正是单次脉冲的形状**。
 */
function countPeaks(samples) {
    const u = [];
    for (const v of samples) if (!u.length || Math.abs(v - u[u.length - 1]) > 1e-9) u.push(v);
    const peaks = [];
    for (let i = 0; i < u.length; i++) {
        const l = i === 0 ? -Infinity : u[i - 1];
        const r = i === u.length - 1 ? -Infinity : u[i + 1];
        if (u[i] > l && u[i] >= r) peaks.push({ at: i, v: u[i] });
    }
    const nz = samples.filter((v) => v > 0);
    return { peaks: peaks.length, peakList: peaks, plateau: u.length, distinct: new Set(samples.map((v) => v.toFixed(3))).size, min: nz.length ? Math.min(...nz) : 0, max: nz.length ? Math.max(...nz) : 0 };
}
const CRIT_DF11_A005 = 19.675, CRIT_DF11_A001 = 24.725;

const out = [];
function rec(id, verdict, evidence) {
    out.push({ id, verdict, evidence });
    console.log(`\n### ${id} → ${verdict}\n    ${evidence}`);
}
const A = (label, got, want, unit = '') => `${label}=${got}${unit} 期望=${want}${unit} ${got === want ? '✓' : '✗'}`;

// ─────────── 以下三个 helper 由 v1.1 前序区整块搬入（T-099 段依赖） ───────────
const panelCenter = (b) => [(b.rect.xMin + b.rect.xMax) / 2, (b.rect.yMin + b.rect.yMax) / 2];
function fillBoard(h) {
    const grid = h.game.grid;
    for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
            if (!grid.isFillable(r, c)) continue;
            const slot = h.game.giveTrayBead(grid.requiredColor(r, c));
            if (slot < 0) return false;
            h.game.selectTraySlot(slot);
            if (!h.game.tapGridCell(r, c)) return false;
        }
    }
    return true;
}
function enterSprintGameOver(levelId) {
    const h = mk({ levels: [probeLevel(levelId, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.frame();
    h.game.startSprint();                                  // 装配前置（判据主体 = 面板按钮真链，非本调用）
    let frames = 0;
    for (; frames < 60 * 130 && h.game.phase === 'playing'; frames++) h.frame();
    for (let f = 0; f < 15; f++) h.frame();                // 等冲刺结算面板入场（§5 入 200ms）
    return { h, frames };
}
// ═══════════ P28a..j + P29a/b · S9 `pause-settings §8-1..10` + S5 `timer-gameover §8-11/12`
/**
 * 【修订 45 · WXG-T-099 / BD-21 执行层剩余】`test-cases.md §H` 的 H2（pause-settings 10 条）与
 * H3（timer 2 条）此前只有**文档映射**（v1.3 §H 补编）与 vitest 覆盖（`tests/pause-settings.test.ts`
 * / `revive.test.ts`），**未进可复跑探针** ⇒ 本节 12 条补齐，使 §H 的 22 条中本单范围 12 条
 * 具备与 P1..P27 同口径的独立取证通路。
 *
 * 纪律（同 P27 族）：① **真链驱动** `tapChain`（`beginFrame→push→update→endFrame`），不用
 * `tapDesign` 旁路；② **正负并列**（真阳性对照 / 面板外死区 / 未看完分支），负向不得是永真断言；
 * ③ 判定**不放宽**，任一步与 §8 现文不符即 FAIL。
 *
 * ⚠️ **判据时效性（先核后判，防假 FAIL）**：`pause-settings.md §8` 现文仍为 **v1.2（2026-09-12）**，
 * 早于 **v2.0 玩法反转**（WXG-T-133 / `test-cases §J`）。故：
 *   • §8-2「首个供料不早于『暂停剩余间隔 +1 帧』」——**供料已关停**（用户 2026-09-16 裁定案 A）
 *     ⇒ 该子句**不可构造**，按 P26 / §J.1 体例以**零供料反证**替代并记 **PASS\***，不把判据侧失效
 *     算成实现缺陷；
 *   • §8-3 五项重置的**第 2 项**按 `timer-gameover §8-6` **v1.3 现文**（恢复初始错位布置，
 *     非「图案清空」）判读 —— 不得按 v1.2 旧文把「格未清空」判成缺陷；
 *   • §8-3 第 5 项（道具免费次数）若**无可观测字段**即记 ⛔，不发明伪状态充数。
 */
const FR099 = 1 / 60;
/** cells 指纹：state/底色/占位珠色（v2.0 错位 = `beadColorIdx !== colorIdx`）逐一比对。 */
const fpCells = (s) => s.cells.map((c) => `${c.void ? 'v' : c.state}:${c.colorIdx}:${c.beadColorIdx}`).join('|');
const fpTray = (s) => s.traySlots.map((t) => `${t.state}:${t.colorIdx}`).join('|');
const heldOf = (s) => s.traySlots.filter((t) => t.state !== 'free').length;
const panelBtn = (id, mode = 'normal') => pausePanelLayout(mode).buttons.find((b) => b.id === id);
/** 推到 GAME_OVER（普通局）并等失败面板入场；上限防死循环。 */
function driveToGameOver099(h, maxSec = 130) {
    let frames = 0;
    for (; frames < 60 * maxSec && h.game.phase === 'playing'; frames++) h.frame();
    for (let f = 0; f < 15; f++) h.frame();
    return frames;
}
/**
 * 取回一颗错位珠 —— 构造「托盘非空 / 棋盘被改动」的非平凡前置（防恒等断言）。
 *
 * ⚠️ **v2.0 取回是两步式**（`beads-game.ts:1767-1765` 路由 4b / 5a）：点棋盘错位珠 =
 * **只置 board 锚**（`selectBoardBead`），**再点托盘空槽**才真正取回入槽（`retrieveSelectedGroup`）。
 * 首跑夹具按 v2.0 之前的「点一下即得珠」模型写 ⇒ 恒失败（实测 `mi=1` 取回后托盘仍全空）。
 * 这不是实现缺陷 —— 判读时**先核夹具模型、再判实现**（修订 15bis 同款：探针缺陷会造出假 FAIL）。
 */
function retrieveOneMisplaced(h) {
    const s0 = h.game.snapshot;
    for (let i = 0; i < s0.cells.length; i++) {
        const c = s0.cells[i];
        if (c.void || c.state !== 'filled' || c.beadColorIdx <= 0 || c.beadColorIdx === c.colorIdx) continue;
        const before = heldOf(h.game.snapshot);
        h.tapChain(...cellXY(h.game.snapshot, i));                       // ① 选中错位珠（锚 = board）
        const freeSlot = h.game.snapshot.traySlots.findIndex((t) => t.state === 'free');
        if (freeSlot < 0) continue;
        h.tapChain(...slotXY(freeSlot));                                  // ② 点空槽 ⇒ 取回入槽
        if (heldOf(h.game.snapshot) > before) return i;
    }
    return -1;
}
/**
 * v2.0 解算（把错位珠逐一归位）—— 用于装配 LEVEL_CLEAR / FINISH 相位。
 * 旧夹具 `fillBoard()` 是 v2.0 之前的「填空格」模型：v2.0 棋盘**开局全满**（错位装配）⇒
 * 根本没有空格可填 ⇒ 用它装配 LEVEL_CLEAR 恒失败（首跑实测相位仍 `playing`）。
 * 循环：找错位格 → 两步式取回 → 托盘 holding 珠逐颗归位到「底色相同」的空格。
 */
function solveBoard099(h, maxSteps = 200) {
    for (let step = 0; step < maxSteps; step++) {
        const s = h.game.snapshot;
        let mi = -1;
        for (let i = 0; i < s.cells.length; i++) {
            const c = s.cells[i];
            if (!c.void && c.state === 'filled' && c.beadColorIdx > 0 && c.beadColorIdx !== c.colorIdx) { mi = i; break; }
        }
        if (mi < 0) break;
        h.tapChain(...cellXY(s, mi));
        const freeSlot = h.game.snapshot.traySlots.findIndex((t) => t.state === 'free');
        if (freeSlot < 0) return false;
        h.tapChain(...slotXY(freeSlot));
        for (let k = 0; k < 24; k++) {                    // 整组取回 ⇒ 可能一次进多颗，逐颗归位
            const s2 = h.game.snapshot;
            const slot = s2.traySlots.findIndex((t) => t.state === 'holding');
            if (slot < 0) break;
            const color = s2.traySlots[slot].colorIdx;
            let target = -1;
            for (let j = 0; j < s2.cells.length; j++) {
                const c = s2.cells[j];
                if (!c.void && c.state === 'empty' && c.colorIdx === color) { target = j; break; }
            }
            if (target < 0) break;
            h.tapChain(...slotXY(slot));
            h.tapChain(...cellXY(h.game.snapshot, target));
        }
    }
    return true;
}

// ── P28a · §8-1 齿轮 → 暂停 + 遮罩门禁（棋盘/托盘全覆盖 + 四类点击零响应）
{
    const h = mk();
    h.frame();
    // 真阳性对照（防永真断言）：PLAYING 下真链点槽**确实**能选中 ⇒ 下方「PAUSED 零响应」才是硬断言。
    const slotA = h.game.giveTrayBead(1);
    const slotB = h.game.giveTrayBead(2);
    h.tapChain(...slotXY(slotB));
    const positive = h.count('tray:selected') === 1 && h.game.snapshot.traySelected === slotB;
    h.tapChain(...GEAR_XY);
    const phaseIn = h.game.phase, pausedCount = h.count('game:paused');
    const s0 = h.game.snapshot;
    const inPaused = phaseIn === 'paused' && pausedCount === 1 && s0.panelVisible === true && s0.panelInteractive === true;
    // 遮罩几何（渲染指令层）：必须盖住棋盘带与托盘带（§2.2）
    const scrim = cmds(h).filter((c) => c.kind === 'rect')
        .find((r) => typeof r.fill === 'string' && r.fill.includes('rgba(42,46,67'));
    const covers = (band) => !!scrim && scrim.y <= band.yMin && scrim.y + scrim.h >= band.yMax && scrim.x <= 0 && scrim.w >= T.DESIGN_W;
    const coverBoard = covers(T.PUZZLE_BAND), coverTray = covers(T.TRAY_BAND);
    const before = h.emitted.length;
    h.tapChain(...cellXY(h.game.snapshot, 0));      // 棋盘
    h.tapChain(...slotXY(slotA));                    // 托盘（未被选中的那颗）
    h.tapChain(...CARD_XY(0));                       // 道具卡
    h.tapChain(375, T.TRAY_BAND.yMax + 40);          // 遮罩空处
    const outsideEvents = h.emitted.length - before;
    const stillPaused = h.game.phase === 'paused' && h.count('game:paused') === 1;
    const v = positive && inPaused && coverBoard && coverTray && outsideEvents === 0 && stillPaused ? 'PASS' : 'FAIL';
    rec('P28a / WXG-T-099 · TC-PAUSE-01 · S9 §8-1 齿轮 → 暂停 + 遮罩门禁', v,
        `① 真阳性对照（PLAYING）：真链点槽 ${slotB} ⇒ tray:selected=${h.count('tray:selected')}、traySelected=${h.game.snapshot.traySelected}（期望 1/${slotB}）${positive ? '✓' : '✗'} —— 无此对照则下方零响应仅为「点了个空处」。\n`
        + `② 正向（判据主体）：真链点齿轮 ⇒ phase=${phaseIn}、game:paused=${pausedCount}、panelVisible=${s0.panelVisible}、panelInteractive=${s0.panelInteractive}（期望 paused/1/true/true）${inPaused ? '✓' : '✗'}。\n`
        + `③ 遮罩几何：scrim ${scrim ? `y=${scrim.y} h=${scrim.h} w=${scrim.w}` : '未找到（渲染指令层无该 rgba(42,46,67) 覆盖层）'} ⇒ 覆盖棋盘带(${T.PUZZLE_BAND.yMin}~${T.PUZZLE_BAND.yMax})=${coverBoard}、覆盖托盘带(${T.TRAY_BAND.yMin}~${T.TRAY_BAND.yMax})=${coverTray}。\n`
        + `④ 面板外负向：真链点 棋盘格0 / 托盘槽${slotA} / 道具卡0 / 遮罩空处(375,${T.TRAY_BAND.yMax + 40}) ⇒ 事件增量=${outsideEvents}（期望 0）、相位仍 paused=${stillPaused}。`
        + `　【与 P27a 的关系】P27a 只证**路由门禁**（出入相位），本条补**遮罩几何**（渲染指令层覆盖两带）——§8-1 两半边在此合拢。`
        + `　【夹具注明】` + '`giveTrayBead()`' + ` 仅作「建立可点目标」夹具（P21 修订 20 同口径），判据主体是②③④。`);
}

// ── P28b · §8-2 PAUSED 300s 冻结 + v2.0 零供料反证
{
    const h = mk();
    h.frame();
    const rem0 = h.game.remaining;
    h.tapChain(...GEAR_XY);
    const paused = h.game.phase === 'paused';
    h.reset();                                   // 只计暂停期间的广播
    h.advance(300);
    const remPaused = h.game.remaining;
    const frozen = Math.abs(remPaused - rem0) <= 1e-9;
    const ticks = h.count('timer:tick');
    h.tapChain(...panelCenter(panelBtn('resume')));
    const remAfter = h.game.remaining;
    const resumed = h.game.phase === 'playing' && Math.abs(remAfter - rem0) <= FR099 + 1e-9;
    h.reset();
    h.advance(6);                                // v2.0 零供料反证：> 原 SPAWN_INTERVAL
    const spawned = h.count('tray:spawned');
    const held = heldOf(h.game.snapshot);
    const feedDead = spawned === 0 && held === 0;
    const v = paused && frozen && ticks === 0 && resumed && feedDead ? 'PASS*' : 'FAIL';
    rec('P28b / WXG-T-099 · TC-PAUSE-02 · S9 §8-2 PAUSED 300s 冻结（含 v2.0 零供料反证）', v,
        `① 冻结：暂停前 remaining=${rem0}s ⇒ 暂停 300s 后 remaining=${remPaused}s（Δ=${(remPaused - rem0).toFixed(9)}s，期望 ≤1e-9）${frozen ? '✓' : '✗'}；暂停期间 timer:tick=${ticks}（期望 0，联合 S5 §8-5）。\n`
        + `② 恢复：真链点「继续」⇒ phase=${h.game.phase}、remaining=${remAfter}s（期望与 ${rem0}s 相差 ≤1 帧 ${FR099.toFixed(4)}s）${resumed ? '✓' : '✗'}。\n`
        + `③ 零供料反证：恢复后再跑 6s ⇒ tray:spawned=${spawned}、托盘持有=${held}（期望 0/0）${feedDead ? '✓' : '✗'}。`
        + `　【⛔ 判据时效性 · 不记 FAIL】§8-2 原文子句「**首个供料不早于『暂停剩余间隔 +1 帧』**」在 **v2.0 供料关停**（用户 2026-09-16 案 A；` + '`tray-spawner v2.0 §8-2`' + `）后**不可构造** ⇒ 按 P26 / ` + '`test-cases §J.1`' + ` 体例以**零供料反证**替代。判据侧失效**不算实现缺陷**，故本条记 **PASS\\*** 而非 PASS/FAIL。`
        + `　【复活条件】用户推翻供料关停裁定 ⇒ 恢复 §8-2 原子句并改判。`);
}

// ── P28c · §8-3 「重玩本关」五项重置 + 无 GAME_OVER 中转
{
    const h = mk();
    h.frame();
    const base = fpCells(h.game.snapshot);
    const timeTotal = h.game.snapshot.timeTotal;
    const dirtyCell = retrieveOneMisplaced(h);
    const dirtied = dirtyCell >= 0 && heldOf(h.game.snapshot) > 0;
    h.advance(12);                               // 烧倒计时
    const expanded = h.game.expandTray();        // 扩展（第 4 项的反面前置）
    h.frame();
    const remDirty = h.game.remaining;
    h.tapChain(...GEAR_XY);
    h.tapChain(...panelCenter(panelBtn('restart')));
    const s = h.game.snapshot;
    const item1 = s.remaining === timeTotal;                        // 1 倒计时回满
    const item2 = fpCells(s) === base;                              // 2 棋盘复位（v2.0 = 初始错位布置）
    const item3 = heldOf(s) === 0;                                  // 3 托盘清空
    const item4 = h.game.tray.expanded === false;                   // 4 扩展回基线
    // 【修订 45】`powerups.used` 实为**按道具分档的对象**（实测 `{solver:0,solverPlus:0,solverRandom:0}`），
    // 不是数字 ⇒ 首跑按 `typeof === 'number'` 判定恒落 null（子项空转）。此处改按「各档均为 0」判。
    const puUsed = h.game.powerups ? h.game.powerups.used : undefined;
    const item5 = puUsed && typeof puUsed === 'object'
        ? Object.values(puUsed).every((v) => v === 0)
        : (typeof puUsed === 'number' ? puUsed === 0 : null);   // 5 道具次数回初值（不可观测 ⇒ ⛔）
    const noDetour = s.phase === 'playing' && h.count('level:failed') === 0;
    const v = dirtied && expanded && item1 && item2 && item3 && item4 && item5 !== false && noDetour ? 'PASS' : 'FAIL';
    rec('P28c / WXG-T-099 · TC-PAUSE-03 · S9 §8-3 重玩本关五项重置 + 无 GAME_OVER 中转', v,
        `前置（弄脏）：真链取回错位格 #${dirtyCell} ⇒ 托盘持有=${heldOf(h.game.snapshot)}（>0）；再跑 12s ⇒ remaining=${remDirty}s（<${timeTotal}s）；expandTray()=${expanded} ⇒ 五项重置有可断言的反面。\n`
        + `① 倒计时回满：remaining=${s.remaining}（期望 ${timeTotal}）${item1 ? '✓' : '✗'}；`
        + `② 棋盘复位（**按 timer §8-6 v1.3 现文 = 恢复初始错位布置**，非「清空」）：cells 指纹与 BOOT 基线逐一相等=${item2}；`
        + `③ 托盘清空：持有=${heldOf(s)}（期望 0）${item3 ? '✓' : '✗'}；`
        + `④ 扩展回基线：tray.expanded=${h.game.tray.expanded}（期望 false）${item4 ? '✓' : '✗'}；`
        + `⑤ 道具次数：powerups.used=${puUsed === undefined ? '不可观测 ⇒ ⛔' : JSON.stringify(puUsed)}（期望各档 0）${item5 === true ? '✓' : item5 === null ? '⛔' : '✗'}。\n`
        + `⑥ 无中转：phase=${s.phase}（期望 playing）、level:failed=${h.count('level:failed')}（期望 0）${noDetour ? '✓' : '✗'}。`
        + `　【§8-3 第 2 项口径】v1.2 旧文「图案清空（全部 filled→empty）」已被 ` + '`timer-gameover §8-6 v1.3`' + ` 改写为「恢复初始错位布置」⇒ **不得按旧文把「格未清空」判成缺陷**（该注记已在 §8-6 明文警示）。`
        + (item5 === null ? `　【⛔】第 5 项无可观测字段（` + '`game.powerups.used`' + ` 不可达）⇒ 该子项记 ⛔、不参与判定，不发明伪状态充数。` : ''));
}

// ── P28d · §8-4 音乐/音效开关各切 2 次：即档 + 重启回显 + 两通道互不影响
{
    const h = mk();
    h.frame();
    h.tapChain(...GEAR_XY);
    const bgm = panelBtn('toggle-bgm'), sfx = panelBtn('toggle-sfx');
    const readSaved = () => (JSON.parse(h.storage.get(h.saveKey) || '{}') || {}).settings || {};
    h.tapChain(...panelCenter(bgm));
    const bgm1 = h.game.bgmMuted, savedB1 = readSaved().bgmMuted;
    h.tapChain(...panelCenter(bgm));
    const bgm2 = h.game.bgmMuted, savedB2 = readSaved().bgmMuted;
    h.tapChain(...panelCenter(sfx));
    const sfx1 = h.game.sfxMuted, savedS1 = readSaved().sfxMuted;
    h.tapChain(...panelCenter(sfx));
    const sfx2 = h.game.sfxMuted, savedS2 = readSaved().sfxMuted;
    const togglesOk = bgm1 === true && bgm2 === false && sfx1 === true && sfx2 === false;
    const savedOk = savedB1 === true && savedB2 === false && savedS1 === true && savedS2 === false;
    // 互不影响：关 SFX ⇒ 点按钮零 sfx 请求；开 SFX（BGM 关）⇒ 仍有 sfx 请求（`_sfx()` 静音门在请求侧）
    h.tapChain(...panelCenter(sfx));                                  // sfx → true（关）
    const sfxOff = h.game.sfxMuted;
    const base1 = h.requests.length;
    h.tapChain(...panelCenter(panelBtn('toggle-large-text')));
    const sfxOffReqs = h.requests.slice(base1).filter((r) => /^sfx_/.test(String(r.id))).length;
    h.tapChain(...panelCenter(sfx));                                  // sfx → false（开）
    const base2 = h.requests.length;
    h.tapChain(...panelCenter(panelBtn('toggle-large-text')));
    const sfxOnReqs = h.requests.slice(base2).filter((r) => /^sfx_/.test(String(r.id))).length;
    const independent = sfxOff === true && sfxOffReqs === 0 && sfxOnReqs > 0;
    h.tapChain(...panelCenter(bgm));                                  // 构造非平凡回显态（bgm=true）
    const finalBgm = h.game.bgmMuted, finalSfx = h.game.sfxMuted;
    const reboot = mk({ storage: h.storage, saveKey: h.saveKey });
    reboot.frame();
    const echo = reboot.game.bgmMuted === finalBgm && reboot.game.sfxMuted === finalSfx && finalBgm === true;
    const v = togglesOk && savedOk && independent && echo ? 'PASS' : 'FAIL';
    rec('P28d / WXG-T-099 · TC-PAUSE-04 · S9 §8-4 双通道开关即档 + 回显 + 互不影响', v,
        `① 各切 2 次（真链点面板行）：bgm ${bgm1}→${bgm2}、sfx ${sfx1}→${sfx2}（期望 true→false 各一轮）${togglesOk ? '✓' : '✗'}。\n`
        + `② 即档（每次切换后读 storage.settings）：bgm ${savedB1}/${savedB2}、sfx ${savedS1}/${savedS2}（期望与内存态逐一相等）${savedOk ? '✓' : '✗'}。\n`
        + `③ 互不影响：**关 SFX**（sfxMuted=${sfxOff}）后点「大字号」⇒ 新增 ` + '`sfx_*`' + ` 请求=${sfxOffReqs}（期望 0）；**开 SFX** 后同一按钮 ⇒ 新增=${sfxOnReqs}（期望 >0）${independent ? '✓' : '✗'} ⇒ 两通道门控彼此独立（` + '`beads-game.ts::_sfx()`' + ` 静音门在**请求侧**）。\n`
        + `④ 重启回显（同 storage + 同 saveKey 的新实例）：bgmMuted=${reboot.game.bgmMuted}（期望 ${finalBgm}）、sfxMuted=${reboot.game.sfxMuted}（期望 ${finalSfx}）${echo ? '✓' : '✗'}。`
        + `　【非平凡性】末次额外切一次 bgm 至 true，使回显态 ≠ 出厂默认 ⇒ ④不可能是「没写也没读」的恒等真。`);
}

// ── P28e · §8-5 齿轮热区 + 面板元素避让胶囊（几何断言，走实现侧 rectsOverlap）
{
    const gear = { xMin: 0, yMin: T.HUD_BAND.yMin, xMax: T.GEAR_HIT_SIZE, yMax: T.HUD_BAND.yMax };
    const gearSizeOk = (gear.xMax - gear.xMin) >= T.TOUCH_MIN && (gear.yMax - gear.yMin) >= T.TOUCH_MIN;
    const gearAvoid = !rectsOverlap(gear, T.CAPSULE_AVOID);
    const rows = [];
    let panelOk = true;
    for (const mode of ['normal', 'sprint']) {
        const lay = pausePanelLayout(mode);
        const panelNoOverlap = !rectsOverlap(lay.panel, T.CAPSULE_AVOID);
        let allBtn = true;
        for (const b of lay.buttons) {
            if (rectsOverlap(b.rect, T.CAPSULE_AVOID)) allBtn = false;
            if ((b.rect.yMax - b.rect.yMin) < T.PANEL_BUTTON_H) allBtn = false;
        }
        panelOk = panelOk && panelNoOverlap && allBtn;
        rows.push(`${mode}: 面板避让=${panelNoOverlap}/ 全部按钮避让+高≥${T.PANEL_BUTTON_H}=${allBtn}（${lay.buttons.length} 钮）`);
    }
    const v = gearSizeOk && gearAvoid && panelOk ? 'PASS' : 'FAIL';
    rec('P28e / WXG-T-099 · TC-PAUSE-05 · S9 §8-5 齿轮热区 ≥88×88 + 面板元素避让胶囊', v,
        `① 齿轮热区：x[${gear.xMin},${gear.xMax}]×y[${gear.yMin},${gear.yMax}] ⇒ ${gear.xMax - gear.xMin}×${gear.yMax - gear.yMin}（两轴 ≥ TOUCH_MIN=${T.TOUCH_MIN}）${gearSizeOk ? '✓' : '✗'}；与 CAPSULE_AVOID 重叠=${!gearAvoid ? '是（FAIL）' : '否'}。\n`
        + `② 面板：` + rows.join('；') + `。`
        + `　【单一真源】重叠判定复用实现侧 ` + '`pause-panel.ts::rectsOverlap`' + ` ⇒ 探针不自写第二套胶囊口径；几何常量全取 ` + '`tuning.js`' + ` 现文。`);
}

// ── P28f · §8-6 归零 vs 齿轮（帧内序基准：同帧暂停优先 / 跨帧 GAME_OVER 生效）
{
    // ① 跨帧：此前帧已借归零进 GAME_OVER ⇒ 无暂停
    const a = mk({ levels: [probeLevel(960, 6, 5, 120, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    a.frame();
    driveToGameOver099(a);
    const aPhase = a.game.phase, aBefore = a.emitted.length;
    a.tapChain(...GEAR_XY);
    const crossOk = aPhase === 'game-over' && a.game.phase === 'game-over'
        && a.count('game:paused') === 0 && a.emitted.length === aBefore;
    // ② 同帧：归零与齿轮同帧到达 ⇒ 暂停优先
    const b = mk({ levels: [probeLevel(961, 6, 5, 120, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    b.frame();
    while (b.game.snapshot.remaining > FR099 && b.game.phase === 'playing') b.frame();
    // 【修订 45 · 修探针缺陷，防假 FAIL】`snapshot.remaining` 是 **display ceiled**（`state.ts` 注）
    // ⇒ 归零前一帧的读数恒 **0**；首跑用它做「>0」判定 ⇒ `preOk` 恒假 ⇒ 假 FAIL。
    // 内部秒读 `game.remaining`（实测 5.5e-12 > 0）⇒ 才真能证明「本帧 tick 本会使倒计时归零」。
    const remAt = b.game.remaining, phaseAt = b.game.phase;
    b.tapChain(...GEAR_XY);                        // 同帧注入：push 与 update 在同一帧
    // 【修订 45 · 当场拷标量】`h.game.phase` / `count()` 是**活对象**（修订 15bis(a) 同款）：
    // 证据串若留到最后再读，读到的是「恢复并判负之后」的态 ⇒ 与当场判定自相矛盾。
    const phaseAfterTap = b.game.phase, pausedAfterTap = b.count('game:paused'), failedAfterTap = b.count('level:failed');
    const remAfterTap = b.game.remaining;
    const samePaused = phaseAfterTap === 'paused' && pausedAfterTap === 1 && failedAfterTap === 0;
    b.advance(2);
    const stillPaused = b.game.phase === 'paused' && b.count('level:failed') === 0 && b.game.remaining > 0;
    b.tapChain(...panelCenter(panelBtn('resume')));
    b.advance(FR099 * 2);
    const judged = b.game.phase === 'game-over' && b.count('level:failed') === 1;
    const preOk = phaseAt === 'playing' && remAt > 0 && remAt <= FR099 + 1e-9;
    const v = crossOk && preOk && samePaused && stillPaused && judged ? 'PASS' : 'FAIL';
    rec('P28f / WXG-T-099 · TC-PAUSE-06 · S9 §8-6 归零 vs 齿轮（同帧暂停优先 / 跨帧 GAME_OVER）', v,
        `① 跨帧（此前帧已借归零进 GAME_OVER）：真链点齿轮 ⇒ phase ${aPhase}→${a.game.phase}、game:paused=${a.count('game:paused')}（期望 0）、事件增量=${a.emitted.length - aBefore}（期望 0）${crossOk ? '✓' : '✗'}。\n`
        + `② 同帧（本帧的 tick 本会使倒计时归零：内部 remaining=${remAt.toExponential(2)}s ∈(0,1 帧 ${FR099.toFixed(4)}s]、display ceiled=${b.game.snapshot.remaining === 0 ? 0 : b.game.snapshot.remaining}s、phase=${phaseAt}）：真链同帧注入齿轮 ⇒ phase=${phaseAfterTap}、game:paused=${pausedAfterTap}、level:failed=${failedAfterTap}（期望 paused/1/0）${samePaused ? '✓' : '✗'}、注入后 remaining=${remAfterTap.toExponential(2)}s；\n`
        + `　再空跑 2s ⇒ 仍 paused=${stillPaused}、内部 remaining=${b.game.remaining.toExponential(2)}s（>0，恢复前不判负）；`
        + `③ 恢复后：advance 2 帧 ⇒ phase=${b.game.phase}、level:failed=${b.count('level:failed')}（期望 game-over/1）${judged ? '✓' : '✗'}。`
        + `　【判定基准】帧内序 = 输入 → 连击窗 → ~~供料~~ → 计时（§6 / WXG-T-031 裁定）；单线程固定步长下「事件到达序」不可观测 ⇒ 不复现旧口径。`);
}

// ── P28g · §8-7 非 PLAYING 五状态注入齿轮 ⇒ 零事件零状态变化
{
    const phases = [];
    const boot = mk({ levels: [probeLevel(962, 6, 5, 300, 4.0, (i, j) => (i === 0 ? 'Z' : String(((i + j) % 3) + 1)))] });
    boot.frame();
    phases.push(['boot', boot]);
    // 【修订 45】LEVEL_CLEAR 装配改用 `solveBoard099`（v2.0 解算）：旧 `fillBoard()` 是「填空格」模型，
    // v2.0 棋盘开局全满 ⇒ 无空格可填 ⇒ 装配恒失败（首跑实测相位仍 `playing`，被误判成门禁失效）。
    const clear = mk({ levels: [probeLevel(963, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    clear.frame();
    const filled = solveBoard099(clear);
    for (let f = 0; f < 15; f++) clear.frame();
    phases.push(['level-clear', clear]);
    const over = mk({ levels: [probeLevel(964, 6, 5, 120, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    over.frame();
    driveToGameOver099(over);
    phases.push(['game-over', over]);
    const fin = mk({ levels: [probeLevel(965, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    fin.frame();
    solveBoard099(fin);                                   // 同 P28g/LEVEL_CLEAR：v2.0 走解算，不走「填空格」
    // 【修订 45】结算面板有**延迟入场门**（`CLEAR_PANEL_DELAY_MS = WAVE_MS = 800ms`，裁定 1）：
    // 面板未 open 前 `hitTest` 恒无命中 ⇒ 只等 15 帧（250ms）点「查看结果」**永远无效**
    // （首跑即因此把 finish 相位装成 level-clear）。等足 `WAVE_MS + 150ms` 再点。
    const waitClearPanel = Math.ceil(T.WAVE_MS / 1000 / FR099) + 10;
    for (let f = 0; f < waitClearPanel; f++) fin.frame();
    const finClearPhase = fin.game.phase;
    fin.tapChain(...panelCenter(clearPanelLayout({ lastLevel: true }).buttons.find((b) => b.id === 'next')));
    for (let f = 0; f < 15; f++) fin.frame();
    phases.push(['finish', fin]);
    const paused = mk();
    paused.frame();
    paused.tapChain(...GEAR_XY);
    phases.push(['paused', paused]);
    const rows = [];
    let allOk = filled;
    for (const [name, h] of phases) {
        const phase0 = h.game.phase;
        const before = h.emitted.length;
        h.tapChain(...GEAR_XY);
        const okRow = phase0 === name && h.game.phase === name && h.emitted.length === before;
        rows.push(`${name}:${okRow ? '✓' : '✗'}(${phase0}→${h.game.phase}, Δevents=${h.emitted.length - before})`);
        allOk = allOk && okRow;
    }
    const v = allOk ? 'PASS' : 'FAIL';
    rec('P28g / WXG-T-099 · TC-PAUSE-07 · S9 §8-7 非 PLAYING 五状态齿轮门禁', v,
        `五相位各自装配后真链点齿轮（点击确已到达 ` + '`_handleTap`' + `，负向非平凡真）：` + rows.join('；') + `。`
        + `　【装配】boot = pattern 首行含非法字符 'Z'（BOOT 拒收）；level-clear = v2.0 解算归位（=${filled}）；game-over = 推倒计时归零；finish = 单关通关（点「查看结果」前 phase=${finClearPhase}，期望 level-clear，需等足 800ms 延迟门）；paused = 已暂停。`
        + `　【与 P27a 的关系】P27a 只覆盖 PAUSED 一相位；本条补齐另外四相位（§8-7 全五态）。`);
}

// ── P28h · §8-8 重复暂停幂等（PAUSED 中再注入 ⇒ 保存值不变、恢复后 remaining 正确）
{
    const h = mk();
    h.frame();
    h.advance(3);
    const rem0 = h.game.remaining;
    h.tapChain(...GEAR_XY);
    const paused1 = h.game.phase === 'paused' && h.count('game:paused') === 1;
    const remSaved = h.game.remaining;
    h.tapChain(...GEAR_XY);                       // 第二次（齿轮在遮罩之后 ⇒ 被吃掉）
    const paused2 = h.count('game:paused') === 1;
    h.events.emit('game:paused', {});             // 直接注入通知（无消费者 ⇒ 不得改状态）
    const remDuring = h.game.remaining;
    const idempotent = paused1 && paused2 && Math.abs(remDuring - remSaved) <= 1e-9 && Math.abs(remSaved - rem0) <= 1e-9;
    h.tapChain(...panelCenter(panelBtn('resume')));
    const remAfter = h.game.remaining;
    const okAfter = h.game.phase === 'playing' && remAfter <= rem0 + 1e-9 && remAfter > rem0 - 0.05;
    const v = idempotent && okAfter ? 'PASS' : 'FAIL';
    rec('P28h / WXG-T-099 · TC-PAUSE-08 · S9 §8-8 重复暂停幂等', v,
        `① 首次真链点齿轮 ⇒ phase=${h.game.phase}、game:paused=${h.count('game:paused')}（期望 paused/1）、remaining=${remSaved}s（暂停前 ${rem0}s）。\n`
        + `② 重复注入（第二条路 = 真链再点齿轮被遮罩吃掉；第三条路 = 直接 ` + '`events.emit(\'game:paused\')`' + `）⇒ game:paused 仍=${h.count('game:paused')}（期望 1）、remaining=${remDuring}s（与暂停值差 ${(remDuring - remSaved).toFixed(9)}s，期望 ≤1e-9）${idempotent ? '✓' : '✗'}。\n`
        + `③ 恢复后：phase=${h.game.phase}、remaining=${remAfter}s（期望 ≈${rem0}s，≤1 帧内）${okAfter ? '✓' : '✗'}。`
        + `　【口径】本条判的是**保存值不被覆盖**（S5 §8-9 同款），与「事件计数」分开读——注入的广播本身无消费者，不得据此判实现缺陷。`);
}

// ── P28i · §8-9 sprint 暂停冻结连击窗（恢复后从暂停值续算、不追溯断连）
{
    const h = mk();
    h.frame();
    h.game.startSprint();
    const s0 = h.game.snapshot;
    let placed = 0;
    for (let i = 0; i < s0.cells.length && placed < 2; i++) {
        const c = s0.cells[i];
        if (c.void || c.state !== 'empty' || c.colorIdx <= 0) continue;
        const slot = h.game.giveTrayBead(c.colorIdx);
        if (slot < 0) continue;
        const before = h.count('bead:placed');
        h.game.selectTraySlot(slot);
        h.tapChain(...cellXY(h.game.snapshot, i));
        if (h.count('bead:placed') > before) placed++;
    }
    const constructible = placed === 2;
    const streak0 = h.game.sprintTracker.streak;
    h.advance(4);
    const winLeft = h.game.sprintTracker.windowRemaining;
    h.tapChain(...GEAR_XY);
    const paused = h.game.phase === 'paused';
    h.advance(300);
    const breaksDuring = h.count('combo:break');
    const winFrozen = Math.abs(h.game.sprintTracker.windowRemaining - winLeft) <= 1e-9;
    const streakKept = h.game.sprintTracker.streak === streak0;
    h.tapChain(...panelCenter(panelBtn('resume', 'sprint')));
    const winAfter = h.game.sprintTracker.windowRemaining;
    const resumed = h.game.phase === 'playing' && winAfter <= winLeft + 1e-9 && winAfter > winLeft - FR099 - 1e-9;
    h.advance(Math.max(0, winAfter - 0.02));
    const noEarlyBreak = h.count('combo:break') === 0;
    h.advance(0.1);
    const brokeAt = h.count('combo:break') === 1 && h.game.sprintTracker.streak === 0;
    const v = !constructible
        ? '⛔（夹具不可构造：sprint 首关无法连落 2 颗 ⇒ 不记 PASS 亦不记 FAIL）'
        : (paused && winFrozen && streakKept && breaksDuring === 0 && resumed && noEarlyBreak && brokeAt ? 'PASS' : 'FAIL');
    rec('P28i / WXG-T-099 · TC-PAUSE-09 · S9 §8-9 sprint 暂停冻结连击窗', v,
        constructible
            ? `① 构造：sprint 下连落 ${placed} 颗 ⇒ streak=${streak0}；再跑 4s ⇒ 连击窗剩余=${winLeft}s（0<·<2）。\n`
            + `② 冻结：真链点齿轮 ⇒ phase=${h.game.phase}；暂停 300s（远超窗口）⇒ combo:break=${breaksDuring}（期望 0）、windowRemaining=${h.game.sprintTracker.windowRemaining}s（与 ${winLeft}s 差 ${(h.game.sprintTracker.windowRemaining - winLeft).toFixed(9)}s）${winFrozen ? '✓' : '✗'}、streak 保持=${streakKept}。\n`
            + `③ 续算：真链点「继续」⇒ windowRemaining=${winAfter}s（期望 ≈${winLeft}s，不回满 5s）${resumed ? '✓' : '✗'}；再跑到窗口末 ⇒ combo:break=${h.count('combo:break')}（先 0 后 1）、streak=${h.game.sprintTracker.streak}（期望 0）⇒ 不追溯断连 ${brokeAt ? '✓' : '✗'}。`
            : `sprint 首关可填格不足 / ` + '`giveTrayBead`' + ` 无法建立连击 ⇒ **前置不足不得当作缺失**（修订 27 同口径）⇒ 记 ⛔，待夹具改进后复跑。`
            + `　【夹具注明】` + '`giveTrayBead()`' + ` 仅用于建立可落子目标（P21 修订 20 同口径）。`
            + `　【⛔ 边界】真机触摸序与观感仍 ` + '`[R]`' + `。`);
}

// ── P28j · §8-10 面板入 ≤200ms / 出 ≤150ms（Node 侧时间轴；像素闪烁帧检 [Cocos] ⛔）
{
    const h = mk();
    h.frame();
    h.tapChain(...GEAR_XY);
    const p0 = h.game.panel.progress;
    let prev = p0, monoIn = true, framesIn = 0;
    const inBudget = Math.ceil(T.PANEL_IN_MS / 1000 / FR099) + 2;
    for (let i = 0; i < inBudget; i++) {
        h.frame();
        const now = h.game.panel.progress;
        if (now < prev - 1e-9) monoIn = false;
        prev = now;
        framesIn = i + 1;
        if (prev >= 1) break;
    }
    const inMs = framesIn * FR099 * 1000;
    const inOk = monoIn && prev === 1 && inMs <= T.PANEL_IN_MS + FR099 * 1000;
    h.tapChain(...panelCenter(panelBtn('resume')));
    const durOut = h.game.panel.durationMs;
    let prev2 = h.game.panel.progress, monoOut = true, framesOut = 0;
    const outBudget = Math.ceil(T.PANEL_OUT_MS / 1000 / FR099) + 4;
    for (let i = 0; i < outBudget; i++) {
        h.frame();
        const now = h.game.panel.progress;
        if (now > prev2 + 1e-9) monoOut = false;
        prev2 = now;
        framesOut = i + 1;
        if (!h.game.panel.visible) break;
    }
    const outMs = framesOut * FR099 * 1000;
    const outOk = monoOut && h.game.panel.visible === false && outMs <= T.PANEL_OUT_MS + FR099 * 2000;
    const constOk = T.PANEL_IN_MS <= 200 && T.PANEL_OUT_MS <= 150;
    // 【修订 45】`p0` 是**点齿轮那一帧之后**的 progress（实测 1/12 = 0.0833，面板已在 ramp 中）⇒
    // 首跑写死 `p0 === 0` 恒假 ⇒ 假 FAIL。判据只约束「入 ≤200ms」⇒ 起点只需 **<1**（尚未到顶）。
    const v = p0 < 1 && inOk && outOk && durOut === T.PANEL_OUT_MS && constOk ? 'PASS*' : 'FAIL';
    rec('P28j / WXG-T-099 · TC-PAUSE-10 · S9 §8-10 面板入/出动效预算（Node 侧时间轴）', v,
        `① 入：progress ${p0} → 单调上升=${monoIn}、${framesIn} 帧（${inMs.toFixed(1)}ms）内到 1（预算 PANEL_IN_MS=${T.PANEL_IN_MS}ms）${inOk ? '✓' : '✗'}。\n`
        + `② 出：durationMs=${durOut}（期望 ${T.PANEL_OUT_MS}）⇒ progress 单调下降=${monoOut}、${framesOut} 帧（${outMs.toFixed(1)}ms）内 visible=false（预算 PANEL_OUT_MS=${T.PANEL_OUT_MS}ms）${outOk ? '✓' : '✗'}。\n`
        + `③ 常量：PANEL_IN_MS=${T.PANEL_IN_MS} ≤200、PANEL_OUT_MS=${T.PANEL_OUT_MS} ≤150 ${constOk ? '✓' : '✗'}（权威 ` + '`ux-spec §5`' + `）。`
        + `　【⛔ 未测半边 · 记 PASS\\* 的理由】「**红线 ≤3Hz 闪烁**」的**像素级帧检**须 ` + '`[Cocos]`' + ` 真实栅格化（本轮 ` + '`cocos-vision-shot.mjs`' + ` 只产取证物、未判读）⇒ 本条只证 **Node 侧时间轴单调且在预算内**（闪烁不可能来自单调 ramp），**不宣称像素层已验**。`);
}

// ── P29a · timer §8-11 续时同局续打（同局态保留、不走 §2.4 整关重置）
{
    const h = mk({ levels: [probeLevel(970, 6, 5, 120, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.frame();
    const dirtyCell = retrieveOneMisplaced(h);
    const cellsBefore = fpCells(h.game.snapshot), trayBefore = fpTray(h.game.snapshot);
    const nontrivial = dirtyCell >= 0 && heldOf(h.game.snapshot) > 0;
    const frames = driveToGameOver099(h);
    const phaseFail = h.game.phase, remFail = h.game.snapshot.remaining;
    const req1 = h.game.requestRevive();
    const ad = h.services.rewardedAd;
    const driveable = typeof ad?.settle === 'function';
    if (driveable) ad.settle('complete');
    h.frame();
    const s = h.game.snapshot;
    const continued = s.phase === 'playing' && Math.abs(s.remaining - T.REVIVE_BONUS_SEC) < 1e-6
        && h.game.reviveBonusSec === T.REVIVE_BONUS_SEC && s.revived === true;
    const kept = fpCells(s) === cellsBefore && fpTray(s) === trayBefore;
    const v = nontrivial && phaseFail === 'game-over' && remFail === 0 && req1 === true && driveable && continued && kept
        ? 'PASS*' : 'FAIL';
    rec('P29a / WXG-T-099 · TC-TIMER-11 · S5 §8-11 续时同局续打', v,
        `① 前置（非平凡）：真链取回错位格 #${dirtyCell} ⇒ 托盘持有=${heldOf(h.game.snapshot)}（>0）、棋盘已改动 ⇒ 续时后「态保留」不是恒等断言。\n`
        + `② 失败：推时钟至归零（${frames} 帧）⇒ phase=${phaseFail}、remaining=${remFail}s（期望 game-over/0）。\n`
        + `③ 续时：` + '`requestRevive()`' + `=${req1}（期望 true）+ ` + '`MockRewardedAdProvider.settle(\'complete\')`' + `（可驱动=${driveable}）⇒ phase=${s.phase}、remaining=${s.remaining}s（期望 ${T.REVIVE_BONUS_SEC}）、reviveBonusSec=${h.game.reviveBonusSec}、revived=${s.revived} ${continued ? '✓' : '✗'}。\n`
        + `④ 同局保留（不走 §2.4）：cells 指纹逐一相等=${fpCells(s) === cellsBefore}、托盘槽态逐一相等=${fpTray(s) === trayBefore}（期望 true/true）${kept ? '✓' : '✗'}。`
        + `　【记 PASS\\* 的理由】发奖腿由 harness 替身 ` + '`MockRewardedAdProvider`' + ` 驱动 ⇒ 只证「请求→发奖→续打」的**结构链路**；真机激励视频拉起/发奖属 ` + '`[R]`' + `（无 AppID / 无真机）⇒ ⛔（` + '`test-cases §H3`' + ` 取证纪律）。`
        + `　【与 P27f 的关系】P27f = 「续时」按钮的**真链**腿；本条 = ` + '`requestRevive()`' + ` 指令腿 + **同局态逐一保留**的判据主体。`);
}

// ── P29b · timer §8-12 次数上限 / 未看完·错误回调 / 冲刺零加时
{
    // ① 同一次尝试的第二次续时指令被忽略（REVIVE_MAX_PER_LEVEL）
    const a = mk({ levels: [probeLevel(971, 6, 5, 120, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    a.frame();
    driveToGameOver099(a);
    const r1 = a.game.requestRevive();
    const r2 = a.game.requestRevive();
    if (typeof a.services.rewardedAd?.settle === 'function') a.services.rewardedAd.settle('complete');
    a.frame();
    const remA = a.game.snapshot.remaining;
    const once = r1 === true && r2 === false && Math.abs(remA - T.REVIVE_BONUS_SEC) < 1e-6;
    // ② 未看完 / 错误回调 ⇒ 零加时、停在 GAME_OVER
    const b = mk({ levels: [probeLevel(972, 6, 5, 120, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    b.frame();
    driveToGameOver099(b);
    b.game.requestRevive();
    b.services.rewardedAd.settle('skip');
    b.frame();
    const skipOk = b.game.phase === 'game-over' && b.game.snapshot.remaining === 0 && b.game.snapshot.revived === false;
    const c = mk({ levels: [probeLevel(973, 6, 5, 120, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    c.frame();
    driveToGameOver099(c);
    c.game.requestRevive();
    c.services.rewardedAd.settle('error');
    c.frame();
    const errOk = c.game.phase === 'game-over' && c.game.snapshot.remaining === 0 && c.game.snapshot.revived === false;
    // ③ 冲刺归零注入续时 ⇒ 零加时
    const { h: d } = enterSprintGameOver(974);
    const remD0 = d.game.snapshot.remaining;
    const rd = d.game.requestRevive();
    if (typeof d.services.rewardedAd?.settle === 'function') d.services.rewardedAd.settle('complete');
    d.frame();
    const sprintOk = rd === false && d.game.snapshot.remaining === remD0 && d.game.phase === 'game-over';
    const v = once && skipOk && errOk && sprintOk ? 'PASS*' : 'FAIL';
    rec('P29b / WXG-T-099 · TC-TIMER-12 · S5 §8-12 次数上限 + 未看完 + 冲刺零加时', v,
        `① 次数上限（REVIVE_MAX_PER_LEVEL=${T.REVIVE_MAX_PER_LEVEL}）：同一次 GAME_OVER 内 ` + '`requestRevive()`' + ` 第一次=${r1}、第二次=${r2}（期望 true/false）；发奖后 remaining=${remA}s（期望 ${T.REVIVE_BONUS_SEC} = 只加一次）${once ? '✓' : '✗'}。\n`
        + `② 未看完：settle('skip') ⇒ phase=${b.game.phase}、remaining=${b.game.snapshot.remaining}s、revived=${b.game.snapshot.revived}（期望 game-over/0/false）${skipOk ? '✓' : '✗'}；错误回调：settle('error') ⇒ phase=${c.game.phase}、remaining=${c.game.snapshot.remaining}s、revived=${c.game.snapshot.revived}${errOk ? '✓' : '✗'}。\n`
        + `③ 冲刺不续时（` + '`systems-index §3.10`' + ` 末注）：冲刺结算态 ` + '`requestRevive()`' + `=${rd}（期望 false）、remaining ${remD0}→${d.game.snapshot.remaining}s、phase=${d.game.phase}${sprintOk ? '✓' : '✗'}。`
        + `　【取证纪律 · 关键】harness 装的是 ` + '`MockRewardedAdProvider`' + `（autoSettle=null）⇒ 「未看完 / error」两分支**靠替身显式注入**才成立；**不得**因替身可 complete 就把该分支标绿（` + '`test-cases §H3`' + `）。`
        + `　【记 PASS\\* 的理由】三分支的**真机广告行为**仍 ` + '`[R]`' + ` ⛔；本条只证指令层与回调分支的结构行为。`
        + `　【不相关声明】续时**不解** BD-06 死局（只加时不清托盘），本条不得读作该缺陷已修（` + '`ux-spec §4`' + ` 尾注）。`);
}

// ═════════════════════════════════════════════════════════ 汇总
const norm = (v) => v.startsWith('⛔') ? '⛔' : (v === 'PASS' ? 'PASS' : v.startsWith('PASS*') ? 'PASS*' : 'FAIL');
const tally = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyP5 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyRest = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
for (const r of out) {
    const n = norm(r.verdict);
    tally[n]++;
    (r.id.startsWith('P5') ? tallyP5 : tallyRest)[n]++;
}
const sum = (t) => `PASS ${t.PASS} / PASS* ${t['PASS*']} / FAIL ${t.FAIL} / ⛔ ${t['⛔']}`;
const cntGrp = (pred) => out.filter((r) => pred(r.id)).length;
// 【修订 38】T-098 轮修订面 = P4 / P20 / P26（含新增负向用例 P26-N）。
// 【修订 39】WXG-T-097 轮修订面 = P8 / P10：P8 的扩展腿拆为「入口存在 + S4 出口」（BD-15 已关、
//   S4 出口按布局 A 不可验 = BD-37）；P10 改认新轻提示通道并对 **text 签名**差分（BD-16 已关）。
//   同轮另有**夹具改动**（不是预期值改动）：全局 `slotXY()` 改取 §3.4 v1.20 单一真源
//   `trayLayout()` ⇒ 所有「点槽」用例的取证坐标整体上移；旧版带中线公式在带加高后已脱靶。
// 【修订 40】WXG-T-097/BD-10 轮修订面**再加两条** = P7（满槽描边呼吸 + §8-10 叠加由 ⛔ 转可测）
//   与 P5/A05-14（第二主体到位后「音/视互不驱动」由单向补为三方向）。两条均是**因实现变化而重建
//   预期值**，不是放宽判据；旧 P7 的「非文本签名 uniq≤1 才算 PASS*」实质是把缺失当预期，已删。
//   P5/A05-14 属双计条目：仍计入下方「P5 段」总计数，只是修订归属移到 T-097。
// 【修订 41 · WXG-T-114】新增真链口径修订面 = P8R/P10R/P22R + P27a..d（BD-34 回归闸门）。
//   逐条 = 与 P8/P10/P22 **同一交互**的真链重跑 + 四相位（PAUSED/LEVEL_CLEAR/GAME_OVER/FINISH）门禁矩阵。
//   判定**不放宽**：真链断链即 FAIL（旁路绿不得掩盖）；扩展 S4 出口仍按 BD-37 ⛔（与 P8 同口径 ⇒ PASS*）。
// 【修订 42 · WXG-T-116】新增修订面 = P27e..i（`input-control §8-8b/8c/8d` **次按钮**真链孪生 +
//   去「拟」）：① P27b/c/d 标题/归属串由「TC-INP-11/12/13(拟) + 仅 §2.3 覆盖」改为正式编号 `§8-8b/8c/8d`；
//   ② 新增 P27e(`8b`去冲刺) / P27f(`8c`续时) / P27g(`8c`冲刺·再来一局) / P27h(`8c`冲刺·返回关卡) /
//   P27i(`8d`去冲刺)——真链驱动 + 正负并列，判定不放宽；P27f 记 PASS*（发奖腿由 harness 替身驱动）。旁路例零删除。
// 【修订 43 · WXG-T-118】新增修订面 = **P4（纯重跑，预期值零改动）+ P7（预期值收紧：BD-35 闭合）**。
//   范围铁声明：本轮**只重跑 P4 + P7**；其余段一律沿用现行轮次 ⇒ **分桶计数不得合并解读**。
//   自 T-118 起 P4 从「T-098 修订面」、P7 从「T-097 修订面」**移出**（同 T-116 对 T-098/T-097 的排除体例），
//   否则同一记录会被两个桶双计。故本节下方 T-098 / T-097 两个桶的条数各 −1（3 / 3），**不是判定的变化**。
// 【修订 45 · WXG-T-099】新增修订面 = **P28a..j（`pause-settings §8-1..10` 10 条）+ P29a/b
//   （`timer-gameover §8-11/12` 2 条）**——`test-cases §H` 的 H2/H3 由此从「只有文档映射 + vitest」
//   升级为**可复跑探针取证**（BD-21 执行层收口）。范围铁声明：本轮**只新增 P28*/P29***，其余段
//   沿用各自现行轮次 ⇒ **分桶计数不得合并解读**（同 T-118 / T-116 体例）。
const T114_PREFIXES = ['P8R', 'P10R', 'P22R', 'P27a', 'P27b', 'P27c', 'P27d'];
const T116_PREFIXES = ['P27e', 'P27f', 'P27g', 'P27h', 'P27i'];
const T099_PREFIXES = ['P28a', 'P28b', 'P28c', 'P28d', 'P28e', 'P28f', 'P28g', 'P28h', 'P28i', 'P28j', 'P29a', 'P29b'];
const inT114 = (id) => T114_PREFIXES.some((p) => id.startsWith(p));
const inT116 = (id) => T116_PREFIXES.some((p) => id.startsWith(p));
const inT099 = (id) => T099_PREFIXES.some((p) => id.startsWith(p));
const inT118 = (id) => /^P4\b/.test(id) || /^P7\b/.test(id);
const inT098 = (id) => !inT114(id) && !inT116(id) && !inT118(id) && !inT099(id) && (/^P20\b/.test(id) || /^P26\b/.test(id));
const inT097 = (id) => !inT114(id) && !inT116(id) && !inT118(id) && !inT099(id) && (/^P8\b/.test(id) || /^P10\b/.test(id) || /^P5\/A05-14\b/.test(id));
const tallyT114 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT116 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT118 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT099 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT098 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT097 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyRest2 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
for (const r of out) {
    const bucket = inT099(r.id) ? tallyT099 : inT118(r.id) ? tallyT118 : inT116(r.id) ? tallyT116 : inT114(r.id) ? tallyT114 : inT098(r.id) ? tallyT098 : inT097(r.id) ? tallyT097 : tallyRest2;
    bucket[norm(r.verdict)]++;
}
console.log('\n================ 探针汇总（v1.7 轮 · WXG-T-099 修订面 = P28a..j + P29a/b（§H 进探针） · WXG-T-118 修订面 = P4 纯重跑 + P7 预期值收紧[BD-35 闭合] · WXG-T-116 修订面 = P27e..i · WXG-T-114 修订面 = P8R/P10R/P22R + P27a..d） ================');
for (const r of out) console.log(`${norm(r.verdict).padEnd(6)} ${r.id}`);
console.log(`\n总计数：${sum(tally)}（共 ${out.length} 组；含 P26-N 负向用例）`);
console.log(`【T-096 修订面 · P5 段（${cntGrp((id) => id.startsWith('P5'))} 条）】：${sum(tallyP5)}`);
console.log(`【T-118 修订面 · P4（纯重跑）+ P7（预期值收紧 / BD-35 闭合）（${cntGrp(inT118)} 条）】：${sum(tallyT118)}`);
console.log(`【T-098 修订面 · P20/P26（含 P26-N，P4 已移入 T-118，${cntGrp(inT098)} 条）】：${sum(tallyT098)}`);
console.log(`【T-097 修订面 · P8/P10 + P5/A05-14（P7 已移入 T-118，${cntGrp(inT097)} 条）】：${sum(tallyT097)}`);
console.log(`【T-114 修订面 · P8R/P10R/P22R + P27a..d（真链口径 / BD-34 回归闸门，${cntGrp(inT114)} 条）】：${sum(tallyT114)}`);
console.log(`【T-116 修订面 · P27e..i（§8-8b/8c/8d 次按钮真链孪生 + 去「拟」，${cntGrp(inT116)} 条）】：${sum(tallyT116)}`);
console.log(`【T-099 修订面 · P28a..j + P29a/b（§H 的 H2/H3 进探针 / BD-21 执行层收口，${cntGrp(inT099)} 条）】：${sum(tallyT099)}`);
console.log(`【未随本轮复核 · 其余 ${cntGrp((id) => !inT098(id) && !inT097(id) && !inT114(id) && !inT116(id) && !inT118(id) && !inT099(id))} 组沿用各自上一轮预期值】：${sum(tallyRest2)}`);
console.log('　↑ 八段计数不得合并解读：P5 段沿 T-096 口径（A05-14 双计），P4/P7 沿 T-118 口径（P4 = 纯重跑、P7 = 预期值收紧），P20/P26 沿 T-098 口径，P8/P10 沿 T-097 口径，P8R/P10R/P22R/P27a..d 沿 T-114 真链口径，P27e..i 沿 T-116 次按钮真链口径，P28a..j/P29a/b 沿 T-099 口径（§H 进探针），其余组沿 v1.1 口径。');
console.log(`时间戳：${new Date().toISOString()}   Node ${process.version}`);
