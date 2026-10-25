# 《拼豆填色消除》(beads) 测试用例 · Test Cases

- 任务号：WXG-T-011 / WXG-T-028 / **WXG-T-084** / **WXG-T-092（复验轮）** / **WXG-T-098** / **WXG-T-109** / **WXG-T-114（真链口径轮）** / **WXG-T-116（§A4b 去「拟」+ 次按钮真链孪生）** / **WXG-T-144（§J v2.0 判据迁移）** / **WXG-T-146（G1/G3/G4 落码回填 + 裁定 1 面板门新增两条）** / **WXG-T-150（G2′ 解环器归位落码 + 裁定「甲」时序门新增三条）** / **WXG-T-153（G6 结算彩带落码 + TC-PER-26 新增）** / **WXG-T-132（G5 伪震屏全局变换通道落码 + TC-PER-27 新增）** / **WXG-T-169（棋盘缩放/平移 + 抬起才提交：§A2/§A3/§A4 时基改写 + 新增 §A4c；**收口批 v1.15 补 §A4c.2 落点**）** / **WXG-T-170/171/172（T-169 §A4c.4-F1/F2/F3 三缺陷修复批：TC-SUB-06 新落点 + F2 回归例 + TC-CAM-08 新落点）** / **WXG-T-173（U11 丁裁：`core-loop v2.2 §8` 注② 摘出扫光链，下游后移清单同步）** / **WXG-T-211（§K 风格与豆径族，v1.17）** / **WXG-T-212（§K.5.1-补 整帧基线复评：HUD 缩放控件致封箱基线失效，v1.18）** / **WXG-T-212-R2（§K.5.1-补2 整帧基线第二次复评：§3.1 盘带下沿 480→568 换尺 ⇒ 坐标级纯平移，v1.19）** / **WXG-T-214（§K.5.1-补3 整帧基线第三次复评：四～七裁孔层链 ⇒ 孔层键形拆两枚 + 整帧两键重封，v1.20）** / **WXG-T-214-R10（§K.5.1-补4/补5 三/四裁历史追补 + 腿 4b 分桶反演闭合，v1.21）** / **WXG-T-269-S6（§M 主菜单作品墙硬判据，v1.22）** / **WXG-T-295（§A4 / §A4b / §A4c.0 区外按钮类控件改「抬起才提交」+ 旧读数降级，v1.23）** / **WXG-T-346（§M 后补 TC-MN-41：累计星进度件字号与墨的实测对比度判据，v1.24）** / **WXG-T-225（判据分片 13 片 + 撤销 B 项豁免）** ｜ 作者：严守真 ｜ 版本 **v1.25** ｜ 日期 **2026-10-25**
- **判据来源（v1.3 校正）**：9 份系统 GDD 各 §8 —— `core-loop / bead-grid / tray-spawner / input-control / timer-gameover / powerups / save-progress / pause-settings`（timer 12 条、其余各 10 条）+ `score-combo` §8（冲刺 11 条）⇒ **合计 93 条**（`awk '/^## 8\./,0' | grep -cE '^[0-9]+\.'` 逐文件 = 12/11/10/10/10/10/10/10/10）。**v1.2 头部写「合计 61 条」已过期，实际只映射 71 条、22 条零映射**（缺陷 **BD-21**，v1.3 由 §H 补齐）。常量引 `systems-index.md §3`（含 §3.10 冲刺 / §3.11 续时）+ `art/accessibility.md`。
- **v1.3 新增判据来源（§G 可感知层）**：`design/ux/ux-spec.md §1-3 / §4 尾注 / §5 动效毫秒表 / §6.1–6.2 / §8 裁决表`（WXG-T-081）、`art/assets-spec.md §1.2`（`empty`/`wrong`/`hint` 三态规格）、`art/accessibility.md A2/A2b/A3/B3/C1/D1/E2`、`design/audio/audio-events.md §1 + §4 A05-01..27`（WXG-T-083，该文件明文「**供 WXG-T-084 引用**」）。**全部逐条标注来源，零自造数值。**
- 常量速查（来源 `systems-index §3`，**v1.4 按 v1.17 现文校正；v1.42 按 §3.4 丙档校正**）：`TRAY_BASE_SLOTS=24`（2 行×12，v1.42 / WXG-T-203 E1 矩阵定案）、`SPAWN_INTERVAL_DEFAULT=4.0s`（区间 [2.0,6.0]）、~~`NEEDED:DECOY=3:1`~~ → **v1.17 冻结 `DECOY_COLORS_MAX=0`（D 方案，杂色池关闭）** ⇒ 凡依赖 3:1 抽色的判据（**S4 §8-3**）现属**不可构造**，见 **BD-28**（本文不擅自删条，只标注）；`LEVEL_TIME_DEFAULT=300s`（区间 [180,420]）、`TIMER_URGENT_T=10s`、`TIMER_TICK=1.0s`、`GRID_MAX=13×12`、`STAR3_RATIO=0.32`、`STAR2_RATIO=0.12`、`DEMO_LEVEL_COUNT=8`、`POWERUP_FREE_USES=1`、`REGION_CLEAR_SLOTS=6`、`RANDOM_CLEAR_COUNT=5`、命中区外扩 8px（66²/62²，**重叠区归属以 §8-4 最近格心为准**，v1.4 按已裁口径补注）。
- 常量速查·冲刺（来源 `systems-index §3.10`，2026-09-12 冻结）：`SPRINT_TIME_DEFAULT=120s`（区间 [90,120]，越界回退默认）、`COMBO_WINDOW_S=5.0s`、`COMBO_STREAK_TIERS=[2,4,7]`→倍率 ×2/×3/×5（上限 ×5）、`SCORE_PER_BEAD=10`、`STAGE_BONUS_TIME=+15s`、`STAGE_CLEAR_BONUS=200+50×stageIndex`、C7 结算分 `stars×1000+round(ratio×1000)−powerupsUsed×50+(未用扩展?200:0)`、C8 裁决（stage 切换不断连；stage 加时与归零同帧 stage 优先）、伪震屏 scale 1.00→1.015→1.00 / 150ms。
- 常量速查·棋盘相机/手势（**v1.13 / WXG-T-169 新增**）：`IDENTITY_CAMERA={zoom:1,offsetX:0,offsetY:0}`、命中半径随缩 = `GRID_HIT_SIZE × zoom / 2`（正本 `tuning.ts::hitGridCell`；丁-3「布局即相机」⇒ 渲染与命中同源，**无逆变换通道**）、缩放界 `[fit, fit × CAMERA_ZOOM_MAX_SPAN]`、`computeFitZoom = min(1, (DESIGN_W−2·margin)/natW, (bandH−2·margin)/natH)`。**⚠️ 三个手势/相机数值 `BOARD_TAP_MOVE_THRESHOLD=8` / `BOARD_FIT_MARGIN=24` / `CAMERA_ZOOM_MAX_SPAN=2.5` 全为 `[待确认]` 工程占位，未进 `systems-index §3`（`tuning.ts` 注释明文「QA 不得据本组占位数值造判据」）⇒ 本行只作可构造性前提，不作验收值；冻结值以 §3 变更单为准，行为判据以 `input-control v2.5 §8` / `ADR-0015 §3.2–§3.4` 为准。** **v1.18 扩写（WXG-T-212）：同一禁令覆盖新增「棋盘缩放控件」常量组** —— `ZOOM_CTRL_PAD=12` / `ZOOM_SLIDER_HOT_W=240` / 缩放跨度 `CAMERA_ZOOM_MAX_SPAN=2.5` 均为 `[待确认]` 工程占位（`tuning.ts` 注释自陈「数值**未冻结**：与 `CAMERA_ZOOM_MAX_SPAN` 同批属 `systems-index §3` 真源（[待确认]）」）⇒ **⛔ QA 不得据本组占位数值造判据**（控件热区宽 / 内边距 / 轨道长 / 倍率档位一律不钉像素值），冻结值以 §3 变更单为准。**唯一例外：`ZOOM_CTRL_HOT = TOUCH_MIN = 88` 系派生自 §3 已冻结的 `TOUCH_MIN`（`accessibility C1`「视觉不变、热区扩大」），不属占位**；其底线判据仍归 §A4c.3 `TC-CAM-DEV-05`（真机 ⛔，**本轮零进账**）。⚠ 真源归属不变：§3 由设计轨维护，本 QA 不改笔。

**图例（v1.3 扩展，v1.4 更新阻塞现状）**：`[Node]` vitest ｜ `[Probe]` **G4 探针脚本**（复验轮 = `production/qa/beads/g4-probe-v1.1.mjs`；v1.0 基线 = `g4-probe.mjs`。Node 装配真实 `BeadsGame` + `NodePlatform`，可读渲染指令流/事件流/存档）｜ `[Harness]` 浏览器（✅ **v1.4：坐标污染已解除**——BD-07 已修（ADR-0011），本轮已可驱动真实 `InputManager`；唯 **BD-08 文字镜像仍不可验**（无像素通路）与 BD-19 `preview:frames` 不支持 beads）｜ `[Cocos]` 构建产物 + 浏览器截图（~~BD-20~~ **已关**；现被**屏幕层取证通路缺失**阻塞：无无头截图 / 无调色滤镜脚本，见报告 v1.1 §18.2 B1）｜ `[DevTools]` 微信开发者工具（**未装、无 AppID**）｜ `[Device]` 真机（**本轮不可执行**）。
**v1.6 追加（WXG-T-109）**：§I 三条用例改用 T-108 探针 `cocos-input-probe.mjs` 的 lane 标记 —— `[N]` 无头浏览器逻辑层（≈ 本图例 `[Node]` 族的产物道次）/ `[B]` 浏览器真实渲染像素级（≈ `[Cocos]` 已解锁像素道次）/ `[R]` 真机 · 微信宿主（= `[Device]`）；等价关系见 **§I** 节首。
**状态（v1.3 改为四态，废除「一律待实现」）**：`已验` ＝ 本轮实测成立 ｜ `FAIL(BD-nn)` ＝ 本轮实测不成立 ｜ `待执行` ＝ 判据已冻结但本轮未跑 ｜ `⛔不可测(原因)` ＝ 环境/实现阻塞，**禁止标绿**。

**v1.13 本轮取证范围声明（WXG-T-169，必读）**：本轮**只跑 `[Node]` vitest**（`games/beads` **489 passed / 44 files**；`packages/framework` **306 passed / 31 files**；`games/breakout` **239 passed**（回归对照）；`pnpm run check:arch` OK，1 条存量 WARN＝190 个编辑器产物）+ 两条只读命令级复核（`node --experimental-strip-types` 直调 `InputManager` 取快照形；`git diff -w` 定性 sync 现红）。**`[Probe]` 探针本轮未复跑 ⇒ 全文一切 `[Probe]` / `[Harness]` / `[Cocos]` / `[B]` / `[C]` / `[Device]` / `[R]` 读数仍属旧轮次，不得据 v1.13 读作新时基下的 PASS**（K-037 屏幕层取证缺口延续；K-051 纸面增量须落码差分复算）。逐条实跑结论：v1.0 基线见 `g4-regression-report.md §4`（19 组探针）；**复验轮（v1.1，26 组）见该报告 §13 改判表 + §14 处置状 + §17 §G 逐条可验道次**（本文各表原结论行按**追加不覆盖**纪律保留，其现态以 §G.4 与报告 §13 为准）。

---

## §分片索引（WXG-T-225 · 13 片，先看这张表）

> **本页只作索引**，判据正文全部落在下列分片；本页**不含判据**。
> 判据原文逐字搬迁、零改动零删除（K-051/K-053），差异仅限标题标记与各片头注。
> 路径缺省 = 本目录 `production/qa/beads/`；单文件硬阈 **16,000 tok**（B 项按文档类别分档：`production/qa/**` = ledger 16000）。

| # | 文件 | 范围 | tokens |
|---:|---|---|---:|
| 1 | `test-cases.md` | 本页（索引 + 迁移表 + 追加规则） | 19 |
| 2 | `test-cases-a-core.md` | 本片 = §A 头 + §A.0 / §A.0b / §A1–§A3；§A4 起（输入域）在下一片 | 4949 |
| 3 | `test-cases-a-input.md` | 本片 = §A4 / §A4b / §A4c / §A5；§B 起在下一片 | 11941 |
| 4 | `test-cases-b-f.md` | 本片 = §B–§F（派生 / 冲刺 / 道具 / 帧序 / 结算）；§G 起在下一片 | 5359 |
| 5 | `test-cases-g-perceptual.md` | 本片 = §G 可感知性判据（20 条）；§H 起在下一片 | 9670 |
| 6 | `test-cases-h-i.md` | 本片 = §H 未映射补编 + §I 宿主坐标归一化；变更记录与 §J 在下一片 | 5740 |
| 7 | `test-cases-history.md` | 本片 = 变更记录 + §J v2.0 判据迁移；§K 起在下一片 | 9519 |
| 8 | `test-cases-k-style.md` | 本片 = §K 头 + §K.0–§K.4（风格 / 面板 / 门禁 / 落档 / 凹槽）；§K.5 台账起在下一片 | 7238 |
| 9 | `test-cases-k-ledger-1.md` | 本片 = §K.5 台账前段（K.5.0 / K.5.1 / 至第 2 次补登）；第 3 次补登起在下一片 | 9149 |
| 10 | `test-cases-k-ledger-2.md` | 本片 = §K.5.1 第 3–11 次补登 + §K.6 / §K.7；§L 起在下一片 | 13585 |
| 11 | `test-cases-l-tint.md` | 本片 = §L tint 臂判据（L.1–L.4）；§M 起在下一片 | 1192 |
| 12 | `test-cases-m-menu.md` | 本片 = §M 头 + §M.1–§M.9；§M.10 质量门结论起在下一片 | 11261 |
| 13 | `test-cases-m-gate.md` | 本片 = §M.10 / §M.11 / BD-61 / §N / §O（质量门与缺陷收口）；本片为末片 | 6286 |

## §锚点迁移表（旧锚点 → 新文件；只到 § 级）

| 旧锚点（本页已无此节） | 新文件 |
|---|---|
| §A / §A.0 / §A.0b / §A1 / §A2 / §A3 | `test-cases-a-core.md` |
| §A4 / §A4b / §A4c / §A5 | `test-cases-a-input.md` |
| §B / §C / §D / §E / §F | `test-cases-b-f.md` |
| §G / §G.1 / §G.2 / §G.3 / §G.4 / §G.5 | `test-cases-g-perceptual.md` |
| §H / §H1 / §H2 / §H3 / §H.4 / §I | `test-cases-h-i.md` |
| 变更记录 / §J | `test-cases-history.md` |
| §K / §K.0 / §K.1 / §K.2 / §K.3 / §K.4 | `test-cases-k-style.md` |
| §K.5 / §K.5.0 / §K.5.1 / 第 1–2 次补登 | `test-cases-k-ledger-1.md` |
| 第 3–11 次补登 / §K.6 / §K.7 | `test-cases-k-ledger-2.md` |
| §L / §L.1 / §L.2 / §L.3 / §L.4 | `test-cases-l-tint.md` |
| §M / §M.1 … §M.9 | `test-cases-m-menu.md` |
| §M.10 / §M.11 / §N / §O | `test-cases-m-gate.md` |

## §引用与追加规则

1. **引用**一律写分片路径：`test-cases-<片>.md#§…`。⛔ 不再写 `test-cases.md#§A…` —— 本页已无该节，链接必空。
2. **新增判据**追加到所属分片末尾，并回写本页 §分片索引 的 tokens；跨片新增须先在本页登记归属。
3. ⛔ **不得在本页追加判据正文**（会把整读悬崖搬回索引页）。
4. 任一分片超 **16,000 tok** 即须再拆，⛔ 不得靠 `ctx/budget-exempt.json` 豁免放任膨胀。
