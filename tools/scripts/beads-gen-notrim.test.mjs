// tools/scripts/beads-gen-notrim.test.mjs
// `--notrim`（关包围盒裁剪）判据 —— 关卡模式「按该关尺寸生成」的执行层保证。
//
// 为什么需要：默认裁空边（2026-09-21 拍板）会让「为该关生成」的结果实际盘面 < 请求尺寸
// （实测 13×12 → 11×8；本测试合成图 → 9×8），替换回同一个关就把盘面改小。
// `apps/beads-studio` 的 `?notrim=1` 直通本 flag ⇒ **这里锁死"输出盘面 == 请求尺寸"**，
// 谁再动裁剪块都会先撞红。
//
// 判据：① 默认档必须仍裁（对照组，防"一刀切成永不裁"）；② `--notrim` 输出 == 请求 cols×rows；
//      ③ 空边全为 void（'.'）；④ 非空珠数两种口径一致（只补边、不改画）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GEN = 'tools/scripts/beads-gen.mjs';
const COLS = 13;
const ROWS = 12;
const CELL = 10;
const MARGIN = 2; // 格：四边各留 2 格背景 ⇒ 默认必裁成 9×8

/** 白底 + 居中的三色块（合成图，零随机）。 */
function rawJson() {
  const w = COLS * CELL;
  const h = ROWS * CELL;
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = Math.floor(x / CELL);
      const r = Math.floor(y / CELL);
      const inner = c >= MARGIN && c < COLS - MARGIN && r >= MARGIN && r < ROWS - MARGIN;
      const o = (y * w + x) * 4;
      const band = inner ? Math.min(2, Math.floor((c - MARGIN) / 3)) : -1; // 内部按列分 3 色
      buf[o] = band === 0 ? 0xc0 : band === 1 ? 0x30 : inner ? 0x20 : 0xff;
      buf[o + 1] = band === 0 ? 0x20 : band === 1 ? 0x80 : inner ? 0xc0 : 0xff;
      buf[o + 2] = band === 0 ? 0x20 : band === 1 ? 0x40 : inner ? 0x30 : 0xff;
      buf[o + 3] = 255;
    }
  }
  return JSON.stringify({ w, h, data: buf.toString('base64') });
}

function runGen(extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'beads-gen-notrim-'));
  const rawPath = join(dir, 'raw.json');
  writeFileSync(rawPath, rawJson());
  const r = spawnSync(process.execPath, [
    GEN, '--in-raw', rawPath, '--no-png', '--out', dir,
    '--cols', String(COLS), '--rows', String(ROWS),
    '--palette', '10', '--colors', '3', '--minadj', '0',
    '--mis', 'none',
    ...extraArgs,
  ], { cwd: REPO, encoding: 'utf8' });
  let pattern = null;
  try {
    pattern = JSON.parse(readFileSync(join(dir, 'pattern.json'), 'utf8'));
  } catch { /* 未落盘 */ }
  return { code: r.status, stderr: r.stderr || '', pattern };
}

const beads = (pat) => pat.reduce((n, row) => n + [...row].filter((ch) => ch !== '.').length, 0);

test('对照组：默认档仍裁空边（输出盘面 < 请求尺寸）', () => {
  const r = runGen();
  assert.equal(r.code, 0, `默认档应出盘，实得 exit=${r.code}\n${r.stderr}`);
  const pat = r.pattern.pattern;
  assert.match(r.stderr, /# trim /, '默认档必须仍执行包围盒裁剪（否则本 flag 失去意义）');
  assert.deepEqual([pat[0].length, pat.length], [COLS - 2 * MARGIN, ROWS - 2 * MARGIN]);
});

test('--notrim：输出盘面 == 请求 cols×rows，空边为 void，珠数与默认档一致', () => {
  const on = runGen(['--notrim']);
  assert.equal(on.code, 0, `--notrim 应出盘，实得 exit=${on.code}\n${on.stderr}`);
  const pat = on.pattern.pattern;
  assert.deepEqual([pat[0].length, pat.length], [COLS, ROWS], '关掉裁剪后盘面必须等于请求尺寸');
  assert.match(on.stderr, /# trim 关闭（--notrim）/, '应留下"主动没裁"的证据行');

  // 四边空边全是 void（'.'），内部不许被裁剪改画
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const edge = r < MARGIN || r >= ROWS - MARGIN || c < MARGIN || c >= COLS - MARGIN;
      if (edge) assert.equal(pat[r][c], '.', `空边 @${r},${c} 应为 void，实得 "${pat[r][c]}"`);
      else assert.notEqual(pat[r][c], '.', `内部 @${r},${c} 不该是 void`);
    }
  }
  assert.equal(beads(pat), beads(runGen().pattern.pattern), '仅补边、不改画：两种口径的非空珠数必须相同');
});
