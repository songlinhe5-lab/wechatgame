/**
 * `view/view-model.ts` — 快照 → 绘制指令（control-manifest §8：只读、每帧重建、可复现）。
 *
 * Why this file exists: the 392-line view model had **no test at all** while breakout's
 * equivalent (`tests/view-model.test.ts`) did. Two things matter here and neither is
 * visible from the harness: the model must not mutate game state, and the symbol
 * channel must reach **every** filled cell (not just some).
 */

import { describe, it, expect } from 'vitest';
import { RenderModelBuilder, type DrawCommand } from '@wxgame/framework';
import {
  BEAD_PITCH,
  DESIGN_H,
  DESIGN_W,
  POWERUP_BAND,
  POWERUP_CARD_H,
  POWERUP_CARD_W,
  POWERUP_LABEL_H,
  TOUCH_MIN,
  powerupCardRects,
  powerupLabelY,
} from '../src/config/tuning.js';
import { POWERUP_LABELS } from '../src/systems/powerups.js';
import { computeFitZoom } from '../src/systems/board-camera.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { createBeadsHarness, placeColor, simpleTestLevel, type Harness } from './helpers.js';
import type { BeadsSnapshot } from '../src/game/state.js';

function render(harness: Harness): readonly DrawCommand[] {
  const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
  builder.begin();
  buildBeadsView(builder, harness.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
  return builder.end().commands;
}

/**
 * v1.5-r8：旧的「逐符号签名」（○ / ★ / ●）随 L5 符号层删除一并移除 ——
 * 符号图元不再存在，签名判别式也随之失去对象（且会被 L1c 孔的 circle 误判）。非色相通道
 * 现在的可机检形式 = “B0 底图砖覆盖全部可填格且与格态无关”（见下方两条判据）。
 */

/** Vertical centre of a command (polygons have no centre field ⇒ vertex mean). */
function centreY(cmd: DrawCommand): number {
  if (cmd.kind === 'circle' || cmd.kind === 'text') return cmd.y;
  if (cmd.kind === 'rect') return cmd.y + cmd.h / 2;
  if (cmd.kind === 'line') return (cmd.y1 + cmd.y2) / 2;
  if (cmd.kind === 'polygon') {
    // [WXG-T-128 裁定 B] points 放宽为 number[] | Float32Array ⇒ Array 方法须先收窄
    const ys = Array.from(cmd.points).filter((_, i) => i % 2 === 1);
    return ys.reduce((a, b) => a + b, 0) / ys.length;
  }
  return Number.NaN;
}

/** Fill a level completely, one matching bead at a time. */
function fillBoard(harness: Harness): number {
  const { game } = harness;
  let placed = 0;
  for (let row = 0; row < game.grid.rows; row++) {
    for (let col = 0; col < game.grid.cols; col++) {
      if (placeColor(game, game.grid.requiredColor(row, col), row, col)) placed++;
    }
  }
  return placed;
}

/**
 * 底图砖过滤（`drawTargetTile` 产出的唯一图元）。`pitch` = 本盘实际格距。
 *
 * 甲案（`ADR-0020` 附录 A / WXG-T-206）后 tile 边长 = `BEAD_PITCH·z` 而非绝对 52，
 * 所以缩放档的判据必须传 `snap.gridPitch`。但**恒等档那两条旧判据故意写字面量
 * `BEAD_PITCH`**（见下方 vm-c / vm-d），它们的作用就是无条件地钉住「z=1 逐位不变」。
 */
function tileRects(cmds: readonly DrawCommand[], pitch: number) {
  return cmds.filter(
    (c): c is Extract<DrawCommand, { kind: 'rect' }> => c.kind === 'rect' && c.w === pitch,
  );
}

describe('beads view model (control-manifest §8)', () => {
  // §8：同一快照渲染两次必须逐字节相同 —— 视图是快照的纯函数。
  it('§8 renders the same snapshot to identical commands', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-a',
    });
    expect(render(harness)).toEqual(render(harness));
  });

  // §8：UI/渲染层不持有游戏状态 —— 渲染不得写回快照。
  it('§8 never mutates the snapshot it renders', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-b',
    });
    const before = JSON.stringify(harness.game.snapshot);
    render(harness);
    render(harness);
    expect(JSON.stringify(harness.game.snapshot)).toBe(before);
  });

  // ⛔ v1.5-r8（2026-09-23 用户拍板）：L5 符号层整层删除，目标侧区分改由
  // **连续目标色底图 B0** 承担。旧 A1「每已填格都有满墨符号」因此**换成更强的同位判据**：
  // 底图必须覆盖**每一个可填格**（不是只有已填格），且**放豆前后一模一样**。
  // ⇒ 这才是「有豆/无豆 = 一张图」的可机检形式（旧「零符号」写法会被孔的 circle 假阳性干扰）。
  it('v1.5-r8：B0 底图覆盖全部可填格，且放豆前后逐字段不变（= 一张图）', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()], // 3 colours ⇒ validator-legal; '123123' × 5 rows
      saveKey: 'wxgame.beads.test.vm-c',
    });
    // ⚠ **恒等档不变式**（甲案 / WXG-T-206）：6×5 盘被 `computeFitZoom` 的 `Math.min(1, …)`
    // 钉在 z = 1 ⇒ 格距恰为 `BEAD_PITCH`，所以下面的字面量过滤器**仍然是对的**，本例职责 =
    // 守住「不缩放时快照与渲染逐位不变」。前置那条保证它不会静默退化成永真过滤（K-041）。
    expect(harness.game.snapshot.gridPitch).toBe(BEAD_PITCH);
    const tiles = (cmds: readonly DrawCommand[]) =>
      cmds.filter((c) => c.kind === 'rect' && c.w === BEAD_PITCH);
    const blank = tiles(render(harness));
    expect(blank).toHaveLength(harness.game.grid.fillableTotal);
    expect(fillBoard(harness)).toBe(30);
    const after = tiles(render(harness));
    expect(after).toHaveLength(30);
    // 逐字段相同 ⇒ 填豆完全不改变背景（色档、位置、圆角均不变）。
    expect(after).toEqual(blank);
  });

  // A3 灰度可辨：旧判据靠“每格都有符号”撑，符号已删 ⇒ 改钉「底图色档与格态无关」。
  it('A3（v1.5-r8）：空格与有豆格共用同一块底图砖，不因格态改色档', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-d',
    });
    // 同上：本例也在 z = 1 恒等档（`simpleTestLevel()` = 6×5），故字面量 `BEAD_PITCH`
    // 逐字不改——它同时是「甲案没弄坏恒等档」的现场证据。
    expect(harness.game.snapshot.gridPitch).toBe(BEAD_PITCH);
    const tileFills = (cmds: readonly DrawCommand[]) =>
      cmds
        .filter((c): c is Extract<DrawCommand, { kind: 'rect' }> => c.kind === 'rect' && c.w === BEAD_PITCH)
        .map((c) => c.fill)
        .sort();
    const blank = tileFills(render(harness));
    // 填每行第 0 列（5 颗就位珠）⇒ 底图砖集合不得因“有豆/无豆”而发生颜色变化。
    for (let row = 0; row < harness.game.grid.rows; row++) placeColor(harness.game, 1, row, 0);
    expect(tileFills(render(harness))).toEqual(blank);
    // 背景仍覆盖全部可填格（旧“空坑亮 base / 珠下暗 edge”两档并存的情形的回归防线）。
    expect(blank).toHaveLength(harness.game.grid.fillableTotal);
    expect(new Set(blank).size).toBeGreaterThan(1); // 确实按目标色分档，不是一色平铺
  });

  // A4（WXG-T-062 转真）：三张道具卡**以形状为唯一识别** + 卡下方 28px **文字标签并列**，
  // 且「卡 + 标签」整块几何落在 POWERUP_BAND 内（§1.4 与 §3.1 曾冲突，裁定见 T-062）。
  it('A4 draws three shape-unique powerup glyphs with 28px labels inside the band', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-a4',
    });
    const commands = render(harness);
    const inBand = (cmd: DrawCommand): boolean => {
      const y = centreY(cmd);
      return y >= POWERUP_BAND.yMin && y <= POWERUP_BAND.yMax;
    };
    const centreX = (cmd: DrawCommand): number => {
      if (cmd.kind === 'circle' || cmd.kind === 'text') return cmd.x;
      if (cmd.kind === 'rect') return cmd.x + cmd.w / 2;
      if (cmd.kind === 'line') return (cmd.x1 + cmd.x2) / 2;
      if (cmd.kind === 'polygon') {
        // [WXG-T-128 裁定 B] 同上：先收窄再走 Array 方法
        const xs = Array.from(cmd.points).filter((_, i) => i % 2 === 0);
        return xs.reduce((a, b) => a + b, 0) / xs.length;
      }
      return Number.NaN;
    };

    // ① 三张标签文案逐字出现（§1.4 原文）。
    for (const label of Object.values(POWERUP_LABELS)) {
      expect(
        commands.some((c) => c.kind === 'text' && inBand(c) && c.text === label),
        `缺标签「${label}」`,
      ).toBe(true);
    }

    // ② 几何：卡与标签都落在带内；卡高 ≥ TOUCH_MIN（§1.4「整卡即热区」）。
    const rects = powerupCardRects();
    expect(rects).toHaveLength(3);
    for (const r of rects) {
      expect(r.w).toBe(POWERUP_CARD_W);
      expect(r.h).toBe(POWERUP_CARD_H);
      expect(r.h).toBeGreaterThanOrEqual(TOUCH_MIN);
      expect(r.bottom).toBeGreaterThanOrEqual(POWERUP_BAND.yMin);
      expect(r.bottom + r.h).toBeLessThanOrEqual(POWERUP_BAND.yMax);
    }
    const labelY = powerupLabelY();
    expect(labelY + POWERUP_LABEL_H / 2).toBeLessThanOrEqual(rects[0]!.bottom); // 标签在卡**下方**
    expect(labelY - POWERUP_LABEL_H / 2).toBeGreaterThanOrEqual(POWERUP_BAND.yMin);
    // 两侧留白：整组不贴屏边（T-062 间距 30 → 60 后仍成立）。
    expect(rects[0]!.x).toBeGreaterThanOrEqual(30);
    expect(rects[2]!.x + rects[2]!.w).toBeLessThanOrEqual(DESIGN_W - 30);

    // ③ 「以形状为唯一识别」：三张卡内的图元组合互不相同。
    const signature = (r: { x: number; w: number; bottom: number; h: number }): string =>
      commands
        .filter(
          (c) =>
            inBand(c) &&
            centreX(c) >= r.x &&
            centreX(c) <= r.x + r.w &&
            centreY(c) >= r.bottom &&
            centreY(c) <= r.bottom + r.h,
        )
        .map((c) => c.kind)
        .sort()
        .join(',');
    const sigs = rects.map(signature);
    expect(new Set(sigs).size).toBe(3);
    for (const sig of sigs) expect(sig).toContain('polygon'); // 每张都有图标本体
  });

  // BD-43（WXG-T-127）/ T-062 判例回归：渲染矩形与命中矩形**同源**。两侧都必须走
  // `powerupCardRects()`（drawPowerupBand 与 `_hitPowerupCard`）——若渲染侧再度
  // 私写一套坐标（T-124 改版曾疑是复发源），本断言当场红：每张命中卡的 (x, bottom,
  // w, h) 必须在渲染指令里有一条**逐值相等**的白卡矩形（投影矩形在 bottom−3，不会误配）。
  it('BD-43/T-062 回归：drawn card rect equals the hit rect value-for-value', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-t127',
    });
    const commands = render(harness);
    for (const r of powerupCardRects()) {
      const drawn = commands.find(
        (c) => c.kind === 'rect' && c.x === r.x && c.y === r.bottom && c.w === r.w && c.h === r.h,
      );
      expect(
        drawn,
        `命中卡 (${r.x},${r.bottom},${r.w}×${r.h}) 无逐值相等的绘制矩形 —— 渲染/命中两套坐标复发`,
      ).toBeDefined();
    }
  });

  // BD-46（WXG-T-127）回归：HUD 模式标签右对齐锚必须在屏右 30 边距 —— 原锚
  // DESIGN_W−220 令白字左段压白胶囊（读成「AGE 1」）。
  it('BD-46 回归：HUD mode label anchors at DESIGN_W − 30 (clear of the timer capsule)', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-t127b',
    });
    const commands = render(harness);
    const label = commands.find(
      (c) => c.kind === 'text' && /^LV |^STAGE /.test(c.text),
    ) as Extract<DrawCommand, { kind: 'text' }> | undefined;
    expect(label, 'HUD 模式标签（LV n/N / STAGE n）未渲染').toBeDefined();
    expect(label!.x).toBe(DESIGN_W - 30);
    expect(label!.align).toBe('right');
  });

  // architecture-beads §4 规模账：指令数随格数线性增长。
  // ⚠ 注记订正（WXG-T-207-A 顺手清残留）：旧文称 13×12「= GRID_MAX_COLS × GRID_MAX_ROWS」
  // 自 v1.34/v1.37/v1.45 起已不成立（现 GRID_MAX = 32×32）⇒ 本例的 13×12 只是**规模夹具**，
  // 不是硬顶；与基尺无关（预算与图元条数都不随 `BEAD_PITCH` 变），故 v1.57 换尺不动本例。
  it('§4 keeps the full-board command budget at the documented 900+ per frame', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [
        simpleTestLevel({
          cols: 13,
          rows: 12,
          // 13 列 × 12 行，三色（校验器要求 ≥3 色）——本例取的是**旧 GRID_MAX 时代的满格夹具**
          //（现 `GRID_MAX_*` = 32×32，单图上限变更见 §3.3 v1.45 注），与基尺无关。
          pattern: Array.from({ length: 12 }, () => '1231231231231'),
        }),
      ],
      saveKey: 'wxgame.beads.test.vm-e',
    });
    const filled = fillBoard(harness);
    expect(filled).toBe(156);

    const commands = render(harness);
    // v1.5-r8：旧判据「每珠 7 层卡 + 1 符号 = 8 条」里的符号层已删；现行为
    // 每珠 7 条卡层（L0a/L0b/L1/L2×2/L3×2 取代表值）以上 ⇒ 预算下限按 7 重算。
    expect(commands.length).toBeGreaterThanOrEqual(7 * 156);
    expect(commands.length).toBeGreaterThanOrEqual(900); // architecture-beads §4 规模账
    // v1.5-r8：旧「符号总数 = 已填格数」判据随符号层删除作废 ⇒ 改钉同等强度的
    // 「底图砖数 = 可填格数」（与格态无关），并保留每帧命令下限。
    // ⚠ **本例是甲案（WXG-T-206）真正改写的断言**：砖宽 = `snap.gridPitch`（而非硬编 pitch）。
    // v1.57（§3.3 32 基）后 13×12 回到 **fit=1 恒等档**（顶格档 22×18）⇒ 旧前置
    // 「`gridPitch < BEAD_PITCH`（本例在 z<1 档）」不再成立。本例职责是**命令预算与砖数守恒**
    // （与尺子无关），故前置改为符号式同尺锦（不依赖具体 zoom）；
    // z<1 的真缩放腿已住下一条（夹具换为 22×19）⇒ **未删断言、只是各归其位**（K-036）。
    const tiles = tileRects(commands, harness.game.snapshot.gridPitch);
    expect(tiles.length).toBe(harness.game.grid.fillableTotal);
    expect(harness.game.snapshot.gridPitch).toBe(computeFitZoom(13, 12) * BEAD_PITCH);
  });

  // ── 甲案主判据（`ADR-0020` 附录 A / WXG-T-206）：tile 必须吃相机缩放 ──────────────────
  // 上面 vm-c / vm-d 都在 6×5（z=1）⇒ 只能守恒等档，**证不了修复生效**。本例走同一真装配
  // 路径（`_setupLevel` ⇒ `fitCamera` ⇒ `gridLayoutFor`）拿一个 z<1 的盘，钉两件：
  //  (1) 砖宽 = `snap.gridPitch`，且命令流里**不再出现**任何“旧绝对值宽”底图；
  //  (2) 相邻砖零重叠——不共源不变量：只读命令流的 `x`/`w`，不用 `drawTargetTile` 的公式反推。
  // 修复前必红（旧 52 基）：格距 49.49 而砖宽 52 ⇒ 同行缝隙 = −2.51（重叠）；修复后缝隙恰为 0。
  // （K-036/K-060 判别力：把 `view-model.ts` 两处 `snap.gridPitch` 改回 `BEAD_PITCH` 必红。）
  // 已做变异自检并存档：旧形态同行最小缝隙 = **−2.508038585209**（必被本例判重叠），
  // 新形态 = **−1.14e−13**（仅浮点尾数，1e-9 容差内）——重叠那条对历史缺陷形态确有牙。
  it('甲案（WXG-T-206）：z<1 时底图砖随相机缩放且相邻零重叠', () => {
    // ⚠ 夹具由 13×12 换为 **22×19**：v1.57（§3.3 32 基）后顶格档抬到 22×18，
    // 13×12 已是 fit=1 恒等档 ⇒ 本例的**前置（真的在缩放档）**不成立。22×19 =
    // 顶格档 + 1 行（竖向恰好越界 ⇒ `fit = 592/606`）。⛔ 不得改用“删前置断言”求绿。
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [
        simpleTestLevel({
          cols: 22,
          rows: 19,
          pattern: Array.from({ length: 19 }, () => '123'.repeat(22).slice(0, 22)),
        }),
      ],
      saveKey: 'wxgame.beads.test.vm-zoom',
    });
    const snap = harness.game.snapshot;
    // 前置：本盘真的落在缩放档，且格距 = 真源 `computeFitZoom × BEAD_PITCH`（import 真源，
    // 不在测试里重推公式 ⇒ K-042）。
    expect(snap.gridPitch).toBeLessThan(BEAD_PITCH);
    expect(snap.gridPitch).toBe(computeFitZoom(22, 19) * BEAD_PITCH);

    const commands = render(harness);
    const tiles = tileRects(commands, snap.gridPitch);
    expect(tiles.length).toBe(harness.game.grid.fillableTotal);
    expect(tiles.every((t) => t.h === snap.gridPitch)).toBe(true);
    // (1) 反向锚：旧尺寸的底图砖一片都不剩（防“新旧两套砖都在画”的重复绘制回退）。
    expect(tileRects(commands, BEAD_PITCH)).toHaveLength(0);

    // (2) 同行相邻砖：后一块左缘不得越过前一块右缘（缝隙 ≥ 0；1e-9 仅为浮点尾数，
    // 与信号量级 2.51 差 9 个数量级 ⇒ 不会吞掉被测变更，K-041）。
    let checked = 0;
    const byRow = new Map<number, typeof tiles>();
    for (const t of tiles) {
      const row = byRow.get(t.y);
      if (row) row.push(t);
      else byRow.set(t.y, [t]);
    }
    for (const row of byRow.values()) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      for (let k = 1; k < sorted.length; k++) {
        const prev = sorted[k - 1]!;
        const cur = sorted[k]!;
        expect(cur.x - (prev.x + prev.w), `相邻底图砖重叠（row y=${cur.y}）`).toBeGreaterThanOrEqual(
          -1e-9,
        );
        checked++;
      }
    }
    // 相邻缝隙对数 = rows × (cols − 1)，由棋盘尺寸派生（v1.57 夹具换 22×19 ⇒ 399 对；
    // 字面 `12 * (13 - 1)` 是旧 13×12 夹具的快照，随夹具一起失效）。
    expect(checked).toBe(harness.game.grid.rows * (harness.game.grid.cols - 1)); // 真验了 399 个缝隙
  });

  // ux-spec §3.3：暂停面板必须整屏遮挡（防误触/防偷看），并带「暂停」标题。
  it('§3.3 covers the whole canvas with the pause scrim and prints the title', () => {
    const harness = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-f',
    });
    harness.game.onPause();
    harness.advance(0.3); // let panelProgress ramp without reaching the exit fade
    const snap: BeadsSnapshot = harness.game.snapshot;
    expect(snap.panelVisible).toBe(true);

    const commands = render(harness);
    const scrim = commands.find(
      (c) => c.kind === 'rect' && c.x === 0 && c.y === 0 && c.w === DESIGN_W && c.h === DESIGN_H,
    );
    expect(scrim).toBeDefined();
    expect(commands.some((c) => c.kind === 'text' && c.text === '暂停')).toBe(true);
  });

  // ux-spec §3 / D6：普通模式不显示分数 HUD，冲刺模式才显示。
  it('§3 hides the score HUD in normal mode and shows it in sprint mode', () => {
    const normal = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-g',
    });
    const normalText = render(normal)
      .filter((c) => c.kind === 'text')
      .map((c) => (c.kind === 'text' ? c.text : ''));
    expect(normalText.some((t) => t.startsWith('SCORE'))).toBe(false);

    const sprint = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.vm-h',
    });
    sprint.game.startSprint();
    const sprintText = render(sprint)
      .filter((c) => c.kind === 'text')
      .map((c) => (c.kind === 'text' ? c.text : ''));
    expect(sprintText.some((t) => t.startsWith('SCORE'))).toBe(true);
    expect(sprintText.some((t) => t.startsWith('STAGE'))).toBe(true);
  });
});
