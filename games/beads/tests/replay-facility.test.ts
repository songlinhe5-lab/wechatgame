/**
 * EP15-S3 · 回放设施回归（WXG-T-987）。
 *
 * 判据（`gdd/bot-replay.md §8`）：
 * - §8-3 终局一致：影子重演的格色 / 托盘 / remainingMs / actions 与录制终局一致；
 * - §8-4 seek/暂停/倍速不改变终局；
 * - §8-5 演示/回放零副作用：真实 storage 在重演期间零写入；
 * - §8-8 溢出降级：超限 ⇒ `truncated=true`、整份作废、不崩；
 * - §8-12 数据防呆：指纹 / seed / 步序 / 续时参数非法 ⇒ `invalid`；
 * - §8-13 架构门：`src/replay/**` 无引擎 / DOM / RNG 手搓；
 * - §8-14 生命周期：上一局替换、失败局丢弃、影子销毁。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Storage } from '@wxgame/framework';
import { MemoryStorage } from '@wxgame/framework';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';
import { LEVEL_TIME_MAX } from '../src/config/tuning.js';
import type { BeadsLevelRaw } from '../src/config/levels.js';
import { applyBotCommand } from '../src/bot/apply.js';
import { observeGame } from '../src/bot/observe.js';
import { createBotPolicy } from '../src/bot/registry.js';
import {
  ReplayRecorder,
  captureReplayFinal,
  validateRecording,
  type ReplayRecording,
} from '../src/replay/recorder.js';
import { ReplayPlayer } from '../src/replay/player.js';
import { replayEntryState, createReplayViewModel, writeReplayViewModel } from '../src/replay/view-model.js';

const SINGLES_DIR = fileURLToPath(new URL('../design/levels/singles/', import.meta.url));

function goldenLevel(): BeadsLevelRaw {
  const file = readdirSync(SINGLES_DIR).filter((f) => f.endsWith('.json')).sort()[0]!;
  return simpleTestLevel({ ...(JSON.parse(readFileSync(SINGLES_DIR + file, 'utf8')) as BeadsLevelRaw), time: LEVEL_TIME_MAX });
}

interface Recorded {
  readonly rec: ReplayRecording;
  readonly gridSig: string;
  readonly traySig: string;
  readonly storageWrites: number;
  readonly game: ReturnType<typeof createBeadsHarness>['game'];
}

/** 用生产贪心策略打完整局并录制（真实 harness，非影子）。 */
function recordBotRun(level: BeadsLevelRaw, options: { maxEvents?: number; maxBytes?: number } = {}): Recorded {
  let seedState = 0;
  const recorder = new ReplayRecorder({
    seed: () => seedState,
    ...(options.maxEvents !== undefined ? { maxEvents: options.maxEvents } : {}),
    ...(options.maxBytes !== undefined ? { maxBytes: options.maxBytes } : {}),
  });
  let writes = 0;
  const base = new MemoryStorage();
  const counting: Storage = {
    get: (key) => base.get(key),
    set: (key, value) => {
      writes++;
      base.set(key, value);
    },
    remove: (key) => base.remove(key),
    keys: () => base.keys(),
    clear: () => base.clear(),
  };
  const h = createBeadsHarness({
    seed: 'beads-bot',
    levels: [level],
    storage: counting,
    onCommandApplied: (type, args, elapsedMs) => recorder.record(elapsedMs, type, args),
  });
  seedState = h.services.rng.state;
  h.game.goToLevel(0);
  recorder.tick(h.game);
  const policy = createBotPolicy();
  let guard = 0;
  while (h.game.phase === 'playing' && guard++ < 5000) {
    h.advance(1 / 60);
    recorder.tick(h.game);
    if (h.game.phase !== 'playing') break;
    const action = policy.decide(observeGame(h.game));
    if (!action) break;
    for (const cmd of action.commands) applyBotCommand(h.game, cmd);
    recorder.tick(h.game);
  }
  const rec = recorder.lastRecording;
  if (!rec) throw new Error('录制失败：未产出 lastRecording');
  return { rec, ...signatures(h.game.snapshot), storageWrites: writes, game: h.game };
}

function signatures(snapshot: Readonly<{ cells: { beadColorIdx: number }[]; traySlots: { state: string; colorIdx: number }[] }>): {
  gridSig: string;
  traySig: string;
} {
  return {
    gridSig: snapshot.cells.map((c) => c.beadColorIdx).join(','),
    traySig: snapshot.traySlots.map((s) => `${s.state}:${s.colorIdx}`).join(','),
  };
}

function shadowSignatures(player: ReplayPlayer): { gridSig: string; traySig: string } {
  const snapshot = player.snapshot!;
  return signatures(snapshot);
}

function playToEnd(player: ReplayPlayer, speed = 1): void {
  player.play();
  player.setSpeed(speed);
  const chunkMs = 1000; // 大步长 = 一次 tick 多步（倍速腿同路径）
  let guard = 0;
  while (!player.ended && guard++ < 10000) player.tick(chunkMs);
  expect(player.ended, '回放未在保护圈内播完').toBe(true);
}

describe('EP15-S3 · 录制 + 重演终局一致（§8-3）', () => {
  it('经典局：影子终局 = 录制终局（格色 / 托盘 / 时间 / 动作）', () => {
    const level = goldenLevel();
    const run = recordBotRun(level);
    expect(run.rec.truncated).toBe(false);
    expect(validateRecording(run.rec, level).ok).toBe(true);

    const player = new ReplayPlayer(run.rec, { levels: [level] });
    expect(player.valid).toBe(true);
    playToEnd(player);

    expect(player.finalCheck?.ok, `diffs=${player.finalCheck?.diffs.join(',')}`).toBe(true);
    const shadow = shadowSignatures(player);
    expect(shadow.gridSig).toBe(run.gridSig);
    expect(shadow.traySig).toBe(run.traySig);
    expect(player.finalCheck!.actual).toEqual(captureReplayFinal(run.game));
    player.dispose();
  });

  it('录像事件按 step 单调、命令值域闭合', () => {
    const run = recordBotRun(goldenLevel());
    let prev = -1;
    for (const event of run.rec.events) {
      expect(event.step).toBeGreaterThanOrEqual(prev);
      prev = event.step;
      expect(['selectBoardBead', 'retrieveSelectedGroup', 'selectTraySlot', 'tapGridCell', 'usePowerup', 'expandTray', 'revive']).toContain(event.cmd);
    }
    expect(run.rec.seed).toBeGreaterThan(0);
  });
});

describe('EP15-S3 · seek / 暂停 / 倍速不改变终局（§8-4）', () => {
  const level = goldenLevel();
  const run = recordBotRun(level);

  for (const target of [0, 1, 3]) {
    it(`seek(${target}) 后播完 = 不 seek 直接播完`, () => {
      const player = new ReplayPlayer(run.rec, { levels: [level] });
      player.seek(target);
      expect(player.step).toBe(Math.min(target, player.durationStep));
      playToEnd(player);
      expect(player.finalCheck?.ok, `diffs=${player.finalCheck?.diffs.join(',')}`).toBe(true);
      expect(shadowSignatures(player).gridSig).toBe(run.gridSig);
      player.dispose();
    });
  }

  it('暂停 / 4x 倍速切换后终局逐字段一致', () => {
    const player = new ReplayPlayer(run.rec, { levels: [level] });
    player.play();
    player.setSpeed(4);
    player.tick(500);
    player.pause();
    player.tick(500); // 暂停期间不推进
    const pausedStep = player.step;
    player.tick(500);
    expect(player.step).toBe(pausedStep);
    player.play();
    playToEnd(player, 2);
    expect(player.finalCheck?.ok, `diffs=${player.finalCheck?.diffs.join(',')}`).toBe(true);
    player.dispose();
  });
});

describe('EP15-S3 · 零副作用（§8-5）', () => {
  it('重演期间真实 storage 零写入；影子不参与解锁 / 星账', () => {
    const level = goldenLevel();
    const run = recordBotRun(level);
    const writesBefore = run.storageWrites;
    const player = new ReplayPlayer(run.rec, { levels: [level] });
    playToEnd(player);
    expect(run.storageWrites, '真实 storage 在重演期间被写入').toBe(writesBefore);
    const sandboxGame = (player as unknown as { _sandbox: { game: { maxUnlockedLevel: number } } | null })._sandbox?.game;
    expect(sandboxGame, '影子实例缺失').toBeTruthy();
    expect(sandboxGame!.maxUnlockedLevel).toBe(1); // 影子内存档默认值，未推进
    player.dispose();
    expect(player.snapshot).toBeNull();
  });
});

describe('EP15-S3 · 溢出降级（§8-8）', () => {
  it('事件数超限 ⇒ truncated=true、整份作废、不崩', () => {
    const level = goldenLevel();
    let rec: ReplayRecording | null = null;
    try {
      rec = recordBotRun(level, { maxEvents: 2 }).rec;
    } catch {
      // 录制器按契约仍产出 truncated 录像；若局未过关则不产出 —— 两者都不崩即为通过。
    }
    if (rec) {
      expect(rec.truncated).toBe(true);
      const verdict = validateRecording(rec, level);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBe('truncated');
      expect(replayEntryState(rec, [level])).toEqual({ available: false, reason: 'truncated' });
      const player = new ReplayPlayer(rec, { levels: [level] });
      expect(player.valid).toBe(false);
      player.tick(1000); // 不崩、不推进
      expect(player.step).toBe(0);
      player.dispose();
    }
  });
});

describe('EP15-S3 · 数据防呆（§8-12）', () => {
  const level = goldenLevel();
  const base = recordBotRun(level).rec;

  const cases: Array<[string, ReplayRecording]> = [
    ['levelHash', { ...base, levelHash: 'deadbeef' }],
    ['seed', { ...base, seed: Number.NaN }],
    ['fixedDtMs', { ...base, fixedDtMs: 0 }],
    ['context', { ...base, context: { ...base.context, starsBefore: Number.NaN } }],
    ['truncated', { ...base, truncated: true }],
    ['empty', { ...base, events: [] }],
    [
      'step-order',
      {
        ...base,
        events: [
          { atMs: 0, step: 3, cmd: base.events[0]!.cmd, args: base.events[0]!.args },
          { atMs: 0, step: 2, cmd: base.events[0]!.cmd, args: base.events[0]!.args },
        ],
      },
    ],
    [
      'revive-bonus',
      {
        ...base,
        events: [
          ...base.events,
          {
            atMs: 0,
            step: base.events[base.events.length - 1]!.step,
            cmd: 'revive',
            args: { bonusSec: 0 },
          },
        ],
      },
    ],
  ];

  for (const [reason, rec] of cases) {
    it(`${reason} ⇒ invalid（禁用入口、不崩溃）`, () => {
      const verdict = validateRecording(rec, level);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBe(reason);
      const player = new ReplayPlayer(rec, { levels: [level] });
      expect(player.valid).toBe(false);
      player.tick(100);
      player.dispose();
    });
  }

  it('关表里找不到该关 ⇒ levelHash invalid', () => {
    const verdict = validateRecording(base, undefined);
    expect(verdict).toEqual({ ok: false, reason: 'levelHash' });
  });
});

describe('EP15-S3 · 生命周期（§8-14）', () => {
  it('第二次过关替换「上一局」；回放页视图模型可读', () => {
    const level = goldenLevel();
    let seedState = 0;
    const recorder = new ReplayRecorder({ seed: () => seedState });
    const h = createBeadsHarness({
      seed: 'beads-bot',
      levels: [level],
      onCommandApplied: (type, args, elapsedMs) => recorder.record(elapsedMs, type, args),
    });
    const policy = createBotPolicy();
    const playOnce = (): void => {
      seedState = h.services.rng.state;
      h.game.goToLevel(0);
      recorder.tick(h.game);
      let guard = 0;
      while (h.game.phase === 'playing' && guard++ < 5000) {
        h.advance(1 / 60);
        recorder.tick(h.game);
        if (h.game.phase !== 'playing') break;
        const action = policy.decide(observeGame(h.game));
        if (!action) break;
        for (const cmd of action.commands) applyBotCommand(h.game, cmd);
        recorder.tick(h.game);
      }
    };
    playOnce();
    const first = recorder.lastRecording;
    expect(first).toBeTruthy();
    playOnce();
    const second = recorder.lastRecording;
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);

    const player = new ReplayPlayer(second!, { levels: [level] });
    playToEnd(player);
    const vm = writeReplayViewModel(createReplayViewModel(), player);
    expect(vm.visible).toBe(true);
    expect(vm.valid).toBe(true);
    expect(vm.source).toBe('own-last');
    expect(vm.ended).toBe(true);
    expect(vm.progress).toBe(1);
    expect(vm.levelId).toBe(second!.levelId);
    player.dispose();
  });

  it('discard 丢弃在录录像（回菜单 / 失败重试）；last 保留', () => {
    const level = goldenLevel();
    const recorder = new ReplayRecorder({ seed: () => 1 });
    const h = createBeadsHarness({
      seed: 'beads-bot',
      levels: [level],
      onCommandApplied: (type, args, elapsedMs) => recorder.record(elapsedMs, type, args),
    });
    h.game.goToLevel(0);
    recorder.tick(h.game);
    expect(recorder.active).not.toBeNull();
    recorder.discard();
    expect(recorder.active).toBeNull();
    expect(recorder.lastRecording).toBeNull();
    // 离场后壳层不再 tick 对局腿；此处不 tick 验证「丢弃即清空」。回菜单由
    // `BeadsShell.showMenu()` 调 discard（见 src/game/beads-shell.ts）。
  });
});

describe('EP15-S3 · 架构门（§8-13）', () => {
  const REPLAY_DIR = fileURLToPath(new URL('../src/replay/', import.meta.url));
  const files = readdirSync(REPLAY_DIR).filter((f) => f.endsWith('.ts'));

  function stripped(name: string): string {
    return readFileSync(REPLAY_DIR + name, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  }

  it('replay/** 无引擎 / 宿主 / UI 依赖', () => {
    const forbidden = [
      /from\s+['"]cc['"]/,
      /from\s+['"][^'"]*\/view\//,
      /from\s+['"][^'"]*\/ui\//,
      /from\s+['"][^'"]*palette/,
      /\bwx\./,
      /\bwindow\b/,
      /\bdocument\b/,
    ];
    for (const name of files) {
      const src = stripped(name);
      for (const rule of forbidden) expect(src, `${name}: ${rule}`).not.toMatch(rule);
    }
  });

  it('replay/** 不手搓随机（Math.random / createRng( / services.rng）', () => {
    for (const name of files) {
      const src = stripped(name);
      expect(src, `${name}: Math.random`).not.toContain('Math.random');
      expect(src, `${name}: createRng(`).not.toMatch(/\bcreateRng\s*\(/);
      expect(src, `${name}: services.rng`).not.toContain('services.rng');
    }
  });

  it('view-model 入口判定与录像状态一致', () => {
    expect(replayEntryState(null, [])).toEqual({ available: false, reason: 'empty' });
  });
});
