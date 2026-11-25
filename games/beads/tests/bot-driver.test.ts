/**
 * EP15-S2 · BotDriver 托管 / 演示回归（WXG-T-988）。
 *
 * 判据（`gdd/bot-replay.md §8`）：
 * - §8-2 托管下动作序列确定性（同 seed N=2 终局一致）；
 * - §8-10 无合法动作自动停机（stuck / exhausted 事件）、玩家接管零玩法事件；
 * - §8-11 托管结算同手动局（正常计星 / 正常解锁）；
 * - §8-14 演示录像生命周期（跑完整局才产出、失败不生成、可被 ReplayPlayer 播完）。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { MockRewardedAdProvider } from '@wxgame/framework';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import { ASSIST_STOPPED_HINT, ASSIST_TAKEOVER_HINT, LEVEL_TIME_MAX } from '../src/config/tuning.js';
import type { BeadsLevelRaw } from '../src/config/levels.js';
import { BeadsShell } from '../src/game/beads-shell.js';
import { BotDriver } from '../src/bot/driver.js';
import type { BotPolicy } from '../src/bot/types.js';
import { createBotPolicy } from '../src/bot/registry.js';
import { precomputeBotDemo } from '../src/replay/demo.js';
import { validateRecording } from '../src/replay/recorder.js';
import { ReplayPlayer } from '../src/replay/player.js';

const SINGLES_DIR = fileURLToPath(new URL('../design/levels/singles/', import.meta.url));

function goldenLevel(): BeadsLevelRaw {
  const file = readdirSync(SINGLES_DIR).filter((f) => f.endsWith('.json')).sort()[0]!;
  return simpleTestLevel({ ...(JSON.parse(readFileSync(SINGLES_DIR + file, 'utf8')) as BeadsLevelRaw), time: LEVEL_TIME_MAX });
}

function gridSignature(h: Harness): string {
  return h.game.snapshot.cells.map((c) => c.beadColorIdx).join(',');
}

/** 跑完一整局托管（真实 harness）。 */
function runAssist(level: BeadsLevelRaw, driver: BotDriver): Harness {
  const h = createBeadsHarness({ seed: 'beads-driver', levels: [level] });
  h.game.goToLevel(0);
  h.game.setAssist('bot');
  let guard = 0;
  while (h.game.phase === 'playing' && guard++ < 200000) {
    h.advance(1 / 60);
    if (h.game.phase !== 'playing') break;
    const event = driver.tick(1000 / 60, h.game);
    if (event === 'stuck' || event === 'exhausted') break;
  }
  return h;
}

describe('EP15-S2 · 托管节拍（§8-10 节拍半）', () => {
  it('未到 BOT_STEP_INTERVAL_MS 不出手；到点后每拍最多 1 条命令', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ seed: 'beads-driver', levels: [level] });
    h.game.goToLevel(0);
    h.game.setAssist('bot');
    const driver = new BotDriver();
    expect(driver.tick(400, h.game)).toBe('');
    expect(driver.moves).toBe(0);
    const actionsBefore = h.game.actionsThisLevel;
    expect(driver.tick(60, h.game)).toBe('acted');
    expect(driver.moves).toBe(1);
    // 单拍最多一条公开命令 ⇒ 有效动作最多 +1（两命令的 BotAction 第二拍才落）。
    expect(h.game.actionsThisLevel - actionsBefore).toBeLessThanOrEqual(1);
  });

  it('非托管 / 非 PLAYING 不出手', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ seed: 'beads-driver', levels: [level] });
    h.game.goToLevel(0);
    const driver = new BotDriver();
    expect(driver.tick(1000, h.game)).toBe('');
    h.game.setAssist('bot');
    h.game.applySettingsAction('resume'); // 无副作用；仍 PLAYING
    expect(driver.tick(1000, h.game)).toBe('acted');
  });
});

describe('EP15-S2 · 托管确定性（§8-2）', () => {
  it('同 seed 两局托管的动作数 / 终局 / 星级一致', () => {
    const level = goldenLevel();
    const a = runAssist(level, new BotDriver({ policy: createBotPolicy() }));
    const b = runAssist(level, new BotDriver({ policy: createBotPolicy() }));
    expect(a.game.phase).toBe('level-clear');
    expect(b.game.phase).toBe('level-clear');
    expect(a.game.actionsThisLevel).toBe(b.game.actionsThisLevel);
    expect(gridSignature(a)).toBe(gridSignature(b));
    expect(a.game.lastStars).toBe(b.game.lastStars);
  });
});

describe('EP15-S2 · 停机与接管（§8-10）', () => {
  it('decide()==null 达 BOT_STUCK_LIMIT ⇒ stuck（壳层据此自动暂停）', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ seed: 'beads-driver', levels: [level] });
    h.game.goToLevel(0);
    h.game.setAssist('bot');
    const stuckPolicy: BotPolicy = { id: 'stuck-test', version: 1, decide: () => null };
    const driver = new BotDriver({ policy: stuckPolicy, stepIntervalMs: 0 });
    expect(driver.tick(0, h.game)).toBe('stuck');
  });

  it('动作数触顶 BOT_MAX_MOVES ⇒ exhausted', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ seed: 'beads-driver', levels: [level] });
    h.game.goToLevel(0);
    h.game.setAssist('bot');
    const driver = new BotDriver({ maxMoves: 1, stepIntervalMs: 0 });
    expect(driver.tick(0, h.game)).toBe('acted');
    expect(driver.tick(0, h.game)).toBe('acted'); // 第二命令（若只剩一拍）
    expect(driver.tick(0, h.game)).toBe('exhausted');
  });

  it('玩家点棋盘 ⇒ 取消托管且该次点击零玩法事件', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ seed: 'beads-driver', levels: [level] });
    h.game.goToLevel(0);
    h.game.setAssist('bot');
    h.advance(1 / 60);
    expect(h.game.snapshot.assist).toBe('bot');

    const snap = h.game.snapshot;
    let target: { row: number; col: number } | null = null;
    for (let row = 0; row < snap.gridRows && !target; row++) {
      for (let col = 0; col < snap.gridCols; col++) {
        if (h.game.grid.isMisplaced(row, col)) {
          target = { row, col };
          break;
        }
      }
    }
    expect(target).not.toBeNull();
    const before = h.game.actionsThisLevel;
    const x = snap.gridLeft + target!.col * snap.gridPitch;
    const y = snap.gridTop - target!.row * snap.gridPitch;
    expect(h.game.tapDesign(x, y)).toBe(true); // 吞掉
    expect(h.game.assist).toBe('off');
    expect(h.game.actionsThisLevel).toBe(before); // 零玩法事件
    // `[WXG-T-994]` 接管轻提示（ux §3.4「轻提示『已接管』」；同轻提示通道）。
    expect(h.game.snapshot.powerupHint).toBe(ASSIST_TAKEOVER_HINT);
    h.advance(1 / 60);
    expect(h.game.snapshot.assist).toBe('off');
    expect(h.game.snapshot.boardSelectedRow).toBe(-1); // 未建立选择锚
    h.advance(0.5); // TTL 400ms 到期 ⇒ 自动清，不常驻
    expect(h.game.snapshot.powerupHint).toBe('');
  });

  it('停机 ⇒ 自动暂停 + 轻提示「托管已停止」（2s 后自动清）', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ seed: 'beads-driver', levels: [level] });
    h.game.goToLevel(0);
    h.game.setAssist('bot');
    h.game.pauseForAssistStop();
    expect(h.game.phase).toBe('paused');
    expect(h.game.snapshot.powerupHint).toBe(ASSIST_STOPPED_HINT);
    h.advance(2.2);
    expect(h.game.snapshot.powerupHint).toBe('');
  });

  it('壳层：驱动报 stuck ⇒ 托管关、自动暂停、轻提示上屏', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ seed: 'beads-driver', levels: [level], saveKey: 'wxgame.beads.test.assiststop' });
    const shell = new BeadsShell({
      clock: () => 0,
      metaKey: 'wxgame.beads.test.assiststop-meta',
      initialScreen: 'play',
      // `[WXG-T-1081]` 本套用例靠「耗尽时间」走到 game-over ⇒ 夹具须预置计时闸开
      // （生产默认 = 等玩家首次操作，闸门关着永远不会超时）。
      play: { levels: [level], armClockOnStart: true },
    });
    shell.init(h.services);
    shell.play.setAssist('bot');
    const driver = (shell as unknown as { _driver: BotDriver })._driver;
    vi.spyOn(driver, 'tick').mockReturnValue('stuck');
    shell.update(1 / 60);
    expect(shell.play.assist).toBe('off');
    expect(shell.play.phase).toBe('paused');
    expect(shell.play.snapshot.powerupHint).toBe(ASSIST_STOPPED_HINT);
  });

  it('关闭托管后驱动不再出手', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ seed: 'beads-driver', levels: [level] });
    h.game.goToLevel(0);
    const driver = new BotDriver();
    h.game.setAssist('bot');
    h.game.takeOverFromBot();
    expect(driver.tick(1000, h.game)).toBe('');
    expect(driver.moves).toBe(0);
  });
});

describe('EP15-S2 · 托管结算（§8-11）', () => {
  it('托管过关正常计星 / 正常解锁（与手动局同路径）', () => {
    const level = goldenLevel();
    const next = simpleTestLevel({ ...level, id: 2, uid: 'L00002' });
    const h = createBeadsHarness({ seed: 'beads-driver', levels: [level, next] });
    h.game.goToLevel(0);
    h.game.setAssist('bot');
    const driver = new BotDriver();
    let guard = 0;
    while (h.game.phase === 'playing' && guard++ < 200000) {
      h.advance(1 / 60);
      if (h.game.phase !== 'playing') break;
      const event = driver.tick(1000 / 60, h.game);
      if (event === 'stuck' || event === 'exhausted') break;
    }
    expect(h.game.phase).toBe('level-clear');
    expect(h.game.lastStars).toBeGreaterThanOrEqual(1);
    expect(h.game.starsByLevel[0]).toBeGreaterThanOrEqual(1);
    expect(h.game.maxUnlockedLevel).toBe(2);
  });
});

describe('EP15-S2 · 演示预计算（§8-14）', () => {
  const level = goldenLevel();

  it('完整跑完 ⇒ 产出 bot-demo 录像且可被播放器重演到终局', () => {
    const rec = precomputeBotDemo({ levels: [level], levelIndex: 0, starsBefore: 0 });
    expect(rec).not.toBeNull();
    expect(rec!.source).toBe('bot-demo');
    expect(rec!.final.cleared).toBe(true);
    expect(validateRecording(rec!, level).ok).toBe(true);

    const player = new ReplayPlayer(rec!, { levels: [level] });
    expect(player.valid).toBe(true);
    player.play();
    let guard = 0;
    while (!player.ended && guard++ < 100000) player.tick(1000);
    expect(player.ended).toBe(true);
    expect(player.finalCheck?.ok, `diffs=${player.finalCheck?.diffs.join(',')}`).toBe(true);
    player.dispose();
  });

  it('跑不完整局 ⇒ null（⛔ 不展示半局）', () => {
    expect(precomputeBotDemo({ levels: [level], levelIndex: 0, starsBefore: 0, maxMoves: 0 })).toBeNull();
  });

  it('演示录像不占「上一局」槽位（独立 record），源码无游戏内录制器参与', () => {
    const rec = precomputeBotDemo({ levels: [level], levelIndex: 0, starsBefore: 0 })!;
    expect(rec.source).toBe('bot-demo');
    expect(rec.context.starsBefore).toBe(0);
  });
});

describe('EP15 · 续时局录像对拍（§8-3 / §8-11）', () => {
  it('失败 → 广告续时 → 托管过关：录像带 revive 事件，影子重演终局逐字段一致', () => {
    const level = goldenLevel();
    const h = createBeadsHarness({ seed: 'beads-driver', levels: [level], saveKey: 'wxgame.beads.test.replayrevive' });
    const shell = new BeadsShell({
      clock: () => 0,
      metaKey: 'wxgame.beads.test.replayrevive-meta',
      initialScreen: 'play',
      // `[WXG-T-1081]` 本套用例靠「耗尽时间」走到 game-over ⇒ 夹具须预置计时闸开
      // （生产默认 = 等玩家首次操作，闸门关着永远不会超时）。
      play: { levels: [level], armClockOnStart: true },
    });
    shell.init(h.services);

    // 1. 耗尽时间 ⇒ GAME_OVER（真实失败路径）。
    let guard = 0;
    while (shell.play.phase === 'playing' && guard++ < 100000) shell.update(0.5);
    expect(shell.play.phase).toBe('game-over');

    // 2. 广告续时（真实 fail 面板入口 + Mock 发奖）。
    expect(shell.play.requestRevive()).toBe(true);
    (h.services.rewardedAd as MockRewardedAdProvider).settle('complete');
    expect(shell.play.phase).toBe('playing');
    expect(shell.play.revived).toBe(true);

    // 3. 托管代打吃完（正常结算路径）。
    shell.play.setAssist('bot');
    guard = 0;
    while (shell.play.phase === 'playing' && guard++ < 200000) shell.update(1 / 60);
    shell.update(1 / 60);
    expect(shell.play.phase).toBe('level-clear');

    const rec = shell.replayRecorder.lastRecording;
    expect(rec, '续时局必须产出录像').toBeTruthy();
    expect(rec!.context.revived, '上下文须登记已续时').toBe(true);
    expect(rec!.events.some((e) => e.cmd === 'revive'), '时间线须有 revive 事件').toBe(true);

    // 4. 回放：影子按 revive 事件复位 → 播完终局对拍（remainingMs / actions / 棋盘 / 托盘全字段）。
    expect(shell.enterReplay('own-last')).toBe(true);
    const player = (shell as unknown as { _replayPlayer: ReplayPlayer })._replayPlayer;
    guard = 0;
    while (!player.ended && guard++ < 100000) player.tick(1000);
    expect(player.ended).toBe(true);
    expect(player.finalCheck?.diffs, `diffs=${player.finalCheck?.diffs.join(',')}`).toEqual([]);
    expect(player.finalCheck?.ok).toBe(true);
  });
});
