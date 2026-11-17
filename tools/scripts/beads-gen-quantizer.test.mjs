// tools/scripts/beads-gen-quantizer.test.mjs
// A 档选色：`--quantizer median-hue`（hue-aware Median Cut）接线判据。
//
// 为什么需要：median-hue 的方法学在 lib/palette-rules.mjs（与 palette-quantize 共用），
// beads-gen 只负责把簇心接进「噪声过滤 → 品牌映射」原管线。这里锁三件事：
//   ① 默认（不传）仍是 pixel-kmeans/mode —— 历史行为不变；
//   ② 显式 --quantizer median-hue 落盘为 pixel-median-hue/mode；
//   ③ 非法值 exit 3（白名单，防拼错静默回退）。
// 全确定性：合成四象限图（每色恰好 25%，可全错位），不依赖样本照片与 Math.random。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GEN = 'tools/scripts/beads-gen.mjs';
const COLS = 12;
const ROWS = 12;
const CELL = 8;

/** 四象限四色（红/绿/蓝/黄），每色 36 格 = 25%。 */
function rawJson() {
  const w = COLS * CELL;
  const h = ROWS * CELL;
  const buf = Buffer.alloc(w * h * 4);
  const midX = w / 2;
  const midY = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const top = y < midY, left = x < midX;
      const rgb = top ? (left ? [220, 40, 40] : [40, 170, 70]) : (left ? [50, 90, 220] : [230, 200, 60]);
      const o = (y * w + x) * 4;
      buf[o] = rgb[0]; buf[o + 1] = rgb[1]; buf[o + 2] = rgb[2]; buf[o + 3] = 255;
    }
  }
  return JSON.stringify({ w, h, data: buf.toString('base64') });
}

function runGen(extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'beads-gen-quant-'));
  const rawPath = join(dir, 'raw.json');
  writeFileSync(rawPath, rawJson());
  const args = [
    GEN, '--in-raw', rawPath, '--no-png', '--out', dir,
    '--cols', String(COLS), '--rows', String(ROWS),
    '--palette', '10', '--colors', '4', '--minadj', '0', '--noframe', '--mis', 'full',
    ...extraArgs,
  ];
  const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8' });
  let pattern = null;
  try { pattern = JSON.parse(readFileSync(join(dir, 'pattern.json'), 'utf8')); } catch { /* 未落盘 */ }
  return { code: r.status, stderr: r.stderr || '', pattern };
}

test('quantizer 默认仍是 kmeans', () => {
  const { code, stderr, pattern } = runGen();
  assert.equal(code, 0, '默认生成应成功：' + stderr);
  assert.equal(pattern.report.colorLimit.mode, 'pixel-kmeans/mode');
});

test('--quantizer median-hue 走 hue-aware Median Cut 并落盘模式', () => {
  const { code, stderr, pattern } = runGen(['--quantizer', 'median-hue']);
  assert.equal(code, 0, 'median-hue 生成应成功：' + stderr);
  assert.equal(pattern.report.colorLimit.mode, 'pixel-median-hue/mode');
  assert.ok(pattern.report.colorsUsed >= 2, '四象限图不该只剩 1 色');
});

test('--quantizer 非法值 exit 3（白名单）', () => {
  const { code, stderr } = runGen(['--quantizer', 'bogus']);
  assert.equal(code, 3);
  assert.match(stderr, /--quantizer 只支持/);
});
