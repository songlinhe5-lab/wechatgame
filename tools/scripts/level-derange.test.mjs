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

test('buildCellInitial 甲max：本宫失衡（m>N/2）且多色 → 不再退成 swaps，取守恒极值', () => {
  // 主导色1 = 3/4 > ⌊4/2⌋=2 → 甲失败；但 N=4、m=3 均 >1 ⇒ 甲′ 成：F=2、M=2。
  // ⚠️ 本批**不删乙**（任务单边界），但甲′ 插在中间后乙在 buildCellInitial 路径上已不可达
  //   （见 level-derange.mjs 内注释）⇒ 本条从旧「乙：swaps 非空」改判为「甲max」，
  //   乙档自身的构造断言仍在上方 `buildSwaps 乙：…` 三条里（直接调 API，未被绕过）。
  const pattern = ['1112'];
  const r = buildCellInitial(pattern);
  assert.equal(r.tier, '甲max');
  assert.equal(r.N, 4);
  assert.equal(r.F, 2); // max(0, 2*3-4)
  assert.equal(r.M, 2); // N - F
  assert.ok(Array.isArray(r.misplaced) && r.misplaced.length === 1);
  assert.equal(r.misplaced[0], '2111'); // 同多重集重排：色2 移到首位、末位补色1 ⇒ 恰好 2 颗错位、2 颗强制就位
  assert.ok(!r.swaps); // 走 misplaced，不返 swaps
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

// ── §3.2 批2：`max`（最大化错位）的极值公式与守恒 —— 穷举实测（X2 / X3）─────────────
// 背景：levels-spec §2.3-2 的 `M_max = min(N, 2(N−m))`、`F = max(0, 2m−N)` 与 §3.3 三例
// 均为文策渊**手算**（原文标 `[待 X2 实测]`）。下面两件把「待实测」换成真断言：
//   X2 = 对**所有**色分布穷举，固定点数恰等于理论值（含 `x`/`.` 混合不可填轮廓）；
//   X3 = 存在性：合法盘（≥3 色）恒 `M_max ≥ 1`，且 wrapper 永远给得出错位盘（不落乙/丙）。
// 穷举域：3×4 = 12 格，其中 4 格不可填（1 个 `x` 锁珠 + 3 个 `.` 空位）⇒ N = 8，色 1–3
// ⇒ 3^8 = 6561 个赋值，全走真函数（非抽样）。确定性、零 Math.random（L4）。

/** 12 格轮廓：不可填位 = 0('.')、4('x')、7('.')、11('.')；其余按 colors 依次填入。 */
const X_COLS = 4;
const X_VOID = new Set([0, 7, 11]); // '.'
const X_LOCK = new Set([4]); // 'x'（同样不可填，但必须保留字符）
const X_FILL = [1, 2, 3, 5, 6, 8, 9, 10].sort((a, b) => a - b); // N = 8

const colorOfChar = (ch) => (ch >= '1' && ch <= '9' ? ch.charCodeAt(0) - 48 : 0);

/** 把一组可填位色号编回 rowstring[]（不可填位按轮廓写 `x` / `.`）。 */
function xPattern(colors) {
  const byIdx = new Map(X_FILL.map((i, k) => [i, colors[k]]));
  const rows = [];
  for (let r = 0; r < 3; r++) {
    let line = '';
    for (let c = 0; c < X_COLS; c++) {
      const i = r * X_COLS + c;
      line += X_LOCK.has(i) ? 'x' : X_VOID.has(i) ? '.' : String(byIdx.get(i));
    }
    rows.push(line);
  }
  return rows;
}

/** 穷举所有 3^8 赋值，产出逐例实测值（X2 / X3 共用，算一次）。 */
function enumerateMax() {
  const out = [];
  const colors = new Array(X_FILL.length).fill(1);
  const total = Math.pow(3, X_FILL.length);
  for (let n = 0; n < total; n++) {
    let rest = n;
    for (let k = 0; k < colors.length; k++) {
      colors[k] = (rest % 3) + 1;
      rest = Math.floor(rest / 3);
    }
    const flat = colors.slice();
    const cnt = new Map();
    for (const v of flat) cnt.set(v, (cnt.get(v) ?? 0) + 1);
    const m = Math.max(...cnt.values());
    out.push({ colors: colors.slice(), N: X_FILL.length, m, distinct: cnt.size });
  }
  return out;
}
const X_CASES = enumerateMax();

test('X2 穷举（6561 例，含 x/. 混合轮廓）：固定点数恒 = max(0,2m−N)、M = min(N,2(N−m))、每色守恒', () => {
  let imbalanced = 0; // m > ⌊N/2⌋ 的例数（= 甲max 真正接手的地盘）
  for (const { colors, N, m } of X_CASES) {
    const M_max = Math.min(N, 2 * (N - m));
    const F = Math.max(0, 2 * m - N);
    const r = derangeCell(rowstringsToSolved(xPattern(colors)).flat, 'max');
    // 唯一仍不可解的退化：整盘单色（m=N）；本轮廓 N=8 恒 ≥ 2 ⇒ 无 `N<2` 分支
    assert.equal(r.ok, m < N, `ok 与「m=N ⇒ M_max=0」不一致：${colors.join('')}`);
    assert.equal(r.N, N);
    assert.equal(r.m, m);
    assert.equal(r.M_max, M_max, `M_max 公式对不上：${colors.join('')}`);
    assert.equal(r.F, F, `F 对不上：${colors.join('')}`);
    if (!r.ok) {
      assert.equal(M_max, 0);
      continue;
    }
    if (m > Math.floor(N / 2)) imbalanced++;
    const flat = rowstringsToSolved(xPattern(colors)).flat;
    let fixed = 0;
    const cntSolved = new Map();
    const cntMis = new Map();
    for (let i = 0; i < flat.length; i++) {
      if (flat[i] === 0) { assert.equal(r.misplaced[i], 0, `不可填位被填上珠：${i}`); continue; }
      cntSolved.set(flat[i], (cntSolved.get(flat[i]) ?? 0) + 1);
      cntMis.set(r.misplaced[i], (cntMis.get(r.misplaced[i]) ?? 0) + 1);
      assert.ok(r.misplaced[i] > 0, `可填位被清空：${i}`);
      if (r.misplaced[i] === flat[i]) fixed++;
    }
    assert.equal(fixed, F, `固定点 ${fixed} ≠ F=${F}：${colors.join('')}`);
    assert.equal(r.M, N - F, `M ≠ N−F：${colors.join('')}`);
    assert.equal(r.M, M_max, `M 未取到极值：${colors.join('')}`);
    // 守恒硬约束（§3.13 校验④不放宽）：每色珠数不变 ⇒ 不得改色
    assert.deepEqual([...cntMis.entries()].sort(), [...cntSolved.entries()].sort(), `不守恒：${colors.join('')}`);
    // m ≤ ⌊N/2⌋ 时 max **等价于 full、不打折**：两档输出逐格相同
    if (m <= Math.floor(N / 2)) {
      const full = derangeCell(flat);
      assert.ok(full.ok, '均衡盘 full 档应可行');
      assert.deepEqual(r.misplaced, full.misplaced, `max 与 full 不等价：${colors.join('')}`);
      assert.equal(F, 0);
    }
  }
  // 穷举域真的踩到了失衡区（否则本件只是空转）：N=8、m≥5 的 3 色赋值不少
  assert.ok(imbalanced > 100, `穷举未覆盖 m>N/2 区域（imbalanced=${imbalanced}）`);
});

test('X3 存在性：合法盘（≥3 色）恒 M_max ≥ 1 且 wrapper 必出错位盘（不落乙/丙）', () => {
  let minM = Infinity;
  let checked = 0;
  for (const { colors, N, m, distinct } of X_CASES) {
    if (distinct < 3) continue; // 合法关面下限 = §2 色数 ≥3
    const M_max = Math.min(N, 2 * (N - m));
    assert.ok(M_max >= 1, `合法盘竟 M_max=${M_max}：${colors.join('')}`);
    const r = buildCellInitial(xPattern(colors));
    assert.ok(r.tier === '甲' || r.tier === '甲max', `tier=${r.tier}（合法盘不该落乙/丙）：${colors.join('')}`);
    assert.ok(r.M >= 1 && Array.isArray(r.misplaced));
    // rowstring 往返：错位盘与正解盘同轮廓（`x` 位仍 `x`、`.` 位仍 `.`）、同多重集
    const init = xPattern(colors);
    assert.equal(r.misplaced.length, init.length);
    for (let i = 0; i < init.length; i++) {
      assert.equal(r.misplaced[i].length, init[i].length);
      for (let c = 0; c < init[i].length; c++) {
        const pc = init[i][c];
        if (pc === 'x' || pc === '.') assert.equal(r.misplaced[i][c], pc, `轮廓不匹配 @${i},${c}`);
        else assert.ok(colorOfChar(r.misplaced[i][c]) > 0, `色号解码为 0 @${i},${c}`);
      }
    }
    minM = Math.min(minM, r.M);
    checked++;
  }
  // 例数与下界均**钉死为确切值**（不取 `> / >=` 余量）：文档 levels-spec §2.3-3 直引这两个数，
  // 若穷举域被改（色数 / 轮廓）则本件先红，避开「文档写了个测试不认可的数」的双源漂移（K-047）。
  // 满射数 = 3⁸ − C(3,1)·2⁸ + C(3,2)·1⁸ = 6561 − 768 + 3 = 5796。
  assert.equal(checked, 5796, `≥ 3 色的穷举例数与文档不符（文档 = 3⁸−3·2⁸+3 = 5796）`);
  // 文策渊 §2.3-3 断言「N≥3 且 m≤N−2 ⇒ M_max ≥ 4」；本穷举域 N=8 **恰取下该下界**（= 4，不是余量）
  assert.equal(minM, 4, `实测最小 M 不再是 4 ⇒ §2.3-3 的「下界 tight」论述需同步改写`);
});

test('§3.3 三例手算 → 实测吻合（N=10[7,3]、N=9[5,2,2]、N=12[6,3,3]）', () => {
  // 例 1：N=10、[7,3] ⇒ m=7 > 5 ⇒ F=4、M=6（甲 失败、甲max 接手）
  const a = derangeCell([1, 1, 1, 1, 1, 1, 1, 2, 2, 2], 'max');
  assert.equal(a.ok, true);
  assert.deepEqual([a.N, a.m, a.M, a.F], [10, 7, 6, 4]);
  assert.equal(derangeCell([1, 1, 1, 1, 1, 1, 1, 2, 2, 2]).ok, false); // full 仍拒（契约不变）
  // 例 2：N=9、[5,2,2] ⇒ m=5 > 4 ⇒ F=1、M=8
  const b = derangeCell([1, 1, 1, 1, 1, 2, 2, 3, 3], 'max');
  assert.deepEqual([b.N, b.m, b.M, b.F], [9, 5, 8, 1]);
  // 例 3：N=12、[6,3,3] ⇒ m=6 ≤ 6 ⇒ F=0、M=12 = 全错可行 ⇒ max 等价 full（tier 仍为甲）
  const c = derangeCell([1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3], 'max');
  assert.deepEqual([c.N, c.m, c.M, c.F], [12, 6, 12, 0]);
  const full = derangeCell([1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
  assert.ok(full.ok && full.M === 12 && full.F === 0);
  assert.deepEqual(c.misplaced, full.misplaced);
});
