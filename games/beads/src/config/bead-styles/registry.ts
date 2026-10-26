/**
 * 玩家可选珠体风格的 id 注册表（WXG-T-420 T2）。
 * 注册序 = 设置循环序；绘制器仍住 view，存档与设置只依赖本文件辨认合法 id。
 */
import {
  DUAL13_STYLE_ID,
  FACET4_STYLE_ID,
  HANDDRAWN_STYLE_ID,
  LINEART18_STYLE_ID,
} from '../tuning.js';

const STYLE_IDS: readonly string[] = Object.freeze([
  FACET4_STYLE_ID,
  LINEART18_STYLE_ID,
  DUAL13_STYLE_ID,
  HANDDRAWN_STYLE_ID,
]);
const BY_ID: ReadonlySet<string> = new Set(STYLE_IDS);

export const DEFAULT_BEAD_STYLE_ID = FACET4_STYLE_ID;

export function registeredStyleIds(): readonly string[] {
  return STYLE_IDS;
}

export function isRegisteredStyleId(id: string): boolean {
  return BY_ID.has(id);
}
