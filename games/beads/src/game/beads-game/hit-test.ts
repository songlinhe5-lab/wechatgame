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
  TRAY_HIT_SIZE,
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
 * 扩展态按钮隐藏 ⇒ 命中同时失效（否则会截胡扩展托盘的点选，渲染侧同款守卫）。
 */
export function hitExpandButton(x: number, y: number, trayExpanded: boolean): boolean {
  if (trayExpanded) return false;
  const btn = expandButtonLayout();
  return (
    x >= btn.hitX && x <= btn.hitX + btn.hitW && y >= btn.hitBottom && y <= btn.hitBottom + btn.hitH
  );
}

/**
 * 托盘槽命中：`TRAY_HIT_SIZE` 半径内、距槽心最近者胜（平手取先到者）；无命中 ⇒ `-1`。
 * 与 `view-model.drawTray` 共用 `trayLayout()`（§3.4 单一真源，WXG-T-062 判例）。
 */
export function hitTraySlot(x: number, y: number, capacity: number, width: number): number {
  const half = TRAY_HIT_SIZE / 2;
  let best = -1;
  let bestD2 = half * half;
  const rows = Math.ceil(capacity / TRAY_COLS);
  const lay = trayLayout(rows, width);
  for (let idx = 0; idx < capacity; idx++) {
    const row = Math.floor(idx / TRAY_COLS);
    const col = idx % TRAY_COLS;
    const dx = x - lay.slotCenterX(col);
    const dy = y - lay.slotCenterY(row);
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = idx;
    }
  }
  return best;
}
