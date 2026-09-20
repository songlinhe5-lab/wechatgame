/**
 * Tray — the S4 slot array: the single authority for bead possession.
 *
 * v2.2 (WXG-T-158 用户裁定①②, tray-spawner §2.1): two new invariants —
 *   - **同色归类**: non-free beads sit compact from slot 0 as contiguous
 *     same-colour blocks (no free slot between blocks); a retrieved bead
 *     auto-inserts at the tail of its colour's block (`insertGrouped`) — the
 *     player no longer picks a landing slot;
 *   - **同色全组选中**: `selected` marks the WHOLE same-colour block; tapping
 *     any holding bead selects its group, tapping a bead of the selected
 *     group again silently clears the whole group (`select` → 'deselected').
 *     At most ONE colour group is selected at a time (anchor mutex lives in
 *     BeadGame / input-control §2.1).
 * The tray also carries the "still-needed colours" projection: initialised
 * from the grid at level/stage load, decremented for each `bead:placed`
 * (architecture §2 note ① — a data projection, not an event; S3 and S4 never
 * call each other).
 */

import { TRAY_BASE_SLOTS, TRAY_EXPAND_SLOTS } from '../config/tuning.js';

export type SlotState = 'free' | 'holding' | 'selected';

export interface TraySlot {
  state: SlotState;
  /** Held colour (1-based palette index); 0 when free. */
  colorIdx: number;
}

/** v2.2 组选结果（原 'already-selected' 幂等语义被 'deselected' 整组取消推翻）。 */
export type SelectResult = 'selected' | 'deselected' | 'invalid';

export class Tray {
  private readonly _slots: TraySlot[];
  private _expanded = false;
  /** Still-needed colour counts; index 1..10 (0 unused). */
  private readonly _needed: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  constructor(baseSlots: number = TRAY_BASE_SLOTS) {
    this._slots = [];
    for (let i = 0; i < baseSlots; i++) this._slots.push({ state: 'free', colorIdx: 0 });
  }

  get capacity(): number {
    return this._slots.length;
  }

  get expanded(): boolean {
    return this._expanded;
  }

  slot(index: number): TraySlot | undefined {
    return this._slots[index];
  }

  /** Unlock the dashed expansion row (per-level only; reset() reverts, A1). */
  expand(): boolean {
    if (this._expanded) return false;
    this._expanded = true;
    for (let i = 0; i < TRAY_EXPAND_SLOTS; i++) {
      this._slots.push({ state: 'free', colorIdx: 0 });
    }
    return true;
  }

  /** Whole-tray reset (S5 §2.4 item 3+4: clear beads + expansion back to base). */
  reset(): void {
    this._slots.length = TRAY_BASE_SLOTS;
    for (const slot of this._slots) {
      slot.state = 'free';
      slot.colorIdx = 0;
    }
    this._expanded = false;
    this._needed.fill(0);
  }

  // ───────────────────────────────────────────── needed-colour projection

  /** Initialise the projection from a freshly built grid (level or stage load). */
  initNeeded(counts: readonly number[]): void {
    this._needed.fill(0);
    for (let i = 0; i < counts.length && i < this._needed.length; i++) {
      this._needed[i] = counts[i] ?? 0;
    }
  }

  /** Consume one placed bead from the projection (via the `bead:placed` event). */
  consumeNeeded(colorIdx: number): void {
    if (colorIdx >= 1 && colorIdx < this._needed.length && this._needed[colorIdx] > 0) {
      this._needed[colorIdx]--;
    }
  }

  /** Read-only view: colour → still-needed count. */
  neededCount(colorIdx: number): number {
    return colorIdx >= 1 && colorIdx < this._needed.length ? this._needed[colorIdx]! : 0;
  }

  /**
   * How many beads of `colorIdx` the tray currently holds (holding + selected).
   * Paired with {@link neededCount} by the spawner's A′ supply invariant
   * `held ≤ demand` (tray-spawner §2.4 / WXG-T-086): a colour is only feedable
   * while its held count stays below the board's remaining demand, so the tray
   * can never accumulate undroppable overflow (the tail soft-lock GAP-06).
   */
  heldCount(colorIdx: number): number {
    let n = 0;
    for (const slot of this._slots) {
      if (slot.state !== 'free' && slot.colorIdx === colorIdx) n++;
    }
    return n;
  }

  /** True when at least one colour is still needed (defensive spawn guard). */
  hasNeededColors(): boolean {
    for (let i = 1; i < this._needed.length; i++) {
      if (this._needed[i]! > 0) return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────── slot operations

  get selectedSlot(): number {
    for (let i = 0; i < this._slots.length; i++) {
      if (this._slots[i]!.state === 'selected') return i;
    }
    return -1;
  }

  get selectedColor(): number {
    const idx = this.selectedSlot;
    return idx >= 0 ? this._slots[idx]!.colorIdx : 0;
  }

  /** v2.2：选中组（同色连续块）的**尾槽**；无选中 ⇒ -1。批量归位从尾部取珠 ⇒ 保持归类紧凑不变式。 */
  get selectedLastSlot(): number {
    for (let i = this._slots.length - 1; i >= 0; i--) {
      if (this._slots[i]!.state === 'selected') return i;
    }
    return -1;
  }

  /** v2.2 组选：当下被选中的珠数（= 同色连续块长度；无选中 = 0）。 */
  get selectedCount(): number {
    let n = 0;
    for (const slot of this._slots) {
      if (slot.state === 'selected') n++;
    }
    return n;
  }

  get holdingCount(): number {
    let n = 0;
    for (const slot of this._slots) {
      if (slot.state !== 'free') n++;
    }
    return n;
  }

  get freeCount(): number {
    return this._slots.length - this.holdingCount;
  }

  /**
   * v2.2 组选（tray-spawner §2.1 裁定②，覆盖旧「单槽选中/双击幂等」）：
   * 点任一 holding 珠 ⇒ 托盘内该色**全部**珠进入 `selected`（换选时旧组整组回
   * `holding`）；再点已选组任一颗（含同一颗）⇒ **整组静默取消**（'deselected'，
   * 调用方零事件，锚回 `none`）。@returns 结果，调用方据此决定是否广播
   * `tray:selected {slot, colorIdx, count}`。
   */
  select(slotIndex: number): SelectResult {
    const slot = this._slots[slotIndex];
    if (!slot || slot.state === 'free') return 'invalid';
    const color = slot.colorIdx;
    const prev = this.selectedSlot;
    if (prev >= 0 && this._slots[prev]!.colorIdx === color) {
      this.deselectAll();
      return 'deselected';
    }
    this.deselectAll();
    for (const s of this._slots) {
      if (s.state === 'holding' && s.colorIdx === color) s.state = 'selected';
    }
    return 'selected';
  }

  /** v2.2：整组取消选中（`selected → holding`，零事件；锚互斥清除半边共用）。 */
  deselectAll(): void {
    for (const slot of this._slots) {
      if (slot.state === 'selected') slot.state = 'holding';
    }
  }

  /**
   * v2.2 自动归类插入（tray-spawner §2.1 归类不变式，用户裁定①）：新珠落到
   * **同色块尾部**（无同色块则追加紧凑序列末尾），其余珠整体右移一位保持紧凑。
   * 输入路径调用（取回/供料复活），非每帧热路径 ⇒ 移位写入可接受。
   * @returns 实际落位槽号；无空槽 ⇒ -1（满槽禁取珠前提由调用方/S3 把守）。
   */
  insertGrouped(colorIdx: number): number {
    if (this.freeCount === 0) return -1;
    const n = this.holdingCount; // 紧凑不变式 ⇒ 珠占 [0..n-1]
    let pos = n; // 默认：无同色块 ⇒ 追加序列末尾
    for (let i = 0; i < n; i++) {
      const s = this._slots[i]!;
      if (s.colorIdx === colorIdx) {
        while (i + 1 < n && this._slots[i + 1]!.colorIdx === colorIdx) i++;
        pos = i + 1; // 同色块尾部之后
        break;
      }
    }
    for (let i = n - 1; i >= pos; i--) {
      const src = this._slots[i]!;
      const dst = this._slots[i + 1]!;
      dst.state = src.state;
      dst.colorIdx = src.colorIdx;
      src.state = 'free';
      src.colorIdx = 0;
    }
    const target = this._slots[pos]!;
    target.state = 'holding';
    target.colorIdx = colorIdx;
    return pos;
  }

  /**
   * v2.3 **点槽定落位**（WXG-T-168 用户裁定，**推翻 WXG-T-158 裁定①自动归类**）：
   * 从 `startSlot` 起**向右扫描连续 `free` 槽**，依次写入至多 `count` 颗 `colorIdx`
   * 珠，遇非 free 槽 / 越界即止 —— **不移位、不按同色插堆**。
   * 因此落位区间恒为**连续相邻的一段**，起点 = 玩家点击的那个空槽。
   *
   * 与 `insertGrouped` 的关系：本方法是**玩法取回**的唯一落槽原语（组收进 / 单颗
   * 收进同一口径）；`insertGrouped` 仅剩夹具与死路径（spawner）使用，其「紧凑 +
   * 同色成块」不变式**不再约束玩法布局**（玩家自选起点可在珠列中留下空槽，后续
   * `takeBead` 左移补位会自然整理）。
   *
   * @returns 实际写入颗数；`0` ⇒ 起点不可用或该处无连续空槽（调用方据此拒绝）。
   */
  insertRun(startSlot: number, colorIdx: number, count: number): number {
    let written = 0;
    for (let i = startSlot; i < this._slots.length && written < count; i++) {
      const s = this._slots[i]!;
      if (s.state !== 'free') break; // 连续空槽段用尽
      s.state = 'holding';
      s.colorIdx = colorIdx;
      written++;
    }
    return written;
  }

  /** v2.3：从 `startSlot` 起的连续 `free` 槽数（点槽定落位的容量预判，越界/非 free ⇒ 0）。 */
  freeRunFrom(startSlot: number): number {
    let n = 0;
    for (let i = startSlot; i >= 0 && i < this._slots.length; i++) {
      if (this._slots[i]!.state !== 'free') break;
      n++;
    }
    return n;
  }

  /**
   * Store a bead into a specific free slot (primitive; tests/fixtures and the
   * dead spawner path). **v2.3 玩法落槽不再走本方法** —— 取回落槽 = 玩家点槽
   * `insertRun`（WXG-T-168 裁定，覆盖 v2.2 的自动归类 `insertGrouped`）；
   * 本方法不维持任何布局不变式。
   */
  storeInto(slotIndex: number, colorIdx: number): boolean {
    const slot = this._slots[slotIndex];
    if (!slot || slot.state !== 'free') return false;
    slot.state = 'holding';
    slot.colorIdx = colorIdx;
    return true;
  }

  /**
   * Dead path (v2.0 供料关停, kept for spawner revival): put a spawned bead
   * into a free slot. Returns false when occupied/void.
   */
  spawnInto(slotIndex: number, colorIdx: number): boolean {
    return this.storeInto(slotIndex, colorIdx);
  }

  /**
   * First free slot index ≥ `from`, or -1. (The *random* choice lives in the
   * spawner — this is only a linear scan helper.)
   */
  firstFree(from = 0): number {
    for (let i = from; i < this._slots.length; i++) {
      if (this._slots[i]!.state === 'free') return i;
    }
    return -1;
  }

  /**
   * A bead left the tray (placement accepted / powerup cleared). Selected state
   * clears together with the bead (tray-spawner §2.4).
   *
   * v2.2 (§8-6b 归类不变式)：离珠后**左移补位** —— 批量归位从组块尾倒序取珠，
   * 被清空的中间块若留下块间空洞，后侧块与 `insertGrouped` 的紧凑前提
   * （珠占 `[0..holdingCount-1]`）都会失守。输入路径调用，O(capacity) 可接受。
   */
  takeBead(slotIndex: number): boolean {
    const slot = this._slots[slotIndex];
    if (!slot || slot.state === 'free') return false;
    slot.state = 'free';
    slot.colorIdx = 0;
    for (let i = slotIndex + 1; i < this._slots.length; i++) {
      const src = this._slots[i]!;
      if (src.state === 'free') break; // 不变式 ⇒ 首个 free 之后无珠
      const dst = this._slots[i - 1]!;
      dst.state = src.state;
      dst.colorIdx = src.colorIdx;
      src.state = 'free';
      src.colorIdx = 0;
    }
    return true;
  }

  /** Clear specific slots (S6 `powerup:used` exit; name-compatible reserve). */
  clearSlots(slotIndices: readonly number[]): number[] {
    const cleared: number[] = [];
    for (const i of slotIndices) {
      if (this.takeBead(i)) cleared.push(i);
    }
    return cleared;
  }
}
