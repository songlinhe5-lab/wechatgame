/**
 * 扫豆刷全量核算机（`powerups-v2` 判据 §8-26(a)–(d) / §8-33 / §8-34(a)(b) / §8-35(a)(b)）。
 * ─────────────────────────────────────────────────────────────────────────────
 * **为什么住 `tools/scripts/`（⛔ 不是 vitest 内联）**：判据 §8-26 前言把总体写成
 * 「10 关真实盘面（**BOT 跑出的可达状态序列**，夹具 `7000000 + s`）」⇒ 总体口径必须与
 * §2.2.6 复算同源，而 bot 住在 `games/beads/design/forensics/g3/g3-lib.ts`。该文件是取证面
 * （对 0 参命令传了参），**一旦被 `games/beads/tests/**` import 就会被拉进 `pnpm run typecheck`
 * 编译面**（判例见 `tests/worst-first-move.test.ts:15`）。本脚本走同一 spawn 手法
 * （先例：`tests/bead-style-pool.test.ts` spawn `check-bead-style-pool.mjs`）⇒ 测试只 spawn +
 * 断言 JSON，⛔ 不在测试里重跑采样或手算第二套口径（K-042）。
 *
 * **状态还原 = 私域字段拷贝**（`_cells` / `_slots` / `_needed` + 相位复位）。⛔ 不用公开 API
 * 还原：`grid.retrieve` 会删珠、`tray.storeInto` 会凭空造珠、`tray.reset` 会丢扩容档 ⇒
 * 守恒恒等式在还原层就被打破（实测伪造 10999 条违例，2026-10-28）。
 *
 * 用法：
 *   node --experimental-transform-types \
 *        --import=./games/beads/design/forensics/g3/g3-hooks.mjs \
 *        tools/scripts/beads-powerup-account.mjs [--levels=10] [--caps=12,24,48] [--trials=2000]
 *
 * 输出：逐 `(关, 档)` 一行 `ROW …` + 末行 `ACCOUNT_JSON:{…}`（测试断言用）。
 */
import { createBeadsHarness, simpleTestLevel } from '../../games/beads/tests/helpers.js';
import { runBot } from '../../games/beads/design/forensics/g3/g3-lib.js';
import { pinTrayCapacity } from './lib/tray-capacity.js';
import { LEVELS } from '../../games/beads/src/config/levels.js';
import { LEVEL_TIME_MAX } from '../../games/beads/src/config/tuning.js';
import { createRng } from '@wxgame/framework';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const LEVEL_COUNT = Number(arg('levels', String(LEVELS.length)));
const CAPS = String(arg('caps', '12,24,48')).split(',').map(Number);
const TRIALS = Number(arg('trials', '2000'));
const SEED_BASE = Number(arg('seed', '7000000'));

/** 采样口径（§2.2.6）：每次**成功命令**后、且「托盘非空 ∧ M > 0」抓一态。 */
const CMDS = ['tapGridCell', 'selectBoardBead', 'selectTraySlot', 'retrieveSelectedGroup'];

const rec = (o) => o;

function digest(game) {
  const grid = rec(game.grid);
  const tray = rec(game.tray);
  return {
    cells: rec(grid._cells).map((c) => ({ ...c })),
    filled: grid._filledCount,
    mis: grid._misplacedCount,
    slots: rec(tray._slots).map((s) => ({ ...s })),
    needed: [...rec(tray._needed)],
    boardSel: game._boardSelected ? { ...game._boardSelected } : null,
  };
}

function restore(game, snap) {
  const grid = rec(game.grid);
  const tray = rec(game.tray);
  snap.cells.forEach((c, i) => Object.assign(grid._cells[i], c));
  grid._filledCount = snap.filled;
  grid._misplacedCount = snap.mis;
  snap.slots.forEach((s, i) => Object.assign(tray._slots[i], s));
  snap.needed.forEach((v, i) => { tray._needed[i] = v; });
  game._boardSelected = snap.boardSel ? { ...snap.boardSel } : null;
}

/** 逐色珠数（盘面 + 托盘）——§8-26(c)「不造珠、不灭珠」。 */
function beadsByColor(game) {
  const out = [];
  for (const c of rec(game.grid._cells)) if (c.state !== 'locked' && c.beadColorIdx) out[c.beadColorIdx] = (out[c.beadColorIdx] ?? 0) + 1;
  for (const s of rec(game.tray._slots)) if (s.state !== 'free' && s.colorIdx) out[s.colorIdx] = (out[s.colorIdx] ?? 0) + 1;
  return out;
}

function counters() {
  return {
    rejected: 0, takeBeadMismatch: 0, writeFail: 0, holdNonZero: 0, emptyNonZero: 0,
    slotsShort: 0, dupTarget: 0, homeMiss: 0,
    dMneg: 0, dMgtT: 0, newSeatedGt2t: 0, dWltT: 0, dWgt2t: 0, identity: 0,
    conservBefore: 0, conservAfter: 0, colorBeadDiff: 0,
  };
}

const rows = [];
const total = counters();
let grandUsed = 0;
let grandTrials = 0;

for (let i = 0; i < LEVEL_COUNT && i < LEVELS.length; i++) {
  const raw = LEVELS[i];
  for (const cap of CAPS) {
    const h = createBeadsHarness({ seed: 'pu-account', levels: [simpleTestLevel({ ...raw, time: LEVEL_TIME_MAX })] });
    h.game.goToLevel(0);
    pinTrayCapacity(h.game, cap);
    const game = h.game;
    const grid = rec(game.grid);
    const tray = rec(game.tray);

    const snaps = [];
    const orig = CMDS.map((name) => game[name].bind(game));
    CMDS.forEach((name, k) => {
      game[name] = (...a) => {
        const r = orig[k](...a);
        if (r && tray.holdingCount > 0 && grid.misplacedCount > 0) snaps.push(digest(game));
        return r;
      };
    });
    runBot(h, { allowDirectFill: true, retrieve: 'max', usePowerups: false, maxMoves: 20000, branchOrder: 'ACB' });
    CMDS.forEach((name, k) => { game[name] = orig[k]; });

    const C = counters();
    const sys = rec(game.powerups);
    const realFill = grid.fill.bind(grid);
    const realSet = grid.setBead.bind(grid);
    const realTake = tray.takeBead.bind(tray);
    let writes = [];
    grid.fill = (r, c, bead) => { const ok = realFill(r, c, bead); writes.push({ kind: 'fill', r, c, bead, ok }); return ok; };
    grid.setBead = (r, c, bead) => { const ok = realSet(r, c, bead); writes.push({ kind: 'set', r, c, bead, ok }); return ok; };
    tray.takeBead = (slot) => {
      const color = tray.slot(slot) && tray.slot(slot).state !== 'free' ? tray.slot(slot).colorIdx : 0;
      const ok = realTake(slot);
      if (ok) {
        // 本颗的落点 = 窗口里最后一颗**同色**写入；`setBead` 必是托盘珠进目标格，
        // 单条 `fill` 且无 `setBead` ⇒ 直填目标格（先例：`_execTrayPlan` 两条分支）。
        const mine = writes.filter((w) => w.ok && w.bead === color);
        const target = mine.length ? mine[mine.length - 1] : null;
        if (!target) C.homeMiss += 1;
        else if (grid.requiredColor(target.r, target.c) !== color) C.homeMiss += 1;
        // §8-34(a) 定义的另一半：归位 = 使一个**此前未就位**的 `req == 该珠色` 格变成就位。
        // ⛔ 只查前半的判据会被「候选集含已就位格」的工程错误（E-1 / 字面读法）骗成假绿。
        else if (!unseatedBefore.has(target.r * 1024 + target.c)) C.homeMiss += 1;
        takeBeads += 1;
      }
      writes = [];
      return ok;
    };

    let used = 0, dWsum = 0, dMsum = 0, tsum = 0, takeBeads = 0, unseatedBefore = new Set();
    for (let u = 0; u < TRIALS && snaps.length > 0; u++) {
      restore(game, snaps[u % snaps.length]);
      rec(game._machine).reset('playing');
      h.emitted.length = 0;
      sys.reset();
      sys.setFreeDepleted({ trayRestore: false });
      sys.attach(createRng(SEED_BASE + u));

      const e0 = grid.fillableTotal - grid.filledCount;
      const m0 = grid.misplacedCount;
      const t = tray.holdingCount;
      const colorsBefore = beadsByColor(game);
      // 动手前「未就位」格集合（空格 ∪ 错位格）——§8-34(a) 定义的分母依据。
      // ⚠ `isFillable` 只对 **empty** 格为真（bead-grid §2.1），⛔ 拿它当「可填位」总称会
      // 把全部错位格漏掉 ⇒ 归位率假性跌到 0（实测 691252 违例，2026-10-28）。
      unseatedBefore = new Set();
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) if (grid.isFillable(r, c) || grid.isMisplaced(r, c)) unseatedBefore.add(r * 1024 + c);
      }
      takeBeads = 0;
      writes = [];
      const ok = game.usePowerup('trayRestore');
      if (!ok) { C.rejected += 1; continue; }
      used += 1;
      const m1 = grid.misplacedCount;
      const e1 = grid.fillableTotal - grid.filledCount;
      const dM = m0 - m1;
      const dW = m0 + e0 - (m1 + e1);
      const payload = rec(h.emitted.filter((x) => x.type === 'powerup:used').pop().payload);
      const slotsOut = payload.traySlots;
      const targets = payload.affectedCells;
      dWsum += dW; dMsum += dM; tsum += t;

      // ── §8-33 清空率
      if (tray.holdingCount !== 0) C.holdNonZero += 1;
      if (e1 !== 0) C.emptyNonZero += 1;
      if (slotsOut.length !== t) C.slotsShort += 1;
      if (takeBeads !== t) C.takeBeadMismatch += 1;
      if (writes.some((w) => !w.ok)) C.writeFail += 1;
      // ── §8-34 归位率（homeMiss 在 takeBead 包装里逐颗累计）
      if (new Set(targets.map((c) => c.row * 1024 + c.col)).size !== targets.length) C.dupTarget += 1;
      // ── §8-26 不变式
      if (dM < 0) C.dMneg += 1;
      if (dM > t) C.dMgtT += 1;
      if (t + dM > 2 * t) C.newSeatedGt2t += 1;
      if (e0 !== t) C.conservBefore += 1;
      if (grid.fillableTotal - grid.filledCount !== tray.holdingCount) C.conservAfter += 1;
      const colorsAfter = beadsByColor(game);
      for (let k = 0; k < Math.max(colorsBefore.length, colorsAfter.length); k++) {
        if ((colorsBefore[k] ?? 0) !== (colorsAfter[k] ?? 0)) { C.colorBeadDiff += 1; break; }
      }
      // ── §8-35 ΔW 上下界 + 恒等式 I-2
      if (dW < t) C.dWltT += 1;
      if (dW > 2 * t) C.dWgt2t += 1;
      if (dW !== t + dM) C.identity += 1;
    }

    grid.fill = realFill;
    grid.setBead = realSet;
    tray.takeBead = realTake;

    for (const key of Object.keys(C)) total[key] += C[key];
    grandUsed += used;
    grandTrials += TRIALS;
    rows.push({
      level: raw.id, cap, states: snaps.length, used,
      dwMean: used ? +(dWsum / used).toFixed(2) : null,
      dmMean: used ? +(dMsum / used).toFixed(2) : null,
      tMean: used ? +(tsum / used).toFixed(2) : null,
      violations: C,
    });
    console.log(
      `ROW level=${String(raw.id).padStart(5, '0')} cap=${String(cap).padStart(2)} states=${String(snaps.length).padStart(4)}` +
      ` used=${used} ΔW=${(dWsum / Math.max(1, used)).toFixed(2)} ΔM=${(dMsum / Math.max(1, used)).toFixed(2)} t=${(tsum / Math.max(1, used)).toFixed(2)}`,
    );
  }
}

const dwByCap = {};
for (const cap of CAPS) {
  const hit = rows.filter((r) => r.cap === cap && r.dwMean != null);
  dwByCap[cap] = hit.length ? +(hit.reduce((a, r) => a + r.dwMean, 0) / hit.length).toFixed(2) : null;
}
console.log(`TOTALS used=${grandUsed} trials=${grandTrials} ΔW均值/档=${JSON.stringify(dwByCap)}`);
console.log(`ACCOUNT_JSON:${JSON.stringify({ levelCount: LEVEL_COUNT, caps: CAPS, trials: TRIALS, seedBase: SEED_BASE, used: grandUsed, rows, totals: total, dwMeanByCap: dwByCap })}`);
