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
import { describe, expect, it, vi } from 'vitest';
import { RenderModelBuilder } from '@wxgame/framework';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';
import { BeadsShell } from '../src/game/beads-shell.js';
import type { BeadsGame } from '../src/game/beads-game.js';
import type { ReplayPlayer } from '../src/replay/player.js';
import type { BeadsLevelRaw } from '../src/config/levels.js';
import { LEVEL_TIME_MAX, DESIGN_W, DESIGN_H, REPLAY_END_PRIMARY, REPLAY_END_SECONDARY, REPLAY_EXIT_RECT, REPLAY_PLAY_RECT, REPLAY_PROGRESS_HIT, REPLAY_SPEED_RECT, WALL_ROWS } from '../src/config/tuning.js';
import { clearPanelLayout, hitClearPanel, clearPanelLabel } from '../src/systems/clear-panel.js';
import { failPanelLayout } from '../src/systems/fail-panel.js';
import { sprintSettleLayout } from '../src/systems/sprint-settle.js';
import { finishPanelLayout, finishPanelLabel } from '../src/systems/finish-panel.js';
import { hitReplayPage } from '../src/systems/replay-transport.js';
import { metaLayout } from '../src/view/meta-layout.js';

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

// ─────────────────────────────────────────── EP15-S4 尾账：§8-5 / §8-6 / §8-7 / §8-9

interface SandboxPeek {
  readonly game: BeadsGame;
  readonly services: { readonly storage: unknown };
}

/** 取当前回放页的影子实例（私有字段只读访问；⛔ 不写回）。 */
function sandboxOf(shell: BeadsShell): SandboxPeek | null {
  const player = (shell as unknown as { _replayPlayer: { _sandbox?: SandboxPeek | null } | null })._replayPlayer;
  return player?._sandbox ?? null;
}

/** 菜单起步夹具（演示入口腿）。 */
function menuRig(tag: string): { level: BeadsLevelRaw; h: ReturnType<typeof createBeadsHarness>; shell: BeadsShell } {
  const level = goldenLevel();
  const h = createBeadsHarness({ noAssemble: true, levels: [level], saveKey: `wxgame.beads.test.${tag}` });
  const shell = new BeadsShell({
    clock: () => 0,
    metaKey: `wxgame.beads.test.${tag}-meta`,
    initialScreen: 'menu',
    play: { levels: [level] },
  });
  shell.init(h.services);
  return { level, h, shell };
}

function demoButtonOf(shell: BeadsShell): { x: number; y: number } {
  const btn = metaLayout('none', WALL_ROWS, shell.menuAnchors).buttons.find((b) => b.id === 'bot-demo');
  if (!btn) throw new Error('主菜单缺 bot-demo 入口');
  return { x: btn.box.x + btn.box.w / 2, y: btn.box.y + btn.box.h / 2 };
}

describe('EP15-S4 · 演示/回放零副作用（§8-5 钱包 / 体力 / 发豆 spy）', () => {
  it('演示进入 + 播完：真实 meta 四腿零调用、金币/体力不变、影子用私有 storage', () => {
    const { h, shell } = menuRig('replayzero');
    const meta = shell.meta!;
    const spies = [
      vi.spyOn(meta, 'addCoins'),
      vi.spyOn(meta, 'addStamina'),
      vi.spyOn(meta, 'grantClearCoins'),
      vi.spyOn(meta, 'spendStamina'),
    ];
    const coins = meta.coins;
    const stamina = meta.stamina;
    const btn = demoButtonOf(shell);
    expect(shell.tapMeta(btn.x, btn.y)).toBe(true);
    expect(shell.screen).toBe('replay');

    const sandbox = sandboxOf(shell);
    expect(sandbox, '影子实例缺失').toBeTruthy();
    expect(sandbox!.game.replaySandboxActive).toBe(true);
    expect((sandbox!.game as unknown as { _onClearCoins?: unknown })._onClearCoins, '影子不得注入宿主发豆回调').toBeUndefined();
    expect(sandbox!.services.storage, '影子必须用私有存档，⛔ 触真实 storage').not.toBe(h.services.storage);

    // 播完全程（含终局那一步）。
    const player = (shell as unknown as { _replayPlayer: ReplayPlayer })._replayPlayer;
    let guard = 0;
    while (!player.ended && guard++ < 20000) player.tick(1000);
    expect(player.ended).toBe(true);

    for (const spy of spies) expect(spy, spy.getMockName()).not.toHaveBeenCalled();
    expect(meta.coins, '演示不得改真实钱包').toBe(coins);
    expect(meta.stamina, '演示不得扣/加真实体力').toBe(stamina);
  });
});

describe('EP15-S4 · 回放入口唯一性（§8-6 逐相位入口矩阵）', () => {
  it('视频回放钮只在 ClearPanel；失败 / 冲刺 / 通关面板零视频回放入口', () => {
    // ClearPanel：回放钮 = 显隐在**命中腿**裁（布局恒留位，`showReplay=false` ⇒ 不可点、不可见）。
    expect(hitClearPanel(375, 240, { lastLevel: false, showReplay: true })).toBe('replay');
    expect(hitClearPanel(375, 240, { lastLevel: false, showReplay: false })).toBeNull();
    expect(failPanelLayout(true).buttons.some((b) => String(b.id) === 'replay')).toBe(false);
    expect(failPanelLayout(false).buttons.some((b) => String(b.id) === 'replay')).toBe(false);
    expect(sprintSettleLayout().buttons.some((b) => String(b.id) === 'replay')).toBe(false);
    // FINISH 的 `replay` = 重玩关卡（重玩 ≠ 视频回放）⇒ 只认文案与 ClearPanel 的「回放」不同源。
    expect(finishPanelLabel('replay')).toBe('重玩第 1 关');
    expect(finishPanelLabel('replay')).not.toBe(clearPanelLabel('replay', false));
    expect(finishPanelLayout(3).buttons.some((b) => b.id === 'replay')).toBe(true);
  });

  it('play 相位点回放坐标：零动作（tapReplay 恒 false，相位 / 屏幕不变）', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ noAssemble: true, levels: [level], saveKey: 'wxgame.beads.test.replayphase' });
    const shell = new BeadsShell({
      clock: () => 0,
      metaKey: 'wxgame.beads.test.replayphase-meta',
      initialScreen: 'play',
      play: { levels: [level] },
    });
    shell.init(h.services);
    expect(shell.screen).toBe('play');
    const phase = shell.play.phase;
    const play = centre(REPLAY_PLAY_RECT);
    expect(shell.tapReplay(play.x, play.y), 'play 相位回放页坐标不接任何动作').toBe(false);
    expect(shell.screen).toBe('play');
    expect(shell.play.phase).toBe(phase);
  });
});

describe('EP15-S4 · 回放页零玩法输入（§8-7 公开命令 spy）', () => {
  it('回放页点棋盘 / 托盘 / 道具位：影子公开命令调用数恒 0', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ noAssemble: true, levels: [level], saveKey: 'wxgame.beads.test.replaycmd' });
    const shell = new BeadsShell({
      clock: () => 0,
      metaKey: 'wxgame.beads.test.replaycmd-meta',
      initialScreen: 'play',
      play: { levels: [level] },
    });
    shell.init(h.services);
    shell.play.setAssist('bot');
    let guard = 0;
    while (shell.play.phase === 'playing' && guard++ < 100000) shell.update(STEP);
    expect(shell.play.phase).toBe('level-clear');
    shell.update(STEP);
    expect(shell.enterReplay('own-last')).toBe(true);
    const sandbox = sandboxOf(shell);
    expect(sandbox).toBeTruthy();
    // 冻结注入后再打 spy（进入回放瞬间的 step=0 注入不计入本次断言）。
    (shell as unknown as { _replayPlayer: ReplayPlayer })._replayPlayer.pause();
    const game = sandbox!.game;
    const commandSpies = [
      vi.spyOn(game, 'selectBoardBead'),
      vi.spyOn(game, 'tapGridCell'),
      vi.spyOn(game, 'selectTraySlot'),
      vi.spyOn(game, 'retrieveSelectedGroup'),
      vi.spyOn(game, 'usePowerup'),
      vi.spyOn(game, 'expandTray'),
    ];
    // 棋盘区 / 托盘带 / 顶部 HUD / 屏底 —— 回放页里全是零响应坐标。
    for (const [x, y] of [[375, 900], [375, 600], [80, 180], [375, 1000], [660, 60]] as const) {
      shell.tapReplay(x, y);
      expect(shell.screen, `(${x},${y}) 不得离开回放页`).toBe('replay');
    }
    for (const spy of commandSpies) expect(spy, spy.getMockName()).not.toHaveBeenCalled();
  });
});

describe('EP15-S4 · 主菜单演示入口（§8-9）', () => {
  it('「看演示」→ 回放页（bot-demo）→ 退出回菜单；演示不占「上一局」槽、不扣心', () => {
    const { h, shell } = menuRig('replaydemo');
    const stamina = shell.meta!.stamina;
    const overlays = h.count('meta:overlay');
    // 按钮文案 = 令牌值（渲染指令取证）。
    const builder = new RenderModelBuilder(DESIGN_W, DESIGN_H);
    builder.begin();
    shell.buildRenderModel(builder);
    const texts = builder.end().commands.filter((c) => c.kind === 'text').map((c) => String((c as { text?: string }).text ?? ''));
    expect(texts).toContain('看演示');

    const btn = demoButtonOf(shell);
    expect(shell.tapMeta(btn.x, btn.y)).toBe(true);
    expect(shell.screen).toBe('replay');
    expect(shell.replayViewModel.visible).toBe(true);
    expect(shell.replayViewModel.source).toBe('bot-demo');
    expect(shell.replayRecorder.lastRecording, '演示录像不得占用「上一局」槽').toBeNull();
    expect(shell.meta!.stamina, '演示入口不扣心').toBe(stamina);

    const exit = centre(REPLAY_EXIT_RECT);
    expect(shell.tapReplay(exit.x, exit.y)).toBe(true);
    expect(shell.screen).toBe('menu');
    expect(h.count('meta:overlay'), '演示进出菜单不发 meta:overlay').toBe(overlays);
  });

  it('无可用演示（buildBotDemo ⇒ null）：零事件、留菜单、不扣心', () => {
    const { h, shell } = menuRig('replaydemoempty');
    vi.spyOn(shell, 'buildBotDemo').mockReturnValue(null);
    const stamina = shell.meta!.stamina;
    const events = h.emitted.length;
    const overlays = h.count('meta:overlay');
    const btn = demoButtonOf(shell);
    expect(shell.tapMeta(btn.x, btn.y)).toBe(false);
    expect(shell.screen).toBe('menu');
    expect(h.emitted.length, '零新事件').toBe(events);
    expect(h.count('meta:overlay')).toBe(overlays);
    expect(shell.meta!.stamina).toBe(stamina);
  });
});

describe('EP15 · 冷启无残留（§8-14）', () => {
  it('会话 1 进回放页 → dispose → 同存档冷启新壳：无录像 / 无回放态 / 可正常开局', () => {
    const level = goldenLevel();
    const saveKey = 'wxgame.beads.test.replaycold';
    const h1 = createBeadsHarness({ noAssemble: true, levels: [level], saveKey });
    const s1 = new BeadsShell({
      clock: () => 0,
      metaKey: `${saveKey}-meta`,
      initialScreen: 'menu',
      play: { levels: [level] },
    });
    s1.init(h1.services);
    const btn = demoButtonOf(s1);
    expect(s1.tapMeta(btn.x, btn.y)).toBe(true);
    expect(s1.screen).toBe('replay');
    expect(s1.replayRecorder.lastRecording, '演示不落盘、不占上一局槽').toBeNull();
    s1.dispose();

    // 冷启 = 新进程 / 新壳，同一份宿主存档（生产首屏直进对局）。
    const h2 = createBeadsHarness({ noAssemble: true, levels: [level], saveKey });
    const s2 = new BeadsShell({
      clock: () => 0,
      metaKey: `${saveKey}-meta`,
      initialScreen: 'play',
      play: { levels: [level] },
    });
    s2.init(h2.services);
    expect(s2.screen).toBe('play');
    expect(s2.play.phase).toBe('playing');
    expect(s2.replayViewModel.visible, '冷启不得残留回放页').toBe(false);
    expect(s2.replayRecorder.lastRecording).toBeNull();
    expect(s2.replayRecorder.active).toBeNull();
    // 回放页坐标在冷启对局里零动作 / 不进回放。
    expect(s2.tapReplay(centre(REPLAY_PLAY_RECT).x, centre(REPLAY_PLAY_RECT).y)).toBe(false);
    expect(s2.screen).toBe('play');
    // 菜单仍可正常开局。
    s2.showMenu();
    const start = metaLayout('none', WALL_ROWS, s2.menuAnchors).buttons.find((b) => b.id === 'start');
    expect(start).toBeTruthy();
    expect(s2.tapMeta(start!.box.x + start!.box.w / 2, start!.box.y + start!.box.h / 2)).toBe(true);
    expect(s2.screen).toBe('play');
    expect(s2.play.phase).toBe('playing');
  });
});
