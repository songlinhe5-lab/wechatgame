/**
 * `config/tuning.ts` — 派生几何与纯函数（breakout `tests/tuning.test.ts` 的同位物）。
 *
 * `tuning.ts` 的**数值**真源是 `design/gdd/systems-index.md §3`（该文件自己声明 §3 优先），
 * 所以这里**不复述 §3 的数字**（两份真源必然漂移），只断言两类东西：
 *   ① 由常量派生的不变量（pitch、band 次序、布局落在设计分辨率与 band 内）；
 *   ② 纯函数的分支与边界（C1 越界回退、C6 阶梯夹取、C7 结算公式）。
 */

import { describe, it, expect } from 'vitest';
import {
  BEAD_CELL,
  BEAD_COLOR_MAX,
  BEAD_GAP,
  BEAD_HIT_PAD,
  BEAD_PITCH,
  CAMERA_ZOOM_MAX,
  DEFAULT_TUNING,
  DESIGN_H,
  DESIGN_W,
  GRID_HIT_SIZE,
  GRID_MAX_COLS,
  GRID_MAX_ROWS,
  GRID_MIN_COLS,
  GRID_MIN_ROWS,
  HUD_BAND,
  POWERUP_BAND,
  PUZZLE_BAND,
  CLEAR_STAR_STEP_MS,
  SPAWN_INTERVAL_MAX,
  SPAWN_INTERVAL_MIN,
  SPRINT_TIME_DEFAULT,
  TOUCH_MIN,
  TRAY_BAND,
  TRAY_BASE_SLOTS,
  TRAY_BEAD_SIZE,
  TRAY_COLS,
  TRAY_MAX_SLOTS,
  TRAY_TIER_SLOTS,
  TRAY_GAP,
  TRAY_HIT_SIZE,
  TRAY_PANEL_PAD,
  TRAY_SLOT,
  zoomControlLayout,
  computeClearStars,
  LEVEL_TIME_MIN,
  nextTierFor,
  SEC_PER_STEP,
  STAR_TIER_FLOOR,
  STAR_TIER_K,
  STAR_TIER_MIN_GAP,
  tierSecondsFor,
  gridLayoutFor,
  normalSettleScore,
  stageParamsFor,
  validatedSprintTime,
} from '../src/config/tuning.js';
import { LEVELS_DATA } from '../src/config/levels-data.js';

describe('beads tuning derivation (systems-index §3 mirrors)', () => {
  it('derives the grid pitch from cell + gap', () => {
    expect(BEAD_PITCH).toBe(BEAD_CELL + BEAD_GAP);
  });

  it('keeps the four layout bands ordered and inside the design height', () => {
    expect(HUD_BAND.yMin).toBeGreaterThan(PUZZLE_BAND.yMax);
    expect(PUZZLE_BAND.yMin).toBeGreaterThan(TRAY_BAND.yMax);
    expect(TRAY_BAND.yMin).toBeGreaterThan(POWERUP_BAND.yMax);
    expect(POWERUP_BAND.yMin).toBeGreaterThan(0);
    expect(HUD_BAND.yMax).toBeLessThanOrEqual(DESIGN_H);
  });

  it('keeps the default tuning bundle consistent with the module constants', () => {
    expect(DEFAULT_TUNING.width).toBe(DESIGN_W);
    expect(DEFAULT_TUNING.height).toBe(DESIGN_H);
    expect(DEFAULT_TUNING.sprintTime).toBe(SPRINT_TIME_DEFAULT);
    // WXG-T-063：`levelClearDelay`（自动推进占位）已退休，节奏改由「星入场逐颗 150ms」
    // 承担（ux-spec §5）；此处钉住该值，防止有人再退回「到点自动翻页」。
    expect(CLEAR_STAR_STEP_MS).toBe(150);
  });

  describe('gridLayoutFor', () => {
    it('centres the board inside PUZZLE_BAND and the design width, and records that 29×29 overflows', () => {
      // **WXG-T-180（§3.3 v1.33）迁移**：`GRID_MAX` 13/12 → 29/29 之后，
      // 29 × `BEAD_PITCH` = 1508 > `DESIGN_W` = 750 ⇒ 原「**最大盘**必须居中且左右留边 ≥30」
      // 的不变式**不再成立于 GRID_MAX**。故拆成两条，都不软化、只是各归其位：
      //   ① 居中 / 留边 / 落在带内 ⇒ 只对「**设计宽内容得下的最大盘**」成立（`fitCols`）；
      //   ② 29×29 标准盘**显式超出设计宽** ⇒ 必须靠缩放观看（ADR-0015 丁-3「布局即相机」），
      //      **不得再声称"完整可见"** —— 这是事实记录，不是缺陷豁免。
      const fitCols = Math.floor((DESIGN_W + BEAD_GAP) / BEAD_PITCH); // 屏内容得下的最大列数
      expect(fitCols).toBeGreaterThanOrEqual(GRID_MIN_COLS);
      const layout = gridLayoutFor(fitCols, GRID_MIN_ROWS);
      const width = fitCols * BEAD_PITCH - BEAD_GAP;
      expect(layout.left).toBeCloseTo((DESIGN_W - width) / 2, 6);
      // Symmetric margins ⇒ the board is horizontally centred.
      expect(layout.left).toBeCloseTo(DESIGN_W - (layout.left + width), 6);
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.top).toBeLessThanOrEqual(PUZZLE_BAND.yMax);
      expect(layout.bottom).toBeGreaterThanOrEqual(PUZZLE_BAND.yMin);
      expect(layout.cols).toBe(fitCols);

      // ② 标准盘溢出（诚实记录）
      const big = gridLayoutFor(GRID_MAX_COLS, GRID_MAX_ROWS);
      const bigWidth = GRID_MAX_COLS * BEAD_PITCH - BEAD_GAP;
      expect(bigWidth).toBeGreaterThan(DESIGN_W);
      expect(big.cols).toBe(GRID_MAX_COLS);
      expect(big.rows).toBe(GRID_MAX_ROWS);
    });

    it('places cell centres on the §3.3 pitch formulas', () => {
      const layout = gridLayoutFor(6, 5);
      expect(layout.colCenterX(0)).toBeCloseTo(layout.left + BEAD_CELL / 2, 6);
      expect(layout.colCenterX(3) - layout.colCenterX(2)).toBeCloseTo(BEAD_PITCH, 6);
      // Row 0 is the TOP row, so centres descend as the index grows.
      expect(layout.rowCenterY(0)).toBeCloseTo(layout.top - BEAD_CELL / 2, 6);
      expect(layout.rowCenterY(2)).toBeLessThan(layout.rowCenterY(1));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // §3.8 v1.57（WXG-T-207-A）热区**公式化**后的结构性不变式。旧判据是快照式
  // `BEAD_PITCH·z < 66·z`（52 基字面量）⇒ 换基尺即成为假绿。本组只钉**与基尺无关**
  // 的关系（数值全由 `BEAD_HIT_PAD / BEAD_CELL / BEAD_PITCH / TRAY_BEAD_SIZE` 派生），
  // 正本 = `systems-index §3.8` v1.57 行 + `tuning.ts` §3.8 注释。
  // ─────────────────────────────────────────────────────────────────────────
  describe('§3.8 热区（v1.57 公式化：冻规则不冻数字）', () => {
    it('两个热区都是派生式，不是绝对字面量', () => {
      expect(GRID_HIT_SIZE).toBe(BEAD_CELL + 2 * BEAD_HIT_PAD);
      expect(TRAY_HIT_SIZE).toBe(TRAY_BEAD_SIZE + 2 * BEAD_HIT_PAD);
      // 同尺链：托盘珠径本身也是派生量（v1.57 从 bead-render 上提为 §3.4 常量）。
      expect(TRAY_BEAD_SIZE).toBe(TRAY_SLOT - 4);
    });

    it('① 无死区：相邻盘珠热区必相接（`2·PAD > GAP` ⇔ `HIT > PITCH`，与 zoom 同乘可约）', () => {
      expect(GRID_HIT_SIZE).toBeGreaterThan(BEAD_PITCH);
      expect(2 * BEAD_HIT_PAD).toBeGreaterThan(BEAD_GAP);
    });

    it('② 热区不小于它要覆盖的珠面', () => {
      expect(GRID_HIT_SIZE).toBeGreaterThanOrEqual(BEAD_CELL);
      expect(TRAY_HIT_SIZE).toBeGreaterThanOrEqual(TRAY_BEAD_SIZE);
    });

    it('③ 相邻重叠量与基尺无关（= `2·PAD − GAP`）⇒ 换尺不新增跨格误触', () => {
      expect(GRID_HIT_SIZE - BEAD_PITCH).toBe(2 * BEAD_HIT_PAD - BEAD_GAP);
      // 快照腿（防“两个错量互相抵消”）：旧 52 基 = 66 − 52 = 14，新 32 基 = 46 − 32 = **14**。
      // ⇒ `IMPACT-0020a` 的「HIT/PITCH 1.269→1.941」是**比值假警报**，真正要守的
      // 是重叠量与无死区，两者本单都没变（正本：变更单 §2.4 / `tuning.ts` §3.8 注）。
      expect(GRID_HIT_SIZE - BEAD_PITCH).toBe(14);
    });

    it('珠类热区仍不扩至 UI 控件最小值 `TOUCH_MIN`（§3.8 既裁：防跨格误触）', () => {
      expect(GRID_HIT_SIZE).toBeLessThan(TOUCH_MIN);
      expect(TRAY_HIT_SIZE).toBeLessThan(TOUCH_MIN);
    });
  });

  describe('validatedSprintTime (C1)', () => {
    it('accepts the legal band and rejects everything else', () => {
      expect(validatedSprintTime(90)).toBe(90);
      expect(validatedSprintTime(100)).toBe(100);
      expect(validatedSprintTime(120)).toBe(120);
      // Out of band → fall back to the default rather than clamping silently.
      expect(validatedSprintTime(89)).toBe(SPRINT_TIME_DEFAULT);
      expect(validatedSprintTime(121)).toBe(SPRINT_TIME_DEFAULT);
      expect(validatedSprintTime(undefined)).toBe(SPRINT_TIME_DEFAULT);
      expect(validatedSprintTime(Number.NaN)).toBe(SPRINT_TIME_DEFAULT);
      expect(validatedSprintTime(Number.POSITIVE_INFINITY)).toBe(SPRINT_TIME_DEFAULT);
    });
  });

  describe('stageParamsFor (C6 ladder)', () => {
    it('starts at the documented floor and saturates at the §3 ceilings', () => {
      // 起步档 = 最少色数 / 最小格数 / 最慢供料（供料间隔的上限）。
      expect(stageParamsFor(0)).toEqual({ colors: 3, cells: 30, interval: SPAWN_INTERVAL_MAX });
      // **WXG-T-180（§3.3 v1.33）迁移**：格数饱和上限随 `GRID_MAX` 156 → 841，
      // 原 index=50（30+10×50 = 530）**已不足以触顶** ⇒ 改 100（1030 > 841）仍能饱和。
      // **v1.37 再迁**：`GRID_MAX` 29→50 ⇒ 饱和上限 2500，index 250（2530 > 2500）。
      // **v1.45 再迁**：`GRID_MAX` 50→32 ⇒ 饱和上限 1024（32×32），index 250 仍远超触顶；
      //   断言本身引 `GRID_MAX_COLS * GRID_MAX_ROWS`，改值零改测。
      const deep = stageParamsFor(250);
      expect(deep.colors).toBe(BEAD_COLOR_MAX);
      expect(deep.cells).toBe(GRID_MAX_COLS * GRID_MAX_ROWS);
      expect(deep.interval).toBe(SPAWN_INTERVAL_MIN);
    });

    it('is monotonic: more colours and cells, shorter intervals, never out of range', () => {
      let previous = stageParamsFor(0);
      for (let stage = 1; stage <= 20; stage++) {
        const current = stageParamsFor(stage);
        expect(current.colors).toBeGreaterThanOrEqual(previous.colors);
        expect(current.cells).toBeGreaterThanOrEqual(previous.cells);
        expect(current.interval).toBeLessThanOrEqual(previous.interval);
        expect(current.colors).toBeLessThanOrEqual(BEAD_COLOR_MAX);
        expect(current.cells).toBeLessThanOrEqual(GRID_MAX_COLS * GRID_MAX_ROWS);
        expect(current.interval).toBeGreaterThanOrEqual(SPAWN_INTERVAL_MIN);
        previous = current;
      }
    });

    it('treats negative and non-finite stages as the first rung', () => {
      expect(stageParamsFor(-3)).toEqual(stageParamsFor(0));
      expect(stageParamsFor(Number.NaN)).toEqual(stageParamsFor(0));
    });
  });

  describe('三档时钟与选档闸门 (§3.7 v1.78 档内计时判星)', () => {
    it('tierSecondsFor：1★ = time，2★/3★ = ×0.85 / ×0.70，地板按档取 STAR_TIER_FLOOR（§3.7 v1.82）', () => {
      expect(STAR_TIER_K).toEqual([1.0, 0.85, 0.7]);
      expect(STAR_TIER_MIN_GAP).toBe(4);
      expect(STAR_TIER_FLOOR).toEqual([30, 26, 22]);
      expect(tierSecondsFor(200, 1)).toBe(200);
      expect(tierSecondsFor(200, 2)).toBe(170);
      expect(tierSecondsFor(200, 3)).toBe(140);
      // 小关的 3★ 不得被钳到与 1★ 同值（旧 MIN=120 会把三档塌缩成一个数）。
      expect(tierSecondsFor(84, 3)).toBe(59);
      // v1.81 以前这里钳到 30 ⇒ 与 1★ 同值（三档全塌）；v1.82 起 3★ 地板 = 22。
      expect(tierSecondsFor(30, 3)).toBe(22);
      expect(tierSecondsFor(30, 2)).toBe(26);
      // 塌缩三关的新读数（WXG-T-353 逐关实算 · 体检 R-2 核销依据）
      expect(tierSecondsFor(32, 2)).toBe(27);
      expect(tierSecondsFor(32, 3)).toBe(22);
      expect(tierSecondsFor(37, 2)).toBe(31);
      expect(tierSecondsFor(37, 3)).toBe(26);
      expect(tierSecondsFor(200, 99)).toBe(140); // 越界钳到 3★
      expect(tierSecondsFor(200, 0)).toBe(200); // 下界钳到 1★
    });

    it('nextTierFor：单条件闸门（档 = 本关历史最高 +1，封顶 3★）——v1.78 删 (b) 腿', () => {
      // 全新关 ⇒ 1★
      expect(nextTierFor(0)).toBe(1);
      // 递进：过了 1★ ⇒ 开 2★；过了 2★ ⇒ 开 3★
      expect(nextTierFor(1)).toBe(2);
      expect(nextTierFor(2)).toBe(3);
      // 已满星不再升；越界入参归一
      expect(nextTierFor(3)).toBe(3);
      expect(nextTierFor(9)).toBe(3);
      // 订正声明（K-053 换形不换判据源）：旧双条件臂 `nextTierFor(2, 1) === 2` /
      // `nextTierFor(2, 0) === 1` / 首关豁免 `null` 臂已整族作废（用户 2026-10-16
      // 裁定 Q：档位开放改单条件，见 star-collect-rule R5 / §3.7 v1.78）。
    });

    it('computeClearStars：档内按实际用时判星（三线 = tierSecondsFor 三档值）', () => {
      // 以 levelTime=300 为例：3★ 线 = 210，2★ 线 = 255（均含边界 ≤）。
      // ① 1★ 档进场、用时 60s ⇒ 当场跳 3★（用户规则「超过 3★ 水平直接给 3 星」）
      expect(computeClearStars(240, 300, 300, 1)).toEqual({ ratio: 0.8, stars: 3 });
      // ② 用时 230s ⇒ 2★；③ 用时 280s ⇒ 1★（倒计时内完成保底 1★）
      expect(computeClearStars(70, 300, 300, 1).stars).toBe(2);
      expect(computeClearStars(20, 300, 300, 1).stars).toBe(1);
      // ④ 3★ 档（total=210）倒计时内完成 ⇒ 用时必 ≤210 ⇒ 必 3★（压线含边界）
      expect(computeClearStars(0, 210, 300, 3).stars).toBe(3);
      // ⑤ 续时保底 = 进场档位星（用过广告 ⇒ ⛔ 不按用时跳档，R4）
      expect(computeClearStars(290, 300, 300, 2, true).stars).toBe(2);
      expect(computeClearStars(290, 300, 300, 1, true).stars).toBe(1);
      // ⑥ 越界 tier 归一只在**保底臂**成立（未续时星级与 tier 无关）；ratio 仍输出只供结算分
      expect(computeClearStars(10, 300, 300, 0, true).stars).toBe(1);
      expect(computeClearStars(10, 300, 300, 9, true).stars).toBe(3);
      expect(computeClearStars(150, 300, 300, 2).ratio).toBe(0.5);
    });

    it('SEC_PER_STEP 量纲 = 每批量动作秒数（旧 SEC_PER_TAP 每点击 3.6s 已重锚）', () => {
      expect(SEC_PER_STEP).toBe(1.69);
    });

    it('逐关三档时钟必须严格单调（§3.7 v1.82 防塌缩 · 取代旧「常量 vs 历史极值」断言）', () => {
      expect(STAR_TIER_FLOOR[0]).toBe(LEVEL_TIME_MIN); // 1★ 地板 = 关表 `time` 合法下界（§3.7 v1.76 单一真源语义不破）
      // 旧防线（K-053 留档）：`expect(LEVEL_TIME_MIN).toBeLessThanOrEqual(59)`，注释写
      // 「否则档位塌缩」。失效原因：59 是**八关时代**最短 3★ 档的快照，且不逐关检查 ⇒
      // 关表涨到 10 关、L00001 / L00006 / L00008 真在塌缩时它照样绿（K-161 ⑥ / K-036 谱系）。
      const collapsed: string[] = [];
      for (const lv of LEVELS_DATA.levels) {
        const a = tierSecondsFor(lv.time, 1);
        const b = tierSecondsFor(lv.time, 2);
        const c = tierSecondsFor(lv.time, 3);
        if (!(c < b && b < a)) {
          collapsed.push(`L${String(lv.id).padStart(5, '0')} ${a}/${b}/${c}`);
        }
      }
      expect(collapsed).toEqual([]);
    });
  });

  describe('normalSettleScore (C7)', () => {
    it('applies stars ×1000 + ratio ×1000 − powerups ×50 + unused-expansion bonus', () => {
      expect(normalSettleScore(3, 1, 0, false)).toBe(4200);
      expect(normalSettleScore(2, 0.5, 3, false)).toBe(2550);
      expect(normalSettleScore(0, 0, 0, true)).toBe(0);
    });

    it('clamps stars to 0..3, ratio to 0..1 and ignores negative powerup counts', () => {
      expect(normalSettleScore(9, 0, 0, true)).toBe(3000);
      expect(normalSettleScore(-4, 0, 0, true)).toBe(0);
      expect(normalSettleScore(0, 5, 0, true)).toBe(1000);
      expect(normalSettleScore(0, -2, 0, true)).toBe(0);
      expect(normalSettleScore(1, 0.5, -5, true)).toBe(1500);
      expect(normalSettleScore(1, Number.NaN, 0, true)).toBe(1000);
    });
  });

  it('keeps tray rows inside the design width, with every tier row-aligned', () => {
    const rowWidth = TRAY_COLS * (TRAY_SLOT + TRAY_GAP) - TRAY_GAP;
    expect(rowWidth).toBeLessThanOrEqual(DESIGN_W);
    // v1.83 三档（用户 2026-10-25）：12 / 24 / 48 = **1 / 2 / 4 整行**，顶档恰好铺满托盘带。
    expect(TRAY_TIER_SLOTS).toEqual([1 * TRAY_COLS, 2 * TRAY_COLS, 4 * TRAY_COLS]);
    expect(TRAY_BASE_SLOTS).toBe(1 * TRAY_COLS);
    expect(TRAY_MAX_SLOTS).toBe(4 * TRAY_COLS);
    // 带高必须容下**顶档**行数（4 行 = 234 = 带高，零溢出；v1.24 定带高即为此口径）。
    expect(TRAY_BAND.yMax - TRAY_BAND.yMin).toBeGreaterThanOrEqual(
      Math.ceil(TRAY_MAX_SLOTS / TRAY_COLS) * (TRAY_SLOT + TRAY_GAP) - TRAY_GAP + 2 * TRAY_PANEL_PAD,
    );
  });

  // 缩放控件条落位不变量（“不影响面板操作”的可机检形式，2026-09-26 盘带下沿 480→560 同批）。
  // ⛔ 本例五腿均为**符号式**，不写 452/540 这类快照数 ⇒ 真源再换尺时只跟不坏。
  it('缩放控件条落在盘面与托盘之外的净空带 ⇒ 零遮叠', () => {
    const zc = zoomControlLayout();
    const stripTop = zc.track.y + zc.track.h;
    const stripBottom = zc.reset.y;
    // ① 热区合规（§3.8 C1 / `TOUCH_MIN`）——底部净空不够时的偷减入口就在此钉住。
    expect(zc.reset.w).toBeGreaterThanOrEqual(TOUCH_MIN);
    expect(zc.reset.h).toBeGreaterThanOrEqual(TOUCH_MIN);
    expect(zc.track.h).toBeGreaterThanOrEqual(TOUCH_MIN);
    // ② 上界：最大档时盘面最底行命中框下探 `BEAD_HIT_PAD × CAMERA_ZOOM_MAX`（§3.3 v1.59 绝对档）
    //    ⇒ 控件条顶不得越过它，否则就有珠子的点击被吃掉。
    expect(stripTop).toBeLessThanOrEqual(PUZZLE_BAND.yMin - BEAD_HIT_PAD * CAMERA_ZOOM_MAX);
    // ③ 下界：托盘 row0 槽命中框顶仍在控件条之下 ⇒ 也不抢托盘（换源后现余量 12px，`[待真机]`）。
    const trayHitTop = TRAY_BAND.yMax - TRAY_PANEL_PAD - TRAY_SLOT / 2 + TRAY_HIT_SIZE / 2;
    expect(stripBottom).toBeGreaterThanOrEqual(trayHitTop);
    // ④ 整条在托盘面板（贴上沿）之上、且不越屏左/右。
    expect(stripBottom).toBeGreaterThan(TRAY_BAND.yMax);
    expect(zc.reset.x).toBeGreaterThanOrEqual(0);
    expect(zc.track.x + zc.track.w).toBeLessThan(DESIGN_W);
    // ⑤ 视觉不压盘带（[WXG-T-256] 容器板已退役 ⇒ 尺直接贴 `PUZZLE_BAND.yMin`，
    // 旧式 `− PLATE_OUTSET` 的外扩余量随之消失；“不影响面板”的字面形式不变）。
    expect(stripTop).toBeLessThan(PUZZLE_BAND.yMin);
  });
});
