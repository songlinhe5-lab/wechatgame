/**
 * 关卡数据静态校验器（文件级 / 跨关 / 玩法约束）— WXG-T-004 / WXG-T-011
 *
 * ⚠️ 校验分工（唯一权威裁定，见 levels-spec.md §5.1）：
 *   - **per-level 结构校验（唯一权威）** → `games/breakout/design/levels/levels.schema.ts::validateLevel()`
 *     （字符集 ⊆ LEVEL_CHARSET、每行长度 === grid.cols、行数 ≤ BRICK_MAX_ROWS、rows 非空）
 *     本文件**不复制**这些规则，直接消费 `validateLevel()` 与 `LEVEL_CHARSET` 常量。
 *   - **文件级 / 跨关 / 玩法约束（本文件独有）**：
 *     关卡数、id 连续、可破坏 HP 序列、ballSpeed 序列单调、paddleWidth、S 占比 ≤20%、
 *     ≥1 行完整可破坏砖、可破坏砖未被钢砖封闭（BFS）。
 *
 * TS 互操作：Node ≥22.18 默认启用 type-stripping，直接 `import ... from '*.ts'`。
 * 若运行环境较旧，加 `node --experimental-strip-types`。
 *
 * 用法：node production/qa/validate-levels.mjs   （退出码 0 = 全通过）
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateLevel, LEVEL_CHARSET, BRICK_MAX_ROWS } from '../../games/breakout/design/levels/levels.schema.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = resolve(HERE, '../../games/breakout/design/levels/levels-01-05.json');

const PASS = '✅';
const FAIL = '❌';
const results = [];
let failed = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed++;
}

const data = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const cols = data.grid.cols;
// 仅用于玩法分类（是否可破坏），不用于字符集校验——字符集唯一权威是 validateLevel()
const DESTRUCTIBLE = new Set(['N', 'T', 'B', 'G']);
const hpOf = (code) => {
  const def = data.brickTypes[code];
  return def && !def.indestructible && typeof def.hp === 'number' ? def.hp : 0;
};

const EXPECTED_HP = [30, 50, 44, 56, 58];
const EXPECTED_SPEED = [480, 500, 520, 540, 560];
const EXPECTED_PADDLE = 140;

// ── 文件级 ────────────────────────────────────────────────────────
check('关卡数为 5', data.levels.length === 5, `actual=${data.levels.length}`);
check(
  'id 连续 1..5',
  data.levels.every((lv, i) => lv.id === i + 1),
  data.levels.map((lv) => lv.id).join(','),
);
check(
  `LEVEL_CHARSET 常量已消费（权威来源 levels.schema.ts）`,
  LEVEL_CHARSET === '.NTSBG',
  `LEVEL_CHARSET='${LEVEL_CHARSET}'`,
);

const perLevel = [];
for (const lv of data.levels) {
  const idx = lv.id - 1;

  // ★ per-level 结构校验：复用唯一权威 validateLevel()（字符集/行长/行数上限/rows非空）
  const structErrors = validateLevel(lv, data.grid);
  check(
    `L${lv.id} 结构校验（validateLevel 权威）`,
    structErrors.length === 0,
    structErrors.join(' / ') || `行长=${cols} 行数=${lv.rows.length}≤${BRICK_MAX_ROWS}`,
  );

  // ── 玩法约束（本文件独有）──
  let destructibleHp = 0;
  let bricks = 0;
  let steel = 0;
  const counts = { N: 0, T: 0, S: 0, B: 0, G: 0, '.': 0 };
  for (const r of lv.rows) {
    for (const ch of r) {
      counts[ch] = (counts[ch] ?? 0) + 1;
      if (ch === '.') continue;
      bricks++;
      if (ch === 'S') steel++;
      if (DESTRUCTIBLE.has(ch)) destructibleHp += hpOf(ch);
    }
  }

  check(`L${lv.id} 可破坏 HP == ${EXPECTED_HP[idx]}`, destructibleHp === EXPECTED_HP[idx], `actual=${destructibleHp}`);
  check(`L${lv.id} ballSpeed == ${EXPECTED_SPEED[idx]}`, lv.ballSpeed === EXPECTED_SPEED[idx], `actual=${lv.ballSpeed}`);
  check(`L${lv.id} ballSpeed <= BALL_SPEED_MAX(720)`, lv.ballSpeed <= 720, `actual=${lv.ballSpeed}`);
  check(`L${lv.id} paddleWidth == ${EXPECTED_PADDLE}`, lv.paddleWidth === EXPECTED_PADDLE, `actual=${lv.paddleWidth}`);

  const steelRatio = bricks === 0 ? 0 : steel / bricks;
  check(`L${lv.id} 钢砖占比 <= 20%`, steelRatio <= 0.2 + 1e-9, `${steel}/${bricks} = ${(steelRatio * 100).toFixed(1)}%`);

  const fullRow = lv.rows.some((r) => [...r].every((ch) => DESTRUCTIBLE.has(ch)));
  check(`L${lv.id} 至少 1 行完整可破坏砖`, fullRow);

  // 连通性：可破坏砖不被钢砖完全封闭（外缘 8 邻域 BFS；passable = 非钢砖）
  const R = lv.rows.length;
  const open = (r, c) => r >= 0 && r < R && c >= 0 && c < cols && lv.rows[r][c] !== 'S';
  const seen = Array.from({ length: R }, () => Array(cols).fill(false));
  const queue = [];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < cols; c++) {
      if ((r === 0 || r === R - 1 || c === 0 || c === cols - 1) && open(r, c)) {
        seen[r][c] = true;
        queue.push([r, c]);
      }
    }
  while (queue.length) {
    const [r, c] = queue.shift();
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (open(nr, nc) && !seen[nr][nc]) {
          seen[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
  }
  const enclosed = [];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < cols; c++)
      if (DESTRUCTIBLE.has(lv.rows[r][c]) && !seen[r][c]) enclosed.push(`(${r},${c})`);
  check(`L${lv.id} 可破坏砖未被钢砖封闭`, enclosed.length === 0, enclosed.join(' '));

  perLevel.push({
    id: lv.id, name: lv.name, rows: lv.rows.length, bricks,
    destructibleHp, steel, tCount: counts.T, tRatio: bricks ? +(counts.T / bricks).toFixed(3) : 0,
    speed: lv.ballSpeed, paddle: lv.paddleWidth, dropRate: lv.powerupDropRate,
  });
}

// ballSpeed 单调递增（跨关）
const speeds = data.levels.map((lv) => lv.ballSpeed);
check(
  'ballSpeed 全局单调递增',
  speeds.every((s, i) => i === 0 || s > speeds[i - 1]),
  speeds.join('→'),
);

// ── 输出 ──────────────────────────────────────────────────────────
console.log('关卡数据静态校验 — levels-01-05.json（结构=validateLevel 权威 / 玩法=本文件）');
console.log('='.repeat(72));
for (const r of results) console.log(`${r.ok ? PASS : FAIL}  ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
console.log('='.repeat(72));
console.log(`合计 ${results.length} 项，通过 ${results.length - failed}，失败 ${failed}`);
console.log('\n各关构成明细：');
for (const p of perLevel)
  console.log(
    `  L${p.id} ${p.name}\t行${p.rows}\t砖${p.bricks}\t可破坏HP=${p.destructibleHp}\t` +
      `T=${p.tCount}(${(p.tRatio * 100).toFixed(0)}%)\tS=${p.steel}\t球速${p.speed}\t挡板${p.paddle}\t掉率${p.dropRate}`,
  );
process.exit(failed === 0 ? 0 : 1);
