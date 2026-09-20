/**
 * WXG-T-104 · Cocos 宿主触摸坐标语义契约（**宿主实测台账**：阶段 A 锁语义，阶段 B 已改码，
 * 本文件保留的是"宿主到底给了什么"这组**事实**，它不随本仓代码变化）
 *
 * 权威 = 真实 Cocos 产物上的实测，不是文档推断。取证记录见
 * `production/TASKS-DETAIL.md` → `## WXG-T-104`（A6 复现法与本文件同源）。
 *
 * 结论（2026-09-15，`pnpm --filter @wxgame/beads run build:cocos:web` 产物 + Chrome）：
 *
 *   getLocation()      = 画布相对 · **device px（× min(dpr, 2)）** · **左下原点**
 *                        x = (clientX − rect.x) × dpr
 *                        y = (rect.y + rect.height − clientY) × dpr
 *   getStartLocation() = 同 getLocation() 的空间（touch-start 时两者数值相同）
 *   getUILocation()    = 设计单位 · **左下原点** · 量纲 dpr 无关，但**不减信箱偏移**
 *                        （引擎按 FIXED_HEIGHT 适配，与框架 Viewport 的 contain 并不等价）
 *
 * 阶段 A 时 `readTouch()` 把 `getLocation()` 原样透传进
 * `Viewport.screenToDesign()`（后者自身再做一次 y 翻转）⇒ 两次翻转相消为一次
 * ⇒ **y 轴上下镜像**（缺陷 C1）。阶段 B 起由 `touch-normalize.ts` 归一化
 * （÷dpr + 翻转 y），本文件记录的宿主语义**不变**。
 *
 * 本文件只留**宿主样本自洽性**断言 —— 锁死上面这组语义，防止后人把实测数据
 * "改回"左上原点（阶段 A 起即为绿，与代码无关，纯事实台账）。
 *
 * ⚠ 阶段 A 曾在此放两条**源码级**红灯（`readTouch` 不得透传 y / 注释不得再写
 * top-left），那是 `bindings.ts` 静态 import `cc` ⇒ Node 不可编译的**临时形态**。
 * 阶段 B 已把归一化抽成纯函数 `touch-normalize.ts`，那两条断言**退役**：
 *   · 行为覆盖 ⇒ `cocos-touch-normalize.test.ts`（Node 行为测试，真跑真断言）
 *   · 错误注释 ⇒ 已在阶段 B 就地订正（ADR-0011 §1.1 同步订正）
 * 保留源码级守门会与本单"判别力为零"的根因同形：正则挡不住下一次语义漂移。
 */

import { describe, expect, it } from 'vitest';
import { Viewport } from '../../src/core/render/viewport.js';

interface HostSample {
  /** 宿主配置（窗口 CSS 尺寸 + dpr），用于溯源。 */
  readonly host: string;
  /** `screenAdapter.devicePixelRatio`，即 min(window.devicePixelRatio, 2)（web 宿主封顶 2）。 */
  readonly dpr: number;
  /** `#GameCanvas.getBoundingClientRect()` 的宽高（CSS px）。三组实测里画布均铺满窗口、原点 (0,0)。 */
  readonly canvasCss: { readonly w: number; readonly h: number };
  /** 浏览器原生事件坐标（clientX/clientY，CSS px，左上原点）。 */
  readonly page: { readonly x: number; readonly y: number };
  /** `e.getLocation()` 实测返回值。 */
  readonly getLocation: { readonly x: number; readonly y: number };
  /** `e.getUILocation()` 实测返回值。 */
  readonly getUILocation: { readonly x: number; readonly y: number };
}

/**
 * 逐点实测（每个数字都来自浏览器内 `node.on('touch-start')` 回调里的 accessor 返回值，
 * 且与原生 `pointerdown` 的 clientX/clientY 同帧对照）。容差 1.5 px：Cocos 会取整。
 */
const SAMPLES: readonly HostSample[] = [
  // 1280×720 · dpr=1（fit: scale 0.53973 / offsetX 437.60 / offsetY 0）
  { host: 'web-mobile 1280x720 dpr1', dpr: 1, canvasCss: { w: 1280, h: 720 }, page: { x: 700, y: 100 }, getLocation: { x: 700, y: 620 }, getUILocation: { x: 1296.94, y: 1148.72 } },
  { host: 'web-mobile 1280x720 dpr1', dpr: 1, canvasCss: { w: 1280, h: 720 }, page: { x: 480, y: 545 }, getLocation: { x: 480, y: 175 }, getUILocation: { x: 889.33, y: 324.24 } },
  { host: 'web-mobile 1280x720 dpr1', dpr: 1, canvasCss: { w: 1280, h: 720 }, page: { x: 480, y: 175 }, getLocation: { x: 480, y: 545 }, getUILocation: { x: 889.33, y: 1009.76 } },
  { host: 'web-mobile 1280x720 dpr1', dpr: 1, canvasCss: { w: 1280, h: 720 }, page: { x: 200, y: 300 }, getLocation: { x: 200, y: 420 }, getUILocation: { x: 370.56, y: 778.17 } },
  { host: 'web-mobile 1280x720 dpr1', dpr: 1, canvasCss: { w: 1280, h: 720 }, page: { x: 900, y: 650 }, getLocation: { x: 900, y: 70 }, getUILocation: { x: 1667.5, y: 129.69 } },
  // 500×1000 · dpr=1 · 纵向信箱（offsetY = 55.33）—— 唯一 offsetY > 0 的样本
  { host: 'web-mobile 500x1000 dpr1 (offsetY=55.33)', dpr: 1, canvasCss: { w: 500, h: 1000 }, page: { x: 250, y: 150 }, getLocation: { x: 250, y: 850 }, getUILocation: { x: 333.5, y: 1133.9 } },
  // iPhone 15 · window.devicePixelRatio=3（引擎封顶 2）· 393×659
  { host: 'iPhone15 393x659 dpr3(capped 2)', dpr: 2, canvasCss: { w: 393, h: 659 }, page: { x: 200, y: 300 }, getLocation: { x: 400, y: 718 }, getUILocation: { x: 404.86, y: 726.72 } },
];

describe('Cocos 触摸坐标语义（WXG-T-104 · 宿主实测台账）', () => {
  it('① getLocation() = 画布相对 · device px · 左下原点', () => {
    for (const s of SAMPLES) {
      const expectX = (s.page.x - 0) * s.dpr;
      const expectY = (s.canvasCss.h - s.page.y) * s.dpr;
      expect(s.getLocation.x, `${s.host} @${s.page.x},${s.page.y} x`).toBeCloseTo(expectX, 0);
      expect(s.getLocation.y, `${s.host} @${s.page.x},${s.page.y} y`).toBeCloseTo(expectY, 0);
      // 关键判别：左上原点会给出 y = page.y × dpr，与本式相差整屏高度
      expect(Math.abs(s.getLocation.y - s.page.y * s.dpr), `${s.host} 必须不是左上原点`).toBeGreaterThan(1);
    }
  });

  it('① y 与页面坐标反向（左下原点），x 同向（不镜像）', () => {
    const hi = SAMPLES[1]; // page y = 545
    const lo = SAMPLES[2]; // page y = 175
    expect(hi.page.y).toBeGreaterThan(lo.page.y);
    expect(hi.getLocation.y).toBeLessThan(lo.getLocation.y);
    expect(hi.getUILocation.y).toBeLessThan(lo.getUILocation.y);
    expect(hi.getLocation.x).toBe(lo.getLocation.x); // x 不受影响
  });

  it('③ 镜像算术：透传值经 screenToDesign 后恰为真值关于设计中线的镜像', () => {
    // 1280×720 样本：真值 design y = 1148.72，透传 y=620 得到 185.28 = 1334 − 1148.72
    const vp = new Viewport(750, 1334);
    vp.resize(1280, 720);
    const truth = vp.screenToDesign({ x: 0, y: 0 }, 700, 100).y; // 正确口径（左上原点 CSS px）
    const today = vp.screenToDesign({ x: 0, y: 0 }, 700, 620).y; // 今日透传 getLocation()
    expect(truth).toBeCloseTo(1148.72, 1);
    expect(today).toBeCloseTo(185.28, 1);
    expect(today + truth).toBeCloseTo(1334, 1); // 关于 designHeight/2 镜像
  });
});
