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
 * **分布口径（v2.7 补 R-25 工具缺口）**：逐 `(关, 档)` 另出 `ΔW` / `ΔM` 的
 * `min / p5 / p50 / p95 / max`、`ΔM ≤ 0` 占比、分支计数（交换 / 直放 / skipped）与
 * `rngCalls` ⇒ 供 §2.2.6 表 2 / 表 3 / 表 4 / 表 5 的**分布类读数**复算。
 * **分位数约定 = 最近秩（nearest-rank）**：`p_k = sorted[ceil(k·n/100) − 1]`（⛔ 不插值）。
 * 对账事实（2026-10-28 实测）：冒烟 2 关 × 12 槽 × 200 次的 `p5/p50/p95` 与 `min–max` **逐位命中**
 * §2.2.6 表 2 旧手抄读数（L00001 ΔW 12/20/24、ΔM 0/10/12、min–max 0–12）⇒ 旧表用的就是同一口径，
 * **可逐位对账**（先前注记「不同源、只作趋势对照」是未实测的先验推测，已按实测更正）。
 *
 * **卡方臂（§8-28(d)）**：`--chi2` 换总体口径 —— 不再轮转全部采样态，而是**固定一个盘面态**
 * （取该关首个「托盘占用 = `--chi2Occupancy`（默认 12）」的态）重复抽样 `--chi2Trials`（默认 6000）
 * 次，使「每箱期望相等」成立；箱数 = `min(20, 候选集大小)`，候选集 = 行主序空格 ∖ 全部目标格
 * （= `planTray` 的 `landings` 池，逐次相同）。临界值 = **Wilson–Hilferty 近似**（⛔ 不手编表值）。
 *
 * 输出：逐 `(关, 档)` 一行 `ROW …` + 末行 `ACCOUNT_JSON:{…}`（测试断言用）；`--chi2` 另出 `CHI2_JSON:{…}`。
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
/** `--chi2` = §8-28(d) 分布臂：固定盘面 + 6000 次重复抽样（⛔ 与全量臂共用同一套采样/还原机械）。 */
const CHI2 = argv.includes('--chi2');
const CHI2_TRIALS = Number(arg('chi2Trials', '6000'));
const CHI2_T = Number(arg('chi2Occupancy', '12'));
const CHI2_LEVELS = String(arg('chi2Levels', CHI2 ? '7,10' : ''))
  .split(',').filter((s) => s !== '').map(Number);

/** 最近秩分位数（⛔ 不插值）：`p_k = sorted[ceil(k·n/100) − 1]`。 */
const pctile = (sorted, k) => sorted[Math.max(0, Math.ceil((k / 100) * sorted.length) - 1)];
const dist = (arr) => {
  const s = arr.slice().sort((a, b) => a - b);
  return { n: s.length, min: s[0], p5: pctile(s, 5), p50: pctile(s, 50), p95: pctile(s, 95), max: s[s.length - 1] };
};
/** Wilson–Hilferty 近似上分位：`χ²(q, df) ≈ df·(1 − 2/(9df) + z_q·√(2/(9df)))³`（`z_0.99 = 2.326347874`）。 */
const chi2Crit = (df, z = 2.326347874) => {
  const t = 1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df));
  return +(df * t * t * t).toFixed(2);
};

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
const chi2Rows = [];
const total = counters();
let grandUsed = 0;
let grandTrials = 0;

for (let i = 0; i < LEVEL_COUNT && i < LEVELS.length; i++) {
  const raw = LEVELS[i];
  if (CHI2 && !CHI2_LEVELS.includes(Number(raw.id))) continue;
  for (const cap of (CHI2 ? [CHI2_T] : CAPS)) {
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
        if (r && tray.holdingCount > 0 && grid.misplacedCount > 0) snaps.push({ t: tray.holdingCount, d: digest(game) });
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
    // ── R-25 扩口径：分布样本 + 分支计数 + `rngCalls`（包装注入的 rng 计数，⛔ 不另发明一套抽样）。
    const dWs = [], dMs = [];
    let swaps = 0, directFills = 0, skipped = 0, rngTotal = 0, extraDrawUses = 0;
    const rngStat = { n: 0 };
    const realAttach = sys.attach.bind(sys);
    sys.attach = (rng) => realAttach(new Proxy(rng, {
      get: (t, p, r) => {
        const v = Reflect.get(t, p, r);
        if (typeof v !== 'function') return v;
        return (...a) => { rngStat.n += 1; return v.apply(t, a); };
      },
    }));
    // 点名计划入口包装：拿「本次输入（托盘清单 / 空格清单）+ 输出（逐颗指令）」⇒ 分支与落点可数。
    const realPlan = sys.planTray.bind(sys);
    let lastPlan = null;
    sys.planTray = (trayIn, emptiesIn) => {
      const r = realPlan(trayIn, emptiesIn);
      lastPlan = { trayLen: trayIn.length, empties: emptiesIn.map((c) => c.row * 1024 + c.col), moves: r.trayPlan };
      return r;
    };
    // 卡方臂（§8-28(d)）：固定一个态重复抽样，使「每箱期望相等」成立。
    let fixedIdx = -1;
    if (CHI2) {
      fixedIdx = snaps.findIndex((s) => s.t === CHI2_T);
      if (fixedIdx < 0) {
        // 该关无可达的「占用 = `CHI2_T`」态 ⇒ 取占用最大的真实态并**如实报出占用数**
        // （⛔ 不得为凑口径伪造盘态；旧表「L00007 占用 12」需据此复核）。
        for (let k = 0; k < snaps.length; k++) if (fixedIdx < 0 || snaps[k].t > snaps[fixedIdx].t) fixedIdx = k;
      }
    }
    const landingHist = new Map();
    let landingPoolSize = null, landingDraws = 0, poolDrift = 0;
    const TRIALS_R = CHI2 ? CHI2_TRIALS : TRIALS;
    for (let u = 0; u < TRIALS_R && (CHI2 ? fixedIdx >= 0 : snaps.length > 0); u++) {
      restore(game, (CHI2 ? snaps[fixedIdx] : snaps[u % snaps.length]).d);
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
      rngStat.n = 0;
      lastPlan = null;
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
      dWs.push(dW); dMs.push(dM);
      const rngCalls = rngStat.n;
      rngTotal += rngCalls;
      const moves = lastPlan ? lastPlan.moves : [];
      const sw = moves.filter((m) => m.evictRow >= 0).length;
      swaps += sw;
      directFills += moves.length - sw;
      skipped += Math.max(0, t - (lastPlan ? lastPlan.trayLen : 0));
      // §8-28(b) 口径实测：随机消费是否严格 = 换出次数（「+1」即存在「目标格抽取」那一次）。
      if (rngCalls !== sw) extraDrawUses += 1;
      if (CHI2) {
        // 首颗换出落点 = 本次第一次（也是唯一一次可比）的随机抽取 ⇒ 逐次独立同分布。
        const first = moves.find((m) => m.evictRow >= 0);
        if (first) {
          const targetKeys = new Set(moves.map((m) => m.targetRow * 1024 + m.targetCol));
          const pool = lastPlan.empties.filter((k) => !targetKeys.has(k));
          if (landingPoolSize === null) landingPoolSize = pool.length;
          else if (pool.length !== landingPoolSize) poolDrift += 1;
          const rank = pool.indexOf(first.evictRow * 1024 + first.evictCol);
          if (rank >= 0 && pool.length === landingPoolSize) {
            const bins = Math.min(20, landingPoolSize);
            const bin = Math.floor((rank * bins) / pool.length);
            landingHist.set(bin, (landingHist.get(bin) ?? 0) + 1);
            landingDraws += 1;
          }
        }
      }

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
    grandTrials += TRIALS_R;
    const dmLe0 = dMs.filter((v) => v <= 0).length;
    const row = {
      level: raw.id, cap, states: snaps.length, used,
      dwMean: used ? +(dWsum / used).toFixed(2) : null,
      dmMean: used ? +(dMsum / used).toFixed(2) : null,
      tMean: used ? +(tsum / used).toFixed(2) : null,
      // 分支恒等式的精确右端（⛔ 不拿四舍五入的 `tMean` 乘回去比）：`交换 + 直放 + skipped ≡ Σt`。
      tSum: tsum,
      violations: C,
      // ── R-25 新增：分布类读数（表 2 / 表 4）+ 分支与随机消费（表 3）+ 落对率（表 5）。
      dwDist: used ? dist(dWs) : null,
      dmDist: used ? dist(dMs) : null,
      dmLe0Pct: used ? +((100 * dmLe0) / used).toFixed(1) : null,
      dmLt0Pct: used ? +((100 * dMs.filter((v) => v < 0).length) / used).toFixed(1) : null,
      branch: { swaps, directFills, skipped, rngCalls: rngTotal, moves: swaps + directFills },
      // 表 3 均值口径（每次使用）：交换 / 直放 / skipped / rngCalls。
      branchMean: used ? {
        swaps: +(swaps / used).toFixed(2), directFills: +(directFills / used).toFixed(2),
        skipped: +(skipped / used).toFixed(2), rngCalls: +(rngTotal / used).toFixed(2),
      } : null,
      // 表 5 「换出珠落对率」= `ΔM ÷ 交换次数`（I-1：`ΔM ≡ 换出珠落对次数 ≤ 交换`）。
      evictHomePct: swaps ? +((100 * dMsum) / swaps).toFixed(1) : null,
      // §8-28(b) 实测关系：`rngCalls ≡ 交换次数` 的使用次数（反乙 = 存在额外一次抽取）。
      rngEqSwapsUses: used - extraDrawUses,
    };
    rows.push(row);
    console.log(
      `ROW level=${String(raw.id).padStart(5, '0')} cap=${String(cap).padStart(2)} states=${String(snaps.length).padStart(4)}` +
      ` used=${used} ΔW=${(dWsum / Math.max(1, used)).toFixed(2)} ΔM=${(dMsum / Math.max(1, used)).toFixed(2)} t=${(tsum / Math.max(1, used)).toFixed(2)}` +
      ` ΔW[p5/50/95]=${row.dwDist ? `${row.dwDist.p5}/${row.dwDist.p50}/${row.dwDist.p95}` : '-'} ΔM[p5/50/95]=${row.dmDist ? `${row.dmDist.p5}/${row.dmDist.p50}/${row.dmDist.p95}` : '-'}` +
      ` ΔM≤0=${row.dmLe0Pct}% 交换=${swaps} 直放=${directFills} rng=${rngTotal} 落对率=${row.evictHomePct ?? '-'}%`,
    );
    if (CHI2) {
      const bins = Math.min(20, landingPoolSize ?? 0);
      const expect = landingDraws / Math.max(1, bins);
      let chi2 = 0;
      for (let b = 0; b < bins; b++) {
        const o = landingHist.get(b) ?? 0;
        chi2 += ((o - expect) * (o - expect)) / expect;
      }
      const df = Math.max(1, bins - 1);
      const crit = chi2Crit(df);
      chi2Rows.push({
        level: raw.id, cap, occupancyTarget: CHI2_T, occupancyActual: fixedIdx >= 0 ? snaps[fixedIdx].t : null,
        snapIndex: fixedIdx, poolSize: landingPoolSize, bins, df,
        draws: landingDraws, expectPerBin: +expect.toFixed(1), chi2: +chi2.toFixed(2), crit,
        pass: bins > 0 && landingDraws > 0 && chi2 <= crit, poolDrift,
        // 抽取点 A（「第一颗的目标格抽取」）是否存在 = 逐次 `rngCalls` 是否多于换出次数。
        drawPointA: { exists: extraDrawUses > 0, usesWithExtraDraw: extraDrawUses, note: '现行实现：目标格 = 按色消费式行主序分配（无随机）⇒ 预期 exists=false' },
      });
      console.log(`CHI2 level=${String(raw.id).padStart(5, '0')} t=${fixedIdx >= 0 ? snaps[fixedIdx].t : '-'} pool=${landingPoolSize} bins=${bins} draws=${landingDraws} χ²=${chi2.toFixed(2)} 临界(0.99,df${df})=${crit} ⇒ ${chi2Rows[chi2Rows.length - 1].pass ? 'PASS' : 'FAIL'} poolDrift=${poolDrift} 额外抽取次=${extraDrawUses}`);
    }
  }
}

const dwByCap = {};
for (const cap of (CHI2 ? [CHI2_T] : CAPS)) {
  const hit = rows.filter((r) => r.cap === cap && r.dwMean != null);
  dwByCap[cap] = hit.length ? +(hit.reduce((a, r) => a + r.dwMean, 0) / hit.length).toFixed(2) : null;
}
console.log(`TOTALS used=${grandUsed} trials=${grandTrials} ΔW均值/档=${JSON.stringify(dwByCap)}`);
console.log(`ACCOUNT_JSON:${JSON.stringify({ levelCount: LEVEL_COUNT, caps: CAPS, trials: TRIALS, seedBase: SEED_BASE, used: grandUsed, rows, totals: total, dwMeanByCap: dwByCap, chi2: CHI2 ? chi2Rows : null })}`);
