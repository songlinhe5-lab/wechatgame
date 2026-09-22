// WXG-T-182 · G-3 取证 —— 环境自检（temp/ 临时件）。只验证「Node 能直跑生产实现本体」。
import { createBeadsHarness } from '../games/beads/tests/helpers.js';

const h = createBeadsHarness({ seed: 'probe', noAssemble: true, levels: undefined });
console.log('phase =', h.game.phase, '| levels =', h.game.levelCount, '| tray cap =', h.game.tray.capacity);
h.game.goToLevel(0);
console.log('after goToLevel: phase =', h.game.phase, 'grid', h.game.grid.rows + 'x' + h.game.grid.cols);
