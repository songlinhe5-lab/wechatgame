/**
 * Shared test helpers.
 *
 * Builds a fully wired `GameServices` bundle backed by the Node platform, so
 * beads tests exercise the real framework services (event bus, input manager,
 * audio scheduler, save manager) rather than hand-rolled doubles.
 */

import {
  EventBus,
  InputManager,
  AudioScheduler,
  NullAudioBackend,
  NullAssetProvider,
  createRng,
  Viewport,
  type EventMap,
  type GameServices,
  type RewardedAdProvider,
} from '@wxgame/framework';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { BeadsGame } from '../src/game/beads-game.js';
import { CLEAR_PANEL_DELAY_MS, solverSequenceMs } from '../src/config/tuning.js';
import type { BeadsLevelRaw } from '../src/config/levels.js';

export interface Harness {
  readonly services: GameServices;
  readonly game: BeadsGame;
  readonly audio: NullAudioBackend;
  readonly events: EventBus<EventMap>;
  readonly input: InputManager;
  readonly storage: ReturnType<NodePlatform['createStorage']>;
  readonly platform: NodePlatform;
  /** Advance the game by `seconds` in fixed 1/60 steps. */
  advance(seconds: number, step?: number): void;
  /** Record every emitted event. */
  readonly emitted: { type: string; payload: unknown }[];
  /** Count emissions of a given type. */
  count(type: string): number;
  /** All payloads emitted for a type. */
  all<T = unknown>(type: string): T[];
  /** Last payload emitted for a type. */
  last<T = unknown>(type: string): T | undefined;
}

export interface HarnessOptions {
  seed?: string;
  saveKey?: string;
  levels?: readonly BeadsLevelRaw[];
  /** Sprint run length override (C1 validation input). */
  sprintTime?: number;
  /** Share a storage instance between harnesses to simulate a relaunch. */
  storage?: ReturnType<NodePlatform['createStorage']>;
  /** Override the platform rewarded-ad (default = Node Mock pending settle). */
  rewardedAd?: RewardedAdProvider;
  /**
   * 测试专用：跳过 BOOT 期错位装配（透传 `BeadsGameOptions.noBootAssembly`）。
   * 默认**装配**（生产语义）；旧「空盘放置流」测试置 true 后自行构造场景。
   */
  noAssemble?: boolean;
  /** 透传 `BeadsGameOptions.canStartRun`（新局开局体力闸门，WXG-T-164）。 */
  canStartRun?: () => boolean;
  /** 透传 `BeadsGameOptions.onStaminaRefill`（体力回满激励位发奖，WXG-T-164）。 */
  onStaminaRefill?: () => void;
}

export function createBeadsHarness(options: HarnessOptions = {}): Harness {
  const platform = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 });
  const storage = options.storage ?? platform.createStorage();
  const events = new EventBus<EventMap>();
  const input = new InputManager();
  const audioBackend = new NullAudioBackend();
  const audio = new AudioScheduler(audioBackend);

  const services: GameServices = {
    events,
    input,
    audio,
    storage,
    rng: createRng(options.seed ?? 'beads-test-seed'),
    viewport: new Viewport(750, 1334),
    assets: new NullAssetProvider(),
    platform: platform.info,
    rewardedAd: options.rewardedAd ?? platform.createRewardedAdProvider(),
  };

  const game = new BeadsGame({
    saveKey: options.saveKey ?? 'wxgame.beads.test.save',
    ...(options.levels ? { levels: options.levels } : {}),
    ...(options.sprintTime !== undefined ? { sprintTime: options.sprintTime } : {}),
    ...(options.noAssemble ? { noBootAssembly: true } : {}),
    ...(options.canStartRun ? { canStartRun: options.canStartRun } : {}),
    ...(options.onStaminaRefill ? { onStaminaRefill: options.onStaminaRefill } : {}),
  });

  const emitted: { type: string; payload: unknown }[] = [];
  const tracked = [
    'tray:spawned',
    'tray:selected',
    'board:selected',
    'tray:stored',
    'bead:placed',
    'bead:rejected',
    'tray:full',
    'tray:expanded',
    'powerup:used',
    'timer:tick',
    'timer:urgent',
    'level:cleared',
    'level:failed',
    'game:paused',
    'game:resumed',
    'combo:up',
    'combo:break',
    'sprint:stage',
    'sprint:ended',
  ];
  for (const type of tracked) {
    events.on(type, (payload) => emitted.push({ type, payload }));
  }

  game.init(services);

  const harness: Harness = {
    services,
    game,
    audio: audioBackend,
    events,
    input,
    storage,
    platform,
    emitted,
    advance(seconds: number, step = 1 / 60): void {
      const steps = Math.max(1, Math.round(seconds / step));
      for (let i = 0; i < steps; i++) {
        input.beginFrame();
        game.update(step);
        input.endFrame(step);
      }
    },
    count(type: string): number {
      return emitted.filter((e) => e.type === type).length;
    },
    all<T>(type: string): T[] {
      return emitted.filter((e) => e.type === type).map((e) => e.payload as T);
    },
    last<T>(type: string): T | undefined {
      for (let i = emitted.length - 1; i >= 0; i--) {
        if (emitted[i]!.type === type) return emitted[i]!.payload as T;
      }
      return undefined;
    },
  };

  return harness;
}

/**
 * Default `swaps` for a test pattern: the first two fillable cells with
 * **different** 底色 (E5 BOOT rule ②). Computed from the *merged* pattern so
 * pattern overrides keep producing a level that passes BOOT; patterns with
 * fewer than two usable cells yield `[]` (the validator then rejects — which is
 * exactly what those "invalid level" cases want).
 */
function defaultSwaps(pattern: readonly string[]): [number, number, number, number][] {
  const colorOf = (ch: string): number =>
    ch >= '1' && ch <= '9' ? Number(ch) : ch === 'A' ? 10 : 0;
  const picked: { r: number; c: number; color: number }[] = [];
  for (let r = 0; r < pattern.length && picked.length < 2; r++) {
    const row = pattern[r]!;
    for (let c = 0; c < row.length && picked.length < 2; c++) {
      const color = colorOf(row[c]!);
      if (color <= 0) continue;
      if (picked.length === 1 && picked[0]!.color === color) continue;
      picked.push({ r, c, color });
    }
  }
  return picked.length === 2 ? [[picked[0]!.r, picked[0]!.c, picked[1]!.r, picked[1]!.c]] : [];
}

/**
 * A minimal valid test level: 6×5, three colours (validator floor), full
 * rectangular pattern so every cell is fillable. `decoy` adds one decoy colour.
 *
 * v2.0 (E5): carries a valid `swaps` pair by default — BOOT now rejects levels
 * without one (levels-spec v1.2 §2.1). Explicit `swaps` overrides win.
 */
export function simpleTestLevel(overrides: Partial<BeadsLevelRaw> = {}): BeadsLevelRaw {
  const merged: BeadsLevelRaw = {
    id: 90,
    name: '测试关',
    cols: 6,
    rows: 5,
    time: 300,
    swaps: [],
    cycleProfile: 'short',
    decoys: [],
    pattern: ['123123', '123123', '123123', '123123', '123123'],
    ...overrides,
  };
  // BeadsLevelRaw 的 swaps/cycleProfile 为 readonly（levels.ts 校验面）；
  // 字面量本体可变，此处绕过 readonly 仅做默认值填充（测试基建）。
  // WXG-T-139 BOOT 装配接线后：**测试关默认 swaps = []（空盘）** —— 既有 284 例
  // 的「空盘」假设靠它保住；需要错位局面的测试显式传 swaps 或用 grid.setBead。
  const mutable = merged as { swaps: unknown; cycleProfile: unknown };
  if (overrides.swaps === undefined) mutable.swaps = defaultSwaps(merged.pattern);
  if (overrides.cycleProfile === undefined) mutable.cycleProfile = 'short';
  return merged;
}

/**
 * Convenience: give a specific colour into the tray, select it, and place it
 * at (row, col). Returns true when the placement was accepted.
 */
export function placeColor(
  game: BeadsGame,
  colorIdx: number,
  row: number,
  col: number,
): boolean {
  const slot = game.giveTrayBead(colorIdx);
  if (slot < 0) return false;
  if (!game.selectTraySlot(slot)) return false;
  return game.tapGridCell(row, col);
}

/**
 * Deliver a pointer sample **inside a frame** — `beginFrame()` clears the
 * one-shot flags, so pushing before `advance()` would lose the tap.
 *
 * This is the only way to build a true "same frame" case: the tap must be
 * visible to the `_readInput()` call that runs at the head of `update()` — the
 * phase-independent input segment (see `core-loop §2.2.2` 帧内序; moved out of
 * `_stepPlaying` by WXG-T-100/BD-34). Used by `frame-order.test.ts` and
 * `phase-input-realchain.test.ts`.
 * (`pause-settings.test.ts` carries a legacy file-local copy of this helper.)
 */
export function tapInFrame(harness: Harness, designX: number, designY: number): void {
  const screen = { x: 0, y: 0 };
  harness.services.viewport.designToScreen(screen, designX, designY);
  const step = 1 / 60;
  harness.input.beginFrame();
  harness.input.push({ id: 1, x: screen.x, y: screen.y, phase: 'down', time: 0 });
  harness.game.update(step);
  harness.input.endFrame(step);
  // Release immediately so no later frame sees a held pointer.
  // WXG-T-169 / C-3(a)：一次真 tap 跨 down / up 两帧，两帧各跑一次 update（棋盘区
  // 抬起才提交需要 up 帧被处理；区外在 down 帧已提交，up 帧为空调度）。
  harness.input.beginFrame();
  harness.input.push({ id: 1, x: screen.x, y: screen.y, phase: 'up', time: 0 });
  harness.game.update(step);
  harness.input.endFrame(step);
}

/**
 * First fillable-and-empty cell (row-major scan), or null. v2.0 供料关停后，
 * 需要托盘珠的测试夹具一律走 `giveTrayBead`（死路径）+ `placeColor` 直接投放，
 * 本 helper 用于定位目标格。
 */
export function firstEmptyCell(game: BeadsGame): { row: number; col: number } | null {
  for (let row = 0; row < game.grid.rows; row++) {
    for (let col = 0; col < game.grid.cols; col++) {
      if (game.grid.isFillable(row, col)) return { row, col };
    }
  }
  return null;
}

/**
 * Place one tray bead that matches any still-empty cell, if the tray holds
 * one. Returns true when a placement landed.
 */
export function placeAnyMatching(game: BeadsGame): boolean {
  const tray = game.tray;
  for (let slot = 0; slot < tray.capacity; slot++) {
    const s = tray.slot(slot)!;
    if (s.state === 'free') continue;
    for (let row = 0; row < game.grid.rows; row++) {
      for (let col = 0; col < game.grid.cols; col++) {
        if (!game.grid.isFillable(row, col)) continue;
        if (game.grid.requiredColor(row, col) !== s.colorIdx) continue;
        if (!game.selectTraySlot(slot)) continue;
        return game.tapGridCell(row, col);
      }
    }
  }
  return false;
}

/**
 * Advance the game one 1/60 step at a time until `remaining <= target`.
 * With `placeWhileBurning` the loop also plays matching beads each step
 * (keeps the tray breathing like a real player) — off by default so callers
 * can control exactly which placement completes the board.
 */
export function burnToRemaining(
  harness: ReturnType<typeof createBeadsHarness>,
  targetRemaining: number,
  placeWhileBurning = false,
): void {
  let guard = 0;
  while (harness.game.remaining > targetRemaining && harness.game.phase === 'playing') {
    harness.advance(1 / 60);
    if (placeWhileBurning) placeAnyMatching(harness.game);
    if (++guard > 60 * 600) throw new Error('burnToRemaining: ran away');
  }
}

/**
 * 推进过 G4 过关波浪的门（WXG-T-146 / T-128 裁定 1，ux-spec §5「过关庆祝」行）。
 *
 * 裁定 1 的真实语义变更：结算面板**不再与 `LEVEL_CLEAR` 同帧开**——波浪（`WAVE_MS`）
 * 演完才 `open()`，因为 `drawClearPanel` 首行是全屏遮罩（α0.5）且画在 `drawGrid` 之后，
 * 同帧开会把庆祝压死。连带后效（本 helper 存在的理由）：波浪期内
 * `clearPanel.visible === false`、按钮**不可命中**、`sfx_panel_in` 延后、面板绘制命令缺席。
 * 判据迁移一律走这里 + 余量，**不要**在测试里写字面秒数（真源 = `tuning.ts`）。
 */
export function advancePastClearWave(harness: Harness): void {
  harness.advance(CLEAR_PANEL_DELAY_MS / 1000 + 0.1);
}

/**
 * 推进过 G2′ 解环器归位序列的门（WXG-T-150 / `assets-spec §1.6.2a`）。
 *
 * 裁定「甲」（用户 2026-09-17）的真实语义变更：`usePowerup('solver*')` 成功后**棋盘不变**——
 * 相 A 200ms 只闪环点名，相 B 才逐颗（80ms 错开）真正归位，因此
 * `bead:placed` / `powerup:used.affectedCells`（= 点名格）/ 过关判定全部延后。
 * S6 玩法断言（格子是否归位、错位计数）一律先走本 helper + 余量，
 * **不要**在测试里写字面秒数（真源 = `tuning.solverSequenceMs`）。
 *
 * @param cells 本关点名颗数（solver = 1、solverPlus ≤ `SOLVER_PLUS_COUNT`）。
 */
export function advancePastSolver(harness: Harness, cells = 1): void {
  harness.advance(solverSequenceMs(cells) / 1000 + 0.1);
}
