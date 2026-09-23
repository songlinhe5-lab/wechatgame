// 定价溯源不变式单测（levels-spec §5.0 公式 v0.3）。
// 跑法：node --test tools/scripts/sync-levels-data.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPricing } from './sync-levels-data.mjs';

const bot = (o = {}) => ({
  source: 'bot', actions: 236, actionsLB: 33, secPerTap: 3.6, clamped: false, cleared: true, ...o,
});

test('无 pricing（老关卡 / breakout）⇒ 不断言，放行', () => {
  assertPricing('L1', { time: 300 });
  assertPricing('L1', { time: 300, pricing: undefined });
});

test('source=bot：time = round(actions × secPerTap) 通过；改了 time 未重跑 bot ⇒ 抛', () => {
  assertPricing('L5', { time: 850, pricing: bot() }); // 236 × 3.6 = 849.6 → 850
  assert.throws(() => assertPricing('L5', { time: 900, pricing: bot() }), /未重跑 beads-bot/);
});

test('clamped=true（被 MIN/MAX 钳过）⇒ 跳过等式，不误红', () => {
  assertPricing('L3', { time: 120, pricing: bot({ actions: 20, actionsLB: 8, clamped: true }) });
});

test('actionsLB > actions ⇒ 下界被突破，抛（bot 或度量回归）', () => {
  assert.throws(
    () => assertPricing('L5', { time: 850, pricing: bot({ actionsLB: 500 }) }),
    /下界被突破/,
  );
});

test('cleared=false ⇒ 可解性未证实，抛', () => {
  assert.throws(
    () => assertPricing('L5', { time: 850, pricing: bot({ cleared: false }) }),
    /可解性未证实/,
  );
});

test('source=playtest：time = round(tAct × k)；缺 tAct/k 或改了 time ⇒ 抛', () => {
  const p = { source: 'playtest', actions: 212, tAct: 288, k: 0.9 };
  assertPricing('L5', { time: 259, pricing: p }); // round(288 × 0.9) = 259
  assert.throws(() => assertPricing('L5', { time: 300, pricing: p }), /playtest 定价/);
  assert.throws(() => assertPricing('L5', { time: 259, pricing: { source: 'playtest', k: 0.9 } }), /缺 tAct\/k/);
});

test('未知 source ⇒ 抛', () => {
  assert.throws(() => assertPricing('L5', { time: 1, pricing: { source: 'vibes' } }), /未知/);
});
