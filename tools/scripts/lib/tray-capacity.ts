/**
 * 工具侧「把托盘容量钉到指定档」—— **仅供 `tools/` 下的测量/求解脚本**（`beads-bot` / `beads-solve`）。
 *
 * 为何不住生产代码：运行期容量只能经 `Tray.expand()`（广告/崩溃恢复）升档，⛔ 没有「随便设个
 * 容量」的玩法入口；给工具加一个生产 API 等于给玩法开一条后门。这里直接改 `_slots` 长度
 * （TS `private` 只是编译期约束），语义 = 「模拟玩家已开到第 k 档」，规则零改动。
 *
 * §3.4 v1.83 三档 = `TRAY_TIER_SLOTS`（12 / 24 / 48）。
 */
export function pinTrayCapacity(game: { readonly tray: unknown }, k: number): void {
  const slots = (game.tray as { _slots: { state: string; colorIdx: number }[] })._slots;
  while (slots.length > k) slots.pop();
  while (slots.length < k) slots.push({ state: 'free', colorIdx: 0 });
}
