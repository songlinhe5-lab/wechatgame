// 豆面可读性守卫自测（WXG-T-357）：门限判读 + 二次修复不越界（不改尺寸/不碰 x/幂等）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, judge, repair, shortSideLimit, LIMITS } from './lib/pattern-legibility.mjs';

// 干净盘：两色各一整块，无孤点无细丝
const CLEAN = [
    '111111222222',
    '111111222222',
    '111111222222',
    '111111222222',
    '111111222222',
    '111111222222',
    '111111222222',
    '111111222222',
    '111111222222',
    '111111222222',
    '111111222222',
    '111111222222',
];

// 碎盘：色 1 被切成 6 个单格孤点 + 一个 1 格宽细丝
const SPECKLED = [
    '1...1.....',
    '..........',
    '..1....1..',
    '..........',
    '...1111111',
    '..........',
    '..........',
    '1.......1.',
    '..........',
    '..........',
    '..........',
    '..........',
];

test('analyze：干净盘读数为 1 块/色、零孤点零细丝', () => {
    const m = analyze(CLEAN);
    assert.equal(m.N, 144);
    assert.equal(m.C, 2);
    assert.equal(m.blocks, 2);
    assert.equal(m.blocksPerColor, 1);
    assert.equal(m.specks, 0);
    assert.equal(m.silks, 0);
    assert.equal(m.parts, 1);
    assert.deepEqual(m.holes, []);
    assert.equal(judge(m).ok, true);
});

test('analyze：碎盘命中孤点/细丝/同色块数三项', () => {
    const m = analyze(SPECKLED);
    assert.equal(m.C, 1);
    assert.equal(m.specks, 6);
    assert.equal(m.silks, 1);
    assert.equal(m.blocks, 7);
    assert.equal(m.blocksPerColor, 7);
    const v = judge(m);
    assert.equal(v.ok, false);
    assert.deepEqual(v.fails.map((f) => f.k), ['T1', 'T2', 'T3', 'T5', 'T6', 'T7']);
});

test('judge：盘/色数不足判 sizing，盘够但碎判 structure', () => {
    const small = analyze(['11', '11']); // 2×2 单色：T5（珠/色 4）+ T7（短边 2）
    assert.equal(judge(small).kind, 'sizing');
    // 盘够（15×15、每色 ≥ 25 格）但同色被切成 4 块 ⇒ 只该命中 T2
    const big = analyze([
        '222222222222222',
        '222222222222222',
        '221112222211122',
        '221112222211122',
        '221112222211122',
        '222222222222222',
        '222222222222222',
        '222222222222222',
        '222222222222222',
        '222222222222222',
        '221112222211122',
        '221112222211122',
        '221112222211122',
        '222222222222222',
        '222222222222222',
    ]);
    assert.equal(judge(big).kind, 'structure');
});

test('repair：吞孤点 + 并细丝 + 填孔，且不改尺寸、不碰锁定格', () => {
    const src = [
        '1111111111',
        '1..x..2..1',
        '1.11..2..1',
        '1.11..2..1',
        '1111111111',
        '1111111111',
        '1...3....1',
        '1111111111',
        '1111111111',
        '1111111111',
        '1111111111',
        '1111111111',
    ];
    const before = analyze(src);
    assert.ok(before.specks > 0, '样例须含孤点');
    const { pattern, log, changed } = repair(src);
    assert.equal(changed, true);
    assert.ok(log.length > 0);
    assert.equal(pattern.length, src.length, '行数不变');
    pattern.forEach((row, i) => assert.equal(row.length, src[i].length, '列数不变'));
    // 锁定格原位保留
    assert.equal(pattern[1][3], 'x');
    const after = analyze(pattern);
    assert.equal(after.specks, 0);
    assert.ok(after.blocksPerColor <= before.blocksPerColor, '同色块数不得增加');
});

test('repair：幂等（再跑一次不再改动）', () => {
    const once = repair(SPECKLED).pattern;
    const twice = repair(once, { maxPasses: 3 });
    assert.deepEqual(twice.pattern, once);
    assert.equal(twice.changed, false);
});

test('短边下限按用色数分档', () => {
    assert.equal(shortSideLimit(3), 11);
    assert.equal(shortSideLimit(5), 14);
    assert.equal(shortSideLimit(8), 16);
    assert.equal(LIMITS.beadsPerBlock, 9);
});
