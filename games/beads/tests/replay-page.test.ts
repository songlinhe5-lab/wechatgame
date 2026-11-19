/**
 * EP15-S4 · 结算回放入口 + 全屏回放页（WXG-T-989）。
 *
 * 判据（`gdd/bot-replay.md §8` / `ux/bot-replay-spec.md §3.1–§3.3`）：
 * - §8-4/7 入口显隐与「上一局」一致；无录像 / 非法 ⇒ 不可进、不崩；
 * - §8-9 播放 / 暂停 / 倍速 / 进度定位 / 播完结束条 / 退出返回；
 * - 结算面板回放钮 160×96 独立小钮（用户裁定：不动原双钮）；
 * - 回放页命中域与几何同源（播放 96×96 / 倍速 112×88 / 进度 424×88 / 退出 88×88）。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';
import { BeadsShell } from '../src/game/beads-shell.js';
import type { BeadsLevelRaw } from '../src/config/levels.js';
import { LEVEL_TIME_MAX, DESIGN_W, DESIGN_H, REPLAY_END_PRIMARY, REPLAY_END_SECONDARY, REPLAY_EXIT_RECT, REPLAY_PLAY_RECT, REPLAY_PROGRESS_HIT, REPLAY_SPEED_RECT } from '../src/config/tuning.js';
import { clearPanelLayout, hitClearPanel, clearPanelLabel } from '../src/systems/clear-panel.js';
import { hitReplayPage } from '../src/view/replay-page.js';

const SINGLES_DIR = fileURLToPath(new URL('../design/levels/singles/', import.meta.url));
const STEP = 1 / 60;

function goldenLevel(): BeadsLevelRaw {
  const file = readdirSync(SINGLES_DIR).filter((f) => f.endsWith('.json')).sort()[0]!;
  return simpleTestLevel({ ...(JSON.parse(readFileSync(SINGLES_DIR + file, 'utf8')) as BeadsLevelRaw), time: LEVEL_TIME_MAX });
}

const centre = (r: { x: number; bottom: number; w: number; h: number }): { x: number; y: number } => ({
  x: r.x + r.w / 2,
  y: r.bottom + r.h / 2,
});

describe('EP15-S4 · 结算面板回放入口（§3.1）', () => {
  it('独立 160×96 小钮：有录像可点、无录像零响应；文案 = 回放', () => {
    const layout = clearPanelLayout({ lastLevel: false, showReplay: true });
    const replay = layout.buttons.find((b) => b.id === 'replay')!;
    expect(replay).toBeTruthy();
    expect(replay.rect.xMax - replay.rect.xMin).toBe(160);
    expect(replay.rect.yMax - replay.rect.yMin).toBe(96);
    expect(replay.rect.yMin).toBe(192);
    expect(clearPanelLabel('replay', false)).toBe('回放');
    expect(hitClearPanel(375, 240, { lastLevel: false, showReplay: true })).toBe('replay');
    expect(hitClearPanel(375, 240, { lastLevel: false })).toBeNull(); // 无录像 ⇒ 不命中
  });
});

describe('EP15-S4 · 回放页命中域（§3.2）', () => {
  it('几何同源：播放 / 倍速 / 进度 / 退出；结束条只认双钮', () => {
    expect(hitReplayPage(centre(REPLAY_PLAY_RECT).x, centre(REPLAY_PLAY_RECT).y, false)).toBe('toggle');
    expect(hitReplayPage(centre(REPLAY_SPEED_RECT).x, centre(REPLAY_SPEED_RECT).y, false)).toBe('speed');
    expect(hitReplayPage(centre(REPLAY_PROGRESS_HIT).x, centre(REPLAY_PROGRESS_HIT).y, false)).toBe('seek');
    expect(hitReplayPage(centre(REPLAY_EXIT_RECT).x, centre(REPLAY_EXIT_RECT).y, false)).toBe('exit');
    expect(hitReplayPage(375, 900, false)).toBeNull(); // 棋盘区 = 零响应

    expect(hitReplayPage(centre(REPLAY_END_PRIMARY).x, centre(REPLAY_END_PRIMARY).y, true)).toBe('end-primary');
    expect(hitReplayPage(centre(REPLAY_END_SECONDARY).x, centre(REPLAY_END_SECONDARY).y, true)).toBe('end-secondary');
    expect(hitReplayPage(centre(REPLAY_PLAY_RECT).x, centre(REPLAY_PLAY_RECT).y, true)).toBeNull();
  });
});

describe('EP15-S4 · 结算 → 回放 → 退出 全链（壳层）', () => {
  it('托管过关生成录像；回放页可暂停 / 倍速 / seek / 播完 / 退出回结算', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ noAssemble: true, levels: [level], saveKey: 'wxgame.beads.test.replaypage' });
    const shell = new BeadsShell({
      clock: () => 0,
      metaKey: 'wxgame.beads.test.replaypage-meta',
      initialScreen: 'play',
      play: { levels: [level] },
    });
    shell.init(h.services);
    expect(shell.screen).toBe('play');

    shell.play.setAssist('bot');
    let guard = 0;
    while (shell.play.phase === 'playing' && guard++ < 100000) shell.update(STEP);
    expect(shell.play.phase).toBe('level-clear');
    shell.update(STEP); // 刷新快照 / 录制收尾

    const rec = shell.replayRecorder.lastRecording;
    expect(rec).not.toBeNull();
    expect(shell.play.snapshot.clearReplayAvailable).toBe(true);

    expect(shell.enterReplay('own-last')).toBe(true);
    expect(shell.screen).toBe('replay');

    // 渲染不崩且确有绘制指令。
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    shell.buildRenderModel(builder);
    expect(builder.end().commands.length).toBeGreaterThan(0);

    // 暂停 → 恢复。
    const play = centre(REPLAY_PLAY_RECT);
    expect(shell.replayViewModel.playing).toBe(true);
    expect(shell.tapReplay(play.x, play.y)).toBe(true);
    expect(shell.replayViewModel.playing).toBe(false);
    shell.tapReplay(play.x, play.y);
    expect(shell.replayViewModel.playing).toBe(true);

    // 倍速 1x → 2x。
    const speed = centre(REPLAY_SPEED_RECT);
    shell.tapReplay(speed.x, speed.y);
    expect(shell.replayViewModel.speed).toBe(2);

    // 进度定位到 50%（暂停态下 seek 生效，仍在回放页）。
    const progress = centre(REPLAY_PROGRESS_HIT);
    shell.tapReplay(progress.x, progress.y);
    expect(shell.replayViewModel.progress).toBeGreaterThan(0.4);
    expect(shell.replayViewModel.progress).toBeLessThan(0.6);
    expect(shell.screen).toBe('replay');

    // 定位到末尾 ⇒ 结束条 ⇒ 「退出」回结算（play 屏、相位不变）。
    shell.tapReplay(REPLAY_PROGRESS_HIT.x + REPLAY_PROGRESS_HIT.w, progress.y);
    expect(shell.replayViewModel.ended).toBe(true);
    const exit2 = centre(REPLAY_END_SECONDARY);
    expect(shell.tapReplay(exit2.x, exit2.y)).toBe(true);
    expect(shell.screen).toBe('play');
    expect(shell.play.phase).toBe('level-clear');
    expect(shell.play.snapshot.clearReplayAvailable).toBe(true);
  });
});

describe('EP15-S4 · 无录像不崩（§8-7）', () => {
  it('无「上一局」⇒ 进回放页返回 false，屏幕不动', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ noAssemble: true, levels: [level], saveKey: 'wxgame.beads.test.replayempty' });
    const shell = new BeadsShell({
      clock: () => 0,
      metaKey: 'wxgame.beads.test.replayempty-meta',
      initialScreen: 'play',
      play: { levels: [level] },
    });
    shell.init(h.services);
    expect(shell.enterReplay('own-last')).toBe(false);
    expect(shell.screen).toBe('play');
    expect(shell.tapReplay(375, 100)).toBe(false);
  });
});
