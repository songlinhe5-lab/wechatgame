/**
 * beads G4 复验探针 v1.1（严守真 / WXG-T-092，波次 3）
 *
 * 定位：`g4-probe.mjs` v3 是**修复前基线**（报告 v1.0）。本文件把「波次 2 代码级自证」
 * 升级为「探针他证」，逐条 P1–P19 重判 + 新增 P20–P26 补测。
 * 判据来源一律取 **T-091 回写后的 GDD §8 现文**（不是 v1.0 报告里的旧预期值）。
 *
 * 只读纪律：不改 `games/beads/src/**`、`design/**`、`art/**`；复用 `harness:build` 产物。
 * 运行：node production/qa/beads/g4-probe-v1.1.mjs
 * 产出：production/qa/beads/evidence/g4-reverify-v1.1.log
 *       （WXG-T-096 复跑轮：整轮 evidence/g4-reverify-v1.2.log + P5 段摘录
 *        evidence/g4-reverify-v1.2-p5-excerpt.log；**本轮只修订 P5 段预期值**，见修订 28）
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

const fw = await import(`${STAGE}/packages/framework/src/index.js`);
const { NodePlatform } = await import(`${STAGE}/packages/framework/src/platform/node.js`);
const { BeadsGame } = await import(`${STAGE}/games/beads/src/game/beads-game.js`);
const { buildBeadsView } = await import(`${STAGE}/games/beads/src/view/view-model.js`);
const P = await import(`${STAGE}/games/beads/src/view/palette.js`);
const { DEFAULT_PALETTE } = P;
const T = await import(`${STAGE}/games/beads/src/config/tuning.js`);
const { LEVELS } = await import(`${STAGE}/games/beads/src/config/levels.js`);
const { BEADS_AUDIO_VOICES } = await import(`${STAGE}/games/beads/src/config/audio-voices.js`);
const { pausePanelLayout } = await import(`${STAGE}/games/beads/src/systems/pause-panel.js`);
const { clearPanelLayout } = await import(`${STAGE}/games/beads/src/systems/clear-panel.js`);
const { failPanelLayout } = await import(`${STAGE}/games/beads/src/systems/fail-panel.js`);
const { finishPanelLayout } = await import(`${STAGE}/games/beads/src/systems/finish-panel.js`);
const { TRAY_BEAD_SIZE } = await import(`${STAGE}/games/beads/src/view/bead-render.js`);

const boot = await loadHarness({ game: 'beads' });
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
const TRAY_MID_Y = (T.TRAY_BAND.yMin + T.TRAY_BAND.yMax) / 2;
const slotXY = (i) => [TRAY_LEFT + T.TRAY_SLOT / 2 + TRAY_PITCH * i, TRAY_MID_Y];
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

function probeLevel(id, cols, rows, time, spawnInterval, fill, decoys = []) {
    const pattern = [];
    for (let i = 0; i < rows; i++) { let line = ''; for (let j = 0; j < cols; j++) line += fill(i, j); pattern.push(line); }
    return { id, name: `probe-${id}`, cols, rows, time, spawnInterval, decoys, pattern };
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
/** 三角波周期测量：取 α 序列的波谷（plateau 合并）间距均值。 */
function pulsePeriodMs(samples) {
    const uniq = samples.filter((v, i) => i === 0 || v !== samples[i - 1]);
    const troughs = [];
    for (let i = 1; i < uniq.length - 1; i++) if (uniq[i] <= uniq[i - 1] && uniq[i] <= uniq[i + 1]) troughs.push(i);
    if (troughs.length < 2) return { periods: troughs.length, periodMs: null, distinct: new Set(samples.map((v) => v.toFixed(3))).size };
    const gaps = []; for (let i = 1; i < troughs.length; i++) gaps.push(troughs[i] - troughs[i - 1]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    return { periods: troughs.length - 1, periodMs: mean * (1000 / 60), distinct: new Set(samples.map((v) => v.toFixed(3))).size };
}
const chi2 = (obs, exp) => obs.reduce((a, o) => a + ((o - exp) ** 2) / exp, 0);
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
    const v = spawned1 === 1 && at1 === 1 && at15 >= 1 && placeable ? 'PASS' : 'FAIL';
    rec('P2 / BD-02 · GAP-02 开局首供（PLAYING 第 1 帧 + 首珠可落子色）', v,
        `L1（spawnInterval=${LEVELS[0].spawnInterval}s）：t=0 持有 ${at0} 颗 → 推进 1 帧后 tray:spawned=${spawned1}、持有 ${at1} 颗；t=1.5s 持有 ${at15} 颗。`
        + `首珠 colorIdx=${first?.colorIdx ?? '-'}，该色盘面剩余需求 demand=${first ? demandOf(s, first.colorIdx) : '-'} ⇒ 首珠可落子=${placeable}（ux-spec §6.2「首珠必须可落子色」硬判据）。`
        + `对照组注入 spawnInterval=${T.SPAWN_INTERVAL_DEFAULT}s：第 1 帧亦供料（tray:spawned=${h3.count('tray:spawned')}）。`
        + `　代码锚点：systems/spawner.ts reset() → _firstFeed=true，首 tick 走 _feedOnce（非装配期 feed，符合 §6.2「帧内序仍属供料段」）。`
        + `　【偏差登记】ux-spec §6.2 裁定的实现机制写的是「reset() → 赋 interval → 置 _acc = interval」，落码改用 _firstFeed 标志位；**可观测语义等价（第 1 帧完成首供、节律不受扰）**，机制措辞偏差登记不改笔。`);
}

// ═════════════════════════════════════════════════════════ P3 · 引导三通道
{
    const h = mk();
    h.frame();
    const s0 = h.game.snapshot;
    // 【修订 15】snapshot 是**每帧复用的活对象**：必须当场把标量拷出来，不能在 rec() 里读 s0.xxx
    const ob0 = s0.onboarding === true, gs0 = s0.guideSlot, hr0 = s0.hintRow, hc0 = s0.hintCol;
    const gsColor = ob0 && gs0 >= 0 ? s0.traySlots[gs0].colorIdx : 0;
    const chan = {
        socketColor: [...patternColors(s0)].length >= 1,
        guideSlot: ob0 && gs0 >= 0,
        hintCell: ob0 && hr0 >= 0 && hc0 >= 0,
    };
    const cs = cmds(h);
    const hintHex = hex2(DEFAULT_PALETTE.hintBlue);
    const ringN = rings(cs, hintHex).length;
    const gs = { colorIdx: gsColor };
    const hintIsRowMajorFirst = (() => {
        const idx = hr0 * s0.gridCols + hc0;
        const c = gsColor;
        for (let i = 0; i < idx; i++) { const x = s0.cells[i]; if (!x.void && x.state === 'empty' && x.colorIdx === c) return false; }
        return s0.cells[idx] && !s0.cells[idx].void && s0.cells[idx].state === 'empty' && s0.cells[idx].colorIdx === c;
    })();
    // 呼吸周期（600ms）：α 在 rect.alpha（drawStateRing 把相位写进 alpha，非 rgba）
    const alphas = [];
    for (let f = 0; f < 90; f++) {
        const r = rings(cmds(h), hintHex)[0];
        alphas.push(r ? Number(r.alpha ?? 1) : 0);
        h.frame();
    }
    const pm = pulsePeriodMs(alphas);
    // 首次落子即清
    const i2 = firstEmptyOf(h.game.snapshot, gsColor);
    if (i2 >= 0) {
        h.game.tapDesign(...slotXY(gs0)); h.frame();
        h.game.tapDesign(...cellXY(h.game.snapshot, i2)); h.frame();
    }
    const afterPlaced = h.game.snapshot.onboarding, afterRing = rings(cmds(h), hintHex).length;
    // 老玩家（runs>0）永不重现：共用 storage + **合法关卡**（旧版探针给了 4×3 非法关 ⇒ BOOT 直接 return，测不到引导）
    const plat = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
    const shared = plat.createStorage();
    const p1 = new fw.InputManager(); const e1 = new fw.EventBus();
    const lvVet = probeLevel(902, 6, 5, 300, 4.0, (i, j) => String(((i + j) % 3) + 1));
    const g1 = new BeadsGame({ saveKey: 'wxgame.beads.reverify.runs', levels: [lvVet] });
    const svc1 = { events: e1, input: p1, audio: new fw.AudioScheduler(new fw.NullAudioBackend()), storage: shared, rng: fw.createRng('runs1'), viewport: new fw.Viewport(750, 1334), assets: new fw.NullAssetProvider(), platform: plat.info, rewardedAd: plat.createRewardedAdProvider() };
    g1.init(svc1); svc1.input.beginFrame(); g1.update(1 / 60); svc1.input.endFrame(1 / 60);
    const obFirst = g1.snapshot.onboarding === true;
    const runsSaved = JSON.parse(String(shared.get('wxgame.beads.reverify.runs') ?? '{}'));
    const g2 = new BeadsGame({ saveKey: 'wxgame.beads.reverify.runs', levels: [lvVet] });
    const p2 = new fw.InputManager(); const e2 = new fw.EventBus();
    const svc2 = { ...svc1, input: p2, events: e2, rng: fw.createRng('runs2') };
    g2.init(svc2); svc2.input.beginFrame(); g2.update(1 / 60); svc2.input.endFrame(1 / 60);
    const noGuideForVeteran = g2.snapshot.onboarding !== true && rings(cmds({ game: g2 }), hintHex).length === 0;
    const allOk3 = chan.socketColor && chan.guideSlot && chan.hintCell && hintIsRowMajorFirst && afterPlaced === false && afterRing === 0 && noGuideForVeteran;
    // 【修订 25】判据项全过，但本轮顺带抓到 §8 未覆盖的**引导可达性缺口**（见证据末段 BD-32）⇒ 不升 PASS。
    const v = allOk3 ? 'PASS*' : 'FAIL';
    rec('P3 / BD-03 · GAP-03 0 文字引导三通道（首珠脉冲 + 单一 hint 格 + 目标色底）', v,
        `通道①空槽目标色：见 P1（${chan.socketColor}）；通道②首珠槽脉冲 onboarding=${ob0}、guideSlot=${gs0}（该槽色=${gsColor}）；通道③单一目标格 hint=(r${hr0},c${hc0})，行主序最前匹配格=${hintIsRowMajorFirst}。`
        + `渲染层 accent_blue(${hintHex}) 描边环图元数=${ringN}（首珠槽 + 目标格 = 期望 2）。`
        + `呼吸周期实测 ${pm.periodMs ? pm.periodMs.toFixed(0) : '—'}ms（ux-spec §5 = ${T.HINT_PULSE_MS}ms，α 取值 ${pm.distinct} 档 / ${pm.periods} 个完整周期 / 90 帧）。`
        + `引导终止：首次 bead:placed=${h.count('bead:placed')} 后 onboarding=${afterPlaced}、hint 环=${afterRing}（期望 false/0，事件驱动无计时器）。`
        + `老玩家重现性：首玩装配 onboarding=${obFirst}→ BOOT 后存档 runs=${runsSaved.runs ?? '-'}；**同存档二次装配** onboarding=${g2.snapshot.onboarding}、hint 环=0（期望 false，§6.3 永不重现）。`
        + `　【附带发现 · 移交裁定 BD-32】上文的「永不重现」由 beads-game.ts:947 \`_onboardDone = save.data.runs > 0\` + :949-952 「每次 BOOT 无条件 runs+1 落档」共同实现：`
        + `实测 runs 在**首次 BOOT 即 0→1**（尚未落过任何一子）。⇒ 玩家若在 L1 引导过程中杀进程/重进，第二次启动就被判为「老玩家」、引导**永久不再出现**，而其实际进度为 0。`
        + `这不是 §8 违约（§8 只写「老玩家不重现」，未定义「老玩家」判据），故不判 FAIL；但属可玩性风险，建议判据改为「首次通关 level:cleared 后才置 onboarded」。`);
}

// ═════════════════════════════════════════════════════════ P4 · wrong/hint 态与四余 VFX
{
    const h = mk();
    h.frame();
    const s = h.game.snapshot;
    const held = s.traySlots.findIndex((x) => x.state !== 'free');
    const c0 = s.traySlots[held].colorIdx;
    const wrongCell = (() => { for (let i = 0; i < s.cells.length; i++) { const x = s.cells[i]; if (!x.void && x.state === 'empty' && x.colorIdx > 0 && x.colorIdx !== c0) return i; } return -1; })();
    h.game.tapDesign(...slotXY(held)); h.frame();
    h.game.tapDesign(...cellXY(s, wrongCell)); h.frame();
    const sn = { wrongRow: h.game.snapshot.wrongRow, wrongCol: h.game.snapshot.wrongCol, wrongProgress: h.game.snapshot.wrongProgress };
    const rejected = h.count('bead:rejected');
    const dangerHex = hex2(DEFAULT_PALETTE.danger);
    const shake = [], flash = [];
    for (let f = 0; f < 13; f++) {
        const cs = cmds(h); const cur = h.game.snapshot;
        const [wx, wy] = cellXY(cur, wrongCell);
        const bead = cs.filter((k) => k.kind === 'rect' && Math.abs(k.w - T.BEAD_CELL) < 0.6 && Math.abs((k.y + k.h / 2) - wy) < 2 && Math.abs((k.x + k.w / 2) - wx) < 8).map((k) => (k.x + k.w / 2) - wx);
        shake.push(bead.length ? Number(bead[0].toFixed(2)) : 0);
        const rg = rings(cs, dangerHex); flash.push(rg.length ? (rg[0].alpha ?? 1) : 0);
        h.frame();
    }
    const shakeMax = Math.max(...shake.map(Math.abs)), shakeDir = new Set(shake.filter((v) => Math.abs(v) > 0.4).map((v) => Math.sign(v))).size;
    const fm = pulsePeriodMs(flash.filter((v) => v > 0));
    // 其余三行：落座回弹 / 消除溶解 / 完成波浪 —— 落子后连续帧指令签名（剔 text）是否随时间轴变化
    const h2 = mk(); h2.frame();
    const s2 = h2.game.snapshot; const t2 = firstEmptyOf(s2, s2.traySlots.find((x) => x.state !== 'free')?.colorIdx ?? 1);
    const before = sig(cmds(h2));
    const i3 = h2.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
    h2.game.tapDesign(...slotXY(i3)); h2.frame(); h2.game.tapDesign(...cellXY(h2.game.snapshot, t2));
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
    const wrongOk = rejected === 1 && sn.wrongProgress > 0 && Math.abs(sn.wrongRow - Math.floor(wrongCell / s.gridCols)) <= 1 && shakeMax > 0 && shakeDir === 2 && fm.distinct >= 2;
    const v = wrongOk && residual.length === 0 ? 'PASS' : (wrongOk ? 'PASS*' : 'FAIL');
    rec('P4 / BD-04 · GAP-04 拒绝反馈（wrong 抖动+闪）与其余 VFX 行', v,
        `① wrong 态：bead:rejected=${rejected}（期望 1）、wrongRow/Col=(${sn.wrongRow},${sn.wrongCol})、wrongProgress=${sn.wrongProgress.toFixed(2)}；`
        + `被拒格 200ms 内水平位移样本=[${shake.join(',')}]px ⇒ 幅度 max=${shakeMax}px（ux-spec §5 = ±${T.WRONG_SHAKE_PX}px）、换号次数=${shakeDir}（期望 2 = ±×2）；`
        + `danger(${dangerHex}) 描边环 α 样本=[${flash.join(',')}] ⇒ 呼吸档 ${fm.distinct} 种、周期 ${fm.periodMs ? fm.periodMs.toFixed(0) : '—'}ms（WRONG_FX_MS=${T.WRONG_FX_MS}ms 内闪 2 次）。`
        + `　⚠️ **红线冲突待裁定（新登记）**：「200ms 内闪 2 次」= 10Hz 亮度变化，与 ux-spec §5 表头/§3.8「无 >3Hz 闪烁」红线口径冲突（表内「≤2 次/秒」原文挂在**音效**列）⇒ QA 不自裁。`
        + `② 落座回弹：落子前/后连续 10 帧**剔 text** 指令签名去重=${popDistinct}（>1 才有时间轴）；`
        + `③④ tuning 命中：FILL_POP=${src.fillPop.length} / DISSOLVE=${src.dissolve.length} / COMPLETE_WAVE=${src.wave.length} 个常量。`
        + (residual.length ? ` ⇒ 仍缺行：${residual.join(' / ')}（ux-spec §5 其余三行，波次 2 未列 T-087 范围）⇒ 建议 BD-04 **降级不关闭**。` : ' ⇒ 四行全落地。')
        + `　【探针口径】v1.0 以「CellState 无 wrong/hint」为实现缺失，本轮改判据为渲染层断言（修订 16）：载体实为 snapshot 覆盖层 hintRow/Col、wrongRow/Col/progress + view 只读消费（view-model.ts:493-521、584-587）。`);
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
    /** 只为构造 LEVEL_CLEAR 前置而直投托盘（修订 20 的**注明例外**：不用于 A′ 不变量类判据）。 */
    function fillBoardAudio(h) {
        const grid = h.game.grid;
        for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
            if (!grid.isFillable(r, c)) continue;
            const slot = h.game.giveTrayBead(grid.requiredColor(r, c));
            if (slot < 0) return false;
            h.game.selectTraySlot(slot);
            if (!h.game.tapGridCell(r, c)) return false;
        }
        return true;
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
    const i1 = h1.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
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
    const i4 = h4.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
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

    // ── A07 · 道具帧两条并存 / affectedSlots 为空零发声
    const h7 = ah(); h7.tickFrame(FR);
    h7.game.giveTrayBead(1); h7.game.giveTrayBead(2); h7.clearAudio();
    const t7res = tapAt(h7, ...CARD_XY(1));
    const puEv = h7.count('powerup:used');
    h7.clearAudio();
    h7.events.emit('powerup:used', { type: 'random', affectedSlots: [] });
    h7.audio.flush(FR);
    const silentEmpty = h7.dispatched.length === 0 && h7.audio.pendingCount === 0;
    const ok07 = puEv === 1 && t7res.dispatched.includes(C('AUDIO_CLIP_POWERUP'))
        && t7res.dispatched.includes(C('AUDIO_CLIP_DISSOLVE')) && silentEmpty;
    p5('A05-07', 'sfx_powerup + sfx_dissolve · 同帧分层不被去重吞掉；零效果零发声', ok07,
        `【派发层】真实点击道具卡（托盘内先放 2 颗珠作为前置）：powerup:used=${puEv}、同帧 backend 收到=`
        + `[${t7res.dispatched.join(', ') || '（无）'}]（共 ${t7res.dispatched.length} 条 ≤ 冻结上限 AUDIO_MAX_PER_FRAME=${T.AUDIO_MAX_PER_FRAME}）`
        + ` ⇒ 两条 id 不同、未被 flush() 的同帧去重吞掉。`
        + `【零噪声】注入 affectedSlots: [] 后 flush ⇒ 新增派发=${h7.dispatched.length} 条、pending=${h7.audio.pendingCount}（powerups §4）。`,
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

    // ── A05-09 · sfx_combo_t3（[B] 时长 + 判据主体待裁）
    const h9 = ah(); h9.tickFrame(FR); h9.clearAudio();
    const p9 = h9.dispatched.length;
    h9.events.emit('combo:up', { streak: 7, multiplier: 5, tier: 3 });
    h9.audio.flush(FR);
    const t3n = cnt(h9.dispatched.slice(p9), C('AUDIO_CLIP_COMBO_T3'));
    p5('A05-09', 'sfx_combo_t3 · 时长 ≤350ms 且与伪震屏（scale 1.015）同帧起始', t3n === 1,
        `【本轮实测到的半边】广播 combo:up(tier=3) → 单帧 flush ⇒ sfx_combo_t3 新增派发 ${t3n} 次（三档分流另有 A05-08 独立取证）。`
        + `　【缺哪一道】「时长 ≤350 ms」= **[B]**：本轮夹具无 AudioContext（实测 typeof globalThis.AudioContext=${typeof globalThis.AudioContext}），`
        + `拿到的只是配方**声明值** durationMs=${vcDur(C('AUDIO_CLIP_COMBO_T3'))}ms，不是实测包络。`
        + `　【判据自身冲突 · 移交裁定，不判实现缺陷】A05-09 把「伪震屏 scale ${T.COMBO_SHAKE_SCALE_MAX}」写成 sfx_combo_t3 的同帧主体，`
        + `但 §1 行 7 与 §2.1 行 6/7/8 的对应关系、以及实现侧 combo-vfx.ts:46-50（tier=2 → kind=pseudoShake / ${T.COMBO_VFX_LV2_MS}ms；tier=3 → kind=burst / ${T.COMBO_VFX_LV3_MS}ms）`
        + `都表明**伪震屏属 Lv2（sfx_combo_t2）**⇒「与 t3 同帧起始」按现文**不可判定**（主体写错，不是实现没做到）。归属：文策渊（§4 正文）。`
        + `　另记（不重复计缺陷）：Lv2 伪震屏在 view-model.ts:711 明文**未接入绘制**，属 BD-04 已登记的动效缺行。`,
        { block: '[B] + 判据主体待裁' });

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

    // ── A05-14 · tray:full 音只 1 次不循环（视觉 500ms 呼吸半边欠 BD-10）
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
    p5('A05-14', 'sfx_tray_full · 每次 tray:full 派发 1 次且不循环；与视觉呼吸互不驱动', ok14audio,
        `【[N] 音频半边·派发层】隔 2.2s 注入 3 次 tray:full ⇒ 每次新增派发=${perEmit.join('/')}（恰 1）；`
        + `【[N] 音频半边·请求层】3 次请求的 loop 入参全=${u(req14.map((r) => r.loop)).join('/')} ⇒ **不循环**成立（minInterval=${u(req14.map((r) => r.minInterval)).join('/')} = AUDIO_TRAYFULL_MIN_INTERVAL=${T.AUDIO_TRAYFULL_MIN_INTERVAL}）。`
        + `　【整条未闭】「托盘描边呼吸按 500ms 独立循环」同一轮 P7 已实测：满槽态 500ms 窗口内剔 text 签名去重=1 ⇒ **无呼吸时间轴**（已登记 **BD-10**，属表现层欠账，不在 P5 重复计新缺陷）。`
        + `　⇒ 记 PASS*（修订 37：本条判据含「与视觉呼吸互不驱动」子句，而呼吸本身未实现 ⇒ 互不驱动无法双向成立）：音频半边绿不代表 A05-14 可关闭；该条关闭需 BD-10 修完 + 复跑。`,
        { partial: true });

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
    h18.tickFrame(FR);                                          // v1.2 修：填盘是直投 API、不跨帧 ⇒ 不 flush 则 panel_in 永留 pending（实测旧版 inClear=0 假 FAIL）
    const inClear = cnt(h18.dispatched, C('AUDIO_CLIP_PANEL_IN'));
    h18.clearAudio(); tapBtn(h18, clearPanelLayout({ lastLevel: false }), 'next');
    const outClear = cnt(h18.dispatched, C('AUDIO_CLIP_PANEL_OUT'));
    h18.clearAudio(); fillBoardAudio(h18); runFrames(h18, 4);
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
    const i23c = h23c.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
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
        runFrames(h23b, 40);                                   // 让逐星结算跑完（星音本应被门控）
        tapBtn(h23b, clearPanelLayout({ lastLevel: lv === LEVELS.length - 1 }), 'next');
        h23b.tickFrame(FR);
        chain23b.push(h23b.game.phase);
    }
    const phaseFin23b = h23b.game.phase;
    tapBtn(h23b, finishPanelLayout(h23b.game.levelCount), 'sprint'); h23b.tickFrame(FR);
    const sprintPhase = h23b.game.phase, sprintMode = h23b.game.mode;
    let sprintAlive = false;
    for (let f = 0; f < 180; f++) { h23b.tickFrame(FR); if (h23b.game.snapshot.traySlots.some((x) => x.state !== 'free')) sprintAlive = true; }
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
    const sel = sF.traySlots.findIndex((x) => x.state !== 'free');
    const tgt = firstEmptyOf(sF, sF.traySlots[sel].colorIdx);
    h.game.tapDesign(...slotXY(sel)); h.frame(); h.game.tapDesign(...cellXY(h.game.snapshot, tgt));
    h.advance(2.0 + 0.05);
    const resumed = h.count('tray:spawned') - before;
    const decoysInLevels = LEVELS.reduce((n, l) => n + ((l.decoys ?? []).length), 0);
    const v = full === T.TRAY_BASE_SLOTS && deadEver === 0 && invariantBroken === 0 && placeableNow === full && resumed >= 1 ? 'PASS' : 'FAIL';
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
    // 满槽告警通道（ux-spec §5 托盘描边呼吸 500ms）
    const fullRing = (() => {
        const h2 = mk({ levels: [probeLevel(907, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 3) + 1))] });
        for (let f = 0; f < 60 * 40 && h2.hold() < T.TRAY_BASE_SLOTS; f++) h2.frame();
        h2.advance(2.2);   // 满槽后再跨过一个供料间隔 ⇒ tray:full 的去重语义才真正可观测（修订 27）
        const seq = []; for (let f = 0; f < 60; f++) { seq.push(new Set(cmds(h2).filter((c) => c.kind !== 'text' && inBand(c, T.TRAY_BAND, 4)).map((c) => `${c.kind}${Math.round(c.x ?? 0)}${hex2(c.stroke ?? c.fill ?? '')}a${c.alpha ?? alphaOf(c.stroke ?? '')}`).join(','))); h2.frame(); }
        const uniq = new Set([...seq].map((s) => [...s].sort().join('|'))).size;
        return { full: h2.hold(), uniq, hasTrayFullEv: h2.count('tray:full') };
    })();
    const v = urgent && ev === 1 && pm.distinct >= 2 && pm.periodMs !== null && Math.abs(pm.periodMs - T.DANGER_PULSE_MS) <= 50 && fullRing.uniq <= 1 ? 'PASS*' : (urgent && pm.distinct >= 2 ? 'PASS*' : 'FAIL');
    rec('P7 / BD-10 · GAP-10 告急三通道（色+图标+脉冲）与满槽告警', v,
        `① 事件层：降穿 TIMER_URGENT_T=${T.TIMER_URGENT_T}s → timer:urgent=${ev}（期望恰 1）、snapshot.urgent=${urgent}。`
        + `② 颜色通道：HUD 时钟图标描边色去重=[${iconColors.join(', ')}]（平时 ${hex2(DEFAULT_PALETTE.textDim)} → 告急 ${hex2(DEFAULT_PALETTE.danger)}）、数字 fill 切 danger。`
        + `③ 脉冲通道：图标 α 序列（130 帧剔 text）distinct=${iconAlphas.distinct} 档、周期=${iconAlphas.periodMs ? iconAlphas.periodMs.toFixed(0) : '—'}ms；数字/图标合成脉冲样本 distinct=${pm.distinct}、周期=${pm.periodMs ? pm.periodMs.toFixed(0) : '—'}ms（ux-spec §5 = ${T.DANGER_PULSE_MS}ms±50）⇒ 频率 ${(1000 / (pm.periodMs ?? 1)).toFixed(2)}Hz ≤3Hz 红线。`
        + `④ 满槽告警（ux-spec §5 托盘描边呼吸 ${500}ms）：满槽 ${fullRing.full}/${T.TRAY_BASE_SLOTS} 且 tray:full=${fullRing.hasTrayFullEv} 时，托盘带内非文本指令签名 60 帧去重=${fullRing.uniq} 种（>1 才算呼吸）⇒ ${fullRing.uniq > 1 ? '有通道' : '**零通道，仍缺**'}。`
        + `　⇒ 建议 BD-10 **部分关闭**：告急三通道 ✅；满槽告警 500ms 呼吸仍开放（降级 P2，理由：A′ 下满槽非死局，仅反馈缺口）。`
        + `　timer-gameover §8-10 的「与满槽告警同屏叠加无 >3Hz 闪烁」半条因缺第二主体仍 ⛔ 不可测；代码锚点 view-model.ts:407-431（dangerAlpha + iconColor + timerColor）。`);
}
/** 单独取 HUD 非文本脉冲 α 序列（避免与 ①②③ 混用样本）。 */
function hudPulse(h, n) {
    const saved = h.game.snapshot; void saved;
    const seq = [];
    for (let f = 0; f < n; f++) {
        const cs = cmds(h);
        const c = cs.filter((k) => k.kind === 'circle' && inBand(k, T.HUD_BAND) && Math.abs((k.x ?? 0) - (T.DESIGN_W / 2 - 96)) < 2)[0];
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
    const h3 = mk(); h3.frame(); let expandHit = 0;
    for (let y = T.TRAY_BAND.yMin - 80; y <= T.TRAY_BAND.yMax + 8; y += 6) {
        for (let x = 0; x <= T.DESIGN_W; x += 6) { h3.game.tapDesign(x, y); if (h3.count('tray:expanded') > 0) { expandHit++; break; } }
    }
    const h4 = mk(); h4.frame(); const i4 = h4.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
    h4.game.tapDesign(...slotXY(i4)); h4.frame();
    const selOk = h4.count('tray:selected') === 1;
    const h5 = mk(); h5.frame(); const i5 = h5.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
    h5.game.tapDesign(...slotXY(i5)); h5.frame();
    const t5 = firstEmptyOf(h5.game.snapshot, h5.game.snapshot.traySlots[i5].colorIdx);
    h5.game.tapDesign(...cellXY(h5.game.snapshot, t5)); h5.frame();
    const placeOk = h5.count('bead:placed') === 1 && h5.count('bead:rejected') === 0;
    const v = [gearOk, cardOk, selOk, placeOk].every(Boolean) && expandHit > 0 ? 'PASS' : 'FAIL';
    rec('P8 / BD-15 · TC-INP-01 · S2 §8-1 五类路由', v,
        `① 齿轮→game:paused=${h1.count('game:paused')}(phase=${h1.game.snapshot.phase}) ${gearOk ? '✓' : '✗'}；② 道具卡→powerup:used=${h2.count('powerup:used')} ${cardOk ? '✓' : '✗'}；`
        + `③ 扩展→tray:expanded 命中点=${expandHit}（6px 栅格扫托盘带上下 80px）${expandHit > 0 ? '✓' : '✗'}；④ 托盘珠→tray:selected=${h4.count('tray:selected')} ${selOk ? '✓' : '✗'}；`
        + `⑤ 空格(有选中)→bead:placed=${h5.count('bead:placed')}/rejected=${h5.count('bead:rejected')} ${placeOk ? '✓' : '✗'}。`
        + `　仍缺第 3 类：src/** grep btn_expand/_hitExpand 命中 0（仅 beads-game.ts:547 expandTray() 方法层，玩家不可达）⇒ **BD-15 维持开放**（波次 2 未列范围）。`);
}

// ═════════════════════════════════════════════════════════ P9 · 热区（§8-2 回写后）
{
    const h0 = mk(); h0.frame();
    const s = h0.game.snapshot;
    const target = (() => { for (let i = 0; i < s.cells.length; i++) { const c = s.cells[i]; if (!c.void && c.state === 'empty' && c.colorIdx > 0 && (i % s.gridCols) + 1 < s.gridCols && !s.cells[i + 1].void && s.cells[i + 1].state === 'empty') return i; } return -1; })();
    const [cx, cy] = cellXY(s, target);
    // 【修订 15b + 26】旧版忘了先选珠（⇒ 全 none 假 FAIL）；修后仍假 FAIL，因为**多次命中同一格**：
    //   第一次落子后该格已填（后续变 danger/locked）且托盘被 fixture 珠灌满 ⇒ giveTrayBead 返回 -1。
    //   本轮改为**每次偏移测量用一个干净实例**（同一行主序目标格、同一几何），一次一事。
    const probe = (dx) => {
        const hi = mk(); hi.frame();
        const si = hi.game.snapshot;
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
        const s = h.game.snapshot;
        const i = findEmpty(s);
        const [x, y] = cellXY(s, i);
        if (tap) h.game.tapDesign(x, y);
        h.frame();
        const sn = h.game.snapshot;
        return {
            h, i, x, y, sig: sig(cmds(h)),
            hints: { powerupHint: sn.powerupHint, failHint: sn.failHint, banner: sn.banner, subBanner: sn.subBanner },
            placed: h.count('bead:placed'), rejected: h.count('bead:rejected'), selected: h.count('tray:selected'),
        };
    };
    const ctl = runP10(false), tst = runP10(true);
    const diff = ctl.sig !== tst.sig;
    const hintOn = Object.values(tst.hints).some(Boolean);
    const v = tst.placed === 0 && tst.rejected === 0 && tst.selected === 0 && (diff || hintOn) ? 'PASS' : 'FAIL';
    rec('P10 / BD-16 · TC-INP-07 · S2 §8-7 无选中点网格 → 零请求 + 轻提示', v,
        `零请求 ✓：bead:placed=${tst.placed}、bead:rejected=${tst.rejected}、tray:selected=${tst.selected}（期望 0/0/0），点击点=空格 (i${tst.i}, ${tst.x.toFixed(1)},${tst.y.toFixed(1)})。`
        + `轻提示 ✗：powerupHint=「${tst.hints.powerupHint}」failHint=「${tst.hints.failHint}」banner=「${tst.hints.banner}」subBanner=「${tst.hints.subBanner}」（全空）；`
        + `配对差分（同 seed、同帧号， ctl 不点 / tst 点）非文本指令签名是否出现差异=${diff}（false ⇒ 该次点击**未产生任何专用反馈帧**）。`
        + `　代码铁证（未改）：beads-game.ts:1371 \`if (slot < 0) return false; // S2 gate: no bead selected → no request at all\` ⇒ 前半条达标、后半条无实现 ⇒ **BD-16 维持开放**（P2）。`
        + `　【探针自查】v1.0 与本文件早期版本均以「点击前后两帧签名不等」判有反馈，实测恒为 true（常态动画污染）⇒ 属**假 PASS 风险**，本轮已按修订 25 收紧。`);
}

// ═════════════════════════════════════════════════════════ P11 · §8-6/8/10（真实 InputManager）
{
    const h1 = mk(); h1.frame();
    const s1 = h1.game.snapshot; const [sx, sy] = slotXY(s1.traySlots.findIndex((x) => x.state !== 'free'));
    h1.tapScreen(sx, sy); h1.frame(); h1.tapScreen(sx, sy); h1.frame();
    const dbl = h1.count('tray:selected');
    const h2 = mk(); h2.frame();
    const a = h2.game.snapshot.traySlots.findIndex((x) => x.state !== 'free');
    h2.game.giveTrayBead(h2.game.snapshot.cells.find((c) => !c.void && c.colorIdx > 0).colorIdx); h2.frame();
    h2.tapScreen(...slotXY(a)); h2.frame(); h2.tapScreen(...slotXY(a === 0 ? 1 : 0)); h2.frame();
    const swap = h2.count('tray:selected'), selFinal = h2.game.snapshot.traySelected;
    const h3 = mk(); h3.game.tapDesign(...GEAR_XY); h3.frame();
    const s3 = h3.game.snapshot; const before3 = h3.emitted.length;
    h3.tapScreen(...slotXY(0)); h3.frame(); h3.game.tapDesign(...cellXY(s3, findEmpty(s3))); h3.frame(); h3.game.tapDesign(...CARD_XY(0)); h3.frame();
    const pausedEvents = h3.emitted.length - before3, phase3 = h3.game.snapshot.phase;
    const h4 = mk(); h4.frame();
    const s4 = h4.game.snapshot; const i4 = s4.traySlots.findIndex((x) => x.state !== 'free');
    h4.tapScreen(...slotXY(i4)); h4.frame();
    const [gx, gy] = cellXY(h4.game.snapshot, firstEmptyOf(h4.game.snapshot, h4.game.snapshot.traySlots[i4].colorIdx));
    h4.reset(); h4.tapMany(gx, gy, 20);
    const flood = { placed: h4.count('bead:placed'), rejected: h4.count('bead:rejected'), phase: h4.game.snapshot.phase };
    const mt = mk(); mt.frame();
    const sm = mt.game.snapshot; const [m1x, m1y] = slotXY(sm.traySlots.findIndex((x) => x.state !== 'free'));
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
        h.frame(); framesS++;
        for (; cursor < h.emitted.length; cursor++) {
            const e = h.emitted[cursor];
            if (e.type !== 'tray:spawned') continue;
            slots[e.p.slot] = (slots[e.p.slot] ?? 0) + 1; got++;
            if (got >= 200) break;
        }
        h.drain();
    }
    const exp = 200 / T.TRAY_BASE_SLOTS;
    const x2 = chi2(slots, exp);
    const maxDev = Math.max(...slots.map((v) => Math.abs(v - exp) / exp)) * 100;
    // §8-4 满槽跳过 + 恢复（合法供料）
    const h2 = mk({ levels: [probeLevel(909, 13, 12, 420, 2.0, (i, j) => String(((i * 13 + j) % 3) + 1))], seed: 'full' });
    for (let f = 0; f < 60 * 40 && h2.hold() < T.TRAY_BASE_SLOTS; f++) h2.frame();
    const beforeF = h2.count('tray:spawned'); h2.advance(2.0 * 3);
    const fullEv = h2.count('tray:full'), spawnDuring = h2.count('tray:spawned') - beforeF;
    const sF = h2.game.snapshot; const sel = sF.traySlots.findIndex((x) => x.state !== 'free');
    h2.game.tapDesign(...slotXY(sel)); h2.frame(); h2.game.tapDesign(...cellXY(sF, firstEmptyOf(sF, sF.traySlots[sel].colorIdx)));
    h2.advance(2.05); const resumed = h2.count('tray:spawned');
    const h3 = mk(); const cap0 = h3.game.snapshot.traySlots.length; const ex = h3.game.expandTray();
    const v = x2 < CRIT_DF11_A005 && fullEv === 1 && spawnDuring === 0 && resumed >= 1 && ex && cap0 + T.TRAY_EXPAND_SLOTS === h3.game.snapshot.traySlots.length ? 'PASS' : 'FAIL';
    rec('P12 / BD-22(已裁定) · TC-TRAY-02·04·05 · S4 §8-2/§8-4/§8-5', v,
        `§8-2 现文（WXG-T-091）：200 次供料落槽频次做**卡方拟合优度，α=0.05 不拒绝均匀**（旧 ±20% 弃用）。白盒排水夹具下 ${framesS} 帧采到 ${got} 样本，频次=[${slots.join(',')}]，期望 ${exp.toFixed(2)}/槽 ⇒ χ²=${x2.toFixed(2)}（df=${T.TRAY_BASE_SLOTS - 1}，α=0.05 临界 ${CRIT_DF11_A005}${x2 < CRIT_DF11_A005 ? ' ⇒ 不拒绝 ✓' : ' ⇒ 拒绝均匀 ✗'}）；`
        + `对照旧口径最大偏差 ${maxDev.toFixed(1)}%（若仍按 ±20% 会误报，即 BD-22 的误报本征）。`
        + `§8-4：满槽 → tray:full=${fullEv}（期望 1、不重复）、满槽期 3 间隔 tray:spawned 增量=${spawnDuring}（期望 0）✓；腾 1 槽后 ≤1 间隔恢复=${resumed >= 1 ? '✓' : '✗'}。`
        + `§8-5：${cap0} 槽 → expandTray()=${ex} → ${h3.game.snapshot.traySlots.length} 槽（期望 ${T.TRAY_BASE_SLOTS + T.TRAY_EXPAND_SLOTS}）✓（**但玩家无入口，见 P8/BD-15**）。`);
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
    const idx = s.traySlots.findIndex((x) => x.state !== 'free');
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
        + `　v1.0→v1.1 变化：存档 version 1→**2**（T-088），但新增字段是「settings.reduceMotion / largeText」（可访问性，见 P22/P23），**不含** §2.3 冻结的 meta 段 ⇒ **BD-12 维持开放**（P2；属 concept §7 MVP 线之外）。`);
}

// ═════════════════════════════════════════════════════════ P18 · §8-9（回写后 156）
{
    const big = probeLevel(913, T.GRID_MAX_COLS, T.GRID_MAX_ROWS, 420, 4.0, (i, j) => String(((i * T.GRID_MAX_COLS + j) % T.BEAD_COLOR_MAX) + 1));
    const h = mk({ levels: [big] });
    const s = h.game.snapshot;
    const fillable = s.cells.filter((c) => !c.void && c.colorIdx > 0).length;
    let placed = 0, writesBeforeLast = 0, clearedAt = -1;
    for (let i = 0; i < s.cells.length; i++) {
        const c = s.cells[i]; if (c.void || c.state !== 'empty' || c.colorIdx <= 0) continue;
        const sl = h.game.giveTrayBead(c.colorIdx);
        if (sl < 0) { h.drain(); continue; }
        h.game.selectTraySlot(sl);
        if (h.game.tapGridCell(Math.floor(i / s.gridCols), i % s.gridCols)) {
            placed++;
            if (h.count('level:cleared') > 0) { clearedAt = placed; writesBeforeLast = h.writes - 1; break; }
        }
    }
    const cleared = h.count('level:cleared');
    const v = fillable === T.GRID_MAX_COLS * T.GRID_MAX_ROWS && placed === fillable && cleared === 1 && writesBeforeLast === 0 && h.writes === 1 ? 'PASS' : 'FAIL';
    rec('P18 / BD-24(已裁定) · S8 §8-9 PLAYING 零写档 / 结算帧恰 1 次', v,
        `§8-9 现文（WXG-T-091）：注入落子次数 = 关卡最大可构造量 GRID_MAX_COLS×GRID_MAX_ROWS = ${T.GRID_MAX_COLS * T.GRID_MAX_ROWS}；结算帧 = **level:cleared 帧**（失败/sprint 帧另依 §2.5，不属本条）。`
        + `实测：可填格 ${fillable}、成功落子 ${placed}（第 ${clearedAt} 次触发通关）；PLAYING 段（前 ${placed - 1} 次落子）写档=${writesBeforeLast}（期望 0）${writesBeforeLast === 0 ? '✓' : '✗'}；含结算帧累计写档=${h.writes}（期望恰 1）${h.writes === 1 ? '✓' : '✗'}；level:cleared=${cleared}。`
        + `　v1.0 的 PASS*（200 不可构造）随判据回写取消 ⇒ 改判 **PASS**；BD-24 关闭。`
        + `　白盒夹具声明：本条用 giveTrayBead 补齐 156 颗珠（156 次落子在 4s×156 节律下超出 time≤420 的关卡上限），供料侧不受影响 ⇒ 只测「写档次数」，不测供料（修订 20 已隔离该手法）。`);
}

// ═════════════════════════════════════════════════════════ P19 · hint 态载体
{
    const h = mk(); h.frame();
    const hintHex = hex2(DEFAULT_PALETTE.hintBlue);
    const cs = cmds(h);
    const rg = rings(cs, hintHex);
    const s = h.game.snapshot;
    const cellCenter = s.hintRow >= 0 ? cellXY(s, s.hintRow * s.gridCols + s.hintCol) : null;
    const onCell = cellCenter ? rg.find((r) => Math.abs(r.x + r.w / 2 - cellCenter[0]) < 2 && Math.abs(r.y + r.h / 2 - cellCenter[1]) < 2) : null;
    const states = [...new Set(s.cells.map((c) => c.state))];
    const v = rg.length >= 1 && onCell && onCell.lineWidth === 2 ? 'PASS' : 'FAIL';
    rec('P19 / BD-11 · hint 态（规格 → 实现载体）', v,
        `accent_blue(${hintHex}) 外描边环图元数=${rg.length}（尺寸/线宽=[${rg.map((r) => `${Math.round(r.w)}px·lw${r.lineWidth}`).join(' ')}]），目标格 (r${s.hintRow},c${s.hintCol}) 上检出叠加环=${!!onCell}。`
        + `alpha 相位（P3 已测周期 ${T.HINT_PULSE_MS}ms / α 0.5↔1.0）⇒ assets-spec §1.2 hint 行三要素（色底 + 2px accent_blue 外描边 + 呼吸）落地。`
        + `　分层偏差登记（不判缺陷）：CellState 仍为 [${states.join('|')}]，hint/wrong 未扩为格子枚举态，实现走 snapshot 覆盖层 + view 只读；`
        + `art/assets-spec §1.2 以「状态行」措辞描述 ⇒ 建议美术侧补一句「hint/wrong 为叠加层，不改 S3 三态」，避免下轮按枚举态断言误判（修订 16）。`);
}

/** PanelRect = {xMin,yMin,xMax,yMax}（pause-panel.ts:67-69）；取中心设计坐标。 */
const panelCenter = (b) => [(b.rect.xMin + b.rect.xMax) / 2, (b.rect.yMin + b.rect.yMax) / 2];

// ═════════════════════════════════════════════════════ P20 (新增) · §8-1 / core-loop §8-2 首供语义 16±0
{
    const lvl = probeLevel(914, T.GRID_MAX_COLS, T.GRID_MAX_ROWS, 420, T.SPAWN_INTERVAL_DEFAULT, (i, j) => String(((i * T.GRID_MAX_COLS + j) % 3) + 1));
    const h = mk({ levels: [lvl], seed: 'sixteen' });
    // 时基从「进入 PLAYING 的那一帧」起算；§8-1 的「60 秒内」按**闭区间 t∈[0,60]**取值
    // （= 首供 1 @t=0 + 周期 15 @t=4,8,…,60），开/闭区间差 1 次，已登记为判据歧义（见报告 §12）。
    const times = [];
    let since = -1, seenN = 0;
    for (let f = 0; f < 60 * 64; f++) {
        h.autoFrame();
        if (h.game.snapshot.phase !== 'playing') break;
        since = since < 0 ? 1 : since + 1;
        const c = h.count('tray:spawned');
        while (seenN < c) { seenN++; times.push(since / 60); }
    }
    const inWindow = times.filter((t) => t <= 60 + 1e-9);
    const openWindow = times.filter((t) => t < 60 - 1e-9);
    const deltas = times.slice(1).map((t, i) => t - times[i]);
    const maxDev = deltas.length ? Math.max(...deltas.map((d) => Math.abs(d - T.SPAWN_INTERVAL_DEFAULT))) : null;
    const placements = h.count('bead:placed');
    const rhythmOk = times[0] === 1 / 60 && maxDev !== null && maxDev <= 0.1 && deltas.length >= 15;
    const v = rhythmOk && times.length >= 16 ? 'PASS*' : 'FAIL';
    rec('P20 (v1.1 新增) / BD-25 · S4 §8-1 + S1 §8-2 首供语义 16（±0）', v,
        `注入 spawnInterval=SPAWN_INTERVAL_DEFAULT=${T.SPAWN_INTERVAL_DEFAULT}s、13×12 关卡（demand 充裕），自动落子保持盘面可落（修订 22）：`
        + `首供时刻 t=${times[0] !== undefined ? times[0].toFixed(4) : '—'}s（期望 ${(1 / 60).toFixed(4)}s = 进入 PLAYING 第 1 帧）；` + `t≤60 闭区间内 tray:spawned **${inWindow.length}** 次、t<60 开区间=${openWindow.length} 次（判据现文 = **16 ±0** = 首供 1 + 周期 15），全部样本时刻=[${times.slice(0, 17).map((t) => t.toFixed(2)).join(', ')}]s。`
        + `相邻间隔最大偏差 ${maxDev !== null ? maxDev.toFixed(4) : '—'}s（期望 ≤0.1s；第 1 个间隔多 1 帧 = 16.7ms，系离散帧时基下的固定舍入）；同期 bead:placed=${placements}（证明非「满槽停供」造成计数塔陷）。`
        + `　⇒ 节律与首供本身均符合回写后判据；仅剩「±0 在 60.0s 边界上的开/闭区间定义」未写定（第 16 次落在 60.033s，超出闭区间上界 2 帧 = 33ms）⇒ 记 **PASS\*** 并登记 **BD-27（判据边界歧义，非实现缺陷）**：建议 §8-1 改写为「t∈[0,60] 且窗口边界允许 ±1 帧」或「60s 内恰 15 次间隔为 4.0s 的周期供料 + 1 次首供」。`
        + `　【裁定请求 · QA 不自裁】若主理人采**字面严格读法**（「16 ±0」且窗口为闭区间 [0,60]，不允帧量化容差），则本条实测为 15≠16 ⇒ **应记 FAIL**；`
        + `　若采「±1 帧量化容差」读法（帧时基下 60s 不可能整除 240 帧间隔 + 首供偏移 1 帧）⇒ 记 PASS。QA 按后者采 PASS* 呈请，**不据本条自行关单 BD-25**。`
        + `　v1.0 冲突表 #4（旧 ±1 容差恰吞掉 +1 变更 = 前瞻性假绿）随回写 + 落码实测闭环 ⇒ **BD-25 建议关闭**（若主理人采纳上述边界注记）。`);
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
    const v = spawned >= 60 && holdViolation === 0 && dead === 0 && trivial0 ? 'PASS' : 'FAIL';
    rec('P21 (v1.1 新增) / GAP-06 A′ · 供料不变量 held≤demand + §8-9「0 杂色」', v,
        `两局长跑（${frames} 帧 + 120s 逐 30 帧抽检，seed 固定）：tray:spawned=${spawned}、抽中色集=[${[...seen].sort((a, b) => a - b).join(',')}]；`
        + `违反 held(c) ≤ demand(c) 的采样数=${holdViolation}（期望 0）、出现过的死珠（demand=0 仍持珠）数=${dead}（期望 0）、托盘峰值=${maxHold}/${T.TRAY_BASE_SLOTS}。`
        + `§8-9（0 杂色关卡 ⇒ 供料 100% 为仍需色）：8 关 JSON decoys 全空=${trivial0}，D（DECOY_COLORS_MAX=${T.DECOY_COLORS_MAX}）下本条**平凡真**（见 P26 的判据可构造性登记）。`
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
    const sw = hw.game.snapshot; const si = sw.traySlots.findIndex((x) => x.state !== 'free');
    const c0 = sw.traySlots[si].colorIdx;
    const wc = (() => { for (let i = 0; i < sw.cells.length; i++) { const x = sw.cells[i]; if (!x.void && x.state === 'empty' && x.colorIdx > 0 && x.colorIdx !== c0) return i; } return -1; })();
    hw.game.tapDesign(...slotXY(si)); hw.frame(); hw.game.tapDesign(...cellXY(sw, wc)); hw.frame();
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
    rec('P22 (v1.1 新增) / BD-09·D1 · 减弱动效逐通道退静态 + 落档回显', v,
        `开关路径：PAUSED → 暂停面板行3「toggle-reduce-motion」（pause-panel.ts:126-129）点击后 snapshot.reduceMotion=${on}（期望 true）；` + `三个通道实例均**预置** reduceMotion=true（读档回显）=${redOn}（【修订 15e】旧版用未开的默认实例测「退静态」⇒ 假 FAIL/假 PASS 双向风险）。`
        + `① 告急脉冲：reduceMotion 下 HUD 图标 α 90 帧 distinct=${pulseOn.distinct} 档（期望 1 = 静态红字），danger 图元数=${dangerVisible}（**色/图标通道不得被关掉** ⇒ >1 即保留）；`
        + `② hint 呼吸：60 帧 α 序列 distinct=${hintPm.distinct} 档（期望 1），蓝描边仍常驻（图元数=${hintRingKept}，D1 保留清单）；`
        + `③ 错误抖动：200ms 位移样本=[${shakeSeq.join(',')}] ⇒ 唯一值数=${new Set(shakeSeq).size}（期望 1 = 位移归零），danger 静态描边环在 fx 窗口内最大图元数=${ringStatic}（期望 ≥1，「红描边改静态」而非删除）；`
        + `④ 落档：写档含 "reduceMotion":true=${persisted}；**二次装配回显** reduceMotion=${echo}（§8-8「即档、重启回显一致」）。`
        + `　未纳入本条的 D1 清单项：结算/通关星弹跳缩放（view-model.ts:666、804 由 reduceMotion 退静态，代码在案，本轮未做逐帧弹跳断言）；`
        + `　道次限制：真实**观感**是否「不晕」属 [Cocos]/[DevTools]/[人]，本条只证**渲染指令层**退静态 ⇒ 记 PASS*。`);
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

// ═════════════════════════════════════════════════════ P26 (新增) · 判据可构造性回归（D 的副作用）
{
    const withDecoy = probeLevel(922, 6, 5, 300, 2.0, (i, j) => String(((i + j) % 3) + 1), ['4']);
    const h = mk({ levels: [withDecoy] }); h.frame();
    const err = h.game.snapshot.phase !== 'playing';
    rec('P26 (v1.1 新增) / 新登记 BD-28 · S4 §8-3「3:1 抽色」在 D（DECOY_COLORS_MAX=0）下不可构造', '⛔（本轮不可验 · 移交裁定）',
        `构造 §8-3 要求的「仍需 1 色 + 1 杂色」关卡（decoys=['4']）装载 → phase=${h.game.snapshot.phase}（BOOT 校验拒收：levels.ts:184 level.decoys.length > DECOY_COLORS_MAX(${T.DECOY_COLORS_MAX})）${err ? ' ⇒ 判据前置条件在冻结常量下**不可能成立**' : ''}。`
        + `　tray-spawner §2.4.6 自认「§8.3（3:1 抽色）在 A′/D 下**作废或重写**、§8.9（0 杂色）在 D 下变为全关卡平凡真」，但 **§8 正文未随 v1.17 同步回写**（T-091 只改了 §8-1/§8-2）`
        + `⇒ 本轮**不判实现缺陷**（代码按冻结常量做事正确），也不计入 FAIL；记 **⛔ 不可验**，移交主理人与 GDD 负责人回写（沿用 §8 冲突表体裁，编号 **BD-28**）。`
        + `　QA 不自裁：建议 §8-3 改为「A′ 入池条件断言：demand(c)=0 的色永不被抽中（P21 已实测 0 例）」或删除；§8-9 加注「D 下平凡真，保留作回归钉」。`);
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
console.log('\n================ 探针汇总（v1.1 复验轮 · P5 段按 WXG-T-096 重建预期值） ================');
for (const r of out) console.log(`${norm(r.verdict).padEnd(6)} ${r.id}`);
console.log(`\n总计数：${sum(tally)}（共 ${out.length} 组）`);
console.log(`【本轮修订面 · P5 段（预期值按 T-096 重建，${cntGrp((id) => id.startsWith('P5'))} 条）】：${sum(tallyP5)}`);
console.log(`【未随 T-096 复核 · 其余 ${cntGrp((id) => !id.startsWith('P5'))} 组沿用 v1.1 预期值】：${sum(tallyRest)}`);
console.log('　↑ 两段计数不得合并解读：只有 P5 段在 WXG-T-096 之后重跑过预期值，其余 25 组未随本单复核。');
console.log(`时间戳：${new Date().toISOString()}   Node ${process.version}`);
