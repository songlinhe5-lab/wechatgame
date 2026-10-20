/**
 * UiTheme — UI 风格层唯一真源（UI-20；`docs/architecture/ui-architecture-beads.md` §12）。
 *
 * 收拢四类跨屏重复：**遮罩 / 纸面板 / 字体 / 按下位移**。
 * ⛔ 本层只并真源、不改视觉：字面量逐字搬运，验收门 = 金样本十态 sha 零差异
 *   （`tests/ui-golden.test.ts`，WXG-T-298）。
 *
 * 遮罩**双档名保留**（`PANEL_SCRIM_ALPHA` 0.5 / `SETTINGS_SCRIM_ALPHA` 0.3 仍住 `tuning.ts`，
 * 本层只引用）。⚠ 两族 RGB **不同源且不得互换**：画布侧 = `PANEL_SCRIM_RGB`（42,46,67），
 * 菜单 overlay 侧 = 历史硬编黑（0,0,0）；洗色即 ux ①「RGB 零改动」违例。
 */
import type { RenderModelBuilder } from '../../framework/index';
import {
  PANEL_SCRIM_ALPHA,
  PANEL_SCRIM_RGB,
  SETTINGS_SCRIM_ALPHA,
  UI_CONTAINER,
  UI_PRESS_SINK,
} from '../config/tuning';
import { withAlpha } from './palette';
import type { BeadsPalette } from './palette';

/**
 * 字体表（字面 = 收拢前 `view-model` / `meta-view` 两处逐字并集）。
 * 语义键允许同值（`body` / `hudSmall` / `label` 现均为 28）：分开命名是为了调档时能一处一处改，
 * 不再回到两文件各存一份。
 */
export const UI_FONT = {
  /** 主菜单招牌 / 大标题 64。 */
  title: '64px sans-serif',
  /** 横幅 62 粗体。 */
  banner: 'bold 62px sans-serif',
  /** HUD 计时器 44 粗体。 */
  timer: 'bold 44px sans-serif',
  /** 面板标题 40 粗体。 */
  panelTitle: 'bold 40px sans-serif',
  /** overlay 标题 40（非粗体，历史字面）。 */
  overlayTitle: '40px sans-serif',
  /** HUD 主读数 30 粗体。 */
  hud: 'bold 30px sans-serif',
  /** 菜单钮 / 正文钮 30。 */
  button: '30px sans-serif',
  /** 面板按钮 30 粗体。 */
  panelButton: 'bold 30px sans-serif',
  /** 正文 28。 */
  body: '28px sans-serif',
  /** 副标题 28（页面说明类；与 body 同档）。 */
  sub: '28px sans-serif',
  /** HUD 次要读数 28（E2 大字号两档同基准）。 */
  hudSmall: '28px sans-serif',
  /** slogan / 版本号 28。 */
  label: '28px sans-serif',
  /** 小字 22。 */
  cell: '22px sans-serif',
  /** 行 3 辅助开关 22（更长文案）。 */
  panelToggle: '22px sans-serif',
  /** E2 大字号正文 35（28 × 1.25）。 */
  bodyLarge: '35px sans-serif',
} as const;

/**
 * E2 大字号（accessibility §5 基础版）：仅放大正文 / 说明类文本（×1.25，对齐
 * 文档 32→40 比例）。数字 / 标题 / 按钮字号不随开关变化（弹窗排版重排延后 v1.1）。
 * `largeText` 由调用方从快照取（UI-41 起对局页与面板层共用本策略）。
 */
export function bodyFont(largeText: boolean, name: 'sub' | 'hudSmall'): string {
  if (!largeText) return UI_FONT[name];
  return UI_FONT.bodyLarge; // 28 × 1.25（F7⑤ 后两档同基准）
}

/** mm:ss 显示串（HUD 与过关面板共用）。`floor` 是 BD-47 兜底层：
 *  上游浮点尾数（如 170.1999999999）不得漏进显示。 */
export function formatTime(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** 遮罩色族 + 双档 α（α 名保留自 `tuning`，此处只做聚合视图）。 */
export const UI_SCRIM = Object.freeze({
  /** 画布侧：覆盖棋盘与托盘（对局 / 结算面板）。 */
  canvas: PANEL_SCRIM_RGB,
  /** 菜单 overlay 侧：历史硬编黑，与画布侧不同源。 */
  overlay: { r: 0, g: 0, b: 0 },
  /** 常规档（0.5）。 */
  alpha: PANEL_SCRIM_ALPHA,
  /** 设置档（0.3：暂停面板 / settings overlay）。 */
  settingsAlpha: SETTINGS_SCRIM_ALPHA,
} as const);

export interface UiScrimRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** `rgba(r,g,b,a)` 逐字拼装（与收拢前的模板字面完全同形，不做取整）。 */
export function scrimFill(rgb: UiScrimRgb, alpha: number): string {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

/** 按下态绘制 y 偏移（设计空间 y-up ⇒ 下沉为负）；`reduceMotion` ⇒ 0（只换面）。 */
export function pressOffset(pressed: boolean, reduceMotion: boolean): number {
  return pressed && !reduceMotion ? -UI_PRESS_SINK : 0;
}

/**
 * T1 纸面板 / T2 纸卡通用绘制面（art-bible-proposal §4/§5）。
 * 构成 = 柔投影（同形 rect 竖向偏移一档，墨 `shadowInk`；y-up ⇒ 影在 `y−dy` 下侧）
 * → 面（`panel`）→ 1px `panelBorder` 描边。
 * 每元素 ≤1 层投影 + ≤1 层描边（治愈②）；零渐变、零 blur。`back` = 桌面通道（blit 之下）。
 */
export function drawPaperPanel(
  builder: RenderModelBuilder,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: BeadsPalette,
  radius: number,
  shadowAlpha: number,
  back = false,
): void {
  builder.rect(x, y - UI_CONTAINER.shadowDy, w, h, {
    fill: withAlpha(palette.shadowInk, shadowAlpha),
    radius,
    ...(back ? { back: true } : {}),
  });
  builder.rect(x, y, w, h, {
    fill: palette.panel,
    stroke: palette.panelBorder,
    lineWidth: UI_CONTAINER.strokePanel,
    radius,
    ...(back ? { back: true } : {}),
  });
}
