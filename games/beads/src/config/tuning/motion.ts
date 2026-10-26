import { SOLVER_PLUS_COUNT } from './gameplay.js';
import { HUD_BAND } from './layout.js';
import { BEAD_CELL } from './board.js';

// ──────────────────────────────────────────────────── §2.5 combo VFX (Lv1–3)
/**
 * 连击特效三档时长与形态参数。**毫秒值全部来自 `ux/ux-spec.md §5`**（score-combo §2.5
 * 明写「本篇不自写动效毫秒值」），形态来自 §2.5。常量镜像在此，供纯逻辑与测试共用。
 */
/** Lv1（×2）珠面星光粒子：200ms。 */
export const COMBO_VFX_LV1_MS = 200;
/** Lv2（×3）伪震屏：150ms。 */
export const COMBO_VFX_LV2_MS = 150;
/** Lv3（×5）边缘径向光 + 珠面波浪：350ms。 */
export const COMBO_VFX_LV3_MS = 350;
/** Lv2 整屏 scale 脉冲峰值（§2.5：1.00 → 1.015 → 1.00，**仅缩放、无位移**）。 */
export const COMBO_SHAKE_SCALE_MAX = 1.015;
/** Lv1 粒子枚数（§2.5 给的是 3–5 区间；本模块无 RNG ⇒ 取中值，确定性可测）。 */
export const COMBO_PARTICLE_COUNT = 4;

// ──────────────────────────────────────── presentation timings (非冻结真源)
/**
 * ~~`LEVEL_CLEAR_DELAY_S`（过关横幅自动推进延迟）~~ —— **WXG-T-063 退休**：
 * `ux-spec §4` 流转表要求 `LEVEL_CLEAR` **等按钮**（结算·过关面板），"1.4s 自动进下一关"
 * 只是占位实现 ⇒ 占位与常量一并删除（留墓碑注以便追溯）。星入场节奏见
 * `CLEAR_STAR_STEP_MS`（ux-spec §5「逐颗 150ms」）。
 */

// ────────────── §GAP-04/03/10 反馈态动效（来源：ux-spec §5 / art-bible §7，WXG-T-087）
/**
 * `wrong`（放错拒绝）事件总时长（ux-spec §5:180 = 200）：±px 抖动 ×2（**位移通道**）与
 * danger 描边**单次脉冲**共用同一 fx 窗口（`WRONG_FADE_IN_MS + WRONG_HOLD_MS +
 * WRONG_FADE_OUT_MS` = 200）。
 */
export const WRONG_FX_MS = 200;
/** `wrong` 水平抖动幅度（±px，art §7「位移 ±3px」；属位移，不在闪烁通道内，§5:180）。 */
export const WRONG_SHAKE_PX = 3;
/**
 * `wrong` danger 描边**单次脉冲** α 包络分段（ux-spec §5:180，WXG-T-102/BD-29）：
 * α 0→1 淡入 `WRONG_FADE_IN_MS`（ease-out）→ 峰值保持 `WRONG_HOLD_MS` → 1→0 淡出
 * `WRONG_FADE_OUT_MS`（ease-in）。一次 fx 窗口内 **α 极值点 ≤1（不往复）** ⇒ 配合
 * `WRONG_FX_RESTART_GATE_MS`，有效闪烁 ≤2 次/秒（`systems-index §3.8` 冻结值）。
 * 属**反馈态动效参数**（同 `WRONG_FX_MS` / `HINT_PULSE_MS` 判例）⇒ 落 `tuning`，
 * **不进 `systems-index §3`**。
 */
export const WRONG_FADE_IN_MS = 60;
/** `wrong` 描边峰值保持段（ms，缓动的「峰值保持」项）。 */
export const WRONG_HOLD_MS = 80;
/** `wrong` 描边淡出段（ms，ease-in）。 */
export const WRONG_FADE_OUT_MS = 60;
/**
 * 连续拒绝时的**反馈重启门**（ux-spec §5:180「视觉脉冲重启门 500ms」，与音频侧
 * `AUDIO_REJECT_MIN_INTERVAL` = 0.5 s **同拍**，双通道一致）：自上次起播 `wrong` fx 起算，
 * 门内到达的新 mismatch 不重启反馈，门外才重启 ⇒ 有效频次 ≤2 次/秒。
 *
 * ⚠️ 门禁**范围**的判断（描边 vs 抖动，见 `beads-game._armWrongFx`）：§5:180 字面把门
 * 写成「**视觉脉冲**重启门」，但 §3.8 冻结值写的是「**抖动+描边闪** ≤2 次/秒」（两通道
 * 一体的错误反馈事件上限）⇒ 本实现按 §3.8 **从严**，门禁**整个 wrong-fx 事件**。
 */
export const WRONG_FX_RESTART_GATE_MS = 500;

/* ─────────────────────────────────────────────────────────────────────
 * G1 `vfx_fill_pop` — 珠子落座回弹（WXG-T-128 美术 v1.4「动态质感章」首单）。
 * 规格正本 = `art/assets-spec.md` §1.6.1（逐帧公式 / clamp / D1 退化）+ `art-bible §7.3.1`；
 * 毫秒真源 = `design/ux/ux-spec.md` §5「珠子落座」行（**只冻结总时长 120 与起止值 1.06→1.0**）。
 * 本组常量属**表现层动效参数**（同 `WRONG_FX_MS` / `HINT_PULSE_MS` 判例）⇒ 落 `tuning`，
 * **不进 `systems-index §3`**（§3 只承载玩法数值；改冻结常量须走变更单）。
 * ⚠️ 谷值 0.96 与 40ms 分段是 v1.4 新增的 **art-owned 中间插值**（裁定 7：`1.06` = 规格
 *   起点值、**非过冲量**）⇒ 落码不得把 §5 的 `1.06→1.0` 读成「ease-out-back 过冲」。
 */

/** 落座动画总时长（ux-spec §5 冻结值，**不改**）。 */
export const FILL_POP_MS = 120;
/** 压下段时长（`assets-spec §1.6.1` 逐帧分段；§5 未列 ⇒ 不违 §5）。 */
export const FILL_POP_PRESS_MS = 40;
/** 起点 scale（v1.3 既有值；clamp 上界）。 */
export const FILL_POP_SCALE_START = 1.06;
/** 压下谷 scale（t = 40ms；clamp 下界）。全程单调、**不二次过冲**。 */
export const FILL_POP_SCALE_TROUGH = 0.96;
/** L0a 接触阴影 α 峰值（静息 = `BEAD_CONTACT_SHADOW_ALPHA` 0.12；clamp [0.12, 0.18]）。 */
export const FILL_POP_CONTACT_A_PEAK = 0.18;
/** L0a 接触阴影宽比峰值（静息 = `BEAD_CARD.contactW` 0.88）。 */
export const FILL_POP_CONTACT_W_PEAK = 0.92;
/** L0b 柔和投影 α 谷值（静息 = `BEAD_SHADOW_ALPHA` 0.15；clamp [0.12, 0.15]）。 */
export const FILL_POP_SHADOW_A_TROUGH = 0.12;
/** L0b 投影偏移分子谷值（`/64` 归一；静息 = `BEAD_CARD.shadowDy` 的 3）。 */
export const FILL_POP_SHADOW_DY_MIN = 2;
/**
 * 连点**重启门**（= 动画自身长 120ms）：门内到达的新 `bead:placed` **不重启**落座动画。
 * 同族判例 = `WRONG_FX_RESTART_GATE_MS`（500ms）与 ux-spec §5「放错拒绝」行的 500ms 门。
 */
export const FILL_POP_RESTART_GATE_MS = 120;

/* §5 选中抬起斜坡（v1.5-r16 改独立时长）。历史：`bead-visual-style-spec` v1.5-r10（用户
   2026-09-23 裁定「斜坡按 120ms 复用做」）⇒ 本值曾 = `FILL_POP_MS` 以避开新增毫秒值。
   **现解除该裁定**（用户 2026-09-26 要求「回弹 + ease-in-out + 组内错峰」）：回弹需一个
   「过冲→回落」的完整周期，120ms 内两个阶段各只占 40ms ⇒ 不可读；已同步新增 `ux-spec §5` 行。 */
/**
 * 抬起斜坡总时长（含组内错峰展开 + 回弹回落）。
 * ⚠ 错峰 = **同窗口内的相位偏移**（见 `SELECT_LIFT_STAGGER`）⇒ 改本值不会拉长
 *   「从选中到可落」的响应预算（首颗珠仍在 `本值 × (1 − 错峰占比)` 内到位）。
 */
export const SELECT_LIFT_MS = 200;
/**
 * 板锚组抬起位移（设计 px，y 轴向上）。**单一真源在此**：
 * `bead-render.BEAD_CARD.liftRef` 与 view-model 均引用本值，避免“改了抬起量、
 * 三通道响应强度却没跟着改”的静默漂耦。
 *
 * ⚠ **本值 = 静息档（`gridCell = BEAD_CELL = 30`）基准值，不是绝对量**：盘面一切几何
 *（珠体边长 / B0 底图 / 分离影）均比例制，抬起量若不走等比，fit 档上就会“珠抬得更高、
 * 影离得更远”（间隙占格径比例翻倍）⇒ 消费侧乘 `view-model::liftScale = gridCell / BEAD_CELL`，
 * 算式与 `BEAD_DRAW_INSET` 同形（K-077 判例）。恒等档乘子恰为 1 ⇒ 逐位不变。
 */
/**
 * **[WXG-T-242 · 2026-10-04 用户裁「抬起似乎不是很明显」]** `6 → 11` ——
 * **兑现 WXG-T-236 五轮已记录但未落码的「丁」案提案**（原注释：抬到 11 让「抬起后看到槽」成立）。
 * 几何反推：可见槽带 = `lift + 槽内径/2 − 珠边长/2` = `11 + 12 − 13` = **10** ≈ 槽内径 42%。
 * ⛔ 上界 `11 < 半格 15` ⇒ 珠不越格（与含 `liftScaleGain` 后不越格同口径）。
 * ⚠ 连带（设计意图，非意外扩散）：本值是 `BEAD_CARD.liftRef` 与 view-model 三通道的**单一真源**
 *   ⇒ 归一化分母同步放大 ⇒ 各档仍自相似。
 */
export const SELECT_LIFT_PX = 6;
/**
 * **[WXG-T-236 定标 · 2026-10-03 用户裁定「抬起态要影」+ 选型 C-3]** 抬起态**槽内投影**的两个参数。
 *
 * ## 为什么是「槽内正圆」而不是别的形状（选型留档）
 * 用户依次否掉四个方案，实测依据逐条：
 * 1. **横条 / Stadium 圆角条**（首版甲）—— 读作「圆角条」；`radius = 高×0.5` 在 24×7 的 rect
 *    上等于药丸形 ⇒ 轮廓不成立。
 * 2. **小圆角矩形**（`radius = 高×0.18`）—— 仍是「条」，不读作影。
 * 3. **影投格面** —— 被 tint cell mask（`shape` 全 255 完全不透明）与矢量 `PLATE` 满铺**完全遮住**
 *    （换绘制序前后画面逐字节相同）⇒ 结构上不可能。
 * 4. **影投越格那 4dp** —— 越格在**珠的上缘**（珠跨 `[格心−7, 格心+19]`，格跨 `[格心−15, 格心+15]`），
 *    而光向 §6 是**左上顶光 ⇒ 影朝右下** ⇒ 那是**背光面**，光学上错。
 * 5. **影画在珠自身下缘**（珠内暗边）—— 量化 **ΔL = 0**（落在珠自身已有的底缘暗边里 ⇒ 隐形）；
 *    须加宽到 2.3× 半宽才可见，但那样读作「珠底压着面」，**用户判「不像投影」**。
 *
 * ⇒ 选定 **C-3：正圆，半径 = 珠半径 = 槽半宽，居中**（「与珠同形」+「贴合槽轮廓」两条同时满足）。
 *
 * ## 为什么半径能「精确内接于槽」（不是凑的）
 * 盘面格 `beadInset > 0 ⇒ relief = 0` ⇒ `drawEmptySocket` 的坑外沿 **= 珠面轮廓**
 * ⇒ **坑半宽 ≡ 珠半径**（几何恒等）。故取 `r = 坑边长 / 2` 即天然内接、不会外溢出槽。
 * ⚠ **预览期曾差 1dp**：预览用 `(size − inset×1)/2`，而 `drawEmptySocket` 是 `− inset×2`
 * ⇒ 正式实现按后者（精确内接）。
 *
 * ## 两个参数
 * - {@link LIFT_SHADOW_ALPHA} —— 走 `withAlpha` 而非实色：槽口那 3 层内阴影阶梯与 S4 受光亮线
 *   在**影之下**，实色会把它们整片盖掉；半透明让它们透出（物理上影本就压在其上）。
 * - 影的**范围**由「裁到珠下缘」决定（**无额外系数**）—— 用户判「只有珠子下面有影子，孔不要有影子」，
 *   实现上把影的上沿钉在珠的下沿 ⇒ 不需要第二个系数。
 */
/**
 * **[WXG-T-242 · 2026-10-04 用户裁「阴影本身也要加深，凸显被选中的效果」]** `0.38 → 0.52`。
 * ⚠ 仍走 `withAlpha` 而非实色（头注理由不变：实色会盖掉槽口 3 层内阴影阶梯与 S4 受光亮线）。
 * ⚠ 封箱：`legacyFlow` 96 例的影 fill 变（`bead-style-seal` 腿 1 的升档已由 T-242 复评登记）。
 */
export const LIFT_SHADOW_ALPHA = 0.52;
/**
 * ⛔ **[WXG-T-236 五轮] `6 → 11` 的提案已记录但**未落码** —— 撞上封箱架构级阻塞，需用户/QA 裁定。
 *
 * **提案（用户 2026-10-03 裁定「丁」）**：抬到 **11**，让「抬起后看到槽」成立。几何反推：
 * 可见槽带 = `lift + 槽内径/2 − 珠边长/2` = `lift + 12 − 13` = `lift − 1`
 * ⇒ 6dp 只有 **5dp**（实测两条带撞色、影不可见）；11dp ⇒ **10dp** ≈ 槽内径 42%。
 * ⛔ 上界 `11 < 半格 15` ⇒ 珠不越格。⚠ 连带：`SELECT_LIFT_PX` 是 `BEAD_CARD.liftRef` 与
 * view-model 三通道的**单一真源** ⇒ 必然同步放大三通道响应（设计意图，非意外扩散）。
 *
 * **⛔ 为何未落码（封箱架构级）**：`bead-style-seal` **腿 1** 断言「当前代码 ≡ `head.legacyFlow`(48 史证)
 * ⊕ `head_liftShadowFade_r5`(48 现役存档)」逐字节相等，而抬高位移影响**全部 96 例**
 * （实测 `legacyFlow` 96/96 全变；`frame78`/`frame0` 0 差 ⇒ 整帧不受影响）。
 * 仓内对「代码正当变更导致腿 1 红」有先例（`927535c` 越界改 `head.legacyFlow` 48 例），
 * 处置 = **新建只读档案段**存现役值、史证段保持不动、腿 1 改为**三段合并视图**
 * ⇒ 那是**修改封箱核心断言结构**，按 K-082 属 QA 复评范围，⛔ 工程侧不自做主张。
 *
 *
 * **⚠ 与抬起量伴生的「越格」代价（本轮补算，前一版疏漏）**：珠半边 13dp + 抬起 `L` ⇒ 珠上沿
 * 位于格心上方 `L + 13`；格半边 15dp ⇒ **只要 `L > 2` 珠就越出格线**，越格量 = `L − 2`。
 * ⇒ 现值 6dp 越格 **4dp**（首行格直接插进白色面板，`?lift=1` 实拍可见）；
 * **11dp 方案会把越格量放大到 9dp** ⇒ 「露出更多槽」的收益**伴随**「珠更深插进上一格/面板」的代价。
 * 两者必须**一起**由美术/你判，不能只看其一。
 *
 * ⇒ 现值保持 **6**（= 本批之前的既定格）。**用户 2026-10-03 裁定「丁暂不实施」**。
 * 落地前置：QA 复评同意「为 `SELECT_LIFT_PX`
 * 新增第三个档案段」后，再改本值 + 官方复取器重抓 + 登记第九次复评归因。
 *
 * **[T-244 十三批 · 2026-10-04 用户裁「③ 抬起量并轨 + ④ 乘 `liftScale`」]** 托盘选中抬起**取消独立常量**
 * `TRAY_SELECTED_LIFT_PX` ⇒ 与盘面同用本值、**且同走 `liftScale` 等比**（两处逐字一条式，见
 * `view-model::selectLiftScale`）。该常量的裁定链（4→9→14→9 及逐档实测：`lift=14` 珠顶越槽 12.5dp、
 * `lift=9` 影带 8.5dp、`lift=6` 影带 5.5dp）全文在 `memory/2026-10-04.md` T-244 九/十/十三批，
 * ⛔ 不在此重建（代码不留已废值）。
 * ⚠ **负面后果（诚实记，不得隐去）**：托盘槽**不随棋盘相机变尺**（T-244 时口径 `TRAY_SLOT` 恒 30；
 * [WXG-T-261] 尺回 48 ⇒ 下方「越槽 10dp」算式是 30 期快照，需按 48 重推，`[待真机]` 同批）⇒ 乘
 * `liftScale`（= `gridCell / BEAD_CELL`）后抬起量与托盘自己的槽脱钩：大盘 fit 档（`gridCell < 30`）
 * 托盘**抬得更少**，放大档（上限 `CAMERA_ZOOM_MAX`）抬到 `6 × 2 = 12dp` ⇒ 珠上沿越槽
 * `12 + 13 − 15 = 10dp`（插进上一行槽）。回滚口径：`drawTray` 去掉 `liftScale` 因子即恢复「恒绝对」。
 */
/** 选中态抬起方向角（度）：0 = 纯上，>0 = 斜上（珠往左上偏，阴影往右下）。§5 空间语言 · 2026-09-27 用户拍板。 */
export const SELECT_LIFT_ANGLE = 15;
/**
 * **组内错峰总占比**（v1.5-r16）：组尾比锚点晚起 `本值 × SELECT_LIFT_MS`（= 200 × 0.35 = 70ms）。
 * 走相位偏移而非拉长窗口 ⇒ **零新增毫秒值**（仅上面的 `SELECT_LIFT_MS` 一行需拍板）。
 * 上限 1（= 组尾刚起步时首颗已到位）；0 = 关错峰。取值 `[待真机/playtest]`（半屏大组 24 颗下需看是否偏扰）。
 * 消费者 = `view/scene-vfx.ts::liftStaggerPhase`。
 */
export const SELECT_LIFT_STAGGER = 0.35;
/**
 * **回弹过冲出现点**（总时长比例）与**过冲量**（一次完整抬起的比例）。
 * 峰值 抬起量 = `SELECT_LIFT_PX × (1 + 0.12)` = 6.72px（恒等档）⇒ 仍 < 半格（16px），
 * 不撞 A5 零重叠前提（同 `C5` 的口径：含 `liftScaleGain` 后仍须不越格）。
 * 两个值都是观感量 ⇒ `[待真机/playtest]` 定细档；消费者 = `view/scene-vfx.ts::liftEase`。
 */
export const SELECT_LIFT_PEAK_T = 0.7;
export const SELECT_LIFT_REBOUND = 0.12;

/* v1.5-r16：旧 `easeOutQuad`（注为「选中抬起斜坡专用」）已删 —— 抬起曲线换成 ease-in-out + 回弹
   后它**零消费者**（仓内纪律：不留无消费者常量，判例 = `FACET4_HOLE_RADIUS` 退役）。
   新曲线与逐珠相位住在 `view/scene-vfx.ts`（`liftEase` / `liftStaggerPhase`），与本模块
   `sweepCenterX` 共用已有的 smoothstep，⛔ 不另开一份缓动函数。 */

/* G2′ `vfx_solver_restore` — 解环器归位（WXG-T-150，T-128 动态质感章落码③）。
   规格正本 = assets-spec §1.6.2a；毫秒真源 = ux-spec §5「解环器归位」行
   （**200 + 120/颗、逐颗 80ms 间隔**）⇒ 本组零新造时长、**零 §3 变更**。
   ⚠️ **与 G1/G3/G4 不同口径（诚实登记）**：相 A 的 200ms 不只是观感时长，而是
   **「先预警 → 后动手」的玩法提交时序**（用户 2026-09-17 拍板「甲：归位延后到 200ms 后」）
   ⇒ 它决定 `bead:placed` / 过关判定 / 托盘可取状态的实际发生帧。仍按 §1.6.2a 口径住
   `tuning`（时长真源在 ux-spec §5 而非 §3），但**不得当作纯表现层常量改动**。 */
/** 相 A 高亮预警时长（单峰 `α = sin(π·t/200)`）；**D1 不关停**（纯 α 通道，非形变非位移）。 */
export const SOLVER_HINT_MS = 200;
/** 相 B 逐颗落座时长：**直接复用 G1** `FILL_POP_MS`（不复制值，§1.6.2a「逐字复用 §1.6.1 逐帧表」）。 */
export const SOLVER_PER_BEAD_MS = FILL_POP_MS;
/**
 * 逐颗错开量（ux-spec §5 冻结值 80）——**小于** G1 的 `FILL_POP_RESTART_GATE_MS` 120
 * ⇒ 单槽通道每隔一颗就会被门拑掉（`FeedbackFx.armPlace` 头注登记的冲突）。本单解法 =
 * **逐颗队列**（每颗一份 120ms 包络、由 `SOLVER_STAGGER_MS` 错位起播），
 * **不动** G1 的手动连点重启门（那是防连点堆叠的，不是为道具设的）。
 */
export const SOLVER_STAGGER_MS = 80;

/**
 * **[T-244 修正二批 · 2026-10-04 用户裁定「要有下落位移 + 错峰节奏 ease-in-out + 按环扩散」]**
 * 组落座珠的**起始下落距离**（设计 px，走 `lift` 通道 = y 轴向上）。
 *
 * ⚠ 复用 `lift` 通道（G4 波浪同款，`draft.lift`）⟹ **零新字段**；副作用按既有先例接受：
 *   `liftT` 归一会让下落中的珠**放大 ≤4%**（`liftScaleGain`）⟹ 读作「远处落下时略大」= 空间感。
 * ⛔ 与 `drawLiftBeadShadow` 无关（分离影由 view 层按 board 锚 `groupLift` 触发，不由本通道触发）。
 * 取值 = 观感量（≈ 0.47 格）`[待真机]`。
 */
export const GROUP_LAND_DROP_PX = 22;
/** 一次点名的上限：沿 §3.6 `SOLVER_PLUS_COUNT`（引用冻结值，不新增）。 */
export const SOLVER_MAX_CELLS = SOLVER_PLUS_COUNT;

/**
 * **[T-244 五批 · 2026-10-04 修「只有三个珠有动画」]** 落座延迟队列的**容量上界**（颗数）。
 *
 * ⛔⛔ **病灶**：`groupLand*` 队列曾用 `SOLVER_MAX_CELLS` 当容量 —— 那个常量是**解环器单次
 * 序列上限**（= `SOLVER_PLUS_COUNT` = **3**），⛔ **不是盘面容量** ⟹ 一次落 17 颗时第 4 颗起
 * 全部被静默丢弃（用户报「只有三个珠有出现动画」）。教训：复用常量前先确认它的**语义口径**。
 *
 * 取值 = 盘面格数上界（实测封箱盘 13×12 = 156；256 留足余量）。game 侧队列与 snapshot
 * 暴露数组**共用本常量** ⟹ 零漂移。⛔ 非每帧路径（队列惰性建时才分配）。
 */
export const GROUP_LAND_MAX = 256;

/**
 * **[T-244 六批 · 2026-10-04 用户裁定「BFS 方式传播 + 间隔缩短 + 整体不超过 0.2 秒」]**
 * 落座动画的**环间传播预算**（ms）—— 环 `k` 的起播偏移 = `SPREAD × k / maxRing`
 * ⟹ **同环同时**（BFS 扩散）、环间隔 `SPREAD / maxRing`（环数越多间隔越短 = 「间隔缩短」）。
 *
 * ## 总时长恒定 = `SPREAD + GROUP_LAND_PER_BEAD_MS` = 130 + 70 = **200ms**
 * ⛔ 与环数**无关**（6 环与 2 环都是 200ms）—— 满足用户「整体动画不超过 0.2 秒」的硬上限。
 * ⚠ 「间隔缩短」= **环间**间隔（16ms@5 环 / 40ms@2 环）；单颗落位窗（120ms）保持不变，
 *   否则动画快到看不见压下回弹。
 */
export const GROUP_LAND_SPREAD_MS = 130;
/**
 * **[T-244 乙案 · 2026-10-04 用户裁「间隔更明显但整体仍 ≤0.2 秒」]** 落座动画**单颗落位窗**（ms）。
 *
 * ## 为什么要独立于 `SOLVER_PER_BEAD_MS`
 *
 * ⛔ `SOLVER_PER_BEAD_MS`（= `FILL_POP_MS` = 120）是**点名链与落珠链共享**的单一真源
 * ⟹ 直接改它会连带把「逐颗点名」那条动画的压下窗也砍半（**不在本次诉求内**）。
 * ⛔ 而「间隔更明显」在数学上必须从 200ms 预算里**抢时间**（`间隔 ⊂ 总时长`）
 * ⟹ 只能新开一个落珠专属窗，⛔ 不动共享常量。
 *
 * 取值 = 70（120 − 50）⟹ 130 + 70 = 200ms **顶满且不破**用户裁定的 0.2 秒硬上限。
 * ⚠ 代价（已知并接受）：单颗压下回弹比点名链快 42% ⟹ 「压下」观感更脆；
 *   换来的是错峰间隔 80 → 130ms（1.63×）明显可辨。`[待真机复核压下脆度]`
 */
export const GROUP_LAND_TOTAL_MS = 200;
/** 每颗**保底**错峰间隔（ms）—— 2 颗时只错开这么多（再大就吃掉单颗窗）。 */
export const GROUP_LAND_MIN_GAP_MS = 65;
/**
 * **[T-244 甲案 · 2026-10-04 用户裁甲 · 病因「托盘落珠看不到」]** 落座序列**总时长**（ms）。
 *
 * 乙案把单颗落位窗 `120 → 70` 去抢多颗的错峰预算 ⟹ 但**托盘落珠典型只有 1–2 颗**（日志实测
 * `颗数=1`）⟹ **错峰那 130ms 对单颗毫无用处**，却把唯一可见的窗砍掉 42%。⛔ 70ms @60fps =
 * **4.2 帧** ⟹ 22px 下落 + 压下 pop 在 4 帧内走完 ⟹ **人眼捕捉不到 = 没有动画**。
 *
 * ## 甲案：错峰预算**按颗数**分配（不是一刀切）
 *
 * ```
 * 错峰预算 = min(SPREAD, (n−1) × MIN_GAP)   // n = 颗数
 * 单颗窗   = TOTAL − 错峰预算
 * ```
 *
 * | 颗数 | 错峰预算 | 单颗窗 | 60fps 帧数 |
 * |---|---|---|---|
 * | 1 | **0** | **200ms** | **12 帧** ✓ |
 * | 2 | 65ms | 135ms | 8 帧 |
 * | 3+ | 130ms（封顶） | 70ms | 4 帧（多颗时错峰本身已明显） |
 *
 * ⛔ **总时长恒定 = 200ms，与颗数无关** ⟹ 满足主理人「整体不超过 0.2 秒」硬上限。
 * ⚠ 代价：3 颗以上时单颗窗回到 70ms（乙案水位）—— 多颗时错峰本身已可辨。
 */
/**
 * 整条序列总时长 = 相 A + 逐颗错开 `80×(n−1)` + 末颗落座 120（§1.6.2a 相序行）。
 * **单一真源函数**：game 侧用它定计时窗口，view 侧用它把单调标量还原成绝对毫秒
 * ⇒ 不得在两边各写一份公式（漂移先例 = §1.6.4 初稿 `lodLayers` 6 vs 7）。
 */
export function solverSequenceMs(count: number): number {
  const n = count < 1 ? 1 : count;
  return SOLVER_HINT_MS + SOLVER_STAGGER_MS * (n - 1) + SOLVER_PER_BEAD_MS;
}

/* G3 `vfx_powerup_sweep` — 道具生效扫光（WXG-T-146，T-128 动态质感章落码②）。
   规格正本 = assets-spec §1.6.3；毫秒真源 = ux-spec §5「道具生效」行（400ms）。
   同样属表现层动效参数 ⇒ 落 tuning，**不进 systems-index §3**。 */
export const SWEEP_MS = 400;
/** tan(20°)：斜向剪切（非水平带 —— 与 Lv3 burst 的「能量上涌」形态区分）。 */
export const SWEEP_TAN = 0.364;
/** 起点：完全屏外左侧（≥ 广层半宽 105 + 余量）。 */
export const SWEEP_X_FROM = -260;
/** 终点：完全屏外右侧（750 + 广层半宽 105 + 50）。 */
export const SWEEP_X_TO = 1010;
/**
 * 扫光下/上沿。上沿取 `HUD_BAND.yMin` 而**不写字面 1214**（§3.1 顶部 HUD 带为冻结真源）：
 * 用户裁定「全屏」= 玩法全屏 `y∈[0, HUD_BAND.yMin]`，不得侵入 HUD 与胶囊避让区。
 */
export const SWEEP_Y_MIN = 0;
export const SWEEP_Y_MAX = HUD_BAND.yMin;
/** 核心 / 中 / 广（由内向外）；绘制序取**反序**（先广后核心）⇒ 后画的更亮。 */
export const SWEEP_WIDTHS = [36, 84, 210] as const;
export const SWEEP_ALPHAS = [0.14, 0.10, 0.06] as const;

/* G4 `vfx_complete_wave` — 过关庆祝波浪（WXG-T-146，同属 T-128 落码②）。
   规格正本 = assets-spec §1.6.4；毫秒真源 = ux-spec §5「过关庆祝」行（800ms + 20ms/列）。
   ⚠️ `WAVE_BEAD_LOD_LAYERS` = **7** 而**不是** §1.6.4 初稿的 6：v1.5-r6 按 B′ 重算后
   可砍集不得包含 **L11 垫**（垫 = 静态谜面载体，三条理由见§1.6.4 LOD 行）
   ⇒ 保留集 = L0b+L1+L2+L3+L4c ⊕ 垫（**旧文此处还列 L5 符号层**，该层已随
      `bead-visual-style-spec` v1.5-r8（2026-09-23，WXG-T-203 `c8d2fe8`）整层删除
      ⇒ WXG-T-207-A 注释核销；是否因此应重数为 6 = art/QA 另案，本单不动值）。
   ⚠ **层数与渲染基尺无关** ⇒ 本值不随 §3.3 v1.57 复算，`assets-spec §11.2` 图元基线同理。 */
export const WAVE_MS = 800;
export const WAVE_COL_DELAY_MS = 20;
export const WAVE_SCALE_PEAK = 1.08;
export const WAVE_RISE_RATIO = 0.35;
/** 微抬幅度（与 `WRONG_SHAKE_PX` 同量级；单峰非震动）。⚠ **静息档基准值**，同 `SELECT_LIFT_PX`：
 *  实际位移 = 本值 × `gridCell / BEAD_CELL`（`view-model::liftScale`）—— 波浪与珠体/底图同屏对照，不得走绝对值。 */
export const WAVE_LIFT_PX = 3;
/**
 * clamp 下限：逐列窗口 W = max(240, 800 − 20×(N−1)) 在 N ≥ 29 时恒 = **240（触及下限）**
 * ⇒ 大盘下波浪从"递降"退化为"全体同窗口"，观感需复核（v1.37 GRID_MAX 50 同样触底）；
 * 240 兜底仍保留防异常（原注「13 ⇒ W=560」随 §3.3 v1.33 作废）。
 */
export const WAVE_WINDOW_MIN_MS = 240;
/**
 * [T-244 十七批] **单色对齐波浪**（用户裁「跳得更明显、和选中的高度一致、时间更短、节奏更紧」）。
 * 三值**全部派生**，零新造数字：
 * · 高度 = `SELECT_LIFT_PX`（与选中抬起**同一个真源** ⇒ 「同高」是可证的而非目测）
 * · 时长与列错峰 = G4 的一半 ⇒ 同一段曲线、更紧的拍子（形状/缓动仍同一族）
 * 窗口沿用 `waveWindowMs` **同一个式**（只换两个入参）。
 * ⚠ 与 G4 **同一天花板**（见上方 `WAVE_WINDOW_MIN_MS` 注）：cols ≥ 17 时窗口触底 240，
 *   而进度分母恒 = 本值 ⇒ 大盘末列的包络在尾部被截（G4 当日同构，已登记）。
 */
export const COLOR_WAVE_MS = WAVE_MS / 2;
export const COLOR_WAVE_COL_DELAY_MS = WAVE_COL_DELAY_MS / 2;
export const COLOR_WAVE_LIFT_PX = SELECT_LIFT_PX;
/**
 * [T-244 十九批 · 用户裁「所有该色珠子**从左到右再亮一遍**，像单光源掠过去」] `pulse` 档的**光带横扫**时序。
 *
 * 为什么要与 `jump` 分家（不是观感锅，是可算的时间事实）：十七那套沿用 G4 的比例
 * ⇒ cols=6 时**单珠闪烁窗 350ms** 对**列间错峰 50ms**（闪烁窗 ≫ 错峰）⇒ 50ms 内整批已全亮
 * ⇒ 眼睛读到的是「一起亮」而不是「扫过」；且错峰量随大盘列数变，同一段光不两段。
 * 本档钉死两件事：**横穿用时恒定 + 单珠闪烁窗恒定**（错峰量 = 两者派生 ÷ 列间距数）
 * ⇒ 任何尺寸的盘扫过去都是同一段节奏，且 `travel + flash = 通道全长`（末列恰在通道关闭那帧收尾，无截尾）。
 * 两者之比 **3:1**（量的多少由下面 `COLOR_WAVE_SWEEP_MS` 定，二十批改过一次）：
 * 单珠闪窗 = “被看见的一下”量级，横穿 = 光带走完全程。⚠ 仍非 systems-index §3 冻结常量。
 */
/**
 * [T-244 二十批 · 用户裁「一道光横着扫过的时间慢一些」] `pulse` 通道全长另开一条，**回到 G4 的 `WAVE_MS`**。
 * 旧值 300ms 横穿在 60fps 下只有 18 帧（归一进度还会吃掉末尾几帧）⇒ 眼睛跟不住光带移动。
 * 现值：横穿 600ms + 单珠闪 200ms（= `GROUP_LAND_TOTAL_MS` 同量级，一次完整可读的亮）。
 * ⛔ 不新造时长：800ms 是 `WAVE_MS`（G4 全场波浪）既有真源；`jump` 档不连坐（十七批那条“紧凑”仍为 400ms）。
 */
export const COLOR_WAVE_SWEEP_MS = WAVE_MS;
export const COLOR_WAVE_TRAVEL_MS = (COLOR_WAVE_SWEEP_MS * 3) / 4;
export const COLOR_WAVE_FLASH_MS = COLOR_WAVE_SWEEP_MS - COLOR_WAVE_TRAVEL_MS;
/** 逐列错峰量 = 横穿用时 ÷ 列间距数（cols ≤ 1 ⇒ 0，不除零）。 */
export function colorWaveColDelayMs(cols: number): number {
  return cols < 2 ? 0 : COLOR_WAVE_TRAVEL_MS / (cols - 1);
}
/**
 * [T-244 十八批 · 用户裁「几种方案都实现出来对比」] 单色齐备提示的**亮度通道**峰值（格底罩层 α / 锁边环 α）。
 * ⛔ 只走亮度（墨 = 本格目标色的 `endpoints.lit` = `mix(base, #FFF, 0.38)`，端点表内既有档）
 *   ⇒ 不新增色相、不占用 `lift`/`scale`（那是落位动画的专属通道，十七批的冲突根因）。
 * 峰值取法与 `wrong`/`named`/`denied` 同族（状态环 α ∈ (0,1]），非目测拍脑袋：
 * · 环 0.9 = 与 `wrong` 满闪同级（一次性宣告必须看得见）
 * · 罩层 0.14 = `PANEL_SCRIM_ALPHA` 0.35 的一半不到 ⇒ 打底光不糊珠体
 */
export const COLOR_WAVE_GLAZE_ALPHA = 0.14;
export const COLOR_WAVE_RING_ALPHA = 0.9;
/** 常驻锁定态的环 α（弱于脉冲：常驻不能抢读感）。 */
export const COLOR_WAVE_LOCK_RING_ALPHA = 0.5;
/**
 * G4 波浪期的**降档层集标记**（含垫，见上方⚠️）：L0b+L1+L2+L3+L4c + L11（旧文此处还列已删的 L5 符号层）。
 *
 * **WXG-T-211-B1 / §12.2 C7 拆名**：旧名 `WAVE_LOD_LAYERS` 一词两义（本波浪降档 +
 * 下方 zoom LOD 层集共用一个常量），已拆为 `WAVE_BEAD_LOD_LAYERS`（本常量）与
 * `ZOOM_LOD_LAYERS` 两名单值仍是 **7**（值不变更，行为不变，盘面逐帧不变）。
 * 视图侧只判 `!== undefined` ⇒ 数值从不参与算术、纯标记（C7 实测注）。
 */
export const WAVE_BEAD_LOD_LAYERS = 7;
/**
 * ADR-0017 甲案 · zoom 自适应 LOD 的**触发阈值**（工程通道；本轮只落「满层 / 降档」两态）。
 * 触发量 = 珠屏幕径 `layout.cell = BEAD_CELL × zoom` ⇒ 不必给快照新增 zoom 字段。
 *
 * **动因（实测）**：24×31 / 26×26 关在 fit 档每帧 **2833–2953 条绘制命令，与 zoom 完全无关**
 * （视口剔除已落，但 fit 档全盘可见 ⇒ 剔不到）；Node 侧建模仅 0.10 ms/帧 ⇒ 瓶颈在真机
 * canvas 执行那 2900 条命令× 60fps。缩到 0.37（珠 19px）时一半以上质感层本来就分辨不出。
 *
 * 阈值：`BEAD_LOD_CELL` 的出身是**比例**而非绝对地板——取 ADR-0017 建议档起点
 * `zoom 0.9`。故 **§3.8/§3.3 v1.57（WXG-T-207-A）公式化 = `0.9 × BEAD_CELL` = 27**，
 * 与 `BEAD_CELL` **同批提交**（P0：若只翻基尺不翻本值，旧 45 在新尺下永不达标
 * ⇒ **盘面永久降档**，中心孔与质感层集体缺席）。
 * 公式化后降档触发点仍是 `zoom < 0.9`，与旧尺**行为同构** ⇒ `IMPACT-0020a 摘要③`
 * 「LOD 档结构性失效 / 默认视角恒降档」不成立（其前提是把 45 当绝对px，变更单 §7 修正一）。
 * ⚠ 阈值仍未真机验（`ADR-0017` 状态仍 Proposed），且 27 是**格径**而非珠面径
 * ⇒ 「降档时珠面只余 27−2×inset ≈ 19px，可省的层是否还值得省」= `[待真机 + art]`。
 * 降档层集**= `ZOOM_LOD_LAYERS`（7 层，art 已在 WXG-T-146 冻结；C7 拆名后与波浪降档
 * 各自一名、值仍同 7，⛔ 不得据此自造新层集）**；
 * ADR 的中/低三档细分待 art 冻结后再分。红线不变：**L11/B0 目标色底图与 L1c 中心孔
 * 任何档不砍**（旧文此处写的“L5 符号”已随 v1.5-r8 整层删除，见上方核销注）。
 */
export const BEAD_LOD_CELL = BEAD_CELL * 0.9;
/**
 * ADR-0017 zoom 自适应 LOD 的**降档层集标记**（C7 拆名产物：从旧 `WAVE_LOD_LAYERS`
 * 的 zoom 消费者一侧独立命名；值 7 与波浪降档同源同值，去留另见 ADR-0023 §9-1）。
 */
export const ZOOM_LOD_LAYERS = 7;
/**
 * 滞回带宽（ADR-0017 §2.1「滞回必需」）：降档 < 27、升档 ≥ 29.5 ⇒ 阈值附近缩放不闪。
 *
 * ⚠️ **v1.57 裁定 = 保持绝对 2.5，不随基尺派生**（主理人任务单 207-A 口径 = art 起始表
 * `assets-spec §1.10.9`「`BEAD_LOD_HYST` 2.5 不动」）。**诚实登记口径冲突**：变更单 §0.1 曾拟
 * 派生 `BEAD_CELL/20 = 1.5`；采绝对 2.5 后，带宽占格径比例由旧尺 5% 升到 **9.3%**
 * ⇒ 升档点从 `0.95×CELL` 变为 `0.983×CELL`（仍 < 1，不会“升不回去”）。后果可接受且**不阻塞**，
 * 但它是**触控以外的第二个观感项** ⇒ 随 `BEAD_LOD_CELL` 一起挂 `[待真机]`，派生化留另案。 */
export const BEAD_LOD_HYST = 2.5;

/** LOD 滞回状态机（纯函数、可单测）：输入当前珠屏幕径与上帧降档态，输出本帧是否降档。 */
export function nextBeadLod(cell: number, wasLow: boolean): boolean {
  return wasLow ? cell < BEAD_LOD_CELL + BEAD_LOD_HYST : cell < BEAD_LOD_CELL;
}


/**
 * 裁定 1（用户 2026-09-16）：结算面板**延迟 WAVE_MS 开**——庆祝先行放完再落遮罩。
 * 代价已写入 ux-spec §5（过关到可点按钮多等 800ms）。
 */
export const CLEAR_PANEL_DELAY_MS = WAVE_MS;

/* G7 `vfx_denied_press` — 不可填格轻压（WXG-T-152，T-128 动态质感章落码③·音频原子批）。
   规格正本 = assets-spec §1.6.7；毫秒真源 = ux-spec §5「不可填格轻压」行（120ms，
   复用「珠子落座」行值、**不新造时长**）⇒ 视觉侧零 §3 变更；唯一跨域例外 =
   裁定 3 的 `sfx_denied` 连带 §3.12 `AUDIO_CLIP_TOTAL` 19→20（冻结变更单 v1.26，
   与本组、clip 常量、voice 配方、`SPEC_CLIPS`、`audio-events §1` 表行**同批**，
   拆开即 A05-24 红；解除条件清单见 `audio-events §5` Q-A05-5）。 */
/** 轻压动画总时长（ux-spec §5 冻结值；D1 退化环同窗口，120ms 后由 game 侧清除）。 */
export const DENIED_PRESS_MS = 120;
/** 压下段时长（与 `FILL_POP_PRESS_MS` 同族分段）。 */
export const DENIED_PRESS_TROUGH_MS = 40;
/** 压下谷 scale（与 `FILL_POP_SCALE_TROUGH` 同值；clamp [0.96, 1.00]，起点/终点恒 1.00）。 */
export const DENIED_PRESS_SCALE_TROUGH = 0.96;
/**
 * **同格**重启门（§1.6.7「同格计」⇒ 逐颗独立门，区别于 G1 的全局单槽门）：
 * 不同格的轻压可并存（game 侧走定长槽数组）；同格 250ms ⇒ 每格 ≤4 次/秒。
 * 音频侧 `sfx_denied` 的 `minInterval` **由本值换算**（/1000，不新造数值，裁定 3 / Q-A05-5 ⑥）。
 */
export const DENIED_PRESS_RESTART_GATE_MS = 250;
/** D1（`reduceMotion`）退化态：1px `slot_border` 静态描边环线宽（§1.6.7 `DENIED_RING_LINEWIDTH`）。 */
export const DENIED_RING_LINEWIDTH = 1;
/**
 * 并存轻压的槽容量（**工程容量选择、非规格值**）：§1.6.7 只钉「同格 250ms 门」，
 * 未给并存上限 ⇒ 取 4 覆盖「相邻格快速连扫」的现实上限，占满时逐出最旧起播者。
 * 快照数组按本常量**一次性预分配**（热路径只写值，零分配）。
 */
export const DENIED_MAX_CELLS = 4;

/* G6 `vfx_confetti` — 结算彩带礼花（WXG-T-153，T-128 动态质感章落码④）。
 * 规格卡 = `art/assets-spec.md §1.6.6`；毫秒真源 = `ux-spec §5`「结算彩带」行（800，
 * 复用「过关庆祝」不新造）。零冻结常量：全部住呈现层（§1.6 硬纪律③）。
 * 零 RNG（L4）：44 枚全由 idx 黄金比/黄金角派生，同输入同画面。 */
export const CONFETTI_MS = 800;
/** 总枚数 = 主体 + 前景（回退阀 44→24 本轮不预埋，裁定 5）。 */
export const CONFETTI_COUNT = 44;
/** 主体层（drawClearPanel **之前** ⇒ 被 scrim α0.5 压住，读作「远处彩带」）。 */
export const CONFETTI_MAIN_COUNT = 36;
/** 前景层（drawClearPanel **之后**）；44 − 36。 */
export const CONFETTI_FG_COUNT = 8;
/** 单枚 6×14 px（面积 84px² ≈ 占屏 0.008%，D2 闪烁阈值余量极大）。 */
export const CONFETTI_W = 6;
export const CONFETTI_H = 14;
/** 落程系数 >1 ⇒ 保末帧已出屏。 */
export const CONFETTI_FALL_FACTOR = 1.15;
/** 横向摆动：±18px × 2 周期（叠加旋转致单枚可见面积 1.25Hz < 3Hz 红线）。 */
export const CONFETTI_SWAY_PX = 18;
export const CONFETTI_SWAY_CYCLES = 2;
/** 全场旋转 1.25 转 ⇒ D2 核算基准 1.25Hz。 */
export const CONFETTI_SPIN_TURNS = 1.25;
/** 末段淡出起点（p 比），避免 800ms 硬切。 */
export const CONFETTI_FADE_START = 0.7;
/** 五档错高（idx mod 5），避免齐平下落。 */
export const CONFETTI_SPAWN_STEP_Y = 60;
/** 前景禁飞带（clearPanelLayout 派生：按钮行 yMin 447 / 缎带 yMax 787）；FG 枚入带**跳过绘制**。MAIN 不受限。 */
export const CONFETTI_NOFLY_YMIN = 447;
export const CONFETTI_NOFLY_YMAX = 787;
/** 零 RNG 分布参数（承 `comboParticleOffsets` 判例）：x = 750 × frac(idx × 0.618)；phase = idx × 137.5°。 */
export const CONFETTI_GOLDEN_RATIO = 0.618;
export const CONFETTI_GOLDEN_ANGLE = 137.5;

/** `hint` / 引导脉冲呼吸周期（α 0.5↔1.0，600ms ≈1.67Hz，落 §3.8 ≤3Hz 红线内）。 */
export const HINT_PULSE_MS = 600;
/**
 * 一次性「轻提示」窗口（ux-spec §5「无效落点轻提示」行，WXG-T-097/BD-16）。
 * **不是新数值**：取 §5 表头统一红线「反馈 ≤400 ms」的上界（BD-15 扩展位占位共用同一窗口）。
 */
export const TAP_HINT_MS = 400;
/** 无选中珠点可落空格时的占位文案（`input-control §2.3` 落子前置；文案不属 §3 数值真源）。 */
export const TAP_HINT_NO_SELECTION_TEXT = '先选一颗珠子';
/** 倒计时告急 α 脉冲周期（1→0.6→1，ux-spec §5 / art §7「1000/循环」）。 */
export const DANGER_PULSE_MS = 1000;
/**
 * 托盘满槽告警描边呼吸周期（ux-spec §5「满槽告警」行：500ms/循环，BD-10）。
 * ≈2Hz 落 §3.8 ≤3Hz 红线内；α 幅度沿用 `hud_timer_danger` 同族 0.6↔1.0（不新造第三档，
 * 见 `assets-spec §1.5` `tray_panel_danger`）；`reduceMotion` 下退为静态描边（D1）。
 */
export const TRAY_FULL_PULSE_MS = 500;
