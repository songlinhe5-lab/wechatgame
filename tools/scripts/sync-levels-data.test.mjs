// 定价溯源不变式单测（levels-spec §5.0 公式 v0.4 / systems-index §3.5 §3.7 v1.50）。
// 跑法：node --test tools/scripts/sync-levels-data.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPricing, checkDifficultyDegeneracy } from './sync-levels-data.mjs';

// 锚 = L5 `studio-5-21cd` 真值：BAC 199 步 × 1.69s = 336s。
const bot = (o = {}) => ({
    source: 'bot', steps: 199, stepsLB: 33, taps: 471, secPerStep: 1.69, clamped: false, cleared: true, ...o,
});

test('无 pricing（老关卡 / breakout）⇒ 不断言，放行', () => {
    assertPricing('L1', { time: 300 });
    assertPricing('L1', { time: 300, pricing: undefined });
});

test('source=bot：time = round(steps × secPerStep) 通过；改了 time 未重跑 bot ⇒ 抛', () => {
    assertPricing('L5', { time: 336, pricing: bot() }); // 199 × 1.69 = 336.31 → 336
    assert.throws(() => assertPricing('L5', { time: 400, pricing: bot() }), /未重跑 beads-bot/);
});

test('clamped=true（被 MIN/MAX 钳过）⇒ 跳过等式，不误红', () => {
    assertPricing('L3', { time: 30, pricing: bot({ steps: 10, stepsLB: 4, clamped: true }) });
});

test('stepsLB > steps ⇒ 错位组数下界被突破，抛（bot 或度量写错）', () => {
    assert.throws(
        () => assertPricing('L5', { time: 336, pricing: bot({ stepsLB: 500 }) }),
        /下界被突破/,
    );
});

test('cleared=false ⇒ 可解性未证实，抛', () => {
    assert.throws(
        () => assertPricing('L5', { time: 336, pricing: bot({ cleared: false }) }),
        /可解性未证实/,
    );
});

test('source=playtest：time = round(tAct × k)；缺 tAct/k 或改了 time ⇒ 抛', () => {
    // 锚 = L5 实测：t_act 288s × k 1.00 ⇒ 1★ 时钟 288s（§3.7 v1.50 起 time 字段 = 1★ 档时钟）
    const p = { source: 'playtest', tAct: 288, k: 1.0, humanTaps: 212, steps: 199, stepsLB: 33 };
    assertPricing('L5', { time: 288, pricing: p });
    assert.throws(() => assertPricing('L5', { time: 300, pricing: p }), /playtest 定价/);
    assert.throws(
        () => assertPricing('L5', { time: 288, pricing: { source: 'playtest', k: 1 } }),
        /缺 tAct\/k/,
    );
});

test('未知 source ⇒ 抛', () => {
    assert.throws(() => assertPricing('L5', { time: 1, pricing: { source: 'vibes' } }), /未知/);
});

// ── 门禁⑥（G6）难度无退化（WXG-T-266 EP12-S5；纯序校验，不依赖 difficultyOf ⇒ 无 loader）──
const row = (id, di, category = '__default__') => ({ id, di, category });

test('G6：同类内 DI 严格可排（乱序入参仍可排）⇒ 放行', () => {
    checkDifficultyDegeneracy('beads', [row(9, 538), row(1, 54.3), row(5, 206), row(3, 89.7)]);
    // 入关序 ≠ 难度序（H-2）：上面乱序给出也不应红（只断可排严格序）。
});

test('G6：同类内两关 DI 并列 ⇒ 退化，抛（有牙）', () => {
    assert.throws(
        () => checkDifficultyDegeneracy('beads', [row(1, 100), row(2, 100)]),
        /难度退化.*非严格递增/s,
    );
});

test('G6：跨类别各自可排 ⇒ 不同类并列不红（双轨解耦，G10）', () => {
    checkDifficultyDegeneracy('beads', [row(1, 100, 'A'), row(2, 100, 'B')]);
});
