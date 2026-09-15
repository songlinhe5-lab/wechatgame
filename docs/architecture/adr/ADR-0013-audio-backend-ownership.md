# ADR-0013 — 音频后端归属：合成引擎住框架 platform 层，voice 表由游戏侧注入

- 编号：ADR-0013（0008 预约给「每日挑战」未落盘 = 跳空合规；0009–0012 已用）
- 状态：**Accepted**（2026-09-15，WXG-T-096 · 波次 4「音频可玩性 BD-05 / BD-05b」；授权来源 = 本单任务书 Deliverable ①）
- 关联：`games/beads/design/audio/audio-spec.md §4.1/§4.3/§6.2`、`audio-events.md §1/§3/§4`、`systems-index.md §3.12`（选型 = 程序化合成 **0 KB 主包**）、ADR-0002（core 纯 Node 可测）、`memory/2026-09-12.md`（旧裁决「不动框架」——见 §1 末段）
- 冻结常量：**不改动任何既有值**；但本单开工前已按串行程序在 `systems-index §3.12` **新增 6 行**（v1.18：`AUDIO_CLIP_TOTAL` / `AUDIO_MAX_PER_FRAME` / `AUDIO_URGENT_BEAT_PERIOD` / `AUDIO_URGENT_MIN_INTERVAL` / `AUDIO_TRAYFULL_MIN_INTERVAL` / `AUDIO_HEARABLE_FLASH_HZ`）+ 一行划界（**音色合成参数不属 §3**）⇒ 真源仍只 §3，本 ADR 不携带任何数值规格

## 1. 上下文（Context）

beads 的可玩性缺口里有一条是**彻底静音**：三平台的 `createAudioBackend()` 一律返回 `NullAudioBackend`（GAP-05 / BD-05b）。要出声就必须落地 `systems-index §3.12` 已冻结的选型——**运行时程序化合成，主包零音频文件**（判据 A05-25「产物内音频资产文件数 = 0」）。于是「引擎放哪、音色表放哪」成为一个未决的架构问题。

约束（本轮逐条核实，非推测）：

1. **L2**：`packages/framework/src/core/**` 禁止 `cc` / DOM / `wx`（`control-manifest.md`）⇒ 合成引擎**不能**住在 `core/audio/audio.ts`（它必须触碰 `AudioContext`）。core 只留数据类型（`AudioVoice` / `AudioVoices` / `AudioBackendOptions`）。
2. **L3**：`games/*/src` 不引引擎、且必须能在纯 Node 跑单测 ⇒ 引擎同样**不能**住游戏侧。
3. **框架不得认识玩法**：clip id（`sfx_place` / `sfx_urgent_beat` / `bgm_main` …）与它们的波形、包络、滤波、时长全部来自 `audio-events.md §1`（游戏设计面）。把它们写进框架 = 反向依赖，且第二款车型要改框架。
4. **CI 不得依赖真实音频设备或真实时钟** ⇒ Node 平台必须继续返回静音 backend，否则单测面被污染。
5. **微信 runtime**：`wx.createWebAudioContext()` 是 weapp 侧唯一可用的合成入口（需求单 §6.2 第 7 项要 weapp 对偶实现）；其节点子集是否齐备**未做真机核实**（A05-27 `[R]`）。
6. **授权面（旧政与本单的关系）**：2026-09-12 裁定「**不动框架**」（`memory/2026-09-12.md`：架构缺口登记为「两个 `AudioScheduler` 共享一个 `AudioBackend` 不可达，未来若批准 `GameServices` 加 `audioBackend` 字段，唯一改动点已注释标出」）。WXG-T-096 任务书 Deliverable ① 明确批准改框架侧 backend ⇒ 本 ADR 是那次批准的**执行记录**，但落地方式比旧注更保守：只扩 `Platform.createAudioBackend(options)` 的入参，**没有**把 backend 交给 `GameServices`，所以旧登记的双调度器缺口**仍然开着**（见 §4.3）。

## 2. 备选方案（Alternatives）

**方案甲（采用）：引擎住 `platform/audio-synth.ts`，voice 表由游戏侧注入**
- 事实：一份引擎三平台共用，按**最小 Web Audio 结构面**（`SynthContext` / `SynthGain` / `SynthOsc` / `SynthBufferSource` / `SynthFilter`，均为结构类型）编程，因此 web 与 `wx.createWebAudioContext()` 的子集可同时满足；音色语义留在游戏侧 `Game.audioVoices`，由 `App` 透传给 `Platform.createAudioBackend({ voices })`。框架侧零玩法 id。
- 成本：新增一条数据通道（`Game.audioVoices` → `App` → `Platform`）；未登记 id 需定义行为（本 ADR 定为「静默 + 一次性 warn」）。

**方案乙：音色库也进框架（框架内置 beads 的 19 条配方）**
- 事实：接线最省，游戏侧零数据。
- 否因：框架被 breakout 共用，却内置 beads 玩法 id ⇒ **反向依赖**；每加一款游戏、每改一条音色都要动框架并跑框架测试；L3「玩法脱离编辑器可验证」的精神也要求音色随玩法走。

**方案丙：引擎住游戏侧（`games/beads/src/…`）**
- 事实：与玩法数据同处，改动面局部。
- 否因：违反约束 1/2——该文件必须读 `AudioContext` / `wx`，既不能进 `core`，也不该进 `games/*/src`（Node 单测与 harness 编译面都会被打穿，与 `adapters/cocos/bindings.ts` 不进 barrel 同一判例）；breakout 复用只能复制一份。⇒ 引擎与玩法**必须分层**。

**方案丁：weapp 用 `InnerAudioContext` + 预生成音频文件（微信小游戏最常见做法）**
- 事实：`InnerAudioContext` 只能播文件（`src`），成熟、真机风险低。
- 否因：**与已冻结选型正面冲突**——`systems-index §3.12` / A05-D1 承诺主包音频 0 KB，实测产物 1968 KB vs 内部目标 2000 KB（余量 32 KB），任何采样 BGM（≥240 KB）击穿（`audio-spec §4.2`）。且本单交付的是**合成 PCM**，无路径交给只能播文件的 `InnerAudioContext`（除非改成先渲染 wav 落盘 = 换选型）。`audio-spec §4.1` 已把回退条件写死：**先由主理人解除内部目标冲突**，本轮不成立 ⇒ 不采。

## 3. 决定（Decision）

1. **唯一引擎**：`packages/framework/src/platform/audio-synth.ts` 的 `SynthAudioBackend`。它不 import `cc`、不读 `window` / `wx`——context 由平台适配器以**工厂回调** `_openContext: () => SynthContext | null` 注入；异常出口以 `SynthHost.warn` 注入（平台侧接 `platform.log`，测试侧接收集器）。
2. **voice 表归游戏侧**：`Game.audioVoices`（纯数据，`AudioVoices = Readonly<Record<string, AudioVoice>>`）。`App` 构造 backend 时透传 `{ voices: game.audioVoices }`。框架不发源地任何音色。
3. **未登记 clip ⇒ 不发声 + 一次性 warn**，禁止 backend 代为发明音色（「听起来不对」比「听起来是随机发明的声音」更容易定位）。
4. **能力探测优先于伪造**：web 缺 `AudioContext`/`webkitAudioContext` 或缺 voices ⇒ `NullAudioBackend`；weapp 缺 `wx.createWebAudioContext` ⇒ `NullAudioBackend` + 一次性 warn（**不谎称 iOS 能出声**）；node 恒 `NullAudioBackend`（签名接受 `AudioBackendOptions` 但忽略，以护单测）。
5. **自动播放契约（`audio-spec §4.4`）**：context 不在构造期创建；`unlock()` 由平台侧首次真实手势（`pointerdown`/`touchstart`/`keydown`，或 weapp `onTouchStart`）触发并摘除监听。解锁前：一次性请求丢弃、loop 请求记入 `_wantedLoops`（**期望态**，与「正在播」的 `_loops` 分离），解锁瞬间补起；退后台 `suspend()` 只停实际发声、保留期望态，回前台 `resume()` 据此补起 ⇒ BOOT 期的 `bgm_main` 不丢。
6. **本轮明确不做**（登记为剩余项，不冒充交付）：① `priority/steal`（需求单第 5 项，P2）——`audio-events §3.1` 已核算同帧最坏 ≤4 < `AUDIO_MAX_PER_FRAME = 6`，MVP 用「入队序 + per-clip 限流」无损；② 三总线**增益数值**——`AUDIO_BUS_GAIN_* = [TODO]`，故三条 gain 链一律 1.0（伪 dB 比静音更糟）；③ 方案丁的 `InnerAudioContext` 池。
7. 数值真源不动：所有 Hz / ms / 增益在 `audio-voices.ts` 标为**工程占位**，不得回引为规格（`audio-spec §4.3`）；镜像一律 `pnpm run framework:sync` 产出。

## 4. 后果（Consequences）

**4.1 正面**
- harness（浏览器）与微信侧第一次具备**可出声路径**：结构、生命周期、幂等、限流均可机验；「真机有没有响」另计 `[R]`。
- 框架保持零玩法知识：`packages/framework/**` 里搜不到任何 `sfx_*` / `bgm_*` id（beads 的 19 条配方在 `games/beads/src/config/audio-voices.ts`）。
- Node 单测零真实时钟/设备：`framework` 255 例 + `beads` 224 例全绿，其中 `tests/platform/audio-synth.test.ts` 用**假 Web Audio 记录型夹具** 15 例覆盖结构与契约（构造期不建 context、未登记 id 静默、三总线只建一次、多音源 notes、噪声 buffer 复用、loop 幂等、suspend/resume 期望态、`stop/stopAll`、循环 buffer 只渲染一次、`setVolume` 夹取与当场生效、`usesExternalFiles() === false`）。
- 零文件承诺获得运行时旁证：`SynthAudioBackend.usesExternalFiles()` 恒 `false`，且所有 buffer 都来自 `createBuffer()`（不引 URL）。
- 顺带修正一处现状红线违约：`sfx_reject` 从统一 0.05 s 限流改为分档 0.5 s（旧值 20 次/秒，违反 §3.8「错误反馈 ≤2 次/秒」，冲突登记 C-A05-4）。

**4.2 负面（白纸黑字——不是「风险」）**
- **偏离本单任务书 Deliverable ①**：weapp 侧 `InnerAudioContext` 池**未实现**（理由见 §2 丁）。⇒ 该 Deliverable 属**部分交付**。后果具体化：若真机证明 `wx.createWebAudioContext` 不可用，weapp 侧**没有第二方案**，只有启动时一条 warn ⇒ 静音。解除条件：`audio-spec §4.1` 的回退触发成立，且主理人先解除 §3.9 主包余量冲突。
- **听感未成立**：全部合成参数是占位值（`audio-spec §4.3` 数值一律 `[TODO]`）。`BGM_LOOP_MS = 8000` 取 8 s 而非建议 30–60 s（离线渲染的循环缓冲按 `sampleRate × loopMs` 占内存，8 s ≈ 1.4 MB Float32，40 s 则 ~7 MB，不适合小游戏）；`sfx_ui_tap` 40 ms 因 `ux-spec §5` 缺该行（Q-A05-1 未裁）⇒ 时长、音色、响度须 `[B]`/`[P]` 道次，**本 ADR 不声称任何一条已验收**。
- **热路径不是零分配**：Web Audio 的 `OscillatorNode`/`BufferSource` 一次性，stop 后不可重启 ⇒ 「每次发声零 new」在该 runtime 下做不到。可复用的只建一次（三条 bus gain、每 clip 的 filter、噪声 buffer、循环 buffer），其余源节点数量由 `AUDIO_MAX_PER_FRAME`(6) × 每 clip 音数(≤4) 限界 ⇒ 最坏 ~24 个短命节点/帧，且只发生在 `flush()`。这与「热路径零分配」铁律构成**有界偏离**，CPU 结论待 `[R]`（A05-27）。
- **忘登记 voice ⇒ 静默失效**：唯一线索是控制台一次性 warn，而 Node 侧恒 Null ⇒ CI 永远绿。兜底只有 beads 侧的清单闭合测试（A05-24：`tuning.ts` clip 集 ≡ `audio-events §1` 表 ≡ voice 表 key 集）；新增 clip 时若漏改测试用的 `SPEC_CLIPS`，该兜底同样失效（三道账要人保持同步）。
- **三总线增益 1.0 是临时期状态**：19 条 clip 同帧最坏 4 条叠加，真机上可能削顶/过响；在 `AUDIO_BUS_GAIN_*` 冻结前，本 ADR 不提供任何混音保证。
- 解锁前的一次性音效请求被丢弃——autoplay policy 下本就无声，但若某 runtime 允许无手势出声，我们会**少一次音**（loop 有期望态兜底，一次性音没有）。
- **回前台的 BGM 从循环起点重来**：`suspend()` 停实际发声、`resume()` 按期望态**新建** `BufferSource`（一次性源不可复用）⇒ 不是从中断处继续，而是重新起播。可接受与否属 `[R]/[P]`（QA 冲突登记 C5，见 `g4-regression-report.md §19.7`），本 ADR 不自行判定为缺陷，也不声称已验收。
- **首次播放前有可测的同步开销**：循环 buffer 与噪声 buffer 走**惰性离线渲染**（首帧该 clip 才 `createBuffer` + 填充）⇒ 首播那一帧多一次 CPU 峰值，是否造成帧抖属 `[B]/[R]`（C6）。改为构造期预渲染会把成本挪到启动帧并放大常驻内存，本轮不采。

**4.3 中性 / 待观察**
- 本 ADR 落地后暴露一处**文档矛盾**：`docs/architecture/architecture.md` 的包体预算表仍写「首屏音频 ≤ 300 KB / 短音效用压缩音频 / BGM 走远程包或分包」，与 `systems-index §3.12` 的 0 KB 选型冲突 ⇒ 按「先改文档再改代码」同批回写为 0 KB（程序化合成），并引本 ADR。
- 2026-09-12 登记的「双 `AudioScheduler` 共享一个 backend」缺口**未关闭**：本 ADR 只扩工厂入参，`GameServices` 仍不暴露 backend。beads 继续以「单调度器 + 双逻辑通道」（BGM = loop clip 的 stop/重请求、SFX = 请求闸门）实现，该替代实现的行为由 `pause-settings.test.ts` / 本单的 A05-23 静音双通道用例机验。
- A05-25 `[C]`（构建产物内音频文件数 = 0）与 A05-27 `[R]`（真机出声 / iOS 解锁 / 退后台恢复 / CPU）**本轮均未验**：`build:wx` 与 Cocos CLI 未接 CI，且无 AppID/真机。
- `AudioBackend` 接口**未**新增 `unlock/suspend/resume`——它们是 `SynthAudioBackend` 的具体能力，由持有它的平台适配器调用。core 契约保持三方法（`play/stop/stopAll`），避免把 Web Audio 的生命周期形状强加给未来的其它 backend。

## 5. 复评触发条件（Review Triggers）

- **真机取证证明 `wx.createWebAudioContext` 缺所需节点子集**（Oscillator / Gain / BufferSource / Biquad 任一不可用）或 iOS 高性能模式下合成不稳定 ⇒ 触发 `audio-spec §4.1` 回退评估（先解内部目标冲突），并改判 §3.4 的「Null + warn」。
- **第二款车型接入音频** ⇒ 复评 voice 表接口形状：`AudioVoice` 是否需要版本化、是否把通用配方工具（包络/和声生成）下沉为框架内**无玩法语义**的函数库。
- **出现「需要抢占」的真实场景**（同帧 >6 条、或语音口播要 ducking BGM）⇒ 开需求单第 5 项 priority/steal，并把 §4.2 的节点数上界重算。
- **真机 CPU 采样显示音频节点造成可测掉帧** ⇒ 复评一次性源节点面（预渲染 buffer 池 / 减少 notes 数 / 把部分 clip 改成循环 buffer）。
- **`AUDIO_BUS_GAIN_*` 冻结时**（后端可听 + 真机响度校准后）⇒ 复评 §3.6 的 1.0 占位并回写三总线；同时复评 §4.2 的削顶问题。
- 若未来批准把 `AudioBackend` 交给 `GameServices`（旧 2026-09-12 注的那条路）⇒ 复评 §4.3 的双调度器缺口，届时 `architecture-beads §2` 的原案才可达。
