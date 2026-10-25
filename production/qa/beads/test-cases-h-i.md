> **本片 = `production/qa/beads/test-cases.md` 的分片（WXG-T-225，2026-10-25）。**
> 判据**零改动、零删除**，原文逐字搬迁（K-051/K-053）；差异仅限标题标记与本头注。
> 本片 = §H 未映射补编 + §I 宿主坐标归一化；变更记录与 §J 在下一片。
> 上片 `test-cases-g-perceptual.md` ← 本片 → 下片 `test-cases-history.md`｜总索引 `test-cases.md#§分片索引（WXG-T-225 · 13 片，先看这张表）`

# §H 未映射判据补编（22 条，v1.3 新增）—— **BD-21① 修复项**

> 背景：9 份 GDD §8 共 **93** 条，v1.2 只映射 **71** 条 ⇒ **22 条零映射**（`save-progress §8` 10 + `pause-settings §8` 10 + `timer-gameover §8-11/12` 2）。本节逐条补齐，使 §8 判据映射率达 **100%**。

## H1 · 存档与进度（S8）— 来源 `save-progress.md §8.1..10`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-SAVE-01 | §8-1 | 首启/二启 `runs` 与续进 | `[Node]` | 无存档 → `runs=1`、`unlockedLevel=1`、进 L1；二次启动 `runs=2` 且续进 `unlockedLevel` 最远关 | ✅ `save-schema.test`+`onboarded.test`（v3 迁移/首启 runs/onboarded） |
| TC-SAVE-02 | §8-2 | 解锁落档 + 星级取 max | `[Node]` | 过第 n 关（n<`DEMO_LEVEL_COUNT`）→ `unlockedLevel=n+1` 落档且**重启保留**；`stars[n-1] = max(旧, 新)`，**历史最高星不被低星覆盖** | ✅ `save-schema.test`（解锁钳位/星级 max） |
| TC-SAVE-03 | §8-3 | 篡改矩阵逐条复现 §2.4 | `[Node]` | 解析失败 → 出厂默认进 L1；`unlockedLevel=99` → 钳 8；`=0` → 钳 1；`stars` 长度 3 → 重置全 0；**全部不中断启动**（联合 TC-LOOP-10 / `core-loop §8-10`） | ✅ `save-schema.test`（篡改矩阵降级全例） |
| TC-SAVE-04 | §8-4 | 高版本档前向兼容 | `[Node]` | 注入 `version=2` 档 → 可读字段保留、照常启动、**无异常抛出**（SaveManager 永不抛异常契约） | ✅ `save-schema.test`（v2→v3 前向兼容例） |
| TC-SAVE-05 | §8-5 | v1 → v1.1 升级读取 | `[Node]` | 旧 v1 档直接升级读取，`sprint`/`meta` 字段取默认值、**v1 字段值无损**；新档写 v1.1 完整字段 | ✅ `save-schema.test`（v1→v2→v3 迁移链） |
| TC-SAVE-06 | §8-6 | `sprint.bestScore` 写入条件 | `[Node]` | 新分 > 旧最佳 → 写入 + S7 NEW BEST 显示；≤ → **不写**（联合 TC-SPRINT-11 / `score-combo §8-11`） | ✅ `sprint.test`（bestScore 写入条件） |
| TC-SAVE-07 | §8-7 | 连胜字段 | `[Node]` | 连续过关 3 次 → `winStreakCurrent=3`、`Best=3`；第 4 关失败 → `Current=0`、`Best` 仍 3 | ❌ **BD-12**（winStreak 无字段位，P2 归属不变） |
| TC-SAVE-08 | §8-8 | 设置开关即档 + 双通道独立 | `[Node]` | 切换音乐/音效 → **即档**、重启回显一致；两通道互不影响（双 AudioScheduler，`architecture §2`） | ✅ `audio-dispatch.test`（双通道独立） |
| TC-SAVE-09 | §8-9 | PLAYING 零写档 / 结算帧恰 1 次 | `[Node]` | ~~注入 200 次落子~~ → **v1.3 改：注入 ≤`GRID_MAX_COLS×GRID_MAX_ROWS` 的最大可构造量（156；本轮取 150、留 6 格避免通关）**，PLAYING 全程写档 **0** 次；结算帧写档**恰 1** 次。**改判依据 BD-24**（200 不可构造） | ⚠️ PASS\* `in-level-snapshot.test`（§8-11 零写断言） |
| TC-SAVE-10 | §8-10 | 整关重置不写档 | `[Node]` | 五项重置（`timer-gameover §2.4`）**均未**触发写档（关内态不入档） | ✅ `in-level-snapshot.test`（§8-14 关末清崩溃键+零写） |

## H2 · 暂停与设置面板（S9）— 来源 `pause-settings.md §8.1..10`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-PAUSE-01 | §8-1 | 齿轮 → 暂停 + 遮罩门禁 | `[Node]` | PLAYING 点齿轮 → `game:paused` 恰 1 次、S1=PAUSED、面板可见、**遮罩覆盖棋盘与托盘**；PAUSED 中点遮罩/棋盘/托盘/道具卡**全部零响应**（联合 TC-INP-08） | ✅ `pause-settings.test` §8-1 例 |
| TC-PAUSE-02 | §8-2 | PAUSED 300s 冻结 | `[Node]` | 300s 后继续 → `remaining` 与暂停前一致（≤1 帧 dt）；首个供料**不早于「暂停剩余间隔 +1 帧」**（联合 TC-TIMER-05 / TC-TRAY-08） | ✅ `pause-settings.test` §8-2 例（300s 冻结+feed 死） |
| TC-PAUSE-03 | §8-3 | 重玩本关五项重置 + 无中转 | `[Node]` | 五项逐一断言（倒计时回满 / 图案清空 / 托盘清空 / 扩展重置 / 道具次数回 `POWERUP_FREE_USES`）；S1 **直接回 PLAYING、无 GAME_OVER 中转**。GDD 原注记：第五项在 S6 落地前为「待 S6」真空项、**不得发明伪状态充数** ⇒ S6 已落地（`powerups.test.ts`），本条**现可全断言** | ✅ `pause-settings.test` §8-3 例（五项重置逐一） |
| TC-PAUSE-04 | §8-4 | 音乐/音效开关即档 + 互不影响 | `[Node]` | 各切 2 次：`settings.*` 即档、重启回显一致；**关音乐仍有音效、反之亦然** | ✅ `audio-dispatch.test`（即档/独立） |
| TC-PAUSE-05 | §8-5 | 齿轮热区 + 胶囊避让 | `[Node]` | 齿轮热区 **≥88×88** 且**不侵入** `CAPSULE_AVOID`；面板任何元素**不与胶囊重叠**（布局断言） | ✅ `pause-settings.test` §8-5 例（几何+胶囊避让） |
| TC-PAUSE-06 | §8-6 | 归零 vs 齿轮（**帧内序**基准） | `[Node]` | 基准 = **帧内序：输入（段内序 状态指令 → 玩法事件）→ 连击窗 → 供料 → 计时**。**同帧** → 暂停生效、本帧 dt 不再累计、恢复前不判负；**跨帧**（此前帧已借归零进 GAME_OVER）→ GAME_OVER 生效、无暂停（联合 §E 帧内序用例组） | ✅ `frame-order.test`（帧内执行序） |
| TC-PAUSE-07 | §8-7 | 非 PLAYING 五状态门禁 | `[Node]` | BOOT / LEVEL_CLEAR / GAME_OVER / FINISH / PAUSED 注入齿轮请求 → **零事件零状态变化** | ✅ `pause-settings.test` §8-7 例（五态门禁） |
| TC-PAUSE-08 | §8-8 | 重复暂停幂等 | `[Node]` | PAUSED 中注入 `game:paused` → S5 保存值不变、恢复后 `remaining` 正确（联合 TC-TIMER-09） | ✅ `pause-settings.test` §8-8 例（幂等） |
| TC-PAUSE-09 | §8-9 | sprint 暂停冻结连击窗 | `[Node]` | 连击窗口计时冻结，恢复后从暂停值续算、**不追溯断连**（联合 TC-SPRINT-10 / C8） | ✅ `pause-settings.test` §8-9 例（连击窗冻结） |
| TC-PAUSE-10 | §8-10 | 面板入/出动效帧检 | `[Node]` + `[Cocos]` | 面板**入 ≤200ms** / **出 ≤150ms**（权威 `ux-spec §5`）；红线 ≤3Hz 闪烁。**Node 侧**可断言 `progress` 时间轴（已由 §F F6 覆盖淡出期门禁）；**像素级帧检须 `[Cocos]`** | ⏳ `[Cocos]` 通路已备（`cocos-vision-shot`/frame）—— 帧检判读待 QA |

## H3 · 失败续时（S5 v1.2 增补）— 来源 `timer-gameover.md §8-11/12` + `systems-index §3.11`

| ID | 判据 # | 用例 | 环境 | 预期 / 判据 | 状态 |
|---|---|---|---|---|---|
| TC-TIMER-11 | ✅ `revive.test`（180s 续时/续打/文案常量） | 续时同局续打 | `[Node]` | 构造普通关 GAME_OVER（格已填若干、托盘非空）→ 注入 `onRewarded` → `remaining = REVIVE_BONUS_SEC`、`reviveBonusSec = REVIVE_BONUS_SEC`、`revived=true`、S1 回 PLAYING；**网格 `filled` 计数与托盘槽态与失败前逐一相等**（不走 §2.4 整关重置） | ✅ **已进探针**（T-099 · P29a，判读见 §H.4） |
| TC-TIMER-12 | ✅ `revive.test`（次数上限 REVIVE_MAX_PER_LEVEL/未看完忽略） | 次数上限与未看完 | `[Node]`（需替身注入） | 同尝试第二次续时指令**被忽略**、`remaining` 不增加（`REVIVE_MAX_PER_LEVEL`）；未看完 / 错误回调 → `remaining` 仍为 0、停在 GAME_OVER；**冲刺归零注入续时 → 零加时**（`systems-index §3.10` 末注「冲刺不续时」） | ✅ **已进探针**（T-099 · P29b，判读见 §H.4） |

> **TC-TIMER-12 取证纪律（重要，防假绿）**：harness 当前装的是 `MockRewardedAdProvider('complete')` ⇒ **「看完」分支必然成功**，该路径**不可作为真机广告行为证据**；「未看完 / 错误回调」分支**必须靠替身注入**（构造 `onError` / 不回调），**不得因替身总是 complete 就把该分支标绿**。同理：**续时不能解 BD-06 死局**（`REVIVE_BONUS_SEC` 只加时间不清托盘），验 TC-PER-06 时勿把「续时成功」误读为「已修复」（`ux-spec §4` 尾注已明文警示）。

---

## H.4 §H 进探针（**v1.10 / WXG-T-099 ③ 落地**，2026-09-17）— H2/H3 的 12 条从「文档映射 + vitest」升级为**可复跑探针取证**

**新增探针段**：`g4-probe-v1.2-t099.mjs`（由 `g4-probe-v1.1.mjs` **按行切片**生成，非手抄；helpers 与 v1.1 同口径）——`P28a..j`（`pause-settings §8-1..10` 10 条）+ `P29a/b`（`timer-gameover §8-11/12` 2 条），判据映射与本节 H2/H3 表逐条对齐（TC-PAUSE-0N ↔ P28x；TC-TIMER-11/12 ↔ P29a/b）。

**本轮判读（2026-09-17 20:23）**：`node production/qa/beads/g4-probe-v1.2-t099.mjs` ⇒ **PASS 8 ｜ PASS\* 4 ｜ FAIL 0 ｜ ⛔ 0**。证据：`production/qa/beads/evidence/g4-probe-v1.2-t099.log`（mtime `2026-09-17 20:23:46`；产物新鲜度链 `src 20:21:31 → harness:build dist 20:23:46 → log 20:23:46`，**不早于源码**）。**证据形式裁定（T-099 ④）**：`*.log` 被 `.gitignore:55` 排除 ⇒ 维持**「文档内引用路径 + mtime」**现行做法，**不** `git add -f`、不转 `.md` 摘要；复现命令 = `pnpm run harness:build && node production/qa/beads/g4-probe-v1.2-t099.mjs > production/qa/beads/evidence/g4-probe-v1.2-t099.log 2>&1`。

**四条 PASS\* 的限定（均不得读作全量已验）**：
- **P28b**（§8-2）：原文子句「首个供料不早于『暂停剩余间隔 +1 帧』」因 **v2.0 供料关停**（用户 2026-09-16 案 A）**不可构造** ⇒ 以**零供料反证**替代（同 P26 / §J.1 体例）；判据侧失效**不算实现缺陷**。
- **P28j**（§8-10）：只证 **Node 侧时间轴**（progress 单调 + 入 200ms / 出 150ms 预算内）——单调 ramp 不可能产生闪烁，但「**红线 ≤3Hz 闪烁**」的**像素级帧检**须 `[Cocos]` 真实栅格化 ⇒ 仍 ⛔，**不宣称像素层已验**（`cocos-vision-shot.mjs` 只产取证物、不判读）。
- **P29a/P29b**（§8-11/12）：发奖腿由 harness 替身 `MockRewardedAdProvider` 驱动，只证「请求 → 发奖 → 续打」**结构链路**与**回调分支**（skip/error/第二次拒绝/冲刺零加时均由替身显式注入）；真机激励视频属 `[R]` ⛔（无 AppID）。**续时不解 BD-06 死局**（只加时不清托盘），不得读作该缺陷已修。

**判据时效性核对（先核后判）**：`pause-settings.md §8` 现文仍为 **v1.2（2026-09-12）**，早于 v2.0 反转 ⇒ §8-3 第 2 项按 `timer-gameover §8-6` **v1.3 现文**（恢复初始错位布置）判读，不按 v1.2 旧文把「格未清空」判成缺陷。

**夹具可构造性修复（修探针，非判据放宽；同族发现移交 T-151）**：① `probeLevel` 补 v2.0 必需的 `swaps`/`cycleProfile`（缺则 BOOT 拒收，v1.1 自定义关卡**全部**进不了 PLAYING）；② 取回夹具按 **v2.0 两步式**（点错位珠 → 点空槽）重写，首跑的「点一下即得珠」是 v2.0 之前的模型；③ 新增 `solveBoard099`（v2.0 解算归位）替代 `fillBoard`（棋盘开局全满无空格可填）；④ FINISH 装配等足 `CLEAR_PANEL_DELAY_MS=WAVE_MS=800ms` 延迟门。**v1.1 前序 27 段在 v2.0 下不可跑**（P4 崩于 `s.traySlots[held]`、缺 swaps BOOT 拒收）⇒ 本切片**不跑前序段、不判前序段**，其 54 组整体适配仍归 **WXG-T-151**。

---


# §I 宿主坐标归一化判据（缺陷 C1 回归闸门，**v1.6 / WXG-T-109 新增**）— 来源 `ADR-0011 §3(e)` + `T-104·A4`

> **归属理由（为何单开 §I，不并入 §A / §G）**：本文件的组织法是**「每一节 = 一个判据来源家族」** —— §A = 9 份 GDD §8 的 1:1 映射（50 条 = 5 组 × 10，头部与合计表按此计数）；§B = `systems-index §3` / accessibility；§C = `score-combo §8`；§D = `powerups §8`；§E = `core-loop §2.2.2` 帧内序；§F = `ux-spec`；§G = 可感知性规格层四件套；§H = 未映射 §8 补编。R1/R2/R3 的来源是 **`ADR-0011 §3(e)`「宿主归一化契约」+ `WXG-T-104·A4` 实测判据** —— **既非 GDD §8、也非 §G 的规格层**（ux / assets / audio / accessibility）⇒ 并入任一既有组都会**污染该组的来源谱系**，故**新开 §I**。
>
> **ID 选号**：取 `TC-COORD-*`（坐标契约），**不取 `TC-HOST-*`** —— 探针里 `HOST-01/02/03` 是「宿主 **accessor 级**」断言的**另一组 ID**，同名会混。T-104 A4 的代号 **R1 / R2 / R3 保留在「判据代号」列**，与探针判定函数 `judgeR1 / judgeR2 / judgeR3` 同名，使三方（`T-104 A4` ↔ 探针用例 ID ↔ 本表）**可对**。
>
> **本节补什么窟窿**：缺陷 C1（Cocos 宿主输入 **y 轴镜像 + ×dpr**；真机两轴全错）在 **184 例 vitest 全绿**下仍然发生 —— 正是 §G.0 所述「逻辑可断言型判据对画面 / 坐标类缺陷判别力为零」的同族。WXG-T-108 已把它固化为**可复跑探针**；本节把它**升为门控用例**，使「只跑用例表」的回归也能覆盖此类（本仓已因此重复踩过四次同族坑）。
>
> **道次图例（本节用 T-108 探针的 lane 标记，映到文首图例）**：`[N]` = **无头浏览器逻辑层**（真实 Chromium 载 Cocos web-mobile 产物 + 打桩 `input.push` + 读 snapshot）≈ 文首 `[Node]` 族产物道次 ｜ `[B]` = **浏览器真实渲染像素级**（截图 + PNG 解码）≈ 文首 `[Cocos]` 已解锁像素道次 ｜ `[R]` = **真机 / 微信小游戏宿主** = 文首 `[Device]`。
>
> **本轮（WXG-T-109）取证**：`node production/qa/beads/cocos-input-probe.mjs` ⇒ **退出码 0 ｜ PASS 18 ｜ FAIL 0 ｜ ⛔ 2**（2026-09-15T14:03:12Z，耗时 23.2s）；证据 `evidence/t109/cocos-input-probe-t109.log` + `evidence/t109/*.png`（本轮用独立 `--out=evidence/t109` 落盘，**不覆盖** T-108 的冻结证据 `evidence/cocos-input-probe.log`）。探针 `SELF-01` 以 T-104 记录的**修复前**数字为反例，四个判定函数**全部返回不通过** ⇒ **判别力有反例证明，非恒真**。

## I.1 主判据（3 条）

| ID | 判据代号 | 用例 | 环境 | 判据原文 / 预期 | 预期值来源（`T-104` 实测 · `ADR-0011 §3(e)` · 探针用例 ID） | 状态 |
|---|---|---|---|---|---|---|
| **TC-COORD-01** | **R1** | **端到端命中 + 反证** | `[N]` | 点托盘槽 0 的**可见屏幕位置** ⇒ `traySelected===0` 且 `slot0.state==='selected'`、`_pointer` 回读 ≈ 槽心（±6 设计px）；点其**上下镜像位置** ⇒ `traySelected===-1`；**判别力 guard**：可见 y 与镜像 y 相差 ≥100px | **`T-104·A4-R1` 实测**（1280×720）：可见点 `(478.6,496.6)` ⇒ `traySelected=0`、`_pointer=(76.70,413.17)` vs 槽心 `(76,414)`；镜像点 `(478.6,223.4)` ⇒ `traySelected=-1`、`_pointer=(76.70,920.83)`（离槽心 **506.8** 设计px）；guard **273.1px**。**修复前恰好相反** · `ADR-0011 §3(e)-1`（adapter 再翻一次 y 是**必需**、非「双重翻转」——早期理解反了才产生 C1） · 探针 **`R1-01+R1-02`**（信箱档 `R1-03+R1-04`；dsf2/3 端到端 `R3-02`/`R3-03`） | ✅ **已验**（WXG-T-109 复跑 / `R1-01+R1-02`+`R1-03+R1-04`+`R3-02`+`R3-03` 全 PASS） |
| **TC-COORD-02** | **R2** | **数据流：push ≈ 页面坐标** | `[N]` | 每次点击 `InputManager.push(down)` 收到的 `push.x ≈ pageX−rect.x`、`push.y ≈ pageY−rect.y`（±1.5px，**镜像点与可见点两次都要成立**）；且 `push.y` **不等于**旧口径 `canvasHeightCss − pageY`（差 ≥100px ⇒ 证非镜像值） | **`T-104·A4-R2` 实测**：两次点击 `push(down)=(479,223)`/`(479,497)` vs 页面相对 Δ=**(0.4,0.4)**；反镜像 guard：与旧式 `canvasH−pageY` 相差 **273.6px** · `ADR-0011 §3(e)-2`（必须**同时** ÷dpr 与 y 翻转） · 探针 **`R2-01`**（宿主 accessor 同族 `HOST-01/02/03`、封顶口径反证 `HOST-03b`；breakout 数据流 `BR-01`） | ✅ **已验**（WXG-T-109 复跑 / `R2-01` PASS） |
| **TC-COORD-03** | **R3** | **dpr 不变性（封顶 2）** | `[N]` | dpr=1/2/3（引擎封顶 2）三档下点**同一可见点** ⇒ 落点一致（`push` 三档两两差 ≤1.5px）；且 dsf≥2 时 `raw.x ≈ page × dpr`（证明 ÷dpr 真被行使，**排除恒等退化**） | **`T-104·A4-R3` 实测**：三档同一页面点 ⇒ `push=(479,497)` **完全一致**（两两差 **0.0px**）；`raw.x`=479/958/958 = `page×dpr`（修前 dsf≥2 为 `(958,994)`） · `ADR-0011 §3(e)-3`（dpr 必须与输入源同源：`cc.screen.devicePixelRatio`，web 封顶 2 / 小游戏无封顶）与 **§4.2(0)**（DPR 须**显式注入**，否则无头 CI 下断言退化为恒真而静默失效） · 探针 **`R3-01`** | ✅ **已验**（WXG-T-109 复跑 / `R3-01` PASS） |

## I.2 ⛔ 未测道次（**不得记 PASS，亦不得记 FAIL**）

| ID | 道次 | 环境 | 阻塞原因 | 解除条件 |
|---|---|---|---|---|
| **DEV-01** | 微信小游戏宿主 `getLocation()` / `push` 复取 | `[R]` | **无真机、无 AppID ⇒ 未实测**。源码 `pal/input/minigame/touch-input.ts:86-90` 与 web **同形**（左下原点 + ×pixelRatio），但 `pal/screen-adapter/minigame` **无 2 封顶** —— 属**读源码**、非实测，**不得写为已验证** | ① 有效 **AppID**；② `pnpm --filter @wxgame/{beads,breakout} run build:cocos:wx` 出包；③ 微信开发者工具 / 真机可跑；④ 用同一探针在 `wx` 宿主复取三个 accessor 与 `push` 值；**真机首验须把「点击落点 / 托盘选中 / dpr 缩放」列 P0**（`ADR-0011 §4.2(10)`） |
| **DEV-02** | wechatgame 平台构建（`build:cocos:wx`） | `[⛔]` | 缺有效 **AppID** ⇒ 无法出包 ⇒ 上条 `[R]` 的前置亦不成立 | 同上 ①；解除后方可执行 **DEV-01** |

> **口径纪律**：`DEV-01 / DEV-02` 属**环境阻塞**，**严禁**读作 PASS（无真机时任何「真机已验」均为假绿）；亦**不记 FAIL**（未测 ≠ 不成立）。本节 3 条 `[N]` 可执行用例**已全绿**，唯此 2 条 `[R] / [⛔]` 未测 ⇒ **门控时须按「未测」处理，不得当「已过」**（见文末门禁建议）。

## I.3 自证：三条判据 ↔ 探针对应用例（一一对上）

| 本节用例 | 探针 `cocos-input-probe.mjs` 用例 ID | 判定函数 | 本轮探针结论 |
|---|---|---|---|
| TC-COORD-01（R1） | `R1-01+R1-02`（主）/ `R1-03+R1-04`（500×1000 信箱）/ `R3-02`+`R3-03`（dsf2/3 端到端） | `judgeR1` | 全 ✅ PASS |
| TC-COORD-02（R2） | `R2-01`（主）/ `HOST-01`+`HOST-02`+`HOST-03`+`HOST-03b`（accessor 同族+封顶反证）/ `BR-01`（breakout 数据流） | `judgeR2` / `judgeHost` | 全 ✅ PASS |
| TC-COORD-03（R3） | `R3-01` | `judgeR3` | ✅ PASS |
| DEV-01 / DEV-02（⛔） | `DEV-01` / `DEV-02`（脚本内 `DECLARED_BLOCKED`） | —（不判定，仅登记） | ⛔（预期阻塞，不计退出码） |

> **复跑命令**：`export PATH="$HOME/.workbuddy/binaries/node/workspace/node_modules/.bin:$PATH"` → `node production/qa/beads/cocos-input-probe.mjs`（前置：产物须为当前代码所建，脚本 `ENV-*` 门会拦陈旧产物）。**退出码语义**：`0` 全绿 ｜ `1` 有 FAIL（真回归）｜ `2` 无 FAIL 但有**未预期**阻塞 / 探针无效（**不得当绿**）｜ `3` 脚本级环境错误。

---

