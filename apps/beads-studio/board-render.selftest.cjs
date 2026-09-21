/* board-render.js 纯逻辑自检（不依赖 DOM）：node apps/beads-studio/board-render.selftest.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// 与浏览器同路径：classic script 直接求值，读 window 全局（包是 type:module，不可 require）
(0, eval)(fs.readFileSync(path.join(__dirname, 'public', 'board-render.js'), 'utf8'));
const R = globalThis.BeadsBoardRender;

assert.equal(R.indexFromChar('1'), 0);
assert.equal(R.indexFromChar('9'), 8);
assert.equal(R.indexFromChar('A'), 9); // '1'-'9' 后接字母（levels-spec §2 charset）

assert.equal(R.mix('#000000', 1), '#ffffff');
assert.equal(R.mix('#ffffff', -1), '#000000');
assert.equal(R.mix('#808080', 0), '#808080');

assert.equal(R.beadColor(0), '#FDF6E9'); // 奶白 = 游戏 1 号
assert.equal(R.beadColor(6), '#3D7BF5'); // 湖蓝 = 7 号
assert.equal(R.beadColor(99), '#33333D'); // 越界 → 炭黑兜底（palette.ts beadColor 同规则）

const L = R.layout(420, 420, 14, 14);
assert.ok(Math.abs(L.cell - 30) < 1e-9);
assert.ok(Math.abs(L.size - (30 * 50) / 52) < 1e-9); // 珠边 = 格边 × BEAD_CELL/BEAD_PITCH
assert.equal(L.ox, 0);

console.log('board-render selftest OK（6 组断言）');
