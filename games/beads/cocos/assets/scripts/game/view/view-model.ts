/**
 * Beads view model — snapshot → draw commands.
 *
 * The ONLY place that knows how Beads looks. Pure function of the snapshot:
 * same snapshot in, same commands out (control-manifest §8; never mutates the
 * game). Layout bands/geometry come from `config/tuning.ts` (§3.1/§3.3/§3.4).
 *
 * The bead itself — the six-layer parameter card and the 10-symbol channel —
 * lives in `view/bead-render.ts` + `view/symbols.ts` (architecture §3). This file
 * owns the *screen*: layout bands, HUD, tray chrome, pause panel and banners.
 */

import type { RenderModelBuilder } from '../../framework/index';
import {
  BEAD_CELL,
  BEAD_PITCH,
  DESIGN_H,
  DESIGN_W,
  HUD_BAND,
  PANEL_SCALE_FROM,
  PANEL_SCRIM_ALPHA,
  PANEL_SCRIM_RGB,
  POWERUP_BAND,
  TRAY_BAND,
  TRAY_COLS,
  TRAY_GAP,
  TRAY_SLOT,
} from '../config/tuning';
import type { BeadsSnapshot } from '../game/state';
import { pausePanelLayout, type PanelButton } from '../systems/pause-panel';
import {
  SELECTED_SHADOW_ALPHA,
  TRAY_BEAD_SIZE,
  drawEmptySocket,
  drawFilledBead,
  drawLockedBead,
} from './bead-render';
import { withAlpha, type BeadsPalette } from './palette';

const FONT = {
  timer: 'bold 44px sans-serif',
  hud: 'bold 30px sans-serif',
  hudSmall: '22px sans-serif',
  banner: 'bold 62px sans-serif',
  sub: '28px sans-serif',
  panelTitle: 'bold 40px sans-serif',
  panelButton: 'bold 30px sans-serif',
} as const;

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
  drawPowerupBand(builder, palette);
  drawPausePanel(builder, snap, palette);
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
    builder.rect(bx, by, bw, bh, {
      fill: primary ? palette.textAccent : palette.slot,
      stroke: primary ? palette.textAccent : palette.slotBorder,
      lineWidth: 2,
      radius: 14,
    });
    builder.text(bx + bw / 2, by + bh / 2, panelLabel(button, snap), {
      fill: primary ? palette.panel : palette.text,
      font: FONT.panelButton,
      align: 'center',
      baseline: 'middle',
    });
  }
}

// ───────────────────────────────────────────────────────────────────── HUD

function drawHud(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  const midY = (HUD_BAND.yMin + HUD_BAND.yMax) / 2;

  // Timer capsule (centre): danger colour when urgent (§3.5 channel 1).
  const timerColor = snap.urgent ? palette.danger : palette.text;
  builder.text(DESIGN_W / 2, midY, formatTime(snap.remaining), {
    fill: timerColor,
    font: FONT.timer,
    align: 'center',
    baseline: 'middle',
  });

  // Pause gear (left): a circle + notches; hit area handled by the game (S2).
  builder.circle(60, midY, 26, { fill: palette.panel, stroke: palette.textDim, lineWidth: 3 });
  builder.circle(60, midY, 8, { fill: palette.textDim });

  // Mode / stage label (small, dim, right-aligned before the capsule zone).
  const label =
    snap.mode === 'sprint' ? `STAGE ${snap.stageIndex + 1}` : `LV ${snap.levelIndex + 1}/${snap.levelCount}`;
  builder.text(DESIGN_W - 220, midY, label, {
    fill: palette.textDim,
    font: FONT.hudSmall,
    align: 'right',
    baseline: 'middle',
  });

  // Sprint-only HUD block: score + multiplier + combo (ux-spec §3: zero score
  // HUD in normal mode — D6 keeps the normal campaign scoreless).
  if (snap.mode === 'sprint') {
    builder.text(DESIGN_W - 220, midY + 44, `SCORE ${snap.score}`, {
      fill: palette.text,
      font: FONT.hudSmall,
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

      if (cell.state === 'locked') {
        // Locked bead: flat locked fill + 45° hatch (§1.2) — no highlight, no symbol.
        drawLockedBead(builder, cx, cy, palette);
        continue;
      }

      if (cell.state === 'empty') {
        // Empty socket: recessed slot — an unfilled cell must not read as a bead (§1.2).
        drawEmptySocket(builder, cx, cy, palette);
        continue;
      }

      // Filled bead — full six-layer card incl. the L5 symbol channel (§1.1).
      drawFilledBead(builder, cx, cy, cell.colorIdx);
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

// ──────────────────────────────────────────────────────── powerup band

/**
 * Structure reserve only (S6 excluded this sprint): three card outlines +
 * `ad_badge` corner marks, ADR-0006 — badge placeholders, zero wx API calls.
 */
function drawPowerupBand(builder: RenderModelBuilder, palette: BeadsPalette): void {
  const cardW = 150;
  const cardH = 110;
  const gap = 30;
  const totalW = cardW * 3 + gap * 2;
  const startX = (DESIGN_W - totalW) / 2;
  const bottom = (POWERUP_BAND.yMin + POWERUP_BAND.yMax) / 2 - cardH / 2;
  for (let i = 0; i < 3; i++) {
    const x = startX + i * (cardW + gap);
    builder.rect(x, bottom, cardW, cardH, {
      fill: palette.panel,
      stroke: palette.slotBorder,
      lineWidth: 2,
      radius: 14,
    });
    // Ad badge (top-right corner of each card).
    builder.rect(x + cardW - 40, bottom + cardH - 26, 32, 18, {
      fill: palette.adBadge,
      radius: 4,
    });
  }
}

// ─────────────────────────────────────────────────────────────────── banners

function drawBanners(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  // The pause dialog carries its own 暂停 title — don't double-print the phase
  // banner on top of it (ux-spec §3.3 shows one caption, not two).
  if (!snap.banner || snap.panelVisible) return;
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
      font: FONT.sub,
      align: 'center',
      baseline: 'middle',
    });
  }
  if (snap.phase === 'game-over' && snap.mode === 'sprint') {
    builder.text(DESIGN_W / 2, bannerY - 110, `SCORE ${snap.score}${snap.isNewBest ? ' · NEW BEST!' : ''}`, {
      fill: palette.textAccent,
      font: FONT.hudSmall,
      align: 'center',
      baseline: 'middle',
    });
  }
}
