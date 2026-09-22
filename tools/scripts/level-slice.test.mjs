// level-slice 单测（关卡内容管线 P2）：均分算法 + 子矩形裁剪对齐。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitRuns, sliceBoard } from './level-slice.mjs';

test('splitRuns 均分：余数加末尾块', () => {
  assert.deepEqual(splitRuns(51, 50), [25, 26]);
  assert.deepEqual(splitRuns(100, 50), [50, 50]);
  assert.deepEqual(splitRuns(101, 50), [33, 34, 34]);
  assert.deepEqual(splitRuns(50, 50), [50]);
  assert.deepEqual(splitRuns(49, 50), [49]);
});

test('splitRuns 每块必 ≤ gridMax 且和 = n', () => {
  for (let n = 1; n <= 220; n++) {
    const runs = splitRuns(n, 50);
    assert.equal(runs.reduce((a, b) => a + b, 0), n, `和≠n @ ${n}`);
    for (const r of runs) assert.ok(r <= 50, `块 ${r} > 50 @ ${n}`);
  }
});

test('sliceBoard 51×51 → 2×2，每格 ≤50 且子矩形对齐', () => {
  const cols = 51;
  const rows = 51;
  const pattern = Array.from({ length: rows }, () => '1'.repeat(cols));
  const { gridCols, gridRows, cells } = sliceBoard({ pattern, cols, rows, gridMax: 50 });
  assert.equal(gridCols, 2);
  assert.equal(gridRows, 2);
  assert.equal(cells.length, 4);
  assert.deepEqual(cells.map((c) => c.cols), [25, 26, 25, 26]); // 行优先：col 宽交替
  assert.deepEqual(cells.map((c) => c.rows), [25, 25, 26, 26]); // 行优先：row 高成段
  for (const c of cells) {
    assert.ok(c.cols <= 50 && c.rows <= 50);
    assert.equal(c.pattern.length, c.rows);
    for (const line of c.pattern) assert.equal(line.length, c.cols);
  }
});

test('sliceBoard 裁剪 misplaced 与 pattern 同格对齐', () => {
  const cols = 51;
  const rows = 25; // cols>50 触发横切，rows≤50 不切
  const pattern = Array.from({ length: rows }, () => '2'.repeat(cols));
  const misplaced = Array.from({ length: rows }, () => '1'.repeat(cols));
  const { cells } = sliceBoard({ pattern, misplaced, cols, rows, gridMax: 50 });
  assert.equal(cells.length, 2);
  assert.equal(cells[0].misplaced[0], '1'.repeat(25));
  assert.equal(cells[1].misplaced[0], '1'.repeat(26));
});

test('sliceBoard ≤50 不切，单格全等母版', () => {
  const pattern = ['12210', '01110'];
  const { gridCols, gridRows, cells } = sliceBoard({ pattern, cols: 5, rows: 2, gridMax: 50 });
  assert.equal(gridCols, 1);
  assert.equal(gridRows, 1);
  assert.deepEqual(cells[0].pattern, pattern);
});

test('sliceBoard 51×101 → 2×3=6 宫，行优先序锁定（下游按 cells 数组序展开，防漂序）', () => {
  const cols = 51;
  const rows = 101; // colRuns=[25,26] × rowRuns=[33,34,34]
  const pattern = Array.from({ length: rows }, () => '1'.repeat(cols));
  const { gridCols, gridRows, cells } = sliceBoard({ pattern, cols, rows, gridMax: 50 });
  assert.equal(gridCols, 2);
  assert.equal(gridRows, 3);
  assert.equal(cells.length, 6);
  assert.deepEqual(
    cells.map((c) => [c.row, c.col, c.cols, c.rows]),
    [
      [0, 0, 25, 33], [0, 1, 26, 33],
      [1, 0, 25, 34], [1, 1, 26, 34],
      [2, 0, 25, 34], [2, 1, 26, 34],
    ],
  );
});

test('sliceBoard 声明尺寸与 pattern 实际不符 → 入口即 throw（防静默裁出错格）', () => {
  assert.throws(() => sliceBoard({ pattern: ['11'], cols: 2, rows: 2, gridMax: 50 }), /形状/);
  assert.throws(() => sliceBoard({ pattern: ['111'], cols: 2, rows: 1, gridMax: 50 }), /形状/);
});

// §3.3 v1.45：GRID_MAX 50→32 ⇒ 生产切块阈值 = 32（上方 50 阀用例保留，证明算法与阈值解耦）。
test('§3.3 v1.45 生产阈值 32：64 零残余、33 均分、≤32 不切、默认参数即 32', () => {
  assert.deepEqual(splitRuns(64, 32), [32, 32]);     // 2048 母版 → 2×2×32×32 零残余
  assert.deepEqual(splitRuns(33, 32), [16, 17]);     // 余数加末尾块
  assert.deepEqual(splitRuns(32, 32), [32]);        // 单图上限本身不切
  assert.deepEqual(splitRuns(40, 32), [20, 20]);    // 旧 50 阀下会当合法单图投放的盘
  assert.deepEqual(splitRuns(100, 32), [25, 25, 25, 25]);
  for (let n = 1; n <= 220; n++) {
    const runs = splitRuns(n, 32);
    assert.equal(runs.reduce((a, b) => a + b, 0), n, `和≠n @ ${n}`);
    for (const r of runs) assert.ok(r <= 32, `块 ${r} > 32 @ ${n}`);
  }
  // 不传 gridMax ⇒ 走默认（默认值 = 生产阈值；漂移即此断言变红）
  const cols = 51;
  const pattern = Array.from({ length: cols }, () => '1'.repeat(cols));
  const { gridCols, gridRows, cells } = sliceBoard({ pattern, cols, rows: cols });
  assert.equal(gridCols, 2);
  assert.equal(gridRows, 2);
  assert.deepEqual(cells.map((c) => c.cols), [25, 26, 25, 26]);
  for (const c of cells) assert.ok(c.cols <= 32 && c.rows <= 32);
});
