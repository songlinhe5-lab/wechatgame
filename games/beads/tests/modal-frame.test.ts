/**
 * UI-22 ModalFrame 单测：进出场逐帧一致（旧算式 oracle）+ 静止态还原 + 点击屏障。
 *
 * 验收口径（`ui-architecture-beads.md` §12 UI-22）：**屏障单测；进出场与现行逐帧一致**。
 * 这里的 oracle 是收拢前 `drawPausePanel` 的三行算式（`PANEL_SCALE_FROM` 线性），
 * 两边用同序浮点运算 ⇒ 断言写 `toEqual`（位级相等，不是近似）。
 */
import { describe, expect, it } from 'vitest';
import { PANEL_SCALE_FROM } from '../src/config/tuning.js';
import {
  modalFrameLayout,
  modalHitTest,
  type ModalPanelBounds,
} from '../src/view/modal-frame.js';

/** 面板边界（形状与 `PanelRect` 一致，数值取自暂停面板量级）。 */
const PANEL: ModalPanelBounds = { xMin: 95, yMin: 150, xMax: 655, yMax: 868 };

/** 收拢前 `drawPausePanel` 的算式，原样保留作逐帧 oracle。 */
function legacyLayout(panel: ModalPanelBounds, progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const cx = (panel.xMin + panel.xMax) / 2;
  const cy = (panel.yMin + panel.yMax) / 2;
  const scale = PANEL_SCALE_FROM + (1 - PANEL_SCALE_FROM) * t;
  const w = (panel.xMax - panel.xMin) * scale;
  const h = (panel.yMax - panel.yMin) * scale;
  return { cx, cy, x: cx - w / 2, y: cy - h / 2, w, h, scale };
}

describe('modalFrameLayout —— 进出场逐帧一致', () => {
  it('t = 0 / 0.25 / 0.5 / 0.75 / 1 与旧算式位级相等', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(modalFrameLayout(PANEL, t)).toEqual(legacyLayout(PANEL, t));
    }
  });

  it('t = 1 还原静止态边界（金样本十态前提）', () => {
    const geo = modalFrameLayout(PANEL, 1);
    expect(geo.x).toBe(PANEL.xMin);
    expect(geo.y).toBe(PANEL.yMin);
    expect(geo.w).toBe(PANEL.xMax - PANEL.xMin);
    expect(geo.h).toBe(PANEL.yMax - PANEL.yMin);
    expect(geo.scale).toBe(1);
  });

  it('t = 0 从 0.9 起、中心不动（ux-spec §5）', () => {
    const geo = modalFrameLayout(PANEL, 0);
    expect(geo.scale).toBe(PANEL_SCALE_FROM);
    expect(geo.cx).toBe((PANEL.xMin + PANEL.xMax) / 2);
    expect(geo.cy).toBe((PANEL.yMin + PANEL.yMax) / 2);
  });

  it('进度越界先 clamp（-1 同 0，2 同 1）', () => {
    expect(modalFrameLayout(PANEL, -1)).toEqual(modalFrameLayout(PANEL, 0));
    expect(modalFrameLayout(PANEL, 2)).toEqual(modalFrameLayout(PANEL, 1));
  });
});

describe('modalHitTest —— 点击屏障', () => {
  it('面板内交给内容（含边界）', () => {
    expect(modalHitTest(PANEL, 375, 500)).toBe('content');
    expect(modalHitTest(PANEL, PANEL.xMin, PANEL.yMin)).toBe('content');
    expect(modalHitTest(PANEL, PANEL.xMax, PANEL.yMax)).toBe('content');
  });

  it('面板外默认吞掉（暂停面板「其余零响应」口径）', () => {
    expect(modalHitTest(PANEL, 0, 0)).toBe('block');
    expect(modalHitTest(PANEL, PANEL.xMin - 1, 500)).toBe('block');
    expect(modalHitTest(PANEL, 375, PANEL.yMax + 1)).toBe('block');
  });

  it('dismissOnScrim 打开时面板外返回 dismiss（本批所有弹窗保持关闭）', () => {
    expect(modalHitTest(PANEL, 0, 0, true)).toBe('dismiss');
    expect(modalHitTest(PANEL, 375, 500, true)).toBe('content');
  });
});
