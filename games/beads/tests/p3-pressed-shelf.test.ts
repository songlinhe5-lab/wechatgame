/**
 * P3 补原型：① 按下态（`snap.pressedButton` + 控件矩阵「按下」列）；② S7 作品陈列条（EP12-S7）；
 * ③ 主菜单按下态（`MetaViewData.pressed`）。
 *
 * 判据来源：screens.md 控件矩阵（T3 木 = 换 `woodFacePressed`、T1 纸 = 换 `cardPressed`、
 * 下沉 y+2、`reduceMotion` 只换面）；screens.md S5（陈列条：格 ≤160、条宽 ≤560、彩带禁飞带外、零热区）。
 */
import { describe, expect, it } from 'vitest';
import { RenderModelBuilder, type DrawCommand as RenderCommand } from '@wxgame/framework';
import {
  DESIGN_H,
  DESIGN_W,
  FINISH_SHELF,
  GEAR_HIT_SIZE,
  HUD_BAND,
  UI_PRESS_SINK,
} from '../src/config/tuning.js';
import { clearPanelLayout } from '../src/systems/clear-panel.js';
import { finishPanelLayout, hitFinishPanel } from '../src/systems/finish-panel.js';
import { pausePanelLayout } from '../src/systems/pause-panel.js';
import { DEFAULT_PALETTE, DEMO_BEAD_INKS } from '../src/view/palette.js';
import { buildBeadsView } from '../src/view/view-model.js';
import { buildMetaView, hitTestMeta, metaLayout, type MetaViewData } from '../src/view/meta-view.js';
import { BeadsShell } from '../src/game/beads-shell.js';
import { createBeadsHarness, simpleTestLevel, advancePastClearWave, type Harness } from './helpers.js';
import { renderPlayPage } from '../src/ui/play-binding.js';

const STEP = 1 / 60;
/** 彩带禁飞带（screens.md S5，设计 y）。 */
const CONFETTI_BAND = { yMin: 447, yMax: 787 } as const;

function frameOf(h: Harness): readonly RenderCommand[] {
  const b = new RenderModelBuilder(DESIGN_W, h.services.viewport.designHeight);
  b.begin();
  buildBeadsView(b, h.game.snapshot, DEFAULT_PALETTE, DEMO_BEAD_INKS);
  return b.end().commands;
}

/** 真输入链一帧（同 board-input-timing.test.ts 判例）。 */
function input(h: Harness, phase: 'down' | 'move' | 'up' | null, dx = 0, dy = 0): void {
  h.input.beginFrame();
  if (phase) {
    const s = { x: 0, y: 0 };
    h.services.viewport.designToScreen(s, dx, dy);
    h.input.push({ id: 1, x: s.x, y: s.y, phase, time: 0 });
  }
  h.game.update(STEP);
  h.input.endFrame(STEP);
  renderPlayPage(h.game, new RenderModelBuilder(DESIGN_W, DESIGN_H)); // 同步快照
}

function pausedHarness(key: string): Harness {
  const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: key });
  h.advance(STEP);
  h.game.tapDesign(GEAR_HIT_SIZE / 2, (HUD_BAND.yMin + HUD_BAND.yMax) / 2);
  h.advance(1);
  expect(h.game.phase).toBe('paused');
  return h;
}

function fillBoard(h: Harness): void {
  const grid = h.game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isFillable(r, c)) continue;
      h.game.selectTraySlot(h.game.giveTrayBead(grid.requiredColor(r, c)));
      h.game.tapGridCell(r, c);
    }
  }
}

const inRect = (c: RenderCommand, r: { xMin: number; yMin: number; xMax: number; yMax: number }): boolean => {
  const p = c.kind === 'line' ? { x: c.x1, y: c.y1 } : 'x' in c && 'y' in c ? { x: c.x, y: c.y } : null;
  return p !== null && p.x >= r.xMin - 0.5 && p.x <= r.xMax + 0.5 && p.y >= r.yMin - 0.5 && p.y <= r.yMax + 0.5;
};

describe('P3 · 面板按下态（snap.pressedButton）', () => {
  // T1 纸钮（选择器族）：按下即循环一档，不改钮的容器档 ⇒ 适合钉换面。
  const paper = pausePanelLayout('normal').buttons.find((b) => b.id === 'cycle-bead-size')!;
  const cx = (paper.rect.xMin + paper.rect.xMax) / 2;
  const cy = (paper.rect.yMin + paper.rect.yMax) / 2;

  it('按住 → 命中钮 id 入快照；抬起 → null；面板外按住 → null', () => {
    const h = pausedHarness('wxgame.beads.test.p3-press');
    input(h, 'down', cx, cy);
    expect(h.game.snapshot.pressedButton).toBe('cycle-bead-size');
    input(h, 'move', cx, cy);
    expect(h.game.snapshot.pressedButton).toBe('cycle-bead-size');
    input(h, 'up', cx, cy);
    expect(h.game.snapshot.pressedButton).toBeNull();
    input(h, 'down', 5, 5);
    expect(h.game.snapshot.pressedButton).toBeNull();
  });

  it('主钮抬起才提交：按住帧仍在 PAUSED（按下态已亮），抬起帧才切相位（WXG-T-295）', () => {
    const h = pausedHarness('wxgame.beads.test.p3-press-commit');
    const r = pausePanelLayout('normal').buttons.find((b) => b.id === 'resume')!.rect;
    const cx0 = (r.xMin + r.xMax) / 2;
    const cy0 = (r.yMin + r.yMax) / 2;
    input(h, 'down', cx0, cy0);
    // 旧行为「按下即提交 ⇒ 本帧相位已切走」；v2.13 起提交后移到抬起帧，本帧只亮按下态。
    expect(h.game.phase).toBe('paused');
    expect(h.game.snapshot.pressedButton).toBe('resume');
    input(h, 'up', cx0, cy0);
    expect(h.game.phase).toBe('playing');
    // 抬起提交那帧手指已离开 ⇒ 按下态同帧灭（旧「面板淡出期内续亮到淡完」的承载理由随时基
    // 消解：切相位与起淡出现发生在同一抬起帧，而该帧 `isDown` 已为 false）。
    expect(h.game.snapshot.pressedButton).toBeNull();
  });

  it('视觉：纸钮换 cardPressed 并下沉 UI_PRESS_SINK；reduceMotion 只换面不位移', () => {
    const h = pausedHarness('wxgame.beads.test.p3-press-view');
    const face = (cmds: readonly RenderCommand[], fill: string) =>
      cmds.find((c) => c.kind === 'rect' && c.fill === fill && Math.abs(c.x - paper.rect.xMin) < 1);
    expect(face(frameOf(h), DEFAULT_PALETTE.cardPressed)).toBeUndefined();

    input(h, 'down', cx, cy);
    const pressed = face(frameOf(h), DEFAULT_PALETTE.cardPressed);
    expect(pressed).toBeDefined();
    const idle = { ...h.game.snapshot, pressedButton: null };
    const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b.begin();
    buildBeadsView(b, idle, DEFAULT_PALETTE, DEMO_BEAD_INKS);
    const base = b.end().commands.find(
      (c) =>
        c.kind === 'rect' &&
        c.fill === DEFAULT_PALETTE.panel &&
        c.x === (pressed as { x: number }).x &&
        c.w === (pressed as { w: number }).w &&
        Math.abs(c.y - (pressed as { y: number }).y) < 10,
    );
    expect(base).toBeDefined();
    expect((pressed as { y: number }).y).toBeCloseTo((base as { y: number }).y - UI_PRESS_SINK, 5);

    const still = { ...h.game.snapshot, reduceMotion: true };
    const b2 = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    b2.begin();
    buildBeadsView(b2, still, DEFAULT_PALETTE, DEMO_BEAD_INKS);
    const rm = face(b2.end().commands, DEFAULT_PALETTE.cardPressed);
    expect((rm as { y: number }).y).toBeCloseTo((base as { y: number }).y, 5);
  });

  it('结算面板木主钮按下 ⇒ woodFacePressed', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel(), simpleTestLevel({ id: 2 })], saveKey: 'wxgame.beads.test.p3-press-clear' });
    fillBoard(h);
    advancePastClearWave(h);
    const r = clearPanelLayout({ lastLevel: false }).buttons.find((b) => b.id === 'next')!.rect;
    input(h, 'down', (r.xMin + r.xMax) / 2, (r.yMin + r.yMax) / 2);
    expect(h.game.snapshot.pressedButton).toBe('next');
    expect(frameOf(h).some((c) => c.kind === 'rect' && c.fill === DEFAULT_PALETTE.woodFacePressed)).toBe(true);
  });
});

describe('P3 · S7 作品陈列条（EP12-S7）', () => {
  it.each([1, 8, 9])('%i 关：格 ≤160、条宽 ≤560、禁飞带外、不压总览行与按钮', (n) => {
    const L = finishPanelLayout(n);
    const { plate, cells } = L.shelf;
    expect(cells).toHaveLength(n);
    expect(plate.xMax - plate.xMin).toBeLessThanOrEqual(FINISH_SHELF.w);
    expect(plate.yMax <= CONFETTI_BAND.yMin || plate.yMin >= CONFETTI_BAND.yMax).toBe(true);
    const lastRowBottom = L.rows[L.rows.length - 1]!.y - 32;
    expect(plate.yMax).toBeLessThanOrEqual(lastRowBottom);
    for (const b of L.buttons) expect(plate.yMin).toBeGreaterThanOrEqual(b.rect.yMax);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!;
      expect(c.xMax - c.xMin).toBeLessThanOrEqual(FINISH_SHELF.cellMax);
      expect(c.xMax - c.xMin).toBeGreaterThan(0);
      expect(c.xMax - c.xMin).toBe(c.yMax - c.yMin);
      if (i > 0) expect(c.xMin).toBeGreaterThanOrEqual(cells[i - 1]!.xMax);
      // 零热区：格心不命中任何钮。
      expect(hitFinishPanel((c.xMin + c.xMax) / 2, (c.yMin + c.yMax) / 2, n)).toBeNull();
    }
  });

  it('已通关格 = 珠拼缩略、未通关格 = 虚线空槽（只画线）', () => {
    const levels = [simpleTestLevel({ id: 301 }), simpleTestLevel({ id: 302 })];
    const h = createBeadsHarness({ noAssemble: true, levels, saveKey: 'wxgame.beads.test.p3-shelf' });
    h.game.goToLevel(1); // 只通第 2 关 ⇒ 第 1 格 = 空槽
    fillBoard(h);
    advancePastClearWave(h);
    const r = clearPanelLayout({ lastLevel: true }).buttons.find((b) => b.id === 'next')!.rect;
    expect(h.game.tapDesign((r.xMin + r.xMax) / 2, (r.yMin + r.yMax) / 2)).toBe(true);
    expect(h.game.phase).toBe('finish');
    h.advance(2);
    expect(h.game.snapshot.finishLevels).toHaveLength(2);

    const all = frameOf(h);
    const { plate, cells } = finishPanelLayout(2).shelf;
    const at = all.findIndex((c) => c.kind === 'rect' && c.fill === DEFAULT_PALETTE.panel && c.x === plate.xMin && c.y === plate.yMin);
    expect(at).toBeGreaterThan(0);
    const cmds = all.slice(at + 1); // 只看陈列条底板之后（底下盘面/托盘图元不算）
    const [empty, cleared] = cells;
    const inEmpty = cmds.filter((c) => inRect(c, empty!));
    const inCleared = cmds.filter((c) => inRect(c, cleared!));
    expect(inEmpty.length).toBeGreaterThan(0);
    expect(inEmpty.filter((c) => c.kind !== 'line')).toEqual([]);
    expect(inCleared.some((c) => c.kind !== 'line')).toBe(true);
  });
});

describe('P3 · 主菜单按下态（MetaViewData.pressed）', () => {
  it('shell：按住 ⇒ pressed = 命中钮（不派发）；抬到同一钮才派发并清按下态（WXG-T-295）', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.p3-menu' });
    const shell = new BeadsShell({ clock: () => 0, metaKey: 'wxgame.beads.test.p3-menu-meta', initialScreen: 'menu', play: { levels: [simpleTestLevel()] } });
    shell.init(h.services);
    const gear = metaLayout('none', undefined, shell.menuAnchors).buttons.find((b) => b.id === 'open-settings')!;
    const gx = gear.box.x + gear.box.w / 2;
    const gy = gear.box.y + gear.box.h / 2;
    const s = { x: 0, y: 0 };
    h.services.viewport.designToScreen(s, gx, gy);
    const data = (shell as unknown as { _viewData: MetaViewData })._viewData;

    h.input.beginFrame();
    h.input.push({ id: 1, x: s.x, y: s.y, phase: 'down', time: 0 });
    shell.update(STEP);
    h.input.endFrame(STEP);
    // 旧行为本帧已按「按下即提交」切到 settings（pressed 按新 overlay 求）；v2.13 起抬起才提交
    // ⇒ 本帧 overlay 未动，pressed 按**当前（未切）**overlay 的同一钮。
    expect(shell.overlay).toBe('none');
    expect(data.pressed).toBe(hitTestMeta('none', gx, gy, shell.menuAnchors));

    h.input.beginFrame();
    h.input.push({ id: 1, x: s.x, y: s.y, phase: 'up', time: 0 });
    shell.update(STEP);
    h.input.endFrame(STEP);
    expect(shell.overlay).toBe('settings');
    expect(data.pressed).toBeNull();
  });

  it('视图：程序化 CTA 按下 ⇒ woodFacePressed + 下沉；reduceMotion 不位移', () => {
    const base: MetaViewData = {
      stamina: 5, staminaMax: 5, coins: 0, overlay: 'none', signinDay: 0, canClaim: false,
      bgmMuted: false, sfxMuted: false, reduceMotion: false, largeText: false, vibrate: true, debugInfo: false, debugGuides: false,
      beadStyle: 'facet-4', beadSize: 'm' as MetaViewData['beadSize'], skinId: 'default',
      levelCount: 0, currentLevelIndex: 0, maxUnlockedLevel: 1, starsByLevel: [], wallSlots: [], wallLevels: [],
      carouselLevel: undefined,
    };
    const start = metaLayout('none').buttons.find((b) => b.id === 'start')!;
    const draw = (d: MetaViewData) => {
      const b = new RenderModelBuilder(DESIGN_W, DESIGN_H);
      b.begin();
      buildMetaView(b, d, DEFAULT_PALETTE);
      return b.end().commands;
    };
    const face = (cmds: readonly RenderCommand[], fill: string) =>
      cmds.find((c) => c.kind === 'rect' && c.fill === fill && c.x === start.box.x);
    const idle = face(draw(base), DEFAULT_PALETTE.accentPrimary)!;
    const down = face(draw({ ...base, pressed: start }), DEFAULT_PALETTE.woodFacePressed)!;
    expect(down).toBeDefined();
    expect((down as { y: number }).y).toBe((idle as { y: number }).y - UI_PRESS_SINK);
    const still = face(draw({ ...base, pressed: start, reduceMotion: true }), DEFAULT_PALETTE.woodFacePressed)!;
    expect((still as { y: number }).y).toBe((idle as { y: number }).y);
  });
});
