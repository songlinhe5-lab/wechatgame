# 《拼豆填色消除》(beads) G4 硬判据回归报告 · 现状基线轮

- 任务号：**WXG-T-084**（P0，波次 1）｜ 作者：**严守真**（质量负责人）｜ 版本 **v1.0** ｜ 日期 **2026-09-14**
- 形态对齐：`production/qa/g4-regression-report.md`（breakout 判例，六节结构 + D-01 假绿判例）
- **本报告是 beads 的首份 G4 报告**——此前 `production/qa/` 下只有 breakout 版，beads 的 G4 **从未执行**（缺陷 BD-14）。
- 裁定边界：本文只产**证据 + 建议裁定**；PASS / CONCERNS / FAIL 的最终裁决归主理人（`my-skills/wxgame-orchestration/SKILL.md`）。
- 判据纪律：全部判据从 `games/beads/design/gdd/*.md` **§8** 导出；数值只引用 `systems-index.md §3` **冻结常量名**；表现层判据引 `art/assets-spec.md §1.2`、`art/accessibility.md`、`design/ux/ux-spec.md §5/§6`、`design/audio/audio-events.md §4`（T-083 已声明「供 WXG-T-084 引用」）。**零自造数值。**
- 缺陷编号：本报告启用 **`BD-nn`** 新序列（Beads Defect），与 breakout 的 `D-0n`、beads 阶段 0 的 `D-01..D-05`（见 `production/archive/TASKS-DETAIL-archive.md`）**物理隔离**，避免跨轮撞号。

> ──────────────────────────────────────────────────────────────────────────
> **当前版本 v1.2（P5 音频段复跑，2026-09-15，WXG-T-096 / 严守真）**
> **升版理由（而不是叫「v1.1 勘误」）**：本单推翻了 P5 / BD-05 的**事实前提**（框架侧已落 `SynthAudioBackend`、
> beads 侧 19 个 clip 与事件→clip 派发已存在），因而改的是**门禁判据的结论**（v1.1 的 P5=FAIL 已成假 FAIL）；
> 同时本单还暴露了探针**自己**对另一段预期值的污染（P4，修订 36）。内容已变 ⇒ 需可引用的版本号。
> ❗ **范围铁声明：v1.2 只重跑了 P5 段（27 条 A05 + 1 条结构证据 = 28 条）。其余 25 组（P1–P4、P6–P26）
> 未随 WXG-T-096 重跑，判定与预期值一律沿用 v1.1**（本轮仅作为回归对照确认 25/25 判定未漂移，
> **这不等于全轮复验完成**，不得合并计数解读）。v1.2 正文 = **§19**；§1–§18 为历史谱系，
> 只在被推翻处加【v1.2 注】标记，**不改写原文**。
> 证据：`production/qa/beads/evidence/g4-reverify-v1.2.log`（§0 范围声明 / §1 探针 stdout / §2 命令与计数 /
> §3 P5 逐条判定索引 / §4 诊断脚本 / §5 未执行・⛔ 清单 / §6 汇总核对）。

> **上一版本 v1.1（复验轮，2026-09-15，WXG-T-092 / 严守真）**
> §1–§11 是 **v1.0 修复前基线正文**，原样保留作历史谱系（其中「建议裁定 G4=FAIL」「13 处探针缺陷」「8 项判据冲突」均已被复验轮改写）。
> **复验轮结论全部在 §12–§18**：逐探针改判表、BD-01..26 处置状、新缺陷 BD-27..32、§8 冲突关闭标记、§G 20 条可验道次、建议裁定与剩余阻塞清单；**§18.5 = 主理人正式裁决（G4 = CONCERNS + 放行范围 + 限制声明）**。
> 证据：`production/qa/beads/evidence/g4-reverify-v1.1.log`（§1 探针 / §2 verify / §3 单点复跑 / §4 诊断脚本 / §5 未执行道次）。
> ──────────────────────────────────────────────────────────────────────────

---

## 1. 结论与建议裁定

### 1.1 G4 建议裁定：**FAIL**

> **一句依据**：19 组探针中 **11 组 FAIL**，其中 **6 项 P0 级「玩家可感知」判据（BD-01/02/03/04/06 + BD-05）全部不成立**——玩家既看不到「哪格填什么色」，开局 ≥`SPAWN_INTERVAL` 秒无珠可选，落子/拒绝零动效零音效，满槽死珠后**唯一出口是等归零判负**；这不是「少量不可测」，而是主链路可玩性主体缺失。

**与 breakout 判例的对照（说明为何不是 CONCERNS）**：

| | breakout（`production/qa/g4-regression-report.md`） | **beads 本轮** |
|---|---|---|
| 逐条结果 | 11 PASS / 2 ⛔不可测 / 0 FAIL | **2 无条件 PASS / 5 PASS\*（带条件）/ 11 FAIL / 1 ⛔** |
| 不可测项性质 | 单一缺口 D-01（reduceMotion 未实现） | 4 类阻塞（真机 / 音频后端 / harness 污染 / Cocos 构建） |
| 建议裁定 | CONCERNS | **FAIL** |
| 依据（orchestration 挂钩） | 「少量不可测但主体达标」 | 「宣称硬判据达标」的必要条件 **G4 全绿**远未满足；且 **G1 亦未过**（§3） |

按 `wxgame-orchestration`：CONCERNS 须「登记未过门编号 + 缓解与解除条件」。本轮未过门为 **G1 + G4**（G2/G3 主体通过，但 G3 的 Cocos 取证路径被阻塞、`check:size` 对 beads 零覆盖），且 FAIL 项含 6 个 P0 ⇒ **不建议 CONCERNS**。

### 1.2 分轮建议（呼应任务单「分两次」）

| 轮次 | 范围 | 预期 |
|---|---|---|
| **本轮 = 现状基线 G4** | Node 层可断言项 + 表现层**规格 vs 实现**机械核对 | **FAIL**（本文） |
| 复验 G4（波次 2 后） | T-085/086/087 落地 + `framework:sync` + 音频后端 + harness 修复后重跑 `g4-probe.mjs` | 目标 PASS；`[Device]` 项仍须真机到位 |

复验前置清单见 §10。

### 1.3 未过 / 未测门一览

| 门 | 结论 | 说明 |
|---|---|---|
| **G1 静态门** | ❌ **FAIL** | `pnpm run verify` 第 8/13 项 `framework:sync:check` 失败（4 处拷贝件漂移）⇒ `&&` 短路，第 9–13 项**从未执行**（BD-17/BD-20） |
| **G2 单测门** | ✅ PASS（有覆盖缺口） | beads 20 文件 / 184 用例全绿（2.15s）；breakout 12 / 239 全绿。**但 S2 `input-control` §8 全 10 条零自动化测试文件**（BD-21） |
| **G3 冒烟门** | ⚠️ **部分**（主体 PASS，取证路径 FAIL） | `harness:smoke` 双游戏 OK；`build:cocos:web`（beads）**被前置检查阻塞 FAIL**；`preview:frames` **不支持 beads** |
| **G4 硬判据门** | ❌ **FAIL** | 见 §4 |
| G5 真机门 | ⛔ **未执行** | 微信开发者工具未装、无 AppID（环境事实③） |

---

## 2. 本轮可执行测试范围（先声明范围，再给结论）

| 取证道次 | 状态 | 影响 |
|---|---|---|
| `[Node]` vitest + 只读探针 | ✅ **可执行** | 本报告 19 组探针全部走此道次 |
| `[Harness]` 浏览器（canvas2d） | ⚠️ **可执行但结论被污染** | GAP-07（DPR 坐标 ⇒ 点击全打飞）/ GAP-08（文字镜像）未修 ⇒ 本轮**所有 `[Harness]` 用例一律标「⛔ 污染」**，禁止标绿（BD-07/BD-08） |
| `[Cocos]` 编辑器 / web-mobile 产物 | ⛔ **本轮被阻塞** | `build:cocos:web`（beads）前置检查报「拷贝件与源码不一致」⇒ 解除条件 = 先跑 `pnpm run framework:sync`（BD-20）。**任务单环境事实②「`build:cocos:web` 已通」在当前 HEAD 已不再成立** |
| `[Device]` 真机 | ⛔ **不可执行** | 微信开发者工具未装、无 AppID ⇒ `TC-INP-09`（多点触控）、`TC-A11Y-02`（热区）、`SC-11`（杀进程续进）、`SC-13`（onHide）、A05-27 全部标「⛔ 不可测」，**不跳过、不标绿**（breakout D-01 教训） |
| 音频（`[B]`/`[P]` 道次） | ⛔ **不可执行且真机不解除** | `packages/framework/src/platform/{node,web,weapp}.ts` **三者 audio backend 均为 `NullAudioBackend`**（node.ts:57 / web.ts:60 / weapp.ts:139）⇒ 真机到位也无声；解除条件 = 先落 Web Audio / `InnerAudioContext` 后端（BD-05b）。**【v1.2 注：本行前提已被 WXG-T-096 推翻（web/weapp 具备能力时返回真合成后端），见 §19.4；本行作为 v1.0 基线事实原样保留】** |
| L6–L8 关卡 | ✅ Node 可达 / ⛔ harness 不可达 | `BeadsGame.goToLevel(index)` **公开存在**（beads-game.ts:595）⇒ L6 锁定格、L7/L8 8 色满配可走 Node 注入取证；harness 只暴露 L1–L5（BD-13） |
| 激励视频续时 | ⚠️ **不可作真机行为证据** | `MockRewardedAdProvider('complete')` ⇒ 续时必然成功；`ux-spec §4` 尾注已明示「续时后仍是同一个死局，验证时勿误读为已修复」 |

---

## 3. G1–G3 全量实跑证据（13 项 `pnpm run verify` 逐项）

> 原始日志：`production/qa/beads/evidence/g1-g3-verify.log`（verify 全量）、`evidence/g1-g3-item9-13.log`（第 9–13 项逐项补跑）、`evidence/g2-test.log`、`evidence/g3-harness-smoke.log`、`evidence/g3-build-cocos-web-beads.log`。

| # | 命令 | 结果 | 输出摘要 |
|---|---|---|---|
| 1 | `check:arch` | ✅ PASS | OK（1 warning：`177 editor-generated files`） |
| 2 | `check:secrets` | ✅ PASS | OK，扫描 809 文件 |
| 3 | `check:tasks` | ✅ PASS | OK，主表 16 行 / 详情 16 节 |
| 4 | `check:links` | ✅ PASS | OK，agents=7 / skills=17 |
| 5 | `check:mcp` | ✅ PASS | OK，3 份一致 |
| 6 | `levels:check` | ✅ PASS | OK，2 款游戏关卡数据校验通过 |
| 7 | `typecheck` | ✅ PASS | OK，3 包零错 |
| 8 | **`framework:sync:check`** | ❌ **FAIL** | `cocos/assets/scripts/{framework,game}` 与源码**不同步（4 处）**：beads `bindings.ts` / `cocos-renderer.ts`、breakout 同两文件均 `OUT (differs)`；脚本给出解除命令 `node tools/scripts/sync-framework-to-cocos.mjs`。`EXIT=1` |
| 9 | `cocos:check` | ✅ PASS（**补跑**） | beads / breakout Cocos 脚本类型检查双双通过 |
| 10 | `check:size` | ⚠️ PASS 但**对 beads 零覆盖** | 只测 `games/breakout/cocos/build/wechatgame`：主包 1815.1 KB（24 文件）≤ 内部目标 2000 KB ⇒ 报「✅ 包体校验 OK」。**beads 产物不存在 ⇒ 从未被校验，却整体报绿**（BD-18） |
| 11 | `test` | ✅ PASS（**补跑**） | beads **20 文件 / 184 passed / 2.15s**；breakout **12 文件 / 239 passed** |
| 12 | `harness:build` | ✅ PASS（**补跑**） | `✅ build ok` |
| 13 | `harness:smoke` | ✅ PASS（**补跑**） | `🎉 harness smoke OK — breakout, beads`；beads 段：`boot: 6×5 board, 30 cells, 12 tray slots, phase playing` / `painted over 5 frames: rect=0 arc=930 fill=280 fillText=40` / `render model produced 67 draw commands` |

**⇒ `pnpm run verify` 整体 EXIT=1，G1 未过。**

### 3.1 额外实跑（不在 verify 链内，任务单③点名）

| 命令 | 结果 | 摘要 |
|---|---|---|
| `build:cocos:web`（beads） | ❌ **FAIL** | `✅ Cocos 工程存在 ✅ Main.scene 存在 ℹ️ 编辑器 MCP 在线（tools:21）` → `❌ 前置检查未通过：拷贝件与源码不一致 —— 直接构建会编出旧代码 → 先跑 pnpm run framework:sync`。`EXIT=1` |
| `preview:frames` | ⚠️ **不支持 beads** | 脚本硬编码 breakout API（`game.movePaddleTo(game.ball.x)` / `bricksDestroyed`）⇒ beads 无帧预览取证工具（BD-19）。**副作用登记**：`--help` 未被识别、脚本直接执行了 breakout 渲染并覆写 `dev/harness/preview/level-{1..5}.svg`（可再生产物，无源码损失） |
| `npx vitest run`（games/beads） | ✅ PASS | 20 / 184（与 verify 第 11 项一致，交叉验证） |

### 3.2 漂移归属（只登记事实，不追责）

`git status` 干净、漂移**已提交在 HEAD**（T-077 之后的提交），源码时间戳新于 Cocos 拷贝件 ⇒ 属「改完 framework 忘记重跑 `framework:sync`」。**解除条件**：执行 `pnpm run framework:sync`（会写 4 个受版本控制的拷贝件）——属工程侧写操作，本 agent `readonly` 不代行，移交主理人 / T-082。

---

## 4. G4 逐条用例结果（19 组探针）

> 取证工具：**`production/qa/beads/g4-probe.mjs` v3**（只读探针，不改 `src/**`、`design/**`、`art/**`；复用 `harness:build` 编译产物 + `tests/helpers.ts` 等价装配）。
> 原始输出：**`production/qa/beads/evidence/g4-probe-v3.log`**（18 KB，逐条含证据串）。
> 复现命令：`node production/qa/beads/g4-probe.mjs`
> 玩法驱动一律走 `tapDesign()` / `giveTrayBead()` / `goToLevel()` debug hooks（设计坐标），**刻意绕开** `screenToDesign`（GAP-07 污染链路）。

| # | 探针 / 用例 ID | 判据来源 | 结论 | 缺陷 | 证据摘要 |
|---|---|---|---|---|---|
| P1 | **TC-PER-01** 空槽目标色 | `assets-spec §1.2` E1/E3/E4；`accessibility A2/A2b/A3`；`ux-spec §1-3` | ❌ **FAIL** | **BD-01** | L1（`levelId=l1`）`empty` 格 **22** 个、图案需 **3** 色（`colorIdx=1,5,6`）；拼图带内 `BEAD_CELL` 尺寸矩形 22 个，填充色**去重后仅 1 种 `#EDE7DA`**（= `palette.slot`）。代码铁证：`bead-render.ts:159` `drawEmptySocket(builder, cx, cy, palette, size)` **签名无 `colorIdx`**；`EMPTY_TINT_MIX` / `EMPTY_GHOST_ALPHA` 在 `src/**` 命中 **0** ⇒ E1 色底 / E3 内上阴影 / E4 幽灵符号**三层全缺** |
| P2 | **TC-PER-02** 开局托盘有珠 | `ux-spec §6.1`（1.5s = PLAYING 第 1 帧首颗珠已在托盘）+ §6.2 U7 裁定 | ❌ **FAIL** | **BD-02** | L1 实测 t=0 / 1.5s / 3.0s 持有 **0 / 0 / 0** 颗；首颗珠到达第 **361** 帧 = **6.02s**（L1 `spawnInterval=6s`）。对照组（注入 `spawnInterval=SPAWN_INTERVAL_DEFAULT`）首颗珠第 **241** 帧 = **4.02s** ⇒ 无论默认或关卡覆盖，开局 ≥4.0s（L1 6.0s）托盘全空。根因：`systems/spawner.ts:36` `_acc = 0` 起累、关卡装载无预置珠（U7 裁定要求 `_acc = interval` 后置，未落码） |
| P3 | **TC-PER-03** 无文字引导可被理解 | `ux-spec §1-3`（0 文字教学，裁定 (a)）+ §5 教学引导三行 + §6.1 | ❌ **FAIL** | **BD-03** | 开局 8s 内渲染文本去重 **14** 条：`05:00` `LV 1/8` `×1` `区域消除` `槽位清空` `随机消除` `04:59…04:52` ⇒ 只有倒计时/关卡号/倍率/道具标签，**零引导载体**。`snapshot.banner` / `subBanner` / `powerupHint` / `failHint` 全空。裁定 (a) 要求的三条引导通道（① `empty` 目标色底+幽灵符号 ② 单一 `hint` 格 ③ 首珠槽脉冲）**①②③ 全缺**（① 见 P1，②③ 见 P19/P7） |
| P4 | **TC-PER-04** 四类 VFX 可观察 | `ux-spec §5`：`vfx_fill_pop` 120ms / 放错 ±3px×2+danger 闪 2 次 200ms / `vfx_clear_dissolve` 200ms / `vfx_complete_wave` 逐列 20ms·800ms；`assets-spec §1.2` `wrong` 行 | ❌ **FAIL** | **BD-04** | ① 落座：落子前 **67** 指令，落子后连续 12 帧 `[76×12]` **恒定** ⇒ 无时间轴；② 拒绝：`bead:rejected=1`，其后 12 帧增量 `[8×12]` **恒定** ⇒ 无抖动、无 danger 闪；③ 完成波浪：无 clear-wave 代码路径。数据模型铁证：`entities/grid.ts:12` `CellState = 'empty'｜'filled'｜'locked'` ⇒ **无 `wrong`、无 `hint` 承载体**，规格两态运行时不可表达。现存动效仅面板 `progress` + 连击 Lv1/Lv3（Lv2 伪震屏已诚实登记为平台缺口 WXG-T-074） |
| P5 | **TC-PER-05** 关键事件有音效且与动效同帧 | `audio-events.md §4` A05-01/04/05/07/11/14/16（T-083 判据，`[N]` 道次） | ❌ **FAIL** | **BD-05 / BD-05b** | 脚本化全程事件：`tray:selected=0` `bead:placed=0` `tray:full=1` `powerup:used=1` `timer:urgent=1` `level:failed=1`；同期 `audio.play` clip **去重仅 2 种：`bgm_main`, `sfx_ui_tap`** ⇒ A05-01/04/05/07/11/14/16 **全部零派发**。`tuning.ts` 只定义 3 个 clip（`AUDIO_CLIP_BGM` / `AUDIO_CLIP_UI_TAP` / `AUDIO_CLIP_STAR`），而 `audio-events §1` 要求 **19** 个 id（A05-24 清单闭合判据 FAIL）；`_sfx()` 调用点 9 处全在 UI 按钮（7）+ 星入场（2）。**三平台均 `NullAudioBackend`** ⇒ 真机不解除阻塞 |
| P6 | **TC-PER-06** 满槽后存在非「整关重置」出口 | `ux-spec §4` 尾注（条件式承诺）+ `tray-spawner §2.4` 出口表 + §8 U8 | ❌ **FAIL** | **BD-06 / BD-15** | 灌入 12/12 颗非需色珠（`colorIdx=2` ∉ 图案色集 `{1,5,6}`）→ 推进 8s 仍满槽、`tray:full=1`（供料已停）。三道具首轮均 `used`；**第二轮全超限 ⇒ `[region=false, clearAll=false, random=false]`、`powerupHint=「即将开放」`（纯占位、零效果）**。扩展：`expandTray()` 直调 `=true`（方法存在），但**独立实例 6px 栅格全盘扫描 750×1334 命中 `tray:expanded`=0 个点** ⇒ 玩家无任何可点扩展入口（`btn_expand` / `_hitExpand` src 命中 0）。结局推演：灌满+道具用尽 → 推进 60s 仍满槽 12/12、`phase=playing`、`remaining=240.0s` → 推进至归零 `phase=game-over` ⇒ **零非「整关重置」出口**（判据要求 ≥1）。**注：U8 泄压阀方案仍 ⏳ 待用户拍板，本判据刻意写成方案中立** |
| P7 | **TC-PER-07** 告急脉冲 + 满槽告警可观察 | `ux-spec §5`（danger + 1000ms α 脉冲循环；托盘描边呼吸 500ms）；`timer-gameover §8-10`；`accessibility B3` | ❌ **FAIL** | **BD-10 / BD-09c** | ① 事件层 ✓：`snapshot.urgent=true`、`timer:urgent=1`（首穿 `TIMER_URGENT_T` 恰 1 次）；② 表现层 ✗：urgent 后连续 **60 帧**（1.0s = 一个完整脉冲周期）HUD 带**非文本**指令签名去重后 **1 种**（应 ≥2）⇒ 零脉冲、零图标变化。代码铁证：`view-model.ts:374-375` 仅 `timerColor = snap.urgent ? palette.danger : palette.text`；③ 满槽告警：`tray:full=1`，灌满前后全屏指令 67→151、托盘带内 13→49（增量**全为珠体本身**）⇒ **零告警图元**。⇒ `timer-gameover §8-10`「脉冲周期 1000ms±50ms、与满槽告警同屏叠加无 >3Hz 闪烁」**双主体缺失 → 该条实质 ⛔ 不可测** |
| P8 | **TC-INP-01** 五类路由 | `input-control §8-1` | ❌ **FAIL** | **BD-15** | ① 齿轮 → `game:paused=1`、`phase=paused` ✓；② 道具卡 → `powerup:used=1` ✓；③ **扩展 → 全盘扫描命中 `tray:expanded`=0** ✗；④ 托盘珠 → `tray:selected=1` ✓；⑤ 空格（有选中）→ `placed=1, rejected=0` ✓ ⇒ 判据「5 类指令逐一验证路由正确」**缺 1 类** |
| P9 | **TC-INP-02 / TC-INP-04** 热区边界 + 重叠区最近格心 | `input-control §8-2 / §8-4` | ⚠️ **PASS\*** | **BD-23**（判据冲突） | 目标格 `(r0,c1)` 格心 `(297.0, 904.0)`；`BEAD_CELL=50`、`GRID_HIT_SIZE=66`（半宽 33）、`BEAD_PITCH=52`（最近格心翻转点 26）。偏移 0/12/25 → 全部命中本格 ✓；偏移 26（平分点）→ 本格（实现用严格小于）；偏移 **27/32/33（在 §8-2「外扩边界内」但已过翻转点）→ 全部命中右邻格**；偏移 40/51/52 → 右邻格 ✓（§8-4 成立）；网格外（左侧出界 20px）→ 零事件 ✓。**§8-2 与 §8-4 在 `BEAD_PITCH < GRID_HIT_SIZE` 时互斥**，实现选择遵循 §8-4 ⇒ 按 §8-2 字面 FAIL、按 §8-4 PASS。另：因 pitch 52 < 命中区 66，**网格内部不存在「带间隙处」**，§8-2 后半只能在网格外验证 |
| P10 | **TC-INP-07** 无选中点网格 | `input-control §8-7`（「不发落子请求…**有轻提示**」） | ❌ **FAIL** | **BD-16** | ① 零请求 ✓：`bead:placed=0`、`bead:rejected=0`、`tray:selected=0`；② **轻提示 ✗**：四个提示字段全空、渲染指令数 67（无操作）vs 67（点击后）**完全相同** ⇒ 零反馈帧。代码铁证：`beads-game.ts:1327` `if (slot < 0) return false; // S2 gate: no bead selected → no request at all` |
| P11 | **TC-INP-06 / 08 / 10** 双击幂等·换选 / PAUSED 门禁 / 指令洪泛 | `input-control §8-6 / §8-8 / §8-10` | ⚠️ **PASS\*** | — | §8-6：双击同槽 `tray:selected=1` ✓；换选（独立实例）`=2` 且最终 `traySelected` 为后者 ✓。§8-8：PAUSED 下点托盘/网格/道具卡 ⇒ 事件总数 **0**、相位仍 `paused` ✓。§8-10：同帧 20 次 `tapDesign`（已先选珠）⇒ `bead:placed=1`、`rejected=0`、无崩溃 ✓\*。\*`tapDesign` 绕过 `InputManager`，**不能证明**真实一帧内 20 个 touch 只路由 1 条 ⇒ 弱化通过；§8-9 多点触控仍 ⛔（`[Device]`） |
| P12 | **TC-TRAY-02 / 04 / 05** 落槽均匀性·满槽去重恢复·扩展容量 | `tray-spawner §8-2 / §8-4 / §8-5`（**test-cases v1.2 零覆盖项，本轮补测**） | ✅ **PASS** | **BD-22**（判据口径） | §8-2：**200/200** 有效样本（注入 `spawnInterval=2.0s`+`time=420s` 关卡，白盒排水绕开 `POWERUP_FREE_USES`），落槽频次 `[12,15,20,12,14,21,17,20,22,12,13,22]`，期望 16.7/槽；**最大偏差 32.0%（判据 ≤±20% ⇒ 字面 FAIL）**、**卡方 11.20 < 临界 24.725（df=11、α=0.01 ⇒ 无显著差异）**。§8-4：满槽推 3 间隔 `tray:full=1`（去重生效）、满槽期 `tray:spawned=0`；排水后 1 间隔内 `=2` ✓。§8-5：12 槽 → `expandTray()=true` → **24** 槽 ✓（但扩展无 UI 入口 ⇒ 只证方法层，玩家不可达） |
| P13 | **GAP-07** harness DPR 坐标链路 | 环境事实④ | ⛔ **不可测（污染）** | **BD-07** | 实测 `NodePlatform(pixelRatio=2)` + `Viewport(750,1334)`：`screenToDesign(297.0, 904.0) → (297.0, 430.0)` ⇒ **y 轴被折叠**，与「点击全打飞」现象一致。本轮探针全部走 `tapDesign` 绕开该链路 ⇒ **S2 全部 `[Harness]` 用例结论不可信，一律标「⛔ 污染」**，解除条件 = T-087 修好换算 |
| P14 | **GAP-13** L6–L8 可达性 | 环境事实⑤ | ⚠️ **PASS\*（Node）/ ⛔（harness）** | **BD-13** | 关卡表 **8** 关（`id=1..8`）。`goToLevel(index)` 存在可用 ⇒ L6(`l6`) 12×9 `empty=59 locked=2 void=47` 色数 **7**；L7(`l7`) 13×10 `empty=79` 色数 **8**；L8(`l8`) 13×12 `empty=65 void=91` 色数 **8** ⇒ L6 锁定格、L7/L8 满配色判据**可走 Node 注入**。harness 侧仍只暴露 L1–L5 ⇒ `[Harness]/[Device]` 的 L6–L8 用例 ⛔ 受阻 |
| P15 | **TC-GRID-08** 13×12 极端定位 | `bead-grid §8-8` + `systems-index §3.3` | ⚠️ **PASS\*** | — | 156 格关卡装载成功（`gridCols=13 gridRows=12 cells=156`）；§3.3 派生公式抽样五格中心 `(0,0)=(63,1086)`、`(0,12)=(687,1086)`、`(11,0)=(63,514)`、`(11,12)=(687,514)`、`(6,6)=(375,774)`；约束 `gridLeft=38(≥30)` `gridTop=1111(≤1120)` `gridBottom=514.0(≥480)` **全满足**。\*为**公式复算**（Node 层），「误差 ≤0.5px」的**像素级**判定须待 Cocos 取证（本轮被 BD-20 阻塞） |
| P16 | **TC-TIMER-07** `LEVEL_TIME` 区间 | `timer-gameover §8-7` + §3.5 区间 `[180,420]` | ✅ **PASS** | — | 181 → `playing`；419 → `playing`；边界 180 / 420 → 均 `playing`；越界 100 → `phase=boot` + `L1010: time 100 outside [180, 420]`；越界 999 → `phase=boot` + `L1909: …` ⇒ BOOT 校验拒绝、不进 PLAYING、错误含关卡 id + 字段 |
| P17 | **TC-SAVE-07** 连胜 + v1.1 meta 字段 | `save-progress §8-7` + §2.3 ❄️冻结 v1.1 字段 | ❌ **FAIL** | **BD-12** | 连续通关 3 次（相位 `[level-clear ×3]`）后写档实测：`{"version":1,"runs":1,"maxUnlockedLevel":4,"currentLevel":4,"sprintBestScore":0,"sprintBestStage":0,"starsByLevel":[3,3,3,0,0,0,0,0],"settings":{"bgmMuted":false,"sfxMuted":false}}` ⇒ `winStreak` / `lastPlayDate` / `signin` 命中 **false**。`save-schema.ts` `BeadsSave` 无 `meta` 段；§2.3 冻结的 `meta.winStreakCurrent / winStreakBest / lastPlayDate / signin` 在 `src/**` 命中 **0** ⇒ §8-7 判据**无实现载体** |
| P18 | **TC-SAVE-09** PLAYING 零写档 / 结算帧恰 1 次 | `save-progress §8-9` | ⚠️ **PASS\*** | **BD-24**（判据不可构造） | 注入 `GRID_MAX_COLS×GRID_MAX_ROWS = 13×12 = 156` 格关卡，PLAYING 阶段成功落子 **150** 次（故意留 6 格 `empty`）⇒ ① 写档 **0** 次 ✓；② 再补 6 次填满 → `level:cleared=1`、**结算帧写档增量 = 1** ✓。③ 对照组（失败结局，`time=180s` 归零）：`level:failed=1`、写档增量 **0** ⇒ 失败结算帧零写档（`beads-game.ts:874-884` `game-over.onEnter` 不调 `_persistProgress()`；与 §8-2 一致，**不判缺陷**，仅登记事实供策划确认 §8-9「结算帧」是否含失败帧） |
| P19 | **TC-PER-08** `hint` 悬空态 | `assets-spec §1.2` `hint` 行；`accessibility A2`；`ux-spec §5` 教学引导·目标格 | ❌ **FAIL** | **BD-11** | 运行时格子状态去重 `[locked, empty]`（`CellState` 定义域 `empty｜filled｜locked`）；`BeadsGame` 上 hint 相关公开成员命中 **（无）**；渲染指令中使用 `accent_blue(#3D7BF5)` 的图元数 **0** ⇒ `hint` 态在**数据模型、游戏 API、渲染层三处均无承载体** |

### 4.1 计数

| 结论 | 组数 | 明细 |
|---|---|---|
| ❌ FAIL | **11** | P1 P2 P3 P4 P5 P6 P7 P8 P10 P17 P19 |
| ⚠️ PASS\*（带条件 / 判据冲突 / 弱化通过） | **5** | P9（BD-23 判据冲突）、P11（绕过 InputManager）、P14（仅 Node 路径）、P15（仅公式复算）、P18（BD-24 判据不可构造） |
| ✅ PASS（无条件） | **2** | P12、P16 |
| ⛔ 不可测 | **1** | P13（harness 污染） |

### 4.2 本轮**未执行**的 G4 判据（禁止标绿，逐条写原因 + 解除条件）

| 判据 | 道次 | 原因 | 解除条件 |
|---|---|---|---|
| `TC-INP-09` 多点触控（双指同帧仅第一触点） | `[Device]` | 微信开发者工具未装、无 AppID | 装工具 + 申请 AppID + 真机 |
| `TC-A11Y-02` `btn_expand` 热区 132×88 | `[Device]` | 同上；**且按钮本体不存在**（BD-15）⇒ 双重阻塞 | 先落码扩展入口，再上真机 |
| `TC-A11Y-01` 减弱动效关停清单 | `[DevTools]` | `reduceMotion` 在 src/tests/framework **0 命中**（BD-09d） | 先裁 D1/E2 三文档冲突（§6.3）+ 落码 |
| `TC-GRID-10` / `TC-A11Y-03` 灰度·三重编码 | `[Device]` | 无真机；且 `empty` 目标色通道缺失（BD-01）⇒ 6 状态只有 3 态有非颜色通道 | 真机 + BD-01/BD-11 落地 |
| `TC-TIMER-10` 告急脉冲频率 1000ms±50ms | `[DevTools]` | **双主体缺失**（脉冲与满槽告警均未实现，BD-10） | T-086 落地后按 §5 帧检 |
| `TC-SPRINT-09` 特效三档 + 红线帧检 | `[DevTools]` | Lv2 伪震屏已登记为平台缺口（WXG-T-074：渲染管线无全局变换通道） | 渲染管线补全局变换通道 |
| A05-03/09/13/15/16/22/26 音频时长·听感 | `[B]`+`[P]` | **三平台 `NullAudioBackend`**（BD-05b）。【v1.2 注：后端前提已变，本组部分转 ⛔[B]/[P]、部分转 [N] 可验，见 §19.3】 | 落 Web Audio / `InnerAudioContext` 后端 |
| A05-25 音频包体 = 0 KB | `[C]` | Cocos 构建被阻塞（BD-20） | `pnpm run framework:sync` + 重跑 `build:cocos:web`。**【v1.2 注：仍未跑构建，且发现 sync:check 反绿 ⇒ 本条继续 ⛔，见 §19.4】** |
| A05-27 真机音频行为 | `[R]` | 无真机 + 无后端 | 双重解除 |
| `SC-11` 杀进程续进 / `SC-13` onHide 冻结 | `[Device]` | 无真机 | 同上 |
| `timer-gameover §8-11/12` 续时同局续打 / 次数上限 | `[Node]` | **可执行但本轮未排**（属 test-cases v1.2 未映射的 22 条之一，BD-21）；且 `MockRewardedAdProvider('complete')` 使「未看完」分支须靠替身注入 | 复验轮补入 §H；真机行为不作证据 |
| `pause-settings §8-1..10`（10 条） | `[Node]` | **未映射到任何用例**（BD-21）；其中 §8-4 已由 `pause-settings.test.ts` 覆盖、§8-5 齿轮热区几何可 Node 断言 | v1.3 补 §H 映射 + 复验轮执行 |
| `save-progress §8-1..6/8/10`（8 条） | `[Node]` | 同上（BD-21）；§8-7/§8-9 本轮已补测（P17/P18） | v1.3 补 §H 映射 + 复验轮执行 |

---

## 5. 缺陷登记（BD-nn）

> 分级依据：`production/qa/beads/bug-severity.md`（P0 主链路不可用/崩溃/进度损坏/关键事件漏发/玩法真源破坏；P1 核心规则违反但可绕过/冻结与裁决语义错误/**可访问性承诺未兑现**；P2 次要功能错误/统计口径偏差/反馈噪声；P3 文案·动效毫秒偏差·轻微排版；P4 非承诺范围）。
> **定级争议显式登记**：凡本表定级与 `bug-severity.md` 既有细则字面不完全对应者，均在「定级依据」列写明上调理由，交主理人确认（并建议把「零反馈」补进细则，见 BD-14 处置）。

### 5.1 与 14 项缺口一一对应（BD-01..BD-14）

| 编号 | GAP | 标题 | 级别 | 定级依据 | 复现 / 证据 | 期望 vs 实际 |
|---|---|---|---|---|---|---|
| **BD-01** | GAP-01 | 空槽无目标色：拼图核心信息通道（哪格填什么色）完全缺失 | **P0** | `bug-severity`「主链路不可用」——填色玩法的**唯一目标信息**在画面上不存在，玩家只能穷举试错；叠加 `accessibility A2/A2b/A3` 承诺未兑现（本应 P1，被 P0 吸收） | `node production/qa/beads/g4-probe.mjs` → P1；`bead-render.ts:159` 签名无 `colorIdx`；`EMPTY_TINT_MIX`/`EMPTY_GHOST_ALPHA` src 命中 0 | 期望：`assets-spec §1.2` E1 色底（`mixWith(slot_fill, beadColor(colorIdx), EMPTY_TINT_MIX)`）+ E3 内上阴影 + E4 幽灵符号（`EMPTY_GHOST_ALPHA`）；实际：22 个空槽**同一色 `#EDE7DA`** |
| **BD-02** | GAP-02 | 开局托盘全空 ≥ 一个供料间隔（L1 实测 6.02s） | **P0** | 「主链路不可用」——`ux-spec §6.1` 承诺「1.5s（PLAYING 第 1 帧）首颗珠已在托盘」，实际 1.5s/3.0s 持有 0 颗 ⇒ 首屏 6s 内**零可操作对象**，微信首屏留存窗口直接失守 | P2；`systems/spawner.ts:36` `_acc = 0` | 期望：U7 裁定 `reset()` → 赋 `interval` → **置 `_acc = interval`**，第 1 帧供料段完成首供，且**首珠必须可落子色**；实际：首颗珠第 361 帧（6.02s） |
| **BD-03** | GAP-03 | 0 文字教学引导三通道全缺（裁定 (a) 无实现载体） | **P0** | 「主链路不可用」+ `playtest-plan` 第 1 轮 FAIL 线（「3 秒看懂」<80% 即 FAIL）；`ux-spec §1-3` 已裁定取 (a) 纯动效引导，而 ①②③ 三载体分别由 BD-01 / BD-11 / BD-10 承担 ⇒ **引导路径整体不成立**（ux-spec §1-3 已自认「GAP-04 未落地前 §6 引导路径不成立」） | P3；`tutorial｜bubble｜onboard` src 命中 0 | 期望：① 空槽目标色底+幽灵符号 ② 单一 `hint` 目标格（行主序最前 1 格）③ 首珠槽 600ms `accent_blue` 脉冲，首次 `bead:placed` 即清、`runs>0` 永不重现；实际：三者皆无，开局 8s 全部文本仅 14 条 HUD/道具标签 |
| **BD-04** | GAP-04 | 四类 VFX 全缺（落座回弹 / 拒绝抖动 / 消除溶解 / 完成波浪） | **P0**（**定级上调，须主理人确认**） | `bug-severity` 字面把「动效毫秒级偏差」列 P3、「反馈噪声」列 P2——但本项不是毫秒偏差而是**整类反馈不存在**：落子/拒绝是玩法的**唯一即时确认通道**，缺失 ⇒ 玩家无法判断操作是否生效，等价「主链路不可用」。**建议把「关键反馈零通道」补进 P0 细则**（BD-14 处置项） | P4；`entities/grid.ts:12` `CellState` 无 `wrong`/`hint` | 期望：`ux-spec §5` 四行（`vfx_fill_pop` 120ms / ±3px 抖动×2 + danger 闪 2 次 200ms / `vfx_clear_dissolve` 200ms / `vfx_complete_wave` 逐列 20ms·800ms）；实际：落子后 12 帧指令数恒定 76、拒绝后增量恒定 8 |
| **BD-05** | GAP-05 | 玩法事件层音效为零（19 个 clip 只有 3 个存在、9 处调用全在 UI/星） | **P1** | `bug-severity`「可访问性承诺未兑现」= P1；音频非通关必需（`audio-events A05-23` 静音可玩判据）⇒ 不上 P0。但 `ux-spec §5` 红线「关键反馈视觉+音效**双通道**」+ BD-04 视觉通道同缺 ⇒ **双通道同时为零**，与 BD-04 合并后体感为 P0（此叠加效应记入 BD-04 定级理由） | P5；`tuning.ts` 仅 `AUDIO_CLIP_BGM`/`AUDIO_CLIP_UI_TAP`/`AUDIO_CLIP_STAR` | 期望：`audio-events §1` 19 个 id 全覆盖 + A05-01/04/05/07/11/14/16 同帧派发；实际：去重仅 `bgm_main`+`sfx_ui_tap` |
| **BD-05b** | GAP-05 | **框架级**：三平台 audio backend 均为 `NullAudioBackend` | **P1** | 同 BD-05；但影响面为**全矩阵**（breakout 亦无声），且使所有 `[B]/[P]/[R]` 音频判据**不因真机到位而解除** | `packages/framework/src/platform/node.ts:57`、`web.ts:60`、`weapp.ts:139` | 期望：`weapp.ts` 注释自认「InnerAudioContext pooling is implemented with the first audio-bearing game」⇒ beads 即该游戏；实际：仍为 null |
| **BD-06** | GAP-06 | 尾部软锁死：满槽 + 死珠后零非「整关重置」出口 | **P0** | 「主链路不可用」——玩家操作空间归零且**无任何可点出口**，只能等归零判负；`ux-spec §4` 尾注已把「玩家不会卡死」认定为**假承诺**并明示「这是判负，不是兜底」 | P6 结局推演（灌满+道具用尽 → 60s 仍满槽 → 归零 `game-over`） | 期望：≥1 条非整关重置出口（U8 方案 A′/B/C/D **待用户拍板**）；实际：0 条。**注：续时不能解此局**（`REVIVE_BONUS_SEC` 只加时间不清托盘，`MockRewardedAdProvider('complete')` 会让验证误读为已修复） |
| **BD-07** | GAP-07 | harness DPR/视口换算错位 ⇒ 浏览器点击全打飞 | **P0**（工具链） | 「主链路不可用」限 harness 取证环境；影响：**全部 `[Harness]` 用例结论不可信**（P13），并使 T-085/086 的可视验收无法在浏览器完成 | `screenToDesign(297.0, 904.0) → (297.0, 430.0)`（y 轴折叠） | 期望：设计坐标 ↔ 屏幕坐标双向往返一致（`pixelRatio=2` 下 y 不应被折叠）；实际：y 904→430。**归属 T-087** |
| **BD-08** | GAP-08 | harness 文字镜像 | **P1** | 「可访问性承诺未兑现」（`accessibility E1` 文字可读性）限 harness；使一切含文字的截图取证不可用 | 环境事实④（本轮未独立复现——文字镜像在 canvas2d 渲染层，Node 侧 `DrawCommand` 无镜像语义） | 期望：`fillText` 正向；实际：镜像。**归属 T-087**；**本轮标「未独立复现，采信环境事实」** |
| **BD-09** | GAP-09 | `accessibility.md` 假绿：5 项「✅/🔶 落地」与实现不符 | **P1** | `bug-severity`「可访问性承诺未兑现」= P1；且属**跨游戏第 4 轮**重复（§6.2 谱系）⇒ 流程性缺陷，另计 BD-14 | 详见 §6 逐条复核表 | 期望：`落地状态` 列 = 代码已实现；实际：D1/E2/A2/A2b/C1 五项**规格已写、代码零命中** |
| **BD-10** | GAP-10 | 告急脉冲与满槽告警未落地（告急唯一通道是颜色） | **P1** | 「可访问性承诺未兑现」——`accessibility B3` 要求「变红**同时**数字脉冲+图标脉冲，色盲下靠脉冲可辨」，实际色盲下**完全不可辨**；`timer-gameover §8-10` 因此实质不可测 | P7：urgent 后 60 帧 HUD 非文本指令签名去重 **1 种**；`view-model.ts:374-375` | 期望：danger + 1000ms α 脉冲循环；托盘描边呼吸 500ms 循环 + 轻提示音 1 次（`ux-spec §5`）；实际：仅色切换、零告警图元 |
| **BD-11** | GAP-11 | `hint` 悬空态：规格有、数据模型/API/渲染层三处均无承载体 | **P2** | 「次要功能错误」——`hint` 是引导与「无选中轻提示」的共用载体，缺失连带 BD-03/BD-16 无法落地；单看本体不阻断主链路 ⇒ P2（**但若 T-086 以 hint 为引导主载体，则随 BD-03 升 P0**） | P19：`CellState` 无 `hint`；`accent_blue` 图元 0；`BeadsGame` 无 hint 成员 | 期望：`assets-spec §1.2` `hint` 行（`accent_blue` 2px + 600ms α0.5↔1.0 呼吸）+ D1 保留清单「hint 静态描边」；实际：不可表达 |
| **BD-12** | GAP-12 | 元游戏钩子零落地（`meta.winStreak*` / `lastPlayDate` / `signin` 无字段位） | **P2** | 「次要功能错误」——不影响单局可玩性；但 `save-progress §2.3` 已 ❄️**冻结** v1.1 字段 ⇒ 属「冻结语义未落地」，若按该条细则可上 P1，**本轮定 P2 并登记争议**（元游戏在 MVP 验收线 `concept §7` 之外） | P17 写档实测无 `meta` 段；src 命中 0 | 期望：§8-7 连胜 3 → `Current=3/Best=3`、第 4 关失败 → `Current=0/Best` 仍 3；实际：无载体 |
| **BD-13** | GAP-13 | harness 取证工具链不足：只暴露 L1–L5、`preview:frames` 不支持 beads | **P1** | 使 L6 锁定格 / L7·L8 8 色满配 / 冲刺连击的 `[Harness]` 用例**结构性不可达**；`preview:frames` 硬编码 breakout API ⇒ beads 无帧预览 | P14（Node 侧 `goToLevel` 可用，harness 侧不可用）；`tools/scripts/render-harness-frame.mjs` | 期望：harness 暴露跳关键位 + `preview:frames` 支持 beads；实际：仅 L1–L5、脚本只跑 breakout |
| **BD-14** | GAP-14 | **流程**：QA 判据 100% 为逻辑可断言型（零可感知判据）+ beads G4 从未执行 | **P0**（流程） | 「玩法真源被破坏」的流程等价物——门禁**结构上无法捕获**表现层缺陷，是 BD-01/03/04/05/10 得以在「184 测试绿」下存活的根因 | `test-cases.md` v1.2：61 条判据图例仅 `[Node]/[Harness]/[DevTools]/[Device]`、全标「待实现」、**无一条画面/音效/手感判据**；`production/qa/` 下无 beads G4 报告 | 期望：G4 覆盖 §8 全部 93 条 + 可感知层；实际：映射 71 条、可感知 0 条、G4 执行 0 次。**处置见 §7 + `test-cases.md` v1.3 §G** |

### 5.2 本轮独立发现（BD-15..BD-26）

| 编号 | 标题 | 级别 | 依据 / 证据 | 处置 |
|---|---|---|---|---|
| **BD-15** | `input-control §8-1` 五类路由缺第 3 类：扩展入口在 UI 层**不存在**（`btn_expand`/`_hitExpand` src 命中 0），`expandTray()` 仅测试/调试可达 | **P1** | 「核心规则违反但可绕过」——`§8-5` 扩展容量语义正确（P12 ✓）但玩家不可达；连带 `accessibility C1`「`btn_expand` 热区 132×88 修正」成为**无对象修正**（BD-09e） | 派工程侧（T-085/086）；`§8-1` 判据在入口落地前记 ⛔ 而非 FAIL 的诱惑须抵制——本轮按 FAIL 记 |
| **BD-16** | `input-control §8-7`「有轻提示」零实现：无选中点网格静默返回、零反馈帧 | **P2** | 「反馈噪声」的反面（零反馈）；`beads-game.ts:1327` 注释自认 `no request at all` | 与 BD-11 同批修（hint / failHint 通道） |
| **BD-17** | **流程**：`verify` 用 `&&` 串联 13 项 ⇒ 第 8 项失败后 9–13 项**从未执行**，而失败信息只指向 sync，不提示「后续门未跑」 | **P1** | `package.json` `verify` 脚本；`evidence/g1-g3-verify.log` 在第 8 项即 `EXIT=1` | 建议改 `pnpm run verify:all`（逐项收集 + 汇总退出码）或在 verify 尾打印「未执行项清单」；交主理人 / T-082 |
| **BD-18** | **假绿风险**：`check:size` 只测 `games/breakout/cocos/build/wechatgame`，beads 产物不存在 ⇒ 整体报「✅ 包体校验 OK」 | **P1** | `evidence/g1-g3-item9-13.log`：`产物：games/breakout/cocos/build/wechatgame` 单条 | 建议 `check-bundle-size.mjs` 遍历 `games/*` 并对缺失产物**显式报 SKIP/FAIL**，不静默通过 |
| **BD-19** | `preview:frames` 硬编码 breakout API（`movePaddleTo`/`bricksDestroyed`）⇒ beads 无帧预览；且不识别 `--help`、直接执行并覆写 `dev/harness/preview/level-{1..5}.svg` | **P2** | 实跑观察（副作用为可再生产物，无源码损失） | 归 BD-13 一并处置 |
| **BD-20** | `framework:sync` 拷贝件漂移 **4 处已提交在 HEAD**（beads/breakout 各 `bindings.ts`+`cocos-renderer.ts`）⇒ **G1 FAIL + Cocos 取证全链路阻塞** | **P0**（阻塞） | `evidence/g1-g3-verify.log`、`evidence/g3-build-cocos-web-beads.log` | **解除条件**：`pnpm run framework:sync`（写 4 个受版本控制文件）——本 agent readonly 不代行，移交主理人 / T-082 |
| **BD-21** | **QA 自身产出缺陷（诚实自登记）**：`test-cases.md` v1.2 ① 判据映射缺口——9 份 GDD §8 实为 **93** 条，v1.2 只映射 **71** 条，**22 条零映射**（`pause-settings §8` 10 条 + `save-progress §8` 10 条 + `timer-gameover §8-11/12` 2 条）；② 合计表只统计 §A+§B+§C=73 用例，**漏计 §D(10)+§E(4)+§F(8)**，实际 95 条；③ §F 标题写「7 条」而表内 8 行（F1–F8）；④ 头部「合计 61 条」已过期 | **P1** | `awk '/^## 8\./,0' \| grep -cE '^[0-9]+\.'` 逐文件 = 12/11/10/10/10/10/10/10/10 = **93** | v1.3 已修 ①②③④（新增 §G 可感知判据 + §H 未映射判据补编 + 合计表重算 + 变更说明） |
| **BD-22** | **判据口径缺陷**：`tray-spawner §8-2`「任一槽频次与均匀分布偏差 ≤±20%」在 n=200 / 12 槽下单槽 σ≈11%、12 槽族极大偏差期望本身 ≈20–32% ⇒ **约半数概率误报**（本轮实测最大偏差 32.0% 但卡方 11.20 远低于临界 24.725） | **P2** | P12 双口径并给；同款判例：`powerups §8-4` 已由 WXG-T-062 从「±20%」改为**卡方检验** | **移交策划**：建议 §8-2 同步改卡方（df=11、α=0.01、临界 24.725）。QA 不自裁 |
| **BD-23** | **判据互斥**：`input-control §8-2`「偏移 ≤ 外扩边界内必命中该格」与 §8-4「重叠时最近格心命中」在 `BEAD_PITCH(52) < GRID_HIT_SIZE(66)`（13 列满密度必然成立）时**不可同时满足**（偏移 27–33px 两读） | **P2** | P9 分段实测 | **移交策划**：建议 §8-2 补「重叠区以 §8-4 为准」。QA 不自裁 |
| **BD-24** | **判据不可构造**：`save-progress §8-9`「注入 200 次落子」在冻结常量下不可能——`GRID_MAX_COLS(13) × GRID_MAX_ROWS(12) = 156 < 200`，且填满全盘必然触发 `level:cleared` → 结算写档 | **P2** | P18（本轮按最大可构造量 150 次验其实质，PLAYING 零写档 ✓ / 结算帧恰 1 次 ✓） | **移交策划**：建议把 200 改为「≤ `GRID_MAX_COLS×GRID_MAX_ROWS` 的最大可构造量」 |
| **BD-25** | **前瞻性假绿风险**（`ux-spec §6.2` 已登记、QA 复核确认）：BD-02 修复（首供落地）后，`tray-spawner §8-1`「60s 内 `tray:spawned` 恰 15 次」与 `core-loop §8-2`「60 秒误差 ≤±1 颗」语义变为 **1 首供 + 15 周期 = 16 颗**，而旧容差 ±1 的区间 `[14,16]` **恰好吞掉**该变更 ⇒ 判据不改则修复后自动假绿 | **P1** | `ux-spec §6.2`「判据影响（登记，交 QA）」 | **本 QA 承接**：`test-cases.md` v1.3 已把 TC-LOOP-02 / TC-TRAY-01 的期望显式改为 **16（±0）**，并加注「首供语义 U7」；`tray-spawner §8-3`（3:1 抽色）受影响恰 1/100 样本，已注明可忽略 |
| **BD-26** | `accessibility C2` 文档数值陈旧：写「道具卡间距 ≥32px（176×3 + 32×2 = 592 ≤ 750）」，实现为 `POWERUP_CARD_GAP = 60`（`totalW = 648`）⇒ 约束仍满足但文档数字与实现不符 | **P3** | `src/config/tuning.ts:52`、`powerupCardRects()` | 移交美术侧回写（`art/**` 本 QA 不碰） |

---

## 6. GAP-09 假绿复核报告

### 6.1 逐条核对：`art/accessibility.md` 落地状态列 vs `src/**` 实现

| # | 特性 | 文档标注 | 代码核对结果 | 判定 |
|---|---|---|---|---|
| A1 | 珠子颜色三重编码（10 符号 + 明度 5 档） | ✅ 落地 | `view/symbols.ts` + `view/bead-render.ts` L152 `emitSymbol(...)` 存在；`tests/symbols.test.ts`、`tests/bead-render.test.ts` 断言 10 色↔10 符号一一映射、线宽 ≥2px | ✅ **真实**（T-052 已补，本轮复核确认） |
| **A2** | 珠子状态：`locked` X 斜纹 / `empty` **目标色底+幽灵符号** / `hint` **蓝描边呼吸** / `wrong` **抖动+红描边** / `selected` 上浮+圆点——「每个状态都有非颜色通道」 | ✅ 落地（WXG-T-080 扩展 empty 通道） | `locked` ✓（`drawLockedBead` 两条对角线）、`selected` ✓；**`empty` 目标色底/幽灵符号 ✗**（BD-01，P1 实测 22 槽同色）、**`hint` ✗**（BD-11，`CellState` 无该态、`accent_blue` 图元 0）、**`wrong` ✗**（BD-04，`CellState` 无该态、拒绝后 12 帧指令恒定） | ❌ **假绿**（5 态中 3 态无承载体；「每个状态都有非颜色通道」不成立） |
| **A2b** | 空槽目标色识别 Basic+Standard | ✅ **Basic+Standard 落地**（随 T-085 实现） | 同 A2 的 `empty` 项：`EMPTY_TINT_MIX`/`EMPTY_GHOST_ALPHA` src 命中 **0**、`drawEmptySocket` 签名无 `colorIdx` | ❌ **假绿（自相矛盾型）**：状态列写「✅ 落地」，括注却写「随 T-085 实现」⇒ **未落地的项被标为已落地**。Basic 层（幽灵符号）与 Standard 层（色底）均零实现 |
| A3 | 灰度可辨：10 色 + **6 状态** 100% 可区分 | ✅ 落地 | 10 色部分 ✓（A1 真实）；**6 状态部分 ✗**——`hint`/`wrong`/`empty` 目标色三态无非颜色通道 | ⚠️ **部分假绿**（颜色维度真、状态维度假） |
| A4 | 道具图标以形状为唯一识别 + 28px 文字标签并列 | ✅ 落地（WXG-T-062 补齐；文档自记「此前标 ✅ 属假绿」） | `view-model.ts:810` `drawPowerupGlyph(builder, i, ...)` ✓；`:837` `POWERUP_LABELS[type]` 28px（`FONT.sub`）✓；P3 实测渲染文本含「区域消除 / 槽位清空 / 随机消除」 | ✅ **真实**（第 3 轮假绿已闭环，本轮复核确认） |
| B1 | 文字对比度 ≥4.5:1 | ✅ 落地 | `palette.text = #2A2E43` on `#FFFFFF`；对比度为**静态色值属性**，代码使用一致 | ✅ 真实（不需运行时验证） |
| B2 | 符号对珠面 ≥3:1 | ✅ 落地 | `tests/symbols.test.ts` 断言 10 色符号墨对比度全 ≥3:1（含草绿翻转移外，文档 §2 尾注偏差 1 已钉住） | ✅ 真实 |
| B3 | 倒计时不仅靠颜色：变红**同时**数字脉冲+图标脉冲 | ⚠️ **部分落地（仅色变，脉冲未实现）**，移交 T-086 | `view-model.ts:374-375` 仅色切换；P7 实测 60 帧签名 1 种 | ✅ **诚实标注**（全表**唯一**一条把未实现写进状态列的项——本轮实测与其标注完全一致，可作为其余各项的改写范本） |
| **C1** | 触控目标 ≥88×88；「`btn_expand` 132×48 → 须扩热区至 132×88」 | 🔶 落地（含 1 处修正） | 齿轮 `GEAR_HIT_SIZE` ✓、道具卡 176×116 ✓；**`btn_expand` src 命中 0**（BD-15）⇒ **按钮本体不存在**，「热区修正」无对象 | ❌ **假绿**（比文档描述更严重：不是热区没扩，是元素没有） |
| C2 | 元素间距 ≥96px、道具卡间距 ≥32px | ✅ 落地 | 卡 pitch = 176+60 = 236 ≥ 96 ✓；`POWERUP_CARD_GAP=60` ≥32 ✓（但文档写 32、实现 60 ⇒ BD-26 数值陈旧） | ✅ 真实（附文档数值陈旧） |
| **D1** | 动效可减弱：设置提供「减弱动效」开关 + 关停 5 项 / 保留 3 项清单 | ✅ **落地** | `reduceMotion｜reduce_motion｜motionSafe｜prefersReduced` 在 `games/beads/src`、`games/beads/tests`、`packages/framework/src` **合计命中 0**；`BeadsSettings` 只有 `bgmMuted`/`sfxMuted`（`save-schema.ts:27-47`）⇒ **无字段位、无开关、无关停逻辑** | ❌ **假绿**（与 breakout D-01 **完全同款**） |
| D2 | 闪烁安全 <3Hz；`wrong` 描边闪 ≤2 次/秒；禁全屏白闪 | ✅ 落地 | 无 >3Hz 闪烁 ✓、无全屏白闪 ✓；但 **`wrong` 描边闪的对象不存在**（BD-04）⇒ 该子条为**空真**（vacuous truth） | ⚠️ **空真通过**（不算假绿但须标注「无对象可验」；BD-04 修复后必须重验） |
| E1 | 最小 28 设计 px、正文 32、倒计时 44 | ✅ 落地 | `view-model.ts:80` `FONT` 常量表存在，`FONT.sub` 用于 28px 标签（P3 实测标签文本渲染） | ✅ 真实（字号维度）；**注**：真机 pt 换算与系统字体缩放属 `[Device]`，本轮 ⛔ |
| **E2** | 文本缩放开关（正文 32→40px） | 🔶 **部分（基础版落地**，全界面自适应延后） | `largeText｜fontScale｜bigFont` src/tests/framework **命中 0**；`§5` 记录用户已拍板「✅ 基础版即可」⇒ **连基础版也无实现** | ❌ **假绿**（「基础版落地」不成立；与 D1 同一根因：无 settings 字段位） |
| F1 | 无时间压力 / 可暂停（暂停冻结倒计时补偿） | ✅ 落地（以暂停冻结补偿） | `tests/timer.test.ts:103-105`：`advance(120)` while paused → `timer:tick` 计数 **30**（暂停前）保持不变、注释「zero ticks while paused」；P11 §8-8 门禁 ✓ | ✅ **真实** |
| F2 | 输入精度：命中区外扩 8px | ✅ 落地 | `GRID_HIT_SIZE = BEAD_CELL(50) + 8×2 = 66`；P9 实测偏移 0/12/25 命中本格、网格外零事件 | ✅ 真实（Node 层）；⚠️ harness/真机链路被 BD-07 污染 ⇒ `[Harness]/[Device]` 维度 ⛔ |
| G1 | 字幕/语音替代 | N/A | demo 无语音内容 | — |
| G2 | 屏幕阅读器 | ⏸ 延后（平台限制） | 与 breakout 同口径 | ✅ 诚实标注 |
| H1 | 符号显示开关 | ⏸ 延后（`§5` 用户拍板 ❌ 不提供） | 无实现，与标注一致 | ✅ 诚实标注 |

### 6.2 「文档标 ✅ / 🔶 但代码零命中」全清单（本轮结论）

**5 项假绿 + 2 项须重标注**：

| 项 | 类型 | 关键零命中证据 |
|---|---|---|
| **D1** 减弱动效 | 假绿（✅ 落地） | `reduceMotion` 等 4 个关键词在 beads src + beads tests + framework src **合计 0**；`BeadsSettings` 无字段位 |
| **E2** 文本缩放 | 假绿（🔶 基础版落地） | `largeText`/`fontScale`/`bigFont` **0**；`BeadsSettings` 无字段位 |
| **A2** 状态非颜色通道 | 假绿（✅ 落地） | `empty` 目标色（`EMPTY_TINT_MIX`/`EMPTY_GHOST_ALPHA` = 0）、`hint`（`CellState` 无该态）、`wrong`（同） |
| **A2b** 空槽目标色识别 | 假绿（✅ 落地 vs 括注「随 T-085 实现」自相矛盾） | 同 A2 的 empty 项；`drawEmptySocket` 签名无 `colorIdx` |
| **C1** `btn_expand` 热区修正 | 假绿（🔶 落地含 1 处修正） | `btn_expand`/`_hitExpand` src **0** ⇒ 元素本体不存在 |
| A3 灰度 6 状态 | **部分假绿**（须拆分标注） | 10 色真实、6 状态中 3 态无通道 |
| D2 `wrong` 闪 ≤2 次/秒 | **空真**（须改标「⛔ 无对象可验」） | `wrong` 态不存在 |

### 6.3 与 breakout 缺陷 D-01 的同款性比对

| 维度 | breakout D-01（`production/qa/g4-regression-report.md:28/41`） | beads BD-09（本轮） | 同款？ |
|---|---|---|---|
| 特性 | 「减弱动效」开关 | 「减弱动效」开关（D1）+「大字号」开关（E2） | ✅ **同一特性** |
| 报告原文 | 「TC-A11Y-01 ⛔ 不可测 → **`reduceMotion` 不存在于实现**（src 零命中）→ 缺陷 D-01」 | 「D1 ✅ 落地 → `reduceMotion` 在 src/tests/framework 零命中」 | ✅ **逐字同款** |
| 根因 | `save-progress` 的 `settings.reduceMotion` 字段未实现 | `BeadsSave.settings` 只有 `bgmMuted`/`sfxMuted`，无 `reduceMotion`/`largeText` 字段位 | ✅ **同一根因（存档 schema 无字段位）** |
| 文档层 | `assets-spec §6.1/§6.2` 9+7 项清单存在、实现为零 | `accessibility D1` 关停 5 项 / 保留 3 项清单存在、实现为零 | ✅ 同款 |
| 该轮裁定 | **G4 = CONCERNS**（11 PASS / 2 不可测） | 本轮 **G4 = FAIL**（主体缺失，非单点） | ⚠️ 严重度已升级 |
| 处置 | 「派工程侧：settings 增加 `reduceMotion` + view 层按清单关停」 | 见 §6.4 —— **须先裁三文档冲突，否则工程侧无权威清单可落** | ⚠️ 阻塞点前移到设计层 |

**三文档冲突（列出、移交 T-081 / 主理人裁定，本 QA 不自裁）**：

| 文档 | 对 D1/E2 的表述 |
|---|---|
| `art/accessibility.md` D1 / §4.1 / §5.2 | 设置页**应含**「减弱动效」开关（标 ✅ 已落地）；「大字号」开关用户已拍板「基础版即可」（标 🔶 基础版落地） |
| `design/gdd/pause-settings.md` **§2.2（冻结范围）** | 暂停面板元素清单**只有** 6 行：继续 / 重玩本关 / 音乐开关 / 音效开关 / 去冲刺 / （冲刺）重新冲刺 —— **无「减弱动效」、无「大字号」**；§2.3 声明「冻结语义（复用 ADR-0007 单点裁决）」 |
| `design/ux/ux-spec.md` **§3.3** | 线框图只有 继续(240×88 主钮) / 重玩本关 / 🎵音乐[开] / 🔊音效[开] —— **同样无 D1/E2 开关** |
| `games/beads/src/**` | 严格照 S9 GDD **冻结清单**落码 ⇒ `BeadsSettings` 只有两个开关 |

⇒ **冲突本质**：实现没有错——它忠实执行了 S9 GDD 的冻结面板清单；错在 `accessibility.md` **单方面**把「设置页应有 D1/E2 开关」写成已落地 ✅，而该要求**从未进入 S9 的冻结范围**，也从未进入 ux-spec 线框。这是「跨文档承诺未做单点裁决」的结构性漏洞（ADR-0007 单点裁决原则未覆盖 accessibility ↔ GDD 的交叉承诺）。

**裁定选项（供主理人 / T-081 择一，QA 不选）**：
- **(甲)** 把 D1/E2 开关补进 `pause-settings §2.2` 冻结清单 + `ux-spec §3.3` 线框 + `BeadsSettings` 字段 + S8 `version` 升位 ⇒ 需落码（工程量：settings 2 字段 + 面板 2 行 + view 层按 D1 关停清单 5 项 / 保留 3 项 + E2 字号切换），并同步修 `accessibility` 状态列；
- **(乙)** 把 `accessibility` D1/E2 降级为「⏸ 延后（S9 冻结面板范围未含）」并重算承诺等级（Standard 是否仍成立须重新论证：D1 是 Standard 的常见必备项）；
- **(丙)** 折中：D1 进冻结范围（可访问性硬承诺），E2 延后（用户已拍「基础版即可」但无载体，可挪到 v1.1）。

### 6.4 「为何第四次重犯」的流程性归因

**谱系（本轮独立核对，比任务单口径「第三次」多一轮——诚实登记）**：

| 轮次 | 游戏 / 特性 | 何时被谁发现 | 是否进门禁 |
|---|---|---|---|
| 1 | breakout `reduceMotion`（D-01） | G4 回归轮由 QA 发现（`production/qa/g4-regression-report.md`） | ❌ 未沉淀为守卫 |
| 2 | beads A1/A3/B2（`symbols.ts`/`bead-render.ts` **文件不存在**却标 ✅） | WXG-T-052 自查，登记在 `accessibility.md §2` 尾注 | ❌ 仅文档尾注 |
| 3 | beads A4（道具卡空白却标 ✅） | WXG-T-060/062 补，`accessibility.md:33` 明文自记「此前标 ✅ 属**假绿**」 | ❌ 仅文档自记 |
| **4** | beads **A2 / A2b / C1 / D1 / E2**（+A3 部分、D2 空真） | **本轮 WXG-T-084** | 见下方防再犯建议 |

> 任务单口径「跨游戏第三次」应是把第 2、3 轮（同为 beads、同一次 T-052/T-062 自查）合并计数。本 QA 按**独立事件**计为第 4 轮，并说明差异，不擅改主理人口径。

**四条流程性根因**：

1. **`落地状态` 列语义混淆「规格已写」与「代码已实现」**——A2 标「✅ 落地（WXG-T-080 扩展 empty 通道）」，而 T-080 是**美术规格**任务（`art-bible.md v1.2` + `assets-spec §1.2` 修订），代码由 **T-085** 承担；A2b 更是同一格里既写「✅ 落地」又写「随 T-085 实现」。**规格落地被记为实现落地**是四次假绿的共同机制。
2. **无机械化守卫**：`check:arch` 有 5 条铁律守卫、`check:secrets`/`check:links`/`check:mcp`/`levels:check` 都有脚本，但**没有任何脚本核对「文档声明的特性 ↔ 代码符号存在性」**。第 1 轮 D-01 之后完全可以加一条「accessibility ✅ 项必须有对应 src 符号命中」的守卫，四轮都没加。
3. **门禁只看 `[Node]` 逻辑判据**（BD-14）：61 条判据全为事件计数/公式复算型，「开关存在吗」「画面看得出吗」从来不在 G4 的问句里 ⇒ 假绿在门禁前**不可见**，只在人工复盘或 QA 专项复核时暴露。
4. **无「文档 ✅ 需附证据链接」的写法约束**：`accessibility.md` 的 A4 条目示范了正确写法（「WXG-T-060 补形状、WXG-T-062 补标签并裁定几何冲突」= 附转真路径），但 D1/E2/A2 没有；**同文件内既有范本又未强制**，说明缺的是纪律而非知识。

**防再犯建议（交主理人排期）**：

| # | 建议 | 归属 | 成本 |
|---|---|---|---|
| F-1 | **新增 `check:a11y`（或并入 `check:arch`）机械守卫**：解析 `games/*/art/accessibility.md` 特性矩阵，凡状态列含 ✅ / 🔶「落地」者，必须在 `games/*/src/**` 命中该行的**登记符号**（矩阵增设一列「代码符号锚点」，如 D1 → `reduceMotion`、E2 → `fontScale`、A2 → `EMPTY_TINT_MIX`）；零命中即 FAIL。**这是唯一能结构性阻止第 5 轮的措施** | 工程侧（T-082）+ 美术侧补锚点列（T-080/林绘澄） | 中 |
| F-2 | **状态列改为四值枚举**：`规格已定` / `已落码` / `已验收（附证据路径）` / `延后`，**禁用裸 ✅**；「已验收」必须附 `production/qa/**` 证据文件或测试文件名 | 美术 + QA 共同约定，写进 `wxgame-art-spec-programmatic` skill | 低 |
| F-3 | **`knowledge/lessons.md` 沉淀条目**（正文见 §6.5，落盘由主对话决定） | 主对话 | 低 |
| F-4 | QA 侧把「文档 ✅ ↔ 代码符号命中」列为 **G4 固定检查组**（本轮已做，v1.3 §G 已固化 TC-PER-09 可访问性假绿哨兵用例） | 严守真（已落） | 已完成 |
| F-5 | accessibility ↔ GDD 交叉承诺纳入 **ADR-0007 单点裁决**范围：任何跨文档承诺（可访问性/UX/GDD）须指定**唯一权威文件**，其余只引用不重复声明 | 主理人 / 架构侧 | 低 |

### 6.5 拟沉淀 `knowledge/lessons.md` 条目（正文草稿——**按硬约束不落盘，交主对话决定**）

```markdown
### L-xx · 跨游戏重复的 accessibility 假绿（breakout D-01 → beads A2/A2b/C1/D1/E2）

- **现象**：`art/accessibility.md` 特性矩阵的「落地状态」列标 ✅/🔶「落地」，但对应特性在
  `src/**` 零命中。四轮重犯：① breakout `reduceMotion`（D-01，G4=CONCERNS）；② beads
  A1/A3/B2（`symbols.ts`/`bead-render.ts` 文件当时不存在）；③ beads A4（道具卡空白）；
  ④ beads A2/A2b/C1/D1/E2（WXG-T-084，2026-09-14）。
- **机制**：状态列混淆「**规格已写**」与「**代码已实现**」。规格任务（美术/策划）完成后即被
  标 ✅，而实现任务在另一波次；同格甚至同时出现「✅ 落地」与「随 T-085 实现」。
- **为何门禁抓不到**：G4 判据 100% 为 `[Node]` 逻辑可断言型（事件计数/公式复算），
  「开关存在吗 / 画面看得出吗」从来不在问句里（beads GAP-14）。
- **代价**：beads 在「184 测试绿、工程完成度高」的自评下交付，用户实测「完全没有可玩性」；
  可访问性承诺（Standard 等级）实际未兑现。
- **防再犯（按有效性排序）**：
  1. **机械守卫**：新增 `check:a11y`——矩阵每行增设「代码符号锚点」列，状态含「落地」者
     必须在 `games/*/src/**` 命中该锚点，零命中即 FAIL。（唯一能结构性阻止第 5 轮的措施）
  2. **状态列四值枚举**：`规格已定` / `已落码` / `已验收（附证据路径）` / `延后`，禁用裸 ✅。
  3. **单点裁决扩围**：accessibility ↔ GDD ↔ ux-spec 的交叉承诺须指定唯一权威文件
     （D1/E2 冲突即因 accessibility 单方面声明、S9 冻结面板清单从未收录）。
- **判例引用**：`production/qa/g4-regression-report.md`（breakout D-01）、
  `production/qa/beads/g4-regression-report.md` §6（beads 第 4 轮，含 5 项假绿全清单）。
```

---

## 7. 探针自身缺陷自查记录（**诚实登记：13 处**）

> 方法论纪律：**拿自己的 bug 当实现缺陷，与「假绿」同罪**。本轮探针迭代 v1 → v2 → v3，共自查出 **13 处探针自身缺陷**，其中 **v1 的 5 处曾直接产出假 FAIL**（P9/P11/P12/P15/P16）。全部修正后才出本报告结论。修正记录同时写入 `g4-probe.mjs` 文件头（v2 修订 1–9、v3 修订 10–13）。

| # | 版本 | 探针缺陷 | 若未修会造成的误判 | 修正 |
|---|---|---|---|---|
| 1 | v1 | 注入关卡 schema 错（字符串 `id`、缺 `cols`/`rows` 声明字段） | P15/P16 **假 FAIL**（BOOT 全拒） | `probeLevel()` 改数值 id + cols/rows |
| 2 | v1 | P6/P8 在同一实例做 6px 全盘扫描 | 把游戏点进 PAUSED / 点满托盘，污染后续断言（v1 实测 P6 结尾 `phase=paused`） | 每条路由、每次扫描用**独立实例** |
| 3 | v1 | P12 靠 `usePowerup` 清槽取样 | `POWERUP_FREE_USES=1` 三次后耗尽 ⇒ 只采 **16** 样本、算出 maxDev 94% / 卡方 171.38 的**探针假象** | 改白盒 `drain()` → `tray.clearSlots(...)` |
| 4 | v1 | P9 热区只数事件数 | +34/+40/+60px 都「1 事件」（其实命中邻格）⇒ 证明不了边界 | 改断言 payload 的 `row/col` + 网格外零事件 |
| 5 | v1 | P11 换选复用上一步已选中态 | 期望 2 次只出 1 次 ⇒ **假 FAIL** | 独立实例、两槽均未选中 |
| 6 | v1 | P11 洪泛用例未先选中珠 | `bead:placed` 恒 0，什么都没证明 | 先 `tapDesign(slotXY(sl))` 再灌 20 次 |
| 7 | v1 | P7 脉冲签名含 `text` 指令 | mm:ss 每秒变化伪造「2 种签名」⇒ 与自己的判据文字自相矛盾（**假 PASS 风险**） | 签名剔除 text、改 60 帧（完整 1000ms 周期） |
| 8 | v1 | P7 满槽告警用 `giveTrayBead` 灌满 | 不走供料跳过路径 ⇒ `tray:full=0` | 灌满后推进 ≥1 个 `spawnInterval` 让真实供料被跳过 |
| 9 | v1 | P5 音频未点任何 UI | distinct clips 只 1 种，无法区分「UI 有音 / 玩法零音」 | 补 UI 点击对照 |
| 10 | v2 | **P9 断言口径错**：`BEAD_PITCH(52) < GRID_HIT_SIZE(66)` ⇒ 命中区必然重叠，「区内偏移全部命中本格」的期望本身与 §8-4 互斥 | 把**判据冲突**误报成实现缺陷（v2 实测 P9 FAIL） | 改分段断言（≤25 本格 / 27–33 邻格 / >33 邻格），冲突登记为 BD-23 移交策划 |
| 11 | v2 | **P12 样本量不足**：在 L1（`time=300s`、`spawnInterval=6s`）取样 ⇒ 全程最多 50 次供料、实采 **49** | 卡方严重欠功率；v2 报的「最大偏差 120.4% / 卡方 171→11.98」是**小样本假象** | 注入 `spawnInterval=2.0s`+`time=420s` 关卡 ⇒ **200/200** 样本 |
| 12 | v2 | **P17/P18 用错 Storage API**：框架 `Storage` 接口是 `get/set/remove/keys()/clear`，v2 写成 `getItem/setItem/length/key(i)` | P18 直接抛 `TypeError`；P17 读档恒为空 ⇒ **假 FAIL**（会误报「通关不写档」） | 改用正确 API + `mk()` 暴露 `saveKey` |
| 13 | v2 | P18 计数基线未扣除 init 期 `normalizeBeadsSave` 触发的写档；且在 L1（22 可填格）填满全盘 ⇒ 触发 `level:cleared` 写档被误计为「PLAYING 期间写档」 | **假 FAIL**（会误报 S8 §8-9 违规） | 加 `baseline` 扣除 + 改注入 13×12 关卡只填 150 格 + 结算帧走通关路径 |

**结论可信度声明**：本报告 §4 的 11 条 FAIL **全部有代码级铁证**（文件:行号 或 src grep 命中 0）与探针实测**双重支撑**，不依赖单一探针数值；PASS\* 的条件限制均已写进结论列。BD-08（文字镜像）**未独立复现**，采信环境事实④并已标注。

---

## 8. 判据冲突 / 不可构造清单（**移交策划裁定，QA 不自裁**）

| # | 判据 | 问题 | 建议（仅建议，不代裁） | 缺陷 |
|---|---|---|---|---|
| 1 | `input-control §8-2` vs `§8-4` | `BEAD_PITCH < GRID_HIT_SIZE` 时互斥 | §8-2 补「重叠区以 §8-4 为准」 | BD-23 |
| 2 | `tray-spawner §8-2` | ±20% 容差在 n=200/12 槽下约半数概率误报 | 改卡方（同 `powerups §8-4` WXG-T-062 判例） | BD-22 |
| 3 | `save-progress §8-9` | 「200 次落子」> `GRID_MAX_COLS×GRID_MAX_ROWS = 156` | 改「≤ 最大可构造量」 | BD-24 |
| 4 | `tray-spawner §8-1` / `core-loop §8-2` | 首供落地后语义变 16 颗，旧容差 ±1 恰好吞掉变更 | 期望显式改 **16（±0）** | BD-25（v1.3 已按此改写用例） |
| 5 | `accessibility` D1/E2 ↔ `pause-settings §2.2` ↔ `ux-spec §3.3` | 三文档冲突（§6.3） | 甲/乙/丙三选项择一 | BD-09 |
| 6 | `save-progress §8-9`「结算帧」 | 是否含**失败**帧语义不明（实测失败帧零写档，与 §8-2 一致） | 明确「结算帧 = `level:cleared` 帧」 | P18③ |
| 7 | `assets-spec §1.2` `hint` 行末 `[待 ux-spec 对齐]` 占位 | `ux-spec §5` 已接管毫秒与循环频率，占位未删 | 美术侧回写删占位（`ux-spec §5` 已注明经主理人中转） | — |
| 8 | `accessibility C2` 数值 | 文档 32px vs 实现 `POWERUP_CARD_GAP=60` | 回写文档 | BD-26 |

---

## 9. Playtest 计划可执行性评估（Deliverable ⑥）

### 9.1 结论：**现有 `playtest-plan.md` 三轮全部不可执行**（GAP-05 + GAP-07 + GAP-13 未修前）

| 轮次 | 计划要求 | 当前可执行性 | 阻塞项 |
|---|---|---|---|
| **第 1 轮 FTUE** | 真机、4–6 名新玩家、只玩 L1–L2；判定线含「3 秒看懂 ≥80%」「首次落子 ≤15s」「拒绝反馈理解 ≥80%」 | ❌ **不可执行** | ① 无真机/无 AppID（环境事实③）；② 即便有真机：「3 秒看懂」必然 FAIL（BD-01 空槽无目标色 + BD-03 零引导 ⇒ 玩家无从得知目标）；「拒绝反馈理解」必然 FAIL（BD-04 拒绝零反馈）；「首次落子 ≤15s」受 BD-02 拖累（L1 首珠 6.02s）；③ 无声（BD-05/05b） |
| **第 2 轮 心流与难度** | 真机 + 埋点、连打至 L5；判定线含「满槽频次 1–3 次/关」「道具使用率 ≥60%」 | ❌ **不可执行** | ① 同上无真机；② **「道具使用率 ≥60%」结构性不可达**——道具超限只出「即将开放」占位（BD-06），且满槽后无出口 ⇒ 观测到的会是「道具用尽后卡死」而非心流数据；③ 埋点无（`tray:full`/`rejected` 需人工计数）；④ 若走 harness 替代真机 ⇒ BD-07 点击全打飞，玩家根本点不中 |
| **第 3 轮 韧性/可访问性** | 真机（含刘海机、低端机）+ 色觉障碍/动效敏感玩家 | ❌ **不可执行** | 「减弱动效」开关不存在（BD-09/D1）、「告急靠脉冲可辨」不存在（BD-10/B3）、「灰度 6 状态可辨」3 态缺通道（A3）、`btn_expand` 不存在（BD-15）⇒ **8 项观察中 4 项无对象**；「低端机 L6+ 13×12 ≥30fps」需真机 + harness 跳关（BD-13） |

> **与 `audio-spec.md §5` 的一致性核对**：音策已明文「任何 Playtest 报告**不得**对『解压/治愈』下 PASS 结论，只能记 **BLOCKED（音频后端未落地）**」。本 QA **采纳并升级**：本轮不止音频，视觉通道亦缺 ⇒ 应记 **BLOCKED（视觉+音频双通道未落地）**，而非仅音频降级。

### 9.2 「最小可 Playtest 配置」前置清单（交主理人做 sequencing）

**M0 · 硬性前置（缺一不可，否则 Playtest 数据无意义）**

| # | 前置 | 归属 | 依据 |
|---|---|---|---|
| M0-1 | `pnpm run framework:sync` → G1 转绿 → `build:cocos:web` 通过 | T-082 / 主理人 | BD-20（当前阻塞一切 Cocos 取证） |
| M0-2 | BD-01 空槽目标色（E1 色底 + E4 幽灵符号）落码 | T-085 | 无此项则「填什么色」不可知，Playtest 只能观测困惑 |
| M0-3 | BD-02 首供落地（U7 裁定：`_acc = interval` + 首珠强制可落子色） | T-085 | 无此项则首屏 6s 空窗，FTUE 数据全废 |
| M0-4 | BD-04 四类 VFX 至少落**落座 + 拒绝**两类（`ux-spec §5` 120ms / 200ms） | T-086 | 无此项则玩家无法判断操作是否生效 |
| M0-5 | BD-07 harness DPR 坐标修复（若走浏览器 Playtest） | T-087 | 无此项则点不中 |
| M0-6 | BD-06 泄压阀 **U8 用户拍板** + 落码（A′/B/C/D 任一） | 用户 → T-085 | 无此项则第 2 轮观测到的是卡死而非心流 |

**M1 · 强烈建议（缺则须显式降级 Playtest 范围）**

| # | 前置 | 归属 | 缺则降级方式 |
|---|---|---|---|
| M1-1 | BD-03 引导三通道（① 已由 M0-2 覆盖 ② `hint` 单一目标格 ③ 首珠槽脉冲） | T-086 | 「3 秒看懂」判定线改为「观察并记录，不设 PASS 线」 |
| M1-2 | BD-05/05b 音频后端 + 19 个 clip 程序化合成 | 框架侧 + T-085 | 按 `audio-spec §5`：范围降级为「视觉单通道可玩性」，「解压/治愈」记 BLOCKED |
| M1-3 | BD-10 告急脉冲 + 满槽告警 | T-086 | 第 3 轮「告急可辨」项标 ⛔ |
| M1-4 | BD-13 harness 跳关键位 + `preview:frames` 支持 beads | T-082 | L6–L8 相关观察项全部标 ⛔ |
| M1-5 | BD-09 三文档冲突裁定（§6.3 甲/乙/丙）+ 若选甲则落码 | 主理人 / T-081 → T-085 | 第 3 轮「减弱动效」项标 ⛔；`accessibility` 承诺等级须重新论证 |
| M1-6 | 真机 + AppID（微信开发者工具） | 主理人 / 用户 | 全部 `[Device]` 项标 ⛔；只能用 web-mobile 产物 + 浏览器做**降级 Playtest** |
| M1-7 | 埋点（`tray:full` / `bead:rejected` / 每关耗时） | T-082 | 秒表 + 人工计数（`playtest-plan` 已备此口径） |

**M2 · 最小可 Playtest 配置（QA 建议的可执行组合）**

> 若主理人需在波次 2 后尽快取 Playtest 数据，**最小组合 = M0-1..M0-6 全落 + M1-1 + M1-7**，环境用 **web-mobile 产物 + 桌面浏览器**（非真机）：
> - 可执行：第 1 轮 FTUE 的「3 秒看懂 / 首次落子耗时 / 拒绝反馈理解 / 托满初体验 / 首关时长 / 再来意愿」**6 项全部**；第 2 轮的「单关时长 / 满槽频次 / 道具使用 / 颜色数爬坡 / 放弃点」**5 项**；
> - 仍须标 ⛔：所有 `[Device]` 项（多点触控、热区 pt 换算、杀进程续进、onHide、低端机帧率）、所有音频主观项（`[P]` 道次）、第 3 轮的减弱动效/灰度 6 状态；
> - 判定线调整：第 2 轮「供料间隔体感」与第 3 轮全部**移出本轮**，`playtest-plan.md` v1.1 已按此登记（见该文件 §执行前提）。

---

## 10. 升 PASS 的剩余条件（复验 G4 前置）+ 对 T-082 的需求

### 10.1 复验 G4 的前置（按门分组）

| 门 | 前置 | 责任 |
|---|---|---|
| **G1** | `pnpm run framework:sync` 使 `framework:sync:check` 转绿；建议同时修 BD-17（verify 短路）与 BD-18（`check:size` 对 beads 零覆盖） | T-082 / 主理人 |
| **G2** | 补 `tests/input-control.test.ts`（S2 §8 全 10 条当前**零自动化测试文件**，BD-21）；补 `pause-settings §8` 10 条 + `save-progress §8` 8 条 + `timer §8-11/12` 2 条的测试映射 | 程基岩 / T-085 |
| **G3** | `build:cocos:web`（beads）通过；`preview:frames` 支持 beads（BD-19）；harness 修复 BD-07/BD-08/BD-13 | T-082 / T-087 |
| **G4** | BD-01/02/03/04/06/10/11/15/16 落码 + §8 全部 8 项判据冲突裁定完毕 + `test-cases.md` v1.3 §G 可感知判据逐条重跑 | T-085 / T-086 / 策划 |
| G5 | 微信开发者工具 + AppID + 真机 | 用户 / 主理人 |

### 10.2 本 QA 向 **T-082（程基岩）** 需要的取证支持（避免重复劳动，主理人中转）

| # | 需求 | 用途 | 优先级 |
|---|---|---|---|
| R1 | **执行 `pnpm run framework:sync`**（写 4 个受版本控制拷贝件）并回报 `build:cocos:web` 是否转绿 | 解除 G1 FAIL + 打通 Cocos 取证路径（本 agent readonly 不代行写操作） | **P0** |
| R2 | **Cocos 取证基础设施 + 截图方法**（任务单已指明由 T-082 提供）：① web-mobile 产物在浏览器下的**无头截图**方式（Playwright/`browser-use` 均可）与产物路径约定；② 设计坐标 ↔ 屏幕坐标换算在**产物运行时**的正确取值（用于校验 BD-07 是否只在 harness 存在）；③ 截图命名与落盘约定（建议 `production/qa/beads/evidence/shots/<case-id>-<frame>.png`） | §G 可感知判据的 `[Cocos]` 道次取证（TC-PER-01 色盲模拟、TC-PER-04 VFX 逐帧、TC-PER-07 脉冲周期）全部依赖它 | **P0** |
| R3 | **色盲模拟取证手段**：deuteranopia / protanopia 滤镜如何在产物截图上施加（Chrome DevTools rendering 面板 / Playwright `emulateMedia` / CSS filter 三选一），以及**灰度**截图口径 | `accessibility A2b` Standard 层判据「色底色相差异在 deuteranopia/protanopia 模拟下仍可区分同关使用的 3–8 色」；`A3` 灰度可辨 | P1 |
| R4 | harness 修复进度同步（BD-07 DPR / BD-08 镜像 / BD-13 跳关键位） | 决定 `[Harness]` 用例何时可从「⛔ 污染」转可执行 | P1 |
| R5 | `check:size` 与 `verify` 的流程修复意向（BD-17/BD-18） | 消除两处结构性假绿风险 | P1 |
| R6 | 音频后端（BD-05b）排期信号 | 决定 A05-* 判据 `[B]/[P]/[R]` 道次何时可执行、Playtest 是否需降级 | P2 |

### 10.3 开放项（需主理人裁定 / 中转）

1. **§6.3 D1/E2 三文档冲突**：甲/乙/丙择一 → 影响 T-085 是否需落 settings 字段、`accessibility` 承诺等级是否需重算。
2. **§8 U8 GAP-06 泄压阀方案**（⏳ 待用户拍板）→ 影响 BD-06 的验收判据形态（本 QA 已写成方案中立，任一方案落地都可验）。
3. **§8 判据冲突 8 项**（BD-22/23/24/25/26 + 3 项文档同步）→ 移交策划（T-081）。
4. **BD-04 定级上调**（P3/P2 → P0）与 **BD-12 定级**（P2 vs P1）→ 需主理人确认 `bug-severity.md` 是否补「关键反馈零通道 = P0」细则（v1.1 已拟该条，待确认）。
5. **`knowledge/lessons.md` 条目**（§6.5 正文草稿）→ 按硬约束**未落盘**，由主对话决定。
6. **任务单「第三次假绿」口径**：本 QA 独立核对为**第 4 轮**（§6.4 谱系表），差异已说明，不擅改主理人口径。

---

## 11. 变更记录

| 版本 | 日期 | 变更 | 作者 |
|---|---|---|---|
| v1.0 | 2026-09-14 | beads **首份** G4 回归报告（现状基线轮，WXG-T-084）：19 组探针逐条结论 + G1–G3 13 项全量实跑 + BD-01..BD-26 缺陷登记 + GAP-09 假绿复核（5 项假绿 / 2 项须重标注 / 四轮谱系 / 5 条防再犯）+ 13 处探针自身缺陷自查 + 8 项判据冲突移交 + Playtest 三轮不可执行评估与最小可 Playtest 配置。建议裁定 **G4 = FAIL**、G1 = FAIL、G3 = 部分 | 严守真 |
| **v1.1** | **2026-09-15** | **WXG-T-092 复验轮（波次 3）**：把波次 2（T-085..T-091）的「代码级自证」升级为**探针他证**。① 新探针 `g4-probe-v1.1.mjs`（**26 组**：P1–P19 全量重判 + P20–P26 补测），预期值一律取 **T-091 回写后的 §8 现文**；② 改判结果 **PASS 13 / PASS\* 8 / FAIL 4 / ⛔ 1**（v1.0 为 11 FAIL / 5 PASS\* / 2 PASS / 1 ⛔）——**7 项 FAIL 转绿、4 项 PASS\* 转 PASS、P13 由 ⛔ 转 PASS，4 项 FAIL 全部是波次 2 未列范围的既有缺陷，零新回归**；③ G1 转绿复核（`framework:sync:check` ✅ 本轮实跑 + web-mobile 产物为波次 2 留痕 ⇒ **BD-20 关闭 / R1・R7 需求已满足**）；④ BD-01..26 逐条处置状 + §8 八项冲突关闭标记；⑤ 新缺陷顺延登记 **BD-27..BD-32**；⑥ 探针自身缺陷再自查 **13 处**（另有 8 处预防性口径收紧；若不修正前者将造出 10 处假 FAIL + 1 处假 PASS + 1 处双向 + 1 处判据误读）；⑦ §G 20 条可感知判据逐条给「本轮可验道次」结论。建议裁定 **G4 = CONCERNS**（详见 §18） | 严守真 |
| **v1.2** | **2026-09-15** | **WXG-T-096 专项复跑：仅 P5（音频）段重建预期值并重跑**（任务书 Deliverable ⑤）。① 旧 P5 预期值所依据的三个前提（玩法事件零派发 / `tuning.ts` 仅 3 clip / 三平台均 `NullAudioBackend`）已被本单实现推翻 ⇒ 不改预期值直接复跑会做成**假 FAIL**；② P5 段 28 条（27 A05 + 1 结构证据）判定一律改为**实算**，`[B]/[C]/[R]/[P]` 覆盖项记 **⛔** 并写明缺哪一道 ⇒ **PASS 12 / PASS\* 8 / FAIL 0 / ⛔ 8**（旧判定 FAIL）；③ BD-05 → **部分关闭（仅 [N] 派发层）降级 P2，不关单**；BD-05b → **关闭（仅 [N] 结构层）**；④ 同一命令反绿 ⇒ **建议重开 BD-20**（`framework:sync:check` EXIT=1，12 处 differs）；⑤ 新缺陷 **BD-33 / BD-34**（§15.2）；⑥ 探针自身缺陷再自查 **5 处**（修订 35/36/37，含本单新增 `AUDIO_CLIP_*` 对 P4 的**反向污染**=假绿）；⑦ **其余 25 组未重跑**，判定与 v1.1 逐条一致（仅作回归对照）。建议增量：**G4 仍 = CONCERNS，不得因 P5 转绿升 PASS**（详见 §19） | 严守真 |
| **v1.3** | **2026-09-15** | **WXG-T-098 裁定后三条探针改判（P20 / P26 / P4）**：① 预期值一律改取 **T-098 回写后的 `tray-spawner §8-1 / §8-3` 与 `ux-spec §5` 现文**，且**先改预期值、后重跑**（顺序自证见 §20.1）；② 整轮重跑 **54 组**（新增负向用例 P26-N）⇒ 本轮改判面 **P20 PASS / P26 ⛔ / P4 FAIL**，其余 50 组判定**逐条未翻转**（逐记录对照见 evidence §4）；③ **P20 PASS\* → PASS**：闭区间按**名义时刻**计数 = 16、最大滞后 **2.00 帧压线**、零负偏差、间隔偏差 0.0167s；**旧字面严格读法仍 15≠16 ⇒ 两读并列呈报**（防「数字变好看」误读）；④ **P26 → ⛔**：§8-3 判为**作废**（非平凡真），3:1 断言从脚本**删除**，⛔=无从判定不产绿 ≠ 平凡真 PASS；⑤ **P4 收紧后 FAIL**：α **峰点数 2 = 10Hz**（判据 ≤1）、连续拒绝**起点最小间隔 100ms**（判据 ≥500ms）⇒ **BD-29 由「规格互斥」转态为「实现落差」**，§5:201 已明文不重复开缺陷 ⇒ **不占新 BD 号**，改码已立项 **WXG-T-102**；⑥ §15.3 给 **BD-27..31 处置状更新** + 登记 **BD-35 候选**（`ux-spec §5:187` 告急行缺 **α 幅度**，来源=林绘澄 T-098 核对）；⑦ 探针自查续号 **修订 38** + 新 helper `countPeaks`；⑧ 观察 **O1–O4**（基线漂移致 A05-24 附带审计自行消解 / 跨轮随机读数 / 镜像 check 归零但 `[C]` 仍未跑 / `levels-spec.md:23,42` 仍写 `DECOY_COLORS_MAX=2` 与 §3 v1.17 冻结值 0 陈旧）。建议增量：**G4 仍 = CONCERNS**；**BD-25 建议可关闭**（详见 §20） | 严守真 |

---

# 复验轮（v1.1 / WXG-T-092）

## 12. 复验轮范围、命令与计数

### 12.1 本轮实际执行（可复核）

| 道次 | 命令 | 结果 |
|---|---|---|
| `[Probe]` **G4 主证据** | `node production/qa/beads/g4-probe-v1.1.mjs` | **EXIT=0，26 组**（时间戳 2026-09-15T01:24:22Z，Node v24.4.1）⇒ 原始输出 evidence §1；**01:55:44Z 复跑计数完全一致（逐行 diff 零差异）⇒ 结论可复现**，记 evidence §6 |
| `[G]` **G1–G3 门链** | `pnpm run verify`（14 项 `&&` 串联） | **EXIT=0** ⇒ evidence §2。**【v1.2 复跑：同一命令 EXIT=1，聚合后 PASS 12 / SKIP 1 / FAIL 1（`framework:sync:check`）——与 WXG-T-096 任务书自述的「13 PASS / 1 SKIP」不一致，见 §19.2】** |
| 单测拆分 | `pnpm -r run test`（verify 第 12 项内） | framework **240** / breakout **239** / **beads 198** = 677 全绿，21 个 beads 测试文件。**【v1.2：718 全绿 = framework 255 / beads 224 / breakout 239（+41 来自本单两条新测试文件）；但按修订 33，单测绿不替代探针他证】** |
| ES5 静态门 | `pnpm run check:es5spread` | OK —— **78 shipped source file(s), no non-array spread**（= P24 的静态半边证据） |
| 包体门复核 | `ls games/{beads,breakout}/cocos/build` | beads **仅 web-mobile**，无 `wechatgame` ⇒ `check:size` 只测到 breakout 1815.1KB 仍打 ✅ ⇒ **BD-18 未修** ⇒ evidence §3 |
| 帧预览复核 | `grep -n 'loadHarness()' tools/scripts/render-harness-frame.mjs` | `:37 loadHarness()` **无 `--game` 透传**；`:56 movePaddleTo` `:77 bricksDestroyed` ⇒ **BD-19/BD-13 残留未修** |
| 夹具诊断 | `node evidence/diag-p12-slot-sample.mjs`、`node evidence/diag-p3-onboarding.mjs` | 用于**区分探针夹具缺陷与实现缺陷**（结论见 §16）⇒ evidence §4 |

### 12.2 计数对比（四态）

| 结论 | v1.0（修复前基线，19 组） | **v1.1（复验轮，26 组）** | 变动 |
|---|---|---|---|
| ✅ PASS | 2（P12 P16） | **13**（P1 P2 P6 P9 P11 P12 P13 P15 P16 P18 P19 P21 P25） | +11 |
| ⚠️ PASS\* | 5（P9 P11 P14 P15 P18） | **8**（P3 P4 P7 P14 P20 P22 P23 P24） | +3（但 v1.0 的 5 项中 4 项已升 PASS） |
| ❌ FAIL | **11** | **4**（P5 P8 P10 P17） | **−7** |
| ⛔ 不可验 | 1（P13） | **1**（P26） | 同量不同项 |

> **零新回归声明**：v1.1 的 4 项 FAIL 与 v1.0 的 FAIL 集合严格同集（P5/P8/P10/P17），对应 **BD-05 / BD-15 / BD-16 / BD-12**——四者在波次 2 的 T-085..T-091 任务书范围**之外**（音频、扩展入口、轻提示、元游戏 meta 字段）。波次 2 的六个目标缺口（GAP-01/02/03/04/06/10 + D1/E2 + harness 坐标 + ES5）在 Node/Probe 可证范围内**全部转绿**。

## 13. 逐探针 v1.0 → v1.1 改判表（P1–P26）

> 证据锚点格式：`e1 §k` = `evidence/g4-reverify-v1.1.log` 第 k 节；行号 = 复验轮实际看到的代码锚点（非文档声称）。

| # | 判据来源 | v1.0 | **v1.1** | 一句依据（实测数字 + 代码锚点） |
|---|---|---|---|---|
| P1 | `assets-spec §1.2` E1/E4 + `accessibility A2`；GAP-01 | ❌ FAIL | ✅ **PASS** | L1 三色逐格**独立复算**全对（`1→#f3ecdf 5→#ebb1a3 6→#ccbdda`），中性槽底 `#ede7da` 不再作为目标色底；**22/22** 空槽检出 α=`EMPTY_GHOST_ALPHA(0.2)` 幽灵符号。锚点 `bead-render.ts:174 drawEmptySocket(…,colorIdx)`。v1.0 的「去重数>1」弱断言已换掉（修订 15，防假 PASS） |
| P2 | `ux-spec §6.1/§6.2` U7；GAP-02 | ❌ FAIL | ✅ **PASS** | L1（`spawnInterval=6s`）**第 1 帧**即 `tray:spawned=1`、持有 1 颗（修复前 361 帧/6.02s）；首珠 `colorIdx=6` 且 `demand=3>0` ⇒ **首珠可落子**；对照组 `SPAWN_INTERVAL_DEFAULT=4s` 亦第 1 帧供料。锚点 `spawner.ts` `reset()` → `_firstFeed` → 首 `tick()` 走 `_feedOnce` |
| P3 | `ux-spec §1-3 (a)` + §5 三行；GAP-03 | ❌ FAIL | ⚠️ **PASS\*** | 三通道齐：① 目标色底（P1）② 首珠槽脉冲 `guideSlot=11` ③ 单一目标格 `hint=(r2,c1)` 且为**行主序最前匹配格**；渲染层 `accent_blue(#3d7bf5)` 描边环 **2 个**、呼吸周期 **600ms**（α 19 档/90 帧）；首次 `bead:placed` 后 `onboarding=false`、环数 0。降 PASS\* 原因 = **附带发现 BD-32**（§15） |
| P4 | `ux-spec §5` 四行；GAP-04 | ❌ FAIL | ⚠️ **PASS\*** | wrong 态真实生效：`bead:rejected=1`、`wrongRow/Col=(0,1)`、200ms 内位移 `[±2.6px × 换号 2 次]`、danger 描边 α **4 档起伏**；落座回弹有时间轴（剔 text 签名去重 2）。仍缺 2 行：`vfx_clear_dissolve` / `vfx_complete_wave`（tuning 常量命中 0）⇒ **BD-04 降级不关闭**；另开 **BD-29**（红线互斥，§15） |
| P5 | `audio-events §1/§4`；GAP-05 | ❌ FAIL | ❌ **FAIL（维持）** | 【v1.2 已改判 → 本行的三个前提（零派发 / 3 vs 19 clip / 三平台 Null）均已被 WXG-T-096 推翻，**直接复用本行会得出假 FAIL**；逐条新判定见 §19.3】 玩法事件仍**零音效派发**：clip 去重仅 `[bgm_main, sfx_ui_tap]`；`tuning.ts` 仍 3 个 vs 要求 19（A05-24 清单不闭合）；三平台 backend 仍 `NullAudioBackend`。**波次 2 无音频单 ⇒ 不属改判** |
| P6 | `ux-spec §8 U8`（已拍板 A′+D）+ `tray-spawner §2.4/§8-4`；GAP-06 | ❌ FAIL | ✅ **PASS** | **只用合法供料**（不用 `giveTrayBead`）：第 1321 帧（22.0s）满槽 12/12，满槽瞬间**可落子珠 12/12**；7933 个「槽×帧」采样中死珠 **0**、违反 `held≤demand` **0**；腾 1 槽后 ≤1 间隔恢复供料。⇒ 判据形态随 U8 拍板从「≥1 条出口」改为「合法供料路径死局不可达」 |
| P7 | `ux-spec §5` 告急行 + `timer §8-10`；GAP-10 | ❌ FAIL | ⚠️ **PASS\*** | 告急**三通道成立**：`timer:urgent=1`、图标 `#8b8578→#e84c3d` + 数字切 danger、α **31 档**、周期 **1000ms = 1.00Hz**（≤3Hz 红线）。仍缺：**满槽告警 500ms 描边呼吸零通道**（满槽且 `tray:full=1` 时托盘带非文本签名 60 帧去重 = **1**）⇒ **BD-10 部分关闭**（剩余半边降级 P2） |
| P8 | `input-control §8-1` 五类路由 | ❌ FAIL | ❌ **FAIL（维持）** | 5 类中 4 类✓（齿轮→paused；道具卡→used；托盘珠→selected；空格+选中→placed=1/rejected=0）；第 3 类**扩展入口全盘 6px 栅格扫描仍 0 命中**（`src/**` 无 `btn_expand`/`_hitExpand`）⇒ **BD-15 开放**（波次 2 未列） |
| P9 | `input-control §8-2/§8-4`（**回写后**） | ⚠️ PASS\*（判据互斥） | ✅ **PASS** | 格心 (297,904)：偏移 0/12/25 → **全命中本格**；27/32/33（重叠区且严格靠近邻格）→ **全命中邻格**；40/51/52 → 邻格；网格外 −20px → **零事件**。等距并列点 dx=26 归左（§8-4 未定义，不判否）。**BD-23 随 §8-2 回写关闭** |
| P10 | `input-control §8-7` 轻提示 | ❌ FAIL | ❌ **FAIL（维持）** | 前半条✓（placed/rejected/selected 全 0）；后半条**配对差分 = false**（同 seed 两实例、同帧号「点 vs 不点」非文本签名**完全相同**，四个 hint 字段全空）⇒ **BD-16 开放**（`beads-game.ts:1371`）。v1.0 此处用「相邻两帧自比」属**假 PASS 风险**，本轮已收紧（§16 缺陷 g） |
| P11 | `input-control §8-6/8/9/10` | ⚠️ PASS\*（绕过 InputManager） | ✅ **PASS** | 改走**真实 `InputManager` + `Viewport`**：双击同槽 `selected=1`✓；PAUSED 点托盘/网格/道具 ⇒ 事件增量 **0**、相位仍 paused✓；同帧 20 条 down ⇒ `placed=1, rejected=0`、无崩溃✓；**§8-9 双指同帧路由事件 = 1**（owner-lock，`input-manager.ts:95`）✓。真机触摸事件序仍 `[Device]` ⛔ |
| P12 | `tray-spawner §8-2/8/4/8-5`（**8-2 已回写卡方**） | ✅ PASS（但 §8-2 字面 FAIL） | ✅ **PASS** | 白盒排水夹具 23882 帧采足 **200** 样本：频次 `[19,16,21,20,19,14,18,16,17,13,15,12]` ⇒ **χ² = 5.32 < 临界 19.675（df=11, α=0.05）不拒绝均匀**；旧 ±20% 口径下最大偏差 28.0%（会误报 ⇒ 正是 **BD-22** 的误报本征，现随回写关闭）。§8-4 满槽 `tray:full=1` 去重✓、满槽期 spawned=0✓、腾槽恢复✓；§8-5 12→**24** 槽✓（玩家入口仍缺，见 P8） |
| P13 | GAP-07（环境事实④） | ⛔ 不可测（污染） | ✅ **PASS** | ① 双向往返最大误差：750×1334 = **0**、390×844（含 letterbox）= **7.1e-15**、412×915 = **2.3e-13**；② 把 device-px 当屏幕坐标喂入 ⇒ 落点偏离 **522.6px**（坐标空间可区分）；③ **端到端**：CSS px (240.0,1009.0) 经真实 `app.input.push(down/up)+tick` ⇒ 期望命中槽 3、实测 `traySelected=3` ✓；④ 反向钉：同点 device-px 喂入 ⇒ 选中态 unchanged。锚点 `dev/harness/main.ts:90-102`（ADR-0011）⇒ **BD-07 关闭** |
| P14 | GAP-13 L6–L8 通路 | ⚠️ PASS\*(Node)/⛔(harness) | ⚠️ **PASS\*** | **harness（真实编译产物）`goToLevel(5/6/7)` 全部进 PLAYING**：L6 12×9 `empty=59 locked=2` 色 7；L7 13×10 色 8；L8 13×12 色 8 ⇒ v1.0「harness 只暴露 L1–L5」已不成立。仍缺：`preview:frames` 不支持 beads（§3 复核）+ 无截图通路 ⇒ 不升 PASS |
| P15 | `bead-grid §8-8` | ⚠️ PASS\*（仅公式复算） | ✅ **PASS** | 156 格装载；五格中心**公式↔渲染指令**最大偏差 **0.000px**（判据 ≤0.5px）⇒ 取证面由「纯公式」升为「view 实际下发绘制坐标」。真实栅格化像素（含 DPR 取整）仍 `[Cocos]` ⛔ |
| P16 | `timer §8-7` 区间 | ✅ PASS | ✅ **PASS（无回归）** | 180/181/419/420 → playing；100/999 → BOOT 拒收并打 `L911: time 100 outside [180, 420]`（含 id + 字段） |
| P17 | `save-progress §8-7` + §2.3 meta | ❌ FAIL | ❌ **FAIL（维持）** | 存档已升 **`version:2`**（T-088），但新增字段是 `settings.reduceMotion/largeText`；实测写档 **无** `winStreak/lastPlayDate/signin` ⇒ **BD-12 开放**（`save-schema.ts` 无 meta 段；属 `concept §7` MVP 线之外） |
| P18 | `save-progress §8-9`（**回写后 156 + cleared 帧**） | ⚠️ PASS\*（200 不可构造） | ✅ **PASS** | 可填格 **156** = `GRID_MAX_COLS×GRID_MAX_ROWS`；156 次落子全成功，**PLAYING 段（前 155 次）写档 = 0**，含 `level:cleared` 结算帧累计 **恰 1** ⇒ **BD-24 随回写关闭**（giveTrayBead 夹具仅用于补齐珠量，已在头注修订 20 隔离声明） |
| P19 | `assets-spec §1.2` hint 行；GAP-11 | ❌ FAIL | ✅ **PASS** | `accent_blue(#3d7bf5)` **2px** 外描边环 2 个（50px/48px，`lineWidth=2`），且检出**叠加在目标格上**的环；α 0.5↔1.0 呼吸 600ms（P3）⇒ hint 载体成立。分层偏差（不判缺陷）：`CellState` 仍为 `[locked\|empty]`，hint/wrong 走 snapshot 覆盖层 ⇒ 建议 `assets-spec` 加注「叠加层，不改 S3 三态」 |
| **P20** | `tray §8-1` + `core-loop §8-2`（**回写后 16±0**） | —（新增） | ⚠️ **PASS\*** | 首供 t=**0.0167s**（进 PLAYING 第 1 帧）；样本 16 个、相邻间隔最大偏差 **0.0167s**；但 **t≤60 闭区间内 = 15 次**（第 16 次落 60.033s，超界 2 帧）⇒ 字面严格读法应记 FAIL；QA 按「帧量化 ±1 帧」记 PASS\* 并**提请裁定**（**BD-27**） |
| **P21** | GAP-06 **A′ 不变量** + `tray §8-9` | —（新增） | ✅ **PASS** | 两局长跑（10800 帧 + 120s 逐 30 帧抽检，seed 固定）：`tray:spawned=90`、抽中色集 `[1,2,3,4,5]`；**违反 `held≤demand` 采样 = 0**、**死珠 = 0**；§8-9「0 杂色 ⇒ 供料 100% 为仍需色」在 D 下**平凡真**（8 关 decoys 全空）。锚点 `spawner.ts _drawColor`（`needed>0 && heldCount<needed`，`tray.ts:97`） |
| **P22** | `accessibility D1`（**T-091 裁定后**） | —（新增） | ⚠️ **PASS\*** | 开关经暂停面板行3 `toggle-reduce-motion`（`pause-panel.ts:126-129`）→ `snapshot.reduceMotion=true`；**三通道逐个退静态**（每通道实例均**预置** reduceMotion=true 走读档回显）：告急 α 90 帧 distinct=**1**、hint 60 帧 distinct=**1** 且蓝描边保留（图元 2）、wrong 位移 12 帧唯一值=**1** 且 fx 窗口内静态红环 ≥1；落档 `"reduceMotion":true` + **二次装配回显 true**。记 PASS\* 而非 PASS：① 结算/星弹跳未做逐帧断言 ②「不晕」的观感属 `[Cocos]/[人]` |
| **P23** | `accessibility E2` 大字号 | —（新增） | ⚠️ **PASS\*** | `toggle-large-text` → `largeText=true`；字号集 `[22,27,30,35,40,44]`（`FONT.sub 28→35`、`hudSmall 22→27`，`view-model.ts:99-103` ×1.25），**倒计时字号未变**（判据：数字/标题不放大）；落档 `"largeText":true`。记 PASS\*：§5.2 已拍板「基础版」，面板文案自适应延后 v1.1；真机溢出 ⛔ |
| **P24** | T-090 / G10 ES5 `[...Set]` | —（新增） | ⚠️ **PASS\*** | Node + harness 产物装配下 **8 关逐关 `goToLevel` → L1..L8 全 `playing`**；静态门本轮实跑 `check:es5spread` **EXIT=0**（78 文件无非法展开）+ selftest 在 verify 链内。仍 PASS\*：原现象发生在**微信 ES5 运行时**，`[R]/[Device]` ⛔，**不得据本条宣布真机已愈** |
| **P25** | `accessibility C2`（**回写后 60px**） | —（新增） | ✅ **PASS** | `POWERUP_CARD_GAP=60`（`tuning.ts:52`）；实测**相邻卡边缘间距 [60, 60]**、中心距 236（≥96 判据✓）、总宽 **648 ≤ 750**✓ ⇒ 文档↔实现一致，**BD-26 关闭**。真实误触率属 `[Device]` ⛔，不因本条改判 |
| **P26** | `tray §8-3` 3:1 加权抽色 | —（新增） | ⛔ **不可验** | 构造 §8-3 前置关（`decoys=['4']`）→ **BOOT 校验拒收**（实测 `phase=boot`，`levels.ts:184` `decoys.length > DECOY_COLORS_MAX(0)`）。`tray-spawner §2.4.6` 已自认该条在 A′/D 下作废，但 **§8 正文未随 v1.17 回写**（T-091 只改了 §8-1/§8-2）⇒ **判为「判据不可构造」而非实现缺陷**，登记 **BD-28** 移交 GDD 侧 |

---

## 14. BD-01..26 处置状（复验轮逐条）

> 口径：**关闭** = 复验探针实测判据成立且无残留；**部分关闭（降级）** = 主体成立但仍有子项未落，级别按剩余部分重算；**维持开放** = 波次 2 未列范围，本轮无改判依据；**不可验维持** = 无取证通路，**不得据文档改判**。

| 编号 | 标题（缩） | v1.0 级别 | **v1.1 处置** | 复验依据 | 剩余 / 解除条件 |
|---|---|---|---|---|---|
| **BD-01** | 空槽无目标色 | P0 | ✅ **关闭** | P1：三色独立复算全对 + 22/22 幽灵符号 α0.2；`bead-render.ts:174` 签名已含 `colorIdx` | 色盲模拟/灰度可辨属 `[Cocos]` 道次（→ BD-09 剩余半边） |
| **BD-02** | 开局托盘全空 ≥1 供料间隔 | P0 | ✅ **关闭** | P2：L1 第 **1 帧**即供料、首珠 `colorIdx=6` 且 `demand=3` | — |
| **BD-03** | 0 文字引导三通道全缺 | P0 | ⚠️ **建议附条件关闭**（随 **BD-32** 裁定） | P3：①②③ 三通道均实测成立（`guideSlot=11` / `hint=(r2,c1)` / 环×2 / 600ms / 落子即清） | 主载体成立，但 **BD-32**（`runs` 自增时机致引导可被永久跳过）须由主理人裁定是否作为独立缺陷另开单 |
| **BD-04** | 四类 VFX 全缺 | P0 | 🔻 **部分关闭 → 降级 P2** | P4：落座回弹有时间轴、wrong 位移 ±2.6px×2 + danger α 4 档 | 仍缺 `vfx_clear_dissolve` / `vfx_complete_wave`（tuning 常量命中 0，ux-spec §5 两行无实现）⇒ 移交工程侧下一波 |
| **BD-05** | 玩法事件零音效 | P1 | ❌ **维持开放**（v1.1 快照）→ 🔻 **v1.2：部分关闭（[N] 派发层）→ 降级 P2，不关单** | 【v1.2】P5/A05-01…A05-24 实跑：玩法事件不再零派发（详 §19.3）；A05-24 清单四方对账 19/19/19/19 成立 | 剩余 = [B]/[C]/[R]/[P] 四道：时长・包络（8 条 ⛔）、包体（A05-25）、真机（A05-27）、听感（A05-26）；另 BD-10（满槽呼吸）卡 A05-14 |
| **BD-05b** | 框架级 `NullAudioBackend` × 3 平台 | P1 | ❌ **维持开放**（v1.1 快照）→ ✅ **已关闭（WXG-T-096，[N] 结构层）** | 【v1.2】`audio-synth.ts` 已存在；P5/S 实测：web+voices → Synth、web 无 voices → Null、node → Null（护单测）、weapp 有 `createWebAudioContext` → Synth（并挂 onTouchStart/onHide/onShow）、无能力 → 告警+Null | **结构层 ≠ 出声**：「真能听到」仍属 [B]/[R]；且微信子集行为与三总线增益（§3.12 [TODO]）未验 ⇒ 不据此升 PASS |
| **BD-06** | 尾部软锁死、零非重置出口 | P0 | ✅ **关闭**（判据形态随 U8 拍板 A′+D 改写） | P6 + P21：7933 + 90 组采样 **死珠 0 / 违规 0**；满槽瞬间可落子 12/12；腾槽 ≤1 间隔恢复 | 若策划改回 B/C 方案须重开 |
| **BD-07** | harness DPR 坐标错位 | P0(工具) | ✅ **关闭** | P13：三视口往返误差 ≤2.3e-13；端到端 CSS-px 点击命中期望槽 3；`dev/harness/main.ts:90-102`（ADR-0011） | — |
| **BD-08** | harness 文字镜像 | P1 | ⛔ **不可验维持** | Node 侧 `DrawCommand` 无镜像语义，v1.0 亦标「未独立复现」 | 须 `[Cocos]` 截图通路（→ BD-19/BD-20 后续）；**文档称已修不作证据** |
| **BD-09** | `accessibility.md` 假绿 5 项 | P1 | 🔻 **部分关闭**（D1/E2/A2 转真；A2b/A3/C1 仍 ⛔/无对象） | P22（D1 三通道退静态）、P23（E2 字号集）、P1（A2 非颜色通道） | A2b/A3 = 色盲·灰度 `[Cocos]`；C1 `btn_expand` 本体仍不存在（→ BD-15） |
| **BD-10** | 告急脉冲 + 满槽告警缺失 | P1 | 🔻 **部分关闭 → 降级 P2** | P7：告急三通道成立（1000ms / 1.00Hz / 双图标+数字）；**满槽告警 500ms 描边呼吸仍零通道**（签名去重=1） | 满槽告警半边；`timer §8-10`「同屏叠加」仍实质不可测 |
| **BD-11** | `hint` 态无承载体 | P2 | ✅ **关闭**（附分层说明） | P19：`accent_blue` 2px 环 ×2、α 0.5↔1.0 呼吸；hint 走 snapshot 覆盖层而非 `CellState` 新态 | 建议 `assets-spec` 加注「叠加层，不改 S3 三态」（文档同步，非缺陷） |
| **BD-12** | 元游戏 `meta` 字段零落地 | P2 | ❌ **维持开放** | P17：`version:2` 仅新增 `settings.*`，`winStreak/lastPlayDate/signin` 命中 0 | 属 `concept §7` MVP 线外；须主理人排期 |
| **BD-13** | harness 跳关 + 帧预览不足 | P1 | 🔻 **部分关闭** | P14：harness `goToLevel(5/6/7)` **全部进 PLAYING**（v1.0「只暴露 L1–L5」不再成立） | `preview:frames` 仍不支持 beads（= BD-19） |
| **BD-14** | 流程：QA 判据零可感知型 + beads G4 未执行 | P0(流程) | ✅ **关闭** | v1.0 首出报告；`test-cases.md` v1.3 补 §G 20 条 + §H 22 条 ⇒ §8 映射 93/93；本轮 §G 已实跑（见 §17） | 保持：新表现层判据入 §G 的流程约定 |
| **BD-15** | 扩展入口 UI 不存在 | P1 | ❌ **维持开放** | P8 第 3 类路由全盘 6px 扫描 **0 命中**；`src/**` 无 `btn_expand`/`_hitExpand` | 波次 2 未列；连带 `accessibility C1` 无对象 |
| **BD-16** | `§8-7` 无选中点网格零反馈 | P2 | ❌ **维持开放** | P10 配对差分 = **false**（同 seed 点/不点签名完全相同）；`beads-game.ts:1371` | hint/failHint 通道已具备（P19），**只差接这一条**，建议列波次 4 首项 |
| **BD-17** | `verify` 用 `&&` 串联 ⇒ 后续门未跑 | P1 | ❌ 维持开放（v1.1 快照）→ ✅ **已关闭（WXG-T-095，v1.1 之后）** | `package.json` `verify` 已改指 `tools/scripts/verify-all.mjs`：14 项**逐项执行 + 汇总退出码**，不再短路；`--validate` 监控表与 `package.json` 不脱钩且拦住 `verify` 回退成 `&&`；`pnpm run verify:selftest` 实测「注入一项失败 ⇒ `[2/2]` 仍执行、总退出码非零、未通过项被点名」 | 无残留。**口径变更**：今后 `verify` 的 EXIT=0 才等价于「14 项都跑过」；SKIP 在汇总里点名，`verify:strict` 把 SKIP 判失败 |
| **BD-18** | `check:size` 对 beads 零覆盖仍报 OK | P1 | ❌ 维持开放（v1.1 快照）→ ✅ **假绿部分已关闭（WXG-T-095）；beads 红线实测仍挂 B4** | 脚本新增覆盖面计算（`games/*` 逐游戏）+ `overallStatus({anyFail, missing})`：本轮真跑输出「⚠️ 包体校验 **SKIP**（未全覆盖）—— 已测：breakout ／ 未覆盖（1 款，**不是通过**）：beads」+ `STATUS: SKIP`；`--strict` 下 exit=1；`--selftest` §C1–C6（19/19） | **假绿已消**；beads 主包**数值**仍无数据（需 AppID，→ §18.2 B2/B4）——本轮**不因修了脚本而改判包体可证** |
| **BD-19** | `preview:frames` 硬编码 breakout | P2 | ❌ **维持开放** | `render-harness-frame.mjs:37 loadHarness()` 无 `--game`；`:56 movePaddleTo`；`:77 bricksDestroyed` | 归 BD-13 同批 |
| **BD-20** | `framework:sync` 漂移 ⇒ G1 FAIL + Cocos 阻塞 | P0(阻塞) | ✅ **关闭**（v1.1 快照）→ 🔴 **v1.2：建议重开** | v1.1：`framework:sync:check ✅` + EXIT=0。【v1.2】同一命令实跑 **EXIT=1，12 处 differs**（beads/breakout 各 6：core/audio/audio.ts、platform/{audio-synth,node,platform,weapp,web}.ts）⇒ 旧关单依据已反绿 | 跑 `pnpm run framework:sync` 后复验；连带 **BD-33**（新增镜像脚本缺 `.ts.meta`）与 A05-25 `[C]` |
| **BD-21** | QA 自身产出缺陷（映射/合计/标题/头部） | P1 | ✅ **关闭**（文档层） | v1.3 四处已修（§H 补编、137 用例、§F 8 条、93 条） | **执行层剩余**：§H 22 条中 `pause-settings §8` 10 条与 `timer §8-11/12` 2 条本轮仍只在单测层，未进探针 ⇒ 登记为**未执行清单**（§18），不据此判 FAIL |
| **BD-22** | `§8-2` ±20% 容差易误报 | P2 | ✅ **关闭**（已回写卡方） | `tray-spawner §8-2` 现文＝卡方拟合优度；P12 实测 χ²=5.32 < 19.675。旧口径同批数据最大偏差 28.0% ⇒ **正是误报本征的实证** | — |
| **BD-23** | `§8-2` vs `§8-4` 互斥 | P2 | ✅ **关闭**（已裁定回写） | `input-control §8-2` 现文明写「重叠区以 §8-4 最近格心为准」；P9 全段实测一致 | 唯一遗留＝等距并列点（dx=26）§8-4 无定义 ⇒ 属 **BD-27** 类文字精度，非互斥 |
| **BD-24** | `§8-9`「200 次落子」不可构造 | P2 | ✅ **关闭**（已回写 156 + cleared 语义） | P18：156/156 落子、PLAYING 写档 0、结算帧恰 1 | — |
| **BD-25** | 前瞻假绿：§8-1 未随首供改期望 | P1 | ⚠️ **建议附条件关闭** | v1.3 已改期望 **16（±0）**；`tray-spawner §8-1` 现文＝16 次(±0)。P20 实测首供 0.0167s + 样本 16，但**闭区间 60s 内 = 15** ⇒ 关单条件 = **BD-27** 的窗口口径裁定 | 主理人裁定「±1 帧量化容差」是否成文；未裁前不得写「完全关闭」 |
| **BD-26** | `accessibility C2` 文档 32px 陈旧 | P3 | ✅ **关闭**（已回写 60px） | P25：`POWERUP_CARD_GAP=60`、相邻卡**边缘间距 [60,60]**、总宽 648 ≤ 750，文档↔实现一致 | 真机误触率 `[Device]` ⛔ |

**处置计数**（v1.1 原计数，保留）：关闭 **11**（BD-01/02/06/07/11/14/20/22/23/24/26）+ 附条件关闭 **2**（BD-03/25）· 部分关闭降级 **4**（BD-04/09/10/13）· 维持开放 **8**（BD-05/05b/12/15/16/17/18/19）· 不可验维持 **1**（BD-08）。（BD-21 文档层关闭、执行层剩余转入 §18 未执行清单。）

> **【v1.2 改判后的口径（仅三项变化，其余沿用）**：BD-05 从「维持开放」→ **部分关闭/降级 P2**；
> BD-05b 从「维持开放」→ **关闭（仅 [N] 结构层）**；BD-20 从「关闭」→ **建议重开**（同一命令反绿）。
> 另新增 **BD-33 / BD-34**（§15.2）。⇒ 按 v1.2：关闭 **11**（20 移出、05b 移入）· 部分关闭降级 **5**
> （+BD-05）· 维持开放 **7**（BD-12/15/16/17/18/19 + 重开的 BD-20 归此计数则 **8**）——**重开项请主理人在台账里单列**，
> QA 不自定计数。

---

## 15. 新缺陷登记（v1.1 顺延 **BD-27..BD-32** ｜ v1.2 追加 **BD-33..BD-34**，见 §15.2）

> 编号沿用 §5 序列，**不与 v1.0 重编**。其中 BD-27/28/30/31 属**判据·文档侧**（移交 GDD/美术/UX 负责人，非实现缺陷），BD-29/32 属**规格互斥·实现语义**类，须主理人裁定。

| 编号 | 标题 | 级别（建议） | 依据（双证据：文档/代码锚点 + 探针实测） | 处置建议 |
|---|---|---|---|---|
| **BD-27** | **判据精度缺陷（非实现）**：`tray-spawner §8-1`「进入 PLAYING 后 60s 内恰 **16** 次（±0）」未定义 ① 计时窗口是**开区间 t<60** 还是闭区间 t≤60 ② 是否接受**帧量化**误差 | **P2** | 文档：回写后 §8-1 只改数值未定窗口语义。探针：P20 首供 0.0167s、相邻间隔 maxDev 0.0167s、样本 16 个，但 **t≤60 闭区间 = 15 次**（第 16 次落 **60.033s**，超界 2 帧） | 请 GDD 负责人补「窗口边界 + 帧量化容差」二句；未补前 P20 记 **PASS\***、QA **不据本条自行关单 BD-25** |
| **BD-28** | **判据不可构造**：`tray-spawner §8-3`（decoys 3:1 加权抽色）在 `DECOY_COLORS_MAX = 0`（systems-index §3 **v1.17** 冻结，D 方案）下**前置不可成立**，而 §8 正文未随 v1.17 回写（T-091 只回写 §8-1/§8-2） | **P2** | 文档：§2.4.6 已自认该条作废、§8-3 仍留原文。探针：P26 构造 `decoys=['4']` 关卡 → **BOOT 拒收**（实测 `phase=boot`，`levels.ts:184` `decoys.length > DECOY_COLORS_MAX`） | 建议 §8-3 标「**作废（v1.17 D 方案）**」或改写为「decoys 恒空时该条平凡真」；P26 记 **⛔ 不可验**而非 FAIL |
| **BD-29** | **规格红线自相矛盾**：`ux-spec §5` 红线「**无 >3Hz 闪烁**」与该表「放错拒绝 = danger 描边**闪 2 次 / 200ms**」互斥（2 次/0.2s ⇒ **10Hz**）；「≤2 次/秒」限定挂在**音效列**而非视觉列 | **P2** | 文档：`design/ux/ux-spec.md:174`（红线）vs `:180`（视觉列「描边闪 2 次」＋音效列「≤2 次/秒」）。探针：`P4`（编号非优先级）实测 wrong 态 danger α **4 档起伏 / 200ms**（＝按表实现的 2 次闪）⇒ 实现忠实于表格、与红线冲突 | **不判实现 FAIL**（实现符合表格行）。移交 UX 负责人二择一：改红线的适用豁免，或把视觉闪烁降频到 ≤1.5Hz；本条影响 `timer §8-10`「同屏叠加无 >3Hz」的可测性 |
| **BD-30** | **裁定措辞与落码不等名**：`ux-spec §6.2/§8 U7` 裁定「`reset()` 后置 `_acc = interval`」，实现采等价但不同名的 `_firstFeed` 标志位 | **P3** | 文档：`ux-spec:217/221/266`。代码：`systems/spawner.ts` `reset()` → `_firstFeed = true`，首 `tick()` 走 `_feedOnce` | 语义等价（实测第 1 帧即供料 ⇒ P2 PASS），**不改判**；建议 §6.2 补注「实现可为 `_acc` 后置或等价首供标志，以后者为准」以免后续轮按字面误报 |
| **BD-31** | **文档同步残留**：`assets-spec.md:106 hud_timer_danger` 仍留 `[待 ux-spec 对齐]`，且 `:187` 尾注「其余 `[待 ux-spec 对齐]` 动效项待 UX 规格产出后回写」已过期（UX 规格 WXG-T-081 早已产出，`:73` hint 占位已按 v1.0 §8 建议删） | **P3** | 核对：`art/assets-spec.md:73`（已删✓）vs `:106`/`:187`（仍在） | 移交美术侧回写删占位；**art/\*\* 本 QA 不改笔** |
| **BD-32** | **实现语义缺陷（附带发现）**：`beads-game.ts:947` 以 `save.data.runs > 0` 判「老玩家」，而 `:949-952` 在**每次 BOOT** 都 `runs + 1` 并落档 ⇒ 玩家**开局即杀进程**再进即被判老玩家、**永久失去引导**（GAP-03 三通道不再出现）；无「引导完成」持久化标记 | **P2**（可访问性/FTUE 承诺未兑现的边缘） | 代码：`beads-game.ts:947-952`（注释自认「必须在自增之前取」，但自增本身仍以 BOOT 计数）。诊断脚本 `evidence/diag-p3-onboarding.mjs`：一次 BOOT 后 `runs 0→1`，再 BOOT 时 `onboarding=false` | 建议以「首次 `bead:placed`」或显式 `onboarded` 标记持久化取代 BOOT 计数。**各 GDD §8 未覆盖此路径 ⇒ QA 不自裁为 FAIL**，探针 `P3`（编号非优先级）记 PASS\* 并登记本条 |

**新缺陷计数**：6 条（BD-27..32）；其中移交 GDD/UX/美术 **4**（BD-27/28/30/31）、移交工程侧 **2**（BD-29 择案后、BD-32）。

### 15.2 v1.2（WXG-T-096 复跑 P5 段）追加：**BD-33 / BD-34**

> 编号从 **BD-33** 起（BD-27..32 已被 v1.1 占用；本仓未用号已核）。两条均由 P5 复跑**附带发现**，
> 均**不**计入任何 A05 条目的 FAIL（避免把「非本判据主体」当音频缺陷）。

| 编号 | 标题 | 级别（建议） | 依据（双证据） | 复现法 | 处置建议 |
|---|---|---|---|---|---|
| **BD-33** | **新增镜像脚本缺 `.ts.meta` 伴生文件，`cocos:check` 不覆盖⇒ 静默漏报** | **P2**（若上真机可升 P1） | 实测：`find games/*/cocos/assets/scripts -name '*.ts'` 逐个查同名 `${f}.meta` ⇒ **3 个无伴生文件**：`games/beads/…/framework/platform/audio-synth.ts`、`games/beads/…/game/config/audio-voices.ts`、`games/breakout/…/framework/platform/audio-synth.ts`（同目录其余脚本一律有）；**同一轮 `cocos:check` 打 ✅** ⇒ 工具覆盖面缺口 | `node -e "...上述 find+existsSync 循环"`（或看 evidence/g4-reverify-v1.2.log §2） | 归工程侧（阮和鸣 / T-082 同族）：跑 `framework:sync` 时一并生成 meta，或给 `cocos:check` 加「镜像脚本必须有 meta」断言。**QA 不自修复**（越只读面） |
| **BD-34** | **面板相位下真指针事件到不了面板按钮（`_readInput()` 只在 `playing` 被调）** | **待定（需 [B]/[R] 定级；若宿主接线则 P1）** | 代码：`beads-game.ts:1147` 是 `_readInput()` 唯一调用点（在 `_stepPlaying` 内）；`paused`（`:919-925`）/`game-over`（`:960-971`）**无 onUpdate**；`input-manager.ts` `endFrame()` 清 `_downThisFrame`。实测（`evidence/diag-p5-fixtures.mjs`，同坐标 375,645、同帧序）：`hitTest()='toggle-bgm'`、`panelInteractive=true`、design↔screen 往返精确，但**经 `InputManager.push` 链**：`bgmMuted=false`、派发=（无）、stop=（无）；**经 `game.tapDesign()`**：`bgmMuted=true`、派发=`sfx_ui_tap`、stop=`bgm_main`。旁证：单测 `pause-settings.test.ts:69-71` 与探针 P22 一律用 `tapDesign` 驱动面板 ⇒ 现有自动化全部踩在“旁路”上，**长期无人测到真链** | 在 paused 相位用真 `input.beginFrame()/push(down,up)/game.update()/input.endFrame()` 序列点面板按钮中心（对比同坐标 `tapDesign()` 生效）| 不判 A05 条目 FAIL：音频派发主体仍成立。但需工程侧裁定口径：若“面板靠宿主转发 touch”是设计，请在 `S9 §8` 与 `input-control §8-8` 写明；若非，则需补 paused/game-over 的输入读取。**当前 `BeadsBootstrap.ts` 未接任何输入 ⇒ 真机是否“点不动面板”只能 [B]/[R] 定论** |

**v1.2 新缺陷计数**：2 条（BD-33/34），**均移交工程侧/主理人裁定**；QA 未改任何 `src/**`。

### 15.3 v1.3（WXG-T-098 三条改判后）：**BD-27..BD-31 处置状更新 + BD-35 候选登记**

> **本小节不改写 §15 / §15.2 的任何历史原文**（那两段是当时的取证现场，按 §18.3-6 惯例只追加）。
> 下表只登记「判据现文变化后各条的现状」，逐条对应 §20.4。

| 编号 | v1.1/v1.2 原状（不改写） | **v1.3 现状（追加）** | 证据 |
|---|---|---|---|
| **BD-27** | P2 判据精度缺陷，待 GDD 补「窗口边界 + 帧量化」二句 | **已裁定 + 已回写 + 已实测闭合 ⇒ 建议关闭**。`§8-1` 现文补齐三行子条（闭区间按名义计数 / 时刻轴 2 帧 / 负偏差 FAIL）；P20 在新口径下 **PASS**（16/16、最大滞后 2.00 帧） | `tray-spawner.md §8-1`；evidence `g4-reverify-v1.3-t098.log` §2/§3 P20 |
| **BD-28** | P2 判据不可构造，待 §8-3 标作废或改写；P26 记 ⛔ | **已裁定 + 已回写 ⇒ 建议关闭（采「作废」而非「平凡真」）**。`§8-3` 现文五子条（作废依据 / 为何不采平凡真 / 交 QA 的 P26 口径 / 复活条件）；P26 维持 **⛔**，另开负向用例 **P26-N PASS**（属 levels 校验，不属 S4） | `tray-spawner.md §8-3`；同上 §3 P26 / P26-N |
| **BD-29** | P2 规格红线自相矛盾（§5 视觉列 vs 红线 >3Hz），移交 UX 二择一；P4 记 PASS\* | **转态，不关闭**：规格互斥半边已由 §5 视觉列改写为**单次脉冲 + 500ms 重启门**而**消解**；本单实测新预期值 ⇒ P4 **FAIL**（峰点 2=10Hz、间隔 100ms）。故 BD-29 = **「实现落差」**（旧实现与新规格之差），**非新回归、不占新号**；改码已立项 **WXG-T-102**（`production/TASKS.md:43`，📋 待排期） | `ux-spec.md §5:174/180/201`；同上 §2/§3 P4 |
| **BD-30** | P3 裁定措辞与落码不等名（`_acc=interval` vs `_firstFeed`），待 §6.2 补注 | **已回写 ⇒ 建议关闭**。`ux-spec §6.2:230` 现文给出**等价口径**：(i) 型滞后 1 帧 / (ii) 型滞后 2 帧 ⇒ §8-1 上界取 2 帧；P2/P20 实测「首供 1 帧、周期 2 帧」与之吻合 ⇒ 不再按字面误报 | `ux-spec.md §6.2`；同上 §3 P20 |
| **BD-31** | P3 文档同步残留：`assets-spec:106/:187` 仍留 `[待 ux-spec 对齐]` | **已回写 ⇒ 建议关闭（本半边）**。`:106` 占位经 T-098 删除并改写为「周期/时长以 `ux-spec §5` 为权威」；`:187` 尾注同步。**但**该次核对**新暴露 α 幅度缺定义 ⇒ 顺延为 BD-35 候选**（见下表） | `assets-spec.md:106/:187`；本小节下表示意 |
| **BD-32** | P2 实现语义缺陷（引导可达性），待工程侧 | **本单未触碰 ⇒ 原状维持**（P3 仍 PASS\*） | — |

**BD-35 候选（登记进顺延区；编号待主理人核未用号后正式赋予）**

| 编号 | 标题 | 级别（建议） | 依据（双证据） | 处置建议 |
|---|---|---|---|---|
| **BD-35**（候选） | **判据缺数值**：`ux-spec §5:187`「倒计时告急」视觉列只写「danger + **1000ms α 脉冲循环**」，**未定义 α 幅度**（起止值 / 峰值），导致该条 `[N]` 层只能验「有无周期脉冲」而不能验「脉冲到不到 1.0」 | **P3**（判据不完备，非实现缺陷） | 文档：`ux-spec.md:187` 现文 vs `art/assets-spec.md:106`（林绘澄 WXG-T-098 核对后明文「**α 幅度两文均未定义 → 本表不自行发明**」，并已删 `[待 ux-spec 对齐]` 占位）。探针：P7/BD-10 该子句现按「脉冲存在 + 周期≈1000ms」取证，**未对 α 幅度断言** ⇒ 记 PASS\* 而非 PASS | 移交 UX 负责人（文策渊）在 §5 告急行补「α x↔y」一处数值；补齐前 QA **不猜值**，P7 维持 PASS\* 并把该半边写成「待判据」；**QA 与美术侧均不自造常量** |

> 另：本小节提到的 `levels-spec.md:23/:42` 仍写 `DECOY_COLORS_MAX=2`（与 §3 v1.17 冻结值 **0** 陈旧不一致）属**同一族的文档同步残留**，登记为**观察 O4**（§20.7），是否升格编号由主理人定，QA 不自行占用 BD 号。

---

## 16. §8 八项冲突关闭标记 + 探针自身缺陷自查

### 16.1 v1.0 §8 移交的 8 项判据冲突 → 复验轮关闭标记

> T-091（WXG-T-091）按 v1.0 §8 建议回写了 7 项。本轮**逐个到文档现文核对**（不是“文档说已回写”就算——而是把新预期值写进探针实跑，能跑出判据结论才算关闭）。

| # | 冲突 | v1.0 建议 | **v1.1 状态** | 复核依据 |
|---|---|---|---|---|
| 1 | `input-control §8-2` vs `§8-4` | §8-2 补「重叠区以 §8-4 为准」 | ✅ **关闭** | §8-2 现文已含该句；P9 全段实测（0/12/25 → 本格，27/32/33 → 邻格）无歧义。**BD-23 关** |
| 2 | `tray-spawner §8-2` ±20% | 改卡方（同 powerups 判例） | ✅ **关闭** | §8-2 现文＝拟合优度卡方；P12 实跑 **χ²=5.32 < 19.675（df=11）**。同批数据旧口径最大偏差 28.0% ⇒ 实证了误报本征。**BD-22 关** |
| 3 | `save-progress §8-9` 200 次 | 改「≤ 最大可构造量」 | ✅ **关闭** | 现文＝**注入 156 落子**；P18 实测 156/156。**BD-24 关** |
| 4 | `tray §8-1` / `core-loop §8-2` | 期望显式 **16（±0）** | 🔶 **半关闭** | 数值已回写且 v1.3 用例已同步；但**计时窗口开/闭区间与帧量化容差未定义** ⇒ P20 只能记 PASS\*。**BD-25 附条件・新增 BD-27** |
| 5 | `accessibility D1/E2` ↔ `pause-settings §2.2` ↔ `ux-spec §3.3` 三文档冲突 | 甲/乙/丙择一 | ✅ **关闭**（裁定已落码） | save **v1→v2**、`settings.reduceMotion/largeText`、暂停面板行3（`pause-panel.ts:126-129`）；P22/P23 实测开关可拨、逐通道退静态、落档与二次装配回显。**BD-09 仅剩 A2b/A3/C1** |
| 6 | `save-progress §8-9`「结算帧」是否含失败帧 | 明确＝`level:cleared` 帧 | ✅ **关闭** | 现文已绑定 `level:cleared`；P18 实测该帧累计写档恰 1。失败帧零写档作为**事实保留**（与 §8-2 一致，不判缺陷） |
| 7 | `assets-spec §1.2` `hint` 行 `[待 ux-spec 对齐]` 占位 | 美术侧回写删占位 | 🔶 **目标项关闭，同类残留新开** | `assets-spec.md:73` 实测**已删** ✓；但 `:106 hud_timer_danger` 仍挂同类占位、`:187` 尾注已过期 ⇒ **BD-31** |
| 8 | `accessibility C2` 32px vs 实现 60 | 回写文档 | ✅ **关闭** | 现文＝**60px**；P25 实测相邻卡**边缘间距 [60,60]**、总宽 648 ≤ 750。**BD-26 关** |

**小结**：8 项中 **6 项关闭 + 2 项半关闭**（#4 窗口口径、#7 同类占位残留）；复验轮另**新增 3 项需移交裁定**的规格侧问题：BD-28（§8-3 未随 v1.17 回写）、BD-29（§5 红线与表格互斥）、BD-30（裁定措辞与落码不等名）。QA 均不自裁。

### 16.2 探针自身缺陷自查（复验轮 **13 处**，与实现缺陷严格分开登记）

> 任务书铁律：「严防再造 v1.0 §7 的 13 处」。下列 **13 处均为本轮实跑才抓到的探针自身缺陷**（若不修正会直接伪造出门禁结论）；对应 `g4-probe-v1.1.mjs` 头注修订 15bis (a)-(g) 与修订 18/22/23/26/27。

| # | 位置 | 缺陷 | 若不修的后果 | 修正 |
|---|---|---|---|---|
| a | P3/P4 | `game.snapshot` 是**每帧复用的活对象**，把引用留到 `rec()` 才读 | **假 FAIL**（wrongProgress=0、hint=(-1,-1)） | 当场拷标量 |
| b | P9 | 热区探针**忘先选珠** | **假 FAIL**（命中 `beads-game.ts:1371` 无选中直接 return ⇒ 全 none） | 先 `giveTrayBead + selectTraySlot` |
| c | P11 §8-9 | `routed` 统计了**全部**订阅事件（含 `tray:spawned`） | **假 FAIL**（双指同帧恒 >1） | 只计输入路由产物三类 |
| d | P12 | 事件游标写错（`slice(got)`）且不排水 ⇒ 样本被「空闲槽集变化」污染 | **假 FAIL**（χ² 被伪做到 760） | 沿用 v3 修订 3 白盒排水夹具 |
| e | P22 D1 | 三通道实例**未预置 reduceMotion**（用默认实例） | **双向假结论**（测的是「动画态是否静态」） | 每通道实例预置 `settings.reduceMotion=true` 走读档回显 |
| f | P22 wrong 描边 | 在 **fx 窗口后**才取（`WRONG_FX_MS=200ms` 已过） | **假 FAIL**（环数恒 0） | 窗口内取最大值 |
| g | P10 | 以「点击前一帧 vs 后一帧签名不等」判“有轻提示” | **假 PASS**（被 hint 呼吸/首珠脉冲伪满足；v1.0 此处即中招） | 改**同 seed 配对差分**⇒ 实测 false，诚实 FAIL |
| h | P13 | 把 `screenToDesign` 的 y 翻转读作「缺陷征候」；且反向钉用 `containsScreenPoint`（在 screen=design 的 stub 下恒不成立） | **判据误读 + 假 FAIL** | 改双向往返一致 + device-px 喂入必错位（偏离 522.6px）+ 端到端命中 |
| i | P20 | 不自动落子 ⇒ `demand=0` 后供料被跳过，16 次压成 12 次 | **假 FAIL** | 自动落子循环保持 demand>0；时基从进 PLAYING 那帧起算 |
| j | P22/P23 暂停面板 | 按 `rect.x + rect.w/2` 取中心，而框架实为 `PanelRect{xMin,yMin,xMax,yMax}` | **假 FAIL**（NaN 点击，开关永远打不开） | 用 xMin/xMax 求中心 |
| k | P6/P7 | 满槽当帧就停采样，未跨过下一个 2.0s 供料间隔 ⇒ `tray:full=0` 被读作「事件缺失」 | **假 FAIL**（误报去重失效） | P7 满槽后 `advance(2.2)`；P6 删该子句断言（一处一事，由 P12 取证） |
| l | P9（二） | 同一实例连测 11 个偏移 ⇒ 首落后目标格被占且托盘灌满（`giveTrayBead` 返回 -1） | **假 FAIL**（仅首偏移命中） | 每偏移一个干净实例 |
| m | P9（三） | 要求 `dx=BEAD_PITCH/2=26` 必属右格 | **假 FAIL**（§8-4 对**等距并列点**无定义） | 拆为 `tie` 只记录归属（实测归左格），不判否 |

> **分类计数（共 13 处）**：会造成**假 FAIL** 的 10 项（a b c d f i j k l m）· 会造成**假 PASS** 的 1 项（g）· **双向假结论** 1 项（e）· **判据误读兼假 FAIL** 1 项（h）。
>
> 另有 **8 处预防性口径收紧**（未在实际运行中造成误判，但按 v1.0 §7 教训提前修）：修订 14（旧预期值换 §8 现文）、15（P1 弱断言改逐色独立复算）、16（不以 `CellState` 无 hint/wrong 判实现缺失）、17（动效断言剔 text + 取 α 极值推周期，不取签名种数）、19（P11 走真实 InputManager）、20（A′ 探针不用 `giveTrayBead`）、21（满槽态自然灌注）、24（判据不可构造记 ⛔ 不记 FAIL）。

**结论可信度声明**（v1.1）：本报告 §13 的 4 条 FAIL **均有代码级铁证（文件:行号）+ 探针实测双重支撑**；所有“文档声称已修”的项（GAP-01..10 / D1 / E2 / ADR-0011 / ADR-0012）均已经探针重测后才改判；`[Cocos]/[Device]/[R]` 道次一律维持 ⛔，未因“Node 全绿”而抬升任何综合结论。

> **【v1.2 追加的探针自身缺陷（5 处，与实现缺陷严格分开记账）】**——详见 §19.6，对应探针头注修订 35 / 36 / 37：
> ① 自造关卡 5×4 / 2 色被 BOOT 拒收⇒ 8 条 A05 连锁假 FAIL；② `clearAudio()` 内部 `flush(0)` 抹账⇒ A05-21 恒 0；
> ③ 面板驱动口径错（走 InputManager 链）⇒ 与 BD-34 纠缠；④ P4 正则被子串 `AUDIO_CLIP_DISSOLVE` 命中⇒ **假绿**；
> ⑤ A05-14 判定与正文自相矛盾（头 PASS / 正文写 PASS*）⇒ 已收紧为 PASS*。
> **其中 ①②③ 会造成假 FAIL（已修）；④ 会造成假绿（已修）；⑤ 是判定偏松（已收紧为 PASS*）。**

---

## 17. §G 20 条可感知判据——本轮可验道次结论（`test-cases.md` v1.3 §G）

> 口径：本表**不给单一总评**，而是逐条拆「本轮实跑道次」与「仍缺道次」，避免「Node 绿 = 整条绿」的越级推定（= v1.0 假绿谱系的根治纪律）。

| ID | 判据（缩） | 探针 | **本轮实跑道次结论** | 仍缺道次 |
|---|---|---|---|---|
| TC-PER-01 | 空槽可辨目标色（E1+E3+E4） | P1 | ✅ `[Probe]` **PASS**（三色独立复算 + 22/22 幽灵 α0.2） | `[Cocos]` 肉眼比对 / 色盲模拟 ⛔ |
| TC-PER-02 | 开局 ≤1.5s 已有珠 + 槽脉冲 | P2 P3 | ✅ `[Probe]` **PASS**（第 1 帧供料；首珠槽 `guideSlot` 环×2、600ms） | `[Cocos]` 首屏截图 ⛔ |
| TC-PER-03 | 0 文字下引导可被理解 | P3 | ⚠️ `[Probe]` **PASS\***（三通道图元均存在且行主序正确） | `[Cocos]` 盲测复述 + `[Device]` 真人 FTUE ⛔；**BD-32** 待裁 |
| TC-PER-04 | 四类 VFX 各自可观察 | P4 | ⚠️ `[Probe]` **PASS\***（2/4 类可观察：落座 + 放错） | 溶解/波浪未实现（TC-PER-11/12）；`[Cocos]` 逐帧 ⛔ |
| TC-PER-05 | 关键事件音效与动效同帧 | P5 | ❌ `[Node]` **FAIL**（clip 去重 2 种；清单 3/19）。【v1.2 → 🔻 **`[N]` 派发层 PASS/PASS\*为主、整条未闭**：见 §19.3（A05-01…24）】 | `[B]/[P]/[R]` ⛔（【v1.2】不再是“因为无后端”，而是“本环境无可听/录音通路”） |
| TC-PER-06 | 尾盘存在可见的非重置出口 | P6 P21 | ✅ `[Probe]` **PASS**（U8 拍板后判据形态＝「合法供料下死局不可达」：死珠 0 / 违规 0） | `[Cocos]` 死局观察者问句 ⛔（但死局本身已不可构造） |
| TC-PER-07 | 告急脉冲 + 满槽告警可观察 | P7 | ⚠️ `[Probe]` **PASS\***（告急半边 **PASS**；满槽描边呼吸 **零通道**） | `[Cocos]` 连拍 ⛔；满槽半边转 BD-10 残留 |
| TC-PER-08 | `hint` 态可见 + D1 下保留静态描边 | P19 P22 | ✅ `[Probe]` **PASS**（`accent_blue` 2px 环×2；D1 开启后呼吸停、蓝描边仍保留） | `[Cocos]` 连拍 4 帧 ⛔ |
| TC-PER-09 | 落座回弹 1.06→1.0 / 120ms | P4 | ⚠️ **PASS\***（剔 text 签名去重 2 ⇒ 有时间轴；**未逐值断言 scale 曲线**） | `[Cocos]` 连拍 3 帧 ⛔ |
| TC-PER-10 | 放错 ±3px×2 + danger 闪 2 次 / 200ms | P4 | ⚠️ **PASS\***（位移峰得 **±2.6px**、换号 2 次；danger α 4 档） | 峰值得低于 3px 系**帧采样相位错过**，不作 FAIL；须 `[Cocos]` 连拍定精度；**BD-29** 红线互斥待裁 |
| TC-PER-11 | 消除溶解 scale→0.6 / 200ms | P4 | ❌ **FAIL**（tuning 常量命中 0，仍为瞬时移除） | — |
| TC-PER-12 | 完成波浪 20ms/列・800ms | P4 | ❌ **FAIL**（无 clear-wave 代码路径） | — |
| TC-PER-13 | 色盲模拟下 3–8 色可辨 | — | ⛔ **不可验**（实现半边已具备，但**无滤镜与截图通路**） | `[Cocos]` + R2/R3 手段（阻塞已从「三重」降为「一重」） |
| TC-PER-14 | 灰度下 6 状态可辨 | P1 P4 P19 | ⛔ **不可验（但前置已解除）**：`empty/filled/locked/hint/wrong/selected` **六态本轮均可构造**（v1.0 仅 3 态） | `[Cocos]` 灰度截图 ⛔ |
| TC-PER-15 | 音频清单闭合（== 19 id） | P5 | ❌ `[Node]` **FAIL**（3 vs 19，A05-24 不闭合）。【v1.2 → ✅ **PASS**：四方对账 19/19/19/19、孤儿常量与直写字面量均 0（A05-24，§19.3）】 | —（本条 `[N]` 已闭） |
| TC-PER-16 | 静音可玩 | — | ⛔ **本轮未排**（且 `NullAudioBackend` 下「静音与无声不可区分」，v1.3 已注即使 PASS 也不得作音频证据）。【v1.2 → ✅ **已排且 PASS**（A05-23：sfxMuted 门控 / 双通道独立 / 8 关+冲刺+续时零阻塞）——但因后端已非 Null，“静音不致否”不再平凡真，本条从「不可评」变「可评且已过」】 | 出声层面的「真静」仍属 `[B]/[R]` |
| TC-PER-17 | 告急周期 1000±50ms 且 ≤3Hz | P7 | ✅ **PASS**（实测 **1000ms = 1.00Hz**；v1.0 的 ⛔「主体缺失」已不成立） | `[Cocos]` 连拍 8 帧 ⛔ |
| TC-PER-18 | 满槽告警描边呼吸 500ms + 轻提示音 1 次 | P7 | ❌ **FAIL**（`tray:full=1` 且去重✓，但描边呼吸零通道：60 帧非文本签名去重 = 1）。【v1.2：音频半边已绿（A05-14 派发 1 次且不循环），故本条的**唯一残留 = 视觉呼吸半边（BD-10）**⇒ A05-14 记 PASS*，见修订 37】 | ~~音频半边 ⛔（BD-05）~~ → 只剩视觉半边 |
| TC-PER-19 | 引导终止：首落子即清；`runs>0` 永不重现 | P3 + diag | ✅ **PASS**（① 首落后图元数归 0 ② 预置 `runs=1` 冷启后引导图元恒 0，`diag-p3-onboarding.mjs` 实测） | —（但判据**意图**与实现同受 **BD-32** 争议，需 UX 确认） |
| TC-PER-20 | 首屏两锚点（1.5s 有珠 / ~5s 首落座） | P2 P20 | ⚠️ **PASS\***（1.5s 锚点✓（第 1 帧）；5s 锚点需自动落子夹具才成立，已在 P20 循环下成立） | `[Cocos]` load→1.5s→5s 三张截图 ⛔ |

**§G 本轮分布**：`[Probe]/[Node]` 道次全过 **6**（PER-01/02/06/08/17/19）· 部分过（PASS\*）**6**（PER-03/04/07/09/10/20）· 不过 **5**（PER-05/11/12/15/18）· 不可验 **3**（PER-13/14/16）。

> **与 v1.0 的关键变化**：v1.0 §G 为 **FAIL 14 / ⛔ 4 / 待执行 2**，其中 **12 条属「取证主体不存在」**（画面上根本没有可测对象：PER-01/02/03/04/06/07/08/09/10/11/12/20）；本轮该数字降为 **0**——剩下的 5 条 FAIL（音频 PER-05/15、VFX 两行 PER-11/12、满槽告警 PER-18）与 3 条 ⛔（像素/色盲/静音道次）**均有可测对象或属通路问题**，而非“画面上没有东西”。这是 GAP-01/02/03/04/10/11 修复的最实质收益。

---

## 18. 建议裁定 + 剩余阻塞清单 + 建议下一动作

### 18.1 建议：**G4 = CONCERNS**（非 PASS、非 FAIL）

**不判 FAIL 的理由**：

1. **零 P0 开放缺陷**：v1.0 的 **8 项 P0**（BD-01/02/03/04/06/07 + 流程 BD-14 + 阻塞 BD-20）全部关闭或附条件关闭：其中 BD-01/02/06/07/14/20 有**探针他证**确认，BD-03 附条件（随 BD-32）、BD-04 降级 P2（余两类 VFX）；主链路（开局→选珠→落子→消除→过关）在 Node/探针下全程可跑且 8 关可达（P24）。
2. **零新回归**：`pnpm run verify` 14 项 EXIT=0、**677 测试全绿**（beads 198）；4 项 FAIL 与 v1.0 严格同集（P5/P8/P10/P17 → BD-05/15/16/12），均在波次 2 任务书范围外。
3. **判据真源已对齐**：§8 八项冲突中 6 项关闭，探针预期值全部改取回写后现文（16±0 / 卡方 / 156 / §8-4 / 60px）。

**不能判 PASS 的理由（五条，任一即足）**：

1. **可证面天然残缺**：§G 20 条中 **3 条仍 ⛔**（像素/色盲/真机），`[Cocos]/[Device]/[R]` 全部道次未验 ⇒ 「表现层可感知判据」只证到**指令流层**，未证到**屏幕层**（GAP-09 假绿教训的直接对应面）。
2. **G3 包体门对 beads 实质未执行**：无 `wechatgame` 产物，`check:size` 静默 skipped 却打 ✅（**BD-18**）⇒ 4096KB/2000KB 红线**今日无数据**。
3. **两处结构性假绿风险未修**：**BD-17**（`verify` 仍 `&&` 串联 14 项，本轮 EXIT=0 只因无失败项）+ **BD-18**。这属“门禁本身不可信”，与 v1.0 判 FAIL 的流程根因同类。
4. **可访问性承诺仍有未兑现项**（`bug-severity` 明定 P1）：`accessibility A2b/A3`（色盲/灰度）无取证、`C1` 无对象（`btn_expand` 仍不存在）、满槽告警仍靠单通道（BD-10 残留）。
5. **判据侧尚有 3 项未裁**（BD-27 窗口口径 / BD-28 §8-3 作废未回写 / BD-29 红线互斥）⇒ **BD-25 不能关单**，P20 只能停 PASS\*。

> 一句话：**修复是真实的、且可复核；但“可发”还差取证通路与门禁自身的可信度**。本 agent 只给建议，**PASS/CONCERNS/FAIL 的正式裁定请主理人在编排层做出**；若主理人接受「按可证面范围阶段性放行」（例：G4 = CONCERNS 但允许进入波次 4 / Playtest 降级轮），建议显式写下放行范围与上述 5 条的限制声明。

### 18.2 剩余阻塞清单（逐条：谁做什么才能解除）

| # | 阻塞项 | 影响 | 解除条件 | 责任 |
|---|---|---|---|---|
| B1 | `[Cocos]` 像素取证通路（无头截图 + 色盲/灰度滤镜） | §G 10 条像素半边 + TC-PER-13/14 整条 + P15 真实栅格化 | 提供截图脚本与命名约定（v1.0 §10.2 **R2/R3** 原样沿用） | T-082 / 主理人 |
| B2 | beads 无 `wechatgame` 产物 ⇒ **G3 包体无数据** | 主包红线不可证；BD-18 假绿持续 | 授权执行 `pnpm --filter beads run build:cocos`（本 agent readonly **未代跑**） | 主理人授权 → T-082 |
| B3 | `verify` 短路（BD-17）+ `check:size` skipped 静默（BD-18） | 任一后续轮都可能“全绿但漏门” | 改逐项收集 + 汇总退出码；skipped 至少打 WARN | ~~T-082~~ → **已解除（WXG-T-095）**：`verify-all.mjs` 永不短路 + `STATUS: OK\|SKIP\|FAIL` 契约 + SKIP 打 WARN 清单；自测 `pnpm run verify:selftest` / `check:size:selftest` |
| B4 | 真机 + AppID | 所有 `[Device]/[R]`（触摸事件序、ES5 运行时、包体实况、FTUE） | 微信开发者工具 + 扫码真机 | 用户 / 主理人 |
| B5 | 音频：BD-05（19 clip + 同帧派发）/ BD-05b（三平台 backend） | TC-PER-05/15/18 半边 + Playtest「解压/治愈」必记 BLOCKED | 框架侧 backend + 游戏侧 clip（**真机到位也不解除**）。**【v1.2：代码侧两项均已落（BD-05b 在 [N] 结构层关；BD-05 降级 P2）。B5 剩余 = `[B]/[C]/[R]/[P]` 取证通路 + A05-25 包体（卡在 BD-20 重开 / BD-33）+ 三总线增益 §3.12 [TODO] 数值，见 §19.5】** | 框架侧 + T-085 同族 → **【v1.2】转主理人排取证轮** |
| B6 | BD-15 扩展入口 / BD-16 轻提示 / BD-12 meta 字段 / BD-04 余两类 VFX / BD-10 满槽告警 | §8-1 一类路由仍缺；`input-control §8-7` 零反馈 | 列入波次 4（均为 P1/P2，不阻断主链路） | 工程侧 |
| B7 | 判据裁定：BD-27 / BD-28 / BD-29 / BD-30 / BD-31 / BD-32 | 分别卡住 BD-25 关单、P26 可验性、闪烁红线一致性、后续轮误报 | GDD/UX/美术各自回写（QA 不自裁） | 文策渊 / UX / 美术 |
| B8 | `preview:frames` 不支持 beads（BD-19/BD-13 残留） | 帧预览与回归图无法入证据包 | 脚本去 breakout 硬编码 + `--game` 透传 | T-082 |

### 18.3 建议下一动作（排序由主理人定）

1. **先修门禁自身**（B3，成本最低、收益最大）：否则任何“绿”都需人工反推链路是否跑完。
2. **授权补 beads `wechatgame` 产物**（B2）：把 G3 从「静默未测」变为真数据；顺带验 ES5 产物层（P24 的 `[R]` 半边仍待真机）。
3. **波次 4 工程单**：BD-15（扩展入口，连带 `accessibility C1` 有对象）+ BD-16（轻提示，hint 通道已就绪，改动极小）+ BD-04 余两类 VFX + BD-10 满槽告警半边。
4. **B7 六项裁定一次性打包**给 GDD/UX/美术（避免逐轮反复）；其中 **BD-32** 建议随 `ux-spec §5` 引导终止行一并重定（改成「以首次 `bead:placed` 为准」）。
5. **Playtest**：按 v1.0 §9.2 M2 最小配置先跑「视觉单通道可玩性」降级轮（音频维度记 BLOCKED）；**不得**对「解压/治愈」下 PASS（`audio-spec §5` 铁律）。
6. **证据归档**：本轮新增的 `diag-*.mjs` 保留为回归可复跑夹具；下轮若改 §8 预期值，**先改探针再跑**，并在头注继续累加修订号（本文件惯例：v3 到 13、v1.1 到 27）。

### 18.4 本 agent 本轮受 readonly/沙箱限制而**未执行**的写操作（需主理人拍板）

- `pnpm --filter beads run build:cocos`（会写 `games/beads/cocos/build/wechatgame/**`）——属 `production/qa/beads/**` 写权限外的工程产物，**未代跑**。
- `knowledge/lessons.md` 条目（GAP-09 假绿谱系 + 本轮「指令流层可证 ≠ 屏幕层可证」教训）——按硬约束**只给建议不落盘**。
- 未改 `src/`、`design/`、`art/`、`systems-index §3`；发现的 6 项文档/规格漂移（BD-28/29/30/31/32 与 P19 分层注）**均只登记不改笔**。

### 18.5 主理人裁决（编排层追加 · 2026-09-15 · WXG-T-094）

> 本节由主理人撰写，**不改写 §12–§18 任何 QA 原文**；追加式，与 §18.1 建议并存以留谱系。

**裁定：G4 = CONCERNS**（采纳 §18.1 建议）。裁定权属编排层（`my-skills/wxgame-orchestration/SKILL.md`），G 门证据由严守真产出。

**一句依据**：波次 2 的修复经探针**他证**成立（v1.0 的 8 项 P0 全关或附条件关、零新回归、4 项 FAIL 与基线严格同集），故不判 FAIL；但可证面只到指令流层、G3 包体门对 beads 无数据、门禁自身仍有两处结构性假绿（BD-17/18），故不判 PASS。

**放行范围（显式，越界即视为绕过质量门）**：

| ✅ 放行 | ⛔ 不放行 |
|---|---|
| 波次 4 全部工程与裁定单（**T-095..099**） | **阶段 7 发布**：beads 无 `wechatgame` 产物 ⇒ 主包红线不可证 + `[Cocos]/[Device]/[R]` 全道次未验 |
| **Playtest M2 降级轮**（波次 4 尾；音频维度必记 BLOCKED） | **每日挑战**扩范围评审：既定裁定为「G4 复验 **PASS** 前不评」，本轮是 CONCERNS ⇒ 仍不评 |
| 波次 2/3 已交付修复的代码级冻结（不回炉） | 对「解压 / 治愈」支柱下任何 PASS（`audio-spec §5` 铁律；T-096 前静音不可评） |

**限制声明（五条，任一未解除即不得升 PASS —— 与 §18.1 同源，此处为放行台账）**：

1. 表现层「可感知判据」只证到**指令流层**，未证到屏幕层（§G 仍 3 条 ⛔：像素 / 色盲 / 真机）。
2. beads 主包**红线（4096 KB）今日无数据**；只有 web-mobile `du -sk` 代理值 1968 KB（内部目标 2000 KB）——两口径不得混用。
3. **门禁自身不可信**未修：BD-17（`verify` `&&` 短路）+ BD-18（`check:size` 缺产物静默 ✅）⇒ 列为波次 4 **第一位**（T-095）。【裁决后更新：已由 **WXG-T-095** 修到，见本节末】
4. 可访问性承诺仍有未兑现项：A2b/A3 无取证、C1 无对象（`btn_expand` 仍不存在，随 BD-15）、满槽告警单通道（BD-10 残留）。
5. 判据侧 **BD-27/28/29 未裁** ⇒ **BD-25 不关单**，P20 停 PASS\*、P26 停 ⛔（随 T-098 一次性打包）。

**对 §18.2 阻塞项 B2 的事实修正**（登记，不改 QA 原文）：B2 的解除条件**不是**「主理人授权代跑 `build:cocos`」。`tools/scripts/build-cocos.mjs` 头注（2026-09-14 实测）明载：**默认 `wechatgame` 平台需要有效 AppID 才能构建成功**，本环境可自动化的是 `--platform=web-mobile`（beads 产物已存在，且正是 1968 KB 代理值的来源）。⇒ B2 实际**挂在 B4（用户侧 AppID）之下**；本环境能做的只有「把『缺产物』从静默 ✅ 改成显式 SKIP + WARN」，即 T-095，红线实测数据待 AppID 到位一次取。

**升 PASS 最小集**：T-095（门禁可信度）+ T-098（BD-27/28/29 回写 ⇒ BD-25 关单）+ T-099（`[Cocos]` 像素/色盲取证通路 + §H 缺口进探针）+ **AppID 到位后**的 `wechatgame` 产物包体实测（B4）。音频（T-096）不阻塞 G4 数字面，但阻塞「解压/治愈」支柱评估与 Playtest 音频维度 ⇒ 排 G4 升 PASS 之前优先做。

**裁决后续更新（追加式 · 不改写上方原文）**：

- **WXG-T-095**（2026-09-15）：限制声明第 **3** 条解除——`verify` 改逐项聚合（永不短路 + `STATUS` 契约 + 汇总退出码），`check:size` 逐游戏覆盖面且缺产物报 **SKIP 非 OK**。⇒ 自本单入库起，“`pnpm run verify` 绿”的含义从「首个失败项之前的若干项跑过」变为「**14 项全部跑过且无 FAIL**」；以往各轮报的 ✅ 需按此口径回看（详见 §14 BD-17/BD-18 行、§18.2 B3）。
- **未因本单改判 G4**：限制声明第 **2** 条（beads 主包红线无数据）**依旧成立**——修的是“把静默假绿改成显式 SKIP”，不是替 beads 测出体积。G4 仍为 **CONCERNS**，升 PASS 剩余集：T-098 + T-099 + AppID 后的实测包体。


---

# P5 音频段复跑（v1.2 / WXG-T-096 · 严守真）

## 19. P5（音频）段复跑：预期值重建 + 重跑 + 改判

> **本节是 v1.2 的全部新增内容**。执行的是 WXG-T-096 任务书 Deliverable ⑤：
> 「**先改探针 P5 段预期值，再复跑**」。只读面：本轮只改 `production/qa/beads/` 下的探针与本报告、
> 只写 `production/qa/beads/evidence/`（外加 gitignored 的 `dev/harness/{dist,.smoke}`）；
> **未改** `games/beads/src/**`、`packages/framework/src/**`、`games/beads/design/**`、`production/TASKS*.md`、`memory/**`；未 commit / push。

### 19.0 一句话结论

P5 段 28 条判据在 **[N] 派发层 + 结构层** 实测成立：**PASS 12 / PASS\* 8 / FAIL 0 / ⛔ 8**；
v1.1 那句「玩法事件零音效派发」已成**假 FAIL**（前提被 T-096 推翻），但「能出声 / 听感达标 / 已进包」**一条都没有被本轮证明**。

### 19.1 为什么必须先改预期值（否则做成假 FAIL）

v1.0 / v1.1 的 P5 判据是把「结果」写死的：探针里 `rec('P5 / BD-05 · …', 'FAIL', …)` **第二参硬编码**，
证据串也只查两件事——① `audio.play` 收到的 clip 去重是否为 `[bgm_main, sfx_ui_tap]`，② 三平台是否仍 `NullAudioBackend`。
T-096 之后：

| 旧前提（v1.1 写下） | 本轮实测到的事实（同一条命令、同一环境） |
|---|---|
| 玩法事件**零**音效派发 | 11 类玩法事件逐条有派发（A05-01…A05-20），例如真帧点击落子 ⇒ 派发 `[sfx_place]`（A05-01） |
| `tuning.ts` 只定义 **3** 个 clip，§1 要求 19 ⇒ 清单不闭合 | **19/19/19/19** 四方对账相等，孤儿常量 0、绕过常量直写 id 0（A05-24） |
| 三平台 backend 均 `NullAudioBackend`（真机到位也不解除） | `audio-synth.ts` 存在；web+voices→Synth、weapp+能力→Synth、node→Null（护单测）（P5/S） |

⇒ 沿用旧预期值复跑 = 把「判据更新」做成「缺陷」，违反探针修订 14 与 `AGENTS.md` 反假绿纪律。**处理方式**：
判定一律由实测算出（`rec()` 第二参不再是字面量），并按 `audio-events.md §4` 逐条重建断言。
**方向自查**：本轮同时**收紧**了 2 处（A05-14 由 PASS→PASS\*，P4 正则由假绿→逐字回到 v1.1），不是单向放宽。

### 19.2 命令与计数（可复核）

| 命令 | 结果 |
|---|---|
| `pnpm run harness:build`（**前置**，非可选） | ✅ build ok。理由：开跑前 `dev/harness/dist` 比 T-096 源码旧 38 分钟 ⇒ 不重建则探针量的是 **T-096 之前的字节**。新鲜度由探针内 `sRes.fresh.ok` 机验（最终轮 dist=06:05:47.033Z ≥ src 最新 mtime=04:05:18.473Z UTC） |
| `node production/qa/beads/g4-probe-v1.1.mjs` | **EXIT=0**，53 组：**PASS 25 / PASS\* 16 / FAIL 3 / ⛔ 9**；其中 **P5 段（28 条）= PASS 12 / PASS\* 8 / FAIL 0 / ⛔ 8**，其余 25 组 = 13 / 8 / 3 / 1 ⇒ **两段计数不得合并解读** ⇒ evidence §1 |
| 同命令独立二次运行 | 与首轮 **除时间戳行外零差异**（`evidence/g4-reverify-v1.2-rerun-consistency.log`） |
| 其余 25 组 vs v1.1 | **判定 25/25 逐条一致**；证据文本 **24/25 逐字相同**，唯一实质差异 = P19 的 hint 目标格坐标 `r0,c1 → r3,c4`（供料时序变化，判定仍 PASS）⇒ 这是**回归对照**，**不是**重新复核预期值 |
| `pnpm run verify` | **VERIFY_EXIT=1**：**PASS 12 / SKIP 1（`check:size`，beads 无 wechatgame 产物）/ FAIL 1（`framework:sync:check`）** ⇒ **与 WXG-T-096 任务书自述的「13 PASS / 1 SKIP」不一致**（未通过项被点名，聚合器不短路 ⇒ 14 项确已执行）⇒ `evidence/g1-g3-verify-v1.2.log` |
| `node tools/scripts/sync-framework-to-cocos.mjs --check` | **EXIT=1，12 处 differs**（beads/breakout 各 6：`core/audio/audio.ts`、`platform/{audio-synth,node,platform,weapp,web}.ts`）⇒ 这是 v1.1 判 **BD-20 关闭** 的同一条依据，现已反绿 ⇒ 见 §19.5 与 §14 BD-20 行 |
| 单测（verify 链内） | framework **255** / beads **224** / breakout **239** = **718 全绿**（v1.1 为 677，+41 = 本单 `audio-synth.test.ts` 15 + `audio-dispatch.test.ts` 26）。**按修订 33：单测绿不替代探针他证，反之亦然** |
| 只读诊断 | `node evidence/diag-p5-fixtures.mjs` ⇒ 区分「探针夹具缺陷」与「实现缺陷」（evidence §4） |

### 19.3 P5 逐条改判表（27 条 A05 + 1 条结构证据）

> 道次铁律：**只测 `[N]`**。被 `[B]/[C]/[R]/[P]` 覆盖的条目一律 **⛔**，正文写明缺哪一道；
> 混合道次条目只在 `[N]` 子句实测通过时记 **PASS\***。**「Node 里结构对」不等于「能出声」**。
> 证据文本 = `evidence/g4-reverify-v1.2.log` §1（逐条含实测数字）。

| A05 | 判据（缩） | v1.1 | **v1.2** | 一句依据（实测） |
|---|---|---|---|---|
| 01 | `sfx_place` 同帧入队 + 帧末派发 | ⛔（前提：零派发） | ⚠️ **PASS\*** | 真帧点击落子：`bead:placed=1`、flush **前** `pendingCount=1`、flush **后** 派发 `[sfx_place]`（同一 tick）。同帧视觉只到「图元存在」，**可闻**属 `[B]` |
| 02 | `sfx_place` 端到端延迟 ≤1 帧 | 同上 | ✅ **PASS** | 广播后**一次** `flush(1/60)` 即落到 `backend.play`，剩余 pending=0 ⇒ ≤16.67 ms（§0 可断言定义） |
| 03 | `sfx_place` ≤120ms + 软起音无爆音 | ⛔ | ⛔ **缺 `[B]+[P]`** | 本轮夹具 backend=`NullAudioBackend`、`typeof AudioContext=undefined` ⇒ 只有**声明值** 120ms，不是实测包络 |
| 04 | `sfx_select` 入队派发 + 同帧上移 4px | 同上 | ⚠️ **PASS\*** | 真帧点槽：`tray:selected=1`、该帧派发 `[sfx_select]`；同一 tick 该槽珠 L1 中心 y **325 → 329（Δ=4 设计 px）**。时长 ≤100ms 属 `[B]` |
| 05 | `sfx_reject` 连 10 次 ≤2 次/秒 | 同上 | ✅ **PASS** | 0.1s 间隔注入 10 次 ⇒ 请求层 10、**派发层 2**（=窗口秒数×2）⇒ 2.00 次/秒。**旧值对照**：若仍统一 0.05s，上限 20 次 ⇒ 直接违 §3.8 |
| 06 | `sfx_reject` `minInterval === 0.5` | 同上 | ✅ **PASS** | 从 `audio.play()` **实参**读数（不读常量表）：reject=0.5 / place=0.05 / select=0.05 / urgent_beat=0.9 / tray_full=1.0 / clear=0 ⇒ 与 §3.12 分档逐条相符，非全局 0.05 |
| 07 | `sfx_powerup` + `sfx_dissolve` 同帧不被去重吞；零效果零发声 | 同上 | ✅ **PASS** | 真点道具卡：同帧派发 `[sfx_ui_tap, sfx_powerup, sfx_dissolve]`（3 条 ≤ `AUDIO_MAX_PER_FRAME=6`）；`affectedSlots:[]` ⇒ 新增 0 条 |
| 08 | combo t1/t2/t3 按 tier 分流、tier=0 静默 | 同上 | ✅ **PASS** | `tier1→[t1] tier2→[t2] tier3→[t3]`、tier=0 帧新增 0 条 |
| 09 | `sfx_combo_t3` ≤350ms 且与伪震屏同帧 | ⛔ | ⛔ **缺 `[B]` + 判据主体待裁** | 派发侧已另由 A05-08 取证。**伪震屏属 Lv2**（§1 行 7 与实现 `combo-vfx.ts:46-50` 一致）⇒ 「与 t3 同帧」按现文**不可判定**，归 **文策渊**（§19.7），**不判实现缺陷** |
| 10 | `combo_break` 两 reason 同 clip；wrong 同帧并存 reject | 同上 | ✅ **PASS** | 两 reason 各恰 1 条；**真实点击**（冲刺选错色珠→点格）⇒ 同 tick `[sfx_select, sfx_reject, sfx_combo_break]`，并存不互斥 |
| 11 | `urgent_beat` 首拍由 `timer:urgent` 边沿驱动、间隔 1.0±0.05s | 同上 | ✅ **PASS** | 真关卡跑到失败（10799 帧=180.0s）：`timer:urgent=1`、**11 拍**、逐拍 1 次；首拍 **170.000s** = `time−TIMER_URGENT_T`；间隔 min/mean/max 全在 [0.95,1.05] |
| 12 | 回阈值以上停拍；PAUSED 期间零拍 | 同上 | ✅ **PASS** | 暂停 3.0s 新增拍 **0**（`remaining` 7.8→7.8 冻结）、恢复后 3.0s 新增 **3**（排除「拍源已死」）；续时后 `remaining=60s`、再跑 5.0s 新增 **0** |
| 13 | 拍频 ≤3Hz、主观不疲劳 | ⛔ | ⚠️ **PASS\*** | 均拍 1.000s ⇒ **1.000 Hz ≤ 3Hz** 成立；「不致疲劳」= `[P]`（阶段 6 未开始）⇒ 整条不得升 PASS |
| 14 | `tray_full` 每次 1 条且不循环；与视觉呼吸互不驱动 | 同上 | ⚠️ **PASS\*** | 音频半边：3 次注入各派发 1、`loop=false`、`minInterval=1.0`。**判据正文含视觉半边**（500ms 描边呼吸），而该半边 P7 实测「无时间轴」= **BD-10** ⇒ 修订 37 记 PASS\*（见 §19.6） |
| 15 | `sfx_stage` 帧内派发；250+250 双段与视觉分段对齐 | 同上 | ⛔ **缺 `[B]`** | 派发 1 次已证；「真分两段 + 相位对齐」需可听 + 逐帧 ⇒ 只有声明值 500ms（总长） |
| 16 | `sfx_clear` ≤800ms 且与 `vfx_complete_wave` 首列同帧 | ⛔ | ⛔ **缺 `[B]` + 视觉主体缺失** | 派发 1 次已证；波浪常量命中 **0**（= BD-04 已登记缺行）⇒ 无第二主体可对齐 |
| 17 | `sfx_star` 逐星各 1 不重播；通关逐关行各 1 | 同上 | ✅ **PASS** | 星数由冻结阈值**独立复算**（`remaining=179.9833/180` ⇒ ratio 1.000 ⇒ 3★，不用 `computeClearStars` 自证）；面板开启后 1.5s 派发 **3**，再 2.0s 新增 **0**；下一关 L2 填盘 ⇒ `sfx_star` +2、`sfx_stage`… |
| 18 | `panel_in/out` 四态入/出首帧 + 遮罩零发声 | 同上 | ⚠️ **PASS\*** | 四态入/出均各 1 次（PAUSED / LEVEL_CLEAR / FINISH / GAME_OVER）；**遮罩子句经真 `_handleTap` 路由**（非输入链，否则平凡为真=假绿）：点网格派发 **0**、`consumed=false`。时长属 `[B]` |
| 19 | `sfx_revive_ok` 只在真加时那一帧；未看完零派发 | 同上 | ⚠️ **PASS\*** | 正路：`requestRevive=true` + 广告 complete ⇒ 请求 1 次（`loop=false`）、派发 1、`remaining=60s`（实测为**置位**，非在 0s 上叠加）；反路：10 次 `settle(skip)` ⇒ 派发 **0**。总时长 ≤400ms 属 `[B]` |
| 20 | `sfx_reject`（续时未看完）同一 0.5s 档、≤2 次/秒 | 同上 | ✅ **PASS** | game-over 下 10 次「续时→未看完」隔 0.1s：`requestRevive` 成功 10/10、请求 10（`minInterval=0.5`）、**派发 2** ⇒ 1.82 次/秒 |
| 21 | `bgm_main` BOOT 恰 1 次 `{loop:true}` / 静音 stop / 解除重入队 | 同上 | ⚠️ **PASS\*** | BOOT 装配后 bgm 请求 **1** 次 `loop=true`、首帧帧末派发 1、再 3.0s 重入队 **0**（不逐帧重发）；点 `toggle-bgm` ⇒ `bgmMuted=true`、`backend.stop=[bgm_main]`；静音 3.0s 重入队 **0**；解除 ⇒ 重入队 1（`loop=true`）。**无缝循环点**属 `[B]` |
| 22 | `bgm_main` 重复 `play({loop:true})` 不重启位置 | ⛔ | ⛔ **缺 `[B]+[R]`** | 「不重启位置」是运行期契约：假 context 只数节点（P5/S 已证 `_loops` 命中即 return、`activeLoops` 恒 1）= **结构半边**，不等于「人耳听不出重启」；微信子集行为另属 `[R]` |
| 23 | 全表·静音可玩 | ⛔ | ✅ **PASS** | ① 只关 SFX：注入 11 类玩法事件 ⇒ Σ`pendingCount`=**0**、Σ派发=**0**、**请求层也 0**（门控在 `_sfx()`，`beads-game.ts:1656`）；② 只关 BGM：`sfx_select` 照常 1、bgm 重入队 0 ⇒ 双通道独立；③ 全关跑真 8 关：1→8 逐关 `level-clear`→`finish` + 冲刺 3.0s 托盘有珠 + 续时路径，新增请求/派发 **0/0** |
| 24 | 全表·清单闭合（19 id 四方对账） | ❌ FAIL（3 vs 19） | ✅ **PASS** | `md §1` 解析=**19**（无重复）/ `AUDIO_CLIP_*` 字符串常量=**19** / voice 表=**19** / §3.12 `AUDIO_CLIP_TOTAL`=**19** ⇒ 三集合双向相等；孤儿常量 **0**、绕过常量直写 id **0** |
| 25 | 全表·包体（产物内音频=0） | ⛔ | ⛔ **缺 `[C]`** | **本轮未重跑 Cocos 构建**。旁证：`games/beads/cocos/build` 19 文件 / 音频 **0 个 0.0 KB**，但产物 mtime **00:48:40Z 早于**音频源码 **04:05:18Z** ⇒ 不能据其判「合成引擎已进包」。解除条件见 §19.5 |
| 26 | 全表·听感（连打不糊不炸 / 「软·治愈」） | ⛔ | ⛔ **缺 `[P]`** | 主观量在 Node **无可测替身**。相邻已测量（不等于本条）：A05-05 的计数结论、配方声明 `durationMs=120 / attackMs=4 / wave=sine`；「连打是否叠成墙」还需 bus 增益（§3.12 `AUDIO_BUS_GAIN_*` = **[TODO]**）+ `[B]` 实测混音 |
| 27 | 全表·真机（iOS 首手势 / 后台恢复 / 泄漏） | ⛔ | ⛔ **缺 `[R]`** | 无 AppID、无真机（实测 `typeof wx=undefined / AudioContext=undefined / webkitAudioContext=undefined`）。**行为观察**：`suspend()` 保期望态、`resume()` **新建 BufferSource** ⇒ 回前台 BGM 从循环起点重来（`activeLoops 0→1`、bufSrc +1），是否可接受须 `[R]/[P]` |
| **S** | `SynthAudioBackend` 装配与契约 —— **结构证据 ≠ 出声** | —（本轮新增） | ⚠️ **PASS\*** | 见 §19.4 |

### 19.4 P5/S · 结构证据（单列，不计入任何 A05 的验收）

用假 `AudioContext`（`FakeAudioContext`，只计 `createGain/Oscillator/BufferSource/createBuffer` 次数）注入取证，**不会出声**：

- **三平台分支（ADR-0013 的「能力 + 音色表」双条件）**：web+voices → `SynthAudioBackend`；web 无 voices → `NullAudioBackend`；node（即便给 voices）→ `NullAudioBackend`（护单测）；weapp + 假 `createWebAudioContext` + voices → `SynthAudioBackend`（并挂 `onTouchStart`=1、`onHide`=1、`onShow`=1）；weapp 无该能力 → `NullAudioBackend`。**随后已还原 `globalThis`**，不污染其余 25 组。
- **装配根**：`new App({game: BeadsGame, platform: WebPlatform})` ⇒ `services.audio._backend = SynthAudioBackend`，注入 voices **19** 条；`AudioScheduler._maxPerFrame=6`（= §3.12 冻结 `AUDIO_MAX_PER_FRAME`，App 未覆写）。
- **契约**：构造期零节点；**解锁前** play ⇒ `contextReady=false`、`activeLoops=0`、新建节点 **0**（一次性丢弃 / loop 记期望态）；**`unlock()` 后** 补起循环 `[bgm_main]`、离线渲染 **1** 块 buffer。
- **逐 clip 节点普查**（19/19 都能建出节点，`bgm_main:+0` 属幂等）；**惰性渲染**：census 跑完累计 buffer=**2** 块 ⇒ 噪声块在首播该 clip 时才建 ⇒「首次播放前的同步开销是否造成帧抖」**属 `[B]/[R]`，本轮不宣称已验**。
- **未登记 id** ⇒ 新增节点 0 + `warn` 1 次（「框架不发明音色」）；三总线 gain 恒 `[music=1, sfx=1, ui=1]`（§3.12 未定义 ⇒ **不伪造 dB**）；`usesExternalFiles()=false`。
- **红线**：本条**不解除** A05-03/09/13/15/16/18/19/21/22/26 的任何 `[B]/[P]/[R]` 子句；它只把「三平台仍全 `NullAudioBackend`」这条**旧 FAIL 前提**证伪。

### 19.5 对 G4 门禁的建议增量（+ 必须保留的限制声明）

**BD-05（玩法事件零音效，P1）**：建议 **部分关闭 → 降级 P2，不关单**。
可关的部分 = `[N]` 派发层（19 clip 清单闭合 + 事件→clip 派发 + 分档限流 + 静音可玩）；
不可关的部分 = 8 条 ⛔（时长·包络、双段对齐、包体、真机、听感）+ 8 条 PASS\*（都还欠 `[B]/[C]/[R]/[P]` 或视觉半边）。
**BD-05b（框架级 Null）**：建议 **关闭，但限定在 `[N]` 结构层**——「真能听到」仍未被任何道次证明。
**BD-20**：建议 **重开**（关单依据 `framework:sync:check` 本轮 **EXIT=1**，12 处 differs）。它同时是 A05-25 `[C]` 的阻塞前置。

若主理人据此更新 G4：**G4 仍应为 CONCERNS，不因 P5 转绿升 PASS**，且必须保留以下限制声明（逐条不可省）：

1. **P5 的「绿」只到派发层 + 结构层**：本轮夹具 backend=`NullAudioBackend`，Node 无 `AudioContext` ⇒ **不得写成「有音效 / 听感达标 / 已出声」**。
2. **A05-25 包体未验**：本轮未重跑 Cocos 构建，现存产物**早于**音频实现；解除条件 = 修 `framework:sync`（BD-20）+ 补 3 个 `.ts.meta`（BD-33）→ `build:cocos:web` → 按 `[C]` 数产物内音频文件。
3. **A05-22 / A05-27 属 `[R]`、A05-26 属 `[P]`**：真机与 Playtest 未开始 ⇒ 不得据「代码结构对」推定真机首手势出声 / 后台恢复可接受 / 不叠成墙。
4. **三总线增益与混音 dB 未测**：§3.12 `AUDIO_BUS_GAIN_*` 在代码里**不存在**（[TODO]）⇒ 引擎恒 1.0；**QA 不填冻结常量**。
5. **本轮只重跑了 P5 段**：其余 25 组沿用 v1.1 预期值与判定（25/25 判定一致仅作回归对照）⇒ 报告不得被读作「G4 全轮复验完成」。
6. **`pnpm run verify` 现为 EXIT=1**（`framework:sync:check`）且任务书自述的「13 PASS / 1 SKIP」与实测不符 ⇒ 任何引用该自述的下游判断需回看。

### 19.6 探针自身缺陷自查（本轮 **5 处**，与实现缺陷严格分开）

| # | 位置 | 缺陷 | 若不修的后果 | 修正（对应修订号） |
|---|---|---|---|---|
| n | P5 part2 夹具 | 自造关卡 **5×4 + 2 色**被 BOOT 校验拒收（`levels.ts:120-158`）⇒ 实例**永久停在 boot** | **假 FAIL ×8**（A05-11/12/13/17/18/19/20/23） | 改 6×5 / 3 色，实测 `validateBeadsLevel → []` 机验（**修订 35①**） |
| o | P5/A05-21 | `clearAudio()` 内部 `flush(0)` 会把 BOOT 的 bgm 派发推上去**后又清空** | **假 FAIL**（`bootDispatch` 恒 0） | 先读账再清（**修订 35②**） |
| p | P5 面板按钮 | 面板驱动走 `InputManager` 链，而 `_readInput()` 只在 `playing` 被调（`beads-game.ts:1147`）⇒ `paused`/`game-over` 相位收不到真指针 | **假 FAIL**（A05-18/21/23）；反过来若拿它验「遮罩零发声」则**平凡为真 = 假绿** | 本段改 `game.tapDesign()`（= 真 `_handleTap` 路由，与报告 §3 约定、与单测同口径）；接线问题另记 **BD-34**，**不判任何 A05 FAIL**（**修订 35③**） |
| q | **P4（非本段）** | P4 用 `/DISSOLVE/` 子串数「溶解动效常量」，被 T-096 新增的 `AUDIO_CLIP_DISSOLVE` 命中 | **假绿**（`DISSOLVE 0→1`、「仍缺行」2→1） | 统一排除 `AUDIO_` 前缀 ⇒ 逐字回到 v1.1 文本（**修订 36**） |
| r | P5/A05-14 | 判定算成 PASS，正文却自陈「记 PASS\*」 | **判定偏松 + 叙述不一致**（读数的人会以为整条已闭） | 按**正文**不按标签补 `partial` ⇒ PASS\*（**修订 37**；这是收紧，不是放宽） |

> 另有本轮的**夹具新鲜度自证**（修订 34）：开跑前 dist 早于 src 38 分钟，已重建并机验。
> 只读诊断脚本 `evidence/diag-p5-fixtures.mjs` 用于区分「夹具缺陷」与「实现缺陷」，非门禁证据本体。

### 19.7 冲突 / 观察登记（**不占缺陷号、不改冻结常量**）

| # | 事实 | 归属 | QA 处置 |
|---|---|---|---|
| C1 | `A05-09` 把「伪震屏 scale 1.015」写成 `sfx_combo_t3` 的同帧主体；但 §1 行 7 与实现 `combo-vfx.ts:46-50`（tier=2→pseudoShake，tier=3→burst）表明**伪震屏属 Lv2** ⇒ 该子句按现文**不可判定** | **文策渊**（`audio-events §4` 正文） | A05-09 记 ⛔，不判实现缺陷 |
| C2 | `sfx_revive_ok` 的 `bus='ui'`，而 §0 的前缀派生规则（`sfx_*`→sfx）不一致 | 音频表负责人 / 实现侧 | 仅作**附带审计**记入 A05-24 正文，不并判 |
| C3 | `audio-events §1` 的时长列有 **7 处非纯数字**（`urgent_beat` / `tray_full` / `stage` / `star` / `revive_ok` / `ui_tap=TODO` / bgm 循环点=TODO）⇒ 这些条目的 `[B]` 实测无期望值可比 | **文策渊**（音频规格） | 相关条目一律记 ⛔/PASS\*，**不猜值** |
| C4 | §3.12 `AUDIO_BUS_GAIN_*` 在 `tuning.ts` 内**不存在**（[TODO]），引擎三总线恒 1.0 | **主理人 / 阮和鸣**（冻结常量落地） | 探针不伪造 dB；写进限制声明第 4 条 |
| C5 | `suspend()→resume()` 会**新建 BufferSource** ⇒ 回前台 BGM 从循环起点重来 | 实现侧（需 `[R]/[P]` 判是否可接受） | 已写入 A05-27 正文；**不自行判缺陷** |
| C6 | 离线渲染是**惰性**的 ⇒ 首次播放某 clip 前有一次性同步开销（`audio-synth.ts` 头注自认「一次性源不可复用」） | 实现侧 | 归 `[B]/[R]`；A05-27 正文登记 |

### 19.8 建议下一动作（排序由主理人定）

1. `pnpm run framework:sync` 修镜像（**BD-20 重开**）+ 补 3 个 `.ts.meta`（**BD-33**）⇒ 解除 A05-25 的 `[C]` 前置。
2. 起一轮 **[B] 浏览器取证**（harness 预览 + 录音 / 逐帧）：一次性覆盖 A05-03/09/13/15/16/18/19/21/22 的时长·包络·对齐子句——这是目前 P5 最大的空白面。
3. **BD-34** 定级与口径裁定（面板相位输入）：影响 `[B]/[R]` 全部交互判据与 Playtest 可执行性。
4. C1/C3（音频 §4 正文与 §1 时长列）随 **T-098** 一次性打包给文策渊，避免下轮再返工。
5. Playtest 轮解锁后补 A05-26（听感）与「解压/治愈」支柱评估——**在此之前仍不得对该支柱下 PASS**。

---

# WXG-T-098 裁定后改判轮（v1.3 · 严守真）

## 20. WXG-T-098 裁定后三条探针改判（v1.3）

> 本节为**追加新节**：不改写 §12–§19 的任何 QA 原文，**更不动 §18.5 的主理人裁决**（只在其下方另行追加建议，裁定权属仍归编排层）。

### 20.0 一句话结论

B7 裁定包回写后的三条判据现文已全部写进探针并**实跑他证**：**P20 转 PASS**（新口径成立）、**P26 维 ⛔**（判据作废，不产绿）、**P4 转 FAIL**（新口径更严，实现未跟上）⇒ **无新回归、无自加阈值**；**建议 G4 仍 = CONCERNS，BD-25 可关单**。

### 20.1 顺序纪律：先改预期值，后重跑（自证）

1. 第一步：对 `g4-probe-v1.1.mjs` 做**三处预期值替换** + 新增 helper `countPeaks` + 头部续号**修订 38**（声明「预期值取自 WXG-T-098 回写后的 §8/§5 现文」），均通过语法检查。
2. 第二步：才执行 `node production/qa/beads/g4-probe-v1.1.mjs`（EXIT=0）。⇒ 本轮**不存在**「先看输出再回填预期」的窗口（报告 §18.3-6 惯例；先跑再凑预期 = 假绿）。
3. 反向约束同样执行：因数字难看而放宽 / 删断言 / 把 ⛔ 写成 PASS——**均未发生**。P4 是**收紧**（从「α 有 ≥2 档即算在闪」升为两条结构断言）⇒ 结果 FAIL 照实记；P26 反而是**删断言但不删记录**（保留 ⛔ 主体，不得因「没断言了」而默认绿）。

### 20.2 命令与计数

| 命令 | 退出码 | 计数 |
|---|---|---|
| `node production/qa/beads/g4-probe-v1.1.mjs` | **0** | 54 组（v1.2 为 53，新增 P26-N）：**PASS 27 / PASS\* 14 / FAIL 4 / ⛔ 9** |
| └ 本轮改判面（P4/P20/P26 + P26-N，4 条） | — | **PASS 2 / PASS\* 0 / FAIL 1 / ⛔ 1** |
| └ P5 段（28 条，沿 T-096 口径） | — | PASS 12 / PASS\* 8 / FAIL 0 / ⛔ 8（**判定逐条未翻转**） |
| └ 其余 50 组（含 P5 段，沿各自上一轮口径） | — | PASS 25 / PASS\* 14 / FAIL 3 / ⛔ 8 |
| `node tools/scripts/sync-framework-to-cocos.mjs --check` | **0** | ✅ 镜像一致（v1.2 同命令 EXIT=1/12 differs）⇒ 见观察 O3 |
| `stat games/beads/cocos/build/web-mobile/**` | — | 最新 js 仍 `2026-09-15T08:48:40`（本地）⇒ **未重跑构建**，A05-25 维持 ⛔ |
| `pnpm run verify` | **未执行** | 任务书硬约束：由主对话统一跑 ⇒ G1–G3 本轮**未复核**，不得据本单改判 |

证据本体：`production/qa/beads/evidence/g4-reverify-v1.3-t098.log`（§0 范围+顺序自证 / §1 命令 / §2 三条样本 / §3 stdout 全文 / §4 与 v1.2 逐记录对照 / §5 未执行清单 / §6 汇总核对）。

### 20.3 逐条改判表（旧判据 → 新判据 → 实测 → 结果）

| 探针 | 旧判据（v1.1/v1.2） | **新判据（T-098 回写后现文）** | 实测（本轮） | 结果 |
|---|---|---|---|---|
| **P20** | 「60s 内 16±0」，开/闭区间未定 ⇒ 采 ±1 帧呈请 **PASS\*** + 登记 BD-27 | `tray-spawner §8-1`：**窗口 t∈[0,60] 闭区间**；**次数轴 ±0**（按到达序一一映射到名义序号 i=1..16，第 i 次名义时刻 = 4×(i−1)s；缺一次/多出名义第 17 次均 FAIL）；**时刻轴单列** `0 ≤ t_actual − 4×(i−1) ≤ 2 帧`（帧=1/60s，负偏差 FAIL）；间隔 4.0s ±0.1s；前提=不被满槽截断 | 16 个实际时刻 `0.017, 4.033, 8.033, …, 56.033, 60.033`；滞后 i=1 为 **1.00 帧**、i=2..16 **恒 2.00 帧** ⇒ 最大滞后 **2.00 帧（压线）**；可采纳上界内事件数 **16 = 16**；窗口外 0 个；间隔最大偏差 **0.0167s**；bead:placed=16、tray:full=0、末帧 playing ⇒ 前提成立。**旧字面严格读法（t≤60.000）= 15 ≠ 16 ⇒ 仍 FAIL**，两读并列 | **PASS** |
| **P26** | 3:1 抽色不可构造 ⇒ 记 **⛔（本轮不可验 · 移交裁定）** + BD-28；当时正文建议「标作废或改写」 | `§8-3` 现文：**作废**（五子条：作废依据 / 为何不采平凡真 / 交 QA 的 P26 口径 = **⛔，不得记 PASS 亦不记 FAIL** / 复活条件）；若要保留只可作**负向用例** | 脚本内 **3:1 占比/权重断言已删除**（不留「跑了但没判」的模糊地带）；实现事实旁证：`decoys=['4']` 关卡 → `phase=boot`、`tray:spawned=0`、多推 2s 仍 `boot` ⇒ 与现文引用的实测一致。⛔ 与平凡真的差别已入证（⛔=无从判定不产绿；平凡真=判定成立但恒真；§8-9/P21 属后者⇒ 仍 PASS，不混用）。**新增 P26-N（负向用例）**：BOOT 拒收成立 ⇒ **PASS**，并显式标「属 `levels-spec §2` / `levels.ts:184` 校验，**不属 S4 §8-3**，不得回填成 §8 的绿」 | **⛔**（主记录） |
| **P4** | 「danger α 出现 ≥2 档 = 在闪」即算成立；因 §5 与红线互斥记 **PASS\*** + BD-29 | `ux-spec §5`「放错拒绝」视觉列现文：**单次脉冲**（淡入 60 / 保持 80 / 淡出 60 = 200ms，一个 fx 窗口内 **α 极值点 ≤1**）+ 连续拒绝 **500ms 重启门** ⇒ 有效 ≤2 次/秒。两条结构断言：(a) 峰点数 ≤1；(b) 两次脉冲起点间隔 ≥500ms | (a) α 逐帧 `[0.7,0.92,1,0.92,0.7,0.4,0.7,0.92,1,0.92,0.7,0.4,0,0]` ⇒ **峰点数 = 2 ≈ 10.0Hz**（判据 ≤1 ⇒ 不成立）；(b) 每 100ms 注入同格误点×9 ⇒ 脉冲起点间隔 **全为 100ms**（判据 ≥500ms ⇒ 不成立；实测 9 次/秒，超「≤2 次/秒」4.5 倍）。代码锚点 `view-model.ts:521`、`beads-game.ts:1524`。位移半边仍合规（max 2.6px ≤ ±3px、换号 2）；`reduceMotion` 退静态由 **P22** 已证成立⇒ **不重复开缺陷** | **FAIL**（**非新回归**：BD-29 由「规格互斥」转态为「实现落差」，改码已立项 **WXG-T-102**） |

### 20.4 BD 处置状（详表见 §15.3，不篡改 §15 历史原文）

* **BD-27 → 建议关闭**（已裁定、已回写、新口径下实测 PASS）。
* **BD-28 → 建议关闭**（采「作废」而非平凡真；⛔ 口径与复活条件已入 §8-3 现文）。
* **BD-29 → 不关闭，转态为「实现落差」**（P4 FAIL）；**不占新 BD 号**（§5:201 明文），改码归 **WXG-T-102**。
* **BD-30 → 建议关闭**（`ux-spec §6.2:230` 等价口径已写定，与实测 1/2 帧吻合）。
* **BD-31 → 本半边建议关闭**（`:106/:187` 占位已删）；其核对过程新暴露的 α 幅度缺定义 ⇒ **BD-35 候选**（已登记 §15.3 顺延区）。
* **BD-25 → 建议可关闭**：① 判据不再歧义（±0 只约束次数轴、时刻轴单独 2 帧、闭区间按名义计数）；② 实现侧在新口径下**实测逐项达标**（16/16、滞后≤2 帧、无负偏差、间隔±0.0167s）；③ v1.0 冲突表 #4 担心的「旧 ±1 恰吞掉 +1 变更」已被结构上消除（现在的 2 帧容差在**时刻轴**，无法再抵消**次数轴**的缺额：少一次 ⇒ 映射错位 ⇒ 某条滞后必 >2 帧或直接 15≠16）。**限定**：关单只到 `[N]` 模拟时间层，真机墙钟/掉帧下仍未验。

### 20.5 门禁建议增量与限制声明（裁定权在主理人）

**建议**：G4 **仍为 CONCERNS**，不因 P20 转绿升 PASS。可确认的增量只有两件：① 判据侧互斥三项（BD-27/28/30）**已消解**；② §18.5 限制声明第 **5** 条的「判据未裁」半边**具备解除条件**。

必须随行的限制声明（逐条不可省）：

1. **P26 的 ⛔ 不是绿**：S4 §8-3 目前处于「已作废、无硬判据覆盖 3:1 抽色」状态，其合法性完全挂在 `DECOY_COLORS_MAX=0` 这一冻结值上；若 §3 改回 ≥1 而未同步重建 P26 断言 ⇒ 就是**真判据真空**（复活条件已在 §8-3 第 4 子文，需人盯）。
2. **P4 的 FAIL 不得读成「新发现一个回归」**：它是已立项的 **T-102** 欠账；在 T-102 落地并复跑前，**不得把 §18.5 第 5 条整体解除**（只能改写为「判据已裁；BD-29 转态为 T-102 落差项」）。
3. **三条都只证到指令流 / 事件流层**：P4 的 α 来自 `buildBeadsView` 下发的 `rect.alpha`，不等于屏幕发光序列；P20 的时基是**模拟时间**而非墙钟 ⇒ `[Cocos]/[Device]/[R]` 仍 ⛔。
4. **本轮只改了三条预期值**：其余 50 组沿用各自上一轮口径，报告不得被读作「G4 全轮复验完成」；P8/P10/P17 三条 FAIL 依旧原样在册。
5. **G1–G3 本轮未复核**：未跑 `pnpm run verify`（任务书硬约束）；v1.2 那轮的 FAIL 1 项与本单无交集，也不得据本单推定其现状。

### 20.6 探针自身改动自查（本轮，与实现缺陷严格分开）

| # | 改动 | 若不修的后果 | 对应修订 |
|---|---|---|---|
| s | P20 旧版把「次数 ±0」与「时刻 ±1 帧」**混在同一轴**（`rhythmOk && times.length>=16` ⇒ 单向“≥”，多给一次也不会 FAIL） | **假 PASS**（出现名义第 17 次仍绿） | 拆成两轴：次数轴 `inAdmissible === 16` **且**窗口外事件不得落入上界；时刻轴逐条 0≤lag≤2 帧（**修订 38①**） |
| t | P26 旧正文仍描述 3:1 与“占比”字样，容易被下轮读回成可验判据 | **口径歧义→下轮可能自行记 PASS** | 删断言与描述文字，只留现文引用 + ⛔；另开 P26-N 并标归属（levels 域）（**修订 38②**） |
| u | P4 旧版只断「α 有 ≥2 档」⇒ 对 **10Hz 往复与 1Hz 单脉冲不敏感**（两者都 ≥2 档） | **假 PASS\***（现文已禁止往复，却看不出来） | 新增 `countPeaks`（plateau 合并后数峰点，防持平样本重复计数）+ 连续拒绝子例程测起点间隔；快照为活对象⇒ 当场拷标量（沿用修订 15a）（**修订 38③**） |

> 同轮口径自查：本轮**未**因数字难看而放宽（P4 是收紧后 FAIL），也**未**把 ⛔ 写成 PASS；本轮新写的 `hi = 60 + 2帧` 上界仅用于**时刻轴**映射，**次数轴**仍按现文 `floor(60/4)+1=16` 推定，未把两者合并。

### 20.7 冲突 / 观察登记（**不占缺陷号、不改冻结常量**）

| # | 事实 | 归属 | QA 处置 |
|---|---|---|---|
| O1 | P5/A05-24 附带审计 (a)「bus 归属 vs §0 前缀规则不符」由 v1.2 的 `sfx_revive_ok(ui)` 变为本轮「无」——因 `audio-voices.ts` 在 v1.2 取证后随 T-096 落码（现 bus=`sfx`）⇒ §19.7 C2 描述的那个差异**已消解** | 工程侧成果（不记在本单名下） | 不改 A05-24 判定；在证据 §4 逐字列出差异来源，防被读成「QA 改判」 |
| O2 | P5/A05-10（选错色珠的槽号 0→4）与 P19（目标格 r3,c4→r2,c1）**跨轮随机读数漂移**（判定未变）⇒ v1.2 §1 的「二次运行除时间戳外零差异」只在**同一提交 + 同一 STAGE** 下成立 | QA 侧（探针可重现性） | 在证据 §0/§4 加基线漂移声明；建议后续把两处采样前置改固定 seed 夹具 |
| O3 | `framework:sync:check` 本轮 **EXIT=0**（v1.2 为 EXIT=1/12 differs，随 WXG-T-101 镜像守卫落地归零），**但** `cocos/build` 产物 mtime 未动 ⇒ A05-25 的 `[C]` 前置**仍未解除**（§19.5 限制声明第 2 条仍需重跑构建） | 主理人 / 阮和鸣 | **不因镜像同步而改判**；解除条件仍为 `build:cocos beads` 后按产物数音频文件 |
| O4 | `levels-spec.md:23 / :42` 仍写 `DECOY_COLORS_MAX=2`（括号内数值），与 `systems-index §3:89` 的 **v1.17 冻结值 0** 陈旧不一致（:203 只引用常量名，无问题）⇒ 与 BD-28 同族的**判据侧滞后残留** | **文策渊**（`design/**`，本 QA **不改笔**） | 不占新 BD 号；是否升格（或并回 BD-31 类「文档同步残留」）由主理人定。当前不影响实测：`levels.ts:184` 按 **0** 执行（P26-N 已证 BOOT 拒收） |

### 20.8 建议下一动作（排序由主理人定）

1. 按 §20.4 确认 **BD-25 / BD-27 / BD-28 / BD-30 / BD-31（本半边）** 的关单与 §18.5 第 5 条的**改写**（不得整体解除，因 BD-29 仍欠）。
2. **WXG-T-102**（wrong 描边单次脉冲 + 500ms 重启门）排期；落地后 QA 只需复跑 P4 段（预期值已现成），**不重全轮**。
3. **BD-35 候选**裁决：给 `ux-spec §5:187` 补 α 幅度（一个数值）⇒ P7 可去掉该子句的 PASS\*；同次顺手处理 **O4**（`levels-spec` 常量陈旧），与音频 §4/§1 的 C1/C3 一并打包免再返工。
4. 补 **`[B]` 浏览器逐帧取证**（一次性覆盖 P4 的屏幕发光序列与 A05 时长·包络族）——这是目前三条改判共同的天花板。
5. 主对话统一跑 `pnpm run verify` 后，把本轮三条改判结果归入 G1–G4 总表；在此之前 **G4 保持 CONCERNS**。

---

## 21. 主理人对 §20 的增量裁决（WXG-T-098 · 2026-09-15 · 裁决人 = 工作室主理人）

> 本节只作**增量裁决**：**§18.5（上一轮主理人正式裁决）与 §12–§20 历史原文一律不改写**，本节即其后续。上一轮提到的「§18.5 第 5 条需改写」以本节的关单声明为效力源，不回改旧节。

**21.0 取证方式（不靠成员自述）**：主对话**独立重跑探针**（`node production/qa/beads/g4-probe-v1.1.mjs` → EXIT=0）⇒ 计数逐条复现：**PASS 27 / PASS\* 14 / FAIL 4 / ⛔ 9（共 54 组）**；`pnpm run verify` = **PASS 13 ｜ SKIP 1（`check:size`，无 `wechatgame` 产物）｜ FAIL 0**。**P20 转 PASS 与 P4 转 FAIL 均非只读报告、已当场重现。**

**21.1 逐条裁定**

| 项 | 裁定 | 限定（不得越过的口径） |
|---|---|---|
| **BD-25** | ✅ **关闭** | 关单理据 = 歧义源（旧 ±1 容差恰吞掉 15→16 变更 + 开/闭区间未定）已由 `tray-spawner §8-1` 两轴分列与 `systems-index §3 使用约定第 4 条`消除。**效力只到 `[N]` 模拟时间层**，不得据此宣称像素层已验 |
| **BD-27** | ✅ **关闭** | 采「闭区间 + 按**名义时刻**计数 + 时刻轴 ≤2 帧」；新常量 `SIM_FIXED_STEP` / `SPAWN_WINDOW_SLACK` **不采**（时基属框架实现事实，进 §3 必造两处漂移） |
| **BD-28** | ✅ **关闭** | 采**作废**而非平凡真（比例不可观测 ⇒ 记 PASS = 伪绿）；P26 维持 ⛔ 不产绿，P26-N 归 levels 校验、**不得回填成 §8 的绿**；**复活条件已成文** |
| **BD-29** | ⚠️ **不关闭，转态跟踪** | 规格互斥半边已消解（>3Hz 红线**不开豁免**）；**现实现仍 10Hz ⇒ P4 诚实记 FAIL**，下家 = **WXG-T-102**（含 α 幅度前置补句）。本条**不占新号**、也不得计入「新回归」 |
| **BD-30** | ✅ **关闭** | 等价口径已成文且 (ii) 为准据名；两型差异（1 帧 vs 2 帧）与 P20 实测吻合 |
| **BD-31** | ✅ **关闭（本半边）** | `assets-spec:106/:187` 已同步；核对过程新暴露的两项另编 **BD-35 / BD-36**（不并入本条） |
| **BD-35** | 🔵 **正式赋号**（原「候选」） | `ux-spec §5:187` 告急行缺 **α 幅度** ⇒ 归 **WXG-T-102 Deliverable ①**（先补文档再改码）；补齐前 P7 维持 PASS\*，**QA 与美术侧均不猜值** |
| **BD-36** | 🔵 **赋号 + 登 backlog** | `assets-spec §5` 分项 1500+452+0+0 = **1952** ≠ 实测合计 **1968**（Δ16 KB，`audio-spec §4.2` 同表述）⇒ 属**统计口径**问题：下次产物重建时对齐，**不动预算数值、不改产物、不删信息凑数** |
| **O4** | ✅ **已处理（不占 BD 号）** | 主对话直接追正 `levels-spec.md:23 / :42`（`DECOY_COLORS_MAX` 括号旧值 2 → **0**，引 §3 v1.17 U8=D，并补 BOOT 拒收与 P26-N 实测锚点）+ 文首§3 版本引用 v1.5 → v1.19。**QA 不改 `design/**` 的纪律未受破坏**（本次由主理人执笔） |

**21.2 对 §20.8 建议 3 的认错与补救（主理人责任，非成员）**：§19（T-096 轮）建议第 4 条已明文「**C1/C3 随 T-098 一次性打包给文策渊**」，但主理人写 T-098 任务书时**漏列**该两项 ⇒ 本轮拆为独立单 **WXG-T-103** 补做（不伪称它在 T-098 范围内）：
- **C1**：`audio-events §4 A05-09` 主体由 `sfx_combo_t3` 改为 **`sfx_combo_t2`**（伪震屏属 tier=2，与 `combo-vfx.ts` 一致），t3 的「350ms + 同帧 `burst`」另立 **A05-09b**；成员已逐行核过 §1 全部 combo 梯级，同类错置仅此一处。**编号采 `b` 后缀，不做整体重排**（重排会牵动台账与已有证据引用，成本更高）。顺带清掉同源错置注释 `src/config/audio-voices.ts` 的 T2/T3 两行（纯注释，无行为变更）。
- **C3**：时长列 7 处非纯数字已逐条分流：**5 甲**（可凭 §3.12 / `ux-spec §5` 现有值定写：`urgent_beat ≤1000`（周期窗口，非单拍长）、`tray_full ≤500`、`stage 500`、`star 150`、`revive_ok ≤400`）/ **2 乙**（`ui_tap`、`bgm_main` 循环点保持 `[TODO]`，但写成**可解除**的 `[TODO]`：标明解除条件与「实现占位值不得回引为规格」）。**`sfx_tray_full` 采甲**（沿用 §5 的 500ms 窗口作**上限约束**，非期望值）；若后续 `[P]` 道次判为过长，再按当时证据改写，不在本轮拍手感值。
- **残留（不得归零）**：A05-09 本体现仍记 **⛔**——因为**探针与台账尚未按新主体同步**（`production/**` 成员无改笔权限）。列入下轮 QA（与 T-102 的 P4 复跑同批，不单独起一轮）。

**21.3 G4 维持 CONCERNS**（与 §18.5 同口径，不因 P20 转绿而升级）。理由三条，缺一不可：① P4 现仍 FAIL（BD-29 实现落差）；② `[B]/[C]/[R]/[P]` 四道次本轮仍未执行（web-mobile 产物已过期 ⇒ A05-25 维持 ⛔）；③ **方框效应提醒**：本轮 FAIL 从 4 条中的一部分变为另一部分（P20 ↑、P4 ↓、P26 → ⛔），**总数持平不代表质量持平**——P4 变红是因为判据变严且变可测，而非新增回归；反之 P20 变绿也不是实现变了，而是判据歧义被消除。**任何引用本轮计数的人都必须带上这句归因。**

