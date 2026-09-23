# 音频规格（Audio Spec）· beads

- 项目：`games/beads`（拼豆填色消除）· 版本 v1.1 · 任务号 WXG-T-083（GAP-05：音频实质为零）；与 `audio-events.md §1.1` 时长列三形式同口径（冲突 C3）/ 判据计数因 A05-09 拆 09+09b 而变（冲突 C1）：WXG-T-103（2026-09-15）
- 方法论：`my-skills/wxgame-audio-spec/SKILL.md`（五件套**框架版**）
- 配套：`audio-events.md`（事件表 + 逐事件验收判据 + 覆盖对账）——本篇不重复事件行
- 数值纪律：**冻结常量只引用 `gdd/systems-index.md` §3**；动效/音效时长只引用 `ux/ux-spec.md` §5；包体只引用 §3.9 + `art/assets-spec.md` §5。**框架版未定值一律 `[TODO]`，本篇不产任何伪 dB / 伪码率 / 伪 Hz**（§8 汇总全部未定项）。
- 边界：**本篇只出规格，不生成任何音频文件、不落码、不改 `systems-index.md`**（拟增常量见 §7.2，回传主对话串行落盘）。执行层（`indie-game-ost-pack` / `game-ui-voice-pack`）触发条件见 §6.3。

---

## 1. 音频方向基调（Music Direction）

**一句话气质**：*手作拼豆的治愈声场*——软质、短促、低攻击（soft attack）、木/陶/糖果质感的「嗒·啵·叮」，垫底一层不抢注意的温和循环乐；**绝不街机爆裂**。

| 维度 | 定调 | 依据 |
|---|---|---|
| 情绪支柱映射 | 「**解压**」主载体 = `sfx_place`（落座嗒）+ `sfx_select`（选中啵）两条高频短音；「**修复完成爽感**」主载体 = `sfx_clear`（胜利琶音）+ `sfx_star`（逐星叮上行） | concept §4 Aesthetics（治愈+秩序感+轻紧张汇合于「最后一格填上」）；ux-spec §6 首屏表「~5s 首颗珠落座 → 首个爽点（pop 动效+音效）」 |
| 与 breakout 的差异 | 刻意区分：breakout = 街机连续碰撞爆点；beads = 单次落子的**柔软确认感**，密度低、峰值低、无失真无压缩泵 | concept §3 支柱 1「节奏轻、软，反馈即时但不激烈」 |
| 参考音色（正面） | pop-it 按压「啵」的膜质弹响、木珠落瓷盘的短「嗒」、音乐盒/钟琴琶音（结算）、软槌低音鼓的「咚」（拒绝，**钝而不凶**） | ux-spec §5 音效列原文描述（"嗒/啵/咚/沙/叮/唰"）——音色语义由 UX 定，我只定实现 |
| **负面清单（不做）** | ① 8-bit 方波爆裂音；② 打击乐驱动的节奏游戏感；③ 史诗弦乐/管弦；④ 失败悲情音或惩罚性音效（D7 无惩罚）；⑤ 真实人声口播；⑥ >3Hz 的任何听觉脉冲（听觉闪烁红线，§2.5）；⑦ 全屏白噪爆炸 | concept §3 支柱 1 + D7；systems-index §3.8 闪烁红线同源；`gdd/powerups.md` §4「零噪声原则」 |
| 情绪曲线档位 | BOOT/玩法 = **低位垫底**（BGM 不抢注意，SFX 为前景）；告急 = 紧张**仅由 `sfx_urgent_beat` 1Hz 心跳 + 视觉脉冲承担，BGM 不变**；连击（冲刺）= 三档递进上行（音高/密度递增，见事件表）；过关 = 释放（琶音+星光）；失败 = **温和回落**（无悲情曲、无 sting） | ux-spec §5 逐行；timer-gameover §2「温和提示，非红闪」 |

> **取证更正（诚实记录）**：任务单引 `docs/reference/popit-pindou-gameplay-ui-analysis.md` §2 为「pop-it 的『啵』声是解压感核心载体」的依据——**该文档 §2 通篇无音频内容**（只有玩法规则 §2.1、压力源 §2.2、HUD §2.3；全文 grep「音效/声音/啵」零命中）。故本节的「解压感主载体」结论**改引**上表三处仓内权威（concept §4 / ux-spec §5-§6 / systems-index §3.8），不建立在失效引用上。若需要参考作的音频取证，须另做（属新任务）。

---

## 2. 混音规范（Mix）

### 2.1 Bus 结构（三条总线，命名空间承载）

**读码事实**：`core/audio/audio.ts` 的 `AudioScheduler` **只有单一 `masterVolume` + 单一 `muted`，无 bus 概念**；`compose/app.ts` L76 也只装一个实例。`docs/architecture/architecture-beads.md` §5 曾提「组合两个 AudioScheduler（sfx/bgm）共享同一 backend」，而**实装走的是单实例 + 游戏侧双门控**（`beads-game.ts` L1471-1485 `_applyAudioChannels()` / `_sfx()`，注释明写 "the two channels are realised over the single scheduler"）⇒ 架构文档与实现有**口径漂移**，登记见 §7.3。

**裁决（不改框架即可落地）**：Bus 以 **clip id 命名空间**表达，增益与静音由「游戏侧 per-play `volume`」+「后端按前缀分 bus gain（需求单第 3 项）」两层实现。

| Bus | 成员（id 前缀/清单） | 静音开关映射（S9） | 音量档 |
|---|---|---|---|
| **Music** | `bgm_main`、`bgm_quiet`、`bgm_drift`（**三首同长 40.000 s**，用户 2026-09-23 裁定） | `settings.bgmMuted` → `stop(当前 bgm)` / 重新 `play(loop:true)` | `AUDIO_BUS_GAIN_BGM` = `[TODO]` |
| **SFX**（玩法） | `sfx_place`、`sfx_select`、`sfx_reject`、`sfx_dissolve`、`sfx_powerup`、`sfx_combo_t1/t2/t3`、`sfx_combo_break`、`sfx_urgent_beat`、`sfx_tray_full`、`sfx_stage`、`sfx_clear`、`sfx_revive_ok` | `settings.sfxMuted` → `_sfx()` 门控（零入队） | `AUDIO_BUS_GAIN_SFX` = `[TODO]` |
| **UI**（界面） | `sfx_star`、`sfx_panel_in`、`sfx_panel_out`、`sfx_ui_tap` | 同 `settings.sfxMuted`（**S9 只有两个开关**，UI bus 无独立开关 ⇒ 跟随 SFX；如实记录，非遗漏） | `AUDIO_BUS_GAIN_UI` = `[TODO]` |

### 2.2 相对响度基准（结构定，数值 `[TODO]`）

- 基准关系（**定性、可执行**）：`SFX ≥ UI > Music`——玩法 SFX 永远在 BGM 之上可辨；UI 音略低于玩法 SFX（不与落座音争前景）；BGM 为垫底。
- 具体 dB / 线性增益值：**`[TODO]`**（SKILL §4 明列「具体 dB `[TODO]`」；须待 Web Audio 后端可听 + 真机响度校准后定档，届时回写 SKILL 的 `[TODO]` 位）。
- **MVP 无玩家音量滑杆**：S9 §2.3 只有 `bgmMuted`/`sfxMuted` 两个布尔 ⇒ 相对响度是**设计常量**而非用户设置；若未来加滑杆须新增 S8 存档字段并进版本矩阵（`[TODO]`，本轮不做）。

### 2.3 同时发声上限

| 项 | 值 | 依据 |
|---|---|---|
| 单帧最大 distinct clip | **6**（= `maxPerFrame` 框架默认） | `core/audio/audio.ts` L58；`app.ts` L76 未传 options ⇒ 默认生效 |
| 同帧同 id | **1**（去重，后到丢弃） | 同上 L105-110 |
| 最坏情形实测核算 | ≤4（四种同帧组合穷举见 `audio-events.md` §3.1） | 事件表触发源 |
| 微信侧硬约束 | `InnerAudioContext` **池上限** = `[TODO]`（真机取证项 R-3）；官方明示资源不自动释放，须 `destroy()` | 微信小游戏音频文档（`createInnerAudioContext` 注意事项） |

### 2.4 voice-stealing / 防糊策略（拼珠类高频短音**必备**）

**四重限流，MVP 无需框架改动**（按生效顺序）：

1. **同帧同 id 去重**（框架已实现）：连打多颗珠在同一帧只出 1 声 ⇒ 天然防「机关枪」。
2. **单帧 6 distinct 上限**（框架已实现）：超限按**入队序**保留前 6，后到丢弃 ⇒ 因此**入队序即优先级**；游戏侧帧内序为「输入 → 连击窗 → 供料 → 计时」（pause-settings §8-6 判据基准），P0 音效（拒绝/告急）天然落在早段，与 `audio-events.md` §3.1 的 P0/P1/P2 分档一致。
3. **per-clip `minInterval`**（框架已实现，但**现状配置错误**）：`_sfx()` L1484 对所有 clip 统一 0.05s ⇒ `sfx_reject` 理论可达 20 次/秒，**违反 §3.8「≤2 次/秒」红线**。规格要求改为分档表（`audio-events.md` §3.2）：`sfx_reject` **0.5s**、`sfx_urgent_beat` **0.9s**、`sfx_tray_full` **1.0s**、`sfx_place`/`sfx_select` 保留 0.05s、一次性事件音 0。
4. **音色层面的防糊（合成配方纪律）**：高频短音（落座/选中）必须 **短 decay + 无 sustain + 低峰值 + 无低频堆叠**（低频留给拒绝音与心跳，避免与落座音在 200ms 窗口内互相掩蔽）；具体包络数值 `[TODO]`（§4.3）。

**真正的抢占（steal 正在发声的 voice）MVP 不做**：core 无 priority 字段，且核算显示同帧 ≤4 < 6 ⇒ 无抢占需求。列为后端需求单**第 5 项（P2 可选）**：若 Playtest 出现丢音，再给 `AudioScheduler` 加 priority/steal，不在本轮扩框架。

### 2.5 Ducking 与红线

- **Ducking（SKILL §4 要求）**：MVP **不做**。理由（诚实取舍）：① `AudioScheduler` 只有全局 `masterVolume`，压它会同时压 SFX；② `AudioPlayOptions.volume` 只在 `play()` 时刻生效，**已发声的 `bgm_main` 无法事后改音量** ⇒ 需后端补 `setVolume(clipId,v)` 或 bus gain（需求单第 4 项，P2）；③ 本作 UI 音与 BGM 均低密度，实测核算无掩蔽冲突。**若后端补齐能力，duck 目标 = 结算/续时面板入时 BGM 压 `[TODO]` dB、`[TODO]` ms 恢复**。
- **静音可玩（红线，与 UX 双通道红线互为因果）**：`sfxMuted`+`bgmMuted` 全关时，8 关普通 + 冲刺 + 失败续时全流程必须可通关、**零信息损失**——依据是 §5 每一行都有独立视觉通道（`audio-events.md` §1「对齐的视觉通道」列）。**任何信息不得只由音频承载**（逐条核过：告急 = 图标+颜色+脉冲+心跳；连击档 = 数字「×2/×3/×5」+音；满槽 = 描边呼吸+音）。判据 A05-23。
- **听觉闪烁红线 ≤3Hz**（本规格新增的音频侧可访问性纪律，与 §3.8 视觉闪烁红线同源同界）：唯一周期性音 = 告急心跳 **1Hz**（`TIMER_TICK`），满槽音非循环 ⇒ 全表合规。判据 A05-13。

---

## 3. BGM 结构

### 3.1 场景-曲目映射（**三首随机**，用户 2026-09-23 裁定）

> **本轮改写对象** = 原「demo = 单曲全程」裁决（及其两条推论：不需标题曲、不换曲 = 破预算）。
> 三首均为**程序化合成** ⇒ **仍不破包体**（无文件进产物），原 §4.1 选型裁决不变。

| 状态（S1 六态） | 曲目 | 行为 | 依据 |
|---|---|---|---|
| BOOT | 三首之一（首曲由 `services.rng` 取） | 装配完成即 `play(loop:true)` 恰 1 次 | 无主菜单 ⇒ 仍不需标题曲 |
| PLAYING（普通/冲刺） | 当前曲 | 循环到边界时换曲（不中途换、不变速）；**现状 = 单曲不换**（T1 已落 20 s；T2/T3 待 §3.12 冻结批） | 接缝只能在乐句边界（§3.2） |
| PAUSED | — | **`stop(当前 bgm)` 即停**（用户裁定，覆盖原 D5「暂停继续播」取舍） | 改动点 = 挂 `game:paused` |
| LEVEL_CLEAR / FINISH | 当前曲（不切） + `sfx_clear`/`sfx_star` | BGM 不停，庆祝音叠加 | ux-spec §5 只给庆祝音效行 |
| GAME_OVER | 当前曲 | **不停、不切悲情曲** | D7 无惩罚 + timer-gameover「温和提示」 |

**曲目数 = 3**，且三首**时长必须逐字相等 = 40.000 s** —— 这是「随机换曲不破缝」的前提（§3.2）。

**恢复（PAUSED → PLAYING）语义**：重播**同一首**、不重随机（避免“每按一次暂停就换歌”），
代价 = 当前曲从头循环（现后端无恢复位置能力）。

### 3.1b 随机选曲的确定性规则（**L4 铁律，不得自由发挥**）

- ⛔ **禁用 `Math.random()`** ⇒ 一律走 `services.rng`（`createRng(seed)`），同 seed 必得同序列（可 Node 断言）。
- **取样规则**：从三首中**排除上一首**后均匀取一（= 2 选 1）⇒ 消除“连续两首同曲”这类
  被玩家读成“没换”的伪故障。首曲 = 3 选 1。
- 选曲时机 = **上一首自然播完的循环点**，不引入定时器参与玩法（表现层调度）。
- 三首 id 与取表入口归 `tuning.ts`（现有 `AUDIO_CLIP_BGM` 位），禁在 `beads-game.ts` 散落字面量。

### 3.2 循环设计

- 无缝 loop（`loop: true` 由框架/backend 承载）。**循环时长**：目标 = 三首同长 **40.000 s**；
  **现状 = T1 `bgm_main` 已落 6 小节 / 20.000 s**（≈ 3.5 MB 常驻缓冲）—— 40 s ⇒ ≈ 7.0 MB，
  会跨过 `audio-voices.ts` 已写明的「真机 `[R]` 内存取证前不先撑」保守线 ⇒ 升级前置 = 真机取证（一行的事）。
  区间约束（30–60 s）与「**循环点必须落在乐句边界**」「**进后端前必须试听循环点**」仍为硬要求
  （SKILL §3，判据 A05-21/22）。
- **三首同长 40.000 s 的额外收益**：随机换曲只可能发生在样本级对齐的边界上，
  不需任何交叉淡入即可避免“句中截断”；代价 = 三首的小节数/拍数必须不同而总时长相同
  （见 `bgm-main-composition.md` 的时长恒等式）。
- **换曲接缝的转调问题**：三首不同调 ⇒ 每首**最后 1 小节不发声**（尾音自然衰减到静默），
  用一拍空白兜住转调的生硬感（零新机制、零额外轨道）。
- **幂等契约（必须写进后端）**：重复 `play('bgm_main',{loop:true})` 不得重启播放位置——否则 BOOT 后每次设置切换都会跳针（判据 A05-22，需求单第 2 项）。
- 循环点/拍号/调性/BPM：**`[TODO]`**（不定伪值；程序化合成路线下由 §4.3 的音符序列表定，采样路线下由 `indie-game-ost-pack` 交付时附循环点说明——SKILL §6 交付物要求）。
  → **已定档（设计值层面）**：`bgm-main-composition.md` §3 —— ♩=72 / 4/4 / F 大调 / 12 小节 /
  **40.000 s** 整、循环点落在乐句边界。包络 ms、增益、响度 dB **仍 `[TODO]`**（需 `[B]` 后端可听后定）。

### 3.3 情绪分层（stem）策略：**不做，写明取舍**

- **裁决**：告急段**不切层**、不叠紧张 stem。
- **理由**：① 单 `AudioScheduler` 无 stem 混音/交叉淡入能力（无 bus、无 per-clip 事后音量）；② 告急的紧张感已由**双通道**充分承载（1Hz 心跳音 + danger 色 + 1000ms α 脉冲，timer-gameover §2 + §3.8「不单靠颜色」）；③ 多一层 stem = 多一份预算/CPU，与 §4.2 的 0 KB 目标冲突；④ SKILL §3 明示「demo 可不做，写明取舍」。
- **解除条件**（若未来要做）：后端补 bus gain + 交叉淡入能力（需求单第 4 项 P2）⇒ 届时可加 `bgm_urgent` 层并回写本节。

---

## 4. 实现策略（Implementation）

### 4.1 选型裁决：**v1.51 改判为混合路线** —— SFX 运行时合成 + **BGM 采样文件进主包**

> **沿革**：本节原裁决「采 A 程序化合成（0 KB 主包），采样为回退」，并写死回退触发条件
> 「先由主理人解除内部目标冲突」。**该前提已由用户 2026-09-23 解除**：`systems-index §3.9` 主包内部目标
> 2000 → **4096 KB**（微信上限）⇒ 原唯一硬否因（≥240 KB 破余量 32 KB）消失 ⇒ 改判。
> 下表保留为**历史取证**（当时的三条实测数字仍有效，只是不再决定选型）。

**改判的真实动因不是体积，是音色天花板**（读码所得）：`platform/audio-synth.ts` 的包络是
`env = 1 − (rel−atk)/decay` ⇒ **attack→线性衰到 0 的拨奏引擎，没有 sustain**；`wave`/`filter` 是
**voice 级**而非 note 级 ⇒ 一首曲子只能一种音色；无混响、无 per-note detune。
⇒ 持续音、弦乐垫、真实器乐质感**在引擎能力之外**，不是调参或改谱能解决的
（三轮真机反馈「太小 → 难听 → midi 味」的根因；谱面迭代 r11→r13 已证明无效，见 `bgm-main-composition.md §12`）。

**（v1.52 已再次改判）** 原写「SFX 明确保留合成、本改判范围 = 仅 BGM」—— 用户 2026-09-23 确认推翻：**SFX 亦改为素材文件**，由本地 `jsfxr` 按 §4.3 的语义（嗒/啵/咚/沙/叮/唰）与 `ux-spec §5` 时长上限生成，导出 base64 资产表 `games/beads/assets/audio/audioAssets.js`（实测 19 条 = **60.5 KB**，进主包 JS）。保留的取舍：clip 数不变（仍 20）⇒ 不触发六方原子批。<br>**接线已落地（方案 A）**：`AudioVoice.asset` + `SynthAudioBackend._decodeAssets()` 在 unlock 期解码，素材命中即优先于合成、**解码失败或 runtime 无 `decodeAudioData` 自动回退 notes（不静音）**；资产路径 `src/config/audioAssets.ts`（`.js` 不被 tsconfig/镜像收，故必须 .ts）。web/harness 侧路径可用；**weapp 真机解码能力仍是 `[R]` 待验**。

**BGM 现状（2026-09-23 夜，两笔实测后补记）**：用户提供 `Patterns_on_the_Porch.mp3`
= **4226.75 KB / 180.09 s / stereo 192 kbps**（单文件即超主包 4096 KB 红线；160–180 s 是自然尾奏
mean −20.9 dB ⇒ 整曲不可当循环体）⇒ 裁 40–100 s 段、96 kbps stereo 44.1 kHz、头尾各 12 ms 淡化
= **`games/beads/audio/bgm_porch.mp3` 703.8 KB / 60.03 s**（守 §4.2 BGM ≤1536 KB）。
走 `assetFile` 文件路线（60 s 若走 `decodeAudioData` 会常驻约 10 MB PCM）。

⚠ **真机踩坑与修复（必须留档）**：初版把文件放 `cocos/assets/audio/` ⇒ 真机**整首没声**。
实测确诊：Cocos 构建成功后产物内 `find -iname "*.mp3"` = **0 个**、`assets/` 下只有 `internal`/`main`
两个 bundle —— Cocos 只打包被场景/预制静态引用、或位于 `resources/`／声明为 bundle 的资源，
**只被运行时字符串引用的文件不在依赖图里**。现由 `build-cocos.mjs::stageExtraAssets()` 在构建后
拷入 `build/<platform>/audio/`；复跑两平台构建实测产物均含该 mp3，`check:size` 主包 **2775.3 KB**（红线内）。
另补 `SynthInnerAudio.onError` ⇒ 播放失败把 `errCode`/原因进日志并永久回退合成（"静默没声"不再可能）。

⚠ **仍未达成**：① §3.2 目标「三首同长 **40.000 s** 随机」现状 = 一首 60.03 s（偏差登记，未改目标值）；
② 循环接缝**未真听**（铁律：验过前不写"无缝"）；③ BGM 相对响度未校（`gain 0.28` 是给合成音定的）；
④ 真机 `InnerAudioContext` 的 loop/onHide 行为未取证 `[R]`。

**长短音频分流（v1.52 补充，判据是 JS 堆常驻而不是包体）**：实测 19 条 SFX 原始 mp3 = 45.0 KB / 总时长 3.34 s ⇒ base64 60.0 KB、gzip 后 31.0 KB（与 19 个 mp3 打包的 30.4 KB **等价**，base64 的 33% 膨胀被压缩吃掉）；解码后 PCM = 时长 × 44100 × 4 B ⇒ **SFX 合计仅 0.56 MB，而 40 s BGM ≈ 7.1 MB**。故：

| 类别 | 通路 | voice 字段 | 理由 |
|---|---|---|---|
| 短音效（19 条，均 ≤1 s） | JS 内 base64 + `decodeAudioData` | `asset` | 45 KB 量级不值得起文件；并发多条不撞原生实例池 |
| **长音频（BGM）** | **包内/分包文件 + 平台原生播放器** | **`assetFile`**（优先于 `asset`） | **避开 7 MB PCM 常驻 JS**；loop 交原生 |

两条通路都保留 `notes` **合成回退**（原生不可用 / 解码失败 ⇒ 仍响，不产生「有文件却没声」）。落点：`AudioVoice.assetFile`、`SynthAudioBackend._startFileLoop()`、`web.ts` 的 `Audio` 与 `weapp.ts` 的 `createInnerAudioContext` 适配。⚠ **BGM 侧本批未启用**（仓库无 mp3 ⇒ `bgm_main` 仍走合成）；文件到位后在 voice 表加一行 `assetFile` 即切换，路径需按平台确认（Cocos 资源目录 / 站点根，不猜）。真机 `[R]` 未取证：`InnerAudioContext` 的 loop 接缝与 `onHide` 行为。

| 路线 | 主包占用 | 首屏影响 | 可验证性（本轮） | 结论 |
|---|---|---|---|---|
| **A 程序化合成**（Web Audio 节点实时合成 SFX + 序列化 BGM） | **0 KB** | 0 ms 资产加载（AudioContext 延迟到首次手势创建） | 逻辑 `[N]` 可测；听感须 `[B]` | ✅ **采纳** |
| B 极小采样（.mp3/.m4a 文件） | SFX ≈3 KB/条 ×18 ≈ 54 KB + **BGM 单曲 ≥240 KB**（30–60s）⇒ **≥294 KB** | 需预加载/解码 | 产物体积 `[C]` 可测 | ❌ 破内部目标（§4.2） |
| C 混合（SFX 合成 + BGM 采样） | ≈240 KB（BGM 主导） | BGM 解码阻塞或首响延迟 | 同上 | ❌ 同 B，且**内部目标余量仅 32 KB** |

**采纳 A 的五条依据**：
1. **实测余量**：beads `cocos/build/web-mobile` 产物 **1968 KB**（本轮 `du -sk` 实测；`cocos-js` 1500 + `assets` 384 + `src` 68；tar.gz ≈500 KB），内部目标 **2000 KB**（§3.9）⇒ **余量仅 32 KB**。任何采样 BGM（≥240 KB）都会击穿内部目标。
2. **`art/assets-spec.md` §5 的「音频 ≤400 KB（音频归阮和鸣）」预留额度不可兑现**——该表内部自相矛盾（分项 1800+400+0+400 = 2600 KB 已超「主包合计 ≤2000 KB」，再加「安全余量 ≥2000 KB」= 4600 KB，**连红线 4096 KB 都超**）。冲突登记 §7.3，处置需主理人裁（我不改 art/）。
3. **零外部资产传统**：美术全程序化（assets-spec §3「主包美术位图 = 0 KB」），音频同构 ⇒ 引擎/资产链一致，无资产管线负担。
4. **Cocos `audio` 模块已被裁剪关闭**（`cocos/settings/v2/packages/engine.json` `includeModules` 22→10，含 audio；memory 2026-09-14 WXG-T-051，主包 3008→1815 KB）⇒ 采样路线还需**回加引擎模块**（吃掉已省下的体积）或自行解码；合成路线走**原生 Web Audio / wx WebAudioContext，不经 Cocos audio 模块**，零回加。
5. **可控性**：合成路线下音色参数（基频/包络/滤波）= 代码常量 ⇒ 可调、可测、可版本化，且天然满足 L4（无 `Math.random()`：所有变化走 `tuning.ts` 常量表或 `services.rng`）。

**回退触发条件（明确写死，防漂移）**：仅当 `[R]` 真机取证证明微信 `WebAudioContext` **缺少合成所需节点子集**（Oscillator/Gain/Buffer 之一不可用）或 iOS 高性能模式下合成不稳定 ⇒ 回退路线 C（SFX 合成 + BGM 采样），**且回退前必须先由主理人解除内部目标冲突**（提高内部目标至 ≥2300 KB 或再裁引擎 ≥240 KB），数字回传后再改本节与 A05-25 判据。

### 4.2 包体预算（数字 + 依据）

| 项 | 值 | 依据 |
|---|---|---|
| 平台红线（主包） | ≤ **4096 KB** | systems-index §3.9（不可逾越） |
| 内部目标（主包） | ≤ **2000 KB** | systems-index §3.9 |
| 当前实测产物（web-mobile release） | **1968 KB** | 本轮 `du -sk games/beads/cocos/build/web-mobile`（2026-09-14）；tar.gz ≈500 KB |
| ⇒ 内部目标余量 | **32 KB** | 2000 − 1968 |
| **音频预算（v1.51 改判后）** | BGM ≤ **1536 KB 主包占用**（3 × 40 s × 96 kbps mono ≈ 1.44 MB）；**SFX 仍 0 KB** | `systems-index §3.9`（内部目标已抬至 4096 KB）；判据 **A05-25（已反转）** |
| ⇒ 预估产物 | 1968 + 1440 ≈ **3408 KB**，距平台红线 4096 KB 余 **688 KB** | 首轮只落 1 首 20 s（≈ 240 KB）⇒ **2208 KB**；三首 40 s 才到 3408 KB |
| ⚠ 未兑现的代价 | **冷启动下载变大**：与 `ux-spec §6`「≤1.5 s BOOT，程序化绘制零加载资产」正面冲突（分包路线可免，用户仍选主包） | 登记 §7.3 冲突，处置归主理人 |
| 格式约束 | 仅 **mp3 / m4a / wav**；**ogg 在 iOS 微信不支持** | 平台事实；真机 `[R]` 复验 |
| 素材来源 | 本仓 `indie-game-ost-pack` 走 `beatra.music.generate`（云端付费）**当前会话未配置该 MCP** ⇒ 实际路线 = **本地离线渲染**（`ffmpeg 7.1.1` + `lame` 已在机）| 离线渲染不受运行时引擎限制（可做 sustain / 多泛音 / 样本级无缝 loop）|
| 合成代码增量 | ≤ `[TODO]` KB（预估数十 KB 量级，须以构建后 `src/` 实测回写） | 当前 `src` 68 KB；合成器 + 19 clip 配方表落 `games/beads/src`（禁 `import 'cc'`，L3） |
| 若回退采样路线 | SFX ≈54 KB + BGM ≥240 KB ⇒ **须先解除内部目标冲突**（见 §4.1 回退条件） | 3 KB/条 ×18（44.1kHz mono 低码率短音估算）；BGM 30–60s |
| wechatgame 目标平台产物 | **本轮无 beads `build/wechatgame/`**，无法实测；breakout wechatgame release 实测 1815.1 KB（memory 2026-09-14）仅作量级参照，**不同游戏不同目标平台，不混用** | AGENTS §4「红线与内部目标分清」 |

### 4.3 资源清单与合成配方（骨架定，数值 `[TODO]`）

**纪律**：下表**结构**（波形候选/包络段/滤波类型）为规格裁决；**所有数值**（基频 Hz、attack/decay ms、增益、截止频率、采样率）一律 `[TODO]`——待 `[B]` 后端可听后定档并回写 SKILL §4 的 `[TODO]` 位。唯一硬数值 = **总时长上限**，引自 ux-spec §5（不属发明）。

> **WXG-T-103（冲突 C3）口径同步**：时长列采用与 `audio-events.md` §1 一致的**三形式**——`N` = 期望值（`[B]` 等值比对含容差）、`≤N` = 上限/窗口（只断言 ≤）、`[TODO]` = 规格未定（记 ⛔ 不判 FAIL），逐条分流见该篇 §1.1。**本纪律不因分流松动**：被写的只是 §5 已有的时长/窗口/红线值，配方数值（Hz/包络/增益/滤波/采样率）仍全量 `[TODO]`；`src/config/audio-voices.ts` 的 `durationMs` 是**工程占位**，**不得回引为规格**，规格也不得据它「转正」——**两者不得互引**。

| clip | 波形候选 | 包络结构 | 滤波 | 时长上限（§5） | 数值 |
|---|---|---|---|---|---|
| `sfx_place` | 三角/正弦 + 极短噪层（膜质「嗒」） | A 极短 → D 快 → 无 S → R 无 | 低通（去尖锐） | 120 ms | `[TODO]` |
| `sfx_select` | 正弦 + 轻微上滑（「啵」） | A 极短 → D 快 | 低通 | 100 ms | `[TODO]` |
| `sfx_reject` | 正弦低频（钝「咚」，**不加失真**） | A 短 → D 中 | 低通 | 200 ms | `[TODO]` |
| `sfx_dissolve` | 噪声 buffer（「沙」） | A 短 → D 中 → R 短 | 带通/高通扫频 | 200 ms | `[TODO]` |
| `sfx_powerup` | 钟琴/正弦泛音叠（「叮」） | A 极短 → D 长 | 高通（去浊） | 400 ms | `[TODO]` |
| `sfx_combo_t1/t2/t3` | 正弦/三角**上行音阶**（双音/三连/和弦） | 逐音 A 极短 → D 快 | 低通 | 200/150/350 ms | `[TODO]`（音程表 `[TODO]`） |
| `sfx_combo_break` | 正弦**下行单音** | A 短 → D 中 | 低通 | 150 ms | `[TODO]` |
| `sfx_urgent_beat` | 正弦低频双击（心跳「lub-dub」） | 两拍内包络 | 低通 | ≤1000（**周期窗口**，非单拍发声时长；周期 = §3.12 `AUDIO_URGENT_BEAT_PERIOD`） | `[TODO]` |
| `sfx_tray_full` | 三角（轻提示，中性无威胁） | A 短 → D 短 | 低通 | ≤500（视觉呼吸窗口内 1 次；次数判据 A05-14） | `[TODO]` |
| `sfx_stage` | 噪声 + 带通扫频（「唰」，双段出/入） | 两段镜像 | 带通扫频 | 500（= §5 原文 250+250 两段和；分段对齐 A05-15） | `[TODO]` |
| `sfx_clear` | 琶音序列（`sfx_powerup` 同族音色，音数 `[TODO]`） | 逐音 A 极短 → D 中 | 高通 | 800 ms | `[TODO]` |
| `sfx_star` | 上行「叮」（逐颗 3 次，音高递增表 `[TODO]`） | A 极短 → D 中 | 高通 | 150（单颗；×3 为派发次数 ⇒ A05-17） | `[TODO]` |
| `sfx_panel_in/out` | 短噪 + 低通扫（抽屉「唰」，入/出镜像） | A 短 → D 短 | 低通扫频 | 200 / 150 ms | `[TODO]` |
| `sfx_revive_ok` | 正弦上滑「叮」（与 `sfx_reject` 语义相反，明亮） | A 极短 → D 中 | 高通 | ≤400（§5 表头反馈红线；§5 该行原写的「150」是**视觉面板出**时长 ⇒ 归 `sfx_panel_out`） | `[TODO]` |
| `sfx_ui_tap` | 极短正弦/三角点音 | A 极短 → D 极短 | 低通 | `[TODO]`（§5 无行，Q-A05-1；解除 = §5 增行，**不靠实测**） | `[TODO]`（占位 40 ms 仅工程） |
| `bgm_main` | **序列化音符表**（确定性序列，非随机生成）+ 软音色 pad 层（可选） | 循环乐句，节拍 `[TODO]` | 低通（垫底不抢前景） | 循环时长/循环点 `[TODO]`（30–60 s = **设计约束区间**，不是 `[B]` 期望值） | `[TODO]`（占位 8000 ms 仅工程）**→ 曲谱/拍号/调性/时长已定档于 `bgm-main-composition.md` §3（12 小节、♩=72、40.000 s）；绝对包络与增益仍 `[TODO]`** |

**确定性纪律（L4）**：`bgm_main` 序列与任何音色轮转**禁用 `Math.random()`**；如需变化，用 `tuning.ts` 常量表按事件计数取模（可 Node 断言）。**MVP 不做落座音高轮转**（`sfx_place` 单变体）——音色细化属 concept §7 **Could 层**「音效细化（落座/溶解音色区分）」，不进 MVP 验收线；若采纳需增 clip 变体 id（core 无 pitch 参数，变体只能编码进 id），并回写事件表。

### 4.4 加载时机与首屏影响

| 项 | 裁决 |
|---|---|
| 资产加载 | **无**（合成路线零文件）⇒ 对 ux-spec §6「≤1.5s BOOT，程序化绘制零加载资产」**零影响** |
| AudioContext 创建 | **延迟到首次用户手势**（浏览器 autoplay policy / iOS 解锁）；BOOT 期不创建 ⇒ 不占首屏 |
| 首个音效可达性 | ux-spec §6：~5s 首颗珠落座前**必有手势**（点托盘选珠）⇒ 解锁天然前置。**风险诚实标注**：若「首次手势」与「首个音效」落在同帧，context 启动延迟可能导致**首个 `sfx_select` 丢失或延后 `[TODO]` ms**——不视为缺陷，但须在 `[B]`/`[P]` 记录并决定是否加「手势即静默预热一次 context」 |
| 预加载/池化 | 合成路线：节点即时创建即用即弃（无池）；回退采样路线：BGM 预加载 + SFX 池化（池上限 `[TODO]`，真机项 R-3） |
| 热路径零分配（AGENTS §3） | ⚠️ 合成器每次发声若 `new` 节点，落在 `flush()`（每帧调用）内 ⇒ **须做节点复用/预分配**，或把合成移到 backend 内部（backend 不属 `core/**`，但热路径纪律同样适用）。列为需求单第 6 项 |

### 4.5 存档联动（S8）

- **无新增字段**：`settings.bgmMuted` / `settings.sfxMuted` 已存在（`save-schema`，S9 §2.3）⇒ **存档版本矩阵零变更**。
- 若未来加音量滑杆/听觉减弱开关 ⇒ 新字段 + 版本迁移（`[TODO]`，本轮不做）。

### 4.6 可访问性

| 项 | 裁决 |
|---|---|
| 静音可玩 | 红线，见 §2.5（判据 A05-23） |
| 信息不独占音频 | 逐条核过，见 §2.5 |
| 听觉闪烁 ≤3Hz | 见 §2.5（判据 A05-13） |
| 与「减弱动效」开关联动的音频项 | **beads 无减弱动效开关**（ux-spec §7 / `art/accessibility.md` 未列）⇒ **无联动项**（如实记录，非遗漏）。若未来引入，联动候选 = 关闭 `sfx_urgent_beat` 循环 + 降 `sfx_combo_t3` 峰值（须先回写 ux-spec §7） |
| 听觉疲劳 | 高频短音（落座/选中）峰值与密度上限 `[TODO]`，由 A05-26「连打 8 颗不糊不炸」人耳判据把关 |

---

## 5. 验证手段矩阵

| 道次 | 手段 | 今天可做？ | 能验什么 | **不能**验什么 |
|---|---|---|---|---|
| **`[N]`** | Node vitest（`NullAudioBackend.played` + `helpers.advance(1/60)` + render model 快照） | ✅ **可**（阻塞为零） | clip id 正确性、同帧到达（≤1 帧 / 16.67ms）、per-clip 限流分档、mute 双通道门控、清单闭合（A05-24）、心跳周期与解除、连击三档分流、零发声路径（遮罩拦截/空作用道具/未看完续时） | 时长、响度、音色、循环点、是否真的出声 |
| **`[B]`** | dev harness + **Web Audio 后端**（`platform/web.ts` 替换 Null） | ❌ **阻塞**：`createAudioBackend()` 返回 `NullAudioBackend`（web.ts L57-61，注释「keeps gameplay silent but fully functional」）⇒ **harness 永远静音**。解除 = §6.2 需求单落地（波次 4，程基岩） | 实际出声、时长达标、相对响度、防糊听感、BGM 无缝循环、幂等（A05-22） | 微信侧 API 差异、真机响度/性能 |
| **`[C]`** | Cocos 构建产物核对（`du -sk` + 资产文件枚举） | ✅ **可**（Cocos 3.8.8 已装、web-mobile 构建已通） | 音频占用 = 0 KB、产物内音频文件数 = 0（A05-25）、合成代码增量 KB | 听感（产物不含运行时合成结果） |
| **`[R]`** | 微信真机 / 开发者工具 | ❌ **阻塞**：开发者工具未装 + 无 AppID（`wxgame-minigame-bridge` 双前置） | wx WebAudioContext 节点子集、iOS 首次手势解锁、退后台/中断恢复（`onShow`/`onAudioInterruptionEnd`）、InnerAudioContext 池上限与 `destroy()` 泄漏、真机响度与 CPU | — |
| **`[P]`** | 阶段 6 Playtest 人耳 | ⚠️ **前置未满足** | 「解压」支柱主观成立度（A05-26）、疲劳度、爽感顶点 | — |

### 5.1 对阶段 6 的结论（必须写进 Playtest 计划）

> **在 `[B]` 道次解除前，阶段 6 无法评估「解压」支柱——因为 harness 恒静音，双通道只剩视觉单通道。**
> 因此：① 任何 Playtest 报告**不得**对「解压/治愈」下 PASS 结论，只能记 **BLOCKED（音频后端未落地）**；② `[N]`+`[C]` 全绿**不等于**音频已验收（判据状态列不得从「待做」跳到「已验收」，只能到「已做」）；③ 若主理人必须在后端落地前跑阶段 6，则 Playtest 范围须显式降级为「视觉单通道可玩性」，并在报告首行标注该降级——**否则结论系统性失真**（GAP-05 ④ 的叠加后果）。

---

## 6. 实现前置条件与移交

### 6.1 前置条件（三条，缺一不可）

1. **Web Audio 后端**（`platform/web.ts`）：`createAudioBackend()` 从 `NullAudioBackend` 换成真实实现 ⇒ harness 可听（需求单见 §6.2）。
2. **weapp 后端**（`platform/weapp.ts` L136-140 同为 Null）：真机出声（需求单第 7 项，同批或后批）。
3. **游戏侧接线**：16 个新 clip id 的 `_sfx()` 调用点（现仅 `sfx_ui_tap`/`sfx_star`/`bgm_main` 三个有接线）+ `_sfx()` 的 per-clip `minInterval` 分档（§2.4 第 3 条，含 0.5s 红线修正）+ clip 常量表进 `tuning.ts`（A05-24 闭合）。**不由我落码**（本单只出规格）。

### 6.2 Web Audio 后端落地需求单 → 程基岩（波次 4）

**完整正文见 WXG-T-083 回传第 ③ 节**（本文件只留指针，避免两处漂移）。七项摘要：① `WebAudioBackend` 实现 `AudioBackend` 三方法 + AudioContext 生命周期；② `play()` 对 loop clip **幂等**；③ 按 id 前缀分 bus gain；④ 可选 `setVolume(clipId,v)`（解锁 ducking）；⑤ 可选 priority/steal（P2）；⑥ 节点复用满足热路径零分配；⑦ weapp 侧对偶实现（`wx.createWebAudioContext` 优先、`createInnerAudioContext({useWebAudioImplement:true})` 回退）+ iOS 解锁/退后台恢复。替换点：`platform/web.ts` L57-61、`platform/weapp.ts` L136-140。

### 6.3 执行层 pack 触发条件（本单**不触发**）

| pack | 是否需要 | 触发条件 |
|---|---|---|
| `indie-game-ost-pack`（BGM 文件） | **本轮不需要** | 仅当 §4.1 回退条件命中（真机否决合成路线）⇒ 需 1 首、30–60s、**无缝循环点必附**（SKILL §6 交付物）、单曲主包占用须先经主理人解除内部目标冲突 |
| `game-ui-voice-pack`（UI 口播） | **永不需要** | 本作无人声需求：0 文字教学 ≠ 口播；负面清单 §1 明列「不做真实人声口播」 |

### 6.4 移交林绘澄（WXG-T-080，**我不改 art/**）

音频需要视觉侧同步的三处，请主理人转交：
1. **连击三档强度分级对齐**：`sfx_combo_t1/t2/t3` 的强度递进须与 assets-spec §1.6 / §7.1 的三档视觉强度（星光粒子 → 伪震屏 1.015 → 边缘径向光+波浪）**同序不交叉**；若美术侧调整档位强度，请同步告知以调音高/密度阶梯。
2. **告急心跳相位起点**：`sfx_urgent_beat` 与 1000ms α 脉冲**同周期同相**（判据 A05-11）⇒ 需美术确认脉冲相位起点 = 「danger 切换那一帧」而非「下一个整秒」，否则音画会错半拍。
3. **过关庆祝逐列延迟**：`vfx_complete_wave` 逐列 20ms/列（最多 `GRID_MAX_COLS`=13 列）；音频**不做**逐列分层（§2.4 防糊 + 6-voice 上限），只做单条 800ms 琶音 ⇒ 若美术希望音画逐列同步，须先回 ux-spec §5 增行并重新核算 voice 预算，**不要**在美术文档里单方要求音频分层。
4. **（顺带登记，非移交指令）** `art/assets-spec.md` §5 包体预算表内部矛盾（分项和 2600 KB > 主包合计 2000 KB，且「音频 ≤400 KB」预留不可兑现）——见 §7.3 冲突登记，处置权属主理人 + 林绘澄。

---

## 7. 决策记录、拟增常量与冲突登记

### 7.1 决策（A05-D*）

| # | 决策 | 依据 |
|---|---|---|
| A05-D1 | 实现路线 = **程序化合成**，主包音频占用 **0 KB**；采样为回退且回退须先解除内部目标冲突 | §4.1/§4.2（实测 1968 KB vs 内部目标 2000 KB ⇒ 余量 32 KB） |
| A05-D2 | BGM = **单曲 `bgm_main` 全程**，不换曲、不做 stem 分层、告急不切层 | §3.1/§3.3（无主菜单 + 单 scheduler 能力 + 预算） |
| A05-D3 | Bus = **clip id 命名空间**（Music/SFX/UI 三条），UI bus 静音跟随 `sfxMuted`（S9 只有两开关） | §2.1（core 无 bus，读码事实） |
| A05-D4 | 防糊 = **四重限流**（同帧同 id 去重 / 6-per-frame / per-clip minInterval / 短包络低频不堆叠）；**MVP 不做真抢占** | §2.4（同帧最坏 ≤4 < 6） |
| A05-D5 | PAUSED 时 **BGM 继续播放**（可逆：若用户要求静音，改动点 = 挂 `game:paused`） | §3.1 |
| A05-D6 | MVP **不做 ducking**（能力缺失 + 无掩蔽冲突），列为后端 P2 | §2.5 |
| A05-D7 | 告急心跳由 **`timer:urgent` 边沿（首拍）+ `timer:tick`（后续每拍）** 共同驱动，**不新增事件** | `timer.ts` L71-77：`urgent` 是**边沿单次**触发，无法承载 1000ms 循环；而 `TIMER_TICK`=1.0s 恰等于 §5 脉冲周期 ⇒ 天然同相同周期，零 GDD 改动 |
| A05-D8 | 落座音色细化（多变体轮转）留 **Could 层**，MVP 单变体 | concept §7 Could「音效细化」；core 无 pitch 参数 |

### 7.2 拟增 `systems-index.md` 常量（**回传，不落盘**；由主对话串行写入 §3 并登记 §6）

| 拟增位置 | 常量 | 值 | 依据 |
|---|---|---|---|
| §3.9 包体预算（新增行） | 音频主包占用 | **0 KB**（程序化合成，产物内零音频文件） | 本篇 §4.1/§4.2；实测余量 32 KB 使 `assets-spec §5` 的「≤400 KB」不可兑现 |
| §3.12 音频（**新增小节**） | `AUDIO_CLIP_TOTAL` | **19**（18 SFX + 1 BGM；新增须走 §6 变更） | `audio-events.md` §1 计数 |
| §3.12 | `AUDIO_MAX_PER_FRAME` | **6**（显式冻结框架默认，防无声漂移） | `core/audio/audio.ts` L58；`app.ts` L76 未传 options |
| §3.12 | `AUDIO_SFX_MIN_INTERVAL` | **0.05 s**（高频短音默认档） | `beads-game.ts` L1484 现状值转正 |
| §3.12 | `AUDIO_REJECT_MIN_INTERVAL` | **0.5 s**（= §3.8「≤2 次/秒」的音频侧换算） | §3.8 + ux-spec §5「低咚 ≤2 次/秒」；**修正现状缺陷**（统一 0.05s 违约） |
| §3.12 | `AUDIO_URGENT_BEAT_PERIOD` | **1.0 s**（= `TIMER_TICK`，与 §5 脉冲 1000ms 同周期） | A05-D7；引用 `TIMER_TICK` 不新造数值 |
| §3.12 | `AUDIO_HEARABLE_FLASH_HZ` | **≤3 Hz**（听觉闪烁红线，与 §3.8 视觉红线同界） | §2.5 |
| **不申请冻结**（无依据，标 `[TODO]`） | bus 增益 / 相对 dB / BGM 循环点·BPM·调性 / 合成基频与包络 / 采样率 / 码率 / 池上限 / duck 量 | `[TODO]` | SKILL 框架版硬边界：**不产伪数值**；解除条件 = `[B]` 后端可听 + `[R]` 真机取证（§8） |

> **WXG-T-103（冲突 C3）复核**：7 处非纯数字的分流**不新增任何拟增常量**——甲类 5 项全部引自 `ux-spec §5` 或本表已冻结的 `AUDIO_URGENT_BEAT_PERIOD`（未造新数），乙类 2 项（`sfx_ui_tap` 时长、`bgm_main` 循环点）仍留在 §8 T4/T2 且解除条件不变 。全表总口径：**时长列的 `[TODO]` = 规格未定，实现占位值不构成规格，两者不得互引**。

### 7.2b 本轮拟增（用户 2026-09-23「三首随机」裁定）—— **回传主理人，我不落盘**

⚠ 性质：**这属 §3.12 冻结常量变更**，按仓内纪律需「变更单 + 主理人确认」，且按
WXG-T-152 判例必须**六方原子批**（拆开提交会当场红，因 A05-24 是活测试）：

| 项 | 拟值 | 同步面 |
|---|---|---|
| `AUDIO_CLIP_TOTAL` | **20 → 22** | `systems-index §3.12` + changelog 变更单 + `tuning.ts` + `audio-voices.ts` + `SPEC_CLIPS` + `audio-events.md §1` 行与计数 + **A05-24 判据** |
| `AUDIO_CLIP_BGM_2` | `'bgm_quiet'`（♩=54 / 9 小节 / B♭ 混olydian） | 同上；id 为**建议值**，工程可在落码前改，但需五处同步 |
| `AUDIO_CLIP_BGM_3` | `'bgm_drift'`（♩=108 / 18 小节 / E♭） | 同上 |
| `BGM_LOOP_MS`（可选新常量） | **40000**（三首同长的单一真源） | 建议新增，以便“循环边界换曲”与“时长断言”共用一个值；若不新增则由三首 voice 表各自 `durationMs` 一致来保证 |
| `AUDIO_CLIP_BGM` | **不改名**（仍 = `'bgm_main'`） | 避免无谓打破 A05-21/22/24 与现有代码引用 |

> **包体影响：仍为 0 KB**。三首都是代码内的常量表/离线渲染源，无文件进产物
> ⇒ **§4.1 选型裁决与 §4.2 预算表本批不需改**（仅“合成代码增量”一行待实测回写）。

### 7.3 冲突与漂移登记（不改他域文档，报主理人裁）

| # | 冲突 | 涉及文件 | 建议处置 |
|---|---|---|---|
| C-A05-1 | `art/assets-spec.md` §5 预算表**内部矛盾**：分项 1800+400+0+400 = 2600 KB > 「主包合计 ≤2000 KB」，再加「安全余量 ≥2000 KB」= 4600 KB > 红线 4096 KB；且「音频 ≤400 KB」预留与实测余量 32 KB 冲突 | `art/assets-spec.md` §5 ↔ `systems-index §3.9` | 主理人裁 + 林绘澄回写：把「音频」行改为 **0 KB（程序化合成）**，并重算「安全余量」使分项和 ≤ 内部目标 |
| C-A05-2 | `docs/architecture/architecture-beads.md` §5 记「组合**两个** AudioScheduler（sfx/bgm）」，实装为**单实例 + 游戏侧双门控**（`beads-game.ts` L1471-1485 注释自陈） | 架构文档 ↔ 实现 | 以实现对齐文档（AGENTS §4：代码与 §3 冲突以 §3 为准并登记漂移；此处非 §3 数值，属架构口径）⇒ 建议程基岩/主理人在架构文档补一句「实装为单 scheduler 双门控」 |
| C-A05-3 | `sfx_ui_tap` 已落码但 ux-spec §5 **无对应行**；§5「面板入/出＝抽屉音」**无接线** | `ux-spec.md` §5 ↔ `tuning.ts` L354-355 ↔ `beads-game.ts` 7 处 | 见 `audio-events.md` §5 Q-A05-1：**推荐**新增 `sfx_panel_in/out` 归位 §5，并请文策渊在 §5 增「面板按钮点击」一行让 `sfx_ui_tap` 合法化（**我不改 UX**） |
| C-A05-4 | `_sfx()` 统一 `minInterval: 0.05` ⇒ `sfx_reject` 可达 20 次/秒，**违反 §3.8「≤2 次/秒」** | `beads-game.ts` L1484 | 工程修正（波次 4 或 T-084 判据 A05-05/06 直接捕获）：改 per-clip 分档表 |

---

## 8. `[TODO]` 汇总（诚实清单：**本篇未定的全部数值**）

| # | 未定项 | 解除条件（谁/何时） |
|---|---|---|
| T1 | 三条 bus 的相对增益 / dB 基准（`AUDIO_BUS_GAIN_BGM/SFX/UI`） | `[B]` 后端可听后由我定档 → 回写本篇 §2.2 + SKILL §4 |
| T2 | `bgm_main` 循环时长、循环点位置、BPM、调性、乐句结构 | 合成路线：我出音符序列常量表（波次 4 与工程同批）；回退采样：`indie-game-ost-pack` 交付时附循环点说明。**解除条件（WXG-T-103 写死）= A05-21 `[B]`（无缝循环）+ A05-22 `[B]+[R]`（幂等/不跳针）跑完并试听循环点**；`audio-voices.ts` 的 `BGM_LOOP_MS=8000 ms` 与「4/4、≈120 BPM」为**工程占位**，不得回引 |
| T3 | 19 条 clip 的合成配方数值（基频 Hz / attack-decay ms / 增益 / 滤波截止） | `[B]` 可听 + `[P]` 人耳（A05-26）后定档；总时长上限已由 §5 冻结 |
| T4 | `sfx_ui_tap` 时长（§5 无行） | 待 Q-A05-1 裁决（ux-spec §5 增行）后取值。**解除不依赖 `[B]/[R]` 实测**（WXG-T-103：缺口在规格不在听感）；现实现占位 40 ms 仅工程，不得回引 |
| T5 | 采样率 / 位深 / （回退时）编码格式与码率 | `[R]` 真机取证：微信 WebAudioContext 支持面 + iOS 高性能模式行为 |
| T6 | 回退采样路线时的 SFX 池上限、BGM 预加载时机 | `[R]` 真机（InnerAudioContext 资源不自动释放，须实测上限） |
| T7 | duck 量与恢复时长（若后端补 `setVolume`） | 需求单第 4 项落地后 |
| T8 | 合成代码增量 KB（构建后实测） | `[C]`：波次 4 落码后 `du -sk` 实测回写 §4.2 |
| T9 | AudioContext 首次手势创建 → 首个音效可发声的延迟 ms | `[B]`/`[R]` 实测；决定是否加「手势预热」 |
| T10 | 微信 `WebAudioContext` 节点子集可用性（Oscillator/Gain/Buffer/BiquadFilter） | `[R]`：开发者工具 + AppID（本轮**无法**验证，§4.1 回退条件的唯一触发源） |

---

## 9. 交付与验收（SKILL §6 对齐）

- 每条音效/曲目交付物 = **clip id + 事件映射（`audio-events.md` §1）+ 合成配方或文件（含 BGM 循环点说明）**；状态列 `待做 → 已做 → 已验收` 三态推进，`已验收` 必须有对应道次证据（`[N]`/`[B]`/`[C]`/`[R]`/`[P]`），**禁止无证据跳级**（AGENTS §7 防假绿）。
- 本篇 28 条判据（`audio-events.md` §4；**WXG-T-103 冲突 C1**：原 A05-09 拆为 A05-09（主体改 `sfx_combo_t2`）+ A05-09b（`sfx_combo_t3`），编号不重排）= T-084 QA 用例的直接输入，按道次精确分账：**纯 `[N]` 16 条**（今天可落 vitest）+ **含 `[N]` 的混合 7 条**（A05-04/09/09b/13/15/16/21：入队与同帧部分今天可断言，时长/听感部分挂起）+ **`[C]` 1 条**（A05-25，今天可对构建产物断言）+ **完全挂起 4 条**（A05-03 `[B][P]` / A05-22 `[B][R]` / A05-26 `[P]` / A05-27 `[R]`）。挂起项必须标注阻塞源，**不得记为已验收**。
- 项目实做完成后：把 T1–T10 的实际数值回写 `my-skills/wxgame-audio-spec/SKILL.md` 的 `[TODO]` 位（SKILL 文首约定：首款游戏实做音频时由音频负责人填充并回写）——**beads 是本仓第一款有音频规格的游戏，回写义务落在本单后续**。
