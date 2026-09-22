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
