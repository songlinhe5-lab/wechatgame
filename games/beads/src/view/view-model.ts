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
  DESIGN_H,
  DESIGN_W,
  easeOutQuad,
  SELECT_LIFT_PX,
  TRAY_SELECTED_LIFT_PX,
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
  PUZZLE_BAND,
  TRAY_BASE_SLOTS,
  TRAY_COLS,
  TRAY_PLATE,
  TRAY_SLOT,
  AD_HINT_TEXT_Y,
  expandButtonLayout,
  EXPAND_BTN_GLYPH_EDGE,
  EXPAND_BTN_GLYPH_GAP,
  EXPAND_BTN_LABEL,
  EXPAND_BTN_LABEL_W,
  EXPAND_BTN_RADIUS,
  trayLayout,
  WRONG_SHAKE_PX,
  WRONG_FX_MS,
  WRONG_FADE_IN_MS,
  WRONG_HOLD_MS,
  WRONG_FADE_OUT_MS,
  SWEEP_ALPHAS,
  solverSequenceMs,
  WAVE_MS,
  WAVE_BEAD_LOD_LAYERS,
  DENIED_RING_LINEWIDTH,
  CONFETTI_COUNT,
  CONFETTI_NOFLY_YMIN,
  CONFETTI_NOFLY_YMAX,
  HINT_PULSE_MS,
  DANGER_PULSE_MS,
  TRAY_FULL_PULSE_MS,
  BG_CORE_RECT,
  BG_DEPTH_ALPHA,
  BG_LIFT_RECT,
  CLOCK_ICON_DIA,
  GEAR_HOLE_R,
  GEAR_HUB_R,
  GEAR_TEETH,
  GEAR_TEETH_R0,
  GEAR_TEETH_R1,
  GEAR_TEETH_W,
  GLOW_BAND_ALPHAS,
  GLOW_BAND_OUT_MAX,
  GLOW_BAND_RADIUS_SCALE,
  PLATE_OUTSET,
  PLATE_RADIUS,
  PLATE_SHADOW_ALPHA,
  PLATE_SHADOW_DY,
  PLATE_STICKER_OUTSET,
  TIMER_CAPSULE,
  TIMER_CAPSULE_SHADOW_ALPHA,
  TIMER_CAPSULE_SHADOW_DY,
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
  drawTargetTile,
  drawDebugCellOutline,
  drawStateRing,
  fillPopEnvelope,
  type FillPopEnvelope,
  type FilledBeadOptions,
} from './bead-render.js';
import {
  BEAD_HIGHLIGHT_HEX,
  BEAD_SHADOW_HEX,
  BG_DEPTH_HEX,
  BG_LIFT_HEX,
  EXPAND_BTN_INK,
  EXPAND_BTN_TEXT,
  GLOW_WARM_HEX,
  POWERUP_BADGE_GLYPH,
  POWERUP_INK_CAP,
  POWERUP_INK_MAGNET,
  POWERUP_INK_STAR,
  POWERUP_INK_STRAW,
  POWERUP_INK_WAND,
  POWERUP_SHADOW_ALPHA,
  CONFETTI_COLORS,
  STAR_GOLD,
  withAlpha,
  type BeadInks,
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
import { comboBurst, comboParticleOffsets, comboPseudoShake } from './combo-vfx.js';
import {
  confettiFrame,
  confettiIsForeground,
  confettiQuad,
  deniedPressScale,
  solverBeadProgress,
  solverHintAlpha,
  SWEEP_LAYER_COUNT,
  sweepCenterX,
  sweepQuad,
  waveEnvelope,
  waveWindowMs,
} from './scene-vfx.js';
import type { ConfettiBeadState, WaveEnvelope } from './scene-vfx.js';

const FONT = {
  timer: 'bold 44px sans-serif',
  hud: 'bold 30px sans-serif',
  // F7⑤：最小字号 28px——HUD 模式/分数小字 22px 作废（art-bible §6）。
  hudSmall: '28px sans-serif',
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
  return name === 'sub' ? '35px sans-serif' : '35px sans-serif'; // 28 × 1.25（F7⑤ 后两档同基准）
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
    case 'toggle-vibrate':
      return `震动  ${snap.vibrate ? '开' : '关'}`;
    case 'toggle-debug-info':
      return `性能信息  ${snap.debugInfo ? '开' : '关'}`;
    case 'start-sprint':
      return '▶ 去冲刺';
    case 'go-menu':
      return '回主菜单';
    default:
      return '';
  }
}

/** Render one frame of Beads. Read-only over the snapshot by construction. */
export function buildBeadsView(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
  /** 珠色墨水组（v1.40 关卡色板；game 侧按当前关卡解析传入，热路径零分配）。 */
  inks: BeadInks,
): void {
  // G5 连击 Lv2 伪震屏（`art-bible §7.3.5` 案 B · WXG-T-132）：整屏 scale 走框架
  // 全局变换通道，锚点 = 设计中心（=屏幕中心，letterbox/居中换算下恒重合）。
  // D1 整条关停；三角波两端 screenScale 恰为 1 ⇒ builder 不产变换位，静帧零开销。
  // 背景层**参与**变换（前置验证结论，ADR-0014 §1）⇒ 无需外扩补边。
  if (snap.comboVfxKind === 'pseudoShake' && snap.comboVfxProgress > 0 && !snap.reduceMotion) {
    const s = comboPseudoShake(snap.comboVfxProgress).screenScale;
    if (s !== 1) builder.setTransform(s, DESIGN_W / 2, DESIGN_H / 2);
  }
  builder.setBackground(palette.background);
  drawBackgroundLayers(builder); // F8：冷沉 + 中心提亮（§1.8，珠/HUD 之下）
  drawHud(builder, snap, palette);
  drawPuzzlePlate(builder, snap, palette); // F2/F3：容器板 + 暖光 band（§1.7）
  drawGrid(builder, snap, palette, inks);
  drawTray(builder, snap, palette, inks);
  drawExpandButton(builder, snap, palette);
  drawPowerupBand(builder, snap, palette);
  drawSweep(builder, snap); // G3 道具生效扫光（§1.6.3）：叠在珠面上、面板与 HUD 之下
  drawComboVfx(builder, snap, palette);
  drawConfetti(builder, snap, false); // G6 MAIN 36 枚：被 scrim α0.5 压住 = 「远处彩带」（§1.6.6 sandwich）
  drawClearPanel(builder, snap, palette);
  drawConfetti(builder, snap, true); // G6 FG 8 枚：「近处彩带」；入禁飞带跳过绘制（不淡出，是不画）
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
      button.id === 'toggle-reduce-motion' ||
      button.id === 'toggle-large-text' ||
      button.id === 'toggle-vibrate' ||
      button.id === 'toggle-debug-info';
    // F6：主按钮 → accent_primary（§3.5 中性强调；白字对比 12.6:1）。
    builder.rect(bx, by, bw, bh, {
      fill: primary ? palette.accentPrimary : palette.slot,
      stroke: primary ? palette.accentPrimary : palette.slotBorder,
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
      fill: palette.accentPrimary, // F6：NEW BEST 角标 → accent_primary（§3.5）。
      radius: 8,
    });
    builder.text(
      (badge.xMin + badge.xMax) / 2,
      (badge.yMin + badge.yMax) / 2,
      SPRINT_SETTLE_NEW_BEST,
      // BD-45（WXG-T-127）：**固定 28px**，不走 bodyFont（E2 大字号）—— F7⑤ 明文
      // 「数字/标题/按钮字号不随开关变化」，角标属该族；且 35px「NEW BEST」实测
      // 183px 会再度溢出 168 底衬（sprint-settle.ts 的宽度按 28px 的 147px 闭口计算）。
      { fill: palette.panel, font: FONT.hudSmall, align: 'center', baseline: 'middle' },
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
      fill: primary ? palette.accentPrimary : palette.panel, // F6：主钮 → accent_primary。
      stroke: primary ? palette.accentPrimary : palette.slotBorder,
      lineWidth: 1,
      radius: 20,
    });
    builder.text(
      button.rect.xMin + bw / 2,
      button.rect.yMin + bh / 2,
      sprintSettleLabel(button.id),
      {
        fill: primary ? palette.panel : palette.textDim, // F6：主钮白字（深藏青底）。
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
      fill: primary ? palette.accentPrimary : palette.slot, // F6：主钮 → accent_primary。
      stroke: primary ? palette.accentPrimary : palette.slotBorder,
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

/**
 * `wrong` danger 描边**单次脉冲** α 包络（ux-spec §5:180，WXG-T-102/BD-29）：
 * 淡入 `WRONG_FADE_IN_MS`（ease-out）→ 峰值保持 `WRONG_HOLD_MS` → 淡出
 * `WRONG_FADE_OUT_MS`（ease-in），三段合计 `WRONG_FX_MS`＝200ms。一次 fx 窗口内
 * **单峰**：α 极值点 = 1（不往复）⇒ 配合 game 侧 `WRONG_FX_RESTART_GATE_MS` 重启门，
 * 有效闪烁 ≤2 次/秒（`systems-index §3.8`）。
 *
 * `p` = `wrongProgress` 归一化进度 0..1；按**毫秒分段**（分段常量取自 `config/tuning`），
 * 纯函数、零分配（无闭包 / 无中间集合）——`buildRenderModel` 每帧可达路径。
 */
function wrongFlashAlpha(p: number): number {
  const ms = p * WRONG_FX_MS;
  if (ms <= 0) return 0;
  if (ms < WRONG_FADE_IN_MS) {
    const t = ms / WRONG_FADE_IN_MS; // 0..1
    return t * (2 - t); // ease-out（进入）
  }
  const holdEnd = WRONG_FADE_IN_MS + WRONG_HOLD_MS;
  if (ms < holdEnd) return 1; // 峰值保持
  const t = (ms - holdEnd) / WRONG_FADE_OUT_MS; // 0..1
  return t >= 1 ? 0 : 1 - t * t; // ease-in（退出）
}

/**
 * BD-10 满槽告警描边 α 呼吸：0.6↔1.0 @`TRAY_FULL_PULSE_MS`（幅度沿用告急同族，
 * 不新造第三档）；D1 减弱动效 → 退为**静态描边**（α=1，描边本身保留）。
 */
function trayFullAlpha(clock: number, reduce: boolean): number {
  return reduce ? 1 : breathe(clock, TRAY_FULL_PULSE_MS, 0.6, 1);
}

/**
 * F8 背景层次（§1.8）：全屏冷沉 + 屏心两档提亮。全部冷色、ΔL ≤4%、极低对比
 *（≈1.03–1.06:1）——只给冷紫灰底「有空气」的层次感，不抢珠子焦点（铁律 1）。
 * 仅在背景之上、其余一切之下（buildBeadsView 首位）。
 */
function drawBackgroundLayers(builder: RenderModelBuilder): void {
  // G2 冷沉层：全屏极淡压暗，破除「纯色无层次」。
  builder.rect(0, 0, DESIGN_W, DESIGN_H, { fill: withAlpha(BG_DEPTH_HEX, BG_DEPTH_ALPHA) });
  // G3/G4 中心提亮：两档同心圆角矩形叠层（外广内聚）。
  builder.rect((DESIGN_W - BG_LIFT_RECT.w) / 2, (DESIGN_H - BG_LIFT_RECT.h) / 2, BG_LIFT_RECT.w, BG_LIFT_RECT.h, {
    fill: withAlpha(BG_LIFT_HEX, BG_LIFT_RECT.alpha),
    radius: BG_LIFT_RECT.radius,
  });
  builder.rect((DESIGN_W - BG_CORE_RECT.w) / 2, (DESIGN_H - BG_CORE_RECT.h) / 2, BG_CORE_RECT.w, BG_CORE_RECT.h, {
    fill: withAlpha(BG_LIFT_HEX, BG_CORE_RECT.alpha),
    radius: BG_CORE_RECT.radius,
  });
}

/**
 * F2/F3 拼图容器板 + 暖光 band（§1.7）：B1–B3 同心暖晕（由外向内 α 0.04→0.06）
 * + B4 板投影 + B5 白板体。**全程态常驻**（含全空开局/中途态）——「中途态拼图无
 * 承载板」由本通道根治；暖晕只允许出现在拼图容器外缘（§3.5 暖光纪律）。
 *
 * 几何自快照派生（与 drawGrid 同源同帧）：bandOut = max(0, min(18, availV, availH))
 * clamp 不越 `PUZZLE_BAND`、不越屏；bandOut=0（近满带图案）时三环宽 0 不绘制。
 */
function drawPuzzlePlate(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  const gridW = (snap.gridCols - 1) * snap.gridPitch + snap.gridCell;
  const gridH = (snap.gridRows - 1) * snap.gridPitch + snap.gridCell;
  const cx = snap.gridLeft + gridW / 2;
  const cy = snap.gridTop - gridH / 2; // y 轴向上，gridTop 是顶

  // B1–B3 暖光 band：由外向内三环，α 单调递增（roundRect 叠层模拟伪径向光）。
  const plateW = gridW + PLATE_OUTSET * 2;
  const plateH = gridH + PLATE_OUTSET * 2;
  const availV = (PUZZLE_BAND.yMax - PUZZLE_BAND.yMin - plateH) / 2;
  const availH = (DESIGN_W - plateW) / 2 - 6;
  const bandOut = Math.max(0, Math.min(GLOW_BAND_OUT_MAX, availV, availH));
  for (let i = 0; i < GLOW_BAND_ALPHAS.length; i++) {
    const e = (bandOut * (GLOW_BAND_ALPHAS.length - i)) / GLOW_BAND_ALPHAS.length;
    if (e <= 0) continue;
    builder.rect(cx - plateW / 2 - e, cy - plateH / 2 - e, plateW + e * 2, plateH + e * 2, {
      fill: withAlpha(GLOW_WARM_HEX, GLOW_BAND_ALPHAS[i]!),
      radius: PLATE_RADIUS + e * GLOW_BAND_RADIUS_SCALE,
    });
  }

  // B4 板投影（墨复用 BEAD_SHADOW_HEX，无模糊 ⇒ 偏移圆角矩形近似）。
  builder.rect(cx - plateW / 2, cy - plateH / 2 - PLATE_SHADOW_DY, plateW, plateH, {
    fill: withAlpha(BEAD_SHADOW_HEX, PLATE_SHADOW_ALPHA),
    radius: PLATE_RADIUS,
  });
  // B5 板体：白板 + 1px panel_border（面板同族 token，板感语言统一）。
  builder.rect(cx - plateW / 2, cy - plateH / 2, plateW, plateH, {
    fill: palette.panel,
    stroke: palette.panelBorder,
    lineWidth: 1,
    radius: PLATE_RADIUS,
  });

  // B5b 板体内凹层次（#4 · 静态质感增强，provisional）：内缩一圈淡色描边 + 上沿内阴影，
  // 模拟托盘内陷（与珠体凸起形成 §1.9 凹凸对比）。⚠️ 观感值 `[待 art/playtest 校准]`，不新增层、不动冻结数值。
  const inset = Math.max(4, Math.round(snap.gridPitch * 0.18));
  builder.rect(cx - plateW / 2 + inset, cy - plateH / 2 + inset, plateW - inset * 2, plateH - inset * 2, {
    stroke: withAlpha(BEAD_SHADOW_HEX, 0.08),
    lineWidth: 2,
    radius: Math.max(2, PLATE_RADIUS - inset),
  });

  // B6 完成贴纸：clear 面板可见时板体外扩白描边 + α0.10 投影（v1.2 贴纸感，叠于板体上、珠下）。
  if (snap.clearPanelVisible) {
    builder.rect(
      cx - plateW / 2 - PLATE_STICKER_OUTSET,
      cy - plateH / 2 - PLATE_STICKER_OUTSET,
      plateW + PLATE_STICKER_OUTSET * 2,
      plateH + PLATE_STICKER_OUTSET * 2,
      { stroke: palette.panel, lineWidth: PLATE_STICKER_OUTSET, radius: PLATE_RADIUS + PLATE_STICKER_OUTSET },
    );
  }
}

function drawHud(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  const midY = (HUD_BAND.yMin + HUD_BAND.yMax) / 2;

  // F7① 倒计时白胶囊（220×64 圆角 32，panel_surface + 1px panel_border + 投影 α0.10）。
  const capLeft = DESIGN_W / 2 - TIMER_CAPSULE.w / 2;
  const capBottom = midY - TIMER_CAPSULE.h / 2;
  builder.rect(capLeft, capBottom - TIMER_CAPSULE_SHADOW_DY, TIMER_CAPSULE.w, TIMER_CAPSULE.h, {
    fill: withAlpha(BEAD_SHADOW_HEX, TIMER_CAPSULE_SHADOW_ALPHA),
    radius: TIMER_CAPSULE.radius,
  });
  builder.rect(capLeft, capBottom, TIMER_CAPSULE.w, TIMER_CAPSULE.h, {
    fill: palette.panel,
    stroke: palette.panelBorder,
    lineWidth: 1,
    radius: TIMER_CAPSULE.radius,
  });

  // GAP-10 倒计时告急三通道（§3.8「图标+颜色+脉冲」）：色由 accent_blue→danger，
  // 补 α 脉冲；F7① 后时钟图标住胶囊内（环/针 accent_blue 3px，Ø36）。
  const a = snap.urgent ? dangerAlpha(snap.pulseClock, snap.reduceMotion) : 1;
  const timerColor = snap.urgent ? palette.danger : palette.text;
  const iconColor = snap.urgent ? palette.danger : palette.hintBlue;
  const icx = DESIGN_W / 2 - TIMER_CAPSULE.w / 2 + 48;
  const iconStroke = withAlpha(iconColor, a);
  const iconR = CLOCK_ICON_DIA / 2;
  builder.circle(icx, midY, iconR, { stroke: iconStroke, lineWidth: 3 });
  builder.line(icx, midY, icx, midY + iconR * 0.55, iconStroke, 3); // 分针
  builder.line(icx, midY, icx + iconR * 0.45, midY, iconStroke, 3); // 时针

  builder.text(DESIGN_W / 2 + 14, midY, formatTime(snap.remaining), {
    fill: timerColor,
    font: FONT.timer,
    align: 'center',
    baseline: 'middle',
    alpha: a,
  });

  // F7② 设置齿轮（左）：accent_purple 8 齿 Ø48（hub r13 + 齿线 r13→r21 w6 +
  // 中心孔 r5 填 panel_surface）；v1.2「circle+中心点」作废。热区 88×88 归 game（S2）。
  drawGear(builder, 60, midY, palette);

  // Mode / stage label（F7⑤：最小字号 28px；冷底小字用 text_primary，§3.1 行 58
  // 「text_secondary 冷底禁用」）。右对齐到屏右 30 边距。
  // BD-46（WXG-T-127）：原锚 DESIGN_W−220 距白胶囊右缘（485）仅 45px，而 28px
  // 「STAGE 1」实测宽 ≈117px ⇒ 左段白字压白胶囊隐形、读成「AGE 1」。锚到
  // DESIGN_W−30 后最宽情形（35px「STAGE 10」≈146px，左缘 ≈574）仍净空胶囊 ≥89px。
  const label =
    snap.mode === 'sprint' ? `STAGE ${snap.stageIndex + 1}` : `LV ${snap.levelIndex + 1}/${snap.levelCount}`;
  builder.text(DESIGN_W - 30, midY, label, {
    fill: palette.text,
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
        fill: palette.accentPrimary, // F6：连击倍率字 → 中性强调（§3.5）
        font: FONT.hud,
        align: 'center',
        baseline: 'middle',
      });
    }
  }
}

/** F7② 8 齿齿轮（accent_purple，Ø48）：hub + 均匀齿线 + 中心孔（程序化，零资产）。 */
function drawGear(builder: RenderModelBuilder, cx: number, cy: number, palette: BeadsPalette): void {
  for (let i = 0; i < GEAR_TEETH; i++) {
    const deg = ((i * 360) / GEAR_TEETH + 22.5) * (Math.PI / 180); // 半齿偏移避免针朝正上
    const cos = Math.cos(deg);
    const sin = Math.sin(deg);
    builder.line(cx + GEAR_TEETH_R0 * cos, cy + GEAR_TEETH_R0 * sin, cx + GEAR_TEETH_R1 * cos, cy + GEAR_TEETH_R1 * sin, palette.accentPurple, GEAR_TEETH_W);
  }
  builder.circle(cx, cy, GEAR_HUB_R, { fill: palette.accentPurple });
  builder.circle(cx, cy, GEAR_HOLE_R, { fill: palette.panel });
}

function formatTime(seconds: number): string {
  // BD-47（WXG-T-127）：秒必须取整 —— 上游任何浮点尾数（如 170.1999999999…）
  // 都不得漏进 mm:ss 显示。floor 是兜底层；快照层（clearRemaining）同日取整。
  const total = Math.floor(Math.max(0, seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ──────────────────────────────────────────────────────────────────── grid

function drawGrid(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
  inks: BeadInks,
): void {
  // G1 `vfx_fill_pop`（WXG-T-128）：包络槽在**循环外**建一次（整帧共用，同一时刻至多一颗珠在落座）。
  const pop: FillPopEnvelope = {
    scale: 1,
    contactAlpha: 0,
    contactWidth: 0,
    shadowAlpha: 0,
    shadowDy: 0,
  };
  // G4 `vfx_complete_wave`（WXG-T-146）：同样**循环外**建槽，逐列覆写。
  // D1（`reduceMotion`）= 整条关停（§1.6.4）：合法性 = 结算面板本身即信息通道（A6）。
  const wave: WaveEnvelope = { scale: 1, dy: 0, active: false };
  const waveT = snap.waveProgress > 0 && !snap.reduceMotion ? snap.waveProgress * WAVE_MS : -1;
  const waveWindow = waveWindowMs(snap.gridCols);
  // G2′ `vfx_solver_restore`（WXG-T-150 / §1.6.2a）：快照只给单调标量 ⇒ 绝对毫秒
  // 由**单一真源公式** `solverSequenceMs(count)` 还原（不在本文件重列公式）。
  // ⚠️ 相 A 不受 `reduceMotion` 关停（纯 α 通道，§1.6.2a D1 行）；相 B 的曲线退化
  // 已包在 `fillPopEnvelope` 里。`solverT < 0` = 本帧无序列。
  const solverN = snap.solverCellCount;
  const solverT = solverN > 0 && snap.solverProgress > 0 ? snap.solverProgress * solverSequenceMs(solverN) : -1;
  const solverHintA = solverT > 0 ? solverHintAlpha(solverT) : 0;
  for (let i = 0; i < snap.gridRows; i++) {
    for (let j = 0; j < snap.gridCols; j++) {
      const cell = snap.cells[i * snap.gridCols + j]!;
      if (cell.void) continue; // outside the pattern shape — background
      const cx = snap.gridLeft + snap.gridCell / 2 + snap.gridPitch * j;
      const cy = snap.gridTop - snap.gridCell / 2 - snap.gridPitch * i;
      // 格心可视窗剔除（丁-3 免 clip）。恒等档所有格心都在带内 ⇒ 零剔除，快照逐位不变。
      if (
        cy < PUZZLE_BAND.yMin - snap.gridCell ||
        cy > PUZZLE_BAND.yMax + snap.gridCell ||
        cx < -snap.gridPitch ||
        cx > DESIGN_W + snap.gridPitch
      ) {
        continue;
      }

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
        // G7 轻压（WXG-T-152 / §1.6.7）：locked 无垫 ⇒ scale 走 `size` 形参即安全通道
        //（只缩不胀 ⇒ 零重叠）；D1 退为 1px `slot_border` 静态环（game 侧 120ms 清）。
        const deniedP = deniedProgressAt(snap, i, j);
        drawLockedBead(
          builder,
          bx,
          cy,
          palette,
          deniedP > 0 && !snap.reduceMotion ? snap.gridCell * deniedPressScale(deniedP) : snap.gridCell,
        );
        if (deniedP > 0 && snap.reduceMotion) {
          drawStateRing(builder, bx, cy, snap.gridCell, palette.slotBorder, 1, DENIED_RING_LINEWIDTH);
        }
        continue;
      }

      if (cell.state === 'empty') {
        // B0 连续目标色底图（v1.5-r8）：与 filled 分支同一块 `edge` 图元 ⇒ 有豆/无豆一张图。
        // 边长传 `snap.gridPitch` = 缩放后的实际格距（ADR-0020 附录 A 甲案 / WXG-T-206）。
        drawTargetTile(builder, bx, cy, cell.colorIdx, inks, snap.gridPitch);
        // 空格 = 在这张底图上**挖洞**（pit 内缩 + 暗缘 + 下受光）；自带的亮 `base` 外块
        // 由 `tilePainted = true` 跳过。旧注释里的“E4 幽灵符号”已随 WXG-T-130 降档移除。
        drawEmptySocket(builder, bx, cy, palette, snap.gridCell, cell.colorIdx, inks, true);
        // GAP-03/04 引导：单一目标格 `hint` 蓝描边呼吸（叠加优先级：外描边 > E2 > E1）。
        if (snap.onboarding && i === snap.hintRow && j === snap.hintCol) {
          drawStateRing(builder, bx, cy, snap.gridCell, palette.hintBlue, hintAlpha(snap.pulseClock, snap.reduceMotion));
        }
        // GAP-04 `wrong`：danger 描边**单次脉冲**（与抖动同格同帧，WXG-T-102/BD-29）。
        if (isWrong) {
          // D1 减弱动效：单次脉冲 → 静态红描边（α 恒 1，**0 往复**；200ms 由 game 侧清除）。
          const flash = snap.reduceMotion ? 1 : wrongFlashAlpha(snap.wrongProgress);
          drawStateRing(builder, bx, cy, snap.gridCell, palette.danger, flash);
        }
        // BD-16（WXG-T-097）一次性轻提示：落在被点的**可落空格**格心（ux-spec §5）。
        // 只在 empty 分支画 ⇒ 天然满足 `input-control §8-5`（锁定/已填格零反馈帧）。
        if (
          snap.tapHintText &&
          snap.tapHintAnchor === 'cell' &&
          i === snap.tapHintRow &&
          j === snap.tapHintCol
        ) {
          builder.text(bx, cy, snap.tapHintText, {
            fill: withAlpha(palette.text, 0.9),
            font: bodyFont(snap, 'sub'),
            align: 'center',
            baseline: 'middle',
          });
        }
        continue;
      }

      // Filled bead — v1.5-r5 垫色显缝：珠色用 beadColorIdx（错位珠 ≠ 底色 ⇒
      // 「歪在垫上」可视化），垫 = colorIdx 底色（L11，WXG-T-142）。
      // G1 落座回弹（WXG-T-128）：单格、相位由 game 侧单调标量驱动（L5 ⇒ 视图不持状态）。
      //   ⛔ scale 只进珠体：`padColorIdx` 走 `outer`、**不参与 scale**（§1.6.1 层序死结论）。
      const isPop = i === snap.placeRow && j === snap.placeCol && snap.placeProgress > 0;
      // G4 波浪**先算**：本列正在弹跳时让 G1 落座回弹让位 —— 两者不叠加，
      // 否则重叠窗口（≤120ms）会产出「波浪 scale + 落座 α/宽比」的错配帧。
      if (waveT > 0) waveEnvelope(j, waveT, waveWindow, wave);
      const isWave = wave.active;
      const popActive = isPop && !isWave;
      // G2′ 相 B：本格若是落座格 ⇒ 走**逐颗队列**通道（每颗一份完整 120ms 包络、
      // 由 `SOLVER_STAGGER_MS` 错位起播），与 G1 单槽互斥（game 侧已保证不重叠）。
      const solverStep = solverLandStep(snap, i, j);
      const solverPopP = solverStep >= 0 && solverT > 0 ? solverBeadProgress(solverT, solverStep) : 0;
      const popProgress = solverPopP > 0 ? solverPopP : popActive ? snap.placeProgress : 0;
      if (popProgress > 0) fillPopEnvelope(popProgress, snap.reduceMotion, pop);
      // WXG-T-148 用户反馈 ②：board 锚珠抬起（lift 沿用托盘 selected 语义，垫不
      // 参与 lift ⇒ 珠上移露垫 = 抬起读数）；③④ 锚 = 8 邻接连通错位珠组 ⇒ 组内全格统一抬起。
      // （原反馈 ①「错位珠恒亮白环」经真机首验用户裁定移除，见 WXG-T-165。）
      let inGroup = false;
      for (let k = 0; k < snap.boardGroupCount; k++) {
        if (snap.boardGroupRows[k] === i && snap.boardGroupCols[k] === j) {
          inGroup = true;
          break;
        }
      }
      // FilledBeadOptions 全只读 ⇒ 组装为可变草稿再定型的既有模式（零类分配）。
      const draft: {
        -readonly [K in keyof FilledBeadOptions]: FilledBeadOptions[K];
      } = { targetColorIdx: cell.colorIdx, size: snap.gridCell, inks };
      if (inGroup) {
        // §5 v1.5-r10：抬起走 120ms ease-out 斜坡（时长复用 G1 `FILL_POP_MS`）。
        // D1(`reduceMotion`) ⇒ 进格直接归 1（无斜坡、无往复），与其余动效同口径。
        draft.lift =
          SELECT_LIFT_PX *
          (snap.reduceMotion ? 1 : easeOutQuad(snap.liftProgress));
        draft.shadowAlpha = SELECTED_SHADOW_ALPHA;
      }
      // G2′ 相 A：点名格在预警窗口内**仍是错位珠**（裁定「甲」⇒ 动手延后），
      // 「动手目标」标识由相 A 状态环独占（下方 drawStateRing）。
      const named = solverN > 0 && solverHintA > 0 && solverIsNamed(snap, i, j);
      if (popProgress > 0) {
        draft.scale = pop.scale;
        draft.contactAlpha = pop.contactAlpha;
        draft.contactWidth = pop.contactWidth;
        draft.shadowAlpha = pop.shadowAlpha;
        draft.shadowDy = pop.shadowDy;
      }
      // ADR-0017 甲案 · zoom 自适应 LOD：珠屏幕径低于阈值时走降层集（game 侧已带
      // 滞回算好，视图只读）⇒ fit 档大盘每帧命令从 ~2900 降到 ~1900。
      if (snap.beadLodLayers > 0) draft.lodLayers = snap.beadLodLayers;
      // G4 波浪（逐列，错峰 20ms）：只给 **scale + dy**（`L0a/L0b` **不做 α 联动** —— §1.6.4
      // 几何行：集体波浪逐颗联动会让 CPU 与视觉都变噪，只保形变）+ 本卡降档 `lodLayers`。
      // ⛔ 垫不参与：`scale` 仅珠体、`lift` 不带动 L11（§1.6.1 层序死结论）。
      if (isWave) {
        draft.scale = wave.scale;
        draft.lift = wave.dy; // y 轴向上 ⇒ +dy = 微抬
        draft.lodLayers = WAVE_BEAD_LOD_LAYERS; // C7 拆名：波浪降档专用名（zoom LOD = ZOOM_LOD_LAYERS）
      }
      // G7 轻压（§1.6.7）：就位格。优先级 pop/wave > denied（同格重叠窗口让位；
      // 实际上就位格不会进 pop/wave，防御性排序）。scale 只进珠体 = `draft.scale`
      //（G1 同通道，⛔ 不乘 outer ⇒ L11 垫不参与，§1.6.1 层序死结论）；D1 退环无 scale。
      const deniedP = popProgress <= 0 && !isWave ? deniedProgressAt(snap, i, j) : 0;
      if (deniedP > 0 && !snap.reduceMotion) {
        draft.scale = deniedPressScale(deniedP);
      }
      const opts: FilledBeadOptions = draft;
      // B0 连续目标色底图：与 empty 分支同图元同色档 ⇒ 整片谜面一张图（v1.5-r8）。
      // ⛔ 锁格心、不吃 lift / scale / pop 包络（§1.6.1 P0 陷阱 #2）。
      // 边长同上：= 缩放后格距，与 `opts.size`（`snap.gridCell`）同尺（ADR-0020 甲案）。
      drawTargetTile(builder, bx, cy, cell.colorIdx, inks, snap.gridPitch);
      drawFilledBead(builder, bx, cy, cell.beadColorIdx || cell.colorIdx, opts);
      // 相 A 状态环：叠在珠体之上（同 `wrong` / `hint` 判例，最顶层）。
      // 候选 I 墨 = `palette.slotBorder`（§1.6.2a）⇒ 非 danger/hint 色，不抢玩法语义。
      if (named) {
        drawStateRing(builder, bx, cy, snap.gridCell, palette.slotBorder, solverHintA);
      }
      // G7 D1 退化环：同墨同线宽（§1.6.7 候选甲：size 50、α 恒 1、0 往复）。
      if (deniedP > 0 && snap.reduceMotion) {
        drawStateRing(builder, bx, cy, snap.gridCell, palette.slotBorder, 1, DENIED_RING_LINEWIDTH);
      }
    }
  }
  // DEBUG 轮廓（`setDebugOutlines`）：主循环**之上**再叠一层，压在面板下、格内容之上。
  if (snap.debugOutlines) {
    for (let i = 0; i < snap.gridRows; i++) {
      for (let j = 0; j < snap.gridCols; j++) {
        const cell = snap.cells[i * snap.gridCols + j]!;
        if (cell.void) continue;
        const cx = snap.gridLeft + snap.gridCell / 2 + snap.gridPitch * j;
        const cy = snap.gridTop - snap.gridCell / 2 - snap.gridPitch * i;
        drawDebugCellOutline(builder, cx, cy, snap.gridCell);
      }
    }
  }
  // DEBUG 性能覆层（`setDebugInfo`，pause-settings v1.6 §2.2）：主循环之上**最后一层**
  // （连暂停面板也盖住——测量口径：面板开合不丢帧样本）。半透明窄面板而非全屏
  // scrim：全屏 α 覆盖会改变 fill 负载，D2 的测量就不干净了。仅开关开启才走
  // 本分支，正常玩法零调用（本分支内的模板串分配属 debug 工具，可接受）。
  if (snap.debugInfo) {
    const fps = snap.perfFrameMs > 0 ? Math.round(1000 / snap.perfFrameMs) : 0;
    builder.rect(12, DESIGN_H - 148, 316, 136, {
      fill: `rgba(${PANEL_SCRIM_RGB.r},${PANEL_SCRIM_RGB.g},${PANEL_SCRIM_RGB.b},0.7)`,
      radius: 12,
    });
    const line = (y: number, text: string): void => {
      builder.text(28, y, text, {
        fill: palette.text,
        font: FONT.panelToggle,
        align: 'left',
        baseline: 'middle',
      });
    };
    line(DESIGN_H - 38, `fps ${fps} · ${snap.perfFrameMs.toFixed(1)} ms`);
    line(
      DESIGN_H - 76,
      `${snap.phase} · ${snap.mode === 'sprint' ? '冲刺' : `L${snap.levelIndex + 1}`}`,
    );
    line(DESIGN_H - 114, `pitch ${snap.gridPitch.toFixed(1)} · LOD ${snap.beadLodLayers}`);
  }
}

// ──────────────────────────────────────────────────────────────────── tray

/**
 * G2′ 相 A：本格是否在被点名清单里。
 * 线性扫 ≤ `SOLVER_MAX_CELLS`（=3）⇒ 不建 Set / 不分配（热路径零分配）。
 */
function solverIsNamed(snap: BeadsSnapshot, row: number, col: number): boolean {
  for (let k = 0; k < snap.solverCellCount; k++) {
    if (snap.solverCellRows[k] === row && snap.solverCellCols[k] === col) return true;
  }
  return false;
}

/**
 * G7 轻压（WXG-T-152 / §1.6.7）：本格在播轻压的进度（`0` = 无）。
 * 线性扫定长数组 ⇒ 零分配；空槽/过窗槽已由 game 侧写为 `row = -1`（不会误匹配）。
 */
function deniedProgressAt(snap: BeadsSnapshot, row: number, col: number): number {
  const rows = snap.deniedRows;
  for (let k = 0; k < rows.length; k++) {
    if (rows[k] === row && snap.deniedCols[k] === col) return snap.deniedProgress[k]!;
  }
  return 0;
}

/** G2′ 相 B：本格的落座序号（`-1` = 不在本序列的落座格里）。同样线性扫（≤6）。 */
function solverLandStep(snap: BeadsSnapshot, row: number, col: number): number {
  for (let k = 0; k < snap.solverLandCount; k++) {
    if (snap.solverLandRows[k] === row && snap.solverLandCols[k] === col) {
      return snap.solverLandSteps[k]!;
    }
  }
  return -1;
}


/** 「微拱白瓷」三段内阴影（§1.3 v1.5；几何/α = `tuning.TRAY_PLATE`）。 */
function drawTrayPlateShading(
  builder: RenderModelBuilder,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const ink = TRAY_PLATE.ink;
  // 底缘外段（α 0.03）。
  builder.line(x, y + h - TRAY_PLATE.width, x + w, y + h - TRAY_PLATE.width, withAlpha(ink, TRAY_PLATE.bottomOuterAlpha), TRAY_PLATE.width);
  // 底缘内段（α 0.05）。
  builder.line(x, y + h - TRAY_PLATE.width * 2, x + w, y + h - TRAY_PLATE.width * 2, withAlpha(ink, TRAY_PLATE.bottomInnerAlpha), TRAY_PLATE.width);
  // 右缘段（α 0.02）。
  builder.line(x + w - TRAY_PLATE.width, y, x + w - TRAY_PLATE.width, y + h, withAlpha(ink, TRAY_PLATE.rightAlpha), TRAY_PLATE.width);
}
function drawTray(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
  inks: BeadInks,
): void {
  const rows = Math.ceil(snap.traySlots.length / TRAY_COLS);
  // 基础（已开放）行数 —— 虚线语言**只属于扩展行**（`TRAY_BASE_SLOTS` 之后追加的行）。
  const baseRows = Math.ceil(TRAY_BASE_SLOTS / TRAY_COLS);
  // 几何单一真源（§3.4 v1.20）：与 S2 命中测试共用 `trayLayout()`。
  const lay = trayLayout(rows);

  // White rounded panel behind the slots（面板**贴上沿** ⇒ 带下沿让给 `btn_expand`）。
  builder.rect(lay.panelX, lay.panelBottom, lay.panelW, lay.panelH, {
    fill: palette.panel,
    radius: 18,
  });
  // 「微拱白瓷」三段内阴影（§1.3 v1.5，WXG-T-131/143）：底缘两段 + 右缘一段 ——
  // 平面板的轻体积感；α 极低（0.03/0.05/0.02），不与满槽告警危险描边竞争。
  drawTrayPlateShading(builder, lay.panelX, lay.panelBottom, lay.panelW, lay.panelH);

  for (let idx = 0; idx < snap.traySlots.length; idx++) {
    const slot = snap.traySlots[idx]!;
    const row = Math.floor(idx / TRAY_COLS);
    const col = idx % TRAY_COLS;
    const cx = lay.slotCenterX(col);
    const cy = lay.slotCenterY(row);
    const slotBottom = cy - TRAY_SLOT / 2;
    // WXG-T-168：旧式 `row > 0` 把**基础容量的第 2 行**也画成虚线 ⇒ 玩家把已开放
    // 的行误读成「未解锁/虚位」（正是上一轮「以为容量只有 12」的视觉来源）。
    const dashed = row >= baseRows;

    if (slot.state === 'free') {
      if (dashed) {
        // RenderModel has no dash stroke — synthesize 6/4 segments (arch §4).
        drawDashedRect(builder, cx - TRAY_SLOT / 2, slotBottom, TRAY_SLOT, TRAY_SLOT, palette.slotBorder);
      } else {
        drawEmptySocket(builder, cx, cy, palette, TRAY_SLOT);
      }
      continue;
    }

    const selected = slot.state === 'selected';
    // Selected: lift 4px + darker L0 shadow + indicator dot (§1.2 selected row).
    // §5 v1.5-r10：与板锚组共用 `liftProgress` ⇒ 不会出现“板上的珠在抬、托盘的珠瞬跳”。
    const lift = selected
      ? TRAY_SELECTED_LIFT_PX *
      (snap.reduceMotion ? 1 : easeOutQuad(snap.liftProgress))
      : 0;
    drawFilledBead(builder, cx, cy, slot.colorIdx, {
      size: TRAY_BEAD_SIZE,
      lift,
      inks,
      ...(selected ? { shadowAlpha: SELECTED_SHADOW_ALPHA } : {}),
    });
    if (selected) {
      // F6：选中点 → accent_blue（§3.5 环状提示 ≤8px 圆点；暖橙仅存珠子本体）。
      builder.circle(cx, slotBottom - 8, 4, { fill: palette.hintBlue });
    }
    // GAP-03 引导：首珠所在槽外描边脉冲呼吸（与目标格 `hint` 同周期、同色）。
    if (snap.onboarding && idx === snap.guideSlot) {
      drawStateRing(builder, cx, cy, TRAY_SLOT, palette.hintBlue, hintAlpha(snap.pulseClock, snap.reduceMotion));
    }
  }

  // BD-10（WXG-T-097）满槽告警：沿面板边缘 2px `danger` 描边 + 500ms α 呼吸
  // （`ux-spec §5`「满槽告警」行 / `assets-spec §1.5 tray_panel_danger`）。
  // 不持状态（L5）：「满」由 `traySlots` 派生；本通道也让 `timer-gameover §8-10`
  // 的「同屏叠加无 >3Hz」半条有了第二主体可测。
  let freeSlots = 0;
  for (let idx = 0; idx < snap.traySlots.length; idx++) {
    if (snap.traySlots[idx]!.state === 'free') freeSlots++;
  }
  if (snap.traySlots.length > 0 && freeSlots === 0) {
    builder.rect(lay.panelX, lay.panelBottom, lay.panelW, lay.panelH, {
      stroke: palette.danger,
      lineWidth: 2,
      radius: 18,
      alpha: trayFullAlpha(snap.pulseClock, snap.reduceMotion),
    });
  }
}

/**
 * `btn_expand`（§1.3 / §3.4 v1.20）：带下沿居底的 132×48 暗色胶囊 + ▶ 12px +
 * 「扩展」28px 白字，右上角常驻 `ad_badge`（`AD_PLACEMENTS` 四位之一）。
 *
 * 命中框 = 132×**88**（`accessibility C1`「视觉不变、热区扩大」），与渲染同源
 * `expandButtonLayout()` ⇒ 不存在「画出的框 ≠ 点击落点」漂移（WXG-T-062 判例）。
 * 零 wx API、零解锁行为（`powerups §2.6` 布局 A）。
 */
function drawExpandButton(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  palette: BeadsPalette,
): void {
  // v1.25（WXG-T-143）：扩展后按钮隐藏 —— 4 行托盘面板（y∈[216,450]）完整覆盖
  // 其热区 [230,318]，继续绘制会与 row2/row3 槽位视觉重叠（参考视频同款：用后即收）。
  if (snap.trayExpanded) return;
  const btn = expandButtonLayout();
  const cy = btn.bottom + btn.h / 2;
  builder.rect(btn.x, btn.bottom, btn.w, btn.h, {
    fill: EXPAND_BTN_INK,
    radius: EXPAND_BTN_RADIUS,
  });

  // `ad_badge`（§1.4：28×28 圆角 8、右上角内缩 8,8、白 ▶ 边 10）——与三张道具卡同 token。
  const badgeX = btn.x + btn.w - POWERUP_BADGE_INSET - POWERUP_BADGE_SIZE;
  const badgeY = btn.bottom + btn.h - POWERUP_BADGE_INSET - POWERUP_BADGE_SIZE;
  builder.rect(badgeX, badgeY, POWERUP_BADGE_SIZE, POWERUP_BADGE_SIZE, {
    fill: palette.adBadge,
    radius: POWERUP_BADGE_RADIUS,
  });
  const bgx = badgeX + POWERUP_BADGE_SIZE / 2;
  const bgy = badgeY + POWERUP_BADGE_SIZE / 2;
  const bedge = POWERUP_BADGE_GLYPH_EDGE;
  builder.polygon(
    [bgx - bedge / 2, bgy - bedge / 2, bgx - bedge / 2, bgy + bedge / 2, bgx + bedge / 2, bgy],
    { fill: POWERUP_BADGE_GLYPH },
  );

  // ▶ + 文字整体在**角标以外**的剩余区间居中（132 宽内角标占右侧 36px）。
  const groupW = EXPAND_BTN_GLYPH_EDGE + EXPAND_BTN_GLYPH_GAP + EXPAND_BTN_LABEL_W;
  const groupLeft = btn.x + (badgeX - btn.x - EXPAND_BTN_GLYPH_GAP - groupW) / 2;
  const gx = groupLeft + EXPAND_BTN_GLYPH_EDGE / 2;
  const edge = EXPAND_BTN_GLYPH_EDGE;
  builder.polygon(
    [gx - edge / 2, cy - edge / 2, gx - edge / 2, cy + edge / 2, gx + edge / 2, cy],
    { fill: EXPAND_BTN_TEXT },
  );
  builder.text(groupLeft + edge + EXPAND_BTN_GLYPH_GAP, cy, EXPAND_BTN_LABEL, {
    fill: EXPAND_BTN_TEXT,
    // §1.3 写定 28px 按钮字；E2 大字号只放大正文/说明类（见 `bodyFont` 注）。
    font: FONT.sub,
    align: 'left',
    baseline: 'middle',
  });

  // BD-15（WXG-T-097）占位轻提示：同一轻提示通道，落在按钮正下方的空白带隙。
  if (snap.tapHintText && snap.tapHintAnchor === 'expand') {
    builder.text(DESIGN_W / 2, AD_HINT_TEXT_Y, snap.tapHintText, {
      fill: withAlpha(palette.text, 0.9),
      font: bodyFont(snap, 'sub'),
      align: 'center',
      baseline: 'middle',
    });
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
    fill: withAlpha(STAR_GOLD, 0.22), // F6：缎带金 → STAR_GOLD（资产色，暖橙让位）。
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
      fill: STAR_GOLD, // F6：完成星 → STAR_GOLD（结算场景珠面不在场，无 §3.5 冲突）。
    });
  }

  // 次要信息（ux-spec §3.4 第三行）。
  builder.text(
    DESIGN_W / 2,
    layout.infoY,
    `剩余 ${formatTime(snap.clearRemaining)} ｜ 道具 ${snap.clearPowerupsUsed}/${POWERUP_TYPES.length} ｜ ${snap.clearActions} 动作（${snap.clearTaps} 击）`,
    { fill: palette.textDim, font: bodyFont(snap, 'sub'), align: 'center', baseline: 'middle' },
  );

  // 主/副双钮：主钮 accent_primary 白字（F6：金底作废，§3.5 中性强调），副钮白底深字；
  // 文案归 `clear-panel.ts`。
  for (const button of layout.buttons) {
    const bw = button.rect.xMax - button.rect.xMin;
    const bh = button.rect.yMax - button.rect.yMin;
    const primary = button.id === 'next';
    builder.rect(button.rect.xMin, button.rect.yMin, bw, bh, {
      fill: primary ? palette.accentPrimary : palette.panel,
      stroke: primary ? palette.accentPrimary : palette.slotBorder,
      lineWidth: 1,
      radius: 20,
    });
    builder.text(
      button.rect.xMin + bw / 2,
      button.rect.yMin + bh / 2,
      clearPanelLabel(button.id, snap.clearLastLevel),
      {
        fill: primary ? palette.panel : palette.text, // F6：主钮白字（深藏青底）。
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
 * **Lv2（伪震屏）不在本函数画**：它的呈现量是**整屏 scale**，由 `buildBeadsView` 头部经
 * 框架全局变换通道下发（`WXG-T-132` 案 B 已落地；历史缺口 `WXG-T-074` 就此收口）。
 * 快照里 `comboVfxProgress` 照常推进，本函数对其**零图元**（变换不增命令，§7.3.5）。
 * 红线：三档都是**单次循环**，本函数无任何周期量 ⇒
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
    const cx = snap.gridLeft + snap.gridCell / 2 + snap.gridPitch * snap.comboVfxCol;
    const cy = snap.gridTop - snap.gridCell / 2 - snap.gridPitch * snap.comboVfxRow;
    for (const { x, y } of comboParticleOffsets(p)) {
      builder.circle(cx + x, cy + y, 3 + snap.gridCell * 0.1 * (1 - p), {
        fill: withAlpha(BEAD_HIGHLIGHT_HEX, 1 - p), // F6：连击光 → 白（§3.5 暖橙仅珠子本体）。
      });
    }
    return;
  }

  if (snap.comboVfxKind === 'burst') {
    const { radial, wave } = comboBurst(p);
    // 边缘径向光：四边各一条随 radial 亮起的色条（程序化，零外部资产）。
    builder.rect(0, 0, DESIGN_W, 12, { fill: withAlpha(BEAD_HIGHLIGHT_HEX, 0.55 * radial) });
    builder.rect(0, DESIGN_H - 12, DESIGN_W, 12, { fill: withAlpha(BEAD_HIGHLIGHT_HEX, 0.55 * radial) });
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

  // 'pseudoShake'：零图元——整屏 scale 已由 `buildBeadsView` 头部的全局变换通道呈现（T-132）。
}

// ───────────────────────────── G3 道具生效扫光（assets-spec §1.6.3 · WXG-T-146）

/**
 * G3 `vfx_powerup_sweep`：道具生效时一道 20° 斜切光带自屏外左侧扫到屏外右侧。
 * 三层平行四边形（广→中→核心），α 单调递减、累计 0.27（< 遮罩 0.5 一整档）。
 *
 * ⚠️ **层序事实与规格不符、但结论仍成立**：规格写「在 drawGrid/drawTray 之后、**drawHud 之前**
 * ⇒ 被 HUD 压住」，而实码 `drawHud` 在 grid **之前**（= 更底层）。不影响合规，因为
 * `SWEEP_Y_MAX = HUD_BAND.yMin` 已从**几何上**排除 HUD 带（用户裁定的「玩法全屏」）。
 * D1（`reduceMotion`）= **整条关停**：纯包装层、零信息量（§1.6.3）。
 */
function drawSweep(builder: RenderModelBuilder, snap: BeadsSnapshot): void {
  if (snap.sweepProgress <= 0 || snap.reduceMotion) return;
  const cx = sweepCenterX(snap.sweepProgress);
  // 反序绘制：i = 2 广（α0.06）→ 1 中（0.10）→ 0 核心（0.14）⇒ 后画的更亮。
  // 逐层新建 8-float 数组是**历史约束**：`[WXG-T-211-A / ADR-0024]` 起 `polygon()` 在建令
  // 当刻把顶点拷进帧内 arena（值语义），共用 scratch 不再串形。现写法保留（本单只改
  // 载荷语义，不动出图路径），且仅在 400ms 窗口内分派（与 `drawPowerupBand` 逐帧字面量同判例）。
  for (let i = SWEEP_LAYER_COUNT - 1; i >= 0; i--) {
    builder.polygon(sweepQuad(i, cx, [0, 0, 0, 0, 0, 0, 0, 0]), {
      fill: withAlpha(BEAD_HIGHLIGHT_HEX, SWEEP_ALPHAS[i]!),
    });
  }
}

// ───────────────────────────── G6 结算彩带（assets-spec §1.6.6 · WXG-T-153）

/** 逐帧复用的标量态槽（只被同步读取，命令不持本对象 ⇒ 热路径零分配）。 */
const CONFETTI_SCRATCH: ConfettiBeadState = { x: 0, y: 0, theta: 0, alpha: 0 };

/**
 * 【WXG-T-128 裁定 B（用户 2026-09-17）】规格「预分配 352-float scratch」的**真实现**：
 * 44 枚 × 8 floats 一次性预分配，每枚固定占 `[idx×8, idx×8+8)` 段、逐帧整段重写；
 * `polygon()` 收 `subarray` 视图。`[WXG-T-211-A / ADR-0024]`：该视图现在**建令当刻被
 * 拷进帧内 arena**（值语义），旧契约注的「当帧构建、当帧消费 / 跨帧不得改写」纪律作废；
 * 预分配本身仍有效——它省下的是每帧 44 次数组分配。
 * 兑现 `assets-spec §1.6.6` 落码回写注的待裁差异（原「逐枚新建 8-float」作废）。
 */
const CONFETTI_POINTS = new Float32Array(CONFETTI_COUNT * 8);

/**
 * G6 `vfx_confetti`：结算面板入场期 44 枚程序化彩带（零 RNG，idx 派生）。
 * 两层 sandwich（层序死规格）：MAIN 在 `drawClearPanel` 前（scrim 压住），FG 在后；
 * FG 枚当 y ∈ [447,787]（按钮行/缎带，`clearPanelLayout` 派生）**跳过绘制** ⇒ 保按钮可辨识；
 * MAIN 不受限。D1（`reduceMotion`）= **整条关停**（纯装饰、零信息量，§1.6.6）。
 * 点列 = 预分配 `CONFETTI_POINTS` 的固定段（裁定 B，见上）；只在 800ms 窗口内分派。
 */
function drawConfetti(
  builder: RenderModelBuilder,
  snap: BeadsSnapshot,
  foreground: boolean,
): void {
  const p = snap.confettiProgress;
  if (p <= 0 || snap.reduceMotion) return;
  for (let idx = 0; idx < CONFETTI_COUNT; idx++) {
    if (confettiIsForeground(idx) !== foreground) continue;
    const f = confettiFrame(idx, p, CONFETTI_SCRATCH);
    // 禁飞带：不是淡出，是不画（可读性硬约束，accessibility C1）。
    if (foreground && f.y >= CONFETTI_NOFLY_YMIN && f.y <= CONFETTI_NOFLY_YMAX) continue;
    if (f.alpha <= 0) continue;
    confettiQuad(f.x, f.y, f.theta, CONFETTI_POINTS, idx * 8);
    builder.polygon(CONFETTI_POINTS.subarray(idx * 8, idx * 8 + 8), {
      fill: withAlpha(CONFETTI_COLORS[idx % CONFETTI_COLORS.length]!, f.alpha),
    });
  }
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
  const bands = [palette.accentPrimary, palette.adBadge, palette.accentPrimary]; // F6：暖橙→中性强调。
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
    { fill: STAR_GOLD, font: bodyFont(snap, 'sub'), align: 'center', baseline: 'middle' }, // F6：星数金。
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
        fill: k < stars ? STAR_GOLD : withAlpha(palette.slotBorder, 0.45), // F6：结算星金。
      });
    }
  }

  // 主 / 副双钮：主钮 = 「重玩第 1 关」（`core-loop §4` 本状态的推进出口），
  // 副钮 = 「回主菜单」（go-menu 同语义，core-loop v2.3；U1 去冲刺仍隐藏）。
  for (const button of layout.buttons) {
    const bw = button.rect.xMax - button.rect.xMin;
    const bh = button.rect.yMax - button.rect.yMin;
    const primary = button.id === 'replay';
    builder.rect(button.rect.xMin, button.rect.yMin, bw, bh, {
      fill: primary ? palette.accentPrimary : palette.panel, // F6：主钮 → accent_primary。
      stroke: primary ? palette.accentPrimary : palette.slotBorder,
      lineWidth: 1,
      radius: 20,
    });
    builder.text(
      button.rect.xMin + bw / 2,
      button.rect.yMin + bh / 2,
      finishPanelLabel(button.id),
      {
        fill: primary ? palette.panel : palette.textDim, // F6：主钮白字（深藏青底）。
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
