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
 * 校准机制不变（§5.0.1）：单关 `|t_act − T|/T > 25%` ⇒ 该关改用实测覆盖；均值超阈 ⇒ 回调本值。
 */
export const SEC_PER_STEP = 4.14;

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
 * - `NORMAL_STEPS_MIN = ceil(LEVEL_TIME_MIN × STAR_TIER_K[1] ÷ SEC_PER_STEP) = ceil(30×0.85÷4.14) = 7`
 *   ⇒ **派生自 §3.5**、非新发明（v1.85 随单价 1.69→4.14 重推；旧 16 = 1.69 时的派生值）：
 *   普通关工作量若低于此值，`time` 会被钳到 `LEVEL_TIME_MIN=30s` 而无差异。
 * - `NORMAL_STEPS_MAX = 37` / `BOSS_STEPS_MIN = 49`：**保持秒量纲不变**换算而来
 *   （旧 90×1.69 = 152.1s ⇒ 152.1÷4.14 = 36.7 ⇒ 37；旧 120×1.69 = 202.8s ⇒ 202.8÷4.14 = 49）。
 *   ⛔ 这不是「放宽」：判据的物理含义（普通关上限 ≈152s 工作量、boss 须跳档）一字未动。
 * ⚠ 若将来继续重定标，依据是「普通关 vs boss 的相对跳档」而非绝对秒数。
 *
 * 现池校验（2026-10-25 **ACB + 12 槽**重测，steps）：L1 教学豁免｜L2=27 L3=26 L4=28 L5=27
 * L6=19 L7=34 L8=26 ∈ [7,37] ✅（余量最紧 = L7 34/37）｜boss L9=112、L10=378 ≥ 49 ✅。
 */
export const NORMAL_STEPS_MIN = 7;
export const NORMAL_STEPS_MAX = 37;
export const BOSS_STEPS_MIN = 49;

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
 * 广告加心激励位（§3.11 v1.28 第二 live 位 / §3.14 v1.80 激励视频 onRewarded）。
 * 0 心时 retry/restart 被拒 → 看此广告加 `HEART_AD_GAIN` 颗心（钳 `STAMINA_MAX`、溢出即弃、
 * 日限 `HEART_AD_DAILY_LIMIT`）再重试（WXG-T-164 立项 / WXG-T-351 v1.80 改判为固定加心）。
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
export const DEMO_LEVEL_COUNT = 10;
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
