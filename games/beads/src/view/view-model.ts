/**
 * Beads view model — snapshot → draw commands.
 *
 * The ONLY place that knows how Beads looks. Pure function of the snapshot:
 * same snapshot in, same commands out (control-manifest §8; never mutates the
 * game). Layout bands/geometry come from `config/tuning.ts` (§3.1/§3.3/§3.4).
 *
 * The bead itself — the six-layer parameter card and the 10-symbol channel —
 * lives in `view/bead-render.ts` + `view/symbols.ts` (architecture §3). This file
 * owns the *screen*: layout bands, HUD, tray chrome, pause panel, fail overlay and banners.
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import {
  BEAD_CELL,
  BEAD_PITCH,
  DESIGN_H,
  DESIGN_W,
  HUD_BAND,
  PANEL_SCALE_FROM,
  PANEL_SCRIM_ALPHA,
  PANEL_SCRIM_RGB,
  POWERUP_BADGE_GLYPH_EDGE,
  POWERUP_BADGE_INSET,
  POWERUP_BADGE_RADIUS,
  POWERUP_BADGE_SIZE,
  CLEAR_STAR_SIZE,
  PANEL_PADDING,
  POWERUP_CARD_RADIUS,
  FINISH_ROW_H,
  FINISH_ROW_W,
  FINISH_STAR_SIZE,
  POWERUP_TYPES,
  powerupCardRects,
  powerupLabelY,
  TRAY_BAND,
  TRAY_COLS,
  TRAY_GAP,
  TRAY_SLOT,
  WRONG_SHAKE_PX,
  HINT_PULSE_MS,
  DANGER_PULSE_MS,
} from '../config/tuning.js';
import type { BeadsSnapshot } from '../game/state.js';
import { pausePanelLayout, type PanelButton } from '../systems/pause-panel.js';
import { failPanelLabel, failPanelLayout } from '../systems/fail-panel.js';
import {
  SELECTED_SHADOW_ALPHA,
  TRAY_BEAD_SIZE,
  drawEmptySocket,
  drawFilledBead,
  drawLockedBead,
  drawStateRing,
} from './bead-render.js';
import {
  BEAD_SHADOW_HEX,
  POWERUP_BADGE_GLYPH,
  POWERUP_INK_CAP,
  POWERUP_INK_MAGNET,
  POWERUP_INK_STAR,
  POWERUP_INK_STRAW,
  POWERUP_INK_WAND,
  POWERUP_SHADOW_ALPHA,
  withAlpha,
  type BeadsPalette,
} from './palette.js';
import { POWERUP_LABELS } from '../systems/powerups.js';
import { CLEAR_PANEL_TITLE, clearPanelLabel, clearPanelLayout } from '../systems/clear-panel.js';
import {
  FINISH_MAX_STARS_PER_LEVEL,
  FINISH_PANEL_TITLE,
  finishPanelLabel,
  finishPanelLayout,
} from '../systems/finish-panel.js';
import {
  SPRINT_SETTLE_NEW_BEST,
  SPRINT_SETTLE_TITLE,
  sprintSettleLabel,
  sprintSettleLayout,
  sprintSettleRows,
} from '../systems/sprint-settle.js';
import { comboBurst, comboParticleOffsets } from './combo-vfx.js';

const FONT = {
  timer: 'bold 44px sans-serif',
  hud: 'bold 30px sans-serif',
  hudSmall: '22px sans-serif',
  banner: 'bold 62px sans-serif',
  sub: '28px sans-serif',
  panelTitle: 'bold 40px sans-serif',
  panelButton: 'bold 30px sans-serif',
  /** Row-3 accessibility toggles: longer copy, so a smaller secondary face (§3.3). */
  panelToggle: '22px sans-serif',
} as const;

/**
 * E2 大字号（accessibility §5 基础版）：仅放大正文 / 说明类文本（×1.25，对齐
 * 文档 32→40 比例）。数字 / 标题 / 按钮字号不随开关变化（弹窗排版重排延后 v1.1）。
 */
function bodyFont(snap: BeadsSnapshot, name: 'sub' | 'hudSmall'): string {
  if (!snap.largeText) return FONT[name];
  return name === 'sub' ? '35px sans-serif' : '27px sans-serif';
}

/** Panel button copy — sprint swaps one label (pause-settings §2.2, P1). */
function panelLabel(button: PanelButton, snap: BeadsSnapshot): string {
  switch (button.id) {
    case 'resume':
      return '继续';
    case 'restart':
      return snap.mode === 'sprint' ? '重新冲刺' : '重玩本关';
    case 'toggle-bgm':
      return `音乐  ${snap.bgmMuted ? '关' : '开'}`;
    case 'toggle-sfx':
      return `音效  ${snap.sfxMuted ? '关' : '开'}`;
    case 'toggle-reduce-motion':
      return `减弱动效  ${snap.reduceMotion ? '开' : '关'}`;
    case 'toggle-large-text':
      return `大字号  ${snap.largeText ? '开' : '关'}`;
    case 'start-sprint':
      return '▶ 去冲刺';
    default:
      return '';
  }
}

/** Render one frame of Beads. Read-only over the snapshot by construction. */
export function buildBeadsView(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  builder.setBackground(palette.background);
  drawHud(builder, snap, palette);
  drawGrid(builder, snap, palette);
  drawTray(builder, snap, palette);
  drawPowerupBand(builder, snap, palette);
  drawComboVfx(builder, snap, palette);
  drawClearPanel(builder, snap, palette);
  drawFinishPanel(builder, snap, palette);
  drawPausePanel(builder, snap, palette);
  drawFailPanel(builder, snap, palette);
  drawSprintSettle(builder, snap, palette);
  drawBanners(builder, snap, palette);
}

// ───────────────────────────────────────────────── S9 pause panel (ux-spec §3.3)

/**
 * Scrim + dialog, drawn last but before banners so an overlaid banner (e.g. the
 * PAUSED caption) still reads above it. Read-only: everything comes from the
 * snapshot and the static `pausePanelLayout()` used by the router too.
 *
 * Animation: scrim alpha and plate scale ramp monotonically with
 * `snap.panelProgress` for `PANEL_IN_MS` ms in / `PANEL_OUT_MS` ms out
 * (ux-spec §5) — a single ramp per direction, so nothing can exceed the
 * ≤3 Hz flicker red line.
 */
function drawPausePanel(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  if (!snap.panelVisible) return;
  const t = Math.max(0, Math.min(1, snap.panelProgress));
  const layout = pausePanelLayout(snap.mode);

  // Scrim covers the whole canvas — therefore always the board *and* the tray
  // (pause-settings §2.2: 防误触 + 防偷看).
  builder.rect(0, 0, DESIGN_W, DESIGN_H, {
    fill: `rgba(${PANEL_SCRIM_RGB.r},${PANEL_SCRIM_RGB.g},${PANEL_SCRIM_RGB.b},${PANEL_SCRIM_ALPHA * t})`,
  });

  // Plate: scale 0.9→1.0 about its centre (ux-spec §5).
  const plate = layout.panel;
  const cx = (plate.xMin + plate.xMax) / 2;
  const cy = (plate.yMin + plate.yMax) / 2;
  const scale = PANEL_SCALE_FROM + (1 - PANEL_SCALE_FROM) * t;
  const w = (plate.xMax - plate.xMin) * scale;
  const h = (plate.yMax - plate.yMin) * scale;
  const left = cx - w / 2;
  const bottom = cy - h / 2;
  builder.rect(left, bottom, w, h, { fill: palette.panel, radius: 24 });

  builder.text(cx, layout.titleY, '暂停', {
    fill: palette.text,
    font: FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });

  for (const button of layout.buttons) {
    const bw = (button.rect.xMax - button.rect.xMin) * scale;
    const bh = (button.rect.yMax - button.rect.yMin) * scale;
    const bx = cx + (button.rect.xMin - cx) * scale;
    const by = cy + (button.rect.yMin - cy) * scale;
    const primary = button.id === 'resume';
    // Row-3 accessibility toggles carry longer copy than the 160px cell can hold
    // at the standard button face — a smaller secondary style keeps it inside
    // the plate without touching the frozen panel geometry (§8-5).
    const toggle =
      button.id === 'toggle-reduce-motion' || button.id === 'toggle-large-text';
    builder.rect(bx, by, bw, bh, {
      fill: primary ? palette.textAccent : palette.slot,
      stroke: primary ? palette.textAccent : palette.slotBorder,
      lineWidth: 2,
      radius: 14,
    });
    builder.text(bx + bw / 2, by + bh / 2, panelLabel(button, snap), {
      fill: primary ? palette.panel : palette.text,
      font: toggle ? FONT.panelToggle : FONT.panelButton,
      align: 'center',
      baseline: 'middle',
    });
  }
}

function usesFailOverlay(snap: BeadsSnapshot): boolean {
  return snap.phase === 'game-over' && snap.mode === 'normal';
}

// ─────────────────────────────────────── sprint settle (ux-spec §3.5 左列)

/**
 * 冲刺结算面板（`GAME_OVER` · 冲刺态）：三行内容（单局 / 最高梯位 / 最高连击）+ NEW BEST
 * 角标（`score-combo §8-11`：**仅破纪录时渲染**）+ 双钮。**不画续时主钮**（§3.5 明文：
 * 「冲刺归零：不出现续时主钮，只走左列冲刺结算」）。
 *
 * 几何取自 `sprintSettleLayout()`（与命中测试**同一真源**），文案取自 `sprintSettleRows()`
 * （纯函数）——视图不自持数据、不自持计时。
 */
function drawSprintSettle(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  if (!snap.sprintSettleVisible) return;
  const layout = sprintSettleLayout();
  const plate = layout.panel;

  builder.rect(0, 0, DESIGN_W, DESIGN_H, {
    fill: `rgba(${PANEL_SCRIM_RGB.r},${PANEL_SCRIM_RGB.g},${PANEL_SCRIM_RGB.b},${PANEL_SCRIM_ALPHA})`,
  });
  builder.rect(plate.xMin, plate.yMin, plate.xMax - plate.xMin, plate.yMax - plate.yMin, {
    fill: palette.panel,
    stroke: palette.slotBorder,
    lineWidth: 1,
    radius: 24,
  });

  builder.text(DESIGN_W / 2, layout.titleY, SPRINT_SETTLE_TITLE, {
    fill: palette.text,
    font: FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });
  if (snap.isNewBest) {
    const badge = layout.badge;
    builder.rect(badge.xMin, badge.yMin, badge.xMax - badge.xMin, badge.yMax - badge.yMin, {
      fill: palette.textAccent,
      radius: 8,
    });
    builder.text(
      (badge.xMin + badge.xMax) / 2,
      (badge.yMin + badge.yMax) / 2,
      SPRINT_SETTLE_NEW_BEST,
      { fill: palette.text, font: bodyFont(snap, 'hudSmall'), align: 'center', baseline: 'middle' },
    );
  }

  const values = sprintSettleRows({
    score: snap.score,
    bestStage: snap.sprintRunBestStage,
    bestStreak: snap.sprintRunBestStreak,
  });
  for (let i = 0; i < layout.rows.length; i++) {
    const row = layout.rows[i]!;
    if (row.label) {
      builder.text(row.labelX, row.y, row.label, {
        fill: palette.textDim,
        font: bodyFont(snap, 'sub'),
        align: 'center',
        baseline: 'middle',
      });
    }
    builder.text(row.valueX, row.y, values[i] ?? '', {
      fill: palette.text,
      font: bodyFont(snap, 'hudSmall'),
      align: 'center',
      baseline: 'middle',
    });
  }

  for (const button of layout.buttons) {
    const bw = button.rect.xMax - button.rect.xMin;
    const bh = button.rect.yMax - button.rect.yMin;
    const primary = button.id === 'again';
    builder.rect(button.rect.xMin, button.rect.yMin, bw, bh, {
      fill: primary ? palette.textAccent : palette.panel,
      stroke: primary ? palette.textAccent : palette.slotBorder,
      lineWidth: 1,
      radius: 20,
    });
    builder.text(
      button.rect.xMin + bw / 2,
      button.rect.yMin + bh / 2,
      sprintSettleLabel(button.id),
      {
        fill: primary ? palette.text : palette.textDim,
        font: FONT.panelButton,
        align: 'center',
        baseline: 'middle',
      },
    );
  }
}

// ───────────────────────────────────────────────── fail overlay (ux-spec §3.5)

function drawFailPanel(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  if (!usesFailOverlay(snap)) return;
  const layout = failPanelLayout(snap.reviveAvailable);

  builder.rect(0, 0, DESIGN_W, DESIGN_H, {
    fill: `rgba(${PANEL_SCRIM_RGB.r},${PANEL_SCRIM_RGB.g},${PANEL_SCRIM_RGB.b},${PANEL_SCRIM_ALPHA})`,
  });

  const plate = layout.panel;
  const cx = (plate.xMin + plate.xMax) / 2;
  builder.rect(plate.xMin, plate.yMin, plate.xMax - plate.xMin, plate.yMax - plate.yMin, {
    fill: palette.panel,
    radius: 24,
  });

  builder.text(cx, layout.titleY, '时间到', {
    fill: palette.text,
    font: FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });
  if (layout.subtitle) {
    builder.text(cx, layout.subtitleY, layout.subtitle, {
      fill: palette.textDim,
      font: bodyFont(snap, 'hudSmall'),
      align: 'center',
      baseline: 'middle',
    });
  }

  for (const button of layout.buttons) {
    const bw = button.rect.xMax - button.rect.xMin;
    const bh = button.rect.yMax - button.rect.yMin;
    const primary = button.id === 'revive';
    const dimmed = primary && snap.watchingAd;
    builder.rect(button.rect.xMin, button.rect.yMin, bw, bh, {
      fill: primary ? palette.textAccent : palette.slot,
      stroke: primary ? palette.textAccent : palette.slotBorder,
      lineWidth: 2,
      radius: 14,
    });
    builder.text(button.rect.xMin + bw / 2, button.rect.yMin + bh / 2, failPanelLabel(button.id), {
      fill: primary ? palette.panel : palette.text,
      font: FONT.panelButton,
      align: 'center',
      baseline: 'middle',
    });
    if (dimmed) {
      builder.rect(button.rect.xMin, button.rect.yMin, bw, bh, {
        fill: withAlpha(palette.panel, 0.35),
        radius: 14,
      });
    }
  }

  if (snap.failHint) {
    builder.text(cx, plate.yMin + 16, snap.failHint, {
      fill: palette.textDim,
      font: bodyFont(snap, 'hudSmall'),
      align: 'center',
      baseline: 'middle',
    });
  }
}

// ───────────────────────────────────────────────────────────────────── HUD

/**
 * 三角波呼吸：以 `clock` 为单调时基、`period` 为周期，在 `[lo, hi]` 间往返。
 * 相位起点不影响观感（连续循环），频率与幅度才是规格锁定项（hint 1.67Hz、告急 1Hz）。
 */
function breathe(clock: number, period: number, lo: number, hi: number): number {
  const p = (clock % period) / period; // 0..1
  const tri = p < 0.5 ? p * 2 : 2 - p * 2; // 0→1→0
  return lo + (hi - lo) * tri;
}

/** GAP-03/04 `hint` 呼吸 α：0.5↔1.0 @600ms；D1 减弱动效 → 静态描边（α=1）。 */
function hintAlpha(clock: number, reduce: boolean): number {
  return reduce ? 1 : breathe(clock, HINT_PULSE_MS, 0.5, 1);
}

/** GAP-10 告急 α 脉冲：0.6↔1.0 @1000ms；D1 减弱动效 → 静态红字（α=1）。 */
function dangerAlpha(clock: number, reduce: boolean): number {
  return reduce ? 1 : breathe(clock, DANGER_PULSE_MS, 0.6, 1);
}

function drawHud(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  const midY = (HUD_BAND.yMin + HUD_BAND.yMax) / 2;

  // GAP-10 倒计时告急三通道（§3.8「图标+颜色+脉冲」）：色已由 urgent→danger，
  // 此处补上时钟图标（平时湖蓝、告急切 danger）与告急时的 α 脉冲。
  const a = snap.urgent ? dangerAlpha(snap.pulseClock, snap.reduceMotion) : 1;
  const timerColor = snap.urgent ? palette.danger : palette.text;

  // Clock icon (left of the number): circle outline + two hands.
  const iconColor = snap.urgent ? palette.danger : palette.textDim;
  const icx = DESIGN_W / 2 - 96;
  const iconStroke = withAlpha(iconColor, a);
  builder.circle(icx, midY, 14, { stroke: iconStroke, lineWidth: 3 });
  builder.line(icx, midY, icx, midY + 8, iconStroke, 3); // 分针
  builder.line(icx, midY, icx + 6, midY, iconStroke, 3); // 时针

  builder.text(DESIGN_W / 2, midY, formatTime(snap.remaining), {
    fill: timerColor,
    font: FONT.timer,
    align: 'center',
    baseline: 'middle',
    alpha: a,
  });

  // Pause gear (left): a circle + notches; hit area handled by the game (S2).
  builder.circle(60, midY, 26, { fill: palette.panel, stroke: palette.textDim, lineWidth: 3 });
  builder.circle(60, midY, 8, { fill: palette.textDim });

  // Mode / stage label (small, dim, right-aligned before the capsule zone).
  const label =
    snap.mode === 'sprint' ? `STAGE ${snap.stageIndex + 1}` : `LV ${snap.levelIndex + 1}/${snap.levelCount}`;
  builder.text(DESIGN_W - 220, midY, label, {
    fill: palette.textDim,
    font: bodyFont(snap, 'hudSmall'),
    align: 'right',
    baseline: 'middle',
  });

  // Sprint-only HUD block: score + multiplier + combo (ux-spec §3: zero score
  // HUD in normal mode — D6 keeps the normal campaign scoreless).
  if (snap.mode === 'sprint') {
    builder.text(DESIGN_W - 220, midY + 44, `SCORE ${snap.score}`, {
      fill: palette.text,
      font: bodyFont(snap, 'hudSmall'),
      align: 'right',
      baseline: 'middle',
    });
    if (snap.streak >= 2) {
      builder.text(DESIGN_W / 2, midY - 52, `×${snap.multiplier}  COMBO ${snap.streak}`, {
        fill: palette.textAccent,
        font: FONT.hud,
        align: 'center',
        baseline: 'middle',
      });
    }
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ──────────────────────────────────────────────────────────────────── grid

function drawGrid(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  for (let i = 0; i < snap.gridRows; i++) {
    for (let j = 0; j < snap.gridCols; j++) {
      const cell = snap.cells[i * snap.gridCols + j]!;
      if (cell.void) continue; // outside the pattern shape — background
      const cx = snap.gridLeft + BEAD_CELL / 2 + BEAD_PITCH * j;
      const cy = snap.gridTop - BEAD_CELL / 2 - BEAD_PITCH * i;

      // GAP-04 `wrong` 态：被拒格整层水平抖动（±px，200ms 内摆 2 次）。
      const isWrong = i === snap.wrongRow && j === snap.wrongCol && snap.wrongProgress > 0;
      // D1 减弱动效：错误抖动 → 位移归零，红描边改静态画出（见下方 flash）。
      const dx =
        isWrong && !snap.reduceMotion
          ? WRONG_SHAKE_PX * Math.sin(snap.wrongProgress * Math.PI * 4)
          : 0;
      const bx = cx + dx;

      if (cell.state === 'locked') {
        // Locked bead: flat locked fill + 45° hatch (§1.2) — no highlight, no symbol.
        drawLockedBead(builder, bx, cy, palette);
        continue;
      }

      if (cell.state === 'empty') {
        // Empty socket — 传目标色 colorIdx 绘 E1 色底 + E4 幽灵符号（§1.2 / §3.8），
        // 使未填态即可读出该格要填的颜色；仍无投影/倒角/高光 → 不致误读为已填珠。
        drawEmptySocket(builder, bx, cy, palette, BEAD_CELL, cell.colorIdx);
        // GAP-03/04 引导：单一目标格 `hint` 蓝描边呼吸（叠加优先级：外描边 > E2 > E1）。
        if (snap.onboarding && i === snap.hintRow && j === snap.hintCol) {
          drawStateRing(builder, bx, cy, BEAD_CELL, palette.hintBlue, hintAlpha(snap.pulseClock, snap.reduceMotion));
        }
        // GAP-04 `wrong`：danger 描边闪 2 次（与抖动同格同帧）。
        if (isWrong) {
          // D1 减弱动效：描边闪烁 → 静态红描边（α 恒 1；300ms 时长归 game 侧）。
          const flash = snap.reduceMotion
            ? 1
            : 0.4 + 0.6 * Math.abs(Math.sin(snap.wrongProgress * Math.PI * 2));
          drawStateRing(builder, bx, cy, BEAD_CELL, palette.danger, flash);
        }
        continue;
      }

      // Filled bead — full six-layer card incl. the L5 symbol channel (§1.1).
      drawFilledBead(builder, bx, cy, cell.colorIdx);
    }
  }
}

// ──────────────────────────────────────────────────────────────────── tray

function drawTray(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  const pitch = TRAY_SLOT + TRAY_GAP;
  const rows = Math.ceil(snap.traySlots.length / TRAY_COLS);
  const rowWidth = TRAY_COLS * pitch - TRAY_GAP;
  const left = (DESIGN_W - rowWidth) / 2;
  const bandMid = (TRAY_BAND.yMin + TRAY_BAND.yMax) / 2;

  // White rounded panel behind the slots.
  const panelHeight = rows * pitch - TRAY_GAP + 24;
  const panelBottom = bandMid - panelHeight / 2;
  builder.rect(left - 12, panelBottom, rowWidth + 24, panelHeight, {
    fill: palette.panel,
    radius: 18,
  });

  for (let idx = 0; idx < snap.traySlots.length; idx++) {
    const slot = snap.traySlots[idx]!;
    const row = Math.floor(idx / TRAY_COLS);
    const col = idx % TRAY_COLS;
    const cx = left + TRAY_SLOT / 2 + pitch * col;
    const cy = bandMid + ((rows - 1) * pitch) / 2 - row * pitch;
    const slotBottom = cy - TRAY_SLOT / 2;
    const dashed = row > 0; // expansion row keeps the dashed-slot language

    if (slot.state === 'free') {
      if (dashed) {
        // RenderModel has no dash stroke — synthesize 6/4 segments (arch §4).
        drawDashedRect(builder, left + pitch * col, slotBottom, TRAY_SLOT, TRAY_SLOT, palette.slotBorder);
      } else {
        drawEmptySocket(builder, cx, cy, palette, TRAY_SLOT);
      }
      continue;
    }

    const selected = slot.state === 'selected';
    // Selected: lift 4px + darker L0 shadow + indicator dot (§1.2 selected row).
    const lift = selected ? 4 : 0;
    drawFilledBead(builder, cx, cy, slot.colorIdx, {
      size: TRAY_BEAD_SIZE,
      lift,
      ...(selected ? { shadowAlpha: SELECTED_SHADOW_ALPHA } : {}),
    });
    if (selected) {
      builder.circle(cx, slotBottom - 8, 4, { fill: palette.textAccent });
    }
    // GAP-03 引导：首珠所在槽外描边脉冲呼吸（与目标格 `hint` 同周期、同色）。
    if (snap.onboarding && idx === snap.guideSlot) {
      drawStateRing(builder, cx, cy, TRAY_SLOT, palette.hintBlue, hintAlpha(snap.pulseClock, snap.reduceMotion));
    }
  }
}

function drawDashedRect(
  builder: RenderModelBuilder,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  const dash = 6;
  const gap = 4;
  const period = dash + gap;
  // Top & bottom edges.
  for (let px = 0; px < w; px += period) {
    const len = Math.min(dash, w - px);
    builder.line(x + px, y, x + px + len, y, color, 1);
    builder.line(x + px, y + h, x + px + len, y + h, color, 1);
  }
  // Left & right edges.
  for (let py = 0; py < h; py += period) {
    const len = Math.min(dash, h - py);
    builder.line(x, y + py, x, y + py + len, color, 1);
    builder.line(x + w, y + py, x + w, y + py + len, color, 1);
  }
}

// ─────────────────────────────────── S7 结算·过关面板（ux-spec §3.4）

/**
 * 结算·过关面板：遮罩 + `panel_dialog` 底板（白底 / 1px 描边 / 圆角 24，assets-spec §1.5）
 * + 金色缎带标题 + **逐颗入场**的星级 + 次要信息「剩余 mm:ss ｜ 道具 n/3」+ 主/副双钮。
 *
 * 几何/文案/动作全在 `systems/clear-panel.ts`（与命中测试同源）；本函数只画。
 * 星级节奏来自快照（`clearStarsShown` / `clearStarPopScale`）——面板逻辑按
 * ux-spec §5「逐颗 150ms」推进，视图**不自持计时**。
 */
function drawClearPanel(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  if (!snap.clearPanelVisible) return;
  const layout = clearPanelLayout({ lastLevel: snap.clearLastLevel });
  const plate = layout.panel;
  const w = plate.xMax - plate.xMin;
  const h = plate.yMax - plate.yMin;

  // 遮罩（量值同 ux-spec §3.3，与暂停面板一致）。
  builder.rect(0, 0, DESIGN_W, DESIGN_H, {
    fill: `rgba(${PANEL_SCRIM_RGB.r},${PANEL_SCRIM_RGB.g},${PANEL_SCRIM_RGB.b},${PANEL_SCRIM_ALPHA})`,
  });
  builder.rect(plate.xMin, plate.yMin, w, h, {
    fill: palette.panel,
    stroke: palette.slotBorder,
    lineWidth: 1,
    radius: 24,
  });

  // 金色缎带横幅 + 标题（ux-spec §3.4 首行）。
  const ribbonH = 84;
  builder.rect(plate.xMin + PANEL_PADDING, layout.titleY - ribbonH / 2, w - PANEL_PADDING * 2, ribbonH, {
    fill: withAlpha(palette.textAccent, 0.22),
    radius: 16,
  });
  builder.text(DESIGN_W / 2, layout.titleY, CLEAR_PANEL_TITLE, {
    fill: palette.text,
    font: FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });

  // 星级：只画已入场的那些；最新一颗按弹跳缩放（0→1.2→1）。
  const starR = (CLEAR_STAR_SIZE / 2) * 0.92;
  for (let i = 0; i < snap.clearStarsShown; i++) {
    // D1 减弱动效：完成星弹跳缩放 → 静态高亮（最新一颗不再弹跳）。
    const scale =
      i === snap.clearStarsShown - 1 && !snap.reduceMotion ? snap.clearStarPopScale : 1;
    if (scale <= 0) continue;
    builder.polygon(starPoints(layout.starX[i]!, layout.starsY, starR * scale, 5, 90), {
      fill: palette.textAccent,
    });
  }

  // 次要信息（ux-spec §3.4 第三行）。
  builder.text(
    DESIGN_W / 2,
    layout.infoY,
    `剩余 ${formatTime(snap.clearRemaining)} ｜ 道具 ${snap.clearPowerupsUsed}/${POWERUP_TYPES.length}`,
    { fill: palette.textDim, font: bodyFont(snap, 'sub'), align: 'center', baseline: 'middle' },
  );

  // 主/副双钮：主钮金底深字（对比度 ≈8:1），副钮白底深字；文案归 `clear-panel.ts`。
  for (const button of layout.buttons) {
    const bw = button.rect.xMax - button.rect.xMin;
    const bh = button.rect.yMax - button.rect.yMin;
    const primary = button.id === 'next';
    builder.rect(button.rect.xMin, button.rect.yMin, bw, bh, {
      fill: primary ? palette.textAccent : palette.panel,
      stroke: primary ? palette.textAccent : palette.slotBorder,
      lineWidth: 1,
      radius: 20,
    });
    builder.text(
      button.rect.xMin + bw / 2,
      button.rect.yMin + bh / 2,
      clearPanelLabel(button.id, snap.clearLastLevel),
      {
        fill: palette.text,
        font: FONT.panelButton,
        align: 'center',
        baseline: 'middle',
      },
    );
  }
}

// ──────────────────────────────────────── S7 combo VFX (score-combo §2.5)

/**
 * 连击特效三档的**可见部分**：Lv1 粒子（从落子格心散开）与 Lv3 全屏爆发（边缘径向光 + 波浪）。
 *
 * **Lv2（伪震屏）不在本函数画**：它需要「整屏 scale」而渲染管线没有全局变换通道（`_commands`
 * 私有，`WXG-T-074` 登记）——视图**不为它假造替代画面**；快照里 `comboVfxProgress` 照常推进，
 * 等宿主/适配层提供变换后即可生效。红线：三档都是**单次循环**，本函数无任何周期量 ⇒
 * 无 >3Hz 闪烁来源（`§3.8`）。
 */
function drawComboVfx(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  if (!snap.comboVfxKind || snap.comboVfxProgress <= 0) return;
  const p = snap.comboVfxProgress;

  if (snap.comboVfxKind === 'particles' && snap.comboVfxRow >= 0 && snap.comboVfxCol >= 0) {
    const cx = snap.gridLeft + BEAD_CELL / 2 + BEAD_PITCH * snap.comboVfxCol;
    const cy = snap.gridTop - BEAD_CELL / 2 - BEAD_PITCH * snap.comboVfxRow;
    for (const { x, y } of comboParticleOffsets(p)) {
      builder.circle(cx + x, cy + y, 3 + BEAD_CELL * 0.1 * (1 - p), {
        fill: withAlpha(palette.textAccent, 1 - p),
      });
    }
    return;
  }

  if (snap.comboVfxKind === 'burst') {
    const { radial, wave } = comboBurst(p);
    // 边缘径向光：四边各一条随 radial 亮起的色条（程序化，零外部资产）。
    builder.rect(0, 0, DESIGN_W, 12, { fill: withAlpha(palette.textAccent, 0.55 * radial) });
    builder.rect(0, DESIGN_H - 12, DESIGN_W, 12, { fill: withAlpha(palette.textAccent, 0.55 * radial) });
    builder.rect(0, 0, 12, DESIGN_H, { fill: withAlpha(palette.adBadge, 0.5 * radial) });
    builder.rect(DESIGN_W - 12, 0, 12, DESIGN_H, { fill: withAlpha(palette.adBadge, 0.5 * radial) });
    // 珠面波浪：一条自下而上扫过的浅色带（相位 = wave）。
    const sweepY = wave * DESIGN_H;
    const glow = 1 - Math.abs(wave - 0.5) * 2; // 中段最亮
    builder.rect(0, sweepY - 48, DESIGN_W, 96, {
      fill: withAlpha(palette.panel, 0.22 * glow),
    });
    return;
  }

  // 'pseudoShake'：见函数头注释（平台缺口，不假造）。
}

// ──────────────────────────────────────────── S7 finish screen (ux-spec §3.6)

/**
 * 通关画面（FINISH）：全屏庆祝 + 星级总览（每关最好星级 + 总星数）+ 双钮。
 *
 * 与结算面板同纪律：几何全部取自 `finishPanelLayout()`（与命中测试**同一真源**——
 * 画出来的按钮不可能与点击落点不一致）；入场节奏取自快照（`finishRowsShown` /
 * `finishRowPopScale`），**视图不自持计时**。数据只有 `snap.finishStars`（每关 0..3），
 * 视图不推断任何玩法状态。
 */
function drawFinishPanel(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  if (!snap.finishPanelVisible) return;
  const levelCount = snap.finishStars.length;
  if (levelCount === 0) return;
  const layout = finishPanelLayout(levelCount);

  // 全屏遮罩（量值同 ux-spec §3.3，与两个面板一致）+ 顶部三条庆祝色带
  // （程序化，零外部资产；呼应 §3.6「全屏庆祝」）。
  builder.rect(0, 0, DESIGN_W, DESIGN_H, {
    fill: `rgba(${PANEL_SCRIM_RGB.r},${PANEL_SCRIM_RGB.g},${PANEL_SCRIM_RGB.b},${PANEL_SCRIM_ALPHA})`,
  });
  const bands = [palette.textAccent, palette.adBadge, palette.textAccent];
  for (let i = 0; i < bands.length; i++) {
    builder.rect((i * DESIGN_W) / 3, DESIGN_H - 14, DESIGN_W / 3, 14, { fill: bands[i]! });
  }

  // 标题 + 总星数（「共 N / M ★」）。
  builder.text(DESIGN_W / 2, layout.titleY, FINISH_PANEL_TITLE, {
    fill: palette.text,
    font: FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });
  const total = snap.finishStars.reduce((a, b) => a + b, 0);
  builder.text(
    DESIGN_W / 2,
    layout.totalY,
    `共 ${total} / ${levelCount * FINISH_MAX_STARS_PER_LEVEL} ★`,
    { fill: palette.textAccent, font: bodyFont(snap, 'sub'), align: 'center', baseline: 'middle' },
  );

  // 星级总览：逐关入场（`finishRowsShown`），最新一行按弹跳缩放；未得的星画暗色。
  const rowLeft = DESIGN_W / 2 - FINISH_ROW_W / 2;
  for (let i = 0; i < snap.finishRowsShown && i < layout.rows.length; i++) {
    const row = layout.rows[i]!;
    // D1 减弱动效：通关行弹跳缩放 → 静态高亮。
    const scale = i === snap.finishRowsShown - 1 && !snap.reduceMotion ? snap.finishRowPopScale : 1;
    if (scale <= 0) continue;
    builder.rect(rowLeft, row.y - FINISH_ROW_H / 2, FINISH_ROW_W, FINISH_ROW_H, {
      fill: withAlpha(palette.panel, 0.92),
      stroke: withAlpha(palette.slotBorder, 0.6),
      lineWidth: 1,
      radius: 14,
    });
    builder.text(row.labelX, row.y, `第 ${row.level} 关`, {
      fill: palette.text,
      font: bodyFont(snap, 'sub'),
      align: 'center',
      baseline: 'middle',
    });
    const stars = snap.finishStars[i] ?? 0;
    const r = (FINISH_STAR_SIZE / 2) * 0.92 * scale;
    for (let k = 0; k < 3; k++) {
      builder.polygon(starPoints(row.starX[k]!, row.y, r, 5, 90), {
        fill: k < stars ? palette.textAccent : withAlpha(palette.slotBorder, 0.45),
      });
    }
  }

  // 主 / 副双钮：主钮 = 「重玩第 1 关」（`core-loop §4` 本状态的推进出口），
  // 副钮 = 「▶ 去冲刺」（U1：副按钮样式，不抢主钮）。
  for (const button of layout.buttons) {
    const bw = button.rect.xMax - button.rect.xMin;
    const bh = button.rect.yMax - button.rect.yMin;
    const primary = button.id === 'replay';
    builder.rect(button.rect.xMin, button.rect.yMin, bw, bh, {
      fill: primary ? palette.textAccent : palette.panel,
      stroke: primary ? palette.textAccent : palette.slotBorder,
      lineWidth: 1,
      radius: 20,
    });
    builder.text(
      button.rect.xMin + bw / 2,
      button.rect.yMin + bh / 2,
      finishPanelLabel(button.id),
      {
        fill: primary ? palette.text : palette.textDim,
        font: FONT.panelButton,
        align: 'center',
        baseline: 'middle',
      },
    );
  }
}

// ──────────────────────────────────────────────────────── powerup band

/** 投影竖向偏移：RenderModel 无模糊 ⇒ 用偏移圆角矩形近似（§1.4 的 α0.10 见 palette）。 */
const POWERUP_SHADOW_OFFSET_Y = 3;

/**
 * S6 道具带 —— 三张常驻白卡。每卡 = **形状唯一**的图标 + 剩余免费次数 + 常驻
 * `ad_badge`；卡**下方**是 28px 标签（`assets-spec §1.4`；`accessibility.md` A4 的
 * 「以形状为唯一识别 **+ 文字标签并列**」两半都在这里落地）。
 *
 * 几何取自 `powerupCardRects()` / `powerupLabelY()` —— 与 S2 命中测试**同一真源**：
 * 画出来的卡不可能与点击落点不一致（双份常量在 WXG-T-060 合并，规格补齐在 T-062）。
 * 次数用尽的卡变灰（超限入口只剩角标，§2.6 布局 A）。
 *
 * 零外部资产、零 wx API 调用（ADR-0006：四个局内位全是角标占位）。
 */
function drawPowerupBand(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  const rects = powerupCardRects();
  for (let i = 0; i < rects.length; i++) {
    const { x, bottom, w, h } = rects[i]!;
    const type = POWERUP_TYPES[i];
    if (!type) continue;
    const free = snap.powerupFreeUses[type] > 0;
    const dim = free ? 1 : 0.35;

    // L0 投影（§1.4 α0.10）。RenderModel 无模糊 ⇒ 用偏移圆角矩形近似（bead L0 判例）。
    builder.rect(x, bottom - POWERUP_SHADOW_OFFSET_Y, w, h, {
      fill: withAlpha(BEAD_SHADOW_HEX, POWERUP_SHADOW_ALPHA),
      radius: POWERUP_CARD_RADIUS,
    });
    // 白卡：圆角 20 + 描边 1px（§1.4）。
    builder.rect(x, bottom, w, h, {
      fill: free ? palette.panel : withAlpha(palette.panel, 0.55),
      stroke: free ? palette.slotBorder : withAlpha(palette.slotBorder, 0.4),
      lineWidth: 1,
      radius: POWERUP_CARD_RADIUS,
    });

    drawPowerupGlyph(builder, i, x + w / 2, bottom + h / 2 + 6, dim);

    // 剩余免费次数（`POWERUP_FREE_USES = 1` ⇒ 「×1」/「×0」）。
    builder.text(x + w / 2, bottom + 16, `×${snap.powerupFreeUses[type]}`, {
      fill: withAlpha(palette.text, free ? 1 : 0.4),
      font: bodyFont(snap, 'sub'),
      align: 'center',
      baseline: 'middle',
    });

    // `ad_badge`：28×28 圆角 8、贴卡右上内缩 (8,8)、白色 ▶ 边 10（§1.4）。
    // 常驻，不随次数变化（§2.6 布局 A：超限入口只剩它）。
    const badgeX = x + w - POWERUP_BADGE_INSET - POWERUP_BADGE_SIZE;
    const badgeY = bottom + h - POWERUP_BADGE_INSET - POWERUP_BADGE_SIZE;
    builder.rect(badgeX, badgeY, POWERUP_BADGE_SIZE, POWERUP_BADGE_SIZE, {
      fill: palette.adBadge,
      radius: POWERUP_BADGE_RADIUS,
    });
    const bx = badgeX + POWERUP_BADGE_SIZE / 2;
    const by = badgeY + POWERUP_BADGE_SIZE / 2;
    const edge = POWERUP_BADGE_GLYPH_EDGE;
    builder.polygon(
      [bx - edge / 2, by - edge / 2, bx - edge / 2, by + edge / 2, bx + edge / 2, by],
      { fill: withAlpha(POWERUP_BADGE_GLYPH, free ? 1 : 0.5) },
    );

    // 卡下方标签：28px `text_primary`（§1.4）——「文字标签并列」的那一半。
    builder.text(x + w / 2, powerupLabelY(), POWERUP_LABELS[type], {
      fill: withAlpha(palette.text, free ? 1 : 0.45),
      font: bodyFont(snap, 'sub'),
      align: 'center',
      baseline: 'middle',
    });
  }
  if (snap.powerupHint) {
    // 占位轻提示（§2.6）：置于道具带最下方，不遮挡标签。
    builder.text(DESIGN_W / 2, 24, snap.powerupHint, {
      fill: withAlpha(palette.text, 0.75),
      font: bodyFont(snap, 'sub'),
      align: 'center',
      baseline: 'middle',
    });
  }
}

/**
 * 三图标的程序化绘制（§1.4 的形状定义，64×64 参考框）。`dim` 为 1 时原色，
 * 小于 1 时整体降不透明度（次数用尽态）。
 *
 * ⚠️ 已登记偏差：§1.4 写「卡 176×150 + **卡下方**标签 28px」，而
 * `POWERUP_BAND` 只有 152 高（§3.1）——两条规格无法同时成立。本轮**不改卡尺寸**，
 * 图标按现卡（150×110）缩放绘制，冲突留给主理人裁定（见本台账 backlog）。
 */
function drawPowerupGlyph(
  builder: RenderModelBuilder,
  index: number,
  cx: number,
  cy: number,
  dim: number,
): void {
  const ink = (hex: string): string => withAlpha(hex, dim);
  // §1.4 的图标形状定义在 64×64 参考框内；本卡高 110 ⇒ 1:1 取用即可（留白充足）。
  const u = (v: number): number => v;

  if (index === 0) {
    // 魔法棒：6×40 斜置 −45° + 顶端五角星 r=12（§1.4 #1）。
    const len = u(40);
    const half = u(3);
    const a = (-45 * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rot = (px: number, py: number): [number, number] => [
      cx + px * ca - py * sa,
      cy + px * sa + py * ca,
    ];
    const p = [
      rot(-len / 2, -half),
      rot(len / 2, -half),
      rot(len / 2, half),
      rot(-len / 2, half),
    ].flat();
    builder.polygon(p, { fill: ink(POWERUP_INK_WAND) });
    const [tipX, tipY] = rot(len / 2 + u(2), 0);
    builder.polygon(starPoints(tipX, tipY, u(12), 5, 90), { fill: ink(POWERUP_INK_STAR) });
    return;
  }

  if (index === 1) {
    // 扫帚：柄 5×34 斜置 −30° + 扇形刷毛 + 3 条分缝线（§1.4 #2）。
    const len = u(34);
    const half = u(2.5);
    const a = (-30 * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rot = (px: number, py: number): [number, number] => [
      cx + px * ca - py * sa,
      cy + py * ca + px * sa,
    ];
    const p = [
      rot(-len / 2, -half),
      rot(len / 2, -half),
      rot(len / 2, half),
      rot(-len / 2, half),
    ].flat();
    builder.polygon(p, { fill: ink(POWERUP_INK_STRAW) });
    // 刷毛：以柄下端为顶点的倒三角扇，附 3 条分缝线。
    const [bx, by] = rot(-len / 2, 0);
    const spread = u(15);
    const drop = u(14);
    builder.polygon([bx - spread, by, bx + spread, by, bx, by - drop], {
      fill: ink(POWERUP_INK_STAR),
    });
    for (let k = -1; k <= 1; k++) {
      builder.line(bx, by, bx + (k * spread * 2) / 3, by - drop, ink(POWERUP_INK_STRAW), u(1));
    }
    return;
  }

  // 磁铁：U 形（外弧 r=18 / 内弧 r=8，开口向上）+ 两极端帽（§1.4 #3）。
  const outer = u(18);
  const inner = u(8);
  const ring = [
    ...arcPoints(cx, cy, outer, 180, 360),
    ...arcPoints(cx, cy, inner, 360, 180),
  ];
  builder.polygon(ring, { fill: ink(POWERUP_INK_MAGNET) });
  builder.rect(cx - outer, cy + u(2), outer - inner, u(6), { fill: ink(POWERUP_INK_CAP), radius: u(2) });
  builder.rect(cx + inner, cy + u(2), outer - inner, u(6), { fill: ink(POWERUP_INK_CAP), radius: u(2) });
}

/** Points along a circular arc (design space, y grows upward). */
function arcPoints(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): number[] {
  const steps = 10;
  const points: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    points.push(cx + r * Math.cos(rad), cy + r * Math.sin(rad));
  }
  return points;
}

/** Regular n-point star polygon, first point at `startDeg`. */
function starPoints(
  cx: number,
  cy: number,
  r: number,
  points: number,
  startDeg: number,
): number[] {
  const coords: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = ((startDeg + (i * 180) / points) * Math.PI) / 180;
    const radius = i % 2 === 0 ? r : r * 0.382; // 五角星内接半径比
    coords.push(cx + radius * Math.cos(rad), cy + radius * Math.sin(rad));
  }
  return coords;
}

// ─────────────────────────────────────────────────────────────────── banners

function drawBanners(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  // The pause dialog carries its own 暂停 title — don't double-print the phase
  // banner on top of it (ux-spec §3.3 shows one caption, not two).
  if (
    !snap.banner ||
    snap.panelVisible ||
    snap.clearPanelVisible ||
    snap.finishPanelVisible ||
    snap.sprintSettleVisible ||
    usesFailOverlay(snap)
  ) {
    return;
  }
  const bannerY = 700;
  builder.rect(0, bannerY - 90, DESIGN_W, 200, {
    fill: withAlpha(palette.bannerBackdrop, 0.55),
  });
  builder.text(DESIGN_W / 2, bannerY, snap.banner, {
    fill: palette.bannerText,
    font: FONT.banner,
    align: 'center',
    baseline: 'middle',
  });
  if (snap.subBanner) {
    builder.text(DESIGN_W / 2, bannerY - 64, snap.subBanner, {
      fill: withAlpha(palette.bannerText, 0.75),
      font: bodyFont(snap, 'sub'),
      align: 'center',
      baseline: 'middle',
    });
  }
  // 冲刺态的结算内容（单局 / 最高梯位 / 最高连击）已由 `drawSprintSettle` 承担：
  // 本函数在结算面板可见时整体早退（见上方守卫），故此处不再画占位行。
}
