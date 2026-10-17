# WXG-T-288 · EP14-S2 主界面总星数位 取证（2026-10-17）

> 结论一句话：**顶栏总星数位已在真浏览器画面上拍到两态（`★0` → 真引擎通关后 `★3`）**，位置在安全区内、与齿轮热区不互掉；
> 数值 = Σ 各关历史最高星（规则 R6/R8），整帧代价已走第十九次复评入账（`K.5.1-补11`）。**未闭** = 分母形态与大字号档观感（见 §4）。
>
> ⚠ 本件初版曾判为「浏览器实拍做不到、只能交离屏 SVG」——**该结论错误**（当时只验到 weixin MCP 产物链），现以实拍两图订正，失因见 §5。

## 1. 环境与取法（可复跑）

| 项 | 实况 |
|---|---|
| **画面级通道（主证据）** | 浏览器 dev harness 实拍：`pnpm run harness` → `http://127.0.0.1:4173/?game=beads&dbg=off`（默认即落玩法屏，`?meta=menu` 才进主菜单；`?dbg=off` 关品红/青诊断虚线框） |
| 顶栏取证三个必做前置 | ① **隐藏 harness 自带 DOM 覆层** `#hud`/`#controls`/`#help`（`position:fixed` 正好盖住 design y=1274 那条顶栏 ⇒ 不隐就拍不到）；② 重拍前调 `window.__beads.app.fitCanvas()` 清画布残影（残影会被误读成“虚线框”）；③ 游戏实例在 **`window.__beads.game`**（`app.game` 是 **BeadsShell 外壳**，无 `setDebugOutlines/phase/snapshot`） |
| 像素级自证 | 最终两图均校过：品红/青像素 **0 / 0**、左/右黑边非黑像素 **0**、`_debugOutlines/_debugGuides/_debugInfo` 全 false；console 0 error |
| 离屏等价腿（辅） | `pnpm run preview:frames:beads`（`render-harness-frame.mjs`，引擎 `RenderModel` 1:1 转 SVG）+ 两态探针 `temp/wxg288-s2-evidence/capture-two-states.ts`（不入库，先例 = `temp/probe-seal-inversion-closure.mjs`） |
| 通关驱动 | 浏览器内用**全公开命令**交替 `retrieveBead → selectTraySlot → tapGridCell`，实测 `{places:102, retrieves:102, gives:0, expands:0, iters:204, endPhase:"level-clear", complete:true, starsTotal:3}`；离屏腿走 `g3-lib.ts::runBot`（同口径，`cleared:true, moves:10`） |

## 2. 画面级两态读数

| 态 | `phase` | 快照 `starsTotal` | HUD 实际文本 | 坐标 (x, y) | 整帧命令数 |
|---|---|---|---|---|---|
| 开局（新档，L1 未通） | `playing` | 0 | `★0` | (120, 1274) | 1662 |
| 真引擎通关后 | `level-clear` | **3** | **`★3`** | (120, 1274) | 1657 |

**浏览器实拍两图（主证据；按仓内纪律不入库——`.gitignore:100` 明确忽略 `production/qa/*/evidence/**/*.png`，注为「截图取样物，复核请读盘」）**：

| 态 | 落盘路径（仓根相对） | 字节 |
|---|---|---|
| `★0` 开局 | `temp/forensics-beads-topbar-A-star0.png` | 56,484 |
| `★3` 真引擎通关后 | `temp/forensics-beads-topbar-B-star3.png` | 38,410 |

两图均为顶栏特写：可读到齿轮图标 · `★0`/`★3` · 计时胶囊 `00:13`/`00:04` · `LV 1/9`；shot-B 另含结算面板「🎉 闯关成功 + 三颗金星」。**无任何品红/青虚线框**（校过像素，见 §1）。

同帧 HUD 文本命令实测（页面内 `app._builder._commands` 取）：`★0 @(120,1274)` ↔ `★3 @(120,1274)`，同带另有 `00:13 @(389,1274)` 与 `LV 1/9 @(680,1274)`；design (120,1274) → 屏幕 (418, 21)。

辅助 SVG：`temp/wxg288-s2-evidence/hud-stars-a-start.svg` · `hud-stars-b-cleared.svg`（同样属取证件，不入库）。

**位置合规核对**：顶栏带 `HUD_BAND` = y∈[1214,1334] ⇒ y=1274 居中；左齿轮位 x=60（Ø48，热区 88×88 ⇒ 右界约 104）⇒ 星数位 x=120 与热区留 16px，⛔ 不吞点击；微信胶囊避让区 `CAPSULE_AVOID` = x∈[560,750] ⇒ 星数位在**左半**天然不受胶囊压字（右侧同带已被 `LV n/N` 纸 chip 占用，见 `view-model.ts` F7⑤ 段）。

## 3. 判据与读数对应

| 判据 | 来源 | 读数 | 证据 |
|---|---|---|---|
| 总星数 = Σ 各关历史最高星 | `star-collect-rule.md` **R6** | L1 拿 3★ ⇒ `starsTotal = 3`；`starsByLevel = [3]` | 本文件 §2 · `tests/stars-total-hud.test.ts` 臂 2 |
| 重玩刷出更低星 ⇒ 总数不涨 | 同文 **R6**（防无限肝） | 同关重玩判 2★ ⇒ 数组仍 `[3]`、总数仍 3 | 同文件臂 3（含「未碰过的 L2 仍 0★」） |
| 主界面显示总星数 | 同文 **R8** | 顶栏出现 `★n`，两态实测 | 本文件 §2（分母形态 `[待 UX 批]` ⇒ 本批只上最小臂） |
| 数值只在快照派生、视图零计算 | 控制清单 **L5** + 热路径零分配 | `starsTotal` 由 `_syncSnapshot()` 局部累加；快照对象跨帧同引用 | `beads-game.ts:3990-3994` · 测试臂 1 + 零分配静态门（禁 map/filter/reduce/展开） |
| 整帧代价入账 | `test-cases.md §K.5.1` 复评通道 | 两帧各 +1（`text` 12→13）；珠体族 96+45+45 例逐字节零差 | 第十九次复评：provenance `s3_frame_recheck_19`、台账 `recheck-19-star-total-hud`、文号 `K.5.1-补11` |

## 4. 未闭与解除条件

| 未做 | 原因 | 解除条件 |
|---|---|---|
| 分母形态 `★n/27`（当前大关容量） | R8 的落位与分母明标 `[待拍板]` = `star-collect-rule §6-T1`，归 EP14-S4 / UX 续批 | UX 定稿后同批改 HUD + **同批**再做整帧复评（避免两次改基线） |
| 大字号档（E2）与顶栏拥挤度 | 本件只测默认字号；改字号会移动同带元素，需真屏核对（harness 可预看，但最终签需在真机） | 真机走查一行签署（日期 + 机型 + 结论）；本项 `[待真机]` |
| 真机/微信开发者工具截图 | 该链仍需要 Cocos **构建产物**（`games/beads/build/wechatgame/` 不存在，ADR-0009 前置未通）——注意：**这挡的只是真机/上传链，不挡浏览器 harness**（本件主证据即来自浏览器） | 构建链打通后补一张实拍 PNG；本臂浏览器两图已取（落盘路径见 §2），不再挂账 |

## 5. 本件初版的三处错判（订正留档，K-053 不静默删）

| # | 初版说法 | 实况 | 成因 |
|---|---|---|---|
| 1 | 「浏览器实拍做不到，只能交离屏 SVG」 | 浏览器 harness 完全可跑可拍 | 只验到 weixin MCP（需构建产物）那一条，就推及了整条画面链——**单通道失败 ≠ 取证不可行** |
| 2 | HUD 命令从 `app.lastModel` 取 | 该字段不存在；真实数据源 = **`app._builder._commands`** | 凭惯例写探测式，未先核 |
| 3 | 在浏览器里「逐格正填」即可通关 | L1 = **102 颗全错位的解环盘**，`isFillable` 只筛空格、`tapGridCell` 拒绝已占格 ⇒ 必须 `retrieveBead → selectTraySlot → tapGridCell` 交替（实测 204 次动作） | 把**单测夹具**（`simpleTestLevel()` 6×5 空盘）的玩法当成了真关盘型。本臂单测腿（空盘夹具）与离屏探针腿（`runBot`，内部自会取回）均仍成立，错的只是当时手写的浏览器脚本 |

可复用事实（下次顶栏取证直接拿）：**隐 `#hud`/`#controls`/`#help` + `fitCanvas()` 清残影 + `?dbg=off` + 实例走 `window.__beads.game`**；另注意 L1 倒计时仅 ≈24s，页面内探查 API 会跑进 `game-over`，需 `retryLevel()` 复位。
