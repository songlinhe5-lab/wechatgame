/**
 * Breakout view model — snapshot → draw commands.
 *
 * This is the ONLY place that knows how Breakout looks. It is a pure function
 * of the snapshot: same snapshot in, same commands out, no state kept between
 * frames. Swapping to sprites later means writing a second function with the
 * same signature, not touching gameplay.
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import type { CompiledBrick } from '@wxgame/framework';
import type { BreakoutSnapshot } from '../game/state.js';
import { LAUNCH_HINT } from '../game/state.js';
import { DEFAULT_PALETTE, shade, withAlpha, type BreakoutPalette } from './palette.js';

/** Vertical layout constants for the static HUD (design space). */
const HUD = {
  scoreX: 24,
  scoreY: 1300,
  levelY: 1300,
  livesRight: 726,
  barX: 24,
  barY: 1246,
  barWidth: 702,
  barHeight: 8,
  bannerY: 700,
  subBannerY: 636,
  comboY: 300,
} as const;

const FONT = {
  hud: 'bold 30px sans-serif',
  hudSmall: '22px sans-serif',
  banner: 'bold 62px sans-serif',
  sub: '28px sans-serif',
  combo: 'bold 34px sans-serif',
} as const;

/**
 * Render one frame of Breakout.
 *
 * The snapshot is read-only, so this cannot accidentally advance the game.
 */
export function buildBreakoutView(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette = DEFAULT_PALETTE,
): void {
  builder.setBackground(palette.background);
  drawArena(builder, snap, palette);
  drawBricks(builder, snap, palette);
  drawBall(builder, snap, palette);
  drawPaddle(builder, snap, palette);
  drawHud(builder, snap, palette);
  drawCombo(builder, snap, palette);
  drawBanners(builder, snap, palette);
}

function drawArena(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
): void {
  const { width, height } = snap.tuning;
  // Faint frame so the play area reads as a cabinet even on a bright screen.
  builder.rect(0, 0, width, height, { fill: withAlpha(palette.backplate, 0.55) });
  builder.line(0, 0, width, 0, withAlpha(palette.textDim, 0.35), 2);
  builder.line(0, height, width, height, withAlpha(palette.textDim, 0.35), 2);
  builder.line(0, 0, 0, height, withAlpha(palette.textDim, 0.35), 2);
  builder.line(width, 0, width, height, withAlpha(palette.textDim, 0.35), 2);
}

function drawBricks(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
): void {
  const bricks = snap.bricks;
  for (let i = 0; i < bricks.length; i++) {
    const brick = bricks[i]!;
    if (brick.destroyed) continue;

    // Damaged bricks are darkened so the player can read remaining hp at a
    // glance without a separate hp bar.
    const damaged = !brick.indestructible && brick.hp < brick.maxHp;
    const fill = damaged ? shade(brick.color, -0.45) : brick.color;
    const left = brick.x - brick.width / 2;
    const bottom = brick.y - brick.height / 2;

    builder.rect(left, bottom, brick.width, brick.height, {
      fill,
      radius: 6,
    });

    // Top highlight strip: reads as a bevel and keeps the grid legible when
    // two adjacent bricks share a colour.
    builder.rect(left + 4, bottom + brick.height - 8, brick.width - 8, 4, {
      fill: withAlpha(shade(brick.color, 0.45), 0.55),
      radius: 2,
    });

    if (brick.indestructible) {
      // Cross-hatch to signal "cannot be broken".
      builder.line(left + 8, bottom + 6, left + brick.width - 8, bottom + brick.height - 6, withAlpha(palette.textDim, 0.7), 2);
      builder.line(left + brick.width - 8, bottom + 6, left + 8, bottom + brick.height - 6, withAlpha(palette.textDim, 0.7), 2);
    } else if (brick.maxHp > 1) {
      // hp pips in the bottom-left corner.
      for (let hp = 0; hp < brick.hp; hp++) {
        builder.circle(left + 10 + hp * 12, bottom + 8, 3.2, { fill: palette.brickDamagedTint, alpha: 0.5 });
      }
    }
  }
}

function drawBall(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
): void {
  builder.circle(snap.ballX, snap.ballY, snap.ballRadius + 6, {
    fill: withAlpha(palette.ballGlow, 0.22),
  });
  builder.circle(snap.ballX, snap.ballY, snap.ballRadius, { fill: palette.ball });
  // A single dark arc sells rotation on a flat circle.
  builder.circle(snap.ballX - snap.ballRadius * 0.3, snap.ballY + snap.ballRadius * 0.3, snap.ballRadius * 0.28, {
    fill: withAlpha(palette.textDim, 0.35),
  });
}

function drawPaddle(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
): void {
  const left = snap.paddleX - snap.paddleWidth / 2;
  const bottom = snap.paddleY - snap.paddleHeight / 2;
  builder.rect(left, bottom, snap.paddleWidth, snap.paddleHeight, {
    fill: palette.paddle,
    stroke: palette.paddleEdge,
    lineWidth: 3,
    radius: snap.paddleHeight / 2,
  });
  builder.rect(left + 10, bottom + snap.paddleHeight - 7, snap.paddleWidth - 20, 3, {
    fill: withAlpha(palette.paddleHighlight, 0.8),
    radius: 2,
  });
}

function drawHud(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
): void {
  builder.text(HUD.scoreX, HUD.scoreY, formatScore(snap.score), {
    fill: palette.text,
    font: FONT.hud,
    align: 'left',
    baseline: 'middle',
  });

  builder.text(snap.tuning.width / 2, HUD.levelY, `BOARD ${snap.levelIndex + 1}/${snap.levelCount}`, {
    fill: palette.textDim,
    font: FONT.hudSmall,
    align: 'center',
    baseline: 'middle',
  });

  builder.text(HUD.livesRight, HUD.levelY, 'LIFE', {
    fill: palette.textDim,
    font: FONT.hudSmall,
    align: 'right',
    baseline: 'middle',
  });

  // Life pips, drawn right-to-left from the label.
  const pipR = 8;
  const pipGap = 26;
  const pipY = HUD.levelY - 34;
  const maxPips = Math.max(snap.lives, snap.tuning.rules.lives);
  for (let i = 0; i < maxPips; i++) {
    const x = HUD.livesRight - 12 - i * pipGap;
    builder.circle(x, pipY, pipR, {
      fill: i < snap.lives ? palette.life : palette.lifeEmpty,
    });
  }

  // Board progress bar (destructible bricks remaining).
  builder.rect(HUD.barX, HUD.barY, HUD.barWidth, HUD.barHeight, {
    fill: palette.barTrack,
    radius: HUD.barHeight / 2,
  });
  if (snap.totalBricks > 0) {
    const cleared = snap.totalBricks - snap.remainingBricks;
    const ratio = cleared / snap.totalBricks;
    if (ratio > 0) {
      builder.rect(HUD.barX, HUD.barY, Math.max(HUD.barHeight, HUD.barWidth * ratio), HUD.barHeight, {
        fill: palette.barFill,
        radius: HUD.barHeight / 2,
      });
    }
  }

  const bestY = HUD.barY - 24;
  const best = `BEST ${formatScore(snap.bestScore)}`;
  builder.text(snap.tuning.width / 2, bestY, best, {
    fill: palette.textDim,
    font: FONT.hudSmall,
    align: 'center',
    baseline: 'middle',
  });
}

function drawCombo(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
): void {
  if (snap.multiplier <= 1) return;
  const label = `COMBO x${snap.multiplier.toFixed(1)}`;
  builder.text(snap.tuning.width / 2, HUD.comboY, label, {
    fill: palette.textAccent,
    font: FONT.combo,
    align: 'center',
    baseline: 'middle',
  });
  builder.text(snap.tuning.width / 2, HUD.comboY - 40, `${snap.combo} in a row`, {
    fill: withAlpha(palette.textAccent, 0.75),
    font: FONT.hudSmall,
    align: 'center',
    baseline: 'middle',
  });
}

function drawBanners(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
): void {
  if (!snap.banner) {
    if (snap.awaitingLaunch) {
      drawTapHint(builder, snap, palette);
    }
    return;
  }

  // Backdrop plate so the banner stays readable over the brick field.
  builder.rect(0, HUD.bannerY - 90, snap.tuning.width, 200, {
    fill: withAlpha(palette.bannerBackdrop, 0.55),
  });
  builder.text(snap.tuning.width / 2, HUD.bannerY, snap.banner, {
    fill: palette.bannerText,
    font: FONT.banner,
    align: 'center',
    baseline: 'middle',
  });
  if (snap.subBanner) {
    builder.text(snap.tuning.width / 2, HUD.subBannerY, snap.subBanner, {
      fill: palette.textDim,
      font: FONT.sub,
      align: 'center',
      baseline: 'middle',
    });
  }
}

/** Launcher affordance: a chevron plus a label, sitting just above the paddle. */
function drawTapHint(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
): void {
  const cx = snap.paddleX;
  const top = snap.paddleY + 210;
  const halfW = 18;
  const h = 22;
  const bob = Math.sin(snap.phaseElapsed * 4) * 8;

  // Flat [x0,y0, x1,y1, x2,y2] triangle pointing down.
  builder.polygon([cx - halfW, top + bob, cx + halfW, top + bob, cx, top - h + bob], {
    fill: withAlpha(palette.textAccent, 0.9),
  });
  builder.text(cx, top + 46 + bob, LAUNCH_HINT, {
    fill: withAlpha(palette.textAccent, 0.85),
    font: FONT.sub,
    align: 'center',
    baseline: 'middle',
  });
}

/** Zero-padded score, e.g. `004200`. */
export function formatScore(score: number): string {
  const clamped = Math.max(0, Math.floor(score));
  return clamped.toString().padStart(6, '0');
}

/** Exposed for tests: the brick colour actually drawn for a given state. */
export function brickRenderFill(brick: CompiledBrick, _palette: BreakoutPalette = DEFAULT_PALETTE): string {
  const damaged = !brick.indestructible && brick.hp < brick.maxHp;
  return damaged ? shade(brick.color, -0.45) : brick.color;
}
