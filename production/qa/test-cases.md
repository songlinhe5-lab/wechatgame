# 《砖阵》(Breakout) 测试用例 · Test Cases

- 任务号：WXG-T-004 ｜ 作者：严守真 ｜ 版本 v1.0 ｜ 日期 2026-09-11
- 关联：`test-plan.md`（门控 G4）、`smoke-tests.md`、`bug-severity.md`
- **数值真源**：`design/gdd/systems-index.md §3`（❄️ 冻结令，全工作室唯一真源）及其派生文档。**每条判据均注明来源**，不自行发明数值。

## 图例

**环境**：`[Node]` Node/vitest ✅本轮 ｜ `[Harness]` 浏览器 harness ⚠️待补 ｜ `[DevTools]` 微信开发者工具 ⛔ ｜ `[Device]` 真机 ⛔

**本轮状态**：
- ✅ **数据/框架侧可独立验证**（关卡数据、架构守卫、存档版本处理内核；已通过）
- 🚫 **`blocked-by: WXG-T-001`**（依赖 GDD-对齐实现落地）——当前 `games/breakout/src` 是**另一套实现**，故这些用例环境具备但**预计 FAIL**，待 程基岩 对齐后回归
- ⛔ **环境不可**（需 harness / 真机）

> **⚠️ 口径已裁定（主理人 2026-09-11）**：以 GDD `systems-index §3` 为唯一权威，**实现向 GDD 对齐**；`save` 存储键用 `wxgame.breakout.save`、字段结构以设计版为准；砖块 5 类全做（含炸弹 68px、S/T/G）、道具 6 定义/3 实装、多球/续进/BOOT/减弱动效均做；连击 `COMBO_STEP=3`、上限 ×5。
> **因此**：除下方"可独立验证"的少数用例外，**其余全部功能用例统一打 `blocked-by: WXG-T-001`**（不再逐条区分 ⚠️/🚧）。
> **可独立验证（不 blocked）**：`TC-LEVEL-01..05`（数据静态校验，见 `levels-validation.md`）、`TC-ARCH-01..03`（架构守卫）、`TC-SAVE-01/02/06/07/10`（存档版本/合法性/无 PII——框架 `SaveManager` 已具备的内核行为）。

---

## 统计总览

| 分组 | 用例数 | 可立即判定 | `blocked-by: WXG-T-001` | 需 harness/真机 |
|---|---|---|---|---|
| §A 硬判据（A1~A8） | 54 | 5 | 45 | 4 |
| §B 其余功能 | 40 | 8 | 28 | 4 |
| **合计** | **94** | **13** | **73** | **8** |

**分环境占比（任务口径）**

| 桶 | 数量 | 占比 | 含义 |
|---|---|---|---|
| **可立即判定**（本轮跑） | **13** | 14% | 关卡数据静态校验 5 + 架构守卫 3 + 存档框架内核 5（`TC-LEVEL-01..05` / `TC-ARCH-01..03` / `TC-SAVE-01,02,06,07,10`） |
| **`blocked-by: WXG-T-001`** | **73** | 78% | 环境具备（Node）但依赖 GDD-对齐实现落地后回归 |
| **需 harness / 真机** | **8** | 9% | `⛔` 纯环境依赖（减弱动效观感、触控热区、画布适配等） |
| **合计** | **94** | 100% | — |

> 口径更新（主理人裁定后）：原"待裁定"阻塞已消除——① 以 GDD `§3` 为权威、② 全系统均做，故 §A/§B 的 73 条功能用例统一为 **`blocked-by: WXG-T-001`**（不再区分"待裁定"与"待实现"）。"可立即判定"的 13 条**当前实现已可跑**（关卡数据/架构/存档内核）。


---

# §A 硬判据用例（G4 门控核心）

## A1 · 炸弹波及边界（`EXPLODE_R = 68`，含边界）

> **来源**：`bricks.md §2.6 B`（半径 68px，按砖块中心欧氏距离判定，d ≤ 68 含边界）；`bricks.md §5`（`EXPLODE_R`=68）；`systems-index §3.3`（列 pitch 68 / 行 pitch 40）；`assets-spec.md §1.5`（`vfx_bomb_hit` 十字 5 块；"判定比较符 d ≤ 68（含边界）"，视觉与伤害同符同范围）。
> **几何**：68² = **4624**。

| ID | 用例 | 环境 | 步骤 | 预期 / 判据 | 本轮状态 |
|---|---|---|---|---|---|
| TC-BOMB-01 | **边界命中（水平邻）** | `[Node]` | 炸弹与水平邻砖中心距 dx=68, dy=0；引爆 | `dx²+dy² = 4624` → **4624 ≤ 4624** → **波及**（含边界） | 🚧 Q3 未实现 |
| TC-BOMB-02 | **对角不波及（边界外）** | `[Node]` | 对角邻 dx=68, dy=40；引爆 | `68²+40² = 6224` → **6224 > 4624** → **不波及**（对角约 78.9px） | 🚧 Q3 未实现 |
| TC-BOMB-03 | **垂直邻波及** | `[Node]` | 垂直邻 dx=0, dy=40；引爆 | `1600 ≤ 4624` → **波及** | 🚧 Q3 未实现 |
| TC-BOMB-04 | **净结果 = 十字 5 块** | `[Node]` | 引爆 3×3 中中心炸弹 | 受影响 = **自身 + 左右邻 + 上下邻 = 5 块**（4 个对角不受影响）；每砖扣 1 HP | 🚧 Q3 未实现 |
| TC-BOMB-05 | **连锁递归上限 8 层** | `[Node]` | 链式炸弹 > 8 层 | 递归到第 8 层即止，不无限递归、不卡死（来源 `bricks.md §2.4/§6.3`） | ⚠️ 未实现 |

## A2 · `S` 钢砖（不可破坏）

> **来源**：`bricks.md §2.6 S`；`levels-spec.md §2.2`。

| ID | 用例 | 环境 | 步骤 | 预期 / 判据 | 本轮状态 |
|---|---|---|---|---|---|
| TC-STEEL-01 | 血量 ∞ / 分值 0 | `[Node]` | 球多次撞钢砖 | hp 永不减（`hp=Infinity` 或哨兵，`indestructible:true`）；命中**不加分、不计连击** | ⚠️ 用 `X` 墙近似，语义需对齐 |
| TC-STEEL-02 | **只派发 `ball:hitBrick`，永不 `brick:destroyed`** | `[Node]` | 撞钢砖，订阅事件 | 收到 `ball:hitBrick`（音效/火花用）；**绝不**收到 `brick:destroyed` | ⚠️ 事件名待回写(Q7) |
| TC-STEEL-03 | **不计入通关条件** | `[Node]` | 清空全部可破坏砖，仅剩钢砖 | **立即判清关**（`remainingBricks` 不含钢砖；`bricks.md §6.7` 兜底） | ⚠️ 预计 FAIL |
| TC-STEEL-04 | **免疫道具/爆炸** | `[Node]` | 炸弹波及钢砖 / 激光打钢砖 | 不受伤害、不破碎、**不触发二次爆炸**；不因任何道具被移除（`bricks.md §2.6 S`） | 🚧 Q3 未实现 |
| TC-STEEL-05 | **镜面反弹不衰减** | `[Node]` | 球撞钢砖前后比速 | 反弹为**镜面反射**且**速度不衰减**（restitution=1） | ✅ 可执行（需按 GDD 调整场景） |
| TC-STEEL-06 | 钢砖总量 ≤ 全关 20% | `[Node]` | 校验 L1~L5 | 每关钢砖数 / 总砖数 ≤ 20%（设计约束，`levels-spec.md §5.8`） | ⚠️ 依赖 Q2 |

## A3 · `T` 加固砖（2 HP，两态）

> **来源**：`bricks.md §2.6 T`。

| ID | 用例 | 环境 | 步骤 | 预期 / 判据 | 本轮状态 |
|---|---|---|---|---|---|
| TC-TOUGH-01 | 2 次命中才碎 | `[Node]` | 连撞 2 次 | 第 1 次：HP 2→1，**不计分/不掉落/不派发 `brick:destroyed`**；第 2 次：破碎、计 **250** 分 | ⚠️ 当前分值 25，需对齐 |
| TC-TOUGH-02 | 仅"完好 / 受损"两态 | `[Node]`/`[Harness]` | 命中 1 次后观察 | 进入**受损态**（亮度 −30%、裂纹加深），**视觉可辨且不靠颜色** | ⚠️/⛔ |
| TC-TOUGH-03 | 重开关卡完整重置 | `[Node]` | 打伤硬砖 → 重开本关 | HP 与**裂纹视觉完全重置**，无残留（`bricks.md §6.6`） | ⚠️ 预计 FAIL |

## A4 · `G` 金砖（500 分，掉落 ×3，非必掉）

> **来源**：`bricks.md §2.6 G`（分值 500；掉落率 = `powerupDropRate × 3` **封顶 1.0**；**非必掉**，终裁勿反复）；示例 L2/L4 基础 0.14 → 金砖 0.42。

| ID | 用例 | 环境 | 步骤 | 预期 / 判据 | 本轮状态 |
|---|---|---|---|---|---|
| TC-GOLD-01 | 分值 500 × 倍率 | `[Node]` | 击碎金砖 | 得分 = 500 × 当前连击倍率（普通砖 5 倍，`bricks.md §2.6 G`） | 🚧 Q2/Q3 |
| TC-GOLD-02 | 掉落率 = 基础 ×3，封顶 1.0 | `[Node]` | 固定 seed 大量采样 | 期望掉落率 = `min(1.0, powerupDropRate × 3)`；L2/L4 为 `0.14×3 = 0.42` | 🚧 Q3 未实现 |
| TC-GOLD-03 | **非必掉**（可连续不掉） | `[Node]` | 击碎多枚金砖 | 存在"不掉落"结果，**不强制必掉**（终裁：维持 ×3 倍率，`bricks.md §2.6 G`） | 🚧 Q3 |
| TC-GOLD-04 | 波及引爆仍按金砖倍率掉落 | `[Node]` | 炸弹连锁引爆金砖 | 仍按金砖掉落倍率判定（`bricks.md §2.6 G` 边界②） | 🚧 Q3 |
| TC-GOLD-05 | 场上道具满 3 时丢弃 | `[Node]` | 场上已有 3 道具再破金砖 | 判定掉落后**不生成**（丢弃，`bricks.md §2.6 G` 边界③、`powerups.md §2.1`） | 🚧 Q3 |

## A5 · 存档降级（不崩溃 / 进 L1 / 回写合法值）

> **来源**：`save-progress.md §6.3 / §6.8 / §6.9`、§8 验收；`core-loop.md §6.6`；`ux-spec.md §2` BOOT 降级。

| ID | 用例 | 环境 | 步骤 | 预期 / 判据 | 本轮状态 |
|---|---|---|---|---|---|
| TC-SAVE-01 | `version > 1`（如 99） | `[Node]` | 写入 `{version:99,...}` 后启动 | **不崩溃**；重置为初始存档、**进 L1**；**不解析未知字段** | ✅ 逻辑可执行（`SaveManager` 已支持；键/结构需对齐 Q6） |
| TC-SAVE-02 | 无 `version` / 非数字 | `[Node]` | 写入 `{...无version}` | 同上：重置初始存档、进 L1 | ✅ 同上 |
| TC-SAVE-03 | `currentLevel` 越界 = 0 / 99 | `[Node]` | 写入越界 `currentLevel` | **不崩溃**，降级为"首次"进 L1，**回写为 1** | 🚧 字段未实现(Q3/Q6) |
| TC-SAVE-04 | `currentLevel` 非数字（`"x"`） | `[Node]` | 写入非数字 | 同上：进 L1 并回写 `1` | 🚧 |
| TC-SAVE-05 | `maxUnlockedLevel` 越界/非数字 | `[Node]` | 写入越界值 | `clamp` 到 1~5；非数字→1（`save-progress.md §6.8`） | 🚧 |
| TC-SAVE-06 | `bestScore` 为负/非数字 | `[Node]` | 写入负数 | 归一为 `0` | ✅ 可执行（`validateBreakoutSave` 已拒负；语义对齐 Q6） |
| TC-SAVE-07 | 损坏 / 半截 JSON | `[Node]` | 写入非法 JSON 串 | `try/catch` 回退默认值，**保留备份键**（`§6.2`），不崩溃 | ✅ 逻辑可执行 |
| TC-SAVE-08 | **降级优先于报错** | `[Node]` | 以上任一非法情形 | **无异常抛出、启动不中断**；修正后**立即落盘**（§6.3/§6.8） | ✅/🚧 |
| TC-SAVE-09 | `allCleared=true` 且 `currentLevel` 非法 | `[Node]` | 二者不一致 | 以"重置初始存档、进 L1"为准（宁重打不卡死，§6.9） | 🚧 |
| TC-SAVE-10 | 存档无 PII | `[Node]` | 检查落盘内容 | 只含游戏数据 + 开关，**不含任何身份信息**（§6.7/§8） | ✅ 可执行 |

## A6 · 连击与失球

> **来源**：`score-combo.md §2.2/§6`；`life-gameover.md §2.1/§2.2/§8`；常量 `COMBO_STEP=3`、`COMBO_MULT_MAX=5`、`START_LIVES=3`（`systems-index §3.5`）。

| ID | 用例 | 环境 | 步骤 | 预期 / 判据 | 本轮状态 |
|---|---|---|---|---|---|
| TC-COMBO-01 | 倍率阶梯 | `[Node]` | combo 0..12+ | `comboMult = min(5, 1+floor(combo/3))` → 0-2×1 / 3-5×2 / 6-8×3 / 9-11×4 / ≥12×5 | ⚠️ 当前 comboStep=4/上限4，需对齐 |
| TC-COMBO-02 | **断连条件** | `[Node]` | 分别触发撞挡板 / 失球 / 关卡切换 / 重开 | 任一发生 → combo 归零、倍率回 ×1 | ⚠️ 预计 PASS（逻辑在） |
| TC-COMBO-03 | 同帧多砖按事件顺序逐块计 | `[Node]` | 炸弹连锁一次碎多砖 | 按事件到达顺序逐块 +1 再算倍率，**越靠后倍率越高**（有意设计，§6.1） | 🚧 Q3 |
| TC-COMBO-04 | 跨临界取后值 | `[Node]` | combo 2→3 | 第 3 块砖本身享受 **×2**（先自增再算，§6.2） | ⚠️ |
| TC-COMBO-05 | 撞板同帧破砖 | `[Node]` | 球同时撞板 + 破砖 | 先结算砖块计分，再重置 combo —— **该砖仍计入连击**（§6.3，依赖 S1 update 顺序） | ⚠️ |
| TC-LIFE-01 | 单球丢失扣 1 命 | `[Node]` | 最后一次失球 | `lives -= 1`、combo 重置；`lives>0` → 回 READY（1.5s 后自动发球） | ✅ 可执行 |
| TC-LIFE-02 | 多球丢一球不扣命 | `[Node]` | 场上多球时丢 1 | 若场上仍有其他球在飞 → **不扣命** | ⚠️ 多球未实现 |
| TC-LIFE-03 | **3 命耗尽 GameOver** | `[Node]` | 连续失球 3 次 | 第 3 次（最后一命）→ `GAME_OVER`，**不早不晚**（§8） | ✅ 可执行 |
| TC-LIFE-04 | 终局慢放 | `[Harness]`/`[Node]` | 最后一次失球 | 球速瞬时 0.3×、持续 400ms，**不早于失球、不晚于 GameOver**（§8） | ⚠️/⛔ |
| TC-LIFE-05 | 加命超上限转分 | `[Node]` | `lives==5` 再拾加命 | 转 **+500 分**（不浪费、不破上限，§6.3） | 🚧 Q3 |
| TC-LIFE-06 | 重开去抖 | `[Node]` | 连点"重新挑战" | 300ms 去抖，一次点击只重置一次（§6.5） | ⚠️ |
| TC-LIFE-07 | **清关与失球同帧 → 清关优先** | `[Node]` | 最后一块砖破碎同帧球出界 | 判 **LEVEL_CLEAR**，不扣命（§6.2、`core-loop.md §6.4`） | ⚠️ 预计 FAIL/未覆盖 |

## A7 · 减弱动效开关（关停 / 保留清单）

> **来源**：`assets-spec.md §6.1`（关停）/ `§6.2`（保留）/ `§6.3`（红线一致性）；`ux-spec.md §7`；`systems-index §3.7`。

| ID | 用例 | 环境 | 步骤 | 预期 / 判据 | 本轮状态 |
|---|---|---|---|---|---|
| TC-A11Y-01 | 开启后**关停项不播放** | `[Harness]`/`[Node]` | `reduceMotion=true`，触发各事件 | 屏震=0、破碎粒子=0、钢砖火花=0、过关彩带=0、球拖尾=0、炸弹冲击波圆环关闭、面板缩放改纯淡入、霓虹呼吸关闭、倍率脉冲关闭（§6.1 全 9 项） | 🚧 开关未实现(Q3) |
| TC-A11Y-02 | 开启后**保留项仍播放** | `[Harness]` | 同上 | 撞砖白闪 80ms、砖块 160ms 缩放淡出、得分飘字 600ms、受损态（−30%+裂纹）、生命点/关卡号更新、UI 淡入、球运动反弹（§6.2 全 7 项） | ⛔ |
| TC-A11Y-03 | 关停不改色盲三重编码/对比度 | `[Harness]` | 开启减弱动效 | 不移除色盲编码、对比度、文字放大（§6.3） | ⛔ |
| TC-A11Y-04 | 闪烁安全 | `[Harness]` | 全局 | 保留的闪烁 **≤3Hz**、单次 ≤300ms；屏震 ≤120ms / ≤6px（§6.3、`systems-index §3.7`） | ⛔ |
| TC-A11Y-05 | 开关持久化 | `[Node]`/`[Device]` | 切换后重启 | `reduceMotion` 写入存档并重启保持（§6 头部、S8） | 🚧 |
| TC-A11Y-06 | 提示文案 | `[Harness]` | 打开设置 | 显示"减弱动效：关闭屏幕震动与粒子特效"（§6.3 建议） | ⛔ |

## A8 · 暂停计时正确性（硬依赖，专项）

> **来源**：`pause-settings.md §2.1/§6/§8`；`core-loop.md §5/§6.1`；`powerups.md §2.4/§6.5`。

| ID | 用例 | 环境 | 步骤 | 预期 / 判据 | 本轮状态 |
|---|---|---|---|---|---|
| TC-PAUSE-01 | **暂停期间玩法计时不推进** | `[Node]` | 注入固定 `dt` 序列，中途 `onPause` 推进 N 帧再 `onResume` | 暂停期间：球不动、道具不倒计时、飘字冻结、慢放冻结（`update(dt)` 不推进游戏逻辑） | ⚠️ 机制在（`paused` 无 onUpdate），需补显式断言 |
| TC-PAUSE-02 | 道具/效果计时器可暂停 | `[Node]` | 拾 expand 后暂停超时长 | 暂停时长**不计入** 15s 计时；恢复后继续（`powerups.md §6.5`） | 🚧 Q3 未实现 |
| TC-PAUSE-03 | **READY 暂停 → 恢复不重置自动发球计时** | `[Node]` | READY 剩 0.8s 时暂停 3s 再继续 | 恢复后从**剩余 0.8s** 继续（`pause-settings.md §6.2`） | ⚠️ **预计 FAIL**（Q8：`transition()` 会 `_elapsed=0`） |
| TC-PAUSE-04 | 状态机 elapsed 归零风险 | `[Node]` | 断言 phaseElapsed | 暂停不改变"当前局状态"，仅冻结 update（`core-loop.md §2`）；恢复语义须保留剩余计时 | ⚠️ Q8 |
| TC-PAUSE-05 | 暂停中再次暂停幂等 | `[Node]` | 重复 `onPause` | 忽略，不叠层（`pause-settings.md §6.1`） | ✅ 可执行 |
| TC-PAUSE-06 | 连续 onShow/onHide 幂等 | `[Node]`/`[Device]` | 快速连续生命周期 | 不产生多次暂停面板叠层（`pause-settings.md §6.6`） | ⚠️/⛔ |
| TC-PAUSE-07 | "继续"回到正确子状态 | `[Node]` | 分别从 READY / PLAYING 暂停再继续 | 回到暂停前子状态（PLAYING 或 READY），**直接恢复无倒计时**（§4/§6.2） | ✅ 可执行 |

---

# §B 其余功能用例

## B1 · 状态机与入口（BOOT 分流）— 来源 `core-loop.md §2/§8`、`ux-spec.md §2/§6.3`

| ID | 用例 | 环境 | 预期 | 本轮 |
|---|---|---|---|---|
| TC-FLOW-01 | 遍历 6 状态无死状态卡死 | `[Node]` | BOOT/PLAYING/PAUSED/LEVEL_CLEAR/GAME_OVER/FINISH 全部可达 | ⚠️ |
| TC-FLOW-02 | **不存在 MENU 状态** | `[Node]` | 状态集合无 MENU；无任何状态返回菜单 | ⚠️ |
| TC-FLOW-03 | BOOT 三分流 | `[Node]` | 首次→L1；有进度→续进；全通关→FINISH | 🚧 |
| TC-FLOW-04 | 首次 `totalGames==0` → L1 | `[Node]` | 进 L1 READY | 🚧 |
| TC-FLOW-05 | 末关清关 → FINISH（非 LEVEL_CLEAR） | `[Node]` | 第 5 关清关进入 FINISH | ⚠️ |
| TC-FLOW-06 | 暂停不改当前局状态 | `[Node]` | 仅冻结 update | ✅ |
| TC-FLOW-07 | 非法转移被拒 | `[Node]` | 未声明边 `transition()` 返回 false | ✅ |

## B2 · 物理与防穿模 — 来源 `core-loop.md §5/§6.2/§8`、`paddle-ball-physics.md`

| ID | 用例 | 环境 | 预期 | 本轮 |
|---|---|---|---|---|
| TC-PHYS-01 | 720px/s 不穿墙/挡板/砖 | `[Node]` | 60fps 无穿模 | ✅ 可执行（子步已实现） |
| TC-PHYS-02 | 大 dt clamp 0.05s | `[Node]` | 切后台回来大 dt 被 clamp | ✅ |
| TC-PHYS-03 | 子步阈值 ≤ BALL_R(12) | `[Node]` | 单子步位移 ≤ 12px | ⚠️ 当前 divisor 2/radius16 |
| TC-PHYS-04 | 最大反弹角 ≤60° | `[Node]` | `BALL_MAX_BOUNCE_ANGLE=60°` | ⚠️ |
| TC-PHYS-05 | 最小竖直分量 ≥0.25 | `[Node]` | 防贴地横飞 | ⚠️ 当前 0.34 |
| TC-PHYS-06 | 30fps 亦正确 | `[Node]` | 低帧率靠子步保证正确 | ✅ |
| TC-PHYS-07 | 墙→挡板→砖 固定顺序，同帧只结算一次 | `[Node]` | 无重复扣血/计分 | ⚠️ |
| TC-PHYS-08 | 确定性（同 seed 同结果） | `[Node]` | 同种子同输入序列 → 相同结果 | ✅ |

## B3 · 关卡数据 — 来源 `levels-01-05.json`、`levels-spec.md §2/§3/§5`

| ID | 用例 | 环境 | 预期 | 本轮 |
|---|---|---|---|---|
| TC-LEVEL-01 | 布局还原正确 | `[Node]` | 5 关行列/空位/类型全对；`.` 跳过不生成节点 | ⚠️ |
| TC-LEVEL-02 | 行数 = `[3,4,5,4,5]` | `[Node]` | 与 JSON 一致 | ⚠️ |
| TC-LEVEL-03 | **可破坏 HP** | `[Node]` | L1=30 / L2=50 / **L3=44** / L4=56 / **L5=58**（**已由 `production/qa/levels-validation.md` 脚本校验 52/52 通过；`levels-spec §3` 表正确，原 Q4 疑点系 QA 手工计数错误，已撤回**） | ✅ 数据侧 PASS |
| TC-LEVEL-04 | 球速 = `[480,500,520,540,560]` 单调递增 ≤720 | `[Node]` | 与 JSON 一致 | ⚠️ |
| TC-LEVEL-05 | 布局约束 | `[Node]` | 每行长度=cols；行数≤6；首行不贴顶墙；钢砖≤20%；可破坏砖不被钢砖完全封闭 | ⚠️ |

## B4 · 道具（MVP：expand/multi/life）— 来源 `powerups.md`、`models` `systems-index §3.6`

| ID | 用例 | 环境 | 预期 | 本轮 |
|---|---|---|---|---|
| TC-PWR-01 | 掉落由破砖概率触发，可被关卡覆盖 | `[Node]` | `POWERUP_DROP_BASE=0.12`，关卡可覆盖 | 🚧 |
| TC-PWR-02 | expand：挡板 140→196，15s | `[Node]` | 宽度 ×1.4、计时 15s | 🚧 |
| TC-PWR-03 | multi：每球分裂 3 颗（±25°），球上限 9 | `[Node]` | 达 9 不再分裂 | 🚧 |
| TC-PWR-04 | life：+1，上限 5，超限转 +500 | `[Node]` | 见 TC-LIFE-05 | 🚧 |
| TC-PWR-05 | 同类重复只刷新计时不叠加 | `[Node]` | 不无限变宽/叠乘（§2.4/§6.6） | 🚧 |
| TC-PWR-06 | 场上道具 ≤3，越界即销毁 | `[Node]` | 下落至 `y<POWERUP_MISS_Y(100)` 消失 | 🚧 |

## B5 · 计分与最高分 — 来源 `score-combo.md §2.1/§2.3`

| ID | 用例 | 环境 | 预期 | 本轮 |
|---|---|---|---|---|
| TC-SCORE-01 | 破碎得分 = 基础分 × 倍率 | `[Node]` | N/T/S/B/G = 100/250/0/150/500 | ⚠️ 当前 10/25/50 |
| TC-SCORE-02 | 未破碎不计分 | `[Node]` | 硬砖首次命中不计分 | ✅ |
| TC-SCORE-03 | 最高分写盘时机 | `[Node]` | 仅 GameOver/Finish 时 `>bestScore` 才写 | ⚠️ |
| TC-SCORE-04 | HUD 常驻阈值 | `[Harness]` | combo≥3 才显示 `×N` | ⛔ |

## B6 · 事件契约 — 来源 `systems-index §4`（文档标注"最终以实现为准，需回写"）

| ID | 用例 | 环境 | 预期 | 本轮 |
|---|---|---|---|---|
| TC-EVT-01 | `brick:destroyed` 载荷 | `[Node]` | 含 `{brickId,type,x,y}`（S4→S5/S7/S1） | ⚠️ 载荷不同 |
| TC-EVT-02 | `ball:hitBrick`（未碎） | `[Node]` | 含 `{brickId,hpAfter}` | ⚠️ 实现为 `brick:damaged` |
| TC-EVT-03 | `ball:lost` / `level:cleared` / `game:over` | `[Node]` | 载荷与订阅方符合 §4 | ⚠️ |

## B7 · 架构守卫 — 来源 `control-manifest.md`

| ID | 用例 | 环境 | 预期 | 本轮 |
|---|---|---|---|---|
| TC-ARCH-01 | core 无 `cc/window/wx/document`（L2） | `[Node]` | `check-architecture.mjs` 通过 | ✅ 可执行 |
| TC-ARCH-02 | 游戏逻辑无 `cc`（L3）；无 `Math.random()`（L4） | `[Node]` | 用 `services.rng` | ✅ 可执行 |
| TC-ARCH-03 | 渲染层不写游戏状态（L5） | `[Node]` | `buildRenderModel()` 只读 | ✅ 可执行 |

## B8 · 输入与 UI — 来源 `input-control.md`、`ux-spec.md §3/§4`

| ID | 用例 | 环境 | 预期 | 本轮 |
|---|---|---|---|---|
| TC-UI-01 | 绝对/相对拖拽两模式 | `[Harness]` | 设置项生效 | ⛔ |
| TC-UI-02 | 触控热区 ≥88×88px（暂停按钮） | `[Device]` | 可达性标准 | ⛔ |
| TC-UI-03 | 胶囊避让 `CAPSULE_AVOID` | `[Device]` | HUD 右对齐避开右上胶囊 | ⛔ |
| TC-UI-04 | READY 输入规则 | `[Node]` | 可移挡板、不可移球；发球方向=挡板中心正上方 | ⚠️ |

---

## 覆盖矩阵（判据 → 层 → 来源）

| 需求领域 | 单元 | 集成 | 冒烟 | 真机 | 来源 |
|---|---|---|---|---|---|
| 状态机 6 态 | ✔ | ✔ | SC-01/08/09/10 | ✔ | `core-loop.md §8` |
| 物理防穿模 | ✔ | ✔ | SC-03 | ✔ | `core-loop.md §8` |
| 砖块 5 类 | ✔ | ✔ | — | — | `bricks.md §8` |
| 计分连击 | ✔ | ✔ | SC-03 | — | `score-combo.md §8` |
| 生命/GameOver | ✔ | ✔ | SC-10 | — | `life-gameover.md §8` |
| 存档降级 | ✔ | ✔ | SC-12 | ✔ | `save-progress.md §8` |
| 暂停计时 | ✔ | ✔ | SC-04/05 | ✔ | `pause-settings.md §8` |
| 道具 | ✔ | ✔ | — | — | `powerups.md §8` |
| 减弱动效 | ✔ | — | — | ✔ | `assets-spec.md §7` |

> **注**：本表中"✔"指**已列用例**；实现对齐情况见各条"本轮状态"。当前 `games/breakout/src` 与 GDD 不同源，**§A/§B 共 73 条功能用例统一 `blocked-by: WXG-T-001`**，待实现对齐后回归——这正是 G4 门控要暴露的问题。

---

# §C 实现落地后「最小验证集」（WXG-T-001 完成后必跑）

> 目的：**用最少用例覆盖最高风险**的 8 处承重墙 + 全链路冒烟。**建议 T-003 每合并一批，按下表分批回归**；全绿方可将 G4 由 CONCERNS 升为 PASS。

## C1 · 优先级 P0（承重墙，任一失败即拦截）

> **回归结果（WXG-T-012，2026-09-12）**：13 条中 11 条 PASS（一次通过），TC-A11Y-01/02 因 `reduceMotion` 未实现不可测（缺陷 D-01）。逐条证据见 `g4-regression-report.md`；回归测试已固化为 `games/breakout/tests/g4-regression.test.ts`。**G4 维持 CONCERNS**。

| 序 | 用例 | 验证什么 | 来源 |
|---|---|---|---|
| 1 | `TC-BOMB-01` | 炸弹边界 `d²=4624 ≤ 4624` **含边界**波及 | `bricks.md §2.6 B` |
| 2 | `TC-BOMB-02` | 对角 `6224` **不波及**（视觉与伤害同符） | 同上 / `assets-spec §1.5` |
| 3 | `TC-BOMB-04` | 净结果 = **十字 5 块** | 同上 |
| 4 | `TC-STEEL-02` | 钢砖**只发 `ball:hitBrick`、永不 `brick:destroyed`** | `bricks.md §2.6 S` |
| 5 | `TC-STEEL-03` | 清空可破坏砖即清关（钢砖不计入） | 同上 / §6.7 |
| 6 | `TC-SAVE-03` | `currentLevel` 越界 → 不崩溃、进 L1、**回写 1** | `save-progress §6.8` |
| 7 | `TC-SAVE-01` | `version>1` → 重置初始存档、进 L1 | `save-progress §6.3` |
| 8 | `TC-COMBO-01` | 连击阶梯 `min(5,1+floor(combo/3))` | `score-combo §2.2` |
| 9 | `TC-LIFE-03` | 3 命耗尽**准确**触发 GameOver | `life-gameover §8` |
| 10 | `TC-PAUSE-01` | 暂停期间**玩法计时不推进** | `pause-settings §8` |
| 11 | `TC-PAUSE-03` | 恢复**不重置** READY 自动发球计时（Q8 风险点） | `pause-settings §6.2` |
| 12 | `TC-A11Y-01` | 减弱动效**关停 9 项**确实不播放 | `assets-spec §6.1` |
| 13 | `TC-A11Y-02` | 减弱动效**保留 7 项**仍播放 | `assets-spec §6.2` |

## C2 · 优先级 P1（链路与数据）

`TC-LEVEL-01..05`（数据，已 PASS）、`TC-TOUGH-01`、`TC-GOLD-01..03`、`TC-FLOW-02/03/05`、`TC-PHYS-01/08`、`TC-LIFE-07`（清关优先于失球）、`TC-PWR-01/02/03`、`TC-EVT-01/02`。

## C3 · 冒烟链路（`smoke-tests.md`）

`SC-01 → SC-02 → SC-03 → SC-04 → SC-05 → SC-06 → SC-07 → SC-08 → SC-09 → SC-10 → SC-13`（`[Harness]` 补齐后）；`SC-11`、`SC-12` 的 `[Device]` 部分待真机。

## C4 · 回归基线

每次回归同时跑：`npm run typecheck`（两包）+ `vitest run`（两包）+ `check-architecture.mjs` + `node production/qa/validate-levels.mjs`（52/52 必须保持）。

