/**
 * 大关门票归约 —— **纯函数**（ADR-0034 §6 S-3；DEC-8 判据源隔离；I5 门票不落档）。
 * ─────────────────────────────────────────────────────────────────────────────
 * 语义（设计真源 = `design/gdd/save-progress.md` §2.6.3 I5 / R7 满星门槛）：
 * 「本章全部槽位都达到 `STAR_MAX`」⇒ 门票成立。归约集合 = 章清单里的**每一个槽**，
 * boss 关与教学关**不豁免**（§6.1 M-17）——本文件的结构性保证是：入力只有
 * 「展平星账 + 槽位下标」，**没有 kind、没有章 id**，类型上就不存在豁免入口。
 *
 * 与显示层的边界（D 拍定「推进层 ≠ 显示层」）：
 * - 本函数只看 `星数 >= STAR_MAX`（满星），**不是**橱窗三态 `MetaBossState`
 *   的 `> 0` 判据；两层⛔ 互相复用（DEC-8）。
 * - 输入不含章 id ⇒ M-16 结构性成立；调用方若要从章表取槽位，那是**调用方**的事，
 *   本层⛔ import 章表。
 *
 * 性能契约：**零分配**——不 `new` 对象/数组、不 `map`/`filter`、不拼字符串。
 * 出参 `out` 由调用方持有并复用（每处恰建一次）；「差哪几关」按需回填到调用方
 * 提供的 `missingSlots` 数组（不传则只出 `missingCount`）。
 *
 * 空清单：`total === 0` ⇒ `satisfied === false`（⛔ 让 `every` 的空真值放行；
 * 「两层都假」= 票不开 + N=0 不建进度件）。
 * 首章无前置：由 {@link arcEntryTicket} 的 `prevSlots === undefined` 表达 ⇒ 放行且
 * `total === 0`（⛔ 造 `0/0` 只读字段）。
 */

import { STAR_MAX } from '../config/tuning';

/** 门票归约出参（调用方持有并复用；字段含义见 {@link arcTicket}）。 */
export interface ArcTicketResult {
  /** 该章全部槽位满星（且 `total > 0`）⇒ 门票成立。 */
  satisfied: boolean;
  /** 本章满星槽数 = 进度件的 `n`。 */
  fullStarCount: number;
  /** 本章清单槽数 = 进度件的 `N`（⛔ `DEMO_LEVEL_COUNT`，也⛔ 章内关表外的任何计数）。 */
  total: number;
  /** 未满星槽数 = `total - fullStarCount`（「差几关」的最小信息）。 */
  missingCount: number;
}

/** 出参的安全初值（`satisfied: false`：未算过 ⇒ 不开）。**非热路径**，每处建一次。 */
export function emptyArcTicketResult(): ArcTicketResult {
  return { satisfied: false, fullStarCount: 0, total: 0, missingCount: 0 };
}

/**
 * 归约**指定的一章**。
 *
 * @param starsBySlot 展平星账（0-based 关下标 → 该关历史最高星；长度 = 关表长）。
 * @param slots       章清单槽位（0-based 关下标；壳层 `_wallSlotsFor` 展开后的形态）。
 * @param out         复用的出参。
 * @param missingSlots 可选回填：未满星槽的关下标，写前 `missingCount` 个；长度由调用方保证。
 * @returns `out`（同一引用）。
 *
 * 槽位越界（槽位指向关表之外）⇒ 该槽按 0★ 计（不开门），⛔ 静默跳过。
 * 星值 `>= STAR_MAX` 即算满（逐值钳位已由存档层完成；本层不重复钳、不读其它语义）。
 */
export function arcTicket(
  starsBySlot: ArrayLike<number>,
  slots: readonly number[],
  out: ArcTicketResult,
  missingSlots?: number[],
): ArcTicketResult {
  const total = slots.length;
  const starCount = starsBySlot.length;
  let full = 0;
  let missing = 0;

  for (let i = 0; i < total; i += 1) {
    const slot = slots[i]!;
    const stars = slot >= 0 && slot < starCount ? starsBySlot[slot]! : 0;
    if (stars >= STAR_MAX) {
      full += 1;
    } else {
      if (missingSlots !== undefined) missingSlots[missing] = slot;
      missing += 1;
    }
  }

  out.satisfied = total > 0 && full === total;
  out.fullStarCount = full;
  out.total = total;
  out.missingCount = missing;
  return out;
}

/**
 * 归约**章入口**：门票由「阻断该页入口的上一章」决定（主理人拍定 C）。
 *
 * - `prevSlots === undefined` ⇒ **首章无前置**：放行，`total === 0`（不建进度件）；
 * - `prevSlots` 为空数组 ⇒ **上一章清单为空**：不开，`total === 0`（两层都假）——
 *   与 `undefined` 的差别是语义差别，不是防御式特判；
 * - 其余 ⇒ 委托 {@link arcTicket}（同一判据，⛔ 第二份实现）。
 *
 * 本函数**不做**「第几章」的判断（那需要章序/章 id，属调用方）；它只回答
 * 「给定上一章清单，这一页的门票开不开、n/N 是多少」。
 */
export function arcEntryTicket(
  starsBySlot: ArrayLike<number>,
  prevSlots: readonly number[] | undefined,
  out: ArcTicketResult,
  missingSlots?: number[],
): ArcTicketResult {
  if (prevSlots === undefined) {
    out.satisfied = true;
    out.fullStarCount = 0;
    out.total = 0;
    out.missingCount = 0;
    return out;
  }
  return arcTicket(starsBySlot, prevSlots, out, missingSlots);
}
