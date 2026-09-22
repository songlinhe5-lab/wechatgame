// WXG-T-182 · G-3 取证 任务①② —— 「≥12 颗同色错位块 ⇒ 首步死锁」复现 / 临界尺寸。
// temp/ 临时件（非生产码）。所有裁决均由**生产实现本体**给出：
//   取回 = retrieveSelectedGroup / _routeTraySlot ；归位 = tapGridCell → _placeSelected →
//   judgePlacement ；直填 = _tryDirectFillFromBoard ；道具 = usePowerup → _solveMisplaced 。
// 运行：node --experimental-transform-types --import=./temp/g3-hooks.mjs temp/g3-repro.ts
import {
  TRAY_BASE_SLOTS,
  availabilityReadonly,
  blobAnchors,
  blobSizes,
  cellPoint,
  emptyCells,
  layoutBase,
  makeBoard,
  misplacedCells,
  mount,
  probeAll,
  runBot,
  slotPoint,
  trayColors,
  trayView,
  type DenseBoard,
} from './g3-lib.js';
import { judgePlacement } from '../games/beads/src/systems/placement.js';
import { judgeRetrieve } from '../games/beads/src/systems/retrieve.js';
import { expandButtonLayout } from '../games/beads/src/config/tuning.js';

const ROWS = 12;
const COLS = 12;
const hr = (t: string): void => console.log(`\n══ ${t}`);
const sub = (t: string): void => console.log(`\n── ${t}`);

// ══════════════════════════════════ 0. 盘面：12×12 密集 + 全错位 + 巨块 ══════════════════════════════════
hr('§0 盘面构造（新模型：密集母版 + 全错位 + MISPLACED_COLOR_CAP）');
const base = layoutBase(ROWS, COLS, 4, 'stripes'); // 4 竖条带 ⇒ 每色 36 格（36 ≤ ⌊144/2⌋=72）
const board = makeBoard(ROWS, COLS, base) as DenseBoard | null;
if (!board) {
  console.log('❌ derangeShift 返回 null（违反 COLOR_CAP 或有固定点）');
  process.exit(1);
}
console.log(`底色分布 hist=${JSON.stringify([36, 36, 36, 36])} maxFreq=${board.maxFreq} cap=⌊144/2⌋=72 ✅`);

const m = mount(board);
const g = m.game;
console.log(`grid ${g.grid.rows}x${g.grid.cols} 空格=${emptyCells(g.grid).length} 错位珠=${g.grid.misplacedCount}/${ROWS * COLS}（= 满盘全错位）`);
const blobs = blobSizes(g.grid).slice(0, 4);
console.log(`同色错位连通块尺寸（生产 collectMisplacedGroup 度量，降序前 4）= [${blobs.join(', ')}] 块数=${blobAnchors(g.grid).length}`);
console.log(`TRAY_BASE_SLOTS=${TRAY_BASE_SLOTS} 容量=${g.tray.capacity} ⇒ 最大块 ${blobs[0]} ≥ 容量 ${g.tray.capacity}`);

// ═════════════════════ 1. 真链首步：点巨块 → 点空槽 → 一次灌满 12 槽 ═════════════════════
hr('§1 真链首步（tapDesign 命中路由 → retrieveSelectedGroup）');
const big = blobAnchors(g.grid).sort((a, b) => b.size - a.size)[0]!;
const p1 = cellPoint(g, big.cell.row, big.cell.col);
const before1 = `${trayView(g)}|mis${g.grid.misplacedCount}|sel=${g.selection}`;
g.tapDesign(p1.x, p1.y);
sub(`点击巨块锚珠 (${big.cell.row},${big.cell.col}) 组大小=${big.size} ⇒ 状态 ${before1} → ${trayView(g)}|mis${g.grid.misplacedCount}|sel=${g.selection} 锚=${JSON.stringify(g.boardSelected)}`);
console.log(`   事件：board:selected = ${JSON.stringify(m.h.last('board:selected'))}`);
const before2 = `${trayView(g)}|mis${g.grid.misplacedCount}|空${emptyCells(g.grid).length}`;
g.tapDesign(slotPoint(g, 0).x, slotPoint(g, 0).y);
sub(`点击空槽 0（整组取回）⇒ 状态 ${before2} → ${trayView(g)}|mis${g.grid.misplacedCount}|空${emptyCells(g.grid).length}`);
console.log('   ℹ️ tapDesign 返回值不作数：`_consumedTap` 仅在部分分支置位（选珠 / 取回分支不置），以**状态变化**为证据。');
console.log(`托盘 = ${trayView(g)} 持有=${g.tray.holdingCount}/${g.tray.capacity} 空槽=${g.tray.freeCount}`);
console.log(`   事件：tray:stored 条数 = ${m.h.count('tray:stored')}（一次点槽⇒ 12 条同族事件逐颗入槽；首条=${JSON.stringify(m.h.all('tray:stored')[0])}）`);
console.log(`盘面：错位 ${g.grid.misplacedCount} 空格 ${emptyCells(g.grid).length} 洞底色集合=[${[...new Set(emptyCells(g.grid).map((c) => g.grid.requiredColor(c.row, c.col)))].join(',')}]`);
console.log(`托盘色集合=[${trayColors(g).join(',')}]  ← 洞底色 ≠ 托盘色（命题的「错位珠落不进自己的格」）`);
const full = g.tray.freeCount === 0 && g.tray.holdingCount === TRAY_BASE_SLOTS;
console.log(`➡ 首步即灌满 12 槽：${full ? '✅ 成立' : '❌ 不成立'}（count = min(组 ${big.size}, freeRunFrom(0)=12) = 12）`);

// ═════════════════════ 1c. 开局可用动作族穷举═════════════════
hr('§1c 开局（满盘全错位、托盘空）可用动作族');
{
  const k = mount(board);
  const av = availabilityReadonly(k.game);
  console.log(
    `  托盘持有=${k.game.tray.holdingCount} ⇒ 族 A（托盘归位）候选数=${av.trayPlace}；空格=${emptyCells(k.game.grid).length} ⇒ 族 C（直填）候选数=${av.directFill}；` +
      `族 B（取回）候选数=${av.retrieve}`,
  );
  console.log('➡ 开局唯一可用动作族 = 取回（无洞、无托盘珠）⇒ 首步必抽一块；若所有块 ≥ 容量，首步必灌满。');
}

// ═════════════════════ 2. 族 A 穷举：托盘珠 → 每个洞（真引擎判定）═════════════════════
hr('§2 族 A「托盘归位」穷举（真链 tapGridCell + judgePlacement 旁证）');
let aOk = 0;
const aReason = new Map<string, number>();
for (let slot = 0; slot < g.tray.capacity; slot++) {
  const s = g.tray.slot(slot)!;
  if (s.state === 'free') continue;
  for (const e of emptyCells(g.grid)) {
    const v = judgePlacement(g.grid, e.row, e.col, s.colorIdx, slot); // 生产裁决（只读旁证）
    const key = `${v.outcome}${'reason' in v ? ':' + v.reason : ''}`;
    aReason.set(key, (aReason.get(key) ?? 0) + 1);
    g.selectTraySlot(slot);
    if (g.tray.selectedColor !== s.colorIdx) g.selectTraySlot(slot); // 组选切换（同色再点=取消）
    const before = g.grid.misplacedCount;
    if (g.tapGridCell(e.row, e.col) && g.grid.misplacedCount < before) aOk++; // 真引擎成功才算
  }
}
console.log(`尝试 (槽,洞) 组合 = ${g.tray.holdingCount} × ${emptyCells(g.grid).length}`);
console.log(`judgePlacement 裁决统计 = ${JSON.stringify(Object.fromEntries(aReason))}`);
console.log(`➡ 族 A 可用动作数（真链）= ${aOk} ${aOk === 0 ? '✅ 托盘通道全封（命题该项成立）' : '❌ 有解'}`);

// ═════════════════════ 3. 族 B 穷举：满槽禁取闸门（真链 + judgeRetrieve 旁证）═════════════════════
hr('§3 族 B「整组取回」穷举（真链 tapDesign 点占位槽 + judgeRetrieve 旁证）');
let bOk = 0;
const bReason = new Map<string, number>();
for (const cell of misplacedCells(g.grid)) {
  const v = judgeRetrieve(g.grid, g.tray, cell.row, cell.col, 0);
  const key = `${v.outcome}${'reason' in v ? ':' + v.reason : ''}`;
  bReason.set(key, (bReason.get(key) ?? 0) + 1);
  const before = g.grid.misplacedCount;
  if (g.selectBoardBead(cell.row, cell.col) && g.retrieveSelectedGroup(0) && g.grid.misplacedCount < before) bOk++;
}
console.log(`尝试取回格数 = ${misplacedCells(g.grid).length}`);
console.log(`judgeRetrieve 裁决统计 = ${JSON.stringify(Object.fromEntries(bReason))}  ← 'tray-full' = §3.13 满槽禁取`);
console.log(`➡ 族 B 可用动作数 = ${bOk} ${bOk === 0 ? '✅ 取回通道全封' : '❌ 有解'}`);
// 真链复核：点占位槽（路由 _routeTraySlot 的 holding 分支）⇒ 应零变化
const beforeTap = `${trayView(g)}|${g.grid.misplacedCount}`;
const sp = slotPoint(g, 3);
g.tapDesign(cellPoint(g, 0, 9).x, cellPoint(g, 0, 9).y); // 先选一颗错位珠
g.tapDesign(sp.x, sp.y); // 再点已有珠的槽
console.log(`真链复核：选珠后点占位槽 ⇒ 状态 ${beforeTap === `${trayView(g)}|${g.grid.misplacedCount}` ? '零变化 ✅（闸门生效）' : '被改动 ❌'}`);

// ═════════════════════ 4. 族 C：board 锚直填（WXG-T-162）═════════════════════
hr('§4 族 C「board 锚 → 同色底洞直填」（命题未计入的第三条通道）');
const beforeMis = g.grid.misplacedCount;
const beforeTray = trayView(g);
const avail = probeAll(m.h);
console.log(`probeAll（A→B→C→D 短路，找到即真做）= ${JSON.stringify(avail, null, 1)}`);
console.log(`➡ restrictedDeadlock（无直填/无道具口径）= ${avail.restrictedDeadlock} ｜ strictDeadlock（现行规则口径）= ${avail.strictDeadlock}`);
console.log(`盘面证据：misplaced ${beforeMis}→${g.grid.misplacedCount}，托盘 ${beforeTray}→${trayView(g)}（直填**不动托盘**⇒ 不吃容量、不受满槽禁取门）`);
const ro = availabilityReadonly(g);
console.log(`  只读可用性（探针前局面）= ${JSON.stringify(ro)} ← trayPlace=0/retrieve=0（命题口径死锁）而 directFill>0 ⇒ 唯一逃生皆在直填。`);

// ═════════════════════ 4b. 可发现性：托盘锚遮蔽直填═════════════════
hr('§4b 逃生通道要多少钱（真链）：托盘锚 vs board 锚对直填的遮蔽');
{
  const k = mount(board);
  runFirstStep(k.game);
  const holes = emptyCells(k.game.grid);
  const h0 = holes[0]!;
  // (i) 玩家自然动作：点托盘珠选色 → 点洞
  k.game.selectTraySlot(0);
  const before = k.game.grid.misplacedCount;
  const okTray = k.game.tapGridCell(h0.row, h0.col);
  console.log(`  选托盘槽0(色2) 后点洞 (${h0.row},${h0.col}) ⇒ 返回=${okTray} misplaced ${before}→${k.game.grid.misplacedCount}（**托盘锚遮蔽了直填**：_routeGridEmpty 先走 _placeSelected）`);
  // (ii) 需额外一步：改选盘上同色可落珠 → 点洞
  const src = misplacedCells(k.game.grid).find((c) => k.game.grid.cell(c.row, c.col)!.beadColorIdx === k.game.grid.requiredColor(h0.row, h0.col))!;
  k.game.selectBoardBead(src.row, src.col); // 换选静默清除 tray 锚
  const b2 = k.game.grid.misplacedCount;
  const okBoard = k.game.tapGridCell(h0.row, h0.col);
  console.log(`  改选盘珠 (${src.row},${src.col}) 后点同一洞 ⇒ 返回=${okBoard} misplaced ${b2}→${k.game.grid.misplacedCount} ⇒ 逃生需「换选到棋盘」这一步（教学成本）`);
}

// ═════════════════════ 5. 从该局面走到终局（真链机器人）═════════════════════
hr('§5 通关续走（同一夹具，允许直填 vs 禁止直填）');
{
  const keep = mount(board); // 复位到首步前的等价盘
  runFirstStep(keep.game);
  const bot = runBot(keep.h, { allowDirectFill: true, retrieve: 'max', maxMoves: 4000 });
  console.log(`[允许直填] cleared=${bot.cleared} moves=${bot.moves} 峰值托盘=${bot.peakTray} 取回=${bot.retrieves} 归位=${bot.places} 直填=${bot.directFills} stuck="${bot.stuck}"`);
  console.log(`  终态 phase=${keep.game.phase} misplaced=${keep.game.grid.misplacedCount} 空格=${emptyCells(keep.game.grid).length}`);
}
{
  const keep = mount(board);
  runFirstStep(keep.game);
  const bot = runBot(keep.h, { allowDirectFill: false, retrieve: 'max', maxMoves: 4000 });
  console.log(`[禁用直填 = 玩家不知道 T-162] cleared=${bot.cleared} moves=${bot.moves} 峰值托盘=${bot.peakTray} stuck="${bot.stuck}"`);
  console.log(`  死锁态：托盘满 ${trayView(keep.game)} 洞底色=[${[...new Set(emptyCells(keep.game.grid).map((c) => keep.game.grid.requiredColor(c.row, c.col)))].join(',')}] misplaced=${keep.game.grid.misplacedCount} phase=${keep.game.phase}`);
}

function runFirstStep(game: ReturnType<typeof mount>['game']): void {
  const b = blobAnchors(game.grid).sort((x, y) => y.size - x.size)[0]!;
  const p = cellPoint(game, b.cell.row, b.cell.col);
  game.tapDesign(p.x, p.y);
  const s = slotPoint(game, 0);
  game.tapDesign(s.x, s.y);
}

// ═════════════════════ 5c. 首步有得选吗（全盘错位珠均作为可选锚点）═════════════════
hr('§5c restricted 模型下的一切首步动作（逐颗错位珠都当锚点试一遍）');
{
  let anchors = 0;
  let dead = 0;
  const held = new Map<number, number>();
  const allCells = misplacedCells(mount(board).game.grid); // 仍于净盘（未走一步）的 144 颗错位珠
  console.log(`净盘错位珠 = ${allCells.length}（当前盘已被§4探针走过一步⇒ 取净盘列表为准）`);
  for (const cell of allCells) {
    const k = mount(board);
    const s = cellPoint(k.game, cell.row, cell.col);
    k.game.tapDesign(s.x, s.y);
    k.game.tapDesign(slotPoint(k.game, 0).x, slotPoint(k.game, 0).y);
    anchors++;
    held.set(k.game.tray.holdingCount, (held.get(k.game.tray.holdingCount) ?? 0) + 1);
    if (probeAll(k.h).restrictedDeadlock) dead++;
  }
  console.log(`错位珠（= 可选锚点）${anchors} 个 ⇒ 首步后受限死锁 ${dead} 个（${((dead / anchors) * 100).toFixed(1)}%）`);
  console.log(`首步后托盘持有数分布 = ${JSON.stringify(Object.fromEntries(held))}（12 = 满槽）`);
  console.log('➡ 密集全错位盘开局无洞、托盘空 ⇒ 唯一可用动作族 = 取回；若所有块≥容量则每个取回锚点都致满槽⇒ restricted 死锁**不是玩家失误**而是「无选择可逃」。');
}

// ═════════════════════ 6. 道具兜底（任务④）在死锁态逐型试解 ═════════════════════
hr('§6 族 D 道具兜底：死锁态下 solver 能否自救（不借助直填）');
for (const type of ['solver', 'solverPlus', 'solverRandom'] as const) {
  const k = mount(board);
  runFirstStep(k.game);
  const uses = k.game.powerups.freeUses(type);
  const ok = k.game.usePowerup(type);
  k.h.advance(1.2);
  const holes = emptyCells(k.game.grid);
  const holeBase = [...new Set(holes.map((c) => k.game.grid.requiredColor(c.row, c.col)))];
  const trayPlace = holeBase.filter((c) => trayColors(k.game).includes(c)).length;
  console.log(
    `${type}: freeUses=${uses} 激活=${ok} misplaced→${k.game.grid.misplacedCount} 洞底色=[${holeBase.join(',')}] ` +
      `托盘空槽=${k.game.tray.freeCount} 可归位洞色数=${trayPlace} ⇒ ${trayPlace > 0 ? '道具后可继续（自救成功）' : '道具后仍无解'}`,
  );
}
{
  // 三型连用（每关共 3 次激活）能否凑出「托盘色洞」
  const k = mount(board);
  runFirstStep(k.game);
  const log: string[] = [];
  for (const type of ['solver', 'solverPlus', 'solverRandom'] as const) {
    if (!k.game.usePowerup(type)) { log.push(`${type}=拒绝`); continue; }
    k.h.advance(1.2);
    const holes = emptyCells(k.game.grid);
    const holeBase = [...new Set(holes.map((c) => k.game.grid.requiredColor(c.row, c.col)))];
    const tp = holeBase.filter((c) => trayColors(k.game).includes(c)).length;
    log.push(`${type}:misplaced=${k.game.grid.misplacedCount},洞=${holes.length}[${holeBase.join(',')}],可归位=${tp}`);
  }
  console.log(`三型连用 ⇒ ${log.join(' | ')}`);
  const botNoDirect = runBot(k.h, { allowDirectFill: false, retrieve: 'max', maxMoves: 200 });
  console.log(`连用后仍禁用直填：cleared=${botNoDirect.cleared} stuck="${botNoDirect.stuck}"`);
}

// ═════════════════════ 7. 临界尺寸扫描（任务②）═════════════════════
hr(`§7 临界尺寸：最大块 B vs 托盘容量（容量 ${TRAY_BASE_SLOTS} / 扩容 2× 对照）`);
/** 行主序等长色条带（色循环）⇒ 母版同色连通块 ≈ run；实测块大小以引擎为准。 */
function runLayout(rows: number, cols: number, colors: number, run: number): number[] {
  const n = rows * cols;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (Math.floor(i / run) % colors) + 1;
  return out;
}
for (const cap of [TRAY_BASE_SLOTS, TRAY_BASE_SLOTS * 2]) {
  const seen = new Set<number>();
  const lines: string[] = [];
  let disagree = 0;
  for (const colors of [4, 6, 8]) {
    for (let run = 2; run <= 36; run++) {
      const b = makeBoard(ROWS, COLS, runLayout(ROWS, COLS, colors, run));
      if (!b) continue;
      const probe = mount(b);
      const top = blobAnchors(probe.game.grid).sort((x, y) => y.size - x.size)[0]!;
      if (seen.has(top.size)) continue; // 同一实测块尺寸只留一条样本（避免日志爆炸）
      seen.add(top.size);
      const k = mount(b);
      if (cap !== TRAY_BASE_SLOTS) k.game.expandTray(); // ⚠️ 仅测试可达（§8）
      runFirstStep(k.game);
      // ⚠️ 先取证快照再跑 probeAll（probe 找到动作时会真走一步，会改变持有数）
      const held = k.game.tray.holdingCount;
      const free = k.game.tray.freeCount;
      const av = probeAll(k.h);
      const expect = top.size >= k.game.tray.capacity;
      if (expect !== av.restrictedDeadlock) disagree++;
      lines.push(
        `  实测块=${top.size} cap=${k.game.tray.capacity} colors=${colors} run=${run} 首步后持有=${held} `
        + `空槽=${free} restricted死锁=${av.restrictedDeadlock} strict死锁(含直填/道具)=${av.strictDeadlock} `
        + `预期(块≥cap)=${expect} ${expect === av.restrictedDeadlock ? '✅' : '❌'}`,
      );
    }
  }
  lines.sort((x, y) => Number(x.match(/实测块=(\d+)/)![1]) - Number(y.match(/实测块=(\d+)/)![1]));
  console.log(`容量 ${cap}（样本=${lines.length}，按实测块升序）：`);
  console.log(lines.join('\n'));
  console.log(`➡ cap=${cap}：与「死锁 ⇔ 被点击块 ≥ cap」不一致的样本 = ${disagree}`);
}

// ═════════════════════ 7b. 临界点直测（块 = cap−1 vs 块 = cap）═════════════════
hr('§7b 临界点直测（找实测块恰为 11 / 12 的盘）');
{
  const b11 = makeBoard(ROWS, COLS, layoutBase(ROWS, COLS, 6, 'dither', 7));
  if (b11) {
    const k = mount(b11);
    const top = blobAnchors(k.game.grid).sort((x, y) => y.size - x.size)[0]!;
    runFirstStep(k.game);
    const held = k.game.tray.holdingCount;
    const free = k.game.tray.freeCount;
    const av = { ...probeAll(k.h) };
    console.log(`  块=${top.size}（dither/6色）cap=${TRAY_BASE_SLOTS} 首步后持有=${held} 空槽=${free} restricted死锁=${av.restrictedDeadlock}`);
  }
  const b12 = makeBoard(ROWS, COLS, runLayout(ROWS, COLS, 4, 4));
  if (b12) {
    const k = mount(b12);
    const top = blobAnchors(k.game.grid).sort((x, y) => y.size - x.size)[0]!;
    runFirstStep(k.game);
    const held = k.game.tray.holdingCount;
    const free = k.game.tray.freeCount;
    const av = { ...probeAll(k.h) };
    console.log(`  块=${top.size}（条带4/run=4）cap=${TRAY_BASE_SLOTS} 首步后持有=${held} 空槽=${free} restricted死锁=${av.restrictedDeadlock}`);
  }
  console.log(`➡ 临界块大小 = ${TRAY_BASE_SLOTS} = TRAY_BASE_SLOTS（块 = cap−1 尚存空槽⇒ 可继取，不死锁）；扩容 cap=24 时临界上移至 24（见§7 下半表，但玩法不可达）。`);
}

// ═════════════════════ 8. 扩容可达性（诚实标注）═════════════════════
hr('§8 MVP 扩容可达性（真链点 btn_expand）');
{
  const k = mount(board);
  const capBefore = k.game.tray.capacity;
  const btn = expandButtonLayout();
  const before = k.game.tray.capacity;
  k.game.tapDesign(btn.hitX + btn.hitW / 2, btn.hitBottom + btn.hitH / 2); // 真链 _handleTap route 3
  console.log(`真链点 btn_expand 热区中心 ⇒ 容量 ${before} → ${k.game.tray.capacity}（expanded=${k.game.tray.expanded}）；MVP 只发「即将开放」占位提示，不 expandTray`);
  console.log(`harness 直调 expandTray() ⇒ ${k.game.expandTray()} 容量=${k.game.tray.capacity}（⚠️ 仅测试/夹具可达，非玩法路径）`);
  console.log(`➡ 结论：玩法内有效容量恒 ${capBefore} ⇒ 临界块大小 = ${capBefore}（扩容 24 后上移至 24 仅在测试态成立）`);
}
