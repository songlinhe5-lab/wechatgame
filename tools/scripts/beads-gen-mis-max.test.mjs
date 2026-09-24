// tools/scripts/beads-gen-mis-max.test.mjs
// §3.2 批2：`--mis max`（最大化错位）端到端判据 —— 含「同图红→绿」对照。
//
// 为什么这张图必定红：`--colors 2` + 奇数格（13×11=143）+ `--noframe`（无空位可承接）
// ⇒ `balance()` 结构上不可能把主导色钳到 ≤⌊143/2⌋=71（71+72=143 已用满两色），
// 所以旧 `full` 档只能 `derange → ok:false → 自检 exit 1`（拒产、无 levelDraft）。
// `max` 档跑同图同参：跳过 balance、不判不可解 ⇒ exit 0 出错位盘（F 颗强制就位）。
//
// 判据面（对应正本 levels-spec §2.3）：① 极值式 M/N/F 落进 pattern.json；② **守恒不破**
// （每色 pattern 数 == misplaced 数）；③ 轮廓逐格匹配（含 `x`/`.` 位不动）；④ 默认档不变。
// 全确定性、零 Math.random；beads-gen 内部会 spawn 真引擎 bot（cwd 必须是仓根，其相对路径依赖）。
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
const ROWS = 11;
const CELL = 8; // 每格 8px ⇒ 硬边界落在格界上，量化无歧义
const CHARSET = '.x123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const colorOfChar = (ch) => CHARSET.indexOf(ch);

/** 左 70% 深绿、右 30% 亮黄（两色 ⇒ 主导色必然 > 半数）。 */
function rawJson() {
  const w = COLS * CELL;
  const h = ROWS * CELL;
  const buf = Buffer.alloc(w * h * 4);
  const split = Math.floor(COLS * 0.7) * CELL; // 72 列像素 → 9 格宽
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = x < split; // 主导色区（9×11=99 格）
      const o = (y * w + x) * 4;
      buf[o] = a ? 0x2e : 0xfd;
      buf[o + 1] = a ? 0x7d : 0xd8;
      buf[o + 2] = a ? 0x32 : 0x35;
      buf[o + 3] = 255;
    }
  }
  return JSON.stringify({ w, h, data: buf.toString('base64') });
}

function runGen(mis, extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'beads-gen-max-'));
  const rawPath = join(dir, 'raw.json');
  writeFileSync(rawPath, rawJson());
  const args = [
    GEN, '--in-raw', rawPath, '--no-png', '--out', dir,
    '--cols', String(COLS), '--rows', String(ROWS),
    '--palette', '10', '--colors', '2', '--minadj', '0', '--noframe',
    ...extraArgs,
  ];
  if (mis) args.push('--mis', mis);
  const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8' });
  let pattern = null;
  try {
    pattern = JSON.parse(readFileSync(join(dir, 'pattern.json'), 'utf8'));
  } catch { /* 未落盘（白名单拒绝等）*/ }
  return { code: r.status, stderr: r.stderr || '', stdout: r.stdout || '', pattern, dir };
}

/** 从草案两盘直接核对极值式 / 守恒 / 轮廓（不信任 report 的自我声明）。 */
function auditDraft(d) {
  const pat = d.pattern;
  const mis = d.misplaced;
  assert.equal(mis.length, pat.length, '错位盘行数与正解盘不符');
  const cntP = new Map();
  const cntM = new Map();
  let N = 0;
  let fixed = 0;
  for (let r = 0; r < pat.length; r++) {
    assert.equal(mis[r].length, pat[r].length, `第 ${r} 行宽度不符`);
    for (let c = 0; c < pat[r].length; c++) {
      const p = colorOfChar(pat[r][c]);
      const q = colorOfChar(mis[r][c]);
      if (p <= 0) { assert.ok(q <= 0, '正解盘空位/锁珠位在错位盘被填上珠'); continue; }
      assert.ok(q >= 1, `错位盘该位不是色号字符 "${mis[r][c]}" @${r},${c}`);
      N++;
      cntP.set(p, (cntP.get(p) ?? 0) + 1);
      cntM.set(q, (cntM.get(q) ?? 0) + 1);
      if (p === q) fixed++;
    }
  }
  assert.deepEqual(
    [...cntM.entries()].sort((x, y) => x[0] - y[0]),
    [...cntP.entries()].sort((x, y) => x[0] - y[0]),
    '守恒被破坏：misplaced 的每色珠数 ≠ pattern 的每色珠数（= 改了色）'
  );
  const m = Math.max(...cntP.values());
  return { N, m, fixed };
}

test('红：--mis full（旧 all-or-nothing）在同一张低色数图上拒产 exit 1', () => {
  const r = runGen('full');
  assert.equal(r.code, 1, `预期被拒产，实得 exit=${r.code}\n${r.stderr}`);
  assert.match(r.stderr, /自检失败：错位打乱未成功/);
  assert.match(r.stderr, /无法全错位/);
  assert.match(r.stderr, /--mis max/, '失败提示应指向 max 档（否则用户仍以为只能减色）');
  assert.equal(r.pattern.levelDraft, null, 'full 拒产时不得给出可入关草案');
});

test('默认档不变：不给 --mis ⇒ 仍走 full（同图仍 exit 1）', () => {
  const r = runGen(null);
  assert.equal(r.code, 1, `默认档应仍为 full，实得 exit=${r.code}`);
  assert.match(r.stderr, /无法全错位/);
});

test('绿：--mis max 同图出盘，report.mis 的 M/N/F 满足极值式且守恒不破', () => {
  const r = runGen('max');
  assert.equal(r.code, 0, `max 档应出盘，实得 exit=${r.code}\n${r.stderr}`);
  const j = r.pattern;
  assert.ok(j.levelDraft && Array.isArray(j.levelDraft.misplaced), 'max 草案必须携 misplaced（§2.3-6 输出义务）');
  assert.equal(j.levelDraft.swaps.length, 0, 'max 走 misplaced，不产 swaps');

  const mis = j.report.mis;
  assert.equal(mis.mode, 'max');
  assert.ok(mis.N >= 2 && mis.m >= 1, `report.mis 未落 N/m：${JSON.stringify(mis)}`);
  assert.ok(mis.m > Math.floor(mis.N / 2), '本用例前提：主导色过半 ⇒ full 不可行');
  assert.equal(mis.F, Math.max(0, 2 * mis.m - mis.N), 'F ≠ max(0,2m−N)');
  assert.equal(mis.M_max, Math.min(mis.N, 2 * (mis.N - mis.m)), 'M_max ≠ min(N,2(N−m))');
  assert.equal(mis.M, mis.N - mis.F);
  assert.ok(mis.M >= 1, 'max 档 M=0 应被自检拦下（exit 1），不该走到这里');
  assert.match(j.report.derangement, /^MAXIMAL/);

  // max 档不跑 balance（保形；正本 T2 乙）
  assert.equal(j.report.balancedChanged, 0, 'max 档不得改判 pattern 侧色号');
  assert.match(String(j.report.balanceNote), /跳过配色平衡/);

  // 独立核对：从两盘重算，不信 report 自报
  const a = auditDraft(j.levelDraft);
  assert.equal(a.N, mis.N);
  assert.equal(a.m, mis.m);
  assert.equal(a.fixed, mis.F, '实际固定点数 ≠ 理论 F（多一个 = 没到极值，少一个 = 公式错）');
});

test('--mis 白名单：未知值仍 exit 3 且文案含 max', () => {
  const r = runGen('bogus');
  assert.equal(r.code, 3);
  assert.match(r.stderr, /只支持 full \/ max \/ swaps \/ none/);
});
