/**
 * §3.6 v1.80（WXG-T-351）道具购买**确认弹窗**（`ux-spec §3.7`）。
 *
 * 判据（提案 `bean-currency-economy §7.1`）：
 *  - 免费次数内**零扣豆**、不弹窗；
 *  - 免费用尽后点卡 ⇒ **只弹窗**，此刻零扣豆零事件（「确定」才提交）；
 *  - 确定 ⇒ 扣豆**一次** + 生效**一次** + 关窗；
 *  - 取消 / 点板外 ⇒ 零副作用关窗；
 *  - 豆子不足 ⇒ 关窗 + 轻提示，零扣款零事件（v1.95 删除「达购买上限」路径：不设上限）；
 *  - 弹窗期间其余控件不响应（模态）。
 */
import { describe, expect, it } from 'vitest';
import { NodePlatform } from '../../../packages/framework/src/platform/node.js';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';
import {
  POWERUP_BUY_DENIED_HINT,
  POWERUP_BUY_PRICE,
  powerupBuyPrice,
} from '../src/config/tuning.js';
import { MetaState } from '../src/game/meta-state.js';
import { buyConfirmLayout } from '../src/systems/buy-confirm-panel.js';

interface Rig {
  readonly harness: Harness;
  readonly meta: MetaState;
  readonly game: Harness['game'];
}

/** 每次点击价格（扣款腿 = shell 里的 `spendCoins`；这里逐字仿真）。 */
function rig(saveKey: string, coins = 200): Rig {
  const storage = new NodePlatform({ width: 750, height: 1334, pixelRatio: 2 }).createStorage();
  const now = 1_700_000_000_000;
  const meta = new MetaState({ storage, clock: () => now, metaKey: `${saveKey}.meta` });
  if (coins > 0) meta.addCoins(coins);
  const harness = createBeadsHarness({
    saveKey,
    noAssemble: true, // 受控错位局面（同 `powerups.test.ts`：装配器会自己铺盘，这里要可控）
    levels: [simpleTestLevel()],
    onPowerupPurchase: (type) => meta.spendCoins(powerupBuyPrice(type)),
  });
  const rig: Rig = { harness, meta, game: harness.game };
  buildMisplaced(rig.harness, 12); // 尽量多铺错位：够 3 次免费 + 2 次购买（含一对交换连带归位）
  return rig;
}

/**
 * 装配受控错位局面（逐字照搬 `powerups.test.ts::buildMisplaced`）：
 * 先把全部可填格按需求色就位，再做指定次数的**不同色两两对调**。
 * ⚠ `flat` 必须在 `fill` 之前收集 —— `isFillable` 只对 `empty` 格为真。
 */
function buildMisplaced(h: Harness, swaps: number): void {
  const grid = h.game.grid;
  const flat: { row: number; col: number }[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cell(r, c)!;
      if (!cell.void && cell.state === 'empty') flat.push({ row: r, col: c });
    }
  }
  for (const { row, col } of flat) grid.fill(row, col, grid.requiredColor(row, col));
  const used = new Set<number>();
  let done = 0;
  for (let a = 0; a < flat.length && done < swaps; a++) {
    if (used.has(a)) continue;
    for (let b = a + 1; b < flat.length && done < swaps; b++) {
      if (used.has(b)) continue;
      if (grid.requiredColor(flat[a]!.row, flat[a]!.col) === grid.requiredColor(flat[b]!.row, flat[b]!.col)) continue;
      const ba = grid.cell(flat[a]!.row, flat[a]!.col)!.beadColorIdx;
      const bb = grid.cell(flat[b]!.row, flat[b]!.col)!.beadColorIdx;
      grid.setBead(flat[a]!.row, flat[a]!.col, bb);
      grid.setBead(flat[b]!.row, flat[b]!.col, ba);
      used.add(a);
      used.add(b);
      done += 1;
      break;
    }
  }
}

/** 重铺错位局面：现存错位珠就地归位（`setBead` 装配原语），再按同款两两对调造新错位。 */
function rebuildMisplaced(h: Harness, swaps: number): void {
  const grid = h.game.grid;
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++)
      if (grid.isMisplaced(r, c)) grid.setBead(r, c, grid.requiredColor(r, c));
  const flat: { row: number; col: number }[] = [];
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cell(r, c)!;
      if (!cell.void && cell.state === 'filled') flat.push({ row: r, col: c });
    }
  const used = new Set<number>();
  let done = 0;
  for (let a = 0; a < flat.length && done < swaps; a++) {
    if (used.has(a)) continue;
    for (let b = a + 1; b < flat.length && done < swaps; b++) {
      if (used.has(b)) continue;
      if (grid.requiredColor(flat[a]!.row, flat[a]!.col) === grid.requiredColor(flat[b]!.row, flat[b]!.col)) continue;
      const ba = grid.cell(flat[a]!.row, flat[a]!.col)!.beadColorIdx;
      const bb = grid.cell(flat[b]!.row, flat[b]!.col)!.beadColorIdx;
      grid.setBead(flat[a]!.row, flat[a]!.col, bb);
      grid.setBead(flat[b]!.row, flat[b]!.col, ba);
      used.add(a);
      used.add(b);
      done += 1;
      break;
    }
  }
}

/** `powerup:used` 已发次数（Harness 只有 `emitted` 数组，没有 countEvents）。 */
function usedCount(h: Harness): number {
  return h.emitted.filter((e) => e.type === 'powerup:used').length;
}

function centerOf(id: 'buy-confirm' | 'buy-cancel'): { x: number; y: number } {
  const b = buyConfirmLayout().buttons.find((x) => x.id === id)!;
  return { x: (b.rect.xMin + b.rect.xMax) / 2, y: (b.rect.yMin + b.rect.yMax) / 2 };
}

describe('§3.6 v1.80 · 道具购买确认弹窗', () => {
  it('免费次数内不弹窗、零扣豆', () => {
    const r = rig('test.buy.free');
    expect(r.game.grid.misplacedCount).toBeGreaterThan(0);
    expect(r.game.usePowerup('windowRestore')).toBe(true);
    expect(r.game.pendingPowerupBuy).toBeNull();
    expect(r.meta.coins).toBe(200);
  });

  it('免费用尽后点卡只弹窗：零扣豆、零事件、未记账', () => {
    const r = rig('test.buy.open');
    expect(r.game.usePowerup('windowRestore')).toBe(true);
    r.harness.advance(0.5); // 相 B 归位落地，棋盘恢复「仍有错位珠」
    const usedBefore = usedCount(r.harness);

    expect(r.game.usePowerup('windowRestore'), '超限 ⇒ 打开确认，不立即生效').toBe(false);
    expect(r.game.pendingPowerupBuy).toBe('windowRestore');
    expect(r.meta.coins, '弹窗期零扣豆').toBe(200);
    expect(usedCount(r.harness) - usedBefore, '弹窗期零事件').toBe(0);
    expect(r.game.powerups.bought('windowRestore'), '未确认 ⇒ 不记账').toBe(0);
  });

  it('确定 ⇒ 扣豆一次 + 生效一次 + 关窗', () => {
    const r = rig('test.buy.confirm');
    r.game.usePowerup('windowRestore');
    r.harness.advance(0.5);
    r.game.usePowerup('windowRestore'); // 免费用尽 ⇒ 打开确认
    const usedBefore = usedCount(r.harness);
    const c = centerOf('buy-confirm');

    expect(r.game.tapDesign(c.x, c.y), '点在「确定」上').toBe(true);
    expect(r.game.pendingPowerupBuy).toBeNull();
    expect(r.meta.coins).toBe(200 - POWERUP_BUY_PRICE);
    expect(usedCount(r.harness)).toBe(usedBefore + 1);
    expect(r.game.powerups.bought('windowRestore')).toBe(1);
  });

  it('取消 ⇒ 关窗且零扣豆零事件', () => {
    const r = rig('test.buy.cancel');
    r.game.usePowerup('windowRestore');
    r.harness.advance(0.5);
    const usedBefore = usedCount(r.harness);
    const c = centerOf('buy-cancel');

    r.game.tapDesign(c.x, c.y);
    expect(r.game.pendingPowerupBuy).toBeNull();
    expect(r.meta.coins).toBe(200);
    expect(usedCount(r.harness)).toBe(usedBefore);
  });

  it('点板外同样关窗（模态：不穿透到棋盘/控件）', () => {
    const r = rig('test.buy.outside');
    r.game.usePowerup('windowRestore');
    r.harness.advance(0.5);
    const layout = buyConfirmLayout();

    r.game.tapDesign(layout.panel.xMin - 40, layout.panel.yMin - 40);
    expect(r.game.pendingPowerupBuy).toBeNull();
    expect(r.meta.coins).toBe(200);
  });

  it('豆子不足 ⇒ 关窗 + 轻提示，零扣款零事件', () => {
    const r = rig('test.buy.poor', 0);
    r.game.usePowerup('windowRestore');
    r.harness.advance(0.5);
    r.game.usePowerup('windowRestore'); // 免费用尽 ⇒ 打开确认
    expect(r.game.pendingPowerupBuy).toBe('windowRestore');
    const usedBefore = usedCount(r.harness);
    const c = centerOf('buy-confirm');

    r.game.tapDesign(c.x, c.y);
    expect(r.game.pendingPowerupBuy).toBeNull();
    expect(r.game.powerupHint).toBe(POWERUP_BUY_DENIED_HINT);
    expect(r.meta.coins).toBe(0);
    expect(usedCount(r.harness)).toBe(usedBefore);
  });

  it('不设次数上限（v1.95 换版，原判据「每关合计上限 2 次」作废）：重铺局面连续购买恒可', () => {
    const r = rig('test.buy.cap', 1000);
    const c = centerOf('buy-confirm');
    // 免费腿 1 次：windowRestore 在测试盘（6×5 < 6×6）= 整盘点名，免费一次即全清。
    expect(r.game.usePowerup('windowRestore'), '免费').toBe(true);
    r.harness.advance(0.5);
    // 每轮购买前重铺错位（setBead 装配原语允许就位⇄错位互转）；
    // 连买 3 次恒可（⛔ 无任何次数上限拦截，价格是唯一门槛），每次扣款恒 100。
    for (let i = 1; i <= 3; i++) {
      rebuildMisplaced(r.harness, 4);
      expect(r.game.usePowerup('windowRestore'), `开确认 ${i}`).toBe(false);
      expect(r.game.pendingPowerupBuy, `pending ${i}`).toBe('windowRestore');
      r.game.tapDesign(c.x, c.y);
      expect(r.game.powerups.bought('windowRestore'), `买成 ${i}`).toBe(i);
      r.harness.advance(0.5);
    }
    expect(r.meta.coins, '3×100 扣款').toBe(1000 - 3 * POWERUP_BUY_PRICE);
  });
});
