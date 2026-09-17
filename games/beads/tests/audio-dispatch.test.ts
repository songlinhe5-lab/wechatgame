/**
 * 音频派发单测（WXG-T-096 / BD-05）—— 判据 `audio-events.md §4` 的 `[N]` 子集。
 *
 * 只测**今天 Node 能证的事**（§5 验证矩阵 `[N]` 行）：clip id 正确性、同帧到达、
 * per-clip 限流分档、静音双通道、清单闭合、心跳周期、零发声路径。
 * **时长 / 响度 / 音色 / 无缝循环 / 真机**属 `[B]`/`[R]`/`[P]`（A05-03/09/15/16/22/
 * 26/27），本文件**不得**记为已验收（AGENTS §7 反假绿）。
 *
 * 帧内序按 `compose/app.ts` 复刻：`update()` 里广播事件 → 入队 → 帧末 `flush()`
 * （`tick()` 一次 = 一帧），否则「同帧」无从谈起。
 */

import { describe, expect, it } from 'vitest';

import { MockRewardedAdProvider } from '@wxgame/framework';
import {
  AUDIO_CLIP_BGM,
  AUDIO_CLIP_CLEAR,
  AUDIO_CLIP_COMBO_BREAK,
  AUDIO_CLIP_COMBO_T1,
  AUDIO_CLIP_COMBO_T2,
  AUDIO_CLIP_COMBO_T3,
  AUDIO_CLIP_DISSOLVE,
  AUDIO_CLIP_PANEL_IN,
  AUDIO_CLIP_PANEL_OUT,
  AUDIO_CLIP_PLACE,
  AUDIO_CLIP_POWERUP,
  AUDIO_CLIP_REJECT,
  AUDIO_CLIP_REVIVE_OK,
  AUDIO_CLIP_SELECT,
  AUDIO_CLIP_STAGE,
  AUDIO_CLIP_STAR,
  AUDIO_CLIP_TOTAL,
  AUDIO_CLIP_TRAY_FULL,
  AUDIO_CLIP_UI_TAP,
  AUDIO_CLIP_URGENT_BEAT,
  AUDIO_MAX_PER_FRAME,
  AUDIO_REJECT_MIN_INTERVAL,
  AUDIO_SFX_MIN_INTERVAL,
  AUDIO_TRAYFULL_MIN_INTERVAL,
  AUDIO_URGENT_BEAT_PERIOD,
  AUDIO_URGENT_MIN_INTERVAL,
  CLEAR_PANEL_DELAY_MS,
  TIMER_URGENT_T,
} from '../src/config/tuning.js';
import { BEADS_AUDIO_VOICES } from '../src/config/audio-voices.js';
import { clearPanelLayout, type ClearPanelAction } from '../src/systems/clear-panel.js';
import { pausePanelLayout, type PausePanelAction } from '../src/systems/pause-panel.js';
import {
  burnToRemaining,
  createBeadsHarness,
  placeColor,
  simpleTestLevel,
  type Harness,
} from './helpers.js';

const FRAME = 1 / 60;

/** 暂停面板按钮中心（面板钮 = 唯一出口，pause-settings §6）。 */
function tapPauseButton(harness: Harness, id: PausePanelAction): boolean {
  const button = pausePanelLayout('normal').buttons.find((b) => b.id === id);
  if (!button) throw new Error(`panel: no button "${id}"`);
  return harness.game.tapDesign(
    (button.rect.xMin + button.rect.xMax) / 2,
    (button.rect.yMin + button.rect.yMax) / 2,
  );
}

/** 结算面板按钮中心（下一关 / 去冲刺）。 */
function tapClearButton(harness: Harness, id: ClearPanelAction): boolean {
  const lastLevel = harness.game.levelIndex >= harness.game.levelCount - 1;
  const button = clearPanelLayout({ lastLevel }).buttons.find((b) => b.id === id);
  if (!button) throw new Error(`clear-panel: no button "${id}"`);
  return harness.game.tapDesign(
    (button.rect.xMin + button.rect.xMax) / 2,
    (button.rect.yMin + button.rect.yMax) / 2,
  );
}

/** §1 权威清单（19 条）——A05-24 的双向对账基准。 */
const SPEC_CLIPS: readonly string[] = [
  AUDIO_CLIP_PLACE,
  AUDIO_CLIP_SELECT,
  AUDIO_CLIP_REJECT,
  AUDIO_CLIP_DISSOLVE,
  AUDIO_CLIP_POWERUP,
  AUDIO_CLIP_COMBO_T1,
  AUDIO_CLIP_COMBO_T2,
  AUDIO_CLIP_COMBO_T3,
  AUDIO_CLIP_COMBO_BREAK,
  AUDIO_CLIP_URGENT_BEAT,
  AUDIO_CLIP_TRAY_FULL,
  AUDIO_CLIP_STAGE,
  AUDIO_CLIP_CLEAR,
  AUDIO_CLIP_STAR,
  AUDIO_CLIP_PANEL_IN,
  AUDIO_CLIP_PANEL_OUT,
  AUDIO_CLIP_REVIVE_OK,
  AUDIO_CLIP_UI_TAP,
  AUDIO_CLIP_BGM,
];

/** 时长上限：**引自 ux-spec §5**（经 `audio-events §1` 转录），不是发明值。 */
const DURATION_CAP_MS: Readonly<Record<string, number>> = {
  [AUDIO_CLIP_PLACE]: 120,
  [AUDIO_CLIP_SELECT]: 100,
  [AUDIO_CLIP_REJECT]: 200,
  [AUDIO_CLIP_DISSOLVE]: 200,
  [AUDIO_CLIP_POWERUP]: 400,
  [AUDIO_CLIP_COMBO_T1]: 200,
  [AUDIO_CLIP_COMBO_T2]: 150,
  [AUDIO_CLIP_COMBO_T3]: 350,
  [AUDIO_CLIP_COMBO_BREAK]: 150,
  [AUDIO_CLIP_URGENT_BEAT]: 1000, // §5「1000/循环」的单拍上限
  [AUDIO_CLIP_TRAY_FULL]: 500,
  [AUDIO_CLIP_STAGE]: 500, // 250+250
  [AUDIO_CLIP_CLEAR]: 800,
  [AUDIO_CLIP_STAR]: 150,
  [AUDIO_CLIP_PANEL_IN]: 200,
  [AUDIO_CLIP_PANEL_OUT]: 150,
  [AUDIO_CLIP_REVIVE_OK]: 400, // §5「150 出 + ≤400 反馈红线」
  // `sfx_ui_tap`：§5 **无行**（Q-A05-1 / §8 T4 `[TODO]`）⇒ 不参与上限对账。
  // `bgm_main`：循环点 `[TODO]`（§8 T2）⇒ 不属 §5 管辖。
};

/**
 * 默认单关；需要走「下一关」而非 FINISH 的用例传 2 关（A05-18 的 panel_out
 * 半边只有**真的进入下一关**才成立，单关点「下一关」会改道 FINISH）。
 */
function makeHarness(levelCount = 1): Harness {
  const levels = Array.from({ length: levelCount }, (_, i) => simpleTestLevel({ id: 90 + i }));
  return createBeadsHarness({
    noAssemble: true, levels
  });
}

/** 一次完整帧：玩法更新 → 帧末音频派发（复刻 `App.tick` 的序）。 */
function tick(harness: Harness, seconds = FRAME): number {
  const before = harness.audio.played.length;
  harness.advance(seconds);
  harness.services.audio.flush(seconds);
  return harness.audio.played.length - before;
}

function playedThis(harness: Harness, fn: () => void): string[] {
  const before = harness.audio.played.length;
  fn();
  return harness.audio.played.slice(before);
}

/**
 * 排空 + 清零。**必须先 drain**：`burnToRemaining` / `giveTrayBead` 这类只
 * `advance()` 不 `flush()` 的推进会把 BOOT 的 `bgm_main`、告急心跳等请求堆在
 * scheduler `_pending` 里，下一次 flush 才落到 backend ⇒ 只清 `played` 数组会把
 * 这些**迟到项**算进本用例头上。`flush(0)` 不推进 `_time` ⇒ 不影响后续限流时序。
 */
function clearPlayed(harness: Harness): void {
  harness.services.audio.flush(0);
  harness.audio.played.length = 0;
}

/** 只推 scheduler 时钟（不跑玩法帧）⇒ 让 per-clip 限流窗口整体过期。 */
function advanceAudioClock(harness: Harness, seconds: number): void {
  harness.services.audio.flush(seconds);
}

/**
 * `audio-events §0`：bus 归属**由 id 前缀派生**，不凭语义手感。
 * 写成本函数的理由：G4 v1.2 附带审计（冲突 C2）抓到 `sfx_revive_ok` 被归进 `ui`，
 * 而 §0 与 `audio-spec §2.1` 两处都写的是 SFX 通道——这类偏差无声音、无堆栈，只能靠守卫。
 */
function busFromId(id: string): 'music' | 'sfx' | 'ui' {
  if (id.startsWith('bgm_')) return 'music';
  if (id.startsWith('sfx_ui_') || id.startsWith('sfx_panel_') || id === 'sfx_star') return 'ui';
  return 'sfx';
}

describe('A05-24 · 清单闭合（tuning clip 集 ≡ §1 表 ≡ voice 表）', () => {
  it('§1 的 19 个 id 全部在 tuning 有常量、在 voice 表有配方，且无孤儿', () => {
    expect(SPEC_CLIPS).toHaveLength(AUDIO_CLIP_TOTAL);
    expect(new Set(SPEC_CLIPS).size).toBe(AUDIO_CLIP_TOTAL);
    const voiceIds = Object.keys(BEADS_AUDIO_VOICES).sort();
    expect(voiceIds).toEqual([...SPEC_CLIPS].sort());
  });

  it('每条配方都有 durationMs > 0，且不超过 ux-spec §5 的时长上限', () => {
    for (const id of SPEC_CLIPS) {
      const voice = BEADS_AUDIO_VOICES[id];
      expect(voice, id).toBeDefined();
      expect(voice!.durationMs, id).toBeGreaterThan(0);
      const cap = DURATION_CAP_MS[id];
      if (cap !== undefined) expect(voice!.durationMs, id).toBeLessThanOrEqual(cap);
    }
  });

  it('每条配方的 bus = §0 前缀派生结果（冲突 C2 的守卫）', () => {
    for (const id of SPEC_CLIPS) {
      expect(BEADS_AUDIO_VOICES[id]!.bus, id).toBe(busFromId(id));
    }
  });

  it('bgm_main 带 loopMs（无缝循环依赖它），其余 clip 不带（不循环，A05-14/21）', () => {
    expect(BEADS_AUDIO_VOICES[AUDIO_CLIP_BGM]!.loopMs).toBeGreaterThan(0);
    for (const id of SPEC_CLIPS) {
      if (id === AUDIO_CLIP_BGM) continue;
      expect(BEADS_AUDIO_VOICES[id]!.loopMs, id).toBeUndefined();
    }
  });
});

describe('A05-01/02 · 同帧到达（一帧内入队并派发）', () => {
  it('bead:placed 的那一帧 flush 后**仅**新增 sfx_place', () => {
    const h = makeHarness();
    const slot = h.game.giveTrayBead(h.game.grid.requiredColor(0, 0));
    h.game.selectTraySlot(slot);
    tick(h); // 把「选中」那一帧的 sfx_select 消化掉
    clearPlayed(h);
    const added = playedThis(h, () => {
      h.game.tapGridCell(0, 0);
      h.services.audio.flush(FRAME);
    });
    expect(added).toEqual([AUDIO_CLIP_PLACE]);
  });

  it('端到端延迟 ≤1 帧：入队后不跨第二次 flush 即已派发', () => {
    const h = makeHarness();
    clearPlayed(h);
    h.events.emit('tray:selected', { slot: 0, colorIdx: 0 });
    expect(h.services.audio.pendingCount).toBe(1); // 入队，尚未下发
    expect(h.audio.played).toHaveLength(0);
    h.services.audio.flush(FRAME);
    expect(h.audio.played).toEqual([AUDIO_CLIP_SELECT]);
  });
});

describe('A05-05/06 · reject 限流分档（红线：≤2 次/秒）', () => {
  it('1.0 s 内注入 10 次拒绝 ⇒ sfx_reject 至多 2 次（旧「统一 0.05」可达 20 次）', () => {
    const h = makeHarness();
    clearPlayed(h);
    for (let i = 0; i < 10; i++) {
      h.events.emit('bead:rejected', { row: 0, col: 0, colorIdx: 0 });
      tick(h, 0.1);
    }
    const rejects = h.audio.played.filter((id) => id === AUDIO_CLIP_REJECT).length;
    expect(rejects).toBeLessThanOrEqual(2);
    expect(rejects).toBeGreaterThan(0); // 也不是「干脆不响」
  });

  it('限流表分档取自 §3.12 冻结值，且落座/选中保留 0.05 连打手感', () => {
    expect(AUDIO_REJECT_MIN_INTERVAL).toBe(0.5);
    expect(AUDIO_URGENT_MIN_INTERVAL).toBe(AUDIO_URGENT_BEAT_PERIOD - 0.1);
    expect(AUDIO_TRAYFULL_MIN_INTERVAL).toBe(1.0);
    expect(AUDIO_SFX_MIN_INTERVAL).toBe(0.05);
    expect(AUDIO_MAX_PER_FRAME).toBe(6);

    const h = makeHarness();
    clearPlayed(h);
    for (let i = 0; i < 4; i++) {
      // 先推进时钟再入队：`_lastPlayed` 在 **flush 时**才记，若「emit → tick」则每次
      // emit 距上轮派发恰好为 0 ⇒ 只能测到 2/4（隔一轮才过窗口），量的不是手感。
      tick(h, AUDIO_SFX_MIN_INTERVAL * 1.2);
      h.events.emit('bead:placed', { row: 0, col: 0, colorIdx: 0, slot: 0 });
      h.services.audio.flush(FRAME);
    }
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_PLACE)).toHaveLength(4);
  });
});

describe('A05-07/08/10/14 · 事件→clip 映射（同帧分层 / 三档分流 / 并存 / 不循环）', () => {
  it('一次 powerup:used ⇒ 同帧两条并存（sfx_powerup + sfx_dissolve）', () => {
    const h = makeHarness();
    clearPlayed(h);
    h.events.emit('powerup:used', { type: 'clear-slot', affectedSlots: [0, 1] });
    h.services.audio.flush(FRAME);
    expect(h.audio.played).toEqual([AUDIO_CLIP_POWERUP, AUDIO_CLIP_DISSOLVE]);
  });

  it('affectedSlots 为空 ⇒ 零发声（powerups §4 零噪声原则）', () => {
    const h = makeHarness();
    clearPlayed(h);
    h.events.emit('powerup:used', { type: 'clear-slot', affectedSlots: [] });
    h.services.audio.flush(FRAME);
    expect(h.audio.played).toEqual([]);
  });

  it('combo:up 按 tier 分流且不串音；tier=0 零发声', () => {
    const byTier: Record<number, string> = {
      1: AUDIO_CLIP_COMBO_T1,
      2: AUDIO_CLIP_COMBO_T2,
      3: AUDIO_CLIP_COMBO_T3,
    };
    for (const tier of [1, 2, 3]) {
      const h = makeHarness();
      clearPlayed(h);
      h.events.emit('combo:up', { streak: tier + 1, multiplier: tier, tier });
      h.services.audio.flush(FRAME);
      expect(h.audio.played).toEqual([byTier[tier]]);
    }
    const h = makeHarness();
    clearPlayed(h);
    h.events.emit('combo:up', { streak: 1, multiplier: 1, tier: 0 });
    h.services.audio.flush(FRAME);
    expect(h.audio.played).toEqual([]);
  });

  it('combo:break 两种 reason 各 1 次同一 clip；reason=wrong 时与 sfx_reject 同帧并存', () => {
    const h = makeHarness();
    clearPlayed(h);
    h.events.emit('combo:break', { reason: 'timeout' });
    h.services.audio.flush(FRAME);
    tick(h, 1.0); // 越过 reject 的 0.5s 限流窗口，隔离下一步
    clearPlayed(h);
    h.events.emit('combo:break', { reason: 'wrong' });
    h.events.emit('bead:rejected', { row: 1, col: 1, colorIdx: 0 });
    h.services.audio.flush(FRAME);
    expect(h.audio.played).toContain(AUDIO_CLIP_COMBO_BREAK);
    expect(h.audio.played).toContain(AUDIO_CLIP_REJECT);
  });

  it('tray:full 每次各 1 次（不循环）；0.9 s 内的第二次事件被防御档吞掉', () => {
    const h = makeHarness();
    clearPlayed(h);
    h.events.emit('tray:full', {});
    h.services.audio.flush(FRAME);
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_TRAY_FULL)).toHaveLength(1);
    tick(h, 0.9);
    clearPlayed(h);
    h.events.emit('tray:full', {});
    h.services.audio.flush(FRAME);
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_TRAY_FULL)).toHaveLength(0);
    tick(h, 1.0);
    clearPlayed(h);
    h.events.emit('tray:full', {});
    h.services.audio.flush(FRAME);
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_TRAY_FULL)).toHaveLength(1);
  });

  it('sprint:stage / level:cleared 各派发 sfx_stage / sfx_clear', () => {
    const h = makeHarness();
    clearPlayed(h);
    h.events.emit('sprint:stage', { stageIndex: 1, nextParams: {} });
    h.events.emit('level:cleared', { levelId: 'L90', remaining: 10, ratio: 1, stars: 3 });
    h.services.audio.flush(FRAME);
    expect(h.audio.played).toContain(AUDIO_CLIP_STAGE);
    expect(h.audio.played).toContain(AUDIO_CLIP_CLEAR);
  });
});

describe('A05-11/12/13 · 告急心跳（与 1000ms 视觉脉冲同周期同相）', () => {
  it('下穿阈值那一帧发首拍；其后每拍间隔 = 1.0 s ±0.05 s', () => {
    const h = makeHarness();
    burnToRemaining(h, TIMER_URGENT_T + 3);
    clearPlayed(h);
    let beats = 0;
    const gaps: number[] = [];
    let sinceLast = 0;
    for (let i = 0; i < 60 * 5; i++) {
      const added = tick(h, FRAME);
      sinceLast += FRAME;
      if (added > 0 && h.audio.played[h.audio.played.length - 1] === AUDIO_CLIP_URGENT_BEAT) {
        gaps.push(sinceLast);
        sinceLast = 0;
        beats++;
      }
    }
    expect(beats).toBeGreaterThanOrEqual(3);
    // 首拍允许提前（边沿触发），其后相邻拍必须落在 1.0 ±0.05 s（A05-13 实为 1 Hz）。
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]!).toBeCloseTo(AUDIO_URGENT_BEAT_PERIOD, 1);
      expect(gaps[i]!).toBeLessThanOrEqual(1.05);
      expect(gaps[i]!).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('阈值以上零拍；PAUSED 期间零拍（计时冻结 ⇒ 无 tick，A05-12）', () => {
    const above = makeHarness();
    // 余量需大于本用例的推进量（3 s），否则「零拍」会因为**恰好下穿了阈值**而成立。
    burnToRemaining(above, TIMER_URGENT_T + 5);
    clearPlayed(above);
    for (let i = 0; i < 60 * 3; i++) tick(above, FRAME);
    expect(above.audio.played.filter((id) => id === AUDIO_CLIP_URGENT_BEAT)).toHaveLength(0);

    const h = makeHarness();
    burnToRemaining(h, TIMER_URGENT_T - 1);
    h.game.onPause();
    expect(h.game.phase).toBe('paused');
    clearPlayed(h);
    for (let i = 0; i < 60 * 3; i++) tick(h, FRAME);
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_URGENT_BEAT)).toHaveLength(0);
  });

  it('激励续时（+REVIVE_BONUS_SEC）后心跳解除（A05-12 的「加时」半边）', () => {
    // 本局无加时道具（`POWERUP_TYPES` 三档都不动计时）⇒ 阈值回升只能经续时路径。
    const h = makeHarness();
    while (h.game.phase === 'playing') tick(h, 0.5);
    expect(h.game.phase).toBe('game-over');
    // 先证明心跳确实响过（否则「解除」可以假在「本来就没响」上）。
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_URGENT_BEAT).length).toBeGreaterThan(0);
    h.game.requestRevive();
    (h.services.rewardedAd as MockRewardedAdProvider).settle('complete');
    expect(h.game.phase).toBe('playing');
    expect(h.game.remaining).toBeGreaterThan(TIMER_URGENT_T);
    clearPlayed(h);
    for (let i = 0; i < 60 * 3; i++) tick(h, FRAME);
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_URGENT_BEAT)).toHaveLength(0);
  });

  it('告急期心跳不抢其它通道：一帧内多事件不超 §3.1 最坏情形（≤6）', () => {
    const h = makeHarness();
    burnToRemaining(h, TIMER_URGENT_T - 1);
    clearPlayed(h);
    // drain 会把 burn 期间堆在 `_pending` 里的 `tray:full` 派发到当下时钟上 ⇒
    // 它的 1.0 s 窗口会吞掉本帧那条。先整体过窗口（不跑玩法 ⇒ 不引入新心跳）。
    advanceAudioClock(h, AUDIO_TRAYFULL_MIN_INTERVAL + 0.1);
    clearPlayed(h);
    h.events.emit('bead:placed', { row: 0, col: 0, colorIdx: 0, slot: 0 });
    h.events.emit('combo:up', { streak: 2, multiplier: 2, tier: 1 });
    h.events.emit('tray:full', {});
    h.events.emit('powerup:used', { type: 'random', affectedSlots: [1, 2] });
    h.services.audio.flush(FRAME);
    expect(h.audio.played.length).toBeLessThanOrEqual(AUDIO_MAX_PER_FRAME);
    expect(h.audio.played.length).toBe(5); // place + t1 + tray_full + powerup + dissolve
  });
});

describe('A05-18 · 面板入 / 出（四个面板态全覆盖）', () => {
  it('PAUSED 进 = panel_in，点「继续」出 = panel_out，各恰一次', () => {
    const h = makeHarness();
    clearPlayed(h);
    h.game.onPause();
    h.services.audio.flush(FRAME);
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_PANEL_IN)).toHaveLength(1);
    clearPlayed(h);
    tapPauseButton(h, 'resume');
    h.services.audio.flush(FRAME);
    expect(h.game.phase).toBe('playing');
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_PANEL_OUT)).toHaveLength(1);
  });

  it('GAME_OVER 进/出、LEVEL_CLEAR 进、FINISH 进 均各一次', () => {
    const h = makeHarness();
    while (h.game.phase === 'playing') tick(h, 0.5);
    expect(h.game.phase).toBe('game-over');
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_PANEL_IN)).toHaveLength(1);
    clearPlayed(h);
    h.game.retryLevel();
    h.services.audio.flush(FRAME);
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_PANEL_OUT)).toHaveLength(1);

    const c = makeHarness(2); // 两关：「下一关」才会回 PLAYING（单关会改道 FINISH）
    fillBoard(c);
    // 裁定 1（WXG-T-146）：`sfx_panel_in` 跟面板同到 ⇒ 面板在波浪（CLEAR_PANEL_DELAY_MS）后开。
    // 本例意图不变（进/出各一次），只是推进量从 0.1s 抬到过门；走 `tick` 而非 helper 是为了帧末 flush。
    tick(c, CLEAR_PANEL_DELAY_MS / 1000 + 0.1);
    expect(c.game.phase).toBe('level-clear');
    expect(c.audio.played).toContain(AUDIO_CLIP_PANEL_IN);
    expect(c.audio.played).toContain(AUDIO_CLIP_CLEAR);

    clearPlayed(c);
    tapClearButton(c, 'next');
    tick(c, 0.1);
    expect(c.audio.played).toContain(AUDIO_CLIP_PANEL_OUT);
  });

  it('面板外点击（遮罩拦截）零发声（A05-18 后半）', () => {
    const h = makeHarness();
    h.game.onPause();
    h.services.audio.flush(FRAME);
    clearPlayed(h);
    expect(h.game.tapDesign(375, 1200)).toBe(false);
    h.services.audio.flush(FRAME);
    expect(h.audio.played).toEqual([]);
  });

  it('结算逐颗星各一次上行叮（3★ 局恰 3 次，不重播）', () => {
    const h = makeHarness();
    fillBoard(h);
    tick(h, 0.1);
    clearPlayed(h);
    for (let i = 0; i < 60 * 2; i++) tick(h, FRAME);
    const stars = h.audio.played.filter((id) => id === AUDIO_CLIP_STAR).length;
    expect(stars).toBeGreaterThan(0);
    expect(stars).toBeLessThanOrEqual(3);
    for (let i = 0; i < 60 * 2; i++) tick(h, FRAME);
    expect(h.audio.played.filter((id) => id === AUDIO_CLIP_STAR).length).toBe(stars);
  });
});

describe('A05-19/20 · 续时两态', () => {
  function toGameOver(h: Harness): Harness {
    while (h.game.phase === 'playing') tick(h, 0.5);
    expect(h.game.phase).toBe('game-over');
    return h;
  }

  it('看完激励 ⇒ sfx_revive_ok 且无 sfx_reject；未看完 ⇒ 反之', () => {
    const ok = toGameOver(makeHarness());
    clearPlayed(ok);
    ok.game.requestRevive();
    (ok.services.rewardedAd as MockRewardedAdProvider).settle('complete');
    ok.services.audio.flush(FRAME);
    expect(ok.audio.played).toContain(AUDIO_CLIP_REVIVE_OK);
    expect(ok.audio.played.filter((id) => id === AUDIO_CLIP_REJECT)).toHaveLength(0);

    const skip = toGameOver(makeHarness());
    clearPlayed(skip);
    skip.game.requestRevive();
    (skip.services.rewardedAd as MockRewardedAdProvider).settle('skip');
    skip.services.audio.flush(FRAME);
    expect(skip.audio.played).toContain(AUDIO_CLIP_REJECT);
    expect(skip.audio.played).not.toContain(AUDIO_CLIP_REVIVE_OK);
    // 未看完 ⇒ **零加时、零复位**：GAME_OVER 上 `remaining` 恒 0，保持 0 才是「什么都没发生」。
    expect(skip.game.remaining).toBe(0);
    expect(skip.game.phase).toBe('game-over');
  });

  it('未看完连点主钮 ⇒ reject 仍受 0.5s 限流（≤2 次/秒）', () => {
    const h = toGameOver(makeHarness());
    clearPlayed(h);
    for (let i = 0; i < 6; i++) {
      h.game.requestRevive();
      (h.services.rewardedAd as MockRewardedAdProvider).settle('skip');
      tick(h, 0.2);
    }
    const rejects = h.audio.played.filter((id) => id === AUDIO_CLIP_REJECT).length;
    expect(rejects).toBeLessThanOrEqual(2 * 1.2); // 1.2 s 窗口 × 2 次/秒
  });
});

describe('A05-23 · 静音双通道', () => {
  it('sfxMuted=true ⇒ 任意玩法事件后 pendingCount 恒 0（门控在 `_sfx`）', () => {
    const h = makeHarness();
    h.game.onPause();
    tapPauseButton(h, 'toggle-sfx');
    expect(h.game.sfxMuted).toBe(true);
    h.services.audio.flush(FRAME);
    clearPlayed(h);
    h.events.emit('bead:placed', { row: 0, col: 0, colorIdx: 0, slot: 0 });
    h.events.emit('combo:up', { streak: 3, multiplier: 2, tier: 2 });
    h.events.emit('level:cleared', { levelId: 'L90', remaining: 1, ratio: 1, stars: 1 });
    expect(h.services.audio.pendingCount).toBe(0);
    h.services.audio.flush(FRAME);
    expect(h.audio.played).toEqual([]);
  });

  it('bgmMuted=true 且 sfxMuted=false ⇒ SFX 照常、BGM 静默（双通道独立）', () => {
    const h = makeHarness();
    h.game.onPause();
    tapPauseButton(h, 'toggle-bgm');
    tapPauseButton(h, 'resume');
    expect(h.game.bgmMuted).toBe(true);
    expect(h.game.sfxMuted).toBe(false);
    clearPlayed(h);
    h.events.emit('bead:placed', { row: 0, col: 0, colorIdx: 0, slot: 0 });
    h.services.audio.flush(FRAME);
    expect(h.audio.played).toContain(AUDIO_CLIP_PLACE);
    expect(h.audio.played).not.toContain(AUDIO_CLIP_BGM);
  });

  it('两开关全关仍可正常落座（静音可玩红线；通关全链由 core-loop/revive 套件覆盖）', () => {
    const h = makeHarness();
    h.game.onPause();
    tapPauseButton(h, 'toggle-bgm');
    tapPauseButton(h, 'toggle-sfx');
    tapPauseButton(h, 'resume');
    expect(h.game.bgmMuted).toBe(true);
    expect(h.game.sfxMuted).toBe(true);
    const grid = h.game.grid;
    expect(placeColor(h.game, grid.requiredColor(0, 0), 0, 0)).toBe(true);
    clearPlayed(h);
    tick(h, 0.2);
    expect(h.audio.played).toEqual([]);
    expect(grid.filledCount).toBeGreaterThan(0);
  });
});

/** 与 `clear-panel.test.ts` 同型的最小 fill 工具（不跨文件共享，避免测试互相牵制）。 */
function fillBoard(harness: Harness): void {
  const grid = harness.game.grid;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isFillable(r, c)) continue;
      const slot = harness.game.giveTrayBead(grid.requiredColor(r, c));
      if (slot < 0) throw new Error(`tray full at (${r},${c})`);
      harness.game.selectTraySlot(slot);
      if (!harness.game.tapGridCell(r, c)) throw new Error(`place failed at (${r},${c})`);
    }
  }
}
