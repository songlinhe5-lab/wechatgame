/**
 * WXG-T-104 · 阶段 B —— `normalizeCocosTouch()` 的 **Node 行为测试**。
 *
 * 这是本单「甲案」的全部意义所在：阶段 A 只能用源码级正则断言守 `bindings.ts`
 * （`bindings.ts` 静态 import `cc`，Node 下编译不了）⇒ 判别力近似为零，正是
 * 2026-09-13 那次误判的成因。归一化抽成纯函数后，坐标契约终于可以**被真正执行**。
 *
 * 样本全部来自**真实 Cocos web-mobile 产物上的实测**（2026-09-15，3.8.8 + Chrome，
 * 3 宿主配置 / 7 采样点），逐点溯源表见同目录
 * `cocos-touch-origin-contract.test.ts`（该文件锁**宿主语义**，本文件锁**归一化行为**）。
 *
 * 恒等式（实测）：
 *   getLocation().x = (clientX − rect.x) × dpr
 *   getLocation().y = (rect.y + rect.height − clientY) × dpr       ← 左下原点
 *   dpr = screen.devicePixelRatio（web = min(window.devicePixelRatio, 2)；小游戏不封顶）
 */

import { describe, expect, it } from 'vitest';
import { Viewport } from '../../src/core/render/viewport.js';
import { normalizeCocosTouch } from '../../src/adapters/cocos/touch-normalize.js';

interface Sample {
  readonly host: string;
  /** 画布 CSS 尺寸（三组实测里画布均铺满窗口，原点 (0,0)）。 */
  readonly canvas: { readonly w: number; readonly h: number };
  /** 引擎生效的 dpr（web 封顶 2）。 */
  readonly dpr: number;
  /** 浏览器原生 clientX/clientY（CSS px，左上原点）—— 归一化后应当回到这里。 */
  readonly page: { readonly x: number; readonly y: number };
  /** `e.getLocation()` 实测返回值（device px，左下原点）。 */
  readonly raw: { readonly x: number; readonly y: number };
}

const SAMPLES: readonly Sample[] = [
  // 1280×720 · dpr=1
  { host: '1280x720 dpr1', canvas: { w: 1280, h: 720 }, dpr: 1, page: { x: 700, y: 100 }, raw: { x: 700, y: 620 } },
  { host: '1280x720 dpr1', canvas: { w: 1280, h: 720 }, dpr: 1, page: { x: 480, y: 545 }, raw: { x: 480, y: 175 } },
  { host: '1280x720 dpr1', canvas: { w: 1280, h: 720 }, dpr: 1, page: { x: 480, y: 175 }, raw: { x: 480, y: 545 } },
  { host: '1280x720 dpr1', canvas: { w: 1280, h: 720 }, dpr: 1, page: { x: 200, y: 300 }, raw: { x: 200, y: 420 } },
  { host: '1280x720 dpr1', canvas: { w: 1280, h: 720 }, dpr: 1, page: { x: 900, y: 650 }, raw: { x: 900, y: 70 } },
  // 500×1000 · dpr=1 · 纵向信箱（框架 Viewport 的 offsetY = 55.33）
  { host: '500x1000 dpr1 (offsetY 55.33)', canvas: { w: 500, h: 1000 }, dpr: 1, page: { x: 250, y: 150 }, raw: { x: 250, y: 850 } },
  // iPhone 15 · window.devicePixelRatio=3，引擎封顶 2 · 393×659
  { host: 'iPhone15 393x659 dpr3(capped 2)', canvas: { w: 393, h: 659 }, dpr: 2, page: { x: 200, y: 300 }, raw: { x: 400, y: 718 } },
];

describe('normalizeCocosTouch（WXG-T-104 · 阶段 B）', () => {
  it('① dpr=1：翻转 y 后回到页面坐标（左下→左上）', () => {
    for (const s of SAMPLES.filter((x) => x.dpr === 1)) {
      const p = normalizeCocosTouch(s.raw, { canvasHeightCss: s.canvas.h, dpr: s.dpr });
      expect(p.x, `${s.host} x`).toBeCloseTo(s.page.x, 6);
      expect(p.y, `${s.host} y`).toBeCloseTo(s.page.y, 6);
      // 判别：若不翻转，y 会等于画布高 − 页面 y（整屏级别的差，不是边缘差）
      expect(Math.abs(s.raw.y - s.page.y), `${s.host} 翻转必须真的发生`).toBeGreaterThan(1);
    }
  });

  it('② ÷dpr：device px 回到 CSS px（含 window dpr=3 / 引擎封顶 2）', () => {
    const m = SAMPLES[SAMPLES.length - 1]; // iPhone 15 · 引擎 dpr = 2
    expect(m.dpr).toBe(2);
    const p = normalizeCocosTouch(m.raw, { canvasHeightCss: m.canvas.h, dpr: m.dpr });
    expect(p.x).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(300, 6);

    // 反向锁：若误用未封顶的 window.devicePixelRatio = 3，会差 1.5 倍 —— 这是
    // 「dpr 必须与输入源同源（cc.screen.devicePixelRatio）」这条约束的可执行形式。
    const wrong = normalizeCocosTouch(m.raw, { canvasHeightCss: m.canvas.h, dpr: 3 });
    expect(wrong.x).toBeCloseTo(400 / 3, 6);
    expect(Math.abs(wrong.x - 200), '用未封顶 dpr=3 必须明显偏离').toBeGreaterThan(60);
  });

  it('③ 纵向信箱（offsetY>0）：归一化与信箱偏移无关 —— getLocation 是画布相对量', () => {
    const s = SAMPLES[5]; // 500×1000，框架 fit 的 offsetY = 55.33
    const vp = new Viewport(750, 1334);
    const fit = vp.resize(s.canvas.w, s.canvas.h);
    expect(fit.offsetY).toBeCloseTo(55.3333, 3); // 确认该样本确实是信箱样本

    const p = normalizeCocosTouch(s.raw, { canvasHeightCss: s.canvas.h, dpr: s.dpr });
    expect(p.x).toBeCloseTo(250, 6);
    expect(p.y).toBeCloseTo(150, 6);
    expect(vp.containsScreenPoint(p.x, p.y), '归一化后的点必须落在设计矩形内').toBe(true);

    // 归一化结果不随 offsetY 变化（信箱偏移由 Viewport 负责，不由 adapter 扣）
    const vpCover = new Viewport(750, 1334);
    vpCover.resize(s.canvas.w, s.canvas.h, true);
    expect(vpCover.fit.offsetY).not.toBeCloseTo(fit.offsetY, 3);
    expect(normalizeCocosTouch(s.raw, { canvasHeightCss: vpCover.fit.screenHeight, dpr: s.dpr }).y)
      .toBeCloseTo(150, 6);
  });

  it('④ 边界：画布左下角 → 屏幕底部；左上角 → 屏幕顶部', () => {
    const space = { canvasHeightCss: 720, dpr: 2 };
    expect(normalizeCocosTouch({ x: 0, y: 0 }, space).y).toBeCloseTo(720, 6);
    expect(normalizeCocosTouch({ x: 0, y: 720 * 2 }, space).y).toBeCloseTo(0, 6);
    expect(normalizeCocosTouch({ x: 0, y: 720 * 2 }, space).x).toBeCloseTo(0, 6);
  });

  it('⑤ 画布不铺满窗口时，结果只取决于画布内相对位置（不减页面原点）', () => {
    // 构造值：画布位于页面 (50, 30)，尺寸 400×300，dpr=2。
    // getLocation() 已减 rect.x/y，故归一化结果里不应再出现 50 / 30。
    const space = { canvasHeightCss: 300, dpr: 2 };
    const p = normalizeCocosTouch({ x: 100, y: 200 }, space); // 画布内 CSS (50, 250)
    expect(p.x).toBeCloseTo(50, 6);
    expect(p.y).toBeCloseTo(300 - 100, 6); // 200/2 = 100 ⇒ 距顶 200
    expect(p.y).toBeCloseTo(200, 6);
  });

  it('⑥ out 复用：返回同一实例、不新建（触摸按帧到达，热路径零分配）', () => {
    const out = { x: -1, y: -1 };
    const r = normalizeCocosTouch({ x: 400, y: 718 }, { canvasHeightCss: 659, dpr: 2 }, out);
    expect(r).toBe(out);
    expect(out.x).toBeCloseTo(200, 6);
    expect(out.y).toBeCloseTo(300, 6);
  });

  it('⑦ dpr 非法（0 / NaN / 负数）退化为 1 —— 绝不产出 NaN 污染输入管线', () => {
    for (const dpr of [0, Number.NaN, -2]) {
      const p = normalizeCocosTouch({ x: 480, y: 175 }, { canvasHeightCss: 720, dpr });
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeCloseTo(480, 6); // 按 dpr=1 处理
      expect(p.y).toBeCloseTo(720 - 175, 6);
    }
  });

  it('⑧ 与 Viewport 往返：设计点 → designToScreen → 模拟宿主 device px → 归一化 → screenToDesign 回到原点', () => {
    for (const dpr of [1, 2]) {
      const vp = new Viewport(750, 1334);
      vp.resize(1280, 720);
      const design = { x: 297.5, y: 851.5 };
      const s = vp.designToScreen({ x: 0, y: 0 }, design.x, design.y);

      // 模拟宿主：CSS px（左上原点）→ device px（左下原点）
      const raw = { x: s.x * dpr, y: (720 - s.y) * dpr };
      const back = normalizeCocosTouch(raw, { canvasHeightCss: vp.fit.screenHeight, dpr });
      const design2 = vp.screenToDesign({ x: 0, y: 0 }, back.x, back.y);

      expect(back.x, `dpr=${dpr} screen x`).toBeCloseTo(s.x, 6);
      expect(back.y, `dpr=${dpr} screen y`).toBeCloseTo(s.y, 6);
      expect(design2.x, `dpr=${dpr} design x`).toBeCloseTo(design.x, 6);
      expect(design2.y, `dpr=${dpr} design y`).toBeCloseTo(design.y, 6);
    }
  });

  it('⑨ 镜像反证：不归一化时 y 经 screenToDesign 后恰为真值关于设计中线的镜像', () => {
    // 1280×720 样本：真值 design y = 1148.72；今日（未归一化）透传 y=620 ⇒ 185.28
    const vp = new Viewport(750, 1334);
    vp.resize(1280, 720);
    const s = SAMPLES[0]; // page (700,100) / raw (700,620)
    const truth = vp.screenToDesign({ x: 0, y: 0 }, s.page.x, s.page.y).y;
    const today = vp.screenToDesign({ x: 0, y: 0 }, s.raw.x, s.raw.y).y;
    expect(truth).toBeCloseTo(1148.72, 1);
    expect(today).toBeCloseTo(185.28, 1);
    expect(today + truth).toBeCloseTo(1334, 1); // 关于 designHeight/2 镜像

    // 归一化后二者重合 —— 这条正是「修复判据 R1/R2」在单测里的等价形式
    const fixed = normalizeCocosTouch(s.raw, { canvasHeightCss: vp.fit.screenHeight, dpr: 1 });
    expect(vp.screenToDesign({ x: 0, y: 0 }, fixed.x, fixed.y).y).toBeCloseTo(truth, 6);
  });
});
