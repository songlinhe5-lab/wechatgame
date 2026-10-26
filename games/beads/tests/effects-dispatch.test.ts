/**
 * 效果派发协作模块单测（WXG-T-420 T5）。
 *
 * 判据 = `docs/architecture/beads-arch-review-2026-10-26.md` §6 T5 行 +
 * `production/TASKS-DETAIL.md` WXG-T-420 §3.5：抽 `effects-dispatch.ts` 承接
 * 音频 / 震动 / 广告 / 分享 / 体力弹窗的**副作用派发**，订阅顺序与用户可见行为不变。
 *
 * 反假绿纪律（K-042 / K-152）：本文件断言的是**契约**（事件 → clip / haptic kind、
 * ad load+show、share 透传），⛔ 不复制被测真源；`attachAudioCues` 的端到端时序与限流
 * 由既有 `audio-dispatch.test.ts`（36 例）守，广告发奖路由由 `revive` / `run-start-stamina` /
 * `arc-stamina-refill` 守 —— 本文件只补它们**没覆盖**的：模块级派发契约 + 震动派生的
 * 「接线证明」（K-106：新模块须被运行时真正走到，而不只是被 typecheck 看到）。
 */

import { describe, expect, it, vi } from 'vitest';

import { EventBus, type EventMap, type GameServices, type RewardedAdProvider } from '@wxgame/framework';

import {
  attachAudioCues,
  fireRewardedAd,
  fireShare,
  hapticKindFor,
} from '../src/game/beads-game/effects-dispatch.js';
import {
  AUDIO_CLIP_CLEAR,
  AUDIO_CLIP_COMBO_BREAK,
  AUDIO_CLIP_COMBO_T1,
  AUDIO_CLIP_COMBO_T2,
  AUDIO_CLIP_COMBO_T3,
  AUDIO_CLIP_DISSOLVE,
  AUDIO_CLIP_PLACE,
  AUDIO_CLIP_POWERUP,
  AUDIO_CLIP_REJECT,
  AUDIO_CLIP_SELECT,
  AUDIO_CLIP_STAGE,
  AUDIO_CLIP_TRAY_FULL,
  AUDIO_CLIP_URGENT_BEAT,
  TIMER_URGENT_T,
} from '../src/config/tuning.js';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';

/** 收集所有派发出去的 clip（顺序即注册序内同一 emit 的处理序）。 */
function recordingSink(): { played: string[]; sfx: (clipId: string) => void } {
  const played: string[] = [];
  return { played, sfx: (clipId) => played.push(clipId) };
}

describe('hapticKindFor · 事件 → 触觉 kind 映射（震动派发的唯一真源）', () => {
  it('七条映射逐条命中（与 WXG-T-403 表一致）', () => {
    expect(hapticKindFor('bead:placed')).toBe('light');
    expect(hapticKindFor('bead:rejected')).toBe('heavy');
    expect(hapticKindFor('combo:up')).toBe('medium');
    expect(hapticKindFor('combo:break')).toBe('heavy');
    expect(hapticKindFor('level:cleared')).toBe('success');
    expect(hapticKindFor('level:failed')).toBe('warning');
    expect(hapticKindFor('powerup:used')).toBe('medium');
  });

  it('故意不映射的事件返回 undefined（元事件 / 已过细 / haptic 自身防递归）', () => {
    for (const type of [
      'haptic:trigger',
      'tray:selected',
      'tray:full',
      'tray:expanded',
      'timer:tick',
      'timer:urgent',
      'settings:vibrate',
      'sprint:stage',
      'game:paused',
      'unknown:event',
    ]) {
      expect(hapticKindFor(type), type).toBeUndefined();
    }
  });
});

describe('attachAudioCues · 事件 → clip 派发契约（audio-events §1 触发源）', () => {
  function rig() {
    const bus = new EventBus<EventMap>();
    const sink = recordingSink();
    const unsubs = attachAudioCues(bus, sink.sfx);
    return { bus, played: sink.played, unsubs };
  }

  it('单事件 → 单 clip：place / select / reject / break / stage / clear / tray_full', () => {
    const cases: [string, unknown, string][] = [
      ['bead:placed', { row: 0, col: 0, colorIdx: 0, slot: 0 }, AUDIO_CLIP_PLACE],
      ['tray:selected', { slot: 0, colorIdx: 0 }, AUDIO_CLIP_SELECT],
      ['bead:rejected', { row: 0, col: 0, colorIdx: 0 }, AUDIO_CLIP_REJECT],
      ['combo:break', { reason: 'timeout' }, AUDIO_CLIP_COMBO_BREAK],
      ['sprint:stage', { stageIndex: 1, nextParams: {} }, AUDIO_CLIP_STAGE],
      ['level:cleared', { levelId: 'L90', remaining: 1, ratio: 1, stars: 3 }, AUDIO_CLIP_CLEAR],
      ['tray:full', {}, AUDIO_CLIP_TRAY_FULL],
    ];
    for (const [type, payload, clip] of cases) {
      const { bus, played } = rig();
      bus.emit(type, payload);
      expect(played, type).toEqual([clip]);
    }
  });

  it('powerup:used 有作用格 ⇒ 同帧两条并存（powerup + dissolve）；空格 ⇒ 零发声', () => {
    const hit = rig();
    hit.bus.emit('powerup:used', { type: 'clear-slot', affectedCells: [{ row: 0, col: 0 }] });
    expect(hit.played).toEqual([AUDIO_CLIP_POWERUP, AUDIO_CLIP_DISSOLVE]);

    const empty = rig();
    empty.bus.emit('powerup:used', { type: 'clear-slot', affectedCells: [] });
    expect(empty.played).toEqual([]);

    const missing = rig();
    missing.bus.emit('powerup:used', { type: 'random' });
    expect(missing.played).toEqual([]);
  });

  it('combo:up 三档分流不串音；tier=0 零发声', () => {
    const byTier: Record<number, string> = {
      1: AUDIO_CLIP_COMBO_T1,
      2: AUDIO_CLIP_COMBO_T2,
      3: AUDIO_CLIP_COMBO_T3,
    };
    for (const tier of [1, 2, 3]) {
      const { bus, played } = rig();
      bus.emit('combo:up', { streak: tier + 1, multiplier: tier, tier });
      expect(played, `tier=${tier}`).toEqual([byTier[tier]]);
    }
    const zero = rig();
    zero.bus.emit('combo:up', { streak: 1, multiplier: 1, tier: 0 });
    expect(zero.played).toEqual([]);
  });

  it('告急心跳：timer:urgent 边沿发一拍；timer:tick 仅 remaining ≤ 阈值发拍', () => {
    const urgent = rig();
    urgent.bus.emit('timer:urgent', {});
    expect(urgent.played).toEqual([AUDIO_CLIP_URGENT_BEAT]);

    const low = rig();
    low.bus.emit('timer:tick', { remaining: TIMER_URGENT_T });
    expect(low.played).toEqual([AUDIO_CLIP_URGENT_BEAT]);

    const high = rig();
    high.bus.emit('timer:tick', { remaining: TIMER_URGENT_T + 1 });
    expect(high.played).toEqual([]);
  });

  it('返回的 unsub 全部生效：解绑后再 emit 零派发（teardown 顺序无关）', () => {
    const { bus, played, unsubs } = rig();
    expect(unsubs.length).toBeGreaterThan(0);
    for (const unsub of unsubs) unsub();
    bus.emit('bead:placed', { row: 0, col: 0, colorIdx: 0, slot: 0 });
    bus.emit('level:cleared', { levelId: 'L90', remaining: 1, ratio: 1, stars: 3 });
    expect(played).toEqual([]);
  });
});

describe('fireRewardedAd · 广告 / 体力弹窗的 load+show 单点', () => {
  function fakeAd() {
    const calls: string[] = [];
    const ad = {
      load: (placement: string) => calls.push(`load:${placement}`),
      show: () => calls.push('show'),
      onRewarded: () => () => {},
      onClose: () => () => {},
      onError: () => () => {},
    } as unknown as RewardedAdProvider;
    return { ad, calls };
  }

  it('先 load(placement) 后 show()（顺序即真机契约）', () => {
    const { ad, calls } = fakeAd();
    fireRewardedAd(ad, 'tray-expand');
    expect(calls).toEqual(['load:tray-expand', 'show']);
  });

  it('体力位 placement 原样透传', () => {
    const { ad, calls } = fakeAd();
    fireRewardedAd(ad, 'stamina-refill');
    expect(calls).toEqual(['load:stamina-refill', 'show']);
  });
});

describe('fireShare · 分享透传（WXG-T-405）', () => {
  it('宿主有 share ⇒ 以空 opts 调用一次', () => {
    const share = vi.fn();
    fireShare({ share } as unknown as GameServices);
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({});
  });

  it('宿主无 share（Node/harness）⇒ 静默 noop，不抛', () => {
    expect(() => fireShare({} as unknown as GameServices)).not.toThrow();
  });

  it('share 抛错 ⇒ 吞掉不外泄（分享失败不得打断玩法）', () => {
    const share = vi.fn(() => {
      throw new Error('share failed');
    });
    expect(() => fireShare({ share } as unknown as GameServices)).not.toThrow();
  });
});

describe('K-106 接线证明 · 震动派生经 BeadsGame._emit 真正走到', () => {
  it('放珠（bead:placed，映射事件）⇒ 总线出现 haptic:trigger{light}；选槽（tray:selected，未映射）⇒ 零触觉', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel({ id: 90 })] });
    const haptics: unknown[] = [];
    h.events.on('haptic:trigger', (payload) => haptics.push(payload));

    const slot = h.game.giveTrayBead(h.game.grid.requiredColor(0, 0));
    h.game.selectTraySlot(slot); // tray:selected —— 未映射 ⇒ 不派生触觉
    expect(haptics).toEqual([]);

    expect(h.game.tapGridCell(0, 0)).toBe(true); // bead:placed —— 映射 ⇒ light
    expect(haptics.some((p) => (p as { kind: string }).kind === 'light')).toBe(true);
  });
});
