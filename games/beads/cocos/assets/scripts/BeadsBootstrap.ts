/**
 * Beads 的 Cocos 入口（方案 C 物理拷贝基线，缺口 G1）。
 *
 * 这是整个 Cocos 工程里唯一"懂游戏"的文件：把 BeadsGame 交给框架的
 * Bootstrap，其余一切（节点树 / 渲染 / 输入 / 循环）由框架在运行时构建
 * （ADR-0003：空场景 + 代码驱动）。
 *
 * 导入指向 `assets/scripts/` 内的**拷贝件**（由
 * `pnpm run framework:sync` 从 packages/framework/src 与 games/beads/src
 * 生成，禁止手改拷贝件）。相对导入**无 `.js` 后缀**——实测 Cocos 3.8.8
 * 执行期模块加载器不解析 `.js` 后缀（编译期 tsc 可解析，两回事），
 * 拷贝件统一由 `framework:sync`（默认 strip-suffix 语义）生成。
 */

import { _decorator } from 'cc';

import { Bootstrap } from './framework/adapters/cocos/bindings';
import type { Game } from './framework/core/game/game';
import { createBeadsShell } from './game/index';

const { ccclass } = _decorator;

/**
 * 调试读回口（WXG-T-167 预检 / QA `test-cases.md §A4c.3`）：仅读，不写玩法状态。
 *
 * 为何需要：探针与真机调试 Console 只能看到画面，读不到「相机把布局变成了什么」，
 * 于是 **zoom≠1 时点的还是不是那一格**（TC-CAM-DEV-01，P0）无法客观判定。曝光
 * `snapshot` 里的布局标量（渲染与命中同源的那一份）+ 盘面尺寸 + 已填格数后，
 * [B]/[R] 两侧都能算出差值与「这一点到底落子了吗」的客观读数。
 *
 * 开关与现有的 `__WXG_TOUCH_DEBUG` 共用（默认关）⇒ release 路径不对外暴露内部状态；
 * 返回值是**新鲜拷贝的标量**，调用方不得持有活对象（L5：读侧只消费快照）。
 */
interface WxgDebugGlobal {
  __WXG_TOUCH_DEBUG?: boolean;
  __WXG_GAME_DEBUG?: (() => Record<string, string | number> | null) | undefined;
  __WXG_HIT_DEBUG?: ((x: number, y: number) => { row: number; col: number } | null) | undefined;
  __WXG_CELL_DEBUG?: ((row: number, col: number) => { x: number; y: number } | null) | undefined;
  __WXG_GESTURE_DEBUG?: (() => Record<string, string | number | boolean> | null) | undefined;
}

@ccclass('BeadsBootstrap')
export class BeadsBootstrap extends Bootstrap {
  protected createGame(): Game {
    // Shell 组合 play + meta（WXG-T-164 批0）；clock 默认 Date.now，weapp 可用。
    // 在线导入（WXG-T-179）：开发者工具「编译模式 → 启动参数」传
    //   studio=http://<局域网 IP>:8787  ⇒ 主菜单设置页出现「导入」钮。
    // 不传 ⇒ 零入口（release 路径不受影响）；微信侧走 wx.request，非微信宿主回退 fetch。
    const host = globalThis as unknown as {
      wx?: {
        getLaunchOptionsSync?: () => { query?: Record<string, string> };
        request?: (opts: {
          url: string;
          success: (res: { data: unknown }) => void;
          fail: (err: { errMsg?: string }) => void;
        }) => void;
      };
      location?: { search?: string };
    };
    const studioBase =
      host.wx?.getLaunchOptionsSync?.()?.query?.studio ?? host.location?.search?.match(/studio=([^&]+)/)?.[1];
    // 微信运行时**没有全局 fetch**（实测 `typeof fetch === "undefined"`）⇒ shell 缺省通道会在
    // 点「导入」时抛 TypeError 被 reject 吃掉（静默失败，WXG-T-179 续修）；有 wx.request 时由宿主注入。
    const wxReq = host.wx?.request;
    const shell = createBeadsShell(
      studioBase
        ? {
            studio: {
              baseUrl: decodeURIComponent(studioBase),
              ...(wxReq
                ? {
                    get: (url: string): Promise<unknown> =>
                      new Promise((resolve, reject) =>
                        wxReq({
                          url,
                          success: (res) => resolve(res.data),
                          fail: (err) => reject(new Error(`wx.request 失败：${err?.errMsg ?? '?'}`)),
                        }),
                      ),
                  }
                : {}),
            },
          }
        : {},
    );
    const g = globalThis as WxgDebugGlobal;
    g.__WXG_GAME_DEBUG = () => {
      if (!g.__WXG_TOUCH_DEBUG) return null;
      const s = shell.play.snapshot;
      let filled = 0;
      for (let i = 0; i < s.cells.length; i++) if (s.cells[i]!.state === 'filled') filled++;
      return {
        screen: shell.screen,
        phase: s.phase,
        levelIndex: s.levelIndex,
        cols: s.gridCols,
        rows: s.gridRows,
        filled,
        gridLeft: s.gridLeft,
        gridTop: s.gridTop,
        gridPitch: s.gridPitch,
        gridCell: s.gridCell,
      };
    };
    // 命中与格心均**由游戏自己算**（`play.debug*`）——探针不得自推公式（K-042）。
    g.__WXG_HIT_DEBUG = (x, y) => (g.__WXG_TOUCH_DEBUG ? shell.play.debugHitCell(x, y) : null);
    g.__WXG_CELL_DEBUG = (row, col) =>
      g.__WXG_TOUCH_DEBUG ? shell.play.debugCellCenter(row, col) : null;
    // 拖拽链闸位（手指还在按下时采样）：定位「能缩放不能拖动」到底卡在哪个分支。
    g.__WXG_GESTURE_DEBUG = () => (g.__WXG_TOUCH_DEBUG ? shell.play.debugGestureState() : null);
    return shell;
  }
}
