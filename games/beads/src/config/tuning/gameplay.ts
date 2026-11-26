import { BEAD_COLOR_MAX, GRID_MAX_COLS, GRID_MAX_ROWS, SPAWN_INTERVAL_MIN } from './board.js';
import { DESIGN_H, DESIGN_W } from './layout.js';

// ──────────────────────────────────────────────────────── §3.5 timer / fail
/** Default level countdown (s); levels may override within [MIN, MAX]. */
export const LEVEL_TIME_DEFAULT = 300;
/**
 * Level time legal minimum (s).
 *
 * **v1.23 冻结变更 180 → 120**（WXG-T-138 提案 Q10，用户拍板；WXG-T-139 落码）：
 * 下沿随 `LEVEL_TIME_OVERRIDE = clamp(k × 45s, 120, 420)` 放宽——k = 1/2 的关
 * 定价 45/90 s，一律被钳到 120 s 下限（systems-index §3.5 合法区间 `[LEVEL_TIME_MIN, LEVEL_TIME_MAX]`，
 * 当时上沿为 420；现值见下行）。
 * 旧值 180 会让 L1–L4（120/120/120/135 s）在 BOOT 被自家校验器拒收。
 *
 * **§3.5 v1.50 冻结变更 120 → 30**（用户 2026-09-23 拍板）。动因：**三档时钟制**（§3.7 v1.50）下
 * 2★/3★ = 1★ × 0.85 / × 0.70，而八关 1★ 实测最短只 84s ⇒ 其 3★ 档 = 59s。旧下限 120s 会把小关的
 * **三档全钳成同一个 120s ⇒ 档位塌缩、星级体系直接失效**（单档时钳位只是“该关变松”，三档时是
 * “该关没有星级”）。历史：180 → 120（v1.23）→ 30（v1.50）。
 */
export const LEVEL_TIME_MIN = 30;
/**
 * Level time legal maximum (s) —— **§3.5 v1.47 开发期临时放宽 420 → 2500**（用户 2026-09-22 拍板
 * 「改成 2500，我先验证玩法，时间上线需要再调整」）。
 *
 * **为何改**：规模闸 `taps × SEC_PER_TAP ≤ LEVEL_TIME_MAX` 等价于「点击数硬顶 = 本值 ÷ 3.6」；
 * 420 ⇒ 116 击，而全错位盘实测 `taps ≈ 0.65 × 错位珠数`（初始零洞 ⇒ 每颗都要挖+填两遍），
 * ⇒ 全错位盘只能做到 ~178 颗珠。一张 31×31 大色块图（M=828、同色相邻率 0.843）实测 540 击
 * = 1944s 被拒 —— **闸在系统性误杀「大色块 + 全错位」这类真正成片的盘**。
 *
 * **本值的性质 = 开发期验证档，不是产品值**。上线前必须按 playtest 回调（取证与回调协议
 * `levels-spec §5.0.1`）。ponytail: 未做分档预算（小盘 420 / 大盘放宽）——那需先定
 * 「大盘 3★ 与失败页激励位怎么算」，属玩法裁定，不在此拍。
 *
 * **连带漂移（已登记 §6 v1.47）**：难度分 `D = round(100 × T / LEVEL_TIME_MAX)` 的分母是本值，
 * 改档后一切 D 读数缩水 ≈6×（旧 420s 顶格盘 D100 → D17）⇒ **D 不可跨档比较**，
 * 历史报告里的 D 值仅作当时档位记录。
 */
export const LEVEL_TIME_MAX = 2500;
/**
 * 单位错位对的定价（s/对）——`LEVEL_TIME_OVERRIDE` 公式的系数（§3.5 v1.23 冻结）。
 * 8 关 k 曲线 [1,2,2,3,4,5,6,8] ⇒ 120/120/120/135/180/225/270/360 s。
 */
export const LEVEL_TIME_PER_PAIR = 45;

/**
 * 每个「批量动作」的秒数预算（§3.5 v1.50 冻结变更：**改名 `SEC_PER_TAP` → `SEC_PER_STEP` 并重锚**）。
 *
 * ⚠ **量纲变了，不是改数值**：旧自变量 = 「每次成功点击」（bot 四个公开命令返回 true 的计数，
 * 含选锚/选槽那一下）；新自变量 = **`refSteps` = 一个玩家可感知的批量动作**
 * （`直填 + 取回 + 落子` 三类之和，选锚并入被它服务的那个动作）。
 * 同一个盘两个数差≈2 倍 ⇒ 不改名不重锚就会让注释与代码说两套话。
 *
 * **取值 4.14 = 「等节奏平移」值（v0.6 / WXG-T-394，2026-10-25，用户选 A）**：
 * 旧 1.69 是八关 `t_act ÷ **BAC** 步数` 的中位数（2026-09-23），而 BAC = **取回优先**。
 * 该序在容量可变后失效：只要空槽就先囤货，把「直填 1 步/颗」换成「取回 + 逐颗落子 ≈2 步/颗」
 * ⇒ 步数随托盘容量**递增**（L5 12/24/48 槽 = 64/68/110），容量轴不可解释。
 * 定价改 `branchOrder='ACB'`（归位 → 直填 → 取回，即本文件头注的回归基准）后，10 关**全部单调**。
 * 单价随之按「整体节奏不变」平移：`1.69 × ΣBAC ÷ ΣACB = 1.69 × 1686 ÷ 689 = 4.14`（均为 12 槽读数）。
 * 语义仍是「每个玩家可感知批量动作的秒数」。
 *
 * ⚠ **4.14 未经新 `t_act` 重抽中位数**（`[待 playtest]`）：它是按旧节奏等比换算的应急值，
 * 保住了「整体总秒数不跳变」这一条，但没有重做「秒/动作」的人类标定。
 * 重标定路径 = 逐关记 `t_act` ⇒ 取 `median(t_act ÷ ACB步数)` ⇒ 本值 + §3.5 公式同批更新。
 *
 * ⚠ **本值的用途已降格为「新关引导值」**（公式 v0.4）：已人工试玩过的关一律直接用实测
 * `t_act` 定 1★ 时钟，不经过本常数。**切勿把它当“可预测人类用时”的模型**：
 * 历史上同族先验已三次被同一批数据证伪（`t_act÷bot_taps` 四点崩、`M×1.6` 八点 ρ 仅 0.69、
 * n=4 上选的 `CAB` 到 n=8 最大误差 **162%**）。
 *
 * ── 2026-11-22 · A01「花间集」入关后收节奏（WXG-T-983，用户裁定）──
 * `SEC_PER_STEP` 4.14 → **3.0**。依据是**实测点击/步比重算**，不是拍脑袋：
 * 2026-09-23 八关实测中位 **1.69 s/点击**；A01 九关实测 `taps 1,889 ÷ steps 945 = 2.00 点击/步`
 * ⇒ 诚实值 = 1.69 × 2.00 = **3.38 s/步**。旧 4.14 = 1.69 × **2.45**（旧池 BAC/ACB 比），
 * 旧池 ACB 每步裹的点击多，32×32 盘上每步只裹 2 次点击 ⇒ 4.14 对大盘系统性偏长。
 * 取 **3.0**（≈1.5 s/点击，比实测快 11%）是**节奏目标**而非重标中位数：让 A01 的 3★ 时钟
 * 落回 30–40 min 章预算（38.9 min），同时教学章仍 18.3 min 不紧。
 * 连带影响：门禁⑦ `NORMAL_STEPS_MIN` 7→9、`BOSS_STEPS_MIN` 49→68（保持「≈203s 工量」秒量纲：
 * 202.8÷3.0=67.6⇒68）；`NORMAL_STEPS_MAX` 保持 160（20 大关重定标，见下）。
 * ⚠ 仍是 `[待 playtest]` 引导值：已试玩关仍按 §5.0.1 用实测 `t_act` 覆盖。
 *
 * ── 2026-11-22 · 定价档切到 24 槽（WXG-T-985，用户令「按 24 槽计算，保持紧凑」）──
 * 门禁⑦ 的 `steps` 入参 = `pricing.steps`，而 §3.5 v2.03 起 `pricing.steps` 取
 * `stepsByCap[24]`（不再取 12 槽）⇒ 本组阈值的**步数口径随之下移约 20–25%**。
 * 三值按秒量纲不动（MIN=9 / MAX=160 / BOSS=68），实测仍全部落闸：旧池 L2–L8 13–25 步、
 * boss L9=88 / L10=282；A01 44–129 步、boss L20=101（首次出现 boss 步数 > 全章普通关）。
 *
 * 校准机制不变（§5.0.1）：单关 `|t_act − T|/T > 25%` ⇒ 该关改用实测覆盖；均值超阈 ⇒ 回调本值。
 *
 * ── 2026-11-25 · 定价自变量换点击（公式 v1.0，用户拍板）──
 * `time` 不再由本常数推导，改走下方 `SEC_PER_TAP_BY_TIER × taps`。本值保留两处用途：
 * ① 规模闸 `steps × 本值 ≤ LEVEL_TIME_MAX`；② 门禁⑦阈值（9/160/68）的秒量纲推导记录。
 */
export const SEC_PER_STEP = 3.0;

/**
 * **按点击定价**（公式 v1.0，2026-11-25 用户拍板）：2★ 档「每点击秒数」，按四档难度取斜率。
 *
 * 为何换自变量：旧口径按 `steps`（批量动作）定价，而人类耗时跟的是点击。现池 `taps ÷ steps`
 * 跨 **2.07–4.00** ⇒ 同一星级落到不同关的实际节奏差 1.7 倍：3★ 需 0.71–1.20 s/点击，
 * 碎盘 P03 只要 0.72（已低于八关实测人类最快 0.81 ⇒ 正常手速拿不到），块状大盘 L00029
 * 反而 1.20（偏松）。用户 2026-11-25 试玩反馈「简单关偏松、难关偏紧」。
 *
 * 锚值 = 2026-09-23 八关实测 `s/点击` 中位 **1.13**（0.81–1.36，`levels-spec §5.0.1`）；
 * 四档斜率 = 用户 2026-11-25 选「标准」：简单收紧 ~10%、难/超难放宽 5–20%。
 * ⛔ 属设计档、不是回归拟合，全组 `[待 playtest]`（已试玩关仍按 §5.0.1 用实测 `t_act` 覆盖）。
 *
 * 公式：`need = ceil(taps × 本值)`；`time = clamp(ceil(need ÷ STAR_TIER_K[1]), MIN, MAX)`。
 * `taps` = bot 基础档（12 槽）实测成功点击数；托盘容量主要改「批量动作数」，
 * 不改「每颗珠各点一次」的量级 ⇒ 点击口径对容量轴不敏感。
 *
 * ── 2026-11-25 · A01 九关实测后整体回调（斜率 v1.1，WXG-T-1075，用户令「按 2★ 数据整体调整斜率」）──
 * 四档 `[1.00, 1.13, 1.28, 1.42]` → **[0.79, 0.89, 1.01, 1.12]**。依据：A01 P01–P09 首通实测
 * （82/86/88 + 70/166/226/147/339/334s，同一玩家 harness；T-1069/T-1072 已按「实测 = 2★」逐关落库），
 * 折回 s/点击 = `t_act ÷ bot taps`：tier0 ≈ 0.78（n=3）/ tier1 0.87（n=3）/ tier2 1.13（n=2）/
 * tier3 0.94（n=1），九关总均值 **0.906**；现役四档在同九关的加权均值 1.152 ⇒ 统一缩放 **0.7867**。
 * ⚠ 原生分档均值**非单调**（tier2 1.13 > tier3 0.94）且 tier2/tier3 仅 2/1 样本 ⇒ 不直取分档均值，
 * 取统一缩放以保四档相对形状；tier3 的 1.12 仍是单样本先验。全部 `[待 playtest]`。
 */
export const SEC_PER_TAP_BY_TIER = Object.freeze([0.79, 0.89, 1.01, 1.12] as const);

/**
 * 生成期「工作量」难度门禁（**门禁⑦**，2026-10-10 用户裁定：普通关落区间 / boss 高于阈值）。
 *
 * 量纲 = **实测 `steps`（BAC 批量动作数）**，⛔ 不用 `DI` —— 依据 `level-difficulty.md §1.2`
 * 「DI 够排序不够估工」（2026-10-24 全池重测 DI 对 steps 残差 +92.5%/−61.1%、极差 ≈154pp）⇒
 * 「绝对区间」这种判据只敢压在真源 `steps` 上，不敢压在相对序 `DI` 上。
 * 本组**不进 `systems-index §3`**（生成期判据、非玩法运行时冻结，同 `DIFFICULTY` 组先例）。
 *
 * 三档判据（消费方 = `sync-levels-data.mjs` 门禁⑦ + `apps/beads-studio/server.mjs` 入关当场拒）：
 * - **首关 = 教学引导关，全豁免**（沿用既有「首关豁免」先例，`ux-spec §1 原则3`「纯动效引导」）。
 * - `NORMAL_STEPS_MIN = ceil(LEVEL_TIME_MIN × STAR_TIER_K[1] ÷ SEC_PER_STEP) = ceil(30×0.85÷3.0) = 9`
 *   ⇒ **派生自 §3.5**、非新发明（2026-11-22 随单价 4.14→3.0 重推；历次 16 → 7 → 9）：
 *   普通关工作量若低于此值，`time` 会被钳到 `LEVEL_TIME_MIN=30s` 而无差异。
 * - `NORMAL_STEPS_MAX = 160`（2026-11-22 20 大关重定标，见下）/ `BOSS_STEPS_MIN = 68`
 *   （保持秒量纲：旧 49×4.14=202.9s ⇒ 202.9÷3.0=67.6 ⇒ 68）。
 * ⚠ 若将来继续重定标，依据是「普通关 vs boss 的相对跳档」而非绝对秒数。
 *
 * 现池校验（2026-10-25 **ACB + 12 槽**重测，steps）：L1 教学豁免｜L2=27 L3=26 L4=28 L5=27
 * L6=19 L7=34 L8=26 ∈ [7,37] ✅（余量最紧 = L7 34/37）｜boss L9=112、L10=378 ≥ 49 ✅。
 *
 * ── 2026-11-22 · 20 大关（A01「花间集」）沉盘重定标（WXG-T-982）──
 * `NORMAL_STEPS_MAX` 37 → **160**：A01 九关是 32×32 单图（用户 2026-11-18 定珠面基准），
 * 12 槽实测 steps 84–120（time 352–683s）⇒ 旧上沿 37（≈152s 工量）把整个 20 大关挡在关表外
 * （门禁⑦ 当场红）。新上沿按「32×32 大盘 ≈6–9 min/关」口径取 160（现池最大 120，留 40 步余量）。
 * ⚠ 语义变化如实登记：① 普通关工量上限由 ≈152s 放宽到 ≈662s；② boss 跳档判据
 * （`BOSS_STEPS_MIN=49` 不动）在 20 大关下不再「高于全章普通关」——A01-P01=120 > boss P09=109，
 * boss 身份改由 manifest `kind:"boss"` + 章末位定义，步数阈值仅作下限；③ 旧章 L1–L11 全部
 * 落 [7,160] 不受影响；④ 本值属**开发期验证档**，上线前须按 `level-difficulty` 与 §5.0.1
 * 协议重推（正本登记 = `levels-spec.md` §6 公式表 v0.7）。
 */
export const NORMAL_STEPS_MIN = 9;
export const NORMAL_STEPS_MAX = 160;
export const BOSS_STEPS_MIN = 68;

/**
 * **时间按 k 定价**（§3.5 v1.23）：`clamp(k × LEVEL_TIME_PER_PAIR, MIN, MAX)`。
 * `k` 非有限 / 非正时按 `LEVEL_TIME_DEFAULT` 兜底（不产生 NaN 倒计时——NaN 永
 * 不到零 = 唯一失败条件永不触发，见 `levels.ts` 同款注释）。
 */
export function levelTimeFor(pairs: number): number {
  if (!Number.isFinite(pairs) || pairs <= 0) return LEVEL_TIME_DEFAULT;
  const raw = Math.floor(pairs) * LEVEL_TIME_PER_PAIR;
  return Math.max(LEVEL_TIME_MIN, Math.min(LEVEL_TIME_MAX, raw));
}
/** Urgent threshold (s): timer switches to danger presentation. */
export const TIMER_URGENT_T = 10;
/** Display refresh granularity (s); internal accumulation is per-dt. */
export const TIMER_TICK = 1.0;
/** Failure condition is *only* the countdown reaching zero (tray full never fails). */

// ────────────────────────────────────────────────────── §3.13 misplaced (v1.22/1.23)
/**
 * 单关错位交换对数下限（§3.13 冻结）：0 对 = 无错位 = 无玩法 ⇒ BOOT 拒收。
 */
export const MISPLACED_PAIRS_MIN = 1;
/**
 * 单关错位交换对数上限（§3.13 冻结）：= 色板 8 色上限的保守界，防单色全灭型死局。
 */
export const MISPLACED_PAIRS_MAX = 8;

// ─────────────────────────────────────────── WXG-T-266 EP12-S5 难度分 DI（level-difficulty §3.1）
/**
 * 结构难度分 `DI` 公式系数（正本 = `games/beads/design/art/proposals/ui-style-redesign/level-difficulty.md` §3；
 * 实现 = `game/difficulty.ts::difficultyOf()`，全仓唯一）。
 *
 * ⛔ **不进 `systems-index §3`**（§6.1：判例同 `PAUSE_PANEL_H`，非玩法冻结常量）。
 * ⛔ **只用于「序」（陈列序 / 类别分带 / 单调守卫），不得用于「价」**（§1.2：DI 对 steps 绝对
 * 残差最大 ≈58%；定价继续走实测 `steps × SEC_PER_STEP`，本组零涉）。
 * 系数全部为**语义锚定值**（非回归拟合，§3.3：n=9 上拟合出 `c_C<0` 物理错误 ⇒ 拒绝拟合标定）。
 */
export const DIFFICULTY = Object.freeze({
  /** 每多 1 色 ⇒ 等效错位珠数 +10%（锚：长环心理难度 > 多个短对换，§3.13）。 */
  c_C: 0.10,
  /** 色数参考锚 = 入门图锚（使小色数 `f_C < 1` 得折扣）。 */
  C_REF: 5,
  /** 碎片度每高 0.1 ⇒ 等效珠数 +16%（锚：同色聚块可批量落子降步，T-186）。 */
  c_K: 1.60,
  /** 碎片度中位锚（聚块 `f_K < 1`、碎片 `f_K > 1`）。 */
  K_REF: 0.50,
  /** 防退化地板：`K→0`（近纯色块）时 `f_K` 不得归零（否则 DI=0 退化）。 */
  FK_FLOOR: 0.35,
  /** 色数因子钳位下界（C=1 ⇒ 0.60）。 */
  FC_LO: 0.60,
  /** 色数因子钳位上界（C≥15 ⇒ 2.00，外推区未实测，§8 B-1）。 */
  FC_HI: 2.00,
} as const);

// ─────────────────── WXG-T-997 方案 C 离散四档（阶段 0 裁定 §6.1）
/**
 * 四档边界、G(12) 修正与确定性主键位权的**初锚**。
 *
 * ⛔ **非 `systems-index §3` 冻结常量**（§5 第 60 行：DI 系数住 tuning 不进 §3，四档边界同理）；
 * ⛔ **全部 `[待 playtest]`**：无真机 / 无 playtest 读数，这些值是先验可复核的起点，不是标定结果。
 *    要冻结某一项须另走 §3 变更单，不得因门禁读数不顺而回改本组（K-025 / K-192）。
 * ⛔ 只用于「序」与「档」，不用于「价」：`pricing.steps` 仍是定价 / 门禁⑦ / 规模闸的唯一真源。
 *
 * WXG-T-999（2026-11-20 用户令「1/2/3」之 ①）：两处 G 修正阈值已由**用户追认**，不再是落码方代定；
 * 追认的是取值口径，**不是手感标定** ⇒ `[待 playtest]` 仍全部有效，不因追认而升级为冻结值。
 */
export const DIFFICULTY_TIERS = Object.freeze({
  /** 四档中文标签的**唯一真源**：UI 接界面时只读本组，⛔ 不在视图 / 生成页硬编第二份中文。 */
  LABELS: ['简单', '中等', '难', '超难'],
  /**
   * ── 旧口径（**仅存量关冻结档**用，WXG-T-1060）──
   * 档₀ 由 N 查表：N < 150 简单 / 150–299 中等 / 300–699 难 / ≥ 700 超难。
   * ⛔ 不得用于新关：新口径见下方 `D_N_PER_COLOR` / `D_TIER_BOUNDS`。
   */
  N_SIMPLE: 150,
  N_HARD: 300,
  N_EXTREME: 700,
  /** 旧口径：C ≥ 6 时在 N 档上再升一档（与 G 修正叠加后夹到 0–3）。 */
  C_PROMOTE: 6,
  /** 主序锁 12 槽；24 / 48 只出参考 G 值，不回写档。 */
  T_PRIMARY: 12,
  T_REFS: [12, 24, 48],
  /** G(12) ÷ ceil(N/12) 超此值升一档、低于此值降一档；G 修正整体至多 ±1。
   *  两值由用户 2026-11-20 追认（WXG-T-999），仍标 `[待 playtest]`：真机手感标定须另走变更单。
   *  ⚠ 仅旧口径（存量关）参与档位；新口径只用 C 与 N（用户 2026-11-26 令「难度和颜色数要有对应」）。 */
  G_PROMOTE_RATIO: 2,
  G_DEMOTE_RATIO: 1.25,
  /**
   * ── 新口径（A03 起，WXG-T-1060 / 用户 2026-11-26 裁定）──
   *
   * 用户原话：「难度和颜色数要有一定对应……超难起码也要到 10～12 色才能表明是超难……如果珠数在
   * 档位上限，可以适当降低点色数，两者之间可以做到系数加成平衡」。
   *
   * `D = C + N ÷ D_N_PER_COLOR`（每 250 颗可填珠 ≈ 折 1 色难度）⇒ 珠数可补偿色数：
   * - 简单 `D < 6`：4 色且 N<500 / 5 色且 N<250
   * - 中等 `6 ≤ D < 8`：6 色且 N<500 / 7 色且 N<250 / 4 色且 N 500–749
   * - 难 `8 ≤ D < 10`：8 色且 N<500 / 9 色且 N<250 / 6–7 色且 N 500–999
   * - 超难 `D ≥ 10`：**10–12 色任意珠数**；8–9 色且 N≥500/250；4–7 色需 N≥1500/1250/1000/750
   *
   * 口径性质：先验值、`[待 playtest]`；⛔ 不进 §3，不得因单关读数不顺回改（K-025 / K-192）。
   * G 修正不参与新口径（只留作 DI 主键末位消歧与史证读数）。
   */
  D_N_PER_COLOR: 250,
  /** 档界 `[6, 8, 10]` ⇒ D<6 简单 / 6–8 中等 / 8–10 难 / ≥10 超难。 */
  D_TIER_BOUNDS: [6, 8, 10],
  /**
   * **存量关冻结名单**（2026-11-26 新口径生效时已落库的 27 关，= 当日 manifest 全集）。
   * 命中者沿用旧口径（N 档 + C≥6 + G 修正）算档 ⇒ A01/A02 已验收档位、定价 `pricing.tier`
   * 与「章末 boss 必须超难」硬闸零扰动（先例 = 3 色关 uid 白名单豁免，levels-spec §2）。
   * ⛔ **不得追加**：新关一律走 D 公式；本名单随旧章退役自然收缩，不新增条目。
   */
  LEGACY_UIDS: [
    'L00001', 'L00002', 'L00003', 'L00004', 'L00005', 'L00006', 'L00007', 'L00008', 'L00009',
    'L00012', 'L00013', 'L00014', 'L00015', 'L00016', 'L00017', 'L00018', 'L00019', 'L00020',
    'L00021', 'L00022', 'L00023', 'L00024', 'L00025', 'L00026', 'L00027', 'L00028', 'L00029',
  ] as readonly string[],
  /** 确定性主键位权：`di = tier×1e12 + N×1e8 + C×1e4 + G(12)`，人可按查表复算。 */
  KEY_TIER: 1e12,
  KEY_N: 1e8,
  KEY_C: 1e4,
  TIER_MAX: 3,
} as const);

/**
 * 环长分布 `cycleProfile` 的目标环长（v1.23 增补，**levels JSON 建议值、不冻结**）。
 * 环 = 「珠→格→珠」追踪链：`short` 全 2-环（短对换）、`mixed` 长短混合、
 * `long` 偏长环。k 相同下长环更难（心理难度），但**长环会让错位珠数 = k + 环数
 * 而非 2k**——与 levels-spec §2.1 恒等式冲突，故 8 关数据暂一律取 `short`
 * （恒等式与 §3 表「2k」优先），长环留给 playtest 调参。详见
 * `game/misplaced-assembler.ts` 文件头。
 */
export const CYCLE_LEN_SHORT = 2;
export const CYCLE_LEN_MIXED = 3;
export const CYCLE_LEN_LONG = 5;

// ─────────────────────────────────────────────────────────── §3.6 powerups
/**
 * v1.22（WXG-T-137，用户裁定）：三道具从「清托盘珠」反转为**解环器 = 自动归位棋盘
 * 错位珠**，次序即卡片左 → 右（§3.6）。
 *
 *  `solver`        — 归位**行主序第 1 颗**错位珠；
 *  `solverPlus`    — 归位前 `SOLVER_PLUS_COUNT` 颗错位珠（不足不补）；
 *  `solverRandom`  — 用注入 `Rng` 抽 `SOLVER_RANDOM_COUNT` 颗错位珠（不足不补）。
 *
 * 道具目标 = 棋盘错位珠；托盘**零读写**（错位珠在 grid 内直移 / 交换闭环）。
 */
export const POWERUP_TYPES = ['windowRestore', 'randomRestore', 'trayRestore'] as const;
/**
 * ~~`solverPlus`：一次最多归位的错位珠数~~ ⛔ v1.95 作废（WXG-T-419 道具体系
 * 换版，systems-index §3.6；判例 K-053 死值留档）。
 */
export const SOLVER_PLUS_COUNT = 3;
/** ~~`solverRandom`：一次抽取归位的错位珠数~~ ⛔ v1.95 作废，死值留档，同上。 */
export const SOLVER_RANDOM_COUNT = 1;
/**
 * `windowRestore`（熨贴片）：作用窗口边长（§3.6 v1.95，WXG-T-419；用户拍板）。
 * 盘面任一边小于 6 时窗口贴边收缩为整盘（`min(SIDE, rows/cols)`）。
 */
export const SIDE = 6;
/** `randomRestore`（抖豆筛）：一次随机归位的错位珠数（§3.6 v1.95；不足不补）。 */
export const RANDOM_RESTORE_COUNT = 12;
/**
 * ⛔ v1.22 作废（WXG-T-137 解环器反转，systems-index §3.6）：「清**槽**」语义随道具
 * 目标改换而整体消失 ⇒ 窗口长度与随机抽珠数失去消费方。**死值保留**（§3.2 / §3.4
 * 同款口径：清槽玩法复活零成本；删除需先复活 `regionWindow` 与其调用面）。
 */
/** ~~`region`：清连续这么多槽。~~ ⛔ 作废死值，见上。 */
export const REGION_CLEAR_SLOTS = 6;
/** ~~`random`：等概率抽至多这么多颗持有珠。~~ ⛔ 作废死值，见上。 */
export const RANDOM_CLEAR_COUNT = 5;
/**
 * Free uses of *each* powerup — three independent counters (§3.6, A5).
 *
 * ⚠ **v1.95 语义变更**（WXG-T-419，用户 2026-10-26 拍板）：值仍为 1，但寿命从
 * 「**每关**重置」改为「**账号级永久**每型 1 次」——用掉即永久耗尽（入档
 * `powerupFreeUsedWindow/Random/Tray` 三布尔，新关 / 失败重试 / 暂停重玩 /
 * 换关**均不恢复**）。新手引导演示不消耗该额度（明示例外）。
 */
export const POWERUP_FREE_USES = 1;
/**
 * In-level rewarded-video placements: 3 powerup cards + tray expansion (§3.6).
 * Layout A (WXG-T-057): all four are `ad_badge` placeholders this round — the
 * only live placement is the fail-page continue (§3.11).
 */
export const AD_PLACEMENTS = 4;
/**
 * 豆子购买单价（§3.6 v1.95，WXG-T-419，用户 2026-10-26 拍板）。
 * ~~v1.80 定标「最低档消耗品 ≤ 0.5 天免费产出」（20/30/45）~~ ⛔ 已作废（K-053
 * 划线留档）：三件统一 **100** = 高端选项，判据 = 普通关「免费 1 次 + 全部必要
 * 购买」总成本 > 首通 90 豆（不许首通赚豆，逐关核验见 `powerups-v2 §5.3`）。
 * 购买**不设次数上限**，价格是唯一门槛（v2.1 裁定 C）。
 */
export const POWERUP_BUY_PRICE = 100;
/**
 * ~~每关豆子购买合计上限~~ / ~~每型每关子限~~ ⛔ v1.95 作废（WXG-T-429 冻结表
 * 已划线）：「不设上限、只靠价格」为用户明示取舍。死值删除（无复用前景），
 * 引用面随本批一并清理。
 */
/** 豆子不足 / 达上限时的轻提示（`powerups §2.6` 占位轻提示同族，非广告文案）。 */
export const POWERUP_BUY_DENIED_HINT = '豆子不足或已购满';
/**
 * `[WXG-T-994]` EP15 §8-10 托管轻提示（`bot-replay-spec §3.4/§5`）——复用同一「轻提示」通道
 * （`snapshot.powerupHint` ⇒ 道具带下方一行字），⛔ 不新造 toast / 弹窗。
 * - 接管：托管中玩家点棋盘 / 托盘 / 道具卡 ⇒「已接管」，停留 ≤400ms（ux §5 表）；
 * - 停机：无合法动作 / 动作触顶 ⇒「托管已停止」+ 自动暂停，文字可读更久。
 */
export const ASSIST_TAKEOVER_HINT = '已接管';
export const ASSIST_TAKEOVER_HINT_MS = 400;
export const ASSIST_STOPPED_HINT = '托管已停止';
export const ASSIST_STOPPED_HINT_MS = 2000;
/** A powerup identity — the frozen tuple's element type. */
export type PowerupType = (typeof POWERUP_TYPES)[number];

/** 某型道具的豆子购买单价（唯一取价点：logic 与 view 都读这里）。v1.95：三件统一 100。 */
export function powerupBuyPrice(_type: PowerupType): number {
  return POWERUP_BUY_PRICE;
}

// ──────────────────────────────────────────────────────── §3.11 fail revive
/**
 * Seconds written onto the playable clock after a completed fail-page ad.
 * **v1.25 冻结变更 60→180**（WXG-T-149，用户 2026-09-17 拍板）：对齐参考视频
 * 实测量级（ref-video §10.5：失败挽留后 +180s 原局续打）。原 60 为 WXG-T-057
 * 初版值。注意星级口径不受影响：`computeClearStars` 的 `starRemaining` 扣减
 * 与 `revived` 2★ 封顶逻辑按本常量自动放大，无需另改。
 */
export const REVIVE_BONUS_SEC = 180;
/** Successful revives allowed per attempt (reset on full level restart). */
export const REVIVE_MAX_PER_LEVEL = 1;
/**
 * 广告加心激励位（§3.11 v1.28 第二 live 位 / §3.14 **v1.99** 激励视频 onRewarded）。
 * 0 心时 retry/restart 被拒 → 看此广告加 `HEART_AD_GAIN` 颗心（**⛔ 不钳 `STAMINA_MAX`** ——
 * 上限只限自然恢复、可突破；**满心也可看**；唯一约束 = 日限 `HEART_AD_DAILY_LIMIT`）再重试
 * （WXG-T-164 立项 / WXG-T-351 v1.80 改判为固定加心 / 用户 2026-11-07 v1.99 解钳上限）。
 * 框架 `REWARDED_PLACEMENT` 未列本值，但 `RewardedAdPlacement` 型别容 `| string`，
 * 故用游戏侧字符串位（不改冻结框架枚举）；ponytail: 真机广告单元映射待发布侧接入。
 */
export const STAMINA_REFILL_PLACEMENT = 'stamina-refill';

// ──────────────────────────────────────────────────────── §3.7 stars & settle
/**
 * **三档时钟系数（§3.7 v1.50 冻结）**——星级 = 本局所选档位，**不再看剩余时间占比**。
 *
 * 旧 `STAR3_RATIO = 0.32` / `STAR2_RATIO = 0.12` 已**删除**（不是弃用，是删：让任何残留引用在
 * 类型检查上红）。删除动因：旧制把「失败压力（倒计时→广告）」与「效率奖励（星级）」
 * 焊在同一只时钟上，二者互相绑死：时钟调紧 ⇒ 人人看广告且 3★ 实质作废；调松 ⇒ 广告位不开张。
 * 拆成三只时钟后两条线各自成立（`levels-spec §5.0` 公式 v0.4 / `systems-index-changelog` v1.50）。
 *
 * 关卡 JSON 的 `time` 字段语义 = **1★ 档时钟**（不存三个数）；2★/3★ 由 `tierSecondsFor` 派生
 * ⇒ 单一真源，不会三个数各自漂移。
 *
 * **v1.82 补（WXG-T-353 · R-2）**：v1.50–v1.81 期间三档共用 `LEVEL_TIME_MIN` 一个地板 ⇒
 * 短关（`time` 30–37 s）的 2★/3★ 会双双触底塌成同一个数，现改为按档分设（见 `STAR_TIER_FLOOR`）。
 */
export const STAR_TIER_K = [1.00, 0.85, 0.70] as const;
/** 档位数（1★/2★/3★）。 */
export const STAR_TIER_COUNT = 3;

/**
 * **档间最小可感差（§3.7 v1.82 新增 · 数值 `[待 playtest]`）** —— 由 WXG-T-350 体检 R-2 /
 * WXG-T-353 逐关实算引入：系数 ×0.85 / ×0.70 遇短关时 2★ 与 3★ 会塌成同一个数（L00001 甚至
 * 三档全塌）⇒ 档内计时判星失去梯度（v1.78 星制下这是唯一升星通道 ⇒ 塌缩即高星无从取得；原句曾写作「高星只能靠时间流（`PLAY_STREAK_STAR_UP_SECONDS`）」，该常量从未存在，2026-10-23 WXG-T-358 核实后删去）。
 * 4 s = 按「L00008 两线只差 1 s ≈ 无梯度」反推的最小可感差，**无试玩依据**，
 * 待 playtest 校准（沿 `SPRINT_K_CURVE` 的 `[待 playtest]` 口径；ponytail: 先保证有梯度，不先调曲线）。
 */
export const STAR_TIER_MIN_GAP = 4;

/**
 * **按档地板（§3.7 v1.82）** = `[LEVEL_TIME_MIN, −GAP, −2×GAP]` = `[30, 26, 22]`。
 *
 * ⚠ 与 `LEVEL_TIME_MIN` 的分工（WXG-T-353 实搜确认：两值此前是**同一个常量兼两职**）：
 * - `LEVEL_TIME_MIN` = **关表 `time` 字段的合法下界**（`levels.ts` 校验、`level-import.ts` 的
 *   `measuredLevelTime` 钳制），⛔ 不随本组改动——改了会连带放宽关表合法区间；
 * - 本组 = **三档时钟各自的地板**，允许 2★/3★ 低于 30 s（用户 2026-10-22 选「丙」即含此裁定）。
 * ⇒ 1★ 地板仍 = `LEVEL_TIME_MIN`，所以「关表 `time` = 1★ 时钟」的单一真源语义（v1.76）不破。
 */
export const STAR_TIER_FLOOR = [
  LEVEL_TIME_MIN,
  LEVEL_TIME_MIN - STAR_TIER_MIN_GAP,
  LEVEL_TIME_MIN - STAR_TIER_MIN_GAP * 2,
] as const;

/**
 * 本关 `time`（= 1★ 时钟）在第 `tier` 档实际给多少秒。
 * 地板按档取 `STAR_TIER_FLOOR`（§3.7 v1.82）⇒ 短关的 2★/3★ 不再双双钳到同一个 30。
 *
 * @param starTierK **单关覆盖**（可选，§3.7 v1.86）：缺省用全局 `STAR_TIER_K`。
 *   用途 = 「这一关的某一档要专门规划」（例：boss 关要求 3★ 必须开 48 槽才紧平衡）。
 *   仍走「`time` × 系数」同一算式 ⇒ `time` 仍是 1★ 时钟的单一真源（v1.76 不破），
 *   只是系数可按关取值。合法性由 `sync-levels-data.mjs` 生成期断言（3 个数 / [0]=1 / 严格递减）。
 */
export function tierSecondsFor(
  levelTime: number,
  tier: number,
  starTierK: readonly number[] = STAR_TIER_K,
): number {
  const t = Math.max(1, Math.min(STAR_TIER_COUNT, Math.round(tier)));
  const k = starTierK[t - 1] ?? STAR_TIER_K[t - 1] ?? 1;
  return Math.max(STAR_TIER_FLOOR[t - 1] ?? LEVEL_TIME_MIN, Math.round(levelTime * k));
}

/**
 * 本局应开哪一档（§3.7 v1.78 单条件闸门）。**没有“选档”操作**——合法档唯一，由本关
 * 历史最高星推导：**档 = min(3, 历史最高 + 1)**（用户 2026-10-16 裁定，star-collect-rule R5）。
 *
 * 旧双条件 (b)「上一关同档已过」腿已删（订正声明 K-053：判据源从 §3.7 v1.50 换为
 * v1.78）：单条件下不再需要首关豁免——每关自成链，`starsByLevel` 仍是历史最高，
 * 存档零改动。
 *
 * @param starsThisLevel 本关历史最高星（新档传 0）。
 */
export function nextTierFor(starsThisLevel: number): number {
  const bySelf = Math.floor(starsThisLevel) + 1;
  return Math.max(1, Math.min(STAR_TIER_COUNT, bySelf));
}
/** Demo level count（**§3.7 v1.46 pre-release 重置第二批**：原 demo 8 关已按用户裁定移出，关表改由
 * beads-studio 生成的盘逐张入关重建，本值**随表走 = 当前关数**（先例 = v1.43 随入关 9→10）；
 * **2026-09-22 已入满 8 张**（`L00001..L00008`，均 studio 产物、`time` 全来自真引擎实测）⇒ 回到 v1.44 关数基线，
 * 但**内容全换**（旧 demo 1–8 关的 playtest 校准值已脱离关表）。uid 5 位零填充与区间 5–10 不变，
 * 见 `level-content-pipeline.md` §1.2 v0.7。
 * ⚠️ 再入/再移出关时本值需同步改，否则 `levels.test` / `misplaced-assembler.test` / `level-import.test` 三处断言即红。
 * **8 → 9（WXG-T-231，2026-10-02 用户拍板「A」）**：第 9 张由 `81b08ed`（WXG-T-203 关卡表 pre-release
 * 全量重置，uid 序号改 5 位）入关（`L00009`/`studio-8-f857`，palette `artkal-s`）时漏同步 ⇒ 3 处断言红至今。
 * ⚠️ **本值设计上「随表走」而关表由 beads-studio 逐张入关重建 ⇒ 9 是中途态、漂移必然复发**
 * ⇒ 已同批在 `tools/scripts/sync-levels-data.mjs` 加门禁断言⑤：声明了 `DEMO_LEVEL_COUNT` 的游戏，
 * 该值必须 == manifest `entries` 数，不等即 `levels:check` 硬红（此前只有事后单测红，无生成期拦截）。 */
export const DEMO_LEVEL_COUNT = 27;
/**
 * 单关满星数（§3.7 星级 1–3 语义）。`computeClearStars` 的上限、S8 存档
 * `stars` 数组的逐项钳制上界（save-progress §2.2/§6）、通关画面总览的分母共用它。
 */
export const STAR_MAX = 3;


// ──────────────────────────────────────────────────────── §3.10 sprint (C1–C8)
/** Sprint run length (s); legal [90, 120], out-of-range falls back to default (C1). */
export const SPRINT_TIME_DEFAULT = 120;
export const SPRINT_TIME_MIN = 90;
export const SPRINT_TIME_MAX = 120;
/** Combo window: max gap between two correct placements (s) (C2). */
export const COMBO_WINDOW_S = 5.0;
/** streak thresholds → ×2/×3/×5; multiplier cap ×5 (C3). */
export const COMBO_STREAK_TIERS = [2, 4, 7] as const;
export const COMBO_TIER_MULTIPLIERS = [2, 3, 5] as const;
export const COMBO_MULT_MAX = 5;
/** Base score per correct placement, before the multiplier (C4). */
export const SCORE_PER_BEAD = 10;
/** Stage-completion time bonus (s) (C5). */
export const STAGE_BONUS_TIME = 15;
/** Stage-completion score = base + step × stageIndex (C5). */
export const STAGE_CLEAR_BONUS_BASE = 200;
export const STAGE_CLEAR_BONUS_STEP = 50;

/** Normal-mode settle score weights (C7, not shown in-run). */
export const SETTLE_STAR_WEIGHT = 1000;
export const SETTLE_RATIO_SCALE = 1000;
export const SETTLE_POWERUP_PENALTY = 50;
export const SETTLE_NO_EXPAND_BONUS = 200;
/**
 * C7 结算分（品质分）理论上限 = `STAR_MAX × SETTLE_STAR_WEIGHT + SETTLE_RATIO_SCALE
 * + SETTLE_NO_EXPAND_BONUS`（= 4200）。
 * 消费方：存档 `settleBestByUid` 的逐值钳制上界（ADR-0035 §3.2.1 ①「品质分单榜」）。
 * ⛔ 本值不写死 4200：权重任一变化必须同步跟上。
 */
export const SETTLE_SCORE_MAX =
  STAR_MAX * SETTLE_STAR_WEIGHT + SETTLE_RATIO_SCALE + SETTLE_NO_EXPAND_BONUS;

/** One sprint stage's mechanical parameters (C6 ladder rung). */
export interface StageParams {
  /** Distinct colours on the stage pattern. */
  readonly colors: number;
  /** Fillable-cell target for the stage. */
  readonly cells: number;
  /**
   * Spawn interval for the stage (s). ⛔ v1.22 作废（C6 供料间隔公式段随供料关停
   * 失去消费方，WXG-T-136）：stage 切换后新错位布置改由 `misplaced` 交换构造生成
   * （systems-index §3.10f / §3.13），无供料可注入。公式与死值保留（供料复活零成本）。
   */
  readonly interval: number;
}

/**
 * C6 ladder — stage `n` (0-based) parameters, endpoints aligned to §3.2/3.3/3.4.
 * ⛔ v1.22：`interval` 段作废（同上），`colors` / `cells` 两段现行有效。
 */
export function stageParamsFor(n: number): StageParams {
  const index = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return {
    // §3.2 v1.55 抬上限后本式的封顶由 10 变 35（高梯级不再在 10 色处触顶）。
    // 现网不可观测：`buildStagePattern` 另有 `min(params.colors, 池图案实际色数)`
    // 二次钳制，而池 = 已入库 8 关（实测最大 8 色）⇒ 冲刺实际仍 ≤8 色。
    // 是否另冻 `SPRINT_COLORS_MAX` = 正本 §7-Q3，推荐 丙（挂账），本单不发明新值。
    colors: Math.min(3 + Math.floor(index / 2), BEAD_COLOR_MAX),
    cells: Math.min(30 + 10 * index, GRID_MAX_COLS * GRID_MAX_ROWS),
    interval: Math.max(6.0 - 0.5 * index, SPAWN_INTERVAL_MIN),
  };
}

/** Stage-clear score bonus for the stage that was just completed (C5). */
export function stageClearBonus(stageIndex: number): number {
  return STAGE_CLEAR_BONUS_BASE + STAGE_CLEAR_BONUS_STEP * stageIndex;
}

/**
 * C7 normal-mode settle score (not shown in-run; for ranking/segments).
 * `settleScore = stars×1000 + round(ratio×1000) − powerupsUsed×50 + (未用扩展 ? 200 : 0)`
 */
export function normalSettleScore(
  stars: number,
  ratio: number,
  powerupsUsed: number,
  expandUsed: boolean,
): number {
  const s = Math.max(0, Math.min(3, Math.floor(stars)));
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const p = Number.isFinite(powerupsUsed) && powerupsUsed > 0 ? Math.floor(powerupsUsed) : 0;
  return (
    s * SETTLE_STAR_WEIGHT +
    Math.round(r * SETTLE_RATIO_SCALE) -
    p * SETTLE_POWERUP_PENALTY +
    (expandUsed ? 0 : SETTLE_NO_EXPAND_BONUS)
  );
}

/**
 * §3.7 v1.78：**档内按实际用时判星**（三档时钟只收紧倒计时，不压星）。
 * 倒计时内完成 ⇒ 用时 `elapsed = total − remaining` 对**绝对三线**定星：
 * ≤ 3★ 线（= `tierSecondsFor(levelTime, 3)`）→ 3★；≤ 2★ 线 → 2★；其余 → 1★
 * （边界含 `≤`；三线不另存数，⛔ 零新常量，star-collect-rule R1–R3）。
 * 因此任意档位倒计时内完成都保底 1★；1★ 档快通可当场跳 3★。
 *
 * **续时保底（R4，用户裁定）**：本局用过激励视频加时（`revived`）⇒ stars = 进场档位星
 * （`tier`），⛔ 不按用时跳档——旧 v1.50「选档即定星」对本腿仍是真语义，对未续时腿作废。
 * `ratio` 仍输出，只供 `normalSettleScore` 的展示/排行分量，与判星无关。
 *
 * 订正声明（K-053 换形不换判据源）：旧签名 `(remaining, total, tier)` 的
 * 「星级 = 档位」语义整族作废（判据正本 = score-combo §8-1 v1.78 四臂族）。
 */
export function computeClearStars(
  remaining: number,
  total: number,
  levelTime: number,
  tier: number,
  revived = false,
  /** 单关覆盖（§3.7 v1.86）；缺省 = 全局 `STAR_TIER_K`。 */
  starTierK?: readonly number[],
): { ratio: number; stars: number } {
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  if (revived) {
    return { ratio, stars: Math.max(1, Math.min(STAR_TIER_COUNT, Math.round(tier))) };
  }
  const elapsed = total - remaining;
  if (elapsed <= tierSecondsFor(levelTime, 3, starTierK)) return { ratio, stars: 3 };
  if (elapsed <= tierSecondsFor(levelTime, 2, starTierK)) return { ratio, stars: 2 };
  return { ratio, stars: 1 };
}


/** Tuning bundle handed to the game (mirrors the breakout `BreakoutTuning` shape). */
export interface BeadsTuning {
  readonly width: number;
  readonly height: number;
  /** Sprint run length after C1 validation (out-of-range overrides fall back). */
  readonly sprintTime: number;
}

export const DEFAULT_TUNING: BeadsTuning = {
  width: DESIGN_W,
  height: DESIGN_H,
  sprintTime: SPRINT_TIME_DEFAULT,
};

/** C1 validation: sprint time overrides outside [90, 120] fall back to default. */
export function validatedSprintTime(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return SPRINT_TIME_DEFAULT;
  if (value < SPRINT_TIME_MIN || value > SPRINT_TIME_MAX) {
    return SPRINT_TIME_DEFAULT; // BOOT rejects the override, falls back (score-combo §6)
  }
  return value;
}
