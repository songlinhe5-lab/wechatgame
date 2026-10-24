/* lab.mjs 纯逻辑自检（零依赖）：node apps/beads-studio/lab.selftest.mjs
 * 只锁两处易回退的口径：desilk 细丝判据须与 T4 同口径（bbox 最短边）、同色多细丝块不得整色消失。
 */
import assert from 'node:assert/strict';
import { buildShape, despeckle, desilk, derange, labReport } from './lab.mjs';

// A 真细丝（bbox 最短边 = 1）：两块 1×3 直条 ⇒ 只并一块，另一块保住色数（total 须同轮递减）
const a = desilk(['BBBBBBB', 'BAAABBB', 'BBBBBBB', 'BAAABBB', 'BBBBBBB']);
assert.equal(a.changed, 3, '真细丝应被并，但不得并到该色归零');
assert.equal(a.pattern.filter((r) => r.includes('A')).length, 1, '应保留一块 A');

// B 凹块（bbox 2×2）：旧口径「每行/每列格数最小值」= 1 会误判细丝并掉整块（实测误并 189 格）
const b = desilk(['BBBBBB', 'BAAABB', 'BAABBB', 'BBBBBB', 'BAAABB', 'BAABBB', 'BBBBBB']);
assert.equal(b.changed, 0, 'L 形块不得判为细丝');

// C 闭合环豁免：1 格宽方框是图案元素，不是毛刺
assert.equal(desilk(['BBBBB', 'B.A.B', 'BAAAB', 'B...B', 'BBBBB']).changed, 0, '闭合环应豁免');

// 主流水线默认参数：无细丝的盘面 desilk 必须零改动（幂等）；derange 全错位成立
const g = despeckle(buildShape({ mode: 'mandala', size: 30, petals: 8, ringW: 1.6, seam: 1.5 }).pattern).pattern;
assert.equal(labReport(g).T4, 0);
assert.equal(desilk(g).changed, 0, 'T4=0 的盘面 desilk 应为零改动');
assert.ok(derange(g, { seed: 0 }).ok, 'derange 应找到全错位解');
