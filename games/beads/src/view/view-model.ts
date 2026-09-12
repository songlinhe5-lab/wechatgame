/**
 * Beads view model — snapshot → draw commands.
 *
 * The ONLY place that knows how Beads looks. Pure function of the snapshot:
 * same snapshot in, same commands out (control-manifest §8; never mutates the
 * game). Layout bands/geometry come from `config/tuning.ts` (§3.1/§3.3/§3.4).
 *
 * Scope note for this slice: the full six-layer bead parameter card and the
 * 10 vector symbols live in `view/symbols.ts` + `view/bead-render.ts` (per
 * architecture §3) — deliberately deferred; colour + lightness channels are
 * drawn here, the symbol channel lands with those files.
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import {
  BEAD_CELL,
  BEAD_PITCH,
  DESIGN_W,
  HUD_BAND,
  POWERUP_BAND,
  TRAY_BAND,
  TRAY_COLS,
  TRAY_GAP,
  TRAY_SLOT,
} from '../config/tuning.js';
import type { BeadsSnapshot } from '../game/state.js';
import { beadColor, mix, withAlpha, type BeadsPalette } from './palette.js';

const FONT = {
  timer: 'bold 44px sans-serif',
  hud: 'bold 30px sans-serif',
  hudSmall: '22px sans-serif',
  banner: 'bold 62px sans-serif',
  sub: '28px sans-serif',
} as const;

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
  drawBanners(builder, snap, palette);
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
      const left = cx - BEAD_CELL / 2;
      const bottom = cy - BEAD_CELL / 2;

      if (cell.state === 'locked') {
        // Locked: grey bead + 45° hatch (art-bible §3.4).
        builder.rect(left, bottom, BEAD_CELL, BEAD_CELL, { fill: palette.locked, radius: 10 });
        builder.line(left + 8, bottom + 8, left + BEAD_CELL - 8, bottom + BEAD_CELL - 8, withAlpha(palette.background, 0.9), 2);
        builder.line(left + BEAD_CELL - 8, bottom + 8, left + 8, bottom + BEAD_CELL - 8, withAlpha(palette.background, 0.9), 2);
        continue;
      }

      if (cell.state === 'empty') {
        // Empty slot: recessed socket (inner shadow suggestion via darker rim).
        builder.rect(left, bottom, BEAD_CELL, BEAD_CELL, {
          fill: palette.slot,
          stroke: palette.slotBorder,
          lineWidth: 1,
          radius: 10,
        });
        continue;
      }

      // Filled bead: colour + top highlight (lightness channel). The symbol
      // channel arrives with view/symbols.ts.
      const color = beadColor(cell.colorIdx);
      builder.circle(cx, cy, BEAD_CELL / 2 - 1, { fill: color });
      builder.circle(cx - 6, cy + 8, 8, { fill: withAlpha(mix(color, 0.65), 0.8) });
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
        builder.rect(left + pitch * col, slotBottom, TRAY_SLOT, TRAY_SLOT, {
          fill: palette.slot,
          stroke: palette.slotBorder,
          lineWidth: 1,
          radius: 10,
        });
      }
      continue;
    }

    const selected = slot.state === 'selected';
    // Selected: lift 4px + indicator dot (art-bible §3.4).
    const lift = selected ? 4 : 0;
    const color = beadColor(slot.colorIdx);
    builder.circle(cx, cy + lift, TRAY_SLOT / 2 - 2, { fill: color });
    builder.circle(cx - 5, cy + lift + 7, 7, { fill: withAlpha(mix(color, 0.65), 0.8) });
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
  if (!snap.banner) return;
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
