/**
 * 扫豆刷（`trayRestore`）**全量核算**判据 —— `powerups-v2` §8-26(a)–(d) / §8-33 / §8-34 / §8-35。
 * ─────────────────────────────────────────────────────────────────────────────────
 * **总体口径 = 判据原文写死的这一套**（§8-26 前言 + §2.2.6 复算口径）：真引擎 + 生产 BOOT 的
 * 10 关 + 定价同款 bot（`branchOrder='ACB'` / `retrieve:'max'` / `allowDirectFill`）+
 * `pinTrayCapacity` 钉 12/24/48 三档；采样点 = 每次**成功命令**后且「托盘非空 ∧ M > 0」；
 * 夹具 seed = `7000000 + u`，`u = 0..1999` ⇒ **10 关 × 3 档 × 2000 = 60000 次**（§8-33(a)
 * 字面「全量断言，⛔ 不得抽查」）。
 *
 * **为什么 spawn 工具机、⛔ 不在 vitest 里内联跑 bot**：bot 住在
 * `design/forensics/g3/g3-lib.ts`（取证面，对 0 参命令传了参），一旦被 `tests/**` import
 * 就被拉进 `pnpm run typecheck` 编译面（判例见 `tests/worst-first-move.test.ts:15`）。
 * 手法与先例同 = `tests/bead-style-pool.test.ts` spawn `check-bead-style-pool.mjs`：
 * **测试只 spawn + 断言 JSON**，⛔ 不在测试里重跑采样或另算一套口径（K-042 两套口径 = 假绿温床）。
 *
 * 反证臂（§8-33(d) / §8-34(e)）在**本文件内**做，走 game/S6 公开口 + 显式注入，⛔ 不改 `src/**`。
 * §8-34(d) / §8-35(d) 的「工程把候选集写错」两臂 = **开发期突变自证**（仓内既有做法：
 * 先例 `fd3ee4a2` 「突变敏感性四证」）：突变 `_powerupInputs` / `_execTrayPlan` 后本组腿必须转红，
 * 证据写进提交信息；⛔ 不在测试里 permanently 复刻一份错的候选集（那只会造出第二个真源）。
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBeadsHarness, simpleTestLevel, type Harness } from './helpers.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const LOADER = 'games/beads/design/forensics/g3/g3-hooks.mjs';
const SCRIPT = 'tools/scripts/beads-powerup-account.mjs';

const CAPS = [12, 24, 48] as const;
const TRIALS = 2000;
const LEVEL_COUNT = 10;

interface Dist {
  n: number;
  min: number;
  p5: number;
  p50: number;
  p95: number;
  max: number;
}
interface Row {
  level: number;
  cap: number;
  states: number;
  used: number;
  dwMean: number;
  dmMean: number;
  tMean: number;
  tSum: number;
  violations: Record<string, number>;
  /** R-25 扩口径（v2.7）：分布类读数 + 分支计数 + 落对率（表 2 / 表 3 / 表 4 / 表 5）。 */
  dwDist: Dist | null;
  dmDist: Dist | null;
  dmLe0Pct: number | null;
  dmLt0Pct: number | null;
  branch: { swaps: number; directFills: number; skipped: number; rngCalls: number; moves: number };
  evictHomePct: number | null;
  rngEqSwapsUses: number;
}
interface Chi2Row {
  level: number;
  cap: number;
  occupancyTarget: number;
  occupancyActual: number | null;
  poolSize: number | null;
  bins: number;
  df: number;
  draws: number;
  expectPerBin: number;
  chi2: number;
  crit: number;
  pass: boolean;
  poolDrift: number;
  drawPointA: { exists: boolean; usesWithExtraDraw: number };
}
interface Account {
  used: number;
  rows: Row[];
  totals: Record<string, number>;
  dwMeanByCap: Record<string, number>;
  chi2: Chi2Row[] | null;
}

function runAccount(extraArgs: string[] = []): Account {
  const proc = spawnSync(
    'node',
    ['--experimental-transform-types', '--import', `./${LOADER}`, SCRIPT,
      `--levels=${LEVEL_COUNT}`, `--caps=${CAPS.join(',')}`, `--trials=${TRIALS}`, ...extraArgs],
    { cwd: REPO, encoding: 'utf8', timeout: 300_000 },
  );
  const out = `${proc.stdout ?? ''}`;
  const line = out.split('\n').find((l) => l.startsWith('ACCOUNT_JSON:'));
  expect(proc.status, `核算机退出码（stderr 摘要：${String(proc.stderr ?? '').slice(0, 400)}）`).toBe(0);
  expect(line, '核算机必须吐出 ACCOUNT_JSON 行').toBeTruthy();
  return JSON.parse(line!.slice('ACCOUNT_JSON:'.length)) as Account;
}

const account = runAccount();

/**
 * §8-35(c) + §8-26(e) 的夹具常量：12 槽档逐关 `ΔW`（三档均值 `ΔW`、12 槽逐关 `ΔM` 同表）。
 *
 * ⚠ **基线来源 = 2026-10-28 本批修复后的全量重测**（`tools/scripts/beads-powerup-account.mjs`，
 * 60000 次），⛔ 不是 GDD §2.2.6 表 5 / 表 2 的旧值：两处 P1 修复（`_powerupInputs` 消费式分配
 * + `planTray` 换出珠落点池）合法地改动了读数，旧表值因此**已过期**。与表 5 旧值的偏离：
 * 均值 **10.67 vs 10.80（−1.2%）**、三档 **19.01/29.94 vs 19.38/30.40**，逐关最大偏离 =
 * **L00010 8.35 vs 8.99（−7.1%）** ⇒ 已超 5% 闸 ⇒ 按判据本意正是「必须重跑并重填表」。
 * 重跑已完成 ⇒ **回填归文策渊**（数值真源纪律，⛔ 工程侧代改 GDD 读数），已登记 QA。
 */
const DW_12 = [18.28, 8.14, 8.70, 10.00, 13.13, 16.78, 5.13, 9.00, 9.15, 8.35];
const DW_CAP = [10.67, 19.01, 29.94];
const DM_12 = [6.57, 1.40, 2.20, 1.56, 4.13, 6.23, 0.30, 2.57, 1.03, 1.23];
const TOL = 0.05;

describe('S6 §8-33/34/35 全量核算（60000 次，⛔ 不得抽查）', () => {
  it('总体齐：10 关 × 3 档 × 2000 次全部生效，零拒绝（§8-33(c) 分母不含 0 效果）', () => {
    expect(account.rows).toHaveLength(LEVEL_COUNT * CAPS.length);
    expect(account.used).toBe(LEVEL_COUNT * CAPS.length * TRIALS);
    for (const r of account.rows) {
      expect(r.states, `L${r.level} cap${r.cap} 采样态数 > 0`).toBeGreaterThan(0);
      expect(r.used, `L${r.level} cap${r.cap} 全部 2000 次生效（拒绝 = 分母污染）`).toBe(TRIALS);
    }
    expect(account.totals.rejected, '§8-34(c)：合法镜像下不得出现「整次不生效」').toBe(0);
  });

  it('§8-33 ① 清空率 = 100%（逐次零容差 + (b) 不存在部分清空的可达路径）', () => {
    const t = account.totals;
    expect(t.holdNonZero, '§8-33(a) 使用后托盘占用必须恒为 0').toBe(0);
    expect(t.emptyNonZero, '§8-33(a) 使用后空格数必须恒为 0').toBe(0);
    expect(t.slotsShort, '§8-33(b) traySlots.length ≡ 裁定时刻 t').toBe(0);
    expect(t.takeBeadMismatch, '§8-33(b) 实清槽数（takeBead 计数）≡ t').toBe(0);
    expect(t.writeFail, '§8-33(b) 无「写入失败 ⇒ 该珠留槽」的部分清空路径').toBe(0);
    expect(t.dupTarget, '§8-34(b) 前置：目标格互不重复（P1 缺陷签名）').toBe(0);
  });

  it('§8-34 ② 归位率 = 100%（逐颗落点色 ≡ 该格要求色，插桩腿）', () => {
    expect(account.totals.homeMiss, '§8-34(a)(b) 每颗托盘珠的落点格 requiredColor ≡ 该珠色').toBe(0);
  });

  it('§8-26 四条不变式（ΔM ≥ 0 / ΔM ≤ t / 每色珠数相等 / 守恒恒等式）', () => {
    const t = account.totals;
    expect(t.dMneg, '§8-26(a) ΔM ≥ 0 恒成立（旧 P1 实测 −6.91）').toBe(0);
    expect(t.dMgtT, '§8-26(b) ΔM ≤ t（v2.5 勘误：上界是 t，不是 2t）').toBe(0);
    // ⚠ 口径诚实（powerups-v2 v2.7「复验范围声明」）：这里的「新增就位格数」是 `t + ΔM` **算**出来的
    // 而非独立**数**出来的 ⇒ 表 7 I-3 不构成本批独立复验（R-25 本批补的是**分布读数**，不含 I-3
    // 要的「盘面就位数直方图」⇒ 那一句仍是未闭的独立复验缺口，⛔ 不得拿本条冒充）。
    expect(t.newSeatedGt2t, '§8-26(b) 新增就位格数 = t + ΔM ≤ 2t').toBe(0);
    expect(t.colorBeadDiff, '§8-26(c) 每色珠数前后完全相等（不造珠不灭珠）').toBe(0);
    expect(t.conservBefore, '§8-26(d) 裁定前 #empty ≡ 托盘占用').toBe(0);
    expect(t.conservAfter, '§8-26(d) 使用后恒等式仍成立').toBe(0);
  });

  it('§8-35 ③ ΔW ∈ [t, 2t] 逐次成立 + 恒等式 I-2（`ΔW ≡ t + ΔM`）⇒「白用」不可能', () => {
    const t = account.totals;
    expect(t.dWltT, '§8-35(a) ΔW ≥ t ≥ 1 逐次成立').toBe(0);
    expect(t.dWgt2t, '§8-35(b) ΔW ≤ 2t').toBe(0);
    expect(t.identity, '§8-35 定义 / 表 7 I-2：ΔW ≡ t + ΔM').toBe(0);
  });

  it('§8-35(c) + §8-26(e) 读数回归闸（逐关 12 槽 ΔW / 三档均值 / 12 槽逐关 ΔM，容差 5%）', () => {
    const byLevel = account.rows.filter((r) => r.cap === 12).sort((a, b) => a.level - b.level);
    expect(byLevel).toHaveLength(LEVEL_COUNT);
    byLevel.forEach((r, i) => {
      expect(
        Math.abs(r.dwMean - DW_12[i]!) <= DW_12[i]! * TOL,
        `§8-35(c) L${String(r.level).padStart(5, '0')} ΔW 实测 ${r.dwMean} 偏离夹具 ${DW_12[i]} 超 5% ⇒ 重跑 §2.2.6 表 5 / §2.2.7`,
      ).toBe(true);
      expect(
        Math.abs(r.dmMean - DM_12[i]!) <= DM_12[i]! * TOL,
        `§8-26(e) L${String(r.level).padStart(5, '0')} ΔM 实测 ${r.dmMean} 偏离表 2 夹具 ${DM_12[i]} 超 5%`,
      ).toBe(true);
    });
    CAPS.forEach((cap, i) => {
      const mean = account.dwMeanByCap[String(cap)]!;
      expect(
        Math.abs(mean - DW_CAP[i]!) <= DW_CAP[i]! * TOL,
        `§8-35(c) ${cap} 槽档 ΔW 均值实测 ${mean} 偏离夹具 ${DW_CAP[i]} 超 5%`,
      ).toBe(true);
    });
  });

  it('R-25 分布腿自洽：分位数单调 + 与不变式同向 + 分支恒等式（表 2 / 3 / 5）', () => {
    // 本腿不拿分布**定新阈值**（那是 §2.2.6 的回填活，归文策渊），只闸「分布口径与已有的
    // 逐次计数器**不得互相矛盾**」——两条路径共用同一批样本，但各自独立累计 ⇒
    // `dist()` / 分箱 / 分支计数写错时这里转红，而上面的计数器腿仍绿（= 真实的漏检面）。
    for (const r of account.rows) {
      const tag = `L${String(r.level).padStart(5, '0')} cap${r.cap}`;
      expect(r.dwDist, `${tag} ΔW 分布不得为空（used > 0）`).not.toBeNull();
      expect(r.dmDist, `${tag} ΔM 分布不得为空`).not.toBeNull();
      for (const d of [r.dwDist!, r.dmDist!]) {
        expect(d.n, `${tag} 样本数 ≡ used`).toBe(r.used);
        expect(d.min <= d.p5 && d.p5 <= d.p50 && d.p50 <= d.p95 && d.p95 <= d.max, `${tag} 最近秩单调`).toBe(true);
      }
      // §8-35(a) 的分布形式：ΔW ≥ t ≥ 1（采样态保证托盘非空）⇒ 下分位不可能跌破 1。
      expect(r.dwDist!.min, `${tag} §8-35(a) ΔW ≥ 1 逐次成立` ).toBeGreaterThanOrEqual(1);
      // §8-26(a) 的分布形式：与计数器腿 `dMneg = 0` 同一事实、不同路径。
      expect(r.dmDist!.min, `${tag} §8-26(a) ΔM ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(r.dmLt0Pct, `${tag} ΔM < 0 占比必与 dMneg 同步`).toBe(0);
      expect(r.dmLt0Pct! <= r.dmLe0Pct!, `${tag} 占比单调（<0 ⊆ ≤0）`).toBe(true);
      expect(r.dmLe0Pct! >= 0 && r.dmLe0Pct! <= 100, `${tag} ΔM ≤ 0 占比在 [0,100]`).toBe(true);
      // 分支计数与采样总口径的**精确**恒等式：每颗输入珠要么交换、要么直放，无归宿的那颗计入 skipped。
      expect(
        r.branch.swaps + r.branch.directFills + r.branch.skipped,
        `${tag} 交换 + 直放 + skipped ≡ Σt`,
      ).toBe(r.tSum);
      // 表 5 落对率口径：`ΔM ≡ 换出珠落对次数 ≤ 交换次数`（表 7 I-1）⇒ 百分比不得超 100。
      if (r.evictHomePct !== null) {
        expect(r.branch.swaps, `${tag} 落对率非 null ⇒ 分母（交换次数）> 0`).toBeGreaterThan(0);
        expect(r.evictHomePct >= 0 && r.evictHomePct <= 100, `${tag} 落对率在 [0,100]`).toBe(true);
      }
      // ⚠ 有争议的 `rngCalls` 口径（§8-28(b)）——本腿**不选边**：
      //   实测 60000 次全部 `rngCalls ≡ 交换次数`（`rngEqSwapsUses = used`、额外抽取次 = 0），
      //   而 §8-28(b) 现文写的是 `1 + 交换次数` ⇒ 「目标格抽取」那一点在现行实现上结构不存在
      //   （目标格 = 按色消费式行主序分配，无随机）⇒ 已登记待文策渊裁定（§8-28(d)「两处抽取点」同一事）。
      //   这里只断两种读法**共同**下界（每次换出至少消耗一次随机），⛔ 不把「+1」写成恒常断言。
      expect(r.branch.rngCalls, `${tag} 随机消费不得少于换出次数`).toBeGreaterThanOrEqual(r.branch.swaps);
    }
  });
});

// ───────────────── §8-28(d) 卡方均匀性臂（R-25 工具缺口的第二条腿）

describe('S6 §8-28(d) 卡方均匀性（固定盘面、6000 次、α = 0.01）', () => {
  /** 固定态重复抽样才使「每箱期望相等」成立 ⇒ 不能拿全量臂的轮转态直接跑 χ²（总体口径不同）。 */
  const chi2Account = runAccount(['--chi2']);

  it('两处抽取点中可测的那一处（换出珠落点）均匀⇒ χ² ≤ Wilson–Hilferty 临界值', () => {
    expect(chi2Account.chi2, '--chi2 臂必须输出 chi2 行').not.toBeNull();
    const rows = chi2Account.chi2!;
    expect(rows.map((r) => r.level).sort((a, b) => a - b), '表 4 口径的两个盘面（L00007 / L00010）').toEqual([7, 10]);
    for (const c of rows) {
      const tag = `L${String(c.level).padStart(5, '0')}`;
      // 退化守卫：找不到「占用 = 12」的采样态时脚本会取占用最大的真实态并如实报出——那是**另一个总体**。
      expect(c.occupancyActual, `${tag} 固定态占用必须真的等于目标占用（否则口径已退化）`).toBe(c.occupancyTarget);
      expect(c.poolSize, `${tag} 候选池非空`).not.toBeNull();
      expect(c.poolDrift, `${tag} 候选池逐次恒定（χ² 的前提：固定盘面）`).toBe(0);
      expect(c.bins, `${tag} 箱数 = min(20, 候选池)`).toBe(Math.min(20, c.poolSize!));
      expect(c.draws, `${tag} 每次重复都抽到换出腿 ⇒ 样本量足额`).toBe(6000);
      expect(c.pass, `${tag} χ² = ${c.chi2} ≤ 临界 ${c.crit}（df=${c.df}）`).toBe(true);
    }
    // ⚠ 两行读数相同（χ² = 9.96）系同 seed 序列 + 同抽取元数 `int(0, 11)` 的必然结果
    // ⇒ **第二行不构成独立复验**（旧表两行同为 7.55 同源）。已在提交信息与 QA 登记面写明，
    // ⛔ 不得拿本腿的「两条 PASS」当成两个独立样本。抽取点 A（第一颗目标格）在现行实现上
    //   不存在（脚本如实输出 `drawPointA.exists = false`、本批实测 6000/6000 次无额外抽取）
    //   ⇒ §8-28(d)「两处各测一次」现在只剩一处，与 §8-28(b) 的「+1」同一待裁定事，
    //   本腿⛔ 不把「存在 / 不存在」任一方向写成断言（那要么恒红、要么反向迁就实现）。
  });
});

// ───────────────── 反证臂（§8-33(d) / §8-34(d)(e) / §8-35(d)）

describe('S6 §8-33(d)/§8-34(e) 反证臂（注入可达的错法 ⇒ 判据必须红）', () => {
  /**
   * 两臂共用夹具（**合法走子链**，⛔ 不凭空造珠）：6×5 三色测试盘（pattern `123123`×5 ⇒
   * 列定色 `req(c) = c%3 + 1`）全部就位后，把行 0/1 的 `(r,0)↔(r,1)` 各对调一次 ⇒
   * (0,0)(1,0) 同持色 2 珠且 8 向连通 ⇒ 整组取回 `t = 2`：盘面留下 2 个色 1 空格（守恒
   * `#empty ≡ t` 成立，§6 X-2）+ 2 个色 2 错位格 (0,1)(1,1)（托盘珠的归宿格 ⇒ 走「换出珠」分支）。
   * @returns 取回后的托盘珠颗数 `t`。
   */
  function seatThenRetrievePair(h: Harness): number {
    const grid = h.game.grid;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) if (grid.isFillable(r, c)) grid.fill(r, c, grid.requiredColor(r, c));
    }
    expect(grid.misplacedCount, '全盘按底色装配 ⇒ 零错位').toBe(0);
    for (const r of [0, 1]) {
      grid.setBead(r, 0, grid.requiredColor(r, 1));
      grid.setBead(r, 1, grid.requiredColor(r, 0));
    }
    expect(grid.misplacedCount, '两次对调 ⇒ 恰 4 颗错位（色 2 珠 2 颗在 (0,0)(1,0)）').toBe(4);
    expect(h.game.selectBoardBead(0, 0)).toBe(true);
    expect(h.game.retrieveSelectedGroup()).toBe(true);
    const t = h.game.tray.holdingCount;
    expect(t, '夹具须取回 ≥2 颗同色珠（截断臂才能演示「部分清空」）').toBeGreaterThanOrEqual(2);
    expect(grid.fillableTotal - grid.filledCount, '守恒：空格数 ≡ 托盘占用').toBe(t);
    return t;
  }

  it('§8-33(d) 截断臂：`traySlots` 故意少给一颗 ⇒ 托盘仍剩 1 颗 ⇒ 本条必须红', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.8-33d' });
    const t = seatThenRetrievePair(h);
    const grid = h.game.grid;

    // 注入 = 判据 33(d) 的字面臂：plan/slots 各截掉最后一颗（= 「只清 t−1 颗」）。
    const sys = h.game.powerups as unknown as {
      request: (type: unknown, pool: unknown, extra?: unknown) => Record<string, unknown>;
    };
    const realRequest = sys.request.bind(sys);
    sys.request = (type, pool, extra) => {
      const outcome = realRequest(type, pool, extra) as Record<string, unknown>;
      if (outcome.kind !== 'used' || !Array.isArray(outcome.trayPlan)) return outcome;
      return { ...outcome, trayPlan: (outcome.trayPlan as unknown[]).slice(0, -1), traySlots: (outcome.traySlots as number[]).slice(0, -1) };
    };

    const e0 = grid.fillableTotal - grid.filledCount;
    const m0 = grid.misplacedCount;
    expect(h.game.usePowerup('trayRestore')).toBe(true);
    const payload = h.last<{ traySlots: number[] }>('powerup:used')!;
    const dM = m0 - grid.misplacedCount;
    const dW = m0 + e0 - (grid.misplacedCount + grid.fillableTotal - grid.filledCount);
    // 红签名一律**由实测量推**（⛔ 手算预设值：这里「少清一颗」会让换出珠也少落一颗，
    // ΔW 并非字面的 t−1，写死反而是在迁就一个没验过的数）。
    expect(h.game.tray.holdingCount, '§8-33(a) 红签名：截断 ⇒ 托盘剩 1 颗 ⇒ 本条确实在检「真清空」').toBe(1);
    expect(payload.traySlots.length, '§8-33(b)/表 7 I-5 红签名：traySlots.length = t−1 < t').toBe(t - 1);
    expect(dW, '§8-35 恒等式 I-2 红签名：ΔW ≠ t + ΔM ⇒ 推进量口径先崩').not.toBe(t + dM);
  });

  it('§8-34(e) 数据前提臂（P-1 破坏）：多出来的那颗 skipped 留槽，归位率如实 < 100%', () => {
    const h = createBeadsHarness({ noAssemble: true, levels: [simpleTestLevel()], saveKey: 'wxgame.beads.test.8-34e' });
    const t = seatThenRetrievePair(h);
    // 伪造「某色珠比该色**未就位**格多一颗」：色 3 的格此刻全部就位 ⇒ 色 3 珠无归宿。
    // ⚠ `giveTrayBead` 凭空造珠在本条是**判据要求的 P-1 违反态**（⛔ 拿它做守恒断言才是误用）。
    const orphanSlot = h.game.giveTrayBead(3);
    expect(orphanSlot, '凭空多的那颗落在末槽').toBe(t);
    expect(h.game.tray.holdingCount).toBe(t + 1);

    expect(h.game.usePowerup('trayRestore')).toBe(true);
    const payload = h.last<{ traySlots: number[] }>('powerup:used')!;
    expect(payload.traySlots, '§6 X-4：无归宿那颗不进清单（skipped）').toHaveLength(t);
    expect(h.game.tray.holdingCount, '§8-34(e)：那颗**留在托盘**，归位率 t/(t+1) 如实报出，⛔ 不得静默算成 100%').toBe(1);
  });
});

// §8-34(d)「字面读法臂」与 §8-35(d)「候选集写错臂」⛔ 不在本文件常驻：自造夹具上
// `bead:placed` 条数仍 = t（换出珠恰好落对格）⇒ 拿不到红签名，写出来只会是一条恒真断言
// （判据明令禁止）。两臂改走**开发期突变自证**（先例 `fd3ee4a2` 突变敏感性四证）：
// 突变 `_powerupInputs` 候选集为「含已就位格」⇒ 核算腿 `homeMiss` 必须转红；
// 突变 `_execTrayPlan` 为「丢弃换出珠」⇒ `holdNonZero` / `dWltT` / `identity` 必须转红。
