/**
 * UiHost — 宿主 ↔ UI 根的窄接口（ADR-0032 §6，UI-25）。
 *
 * 迁移期只暴露调试层需要的只读投影（L5：UI 根不读游戏对象，由宿主填）。
 * 意图回传（`applyPanelAction` / `usePowerup`）随 P3 Presenter 落地再加——
 * 现在没有执行者，先造动作联合会是空脚手架。
 */

import type { DrawCostBreakdown } from '@wxgame/framework';

/** 调试投影里可逐字段覆写的分段槽（来源只读，写入的是本对象自己的副本，零分配）。 */
export type DebugDrawBreakdown = { -readonly [K in keyof DrawCostBreakdown]: DrawCostBreakdown[K] };

/** 调试层四行数据的宿主投影；字段与 `drawPerfOverlay` 入参一一对应。 */
export interface UiDebugState {
    /** 统一调试开关（`settings.debugInfo`）。 */
    enabled: boolean;
    /** 帧耗时 EMA（ms）。 */
    frameMs: number;
    /**
     * `[WXG-T-1110]` 绘制成本 EMA（ms）：`App.onRender` 内的墙钟，即宿主渲染器的
     * 几何重建 + 提交。`0` = 还没量到（首帧前 / 未接线），覆层不出这一行。
     */
    drawMs: number;
    /** `[WXG-T-1110]` 本帧真下笔次数（fill + stroke，文字与 blit 不计）。 */
    paintCalls: number;
    /** `[WXG-T-1111]` 本帧命令总条数（与 paintCalls 一起读「少而贵 / 多而快」）。 */
    commands: number;
    /**
     * `[WXG-T-1111]` 宿主分段计时（矢量 / blit / 文字 / 其余）。对象是复用的同一个，
     * UI 只读；全 0 ⇒ 宿主未接线，覆层不出细分行。
     */
    breakdown: DebugDrawBreakdown;
    /** 相位，菜单腿为 `'menu'`。 */
    phase: string;
    /** 关卡标签，菜单腿为空。 */
    level: string;
    /** 附加行（pitch / LOD），菜单腿为空。 */
    detail: string;
}

export interface UiHost {
    /**
     * 每帧调用一次。实现方返回**同一个**预分配对象（热路径零分配），
     * UI 根只读不回写。
     */
    debugState(): UiDebugState;
}
