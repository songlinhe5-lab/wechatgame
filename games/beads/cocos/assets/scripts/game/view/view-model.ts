/**
 * Beads view model — snapshot → draw commands.
 *
 * Pure function of the snapshot: same snapshot in, same commands out
 * (control-manifest §8; never mutates the game). Layout geometry lives in
 * `config/tuning.ts`; the play scene (HUD / board / tray / powerups / zoom)
 * moved to `view/play-page.ts` under UI-41. This file keeps the **门面**
 * `buildBeadsView` (§9-4) and the modal layers drawn above it:
 * pause / clear / fail / sprint-settle / finish / banners + confetti sandwich.
 */

import type { RenderModelBuilder } from '../../framework/index';
import {
  CLEAR_STAR_SIZE,
  DESIGN_W,
  FINISH_ROW_H,
  FINISH_ROW_W,
  FINISH_STAR_SIZE,
  PANEL_PADDING,
  POWERUP_TYPES,
  THUMB_MATRIX_N,
  THUMB_TOP_INSET,
  UI_CONTAINER,
  CONFETTI_COUNT,
  CONFETTI_NOFLY_YMIN,
  CONFETTI_NOFLY_YMAX,
} from '../config/tuning';
import type { BeadsSnapshot } from '../game/state';
import {
  drawPauseSettingButton,
  isSettingsAction,
  settingsContentLabel,
} from './settings-content';
import { pausePanelLayout, type PanelButton } from '../systems/pause-panel';
import { failPanelLabel, failPanelLayout } from '../systems/fail-panel';
import { CONFETTI_COLORS, STAR_GOLD, withAlpha, type BeadInks, type BeadsPalette } from './palette';
import { CLEAR_PANEL_TITLE, clearPanelLabel, clearPanelLayout } from '../systems/clear-panel';
import {
  FINISH_MAX_STARS_PER_LEVEL,
  FINISH_PANEL_TITLE,
  finishPanelLabel,
  finishPanelLayout,
} from '../systems/finish-panel';
import {
  SPRINT_SETTLE_NEW_BEST,
  SPRINT_SETTLE_TITLE,
  sprintSettleLabel,
  sprintSettleLayout,
  sprintSettleRows,
} from '../systems/sprint-settle';
import { drawLevelThumb } from './menu-signage';
import {
  confettiFrame,
  confettiIsForeground,
  confettiQuad,
} from './scene-vfx';
import type { ConfettiBeadState } from './scene-vfx';
import { drawModalFrame, drawModalScrim } from './modal-frame';
import { drawButton, drawDashedRect } from './ui-widgets';
import { UI_FONT, UI_SCRIM, bodyFont, drawPaperPanel, formatTime, pressOffset } from './ui-theme';
import { drawPlayPage } from './play-page';
import { starPoints } from './shape-utils';

/** 按下态绘制 y 偏移（算法在 `ui-theme::pressOffset`，本包装只取快照字段）。 */
function pressDy(snap: BeadsSnapshot, id: string): number {
  return pressOffset(snap.pressedButton === id, snap.reduceMotion);
}

/** Panel button copy — sprint swaps one label (pause-settings §2.2, P1). */
function panelLabel(button: PanelButton, snap: BeadsSnapshot): string {
  switch (button.id) {
    case 'resume':
      return '继续';
    case 'restart':
      return snap.mode === 'sprint' ? '重新冲刺' : '重玩本关';
    // UI-30：设置项文案与设置弹窗同源（`settings-content::settingsContentLabel`）——
    // 两入口档位名从此只改一处。
    case 'toggle-bgm':
    case 'toggle-sfx':
    case 'toggle-reduce-motion':
    case 'toggle-large-text':
    case 'toggle-vibrate':
    case 'toggle-debug-info':
    case 'cycle-bead-style':
    case 'cycle-bead-size':
    case 'cycle-skin':
      return settingsContentLabel(button.id, snap);
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
  // UI-41：对局页基础场景（伪震屏 / 底色 / HUD / 棋盘 / 缩放 / 托盘 / 展开 / 道具带 / 扫光 / 连击）
  // 收口在 `view/play-page.ts::drawPlayPage`，层序与拆分前逐字一致。
  drawPlayPage(builder, snap, palette, inks);
  // G6 结算彩带 MAIN/FG 夹住结算面板（§1.6.6 sandwich）：属结算层，仍由本门面画。
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
  // (pause-settings §2.2：防误触 + 防偷看).
  // EP11-S5 / ux §3.3 ⑤（U14=丙）：**暂停面板属「设置态」** ⇒ 遮罩 α 分列读
  // `SETTINGS_SCRIM_ALPHA`（RGB 零改动）；其余面板仍读 `PANEL_SCRIM_ALPHA`。
  // UI-22：遮罩 + 纸面板 + 进出场几何统一由 ModalFrame 出（算式与旧实现逐字同形）。
  const geo = drawModalFrame(builder, {
    panel: layout.panel,
    progress: t,
    scrimRgb: UI_SCRIM.canvas,
    scrimAlpha: UI_SCRIM.settingsAlpha * t,
    palette,
    radius: UI_CONTAINER.radiusPanel,
    shadowAlpha: UI_CONTAINER.shadowAlphaPanel,
  });

  builder.text(geo.cx, layout.titleY, '暂停', {
    fill: palette.text,
    font: UI_FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });

  for (const button of layout.buttons) {
    const bw = (button.rect.xMax - button.rect.xMin) * geo.scale;
    const bh = (button.rect.yMax - button.rect.yMin) * geo.scale;
    const bx = geo.cx + (button.rect.xMin - geo.cx) * geo.scale;
    const by = geo.cy + (button.rect.yMin - geo.cy) * geo.scale;
    const pressed = snap.pressedButton === button.id;
    // UI-31：设置项（开关 / 选择器）的暂停档语言收口到 `settings-content`
    // （chip 木底选中 / 纸钮值字面 / 小字档 / 文案）；非设置项（继续 / 重玩 /
    // 回主菜单）仍就地画。逐钮派发 ⇒ 指令流顺序与旧实现逐字相同。
    if (isSettingsAction(button.id)) {
      drawPauseSettingButton(builder, snap, palette, button.id, bx, by, bw, bh, pressed);
      continue;
    }
    // EP12-S4：主钮 = T3 木；次钮（重玩 / 回主菜单）= T1 纸（screens.md §4 矩阵）。
    const label = panelLabel(button, snap);
    const dy = by + pressDy(snap, button.id);
    if (button.id === 'resume') {
      drawButton(builder, palette, bx, dy, bw, bh, 'wood', UI_CONTAINER.radiusWood, label, UI_FONT.panelButton, pressed);
    } else {
      drawButton(builder, palette, bx, dy, bw, bh, 'paper', UI_CONTAINER.radiusCard, label, UI_FONT.panelButton, pressed);
    }
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

  // UI-22：遮罩收口（冲刺结算底板是手绘单层，无投影/无描边，按登记不并入纸面板）。
  drawModalScrim(builder, UI_SCRIM.canvas, UI_SCRIM.alpha);
  builder.rect(plate.xMin, plate.yMin, plate.xMax - plate.xMin, plate.yMax - plate.yMin, {
    fill: palette.panel,
    stroke: palette.slotBorder,
    lineWidth: 1,
    radius: 24,
  });

  builder.text(DESIGN_W / 2, layout.titleY, SPRINT_SETTLE_TITLE, {
    fill: palette.text,
    font: UI_FONT.panelTitle,
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
      { fill: palette.panel, font: UI_FONT.hudSmall, align: 'center', baseline: 'middle' },
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
        font: bodyFont(snap.largeText, 'sub'),
        align: 'center',
        baseline: 'middle',
      });
    }
    builder.text(row.valueX, row.y, values[i] ?? '', {
      fill: palette.text,
      font: bodyFont(snap.largeText, 'hudSmall'),
      align: 'center',
      baseline: 'middle',
    });
  }

  for (const button of layout.buttons) {
    const bw = button.rect.xMax - button.rect.xMin;
    const bh = button.rect.yMax - button.rect.yMin;
    const primary = button.id === 'again';
    const pressed = snap.pressedButton === button.id;
    const by = button.rect.yMin + pressDy(snap, button.id);
    builder.rect(button.rect.xMin, by, bw, bh, {
      fill: primary
        ? (pressed ? palette.woodFacePressed : palette.accentPrimary) // F6：主钮 → accent_primary（≡ woodFace）。
        : pressed ? palette.cardPressed : palette.panel,
      stroke: primary ? palette.accentPrimary : palette.slotBorder,
      lineWidth: 1,
      radius: 20,
    });
    builder.text(
      button.rect.xMin + bw / 2,
      by + bh / 2,
      sprintSettleLabel(button.id),
      {
        fill: primary ? palette.panel : palette.textDim, // F6：主钮白字（深藏青底）。
        font: UI_FONT.panelButton,
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

  const plate = layout.panel;
  const cx = (plate.xMin + plate.xMax) / 2;
  // UI-22：遮罩 + 纸面板（静止态，progress = 1）。
  drawModalFrame(builder, {
    panel: plate,
    progress: 1,
    scrimRgb: UI_SCRIM.canvas,
    scrimAlpha: UI_SCRIM.alpha,
    palette,
    radius: UI_CONTAINER.radiusPanel,
    shadowAlpha: UI_CONTAINER.shadowAlphaPanel,
  });

  builder.text(cx, layout.titleY, '时间到', {
    fill: palette.text,
    font: UI_FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });
  if (layout.subtitle) {
    builder.text(cx, layout.subtitleY, layout.subtitle, {
      fill: palette.textDim,
      font: bodyFont(snap.largeText, 'hudSmall'),
      align: 'center',
      baseline: 'middle',
    });
  }

  for (const button of layout.buttons) {
    const bw = button.rect.xMax - button.rect.xMin;
    const bh = button.rect.yMax - button.rect.yMin;
    const primary = button.id === 'revive';
    const label = failPanelLabel(button.id);
    if (primary && snap.watchingAd) {
      // EP12-S4：主钮禁用态（screens.md §4 矩阵 T3「禁用」列 = 可点性消失双通道）——
      //   面 `woodFaceDisabled`、字 `woodText`@60%、无受光/承重线、投影 0（替旧 α0.35 蒙版 hack）。
      builder.rect(button.rect.xMin, button.rect.yMin, bw, bh, {
        fill: palette.woodFaceDisabled,
        radius: UI_CONTAINER.radiusWood,
      });
      builder.text(button.rect.xMin + bw / 2, button.rect.yMin + bh / 2, label, {
        fill: withAlpha(palette.woodText, 0.6),
        font: UI_FONT.panelButton,
        align: 'center',
        baseline: 'middle',
      });
    } else if (primary) {
      // T3 木主钮（续时）。
      const by = button.rect.yMin + pressDy(snap, button.id);
      drawButton(builder, palette, button.rect.xMin, by, bw, bh, 'wood', UI_CONTAINER.radiusWood, label, UI_FONT.panelButton, snap.pressedButton === button.id);
    } else {
      // T1 纸次钮（描边，重试）。
      const by = button.rect.yMin + pressDy(snap, button.id);
      drawButton(builder, palette, button.rect.xMin, by, bw, bh, 'paper', UI_CONTAINER.radiusCard, label, UI_FONT.panelButton, snap.pressedButton === button.id);
    }
  }

  if (snap.failHint) {
    builder.text(cx, plate.yMin + 16, snap.failHint, {
      fill: palette.textDim,
      font: bodyFont(snap.largeText, 'hudSmall'),
      align: 'center',
      baseline: 'middle',
    });
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

  // UI-22：遮罩 + 纸面板（静止态，progress = 1）。
  drawModalFrame(builder, {
    panel: plate,
    progress: 1,
    scrimRgb: UI_SCRIM.canvas,
    scrimAlpha: UI_SCRIM.alpha,
    palette,
    radius: UI_CONTAINER.radiusPanel,
    shadowAlpha: UI_CONTAINER.shadowAlphaPanel,
  });

  // 金色缎带横幅 + 标题（ux-spec §3.4 首行）。
  const ribbonH = 84;
  builder.rect(plate.xMin + PANEL_PADDING, layout.titleY - ribbonH / 2, w - PANEL_PADDING * 2, ribbonH, {
    fill: withAlpha(STAR_GOLD, 0.22), // F6：缎带金 → STAR_GOLD（资产色，暖橙让位）。
    radius: 16,
  });
  builder.text(DESIGN_W / 2, layout.titleY, CLEAR_PANEL_TITLE, {
    fill: palette.text,
    font: UI_FONT.panelTitle,
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
    { fill: palette.textDim, font: bodyFont(snap.largeText, 'sub'), align: 'center', baseline: 'middle' },
  );

  // 主/副双钮：主钮 accent_primary 白字（F6：金底作废，§3.5 中性强调），副钮白底深字；
  // 文案归 `clear-panel.ts`。
  for (const button of layout.buttons) {
    const bw = button.rect.xMax - button.rect.xMin;
    const bh = button.rect.yMax - button.rect.yMin;
    const primary = button.id === 'next';
    const label = clearPanelLabel(button.id, snap.clearLastLevel);
    const pressed = snap.pressedButton === button.id;
    const by = button.rect.yMin + pressDy(snap, button.id);
    if (primary) {
      // T3 木主钮（下一关，screens.md S3 §100）。
      drawButton(builder, palette, button.rect.xMin, by, bw, bh, 'wood', UI_CONTAINER.radiusWood, label, UI_FONT.panelButton, pressed);
    } else {
      // T1 纸次钮。
      drawButton(builder, palette, button.rect.xMin, by, bw, bh, 'paper', UI_CONTAINER.radiusCard, label, UI_FONT.panelButton, pressed);
    }
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
    const f = confettiFrame(idx, p, CONFETTI_SCRATCH, builder.height);
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
  drawModalScrim(builder, UI_SCRIM.canvas, UI_SCRIM.alpha);
  const bands = [palette.accentPrimary, palette.adBadge, palette.accentPrimary]; // F6：暖橙→中性强调。
  for (let i = 0; i < bands.length; i++) {
    builder.rect((i * DESIGN_W) / 3, builder.height - 14, DESIGN_W / 3, 14, { fill: bands[i]! });
  }

  // 标题 + 总星数（「共 N / M ★」）。
  builder.text(DESIGN_W / 2, layout.titleY, FINISH_PANEL_TITLE, {
    fill: palette.text,
    font: UI_FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });
  const total = snap.finishStars.reduce((a, b) => a + b, 0);
  builder.text(
    DESIGN_W / 2,
    layout.totalY,
    `共 ${total} / ${levelCount * FINISH_MAX_STARS_PER_LEVEL} ★`,
    { fill: STAR_GOLD, font: bodyFont(snap.largeText, 'sub'), align: 'center', baseline: 'middle' }, // F6：星数金。
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
      font: bodyFont(snap.largeText, 'sub'),
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

  // S7 作品陈列条（EP12-S7 · screens.md S5）：纸底板 + 逐关一格，随总览行同步入场；
  // 已通关（星 > 0）= 珠拼缩略，未通关 = 虚线空槽。纯展示、零热区。
  const shelf = layout.shelf;
  if (snap.finishRowsShown > 0 && shelf.cells.length > 0) {
    const pw = shelf.plate.xMax - shelf.plate.xMin;
    const ph = shelf.plate.yMax - shelf.plate.yMin;
    drawPaperPanel(builder, shelf.plate.xMin, shelf.plate.yMin, pw, ph, palette, UI_CONTAINER.radiusCard, UI_CONTAINER.shadowAlphaPanel);
    for (let i = 0; i < snap.finishRowsShown && i < shelf.cells.length; i++) {
      const c = shelf.cells[i]!;
      const cell = c.xMax - c.xMin;
      const level = snap.finishLevels[i];
      if (level !== undefined && (snap.finishStars[i] ?? 0) > 0) {
        drawLevelThumb(builder, level, c.xMin, c.yMin, cell, cell + THUMB_TOP_INSET, THUMB_MATRIX_N, cell);
      } else {
        drawDashedRect(builder, c.xMin, c.yMin, cell, cell, palette.slotBorder);
      }
    }
  }

  // 主 / 副双钮：主钮 = 「重玩第 1 关」（`core-loop §4` 本状态的推进出口），
  // 副钮 = 「回主菜单」（go-menu 同语义，core-loop v2.3；U1 去冲刺仍隐藏）。
  for (const button of layout.buttons) {
    const bw = button.rect.xMax - button.rect.xMin;
    const bh = button.rect.yMax - button.rect.yMin;
    const primary = button.id === 'replay';
    const pressed = snap.pressedButton === button.id;
    const by = button.rect.yMin + pressDy(snap, button.id);
    builder.rect(button.rect.xMin, by, bw, bh, {
      fill: primary
        ? (pressed ? palette.woodFacePressed : palette.accentPrimary) // F6：主钮 → accent_primary（≡ woodFace）。
        : pressed ? palette.cardPressed : palette.panel,
      stroke: primary ? palette.accentPrimary : palette.slotBorder,
      lineWidth: 1,
      radius: 20,
    });
    builder.text(
      button.rect.xMin + bw / 2,
      by + bh / 2,
      finishPanelLabel(button.id),
      {
        fill: primary ? palette.panel : palette.textDim, // F6：主钮白字（深藏青底）。
        font: UI_FONT.panelButton,
        align: 'center',
        baseline: 'middle',
      },
    );
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
    font: UI_FONT.banner,
    align: 'center',
    baseline: 'middle',
  });
  if (snap.subBanner) {
    builder.text(DESIGN_W / 2, bannerY - 64, snap.subBanner, {
      fill: withAlpha(palette.bannerText, 0.75),
      font: bodyFont(snap.largeText, 'sub'),
      align: 'center',
      baseline: 'middle',
    });
  }
  // 冲刺态的结算内容（单局 / 最高梯位 / 最高连击）已由 `drawSprintSettle` 承担：
  // 本函数在结算面板可见时整体早退（见上方守卫），故此处不再画占位行。
}
