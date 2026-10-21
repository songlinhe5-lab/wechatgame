// 定价溯源不变式单测（levels-spec §5.0 公式 v0.4 / systems-index §3.5 §3.7 v1.50）。
// 跑法：node --test tools/scripts/sync-levels-data.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPricing, checkDifficultyDegeneracy, checkStepsGate, uidSlotsToLevelRefs, openPrefixLength, checkChapterCapacity, assertNoSourceTitle, injectChapterTitles } from './sync-levels-data.mjs';

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

// ── 门禁⑦（工作量难度闸，2026-10-10）：普通关 steps 落区间 / boss 高于阈值 / 首关教学豁免 ──
const B = { normalMin: 18, normalMax: 90, bossMin: 120 };
const srow = (id, steps, kind = 'single', teaching = false) => ({ id, steps, kind, teaching });

test('G7 现池绿：普通关 19–68 ∈ [18,90]，boss 282 ≥ 120，首关教学豁免', () => {
    checkStepsGate('beads', [srow(1, 10, 'single', true), srow(6, 19), srow(5, 68), srow(9, 282, 'boss')], B);
});

test('G7 普通关 steps 低于下限 ⇒ 抛（教学豁免不受此拦）', () => {
    assert.throws(() => checkStepsGate('beads', [srow(1, 5, 'single', true), srow(2, 9)], B), /普通关 L2 steps=9 越出/);
});

test('G7 普通关 steps 逼近 boss ⇒ 抛', () => {
    assert.throws(() => checkStepsGate('beads', [srow(2, 200)], B), /普通关 L2 steps=200 越出/);
});

test('G7 boss steps 未跳档 ⇒ 抛', () => {
    assert.throws(() => checkStepsGate('beads', [srow(9, 100, 'boss')], B), /boss L9 steps=100 < BOSS_STEPS_MIN/);
});

test('G7 无实测 steps（非拼豆关）⇒ 不拦', () => {
    checkStepsGate('beads', [srow(3, undefined), srow(4, Number.NaN)], B);
});

// ── 大关（chapter）配置层（WXG-T-336 CH-S2 §11.5）：区间合并 / open 前缀 / 墙容量 ──
test('levelRefs：章内相邻且下标连续的 uid 合并成一段，断点分成两段', () => {
    const spans = new Map([
        ['L00001', { start: 1, end: 1 }],
        ['L00002', { start: 2, end: 2 }],
        ['L00005', { start: 5, end: 5 }],
    ]);
    assert.deepEqual(uidSlotsToLevelRefs(['L00001', 'L00002', 'L00005'], spans), [[1, 2], [5, 5]]);
});

test('levelRefs：plate 占多槽时跨 uid 合并（3–5 与 6 连成 3–6）', () => {
    const spans = new Map([
        ['P0001', { start: 3, end: 5 }],
        ['L00006', { start: 6, end: 6 }],
    ]);
    assert.deepEqual(uidSlotsToLevelRefs(['P0001', 'L00006'], spans), [[3, 6]]);
});

test('levelRefs：uid 无装配区间 ⇒ 抛（归属断言必须先于换算）', () => {
    assert.throws(() => uidSlotsToLevelRefs(['L00999'], new Map()), /无装配区间/);
});

test('ARC_OPEN_MAX：open 前缀长度（乱序输入按 order 排序后数前缀）', () => {
    assert.equal(openPrefixLength([{ order: 2, open: true }, { order: 1, open: false }]), 0);
    assert.equal(openPrefixLength([{ order: 1, open: true }, { order: 2, open: true }, { order: 3, open: false }]), 2);
    assert.equal(openPrefixLength([]), 0);
});

test('章容量：槽位 ≤ 墙容量放行，超一槽即抛（不静默截断）', () => {
    checkChapterCapacity('beads', [{ id: 'mandala', slots: 9 }], 9);
    assert.throws(() => checkChapterCapacity('beads', [{ id: 'mandala', slots: 10 }], 9), /展开 10 槽 > 墙容量/);
});

// ── CH-S3 title 上移（WXG-T-337）：章 title 生成期注入收尾关 + 断言 8「源关卡 ⛔ 手写 title」──
test('CH-S3：章 title 注入到章收尾关记录，追加在对象末尾，其余关不带', () => {
    const levels = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }];
    const spans = new Map([['L00001', { start: 1, end: 1 }], ['L00002', { start: 2, end: 3 }]]);
    injectChapterTitles(levels, { title: '曼陀罗', levels: ['L00001', 'L00002'] }, spans);
    assert.equal(levels[2].title, '曼陀罗'); // 末项 uid 的最后一个展开槽（plate 收尾 = 末 cell）
    assert.equal(levels[0].title, undefined);
    assert.equal(Object.keys(levels[2]).at(-1), 'title'); // 末尾追加（产物 diff 仅该记录一行）
});

test('CH-S3：末项 uid 不在装配表 / title 非法 ⇒ 跳过（错误由 assembleArcs 报红，不重复抛）', () => {
    const levels = [{ id: 1 }];
    injectChapterTitles(levels, { title: 'X', levels: ['L00999'] }, new Map());
    injectChapterTitles(levels, { title: '', levels: ['L00001'] }, new Map([['L00001', { start: 1, end: 1 }]]));
    assert.equal(levels[0].title, undefined);
});

test('CH-S3 断言 8：源关卡记录手写 title ⇒ 抛（展示名唯一真源 = 章）', () => {
    assertNoSourceTitle('beads', 'singles/L00005.json', { id: 5, name: 'studio-5-21cd' });
    assert.throws(
        () => assertNoSourceTitle('beads', 'singles/L00005.json', { id: 5, title: '曼陀罗' }),
        /手写了 title/,
    );
});
