// 定价溯源不变式单测（levels-spec §5.0 公式 v0.4 / systems-index §3.5 §3.7 v1.50）。
// 跑法：node --test tools/scripts/sync-levels-data.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertPricing, checkDifficultyDegeneracy, checkStepsGate, uidSlotsToLevelRefs, openPrefixLength, checkChapterCapacity, assertNoSourceTitle, injectChapterTitles, assembleArcs, assertOpenPrefix, assertChapterPackUniform } from './sync-levels-data.mjs';

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

test('levelRefs：空 uid 列表 ⇒ 空区间（章非空规则由 assembleArcs 前置守）', () => {
    assert.deepEqual(uidSlotsToLevelRefs([], new Map()), []);
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

// ── CH-S4 断言扩面（WXG-T-338 §11.8）：temp 目录迷你夹具驱动 assembleArcs ——
//    空章 / boss 非末 / 孤儿关 / 孤儿章；跨包与 open 洞 = 抽出的纯断言直测
//    （pack!=='main' 与章序由上游前置 ⇒ 两断言在真数据流先绿后守，CH-S5 开包后本夹具自动转正）。──
const FIX_ENTRIES = [
    { uid: 'L00001', order: 1, kind: 'single', pack: 'main', file: 'singles/L00001.json' },
    { uid: 'P0002', order: 2, kind: 'plate', pack: 'main', file: 'plates/P0002.json' },
    { uid: 'L00003', order: 3, kind: 'boss', pack: 'main', file: 'singles/L00003.json' },
];
const FIX_CHAPTER = {
    id: 'mandala', title: '曼陀罗', levels: ['L00001', 'P0002', 'L00003'],
    showcase: { bundle: 'themes', art: 'fx-256', textureId: 'bitmap__fixture' },
};
const FIX_FILES = {
    'singles/L00001.json': { id: 1, name: 'fx-1' },
    'plates/P0002.json': { cells: [{ id: 2, name: 'fx-2a' }, { id: 3, name: 'fx-2b' }] },
    'singles/L00003.json': { id: 4, name: 'fx-3' },
    'chapters/mandala.json': FIX_CHAPTER,
};

/** 建「single + plate(2 槽) + boss」迷你内容仓（os.tmpdir，随系统清理）；over.files 覆盖/追加文件。 */
function mkArcFixture(over = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'wxg-arc-'));
    for (const d of ['singles', 'plates', 'chapters', 'assets']) mkdirSync(join(dir, d));
    writeFileSync(join(dir, 'palette.json'), JSON.stringify({ palette: {} }));
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
        schemaVersion: 2, gameId: 'fixture', paletteFile: 'palette.json',
        entries: FIX_ENTRIES,
        chapters: [{ id: 'mandala', file: 'chapters/mandala.json', order: 1, open: true }],
    }));
    for (const [rel, obj] of Object.entries({ ...FIX_FILES, ...over.files }))
        writeFileSync(join(dir, rel), JSON.stringify(obj));
    writeFileSync(join(dir, 'assets/fx-256.png'), '');
    return { name: 'fixture', levelsDir: dir, manifestPath: join(dir, 'manifest.json'), chaptersDir: join(dir, 'chapters') };
}

const FIX_CHAPTER_FILE = 'chapters/mandala.json';
const withChapter = (over) => ({ files: { [FIX_CHAPTER_FILE]: { ...FIX_CHAPTER, ...over } } });

test('CH-S4 夹具绿：single+plate+boss 装配 ⇒ levelRefs 贯穿 [1,4] / openMax / 容量 4', () => {
    const { arcs, openMax, capacity } = assembleArcs(mkArcFixture());
    assert.deepEqual(arcs[0].levelRefs, [[1, 4]]);
    assert.equal(openMax, 1);
    assert.deepEqual(capacity, [{ id: 'mandala', slots: 4 }]);
});

test('CH-S4 空章 ⇒ 抛（levels[] 非空硬规则）', () => {
    assert.throws(() => assembleArcs(mkArcFixture(withChapter({ levels: [] }))), /levels\[\] 为空/);
});

test('CH-S4 boss 非末 ⇒ 抛（章序换为 [boss, single, plate]）', () => {
    assert.throws(
        () => assembleArcs(mkArcFixture(withChapter({ levels: ['L00003', 'L00001', 'P0002'] }))),
        /boss 必须是 levels\[\] 末项/,
    );
});

test('CH-S4 孤儿关 ⇒ 抛（entry 未被任何章覆盖，墙上不可达）', () => {
    assert.throws(() => assembleArcs(mkArcFixture(withChapter({ levels: ['L00001', 'L00003'] }))), /P0002 未被任何章覆盖/);
});

test('CH-S4 孤儿章 ⇒ 抛（chapters/ 文件未被 manifest.chapters 引用）', () => {
    const game = mkArcFixture({ files: { 'chapters/other.json': { id: 'other', title: 'X' } } });
    assert.throws(() => assembleArcs(game), /孤儿章文件 chapters\/other\.json/);
});

test('CH-S4 open 洞 ⇒ 抛；前缀完好 ⇒ 返回 openMax（断言 1′ 直测）', () => {
    assert.throws(
        () => assertOpenPrefix('fixture', [{ order: 1, open: false }, { order: 2, open: true }]),
        /open 必须自 order=1 起连续成前缀/,
    );
    assert.equal(assertOpenPrefix('fixture', [{ order: 1, open: true }, { order: 2, open: false }]), 1);
});

test('CH-S4 跨包 ⇒ 抛；同包 ⇒ 放行（断言 5 直测，CH-S5 开包后转正）', () => {
    assertChapterPackUniform('fixture', 'mandala', ['main', 'main']);
    assert.throws(
        () => assertChapterPackUniform('fixture', 'mandala', ['main', 'packs']),
        /混包（main \+ packs）/,
    );
});
