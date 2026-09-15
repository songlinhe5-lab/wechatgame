# 音频事件表（Audio Event Table）· beads

- 项目：`games/beads`（拼豆填色消除）· 版本 v1.1 · 任务号 WXG-T-083（GAP-05）；§4 判据主体归位（冲突 C1）/ §1 时长列分流（冲突 C3，新增 §1.1）：WXG-T-103（2026-09-15）
- 方法论：`my-skills/wxgame-audio-spec/SKILL.md` §2（**框架版**：未定数值一律 `[TODO]`，不产伪数值）
- 配套：`audio-spec.md`（方向/混音/BGM/实现/验证矩阵）；本篇 = 事件表 + 逐事件验收判据
- **权威来源纪律**：每一行都必须追溯到 `ux/ux-spec.md` **§5 动效毫秒表**的一行或 `gdd/systems-index.md` **§4 事件总线**的一个事件。**§5 未列的音效一律不发明**（见 §5 未纳入清单）。
- 时长口径：本篇所有 ms 值**引自 ux-spec §5**（唯一真源），本表不重定义、不改值；冲突以 §5 为准并回写本篇（经主理人）。
- **时长列写法三形式（WXG-T-103 / C3 统一）**：`N` = 规格时长（`[B]` 以 N 为**期望值**比对，容差由探针自定并写进报告）；`≤N` = **上限/窗口**（`[B]` 只断言实测 ≤ N，**不得**把 N 当期望值等值比对）；`[TODO]` = **规格未定**（`[B]` 无期望值可比 ⇒ 该子句记 ⛔，**不判 FAIL**）。7 处非纯数字的逐条分流见 §1.1。
- **`[TODO]` 与工程占位不得互引（WXG-T-103 总口径）**：时长列的 `[TODO]` = 规格未定；`src/config/audio-voices.ts` 的 `durationMs` = **工程占位**（让后端能响），**不构成规格、不得被任何判据回引为期望值**；反向也不得拿占位值把规格「转正」（同 `systems-index §3.12`「音色实现参数不属于 §3」令）。

---

## 0. 前置约定

| 项 | 约定 | 依据 |
|---|---|---|
| clip id 命名 | `sfx_*`（音效）/ `bgm_*`（音乐）；**代码只引用 id，不引用文件名** | `src/config/tuning.ts` L351-357 现状；SKILL §2 规则 |
| 已存在 id（不得改名） | `bgm_main` / `sfx_ui_tap` / `sfx_star` | `tuning.ts` L353/355/357；184 测试绿，改名即破坏 |
| Bus 归属 | 由 id 前缀派生（`bgm_*`=Music；`sfx_ui_*`/`sfx_panel_*`/`sfx_star`/`sfx_ui_tap`=UI；其余 `sfx_*`=SFX） | `audio-spec.md` §2.1；core 无 bus 概念，故以命名空间承载 |
| **「同帧」的可断言定义** | 同一次 `App.tick(frameDt)` 内：玩法事件广播 → 音频请求入 `AudioScheduler._pending` → 帧末 `flush()` 派发到 backend；视觉态在**同 tick** 的 `buildRenderModel()` 中出现 | `compose/app.ts` L143-148（`loop.advance()` 后才 `audio.flush()`）；`fixedDt = 1/60`（`core/loop/game-loop.ts` L51）⇒ 1 帧 = 16.67 ms |
| 状态列语义 | `待做` / `已做` / `已验收`（SKILL §6：判据挂状态列，不另立体系；本篇 §4 的判据逐条以事件 ID 为键，即该列的展开） | SKILL §6 |
| 判据道次标记 | `[N]` Node vitest 今天可断言 / `[B]` 待 Web Audio 后端（harness 可听） / `[C]` Cocos 构建产物可验 / `[R]` 待真机（开发者工具+AppID） / `[P]` 阶段 6 Playtest 人耳 | `audio-spec.md` §5 |

---

## 1. 事件表（覆盖 ux-spec §5 全部 17 行）

> §5 实为 **17 行**（任务单口径「13 类」为归并计数：连击三档合一、面板入/出合一、续时两态合一）。本篇按**逐行**对齐，不做归并，避免漏项。

| ID | 触发源事件（systems-index §4） | §5 行 | 时长 (ms) | 音效描述（§5 原文，不自创） | 对齐的视觉通道（同帧） | 状态 |
|---|---|---|---|---|---|---|
| `sfx_place` | `bead:placed` | 珠子落座 | 120 | 落座"嗒"（软） | `vfx_fill_pop` scale 1.06→1.0 | 待做 |
| `sfx_select` | `tray:selected` | 托盘选中 | 100 | 轻"啵" | 上移 4px + 投影加深 + 圆点 | 待做 |
| `sfx_reject` | `bead:rejected` | 放错拒绝 | 200 | 低"咚"（≤2 次/秒） | `vfx_wrong_shake` ±3px ×2 + danger 描边闪 2 次 | 待做 |
| `sfx_dissolve` | `powerup:used` | 消除（道具） | 200 | 溶解"沙" | `vfx_clear_dissolve` scale→0.6 淡出 | 待做 |
| `sfx_powerup` | `powerup:used` | 道具生效 | 400 | 魔法"叮" | 全屏轻扫光 | 待做 |
| `sfx_combo_t1` | `combo:up`（`tier=1`，×2） | 连击 ×2（Lv1） | 200 | 上行双音 | 珠面星光粒子 3–5 枚 | 待做 |
| `sfx_combo_t2` | `combo:up`（`tier=2`，×3） | 连击 ×3（Lv2） | 150 | 三连上行音 | 全屏 scale 1.00→1.015→1.00 伪震屏 | 待做 |
| `sfx_combo_t3` | `combo:up`（`tier=3`，×5） | 连击 ×5（Lv3） | 350 | 和弦爆发 | 边缘径向光 + 珠面波浪 | 待做 |
| `sfx_combo_break` | `combo:break`（`reason` 两值同一音） | 连击断连 | 150 | 下行单音 | 倍率角标灰缩消失 | 待做 |
| `sfx_urgent_beat` | `timer:urgent`（**首拍**）+ `timer:tick` 且 `remaining ≤ TIMER_URGENT_T`（**后续每拍**） | 倒计时告急 | ≤1000 | 心跳节拍（同周期） | danger 色 + 1000ms α 脉冲循环 | 待做 |
| `sfx_tray_full` | `tray:full` | 满槽告警 | ≤500 | 轻提示音 1 次 | 托盘描边呼吸 500ms 循环 | 待做 |
| `sfx_stage` | `sprint:stage` | stage 切换（冲刺） | 500 | 换场"唰" | 旧图波浪淡出 → 新图波浪淡入 | 待做 |
| `sfx_clear` | `level:cleared` | 过关庆祝 | 800 | 胜利琶音 | `vfx_complete_wave` 逐列弹跳 20ms/列 | 待做 |
| `sfx_star` | 结算面板逐星入场（`clear-panel.starsShown` 递增帧）；通关画面逐关入场（`finish-panel.rowsShown`） | 结算星入场 | 150 | 每星"叮"上行 | 逐颗 scale 0→1.2→1 弹跳 | **已做**（接线在 `beads-game.ts` L1236/L1248） |
| `sfx_panel_in` | 面板入（PAUSED / LEVEL_CLEAR / GAME_OVER / FINISH 入场的动效首帧） | 面板入 | 200 | 抽屉音 | scale 0.9→1.0 | 待做 |
| `sfx_panel_out` | 面板出（恢复 / 下一关 / 重试 的出场动效首帧） | 面板出 | 150 | 抽屉音 | 淡出 | 待做 |
| `sfx_revive_ok` | 续时成功回 PLAYING（`onRewarded` → `remaining += REVIVE_BONUS_SEC` 帧） | 续时成功 | ≤400 | 轻「叮」 | 面板出 + 胶囊数字跳到 N | 待做 |
| `sfx_reject`（**复用**） | 续时未看完（中途关 / 失败 / 未看完，零加时） | 续时未看完 | 200 | 低「咚」（≤2 次/秒） | 面板不动；主钮轻抖 1 次 | 待做 |
| `sfx_ui_tap` | 面板按钮点击（现状 7 处调用） | —（**§5 无独立行**） | `[TODO]` | 轻点音（现状注释自称「抽屉音」） | 按钮态视觉 | **已做**（但 §5 归位待裁，见 §5 未纳入 Q-A05-1） |
| `bgm_main` | BOOT 装配 / `settings.bgmMuted` 解除静音（`loop: true` 长驻） | —（BGM 不属 §5） | `[TODO]` | 见 `audio-spec.md` §1/§3 | — | **已做**（调用在 L1475/L1477；**内容为零**） |

**计数**：19 个 clip id（18 SFX + 1 BGM）＝ 已存在 3（`bgm_main`/`sfx_ui_tap`/`sfx_star`）+ 新增 16。
`powerup:used` 一行触发**两条** clip（`sfx_powerup` + `sfx_dissolve`，同帧分层）；「续时未看完」复用 `sfx_reject`（§5 两行音效描述逐字相同：低「咚」、≤2 次/秒）⇒ 事件行数 17 ↔ clip 数 18（SFX）非 1:1，对账见 §2。

### 1.1 时长列分流表（WXG-T-103 / 冲突 C3：原 7 处非纯数字逐条裁定）

> **分流规则**：**甲** = 可凭既有真源定值，真源**只认三处**（`systems-index §3.12` 的 `AUDIO_*`、`ux-spec §5` 对应行、`audio-spec §4.3` 已有的明确建议值）；**乙** = 必须等真人/真机道次 ⇒ 保持 `[TODO]` 但写明解除条件与工程占位值。**本轮零新增数值**：甲类 5 项是把 §5 原值换成本表三形式写法（含把「周期/窗口/红线」从「发声时长」里剥出来），乙类 2 项维持挂起。

| clip | 甲/乙 | 时长列 | §5 原文写法 | 依据锚点 / 口径 / 解除条件 / 占位值 |
|---|---|---|---|---|
| `sfx_urgent_beat` | **甲** | `≤1000` | `1000/循环` | 1000 = **心跳周期**（§3.12 `AUDIO_URGENT_BEAT_PERIOD` = 1.0 s = `TIMER_TICK`；§5 行 10 同值）。⚠️ 形式 = 上限窗口：单拍发声短于 1000 ms 是**正确形态**，周期由 A05-11 `[N]` 断言；不得按「实测 = 1000」判 FAIL。包络数值仍属 §4.3 / `audio-spec §8` T3 `[TODO]` |
| `sfx_tray_full` | **甲** | `≤500` | `500/循环（音只 1 次，视觉循环）` | 500 = §5 行 11 的**描边呼吸周期**，本表按 §4.3 原列口径「500 ms 视觉周期内 1 次」引用为**发声窗口上限**（未造新数）。「音只 1 次」= **派发次数**，判据 A05-14 `[N]`，不写在时长列。占位 500 ms（`audio-voices.ts`，仅工程）。⚠️ **若主理人裁「提示音应有独立发声时长」⇒ 本行降乙**（§5 与 §3 均无该值，我不造） |
| `sfx_stage` | **甲** | `500` | `250+250` | = §5 行 12 两段原值的**算术和**（非发明）。出/入各 250 ms 的**分段对齐**判据 = A05-15 `[B]` |
| `sfx_star` | **甲** | `150` | `150×3` | 150 = §5 行 14 单颗时长；`×3` 是**派发次数**（3★ 局恰 3 次），判据 A05-17 `[N]`，不并入时长列 |
| `sfx_revive_ok` | **甲** | `≤400` | `150 出 + ≤400 反馈红线` | 400 = §5 表头统一红线「反馈 ≤400ms（庆祝/结算除外）」在该行的显式复述，A05-19 同值。原文「150」指**视觉面板出场**时长（= §5「面板入/出 200 / 150」行 ⇒ 归 `sfx_panel_out`），不是本 clip 时长 ⇒ 已剥离，避免两 clip 抢同一数值。占位 250 ms（仅工程，与 ≤400 相容） |
| `sfx_ui_tap` | **乙** | `[TODO]` | —（§5 无行） | **解除条件** = §5 Q-A05-1 经主理人裁决 + `ux-spec §5` 增「面板按钮点击」行（UX 域，**我不改**）⇒ 取该行值。**不依赖 `[B]/[R]` 实测**（缺口在规格不在听感）。占位 **40 ms**（`audio-voices.ts`，工程占位不得回引）。同步项 `audio-spec.md` §8 T4 |
| `bgm_main` | **乙** | `[TODO]` | —（BGM 不属 §5） | **解除条件** = 唯一的循环类挂起项：A05-21 `[B]`（无缝循环）+ A05-22 `[B]+[R]`（幂等、回前台不跳针）跑完，并按 `audio-spec.md` §3.2 硬要求**试听循环点**后定档。§4.3/§3.2 的「30–60 s」是**设计约束区间不是期望值**，探针不得拿它比对。占位 **8000 ms**（`audio-voices.ts` `BGM_LOOP_MS`，其注释自陈 `[TODO]`）。同步项 T2 |

**未分流项对账**：其余 13 行时长列本就是纯数字（120/100/200/200/400/200/150/350/150/800/200/150/200，含 `sfx_reject` 复用行），逐条与 §5 对过无差异 ⇒ 不动；形式全部为 `N`（期望值）。

---

## 2. 覆盖对账（双向闭合，零发明 / 零遗漏）

### 2.1 §5 → clip（正向：无遗漏）

| §5 行号 | 行名 | clip | 备注 |
|---|---|---|---|
| 1 | 珠子落座 | `sfx_place` | 1:1 |
| 2 | 托盘选中 | `sfx_select` | 1:1 |
| 3 | 放错拒绝 | `sfx_reject` | 1:1；限流 ≥0.5s（§3.2） |
| 4 | 消除（道具） | `sfx_dissolve` | 与行 5 同源同帧分层 |
| 5 | 道具生效 | `sfx_powerup` | 与行 4 同源同帧分层 |
| 6/7/8 | 连击 ×2/×3/×5 | `sfx_combo_t1/t2/t3` | 按 `combo:up.tier` 三档分流 |
| 9 | 连击断连 | `sfx_combo_break` | `reason` 两值不区分音色（§5 只一行） |
| 10 | 倒计时告急 | `sfx_urgent_beat` | 心跳周期 = `TIMER_TICK`(1.0s) = §5 脉冲 1000ms，**同周期同相** |
| 11 | 满槽告警 | `sfx_tray_full` | 音 1 次 / 视觉 500ms 循环（§5 原文即如此，非我拆分） |
| 12 | stage 切换 | `sfx_stage` | 250+250 双段（出+入） |
| 13 | 过关庆祝 | `sfx_clear` | 1:1 |
| 14 | 结算星入场 | `sfx_star` | 已实现，逐颗 150ms |
| 15 | 面板入 / 出 | `sfx_panel_in` + `sfx_panel_out` | 一行两态 ⇒ 两 clip（200 / 150 时长不同，单 clip 无法承载） |
| 16 | 续时成功 | `sfx_revive_ok` | 1:1 |
| 17 | 续时未看完 | `sfx_reject`（复用） | §5 描述与行 3 逐字相同 |

**结论：17/17 行全覆盖，零遗漏。**

### 2.2 clip → §5（反向：无发明）

19 个 clip 中，18 个可指向 §5 的某一行；**唯一例外 = `sfx_ui_tap`**（已落码、§5 无对应行）与 `bgm_main`（BGM 不属 §5 管辖，归 `audio-spec.md` §3）。
⇒ `sfx_ui_tap` 登记为**实现先行、规格待归位**（不是我发明的新音效，是既有代码事实），处置见 §5 Q-A05-1。
**本表未新增任何 §5 之外的玩法音效**：明确否决了「告急进入独立 sting」「失败悲情音」「供料入槽音（`tray:spawned`）」「过关逐列分层音」「UI 口播/人声」「冲刺 BGM 换曲」**六条候选**——§5 无行（或超出 §5 单条描述），一律不做（逐条理由见 §5）。

---

## 3. 混音属性表（优先级 / 抢占 / 限流）

### 3.1 优先级与可抢占性

> 事实前提：`AudioScheduler.flush()` 按 `_pending` **入队序**取前 `maxPerFrame`（默认 **6**）个**不同** clip id 派发，同帧同 id 去重（`core/audio/audio.ts` L105-117）。core **无 priority 字段** ⇒ 现阶段「优先级」= **入队序 + 限流**，真正的抢占需框架扩展（`audio-spec.md` §6.2 需求单第 5 项）。

| 档 | clip | 可被抢占 | 理由 |
|---|---|---|---|
| **P0**（缺了体验崩 / 双通道红线） | `sfx_reject`、`sfx_urgent_beat`、`sfx_clear`、`bgm_main` | **否** | 拒绝=唯一否定反馈通道；告急=时间压力唯一听觉通道；过关=「修复完成爽感」支柱顶点；BGM 长驻非瞬时占用 |
| **P1**（核心手感） | `sfx_place`、`sfx_combo_t1/t2/t3`、`sfx_powerup`、`sfx_dissolve`、`sfx_revive_ok` | 仅被 P0 挤占 | 落座=「解压」支柱主载体；连击三档=冲刺节奏骨架 |
| **P2**（打磨，可让步） | `sfx_select`、`sfx_star`、`sfx_panel_in/out`、`sfx_ui_tap`、`sfx_tray_full`、`sfx_stage`、`sfx_combo_break` | **是** | 均有独立视觉通道，缺一帧不损可玩性 |

**同帧最坏情形核算**（据 §1 触发源穷举）：`powerup:used` 帧 = `sfx_ui_tap`+`sfx_powerup`+`sfx_dissolve` = 3；冲刺 stage 完成帧 = `sfx_stage`+`sfx_clear`+`sfx_place`+`sfx_combo_t*` = 4；过关帧 = `sfx_clear`+`sfx_panel_in`+`sfx_star` = 3；告急期落座帧 = `sfx_urgent_beat`+`sfx_place`+`sfx_select`+`sfx_combo_t1` = 4。**均 ≤6** ⇒ MVP 不依赖抢占即可无损；`maxPerFrame=6` 作为**回归护栏**冻结（拟增常量，见 `audio-spec.md` §7.2）。

### 3.2 限流（`AudioPlayOptions.minInterval`，单位 s）

> ⚠️ **现状缺陷（必须修）**：`beads-game.ts` L1484 的 `_sfx()` 对**所有** clip 统一传 `minInterval: 0.05`。0.05s ⇒ 理论 20 次/秒，**违反** `systems-index §3.8`「错误反馈 ≤2 次/秒」与 §5「低咚 ≤2 次/秒」。限流必须**按 clip 分档**，不能一刀切。

| clip | `minInterval` | 依据 |
|---|---|---|
| `sfx_reject` | **0.5** | §3.8 + §5「≤2 次/秒」硬性红线（换算 1/2 Hz） |
| `sfx_urgent_beat` | **0.9** | 周期 = `TIMER_TICK` 1.0s，留 0.1s 余量吸收 fixedStep 累加抖动，防偶发双拍 |
| `sfx_tray_full` | **1.0** | 事件本身间隔 ≥ `SPAWN_INTERVAL` 下界 2.0s（§3.4），1.0s 仅作防御 |
| `sfx_place` / `sfx_select` | **0.05**（沿用现状） | 高频短音需保留连打手感；防糊靠**音色短促 + 同帧去重**而非拉长限流（`audio-spec.md` §2.4） |
| 其余（一次性事件音） | **0**（不限流） | 由状态机天然单次触发（过关/结算/面板/续时/stage） |

---

## 4. 逐事件可执行验收判据（供 WXG-T-084 引用）

> 判据以事件 ID 为键（SKILL §6：不另立体系）。道次标记见 §0。**所有 `[N]` 判据今天即可写进 vitest**（用 `NullAudioBackend.played` + `helpers.advance(1/60)`）；`[B]/[R]/[P]` 判据在后端/工具落地前**不得记为已验收**（防假绿，AGENTS §7）。
> **时长子句解释口径（WXG-T-103 / C3）**：判据中的时长数值一律取 §1 该 clip 的时长列**并按其形式判定**——`N` = 期望值（等值比对含容差）、`≤N` = 上限（只断言 ≤）、`[TODO]` = 无期望值 ⇒ 记 ⛔ 不判 FAIL；**禁止**用 `audio-voices.ts` 的占位 `durationMs` 充当期望值。
> **A05-09 拆分（WXG-T-103 / C1）**：原 A05-09 把「伪震屏 scale 1.015」挂在 `sfx_combo_t3` 名下，而 §1 行 7、`ux-spec §5`「连击 ×3（Lv2）」行与 `systems-index §3.10`「伪震屏……连击 Lv2（×3）特效」三处一致表明**伪震屏属 Lv2（tier=2）**（`view/combo-vfx.ts` SPECS：tier=2→`pseudoShake`，tier=3→`burst`）⇒ 该子句按现文不可判定。现把**主体改到 tier=2**（A05-09），t3 的时长·同帧半边**另立 A05-09b**（编号不重排，QA 台账追加一行即可，覆盖不缩水）。

| # | 事件 ID | 判据（可执行） | 道次 |
|---|---|---|---|
| A05-01 | `sfx_place` | 广播 `bead:placed` 的那一 `tick(1/60)` 内入队，帧末 `flush()` 后 `backend.played` 新增且**仅新增** `sfx_place`；同 tick 的 render model 中该格呈 `vfx_fill_pop` 起始态（scale=1.06 侧）⇒ 音视频同帧 | `[N]` |
| A05-02 | `sfx_place` | 端到端延迟 ≤1 帧（16.67 ms）：从事件广播到 `backend.play()` 之间不跨越第二次 `flush()` | `[N]` |
| A05-03 | `sfx_place` | 实际发声时长 ≤120 ms（§5）；软起音、无 click 爆音 | `[B]`+`[P]` |
| A05-04 | `sfx_select` | `tray:selected` 帧内入队 `sfx_select`，时长 ≤100 ms；同帧托盘珠呈上移 4px 态 | `[N]`（入队/同帧）·`[B]`（时长） |
| A05-05 | `sfx_reject` | `bead:rejected` 帧内入队；**连续 10 次拒绝注入（间隔 0.1s）后 `played` 中 `sfx_reject` 计数 ≤ 该窗口秒数 ×2**（≤2 次/秒红线） | `[N]` |
| A05-06 | `sfx_reject` | `minInterval === 0.5`（限流表 §3.2），非全局 0.05 | `[N]` |
| A05-07 | `sfx_dissolve` + `sfx_powerup` | 一次 `powerup:used` ⇒ 同帧**两条**均入队且均派发（同帧分层不被去重吞掉：两者 id 不同）；`affectedSlots` 为空时**零发声**（powerups §4「无效果反馈＝零噪声」） | `[N]` |
| A05-08 | `sfx_combo_t1/t2/t3` | `combo:up.tier` = 1/2/3 分别且仅派发 `t1/t2/t3`（三档不串音）；`tier=0`/未升档帧**零发声** | `[N]` |
| A05-09 | `sfx_combo_t2`（`combo:up.tier=2`，×3） | 时长 = 150 ms（§1 形式 `N`）；且与**伪震屏**同帧起始——同一 `tick(1/60)` 内派发 `sfx_combo_t2`，且该 tick 的 render model `comboVfxKind === 'pseudoShake'` 且 `comboVfxProgress` 处起始侧（`tier=1`/`tier=3` 帧必须为 `particles`/`burst`，不得串档）。**主体归属真源**：§3.10「伪震屏：连击 Lv2（×3）特效，150ms」+ §5 行 7。**诚实边界**：`game/state.ts:172` 自陈「Lv2 整屏 scale 需全局变换通道，当前渲染管线没有」⇒ 本判据只断言 **kind 与同帧**，`scale 1.00→1.015→1.00` 的**画面呈现**另归 `[C]`/`[B]` 视觉取证（属 GAP-04 渲染缺口，不在本条判 FAIL） | `[N]`（同帧·kind）·`[B]`（时长） |
| A05-09b | `sfx_combo_t3`（`combo:up.tier=3`，×5） | 时长 = 350 ms（§1 形式 `N`）；且与**同档视觉**（边缘径向光 + 珠面波浪，§5 行 8 ⇒ `comboVfxKind === 'burst'`）同帧起始。**本条 = 拆分前 A05-09 的 t3 时长半边换了正确视觉主体**，伪震屏不再挂本条 | `[N]`（同帧·kind）·`[B]`（时长） |
| A05-10 | `sfx_combo_break` | `combo:break` 两种 `reason`（`wrong`/`timeout`）均派发同一 clip 各 1 次；`reason='wrong'` 时**同帧另有** `sfx_reject`（两者并存不互斥，红线优先） | `[N]` |
| A05-11 | `sfx_urgent_beat` | `remaining` 下穿 `TIMER_URGENT_T` 的那一帧派发**首拍**（由 `timer:urgent` 边沿驱动）；其后**每个** `timer:tick`（`remaining ≤ TIMER_URGENT_T`）各派发 1 拍，相邻两拍间隔 = 1.0 ±0.05 s ⇒ 与 1000ms α 脉冲同周期同相 | `[N]` |
| A05-12 | `sfx_urgent_beat` | 解除条件：`remaining` 回到阈值以上（stage 加时 / 续时）后**停止**心跳；PAUSED 期间零拍（计时冻结 ⇒ 无 tick） | `[N]` |
| A05-13 | `sfx_urgent_beat` | 听觉闪烁红线：拍频 ≤3 Hz（实为 1 Hz），与 §3.8 视觉闪烁红线同源同界 | `[N]`（周期断言）·`[P]`（主观不致疲劳） |
| A05-14 | `sfx_tray_full` | 每次 `tray:full` 派发 1 次（**不循环**）；托盘描边呼吸视觉独立按 500ms 循环，两者互不驱动 | `[N]` |
| A05-15 | `sfx_stage` | `sprint:stage` 帧内派发；250+250 双段结构（出段+入段）与旧图淡出/新图淡入分段对齐 | `[N]`（派发）·`[B]`（双段） |
| A05-16 | `sfx_clear` | `level:cleared` 帧内派发，时长 ≤800 ms；与 `vfx_complete_wave` 首列弹跳同帧起始（逐列 20ms 延迟属视觉，音频不做逐列分层——见 §5 未纳入） | `[N]`+`[B]` |
| A05-17 | `sfx_star` | 结算面板每颗新入场星各派发 1 次（3★ 局恰 3 次，不重播）；通关画面每关行入场各 1 次 | `[N]`（现状已可测） |
| A05-18 | `sfx_panel_in`/`sfx_panel_out` | 面板入场动效首帧派发 `in`（≤200 ms）、出场首帧派发 `out`（≤150 ms）；四个面板态（PAUSED/LEVEL_CLEAR/GAME_OVER/FINISH）均覆盖；遮罩拦截点击（面板外）**零发声** | `[N]` |
| A05-19 | `sfx_revive_ok` | `onRewarded` 使 `remaining += REVIVE_BONUS_SEC` 的帧内派发；反馈总时长 ≤400 ms 红线；**未看完/中途关 ⇒ 零 `sfx_revive_ok`**（零加时零奖励音） | `[N]` |
| A05-20 | `sfx_reject`（续时未看完） | 未看完路径派发 `sfx_reject` 且受同一 0.5s 限流（连点主钮不产生 >2 次/秒） | `[N]` |
| A05-21 | `bgm_main` | BOOT 完成即入队 `{loop:true}` 恰 1 次；`bgmMuted=true` ⇒ `stop('bgm_main')` 且此后零重入队；`false` ⇒ 重新入队（现状已断言，`pause-settings.test.ts` L286-318） | `[N]`（已绿）·`[B]`（无缝循环） |
| A05-22 | `bgm_main` | **幂等**：重复 `play('bgm_main',{loop:true})` 不得重启播放位置（backend 契约，需后端实现） | `[B]`+`[R]` |
| A05-23 | 全表·静音可玩 | `sfxMuted=true` ⇒ 任意玩法事件注入后 `pendingCount === 0`（`_sfx()` 门控）；`bgmMuted=true` 且 `sfxMuted=false` ⇒ SFX 照常、BGM 静默（双通道独立，S9 §8-4 已绿）；**两开关全关时游戏全流程可通关**（8 关 + 冲刺 + 续时路径零阻塞） | `[N]` |
| A05-24 | 全表·清单闭合 | `tuning.ts` 导出的音频 clip 常量集合 **==** 本表 §1 的 19 个 id（双向：无孤儿常量、无未登记 id 被代码引用）⇒ 新增音效应先改本表 | `[N]` |
| A05-25 | 全表·包体 | 构建产物（`cocos/build/*`）内音频资产文件数 = **0**、音频占用 = **0 KB**（程序化合成路线的硬断言；若改走采样路线，本条判据须随 `audio-spec.md` §4.2 预算数字一并改写） | `[C]` |
| A05-26 | 全表·听感 | 连打 8 颗珠（间隔 200 ms）不糊、不炸、无机关枪感；`sfx_place` 被主观评为「软/治愈」而非「硬/街机」（「解压」支柱人耳判据） | `[P]` |
| A05-27 | 全表·真机 | 微信 iOS 首次手势后出声、退后台→回前台 BGM 恢复、`InnerAudioContext`/`WebAudioContext` 无泄漏（长玩 10 分钟内存平稳） | `[R]` |

---

## 5. 未纳入清单（有意不做 + 待裁项）

**有意不做（§5 无行 ⇒ 不发明；如需必须先回写 ux-spec §5，经文策渊/主理人）**

| 候选 | 否决理由 |
|---|---|
| 告急「进入」独立 sting | §5 只有心跳一行；进入时刻已由首拍承担（A05-11） |
| 失败（时间到）悲情音 | §5 无行；且 concept 支柱 1「反馈即时但不激烈」+ D7 无惩罚 ⇒ 失败面板**不加**否定性音乐 |
| 供料入槽音（`tray:spawned`） | §5 无行；且 2–6s 一次的自动事件加音会制造噪声底（powerups §4「零噪声原则」同源） |
| 过关庆祝逐列分层音（跟随 20ms/列） | §5 只给「胜利琶音 800ms」单条；逐列 13 音同帧会撞 `maxPerFrame=6` 并糊（防糊纪律 `audio-spec.md` §2.4） |
| UI 口播 / 人声 | 0 文字教学不等于要口播；本作**永不触发** `game-ui-voice-pack`（`audio-spec.md` §6.3） |
| 冲刺 BGM 换曲 / tempo 提升 | §3 BGM 单曲裁决（`audio-spec.md` §3.1）；换曲需第二首 = 破包体预算 |

**待裁项（回传主理人，本篇不擅自定）**

| # | 问题 | 我的推荐 |
|---|---|---|
| Q-A05-1 | `sfx_ui_tap`（已落码，7 处按钮调用）在 §5 **无对应行**；而 §5「面板入/出＝抽屉音」现状**无接线**（代码注释自称 `sfx_ui_tap` 即抽屉音，属语义错位） | **推荐**：`sfx_panel_in/out` 按 §5 新增挂面板入/出；`sfx_ui_tap` 保留为「面板按钮通用轻点音」并**回写 ux-spec §5 增一行**（按钮点击｜按钮态视觉｜轻点音｜`[TODO]` ms）。理由：按钮音有真实反馈价值且已实现，删掉是倒退；但必须让 §5 与实现闭合，否则 T-084 无法判定谁对 |
| Q-A05-2 | 「续时未看完」复用 `sfx_reject` 是否可接受（两行 §5 描述逐字相同，但语义场景不同） | **推荐复用**：省 1 个 clip、省预算、听觉语义一致（温和否定）；若 Playtest 反馈「续时失败像放错珠」造成误解，再拆独立 clip（走 §6 变更） |
| Q-A05-3 | `reason='wrong'` 断连时 `sfx_reject` + `sfx_combo_break` 同帧并存是否糊 | **推荐先并存**（双通道红线优先，不擅自抑制 §5 明列的音效）；`[B]`/`[P]` 听感验证若判定糊，回退方案 = 抑制 `sfx_combo_break`（需回写本篇 + 经主理人） |
| Q-A05-4 | 满槽告警「轻提示音 1 次」的「1 次」口径：每次 `tray:full` 各 1 次（本篇采纳） vs 整个满槽持续期只 1 次 | **推荐每次各 1 次**（事件天然 ≥2s 间隔，不构成噪声）；若 UX 本意是「持续期 1 次」，需 ux-spec §5 补注（不是我改） |
