/**
 * EP15-S4 · 回放页绘制（`ux/bot-replay-spec.md` §3.2 / §3.3）。
 *
 * 复用对局页只读渲染（棋盘 / 托盘 / 背景），再**盖掉** HUD 与道具带，叠传输带：
 * 退出（左上 88×88）/ 标题 / 副标 / 播放暂停 / 进度条 / 时间 / 倍速；播完出结束条。
 *
 * 视图层零状态：所有数字来自 {@link ReplayViewModel} 与影子快照；⛔ 不 import `replay/player`。
 */

import type { RenderModelBuilder } from '../../framework/index';
import { DESIGN_W, REPLAY_COVER_BOTTOM, REPLAY_COVER_TOP, REPLAY_END_PANEL, REPLAY_END_PRIMARY, REPLAY_END_SECONDARY, REPLAY_EXIT_RECT, REPLAY_PLAY_RECT, REPLAY_PROGRESS_TRACK, REPLAY_SPEED_RECT } from '../config/tuning';
import type { BeadsLevelRaw } from '../config/levels';
import type { BeadsSnapshot } from '../game/state';
import type { ReplayViewModel } from '../replay/view-model';
import { beadInksFor, withAlpha, type BeadsPalette } from './palette';
import { UI_FONT, formatTime } from './ui-theme';
import { drawButton } from './ui-widgets';
import { buildBeadsView } from './view-model';

export interface ReplayRenderSource {
  /** 影子快照（`ReplayPlayer.snapshot`；无效录像 = null）。 */
  readonly snapshot: Readonly<BeadsSnapshot> | null;
  readonly currentLevel: BeadsLevelRaw;
  readonly model: ReplayViewModel;
  /**
   * `[WXG-T-996]` 页面转场（`ux §5` 200/150ms）：0..1 不透明度 + 12px 纵向位移。
   * 缺省 = 静息帧（金样本 / 旧调用方零漂移）；`reduceMotion` 由壳层置为无位移。
   */
  readonly fade?: { readonly opacity: number; readonly dy: number };
  /** `[WXG-T-996]` seek 静态提示（「定位中…」，空 = 画正常时间标签）。 */
  readonly hint?: string;
}

export function renderReplayPage(
  src: ReplayRenderSource,
  palette: BeadsPalette,
  builder: RenderModelBuilder,
): void {
  builder.setBackground(palette.background);
  const model = src.model;
  // `[WXG-T-996]` 转场：底色恒不透明，内容层整体淡入淡出 + 12px 位移（棋盘为复用整页层，不位移）。
  const alpha = src.fade?.opacity ?? 1;
  const dy = src.fade?.dy ?? 0;
  if (alpha < 1) builder.setAlpha(alpha);
  if (src.snapshot) {
    buildBeadsView(builder, src.snapshot, palette, beadInksFor(src.currentLevel));
  }

  // 盖掉对局 HUD 与道具带 / 展开钮（回放页不显示星级、豆、心、齿轮、道具卡）。
  for (const cover of [REPLAY_COVER_BOTTOM, REPLAY_COVER_TOP]) {
    builder.rect(cover.x, cover.bottom + dy, cover.w, cover.h, { fill: palette.background });
  }

  // 标题 / 副标 / 状态（ux §3.2；字号 28 = HUD/正文 E1 地板，规格 24 低于地板）。
  builder.text(DESIGN_W / 2, 1284 + dy, `回放 · 第 ${src.currentLevel.id} 关`, {
    fill: palette.text,
    font: UI_FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });
  const sourceLabel = model.source === 'bot-demo' ? '机器人演示' : '我的上一局';
  const statusLabel = model.ended ? '已结束' : model.playing ? '▶ 回放中' : '⏸ 已暂停';
  builder.text(DESIGN_W / 2, 1240 + dy, `${sourceLabel} · ${statusLabel}`, {
    fill: palette.text,
    alpha: 0.85,
    font: UI_FONT.hudSmall,
    align: 'center',
    baseline: 'middle',
  });

  // 退出（左上 88×88；「←退出」= 规格文字腿，无独立图标资产）。
  drawButton(builder, palette, REPLAY_EXIT_RECT.x, REPLAY_EXIT_RECT.bottom + dy, REPLAY_EXIT_RECT.w, REPLAY_EXIT_RECT.h,
    'paper', 24, '←退出', UI_FONT.hudSmall, false);

  // 播放 / 暂停（96×96）：图标随状态切换（▶ / ⏸）；播完 = ▶（重播）。
  const play = REPLAY_PLAY_RECT;
  const playY = play.bottom + dy;
  drawButton(builder, palette, play.x, playY, play.w, play.h, 'wood', 24, undefined, UI_FONT.button, false);
  drawTransportIcon(builder, palette, play.x + play.w / 2, playY + play.h / 2, model.playing);

  // 进度条轨道 + 已播比例。
  const track = REPLAY_PROGRESS_TRACK;
  builder.rect(track.x, track.bottom + dy, track.w, track.h, {
    fill: withAlpha(palette.panelBorder, 0.45),
    radius: track.h / 2,
  });
  const progress = model.progress <= 0 ? 0 : model.progress >= 1 ? 1 : model.progress;
  if (progress > 0) {
    builder.rect(track.x, track.bottom + dy, Math.max(track.h, track.w * progress), track.h, {
      fill: palette.hintBlue,
      radius: track.h / 2,
    });
  }
  // 时间标签「已播 / 总长」；seek 后 250ms 内改画静态「定位中…」（不做转圈）。
  builder.text(DESIGN_W / 2 - 3, 58 + dy, src.hint && src.hint.length > 0
    ? src.hint
    : `${formatTime(Math.floor(model.atMs / 1000))} / ${formatTime(Math.floor(model.durationMs / 1000))}`, {
    fill: palette.text,
    alpha: 0.9,
    font: UI_FONT.hudSmall,
    align: 'center',
    baseline: 'middle',
  });

  // 倍速（112×88；文案即状态）。
  const speed = REPLAY_SPEED_RECT;
  drawButton(builder, palette, speed.x, speed.bottom + dy, speed.w, speed.h, 'paper', 24,
    `${model.speed}x`, UI_FONT.button, false);

  if (model.ended) drawReplayEndBar(builder, palette, model, src.currentLevel.id, dy);
  if (alpha < 1) builder.resetAlpha();
}

/** `[WXG-T-996]` 传输带图标（C5）：playing = 两根竖条（⏸），暂停 / 播完 = 三角（▶）。 */
function drawTransportIcon(
  builder: RenderModelBuilder,
  palette: BeadsPalette,
  cx: number,
  cy: number,
  playing: boolean,
): void {
  const ink = palette.woodText;
  if (playing) {
    builder.rect(cx - 15, cy - 17, 10, 34, { fill: ink, radius: 3 });
    builder.rect(cx + 5, cy - 17, 10, 34, { fill: ink, radius: 3 });
    return;
  }
  // 三角右偏 3px 做视觉居中（几何重心在 1/3 处）。
  builder.polygon([cx + 17, cy, cx - 11, cy + 19, cx - 11, cy - 19], { fill: ink });
}

/** 结束条（ux §3.3）：560×240，标题 +（演示）副文案 + 主/次双钮；条外点击由壳层吞掉。 */
function drawReplayEndBar(
  builder: RenderModelBuilder,
  palette: BeadsPalette,
  model: ReplayViewModel,
  levelId: number,
  dy: number,
): void {
  const panel = REPLAY_END_PANEL;
  builder.rect(0, 0, DESIGN_W, 1334, { fill: withAlpha(palette.background, 0.5) });
  builder.rect(panel.x, panel.bottom + dy, panel.w, panel.h, {
    fill: palette.panel,
    stroke: palette.panelBorder,
    lineWidth: 2,
    radius: 28,
  });
  builder.text(DESIGN_W / 2, 620 + dy, model.source === 'bot-demo' ? '演示结束' : '回放结束', {
    fill: palette.text,
    font: UI_FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });
  // `[WXG-T-996]` C11：演示结束条副文案（`ux §3.3`）——只演示档有；回放档保持原单行标题。
  if (model.source === 'bot-demo') {
    builder.text(DESIGN_W / 2, 590 + dy, `机器人完成了第 ${levelId} 关`, {
      fill: palette.text,
      alpha: 0.85,
      font: UI_FONT.hudSmall,
      align: 'center',
      baseline: 'middle',
    });
  }
  const primary = REPLAY_END_PRIMARY;
  drawButton(builder, palette, primary.x, primary.bottom + dy, primary.w, primary.h, 'wood', 24,
    model.source === 'bot-demo' ? '再看一遍' : '重播', UI_FONT.button, false);
  const secondary = REPLAY_END_SECONDARY;
  drawButton(builder, palette, secondary.x, secondary.bottom + dy, secondary.w, secondary.h, 'paper', 24,
    '退出', UI_FONT.button, false);
}

/** 命中（设计坐标）类型：口径归 `systems/replay-transport.ts`（壳可直用，⛔ 壳不 import view）。 */
export type { ReplayHit } from '../systems/replay-transport';
