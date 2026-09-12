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
  // Screen shake (§6.1 item 1): the whole world rattles by the decaying
  // amplitude. Reduced motion pins the amplitude to 0, so this collapses to
  // a plain identity offset and nothing else in the pipeline changes.
  const shake = snap.shakeAmplitude;
  const offX = shake > 0 ? shake * 0.6 : 0; // fixed direction — deterministic
  const offY = shake > 0 ? -shake * 0.4 : 0;
  drawArena(builder, snap, palette, offX, offY);
  drawBricks(builder, snap, palette, offX, offY);
  drawBall(builder, snap, palette, offX, offY);
  drawPaddle(builder, snap, palette, offX, offY);
  drawPowerups(builder, snap, palette);
  drawHud(builder, snap, palette);
  drawCombo(builder, snap, palette);
  drawBanners(builder, snap, palette);
}

/**
 * Falling powerup capsules (S7). Icons are distinguished by SHAPE first
 * (accessibility A4 — colour is only an aid): expand = wide bar, multi =
 * three dots, life = heart. Sizes follow assets-spec §1.4 (64×64 capsule).
 */
function drawPowerups(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
): void {
  const colors: Record<string, string> = {
    expand: palette.powerupExpand,
    multi: palette.powerupMulti,
    life: palette.powerupLife,
  };
  for (const p of snap.fallingPowerups) {
    const color = colors[p.id] ?? palette.textAccent;
    const left = p.x - p.width / 2;
    const bottom = p.y - p.height / 2;
    // Capsule backplate so the glyph reads on any brick colour.
    builder.rect(left, bottom, p.width, p.height, {
      fill: withAlpha(palette.backplate, 0.85),
      stroke: color,
      lineWidth: 3,
      radius: 14,
    });
    const cx = p.x;
    const cy = p.y;
    switch (p.id) {
      case 'expand':
        // A wide bar: "the paddle grows".
        builder.rect(cx - 22, cy - 5, 44, 10, { fill: color, radius: 5 });
        break;
      case 'multi':
        // Three dots: "one becomes three".
        builder.circle(cx - 14, cy + 8, 6, { fill: color });
        builder.circle(cx + 14, cy + 8, 6, { fill: color });
        builder.circle(cx, cy - 10, 6, { fill: color });
        break;
      case 'life':
        // Heart: two circles + a downward triangle.
        builder.circle(cx - 8, cy - 5, 9, { fill: color });
        builder.circle(cx + 8, cy - 5, 9, { fill: color });
        builder.polygon([cx - 16, cy - 1, cx + 16, cy - 1, cx, cy + 16], { fill: color });
        break;
      default:
        // Defined-but-unimplemented ids never spawn (§3.6); draw a dot anyway
        // so a future id is visible instead of an invisible catchable.
        builder.circle(cx, cy, 8, { fill: color });
        break;
    }
  }
}

function drawArena(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
  offX: number,
  offY: number,
): void {
  const { width, height } = snap.tuning;
  // Faint frame so the play area reads as a cabinet even on a bright screen.
  builder.rect(offX, offY, width, height, { fill: withAlpha(palette.backplate, 0.55) });
  builder.line(offX, offY, offX + width, offY, withAlpha(palette.textDim, 0.35), 2);
  builder.line(offX, offY + height, offX + width, offY + height, withAlpha(palette.textDim, 0.35), 2);
  builder.line(offX, offY, offX, offY + height, withAlpha(palette.textDim, 0.35), 2);
  builder.line(offX + width, offY, offX + width, offY + height, withAlpha(palette.textDim, 0.35), 2);
}

function drawBricks(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
  offX: number,
  offY: number,
): void {
  const bricks = snap.bricks;
  for (let i = 0; i < bricks.length; i++) {
    const brick = bricks[i]!;
    if (brick.destroyed) continue;

    // Damaged bricks are darkened so the player can read remaining hp at a
    // glance without a separate hp bar (§6.2 keep item — never gated).
    const damaged = !brick.indestructible && brick.hp < brick.maxHp;
    const fill = damaged ? shade(brick.color, -0.45) : brick.color;
    const left = brick.x - brick.width / 2 + offX;
    const bottom = brick.y - brick.height / 2 + offY;

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
  offX: number,
  offY: number,
): void {
  const x = snap.ballX + offX;
  const y = snap.ballY + offY;
  const layers = snap.motion.ballTrailLayers;
  if (layers > 0) {
    // Trail (§B3): oldest ghosts first, fading toward the body. The count is
    // driven by the motion table — reduce-motion zeroes it (§6.1 item 5).
    for (let i = 0; i < snap.ballTrail.length; i++) {
      const p = snap.ballTrail[i]!;
      const fade = (i + 1) / (snap.ballTrail.length + 1);
      builder.circle(p.x + offX, p.y + offY, snap.ballRadius * (0.5 + 0.4 * fade), {
        fill: withAlpha(palette.ballGlow, 0.18 * fade),
      });
    }
  }
  builder.circle(x, y, snap.ballRadius + 6, {
    fill: withAlpha(palette.ballGlow, 0.22),
  });
  builder.circle(x, y, snap.ballRadius, { fill: palette.ball });
  // A single dark arc sells rotation on a flat circle.
  builder.circle(x - snap.ballRadius * 0.3, y + snap.ballRadius * 0.3, snap.ballRadius * 0.28, {
    fill: withAlpha(palette.textDim, 0.35),
  });
}

function drawPaddle(
  builder: RenderModelBuilder,
  snap: BreakoutSnapshot,
  palette: BreakoutPalette,
  offX: number,
  offY: number,
): void {
  const left = snap.paddleX - snap.paddleWidth / 2 + offX;
  const bottom = snap.paddleY - snap.paddleHeight / 2 + offY;
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
  // §6.2 keep item: the combo number always changes (readability). §6.1 item 9
  // only gates the 1.3× scale pulse — this renderer draws the number statically
  // either way, so `motion.comboPulse === false` is satisfied by construction
  // (documented so a future pulse effect knows where to branch).
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
  // The bob is periodic ambient motion (§6.1 item 8, "呼吸/脉冲"): with
  // reduced motion it freezes to a static chevron instead of oscillating.
  const bob = snap.motion.ambientPulse ? Math.sin(snap.phaseElapsed * 4) * 8 : 0;

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
