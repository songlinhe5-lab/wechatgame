/**
 * 输入命中几何（无状态纯函数，见 `beads-game.ts` 路由 1–4）。
 *
 * 每个函数只读显式参数、不读任何游戏状态 ⇒ 可单测、零分配（`powerupCardRects()` 为既有
 * 调用，只在点击时触发）。几何与渲染同源：托盘 `trayLayout()`、按钮 `expandButtonLayout()`、
 * 道具卡 `powerupCardRects()`、齿轮与 HUD 带常量皆来自 `config/tuning.ts`（单一真源）。
 *
 * ⚠ `_hitUiControl`（抬起提交门的按下腿）与 `_routeTap`（路由分派）必须共用这里的同一批
 * 函数，否则「按下判 A、抬起判 B」会造成热区漂移。
 */
import {
  GEAR_HIT_SIZE,
  HUD_BAND,
  POWERUP_TYPES,
  TRAY_COLS,
  expandButtonLayout,
  powerupCardRects,
  trayLayout,
  type PowerupType,
} from '../../config/tuning.js';

/**
 * 齿轮热区：HUD 带左缘的 TOUCH_MIN 方块，随 HUD 上移量 `hudDy` 整体平移
 * （`hudDy` 由 `BeadsGame._hudDy()` 给出；渲染与热区同源）。
 */
export function hitGear(x: number, y: number, hudDy: number): boolean {
  return x >= 0 && x <= GEAR_HIT_SIZE && y >= HUD_BAND.yMin + hudDy && y <= HUD_BAND.yMax + hudDy;
}

/**
 * 道具卡热区 = 绘制矩形本身（`powerupCardRects()`，§3.8：卡高 ≥ TOUCH_MIN，无需额外扩张；
 * 与托盘 / 棋盘带不会歧义）。返回道具种类，未命中为 `null`。
 */
export function hitPowerupCard(x: number, y: number): PowerupType | null {
  const rects = powerupCardRects();
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    if (x >= r.x && x <= r.x + r.w && y >= r.bottom && y <= r.bottom + r.h) {
      return POWERUP_TYPES[i] ?? null;
    }
  }
  return null;
}

/**
 * `btn_expand` 热区 = 132×88（§3.4 v1.20，热区大于视觉 132×48）。几何同源 `expandButtonLayout()`。
 * 顶档（48 槽）后按钮消失 ⇒ 命中同时失效（否则会截胡托盘点选，渲染侧同款守卫）。
 * 三档制（§3.4 v1.83）下判据是 **`canExpand`**（还能不能再升一档），不是"已扩容过"。
 */
export function hitExpandButton(x: number, y: number, trayCanExpand: boolean): boolean {
  if (!trayCanExpand) return false;
  const btn = expandButtonLayout();
  return (
    x >= btn.hitX && x <= btn.hitX + btn.hitW && y >= btn.hitBottom && y <= btn.hitBottom + btn.hitH
  );
}

/**
 * 托盘槽命中：**方格唯一归属**——`|dx| ≤ pitch/2 && |dy| ≤ pitch/2`（最近槽心，round 即最近）；
 * 无命中 ⇒ `-1`。与 `view-model.drawTray` 共用 `trayLayout()`（§3.4 单一真源，WXG-T-062 判例）。
 */
export function hitTraySlot(
  x: number,
  y: number,
  capacity: number,
  width: number,
  // `[WXG-T-1082]` **绘制行数**（含「预览虚线行」）：槽位已改为随面板底板排布，行数会改变槽位 ⇒
  // 命中必须与 `drawTray` 同源，否则会点到空白处。缺省回落到「按 capacity 推导」（老调用方兼容）。
  drawRows?: number,
): number {
  const rows = drawRows ?? Math.ceil(capacity / TRAY_COLS);
  const lay = trayLayout(rows, width);
  // `[WXG-T-1096 · 用户 2026-11-26 令「点击区域要覆盖豆格子，中间不要有点击空隙」]`
  // 旧圆热区（r = TRAY_HIT_SIZE/2 = 30 < 四槽夹角最近距 √(27²+27²) ≈ 38.2 @ pitch 54）在
  // 相邻四槽夹角留**死区**（点击不中）。改**方格唯一归属**（与盘面 T-1070 同口径）：
  // 槽行带内每点按坐标取整归入最近槽 ⇒ 100% 覆盖、无空隙；`round` 即最近槽心，
  // 距离竞争语义与旧版逐点一致（仅把旧版必失手的夹角点划归最近槽）。
  const col = Math.round((x - lay.slotCenterX(0)) / lay.pitch);
  // 行自上而下（row=0 顶行；`slotCenterY` 随 row 递减）⇒ 取 `(cy0 − y)/pitch`。
  const row = Math.round((lay.slotCenterY(0) - y) / lay.pitch);
  if (col < 0 || col >= TRAY_COLS || row < 0 || row >= rows) return -1;
  const idx = row * TRAY_COLS + col;
  return idx < capacity ? idx : -1;
}
