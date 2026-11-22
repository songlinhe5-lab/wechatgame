/**
 * EP15-S1 · 策略内核抽取回归（WXG-T-986）。
 *
 * 判据（`gdd/bot-replay.md §8`）：
 * - §8-1 金样本逐字一致：对已入库全部 single 关卡跑生产策略，`taps` / `steps` /
 *   分解 / `cleared` 与关表真源 `pricing` 零差异；
 * - §8-2 无头确定性：同一 `levelId + seed` 连跑 N=3 动作序列与终局一致；
 *   `src/bot/**` 无 `Math.random` / RNG 消费；
 * - §8-13 架构门：`src/bot/**` 无 `cc` / DOM / `wx` / `window` / `document` / view / ui / palette。
 *
 * 金样本口径 = `tools/scripts/beads-bot.ts::runLeg`（基础档 12 槽 + seed `beads-bot`）。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createBeadsHarness, simpleTestLevel } from './helpers.js';
import { LEVEL_TIME_MAX } from '../src/config/tuning.js';
import type { BeadsLevelRaw } from '../src/config/levels.js';
import { applyBotCommand } from '../src/bot/apply.js';
import { observeGame } from '../src/bot/observe.js';
import { BOT_POLICY_DEFAULT, createBotPolicy } from '../src/bot/registry.js';
import type { BotCommand } from '../src/bot/types.js';

interface GoldenPricing {
  readonly taps: number;
  readonly steps: number;
  readonly actionsSplit: { moves: number; places: number; directFills: number; retrieves: number };
  readonly cleared: boolean;
}

interface GoldenLevel extends BeadsLevelRaw {
  readonly pricing: GoldenPricing;
}

const SINGLES_DIR = fileURLToPath(new URL('../design/levels/singles/', import.meta.url));

function goldenLevels(): GoldenLevel[] {
  return readdirSync(SINGLES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(SINGLES_DIR + f, 'utf8')) as GoldenLevel);
}

function cmdSig(cmd: BotCommand): string {
  switch (cmd.type) {
    case 'selectBoardBead':
    case 'tapGridCell':
      return `${cmd.type}:${cmd.row},${cmd.col}`;
    case 'retrieveSelectedGroup':
    case 'selectTraySlot':
      return `${cmd.type}:${cmd.slot}`;
    case 'usePowerup':
      return `${cmd.type}:${cmd.powerup}`;
    case 'expandTray':
      return cmd.type;
  }
}

interface PolicyRun {
  readonly cleared: boolean;
  readonly steps: number;
  readonly taps: number;
  readonly split: { moves: number; places: number; directFills: number; retrieves: number };
  readonly signatures: string[];
  readonly rejected: string[];
  readonly finalSig: string;
}

function runPolicy(level: BeadsLevelRaw, seed = 'beads-bot', maxMoves = 4000): PolicyRun {
  const h = createBeadsHarness({ seed, levels: [simpleTestLevel({ ...level, time: LEVEL_TIME_MAX })] });
  h.game.goToLevel(0);
  const policy = createBotPolicy();
  const signatures: string[] = [];
  const rejected: string[] = [];
  let steps = 0;
  let places = 0;
  let directFills = 0;
  let retrieves = 0;
  for (; steps < maxMoves; steps++) {
    if (h.game.grid.isComplete()) break;
    const action = policy.decide(observeGame(h.game));
    if (!action) break;
    for (const cmd of action.commands) {
      if (!applyBotCommand(h.game, cmd)) rejected.push(cmdSig(cmd));
    }
    signatures.push(action.commands.map(cmdSig).join('+'));
    const first = action.commands[0];
    const second = action.commands[1];
    if (first && (first.type === 'selectTraySlot' || first.type === 'tapGridCell')) places++;
    else if (second && second.type === 'retrieveSelectedGroup') retrieves++;
    else directFills++;
  }
  const grid = h.game.grid;
  const tray = h.game.tray;
  let gridSig = '';
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) gridSig += grid.cell(r, c)!.beadColorIdx.toString(16);
  }
  let traySig = '';
  for (let i = 0; i < tray.capacity; i++) traySig += tray.slot(i)!.colorIdx.toString(16);
  return {
    cleared: grid.isComplete(),
    steps,
    taps: h.game.actionsThisLevel,
    split: { moves: steps, places, directFills, retrieves },
    signatures,
    rejected,
    finalSig: `${gridSig}|${traySig}|${h.game.remaining}|${h.game.actionsThisLevel}`,
  };
}

describe('EP15-S1 · greedy-acb 金样本逐字一致（§8-1）', () => {
  const levels = goldenLevels();

  it('关表非空且每关都带 pricing', () => {
    expect(levels.length).toBeGreaterThan(0);
    for (const lv of levels) expect(lv.pricing, `${lv.uid} 缺 pricing`).toBeTruthy();
  });

  for (const level of levels) {
    it(`${level.uid ?? level.id} 与 pricing 零差异`, () => {
      const run = runPolicy(level);
      expect(run.rejected, '策略命令被拒 ⇒ 观测与状态分叉').toEqual([]);
      expect(run.cleared).toBe(level.pricing.cleared);
      expect(run.taps).toBe(level.pricing.taps);
      // `pricing.steps` = **定价档**（24 槽，§3.5 v2.03 用户 2026-11-22 令）读数；
      // `run.steps` 是 12 槽基础档，口径不同 ⛔ 不可直接相等。
      expect(level.pricing.baseCap).toBe(24);
      expect(run.steps).toBe(level.pricing.stepsByCap[12]);
      expect(level.pricing.steps).toBe(level.pricing.stepsByCap[24]);
      expect(run.split).toEqual(level.pricing.actionsSplit);
    });
  }
});

describe('EP15-S1 · 无头确定性（§8-2）', () => {
  it('同一关卡 + seed 连跑 3 次：动作序列与终局逐字一致', () => {
    const level = goldenLevels()[0]!;
    const a = runPolicy(level, 'beads-bot');
    const b = runPolicy(level, 'beads-bot');
    const c = runPolicy(level, 'beads-bot');
    expect(b.signatures).toEqual(a.signatures);
    expect(c.signatures).toEqual(a.signatures);
    expect(b.finalSig).toBe(a.finalSig);
    expect(c.finalSig).toBe(a.finalSig);
  });

  it('默认策略 id 与注册表契约', () => {
    expect(BOT_POLICY_DEFAULT).toBe('greedy-acb');
    expect(createBotPolicy().id).toBe('greedy-acb');
    expect(() => createBotPolicy('greedy-bac')).toThrow();
  });
});

describe('EP15-S1 · 架构门（§8-13）', () => {
  const BOT_DIR = fileURLToPath(new URL('../src/bot/', import.meta.url));
  const files = readdirSync(BOT_DIR).filter((f) => f.endsWith('.ts'));

  /** 去注释后再扫描（文档示例不算违规）。 */
  function stripped(name: string): string {
    return readFileSync(BOT_DIR + name, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  }

  it('bot/** 无 Math.random / RNG 消费', () => {
    for (const name of files) {
      const src = stripped(name);
      expect(src, `${name}: Math.random`).not.toContain('Math.random');
      expect(src, `${name}: services.rng`).not.toContain('services.rng');
      expect(src, `${name}: createRng`).not.toContain('createRng');
    }
  });

  it('bot/** 无引擎 / 宿主 / UI 依赖', () => {
    const forbidden = [
      /from\s+['"]cc['"]/,
      /from\s+['"][^'"]*\/view\//,
      /from\s+['"][^'"]*\/ui\//,
      /palette/,
      /\bwx\./,
      /\bwindow\b/,
      /\bdocument\b/,
    ];
    for (const name of files) {
      const src = stripped(name);
      for (const rule of forbidden) expect(src, `${name}: ${rule}`).not.toMatch(rule);
    }
  });
});
