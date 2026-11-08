import { POWERUP_BAND, POWERUP_CARD_GAP, POWERUP_CARD_H, POWERUP_CARD_W, POWERUP_LABEL_GAP, POWERUP_LABEL_H } from './visual';
import { DESIGN_W } from './layout';
import { POWERUP_TYPES, type PowerupType } from './gameplay';

/**
 * `[WXG-T-601]` 道具**框图** textureId（正本 = `design/art/final/assets/powerup/tiles/`，
 * 336² @4x ⇒ 设计尺度 84×84；图内已含圆角木框 + 米底 + 道具本体 ⇒ 视图只需 blit，⛔ 不再叠圆底）。
 *
 * 与 {@link POWERUP_TYPES} 同键 ⇒ 逐型一一对应；宿主未导入/解不出时该 id 查不到
 * （`menuBitmapReady` 返 false）⇒ 视图走程序化单字徽章回退，不留空位。
 */
export const POWERUP_TILE_TEXTURES: Readonly<Record<PowerupType, string>> = {
  windowRestore: 'bitmap__powerup_window_tile',
  randomRestore: 'bitmap__powerup_random_tile',
  trayRestore: 'bitmap__powerup_tray_tile',
};

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
