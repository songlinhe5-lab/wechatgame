# beads · EP-13 跟进 · 选关墙「空槽→锁格」落码 Story（epics-beads-ep13-fu-wallcell）

> **本件性质**：EP-13 大关选关页落码批的**跟进 Story**（承 `epics-beads-ep13.md` §7 后置占位）。任务号 **待宿主领号**（口径同 `epics-beads-ep13.md` §8：本件不代写 `TASKS.md`）。

## 0. 权威来源（冲突按此序）

1. `games/beads/design/gdd/systems-index.md` §3 冻结常量（**本件零涉**：`WALL_COLS / WALL_ROWS / WALL_CAPACITY` 不在 §3，属 `tuning.ts` 派生区）。
2. `games/beads/design/ux/arc-level-select-spec.md`：§4 行「越界空槽」「未解锁格」（**2026-10-17 晚改裁：合形**，同为灰色珠阵图 + 小锁 + 无星）；§3 线框图（**3×3 = 9 格**，v1.3）；Q15 已改裁。
3. 用户裁定（2026-10-17）：右上两格（列 2、行 0–1）由空槽补锁；空槽 = 锁格（无纯虚线）。
4. 现码事实：`games/beads/src/view/meta-view.ts:1189-1200`（`drawWallCell` 对「越界 / 未解锁」**两条路径都**调 `drawDashedSocket`）；`games/beads/src/config/tuning.ts:1428-1436`（`WALL_COLS = 4` / `WALL_ROWS = 3` / `WALL_CAPACITY = 12`）。

## 1. 目标

把选关墙格的视觉与规格对齐：**未解锁格与越界空槽同形（灰色珠阵 + 小锁 + 无星）**，并把墙从 **4×3 = 12** 收到 **3×3 = 9**（与规格 v1.3 与云端基底一致）。**逻辑判据不变**（零事件、不消费、零热区语义不变，`levelIdx+1 > maxUnlockedLevel` 与越界仍是同一闸门臂）。

## 2. In / Out

**In**
- ① `drawWallCell`：未解锁与越界统一走新 `drawLockedWallCell`：灰色珠阵缩略（不画彩色珠）+ 小锁（复用 `ui_menu_badge_locked` 素材，与主菜单卡同源）+ 无星（`STAR_LABELS` 不画）。删除该路径上的 `drawDashedSocket` 调用（虚线空槽退场）。
- ② 墙几何 `WALL_COLS 4 → 3`、`WALL_CAPACITY 12 → 9`，`WALL_GRID_W = 3×120 + 2×22 = 404`（`tuning.ts` 派生区）；起点与行序按规格 §3 v1.3（`startX 173`、`topY 857`，以现码 `WALL_GRID_TOP` 同源推导，不手写第二份）。
- ③ `beads-shell.ts::_rebuildWallSlots` 截断由 `WALL_CAPACITY` 自动跟随（**核对**：`min(n, WALL_CAPACITY)` 不写死 12）。
- ④ 测试换形：`meta-menu-wall.test.ts`（「4×3 共 12 格」→「3×3 共 9 格」）、TC-MN-06 同步；新增断言「未解锁 = 越界 = 灰图 + 锁 + 无星 + **无虚线**」。
- ⑤ K-6 台账**重采**（墙格数变化 ⇒ `wall.rows3` 与 Δ 系列读数失效，见 §5）。

**Out**
- 灰色珠阵的**具体色值**（art 定，见 §4 阻塞项；本件不新增 hex，只在既有色表内派生）。
- 第 9 格 BOSS 的金边 / 皇冠 / 字样（保留，BOSS 身份标记）。
- 按下态（EP13-S5）、走马灯（S4）、0 心链路（S3）。
- `games/beads/cocos` 镜像的美术资源（仅同步镜像代码，若存在）。

## 3. 验收（DoD，逐条可测）

| # | 判据 | 证据落点 |
|---|---|---|
| A1 | 墙 = 9 格，3 列 × 3 行，列距 22、格宽 120、网格宽 404 | `meta-menu-wall.test.ts` ›「橱窗 = 3×3 共 9 格」 |
| A2 | 越界空槽（`levelIdx === undefined`）与未解锁格**逐字同形**：灰图 + 小锁 + 无星；视图中**无 `drawDashedSocket` 调用** 于墙格路径 | 新测 `arc-level-select.test.ts` 反例臂（用虚线 ⇒ 红） |
| A3 | 已解锁格不变（彩色珠拼缩略 + 星带；当前关描边 4 vs 2） | 既有断言不回退 |
| A4 | 零事件：未解锁 / 越界 tap 仍 `pick-level` 不发、不扣心、不消费 | 既有 `arc-level-select` 闸门测 |
| A5 | `_rebuildWallSlots` 截断到 9，关表长 > 9 时溢出仍按 S6 Out（不实现） | `beads-shell` 既有测 |
| A6 | `verify` 全绿；镜像一致（`framework:sync:check` 与 beads 镜像检查，若存在） | `pnpm run verify` |
| A7 | K-6 台账重采，`wall.rows3`、Δ 系列、地板读数更新并注明 `capturedFrom` | `risks.md` §4b + `menu-primitives-k6.test.ts` |
| A8 | **真机观感**（灰度缩略能否认出「是这一关的作品」、锁图与格底对比） | `[待真机]`，不作 DoD 阻塞 |

## 4. 阻塞 / 依赖

- **[TODO-ART-1]** 灰色珠阵的灰度规则：`lightness` 还是 `opacity`、底色 `slot` 用哪一档。art 未定则 A2 中「灰」的具体值**不写死**，只断言「非彩色（饱和度 ≤ 阈值）」。
- **依赖**：`ui_menu_badge_locked.png` 已在位（`assets/textures` 主包）。
- **不依赖** EP-13 未落码项（S1–S5 已 READY；本件基于其既有墙结构）。

## 5. 风险

| 风险 | 缓解 |
|---|---|
| K-6 台账失效：墙从 12 格降到 9 格，`wall.rows3 = 1518`、`floor 504`、TC-MN-27/28 数字全部过期 | A7 强制重采；旧读数**划线留档**，不改写历史（K-053） |
| 规格 §3 线框图 3×3 与代码 4×3 的漂移会持续到本件落码前 | 本件即为收口，落码后在 `arc-level-select-spec.md` §3 标注「代码已对齐」 |
| 越界空槽改为锁图后，玩家可能误以为「有关可玩」 | 锁图 + 无星 + 零热区已是规格裁定；观感由 A8 真机抽检 |

## 6. 状态

| 项 | 值 |
|---|---|
| Story | EP13-FU-1 = **WXG-T-290**（已领号入台账，沿本件拆分号不另领） |
| 工程侧 | ✅ **已落码**（A1–A7，提交本批；A7 读数 = `risks.md §4b`「3×3 + 锁格重采」行） |
| 美术侧 | **[TODO-ART-1] 仍待定** ⇒ 本批按 §4 兜底口径只断言**零饱和**（R=G=B），⛔ 未写死灰阶；定值后只需补一条数值断言 |
| 真机 | A8 `[待真机]`，不作 DoD 阻塞 |

### 6b. 落码实况与本件预期的偏差（直录，⛔ 不自拍改判据）

| # | 本件预期 | 实况 | 后果 |
|---|---|---|---|
| 1 | In② 手写 `startX 173` / 网格宽 404 | `WALL_GRID_W` 与 `startX` 在现码是**派生式**（列数居中算）⇒ 改 `WALL_COLS` 自动得 404/居中 ⇒ **零手写坐标** | 好事：少一处会漂移的字面值；规格 v1.3 行的 173/404 作为**校验值**仍成立 |
| 2 | In① 删墙格路径的 `drawDashedSocket` | 函数**保留**（橱窗空 Boss 位 `meta-view.ts:952` 与 `:1082` 仍在用）⇒ 只拆掉墙格那一条腿 | ⛔ 不得误删他屏图元 |
| 3 | In① 未解锁 = 灰阵 + 锁 + 无星 | 越界槽**拿不到关卡引用** ⇒ 画不出该关灰阵（数据驱动，不拿别关的图凑）⇒ 只画格底 + 锁 + 无星 | 与未解锁格“逐字同形”差一层珠阵；行为判据仍逐字相同（零事件） |
| 4 | 锁尺未钉 | 取既有徽标档 `MENU_BADGE.d`（64）+ 位图未就绪回落「锁」字圆章 | 零新数值；美术定稿若改尺需回写本件 |
| 5 | A7 台账重采 | 读数出自**视图直调腿**（合成数据），没有 sha 指纹 | `risks.md §4b` 已标「生产腿终值待 QA 重取」 |

**实测代价直录**：旧台账首日档 = 696（1 实格 + 11 虚线槽），新档 = **1423**（锁格也画灰阵）⇒ 合形让**首日不再比满载便宜**（+727 命令）；可退空间 1014 → **1042**（回退序仍有效）。
