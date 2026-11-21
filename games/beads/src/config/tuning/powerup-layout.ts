import { POWERUP_BAND, POWERUP_CARD_GAP, POWERUP_CARD_H, POWERUP_CARD_W, POWERUP_LABEL_GAP, POWERUP_LABEL_H } from './visual.js';
import { DESIGN_W } from './layout.js';
import { POWERUP_TYPES, type PowerupType } from './gameplay.js';

/**
 * `[WXG-T-601]` 道具**框图** textureId（正本 = `design/art/final/assets/powerup/tiles/`，
 * 336² @4x ⇒ 设计尺度 84×84）。
 *
 * `[WXG-T-1019]` 用户裁定「拆分共背景（单源化）」：三件 336² tile 的外围 88px 环带**逐像素
 * 完全相同**、差异全部收敛在中央 (88,88,248,248) 道具区 ⇒ 拆为**公共背景件**（圆角木框 + 米底，
 * 中央道具区已填内面色）+ 三件 160² **道具件**；运行时背景 + 图标两段 blit。背景改稿只动一件。
 *
 * 与 {@link POWERUP_TYPES} 同键 ⇒ 逐型一一对应；宿主未导入/解不出时该 id 查不到
 * （`menuBitmapReady` 返 false）⇒ 视图走程序化单字徽章回退，不留空位。
 */
export const POWERUP_TILE_TEXTURES: Readonly<Record<PowerupType, string>> = {
  windowRestore: 'bitmap__powerup_restore_icon_window',
  randomRestore: 'bitmap__powerup_restore_icon_random',
  trayRestore: 'bitmap__powerup_restore_icon_tray',
};

/** `[WXG-T-1019]` 三件恢复 tile 共用的背景件 id（环带与三件逐像素同源，道具区已填内面色）。 */
export const POWERUP_RESTORE_BASE_TILE = 'bitmap__powerup_restore_base';

/** One powerup card's rect (`x`/`bottom` = design-space bottom-left corner). */
export interface PowerupCardRect {
  readonly x: number;
  readonly bottom: number;
  readonly w: number;
  readonly h: number;
}

/**
 * 竖向整块的底基准 y：`[标签 28] + [间隔 4] + [卡 116]` 共 148，在带内**整体居中**
 * （带高 152 ⇒ 上下各余 2）。卡底 = 基准 + 标签 + 间隔，标签中心另见 `powerupLabelY()`。
 */
function powerupBlockBaseY(): number {
  const blockH = POWERUP_LABEL_H + POWERUP_LABEL_GAP + POWERUP_CARD_H;
  const bandH = POWERUP_BAND.yMax - POWERUP_BAND.yMin;
  return POWERUP_BAND.yMin + (bandH - blockH) / 2;
}

/** 标签中心 y（§1.4「卡下方标签」，落在卡外、带内）。 */
export function powerupLabelY(): number {
  return powerupBlockBaseY() + POWERUP_LABEL_H / 2;
}

/**
 * The three card rects — the single geometry source shared by
 * `view/view-model.ts` (draw) and the S2 tap router (hit test), so a drawn card
 * can never disagree with where taps land. Cards sit **above** the label row.
 */
export function powerupCardRects(): PowerupCardRect[] {
  const totalW = POWERUP_CARD_W * 3 + POWERUP_CARD_GAP * 2;
  const startX = (DESIGN_W - totalW) / 2;
  const bottom = powerupBlockBaseY() + POWERUP_LABEL_H + POWERUP_LABEL_GAP;
  const rects: PowerupCardRect[] = [];
  for (let i = 0; i < POWERUP_TYPES.length; i++) {
    rects.push({
      x: startX + i * (POWERUP_CARD_W + POWERUP_CARD_GAP),
      bottom,
      w: POWERUP_CARD_W,
      h: POWERUP_CARD_H,
    });
  }
  return rects;
}
