/**
 * 最坏首步后仍可活 —— MVP review F3 残差的常检项（WXG-T-434，2026-10-27）。
 *
 * **补的是哪个缺口**：关卡入表已有硬拦闸（`tools/scripts/sync-levels-data.mjs` 拦
 * `pricing.cleared=false` + `stepsLB > steps` + `time` 与实测不符），但它证的是
 * 「bot 那条策略链上存在解路径」，**不证「玩家走坏一步之后还有活路」**。浏览器那轮
 * 报的死局（取回最大同色错位组 → 托盘满槽 → 三条出口全封）已被引擎侧否证（判例 K-195：
 * 量具假阴性，道具卡需二次提交），但「取回会腾出洞、直填不吃托盘容量」这类活路
 * 此前**没有任何门在守** ⇒ 本文件把它钉成逐关常检。
 *
 * **判据口径**：一条命令算「能推进」= 盘面**已就位珠数** `filled − misplaced` 严格上升。
 * 取回（族 B）刻意不算活路：珠离格会让 `misplaced` 记账下降，但已就位数不变 = 腾洞手段
 * 而非进展；放回原格同理中性。这样才不会被"来回搬珠"骗成永绿。
 *
 * ⚠ 不引 `games/beads/design/forensics/g3/g3-lib.ts` 的三探针：那是 `tools/` 侧取证面
 * （对 0 参的 `retrieveSelectedGroup()` 传了参，靠自身不进 typecheck 腿才成立），测试层
 * 引它会把它拉进 `pnpm run typecheck` 的编译面。这里只走 `BeadsGame` 公开命令 ⇒ 合法性
 * 由引擎裁定，⛔ 不复刻判定。
 */
import { describe, expect, it } from 'vitest';
import { createBeadsHarness } from './helpers.js';
import { LEVELS } from '../src/config/levels.js';
import { collectMisplacedGroup } from '../src/entities/grid.js';
import type { BeadsGame } from '../src/game/beads-game.js';

type Cell = { row: number; col: number };

function scan(game: BeadsGame, pred: (row: number, col: number) => boolean): Cell[] {
  const g = game.grid;
  const out: Cell[] = [];
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) if (pred(r, c)) out.push({ row: r, col: c });
  return out;
}

/** 盘面已就位珠数（= 离通关还有多远的那个分子）。 */
const seated = (game: BeadsGame): number => game.grid.filledCount - game.grid.misplacedCount;

/** 找一步「真推进」的合法命令：族 A 托盘珠归空格 / 族 C 盘面锚直填。找到即返回其描述。 */
function findProgress(game: BeadsGame): string | null {
  const holes = scan(game, (r, c) => game.grid.cell(r, c)!.state === 'empty');
  if (holes.length === 0) return null; // 无洞 ⇒ 谁都落不下去（全就位时本判据不适用）
  for (let slot = 0; slot < game.tray.capacity; slot++) {
    if (game.tray.slot(slot)!.state === 'free') continue;
    game.selectTraySlot(slot);
    for (const e of holes) {
      const before = seated(game);
      if (game.tapGridCell(e.row, e.col) && seated(game) > before) return `A 槽${slot}→(${e.row},${e.col})`;
    }
  }
  for (const m of scan(game, (r, c) => game.grid.isMisplaced(r, c))) {
    if (!game.selectBoardBead(m.row, m.col)) continue;
    for (const e of holes) {
      const before = seated(game);
      if (game.tapGridCell(e.row, e.col) && seated(game) > before) return `C (${m.row},${m.col})→(${e.row},${e.col})`;
    }
  }
  return null;
}

/** 最大同色错位连通组的起点（行主序去重）——玩家最容易"一把 grab 太多"的那个坑。 */
function biggestBlob(game: BeadsGame): { at: Cell; size: number } | null {
  const g = game.grid;
  const claimed = new Set<number>();
  let best: { at: Cell; size: number } | null = null;
  for (const cell of scan(game, (r, c) => g.isMisplaced(r, c))) {
    const key = cell.row * g.cols + cell.col;
    if (claimed.has(key)) continue;
    const group = collectMisplacedGroup(g, cell.row, cell.col);
    for (const x of group) claimed.add(x.row * g.cols + x.col);
    if (!best || group.length > best.size) best = { at: cell, size: group.length };
  }
  return best;
}

describe('最坏首步后仍有活路（逐关常检，MVP review F3 残差）', () => {
  it(`${LEVELS.length} 关：取回最大同色错位组之后，盘面还能落子推进`, () => {
    const dead: string[] = [];
    const rows: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const harness = createBeadsHarness({ levels: [LEVELS[i]!] });
      const game = harness.game;
      if (game.phase !== 'playing') game.startNormal();

      const blob = biggestBlob(game);
      if (!blob) {
        rows.push(`#${i} 无错位组 ⇒ 不适用`);
        continue;
      }
      const before = seated(game);
      game.selectBoardBead(blob.at.row, blob.at.col);
      const took = game.retrieveSelectedGroup();
      const holes = scan(game, (r, c) => game.grid.cell(r, c)!.state === 'empty').length;
      const progress = took ? findProgress(game) : '首步被拒';
      rows.push(
        `#${i} ${LEVELS[i]!.name} 组${blob.size} 取回=${took} 洞=${holes} 已就位 ${before}→${seated(game)} 活路=${progress ?? '无'}`,
      );
      if (took && progress === null) dead.push(`#${i} ${LEVELS[i]!.name}（组 ${blob.size}，托盘 ${game.tray.capacity - game.tray.freeCount}/${game.tray.capacity} 满）`);
    }
    // 读数逐字进失败信息：任何一关走进「无一步能推进」= 玩家可触达死局，硬红。
    expect(dead.join(' ｜ '), `逐关读数：\n  ${rows.join('\n  ')}`).toBe('');
  });
});
