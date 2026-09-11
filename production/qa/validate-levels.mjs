/**
 * 关卡数据静态校验器 — WXG-T-004
 *
 * 纯静态：只读取 design/levels/levels-01-05.json，不 import 任何工程代码。
 * 口径（对齐 levels-spec.md §3/§4/§5 与 systems-index §3）：
 *   - 关卡数 5，id 连续 1..5
 *   - 每行长度严格 == grid.cols (10)
 *   - 字符集 ⊆ { '.', 'N', 'T', 'S', 'B', 'G' }（'.' = 空位，非砖）
 *   - 可破坏 HP == [30, 50, 44, 56, 58]（S=0，不参与；'.' 不生成砖）
 *   - ballSpeed == [480, 500, 520, 540, 560] 且 <= BALL_SPEED_MAX(720)
 *   - paddleWidth 全 == 140
 *   - 钢砖 S 占比 <= 20%
 *   - 每关至少 1 行"完整可破坏砖"（整行无 '.' 且无 'S'）
 *   - 可破坏砖不被钢砖完全封闭（连通性：从砖阵外缘可经非钢砖格 8 邻域到达）
 *
 * 用法：node production/qa/validate-levels.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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
const ALLOWED = new Set(['.', 'N', 'T', 'S', 'B', 'G']);
const DESTRUCTIBLE = new Set(['N', 'T', 'B', 'G']); // S 不可破坏
const hpOf = (code) => {
  const def = data.brickTypes[code];
  return def && !def.indestructible && typeof def.hp === 'number' ? def.hp : 0;
};

const EXPECTED_HP = [30, 50, 44, 56, 58];
const EXPECTED_SPEED = [480, 500, 520, 540, 560];
const EXPECTED_PADDLE = 140;

// ── 结构 ──────────────────────────────────────────────────────────
check('关卡数为 5', data.levels.length === 5, `actual=${data.levels.length}`);
check(
  'id 连续 1..5',
  data.levels.every((lv, i) => lv.id === i + 1),
  data.levels.map((lv) => lv.id).join(','),
);

const perLevel = [];
for (const lv of data.levels) {
  const idx = lv.id - 1;
  const rows = lv.rows;
  const errs = [];

  // 行长度
  const badLen = rows.map((r, i) => (r.length !== cols ? `row${i}=${r.length}` : null)).filter(Boolean);
  check(`L${lv.id} 每行长度 == ${cols}`, badLen.length === 0, badLen.join(' '));

  // 字符集
  const badChars = new Set();
  for (const r of rows) for (const ch of r) if (!ALLOWED.has(ch)) badChars.add(ch);
  check(`L${lv.id} 字符集 ⊆ .NTSBG`, badChars.size === 0, `非法字符: ${[...badChars].join(',') || '无'}`);

  // 逐格统计
  let destructibleHp = 0;
  let bricks = 0;
  let steel = 0;
  const counts = { N: 0, T: 0, S: 0, B: 0, G: 0, '.': 0 };
  for (const r of rows) {
    for (const ch of r) {
      counts[ch] = (counts[ch] ?? 0) + 1;
      if (ch === '.') continue;
      bricks++;
      if (ch === 'S') steel++;
      if (DESTRUCTIBLE.has(ch)) destructibleHp += hpOf(ch);
    }
  }

  check(
    `L${lv.id} 可破坏 HP == ${EXPECTED_HP[idx]}`,
    destructibleHp === EXPECTED_HP[idx],
    `actual=${destructibleHp}`,
  );
  check(
    `L${lv.id} ballSpeed == ${EXPECTED_SPEED[idx]}`,
    lv.ballSpeed === EXPECTED_SPEED[idx],
    `actual=${lv.ballSpeed}`,
  );
  check(
    `L${lv.id} ballSpeed <= 720`,
    lv.ballSpeed <= 720,
    `actual=${lv.ballSpeed}`,
  );
  check(
    `L${lv.id} paddleWidth == ${EXPECTED_PADDLE}`,
    lv.paddleWidth === EXPECTED_PADDLE,
    `actual=${lv.paddleWidth}`,
  );
  check(`L${lv.id} 行数 <= 6`, rows.length <= 6, `rows=${rows.length}`);

  const steelRatio = bricks === 0 ? 0 : steel / bricks;
  check(
    `L${lv.id} 钢砖占比 <= 20%`,
    steelRatio <= 0.2 + 1e-9,
    `${steel}/${bricks} = ${(steelRatio * 100).toFixed(1)}%`,
  );

  // 至少 1 行完整可破坏砖（整行无 '.' 且无 'S'）
  const fullRow = rows.some((r) => [...r].every((ch) => DESTRUCTIBLE.has(ch)));
  check(`L${lv.id} 至少 1 行完整可破坏砖`, fullRow);

  // 连通性：可破坏砖不被钢砖完全封闭
  // passable = 非钢砖格；从砖阵外缘（四周）8 邻域 BFS
  const R = rows.length;
  const open = (r, c) => r >= 0 && r < R && c >= 0 && c < cols && rows[r][c] !== 'S';
  const seen = Array.from({ length: R }, () => Array(cols).fill(false));
  const queue = [];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < cols; c++) {
      const border = r === 0 || r === R - 1 || c === 0 || c === cols - 1;
      if (border && open(r, c)) {
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
      if (DESTRUCTIBLE.has(rows[r][c]) && !seen[r][c]) enclosed.push(`(${r},${c})`);
  check(`L${lv.id} 可破坏砖未被钢砖封闭`, enclosed.length === 0, enclosed.join(' '));

  perLevel.push({
    id: lv.id,
    name: lv.name,
    rows: rows.length,
    bricks,
    destructibleHp,
    steel,
    tCount: counts.T,
    tRatio: bricks ? +(counts.T / bricks).toFixed(3) : 0,
    speed: lv.ballSpeed,
    paddle: lv.paddleWidth,
    dropRate: lv.powerupDropRate,
    counts,
    errs,
  });
}

// ── 输出 ──────────────────────────────────────────────────────────
console.log('关卡数据静态校验 — levels-01-05.json');
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
