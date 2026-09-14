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
/** Tray band (white rounded panel). */
export const TRAY_BAND = { yMin: 230, yMax: 420 } as const;
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
/** Per-level decoy-count ceiling (decoys never participate in the pattern). */
export const DECOY_COLORS_MAX = 2;
/** Spawn weight for a "still needed" colour. */
export const NEEDED_WEIGHT = 3;
/** Spawn weight for a decoy colour. */
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
/** Default spawn interval (s); levels may override within [SPAWN_INTERVAL_MIN, MAX]. */
export const SPAWN_INTERVAL_DEFAULT = 4.0;
/** Spawn interval legal minimum (s). */
export const SPAWN_INTERVAL_MIN = 2.0;
/** Spawn interval legal maximum (s). */
export const SPAWN_INTERVAL_MAX = 6.0;

// ──────────────────────────────────────────────────────── §3.5 timer / fail
/** Default level countdown (s); levels may override within [MIN, MAX]. */
export const LEVEL_TIME_DEFAULT = 300;
/** Level time legal minimum (s). */
export const LEVEL_TIME_MIN = 180;
/** Level time legal maximum (s). */
export const LEVEL_TIME_MAX = 420;
/** Urgent threshold (s): timer switches to danger presentation. */
export const TIMER_URGENT_T = 10;
/** Display refresh granularity (s); internal accumulation is per-dt. */
export const TIMER_TICK = 1.0;
/** Failure condition is *only* the countdown reaching zero (tray full never fails). */

// ─────────────────────────────────────────────────────────── §3.6 powerups
/** The three tray-clearing powerups, in card order left → right (§3.6). */
export const POWERUP_TYPES = ['region', 'clearAll', 'random'] as const;
/** `region`: clears a **contiguous** run of this many slots (§3.6, A6). */
export const REGION_CLEAR_SLOTS = 6;
/** `random`: removes at most this many held beads, equi-probable (§3.6, A6). */
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
  /** Spawn interval for the stage (s). */
  readonly interval: number;
}

/** C6 ladder — stage `n` (0-based) parameters, endpoints aligned to §3.2/3.3/3.4. */
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

// ──────────────────────────────────────── presentation timings (非冻结真源)
/**
 * Level-clear banner auto-advance delay. Presentation-only (breakout `timings`
 * 判例：not pinned by §3); the *state flow* is frozen, this delay is not.
 */
export const LEVEL_CLEAR_DELAY_S = 1.4;

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

// ─────────────────────── 面板动效（来源：ux-spec §5「面板入 / 出 200 / 150」）
/** Panel enter animation duration (ms). */
export const PANEL_IN_MS = 200;
/** Panel exit animation duration (ms). */
export const PANEL_OUT_MS = 150;
/** Enter scale start → 1.0 (ux-spec §5: scale 0.9→1.0). */
export const PANEL_SCALE_FROM = 0.9;

/** Fail-panel primary/retry width (ux-spec §3.5: 480×88). */
export const FAIL_PRIMARY_W = 480;
export const FAIL_BUTTON_H = TOUCH_MIN;
export const FAIL_BUTTON_GAP = 24;

// ───────────────────────── 音频 clip id（无冻结真源，仅为通道标识）
/** BGM clip played with `loop: true` on the bgm channel (architecture §2). */
export const AUDIO_CLIP_BGM = 'bgm_main';
/** UI tap sfx — every panel button uses it (ux-spec §5 抽屉音). */
export const AUDIO_CLIP_UI_TAP = 'sfx_ui_tap';

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
  /** Level-clear banner delay (presentation, see above). */
  readonly levelClearDelay: number;
}

export const DEFAULT_TUNING: BeadsTuning = {
  width: DESIGN_W,
  height: DESIGN_H,
  sprintTime: SPRINT_TIME_DEFAULT,
  levelClearDelay: LEVEL_CLEAR_DELAY_S,
};

/** C1 validation: sprint time overrides outside [90, 120] fall back to default. */
export function validatedSprintTime(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return SPRINT_TIME_DEFAULT;
  if (value < SPRINT_TIME_MIN || value > SPRINT_TIME_MAX) {
    return SPRINT_TIME_DEFAULT; // BOOT rejects the override, falls back (score-combo §6)
  }
  return value;
}
