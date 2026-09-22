# 元游戏与图鉴 · §3 变更单草案分片（meta-ui changelog）· beads

- 项目：`games/beads` · 任务号 **WXG-T-167** · 正本：`gdd/meta-ui.md`（本文件是其 **§10 变更单草案** 的分片，v0.3 外移；本文**只放待批草案**，正本变更记录仍在 `meta-ui.md §9`）
- 外移动机与判例：`meta-ui.md` 逼近 `ctx:check` B 门 8000 估算 tokens（v0.2 余量仅 8）⇒ 分片而非申请豁免；形态沿 `systems-index.md` ↔ `systems-index-changelog.md`（先例 = WXG-T-062 / commit `cb47b68`）。
- 纪律不变：**本文件是待批文本，不得被复制进 `systems-index.md`；所有数值留空**，冻结须用户 + 主理人拍板并走 `systems-index §3/§6` 变更单流程（判例 WXG-T-093 串行落笔避并写）。

## 1. §3 变更单草案（**未提交、需主理人 + 用户拍板**；本轮 §3 与 §6 一字未动）

> 本节是**待批文本**，不得被复制进 `systems-index.md`。每条含：现文依据 / 为何可能要变 / 变更类型 / 连带面。**所有数值留空。**

| # | 条目 | 依赖 Q | 类型 | 为什么 + 连带面（本文未做的事：不填数、不改 §3） |
|---|---|---|---|---|
| CH-1 | §3.3 `GRID_MAX_COLS` / `GRID_MAX_ROWS` | Q3（+Q1/Q11） | 数值 + 注释重写 | 现值理由**自证是几何容纳**（13×52−2 ≤ 可用宽、12×52−2 ≤ `PUZZLE_BAND` 高），解除须以缩放落地与真机取证为前置（`ADR-0015 §4.3` 的 `[R]/[C]` 项**未执行**）。连带面：`config/levels.ts` BOOT 校验界、`tuning.ts::stageParamsFor()`（以 `GRID_MAX` 为冲刺格数上界）、`bead-grid §8-8`（13×12=156 极端关坐标）、`save-progress §8-9`（156 次落子写档）、`assets-spec` 图元基线（含 ④=1828）与包体（§3.9）、`ADR-0015 §5-5` 复评触发。**扩容数值本单不估**（K-051） |
| CH-2 | §3.13 `MISPLACED_PAIRS_MIN/MAX`（k 区间）与逐关曲线 | Q10（+Q3） | 数值 或 仅数据侧 | 盘面变大而 k 不变 ⇒ 错位密度稀释（**可预见的体验后果，非数值承诺**）。若裁上调：`validateSwaps` 区间、`LEVEL_TIME_OVERRIDE` = clamp(k×45s,120,420) 的**上界是否触顶**须同批答、`SPRINT_K_CURVE` 封顶（现以 `MISPLACED_PAIRS_MAX` 接管上界）、QA 硬判据。若只走丙（区间不动、逐关值重排）⇒ 变更落在 levels JSON，**不进 §3** |
| CH-3 | §3.4 `TRAY_BASE_SLOTS` / `TRAY_EXPAND_SLOTS` | Q10 | **已裁定（2026-09-22，WXG-T-203）**：v1.42 丙档 12→**24**/12（2 行×12，扩展后 36 槽/3 行） | 独立变更单 `proposals/tray-capacity-large-board-playability.md`（E1 两轮 bot 矩阵定案：32×32 reg60 部分错位下 tray24=90–96 taps 达标、tray12 全超线）；用户拍板 D1=丙・D2=接受 v2.1 深度降格。原挂号事实仍有效：扩容 ⇒ 同色珠绝对数上升 ⇒ 部分收纳触发频率**下降**（解压方向），频率须落码后 playtest 实测（K-051，归 E3） |
| CH-4 | §3.14 `STAMINA_START_COST` **语义行**（数值 1 不动） | Q7 | **仅行为语义**（K-053 反转批） | 若裁「整图扣」⇒ 现文「普通局开局消耗」的「新局」集合改变，走反转批固定顺序：先钉语义 → 码与测试同批 → **三文档一批**（systems-index 版本头 + S 表 + §3.14 现文 + S9/`pause-settings` GDD）→ 台账留旧裁定括注 → **显式声明「无 §3 数值漂移」** → 清因此变死的接口；文档面拿特征短语（「扣 1 心」「全新开当前关」「不保留进度」）`grep -rn` 扫 `design/`+`production/`+代码注释全域，命中清单即回写清单（K-053 追记：枚举清单不够） |
| CH-4b | §3.14 现文「第二模式入口当前不存在，其余模式消耗不冻结」 | Q8（若裁丙）+ Q7 | **文本事实订正** | 图鉴若成为独立模式，本句即刻失真（不是数值变，是**事实陈述过期**）；须与 `STAMINA_START_COST` 行同批复注，并把该模式的消耗显式裁为「冻结 / 不冻结」 |
| CH-5 | 关卡校验器（`levels-spec §2/§8` + `config/levels.ts`） | Q1/Q2/Q3/Q11 | 判据扩面（非 §3 数值） | 「图→格→关卡」映射层需新增完备性校验：每图格数、格与 LevelDef 的存在性一一对应、切块来源（Q11-乙）下子块是否各自满足可解性与 §3.13 交换校验。形态沿 breakout `validateLevel()` 判例；报错格式沿用 `L{id} row{i} col{j}` 并扩图 id |
| CH-6 | §4 事件总线 `meta:overlay` 的 `id` 值域 | Q4 | **§4 文本**（非 §3 数值） | 现文值域列举 settings/signin/profile/stamina/collection/leaderboard，**不含**图鉴页；补值域属机械登记，payload 形态 `{id, open}` **不变、不新增字段、不新造事件**。**另登观察项**：现码 emit `{open, name}`（`beads-shell.ts:257`）与 §4 登记的 `id` **字面不一致** ⇒ 归主理人核对（本文不判谁错） |
| CH-7 | §3.2 `BEAD_COLOR_MAX`（=8） | Q6/Q11 | 数值（**本文不主张改**） | 仅在「整图切块 / 密度规则要求更多色」被裁定为必要时才进本单；现色板 10 色、单关 8 色上限的关系（`BEAD_PALETTE` ⊃ `BEAD_COLOR_MAX`）本轮不动。挂号防的是「Q6 用乙类显式规则解密度」时撞上现值 |

**变更单提交纪律**：Q3–Q11 裁完 → 本表逐条转正式变更单 → 主理人串行落 `systems-index §3/§6`（避免并写竞态，判例 WXG-T-093）→ 通知下游（程基岩拆 Epic 前须见冻结值；QA 五件套从转正后的 §8 重导出；art 轨另答 C-5）。
