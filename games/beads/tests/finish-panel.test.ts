/**
 * S7 通关画面（FINISH）判据（WXG-T-066）。
 *
 * 冻结来源
 *  - 判据：`gdd/core-loop.md §8-8`「通过第 n 关（n<8）→ 第 n+1 关解锁并可进；第 8 关
 *    通过 → 进 FINISH；FINISH 可重玩第 1 关」；
 *  - 画面：`ux/ux-spec.md §3.6`（全屏庆祝 + 星级总览 + 去冲刺 + 重玩第 1 关）；
 *  - 输入：`gdd/input-control.md §2.3`「FINISH：**仅**面板按钮」+ `ux-spec §4` 矩阵行
 *    `FINISH | 去冲刺* / 重玩第 1 关`；`gdd/pause-settings.md §2`（去冲刺 = 副钮，U1 三处）；
 *  - 动画：入 200ms / 出 150ms、逐关 150ms（`ux-spec §5`，逐关为派生，见 `finish-panel.ts`）。
 *
 * ⚠️ 本文件同时是**旧行为的回归闸门**：`addState('finish')` 此前是空壳，`case 'finish'`
 * 把**任意点击**都当「重玩第 1 关」（面板外点击也会重开整轮）——§2.3 要求只认面板按钮。
 */

import { describe, expect, it } from 'vitest';
import {
  DESIGN_H,
  DESIGN_W,
  FINISH_STAR_GAP,
  FINISH_STAR_SIZE,
  TOUCH_MIN,
} from '../src/config/tuning.js';
import { clearPanelLayout } from '../src/systems/clear-panel.js';
import {
  FINISH_MAX_STARS_PER_LEVEL,
  FINISH_PANEL_TITLE,
  FinishPanel,
  finishPanelLabel,
  finishPanelLayout,
  hitFinishPanel,
} from '../src/systems/finish-panel.js';
import { createBeadsHarness, simpleTestLevel, advancePastClearWave, type Harness } from './helpers.js';

/** 8 关表（正常战役：`core-loop §4` 的「8 关全清」）。 */
const EIGHT = Array.from({ length: 8 }, (_, i) => simpleTestLevel({ id: 200 + i }));

/** 填满整块棋盘（不推进时钟 ⇒ ratio = 1；§3.7 v1.50 起星级 = 档位，首盘恒 1★）。 */
function fillBoard(harness: Harness): void {
  const grid = harness.game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isFillable(r, c)) continue;
      const slot = harness.game.giveTrayBead(grid.requiredColor(r, c));
      if (slot < 0) throw new Error(`tray full at (${r},${c})`);
      harness.game.selectTraySlot(slot);
      if (!harness.game.tapGridCell(r, c)) throw new Error(`place failed at (${r},${c})`);
    }
  }
}

/** 点结算面板的按钮（几何与命中同源；几何与 `lastLevel` 无关，见 clear-panel.test.ts 判例）。 */
function tapClear(h: Harness, id: 'next' | 'sprint'): boolean {
  const rect = clearPanelLayout({ lastLevel: true }).buttons.find((b) => b.id === id)!.rect;
  return h.game.tapDesign((rect.xMin + rect.xMax) / 2, (rect.yMin + rect.yMax) / 2);
}

/** 点通关画面的按钮。 */
function tapFinish(h: Harness, id: 'replay' | 'sprint'): boolean {
  const layout = finishPanelLayout(h.game.levelCount);
  const rect = layout.buttons.find((b) => b.id === id)!.rect;
  return h.game.tapDesign((rect.xMin + rect.xMax) / 2, (rect.yMin + rect.yMax) / 2);
}

/** 走到 FINISH：单关表填满 → 结算面板主钮（末关文案「查看结果」）。 */
function reachFinish(h: Harness): void {
  fillBoard(h);
  expect(h.game.phase).toBe('level-clear');
  advancePastClearWave(h); // 裁定 1（WXG-T-146）：波浪期内面板不可命中
  expect(tapClear(h, 'next')).toBe(true);
  expect(h.game.phase).toBe('finish');
}

describe('S7 通关画面（ux-spec §3.6 / core-loop §8-8）', () => {
  it('lays out one overview row per level, above two ≥TOUCH_MIN buttons', () => {
    const layout = finishPanelLayout(EIGHT.length);
    expect(layout.rows).toHaveLength(EIGHT.length);

    // 行自上而下（y 向上）、不重叠，且每行 3 颗星等距。
    for (let i = 0; i < layout.rows.length; i++) {
      const row = layout.rows[i]!;
      expect(row.level).toBe(i + 1);
      expect(row.starX).toHaveLength(3);
      expect(row.starX[1]! - row.starX[0]!).toBe(FINISH_STAR_SIZE + FINISH_STAR_GAP);
      if (i > 0) expect(row.y).toBeLessThan(layout.rows[i - 1]!.y);
      // 星与标签都落在设计空间内。
      expect(row.y).toBeGreaterThan(0);
      expect(row.y).toBeLessThan(DESIGN_H);
    }

    // 标题 / 总星数在总览之上。
    expect(layout.titleY).toBeGreaterThan(layout.totalY);
    expect(layout.totalY).toBeGreaterThan(layout.rows[0]!.y);

    // WXG-T-177（用户 2026-09-19「去冲刺按钮先隐藏」）：原双钮（▶去冲刺 / 重玩第 1 关）
    // 收敛为**单钮居中**；去冲刺入口不再产出（恢复见 `ux-spec §8` U1 原口径）。
    expect(layout.buttons.map((b) => b.id)).toEqual(['replay']);
    const lastRowY = layout.rows[layout.rows.length - 1]!.y;
    for (const button of layout.buttons) {
      expect(button.rect.yMax - button.rect.yMin).toBeGreaterThanOrEqual(TOUCH_MIN);
      expect(button.rect.yMax).toBeLessThan(lastRowY);
      expect(button.rect.xMin).toBeGreaterThan(0);
      expect(button.rect.xMax).toBeLessThan(DESIGN_W);
    }
    const onlyBtn = layout.buttons[0]!.rect;
    expect((onlyBtn.xMin + onlyBtn.xMax) / 2).toBe(DESIGN_W / 2);
  });

  it('labels: main = 重玩第 1 关（WXG-T-177：去冲刺副钮已隐藏，文案分支保留备复建）', () => {
    expect(finishPanelLabel('replay')).toBe('重玩第 1 关');
    expect(finishPanelLabel('sprint')).toBe('▶ 去冲刺');
    expect(FINISH_PANEL_TITLE).toContain('通关');
    expect(FINISH_MAX_STARS_PER_LEVEL).toBe(3);
  });

  it('resolves hits only inside the single button（WXG-T-177：原副钮位零命中）', () => {
    const layout = finishPanelLayout(EIGHT.length);
    const primary = layout.buttons[0]!.rect;
    const centre = (r: { xMin: number; xMax: number; yMin: number; yMax: number }) =>
      [(r.xMin + r.xMax) / 2, (r.yMin + r.yMax) / 2] as const;

    expect(hitFinishPanel(...centre(primary), EIGHT.length)).toBe('replay');
    // 主钮右侧（原副钮「▶去冲刺」区域）+ 总览行 + 屏幕死角：全部零命中（§2.3 面板外零响应）。
    expect(hitFinishPanel(primary.xMax + 5, primary.yMin + 5, EIGHT.length)).toBeNull();
    expect(hitFinishPanel(DESIGN_W / 2, layout.rows[0]!.y, EIGHT.length)).toBeNull();
    expect(hitFinishPanel(0, 0, EIGHT.length)).toBeNull();
  });

  it('ramps progress 0→1 on open, 1→0 on close, and ignores taps while fading out', () => {
    const panel = new FinishPanel();
    expect(panel.visible).toBe(false);
    expect(panel.progress).toBe(0);
    expect(panel.hitTest(DESIGN_W / 2, 0, EIGHT.length)).toBeNull();

    panel.open();
    expect(panel.visible).toBe(true);
    expect(panel.interactive).toBe(true);
    panel.update(100);
    expect(panel.progress).toBeGreaterThan(0);
    expect(panel.progress).toBeLessThan(1);
    panel.update(200);
    expect(panel.progress).toBe(1);

    panel.close();
    expect(panel.interactive).toBe(false); // 淡出期不接受点击
    const rect = finishPanelLayout(EIGHT.length).buttons[0]!.rect;
    expect(
      panel.hitTest((rect.xMin + rect.xMax) / 2, (rect.yMin + rect.yMax) / 2, EIGHT.length),
    ).toBeNull();
    panel.update(150);
    expect(panel.visible).toBe(false);
    expect(panel.progress).toBe(0);
  });

  it('enters overview rows one per level with a 0→1.2→1 pop', () => {
    const panel = new FinishPanel();
    panel.open();
    // 逐关 150ms（派生：见 finish-panel.ts —— 24 颗逐颗要 3.6s，逐关 1.2s）。
    expect(panel.rowsShown(8)).toBe(1);
    panel.update(150);
    expect(panel.rowsShown(8)).toBe(2);
    panel.update(150 * 6);
    expect(panel.rowsShown(8)).toBe(8);
    panel.update(150); // 再等也不会多出第 9 行（上限 = 关卡数）
    expect(panel.rowsShown(8)).toBe(8);

    const fresh = new FinishPanel();
    fresh.open();
    expect(fresh.rowPopScale(0)).toBe(0);
    fresh.update(75); // 半程 ⇒ 冲到 1.2
    expect(fresh.rowPopScale(0)).toBeCloseTo(1.2, 6);
    fresh.update(75); // 全程结束 ⇒ 回到 1
    expect(fresh.rowPopScale(0)).toBe(1);
  });

  it('§8-8: clearing a non-final level advances to n+1; the last level enters FINISH', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: EIGHT,
      saveKey: 'wxgame.beads.test.fin-8',
    });

    // 通过第 1 关 → 第 2 关可进。
    fillBoard(h);
    expect(h.game.phase).toBe('level-clear');
    expect(h.game.levelIndex).toBe(0);
    advancePastClearWave(h);
    expect(tapClear(h, 'next')).toBe(true);
    expect(h.game.phase).toBe('playing');
    expect(h.game.levelIndex).toBe(1);

    // 第 8 关通过 → 进 FINISH，且**通关画面开**、结算面板退场（不叠两层）。
    h.game.goToLevel(7);
    fillBoard(h);
    expect(h.game.phase).toBe('level-clear');
    advancePastClearWave(h);
    expect(h.game.clearPanel.interactive).toBe(true); // 面板在等按钮（末关主钮 = 查看结果）
    expect(tapClear(h, 'next')).toBe(true);
    expect(h.game.phase).toBe('finish');
    expect(h.game.finishPanel.visible).toBe(true);
    expect(h.game.clearPanel.interactive).toBe(false); // 交接：立即不再接受点击
    h.advance(0.2); // 结算面板 150ms 淡出走完
    expect(h.game.clearPanel.visible).toBe(false);
    expect(h.game.snapshot.finishPanelVisible).toBe(true);
  });

  it('§2.3/§4: FINISH answers panel buttons only — a stray tap never restarts', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 210 })],
      saveKey: 'wxgame.beads.test.fin-stray',
    });
    reachFinish(h);
    const layout = finishPanelLayout(h.game.levelCount);

    // 面板外（总览行中央）、两钮间隙、屏幕角落：零响应、不推进（旧实现会重开整轮）。
    for (const [x, y] of [
      [DESIGN_W / 2, layout.rows[0]!.y],
      [layout.buttons[0]!.rect.xMax + 5, layout.buttons[0]!.rect.yMin + 5],
      [0, 0],
    ] as const) {
      expect(h.game.tapDesign(x, y)).toBe(false);
      expect(h.game.phase).toBe('finish');
      expect(h.game.levelIndex).toBe(0);
    }

    // 淡出期（close 后 150ms 内）点按钮也不生效。
    h.game.finishPanel.close();
    h.advance(0.05);
    expect(tapFinish(h, 'replay')).toBe(false);
    expect(h.game.phase).toBe('finish');
  });

  it('§8-8: FINISH replays from level 1 (normal) and the secondary enters sprint', () => {
    // ① 主钮「重玩第 1 关」→ 从第 1 关重开（整轮重玩）。
    const replay = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 211 })],
      saveKey: 'wxgame.beads.test.fin-replay',
    });
    replay.game.goToLevel(0);
    reachFinish(replay);
    expect(tapFinish(replay, 'replay')).toBe(true);
    expect(replay.game.phase).toBe('playing');
    expect(replay.game.levelIndex).toBe(0);
    expect(replay.game.mode).toBe('normal');
    replay.advance(0.2);
    expect(replay.game.finishPanel.visible).toBe(false); // 淡出跑完

    // ② WXG-T-177（用户 2026-09-19「去冲刺按钮先隐藏」）：原副钮「▶去冲刺」
    //（U1 第三处入口）已隐藏 ⇒ **不可达**：面板只产出 `'replay'`，原副钮位点击
    // 零响应、相位与模式不变（冲刺模式实现保留，仅入口收敛）。
    const hidden = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 212 })],
      saveKey: 'wxgame.beads.test.fin-sprint',
    });
    reachFinish(hidden);
    expect(hidden.game.finishPanel.visible).toBe(true);
    const onlyBtn = finishPanelLayout(1).buttons[0]!.rect;
    hidden.game.tapDesign(onlyBtn.xMax + 5, onlyBtn.yMin + 5); // 原副钮位
    expect(hidden.game.phase).toBe('finish');
    expect(hidden.game.mode).toBe('normal');
  });

  it('collects per-level best stars into the snapshot overview', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: EIGHT,
      saveKey: 'wxgame.beads.test.fin-stars',
    });

    // 未通关的关 = 0；通关的关记下本关星级。
    fillBoard(h);
    expect(h.game.starsByLevel[0]).toBe(1);
    expect(h.game.starsByLevel[1]).toBe(0);
    h.game.goToLevel(4);
    fillBoard(h);
    expect(h.game.starsByLevel[4]).toBe(1);

    h.advance(1 / 60);
    const snap = h.game.snapshot;
    expect(snap.finishStars).toHaveLength(EIGHT.length);
    expect(snap.finishStars[0]).toBe(1);
    expect(snap.finishStars[1]).toBe(0);
    expect(snap.finishStars[4]).toBe(1);
  });

  it('persists the per-level stars across a relaunch (S8 §2.2 stars / §8-2 重启保留)', () => {
    // 共享 storage 的两个 harness = 真「重启」语义。
    const shared = createBeadsHarness({
      noAssemble: true,
      levels: EIGHT,
      saveKey: 'wxgame.beads.test.fin-persist-seed',
    }).platform.createStorage();
    const KEY = 'wxgame.beads.test.fin-persist';

    const first = createBeadsHarness({
      noAssemble: true, levels: EIGHT, saveKey: KEY, storage: shared
    });
    fillBoard(first); // L1 ⇒ 1★（首盘 = 1★ 档）
    first.game.goToLevel(4);
    fillBoard(first); // L5 ⇒ 1★（(b) 闸门下仍只开 1★）
    expect(first.game.starsByLevel[0]).toBe(1);
    expect(first.game.starsByLevel[4]).toBe(1);

    const second = createBeadsHarness({
      noAssemble: true, levels: EIGHT, saveKey: KEY, storage: shared
    });
    expect(second.game.starsByLevel[0]).toBe(1); // 从存档装载，非局内累计
    expect(second.game.starsByLevel[4]).toBe(1);
    expect(second.game.starsByLevel[1]).toBe(0);
    second.advance(1 / 60);
    expect(second.game.snapshot.finishStars).toEqual([1, 0, 0, 0, 1, 0, 0, 0]);
  });

  it('keeps the per-level max: a worse replay never downgrades the overview', () => {
    const h = createBeadsHarness({
      noAssemble: true,
      levels: [simpleTestLevel({ id: 213, time: 300 })],
      saveKey: 'wxgame.beads.test.fin-best',
    });
    fillBoard(h); // 首关首盘 ⇒ 1★ 档；不推进时钟 ⇒ 大量剩余
    expect(h.game.starsByLevel[0]).toBe(1);
    // §3.7 v1.50 回归防线：**星级 = 本局档位，与剩余时间占比完全脱钩**。
    // 旧制在这里靠 `STAR2_RATIO` 阈值把时间烧进 1★ 区⇒ 得 1★；新制下同一行为
    // 必须仍是满档星。重打时档由闸门递进到 2★（首关豁免条件 (b)），时钟随之缩放 ×0.85。
    h.game.goToLevel(0);
    expect(h.game.tierThisLevel).toBe(2);
    const total = h.game.remaining;
    expect(total).toBe(Math.round(300 * 0.85)); // 2★ 时钟，不是 1★ 的 300
    while (h.game.remaining > total * 0.02 && h.game.phase === 'playing') h.advance(1 / 60);
    // v2.0 供料已关停（WXG-T-136）⇒ 旧「usePowerup('clearAll') 腾托盘」步骤随
    // 死路径删除；托盘在本玩法下恒为空，无需腾挪。
    fillBoard(h);
    expect(h.game.lastStars).toBe(2); // 烧掉 98% 时钟仍拿满本档
    expect(h.game.starsByLevel[0]).toBe(2); // 总览取历史最好（不会因重玩而降）
  });
});
