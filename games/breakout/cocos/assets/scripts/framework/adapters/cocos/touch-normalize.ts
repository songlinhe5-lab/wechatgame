/**
 * WXG-T-104 · Cocos 宿主触摸坐标归一化（**纯函数**，Node 可单测）
 *
 * 为什么单独成文件：`bindings.ts` 静态 `import 'cc'`，Node 下编译不了，`cc` 只在
 * Cocos 工程里存在 ⇒ 历史上「输入坐标语义」只能靠**源码级正则断言**守着，
 * 而正则判别力近似为零（2026-09-13 那次误判就是这么漏过去的，见 TASKS-DETAIL
 * WXG-T-104 · A5）。本模块不 import `cc`、不碰 DOM、不读全局，于是可以在 Node
 * 里对归一化做**真正的行为测试**。
 *
 * ── 实测语义（2026-09-15，Cocos 3.8.8 web-mobile + Chrome，3 宿主配置 / 7 采样点）──
 *
 *   getLocation()      = 画布相对 · **device px（× dpr）** · **左下原点**
 *                        x = (clientX − rect.x) × dpr
 *                        y = (rect.y + rect.height − clientY) × dpr
 *   getStartLocation() = 与 getLocation() 同一空间（touch-start 时数值相同）
 *   getUILocation()    = 引擎 UI 空间（设计单位 · 左下原点 · dpr 无关），但引擎按
 *                        FIXED_HEIGHT 适配而框架 `Viewport` 按 contain 适配 ⇒
 *                        getUILocation() **不减信箱偏移**，不可当框架设计坐标用。
 *
 * ── 框架契约（ADR-0011）──────────────────────────────────────────────────
 *
 *   `RawPointerInput` / `Viewport` 的屏幕空间 = **画布 CSS px · 左上原点**。
 *   ⇒ 宿主 adapter 必须做两件事：① 翻转 y（左下→左上）② ÷dpr（device px→CSS px）。
 *
 *   `Viewport.screenToDesign()` 自己还有一次 y 翻转（设计空间 y 向上），所以这里
 *   **必须**翻 —— 早期版本误以为 `getLocation()` 已经是左上原点，两次假设叠加
 *   恰好相消成「一次翻转」⇒ y 轴上下镜像（缺陷 C1，beads 玩法整体不可用）。
 *
 * ⚠ 微信宿主（WXG-T-129 → **WXG-T-161 勘误**，2026-09-18）：
 *   T-129 曾据「源码同形」判定微信 `getLocation()` 为**量纲混合态**
 *   （`y = windowHeight(逻辑) − clientY×dpr(物理)`），并据此写了 wx 分支
 *   `y = (windowHeight − raw.y) / dpr`。**该判定是误读，已由构建产物
 *   `cocos-js/cc.js` 引擎源码实锤推翻**：
 *     `_getLocation(touch, windowSize, dpr) { x = clientX*dpr;
 *                                             y = windowSize.height − clientY*dpr }`
 *     且 `screenAdapter.windowSize = new Size(windowWidth*dpr, windowHeight*dpr)`
 *     —— 翻转基准是 **screenAdapter.windowSize.height（物理 px）**，不是
 *     `wx.getWindowInfo().windowHeight`（逻辑 px）⇒ 两侧**量纲一致**。
 *   故正确逆变换是 `clientY = windowHeight − raw.y/dpr`（与 web 分支**同形**），
 *   而旧式引入系统偏移 `−H·(dpr−1)/dpr`（dpr=3 ⇒ ≈ −0.67·H）⇒ **真机全屏
 *   点击落空**（BD-48「点托盘/网格全部无响应」的真正复位原因）。
 */

/** 归一化所需的宿主量。两个字段都必须是 **CSS px 口径**，与 `Viewport` 一致。 */
export interface CocosTouchSpace {
  /**
   * 画布可视高度（**CSS px**）。
   *
   * 取值必须与 `Viewport.fit.screenHeight` 同口径 —— `_fitToGameCanvas()` 用
   * `#GameCanvas.clientHeight`（CSS px）设置它；微信侧无 `document` 时保持
   * `platform.getScreenSize()` 的屏幕高（也是 CSS px）。
   * 用 `getBoundingClientRect().height` 会引入 ≤1px 的取整差。
   */
  readonly canvasHeightCss: number;

  /**
   * 引擎**生效**的 device pixel ratio（device px / CSS px），即封顶后的值：
   * web = `min(window.devicePixelRatio, 2)`；小游戏 = `wx.getWindowInfo().pixelRatio`（不封顶）。
   *
   * 必须与输入源同源（宿主侧取 `cc.screen.devicePixelRatio`），不要自己复刻封顶
   * 规则 —— 复刻错了就会留下一个整比缩放误差（dpr=3 机上差 1.5 倍）。
   */
  readonly dpr: number;
}

/** 归一化结果：**屏幕 CSS px · 左上原点**（= `RawPointerInput` 契约）。 */
export interface CocosTouchPoint {
  x: number;
  y: number;
}

/**
 * 把 Cocos `getLocation()` / `getStartLocation()` 的返回值归一化成框架屏幕坐标。
 *
 * @param raw   `e.getLocation()` 的返回值（画布相对 · device px · 左下原点）
 * @param space 宿主量，见 {@link CocosTouchSpace}
 * @param out   可选复用对象（触摸事件按帧频率到达，传 scratch 可零分配）；省略时新建一个
 * @returns 屏幕 CSS px · 左上原点
 */
export function normalizeCocosTouch(
  raw: { readonly x: number; readonly y: number },
  space: CocosTouchSpace,
  out?: CocosTouchPoint,
): CocosTouchPoint {
  const target = out ?? { x: 0, y: 0 };
  // dpr 非法（0 / NaN / 负数）时退化为 1：宁可"不缩放"，也不能产出 NaN 污染输入管线。
  const dpr = Number.isFinite(space.dpr) && space.dpr > 0 ? space.dpr : 1;
  target.x = raw.x / dpr;
  target.y = space.canvasHeightCss - raw.y / dpr;
  return target;
}

/**
 * WXG-T-129 · 微信小游戏宿主的 `getLocation()` 归一化（**独立于 web 分支**）。
 *
 * 引擎微信适配（`pal/input/minigame/touch-input.ts`，Cocos 3.8.8，**构建产物
 * `cocos-js/cc.js` 实锤，WXG-T-161**）：
 * ```
 *   _getLocation(touch, windowSize, dpr) {
 *     x = touch.clientX * dpr
 *     y = windowSize.height - touch.clientY * dpr
 *   }
 *   screenAdapter.windowSize = new Size(windowWidth * dpr, windowHeight * dpr)
 * ```
 * ⇒ 翻转基准 `windowSize.height` 与 `clientY*dpr` **同为物理 px**（量纲一致）；
 * `windowSize` 是 `screenAdapter` 的派生量，**不是** `wx.getWindowInfo()` 的
 * 原始 `windowHeight`（T-129 即在此处误读，见文件头 WXG-T-161 勘误）。
 *
 * 逆变换回 wx 原始 `clientX/clientY`（屏幕逻辑 px · 左上原点 = 框架契约空间）：
 * ```
 *   clientX = raw.x / dpr
 *   clientY = windowHeight - raw.y / dpr        // ≡ (windowHeight*dpr − raw.y)/dpr
 * ```
 * 与 web 分支**数学同形**（web 的 `canvasHeightCss` 在微信下恰为 `windowHeight`
 * 逻辑 px —— `weapp.getScreenSize()` 返回的就是它）⇒ 两分支数值恒等，本分支
 * 存在的意义是把「引擎量纲前提」钉在代码与单测里，并在未来画布非全屏时提供
 * 明确的分化点。
 *
 * @param raw   `e.getLocation()` 的返回值（引擎微信适配输出，见上）
 * @param space 宿主量；`windowHeight` = `wx.getWindowInfo().windowHeight`（逻辑 px）
 * @param out   可选复用对象（零分配，同 web 分支）
 * @returns 屏幕逻辑 px · 左上原点（= 框架契约空间）
 */
export interface CocosTouchSpaceWx extends CocosTouchSpace {
  /** `wx.getWindowInfo().windowHeight`（**逻辑 px**）；引擎内部会 ×dpr 后使用。 */
  readonly windowHeight: number;
}

export function normalizeCocosTouchWx(
  raw: { readonly x: number; readonly y: number },
  space: CocosTouchSpaceWx,
  out?: CocosTouchPoint,
): CocosTouchPoint {
  const target = out ?? { x: 0, y: 0 };
  const dpr = Number.isFinite(space.dpr) && space.dpr > 0 ? space.dpr : 1;
  target.x = raw.x / dpr;
  target.y = space.windowHeight - raw.y / dpr;
  return target;
}
