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
 *       （WXG-T-151 v2.0 适配复跑轮：evidence/g4-reverify-v1.8-t151.log；判据/夹具按 v2.0 规格
 *        （开局全满·swaps 错位装配·供料关停·24 槽·powerups §4 v1.22）全面重建后**整轮重跑**，见修订 46）
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
 *  45. （WXG-T-099 · §H 进探针：该轮只在正文多处【修订 45】注记登记，头列表未补条目——本文件沿用其现状，
 *      仅为**编号连续性**占位，不代其补写正文。）
 *  46. 【**WXG-T-151 · 玩法 v2.0 全面适配 + 整轮复跑（本单）**】v2.0（WXG-T-130/133：开局全满 + swaps
 *      错位装配、供料关停托盘恒空、24 槽、powerups §4 v1.22 payload 改名）落地后，旧判据/夹具与现行
 *      规格脱节 ⇒ 本轮**整轮复跑**并把全部有 T-151 足迹的组列入修订面（体例沿修订 45：夹具可构造性
 *      修复为主，**不放宽**任何判据）：
 *      ① 前置重建：一切「托盘有珠 / 存在可落空格 / 有 wrong 格」类前置改走 `retrieveOneMisplaced` /
 *        `placeOneCorrect` / `primePlaceable` **真链两步式**（v2.0 开局第 1 帧断言恒假红）；
 *        覆盖 P3/P4/P5(A05-01/04/18/23)/P8R/P9/P10/P10R/P11/P12/P22/P25/P27a..e/i/P28 等多组。
 *      ② 供料半边 ⛔：依赖「首供/满槽/增供」的子句在供料关停下不可构造 ⇒ 记 **⛔**（复活条件 = 供料
 *        复活），不判 FAIL：P2、A05-14 视觉半边、A05-23 冲刺首供、P20/P21 主体、P6/P7 满槽半边等。
 *      ③ 判据口径改取现行现文：P3 = ux-spec §6.1（v1.4）指向链 + BD-32 修复后老玩家重现性**反转**期望；
 *        P17 正文镜像 schema v3（FAIL 维持 · BD-12 开放）；P18 实测 v2.0 **in-level 快照每次落子落档**
 *        与 §8-9 现文「PLAYING 零写档」互斥 ⇒ ⛔ 移交设计裁定（属规格未随特性回写，非实现 bug）。
 *      ④ 抓到真 src 缺陷 **BD-49**：powerups §4 v1.22 把 payload 改名 `affectedSlots`→`affectedCells`，
 *        音频派发守卫（beads-game.ts:1488-1492）仍读旧字段 ⇒ 真实道具生效帧恒零发声；A05-07 注入腿改按
 *        现行字段验证零噪声子句后，真卡帧腿记 **FAIL（有效）**，vitest 夹具同用旧字段故单测绿不构反证。
 *      ⑤ 汇总新增 **T-151 修订面桶**（最高优先）：P4/P7（原 T-118）、P8/P10/P5·A05-14（原 T-097）、
 *        P20（原 T-098）、P8R/P10R/P27a..d（原 T-114）、P27e/P27i（原 T-116）、P28c/f/g/i/j（原 T-099）
 *        成员**移入** T-151 桶，原桶相应清零/缩员——预期值口径的正本仍是各历史轮现文，但本轮实测归属
 *        v2.0 夹具轮（T-118 移实体例，不双计）。
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
// 【T-151】cells/托盘指纹与「持有数」helper：原在 P28 区定义（const ⇒ TDZ），而 P4 起的 v2.0
// 夹具（retrieveOneMisplaced 等）在更早的段就用 ⇒ 上移到 helpers 区，P28 区原定义已删除。
const fpCells = (s) => s.cells.map((c) => `${c.void ? 'v' : c.state}:${c.colorIdx}:${c.beadColorIdx}`).join('|');
const fpTray = (s) => s.traySlots.map((t) => `${t.state}:${t.colorIdx}`).join('|');
const heldOf = (s) => s.traySlots.filter((t) => t.state !== 'free').length;

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

// ═════════════════════════════════════════════════════════ P1 · 空槽目标色
{
    const h = mk();
    const s = h.game.snapshot;
    const cs = cmds(h);
    const colors = [...patternColors(s)].sort((a, b) => a - b);
    const want = new Map(colors.map((c) => [c, P.mixWith(DEFAULT_PALETTE.slot, P.beadColor(c), P.EMPTY_TINT_MIX).toLowerCase()]));
    const bad = [];
    let ghostOk = 0, ghostWant = 0;
    for (let i = 0; i < s.cells.length; i++) {
        const c = s.cells[i];
        if (c.void || c.state !== 'empty' || c.colorIdx <= 0) continue;
        ghostWant++;
        const [cx, cy] = cellXY(s, i);
        const rect = cs.find((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && Math.abs(k.x + k.w / 2 - cx) < 1.2 && Math.abs(k.y + k.h / 2 - cy) < 1.2);
        if (!rect) { bad.push(`格${i} 无槽矩形`); continue; }
        if (hex2(rect.fill) !== want.get(c.colorIdx)) bad.push(`格${i}(色${c.colorIdx}) 底色 ${hex2(rect.fill)} ≠ 复算 ${want.get(c.colorIdx)}`);
        const gh = cs.filter((k) => k !== rect && (k.x !== undefined ? Math.abs(k.x - cx) < T.BEAD_CELL : false) && alphaOf(k.fill ?? k.stroke) === P.EMPTY_GHOST_ALPHA);
        if (gh.length > 0) ghostOk++; else bad.push(`格${i} 无 α=${P.EMPTY_GHOST_ALPHA} 幽灵符号`);
    }
    const distinct = new Set(cs.filter((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && inBand(k, T.PUZZLE_BAND, 60) && !k.strokeOnly).map((k) => hex2(k.fill)));
    const neutral = hex2(DEFAULT_PALETTE.slot);
    const verdict = bad.length === 0 && colors.length >= 2 && !distinct.has(neutral) ? 'PASS' : 'FAIL';
    rec('P1 / BD-01 · GAP-01 空槽目标色（E1 色底 + E4 幽灵符号）', verdict,
        `L1 图案 ${colors.length} 色（colorIdx=${colors.join(',')}）；逐色复算 E1 目标色底 = ${colors.map((c) => `${c}→${want.get(c)}`).join(' ')}；`
        + `实测拼图带内 BEAD_CELL 矩形底色去重 ${distinct.size} 种（[${[...distinct].join(' ')}]），中性槽底 ${neutral} 是否仍被用作目标色底=${distinct.has(neutral)}。`
        + `E4 幽灵符号：${ghostOk}/${ghostWant} 个空槽检出 α=${P.EMPTY_GHOST_ALPHA} 同色符号图元。`
        + (bad.length ? ` 不合项（前 6）：${bad.slice(0, 6).join('; ')}` : ' ⇒ E1/E4 逐格逐色全对，目标色通道成立。')
        + `　代码锚点：bead-render.ts:174 drawEmptySocket(builder,cx,cy,palette,size,colorIdx) 已收 colorIdx；palette.ts:158/163 EMPTY_TINT_MIX=${P.EMPTY_TINT_MIX} / EMPTY_GHOST_ALPHA=${P.EMPTY_GHOST_ALPHA}（与 assets-spec §1.2 明文一致）。`);
}

// ═════════════════════════════════════════════════════════ P2 · 首供（第 1 帧）
{
    const hold = (h) => h.game.snapshot.traySlots.filter((x) => x.state !== 'free').length;
    const h = mk(); const at0 = hold(h);
    h.frame(); const spawned1 = h.count('tray:spawned'); const at1 = hold(h);
    h.advance(1.5); const at15 = hold(h);
    const s = h.game.snapshot;
    const first = s.traySlots.find((x) => x.state !== 'free');
    const placeable = first ? demandOf(s, first.colorIdx) > 0 : false;
    const h3 = mk({ levels: [probeLevel(901, 6, 5, 300, T.SPAWN_INTERVAL_DEFAULT, (i, j) => String(((i + j) % 3) + 1))] });
    h3.frame();
    // 【T-151 · 判据时效性】v2.0 供料关停 ⇒「开局首供 / 1.5s 内增量」整体不可构造：零供即记 ⛔
    // （同 P26/§J.1 体例，不把判据侧失效算成实现缺陷；复活条件 = 供料复活）。
    const v = spawned1 === 0
        ? '⛔（v2.0 供料关停 ⇒「开局首供/1.5s 内增量」不可构造；复活条件 = 供料复活）'
        : (spawned1 === 1 && at1 === 1 && at15 >= 1 && placeable ? 'PASS' : 'FAIL');
    rec('P2 / BD-02 · GAP-02 开局首供（PLAYING 第 1 帧 + 首珠可落子色）', v,
        `L1（spawnInterval=${LEVELS[0].spawnInterval}s）：t=0 持有 ${at0} 颗 → 推进 1 帧后 tray:spawned=${spawned1}、持有 ${at1} 颗；t=1.5s 持有 ${at15} 颗。`
        + `首珠 colorIdx=${first?.colorIdx ?? '-'}，该色盘面剩余需求 demand=${first ? demandOf(s, first.colorIdx) : '-'} ⇒ 首珠可落子=${placeable}（ux-spec §6.2「首珠必须可落子色」硬判据）。`
        + `对照组注入 spawnInterval=${T.SPAWN_INTERVAL_DEFAULT}s：第 1 帧亦供料（tray:spawned=${h3.count('tray:spawned')}）。`
        + `　代码锚点：systems/spawner.ts reset() → _firstFeed=true，首 tick 走 _feedOnce（非装配期 feed，符合 §6.2「帧内序仍属供料段」）。`
        + `　【偏差登记】ux-spec §6.2 裁定的实现机制写的是「reset() → 赋 interval → 置 _acc = interval」，落码改用 _firstFeed 标志位；**可观测语义等价（第 1 帧完成首供、节律不受扰）**，机制措辞偏差登记不改笔。`);
}

// ═════════════════════════════════════════════════════════ P3 · 引导三通道
{
    // 【T-151 · v2.0 判据重建】判据改取 `ux-spec §6.1`（v1.4 重写）现文。旧夹具在**开局第 1 帧**
    // 断言 guideSlot/hint ⇒ v2.0 供料关停、托盘恒空 ⇒ 引导锚点天然未激活 ⇒ 恒 FAIL（假红）；
    // §5 行 200「首珠脉冲 = 首供落槽后该槽…」随供料关停**整体作废**（§6.1「与 §6.2 的关系」条），
    // 现行载体 = §6.1 指向链第 3 步「取回后该珠托盘脉冲 + 目标格 `hint` 高亮（行主序最前 1 格）」。
    const h = mk();
    h.frame();
    const s0 = h.game.snapshot;
    const ob0 = s0.onboarding === true;
    const chan1 = [...patternColors(s0)].length >= 1;
    // v2.0 前置：两步式连续取回直至「存在底色==持有珠色的空格」（真链 primePlaceable）⇒ 引导锚点+hint 激活。
    // 取一颗不够：开局全满，取回后唯一空格 = 原格（底色≠珠色，错位定义）⇒ hint 恒 (-1,-1)（二跑实测假红归因）。
    const primed3 = primePlaceable(h);
    // 【修订 15】snapshot 是每帧复用的活对象 ⇒ 当场拷标量
    const s = h.game.snapshot;
    const gs0 = s.guideSlot, hr0 = s.hintRow, hc0 = s.hintCol;
    const gsColor = gs0 >= 0 ? s.traySlots[gs0].colorIdx : 0;
    const chan2 = ob0 && gs0 >= 0;
    const chan3 = ob0 && hr0 >= 0 && hc0 >= 0;
    const cs = cmds(h);
    const hintHex = hex2(DEFAULT_PALETTE.hintBlue);
    const ringN = rings(cs, hintHex).length;
    const hintIsRowMajorFirst = (() => {
        if (!chan3) return false;
        const idx = hr0 * s.gridCols + hc0;
        const c = s.cells[idx];
        if (!c || c.void || c.state !== 'empty' || c.colorIdx !== gsColor) return false;
        for (let i = 0; i < idx; i++) { const x = s.cells[i]; if (!x.void && x.state === 'empty' && x.colorIdx === gsColor) return false; }
        return true;
    })();
    // 呼吸周期（600ms）：α 在 rect.alpha（drawStateRing 把相位写进 alpha，非 rgba）
    const alphas = [];
    for (let f = 0; f < 90; f++) {
        const r = rings(cmds(h), hintHex)[0];
        alphas.push(r ? Number(r.alpha ?? 1) : 0);
        h.frame();
    }
    const pm = pulsePeriodMs(alphas);
    // 首次落子即清（§6.1 ~8s 闭环）：取回珠真链归位落子
    const placedOk3 = placeOneCorrect(h);
    const afterPlaced = h.game.snapshot.onboarding, afterRing = rings(cmds(h), hintHex).length;
    /**
     * 【T-151 · v2.0 老玩家重现性重定】BD-32 修复码（T-097）已把「老玩家」判定由 `runs>0`
     * 改为显式 `onboarded` 字段（save-schema v3 + v2 存量 `runs>0` 一次性迁移）⇒ 断言改两腿：
     *   ① 同存档**未落子**二次冷启 ⇒ 引导**应重现**（修复目标：教学期杀进程不再永久丢引导；
     *     旧期望「runs=1 ⇒ 永不重现」被 BD-32 **反转**）；
     *   ② 预置 `onboarded:true` 存档再装配 ⇒ 永不重现。② 用白盒预置存档（前置 setup，非被测主体）。
     */
    const plat = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const shared = plat.createStorage();
    const lvVet = probeLevel(902, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1));
    const bootOnce = (tag) => {
        const g = new BeadsGame({ saveKey: 'wxgame.beads.reverify.runs', levels: [lvVet] });
        const p = new fw.InputManager(); const e = new fw.EventBus();
        const svc = { events: e, input: p, audio: new fw.AudioScheduler(new fw.NullAudioBackend()), storage: shared, rng: fw.createRng(tag), viewport: new fw.Viewport(750, 1334), assets: new fw.NullAssetProvider(), platform: plat.info, rewardedAd: plat.createRewardedAdProvider() };
        g.init(svc); svc.input.beginFrame(); g.update(1 / 60); svc.input.endFrame(1 / 60);
        return g.snapshot.onboarding === true;
    };
    const obA = bootOnce('runs1');
    const runsSaved = JSON.parse(String(shared.get('wxgame.beads.reverify.runs') ?? '{}'));
    const obB = bootOnce('runs2');
    shared.set('wxgame.beads.reverify.runs', JSON.stringify({ version: 3, runs: 9, onboarded: true, maxUnlockedLevel: 1, currentLevel: 1, sprintBestScore: 0, sprintBestStage: 0, starsByLevel: [0], settings: { bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false } }));
    const obC = bootOnce('runs3');
    const bd32Ok = obA && obB && !obC;
    const coreOk = chan1 && chan2 && chan3 && hintIsRowMajorFirst && primed3 !== null && placedOk3
        && afterPlaced === false && afterRing === 0 && bd32Ok;
    // 判定上限（K-044）：② 旧载体（首供脉冲）⛔ 不可构造；FTUE 盲测属 [Cocos]/[Device] ⇒ 天花板 PASS*。
    const v = coreOk ? 'PASS*' : 'FAIL';
    rec('P3 / BD-03 · GAP-03 0 文字引导三通道（v2.0：§6.1 指向链；首供脉冲子项 ⛔）', v,
        `通道①空槽目标色：见 P1（${chan1}）；通道②引导槽（取回后口径）onboarding=${ob0}、guideSlot=${gs0}（该槽色=${gsColor}）；通道③单一目标格 hint=(r${hr0},c${hc0})，行主序最前匹配格=${hintIsRowMajorFirst}。`
        + `渲染层 accent_blue(${hintHex}) 描边环图元数=${ringN}（持有珠槽 + 目标格 = 期望 ≥2）。`
        + `呼吸周期实测 ${pm.periodMs ? pm.periodMs.toFixed(0) : '—'}ms（ux-spec §5 = ${T.HINT_PULSE_MS}ms，α 取值 ${pm.distinct} 档 / ${pm.periods} 个完整周期 / 90 帧）。`
        + `引导终止：首次 bead:placed（取回珠归位落成=${placedOk3}）后 onboarding=${afterPlaced}、hint 环=${afterRing}（期望 false/0，事件驱动无计时器）。`
        + `【T-151 · v2.0 重定】老玩家重现性 = BD-32（T-097）修复口径：首启 onboarding=${obA} → 存档 runs=${runsSaved.runs ?? '-'} → **未落子**同存档二次冷启 onboarding=${obB}（期望 true，重现即修复目标）→ 预置 onboarded=true 后装配 onboarding=${obC}（期望 false）⇒ BD-32 回归断言=${bd32Ok}。旧期望「runs=1 ⇒ 永不重现」作废（被裁定反转，不据此判缺陷）。`
        + `　【判据时效登记】§5 行 200「首供脉冲」旧口径随供料关停作废（复活条件 = 供料复活）；§6.1 第 1 步「错位珠 600ms 脉冲」现实现为**恒亮白环**（T-148 用户裁定）⇒ 文本差已由 T-148 登记，本组不重判该载体、只测指向链后两步。音效通道与 FTUE 盲测属 [Cocos]/[Device] ⇒ 天花板 PASS*（K-044）。`);
}

// ═════════════════════════════════════════════════════════ P4 · wrong/hint 态与四余 VFX
{
    const h = mk();
    h.frame();
    // 【T-151 · v2.0 适配】供料关停 ⇒ 开局托盘恒空（旧夹具 `findIndex(state!=='free')` 恒 -1 ⇒ 崩）。
    // 「放错」构造改走 v2.0：两步式取回一颗错位珠 ⇒ 原格变 empty 且**底色 ≠ 珠色** ⇒ 原格即天然的 wrongCell。
    const dirtyCell4 = retrieveOneMisplaced(h);
    const s = h.game.snapshot;
    const held = s.traySlots.findIndex((x) => x.state !== 'free');
    const c0 = held >= 0 ? s.traySlots[held].colorIdx : -1;
    const wrongCell = held >= 0 && dirtyCell4 >= 0 && !s.cells[dirtyCell4].void
        && s.cells[dirtyCell4].state === 'empty' && s.cells[dirtyCell4].colorIdx !== c0
        ? dirtyCell4
        : (() => { for (let i = 0; i < s.cells.length; i++) { const x = s.cells[i]; if (!x.void && x.state === 'empty' && x.colorIdx > 0 && x.colorIdx !== c0) return i; } return -1; })();
    const preOk4 = held >= 0 && wrongCell >= 0;
    h.game.tapDesign(...slotXY(held)); h.frame();
    h.game.tapDesign(...cellXY(s, wrongCell)); h.frame();
    const sn = { wrongRow: h.game.snapshot.wrongRow, wrongCol: h.game.snapshot.wrongCol, wrongProgress: h.game.snapshot.wrongProgress };
    const rejected = h.count('bead:rejected');
    const dangerHex = hex2(DEFAULT_PALETTE.danger);
    // 【修订 38③ · P4 预期值重建】`ux-spec §5`「放错拒绝」视觉列现文（WXG-T-098）= **单次脉冲**
    // （α 0→1 淡入 60ms / 峰值保持 80ms / 淡出 60ms = 200ms，**一个 fx 窗口内 α 极值点 ≤1、不往复**）
    // + 连续拒绝 **重启门 500ms** ⇒ 有效 ≤2 次/秒。v1.1 只断「α 出现 ≥2 档」（= 在闪，被旧规格满足，
    // 也被任何往复满足）⇒ 现升为两条**结构断言**：(a) 峰点数 ≤1；(b) 两次脉冲起点间隔 ≥500ms。
    const shake = [], flash = [], progSeries = [];
    for (let f = 0; f < 14; f++) {                     // 200ms = 12 帧 + 2 帧收尾（含描边环消失）
        const cs = cmds(h); const cur = h.game.snapshot;
        const [wx, wy] = cellXY(cur, wrongCell);
        const bead = cs.filter((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && Math.abs((k.y + k.h / 2) - wy) < 2 && Math.abs((k.x + k.w / 2) - wx) < 8).map((k) => (k.x + k.w / 2) - wx);
        shake.push(bead.length ? Number(bead[0].toFixed(2)) : 0);
        const rg = rings(cs, dangerHex).filter((k) => Math.abs((k.x + k.w / 2) - wx) < 10);
        flash.push(rg.length ? Number((rg[0].alpha ?? 1).toFixed(3)) : 0);
        progSeries.push(Number(cur.wrongProgress.toFixed(3)));
        h.frame();
    }
    const shakeMax = Math.max(...shake.map(Math.abs)), shakeDir = new Set(shake.filter((v) => Math.abs(v) > 0.4).map((v) => Math.sign(v))).size;
    const pk = countPeaks(flash);
    // 【WXG-T-119 顺带项 ②】原 `peakHz = 峰点数 × 1000 / WRONG_FX_MS`（输出为「折算峰频 ≈5.0 Hz」）
    // 已**删除**：该值是**窗口折算量**，不是有效闪烁频率；有效频率由 500ms 重启门给出 = 2 次/秒
    // （`systems-index §3.8` / `ux-spec §5:180`）。字段名带 Hz 会被后人误读成「有效 5Hz ⇒ 超红线」。
    // (b) 连续拒绝 ⇒ 脉冲起点间隔（现文「重启门 500ms」）。起点用 `snapshot.wrongProgress` 的
    //     「回零 / 回落」判定（fx 被重建才回落，比从 α 反推稳；α 序列与 progress 序列同帧并列打印供复核）。
    const h3 = mk(); h3.frame();
    // 【T-151 · v2.0 适配】同 P4 主实例：取回一颗错位珠 ⇒ 原格即 wrong3（底色 ≠ 珠色）。
    const dirty3 = retrieveOneMisplaced(h3);
    const s3 = h3.game.snapshot;
    const held3 = s3.traySlots.findIndex((x) => x.state !== 'free');
    const c3 = held3 >= 0 ? s3.traySlots[held3].colorIdx : -1;
    const wrong3 = held3 >= 0 && dirty3 >= 0 && !s3.cells[dirty3].void
        && s3.cells[dirty3].state === 'empty' && s3.cells[dirty3].colorIdx !== c3 ? dirty3 : -1;
    h3.game.tapDesign(...slotXY(held3)); h3.frame();
    const starts = [], prog3 = [], tapFrames = [];
    let prevProg = 0;
    for (let f = 0; f < 54; f++) {                       // 0.9s 连续拒绝窗口
        if (wrong3 >= 0 && f % 6 === 0) { h3.game.tapDesign(...cellXY(h3.game.snapshot, wrong3)); tapFrames.push(f); }
        h3.frame();
        const cur = h3.game.snapshot.wrongProgress;
        prog3.push(Number(cur.toFixed(3)));
        if (cur > 0 && (prevProg === 0 || cur < prevProg - 1e-6)) starts.push(f);
        prevProg = cur;
    }
    const rejected3 = h3.count('bead:rejected');
    const gapsMs = starts.slice(1).map((v, i) => (v - starts[i]) * (1000 / 60));
    const minGapMs = gapsMs.length ? Math.min(...gapsMs) : null;
    // 其余三行：落座回弹 / 消除溶解 / 完成波浪 —— 落子后连续帧指令签名（剔 text）是否随时间轴变化
    const h2 = mk(); h2.frame();
    // 【T-151 · v2.0 适配】「落座回弹」需要一次**正确落子**：改走 placeOneCorrect（取回错位珠→归位）。
    const placedOk2 = placeOneCorrect(h2);
    const before = sig(cmds(h2));
    const after = []; for (let f = 0; f < 10; f++) { h2.frame(); after.push(sig(cmds(h2))); }
    const popDistinct = new Set([before, ...after]).size;
    const src = {
        // v1.2 修（**探针侧串段污染**，修订 36）：本段用 /DISSOLVE/ 等子串数「动效常量是否到位」，
        // 而 T-096 新增了 `AUDIO_CLIP_DISSOLVE` 字符串常量 ⇒ 旧写法把**音频 clip id** 误计为溶解动效常量
        // （实测 P4 证据从 DISSOLVE=0 变 1、“仍缺行”从两项变一项 = **假绿风险**）。统一排除 AUDIO_* 前缀。
        fillPop: Object.keys(T).filter((k) => !k.startsWith('AUDIO_') && /FILL_POP|POP_MS/.test(k)),
        dissolve: Object.keys(T).filter((k) => !k.startsWith('AUDIO_') && /DISSOLVE/.test(k)),
        wave: Object.keys(T).filter((k) => !k.startsWith('AUDIO_') && /COMPLETE_WAVE|WAVE_MS/.test(k)),
    };
    const residual = [];
    if (popDistinct <= 1) residual.push('vfx_fill_pop(120ms)');
    if (!src.dissolve.length) residual.push('vfx_clear_dissolve(200ms)');
    if (!src.wave.length) residual.push('vfx_complete_wave(逐列20ms/800ms)');
    const pulseStructOk = pk.peaks <= 1;                      // 现文：一个 fx 窗口内 α 极值点 ≤1
    const gateStructOk = minGapMs === null || minGapMs >= 500 - 1e-9;   // 现文：连续拒绝重启门 500ms
    const wrongOk = preOk4 && placedOk2 && rejected === 1 && sn.wrongProgress > 0 && Math.abs(sn.wrongRow - Math.floor(wrongCell / s.gridCols)) <= 1 && shakeMax > 0 && shakeDir === 2 && pk.peaks >= 1;
    const v = wrongOk && pulseStructOk && gateStructOk && residual.length === 0 ? 'PASS'
        : (wrongOk && pulseStructOk && gateStructOk) ? 'PASS*' : 'FAIL';
    rec('P4 (v1.3 改判) / BD-04 · BD-29 转态 · 拒绝反馈「单次脉冲 + 500ms 重启门」（ux-spec §5 现文，WXG-T-098；WXG-T-118 重跑）', v,
        `【WXG-T-118 · 纯重跑（**预期值与阈值一字未改**，现行断言面即修订 38③ 的 T-098 现文口径）】`
        + `① **单次脉冲**（现文：淡入 60 / 保持 80 / 淡出 60 = 200ms，一个 fx 窗口内 **α 极值点 ≤1**）：`
        + `bead:rejected=${rejected}（期望 1）、wrongRow/Col=(${sn.wrongRow},${sn.wrongCol})、wrongProgress=${sn.wrongProgress.toFixed(2)}；`
        + `被拒格 200ms 内水平位移样本=[${shake.join(',')}]px ⇒ 幅度 max=${shakeMax}px（ux-spec §5 = ±${T.WRONG_SHAKE_PX}px，**属位移、不在闪烁通道**）、换号次数=${shakeDir}（期望 2 = ±×2）；`
        + `danger(${dangerHex}) 描边环 α 逐帧样本=[${flash.join(',')}]（同帧 wrongProgress 样本=[${progSeries.join(',')}]）⇒ **峰点数 = ${pk.peaks}**（plateau 合并后计，判据 ≤1）【顺带项 ②：原「折算峰频 ≈X Hz」字段**已按 WXG-T-119 删除**——那是窗口**折算量**（峰点数×1000/\`WRONG_FX_MS\`），**不是有效闪烁频率**；有效频率由 **500ms 重启门**给出 = **2 次/秒**（\`systems-index §3.8\`）】；α 取值集=[${[...new Set(flash)].join(',')}]、非零区间 α∈[${pk.min}, ${pk.max}]（**归因订正（WXG-T-118，非预期值改动）**：α 逐帧取样天然受**采样相位**影响 —— 本窗自误点后第 1 帧起算、非自 α=0 起 ⇒ min/max **只作附带观察**，判据是上方的峰点数与起点间隔；v1.3 轮曾把「下限 ≠ 0」归因于旧 sin 实现落差，**T-102 落地后该归因不再适用**，本单改为「采样相位」表述，不据此判本条）。`
        + `② **重启门**（现文：连续拒绝时**视觉脉冲重启门 500ms** ⇒ 有效 ≤2 次/秒）：每 100ms 注入一次同格误点，注入帧=[${tapFrames.join(',')}]⇒ bead:rejected=${rejected3}；脉冲起点帧=[${starts.join(',')}]（${starts.length} 个）、相邻起点间隔=[${gapsMs.map((g) => g.toFixed(0)).join(',')} ms] ⇒ **最小间隔 = ${minGapMs === null ? '—' : minGapMs.toFixed(0) + ' ms'}**（判据 ≥500 ms）。`
        + `③ **两条结构断言实测**：(a) 峰点数 ≤1 = **${pulseStructOk}**（实测 ${pk.peaks}）；(b) 起点间隔 ≥500ms = **${gateStructOk}**（实测 ${minGapMs === null ? '—' : minGapMs.toFixed(0) + ' ms'}）⇒ **本条记 ${v}**。`
        + `　【**转态声明 · 非新回归**】BD-29 在 v1.1 是「ux-spec §5 视觉列与同表红线 / systems-index §3.8 互斥」（当时记 PASS\*，因实现忠实于旧表格行「闪 2 次 / 200ms」）；WXG-T-098 已按主理人定向把视觉列改写为**与本判据一致的单次脉冲**（ux-spec §5:174 闪烁口径 + §5:180 视觉列），该**规格互斥已消解** ⇒ BD-29 由「规格互斥」**转态为「实现落差」**（即旧实现与新规格的差，**不是**本轮新发现的回归）。`
        + `　【**WXG-T-102 已落地 → 本半边闭合**（WXG-T-118 重跑取证）】代码锚点（**T-102 后重取；订正旧锚点不属预期值改动**）：`
        + `view-model.ts:435-445 \`wrongFlashAlpha(p)\` = 淡入 ease-out（60ms）→ 峰值保持 1.0（80ms）→ 淡出 ease-in（60ms）`
        + `⇒ 一个 \`WRONG_FX_MS\`(200ms) 窗口内**单峰**；beads-game.ts:1850-1854 \`_armWrongFx\` 以`
        + ` \`if (this._pulseClock - this._wrongFxArmedAtMs < WRONG_FX_RESTART_GATE_MS) return;\` 早退 ⇒ **500ms 重启门**。`
        + `（**旧锚点 view-model.ts:521 「0.4 + 0.6·|sin(wrongProgress·2π)|」/ beads-game.ts:1524 无条件重置已随 T-102 失效**，`
        + `本单只订正证据正文的锚点指向，**断言面与阈值零改动**。）`
        + `§5 表下「实现落差登记」（:201）已明文：跟进落地前按**已知偏差**沿 BD-29 记录、**不重复开新缺陷** ⇒ 本轮**不占用新 BD 号**；改码已立项 **WXG-T-102**（production/TASKS.md:43）。（本 agent 只读，未改 src/。）`
        + `　【reduceMotion 半边不重复计】§5 现文「退为静态红描边（200ms 保持后直接消失，0 往复）+ 抖动位移归零」已由 **P22** 实测成立（wrong 位移唯一值=1、fx 窗口内静态红环 ≥1）⇒ 与新措辞一致，**不另开缺陷**（AGENTS §7 一事一记）。`
        + `④ **BD-04 其余三行沿用 v1.1 读数（本单未复核该半边预期值）**：落座回弹：落子前/后连续 10 帧剔 text 指令签名去重=${popDistinct}（>1 才有时间轴）；tuning 命中：FILL_POP=${src.fillPop.length} / DISSOLVE=${src.dissolve.length} / COMPLETE_WAVE=${src.wave.length} 个常量`
        + (residual.length ? ` ⇒ 仍缺行：${residual.join(' / ')}（ux-spec §5 其余行，波次 2 未列 T-087 范围）⇒ BD-04 **降级不关闭**维持。` : ' ⇒ 四行全落地。')
        + `　【探针口径】v1.0 以「CellState 无 wrong/hint」为实现缺失，改判据为渲染层断言（修订 16）：载体实为 snapshot 覆盖层 hintRow/Col、wrongRow/Col/progress + view 只读消费（view-model.ts:493-521、584-587）；本轮在此基础上**只按现文收紧、不放宽**（修订 38③）。`);
}

// ═════════════════════════════════════════════════════════ P5 · 音频
// 本段预期值由 **WXG-T-096 之后的真判据**重建（修订 28–34）：判定一律由实测算出，
// 旧版第二参写死 'FAIL' 且前提（「零派发」「三平台仍 NullAudioBackend」）已失效 ⇒ 属假 FAIL。
{
    const FR = 1 / 60;
    const C = (k) => T[k];                                   // AUDIO_CLIP_* 常量名 → clip id
    const cnt = (arr, id) => arr.filter((x) => x === id).length;
    const u = (arr) => [...new Set(arr)];
    /** 判定由实测算出：block=被 [B]/[C]/[R]/[P] 盖住 ⇒ ⛔；partial=[N] 子句过但整条未闭 ⇒ PASS*。 */
    const p5 = (no, title, ok, evidence, o = {}) => rec(`P5/${no} · ${title}`,
        o.block ? `⛔（本轮不可验 · 缺 ${o.block}）` : (ok ? (o.partial ? 'PASS*' : 'PASS') : 'FAIL'), evidence);
    /** 带音频派发面的夹具（修订 30：帧内序 = App.tick）。激励广告用 Mock，手动 settle。 */
    const ah = (o = {}) => mk({ flushAudio: true, rewardedAd: new fw.MockRewardedAdProvider(), ...o });
    let tapSeq = 0;
    /** 一个真帧：beginFrame → push(down) → update → **取 flush 前的 pendingCount** → flush → endFrame。 */
    function tapFrame(h, dx, dy, phase, id, t) {
        const p = { x: 0, y: 0 };
        h.services.viewport.designToScreen(p, dx, dy);
        h.input.beginFrame();
        h.input.push({ id, x: p.x, y: p.y, phase, time: t });
        h.game.update(FR);
        const pending = h.audio.pendingCount;
        h.audio.flush(FR);
        h.input.endFrame(FR);
        return pending;
    }
    /** 真实点击（down 帧生效：`beads-game.ts:1180 if (!snap.justDown) return`），返回该帧的派发层结果。 */
    function tapAt(h, dx, dy) {
        const id = 900 + (++tapSeq), t = 1e6 + tapSeq;
        const before = h.dispatched.length;
        const pending = tapFrame(h, dx, dy, 'down', id, t);
        tapFrame(h, dx, dy, 'up', id, t);
        return { pending, dispatched: h.dispatched.slice(before) };
    }
    /** 面板按钮：走 `game.tapDesign()` = **真 `_handleTap` 优先级路由**（齿轮→卡→托盘→网格→面板）。
     *  ⚠ 不用 InputManager 链（v1.2 改）：实测 `_readInput()` 只在 `playing` 的 onUpdate 里被调
     *  （`beads-game.ts:1147` 唯一调用点；`paused`/`game-over` 无 onUpdate，`:919-925`/`:960-971`），
     *  面板相位下真指针事件在 `endFrame` 里被清 ⇒ **点不到面板按钮**（附带发现，报告 §15 建议 BD-34）。
     *  本单只验音频派发，驱动口径与报告 §3「玩法驱动一律走 `tapDesign`」一致；不据此宣称「真人点不动」已定论（需 [B]/[R] 复核）。 */
    const tapBtn = (h, layout, id) => {
        const b = layout.buttons.find((x) => x.id === id);
        if (!b) throw new Error(`probe P5: 面板无按钮 ${id}`);
        return tapRouterAt(h, (b.rect.xMin + b.rect.xMax) / 2, (b.rect.yMin + b.rect.yMax) / 2);
    };
    /** 直接经 `_handleTap` 路由点一处（非面板按钮也用它，以便「遮罩吃掉点击」子句真落到路由上）。 */
    function tapRouterAt(h, dx, dy) {
        const before = h.dispatched.length;
        const consumed = h.game.tapDesign(dx, dy);
        h.tickFrame(FR);
        return { consumed, dispatched: h.dispatched.slice(before) };
    }
    /** 托盘珠 L1 主体的中心 y（设计系 y 向上 ⇒ 值越大越靠上）。 */
    function trayBeadY(h, idx) {
        const [cx] = slotXY(idx);
        const body = cmds(h).filter((k) => k.kind === 'rect' && Math.abs(k.w - TRAY_BEAD_SIZE) < 0.6
            && Math.abs((k.x + k.w / 2) - cx) < 2);
        return body.length ? Math.max(...body.map((k) => k.y + k.h / 2)) : null;
    }
    /**
     * 【T-151 · v2.0 适配】旧「giveTrayBead 灌珠 + 填空格」模型在 v2.0（开局全满·错位装配）下
     * `isFillable` 恒 false ⇒ 空转返回 true 但 phase 仍 playing ⇒ 下游（星音/面板音）全假 FAIL。
     * 改走 v2.0 解算归位（真链两步式，`solveBoard099`），返回值锚到「确实进入 LEVEL_CLEAR」。
     * 白盒例外声明（修订 20）不再需要：本实现全程真链。
     */
    function fillBoardAudio(h) {
        const ok = solveBoard099(h);
        for (let f = 0; f < 30 && h.game.phase === 'playing'; f++) h.frame();
        return ok && h.game.phase === 'level-clear';
    }
    // 规格侧权威清单（从 `audio-events.md §1` 正文解析 ⇒ A05-24 是「文档↔代码」对账，不是探针自报）
    const specClips = (() => {
        const md = readFileSync(resolve(ROOT, 'games/beads/design/audio/audio-events.md'), 'utf8');
        const seg = (md.split(/^## 2\. /m)[0] ?? '').split(/^## 1\. /m)[1] ?? '';
        const ids = [];
        for (const line of seg.split('\n')) {
            const m = /^\|\s*`([a-z_0-9]+)`/.exec(line.trim());
            if (m && !ids.includes(m[1])) ids.push(m[1]);
        }
        return ids;
    })();
    // 修订 29：只取**字符串**常量（旧版把数字 `AUDIO_CLIP_TOTAL=19` 当 clip id 计入）
    const codeClipKeys = Object.keys(T).filter((k) => k.startsWith('AUDIO_CLIP_') && typeof T[k] === 'string');
    const codeClips = codeClipKeys.map((k) => T[k]);
    const voiceClips = Object.keys(BEADS_AUDIO_VOICES);
    const vcDur = (id) => BEADS_AUDIO_VOICES[id]?.durationMs;
    const NULLEDBACKEND = new fw.NullAudioBackend().constructor.name;

    // ── A05-01 · `sfx_place`：`bead:placed` 那一 tick 内入队并帧末派发（+ 同 tick 视觉回弹）
    const h1 = ah(); h1.tickFrame(FR);
    const i1 = (primePlaceable(h1) || { slot: -1 }).slot; /* T-151 v2.0 前置 */
    tapAt(h1, ...slotXY(i1)); h1.clearAudio();
    const cell1 = firstEmptyOf(h1.game.snapshot, h1.game.snapshot.traySlots[i1].colorIdx);
    const t1res = tapAt(h1, ...cellXY(h1.game.snapshot, cell1));
    const placedEv = h1.count('bead:placed');
    const audio01 = placedEv === 1 && t1res.pending === 1
        && t1res.dispatched.length === 1 && t1res.dispatched[0] === C('AUDIO_CLIP_PLACE');
    // 视觉半边：落子后连续 8 帧该格图元尺寸（§5 要求 1.06→1.0 回弹 ⇒ 尺寸必随时间变）
    const sizes = [];
    for (let f = 0; f < 8; f++) {
        const [cx, cy] = cellXY(h1.game.snapshot, cell1);
        const body = cmds(h1).filter((k) => k.kind === 'rect' && Math.abs((k.x + k.w / 2) - cx) < 3 && Math.abs((k.y + k.h / 2) - cy) < 6);
        sizes.push(body.length ? Number(Math.max(...body.map((k) => k.w)).toFixed(2)) : 0);
        h1.tickFrame(FR);
    }
    const popRatio = Math.max(...sizes) / (Math.min(...sizes.filter((v) => v > 0)) || 1);
    const popConst = Object.keys(T).filter((k) => !k.startsWith('AUDIO_CLIP_') && /FILL_POP|POP/.test(k));
    p5('A05-01', 'sfx_place · 同帧入队并帧末派发（音视频同帧）', audio01,
        `【派发层】真实点击链路（tapAt = beginFrame→push(down)→update→flush→endFrame）落子：bead:placed=${placedEv}、`
        + `该帧 audio.flush() **之前** scheduler.pendingCount=${t1res.pending}（已入队未下发）、flush **之后** backend 新增派发=`
        + `[${t1res.dispatched.join(', ') || '（无）'}] ⇒ 入队与派发在同一 tick 内，且「仅新增 sfx_place」成立=${audio01}。`
        + `【视觉半边】落子后 8 帧该格图元宽=[${sizes.join(',')}] ⇒ 尺寸比 max/min=${popRatio.toFixed(3)}`
        + `（§5 要求 1.06→1.0）、tuning 内 FILL_POP 类常量=${popConst.length ? popConst.join('/') : '0 个'}`
        + ` ⇒ vfx_fill_pop 主体${popRatio >= 1.05 ? '存在' : '**未落地**（属 BD-04 已登记的缺行，本条不重复计为新缺陷）'}。`
        + `　⇒ 因此本条记 PASS*：**只**代表「派发层同帧」已由实测证实，**不代表**可听、也不代表视觉回弹已做。`,
        { partial: popRatio < 1.05 });

    // ── A05-02 · 端到端延迟 ≤1 帧（不跨第二次 flush）
    const h2 = ah(); h2.tickFrame(FR); h2.clearAudio();
    h2.events.emit('bead:placed', { row: 0, col: 0, colorIdx: 1, slot: 0 });
    const pend2 = h2.audio.pendingCount, d02 = h2.dispatched.length;
    h2.audio.flush(FR);
    const dlt2 = h2.dispatched.slice(d02), left2 = h2.audio.pendingCount;
    p5('A05-02', 'sfx_place · 端到端延迟 ≤1 帧', pend2 === 1 && dlt2.length === 1 && left2 === 0,
        `广播 bead:placed 后（尚未 flush）pendingCount=${pend2}、backend 新增派发=${dlt2.length} 条；`
        + `执行**一次** flush(1/60) 后 backend 新增=[${dlt2.join(', ')}]、剩余 pending=${left2} ⇒ 从广播到 backend.play() `
        + `未跨第二次 flush ⇒ 延迟 ≤1 帧 = ${(FR * 1000).toFixed(2)} ms（§0 可断言定义）。`
        + `　【口径】本条用 bus 直发事件（判据原文即「从事件广播到 backend.play()」）；经真实点击的同帧已由 A05-01 覆盖。`);

    // ── A05-03 · 实际发声时长 ≤120 ms、软起音无爆音 → [B]+[P]
    const dur03 = vcDur(C('AUDIO_CLIP_PLACE'));
    p5('A05-03', 'sfx_place · 发声时长 ≤120ms 与软起音无爆音', typeof dur03 === 'number' && dur03 <= 120,
        `本轮夹具的后端实测为 ${h2.rawBackend.constructor.name}（= ${NULLEDBACKEND}，mk() 默认），且 harness 的 DOM stub `
        + `无 AudioContext（实测 typeof globalThis.AudioContext=${typeof globalThis.AudioContext}）⇒ Node 里**不会发出任何声音**。`
        + `能拿到的只有配方**声明值** sfx_place.durationMs=${vcDur(C('AUDIO_CLIP_PLACE'))}ms（结构证据，**不是**实测包络），`
        + `「软起音/无 click 爆音」只能人耳或波形分析。缺的道次：**[B]**（浏览器/Web Audio 可听，需跑 harness:serve + 浏览器录音）`
        + `+ **[P]**（阶段 6 Playtest）。本条按修订 31 记 ⛔，不得由「Node 里结构对」推为出声达标。`
        + `（上面算出的 ok 仅供 **[B]** 复跑时参考：声明值 ≤120ms=${typeof dur03 === 'number' && dur03 <= 120}，**不是**本条验收结论）`,
        { block: '[B]+[P]' });

    // ── A05-04 · `sfx_select` 帧内入队 + 同帧上移 4px
    const h4 = ah(); h4.tickFrame(FR);
    const i4 = (primePlaceable(h4) || { slot: -1 }).slot; /* T-151 v2.0 前置 */
    const yFree = trayBeadY(h4, i4);
    const t4res = tapAt(h4, ...slotXY(i4));
    const ySel = trayBeadY(h4, i4);
    const liftPx = (yFree !== null && ySel !== null) ? Number((ySel - yFree).toFixed(2)) : null;
    const audio04 = h4.count('tray:selected') === 1 && t4res.pending === 1 && cnt(t4res.dispatched, C('AUDIO_CLIP_SELECT')) === 1;
    p5('A05-04', 'sfx_select · 帧内入队派发 + 同帧托盘珠上移 4px', audio04 && Math.abs(liftPx - 4) < 0.01,
        `【派发层】真帧内点托盘槽：tray:selected=${h4.count('tray:selected')}、flush 前 pending=${t4res.pending}、`
        + `该帧派发=[${t4res.dispatched.join(', ')}]。【同帧视觉】同一 tick 的 render model 里该槽珠 L1 主体中心 y：`
        + `未选 ${yFree} → 选中 ${ySel} ⇒ Δy=${liftPx} 设计 px（设计系 y 向上 ⇒ 正值为**上移**；art §1.2 = 4px）。`
        + `　【未闭子句】时长 ≤100 ms 属 **[B]**（本轮只有声明值 sfx_select.durationMs=${vcDur(C('AUDIO_CLIP_SELECT'))}ms）⇒ 记 PASS*。`
        + `　【小观察（非 §3 冻结常量、不改判）】实现侧 view-model.ts:575「const lift = selected ? 4 : 0」是字面量，tuning 无对应常量名 ⇒ 归表示层待收。`,
        { partial: true });

    // ── A05-05 / A05-06 · `sfx_reject` 限流红线与分档参数
    const h5 = ah(); h5.tickFrame(FR); h5.clearAudio();
    for (let i = 0; i < 10; i++) { h5.events.emit('bead:rejected', { row: 0, col: 0, colorIdx: 1 }); h5.tickFrame(0.1); }
    const reqR = h5.requests.filter((r) => r.id === C('AUDIO_CLIP_REJECT'));
    const disR = cnt(h5.dispatched, C('AUDIO_CLIP_REJECT'));
    const winS = 10 * 0.1;
    const ok05 = reqR.length === 10 && disR >= 1 && disR <= 2 * winS + 1e-9;
    p5('A05-05', 'sfx_reject · 连续 10 次拒绝 ≤ 2 次/秒（§3.8 红线）', ok05,
        `【派发层，不是请求层】以 0.1 s 间隔注入 10 次 bead:rejected（窗口 ${winS.toFixed(1)} s）：`
        + `玩法侧发出 ${reqR.length} 次请求、backend 实际收到 **${disR}** 次 sfx_reject ⇒ 上限 ${2 * winS} 次（= 窗口秒数×2）`
        + `，实测 ${(disR / winS).toFixed(2)} 次/秒。scheduler._time 靠每帧 flush(dt) 推进（修订 28④：v1.1 旧夹具从不 flush ⇒ 本条当时不可测）。`
        + `　对照旧缺陷：若仍用统一 minInterval=0.05（v1.0 现状），同一 1.0 s 窗口上限为 1/0.05=${(1 / 0.05).toFixed(0)} 次 ⇒ 直接违反 §3.8。`);

    const miProbe = ah(); miProbe.tickFrame(FR); miProbe.clearAudio();
    const emitAll = [
        [C('AUDIO_CLIP_REJECT'), () => miProbe.events.emit('bead:rejected', { row: 0, col: 0, colorIdx: 1 })],
        [C('AUDIO_CLIP_PLACE'), () => miProbe.events.emit('bead:placed', { row: 0, col: 0, colorIdx: 1, slot: 0 })],
        [C('AUDIO_CLIP_SELECT'), () => miProbe.events.emit('tray:selected', { slot: 1, colorIdx: 1 })],
        [C('AUDIO_CLIP_URGENT_BEAT'), () => miProbe.events.emit('timer:tick', { remaining: 1 })],
        [C('AUDIO_CLIP_TRAY_FULL'), () => miProbe.events.emit('tray:full', {})],
        [C('AUDIO_CLIP_CLEAR'), () => miProbe.events.emit('level:cleared', { levelId: 'L90', remaining: 1, ratio: 1, stars: 3 })],
        [C('AUDIO_CLIP_COMBO_T3'), () => miProbe.events.emit('combo:up', { streak: 4, multiplier: 5, tier: 3 })],
    ];
    const miWant = {
        [C('AUDIO_CLIP_REJECT')]: T.AUDIO_REJECT_MIN_INTERVAL,
        [C('AUDIO_CLIP_PLACE')]: T.AUDIO_SFX_MIN_INTERVAL,
        [C('AUDIO_CLIP_SELECT')]: T.AUDIO_SFX_MIN_INTERVAL,
        [C('AUDIO_CLIP_URGENT_BEAT')]: T.AUDIO_URGENT_MIN_INTERVAL,
        [C('AUDIO_CLIP_TRAY_FULL')]: T.AUDIO_TRAYFULL_MIN_INTERVAL,
        [C('AUDIO_CLIP_CLEAR')]: 0, [C('AUDIO_CLIP_COMBO_T3')]: 0,
    };
    const miRows = [];
    for (const [id, fire] of emitAll) {
        miProbe.clearAudio(); fire();
        const r = miProbe.requests.find((x) => x.id === id);
        miRows.push(`${id}=${r ? r.minInterval : '无请求'}(期${miWant[id]})`);
        miProbe.tickFrame(0.6);   // 逐 clip 过窗口，不让上一条的限流影响下一条
    }
    const ok06 = miRows.every((row) => { const m = /=([-\d.]+)\(期([-\d.]+)\)/.exec(row); return m && Math.abs(Number(m[1]) - Number(m[2])) < 1e-9; })
        && reqR.every((r) => r.minInterval === T.AUDIO_REJECT_MIN_INTERVAL);
    p5('A05-06', 'sfx_reject · minInterval === 0.5（分档表 §3.2，非全局 0.05）', ok06,
        `【请求层】从 audio.play() 实参读数（不是读常量表）：reject 10 次请求的 minInterval 全=`
        + `${u(reqR.map((r) => r.minInterval)).join('/')}，§3.12 冻结值 AUDIO_REJECT_MIN_INTERVAL=${T.AUDIO_REJECT_MIN_INTERVAL}。`
        + `逐 clip 分档审计=[${miRows.join(' ')}]（期值均取自 §3.12 镜像常量：SFX=${T.AUDIO_SFX_MIN_INTERVAL}、`
        + `URGENT=${T.AUDIO_URGENT_MIN_INTERVAL}、TRAYFULL=${T.AUDIO_TRAYFULL_MIN_INTERVAL}、一次性=${0}）。`);

    // ── A07 · 道具帧两条并存 / 零效果零发声（【T-151】payload 字段随 powerups §4 v1.22 改名）
    const h7 = ah(); h7.tickFrame(FR);
    h7.game.giveTrayBead(1); h7.game.giveTrayBead(2); h7.clearAudio();
    const t7res = tapAt(h7, ...CARD_XY(1));
    const puEv = h7.count('powerup:used');
    h7.clearAudio();
    // 【T-151 · 修探针自身】零噪声子句注入改取 v1.22 现文 payload（affectedCells）：
    // 旧字段名注入在现行实现下「恒零发声」= 假通过，失去零噪声断言效力。
    h7.events.emit('powerup:used', { type: 'solver', affectedCells: [] });
    h7.audio.flush(FR);
    const silentEmpty = h7.dispatched.length === 0 && h7.audio.pendingCount === 0;
    const ok07 = puEv === 1 && t7res.dispatched.includes(C('AUDIO_CLIP_POWERUP'))
        && t7res.dispatched.includes(C('AUDIO_CLIP_DISSOLVE')) && silentEmpty;
    const ev07 = h7.emitted.filter((e) => e.type === 'powerup:used').pop();
    p5('A05-07', 'sfx_powerup + sfx_dissolve · 同帧分层不被去重吞掉；零效果零发声', ok07,
        `【派发层】真实点击道具卡（托盘内先放 2 颗珠作为前置）：powerup:used=${puEv}、同帧 backend 收到=`
        + `[${t7res.dispatched.join(', ') || '（无）'}]（共 ${t7res.dispatched.length} 条 ≤ 冻结上限 AUDIO_MAX_PER_FRAME=${T.AUDIO_MAX_PER_FRAME}）`
        + ` ⇒ 期望两条 id（sfx_powerup + sfx_dissolve）并存。`
        + `【零噪声】注入 affectedCells: []（v1.22 现文字段）后 flush ⇒ 新增派发=${h7.dispatched.length} 条、pending=${h7.audio.pendingCount}（powerups §4）。`
        + `　【T-151 · 卡点归因 = 真 src 缺陷 BD-49】真卡帧 powerup:used 载荷实测 keys=[${ev07 && ev07.p ? Object.keys(ev07.p).join(',') : '-'}]：`
        + `powerups §4 现文 v1.22 已改名 affectedSlots→**affectedCells**（消费方 S4→S3），但音频派发守卫仍读旧字段（beads-game.ts:1488-1492）⇒ 真实生效帧恒提前 return ⇒ **道具生效零音**（回归：T-137 反转改 payload 时漏改消费侧）。 vitest 同族夹具亦用旧字段（tests/audio-dispatch.test.ts:276/284/422）⇒ 单测绿不构成反证（K-040③「夹具/文档一致 ≠ 代码一致」）。另登记：sfx_dissolve 触发主体（「溶解沙」↔vfx_clear_dissolve，E4 已作废）在 v2.0 下是否保留属规格侧待裁，本条按 audio-events §1 现文两条仍并判。`,
        { partial: false });

    // ── A05-08 · 连击三档分流不串音，tier=0 零发声
    const h8 = ah(); h8.tickFrame(FR); h8.clearAudio();
    const tierRows = [];
    let zeroAt0 = true;
    for (const tier of [1, 2, 3]) {
        const before = h8.dispatched.length;
        h8.events.emit('combo:up', { streak: tier + 1, multiplier: tier, tier });
        h8.audio.flush(FR);
        tierRows.push(`tier${tier}→[${h8.dispatched.slice(before).join(',')}]`);
    }
    {
        const before = h8.dispatched.length;
        h8.events.emit('combo:up', { streak: 1, multiplier: 1, tier: 0 });
        h8.audio.flush(FR);
        zeroAt0 = h8.dispatched.length === before;
    }
    const ok08 = tierRows[0] === `tier1→[${C('AUDIO_CLIP_COMBO_T1')}]`
        && tierRows[1] === `tier2→[${C('AUDIO_CLIP_COMBO_T2')}]`
        && tierRows[2] === `tier3→[${C('AUDIO_CLIP_COMBO_T3')}]` && zeroAt0;
    p5('A05-08', 'sfx_combo_t1/t2/t3 · 按 tier 分流且不串音，tier=0 零发声', ok08,
        `【派发层】逐档广播 combo:up 并单帧 flush：${tierRows.join(' ')}；tier=0 帧新增派发=${zeroAt0 ? '0 条' : '非零'}。`
        + `　⇒ 三档各且仅各一条（无串音、无漏发）；未升档帧静默。`);

    // ══ part 2：A05-09 … A05-27 + P5·S（结构证据）═══════════════════════
    // v1.2 修（夹具缺陷，不得计为实现缺陷）：旧参数 5×4 + 2 色被 BOOT 校验**拒收**
    // （实测 `cols 5 outside [6,13]` / `rows 4 outside [5,12]` / `pattern colour count 2 < 3`，
    //  `levels.ts:120-158`）⇒ 实例永久停在 boot，A05-11/12/13/17/18/19/20/23 **连锁假 FAIL**。
    // 现取最小合法尺寸 6×5、3 色（同 P22 `probeLevel(918, 6, 5, …)` 口径），实测 `validateBeadsLevel → []`。
    const LVL = (id, time = 180, si = 6.0) => probeLevel(id, 6, 5, time, si, (i, j) => String(((i + 2 * j) % 3) + 1));
    const runFrames = (h, n) => { for (let i = 0; i < n; i++) h.tickFrame(FR); };
    /** 跑帧直到 pred 成立（返回实际帧数）；逐帧回调拿到本帧新增派发。 */
    function runWhile(h, pred, maxFrames, onFrame) {
        let n = 0;
        while (n < maxFrames && !pred(h)) {
            const before = h.dispatched.length;
            h.tickFrame(FR);
            if (onFrame) onFrame(h, h.dispatched.slice(before), FR);
            n++;
        }
        return n;
    }

    // ── A05-09 · sfx_combo_t2（[B] 时长 =150ms ±1）— 顺带项 ①：探针/台账同步（清 T-103 残留）
    //    真源 `audio-events §4` **WXG-T-103 追正后**现文：伪震屏属 **Lv2** ⇒ A05-09 主体 = sfx_combo_t2；
    //    t3 的「350ms + 与 burst 同帧」另立 **A05-09b**。**编号采 `b` 后缀，不做整体重排**
    //    （与 T-103 同口径：重排会牵动台账与已有证据引用，成本更高）。
    const h9 = ah(); h9.tickFrame(FR); h9.clearAudio();
    const p9 = h9.dispatched.length;
    h9.events.emit('combo:up', { streak: 3, multiplier: 2, tier: 2 });
    h9.audio.flush(FR);
    const t2n = cnt(h9.dispatched.slice(p9), C('AUDIO_CLIP_COMBO_T2'));
    p5('A05-09', 'sfx_combo_t2 · 时长 =150ms（±1）且与伪震屏（scale 1.015，tier=2）同帧起始', t2n === 1,
        `【本轮实测到的半边】广播 combo:up(tier=2) → 单帧 flush ⇒ sfx_combo_t2 新增派发 ${t2n} 次（三档分流另有 A05-08 独立取证）。`
        + `　【主体已按 WXG-T-103 追正 · WXG-T-119 探针同步】本条原以 **sfx_combo_t3** 为同帧主体（而伪震屏属 Lv2、t3 属 Lv3）⇒ 现改为 **sfx_combo_t2**；`
        + `t3 侧另立 **A05-09b**（350ms + 同帧 \`burst\`）。**T-103 残留至此清零。**`
        + `　【缺哪一道】「时长 =150 ms ±1」= **[B]**：本轮夹具无 AudioContext（实测 typeof globalThis.AudioContext=${typeof globalThis.AudioContext}），`
        + `拿到的只是配方**声明值** durationMs=${vcDur(C('AUDIO_CLIP_COMBO_T2'))}ms，不是实测包络；`
        + `**[B] 实测已另由 \`beads-browser-probe.mjs\`（WXG-T-119）在真 WebAudio 上取得 = 149.93ms ⇒ 通过**。`
        + `　【同帧主体归属】tier=2 → kind=pseudoShake / ${T.COMBO_VFX_LV2_MS}ms（combo-vfx.ts:46-50）⇒ 与配方一致。`
        + `　另记（不重复计缺陷）：Lv2 伪震屏在 view-model.ts:711 明文**未接入绘制**，属 BD-04 已登记的动效缺行。`,
        { block: '[B]' });

    // ── A05-09b · sfx_combo_t3（[B] 时长 =350ms ±1 ｜ 主体经 WXG-T-103 另立）
    const h9b = ah(); h9b.tickFrame(FR); h9b.clearAudio();
    const p9b = h9b.dispatched.length;
    h9b.events.emit('combo:up', { streak: 7, multiplier: 5, tier: 3 });
    h9b.audio.flush(FR);
    const t3n = cnt(h9b.dispatched.slice(p9b), C('AUDIO_CLIP_COMBO_T3'));
    p5('A05-09b', 'sfx_combo_t3 · 时长 =350ms（±1）且与 burst（tier=3）同帧起始', t3n === 1,
        `【本轮实测到的半边】广播 combo:up(tier=3) → 单帧 flush ⇒ sfx_combo_t3 新增派发 ${t3n} 次。`
        + `　【同帧主体】tier=3 → kind=burst / ${T.COMBO_VFX_LV3_MS}ms（combo-vfx.ts:46-50）⇒ 本条的同帧主体是 **burst**，不是伪震屏。`
        + `　【缺哪一道】「时长 =350 ms ±1」= **[B]**：声明值 durationMs=${vcDur(C('AUDIO_CLIP_COMBO_T3'))}ms，非实测包络；`
        + `**[B] 实测见 \`beads-browser-probe.mjs\`（WXG-T-119）** —— 该项两轮读数不一致（348.39 / 通过），**待裁，QA 不放宽 ±1ms**。`,
        { block: '[B]' });

    // ── A05-10 · combo:break 两 reason 同 clip；真路 wrong 时与 reject 同帧并存
    const h10 = ah(); h10.tickFrame(FR); h10.clearAudio();
    const rows10 = [];
    for (const reason of ['wrong', 'timeout']) {
        h10.clearAudio();
        h10.events.emit('combo:break', { reason });
        h10.audio.flush(FR);
        rows10.push(`${reason}→[${h10.dispatched.join(',')}]`);
    }
    const breakClip = C('AUDIO_CLIP_COMBO_BREAK');
    const synth10ok = rows10.every((r) => (r.match(new RegExp(breakClip, 'g')) || []).length === 1);
    // 真实路径（不是直发事件）：冲刺模式选一颗**错色**珠点到目标格 ⇒ 同帧 bead:rejected + combo:break
    const hS = ah({ levels: [LVL(940)] }); hS.tickFrame(FR); hS.game.startSprint(); hS.tickFrame(FR);
    const sS = hS.game.snapshot;
    let target = -1, targetColor = 0;
    for (let i = 0; i < sS.cells.length; i++) {
        const c = sS.cells[i];
        if (!c.void && c.state === 'empty' && c.colorIdx > 0) { target = i; targetColor = c.colorIdx; break; }
    }
    let wrongSlot = hS.game.snapshot.traySlots.findIndex((x) => x.state !== 'free' && x.colorIdx !== targetColor);
    if (wrongSlot < 0) { const g = hS.game.giveTrayBead(targetColor === 1 ? 2 : 1); wrongSlot = g; }  // 修订 20 注明例外：仅作「有错色珠」前置夹具
    if (wrongSlot >= 0) hS.game.selectTraySlot(wrongSlot);
    const snS = hS.game.snapshot;
    const t10 = target >= 0 ? tapAt(hS, ...cellXY(snS, target)) : { pending: 0, dispatched: [] };
    const rejEv = hS.count('bead:rejected'), brkEv = hS.count('combo:break');
    const realCoexist = t10.dispatched.includes(C('AUDIO_CLIP_REJECT')) && t10.dispatched.includes(breakClip);
    p5('A05-10', 'sfx_combo_break · wrong/timeout 两 reason 同 clip 各 1；wrong 同帧另有条 reject', synth10ok && realCoexist,
        `【派发层·合成事件】${rows10.join('；')} ⇒ 两 reason 均派发同一 clip 恰 1 次（handler 不读 reason，与 §5「只一行」同源）。`
        + `　【派发层·**真实点击**】冲刺模式选错色珠（槽 ${wrongSlot}，色≠格 ${target} 所需 ${targetColor}）后真帧点击：bead:rejected=${rejEv}、combo:break=${brkEv}，`
        + `同一 tick 派发=[${t10.dispatched.join(', ') || '（无）'}] ⇒ 两条并存不互斥（Q-A05-3 采「先并存」推荐项）。`
        + `　听感是否糊属 **[B]/[P]**，本条只验「并存不吞」，不宣称听感达标。`);

    // ── A05-11 / A05-12 / A05-13 · 告急心跳（同一条主体链：进入告急 → 心跳 → 暂停 → 续时停拍）
    const beat = C('AUDIO_CLIP_URGENT_BEAT');
    const hU = ah({ levels: [LVL(941, 180)] });
    let clkU = 0;
    hU.tickFrame(FR); clkU += FR;
    const beatT = [];
    const framesU = runWhile(hU, (h) => h.game.phase !== 'playing', 30000, (h, added) => {
        clkU += FR;
        const k = cnt(added, beat);
        if (k > 0) beatT.push({ t: Number(clkU.toFixed(4)), k });
    });
    const lvlTime = 180, crossAt = lvlTime - T.TIMER_URGENT_T;
    const gaps = [];
    for (let i = 1; i < beatT.length; i++) gaps.push(beatT[i].t - beatT[i - 1].t);
    const gmin = gaps.length ? Math.min(...gaps) : null, gmax = gaps.length ? Math.max(...gaps) : null;
    const gmean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
    const ok11 = hU.count('timer:urgent') === 1 && beatT.length >= 5 && beatT.every((x) => x.k === 1)
        && Math.abs(beatT[0].t - crossAt) <= 0.05 && gmin >= 0.95 && gmax <= 1.05;
    p5('A05-11', 'sfx_urgent_beat · 首拍由 timer:urgent 边沿驱动，后续每拍 1 次且间隔 1.0±0.05s', ok11,
        `【派发层】真关卡（time=${lvlTime}s，probe 关卡）以 fixedDt=1/60 跑到失败（${framesU} 帧 = ${(framesU * FR).toFixed(1)}s 仿真）：`
        + `timer:urgent 事件数=${hU.count('timer:urgent')}（应为 1 = 边沿）、sfx_urgent_beat 派发 ${beatT.length} 拍（时刻=[${beatT.map((x) => x.t.toFixed(2)).join(' ')}]s，逐拍次数=${u(beatT.map((x) => x.k)).join('/')}）。`
        + `　下穿阈值应发首拍的时刻 = time − TIMER_URGENT_T = ${crossAt}s，实测首拍 ${beatT.length ? beatT[0].t.toFixed(3) : '—'}s（偏 ${beatT.length ? (beatT[0].t - crossAt).toFixed(3) : '—'}s ≤ 1 帧）。`
        + `　相邻拍间隔 min=${gmin === null ? '—' : gmin.toFixed(3)}s / mean=${gmean === null ? '—' : gmean.toFixed(3)}s / max=${gmax === null ? '—' : gmax.toFixed(3)}s ⇒ 区间 [0.95,1.05]=${gmin !== null && gmax !== null && gmin >= 0.95 && gmax <= 1.05}。`
        + `　与 1000ms α 脉冲**同周期** = AUDIO_URGENT_BEAT_PERIOD=${T.AUDIO_URGENT_BEAT_PERIOD}s ≡ TIMER_TICK=${T.TIMER_TICK}s（同相属 **[B]** 可听，不在此宣称）。`);

    const ok13 = gmean !== null && (1 / gmean) <= 3 + 1e-9;
    p5('A05-13', 'sfx_urgent_beat · 拍频 ≤3 Hz（实为 1 Hz），不致听觉疲劳', ok13,
        `【[N] 周期半边】实测均拍 ${gmean === null ? '—' : gmean.toFixed(3)}s ⇒ 拍频 ${(gmean === null ? NaN : 1 / gmean).toFixed(3)} Hz ≤ 3 Hz=${ok13}（与 §3.8 视觉闪烁红线同源同界）。`
        + `　【缺哪一道】「主观不致疲劳」= **[P]**：本轮无 Playtest（阶段 6 未开始，无被试无录音）⇒ 整条记 PASS*，不得据周期达标宣称听感达标。`,
        { partial: true });

    // A05-12① PAUSED 期间零拍（独立实例：一次一事，修订 26）
    const hP = ah({ levels: [LVL(942, 180)] });
    let clkP = 0, beatsP = 0;
    hP.tickFrame(FR); clkP += FR;
    runWhile(hP, () => clkP > crossAt + 2.2, 30000, (h, added) => { clkP += FR; beatsP += cnt(added, beat); });
    hP.clearAudio();
    tapAt(hP, ...GEAR_XY); hP.tickFrame(FR);
    const pausedPhase = hP.game.phase;
    const remAtPause = Number(hP.game.remaining.toFixed(4));
    let beatsPaused = 0;
    for (let i = 0; i < 180; i++) { const b = hP.dispatched.length; hP.tickFrame(FR); beatsPaused += cnt(hP.dispatched.slice(b), beat); }
    const remAfterPaused = Number(hP.game.remaining.toFixed(4));
    const tickDuringPause = hP.count('timer:tick');
    hP.clearAudio();
    tapBtn(hP, pausePanelLayout('normal'), 'resume');
    let beatsResumed = 0;
    for (let i = 0; i < 180; i++) { const b = hP.dispatched.length; hP.tickFrame(FR); beatsResumed += cnt(hP.dispatched.slice(b), beat); }
    const ok12a = beatsP >= 2 && pausedPhase === 'paused' && beatsPaused === 0 && remAfterPaused === remAtPause && beatsResumed >= 2;

    // A05-12② 续时使 remaining 回到阈值以上 ⇒ 心跳停（沿用 hU 同一主体链的失败后状态）
    const remAtFail = Number(hU.game.remaining.toFixed(4));
    hU.clearAudio();
    const revU = hU.game.requestRevive();
    const adU = hU.services.rewardedAd;
    adU.settle('complete');
    const phaseAfterRevive = hU.game.phase, remAfterRevive = Number(hU.game.remaining.toFixed(2));
    let beatsAfterRevive = 0;
    for (let i = 0; i < 300; i++) { const b = hU.dispatched.length; hU.tickFrame(FR); beatsAfterRevive += cnt(hU.dispatched.slice(b), beat); }
    const ok12b = remAtFail <= 0.05 && revU === true && phaseAfterRevive === 'playing'
        && remAfterRevive > T.TIMER_URGENT_T && beatsAfterRevive === 0;
    p5('A05-12', 'sfx_urgent_beat · 回到阈值以上后停拍；PAUSED 期间零拍', ok12a && ok12b,
        `① PAUSED（真点齿轮，另一实例）：告急已发 ${beatsP} 拍后进 PAUSED（phase=${pausedPhase}），暂停 3.0s（180 帧）新增拍=${beatsPaused}、`
        + `remaining ${remAtPause}s → ${remAfterPaused}s（冻结=${remAfterPaused === remAtPause}）、该实例 timer:tick 累计=${tickDuringPause} ⇒ 计时不走 ⇒ 无拍；恢复后 3.0s 新增拍=${beatsResumed}（证明不是「拍源已死」）。`
        + `② 续时回阈值以上（hU 链）：失败时 remaining=${remAtFail}s → requestRevive=${revU} + 广告 complete ⇒ phase=${phaseAfterRevive}、remaining=${remAfterRevive}s（加 REVIVE_BONUS_SEC=${T.REVIVE_BONUS_SEC}s，> TIMER_URGENT_T=${T.TIMER_URGENT_T}）`
        + `→ 再跑 5.0s（300 帧）新增拍=${beatsAfterRevive} ⇒ 停拍成立。`);

    // ── A05-14 · tray:full 音只 1 次不循环 + 与视觉呼吸**互不驱动**（修订 40：第二主体随 WXG-T-097/BD-10 到位）
    const h14 = ah(); h14.tickFrame(FR); h14.clearAudio();
    const perEmit = [];
    for (let k = 0; k < 3; k++) {
        const before = h14.dispatched.length;
        h14.events.emit('tray:full', {});
        h14.audio.flush(FR);
        perEmit.push(cnt(h14.dispatched.slice(before), C('AUDIO_CLIP_TRAY_FULL')));
        runFrames(h14, 132);           // 2.2s 间隔：不靠限流把人少发（事件天然间隔 ≥ SPAWN_INTERVAL_MIN）
    }
    const req14 = h14.requests.filter((r) => r.id === C('AUDIO_CLIP_TRAY_FULL'));
    const ok14audio = perEmit.every((n) => n === 1) && req14.length === 3 && req14.every((r) => r.loop === false);
    // 【修订 40】「互不驱动」不再只能单向成立：拿**真满槽实例**量两个方向。
    // 〔层〕本段只取「音↔视觉」耦合关系（A05-14 正文子句）；呼吸本体的周期正量仍以 P7④ 为准。
    const h14v = fullTrayHarness(914, 420, { flushAudio: true });
    const reqBase = () => h14v.requests.filter((r) => r.id === C('AUDIO_CLIP_TRAY_FULL')).length;
    const req0 = reqBase(), ev0 = h14v.count('tray:full');
    const seq14a = trayBreathSeq(h14v, 90);                       // 1.5s = 3 个 500ms 周期
    const pm14a = pulsePeriodMs(seq14a.filter((v) => !Number.isNaN(v)));
    const reqDeltaQuiet = reqBase() - req0;                       // 呼吸期间（§8-4 去重 ⇒ 无新事件）应为 0
    const evDeltaQuiet = h14v.count('tray:full') - ev0;
    h14v.advance(2.2);                                            // 再跨一个供料间隔（仍满槽 ⇒ 仍不应重复广播）
    const evDeltaNext = h14v.count('tray:full') - ev0;
    const reqDeltaNext = reqBase() - req0;
    const seq14b = trayBreathSeq(h14v, 90);
    const pm14b = pulsePeriodMs(seq14b.filter((v) => !Number.isNaN(v)));
    tapRouterAt(h14v, GEAR_XY[0], GEAR_XY[1]);                     // 经真路由关 SFX（恢复后再采样）
    tapBtn(h14v, pausePanelLayout('normal'), 'toggle-sfx');
    tapBtn(h14v, pausePanelLayout('normal'), 'resume');
    const seq14c = trayBreathSeq(h14v, 90);
    const pm14c = pulsePeriodMs(seq14c.filter((v) => !Number.isNaN(v)));
    const ok14vis = !seq14a.some(Number.isNaN) && pm14a.distinct >= 2
        && pm14a.periodMs !== null && Math.abs(pm14a.periodMs - 500) <= 50;
    // ⓑ 音不跟呼吸：满槽期间事件被 `spawner._fullReported` 去重 ⇒ 两批呼吸窗口内请求增量均为 0；
    //   而「音跟事件」的正向已由本条音频半边（3 次注入 ⇒ 3 次派发）覆盖，不在此重复。
    const ok14decouple = ok14vis && evDeltaQuiet === 0 && reqDeltaQuiet === 0
        && evDeltaNext === 0 && reqDeltaNext === 0
        && pm14b.periodMs !== null && Math.abs(pm14b.periodMs - pm14a.periodMs) <= 20
        && h14v.game.sfxMuted && !seq14c.some(Number.isNaN)
        && pm14c.periodMs !== null && Math.abs(pm14c.periodMs - pm14a.periodMs) <= 20;
    // 【T-151 · 判据时效性】第二主体（真满槽实例）在 v2.0 供料关停下不可构造（hold 恒 0、tray:full 恒 0）
    // ⇒ 视觉呼吸半边 ⛔；音频半边（事件注入 3 次恰 3 派发）不受影响仍可测 ⇒ 整条记 PASS*（partial）。
    const fullTrayAlive = h14v.count('tray:full') > 0 || h14v.hold() >= T.TRAY_BASE_SLOTS;
    p5('A05-14', 'sfx_tray_full · 每次 tray:full 派发 1 次且不循环；与视觉呼吸互不驱动',
        ok14audio && (!fullTrayAlive || ok14decouple),
        `【[N] 音频半边·派发层】隔 2.2s 注入 3 次 tray:full ⇒ 每次新增派发=${perEmit.join('/')}（恰 1）；`
        + `【[N] 音频半边·请求层】3 次请求的 loop 入参全=${u(req14.map((r) => r.loop)).join('/')} ⇒ **不循环**成立（minInterval=${u(req14.map((r) => r.minInterval)).join('/')} = AUDIO_TRAYFULL_MIN_INTERVAL=${T.AUDIO_TRAYFULL_MIN_INTERVAL}）。`
        + `　【第二主体已到位·修订 40】真满槽实例（fullTrayHarness(914, 420s)：A′ 合法供料自然灌满、不落子，**并等到首次 tray:full 广播** ⇒ 基线 ev=${ev0}）上量两个方向：`
        + `ⓐ 呼吸周期实测 ${pm14a.periodMs ? pm14a.periodMs.toFixed(0) : '—'}ms（ux-spec §5 = 500ms±50）、α 档数=${pm14a.distinct}；`
        + `ⓑ **音不跟视觉循环**：连续两批呼吸窗口（90 帧 = 3 周期、再加 2.2s）内 tray:full 事件增量=${evDeltaQuiet}/${evDeltaNext}、clip 请求增量=${reqDeltaQuiet}/${reqDeltaNext}`
        + `（全为 0 ⇒ 音不随呼吸重复触发；去重锁正本 = tray-spawner §8-4 + spawner.ts:_fullReported，而 α 仍在往复：第二段周期 ${pm14b.periodMs ? pm14b.periodMs.toFixed(0) : '—'}ms）；`
        + `ⓒ **视觉不跟音**：经真路由面板 toggle-sfx 后（sfxMuted=${h14v.game.sfxMuted}）呼吸仍在，周期 ${pm14c.periodMs ? pm14c.periodMs.toFixed(0) : '—'}ms、档数=${pm14c.distinct}。`
        + `　⇒ 修订 37 记的 partial（「互不驱动」无法双向成立）**随 BD-10 落地而解除**：改判源自**实现变化**，非口径放宽；P7④ 同轮取同一夹具 ⇒ 两处周期数字必须一致。`
        + `　【T-151 · 判据时效性】第二主体（真满槽实例）在 **v2.0 供料关停**下不可构造（hold 恒 0、tray:full 恒 0）⇒ 视觉呼吸半边 ⛔（pm14a 实测 —ms 即此故）；音频半边不受影响仍可测 ⇒ 整条 **PASS\\***（复活条件 = 供料复活）。`,
        { partial: !(ok14audio && ok14decouple) || !fullTrayAlive });

    // ── A05-15 · sprint:stage 派发（双段属 [B]）
    const h15 = ah(); h15.tickFrame(FR); h15.clearAudio();
    const b15 = h15.dispatched.length;
    h15.events.emit('sprint:stage', { stage: 2 });
    h15.audio.flush(FR);
    const n15 = cnt(h15.dispatched.slice(b15), C('AUDIO_CLIP_STAGE'));
    p5('A05-15', 'sfx_stage · sprint:stage 帧内派发；250+250 双段与淡出/淡入对齐', n15 === 1,
        `【[N] 派发半边】广播 sprint:stage → 单帧 flush ⇒ sfx_stage 新增派发 ${n15} 次（=1）。`
        + `　【缺哪一道】「250+250 双段结构与旧图淡出/新图淡入**分段对齐**」= **[B]**：本轮只能读到配方声明值 durationMs=${vcDur(C('AUDIO_CLIP_STAGE'))}ms（=250+250 的**总长**表达），`
        + `是否真分成两段、两段相位是否与视觉分段对齐需要 Web Audio 可听 + 逐帧截图 ⇒ 记 ⛔。` + `　（无 AudioContext：typeof globalThis.AudioContext=${typeof globalThis.AudioContext}）`,
        { block: '[B]' });

    // ── A05-16 · level:cleared 帧内派发 + 时长/同帧视觉
    const h16 = ah(); h16.tickFrame(FR); h16.clearAudio();
    const b16 = h16.dispatched.length;
    h16.events.emit('level:cleared', { levelId: 'L90', remaining: 90, ratio: 0.5, stars: 2 });
    h16.audio.flush(FR);
    const n16 = cnt(h16.dispatched.slice(b16), C('AUDIO_CLIP_CLEAR'));
    const waveConst = Object.keys(T).filter((k) => /COMPLETE_WAVE|WAVE/.test(k) && !k.startsWith('AUDIO_CLIP_'));
    p5('A05-16', 'sfx_clear · level:cleared 帧内派发；≤800ms 且与 vfx_complete_wave 首列同帧', n16 === 1,
        `【[N] 派发半边】广播 level:cleared → 单帧 flush ⇒ sfx_clear 新增派发 ${n16} 次（真实过关链路的同帧派发见 A05-17/A05-18）。`
        + `　【缺哪一道】「时长 ≤800 ms」= **[B]**（声明值 durationMs=${vcDur(C('AUDIO_CLIP_CLEAR'))}ms，无实测包络）；`
        + `「与 vfx_complete_wave 首列弹跳同帧起始」= 视觉主体缺失（tuning 内 WAVE 类常量 ${waveConst.length} 个${waveConst.length ? '：' + waveConst.join('/') : ''}），属 BD-04 已登记缺行 ⇒ 记 ⛔。`,
        { block: '[B] + 视觉主体缺失(BD-04)' });

    // ── A05-17 · sfx_star：结算逐星 1 次不重播 + 通关画面逐关行 1 次
    const lv17a = LVL(943), lv17b = LVL(944);
    const h17 = ah({ levels: [lv17a, lv17b] });
    h17.tickFrame(FR);
    // v1.2 修：旧表达式 `snapshot.levelTimeMs ? 0 : 180` 无意义（snapshot 无该字段 ⇒ 恒 180 且系探针自报）。
    // 现在分母直接用**自己造的关卡声明值**（当场拷标，修订 15bis(a) 同口径）。
    const rem17 = Number(h17.game.remaining.toFixed(4)), total17 = lv17a.time;
    const ratio17 = Math.max(0, Math.min(1, rem17 / total17));
    const starsWant = ratio17 >= T.STAR3_RATIO ? 3 : ratio17 >= T.STAR2_RATIO ? 2 : 1;
    const fillA = fillBoardAudio(h17), phaseA17 = h17.game.phase;
    h17.clearAudio(); runFrames(h17, 90);
    const starA = cnt(h17.dispatched, C('AUDIO_CLIP_STAR')), starsGot = h17.game.lastStars;
    h17.clearAudio(); runFrames(h17, 120);
    const starAReplay = cnt(h17.dispatched, C('AUDIO_CLIP_STAR'));
    h17.clearAudio(); tapBtn(h17, clearPanelLayout({ lastLevel: false }), 'next');
    const phaseB17 = h17.game.phase;
    const fillB = h17.tickFrame(FR) ?? true;                        // 给新关卡一帧同步快照
    const fillBok = fillBoardAudio(h17), phaseC17 = h17.game.phase;
    h17.clearAudio(); runFrames(h17, 90);
    const starC = cnt(h17.dispatched, C('AUDIO_CLIP_STAR'));
    h17.clearAudio(); tapBtn(h17, clearPanelLayout({ lastLevel: true }), 'next');
    const phaseD17 = h17.game.phase, lc17 = h17.game.levelCount;
    runFrames(h17, 90);
    const starD = cnt(h17.dispatched, C('AUDIO_CLIP_STAR'));
    const ok17 = fillA && phaseA17 === 'level-clear' && starA === starsWant && starsGot === starsWant
        && starAReplay === 0 && phaseB17 === 'playing' && fillBok && phaseC17 === 'level-clear' && starC === h17.game.lastStars
        && phaseD17 === 'finish' && starD === lc17;
    p5('A05-17', 'sfx_star · 结算面板逐星各 1 次（不重播）；通关画面逐关行各 1 次', ok17,
        `【派发层·真过关链路】星数期值由冻结阈值**独立复算**（不用 computeClearStars）：remaining=${rem17}s / total=${total17}s ⇒ ratio=${ratio17.toFixed(3)}，STAR3_RATIO=${T.STAR3_RATIO}/STAR2_RATIO=${T.STAR2_RATIO} ⇒ 应=${starsWant} 星。`
        + `　L1 填盘=${fillA} → phase=${phaseA17}；面板开启后 1.5s（90 帧）sfx_star 派发=${starA}（game.lastStars=${starsGot}）；`
        + `再跑 2.0s（120 帧）新增=${starAReplay}（期望 0 ⇒ **不重播**）。「下一关」→ phase=${phaseB17}；L2 填盘=${fillBok} → ${phaseC17}，1.5s 派发=${starC}。`
        + `　末关「查看结果」→ phase=${phaseD17}，1.5s 内 sfx_star 派发=${starD}（= 关卡数 ${lc17}，逐行入场各 1 次）。`
        + `　本条道次 = [N]（判据原文「现状已可测」）；星数视觉（逐颗 scale 0→1.2→1）属表现层，不在本条范围内重复取证。`);

    // ── A05-18 · 四个面板态入/出 + 遮罩零发声
    const h18 = ah({ levels: [LVL(945), LVL(946)] });
    h18.tickFrame(FR); h18.clearAudio();
    tapAt(h18, ...GEAR_XY);
    const inPaused = cnt(h18.dispatched, C('AUDIO_CLIP_PANEL_IN'));
    const pausedOk = h18.game.phase === 'paused';
    h18.clearAudio();
    // 面板外（网格）⇒ 遮罩吃掉，零发声。经 `_handleTap` 真路由（非 InputManager，见 tapBtn 注）：
    // 若走输入链，面板相位根本不读输入 ⇒ 「零发声」会因**收不到事件**而平凡为真（假绿，不得采用）。
    const scrimTap = tapRouterAt(h18, ...cellXY(h18.game.snapshot, 0));
    const scrimSilent = h18.dispatched.length === 0 && h18.audio.pendingCount === 0;
    const scrimNew = h18.dispatched.length, scrimConsumed = scrimTap.consumed;
    h18.clearAudio(); tapBtn(h18, pausePanelLayout('normal'), 'resume');
    const outPaused = cnt(h18.dispatched, C('AUDIO_CLIP_PANEL_OUT'));
    h18.clearAudio(); fillBoardAudio(h18);
    // 【T-151】结算面板有 800ms 延迟入场门（CLEAR_PANEL_DELAY_MS=WAVE_MS）⇒ panel_in 在门满帧才派发；
    // 旧版只 tickFrame(1) ⇒ inClear 恒 0（假 FAIL）。
    runFrames(h18, Math.ceil(T.WAVE_MS / 1000 / FR) + 10);
    const inClear = cnt(h18.dispatched, C('AUDIO_CLIP_PANEL_IN'));
    h18.clearAudio(); tapBtn(h18, clearPanelLayout({ lastLevel: false }), 'next');
    const outClear = cnt(h18.dispatched, C('AUDIO_CLIP_PANEL_OUT'));
    h18.clearAudio(); fillBoardAudio(h18); runFrames(h18, Math.ceil(T.WAVE_MS / 1000 / FR) + 10);   // 【T-151】同上等足延迟门
    h18.clearAudio(); tapBtn(h18, clearPanelLayout({ lastLevel: true }), 'next');
    const inFinish = cnt(h18.dispatched, C('AUDIO_CLIP_PANEL_IN'));
    h18.clearAudio(); tapBtn(h18, finishPanelLayout(h18.game.levelCount), 'replay');
    const outFinish = cnt(h18.dispatched, C('AUDIO_CLIP_PANEL_OUT'));
    const phaseAfterReplay = h18.game.phase;
    // GAME_OVER 入/出（另一实例，跑到失败）：同帧面板入 + 面板出由 retry 驱动
    const hF = ah({ levels: [LVL(947, 180)] });
    hF.tickFrame(FR);
    let clkF = 1 / 60, inGameOver = 0;
    const framesF = runWhile(hF, (h) => h.game.phase !== 'playing', 30000, (h, added) => { clkF += FR; inGameOver += cnt(added, C('AUDIO_CLIP_PANEL_IN')); });
    const phaseF = hF.game.phase;
    hF.clearAudio();
    // A05-20：未看完（skip）×10 次，每次隔 0.1s ⇒ 受同一 0.5s 限流
    let rev20 = 0, skip20 = 0;
    for (let i = 0; i < 10; i++) {
        if (hF.game.requestRevive()) rev20++;
        hF.services.rewardedAd.settle('skip'); skip20++;
        hF.tickFrame(FR * 6);                                        // 0.1s
    }
    runFrames(hF, 6);
    const reqReject = hF.requests.filter((r) => r.id === C('AUDIO_CLIP_REJECT'));
    const disReject = cnt(hF.dispatched, C('AUDIO_CLIP_REJECT'));
    const disReviveOk = cnt(hF.dispatched, C('AUDIO_CLIP_REVIVE_OK'));
    const win20 = Number((10 * 0.1 + 6 * FR).toFixed(3));
    const ok20 = rev20 === 10 && skip20 === 10 && reqReject.length === 10 && disReject >= 1 && disReject <= 2 * win20 + 1e-9
        && disReviveOk === 0 && reqReject.every((r) => r.minInterval === T.AUDIO_REJECT_MIN_INTERVAL);
    hF.clearAudio();
    tapBtn(hF, failPanelLayout(true), 'retry');
    const outGameOver = cnt(hF.dispatched, C('AUDIO_CLIP_PANEL_OUT'));
    const phaseAfterRetry = hF.game.phase;
    p5('A05-18', 'sfx_panel_in/out · 四个面板态入/出首帧均覆盖；遮罩拦截点击零发声', inGameOver >= 1 && outGameOver === 1 && pausedOk && scrimSilent && outPaused === 1 && inClear === 1 && outClear === 1 && inFinish === 1 && outFinish === 1 && phaseAfterReplay === 'playing' && phaseF === 'game-over',
        `【派发层】PAUSED 入=${inPaused}（phase=${pausedOk ? 'paused ✓' : '✗'}，经真输入链点齿轮）/ 面板外路由点网格零发声=${scrimSilent}（新增派发=${scrimNew}）/ 恢复出=${outPaused}；`
        + `LEVEL_CLEAR 入=${inClear} / 下一关出=${outClear}；FINISH 入=${inFinish} / 重玩出=${outFinish}（phase→${phaseAfterReplay}）；`
        + `GAME_OVER：真跑到失败（${framesF} 帧）入=${inGameOver}（phase=${phaseF}）/ 重试出=${outGameOver}（phase→${phaseAfterRetry}）。`
        + `　【遮罩子句】在 PAUSED 下经真路由点网格格 0：新增派发=${scrimNew}（期望 0）、路由返回 consumed=${scrimConsumed}（期望 false ⇒ 未落入任何分支）⇒ 遮罩吃掉点击且不落到任何音频请求。`
        + `　【未闭】时长 ≤200/≤150 ms 属 **[B]**（声明值 in=${vcDur(C('AUDIO_CLIP_PANEL_IN'))} / out=${vcDur(C('AUDIO_CLIP_PANEL_OUT'))}ms），但**派发与面板态同帧**是本条 [N] 本体 ⇒ 整条仍含 [B] 子句。`,
        { partial: true });

    // ── A05-19 · sfx_revive_ok（正路 hU 链 / 反路 hF skip）
    const revReq = hU.requests.filter((r) => r.id === C('AUDIO_CLIP_REVIVE_OK'));
    const revDis = cnt(hU.dispatched, C('AUDIO_CLIP_REVIVE_OK'));
    const ok19 = revReq.length === 1 && revDis === 1 && revU === true && phaseAfterRevive === 'playing'
        // v1.2 修：旧表达式把「后续 300 帧」预先从期望里扣掉，但 remAfterRevive 是在 settle 后**立即**读的
        // ⇒ 恒差 5s（假 FAIL）。现按实现语义直接对账：续时把 remaining **置为** REVIVE_BONUS_SEC（从 0 起算）。
        && Math.abs(remAfterRevive - T.REVIVE_BONUS_SEC) < 1.5 && disReviveOk === 0;
    p5('A05-19', 'sfx_revive_ok · 只在真加时那一帧派发；未看完 ⇒ 零派发', ok19,
        `【正路】hU：失败时 remaining=${remAtFail}s → requestRevive=${revU} + 广告 complete ⇒ 本次请求=${revReq.length} 次（loop=${revReq.map((r) => r.loop).join('/')}）、`
        + `随后 300 帧内派发=${revDis} 次，phase=${phaseAfterRevive}、remaining=${remAfterRevive}s（= REVIVE_BONUS_SEC=${T.REVIVE_BONUS_SEC}s，实测为**置位**而非在已耗尽的 0s 上叠加）。`
        + `　【反路】hF：10 次续时均 settle(skip) ⇒ sfx_revive_ok 派发=${disReviveOk}（零加时零奖励音 ✓）；同时 panel 未离开 game-over。`
        + `　【口径注】广告回调在 tick 外发生（真机也如此）⇒ 入队后**下一次 flush** 派发 = 同一个可观察帧（延迟≤1 帧，A05-02 通则）；本帧面板出（panel_out=${outGameOver >= 0 ? cnt(hU.dispatched, C('AUDIO_CLIP_PANEL_OUT')) : 0}）同帧发生。`
        + `　【未闭】「反馈总时长 ≤400 ms」= **[B]**（声明值 ${vcDur(C('AUDIO_CLIP_REVIVE_OK'))}ms）+ 胶囊数字跳到 N 属视觉 ⇒ 记 PASS*。`,
        { partial: true });

    p5('A05-20', 'sfx_reject（续时未看完）· 受同一 0.5s 限流，连点不产生 >2 次/秒', ok20,
        `【派发层】game-over 下连做 10 次「续时 → 未看完（skip）」，每次隔 0.1s（窗口共 ${win20}s）：`
        + `requestRevive 成功=${rev20}/10、玩法侧请求=${reqReject.length} 次（minInterval 入参=${u(reqReject.map((r) => r.minInterval)).join('/')}）、backend 实际收到 sfx_reject=${disReject} 次 `
        + `⇒ 上限 ${(2 * win20).toFixed(2)} 次、实测 ${(disReject / win20).toFixed(2)} 次/秒 ⇒ ≤2 次/秒=${disReject <= 2 * win20 + 1e-9}。`
        + `　与 A05-05 同源（同一个 clip + 同一个 0.5s 档），不新增参数；本条另证「续时路径上确实发了 reject」（非直发事件）。`);

    // ── A05-21 · bgm_main：BOOT 恰一次 {loop:true} + 静音 stop / 解除重入队
    const hB = ah();
    const bgmId = C('AUDIO_CLIP_BGM');
    const bootReq = hB.requests.filter((r) => r.id === bgmId);
    const bootOk = bootReq.length === 1 && bootReq[0].loop === true;
    // v1.2 修（夹具缺陷）：旧版先 `clearAudio()` 再数派发 ⇒ `clearAudio` 内部的 `flush(0)` 会把 BOOT
    // 那一次 bgm 派发**推上账面后又清空** ⇒ `bootDispatch` 恒 0（假 FAIL）。现在先读账再清。
    hB.tickFrame(FR);
    const bootDispatch = cnt(hB.dispatched, bgmId);
    hB.clearAudio(); runFrames(hB, 3);
    const bootRedispatch = cnt(hB.dispatched, bgmId);
    tapAt(hB, ...GEAR_XY); hB.tickFrame(FR);
    const gearPhase = hB.game.phase;
    hB.clearAudio();
    const muteTap1 = tapBtn(hB, pausePanelLayout('normal'), 'toggle-bgm');
    const mutedNow = hB.game.bgmMuted, stopsOnMute = hB.stops.slice();
    runFrames(hB, 180);
    const reqWhileMuted = hB.requests.filter((r) => r.id === bgmId).length;
    hB.clearAudio();
    const unmuteTap = tapBtn(hB, pausePanelLayout('normal'), 'toggle-bgm');
    const reqAfterUnmute = hB.requests.filter((r) => r.id === bgmId);
    const ok21 = bootOk && bootDispatch === 1 && bootRedispatch === 0 && gearPhase === 'paused'
        && muteTap1.consumed === true && unmuteTap.consumed === true
        && mutedNow === true && stopsOnMute.includes(bgmId)
        && reqWhileMuted === 0 && reqAfterUnmute.length === 1 && reqAfterUnmute[0].loop === true;
    p5('A05-21', 'bgm_main · BOOT 入队 {loop:true} 恰 1 次；bgmMuted ⇒ stop 且零重入队；解除 ⇒ 重新入队', ok21,
        `【请求层】init（BOOT 装配）后首次采样：bgm_main 请求=${bootReq.length} 次、loop=${bootReq.map((r) => r.loop).join('/')}；`
        + `第一帧帧末**派发层**=${bootDispatch} 次；再跑 3.0s 后重入队=${bootRedispatch}（期望 0 ⇒ 不逐帧重发）。`
        + `齿轮相位=${gearPhase}；静音开关（经「_handleTap 真路由」点 toggle-bgm，consumed=${muteTap1.consumed}、该帧派发=[${muteTap1.dispatched.join(',') || '（无）'}]）：`
        + `bgmMuted=${mutedNow}、backend.stop 调用=[${stopsOnMute.join(',')}]；保持静音 3.0s（180 帧）期间 bgm 重入队=${reqWhileMuted}（期望 0）；`
        + `解除后再点一次（consumed=${unmuteTap.consumed}）：重新入队=${reqAfterUnmute.length} 次、loop=${reqAfterUnmute.map((r) => r.loop).join('/')}。`
        + `　【未闭】「无缝循环点」= **[B]**（本轮无 AudioContext；loopMs=${BEADS_AUDIO_VOICES[bgmId]?.loopMs}ms 仅声明值）⇒ 记 PASS*。`,
        { partial: true });

    // ── A05-22 · bgm_main 幂等（需真后端契约）
    const loopCapable = typeof fw.SynthAudioBackend === 'function' && Number(BEADS_AUDIO_VOICES[bgmId]?.loopMs) > 0;
    p5('A05-22', 'bgm_main · 重复 play({loop:true}) 不得重启播放位置', loopCapable,
        `【缺哪一道】**[B]+[R]**。「不重启位置」是 backend 运行期契约，需要真 Web Audio 上下文里对 currentPosition / 缓冲偏移的可听或可测观测。`
        + `本轮夹具 backend=${hB.rawBackend.constructor.name}（Null）⇒ 不可验。`
        + `　已在 **P5·S** 里以**结构证据**补到一层：SynthAudioBackend 的 _loops 命中即 return（重复 loop 请求不新建源节点）。`
        + `　但「Node 里没建新节点」≠「人耳听不出重启」（AGENTS §7），且微信侧 createWebAudioContext 子集行为另属 **[R]**（无 AppID/无真机）⇒ 不据此关单。`
        + `（上面算出的 ok=${loopCapable} 仅为「已备 loopMs 且引擎已存」的 **[B]** 前置预检，**不是**本条验收结论）`,
        { block: '[B]+[R]' });

    // ── A05-23 · 全表·静音可玩（三子句：SFX 门控 / 双通道独立 / 全关零阻塞）
    // 子句 ①：只关 SFX（一次一事，修订 26）⇒ 任意玩法事件注入后 pendingCount 恒 0
    const h23a = ah(); h23a.tickFrame(FR);
    tapAt(h23a, ...GEAR_XY); h23a.tickFrame(FR);
    tapBtn(h23a, pausePanelLayout('normal'), 'toggle-sfx');
    const sfxOffA = h23a.game.sfxMuted, bgmStillOnA = h23a.game.bgmMuted;
    h23a.clearAudio();
    const EV23 = [
        ['bead:placed', { row: 0, col: 0, colorIdx: 1, slot: 0 }],
        ['tray:selected', { slot: 0, colorIdx: 1 }],
        ['bead:rejected', { row: 0, col: 0, reason: 'wrong' }],
        ['powerup:used', { type: 'random', affectedSlots: [0, 1] }],
        ['combo:up', { streak: 4, multiplier: 3, tier: 2 }],
        ['combo:break', { streak: 4, reason: 'wrong' }],
        ['tray:full', {}],
        ['sprint:stage', { stage: 2 }],
        ['timer:tick', { remaining: 5 }],
        ['timer:urgent', { remaining: 5 }],
        ['level:cleared', { levelId: 'L90', remaining: 90, ratio: 0.5, stars: 3 }],
    ];
    const rows23a = [];
    let pendSum23a = 0, dispSum23a = 0;
    for (const [type, payload] of EV23) {
        const before = h23a.dispatched.length;
        h23a.events.emit(type, payload);
        const pend = h23a.audio.pendingCount;
        h23a.audio.flush(FR);
        pendSum23a += pend; dispSum23a += h23a.dispatched.length - before;
        rows23a.push(`${type}→pending ${pend}/派发 +${h23a.dispatched.length - before}`);
    }
    const ok23a = sfxOffA === true && bgmStillOnA === false && pendSum23a === 0 && dispSum23a === 0 && h23a.requests.length === 0;

    // 子句 ②：只关 BGM ⇒ SFX 照常（双通道独立）
    const h23c = ah(); h23c.tickFrame(FR);
    tapAt(h23c, ...GEAR_XY); h23c.tickFrame(FR);
    tapBtn(h23c, pausePanelLayout('normal'), 'toggle-bgm');
    const bgmOffC = h23c.game.bgmMuted, sfxStillOnC = h23c.game.sfxMuted;
    tapBtn(h23c, pausePanelLayout('normal'), 'resume');
    h23c.tickFrame(FR); h23c.clearAudio();
    const i23c = (primePlaceable(h23c) || { slot: -1 }).slot; /* T-151 v2.0 前置 */
    const t23c = tapAt(h23c, ...slotXY(i23c));
    const bgmReqC = h23c.requests.filter((r) => r.id === C('AUDIO_CLIP_BGM')).length;
    const ok23c = bgmOffC === true && sfxStillOnC === false && cnt(t23c.dispatched, C('AUDIO_CLIP_SELECT')) === 1 && bgmReqC === 0;

    // 子句 ③：两开关全关 ⇒ 真·8 关全通 + 冲刺入口零阻塞（全程零音频请求）
    const h23b = ah({ levels: LEVELS }); h23b.tickFrame(FR);
    tapAt(h23b, ...GEAR_XY); h23b.tickFrame(FR);
    tapBtn(h23b, pausePanelLayout('normal'), 'toggle-sfx');
    tapBtn(h23b, pausePanelLayout('normal'), 'toggle-bgm');
    const bothOff = h23b.game.sfxMuted && h23b.game.bgmMuted;
    const reqBase23b = h23b.requests.length, disBase23b = h23b.dispatched.length;
    tapBtn(h23b, pausePanelLayout('normal'), 'resume'); h23b.tickFrame(FR);
    const chain23b = [];
    let brokeAt23b = 0;
    for (let lv = 0; lv < LEVELS.length; lv++) {
        if (!fillBoardAudio(h23b)) { brokeAt23b = lv + 1; break; }
        chain23b.push(`${lv + 1}:${h23b.game.phase}`);
        runFrames(h23b, Math.ceil(T.WAVE_MS / 1000 / FR) + 10);   // 【T-151】等足 800ms 延迟门（星结算 + 面板 open）再点「下一关」
        tapBtn(h23b, clearPanelLayout({ lastLevel: lv === LEVELS.length - 1 }), 'next');
        h23b.tickFrame(FR);
        chain23b.push(h23b.game.phase);
    }
    const phaseFin23b = h23b.game.phase;
    tapBtn(h23b, finishPanelLayout(h23b.game.levelCount), 'sprint'); h23b.tickFrame(FR);
    const sprintPhase = h23b.game.phase, sprintMode = h23b.game.mode;
    // 【T-151 · 判据时效性】v2.0 供料关停 ⇒ 冲刺开局托盘恒空 ⇒「3s 内托盘有珠」不可构造；
    // 「冲刺不因静音卡死」改证「phase 保持 playing 且 mode=sprint（玩法仍在跑）」。
    const sprintAlive = sprintPhase === 'playing' && sprintMode === 'sprint';
    const newReq23b = h23b.requests.length - reqBase23b, newDis23b = h23b.dispatched.length - disBase23b;

    // 子句 ③′：全关下的续时路径（normal 模式，真跑到失败 → 看完广告）
    const h23d = ah({ levels: [LVL(951, 180)] }); h23d.tickFrame(FR);
    tapAt(h23d, ...GEAR_XY); h23d.tickFrame(FR);
    tapBtn(h23d, pausePanelLayout('normal'), 'toggle-sfx');
    tapBtn(h23d, pausePanelLayout('normal'), 'toggle-bgm');
    const bothOffD = h23d.game.sfxMuted && h23d.game.bgmMuted;
    const reqBase23d = h23d.requests.length, disBase23d = h23d.dispatched.length;
    tapBtn(h23d, pausePanelLayout('normal'), 'resume');
    const frames23d = runWhile(h23d, (h) => h.game.phase !== 'playing', 30000);
    const phase23d = h23d.game.phase;
    const rev23d = h23d.game.requestRevive();
    h23d.services.rewardedAd.settle('complete');
    h23d.tickFrame(FR);
    const phaseAfter23d = h23d.game.phase, remAfter23d = Number(h23d.game.remaining.toFixed(1));
    runFrames(h23d, 120);
    const ok23d = bothOffD && phase23d === 'game-over' && rev23d === true && phaseAfter23d === 'playing'
        && remAfter23d > T.TIMER_URGENT_T && h23d.requests.length === reqBase23d && h23d.dispatched.length === disBase23d;
    const ok23 = ok23a && ok23c && bothOff && brokeAt23b === 0 && phaseFin23b === 'finish'
        && sprintPhase === 'playing' && sprintMode === 'sprint' && sprintAlive && newReq23b === 0 && ok23d;
    p5('A05-23', '全表·静音可玩 · sfxMuted 门控 / 双通道独立 / 全关下 8 关+冲刺+续时零阻塞', ok23,
        `① 只关 SFX（经真路由点暂停面板 toggle-sfx，驱动口径见本段 tapBtn 注；bgmMuted 仍=${bgmStillOnA}）：注入 ${EV23.length} 类玩法事件（含 powerup 带 affectedSlots、告急两拍、过关）`
        + `⇒ 逐事件「注入后 pendingCount / 该帧派发」= ${rows23a.join('；')}。Σpending=${pendSum23a}、Σ派发=${dispSum23a}、`
        + `期间**请求层**也=0（audio.play 调用=${h23a.requests.length} 次）⇒ 门控发生在 _sfx()（beads-game.ts:1656），连入队都没有。`
        + `② 只关 BGM（toggle-bgm 后恢复）：真点托盘槽 ⇒ sfx_select 派发=${cnt(t23c.dispatched, C('AUDIO_CLIP_SELECT'))}（照常），同窗 bgm_main 重新入队=${bgmReqC}（期望 0）⇒ **双通道独立**。`
        + `③ 两开关全关（sfxMuted=${bothOff}）后跑**真实 8 关**：${chain23b.join(' → ')}${brokeAt23b ? ' ⇒ 第 ' + brokeAt23b + ' 关填盘失败' : ''}，末关「查看结果」→ phase=${phaseFin23b}；`
        + `通关面板「去冲刺」→ phase=${sprintPhase}、mode=${sprintMode}、3.0s 后托盘有珠=${sprintAlive}（冲刺不因静音卡死）；`
        + `自静音基线起新增请求=${newReq23b}、新增派发=${newDis23b}（期望 0/0）。③′ 另实例真跑到失败（${frames23d} 帧）→ 续时（广告 complete）⇒ phase ${phase23d}→${phaseAfter23d}、`
        + `remaining=${remAfter23d}s（> TIMER_URGENT_T=${T.TIMER_URGENT_T}），全程新增请求/派发=${h23d.requests.length - reqBase23d}/${h23d.dispatched.length - disBase23d}。`
        + `　【边界】本条只证「静音不阻塞玩法 + 不产生音频请求」；「静音后是否真的没出声」在本夹具下必然为真（backend=${NULLEDBACKEND}）⇒ **不构成听感证据**，A05-26 仍属 [P]。`);

    // ── A05-24 · 全表·清单闭合（md §1 ↔ tuning 常量 ↔ voice 表 ↔ 调用点，四方对账）
    const srcGame23 = readFileSync(`${STAGE}/games/beads/src/game/beads-game.js`, 'utf8');
    const orphanConsts = codeClipKeys.filter((k) => !new RegExp('\\b' + k + '\\b').test(srcGame23));
    const litIds = [...srcGame23.matchAll(/["'](bgm_[a-z0-9_]+|sfx_[a-z0-9_]+)["']/g)].map((m) => m[1]);
    const strayLits = u(litIds).filter((x) => !codeClips.includes(x));
    const noVoiceRefs = codeClips.filter((id) => !voiceClips.includes(id));
    const dupSpec = specClips.length !== new Set(specClips).size;
    const setEq24 = specClips.length === codeClips.length && codeClips.length === voiceClips.length
        && specClips.every((id) => codeClips.includes(id)) && codeClips.every((id) => voiceClips.includes(id))
        && voiceClips.every((id) => specClips.includes(id));
    const totalEq24 = T.AUDIO_CLIP_TOTAL === specClips.length && typeof T.AUDIO_CLIP_TOTAL === 'number';
    const ok24 = setEq24 && totalEq24 && !dupSpec && noVoiceRefs.length === 0 && orphanConsts.length === 0 && strayLits.length === 0;
    // 附带审计（**不并入 A05-24 判定**：判据原文只管 id 集合）
    const busWant = (id) => (id.startsWith('bgm_') ? 'music' : (/^sfx_(ui_|panel_)/.test(id) || id === 'sfx_star' ? 'ui' : 'sfx'));
    const busDiff = voiceClips.filter((id) => BEADS_AUDIO_VOICES[id].bus !== busWant(id));
    // §1 时长列机读对账：纯数字者逐个比，非纯数字者列「待裁」（不猜值）
    const specDurRows = (() => {
        const md = readFileSync(resolve(ROOT, 'games/beads/design/audio/audio-events.md'), 'utf8');
        const seg = (md.split(/^## 2\. /m)[0] ?? '').split(/^## 1\. /m)[1] ?? '';
        const map = new Map();
        for (const line of seg.split('\n')) {
            const m = /^\|\s*`([a-z_0-9]+)`/.exec(line.trim());
            if (!m) continue;
            const cells = line.trim().split('|').map((s) => s.trim());
            if (!map.has(m[1])) map.set(m[1], cells[4] ?? '');
        }
        return map;
    })();
    const durHard = [], durSoft = [];
    for (const id of voiceClips) {
        const spec = String(specDurRows.get(id) ?? '（§1 无行）');
        const code = String(BEADS_AUDIO_VOICES[id].durationMs);
        if (/^\d+$/.test(spec)) { if (spec !== code) durHard.push(`${id} 表=${spec} 代码=${code}`); } else durSoft.push(`${id} 表=${spec} / 代码=${code}`);
    }
    p5('A05-24', '全表·清单闭合 · §1 的 19 id ↔ AUDIO_CLIP_* 常量 ↔ voice 表 ↔ 代码调用点', ok24,
        `四方计数：md §1 解析=${specClips.length}（重复=${dupSpec}）/ tuning 字符串常量=${codeClips.length}/ voice 表=${voiceClips.length}/ `
        + `§3.12 冻结 AUDIO_CLIP_TOTAL=${T.AUDIO_CLIP_TOTAL} ⇒ 三集合**双向相等**=${setEq24}、与冻结总数相等=${totalEq24}。`
        + `　差集：常量有而表无=[${codeClips.filter((x) => !specClips.includes(x)).join(',') || '空'}]；表有而无 voice=[${specClips.filter((x) => !voiceClips.includes(x)).join(',') || '空'}]；`
        + `无调用点的孤儿常量=[${orphanConsts.join(',') || '空'}]；绕过常量直写 id 的字面量=[${strayLits.join(',') || '空'}]（在 beads-game 编译产物里正则扫 sfx_*/bgm_* 字符串，命中 ${litIds.length} 处）。`
        + `　【附带审计·不并判】(a) bus 归属 vs §0 前缀派生规则不符=${busDiff.length ? busDiff.map((id) => id + '(' + BEADS_AUDIO_VOICES[id].bus + '，按规则应=' + busWant(id) + ')').join(' ') : '无'}`
        + ` ⇒ 属**表/代码谁回写**的裁定项（归属：音频表负责人回写 §0 例外，或实现改 bus），QA 不自裁、不改冻结常量；`
        + `　(b) §1 时长列**非纯数字**（口径待裁，探针不猜）：${durSoft.join(' ; ') || '无'}；纯数字列与代码不等=${durHard.length ? durHard.join(' ') : '0 处'}。`
        + `　注：本条是「文档↔代码」对账（表体解析自 md §1 正文），**不等于**「每个 clip 都能出声」（[B]/[R]）也不等于听感（[P]）。`);

    // ── A05-25 · 全表·包体（零音频文件）→ [C]
    const walkFiles = (dir, acc = []) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const p = resolve(dir, e.name);
            if (e.isDirectory()) walkFiles(p, acc); else acc.push(p);
        }
        return acc;
    };
    const buildRoot = resolve(ROOT, 'games/beads/cocos/build');
    const AUD25 = /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i;
    let b25 = { files: 0, audio: 0, bytes: 0, newest: 0 };
    if (existsSync(buildRoot)) {
        const ff = walkFiles(buildRoot);
        b25 = {
            files: ff.length,
            audio: ff.filter((p) => AUD25.test(p)).length,
            bytes: ff.filter((p) => AUD25.test(p)).reduce((n, p) => n + statSync(p).size, 0),
            newest: Math.max(...ff.map((p) => statSync(p).mtimeMs)),
        };
    }
    const SRC25 = ['packages/framework/src/platform/audio-synth.ts', 'games/beads/src/config/audio-voices.ts', 'games/beads/src/game/beads-game.ts'];
    const srcNewest25 = Math.max(...SRC25.map((p) => statSync(resolve(ROOT, p)).mtimeMs));
    p5('A05-25', '全表·包体 · Cocos 构建产物内音频文件数 = 0、音频 = 0 KB', b25.audio === 0 && b25.bytes === 0,
        `【缺哪一道】**[C]**（Cocos 构建产物核对）。本轮**未重跑 Cocos 构建** ⇒ 现有产物不构成 T-096 之后的证据。`
        + `　实测旁证（仅作旁证）：${existsSync(buildRoot) ? 'games/beads/cocos/build' : '（构建目录不存在）'} 内文件 ${b25.files} 个、其中音频扩展名文件 **${b25.audio} 个 / ${(b25.bytes / 1024).toFixed(1)} KB**，`
        + `产物最新 mtime=${new Date(b25.newest).toISOString()}；而 T-096 音频源码 mtime=${new Date(srcNewest25).toISOString()} ⇒ **产物早于音频实现**，不能据其判「合成引擎已进包」。`
        + `　代码级旁证（结构证据，非 [C]）：fw.SynthAudioBackend.usesExternalFiles()=${fw.SynthAudioBackend.usesExternalFiles()}（见 P5·S）⇒ 引擎按「零外部文件」路线实现。`
        + `　【新登记的阻塞项，见报告 §15 建议 BD-33/BD-34】(1) beads/breakout 两游戏 Cocos 镜像里**新增**的 audio-synth.ts / audio-voices.ts 均**无 .ts.meta 伴生文件**（同目录其余脚本一律有）⇒ 无编辑器介入时是否被 asset-db 收录不可知；`
        + `　(2) \`node tools/scripts/sync-framework-to-cocos.mjs --check\` 本轮实跑 **EXIT=1（12 处 differs）**，而该步是 verify 链第 8 项 ⇒ 其后的 harness:build/smoke 在该轮**不会执行**（evidence/framework-sync-check-v1.2.log）。`
        + `　⇒ 记 ⛔：解除条件 = 主理人跑 framework:sync + 补 meta + 重跑 build:cocos:web 后按 [C] 复核产物。`,
        { block: '[C]' });

    // ── A05-26 · 全表·听感 → [P]
    const dur26 = vcDur(C('AUDIO_CLIP_PLACE'));
    p5('A05-26', '全表·听感 · 连打 8 颗珠（200ms）不糊不炸、sfx_place 主观「软/治愈」', typeof dur26 === 'number',
        `【缺哪一道】**[P]**（阶段 6 Playtest 人耳）。本轮夹具 backend=${NULLEDBACKEND}、沙箱无浏览器录音通路 ⇒ 「糊/炸/机关枪感」「软 vs 硬」这类主观量**没有任何 Node 可测替身**。`
        + `　已测到的相邻量（不等于本条）：A05-05 证「200ms 连点不被限流吞成 1 声、≤2 次/秒」为**计数**结论；配方声明 sfx_place durationMs=${vcDur(C('AUDIO_CLIP_PLACE'))}ms、attackMs=${BEADS_AUDIO_VOICES[C('AUDIO_CLIP_PLACE')].attackMs ?? '—'}ms、wave=${BEADS_AUDIO_VOICES[C('AUDIO_CLIP_PLACE')].wave ?? '—'}（P5·S 结构面）。`
        + `　「同一 clip 连打 8 次会不会叠加成墙」还需要 bus 增益（§3.12 AUDIO_BUS_GAIN_* = [TODO] ⇒ 现恒 1.0，见 P5·S）与 [B] 实测混音。解除条件 = 阶段 6 + BD-19（Playtest 可执行性）。`
        + `（上面算出的 ok 仅为「配方声明值可读」的 **[P]** 前置预检（dur=${dur26}ms），**不是**本条验收结论）`,
        { block: '[P]' });

    // ── A05-27 · 全表·真机 → [R]
    const env27 = { wx: typeof globalThis.wx, ac: typeof globalThis.AudioContext, wk: typeof globalThis.webkitAudioContext };
    p5('A05-27', '全表·真机 · 微信 iOS 首手势出声 / 退后台回前台 BGM 恢复 / 无节点泄漏',
        env27.wx === 'undefined' && env27.ac === 'undefined' && env27.wk === 'undefined',
        `【缺哪一道】**[R]**（真机 + AppID）。环境事实：本轮无 AppID、无 iOS/Android 真机、沙箱禁监听 socket ⇒ 三子句均不可验。`
        + `　代码级旁证（结构证据，非 [R]）：weapp 侧 \`createAudioBackend\` 在「有 wx.createWebAudioContext + 有 voices」时返回 SynthAudioBackend，否则**告警 + Null**（P5·S 已用假 wx 双向实测，含 onTouchStart 解锁接线与 onHide/onShow 挂点）。`
        + `　P5·S 另测到一处需在真机复核的**行为观察**：suspend() 停曲保留期望态、resume() 会**新建 BufferSource** ⇒ 回前台时 BGM 从循环缓冲起点重来（activeLoops 0→1、bufSrc +1，计数见 P5·S），是否可接受需 [R]/[P] 判。`
        + `　「长玩 10 分钟内存平稳」另需一次性源（Web Audio 源节点不可复用，见 audio-synth.ts 头注「分配面」自认）的真机曲线 ⇒ 不因 Node 结构绿而关单。`
        + `（上面算出的 ok = 环境位实测 typeof wx=${env27.wx} / AudioContext=${env27.ac} / webkitAudioContext=${env27.wk}，作用是证实「[R] 前置不存在」，**不是**本条验收结论）`,
        { block: '[R]' });

    // ══ P5·S · SynthAudioBackend **装配 / 契约的结构证据（≠ 出声）** ══════════
    // 修订 32：单列一组、判定实算，且标题与正文都必须写明「结构证据 ≠ 可听」。
    const FS = { gain: 0, osc: 0, bufSrc: 0, buffer: 0, start: 0, connect: 0 };
    const fparam = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; } });
    class FakeAudioContext {
        constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = { connect() { }, disconnect() { } }; }
        createGain() { FS.gain++; return { gain: fparam(), connect() { FS.connect++; }, disconnect() { } }; }
        createOscillator() {
            FS.osc++;
            return { type: 'sine', frequency: fparam(), detune: fparam(), start() { FS.start++; }, stop() { FS.stop++; }, connect() { FS.connect++; }, disconnect() { } };
        }
        createBiquadFilter() { return { type: '', frequency: fparam(), connect() { FS.connect++; }, disconnect() { } }; }
        createBufferSource() {
            FS.bufSrc++;
            return { buffer: null, loop: false, playbackRate: fparam(), start() { FS.start++; }, stop() { FS.stop++; }, connect() { FS.connect++; }, disconnect() { } };
        }
        createBuffer(ch, len, sr) { FS.buffer++; const data = new Float32Array(len); return { length: len, sampleRate: sr, getChannelData: () => data }; }
        resume() { this.state = 'running'; }
    }
    const gAny = globalThis;
    const saved25 = { AC: gAny.AudioContext, WK: gAny.webkitAudioContext, AE: gAny.addEventListener, RE: gAny.removeEventListener };
    let sRes = {};
    try {
        gAny.AudioContext = FakeAudioContext;
        delete gAny.webkitAudioContext;
        // 摘掉 addEventListener：否则 WebPlatform._armAudioUnlock 会把监听器挂到真 globalThis，污染后续 25 组（修订 20 白盒隔离）
        gAny.addEventListener = undefined;
        gAny.removeEventListener = undefined;
        const mkWeb = () => new fw.WebPlatform({ storage: new fw.MemoryStorage() });
        sRes.webWithVoices = mkWeb().createAudioBackend({ voices: BEADS_AUDIO_VOICES }).constructor.name;
        sRes.webNoVoices = mkWeb().createAudioBackend().constructor.name;
        sRes.node = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createAudioBackend({ voices: BEADS_AUDIO_VOICES }).constructor.name;
        const wxH = { touch: 0, hide: 0, show: 0 };
        const fakeWx = {
            createWebAudioContext: () => new FakeAudioContext(),
            onTouchStart: () => { wxH.touch++; }, offTouchStart: () => { },
            onHide: () => { wxH.hide++; }, onShow: () => { wxH.show++; },
            getStorageSync: () => '', setStorageSync: () => { }, removeStorageSync: () => { },
            getWindowInfo: () => ({}),
        };
        sRes.wx = new fw.WeappPlatform(fakeWx).createAudioBackend({ voices: BEADS_AUDIO_VOICES }).constructor.name;
        sRes.wxNoCtx = new fw.WeappPlatform({ ...fakeWx, createWebAudioContext: undefined }).createAudioBackend({ voices: BEADS_AUDIO_VOICES }).constructor.name;
        sRes.wxHooks = wxH;
        const appAsm = new fw.App({ game: new BeadsGame({ saveKey: 'wxgame.beads.qa.p5s' }), platform: mkWeb() });
        sRes.asmBackend = appAsm.services.audio['_backend'].constructor.name;
        sRes.asmVoices = Object.keys(appAsm.game.audioVoices || {}).length;
        sRes.maxPerFrame = new fw.AudioScheduler(new fw.NullAudioBackend())['_maxPerFrame'];
        sRes.usesExt = fw.SynthAudioBackend.usesExternalFiles();
        // 引擎契约面：解锁前零节点 → 解锁补 BGM → 逐 clip 节点普查 → 未登记 id 告警
        const warns = [];
        const be = new fw.SynthAudioBackend(() => new FakeAudioContext(), BEADS_AUDIO_VOICES, { warn: (m) => warns.push(m) });
        const cStruct0 = { ...FS };
        sRes.ctorQuiet = be.contextReady === false && (FS.gain + FS.osc + FS.bufSrc + FS.buffer) === 0;
        be.play(C('AUDIO_CLIP_PLACE'), { volume: 1, loop: false });
        be.play(C('AUDIO_CLIP_BGM'), { volume: 1, loop: true });
        sRes.preUnlock = { ready: be.contextReady, loops: be.activeLoops().length, nodes: FS.gain + FS.osc + FS.bufSrc - cStruct0.gain - cStruct0.osc - cStruct0.bufSrc };
        be.unlock();
        sRes.postUnlock = { ready: be.contextReady, loops: be.activeLoops().join(',') || '（空）', buffers: FS.buffer, srcs: FS.bufSrc };
        const census = [];
        let zeroBuilt = [];
        for (const id of voiceClips) {
            const b = { osc: FS.osc, src: FS.bufSrc };
            be.play(id, { volume: 1, loop: id === C('AUDIO_CLIP_BGM') });
            const d = (FS.osc - b.osc) + (FS.bufSrc - b.src);
            census.push(`${id}:+${d}`);
            if (id !== C('AUDIO_CLIP_BGM') && d === 0) zeroBuilt.push(id);
        }
        sRes.zeroBuilt = zeroBuilt;
        sRes.census = census;
        // v1.2 修：离线渲染是**惰性**的 ⇒ unlock() 后只有 BGM 循环块（实测 1 块），
        // 噪声块要等首个 noise:true 的 clip 被播时才渲染。旧期望 `buffers >= 2` 是探针猜值（假 FAIL）。
        sRes.buffersFinal = FS.buffer;
        const w0 = warns.length, n0 = FS.gain + FS.osc + FS.bufSrc;
        be.play('sfx_not_in_table', { volume: 1, loop: false });
        sRes.unreg = { warns: warns.length - w0, nodes: FS.gain + FS.osc + FS.bufSrc - n0, msg: warns[0] ?? '' };
        const buses = be['_buses'];
        sRes.buses = { n: buses.size, gains: [...buses.entries()].map(([k, v]) => `${k}=${v.gain.value}`).join(','), gainTodo: T.AUDIO_BUS_GAIN_SFX };
        be.suspend();
        const loopsSuspended = be.activeLoops().length, srcBeforeResume = FS.bufSrc;
        be.resume();
        sRes.suspendResume = { afterSuspend: loopsSuspended, afterResume: be.activeLoops().length, newSrcOnResume: FS.bufSrc - srcBeforeResume };
        be.stop(C('AUDIO_CLIP_BGM'));
        sRes.afterStop = be.activeLoops().length;
        // 夹具新鲜度（修订 34）：dist 编译产物必须不早于被测源码
        const distEntry = resolve(ROOT, 'dev/harness/dist/dev/harness/main.js');
        sRes.fresh = {
            dist: new Date(statSync(distEntry).mtimeMs).toISOString(),
            srcNewest: new Date(Math.max(...[
                'packages/framework/src/platform/audio-synth.ts', 'packages/framework/src/platform/web.ts',
                'packages/framework/src/platform/weapp.ts', 'packages/framework/src/core/audio/audio.ts',
                'packages/framework/src/compose/app.ts', 'games/beads/src/config/audio-voices.ts',
                'games/beads/src/config/tuning.ts', 'games/beads/src/game/beads-game.ts',
            ].map((p) => statSync(resolve(ROOT, p)).mtimeMs))).toISOString(),
        };
        sRes.fresh.ok = statSync(distEntry).mtimeMs >= Math.max(...[
            'packages/framework/src/platform/audio-synth.ts', 'packages/framework/src/platform/web.ts',
            'packages/framework/src/platform/weapp.ts', 'packages/framework/src/core/audio/audio.ts',
            'packages/framework/src/compose/app.ts', 'games/beads/src/config/audio-voices.ts',
            'games/beads/src/config/tuning.ts', 'games/beads/src/game/beads-game.ts',
        ].map((p) => statSync(resolve(ROOT, p)).mtimeMs));
        sRes.SYNTH = fw.SynthAudioBackend.name;
    } finally {
        if (saved25.AC === undefined) delete gAny.AudioContext; else gAny.AudioContext = saved25.AC;
        if (saved25.WK === undefined) delete gAny.webkitAudioContext; else gAny.webkitAudioContext = saved25.WK;
        gAny.addEventListener = saved25.AE; gAny.removeEventListener = saved25.RE;
    }
    const okS = sRes.webWithVoices === sRes.SYNTH && sRes.webNoVoices === NULLEDBACKEND
        && sRes.node === NULLEDBACKEND && sRes.wx === sRes.SYNTH && sRes.wxNoCtx === NULLEDBACKEND
        && sRes.asmBackend === sRes.SYNTH && sRes.asmVoices === voiceClips.length
        && sRes.ctorQuiet && sRes.preUnlock.ready === false && sRes.preUnlock.loops === 0 && sRes.preUnlock.nodes === 0
        && sRes.postUnlock.ready === true && sRes.postUnlock.loops === C('AUDIO_CLIP_BGM') && sRes.postUnlock.buffers >= 1
        && sRes.buffersFinal >= 2
        && sRes.zeroBuilt.length === 0
        && sRes.unreg.warns === 1 && sRes.unreg.nodes === 0
        && sRes.buses.n === 3 && /^[a-z]+=1(,[a-z]+=1)*$/.test(sRes.buses.gains)
        && sRes.suspendResume.afterSuspend === 0 && sRes.suspendResume.afterResume === 1
        && sRes.afterStop === 0 && sRes.usesExt === false
        && sRes.maxPerFrame === T.AUDIO_MAX_PER_FRAME && sRes.fresh.ok === true;
    rec('P5/S · SynthAudioBackend 装配与契约【**结构证据 ≠ 出声**】', okS ? 'PASS*' : 'FAIL',
        `【三平台分支实测（假 AudioContext 注入，随后已还原 globalThis）】web + voices → ${sRes.webWithVoices}；web 无 voices → ${sRes.webNoVoices}；`
        + `node（即便给 voices）→ ${sRes.node}；weapp + 假 wx.createWebAudioContext + voices → ${sRes.wx}（并挂上 onTouchStart=${sRes.wxHooks.touch} 次、onHide=${sRes.wxHooks.hide}、onShow=${sRes.wxHooks.show}）；`
        + `weapp 无 createWebAudioContext → ${sRes.wxNoCtx} ⇒ ADR-0013 的「能力 + 音色表」双条件成立。`
        + `　【装配根】new App({ game: BeadsGame, platform: WebPlatform })不 start ⇒ services.audio._backend = ${sRes.asmBackend}、注入进去的 voices 条数=${sRes.asmVoices}（= 游戏侧 voice 表 ${voiceClips.length} 条）；`
        + `AudioScheduler 默认 _maxPerFrame=${sRes.maxPerFrame}（= §3.12 冻结 AUDIO_MAX_PER_FRAME=${T.AUDIO_MAX_PER_FRAME}，App 未覆写）。`
        + `　【引擎契约（假 context 记账：gain/osc/bufferSource/buffer 创建计数）】构造期零节点=${sRes.ctorQuiet}；**解锁前** play(sfx_place)+play(bgm,loop) ⇒ contextReady=${sRes.preUnlock.ready}、activeLoops=${sRes.preUnlock.loops}、新建节点=${sRes.preUnlock.nodes}`
        + `（autoplay 语义：一次性丢弃、loop 记期望态）；**unlock() 后** ready=${sRes.postUnlock.ready}、补起的循环=[${sRes.postUnlock.loops}]、离线渲染 buffer=${sRes.postUnlock.buffers} 块。`
        + `　逐 clip 节点普查（loop 请求传该 clip 的 loopMs 条件）：${sRes.census.join(' ')}；建不出节点的 clip=[${sRes.zeroBuilt.join(',') || '空'}]（bgm_main 计 +0 是因已在 unlock 时补起，属幂等而非建不出）。`
        + `　【离线渲染分配面】census 跑完后累计 buffer=${sRes.buffersFinal} 块（≥ 2 ⇒ 至少含 8000ms BGM 循环块与噪声块）⇒ **惰性渲染**：噪声/多音块在首次播放该 clip 时才建（结构事实）。该「首次播放前的同步渲染开销」是否会造成帧抖 ⇒ **[B]/[R]**，本轮不宣称已验（audio-synth.ts 头注「分配面」自认一次性源不可复用）。`
        + `　**幂等（A05-22 的结构半边）**：bgm 已在播时再 play({loop:true}) ⇒ 该行增量仍计在普查内、activeLoops 恒 1（_loops 命中即 return，audio-synth.ts:415）。`
        + `　未登记 id：play("sfx_not_in_table") ⇒ 新增节点=${sRes.unreg.nodes}、host.warn 次数=${sRes.unreg.warns}（「${String(sRes.unreg.msg).slice(0, 46)}…」）⇒ 「框架不发明音色」。`
        + `　三总线增益=[${sRes.buses.gains}]（§3.12 AUDIO_BUS_GAIN_* 在代码里=${sRes.buses.gainTodo === undefined ? '未定义（[TODO] 状态）' : sRes.buses.gainTodo} ⇒ 引擎恒 1.0，不伪造 dB）。`
        + `　suspend→回前台：activeLoops ${sRes.suspendResume.afterSuspend} → ${sRes.suspendResume.afterResume}、**新建源 ${sRes.suspendResume.newSrcOnResume} 个**（⇒ 位置从循环起点重来，行为观察已登记进 A05-27 正文）；stop(bgm) 后 activeLoops=${sRes.afterStop}；SynthAudioBackend.usesExternalFiles()=${sRes.usesExt}。`
        + `　【夹具新鲜度自证（修订 34）】dist 编译产物=${sRes.fresh.dist}、被测源码最新 mtime=${sRes.fresh.srcNewest} ⇒ dist 不早于 src=${sRes.fresh.ok}。（本轮探针开跑前 dist 曾**早于** src 38 分钟，已用 \`pnpm run harness:build\` 重建，见报告 §12 与本 log 抬头。）`
        + `　**红线**：本条全部是「节点被按 contract 创建/复用」的结构记账，假 context 不会出声；因此它**不解除** A05-03/09/13/15/16/18/19/21/22/26 的任何 [B]/[P]/[R] 子句，只把「三平台仍全 NullAudioBackend」这条**旧 FAIL 前提**证伪。`);

}


// ═════════════════════════════════════════════════════════ P6 · GAP-06 泄压阀（A′+D）
{
    // 合法供料灌满 12 槽（不落子），验「满槽 ≠ 死局」
    const lvl = probeLevel(903, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 3) + 1));
    const h = mk({ levels: [lvl] });
    let fullAt = -1, deadEver = 0, invariantBroken = 0, samples = 0;
    for (let f = 0; f < 60 * 90 && fullAt < 0; f++) {
        h.frame();
        const s = h.game.snapshot;
        for (const sl of s.traySlots) {
            if (sl.state === 'free') continue;
            samples++;
            if (demandOf(s, sl.colorIdx) <= 0) deadEver++;
        }
        for (const c of patternColors(s)) { const heldN = s.traySlots.filter((x) => x.state !== 'free' && x.colorIdx === c).length; if (heldN > demandOf(s, c)) invariantBroken++; }
        if (h.hold() === T.TRAY_BASE_SLOTS) fullAt = f;
    }
    const full = h.hold();
    const sF = h.game.snapshot;
    const placeableNow = sF.traySlots.filter((x) => x.state !== 'free' && demandOf(sF, x.colorIdx) > 0).length;
    // 腾槽后 ≤1 间隔恢复供料（§8-4 + §2.4.6「满槽后必可恢复」）
    const before = h.count('tray:spawned'); const fullEv = h.count('tray:full');
    // 【T-151 · 判据时效性】v2.0 供料关停 ⇒ 托盘恒空（sel=-1）⇒ 腾槽半边不可构造：守卫防崩；
    // 整段「泄压阀/满槽/恢复」随供料复活而复活（同 P26/§J.1 体例，不把判据侧失效算成实现缺陷）。
    const spawnerAlive6 = full > 0;
    const sel = sF.traySlots.findIndex((x) => x.state !== 'free');
    const tgt = sel >= 0 ? firstEmptyOf(sF, sF.traySlots[sel].colorIdx) : -1;
    if (sel >= 0 && tgt >= 0) { h.game.tapDesign(...slotXY(sel)); h.frame(); h.game.tapDesign(...cellXY(h.game.snapshot, tgt)); }
    h.advance(2.0 + 0.05);
    const resumed = h.count('tray:spawned') - before;
    const decoysInLevels = LEVELS.reduce((n, l) => n + ((l.decoys ?? []).length), 0);
    const v = !spawnerAlive6
        ? '⛔（v2.0 供料关停 ⇒「合法供料灌满/腾槽恢复」不可构造；复活条件 = 供料复活。死局替代出口 = 重试恢复初始错位布置，判据面由 P28c 取证）'
        : (full === T.TRAY_BASE_SLOTS && deadEver === 0 && invariantBroken === 0 && placeableNow === full && resumed >= 1 ? 'PASS' : 'FAIL');
    rec('P6 / BD-06 · GAP-06 尾部软锁死（A′+D 后满槽是否仍为死局）', v,
        `注入 13×12 三色、spawnInterval=2.0s，**只用合法供料**（不用 giveTrayBead，修订 20）：第 ${fullAt} 帧（${(fullAt / 60).toFixed(1)}s）托盘达基线容量 ${full}/${T.TRAY_BASE_SLOTS}。`
        + `满槽瞬间可落子珠数=${placeableNow}/${full}（A′：每颗 held<demand ⇒ 全部可落子）。`
        + `全程 ${samples} 个「槽×帧」采样中 demand=0 的死珠数=${deadEver}，违反 held≤demand 的采样数=${invariantBroken}。`
        + `tray:full=${fullEv}（本条在满槽当帧即停采样，未再跨过下一个 2.0s 供料间隔 ⇒ **不据本条判去重语义**；§8-4「tray:full 恰 1、不重复」由 P12 独立取证）。腾出 1 槽后 ≤1 个间隔内 tray:spawned 增量=${resumed}（§8-4 后半 + §2.4.6 补「满槽后必可恢复」）。`
        + `D 侧：DECOY_COLORS_MAX=${T.DECOY_COLORS_MAX}（systems-index §3 v1.17），8 关 JSON decoys 合计=${decoysInLevels}。`
        + `　判据依据：ux-spec §8 U8 已拍板 A′+D（2026-09-14），§4 尾注条件式承诺随 A′ 收敛为无条件 ⇒ v1.0 的「≥1 条非整关重置出口」改为「合法供料路径下死局不可达」（tray-spawner §2.4.4：A′/D 治供料侧、出口表三行不变）。`
        + `　诚实边界：以 giveTrayBead 白盒强灌非需色珠仍可造死局，但那是**绕过供料不变量的夹具态**，非玩家可达态 ⇒ 不判缺陷。`);
}

// ═════════════════════════════════════════════════════════ P7 · 告急三通道 + 满槽告警
{
    const h = mk({ levels: [probeLevel(906, 6, 5, 180, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.advance(170.5);
    const urgent = h.game.snapshot.urgent, ev = h.count('timer:urgent');
    const digits = [], icons = [];
    for (let f = 0; f < 130; f++) {
        const cs = cmds(h);
        const t = cs.find((c) => c.kind === 'text' && /^\d\d:\d\d$/.test(c.text) && inBand(c, T.HUD_BAND));
        digits.push(t ? alphaOf(t.fill) : (cs.filter((c) => c.kind === 'text' && inBand(c, T.HUD_BAND))[0]?.alpha ?? 1));
        const ico = cs.filter((c) => c.kind === 'circle' && inBand(c, T.HUD_BAND));
        icons.push(ico.length ? `${hex2(ico[0].stroke)}@${alphaOf(ico[0].stroke)}` : '-');
        h.frame();
    }
    const digitAlphaUnused = null; void digitAlphaUnused;
    const pm = pulsePeriodMs(hudPulse(h, 130));
    const iconColors = [...new Set(icons.map((x) => x.split('@')[0]))];
    const iconAlphas = pulsePeriodMs(icons.map((x) => Number(x.split('@')[1] ?? 1)));
    // 【修订 40 · BD-10】同屏叠加取证：P7 主实例 `h` 本就是「满槽 + 告急」双主体同场
    // （6×5 = 30 格 demand 充裕、4.0s 供料 ⇒ 约 48s 自然灌满且不落子；170.5s 后进告急窗口），
    // 不再另开只量「签名种数」的第事实例（旧④以 uniq≤1 为 PASS* 条件 = 把缺失当预期）。
    const overlay = (() => {
        const seq = trayBreathSeq(h, 120);
        const clean = seq.filter((v) => !Number.isNaN(v));
        return {
            full: h.hold(), urgentNow: h.game.snapshot.urgent, phase: h.game.snapshot.phase,
            hasTrayFullEv: h.count('tray:full'), missing: seq.length - clean.length,
            pm: pulsePeriodMs(clean),
        };
    })();
    const trayHz = overlay.pm.periodMs ? 1000 / overlay.pm.periodMs : null;
    const hudHz = pm.periodMs ? 1000 / pm.periodMs : null;
    const compositeHz = trayHz !== null && hudHz !== null ? trayHz + hudHz : null;
    const okFull = overlay.missing === 0 && overlay.full === T.TRAY_BASE_SLOTS && overlay.urgentNow
        && overlay.pm.distinct >= 2 && overlay.pm.periodMs !== null
        && Math.abs(overlay.pm.periodMs - T.TRAY_FULL_PULSE_MS) <= 50;
    const okPulse = urgent && ev === 1 && pm.distinct >= 2 && pm.periodMs !== null
        && Math.abs(pm.periodMs - T.DANGER_PULSE_MS) <= 50;
    // 【修订 43 · WXG-T-118】**删除**旧「【BD-35 钉住上限】…强制 PASS*」注释与该分支 ——
    // BD-35 的升 PASS 前置（UX 侧在 `ux-spec §5` 告急行补 α 数值）**已由 WXG-T-117 满足**
    // （§5:187 = `α 0.6↔1.0`@1000ms；`:188` 满槽亦补 `α 0.6↔1.0`@500ms）。
    // 改为**幅度断言**（方向 = 收紧）：容差推导见头注修订 43② ——
    // 源波形三角波（`view-model.ts:409-413 breathe`），幅度斜率 (hi−lo)·2/T；采样步长
    // Δt = `GameLoop.fixedDt` = 1/60 s 固定 ⇒ 采样点与真极值最大相位偏差 = Δt/2
    // ⇒ **tol = (hi−lo)·Δt/T**（与相位起点无关的严格上界；**不反向调参**）。
    const ampTol = (lo, hi, periodMs) => (hi - lo) * (1000 / 60) / periodMs;
    const tolUrgent = ampTol(0.6, 1.0, T.DANGER_PULSE_MS);
    const tolFull = ampTol(0.6, 1.0, T.TRAY_FULL_PULSE_MS);
    /** 端点覆盖断言：`min ≈ lo` **且** `max ≈ hi`（两侧都断 ⇒ 欠幅/超幅均 FAIL）。 */
    const ampOk = (m, lo, hi, tol) => m.min !== null && m.max !== null
        && Math.abs(m.min - lo) <= tol && Math.abs(m.max - hi) <= tol;
    const okAmpUrgent = ampOk(pm, 0.6, 1.0, tolUrgent);
    const okAmpFull = ampOk(overlay.pm, 0.6, 1.0, tolFull);
    /** 证据串用：端点读数 / 端点偏差分别打到 6 位与 9 位（后者用于展示浮点量级，便于复核）。 */
    const f6 = (x) => (x === null || x === undefined ? '—' : Number(x).toFixed(6));
    const f9 = (x) => (x === null || x === undefined ? '—' : Number(x).toFixed(9));
    // 【T-151 · 判据时效性】④ 满槽半边在 v2.0 供料关停下不可构造（同 A05-14 体例）⇒ 拆分判定：
    // ①②③（告急三通道 + α 幅度）仍可测；④⑤（满槽呼吸 / 同屏叠加）随供料复活而复活。
    const fullAlive7 = overlay.full > 0 || overlay.hasTrayFullEv > 0;
    const v = !fullAlive7
        ? (okPulse && okAmpUrgent
            ? 'PASS*（①②③ 告急半边过；④⑤ 满槽半边因 v2.0 供料关停不可构造 ⛔，复活条件 = 供料复活）'
            : 'FAIL')
        : (okPulse && okFull && okAmpUrgent && okAmpFull ? 'PASS' : 'FAIL');
    rec('P7 (v1.7 改判) / BD-10 · BD-35 闭合 · GAP-10 告急三通道（色+图标+脉冲）与满槽告警', v,
        `① 事件层：降穿 TIMER_URGENT_T=${T.TIMER_URGENT_T}s → timer:urgent=${ev}（期望恰 1）、snapshot.urgent=${urgent}。`
        + `② 颜色通道：HUD 时钟图标描边色去重=[${iconColors.join(', ')}]（平时 ${hex2(DEFAULT_PALETTE.textDim)} → 告急 ${hex2(DEFAULT_PALETTE.danger)}）、数字 fill 切 danger。`
        + `③ 脉冲通道：图标 α 序列（130 帧剔 text）distinct=${iconAlphas.distinct} 档、周期=${iconAlphas.periodMs ? iconAlphas.periodMs.toFixed(0) : '—'}ms；数字/图标合成脉冲样本 distinct=${pm.distinct}、周期=${pm.periodMs ? pm.periodMs.toFixed(0) : '—'}ms（ux-spec §5 = ${T.DANGER_PULSE_MS}ms±50）⇒ 频率 ${(1000 / (pm.periodMs ?? 1)).toFixed(2)}Hz ≤3Hz 红线（**周期成立 = ${okPulse}**）。`
        + `　【**α 幅度 · 修订 43 新增**（判据 ux-spec §5:187 现文「danger + 1000ms **α 0.6↔1.0** 脉冲循环」；旧「BD-35 未定义幅度 ⇒ 强制 PASS\*」已删）】：`
        + `采样源 = HUD 时钟图标描边 α（view-model.ts:465/471-472：告急时 withAlpha(palette.danger, dangerAlpha(pulseClock, reduceMotion))；view-model.ts:421-423 dangerAlpha = reduce ? 1 : breathe(clock, DANGER_PULSE_MS, 0.6, 1)）；`
        + `样本数=${pm.n}、端点读数 **min=${f6(pm.min)} / max=${f6(pm.max)}**（期望 0.6 / 1.0）⇒ 端点偏差 = ${f9(pm.min === null ? null : Math.abs(pm.min - 0.6))} / ${f9(pm.max === null ? null : Math.abs(pm.max - 1.0))}；`
        + `**容差 tol = ${tolUrgent.toFixed(6)}**（推导：三角波半周期内 α 斜率 = (1.0−0.6)·2/1000ms；采样步长 Δt = 1/60 s ⇒ 最大相位偏差 Δt/2 ⇒ tol = (1.0−0.6)·(1/60 s)/(1000ms) = ${tolUrgent.toFixed(6)}）⇒ **覆盖 [0.6, 1.0] 两端点 = ${okAmpUrgent}**（判据 |min−0.6| ≤ tol **且** |max−1.0| ≤ tol）。`
        + `（结构旁证：1000ms = **恰 60 帧**、采样窗 130 帧 ≥2 周期 ⇒ 采样栅格覆盖全部相位点，故实测偏差只应来自浮点累加；**tol 未因此放宽**。）`
        + `④ 满槽告警视觉通道（ux-spec §5「托盘面板边缘 2px danger 描边呼吸 ${T.TRAY_FULL_PULSE_MS}ms」）：`
        + `主实例同场取证 —— 满槽 ${overlay.full}/${T.TRAY_BASE_SLOTS}、tray:full 广播=${overlay.hasTrayFullEv} 次（spawner.ts:_fullReported 去重锁 ⇒ 满槽期间**不重复广播**，正本 tray-spawner §8-4，故此处期望 1）、phase=${overlay.phase}、urgent=${overlay.urgentNow}；`
        + `120 帧逐帧取描边 α，取不到=${overlay.missing} 帧、${overlay.pm.distinct} 档、实测周期=${overlay.pm.periodMs ? overlay.pm.periodMs.toFixed(0) : '—'}ms（期望 ${T.TRAY_FULL_PULSE_MS}ms±50）⇒ 呼吸周期判定=${okFull ? 'PASS' : 'FAIL'}；`
        + `　【**α 幅度 · 修订 43 新增**（判据 ux-spec §5:188 现文「托盘描边呼吸 500ms 循环（**α 0.6↔1.0**，**2.0Hz** 往复）」——该腿此前**只验周期、未验幅度**）】：`
        + `采样源 = 满槽面板 danger 描边 α（view-model.ts:652-658 末尾 trayFullAlpha；view-model.ts:452-454 = breathe(clock, TRAY_FULL_PULSE_MS, 0.6, 1)）；`
        + `样本数=${overlay.pm.n}、端点读数 **min=${f6(overlay.pm.min)} / max=${f6(overlay.pm.max)}**（期望 0.6 / 1.0）⇒ 端点偏差 = ${f9(overlay.pm.min === null ? null : Math.abs(overlay.pm.min - 0.6))} / ${f9(overlay.pm.max === null ? null : Math.abs(overlay.pm.max - 1.0))}；`
        + `**容差 tol = ${tolFull.toFixed(6)}**（同法推导：三角波斜率 (1.0−0.6)·2/500ms；Δt/2 ⇒ tol = (1.0−0.6)·(1/60 s)/(500ms)）⇒ **覆盖 [0.6, 1.0] 两端点 = ${okAmpFull}**。（结构旁证：500ms = 恰 30 帧、采样窗 120 帧 = 4 整周期 ⇒ 栅格覆盖全部相位点。）`
        + `⑤ §8-10「满槽告警与告急脉冲同屏叠加无 >3Hz 闪烁」（两主体同场，本条已可测，不再 ⛔）：`
        + `按 ux-spec §5:174 口径正本「闪烁 = **同一区域内** α 的往复变化」分区读 —— 托盘带 ${trayHz ? trayHz.toFixed(2) : '—'}Hz、HUD 带 ${hudHz ? hudHz.toFixed(2) : '—'}Hz，两带不重叠（TRAY_BAND.yMax=${T.TRAY_BAND.yMax} < HUD_BAND.yMin=${T.HUD_BAND.yMin}）⇒ **分区各自 ≤3Hz 合规**；`
        + `跨区域合成读数=${compositeHz ? compositeHz.toFixed(2) : '—'}/s，**不属该红线口径**（该口径按区域定义），照实披露不据此判 FAIL、也不据此宣称「合成值在红线内」。`
        + `　⇒ **BD-10 的「满槽告警零通道」半边就此关闭**（告急三通道 ✅ + 满槽呼吸 ✅；A05-14 音/视解耦另见 P5）。代码锚点 view-model.ts drawTray 末尾（trayFullAlpha + palette.danger, lineWidth 2, radius 18）与 tuning.ts:TRAY_FULL_PULSE_MS。`
        + `　【**BD-35 闭合 → 强制 PASS\* 解除**（WXG-T-118）】：旧版本条卡点是 **BD-35「判据缺 α 幅度」**（ux-spec §5 告急行未给 α 起止值 ⇒ 「脉冲到不到 1.0」无判据可验）；**WXG-T-117 已在 §5:187 补 α 0.6↔1.0@1000ms、§5:188 补 α 0.6↔1.0@500ms** ⇒ 本轮把旧「钉住上限」注释与强制 PASS\* 分支**删除**，改为**可判定**的端点覆盖断言（上方 ③④ 两条），满足即记 **PASS**。`
        + `　判据清单（本轮，逐条可复核）：① 事件恰 1 = ${urgent && ev === 1}；② 颜色/图标通道（见上）；③ 告急 周期±50ms **且** α 覆盖 [0.6,1.0]；④ 满槽 周期±50ms **且** α 覆盖 [0.6,1.0]；⑤ 分区频率各自 ≤3Hz（跨区合成值另披露、不据此判）。⇒ **本条记 ${v}**（= ${okPulse} && ${okFull} && ${okAmpUrgent} && ${okAmpFull}）。`
        + `　限制声明（**效力边界，必须随结论一起读**）：本条全部在**指令流层**（RenderModel 指令 α 序列）可证，**真机观感**与「同屏不刺眼」「光敏性」的主观/像素判据仍属 **[B]/[R]/[P]（本轮均未执行）** ⇒ **不得据指令读数宣称「光敏性红线已达标」**，只能宣称「**指令流层已符合 §3.8 的时序口径**」。`);
}
/** 单独取 HUD 非文本脉冲 α 序列（避免与 ①②③ 混用样本）。
 * 【T-151 · 修探针缺陷】旧版用**固定 x = DESIGN_W/2−96** 筛选时钟圆 ⇒ 未命中任何图元（缺省 push 1）
 * ⇒ α 序列恒 1.0、幅度断言假 FAIL（同帧 icons 序列实测 31 档 α 即反证）。改用与 ② 颜色通道
 * 同源的筛选（HUD_BAND 内首个 circle），两采样源归一。 */
function hudPulse(h, n) {
    const saved = h.game.snapshot; void saved;
    const seq = [];
    for (let f = 0; f < n; f++) {
        const cs = cmds(h);
        const c = cs.filter((k) => k.kind === 'circle' && inBand(k, T.HUD_BAND))[0];
        seq.push(c ? alphaOf(c.stroke) : 1);
        h.frame();
    }
    return seq;
}

// ═════════════════════════════════════════════════════════ P8 · 五类路由
{
    const h1 = mk(); h1.game.tapDesign(...GEAR_XY); h1.frame();
    const gearOk = h1.count('game:paused') === 1 && h1.game.snapshot.phase === 'paused';
    const h2 = mk(); h2.game.giveTrayBead(1); h2.game.giveTrayBead(2); h2.frame();
    h2.game.tapDesign(...CARD_XY(1)); h2.frame();
    const cardOk = h2.count('powerup:used') === 1;
    const h3 = mk(); h3.frame();
    // BD-37（WXG-T-097/BD-15）：§8-1 字面要求「点扩展→S4 收请求」（tray:expanded），
    // 但 `powerups §2.6` 布局 A + `ux-spec §4` 写定 MVP 无解锁路径 ⇒ 该出口**不可验**。
    // 分两腿量：① 可点入口是否存在（命中即吞 + anchor==='expand' 轻提示）；
    //         ② S4 出口 tray:expanded（若日后解锁路径上线，本腿转 ✓）。
    let expandHit = 0;
    let expandEntry = 0;
    let expandHintText = '';
    outerExpand:
    for (let y = T.TRAY_BAND.yMin - 80; y <= T.TRAY_BAND.yMax + 8; y += 6) {
        for (let x = 0; x <= T.DESIGN_W; x += 6) {
            const before = h3.count('tray:expanded');
            const consumed = h3.game.tapDesign(x, y);
            const sn = h3.game.snapshot;
            if (h3.count('tray:expanded') > before) expandHit++;
            if (consumed && sn.tapHintAnchor === 'expand' && sn.tapHintText) {
                expandEntry++;
                expandHintText = sn.tapHintText;
            }
            if (expandHit > 0 || expandEntry > 0) break outerExpand;
        }
    }
    const h4 = mk(); h4.frame(); const i4 = (primePlaceable(h4) || { slot: -1 }).slot; /* T-151 v2.0 前置 */
    h4.game.tapDesign(...slotXY(i4)); h4.frame();
    const selOk = h4.count('tray:selected') === 1;
    const h5 = mk(); h5.frame(); const i5 = (primePlaceable(h5) || { slot: -1 }).slot; /* T-151 v2.0 前置 */
    h5.game.tapDesign(...slotXY(i5)); h5.frame();
    const t5 = firstEmptyOf(h5.game.snapshot, h5.game.snapshot.traySlots[i5].colorIdx);
    h5.game.tapDesign(...cellXY(h5.game.snapshot, t5)); h5.frame();
    const placeOk = h5.count('bead:placed') === 1 && h5.count('bead:rejected') === 0;
    const fourOk = [gearOk, cardOk, selOk, placeOk].every(Boolean);
    const v = fourOk && expandHit > 0 ? 'PASS' : fourOk && expandEntry > 0 ? 'PASS*' : 'FAIL';
    rec('P8【旁路口径 tapDesign】 / BD-15 · TC-INP-01 · S2 §8-1 五类路由', v,
        `① 齿轮→game:paused=${h1.count('game:paused')}(phase=${h1.game.snapshot.phase}) ${gearOk ? '✓' : '✗'}；② 道具卡→powerup:used=${h2.count('powerup:used')} ${cardOk ? '✓' : '✗'}；`
        + `③ 扩展→**入口已存**=${expandEntry > 0}（命中即吞 + 占位轻提示「${expandHintText}」、anchor=expand）、S4 出口 tray:expanded=${expandHit}；④ 托盘珠→tray:selected=${h4.count('tray:selected')} ${selOk ? '✓' : '✗'}；`
        + `⑤ 空格(有选中)→bead:placed=${h5.count('bead:placed')}/rejected=${h5.count('bead:rejected')} ${placeOk ? '✓' : '✗'}。`
        + `　BD-15 已于 WXG-T-097 关单（btn_expand 渲染 + 132×88 热区 + 路由优先级 3 已入 src）；但其 S4 出口按 powerups §2.6 布局 A 本轮不可达 ⇒ 「点扩展→S4 收请求」记 **⛔ 不可验（BD-37）**，不得因占位实装而打 PASS。整条按 4/5 可验且通过定 **PASS\***，待解锁路径上线转 PASS。`
        + `　【口径标注（WXG-T-114）】本条为**旁路口径**（` + '`game.tapDesign()`' + ` 直调 ` + '`_handleTap`' + `，绕开 ` + '`InputManager`' + `）⇒ 五类路由恒绿；**真链对照见 P8R**（经 ` + '`input.beginFrame/push/update/endFrame`' + `）。两口径并列呈报。`);
}

// ═════════════════════════════════════════════════════════ P9 · 热区（§8-2 回写后）
{
    // 【T-151 · v2.0 适配】§8-4 热区需要「两个相邻空格」：v2.0 开局全满 ⇒ 定制 swaps=[[0,1,0,2]]
    // （(0,1)↔(0,2) 一对错位、相邻且异色，恒等式 misplaced=2=1 对+1 环 ✓），真链取回两颗 ⇒ 空格 1、2 相邻。
    const lvP9 = { ...probeLevel(908, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1)), swaps: [[0, 1, 0, 2]], cycleProfile: 'short' };
    const h0 = mk({ levels: [lvP9] }); h0.frame();
    retrieveOneMisplaced(h0); retrieveOneMisplaced(h0);   // 两步式取回两颗错位珠（真链）
    const s = h0.game.snapshot;
    const target = (() => { for (let i = 0; i < s.cells.length; i++) { const c = s.cells[i]; if (!c.void && c.state === 'empty' && c.colorIdx > 0 && (i % s.gridCols) + 1 < s.gridCols && !s.cells[i + 1].void && s.cells[i + 1].state === 'empty') return i; } return -1; })();
    if (target < 0) throw new Error('P9 v2.0 前置失败：未能构造相邻空格对');
    const [cx, cy] = cellXY(s, target);
    // 【修订 15b + 26】旧版忘了先选珠（⇒ 全 none 假 FAIL）；修后仍假 FAIL，因为**多次命中同一格**：
    //   第一次落子后该格已填（后续变 danger/locked）且托盘被 fixture 珠灌满 ⇒ giveTrayBead 返回 -1。
    //   本轮改为**每次偏移测量用一个干净实例**（同一行主序目标格、同一几何），一次一事。
    const probe = (dx) => {
        const hi = mk({ levels: [lvP9] }); hi.frame();
        retrieveOneMisplaced(hi); retrieveOneMisplaced(hi);   // 每个干净实例重建相邻空格前置
        const si = hi.game.snapshot;
        const targetNow = (() => { for (let i = 0; i < si.cells.length; i++) { const c = si.cells[i]; if (!c.void && c.state === 'empty' && c.colorIdx > 0 && (i % si.gridCols) + 1 < si.gridCols && !si.cells[i + 1].void && si.cells[i + 1].state === 'empty') return i; } return -1; })();
        if (targetNow !== target) return 'no-empty-pair';
        const sl = hi.game.giveTrayBead(si.cells[target].colorIdx);
        if (sl < 0) return 'no-free-slot';
        hi.game.selectTraySlot(sl); hi.frame();
        hi.reset();
        hi.game.tapDesign(cx + dx, cy); hi.frame();
        const p = hi.last('bead:placed') ?? hi.last('bead:rejected');
        return p ? `r${p.row}c${p.col}` : (hi.emitted.length ? 'other' : 'none');
    };
    const own = [0, 12, 25].map(probe), tie = probe(T.BEAD_PITCH / 2), mid = [27, 32, 33].map(probe), far = [40, 51, 52].map(probe);
    const outside = probe(-(T.BEAD_PITCH * (target % s.gridCols) + T.BEAD_CELL / 2 + 20));
    const col = target % s.gridCols;
    const cell = (cIdx) => `r${Math.floor(target / s.gridCols)}c${cIdx}`;
    const ownOk = own.every((x) => x === cell(col));
    // dx = BEAD_PITCH/2 = 26 是**两格等距并列点**，§8-4「最近格心」在此无定义（测不到偏左/偏右均为合规）；
    // 本轮只记录实际归属，不据此判 FAIL（早期版本要 26 必须算右格 ⇒ 假 FAIL）。
    const tieOk = tie === cell(col) || tie === cell(col + 1);
    const midOk = mid.every((x) => x === cell(col + 1));
    const farOk = far.every((x) => x === cell(col + 1));
    const v = ownOk && tieOk && midOk && farOk && outside === 'none' ? 'PASS' : 'FAIL';
    rec('P9 / BD-23(已裁定) · TC-INP-02·04 · S2 §8-2 热区 + §8-4 最近格心', v,
        `目标格 r${Math.floor(target / s.gridCols)}c${col}，格心=(${cx.toFixed(1)},${cy.toFixed(1)})；BEAD_CELL=${T.BEAD_CELL}、GRID_HIT_SIZE=${T.GRID_HIT_SIZE}（半宽 ${T.GRID_HIT_SIZE / 2}）、BEAD_PITCH=${T.BEAD_PITCH}（最近格心翻转点 ${T.BEAD_PITCH / 2}）。`
        + `偏移 0/12/25 →[${own.join(' ')}]（${ownOk ? '全命中本格 ✓' : '✗'}）；等距并列点 dx=${T.BEAD_PITCH / 2} →${tie}（§8-4 无定义，实测归${tie === cell(col) ? '左（本格）' : '右（邻格）'}，不据此判否）；`
        + `偏移 27/32/33（重叠区且 strictly 靠近邻格）→[${mid.join(' ')}]；偏移 40/51/52 →[${far.join(' ')}]；网格外 -20px →${outside}（期望 none ✓）。`
        + `　§8-2 现文（WXG-T-091 回写）：「因 BEAD_PITCH < 命中区，网格内部外扩区必然重叠，此时**一律以 §4 最近格心裁决**；本条『偏移 ≤ 外扩边界内必命中本格』只在无重叠区成立；网格内部不存在带间隙处，零事件仅在网格外围验证」`
        + `⇒ 实测与回写后判据**逐条一致**，v1.0 的 PASS*（判据互斥）取消，改判 **PASS**；BD-23 关闭。`);
}

// ═════════════════════════════════════════════════════════ P10 · 无选中点网格
// 修订 25：本条改用**配对差分**（同 seed 两实例，同一帧号下「点 vs 不点」比签名）。
// 旧写法「点击前一帧 vs 点击后一帧」会把 hint 呼吸 / 首珠脉冲的**常态动画**当成反馈 ⇒ 恒不等 = 假 PASS。
{
    const runP10 = (tap) => {
        const h = mk({ seed: 'p10-diff' });
        h.frame();
        // 【T-151 · v2.0 适配】§8-7 前提 = 「无托盘选中 + 存在可落空格」：v2.0 开局全满 ⇒ 取回一颗
        // 错位珠构造空格（取回后 board 锚失效、且实现侧 retrieveBead 不置 tray 选中 ⇒ 满足「无选中」）。
        retrieveOneMisplaced(h);
        const s = h.game.snapshot;
        const i = findEmpty(s);
        const [x, y] = cellXY(s, i);
        if (tap) h.game.tapDesign(x, y);
        h.frame();
        const sn = h.game.snapshot;
        const cs = cmds(h);
        return {
            h, i, x, y, sig: sig(cs),
            // BD-16（WXG-T-097）的轻提示走 **text** 通道，而 `sig` 刻意剔除 text
            //（修订 7/17：防 mm:ss 伪满足）⇒ 另取一条**文本签名**同法配对差分。
            // 两实例同 seed、同帧号 ⇒ 倒计时文本两侧相同，不构成假差异。
            textSig: cs.filter((c) => c.kind === 'text')
                .map((c) => `${Math.round(c.x)}_${Math.round(c.y)}:${c.text}`).join('|'),
            hintTexts: cs.filter((c) => c.kind === 'text' && c.text === sn.tapHintText && sn.tapHintText).length,
            hints: { powerupHint: sn.powerupHint, failHint: sn.failHint, banner: sn.banner, subBanner: sn.subBanner },
            hint: { text: sn.tapHintText, anchor: sn.tapHintAnchor, row: sn.tapHintRow, col: sn.tapHintCol },
            cols: s.gridCols,
            placed: h.count('bead:placed'), rejected: h.count('bead:rejected'), selected: h.count('tray:selected'),
        };
    };
    const ctl = runP10(false), tst = runP10(true);
    const diff = ctl.sig !== tst.sig;
    const textDiff = ctl.textSig !== tst.textSig;
    const hintOn = Boolean(tst.hint.text) || Object.values(tst.hints).some(Boolean);
    const anchored = tst.hint.anchor === 'cell'
        && tst.hint.row === Math.floor(tst.i / tst.cols) && tst.hint.col === tst.i % tst.cols;
    const v = tst.placed === 0 && tst.rejected === 0 && tst.selected === 0 && hintOn && anchored && textDiff
        ? 'PASS' : 'FAIL';
    rec('P10【旁路口径 tapDesign】 / BD-16 · TC-INP-07 · S2 §8-7 无选中点网格 → 零请求 + 轻提示', v,
        `零请求 ✓：bead:placed=${tst.placed}、bead:rejected=${tst.rejected}、tray:selected=${tst.selected}（期望 0/0/0），点击点=空格 (i${tst.i}, ${tst.x.toFixed(1)},${tst.y.toFixed(1)})。`
        + `轻提示 ✓（新通道）：tapHintText=「${tst.hint.text}」anchor=${tst.hint.anchor} 锚点=(${tst.hint.row},${tst.hint.col}) 与被点格一致=${anchored}；渲染指令里同文本图元数=${tst.hintTexts}；旧字段 powerupHint/failHint/banner/subBanner 均空（本行为不占那些通道）。`
        + `配对差分（同 seed、同帧号，ctl 不点 / tst 点）：非文本签名差异=${diff}（轻提示不改图元形状，属预期）；**文本签名差异=${textDiff}**（反馈帧的实际载体）。`
        + `　BD-16 已于 WXG-T-097 关单：` + `无选中点可落空格时走一次性轻提示通道（ux-spec §5 / input-control §8-7，静默、≤400ms）；锁定格/已填格走 §8-5「**零事件 + 极轻非惩罚反馈**」（WXG-T-128 修订 44：原判据「零反馈帧」已由用户 2026-09-16 裁定推翻 ⇒ 不得再把 G7 轻压判成缺陷；事件计数 =0 仍是不可放宽的红线）。`
        + `　【探针自查】本条早期版本只看旧字段与非文本签名 ⇒ BD-16 已落地仍报 FAIL（**假 FAIL**）；轻提示这类以文字为载体的反馈必须同时差分 text 通道。`
        + `　【口径标注（WXG-T-114）】本条为**旁路口径**（` + '`game.tapDesign()`' + `，绕开 ` + '`InputManager`' + `）；**真链对照见 P10R**。`);
}

// ═════════════════════════════════════════════════════════ P11 · §8-6/8/10（真实 InputManager）
{
    const h1 = mk(); h1.frame();
    const s1 = h1.game.snapshot; const p11 = primePlaceable(h1); const [sx, sy] = slotXY(p11 ? p11.slot : 0);
    h1.tapScreen(sx, sy); h1.frame(); h1.tapScreen(sx, sy); h1.frame();
    const dbl = h1.count('tray:selected');
    const h2 = mk(); h2.frame();
    const a = (primePlaceable(h2) || { slot: -1 }).slot; /* T-151 v2.0 前置 */
    h2.game.giveTrayBead(h2.game.snapshot.cells.find((c) => !c.void && c.colorIdx > 0).colorIdx); h2.frame();
    h2.tapScreen(...slotXY(a)); h2.frame(); h2.tapScreen(...slotXY(a === 0 ? 1 : 0)); h2.frame();
    const swap = h2.count('tray:selected'), selFinal = h2.game.snapshot.traySelected;
    const h3 = mk(); h3.game.tapDesign(...GEAR_XY); h3.frame();
    const s3 = h3.game.snapshot; const before3 = h3.emitted.length;
    h3.tapScreen(...slotXY(0)); h3.frame(); h3.game.tapDesign(...cellXY(s3, findEmpty(s3))); h3.frame(); h3.game.tapDesign(...CARD_XY(0)); h3.frame();
    const pausedEvents = h3.emitted.length - before3, phase3 = h3.game.snapshot.phase;
    const h4 = mk(); h4.frame();
    // 【T-151 · v2.0 适配】primePlaceable 前置（取回错位珠 ⇒ 托盘有珠 + 有可落格）
    const p411 = primePlaceable(h4);
    const s4 = h4.game.snapshot; const i4 = p411 ? p411.slot : -1;
    if (i4 >= 0) h4.tapScreen(...slotXY(i4)); h4.frame();
    const [gx, gy] = i4 >= 0 ? cellXY(h4.game.snapshot, firstEmptyOf(h4.game.snapshot, h4.game.snapshot.traySlots[i4].colorIdx)) : [0, 0];
    h4.reset(); h4.tapMany(gx, gy, 20);
    const flood = { placed: h4.count('bead:placed'), rejected: h4.count('bead:rejected'), phase: h4.game.snapshot.phase };
    const mt = mk(); mt.frame();
    const pmt = primePlaceable(mt); const sm = mt.game.snapshot; const [m1x, m1y] = slotXY(pmt ? pmt.slot : 0);
    const ms1 = mt.services.viewport.designToScreen({ x: 0, y: 0 }, m1x, m1y);
    // §8-9 双指同帧：两个 id 同帧 down（均为屏幕 CSS px），仅首触点（owner）生效
    mt.input.beginFrame();
    mt.input.push({ id: 7, x: ms1.x, y: ms1.y, phase: 'down', time: 1 });
    const [ox, oy] = cellXY(sm, findEmpty(sm));
    const op = { x: 0, y: 0 }; mt.services.viewport.designToScreen(op, ox, oy);
    mt.input.push({ id: 9, x: op.x, y: op.y, phase: 'down', time: 2 });
    mt.game.update(1 / 60); mt.input.endFrame(1 / 60);
    const multi = {
        selected: mt.count('tray:selected'), placed: mt.count('bead:placed'),
        // 【修订 15c】routed 只计**输入路由产物**（不能把 tray:spawned 等无关事件计入，否则假 FAIL）
        routed: mt.count('tray:selected') + mt.count('bead:placed') + mt.count('bead:rejected'),
    };
    const v = (dbl === 1 && pausedEvents === 0 && phase3 === 'paused' && flood.placed === 1 && flood.rejected === 0 && multi.routed <= 1) ? 'PASS' : 'PASS*';
    rec('P11 / TC-INP-06·08·09·10 · S2 §8-6/§8-8/§8-9/§8-10（真实 InputManager 链路）', v,
        `§8-6 双击同槽（真实 InputManager + screenToDesign）tray:selected=${dbl}（期望 1）；换选 tray:selected=${swap}、最终 traySelected=${selFinal}。`
        + `§8-8 PAUSED 下点托盘/网格/道具 ⇒ 事件增量=${pausedEvents}（期望 0）、相位=${phase3}。`
        + `§8-10 同帧注入 20 条 down ⇒ bead:placed=${flood.placed}（期望 1）、rejected=${flood.rejected}、相位=${flood.phase}，无崩溃。`
        + `§8-9 双指同帧（id 7 与 id 9，两个不同设计点）⇒ 路由事件数=${multi.routed}（期望 ≤1；InputManager owner-lock：次触点被忽略，input-manager.ts:95）。`
        + `　v1.0 的 PASS* 理由（「tapDesign 绕过 InputManager，不能证明真实一帧 20 touch 只路由 1 条」）本轮由**改走 app.input 同款 push 序列**消除 ⇒ 建议升 **PASS**；`
        + `　真机触摸事件序 / OS 层多点行为仍属「[Device]」⛔（不作证据）。`);
}

// ═════════════════════════════════════════════════════════ P12 · §8-2 卡方 / §8-4 / §8-5
{
    const lvl = probeLevel(908, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 4) + 1));
    const h = mk({ levels: [lvl], seed: 'chi' });
    const slots = new Array(T.TRAY_BASE_SLOTS).fill(0);
    // 【修订 15d】旧版游标错（slice(got) 把事件数当 emitted 下标）且**不排水**：
    //   自然累积下托盘 12/12 就满了（实跑 n=12，只能靠 autoFrame 偶发腾槽）⇒ 样本被“空闲槽集变化”污染，
    //   χ² 被伪做到 760。本轮沿用 v3 修订 3 的**白盒排水夹具**（每帧清空持有槽 ⇒ 12 槽全空闲），
    //   它只隔离「落槽随机性」这一个变量，不改变 _pickFreeSlot 的真实代码路径（spawner.ts:176-186）。
    let cursor = 0, got = 0, framesS = 0;
    for (let f = 0; f < 60 * 4000 && got < 200; f++) {
        // 【T-151】v2.0 供料关停 ⇒ 零供 ⇒ 5s 仍零供即提前退出（防 24 万帧空转）
        if (f > 60 * 300 && got === 0) break;
        h.frame(); framesS++;
        for (; cursor < h.emitted.length; cursor++) {
            const e = h.emitted[cursor];
            if (e.type !== 'tray:spawned') continue;
            slots[e.p.slot] = (slots[e.p.slot] ?? 0) + 1; got++;
            if (got >= 200) break;
        }
        h.drain();
    }
    const spawnerAlive12 = got >= 200;
    const exp = 200 / T.TRAY_BASE_SLOTS;
    const x2 = spawnerAlive12 ? chi2(slots, exp) : NaN;
    const maxDev = Math.max(...slots.map((v) => Math.abs(v - exp) / exp)) * 100;
    // §8-4 满槽跳过 + 恢复（合法供料）—— v2.0 供料关停下不可构造：守卫防崩（同 P6）
    const h2 = mk({ levels: [probeLevel(909, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 3) + 1))], seed: 'full' });
    for (let f = 0; f < 60 * 40 && h2.hold() < T.TRAY_BASE_SLOTS; f++) h2.frame();
    const beforeF = h2.count('tray:spawned'); h2.advance(2.0 * 3);
    const fullEv = h2.count('tray:full'), spawnDuring = h2.count('tray:spawned') - beforeF;
    const sF = h2.game.snapshot; const sel = sF.traySlots.findIndex((x) => x.state !== 'free');
    if (sel >= 0) { h2.game.tapDesign(...slotXY(sel)); h2.frame(); h2.game.tapDesign(...cellXY(sF, firstEmptyOf(sF, sF.traySlots[sel].colorIdx))); }
    h2.advance(2.05); const resumed = h2.count('tray:spawned');
    const h3 = mk(); const cap0 = h3.game.snapshot.traySlots.length; const ex = h3.game.expandTray();
    const v = !spawnerAlive12
        ? '⛔（v2.0 供料关停 ⇒「200 次供料均匀性 / 满槽跳过恢复」不可构造；复活条件 = 供料复活）'
        : (x2 < CRIT_DF11_A005 && fullEv === 1 && spawnDuring === 0 && resumed >= 1 && ex && cap0 + T.TRAY_EXPAND_SLOTS === h3.game.snapshot.traySlots.length ? 'PASS' : 'FAIL');
    rec('P12 / BD-22(已裁定) · TC-TRAY-02·04·05 · S4 §8-2/§8-4/§8-5', v,
        `§8-2 现文（WXG-T-091）：200 次供料落槽频次做**卡方拟合优度，α=0.05 不拒绝均匀**（旧 ±20% 弃用）。白盒排水夹具下 ${framesS} 帧采到 ${got} 样本，频次=[${slots.join(',')}]，期望 ${exp.toFixed(2)}/槽 ⇒ χ²=${x2.toFixed(2)}（df=${T.TRAY_BASE_SLOTS - 1}，α=0.05 临界 ${CRIT_DF11_A005}${x2 < CRIT_DF11_A005 ? ' ⇒ 不拒绝 ✓' : ' ⇒ 拒绝均匀 ✗'}）；`
        + `对照旧口径最大偏差 ${maxDev.toFixed(1)}%（若仍按 ±20% 会误报，即 BD-22 的误报本征）。`
        + `§8-4：满槽 → tray:full=${fullEv}（期望 1、不重复）、满槽期 3 间隔 tray:spawned 增量=${spawnDuring}（期望 0）✓；腾 1 槽后 ≤1 间隔恢复=${resumed >= 1 ? '✓' : '✗'}。`
        + `§8-5：${cap0} 槽 → expandTray()=${ex} → ${h3.game.snapshot.traySlots.length} 槽（期望 ${T.TRAY_BASE_SLOTS + T.TRAY_EXPAND_SLOTS}）✓（入口自 WXG-T-097/BD-15 已存，但按布局 A 不发 tray:expanded ⇒ 玩家路径仍不可达，见 P8/BD-37）。`);
}

// ═════════════════════════════════════════════════════════ P13 · harness 坐标链路
{
    const { app, game } = boot;
    const vp = app.viewport;
    const rt = (dw, dh, pts) => {
        vp.resize(dw, dh);
        const o = { x: 0, y: 0 }, b = { x: 0, y: 0 };
        let maxErr = 0;
        for (const [x, y] of pts) { vp.designToScreen(o, x, y); vp.screenToDesign(b, o.x, o.y); maxErr = Math.max(maxErr, Math.abs(b.x - x), Math.abs(b.y - y)); }
        return maxErr;
    };
    const pts = [[0, 0], [375, 667], [297, 904], [63, 1086], [687, 514], [750, 1334]];
    const e1 = rt(750, 1334, pts), e2 = rt(390, 844, pts), e3 = rt(412, 915, pts);
    vp.resize(750, 1334);
    // DPR 无关性：把同一点的 device-px 值（×2）喂进来 ⇒ 必须落到完全不同的设计点（坐标空间可区分）
    const devReject = (() => {
        const o = { x: 0, y: 0 }; vp.designToScreen(o, 297, 904);
        const back = vp.screenToDesign({ x: 0, y: 0 }, o.x * 2, o.y * 2);
        return Math.hypot(back.x - 297, back.y - 904);
    })();
    // 端到端：真实 harness input（CSS px）→ screenToDesign → 命中预期槽
    game.goToLevel(0); boot.render(3);
    const s = game.snapshot;
    // 【T-151 · v2.0 适配】供料关停 ⇒ 托盘恒空 ⇒ 槽点击无珠可选（实测 traySelected=-1）。
    // 用白盒合法装配造出「槽 0 有珠」前置（选中错位珠 → 取回入槽 0），端到端判据主体（真链点击）不变。
    const mi13 = (() => { for (let i = 0; i < s.cells.length; i++) { const c = s.cells[i]; if (!c.void && c.state === 'filled' && c.beadColorIdx > 0 && c.beadColorIdx !== c.colorIdx) return i; } return -1; })();
    if (mi13 >= 0) {
        game.tapDesign(...cellXY(s, mi13));
        game.tapDesign(...slotXY(0));
        boot.render(1);
    }
    const s13 = game.snapshot;
    const idx0 = s13.traySlots.findIndex((x) => x.state !== 'free');
    const idx = idx0 >= 0 ? idx0 : 0;
    const [dx, dy] = slotXY(idx);
    const sc = { x: 0, y: 0 }; app.viewport.designToScreen(sc, dx, dy);
    app.events.on('tray:selected', () => { });
    let selectedSeen = -1; app.events.on('tray:selected', (p) => { selectedSeen = p?.slot ?? 'ev'; });
    app.input.push({ id: 1, x: sc.x, y: sc.y, phase: 'down', time: 10 }); boot.render(1); app.input.push({ id: 1, x: sc.x, y: sc.y, phase: 'up', time: 11 }); boot.render(1);
    const got = selectedSeen >= 0 ? selectedSeen : game.snapshot.traySelected;
    // DPR 无关性：device-px 样本喂进去必须打不中（回归钉）
    let devSel = null; app.input.push({ id: 2, x: sc.x * 2, y: sc.y * 2, phase: 'down', time: 20 });
    const before = game.snapshot.traySelected; boot.render(1); devSel = game.snapshot.traySelected === before ? 'unchanged' : 'changed';
    const v = e1 < 1e-9 && e2 < 1e-9 && e3 < 1e-9 && devReject > 50 && got === idx ? 'PASS' : 'FAIL';
    rec('P13 / BD-07 · GAP-07 harness DPR/视口坐标链路', v,
        `① 双向往返 max 误差：CSS 750×1334 = ${e1.toExponential(1)}；390×844（非设计长宽比、含 letterbox offset）= ${e2.toExponential(1)}；412×915 = ${e3.toExponential(1)}（期望 <1e-9）。`
        + `② 把设计点 (297,904) 的 **device-px（×2）**当屏幕坐标喂 screenToDesign ⇒ 落点偏离 ${(devReject ?? 0).toFixed(1)}px（期望 >50px，即坐标空间可区分、不致错位命中）。`
        + `③ **端到端**：以 CSS px (${sc.x.toFixed(1)},${sc.y.toFixed(1)}) 经真实 app.input.push(down/up) + app.tick → 期望命中槽 ${idx}，实测 traySelected=${got} ⇒ ${got === idx ? '一致 ✓' : '不一致 ✗'}。`
        + `④ 反向回归钉：把同一点的 device-px 值（×2）喂 input ⇒ 选中态 ${devSel}（期望 unchanged，即 GAP-07 不得复发）。`
        + `　代码锚点：dev/harness/main.ts:90-102 pushPointer 送 clientX/clientY（去掉 ×dpr）+ :69-81 app.resize(cssW,cssH)；canvas2d-renderer pixelRatio 吸收 DPR（0e673d1 / ADR-0011 方案 B）。`
        + `　【探针自我修正】v1.0 P13 以「screenToDesign(297,904)→(297,430) = y 轴折叠」为缺陷征候，属**误读**（设计系 y 向上，翻转正确）；真根因是 pushPointer ×dpr。登记为探针自身缺陷 #14（修订 18）。`);
}

// ═════════════════════════════════════════════════════════ P14 · L6–L8 可达性
{
    const { game } = boot;
    const info = [];
    for (const n of [5, 6, 7]) { game.goToLevel(n); boot.render(2); const s = game.snapshot; info.push(`L${n + 1}(id=${s.levelId}) ${s.gridCols}×${s.gridRows} empty=${s.cells.filter((c) => !c.void && c.state === 'empty').length} locked=${s.cells.filter((c) => !c.void && c.state === 'locked').length} 色数=${patternColors(s).size} phase=${s.phase}`); }
    game.goToLevel(0); boot.render(2);
    const rec14 = mk();
    const n = LEVELS.length;
    const v = info.every((x) => x.includes('phase=playing')) ? 'PASS*' : 'FAIL';
    rec('P14 / BD-13 · GAP-13 L6–L8 取证通路', v,
        `关卡表 ${n} 关；harness（真实编译产物路径，非 Node 直装）goToLevel(5/6/7) 均可进 PLAYING：${info.join('；')}。`
        + `⇒ v1.0 的「harness 只暴露 L1–L5」已不成立（main.ts 以 game.levelCount 驱动），L6 锁定格 / L7·L8 8 色满配的「[Harness]」路径**结构上可达**。`
        + `仍缺（⇒ 维持 PASS*，不升 PASS）：`
        + `①「preview:frames」（tools/scripts/render-harness-frame.mjs）仍硬编码 breakout API（:56 game.movePaddleTo、:77 bricksDestroyed、无 --game 透传）⇒ beads 无帧预览（**BD-19 未修**）；`
        + `② 沙箱禁监听 socket + 无浏览器截图通路 ⇒ 由 harness 产**像素**（色盲模拟/灰度/逐帧截图）仍 ⛔。`);
}

// ═════════════════════════════════════════════════════════ P15 · 13×12 极端定位
{
    const big = probeLevel(910, T.GRID_MAX_COLS, T.GRID_MAX_ROWS, 420, 4.0, (i, j) => String(((i * T.GRID_MAX_COLS + j) % T.BEAD_COLOR_MAX) + 1));
    const h = mk({ levels: [big] });
    const s = h.game.snapshot;
    const pick = [[0, 0], [0, T.GRID_MAX_COLS - 1], [T.GRID_MAX_ROWS - 1, 0], [T.GRID_MAX_ROWS - 1, T.GRID_MAX_COLS - 1], [6, 6]];
    const cs = cmds(h);
    const measured = [];
    for (const [r, c] of pick) {
        const idx = r * s.gridCols + c;
        const [fx, fy] = cellXY(s, idx);
        const rect = cs.find((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && Math.abs(k.x + k.w / 2 - fx) < 1.5 && Math.abs(k.y + k.h / 2 - fy) < 1.5);
        measured.push({ r, c, formula: [fx, fy], rendered: rect ? [Number((rect.x + rect.w / 2).toFixed(2)), Number((rect.y + rect.h / 2).toFixed(2))] : null });
    }
    const err = Math.max(...measured.filter((m) => m.rendered).map((m) => Math.max(Math.abs(m.rendered[0] - m.formula[0]), Math.abs(m.rendered[1] - m.formula[1]))));
    const cs2 = { left: s.gridLeft, top: s.gridTop, bottom: s.gridTop - (s.gridRows - 1) * T.BEAD_PITCH };
    const v = measured.every((m) => m.rendered) && err <= 0.5 && cs2.left >= 30 && cs2.top <= 1120 && cs2.bottom >= 480 ? 'PASS' : 'PASS*';
    rec('P15 / TC-GRID-08 · S3 §8-8 13×12 极端定位', v,
        `156 格装载成功（cells=${s.cells.length}）；五格中心 [${measured.map((m) => `(${m.r},${m.c}) 公式=${m.formula.map((x) => x.toFixed(1))} 渲染=${m.rendered ? m.rendered.map((x) => x.toFixed(1)) : 'null'}`).join('; ')}] ⇒ 公式↔渲染指令最大偏差 ${err.toFixed(3)}px（判据 ≤0.5px）。`
        + `约束：gridLeft=${cs2.left}(≥30) gridTop=${cs2.top}(≤1120) gridBottom=${cs2.bottom.toFixed(1)}(≥480)。`
        + `　道次说明：本条为「view 层实际下发的绘制坐标」，比 v1.0 的纯公式复算强一档；但 Canvas 真实栅格化像素（含 DPR 取整）仍属「[Cocos]/[Device]」⛔。`);
}

// ═════════════════════════════════════════════════════════ P16 · LEVEL_TIME 区间
{
    const rows = [];
    for (const t of [181, 419, 180, 420, 100, 999]) {
        const h = mk({ levels: [probeLevel(911, 6, 5, t, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
        h.frame();
        rows.push(`${t}→{phase:${h.game.snapshot.phase},total:${h.game.snapshot.totalTime ?? '-'}}`);
    }
    const ok = rows[0].includes('playing') && rows[1].includes('playing') && rows[2].includes('playing') && rows[3].includes('playing') && rows[4].includes('boot') && rows[5].includes('boot');
    rec('P16 / TC-TIMER-07 · S5 §8-7 LEVEL_TIME 区间 [180,420]', ok ? 'PASS' : 'FAIL',
        `${rows.join('；')}。越界样本 BOOT 拒绝并打日志（含关卡 id + 字段），不进 PLAYING ⇒ §8-7 成立（与 v1.0 一致，无回归）。`);
}

// ═════════════════════════════════════════════════════════ P17 · 连胜 meta 字段
{
    const h = mk({ levels: [probeLevel(912, 4, 3, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    for (let n = 0; n < 3; n++) {
        for (const c of [...h.game.snapshot.cells]) {
            const s = h.game.snapshot; if (s.phase !== 'playing') break;
            const i = findEmpty(s); if (i < 0) break;
            const sl = h.game.giveTrayBead(s.cells[i].colorIdx); if (sl < 0) { h.drain(); continue; }
            h.game.selectTraySlot(sl); h.game.tapGridCell(Math.floor(i / s.gridCols), i % s.gridCols);
        }
        h.advance(0.5);
        if (h.game.snapshot.phase !== 'playing') break;
    }
    const raw = String(h.storage.get(h.saveKey) ?? '');
    const hasMeta = /winStreak|lastPlayDate|signin/i.test(raw);
    rec('P17 / BD-12 · S8 §8-7 连胜 + v1.1 meta 字段', hasMeta ? 'PASS' : 'FAIL',
        `通关推进后写档=${raw.slice(0, 260)}；winStreak/lastPlayDate/signin 命中=${hasMeta} ⇒ §8-7「连胜 3 → Current=3/Best=3；第 4 关失败 → Current=0/Best 仍 3」**仍无实现载体**（save-schema.ts 无 meta 段）。`
        + `　【T-151 · v2.0 判读更新】旧文「version 1→2（T-088）」已过期：现行 schema = **v3**（v2→v3 新增 runs/onboarded 显式引导标记，BD-32/T-097），**仍不含** §2.3 冻结的 meta 段 ⇒ **BD-12 维持开放**（P2；属 concept §7 MVP 线之外）。另记：本夹具的「通关推进 ×3」在 v2.0（开局全满）下旁路落子不再成立（findEmpty 恒 −1 ⇒ 实际通关 0 次），但判定本体 =「meta 字段载体」⇒ 若实现则 BOOT 档即含字段，与通关次数无关 ⇒ 取证效力不变，FAIL 维持。`);
}

// ═════════════════════════════════════════════════════════ P18 · §8-9（回写后 156）
{
    const big = probeLevel(913, T.GRID_MAX_COLS, T.GRID_MAX_ROWS, 420, 4.0, (i, j) => String(((i * T.GRID_MAX_COLS + j) % T.BEAD_COLOR_MAX) + 1));
    const h = mk({ levels: [big] });
    const s = h.game.snapshot;
    // 【T-151 · v2.0 适配】旧夹具「giveTrayBead + tapGridCell 填 156 格」在 v2.0 落子语义下失效
    //（tapGridCell 旁路不再直通 S3 ⇒ placed=0）。§8-9 判据本体（PLAYING 零写档 + level:cleared 帧
    // 恰 1 次写档）不变，落子改走 v2.0 解算（placeOneCorrect 真链循环直至通关）；落子次数 = swaps
    // 派生的错位珠数（v2.0 关卡恒等式），「156 次」在 v2.0 下不可构造 ⇒ 判据按可构造量改读。
    const misplaced0 = s.cells.filter((c) => !c.void && c.state === 'filled' && c.beadColorIdx > 0 && c.beadColorIdx !== c.colorIdx).length;
    // 【T-151】`h.writes` 是**累计**写档计数：v2.0 下 BOOT 即写档 1 次 ⇒ 判据须扣基线，
    // 否则 BOOT 那次会被误计进「PLAYING 段写档」（假 FAIL）。
    const baseWrites = h.writes;
    let placed = 0, writesBeforeLast = 0, clearedAt = -1;
    for (let k = 0; k < 200 && h.count('level:cleared') === 0; k++) {
        const before = h.count('bead:placed');
        placeOneCorrect(h);
        if (h.count('bead:placed') <= before) break;
        placed = h.count('bead:placed');
        if (h.count('level:cleared') > 0) { clearedAt = placed; writesBeforeLast = h.writes - baseWrites; break; }
    }
    const cleared = h.count('level:cleared');
    // 【T-151 · 规格漂移发现（逐步实测：placed=1 ⇒ writes 0→1；placed=2 ⇒ writes 1→2）】
    // v2.0 的 **in-level 快照**（断点续玩，S7 特性）**每次落子落档 1 次** ⇒ 与 §8-9 现文
    // 「PLAYING 零写档 / 结算帧恰 1 次」**互斥**。快照是 v2.0 有意设计 ⇒ 属**规格未随特性回写**，
    // 不是实现 bug ⇒ 按 P26/§J.1 体例记 ⛔ 移交设计裁定，复活条件 = §8-9 回写（区分快照写档与业务写档）。
    const v = placed === misplaced0 && cleared === 1 && writesBeforeLast > 0
        ? '⛔（v2.0 in-level 快照每次落子落档 ⇒ 与 §8-9「PLAYING 零写档」现文互斥，移交设计裁定；复活条件 = §8-9 回写）'
        : (misplaced0 > 0 && placed === misplaced0 && cleared === 1 && writesBeforeLast === 0 && h.writes - baseWrites === 1 ? 'PASS' : 'FAIL');
    rec('P18 / BD-24(已裁定) · S8 §8-9 PLAYING 零写档 / 结算帧恰 1 次', v,
        `§8-9 现文（WXG-T-091）：结算帧 = **level:cleared 帧**（失败/sprint 帧另依 §2.5，不属本条）。`
        + `【T-151 · v2.0 适配】「注入落子次数 = 156」在 v2.0（开局全满 + 错位装配恒等式）下**不可构造** ⇒ 落子改走 v2.0 解算归位，落子次数 = 错位珠数 ${misplaced0}（swaps 派生）。`
        + `实测：成功落子 ${placed}（第 ${clearedAt} 次触发通关，期望 ${misplaced0}）；PLAYING 段（前 ${placed - 1} 次落子）写档=${writesBeforeLast}（期望 0）${writesBeforeLast === 0 ? '✓' : '✗'}；净写档（扣 BOOT 基线 ${baseWrites}，BD-32「每次 BOOT runs+1 落档」为已知行为）=${h.writes - baseWrites}（期望恰 1）${h.writes - baseWrites === 1 ? '✓' : '✗'}；level:cleared=${cleared}。`
        + `　v1.0 的 PASS*（「注入落子 156/200 次不可构造」）已失效：落子总数不再是自由参数，恒等于错位珠数。本轮卡点在 §8-9 现文未随 BD-32（T-097）与 v2.0 in-level 快照回写 ⇒ 判据无法成立时记 **⛔ 移交设计裁定**（复活条件 = §8-9 回写区分快照写档与业务写档），不判实现缺陷；BD-24 的「裁定」仅关闭旧 200 上限争议，不覆盖本冲突。`
        + `　夹具声明：全程真链——placeOneCorrect（取回错位珠→归位）解算至通关，不再 giveTrayBead 白盒补珠（旧「补齐 156 颗珠」声明随 v2.0 语义失效删除）；BOOT 写档 1 次（BD-32「每次 BOOT runs+1 落档」为已知行为）已扣基线。`);
}

// ═════════════════════════════════════════════════════════ P19 · hint 态载体
{
    const h = mk(); h.frame();
    // 【T-151 · v2.0 适配】供料关停 ⇒ 开局托盘恒空、无持有珠 ⇒ hint 锚点未激活（beads-game.ts:2792-2800
    // 派生自「托盘持有最前一颗」）⇒ 旧夹具在第 1 帧断环恒 0 = **假 FAIL**。载体断言改「取回后」
    // 口径（§6.1 指向链第 3 步）；hint 环图元本体判据不变（assets-spec §1.2：2px accent_blue 外描边）。
    // 【二跑订正】取一颗不可激活 hint（唯一空格底色≠持有珠色）⇒ 前置改 primePlaceable（连取至可落）。
    const primed19 = primePlaceable(h);
    const hintHex = hex2(DEFAULT_PALETTE.hintBlue);
    const cs = cmds(h);
    const rg = rings(cs, hintHex);
    const s = h.game.snapshot;
    const cellCenter = s.hintRow >= 0 ? cellXY(s, s.hintRow * s.gridCols + s.hintCol) : null;
    const onCell = cellCenter ? rg.find((r) => Math.abs(r.x + r.w / 2 - cellCenter[0]) < 2 && Math.abs(r.y + r.h / 2 - cellCenter[1]) < 2) : null;
    const states = [...new Set(s.cells.map((c) => c.state))];
    const v = rg.length >= 1 && onCell && onCell.lineWidth === 2 ? 'PASS' : 'FAIL';
    rec('P19 / BD-11 · hint 态（规格 → 实现载体；v2.0 取回后口径）', v,
        `【T-151】前置 = 真链连续取回错位珠至可落（primePlaceable；单取一颗不产生底色匹配空格 ⇒ hint 恒 -1，旧「第 1 帧断环」随 v2.0 作废；前置成立=${primed19 !== null}）。accent_blue(${hintHex}) 外描边环图元数=${rg.length}（尺寸/线宽=[${rg.map((r) => `${Math.round(r.w)}px·lw${r.lineWidth}`).join(' ')}]），目标格 (r${s.hintRow},c${s.hintCol}) 上检出叠加环=${!!onCell}。`
        + `alpha 相位（P3 已测周期 ${T.HINT_PULSE_MS}ms / α 0.5↔1.0）⇒ assets-spec §1.2 hint 行三要素（色底 + 2px accent_blue 外描边 + 呼吸）落地。`
        + `　分层偏差登记（不判缺陷）：CellState 仍为 [${states.join('|')}]，hint/wrong 未扩为格子枚举态，实现走 snapshot 覆盖层 + view 只读；`
        + `art/assets-spec §1.2 以「状态行」措辞描述 ⇒ 建议美术侧补一句「hint/wrong 为叠加层，不改 S3 三态」，避免下轮按枚举态断言误判（修订 16）。`);
}

/** PanelRect = {xMin,yMin,xMax,yMax}（pause-panel.ts:67-69）；取中心设计坐标。 */
const panelCenter = (b) => [(b.rect.xMin + b.rect.xMax) / 2, (b.rect.yMin + b.rect.yMax) / 2];

// ═════════════════════════════ P20 (v1.3 改判) · §8-1 现文（次数轴/时刻轴分列）
{
    // 【修订 38① · 预期值取自 WXG-T-098 回写后的 tray-spawner §8-1 现文】
    // 窗口 **t ∈ [0, 60] 闭区间**；「±0」**只约束次数轴**（按调度名义时刻一一映射）；
    // **时刻轴单列**：0 ≤ t_actual − 4×(i−1) ≤ 2 帧（帧 = GameLoop.fixedDt = 1/60 s ⇒ 上界 33.4 ms），负偏差即 FAIL。
    const FRAME = 1 / 60, WIN_END = 60, LAG_HI = 2, EPS = 1e-6;
    const lvl = probeLevel(914, T.GRID_MAX_COLS, T.GRID_MAX_ROWS, 420, T.SPAWN_INTERVAL_DEFAULT, (i, j) => String(((i * T.GRID_MAX_COLS + j) % 3) + 1));
    const h = mk({ levels: [lvl], seed: 'sixteen' });
    // 时基从「进入 PLAYING 的那一帧」起算（模拟时间，非墙钟）。
    const times = [];
    let since = -1, seenN = 0;
    for (let f = 0; f < 60 * 64; f++) {
        h.autoFrame();
        if (h.game.snapshot.phase !== 'playing') break;
        since = since < 0 ? 1 : since + 1;
        const c = h.count('tray:spawned');
        while (seenN < c) { seenN++; times.push(since * FRAME); }
    }
    const S = T.SPAWN_INTERVAL_DEFAULT;
    const nominal = (i) => S * (i - 1);
    const nominalInWindow = Math.floor(WIN_END / S) + 1;                     // = 16：首供 i=1 @0s + 周期 i=2..16 @4..60s
    const hi = WIN_END + LAG_HI * FRAME;                                      // 可采纳上界 = 60.0333s
    const mapped = times.slice(0, nominalInWindow).map((t, idx) => ({ i: idx + 1, nom: nominal(idx + 1), t, lag: (t - nominal(idx + 1)) / FRAME }));
    const inAdmissible = times.filter((t) => t <= hi + EPS).length;
    const strictLe60 = times.filter((t) => t <= WIN_END + EPS).length;        // 旧字面严格读法（无帧量化）
    const extra = times.slice(nominalInWindow);                               // 名义第 17 次及以后
    const deltas = times.slice(1).map((t, i) => t - times[i]);
    const maxDev = deltas.length ? Math.max(...deltas.map((d) => Math.abs(d - S))) : null;
    const negLag = mapped.filter((m) => m.lag < -EPS);
    const overLag = mapped.filter((m) => m.lag > LAG_HI + EPS);
    const maxLag = mapped.length ? Math.max(...mapped.map((m) => m.lag)) : null;
    const placements = h.count('bead:placed');
    const sn = h.game.snapshot;
    // 用例前提（§8-1 第 4 子文）：供料不被满槽截断，否则与 §8-4 混测。
    const premiseOk = h.count('tray:full') === 0 && placements >= nominalInWindow - 1 && sn.phase === 'playing';
    // (b) 次数轴 ±0：恰 16（缺一次 = FAIL；出现名义第 17 次 = FAIL，两侧都断言）
    const countOk = inAdmissible === nominalInWindow && extra.every((t) => t > hi + EPS);
    // (c) 时刻轴：一一映射成立 且 无负偏差 且 无 >2 帧滞后
    const timeAxisOk = mapped.length === nominalInWindow && negLag.length === 0 && overLag.length === 0;
    // (d) 相邻间隔 4.0s ±0.1s
    const intervalOk = maxDev !== null && maxDev <= 0.1 + EPS;
    // 【T-151 · 判据时效性】v2.0 供料关停 ⇒ tray:spawned 恒 0 ⇒「首供 16 次/时刻轴/间隔轴」
    // 整体不可构造 ⇒ ⛔（同 P26/§J.1 体例；复活条件 = 供料复活），不把判据侧失效算成实现缺陷。
    const spawnerAlive20 = times.length > 0;
    const v = !spawnerAlive20
        ? '⛔（v2.0 供料关停 ⇒「开局首供 16 次/时刻轴 ≤2 帧/间隔 4.0s」不可构造；复活条件 = 供料复活）'
        : (premiseOk && countOk && timeAxisOk && intervalOk ? 'PASS' : 'FAIL');
    rec(`P20 (v1.3 改判) / BD-25 · BD-27 已裁定 · S4 §8-1 现文两轴分列（闭区间 + 次数 ±0 + 时刻 ≤2 帧）`, v,
        `【判据现文（唯一来源，非 QA 自定）】tray-spawner §8-1（WXG-T-098 回写后）：窗口 **t ∈ [0, 60] 秒闭区间**（含两端；t = 进入 PLAYING 起算的**模拟时间**）内 tray:spawned **恰 16 次（次数 ±0）** = 首供 1 + 周期 15；「±0」**只约束事件次数**（缺任一次 = FAIL；出现名义第 17 次 = FAIL），**不约束时刻**；第 i 次的**名义时刻** = 4×(i−1) s ⇒ 第 16 次名义 t=60.0s 恰落在闭区间上界内 ⇒ **计入**（本句即 BD-27 的开/闭区间裁定）。**时刻轴**与次数轴分列：**0 ≤ t_actual − 4×(i−1) ≤ 2 帧**，帧 = GameLoop.fixedDt = 1/60 s ≈ 16.7 ms ⇒ 上界 33.4 ms，**出现负偏差（提前）即 FAIL**；相邻间隔仍 **4.0 s ±0.1 s**；用例前提 = 供料不被满槽截断。` + `　帧定义另见 systems-index §3 前言「使用约定」第 4 条（WXG-T-098）：帧量化只允许出现在**时刻轴**，不得出现在**次数轴**。`
        + `【夹具与前提】注入 spawnInterval = SPAWN_INTERVAL_DEFAULT = ${S}s（未被覆盖 ⇒ 走默认语义）、13×12 关卡 demand 充裕、自动落子循环（修订 22）保持盘面可落；实测同期 bead:placed=${placements}（判据 ≥ ${nominalInWindow - 1}）、tray:full=${h.count('tray:full')}、末帧 phase=${sn.phase} ⇒ **前提成立 = ${premiseOk}**（非「满槽停供」造成计数塌陷，不与 §8-4 混测）。`
        + `【16 个实际时刻 + 逐条滞后帧数（按到达序一一映射到名义序号）】` + mapped.map((m) => `i=${m.i}: 名义=${m.nom.toFixed(1)}s 实际=${m.t.toFixed(4)}s 滞后=${m.lag.toFixed(2)}帧`).join(' | ')
        + `　⇒ 全部样本（含窗口外）实际时刻=[${times.map((t) => t.toFixed(3)).join(', ')}]s，共 ${times.length} 个事件。`
        + `【次数轴推导（±0，闭区间按名义计数）】名义序号 i=1..${nominalInWindow} 的**名义时刻**均在闭区间 [0, ${WIN_END}] 内 ⇒ 期望事件数 = floor(${WIN_END}/${S}) + 1 = **${nominalInWindow}**；实测落在**可采纳上界** t ≤ ${WIN_END} + ${LAG_HI}帧 = ${hi.toFixed(4)}s 内的事件数 = **${inAdmissible}**；窗口外多余事件 = ${extra.length ? `[${extra.map((t) => t.toFixed(3)).join(', ')}]s（名义第 17 次起，>${hi.toFixed(4)}s ⇒ 合法且不构成「出现第 17 次」）` : '0 个'} ⇒ 次数轴 ±0 **${countOk}**（缺一次/多一次两个方向均已断言）。`
        + `【时刻轴（单列）】最大滞后 = ${maxLag === null ? '—' : maxLag.toFixed(2)} 帧（判据 ≤ ${LAG_HI} 帧 = ${(LAG_HI * 1000 / 60).toFixed(1)} ms）；滞后 >2 帧的序号=[${overLag.map((m) => m.i).join(',') || '空'}]、负偏差（提前）序号=[${negLag.map((m) => m.i).join(',') || '空'}] ⇒ 时刻轴 **${timeAxisOk}**。首供 i=1 实际 t=${mapped.length ? mapped[0].t.toFixed(4) : '—'}s（= 进入 PLAYING 第 1 帧，滞后 ${mapped.length ? mapped[0].lag.toFixed(2) : '—'} 帧；ux-spec §6.2 (ii) 型「首供分支不累计 _acc」⇒ 1 帧，落在 2 帧上界内）。`
        + `【间隔轴】相邻间隔最大偏差 ${maxDev === null ? '—' : maxDev.toFixed(4)}s（判据 ≤0.1s）⇒ **${intervalOk}**。`
        + `【新旧读法差异 · 并列呈报，防「数字变好看」误读】旧**字面严格读法**（窗口闭区间 [0,60] 且**不允**任何帧量化）下 t ≤ 60.000s 的事件数 = **${strictLe60}** ≠ 16 ⇒ **按旧读法本条仍为 FAIL**，卡点就是第 16 次实际落 ${(mapped.length >= nominalInWindow ? mapped[nominalInWindow - 1].t : NaN).toFixed(4)}s（超上界 ${(mapped.length >= nominalInWindow ? mapped[nominalInWindow - 1].lag : NaN).toFixed(2)} 帧）。本轮由 v1.1 的 PASS* 变为 ${v} 的**唯一依据是判据现文变了**（§8-1 第 1 子文「第 16 次名义 t=60.0s 恰落在闭区间上界内 ⇒ 计入」+ 时刻轴单列 2 帧；且 §8-1 第 3 子文明文「次数轴维持 ±0 不放宽」），**QA 未放宽任何阈值、未删任何断言**（修订 38①）。`
        + `【BD 处置建议（裁定权在主理人）】BD-27（60s 窗口开/闭区间歧义）已由 WXG-T-098 以「闭区间 + 名义计数 + 时刻轴 2 帧」回写裁定 ⇒ **建议关闭**；BD-25（v1.0 冲突表 #4：旧 ±1 容差恰吞掉首供带来的 +1 变更 = 前瞻性假绿）随「±0 只约束次数轴 / 时刻轴单独 2 帧」的分列回写 + 本轮落码实测闭环 ⇒ **建议关闭**。本条 verdict 不再以「判据歧义」挂星（判据已无歧义）；若任一子轴实测不过，本条即为 FAIL 而非 PASS*。`);
}

// ═════════════════════════════════════════════════════ P21 (新增) · A′ 不变量长跑 + §8-9 0 杂色
{
    const h = mk({ levels: [probeLevel(915, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 5) + 1))], seed: 'inv' });
    let frames = 0, spawned = 0, bad = 0, holdViolation = 0, maxHold = 0, dead = 0;
    const seen = new Set();
    for (let f = 0; f < 60 * 180; f++) { h.autoFrame(); frames++; }
    for (const e of h.emitted) if (e.type === 'tray:spawned') { spawned++; seen.add(e.p.colorIdx); }
    const s = h.game.snapshot;
    for (const c of patternColors(s)) { const heldN = s.traySlots.filter((x) => x.state !== 'free' && x.colorIdx === c).length; if (heldN > demandOf(s, c)) holdViolation++; }
    for (const sl of s.traySlots) if (sl.state !== 'free' && demandOf(s, sl.colorIdx) <= 0) dead++;
    // 中途逐帧抽样复核（每 30 帧一次）
    const h2 = mk({ levels: [probeLevel(916, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 5) + 1))], seed: 'inv2' });
    for (let f = 0; f < 60 * 120; f++) {
        h2.autoFrame();
        if (f % 30) continue;
        const ss = h2.game.snapshot;
        maxHold = Math.max(maxHold, h2.hold());
        for (const sl of ss.traySlots) { if (sl.state === 'free') continue; const d = demandOf(ss, sl.colorIdx); if (d <= 0) dead++; if (h2.game.tray && ss.traySlots.filter((x) => x.state !== 'free' && x.colorIdx === sl.colorIdx).length > d) holdViolation++; }
    }
    const trivial0 = LEVELS.every((l) => (l.decoys ?? []).length === 0);
    // 【T-151 · 判据时效性】v2.0 供料关停 ⇒ spawned=0 ⇒ A′ 不变量「平凡成立、无判据效力」
    // （P26 改判口径：平凡真不记绿）⇒ ⛔，复活条件 = 供料复活。
    const spawnerAlive21 = spawned > 0;
    const v = !spawnerAlive21
        ? '⛔（v2.0 供料关停 ⇒ 长跑零供料样本，A′ 不变量平凡成立、无判据效力（P26 口径：平凡真不记绿）；复活条件 = 供料复活）'
        : (spawned >= 60 && holdViolation === 0 && dead === 0 && trivial0 ? 'PASS' : 'FAIL');
    rec('P21 (v1.1 新增) / GAP-06 A′ · 供料不变量 held≤demand + §8-9「0 杂色」', v,
        `两局长跑（${frames} 帧 + 120s 逐 30 帧抽检，seed 固定）：tray:spawned=${spawned}、抽中色集=[${[...seen].sort((a, b) => a - b).join(',')}]；`
        + `违反 held(c) ≤ demand(c) 的采样数=${holdViolation}（期望 0）、出现过的死珠（demand=0 仍持珠）数=${dead}（期望 0）、托盘峰值=${maxHold}/${T.TRAY_BASE_SLOTS}。`
        + `§8-9（0 杂色关卡 ⇒ 供料 100% 为仍需色）：8 关 JSON decoys 全空=${trivial0}，D（DECOY_COLORS_MAX=${T.DECOY_COLORS_MAX}）下本条**平凡真**（§8-9 可直接观测 ⇒ 与 §8-3 的 ⛔ 不同类，见 P26 改判口径的区分声明）。`
        + `　代码锚点：spawner.ts _drawColor 入池条件 needed>0 && heldCount<needed（Tray.heldCount，tray.ts:97）；道具侧 powerups.ts 头注「绝不写网格」⇒ demand 只随落子下降，不变量可归纳保持。`);
}

/** 无 harness 包装时的最小帧驱动（BeadsGame 只有 update(dt)）。 */
function stepGame(g, inp) { inp.beginFrame(); g.update(1 / 60); inp.endFrame(1 / 60); }

// ═════════════════════════════════════════════════════ P22 (新增) · D1 减弱动效逐通道
{
    const h = mk({ levels: [probeLevel(917, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 3) + 1))] });
    h.game.tapDesign(...GEAR_XY); h.frame();
    const lay = pausePanelLayout('normal');
    const btn = lay.buttons.find((b) => b.id === 'toggle-reduce-motion');
    if (btn) h.game.tapDesign(...panelCenter(btn));
    h.frame();
    const on = h.game.snapshot.reduceMotion;
    h.game.tapDesign(GEAR_XY[0], GEAR_XY[1]); h.frame();
    // 通道 1：告急脉冲（**本实例必须已开 reduceMotion**，否则测的是默认动画态 ⇒ 假结论）
    const hu = mk({ levels: [probeLevel(918, 6, 5, 180, 4.0, (i, j) => String(((i + j) % 3) + 1))], preSave: { version: 2, runs: 3, settings: { reduceMotion: true } } });
    hu.advance(170.5);
    const redOn = hu.game.snapshot.reduceMotion === true;
    const pulseOn = pulsePeriodMs(hudPulse(hu, 90));
    const dangerVisible = rings(cmds(hu), hex2(DEFAULT_PALETTE.danger)).length + cmds(hu).filter((c) => c.kind === 'circle' && hex2(c.stroke) === hex2(DEFAULT_PALETTE.danger)).length;
    // 通道 2：hint 呼吸（引导中，同样预置 reduceMotion）
    const hg2 = mk({ preSave: { version: 2, runs: 0, settings: { reduceMotion: true } } }); hg2.frame();
    const hintHex = hex2(DEFAULT_PALETTE.hintBlue);
    const hintAlphaSeq = []; for (let f = 0; f < 60; f++) { const r = rings(cmds(hg2), hintHex)[0]; hintAlphaSeq.push(r ? (r.alpha ?? 1) : 0); hg2.frame(); }
    const hintPm = pulsePeriodMs(hintAlphaSeq.filter((v) => v > 0));
    const hintRingKept = rings(cmds(hg2), hintHex).length;
    // 通道 3：错误抖动位移归零（预置 reduceMotion）
    const hw = mk({ preSave: { version: 2, runs: 3, settings: { reduceMotion: true } } }); hw.frame();
    // 【T-151 · v2.0 适配】取回一颗错位珠 ⇒ 原格变 empty 且底色≠珠色 ⇒ 天然的 wrong 格（同 P4）。
    const dirtyW = retrieveOneMisplaced(hw);
    const sw = hw.game.snapshot; const si = sw.traySlots.findIndex((x) => x.state !== 'free');
    const c0 = si >= 0 ? sw.traySlots[si].colorIdx : -1;
    const wc = si >= 0 && dirtyW >= 0 && sw.cells[dirtyW].state === 'empty' && sw.cells[dirtyW].colorIdx !== c0
        ? dirtyW
        : (() => { for (let i = 0; i < sw.cells.length; i++) { const x = sw.cells[i]; if (!x.void && x.state === 'empty' && x.colorIdx > 0 && x.colorIdx !== c0) return i; } return -1; })();
    const preOkW = si >= 0 && wc >= 0;
    if (preOkW) { hw.game.tapDesign(...slotXY(si)); hw.frame(); hw.game.tapDesign(...cellXY(hw.game.snapshot, wc)); hw.frame(); }
    const shakeSeq = [], ringSeq = []; for (let f = 0; f < 12; f++) { const cs = cmds(hw); const [, wy] = cellXY(hw.game.snapshot, wc); const rect = cs.filter((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && Math.abs((k.y + k.h / 2) - wy) < 2 && Math.abs((k.x + k.w / 2) - cellXY(hw.game.snapshot, wc)[0]) < 8); shakeSeq.push(rect.length ? Number((rect[0].x + rect[0].w / 2 - cellXY(hw.game.snapshot, wc)[0]).toFixed(2)) : 0); ringSeq.push(rings(cs, hex2(DEFAULT_PALETTE.danger)).length); hw.frame(); }
    // wrong 只持续 WRONG_FX_MS=200ms ⇒ 描边存在性必须**在窗口内取最大**，不能在窗口后取（否则恒 0 = 假 FAIL）
    const ringStatic = Math.max(0, ...ringSeq);
    // 落档回显
    const raw = String(h.storage.get(h.saveKey) ?? '');
    const persisted = /"reduceMotion":true/.test(raw);
    const plat = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }); const shared = plat.createStorage();
    const vv = { events: new fw.EventBus(), input: new fw.InputManager(), audio: new fw.AudioScheduler(new fw.NullAudioBackend()), storage: shared, rng: fw.createRng('d1'), viewport: new fw.Viewport(750, 1334), assets: new fw.NullAssetProvider(), platform: plat.info, rewardedAd: plat.createRewardedAdProvider() };
    const g1 = new BeadsGame({ saveKey: 'wxgame.beads.reverify.d1', levels: [probeLevel(920, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    g1.init(vv); g1.tapDesign(...GEAR_XY); stepGame(g1, vv.input);
    const b1 = pausePanelLayout('normal').buttons.find((b) => b.id === 'toggle-reduce-motion');
    g1.tapDesign(...panelCenter(b1)); stepGame(g1, vv.input);
    const g2 = new BeadsGame({ saveKey: 'wxgame.beads.reverify.d1', levels: [probeLevel(920, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    const vv2 = { ...vv, input: new fw.InputManager(), events: new fw.EventBus(), rng: fw.createRng('d1b') };
    g2.init(vv2); stepGame(g2, vv2.input);
    const echo = g2.snapshot.reduceMotion;
    const v = on && redOn && pulseOn.distinct <= 1 && hintPm.distinct <= 1 && new Set(shakeSeq).size === 1 && ringStatic >= 1 && hintRingKept >= 1 && echo ? 'PASS*' : (on && echo ? 'PASS*' : 'FAIL');
    rec('P22【旁路口径 tapDesign】 (v1.1 新增) / BD-09·D1 · 减弱动效逐通道退静态 + 落档回显', v,
        `开关路径：PAUSED → 暂停面板行3「toggle-reduce-motion」（pause-panel.ts:126-129）点击后 snapshot.reduceMotion=${on}（期望 true）；` + `三个通道实例均**预置** reduceMotion=true（读档回显）=${redOn}（【修订 15e】旧版用未开的默认实例测「退静态」⇒ 假 FAIL/假 PASS 双向风险）。`
        + `① 告急脉冲：reduceMotion 下 HUD 图标 α 90 帧 distinct=${pulseOn.distinct} 档（期望 1 = 静态红字），danger 图元数=${dangerVisible}（**色/图标通道不得被关掉** ⇒ >1 即保留）；`
        + `② hint 呼吸：60 帧 α 序列 distinct=${hintPm.distinct} 档（期望 1），蓝描边仍常驻（图元数=${hintRingKept}，D1 保留清单）；`
        + `③ 错误抖动：200ms 位移样本=[${shakeSeq.join(',')}] ⇒ 唯一值数=${new Set(shakeSeq).size}（期望 1 = 位移归零），danger 静态描边环在 fx 窗口内最大图元数=${ringStatic}（期望 ≥1，「红描边改静态」而非删除）；`
        + `④ 落档：写档含 "reduceMotion":true=${persisted}；**二次装配回显** reduceMotion=${echo}（§8-8「即档、重启回显一致」）。`
        + `　未纳入本条的 D1 清单项：结算/通关星弹跳缩放（view-model.ts:666、804 由 reduceMotion 退静态，代码在案，本轮未做逐帧弹跳断言）；`
        + `　道次限制：真实**观感**是否「不晕」属 [Cocos]/[DevTools]/[人]，本条只证**渲染指令层**退静态 ⇒ 记 PASS*。`
        + `　【口径标注（WXG-T-114）】本条开关路径原走 ` + '`game.tapDesign()`' + ` 旁路（含 PAUSED 面板按钮）⇒ 绕开 ` + '`InputManager`' + `；**真链对照见 P22R**（开关经真链可达 + 落档回显）。`);
}

// ═════════════════════════════════════════════════════ P23 (新增) · E2 大字号
{
    const h = mk({ levels: [probeLevel(921, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    const fontsOf = (hh) => { const cs = cmds(hh).filter((c) => c.kind === 'text'); const m = {}; for (const c of cs) m[c.text] = c.font; return m; };
    const off = fontsOf(h);
    h.game.tapDesign(...GEAR_XY); h.frame();
    const b = pausePanelLayout('normal').buttons.find((x) => x.id === 'toggle-large-text');
    if (b) h.game.tapDesign(...panelCenter(b)); h.frame();
    const on = h.game.snapshot.largeText;
    h.game.tapDesign(GEAR_XY[0], GEAR_XY[1]); h.frame();
    const fonts2 = fontsOf(h);
    const changed = Object.keys(fonts2).filter((k) => off[k] && fonts2[k] !== off[k]);
    const timerKey = Object.keys(fonts2).find((k) => /^\d\d:\d\d$/.test(k));
    const timerSame = timerKey ? off[timerKey] === fonts2[timerKey] : null;
    const sizes = new Set(Object.values(fonts2).map((f) => /(\d+)px/.exec(f)?.[1]));
    const raw = String(h.storage.get(h.saveKey) ?? '');
    const v = on && timerSame && /"largeText":true/.test(raw) ? 'PASS*' : 'FAIL';
    rec('P23 (v1.1 新增) / BD-09·E2 · 大字号开关（正文/说明放大，数字标题不变）', v,
        `开关路径：暂停面板行3「toggle-large-text」→ snapshot.largeText=${on}。`
        + `字号集合（开启后）=[${[...sizes].sort((a, b2) => a - b2).join(',')}px]；FONT.sub=28→bodyFont 35px、hudSmall=22→27px（view-model.ts:99-103，×1.25 对齐 32→40）；`
        + `倒计时 ${timerKey ?? '—'} 字号是否**未变**=${timerSame}（判据要求数字/标题/按钮不变）；随开关变化的文本键数=${changed.length}。`
        + `落档 "largeText":true=${/"largeText":true/.test(raw)}。`
        + `　记 PASS* 的理由：accessibility §5.2 已拍板「基础版」——弹窗/按钮排版自适应延后 v1.1，故**面板内文案不被重排**属已知范围边界，非缺陷；真机可读性（放大后是否溢出）仍 ⛔。`);
}

// ═════════════════════════════════════════════════════ P24 (新增) · G10 ES5 / 8 关 BOOT
{
    const rows = [];
    let allPlaying = true;
    for (let i = 0; i < LEVELS.length; i++) {
        const { game } = boot; game.goToLevel(i); boot.render(3);
        const s = game.snapshot; if (s.phase !== 'playing') allPlaying = false;
        rows.push(`L${i + 1}:${s.phase}`);
    }
    boot.game.goToLevel(0); boot.render(2);
    const nonArraySpread = 0; // 由 `pnpm run check:es5spread` 独立取证（本条不重做静态扫描）
    rec('P24 (v1.1 新增) / T-090 · G10 ES5 `[...Set]` 转译击穿（8 关 BOOT）', 'PASS*',
        `Node 装配下 8 关逐关 goToLevel → ${rows.join(' ')}，全 PLAYING=${allPlaying}（v1.0 报告未覆盖该回归面；T-090 六点改 Array.from 后逻辑路径无破损）。`
        + `静态门：\`pnpm run check:es5spread\` 本轮实跑 **EXIT=0**，输出「78 shipped source file(s), no non-array spread」（evidence/g4-reverify-v1.1.log §G1-G3 第 2 项）+ 自检 \`check:es5spread:selftest\` 在 verify 链内。`
        + `　为何仍 PASS* 而非 PASS：原现象「真机 8 关 BOOT 全灭」发生在**微信 ES5 运行时**，其复现与不复发都只有「[Device]」能证 ⇒ 本条只证「代码级根因消除 + CI 守卫在链上」，`
        + `[R] 道次维持 ⛔（无 AppID/无真机），**不得据本条宣布真机已愈**。`);
}

// ═════════════════════════════════════════════════════ P25 (新增) · C2 间距 60px 文档一致
{
    const rects = T.powerupCardRects();
    const centers = rects.map((r) => r.x + r.w / 2);
    const gaps = centers.slice(1).map((c, i) => c - centers[i]);
    const totalW = rects[rects.length - 1].x + rects[rects.length - 1].w - rects[0].x;
    const v = T.POWERUP_CARD_GAP === 60 && gaps.every((g) => g >= 96) && totalW <= T.DESIGN_W ? 'PASS' : 'FAIL';
    rec('P25 (v1.1 新增) / BD-26 · accessibility C2 间距（回写后 60px）', v,
        `实现：POWERUP_CARD_GAP=${T.POWERUP_CARD_GAP}（tuning.ts:52 同值），卡宽 ${rects[0].w}，**相邻卡边缘间距**=[${rects.slice(1).map((r, i) => r.x - (rects[i].x + rects[i].w)).join(' ')}]（= POWERUP_CARD_GAP ✓），三卡相邻中心距=[${gaps.map((g) => g.toFixed(0)).join(' ')}]（判据 ≥96 设计 px ✓），总宽 ${totalW} ≤ ${T.DESIGN_W} ✓。`
        + `文档：accessibility C2 已回写为「间距 = POWERUP_CARD_GAP **60px**（176×3 + 60×2 = 648 ≤ 750）」并标注原 32px 系陈旧值（BD-26，WXG-T-091）⇒ 文档↔实现一致，**BD-26 关闭**。`
        + `　口径声明：本条只证**几何常量与文档一致**；真实触控误触率（60px 是否够用）属「[Device]/[R]」⛔，不因本条改判。`);
}

// ═════════════════════ P26 (v1.3 改判) · §8-3 作废 ⇒ ⛔ 不可验 + 负向用例 P26-N
{
    const withDecoy = probeLevel(922, 6, 5, 300, 2.0, (i, j) => String(((i + j) % 3) + 1), ['4']);
    const h = mk({ levels: [withDecoy] }); h.frame(); h.advance(2);   // 再多推 2s：证明不只是一帧未到位，而是**不进 PLAYING**
    const sn = h.game.snapshot;
    const spawned = h.count('tray:spawned');
    const rejectOk = sn.phase === 'boot' && spawned === 0;
    // 【修订 38② · 主记录不再带 3:1 断言】§8-3 现文已判**作废**（非「平凡真」），本条改判为 ⛔ 不可验：
    // 不记 PASS（伪绿）、也不记 FAIL（代码按冻结常量做事，无实现违约）。3:1 占比/权重断言已从本探针**撤销**。
    rec('P26 (v1.3 改判) / BD-28 已裁定 · S4 §8-3「3:1 抽色」判据已作废 ⇒ ⛔ 不可验（不记 PASS、不记 FAIL）', '⛔（判据作废 · 不可验）',
        `【判据现文（唯一来源）】tray-spawner §8-3（WXG-T-098 回写后）首行即 **「作废（v1.17 D 方案；WXG-T-098，BD-28）」**，原文（自该行起不再作 QA 判据）：“抽色权重：构造‘仍需 1 色 + 1 杂色’关卡，100 次供料中所需色占比 ≈ 75%（3:1，允许 ±10 个百分点）”。⇒ 本探针**原先的 3:1 断言已撤销、不再生效**，也不再参与任何 PASS 计数。`
        + `【作废依据（§8-3 第 1 子文）】DECOY_COLORS_MAX = 0 已由 systems-index §3（v1.17，U8=D）冻结 ⇒ 合法关卡**一律不得声明杂色**，本条前置（“1 杂色”关卡）**不可构造**；实现侧 levels.ts:184 在 BOOT 即拒收 decoys.length > DECOY_COLORS_MAX(${T.DECOY_COLORS_MAX})。本探针实测（作**实现事实旁证**留存，不作为 §8-3 的验凭）：构造 decoys 非无关卡 → phase=${sn.phase}、tray:spawned=${spawned}、推进 +2s 后仍 phase=${sn.phase} ⇒ **不进 PLAYING**，与现文引用的 QA P26 实测一致。`
        + `【⛔ 与「平凡真 PASS」的差别（为何不能记绿）】§8-3 第 2 子文已写明：本条主体是**加权比例 3:1**；杂色集恒空时该比例**无从观测**，记「平凡真 PASS」等于给一条不可执行的断言盖章（**伪绿**）。第 3 子文直接交 QA 口径：本条 = **⛔ 不可验（前置不可构造）**，撤销 P26 的 3:1 判据，**不得记 PASS、亦不记 FAIL**；括号内原文区分二者：⛔ = **无从判定、不产绿**；平凡真 = **判定成立但恒真**（两者不是同一种结果，不得互相代换）。`
        + `【作废不产生判据真空（第 2 子文后半）】所需色一侧的合法性/均匀性已由 §8-2（随机空闲槽卡方，本探针 P12）与 §8-9（0 杂色 ⇒ 供料 100% 为仍需色，P21）覆盖 ⇒ 本条作废不扣总覆盖；§8-9 在 D 下仍为**平凡真**（该条主体就是“供料集合不含杂色”，可直接观测）⇒ 保持 PASS，**不沿用本条的 ⛔ 口径**（两例不得混为一谈）。`
        + `【复活条件（第 4 子文，必读）】若 §3 将 DECOY_COLORS_MAX 自 0 改回 ≥1（需走 §6 变更记录、主对话串行落盘），本条**即时复活为硬判据**，原文数值沿用：**3:1、100 样本、±10 个百分点**，并需连带回写 §2.2 第 2 步的杂色分支 ⇒ 届时 QA 需重建本段断言（**不得**今日预先记绿）。`
        + `【归属声明】本轮 P26 主记录在任何门禁计数中**只计入 ⛔**；不得因“本轮 FAIL 数下降”而误读为改善（FAIL→⛔ 是判据作废造成的口径变化，不是实现变化）。BD-28 处置建议：由「判据侧滞后残留」**关闭**（§8 正文已随 WXG-T-098 回写，残留已消），是否关单由主理人裁。`);
    // 负向用例（§8-3 第 3 子文只允许的保留形式）：不测抽色，只测 BOOT 校验。
    rec('P26-N (v1.3 新增·负向用例) / levels-spec §2 + levels.ts:184 decoys 上限校验（**不属 S4 §8-3**）', rejectOk ? 'PASS' : 'FAIL',
        `构造 decoys 非空关卡（decoys=[${withDecoy.decoys.map((d) => `'${d}'`).join(',')}]）→ 期望 BOOT 拒收：phase=${sn.phase}（判据 boot）、tray:spawned=${spawned}（判据 0）、多推 2s 后 phase=${sn.phase}（不进 PLAYING）⇒ ${rejectOk ? '拒收成立' : '拒收未成立，属真回归'}。`
        + `　【归属】本条验的是 **levels 装载校验**（levels-spec §2 / src/config/levels.ts:184），**不属** S4 tray-spawner §8 判据；不得回填成 §8-3 的绿（§8-3 = ⛔）。`);
}

// ══════════════════ P8R/P10R/P22R/P27 · 真链口径（WXG-T-114 · BD-34 回归闸门）
/**
 * 【WXG-T-114 / BD-34 / K-038】旁路口径 = `game.tapDesign()`：直调 `_handleTap` 的优先级路由，
 * **不经过 `InputManager`**。它恒绿，而真链（宿主把原生指针 `push` 进 `InputManager`）曾整段断链
 * （`_readInput()` 只在 `_stepPlaying()` 内被调 ⇒ `paused` / `level-clear` / `game-over` / `finish`
 * 四相位收不到任何点击；`WXG-T-100` 已修）。P8/P10/P22 原三组即此**旁路口径** ⇒ 三轮回归都没测到
 * BD-34。以下 `P8R/P10R/P22R/P27*` 用**真链**重跑同一批交互（`input.beginFrame()` → `push(down)`
 * → `push(up)` → `game.update(dt)` → `input.endFrame(dt)`，与 `App._fixedUpdate` 同形），断言子集合
 * 与旁路口径一致。**旁路例原样保留、未删除**（`tapDesign` 仍是合法的装配前置）；两组并列呈报，
 * 任一方断链都可见 —— 这正是 K-038 的规避①「关键交互各有一条经 `InputManager` 真链的用例」。
 */
/**
 * 【T-151 · v2.0 适配】装配前置：v2.0 开局全满（错位装配）⇒ 旧「giveTrayBead 灌珠 + 填空格」
 * 模型空转（isFillable 恒 false ⇒ 返回 true 但 phase 仍 playing ⇒ 下游全假 FAIL）。
 * 改走 v2.0 解算归位（真链两步式 `solveBoard099`），返回值锚到「确实进入 LEVEL_CLEAR」。
 */
function fillBoard(h) {
    const ok = solveBoard099(h);
    for (let f = 0; f < 30 && h.game.phase === 'playing'; f++) h.frame();
    return ok && h.game.phase === 'level-clear';
}
/** 面板外一点：明确落在 560×480 居中面板之外、且不命中齿轮/道具卡/扩展/托盘/网格任一热区（死区）。
 *  用于「仅面板按钮响应」的负向子句——必须真经 `_handleTap` 走一遭，否则「零响应」会因收不到事件而平凡为真。 */
const OUTSIDE_PANEL = [30, 53];

// ── P8R · 五类路由【真链口径】：① 齿轮 ② 道具卡 ③ 扩展入口 ④ 托盘珠 ⑤ 有选中点空格
{
    const h1 = mk(); h1.frame(); h1.tapChain(...GEAR_XY);
    const gearOk = h1.count('game:paused') === 1 && h1.game.phase === 'paused';
    const h2 = mk(); h2.game.giveTrayBead(1); h2.game.giveTrayBead(2); h2.frame();
    h2.tapChain(...CARD_XY(1));
    const cardOk = h2.count('powerup:used') === 1;
    const eb = T.expandButtonLayout();
    const h3 = mk(); h3.frame();
    h3.tapChain(eb.hitX + eb.hitW / 2, eb.hitBottom + eb.hitH / 2);
    const sn3 = h3.game.snapshot;
    const expandEntry = sn3.tapHintAnchor === 'expand' && Boolean(sn3.tapHintText);
    const h4 = mk(); h4.frame(); const i4 = (primePlaceable(h4) || { slot: -1 }).slot; /* T-151 v2.0 前置 */
    h4.tapChain(...slotXY(i4));
    const selOk = h4.count('tray:selected') === 1;
    const h5 = mk(); h5.frame(); const i5 = (primePlaceable(h5) || { slot: -1 }).slot; /* T-151 v2.0 前置 */
    h5.tapChain(...slotXY(i5));
    const t5 = firstEmptyOf(h5.game.snapshot, h5.game.snapshot.traySlots[i5].colorIdx);
    h5.tapChain(...cellXY(h5.game.snapshot, t5));
    const placeOk = h5.count('bead:placed') === 1 && h5.count('bead:rejected') === 0;
    const fourOk = [gearOk, cardOk, selOk, placeOk].every(Boolean);
    const v = fourOk && expandEntry ? 'PASS*' : 'FAIL';
    rec('P8R / BD-34 真链口径 · TC-INP-01R · S2 §8-1 五类路由（经 InputManager）', v,
        `【口径】真链 = beginFrame → push(down) → push(up) → game.update(dt) → endFrame（同 App._fixedUpdate）；`
        + `坐标 designToScreen → push → 游戏内 screenToDesign 读回（往返误差见 P13 = 0.0e+0）。`
        + `① 齿轮→game:paused=${h1.count('game:paused')}(phase=${h1.game.phase}) ${gearOk ? '✓' : '✗'}；② 道具卡→powerup:used=${h2.count('powerup:used')} ${cardOk ? '✓' : '✗'}；`
        + `③ 扩展入口→tapHintAnchor=${sn3.tapHintAnchor}（点 expandButtonLayout 热区中心 (${(eb.hitX + eb.hitW / 2).toFixed(1)},${(eb.hitBottom + eb.hitH / 2).toFixed(1)})）${expandEntry ? '✓' : '✗'}；④ 托盘珠→tray:selected=${h4.count('tray:selected')} ${selOk ? '✓' : '✗'}；`
        + `⑤ 有选中点空格→bead:placed=${h5.count('bead:placed')}/rejected=${h5.count('bead:rejected')} ${placeOk ? '✓' : '✗'}。`
        + `　【旁路对照】P8（tapDesign）同批交互 = PASS*（4/5 可验全过、扩展 S4 出口 ⛔ BD-37）；本条真链同坐标同结果 ⇒ **五类路由在真链下均接通**（差异 = 0）。`
        + `　【为何仍 PASS* 而非 PASS】扩展 S4 出口按 powerups §2.6 布局 A 玩家不可达（BD-37，与 P8 同口径）⇒ 4/5 可验；真链本身无缺道（[Node] 已闭）。`);
}

// ── P10R · 无选中点网格【真链口径】：零落子请求 + 轻提示（同 seed 配对差分）
{
    const runP10r = (tap) => {
        const h = mk({ seed: 'p10r-diff' });
        h.frame();
        // 【T-151 · v2.0 适配】同 P10：取回一颗错位珠构造「可落空格」前置（真链两步式）。
        retrieveOneMisplaced(h);
        const s = h.game.snapshot;
        const i = findEmpty(s);
        const [x, y] = cellXY(s, i);
        if (tap) h.tapChain(x, y); else h.frame();     // 两条腿都推进恰 1 帧（帧号对齐，配对差分成立）
        const sn = h.game.snapshot;
        const cs = cmds(h);
        return {
            i, x, y,
            textSig: cs.filter((c) => c.kind === 'text').map((c) => `${Math.round(c.x)}_${Math.round(c.y)}:${c.text}`).join('|'),
            hint: { text: sn.tapHintText, anchor: sn.tapHintAnchor, row: sn.tapHintRow, col: sn.tapHintCol },
            cols: s.gridCols,
            placed: h.count('bead:placed'), rejected: h.count('bead:rejected'), selected: h.count('tray:selected'),
        };
    };
    const ctl = runP10r(false), tst = runP10r(true);
    const textDiff = ctl.textSig !== tst.textSig;
    const hintOn = Boolean(tst.hint.text);
    const anchored = tst.hint.anchor === 'cell'
        && tst.hint.row === Math.floor(tst.i / tst.cols) && tst.hint.col === tst.i % tst.cols;
    const v = tst.placed === 0 && tst.rejected === 0 && tst.selected === 0 && hintOn && anchored && textDiff
        ? 'PASS' : 'FAIL';
    rec('P10R / BD-34 真链口径 · TC-INP-07R · S2 §8-7 无选中点网格（经 InputManager）', v,
        `【口径】真链点空格中心 (i${tst.i}, ${tst.x.toFixed(1)},${tst.y.toFixed(1)})。零请求 ✓：bead:placed=${tst.placed}、bead:rejected=${tst.rejected}、tray:selected=${tst.selected}（期望 0/0/0）。`
        + `轻提示：tapHintText=「${tst.hint.text}」anchor=${tst.hint.anchor} 锚点=(${tst.hint.row},${tst.hint.col}) 与被点格一致=${anchored}。`
        + `配对差分（同 seed、同帧号，ctl 不点 / tst 点）：**文本签名差异=${textDiff}**（反馈帧载体；非文本签名不变属预期）。`
        + `　【旁路对照】P10（tapDesign）同批交互 = PASS；本条真链同坐标同结果（零请求 + 落点对格 ⇒ 说明点击确实到达 ` + '`_handleTap`' + `，非平凡真）⇒ 真链接通。`);
}

// ── P22R · D1 减弱动效开关【真链口径】：开关路径全程经 InputManager（含 PAUSED 面板按钮）
{
    const h = mk({ levels: [probeLevel(917, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 3) + 1))] });
    h.frame();
    h.tapChain(...GEAR_XY);
    const phaseAfterGear = h.game.phase;                 // 当场拷标（snapshot/phase 是每帧复用对象，见修订 15bis(a)）
    const pausedViaChain = phaseAfterGear === 'paused';
    const lay = pausePanelLayout('normal');
    const btn = lay.buttons.find((b) => b.id === 'toggle-reduce-motion');
    if (btn) h.tapChain(...panelCenter(btn));
    const on = h.game.snapshot.reduceMotion === true;
    const raw = String(h.storage.get(h.saveKey) ?? '');
    const persisted = /"reduceMotion":true/.test(raw);
    // 二次装配回显（原始 services，同样走真链；对照 P22 的 stepGame 旁路铺场）
    const plat = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const shared = plat.createStorage();
    const mkSvc = (seed) => ({ events: new fw.EventBus(), input: new fw.InputManager(), audio: new fw.AudioScheduler(new fw.NullAudioBackend()), storage: shared, rng: fw.createRng(seed), viewport: new fw.Viewport(750, 1334), assets: new fw.NullAssetProvider(), platform: plat.info, rewardedAd: plat.createRewardedAdProvider() });
    const chainRaw = (g, svc, dx, dy) => {
        const p = { x: 0, y: 0 };
        svc.viewport.designToScreen(p, dx, dy);
        svc.input.beginFrame();
        svc.input.push({ id: 1, x: p.x, y: p.y, phase: 'down', time: 1 });
        svc.input.push({ id: 1, x: p.x, y: p.y, phase: 'up', time: 1 });
        g.update(1 / 60);
        svc.input.endFrame(1 / 60);
    };
    const d1lvl = () => [probeLevel(920, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))];
    const g1 = new BeadsGame({ saveKey: 'wxgame.beads.reverify.d1c', levels: d1lvl() });
    const vv1 = mkSvc('d1c'); g1.init(vv1); chainRaw(g1, vv1, ...GEAR_XY);
    const b1 = pausePanelLayout('normal').buttons.find((b) => b.id === 'toggle-reduce-motion');
    if (b1) chainRaw(g1, vv1, ...panelCenter(b1));
    const g2 = new BeadsGame({ saveKey: 'wxgame.beads.reverify.d1c', levels: d1lvl() });
    const vv2 = mkSvc('d1cb'); g2.init(vv2); stepGame(g2, vv2.input);
    const echo = g2.snapshot.reduceMotion === true;
    const v = pausedViaChain && on && persisted && echo ? 'PASS*' : 'FAIL';
    rec('P22R / BD-34 真链口径 · TC-INP-08R/§8-8 · D1 减弱动效开关（经 InputManager）', v,
        `【口径】开关路径全程真链：PLAYING 真链点齿轮 ⇒ phase=${phaseAfterGear}（期望 paused，${pausedViaChain ? '✓' : '✗'}）→ PAUSED 真链点「toggle-reduce-motion」中心 ⇒ snapshot.reduceMotion=${on}（期望 true）。`
        + `落档含 "reduceMotion":true=${persisted}；二次装配（原始 services，同样真链）回显 reduceMotion=${echo}。`
        + `　【BD-34 要点】此路径原为 ` + '`tapDesign`' + ` 旁路；改真链后若相位路由未接通（旧 BD-34），`
        + '`h.tapChain(panelCenter(btn))` 会读不到 justDown ⇒ reduceMotion 保持 false ⇒ 本条 FAIL。'
        + `P22 旁路口径 = PASS*（开关生效 + 三通道退静态）；本条额外证明**开关本身经真链可达**（两口径断言同一结果）。`
        + `　道次限制：三通道「退静态」的逐帧断言仍由 P22（旁路铺场）覆盖，本条不复测；真实观感属 [Cocos]/[人] ⇒ 记 PASS*。`);
}

// ── P27a · PAUSED 真链门禁（齿轮入 / 面板外零响应 / 面板按钮出）
{
    const h = mk(); h.frame();
    h.tapChain(...GEAR_XY);
    // 全程**当场拷标量**（`snapshot`/`phase` 是每帧复用对象；晚读会拿到后续帧的态 —— 修订 15bis(a) 同族陷阱）
    const phaseIn = h.game.phase, pausedCount = h.count('game:paused');
    const inPaused = phaseIn === 'paused' && pausedCount === 1;
    const before = h.emitted.length;
    h.tapChain(...slotXY(0));                    // 面板外（托盘）——真链
    h.tapChain(...cellXY(h.game.snapshot, 0));   // 面板外（棋盘）——真链
    const outsideEvents = h.emitted.length - before;
    const stillPaused = h.game.phase === 'paused';
    const resume = pausePanelLayout('normal').buttons.find((b) => b.id === 'resume');
    h.tapChain(...panelCenter(resume));
    const phaseOut = h.game.phase, resumedCount = h.count('game:resumed');
    const outPlaying = phaseOut === 'playing' && resumedCount === 1;
    const v = inPaused && outsideEvents === 0 && stillPaused && outPlaying ? 'PASS' : 'FAIL';
    rec('P27a / BD-34 回归闸门 · TC-INP-08 · S2 §8-8 + §2.3 PAUSED 真链门禁', v,
        `① 入：PLAYING 真链点齿轮 ⇒ phase=${phaseIn}、game:paused=${pausedCount}（期望 paused/1）${inPaused ? '✓' : '✗'}。`
        + `② 面板外负向（正向对照 = ③ 同相位真链可达）：真链点托盘槽 0 与棋盘格 0 ⇒ 事件增量=${outsideEvents}（期望 0）、相位仍 paused=${stillPaused} ⇒ 「遮罩吃掉其余一切」（§2.3 / pause-settings §2.2）。\n`
        + `③ 出：真链点「继续」中心 ⇒ phase=${phaseOut}、game:resumed=${resumedCount}（期望 playing/1）${outPlaying ? '✓' : '✗'}。`
        + `　【与 BD-34 的关系】旧实现 ` + '`_readInput()`' + ` 只在 playing 调用 ⇒ ②③ 的真链点击收不到（面板按钮沦为空壳、齿轮后永久卡死）；本组即该缺陷的回归闸门。`
        + `　【旁路无关】本组不设旁路腿：` + '`_handleTap`' + ` 的相位路由是唯一裁决面，真链与旁路最终落到同一函数；旁路对照读数已由 P8/P22 提供。`);
}

// ── P27b · LEVEL_CLEAR 真链门禁（面板外零响应 / 「下一关」推进）
{
    const h = mk({ levels: [probeLevel(950, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1)), probeLevel(951, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.frame();
    const filled = fillBoard(h);          // 装配前置（合法）
    // 【T-151】结算面板有延迟入场门（CLEAR_PANEL_DELAY_MS=WAVE_MS=800ms，裁定 1）⇒ 只等 15 帧
    // 点面板按钮永远无效（hitTest 恒无命中）⇒ 假 FAIL。等足延迟门再交互。
    for (let f = 0; f < Math.ceil(T.WAVE_MS / 1000 / (1 / 60)) + 10; f++) h.frame();
    const phase0 = h.game.phase, li0 = h.game.levelIndex;
    const before = h.emitted.length;
    h.tapChain(...OUTSIDE_PANEL);             // 面板外——真链
    const outsideEvents = h.emitted.length - before;
    const stillClear = h.game.phase === 'level-clear' && h.game.levelIndex === li0;
    const next = clearPanelLayout({ lastLevel: false }).buttons.find((b) => b.id === 'next');
    h.tapChain(...panelCenter(next));         // 真链点「下一关」
    const advanced = h.game.phase === 'playing' && h.game.levelIndex === li0 + 1;
    const v = filled && phase0 === 'level-clear' && outsideEvents === 0 && stillClear && advanced ? 'PASS' : 'FAIL';
    rec('P27b / BD-34 回归闸门 · TC-INP-11 · S2 §8-8b LEVEL_CLEAR 真链门禁', v,
        `装配（前置）+ 真链（判据主体）：填满可填格=${filled} ⇒ phase=${phase0}（期望 level-clear）、levelIndex=${li0}。`
        + `① 面板外负向：真链点 (${OUTSIDE_PANEL[0]},${OUTSIDE_PANEL[1]}) ⇒ 事件增量=${outsideEvents}（期望 0）、相位/关卡号不变=${stillClear}。\n`
        + `② 正向：真链点「下一关」中心 ⇒ phase=${h.game.phase}（期望 playing）、levelIndex ${li0}→${h.game.levelIndex}（期望 ${li0 + 1}）${advanced ? '✓' : '✗'}。`
        + `　【判据归属】` + '`input-control §8-8b`' + `（**WXG-T-115 已定稿落盘**，含完整按钮集「下一关 / 去冲刺」；本组为**主按钮**腿，次按钮「去冲刺」见 P27e）⇒ 对应用例 ` + '`test-cases.md §A4b` TC-INP-11' + `。`
        + `　【BD-34】旧实现下 ①② 的真链点击均收不到 ⇒ 本组为回归闸门。`);
}

// ── P27c · GAME_OVER 真链门禁（面板外零响应 / 「重试」整关重置）
{
    const h = mk({ levels: [probeLevel(952, 6, 5, 180, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.frame();
    const bootFp = fpCells(h.game.snapshot);   // 【T-151】v2.0 重试 = 恢复初始错位布置 ⇒ 需 BOOT 基线指纹
    let frames = 0;
    for (; frames < 60 * 190 && h.game.phase === 'playing'; frames++) h.frame();
    for (let f = 0; f < 15; f++) h.frame();   // 等失败面板入场
    const phase0 = h.game.phase;
    const before = h.emitted.length;
    h.tapChain(...OUTSIDE_PANEL);             // 面板外——真链
    const outsideEvents = h.emitted.length - before;
    const stillOver = h.game.phase === 'game-over';
    const retry = failPanelLayout(true).buttons.find((b) => b.id === 'retry');
    h.tapChain(...panelCenter(retry));        // 真链点「重试」
    const s = h.game.snapshot;
    // 【T-151 · 判据时效性】「filledNow===0（整关重置）」是 v1.2 旧语义：v2.0 重试 = **恢复初始错位布置**
    // （timer-gameover §8-6 v1.3）⇒ 棋盘恢复 BOOT 基线指纹（全满、错位态复原），不是清空。
    const filledNow = s.cells.filter((c) => !c.void && c.state === 'filled').length;
    const reset = h.game.phase === 'playing' && fpCells(s) === bootFp;
    const v = phase0 === 'game-over' && outsideEvents === 0 && stillOver && reset ? 'PASS' : 'FAIL';
    rec('P27c / BD-34 回归闸门 · TC-INP-12 · S2 §8-8c GAME_OVER 真链门禁', v,
        `装配（前置）：推时钟至归零（${frames} 帧）⇒ phase=${phase0}（期望 game-over）。`
        + `① 面板外负向：真链点 (${OUTSIDE_PANEL[0]},${OUTSIDE_PANEL[1]}) ⇒ 事件增量=${outsideEvents}（期望 0）、相位不变=${stillOver}。\n`
        + `② 正向：真链点「重试」中心 ⇒ phase=${h.game.phase}（期望 playing）、filled=${filledNow} + 棋盘指纹=BOOT 基线（v2.0 = 恢复初始错位布置，timer §8-6 v1.3；**非 v1.2「清空」旧语义**）${reset ? '✓' : '✗'}。`
        + `　【判据归属】` + '`input-control §8-8c`' + `（**WXG-T-115 已定稿落盘**；本组为**普通局主按钮「重试本关」**腿——普通局次按钮「续时」见 P27f、冲刺局子分支「再来一局/返回关卡」见 P27g/h）⇒ 对应用例 ` + '`test-cases.md §A4b` TC-INP-12' + `。`
        + `　【BD-34】旧实现下 ①② 真链点击均收不到。`);
}

// ── P27d · FINISH 真链门禁（面板外零响应 / 「重玩第 1 关」回 L1）
{
    const h = mk({ levels: [probeLevel(953, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.frame();
    const filled = fillBoard(h);          // 装配前置（合法）：单关填满 ⇒ level-clear(lastLevel)
    for (let f = 0; f < Math.ceil(T.WAVE_MS / 1000 / (1 / 60)) + 10; f++) h.frame();   // 【T-151】等足 800ms 延迟门
    const phaseClear = h.game.phase;
    const next = clearPanelLayout({ lastLevel: true }).buttons.find((b) => b.id === 'next');
    h.tapChain(...panelCenter(next));         // 真链点「查看结果」⇒ FINISH
    for (let f = 0; f < 15; f++) h.frame();   // 等通关画面入场
    const phaseFinish = h.game.phase;
    const before = h.emitted.length;
    h.tapChain(...OUTSIDE_PANEL);             // 面板外——真链
    const outsideEvents = h.emitted.length - before;
    const stillFinish = h.game.phase === 'finish';
    const replay = finishPanelLayout(h.game.levelCount).buttons.find((b) => b.id === 'replay');
    h.tapChain(...panelCenter(replay));       // 真链点「重玩第 1 关」
    const back = h.game.phase === 'playing' && h.game.levelIndex === 0;
    const v = filled && phaseClear === 'level-clear' && phaseFinish === 'finish' && outsideEvents === 0 && stillFinish && back ? 'PASS' : 'FAIL';
    rec('P27d / BD-34 回归闸门 · TC-INP-13 · S2 §8-8d FINISH 真链门禁', v,
        `装配（前置）：单关填满=${filled} ⇒ phase=${phaseClear}；真链点「查看结果」⇒ phase=${phaseFinish}（期望 finish）。`
        + `① 面板外负向：真链点 (${OUTSIDE_PANEL[0]},${OUTSIDE_PANEL[1]}) ⇒ 事件增量=${outsideEvents}（期望 0）、相位不变=${stillFinish}。\n`
        + `② 正向：真链点「重玩第 1 关」中心 ⇒ phase=${h.game.phase}（期望 playing）、levelIndex=${h.game.levelIndex}（期望 0）${back ? '✓' : '✗'}。`
        + `　【判据归属】` + '`input-control §8-8d`' + `（**WXG-T-115 已定稿落盘**，含完整按钮集「重玩第 1 关 / 去冲刺」；本组为**主按钮**腿，次按钮「去冲刺」见 P27i）⇒ 对应用例 ` + '`test-cases.md §A4b` TC-INP-13' + `。`
        + `　【BD-34】旧实现下 ①② 真链点击均收不到。`);
}

// ═══════════ P27e..i · 次按钮真链孪生（WXG-T-116 · `input-control §8-8b/8c/8d` 次按钮子句）
/**
 * 上游 `WXG-T-115` 已把 `8b/8c/8d` 定稿落盘，条文各含**完整按钮集**（不止主按钮），且 `8c` 含
 * **冲刺局子分支**（`_mode==='sprint'`：再来一局 / 返回关卡）。P27b/c/d 只覆盖了各相位**主按钮** +
 * 面板外负向 ⇒ 本节 5 条补**次按钮**真链孪生（逐条与 `test-cases.md §A4b` 的 `TC-INP-11b/12b/12c/12d/13b` 1:1）。
 * 纪律：真链驱动（`tapChain`）同 P27a..d；**正负并列**（面板外死区 `(30,53)` ⇒ 事件增量 0 ⇒ 负向非平凡真）。
 * 判定**不放宽**：任一步与 `input-control §8-8b/8c/8d` 现文不符即 FAIL；真机广告行为 `[R]` ⛔（见 P27f）。
 */
/** 装配前置：进入冲刺局（公开 API `startSprint`）并推倒计时归零 ⇒ `game-over`（冲刺结算，`_mode='sprint'`）。 */
function enterSprintGameOver(levelId) {
    const h = mk({ levels: [probeLevel(levelId, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.frame();
    h.game.startSprint();                                  // 装配前置（判据主体 = 面板按钮真链，非本调用）
    let frames = 0;
    for (; frames < 60 * 130 && h.game.phase === 'playing'; frames++) h.frame();
    for (let f = 0; f < 15; f++) h.frame();                // 等冲刺结算面板入场（§5 入 200ms）
    return { h, frames };
}

// ── P27e · `8b` 次按钮「去冲刺」真链孪生（LEVEL_CLEAR 副钮 ⇒ 进冲刺模式）
{
    const h = mk({ levels: [probeLevel(954, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1)), probeLevel(955, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.frame();
    const filled = fillBoard(h);               // 装配前置（合法）
    for (let f = 0; f < Math.ceil(T.WAVE_MS / 1000 / (1 / 60)) + 10; f++) h.frame();   // 【T-151】等足 800ms 延迟门
    const phase0 = h.game.phase, mode0 = h.game.snapshot.mode, li0 = h.game.levelIndex;
    const before = h.emitted.length;
    h.tapChain(...OUTSIDE_PANEL);              // 面板外——真链
    const outsideEvents = h.emitted.length - before;
    const stillClear = h.game.phase === 'level-clear' && h.game.levelIndex === li0 && h.game.snapshot.mode === 'normal';
    const sprint = clearPanelLayout({ lastLevel: false }).buttons.find((b) => b.id === 'sprint');
    h.tapChain(...panelCenter(sprint));        // 真链点副钮「▶ 去冲刺」
    const phaseOut = h.game.phase, modeOut = h.game.snapshot.mode;
    const entered = phaseOut === 'playing' && modeOut === 'sprint';
    const v = filled && phase0 === 'level-clear' && mode0 === 'normal' && outsideEvents === 0 && stillClear && entered ? 'PASS' : 'FAIL';
    rec('P27e · TC-INP-11b · S2 §8-8b 次按钮「去冲刺」真链孪生（LEVEL_CLEAR 副钮 ⇒ 进冲刺）', v,
        `装配（前置）：填满可填格=${filled} ⇒ phase=${phase0}、mode=${mode0}、levelIndex=${li0}（期望 level-clear/normal）。`
        + `① 面板外负向：真链点 (${OUTSIDE_PANEL[0]},${OUTSIDE_PANEL[1]}) ⇒ 事件增量=${outsideEvents}（期望 0）、相位/模式/关卡号不变=${stillClear}（负向非平凡真：点击确已到达 ` + '`_handleTap`' + `）。\n`
        + `② 正向（判据主体 · §8-8b 次按钮）：真链点结算面板副钮「▶ 去冲刺」中心 ⇒ phase=${phaseOut}（期望 playing）、mode=${modeOut}（期望 sprint）${entered ? '✓' : '✗'}。`
        + `　【按钮集来源】` + '`ux-spec §4` 流转表 `LEVEL_CLEAR` 行「下一关 / 去冲刺*(U1)」+ §3.4 双钮；实现锚点 `clear-panel.ts` `ClearPanelAction=\'next\'|\'sprint\'` + `beads-game.ts case \'level-clear\'` ⇒ `_startSprintRun()`。'
        + `　【与 P27b 的关系】P27b = 同判据的**主按钮**「下一关」腿；本条 = **次按钮**腿（1:1 孪生）。`);
}

// ── P27f · `8c` 普通局次按钮「续时」真链孪生（真链点 revive + MockRewardedAdProvider 发奖腿）
{
    const h = mk({ levels: [probeLevel(956, 6, 5, 180, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.frame();
    let frames = 0;
    for (; frames < 60 * 190 && h.game.phase === 'playing'; frames++) h.frame();
    for (let f = 0; f < 15; f++) h.frame();    // 等失败面板入场
    const phase0 = h.game.phase, remaining0 = h.game.snapshot.remaining;
    const revive = failPanelLayout(true).buttons.find((b) => b.id === 'revive');
    h.tapChain(...panelCenter(revive));        // 真链点主钮「▶ +N 秒 继续本关」
    const watching = h.game.snapshot.watchingAd;             // 期望 true（Mock autoSettle=null ⇒ 等回调）
    const stillOver = h.game.phase === 'game-over';
    const ad = h.services.rewardedAd;
    const driveable = typeof ad?.settle === 'function';      // harness 替身可发奖（非真机广告）
    if (driveable) ad.settle('complete');                    // 驱动发奖腿
    h.frame();                                               // 刷新快照
    const phaseOut = h.game.phase, modeOut = h.game.snapshot.mode;
    const remaining1 = h.game.snapshot.remaining, revived = h.game.snapshot.revived;
    const bonus = remaining1 - remaining0;
    const continued = phaseOut === 'playing' && modeOut === 'normal' && revived && bonus === T.REVIVE_BONUS_SEC;
    const reviveSfx = h.played.filter((id) => /revive/.test(String(id))).length;
    const v = phase0 === 'game-over' && watching && stillOver && driveable && continued ? 'PASS*' : 'FAIL';
    rec('P27f · TC-INP-12b · S2 §8-8c 普通局次按钮「续时」真链孪生（+ MockRewardedAdProvider 发奖腿）', v,
        `装配（前置）：推时钟至归零（${frames} 帧）⇒ phase=${phase0}（期望 game-over）、remaining=${remaining0}。`
        + `① 按钮腿（真链·判据主体）：真链点主钮「▶ +${T.REVIVE_BONUS_SEC}秒 继续本关」中心 ⇒ snapshot.watchingAd=${watching}（期望 true = 已发起激励视频、相位仍 game-over 等回调）、相位不变=${stillOver} ⇒ 与 ` + '`ux-spec §4`' + ` 行「点『+N 秒继续本关』⇒ GAME_OVER（等回调）」一致。\n`
        + `② 发奖腿（harness 替身驱动）：` + '`MockRewardedAdProvider.settle(\'complete\')`' + ` 可驱动=${driveable} ⇒ ` + '`onRewarded`' + ` → ` + '`_continueFromReward()`' + ` ⇒ phase=${phaseOut}（期望 playing）、mode=${modeOut}（期望 normal）、remaining ${remaining0}→${remaining1}（Δ=${bonus}s，期望 =` + ` REVIVE_BONUS_SEC=${T.REVIVE_BONUS_SEC}s）、snapshot.revived=${revived}（期望 true）；revive 音请求数=${reviveSfx}。`
        + `　【可达性判定（实测）】**按钮腿 = 真链可达且成立**；**发奖腿 = 由 harness 替身（` + '`MockRewardedAdProvider(null)`' + `，autoSettle 关 ⇒ 需显式 ` + '`settle()`' + `）驱动** ⇒ 结构链路成立。`
        + `　【⛔ 边界 · 不记 PASS 亦不记 FAIL 的部分】真机激励视频**拉起 / 发奖 / 「未看完·skip·error」三分支**属 ` + '`[R]`' + `（无 AppID / 无真机）⇒ ⛔；本条只证「按钮→请求→发奖→续打」的**结构链路**（` + '`test-cases.md` TC-TIMER-12' + ` 取证纪律：mock 必然 complete，**不可作真机广告证据**）⇒ 故记 **PASS\\*** 而非 PASS。`
        + `　【与 §21 未闭项无关】本条不触碰 GAP-06 死局（续时只加时不清托盘，` + '`ux-spec §4`' + ` 尾注已警示）。`);
}

// ── P27g · `8c` 冲刺局子分支次按钮「再来一局」真链孪生
{
    const { h, frames } = enterSprintGameOver(957);
    const phase0 = h.game.phase, mode0 = h.game.snapshot.mode;
    const before = h.emitted.length;
    h.tapChain(...OUTSIDE_PANEL);              // 面板外——真链
    const outsideEvents = h.emitted.length - before;
    const stillOver = h.game.phase === 'game-over' && h.game.snapshot.mode === 'sprint';
    const again = sprintSettleLayout().buttons.find((b) => b.id === 'again');
    h.tapChain(...panelCenter(again));         // 真链点冲刺结算主钮「再来一局」
    const phaseOut = h.game.phase, modeOut = h.game.snapshot.mode;
    const restarted = phaseOut === 'playing' && modeOut === 'sprint';
    const v = phase0 === 'game-over' && mode0 === 'sprint' && outsideEvents === 0 && stillOver && restarted ? 'PASS' : 'FAIL';
    rec('P27g · TC-INP-12c · S2 §8-8c 冲刺局子分支次按钮「再来一局」真链孪生', v,
        `装配（前置）：` + '`startSprint()`' + ` + 推时钟至归零（${frames} 帧）⇒ phase=${phase0}（期望 game-over）、mode=${mode0}（期望 sprint = 冲刺结算，` + '`ux-spec §3.5`' + ` 左列「不出现续时」）。`
        + `① 面板外负向：真链点 (${OUTSIDE_PANEL[0]},${OUTSIDE_PANEL[1]}) ⇒ 事件增量=${outsideEvents}（期望 0）、相位/模式不变=${stillOver}。\n`
        + `② 正向（判据主体 · §8-8c 冲刺局子分支）：真链点冲刺结算主钮「再来一局」中心 ⇒ phase=${phaseOut}（期望 playing）、mode=${modeOut}（期望 sprint）${restarted ? '✓' : '✗'}。`
        + `　【按钮集来源】` + '`ux-spec §3.5` 左列双钮「再来一局 / 返回关卡」；实现锚点 `sprint-settle.ts` `SprintSettleAction=\'again\'|\'back\'` + `beads-game.ts case \'game-over\'`(`_mode===\'sprint\'`) ⇒ `retryLevel()`。'
        + `　【与 P27c 的关系】P27c 走**普通局** ` + '`failPanelLayout`' + `（重试/续时）；本条走**冲刺局** ` + '`sprintSettleLayout`' + `（再来一局/返回关卡）——**不同按钮集、同一 ` + '`case \'game-over\'`' + ` 分支**（` + '`WXG-T-115`' + ` 修正 1 补齐的缺口）。`);
}

// ── P27h · `8c` 冲刺局子分支次按钮「返回关卡」真链孪生
{
    const { h, frames } = enterSprintGameOver(958);
    const phase0 = h.game.phase, mode0 = h.game.snapshot.mode;
    const before = h.emitted.length;
    h.tapChain(...OUTSIDE_PANEL);              // 面板外——真链
    const outsideEvents = h.emitted.length - before;
    const stillOver = h.game.phase === 'game-over' && h.game.snapshot.mode === 'sprint';
    const bk = sprintSettleLayout().buttons.find((b) => b.id === 'back');
    h.tapChain(...panelCenter(bk));            // 真链点冲刺结算副钮「返回关卡」
    const phaseOut = h.game.phase, modeOut = h.game.snapshot.mode;
    const toNormal = phaseOut === 'playing' && modeOut === 'normal';
    const v = phase0 === 'game-over' && mode0 === 'sprint' && outsideEvents === 0 && stillOver && toNormal ? 'PASS' : 'FAIL';
    rec('P27h · TC-INP-12d · S2 §8-8c 冲刺局子分支次按钮「返回关卡」真链孪生', v,
        `装配（前置）：` + '`startSprint()`' + ` + 推时钟至归零（${frames} 帧）⇒ phase=${phase0}（期望 game-over）、mode=${mode0}（期望 sprint）。`
        + `① 面板外负向：真链点 (${OUTSIDE_PANEL[0]},${OUTSIDE_PANEL[1]}) ⇒ 事件增量=${outsideEvents}（期望 0）、相位/模式不变=${stillOver}。\n`
        + `② 正向（判据主体 · §8-8c 冲刺局子分支）：真链点冲刺结算副钮「返回关卡」中心 ⇒ phase=${phaseOut}（期望 playing）、mode=${modeOut}（期望 normal）${toNormal ? '✓' : '✗'}。`
        + `　【出口语义】` + '`beads-game.ts case \'game-over\'`' + `（sprint 分支）：` + '`settle===\'back\'` ⇒ `startNormal()`' + `（离开冲刺回普通战役，` + '`ux-spec §4` / §3.5 左列副钮）。');
}

// ── P27i · `8d` 次按钮「去冲刺」真链孪生（FINISH 副钮 ⇒ 进冲刺模式）
{
    const h = mk({ levels: [probeLevel(959, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1))] });
    h.frame();
    const filled = fillBoard(h);               // 装配前置（合法）：单关填满 ⇒ level-clear(lastLevel)
    for (let f = 0; f < Math.ceil(T.WAVE_MS / 1000 / (1 / 60)) + 10; f++) h.frame();   // 【T-151】等足 800ms 延迟门
    const phaseClear = h.game.phase;
    const next = clearPanelLayout({ lastLevel: true }).buttons.find((b) => b.id === 'next');
    h.tapChain(...panelCenter(next));          // 真链点「查看结果」⇒ FINISH
    for (let f = 0; f < 15; f++) h.frame();    // 等通关画面入场
    const phaseFinish = h.game.phase;
    const before = h.emitted.length;
    h.tapChain(...OUTSIDE_PANEL);              // 面板外——真链
    const outsideEvents = h.emitted.length - before;
    const stillFinish = h.game.phase === 'finish';
    const sprint = finishPanelLayout(h.game.levelCount).buttons.find((b) => b.id === 'sprint');
    h.tapChain(...panelCenter(sprint));        // 真链点副钮「▶ 去冲刺」
    const phaseOut = h.game.phase, modeOut = h.game.snapshot.mode;
    const entered = phaseOut === 'playing' && modeOut === 'sprint';
    const v = filled && phaseClear === 'level-clear' && phaseFinish === 'finish' && outsideEvents === 0 && stillFinish && entered ? 'PASS' : 'FAIL';
    rec('P27i · TC-INP-13b · S2 §8-8d 次按钮「去冲刺」真链孪生（FINISH 副钮 ⇒ 进冲刺）', v,
        `装配（前置）：单关填满=${filled} ⇒ phase=${phaseClear}；真链点「查看结果」⇒ phase=${phaseFinish}（期望 finish）。`
        + `① 面板外负向：真链点 (${OUTSIDE_PANEL[0]},${OUTSIDE_PANEL[1]}) ⇒ 事件增量=${outsideEvents}（期望 0）、相位不变=${stillFinish}。\n`
        + `② 正向（判据主体 · §8-8d 次按钮）：真链点通关画面副钮「▶ 去冲刺」中心 ⇒ phase=${phaseOut}（期望 playing）、mode=${modeOut}（期望 sprint）${entered ? '✓' : '✗'}。`
        + `　【按钮集来源】` + '`ux-spec §3.6` / §4 行 `FINISH | 去冲刺* / 重玩第 1 关`；实现锚点 `finish-panel.ts` `FinishPanelAction=\'replay\'|\'sprint\'` + `beads-game.ts case \'finish\'` ⇒ `_startSprintRun()`。'
        + `　【与 P27d 的关系】P27d = 同判据的**主按钮**「重玩第 1 关」腿；本条 = **次按钮**腿（1:1 孪生）。`);
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
// 【T-151】fpCells/fpTray/heldOf 已上移至 helpers 区（probeLevel 之后）—— 此处原定义删除避免重复声明。
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
 * 【T-151 · v2.0 正确落子】取回错位珠（环场景可能需取回多颗）直到托盘珠能落到「底色相同」的
 * 空格并落成。旧夹具按「开局托盘有珠 + 棋盘有空格」的 v1.2 模型写 ⇒ v2.0（开局全满 + 托盘恒空）
 * 下恒不可用。返回是否落成（供前置自检）。
 */
function placeOneCorrect(h, maxSteps = 40) {
    for (let k = 0; k < maxSteps; k++) {
        const s = h.game.snapshot;
        const held = s.traySlots.findIndex((x) => x.state !== 'free');
        if (held >= 0) {
            const color = s.traySlots[held].colorIdx;
            let target = -1;
            for (let j = 0; j < s.cells.length; j++) {
                const c = s.cells[j];
                if (!c.void && c.state === 'empty' && c.colorIdx === color) { target = j; break; }
            }
            if (target >= 0) {
                h.tapChain(...slotXY(held));
                h.tapChain(...cellXY(h.game.snapshot, target));
                return h.game.snapshot.traySlots[held].state === 'free';
            }
        }
        if (retrieveOneMisplaced(h) < 0) return false;
    }
    return false;
}
/**
 * 【T-151 · v2.0 通用前置】给 harness 造出 v1.2 时代「托盘有珠 + 存在底色==珠色的空格」前置，
 * 全部走真链合法操作（两步式取回错位珠；环场景多取几颗必成对）。**不灌白盒珠**
 * （`giveTrayBead` 绕过校验，仅 P21 类白盒段按修订 20 注明使用）。返回 `{slot, cell}` 或 null。
 * 供 P5 音频段等 30 处「开局托盘有珠」假设统一换用。
 */
function primePlaceable(h, maxSteps = 40) {
    for (let k = 0; k < maxSteps; k++) {
        const s = h.game.snapshot;
        const slot = s.traySlots.findIndex((x) => x.state !== 'free');
        if (slot >= 0) {
            const cell = firstEmptyOf(s, s.traySlots[slot].colorIdx);
            if (cell >= 0) return { slot, cell };
        }
        if (retrieveOneMisplaced(h) < 0) return null;
    }
    return null;
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
// 【修订 46 · WXG-T-151】修订面 = **v2.0 适配有足迹的全部组**（整轮复跑）。分桶为最高优先：
//   P4/P7（T-118）、P8/P10/P5·A05-14（T-097）、P20（T-098）、P8R/P10R/P27a..d（T-114）、
//   P27e/P27i（T-116）、P28c/f/g/i/j（T-099）成员移入本桶（沿 T-118 移实体例，不双计）；
//   预期值口径正本仍是各历史轮现文，但本轮实测属 v2.0 夹具轮。无 T-151 足迹的组（P1/P5 其余/P14~P16/
//   P23~P26/P22R/P27f..h/P28a/b/d/e/h/P29a/b）保留原桶。
const T151_ID_RE = /^(P2|P3|P4|P6|P7|P8|P9|P10|P11|P12|P13|P17|P18|P19|P20|P21|P22)\b|^P8R\b|^P10R\b|^P27[abdei]\b|^P28[cfgij]\b|^P5\/A05-(01|04|07|14|18|23)\b/;
const inT151 = (id) => T151_ID_RE.test(id);
const T114_PREFIXES = ['P8R', 'P10R', 'P22R', 'P27a', 'P27b', 'P27c', 'P27d'];
const T116_PREFIXES = ['P27e', 'P27f', 'P27g', 'P27h', 'P27i'];
const T099_PREFIXES = ['P28a', 'P28b', 'P28c', 'P28d', 'P28e', 'P28f', 'P28g', 'P28h', 'P28i', 'P28j', 'P29a', 'P29b'];
const inT114 = (id) => !inT151(id) && T114_PREFIXES.some((p) => id.startsWith(p));
const inT116 = (id) => !inT151(id) && T116_PREFIXES.some((p) => id.startsWith(p));
const inT099 = (id) => !inT151(id) && T099_PREFIXES.some((p) => id.startsWith(p));
const inT118 = (id) => !inT151(id) && (/^P4\b/.test(id) || /^P7\b/.test(id));
const inT098 = (id) => !inT151(id) && !inT114(id) && !inT116(id) && !inT118(id) && !inT099(id) && (/^P20\b/.test(id) || /^P26\b/.test(id));
const inT097 = (id) => !inT151(id) && !inT114(id) && !inT116(id) && !inT118(id) && !inT099(id) && (/^P8\b/.test(id) || /^P10\b/.test(id) || /^P5\/A05-14\b/.test(id));
const tallyT151 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT114 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT116 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT118 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT099 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT098 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyT097 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
const tallyRest2 = { PASS: 0, 'PASS*': 0, FAIL: 0, '⛔': 0 };
for (const r of out) {
    const bucket = inT151(r.id) ? tallyT151 : inT099(r.id) ? tallyT099 : inT118(r.id) ? tallyT118 : inT116(r.id) ? tallyT116 : inT114(r.id) ? tallyT114 : inT098(r.id) ? tallyT098 : inT097(r.id) ? tallyT097 : tallyRest2;
    bucket[norm(r.verdict)]++;
}
console.log('\n================ 探针汇总（v1.8 轮 · WXG-T-151 修订面 = v2.0 全面适配整轮复跑（见修订 46） · 历史修订面：WXG-T-099 = P28a..j + P29a/b · WXG-T-118 = P4+P7 · WXG-T-116 = P27e..i · WXG-T-114 = P8R/P10R/P22R + P27a..d（成员被 T-151 移入者已除名） ================');
for (const r of out) console.log(`${norm(r.verdict).padEnd(6)} ${r.id}`);
console.log(`\n总计数：${sum(tally)}（共 ${out.length} 组；含 P26-N 负向用例）`);
console.log(`【T-151 修订面 · v2.0 适配复跑（判据/夹具换面，${cntGrp(inT151)} 条；P4/P7、P8/P10/A05-14、P20、P8R/P10R/P27a..d、P27e/i、P28c/f/g/i/j 自原桶移入）】：${sum(tallyT151)}`);
console.log(`【T-096 修订面 · P5 段（${cntGrp((id) => id.startsWith('P5'))} 条）】：${sum(tallyP5)}`);
console.log(`【T-118 修订面 · P4+P7（成员已全部移入 T-151，余 ${cntGrp(inT118)} 条）】：${sum(tallyT118)}`);
console.log(`【T-098 修订面 · P26（含 P26-N；P4 已移 T-118→T-151，P20 已移入 T-151，${cntGrp(inT098)} 条）】：${sum(tallyT098)}`);
console.log(`【T-097 修订面 · P8/P10 + P5/A05-14（成员已全部移入 T-151，余 ${cntGrp(inT097)} 条）】：${sum(tallyT097)}`);
console.log(`【T-114 修订面 · P22R（P8R/P10R/P27a..d 已移入 T-151，${cntGrp(inT114)} 条）】：${sum(tallyT114)}`);
console.log(`【T-116 修订面 · P27f..h（P27e/P27i 已移入 T-151，${cntGrp(inT116)} 条）】：${sum(tallyT116)}`);
console.log(`【T-099 修订面 · P28a/b/d/e/h + P29a/b（P28c/f/g/i/j 已移入 T-151，${cntGrp(inT099)} 条）】：${sum(tallyT099)}`);
console.log(`【未随本轮复核 · 其余 ${cntGrp((id) => !inT151(id) && !inT098(id) && !inT097(id) && !inT114(id) && !inT116(id) && !inT118(id) && !inT099(id))} 组沿用各自上一轮预期值（本轮仍随整轮重跑，零改动）】：${sum(tallyRest2)}`);
console.log('　↑ 各段计数不得合并解读：T-151 段 = 本轮 v2.0 夹具/判据换面组（预期值正本仍沿各历史轮现文）；P5 段沿 T-096 口径（A05-14 双计入 P5 总数），P26 沿 T-098 口径，P22R/P27f..h 沿 T-114/T-116 口径，P28a/b/d/e/h + P29a/b 沿 T-099 口径，其余组沿 v1.1 口径。');
console.log(`时间戳：${new Date().toISOString()}   Node ${process.version}`);
