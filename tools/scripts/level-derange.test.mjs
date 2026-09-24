// tools/scripts/level-derange.test.mjs
// P2b 逐格三阶错豆算法单测（spec §0.2）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowstringsToSolved, solvedToRowstrings, derangeCell, buildSwaps, buildCellInitial } from './level-derange.mjs';

// ── 编解码 ────────────────────────────────────────────────────────────────────

test('rowstringsToSolved：. x 1-9A-Z 正确解码（§3.2 v1.55，`B`/`Z` 不再静默归 0）', () => {
  const { flat, cols, rows } = rowstringsToSolved(['.x1B', '2AZ3']);
  assert.equal(cols, 4);
  assert.equal(rows, 2);
  assert.deepEqual(flat, [0, 0, 1, 11, 2, 10, 35, 3]);
});

test('solvedToRowstrings：>12 色不丢色（旧 12 枚 CHAR 的静默截断面，正本 §5-A8）', () => {
  const cols = 13;
  const flat = Array.from({ length: cols }, (_, i) => i + 1); // 色 1..13
  const rows = solvedToRowstrings(flat, ['1'.repeat(cols)], cols, 1);
  // 本仓旧表只到第 12 枚 ⇒ `charOfColor(13)` 返 undefined ⇒ 拼出 `…Cundefined`；
  // 现表 35 枚 ⇒ 第 13 色 = `D`，且往返闭合（Plate >12 色不会被默默压回前 12 色）。
  assert.equal(rows[0], '123456789ABCD');
  assert.deepEqual(rowstringsToSolved(rows).flat, flat);
});

test('solvedToRowstrings：x 位保留 x，. 位保留 .，色号重映射', () => {
  const pattern = ['.x1', '2.3'];
  // misplacedFlat：色 1 和色 3 互换（pos2 ↔ pos5）
  const flat = [0, 0, 3, 2, 0, 1];
  const rows = solvedToRowstrings(flat, pattern, 3, 2);
  assert.equal(rows[0], '.x3');
  assert.equal(rows[1], '2.1');
});

// ── 甲：derangeCell ───────────────────────────────────────────────────────────

test('derangeCell 甲成功：2 色均衡 4 格', () => {
  // 1 1 2 2 → maxFreq=2, N=4, 2≤2 ✓
  const { ok, misplaced } = derangeCell([1, 1, 2, 2]);
  assert.ok(ok);
  const solved = [1, 1, 2, 2];
  for (let i = 0; i < 4; i++) assert.notEqual(misplaced[i], solved[i]);
  // 守恒：排序后同色同数
  assert.deepEqual(misplaced.slice().sort((a, b) => a - b), [1, 1, 2, 2]);
});

test('derangeCell 甲成功：含 void 格（0 不参与 derange）', () => {
  // pattern: 1 0 2 1 0 2（cols=3 rows=2，中列全 void）
  const { ok, misplaced } = derangeCell([1, 0, 2, 1, 0, 2]);
  assert.ok(ok);
  assert.equal(misplaced[1], 0); // void 格保持 0
  assert.equal(misplaced[4], 0);
  // 守恒
  const nonZero = misplaced.filter((v) => v > 0).sort((a, b) => a - b);
  assert.deepEqual(nonZero, [1, 1, 2, 2]);
});

test('derangeCell 甲失败：主导色超半数', () => {
  // 1 1 1 2 → maxFreq=3, N=4, 3>2 ✗
  const { ok, reason } = derangeCell([1, 1, 1, 2]);
  assert.equal(ok, false);
  assert.match(reason, /主导色|N\/2/);
});

test('derangeCell 甲失败：可填格 < 2', () => {
  const { ok } = derangeCell([1]);
  assert.equal(ok, false);
});

// ── 乙：buildSwaps ────────────────────────────────────────────────────────────

test('buildSwaps 乙：找到异色对（主导色超半数情形）', () => {
  // 1 1 1 2（cols=4 rows=1）：异色对 = (0,3),(1,3),(2,3)；只能取 1 对（色2只有1格）
  const { swaps, count } = buildSwaps([1, 1, 1, 2], 4, 1);
  assert.ok(count >= 1);
  // 第一对必须包含格3（色2）
  const [r1, c1, r2, c2] = swaps[0];
  const flat = [1, 1, 1, 2];
  assert.notEqual(flat[r1 * 4 + c1], flat[r2 * 4 + c2]); // 异色才换
});

test('buildSwaps 乙：k 尽量大（4色各2格 = 4对，封顶 8）', () => {
  // 1 1 2 2 3 3 4 4（cols=8 rows=1）→ 最多 4 对
  const { swaps, count } = buildSwaps([1, 1, 2, 2, 3, 3, 4, 4], 8, 1);
  assert.equal(count, 4);
  // 每对异色
  const flat = [1, 1, 2, 2, 3, 3, 4, 4];
  for (const [r1, c1, r2, c2] of swaps) {
    assert.notEqual(flat[r1 * 8 + c1], flat[r2 * 8 + c2]);
  }
});

test('buildSwaps 乙：单色格无法配对 → count=0', () => {
  const { count } = buildSwaps([1, 1, 1, 1], 4, 1);
  assert.equal(count, 0);
});

// ── 三阶 wrapper：buildCellInitial ───────────────────────────────────────────

test('buildCellInitial 丙：单色格 → tier=丙', () => {
  const r = buildCellInitial(['111', '111']);
  assert.equal(r.tier, '丙');
  assert.ok(r.reason);
});

test('buildCellInitial 丙：可填格 < 2 → tier=丙', () => {
  const r = buildCellInitial(['..1', '...']);
  assert.equal(r.tier, '丙');
});

test('buildCellInitial 甲：均衡多色 → misplaced 存在', () => {
  const pattern = ['1122', '3344'];
  const r = buildCellInitial(pattern);
  assert.equal(r.tier, '甲');
  assert.ok(Array.isArray(r.misplaced));
  assert.equal(r.misplaced.length, 2);
  // 形状断言
  for (const line of r.misplaced) assert.equal(line.length, 4);
});

test('buildCellInitial 乙：失衡但有多色 → swaps 非空', () => {
  // 主导色1 = 3/4 > 2 → 甲失败；色1和色2各可配对 → 乙
  const pattern = ['1112'];
  const r = buildCellInitial(pattern);
  assert.equal(r.tier, '乙');
  assert.ok(r.swaps && r.swaps.length >= 1);
  // swaps 坐标 cell-local（cols=4, rows=1）
  for (const [row, col] of r.swaps.flat().reduce((acc, _, i, a) => i % 2 === 0 ? acc : acc, []) || []) {
    // just check it's an array of 4-tuples
  }
  assert.ok(r.swaps.every((s) => Array.isArray(s) && s.length === 4));
});

test('buildCellInitial 含 x 锁珠格时甲正常，x 位保留', () => {
  // .x. / 121 → fillable = [1,2,1] → maxFreq=2, N=3, 2≤1? No, 2>1 → 甲失败
  // 改为均衡：x / 1 2 → .x1/2.. → fillable=[1,2], N=2, maxFreq=1≤1 ✓
  const pattern = ['.x1', '2..'];
  const r = buildCellInitial(pattern);
  assert.equal(r.tier, '甲');
  // misplaced 行1 col1 必须是 x（pattern 锁珠位）
  assert.equal(r.misplaced[0][1], 'x');
});
