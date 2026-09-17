/**
 * Beads tuning — every gameplay number lives here, none in the systems.
 *
 * ⚠️ AUTHORITY: every constant below is a mirror of
 * `design/gdd/systems-index.md §3` (the frozen single source of truth; sprint
 * constants C1–C8 frozen in §3.10, WXG-T-020). If a value here disagrees with
 * §3, **§3 wins** and this file is the bug. Do not invent values here; add them
 * to §3 first.
 *
 * Units are *design-space* units (see the framework `Viewport`). The design
 * resolution is 750 × 1334 (portrait). Design-space origin is the
 * **bottom-left**, y grows upward.
 */

// ──────────────────────────────────────── §3.1 canvas, safe area & layout bands
/** Design resolution width (px). */
export const DESIGN_W = 750;
/** Design resolution height (px), portrait. */
export const DESIGN_H = 1334;
/** Top safe-area height: y ∈ [1214, 1334]. */
export const SAFE_TOP_H = 120;
/** HUD band: settings gear left, timer capsule centre, capsule-avoid right. */
export const HUD_BAND = { yMin: 1214, yMax: 1334 } as const;
/** WeChat capsule avoidance zone (top-right). */
export const CAPSULE_AVOID = { xMin: 560, xMax: 750, yMin: 1214, yMax: 1334 } as const;
/** Puzzle band — the pattern matrix is centred inside it (both axes). */
export const PUZZLE_BAND = { yMin: 480, yMax: 1120 } as const;
/** Tray band (white rounded panel). §3.1 v1.20：上沿 420→450，带下沿让给 `btn_expand`。 */
export const TRAY_BAND = { yMin: 230, yMax: 450 } as const;
/** Powerup band (3 white cards — S6 landed in WXG-T-060). */
export const POWERUP_BAND = { yMin: 48, yMax: 200 } as const;
/**
 * 道具卡几何。**不是 §3 冻结常量**（冻结的是带位 `POWERUP_BAND`），但渲染与 S2 命中
 * 测试必须**共用同一份** —— 各写一份就会出现「画出来的卡」与「点击落点」不一致的静默
 * 漂移（`gridLayoutFor` 判例）。
 *
 * ⚠️ 与 `assets-spec §1.4` 的关系（WXG-T-062 主理人裁定 = 方案 A「改卡高、不动带位」）：
 *  §1.4 原写「卡 **176×150** + **卡下方**标签 28px」，而 §3.1 的 `POWERUP_BAND` 只有
 *  **152** 高 —— 150 + 4 + 28 = 182 > 152，两条冻结规格**无法同时成立**。裁定取
 *  「卡 **176×116**（宽仍用 §1.4 的 176，高按带位反推）+ 间隔 4 + 标签 28 = 148 ≤ 152」，
 *  这样 §3.1 与底部留白 48 一字不动、A4 的「文字标签并列」得以落地。§1.4 已同步改数并注明。
 *
 * `POWERUP_CARD_H` ≥ `TOUCH_MIN`，且 §1.4 规定「整卡即热区」⇒ 卡自身就是命中区。
 */
export const POWERUP_CARD_W = 176;
export const POWERUP_CARD_H = 116;
/**
 * 三卡间距（**WXG-T-062 主理人观感复核后 30 → 60**）：三卡总宽 = 176×3 + 60×2 = 648，
 * 两侧余量 51（比网格最紧的 38 更宽松）。间距区**无命中**（`input-control §6`
 * 「触摸点落在布局带间隙：无命中，静默忽略」）⇒ 放大间距只产生中性死区，不改变可选性。
 */
export const POWERUP_CARD_GAP = 60;
export const POWERUP_CARD_RADIUS = 20; // §1.4「圆角 20」
/** §1.4「卡下方标签 28px」（亦满足 §3.8 文字最小 28）。 */
export const POWERUP_LABEL_H = 28;
/** 卡与标签的竖向间隔：§1.4 未规定，本项派生（取 4 使整块 148 ≤ 带高 152）。 */
export const POWERUP_LABEL_GAP = 4;
/** §1.4 视频角标 `ad_badge`：28×28 圆角 8，贴卡右上角内缩 (8,8)，白色 ▶ 边 10。 */
export const POWERUP_BADGE_SIZE = 28;
export const POWERUP_BADGE_RADIUS = 8;
export const POWERUP_BADGE_INSET = 8;
export const POWERUP_BADGE_GLYPH_EDGE = 10;

// ──────────────────────────────────────────────── §3.2 palette & bead charset
/** Pattern row charset: `.`=空位 `x`=锁定格 `1-9`+`A`=色板索引 1–10. */
export const BEAD_CHARSET = '.x1-9A';
/** Per-level colour-count ceiling (demo levels use 3–8). */
export const BEAD_COLOR_MAX = 8;
/** Per-level decoy-count ceiling. §3.2 v1.17 (U8=D, WXG-T-086): 2→0 — no decoys
 * are supplied; the spawner's A′ invariant (`held ≤ demand`) removes the tail
 * soft-lock at the source, so the decoy subsystem is inert (kept for the schema). */
export const DECOY_COLORS_MAX = 0;
/**
 * ⛔ v1.22 作废（WXG-T-130 案 A 供料关停 / WXG-T-136 代码摘除）：抽色权重随供料
 * 消失而失去消费方（`Spawner` 类整体转为死路径）。死值保留（systems-index §3.2
 * 同款口径：供料复活零成本；删除需先清 `Spawner` 死路径 + levels 校验面）。
 */
/** Spawn weight for a "still needed" colour. */
export const NEEDED_WEIGHT = 3;
/** Spawn weight for a decoy colour. Inert while `DECOY_COLORS_MAX = 0` (v1.17). */
export const DECOY_WEIGHT = 1;

// ──────────────────────────────────────────────────────────── §3.3 bead grid
/** Bead edge length (square). */
export const BEAD_CELL = 50;
/** Gap between beads. */
export const BEAD_GAP = 2;
/** Grid pitch = `BEAD_CELL + BEAD_GAP` = 52. */
export const BEAD_PITCH = BEAD_CELL + BEAD_GAP;
/** Max columns per level. */
export const GRID_MAX_COLS = 13;
/** Max rows per level. */
export const GRID_MAX_ROWS = 12;
/** Demo minimum columns. */
export const GRID_MIN_COLS = 6;
/** Demo minimum rows. */
export const GRID_MIN_ROWS = 5;

// ───────────────────────────────────────────────────────────── §3.4 tray
/** Base tray capacity (1 solid row). */
export const TRAY_BASE_SLOTS = 12;
/** Expansion capacity (1 dashed row, per-level only, resets on retry). */
export const TRAY_EXPAND_SLOTS = 12;
/** Slots per tray row. */
export const TRAY_COLS = 12;
/** Slot edge length. */
export const TRAY_SLOT = 48;
/** Slot gap. */
export const TRAY_GAP = 6;
/** 托盘面板竖向内边距（面板高 = rows×54 − 6 + 2×12）。 */
export const TRAY_PANEL_PAD = 12;
/**
 * `btn_expand` 视觉尺寸（§3.4 v1.20 ← `assets-spec §1.3`：132×48、圆角 24）。
 * 热区高 88 来自 `accessibility C1`（48 < `TOUCH_MIN` ⇒ 视觉不变、热区扩大），
 * 二者同心，因此视觉在带下沿居中于热区（y∈[250,298]，热区 y∈[230,318]）。
 */
export const EXPAND_BTN_W = 132;
export const EXPAND_BTN_H = 48;
export const EXPAND_BTN_RADIUS = 24;
export const EXPAND_BTN_HIT_H = 88;
/** 按钮内 ▶ 三角边长（§1.3：12px）。 */
export const EXPAND_BTN_GLYPH_EDGE = 12;
/** ▶ 与文字间距（§1.3 未定，本项派生）。 */
export const EXPAND_BTN_GLYPH_GAP = 12;
/** 「扩展」两字宽 = 2 × 字号 28（CJK 等宽近似，RenderModel 无文本度量）。 */
export const EXPAND_BTN_LABEL_W = 56;
/** 按钮文字（§1.3：「扩展」28px 白字）。 */
export const EXPAND_BTN_LABEL = '扩展';
/** 占位文案：与道具超限同一语义（`powerups §2.6` 布局 A：本轮无路径）。 */
export const AD_PLACEHOLDER_HINT_TEXT = '即将开放';
/**
 * 扩展位占位提示的绘制 y：在 `POWERUP_BAND`（顶 200）与 `TRAY_BAND`（底 230）
 * 之间的空白中线上——空间上贴着刚被点的按钮，且不压任何元素（`ux-spec §5`）。
 */
export const AD_HINT_TEXT_Y = 214;
/**
 * ⛔ v1.22 作废（WXG-T-130 案 A 供料关停 / WXG-T-136 代码摘除，systems-index §3.4
 * 同款口径）：供料 tick 已从主循环摘除 ⇒ 三常量无活消费方。死值保留——①
 * `Spawner` 死路径与快照 `spawnInterval` 字段往返仍引用；② `levels.ts` 校验与
 * `levels-data.ts` 逐关 `spawnInterval` 字段（E5 swaps/JSON 批次统一清理）仍消费
 * MIN/MAX。供料复活时三值自动恢复生效。
 */
/** Default spawn interval (s); levels may override within [SPAWN_INTERVAL_MIN, MAX]. */
export const SPAWN_INTERVAL_DEFAULT = 4.0;
/** Spawn interval legal minimum (s). */
export const SPAWN_INTERVAL_MIN = 2.0;
/** Spawn interval legal maximum (s). */
export const SPAWN_INTERVAL_MAX = 6.0;

// ──────────────────────────────────────────────────────── §3.5 timer / fail
/** Default level countdown (s); levels may override within [MIN, MAX]. */
export const LEVEL_TIME_DEFAULT = 300;
/**
 * Level time legal minimum (s).
 *
 * **v1.23 冻结变更 180 → 120**（WXG-T-138 提案 Q10，用户拍板；WXG-T-139 落码）：
 * 下沿随 `LEVEL_TIME_OVERRIDE = clamp(k × 45s, 120, 420)` 放宽——k = 1/2 的关
 * 定价 45/90 s，一律被钳到 120 s 下限（systems-index §3.5 合法区间 [120, 420]）。
 * 旧值 180 会让 L1–L4（120/120/120/135 s）在 BOOT 被自家校验器拒收。
 */
export const LEVEL_TIME_MIN = 120;
/** Level time legal maximum (s). */
export const LEVEL_TIME_MAX = 420;
/**
 * 单位错位对的定价（s/对）——`LEVEL_TIME_OVERRIDE` 公式的系数（§3.5 v1.23 冻结）。
 * 8 关 k 曲线 [1,2,2,3,4,5,6,8] ⇒ 120/120/120/135/180/225/270/360 s。
 */
export const LEVEL_TIME_PER_PAIR = 45;

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
export const POWERUP_TYPES = ['solver', 'solverPlus', 'solverRandom'] as const;
/** `solverPlus`：一次最多归位的错位珠数（§3.6 v1.22；不足不补）。 */
export const SOLVER_PLUS_COUNT = 3;
/** `solverRandom`：一次抽取归位的错位珠数（§3.6 v1.22；不足不补）。 */
export const SOLVER_RANDOM_COUNT = 1;
/**
 * ⛔ v1.22 作废（WXG-T-137 解环器反转，systems-index §3.6）：「清**槽**」语义随道具
 * 目标改换而整体消失 ⇒ 窗口长度与随机抽珠数失去消费方。**死值保留**（§3.2 / §3.4
 * 同款口径：清槽玩法复活零成本；删除需先复活 `regionWindow` 与其调用面）。
 */
/** ~~`region`：清连续这么多槽。~~ ⛔ 作废死值，见上。 */
export const REGION_CLEAR_SLOTS = 6;
/** ~~`random`：等概率抽至多这么多颗持有珠。~~ ⛔ 作废死值，见上。 */
export const RANDOM_CLEAR_COUNT = 5;
/** Free uses of *each* powerup per level — three independent counters (§3.6, A5). */
export const POWERUP_FREE_USES = 1;
/**
 * In-level rewarded-video placements: 3 powerup cards + tray expansion (§3.6).
 * Layout A (WXG-T-057): all four are `ad_badge` placeholders this round — the
 * only live placement is the fail-page continue (§3.11).
 */
export const AD_PLACEMENTS = 4;
/** A powerup identity — the frozen tuple's element type. */
export type PowerupType = (typeof POWERUP_TYPES)[number];

// ──────────────────────────────────────────────────────── §3.11 fail revive
/** Seconds written onto the playable clock after a completed fail-page ad. */
export const REVIVE_BONUS_SEC = 60;
/** Successful revives allowed per attempt (reset on full level restart). */
export const REVIVE_MAX_PER_LEVEL = 1;

// ──────────────────────────────────────────────────────── §3.7 stars & settle
/** ratio = remaining/total ≥ 0.32 → 3★. */
export const STAR3_RATIO = 0.32;
/** ratio ≥ 0.12 → 2★, otherwise 1★ (clearing always yields ≥1★). */
export const STAR2_RATIO = 0.12;
/** Demo level count. */
export const DEMO_LEVEL_COUNT = 8;
/**
 * 单关满星数（§3.7 星级 1–3 语义）。`computeClearStars` 的上限、S8 存档
 * `stars` 数组的逐项钳制上界（save-progress §2.2/§6）、通关画面总览的分母共用它。
 */
export const STAR_MAX = 3;

// ──────────────────────────────────────────────────────── §3.8 accessibility
/** Min hit area for *UI controls* (buttons/cards/gear). */
export const TOUCH_MIN = 88;
/**
 * Board/tray beads are the documented exception: hit area = nominal size
 * expanded 8px (grid bead 66², tray bead 62²), overlapping hits resolved by
 * nearest cell centre (ties → smaller row).
 */
export const GRID_HIT_SIZE = 66;
export const TRAY_HIT_SIZE = 62;

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
 * §3.7 star rating after a possible revive.
 * HUD still shows `remaining`; stars use `starRemaining / total`.
 */
export function computeClearStars(
  remaining: number,
  total: number,
  reviveBonusSec: number,
  revived: boolean,
): { ratio: number; stars: number } {
  const starRemaining = Math.max(0, remaining - Math.max(0, reviveBonusSec));
  const ratio = total > 0 ? Math.max(0, Math.min(1, starRemaining / total)) : 0;
  let stars = ratio >= STAR3_RATIO ? 3 : ratio >= STAR2_RATIO ? 2 : 1;
  if (revived) stars = Math.min(stars, 2);
  return { ratio, stars };
}

// ─────────────────────────────────────────────────────── §3.6b finish screen
/**
 * S7 通关画面（FINISH）几何。`ux-spec §3.6` 只给「全屏庆祝 + 星级总览（8 关星数和）
 * + 去冲刺 + 重玩第 1 关」一句话，**未给几何** ⇒ 本组是**派生常量**（沿用结算面板
 * 的常量族与设计空间约定），登记于台账。
 */
/** 总览每行高度。 */
export const FINISH_ROW_H = 64;
/** 总览行间距。 */
export const FINISH_ROW_GAP = 12;
/** 总览每行宽度（居中，含标签与 3 颗星）。 */
export const FINISH_ROW_W = 540;
/** 总览星尺寸（小于结算行的 `CLEAR_STAR_SIZE`，8 行竖列需紧凑）。 */
export const FINISH_STAR_SIZE = 34;
/** 总览行内星间距。 */
export const FINISH_STAR_GAP = 8;
/**
 * 总览**逐关**入场步长。`ux-spec §5` 的「逐颗 150ms」是结算行 3 颗的时序；
 * 总览最多 8×3 = 24 颗，逐颗要 3.6s ✗ ⇒ 改为逐关 150ms（8 关 = 1.2s），
 * 同一关的 3 颗同时入场（派生项，登记台账）。
 */
export const FINISH_LEVEL_STEP_MS = 150;

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

// ──────────────────── §3.8 S9 暂停面板几何（来源：ux-spec §3.3 线框，本篇不派生）
/** Pause settings gear hit area — a TOUCH_MIN square anchored left in HUD_BAND. */
export const GEAR_HIT_SIZE = TOUCH_MIN;
/** Panel size: 560 × 480 (`panel_dialog`, ux-spec §3.3). */
export const PANEL_SIZE = { w: 560, h: 480 } as const;
/** Scrim over board+tray: rgba(42,46,67,0.5) (ux-spec §3.3). */
export const PANEL_SCRIM_RGB = { r: 42, g: 46, b: 67 } as const;
export const PANEL_SCRIM_ALPHA = 0.5;
/** Panel button height — every row honours the TOUCH_MIN control floor (§3.8). */
export const PANEL_BUTTON_H = TOUCH_MIN;
/** Primary button ("继续") width (ux-spec §3.3: 240×88 主钮). */
export const PANEL_PRIMARY_W = 240;
/** Inner horizontal padding inside the panel. */
export const PANEL_PADDING = 20;
/** Vertical gap between panel rows. */
export const PANEL_ROW_GAP = 30;
/** Vertical space reserved above the primary row for the title band. */
export const PANEL_TITLE_BAND_H = 100;

// ─────────── §3.8-companion 结算·过关面板几何（来源：ux-spec §3.4 线框）
// 面板本体复用 `panel_dialog`（560×480）与 `PANEL_PADDING` / `PANEL_ROW_GAP`；
// 只有星与按钮的排布是本面板专有。
/** 每颗星入场的间隔（ms）—— ux-spec §5「结算星入场 逐颗 150ms（150×3）」。 */
export const CLEAR_STAR_STEP_MS = 150;
/** 单颗星的外接直径：ux-spec §3.4 未定尺寸 ⇒ 本项派生（三颗等距排在面板中部）。 */
export const CLEAR_STAR_SIZE = 64;
/** 星与星的水平间隔。 */
export const CLEAR_STAR_GAP = 28;
/** 主/副钮宽度：240 + 30 + 240 = 510 ≤ 560 − 2×20（面板内边距）⇒ 可并排落地。 */
export const CLEAR_BUTTON_W = PANEL_PRIMARY_W;
export const CLEAR_BUTTON_GAP = 30;

// ─────────────────────── 面板动效（来源：ux-spec §5「面板入 / 出 200 / 150」）
/** Panel enter animation duration (ms). */
export const PANEL_IN_MS = 200;
/** Panel exit animation duration (ms). */
export const PANEL_OUT_MS = 150;
/** Enter scale start → 1.0 (ux-spec §5: scale 0.9→1.0). */
export const PANEL_SCALE_FROM = 0.9;

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

/** Fail-panel primary/retry width (ux-spec §3.5: 480×88). */
export const FAIL_PRIMARY_W = 480;
export const FAIL_BUTTON_H = TOUCH_MIN;
export const FAIL_BUTTON_GAP = 24;

// ───────────── 音频 clip id（真源：`design/audio/audio-events.md §1`，共 19 条）
// A05-24：本导出集 **≡ §1 表**（双向无孤儿）；新增音效必须先改 §1 再改这里。
/** BGM clip played with `loop: true` on the bgm channel (architecture §2). */
export const AUDIO_CLIP_BGM = 'bgm_main';
/** UI tap sfx — every panel button uses it（§5 无行 ⇒ 待 Q-A05-1 归位，见 §5 未纳入）。 */
export const AUDIO_CLIP_UI_TAP = 'sfx_ui_tap';
/** 结算星入场音效（ux-spec §5「每星"叮"上行」，逐颗 150ms）。 */
export const AUDIO_CLIP_STAR = 'sfx_star';
export const AUDIO_CLIP_PLACE = 'sfx_place';
export const AUDIO_CLIP_SELECT = 'sfx_select';
export const AUDIO_CLIP_REJECT = 'sfx_reject';
export const AUDIO_CLIP_DISSOLVE = 'sfx_dissolve';
export const AUDIO_CLIP_POWERUP = 'sfx_powerup';
export const AUDIO_CLIP_COMBO_T1 = 'sfx_combo_t1';
export const AUDIO_CLIP_COMBO_T2 = 'sfx_combo_t2';
export const AUDIO_CLIP_COMBO_T3 = 'sfx_combo_t3';
export const AUDIO_CLIP_COMBO_BREAK = 'sfx_combo_break';
export const AUDIO_CLIP_URGENT_BEAT = 'sfx_urgent_beat';
export const AUDIO_CLIP_TRAY_FULL = 'sfx_tray_full';
export const AUDIO_CLIP_STAGE = 'sfx_stage';
export const AUDIO_CLIP_CLEAR = 'sfx_clear';
export const AUDIO_CLIP_PANEL_IN = 'sfx_panel_in';
export const AUDIO_CLIP_PANEL_OUT = 'sfx_panel_out';
export const AUDIO_CLIP_REVIVE_OK = 'sfx_revive_ok';

// ─────────── §3.12 冻结常量镜像（真源：`gdd/systems-index.md §3.12`，v1.18）
/** 高频短音（`sfx_place`/`sfx_select`）per-clip 最小重触发间隔。 */
export const AUDIO_SFX_MIN_INTERVAL = 0.05;
/** `sfx_reject` 限流 = §3.8「错误反馈 ≤2 次/秒」的音频侧换算。 */
export const AUDIO_REJECT_MIN_INTERVAL = 0.5;
/** 告急心跳周期：**不新造数值** = `TIMER_TICK`（与 §5 视觉 1000ms 脉冲同周期）。 */
export const AUDIO_URGENT_BEAT_PERIOD = TIMER_TICK;
/** 告急心跳派生限流 = 周期 − 0.1s 余量（吸收 fixedStep 尾差，防偶发双拍）。 */
export const AUDIO_URGENT_MIN_INTERVAL = 0.9;
/**
 * 满槽告警防御档。⛔ v1.22 作废死值保留（§3.12g，WXG-T-130 案 A / WXG-T-136）：
 * 触发源 `tray:full` 玩法侧零发射 ⇒ 本间隔无事件可限；死路径保留（供料复活自动
 * 恢复生效）。**不删**——`AUDIO_CLIP_TRAY_FULL` 仍在 A05-24 19-clip 闭合集内，
 * `audio-events §1`（音频域，本单禁改）未删行。
 */
export const AUDIO_TRAYFULL_MIN_INTERVAL = 1.0;
/** 单帧派发上限（框架 `AudioScheduler` 默认值的显式冻结，不传参漂移）。 */
export const AUDIO_MAX_PER_FRAME = 6;
/** 本游 clip 总数（= §1 表行数；A05-24 闭合判据的账目）。 */
export const AUDIO_CLIP_TOTAL = 19;

// ─────────────────────────────────────────────────────── grid layout derivation
/** Derived geometry for one level's grid, centred inside `PUZZLE_BAND`. */
export interface GridLayout {
  /** Left edge x of column 0. */
  readonly left: number;
  /** Top edge y of row 0 (row 0 is the top row; y grows upward). */
  readonly top: number;
  /** Bottom edge y of the last row. */
  readonly bottom: number;
  readonly cols: number;
  readonly rows: number;
  /** `colCenterX(j) = gridLeft + BEAD_CELL/2 + BEAD_PITCH * j` (§3.3). */
  colCenterX(j: number): number;
  /** `rowCenterY(i) = gridTop − BEAD_CELL/2 − BEAD_PITCH * i` (§3.3). */
  rowCenterY(i: number): number;
}

/**
 * Derive the band-centred grid geometry for a `cols × rows` pattern.
 *
 * Horizontal: centred in 750 (left ≥ 30 holds up to 13 cols: (750−674)/2 = 38).
 * Vertical: centred in PUZZLE_BAND (top ≤ 1120 and bottom ≥ 480 hold up to
 * 12 rows: 1111 / 489).
 */
export function gridLayoutFor(cols: number, rows: number): GridLayout {
  const width = cols * BEAD_PITCH - BEAD_GAP;
  const height = rows * BEAD_PITCH - BEAD_GAP;
  const left = (DESIGN_W - width) / 2;
  const bandMidY = (PUZZLE_BAND.yMin + PUZZLE_BAND.yMax) / 2;
  const top = bandMidY + height / 2;
  const bottom = top - height;
  return {
    left,
    top,
    bottom,
    cols,
    rows,
    colCenterX: (j: number) => left + BEAD_CELL / 2 + BEAD_PITCH * j,
    rowCenterY: (i: number) => top - BEAD_CELL / 2 - BEAD_PITCH * i,
  };
}

// ───────────────────────────────────────────────────────── §3.4 tray layout

/**
 * 托盘面板 / 槽位派生几何（§3.4）。**单一真源**：渲染（`view-model.drawTray`）与
 * 命中（`beads-game._hitTraySlot`）必须共用本函数 —— 各写一份就会出现「画出来的槽」
 * 与「点击落点」不一致的静默漂移（`powerupCardRects()` / `gridLayoutFor()` 判例，
 * WXG-T-062）。
 *
 * 垂直锚定：面板**贴上沿**（v1.20，原「带内居中」）—— 槽簇上移后，带下沿才能
 * 容下 `btn_expand` 的 88 热区而不与 62 槽热区重叠（实测净空 11px）。
 */
export interface TrayLayout {
  readonly rows: number;
  /** 槽间距 = `TRAY_SLOT + TRAY_GAP` = 54。 */
  readonly pitch: number;
  /** 一行槽的总宽（12 列 = 642）。 */
  readonly rowWidth: number;
  /** 槽行左缘（水平居中）。 */
  readonly left: number;
  readonly panelX: number;
  readonly panelBottom: number;
  readonly panelW: number;
  readonly panelH: number;
  /** 第 `col` 列槽心 x。 */
  slotCenterX(col: number): number;
  /** 第 `row` 行槽心 y（`row` 0 = 最上排，贴带上沿）。 */
  slotCenterY(row: number): number;
}

export function trayLayout(rows: number, width: number = DESIGN_W): TrayLayout {
  const pitch = TRAY_SLOT + TRAY_GAP;
  const rowWidth = TRAY_COLS * pitch - TRAY_GAP;
  const left = (width - rowWidth) / 2;
  const panelH = rows * pitch - TRAY_GAP + TRAY_PANEL_PAD * 2;
  return {
    rows,
    pitch,
    rowWidth,
    left,
    panelX: left - TRAY_PANEL_PAD,
    panelBottom: TRAY_BAND.yMax - panelH,
    panelW: rowWidth + TRAY_PANEL_PAD * 2,
    panelH,
    slotCenterX: (col: number) => left + TRAY_SLOT / 2 + pitch * col,
    slotCenterY: (row: number) =>
      TRAY_BAND.yMax - TRAY_PANEL_PAD - TRAY_SLOT / 2 - pitch * row,
  };
}

/**
 * `btn_expand` 几何（§3.4 v1.20）：带**下沿**居底，视觉 132×48 居中于 132×88 热区。
 * 热区 = 命中框（`input-control §2.2` 对「按钮类 ≥ 88 用名义框」的例外，依 `accessibility C1`）。
 */
export function expandButtonLayout(): {
  readonly x: number;
  readonly bottom: number;
  readonly w: number;
  readonly h: number;
  readonly hitX: number;
  readonly hitBottom: number;
  readonly hitW: number;
  readonly hitH: number;
} {
  const x = (DESIGN_W - EXPAND_BTN_W) / 2;
  return {
    x,
    bottom: TRAY_BAND.yMin + (EXPAND_BTN_HIT_H - EXPAND_BTN_H) / 2,
    w: EXPAND_BTN_W,
    h: EXPAND_BTN_H,
    hitX: x,
    hitBottom: TRAY_BAND.yMin,
    hitW: EXPAND_BTN_W,
    hitH: EXPAND_BTN_HIT_H,
  };
}

/** One powerup card's rect (`x`/`bottom` = design-space bottom-left corner). */
export interface PowerupCardRect {
  readonly x: number;
  readonly bottom: number;
  readonly w: number;
  readonly h: number;
}

/**
 * 竖向整块的底基准 y：`[标签 28] + [间隔 4] + [卡 116]` 共 148，在带内**整体居中**
 * （带高 152 ⇒ 上下各余 2）。卡底 = 基准 + 标签 + 间隔，标签中心另见 `powerupLabelY()`。
 */
function powerupBlockBaseY(): number {
  const blockH = POWERUP_LABEL_H + POWERUP_LABEL_GAP + POWERUP_CARD_H;
  const bandH = POWERUP_BAND.yMax - POWERUP_BAND.yMin;
  return POWERUP_BAND.yMin + (bandH - blockH) / 2;
}

/** 标签中心 y（§1.4「卡下方标签」，落在卡外、带内）。 */
export function powerupLabelY(): number {
  return powerupBlockBaseY() + POWERUP_LABEL_H / 2;
}

/**
 * The three card rects — the single geometry source shared by
 * `view/view-model.ts` (draw) and the S2 tap router (hit test), so a drawn card
 * can never disagree with where taps land. Cards sit **above** the label row.
 */
export function powerupCardRects(): PowerupCardRect[] {
  const totalW = POWERUP_CARD_W * 3 + POWERUP_CARD_GAP * 2;
  const startX = (DESIGN_W - totalW) / 2;
  const bottom = powerupBlockBaseY() + POWERUP_LABEL_H + POWERUP_LABEL_GAP;
  const rects: PowerupCardRect[] = [];
  for (let i = 0; i < POWERUP_TYPES.length; i++) {
    rects.push({
      x: startX + i * (POWERUP_CARD_W + POWERUP_CARD_GAP),
      bottom,
      w: POWERUP_CARD_W,
      h: POWERUP_CARD_H,
    });
  }
  return rects;
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

// ───── v1.3 丙案几何/α 常量（assets-spec §1.7/§1.8 + art-bible §6；F2/F3/F7/F8）──
//
// 与 WRONG_* 判例同族：**反馈/呈现层参数**，不进 systems-index §3。墨色在 view/palette
//（GLOW_WARM_HEX 等，control-manifest §3：hex 只住 palette）。

// §1.7 拼图容器板 + 暖光 band（F2/F3）。
/** 容器板每边外扩（px）：plate = grid 外扩 2×8。 */
export const PLATE_OUTSET = 8;
/** 容器板圆角（art-bible §6 圆角规范「拼图容器板 20」）。 */
export const PLATE_RADIUS = 20;
/** B4 板投影偏移 (0,−3) / α 0.10（墨复用 BEAD_SHADOW_HEX）。 */
export const PLATE_SHADOW_DY = 3;
export const PLATE_SHADOW_ALPHA = 0.1;
/** 暖光 band：三环 α 由外向内递增（贴板缘累计 ≈0.15，极淡不抢珠焦点）。 */
export const GLOW_BAND_ALPHAS: readonly [number, number, number] = [0.04, 0.05, 0.06];
/** bandOut 上限（§1.7 clamp：不越带、不越屏）。 */
export const GLOW_BAND_OUT_MAX = 18;
/** band 环圆角增量系数（环圆角 = 板圆角 + 外扩量×0.6，art-bible §6）。 */
export const GLOW_BAND_RADIUS_SCALE = 0.6;
/** B6 完成贴纸：板体外扩白描边宽度 / 投影 α（clear 面板可见时叠于板体）。 */
export const PLATE_STICKER_OUTSET = 6;

// §1.8 背景层次（F8）：全屏冷沉 + 中心两档提亮（ΔL ≤4%，禁止暖色入背景）。
export const BG_DEPTH_ALPHA = 0.04;
export const BG_LIFT_RECT = { w: 645, h: 830, radius: 48, alpha: 0.35 } as const;
export const BG_CORE_RECT = { w: 470, h: 620, radius: 40, alpha: 0.3 } as const;

// art-bible §6 HUD：倒计时白胶囊（F7①）+ 设置 8 齿齿轮（F7②）。
export const TIMER_CAPSULE = { w: 220, h: 64, radius: 32 } as const;
/** 胶囊投影偏移 (0,−2) / α 0.10。 */
export const TIMER_CAPSULE_SHADOW_DY = 2;
export const TIMER_CAPSULE_SHADOW_ALPHA = 0.1;
/** 时钟图标外径（环 Ø36 3px，针同色）。 */
export const CLOCK_ICON_DIA = 36;
/** 齿轮：Ø48 = hub r13 + 8 齿线 r13→r21 线宽 6 + 中心孔 r5（F7②）。 */
export const GEAR_TEETH = 8;
export const GEAR_HUB_R = 13;
export const GEAR_TEETH_R0 = 13;
export const GEAR_TEETH_R1 = 21;
export const GEAR_TEETH_W = 6;
export const GEAR_HOLE_R = 5;
