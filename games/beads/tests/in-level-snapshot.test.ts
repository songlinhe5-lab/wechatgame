/**
 * S8 崩溃恢复档（D-03 落码轮，WXG-T-059）—— 判据取自
 * `games/beads/design/proposals/in-level-snapshot.md` §6（原标 `[待冻结]`，
 * 2026-09-14 主理人裁定「执行」后去标）。
 *
 * 独立于 S8 常规档用例（提案 §7 明写：不把崩溃档断言塞进 S8 常规用例）。
 * 环境限制（提案 §7 末）：无真机，「杀进程」用「写快照 → 新 harness 读同一 storage」模拟。
 */

import { describe, it, expect } from 'vitest';
import type { Storage } from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import {
  CRASH_KEY,
  CrashSnapshotStore,
  decodeFilledBits,
  encodeFilledBits,
  parseCrashSnapshot,
} from '../src/game/crash-snapshot.js';
import { pausePanelLayout } from '../src/systems/pause-panel.js';
import { multiplierForStreak, tierForStreak } from '../src/systems/sprint.js';
import {
  createBeadsHarness,
  placeAnyMatching,
  placeColor,
  simpleTestLevel,
  type Harness,
} from './helpers.js';

const SAVE_KEY = 'wxgame.beads.test.crash.s8';

interface WriteLog {
  key: string;
  kind: 'set' | 'remove';
}

/** 计数 storage：用于断言「S8 常规键写次数」这类事件级事实。 */
function spyStorage(inner: Storage): { storage: Storage; log: WriteLog[] } {
  const log: WriteLog[] = [];
  const storage: Storage = {
    get: (k: string) => inner.get(k),
    set: (k: string, v: string) => {
      log.push({ key: k, kind: 'set' });
      inner.set(k, v);
    },
    remove: (k: string) => {
      log.push({ key: k, kind: 'remove' });
      inner.remove(k);
    },
    keys: () => inner.keys(),
    clear: () => inner.clear(),
  };
  return { storage, log };
}

function newStorage(): Storage {
  return new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createStorage();
}

function boot(storage: Storage, options: { levels?: ReturnType<typeof simpleTestLevel>[] } = {}): Harness {
  return createBeadsHarness({
    ...(options.levels ? { levels: options.levels } : {}),
    saveKey: SAVE_KEY,
    storage,
  });
}

/** 暂停面板的「继续」按钮中心——走真实 UI 路径退出 PAUSED。 */
function tapResume(game: Harness['game']): void {
  const button = pausePanelLayout('normal').buttons.find((b) => b.id === 'resume')!;
  game.tapDesign((button.rect.xMin + button.rect.xMax) / 2, (button.rect.yMin + button.rect.yMax) / 2);
}

function crashRaw(storage: Storage): string | null {
  return storage.get(CRASH_KEY);
}

const s8Writes = (log: WriteLog[], kind: 'set' | 'remove' = 'set'): number =>
  log.filter((e) => e.key === SAVE_KEY && e.kind === kind).length;

describe('S8 §8-11 崩溃档：onHide 写入与 S8 隔离', () => {
  // §8-11 PLAYING 中 onPause（模拟 onHide）→ 崩溃键存在且关键字段与内存一致；
  // 随后连续落子 **S8 常规键写次数仍为 0**（联合 S8 §8-9 的「PLAYING 不写档」）。
  it('§8-11 writes the crash key on hide and never touches S8 while placing', () => {
    const inner = newStorage();
    const { storage, log } = spyStorage(inner);
    const harness = boot(storage, { levels: [simpleTestLevel()] });
    const game = harness.game;

    // 放几颗，制造可观测的局内态差异。
    expect(placeColor(game, 1, 0, 0)).toBe(true);
    expect(placeColor(game, 2, 0, 1)).toBe(true);
    harness.advance(12);
    const remainingBefore = game.remaining;

    const s8Before = s8Writes(log);
    game.onPause(); // = platform.onHide
    expect(game.phase).toBe('paused');

    const raw = crashRaw(storage);
    expect(raw).not.toBeNull();
    const snapshot = JSON.parse(raw!) as Record<string, unknown>;
    expect(snapshot['version']).toBe(1);
    expect(snapshot['mode']).toBe('normal');
    expect(snapshot['levelIndex']).toBe(game.levelIndex);
    expect(snapshot['remaining']).toBeCloseTo(remainingBefore, 6);
    expect(snapshot['timeTotal']).toBe(300); // simpleTestLevel 的 time

    // 位图：只含可填格，行主序；(0,0) 与 (0,1) 已填 ⇒ 前两位为 '1'。
    const bits = snapshot['gridFilled'] as string;
    expect(bits).toHaveLength(game.grid.fillableTotal);
    expect(bits.slice(0, 2)).toBe('11');
    expect(bits.slice(2)).toMatch(/^0*$/);

    // 托盘与内存一致（两槽已被消费 ⇒ 快照里应为 free）。
    const slots = snapshot['traySlots'] as { colorIdx: number }[];
    expect(slots).toHaveLength(12);
    // 逐槽与内存一致 —— 注意 advance(12) 期间供料器已按节律投过珠，不能假设全 free。
    for (let i = 0; i < slots.length; i++) {
      const live = game.tray.slot(i)!;
      expect(slots[i]!.colorIdx, `slot ${i}`).toBe(live.state === 'free' ? 0 : live.colorIdx);
    }

    // 回到 PLAYING 后连续落子：S8 常规键**零写**（仅崩溃键会被 onHide 再写）。
    tapResume(game);
    expect(game.phase).toBe('playing');
    for (let i = 0; i < 40; i++) {
      placeColor(game, game.grid.requiredColor(1, i % 6), 1, i % 6); // 命中/未命中都算一次动作
    }
    for (let i = 0; i < 60; i++) harness.advance(1 / 60);
    expect(s8Writes(log)).toBe(s8Before);
  });

  // §8-12 PAUSED（手动齿轮）后再 onPause → 崩溃键被覆盖写入；onResume 不删不改；
  // 点「继续」前杀进程再 BOOT → 恢复为 PAUSED，remaining 误差 ≤ 1 帧 dt。
  it('§8-12 overwrites the crash key when already paused; onResume is a no-op', () => {
    const inner = newStorage();
    const harness = boot(inner, { levels: [simpleTestLevel()] });
    const game = harness.game;
    harness.advance(20);

    // 齿轮 → 手动暂停。
    game.tapDesign(40, 1270);
    expect(game.phase).toBe('paused');
    expect(game.pauseIntent).toBe('manual');
    expect(crashRaw(inner)).toBeNull(); // 手动暂停**不写**快照（提案 §3：只挂 onHide）

    // 手动暂停期间切出 → 仍要写（否则杀进程丢手动暂停局）。
    const remainingBefore = game.remaining;
    game.onPause();
    const first = crashRaw(inner);
    expect(first).not.toBeNull();
    // 快照**如实**记录「当时为何暂停」= manual（提案 §2：D-04 助手字段）；
    // 归一为 system 发生在**恢复**时（§4），见下方 BOOT 断言。
    expect((JSON.parse(first!) as { pauseIntent: string }).pauseIntent).toBe('manual');

    // onResume（回前台）不删不改。
    game.onResume();
    expect(crashRaw(inner)).toBe(first);
    expect(game.phase).toBe('paused');

    // 杀进程 → 新 harness 读同一 storage。
    const relaunch = boot(inner, { levels: [simpleTestLevel()] });
    expect(relaunch.game.phase).toBe('paused');
    expect(relaunch.game.pauseIntent).toBe('system');
    expect(Math.abs(relaunch.game.remaining - remainingBefore)).toBeLessThanOrEqual(1 / 60 + 1e-6);
  });

  // §8-13 损坏 / 长度不符 / 越界 → 进常规新局，S8 字段无损，无异常抛出。
  it('§8-13 degrades every corrupt shape to a normal boot without touching S8', () => {
    const cases: [string, string][] = [
      ['JSON 坏', '{not json'],
      ['非对象', '42'],
      ['version 不符', JSON.stringify({ version: 99 })],
      ['位图长度不符', JSON.stringify({ version: 1, mode: 'normal', levelIndex: 0, gridFilled: '11' })],
      ['levelIndex 越界', JSON.stringify({ version: 1, mode: 'normal', levelIndex: 99, gridFilled: '' })],
    ];

    for (const [label, raw] of cases) {
      const inner = newStorage();
      inner.set(CRASH_KEY, raw);
      // S8 先落一份真实进度，验证「不因快照坏而受损」。
      // ⚠️ `runs` 每次 BOOT **按设计 +1**（不是损坏），故比对时把它排除、单独断言 +1。
      boot(inner, { levels: [simpleTestLevel()] });
      const s8Before = JSON.parse(inner.get(SAVE_KEY)!) as Record<string, unknown>;

      let relaunch!: Harness;
      expect(() => {
        relaunch = boot(inner, { levels: [simpleTestLevel()] });
      }, label).not.toThrow();
      expect(relaunch.game.phase, label).toBe('playing');

      const s8After = JSON.parse(inner.get(SAVE_KEY)!) as Record<string, unknown>;
      expect(s8After['runs'], label).toBe((s8Before['runs'] as number) + 1);
      const { runs: _before, ...restBefore } = s8Before;
      const { runs: _after, ...restAfter } = s8After;
      expect(restAfter, label).toEqual(restBefore);
      expect(crashRaw(inner), label).toBeNull(); // 坏档已被清掉
    }
  });

  // §8-14 过关 / 失败路径结束时崩溃键被删除；再 BOOT 不得恢复已结束的那一局。
  it('§8-14 clears the crash key when the level ends (clear and game-over)', () => {
    // 过关
    const cleared = newStorage();
    const level = simpleTestLevel();
    const h1 = boot(cleared, { levels: [level] });
    h1.game.onPause();
    expect(crashRaw(cleared)).not.toBeNull();
    tapResume(h1.game);
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        placeColor(h1.game, h1.game.grid.requiredColor(r, c), r, c);
      }
    }
    expect(h1.game.phase).toBe('level-clear');
    expect(crashRaw(cleared)).toBeNull();
    expect(boot(cleared, { levels: [level] }).game.phase).toBe('playing'); // 不得恢复已结束的那局

    // 失败（倒计时归零）
    const over = newStorage();
    const h2 = boot(over, { levels: [simpleTestLevel()] });
    h2.game.onPause();
    expect(crashRaw(over)).not.toBeNull();
    tapResume(h2.game);
    h2.advance(320);
    expect(h2.game.phase).toBe('game-over');
    expect(crashRaw(over)).toBeNull();
  });

  // §8-15 sprint：恢复后 streak / windowRemaining / stageIndex / score 与 hide 前一致；
  // PAUSED 期间连击窗口继续冻结。
  it('§8-15 restores the sprint runtime state faithfully', () => {
    const inner = newStorage();
    const harness = boot(inner, { levels: [simpleTestLevel()] });
    const game = harness.game;
    game.startSprint();
    expect(game.mode).toBe('sprint');
    // 先让 S4 供料把托盘喂上珠（冲刺开局托盘是空的），再连续命中。
    // ⚠️ 不能要求「恰好落 N 颗」：某个颜色的空位可能已被填完，或托盘只投到该色的单格珠
    // —— 那是合法的抽色结果，不是缺陷。目标是**有活的连击**（streak ≥ 2 才有 ×2 tier）。
    harness.advance(30);
    let placed = 0;
    for (let i = 0; i < 4 && placeAnyMatching(game); i++) placed += 1;
    expect(placed).toBeGreaterThanOrEqual(2);
    expect(game.sprintTracker.streak).toBe(placed);
    harness.advance(1.5);

    const before = {
      streak: game.sprintTracker.streak,
      score: game.sprintTracker.score,
      stageIndex: game.sprintTracker.stageIndex,
      window: game.sprintTracker.windowRemaining,
      remaining: game.remaining,
    };
    game.onPause();
    const relaunch = boot(inner, { levels: [simpleTestLevel()] });
    const restored = relaunch.game;
    expect(restored.phase).toBe('paused');
    expect(restored.mode).toBe('sprint');
    expect(restored.sprintTracker.streak).toBe(before.streak);
    expect(restored.sprintTracker.score).toBe(before.score);
    expect(restored.sprintTracker.stageIndex).toBe(before.stageIndex);
    // 口径：恢复**不信任**快照里的 multiplier/tier，而是由 streak **重算**（提案 §2）。
    // 故这里用同一个纯函数独立复核，而不是复述档位表（[2,4,7] → ×2/×3/×5）。
    expect(restored.sprintTracker.multiplier).toBe(multiplierForStreak(before.streak));
    expect(restored.sprintTracker.tier).toBe(tierForStreak(before.streak));
    expect(restored.sprintTracker.windowRemaining).toBeCloseTo(before.window, 6);
    expect(restored.remaining).toBeCloseTo(before.remaining, 6);

    // PAUSED 期间窗口冻结。
    relaunch.advance(5);
    expect(restored.sprintTracker.windowRemaining).toBeCloseTo(before.window, 6);
  });

  // §8-16 道具次数：缺省字段不导致丢快照；越界按字段钳制而不丢整份。
  // WXG-T-060（S6 落码）起上限也可钳：`POWERUP_FREE_USES` 常量已可用 ⇒ 钳到 [0, 1]。
  it('§8-16 treats powerupUses as an optional, field-clamped document', () => {
    const base = {
      version: 1,
      mode: 'normal',
      levelIndex: 0,
      gridFilled: '0'.repeat(30),
      traySlots: Array.from({ length: 12 }, () => ({ colorIdx: 0 })),
      trayExpanded: false,
      traySelected: -1,
      remaining: 120,
      timeTotal: 300,
      spawnAcc: 1,
      spawnInterval: 4,
      spawnFullReported: false,
    };
    const ctx = { levelCount: 1, fillableCountFor: () => 30 };

    const missing = parseCrashSnapshot(base, ctx);
    expect(missing.snapshot).not.toBeNull();
    expect(missing.snapshot!.powerupUses).toEqual({ region: 0, clearAll: 0, random: 0 });

    const clamped = parseCrashSnapshot(
      { ...base, powerupUses: { region: -3, clearAll: 2.5, random: 7 } },
      ctx,
    );
    // 上限 = POWERUP_FREE_USES = 1（§3.6；同值由 powerups.test.ts 的常量镜像断言守卫）。
    expect(clamped.snapshot?.powerupUses).toEqual({ region: 0, clearAll: 0, random: 1 });
  });

  // 提案 §2 的两项增补字段（T-057 冻结规则的必要载体）：缺省 0，且会被真正持久化。
  it('carries reviveCount / reviveBonusSec, which guard REVIVE_MAX_PER_LEVEL', () => {
    const ctx = { levelCount: 1, fillableCountFor: () => 30 };
    const missing = parseCrashSnapshot({ version: 1, mode: 'normal', levelIndex: 0, gridFilled: '0'.repeat(30), traySlots: Array.from({ length: 12 }, () => ({ colorIdx: 0 })), trayExpanded: false, remaining: 10, timeTotal: 300, spawnAcc: 0, spawnInterval: 4 }, ctx);
    expect(missing.snapshot?.reviveCount).toBe(0);
    expect(missing.snapshot?.reviveBonusSec).toBe(0);

    const inner = newStorage();
    const harness = boot(inner, { levels: [simpleTestLevel()] });
    harness.game.onPause();
    const raw = JSON.parse(crashRaw(inner)!) as Record<string, unknown>;
    expect(raw['reviveCount']).toBe(0);
    expect(raw['reviveBonusSec']).toBe(0);
  });
});

describe('崩溃档纯函数（位图与存储）', () => {
  it('round-trips the fillable-cell bitmap and rejects wrong shapes', () => {
    const bits = [true, false, true, true];
    expect(encodeFilledBits(bits)).toBe('1011');
    expect(decodeFilledBits('1011', 4)).toEqual(bits);
    expect(decodeFilledBits('1011', 5)).toBeNull(); // 长度不符
    expect(decodeFilledBits('10x1', 4)).toBeNull(); // 非法字符
    expect(decodeFilledBits(42, 4)).toBeNull(); // 非字符串
  });

  it('never throws from the store, and clears an unparseable document', () => {
    const inner = newStorage();
    inner.set(CRASH_KEY, '{oops');
    const store = new CrashSnapshotStore(inner);
    expect(() => store.read({ levelCount: 0, fillableCountFor: () => 0 })).not.toThrow();
    expect(store.read({ levelCount: 0, fillableCountFor: () => 0 })).toBeNull();
    expect(inner.get(CRASH_KEY)).toBeNull();
    expect(store.write).toBeTypeOf('function');
  });
});
