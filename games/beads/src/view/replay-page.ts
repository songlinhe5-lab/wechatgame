/**
 * EP15-S4 · 回放页绘制（`ux/bot-replay-spec.md` §3.2 / §3.3）。
 *
 * 复用对局页只读渲染（棋盘 / 托盘 / 背景），再**盖掉** HUD 与道具带，叠传输带：
 * 退出（左上 88×88）/ 标题 / 副标 / 播放暂停 / 进度条 / 时间 / 倍速；播完出结束条。
 *
 * 视图层零状态：所有数字来自 {@link ReplayViewModel} 与影子快照；⛔ 不 import `replay/player`。
 */

import type { RenderModelBuilder } from '@wxgame/framework';
import { DESIGN_W, REPLAY_COVER_BOTTOM, REPLAY_COVER_TOP, REPLAY_END_PANEL, REPLAY_END_PRIMARY, REPLAY_END_SECONDARY, REPLAY_EXIT_RECT, REPLAY_PLAY_RECT, REPLAY_PROGRESS_HIT, REPLAY_PROGRESS_TRACK, REPLAY_SPEED_RECT } from '../config/tuning.js';
import type { BeadsLevelRaw } from '../config/levels.js';
import type { BeadsSnapshot } from '../game/state.js';
import type { ReplayViewModel } from '../replay/view-model.js';
import { beadInksFor, withAlpha, type BeadsPalette } from './palette.js';
import { UI_FONT, formatTime } from './ui-theme.js';
import { drawButton } from './ui-widgets.js';
import { buildBeadsView } from './view-model.js';

export interface ReplayRenderSource {
  /** 影子快照（`ReplayPlayer.snapshot`；无效录像 = null）。 */
  readonly snapshot: Readonly<BeadsSnapshot> | null;
  readonly currentLevel: BeadsLevelRaw;
  readonly model: ReplayViewModel;
}

export function renderReplayPage(
  src: ReplayRenderSource,
  palette: BeadsPalette,
  builder: RenderModelBuilder,
): void {
  builder.setBackground(palette.background);
  if (src.snapshot) {
    buildBeadsView(builder, src.snapshot, palette, beadInksFor(src.currentLevel));
  }
  const model = src.model;

  // 盖掉对局 HUD 与道具带 / 展开钮（回放页不显示星级、豆、心、齿轮、道具卡）。
  for (const cover of [REPLAY_COVER_BOTTOM, REPLAY_COVER_TOP]) {
    builder.rect(cover.x, cover.bottom, cover.w, cover.h, { fill: palette.background });
  }

  // 标题 / 副标 / 状态（ux §3.2）。
  builder.text(DESIGN_W / 2, 1284, `回放 · 第 ${src.currentLevel.id} 关`, {
    fill: palette.text,
    font: UI_FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });
  const sourceLabel = model.source === 'bot-demo' ? '机器人演示' : '我的上一局';
  const statusLabel = model.ended ? '已结束' : model.playing ? '▶ 回放中' : '⏸ 已暂停';
  builder.text(DESIGN_W / 2, 1240, `${sourceLabel} · ${statusLabel}`, {
    fill: palette.text,
    alpha: 0.85,
    font: UI_FONT.hud,
    align: 'center',
    baseline: 'middle',
  });

  // 退出（左上 88×88）。
  drawButton(builder, palette, REPLAY_EXIT_RECT.x, REPLAY_EXIT_RECT.bottom, REPLAY_EXIT_RECT.w, REPLAY_EXIT_RECT.h,
    'paper', 24, '返回', UI_FONT.button, false);

  // 播放 / 暂停（96×96）。
  const play = REPLAY_PLAY_RECT;
  drawButton(builder, palette, play.x, play.bottom, play.w, play.h, 'wood', 24,
    model.ended ? '重播' : model.playing ? '暂停' : '播放', UI_FONT.button, false);

  // 进度条轨道 + 已播比例。
  const track = REPLAY_PROGRESS_TRACK;
  builder.rect(track.x, track.bottom, track.w, track.h, {
    fill: withAlpha(palette.panelBorder, 0.45),
    radius: track.h / 2,
  });
  const progress = model.progress <= 0 ? 0 : model.progress >= 1 ? 1 : model.progress;
  if (progress > 0) {
    builder.rect(track.x, track.bottom, Math.max(track.h, track.w * progress), track.h, {
      fill: palette.hintBlue,
      radius: track.h / 2,
    });
  }
  // 时间标签「已播 / 总长」。
  builder.text(DESIGN_W / 2 - 3, 58, `${formatTime(Math.floor(model.atMs / 1000))} / ${formatTime(Math.floor(model.durationMs / 1000))}`, {
    fill: palette.text,
    alpha: 0.9,
    font: UI_FONT.hud,
    align: 'center',
    baseline: 'middle',
  });

  // 倍速（112×88；文案即状态）。
  const speed = REPLAY_SPEED_RECT;
  drawButton(builder, palette, speed.x, speed.bottom, speed.w, speed.h, 'paper', 24,
    `${model.speed}x`, UI_FONT.button, false);

  if (model.ended) drawReplayEndBar(builder, palette, model);
}

/** 结束条（ux §3.3）：560×240，标题 + 主/次双钮；条外点击由壳层吞掉。 */
function drawReplayEndBar(
  builder: RenderModelBuilder,
  palette: BeadsPalette,
  model: ReplayViewModel,
): void {
  const panel = REPLAY_END_PANEL;
  builder.rect(0, 0, DESIGN_W, 1334, { fill: withAlpha(palette.background, 0.5) });
  builder.rect(panel.x, panel.bottom, panel.w, panel.h, {
    fill: palette.panel,
    stroke: palette.panelBorder,
    lineWidth: 2,
    radius: 28,
  });
  builder.text(DESIGN_W / 2, 620, model.source === 'bot-demo' ? '演示结束' : '回放结束', {
    fill: palette.text,
    font: UI_FONT.panelTitle,
    align: 'center',
    baseline: 'middle',
  });
  const primary = REPLAY_END_PRIMARY;
  drawButton(builder, palette, primary.x, primary.bottom, primary.w, primary.h, 'wood', 24,
    model.source === 'bot-demo' ? '再看一遍' : '重播', UI_FONT.button, false);
  const secondary = REPLAY_END_SECONDARY;
  drawButton(builder, palette, secondary.x, secondary.bottom, secondary.w, secondary.h, 'paper', 24,
    '退出', UI_FONT.button, false);
}

/** 命中（设计坐标）：`'exit' | 'toggle' | 'seek' | 'speed' | 'end-primary' | 'end-secondary' | null`。 */
export type ReplayHit = 'exit' | 'toggle' | 'seek' | 'speed' | 'end-primary' | 'end-secondary' | null;

export function hitReplayPage(x: number, y: number, ended: boolean): ReplayHit {
  if (ended) {
    if (inRect(REPLAY_END_PRIMARY, x, y)) return 'end-primary';
    if (inRect(REPLAY_END_SECONDARY, x, y)) return 'end-secondary';
    return null; // 结束条期：条外零响应
  }
  if (inRect(REPLAY_EXIT_RECT, x, y)) return 'exit';
  if (inRect(REPLAY_PLAY_RECT, x, y)) return 'toggle';
  if (inRect(REPLAY_PROGRESS_HIT, x, y)) return 'seek';
  if (inRect(REPLAY_SPEED_RECT, x, y)) return 'speed';
  return null;
}

function inRect(r: { x: number; bottom: number; w: number; h: number }, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.bottom && y <= r.bottom + r.h;
}
