/**
 * S9 pause & settings §8 criteria (gdd/pause-settings.md §8, ten hard probes).
 *
 * Every test drives the game through its **public** commands (`tapDesign` /
 * panel taps via the layout hit zones) so the assertions read as player-level
 * behaviour rather than internals — except where the criterion itself is about
 * a stored value (save document) or the animation clock.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { RenderModelBuilder, type RectCommand, type TextCommand } from '@wxgame/framework';
import {
  createBeadsHarness,
  simpleTestLevel,
  placeColor,
  type Harness,
} from './helpers.js';
import { clearPanelLayout } from '../src/systems/clear-panel.js';
import {
  pausePanelLayout,
  rectsOverlap,
  type PausePanelAction,
} from '../src/systems/pause-panel.js';
import {
  AUDIO_CLIP_BGM,
  AUDIO_CLIP_UI_TAP,
  CAPSULE_AVOID,
  GEAR_HIT_SIZE,
  HUD_BAND,
  PANEL_BUTTON_H,
  PANEL_IN_MS,
  PANEL_OUT_MS,
  POWERUP_BAND,
  PUZZLE_BAND,
  TOUCH_MIN,
  TRAY_BAND,
  TRAY_COLS,
  TRAY_GAP,
  TRAY_SLOT,
  gridLayoutFor,
} from '../src/config/tuning.js';
import type { BeadsGame } from '../src/game/beads-game.js';

const STEP = 1 / 60;

// ─────────────────────────────────────────────────────────────────── utilities

/** Centre of the gear hot zone in design space (S2 route 1). */
function gearPoint(): { x: number; y: number } {
  return {
    x: GEAR_HIT_SIZE / 2,
    y: (HUD_BAND.yMin + HUD_BAND.yMax) / 2,
  };
}

/** Centre of one panel button. */
function buttonPoint(id: PausePanelAction, mode: 'normal' | 'sprint' = 'normal'): {
  x: number;
  y: number;
} {
  const button = pausePanelLayout(mode).buttons.find((b) => b.id === id);
  if (!button) throw new Error(`panel: no button "${id}" in ${mode} layout`);
  return {
    x: (button.rect.xMin + button.rect.xMax) / 2,
    y: (button.rect.yMin + button.rect.yMax) / 2,
  };
}

/** Tap a design-space point through the real S2 priority router. */
function tap(game: BeadsGame, x: number, y: number): boolean {
  return game.tapDesign(x, y);
}

/** Gear tap → PAUSED (S9 §2.1). Asserts nothing; callers assert. */
function tapGear(game: BeadsGame): boolean {
  const p = gearPoint();
  return tap(game, p.x, p.y);
}

/**
 * Deliver a pointer sample *inside* a frame — `beginFrame()` clears one-shot
 * flags, so pushing before `advance()` would lose the tap. This is how the
 * "same frame as expiry" criterion has to be built.
 */
function tapInFrame(harness: Harness, x: number, y: number): void {
  const screen = { x: 0, y: 0 };
  harness.services.viewport.designToScreen(screen, x, y);
  harness.input.beginFrame();
  harness.input.push({ id: 1, x: screen.x, y: screen.y, phase: 'down', time: 0 });
  harness.game.update(STEP);
  harness.input.endFrame(STEP);
  // Release immediately so no later frame sees a held pointer.
  harness.input.beginFrame();
  harness.input.push({ id: 1, x: screen.x, y: screen.y, phase: 'up', time: 0 });
  harness.input.endFrame(STEP);
}

/** A board cell centre (§3.3 derivation) — inside the scrim once paused. */
function gridPoint(game: BeadsGame, row: number, col: number): { x: number; y: number } {
  const layout = gridLayoutFor(game.grid.cols, game.grid.rows);
  return { x: layout.colCenterX(col), y: layout.rowCenterY(row) };
}

/** A tray slot centre (§3.4 derivation). */
function trayPoint(slot: number): { x: number; y: number } {
  const pitch = TRAY_SLOT + TRAY_GAP;
  const rowWidth = TRAY_COLS * pitch - TRAY_GAP;
  const left = (750 - rowWidth) / 2;
  const col = slot % TRAY_COLS;
  return {
    x: left + TRAY_SLOT / 2 + pitch * col,
    y: (TRAY_BAND.yMin + TRAY_BAND.yMax) / 2,
  };
}

/** A powerup card centre (POWERUP_BAND structure reserve). */
function powerupPoint(): { x: number; y: number } {
  return { x: 195, y: (POWERUP_BAND.yMin + POWERUP_BAND.yMax) / 2 };
}

/** Fill the whole board through the public tap path (single level assumed). */
function fillBoard(game: BeadsGame): void {
  for (let row = 0; row < game.grid.rows; row++) {
    for (let col = 0; col < game.grid.cols; col++) {
      if (!game.grid.isFillable(row, col)) continue;
      if (!placeColor(game, game.grid.requiredColor(row, col), row, col)) {
        throw new Error(`fillBoard: rejected at (${row},${col})`);
      }
      if (game.phase !== 'playing') return; // cleared already — stop playing
    }
  }
}

describe('S9 pause & settings', () => {
  afterEach(() => vi.restoreAllMocks());

  // §8.1 PLAYING 点齿轮 → game:paused 恰 1 次、PAUSED、面板可见、遮罩覆盖棋盘与
  // 托盘；PAUSED 中点击遮罩/棋盘/托盘/道具卡全部零响应。
  it('§8-1 gear pauses once; every non-button tap while PAUSED has zero response', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s9c1' });
    const game = harness.game;
    expect(game.phase).toBe('playing');

    expect(tapGear(game)).toBe(true);
    expect(game.phase).toBe('paused');
    expect(harness.count('game:paused')).toBe(1);
    expect(game.panel.visible).toBe(true);
    expect(game.panel.interactive).toBe(true);

    // Nothing may react while the panel owns the screen.
    const eventsBefore = harness.emitted.length;
    const cell = gridPoint(game, 0, 0);
    const tray = trayPoint(0);
    const card = powerupPoint();
    // A point squarely between two buttons — i.e. the scrim itself.
    const scrimPoint = { x: 375, y: 907 - 40 };

    // The scrim really does cover the board **and** the tray (§2.2).
    const builder = new RenderModelBuilder(750, 1334);
    builder.begin();
    game.buildRenderModel(builder);
    const commands = builder.end().commands;
    const rects = commands.filter((c): c is RectCommand => c.kind === 'rect');
    const scrim = rects.find((r) => r.fill?.includes('rgba(42,46,67'));
    expect(scrim).toBeDefined();
    const coversBand = (yMin: number, yMax: number): boolean =>
      scrim!.y <= yMin && scrim!.y + scrim!.h >= yMax && scrim!.x <= 0 && scrim!.w >= 750;
    expect(coversBand(PUZZLE_BAND.yMin, PUZZLE_BAND.yMax)).toBe(true); // board
    expect(coversBand(TRAY_BAND.yMin, TRAY_BAND.yMax)).toBe(true); // tray
    // And the dialog itself, with every §2.2 control labelled.
    const labels = commands
      .filter((c): c is TextCommand => c.kind === 'text')
      .map((t) => t.text);
    expect(labels).toContain('暂停');
    expect(labels).toContain('继续');
    expect(labels).toContain('重玩本关');
    expect(labels.some((t) => t.startsWith('音乐'))).toBe(true);
    expect(labels.some((t) => t.startsWith('音效'))).toBe(true);
    expect(labels.some((t) => t.includes('去冲刺'))).toBe(true);
    // WXG-T-088：行3 可访问性开关与去冲刺同格共存。
    expect(labels.some((t) => t.startsWith('减弱动效'))).toBe(true);
    expect(labels.some((t) => t.startsWith('大字号'))).toBe(true);

    expect(tap(game, cell.x, cell.y)).toBe(false);
    expect(tap(game, tray.x, tray.y)).toBe(false);
    expect(tap(game, card.x, card.y)).toBe(false);
    expect(tap(game, scrimPoint.x, scrimPoint.y)).toBe(false);
    expect(tapGear(game)).toBe(false); // gear is behind the scrim too

    expect(harness.emitted.length).toBe(eventsBefore);
    expect(game.phase).toBe('paused');
    expect(harness.count('game:paused')).toBe(1);
    expect(harness.count('tray:selected')).toBe(0);
    expect(harness.count('bead:placed')).toBe(0);
    expect(harness.count('bead:rejected')).toBe(0);
  });

  // §8.2 PAUSED 300s 后继续 → remaining 与暂停前一致（≤1 帧 dt），首个供料不早于
  // "暂停剩余间隔 +1 帧"。
  it('§8-2 resume after 300 s keeps remaining and resumes the feed rhythm', () => {
    const harness = createBeadsHarness({
      levels: [simpleTestLevel({ spawnInterval: 4.0 })],
      saveKey: 'wxgame.beads.test.s9c2',
    });
    const game = harness.game;

    // Run until the first feed lands, so the spawner accumulator is ~0.
    let guard = 0;
    while (harness.count('tray:spawned') === 0 && game.phase === 'playing') {
      harness.advance(STEP);
      if (++guard > 600) throw new Error('no first feed');
    }
    const beforePause = game.remaining;
    tapGear(game);
    expect(game.phase).toBe('paused');

    harness.advance(300); // 5 minutes in the background
    expect(game.remaining).toBeCloseTo(beforePause, 10);

    const p = buttonPoint('resume');
    expect(tap(game, p.x, p.y)).toBe(true);
    expect(game.phase).toBe('playing');
    expect(harness.count('game:resumed')).toBe(1);
    // ≤1 frame of dt may be consumed by the resume frame itself.
    expect(game.remaining).toBeLessThanOrEqual(beforePause + STEP + 1e-9);
    expect(game.remaining).toBeGreaterThan(beforePause - STEP - 1e-9);

    // The feed rhythm resumes from the paused accumulator, not from zero: with
    // a 4.0 s interval the next bead needs ≥ (4.0 s − 1 frame) of steps.
    const spawnedBefore = harness.count('tray:spawned');
    let steps = 0;
    while (harness.count('tray:spawned') === spawnedBefore && game.phase === 'playing') {
      harness.advance(STEP);
      if (++steps > 600) throw new Error('feed never resumed');
    }
    expect(steps + 1).toBeGreaterThanOrEqual(4.0 / STEP - 1);
  });

  // §8.3 「重玩本关」→ 五项重置逐一断言，S1 直接回 PLAYING，无 GAME_OVER 中转。
  it('§8-3 restart applies every §3.5 reset item and returns straight to PLAYING', () => {
    const lockedLevel = simpleTestLevel({
      pattern: ['x12312', '123123', '123123', '123123', '123123'],
    });
    const harness = createBeadsHarness({
      levels: [lockedLevel],
      saveKey: 'wxgame.beads.test.s9c3',
    });
    const game = harness.game;

    // Dirty everything the five-item reset is supposed to clean.
    placeColor(game, game.grid.requiredColor(1, 1), 1, 1);
    harness.advance(12); // burn countdown
    expect(game.expandTray()).toBe(true);
    expect(game.tray.expanded).toBe(true);
    expect(game.tray.capacity).toBe(24);
    expect(game.grid.filledCount).toBe(1);
    expect(game.remaining).toBeLessThan(300);

    tapGear(game);
    const p = buttonPoint('restart');
    expect(tap(game, p.x, p.y)).toBe(true);

    // 1. countdown full · 2. pattern cleared …
    expect(game.phase).toBe('playing');
    expect(harness.count('level:failed')).toBe(0);
    expect(game.remaining).toBe(300);
    expect(game.grid.filledCount).toBe(0);
    // … but `locked` never moves (§3.5 item 2 wording).
    expect(game.grid.cell(0, 0)!.state).toBe('locked');
    expect(game.grid.cell(0, 0)!.void).toBe(false);
    // 3. tray cleared · 4. expansion reverted
    expect(game.tray.holdingCount).toBe(0);
    expect(game.tray.expanded).toBe(false);
    expect(game.tray.capacity).toBe(12);
    // 5. powerup free uses — no powerup state exists in this slice (S6 out of
    //    scope), so the item is vacuous here; see the lead report.
    expect(harness.count('powerup:used')).toBe(0);
  });

  // §8.4 音乐/音效开关各切 2 次：settings.* 即档、重启回显一致、BGM 与 SFX 互不影响。
  it('§8-4 both toggles persist, re-load identically and never leak into each other', () => {
    const saveKey = 'wxgame.beads.test.s9c4';
    const harness = createBeadsHarness({ saveKey });
    const game = harness.game;

    // Both channels start ON (save-progress §2.2 default false = not muted).
    expect(game.bgmMuted).toBe(false);
    expect(game.sfxMuted).toBe(false);
    harness.services.audio.flush(STEP);
    expect(harness.audio.played).toContain(AUDIO_CLIP_BGM);

    const readSettings = (): { bgmMuted: boolean; sfxMuted: boolean } => {
      const raw = harness.storage.get(saveKey);
      expect(raw).toBeTruthy();
      return JSON.parse(raw as string).settings as {
        bgmMuted: boolean;
        sfxMuted: boolean;
      };
    };

    tapGear(game);
    expect(game.phase).toBe('paused');

    // BGМ: OFF → written immediately **and** the looping clip is stopped.
    const bgm = buttonPoint('toggle-bgm');
    const stopSpy = vi.spyOn(harness.services.audio, 'stop');
    let p = bgm;
    expect(tap(game, p.x, p.y)).toBe(true);
    expect(game.bgmMuted).toBe(true);
    expect(readSettings().bgmMuted).toBe(true);
    expect(stopSpy).toHaveBeenCalledWith(AUDIO_CLIP_BGM);

    // sfx still reaches the backend while music is muted.
    harness.services.audio.flush(STEP); // flush the tap's own sfx request
    expect(harness.audio.played).toContain(AUDIO_CLIP_UI_TAP);

    // Second toggle → music back ON.
    p = bgm;
    expect(tap(game, p.x, p.y)).toBe(true);
    expect(game.bgmMuted).toBe(false);
    expect(readSettings().bgmMuted).toBe(false);
    stopSpy.mockRestore();

    // SFX: OFF → one more toggle → ON; each write lands in the document.
    const sfx = buttonPoint('toggle-sfx');
    p = sfx;
    expect(tap(game, p.x, p.y)).toBe(true);
    expect(game.sfxMuted).toBe(true);
    expect(readSettings().sfxMuted).toBe(true);
    p = sfx;
    expect(tap(game, p.x, p.y)).toBe(true);
    expect(game.sfxMuted).toBe(false);
    expect(readSettings().sfxMuted).toBe(false);

    // Independence, both directions: a muted sfx channel queues nothing while
    // the bgm channel keeps its own state (and vice versa).
    p = sfx;
    expect(tap(game, p.x, p.y)).toBe(true); // sfx OFF (bgm still ON)
    expect(game.bgmMuted).toBe(false);
    harness.services.audio.flush(STEP);
    expect(harness.services.audio.pendingCount).toBe(0); // nothing new queued
    p = bgm;
    expect(tap(game, p.x, p.y)).toBe(true); // now mute bgm too
    expect(game.bgmMuted).toBe(true);
    expect(game.sfxMuted).toBe(true);
    expect(readSettings()).toEqual({
      bgmMuted: true,
      sfxMuted: true,
      reduceMotion: false,
      largeText: false,
    });

    // Relaunch on the same storage → both toggles echo back.
    const rebooted = createBeadsHarness({ saveKey, storage: harness.storage });
    expect(rebooted.game.bgmMuted).toBe(true);
    expect(rebooted.game.sfxMuted).toBe(true);
    expect(rebooted.game.snapshot.bgmMuted).toBe(true);
    expect(rebooted.game.snapshot.sfxMuted).toBe(true);
    // A missing `settings` key degrades per field, never drops the document.
    expect(rebooted.game.phase).toBe('playing');
  });

  // §8.5 齿轮热区 ≥88×88 且不侵入 CAPSULE_AVOID；面板任何元素不与胶囊重叠。
  it('§8-5 gear and panel geometry respect TOUCH_MIN and the capsule-avoid zone', () => {
    const gear = {
      xMin: 0,
      yMin: HUD_BAND.yMin,
      xMax: GEAR_HIT_SIZE,
      yMax: HUD_BAND.yMax,
    };
    expect(gear.xMax - gear.xMin).toBeGreaterThanOrEqual(TOUCH_MIN);
    expect(gear.yMax - gear.yMin).toBeGreaterThanOrEqual(TOUCH_MIN);
    expect(rectsOverlap(gear, CAPSULE_AVOID)).toBe(false);

    for (const mode of ['normal', 'sprint'] as const) {
      const layout = pausePanelLayout(mode);
      expect(rectsOverlap(layout.panel, CAPSULE_AVOID)).toBe(false);
      expect(layout.panel.xMax - layout.panel.xMin).toBe(560);
      expect(layout.panel.yMax - layout.panel.yMin).toBe(480);
      for (const button of layout.buttons) {
        expect(rectsOverlap(button.rect, CAPSULE_AVOID)).toBe(false);
        expect(button.rect.xMax - button.rect.xMin).toBeGreaterThanOrEqual(TOUCH_MIN);
        expect(button.rect.yMax - button.rect.yMin).toBeGreaterThanOrEqual(PANEL_BUTTON_H);
        // Buttons live inside the plate.
        expect(button.rect.xMin).toBeGreaterThanOrEqual(layout.panel.xMin);
        expect(button.rect.xMax).toBeLessThanOrEqual(layout.panel.xMax);
        expect(button.rect.yMin).toBeGreaterThanOrEqual(layout.panel.yMin);
        expect(button.rect.yMax).toBeLessThanOrEqual(layout.panel.yMax);
      }
    }
    // Sprint swaps the restart label; the redundant sprint entry disappears.
    expect(pausePanelLayout('sprint').buttons.some((b) => b.id === 'start-sprint')).toBe(false);
    expect(pausePanelLayout('normal').buttons.some((b) => b.id === 'start-sprint')).toBe(true);
    // WXG-T-088：两个可访问性开关行3 常驻（两模式均保留，仅去冲刺位退场）。
    for (const mode of ['normal', 'sprint'] as const) {
      const ids = pausePanelLayout(mode).buttons.map((b) => b.id);
      expect(ids).toContain('toggle-reduce-motion');
      expect(ids).toContain('toggle-large-text');
    }
  });

  // §8.6 归零 vs 齿轮同帧两组用例。
  it('§8-6 expiry vs gear: later arrival loses; earlier arrival freezes', () => {
    // Group ① — expiry arrives first (already GAME_OVER): no pause at all.
    const failed = createBeadsHarness({ saveKey: 'wxgame.beads.test.s9c6a' });
    while (failed.game.phase === 'playing') failed.advance(0.5);
    expect(failed.game.phase).toBe('game-over');
    const before = failed.emitted.length;
    expect(tapGear(failed.game)).toBe(false);
    expect(failed.game.phase).toBe('game-over');
    expect(failed.count('game:paused')).toBe(0);
    expect(failed.emitted.length).toBe(before);

    // Group ② — gear arrives in the same frame the countdown would hit zero:
    // the freeze wins, no failure is judged while PAUSED.
    const same = createBeadsHarness({ saveKey: 'wxgame.beads.test.s9c6b' });
    // Stop with ≤1 frame of countdown left: this frame's tick *would* expire.
    while (same.game.remaining > STEP && same.game.phase === 'playing') {
      same.advance(STEP);
    }
    expect(same.game.phase).toBe('playing');
    expect(same.game.remaining).toBeGreaterThan(0);
    expect(same.game.remaining).toBeLessThanOrEqual(STEP + 1e-9);
    const p = gearPoint();
    tapInFrame(same, p.x, p.y);
    expect(same.game.phase).toBe('paused');
    expect(same.count('game:paused')).toBe(1);
    expect(same.count('level:failed')).toBe(0);
    // Still not judged after idling far past the would-be expiry.
    same.advance(2);
    expect(same.game.phase).toBe('paused');
    expect(same.count('level:failed')).toBe(0);
    expect(same.game.remaining).toBeGreaterThan(0);

    // Resuming lets the countdown finish → GAME_OVER.
    const resume = buttonPoint('resume');
    tap(same.game, resume.x, resume.y);
    expect(same.game.phase).toBe('playing');
    same.advance(STEP * 2);
    expect(same.game.phase).toBe('game-over');
    expect(same.count('level:failed')).toBe(1);
  });

  // §8.7 非 PLAYING 五状态注入齿轮请求 → 零事件零状态变化。
  it('§8-7 a gear request outside PLAYING changes nothing in any of the five phases', () => {
    const phases: { name: string; harness: Harness }[] = [];

    // BOOT — invalid level data refuses PLAYING (core-loop §2.1).
    const boot = createBeadsHarness({
      levels: [simpleTestLevel({ pattern: ['ZZZZZZ', '123123', '123123', '123123', '123123'] })],
      saveKey: 'wxgame.beads.test.s9c7boot',
    });
    phases.push({ name: 'boot', harness: boot });

    // LEVEL_CLEAR — complete the board of a single-level campaign.
    const cleared = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s9c7clear',
    });
    fillBoard(cleared.game);
    phases.push({ name: 'level-clear', harness: cleared });

    // GAME_OVER — countdown to zero.
    const over = createBeadsHarness({ saveKey: 'wxgame.beads.test.s9c7over' });
    while (over.game.phase === 'playing') over.advance(0.5);
    phases.push({ name: 'game-over', harness: over });

    // FINISH — 结算面板主钮（末关文案「查看结果」）把 LEVEL_CLEAR 推进到 FINISH。
    // WXG-T-063：LEVEL_CLEAR **不再自动推进**（ux-spec §4 流转表：等按钮）。
    const finished = createBeadsHarness({
      levels: [simpleTestLevel()],
      saveKey: 'wxgame.beads.test.s9c7finish',
    });
    fillBoard(finished.game);
    expect(finished.game.phase).toBe('level-clear');
    const clearPrimary = clearPanelLayout({ lastLevel: true }).buttons[0]!.rect;
    tap(
      finished.game,
      (clearPrimary.xMin + clearPrimary.xMax) / 2,
      (clearPrimary.yMin + clearPrimary.yMax) / 2,
    );
    phases.push({ name: 'finish', harness: finished });

    // PAUSED — injected while already paused.
    const paused = createBeadsHarness({ saveKey: 'wxgame.beads.test.s9c7paused' });
    tapGear(paused.game);
    phases.push({ name: 'paused', harness: paused });

    for (const { name, harness } of phases) {
      expect(harness.game.phase, name).toBe(name);
      const before = harness.emitted.length;
      const accepted = tapGear(harness.game);
      expect(accepted, name).toBe(false);
      expect(harness.emitted.length, name).toBe(before);
      expect(harness.game.phase, name).toBe(name);
    }
  });

  // §8.8 重复暂停幂等：PAUSED 中注入 game:paused → S5 保存值不变。
  it('§8-8 repeated pause is idempotent and never touches the stored countdown', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s9c8' });
    const game = harness.game;
    harness.advance(3);
    const before = game.remaining;

    tapGear(game);
    expect(game.phase).toBe('paused');
    expect(harness.count('game:paused')).toBe(1);

    tapGear(game); // gear is behind the scrim → still one notification
    harness.events.emit('game:paused', {} as never); // notification only, no consumer
    expect(harness.count('game:paused')).toBe(2); // counting the *injected* one
    expect(game.phase).toBe('paused');
    expect(game.remaining).toBeCloseTo(before, 10);

    const resume = buttonPoint('resume');
    tap(game, resume.x, resume.y);
    expect(game.phase).toBe('playing');
    expect(game.remaining).toBeLessThanOrEqual(before);
    expect(game.remaining).toBeGreaterThan(before - 0.05);
  });

  // §8.9 sprint 模式暂停：连击窗口计时冻结，恢复后从暂停值续算、不追溯断连。
  it('§8-9 the sprint combo window freezes while PAUSED and never back-breaks', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s9c9' });
    const game = harness.game;
    game.startSprint();
    expect(game.phase).toBe('playing');

    // Build a live streak on the first two *fillable* cells (the generated
    // stage patterns contain `.` voids, which have no required colour).
    let placed = 0;
    for (let row = 0; row < game.grid.rows && placed < 2; row++) {
      for (let col = 0; col < game.grid.cols && placed < 2; col++) {
        if (!game.grid.isFillable(row, col)) continue;
        if (placeColor(game, game.grid.requiredColor(row, col), row, col)) placed++;
      }
    }
    expect(placed).toBe(2);
    expect(game.sprintTracker.streak).toBe(2);
    harness.advance(4); // 5.0 s window → ≈1.0 s left
    const windowLeft = game.sprintTracker.windowRemaining;
    expect(windowLeft).toBeGreaterThan(0);
    expect(windowLeft).toBeLessThan(2);
    expect(harness.count('combo:break')).toBe(0);

    tapGear(game);
    expect(game.phase).toBe('paused');
    harness.advance(300); // ages far past the window — nothing may break
    expect(harness.count('combo:break')).toBe(0);
    expect(game.sprintTracker.streak).toBe(2);
    expect(game.sprintTracker.windowRemaining).toBeCloseTo(windowLeft, 10);

    const resume = buttonPoint('resume', 'sprint');
    tap(game, resume.x, resume.y);
    expect(game.phase).toBe('playing');
    // Continues from the paused value — not from a fresh 5 s, not broken.
    expect(game.sprintTracker.windowRemaining).toBeGreaterThan(windowLeft - STEP - 1e-9);
    expect(game.sprintTracker.windowRemaining).toBeLessThanOrEqual(windowLeft + 1e-9);
    harness.advance(Math.max(0, game.sprintTracker.windowRemaining - 0.02));
    expect(harness.count('combo:break')).toBe(0);
    harness.advance(0.1);
    expect(harness.count('combo:break')).toBe(1);
    expect(game.sprintTracker.streak).toBe(0);
  });

  // §8.10 面板出场 ≤ 入 200ms / 出 150ms 量级，全程无 >3Hz 闪烁。
  it('§8-10 panel ramps once within its 200/150 ms budget — no flicker possible', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.s9c10' });
    const game = harness.game;
    tapGear(game);
    expect(game.panel.progress).toBe(0);

    // Enter: monotonic ramp, fully open within PANEL_IN_MS.
    let previous = game.panel.progress;
    const seen: number[] = [previous];
    for (let i = 0; i < Math.ceil(PANEL_IN_MS / 1000 / STEP) + 2; i++) {
      harness.advance(STEP);
      const now = game.panel.progress;
      expect(now).toBeGreaterThanOrEqual(previous - 1e-9); // never oscillates
      seen.push(now);
      previous = now;
    }
    expect(seen.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(previous).toBe(1);
    expect(seen[seen.length - 2]!).toBeLessThanOrEqual(1);

    const resume = buttonPoint('resume');
    tap(game, resume.x, resume.y);
    expect(game.phase).toBe('playing');
    expect(game.panel.interactive).toBe(false); // already ignoring taps
    expect(game.panel.durationMs).toBe(PANEL_OUT_MS);

    // Exit: monotonic decay; completely hidden by PANEL_OUT_MS.
    previous = game.panel.progress;
    let hiddenAfter = 0;
    for (let i = 0; i < Math.ceil(PANEL_OUT_MS / 1000 / STEP) + 4; i++) {
      harness.advance(STEP);
      const now = game.panel.progress;
      expect(now).toBeLessThanOrEqual(previous + 1e-9);
      previous = now;
      hiddenAfter++;
      if (!game.panel.visible) break;
    }
    expect(game.panel.visible).toBe(false);
    expect(hiddenAfter).toBeLessThanOrEqual(Math.ceil(PANEL_OUT_MS / 1000 / STEP) + 4);

    // The whole lifecycle stayed inside the frozen budget (ux-spec §5).
    expect(PANEL_IN_MS).toBeLessThanOrEqual(200);
    expect(PANEL_OUT_MS).toBeLessThanOrEqual(150);
  });

  // §8.11 WXG-T-088：D1/E2 开关各自持久化、重启回显、与音频通道互不影响。
  it('§8-11 accessibility toggles persist, echo on reboot and stay independent of audio', () => {
    const saveKey = 'wxgame.beads.test.s9c11';
    const harness = createBeadsHarness({ saveKey });
    const game = harness.game;
    expect(game.reduceMotion).toBe(false);
    expect(game.largeText).toBe(false);

    tapGear(game);
    expect(game.phase).toBe('paused');

    // D1 减弱动效：切 ON 即写档、snapshot 同步回显。
    const rm = buttonPoint('toggle-reduce-motion');
    expect(tap(game, rm.x, rm.y)).toBe(true);
    expect(game.reduceMotion).toBe(true);
    expect(game.snapshot.reduceMotion).toBe(true);
    // 不切相位——面板仍 PAUSED（与音频开关同纪律）。
    expect(game.phase).toBe('paused');

    // E2 大字号：再切一档。
    const lt = buttonPoint('toggle-large-text');
    expect(tap(game, lt.x, lt.y)).toBe(true);
    expect(game.largeText).toBe(true);

    const raw = harness.storage.get(saveKey);
    expect(JSON.parse(raw as string).settings).toMatchObject({
      reduceMotion: true,
      largeText: true,
      bgmMuted: false,
      sfxMuted: false,
    });

    // 同存储重启 → 两开关回显，音频通道不受波及。
    const rebooted = createBeadsHarness({ saveKey, storage: harness.storage });
    expect(rebooted.game.reduceMotion).toBe(true);
    expect(rebooted.game.largeText).toBe(true);
    expect(rebooted.game.snapshot.reduceMotion).toBe(true);
    expect(rebooted.game.bgmMuted).toBe(false);
    expect(rebooted.game.sfxMuted).toBe(false);
  });

  // ── WXG-T-055 D-04: WeChat onShow must not leave PAUSED ──────────────
  // pause-settings §6: 面板按钮是唯一出口. App.onShow still calls
  // loop.reset() + game.onResume(); only the latter's state-machine
  // behaviour changes (framework wiring stays).

  it('D-04 manual pause then onPause+onResume stays PAUSED', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.d04-manual' });
    const game = harness.game;
    harness.advance(2);
    const remaining = game.remaining;

    expect(tapGear(game)).toBe(true);
    expect(game.phase).toBe('paused');
    expect(game.pauseIntent).toBe('manual');
    expect(harness.count('game:paused')).toBe(1);
    expect(game.panel.visible).toBe(true);

    // Hide while already on the panel — no re-enter, intent stays manual.
    game.onPause();
    expect(game.phase).toBe('paused');
    expect(game.pauseIntent).toBe('manual');
    expect(harness.count('game:paused')).toBe(1);

    game.onResume();
    expect(game.phase).toBe('paused');
    expect(game.pauseIntent).toBe('manual');
    expect(harness.count('game:resumed')).toBe(0);

    harness.advance(8);
    expect(game.remaining).toBeCloseTo(remaining, 10);
    expect(game.phase).toBe('paused');

    const p = buttonPoint('resume');
    expect(tap(game, p.x, p.y)).toBe(true);
    expect(game.phase).toBe('playing');
    expect(game.pauseIntent).toBeNull();
    expect(harness.count('game:resumed')).toBe(1);
  });

  it('D-04 PLAYING onPause enters PAUSED and onResume stays PAUSED', () => {
    const harness = createBeadsHarness({ saveKey: 'wxgame.beads.test.d04-system' });
    const game = harness.game;
    expect(game.phase).toBe('playing');
    expect(game.pauseIntent).toBeNull();
    harness.advance(3);
    const remaining = game.remaining;

    game.onPause();
    expect(game.phase).toBe('paused');
    expect(game.pauseIntent).toBe('system');
    expect(harness.count('game:paused')).toBe(1);
    expect(game.panel.visible).toBe(true);
    expect(game.panel.interactive).toBe(true);
    const ticksAtPause = harness.count('timer:tick');

    game.onResume();
    expect(game.phase).toBe('paused');
    expect(game.pauseIntent).toBe('system');
    expect(harness.count('game:resumed')).toBe(0);

    harness.advance(12);
    expect(game.remaining).toBeCloseTo(remaining, 10);
    expect(harness.count('timer:tick')).toBe(ticksAtPause);

    const p = buttonPoint('resume');
    expect(tap(game, p.x, p.y)).toBe(true);
    expect(game.phase).toBe('playing');
    expect(game.pauseIntent).toBeNull();
    expect(harness.count('game:resumed')).toBe(1);
  });
});
