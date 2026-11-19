/**
 * 首版贪心策略 `'greedy-acb'`（EP15-S1）。
 *
 * 行为**逐字复现** `games/beads/design/forensics/g3/g3-lib.ts::runBot` 在
 * `branchOrder='ACB'` / `reuseAnchor=false` / `retrieve='max'` / `allowDirectFill=true` /
 * `usePowerups=false` 下的动作序（`bot-replay §2.2.3`，金样本判据 `§8-1`）：
 *   A 托盘归位 → C 盘上直填 → B 整组取回，任一成功即停；全失败 ⇒ null。
 *
 * 纯函数纪律：只读 `BotObservation`，不读时钟/RNG，不写状态；平票固定为
 * 「行优先 → 槽号升序 → 组大小降序」。
 *
 * 组定义：8 向连通、同色、错位珠（与生产 `collectMisplacedGroup` 同规则；观测是纯数据，
 * 故此处就地做同口径 flood fill —— 行为由全关金样本对拍兜底）。
 */

import type { BotAction, BotCommand, BotObservation, BotPolicy } from './types';

/** 取证扫描用的可调项（生产入口恒用默认值；默认值 = 金样本口径）。 */
export interface GreedyAcbOptions {
  /** 分支尝试序（'A' / 'C' / 'B' 的排列）；默认 `'ACB'`。 */
  readonly branchOrder?: string;
  /** 锚复用（直填后不重选锚）；默认 `false`。 */
  readonly reuseAnchor?: boolean;
  /** 取回偏好：`'max'` = 贪心取最大组（默认）；`'min'` = 小组优先。 */
  readonly retrieve?: 'max' | 'min';
  /** `retrieve: 'min'` 时允许的单次取回上限（组大小 > 此值 ⇒ 不收）。 */
  readonly maxRetrieve?: number;
  /** 是否允许盘上直填（WXG-T-162 board 锚直填）；默认 `true`。 */
  readonly allowDirectFill?: boolean;
}

type Cell = BotObservation['grid']['cells'][number];

interface Anchor {
  readonly row: number;
  readonly col: number;
  readonly size: number;
}

function isMisplaced(cell: Cell): boolean {
  return cell.state === 'filled' && cell.colorIdx !== cell.requiredColorIdx;
}

/** 同色错位连通块（8 向，不限步数）；返回组内格下标（行主序）。 */
function groupAt(cells: readonly Cell[], cols: number, rows: number, start: number): number[] {
  const color = cells[start]!.colorIdx;
  const out: number[] = [start];
  const seen = new Set<number>([start]);
  for (let head = 0; head < out.length; head++) {
    const cell = cells[out[head]!]!;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = cell.row + dr;
        const c = cell.col + dc;
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        const key = r * cols + c;
        if (seen.has(key)) continue;
        const next = cells[key];
        if (!next || !isMisplaced(next) || next.colorIdx !== color) continue;
        seen.add(key);
        out.push(key);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

/** 每个同色错位连通块的一个代表格（行主序）+ 尺寸。 */
function blobAnchors(cells: readonly Cell[], cols: number, rows: number): Anchor[] {
  const claimed = new Set<number>();
  const out: Anchor[] = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    if (!isMisplaced(cell) || claimed.has(i)) continue;
    const group = groupAt(cells, cols, rows, i);
    for (const key of group) claimed.add(key);
    out.push({ row: cell.row, col: cell.col, size: group.length });
  }
  return out;
}

export function createGreedyAcbPolicy(options: GreedyAcbOptions = {}): BotPolicy {
  const branchOrder = options.branchOrder ?? 'ACB';
  const reuseAnchor = options.reuseAnchor ?? false;
  const retrieve = options.retrieve ?? 'max';
  const maxRetrieve = options.maxRetrieve;
  const allowDirectFill = options.allowDirectFill ?? true;

  function decide(obs: BotObservation): BotAction | null {
    const { cols, rows, cells } = obs.grid;
    // 空穴按底色分组（行优先）；同时收集错位珠下标与终局判据。
    const holes = new Map<number, Cell[]>();
    const misplaced: number[] = [];
    let complete = true;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]!;
      if (cell.state === 'empty') {
        complete = false;
        const list = holes.get(cell.requiredColorIdx);
        if (list) list.push(cell);
        else holes.set(cell.requiredColorIdx, [cell]);
      } else if (isMisplaced(cell)) {
        complete = false;
        misplaced.push(i);
      }
    }
    if (complete) return null;

    // 托盘持有色（槽号升序去重）与第一个空槽。
    const trayColors: number[] = [];
    let firstFree = -1;
    for (const slot of obs.tray.slots) {
      if (slot.state === 'free') {
        if (firstFree < 0) firstFree = slot.index;
      } else if (!trayColors.includes(slot.colorIdx)) {
        trayColors.push(slot.colorIdx);
      }
    }

    // ── A：托盘归位（最小槽号的持有色 → 该色第一个空穴）
    const trayPlace = (): BotAction | null => {
      for (const color of trayColors) {
        const targets = holes.get(color);
        if (!targets || targets.length === 0) continue;
        const slot = obs.tray.slots.find((s) => s.state !== 'free' && s.colorIdx === color);
        if (!slot) continue;
        const commands: BotCommand[] = [];
        const selected =
          obs.selection.kind === 'tray'
            ? obs.tray.slots.find((s) => s.index === obs.selection.slot)
            : undefined;
        if (!selected || selected.colorIdx !== color) {
          commands.push({ type: 'selectTraySlot', slot: slot.index });
        }
        const target = targets[0]!;
        commands.push({ type: 'tapGridCell', row: target.row, col: target.col });
        return { commands };
      }
      return null;
    };

    // ── C：盘上直填（useful = 填完能造出托盘持有色的空穴；平票行优先）
    const directFill = (): BotAction | null => {
      if (!allowDirectFill) return null;
      if (reuseAnchor && obs.selection.kind === 'board') {
        const a = cells.find((c) => c.row === obs.selection.row && c.col === obs.selection.col);
        if (a && isMisplaced(a)) {
          const targets = holes.get(a.colorIdx);
          if (targets && targets.length > 0) {
            return { commands: [{ type: 'tapGridCell', row: targets[0]!.row, col: targets[0]!.col }] };
          }
        }
      }
      const need = new Set(trayColors);
      let pick: Cell | null = null;
      let pickUseful = false;
      for (const i of misplaced) {
        const cell = cells[i]!;
        const targets = holes.get(cell.colorIdx);
        if (!targets || targets.length === 0) continue;
        const useful = need.has(cell.requiredColorIdx);
        if (!pick || (useful && !pickUseful)) {
          pick = cell;
          pickUseful = useful;
        }
        if (pickUseful) break;
      }
      if (!pick) return null;
      const target = holes.get(pick.colorIdx)![0]!;
      return {
        commands: [
          { type: 'selectBoardBead', row: pick.row, col: pick.col },
          { type: 'tapGridCell', row: target.row, col: target.col },
        ],
      };
    };

    // ── B：整组取回（组大小降序，同大小行优先；受满槽禁取门）
    const retrieveGroup = (): BotAction | null => {
      if (firstFree < 0) return null;
      const blobs = blobAnchors(cells, cols, rows);
      const list =
        retrieve === 'max'
          ? blobs.slice().sort((a, b) => b.size - a.size)
          : blobs.slice().sort((a, b) => a.size - b.size);
      for (const blob of list) {
        if (retrieve === 'min' && maxRetrieve !== undefined && blob.size > maxRetrieve) continue;
        return {
          commands: [
            { type: 'selectBoardBead', row: blob.row, col: blob.col },
            { type: 'retrieveSelectedGroup', slot: firstFree },
          ],
        };
      }
      return null;
    };

    const branches: Record<string, () => BotAction | null> = { A: trayPlace, C: directFill, B: retrieveGroup };
    for (const key of branchOrder) {
      const branch = branches[key];
      if (!branch) throw new Error(`greedy-acb: 非法 branchOrder 字符 ${JSON.stringify(key)}（仅 A/B/C）`);
      const action = branch();
      if (action) return action;
    }
    return null;
  }

  return { id: 'greedy-acb', version: 1, decide };
}
